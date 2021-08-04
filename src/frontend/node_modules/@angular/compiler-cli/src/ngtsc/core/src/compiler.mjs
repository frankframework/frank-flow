/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __awaiter } from "tslib";
import * as ts from 'typescript';
import { ComponentDecoratorHandler, DirectiveDecoratorHandler, InjectableDecoratorHandler, NgModuleDecoratorHandler, NoopReferencesRegistry, PipeDecoratorHandler } from '../../annotations';
import { CycleAnalyzer, ImportGraph } from '../../cycles';
import { COMPILER_ERRORS_WITH_GUIDES, ERROR_DETAILS_PAGE_BASE_URL, ErrorCode, ngErrorCode } from '../../diagnostics';
import { checkForPrivateExports, ReferenceGraph } from '../../entry_point';
import { absoluteFromSourceFile, LogicalFileSystem, resolve } from '../../file_system';
import { AbsoluteModuleStrategy, AliasStrategy, DefaultImportTracker, LocalIdentifierStrategy, LogicalProjectStrategy, ModuleResolver, NoopImportRewriter, PrivateExportAliasingHost, R3SymbolsImportRewriter, Reference, ReferenceEmitter, RelativePathStrategy, UnifiedModulesAliasingHost, UnifiedModulesStrategy } from '../../imports';
import { IncrementalCompilation } from '../../incremental';
import { generateAnalysis, IndexingContext } from '../../indexer';
import { CompoundMetadataReader, CompoundMetadataRegistry, DtsMetadataReader, InjectableClassRegistry, LocalMetadataRegistry, ResourceRegistry } from '../../metadata';
import { PartialEvaluator } from '../../partial_evaluator';
import { ActivePerfRecorder, DelegatingPerfRecorder, PerfCheckpoint, PerfEvent, PerfPhase } from '../../perf';
import { isNamedClassDeclaration, TypeScriptReflectionHost } from '../../reflection';
import { AdapterResourceLoader } from '../../resource';
import { entryPointKeyFor, NgModuleRouteAnalyzer } from '../../routing';
import { LocalModuleScopeRegistry, MetadataDtsModuleScopeResolver, TypeCheckScopeRegistry } from '../../scope';
import { generatedFactoryTransform } from '../../shims';
import { ivySwitchTransform } from '../../switch';
import { aliasTransformFactory, CompilationMode, declarationTransformFactory, DtsTransformRegistry, ivyTransformFactory, TraitCompiler } from '../../transform';
import { TemplateTypeCheckerImpl } from '../../typecheck';
import { OptimizeFor } from '../../typecheck/api';
import { getSourceFileOrNull, isDtsPath, resolveModuleName, toUnredirectedSourceFile } from '../../util/src/typescript';
import { compileUndecoratedClassesWithAngularFeatures } from './config';
/**
 * Discriminant type for a `CompilationTicket`.
 */
export var CompilationTicketKind;
(function (CompilationTicketKind) {
    CompilationTicketKind[CompilationTicketKind["Fresh"] = 0] = "Fresh";
    CompilationTicketKind[CompilationTicketKind["IncrementalTypeScript"] = 1] = "IncrementalTypeScript";
    CompilationTicketKind[CompilationTicketKind["IncrementalResource"] = 2] = "IncrementalResource";
})(CompilationTicketKind || (CompilationTicketKind = {}));
/**
 * Create a `CompilationTicket` for a brand new compilation, using no prior state.
 */
export function freshCompilationTicket(tsProgram, options, incrementalBuildStrategy, programDriver, perfRecorder, enableTemplateTypeChecker, usePoisonedData) {
    return {
        kind: CompilationTicketKind.Fresh,
        tsProgram,
        options,
        incrementalBuildStrategy,
        programDriver,
        enableTemplateTypeChecker,
        usePoisonedData,
        perfRecorder: perfRecorder !== null && perfRecorder !== void 0 ? perfRecorder : ActivePerfRecorder.zeroedToNow(),
    };
}
/**
 * Create a `CompilationTicket` as efficiently as possible, based on a previous `NgCompiler`
 * instance and a new `ts.Program`.
 */
export function incrementalFromCompilerTicket(oldCompiler, newProgram, incrementalBuildStrategy, programDriver, modifiedResourceFiles, perfRecorder) {
    const oldProgram = oldCompiler.getCurrentProgram();
    const oldState = oldCompiler.incrementalStrategy.getIncrementalState(oldProgram);
    if (oldState === null) {
        // No incremental step is possible here, since no IncrementalDriver was found for the old
        // program.
        return freshCompilationTicket(newProgram, oldCompiler.options, incrementalBuildStrategy, programDriver, perfRecorder, oldCompiler.enableTemplateTypeChecker, oldCompiler.usePoisonedData);
    }
    if (perfRecorder === null) {
        perfRecorder = ActivePerfRecorder.zeroedToNow();
    }
    const incrementalCompilation = IncrementalCompilation.incremental(newProgram, versionMapFromProgram(newProgram, programDriver), oldProgram, oldState, modifiedResourceFiles, perfRecorder);
    return {
        kind: CompilationTicketKind.IncrementalTypeScript,
        enableTemplateTypeChecker: oldCompiler.enableTemplateTypeChecker,
        usePoisonedData: oldCompiler.usePoisonedData,
        options: oldCompiler.options,
        incrementalBuildStrategy,
        incrementalCompilation,
        programDriver,
        newProgram,
        perfRecorder,
    };
}
/**
 * Create a `CompilationTicket` directly from an old `ts.Program` and associated Angular compilation
 * state, along with a new `ts.Program`.
 */
export function incrementalFromStateTicket(oldProgram, oldState, newProgram, options, incrementalBuildStrategy, programDriver, modifiedResourceFiles, perfRecorder, enableTemplateTypeChecker, usePoisonedData) {
    if (perfRecorder === null) {
        perfRecorder = ActivePerfRecorder.zeroedToNow();
    }
    const incrementalCompilation = IncrementalCompilation.incremental(newProgram, versionMapFromProgram(newProgram, programDriver), oldProgram, oldState, modifiedResourceFiles, perfRecorder);
    return {
        kind: CompilationTicketKind.IncrementalTypeScript,
        newProgram,
        options,
        incrementalBuildStrategy,
        incrementalCompilation,
        programDriver,
        enableTemplateTypeChecker,
        usePoisonedData,
        perfRecorder,
    };
}
export function resourceChangeTicket(compiler, modifiedResourceFiles) {
    return {
        kind: CompilationTicketKind.IncrementalResource,
        compiler,
        modifiedResourceFiles,
        perfRecorder: ActivePerfRecorder.zeroedToNow(),
    };
}
/**
 * The heart of the Angular Ivy compiler.
 *
 * The `NgCompiler` provides an API for performing Angular compilation within a custom TypeScript
 * compiler. Each instance of `NgCompiler` supports a single compilation, which might be
 * incremental.
 *
 * `NgCompiler` is lazy, and does not perform any of the work of the compilation until one of its
 * output methods (e.g. `getDiagnostics`) is called.
 *
 * See the README.md for more information.
 */
