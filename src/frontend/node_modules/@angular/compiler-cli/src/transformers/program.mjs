/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { core, createAotCompiler, getMissingNgModuleMetadataErrorData, getParseErrors, isFormattedError, isSyntaxError } from '@angular/compiler';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { translateDiagnostics } from '../diagnostics/translate_diagnostics';
import { createBundleIndexHost, MetadataCollector } from '../metadata';
import { isAngularCorePackage } from '../ngtsc/core/src/compiler';
import { NgtscProgram } from '../ngtsc/program';
import { TypeScriptReflectionHost } from '../ngtsc/reflection';
import { verifySupportedTypeScriptVersion } from '../typescript_support';
import { DEFAULT_ERROR_CODE, EmitFlags, SOURCE } from './api';
import { getOriginalReferences, TsCompilerAotCompilerTypeCheckHostAdapter } from './compiler_host';
import { getDownlevelDecoratorsTransform } from './downlevel_decorators_transform';
import { i18nExtract } from './i18n';
import { getInlineResourcesTransformFactory, InlineResourcesMetadataTransformer } from './inline_resources';
import { getExpressionLoweringTransformFactory, LowerMetadataTransform } from './lower_expressions';
import { MetadataCache } from './metadata_cache';
import { getAngularEmitterTransformFactory } from './node_emitter_transform';
import { PartialModuleMetadataTransformer } from './r3_metadata_transform';
import { getAngularClassTransformerFactory } from './r3_transform';
import { createMessageDiagnostic, DTS, GENERATED_FILES, isInRootDir, ngToTsDiagnostic, TS, tsStructureIsReused } from './util';
/**
 * Maximum number of files that are emitable via calling ts.Program.emit
 * passing individual targetSourceFiles.
 */
const MAX_FILE_COUNT_FOR_SINGLE_FILE_EMIT = 20;
/**
 * Fields to lower within metadata in render2 mode.
 */
const LOWER_FIELDS = ['useValue', 'useFactory', 'data', 'id', 'loadChildren'];
/**
 * Fields to lower within metadata in render3 mode.
 */
const R3_LOWER_FIELDS = [...LOWER_FIELDS, 'providers', 'imports', 'exports'];
/**
 * Installs a handler for testing purposes to allow inspection of the temporary program.
 */
let tempProgramHandlerForTest = null;
export function setTempProgramHandlerForTest(handler) {
    tempProgramHandlerForTest = handler;
}
export function resetTempProgramHandlerForTest() {
    tempProgramHandlerForTest = null;
}
const emptyModules = {
    ngModules: [],
    ngModuleByPipeOrDirective: new Map(),
    files: []
};
const defaultEmitCallback = ({ program, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers }) => program.emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
class AngularCompilerProgram {
    constructor(rootNames, options, host, oldProgram) {
        this.options = options;
        this.host = host;
        this._optionsDiagnostics = [];
        this._transformTsDiagnostics = [];
        this._isCompilingAngularCore = null;
        this.rootNames = [...rootNames];
        if (!options.disableTypeScriptVersionCheck) {
            verifySupportedTypeScriptVersion();
        }
        this.oldTsProgram = oldProgram ? oldProgram.getTsProgram() : undefined;
        if (oldProgram) {
            this.oldProgramLibrarySummaries = oldProgram.getLibrarySummaries();
            this.oldProgramEmittedGeneratedFiles = oldProgram.getEmittedGeneratedFiles();
            this.oldProgramEmittedSourceFiles = oldProgram.getEmittedSourceFiles();
        }
        if (options.flatModuleOutFile) {
            const { host: bundleHost, indexName, errors } = createBundleIndexHost(options, this.rootNames, host, () => this.flatModuleMetadataCache);
            if (errors) {
                this._optionsDiagnostics.push(...errors.map(e => ({
                    category: e.category,
                    messageText: e.messageText,
                    source: SOURCE,
                    code: DEFAULT_ERROR_CODE
                })));
            }
            else {
                this.rootNames.push(indexName);
                this.host = bundleHost;
            }
        }
        this.loweringMetadataTransform =
            new LowerMetadataTransform(options.enableIvy !== false ? R3_LOWER_FIELDS : LOWER_FIELDS);
        this.metadataCache = this.createMetadataCache([this.loweringMetadataTransform]);
    }
    createMetadataCache(transformers) {
        return new MetadataCache(new MetadataCollector({ quotedNames: true }), !!this.options.strictMetadataEmit, transformers);
    }
    getLibrarySummaries() {
        const result = new Map();
        if (this.oldProgramLibrarySummaries) {
            this.oldProgramLibrarySummaries.forEach((summary, fileName) => result.set(fileName, summary));
        }
        if (this.emittedLibrarySummaries) {
            this.emittedLibrarySummaries.forEach((summary, fileName) => result.set(summary.fileName, summary));
        }
        return result;
    }
    getEmittedGeneratedFiles() {
        const result = new Map();
        if (this.oldProgramEmittedGeneratedFiles) {
            this.oldProgramEmittedGeneratedFiles.forEach((genFile, fileName) => result.set(fileName, genFile));
        }
        if (this.emittedGeneratedFiles) {
            this.emittedGeneratedFiles.forEach((genFile) => result.set(genFile.genFileUrl, genFile));
        }
        return result;
    }
    getEmittedSourceFiles() {
        const result = new Map();
        if (this.oldProgramEmittedSourceFiles) {
            this.oldProgramEmittedSourceFiles.forEach((sf, fileName) => result.set(fileName, sf));
        }
        if (this.emittedSourceFiles) {
            this.emittedSourceFiles.forEach((sf) => result.set(sf.fileName, sf));
        }
        return result;
    }
    getTsProgram() {
        return this.tsProgram;
    }
    getTsOptionDiagnostics(cancellationToken) {
        return this.tsProgram.getOptionsDiagnostics(cancellationToken);
    }
    getNgOptionDiagnostics(cancellationToken) {
        return [...this._optionsDiagnostics, ...getNgOptionDiagnostics(this.options)];
    }
    getTsSyntacticDiagnostics(sourceFile, cancellationToken) {
        return this.tsProgram.getSyntacticDiagnostics(sourceFile, cancellationToken);
    }
    getNgStructuralDiagnostics(cancellationToken) {
        return this.structuralDiagnostics;
    }
    getTsSemanticDiagnostics(sourceFile, cancellationToken) {
        const sourceFiles = sourceFile ? [sourceFile] : this.tsProgram.getSourceFiles();
        let diags = [];
        sourceFiles.forEach(sf => {
            if (!GENERATED_FILES.test(sf.fileName)) {
                diags.push(...this.tsProgram.getSemanticDiagnostics(sf, cancellationToken));
            }
        });
        return diags;
    }
    getNgSemanticDiagnostics(fileName, cancellationToken) {
        let diags = [];
        this.tsProgram.getSourceFiles().forEach(sf => {
            if (GENERATED_FILES.test(sf.fileName) && !sf.isDeclarationFile) {
                diags.push(...this.tsProgram.getSemanticDiagnostics(sf, cancellationToken));
            }
        });
        const { ng } = translateDiagnostics(this.hostAdapter, diags);
        return ng;
    }
    loadNgStructureAsync() {
        if (this._analyzedModules) {
            throw new Error('Angular structure already loaded');
        }
        return Promise.resolve()
            .then(() => {
            const { tmpProgram, sourceFiles, tsFiles, rootNames } = this._createProgramWithBasicStubs();
            return this.compiler.loadFilesAsync(sourceFiles, tsFiles)
                .then(({ analyzedModules, analyzedInjectables }) => {
                if (this._analyzedModules) {
                    throw new Error('Angular structure loaded both synchronously and asynchronously');
                }
                this._updateProgramWithTypeCheckStubs(tmpProgram, analyzedModules, analyzedInjectables, rootNames);
            });
        })
            .catch(e => this._createProgramOnError(e));
    }
    listLazyRoutes(route) {
        // Note: Don't analyzedModules if a route is given
        // to be fast enough.
        return this.compiler.listLazyRoutes(route, route ? undefined : this.analyzedModules);
    }
    emit(parameters = {}) {
        if (this.options.enableIvy !== false) {
            throw new Error('Cannot run legacy compiler in ngtsc mode');
        }
        return this._emitRender2(parameters);
    }
    _emitRender2({ emitFlags = EmitFlags.Default, cancellationToken, customTransformers, emitCallback = defaultEmitCallback, mergeEmitResultsCallback = mergeEmitResults, } = {}) {
        const emitStart = Date.now();
        if (emitFlags & EmitFlags.I18nBundle) {
            const locale = this.options.i18nOutLocale || null;
            const file = this.options.i18nOutFile || null;
            const format = this.options.i18nOutFormat || null;
            const bundle = this.compiler.emitMessageBundle(this.analyzedModules, locale);
            i18nExtract(format, file, this.host, this.options, bundle);
        }
        if ((emitFlags & (EmitFlags.JS | EmitFlags.DTS | EmitFlags.Metadata | EmitFlags.Codegen)) ===
            0) {
            return { emitSkipped: true, diagnostics: [], emittedFiles: [] };
        }
        let { genFiles, genDiags } = this.generateFilesForEmit(emitFlags);
        if (genDiags.length) {
            return {
                diagnostics: genDiags,
                emitSkipped: true,
                emittedFiles: [],
            };
        }
        this.emittedGeneratedFiles = genFiles;
        const outSrcMapping = [];
        const genFileByFileName = new Map();
        genFiles.forEach(genFile => genFileByFileName.set(genFile.genFileUrl, genFile));
        this.emittedLibrarySummaries = [];
        this._transformTsDiagnostics = [];
        const emittedSourceFiles = [];
        const writeTsFile = (outFileName, outData, writeByteOrderMark, onError, sourceFiles) => {
            const sourceFile = sourceFiles && sourceFiles.length == 1 ? sourceFiles[0] : null;
            let genFile;
            if (sourceFile) {
                outSrcMapping.push({ outFileName: outFileName, sourceFile });
                genFile = genFileByFileName.get(sourceFile.fileName);
                if (!sourceFile.isDeclarationFile && !GENERATED_FILES.test(sourceFile.fileName)) {
                    // Note: sourceFile is the transformed sourcefile, not the original one!
                    const originalFile = this.tsProgram.getSourceFile(sourceFile.fileName);
                    if (originalFile) {
                        emittedSourceFiles.push(originalFile);
                    }
                }
            }
            this.writeFile(outFileName, outData, writeByteOrderMark, onError, genFile, sourceFiles);
        };
        const modules = this._analyzedInjectables &&
            this.compiler.emitAllPartialModules2(this._analyzedInjectables);
        const tsCustomTransformers = this.calculateTransforms(genFileByFileName, modules, customTransformers);
        const emitOnlyDtsFiles = (emitFlags & (EmitFlags.DTS | EmitFlags.JS)) == EmitFlags.DTS;
        // Restore the original references before we emit so TypeScript doesn't emit
        // a reference to the .d.ts file.
        const augmentedReferences = new Map();
        for (const sourceFile of this.tsProgram.getSourceFiles()) {
            const originalReferences = getOriginalReferences(sourceFile);
            if (originalReferences) {
                augmentedReferences.set(sourceFile, sourceFile.referencedFiles);
                sourceFile.referencedFiles = originalReferences;
            }
        }
        const genTsFiles = [];
        const genJsonFiles = [];
        genFiles.forEach(gf => {
            if (gf.stmts) {
                genTsFiles.push(gf);
            }
            if (gf.source) {
                genJsonFiles.push(gf);
            }
        });
        let emitResult;
        let emittedUserTsCount;
        try {
            const sourceFilesToEmit = this.getSourceFilesForEmit();
            if (sourceFilesToEmit &&
                (sourceFilesToEmit.length + genTsFiles.length) < MAX_FILE_COUNT_FOR_SINGLE_FILE_EMIT) {
                const fileNamesToEmit = [...sourceFilesToEmit.map(sf => sf.fileName), ...genTsFiles.map(gf => gf.genFileUrl)];
                emitResult = mergeEmitResultsCallback(fileNamesToEmit.map((fileName) => emitResult = emitCallback({
                    program: this.tsProgram,
                    host: this.host,
                    options: this.options,
                    writeFile: writeTsFile,
                    emitOnlyDtsFiles,
                    customTransformers: tsCustomTransformers,
                    targetSourceFile: this.tsProgram.getSourceFile(fileName),
                })));
                emittedUserTsCount = sourceFilesToEmit.length;
            }
            else {
                emitResult = emitCallback({
                    program: this.tsProgram,
                    host: this.host,
                    options: this.options,
                    writeFile: writeTsFile,
                    emitOnlyDtsFiles,
                    customTransformers: tsCustomTransformers
                });
                emittedUserTsCount = this.tsProgram.getSourceFiles().length - genTsFiles.length;
            }
        }
        finally {
            // Restore the references back to the augmented value to ensure that the
            // checks that TypeScript makes for project structure reuse will succeed.
            for (const [sourceFile, references] of Array.from(augmentedReferences)) {
                // TODO(chuckj): Remove any cast after updating build to 2.6
                sourceFile.referencedFiles = references;
            }
        }
        this.emittedSourceFiles = emittedSourceFiles;
        // Match behavior of tsc: only produce emit diagnostics if it would block
        // emit. If noEmitOnError is false, the emit will happen in spite of any
        // errors, so we should not report them.
        if (emitResult && this.options.noEmitOnError === true) {
            // translate the diagnostics in the emitResult as well.
            const translatedEmitDiags = translateDiagnostics(this.hostAdapter, emitResult.diagnostics);
            emitResult.diagnostics = translatedEmitDiags.ts.concat(this.structuralDiagnostics.concat(translatedEmitDiags.ng).map(ngToTsDiagnostic));
        }
        if (emitResult && !outSrcMapping.length) {
            // if no files were emitted by TypeScript, also don't emit .json files
            emitResult.diagnostics =
                emitResult.diagnostics.concat([createMessageDiagnostic(`Emitted no files.`)]);
            return emitResult;
        }
        let sampleSrcFileName;
        let sampleOutFileName;
        if (outSrcMapping.length) {
            sampleSrcFileName = outSrcMapping[0].sourceFile.fileName;
            sampleOutFileName = outSrcMapping[0].outFileName;
        }
        const srcToOutPath = createSrcToOutPathMapper(this.options.outDir, sampleSrcFileName, sampleOutFileName);
        if (emitFlags & EmitFlags.Codegen) {
            genJsonFiles.forEach(gf => {
                const outFileName = srcToOutPath(gf.genFileUrl);
                this.writeFile(outFileName, gf.source, false, undefined, gf);
            });
        }
        let metadataJsonCount = 0;
        if (emitFlags & EmitFlags.Metadata) {
            this.tsProgram.getSourceFiles().forEach(sf => {
                if (!sf.isDeclarationFile && !GENERATED_FILES.test(sf.fileName)) {
                    metadataJsonCount++;
                    const metadata = this.metadataCache.getMetadata(sf);
                    if (metadata) {
                        const metadataText = JSON.stringify([metadata]);
                        const outFileName = srcToOutPath(sf.fileName.replace(/\.tsx?$/, '.metadata.json'));
                        this.writeFile(outFileName, metadataText, false, undefined, undefined, [sf]);
                    }
                }
            });
        }
        const emitEnd = Date.now();
        if (emitResult && this.options.diagnostics) {
            emitResult.diagnostics = emitResult.diagnostics.concat([createMessageDiagnostic([
                    `Emitted in ${emitEnd - emitStart}ms`,
                    `- ${emittedUserTsCount} user ts files`,
                    `- ${genTsFiles.length} generated ts files`,
                    `- ${genJsonFiles.length + metadataJsonCount} generated json files`,
                ].join('\n'))]);
        }
        return emitResult;
    }
    // Private members
    get compiler() {
        if (!this._compiler) {
            this._createCompiler();
        }
        return this._compiler;
    }
    get hostAdapter() {
        if (!this._hostAdapter) {
            this._createCompiler();
        }
        return this._hostAdapter;
    }
    get analyzedModules() {
        if (!this._analyzedModules) {
            this.initSync();
        }
        return this._analyzedModules;
    }
    get structuralDiagnostics() {
        let diagnostics = this._structuralDiagnostics;
        if (!diagnostics) {
            this.initSync();
            diagnostics = (this._structuralDiagnostics = this._structuralDiagnostics || []);
        }
        return diagnostics;
    }
    get tsProgram() {
        if (!this._tsProgram) {
            this.initSync();
        }
        return this._tsProgram;
    }
    /** Whether the program is compiling the Angular core package. */
    get isCompilingAngularCore() {
        if (this._isCompilingAngularCore !== null) {
            return this._isCompilingAngularCore;
        }
        return this._isCompilingAngularCore = isAngularCorePackage(this.tsProgram);
    }
    calculateTransforms(genFiles, partialModules, customTransformers) {
        const beforeTs = [];
        const metadataTransforms = [];
        const flatModuleMetadataTransforms = [];
        const annotateForClosureCompiler = this.options.annotateForClosureCompiler || false;
        if (this.options.enableResourceInlining) {
            beforeTs.push(getInlineResourcesTransformFactory(this.tsProgram, this.hostAdapter));
            const transformer = new InlineResourcesMetadataTransformer(this.hostAdapter);
            metadataTransforms.push(transformer);
            flatModuleMetadataTransforms.push(transformer);
        }
        if (!this.options.disableExpressionLowering) {
            beforeTs.push(getExpressionLoweringTransformFactory(this.loweringMetadataTransform, this.tsProgram));
            metadataTransforms.push(this.loweringMetadataTransform);
        }
        if (genFiles) {
            beforeTs.push(getAngularEmitterTransformFactory(genFiles, this.getTsProgram(), annotateForClosureCompiler));
        }
        if (partialModules) {
            beforeTs.push(getAngularClassTransformerFactory(partialModules, annotateForClosureCompiler));
            // If we have partial modules, the cached metadata might be incorrect as it doesn't reflect
            // the partial module transforms.
            const transformer = new PartialModuleMetadataTransformer(partialModules);
            metadataTransforms.push(transformer);
            flatModuleMetadataTransforms.push(transformer);
        }
        if (customTransformers && customTransformers.beforeTs) {
            beforeTs.push(...customTransformers.beforeTs);
        }
        // If decorators should be converted to static fields (enabled by default), we set up
        // the decorator downlevel transform. Note that we set it up as last transform as that
        // allows custom transformers to strip Angular decorators without having to deal with
        // identifying static properties. e.g. it's more difficult handling `<..>.decorators`
        // or `<..>.ctorParameters` compared to the `ts.Decorator` AST nodes.
        if (this.options.annotationsAs !== 'decorators') {
            const typeChecker = this.getTsProgram().getTypeChecker();
            const reflectionHost = new TypeScriptReflectionHost(typeChecker);
            // Similarly to how we handled tsickle decorator downleveling in the past, we just
            // ignore diagnostics that have been collected by the transformer. These are
            // non-significant failures that shouldn't prevent apps from compiling.
            beforeTs.push(getDownlevelDecoratorsTransform(typeChecker, reflectionHost, [], this.isCompilingAngularCore, annotateForClosureCompiler, 
            /* skipClassDecorators */ false));
        }
        if (metadataTransforms.length > 0) {
            this.metadataCache = this.createMetadataCache(metadataTransforms);
        }
        if (flatModuleMetadataTransforms.length > 0) {
            this.flatModuleMetadataCache = this.createMetadataCache(flatModuleMetadataTransforms);
        }
        const afterTs = customTransformers ? customTransformers.afterTs : undefined;
        return { before: beforeTs, after: afterTs };
    }
    initSync() {
        if (this._analyzedModules) {
            return;
        }
        try {
            const { tmpProgram, sourceFiles, tsFiles, rootNames } = this._createProgramWithBasicStubs();
            const { analyzedModules, analyzedInjectables } = this.compiler.loadFilesSync(sourceFiles, tsFiles);
            this._updateProgramWithTypeCheckStubs(tmpProgram, analyzedModules, analyzedInjectables, rootNames);
        }
        catch (e) {
            this._createProgramOnError(e);
        }
    }
    _createCompiler() {
        const codegen = {
            generateFile: (genFileName, baseFileName) => this._compiler.emitBasicStub(genFileName, baseFileName),
            findGeneratedFileNames: (fileName) => this._compiler.findGeneratedFileNames(fileName),
        };
        this._hostAdapter = new TsCompilerAotCompilerTypeCheckHostAdapter(this.rootNames, this.options, this.host, this.metadataCache, codegen, this.oldProgramLibrarySummaries);
        const aotOptions = getAotCompilerOptions(this.options);
        const errorCollector = (this.options.collectAllErrors || this.options.fullTemplateTypeCheck) ?
            (err) => this._addStructuralDiagnostics(err) :
            undefined;
        this._compiler = createAotCompiler(this._hostAdapter, aotOptions, errorCollector).compiler;
    }
    _createProgramWithBasicStubs() {
        if (this._analyzedModules) {
            throw new Error(`Internal Error: already initialized!`);
        }
        // Note: This is important to not produce a memory leak!
        const oldTsProgram = this.oldTsProgram;
        this.oldTsProgram = undefined;
        const codegen = {
            generateFile: (genFileName, baseFileName) => this.compiler.emitBasicStub(genFileName, baseFileName),
            findGeneratedFileNames: (fileName) => this.compiler.findGeneratedFileNames(fileName),
        };
        let rootNames = [...this.rootNames];
        if (this.options.generateCodeForLibraries !== false) {
            // if we should generateCodeForLibraries, never include
            // generated files in the program as otherwise we will
            // overwrite them and typescript will report the error
            // TS5055: Cannot write file ... because it would overwrite input file.
            rootNames = rootNames.filter(fn => !GENERATED_FILES.test(fn));
        }
        if (this.options.noResolve) {
            this.rootNames.forEach(rootName => {
                if (this.hostAdapter.shouldGenerateFilesFor(rootName)) {
                    rootNames.push(...this.compiler.findGeneratedFileNames(rootName));
                }
            });
        }
        const tmpProgram = ts.createProgram(rootNames, this.options, this.hostAdapter, oldTsProgram);
        if (tempProgramHandlerForTest !== null) {
            tempProgramHandlerForTest(tmpProgram);
        }
        const sourceFiles = [];
        const tsFiles = [];
        tmpProgram.getSourceFiles().forEach(sf => {
            if (this.hostAdapter.isSourceFile(sf.fileName)) {
                sourceFiles.push(sf.fileName);
            }
            if (TS.test(sf.fileName) && !DTS.test(sf.fileName)) {
                tsFiles.push(sf.fileName);
            }
        });
        return { tmpProgram, sourceFiles, tsFiles, rootNames };
    }
    _updateProgramWithTypeCheckStubs(tmpProgram, analyzedModules, analyzedInjectables, rootNames) {
        this._analyzedModules = analyzedModules;
        this._analyzedInjectables = analyzedInjectables;
        tmpProgram.getSourceFiles().forEach(sf => {
            if (sf.fileName.endsWith('.ngfactory.ts')) {
                const { generate, baseFileName } = this.hostAdapter.shouldGenerateFile(sf.fileName);
                if (generate) {
                    // Note: ! is ok as hostAdapter.shouldGenerateFile will always return a baseFileName
                    // for .ngfactory.ts files.
                    const genFile = this.compiler.emitTypeCheckStub(sf.fileName, baseFileName);
                    if (genFile) {
                        this.hostAdapter.updateGeneratedFile(genFile);
                    }
                }
            }
        });
        this._tsProgram = ts.createProgram(rootNames, this.options, this.hostAdapter, tmpProgram);
        // Note: the new ts program should be completely reusable by TypeScript as:
        // - we cache all the files in the hostAdapter
        // - new new stubs use the exactly same imports/exports as the old once (we assert that in
        // hostAdapter.updateGeneratedFile).
        if (tsStructureIsReused(this._tsProgram) !== 2 /* Completely */) {
            throw new Error(`Internal Error: The structure of the program changed during codegen.`);
        }
    }
    _createProgramOnError(e) {
        // Still fill the analyzedModules and the tsProgram
        // so that we don't cause other errors for users who e.g. want to emit the ngProgram.
        this._analyzedModules = emptyModules;
        this.oldTsProgram = undefined;
        this._hostAdapter.isSourceFile = () => false;
        this._tsProgram = ts.createProgram(this.rootNames, this.options, this.hostAdapter);
        if (isSyntaxError(e)) {
            this._addStructuralDiagnostics(e);
            return;
        }
        throw e;
    }
    _addStructuralDiagnostics(error) {
        const diagnostics = this._structuralDiagnostics || (this._structuralDiagnostics = []);
        if (isSyntaxError(error)) {
            diagnostics.push(...syntaxErrorToDiagnostics(error, this.tsProgram));
        }
        else {
            diagnostics.push({
                messageText: error.toString(),
                category: ts.DiagnosticCategory.Error,
                source: SOURCE,
                code: DEFAULT_ERROR_CODE
            });
        }
    }
    // Note: this returns a ts.Diagnostic so that we
    // can return errors in a ts.EmitResult
    generateFilesForEmit(emitFlags) {
        try {
            if (!(emitFlags & EmitFlags.Codegen)) {
                return { genFiles: [], genDiags: [] };
            }
            // TODO(tbosch): allow generating files that are not in the rootDir
            // See https://github.com/angular/angular/issues/19337
            let genFiles = this.compiler.emitAllImpls(this.analyzedModules)
                .filter(genFile => isInRootDir(genFile.genFileUrl, this.options));
            if (this.oldProgramEmittedGeneratedFiles) {
                const oldProgramEmittedGeneratedFiles = this.oldProgramEmittedGeneratedFiles;
                genFiles = genFiles.filter(genFile => {
                    const oldGenFile = oldProgramEmittedGeneratedFiles.get(genFile.genFileUrl);
                    return !oldGenFile || !genFile.isEquivalent(oldGenFile);
                });
            }
            return { genFiles, genDiags: [] };
        }
        catch (e) {
            // TODO(tbosch): check whether we can actually have syntax errors here,
            // as we already parsed the metadata and templates before to create the type check block.
            if (isSyntaxError(e)) {
                const genDiags = [{
                        file: undefined,
                        start: undefined,
                        length: undefined,
                        messageText: e.message,
                        category: ts.DiagnosticCategory.Error,
                        source: SOURCE,
                        code: DEFAULT_ERROR_CODE
                    }];
                return { genFiles: [], genDiags };
            }
            throw e;
        }
    }
    /**
     * Returns undefined if all files should be emitted.
     */
    getSourceFilesForEmit() {
        // TODO(tbosch): if one of the files contains a `const enum`
        // always emit all files -> return undefined!
        let sourceFilesToEmit = this.tsProgram.getSourceFiles().filter(sf => {
            return !sf.isDeclarationFile && !GENERATED_FILES.test(sf.fileName);
        });
        if (this.oldProgramEmittedSourceFiles) {
            sourceFilesToEmit = sourceFilesToEmit.filter(sf => {
                const oldFile = this.oldProgramEmittedSourceFiles.get(sf.fileName);
                return sf !== oldFile;
            });
        }
        return sourceFilesToEmit;
    }
    writeFile(outFileName, outData, writeByteOrderMark, onError, genFile, sourceFiles) {
        // collect emittedLibrarySummaries
        let baseFile;
        if (genFile) {
            baseFile = this.tsProgram.getSourceFile(genFile.srcFileUrl);
            if (baseFile) {
                if (!this.emittedLibrarySummaries) {
                    this.emittedLibrarySummaries = [];
                }
                if (genFile.genFileUrl.endsWith('.ngsummary.json') && baseFile.fileName.endsWith('.d.ts')) {
                    this.emittedLibrarySummaries.push({
                        fileName: baseFile.fileName,
                        text: baseFile.text,
                        sourceFile: baseFile,
                    });
                    this.emittedLibrarySummaries.push({ fileName: genFile.genFileUrl, text: outData });
                    if (!this.options.declaration) {
                        // If we don't emit declarations, still record an empty .ngfactory.d.ts file,
                        // as we might need it later on for resolving module names from summaries.
                        const ngFactoryDts = genFile.genFileUrl.substring(0, genFile.genFileUrl.length - 15) + '.ngfactory.d.ts';
                        this.emittedLibrarySummaries.push({ fileName: ngFactoryDts, text: '' });
                    }
                }
                else if (outFileName.endsWith('.d.ts') && baseFile.fileName.endsWith('.d.ts')) {
                    const dtsSourceFilePath = genFile.genFileUrl.replace(/\.ts$/, '.d.ts');
                    // Note: Don't use sourceFiles here as the created .d.ts has a path in the outDir,
                    // but we need one that is next to the .ts file
                    this.emittedLibrarySummaries.push({ fileName: dtsSourceFilePath, text: outData });
                }
            }
        }
        // Filter out generated files for which we didn't generate code.
        // This can happen as the stub calculation is not completely exact.
        // Note: sourceFile refers to the .ngfactory.ts / .ngsummary.ts file
        // node_emitter_transform already set the file contents to be empty,
        //  so this code only needs to skip the file if !allowEmptyCodegenFiles.
        const isGenerated = GENERATED_FILES.test(outFileName);
        if (isGenerated && !this.options.allowEmptyCodegenFiles &&
            (!genFile || !genFile.stmts || genFile.stmts.length === 0)) {
            return;
        }
        if (baseFile) {
            sourceFiles = sourceFiles ? [...sourceFiles, baseFile] : [baseFile];
        }
        // TODO: remove any when TS 2.4 support is removed.
        this.host.writeFile(outFileName, outData, writeByteOrderMark, onError, sourceFiles);
    }
}
export function createProgram({ rootNames, options, host, oldProgram }) {
    if (options.enableIvy !== false) {
        return new NgtscProgram(rootNames, options, host, oldProgram);
    }
    else {
        return new AngularCompilerProgram(rootNames, options, host, oldProgram);
    }
}
// Compute the AotCompiler options
function getAotCompilerOptions(options) {
    let missingTranslation = core.MissingTranslationStrategy.Warning;
    switch (options.i18nInMissingTranslations) {
        case 'ignore':
            missingTranslation = core.MissingTranslationStrategy.Ignore;
            break;
        case 'error':
            missingTranslation = core.MissingTranslationStrategy.Error;
            break;
    }
    let translations = '';
    if (options.i18nInFile) {
        if (!options.i18nInLocale) {
            throw new Error(`The translation file (${options.i18nInFile}) locale must be provided.`);
        }
        translations = fs.readFileSync(options.i18nInFile, 'utf8');
    }
    else {
        // No translations are provided, ignore any errors
        // We still go through i18n to remove i18n attributes
        missingTranslation = core.MissingTranslationStrategy.Ignore;
    }
    return {
        locale: options.i18nInLocale,
        i18nFormat: options.i18nInFormat || options.i18nOutFormat,
        i18nUseExternalIds: options.i18nUseExternalIds,
        translations,
        missingTranslation,
        enableSummariesForJit: options.enableSummariesForJit,
        preserveWhitespaces: options.preserveWhitespaces,
        fullTemplateTypeCheck: options.fullTemplateTypeCheck,
        allowEmptyCodegenFiles: options.allowEmptyCodegenFiles,
        enableIvy: options.enableIvy,
        createExternalSymbolFactoryReexports: options.createExternalSymbolFactoryReexports,
    };
}
function getNgOptionDiagnostics(options) {
    if (options.annotationsAs) {
        switch (options.annotationsAs) {
            case 'decorators':
            case 'static fields':
                break;
            default:
                return [{
                        messageText: 'Angular compiler options "annotationsAs" only supports "static fields" and "decorators"',
                        category: ts.DiagnosticCategory.Error,
                        source: SOURCE,
                        code: DEFAULT_ERROR_CODE
                    }];
        }
    }
    return [];
}
function normalizeSeparators(path) {
    return path.replace(/\\/g, '/');
}
/**
 * Returns a function that can adjust a path from source path to out path,
 * based on an existing mapping from source to out path.
 *
 * TODO(tbosch): talk to the TypeScript team to expose their logic for calculating the `rootDir`
 * if none was specified.
 *
 * Note: This function works on normalized paths from typescript but should always return
 * POSIX normalized paths for output paths.
 */
