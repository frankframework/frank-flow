/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CssSelector, DomElementSchemaRegistry } from '@angular/compiler';
import { absoluteFrom, absoluteFromSourceFile, getSourceFileOrError } from '../../file_system';
import { Reference } from '../../imports';
import { PerfCheckpoint, PerfEvent, PerfPhase } from '../../perf';
import { UpdateMode } from '../../program_driver';
import { isNamedClassDeclaration } from '../../reflection';
import { isShim } from '../../shims';
import { getSourceFileOrNull, isSymbolWithValueDeclaration } from '../../util/src/typescript';
import { OptimizeFor } from '../api';
import { CompletionEngine } from './completion';
import { InliningMode, TypeCheckContextImpl } from './context';
import { shouldReportDiagnostic, translateDiagnostic } from './diagnostics';
import { TypeCheckShimGenerator } from './shim';
import { TemplateSourceManager } from './source';
import { findTypeCheckBlock, getTemplateMapping } from './tcb_util';
import { SymbolBuilder } from './template_symbol_builder';
const REGISTRY = new DomElementSchemaRegistry();
/**
 * Primary template type-checking engine, which performs type-checking using a
 * `TypeCheckingProgramStrategy` for type-checking program maintenance, and the
 * `ProgramTypeCheckAdapter` for generation of template type-checking code.
 */
export class TemplateTypeCheckerImpl {
    constructor(originalProgram, programDriver, typeCheckAdapter, config, refEmitter, reflector, compilerHost, priorBuild, componentScopeReader, typeCheckScopeRegistry, perf) {
        this.originalProgram = originalProgram;
        this.programDriver = programDriver;
        this.typeCheckAdapter = typeCheckAdapter;
        this.config = config;
        this.refEmitter = refEmitter;
        this.reflector = reflector;
        this.compilerHost = compilerHost;
        this.priorBuild = priorBuild;
        this.componentScopeReader = componentScopeReader;
        this.typeCheckScopeRegistry = typeCheckScopeRegistry;
        this.perf = perf;
        this.state = new Map();
        /**
         * Stores the `CompletionEngine` which powers autocompletion for each component class.
         *
         * Must be invalidated whenever the component's template or the `ts.Program` changes. Invalidation
         * on template changes is performed within this `TemplateTypeCheckerImpl` instance. When the
         * `ts.Program` changes, the `TemplateTypeCheckerImpl` as a whole is destroyed and replaced.
         */
        this.completionCache = new Map();
        /**
         * Stores the `SymbolBuilder` which creates symbols for each component class.
         *
         * Must be invalidated whenever the component's template or the `ts.Program` changes. Invalidation
         * on template changes is performed within this `TemplateTypeCheckerImpl` instance. When the
         * `ts.Program` changes, the `TemplateTypeCheckerImpl` as a whole is destroyed and replaced.
         */
        this.symbolBuilderCache = new Map();
        /**
         * Stores directives and pipes that are in scope for each component.
         *
         * Unlike other caches, the scope of a component is not affected by its template. It will be
         * destroyed when the `ts.Program` changes and the `TemplateTypeCheckerImpl` as a whole is
         * destroyed and replaced.
         */
        this.scopeCache = new Map();
        /**
         * Stores potential element tags for each component (a union of DOM tags as well as directive
         * tags).
         *
         * Unlike other caches, the scope of a component is not affected by its template. It will be
         * destroyed when the `ts.Program` changes and the `TemplateTypeCheckerImpl` as a whole is
         * destroyed and replaced.
         */
        this.elementTagCache = new Map();
        this.isComplete = false;
    }
    getTemplate(component) {
        const { data } = this.getLatestComponentState(component);
        if (data === null) {
            return null;
        }
        return data.template;
    }
    getLatestComponentState(component) {
        this.ensureShimForComponent(component);
        const sf = component.getSourceFile();
        const sfPath = absoluteFromSourceFile(sf);
        const shimPath = TypeCheckShimGenerator.shimFor(sfPath);
        const fileRecord = this.getFileData(sfPath);
        if (!fileRecord.shimData.has(shimPath)) {
            return { data: null, tcb: null, shimPath };
        }
        const templateId = fileRecord.sourceManager.getTemplateId(component);
        const shimRecord = fileRecord.shimData.get(shimPath);
        const id = fileRecord.sourceManager.getTemplateId(component);
        const program = this.programDriver.getProgram();
        const shimSf = getSourceFileOrNull(program, shimPath);
        if (shimSf === null || !fileRecord.shimData.has(shimPath)) {
            throw new Error(`Error: no shim file in program: ${shimPath}`);
        }
        let tcb = findTypeCheckBlock(shimSf, id, /*isDiagnosticsRequest*/ false);
        if (tcb === null) {
            // Try for an inline block.
            const inlineSf = getSourceFileOrError(program, sfPath);
            tcb = findTypeCheckBlock(inlineSf, id, /*isDiagnosticsRequest*/ false);
        }
        let data = null;
        if (shimRecord.templates.has(templateId)) {
            data = shimRecord.templates.get(templateId);
        }
        return { data, tcb, shimPath };
    }
    isTrackedTypeCheckFile(filePath) {
        return this.getFileAndShimRecordsForPath(filePath) !== null;
    }
    getFileAndShimRecordsForPath(shimPath) {
        for (const fileRecord of this.state.values()) {
            if (fileRecord.shimData.has(shimPath)) {
                return { fileRecord, shimRecord: fileRecord.shimData.get(shimPath) };
            }
        }
        return null;
    }
    getTemplateMappingAtShimLocation({ shimPath, positionInShimFile }) {
        const records = this.getFileAndShimRecordsForPath(absoluteFrom(shimPath));
        if (records === null) {
            return null;
        }
        const { fileRecord } = records;
        const shimSf = this.programDriver.getProgram().getSourceFile(absoluteFrom(shimPath));
        if (shimSf === undefined) {
            return null;
        }
        return getTemplateMapping(shimSf, positionInShimFile, fileRecord.sourceManager, /*isDiagnosticsRequest*/ false);
    }
    generateAllTypeCheckBlocks() {
        this.ensureAllShimsForAllFiles();
    }
    /**
     * Retrieve type-checking and template parse diagnostics from the given `ts.SourceFile` using the
     * most recent type-checking program.
     */
    getDiagnosticsForFile(sf, optimizeFor) {
        switch (optimizeFor) {
            case OptimizeFor.WholeProgram:
                this.ensureAllShimsForAllFiles();
                break;
            case OptimizeFor.SingleFile:
                this.ensureAllShimsForOneFile(sf);
                break;
        }
        return this.perf.inPhase(PerfPhase.TtcDiagnostics, () => {
            const sfPath = absoluteFromSourceFile(sf);
            const fileRecord = this.state.get(sfPath);
            const typeCheckProgram = this.programDriver.getProgram();
            const diagnostics = [];
            if (fileRecord.hasInlines) {
                const inlineSf = getSourceFileOrError(typeCheckProgram, sfPath);
                diagnostics.push(...typeCheckProgram.getSemanticDiagnostics(inlineSf).map(diag => convertDiagnostic(diag, fileRecord.sourceManager)));
            }
            for (const [shimPath, shimRecord] of fileRecord.shimData) {
                const shimSf = getSourceFileOrError(typeCheckProgram, shimPath);
                diagnostics.push(...typeCheckProgram.getSemanticDiagnostics(shimSf).map(diag => convertDiagnostic(diag, fileRecord.sourceManager)));
                diagnostics.push(...shimRecord.genesisDiagnostics);
                for (const templateData of shimRecord.templates.values()) {
                    diagnostics.push(...templateData.templateDiagnostics);
                }
            }
            return diagnostics.filter((diag) => diag !== null);
        });
    }
    getDiagnosticsForComponent(component) {
        this.ensureShimForComponent(component);
        return this.perf.inPhase(PerfPhase.TtcDiagnostics, () => {
            const sf = component.getSourceFile();
            const sfPath = absoluteFromSourceFile(sf);
            const shimPath = TypeCheckShimGenerator.shimFor(sfPath);
            const fileRecord = this.getFileData(sfPath);
            if (!fileRecord.shimData.has(shimPath)) {
                return [];
            }
            const templateId = fileRecord.sourceManager.getTemplateId(component);
            const shimRecord = fileRecord.shimData.get(shimPath);
            const typeCheckProgram = this.programDriver.getProgram();
            const diagnostics = [];
            if (shimRecord.hasInlines) {
                const inlineSf = getSourceFileOrError(typeCheckProgram, sfPath);
                diagnostics.push(...typeCheckProgram.getSemanticDiagnostics(inlineSf).map(diag => convertDiagnostic(diag, fileRecord.sourceManager)));
            }
            const shimSf = getSourceFileOrError(typeCheckProgram, shimPath);
            diagnostics.push(...typeCheckProgram.getSemanticDiagnostics(shimSf).map(diag => convertDiagnostic(diag, fileRecord.sourceManager)));
            diagnostics.push(...shimRecord.genesisDiagnostics);
            for (const templateData of shimRecord.templates.values()) {
                diagnostics.push(...templateData.templateDiagnostics);
            }
            return diagnostics.filter((diag) => diag !== null && diag.templateId === templateId);
        });
    }
    getTypeCheckBlock(component) {
        return this.getLatestComponentState(component).tcb;
    }
    getGlobalCompletions(context, component, node) {
        const engine = this.getOrCreateCompletionEngine(component);
        if (engine === null) {
            return null;
        }
        return this.perf.inPhase(PerfPhase.TtcAutocompletion, () => engine.getGlobalCompletions(context, node));
    }
    getExpressionCompletionLocation(ast, component) {
        const engine = this.getOrCreateCompletionEngine(component);
        if (engine === null) {
            return null;
        }
        return this.perf.inPhase(PerfPhase.TtcAutocompletion, () => engine.getExpressionCompletionLocation(ast));
    }
    invalidateClass(clazz) {
        this.completionCache.delete(clazz);
        this.symbolBuilderCache.delete(clazz);
        this.scopeCache.delete(clazz);
        this.elementTagCache.delete(clazz);
        const sf = clazz.getSourceFile();
        const sfPath = absoluteFromSourceFile(sf);
        const shimPath = TypeCheckShimGenerator.shimFor(sfPath);
        const fileData = this.getFileData(sfPath);
        const templateId = fileData.sourceManager.getTemplateId(clazz);
        fileData.shimData.delete(shimPath);
        fileData.isComplete = false;
        this.isComplete = false;
    }
    getOrCreateCompletionEngine(component) {
        if (this.completionCache.has(component)) {
            return this.completionCache.get(component);
        }
        const { tcb, data, shimPath } = this.getLatestComponentState(component);
        if (tcb === null || data === null) {
            return null;
        }
        const engine = new CompletionEngine(tcb, data, shimPath);
        this.completionCache.set(component, engine);
        return engine;
    }
    maybeAdoptPriorResultsForFile(sf) {
        const sfPath = absoluteFromSourceFile(sf);
        if (this.state.has(sfPath)) {
            const existingResults = this.state.get(sfPath);
            if (existingResults.isComplete) {
                // All data for this file has already been generated, so no need to adopt anything.
                return;
            }
        }
        const previousResults = this.priorBuild.priorTypeCheckingResultsFor(sf);
        if (previousResults === null || !previousResults.isComplete) {
            return;
        }
        this.perf.eventCount(PerfEvent.ReuseTypeCheckFile);
        this.state.set(sfPath, previousResults);
    }
    ensureAllShimsForAllFiles() {
        if (this.isComplete) {
            return;
        }
        this.perf.inPhase(PerfPhase.TcbGeneration, () => {
            const host = new WholeProgramTypeCheckingHost(this);
            const ctx = this.newContext(host);
            for (const sf of this.originalProgram.getSourceFiles()) {
                if (sf.isDeclarationFile || isShim(sf)) {
                    continue;
                }
                this.maybeAdoptPriorResultsForFile(sf);
                const sfPath = absoluteFromSourceFile(sf);
                const fileData = this.getFileData(sfPath);
                if (fileData.isComplete) {
                    continue;
                }
                this.typeCheckAdapter.typeCheck(sf, ctx);
                fileData.isComplete = true;
            }
            this.updateFromContext(ctx);
            this.isComplete = true;
        });
    }
    ensureAllShimsForOneFile(sf) {
        this.perf.inPhase(PerfPhase.TcbGeneration, () => {
            this.maybeAdoptPriorResultsForFile(sf);
            const sfPath = absoluteFromSourceFile(sf);
            const fileData = this.getFileData(sfPath);
            if (fileData.isComplete) {
                // All data for this file is present and accounted for already.
                return;
            }
            const host = new SingleFileTypeCheckingHost(sfPath, fileData, this);
            const ctx = this.newContext(host);
            this.typeCheckAdapter.typeCheck(sf, ctx);
            fileData.isComplete = true;
            this.updateFromContext(ctx);
        });
    }
    ensureShimForComponent(component) {
        const sf = component.getSourceFile();
        const sfPath = absoluteFromSourceFile(sf);
        const shimPath = TypeCheckShimGenerator.shimFor(sfPath);
        this.maybeAdoptPriorResultsForFile(sf);
        const fileData = this.getFileData(sfPath);
        if (fileData.shimData.has(shimPath)) {
            // All data for this component is available.
            return;
        }
        const host = new SingleShimTypeCheckingHost(sfPath, fileData, this, shimPath);
        const ctx = this.newContext(host);
        this.typeCheckAdapter.typeCheck(sf, ctx);
        this.updateFromContext(ctx);
    }
    newContext(host) {
        const inlining = this.programDriver.supportsInlineOperations ? InliningMode.InlineOps : InliningMode.Error;
        return new TypeCheckContextImpl(this.config, this.compilerHost, this.refEmitter, this.reflector, host, inlining, this.perf);
    }
    /**
     * Remove any shim data that depends on inline operations applied to the type-checking program.
     *
     * This can be useful if new inlines need to be applied, and it's not possible to guarantee that
     * they won't overwrite or corrupt existing inlines that are used by such shims.
     */
    clearAllShimDataUsingInlines() {
        for (const fileData of this.state.values()) {
            if (!fileData.hasInlines) {
                continue;
            }
            for (const [shimFile, shimData] of fileData.shimData.entries()) {
                if (shimData.hasInlines) {
                    fileData.shimData.delete(shimFile);
                }
            }
            fileData.hasInlines = false;
            fileData.isComplete = false;
            this.isComplete = false;
        }
    }
    updateFromContext(ctx) {
        const updates = ctx.finalize();
        return this.perf.inPhase(PerfPhase.TcbUpdateProgram, () => {
            if (updates.size > 0) {
                this.perf.eventCount(PerfEvent.UpdateTypeCheckProgram);
            }
            this.programDriver.updateFiles(updates, UpdateMode.Incremental);
            this.priorBuild.recordSuccessfulTypeCheck(this.state);
            this.perf.memory(PerfCheckpoint.TtcUpdateProgram);
        });
    }
    getFileData(path) {
        if (!this.state.has(path)) {
            this.state.set(path, {
                hasInlines: false,
                sourceManager: new TemplateSourceManager(),
                isComplete: false,
                shimData: new Map(),
            });
        }
        return this.state.get(path);
    }
    getSymbolOfNode(node, component) {
        const builder = this.getOrCreateSymbolBuilder(component);
        if (builder === null) {
            return null;
        }
        return this.perf.inPhase(PerfPhase.TtcSymbol, () => builder.getSymbol(node));
    }
    getOrCreateSymbolBuilder(component) {
        if (this.symbolBuilderCache.has(component)) {
            return this.symbolBuilderCache.get(component);
        }
        const { tcb, data, shimPath } = this.getLatestComponentState(component);
        if (tcb === null || data === null) {
            return null;
        }
        const builder = new SymbolBuilder(shimPath, tcb, data, this.componentScopeReader, () => this.programDriver.getProgram().getTypeChecker());
        this.symbolBuilderCache.set(component, builder);
        return builder;
    }
    getDirectivesInScope(component) {
        const data = this.getScopeData(component);
        if (data === null) {
            return null;
        }
        return data.directives;
    }
    getPipesInScope(component) {
        const data = this.getScopeData(component);
        if (data === null) {
            return null;
        }
        return data.pipes;
    }
    getDirectiveMetadata(dir) {
        if (!isNamedClassDeclaration(dir)) {
            return null;
        }
        return this.typeCheckScopeRegistry.getTypeCheckDirectiveMetadata(new Reference(dir));
    }
    getPotentialElementTags(component) {
        if (this.elementTagCache.has(component)) {
            return this.elementTagCache.get(component);
        }
        const tagMap = new Map();
        for (const tag of REGISTRY.allKnownElementNames()) {
            tagMap.set(tag, null);
        }
        const scope = this.getScopeData(component);
        if (scope !== null) {
            for (const directive of scope.directives) {
                for (const selector of CssSelector.parse(directive.selector)) {
                    if (selector.element === null || tagMap.has(selector.element)) {
                        // Skip this directive if it doesn't match an element tag, or if another directive has
                        // already been included with the same element name.
                        continue;
                    }
                    tagMap.set(selector.element, directive);
                }
            }
        }
        this.elementTagCache.set(component, tagMap);
        return tagMap;
    }
    getPotentialDomBindings(tagName) {
        const attributes = REGISTRY.allKnownAttributesOfElement(tagName);
        return attributes.map(attribute => ({
            attribute,
            property: REGISTRY.getMappedPropName(attribute),
        }));
    }
    getScopeData(component) {
        if (this.scopeCache.has(component)) {
            return this.scopeCache.get(component);
        }
        if (!isNamedClassDeclaration(component)) {
            throw new Error(`AssertionError: components must have names`);
        }
        const scope = this.componentScopeReader.getScopeForComponent(component);
        if (scope === null) {
            return null;
        }
        const data = {
            directives: [],
            pipes: [],
            isPoisoned: scope.compilation.isPoisoned,
        };
        const typeChecker = this.programDriver.getProgram().getTypeChecker();
        for (const dir of scope.compilation.directives) {
            if (dir.selector === null) {
                // Skip this directive, it can't be added to a template anyway.
                continue;
            }
            const tsSymbol = typeChecker.getSymbolAtLocation(dir.ref.node.name);
            if (!isSymbolWithValueDeclaration(tsSymbol)) {
                continue;
            }
            let ngModule = null;
            const moduleScopeOfDir = this.componentScopeReader.getScopeForComponent(dir.ref.node);
            if (moduleScopeOfDir !== null) {
                ngModule = moduleScopeOfDir.ngModule;
            }
            data.directives.push({
                isComponent: dir.isComponent,
                isStructural: dir.isStructural,
                selector: dir.selector,
                tsSymbol,
                ngModule,
            });
        }
        for (const pipe of scope.compilation.pipes) {
            const tsSymbol = typeChecker.getSymbolAtLocation(pipe.ref.node.name);
            if (tsSymbol === undefined) {
                continue;
            }
            data.pipes.push({
                name: pipe.name,
                tsSymbol,
            });
        }
        this.scopeCache.set(component, data);
        return data;
    }
}
function convertDiagnostic(diag, sourceResolver) {
    if (!shouldReportDiagnostic(diag)) {
        return null;
    }
    return translateDiagnostic(diag, sourceResolver);
}
/**
 * Drives a `TypeCheckContext` to generate type-checking code for every component in the program.
 */