export class NgCompiler {
    constructor(adapter, options, inputProgram, programDriver, incrementalStrategy, incrementalCompilation, enableTemplateTypeChecker, usePoisonedData, livePerfRecorder) {
        this.adapter = adapter;
        this.options = options;
        this.inputProgram = inputProgram;
        this.programDriver = programDriver;
        this.incrementalStrategy = incrementalStrategy;
        this.incrementalCompilation = incrementalCompilation;
        this.enableTemplateTypeChecker = enableTemplateTypeChecker;
        this.usePoisonedData = usePoisonedData;
        this.livePerfRecorder = livePerfRecorder;
        /**
         * Lazily evaluated state of the compilation.
         *
         * This is created on demand by calling `ensureAnalyzed`.
         */
        this.compilation = null;
        /**
         * Any diagnostics related to the construction of the compilation.
         *
         * These are diagnostics which arose during setup of the host and/or program.
         */
        this.constructionDiagnostics = [];
        /**
         * Non-template diagnostics related to the program itself. Does not include template
         * diagnostics because the template type checker memoizes them itself.
         *
         * This is set by (and memoizes) `getNonTemplateDiagnostics`.
         */
        this.nonTemplateDiagnostics = null;
        /**
         * `NgCompiler` can be reused for multiple compilations (for resource-only changes), and each
         * new compilation uses a fresh `PerfRecorder`. Thus, classes created with a lifespan of the
         * `NgCompiler` use a `DelegatingPerfRecorder` so the `PerfRecorder` they write to can be updated
         * with each fresh compilation.
         */
        this.delegatingPerfRecorder = new DelegatingPerfRecorder(this.perfRecorder);
        this.constructionDiagnostics.push(...this.adapter.constructionDiagnostics);
        const incompatibleTypeCheckOptionsDiagnostic = verifyCompatibleTypeCheckOptions(this.options);
        if (incompatibleTypeCheckOptionsDiagnostic !== null) {
            this.constructionDiagnostics.push(incompatibleTypeCheckOptionsDiagnostic);
        }
        this.currentProgram = inputProgram;
        this.closureCompilerEnabled = !!this.options.annotateForClosureCompiler;
        this.entryPoint =
            adapter.entryPoint !== null ? getSourceFileOrNull(inputProgram, adapter.entryPoint) : null;
        const moduleResolutionCache = ts.createModuleResolutionCache(this.adapter.getCurrentDirectory(), 
        // doen't retain a reference to `this`, if other closures in the constructor here reference
        // `this` internally then a closure created here would retain them. This can cause major
        // memory leak issues since the `moduleResolutionCache` is a long-lived object and finds its
        // way into all kinds of places inside TS internal objects.
        this.adapter.getCanonicalFileName.bind(this.adapter));
        this.moduleResolver =
            new ModuleResolver(inputProgram, this.options, this.adapter, moduleResolutionCache);
        this.resourceManager = new AdapterResourceLoader(adapter, this.options);
        this.cycleAnalyzer = new CycleAnalyzer(new ImportGraph(inputProgram.getTypeChecker(), this.delegatingPerfRecorder));
        this.incrementalStrategy.setIncrementalState(this.incrementalCompilation.state, inputProgram);
        this.ignoreForDiagnostics =
            new Set(inputProgram.getSourceFiles().filter(sf => this.adapter.isShim(sf)));
        this.ignoreForEmit = this.adapter.ignoreForEmit;
        let dtsFileCount = 0;
        let nonDtsFileCount = 0;
        for (const sf of inputProgram.getSourceFiles()) {
            if (sf.isDeclarationFile) {
                dtsFileCount++;
            }
            else {
                nonDtsFileCount++;
            }
        }
        livePerfRecorder.eventCount(PerfEvent.InputDtsFile, dtsFileCount);
        livePerfRecorder.eventCount(PerfEvent.InputTsFile, nonDtsFileCount);
    }
    /**
     * Convert a `CompilationTicket` into an `NgCompiler` instance for the requested compilation.
     *
     * Depending on the nature of the compilation request, the `NgCompiler` instance may be reused
     * from a previous compilation and updated with any changes, it may be a new instance which
     * incrementally reuses state from a previous compilation, or it may represent a fresh
     * compilation entirely.
     */
    static fromTicket(ticket, adapter) {
        switch (ticket.kind) {
            case CompilationTicketKind.Fresh:
                return new NgCompiler(adapter, ticket.options, ticket.tsProgram, ticket.programDriver, ticket.incrementalBuildStrategy, IncrementalCompilation.fresh(ticket.tsProgram, versionMapFromProgram(ticket.tsProgram, ticket.programDriver)), ticket.enableTemplateTypeChecker, ticket.usePoisonedData, ticket.perfRecorder);
            case CompilationTicketKind.IncrementalTypeScript:
                return new NgCompiler(adapter, ticket.options, ticket.newProgram, ticket.programDriver, ticket.incrementalBuildStrategy, ticket.incrementalCompilation, ticket.enableTemplateTypeChecker, ticket.usePoisonedData, ticket.perfRecorder);
            case CompilationTicketKind.IncrementalResource:
                const compiler = ticket.compiler;
                compiler.updateWithChangedResources(ticket.modifiedResourceFiles, ticket.perfRecorder);
                return compiler;
        }
    }
    get perfRecorder() {
        return this.livePerfRecorder;
    }
    /**
     * Exposes the `IncrementalCompilation` under an old property name that the CLI uses, avoiding a
     * chicken-and-egg problem with the rename to `incrementalCompilation`.
     *
     * TODO(alxhub): remove when the CLI uses the new name.
     */
    get incrementalDriver() {
        return this.incrementalCompilation;
    }
    updateWithChangedResources(changedResources, perfRecorder) {
        this.livePerfRecorder = perfRecorder;
        this.delegatingPerfRecorder.target = perfRecorder;
        perfRecorder.inPhase(PerfPhase.ResourceUpdate, () => {
            if (this.compilation === null) {
                // Analysis hasn't happened yet, so no update is necessary - any changes to resources will
                // be captured by the inital analysis pass itself.
                return;
            }
            this.resourceManager.invalidate();
            const classesToUpdate = new Set();
            for (const resourceFile of changedResources) {
                for (const templateClass of this.getComponentsWithTemplateFile(resourceFile)) {
                    classesToUpdate.add(templateClass);
                }
                for (const styleClass of this.getComponentsWithStyleFile(resourceFile)) {
                    classesToUpdate.add(styleClass);
                }
            }
            for (const clazz of classesToUpdate) {
                this.compilation.traitCompiler.updateResources(clazz);
                if (!ts.isClassDeclaration(clazz)) {
                    continue;
                }
                this.compilation.templateTypeChecker.invalidateClass(clazz);
            }
        });
    }
    /**
     * Get the resource dependencies of a file.
     *
     * If the file is not part of the compilation, an empty array will be returned.
     */
    getResourceDependencies(file) {
        this.ensureAnalyzed();
        return this.incrementalCompilation.depGraph.getResourceDependencies(file);
    }
    /**
     * Get all Angular-related diagnostics for this compilation.
     */
    getDiagnostics() {
        return this.addMessageTextDetails([...this.getNonTemplateDiagnostics(), ...this.getTemplateDiagnostics()]);
    }
    /**
     * Get all Angular-related diagnostics for this compilation.
     *
     * If a `ts.SourceFile` is passed, only diagnostics related to that file are returned.
     */
    getDiagnosticsForFile(file, optimizeFor) {
        return this.addMessageTextDetails([
            ...this.getNonTemplateDiagnostics().filter(diag => diag.file === file),
            ...this.getTemplateDiagnosticsForFile(file, optimizeFor)
        ]);
    }
    /**
     * Add Angular.io error guide links to diagnostics for this compilation.
     */
    addMessageTextDetails(diagnostics) {
        return diagnostics.map(diag => {
            if (diag.code && COMPILER_ERRORS_WITH_GUIDES.has(ngErrorCode(diag.code))) {
                return Object.assign(Object.assign({}, diag), { messageText: diag.messageText +
                        `. Find more at ${ERROR_DETAILS_PAGE_BASE_URL}/NG${ngErrorCode(diag.code)}` });
            }
            return diag;
        });
    }
    /**
     * Get all setup-related diagnostics for this compilation.
     */
    getOptionDiagnostics() {
        return this.constructionDiagnostics;
    }
    /**
     * Get the current `ts.Program` known to this `NgCompiler`.
     *
     * Compilation begins with an input `ts.Program`, and during template type-checking operations new
     * `ts.Program`s may be produced using the `ProgramDriver`. The most recent such `ts.Program` to
     * be produced is available here.
     *
     * This `ts.Program` serves two key purposes:
     *
     * * As an incremental starting point for creating the next `ts.Program` based on files that the
     *   user has changed (for clients using the TS compiler program APIs).
     *
     * * As the "before" point for an incremental compilation invocation, to determine what's changed
     *   between the old and new programs (for all compilations).
     */
    getCurrentProgram() {
        return this.currentProgram;
    }
    getTemplateTypeChecker() {
        if (!this.enableTemplateTypeChecker) {
            throw new Error('The `TemplateTypeChecker` does not work without `enableTemplateTypeChecker`.');
        }
        return this.ensureAnalyzed().templateTypeChecker;
    }
    /**
     * Retrieves the `ts.Declaration`s for any component(s) which use the given template file.
     */
    getComponentsWithTemplateFile(templateFilePath) {
        const { resourceRegistry } = this.ensureAnalyzed();
        return resourceRegistry.getComponentsWithTemplate(resolve(templateFilePath));
    }
    /**
     * Retrieves the `ts.Declaration`s for any component(s) which use the given template file.
     */
    getComponentsWithStyleFile(styleFilePath) {
        const { resourceRegistry } = this.ensureAnalyzed();
        return resourceRegistry.getComponentsWithStyle(resolve(styleFilePath));
    }
    /**
     * Retrieves external resources for the given component.
     */
    getComponentResources(classDecl) {
        if (!isNamedClassDeclaration(classDecl)) {
            return null;
        }
        const { resourceRegistry } = this.ensureAnalyzed();
        const styles = resourceRegistry.getStyles(classDecl);
        const template = resourceRegistry.getTemplate(classDecl);
        if (template === null) {
            return null;
        }
        return { styles, template };
    }
    getMeta(classDecl) {
        var _a;
        if (!isNamedClassDeclaration(classDecl)) {
            return null;
        }
        const ref = new Reference(classDecl);
        const { metaReader } = this.ensureAnalyzed();
        const meta = (_a = metaReader.getPipeMetadata(ref)) !== null && _a !== void 0 ? _a : metaReader.getDirectiveMetadata(ref);
        if (meta === null) {
            return null;
        }
        return meta;
    }
    /**
     * Perform Angular's analysis step (as a precursor to `getDiagnostics` or `prepareEmit`)
     * asynchronously.
     *
     * Normally, this operation happens lazily whenever `getDiagnostics` or `prepareEmit` are called.
     * However, certain consumers may wish to allow for an asynchronous phase of analysis, where
     * resources such as `styleUrls` are resolved asynchonously. In these cases `analyzeAsync` must be
     * called first, and its `Promise` awaited prior to calling any other APIs of `NgCompiler`.
     */
    analyzeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.compilation !== null) {
                return;
            }
            yield this.perfRecorder.inPhase(PerfPhase.Analysis, () => __awaiter(this, void 0, void 0, function* () {
                this.compilation = this.makeCompilation();
                const promises = [];
                for (const sf of this.inputProgram.getSourceFiles()) {
                    if (sf.isDeclarationFile) {
                        continue;
                    }
                    let analysisPromise = this.compilation.traitCompiler.analyzeAsync(sf);
                    if (analysisPromise !== undefined) {
                        promises.push(analysisPromise);
                    }
                }
                yield Promise.all(promises);
                this.perfRecorder.memory(PerfCheckpoint.Analysis);
                this.resolveCompilation(this.compilation.traitCompiler);
            }));
        });
    }
    /**
     * List lazy routes detected during analysis.
     *
     * This can be called for one specific route, or to retrieve all top-level routes.
     */
    listLazyRoutes(entryRoute) {
        if (entryRoute) {
            // htts://github.com/angular/angular/blob/50732e156/packages/compiler-cli/src/transformers/compiler_host.ts#L175-L188).
            //
            // `@angular/cli` will always call this API with an absolute path, so the resolution step is
            // not necessary, but keeping it backwards compatible in case someone else is using the API.
            // Relative entry paths are disallowed.
            if (entryRoute.startsWith('.')) {
                throw new Error(`Failed to list lazy routes: Resolution of relative paths (${entryRoute}) is not supported.`);
            }
            // Non-relative entry paths fall into one of the following categories:
            // - Absolute system paths (e.g. `/foo/bar/my-project/my-module`), which are unaffected by the
            //   logic below.
            // - Paths to enternal modules (e.g. `some-lib`).
            // - Paths mapped to directories in `tsconfig.json` (e.g. `shared/my-module`).
            //   (See https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping.)
            //
            // In all cases above, the `containingFile` argument is ignored, so we can just take the first
            // of the root files.
            const containingFile = this.inputProgram.getRootFileNames()[0];
            const [entryPath, moduleName] = entryRoute.split('#');
            const resolvedModule = resolveModuleName(entryPath, containingFile, this.options, this.adapter, null);
            if (resolvedModule) {
                entryRoute = entryPointKeyFor(resolvedModule.resolvedFileName, moduleName);
            }
        }
        const compilation = this.ensureAnalyzed();
        return compilation.routeAnalyzer.listLazyRoutes(entryRoute);
    }
    /**
     * Fetch transformers and other information which is necessary for a consumer to `emit` the
     * program with Angular-added definitions.
     */
    prepareEmit() {
        const compilation = this.ensureAnalyzed();
        const coreImportsFrom = compilation.isCore ? getR3SymbolsFile(this.inputProgram) : null;
        let importRewriter;
        if (coreImportsFrom !== null) {
            importRewriter = new R3SymbolsImportRewriter(coreImportsFrom.fileName);
        }
        else {
            importRewriter = new NoopImportRewriter();
        }
        const defaultImportTracker = new DefaultImportTracker();
        const before = [
            ivyTransformFactory(compilation.traitCompiler, compilation.reflector, importRewriter, defaultImportTracker, this.delegatingPerfRecorder, compilation.isCore, this.closureCompilerEnabled),
            aliasTransformFactory(compilation.traitCompiler.exportStatements),
            defaultImportTracker.importPreservingTransformer(),
        ];
        const afterDeclarations = [];
        if (compilation.dtsTransforms !== null) {
            afterDeclarations.push(declarationTransformFactory(compilation.dtsTransforms, importRewriter));
        }
        // Only add aliasing re-exports to the .d.ts output if the `AliasingHost` requests it.
        if (compilation.aliasingHost !== null && compilation.aliasingHost.aliasExportsInDts) {
            afterDeclarations.push(aliasTransformFactory(compilation.traitCompiler.exportStatements));
        }
        if (this.adapter.factoryTracker !== null) {
            before.push(generatedFactoryTransform(this.adapter.factoryTracker.sourceInfo, importRewriter));
        }
        before.push(ivySwitchTransform);
        return { transformers: { before, afterDeclarations } };
    }
    /**
     * Run the indexing process and return a `Map` of all indexed components.
     *
     * See the `indexing` package for more details.
     */
    getIndexedComponents() {
        const compilation = this.ensureAnalyzed();
        const context = new IndexingContext();
        compilation.traitCompiler.index(context);
        return generateAnalysis(context);
    }
    /**
     * Collect i18n messages into the `Xi18nContext`.
     */
    xi18n(ctx) {
        // Note that the 'resolve' phase is not strictly necessary for xi18n, but this is not currently
        // optimized.
        const compilation = this.ensureAnalyzed();
        compilation.traitCompiler.xi18n(ctx);
    }
    ensureAnalyzed() {
        if (this.compilation === null) {
            this.analyzeSync();
        }
        return this.compilation;
    }
    analyzeSync() {
        this.perfRecorder.inPhase(PerfPhase.Analysis, () => {
            this.compilation = this.makeCompilation();
            for (const sf of this.inputProgram.getSourceFiles()) {
                if (sf.isDeclarationFile) {
                    continue;
                }
                this.compilation.traitCompiler.analyzeSync(sf);
            }
            this.perfRecorder.memory(PerfCheckpoint.Analysis);
            this.resolveCompilation(this.compilation.traitCompiler);
        });
    }
    resolveCompilation(traitCompiler) {
        this.perfRecorder.inPhase(PerfPhase.Resolve, () => {
            traitCompiler.resolve();
            // At this point, analysis is complete and the compiler can now calculate which files need to
            // be emitted, so do that.
            this.incrementalCompilation.recordSuccessfulAnalysis(traitCompiler);
            this.perfRecorder.memory(PerfCheckpoint.Resolve);
        });
    }
    get fullTemplateTypeCheck() {
        // Determine the strictness level of type checking based on compiler options. As
        // `strictTemplates` is a superset of `fullTemplateTypeCheck`, the former implies the latter.
        // Also see `verifyCompatibleTypeCheckOptions` where it is verified that `fullTemplateTypeCheck`
        // is not disabled when `strictTemplates` is enabled.
        const strictTemplates = !!this.options.strictTemplates;
        return strictTemplates || !!this.options.fullTemplateTypeCheck;
    }
    getTypeCheckingConfig() {
        // Determine the strictness level of type checking based on compiler options. As
        // `strictTemplates` is a superset of `fullTemplateTypeCheck`, the former implies the latter.
        // Also see `verifyCompatibleTypeCheckOptions` where it is verified that `fullTemplateTypeCheck`
        // is not disabled when `strictTemplates` is enabled.
        const strictTemplates = !!this.options.strictTemplates;
        const useInlineTypeConstructors = this.programDriver.supportsInlineOperations;
        // First select a type-checking configuration, based on whether full template type-checking is
        // requested.
        let typeCheckingConfig;
        if (this.fullTemplateTypeCheck) {
            typeCheckingConfig = {
                applyTemplateContextGuards: strictTemplates,
                checkQueries: false,
                checkTemplateBodies: true,
                alwaysCheckSchemaInTemplateBodies: true,
                checkTypeOfInputBindings: strictTemplates,
                honorAccessModifiersForInputBindings: false,
                strictNullInputBindings: strictTemplates,
                checkTypeOfAttributes: strictTemplates,
                // Even in full template type-checking mode, DOM binding checks are not quite ready yet.
                checkTypeOfDomBindings: false,
                checkTypeOfOutputEvents: strictTemplates,
                checkTypeOfAnimationEvents: strictTemplates,
                // Checking of DOM events currently has an adverse effect on developer experience,
                // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
                // - error TS2531: Object is possibly 'null'.
                // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
                checkTypeOfDomEvents: strictTemplates,
                checkTypeOfDomReferences: strictTemplates,
                // Non-DOM references have the correct type in View Engine so there is no strictness flag.
                checkTypeOfNonDomReferences: true,
                // Pipes are checked in View Engine so there is no strictness flag.
                checkTypeOfPipes: true,
                strictSafeNavigationTypes: strictTemplates,
                useContextGenericType: strictTemplates,
                strictLiteralTypes: true,
                enableTemplateTypeChecker: this.enableTemplateTypeChecker,
                useInlineTypeConstructors,
                // Warnings for suboptimal type inference are only enabled if in Language Service mode
                // (providing the full TemplateTypeChecker API) and if strict mode is not enabled. In strict
                // mode, the user is in full control of type inference.
                suggestionsForSuboptimalTypeInference: this.enableTemplateTypeChecker && !strictTemplates,
            };
        }
        else {
            typeCheckingConfig = {
                applyTemplateContextGuards: false,
                checkQueries: false,
                checkTemplateBodies: false,
                // Enable deep schema checking in "basic" template type-checking mode only if Closure
                // compilation is requested, which is a good proxy for "only in google3".
                alwaysCheckSchemaInTemplateBodies: this.closureCompilerEnabled,
                checkTypeOfInputBindings: false,
                strictNullInputBindings: false,
                honorAccessModifiersForInputBindings: false,
                checkTypeOfAttributes: false,
                checkTypeOfDomBindings: false,
                checkTypeOfOutputEvents: false,
                checkTypeOfAnimationEvents: false,
                checkTypeOfDomEvents: false,
                checkTypeOfDomReferences: false,
                checkTypeOfNonDomReferences: false,
                checkTypeOfPipes: false,
                strictSafeNavigationTypes: false,
                useContextGenericType: false,
                strictLiteralTypes: false,
                enableTemplateTypeChecker: this.enableTemplateTypeChecker,
                useInlineTypeConstructors,
                // In "basic" template type-checking mode, no warnings are produced since most things are
                // not checked anyways.
                suggestionsForSuboptimalTypeInference: false,
            };
        }
        // Apply explicitly configured strictness flags on top of the default configuration
        // based on "fullTemplateTypeCheck".
        if (this.options.strictInputTypes !== undefined) {
            typeCheckingConfig.checkTypeOfInputBindings = this.options.strictInputTypes;
            typeCheckingConfig.applyTemplateContextGuards = this.options.strictInputTypes;
        }
        if (this.options.strictInputAccessModifiers !== undefined) {
            typeCheckingConfig.honorAccessModifiersForInputBindings =
                this.options.strictInputAccessModifiers;
        }
        if (this.options.strictNullInputTypes !== undefined) {
            typeCheckingConfig.strictNullInputBindings = this.options.strictNullInputTypes;
        }
        if (this.options.strictOutputEventTypes !== undefined) {
            typeCheckingConfig.checkTypeOfOutputEvents = this.options.strictOutputEventTypes;
            typeCheckingConfig.checkTypeOfAnimationEvents = this.options.strictOutputEventTypes;
        }
        if (this.options.strictDomEventTypes !== undefined) {
            typeCheckingConfig.checkTypeOfDomEvents = this.options.strictDomEventTypes;
        }
        if (this.options.strictSafeNavigationTypes !== undefined) {
            typeCheckingConfig.strictSafeNavigationTypes = this.options.strictSafeNavigationTypes;
        }
        if (this.options.strictDomLocalRefTypes !== undefined) {
            typeCheckingConfig.checkTypeOfDomReferences = this.options.strictDomLocalRefTypes;
        }
        if (this.options.strictAttributeTypes !== undefined) {
            typeCheckingConfig.checkTypeOfAttributes = this.options.strictAttributeTypes;
        }
        if (this.options.strictContextGenerics !== undefined) {
            typeCheckingConfig.useContextGenericType = this.options.strictContextGenerics;
        }
        if (this.options.strictLiteralTypes !== undefined) {
            typeCheckingConfig.strictLiteralTypes = this.options.strictLiteralTypes;
        }
        return typeCheckingConfig;
    }
    getTemplateDiagnostics() {
        const compilation = this.ensureAnalyzed();
        // Get the diagnostics.
        const diagnostics = [];
        for (const sf of this.inputProgram.getSourceFiles()) {
            if (sf.isDeclarationFile || this.adapter.isShim(sf)) {
                continue;
            }
            diagnostics.push(...compilation.templateTypeChecker.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram));
        }
        const program = this.programDriver.getProgram();
        this.incrementalStrategy.setIncrementalState(this.incrementalCompilation.state, program);
        this.currentProgram = program;
        return diagnostics;
    }
    getTemplateDiagnosticsForFile(sf, optimizeFor) {
        const compilation = this.ensureAnalyzed();
        // Get the diagnostics.
        const diagnostics = [];
        if (!sf.isDeclarationFile && !this.adapter.isShim(sf)) {
            diagnostics.push(...compilation.templateTypeChecker.getDiagnosticsForFile(sf, optimizeFor));
        }
        const program = this.programDriver.getProgram();
        this.incrementalStrategy.setIncrementalState(this.incrementalCompilation.state, program);
        this.currentProgram = program;
        return diagnostics;
    }
    getNonTemplateDiagnostics() {
        if (this.nonTemplateDiagnostics === null) {
            const compilation = this.ensureAnalyzed();
            this.nonTemplateDiagnostics = [...compilation.traitCompiler.diagnostics];
            if (this.entryPoint !== null && compilation.exportReferenceGraph !== null) {
                this.nonTemplateDiagnostics.push(...checkForPrivateExports(this.entryPoint, this.inputProgram.getTypeChecker(), compilation.exportReferenceGraph));
            }
        }
        return this.nonTemplateDiagnostics;
    }
    makeCompilation() {
        const checker = this.inputProgram.getTypeChecker();
        const reflector = new TypeScriptReflectionHost(checker);
        // Construct the ReferenceEmitter.
        let refEmitter;
        let aliasingHost = null;
        if (this.adapter.unifiedModulesHost === null || !this.options._useHostForImportGeneration) {
            let localImportStrategy;
            // The strategy used for local, in-project imports depends on whether TS has been configured
            // with rootDirs. If so, then multiple directories may be mapped in the same "module
            // namespace" and the logic of `LogicalProjectStrategy` is required to generate correct
            // imports which may cross these multiple directories. Otherwise, plain relative imports are
            // sufficient.
            if (this.options.rootDir !== undefined ||
                (this.options.rootDirs !== undefined && this.options.rootDirs.length > 0)) {
                // rootDirs logic is in effect - use the `LogicalProjectStrategy` for in-project relative
                // imports.
                localImportStrategy = new LogicalProjectStrategy(reflector, new LogicalFileSystem([...this.adapter.rootDirs], this.adapter));
            }
            else {
                // Plain relative imports are all that's needed.
                localImportStrategy = new RelativePathStrategy(reflector);
            }
            // The CompilerHost doesn't have fileNameToModuleName, so build an NPM-centric reference
            // resolution strategy.
            refEmitter = new ReferenceEmitter([
                // First, try to use local identifiers if available.
                new LocalIdentifierStrategy(),
                // Next, attempt to use an absolute import.
                new AbsoluteModuleStrategy(this.inputProgram, checker, this.moduleResolver, reflector),
                // Finally, check if the reference is being written into a file within the project's .ts
                // sources, and use a relative import if so. If this fails, ReferenceEmitter will throw
                // an error.
                localImportStrategy,
            ]);
            // If an entrypoint is present, then all user imports should be directed through the
            // entrypoint and private exports are not needed. The compiler will validate that all publicly
            // visible directives/pipes are importable via this entrypoint.
            if (this.entryPoint === null && this.options.generateDeepReexports === true) {
                // No entrypoint is present and deep re-exports were requested, so configure the aliasing
                // system to generate them.
                aliasingHost = new PrivateExportAliasingHost(reflector);
            }
        }
        else {
            // The CompilerHost supports fileNameToModuleName, so use that to emit imports.
            refEmitter = new ReferenceEmitter([
                // First, try to use local identifiers if available.
                new LocalIdentifierStrategy(),
                // Then use aliased references (this is a workaround to StrictDeps checks).
                new AliasStrategy(),
                // Then use fileNameToModuleName to emit imports.
                new UnifiedModulesStrategy(reflector, this.adapter.unifiedModulesHost),
            ]);
            aliasingHost = new UnifiedModulesAliasingHost(this.adapter.unifiedModulesHost);
        }
        const evaluator = new PartialEvaluator(reflector, checker, this.incrementalCompilation.depGraph);
        const dtsReader = new DtsMetadataReader(checker, reflector);
        const localMetaRegistry = new LocalMetadataRegistry();
        const localMetaReader = localMetaRegistry;
        const depScopeReader = new MetadataDtsModuleScopeResolver(dtsReader, aliasingHost);
        const scopeRegistry = new LocalModuleScopeRegistry(localMetaReader, depScopeReader, refEmitter, aliasingHost);
        const scopeReader = scopeRegistry;
        const semanticDepGraphUpdater = this.incrementalCompilation.semanticDepGraphUpdater;
        const metaRegistry = new CompoundMetadataRegistry([localMetaRegistry, scopeRegistry]);
        const injectableRegistry = new InjectableClassRegistry(reflector);
        const metaReader = new CompoundMetadataReader([localMetaReader, dtsReader]);
        const typeCheckScopeRegistry = new TypeCheckScopeRegistry(scopeReader, metaReader);
        // If a flat module entrypoint was specified, then track references via a `ReferenceGraph` in
        // order to produce proper diagnostics for incorrectly exported directives/pipes/etc. If there
        // is no flat module entrypoint then don't pay the cost of tracking references.
        let referencesRegistry;
        let exportReferenceGraph = null;
        if (this.entryPoint !== null) {
            exportReferenceGraph = new ReferenceGraph();
            referencesRegistry = new ReferenceGraphAdapter(exportReferenceGraph);
        }
        else {
            referencesRegistry = new NoopReferencesRegistry();
        }
        const routeAnalyzer = new NgModuleRouteAnalyzer(this.moduleResolver, evaluator);
        const dtsTransforms = new DtsTransformRegistry();
        const isCore = isAngularCorePackage(this.inputProgram);
        const resourceRegistry = new ResourceRegistry();
        const compilationMode = this.options.compilationMode === 'partial' ? CompilationMode.PARTIAL : CompilationMode.FULL;
        // Cycles are handled in full compilation mode by "remote scoping".
        // "Remote scoping" does not work well with tree shaking for libraries.
        // So in partial compilation mode, when building a library, a cycle will cause an error.
        const cycleHandlingStrategy = compilationMode === CompilationMode.FULL ?
            0 /* UseRemoteScoping */ :
            1 /* Error */;
        // Set up the IvyCompilation, which manages state for the Ivy transformer.
        const handlers = [
            new ComponentDecoratorHandler(reflector, evaluator, metaRegistry, metaReader, scopeReader, scopeRegistry, typeCheckScopeRegistry, resourceRegistry, isCore, this.resourceManager, this.adapter.rootDirs, this.options.preserveWhitespaces || false, this.options.i18nUseExternalIds !== false, this.options.enableI18nLegacyMessageIdFormat !== false, this.usePoisonedData, this.options.i18nNormalizeLineEndingsInICUs, this.moduleResolver, this.cycleAnalyzer, cycleHandlingStrategy, refEmitter, this.incrementalCompilation.depGraph, injectableRegistry, semanticDepGraphUpdater, this.closureCompilerEnabled, this.delegatingPerfRecorder),
            // TODO(alxhub): understand why the cast here is necessary (something to do with `null`
            // not being assignable to `unknown` when wrapped in `Readonly`).
            // clang-format off
            new DirectiveDecoratorHandler(reflector, evaluator, metaRegistry, scopeRegistry, metaReader, injectableRegistry, isCore, semanticDepGraphUpdater, this.closureCompilerEnabled, compileUndecoratedClassesWithAngularFeatures, this.delegatingPerfRecorder),
            // clang-format on
            // Pipe handler must be before injectable handler in list so pipe factories are printed
            // before injectable factories (so injectable factories can delegate to them)
            new PipeDecoratorHandler(reflector, evaluator, metaRegistry, scopeRegistry, injectableRegistry, isCore, this.delegatingPerfRecorder),
            new InjectableDecoratorHandler(reflector, isCore, this.options.strictInjectionParameters || false, injectableRegistry, this.delegatingPerfRecorder),
            new NgModuleDecoratorHandler(reflector, evaluator, metaReader, metaRegistry, scopeRegistry, referencesRegistry, isCore, routeAnalyzer, refEmitter, this.adapter.factoryTracker, this.closureCompilerEnabled, injectableRegistry, this.delegatingPerfRecorder, this.options.i18nInLocale),
        ];
        const traitCompiler = new TraitCompiler(handlers, reflector, this.delegatingPerfRecorder, this.incrementalCompilation, this.options.compileNonExportedClasses !== false, compilationMode, dtsTransforms, semanticDepGraphUpdater);
        // Template type-checking may use the `ProgramDriver` to produce new `ts.Program`(s). If this
        // happens, they need to be tracked by the `NgCompiler`.
        const notifyingDriver = new NotifyingProgramDriverWrapper(this.programDriver, (program) => {
            this.incrementalStrategy.setIncrementalState(this.incrementalCompilation.state, program);
            this.currentProgram = program;
        });
        const templateTypeChecker = new TemplateTypeCheckerImpl(this.inputProgram, notifyingDriver, traitCompiler, this.getTypeCheckingConfig(), refEmitter, reflector, this.adapter, this.incrementalCompilation, scopeRegistry, typeCheckScopeRegistry, this.delegatingPerfRecorder);
        return {
            isCore,
            traitCompiler,
            reflector,
            scopeRegistry,
            dtsTransforms,
            exportReferenceGraph,
            routeAnalyzer,
            metaReader,
            typeCheckScopeRegistry,
            aliasingHost,
            refEmitter,
            templateTypeChecker,
            resourceRegistry,
        };
    }
}
/**
 * Determine if the given `Program` is @angular/core.
 */
export function isAngularCorePackage(program) {
    // Look for its_just_angular.ts somewhere in the program.
    const r3Symbols = getR3SymbolsFile(program);
    if (r3Symbols === null) {
        return false;
    }
    // Look for the constant ITS_JUST_ANGULAR in that file.
    return r3Symbols.statements.some(stmt => {
        // The statement must be a variable declaration statement.
        if (!ts.isVariableStatement(stmt)) {
            return false;
        }
        // It must be exported.
        if (stmt.modifiers === undefined ||
            !stmt.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
            return false;
        }
        // It must declare ITS_JUST_ANGULAR.
        return stmt.declarationList.declarations.some(decl => {
            // The declaration must match the name.
            if (!ts.isIdentifier(decl.name) || decl.name.text !== 'ITS_JUST_ANGULAR') {
                return false;
            }
            // It must initialize the variable to true.
            if (decl.initializer === undefined || decl.initializer.kind !== ts.SyntaxKind.TrueKeyword) {
                return false;
            }
            // This definition matches.
            return true;
        });
    });
}
/**
 * Find the 'r3_symbols.ts' file in the given `Program`, or return `null` if it wasn't there.
 */
function getR3SymbolsFile(program) {
    return program.getSourceFiles().find(file => file.fileName.indexOf('r3_symbols.ts') >= 0) || null;
}
/**
 * Since "strictTemplates" is a true superset of type checking capabilities compared to
 * "fullTemplateTypeCheck", it is required that the latter is not explicitly disabled if the
 * former is enabled.
 */