export function createSrcToOutPathMapper(outDir, sampleSrcFileName, sampleOutFileName, host = path) {
    if (outDir) {
        let path = {}; // Ensure we error if we use `path` instead of `host`.
        if (sampleSrcFileName == null || sampleOutFileName == null) {
            throw new Error(`Can't calculate the rootDir without a sample srcFileName / outFileName. `);
        }
        const srcFileDir = normalizeSeparators(host.dirname(sampleSrcFileName));
        const outFileDir = normalizeSeparators(host.dirname(sampleOutFileName));
        if (srcFileDir === outFileDir) {
            return (srcFileName) => srcFileName;
        }
        // calculate the common suffix, stopping
        // at `outDir`.
        const srcDirParts = srcFileDir.split('/');
        const outDirParts = normalizeSeparators(host.relative(outDir, outFileDir)).split('/');
        let i = 0;
        while (i < Math.min(srcDirParts.length, outDirParts.length) &&
            srcDirParts[srcDirParts.length - 1 - i] === outDirParts[outDirParts.length - 1 - i])
            i++;
        const rootDir = srcDirParts.slice(0, srcDirParts.length - i).join('/');
        return (srcFileName) => {
            // Note: Before we return the mapped output path, we need to normalize the path delimiters
            // because the output path is usually passed to TypeScript which sometimes only expects
            // posix normalized paths (e.g. if a custom compiler host is used)
            return normalizeSeparators(host.resolve(outDir, host.relative(rootDir, srcFileName)));
        };
    }
    else {
        // Note: Before we return the output path, we need to normalize the path delimiters because
        // the output path is usually passed to TypeScript which only passes around posix
        // normalized paths (e.g. if a custom compiler host is used)
        return (srcFileName) => normalizeSeparators(srcFileName);
    }
}
function mergeEmitResults(emitResults) {
    const diagnostics = [];
    let emitSkipped = false;
    const emittedFiles = [];
    for (const er of emitResults) {
        diagnostics.push(...er.diagnostics);
        emitSkipped = emitSkipped || er.emitSkipped;
        emittedFiles.push(...(er.emittedFiles || []));
    }
    return { diagnostics, emitSkipped, emittedFiles };
}
function diagnosticSourceOfSpan(span) {
    // For diagnostics, TypeScript only uses the fileName and text properties.
    // The redundant '()' are here is to avoid having clang-format breaking the line incorrectly.
    return { fileName: span.start.file.url, text: span.start.file.content };
}
function diagnosticSourceOfFileName(fileName, program) {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile)
        return sourceFile;
    // If we are reporting diagnostics for a source file that is not in the project then we need
    // to fake a source file so the diagnostic formatting routines can emit the file name.
    // The redundant '()' are here is to avoid having clang-format breaking the line incorrectly.
    return { fileName, text: '' };
}
function diagnosticChainFromFormattedDiagnosticChain(chain) {
    return {
        messageText: chain.message,
        next: chain.next && chain.next.map(diagnosticChainFromFormattedDiagnosticChain),
        position: chain.position
    };
}
function syntaxErrorToDiagnostics(error, program) {
    const parserErrors = getParseErrors(error);
    if (parserErrors && parserErrors.length) {
        return parserErrors.map(e => ({
            messageText: e.contextualMessage(),
            file: diagnosticSourceOfSpan(e.span),
            start: e.span.start.offset,
            length: e.span.end.offset - e.span.start.offset,
            category: ts.DiagnosticCategory.Error,
            source: SOURCE,
            code: DEFAULT_ERROR_CODE
        }));
    }
    else if (isFormattedError(error)) {
        return [{
                messageText: error.message,
                chain: error.chain && diagnosticChainFromFormattedDiagnosticChain(error.chain),
                category: ts.DiagnosticCategory.Error,
                source: SOURCE,
                code: DEFAULT_ERROR_CODE,
                position: error.position
            }];
    }
    const ngModuleErrorData = getMissingNgModuleMetadataErrorData(error);
    if (ngModuleErrorData !== null) {
        // This error represents the import or export of an `NgModule` that didn't have valid metadata.
        // This _might_ happen because the NgModule in question is an Ivy-compiled library, and we want
        // to show a more useful error if that's the case.
        const ngModuleClass = getDtsClass(program, ngModuleErrorData.fileName, ngModuleErrorData.className);
        if (ngModuleClass !== null && isIvyNgModule(ngModuleClass)) {
            return [{
                    messageText: `The NgModule '${ngModuleErrorData.className}' in '${ngModuleErrorData
                        .fileName}' is imported by this compilation, but appears to be part of a library compiled for Angular Ivy. This may occur because:

  1) the library was processed with 'ngcc'. Removing and reinstalling node_modules may fix this problem.

  2) the library was published for Angular Ivy and v12+ applications only. Check its peer dependencies carefully and ensure that you're using a compatible version of Angular.

See https://angular.io/errors/NG6999 for more information.
`,
                    category: ts.DiagnosticCategory.Error,
                    code: DEFAULT_ERROR_CODE,
                    source: SOURCE,
                }];
        }
    }
    // Produce a Diagnostic anyway since we know for sure `error` is a SyntaxError
    return [{
            messageText: error.message,
            category: ts.DiagnosticCategory.Error,
            code: DEFAULT_ERROR_CODE,
            source: SOURCE,
        }];
}
function getDtsClass(program, fileName, className) {
    const sf = program.getSourceFile(fileName);
    if (sf === undefined || !sf.isDeclarationFile) {
        return null;
    }
    for (const stmt of sf.statements) {
        if (!ts.isClassDeclaration(stmt)) {
            continue;
        }
        if (stmt.name === undefined || stmt.name.text !== className) {
            continue;
        }
        return stmt;
    }
    // No classes found that matched the given name.
    return null;
}
function isIvyNgModule(clazz) {
    for (const member of clazz.members) {
        if (!ts.isPropertyDeclaration(member)) {
            continue;
        }
        if (ts.isIdentifier(member.name) && member.name.text === 'ɵmod') {
            return true;
        }
    }
    // No Ivy 'ɵmod' property found.
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3JhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvdHJhbnNmb3JtZXJzL3Byb2dyYW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0E7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFrQyxJQUFJLEVBQUUsaUJBQWlCLEVBQXdDLG1DQUFtQyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQWtHLE1BQU0sbUJBQW1CLENBQUM7QUFDeFQsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFDN0IsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDMUUsT0FBTyxFQUFDLHFCQUFxQixFQUFFLGlCQUFpQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ3JFLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2hFLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUM5QyxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUM3RCxPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUV2RSxPQUFPLEVBQW9ELGtCQUFrQixFQUFzQyxTQUFTLEVBQXNDLE1BQU0sRUFBNkMsTUFBTSxPQUFPLENBQUM7QUFDbk8sT0FBTyxFQUFnQixxQkFBcUIsRUFBRSx5Q0FBeUMsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBQ2hILE9BQU8sRUFBQywrQkFBK0IsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2pGLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFDbkMsT0FBTyxFQUFDLGtDQUFrQyxFQUFFLGtD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c291cmNlc0NvbnRlbnQiOlsiXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBb3RDb21waWxlciwgQW90Q29tcGlsZXJPcHRpb25zLCBjb3JlLCBjcmVhdGVBb3RDb21waWxlciwgRm9ybWF0dGVkTWVzc2FnZUNoYWluLCBHZW5lcmF0ZWRGaWxlLCBnZXRNaXNzaW5nTmdNb2R1bGVNZXRhZGF0YUVycm9yRGF0YSwgZ2V0UGFyc2VFcnJvcnMsIGlzRm9ybWF0dGVkRXJyb3IsIGlzU3ludGF4RXJyb3IsIE1lc3NhZ2VCdW5kbGUsIE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzLCBOZ0FuYWx5emVkTW9kdWxlcywgUGFyc2VTb3VyY2VTcGFuLCBQYXJ0aWFsTW9kdWxlfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7dHJhbnNsYXRlRGlhZ25vc3RpY3N9IGZyb20gJy4uL2RpYWdub3N0aWNzL3RyYW5zbGF0ZV9kaWFnbm9zdGljcyc7XG5pbXBvcnQge2NyZWF0ZUJ1bmRsZUluZGV4SG9zdCwgTWV0YWRhdGFDb2xsZWN0b3J9IGZyb20gJy4uL21ldGFkYXRhJztcbmltcG9ydCB7aXNBbmd1bGFyQ29yZVBhY2thZ2V9IGZyb20gJy4uL25ndHNjL2NvcmUvc3JjL2NvbXBpbGVyJztcbmltcG9ydCB7Tmd0c2NQcm9ncmFtfSBmcm9tICcuLi9uZ3RzYy9wcm9ncmFtJztcbmltcG9ydCB7VHlwZVNjcmlwdFJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi9uZ3RzYy9yZWZsZWN0aW9uJztcbmltcG9ydCB7dmVyaWZ5U3VwcG9ydGVkVHlwZVNjcmlwdFZlcnNpb259IGZyb20gJy4uL3R5cGVzY3JpcHRfc3VwcG9ydCc7XG5cbmltcG9ydCB7Q29tcGlsZXJIb3N0LCBDb21waWxlck9wdGlvbnMsIEN1c3RvbVRyYW5zZm9ybWVycywgREVGQVVMVF9FUlJPUl9DT0RFLCBEaWFnbm9zdGljLCBEaWFnbm9zdGljTWVzc2FnZUNoYWluLCBFbWl0RmxhZ3MsIExhenlSb3V0ZSwgTGlicmFyeVN1bW1hcnksIFByb2dyYW0sIFNPVVJDRSwgVHNFbWl0Q2FsbGJhY2ssIFRzTWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0NvZGVHZW5lcmF0b3IsIGdldE9yaWdpbmFsUmVmZXJlbmNlcywgVHNDb21waWxlckFvdENvbXBpbGVyVHlwZUNoZWNrSG9zdEFkYXB0ZXJ9IGZyb20gJy4vY29tcGlsZXJfaG9zdCc7XG5pbXBvcnQge2dldERvd25sZXZlbERlY29yYXRvcnNUcmFuc2Zvcm19IGZyb20gJy4vZG93bmxldmVsX2RlY29yYXRvcnNfdHJhbnNmb3JtJztcbmltcG9ydCB7aTE4bkV4dHJhY3R9IGZyb20gJy4vaTE4bic7XG5pbXBvcnQge2dldElubGluZVJlc291cmNlc1RyYW5zZm9ybUZhY3RvcnksIElubGluZVJlc291cmNlc01ldGFkYXRhVHJhbnNmb3JtZXJ9IGZyb20gJy4vaW5saW5lX3Jlc291cmNlcyc7XG5pbXBvcnQge2dldEV4cHJlc3Npb25Mb3dlcmluZ1RyYW5zZm9ybUZhY3RvcnksIExvd2VyTWV0YWRhdGFUcmFuc2Zvcm19IGZyb20gJy4vbG93ZXJfZXhwcmVzc2lvbnMnO1xuaW1wb3J0IHtNZXRhZGF0YUNhY2hlLCBNZXRhZGF0YVRyYW5zZm9ybWVyfSBmcm9tICcuL21ldGFkYXRhX2NhY2hlJztcbmltcG9ydCB7Z2V0QW5ndWxhckVtaXR0ZXJUcmFuc2Zvcm1GYWN0b3J5fSBmcm9tICcuL25vZGVfZW1pdHRlcl90cmFuc2Zvcm0nO1xuaW1wb3J0IHtQYXJ0aWFsTW9kdWxlTWV0YWRhdGFUcmFuc2Zvcm1lcn0gZnJvbSAnLi9yM19tZXRhZGF0YV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtnZXRBbmd1bGFyQ2xhc3NUcmFuc2Zvcm1lckZhY3Rvcnl9IGZyb20gJy4vcjNfdHJhbnNmb3JtJztcbmltcG9ydCB7Y3JlYXRlTWVzc2FnZURpYWdub3N0aWMsIERUUywgR0VORVJBVEVEX0ZJTEVTLCBpc0luUm9vdERpciwgbmdUb1RzRGlhZ25vc3RpYywgU3RydWN0dXJlSXNSZXVzZWQsIFRTLCB0c1N0cnVjdHVyZUlzUmV1c2VkfSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogTWF4aW11bSBudW1iZXIgb2YgZmlsZXMgdGhhdCBhcmUgZW1pdGFibGUgdmlhIGNhbGxpbmcgdHMuUHJvZ3JhbS5lbWl0XG4gKiBwYXNzaW5nIGluZGl2aWR1YWwgdGFyZ2V0U291cmNlRmlsZXMuXG4gKi9cbmNvbnN0IE1BWF9GSUxFX0NPVU5UX0ZPUl9TSU5HTEVfRklMRV9FTUlUID0gMjA7XG5cblxuLyoqXG4gKiBGaWVsZHMgdG8gbG93ZXIgd2l0aGluIG1ldGFkYXRhIGluIHJlbmRlcjIgbW9kZS5cbiAqL1xuY29uc3QgTE9XRVJfRklFTERTID0gWyd1c2VWYWx1ZScsICd1c2VGYWN0b3J5JywgJ2RhdGEnLCAnaWQnLCAnbG9hZENoaWxkcmVuJ107XG5cbi8qKlxuICogRmllbGRzIHRvIGxvd2VyIHdpdGhpbiBtZXRhZGF0YSBpbiByZW5kZXIzIG1vZGUuXG4gKi9cbmNvbnN0IFIzX0xPV0VSX0ZJRUxEUyA9IFsuLi5MT1dFUl9GSUVMRFMsICdwcm92aWRlcnMnLCAnaW1wb3J0cycsICdleHBvcnRzJ107XG5cbi8qKlxuICogSW5zdGFsbHMgYSBoYW5kbGVyIGZvciB0ZXN0aW5nIHB1cnBvc2VzIHRvIGFsbG93IGluc3BlY3Rpb24gb2YgdGhlIHRlbXBvcmFyeSBwcm9ncmFtLlxuICovXG5sZXQgdGVtcFByb2dyYW1IYW5kbGVyRm9yVGVzdDogKChwcm9ncmFtOiB0cy5Qcm9ncmFtKSA9PiB2b2lkKXxudWxsID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBzZXRUZW1wUHJvZ3JhbUhhbmRsZXJGb3JUZXN0KGhhbmRsZXI6IChwcm9ncmFtOiB0cy5Qcm9ncmFtKSA9PiB2b2lkKTogdm9pZCB7XG4gIHRlbXBQcm9ncmFtSGFuZGxlckZvclRlc3QgPSBoYW5kbGVyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VGVtcFByb2dyYW1IYW5kbGVyRm9yVGVzdCgpOiB2b2lkIHtcbiAgdGVtcFByb2dyYW1IYW5kbGVyRm9yVGVzdCA9IG51bGw7XG59XG5cbmNvbnN0IGVtcHR5TW9kdWxlczogTmdBbmFseXplZE1vZHVsZXMgPSB7XG4gIG5nTW9kdWxlczogW10sXG4gIG5nTW9kdWxlQnlQaXBlT3JEaXJlY3RpdmU6IG5ldyBNYXAoKSxcbiAgZmlsZXM6IFtdXG59O1xuXG5jb25zdCBkZWZhdWx0RW1pdENhbGxiYWNrOiBUc0VtaXRDYWxsYmFjayA9ICh7XG4gIHByb2dyYW0sXG4gIHRhcmdldFNvdXJjZUZpbGUsXG4gIHdyaXRlRmlsZSxcbiAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gIGVtaXRPbmx5RHRzRmlsZXMsXG4gIGN1c3RvbVRyYW5zZm9ybWVyc1xufSkgPT5cbiAgICBwcm9ncmFtLmVtaXQoXG4gICAgICAgIHRhcmdldFNvdXJjZUZpbGUsIHdyaXRlRmlsZSwgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIGN1c3RvbVRyYW5zZm9ybWVycyk7XG5cbmNsYXNzIEFuZ3VsYXJDb21waWxlclByb2dyYW0gaW1wbGVtZW50cyBQcm9ncmFtIHtcbiAgcHJpdmF0ZSByb290TmFtZXM6IHN0cmluZ1tdO1xuICBwcml2YXRlIG1ldGFkYXRhQ2FjaGU6IE1ldGFkYXRhQ2FjaGU7XG4gIC8vIE1ldGFkYXRhIGNhY2hlIHVzZWQgZXhjbHVzaXZlbHkgZm9yIHRoZSBmbGF0IG1vZHVsZSBpbmRleFxuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBmbGF0TW9kdWxlTWV0YWRhdGFDYWNoZSE6IE1ldGFkYXRhQ2FjaGU7XG4gIHByaXZhdGUgbG93ZXJpbmdNZXRhZGF0YVRyYW5zZm9ybTogTG93ZXJNZXRhZGF0YVRyYW5zZm9ybTtcbiAgcHJpdmF0ZSBvbGRQcm9ncmFtTGlicmFyeVN1bW1hcmllczogTWFwPHN0cmluZywgTGlicmFyeVN1bW1hcnk+fHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBvbGRQcm9ncmFtRW1pdHRlZEdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBHZW5lcmF0ZWRGaWxlPnx1bmRlZmluZWQ7XG4gIHByaXZhdGUgb2xkUHJvZ3JhbUVtaXR0ZWRTb3VyY2VGaWxlczogTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT58dW5kZWZpbmVkO1xuICAvLyBOb3RlOiBUaGlzIHdpbGwgYmUgY2xlYXJlZCBvdXQgYXMgc29vbiBhcyB3ZSBjcmVhdGUgdGhlIF90c1Byb2dyYW1cbiAgcHJpdmF0ZSBvbGRUc1Byb2dyYW06IHRzLlByb2dyYW18dW5kZWZpbmVkO1xuICBwcml2YXRlIGVtaXR0ZWRMaWJyYXJ5U3VtbWFyaWVzOiBMaWJyYXJ5U3VtbWFyeVtdfHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBlbWl0dGVkR2VuZXJhdGVkRmlsZXM6IEdlbmVyYXRlZEZpbGVbXXx1bmRlZmluZWQ7XG4gIHByaXZhdGUgZW1pdHRlZFNvdXJjZUZpbGVzOiB0cy5Tb3VyY2VGaWxlW118dW5kZWZpbmVkO1xuXG4gIC8vIExhemlseSBpbml0aWFsaXplZCBmaWVsZHNcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgX2NvbXBpbGVyITogQW90Q29tcGlsZXI7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIF9ob3N0QWRhcHRlciE6IFRzQ29tcGlsZXJBb3RDb21waWxlclR5cGVDaGVja0hvc3RBZGFwdGVyO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBfdHNQcm9ncmFtITogdHMuUHJvZ3JhbTtcbiAgcHJpdmF0ZSBfYW5hbHl6ZWRNb2R1bGVzOiBOZ0FuYWx5emVkTW9kdWxlc3x1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2FuYWx5emVkSW5qZWN0YWJsZXM6IE5nQW5hbHl6ZWRGaWxlV2l0aEluamVjdGFibGVzW118dW5kZWZpbmVkO1xuICBwcml2YXRlIF9zdHJ1Y3R1cmFsRGlhZ25vc3RpY3M6IERpYWdub3N0aWNbXXx1bmRlZmluZWQ7XG4gIHByaXZhdGUgX3Byb2dyYW1XaXRoU3R1YnM6IHRzLlByb2dyYW18dW5kZWZpbmVkO1xuICBwcml2YXRlIF9vcHRpb25zRGlhZ25vc3RpY3M6IERpYWdub3N0aWNbXSA9IFtdO1xuICBwcml2YXRlIF90cmFuc2Zvcm1Uc0RpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJvb3ROYW1lczogUmVhZG9ubHlBcnJheTxzdHJpbmc+LCBwcml2YXRlIG9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyxcbiAgICAgIHByaXZhdGUgaG9zdDogQ29tcGlsZXJIb3N0LCBvbGRQcm9ncmFtPzogUHJvZ3JhbSkge1xuICAgIHRoaXMucm9vdE5hbWVzID0gWy4uLnJvb3ROYW1lc107XG5cbiAgICBpZiAoIW9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2spIHtcbiAgICAgIHZlcmlmeVN1cHBvcnRlZFR5cGVTY3JpcHRWZXJzaW9uKCk7XG4gICAgfVxuXG4gICAgdGhpcy5vbGRUc1Byb2dyYW0gPSBvbGRQcm9ncmFtID8gb2xkUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSA6IHVuZGVmaW5lZDtcbiAgICBpZiAob2xkUHJvZ3JhbSkge1xuICAgICAgdGhpcy5vbGRQcm9ncmFtTGlicmFyeVN1bW1hcmllcyA9IG9sZFByb2dyYW0uZ2V0TGlicmFyeVN1bW1hcmllcygpO1xuICAgICAgdGhpcy5vbGRQcm9ncmFtRW1pdHRlZEdlbmVyYXRlZEZpbGVzID0gb2xkUHJvZ3JhbS5nZXRFbWl0dGVkR2VuZXJhdGVkRmlsZXMoKTtcbiAgICAgIHRoaXMub2xkUHJvZ3JhbUVtaXR0ZWRTb3VyY2VGaWxlcyA9IG9sZFByb2dyYW0uZ2V0RW1pdHRlZFNvdXJjZUZpbGVzKCk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuZmxhdE1vZHVsZU91dEZpbGUpIHtcbiAgICAgIGNvbnN0IHtob3N0OiBidW5kbGVIb3N0LCBpbmRleE5hbWUsIGVycm9yc30gPVxuICAgICAgICAgIGNyZWF0ZUJ1bmRsZUluZGV4SG9zdChvcHRpb25zLCB0aGlzLnJvb3ROYW1lcywgaG9zdCwgKCkgPT4gdGhpcy5mbGF0TW9kdWxlTWV0YWRhdGFDYWNoZSk7XG4gICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgIHRoaXMuX29wdGlvbnNEaWFnbm9zdGljcy5wdXNoKC4uLmVycm9ycy5tYXAoZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6IGUuY2F0ZWdvcnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlVGV4dDogZS5tZXNzYWdlVGV4dCBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IFNPVVJDRSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IERFRkFVTFRfRVJST1JfQ09ERVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJvb3ROYW1lcy5wdXNoKGluZGV4TmFtZSEpO1xuICAgICAgICB0aGlzLmhvc3QgPSBidW5kbGVIb3N0O1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMubG93ZXJpbmdNZXRhZGF0YVRyYW5zZm9ybSA9XG4gICAgICAgIG5ldyBMb3dlck1ldGFkYXRhVHJhbnNmb3JtKG9wdGlvbnMuZW5hYmxlSXZ5ICE9PSBmYWxzZSA/IFIzX0xPV0VSX0ZJRUxEUyA6IExPV0VSX0ZJRUxEUyk7XG4gICAgdGhpcy5tZXRhZGF0YUNhY2hlID0gdGhpcy5jcmVhdGVNZXRhZGF0YUNhY2hlKFt0aGlzLmxvd2VyaW5nTWV0YWRhdGFUcmFuc2Zvcm1dKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTWV0YWRhdGFDYWNoZSh0cmFuc2Zvcm1lcnM6IE1ldGFkYXRhVHJhbnNmb3JtZXJbXSkge1xuICAgIHJldHVybiBuZXcgTWV0YWRhdGFDYWNoZShcbiAgICAgICAgbmV3IE1ldGFkYXRhQ29sbGVjdG9yKHtxdW90ZWROYW1lczogdHJ1ZX0pLCAhIXRoaXMub3B0aW9ucy5zdHJpY3RNZXRhZGF0YUVtaXQsXG4gICAgICAgIHRyYW5zZm9ybWVycyk7XG4gIH1cblxuICBnZXRMaWJyYXJ5U3VtbWFyaWVzKCk6IE1hcDxzdHJpbmcsIExpYnJhcnlTdW1tYXJ5PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIExpYnJhcnlTdW1tYXJ5PigpO1xuICAgIGlmICh0aGlzLm9sZFByb2dyYW1MaWJyYXJ5U3VtbWFyaWVzKSB7XG4gICAgICB0aGlzLm9sZFByb2dyYW1MaWJyYXJ5U3VtbWFyaWVzLmZvckVhY2goKHN1bW1hcnksIGZpbGVOYW1lKSA9PiByZXN1bHQuc2V0KGZpbGVOYW1lLCBzdW1tYXJ5KSk7XG4gICAgfVxuICAgIGlmICh0aGlzLmVtaXR0ZWRMaWJyYXJ5U3VtbWFyaWVzKSB7XG4gICAgICB0aGlzLmVtaXR0ZWRMaWJyYXJ5U3VtbWFyaWVzLmZvckVhY2goXG4gICAgICAgICAgKHN1bW1hcnksIGZpbGVOYW1lKSA9PiByZXN1bHQuc2V0KHN1bW1hcnkuZmlsZU5hbWUsIHN1bW1hcnkpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldEVtaXR0ZWRHZW5lcmF0ZWRGaWxlcygpOiBNYXA8c3RyaW5nLCBHZW5lcmF0ZWRGaWxlPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIEdlbmVyYXRlZEZpbGU+KCk7XG4gICAgaWYgKHRoaXMub2xkUHJvZ3JhbUVtaXR0ZWRHZW5lcmF0ZWRGaWxlcykge1xuICAgICAgdGhpcy5vbGRQcm9ncmFtRW1pdHRlZEdlbmVyYXRlZEZpbGVzLmZvckVhY2goXG4gICAgICAgICAgKGdlbkZpbGUsIGZpbGVOYW1lKSA9PiByZXN1bHQuc2V0KGZpbGVOYW1lLCBnZW5GaWxlKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLmVtaXR0ZWRHZW5lcmF0ZWRGaWxlcykge1xuICAgICAgdGhpcy5lbWl0dGVkR2VuZXJhdGVkRmlsZXMuZm9yRWFjaCgoZ2VuRmlsZSkgPT4gcmVzdWx0LnNldChnZW5GaWxlLmdlbkZpbGVVcmwsIGdlbkZpbGUpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldEVtaXR0ZWRTb3VyY2VGaWxlcygpOiBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+KCk7XG4gICAgaWYgKHRoaXMub2xkUHJvZ3JhbUVtaXR0ZWRTb3VyY2VGaWxlcykge1xuICAgICAgdGhpcy5vbGRQcm9ncmFtRW1pdHRlZFNvdXJjZUZpbGVzLmZvckVhY2goKHNmLCBmaWxlTmFtZSkgPT4gcmVzdWx0LnNldChmaWxlTmFtZSwgc2YpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZW1pdHRlZFNvdXJjZUZpbGVzKSB7XG4gICAgICB0aGlzLmVtaXR0ZWRTb3VyY2VGaWxlcy5mb3JFYWNoKChzZikgPT4gcmVzdWx0LnNldChzZi5maWxlTmFtZSwgc2YpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldFRzUHJvZ3JhbSgpOiB0cy5Qcm9ncmFtIHtcbiAgICByZXR1cm4gdGhpcy50c1Byb2dyYW07XG4gIH1cblxuICBnZXRUc09wdGlvbkRpYWdub3N0aWNzKGNhbmNlbGxhdGlvblRva2VuPzogdHMuQ2FuY2VsbGF0aW9uVG9rZW4pIHtcbiAgICByZXR1cm4gdGhpcy50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKGNhbmNlbGxhdGlvblRva2VuKTtcbiAgfVxuXG4gIGdldE5nT3B0aW9uRGlhZ25vc3RpY3MoY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbik6IFJlYWRvbmx5QXJyYXk8RGlhZ25vc3RpYz4ge1xuICAgIHJldHVybiBbLi4udGhpcy5fb3B0aW9uc0RpYWdub3N0aWNzLCAuLi5nZXROZ09wdGlvbkRpYWdub3N0aWNzKHRoaXMub3B0aW9ucyldO1xuICB9XG5cbiAgZ2V0VHNTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlPzogdHMuU291cmNlRmlsZSwgY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbik6XG4gICAgICBSZWFkb25seUFycmF5PHRzLkRpYWdub3N0aWM+IHtcbiAgICByZXR1cm4gdGhpcy50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSwgY2FuY2VsbGF0aW9uVG9rZW4pO1xuICB9XG5cbiAgZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbik6IFJlYWRvbmx5QXJyYXk8RGlhZ25vc3RpYz4ge1xuICAgIHJldHVybiB0aGlzLnN0cnVjdHVyYWxEaWFnbm9zdGljcztcbiAgfVxuXG4gIGdldFRzU2VtYW50aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlPzogdHMuU291cmNlRmlsZSwgY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbik6XG4gICAgICBSZWFkb25seUFycmF5PHRzLkRpYWdub3N0aWM+IHtcbiAgICBjb25zdCBzb3VyY2VGaWxlcyA9IHNvdXJjZUZpbGUgPyBbc291cmNlRmlsZV0gOiB0aGlzLnRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpO1xuICAgIGxldCBkaWFnczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gICAgc291cmNlRmlsZXMuZm9yRWFjaChzZiA9PiB7XG4gICAgICBpZiAoIUdFTkVSQVRFRF9GSUxFUy50ZXN0KHNmLmZpbGVOYW1lKSkge1xuICAgICAgICBkaWFncy5wdXNoKC4uLnRoaXMudHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YsIGNhbmNlbGxhdGlvblRva2VuKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRpYWdzO1xuICB9XG5cbiAgZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKGZpbGVOYW1lPzogc3RyaW5nLCBjYW5jZWxsYXRpb25Ub2tlbj86IHRzLkNhbmNlbGxhdGlvblRva2VuKTpcbiAgICAgIFJlYWRvbmx5QXJyYXk8RGlhZ25vc3RpYz4ge1xuICAgIGxldCBkaWFnczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gICAgdGhpcy50c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5mb3JFYWNoKHNmID0+IHtcbiAgICAgIGlmIChHRU5FUkFURURfRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiYgIXNmLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGRpYWdzLnB1c2goLi4udGhpcy50c1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzZiwgY2FuY2VsbGF0aW9uVG9rZW4pKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCB7bmd9ID0gdHJhbnNsYXRlRGlhZ25vc3RpY3ModGhpcy5ob3N0QWRhcHRlciwgZGlhZ3MpO1xuICAgIHJldHVybiBuZztcbiAgfVxuXG4gIGxvYWROZ1N0cnVjdHVyZUFzeW5jKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLl9hbmFseXplZE1vZHVsZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQW5ndWxhciBzdHJ1Y3R1cmUgYWxyZWFkeSBsb2FkZWQnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICBjb25zdCB7dG1wUHJvZ3JhbSwgc291cmNlRmlsZXMsIHRzRmlsZXMsIHJvb3ROYW1lc30gPSB0aGlzLl9jcmVhdGVQcm9ncmFtV2l0aEJhc2ljU3R1YnMoKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jb21waWxlci5sb2FkRmlsZXNBc3luYyhzb3VyY2VGaWxlcywgdHNGaWxlcylcbiAgICAgICAgICAgICAgLnRoZW4oKHthbmFseXplZE1vZHVsZXMsIGFuYWx5emVkSW5qZWN0YWJsZXN9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2FuYWx5emVkTW9kdWxlcykge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbmd1bGFyIHN0cnVjdHVyZSBsb2FkZWQgYm90aCBzeW5jaHJvbm91c2x5IGFuZCBhc3luY2hyb25vdXNseScpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVQcm9ncmFtV2l0aFR5cGVDaGVja1N0dWJzKFxuICAgICAgICAgICAgICAgICAgICB0bXBQcm9ncmFtLCBhbmFseXplZE1vZHVsZXMsIGFuYWx5emVkSW5qZWN0YWJsZXMsIHJvb3ROYW1lcyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZSA9PiB0aGlzLl9jcmVhdGVQcm9ncmFtT25FcnJvcihlKSk7XG4gIH1cblxuICBsaXN0TGF6eVJvdXRlcyhyb3V0ZT86IHN0cmluZyk6IExhenlSb3V0ZVtdIHtcbiAgICAvLyBOb3RlOiBEb24ndCBhbmFseXplZE1vZHVsZXMgaWYgYSByb3V0ZSBpcyBnaXZlblxuICAgIC8vIHRvIGJlIGZhc3QgZW5vdWdoLlxuICAgIHJldHVybiB0aGlzLmNvbXBpbGVyLmxpc3RMYXp5Um91dGVzKHJvdXRlLCByb3V0ZSA/IHVuZGVmaW5lZCA6IHRoaXMuYW5hbHl6ZWRNb2R1bGVzKTtcbiAgfVxuXG4gIGVtaXQocGFyYW1ldGVyczoge1xuICAgIGVtaXRGbGFncz86IEVtaXRGbGFncyxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbj86IHRzLkNhbmNlbGxhdGlvblRva2VuLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycz86IEN1c3RvbVRyYW5zZm9ybWVycyxcbiAgICBlbWl0Q2FsbGJhY2s/OiBUc0VtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s/OiBUc01lcmdlRW1pdFJlc3VsdHNDYWxsYmFjayxcbiAgfSA9IHt9KTogdHMuRW1pdFJlc3VsdCB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5lbmFibGVJdnkgIT09IGZhbHNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBydW4gbGVnYWN5IGNvbXBpbGVyIGluIG5ndHNjIG1vZGUnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2VtaXRSZW5kZXIyKHBhcmFtZXRlcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW1pdFJlbmRlcjIoe1xuICAgIGVtaXRGbGFncyA9IEVtaXRGbGFncy5EZWZhdWx0LFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycyxcbiAgICBlbWl0Q2FsbGJhY2sgPSBkZWZhdWx0RW1pdENhbGxiYWNrLFxuICAgIG1lcmdlRW1pdFJlc3VsdHNDYWxsYmFjayA9IG1lcmdlRW1pdFJlc3VsdHMsXG4gIH06IHtcbiAgICBlbWl0RmxhZ3M/OiBFbWl0RmxhZ3MsXG4gICAgY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbixcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnM/OiBDdXN0b21UcmFuc2Zvcm1lcnMsXG4gICAgZW1pdENhbGxiYWNrPzogVHNFbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrPzogVHNNZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2ssXG4gIH0gPSB7fSk6IHRzLkVtaXRSZXN1bHQge1xuICAgIGNvbnN0IGVtaXRTdGFydCA9IERhdGUubm93KCk7XG4gICAgaWYgKGVtaXRGbGFncyAmIEVtaXRGbGFncy5JMThuQnVuZGxlKSB7XG4gICAgICBjb25zdCBsb2NhbGUgPSB0aGlzLm9wdGlvbnMuaTE4bk91dExvY2FsZSB8fCBudWxsO1xuICAgICAgY29uc3QgZmlsZSA9IHRoaXMub3B0aW9ucy5pMThuT3V0RmlsZSB8fCBudWxsO1xuICAgICAgY29uc3QgZm9ybWF0ID0gdGhpcy5vcHRpb25zLmkxOG5PdXRGb3JtYXQgfHwgbnVsbDtcbiAgICAgIGNvbnN0IGJ1bmRsZSA9IHRoaXMuY29tcGlsZXIuZW1pdE1lc3NhZ2VCdW5kbGUodGhpcy5hbmFseXplZE1vZHVsZXMsIGxvY2FsZSk7XG4gICAgICBpMThuRXh0cmFjdChmb3JtYXQsIGZpbGUsIHRoaXMuaG9zdCwgdGhpcy5vcHRpb25zLCBidW5kbGUpO1xuICAgIH1cbiAgICBpZiAoKGVtaXRGbGFncyAmIChFbWl0RmxhZ3MuSlMgfCBFbWl0RmxhZ3MuRFRTIHwgRW1pdEZsYWdzLk1ldGFkYXRhIHwgRW1pdEZsYWdzLkNvZGVnZW4pKSA9PT1cbiAgICAgICAgMCkge1xuICAgICAgcmV0dXJuIHtlbWl0U2tpcHBlZDogdHJ1ZSwgZGlhZ25vc3RpY3M6IFtdLCBlbWl0dGVkRmlsZXM6IFtdfTtcbiAgICB9XG4gICAgbGV0IHtnZW5GaWxlcywgZ2VuRGlhZ3N9ID0gdGhpcy5nZW5lcmF0ZUZpbGVzRm9yRW1pdChlbWl0RmxhZ3MpO1xuICAgIGlmIChnZW5EaWFncy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRpYWdub3N0aWNzOiBnZW5EaWFncyxcbiAgICAgICAgZW1pdFNraXBwZWQ6IHRydWUsXG4gICAgICAgIGVtaXR0ZWRGaWxlczogW10sXG4gICAgICB9O1xuICAgIH1cbiAgICB0aGlzLmVtaXR0ZWRHZW5lcmF0ZWRGaWxlcyA9IGdlbkZpbGVzO1xuICAgIGNvbnN0IG91dFNyY01hcHBpbmc6IEFycmF5PHtzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlLCBvdXRGaWxlTmFtZTogc3RyaW5nfT4gPSBbXTtcbiAgICBjb25zdCBnZW5GaWxlQnlGaWxlTmFtZSA9IG5ldyBNYXA8c3RyaW5nLCBHZW5lcmF0ZWRGaWxlPigpO1xuICAgIGdlbkZpbGVzLmZvckVhY2goZ2VuRmlsZSA9PiBnZW5GaWxlQnlGaWxlTmFtZS5zZXQoZ2VuRmlsZS5nZW5GaWxlVXJsLCBnZW5GaWxlKSk7XG4gICAgdGhpcy5lbWl0dGVkTGlicmFyeVN1bW1hcmllcyA9IFtdO1xuICAgIHRoaXMuX3RyYW5zZm9ybVRzRGlhZ25vc3RpY3MgPSBbXTtcbiAgICBjb25zdCBlbWl0dGVkU291cmNlRmlsZXMgPSBbXSBhcyB0cy5Tb3VyY2VGaWxlW107XG4gICAgY29uc3Qgd3JpdGVUc0ZpbGU6IHRzLldyaXRlRmlsZUNhbGxiYWNrID1cbiAgICAgICAgKG91dEZpbGVOYW1lLCBvdXREYXRhLCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3I/LCBzb3VyY2VGaWxlcz8pID0+IHtcbiAgICAgICAgICBjb25zdCBzb3VyY2VGaWxlID0gc291cmNlRmlsZXMgJiYgc291cmNlRmlsZXMubGVuZ3RoID09IDEgPyBzb3VyY2VGaWxlc1swXSA6IG51bGw7XG4gICAgICAgICAgbGV0IGdlbkZpbGU6IEdlbmVyYXRlZEZpbGV8dW5kZWZpbmVkO1xuICAgICAgICAgIGlmIChzb3VyY2VGaWxlKSB7XG4gICAgICAgICAgICBvdXRTcmNNYXBwaW5nLnB1c2goe291dEZpbGVOYW1lOiBvdXRGaWxlTmFtZSwgc291cmNlRmlsZX0pO1xuICAgICAgICAgICAgZ2VuRmlsZSA9IGdlbkZpbGVCeUZpbGVOYW1lLmdldChzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgICAgICAgICAgIGlmICghc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSAmJiAhR0VORVJBVEVEX0ZJTEVTLnRlc3Qoc291cmNlRmlsZS5maWxlTmFtZSkpIHtcbiAgICAgICAgICAgICAgLy8gTm90ZTogc291cmNlRmlsZSBpcyB0aGUgdHJhbnNmb3JtZWQgc291cmNlZmlsZSwgbm90IHRoZSBvcmlnaW5hbCBvbmUhXG4gICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZSA9IHRoaXMudHNQcm9ncmFtLmdldFNvdXJjZUZpbGUoc291cmNlRmlsZS5maWxlTmFtZSk7XG4gICAgICAgICAgICAgIGlmIChvcmlnaW5hbEZpbGUpIHtcbiAgICAgICAgICAgICAgICBlbWl0dGVkU291cmNlRmlsZXMucHVzaChvcmlnaW5hbEZpbGUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMud3JpdGVGaWxlKG91dEZpbGVOYW1lLCBvdXREYXRhLCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIGdlbkZpbGUsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfTtcblxuICAgIGNvbnN0IG1vZHVsZXMgPSB0aGlzLl9hbmFseXplZEluamVjdGFibGVzICYmXG4gICAgICAgIHRoaXMuY29tcGlsZXIuZW1pdEFsbFBhcnRpYWxNb2R1bGVzMih0aGlzLl9hbmFseXplZEluamVjdGFibGVzKTtcblxuICAgIGNvbnN0IHRzQ3VzdG9tVHJhbnNmb3JtZXJzID1cbiAgICAgICAgdGhpcy5jYWxjdWxhdGVUcmFuc2Zvcm1zKGdlbkZpbGVCeUZpbGVOYW1lLCBtb2R1bGVzLCBjdXN0b21UcmFuc2Zvcm1lcnMpO1xuICAgIGNvbnN0IGVtaXRPbmx5RHRzRmlsZXMgPSAoZW1pdEZsYWdzICYgKEVtaXRGbGFncy5EVFMgfCBFbWl0RmxhZ3MuSlMpKSA9PSBFbWl0RmxhZ3MuRFRTO1xuICAgIC8vIFJlc3RvcmUgdGhlIG9yaWdpbmFsIHJlZmVyZW5jZXMgYmVmb3JlIHdlIGVtaXQgc28gVHlwZVNjcmlwdCBkb2Vzbid0IGVtaXRcbiAgICAvLyBhIHJlZmVyZW5jZSB0byB0aGUgLmQudHMgZmlsZS5cbiAgICBjb25zdCBhdWdtZW50ZWRSZWZlcmVuY2VzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBSZWFkb25seUFycmF5PHRzLkZpbGVSZWZlcmVuY2U+PigpO1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0aGlzLnRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBjb25zdCBvcmlnaW5hbFJlZmVyZW5jZXMgPSBnZXRPcmlnaW5hbFJlZmVyZW5jZXMoc291cmNlRmlsZSk7XG4gICAgICBpZiAob3JpZ2luYWxSZWZlcmVuY2VzKSB7XG4gICAgICAgIGF1Z21lbnRlZFJlZmVyZW5jZXMuc2V0KHNvdXJjZUZpbGUsIHNvdXJjZUZpbGUucmVmZXJlbmNlZEZpbGVzKTtcbiAgICAgICAgc291cmNlRmlsZS5yZWZlcmVuY2VkRmlsZXMgPSBvcmlnaW5hbFJlZmVyZW5jZXM7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGdlblRzRmlsZXM6IEdlbmVyYXRlZEZpbGVbXSA9IFtdO1xuICAgIGNvbnN0IGdlbkpzb25GaWxlczogR2VuZXJhdGVkRmlsZVtdID0gW107XG4gICAgZ2VuRmlsZXMuZm9yRWFjaChnZiA9PiB7XG4gICAgICBpZiAoZ2Yuc3RtdHMpIHtcbiAgICAgICAgZ2VuVHNGaWxlcy5wdXNoKGdmKTtcbiAgICAgIH1cbiAgICAgIGlmIChnZi5zb3VyY2UpIHtcbiAgICAgICAgZ2VuSnNvbkZpbGVzLnB1c2goZ2YpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGxldCBlbWl0UmVzdWx0OiB0cy5FbWl0UmVzdWx0O1xuICAgIGxldCBlbWl0dGVkVXNlclRzQ291bnQ6IG51bWJlcjtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZXNUb0VtaXQgPSB0aGlzLmdldFNvdXJjZUZpbGVzRm9yRW1pdCgpO1xuICAgICAgaWYgKHNvdXJjZUZpbGVzVG9FbWl0ICYmXG4gICAgICAgICAgKHNvdXJjZUZpbGVzVG9FbWl0Lmxlbmd0aCArIGdlblRzRmlsZXMubGVuZ3RoKSA8IE1BWF9GSUxFX0NPVU5UX0ZPUl9TSU5HTEVfRklMRV9FTUlUKSB7XG4gICAgICAgIGNvbnN0IGZpbGVOYW1lc1RvRW1pdCA9XG4gICAgICAgICAgICBbLi4uc291cmNlRmlsZXNUb0VtaXQubWFwKHNmID0+IHNmLmZpbGVOYW1lKSwgLi4uZ2VuVHNGaWxlcy5tYXAoZ2YgPT4gZ2YuZ2VuRmlsZVVybCldO1xuICAgICAgICBlbWl0UmVzdWx0ID0gbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrKFxuICAgICAgICAgICAgZmlsZU5hbWVzVG9FbWl0Lm1hcCgoZmlsZU5hbWUpID0+IGVtaXRSZXN1bHQgPSBlbWl0Q2FsbGJhY2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb2dyYW06IHRoaXMudHNQcm9ncmFtLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhvc3Q6IHRoaXMuaG9zdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiB0aGlzLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3JpdGVGaWxlOiB3cml0ZVRzRmlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1c3RvbVRyYW5zZm9ybWVyczogdHNDdXN0b21UcmFuc2Zvcm1lcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0U291cmNlRmlsZTogdGhpcy50c1Byb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlTmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICAgIGVtaXR0ZWRVc2VyVHNDb3VudCA9IHNvdXJjZUZpbGVzVG9FbWl0Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtaXRSZXN1bHQgPSBlbWl0Q2FsbGJhY2soe1xuICAgICAgICAgIHByb2dyYW06IHRoaXMudHNQcm9ncmFtLFxuICAgICAgICAgIGhvc3Q6IHRoaXMuaG9zdCxcbiAgICAgICAgICBvcHRpb25zOiB0aGlzLm9wdGlvbnMsXG4gICAgICAgICAgd3JpdGVGaWxlOiB3cml0ZVRzRmlsZSxcbiAgICAgICAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgICAgICAgIGN1c3RvbVRyYW5zZm9ybWVyczogdHNDdXN0b21UcmFuc2Zvcm1lcnNcbiAgICAgICAgfSk7XG4gICAgICAgIGVtaXR0ZWRVc2VyVHNDb3VudCA9IHRoaXMudHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkubGVuZ3RoIC0gZ2VuVHNGaWxlcy5sZW5ndGg7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIC8vIFJlc3RvcmUgdGhlIHJlZmVyZW5jZXMgYmFjayB0byB0aGUgYXVnbWVudGVkIHZhbHVlIHRvIGVuc3VyZSB0aGF0IHRoZVxuICAgICAgLy8gY2hlY2tzIHRoYXQgVHlwZVNjcmlwdCBtYWtlcyBmb3IgcHJvamVjdCBzdHJ1Y3R1cmUgcmV1c2Ugd2lsbCBzdWNjZWVkLlxuICAgICAgZm9yIChjb25zdCBbc291cmNlRmlsZSwgcmVmZXJlbmNlc10gb2YgQXJyYXkuZnJvbShhdWdtZW50ZWRSZWZlcmVuY2VzKSkge1xuICAgICAgICAvLyBUT0RPKGNodWNraik6IFJlbW92ZSBhbnkgY2FzdCBhZnRlciB1cGRhdGluZyBidWlsZCB0byAyLjZcbiAgICAgICAgKHNvdXJjZUZpbGUgYXMgYW55KS5yZWZlcmVuY2VkRmlsZXMgPSByZWZlcmVuY2VzO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmVtaXR0ZWRTb3VyY2VGaWxlcyA9IGVtaXR0ZWRTb3VyY2VGaWxlcztcblxuICAgIC8vIE1hdGNoIGJlaGF2aW9yIG9mIHRzYzogb25seSBwcm9kdWNlIGVtaXQgZGlhZ25vc3RpY3MgaWYgaXQgd291bGQgYmxvY2tcbiAgICAvLyBlbWl0LiBJZiBub0VtaXRPbkVycm9yIGlzIGZhbHNlLCB0aGUgZW1pdCB3aWxsIGhhcHBlbiBpbiBzcGl0ZSBvZiBhbnlcbiAgICAvLyBlcnJvcnMsIHNvIHdlIHNob3VsZCBub3QgcmVwb3J0IHRoZW0uXG4gICAgaWYgKGVtaXRSZXN1bHQgJiYgdGhpcy5vcHRpb25zLm5vRW1pdE9uRXJyb3IgPT09IHRydWUpIHtcbiAgICAgIC8vIHRyYW5zbGF0ZSB0aGUgZGlhZ25vc3RpY3MgaW4gdGhlIGVtaXRSZXN1bHQgYXMgd2VsbC5cbiAgICAgIGNvbnN0IHRyYW5zbGF0ZWRFbWl0RGlhZ3MgPSB0cmFuc2xhdGVEaWFnbm9zdGljcyh0aGlzLmhvc3RBZGFwdGVyLCBlbWl0UmVzdWx0LmRpYWdub3N0aWNzKTtcbiAgICAgIGVtaXRSZXN1bHQuZGlhZ25vc3RpY3MgPSB0cmFuc2xhdGVkRW1pdERpYWdzLnRzLmNvbmNhdChcbiAgICAgICAgICB0aGlzLnN0cnVjdHVyYWxEaWFnbm9zdGljcy5jb25jYXQodHJhbnNsYXRlZEVtaXREaWFncy5uZykubWFwKG5nVG9Uc0RpYWdub3N0aWMpKTtcbiAgICB9XG5cbiAgICBpZiAoZW1pdFJlc3VsdCAmJiAhb3V0U3JjTWFwcGluZy5sZW5ndGgpIHtcbiAgICAgIC8vIGlmIG5vIGZpbGVzIHdlcmUgZW1pdHRlZCBieSBUeXBlU2NyaXB0LCBhbHNvIGRvbid0IGVtaXQgLmpzb24gZmlsZXNcbiAgICAgIGVtaXRSZXN1bHQuZGlhZ25vc3RpY3MgPVxuICAgICAgICAgIGVtaXRSZXN1bHQuZGlhZ25vc3RpY3MuY29uY2F0KFtjcmVhdGVNZXNzYWdlRGlhZ25vc3RpYyhgRW1pdHRlZCBubyBmaWxlcy5gKV0pO1xuICAgICAgcmV0dXJuIGVtaXRSZXN1bHQ7XG4gICAgfVxuXG4gICAgbGV0IHNhbXBsZVNyY0ZpbGVOYW1lOiBzdHJpbmd8dW5kZWZpbmVkO1xuICAgIGxldCBzYW1wbGVPdXRGaWxlTmFtZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICBpZiAob3V0U3JjTWFwcGluZy5sZW5ndGgpIHtcbiAgICAgIHNhbXBsZVNyY0ZpbGVOYW1lID0gb3V0U3JjTWFwcGluZ1swXS5zb3VyY2VGaWxlLmZpbGVOYW1lO1xuICAgICAgc2FtcGxlT3V0RmlsZU5hbWUgPSBvdXRTcmNNYXBwaW5nWzBdLm91dEZpbGVOYW1lO1xuICAgIH1cbiAgICBjb25zdCBzcmNUb091dFBhdGggPVxuICAgICAgICBjcmVhdGVTcmNUb091dFBhdGhNYXBwZXIodGhpcy5vcHRpb25zLm91dERpciwgc2FtcGxlU3JjRmlsZU5hbWUsIHNhbXBsZU91dEZpbGVOYW1lKTtcbiAgICBpZiAoZW1pdEZsYWdzICYgRW1pdEZsYWdzLkNvZGVnZW4pIHtcbiAgICAgIGdlbkpzb25GaWxlcy5mb3JFYWNoKGdmID0+IHtcbiAgICAgICAgY29uc3Qgb3V0RmlsZU5hbWUgPSBzcmNUb091dFBhdGgoZ2YuZ2VuRmlsZVVybCk7XG4gICAgICAgIHRoaXMud3JpdGVGaWxlKG91dEZpbGVOYW1lLCBnZi5zb3VyY2UhLCBmYWxzZSwgdW5kZWZpbmVkLCBnZik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgbGV0IG1ldGFkYXRhSnNvbkNvdW50ID0gMDtcbiAgICBpZiAoZW1pdEZsYWdzICYgRW1pdEZsYWdzLk1ldGFkYXRhKSB7XG4gICAgICB0aGlzLnRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZvckVhY2goc2YgPT4ge1xuICAgICAgICBpZiAoIXNmLmlzRGVjbGFyYXRpb25GaWxlICYmICFHRU5FUkFURURfRklMRVMudGVzdChzZi5maWxlTmFtZSkpIHtcbiAgICAgICAgICBtZXRhZGF0YUpzb25Db3VudCsrO1xuICAgICAgICAgIGNvbnN0IG1ldGFkYXRhID0gdGhpcy5tZXRhZGF0YUNhY2hlLmdldE1ldGFkYXRhKHNmKTtcbiAgICAgICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgICAgIGNvbnN0IG1ldGFkYXRhVGV4dCA9IEpTT04uc3RyaW5naWZ5KFttZXRhZGF0YV0pO1xuICAgICAgICAgICAgY29uc3Qgb3V0RmlsZU5hbWUgPSBzcmNUb091dFBhdGgoc2YuZmlsZU5hbWUucmVwbGFjZSgvXFwudHN4PyQvLCAnLm1ldGFkYXRhLmpzb24nKSk7XG4gICAgICAgICAgICB0aGlzLndyaXRlRmlsZShvdXRGaWxlTmFtZSwgbWV0YWRhdGFUZXh0LCBmYWxzZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFtzZl0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGVtaXRFbmQgPSBEYXRlLm5vdygpO1xuICAgIGlmIChlbWl0UmVzdWx0ICYmIHRoaXMub3B0aW9ucy5kaWFnbm9zdGljcykge1xuICAgICAgZW1pdFJlc3VsdC5kaWFnbm9zdGljcyA9IGVtaXRSZXN1bHQuZGlhZ25vc3RpY3MuY29uY2F0KFtjcmVhdGVNZXNzYWdlRGlhZ25vc3RpYyhbXG4gICAgICAgIGBFbWl0dGVkIGluICR7ZW1pdEVuZCAtIGVtaXRTdGFydH1tc2AsXG4gICAgICAgIGAtICR7ZW1pdHRlZFVzZXJUc0NvdW50fSB1c2VyIHRzIGZpbGVzYCxcbiAgICAgICAgYC0gJHtnZW5Uc0ZpbGVzLmxlbmd0aH0gZ2VuZXJhdGVkIHRzIGZpbGVzYCxcbiAgICAgICAgYC0gJHtnZW5Kc29uRmlsZXMubGVuZ3RoICsgbWV0YWRhdGFKc29uQ291bnR9IGdlbmVyYXRlZCBqc29uIGZpbGVzYCxcbiAgICAgIF0uam9pbignXFxuJykpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVtaXRSZXN1bHQ7XG4gIH1cblxuICAvLyBQcml2YXRlIG1lbWJlcnNcbiAgcHJpdmF0ZSBnZXQgY29tcGlsZXIoKTogQW90Q29tcGlsZXIge1xuICAgIGlmICghdGhpcy5fY29tcGlsZXIpIHtcbiAgICAgIHRoaXMuX2NyZWF0ZUNvbXBpbGVyKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb21waWxlciE7XG4gIH1cblxuICBwcml2YXRlIGdldCBob3N0QWRhcHRlcigpOiBUc0NvbXBpbGVyQW90Q29tcGlsZXJUeXBlQ2hlY2tIb3N0QWRhcHRlciB7XG4gICAgaWYgKCF0aGlzLl9ob3N0QWRhcHRlcikge1xuICAgICAgdGhpcy5fY3JlYXRlQ29tcGlsZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2hvc3RBZGFwdGVyITtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IGFuYWx5emVkTW9kdWxlcygpOiBOZ0FuYWx5emVkTW9kdWxlcyB7XG4gICAgaWYgKCF0aGlzLl9hbmFseXplZE1vZHVsZXMpIHtcbiAgICAgIHRoaXMuaW5pdFN5bmMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2FuYWx5emVkTW9kdWxlcyE7XG4gIH1cblxuICBwcml2YXRlIGdldCBzdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKTogUmVhZG9ubHlBcnJheTxEaWFnbm9zdGljPiB7XG4gICAgbGV0IGRpYWdub3N0aWNzID0gdGhpcy5fc3RydWN0dXJhbERpYWdub3N0aWNzO1xuICAgIGlmICghZGlhZ25vc3RpY3MpIHtcbiAgICAgIHRoaXMuaW5pdFN5bmMoKTtcbiAgICAgIGRpYWdub3N0aWNzID0gKHRoaXMuX3N0cnVjdHVyYWxEaWFnbm9zdGljcyA9IHRoaXMuX3N0cnVjdHVyYWxEaWFnbm9zdGljcyB8fCBbXSk7XG4gICAgfVxuICAgIHJldHVybiBkaWFnbm9zdGljcztcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IHRzUHJvZ3JhbSgpOiB0cy5Qcm9ncmFtIHtcbiAgICBpZiAoIXRoaXMuX3RzUHJvZ3JhbSkge1xuICAgICAgdGhpcy5pbml0U3luYygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fdHNQcm9ncmFtITtcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIHRoZSBwcm9ncmFtIGlzIGNvbXBpbGluZyB0aGUgQW5ndWxhciBjb3JlIHBhY2thZ2UuICovXG4gIHByaXZhdGUgZ2V0IGlzQ29tcGlsaW5nQW5ndWxhckNvcmUoKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuX2lzQ29tcGlsaW5nQW5ndWxhckNvcmUgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pc0NvbXBpbGluZ0FuZ3VsYXJDb3JlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5faXNDb21waWxpbmdBbmd1bGFyQ29yZSA9IGlzQW5ndWxhckNvcmVQYWNrYWdlKHRoaXMudHNQcm9ncmFtKTtcbiAgfVxuICBwcml2YXRlIF9pc0NvbXBpbGluZ0FuZ3VsYXJDb3JlOiBib29sZWFufG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgY2FsY3VsYXRlVHJhbnNmb3JtcyhcbiAgICAgIGdlbkZpbGVzOiBNYXA8c3RyaW5nLCBHZW5lcmF0ZWRGaWxlPnx1bmRlZmluZWQsIHBhcnRpYWxNb2R1bGVzOiBQYXJ0aWFsTW9kdWxlW118dW5kZWZpbmVkLFxuICAgICAgY3VzdG9tVHJhbnNmb3JtZXJzPzogQ3VzdG9tVHJhbnNmb3JtZXJzKTogdHMuQ3VzdG9tVHJhbnNmb3JtZXJzIHtcbiAgICBjb25zdCBiZWZvcmVUczogQXJyYXk8dHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+PiA9IFtdO1xuICAgIGNvbnN0IG1ldGFkYXRhVHJhbnNmb3JtczogTWV0YWRhdGFUcmFuc2Zvcm1lcltdID0gW107XG4gICAgY29uc3QgZmxhdE1vZHVsZU1ldGFkYXRhVHJhbnNmb3JtczogTWV0YWRhdGFUcmFuc2Zvcm1lcltdID0gW107XG4gICAgY29uc3QgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0aGlzLm9wdGlvbnMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgfHwgZmFsc2U7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZVJlc291cmNlSW5saW5pbmcpIHtcbiAgICAgIGJlZm9yZVRzLnB1c2goZ2V0SW5saW5lUmVzb3VyY2VzVHJhbnNmb3JtRmFjdG9yeSh0aGlzLnRzUHJvZ3JhbSwgdGhpcy5ob3N0QWRhcHRlcikpO1xuICAgICAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgSW5saW5lUmVzb3VyY2VzTWV0YWRhdGFUcmFuc2Zvcm1lcih0aGlzLmhvc3RBZGFwdGVyKTtcbiAgICAgIG1ldGFkYXRhVHJhbnNmb3Jtcy5wdXNoKHRyYW5zZm9ybWVyKTtcbiAgICAgIGZsYXRNb2R1bGVNZXRhZGF0YVRyYW5zZm9ybXMucHVzaCh0cmFuc2Zvcm1lcik7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZykge1xuICAgICAgYmVmb3JlVHMucHVzaChcbiAgICAgICAgICBnZXRFeHByZXNzaW9uTG93ZXJpbmdUcmFuc2Zvcm1GYWN0b3J5KHRoaXMubG93ZXJpbmdNZXRhZGF0YVRyYW5zZm9ybSwgdGhpcy50c1Byb2dyYW0pKTtcbiAgICAgIG1ldGFkYXRhVHJhbnNmb3Jtcy5wdXNoKHRoaXMubG93ZXJpbmdNZXRhZGF0YVRyYW5zZm9ybSk7XG4gICAgfVxuICAgIGlmIChnZW5GaWxlcykge1xuICAgICAgYmVmb3JlVHMucHVzaChnZXRBbmd1bGFyRW1pdHRlclRyYW5zZm9ybUZhY3RvcnkoXG4gICAgICAgICAgZ2VuRmlsZXMsIHRoaXMuZ2V0VHNQcm9ncmFtKCksIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSk7XG4gICAgfVxuICAgIGlmIChwYXJ0aWFsTW9kdWxlcykge1xuICAgICAgYmVmb3JlVHMucHVzaChnZXRBbmd1bGFyQ2xhc3NUcmFuc2Zvcm1lckZhY3RvcnkocGFydGlhbE1vZHVsZXMsIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSk7XG5cbiAgICAgIC8vIElmIHdlIGhhdmUgcGFydGlhbCBtb2R1bGVzLCB0aGUgY2FjaGVkIG1ldGFkYXRhIG1pZ2h0IGJlIGluY29ycmVjdCBhcyBpdCBkb2Vzbid0IHJlZmxlY3RcbiAgICAgIC8vIHRoZSBwYXJ0aWFsIG1vZHVsZSB0cmFuc2Zvcm1zLlxuICAgICAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgUGFydGlhbE1vZHVsZU1ldGFkYXRhVHJhbnNmb3JtZXIocGFydGlhbE1vZHVsZXMpO1xuICAgICAgbWV0YWRhdGFUcmFuc2Zvcm1zLnB1c2godHJhbnNmb3JtZXIpO1xuICAgICAgZmxhdE1vZHVsZU1ldGFkYXRhVHJhbnNmb3Jtcy5wdXNoKHRyYW5zZm9ybWVyKTtcbiAgICB9XG5cbiAgICBpZiAoY3VzdG9tVHJhbnNmb3JtZXJzICYmIGN1c3RvbVRyYW5zZm9ybWVycy5iZWZvcmVUcykge1xuICAgICAgYmVmb3JlVHMucHVzaCguLi5jdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlVHMpO1xuICAgIH1cblxuICAgIC8vIElmIGRlY29yYXRvcnMgc2hvdWxkIGJlIGNvbnZlcnRlZCB0byBzdGF0aWMgZmllbGRzIChlbmFibGVkIGJ5IGRlZmF1bHQpLCB3ZSBzZXQgdXBcbiAgICAvLyB0aGUgZGVjb3JhdG9yIGRvd25sZXZlbCB0cmFuc2Zvcm0uIE5vdGUgdGhhdCB3ZSBzZXQgaXQgdXAgYXMgbGFzdCB0cmFuc2Zvcm0gYXMgdGhhdFxuICAgIC8vIGFsbG93cyBjdXN0b20gdHJhbnNmb3JtZXJzIHRvIHN0cmlwIEFuZ3VsYXIgZGVjb3JhdG9ycyB3aXRob3V0IGhhdmluZyB0byBkZWFsIHdpdGhcbiAgICAvLyBpZGVudGlmeWluZyBzdGF0aWMgcHJvcGVydGllcy4gZS5nLiBpdCdzIG1vcmUgZGlmZmljdWx0IGhhbmRsaW5nIGA8Li4+LmRlY29yYXRvcnNgXG4gICAgLy8gb3IgYDwuLj4uY3RvclBhcmFtZXRlcnNgIGNvbXBhcmVkIHRvIHRoZSBgdHMuRGVjb3JhdG9yYCBBU1Qgbm9kZXMuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hbm5vdGF0aW9uc0FzICE9PSAnZGVjb3JhdG9ycycpIHtcbiAgICAgIGNvbnN0IHR5cGVDaGVja2VyID0gdGhpcy5nZXRUc1Byb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpO1xuICAgICAgY29uc3QgcmVmbGVjdGlvbkhvc3QgPSBuZXcgVHlwZVNjcmlwdFJlZmxlY3Rpb25Ib3N0KHR5cGVDaGVja2VyKTtcbiAgICAgIC8vIFNpbWlsYXJseSB0byBob3cgd2UgaGFuZGxlZCB0c2lja2xlIGRlY29yYXRvciBkb3dubGV2ZWxpbmcgaW4gdGhlIHBhc3QsIHdlIGp1c3RcbiAgICAgIC8vIGlnbm9yZSBkaWFnbm9zdGljcyB0aGF0IGhhdmUgYmVlbiBjb2xsZWN0ZWQgYnkgdGhlIHRyYW5zZm9ybWVyLiBUaGVzZSBhcmVcbiAgICAgIC8vIG5vbi1zaWduaWZpY2FudCBmYWlsdXJlcyB0aGF0IHNob3VsZG4ndCBwcmV2ZW50IGFwcHMgZnJvbSBjb21waWxpbmcuXG4gICAgICBiZWZvcmVUcy5wdXNoKGdldERvd25sZXZlbERlY29yYXRvcnNUcmFuc2Zvcm0oXG4gICAgICAgICAgdHlwZUNoZWNrZXIsIHJlZmxlY3Rpb25Ib3N0LCBbXSwgdGhpcy5pc0NvbXBpbGluZ0FuZ3VsYXJDb3JlLCBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcixcbiAgICAgICAgICAvKiBza2lwQ2xhc3NEZWNvcmF0b3JzICovIGZhbHNlKSk7XG4gICAgfVxuXG4gICAgaWYgKG1ldGFkYXRhVHJhbnNmb3Jtcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLm1ldGFkYXRhQ2FjaGUgPSB0aGlzLmNyZWF0ZU1ldGFkYXRhQ2FjaGUobWV0YWRhdGFUcmFuc2Zvcm1zKTtcbiAgICB9XG4gICAgaWYgKGZsYXRNb2R1bGVNZXRhZGF0YVRyYW5zZm9ybXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5mbGF0TW9kdWxlTWV0YWRhdGFDYWNoZSA9IHRoaXMuY3JlYXRlTWV0YWRhdGFDYWNoZShmbGF0TW9kdWxlTWV0YWRhdGFUcmFuc2Zvcm1zKTtcbiAgICB9XG4gICAgY29uc3QgYWZ0ZXJUcyA9IGN1c3RvbVRyYW5zZm9ybWVycyA/IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlclRzIDogdW5kZWZpbmVkO1xuICAgIHJldHVybiB7YmVmb3JlOiBiZWZvcmVUcywgYWZ0ZXI6IGFmdGVyVHN9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0U3luYygpIHtcbiAgICBpZiAodGhpcy5fYW5hbHl6ZWRNb2R1bGVzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7dG1wUHJvZ3JhbSwgc291cmNlRmlsZXMsIHRzRmlsZXMsIHJvb3ROYW1lc30gPSB0aGlzLl9jcmVhdGVQcm9ncmFtV2l0aEJhc2ljU3R1YnMoKTtcbiAgICAgIGNvbnN0IHthbmFseXplZE1vZHVsZXMsIGFuYWx5emVkSW5qZWN0YWJsZXN9ID1cbiAgICAgICAgICB0aGlzLmNvbXBpbGVyLmxvYWRGaWxlc1N5bmMoc291cmNlRmlsZXMsIHRzRmlsZXMpO1xuICAgICAgdGhpcy5fdXBkYXRlUHJvZ3JhbVdpdGhUeXBlQ2hlY2tTdHVicyhcbiAgICAgICAgICB0bXBQcm9ncmFtLCBhbmFseXplZE1vZHVsZXMsIGFuYWx5emVkSW5qZWN0YWJsZXMsIHJvb3ROYW1lcyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fY3JlYXRlUHJvZ3JhbU9uRXJyb3IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlQ29tcGlsZXIoKSB7XG4gICAgY29uc3QgY29kZWdlbjogQ29kZUdlbmVyYXRvciA9IHtcbiAgICAgIGdlbmVyYXRlRmlsZTogKGdlbkZpbGVOYW1lLCBiYXNlRmlsZU5hbWUpID0+XG4gICAgICAgICAgdGhpcy5fY29tcGlsZXIuZW1pdEJhc2ljU3R1YihnZW5GaWxlTmFtZSwgYmFzZUZpbGVOYW1lKSxcbiAgICAgIGZpbmRHZW5lcmF0ZWRGaWxlTmFtZXM6IChmaWxlTmFtZSkgPT4gdGhpcy5fY29tcGlsZXIuZmluZEdlbmVyYXRlZEZpbGVOYW1lcyhmaWxlTmFtZSksXG4gICAgfTtcblxuICAgIHRoaXMuX2hvc3RBZGFwdGVyID0gbmV3IFRzQ29tcGlsZXJBb3RDb21waWxlclR5cGVDaGVja0hvc3RBZGFwdGVyKFxuICAgICAgICB0aGlzLnJvb3ROYW1lcywgdGhpcy5vcHRpb25zLCB0aGlzLmhvc3QsIHRoaXMubWV0YWRhdGFDYWNoZSwgY29kZWdlbixcbiAgICAgICAgdGhpcy5vbGRQcm9ncmFtTGlicmFyeVN1bW1hcmllcyk7XG4gICAgY29uc3QgYW90T3B0aW9ucyA9IGdldEFvdENvbXBpbGVyT3B0aW9ucyh0aGlzLm9wdGlvbnMpO1xuICAgIGNvbnN0IGVycm9yQ29sbGVjdG9yID0gKHRoaXMub3B0aW9ucy5jb2xsZWN0QWxsRXJyb3JzIHx8IHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spID9cbiAgICAgICAgKGVycjogYW55KSA9PiB0aGlzLl9hZGRTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoZXJyKSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICB0aGlzLl9jb21waWxlciA9IGNyZWF0ZUFvdENvbXBpbGVyKHRoaXMuX2hvc3RBZGFwdGVyLCBhb3RPcHRpb25zLCBlcnJvckNvbGxlY3RvcikuY29tcGlsZXI7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVQcm9ncmFtV2l0aEJhc2ljU3R1YnMoKToge1xuICAgIHRtcFByb2dyYW06IHRzLlByb2dyYW0sXG4gICAgcm9vdE5hbWVzOiBzdHJpbmdbXSxcbiAgICBzb3VyY2VGaWxlczogc3RyaW5nW10sXG4gICAgdHNGaWxlczogc3RyaW5nW10sXG4gIH0ge1xuICAgIGlmICh0aGlzLl9hbmFseXplZE1vZHVsZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgRXJyb3I6IGFscmVhZHkgaW5pdGlhbGl6ZWQhYCk7XG4gICAgfVxuICAgIC8vIE5vdGU6IFRoaXMgaXMgaW1wb3J0YW50IHRvIG5vdCBwcm9kdWNlIGEgbWVtb3J5IGxlYWshXG4gICAgY29uc3Qgb2xkVHNQcm9ncmFtID0gdGhpcy5vbGRUc1Byb2dyYW07XG4gICAgdGhpcy5vbGRUc1Byb2dyYW0gPSB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBjb2RlZ2VuOiBDb2RlR2VuZXJhdG9yID0ge1xuICAgICAgZ2VuZXJhdGVGaWxlOiAoZ2VuRmlsZU5hbWUsIGJhc2VGaWxlTmFtZSkgPT5cbiAgICAgICAgICB0aGlzLmNvbXBpbGVyLmVtaXRCYXNpY1N0dWIoZ2VuRmlsZU5hbWUsIGJhc2VGaWxlTmFtZSksXG4gICAgICBmaW5kR2VuZXJhdGVkRmlsZU5hbWVzOiAoZmlsZU5hbWUpID0+IHRoaXMuY29tcGlsZXIuZmluZEdlbmVyYXRlZEZpbGVOYW1lcyhmaWxlTmFtZSksXG4gICAgfTtcblxuXG4gICAgbGV0IHJvb3ROYW1lcyA9IFsuLi50aGlzLnJvb3ROYW1lc107XG4gICAgaWYgKHRoaXMub3B0aW9ucy5nZW5lcmF0ZUNvZGVGb3JMaWJyYXJpZXMgIT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiB3ZSBzaG91bGQgZ2VuZXJhdGVDb2RlRm9yTGlicmFyaWVzLCBuZXZlciBpbmNsdWRlXG4gICAgICAvLyBnZW5lcmF0ZWQgZmlsZXMgaW4gdGhlIHByb2dyYW0gYXMgb3RoZXJ3aXNlIHdlIHdpbGxcbiAgICAgIC8vIG92ZXJ3cml0ZSB0aGVtIGFuZCB0eXBlc2NyaXB0IHdpbGwgcmVwb3J0IHRoZSBlcnJvclxuICAgICAgLy8gVFM1MDU1OiBDYW5ub3Qgd3JpdGUgZmlsZSAuLi4gYmVjYXVzZSBpdCB3b3VsZCBvdmVyd3JpdGUgaW5wdXQgZmlsZS5cbiAgICAgIHJvb3ROYW1lcyA9IHJvb3ROYW1lcy5maWx0ZXIoZm4gPT4gIUdFTkVSQVRFRF9GSUxFUy50ZXN0KGZuKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMubm9SZXNvbHZlKSB7XG4gICAgICB0aGlzLnJvb3ROYW1lcy5mb3JFYWNoKHJvb3ROYW1lID0+IHtcbiAgICAgICAgaWYgKHRoaXMuaG9zdEFkYXB0ZXIuc2hvdWxkR2VuZXJhdGVGaWxlc0Zvcihyb290TmFtZSkpIHtcbiAgICAgICAgICByb290TmFtZXMucHVzaCguLi50aGlzLmNvbXBpbGVyLmZpbmRHZW5lcmF0ZWRGaWxlTmFtZXMocm9vdE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdG1wUHJvZ3JhbSA9IHRzLmNyZWF0ZVByb2dyYW0ocm9vdE5hbWVzLCB0aGlzLm9wdGlvbnMsIHRoaXMuaG9zdEFkYXB0ZXIsIG9sZFRzUHJvZ3JhbSk7XG4gICAgaWYgKHRlbXBQcm9ncmFtSGFuZGxlckZvclRlc3QgIT09IG51bGwpIHtcbiAgICAgIHRlbXBQcm9ncmFtSGFuZGxlckZvclRlc3QodG1wUHJvZ3JhbSk7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZUZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHRzRmlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgdG1wUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZvckVhY2goc2YgPT4ge1xuICAgICAgaWYgKHRoaXMuaG9zdEFkYXB0ZXIuaXNTb3VyY2VGaWxlKHNmLmZpbGVOYW1lKSkge1xuICAgICAgICBzb3VyY2VGaWxlcy5wdXNoKHNmLmZpbGVOYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmIChUUy50ZXN0KHNmLmZpbGVOYW1lKSAmJiAhRFRTLnRlc3Qoc2YuZmlsZU5hbWUpKSB7XG4gICAgICAgIHRzRmlsZXMucHVzaChzZi5maWxlTmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHt0bXBQcm9ncmFtLCBzb3VyY2VGaWxlcywgdHNGaWxlcywgcm9vdE5hbWVzfTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZVByb2dyYW1XaXRoVHlwZUNoZWNrU3R1YnMoXG4gICAgICB0bXBQcm9ncmFtOiB0cy5Qcm9ncmFtLCBhbmFseXplZE1vZHVsZXM6IE5nQW5hbHl6ZWRNb2R1bGVzLFxuICAgICAgYW5hbHl6ZWRJbmplY3RhYmxlczogTmdBbmFseXplZEZpbGVXaXRoSW5qZWN0YWJsZXNbXSwgcm9vdE5hbWVzOiBzdHJpbmdbXSkge1xuICAgIHRoaXMuX2FuYWx5emVkTW9kdWxlcyA9IGFuYWx5emVkTW9kdWxlcztcbiAgICB0aGlzLl9hbmFseXplZEluamVjdGFibGVzID0gYW5hbHl6ZWRJbmplY3RhYmxlcztcbiAgICB0bXBQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZm9yRWFjaChzZiA9PiB7XG4gICAgICBpZiAoc2YuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ2ZhY3RvcnkudHMnKSkge1xuICAgICAgICBjb25zdCB7Z2VuZXJhdGUsIGJhc2VGaWxlTmFtZX0gPSB0aGlzLmhvc3RBZGFwdGVyLnNob3VsZEdlbmVyYXRlRmlsZShzZi5maWxlTmFtZSk7XG4gICAgICAgIGlmIChnZW5lcmF0ZSkge1xuICAgICAgICAgIC8vIE5vdGU6ICEgaXMgb2sgYXMgaG9zdEFkYXB0ZXIuc2hvdWxkR2VuZXJhdGVGaWxlIHdpbGwgYWx3YXlzIHJldHVybiBhIGJhc2VGaWxlTmFtZVxuICAgICAgICAgIC8vIGZvciAubmdmYWN0b3J5LnRzIGZpbGVzLlxuICAgICAgICAgIGNvbnN0IGdlbkZpbGUgPSB0aGlzLmNvbXBpbGVyLmVtaXRUeXBlQ2hlY2tTdHViKHNmLmZpbGVOYW1lLCBiYXNlRmlsZU5hbWUhKTtcbiAgICAgICAgICBpZiAoZ2VuRmlsZSkge1xuICAgICAgICAgICAgdGhpcy5ob3N0QWRhcHRlci51cGRhdGVHZW5lcmF0ZWRGaWxlKGdlbkZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX3RzUHJvZ3JhbSA9IHRzLmNyZWF0ZVByb2dyYW0ocm9vdE5hbWVzLCB0aGlzLm9wdGlvbnMsIHRoaXMuaG9zdEFkYXB0ZXIsIHRtcFByb2dyYW0pO1xuICAgIC8vIE5vdGU6IHRoZSBuZXcgdHMgcHJvZ3JhbSBzaG91bGQgYmUgY29tcGxldGVseSByZXVzYWJsZSBieSBUeXBlU2NyaXB0IGFzOlxuICAgIC8vIC0gd2UgY2FjaGUgYWxsIHRoZSBmaWxlcyBpbiB0aGUgaG9zdEFkYXB0ZXJcbiAgICAvLyAtIG5ldyBuZXcgc3R1YnMgdXNlIHRoZSBleGFjdGx5IHNhbWUgaW1wb3J0cy9leHBvcnRzIGFzIHRoZSBvbGQgb25jZSAod2UgYXNzZXJ0IHRoYXQgaW5cbiAgICAvLyBob3N0QWRhcHRlci51cGRhdGVHZW5lcmF0ZWRGaWxlKS5cbiAgICBpZiAodHNTdHJ1Y3R1cmVJc1JldXNlZCh0aGlzLl90c1Byb2dyYW0pICE9PSBTdHJ1Y3R1cmVJc1JldXNlZC5Db21wbGV0ZWx5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIEVycm9yOiBUaGUgc3RydWN0dXJlIG9mIHRoZSBwcm9ncmFtIGNoYW5nZWQgZHVyaW5nIGNvZGVnZW4uYCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlUHJvZ3JhbU9uRXJyb3IoZTogYW55KSB7XG4gICAgLy8gU3RpbGwgZmlsbCB0aGUgYW5hbHl6ZWRNb2R1bGVzIGFuZCB0aGUgdHNQcm9ncmFtXG4gICAgLy8gc28gdGhhdCB3ZSBkb24ndCBjYXVzZSBvdGhlciBlcnJvcnMgZm9yIHVzZXJzIHdobyBlLmcuIHdhbnQgdG8gZW1pdCB0aGUgbmdQcm9ncmFtLlxuICAgIHRoaXMuX2FuYWx5emVkTW9kdWxlcyA9IGVtcHR5TW9kdWxlcztcbiAgICB0aGlzLm9sZFRzUHJvZ3JhbSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9ob3N0QWRhcHRlci5pc1NvdXJjZUZpbGUgPSAoKSA9PiBmYWxzZTtcbiAgICB0aGlzLl90c1Byb2dyYW0gPSB0cy5jcmVhdGVQcm9ncmFtKHRoaXMucm9vdE5hbWVzLCB0aGlzLm9wdGlvbnMsIHRoaXMuaG9zdEFkYXB0ZXIpO1xuICAgIGlmIChpc1N5bnRheEVycm9yKGUpKSB7XG4gICAgICB0aGlzLl9hZGRTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH1cblxuICBwcml2YXRlIF9hZGRTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoZXJyb3I6IEVycm9yKSB7XG4gICAgY29uc3QgZGlhZ25vc3RpY3MgPSB0aGlzLl9zdHJ1Y3R1cmFsRGlhZ25vc3RpY3MgfHwgKHRoaXMuX3N0cnVjdHVyYWxEaWFnbm9zdGljcyA9IFtdKTtcbiAgICBpZiAoaXNTeW50YXhFcnJvcihlcnJvcikpIHtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4uc3ludGF4RXJyb3JUb0RpYWdub3N0aWNzKGVycm9yLCB0aGlzLnRzUHJvZ3JhbSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKHtcbiAgICAgICAgbWVzc2FnZVRleHQ6IGVycm9yLnRvU3RyaW5nKCksXG4gICAgICAgIGNhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsXG4gICAgICAgIHNvdXJjZTogU09VUkNFLFxuICAgICAgICBjb2RlOiBERUZBVUxUX0VSUk9SX0NPREVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIE5vdGU6IHRoaXMgcmV0dXJucyBhIHRzLkRpYWdub3N0aWMgc28gdGhhdCB3ZVxuICAvLyBjYW4gcmV0dXJuIGVycm9ycyBpbiBhIHRzLkVtaXRSZXN1bHRcbiAgcHJpdmF0ZSBnZW5lcmF0ZUZpbGVzRm9yRW1pdChlbWl0RmxhZ3M6IEVtaXRGbGFncyk6XG4gICAgICB7Z2VuRmlsZXM6IEdlbmVyYXRlZEZpbGVbXSwgZ2VuRGlhZ3M6IHRzLkRpYWdub3N0aWNbXX0ge1xuICAgIHRyeSB7XG4gICAgICBpZiAoIShlbWl0RmxhZ3MgJiBFbWl0RmxhZ3MuQ29kZWdlbikpIHtcbiAgICAgICAgcmV0dXJuIHtnZW5GaWxlczogW10sIGdlbkRpYWdzOiBbXX07XG4gICAgICB9XG4gICAgICAvLyBUT0RPKHRib3NjaCk6IGFsbG93IGdlbmVyYXRpbmcgZmlsZXMgdGhhdCBhcmUgbm90IGluIHRoZSByb290RGlyXG4gICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMTkzMzdcbiAgICAgIGxldCBnZW5GaWxlcyA9IHRoaXMuY29tcGlsZXIuZW1pdEFsbEltcGxzKHRoaXMuYW5hbHl6ZWRNb2R1bGVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZ2VuRmlsZSA9PiBpc0luUm9vdERpcihnZW5GaWxlLmdlbkZpbGVVcmwsIHRoaXMub3B0aW9ucykpO1xuICAgICAgaWYgKHRoaXMub2xkUHJvZ3JhbUVtaXR0ZWRHZW5lcmF0ZWRGaWxlcykge1xuICAgICAgICBjb25zdCBvbGRQcm9ncmFtRW1pdHRlZEdlbmVyYXRlZEZpbGVzID0gdGhpcy5vbGRQcm9ncmFtRW1pdHRlZEdlbmVyYXRlZEZpbGVzO1xuICAgICAgICBnZW5GaWxlcyA9IGdlbkZpbGVzLmZpbHRlcihnZW5GaWxlID0+IHtcbiAgICAgICAgICBjb25zdCBvbGRHZW5GaWxlID0gb2xkUHJvZ3JhbUVtaXR0ZWRHZW5lcmF0ZWRGaWxlcy5nZXQoZ2VuRmlsZS5nZW5GaWxlVXJsKTtcbiAgICAgICAgICByZXR1cm4gIW9sZEdlbkZpbGUgfHwgIWdlbkZpbGUuaXNFcXVpdmFsZW50KG9sZEdlbkZpbGUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7Z2VuRmlsZXMsIGdlbkRpYWdzOiBbXX07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gVE9ETyh0Ym9zY2gpOiBjaGVjayB3aGV0aGVyIHdlIGNhbiBhY3R1YWxseSBoYXZlIHN5bnRheCBlcnJvcnMgaGVyZSxcbiAgICAgIC8vIGFzIHdlIGFscmVhZHkgcGFyc2VkIHRoZSBtZXRhZGF0YSBhbmQgdGVtcGxhdGVzIGJlZm9yZSB0byBjcmVhdGUgdGhlIHR5cGUgY2hlY2sgYmxvY2suXG4gICAgICBpZiAoaXNTeW50YXhFcnJvcihlKSkge1xuICAgICAgICBjb25zdCBnZW5EaWFnczogdHMuRGlhZ25vc3RpY1tdID0gW3tcbiAgICAgICAgICBmaWxlOiB1bmRlZmluZWQsXG4gICAgICAgICAgc3RhcnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICBsZW5ndGg6IHVuZGVmaW5lZCxcbiAgICAgICAgICBtZXNzYWdlVGV4dDogZS5tZXNzYWdlLFxuICAgICAgICAgIGNhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsXG4gICAgICAgICAgc291cmNlOiBTT1VSQ0UsXG4gICAgICAgICAgY29kZTogREVGQVVMVF9FUlJPUl9DT0RFXG4gICAgICAgIH1dO1xuICAgICAgICByZXR1cm4ge2dlbkZpbGVzOiBbXSwgZ2VuRGlhZ3N9O1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB1bmRlZmluZWQgaWYgYWxsIGZpbGVzIHNob3VsZCBiZSBlbWl0dGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRTb3VyY2VGaWxlc0ZvckVtaXQoKTogdHMuU291cmNlRmlsZVtdfHVuZGVmaW5lZCB7XG4gICAgLy8gVE9ETyh0Ym9zY2gpOiBpZiBvbmUgb2YgdGhlIGZpbGVzIGNvbnRhaW5zIGEgYGNvbnN0IGVudW1gXG4gICAgLy8gYWx3YXlzIGVtaXQgYWxsIGZpbGVzIC0+IHJldHVybiB1bmRlZmluZWQhXG4gICAgbGV0IHNvdXJjZUZpbGVzVG9FbWl0ID0gdGhpcy50c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoc2YgPT4ge1xuICAgICAgcmV0dXJuICFzZi5pc0RlY2xhcmF0aW9uRmlsZSAmJiAhR0VORVJBVEVEX0ZJTEVTLnRlc3Qoc2YuZmlsZU5hbWUpO1xuICAgIH0pO1xuICAgIGlmICh0aGlzLm9sZFByb2dyYW1FbWl0dGVkU291cmNlRmlsZXMpIHtcbiAgICAgIHNvdXJjZUZpbGVzVG9FbWl0ID0gc291cmNlRmlsZXNUb0VtaXQuZmlsdGVyKHNmID0+IHtcbiAgICAgICAgY29uc3Qgb2xkRmlsZSA9IHRoaXMub2xkUHJvZ3JhbUVtaXR0ZWRTb3VyY2VGaWxlcyEuZ2V0KHNmLmZpbGVOYW1lKTtcbiAgICAgICAgcmV0dXJuIHNmICE9PSBvbGRGaWxlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBzb3VyY2VGaWxlc1RvRW1pdDtcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVGaWxlKFxuICAgICAgb3V0RmlsZU5hbWU6IHN0cmluZywgb3V0RGF0YTogc3RyaW5nLCB3cml0ZUJ5dGVPcmRlck1hcms6IGJvb2xlYW4sXG4gICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgZ2VuRmlsZT86IEdlbmVyYXRlZEZpbGUsXG4gICAgICBzb3VyY2VGaWxlcz86IFJlYWRvbmx5QXJyYXk8dHMuU291cmNlRmlsZT4pIHtcbiAgICAvLyBjb2xsZWN0IGVtaXR0ZWRMaWJyYXJ5U3VtbWFyaWVzXG4gICAgbGV0IGJhc2VGaWxlOiB0cy5Tb3VyY2VGaWxlfHVuZGVmaW5lZDtcbiAgICBpZiAoZ2VuRmlsZSkge1xuICAgICAgYmFzZUZpbGUgPSB0aGlzLnRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGdlbkZpbGUuc3JjRmlsZVVybCk7XG4gICAgICBpZiAoYmFzZUZpbGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmVtaXR0ZWRMaWJyYXJ5U3VtbWFyaWVzKSB7XG4gICAgICAgICAgdGhpcy5lbWl0dGVkTGlicmFyeVN1bW1hcmllcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChnZW5GaWxlLmdlbkZpbGVVcmwuZW5kc1dpdGgoJy5uZ3N1bW1hcnkuanNvbicpICYmIGJhc2VGaWxlLmZpbGVOYW1lLmVuZHNXaXRoKCcuZC50cycpKSB7XG4gICAgICAgICAgdGhpcy5lbWl0dGVkTGlicmFyeVN1bW1hcmllcy5wdXNoKHtcbiAgICAgICAgICAgIGZpbGVOYW1lOiBiYXNlRmlsZS5maWxlTmFtZSxcbiAgICAgICAgICAgIHRleHQ6IGJhc2VGaWxlLnRleHQsXG4gICAgICAgICAgICBzb3VyY2VGaWxlOiBiYXNlRmlsZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLmVtaXR0ZWRMaWJyYXJ5U3VtbWFyaWVzLnB1c2goe2ZpbGVOYW1lOiBnZW5GaWxlLmdlbkZpbGVVcmwsIHRleHQ6IG91dERhdGF9KTtcbiAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5kZWNsYXJhdGlvbikge1xuICAgICAgICAgICAgLy8gSWYgd2UgZG9uJ3QgZW1pdCBkZWNsYXJhdGlvbnMsIHN0aWxsIHJlY29yZCBhbiBlbXB0eSAubmdmYWN0b3J5LmQudHMgZmlsZSxcbiAgICAgICAgICAgIC8vIGFzIHdlIG1pZ2h0IG5lZWQgaXQgbGF0ZXIgb24gZm9yIHJlc29sdmluZyBtb2R1bGUgbmFtZXMgZnJvbSBzdW1tYXJpZXMuXG4gICAgICAgICAgICBjb25zdCBuZ0ZhY3RvcnlEdHMgPVxuICAgICAgICAgICAgICAgIGdlbkZpbGUuZ2VuRmlsZVVybC5zdWJzdHJpbmcoMCwgZ2VuRmlsZS5nZW5GaWxlVXJsLmxlbmd0aCAtIDE1KSArICcubmdmYWN0b3J5LmQudHMnO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVkTGlicmFyeVN1bW1hcmllcy5wdXNoKHtmaWxlTmFtZTogbmdGYWN0b3J5RHRzLCB0ZXh0OiAnJ30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChvdXRGaWxlTmFtZS5lbmRzV2l0aCgnLmQudHMnKSAmJiBiYXNlRmlsZS5maWxlTmFtZS5lbmRzV2l0aCgnLmQudHMnKSkge1xuICAgICAgICAgIGNvbnN0IGR0c1NvdXJjZUZpbGVQYXRoID0gZ2VuRmlsZS5nZW5GaWxlVXJsLnJlcGxhY2UoL1xcLnRzJC8sICcuZC50cycpO1xuICAgICAgICAgIC8vIE5vdGU6IERvbid0IHVzZSBzb3VyY2VGaWxlcyBoZXJlIGFzIHRoZSBjcmVhdGVkIC5kLnRzIGhhcyBhIHBhdGggaW4gdGhlIG91dERpcixcbiAgICAgICAgICAvLyBidXQgd2UgbmVlZCBvbmUgdGhhdCBpcyBuZXh0IHRvIHRoZSAudHMgZmlsZVxuICAgICAgICAgIHRoaXMuZW1pdHRlZExpYnJhcnlTdW1tYXJpZXMucHVzaCh7ZmlsZU5hbWU6IGR0c1NvdXJjZUZpbGVQYXRoLCB0ZXh0OiBvdXREYXRhfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRmlsdGVyIG91dCBnZW5lcmF0ZWQgZmlsZXMgZm9yIHdoaWNoIHdlIGRpZG4ndCBnZW5lcmF0ZSBjb2RlLlxuICAgIC8vIFRoaXMgY2FuIGhhcHBlbiBhcyB0aGUgc3R1YiBjYWxjdWxhdGlvbiBpcyBub3QgY29tcGxldGVseSBleGFjdC5cbiAgICAvLyBOb3RlOiBzb3VyY2VGaWxlIHJlZmVycyB0byB0aGUgLm5nZmFjdG9yeS50cyAvIC5uZ3N1bW1hcnkudHMgZmlsZVxuICAgIC8vIG5vZGVfZW1pdHRlcl90cmFuc2Zvcm0gYWxyZWFkeSBzZXQgdGhlIGZpbGUgY29udGVudHMgdG8gYmUgZW1wdHksXG4gICAgLy8gIHNvIHRoaXMgY29kZSBvbmx5IG5lZWRzIHRvIHNraXAgdGhlIGZpbGUgaWYgIWFsbG93RW1wdHlDb2RlZ2VuRmlsZXMuXG4gICAgY29uc3QgaXNHZW5lcmF0ZWQgPSBHRU5FUkFURURfRklMRVMudGVzdChvdXRGaWxlTmFtZSk7XG4gICAgaWYgKGlzR2VuZXJhdGVkICYmICF0aGlzLm9wdGlvbnMuYWxsb3dFbXB0eUNvZGVnZW5GaWxlcyAmJlxuICAgICAgICAoIWdlbkZpbGUgfHwgIWdlbkZpbGUuc3RtdHMgfHwgZ2VuRmlsZS5zdG10cy5sZW5ndGggPT09IDApKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChiYXNlRmlsZSkge1xuICAgICAgc291cmNlRmlsZXMgPSBzb3VyY2VGaWxlcyA/IFsuLi5zb3VyY2VGaWxlcywgYmFzZUZpbGVdIDogW2Jhc2VGaWxlXTtcbiAgICB9XG4gICAgLy8gVE9ETzogcmVtb3ZlIGFueSB3aGVuIFRTIDIuNCBzdXBwb3J0IGlzIHJlbW92ZWQuXG4gICAgdGhpcy5ob3N0LndyaXRlRmlsZShvdXRGaWxlTmFtZSwgb3V0RGF0YSwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyBhcyBhbnkpO1xuICB9XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByb2dyYW0oe3Jvb3ROYW1lcywgb3B0aW9ucywgaG9zdCwgb2xkUHJvZ3JhbX06IHtcbiAgcm9vdE5hbWVzOiBSZWFkb25seUFycmF5PHN0cmluZz4sXG4gIG9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyxcbiAgaG9zdDogQ29tcGlsZXJIb3N0LFxuICBvbGRQcm9ncmFtPzogUHJvZ3JhbVxufSk6IFByb2dyYW0ge1xuICBpZiAob3B0aW9ucy5lbmFibGVJdnkgIT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIG5ldyBOZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBvcHRpb25zLCBob3N0LCBvbGRQcm9ncmFtIGFzIE5ndHNjUHJvZ3JhbSB8IHVuZGVmaW5lZCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBBbmd1bGFyQ29tcGlsZXJQcm9ncmFtKHJvb3ROYW1lcywgb3B0aW9ucywgaG9zdCwgb2xkUHJvZ3JhbSk7XG4gIH1cbn1cblxuLy8gQ29tcHV0ZSB0aGUgQW90Q29tcGlsZXIgb3B0aW9uc1xuZnVuY3Rpb24gZ2V0QW90Q29tcGlsZXJPcHRpb25zKG9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyk6IEFvdENvbXBpbGVyT3B0aW9ucyB7XG4gIGxldCBtaXNzaW5nVHJhbnNsYXRpb24gPSBjb3JlLk1pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5Lldhcm5pbmc7XG5cbiAgc3dpdGNoIChvcHRpb25zLmkxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMpIHtcbiAgICBjYXNlICdpZ25vcmUnOlxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uID0gY29yZS5NaXNzaW5nVHJhbnNsYXRpb25TdHJhdGVneS5JZ25vcmU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlcnJvcic6XG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb24gPSBjb3JlLk1pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5LkVycm9yO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBsZXQgdHJhbnNsYXRpb25zOiBzdHJpbmcgPSAnJztcblxuICBpZiAob3B0aW9ucy5pMThuSW5GaWxlKSB7XG4gICAgaWYgKCFvcHRpb25zLmkxOG5JbkxvY2FsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgdHJhbnNsYXRpb24gZmlsZSAoJHtvcHRpb25zLmkxOG5JbkZpbGV9KSBsb2NhbGUgbXVzdCBiZSBwcm92aWRlZC5gKTtcbiAgICB9XG4gICAgdHJhbnNsYXRpb25zID0gZnMucmVhZEZpbGVTeW5jKG9wdGlvbnMuaTE4bkluRmlsZSwgJ3V0ZjgnKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBObyB0cmFuc2xhdGlvbnMgYXJlIHByb3ZpZGVkLCBpZ25vcmUgYW55IGVycm9yc1xuICAgIC8vIFdlIHN0aWxsIGdvIHRocm91Z2ggaTE4biB0byByZW1vdmUgaTE4biBhdHRyaWJ1dGVzXG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uID0gY29yZS5NaXNzaW5nVHJhbnNsYXRpb25TdHJhdGVneS5JZ25vcmU7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGxvY2FsZTogb3B0aW9ucy5pMThuSW5Mb2NhbGUsXG4gICAgaTE4bkZvcm1hdDogb3B0aW9ucy5pMThuSW5Gb3JtYXQgfHwgb3B0aW9ucy5pMThuT3V0Rm9ybWF0LFxuICAgIGkxOG5Vc2VFeHRlcm5hbElkczogb3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHMsXG4gICAgdHJhbnNsYXRpb25zLFxuICAgIG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICBlbmFibGVTdW1tYXJpZXNGb3JKaXQ6IG9wdGlvbnMuZW5hYmxlU3VtbWFyaWVzRm9ySml0LFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IG9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICBmdWxsVGVtcGxhdGVUeXBlQ2hlY2s6IG9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrLFxuICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IG9wdGlvbnMuYWxsb3dFbXB0eUNvZGVnZW5GaWxlcyxcbiAgICBlbmFibGVJdnk6IG9wdGlvbnMuZW5hYmxlSXZ5LFxuICAgIGNyZWF0ZUV4dGVybmFsU3ltYm9sRmFjdG9yeVJlZXhwb3J0czogb3B0aW9ucy5jcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldE5nT3B0aW9uRGlhZ25vc3RpY3Mob3B0aW9uczogQ29tcGlsZXJPcHRpb25zKTogUmVhZG9ubHlBcnJheTxEaWFnbm9zdGljPiB7XG4gIGlmIChvcHRpb25zLmFubm90YXRpb25zQXMpIHtcbiAgICBzd2l0Y2ggKG9wdGlvbnMuYW5ub3RhdGlvbnNBcykge1xuICAgICAgY2FzZSAnZGVjb3JhdG9ycyc6XG4gICAgICBjYXNlICdzdGF0aWMgZmllbGRzJzpcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICBtZXNzYWdlVGV4dDpcbiAgICAgICAgICAgICAgJ0FuZ3VsYXIgY29tcGlsZXIgb3B0aW9ucyBcImFubm90YXRpb25zQXNcIiBvbmx5IHN1cHBvcnRzIFwic3RhdGljIGZpZWxkc1wiIGFuZCBcImRlY29yYXRvcnNcIicsXG4gICAgICAgICAgY2F0ZWdvcnk6IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcixcbiAgICAgICAgICBzb3VyY2U6IFNPVVJDRSxcbiAgICAgICAgICBjb2RlOiBERUZBVUxUX0VSUk9SX0NPREVcbiAgICAgICAgfV07XG4gICAgfVxuICB9XG4gIHJldHVybiBbXTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU2VwYXJhdG9ycyhwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgY2FuIGFkanVzdCBhIHBhdGggZnJvbSBzb3VyY2UgcGF0aCB0byBvdXQgcGF0aCxcbiAqIGJhc2VkIG9uIGFuIGV4aXN0aW5nIG1hcHBpbmcgZnJvbSBzb3VyY2UgdG8gb3V0IHBhdGguXG4gKlxuICogVE9ETyh0Ym9zY2gpOiB0YWxrIHRvIHRoZSBUeXBlU2NyaXB0IHRlYW0gdG8gZXhwb3NlIHRoZWlyIGxvZ2ljIGZvciBjYWxjdWxhdGluZyB0aGUgYHJvb3REaXJgXG4gKiBpZiBub25lIHdhcyBzcGVjaWZpZWQuXG4gKlxuICogTm90ZTogVGhpcyBmdW5jdGlvbiB3b3JrcyBvbiBub3JtYWxpemVkIHBhdGhzIGZyb20gdHlwZXNjcmlwdCBidXQgc2hvdWxkIGFsd2F5cyByZXR1cm5cbiAqIFBPU0lYIG5vcm1hbGl6ZWQgcGF0aHMgZm9yIG91dHB1dCBwYXRocy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNyY1RvT3V0UGF0aE1hcHBlcihcbiAgICBvdXREaXI6IHN0cmluZ3x1bmRlZmluZWQsIHNhbXBsZVNyY0ZpbGVOYW1lOiBzdHJpbmd8dW5kZWZpbmVkLFxuICAgIHNhbXBsZU91dEZpbGVOYW1lOiBzdHJpbmd8dW5kZWZpbmVkLCBob3N0OiB7XG4gICAgICBkaXJuYW1lOiB0eXBlb2YgcGF0aC5kaXJuYW1lLFxuICAgICAgcmVzb2x2ZTogdHlwZW9mIHBhdGgucmVzb2x2ZSxcbiAgICAgIHJlbGF0aXZlOiB0eXBlb2YgcGF0aC5yZWxhdGl2ZVxuICAgIH0gPSBwYXRoKTogKHNyY0ZpbGVOYW1lOiBzdHJpbmcpID0+IHN0cmluZyB7XG4gIGlmIChvdXREaXIpIHtcbiAgICBsZXQgcGF0aDoge30gPSB7fTsgIC8vIEVuc3VyZSB3ZSBlcnJvciBpZiB3ZSB1c2UgYHBhdGhgIGluc3RlYWQgb2YgYGhvc3RgLlxuICAgIGlmIChzYW1wbGVTcmNGaWxlTmFtZSA9PSBudWxsIHx8IHNhbXBsZU91dEZpbGVOYW1lID09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY2FsY3VsYXRlIHRoZSByb290RGlyIHdpdGhvdXQgYSBzYW1wbGUgc3JjRmlsZU5hbWUgLyBvdXRGaWxlTmFtZS4gYCk7XG4gICAgfVxuICAgIGNvbnN0IHNyY0ZpbGVEaXIgPSBub3JtYWxpemVTZXBhcmF0b3JzKGhvc3QuZGlybmFtZShzYW1wbGVTcmNGaWxlTmFtZSkpO1xuICAgIGNvbnN0IG91dEZpbGVEaXIgPSBub3JtYWxpemVTZXBhcmF0b3JzKGhvc3QuZGlybmFtZShzYW1wbGVPdXRGaWxlTmFtZSkpO1xuICAgIGlmIChzcmNGaWxlRGlyID09PSBvdXRGaWxlRGlyKSB7XG4gICAgICByZXR1cm4gKHNyY0ZpbGVOYW1lKSA9PiBzcmNGaWxlTmFtZTtcbiAgICB9XG4gICAgLy8gY2FsY3VsYXRlIHRoZSBjb21tb24gc3VmZml4LCBzdG9wcGluZ1xuICAgIC8vIGF0IGBvdXREaXJgLlxuICAgIGNvbnN0IHNyY0RpclBhcnRzID0gc3JjRmlsZURpci5zcGxpdCgnLycpO1xuICAgIGNvbnN0IG91dERpclBhcnRzID0gbm9ybWFsaXplU2VwYXJhdG9ycyhob3N0LnJlbGF0aXZlKG91dERpciwgb3V0RmlsZURpcikpLnNwbGl0KCcvJyk7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlIChpIDwgTWF0aC5taW4oc3JjRGlyUGFydHMubGVuZ3RoLCBvdXREaXJQYXJ0cy5sZW5ndGgpICYmXG4gICAgICAgICAgIHNyY0RpclBhcnRzW3NyY0RpclBhcnRzLmxlbmd0aCAtIDEgLSBpXSA9PT0gb3V0RGlyUGFydHNbb3V0RGlyUGFydHMubGVuZ3RoIC0gMSAtIGldKVxuICAgICAgaSsrO1xuICAgIGNvbnN0IHJvb3REaXIgPSBzcmNEaXJQYXJ0cy5zbGljZSgwLCBzcmNEaXJQYXJ0cy5sZW5ndGggLSBpKS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIChzcmNGaWxlTmFtZSkgPT4ge1xuICAgICAgLy8gTm90ZTogQmVmb3JlIHdlIHJldHVybiB0aGUgbWFwcGVkIG91dHB1dCBwYXRoLCB3ZSBuZWVkIHRvIG5vcm1hbGl6ZSB0aGUgcGF0aCBkZWxpbWl0ZXJzXG4gICAgICAvLyBiZWNhdXNlIHRoZSBvdXRwdXQgcGF0aCBpcyB1c3VhbGx5IHBhc3NlZCB0byBUeXBlU2NyaXB0IHdoaWNoIHNvbWV0aW1lcyBvbmx5IGV4cGVjdHNcbiAgICAgIC8vIHBvc2l4IG5vcm1hbGl6ZWQgcGF0aHMgKGUuZy4gaWYgYSBjdXN0b20gY29tcGlsZXIgaG9zdCBpcyB1c2VkKVxuICAgICAgcmV0dXJuIG5vcm1hbGl6ZVNlcGFyYXRvcnMoaG9zdC5yZXNvbHZlKG91dERpciwgaG9zdC5yZWxhdGl2ZShyb290RGlyLCBzcmNGaWxlTmFtZSkpKTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIC8vIE5vdGU6IEJlZm9yZSB3ZSByZXR1cm4gdGhlIG91dHB1dCBwYXRoLCB3ZSBuZWVkIHRvIG5vcm1hbGl6ZSB0aGUgcGF0aCBkZWxpbWl0ZXJzIGJlY2F1c2VcbiAgICAvLyB0aGUgb3V0cHV0IHBhdGggaXMgdXN1YWxseSBwYXNzZWQgdG8gVHlwZVNjcmlwdCB3aGljaCBvbmx5IHBhc3NlcyBhcm91bmQgcG9zaXhcbiAgICAvLyBub3JtYWxpemVkIHBhdGhzIChlLmcuIGlmIGEgY3VzdG9tIGNvbXBpbGVyIGhvc3QgaXMgdXNlZClcbiAgICByZXR1cm4gKHNyY0ZpbGVOYW1lKSA9PiBub3JtYWxpemVTZXBhcmF0b3JzKHNyY0ZpbGVOYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtZXJnZUVtaXRSZXN1bHRzKGVtaXRSZXN1bHRzOiB0cy5FbWl0UmVzdWx0W10pOiB0cy5FbWl0UmVzdWx0IHtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuICBsZXQgZW1pdFNraXBwZWQgPSBmYWxzZTtcbiAgY29uc3QgZW1pdHRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGVyIG9mIGVtaXRSZXN1bHRzKSB7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5lci5kaWFnbm9zdGljcyk7XG4gICAgZW1pdFNraXBwZWQgPSBlbWl0U2tpcHBlZCB8fCBlci5lbWl0U2tpcHBlZDtcbiAgICBlbWl0dGVkRmlsZXMucHVzaCguLi4oZXIuZW1pdHRlZEZpbGVzIHx8IFtdKSk7XG4gIH1cbiAgcmV0dXJuIHtkaWFnbm9zdGljcywgZW1pdFNraXBwZWQsIGVtaXR0ZWRGaWxlc307XG59XG5cbmZ1bmN0aW9uIGRpYWdub3N0aWNTb3VyY2VPZlNwYW4oc3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdHMuU291cmNlRmlsZSB7XG4gIC8vIEZvciBkaWFnbm9zdGljcywgVHlwZVNjcmlwdCBvbmx5IHVzZXMgdGhlIGZpbGVOYW1lIGFuZCB0ZXh0IHByb3BlcnRpZXMuXG4gIC8vIFRoZSByZWR1bmRhbnQgJygpJyBhcmUgaGVyZSBpcyB0byBhdm9pZCBoYXZpbmcgY2xhbmctZm9ybWF0IGJyZWFraW5nIHRoZSBsaW5lIGluY29ycmVjdGx5LlxuICByZXR1cm4gKHtmaWxlTmFtZTogc3Bhbi5zdGFydC5maWxlLnVybCwgdGV4dDogc3Bhbi5zdGFydC5maWxlLmNvbnRlbnR9IGFzIGFueSk7XG59XG5cbmZ1bmN0aW9uIGRpYWdub3N0aWNTb3VyY2VPZkZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcsIHByb2dyYW06IHRzLlByb2dyYW0pOiB0cy5Tb3VyY2VGaWxlIHtcbiAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlTmFtZSk7XG4gIGlmIChzb3VyY2VGaWxlKSByZXR1cm4gc291cmNlRmlsZTtcblxuICAvLyBJZiB3ZSBhcmUgcmVwb3J0aW5nIGRpYWdub3N0aWNzIGZvciBhIHNvdXJjZSBmaWxlIHRoYXQgaXMgbm90IGluIHRoZSBwcm9qZWN0IHRoZW4gd2UgbmVlZFxuICAvLyB0byBmYWtlIGEgc291cmNlIGZpbGUgc28gdGhlIGRpYWdub3N0aWMgZm9ybWF0dGluZyByb3V0aW5lcyBjYW4gZW1pdCB0aGUgZmlsZSBuYW1lLlxuICAvLyBUaGUgcmVkdW5kYW50ICcoKScgYXJlIGhlcmUgaXMgdG8gYXZvaWQgaGF2aW5nIGNsYW5nLWZvcm1hdCBicmVha2luZyB0aGUgbGluZSBpbmNvcnJlY3RseS5cbiAgcmV0dXJuICh7ZmlsZU5hbWUsIHRleHQ6ICcnfSBhcyBhbnkpO1xufVxuXG5cbmZ1bmN0aW9uIGRpYWdub3N0aWNDaGFpbkZyb21Gb3JtYXR0ZWREaWFnbm9zdGljQ2hhaW4oY2hhaW46IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbik6XG4gICAgRGlhZ25vc3RpY01lc3NhZ2VDaGFpbiB7XG4gIHJldHVybiB7XG4gICAgbWVzc2FnZVRleHQ6IGNoYWluLm1lc3NhZ2UsXG4gICAgbmV4dDogY2hhaW4ubmV4dCAmJiBjaGFpbi5uZXh0Lm1hcChkaWFnbm9zdGljQ2hhaW5Gcm9tRm9ybWF0dGVkRGlhZ25vc3RpY0NoYWluKSxcbiAgICBwb3NpdGlvbjogY2hhaW4ucG9zaXRpb25cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3ludGF4RXJyb3JUb0RpYWdub3N0aWNzKGVycm9yOiBFcnJvciwgcHJvZ3JhbTogdHMuUHJvZ3JhbSk6IERpYWdub3N0aWNbXSB7XG4gIGNvbnN0IHBhcnNlckVycm9ycyA9IGdldFBhcnNlRXJyb3JzKGVycm9yKTtcbiAgaWYgKHBhcnNlckVycm9ycyAmJiBwYXJzZXJFcnJvcnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHBhcnNlckVycm9ycy5tYXA8RGlhZ25vc3RpYz4oZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZVRleHQ6IGUuY29udGV4dHVhbE1lc3NhZ2UoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGU6IGRpYWdub3N0aWNTb3VyY2VPZlNwYW4oZS5zcGFuKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0OiBlLnNwYW4uc3RhcnQub2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVuZ3RoOiBlLnNwYW4uZW5kLm9mZnNldCAtIGUuc3Bhbi5zdGFydC5vZmZzZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiBTT1VSQ0UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBERUZBVUxUX0VSUk9SX0NPREVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gIH0gZWxzZSBpZiAoaXNGb3JtYXR0ZWRFcnJvcihlcnJvcikpIHtcbiAgICByZXR1cm4gW3tcbiAgICAgIG1lc3NhZ2VUZXh0OiBlcnJvci5tZXNzYWdlLFxuICAgICAgY2hhaW46IGVycm9yLmNoYWluICYmIGRpYWdub3N0aWNDaGFpbkZyb21Gb3JtYXR0ZWREaWFnbm9zdGljQ2hhaW4oZXJyb3IuY2hhaW4pLFxuICAgICAgY2F0ZWdvcnk6IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcixcbiAgICAgIHNvdXJjZTogU09VUkNFLFxuICAgICAgY29kZTogREVGQVVMVF9FUlJPUl9DT0RFLFxuICAgICAgcG9zaXRpb246IGVycm9yLnBvc2l0aW9uXG4gICAgfV07XG4gIH1cblxuICBjb25zdCBuZ01vZHVsZUVycm9yRGF0YSA9IGdldE1pc3NpbmdOZ01vZHVsZU1ldGFkYXRhRXJyb3JEYXRhKGVycm9yKTtcbiAgaWYgKG5nTW9kdWxlRXJyb3JEYXRhICE9PSBudWxsKSB7XG4gICAgLy8gVGhpcyBlcnJvciByZXByZXNlbnRzIHRoZSBpbXBvcnQgb3IgZXhwb3J0IG9mIGFuIGBOZ01vZHVsZWAgdGhhdCBkaWRuJ3QgaGF2ZSB2YWxpZCBtZXRhZGF0YS5cbiAgICAvLyBUaGlzIF9taWdodF8gaGFwcGVuIGJlY2F1c2UgdGhlIE5nTW9kdWxlIGluIHF1ZXN0aW9uIGlzIGFuIEl2eS1jb21waWxlZCBsaWJyYXJ5LCBhbmQgd2Ugd2FudFxuICAgIC8vIHRvIHNob3cgYSBtb3JlIHVzZWZ1bCBlcnJvciBpZiB0aGF0J3MgdGhlIGNhc2UuXG4gICAgY29uc3QgbmdNb2R1bGVDbGFzcyA9XG4gICAgICAgIGdldER0c0NsYXNzKHByb2dyYW0sIG5nTW9kdWxlRXJyb3JEYXRhLmZpbGVOYW1lLCBuZ01vZHVsZUVycm9yRGF0YS5jbGFzc05hbWUpO1xuICAgIGlmIChuZ01vZHVsZUNsYXNzICE9PSBudWxsICYmIGlzSXZ5TmdNb2R1bGUobmdNb2R1bGVDbGFzcykpIHtcbiAgICAgIHJldHVybiBbe1xuICAgICAgICBtZXNzYWdlVGV4dDogYFRoZSBOZ01vZHVsZSAnJHtuZ01vZHVsZUVycm9yRGF0YS5jbGFzc05hbWV9JyBpbiAnJHtcbiAgICAgICAgICAgIG5nTW9kdWxlRXJyb3JEYXRhXG4gICAgICAgICAgICAgICAgLmZpbGVOYW1lfScgaXMgaW1wb3J0ZWQgYnkgdGhpcyBjb21waWxhdGlvbiwgYnV0IGFwcGVhcnMgdG8gYmUgcGFydCBvZiBhIGxpYnJhcnkgY29tcGlsZWQgZm9yIEFuZ3VsYXIgSXZ5LiBUaGlzIG1heSBvY2N1ciBiZWNhdXNlOlxuXG4gIDEpIHRoZSBsaWJyYXJ5IHdhcyBwcm9jZXNzZWQgd2l0aCAnbmdjYycuIFJlbW92aW5nIGFuZCByZWluc3RhbGxpbmcgbm9kZV9tb2R1bGVzIG1heSBmaXggdGhpcyBwcm9ibGVtLlxuXG4gIDIpIHRoZSBsaWJyYXJ5IHdhcyBwdWJsaXNoZWQgZm9yIEFuZ3VsYXIgSXZ5IGFuZCB2MTIrIGFwcGxpY2F0aW9ucyBvbmx5LiBDaGVjayBpdHMgcGVlciBkZXBlbmRlbmNpZXMgY2FyZWZ1bGx5IGFuZCBlbnN1cmUgdGhhdCB5b3UncmUgdXNpbmcgYSBjb21wYXRpYmxlIHZlcnNpb24gb2YgQW5ndWxhci5cblxuU2VlIGh0dHBzOi8vYW5ndWxhci5pby9lcnJvcnMvTkc2OTk5IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuYCxcbiAgICAgICAgY2F0ZWdvcnk6IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcixcbiAgICAgICAgY29kZTogREVGQVVMVF9FUlJPUl9DT0RFLFxuICAgICAgICBzb3VyY2U6IFNPVVJDRSxcbiAgICAgIH1dO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByb2R1Y2UgYSBEaWFnbm9zdGljIGFueXdheSBzaW5jZSB3ZSBrbm93IGZvciBzdXJlIGBlcnJvcmAgaXMgYSBTeW50YXhFcnJvclxuICByZXR1cm4gW3tcbiAgICBtZXNzYWdlVGV4dDogZXJyb3IubWVzc2FnZSxcbiAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgIGNvZGU6IERFRkFVTFRfRVJST1JfQ09ERSxcbiAgICBzb3VyY2U6IFNPVVJDRSxcbiAgfV07XG59XG5cbmZ1bmN0aW9uIGdldER0c0NsYXNzKHByb2dyYW06IHRzLlByb2dyYW0sIGZpbGVOYW1lOiBzdHJpbmcsIGNsYXNzTmFtZTogc3RyaW5nKTogdHMuQ2xhc3NEZWNsYXJhdGlvbnxcbiAgICBudWxsIHtcbiAgY29uc3Qgc2YgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZU5hbWUpO1xuICBpZiAoc2YgPT09IHVuZGVmaW5lZCB8fCAhc2YuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBmb3IgKGNvbnN0IHN0bXQgb2Ygc2Yuc3RhdGVtZW50cykge1xuICAgIGlmICghdHMuaXNDbGFzc0RlY2xhcmF0aW9uKHN0bXQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHN0bXQubmFtZSA9PT0gdW5kZWZpbmVkIHx8IHN0bXQubmFtZS50ZXh0ICE9PSBjbGFzc05hbWUpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHJldHVybiBzdG10O1xuICB9XG5cbiAgLy8gTm8gY2xhc3NlcyBmb3VuZCB0aGF0IG1hdGNoZWQgdGhlIGdpdmVuIG5hbWUuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0l2eU5nTW9kdWxlKGNsYXp6OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gIGZvciAoY29uc3QgbWVtYmVyIG9mIGNsYXp6Lm1lbWJlcnMpIHtcbiAgICBpZiAoIXRzLmlzUHJvcGVydHlEZWNsYXJhdGlvbihtZW1iZXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHRzLmlzSWRlbnRpZmllcihtZW1iZXIubmFtZSkgJiYgbWVtYmVyLm5hbWUudGV4dCA9PT0gJ8m1bW9kJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgLy8gTm8gSXZ5ICfJtW1vZCcgcHJvcGVydHkgZm91bmQuXG4gIHJldHVybiBmYWxzZTtcbn1cbiJdfQ==