class WholeProgramTypeCheckingHost {
    constructor(impl) {
        this.impl = impl;
    }
    getSourceManager(sfPath) {
        return this.impl.getFileData(sfPath).sourceManager;
    }
    shouldCheckComponent(node) {
        const sfPath = absoluteFromSourceFile(node.getSourceFile());
        const shimPath = TypeCheckShimGenerator.shimFor(sfPath);
        const fileData = this.impl.getFileData(sfPath);
        // The component needs to be checked unless the shim which would contain it already exists.
        return !fileData.shimData.has(shimPath);
    }
    recordShimData(sfPath, data) {
        const fileData = this.impl.getFileData(sfPath);
        fileData.shimData.set(data.path, data);
        if (data.hasInlines) {
            fileData.hasInlines = true;
        }
    }
    recordComplete(sfPath) {
        this.impl.getFileData(sfPath).isComplete = true;
    }
}
/**
 * Drives a `TypeCheckContext` to generate type-checking code efficiently for a single input file.
 */
class SingleFileTypeCheckingHost {
    constructor(sfPath, fileData, impl) {
        this.sfPath = sfPath;
        this.fileData = fileData;
        this.impl = impl;
        this.seenInlines = false;
    }
    assertPath(sfPath) {
        if (this.sfPath !== sfPath) {
            throw new Error(`AssertionError: querying TypeCheckingHost outside of assigned file`);
        }
    }
    getSourceManager(sfPath) {
        this.assertPath(sfPath);
        return this.fileData.sourceManager;
    }
    shouldCheckComponent(node) {
        if (this.sfPath !== absoluteFromSourceFile(node.getSourceFile())) {
            return false;
        }
        const shimPath = TypeCheckShimGenerator.shimFor(this.sfPath);
        // Only need to generate a TCB for the class if no shim exists for it currently.
        return !this.fileData.shimData.has(shimPath);
    }
    recordShimData(sfPath, data) {
        this.assertPath(sfPath);
        // Previous type-checking state may have required the use of inlines (assuming they were
        // supported). If the current operation also requires inlines, this presents a problem:
        // generating new inlines may invalidate any old inlines that old state depends on.
        //
        // Rather than resolve this issue by tracking specific dependencies on inlines, if the new state
        // relies on inlines, any old state that relied on them is simply cleared. This happens when the
        // first new state that uses inlines is encountered.
        if (data.hasInlines && !this.seenInlines) {
            this.impl.clearAllShimDataUsingInlines();
            this.seenInlines = true;
        }
        this.fileData.shimData.set(data.path, data);
        if (data.hasInlines) {
            this.fileData.hasInlines = true;
        }
    }
    recordComplete(sfPath) {
        this.assertPath(sfPath);
        this.fileData.isComplete = true;
    }
}
/**
 * Drives a `TypeCheckContext` to generate type-checking code efficiently for only those components
 * which map to a single shim of a single input file.
 */