function verifyCompatibleTypeCheckOptions(options) {
    if (options.fullTemplateTypeCheck === false && options.strictTemplates === true) {
        return {
            category: ts.DiagnosticCategory.Error,
            code: ngErrorCode(ErrorCode.CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK),
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: `Angular compiler option "strictTemplates" is enabled, however "fullTemplateTypeCheck" is disabled.

Having the "strictTemplates" flag enabled implies that "fullTemplateTypeCheck" is also enabled, so
the latter can not be explicitly disabled.

One of the following actions is required:
1. Remove the "fullTemplateTypeCheck" option.
2. Remove "strictTemplates" or set it to 'false'.

More information about the template type checking compiler options can be found in the documentation:
https://v9.angular.io/guide/template-typecheck#template-type-checking`,
        };
    }
    return null;
}
class ReferenceGraphAdapter {
    constructor(graph) {
        this.graph = graph;
    }
    add(source, ...references) {
        for (const { node } of references) {
            let sourceFile = node.getSourceFile();
            if (sourceFile === undefined) {
                sourceFile = ts.getOriginalNode(node).getSourceFile();
            }
            // Only record local references (not references into .d.ts files).
            if (sourceFile === undefined || !isDtsPath(sourceFile.fileName)) {
                this.graph.add(source, node);
            }
        }
    }
}
class NotifyingProgramDriverWrapper {
    constructor(delegate, notifyNewProgram) {
        var _a;
        this.delegate = delegate;
        this.notifyNewProgram = notifyNewProgram;
        this.getSourceFileVersion = (_a = this.delegate.getSourceFileVersion) === null || _a === void 0 ? void 0 : _a.bind(this);
    }
    get supportsInlineOperations() {
        return this.delegate.supportsInlineOperations;
    }
    getProgram() {
        return this.delegate.getProgram();
    }
    updateFiles(contents, updateMode) {
        this.delegate.updateFiles(contents, updateMode);
        this.notifyNewProgram(this.delegate.getProgram());
    }
}
function versionMapFromProgram(program, driver) {
    if (driver.getSourceFileVersion === undefined) {
        return null;
    }
    const versions = new Map();
    for (const possiblyRedirectedSourceFile of program.getSourceFiles()) {
        const sf = toUnredirectedSourceFile(possiblyRedirectedSourceFile);
        versions.set(absoluteFromSourceFile(sf), driver.getSourceFileVersion(sf));
    }
    return versions;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2NvcmUvc3JjL2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMseUJBQXlCLEVBQUUseUJBQXlCLEVBQUUsMEJBQTBCLEVBQUUsd0JBQXdCLEVBQUUsc0JBQXNCLEVBQUUsb0JBQW9CLEVBQXFCLE1BQU0sbUJBQW1CLENBQUM7QUFDL00sT0FBTyxFQUFDLGFBQWEsRUFBeUIsV0FBVyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQy9FLE9BQU8sRUFBQywyQkFBMkIsRUFBRSwyQkFBMkIsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDbkgsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3pFLE9BQU8sRUFBQyxzQkFBc0IsRUFBa0IsaUJBQWlCLEVBQUUsT0FBTyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDckcsT0FBTyxFQUFDLHNCQUFzQixFQUFnQixhQUFhLEVBQUUsb0JBQW9CLEVBQWtCLHVCQUF1QixFQUFFLHNCQUFzQixFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSx5QkFBeUIsRUFBRSx1QkFBdUIsRUFBRSxTQUFTLEVBQXlCLGdCQUFnQixFQUFFLG9CQUFvQixFQUFFLDBCQUEwQixFQUFFLHNCQUFzQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQy9YLE9BQU8sRUFBMkIsc0JBQXNCLEVBQW1CLE1BQU0sbUJBQW1CLENBQUM7QUFFckcsT0FBTyxFQUFDLGdCQUFnQixFQUFvQixlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDbEYsT0FBTyxFQUFxQixzQkFBc0IsRUFB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O1FBZTVGLHlCQUFvQixHQUFHLE1BQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsMENBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBZnlCLENBQUM7SUFFaEcsSUFBSSx3QkFBd0I7UUFDMUIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLHdCQUF3QixDQUFDO0lBQ2hELENBQUM7SUFFRCxVQUFVO1FBQ1IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFFRCxXQUFXLENBQUMsUUFBcUMsRUFBRSxVQUFzQjtRQUN2RSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNwRCxDQUFDO0NBR0Y7QUFFRCxTQUFTLHFCQUFxQixDQUMxQixPQUFtQixFQUFFLE1BQXFCO0lBQzVDLElBQUksTUFBTSxDQUFDLG9CQUFvQixLQUFLLFNBQVMsRUFBRTtRQUM3QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7SUFDbkQsS0FBSyxNQUFNLDRCQUE0QixJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtRQUNuRSxNQUFNLEVBQUUsR0FBRyx3QkFBd0IsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ2xFLFFBQVEsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDM0U7SUFDRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0NvbXBvbmVudERlY29yYXRvckhhbmRsZXIsIERpcmVjdGl2ZURlY29yYXRvckhhbmRsZXIsIEluamVjdGFibGVEZWNvcmF0b3JIYW5kbGVyLCBOZ01vZHVsZURlY29yYXRvckhhbmRsZXIsIE5vb3BSZWZlcmVuY2VzUmVnaXN0cnksIFBpcGVEZWNvcmF0b3JIYW5kbGVyLCBSZWZlcmVuY2VzUmVnaXN0cnl9IGZyb20gJy4uLy4uL2Fubm90YXRpb25zJztcbmltcG9ydCB7Q3ljbGVBbmFseXplciwgQ3ljbGVIYW5kbGluZ1N0cmF0ZWd5LCBJbXBvcnRHcmFwaH0gZnJvbSAnLi4vLi4vY3ljbGVzJztcbmltcG9ydCB7Q09NUElMRVJfRVJST1JTX1dJVEhfR1VJREVTLCBFUlJPUl9ERVRBSUxTX1BBR0VfQkFTRV9VUkwsIEVycm9yQ29kZSwgbmdFcnJvckNvZGV9IGZyb20gJy4uLy4uL2RpYWdub3N0aWNzJztcbmltcG9ydCB7Y2hlY2tGb3JQcml2YXRlRXhwb3J0cywgUmVmZXJlbmNlR3JhcGh9IGZyb20gJy4uLy4uL2VudHJ5X3BvaW50JztcbmltcG9ydCB7YWJzb2x1dGVGcm9tU291cmNlRmlsZSwgQWJzb2x1dGVGc1BhdGgsIExvZ2ljYWxGaWxlU3lzdGVtLCByZXNvbHZlfSBmcm9tICcuLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0Fic29sdXRlTW9kdWxlU3RyYXRlZ3ksIEFsaWFzaW5nSG9zdCwgQWxpYXNTdHJhdGVneSwgRGVmYXVsdEltcG9ydFRyYWNrZXIsIEltcG9ydFJld3JpdGVyLCBMb2NhbElkZW50aWZpZXJTdHJhdGVneSwgTG9naWNhbFByb2plY3RTdHJhdGVneSwgTW9kdWxlUmVzb2x2ZXIsIE5vb3BJbXBvcnRSZXdyaXRlciwgUHJpdmF0ZUV4cG9ydEFsaWFzaW5nSG9zdCwgUjNTeW1ib2xzSW1wb3J0UmV3cml0ZXIsIFJlZmVyZW5jZSwgUmVmZXJlbmNlRW1pdFN0cmF0ZWd5LCBSZWZlcmVuY2VFbWl0dGVyLCBSZWxhdGl2ZVBhdGhTdHJhdGVneSwgVW5pZmllZE1vZHVsZXNBbGlhc2luZ0hvc3QsIFVuaWZpZWRNb2R1bGVzU3RyYXRlZ3l9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtJbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksIEluY3JlbWVudGFsQ29tcGlsYXRpb24sIEluY3JlbWVudGFsU3RhdGV9IGZyb20gJy4uLy4uL2luY3JlbWVudGFsJztcbmltcG9ydCB7U2VtYW50aWNTeW1ib2x9IGZyb20gJy4uLy4uL2luY3JlbWVudGFsL3NlbWFudGljX2dyYXBoJztcbmltcG9ydCB7Z2VuZXJhdGVBbmFseXNpcywgSW5kZXhlZENvbXBvbmVudCwgSW5kZXhpbmdDb250ZXh0fSBmcm9tICcuLi8uLi9pbmRleGVyJztcbmltcG9ydCB7Q29tcG9uZW50UmVzb3VyY2VzLCBDb21wb3VuZE1ldGFkYXRhUmVhZGVyLCBDb21wb3VuZE1ldGFkYXRhUmVnaXN0cnksIERpcmVjdGl2ZU1ldGEsIER0c01ldGFkYXRhUmVhZGVyLCBJbmplY3RhYmxlQ2xhc3NSZWdpc3RyeSwgTG9jYWxNZXRhZGF0YVJlZ2lzdHJ5LCBNZXRhZGF0YVJlYWRlciwgUGlwZU1ldGEsIFJlc291cmNlUmVnaXN0cnl9IGZyb20gJy4uLy4uL21ldGFkYXRhJztcbmltcG9ydCB7UGFydGlhbEV2YWx1YXRvcn0gZnJvbSAnLi4vLi4vcGFydGlhbF9ldmFsdWF0b3InO1xuaW1wb3J0IHtBY3RpdmVQZXJmUmVjb3JkZXIsIERlbGVnYXRpbmdQZXJmUmVjb3JkZXIsIFBlcmZDaGVja3BvaW50LCBQZXJmRXZlbnQsIFBlcmZQaGFzZX0gZnJvbSAnLi4vLi4vcGVyZic7XG5pbXBvcnQge1Byb2dyYW1Ecml2ZXIsIFVwZGF0ZU1vZGV9IGZyb20gJy4uLy4uL3Byb2dyYW1fZHJpdmVyJztcbmltcG9ydCB7RGVjbGFyYXRpb25Ob2RlLCBpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbiwgVHlwZVNjcmlwdFJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7QWRhcHRlclJlc291cmNlTG9hZGVyfSBmcm9tICcuLi8uLi9yZXNvdXJjZSc7XG5pbXBvcnQge2VudHJ5UG9pbnRLZXlGb3IsIE5nTW9kdWxlUm91dGVBbmFseXplcn0gZnJvbSAnLi4vLi4vcm91dGluZyc7XG5pbXBvcnQge0NvbXBvbmVudFNjb3BlUmVhZGVyLCBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnksIE1ldGFkYXRhRHRzTW9kdWxlU2NvcGVSZXNvbHZlciwgVHlwZUNoZWNrU2NvcGVSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtnZW5lcmF0ZWRGYWN0b3J5VHJhbnNmb3JtfSBmcm9tICcuLi8uLi9zaGltcyc7XG5pbXBvcnQge2l2eVN3aXRjaFRyYW5zZm9ybX0gZnJvbSAnLi4vLi4vc3dpdGNoJztcbmltcG9ydCB7YWxpYXNUcmFuc2Zvcm1GYWN0b3J5LCBDb21waWxhdGlvbk1vZGUsIGRlY2xhcmF0aW9uVHJhbnNmb3JtRmFjdG9yeSwgRGVjb3JhdG9ySGFuZGxlciwgRHRzVHJhbnNmb3JtUmVnaXN0cnksIGl2eVRyYW5zZm9ybUZhY3RvcnksIFRyYWl0Q29tcGlsZXJ9IGZyb20gJy4uLy4uL3RyYW5zZm9ybSc7XG5pbXBvcnQge1RlbXBsYXRlVHlwZUNoZWNrZXJJbXBsfSBmcm9tICcuLi8uLi90eXBlY2hlY2snO1xuaW1wb3J0IHtPcHRpbWl6ZUZvciwgVGVtcGxhdGVUeXBlQ2hlY2tlciwgVHlwZUNoZWNraW5nQ29uZmlnfSBmcm9tICcuLi8uLi90eXBlY2hlY2svYXBpJztcbmltcG9ydCB7Z2V0U291cmNlRmlsZU9yTnVsbCwgaXNEdHNQYXRoLCByZXNvbHZlTW9kdWxlTmFtZSwgdG9VbnJlZGlyZWN0ZWRTb3VyY2VGaWxlfSBmcm9tICcuLi8uLi91dGlsL3NyYy90eXBlc2NyaXB0JztcbmltcG9ydCB7WGkxOG5Db250ZXh0fSBmcm9tICcuLi8uLi94aTE4bic7XG5pbXBvcnQge0xhenlSb3V0ZSwgTmdDb21waWxlckFkYXB0ZXIsIE5nQ29tcGlsZXJPcHRpb25zfSBmcm9tICcuLi9hcGknO1xuXG5pbXBvcnQge2NvbXBpbGVVbmRlY29yYXRlZENsYXNzZXNXaXRoQW5ndWxhckZlYXR1cmVzfSBmcm9tICcuL2NvbmZpZyc7XG5cbi8qKlxuICogU3RhdGUgaW5mb3JtYXRpb24gYWJvdXQgYSBjb21waWxhdGlvbiB3aGljaCBpcyBvbmx5IGdlbmVyYXRlZCBvbmNlIHNvbWUgZGF0YSBpcyByZXF1ZXN0ZWQgZnJvbVxuICogdGhlIGBOZ0NvbXBpbGVyYCAoZm9yIGV4YW1wbGUsIGJ5IGNhbGxpbmcgYGdldERpYWdub3N0aWNzYCkuXG4gKi9cbmludGVyZmFjZSBMYXp5Q29tcGlsYXRpb25TdGF0ZSB7XG4gIGlzQ29yZTogYm9vbGVhbjtcbiAgdHJhaXRDb21waWxlcjogVHJhaXRDb21waWxlcjtcbiAgcmVmbGVjdG9yOiBUeXBlU2NyaXB0UmVmbGVjdGlvbkhvc3Q7XG4gIG1ldGFSZWFkZXI6IE1ldGFkYXRhUmVhZGVyO1xuICBzY29wZVJlZ2lzdHJ5OiBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnk7XG4gIHR5cGVDaGVja1Njb3BlUmVnaXN0cnk6IFR5cGVDaGVja1Njb3BlUmVnaXN0cnk7XG4gIGV4cG9ydFJlZmVyZW5jZUdyYXBoOiBSZWZlcmVuY2VHcmFwaHxudWxsO1xuICByb3V0ZUFuYWx5emVyOiBOZ01vZHVsZVJvdXRlQW5hbHl6ZXI7XG4gIGR0c1RyYW5zZm9ybXM6IER0c1RyYW5zZm9ybVJlZ2lzdHJ5O1xuICBhbGlhc2luZ0hvc3Q6IEFsaWFzaW5nSG9zdHxudWxsO1xuICByZWZFbWl0dGVyOiBSZWZlcmVuY2VFbWl0dGVyO1xuICB0ZW1wbGF0ZVR5cGVDaGVja2VyOiBUZW1wbGF0ZVR5cGVDaGVja2VyO1xuICByZXNvdXJjZVJlZ2lzdHJ5OiBSZXNvdXJjZVJlZ2lzdHJ5O1xufVxuXG5cblxuLyoqXG4gKiBEaXNjcmltaW5hbnQgdHlwZSBmb3IgYSBgQ29tcGlsYXRpb25UaWNrZXRgLlxuICovXG5leHBvcnQgZW51bSBDb21waWxhdGlvblRpY2tldEtpbmQge1xuICBGcmVzaCxcbiAgSW5jcmVtZW50YWxUeXBlU2NyaXB0LFxuICBJbmNyZW1lbnRhbFJlc291cmNlLFxufVxuXG4vKipcbiAqIEJlZ2luIGFuIEFuZ3VsYXIgY29tcGlsYXRpb24gb3BlcmF0aW9uIGZyb20gc2NyYXRjaC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGcmVzaENvbXBpbGF0aW9uVGlja2V0IHtcbiAga2luZDogQ29tcGlsYXRpb25UaWNrZXRLaW5kLkZyZXNoO1xuICBvcHRpb25zOiBOZ0NvbXBpbGVyT3B0aW9ucztcbiAgaW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5OiBJbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3k7XG4gIHByb2dyYW1Ecml2ZXI6IFByb2dyYW1Ecml2ZXI7XG4gIGVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXI6IGJvb2xlYW47XG4gIHVzZVBvaXNvbmVkRGF0YTogYm9vbGVhbjtcbiAgdHNQcm9ncmFtOiB0cy5Qcm9ncmFtO1xuICBwZXJmUmVjb3JkZXI6IEFjdGl2ZVBlcmZSZWNvcmRlcjtcbn1cblxuLyoqXG4gKiBCZWdpbiBhbiBBbmd1bGFyIGNvbXBpbGF0aW9uIG9wZXJhdGlvbiB0aGF0IGluY29ycG9yYXRlcyBjaGFuZ2VzIHRvIFR5cGVTY3JpcHQgY29kZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbmNyZW1lbnRhbFR5cGVTY3JpcHRDb21waWxhdGlvblRpY2tldCB7XG4gIGtpbmQ6IENvbXBpbGF0aW9uVGlja2V0S2luZC5JbmNyZW1lbnRhbFR5cGVTY3JpcHQ7XG4gIG9wdGlvbnM6IE5nQ29tcGlsZXJPcHRpb25zO1xuICBuZXdQcm9ncmFtOiB0cy5Qcm9ncmFtO1xuICBpbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3k6IEluY3JlbWVudGFsQnVpbGRTdHJhdGVneTtcbiAgaW5jcmVtZW50YWxDb21waWxhdGlvbjogSW5jcmVtZW50YWxDb21waWxhdGlvbjtcbiAgcHJvZ3JhbURyaXZlcjogUHJvZ3JhbURyaXZlcjtcbiAgZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcjogYm9vbGVhbjtcbiAgdXNlUG9pc29uZWREYXRhOiBib29sZWFuO1xuICBwZXJmUmVjb3JkZXI6IEFjdGl2ZVBlcmZSZWNvcmRlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbmNyZW1lbnRhbFJlc291cmNlQ29tcGlsYXRpb25UaWNrZXQge1xuICBraW5kOiBDb21waWxhdGlvblRpY2tldEtpbmQuSW5jcmVtZW50YWxSZXNvdXJjZTtcbiAgY29tcGlsZXI6IE5nQ29tcGlsZXI7XG4gIG1vZGlmaWVkUmVzb3VyY2VGaWxlczogU2V0PHN0cmluZz47XG4gIHBlcmZSZWNvcmRlcjogQWN0aXZlUGVyZlJlY29yZGVyO1xufVxuXG4vKipcbiAqIEEgcmVxdWVzdCB0byBiZWdpbiBBbmd1bGFyIGNvbXBpbGF0aW9uLCBlaXRoZXIgc3RhcnRpbmcgZnJvbSBzY3JhdGNoIG9yIGZyb20gYSBrbm93biBwcmlvciBzdGF0ZS5cbiAqXG4gKiBgQ29tcGlsYXRpb25UaWNrZXRgcyBhcmUgdXNlZCB0byBpbml0aWFsaXplIChvciB1cGRhdGUpIGFuIGBOZ0NvbXBpbGVyYCBpbnN0YW5jZSwgdGhlIGNvcmUgb2YgdGhlXG4gKiBBbmd1bGFyIGNvbXBpbGVyLiBUaGV5IGFic3RyYWN0IHRoZSBzdGFydGluZyBzdGF0ZSBvZiBjb21waWxhdGlvbiBhbmQgYWxsb3cgYE5nQ29tcGlsZXJgIHRvIGJlXG4gKiBtYW5hZ2VkIGluZGVwZW5kZW50bHkgb2YgYW55IGluY3JlbWVudGFsIGNvbXBpbGF0aW9uIGxpZmVjeWNsZS5cbiAqL1xuZXhwb3J0IHR5cGUgQ29tcGlsYXRpb25UaWNrZXQgPSBGcmVzaENvbXBpbGF0aW9uVGlja2V0fEluY3JlbWVudGFsVHlwZVNjcmlwdENvbXBpbGF0aW9uVGlja2V0fFxuICAgIEluY3JlbWVudGFsUmVzb3VyY2VDb21waWxhdGlvblRpY2tldDtcblxuLyoqXG4gKiBDcmVhdGUgYSBgQ29tcGlsYXRpb25UaWNrZXRgIGZvciBhIGJyYW5kIG5ldyBjb21waWxhdGlvbiwgdXNpbmcgbm8gcHJpb3Igc3RhdGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcmVzaENvbXBpbGF0aW9uVGlja2V0KFxuICAgIHRzUHJvZ3JhbTogdHMuUHJvZ3JhbSwgb3B0aW9uczogTmdDb21waWxlck9wdGlvbnMsXG4gICAgaW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5OiBJbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksIHByb2dyYW1Ecml2ZXI6IFByb2dyYW1Ecml2ZXIsXG4gICAgcGVyZlJlY29yZGVyOiBBY3RpdmVQZXJmUmVjb3JkZXJ8bnVsbCwgZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcjogYm9vbGVhbixcbiAgICB1c2VQb2lzb25lZERhdGE6IGJvb2xlYW4pOiBDb21waWxhdGlvblRpY2tldCB7XG4gIHJldHVybiB7XG4gICAga2luZDogQ29tcGlsYXRpb25UaWNrZXRLaW5kLkZyZXNoLFxuICAgIHRzUHJvZ3JhbSxcbiAgICBvcHRpb25zLFxuICAgIGluY3JlbWVudGFsQnVpbGRTdHJhdGVneSxcbiAgICBwcm9ncmFtRHJpdmVyLFxuICAgIGVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIsXG4gICAgdXNlUG9pc29uZWREYXRhLFxuICAgIHBlcmZSZWNvcmRlcjogcGVyZlJlY29yZGVyID8/IEFjdGl2ZVBlcmZSZWNvcmRlci56ZXJvZWRUb05vdygpLFxuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGBDb21waWxhdGlvblRpY2tldGAgYXMgZWZmaWNpZW50bHkgYXMgcG9zc2libGUsIGJhc2VkIG9uIGEgcHJldmlvdXMgYE5nQ29tcGlsZXJgXG4gKiBpbnN0YW5jZSBhbmQgYSBuZXcgYHRzLlByb2dyYW1gLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5jcmVtZW50YWxGcm9tQ29tcGlsZXJUaWNrZXQoXG4gICAgb2xkQ29tcGlsZXI6IE5nQ29tcGlsZXIsIG5ld1Byb2dyYW06IHRzLlByb2dyYW0sXG4gICAgaW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5OiBJbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksIHByb2dyYW1Ecml2ZXI6IFByb2dyYW1Ecml2ZXIsXG4gICAgbW9kaWZpZWRSZXNvdXJjZUZpbGVzOiBTZXQ8QWJzb2x1dGVGc1BhdGg+LFxuICAgIHBlcmZSZWNvcmRlcjogQWN0aXZlUGVyZlJlY29yZGVyfG51bGwpOiBDb21waWxhdGlvblRpY2tldCB7XG4gIGNvbnN0IG9sZFByb2dyYW0gPSBvbGRDb21waWxlci5nZXRDdXJyZW50UHJvZ3JhbSgpO1xuICBjb25zdCBvbGRTdGF0ZSA9IG9sZENvbXBpbGVyLmluY3JlbWVudGFsU3RyYXRlZ3kuZ2V0SW5jcmVtZW50YWxTdGF0ZShvbGRQcm9ncmFtKTtcbiAgaWYgKG9sZFN0YXRlID09PSBudWxsKSB7XG4gICAgLy8gTm8gaW5jcmVtZW50YWwgc3RlcCBpcyBwb3NzaWJsZSBoZXJlLCBzaW5jZSBubyBJbmNyZW1lbnRhbERyaXZlciB3YXMgZm91bmQgZm9yIHRoZSBvbGRcbiAgICAvLyBwcm9ncmFtLlxuICAgIHJldHVybiBmcmVzaENvbXBpbGF0aW9uVGlja2V0KFxuICAgICAgICBuZXdQcm9ncmFtLCBvbGRDb21waWxlci5vcHRpb25zLCBpbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksIHByb2dyYW1Ecml2ZXIsIHBlcmZSZWNvcmRlcixcbiAgICAgICAgb2xkQ29tcGlsZXIuZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlciwgb2xkQ29tcGlsZXIudXNlUG9pc29uZWREYXRhKTtcbiAgfVxuXG4gIGlmIChwZXJmUmVjb3JkZXIgPT09IG51bGwpIHtcbiAgICBwZXJmUmVjb3JkZXIgPSBBY3RpdmVQZXJmUmVjb3JkZXIuemVyb2VkVG9Ob3coKTtcbiAgfVxuXG4gIGNvbnN0IGluY3JlbWVudGFsQ29tcGlsYXRpb24gPSBJbmNyZW1lbnRhbENvbXBpbGF0aW9uLmluY3JlbWVudGFsKFxuICAgICAgbmV3UHJvZ3JhbSwgdmVyc2lvbk1hcEZyb21Qcm9ncmFtKG5ld1Byb2dyYW0sIHByb2dyYW1Ecml2ZXIpLCBvbGRQcm9ncmFtLCBvbGRTdGF0ZSxcbiAgICAgIG1vZGlmaWVkUmVzb3VyY2VGaWxlcywgcGVyZlJlY29yZGVyKTtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6IENvbXBpbGF0aW9uVGlja2V0S2luZC5JbmNyZW1lbnRhbFR5cGVTY3JpcHQsXG4gICAgZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcjogb2xkQ29tcGlsZXIuZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcixcbiAgICB1c2VQb2lzb25lZERhdGE6IG9sZENvbXBpbGVyLnVzZVBvaXNvbmVkRGF0YSxcbiAgICBvcHRpb25zOiBvbGRDb21waWxlci5vcHRpb25zLFxuICAgIGluY3JlbWVudGFsQnVpbGRTdHJhdGVneSxcbiAgICBpbmNyZW1lbnRhbENvbXBpbGF0aW9uLFxuICAgIHByb2dyYW1Ecml2ZXIsXG4gICAgbmV3UHJvZ3JhbSxcbiAgICBwZXJmUmVjb3JkZXIsXG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYENvbXBpbGF0aW9uVGlja2V0YCBkaXJlY3RseSBmcm9tIGFuIG9sZCBgdHMuUHJvZ3JhbWAgYW5kIGFzc29jaWF0ZWQgQW5ndWxhciBjb21waWxhdGlvblxuICogc3RhdGUsIGFsb25nIHdpdGggYSBuZXcgYHRzLlByb2dyYW1gLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5jcmVtZW50YWxGcm9tU3RhdGVUaWNrZXQoXG4gICAgb2xkUHJvZ3JhbTogdHMuUHJvZ3JhbSwgb2xkU3RhdGU6IEluY3JlbWVudGFsU3RhdGUsIG5ld1Byb2dyYW06IHRzLlByb2dyYW0sXG4gICAgb3B0aW9uczogTmdDb21waWxlck9wdGlvbnMsIGluY3JlbWVudGFsQnVpbGRTdHJhdGVneTogSW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5LFxuICAgIHByb2dyYW1Ecml2ZXI6IFByb2dyYW1Ecml2ZXIsIG1vZGlmaWVkUmVzb3VyY2VGaWxlczogU2V0PEFic29sdXRlRnNQYXRoPixcbiAgICBwZXJmUmVjb3JkZXI6IEFjdGl2ZVBlcmZSZWNvcmRlcnxudWxsLCBlbmFibGVUZW1wbGF0ZVR5cGVDaGVja2VyOiBib29sZWFuLFxuICAgIHVzZVBvaXNvbmVkRGF0YTogYm9vbGVhbik6IENvbXBpbGF0aW9uVGlja2V0IHtcbiAgaWYgKHBlcmZSZWNvcmRlciA9PT0gbnVsbCkge1xuICAgIHBlcmZSZWNvcmRlciA9IEFjdGl2ZVBlcmZSZWNvcmRlci56ZXJvZWRUb05vdygpO1xuICB9XG4gIGNvbnN0IGluY3JlbWVudGFsQ29tcGlsYXRpb24gPSBJbmNyZW1lbnRhbENvbXBpbGF0aW9uLmluY3JlbWVudGFsKFxuICAgICAgbmV3UHJvZ3JhbSwgdmVyc2lvbk1hcEZyb21Qcm9ncmFtKG5ld1Byb2dyYW0sIHByb2dyYW1Ecml2ZXIpLCBvbGRQcm9ncmFtLCBvbGRTdGF0ZSxcbiAgICAgIG1vZGlmaWVkUmVzb3VyY2VGaWxlcywgcGVyZlJlY29yZGVyKTtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBDb21waWxhdGlvblRpY2tldEtpbmQuSW5jcmVtZW50YWxUeXBlU2NyaXB0LFxuICAgIG5ld1Byb2dyYW0sXG4gICAgb3B0aW9ucyxcbiAgICBpbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksXG4gICAgaW5jcmVtZW50YWxDb21waWxhdGlvbixcbiAgICBwcm9ncmFtRHJpdmVyLFxuICAgIGVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIsXG4gICAgdXNlUG9pc29uZWREYXRhLFxuICAgIHBlcmZSZWNvcmRlcixcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc291cmNlQ2hhbmdlVGlja2V0KGNvbXBpbGVyOiBOZ0NvbXBpbGVyLCBtb2RpZmllZFJlc291cmNlRmlsZXM6IFNldDxzdHJpbmc+KTpcbiAgICBJbmNyZW1lbnRhbFJlc291cmNlQ29tcGlsYXRpb25UaWNrZXQge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IENvbXBpbGF0aW9uVGlja2V0S2luZC5JbmNyZW1lbnRhbFJlc291cmNlLFxuICAgIGNvbXBpbGVyLFxuICAgIG1vZGlmaWVkUmVzb3VyY2VGaWxlcyxcbiAgICBwZXJmUmVjb3JkZXI6IEFjdGl2ZVBlcmZSZWNvcmRlci56ZXJvZWRUb05vdygpLFxuICB9O1xufVxuXG5cbi8qKlxuICogVGhlIGhlYXJ0IG9mIHRoZSBBbmd1bGFyIEl2eSBjb21waWxlci5cbiAqXG4gKiBUaGUgYE5nQ29tcGlsZXJgIHByb3ZpZGVzIGFuIEFQSSBmb3IgcGVyZm9ybWluZyBBbmd1bGFyIGNvbXBpbGF0aW9uIHdpdGhpbiBhIGN1c3RvbSBUeXBlU2NyaXB0XG4gKiBjb21waWxlci4gRWFjaCBpbnN0YW5jZSBvZiBgTmdDb21waWxlcmAgc3VwcG9ydHMgYSBzaW5nbGUgY29tcGlsYXRpb24sIHdoaWNoIG1pZ2h0IGJlXG4gKiBpbmNyZW1lbnRhbC5cbiAqXG4gKiBgTmdDb21waWxlcmAgaXMgbGF6eSwgYW5kIGRvZXMgbm90IHBlcmZvcm0gYW55IG9mIHRoZSB3b3JrIG9mIHRoZSBjb21waWxhdGlvbiB1bnRpbCBvbmUgb2YgaXRzXG4gKiBvdXRwdXQgbWV0aG9kcyAoZS5nLiBgZ2V0RGlhZ25vc3RpY3NgKSBpcyBjYWxsZWQuXG4gKlxuICogU2VlIHRoZSBSRUFETUUubWQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ0NvbXBpbGVyIHtcbiAgLyoqXG4gICAqIExhemlseSBldmFsdWF0ZWQgc3RhdGUgb2YgdGhlIGNvbXBpbGF0aW9uLlxuICAgKlxuICAgKiBUaGlzIGlzIGNyZWF0ZWQgb24gZGVtYW5kIGJ5IGNhbGxpbmcgYGVuc3VyZUFuYWx5emVkYC5cbiAgICovXG4gIHByaXZhdGUgY29tcGlsYXRpb246IExhenlDb21waWxhdGlvblN0YXRlfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBBbnkgZGlhZ25vc3RpY3MgcmVsYXRlZCB0byB0aGUgY29uc3RydWN0aW9uIG9mIHRoZSBjb21waWxhdGlvbi5cbiAgICpcbiAgICogVGhlc2UgYXJlIGRpYWdub3N0aWNzIHdoaWNoIGFyb3NlIGR1cmluZyBzZXR1cCBvZiB0aGUgaG9zdCBhbmQvb3IgcHJvZ3JhbS5cbiAgICovXG4gIHByaXZhdGUgY29uc3RydWN0aW9uRGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBOb24tdGVtcGxhdGUgZGlhZ25vc3RpY3MgcmVsYXRlZCB0byB0aGUgcHJvZ3JhbSBpdHNlbGYuIERvZXMgbm90IGluY2x1ZGUgdGVtcGxhdGVcbiAgICogZGlhZ25vc3RpY3MgYmVjYXVzZSB0aGUgdGVtcGxhdGUgdHlwZSBjaGVja2VyIG1lbW9pemVzIHRoZW0gaXRzZWxmLlxuICAgKlxuICAgKiBUaGlzIGlzIHNldCBieSAoYW5kIG1lbW9pemVzKSBgZ2V0Tm9uVGVtcGxhdGVEaWFnbm9zdGljc2AuXG4gICAqL1xuICBwcml2YXRlIG5vblRlbXBsYXRlRGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXXxudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGNsb3N1cmVDb21waWxlckVuYWJsZWQ6IGJvb2xlYW47XG4gIHByaXZhdGUgY3VycmVudFByb2dyYW06IHRzLlByb2dyYW07XG4gIHByaXZhdGUgZW50cnlQb2ludDogdHMuU291cmNlRmlsZXxudWxsO1xuICBwcml2YXRlIG1vZHVsZVJlc29sdmVyOiBNb2R1bGVSZXNvbHZlcjtcbiAgcHJpdmF0ZSByZXNvdXJjZU1hbmFnZXI6IEFkYXB0ZXJSZXNvdXJjZUxvYWRlcjtcbiAgcHJpdmF0ZSBjeWNsZUFuYWx5emVyOiBDeWNsZUFuYWx5emVyO1xuICByZWFkb25seSBpZ25vcmVGb3JEaWFnbm9zdGljczogU2V0PHRzLlNvdXJjZUZpbGU+O1xuICByZWFkb25seSBpZ25vcmVGb3JFbWl0OiBTZXQ8dHMuU291cmNlRmlsZT47XG5cbiAgLyoqXG4gICAqIGBOZ0NvbXBpbGVyYCBjYW4gYmUgcmV1c2VkIGZvciBtdWx0aXBsZSBjb21waWxhdGlvbnMgKGZvciByZXNvdXJjZS1vbmx5IGNoYW5nZXMpLCBhbmQgZWFjaFxuICAgKiBuZXcgY29tcGlsYXRpb24gdXNlcyBhIGZyZXNoIGBQZXJmUmVjb3JkZXJgLiBUaHVzLCBjbGFzc2VzIGNyZWF0ZWQgd2l0aCBhIGxpZmVzcGFuIG9mIHRoZVxuICAgKiBgTmdDb21waWxlcmAgdXNlIGEgYERlbGVnYXRpbmdQZXJmUmVjb3JkZXJgIHNvIHRoZSBgUGVyZlJlY29yZGVyYCB0aGV5IHdyaXRlIHRvIGNhbiBiZSB1cGRhdGVkXG4gICAqIHdpdGggZWFjaCBmcmVzaCBjb21waWxhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgZGVsZWdhdGluZ1BlcmZSZWNvcmRlciA9IG5ldyBEZWxlZ2F0aW5nUGVyZlJlY29yZGVyKHRoaXMucGVyZlJlY29yZGVyKTtcblxuICAvKipcbiAgICogQ29udmVydCBhIGBDb21waWxhdGlvblRpY2tldGAgaW50byBhbiBgTmdDb21waWxlcmAgaW5zdGFuY2UgZm9yIHRoZSByZXF1ZXN0ZWQgY29tcGlsYXRpb24uXG4gICAqXG4gICAqIERlcGVuZGluZyBvbiB0aGUgbmF0dXJlIG9mIHRoZSBjb21waWxhdGlvbiByZXF1ZXN0LCB0aGUgYE5nQ29tcGlsZXJgIGluc3RhbmNlIG1heSBiZSByZXVzZWRcbiAgICogZnJvbSBhIHByZXZpb3VzIGNvbXBpbGF0aW9uIGFuZCB1cGRhdGVkIHdpdGggYW55IGNoYW5nZXMsIGl0IG1heSBiZSBhIG5ldyBpbnN0YW5jZSB3aGljaFxuICAgKiBpbmNyZW1lbnRhbGx5IHJldXNlcyBzdGF0ZSBmcm9tIGEgcHJldmlvdXMgY29tcGlsYXRpb24sIG9yIGl0IG1heSByZXByZXNlbnQgYSBmcmVzaFxuICAgKiBjb21waWxhdGlvbiBlbnRpcmVseS5cbiAgICovXG4gIHN0YXRpYyBmcm9tVGlja2V0KHRpY2tldDogQ29tcGlsYXRpb25UaWNrZXQsIGFkYXB0ZXI6IE5nQ29tcGlsZXJBZGFwdGVyKSB7XG4gICAgc3dpdGNoICh0aWNrZXQua2luZCkge1xuICAgICAgY2FzZSBDb21waWxhdGlvblRpY2tldEtpbmQuRnJlc2g6XG4gICAgICAgIHJldHVybiBuZXcgTmdDb21waWxlcihcbiAgICAgICAgICAgIGFkYXB0ZXIsXG4gICAgICAgICAgICB0aWNrZXQub3B0aW9ucyxcbiAgICAgICAgICAgIHRpY2tldC50c1Byb2dyYW0sXG4gICAgICAgICAgICB0aWNrZXQucHJvZ3JhbURyaXZlcixcbiAgICAgICAgICAgIHRpY2tldC5pbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksXG4gICAgICAgICAgICBJbmNyZW1lbnRhbENvbXBpbGF0aW9uLmZyZXNoKFxuICAgICAgICAgICAgICAgIHRpY2tldC50c1Byb2dyYW0sIHZlcnNpb25NYXBGcm9tUHJvZ3JhbSh0aWNrZXQudHNQcm9ncmFtLCB0aWNrZXQucHJvZ3JhbURyaXZlcikpLFxuICAgICAgICAgICAgdGlja2V0LmVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIsXG4gICAgICAgICAgICB0aWNrZXQudXNlUG9pc29uZWREYXRhLFxuICAgICAgICAgICAgdGlja2V0LnBlcmZSZWNvcmRlcixcbiAgICAgICAgKTtcbiAgICAgIGNhc2UgQ29tcGlsYXRpb25UaWNrZXRLaW5kLkluY3JlbWVudGFsVHlwZVNjcmlwdDpcbiAgICAgICAgcmV0dXJuIG5ldyBOZ0NvbXBpbGVyKFxuICAgICAgICAgICAgYWRhcHRlcixcbiAgICAgICAgICAgIHRpY2tldC5vcHRpb25zLFxuICAgICAgICAgICAgdGlja2V0Lm5ld1Byb2dyYW0sXG4gICAgICAgICAgICB0aWNrZXQucHJvZ3JhbURyaXZlcixcbiAgICAgICAgICAgIHRpY2tldC5pbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3ksXG4gICAgICAgICAgICB0aWNrZXQuaW5jcmVtZW50YWxDb21waWxhdGlvbixcbiAgICAgICAgICAgIHRpY2tldC5lbmFibGVUZW1wbGF0ZVR5cGVDaGVja2VyLFxuICAgICAgICAgICAgdGlja2V0LnVzZVBvaXNvbmVkRGF0YSxcbiAgICAgICAgICAgIHRpY2tldC5wZXJmUmVjb3JkZXIsXG4gICAgICAgICk7XG4gICAgICBjYXNlIENvbXBpbGF0aW9uVGlja2V0S2luZC5JbmNyZW1lbnRhbFJlc291cmNlOlxuICAgICAgICBjb25zdCBjb21waWxlciA9IHRpY2tldC5jb21waWxlcjtcbiAgICAgICAgY29tcGlsZXIudXBkYXRlV2l0aENoYW5nZWRSZXNvdXJjZXModGlja2V0Lm1vZGlmaWVkUmVzb3VyY2VGaWxlcywgdGlja2V0LnBlcmZSZWNvcmRlcik7XG4gICAgICAgIHJldHVybiBjb21waWxlcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBhZGFwdGVyOiBOZ0NvbXBpbGVyQWRhcHRlcixcbiAgICAgIHJlYWRvbmx5IG9wdGlvbnM6IE5nQ29tcGlsZXJPcHRpb25zLFxuICAgICAgcHJpdmF0ZSBpbnB1dFByb2dyYW06IHRzLlByb2dyYW0sXG4gICAgICByZWFkb25seSBwcm9ncmFtRHJpdmVyOiBQcm9ncmFtRHJpdmVyLFxuICAgICAgcmVhZG9ubHkgaW5jcmVtZW50YWxTdHJhdGVneTogSW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5LFxuICAgICAgcmVhZG9ubHkgaW5jcmVtZW50YWxDb21waWxhdGlvbjogSW5jcmVtZW50YWxDb21waWxhdGlvbixcbiAgICAgIHJlYWRvbmx5IGVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXI6IGJvb2xlYW4sXG4gICAgICByZWFkb25seSB1c2VQb2lzb25lZERhdGE6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGxpdmVQZXJmUmVjb3JkZXI6IEFjdGl2ZVBlcmZSZWNvcmRlcixcbiAgKSB7XG4gICAgdGhpcy5jb25zdHJ1Y3Rpb25EaWFnbm9zdGljcy5wdXNoKC4uLnRoaXMuYWRhcHRlci5jb25zdHJ1Y3Rpb25EaWFnbm9zdGljcyk7XG4gICAgY29uc3QgaW5jb21wYXRpYmxlVHlwZUNoZWNrT3B0aW9uc0RpYWdub3N0aWMgPSB2ZXJpZnlDb21wYXRpYmxlVHlwZUNoZWNrT3B0aW9ucyh0aGlzLm9wdGlvbnMpO1xuICAgIGlmIChpbmNvbXBhdGlibGVUeXBlQ2hlY2tPcHRpb25zRGlhZ25vc3RpYyAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5jb25zdHJ1Y3Rpb25EaWFnbm9zdGljcy5wdXNoKGluY29tcGF0aWJsZVR5cGVDaGVja09wdGlvbnNEaWFnbm9zdGljKTtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRQcm9ncmFtID0gaW5wdXRQcm9ncmFtO1xuICAgIHRoaXMuY2xvc3VyZUNvbXBpbGVyRW5hYmxlZCA9ICEhdGhpcy5vcHRpb25zLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyO1xuXG4gICAgdGhpcy5lbnRyeVBvaW50ID1cbiAgICAgICAgYWRhcHRlci5lbnRyeVBvaW50ICE9PSBudWxsID8gZ2V0U291cmNlRmlsZU9yTnVsbChpbnB1dFByb2dyYW0sIGFkYXB0ZXIuZW50cnlQb2ludCkgOiBudWxsO1xuXG4gICAgY29uc3QgbW9kdWxlUmVzb2x1dGlvbkNhY2hlID0gdHMuY3JlYXRlTW9kdWxlUmVzb2x1dGlvbkNhY2hlKFxuICAgICAgICB0aGlzLmFkYXB0ZXIuZ2V0Q3VycmVudERpcmVjdG9yeSgpLFxuICAgICAgICAvLyBkb2VuJ3QgcmV0YWluIGEgcmVmZXJlbmNlIHRvIGB0aGlzYCwgaWYgb3RoZXIgY2xvc3VyZXMgaW4gdGhlIGNvbnN0cnVjdG9yIGhlcmUgcmVmZXJlbmNlXG4gICAgICAgIC8vIGB0aGlzYCBpbnRlcm5hbGx5IHRoZW4gYSBjbG9zdXJlIGNyZWF0ZWQgaGVyZSB3b3VsZCByZXRhaW4gdGhlbS4gVGhpcyBjYW4gY2F1c2UgbWFqb3JcbiAgICAgICAgLy8gbWVtb3J5IGxlYWsgaXNzdWVzIHNpbmNlIHRoZSBgbW9kdWxlUmVzb2x1dGlvbkNhY2hlYCBpcyBhIGxvbmctbGl2ZWQgb2JqZWN0IGFuZCBmaW5kcyBpdHNcbiAgICAgICAgLy8gd2F5IGludG8gYWxsIGtpbmRzIG9mIHBsYWNlcyBpbnNpZGUgVFMgaW50ZXJuYWwgb2JqZWN0cy5cbiAgICAgICAgdGhpcy5hZGFwdGVyLmdldENhbm9uaWNhbEZpbGVOYW1lLmJpbmQodGhpcy5hZGFwdGVyKSk7XG4gICAgdGhpcy5tb2R1bGVSZXNvbHZlciA9XG4gICAgICAgIG5ldyBNb2R1bGVSZXNvbHZlcihpbnB1dFByb2dyYW0sIHRoaXMub3B0aW9ucywgdGhpcy5hZGFwdGVyLCBtb2R1bGVSZXNvbHV0aW9uQ2FjaGUpO1xuICAgIHRoaXMucmVzb3VyY2VNYW5hZ2VyID0gbmV3IEFkYXB0ZXJSZXNvdXJjZUxvYWRlcihhZGFwdGVyLCB0aGlzLm9wdGlvbnMpO1xuICAgIHRoaXMuY3ljbGVBbmFseXplciA9IG5ldyBDeWNsZUFuYWx5emVyKFxuICAgICAgICBuZXcgSW1wb3J0R3JhcGgoaW5wdXRQcm9ncmFtLmdldFR5cGVDaGVja2VyKCksIHRoaXMuZGVsZWdhdGluZ1BlcmZSZWNvcmRlcikpO1xuICAgIHRoaXMuaW5jcmVtZW50YWxTdHJhdGVneS5zZXRJbmNyZW1lbnRhbFN0YXRlKHRoaXMuaW5jcmVtZW50YWxDb21waWxhdGlvbi5zdGF0ZSwgaW5wdXRQcm9ncmFtKTtcblxuICAgIHRoaXMuaWdub3JlRm9yRGlhZ25vc3RpY3MgPVxuICAgICAgICBuZXcgU2V0KGlucHV0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihzZiA9PiB0aGlzLmFkYXB0ZXIuaXNTaGltKHNmKSkpO1xuICAgIHRoaXMuaWdub3JlRm9yRW1pdCA9IHRoaXMuYWRhcHRlci5pZ25vcmVGb3JFbWl0O1xuXG4gICAgbGV0IGR0c0ZpbGVDb3VudCA9IDA7XG4gICAgbGV0IG5vbkR0c0ZpbGVDb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBzZiBvZiBpbnB1dFByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgaWYgKHNmLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGR0c0ZpbGVDb3VudCsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9uRHRzRmlsZUNvdW50Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGl2ZVBlcmZSZWNvcmRlci5ldmVudENvdW50KFBlcmZFdmVudC5JbnB1dER0c0ZpbGUsIGR0c0ZpbGVDb3VudCk7XG4gICAgbGl2ZVBlcmZSZWNvcmRlci5ldmVudENvdW50KFBlcmZFdmVudC5JbnB1dFRzRmlsZSwgbm9uRHRzRmlsZUNvdW50KTtcbiAgfVxuXG4gIGdldCBwZXJmUmVjb3JkZXIoKTogQWN0aXZlUGVyZlJlY29yZGVyIHtcbiAgICByZXR1cm4gdGhpcy5saXZlUGVyZlJlY29yZGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cG9zZXMgdGhlIGBJbmNyZW1lbnRhbENvbXBpbGF0aW9uYCB1bmRlciBhbiBvbGQgcHJvcGVydHkgbmFtZSB0aGF0IHRoZSBDTEkgdXNlcywgYXZvaWRpbmcgYVxuICAgKiBjaGlja2VuLWFuZC1lZ2cgcHJvYmxlbSB3aXRoIHRoZSByZW5hbWUgdG8gYGluY3JlbWVudGFsQ29tcGlsYXRpb25gLlxuICAgKlxuICAgKiBUT0RPKGFseGh1Yik6IHJlbW92ZSB3aGVuIHRoZSBDTEkgdXNlcyB0aGUgbmV3IG5hbWUuXG4gICAqL1xuICBnZXQgaW5jcmVtZW50YWxEcml2ZXIoKTogSW5jcmVtZW50YWxDb21waWxhdGlvbiB7XG4gICAgcmV0dXJuIHRoaXMuaW5jcmVtZW50YWxDb21waWxhdGlvbjtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlV2l0aENoYW5nZWRSZXNvdXJjZXMoXG4gICAgICBjaGFuZ2VkUmVzb3VyY2VzOiBTZXQ8c3RyaW5nPiwgcGVyZlJlY29yZGVyOiBBY3RpdmVQZXJmUmVjb3JkZXIpOiB2b2lkIHtcbiAgICB0aGlzLmxpdmVQZXJmUmVjb3JkZXIgPSBwZXJmUmVjb3JkZXI7XG4gICAgdGhpcy5kZWxlZ2F0aW5nUGVyZlJlY29yZGVyLnRhcmdldCA9IHBlcmZSZWNvcmRlcjtcblxuICAgIHBlcmZSZWNvcmRlci5pblBoYXNlKFBlcmZQaGFzZS5SZXNvdXJjZVVwZGF0ZSwgKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuY29tcGlsYXRpb24gPT09IG51bGwpIHtcbiAgICAgICAgLy8gQW5hbHlzaXMgaGFzbid0IGhhcHBlbmVkIHlldCwgc28gbm8gdXBkYXRlIGlzIG5lY2Vzc2FyeSAtIGFueSBjaGFuZ2VzIHRvIHJlc291cmNlcyB3aWxsXG4gICAgICAgIC8vIGJlIGNhcHR1cmVkIGJ5IHRoZSBpbml0YWwgYW5hbHlzaXMgcGFzcyBpdHNlbGYuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZXNvdXJjZU1hbmFnZXIuaW52YWxpZGF0ZSgpO1xuXG4gICAgICBjb25zdCBjbGFzc2VzVG9VcGRhdGUgPSBuZXcgU2V0PERlY2xhcmF0aW9uTm9kZT4oKTtcbiAgICAgIGZvciAoY29uc3QgcmVzb3VyY2VGaWxlIG9mIGNoYW5nZWRSZXNvdXJjZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCB0ZW1wbGF0ZUNsYXNzIG9mIHRoaXMuZ2V0Q29tcG9uZW50c1dpdGhUZW1wbGF0ZUZpbGUocmVzb3VyY2VGaWxlKSkge1xuICAgICAgICAgIGNsYXNzZXNUb1VwZGF0ZS5hZGQodGVtcGxhdGVDbGFzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IHN0eWxlQ2xhc3Mgb2YgdGhpcy5nZXRDb21wb25lbnRzV2l0aFN0eWxlRmlsZShyZXNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgY2xhc3Nlc1RvVXBkYXRlLmFkZChzdHlsZUNsYXNzKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGNsYXp6IG9mIGNsYXNzZXNUb1VwZGF0ZSkge1xuICAgICAgICB0aGlzLmNvbXBpbGF0aW9uLnRyYWl0Q29tcGlsZXIudXBkYXRlUmVzb3VyY2VzKGNsYXp6KTtcbiAgICAgICAgaWYgKCF0cy5pc0NsYXNzRGVjbGFyYXRpb24oY2xhenopKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbXBpbGF0aW9uLnRlbXBsYXRlVHlwZUNoZWNrZXIuaW52YWxpZGF0ZUNsYXNzKGNsYXp6KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHJlc291cmNlIGRlcGVuZGVuY2llcyBvZiBhIGZpbGUuXG4gICAqXG4gICAqIElmIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBjb21waWxhdGlvbiwgYW4gZW1wdHkgYXJyYXkgd2lsbCBiZSByZXR1cm5lZC5cbiAgICovXG4gIGdldFJlc291cmNlRGVwZW5kZW5jaWVzKGZpbGU6IHRzLlNvdXJjZUZpbGUpOiBzdHJpbmdbXSB7XG4gICAgdGhpcy5lbnN1cmVBbmFseXplZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuaW5jcmVtZW50YWxDb21waWxhdGlvbi5kZXBHcmFwaC5nZXRSZXNvdXJjZURlcGVuZGVuY2llcyhmaWxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYWxsIEFuZ3VsYXItcmVsYXRlZCBkaWFnbm9zdGljcyBmb3IgdGhpcyBjb21waWxhdGlvbi5cbiAgICovXG4gIGdldERpYWdub3N0aWNzKCk6IHRzLkRpYWdub3N0aWNbXSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkTWVzc2FnZVRleHREZXRhaWxzKFxuICAgICAgICBbLi4udGhpcy5nZXROb25UZW1wbGF0ZURpYWdub3N0aWNzKCksIC4uLnRoaXMuZ2V0VGVtcGxhdGVEaWFnbm9zdGljcygpXSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBBbmd1bGFyLXJlbGF0ZWQgZGlhZ25vc3RpY3MgZm9yIHRoaXMgY29tcGlsYXRpb24uXG4gICAqXG4gICAqIElmIGEgYHRzLlNvdXJjZUZpbGVgIGlzIHBhc3NlZCwgb25seSBkaWFnbm9zdGljcyByZWxhdGVkIHRvIHRoYXQgZmlsZSBhcmUgcmV0dXJuZWQuXG4gICAqL1xuICBnZXREaWFnbm9zdGljc0ZvckZpbGUoZmlsZTogdHMuU291cmNlRmlsZSwgb3B0aW1pemVGb3I6IE9wdGltaXplRm9yKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgICByZXR1cm4gdGhpcy5hZGRNZXNzYWdlVGV4dERldGFpbHMoW1xuICAgICAgLi4udGhpcy5nZXROb25UZW1wbGF0ZURpYWdub3N0aWNzKCkuZmlsdGVyKGRpYWcgPT4gZGlhZy5maWxlID09PSBmaWxlKSxcbiAgICAgIC4uLnRoaXMuZ2V0VGVtcGxhdGVEaWFnbm9zdGljc0ZvckZpbGUoZmlsZSwgb3B0aW1pemVGb3IpXG4gICAgXSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIEFuZ3VsYXIuaW8gZXJyb3IgZ3VpZGUgbGlua3MgdG8gZGlhZ25vc3RpY3MgZm9yIHRoaXMgY29tcGlsYXRpb24uXG4gICAqL1xuICBwcml2YXRlIGFkZE1lc3NhZ2VUZXh0RGV0YWlscyhkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgICByZXR1cm4gZGlhZ25vc3RpY3MubWFwKGRpYWcgPT4ge1xuICAgICAgaWYgKGRpYWcuY29kZSAmJiBDT01QSUxFUl9FUlJPUlNfV0lUSF9HVUlERVMuaGFzKG5nRXJyb3JDb2RlKGRpYWcuY29kZSkpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4uZGlhZyxcbiAgICAgICAgICBtZXNzYWdlVGV4dDogZGlhZy5tZXNzYWdlVGV4dCArXG4gICAgICAgICAgICAgIGAuIEZpbmQgbW9yZSBhdCAke0VSUk9SX0RFVEFJTFNfUEFHRV9CQVNFX1VSTH0vTkcke25nRXJyb3JDb2RlKGRpYWcuY29kZSl9YFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRpYWc7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBzZXR1cC1yZWxhdGVkIGRpYWdub3N0aWNzIGZvciB0aGlzIGNvbXBpbGF0aW9uLlxuICAgKi9cbiAgZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rpb25EaWFnbm9zdGljcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnQgYHRzLlByb2dyYW1gIGtub3duIHRvIHRoaXMgYE5nQ29tcGlsZXJgLlxuICAgKlxuICAgKiBDb21waWxhdGlvbiBiZWdpbnMgd2l0aCBhbiBpbnB1dCBgdHMuUHJvZ3JhbWAsIGFuZCBkdXJpbmcgdGVtcGxhdGUgdHlwZS1jaGVja2luZyBvcGVyYXRpb25zIG5ld1xuICAgKiBgdHMuUHJvZ3JhbWBzIG1heSBiZSBwcm9kdWNlZCB1c2luZyB0aGUgYFByb2dyYW1Ecml2ZXJgLiBUaGUgbW9zdCByZWNlbnQgc3VjaCBgdHMuUHJvZ3JhbWAgdG9cbiAgICogYmUgcHJvZHVjZWQgaXMgYXZhaWxhYmxlIGhlcmUuXG4gICAqXG4gICAqIFRoaXMgYHRzLlByb2dyYW1gIHNlcnZlcyB0d28ga2V5IHB1cnBvc2VzOlxuICAgKlxuICAgKiAqIEFzIGFuIGluY3JlbWVudGFsIHN0YXJ0aW5nIHBvaW50IGZvciBjcmVhdGluZyB0aGUgbmV4dCBgdHMuUHJvZ3JhbWAgYmFzZWQgb24gZmlsZXMgdGhhdCB0aGVcbiAgICogICB1c2VyIGhhcyBjaGFuZ2VkIChmb3IgY2xpZW50cyB1c2luZyB0aGUgVFMgY29tcGlsZXIgcHJvZ3JhbSBBUElzKS5cbiAgICpcbiAgICogKiBBcyB0aGUgXCJiZWZvcmVcIiBwb2ludCBmb3IgYW4gaW5jcmVtZW50YWwgY29tcGlsYXRpb24gaW52b2NhdGlvbiwgdG8gZGV0ZXJtaW5lIHdoYXQncyBjaGFuZ2VkXG4gICAqICAgYmV0d2VlbiB0aGUgb2xkIGFuZCBuZXcgcHJvZ3JhbXMgKGZvciBhbGwgY29tcGlsYXRpb25zKS5cbiAgICovXG4gIGdldEN1cnJlbnRQcm9ncmFtKCk6IHRzLlByb2dyYW0ge1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnRQcm9ncmFtO1xuICB9XG5cbiAgZ2V0VGVtcGxhdGVUeXBlQ2hlY2tlcigpOiBUZW1wbGF0ZVR5cGVDaGVja2VyIHtcbiAgICBpZiAoIXRoaXMuZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgYFRlbXBsYXRlVHlwZUNoZWNrZXJgIGRvZXMgbm90IHdvcmsgd2l0aG91dCBgZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcmAuJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmVuc3VyZUFuYWx5emVkKCkudGVtcGxhdGVUeXBlQ2hlY2tlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGB0cy5EZWNsYXJhdGlvbmBzIGZvciBhbnkgY29tcG9uZW50KHMpIHdoaWNoIHVzZSB0aGUgZ2l2ZW4gdGVtcGxhdGUgZmlsZS5cbiAgICovXG4gIGdldENvbXBvbmVudHNXaXRoVGVtcGxhdGVGaWxlKHRlbXBsYXRlRmlsZVBhdGg6IHN0cmluZyk6IFJlYWRvbmx5U2V0PERlY2xhcmF0aW9uTm9kZT4ge1xuICAgIGNvbnN0IHtyZXNvdXJjZVJlZ2lzdHJ5fSA9IHRoaXMuZW5zdXJlQW5hbHl6ZWQoKTtcbiAgICByZXR1cm4gcmVzb3VyY2VSZWdpc3RyeS5nZXRDb21wb25lbnRzV2l0aFRlbXBsYXRlKHJlc29sdmUodGVtcGxhdGVGaWxlUGF0aCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgYHRzLkRlY2xhcmF0aW9uYHMgZm9yIGFueSBjb21wb25lbnQocykgd2hpY2ggdXNlIHRoZSBnaXZlbiB0ZW1wbGF0ZSBmaWxlLlxuICAgKi9cbiAgZ2V0Q29tcG9uZW50c1dpdGhTdHlsZUZpbGUoc3R5bGVGaWxlUGF0aDogc3RyaW5nKTogUmVhZG9ubHlTZXQ8RGVjbGFyYXRpb25Ob2RlPiB7XG4gICAgY29uc3Qge3Jlc291cmNlUmVnaXN0cnl9ID0gdGhpcy5lbnN1cmVBbmFseXplZCgpO1xuICAgIHJldHVybiByZXNvdXJjZVJlZ2lzdHJ5LmdldENvbXBvbmVudHNXaXRoU3R5bGUocmVzb2x2ZShzdHlsZUZpbGVQYXRoKSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIGV4dGVybmFsIHJlc291cmNlcyBmb3IgdGhlIGdpdmVuIGNvbXBvbmVudC5cbiAgICovXG4gIGdldENvbXBvbmVudFJlc291cmNlcyhjbGFzc0RlY2w6IERlY2xhcmF0aW9uTm9kZSk6IENvbXBvbmVudFJlc291cmNlc3xudWxsIHtcbiAgICBpZiAoIWlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKGNsYXNzRGVjbCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB7cmVzb3VyY2VSZWdpc3RyeX0gPSB0aGlzLmVuc3VyZUFuYWx5emVkKCk7XG4gICAgY29uc3Qgc3R5bGVzID0gcmVzb3VyY2VSZWdpc3RyeS5nZXRTdHlsZXMoY2xhc3NEZWNsKTtcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IHJlc291cmNlUmVnaXN0cnkuZ2V0VGVtcGxhdGUoY2xhc3NEZWNsKTtcbiAgICBpZiAodGVtcGxhdGUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7c3R5bGVzLCB0ZW1wbGF0ZX07XG4gIH1cblxuICBnZXRNZXRhKGNsYXNzRGVjbDogRGVjbGFyYXRpb25Ob2RlKTogUGlwZU1ldGF8RGlyZWN0aXZlTWV0YXxudWxsIHtcbiAgICBpZiAoIWlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKGNsYXNzRGVjbCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCByZWYgPSBuZXcgUmVmZXJlbmNlKGNsYXNzRGVjbCk7XG4gICAgY29uc3Qge21ldGFSZWFkZXJ9ID0gdGhpcy5lbnN1cmVBbmFseXplZCgpO1xuICAgIGNvbnN0IG1ldGEgPSBtZXRhUmVhZGVyLmdldFBpcGVNZXRhZGF0YShyZWYpID8/IG1ldGFSZWFkZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEocmVmKTtcbiAgICBpZiAobWV0YSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBtZXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gQW5ndWxhcidzIGFuYWx5c2lzIHN0ZXAgKGFzIGEgcHJlY3Vyc29yIHRvIGBnZXREaWFnbm9zdGljc2Agb3IgYHByZXBhcmVFbWl0YClcbiAgICogYXN5bmNocm9ub3VzbHkuXG4gICAqXG4gICAqIE5vcm1hbGx5LCB0aGlzIG9wZXJhdGlvbiBoYXBwZW5zIGxhemlseSB3aGVuZXZlciBgZ2V0RGlhZ25vc3RpY3NgIG9yIGBwcmVwYXJlRW1pdGAgYXJlIGNhbGxlZC5cbiAgICogSG93ZXZlciwgY2VydGFpbiBjb25zdW1lcnMgbWF5IHdpc2ggdG8gYWxsb3cgZm9yIGFuIGFzeW5jaHJvbm91cyBwaGFzZSBvZiBhbmFseXNpcywgd2hlcmVcbiAgICogcmVzb3VyY2VzIHN1Y2ggYXMgYHN0eWxlVXJsc2AgYXJlIHJlc29sdmVkIGFzeW5jaG9ub3VzbHkuIEluIHRoZXNlIGNhc2VzIGBhbmFseXplQXN5bmNgIG11c3QgYmVcbiAgICogY2FsbGVkIGZpcnN0LCBhbmQgaXRzIGBQcm9taXNlYCBhd2FpdGVkIHByaW9yIHRvIGNhbGxpbmcgYW55IG90aGVyIEFQSXMgb2YgYE5nQ29tcGlsZXJgLlxuICAgKi9cbiAgYXN5bmMgYW5hbHl6ZUFzeW5jKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmNvbXBpbGF0aW9uICE9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5wZXJmUmVjb3JkZXIuaW5QaGFzZShQZXJmUGhhc2UuQW5hbHlzaXMsIGFzeW5jICgpID0+IHtcbiAgICAgIHRoaXMuY29tcGlsYXRpb24gPSB0aGlzLm1ha2VDb21waWxhdGlvbigpO1xuXG4gICAgICBjb25zdCBwcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHNmIG9mIHRoaXMuaW5wdXRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgaWYgKHNmLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgYW5hbHlzaXNQcm9taXNlID0gdGhpcy5jb21waWxhdGlvbi50cmFpdENvbXBpbGVyLmFuYWx5emVBc3luYyhzZik7XG4gICAgICAgIGlmIChhbmFseXNpc1Byb21pc2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHByb21pc2VzLnB1c2goYW5hbHlzaXNQcm9taXNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cbiAgICAgIHRoaXMucGVyZlJlY29yZGVyLm1lbW9yeShQZXJmQ2hlY2twb2ludC5BbmFseXNpcyk7XG4gICAgICB0aGlzLnJlc29sdmVDb21waWxhdGlvbih0aGlzLmNvbXBpbGF0aW9uLnRyYWl0Q29tcGlsZXIpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3QgbGF6eSByb3V0ZXMgZGV0ZWN0ZWQgZHVyaW5nIGFuYWx5c2lzLlxuICAgKlxuICAgKiBUaGlzIGNhbiBiZSBjYWxsZWQgZm9yIG9uZSBzcGVjaWZpYyByb3V0ZSwgb3IgdG8gcmV0cmlldmUgYWxsIHRvcC1sZXZlbCByb3V0ZXMuXG4gICAqL1xuICBsaXN0TGF6eVJvdXRlcyhlbnRyeVJvdXRlPzogc3RyaW5nKTogTGF6eVJvdXRlW10ge1xuICAgIGlmIChlbnRyeVJvdXRlKSB7XG4gICAgICAvLyBodHRzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvYmxvYi81MDczMmUxNTYvcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy90cmFuc2Zvcm1lcnMvY29tcGlsZXJfaG9zdC50cyNMMTc1LUwxODgpLlxuICAgICAgLy9cbiAgICAgIC8vIGBAYW5ndWxhci9jbGlgIHdpbGwgYWx3YXlzIGNhbGwgdGhpcyBBUEkgd2l0aCBhbiBhYnNvbHV0ZSBwYXRoLCBzbyB0aGUgcmVzb2x1dGlvbiBzdGVwIGlzXG4gICAgICAvLyBub3QgbmVjZXNzYXJ5LCBidXQga2VlcGluZyBpdCBiYWNrd2FyZHMgY29tcGF0aWJsZSBpbiBjYXNlIHNvbWVvbmUgZWxzZSBpcyB1c2luZyB0aGUgQVBJLlxuXG4gICAgICAvLyBSZWxhdGl2ZSBlbnRyeSBwYXRocyBhcmUgZGlzYWxsb3dlZC5cbiAgICAgIGlmIChlbnRyeVJvdXRlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBsaXN0IGxhenkgcm91dGVzOiBSZXNvbHV0aW9uIG9mIHJlbGF0aXZlIHBhdGhzICgke1xuICAgICAgICAgICAgZW50cnlSb3V0ZX0pIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vbi1yZWxhdGl2ZSBlbnRyeSBwYXRocyBmYWxsIGludG8gb25lIG9mIHRoZSBmb2xsb3dpbmcgY2F0ZWdvcmllczpcbiAgICAgIC8vIC0gQWJzb2x1dGUgc3lzdGVtIHBhdGhzIChlLmcuIGAvZm9vL2Jhci9teS1wcm9qZWN0L215LW1vZHVsZWApLCB3aGljaCBhcmUgdW5hZmZlY3RlZCBieSB0aGVcbiAgICAgIC8vICAgbG9naWMgYmVsb3cuXG4gICAgICAvLyAtIFBhdGhzIHRvIGVudGVybmFsIG1vZHVsZXMgKGUuZy4gYHNvbWUtbGliYCkuXG4gICAgICAvLyAtIFBhdGhzIG1hcHBlZCB0byBkaXJlY3RvcmllcyBpbiBgdHNjb25maWcuanNvbmAgKGUuZy4gYHNoYXJlZC9teS1tb2R1bGVgKS5cbiAgICAgIC8vICAgKFNlZSBodHRwczovL3d3dy50eXBlc2NyaXB0bGFuZy5vcmcvZG9jcy9oYW5kYm9vay9tb2R1bGUtcmVzb2x1dGlvbi5odG1sI3BhdGgtbWFwcGluZy4pXG4gICAgICAvL1xuICAgICAgLy8gSW4gYWxsIGNhc2VzIGFib3ZlLCB0aGUgYGNvbnRhaW5pbmdGaWxlYCBhcmd1bWVudCBpcyBpZ25vcmVkLCBzbyB3ZSBjYW4ganVzdCB0YWtlIHRoZSBmaXJzdFxuICAgICAgLy8gb2YgdGhlIHJvb3QgZmlsZXMuXG4gICAgICBjb25zdCBjb250YWluaW5nRmlsZSA9IHRoaXMuaW5wdXRQcm9ncmFtLmdldFJvb3RGaWxlTmFtZXMoKVswXTtcbiAgICAgIGNvbnN0IFtlbnRyeVBhdGgsIG1vZHVsZU5hbWVdID0gZW50cnlSb3V0ZS5zcGxpdCgnIycpO1xuICAgICAgY29uc3QgcmVzb2x2ZWRNb2R1bGUgPVxuICAgICAgICAgIHJlc29sdmVNb2R1bGVOYW1lKGVudHJ5UGF0aCwgY29udGFpbmluZ0ZpbGUsIHRoaXMub3B0aW9ucywgdGhpcy5hZGFwdGVyLCBudWxsKTtcblxuICAgICAgaWYgKHJlc29sdmVkTW9kdWxlKSB7XG4gICAgICAgIGVudHJ5Um91dGUgPSBlbnRyeVBvaW50S2V5Rm9yKHJlc29sdmVkTW9kdWxlLnJlc29sdmVkRmlsZU5hbWUsIG1vZHVsZU5hbWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbXBpbGF0aW9uID0gdGhpcy5lbnN1cmVBbmFseXplZCgpO1xuICAgIHJldHVybiBjb21waWxhdGlvbi5yb3V0ZUFuYWx5emVyLmxpc3RMYXp5Um91dGVzKGVudHJ5Um91dGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZldGNoIHRyYW5zZm9ybWVycyBhbmQgb3RoZXIgaW5mb3JtYXRpb24gd2hpY2ggaXMgbmVjZXNzYXJ5IGZvciBhIGNvbnN1bWVyIHRvIGBlbWl0YCB0aGVcbiAgICogcHJvZ3JhbSB3aXRoIEFuZ3VsYXItYWRkZWQgZGVmaW5pdGlvbnMuXG4gICAqL1xuICBwcmVwYXJlRW1pdCgpOiB7XG4gICAgdHJhbnNmb3JtZXJzOiB0cy5DdXN0b21UcmFuc2Zvcm1lcnMsXG4gIH0ge1xuICAgIGNvbnN0IGNvbXBpbGF0aW9uID0gdGhpcy5lbnN1cmVBbmFseXplZCgpO1xuXG4gICAgY29uc3QgY29yZUltcG9ydHNGcm9tID0gY29tcGlsYXRpb24uaXNDb3JlID8gZ2V0UjNTeW1ib2xzRmlsZSh0aGlzLmlucHV0UHJvZ3JhbSkgOiBudWxsO1xuICAgIGxldCBpbXBvcnRSZXdyaXRlcjogSW1wb3J0UmV3cml0ZXI7XG4gICAgaWYgKGNvcmVJbXBvcnRzRnJvbSAhPT0gbnVsbCkge1xuICAgICAgaW1wb3J0UmV3cml0ZXIgPSBuZXcgUjNTeW1ib2xzSW1wb3J0UmV3cml0ZXIoY29yZUltcG9ydHNGcm9tLmZpbGVOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW1wb3J0UmV3cml0ZXIgPSBuZXcgTm9vcEltcG9ydFJld3JpdGVyKCk7XG4gICAgfVxuXG4gICAgY29uc3QgZGVmYXVsdEltcG9ydFRyYWNrZXIgPSBuZXcgRGVmYXVsdEltcG9ydFRyYWNrZXIoKTtcblxuICAgIGNvbnN0IGJlZm9yZSA9IFtcbiAgICAgIGl2eVRyYW5zZm9ybUZhY3RvcnkoXG4gICAgICAgICAgY29tcGlsYXRpb24udHJhaXRDb21waWxlciwgY29tcGlsYXRpb24ucmVmbGVjdG9yLCBpbXBvcnRSZXdyaXRlciwgZGVmYXVsdEltcG9ydFRyYWNrZXIsXG4gICAgICAgICAgdGhpcy5kZWxlZ2F0aW5nUGVyZlJlY29yZGVyLCBjb21waWxhdGlvbi5pc0NvcmUsIHRoaXMuY2xvc3VyZUNvbXBpbGVyRW5hYmxlZCksXG4gICAgICBhbGlhc1RyYW5zZm9ybUZhY3RvcnkoY29tcGlsYXRpb24udHJhaXRDb21waWxlci5leHBvcnRTdGF0ZW1lbnRzKSxcbiAgICAgIGRlZmF1bHRJbXBvcnRUcmFja2VyLmltcG9ydFByZXNlcnZpbmdUcmFuc2Zvcm1lcigpLFxuICAgIF07XG5cbiAgICBjb25zdCBhZnRlckRlY2xhcmF0aW9uczogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+W10gPSBbXTtcbiAgICBpZiAoY29tcGlsYXRpb24uZHRzVHJhbnNmb3JtcyAhPT0gbnVsbCkge1xuICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnMucHVzaChcbiAgICAgICAgICBkZWNsYXJhdGlvblRyYW5zZm9ybUZhY3RvcnkoY29tcGlsYXRpb24uZHRzVHJhbnNmb3JtcywgaW1wb3J0UmV3cml0ZXIpKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGFkZCBhbGlhc2luZyByZS1leHBvcnRzIHRvIHRoZSAuZC50cyBvdXRwdXQgaWYgdGhlIGBBbGlhc2luZ0hvc3RgIHJlcXVlc3RzIGl0LlxuICAgIGlmIChjb21waWxhdGlvbi5hbGlhc2luZ0hvc3QgIT09IG51bGwgJiYgY29tcGlsYXRpb24uYWxpYXNpbmdIb3N0LmFsaWFzRXhwb3J0c0luRHRzKSB7XG4gICAgICBhZnRlckRlY2xhcmF0aW9ucy5wdXNoKGFsaWFzVHJhbnNmb3JtRmFjdG9yeShjb21waWxhdGlvbi50cmFpdENvbXBpbGVyLmV4cG9ydFN0YXRlbWVudHMpKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hZGFwdGVyLmZhY3RvcnlUcmFja2VyICE9PSBudWxsKSB7XG4gICAgICBiZWZvcmUucHVzaChcbiAgICAgICAgICBnZW5lcmF0ZWRGYWN0b3J5VHJhbnNmb3JtKHRoaXMuYWRhcHRlci5mYWN0b3J5VHJhY2tlci5zb3VyY2VJbmZvLCBpbXBvcnRSZXdyaXRlcikpO1xuICAgIH1cbiAgICBiZWZvcmUucHVzaChpdnlTd2l0Y2hUcmFuc2Zvcm0pO1xuXG4gICAgcmV0dXJuIHt0cmFuc2Zvcm1lcnM6IHtiZWZvcmUsIGFmdGVyRGVjbGFyYXRpb25zfSBhcyB0cy5DdXN0b21UcmFuc2Zvcm1lcnN9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJ1biB0aGUgaW5kZXhpbmcgcHJvY2VzcyBhbmQgcmV0dXJuIGEgYE1hcGAgb2YgYWxsIGluZGV4ZWQgY29tcG9uZW50cy5cbiAgICpcbiAgICogU2VlIHRoZSBgaW5kZXhpbmdgIHBhY2thZ2UgZm9yIG1vcmUgZGV0YWlscy5cbiAgICovXG4gIGdldEluZGV4ZWRDb21wb25lbnRzKCk6IE1hcDxEZWNsYXJhdGlvbk5vZGUsIEluZGV4ZWRDb21wb25lbnQ+IHtcbiAgICBjb25zdCBjb21waWxhdGlvbiA9IHRoaXMuZW5zdXJlQW5hbHl6ZWQoKTtcbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IEluZGV4aW5nQ29udGV4dCgpO1xuICAgIGNvbXBpbGF0aW9uLnRyYWl0Q29tcGlsZXIuaW5kZXgoY29udGV4dCk7XG4gICAgcmV0dXJuIGdlbmVyYXRlQW5hbHlzaXMoY29udGV4dCk7XG4gIH1cblxuICAvKipcbiAgICogQ29sbGVjdCBpMThuIG1lc3NhZ2VzIGludG8gdGhlIGBYaTE4bkNvbnRleHRgLlxuICAgKi9cbiAgeGkxOG4oY3R4OiBYaTE4bkNvbnRleHQpOiB2b2lkIHtcbiAgICAvLyBOb3RlIHRoYXQgdGhlICdyZXNvbHZlJyBwaGFzZSBpcyBub3Qgc3RyaWN0bHkgbmVjZXNzYXJ5IGZvciB4aTE4biwgYnV0IHRoaXMgaXMgbm90IGN1cnJlbnRseVxuICAgIC8vIG9wdGltaXplZC5cbiAgICBjb25zdCBjb21waWxhdGlvbiA9IHRoaXMuZW5zdXJlQW5hbHl6ZWQoKTtcbiAgICBjb21waWxhdGlvbi50cmFpdENvbXBpbGVyLnhpMThuKGN0eCk7XG4gIH1cblxuICBwcml2YXRlIGVuc3VyZUFuYWx5emVkKHRoaXM6IE5nQ29tcGlsZXIpOiBMYXp5Q29tcGlsYXRpb25TdGF0ZSB7XG4gICAgaWYgKHRoaXMuY29tcGlsYXRpb24gPT09IG51bGwpIHtcbiAgICAgIHRoaXMuYW5hbHl6ZVN5bmMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsYXRpb24hO1xuICB9XG5cbiAgcHJpdmF0ZSBhbmFseXplU3luYygpOiB2b2lkIHtcbiAgICB0aGlzLnBlcmZSZWNvcmRlci5pblBoYXNlKFBlcmZQaGFzZS5BbmFseXNpcywgKCkgPT4ge1xuICAgICAgdGhpcy5jb21waWxhdGlvbiA9IHRoaXMubWFrZUNvbXBpbGF0aW9uKCk7XG4gICAgICBmb3IgKGNvbnN0IHNmIG9mIHRoaXMuaW5wdXRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgaWYgKHNmLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb21waWxhdGlvbi50cmFpdENvbXBpbGVyLmFuYWx5emVTeW5jKHNmKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wZXJmUmVjb3JkZXIubWVtb3J5KFBlcmZDaGVja3BvaW50LkFuYWx5c2lzKTtcblxuICAgICAgdGhpcy5yZXNvbHZlQ29tcGlsYXRpb24odGhpcy5jb21waWxhdGlvbi50cmFpdENvbXBpbGVyKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzb2x2ZUNvbXBpbGF0aW9uKHRyYWl0Q29tcGlsZXI6IFRyYWl0Q29tcGlsZXIpOiB2b2lkIHtcbiAgICB0aGlzLnBlcmZSZWNvcmRlci5pblBoYXNlKFBlcmZQaGFzZS5SZXNvbHZlLCAoKSA9PiB7XG4gICAgICB0cmFpdENvbXBpbGVyLnJlc29sdmUoKTtcblxuICAgICAgLy8gQXQgdGhpcyBwb2ludCwgYW5hbHlzaXMgaXMgY29tcGxldGUgYW5kIHRoZSBjb21waWxlciBjYW4gbm93IGNhbGN1bGF0ZSB3aGljaCBmaWxlcyBuZWVkIHRvXG4gICAgICAvLyBiZSBlbWl0dGVkLCBzbyBkbyB0aGF0LlxuICAgICAgdGhpcy5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxBbmFseXNpcyh0cmFpdENvbXBpbGVyKTtcblxuICAgICAgdGhpcy5wZXJmUmVjb3JkZXIubWVtb3J5KFBlcmZDaGVja3BvaW50LlJlc29sdmUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXQgZnVsbFRlbXBsYXRlVHlwZUNoZWNrKCk6IGJvb2xlYW4ge1xuICAgIC8vIERldGVybWluZSB0aGUgc3RyaWN0bmVzcyBsZXZlbCBvZiB0eXBlIGNoZWNraW5nIGJhc2VkIG9uIGNvbXBpbGVyIG9wdGlvbnMuIEFzXG4gICAgLy8gYHN0cmljdFRlbXBsYXRlc2AgaXMgYSBzdXBlcnNldCBvZiBgZnVsbFRlbXBsYXRlVHlwZUNoZWNrYCwgdGhlIGZvcm1lciBpbXBsaWVzIHRoZSBsYXR0ZXIuXG4gICAgLy8gQWxzbyBzZWUgYHZlcmlmeUNvbXBhdGlibGVUeXBlQ2hlY2tPcHRpb25zYCB3aGVyZSBpdCBpcyB2ZXJpZmllZCB0aGF0IGBmdWxsVGVtcGxhdGVUeXBlQ2hlY2tgXG4gICAgLy8gaXMgbm90IGRpc2FibGVkIHdoZW4gYHN0cmljdFRlbXBsYXRlc2AgaXMgZW5hYmxlZC5cbiAgICBjb25zdCBzdHJpY3RUZW1wbGF0ZXMgPSAhIXRoaXMub3B0aW9ucy5zdHJpY3RUZW1wbGF0ZXM7XG4gICAgcmV0dXJuIHN0cmljdFRlbXBsYXRlcyB8fCAhIXRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2s7XG4gIH1cblxuICBwcml2YXRlIGdldFR5cGVDaGVja2luZ0NvbmZpZygpOiBUeXBlQ2hlY2tpbmdDb25maWcge1xuICAgIC8vIERldGVybWluZSB0aGUgc3RyaWN0bmVzcyBsZXZlbCBvZiB0eXBlIGNoZWNraW5nIGJhc2VkIG9uIGNvbXBpbGVyIG9wdGlvbnMuIEFzXG4gICAgLy8gYHN0cmljdFRlbXBsYXRlc2AgaXMgYSBzdXBlcnNldCBvZiBgZnVsbFRlbXBsYXRlVHlwZUNoZWNrYCwgdGhlIGZvcm1lciBpbXBsaWVzIHRoZSBsYXR0ZXIuXG4gICAgLy8gQWxzbyBzZWUgYHZlcmlmeUNvbXBhdGlibGVUeXBlQ2hlY2tPcHRpb25zYCB3aGVyZSBpdCBpcyB2ZXJpZmllZCB0aGF0IGBmdWxsVGVtcGxhdGVUeXBlQ2hlY2tgXG4gICAgLy8gaXMgbm90IGRpc2FibGVkIHdoZW4gYHN0cmljdFRlbXBsYXRlc2AgaXMgZW5hYmxlZC5cbiAgICBjb25zdCBzdHJpY3RUZW1wbGF0ZXMgPSAhIXRoaXMub3B0aW9ucy5zdHJpY3RUZW1wbGF0ZXM7XG5cbiAgICBjb25zdCB1c2VJbmxpbmVUeXBlQ29uc3RydWN0b3JzID0gdGhpcy5wcm9ncmFtRHJpdmVyLnN1cHBvcnRzSW5saW5lT3BlcmF0aW9ucztcblxuICAgIC8vIEZpcnN0IHNlbGVjdCBhIHR5cGUtY2hlY2tpbmcgY29uZmlndXJhdGlvbiwgYmFzZWQgb24gd2hldGhlciBmdWxsIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgaXNcbiAgICAvLyByZXF1ZXN0ZWQuXG4gICAgbGV0IHR5cGVDaGVja2luZ0NvbmZpZzogVHlwZUNoZWNraW5nQ29uZmlnO1xuICAgIGlmICh0aGlzLmZ1bGxUZW1wbGF0ZVR5cGVDaGVjaykge1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnID0ge1xuICAgICAgICBhcHBseVRlbXBsYXRlQ29udGV4dEd1YXJkczogc3RyaWN0VGVtcGxhdGVzLFxuICAgICAgICBjaGVja1F1ZXJpZXM6IGZhbHNlLFxuICAgICAgICBjaGVja1RlbXBsYXRlQm9kaWVzOiB0cnVlLFxuICAgICAgICBhbHdheXNDaGVja1NjaGVtYUluVGVtcGxhdGVCb2RpZXM6IHRydWUsXG4gICAgICAgIGNoZWNrVHlwZU9mSW5wdXRCaW5kaW5nczogc3RyaWN0VGVtcGxhdGVzLFxuICAgICAgICBob25vckFjY2Vzc01vZGlmaWVyc0ZvcklucHV0QmluZGluZ3M6IGZhbHNlLFxuICAgICAgICBzdHJpY3ROdWxsSW5wdXRCaW5kaW5nczogc3RyaWN0VGVtcGxhdGVzLFxuICAgICAgICBjaGVja1R5cGVPZkF0dHJpYnV0ZXM6IHN0cmljdFRlbXBsYXRlcyxcbiAgICAgICAgLy8gRXZlbiBpbiBmdWxsIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgbW9kZSwgRE9NIGJpbmRpbmcgY2hlY2tzIGFyZSBub3QgcXVpdGUgcmVhZHkgeWV0LlxuICAgICAgICBjaGVja1R5cGVPZkRvbUJpbmRpbmdzOiBmYWxzZSxcbiAgICAgICAgY2hlY2tUeXBlT2ZPdXRwdXRFdmVudHM6IHN0cmljdFRlbXBsYXRlcyxcbiAgICAgICAgY2hlY2tUeXBlT2ZBbmltYXRpb25FdmVudHM6IHN0cmljdFRlbXBsYXRlcyxcbiAgICAgICAgLy8gQ2hlY2tpbmcgb2YgRE9NIGV2ZW50cyBjdXJyZW50bHkgaGFzIGFuIGFkdmVyc2UgZWZmZWN0IG9uIGRldmVsb3BlciBleHBlcmllbmNlLFxuICAgICAgICAvLyBlLmcuIGZvciBgPGlucHV0IChibHVyKT1cInVwZGF0ZSgkZXZlbnQudGFyZ2V0LnZhbHVlKVwiPmAgZW5hYmxpbmcgdGhpcyBjaGVjayByZXN1bHRzIGluOlxuICAgICAgICAvLyAtIGVycm9yIFRTMjUzMTogT2JqZWN0IGlzIHBvc3NpYmx5ICdudWxsJy5cbiAgICAgICAgLy8gLSBlcnJvciBUUzIzMzk6IFByb3BlcnR5ICd2YWx1ZScgZG9lcyBub3QgZXhpc3Qgb24gdHlwZSAnRXZlbnRUYXJnZXQnLlxuICAgICAgICBjaGVja1R5cGVPZkRvbUV2ZW50czogc3RyaWN0VGVtcGxhdGVzLFxuICAgICAgICBjaGVja1R5cGVPZkRvbVJlZmVyZW5jZXM6IHN0cmljdFRlbXBsYXRlcyxcbiAgICAgICAgLy8gTm9uLURPTSByZWZlcmVuY2VzIGhhdmUgdGhlIGNvcnJlY3QgdHlwZSBpbiBWaWV3IEVuZ2luZSBzbyB0aGVyZSBpcyBubyBzdHJpY3RuZXNzIGZsYWcuXG4gICAgICAgIGNoZWNrVHlwZU9mTm9uRG9tUmVmZXJlbmNlczogdHJ1ZSxcbiAgICAgICAgLy8gUGlwZXMgYXJlIGNoZWNrZWQgaW4gVmlldyBFbmdpbmUgc28gdGhlcmUgaXMgbm8gc3RyaWN0bmVzcyBmbGFnLlxuICAgICAgICBjaGVja1R5cGVPZlBpcGVzOiB0cnVlLFxuICAgICAgICBzdHJpY3RTYWZlTmF2aWdhdGlvblR5cGVzOiBzdHJpY3RUZW1wbGF0ZXMsXG4gICAgICAgIHVzZUNvbnRleHRHZW5lcmljVHlwZTogc3RyaWN0VGVtcGxhdGVzLFxuICAgICAgICBzdHJpY3RMaXRlcmFsVHlwZXM6IHRydWUsXG4gICAgICAgIGVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXI6IHRoaXMuZW5hYmxlVGVtcGxhdGVUeXBlQ2hlY2tlcixcbiAgICAgICAgdXNlSW5saW5lVHlwZUNvbnN0cnVjdG9ycyxcbiAgICAgICAgLy8gV2FybmluZ3MgZm9yIHN1Ym9wdGltYWwgdHlwZSBpbmZlcmVuY2UgYXJlIG9ubHkgZW5hYmxlZCBpZiBpbiBMYW5ndWFnZSBTZXJ2aWNlIG1vZGVcbiAgICAgICAgLy8gKHByb3ZpZGluZyB0aGUgZnVsbCBUZW1wbGF0ZVR5cGVDaGVja2VyIEFQSSkgYW5kIGlmIHN0cmljdCBtb2RlIGlzIG5vdCBlbmFibGVkLiBJbiBzdHJpY3RcbiAgICAgICAgLy8gbW9kZSwgdGhlIHVzZXIgaXMgaW4gZnVsbCBjb250cm9sIG9mIHR5cGUgaW5mZXJlbmNlLlxuICAgICAgICBzdWdnZXN0aW9uc0ZvclN1Ym9wdGltYWxUeXBlSW5mZXJlbmNlOiB0aGlzLmVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIgJiYgIXN0cmljdFRlbXBsYXRlcyxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHR5cGVDaGVja2luZ0NvbmZpZyA9IHtcbiAgICAgICAgYXBwbHlUZW1wbGF0ZUNvbnRleHRHdWFyZHM6IGZhbHNlLFxuICAgICAgICBjaGVja1F1ZXJpZXM6IGZhbHNlLFxuICAgICAgICBjaGVja1RlbXBsYXRlQm9kaWVzOiBmYWxzZSxcbiAgICAgICAgLy8gRW5hYmxlIGRlZXAgc2NoZW1hIGNoZWNraW5nIGluIFwiYmFzaWNcIiB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIG1vZGUgb25seSBpZiBDbG9zdXJlXG4gICAgICAgIC8vIGNvbXBpbGF0aW9uIGlzIHJlcXVlc3RlZCwgd2hpY2ggaXMgYSBnb29kIHByb3h5IGZvciBcIm9ubHkgaW4gZ29vZ2xlM1wiLlxuICAgICAgICBhbHdheXNDaGVja1NjaGVtYUluVGVtcGxhdGVCb2RpZXM6IHRoaXMuY2xvc3VyZUNvbXBpbGVyRW5hYmxlZCxcbiAgICAgICAgY2hlY2tUeXBlT2ZJbnB1dEJpbmRpbmdzOiBmYWxzZSxcbiAgICAgICAgc3RyaWN0TnVsbElucHV0QmluZGluZ3M6IGZhbHNlLFxuICAgICAgICBob25vckFjY2Vzc01vZGlmaWVyc0ZvcklucHV0QmluZGluZ3M6IGZhbHNlLFxuICAgICAgICBjaGVja1R5cGVPZkF0dHJpYnV0ZXM6IGZhbHNlLFxuICAgICAgICBjaGVja1R5cGVPZkRvbUJpbmRpbmdzOiBmYWxzZSxcbiAgICAgICAgY2hlY2tUeXBlT2ZPdXRwdXRFdmVudHM6IGZhbHNlLFxuICAgICAgICBjaGVja1R5cGVPZkFuaW1hdGlvbkV2ZW50czogZmFsc2UsXG4gICAgICAgIGNoZWNrVHlwZU9mRG9tRXZlbnRzOiBmYWxzZSxcbiAgICAgICAgY2hlY2tUeXBlT2ZEb21SZWZlcmVuY2VzOiBmYWxzZSxcbiAgICAgICAgY2hlY2tUeXBlT2ZOb25Eb21SZWZlcmVuY2VzOiBmYWxzZSxcbiAgICAgICAgY2hlY2tUeXBlT2ZQaXBlczogZmFsc2UsXG4gICAgICAgIHN0cmljdFNhZmVOYXZpZ2F0aW9uVHlwZXM6IGZhbHNlLFxuICAgICAgICB1c2VDb250ZXh0R2VuZXJpY1R5cGU6IGZhbHNlLFxuICAgICAgICBzdHJpY3RMaXRlcmFsVHlwZXM6IGZhbHNlLFxuICAgICAgICBlbmFibGVUZW1wbGF0ZVR5cGVDaGVja2VyOiB0aGlzLmVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIsXG4gICAgICAgIHVzZUlubGluZVR5cGVDb25zdHJ1Y3RvcnMsXG4gICAgICAgIC8vIEluIFwiYmFzaWNcIiB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIG1vZGUsIG5vIHdhcm5pbmdzIGFyZSBwcm9kdWNlZCBzaW5jZSBtb3N0IHRoaW5ncyBhcmVcbiAgICAgICAgLy8gbm90IGNoZWNrZWQgYW55d2F5cy5cbiAgICAgICAgc3VnZ2VzdGlvbnNGb3JTdWJvcHRpbWFsVHlwZUluZmVyZW5jZTogZmFsc2UsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEFwcGx5IGV4cGxpY2l0bHkgY29uZmlndXJlZCBzdHJpY3RuZXNzIGZsYWdzIG9uIHRvcCBvZiB0aGUgZGVmYXVsdCBjb25maWd1cmF0aW9uXG4gICAgLy8gYmFzZWQgb24gXCJmdWxsVGVtcGxhdGVUeXBlQ2hlY2tcIi5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmljdElucHV0VHlwZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnLmNoZWNrVHlwZU9mSW5wdXRCaW5kaW5ncyA9IHRoaXMub3B0aW9ucy5zdHJpY3RJbnB1dFR5cGVzO1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnLmFwcGx5VGVtcGxhdGVDb250ZXh0R3VhcmRzID0gdGhpcy5vcHRpb25zLnN0cmljdElucHV0VHlwZXM7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaWN0SW5wdXRBY2Nlc3NNb2RpZmllcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnLmhvbm9yQWNjZXNzTW9kaWZpZXJzRm9ySW5wdXRCaW5kaW5ncyA9XG4gICAgICAgICAgdGhpcy5vcHRpb25zLnN0cmljdElucHV0QWNjZXNzTW9kaWZpZXJzO1xuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmljdE51bGxJbnB1dFR5cGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHR5cGVDaGVja2luZ0NvbmZpZy5zdHJpY3ROdWxsSW5wdXRCaW5kaW5ncyA9IHRoaXMub3B0aW9ucy5zdHJpY3ROdWxsSW5wdXRUeXBlcztcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpY3RPdXRwdXRFdmVudFR5cGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHR5cGVDaGVja2luZ0NvbmZpZy5jaGVja1R5cGVPZk91dHB1dEV2ZW50cyA9IHRoaXMub3B0aW9ucy5zdHJpY3RPdXRwdXRFdmVudFR5cGVzO1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnLmNoZWNrVHlwZU9mQW5pbWF0aW9uRXZlbnRzID0gdGhpcy5vcHRpb25zLnN0cmljdE91dHB1dEV2ZW50VHlwZXM7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaWN0RG9tRXZlbnRUeXBlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0eXBlQ2hlY2tpbmdDb25maWcuY2hlY2tUeXBlT2ZEb21FdmVudHMgPSB0aGlzLm9wdGlvbnMuc3RyaWN0RG9tRXZlbnRUeXBlcztcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpY3RTYWZlTmF2aWdhdGlvblR5cGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHR5cGVDaGVja2luZ0NvbmZpZy5zdHJpY3RTYWZlTmF2aWdhdGlvblR5cGVzID0gdGhpcy5vcHRpb25zLnN0cmljdFNhZmVOYXZpZ2F0aW9uVHlwZXM7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaWN0RG9tTG9jYWxSZWZUeXBlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0eXBlQ2hlY2tpbmdDb25maWcuY2hlY2tUeXBlT2ZEb21SZWZlcmVuY2VzID0gdGhpcy5vcHRpb25zLnN0cmljdERvbUxvY2FsUmVmVHlwZXM7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaWN0QXR0cmlidXRlVHlwZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnLmNoZWNrVHlwZU9mQXR0cmlidXRlcyA9IHRoaXMub3B0aW9ucy5zdHJpY3RBdHRyaWJ1dGVUeXBlcztcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpY3RDb250ZXh0R2VuZXJpY3MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdHlwZUNoZWNraW5nQ29uZmlnLnVzZUNvbnRleHRHZW5lcmljVHlwZSA9IHRoaXMub3B0aW9ucy5zdHJpY3RDb250ZXh0R2VuZXJpY3M7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaWN0TGl0ZXJhbFR5cGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHR5cGVDaGVja2luZ0NvbmZpZy5zdHJpY3RMaXRlcmFsVHlwZXMgPSB0aGlzLm9wdGlvbnMuc3RyaWN0TGl0ZXJhbFR5cGVzO1xuICAgIH1cblxuICAgIHJldHVybiB0eXBlQ2hlY2tpbmdDb25maWc7XG4gIH1cblxuICBwcml2YXRlIGdldFRlbXBsYXRlRGlhZ25vc3RpY3MoKTogUmVhZG9ubHlBcnJheTx0cy5EaWFnbm9zdGljPiB7XG4gICAgY29uc3QgY29tcGlsYXRpb24gPSB0aGlzLmVuc3VyZUFuYWx5emVkKCk7XG5cbiAgICAvLyBHZXQgdGhlIGRpYWdub3N0aWNzLlxuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNmIG9mIHRoaXMuaW5wdXRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChzZi5pc0RlY2xhcmF0aW9uRmlsZSB8fCB0aGlzLmFkYXB0ZXIuaXNTaGltKHNmKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZGlhZ25vc3RpY3MucHVzaChcbiAgICAgICAgICAuLi5jb21waWxhdGlvbi50ZW1wbGF0ZVR5cGVDaGVja2VyLmdldERpYWdub3N0aWNzRm9yRmlsZShzZiwgT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtKSk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvZ3JhbSA9IHRoaXMucHJvZ3JhbURyaXZlci5nZXRQcm9ncmFtKCk7XG4gICAgdGhpcy5pbmNyZW1lbnRhbFN0cmF0ZWd5LnNldEluY3JlbWVudGFsU3RhdGUodGhpcy5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnN0YXRlLCBwcm9ncmFtKTtcbiAgICB0aGlzLmN1cnJlbnRQcm9ncmFtID0gcHJvZ3JhbTtcblxuICAgIHJldHVybiBkaWFnbm9zdGljcztcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VGVtcGxhdGVEaWFnbm9zdGljc0ZvckZpbGUoc2Y6IHRzLlNvdXJjZUZpbGUsIG9wdGltaXplRm9yOiBPcHRpbWl6ZUZvcik6XG4gICAgICBSZWFkb25seUFycmF5PHRzLkRpYWdub3N0aWM+IHtcbiAgICBjb25zdCBjb21waWxhdGlvbiA9IHRoaXMuZW5zdXJlQW5hbHl6ZWQoKTtcblxuICAgIC8vIEdldCB0aGUgZGlhZ25vc3RpY3MuXG4gICAgY29uc3QgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuICAgIGlmICghc2YuaXNEZWNsYXJhdGlvbkZpbGUgJiYgIXRoaXMuYWRhcHRlci5pc1NoaW0oc2YpKSB7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLmNvbXBpbGF0aW9uLnRlbXBsYXRlVHlwZUNoZWNrZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNmLCBvcHRpbWl6ZUZvcikpO1xuICAgIH1cblxuICAgIGNvbnN0IHByb2dyYW0gPSB0aGlzLnByb2dyYW1Ecml2ZXIuZ2V0UHJvZ3JhbSgpO1xuICAgIHRoaXMuaW5jcmVtZW50YWxTdHJhdGVneS5zZXRJbmNyZW1lbnRhbFN0YXRlKHRoaXMuaW5jcmVtZW50YWxDb21waWxhdGlvbi5zdGF0ZSwgcHJvZ3JhbSk7XG4gICAgdGhpcy5jdXJyZW50UHJvZ3JhbSA9IHByb2dyYW07XG5cbiAgICByZXR1cm4gZGlhZ25vc3RpY3M7XG4gIH1cblxuICBwcml2YXRlIGdldE5vblRlbXBsYXRlRGlhZ25vc3RpY3MoKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgICBpZiAodGhpcy5ub25UZW1wbGF0ZURpYWdub3N0aWNzID09PSBudWxsKSB7XG4gICAgICBjb25zdCBjb21waWxhdGlvbiA9IHRoaXMuZW5zdXJlQW5hbHl6ZWQoKTtcbiAgICAgIHRoaXMubm9uVGVtcGxhdGVEaWFnbm9zdGljcyA9IFsuLi5jb21waWxhdGlvbi50cmFpdENvbXBpbGVyLmRpYWdub3N0aWNzXTtcbiAgICAgIGlmICh0aGlzLmVudHJ5UG9pbnQgIT09IG51bGwgJiYgY29tcGlsYXRpb24uZXhwb3J0UmVmZXJlbmNlR3JhcGggIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5ub25UZW1wbGF0ZURpYWdub3N0aWNzLnB1c2goLi4uY2hlY2tGb3JQcml2YXRlRXhwb3J0cyhcbiAgICAgICAgICAgIHRoaXMuZW50cnlQb2ludCwgdGhpcy5pbnB1dFByb2dyYW0uZ2V0VHlwZUNoZWNrZXIoKSwgY29tcGlsYXRpb24uZXhwb3J0UmVmZXJlbmNlR3JhcGgpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubm9uVGVtcGxhdGVEaWFnbm9zdGljcztcbiAgfVxuXG4gIHByaXZhdGUgbWFrZUNvbXBpbGF0aW9uKCk6IExhenlDb21waWxhdGlvblN0YXRlIHtcbiAgICBjb25zdCBjaGVja2VyID0gdGhpcy5pbnB1dFByb2dyYW0uZ2V0VHlwZUNoZWNrZXIoKTtcblxuICAgIGNvbnN0IHJlZmxlY3RvciA9IG5ldyBUeXBlU2NyaXB0UmVmbGVjdGlvbkhvc3QoY2hlY2tlcik7XG5cbiAgICAvLyBDb25zdHJ1Y3QgdGhlIFJlZmVyZW5jZUVtaXR0ZXIuXG4gICAgbGV0IHJlZkVtaXR0ZXI6IFJlZmVyZW5jZUVtaXR0ZXI7XG4gICAgbGV0IGFsaWFzaW5nSG9zdDogQWxpYXNpbmdIb3N0fG51bGwgPSBudWxsO1xuICAgIGlmICh0aGlzLmFkYXB0ZXIudW5pZmllZE1vZHVsZXNIb3N0ID09PSBudWxsIHx8ICF0aGlzLm9wdGlvbnMuX3VzZUhvc3RGb3JJbXBvcnRHZW5lcmF0aW9uKSB7XG4gICAgICBsZXQgbG9jYWxJbXBvcnRTdHJhdGVneTogUmVmZXJlbmNlRW1pdFN0cmF0ZWd5O1xuXG4gICAgICAvLyBUaGUgc3RyYXRlZ3kgdXNlZCBmb3IgbG9jYWwsIGluLXByb2plY3QgaW1wb3J0cyBkZXBlbmRzIG9uIHdoZXRoZXIgVFMgaGFzIGJlZW4gY29uZmlndXJlZFxuICAgICAgLy8gd2l0aCByb290RGlycy4gSWYgc28sIHRoZW4gbXVsdGlwbGUgZGlyZWN0b3JpZXMgbWF5IGJlIG1hcHBlZCBpbiB0aGUgc2FtZSBcIm1vZHVsZVxuICAgICAgLy8gbmFtZXNwYWNlXCIgYW5kIHRoZSBsb2dpYyBvZiBgTG9naWNhbFByb2plY3RTdHJhdGVneWAgaXMgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgY29ycmVjdFxuICAgICAgLy8gaW1wb3J0cyB3aGljaCBtYXkgY3Jvc3MgdGhlc2UgbXVsdGlwbGUgZGlyZWN0b3JpZXMuIE90aGVyd2lzZSwgcGxhaW4gcmVsYXRpdmUgaW1wb3J0cyBhcmVcbiAgICAgIC8vIHN1ZmZpY2llbnQuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnJvb3REaXIgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICh0aGlzLm9wdGlvbnMucm9vdERpcnMgIT09IHVuZGVmaW5lZCAmJiB0aGlzLm9wdGlvbnMucm9vdERpcnMubGVuZ3RoID4gMCkpIHtcbiAgICAgICAgLy8gcm9vdERpcnMgbG9naWMgaXMgaW4gZWZmZWN0IC0gdXNlIHRoZSBgTG9naWNhbFByb2plY3RTdHJhdGVneWAgZm9yIGluLXByb2plY3QgcmVsYXRpdmVcbiAgICAgICAgLy8gaW1wb3J0cy5cbiAgICAgICAgbG9jYWxJbXBvcnRTdHJhdGVneSA9IG5ldyBMb2dpY2FsUHJvamVjdFN0cmF0ZWd5KFxuICAgICAgICAgICAgcmVmbGVjdG9yLCBuZXcgTG9naWNhbEZpbGVTeXN0ZW0oWy4uLnRoaXMuYWRhcHRlci5yb290RGlyc10sIHRoaXMuYWRhcHRlcikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUGxhaW4gcmVsYXRpdmUgaW1wb3J0cyBhcmUgYWxsIHRoYXQncyBuZWVkZWQuXG4gICAgICAgIGxvY2FsSW1wb3J0U3RyYXRlZ3kgPSBuZXcgUmVsYXRpdmVQYXRoU3RyYXRlZ3kocmVmbGVjdG9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIENvbXBpbGVySG9zdCBkb2Vzbid0IGhhdmUgZmlsZU5hbWVUb01vZHVsZU5hbWUsIHNvIGJ1aWxkIGFuIE5QTS1jZW50cmljIHJlZmVyZW5jZVxuICAgICAgLy8gcmVzb2x1dGlvbiBzdHJhdGVneS5cbiAgICAgIHJlZkVtaXR0ZXIgPSBuZXcgUmVmZXJlbmNlRW1pdHRlcihbXG4gICAgICAgIC8vIEZpcnN0LCB0cnkgdG8gdXNlIGxvY2FsIGlkZW50aWZpZXJzIGlmIGF2YWlsYWJsZS5cbiAgICAgICAgbmV3IExvY2FsSWRlbnRpZmllclN0cmF0ZWd5KCksXG4gICAgICAgIC8vIE5leHQsIGF0dGVtcHQgdG8gdXNlIGFuIGFic29sdXRlIGltcG9ydC5cbiAgICAgICAgbmV3IEFic29sdXRlTW9kdWxlU3RyYXRlZ3kodGhpcy5pbnB1dFByb2dyYW0sIGNoZWNrZXIsIHRoaXMubW9kdWxlUmVzb2x2ZXIsIHJlZmxlY3RvciksXG4gICAgICAgIC8vIEZpbmFsbHksIGNoZWNrIGlmIHRoZSByZWZlcmVuY2UgaXMgYmVpbmcgd3JpdHRlbiBpbnRvIGEgZmlsZSB3aXRoaW4gdGhlIHByb2plY3QncyAudHNcbiAgICAgICAgLy8gc291cmNlcywgYW5kIHVzZSBhIHJlbGF0aXZlIGltcG9ydCBpZiBzby4gSWYgdGhpcyBmYWlscywgUmVmZXJlbmNlRW1pdHRlciB3aWxsIHRocm93XG4gICAgICAgIC8vIGFuIGVycm9yLlxuICAgICAgICBsb2NhbEltcG9ydFN0cmF0ZWd5LFxuICAgICAgXSk7XG5cbiAgICAgIC8vIElmIGFuIGVudHJ5cG9pbnQgaXMgcHJlc2VudCwgdGhlbiBhbGwgdXNlciBpbXBvcnRzIHNob3VsZCBiZSBkaXJlY3RlZCB0aHJvdWdoIHRoZVxuICAgICAgLy8gZW50cnlwb2ludCBhbmQgcHJpdmF0ZSBleHBvcnRzIGFyZSBub3QgbmVlZGVkLiBUaGUgY29tcGlsZXIgd2lsbCB2YWxpZGF0ZSB0aGF0IGFsbCBwdWJsaWNseVxuICAgICAgLy8gdmlzaWJsZSBkaXJlY3RpdmVzL3BpcGVzIGFyZSBpbXBvcnRhYmxlIHZpYSB0aGlzIGVudHJ5cG9pbnQuXG4gICAgICBpZiAodGhpcy5lbnRyeVBvaW50ID09PSBudWxsICYmIHRoaXMub3B0aW9ucy5nZW5lcmF0ZURlZXBSZWV4cG9ydHMgPT09IHRydWUpIHtcbiAgICAgICAgLy8gTm8gZW50cnlwb2ludCBpcyBwcmVzZW50IGFuZCBkZWVwIHJlLWV4cG9ydHMgd2VyZSByZXF1ZXN0ZWQsIHNvIGNvbmZpZ3VyZSB0aGUgYWxpYXNpbmdcbiAgICAgICAgLy8gc3lzdGVtIHRvIGdlbmVyYXRlIHRoZW0uXG4gICAgICAgIGFsaWFzaW5nSG9zdCA9IG5ldyBQcml2YXRlRXhwb3J0QWxpYXNpbmdIb3N0KHJlZmxlY3Rvcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBDb21waWxlckhvc3Qgc3VwcG9ydHMgZmlsZU5hbWVUb01vZHVsZU5hbWUsIHNvIHVzZSB0aGF0IHRvIGVtaXQgaW1wb3J0cy5cbiAgICAgIHJlZkVtaXR0ZXIgPSBuZXcgUmVmZXJlbmNlRW1pdHRlcihbXG4gICAgICAgIC8vIEZpcnN0LCB0cnkgdG8gdXNlIGxvY2FsIGlkZW50aWZpZXJzIGlmIGF2YWlsYWJsZS5cbiAgICAgICAgbmV3IExvY2FsSWRlbnRpZmllclN0cmF0ZWd5KCksXG4gICAgICAgIC8vIFRoZW4gdXNlIGFsaWFzZWQgcmVmZXJlbmNlcyAodGhpcyBpcyBhIHdvcmthcm91bmQgdG8gU3RyaWN0RGVwcyBjaGVja3MpLlxuICAgICAgICBuZXcgQWxpYXNTdHJhdGVneSgpLFxuICAgICAgICAvLyBUaGVuIHVzZSBmaWxlTmFtZVRvTW9kdWxlTmFtZSB0byBlbWl0IGltcG9ydHMuXG4gICAgICAgIG5ldyBVbmlmaWVkTW9kdWxlc1N0cmF0ZWd5KHJlZmxlY3RvciwgdGhpcy5hZGFwdGVyLnVuaWZpZWRNb2R1bGVzSG9zdCksXG4gICAgICBdKTtcbiAgICAgIGFsaWFzaW5nSG9zdCA9IG5ldyBVbmlmaWVkTW9kdWxlc0FsaWFzaW5nSG9zdCh0aGlzLmFkYXB0ZXIudW5pZmllZE1vZHVsZXNIb3N0KTtcbiAgICB9XG5cbiAgICBjb25zdCBldmFsdWF0b3IgPVxuICAgICAgICBuZXcgUGFydGlhbEV2YWx1YXRvcihyZWZsZWN0b3IsIGNoZWNrZXIsIHRoaXMuaW5jcmVtZW50YWxDb21waWxhdGlvbi5kZXBHcmFwaCk7XG4gICAgY29uc3QgZHRzUmVhZGVyID0gbmV3IER0c01ldGFkYXRhUmVhZGVyKGNoZWNrZXIsIHJlZmxlY3Rvcik7XG4gICAgY29uc3QgbG9jYWxNZXRhUmVnaXN0cnkgPSBuZXcgTG9jYWxNZXRhZGF0YVJlZ2lzdHJ5KCk7XG4gICAgY29uc3QgbG9jYWxNZXRhUmVhZGVyOiBNZXRhZGF0YVJlYWRlciA9IGxvY2FsTWV0YVJlZ2lzdHJ5O1xuICAgIGNvbnN0IGRlcFNjb3BlUmVhZGVyID0gbmV3IE1ldGFkYXRhRHRzTW9kdWxlU2NvcGVSZXNvbHZlcihkdHNSZWFkZXIsIGFsaWFzaW5nSG9zdCk7XG4gICAgY29uc3Qgc2NvcGVSZWdpc3RyeSA9XG4gICAgICAgIG5ldyBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnkobG9jYWxNZXRhUmVhZGVyLCBkZXBTY29wZVJlYWRlciwgcmVmRW1pdHRlciwgYWxpYXNpbmdIb3N0KTtcbiAgICBjb25zdCBzY29wZVJlYWRlcjogQ29tcG9uZW50U2NvcGVSZWFkZXIgPSBzY29wZVJlZ2lzdHJ5O1xuICAgIGNvbnN0IHNlbWFudGljRGVwR3JhcGhVcGRhdGVyID0gdGhpcy5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNlbWFudGljRGVwR3JhcGhVcGRhdGVyO1xuICAgIGNvbnN0IG1ldGFSZWdpc3RyeSA9IG5ldyBDb21wb3VuZE1ldGFkYXRhUmVnaXN0cnkoW2xvY2FsTWV0YVJlZ2lzdHJ5LCBzY29wZVJlZ2lzdHJ5XSk7XG4gICAgY29uc3QgaW5qZWN0YWJsZVJlZ2lzdHJ5ID0gbmV3IEluamVjdGFibGVDbGFzc1JlZ2lzdHJ5KHJlZmxlY3Rvcik7XG5cbiAgICBjb25zdCBtZXRhUmVhZGVyID0gbmV3IENvbXBvdW5kTWV0YWRhdGFSZWFkZXIoW2xvY2FsTWV0YVJlYWRlciwgZHRzUmVhZGVyXSk7XG4gICAgY29uc3QgdHlwZUNoZWNrU2NvcGVSZWdpc3RyeSA9IG5ldyBUeXBlQ2hlY2tTY29wZVJlZ2lzdHJ5KHNjb3BlUmVhZGVyLCBtZXRhUmVhZGVyKTtcblxuXG4gICAgLy8gSWYgYSBmbGF0IG1vZHVsZSBlbnRyeXBvaW50IHdhcyBzcGVjaWZpZWQsIHRoZW4gdHJhY2sgcmVmZXJlbmNlcyB2aWEgYSBgUmVmZXJlbmNlR3JhcGhgIGluXG4gICAgLy8gb3JkZXIgdG8gcHJvZHVjZSBwcm9wZXIgZGlhZ25vc3RpY3MgZm9yIGluY29ycmVjdGx5IGV4cG9ydGVkIGRpcmVjdGl2ZXMvcGlwZXMvZXRjLiBJZiB0aGVyZVxuICAgIC8vIGlzIG5vIGZsYXQgbW9kdWxlIGVudHJ5cG9pbnQgdGhlbiBkb24ndCBwYXkgdGhlIGNvc3Qgb2YgdHJhY2tpbmcgcmVmZXJlbmNlcy5cbiAgICBsZXQgcmVmZXJlbmNlc1JlZ2lzdHJ5OiBSZWZlcmVuY2VzUmVnaXN0cnk7XG4gICAgbGV0IGV4cG9ydFJlZmVyZW5jZUdyYXBoOiBSZWZlcmVuY2VHcmFwaHxudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5lbnRyeVBvaW50ICE9PSBudWxsKSB7XG4gICAgICBleHBvcnRSZWZlcmVuY2VHcmFwaCA9IG5ldyBSZWZlcmVuY2VHcmFwaCgpO1xuICAgICAgcmVmZXJlbmNlc1JlZ2lzdHJ5ID0gbmV3IFJlZmVyZW5jZUdyYXBoQWRhcHRlcihleHBvcnRSZWZlcmVuY2VHcmFwaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZmVyZW5jZXNSZWdpc3RyeSA9IG5ldyBOb29wUmVmZXJlbmNlc1JlZ2lzdHJ5KCk7XG4gICAgfVxuXG4gICAgY29uc3Qgcm91dGVBbmFseXplciA9IG5ldyBOZ01vZHVsZVJvdXRlQW5hbHl6ZXIodGhpcy5tb2R1bGVSZXNvbHZlciwgZXZhbHVhdG9yKTtcblxuICAgIGNvbnN0IGR0c1RyYW5zZm9ybXMgPSBuZXcgRHRzVHJhbnNmb3JtUmVnaXN0cnkoKTtcblxuICAgIGNvbnN0IGlzQ29yZSA9IGlzQW5ndWxhckNvcmVQYWNrYWdlKHRoaXMuaW5wdXRQcm9ncmFtKTtcblxuICAgIGNvbnN0IHJlc291cmNlUmVnaXN0cnkgPSBuZXcgUmVzb3VyY2VSZWdpc3RyeSgpO1xuXG4gICAgY29uc3QgY29tcGlsYXRpb25Nb2RlID1cbiAgICAgICAgdGhpcy5vcHRpb25zLmNvbXBpbGF0aW9uTW9kZSA9PT0gJ3BhcnRpYWwnID8gQ29tcGlsYXRpb25Nb2RlLlBBUlRJQUwgOiBDb21waWxhdGlvbk1vZGUuRlVMTDtcblxuICAgIC8vIEN5Y2xlcyBhcmUgaGFuZGxlZCBpbiBmdWxsIGNvbXBpbGF0aW9uIG1vZGUgYnkgXCJyZW1vdGUgc2NvcGluZ1wiLlxuICAgIC8vIFwiUmVtb3RlIHNjb3BpbmdcIiBkb2VzIG5vdCB3b3JrIHdlbGwgd2l0aCB0cmVlIHNoYWtpbmcgZm9yIGxpYnJhcmllcy5cbiAgICAvLyBTbyBpbiBwYXJ0aWFsIGNvbXBpbGF0aW9uIG1vZGUsIHdoZW4gYnVpbGRpbmcgYSBsaWJyYXJ5LCBhIGN5Y2xlIHdpbGwgY2F1c2UgYW4gZXJyb3IuXG4gICAgY29uc3QgY3ljbGVIYW5kbGluZ1N0cmF0ZWd5ID0gY29tcGlsYXRpb25Nb2RlID09PSBDb21waWxhdGlvbk1vZGUuRlVMTCA/XG4gICAgICAgIEN5Y2xlSGFuZGxpbmdTdHJhdGVneS5Vc2VSZW1vdGVTY29waW5nIDpcbiAgICAgICAgQ3ljbGVIYW5kbGluZ1N0cmF0ZWd5LkVycm9yO1xuXG4gICAgLy8gU2V0IHVwIHRoZSBJdnlDb21waWxhdGlvbiwgd2hpY2ggbWFuYWdlcyBzdGF0ZSBmb3IgdGhlIEl2eSB0cmFuc2Zvcm1lci5cbiAgICBjb25zdCBoYW5kbGVyczogRGVjb3JhdG9ySGFuZGxlcjx1bmtub3duLCB1bmtub3duLCBTZW1hbnRpY1N5bWJvbHxudWxsLCB1bmtub3duPltdID0gW1xuICAgICAgbmV3IENvbXBvbmVudERlY29yYXRvckhhbmRsZXIoXG4gICAgICAgICAgcmVmbGVjdG9yLCBldmFsdWF0b3IsIG1ldGFSZWdpc3RyeSwgbWV0YVJlYWRlciwgc2NvcGVSZWFkZXIsIHNjb3BlUmVnaXN0cnksXG4gICAgICAgICAgdHlwZUNoZWNrU2NvcGVSZWdpc3RyeSwgcmVzb3VyY2VSZWdpc3RyeSwgaXNDb3JlLCB0aGlzLnJlc291cmNlTWFuYWdlcixcbiAgICAgICAgICB0aGlzLmFkYXB0ZXIucm9vdERpcnMsIHRoaXMub3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2VzIHx8IGZhbHNlLFxuICAgICAgICAgIHRoaXMub3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHMgIT09IGZhbHNlLFxuICAgICAgICAgIHRoaXMub3B0aW9ucy5lbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ICE9PSBmYWxzZSwgdGhpcy51c2VQb2lzb25lZERhdGEsXG4gICAgICAgICAgdGhpcy5vcHRpb25zLmkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVcywgdGhpcy5tb2R1bGVSZXNvbHZlciwgdGhpcy5jeWNsZUFuYWx5emVyLFxuICAgICAgICAgIGN5Y2xlSGFuZGxpbmdTdHJhdGVneSwgcmVmRW1pdHRlciwgdGhpcy5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLmRlcEdyYXBoLFxuICAgICAgICAgIGluamVjdGFibGVSZWdpc3RyeSwgc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIsIHRoaXMuY2xvc3VyZUNvbXBpbGVyRW5hYmxlZCxcbiAgICAgICAgICB0aGlzLmRlbGVnYXRpbmdQZXJmUmVjb3JkZXIpLFxuXG4gICAgICAvLyBUT0RPKGFseGh1Yik6IHVuZGVyc3RhbmQgd2h5IHRoZSBjYXN0IGhlcmUgaXMgbmVjZXNzYXJ5IChzb21ldGhpbmcgdG8gZG8gd2l0aCBgbnVsbGBcbiAgICAgIC8vIG5vdCBiZWluZyBhc3NpZ25hYmxlIHRvIGB1bmtub3duYCB3aGVuIHdyYXBwZWQgaW4gYFJlYWRvbmx5YCkuXG4gICAgICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gICAgICAgIG5ldyBEaXJlY3RpdmVEZWNvcmF0b3JIYW5kbGVyKFxuICAgICAgICAgICAgcmVmbGVjdG9yLCBldmFsdWF0b3IsIG1ldGFSZWdpc3RyeSwgc2NvcGVSZWdpc3RyeSwgbWV0YVJlYWRlcixcbiAgICAgICAgICAgIGluamVjdGFibGVSZWdpc3RyeSwgaXNDb3JlLCBzZW1hbnRpY0RlcEdyYXBoVXBkYXRlcixcbiAgICAgICAgICB0aGlzLmNsb3N1cmVDb21waWxlckVuYWJsZWQsIGNvbXBpbGVVbmRlY29yYXRlZENsYXNzZXNXaXRoQW5ndWxhckZlYXR1cmVzLFxuICAgICAgICAgIHRoaXMuZGVsZWdhdGluZ1BlcmZSZWNvcmRlcixcbiAgICAgICAgKSBhcyBSZWFkb25seTxEZWNvcmF0b3JIYW5kbGVyPHVua25vd24sIHVua25vd24sIFNlbWFudGljU3ltYm9sIHwgbnVsbCx1bmtub3duPj4sXG4gICAgICAvLyBjbGFuZy1mb3JtYXQgb25cbiAgICAgIC8vIFBpcGUgaGFuZGxlciBtdXN0IGJlIGJlZm9yZSBpbmplY3RhYmxlIGhhbmRsZXIgaW4gbGlzdCBzbyBwaXBlIGZhY3RvcmllcyBhcmUgcHJpbnRlZFxuICAgICAgLy8gYmVmb3JlIGluamVjdGFibGUgZmFjdG9yaWVzIChzbyBpbmplY3RhYmxlIGZhY3RvcmllcyBjYW4gZGVsZWdhdGUgdG8gdGhlbSlcbiAgICAgIG5ldyBQaXBlRGVjb3JhdG9ySGFuZGxlcihcbiAgICAgICAgICByZWZsZWN0b3IsIGV2YWx1YXRvciwgbWV0YVJlZ2lzdHJ5LCBzY29wZVJlZ2lzdHJ5LCBpbmplY3RhYmxlUmVnaXN0cnksIGlzQ29yZSxcbiAgICAgICAgICB0aGlzLmRlbGVnYXRpbmdQZXJmUmVjb3JkZXIpLFxuICAgICAgbmV3IEluamVjdGFibGVEZWNvcmF0b3JIYW5kbGVyKFxuICAgICAgICAgIHJlZmxlY3RvciwgaXNDb3JlLCB0aGlzLm9wdGlvbnMuc3RyaWN0SW5qZWN0aW9uUGFyYW1ldGVycyB8fCBmYWxzZSwgaW5qZWN0YWJsZVJlZ2lzdHJ5LFxuICAgICAgICAgIHRoaXMuZGVsZWdhdGluZ1BlcmZSZWNvcmRlciksXG4gICAgICBuZXcgTmdNb2R1bGVEZWNvcmF0b3JIYW5kbGVyKFxuICAgICAgICAgIHJlZmxlY3RvciwgZXZhbHVhdG9yLCBtZXRhUmVhZGVyLCBtZXRhUmVnaXN0cnksIHNjb3BlUmVnaXN0cnksIHJlZmVyZW5jZXNSZWdpc3RyeSwgaXNDb3JlLFxuICAgICAgICAgIHJvdXRlQW5hbHl6ZXIsIHJlZkVtaXR0ZXIsIHRoaXMuYWRhcHRlci5mYWN0b3J5VHJhY2tlciwgdGhpcy5jbG9zdXJlQ29tcGlsZXJFbmFibGVkLFxuICAgICAgICAgIGluamVjdGFibGVSZWdpc3RyeSwgdGhpcy5kZWxlZ2F0aW5nUGVyZlJlY29yZGVyLCB0aGlzLm9wdGlvbnMuaTE4bkluTG9jYWxlKSxcbiAgICBdO1xuXG4gICAgY29uc3QgdHJhaXRDb21waWxlciA9IG5ldyBUcmFpdENvbXBpbGVyKFxuICAgICAgICBoYW5kbGVycywgcmVmbGVjdG9yLCB0aGlzLmRlbGVnYXRpbmdQZXJmUmVjb3JkZXIsIHRoaXMuaW5jcmVtZW50YWxDb21waWxhdGlvbixcbiAgICAgICAgdGhpcy5vcHRpb25zLmNvbXBpbGVOb25FeHBvcnRlZENsYXNzZXMgIT09IGZhbHNlLCBjb21waWxhdGlvbk1vZGUsIGR0c1RyYW5zZm9ybXMsXG4gICAgICAgIHNlbWFudGljRGVwR3JhcGhVcGRhdGVyKTtcblxuICAgIC8vIFRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgbWF5IHVzZSB0aGUgYFByb2dyYW1Ecml2ZXJgIHRvIHByb2R1Y2UgbmV3IGB0cy5Qcm9ncmFtYChzKS4gSWYgdGhpc1xuICAgIC8vIGhhcHBlbnMsIHRoZXkgbmVlZCB0byBiZSB0cmFja2VkIGJ5IHRoZSBgTmdDb21waWxlcmAuXG4gICAgY29uc3Qgbm90aWZ5aW5nRHJpdmVyID1cbiAgICAgICAgbmV3IE5vdGlmeWluZ1Byb2dyYW1Ecml2ZXJXcmFwcGVyKHRoaXMucHJvZ3JhbURyaXZlciwgKHByb2dyYW06IHRzLlByb2dyYW0pID0+IHtcbiAgICAgICAgICB0aGlzLmluY3JlbWVudGFsU3RyYXRlZ3kuc2V0SW5jcmVtZW50YWxTdGF0ZSh0aGlzLmluY3JlbWVudGFsQ29tcGlsYXRpb24uc3RhdGUsIHByb2dyYW0pO1xuICAgICAgICAgIHRoaXMuY3VycmVudFByb2dyYW0gPSBwcm9ncmFtO1xuICAgICAgICB9KTtcblxuICAgIGNvbnN0IHRlbXBsYXRlVHlwZUNoZWNrZXIgPSBuZXcgVGVtcGxhdGVUeXBlQ2hlY2tlckltcGwoXG4gICAgICAgIHRoaXMuaW5wdXRQcm9ncmFtLCBub3RpZnlpbmdEcml2ZXIsIHRyYWl0Q29tcGlsZXIsIHRoaXMuZ2V0VHlwZUNoZWNraW5nQ29uZmlnKCksIHJlZkVtaXR0ZXIsXG4gICAgICAgIHJlZmxlY3RvciwgdGhpcy5hZGFwdGVyLCB0aGlzLmluY3JlbWVudGFsQ29tcGlsYXRpb24sIHNjb3BlUmVnaXN0cnksIHR5cGVDaGVja1Njb3BlUmVnaXN0cnksXG4gICAgICAgIHRoaXMuZGVsZWdhdGluZ1BlcmZSZWNvcmRlcik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNDb3JlLFxuICAgICAgdHJhaXRDb21waWxlcixcbiAgICAgIHJlZmxlY3RvcixcbiAgICAgIHNjb3BlUmVnaXN0cnksXG4gICAgICBkdHNUcmFuc2Zvcm1zLFxuICAgICAgZXhwb3J0UmVmZXJlbmNlR3JhcGgsXG4gICAgICByb3V0ZUFuYWx5emVyLFxuICAgICAgbWV0YVJlYWRlcixcbiAgICAgIHR5cGVDaGVja1Njb3BlUmVnaXN0cnksXG4gICAgICBhbGlhc2luZ0hvc3QsXG4gICAgICByZWZFbWl0dGVyLFxuICAgICAgdGVtcGxhdGVUeXBlQ2hlY2tlcixcbiAgICAgIHJlc291cmNlUmVnaXN0cnksXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIERldGVybWluZSBpZiB0aGUgZ2l2ZW4gYFByb2dyYW1gIGlzIEBhbmd1bGFyL2NvcmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FuZ3VsYXJDb3JlUGFja2FnZShwcm9ncmFtOiB0cy5Qcm9ncmFtKTogYm9vbGVhbiB7XG4gIC8vIExvb2sgZm9yIGl0c19qdXN0X2FuZ3VsYXIudHMgc29tZXdoZXJlIGluIHRoZSBwcm9ncmFtLlxuICBjb25zdCByM1N5bWJvbHMgPSBnZXRSM1N5bWJvbHNGaWxlKHByb2dyYW0pO1xuICBpZiAocjNTeW1ib2xzID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gTG9vayBmb3IgdGhlIGNvbnN0YW50IElUU19KVVNUX0FOR1VMQVIgaW4gdGhhdCBmaWxlLlxuICByZXR1cm4gcjNTeW1ib2xzLnN0YXRlbWVudHMuc29tZShzdG10ID0+IHtcbiAgICAvLyBUaGUgc3RhdGVtZW50IG11c3QgYmUgYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBzdGF0ZW1lbnQuXG4gICAgaWYgKCF0cy5pc1ZhcmlhYmxlU3RhdGVtZW50KHN0bXQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIEl0IG11c3QgYmUgZXhwb3J0ZWQuXG4gICAgaWYgKHN0bXQubW9kaWZpZXJzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgIXN0bXQubW9kaWZpZXJzLnNvbWUobW9kID0+IG1vZC5raW5kID09PSB0cy5TeW50YXhLaW5kLkV4cG9ydEtleXdvcmQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIEl0IG11c3QgZGVjbGFyZSBJVFNfSlVTVF9BTkdVTEFSLlxuICAgIHJldHVybiBzdG10LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMuc29tZShkZWNsID0+IHtcbiAgICAgIC8vIFRoZSBkZWNsYXJhdGlvbiBtdXN0IG1hdGNoIHRoZSBuYW1lLlxuICAgICAgaWYgKCF0cy5pc0lkZW50aWZpZXIoZGVjbC5uYW1lKSB8fCBkZWNsLm5hbWUudGV4dCAhPT0gJ0lUU19KVVNUX0FOR1VMQVInKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIC8vIEl0IG11c3QgaW5pdGlhbGl6ZSB0aGUgdmFyaWFibGUgdG8gdHJ1ZS5cbiAgICAgIGlmIChkZWNsLmluaXRpYWxpemVyID09PSB1bmRlZmluZWQgfHwgZGVjbC5pbml0aWFsaXplci5raW5kICE9PSB0cy5TeW50YXhLaW5kLlRydWVLZXl3b3JkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIC8vIFRoaXMgZGVmaW5pdGlvbiBtYXRjaGVzLlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEZpbmQgdGhlICdyM19zeW1ib2xzLnRzJyBmaWxlIGluIHRoZSBnaXZlbiBgUHJvZ3JhbWAsIG9yIHJldHVybiBgbnVsbGAgaWYgaXQgd2Fzbid0IHRoZXJlLlxuICovXG5mdW5jdGlvbiBnZXRSM1N5bWJvbHNGaWxlKHByb2dyYW06IHRzLlByb2dyYW0pOiB0cy5Tb3VyY2VGaWxlfG51bGwge1xuICByZXR1cm4gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbmQoZmlsZSA9PiBmaWxlLmZpbGVOYW1lLmluZGV4T2YoJ3IzX3N5bWJvbHMudHMnKSA+PSAwKSB8fCBudWxsO1xufVxuXG4vKipcbiAqIFNpbmNlIFwic3RyaWN0VGVtcGxhdGVzXCIgaXMgYSB0cnVlIHN1cGVyc2V0IG9mIHR5cGUgY2hlY2tpbmcgY2FwYWJpbGl0aWVzIGNvbXBhcmVkIHRvXG4gKiBcImZ1bGxUZW1wbGF0ZVR5cGVDaGVja1wiLCBpdCBpcyByZXF1aXJlZCB0aGF0IHRoZSBsYXR0ZXIgaXMgbm90IGV4cGxpY2l0bHkgZGlzYWJsZWQgaWYgdGhlXG4gKiBmb3JtZXIgaXMgZW5hYmxlZC5cbiAqL1xuZnVuY3Rpb24gdmVyaWZ5Q29tcGF0aWJsZVR5cGVDaGVja09wdGlvbnMob3B0aW9uczogTmdDb21waWxlck9wdGlvbnMpOiB0cy5EaWFnbm9zdGljfG51bGwge1xuICBpZiAob3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgPT09IGZhbHNlICYmIG9wdGlvbnMuc3RyaWN0VGVtcGxhdGVzID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsXG4gICAgICBjb2RlOiBuZ0Vycm9yQ29kZShFcnJvckNvZGUuQ09ORklHX1NUUklDVF9URU1QTEFURVNfSU1QTElFU19GVUxMX1RFTVBMQVRFX1RZUEVDSEVDSyksXG4gICAgICBmaWxlOiB1bmRlZmluZWQsXG4gICAgICBzdGFydDogdW5kZWZpbmVkLFxuICAgICAgbGVuZ3RoOiB1bmRlZmluZWQsXG4gICAgICBtZXNzYWdlVGV4dDpcbiAgICAgICAgICBgQW5ndWxhciBjb21waWxlciBvcHRpb24gXCJzdHJpY3RUZW1wbGF0ZXNcIiBpcyBlbmFibGVkLCBob3dldmVyIFwiZnVsbFRlbXBsYXRlVHlwZUNoZWNrXCIgaXMgZGlzYWJsZWQuXG5cbkhhdmluZyB0aGUgXCJzdHJpY3RUZW1wbGF0ZXNcIiBmbGFnIGVuYWJsZWQgaW1wbGllcyB0aGF0IFwiZnVsbFRlbXBsYXRlVHlwZUNoZWNrXCIgaXMgYWxzbyBlbmFibGVkLCBzb1xudGhlIGxhdHRlciBjYW4gbm90IGJlIGV4cGxpY2l0bHkgZGlzYWJsZWQuXG5cbk9uZSBvZiB0aGUgZm9sbG93aW5nIGFjdGlvbnMgaXMgcmVxdWlyZWQ6XG4xLiBSZW1vdmUgdGhlIFwiZnVsbFRlbXBsYXRlVHlwZUNoZWNrXCIgb3B0aW9uLlxuMi4gUmVtb3ZlIFwic3RyaWN0VGVtcGxhdGVzXCIgb3Igc2V0IGl0IHRvICdmYWxzZScuXG5cbk1vcmUgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHRlbXBsYXRlIHR5cGUgY2hlY2tpbmcgY29tcGlsZXIgb3B0aW9ucyBjYW4gYmUgZm91bmQgaW4gdGhlIGRvY3VtZW50YXRpb246XG5odHRwczovL3Y5LmFuZ3VsYXIuaW8vZ3VpZGUvdGVtcGxhdGUtdHlwZWNoZWNrI3RlbXBsYXRlLXR5cGUtY2hlY2tpbmdgLFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuY2xhc3MgUmVmZXJlbmNlR3JhcGhBZGFwdGVyIGltcGxlbWVudHMgUmVmZXJlbmNlc1JlZ2lzdHJ5IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBncmFwaDogUmVmZXJlbmNlR3JhcGgpIHt9XG5cbiAgYWRkKHNvdXJjZTogRGVjbGFyYXRpb25Ob2RlLCAuLi5yZWZlcmVuY2VzOiBSZWZlcmVuY2U8RGVjbGFyYXRpb25Ob2RlPltdKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCB7bm9kZX0gb2YgcmVmZXJlbmNlcykge1xuICAgICAgbGV0IHNvdXJjZUZpbGUgPSBub2RlLmdldFNvdXJjZUZpbGUoKTtcbiAgICAgIGlmIChzb3VyY2VGaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc291cmNlRmlsZSA9IHRzLmdldE9yaWdpbmFsTm9kZShub2RlKS5nZXRTb3VyY2VGaWxlKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgcmVjb3JkIGxvY2FsIHJlZmVyZW5jZXMgKG5vdCByZWZlcmVuY2VzIGludG8gLmQudHMgZmlsZXMpLlxuICAgICAgaWYgKHNvdXJjZUZpbGUgPT09IHVuZGVmaW5lZCB8fCAhaXNEdHNQYXRoKHNvdXJjZUZpbGUuZmlsZU5hbWUpKSB7XG4gICAgICAgIHRoaXMuZ3JhcGguYWRkKHNvdXJjZSwgbm9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmNsYXNzIE5vdGlmeWluZ1Byb2dyYW1Ecml2ZXJXcmFwcGVyIGltcGxlbWVudHMgUHJvZ3JhbURyaXZlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBkZWxlZ2F0ZTogUHJvZ3JhbURyaXZlciwgcHJpdmF0ZSBub3RpZnlOZXdQcm9ncmFtOiAocHJvZ3JhbTogdHMuUHJvZ3JhbSkgPT4gdm9pZCkge31cblxuICBnZXQgc3VwcG9ydHNJbmxpbmVPcGVyYXRpb25zKCkge1xuICAgIHJldHVybiB0aGlzLmRlbGVnYXRlLnN1cHBvcnRzSW5saW5lT3BlcmF0aW9ucztcbiAgfVxuXG4gIGdldFByb2dyYW0oKTogdHMuUHJvZ3JhbSB7XG4gICAgcmV0dXJuIHRoaXMuZGVsZWdhdGUuZ2V0UHJvZ3JhbSgpO1xuICB9XG5cbiAgdXBkYXRlRmlsZXMoY29udGVudHM6IE1hcDxBYnNvbHV0ZUZzUGF0aCwgc3RyaW5nPiwgdXBkYXRlTW9kZTogVXBkYXRlTW9kZSk6IHZvaWQge1xuICAgIHRoaXMuZGVsZWdhdGUudXBkYXRlRmlsZXMoY29udGVudHMsIHVwZGF0ZU1vZGUpO1xuICAgIHRoaXMubm90aWZ5TmV3UHJvZ3JhbSh0aGlzLmRlbGVnYXRlLmdldFByb2dyYW0oKSk7XG4gIH1cblxuICBnZXRTb3VyY2VGaWxlVmVyc2lvbiA9IHRoaXMuZGVsZWdhdGUuZ2V0U291cmNlRmlsZVZlcnNpb24/LmJpbmQodGhpcyk7XG59XG5cbmZ1bmN0aW9uIHZlcnNpb25NYXBGcm9tUHJvZ3JhbShcbiAgICBwcm9ncmFtOiB0cy5Qcm9ncmFtLCBkcml2ZXI6IFByb2dyYW1Ecml2ZXIpOiBNYXA8QWJzb2x1dGVGc1BhdGgsIHN0cmluZz58bnVsbCB7XG4gIGlmIChkcml2ZXIuZ2V0U291cmNlRmlsZVZlcnNpb24gPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgdmVyc2lvbnMgPSBuZXcgTWFwPEFic29sdXRlRnNQYXRoLCBzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgcG9zc2libHlSZWRpcmVjdGVkU291cmNlRmlsZSBvZiBwcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICBjb25zdCBzZiA9IHRvVW5yZWRpcmVjdGVkU291cmNlRmlsZShwb3NzaWJseVJlZGlyZWN0ZWRTb3VyY2VGaWxlKTtcbiAgICB2ZXJzaW9ucy5zZXQoYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZiksIGRyaXZlci5nZXRTb3VyY2VGaWxlVmVyc2lvbihzZikpO1xuICB9XG4gIHJldHVybiB2ZXJzaW9ucztcbn1cbiJdfQ==