class SingleShimTypeCheckingHost extends SingleFileTypeCheckingHost {
    constructor(sfPath, fileData, impl, shimPath) {
        super(sfPath, fileData, impl);
        this.shimPath = shimPath;
    }
    shouldCheckNode(node) {
        if (this.sfPath !== absoluteFromSourceFile(node.getSourceFile())) {
            return false;
        }
        // Only generate a TCB for the component if it maps to the requested shim file.
        const shimPath = TypeCheckShimGenerator.shimFor(this.sfPath);
        if (shimPath !== this.shimPath) {
            return false;
        }
        // Only need to generate a TCB for the class if no shim exists for it currently.
        return !this.fileData.shimData.has(shimPath);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9jaGVja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBTSxXQUFXLEVBQUUsd0JBQXdCLEVBQXlLLE1BQU0sbUJBQW1CLENBQUM7QUFHclAsT0FBTyxFQUFDLFlBQVksRUFBRSxzQkFBc0IsRUFBa0Isb0JBQW9CLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RyxPQUFPLEVBQUMsU0FBUyxFQUFtQixNQUFNLGVBQWUsQ0FBQztBQUUxRCxPQUFPLEVBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQWUsTUFBTSxZQUFZLENBQUM7QUFDOUUsT0FBTyxFQUFnQixVQUFVLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUMvRCxPQUFPLEVBQW1CLHVCQUF1QixFQUFpQixNQUFNLGtCQUFrQixDQUFDO0FBRTNGLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLG1CQUFtQixFQUFFLDRCQUE0QixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDNUYsT0FBTyxFQUF5RSxXQUFXLEVBQThKLE1BQU0sUUFBUSxDQUFDO0FBR3hRLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUM5QyxPQUFPLEVBQUMsWUFBWSxFQUFzQyxvQkFBb0IsRUFBbUIsTUFBTSxXQUFXLENBQUM7QUFDbkgsT0FBTyxFQUFDLHNCQUFzQixFQUFFLG1CQUFtQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFFLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUM5QyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDL0MsT0FBTyxFQUFDLGtC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LENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNuQixJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7U0FDakM7SUFDSCxDQUFDO0lBRUQsY0FBYyxDQUFDLE1BQXNCO1FBQ25DLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQUVEOzs7R0FHRztBQUNILE1BQU0sMEJBQTJCLFNBQVEsMEJBQTBCO0lBQ2pFLFlBQ0ksTUFBc0IsRUFBRSxRQUE4QixFQUFFLElBQTZCLEVBQzdFLFFBQXdCO1FBQ2xDLEtBQUssQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRHBCLGFBQVEsR0FBUixRQUFRLENBQWdCO0lBRXBDLENBQUM7SUFFRCxlQUFlLENBQUMsSUFBeUI7UUFDdkMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLHNCQUFzQixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxFQUFFO1lBQ2hFLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCwrRUFBK0U7UUFDL0UsTUFBTSxRQUFRLEdBQUcsc0JBQXNCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3RCxJQUFJLFFBQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQzlCLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxnRkFBZ0Y7UUFDaEYsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1QsIENzc1NlbGVjdG9yLCBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnksIE1ldGhvZENhbGwsIFBhcnNlRXJyb3IsIHBhcnNlVGVtcGxhdGUsIFByb3BlcnR5UmVhZCwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWQsIFRtcGxBc3RFbGVtZW50LCBUbXBsQXN0Tm9kZSwgVG1wbEFzdFJlZmVyZW5jZSwgVG1wbEFzdFRlbXBsYXRlLCBUbXBsQXN0VmFyaWFibGV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbSwgYWJzb2x1dGVGcm9tU291cmNlRmlsZSwgQWJzb2x1dGVGc1BhdGgsIGdldFNvdXJjZUZpbGVPckVycm9yfSBmcm9tICcuLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge1JlZmVyZW5jZSwgUmVmZXJlbmNlRW1pdHRlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0luY3JlbWVudGFsQnVpbGR9IGZyb20gJy4uLy4uL2luY3JlbWVudGFsL2FwaSc7XG5pbXBvcnQge1BlcmZDaGVja3BvaW50LCBQZXJmRXZlbnQsIFBlcmZQaGFzZSwgUGVyZlJlY29yZGVyfSBmcm9tICcuLi8uLi9wZXJmJztcbmltcG9ydCB7UHJvZ3JhbURyaXZlciwgVXBkYXRlTW9kZX0gZnJvbSAnLi4vLi4vcHJvZ3JhbV9kcml2ZXInO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbiwgUmVmbGVjdGlvbkhvc3R9IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtDb21wb25lbnRTY29wZVJlYWRlciwgVHlwZUNoZWNrU2NvcGVSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtpc1NoaW19IGZyb20gJy4uLy4uL3NoaW1zJztcbmltcG9ydCB7Z2V0U291cmNlRmlsZU9yTnVsbCwgaXNTeW1ib2xXaXRoVmFsdWVEZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0RpcmVjdGl2ZUluU2NvcGUsIEVsZW1lbnRTeW1ib2wsIEZ1bGxUZW1wbGF0ZU1hcHBpbmcsIEdsb2JhbENvbXBsZXRpb24sIE9wdGltaXplRm9yLCBQaXBlSW5TY29wZSwgUHJvZ3JhbVR5cGVDaGVja0FkYXB0ZXIsIFNoaW1Mb2NhdGlvbiwgU3ltYm9sLCBUZW1wbGF0ZUlkLCBUZW1wbGF0ZVN5bWJvbCwgVGVtcGxhdGVUeXBlQ2hlY2tlciwgVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEsIFR5cGVDaGVja2luZ0NvbmZpZ30gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7VGVtcGxhdGVEaWFnbm9zdGljfSBmcm9tICcuLi9kaWFnbm9zdGljcyc7XG5cbmltcG9ydCB7Q29tcGxldGlvbkVuZ2luZX0gZnJvbSAnLi9jb21wbGV0aW9uJztcbmltcG9ydCB7SW5saW5pbmdNb2RlLCBTaGltVHlwZUNoZWNraW5nRGF0YSwgVGVtcGxhdGVEYXRhLCBUeXBlQ2hlY2tDb250ZXh0SW1wbCwgVHlwZUNoZWNraW5nSG9zdH0gZnJvbSAnLi9jb250ZXh0JztcbmltcG9ydCB7c2hvdWxkUmVwb3J0RGlhZ25vc3RpYywgdHJhbnNsYXRlRGlhZ25vc3RpY30gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge1R5cGVDaGVja1NoaW1HZW5lcmF0b3J9IGZyb20gJy4vc2hpbSc7XG5pbXBvcnQge1RlbXBsYXRlU291cmNlTWFuYWdlcn0gZnJvbSAnLi9zb3VyY2UnO1xuaW1wb3J0IHtmaW5kVHlwZUNoZWNrQmxvY2ssIGdldFRlbXBsYXRlTWFwcGluZywgVGVtcGxhdGVTb3VyY2VSZXNvbHZlcn0gZnJvbSAnLi90Y2JfdXRpbCc7XG5pbXBvcnQge1N5bWJvbEJ1aWxkZXJ9IGZyb20gJy4vdGVtcGxhdGVfc3ltYm9sX2J1aWxkZXInO1xuXG5cbmNvbnN0IFJFR0lTVFJZID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuLyoqXG4gKiBQcmltYXJ5IHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgZW5naW5lLCB3aGljaCBwZXJmb3JtcyB0eXBlLWNoZWNraW5nIHVzaW5nIGFcbiAqIGBUeXBlQ2hlY2tpbmdQcm9ncmFtU3RyYXRlZ3lgIGZvciB0eXBlLWNoZWNraW5nIHByb2dyYW0gbWFpbnRlbmFuY2UsIGFuZCB0aGVcbiAqIGBQcm9ncmFtVHlwZUNoZWNrQWRhcHRlcmAgZm9yIGdlbmVyYXRpb24gb2YgdGVtcGxhdGUgdHlwZS1jaGVja2luZyBjb2RlLlxuICovXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVUeXBlQ2hlY2tlckltcGwgaW1wbGVtZW50cyBUZW1wbGF0ZVR5cGVDaGVja2VyIHtcbiAgcHJpdmF0ZSBzdGF0ZSA9IG5ldyBNYXA8QWJzb2x1dGVGc1BhdGgsIEZpbGVUeXBlQ2hlY2tpbmdEYXRhPigpO1xuXG4gIC8qKlxuICAgKiBTdG9yZXMgdGhlIGBDb21wbGV0aW9uRW5naW5lYCB3aGljaCBwb3dlcnMgYXV0b2NvbXBsZXRpb24gZm9yIGVhY2ggY29tcG9uZW50IGNsYXNzLlxuICAgKlxuICAgKiBNdXN0IGJlIGludmFsaWRhdGVkIHdoZW5ldmVyIHRoZSBjb21wb25lbnQncyB0ZW1wbGF0ZSBvciB0aGUgYHRzLlByb2dyYW1gIGNoYW5nZXMuIEludmFsaWRhdGlvblxuICAgKiBvbiB0ZW1wbGF0ZSBjaGFuZ2VzIGlzIHBlcmZvcm1lZCB3aXRoaW4gdGhpcyBgVGVtcGxhdGVUeXBlQ2hlY2tlckltcGxgIGluc3RhbmNlLiBXaGVuIHRoZVxuICAgKiBgdHMuUHJvZ3JhbWAgY2hhbmdlcywgdGhlIGBUZW1wbGF0ZVR5cGVDaGVja2VySW1wbGAgYXMgYSB3aG9sZSBpcyBkZXN0cm95ZWQgYW5kIHJlcGxhY2VkLlxuICAgKi9cbiAgcHJpdmF0ZSBjb21wbGV0aW9uQ2FjaGUgPSBuZXcgTWFwPHRzLkNsYXNzRGVjbGFyYXRpb24sIENvbXBsZXRpb25FbmdpbmU+KCk7XG4gIC8qKlxuICAgKiBTdG9yZXMgdGhlIGBTeW1ib2xCdWlsZGVyYCB3aGljaCBjcmVhdGVzIHN5bWJvbHMgZm9yIGVhY2ggY29tcG9uZW50IGNsYXNzLlxuICAgKlxuICAgKiBNdXN0IGJlIGludmFsaWRhdGVkIHdoZW5ldmVyIHRoZSBjb21wb25lbnQncyB0ZW1wbGF0ZSBvciB0aGUgYHRzLlByb2dyYW1gIGNoYW5nZXMuIEludmFsaWRhdGlvblxuICAgKiBvbiB0ZW1wbGF0ZSBjaGFuZ2VzIGlzIHBlcmZvcm1lZCB3aXRoaW4gdGhpcyBgVGVtcGxhdGVUeXBlQ2hlY2tlckltcGxgIGluc3RhbmNlLiBXaGVuIHRoZVxuICAgKiBgdHMuUHJvZ3JhbWAgY2hhbmdlcywgdGhlIGBUZW1wbGF0ZVR5cGVDaGVja2VySW1wbGAgYXMgYSB3aG9sZSBpcyBkZXN0cm95ZWQgYW5kIHJlcGxhY2VkLlxuICAgKi9cbiAgcHJpdmF0ZSBzeW1ib2xCdWlsZGVyQ2FjaGUgPSBuZXcgTWFwPHRzLkNsYXNzRGVjbGFyYXRpb24sIFN5bWJvbEJ1aWxkZXI+KCk7XG5cbiAgLyoqXG4gICAqIFN0b3JlcyBkaXJlY3RpdmVzIGFuZCBwaXBlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3IgZWFjaCBjb21wb25lbnQuXG4gICAqXG4gICAqIFVubGlrZSBvdGhlciBjYWNoZXMsIHRoZSBzY29wZSBvZiBhIGNvbXBvbmVudCBpcyBub3QgYWZmZWN0ZWQgYnkgaXRzIHRlbXBsYXRlLiBJdCB3aWxsIGJlXG4gICAqIGRlc3Ryb3llZCB3aGVuIHRoZSBgdHMuUHJvZ3JhbWAgY2hhbmdlcyBhbmQgdGhlIGBUZW1wbGF0ZVR5cGVDaGVja2VySW1wbGAgYXMgYSB3aG9sZSBpc1xuICAgKiBkZXN0cm95ZWQgYW5kIHJlcGxhY2VkLlxuICAgKi9cbiAgcHJpdmF0ZSBzY29wZUNhY2hlID0gbmV3IE1hcDx0cy5DbGFzc0RlY2xhcmF0aW9uLCBTY29wZURhdGE+KCk7XG5cbiAgLyoqXG4gICAqIFN0b3JlcyBwb3RlbnRpYWwgZWxlbWVudCB0YWdzIGZvciBlYWNoIGNvbXBvbmVudCAoYSB1bmlvbiBvZiBET00gdGFncyBhcyB3ZWxsIGFzIGRpcmVjdGl2ZVxuICAgKiB0YWdzKS5cbiAgICpcbiAgICogVW5saWtlIG90aGVyIGNhY2hlcywgdGhlIHNjb3BlIG9mIGEgY29tcG9uZW50IGlzIG5vdCBhZmZlY3RlZCBieSBpdHMgdGVtcGxhdGUuIEl0IHdpbGwgYmVcbiAgICogZGVzdHJveWVkIHdoZW4gdGhlIGB0cy5Qcm9ncmFtYCBjaGFuZ2VzIGFuZCB0aGUgYFRlbXBsYXRlVHlwZUNoZWNrZXJJbXBsYCBhcyBhIHdob2xlIGlzXG4gICAqIGRlc3Ryb3llZCBhbmQgcmVwbGFjZWQuXG4gICAqL1xuICBwcml2YXRlIGVsZW1lbnRUYWdDYWNoZSA9IG5ldyBNYXA8dHMuQ2xhc3NEZWNsYXJhdGlvbiwgTWFwPHN0cmluZywgRGlyZWN0aXZlSW5TY29wZXxudWxsPj4oKTtcblxuICBwcml2YXRlIGlzQ29tcGxldGUgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgb3JpZ2luYWxQcm9ncmFtOiB0cy5Qcm9ncmFtLCByZWFkb25seSBwcm9ncmFtRHJpdmVyOiBQcm9ncmFtRHJpdmVyLFxuICAgICAgcHJpdmF0ZSB0eXBlQ2hlY2tBZGFwdGVyOiBQcm9ncmFtVHlwZUNoZWNrQWRhcHRlciwgcHJpdmF0ZSBjb25maWc6IFR5cGVDaGVja2luZ0NvbmZpZyxcbiAgICAgIHByaXZhdGUgcmVmRW1pdHRlcjogUmVmZXJlbmNlRW1pdHRlciwgcHJpdmF0ZSByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgICAgcHJpdmF0ZSBjb21waWxlckhvc3Q6IFBpY2s8dHMuQ29tcGlsZXJIb3N0LCAnZ2V0Q2Fub25pY2FsRmlsZU5hbWUnPixcbiAgICAgIHByaXZhdGUgcHJpb3JCdWlsZDogSW5jcmVtZW50YWxCdWlsZDx1bmtub3duLCBGaWxlVHlwZUNoZWNraW5nRGF0YT4sXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IGNvbXBvbmVudFNjb3BlUmVhZGVyOiBDb21wb25lbnRTY29wZVJlYWRlcixcbiAgICAgIHByaXZhdGUgcmVhZG9ubHkgdHlwZUNoZWNrU2NvcGVSZWdpc3RyeTogVHlwZUNoZWNrU2NvcGVSZWdpc3RyeSxcbiAgICAgIHByaXZhdGUgcmVhZG9ubHkgcGVyZjogUGVyZlJlY29yZGVyKSB7fVxuXG4gIGdldFRlbXBsYXRlKGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IFRtcGxBc3ROb2RlW118bnVsbCB7XG4gICAgY29uc3Qge2RhdGF9ID0gdGhpcy5nZXRMYXRlc3RDb21wb25lbnRTdGF0ZShjb21wb25lbnQpO1xuICAgIGlmIChkYXRhID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGEudGVtcGxhdGU7XG4gIH1cblxuICBwcml2YXRlIGdldExhdGVzdENvbXBvbmVudFN0YXRlKGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6XG4gICAgICB7ZGF0YTogVGVtcGxhdGVEYXRhfG51bGwsIHRjYjogdHMuTm9kZXxudWxsLCBzaGltUGF0aDogQWJzb2x1dGVGc1BhdGh9IHtcbiAgICB0aGlzLmVuc3VyZVNoaW1Gb3JDb21wb25lbnQoY29tcG9uZW50KTtcblxuICAgIGNvbnN0IHNmID0gY29tcG9uZW50LmdldFNvdXJjZUZpbGUoKTtcbiAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcbiAgICBjb25zdCBzaGltUGF0aCA9IFR5cGVDaGVja1NoaW1HZW5lcmF0b3Iuc2hpbUZvcihzZlBhdGgpO1xuXG4gICAgY29uc3QgZmlsZVJlY29yZCA9IHRoaXMuZ2V0RmlsZURhdGEoc2ZQYXRoKTtcblxuICAgIGlmICghZmlsZVJlY29yZC5zaGltRGF0YS5oYXMoc2hpbVBhdGgpKSB7XG4gICAgICByZXR1cm4ge2RhdGE6IG51bGwsIHRjYjogbnVsbCwgc2hpbVBhdGh9O1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlSWQgPSBmaWxlUmVjb3JkLnNvdXJjZU1hbmFnZXIuZ2V0VGVtcGxhdGVJZChjb21wb25lbnQpO1xuICAgIGNvbnN0IHNoaW1SZWNvcmQgPSBmaWxlUmVjb3JkLnNoaW1EYXRhLmdldChzaGltUGF0aCkhO1xuICAgIGNvbnN0IGlkID0gZmlsZVJlY29yZC5zb3VyY2VNYW5hZ2VyLmdldFRlbXBsYXRlSWQoY29tcG9uZW50KTtcblxuICAgIGNvbnN0IHByb2dyYW0gPSB0aGlzLnByb2dyYW1Ecml2ZXIuZ2V0UHJvZ3JhbSgpO1xuICAgIGNvbnN0IHNoaW1TZiA9IGdldFNvdXJjZUZpbGVPck51bGwocHJvZ3JhbSwgc2hpbVBhdGgpO1xuXG4gICAgaWYgKHNoaW1TZiA9PT0gbnVsbCB8fCAhZmlsZVJlY29yZC5zaGltRGF0YS5oYXMoc2hpbVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yOiBubyBzaGltIGZpbGUgaW4gcHJvZ3JhbTogJHtzaGltUGF0aH1gKTtcbiAgICB9XG5cbiAgICBsZXQgdGNiOiB0cy5Ob2RlfG51bGwgPSBmaW5kVHlwZUNoZWNrQmxvY2soc2hpbVNmLCBpZCwgLyppc0RpYWdub3N0aWNzUmVxdWVzdCovIGZhbHNlKTtcblxuICAgIGlmICh0Y2IgPT09IG51bGwpIHtcbiAgICAgIC8vIFRyeSBmb3IgYW4gaW5saW5lIGJsb2NrLlxuICAgICAgY29uc3QgaW5saW5lU2YgPSBnZXRTb3VyY2VGaWxlT3JFcnJvcihwcm9ncmFtLCBzZlBhdGgpO1xuICAgICAgdGNiID0gZmluZFR5cGVDaGVja0Jsb2NrKGlubGluZVNmLCBpZCwgLyppc0RpYWdub3N0aWNzUmVxdWVzdCovIGZhbHNlKTtcbiAgICB9XG5cbiAgICBsZXQgZGF0YTogVGVtcGxhdGVEYXRhfG51bGwgPSBudWxsO1xuICAgIGlmIChzaGltUmVjb3JkLnRlbXBsYXRlcy5oYXModGVtcGxhdGVJZCkpIHtcbiAgICAgIGRhdGEgPSBzaGltUmVjb3JkLnRlbXBsYXRlcy5nZXQodGVtcGxhdGVJZCkhO1xuICAgIH1cblxuICAgIHJldHVybiB7ZGF0YSwgdGNiLCBzaGltUGF0aH07XG4gIH1cblxuICBpc1RyYWNrZWRUeXBlQ2hlY2tGaWxlKGZpbGVQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmdldEZpbGVBbmRTaGltUmVjb3Jkc0ZvclBhdGgoZmlsZVBhdGgpICE9PSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRGaWxlQW5kU2hpbVJlY29yZHNGb3JQYXRoKHNoaW1QYXRoOiBBYnNvbHV0ZUZzUGF0aCk6XG4gICAgICB7ZmlsZVJlY29yZDogRmlsZVR5cGVDaGVja2luZ0RhdGEsIHNoaW1SZWNvcmQ6IFNoaW1UeXBlQ2hlY2tpbmdEYXRhfXxudWxsIHtcbiAgICBmb3IgKGNvbnN0IGZpbGVSZWNvcmQgb2YgdGhpcy5zdGF0ZS52YWx1ZXMoKSkge1xuICAgICAgaWYgKGZpbGVSZWNvcmQuc2hpbURhdGEuaGFzKHNoaW1QYXRoKSkge1xuICAgICAgICByZXR1cm4ge2ZpbGVSZWNvcmQsIHNoaW1SZWNvcmQ6IGZpbGVSZWNvcmQuc2hpbURhdGEuZ2V0KHNoaW1QYXRoKSF9O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldFRlbXBsYXRlTWFwcGluZ0F0U2hpbUxvY2F0aW9uKHtzaGltUGF0aCwgcG9zaXRpb25JblNoaW1GaWxlfTogU2hpbUxvY2F0aW9uKTpcbiAgICAgIEZ1bGxUZW1wbGF0ZU1hcHBpbmd8bnVsbCB7XG4gICAgY29uc3QgcmVjb3JkcyA9IHRoaXMuZ2V0RmlsZUFuZFNoaW1SZWNvcmRzRm9yUGF0aChhYnNvbHV0ZUZyb20oc2hpbVBhdGgpKTtcbiAgICBpZiAocmVjb3JkcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHtmaWxlUmVjb3JkfSA9IHJlY29yZHM7XG5cbiAgICBjb25zdCBzaGltU2YgPSB0aGlzLnByb2dyYW1Ecml2ZXIuZ2V0UHJvZ3JhbSgpLmdldFNvdXJjZUZpbGUoYWJzb2x1dGVGcm9tKHNoaW1QYXRoKSk7XG4gICAgaWYgKHNoaW1TZiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGdldFRlbXBsYXRlTWFwcGluZyhcbiAgICAgICAgc2hpbVNmLCBwb3NpdGlvbkluU2hpbUZpbGUsIGZpbGVSZWNvcmQuc291cmNlTWFuYWdlciwgLyppc0RpYWdub3N0aWNzUmVxdWVzdCovIGZhbHNlKTtcbiAgfVxuXG4gIGdlbmVyYXRlQWxsVHlwZUNoZWNrQmxvY2tzKCkge1xuICAgIHRoaXMuZW5zdXJlQWxsU2hpbXNGb3JBbGxGaWxlcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHR5cGUtY2hlY2tpbmcgYW5kIHRlbXBsYXRlIHBhcnNlIGRpYWdub3N0aWNzIGZyb20gdGhlIGdpdmVuIGB0cy5Tb3VyY2VGaWxlYCB1c2luZyB0aGVcbiAgICogbW9zdCByZWNlbnQgdHlwZS1jaGVja2luZyBwcm9ncmFtLlxuICAgKi9cbiAgZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNmOiB0cy5Tb3VyY2VGaWxlLCBvcHRpbWl6ZUZvcjogT3B0aW1pemVGb3IpOiB0cy5EaWFnbm9zdGljW10ge1xuICAgIHN3aXRjaCAob3B0aW1pemVGb3IpIHtcbiAgICAgIGNhc2UgT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtOlxuICAgICAgICB0aGlzLmVuc3VyZUFsbFNoaW1zRm9yQWxsRmlsZXMoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIE9wdGltaXplRm9yLlNpbmdsZUZpbGU6XG4gICAgICAgIHRoaXMuZW5zdXJlQWxsU2hpbXNGb3JPbmVGaWxlKHNmKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucGVyZi5pblBoYXNlKFBlcmZQaGFzZS5UdGNEaWFnbm9zdGljcywgKCkgPT4ge1xuICAgICAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG4gICAgICBjb25zdCBmaWxlUmVjb3JkID0gdGhpcy5zdGF0ZS5nZXQoc2ZQYXRoKSE7XG5cbiAgICAgIGNvbnN0IHR5cGVDaGVja1Byb2dyYW0gPSB0aGlzLnByb2dyYW1Ecml2ZXIuZ2V0UHJvZ3JhbSgpO1xuXG4gICAgICBjb25zdCBkaWFnbm9zdGljczogKHRzLkRpYWdub3N0aWN8bnVsbClbXSA9IFtdO1xuICAgICAgaWYgKGZpbGVSZWNvcmQuaGFzSW5saW5lcykge1xuICAgICAgICBjb25zdCBpbmxpbmVTZiA9IGdldFNvdXJjZUZpbGVPckVycm9yKHR5cGVDaGVja1Byb2dyYW0sIHNmUGF0aCk7XG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHlwZUNoZWNrUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKGlubGluZVNmKS5tYXAoXG4gICAgICAgICAgICBkaWFnID0+IGNvbnZlcnREaWFnbm9zdGljKGRpYWcsIGZpbGVSZWNvcmQuc291cmNlTWFuYWdlcikpKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBbc2hpbVBhdGgsIHNoaW1SZWNvcmRdIG9mIGZpbGVSZWNvcmQuc2hpbURhdGEpIHtcbiAgICAgICAgY29uc3Qgc2hpbVNmID0gZ2V0U291cmNlRmlsZU9yRXJyb3IodHlwZUNoZWNrUHJvZ3JhbSwgc2hpbVBhdGgpO1xuICAgICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnR5cGVDaGVja1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzaGltU2YpLm1hcChcbiAgICAgICAgICAgIGRpYWcgPT4gY29udmVydERpYWdub3N0aWMoZGlhZywgZmlsZVJlY29yZC5zb3VyY2VNYW5hZ2VyKSkpO1xuICAgICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnNoaW1SZWNvcmQuZ2VuZXNpc0RpYWdub3N0aWNzKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHRlbXBsYXRlRGF0YSBvZiBzaGltUmVjb3JkLnRlbXBsYXRlcy52YWx1ZXMoKSkge1xuICAgICAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlhZ25vc3RpY3MpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaWFnbm9zdGljcy5maWx0ZXIoKGRpYWc6IHRzLkRpYWdub3N0aWN8bnVsbCk6IGRpYWcgaXMgdHMuRGlhZ25vc3RpYyA9PiBkaWFnICE9PSBudWxsKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldERpYWdub3N0aWNzRm9yQ29tcG9uZW50KGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IHRzLkRpYWdub3N0aWNbXSB7XG4gICAgdGhpcy5lbnN1cmVTaGltRm9yQ29tcG9uZW50KGNvbXBvbmVudCk7XG5cbiAgICByZXR1cm4gdGhpcy5wZXJmLmluUGhhc2UoUGVyZlBoYXNlLlR0Y0RpYWdub3N0aWNzLCAoKSA9PiB7XG4gICAgICBjb25zdCBzZiA9IGNvbXBvbmVudC5nZXRTb3VyY2VGaWxlKCk7XG4gICAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcbiAgICAgIGNvbnN0IHNoaW1QYXRoID0gVHlwZUNoZWNrU2hpbUdlbmVyYXRvci5zaGltRm9yKHNmUGF0aCk7XG5cbiAgICAgIGNvbnN0IGZpbGVSZWNvcmQgPSB0aGlzLmdldEZpbGVEYXRhKHNmUGF0aCk7XG5cbiAgICAgIGlmICghZmlsZVJlY29yZC5zaGltRGF0YS5oYXMoc2hpbVBhdGgpKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGVtcGxhdGVJZCA9IGZpbGVSZWNvcmQuc291cmNlTWFuYWdlci5nZXRUZW1wbGF0ZUlkKGNvbXBvbmVudCk7XG4gICAgICBjb25zdCBzaGltUmVjb3JkID0gZmlsZVJlY29yZC5zaGltRGF0YS5nZXQoc2hpbVBhdGgpITtcblxuICAgICAgY29uc3QgdHlwZUNoZWNrUHJvZ3JhbSA9IHRoaXMucHJvZ3JhbURyaXZlci5nZXRQcm9ncmFtKCk7XG5cbiAgICAgIGNvbnN0IGRpYWdub3N0aWNzOiAoVGVtcGxhdGVEaWFnbm9zdGljfG51bGwpW10gPSBbXTtcbiAgICAgIGlmIChzaGltUmVjb3JkLmhhc0lubGluZXMpIHtcbiAgICAgICAgY29uc3QgaW5saW5lU2YgPSBnZXRTb3VyY2VGaWxlT3JFcnJvcih0eXBlQ2hlY2tQcm9ncmFtLCBzZlBhdGgpO1xuICAgICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnR5cGVDaGVja1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhpbmxpbmVTZikubWFwKFxuICAgICAgICAgICAgZGlhZyA9PiBjb252ZXJ0RGlhZ25vc3RpYyhkaWFnLCBmaWxlUmVjb3JkLnNvdXJjZU1hbmFnZXIpKSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNoaW1TZiA9IGdldFNvdXJjZUZpbGVPckVycm9yKHR5cGVDaGVja1Byb2dyYW0sIHNoaW1QYXRoKTtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHlwZUNoZWNrUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNoaW1TZikubWFwKFxuICAgICAgICAgIGRpYWcgPT4gY29udmVydERpYWdub3N0aWMoZGlhZywgZmlsZVJlY29yZC5zb3VyY2VNYW5hZ2VyKSkpO1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi5zaGltUmVjb3JkLmdlbmVzaXNEaWFnbm9zdGljcyk7XG5cbiAgICAgIGZvciAoY29uc3QgdGVtcGxhdGVEYXRhIG9mIHNoaW1SZWNvcmQudGVtcGxhdGVzLnZhbHVlcygpKSB7XG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlhZ25vc3RpY3MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlhZ25vc3RpY3MuZmlsdGVyKFxuICAgICAgICAgIChkaWFnOiBUZW1wbGF0ZURpYWdub3N0aWN8bnVsbCk6IGRpYWcgaXMgVGVtcGxhdGVEaWFnbm9zdGljID0+XG4gICAgICAgICAgICAgIGRpYWcgIT09IG51bGwgJiYgZGlhZy50ZW1wbGF0ZUlkID09PSB0ZW1wbGF0ZUlkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldFR5cGVDaGVja0Jsb2NrKGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IHRzLk5vZGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0TGF0ZXN0Q29tcG9uZW50U3RhdGUoY29tcG9uZW50KS50Y2I7XG4gIH1cblxuICBnZXRHbG9iYWxDb21wbGV0aW9ucyhcbiAgICAgIGNvbnRleHQ6IFRtcGxBc3RUZW1wbGF0ZXxudWxsLCBjb21wb25lbnQ6IHRzLkNsYXNzRGVjbGFyYXRpb24sXG4gICAgICBub2RlOiBBU1R8VG1wbEFzdE5vZGUpOiBHbG9iYWxDb21wbGV0aW9ufG51bGwge1xuICAgIGNvbnN0IGVuZ2luZSA9IHRoaXMuZ2V0T3JDcmVhdGVDb21wbGV0aW9uRW5naW5lKGNvbXBvbmVudCk7XG4gICAgaWYgKGVuZ2luZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBlcmYuaW5QaGFzZShcbiAgICAgICAgUGVyZlBoYXNlLlR0Y0F1dG9jb21wbGV0aW9uLCAoKSA9PiBlbmdpbmUuZ2V0R2xvYmFsQ29tcGxldGlvbnMoY29udGV4dCwgbm9kZSkpO1xuICB9XG5cbiAgZ2V0RXhwcmVzc2lvbkNvbXBsZXRpb25Mb2NhdGlvbihcbiAgICAgIGFzdDogUHJvcGVydHlSZWFkfFNhZmVQcm9wZXJ0eVJlYWR8TWV0aG9kQ2FsbHxTYWZlTWV0aG9kQ2FsbCxcbiAgICAgIGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IFNoaW1Mb2NhdGlvbnxudWxsIHtcbiAgICBjb25zdCBlbmdpbmUgPSB0aGlzLmdldE9yQ3JlYXRlQ29tcGxldGlvbkVuZ2luZShjb21wb25lbnQpO1xuICAgIGlmIChlbmdpbmUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wZXJmLmluUGhhc2UoXG4gICAgICAgIFBlcmZQaGFzZS5UdGNBdXRvY29tcGxldGlvbiwgKCkgPT4gZW5naW5lLmdldEV4cHJlc3Npb25Db21wbGV0aW9uTG9jYXRpb24oYXN0KSk7XG4gIH1cblxuICBpbnZhbGlkYXRlQ2xhc3MoY2xheno6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiB2b2lkIHtcbiAgICB0aGlzLmNvbXBsZXRpb25DYWNoZS5kZWxldGUoY2xhenopO1xuICAgIHRoaXMuc3ltYm9sQnVpbGRlckNhY2hlLmRlbGV0ZShjbGF6eik7XG4gICAgdGhpcy5zY29wZUNhY2hlLmRlbGV0ZShjbGF6eik7XG4gICAgdGhpcy5lbGVtZW50VGFnQ2FjaGUuZGVsZXRlKGNsYXp6KTtcblxuICAgIGNvbnN0IHNmID0gY2xhenouZ2V0U291cmNlRmlsZSgpO1xuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gVHlwZUNoZWNrU2hpbUdlbmVyYXRvci5zaGltRm9yKHNmUGF0aCk7XG4gICAgY29uc3QgZmlsZURhdGEgPSB0aGlzLmdldEZpbGVEYXRhKHNmUGF0aCk7XG4gICAgY29uc3QgdGVtcGxhdGVJZCA9IGZpbGVEYXRhLnNvdXJjZU1hbmFnZXIuZ2V0VGVtcGxhdGVJZChjbGF6eik7XG5cbiAgICBmaWxlRGF0YS5zaGltRGF0YS5kZWxldGUoc2hpbVBhdGgpO1xuICAgIGZpbGVEYXRhLmlzQ29tcGxldGUgPSBmYWxzZTtcblxuICAgIHRoaXMuaXNDb21wbGV0ZSA9IGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRPckNyZWF0ZUNvbXBsZXRpb25FbmdpbmUoY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogQ29tcGxldGlvbkVuZ2luZXxudWxsIHtcbiAgICBpZiAodGhpcy5jb21wbGV0aW9uQ2FjaGUuaGFzKGNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbXBsZXRpb25DYWNoZS5nZXQoY29tcG9uZW50KSE7XG4gICAgfVxuXG4gICAgY29uc3Qge3RjYiwgZGF0YSwgc2hpbVBhdGh9ID0gdGhpcy5nZXRMYXRlc3RDb21wb25lbnRTdGF0ZShjb21wb25lbnQpO1xuICAgIGlmICh0Y2IgPT09IG51bGwgfHwgZGF0YSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZW5naW5lID0gbmV3IENvbXBsZXRpb25FbmdpbmUodGNiLCBkYXRhLCBzaGltUGF0aCk7XG4gICAgdGhpcy5jb21wbGV0aW9uQ2FjaGUuc2V0KGNvbXBvbmVudCwgZW5naW5lKTtcbiAgICByZXR1cm4gZW5naW5lO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXliZUFkb3B0UHJpb3JSZXN1bHRzRm9yRmlsZShzZjogdHMuU291cmNlRmlsZSk6IHZvaWQge1xuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuICAgIGlmICh0aGlzLnN0YXRlLmhhcyhzZlBhdGgpKSB7XG4gICAgICBjb25zdCBleGlzdGluZ1Jlc3VsdHMgPSB0aGlzLnN0YXRlLmdldChzZlBhdGgpITtcblxuICAgICAgaWYgKGV4aXN0aW5nUmVzdWx0cy5pc0NvbXBsZXRlKSB7XG4gICAgICAgIC8vIEFsbCBkYXRhIGZvciB0aGlzIGZpbGUgaGFzIGFscmVhZHkgYmVlbiBnZW5lcmF0ZWQsIHNvIG5vIG5lZWQgdG8gYWRvcHQgYW55dGhpbmcuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBwcmV2aW91c1Jlc3VsdHMgPSB0aGlzLnByaW9yQnVpbGQucHJpb3JUeXBlQ2hlY2tpbmdSZXN1bHRzRm9yKHNmKTtcbiAgICBpZiAocHJldmlvdXNSZXN1bHRzID09PSBudWxsIHx8ICFwcmV2aW91c1Jlc3VsdHMuaXNDb21wbGV0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucGVyZi5ldmVudENvdW50KFBlcmZFdmVudC5SZXVzZVR5cGVDaGVja0ZpbGUpO1xuICAgIHRoaXMuc3RhdGUuc2V0KHNmUGF0aCwgcHJldmlvdXNSZXN1bHRzKTtcbiAgfVxuXG4gIHByaXZhdGUgZW5zdXJlQWxsU2hpbXNGb3JBbGxGaWxlcygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0NvbXBsZXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wZXJmLmluUGhhc2UoUGVyZlBoYXNlLlRjYkdlbmVyYXRpb24sICgpID0+IHtcbiAgICAgIGNvbnN0IGhvc3QgPSBuZXcgV2hvbGVQcm9ncmFtVHlwZUNoZWNraW5nSG9zdCh0aGlzKTtcbiAgICAgIGNvbnN0IGN0eCA9IHRoaXMubmV3Q29udGV4dChob3N0KTtcblxuICAgICAgZm9yIChjb25zdCBzZiBvZiB0aGlzLm9yaWdpbmFsUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICAgIGlmIChzZi5pc0RlY2xhcmF0aW9uRmlsZSB8fCBpc1NoaW0oc2YpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1heWJlQWRvcHRQcmlvclJlc3VsdHNGb3JGaWxlKHNmKTtcblxuICAgICAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcbiAgICAgICAgY29uc3QgZmlsZURhdGEgPSB0aGlzLmdldEZpbGVEYXRhKHNmUGF0aCk7XG4gICAgICAgIGlmIChmaWxlRGF0YS5pc0NvbXBsZXRlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnR5cGVDaGVja0FkYXB0ZXIudHlwZUNoZWNrKHNmLCBjdHgpO1xuXG4gICAgICAgIGZpbGVEYXRhLmlzQ29tcGxldGUgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZUZyb21Db250ZXh0KGN0eCk7XG4gICAgICB0aGlzLmlzQ29tcGxldGUgPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBlbnN1cmVBbGxTaGltc0Zvck9uZUZpbGUoc2Y6IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICB0aGlzLnBlcmYuaW5QaGFzZShQZXJmUGhhc2UuVGNiR2VuZXJhdGlvbiwgKCkgPT4ge1xuICAgICAgdGhpcy5tYXliZUFkb3B0UHJpb3JSZXN1bHRzRm9yRmlsZShzZik7XG5cbiAgICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuXG4gICAgICBjb25zdCBmaWxlRGF0YSA9IHRoaXMuZ2V0RmlsZURhdGEoc2ZQYXRoKTtcbiAgICAgIGlmIChmaWxlRGF0YS5pc0NvbXBsZXRlKSB7XG4gICAgICAgIC8vIEFsbCBkYXRhIGZvciB0aGlzIGZpbGUgaXMgcHJlc2VudCBhbmQgYWNjb3VudGVkIGZvciBhbHJlYWR5LlxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhvc3QgPSBuZXcgU2luZ2xlRmlsZVR5cGVDaGVja2luZ0hvc3Qoc2ZQYXRoLCBmaWxlRGF0YSwgdGhpcyk7XG4gICAgICBjb25zdCBjdHggPSB0aGlzLm5ld0NvbnRleHQoaG9zdCk7XG5cbiAgICAgIHRoaXMudHlwZUNoZWNrQWRhcHRlci50eXBlQ2hlY2soc2YsIGN0eCk7XG5cbiAgICAgIGZpbGVEYXRhLmlzQ29tcGxldGUgPSB0cnVlO1xuXG4gICAgICB0aGlzLnVwZGF0ZUZyb21Db250ZXh0KGN0eCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGVuc3VyZVNoaW1Gb3JDb21wb25lbnQoY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogdm9pZCB7XG4gICAgY29uc3Qgc2YgPSBjb21wb25lbnQuZ2V0U291cmNlRmlsZSgpO1xuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gVHlwZUNoZWNrU2hpbUdlbmVyYXRvci5zaGltRm9yKHNmUGF0aCk7XG5cbiAgICB0aGlzLm1heWJlQWRvcHRQcmlvclJlc3VsdHNGb3JGaWxlKHNmKTtcblxuICAgIGNvbnN0IGZpbGVEYXRhID0gdGhpcy5nZXRGaWxlRGF0YShzZlBhdGgpO1xuXG4gICAgaWYgKGZpbGVEYXRhLnNoaW1EYXRhLmhhcyhzaGltUGF0aCkpIHtcbiAgICAgIC8vIEFsbCBkYXRhIGZvciB0aGlzIGNvbXBvbmVudCBpcyBhdmFpbGFibGUuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaG9zdCA9IG5ldyBTaW5nbGVTaGltVHlwZUNoZWNraW5nSG9zdChzZlBhdGgsIGZpbGVEYXRhLCB0aGlzLCBzaGltUGF0aCk7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5uZXdDb250ZXh0KGhvc3QpO1xuXG4gICAgdGhpcy50eXBlQ2hlY2tBZGFwdGVyLnR5cGVDaGVjayhzZiwgY3R4KTtcbiAgICB0aGlzLnVwZGF0ZUZyb21Db250ZXh0KGN0eCk7XG4gIH1cblxuICBwcml2YXRlIG5ld0NvbnRleHQoaG9zdDogVHlwZUNoZWNraW5nSG9zdCk6IFR5cGVDaGVja0NvbnRleHRJbXBsIHtcbiAgICBjb25zdCBpbmxpbmluZyA9XG4gICAgICAgIHRoaXMucHJvZ3JhbURyaXZlci5zdXBwb3J0c0lubGluZU9wZXJhdGlvbnMgPyBJbmxpbmluZ01vZGUuSW5saW5lT3BzIDogSW5saW5pbmdNb2RlLkVycm9yO1xuICAgIHJldHVybiBuZXcgVHlwZUNoZWNrQ29udGV4dEltcGwoXG4gICAgICAgIHRoaXMuY29uZmlnLCB0aGlzLmNvbXBpbGVySG9zdCwgdGhpcy5yZWZFbWl0dGVyLCB0aGlzLnJlZmxlY3RvciwgaG9zdCwgaW5saW5pbmcsIHRoaXMucGVyZik7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFueSBzaGltIGRhdGEgdGhhdCBkZXBlbmRzIG9uIGlubGluZSBvcGVyYXRpb25zIGFwcGxpZWQgdG8gdGhlIHR5cGUtY2hlY2tpbmcgcHJvZ3JhbS5cbiAgICpcbiAgICogVGhpcyBjYW4gYmUgdXNlZnVsIGlmIG5ldyBpbmxpbmVzIG5lZWQgdG8gYmUgYXBwbGllZCwgYW5kIGl0J3Mgbm90IHBvc3NpYmxlIHRvIGd1YXJhbnRlZSB0aGF0XG4gICAqIHRoZXkgd29uJ3Qgb3ZlcndyaXRlIG9yIGNvcnJ1cHQgZXhpc3RpbmcgaW5saW5lcyB0aGF0IGFyZSB1c2VkIGJ5IHN1Y2ggc2hpbXMuXG4gICAqL1xuICBjbGVhckFsbFNoaW1EYXRhVXNpbmdJbmxpbmVzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgZmlsZURhdGEgb2YgdGhpcy5zdGF0ZS52YWx1ZXMoKSkge1xuICAgICAgaWYgKCFmaWxlRGF0YS5oYXNJbmxpbmVzKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IFtzaGltRmlsZSwgc2hpbURhdGFdIG9mIGZpbGVEYXRhLnNoaW1EYXRhLmVudHJpZXMoKSkge1xuICAgICAgICBpZiAoc2hpbURhdGEuaGFzSW5saW5lcykge1xuICAgICAgICAgIGZpbGVEYXRhLnNoaW1EYXRhLmRlbGV0ZShzaGltRmlsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZmlsZURhdGEuaGFzSW5saW5lcyA9IGZhbHNlO1xuICAgICAgZmlsZURhdGEuaXNDb21wbGV0ZSA9IGZhbHNlO1xuICAgICAgdGhpcy5pc0NvbXBsZXRlID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVGcm9tQ29udGV4dChjdHg6IFR5cGVDaGVja0NvbnRleHRJbXBsKTogdm9pZCB7XG4gICAgY29uc3QgdXBkYXRlcyA9IGN0eC5maW5hbGl6ZSgpO1xuICAgIHJldHVybiB0aGlzLnBlcmYuaW5QaGFzZShQZXJmUGhhc2UuVGNiVXBkYXRlUHJvZ3JhbSwgKCkgPT4ge1xuICAgICAgaWYgKHVwZGF0ZXMuc2l6ZSA+IDApIHtcbiAgICAgICAgdGhpcy5wZXJmLmV2ZW50Q291bnQoUGVyZkV2ZW50LlVwZGF0ZVR5cGVDaGVja1Byb2dyYW0pO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9ncmFtRHJpdmVyLnVwZGF0ZUZpbGVzKHVwZGF0ZXMsIFVwZGF0ZU1vZGUuSW5jcmVtZW50YWwpO1xuICAgICAgdGhpcy5wcmlvckJ1aWxkLnJlY29yZFN1Y2Nlc3NmdWxUeXBlQ2hlY2sodGhpcy5zdGF0ZSk7XG4gICAgICB0aGlzLnBlcmYubWVtb3J5KFBlcmZDaGVja3BvaW50LlR0Y1VwZGF0ZVByb2dyYW0pO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0RmlsZURhdGEocGF0aDogQWJzb2x1dGVGc1BhdGgpOiBGaWxlVHlwZUNoZWNraW5nRGF0YSB7XG4gICAgaWYgKCF0aGlzLnN0YXRlLmhhcyhwYXRoKSkge1xuICAgICAgdGhpcy5zdGF0ZS5zZXQocGF0aCwge1xuICAgICAgICBoYXNJbmxpbmVzOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFuYWdlcjogbmV3IFRlbXBsYXRlU291cmNlTWFuYWdlcigpLFxuICAgICAgICBpc0NvbXBsZXRlOiBmYWxzZSxcbiAgICAgICAgc2hpbURhdGE6IG5ldyBNYXAoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5nZXQocGF0aCkhO1xuICB9XG4gIGdldFN5bWJvbE9mTm9kZShub2RlOiBUbXBsQXN0VGVtcGxhdGUsIGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IFRlbXBsYXRlU3ltYm9sfG51bGw7XG4gIGdldFN5bWJvbE9mTm9kZShub2RlOiBUbXBsQXN0RWxlbWVudCwgY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogRWxlbWVudFN5bWJvbHxudWxsO1xuICBnZXRTeW1ib2xPZk5vZGUobm9kZTogQVNUfFRtcGxBc3ROb2RlLCBjb21wb25lbnQ6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBTeW1ib2x8bnVsbCB7XG4gICAgY29uc3QgYnVpbGRlciA9IHRoaXMuZ2V0T3JDcmVhdGVTeW1ib2xCdWlsZGVyKGNvbXBvbmVudCk7XG4gICAgaWYgKGJ1aWxkZXIgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wZXJmLmluUGhhc2UoUGVyZlBoYXNlLlR0Y1N5bWJvbCwgKCkgPT4gYnVpbGRlci5nZXRTeW1ib2wobm9kZSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRPckNyZWF0ZVN5bWJvbEJ1aWxkZXIoY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogU3ltYm9sQnVpbGRlcnxudWxsIHtcbiAgICBpZiAodGhpcy5zeW1ib2xCdWlsZGVyQ2FjaGUuaGFzKGNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiB0aGlzLnN5bWJvbEJ1aWxkZXJDYWNoZS5nZXQoY29tcG9uZW50KSE7XG4gICAgfVxuXG4gICAgY29uc3Qge3RjYiwgZGF0YSwgc2hpbVBhdGh9ID0gdGhpcy5nZXRMYXRlc3RDb21wb25lbnRTdGF0ZShjb21wb25lbnQpO1xuICAgIGlmICh0Y2IgPT09IG51bGwgfHwgZGF0YSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyBTeW1ib2xCdWlsZGVyKFxuICAgICAgICBzaGltUGF0aCwgdGNiLCBkYXRhLCB0aGlzLmNvbXBvbmVudFNjb3BlUmVhZGVyLFxuICAgICAgICAoKSA9PiB0aGlzLnByb2dyYW1Ecml2ZXIuZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCkpO1xuICAgIHRoaXMuc3ltYm9sQnVpbGRlckNhY2hlLnNldChjb21wb25lbnQsIGJ1aWxkZXIpO1xuICAgIHJldHVybiBidWlsZGVyO1xuICB9XG5cbiAgZ2V0RGlyZWN0aXZlc0luU2NvcGUoY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogRGlyZWN0aXZlSW5TY29wZVtdfG51bGwge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLmdldFNjb3BlRGF0YShjb21wb25lbnQpO1xuICAgIGlmIChkYXRhID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGEuZGlyZWN0aXZlcztcbiAgfVxuXG4gIGdldFBpcGVzSW5TY29wZShjb21wb25lbnQ6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBQaXBlSW5TY29wZVtdfG51bGwge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLmdldFNjb3BlRGF0YShjb21wb25lbnQpO1xuICAgIGlmIChkYXRhID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGEucGlwZXM7XG4gIH1cblxuICBnZXREaXJlY3RpdmVNZXRhZGF0YShkaXI6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YXxudWxsIHtcbiAgICBpZiAoIWlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKGRpcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy50eXBlQ2hlY2tTY29wZVJlZ2lzdHJ5LmdldFR5cGVDaGVja0RpcmVjdGl2ZU1ldGFkYXRhKG5ldyBSZWZlcmVuY2UoZGlyKSk7XG4gIH1cblxuICBnZXRQb3RlbnRpYWxFbGVtZW50VGFncyhjb21wb25lbnQ6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBNYXA8c3RyaW5nLCBEaXJlY3RpdmVJblNjb3BlfG51bGw+IHtcbiAgICBpZiAodGhpcy5lbGVtZW50VGFnQ2FjaGUuaGFzKGNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVsZW1lbnRUYWdDYWNoZS5nZXQoY29tcG9uZW50KSE7XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTWFwID0gbmV3IE1hcDxzdHJpbmcsIERpcmVjdGl2ZUluU2NvcGV8bnVsbD4oKTtcblxuICAgIGZvciAoY29uc3QgdGFnIG9mIFJFR0lTVFJZLmFsbEtub3duRWxlbWVudE5hbWVzKCkpIHtcbiAgICAgIHRhZ01hcC5zZXQodGFnLCBudWxsKTtcbiAgICB9XG5cbiAgICBjb25zdCBzY29wZSA9IHRoaXMuZ2V0U2NvcGVEYXRhKGNvbXBvbmVudCk7XG4gICAgaWYgKHNjb3BlICE9PSBudWxsKSB7XG4gICAgICBmb3IgKGNvbnN0IGRpcmVjdGl2ZSBvZiBzY29wZS5kaXJlY3RpdmVzKSB7XG4gICAgICAgIGZvciAoY29uc3Qgc2VsZWN0b3Igb2YgQ3NzU2VsZWN0b3IucGFyc2UoZGlyZWN0aXZlLnNlbGVjdG9yKSkge1xuICAgICAgICAgIGlmIChzZWxlY3Rvci5lbGVtZW50ID09PSBudWxsIHx8IHRhZ01hcC5oYXMoc2VsZWN0b3IuZWxlbWVudCkpIHtcbiAgICAgICAgICAgIC8vIFNraXAgdGhpcyBkaXJlY3RpdmUgaWYgaXQgZG9lc24ndCBtYXRjaCBhbiBlbGVtZW50IHRhZywgb3IgaWYgYW5vdGhlciBkaXJlY3RpdmUgaGFzXG4gICAgICAgICAgICAvLyBhbHJlYWR5IGJlZW4gaW5jbHVkZWQgd2l0aCB0aGUgc2FtZSBlbGVtZW50IG5hbWUuXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0YWdNYXAuc2V0KHNlbGVjdG9yLmVsZW1lbnQsIGRpcmVjdGl2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVsZW1lbnRUYWdDYWNoZS5zZXQoY29tcG9uZW50LCB0YWdNYXApO1xuICAgIHJldHVybiB0YWdNYXA7XG4gIH1cblxuICBnZXRQb3RlbnRpYWxEb21CaW5kaW5ncyh0YWdOYW1lOiBzdHJpbmcpOiB7YXR0cmlidXRlOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmd9W10ge1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBSRUdJU1RSWS5hbGxLbm93bkF0dHJpYnV0ZXNPZkVsZW1lbnQodGFnTmFtZSk7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZXMubWFwKGF0dHJpYnV0ZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogUkVHSVNUUlkuZ2V0TWFwcGVkUHJvcE5hbWUoYXR0cmlidXRlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRTY29wZURhdGEoY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogU2NvcGVEYXRhfG51bGwge1xuICAgIGlmICh0aGlzLnNjb3BlQ2FjaGUuaGFzKGNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjb3BlQ2FjaGUuZ2V0KGNvbXBvbmVudCkhO1xuICAgIH1cblxuICAgIGlmICghaXNOYW1lZENsYXNzRGVjbGFyYXRpb24oY29tcG9uZW50KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogY29tcG9uZW50cyBtdXN0IGhhdmUgbmFtZXNgKTtcbiAgICB9XG5cbiAgICBjb25zdCBzY29wZSA9IHRoaXMuY29tcG9uZW50U2NvcGVSZWFkZXIuZ2V0U2NvcGVGb3JDb21wb25lbnQoY29tcG9uZW50KTtcbiAgICBpZiAoc2NvcGUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGE6IFNjb3BlRGF0YSA9IHtcbiAgICAgIGRpcmVjdGl2ZXM6IFtdLFxuICAgICAgcGlwZXM6IFtdLFxuICAgICAgaXNQb2lzb25lZDogc2NvcGUuY29tcGlsYXRpb24uaXNQb2lzb25lZCxcbiAgICB9O1xuXG4gICAgY29uc3QgdHlwZUNoZWNrZXIgPSB0aGlzLnByb2dyYW1Ecml2ZXIuZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCk7XG4gICAgZm9yIChjb25zdCBkaXIgb2Ygc2NvcGUuY29tcGlsYXRpb24uZGlyZWN0aXZlcykge1xuICAgICAgaWYgKGRpci5zZWxlY3RvciA9PT0gbnVsbCkge1xuICAgICAgICAvLyBTa2lwIHRoaXMgZGlyZWN0aXZlLCBpdCBjYW4ndCBiZSBhZGRlZCB0byBhIHRlbXBsYXRlIGFueXdheS5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCB0c1N5bWJvbCA9IHR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oZGlyLnJlZi5ub2RlLm5hbWUpO1xuICAgICAgaWYgKCFpc1N5bWJvbFdpdGhWYWx1ZURlY2xhcmF0aW9uKHRzU3ltYm9sKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgbGV0IG5nTW9kdWxlOiBDbGFzc0RlY2xhcmF0aW9ufG51bGwgPSBudWxsO1xuICAgICAgY29uc3QgbW9kdWxlU2NvcGVPZkRpciA9IHRoaXMuY29tcG9uZW50U2NvcGVSZWFkZXIuZ2V0U2NvcGVGb3JDb21wb25lbnQoZGlyLnJlZi5ub2RlKTtcbiAgICAgIGlmIChtb2R1bGVTY29wZU9mRGlyICE9PSBudWxsKSB7XG4gICAgICAgIG5nTW9kdWxlID0gbW9kdWxlU2NvcGVPZkRpci5uZ01vZHVsZTtcbiAgICAgIH1cblxuICAgICAgZGF0YS5kaXJlY3RpdmVzLnB1c2goe1xuICAgICAgICBpc0NvbXBvbmVudDogZGlyLmlzQ29tcG9uZW50LFxuICAgICAgICBpc1N0cnVjdHVyYWw6IGRpci5pc1N0cnVjdHVyYWwsXG4gICAgICAgIHNlbGVjdG9yOiBkaXIuc2VsZWN0b3IsXG4gICAgICAgIHRzU3ltYm9sLFxuICAgICAgICBuZ01vZHVsZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgcGlwZSBvZiBzY29wZS5jb21waWxhdGlvbi5waXBlcykge1xuICAgICAgY29uc3QgdHNTeW1ib2wgPSB0eXBlQ2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHBpcGUucmVmLm5vZGUubmFtZSk7XG4gICAgICBpZiAodHNTeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGRhdGEucGlwZXMucHVzaCh7XG4gICAgICAgIG5hbWU6IHBpcGUubmFtZSxcbiAgICAgICAgdHNTeW1ib2wsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnNjb3BlQ2FjaGUuc2V0KGNvbXBvbmVudCwgZGF0YSk7XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29udmVydERpYWdub3N0aWMoXG4gICAgZGlhZzogdHMuRGlhZ25vc3RpYywgc291cmNlUmVzb2x2ZXI6IFRlbXBsYXRlU291cmNlUmVzb2x2ZXIpOiBUZW1wbGF0ZURpYWdub3N0aWN8bnVsbCB7XG4gIGlmICghc2hvdWxkUmVwb3J0RGlhZ25vc3RpYyhkaWFnKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHJldHVybiB0cmFuc2xhdGVEaWFnbm9zdGljKGRpYWcsIHNvdXJjZVJlc29sdmVyKTtcbn1cblxuLyoqXG4gKiBEYXRhIGZvciB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIHJlbGF0ZWQgdG8gYSBzcGVjaWZpYyBpbnB1dCBmaWxlIGluIHRoZSB1c2VyJ3MgcHJvZ3JhbSAod2hpY2hcbiAqIGNvbnRhaW5zIGNvbXBvbmVudHMgdG8gYmUgY2hlY2tlZCkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVR5cGVDaGVja2luZ0RhdGEge1xuICAvKipcbiAgICogV2hldGhlciB0aGUgdHlwZS1jaGVja2luZyBzaGltIHJlcXVpcmVkIGFueSBpbmxpbmUgY2hhbmdlcyB0byB0aGUgb3JpZ2luYWwgZmlsZSwgd2hpY2ggYWZmZWN0c1xuICAgKiB3aGV0aGVyIHRoZSBzaGltIGNhbiBiZSByZXVzZWQuXG4gICAqL1xuICBoYXNJbmxpbmVzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBTb3VyY2UgbWFwcGluZyBpbmZvcm1hdGlvbiBmb3IgbWFwcGluZyBkaWFnbm9zdGljcyBmcm9tIGlubGluZWQgdHlwZSBjaGVjayBibG9ja3MgYmFjayB0byB0aGVcbiAgICogb3JpZ2luYWwgdGVtcGxhdGUuXG4gICAqL1xuICBzb3VyY2VNYW5hZ2VyOiBUZW1wbGF0ZVNvdXJjZU1hbmFnZXI7XG5cbiAgLyoqXG4gICAqIERhdGEgZm9yIGVhY2ggc2hpbSBnZW5lcmF0ZWQgZnJvbSB0aGlzIGlucHV0IGZpbGUuXG4gICAqXG4gICAqIEEgc2luZ2xlIGlucHV0IGZpbGUgd2lsbCBnZW5lcmF0ZSBvbmUgb3IgbW9yZSBzaGltIGZpbGVzIHRoYXQgYWN0dWFsbHkgY29udGFpbiB0ZW1wbGF0ZVxuICAgKiB0eXBlLWNoZWNraW5nIGNvZGUuXG4gICAqL1xuICBzaGltRGF0YTogTWFwPEFic29sdXRlRnNQYXRoLCBTaGltVHlwZUNoZWNraW5nRGF0YT47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIHRlbXBsYXRlIHR5cGUtY2hlY2tlciBpcyBjZXJ0YWluIHRoYXQgYWxsIGNvbXBvbmVudHMgZnJvbSB0aGlzIGlucHV0IGZpbGUgaGF2ZSBoYWRcbiAgICogdHlwZS1jaGVja2luZyBjb2RlIGdlbmVyYXRlZCBpbnRvIHNoaW1zLlxuICAgKi9cbiAgaXNDb21wbGV0ZTogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBEcml2ZXMgYSBgVHlwZUNoZWNrQ29udGV4dGAgdG8gZ2VuZXJhdGUgdHlwZS1jaGVja2luZyBjb2RlIGZvciBldmVyeSBjb21wb25lbnQgaW4gdGhlIHByb2dyYW0uXG4gKi9cbmNsYXNzIFdob2xlUHJvZ3JhbVR5cGVDaGVja2luZ0hvc3QgaW1wbGVtZW50cyBUeXBlQ2hlY2tpbmdIb3N0IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBpbXBsOiBUZW1wbGF0ZVR5cGVDaGVja2VySW1wbCkge31cblxuICBnZXRTb3VyY2VNYW5hZ2VyKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgpOiBUZW1wbGF0ZVNvdXJjZU1hbmFnZXIge1xuICAgIHJldHVybiB0aGlzLmltcGwuZ2V0RmlsZURhdGEoc2ZQYXRoKS5zb3VyY2VNYW5hZ2VyO1xuICB9XG5cbiAgc2hvdWxkQ2hlY2tDb21wb25lbnQobm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUobm9kZS5nZXRTb3VyY2VGaWxlKCkpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gVHlwZUNoZWNrU2hpbUdlbmVyYXRvci5zaGltRm9yKHNmUGF0aCk7XG4gICAgY29uc3QgZmlsZURhdGEgPSB0aGlzLmltcGwuZ2V0RmlsZURhdGEoc2ZQYXRoKTtcbiAgICAvLyBUaGUgY29tcG9uZW50IG5lZWRzIHRvIGJlIGNoZWNrZWQgdW5sZXNzIHRoZSBzaGltIHdoaWNoIHdvdWxkIGNvbnRhaW4gaXQgYWxyZWFkeSBleGlzdHMuXG4gICAgcmV0dXJuICFmaWxlRGF0YS5zaGltRGF0YS5oYXMoc2hpbVBhdGgpO1xuICB9XG5cbiAgcmVjb3JkU2hpbURhdGEoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgZGF0YTogU2hpbVR5cGVDaGVja2luZ0RhdGEpOiB2b2lkIHtcbiAgICBjb25zdCBmaWxlRGF0YSA9IHRoaXMuaW1wbC5nZXRGaWxlRGF0YShzZlBhdGgpO1xuICAgIGZpbGVEYXRhLnNoaW1EYXRhLnNldChkYXRhLnBhdGgsIGRhdGEpO1xuICAgIGlmIChkYXRhLmhhc0lubGluZXMpIHtcbiAgICAgIGZpbGVEYXRhLmhhc0lubGluZXMgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJlY29yZENvbXBsZXRlKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgpOiB2b2lkIHtcbiAgICB0aGlzLmltcGwuZ2V0RmlsZURhdGEoc2ZQYXRoKS5pc0NvbXBsZXRlID0gdHJ1ZTtcbiAgfVxufVxuXG4vKipcbiAqIERyaXZlcyBhIGBUeXBlQ2hlY2tDb250ZXh0YCB0byBnZW5lcmF0ZSB0eXBlLWNoZWNraW5nIGNvZGUgZWZmaWNpZW50bHkgZm9yIGEgc2luZ2xlIGlucHV0IGZpbGUuXG4gKi9cbmNsYXNzIFNpbmdsZUZpbGVUeXBlQ2hlY2tpbmdIb3N0IGltcGxlbWVudHMgVHlwZUNoZWNraW5nSG9zdCB7XG4gIHByaXZhdGUgc2VlbklubGluZXMgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByb3RlY3RlZCBzZlBhdGg6IEFic29sdXRlRnNQYXRoLCBwcm90ZWN0ZWQgZmlsZURhdGE6IEZpbGVUeXBlQ2hlY2tpbmdEYXRhLFxuICAgICAgcHJvdGVjdGVkIGltcGw6IFRlbXBsYXRlVHlwZUNoZWNrZXJJbXBsKSB7fVxuXG4gIHByaXZhdGUgYXNzZXJ0UGF0aChzZlBhdGg6IEFic29sdXRlRnNQYXRoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2ZQYXRoICE9PSBzZlBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHF1ZXJ5aW5nIFR5cGVDaGVja2luZ0hvc3Qgb3V0c2lkZSBvZiBhc3NpZ25lZCBmaWxlYCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0U291cmNlTWFuYWdlcihzZlBhdGg6IEFic29sdXRlRnNQYXRoKTogVGVtcGxhdGVTb3VyY2VNYW5hZ2VyIHtcbiAgICB0aGlzLmFzc2VydFBhdGgoc2ZQYXRoKTtcbiAgICByZXR1cm4gdGhpcy5maWxlRGF0YS5zb3VyY2VNYW5hZ2VyO1xuICB9XG5cbiAgc2hvdWxkQ2hlY2tDb21wb25lbnQobm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLnNmUGF0aCAhPT0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShub2RlLmdldFNvdXJjZUZpbGUoKSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3Qgc2hpbVBhdGggPSBUeXBlQ2hlY2tTaGltR2VuZXJhdG9yLnNoaW1Gb3IodGhpcy5zZlBhdGgpO1xuXG4gICAgLy8gT25seSBuZWVkIHRvIGdlbmVyYXRlIGEgVENCIGZvciB0aGUgY2xhc3MgaWYgbm8gc2hpbSBleGlzdHMgZm9yIGl0IGN1cnJlbnRseS5cbiAgICByZXR1cm4gIXRoaXMuZmlsZURhdGEuc2hpbURhdGEuaGFzKHNoaW1QYXRoKTtcbiAgfVxuXG4gIHJlY29yZFNoaW1EYXRhKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgsIGRhdGE6IFNoaW1UeXBlQ2hlY2tpbmdEYXRhKTogdm9pZCB7XG4gICAgdGhpcy5hc3NlcnRQYXRoKHNmUGF0aCk7XG5cbiAgICAvLyBQcmV2aW91cyB0eXBlLWNoZWNraW5nIHN0YXRlIG1heSBoYXZlIHJlcXVpcmVkIHRoZSB1c2Ugb2YgaW5saW5lcyAoYXNzdW1pbmcgdGhleSB3ZXJlXG4gICAgLy8gc3VwcG9ydGVkKS4gSWYgdGhlIGN1cnJlbnQgb3BlcmF0aW9uIGFsc28gcmVxdWlyZXMgaW5saW5lcywgdGhpcyBwcmVzZW50cyBhIHByb2JsZW06XG4gICAgLy8gZ2VuZXJhdGluZyBuZXcgaW5saW5lcyBtYXkgaW52YWxpZGF0ZSBhbnkgb2xkIGlubGluZXMgdGhhdCBvbGQgc3RhdGUgZGVwZW5kcyBvbi5cbiAgICAvL1xuICAgIC8vIFJhdGhlciB0aGFuIHJlc29sdmUgdGhpcyBpc3N1ZSBieSB0cmFja2luZyBzcGVjaWZpYyBkZXBlbmRlbmNpZXMgb24gaW5saW5lcywgaWYgdGhlIG5ldyBzdGF0ZVxuICAgIC8vIHJlbGllcyBvbiBpbmxpbmVzLCBhbnkgb2xkIHN0YXRlIHRoYXQgcmVsaWVkIG9uIHRoZW0gaXMgc2ltcGx5IGNsZWFyZWQuIFRoaXMgaGFwcGVucyB3aGVuIHRoZVxuICAgIC8vIGZpcnN0IG5ldyBzdGF0ZSB0aGF0IHVzZXMgaW5saW5lcyBpcyBlbmNvdW50ZXJlZC5cbiAgICBpZiAoZGF0YS5oYXNJbmxpbmVzICYmICF0aGlzLnNlZW5JbmxpbmVzKSB7XG4gICAgICB0aGlzLmltcGwuY2xlYXJBbGxTaGltRGF0YVVzaW5nSW5saW5lcygpO1xuICAgICAgdGhpcy5zZWVuSW5saW5lcyA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5maWxlRGF0YS5zaGltRGF0YS5zZXQoZGF0YS5wYXRoLCBkYXRhKTtcbiAgICBpZiAoZGF0YS5oYXNJbmxpbmVzKSB7XG4gICAgICB0aGlzLmZpbGVEYXRhLmhhc0lubGluZXMgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJlY29yZENvbXBsZXRlKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgpOiB2b2lkIHtcbiAgICB0aGlzLmFzc2VydFBhdGgoc2ZQYXRoKTtcbiAgICB0aGlzLmZpbGVEYXRhLmlzQ29tcGxldGUgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogRHJpdmVzIGEgYFR5cGVDaGVja0NvbnRleHRgIHRvIGdlbmVyYXRlIHR5cGUtY2hlY2tpbmcgY29kZSBlZmZpY2llbnRseSBmb3Igb25seSB0aG9zZSBjb21wb25lbnRzXG4gKiB3aGljaCBtYXAgdG8gYSBzaW5nbGUgc2hpbSBvZiBhIHNpbmdsZSBpbnB1dCBmaWxlLlxuICovXG5jbGFzcyBTaW5nbGVTaGltVHlwZUNoZWNraW5nSG9zdCBleHRlbmRzIFNpbmdsZUZpbGVUeXBlQ2hlY2tpbmdIb3N0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzZlBhdGg6IEFic29sdXRlRnNQYXRoLCBmaWxlRGF0YTogRmlsZVR5cGVDaGVja2luZ0RhdGEsIGltcGw6IFRlbXBsYXRlVHlwZUNoZWNrZXJJbXBsLFxuICAgICAgcHJpdmF0ZSBzaGltUGF0aDogQWJzb2x1dGVGc1BhdGgpIHtcbiAgICBzdXBlcihzZlBhdGgsIGZpbGVEYXRhLCBpbXBsKTtcbiAgfVxuXG4gIHNob3VsZENoZWNrTm9kZShub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuc2ZQYXRoICE9PSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKG5vZGUuZ2V0U291cmNlRmlsZSgpKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIE9ubHkgZ2VuZXJhdGUgYSBUQ0IgZm9yIHRoZSBjb21wb25lbnQgaWYgaXQgbWFwcyB0byB0aGUgcmVxdWVzdGVkIHNoaW0gZmlsZS5cbiAgICBjb25zdCBzaGltUGF0aCA9IFR5cGVDaGVja1NoaW1HZW5lcmF0b3Iuc2hpbUZvcih0aGlzLnNmUGF0aCk7XG4gICAgaWYgKHNoaW1QYXRoICE9PSB0aGlzLnNoaW1QYXRoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT25seSBuZWVkIHRvIGdlbmVyYXRlIGEgVENCIGZvciB0aGUgY2xhc3MgaWYgbm8gc2hpbSBleGlzdHMgZm9yIGl0IGN1cnJlbnRseS5cbiAgICByZXR1cm4gIXRoaXMuZmlsZURhdGEuc2hpbURhdGEuaGFzKHNoaW1QYXRoKTtcbiAgfVxufVxuXG4vKipcbiAqIENhY2hlZCBzY29wZSBpbmZvcm1hdGlvbiBmb3IgYSBjb21wb25lbnQuXG4gKi9cbmludGVyZmFjZSBTY29wZURhdGEge1xuICBkaXJlY3RpdmVzOiBEaXJlY3RpdmVJblNjb3BlW107XG4gIHBpcGVzOiBQaXBlSW5TY29wZVtdO1xuICBpc1BvaXNvbmVkOiBib29sZWFuO1xufVxuIl19