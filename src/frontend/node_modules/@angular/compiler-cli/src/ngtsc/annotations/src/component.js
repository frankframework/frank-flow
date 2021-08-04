/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler-cli/src/ngtsc/annotations/src/component", ["require", "exports", "tslib", "@angular/compiler", "@angular/compiler/src/core", "typescript", "@angular/compiler-cli/src/ngtsc/diagnostics", "@angular/compiler-cli/src/ngtsc/file_system", "@angular/compiler-cli/src/ngtsc/imports", "@angular/compiler-cli/src/ngtsc/incremental/semantic_graph", "@angular/compiler-cli/src/ngtsc/metadata", "@angular/compiler-cli/src/ngtsc/partial_evaluator", "@angular/compiler-cli/src/ngtsc/perf", "@angular/compiler-cli/src/ngtsc/reflection", "@angular/compiler-cli/src/ngtsc/transform", "@angular/compiler-cli/src/ngtsc/annotations/src/diagnostics", "@angular/compiler-cli/src/ngtsc/annotations/src/directive", "@angular/compiler-cli/src/ngtsc/annotations/src/factory", "@angular/compiler-cli/src/ngtsc/annotations/src/metadata", "@angular/compiler-cli/src/ngtsc/annotations/src/ng_module", "@angular/compiler-cli/src/ngtsc/annotations/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ComponentDecoratorHandler = exports.ComponentSymbol = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var core_1 = require("@angular/compiler/src/core");
    var ts = require("typescript");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/diagnostics");
    var file_system_1 = require("@angular/compiler-cli/src/ngtsc/file_system");
    var imports_1 = require("@angular/compiler-cli/src/ngtsc/imports");
    var semantic_graph_1 = require("@angular/compiler-cli/src/ngtsc/incremental/semantic_graph");
    var metadata_1 = require("@angular/compiler-cli/src/ngtsc/metadata");
    var partial_evaluator_1 = require("@angular/compiler-cli/src/ngtsc/partial_evaluator");
    var perf_1 = require("@angular/compiler-cli/src/ngtsc/perf");
    var reflection_1 = require("@angular/compiler-cli/src/ngtsc/reflection");
    var transform_1 = require("@angular/compiler-cli/src/ngtsc/transform");
    var diagnostics_2 = require("@angular/compiler-cli/src/ngtsc/annotations/src/diagnostics");
    var directive_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/directive");
    var factory_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/factory");
    var metadata_2 = require("@angular/compiler-cli/src/ngtsc/annotations/src/metadata");
    var ng_module_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/ng_module");
    var util_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/util");
    var EMPTY_MAP = new Map();
    var EMPTY_ARRAY = [];
    /**
     * Represents an Angular component.
     */
    var ComponentSymbol = /** @class */ (function (_super) {
        tslib_1.__extends(ComponentSymbol, _super);
        function ComponentSymbol() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.usedDirectives = [];
            _this.usedPipes = [];
            _this.isRemotelyScoped = false;
            return _this;
        }
        ComponentSymbol.prototype.isEmitAffected = function (previousSymbol, publicApiAffected) {
            if (!(previousSymbol instanceof ComponentSymbol)) {
                return true;
            }
            // Create an equality function that considers symbols equal if they represent the same
            // declaration, but only if the symbol in the current compilation does not have its public API
            // affected.
            var isSymbolUnaffected = function (current, previous) {
                return semantic_graph_1.isReferenceEqual(current, previous) && !publicApiAffected.has(current.symbol);
            };
            // The emit of a component is affected if either of the following is true:
            //  1. The component used to be remotely scoped but no longer is, or vice versa.
            //  2. The list of used directives has changed or any of those directives have had their public
            //     API changed. If the used directives have been reordered but not otherwise affected then
            //     the component must still be re-emitted, as this may affect directive instantiation order.
            //  3. The list of used pipes has changed, or any of those pipes have had their public API
            //     changed.
            return this.isRemotelyScoped !== previousSymbol.isRemotelyScoped ||
                !semantic_graph_1.isArrayEqual(this.usedDirectives, previousSymbol.usedDirectives, isSymbolUnaffected) ||
                !semantic_graph_1.isArrayEqual(this.usedPipes, previousSymbol.usedPipes, isSymbolUnaffected);
        };
        ComponentSymbol.prototype.isTypeCheckBlockAffected = function (previousSymbol, typeCheckApiAffected) {
            if (!(previousSymbol instanceof ComponentSymbol)) {
                return true;
            }
            // To verify that a used directive is not affected we need to verify that its full inheritance
            // chain is not present in `typeCheckApiAffected`.
            var isInheritanceChainAffected = function (symbol) {
                var currentSymbol = symbol;
                while (currentSymbol instanceof directive_1.DirectiveSymbol) {
                    if (typeCheckApiAffected.has(currentSymbol)) {
                        return true;
                    }
                    currentSymbol = currentSymbol.baseClass;
                }
                return false;
            };
            // Create an equality function that considers directives equal if they represent the same
            // declaration and if the symbol and all symbols it inherits from in the current compilation
            // do not have their type-check API affected.
            var isDirectiveUnaffected = function (current, previous) {
                return semantic_graph_1.isReferenceEqual(current, previous) && !isInheritanceChainAffected(current.symbol);
            };
            // Create an equality function that considers pipes equal if they represent the same
            // declaration and if the symbol in the current compilation does not have its type-check
            // API affected.
            var isPipeUnaffected = function (current, previous) {
                return semantic_graph_1.isReferenceEqual(current, previous) && !typeCheckApiAffected.has(current.symbol);
            };
            // The emit of a type-check block of a component is affected if either of the following is true:
            //  1. The list of used directives has changed or any of those directives have had their
            //     type-check API changed.
            //  2. The list of used pipes has changed, or any of those pipes have had their type-check API
            //     changed.
            return !semantic_graph_1.isArrayEqual(this.usedDirectives, previousSymbol.usedDirectives, isDirectiveUnaffected) ||
                !semantic_graph_1.isArrayEqual(this.usedPipes, previousSymbol.usedPipes, isPipeUnaffected);
        };
        return ComponentSymbol;
    }(directive_1.DirectiveSymbol));
    exports.ComponentSymbol = ComponentSymbol;
    /**
     * `DecoratorHandler` which handles the `@Component` annotation.
     */
    var ComponentDecoratorHandler = /** @class */ (function () {
        function ComponentDecoratorHandler(reflector, evaluator, metaRegistry, metaReader, scopeReader, scopeRegistry, typeCheckScopeRegistry, resourceRegistry, isCore, resourceLoader, rootDirs, defaultPreserveWhitespaces, i18nUseExternalIds, enableI18nLegacyMessageIdFormat, usePoisonedData, i18nNormalizeLineEndingsInICUs, moduleResolver, cycleAnalyzer, cycleHandlingStrategy, refEmitter, depTracker, injectableRegistry, semanticDepGraphUpdater, annotateForClosureCompiler, perf) {
            this.reflector = reflector;
            this.evaluator = evaluator;
            this.metaRegistry = metaRegistry;
            this.metaReader = metaReader;
            this.scopeReader = scopeReader;
            this.scopeRegistry = scopeRegistry;
            this.typeCheckScopeRegistry = typeCheckScopeRegistry;
            this.resourceRegistry = resourceRegistry;
            this.isCore = isCore;
            this.resourceLoader = resourceLoader;
            this.rootDirs = rootDirs;
            this.defaultPreserveWhitespaces = defaultPreserveWhitespaces;
            this.i18nUseExternalIds = i18nUseExternalIds;
            this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
            this.usePoisonedData = usePoisonedData;
            this.i18nNormalizeLineEndingsInICUs = i18nNormalizeLineEndingsInICUs;
            this.moduleResolver = moduleResolver;
            this.cycleAnalyzer = cycleAnalyzer;
            this.cycleHandlingStrategy = cycleHandlingStrategy;
            this.refEmitter = refEmitter;
            this.depTracker = depTracker;
            this.injectableRegistry = injectableRegistry;
            this.semanticDepGraphUpdater = semanticDepGraphUpdater;
            this.annotateForClosureCompiler = annotateForClosureCompiler;
            this.perf = perf;
            this.literalCache = new Map();
            this.elementSchemaRegistry = new compiler_1.DomElementSchemaRegistry();
            /**
             * During the asynchronous preanalyze phase, it's necessary to parse the template to extract
             * any potential <link> tags which might need to be loaded. This cache ensures that work is not
             * thrown away, and the parsed template is reused during the analyze phase.
             */
            this.preanalyzeTemplateCache = new Map();
            this.preanalyzeStylesCache = new Map();
            this.precedence = transform_1.HandlerPrecedence.PRIMARY;
            this.name = ComponentDecoratorHandler.name;
        }
        ComponentDecoratorHandler.prototype.detect = function (node, decorators) {
            if (!decorators) {
                return undefined;
            }
            var decorator = util_1.findAngularDecorator(decorators, 'Component', this.isCore);
            if (decorator !== undefined) {
                return {
                    trigger: decorator.node,
                    decorator: decorator,
                    metadata: decorator,
                };
            }
            else {
                return undefined;
            }
        };
        ComponentDecoratorHandler.prototype.preanalyze = function (node, decorator) {
            // In preanalyze, resource URLs associated with the component are asynchronously preloaded via
            // the resourceLoader. This is the only time async operations are allowed for a component.
            // These resources are:
            //
            // - the templateUrl, if there is one
            // - any styleUrls if present
            // - any stylesheets referenced from <link> tags in the template itself
            //
            // As a result of the last one, the template must be parsed as part of preanalysis to extract
            // <link> tags, which may involve waiting for the templateUrl to be resolved first.
            var _this = this;
            // If preloading isn't possible, then skip this step.
            if (!this.resourceLoader.canPreload) {
                return undefined;
            }
            var meta = this._resolveLiteral(decorator);
            var component = reflection_1.reflectObjectLiteral(meta);
            var containingFile = node.getSourceFile().fileName;
            var resolveStyleUrl = function (styleUrl) {
                try {
                    var resourceUrl = _this.resourceLoader.resolve(styleUrl, containingFile);
                    return _this.resourceLoader.preload(resourceUrl, { type: 'style', containingFile: containingFile });
                }
                catch (_a) {
                    // Don't worry about failures to preload. We can handle this problem during analysis by
                    // producing a diagnostic.
                    return undefined;
                }
            };
            // A Promise that waits for the template and all <link>ed styles within it to be preloaded.
            var templateAndTemplateStyleResources = this._preloadAndParseTemplate(node, decorator, component, containingFile)
                .then(function (template) {
                if (template === null) {
                    return undefined;
                }
                return Promise.all(template.styleUrls.map(function (styleUrl) { return resolveStyleUrl(styleUrl); }))
                    .then(function () { return undefined; });
            });
            // Extract all the styleUrls in the decorator.
            var componentStyleUrls = this._extractComponentStyleUrls(component);
            // Extract inline styles, process, and cache for use in synchronous analyze phase
            var inlineStyles;
            if (component.has('styles')) {
                var litStyles = directive_1.parseFieldArrayValue(component, 'styles', this.evaluator);
                if (litStyles === null) {
                    this.preanalyzeStylesCache.set(node, null);
                }
                else {
                    inlineStyles = Promise
                        .all(litStyles.map(function (style) { return _this.resourceLoader.preprocessInline(style, { type: 'style', containingFile: containingFile }); }))
                        .then(function (styles) {
                        _this.preanalyzeStylesCache.set(node, styles);
                    });
                }
            }
            else {
                this.preanalyzeStylesCache.set(node, null);
            }
            // Wait for both the template and all styleUrl resources to resolve.
            return Promise
                .all(tslib_1.__spreadArray([
                templateAndTemplateStyleResources, inlineStyles
            ], tslib_1.__read(componentStyleUrls.map(function (styleUrl) { return resolveStyleUrl(styleUrl.url); }))))
                .then(function () { return undefined; });
        };
        ComponentDecoratorHandler.prototype.analyze = function (node, decorator, flags) {
            var e_1, _a;
            var _b, _c;
            if (flags === void 0) { flags = transform_1.HandlerFlags.NONE; }
            this.perf.eventCount(perf_1.PerfEvent.AnalyzeComponent);
            var containingFile = node.getSourceFile().fileName;
            this.literalCache.delete(decorator);
            var diagnostics;
            var isPoisoned = false;
            // @Component inherits @Directive, so begin by extracting the @Directive metadata and building
            // on it.
            var directiveResult = directive_1.extractDirectiveMetadata(node, decorator, this.reflector, this.evaluator, this.isCore, flags, this.annotateForClosureCompiler, this.elementSchemaRegistry.getDefaultComponentElementName());
            if (directiveResult === undefined) {
                // `extractDirectiveMetadata` returns undefined when the @Directive has `jit: true`. In this
                // case, compilation of the decorator is skipped. Returning an empty object signifies
                // that no analysis was produced.
                return {};
            }
            // Next, read the `@Component`-specific fields.
            var component = directiveResult.decorator, metadata = directiveResult.metadata, inputs = directiveResult.inputs, outputs = directiveResult.outputs;
            var encapsulation = (_b = this._resolveEnumValue(component, 'encapsulation', 'ViewEncapsulation')) !== null && _b !== void 0 ? _b : core_1.ViewEncapsulation.Emulated;
            var changeDetection = this._resolveEnumValue(component, 'changeDetection', 'ChangeDetectionStrategy');
            var animations = null;
            if (component.has('animations')) {
                animations = new compiler_1.WrappedNodeExpr(component.get('animations'));
            }
            // Go through the root directories for this project, and select the one with the smallest
            // relative path representation.
            var relativeContextFilePath = this.rootDirs.reduce(function (previous, rootDir) {
                var candidate = file_system_1.relative(file_system_1.absoluteFrom(rootDir), file_system_1.absoluteFrom(containingFile));
                if (previous === undefined || candidate.length < previous.length) {
                    return candidate;
                }
                else {
                    return previous;
                }
            }, undefined);
            // Note that we could technically combine the `viewProvidersRequiringFactory` and
            // `providersRequiringFactory` into a single set, but we keep the separate so that
            // we can distinguish where an error is coming from when logging the diagnostics in `resolve`.
            var viewProvidersRequiringFactory = null;
            var providersRequiringFactory = null;
            var wrappedViewProviders = null;
            if (component.has('viewProviders')) {
                var viewProviders = component.get('viewProviders');
                viewProvidersRequiringFactory =
                    util_1.resolveProvidersRequiringFactory(viewProviders, this.reflector, this.evaluator);
                wrappedViewProviders = new compiler_1.WrappedNodeExpr(this.annotateForClosureCompiler ? util_1.wrapFunctionExpressionsInParens(viewProviders) :
                    viewProviders);
            }
            if (component.has('providers')) {
                providersRequiringFactory = util_1.resolveProvidersRequiringFactory(component.get('providers'), this.reflector, this.evaluator);
            }
            // Parse the template.
            // If a preanalyze phase was executed, the template may already exist in parsed form, so check
            // the preanalyzeTemplateCache.
            // Extract a closure of the template parsing code so that it can be reparsed with different
            // options if needed, like in the indexing pipeline.
            var template;
            if (this.preanalyzeTemplateCache.has(node)) {
                // The template was parsed in preanalyze. Use it and delete it to save memory.
                var preanalyzed = this.preanalyzeTemplateCache.get(node);
                this.preanalyzeTemplateCache.delete(node);
                template = preanalyzed;
            }
            else {
                var templateDecl = this.parseTemplateDeclaration(decorator, component, containingFile);
                template = this.extractTemplate(node, templateDecl);
            }
            var templateResource = template.declaration.isInline ? { path: null, expression: component.get('template') } : {
                path: file_system_1.absoluteFrom(template.declaration.resolvedTemplateUrl),
                expression: template.sourceMapping.node
            };
            // Figure out the set of styles. The ordering here is important: external resources (styleUrls)
            // precede inline styles, and styles defined in the template override styles defined in the
            // component.
            var styles = [];
            var styleResources = this._extractStyleResources(component, containingFile);
            var styleUrls = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(this._extractComponentStyleUrls(component))), tslib_1.__read(this._extractTemplateStyleUrls(template)));
            try {
                for (var styleUrls_1 = tslib_1.__values(styleUrls), styleUrls_1_1 = styleUrls_1.next(); !styleUrls_1_1.done; styleUrls_1_1 = styleUrls_1.next()) {
                    var styleUrl = styleUrls_1_1.value;
                    try {
                        var resourceUrl = this.resourceLoader.resolve(styleUrl.url, containingFile);
                        var resourceStr = this.resourceLoader.load(resourceUrl);
                        styles.push(resourceStr);
                        if (this.depTracker !== null) {
                            this.depTracker.addResourceDependency(node.getSourceFile(), file_system_1.absoluteFrom(resourceUrl));
                        }
                    }
                    catch (_d) {
                        if (diagnostics === undefined) {
                            diagnostics = [];
                        }
                        var resourceType = styleUrl.source === 2 /* StylesheetFromDecorator */ ?
                            2 /* StylesheetFromDecorator */ :
                            1 /* StylesheetFromTemplate */;
                        diagnostics.push(this.makeResourceNotFoundError(styleUrl.url, styleUrl.nodeForError, resourceType)
                            .toDiagnostic());
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (styleUrls_1_1 && !styleUrls_1_1.done && (_a = styleUrls_1.return)) _a.call(styleUrls_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (encapsulation === core_1.ViewEncapsulation.ShadowDom && metadata.selector !== null) {
                var selectorError = checkCustomElementSelectorForErrors(metadata.selector);
                if (selectorError !== null) {
                    if (diagnostics === undefined) {
                        diagnostics = [];
                    }
                    diagnostics.push(diagnostics_1.makeDiagnostic(diagnostics_1.ErrorCode.COMPONENT_INVALID_SHADOW_DOM_SELECTOR, component.get('selector'), selectorError));
                }
            }
            // If inline styles were preprocessed use those
            var inlineStyles = null;
            if (this.preanalyzeStylesCache.has(node)) {
                inlineStyles = this.preanalyzeStylesCache.get(node);
                this.preanalyzeStylesCache.delete(node);
                if (inlineStyles !== null) {
                    styles.push.apply(styles, tslib_1.__spreadArray([], tslib_1.__read(inlineStyles)));
                }
            }
            else {
                // Preprocessing is only supported asynchronously
                // If no style cache entry is present asynchronous preanalyze was not executed.
                // This protects against accidental differences in resource contents when preanalysis
                // is not used with a provided transformResource hook on the ResourceHost.
                if (this.resourceLoader.canPreprocess) {
                    throw new Error('Inline resource processing requires asynchronous preanalyze.');
                }
                if (component.has('styles')) {
                    var litStyles = directive_1.parseFieldArrayValue(component, 'styles', this.evaluator);
                    if (litStyles !== null) {
                        inlineStyles = tslib_1.__spreadArray([], tslib_1.__read(litStyles));
                        styles.push.apply(styles, tslib_1.__spreadArray([], tslib_1.__read(litStyles)));
                    }
                }
            }
            if (template.styles.length > 0) {
                styles.push.apply(styles, tslib_1.__spreadArray([], tslib_1.__read(template.styles)));
            }
            var output = {
                analysis: {
                    baseClass: util_1.readBaseClass(node, this.reflector, this.evaluator),
                    inputs: inputs,
                    outputs: outputs,
                    meta: tslib_1.__assign(tslib_1.__assign({}, metadata), { template: {
                            nodes: template.nodes,
                            ngContentSelectors: template.ngContentSelectors,
                        }, encapsulation: encapsulation, interpolation: (_c = template.interpolationConfig) !== null && _c !== void 0 ? _c : compiler_1.DEFAULT_INTERPOLATION_CONFIG, styles: styles, 
                        // These will be replaced during the compilation step, after all `NgModule`s have been
                        // analyzed and the full compilation scope for the component can be realized.
                        animations: animations, viewProviders: wrappedViewProviders, i18nUseExternalIds: this.i18nUseExternalIds, relativeContextFilePath: relativeContextFilePath }),
                    typeCheckMeta: metadata_1.extractDirectiveTypeCheckMeta(node, inputs, this.reflector),
                    classMetadata: metadata_2.extractClassMetadata(node, this.reflector, this.isCore, this.annotateForClosureCompiler),
                    template: template,
                    providersRequiringFactory: providersRequiringFactory,
                    viewProvidersRequiringFactory: viewProvidersRequiringFactory,
                    inlineStyles: inlineStyles,
                    styleUrls: styleUrls,
                    resources: {
                        styles: styleResources,
                        template: templateResource,
                    },
                    isPoisoned: isPoisoned,
                },
                diagnostics: diagnostics,
            };
            if (changeDetection !== null) {
                output.analysis.meta.changeDetection = changeDetection;
            }
            return output;
        };
        ComponentDecoratorHandler.prototype.symbol = function (node, analysis) {
            var typeParameters = semantic_graph_1.extractSemanticTypeParameters(node);
            return new ComponentSymbol(node, analysis.meta.selector, analysis.inputs, analysis.outputs, analysis.meta.exportAs, analysis.typeCheckMeta, typeParameters);
        };
        ComponentDecoratorHandler.prototype.register = function (node, analysis) {
            // Register this component's information with the `MetadataRegistry`. This ensures that
            // the information about the component is available during the compile() phase.
            var ref = new imports_1.Reference(node);
            this.metaRegistry.registerDirectiveMetadata(tslib_1.__assign(tslib_1.__assign({ type: metadata_1.MetaType.Directive, ref: ref, name: node.name.text, selector: analysis.meta.selector, exportAs: analysis.meta.exportAs, inputs: analysis.inputs, outputs: analysis.outputs, queries: analysis.meta.queries.map(function (query) { return query.propertyName; }), isComponent: true, baseClass: analysis.baseClass }, analysis.typeCheckMeta), { isPoisoned: analysis.isPoisoned, isStructural: false }));
            this.resourceRegistry.registerResources(analysis.resources, node);
            this.injectableRegistry.registerInjectable(node);
        };
        ComponentDecoratorHandler.prototype.index = function (context, node, analysis) {
            var e_2, _a;
            if (analysis.isPoisoned && !this.usePoisonedData) {
                return null;
            }
            var scope = this.scopeReader.getScopeForComponent(node);
            var selector = analysis.meta.selector;
            var matcher = new compiler_1.SelectorMatcher();
            if (scope !== null) {
                if ((scope.compilation.isPoisoned || scope.exported.isPoisoned) && !this.usePoisonedData) {
                    // Don't bother indexing components which had erroneous scopes, unless specifically
                    // requested.
                    return null;
                }
                try {
                    for (var _b = tslib_1.__values(scope.compilation.directives), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var directive = _c.value;
                        if (directive.selector !== null) {
                            matcher.addSelectables(compiler_1.CssSelector.parse(directive.selector), directive);
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            var binder = new compiler_1.R3TargetBinder(matcher);
            var boundTemplate = binder.bind({ template: analysis.template.diagNodes });
            context.addComponent({
                declaration: node,
                selector: selector,
                boundTemplate: boundTemplate,
                templateMeta: {
                    isInline: analysis.template.declaration.isInline,
                    file: analysis.template.file,
                },
            });
        };
        ComponentDecoratorHandler.prototype.typeCheck = function (ctx, node, meta) {
            if (this.typeCheckScopeRegistry === null || !ts.isClassDeclaration(node)) {
                return;
            }
            if (meta.isPoisoned && !this.usePoisonedData) {
                return;
            }
            var scope = this.typeCheckScopeRegistry.getTypeCheckScope(node);
            if (scope.isPoisoned && !this.usePoisonedData) {
                // Don't type-check components that had errors in their scopes, unless requested.
                return;
            }
            var binder = new compiler_1.R3TargetBinder(scope.matcher);
            ctx.addTemplate(new imports_1.Reference(node), binder, meta.template.diagNodes, scope.pipes, scope.schemas, meta.template.sourceMapping, meta.template.file, meta.template.errors);
        };
        ComponentDecoratorHandler.prototype.resolve = function (node, analysis, symbol) {
            var e_3, _a, e_4, _b, e_5, _c, e_6, _d, e_7, _e, e_8, _f, e_9, _g, e_10, _h, e_11, _j;
            var _this = this;
            if (this.semanticDepGraphUpdater !== null && analysis.baseClass instanceof imports_1.Reference) {
                symbol.baseClass = this.semanticDepGraphUpdater.getSymbol(analysis.baseClass.node);
            }
            if (analysis.isPoisoned && !this.usePoisonedData) {
                return {};
            }
            var context = node.getSourceFile();
            // Check whether this component was registered with an NgModule. If so, it should be compiled
            // under that module's compilation scope.
            var scope = this.scopeReader.getScopeForComponent(node);
            var metadata = analysis.meta;
            var data = {
                directives: EMPTY_ARRAY,
                pipes: EMPTY_MAP,
                declarationListEmitMode: 0 /* Direct */,
            };
            if (scope !== null && (!scope.compilation.isPoisoned || this.usePoisonedData)) {
                var matcher = new compiler_1.SelectorMatcher();
                try {
                    for (var _k = tslib_1.__values(scope.compilation.directives), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var dir = _l.value;
                        if (dir.selector !== null) {
                            matcher.addSelectables(compiler_1.CssSelector.parse(dir.selector), dir);
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_l && !_l.done && (_a = _k.return)) _a.call(_k);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                var pipes = new Map();
                try {
                    for (var _m = tslib_1.__values(scope.compilation.pipes), _o = _m.next(); !_o.done; _o = _m.next()) {
                        var pipe = _o.value;
                        pipes.set(pipe.name, pipe.ref);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_o && !_o.done && (_b = _m.return)) _b.call(_m);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
                // Next, the component template AST is bound using the R3TargetBinder. This produces a
                // BoundTarget, which is similar to a ts.TypeChecker.
                var binder = new compiler_1.R3TargetBinder(matcher);
                var bound = binder.bind({ template: metadata.template.nodes });
                var usedDirectives = bound.getUsedDirectives().map(function (directive) {
                    var type = _this.refEmitter.emit(directive.ref, context);
                    return {
                        ref: directive.ref,
                        type: type.expression,
                        importedFile: type.importedFile,
                        selector: directive.selector,
                        inputs: directive.inputs.propertyNames,
                        outputs: directive.outputs.propertyNames,
                        exportAs: directive.exportAs,
                        isComponent: directive.isComponent,
                    };
                });
                var usedPipes = [];
                try {
                    for (var _p = tslib_1.__values(bound.getUsedPipes()), _q = _p.next(); !_q.done; _q = _p.next()) {
                        var pipeName = _q.value;
                        if (!pipes.has(pipeName)) {
                            continue;
                        }
                        var pipe = pipes.get(pipeName);
                        var type = this.refEmitter.emit(pipe, context);
                        usedPipes.push({
                            ref: pipe,
                            pipeName: pipeName,
                            expression: type.expression,
                            importedFile: type.importedFile,
                        });
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_q && !_q.done && (_c = _p.return)) _c.call(_p);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                if (this.semanticDepGraphUpdater !== null) {
                    symbol.usedDirectives = usedDirectives.map(function (dir) { return _this.semanticDepGraphUpdater.getSemanticReference(dir.ref.node, dir.type); });
                    symbol.usedPipes = usedPipes.map(function (pipe) {
                        return _this.semanticDepGraphUpdater.getSemanticReference(pipe.ref.node, pipe.expression);
                    });
                }
                // Scan through the directives/pipes actually used in the template and check whether any
                // import which needs to be generated would create a cycle.
                var cyclesFromDirectives = new Map();
                try {
                    for (var usedDirectives_1 = tslib_1.__values(usedDirectives), usedDirectives_1_1 = usedDirectives_1.next(); !usedDirectives_1_1.done; usedDirectives_1_1 = usedDirectives_1.next()) {
                        var usedDirective = usedDirectives_1_1.value;
                        var cycle = this._checkForCyclicImport(usedDirective.importedFile, usedDirective.type, context);
                        if (cycle !== null) {
                            cyclesFromDirectives.set(usedDirective, cycle);
                        }
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (usedDirectives_1_1 && !usedDirectives_1_1.done && (_d = usedDirectives_1.return)) _d.call(usedDirectives_1);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
                var cyclesFromPipes = new Map();
                try {
                    for (var usedPipes_1 = tslib_1.__values(usedPipes), usedPipes_1_1 = usedPipes_1.next(); !usedPipes_1_1.done; usedPipes_1_1 = usedPipes_1.next()) {
                        var usedPipe = usedPipes_1_1.value;
                        var cycle = this._checkForCyclicImport(usedPipe.importedFile, usedPipe.expression, context);
                        if (cycle !== null) {
                            cyclesFromPipes.set(usedPipe, cycle);
                        }
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (usedPipes_1_1 && !usedPipes_1_1.done && (_e = usedPipes_1.return)) _e.call(usedPipes_1);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
                var cycleDetected = cyclesFromDirectives.size !== 0 || cyclesFromPipes.size !== 0;
                if (!cycleDetected) {
                    try {
                        // No cycle was detected. Record the imports that need to be created in the cycle detector
                        // so that future cyclic import checks consider their production.
                        for (var usedDirectives_2 = tslib_1.__values(usedDirectives), usedDirectives_2_1 = usedDirectives_2.next(); !usedDirectives_2_1.done; usedDirectives_2_1 = usedDirectives_2.next()) {
                            var _r = usedDirectives_2_1.value, type = _r.type, importedFile = _r.importedFile;
                            this._recordSyntheticImport(importedFile, type, context);
                        }
                    }
                    catch (e_8_1) { e_8 = { error: e_8_1 }; }
                    finally {
                        try {
                            if (usedDirectives_2_1 && !usedDirectives_2_1.done && (_f = usedDirectives_2.return)) _f.call(usedDirectives_2);
                        }
                        finally { if (e_8) throw e_8.error; }
                    }
                    try {
                        for (var usedPipes_2 = tslib_1.__values(usedPipes), usedPipes_2_1 = usedPipes_2.next(); !usedPipes_2_1.done; usedPipes_2_1 = usedPipes_2.next()) {
                            var _s = usedPipes_2_1.value, expression = _s.expression, importedFile = _s.importedFile;
                            this._recordSyntheticImport(importedFile, expression, context);
                        }
                    }
                    catch (e_9_1) { e_9 = { error: e_9_1 }; }
                    finally {
                        try {
                            if (usedPipes_2_1 && !usedPipes_2_1.done && (_g = usedPipes_2.return)) _g.call(usedPipes_2);
                        }
                        finally { if (e_9) throw e_9.error; }
                    }
                    // Check whether the directive/pipe arrays in ɵcmp need to be wrapped in closures.
                    // This is required if any directive/pipe reference is to a declaration in the same file
                    // but declared after this component.
                    var wrapDirectivesAndPipesInClosure = usedDirectives.some(function (dir) { return util_1.isExpressionForwardReference(dir.type, node.name, context); }) ||
                        usedPipes.some(function (pipe) { return util_1.isExpressionForwardReference(pipe.expression, node.name, context); });
                    data.directives = usedDirectives;
                    data.pipes = new Map(usedPipes.map(function (pipe) { return [pipe.pipeName, pipe.expression]; }));
                    data.declarationListEmitMode = wrapDirectivesAndPipesInClosure ?
                        1 /* Closure */ :
                        0 /* Direct */;
                }
                else {
                    if (this.cycleHandlingStrategy === 0 /* UseRemoteScoping */) {
                        // Declaring the directiveDefs/pipeDefs arrays directly would require imports that would
                        // create a cycle. Instead, mark this component as requiring remote scoping, so that the
                        // NgModule file will take care of setting the directives for the component.
                        this.scopeRegistry.setComponentRemoteScope(node, usedDirectives.map(function (dir) { return dir.ref; }), usedPipes.map(function (pipe) { return pipe.ref; }));
                        symbol.isRemotelyScoped = true;
                        // If a semantic graph is being tracked, record the fact that this component is remotely
                        // scoped with the declaring NgModule symbol as the NgModule's emit becomes dependent on
                        // the directive/pipe usages of this component.
                        if (this.semanticDepGraphUpdater !== null) {
                            var moduleSymbol = this.semanticDepGraphUpdater.getSymbol(scope.ngModule);
                            if (!(moduleSymbol instanceof ng_module_1.NgModuleSymbol)) {
                                throw new Error("AssertionError: Expected " + scope.ngModule.name + " to be an NgModuleSymbol.");
                            }
                            moduleSymbol.addRemotelyScopedComponent(symbol, symbol.usedDirectives, symbol.usedPipes);
                        }
                    }
                    else {
                        // We are not able to handle this cycle so throw an error.
                        var relatedMessages = [];
                        try {
                            for (var cyclesFromDirectives_1 = tslib_1.__values(cyclesFromDirectives), cyclesFromDirectives_1_1 = cyclesFromDirectives_1.next(); !cyclesFromDirectives_1_1.done; cyclesFromDirectives_1_1 = cyclesFromDirectives_1.next()) {
                                var _t = tslib_1.__read(cyclesFromDirectives_1_1.value, 2), dir = _t[0], cycle = _t[1];
                                relatedMessages.push(makeCyclicImportInfo(dir.ref, dir.isComponent ? 'component' : 'directive', cycle));
                            }
                        }
                        catch (e_10_1) { e_10 = { error: e_10_1 }; }
                        finally {
                            try {
                                if (cyclesFromDirectives_1_1 && !cyclesFromDirectives_1_1.done && (_h = cyclesFromDirectives_1.return)) _h.call(cyclesFromDirectives_1);
                            }
                            finally { if (e_10) throw e_10.error; }
                        }
                        try {
                            for (var cyclesFromPipes_1 = tslib_1.__values(cyclesFromPipes), cyclesFromPipes_1_1 = cyclesFromPipes_1.next(); !cyclesFromPipes_1_1.done; cyclesFromPipes_1_1 = cyclesFromPipes_1.next()) {
                                var _u = tslib_1.__read(cyclesFromPipes_1_1.value, 2), pipe = _u[0], cycle = _u[1];
                                relatedMessages.push(makeCyclicImportInfo(pipe.ref, 'pipe', cycle));
                            }
                        }
                        catch (e_11_1) { e_11 = { error: e_11_1 }; }
                        finally {
                            try {
                                if (cyclesFromPipes_1_1 && !cyclesFromPipes_1_1.done && (_j = cyclesFromPipes_1.return)) _j.call(cyclesFromPipes_1);
                            }
                            finally { if (e_11) throw e_11.error; }
                        }
                        throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.IMPORT_CYCLE_DETECTED, node, 'One or more import cycles would need to be created to compile this component, ' +
                            'which is not supported by the current compiler configuration.', relatedMessages);
                    }
                }
            }
            var diagnostics = [];
            if (analysis.providersRequiringFactory !== null &&
                analysis.meta.providers instanceof compiler_1.WrappedNodeExpr) {
                var providerDiagnostics = diagnostics_2.getProviderDiagnostics(analysis.providersRequiringFactory, analysis.meta.providers.node, this.injectableRegistry);
                diagnostics.push.apply(diagnostics, tslib_1.__spreadArray([], tslib_1.__read(providerDiagnostics)));
            }
            if (analysis.viewProvidersRequiringFactory !== null &&
                analysis.meta.viewProviders instanceof compiler_1.WrappedNodeExpr) {
                var viewProviderDiagnostics = diagnostics_2.getProviderDiagnostics(analysis.viewProvidersRequiringFactory, analysis.meta.viewProviders.node, this.injectableRegistry);
                diagnostics.push.apply(diagnostics, tslib_1.__spreadArray([], tslib_1.__read(viewProviderDiagnostics)));
            }
            var directiveDiagnostics = diagnostics_2.getDirectiveDiagnostics(node, this.metaReader, this.evaluator, this.reflector, this.scopeRegistry, 'Component');
            if (directiveDiagnostics !== null) {
                diagnostics.push.apply(diagnostics, tslib_1.__spreadArray([], tslib_1.__read(directiveDiagnostics)));
            }
            if (diagnostics.length > 0) {
                return { diagnostics: diagnostics };
            }
            return { data: data };
        };
        ComponentDecoratorHandler.prototype.xi18n = function (ctx, node, analysis) {
            var _a;
            ctx.updateFromTemplate(analysis.template.content, analysis.template.declaration.resolvedTemplateUrl, (_a = analysis.template.interpolationConfig) !== null && _a !== void 0 ? _a : compiler_1.DEFAULT_INTERPOLATION_CONFIG);
        };
        ComponentDecoratorHandler.prototype.updateResources = function (node, analysis) {
            var e_12, _a, e_13, _b, e_14, _c;
            var containingFile = node.getSourceFile().fileName;
            // If the template is external, re-parse it.
            var templateDecl = analysis.template.declaration;
            if (!templateDecl.isInline) {
                analysis.template = this.extractTemplate(node, templateDecl);
            }
            // Update any external stylesheets and rebuild the combined 'styles' list.
            // TODO(alxhub): write tests for styles when the primary compiler uses the updateResources path
            var styles = [];
            if (analysis.styleUrls !== null) {
                try {
                    for (var _d = tslib_1.__values(analysis.styleUrls), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var styleUrl = _e.value;
                        try {
                            var resolvedStyleUrl = this.resourceLoader.resolve(styleUrl.url, containingFile);
                            var styleText = this.resourceLoader.load(resolvedStyleUrl);
                            styles.push(styleText);
                        }
                        catch (e) {
                            // Resource resolve failures should already be in the diagnostics list from the analyze
                            // stage. We do not need to do anything with them when updating resources.
                        }
                    }
                }
                catch (e_12_1) { e_12 = { error: e_12_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                    }
                    finally { if (e_12) throw e_12.error; }
                }
            }
            if (analysis.inlineStyles !== null) {
                try {
                    for (var _f = tslib_1.__values(analysis.inlineStyles), _g = _f.next(); !_g.done; _g = _f.next()) {
                        var styleText = _g.value;
                        styles.push(styleText);
                    }
                }
                catch (e_13_1) { e_13 = { error: e_13_1 }; }
                finally {
                    try {
                        if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                    }
                    finally { if (e_13) throw e_13.error; }
                }
            }
            try {
                for (var _h = tslib_1.__values(analysis.template.styles), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var styleText = _j.value;
                    styles.push(styleText);
                }
            }
            catch (e_14_1) { e_14 = { error: e_14_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_c = _h.return)) _c.call(_h);
                }
                finally { if (e_14) throw e_14.error; }
            }
            analysis.meta.styles = styles;
        };
        ComponentDecoratorHandler.prototype.compileFull = function (node, analysis, resolution, pool) {
            if (analysis.template.errors !== null && analysis.template.errors.length > 0) {
                return [];
            }
            var meta = tslib_1.__assign(tslib_1.__assign({}, analysis.meta), resolution);
            var fac = factory_1.compileNgFactoryDefField(util_1.toFactoryMetadata(meta, compiler_1.FactoryTarget.Component));
            var def = compiler_1.compileComponentFromMetadata(meta, pool, compiler_1.makeBindingParser());
            var classMetadata = analysis.classMetadata !== null ?
                compiler_1.compileClassMetadata(analysis.classMetadata).toStmt() :
                null;
            return util_1.compileResults(fac, def, classMetadata, 'ɵcmp');
        };
        ComponentDecoratorHandler.prototype.compilePartial = function (node, analysis, resolution) {
            if (analysis.template.errors !== null && analysis.template.errors.length > 0) {
                return [];
            }
            var templateInfo = {
                content: analysis.template.content,
                sourceUrl: analysis.template.declaration.resolvedTemplateUrl,
                isInline: analysis.template.declaration.isInline,
                inlineTemplateLiteralExpression: analysis.template.sourceMapping.type === 'direct' ?
                    new compiler_1.WrappedNodeExpr(analysis.template.sourceMapping.node) :
                    null,
            };
            var meta = tslib_1.__assign(tslib_1.__assign({}, analysis.meta), resolution);
            var fac = factory_1.compileDeclareFactory(util_1.toFactoryMetadata(meta, compiler_1.FactoryTarget.Component));
            var def = compiler_1.compileDeclareComponentFromMetadata(meta, analysis.template, templateInfo);
            var classMetadata = analysis.classMetadata !== null ?
                compiler_1.compileDeclareClassMetadata(analysis.classMetadata).toStmt() :
                null;
            return util_1.compileResults(fac, def, classMetadata, 'ɵcmp');
        };
        ComponentDecoratorHandler.prototype._resolveLiteral = function (decorator) {
            if (this.literalCache.has(decorator)) {
                return this.literalCache.get(decorator);
            }
            if (decorator.args === null || decorator.args.length !== 1) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, reflection_1.Decorator.nodeForError(decorator), "Incorrect number of arguments to @Component decorator");
            }
            var meta = util_1.unwrapExpression(decorator.args[0]);
            if (!ts.isObjectLiteralExpression(meta)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARG_NOT_LITERAL, meta, "Decorator argument must be literal.");
            }
            this.literalCache.set(decorator, meta);
            return meta;
        };
        ComponentDecoratorHandler.prototype._resolveEnumValue = function (component, field, enumSymbolName) {
            var resolved = null;
            if (component.has(field)) {
                var expr = component.get(field);
                var value = this.evaluator.evaluate(expr);
                if (value instanceof partial_evaluator_1.EnumValue && util_1.isAngularCoreReference(value.enumRef, enumSymbolName)) {
                    resolved = value.resolved;
                }
                else {
                    throw diagnostics_2.createValueHasWrongTypeError(expr, value, field + " must be a member of " + enumSymbolName + " enum from @angular/core");
                }
            }
            return resolved;
        };
        ComponentDecoratorHandler.prototype._extractComponentStyleUrls = function (component) {
            if (!component.has('styleUrls')) {
                return [];
            }
            return this._extractStyleUrlsFromExpression(component.get('styleUrls'));
        };
        ComponentDecoratorHandler.prototype._extractStyleUrlsFromExpression = function (styleUrlsExpr) {
            var e_15, _a, e_16, _b;
            var styleUrls = [];
            if (ts.isArrayLiteralExpression(styleUrlsExpr)) {
                try {
                    for (var _c = tslib_1.__values(styleUrlsExpr.elements), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var styleUrlExpr = _d.value;
                        if (ts.isSpreadElement(styleUrlExpr)) {
                            styleUrls.push.apply(styleUrls, tslib_1.__spreadArray([], tslib_1.__read(this._extractStyleUrlsFromExpression(styleUrlExpr.expression))));
                        }
                        else {
                            var styleUrl = this.evaluator.evaluate(styleUrlExpr);
                            if (typeof styleUrl !== 'string') {
                                throw diagnostics_2.createValueHasWrongTypeError(styleUrlExpr, styleUrl, 'styleUrl must be a string');
                            }
                            styleUrls.push({
                                url: styleUrl,
                                source: 2 /* StylesheetFromDecorator */,
                                nodeForError: styleUrlExpr,
                            });
                        }
                    }
                }
                catch (e_15_1) { e_15 = { error: e_15_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_15) throw e_15.error; }
                }
            }
            else {
                var evaluatedStyleUrls = this.evaluator.evaluate(styleUrlsExpr);
                if (!isStringArray(evaluatedStyleUrls)) {
                    throw diagnostics_2.createValueHasWrongTypeError(styleUrlsExpr, evaluatedStyleUrls, 'styleUrls must be an array of strings');
                }
                try {
                    for (var evaluatedStyleUrls_1 = tslib_1.__values(evaluatedStyleUrls), evaluatedStyleUrls_1_1 = evaluatedStyleUrls_1.next(); !evaluatedStyleUrls_1_1.done; evaluatedStyleUrls_1_1 = evaluatedStyleUrls_1.next()) {
                        var styleUrl = evaluatedStyleUrls_1_1.value;
                        styleUrls.push({
                            url: styleUrl,
                            source: 2 /* StylesheetFromDecorator */,
                            nodeForError: styleUrlsExpr,
                        });
                    }
                }
                catch (e_16_1) { e_16 = { error: e_16_1 }; }
                finally {
                    try {
                        if (evaluatedStyleUrls_1_1 && !evaluatedStyleUrls_1_1.done && (_b = evaluatedStyleUrls_1.return)) _b.call(evaluatedStyleUrls_1);
                    }
                    finally { if (e_16) throw e_16.error; }
                }
            }
            return styleUrls;
        };
        ComponentDecoratorHandler.prototype._extractStyleResources = function (component, containingFile) {
            var e_17, _a, e_18, _b;
            var styles = new Set();
            function stringLiteralElements(array) {
                return array.elements.filter(function (e) { return ts.isStringLiteralLike(e); });
            }
            // If styleUrls is a literal array, process each resource url individually and
            // register ones that are string literals.
            var styleUrlsExpr = component.get('styleUrls');
            if (styleUrlsExpr !== undefined && ts.isArrayLiteralExpression(styleUrlsExpr)) {
                try {
                    for (var _c = tslib_1.__values(stringLiteralElements(styleUrlsExpr)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var expression = _d.value;
                        try {
                            var resourceUrl = this.resourceLoader.resolve(expression.text, containingFile);
                            styles.add({ path: file_system_1.absoluteFrom(resourceUrl), expression: expression });
                        }
                        catch (_e) {
                            // Errors in style resource extraction do not need to be handled here. We will produce
                            // diagnostics for each one that fails in the analysis, after we evaluate the `styleUrls`
                            // expression to determine _all_ style resources, not just the string literals.
                        }
                    }
                }
                catch (e_17_1) { e_17 = { error: e_17_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_17) throw e_17.error; }
                }
            }
            var stylesExpr = component.get('styles');
            if (stylesExpr !== undefined && ts.isArrayLiteralExpression(stylesExpr)) {
                try {
                    for (var _f = tslib_1.__values(stringLiteralElements(stylesExpr)), _g = _f.next(); !_g.done; _g = _f.next()) {
                        var expression = _g.value;
                        styles.add({ path: null, expression: expression });
                    }
                }
                catch (e_18_1) { e_18 = { error: e_18_1 }; }
                finally {
                    try {
                        if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                    }
                    finally { if (e_18) throw e_18.error; }
                }
            }
            return styles;
        };
        ComponentDecoratorHandler.prototype._preloadAndParseTemplate = function (node, decorator, component, containingFile) {
            var _this = this;
            if (component.has('templateUrl')) {
                // Extract the templateUrl and preload it.
                var templateUrlExpr = component.get('templateUrl');
                var templateUrl = this.evaluator.evaluate(templateUrlExpr);
                if (typeof templateUrl !== 'string') {
                    throw diagnostics_2.createValueHasWrongTypeError(templateUrlExpr, templateUrl, 'templateUrl must be a string');
                }
                try {
                    var resourceUrl = this.resourceLoader.resolve(templateUrl, containingFile);
                    var templatePromise = this.resourceLoader.preload(resourceUrl, { type: 'template', containingFile: containingFile });
                    // If the preload worked, then actually load and parse the template, and wait for any style
                    // URLs to resolve.
                    if (templatePromise !== undefined) {
                        return templatePromise.then(function () {
                            var templateDecl = _this.parseTemplateDeclaration(decorator, component, containingFile);
                            var template = _this.extractTemplate(node, templateDecl);
                            _this.preanalyzeTemplateCache.set(node, template);
                            return template;
                        });
                    }
                    else {
                        return Promise.resolve(null);
                    }
                }
                catch (e) {
                    throw this.makeResourceNotFoundError(templateUrl, templateUrlExpr, 0 /* Template */);
                }
            }
            else {
                var templateDecl = this.parseTemplateDeclaration(decorator, component, containingFile);
                var template = this.extractTemplate(node, templateDecl);
                this.preanalyzeTemplateCache.set(node, template);
                return Promise.resolve(template);
            }
        };
        ComponentDecoratorHandler.prototype.extractTemplate = function (node, template) {
            if (template.isInline) {
                var sourceStr = void 0;
                var sourceParseRange = null;
                var templateContent = void 0;
                var sourceMapping = void 0;
                var escapedString = false;
                var sourceMapUrl = void 0;
                // We only support SourceMaps for inline templates that are simple string literals.
                if (ts.isStringLiteral(template.expression) ||
                    ts.isNoSubstitutionTemplateLiteral(template.expression)) {
                    // the start and end of the `templateExpr` node includes the quotation marks, which we must
                    // strip
                    sourceParseRange = getTemplateRange(template.expression);
                    sourceStr = template.expression.getSourceFile().text;
                    templateContent = template.expression.text;
                    escapedString = true;
                    sourceMapping = {
                        type: 'direct',
                        node: template.expression,
                    };
                    sourceMapUrl = template.resolvedTemplateUrl;
                }
                else {
                    var resolvedTemplate = this.evaluator.evaluate(template.expression);
                    if (typeof resolvedTemplate !== 'string') {
                        throw diagnostics_2.createValueHasWrongTypeError(template.expression, resolvedTemplate, 'template must be a string');
                    }
                    // We do not parse the template directly from the source file using a lexer range, so
                    // the template source and content are set to the statically resolved template.
                    sourceStr = resolvedTemplate;
                    templateContent = resolvedTemplate;
                    sourceMapping = {
                        type: 'indirect',
                        node: template.expression,
                        componentClass: node,
                        template: templateContent,
                    };
                    // Indirect templates cannot be mapped to a particular byte range of any input file, since
                    // they're computed by expressions that may span many files. Don't attempt to map them back
                    // to a given file.
                    sourceMapUrl = null;
                }
                return tslib_1.__assign(tslib_1.__assign({}, this._parseTemplate(template, sourceStr, sourceParseRange, escapedString, sourceMapUrl)), { content: templateContent, sourceMapping: sourceMapping, declaration: template });
            }
            else {
                var templateContent = this.resourceLoader.load(template.resolvedTemplateUrl);
                if (this.depTracker !== null) {
                    this.depTracker.addResourceDependency(node.getSourceFile(), file_system_1.absoluteFrom(template.resolvedTemplateUrl));
                }
                return tslib_1.__assign(tslib_1.__assign({}, this._parseTemplate(template, /* sourceStr */ templateContent, /* sourceParseRange */ null, 
                /* escapedString */ false, 
                /* sourceMapUrl */ template.resolvedTemplateUrl)), { content: templateContent, sourceMapping: {
                        type: 'external',
                        componentClass: node,
                        // TODO(alxhub): TS in g3 is unable to make this inference on its own, so cast it here
                        // until g3 is able to figure this out.
                        node: template.templateUrlExpression,
                        template: templateContent,
                        templateUrl: template.resolvedTemplateUrl,
                    }, declaration: template });
            }
        };
        ComponentDecoratorHandler.prototype._parseTemplate = function (template, sourceStr, sourceParseRange, escapedString, sourceMapUrl) {
            // We always normalize line endings if the template has been escaped (i.e. is inline).
            var i18nNormalizeLineEndingsInICUs = escapedString || this.i18nNormalizeLineEndingsInICUs;
            var parsedTemplate = compiler_1.parseTemplate(sourceStr, sourceMapUrl !== null && sourceMapUrl !== void 0 ? sourceMapUrl : '', {
                preserveWhitespaces: template.preserveWhitespaces,
                interpolationConfig: template.interpolationConfig,
                range: sourceParseRange !== null && sourceParseRange !== void 0 ? sourceParseRange : undefined,
                escapedString: escapedString,
                enableI18nLegacyMessageIdFormat: this.enableI18nLegacyMessageIdFormat,
                i18nNormalizeLineEndingsInICUs: i18nNormalizeLineEndingsInICUs,
                alwaysAttemptHtmlToR3AstConversion: this.usePoisonedData,
            });
            // Unfortunately, the primary parse of the template above may not contain accurate source map
            // information. If used directly, it would result in incorrect code locations in template
            // errors, etc. There are three main problems:
            //
            // 1. `preserveWhitespaces: false` annihilates the correctness of template source mapping, as
            //    the whitespace transformation changes the contents of HTML text nodes before they're
            //    parsed into Angular expressions.
            // 2. `preserveLineEndings: false` causes growing misalignments in templates that use '\r\n'
            //    line endings, by normalizing them to '\n'.
            // 3. By default, the template parser strips leading trivia characters (like spaces, tabs, and
            //    newlines). This also destroys source mapping information.
            //
            // In order to guarantee the correctness of diagnostics, templates are parsed a second time
            // with the above options set to preserve source mappings.
            var diagNodes = compiler_1.parseTemplate(sourceStr, sourceMapUrl !== null && sourceMapUrl !== void 0 ? sourceMapUrl : '', {
                preserveWhitespaces: true,
                preserveLineEndings: true,
                interpolationConfig: template.interpolationConfig,
                range: sourceParseRange !== null && sourceParseRange !== void 0 ? sourceParseRange : undefined,
                escapedString: escapedString,
                enableI18nLegacyMessageIdFormat: this.enableI18nLegacyMessageIdFormat,
                i18nNormalizeLineEndingsInICUs: i18nNormalizeLineEndingsInICUs,
                leadingTriviaChars: [],
                alwaysAttemptHtmlToR3AstConversion: this.usePoisonedData,
            }).nodes;
            return tslib_1.__assign(tslib_1.__assign({}, parsedTemplate), { diagNodes: diagNodes, file: new compiler_1.ParseSourceFile(sourceStr, sourceMapUrl !== null && sourceMapUrl !== void 0 ? sourceMapUrl : '') });
        };
        ComponentDecoratorHandler.prototype.parseTemplateDeclaration = function (decorator, component, containingFile) {
            var preserveWhitespaces = this.defaultPreserveWhitespaces;
            if (component.has('preserveWhitespaces')) {
                var expr = component.get('preserveWhitespaces');
                var value = this.evaluator.evaluate(expr);
                if (typeof value !== 'boolean') {
                    throw diagnostics_2.createValueHasWrongTypeError(expr, value, 'preserveWhitespaces must be a boolean');
                }
                preserveWhitespaces = value;
            }
            var interpolationConfig = compiler_1.DEFAULT_INTERPOLATION_CONFIG;
            if (component.has('interpolation')) {
                var expr = component.get('interpolation');
                var value = this.evaluator.evaluate(expr);
                if (!Array.isArray(value) || value.length !== 2 ||
                    !value.every(function (element) { return typeof element === 'string'; })) {
                    throw diagnostics_2.createValueHasWrongTypeError(expr, value, 'interpolation must be an array with 2 elements of string type');
                }
                interpolationConfig = compiler_1.InterpolationConfig.fromArray(value);
            }
            if (component.has('templateUrl')) {
                var templateUrlExpr = component.get('templateUrl');
                var templateUrl = this.evaluator.evaluate(templateUrlExpr);
                if (typeof templateUrl !== 'string') {
                    throw diagnostics_2.createValueHasWrongTypeError(templateUrlExpr, templateUrl, 'templateUrl must be a string');
                }
                try {
                    var resourceUrl = this.resourceLoader.resolve(templateUrl, containingFile);
                    return {
                        isInline: false,
                        interpolationConfig: interpolationConfig,
                        preserveWhitespaces: preserveWhitespaces,
                        templateUrl: templateUrl,
                        templateUrlExpression: templateUrlExpr,
                        resolvedTemplateUrl: resourceUrl,
                    };
                }
                catch (e) {
                    throw this.makeResourceNotFoundError(templateUrl, templateUrlExpr, 0 /* Template */);
                }
            }
            else if (component.has('template')) {
                return {
                    isInline: true,
                    interpolationConfig: interpolationConfig,
                    preserveWhitespaces: preserveWhitespaces,
                    expression: component.get('template'),
                    templateUrl: containingFile,
                    resolvedTemplateUrl: containingFile,
                };
            }
            else {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.COMPONENT_MISSING_TEMPLATE, reflection_1.Decorator.nodeForError(decorator), 'component is missing a template');
            }
        };
        ComponentDecoratorHandler.prototype._resolveImportedFile = function (importedFile, expr, origin) {
            // If `importedFile` is not 'unknown' then it accurately reflects the source file that is
            // being imported.
            if (importedFile !== 'unknown') {
                return importedFile;
            }
            // Otherwise `expr` has to be inspected to determine the file that is being imported. If `expr`
            // is not an `ExternalExpr` then it does not correspond with an import, so return null in that
            // case.
            if (!(expr instanceof compiler_1.ExternalExpr)) {
                return null;
            }
            // Figure out what file is being imported.
            return this.moduleResolver.resolveModule(expr.value.moduleName, origin.fileName);
        };
        /**
         * Check whether adding an import from `origin` to the source-file corresponding to `expr` would
         * create a cyclic import.
         *
         * @returns a `Cycle` object if a cycle would be created, otherwise `null`.
         */
        ComponentDecoratorHandler.prototype._checkForCyclicImport = function (importedFile, expr, origin) {
            var imported = this._resolveImportedFile(importedFile, expr, origin);
            if (imported === null) {
                return null;
            }
            // Check whether the import is legal.
            return this.cycleAnalyzer.wouldCreateCycle(origin, imported);
        };
        ComponentDecoratorHandler.prototype._recordSyntheticImport = function (importedFile, expr, origin) {
            var imported = this._resolveImportedFile(importedFile, expr, origin);
            if (imported === null) {
                return;
            }
            this.cycleAnalyzer.recordSyntheticImport(origin, imported);
        };
        ComponentDecoratorHandler.prototype.makeResourceNotFoundError = function (file, nodeForError, resourceType) {
            var errorText;
            switch (resourceType) {
                case 0 /* Template */:
                    errorText = "Could not find template file '" + file + "'.";
                    break;
                case 1 /* StylesheetFromTemplate */:
                    errorText = "Could not find stylesheet file '" + file + "' linked from the template.";
                    break;
                case 2 /* StylesheetFromDecorator */:
                    errorText = "Could not find stylesheet file '" + file + "'.";
                    break;
            }
            return new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.COMPONENT_RESOURCE_NOT_FOUND, nodeForError, errorText);
        };
        ComponentDecoratorHandler.prototype._extractTemplateStyleUrls = function (template) {
            if (template.styleUrls === null) {
                return [];
            }
            var nodeForError = getTemplateDeclarationNodeForError(template.declaration);
            return template.styleUrls.map(function (url) { return ({ url: url, source: 1 /* StylesheetFromTemplate */, nodeForError: nodeForError }); });
        };
        return ComponentDecoratorHandler;
    }());
    exports.ComponentDecoratorHandler = ComponentDecoratorHandler;
    function getTemplateRange(templateExpr) {
        var startPos = templateExpr.getStart() + 1;
        var _a = ts.getLineAndCharacterOfPosition(templateExpr.getSourceFile(), startPos), line = _a.line, character = _a.character;
        return {
            startPos: startPos,
            startLine: line,
            startCol: character,
            endPos: templateExpr.getEnd() - 1,
        };
    }
    /** Determines if the result of an evaluation is a string array. */
    function isStringArray(resolvedValue) {
        return Array.isArray(resolvedValue) && resolvedValue.every(function (elem) { return typeof elem === 'string'; });
    }
    /** Determines the node to use for debugging purposes for the given TemplateDeclaration. */
    function getTemplateDeclarationNodeForError(declaration) {
        // TODO(zarend): Change this to if/else when that is compatible with g3. This uses a switch
        // because if/else fails to compile on g3. That is because g3 compiles this in non-strict mode
        // where type inference does not work correctly.
        switch (declaration.isInline) {
            case true:
                return declaration.expression;
            case false:
                return declaration.templateUrlExpression;
        }
    }
    /**
     * Generate a diagnostic related information object that describes a potential cyclic import path.
     */
    function makeCyclicImportInfo(ref, type, cycle) {
        var name = ref.debugName || '(unknown)';
        var path = cycle.getPath().map(function (sf) { return sf.fileName; }).join(' -> ');
        var message = "The " + type + " '" + name + "' is used in the template but importing it would create a cycle: ";
        return diagnostics_1.makeRelatedInformation(ref.node, message + path);
    }
    /**
     * Checks whether a selector is a valid custom element tag name.
     * Based loosely on https://github.com/sindresorhus/validate-element-name.
     */
    function checkCustomElementSelectorForErrors(selector) {
        // Avoid flagging components with an attribute or class selector. This isn't bulletproof since it
        // won't catch cases like `foo[]bar`, but we don't need it to be. This is mainly to avoid flagging
        // something like `foo-bar[baz]` incorrectly.
        if (selector.includes('.') || (selector.includes('[') && selector.includes(']'))) {
            return null;
        }
        if (!(/^[a-z]/.test(selector))) {
            return 'Selector of a ShadowDom-encapsulated component must start with a lower case letter.';
        }
        if (/[A-Z]/.test(selector)) {
            return 'Selector of a ShadowDom-encapsulated component must all be in lower case.';
        }
        if (!selector.includes('-')) {
            return 'Selector of a component that uses ViewEncapsulation.ShadowDom must contain a hyphen.';
        }
        return null;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBdWpCO0lBQ3ZqQixtREFBNkQ7SUFDN0QsK0JBQWlDO0lBR2pDLDJFQUEwRztJQUMxRywyRUFBeUQ7SUFDekQsbUVBQXdGO0lBRXhGLDZGQUEySztJQUUzSyxxRUFBK087SUFDL08sdUZBQW1GO0lBQ25GLDZEQUFtRDtJQUNuRCx5RUFBb0g7SUFFcEgsdUVBQThJO0lBTTlJLDJGQUE0RztJQUM1Ryx1RkFBNEY7SUFDNUYsbUZBQTBFO0lBQzFFLHFGQUFnRDtJQUNoRCx1RkFBMkM7SUFDM0MsNkVBQXlPO0lBRXpPLElBQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO0lBQ2hELElBQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztJQStFOUI7O09BRUc7SUFDSDtRQUFxQywyQ0FBZTtRQUFwRDtZQUFBLHFFQXFFQztZQXBFQyxvQkFBYyxHQUF3QixFQUFFLENBQUM7WUFDekMsZUFBUyxHQUF3QixFQUFFLENBQUM7WUFDcEMsc0JBQWdCLEdBQUcsS0FBSyxDQUFDOztRQWtFM0IsQ0FBQztRQWhFQyx3Q0FBYyxHQUFkLFVBQWUsY0FBOEIsRUFBRSxpQkFBc0M7WUFDbkYsSUFBSSxDQUFDLENBQUMsY0FBYyxZQUFZLGVBQWUsQ0FBQyxFQUFFO2dCQUNoRCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsc0ZBQXNGO1lBQ3RGLDhGQUE4RjtZQUM5RixZQUFZO1lBQ1osSUFBTSxrQkFBa0IsR0FBRyxVQUFDLE9BQTBCLEVBQUUsUUFBMkI7Z0JBQy9FLE9BQUEsaUNBQWdCLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENB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S0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEVBQUUsSUFBSSxPQUFBLEVBQUUsQ0FBQyxRQUFRLEVBQVgsQ0FBVyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pFLElBQU0sT0FBTyxHQUNULFNBQU8sSUFBSSxVQUFLLElBQUksc0VBQW1FLENBQUM7UUFDNUYsT0FBTyxvQ0FBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBR0Q7OztPQUdHO0lBQ0gsU0FBUyxtQ0FBbUMsQ0FBQyxRQUFnQjtRQUMzRCxpR0FBaUc7UUFDakcsa0dBQWtHO1FBQ2xHLDZDQUE2QztRQUM3QyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtZQUNoRixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFO1lBQzlCLE9BQU8scUZBQXFGLENBQUM7U0FDOUY7UUFFRCxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDMUIsT0FBTywyRUFBMkUsQ0FBQztTQUNwRjtRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQzNCLE9BQU8sc0ZBQXNGLENBQUM7U0FDL0Y7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjb21waWxlQ2xhc3NNZXRhZGF0YSwgY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURlY2xhcmVDbGFzc01ldGFkYXRhLCBjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgQ29uc3RhbnRQb29sLCBDc3NTZWxlY3RvciwgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8sIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgRXhwcmVzc2lvbiwgRXh0ZXJuYWxFeHByLCBGYWN0b3J5VGFyZ2V0LCBJbnRlcnBvbGF0aW9uQ29uZmlnLCBMZXhlclJhbmdlLCBtYWtlQmluZGluZ1BhcnNlciwgUGFyc2VkVGVtcGxhdGUsIFBhcnNlU291cmNlRmlsZSwgcGFyc2VUZW1wbGF0ZSwgUjNDbGFzc01ldGFkYXRhLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM1RhcmdldEJpbmRlciwgUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGEsIFNlbGVjdG9yTWF0Y2hlciwgU3RhdGVtZW50LCBUbXBsQXN0Tm9kZSwgV3JhcHBlZE5vZGVFeHByfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQge1ZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICdAYW5ndWxhci9jb21waWxlci9zcmMvY29yZSc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtDeWNsZSwgQ3ljbGVBbmFseXplciwgQ3ljbGVIYW5kbGluZ1N0cmF0ZWd5fSBmcm9tICcuLi8uLi9jeWNsZXMnO1xuaW1wb3J0IHtFcnJvckNvZGUsIEZhdGFsRGlhZ25vc3RpY0Vycm9yLCBtYWtlRGlhZ25vc3RpYywgbWFrZVJlbGF0ZWRJbmZvcm1hdGlvbn0gZnJvbSAnLi4vLi4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHthYnNvbHV0ZUZyb20sIHJlbGF0aXZlfSBmcm9tICcuLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0ltcG9ydGVkRmlsZSwgTW9kdWxlUmVzb2x2ZXIsIFJlZmVyZW5jZSwgUmVmZXJlbmNlRW1pdHRlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0RlcGVuZGVuY3lUcmFja2VyfSBmcm9tICcuLi8uLi9pbmNyZW1lbnRhbC9hcGknO1xuaW1wb3J0IHtleHRyYWN0U2VtYW50aWNUeXBlUGFyYW1ldGVycywgaXNBcnJheUVxdWFsLCBpc1JlZmVyZW5jZUVxdWFsLCBTZW1hbnRpY0RlcEdyYXBoVXBkYXRlciwgU2VtYW50aWNSZWZlcmVuY2UsIFNlbWFudGljU3ltYm9sfSBmcm9tICcuLi8uLi9pbmNyZW1lbnRhbC9zZW1hbnRpY19ncmFwaCc7XG5pbXBvcnQge0luZGV4aW5nQ29udGV4dH0gZnJvbSAnLi4vLi4vaW5kZXhlcic7XG5pbXBvcnQge0NsYXNzUHJvcGVydHlNYXBwaW5nLCBDb21wb25lbnRSZXNvdXJjZXMsIERpcmVjdGl2ZU1ldGEsIERpcmVjdGl2ZVR5cGVDaGVja01ldGEsIGV4dHJhY3REaXJlY3RpdmVUeXBlQ2hlY2tNZXRhLCBJbmplY3RhYmxlQ2xhc3NSZWdpc3RyeSwgTWV0YWRhdGFSZWFkZXIsIE1ldGFkYXRhUmVnaXN0cnksIE1ldGFUeXBlLCBSZXNvdXJjZSwgUmVzb3VyY2VSZWdpc3RyeX0gZnJvbSAnLi4vLi4vbWV0YWRhdGEnO1xuaW1wb3J0IHtFbnVtVmFsdWUsIFBhcnRpYWxFdmFsdWF0b3IsIFJlc29sdmVkVmFsdWV9IGZyb20gJy4uLy4uL3BhcnRpYWxfZXZhbHVhdG9yJztcbmltcG9ydCB7UGVyZkV2ZW50LCBQZXJmUmVjb3JkZXJ9IGZyb20gJy4uLy4uL3BlcmYnO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBEZWNsYXJhdGlvbk5vZGUsIERlY29yYXRvciwgUmVmbGVjdGlvbkhvc3QsIHJlZmxlY3RPYmplY3RMaXRlcmFsfSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7Q29tcG9uZW50U2NvcGVSZWFkZXIsIExvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeSwgVHlwZUNoZWNrU2NvcGVSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtBbmFseXNpc091dHB1dCwgQ29tcGlsZVJlc3VsdCwgRGVjb3JhdG9ySGFuZGxlciwgRGV0ZWN0UmVzdWx0LCBIYW5kbGVyRmxhZ3MsIEhhbmRsZXJQcmVjZWRlbmNlLCBSZXNvbHZlUmVzdWx0fSBmcm9tICcuLi8uLi90cmFuc2Zvcm0nO1xuaW1wb3J0IHtUZW1wbGF0ZVNvdXJjZU1hcHBpbmcsIFR5cGVDaGVja0NvbnRleHR9IGZyb20gJy4uLy4uL3R5cGVjaGVjay9hcGknO1xuaW1wb3J0IHtTdWJzZXRPZktleXN9IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtYaTE4bkNvbnRleHR9IGZyb20gJy4uLy4uL3hpMThuJztcblxuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yLCBnZXREaXJlY3RpdmVEaWFnbm9zdGljcywgZ2V0UHJvdmlkZXJEaWFnbm9zdGljc30gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge0RpcmVjdGl2ZVN5bWJvbCwgZXh0cmFjdERpcmVjdGl2ZU1ldGFkYXRhLCBwYXJzZUZpZWxkQXJyYXlWYWx1ZX0gZnJvbSAnLi9kaXJlY3RpdmUnO1xuaW1wb3J0IHtjb21waWxlRGVjbGFyZUZhY3RvcnksIGNvbXBpbGVOZ0ZhY3RvcnlEZWZGaWVsZH0gZnJvbSAnLi9mYWN0b3J5JztcbmltcG9ydCB7ZXh0cmFjdENsYXNzTWV0YWRhdGF9IGZyb20gJy4vbWV0YWRhdGEnO1xuaW1wb3J0IHtOZ01vZHVsZVN5bWJvbH0gZnJvbSAnLi9uZ19tb2R1bGUnO1xuaW1wb3J0IHtjb21waWxlUmVzdWx0cywgZmluZEFuZ3VsYXJEZWNvcmF0b3IsIGlzQW5ndWxhckNvcmVSZWZlcmVuY2UsIGlzRXhwcmVzc2lvbkZvcndhcmRSZWZlcmVuY2UsIHJlYWRCYXNlQ2xhc3MsIHJlc29sdmVQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LCB0b0ZhY3RvcnlNZXRhZGF0YSwgdW53cmFwRXhwcmVzc2lvbiwgd3JhcEZ1bmN0aW9uRXhwcmVzc2lvbnNJblBhcmVuc30gZnJvbSAnLi91dGlsJztcblxuY29uc3QgRU1QVFlfTUFQID0gbmV3IE1hcDxzdHJpbmcsIEV4cHJlc3Npb24+KCk7XG5jb25zdCBFTVBUWV9BUlJBWTogYW55W10gPSBbXTtcblxuLyoqXG4gKiBUaGVzZSBmaWVsZHMgb2YgYFIzQ29tcG9uZW50TWV0YWRhdGFgIGFyZSB1cGRhdGVkIGluIHRoZSBgcmVzb2x2ZWAgcGhhc2UuXG4gKlxuICogVGhlIGBrZXlvZiBSM0NvbXBvbmVudE1ldGFkYXRhICZgIGNvbmRpdGlvbiBlbnN1cmVzIHRoYXQgb25seSBmaWVsZHMgb2YgYFIzQ29tcG9uZW50TWV0YWRhdGFgIGNhblxuICogYmUgaW5jbHVkZWQgaGVyZS5cbiAqL1xuZXhwb3J0IHR5cGUgQ29tcG9uZW50TWV0YWRhdGFSZXNvbHZlZEZpZWxkcyA9XG4gICAgU3Vic2V0T2ZLZXlzPFIzQ29tcG9uZW50TWV0YWRhdGEsICdkaXJlY3RpdmVzJ3wncGlwZXMnfCdkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSc+O1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBvbmVudEFuYWx5c2lzRGF0YSB7XG4gIC8qKlxuICAgKiBgbWV0YWAgaW5jbHVkZXMgdGhvc2UgZmllbGRzIG9mIGBSM0NvbXBvbmVudE1ldGFkYXRhYCB3aGljaCBhcmUgY2FsY3VsYXRlZCBhdCBgYW5hbHl6ZWAgdGltZVxuICAgKiAobm90IGR1cmluZyByZXNvbHZlKS5cbiAgICovXG4gIG1ldGE6IE9taXQ8UjNDb21wb25lbnRNZXRhZGF0YSwgQ29tcG9uZW50TWV0YWRhdGFSZXNvbHZlZEZpZWxkcz47XG4gIGJhc2VDbGFzczogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+fCdkeW5hbWljJ3xudWxsO1xuICB0eXBlQ2hlY2tNZXRhOiBEaXJlY3RpdmVUeXBlQ2hlY2tNZXRhO1xuICB0ZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGVXaXRoU291cmNlO1xuICBjbGFzc01ldGFkYXRhOiBSM0NsYXNzTWV0YWRhdGF8bnVsbDtcblxuICBpbnB1dHM6IENsYXNzUHJvcGVydHlNYXBwaW5nO1xuICBvdXRwdXRzOiBDbGFzc1Byb3BlcnR5TWFwcGluZztcblxuICAvKipcbiAgICogUHJvdmlkZXJzIGV4dHJhY3RlZCBmcm9tIHRoZSBgcHJvdmlkZXJzYCBmaWVsZCBvZiB0aGUgY29tcG9uZW50IGFubm90YXRpb24gd2hpY2ggd2lsbCByZXF1aXJlXG4gICAqIGFuIEFuZ3VsYXIgZmFjdG9yeSBkZWZpbml0aW9uIGF0IHJ1bnRpbWUuXG4gICAqL1xuICBwcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5OiBTZXQ8UmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+PnxudWxsO1xuXG4gIC8qKlxuICAgKiBQcm92aWRlcnMgZXh0cmFjdGVkIGZyb20gdGhlIGB2aWV3UHJvdmlkZXJzYCBmaWVsZCBvZiB0aGUgY29tcG9uZW50IGFubm90YXRpb24gd2hpY2ggd2lsbFxuICAgKiByZXF1aXJlIGFuIEFuZ3VsYXIgZmFjdG9yeSBkZWZpbml0aW9uIGF0IHJ1bnRpbWUuXG4gICAqL1xuICB2aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeTogU2V0PFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj58bnVsbDtcblxuICByZXNvdXJjZXM6IENvbXBvbmVudFJlc291cmNlcztcblxuICAvKipcbiAgICogYHN0eWxlVXJsc2AgZXh0cmFjdGVkIGZyb20gdGhlIGRlY29yYXRvciwgaWYgcHJlc2VudC5cbiAgICovXG4gIHN0eWxlVXJsczogU3R5bGVVcmxNZXRhW118bnVsbDtcblxuICAvKipcbiAgICogSW5saW5lIHN0eWxlc2hlZXRzIGV4dHJhY3RlZCBmcm9tIHRoZSBkZWNvcmF0b3IsIGlmIHByZXNlbnQuXG4gICAqL1xuICBpbmxpbmVTdHlsZXM6IHN0cmluZ1tdfG51bGw7XG5cbiAgaXNQb2lzb25lZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgQ29tcG9uZW50UmVzb2x1dGlvbkRhdGEgPSBQaWNrPFIzQ29tcG9uZW50TWV0YWRhdGEsIENvbXBvbmVudE1ldGFkYXRhUmVzb2x2ZWRGaWVsZHM+O1xuXG4vKipcbiAqIFRoZSBsaXRlcmFsIHN0eWxlIHVybCBleHRyYWN0ZWQgZnJvbSB0aGUgZGVjb3JhdG9yLCBhbG9uZyB3aXRoIG1ldGFkYXRhIGZvciBkaWFnbm9zdGljcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsZVVybE1ldGEge1xuICB1cmw6IHN0cmluZztcbiAgbm9kZUZvckVycm9yOiB0cy5Ob2RlO1xuICBzb3VyY2U6IFJlc291cmNlVHlwZUZvckRpYWdub3N0aWNzLlN0eWxlc2hlZXRGcm9tVGVtcGxhdGV8XG4gICAgICBSZXNvdXJjZVR5cGVGb3JEaWFnbm9zdGljcy5TdHlsZXNoZWV0RnJvbURlY29yYXRvcjtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgb3JpZ2luIG9mIGEgcmVzb3VyY2UgaW4gdGhlIGFwcGxpY2F0aW9uIGNvZGUuIFRoaXMgaXMgdXNlZCBmb3IgY3JlYXRpbmdcbiAqIGRpYWdub3N0aWNzLCBzbyB3ZSBjYW4gcG9pbnQgdG8gdGhlIHJvb3QgY2F1c2Ugb2YgYW4gZXJyb3IgaW4gdGhlIGFwcGxpY2F0aW9uIGNvZGUuXG4gKlxuICogQSB0ZW1wbGF0ZSByZXNvdXJjZSBjb21lcyBmcm9tIHRoZSBgdGVtcGxhdGVVcmxgIHByb3BlcnR5IG9uIHRoZSBjb21wb25lbnQgZGVjb3JhdG9yLlxuICpcbiAqIFN0eWxlc2hlZXRzIHJlc291cmNlcyBjYW4gY29tZSBmcm9tIGVpdGhlciB0aGUgYHN0eWxlVXJsc2AgcHJvcGVydHkgb24gdGhlIGNvbXBvbmVudCBkZWNvcmF0b3IsXG4gKiBvciBmcm9tIGlubGluZSBgc3R5bGVgIHRhZ3MgYW5kIHN0eWxlIGxpbmtzIG9uIHRoZSBleHRlcm5hbCB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3Mge1xuICBUZW1wbGF0ZSxcbiAgU3R5bGVzaGVldEZyb21UZW1wbGF0ZSxcbiAgU3R5bGVzaGVldEZyb21EZWNvcmF0b3IsXG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBBbmd1bGFyIGNvbXBvbmVudC5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudFN5bWJvbCBleHRlbmRzIERpcmVjdGl2ZVN5bWJvbCB7XG4gIHVzZWREaXJlY3RpdmVzOiBTZW1hbnRpY1JlZmVyZW5jZVtdID0gW107XG4gIHVzZWRQaXBlczogU2VtYW50aWNSZWZlcmVuY2VbXSA9IFtdO1xuICBpc1JlbW90ZWx5U2NvcGVkID0gZmFsc2U7XG5cbiAgaXNFbWl0QWZmZWN0ZWQocHJldmlvdXNTeW1ib2w6IFNlbWFudGljU3ltYm9sLCBwdWJsaWNBcGlBZmZlY3RlZDogU2V0PFNlbWFudGljU3ltYm9sPik6IGJvb2xlYW4ge1xuICAgIGlmICghKHByZXZpb3VzU3ltYm9sIGluc3RhbmNlb2YgQ29tcG9uZW50U3ltYm9sKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGFuIGVxdWFsaXR5IGZ1bmN0aW9uIHRoYXQgY29uc2lkZXJzIHN5bWJvbHMgZXF1YWwgaWYgdGhleSByZXByZXNlbnQgdGhlIHNhbWVcbiAgICAvLyBkZWNsYXJhdGlvbiwgYnV0IG9ubHkgaWYgdGhlIHN5bWJvbCBpbiB0aGUgY3VycmVudCBjb21waWxhdGlvbiBkb2VzIG5vdCBoYXZlIGl0cyBwdWJsaWMgQVBJXG4gICAgLy8gYWZmZWN0ZWQuXG4gICAgY29uc3QgaXNTeW1ib2xVbmFmZmVjdGVkID0gKGN1cnJlbnQ6IFNlbWFudGljUmVmZXJlbmNlLCBwcmV2aW91czogU2VtYW50aWNSZWZlcmVuY2UpID0+XG4gICAgICAgIGlzUmVmZXJlbmNlRXF1YWwoY3VycmVudCwgcHJldmlvdXMpICYmICFwdWJsaWNBcGlBZmZlY3RlZC5oYXMoY3VycmVudC5zeW1ib2wpO1xuXG4gICAgLy8gVGhlIGVtaXQgb2YgYSBjb21wb25lbnQgaXMgYWZmZWN0ZWQgaWYgZWl0aGVyIG9mIHRoZSBmb2xsb3dpbmcgaXMgdHJ1ZTpcbiAgICAvLyAgMS4gVGhlIGNvbXBvbmVudCB1c2VkIHRvIGJlIHJlbW90ZWx5IHNjb3BlZCBidXQgbm8gbG9uZ2VyIGlzLCBvciB2aWNlIHZlcnNhLlxuICAgIC8vICAyLiBUaGUgbGlzdCBvZiB1c2VkIGRpcmVjdGl2ZXMgaGFzIGNoYW5nZWQgb3IgYW55IG9mIHRob3NlIGRpcmVjdGl2ZXMgaGF2ZSBoYWQgdGhlaXIgcHVibGljXG4gICAgLy8gICAgIEFQSSBjaGFuZ2VkLiBJZiB0aGUgdXNlZCBkaXJlY3RpdmVzIGhhdmUgYmVlbiByZW9yZGVyZWQgYnV0IG5vdCBvdGhlcndpc2UgYWZmZWN0ZWQgdGhlblxuICAgIC8vICAgICB0aGUgY29tcG9uZW50IG11c3Qgc3RpbGwgYmUgcmUtZW1pdHRlZCwgYXMgdGhpcyBtYXkgYWZmZWN0IGRpcmVjdGl2ZSBpbnN0YW50aWF0aW9uIG9yZGVyLlxuICAgIC8vICAzLiBUaGUgbGlzdCBvZiB1c2VkIHBpcGVzIGhhcyBjaGFuZ2VkLCBvciBhbnkgb2YgdGhvc2UgcGlwZXMgaGF2ZSBoYWQgdGhlaXIgcHVibGljIEFQSVxuICAgIC8vICAgICBjaGFuZ2VkLlxuICAgIHJldHVybiB0aGlzLmlzUmVtb3RlbHlTY29wZWQgIT09IHByZXZpb3VzU3ltYm9sLmlzUmVtb3RlbHlTY29wZWQgfHxcbiAgICAgICAgIWlzQXJyYXlFcXVhbCh0aGlzLnVzZWREaXJlY3RpdmVzLCBwcmV2aW91c1N5bWJvbC51c2VkRGlyZWN0aXZlcywgaXNTeW1ib2xVbmFmZmVjdGVkKSB8fFxuICAgICAgICAhaXNBcnJheUVxdWFsKHRoaXMudXNlZFBpcGVzLCBwcmV2aW91c1N5bWJvbC51c2VkUGlwZXMsIGlzU3ltYm9sVW5hZmZlY3RlZCk7XG4gIH1cblxuICBpc1R5cGVDaGVja0Jsb2NrQWZmZWN0ZWQoXG4gICAgICBwcmV2aW91c1N5bWJvbDogU2VtYW50aWNTeW1ib2wsIHR5cGVDaGVja0FwaUFmZmVjdGVkOiBTZXQ8U2VtYW50aWNTeW1ib2w+KTogYm9vbGVhbiB7XG4gICAgaWYgKCEocHJldmlvdXNTeW1ib2wgaW5zdGFuY2VvZiBDb21wb25lbnRTeW1ib2wpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBUbyB2ZXJpZnkgdGhhdCBhIHVzZWQgZGlyZWN0aXZlIGlzIG5vdCBhZmZlY3RlZCB3ZSBuZWVkIHRvIHZlcmlmeSB0aGF0IGl0cyBmdWxsIGluaGVyaXRhbmNlXG4gICAgLy8gY2hhaW4gaXMgbm90IHByZXNlbnQgaW4gYHR5cGVDaGVja0FwaUFmZmVjdGVkYC5cbiAgICBjb25zdCBpc0luaGVyaXRhbmNlQ2hhaW5BZmZlY3RlZCA9IChzeW1ib2w6IFNlbWFudGljU3ltYm9sKTogYm9vbGVhbiA9PiB7XG4gICAgICBsZXQgY3VycmVudFN5bWJvbDogU2VtYW50aWNTeW1ib2x8bnVsbCA9IHN5bWJvbDtcbiAgICAgIHdoaWxlIChjdXJyZW50U3ltYm9sIGluc3RhbmNlb2YgRGlyZWN0aXZlU3ltYm9sKSB7XG4gICAgICAgIGlmICh0eXBlQ2hlY2tBcGlBZmZlY3RlZC5oYXMoY3VycmVudFN5bWJvbCkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50U3ltYm9sID0gY3VycmVudFN5bWJvbC5iYXNlQ2xhc3M7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIGFuIGVxdWFsaXR5IGZ1bmN0aW9uIHRoYXQgY29uc2lkZXJzIGRpcmVjdGl2ZXMgZXF1YWwgaWYgdGhleSByZXByZXNlbnQgdGhlIHNhbWVcbiAgICAvLyBkZWNsYXJhdGlvbiBhbmQgaWYgdGhlIHN5bWJvbCBhbmQgYWxsIHN5bWJvbHMgaXQgaW5oZXJpdHMgZnJvbSBpbiB0aGUgY3VycmVudCBjb21waWxhdGlvblxuICAgIC8vIGRvIG5vdCBoYXZlIHRoZWlyIHR5cGUtY2hlY2sgQVBJIGFmZmVjdGVkLlxuICAgIGNvbnN0IGlzRGlyZWN0aXZlVW5hZmZlY3RlZCA9IChjdXJyZW50OiBTZW1hbnRpY1JlZmVyZW5jZSwgcHJldmlvdXM6IFNlbWFudGljUmVmZXJlbmNlKSA9PlxuICAgICAgICBpc1JlZmVyZW5jZUVxdWFsKGN1cnJlbnQsIHByZXZpb3VzKSAmJiAhaXNJbmhlcml0YW5jZUNoYWluQWZmZWN0ZWQoY3VycmVudC5zeW1ib2wpO1xuXG4gICAgLy8gQ3JlYXRlIGFuIGVxdWFsaXR5IGZ1bmN0aW9uIHRoYXQgY29uc2lkZXJzIHBpcGVzIGVxdWFsIGlmIHRoZXkgcmVwcmVzZW50IHRoZSBzYW1lXG4gICAgLy8gZGVjbGFyYXRpb24gYW5kIGlmIHRoZSBzeW1ib2wgaW4gdGhlIGN1cnJlbnQgY29tcGlsYXRpb24gZG9lcyBub3QgaGF2ZSBpdHMgdHlwZS1jaGVja1xuICAgIC8vIEFQSSBhZmZlY3RlZC5cbiAgICBjb25zdCBpc1BpcGVVbmFmZmVjdGVkID0gKGN1cnJlbnQ6IFNlbWFudGljUmVmZXJlbmNlLCBwcmV2aW91czogU2VtYW50aWNSZWZlcmVuY2UpID0+XG4gICAgICAgIGlzUmVmZXJlbmNlRXF1YWwoY3VycmVudCwgcHJldmlvdXMpICYmICF0eXBlQ2hlY2tBcGlBZmZlY3RlZC5oYXMoY3VycmVudC5zeW1ib2wpO1xuXG4gICAgLy8gVGhlIGVtaXQgb2YgYSB0eXBlLWNoZWNrIGJsb2NrIG9mIGEgY29tcG9uZW50IGlzIGFmZmVjdGVkIGlmIGVpdGhlciBvZiB0aGUgZm9sbG93aW5nIGlzIHRydWU6XG4gICAgLy8gIDEuIFRoZSBsaXN0IG9mIHVzZWQgZGlyZWN0aXZlcyBoYXMgY2hhbmdlZCBvciBhbnkgb2YgdGhvc2UgZGlyZWN0aXZlcyBoYXZlIGhhZCB0aGVpclxuICAgIC8vICAgICB0eXBlLWNoZWNrIEFQSSBjaGFuZ2VkLlxuICAgIC8vICAyLiBUaGUgbGlzdCBvZiB1c2VkIHBpcGVzIGhhcyBjaGFuZ2VkLCBvciBhbnkgb2YgdGhvc2UgcGlwZXMgaGF2ZSBoYWQgdGhlaXIgdHlwZS1jaGVjayBBUElcbiAgICAvLyAgICAgY2hhbmdlZC5cbiAgICByZXR1cm4gIWlzQXJyYXlFcXVhbChcbiAgICAgICAgICAgICAgIHRoaXMudXNlZERpcmVjdGl2ZXMsIHByZXZpb3VzU3ltYm9sLnVzZWREaXJlY3RpdmVzLCBpc0RpcmVjdGl2ZVVuYWZmZWN0ZWQpIHx8XG4gICAgICAgICFpc0FycmF5RXF1YWwodGhpcy51c2VkUGlwZXMsIHByZXZpb3VzU3ltYm9sLnVzZWRQaXBlcywgaXNQaXBlVW5hZmZlY3RlZCk7XG4gIH1cbn1cblxuLyoqXG4gKiBgRGVjb3JhdG9ySGFuZGxlcmAgd2hpY2ggaGFuZGxlcyB0aGUgYEBDb21wb25lbnRgIGFubm90YXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnREZWNvcmF0b3JIYW5kbGVyIGltcGxlbWVudHNcbiAgICBEZWNvcmF0b3JIYW5kbGVyPERlY29yYXRvciwgQ29tcG9uZW50QW5hbHlzaXNEYXRhLCBDb21wb25lbnRTeW1ib2wsIENvbXBvbmVudFJlc29sdXRpb25EYXRhPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LCBwcml2YXRlIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcixcbiAgICAgIHByaXZhdGUgbWV0YVJlZ2lzdHJ5OiBNZXRhZGF0YVJlZ2lzdHJ5LCBwcml2YXRlIG1ldGFSZWFkZXI6IE1ldGFkYXRhUmVhZGVyLFxuICAgICAgcHJpdmF0ZSBzY29wZVJlYWRlcjogQ29tcG9uZW50U2NvcGVSZWFkZXIsIHByaXZhdGUgc2NvcGVSZWdpc3RyeTogTG9jYWxNb2R1bGVTY29wZVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSB0eXBlQ2hlY2tTY29wZVJlZ2lzdHJ5OiBUeXBlQ2hlY2tTY29wZVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSByZXNvdXJjZVJlZ2lzdHJ5OiBSZXNvdXJjZVJlZ2lzdHJ5LCBwcml2YXRlIGlzQ29yZTogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgcmVzb3VyY2VMb2FkZXI6IFJlc291cmNlTG9hZGVyLCBwcml2YXRlIHJvb3REaXJzOiBSZWFkb25seUFycmF5PHN0cmluZz4sXG4gICAgICBwcml2YXRlIGRlZmF1bHRQcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuLCBwcml2YXRlIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdDogYm9vbGVhbiwgcHJpdmF0ZSB1c2VQb2lzb25lZERhdGE6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVczogYm9vbGVhbnx1bmRlZmluZWQsXG4gICAgICBwcml2YXRlIG1vZHVsZVJlc29sdmVyOiBNb2R1bGVSZXNvbHZlciwgcHJpdmF0ZSBjeWNsZUFuYWx5emVyOiBDeWNsZUFuYWx5emVyLFxuICAgICAgcHJpdmF0ZSBjeWNsZUhhbmRsaW5nU3RyYXRlZ3k6IEN5Y2xlSGFuZGxpbmdTdHJhdGVneSwgcHJpdmF0ZSByZWZFbWl0dGVyOiBSZWZlcmVuY2VFbWl0dGVyLFxuICAgICAgcHJpdmF0ZSBkZXBUcmFja2VyOiBEZXBlbmRlbmN5VHJhY2tlcnxudWxsLFxuICAgICAgcHJpdmF0ZSBpbmplY3RhYmxlUmVnaXN0cnk6IEluamVjdGFibGVDbGFzc1JlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBzZW1hbnRpY0RlcEdyYXBoVXBkYXRlcjogU2VtYW50aWNEZXBHcmFwaFVwZGF0ZXJ8bnVsbCxcbiAgICAgIHByaXZhdGUgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXI6IGJvb2xlYW4sIHByaXZhdGUgcGVyZjogUGVyZlJlY29yZGVyKSB7fVxuXG4gIHByaXZhdGUgbGl0ZXJhbENhY2hlID0gbmV3IE1hcDxEZWNvcmF0b3IsIHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uPigpO1xuICBwcml2YXRlIGVsZW1lbnRTY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuICAvKipcbiAgICogRHVyaW5nIHRoZSBhc3luY2hyb25vdXMgcHJlYW5hbHl6ZSBwaGFzZSwgaXQncyBuZWNlc3NhcnkgdG8gcGFyc2UgdGhlIHRlbXBsYXRlIHRvIGV4dHJhY3RcbiAgICogYW55IHBvdGVudGlhbCA8bGluaz4gdGFncyB3aGljaCBtaWdodCBuZWVkIHRvIGJlIGxvYWRlZC4gVGhpcyBjYWNoZSBlbnN1cmVzIHRoYXQgd29yayBpcyBub3RcbiAgICogdGhyb3duIGF3YXksIGFuZCB0aGUgcGFyc2VkIHRlbXBsYXRlIGlzIHJldXNlZCBkdXJpbmcgdGhlIGFuYWx5emUgcGhhc2UuXG4gICAqL1xuICBwcml2YXRlIHByZWFuYWx5emVUZW1wbGF0ZUNhY2hlID0gbmV3IE1hcDxEZWNsYXJhdGlvbk5vZGUsIFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZT4oKTtcbiAgcHJpdmF0ZSBwcmVhbmFseXplU3R5bGVzQ2FjaGUgPSBuZXcgTWFwPERlY2xhcmF0aW9uTm9kZSwgc3RyaW5nW118bnVsbD4oKTtcblxuICByZWFkb25seSBwcmVjZWRlbmNlID0gSGFuZGxlclByZWNlZGVuY2UuUFJJTUFSWTtcbiAgcmVhZG9ubHkgbmFtZSA9IENvbXBvbmVudERlY29yYXRvckhhbmRsZXIubmFtZTtcblxuICBkZXRlY3Qobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgZGVjb3JhdG9yczogRGVjb3JhdG9yW118bnVsbCk6IERldGVjdFJlc3VsdDxEZWNvcmF0b3I+fHVuZGVmaW5lZCB7XG4gICAgaWYgKCFkZWNvcmF0b3JzKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBkZWNvcmF0b3IgPSBmaW5kQW5ndWxhckRlY29yYXRvcihkZWNvcmF0b3JzLCAnQ29tcG9uZW50JywgdGhpcy5pc0NvcmUpO1xuICAgIGlmIChkZWNvcmF0b3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJpZ2dlcjogZGVjb3JhdG9yLm5vZGUsXG4gICAgICAgIGRlY29yYXRvcixcbiAgICAgICAgbWV0YWRhdGE6IGRlY29yYXRvcixcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgcHJlYW5hbHl6ZShub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IFJlYWRvbmx5PERlY29yYXRvcj4pOiBQcm9taXNlPHZvaWQ+fHVuZGVmaW5lZCB7XG4gICAgLy8gSW4gcHJlYW5hbHl6ZSwgcmVzb3VyY2UgVVJMcyBhc3NvY2lhdGVkIHdpdGggdGhlIGNvbXBvbmVudCBhcmUgYXN5bmNocm9ub3VzbHkgcHJlbG9hZGVkIHZpYVxuICAgIC8vIHRoZSByZXNvdXJjZUxvYWRlci4gVGhpcyBpcyB0aGUgb25seSB0aW1lIGFzeW5jIG9wZXJhdGlvbnMgYXJlIGFsbG93ZWQgZm9yIGEgY29tcG9uZW50LlxuICAgIC8vIFRoZXNlIHJlc291cmNlcyBhcmU6XG4gICAgLy9cbiAgICAvLyAtIHRoZSB0ZW1wbGF0ZVVybCwgaWYgdGhlcmUgaXMgb25lXG4gICAgLy8gLSBhbnkgc3R5bGVVcmxzIGlmIHByZXNlbnRcbiAgICAvLyAtIGFueSBzdHlsZXNoZWV0cyByZWZlcmVuY2VkIGZyb20gPGxpbms+IHRhZ3MgaW4gdGhlIHRlbXBsYXRlIGl0c2VsZlxuICAgIC8vXG4gICAgLy8gQXMgYSByZXN1bHQgb2YgdGhlIGxhc3Qgb25lLCB0aGUgdGVtcGxhdGUgbXVzdCBiZSBwYXJzZWQgYXMgcGFydCBvZiBwcmVhbmFseXNpcyB0byBleHRyYWN0XG4gICAgLy8gPGxpbms+IHRhZ3MsIHdoaWNoIG1heSBpbnZvbHZlIHdhaXRpbmcgZm9yIHRoZSB0ZW1wbGF0ZVVybCB0byBiZSByZXNvbHZlZCBmaXJzdC5cblxuICAgIC8vIElmIHByZWxvYWRpbmcgaXNuJ3QgcG9zc2libGUsIHRoZW4gc2tpcCB0aGlzIHN0ZXAuXG4gICAgaWYgKCF0aGlzLnJlc291cmNlTG9hZGVyLmNhblByZWxvYWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YSA9IHRoaXMuX3Jlc29sdmVMaXRlcmFsKGRlY29yYXRvcik7XG4gICAgY29uc3QgY29tcG9uZW50ID0gcmVmbGVjdE9iamVjdExpdGVyYWwobWV0YSk7XG4gICAgY29uc3QgY29udGFpbmluZ0ZpbGUgPSBub2RlLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZTtcblxuICAgIGNvbnN0IHJlc29sdmVTdHlsZVVybCA9IChzdHlsZVVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPnx1bmRlZmluZWQgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzb3VyY2VVcmwgPSB0aGlzLnJlc291cmNlTG9hZGVyLnJlc29sdmUoc3R5bGVVcmwsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VMb2FkZXIucHJlbG9hZChyZXNvdXJjZVVybCwge3R5cGU6ICdzdHlsZScsIGNvbnRhaW5pbmdGaWxlfSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gRG9uJ3Qgd29ycnkgYWJvdXQgZmFpbHVyZXMgdG8gcHJlbG9hZC4gV2UgY2FuIGhhbmRsZSB0aGlzIHByb2JsZW0gZHVyaW5nIGFuYWx5c2lzIGJ5XG4gICAgICAgIC8vIHByb2R1Y2luZyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIEEgUHJvbWlzZSB0aGF0IHdhaXRzIGZvciB0aGUgdGVtcGxhdGUgYW5kIGFsbCA8bGluaz5lZCBzdHlsZXMgd2l0aGluIGl0IHRvIGJlIHByZWxvYWRlZC5cbiAgICBjb25zdCB0ZW1wbGF0ZUFuZFRlbXBsYXRlU3R5bGVSZXNvdXJjZXMgPVxuICAgICAgICB0aGlzLl9wcmVsb2FkQW5kUGFyc2VUZW1wbGF0ZShub2RlLCBkZWNvcmF0b3IsIGNvbXBvbmVudCwgY29udGFpbmluZ0ZpbGUpXG4gICAgICAgICAgICAudGhlbigodGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZXxudWxsKTogUHJvbWlzZTx2b2lkPnx1bmRlZmluZWQgPT4ge1xuICAgICAgICAgICAgICBpZiAodGVtcGxhdGUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRlbXBsYXRlLnN0eWxlVXJscy5tYXAoc3R5bGVVcmwgPT4gcmVzb2x2ZVN0eWxlVXJsKHN0eWxlVXJsKSkpXG4gICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IGFsbCB0aGUgc3R5bGVVcmxzIGluIHRoZSBkZWNvcmF0b3IuXG4gICAgY29uc3QgY29tcG9uZW50U3R5bGVVcmxzID0gdGhpcy5fZXh0cmFjdENvbXBvbmVudFN0eWxlVXJscyhjb21wb25lbnQpO1xuXG4gICAgLy8gRXh0cmFjdCBpbmxpbmUgc3R5bGVzLCBwcm9jZXNzLCBhbmQgY2FjaGUgZm9yIHVzZSBpbiBzeW5jaHJvbm91cyBhbmFseXplIHBoYXNlXG4gICAgbGV0IGlubGluZVN0eWxlcztcbiAgICBpZiAoY29tcG9uZW50Lmhhcygnc3R5bGVzJykpIHtcbiAgICAgIGNvbnN0IGxpdFN0eWxlcyA9IHBhcnNlRmllbGRBcnJheVZhbHVlKGNvbXBvbmVudCwgJ3N0eWxlcycsIHRoaXMuZXZhbHVhdG9yKTtcbiAgICAgIGlmIChsaXRTdHlsZXMgPT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5wcmVhbmFseXplU3R5bGVzQ2FjaGUuc2V0KG5vZGUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5saW5lU3R5bGVzID0gUHJvbWlzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFsbChsaXRTdHlsZXMubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlID0+IHRoaXMucmVzb3VyY2VMb2FkZXIucHJlcHJvY2Vzc0lubGluZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGUsIHt0eXBlOiAnc3R5bGUnLCBjb250YWluaW5nRmlsZX0pKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHN0eWxlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHJlYW5hbHl6ZVN0eWxlc0NhY2hlLnNldChub2RlLCBzdHlsZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHJlYW5hbHl6ZVN0eWxlc0NhY2hlLnNldChub2RlLCBudWxsKTtcbiAgICB9XG5cbiAgICAvLyBXYWl0IGZvciBib3RoIHRoZSB0ZW1wbGF0ZSBhbmQgYWxsIHN0eWxlVXJsIHJlc291cmNlcyB0byByZXNvbHZlLlxuICAgIHJldHVybiBQcm9taXNlXG4gICAgICAgIC5hbGwoW1xuICAgICAgICAgIHRlbXBsYXRlQW5kVGVtcGxhdGVTdHlsZVJlc291cmNlcywgaW5saW5lU3R5bGVzLFxuICAgICAgICAgIC4uLmNvbXBvbmVudFN0eWxlVXJscy5tYXAoc3R5bGVVcmwgPT4gcmVzb2x2ZVN0eWxlVXJsKHN0eWxlVXJsLnVybCkpXG4gICAgICAgIF0pXG4gICAgICAgIC50aGVuKCgpID0+IHVuZGVmaW5lZCk7XG4gIH1cblxuICBhbmFseXplKFxuICAgICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgZGVjb3JhdG9yOiBSZWFkb25seTxEZWNvcmF0b3I+LFxuICAgICAgZmxhZ3M6IEhhbmRsZXJGbGFncyA9IEhhbmRsZXJGbGFncy5OT05FKTogQW5hbHlzaXNPdXRwdXQ8Q29tcG9uZW50QW5hbHlzaXNEYXRhPiB7XG4gICAgdGhpcy5wZXJmLmV2ZW50Q291bnQoUGVyZkV2ZW50LkFuYWx5emVDb21wb25lbnQpO1xuICAgIGNvbnN0IGNvbnRhaW5pbmdGaWxlID0gbm9kZS5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWU7XG4gICAgdGhpcy5saXRlcmFsQ2FjaGUuZGVsZXRlKGRlY29yYXRvcik7XG5cbiAgICBsZXQgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXXx1bmRlZmluZWQ7XG4gICAgbGV0IGlzUG9pc29uZWQgPSBmYWxzZTtcbiAgICAvLyBAQ29tcG9uZW50IGluaGVyaXRzIEBEaXJlY3RpdmUsIHNvIGJlZ2luIGJ5IGV4dHJhY3RpbmcgdGhlIEBEaXJlY3RpdmUgbWV0YWRhdGEgYW5kIGJ1aWxkaW5nXG4gICAgLy8gb24gaXQuXG4gICAgY29uc3QgZGlyZWN0aXZlUmVzdWx0ID0gZXh0cmFjdERpcmVjdGl2ZU1ldGFkYXRhKFxuICAgICAgICBub2RlLCBkZWNvcmF0b3IsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvciwgdGhpcy5pc0NvcmUsIGZsYWdzLFxuICAgICAgICB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyLFxuICAgICAgICB0aGlzLmVsZW1lbnRTY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKSk7XG4gICAgaWYgKGRpcmVjdGl2ZVJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBgZXh0cmFjdERpcmVjdGl2ZU1ldGFkYXRhYCByZXR1cm5zIHVuZGVmaW5lZCB3aGVuIHRoZSBARGlyZWN0aXZlIGhhcyBgaml0OiB0cnVlYC4gSW4gdGhpc1xuICAgICAgLy8gY2FzZSwgY29tcGlsYXRpb24gb2YgdGhlIGRlY29yYXRvciBpcyBza2lwcGVkLiBSZXR1cm5pbmcgYW4gZW1wdHkgb2JqZWN0IHNpZ25pZmllc1xuICAgICAgLy8gdGhhdCBubyBhbmFseXNpcyB3YXMgcHJvZHVjZWQuXG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgLy8gTmV4dCwgcmVhZCB0aGUgYEBDb21wb25lbnRgLXNwZWNpZmljIGZpZWxkcy5cbiAgICBjb25zdCB7ZGVjb3JhdG9yOiBjb21wb25lbnQsIG1ldGFkYXRhLCBpbnB1dHMsIG91dHB1dHN9ID0gZGlyZWN0aXZlUmVzdWx0O1xuICAgIGNvbnN0IGVuY2Fwc3VsYXRpb246IG51bWJlciA9XG4gICAgICAgIHRoaXMuX3Jlc29sdmVFbnVtVmFsdWUoY29tcG9uZW50LCAnZW5jYXBzdWxhdGlvbicsICdWaWV3RW5jYXBzdWxhdGlvbicpID8/XG4gICAgICAgIFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICAgIGNvbnN0IGNoYW5nZURldGVjdGlvbjogbnVtYmVyfG51bGwgPVxuICAgICAgICB0aGlzLl9yZXNvbHZlRW51bVZhbHVlKGNvbXBvbmVudCwgJ2NoYW5nZURldGVjdGlvbicsICdDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneScpO1xuXG4gICAgbGV0IGFuaW1hdGlvbnM6IEV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKGNvbXBvbmVudC5oYXMoJ2FuaW1hdGlvbnMnKSkge1xuICAgICAgYW5pbWF0aW9ucyA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LmdldCgnYW5pbWF0aW9ucycpISk7XG4gICAgfVxuXG4gICAgLy8gR28gdGhyb3VnaCB0aGUgcm9vdCBkaXJlY3RvcmllcyBmb3IgdGhpcyBwcm9qZWN0LCBhbmQgc2VsZWN0IHRoZSBvbmUgd2l0aCB0aGUgc21hbGxlc3RcbiAgICAvLyByZWxhdGl2ZSBwYXRoIHJlcHJlc2VudGF0aW9uLlxuICAgIGNvbnN0IHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoID0gdGhpcy5yb290RGlycy5yZWR1Y2U8c3RyaW5nfHVuZGVmaW5lZD4oKHByZXZpb3VzLCByb290RGlyKSA9PiB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSByZWxhdGl2ZShhYnNvbHV0ZUZyb20ocm9vdERpciksIGFic29sdXRlRnJvbShjb250YWluaW5nRmlsZSkpO1xuICAgICAgaWYgKHByZXZpb3VzID09PSB1bmRlZmluZWQgfHwgY2FuZGlkYXRlLmxlbmd0aCA8IHByZXZpb3VzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gY2FuZGlkYXRlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHByZXZpb3VzO1xuICAgICAgfVxuICAgIH0sIHVuZGVmaW5lZCkhO1xuXG5cbiAgICAvLyBOb3RlIHRoYXQgd2UgY291bGQgdGVjaG5pY2FsbHkgY29tYmluZSB0aGUgYHZpZXdQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5YCBhbmRcbiAgICAvLyBgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeWAgaW50byBhIHNpbmdsZSBzZXQsIGJ1dCB3ZSBrZWVwIHRoZSBzZXBhcmF0ZSBzbyB0aGF0XG4gICAgLy8gd2UgY2FuIGRpc3Rpbmd1aXNoIHdoZXJlIGFuIGVycm9yIGlzIGNvbWluZyBmcm9tIHdoZW4gbG9nZ2luZyB0aGUgZGlhZ25vc3RpY3MgaW4gYHJlc29sdmVgLlxuICAgIGxldCB2aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeTogU2V0PFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj58bnVsbCA9IG51bGw7XG4gICAgbGV0IHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3Rvcnk6IFNldDxSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4+fG51bGwgPSBudWxsO1xuICAgIGxldCB3cmFwcGVkVmlld1Byb3ZpZGVyczogRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICAgIGlmIChjb21wb25lbnQuaGFzKCd2aWV3UHJvdmlkZXJzJykpIHtcbiAgICAgIGNvbnN0IHZpZXdQcm92aWRlcnMgPSBjb21wb25lbnQuZ2V0KCd2aWV3UHJvdmlkZXJzJykhO1xuICAgICAgdmlld1Byb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkgPVxuICAgICAgICAgIHJlc29sdmVQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5KHZpZXdQcm92aWRlcnMsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvcik7XG4gICAgICB3cmFwcGVkVmlld1Byb3ZpZGVycyA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoXG4gICAgICAgICAgdGhpcy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA/IHdyYXBGdW5jdGlvbkV4cHJlc3Npb25zSW5QYXJlbnModmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3UHJvdmlkZXJzKTtcbiAgICB9XG5cbiAgICBpZiAoY29tcG9uZW50LmhhcygncHJvdmlkZXJzJykpIHtcbiAgICAgIHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkgPSByZXNvbHZlUHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeShcbiAgICAgICAgICBjb21wb25lbnQuZ2V0KCdwcm92aWRlcnMnKSEsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvcik7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlLlxuICAgIC8vIElmIGEgcHJlYW5hbHl6ZSBwaGFzZSB3YXMgZXhlY3V0ZWQsIHRoZSB0ZW1wbGF0ZSBtYXkgYWxyZWFkeSBleGlzdCBpbiBwYXJzZWQgZm9ybSwgc28gY2hlY2tcbiAgICAvLyB0aGUgcHJlYW5hbHl6ZVRlbXBsYXRlQ2FjaGUuXG4gICAgLy8gRXh0cmFjdCBhIGNsb3N1cmUgb2YgdGhlIHRlbXBsYXRlIHBhcnNpbmcgY29kZSBzbyB0aGF0IGl0IGNhbiBiZSByZXBhcnNlZCB3aXRoIGRpZmZlcmVudFxuICAgIC8vIG9wdGlvbnMgaWYgbmVlZGVkLCBsaWtlIGluIHRoZSBpbmRleGluZyBwaXBlbGluZS5cbiAgICBsZXQgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZTtcbiAgICBpZiAodGhpcy5wcmVhbmFseXplVGVtcGxhdGVDYWNoZS5oYXMobm9kZSkpIHtcbiAgICAgIC8vIFRoZSB0ZW1wbGF0ZSB3YXMgcGFyc2VkIGluIHByZWFuYWx5emUuIFVzZSBpdCBhbmQgZGVsZXRlIGl0IHRvIHNhdmUgbWVtb3J5LlxuICAgICAgY29uc3QgcHJlYW5hbHl6ZWQgPSB0aGlzLnByZWFuYWx5emVUZW1wbGF0ZUNhY2hlLmdldChub2RlKSE7XG4gICAgICB0aGlzLnByZWFuYWx5emVUZW1wbGF0ZUNhY2hlLmRlbGV0ZShub2RlKTtcblxuICAgICAgdGVtcGxhdGUgPSBwcmVhbmFseXplZDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGVtcGxhdGVEZWNsID0gdGhpcy5wYXJzZVRlbXBsYXRlRGVjbGFyYXRpb24oZGVjb3JhdG9yLCBjb21wb25lbnQsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICAgIHRlbXBsYXRlID0gdGhpcy5leHRyYWN0VGVtcGxhdGUobm9kZSwgdGVtcGxhdGVEZWNsKTtcbiAgICB9XG4gICAgY29uc3QgdGVtcGxhdGVSZXNvdXJjZSA9XG4gICAgICAgIHRlbXBsYXRlLmRlY2xhcmF0aW9uLmlzSW5saW5lID8ge3BhdGg6IG51bGwsIGV4cHJlc3Npb246IGNvbXBvbmVudC5nZXQoJ3RlbXBsYXRlJykhfSA6IHtcbiAgICAgICAgICBwYXRoOiBhYnNvbHV0ZUZyb20odGVtcGxhdGUuZGVjbGFyYXRpb24ucmVzb2x2ZWRUZW1wbGF0ZVVybCksXG4gICAgICAgICAgZXhwcmVzc2lvbjogdGVtcGxhdGUuc291cmNlTWFwcGluZy5ub2RlXG4gICAgICAgIH07XG5cbiAgICAvLyBGaWd1cmUgb3V0IHRoZSBzZXQgb2Ygc3R5bGVzLiBUaGUgb3JkZXJpbmcgaGVyZSBpcyBpbXBvcnRhbnQ6IGV4dGVybmFsIHJlc291cmNlcyAoc3R5bGVVcmxzKVxuICAgIC8vIHByZWNlZGUgaW5saW5lIHN0eWxlcywgYW5kIHN0eWxlcyBkZWZpbmVkIGluIHRoZSB0ZW1wbGF0ZSBvdmVycmlkZSBzdHlsZXMgZGVmaW5lZCBpbiB0aGVcbiAgICAvLyBjb21wb25lbnQuXG4gICAgbGV0IHN0eWxlczogc3RyaW5nW10gPSBbXTtcblxuICAgIGNvbnN0IHN0eWxlUmVzb3VyY2VzID0gdGhpcy5fZXh0cmFjdFN0eWxlUmVzb3VyY2VzKGNvbXBvbmVudCwgY29udGFpbmluZ0ZpbGUpO1xuICAgIGNvbnN0IHN0eWxlVXJsczogU3R5bGVVcmxNZXRhW10gPSBbXG4gICAgICAuLi50aGlzLl9leHRyYWN0Q29tcG9uZW50U3R5bGVVcmxzKGNvbXBvbmVudCksIC4uLnRoaXMuX2V4dHJhY3RUZW1wbGF0ZVN0eWxlVXJscyh0ZW1wbGF0ZSlcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBzdHlsZVVybCBvZiBzdHlsZVVybHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc291cmNlVXJsID0gdGhpcy5yZXNvdXJjZUxvYWRlci5yZXNvbHZlKHN0eWxlVXJsLnVybCwgY29udGFpbmluZ0ZpbGUpO1xuICAgICAgICBjb25zdCByZXNvdXJjZVN0ciA9IHRoaXMucmVzb3VyY2VMb2FkZXIubG9hZChyZXNvdXJjZVVybCk7XG4gICAgICAgIHN0eWxlcy5wdXNoKHJlc291cmNlU3RyKTtcbiAgICAgICAgaWYgKHRoaXMuZGVwVHJhY2tlciAhPT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuZGVwVHJhY2tlci5hZGRSZXNvdXJjZURlcGVuZGVuY3kobm9kZS5nZXRTb3VyY2VGaWxlKCksIGFic29sdXRlRnJvbShyZXNvdXJjZVVybCkpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgaWYgKGRpYWdub3N0aWNzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkaWFnbm9zdGljcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc291cmNlVHlwZSA9XG4gICAgICAgICAgICBzdHlsZVVybC5zb3VyY2UgPT09IFJlc291cmNlVHlwZUZvckRpYWdub3N0aWNzLlN0eWxlc2hlZXRGcm9tRGVjb3JhdG9yID9cbiAgICAgICAgICAgIFJlc291cmNlVHlwZUZvckRpYWdub3N0aWNzLlN0eWxlc2hlZXRGcm9tRGVjb3JhdG9yIDpcbiAgICAgICAgICAgIFJlc291cmNlVHlwZUZvckRpYWdub3N0aWNzLlN0eWxlc2hlZXRGcm9tVGVtcGxhdGU7XG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goXG4gICAgICAgICAgICB0aGlzLm1ha2VSZXNvdXJjZU5vdEZvdW5kRXJyb3Ioc3R5bGVVcmwudXJsLCBzdHlsZVVybC5ub2RlRm9yRXJyb3IsIHJlc291cmNlVHlwZSlcbiAgICAgICAgICAgICAgICAudG9EaWFnbm9zdGljKCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbmNhcHN1bGF0aW9uID09PSBWaWV3RW5jYXBzdWxhdGlvbi5TaGFkb3dEb20gJiYgbWV0YWRhdGEuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yRXJyb3IgPSBjaGVja0N1c3RvbUVsZW1lbnRTZWxlY3RvckZvckVycm9ycyhtZXRhZGF0YS5zZWxlY3Rvcik7XG4gICAgICBpZiAoc2VsZWN0b3JFcnJvciAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoZGlhZ25vc3RpY3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpYWdub3N0aWNzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgZGlhZ25vc3RpY3MucHVzaChtYWtlRGlhZ25vc3RpYyhcbiAgICAgICAgICAgIEVycm9yQ29kZS5DT01QT05FTlRfSU5WQUxJRF9TSEFET1dfRE9NX1NFTEVDVE9SLCBjb21wb25lbnQuZ2V0KCdzZWxlY3RvcicpISxcbiAgICAgICAgICAgIHNlbGVjdG9yRXJyb3IpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBpbmxpbmUgc3R5bGVzIHdlcmUgcHJlcHJvY2Vzc2VkIHVzZSB0aG9zZVxuICAgIGxldCBpbmxpbmVTdHlsZXM6IHN0cmluZ1tdfG51bGwgPSBudWxsO1xuICAgIGlmICh0aGlzLnByZWFuYWx5emVTdHlsZXNDYWNoZS5oYXMobm9kZSkpIHtcbiAgICAgIGlubGluZVN0eWxlcyA9IHRoaXMucHJlYW5hbHl6ZVN0eWxlc0NhY2hlLmdldChub2RlKSE7XG4gICAgICB0aGlzLnByZWFuYWx5emVTdHlsZXNDYWNoZS5kZWxldGUobm9kZSk7XG4gICAgICBpZiAoaW5saW5lU3R5bGVzICE9PSBudWxsKSB7XG4gICAgICAgIHN0eWxlcy5wdXNoKC4uLmlubGluZVN0eWxlcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByZXByb2Nlc3NpbmcgaXMgb25seSBzdXBwb3J0ZWQgYXN5bmNocm9ub3VzbHlcbiAgICAgIC8vIElmIG5vIHN0eWxlIGNhY2hlIGVudHJ5IGlzIHByZXNlbnQgYXN5bmNocm9ub3VzIHByZWFuYWx5emUgd2FzIG5vdCBleGVjdXRlZC5cbiAgICAgIC8vIFRoaXMgcHJvdGVjdHMgYWdhaW5zdCBhY2NpZGVudGFsIGRpZmZlcmVuY2VzIGluIHJlc291cmNlIGNvbnRlbnRzIHdoZW4gcHJlYW5hbHlzaXNcbiAgICAgIC8vIGlzIG5vdCB1c2VkIHdpdGggYSBwcm92aWRlZCB0cmFuc2Zvcm1SZXNvdXJjZSBob29rIG9uIHRoZSBSZXNvdXJjZUhvc3QuXG4gICAgICBpZiAodGhpcy5yZXNvdXJjZUxvYWRlci5jYW5QcmVwcm9jZXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW5saW5lIHJlc291cmNlIHByb2Nlc3NpbmcgcmVxdWlyZXMgYXN5bmNocm9ub3VzIHByZWFuYWx5emUuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb21wb25lbnQuaGFzKCdzdHlsZXMnKSkge1xuICAgICAgICBjb25zdCBsaXRTdHlsZXMgPSBwYXJzZUZpZWxkQXJyYXlWYWx1ZShjb21wb25lbnQsICdzdHlsZXMnLCB0aGlzLmV2YWx1YXRvcik7XG4gICAgICAgIGlmIChsaXRTdHlsZXMgIT09IG51bGwpIHtcbiAgICAgICAgICBpbmxpbmVTdHlsZXMgPSBbLi4ubGl0U3R5bGVzXTtcbiAgICAgICAgICBzdHlsZXMucHVzaCguLi5saXRTdHlsZXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZW1wbGF0ZS5zdHlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgc3R5bGVzLnB1c2goLi4udGVtcGxhdGUuc3R5bGVzKTtcbiAgICB9XG5cbiAgICBjb25zdCBvdXRwdXQ6IEFuYWx5c2lzT3V0cHV0PENvbXBvbmVudEFuYWx5c2lzRGF0YT4gPSB7XG4gICAgICBhbmFseXNpczoge1xuICAgICAgICBiYXNlQ2xhc3M6IHJlYWRCYXNlQ2xhc3Mobm9kZSwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuZXZhbHVhdG9yKSxcbiAgICAgICAgaW5wdXRzLFxuICAgICAgICBvdXRwdXRzLFxuICAgICAgICBtZXRhOiB7XG4gICAgICAgICAgLi4ubWV0YWRhdGEsXG4gICAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICAgIG5vZGVzOiB0ZW1wbGF0ZS5ub2RlcyxcbiAgICAgICAgICAgIG5nQ29udGVudFNlbGVjdG9yczogdGVtcGxhdGUubmdDb250ZW50U2VsZWN0b3JzLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZW5jYXBzdWxhdGlvbixcbiAgICAgICAgICBpbnRlcnBvbGF0aW9uOiB0ZW1wbGF0ZS5pbnRlcnBvbGF0aW9uQ29uZmlnID8/IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgICAgICAgc3R5bGVzLFxuXG4gICAgICAgICAgLy8gVGhlc2Ugd2lsbCBiZSByZXBsYWNlZCBkdXJpbmcgdGhlIGNvbXBpbGF0aW9uIHN0ZXAsIGFmdGVyIGFsbCBgTmdNb2R1bGVgcyBoYXZlIGJlZW5cbiAgICAgICAgICAvLyBhbmFseXplZCBhbmQgdGhlIGZ1bGwgY29tcGlsYXRpb24gc2NvcGUgZm9yIHRoZSBjb21wb25lbnQgY2FuIGJlIHJlYWxpemVkLlxuICAgICAgICAgIGFuaW1hdGlvbnMsXG4gICAgICAgICAgdmlld1Byb3ZpZGVyczogd3JhcHBlZFZpZXdQcm92aWRlcnMsXG4gICAgICAgICAgaTE4blVzZUV4dGVybmFsSWRzOiB0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcyxcbiAgICAgICAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCxcbiAgICAgICAgfSxcbiAgICAgICAgdHlwZUNoZWNrTWV0YTogZXh0cmFjdERpcmVjdGl2ZVR5cGVDaGVja01ldGEobm9kZSwgaW5wdXRzLCB0aGlzLnJlZmxlY3RvciksXG4gICAgICAgIGNsYXNzTWV0YWRhdGE6IGV4dHJhY3RDbGFzc01ldGFkYXRhKFxuICAgICAgICAgICAgbm9kZSwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuaXNDb3JlLCB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSxcbiAgICAgICAgdGVtcGxhdGUsXG4gICAgICAgIHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnksXG4gICAgICAgIHZpZXdQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LFxuICAgICAgICBpbmxpbmVTdHlsZXMsXG4gICAgICAgIHN0eWxlVXJscyxcbiAgICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgICAgc3R5bGVzOiBzdHlsZVJlc291cmNlcyxcbiAgICAgICAgICB0ZW1wbGF0ZTogdGVtcGxhdGVSZXNvdXJjZSxcbiAgICAgICAgfSxcbiAgICAgICAgaXNQb2lzb25lZCxcbiAgICAgIH0sXG4gICAgICBkaWFnbm9zdGljcyxcbiAgICB9O1xuICAgIGlmIChjaGFuZ2VEZXRlY3Rpb24gIT09IG51bGwpIHtcbiAgICAgIG91dHB1dC5hbmFseXNpcyEubWV0YS5jaGFuZ2VEZXRlY3Rpb24gPSBjaGFuZ2VEZXRlY3Rpb247XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cblxuICBzeW1ib2wobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IFJlYWRvbmx5PENvbXBvbmVudEFuYWx5c2lzRGF0YT4pOiBDb21wb25lbnRTeW1ib2wge1xuICAgIGNvbnN0IHR5cGVQYXJhbWV0ZXJzID0gZXh0cmFjdFNlbWFudGljVHlwZVBhcmFtZXRlcnMobm9kZSk7XG5cbiAgICByZXR1cm4gbmV3IENvbXBvbmVudFN5bWJvbChcbiAgICAgICAgbm9kZSwgYW5hbHlzaXMubWV0YS5zZWxlY3RvciwgYW5hbHlzaXMuaW5wdXRzLCBhbmFseXNpcy5vdXRwdXRzLCBhbmFseXNpcy5tZXRhLmV4cG9ydEFzLFxuICAgICAgICBhbmFseXNpcy50eXBlQ2hlY2tNZXRhLCB0eXBlUGFyYW1ldGVycyk7XG4gIH1cblxuICByZWdpc3Rlcihub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogQ29tcG9uZW50QW5hbHlzaXNEYXRhKTogdm9pZCB7XG4gICAgLy8gUmVnaXN0ZXIgdGhpcyBjb21wb25lbnQncyBpbmZvcm1hdGlvbiB3aXRoIHRoZSBgTWV0YWRhdGFSZWdpc3RyeWAuIFRoaXMgZW5zdXJlcyB0aGF0XG4gICAgLy8gdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjb21wb25lbnQgaXMgYXZhaWxhYmxlIGR1cmluZyB0aGUgY29tcGlsZSgpIHBoYXNlLlxuICAgIGNvbnN0IHJlZiA9IG5ldyBSZWZlcmVuY2Uobm9kZSk7XG4gICAgdGhpcy5tZXRhUmVnaXN0cnkucmVnaXN0ZXJEaXJlY3RpdmVNZXRhZGF0YSh7XG4gICAgICB0eXBlOiBNZXRhVHlwZS5EaXJlY3RpdmUsXG4gICAgICByZWYsXG4gICAgICBuYW1lOiBub2RlLm5hbWUudGV4dCxcbiAgICAgIHNlbGVjdG9yOiBhbmFseXNpcy5tZXRhLnNlbGVjdG9yLFxuICAgICAgZXhwb3J0QXM6IGFuYWx5c2lzLm1ldGEuZXhwb3J0QXMsXG4gICAgICBpbnB1dHM6IGFuYWx5c2lzLmlucHV0cyxcbiAgICAgIG91dHB1dHM6IGFuYWx5c2lzLm91dHB1dHMsXG4gICAgICBxdWVyaWVzOiBhbmFseXNpcy5tZXRhLnF1ZXJpZXMubWFwKHF1ZXJ5ID0+IHF1ZXJ5LnByb3BlcnR5TmFtZSksXG4gICAgICBpc0NvbXBvbmVudDogdHJ1ZSxcbiAgICAgIGJhc2VDbGFzczogYW5hbHlzaXMuYmFzZUNsYXNzLFxuICAgICAgLi4uYW5hbHlzaXMudHlwZUNoZWNrTWV0YSxcbiAgICAgIGlzUG9pc29uZWQ6IGFuYWx5c2lzLmlzUG9pc29uZWQsXG4gICAgICBpc1N0cnVjdHVyYWw6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5yZXNvdXJjZVJlZ2lzdHJ5LnJlZ2lzdGVyUmVzb3VyY2VzKGFuYWx5c2lzLnJlc291cmNlcywgbm9kZSk7XG4gICAgdGhpcy5pbmplY3RhYmxlUmVnaXN0cnkucmVnaXN0ZXJJbmplY3RhYmxlKG5vZGUpO1xuICB9XG5cbiAgaW5kZXgoXG4gICAgICBjb250ZXh0OiBJbmRleGluZ0NvbnRleHQsIG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBSZWFkb25seTxDb21wb25lbnRBbmFseXNpc0RhdGE+KSB7XG4gICAgaWYgKGFuYWx5c2lzLmlzUG9pc29uZWQgJiYgIXRoaXMudXNlUG9pc29uZWREYXRhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc2NvcGUgPSB0aGlzLnNjb3BlUmVhZGVyLmdldFNjb3BlRm9yQ29tcG9uZW50KG5vZGUpO1xuICAgIGNvbnN0IHNlbGVjdG9yID0gYW5hbHlzaXMubWV0YS5zZWxlY3RvcjtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVNZXRhPigpO1xuICAgIGlmIChzY29wZSAhPT0gbnVsbCkge1xuICAgICAgaWYgKChzY29wZS5jb21waWxhdGlvbi5pc1BvaXNvbmVkIHx8IHNjb3BlLmV4cG9ydGVkLmlzUG9pc29uZWQpICYmICF0aGlzLnVzZVBvaXNvbmVkRGF0YSkge1xuICAgICAgICAvLyBEb24ndCBib3RoZXIgaW5kZXhpbmcgY29tcG9uZW50cyB3aGljaCBoYWQgZXJyb25lb3VzIHNjb3BlcywgdW5sZXNzIHNwZWNpZmljYWxseVxuICAgICAgICAvLyByZXF1ZXN0ZWQuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGRpcmVjdGl2ZSBvZiBzY29wZS5jb21waWxhdGlvbi5kaXJlY3RpdmVzKSB7XG4gICAgICAgIGlmIChkaXJlY3RpdmUuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICAgICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKGRpcmVjdGl2ZS5zZWxlY3RvciksIGRpcmVjdGl2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgYmluZGVyID0gbmV3IFIzVGFyZ2V0QmluZGVyKG1hdGNoZXIpO1xuICAgIGNvbnN0IGJvdW5kVGVtcGxhdGUgPSBiaW5kZXIuYmluZCh7dGVtcGxhdGU6IGFuYWx5c2lzLnRlbXBsYXRlLmRpYWdOb2Rlc30pO1xuXG4gICAgY29udGV4dC5hZGRDb21wb25lbnQoe1xuICAgICAgZGVjbGFyYXRpb246IG5vZGUsXG4gICAgICBzZWxlY3RvcixcbiAgICAgIGJvdW5kVGVtcGxhdGUsXG4gICAgICB0ZW1wbGF0ZU1ldGE6IHtcbiAgICAgICAgaXNJbmxpbmU6IGFuYWx5c2lzLnRlbXBsYXRlLmRlY2xhcmF0aW9uLmlzSW5saW5lLFxuICAgICAgICBmaWxlOiBhbmFseXNpcy50ZW1wbGF0ZS5maWxlLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHR5cGVDaGVjayhjdHg6IFR5cGVDaGVja0NvbnRleHQsIG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIG1ldGE6IFJlYWRvbmx5PENvbXBvbmVudEFuYWx5c2lzRGF0YT4pOlxuICAgICAgdm9pZCB7XG4gICAgaWYgKHRoaXMudHlwZUNoZWNrU2NvcGVSZWdpc3RyeSA9PT0gbnVsbCB8fCAhdHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG1ldGEuaXNQb2lzb25lZCAmJiAhdGhpcy51c2VQb2lzb25lZERhdGEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc2NvcGUgPSB0aGlzLnR5cGVDaGVja1Njb3BlUmVnaXN0cnkuZ2V0VHlwZUNoZWNrU2NvcGUobm9kZSk7XG4gICAgaWYgKHNjb3BlLmlzUG9pc29uZWQgJiYgIXRoaXMudXNlUG9pc29uZWREYXRhKSB7XG4gICAgICAvLyBEb24ndCB0eXBlLWNoZWNrIGNvbXBvbmVudHMgdGhhdCBoYWQgZXJyb3JzIGluIHRoZWlyIHNjb3BlcywgdW5sZXNzIHJlcXVlc3RlZC5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgUjNUYXJnZXRCaW5kZXIoc2NvcGUubWF0Y2hlcik7XG4gICAgY3R4LmFkZFRlbXBsYXRlKFxuICAgICAgICBuZXcgUmVmZXJlbmNlKG5vZGUpLCBiaW5kZXIsIG1ldGEudGVtcGxhdGUuZGlhZ05vZGVzLCBzY29wZS5waXBlcywgc2NvcGUuc2NoZW1hcyxcbiAgICAgICAgbWV0YS50ZW1wbGF0ZS5zb3VyY2VNYXBwaW5nLCBtZXRhLnRlbXBsYXRlLmZpbGUsIG1ldGEudGVtcGxhdGUuZXJyb3JzKTtcbiAgfVxuXG4gIHJlc29sdmUoXG4gICAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogUmVhZG9ubHk8Q29tcG9uZW50QW5hbHlzaXNEYXRhPixcbiAgICAgIHN5bWJvbDogQ29tcG9uZW50U3ltYm9sKTogUmVzb2x2ZVJlc3VsdDxDb21wb25lbnRSZXNvbHV0aW9uRGF0YT4ge1xuICAgIGlmICh0aGlzLnNlbWFudGljRGVwR3JhcGhVcGRhdGVyICE9PSBudWxsICYmIGFuYWx5c2lzLmJhc2VDbGFzcyBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgICAgc3ltYm9sLmJhc2VDbGFzcyA9IHRoaXMuc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIuZ2V0U3ltYm9sKGFuYWx5c2lzLmJhc2VDbGFzcy5ub2RlKTtcbiAgICB9XG5cbiAgICBpZiAoYW5hbHlzaXMuaXNQb2lzb25lZCAmJiAhdGhpcy51c2VQb2lzb25lZERhdGEpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0ID0gbm9kZS5nZXRTb3VyY2VGaWxlKCk7XG4gICAgLy8gQ2hlY2sgd2hldGhlciB0aGlzIGNvbXBvbmVudCB3YXMgcmVnaXN0ZXJlZCB3aXRoIGFuIE5nTW9kdWxlLiBJZiBzbywgaXQgc2hvdWxkIGJlIGNvbXBpbGVkXG4gICAgLy8gdW5kZXIgdGhhdCBtb2R1bGUncyBjb21waWxhdGlvbiBzY29wZS5cbiAgICBjb25zdCBzY29wZSA9IHRoaXMuc2NvcGVSZWFkZXIuZ2V0U2NvcGVGb3JDb21wb25lbnQobm9kZSk7XG4gICAgbGV0IG1ldGFkYXRhID0gYW5hbHlzaXMubWV0YSBhcyBSZWFkb25seTxSM0NvbXBvbmVudE1ldGFkYXRhPjtcblxuICAgIGNvbnN0IGRhdGE6IENvbXBvbmVudFJlc29sdXRpb25EYXRhID0ge1xuICAgICAgZGlyZWN0aXZlczogRU1QVFlfQVJSQVksXG4gICAgICBwaXBlczogRU1QVFlfTUFQLFxuICAgICAgZGVjbGFyYXRpb25MaXN0RW1pdE1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCxcbiAgICB9O1xuXG4gICAgaWYgKHNjb3BlICE9PSBudWxsICYmICghc2NvcGUuY29tcGlsYXRpb24uaXNQb2lzb25lZCB8fCB0aGlzLnVzZVBvaXNvbmVkRGF0YSkpIHtcbiAgICAgIC8vIFJlcGxhY2UgdGhlIGVtcHR5IGNvbXBvbmVudHMgYW5kIGRpcmVjdGl2ZXMgZnJvbSB0aGUgYW5hbHl6ZSgpIHN0ZXAgd2l0aCBhIGZ1bGx5IGV4cGFuZGVkXG4gICAgICAvLyBzY29wZS4gVGhpcyBpcyBwb3NzaWJsZSBub3cgYmVjYXVzZSBkdXJpbmcgcmVzb2x2ZSgpIHRoZSB3aG9sZSBjb21waWxhdGlvbiB1bml0IGhhcyBiZWVuXG4gICAgICAvLyBmdWxseSBhbmFseXplZC5cbiAgICAgIC8vXG4gICAgICAvLyBGaXJzdCBpdCBuZWVkcyB0byBiZSBkZXRlcm1pbmVkIGlmIGFjdHVhbGx5IGltcG9ydGluZyB0aGUgZGlyZWN0aXZlcy9waXBlcyB1c2VkIGluIHRoZVxuICAgICAgLy8gdGVtcGxhdGUgd291bGQgY3JlYXRlIGEgY3ljbGUuIEN1cnJlbnRseSBuZ3RzYyByZWZ1c2VzIHRvIGdlbmVyYXRlIGN5Y2xlcywgc28gYW4gb3B0aW9uXG4gICAgICAvLyBrbm93biBhcyBcInJlbW90ZSBzY29waW5nXCIgaXMgdXNlZCBpZiBhIGN5Y2xlIHdvdWxkIGJlIGNyZWF0ZWQuIEluIHJlbW90ZSBzY29waW5nLCB0aGVcbiAgICAgIC8vIG1vZHVsZSBmaWxlIHNldHMgdGhlIGRpcmVjdGl2ZXMvcGlwZXMgb24gdGhlIMm1Y21wIG9mIHRoZSBjb21wb25lbnQsIHdpdGhvdXRcbiAgICAgIC8vIHJlcXVpcmluZyBuZXcgaW1wb3J0cyAoYnV0IGFsc28gaW4gYSB3YXkgdGhhdCBicmVha3MgdHJlZSBzaGFraW5nKS5cbiAgICAgIC8vXG4gICAgICAvLyBEZXRlcm1pbmluZyB0aGlzIGlzIGNoYWxsZW5naW5nLCBiZWNhdXNlIHRoZSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGlzIHJlc3BvbnNpYmxlIGZvclxuICAgICAgLy8gbWF0Y2hpbmcgZGlyZWN0aXZlcyBhbmQgcGlwZXMgaW4gdGhlIHRlbXBsYXRlOyBob3dldmVyLCB0aGF0IGRvZXNuJ3QgcnVuIHVudGlsIHRoZSBhY3R1YWxcbiAgICAgIC8vIGNvbXBpbGUoKSBzdGVwLiBJdCdzIG5vdCBwb3NzaWJsZSB0byBydW4gdGVtcGxhdGUgY29tcGlsYXRpb24gc29vbmVyIGFzIGl0IHJlcXVpcmVzIHRoZVxuICAgICAgLy8gQ29uc3RhbnRQb29sIGZvciB0aGUgb3ZlcmFsbCBmaWxlIGJlaW5nIGNvbXBpbGVkICh3aGljaCBpc24ndCBhdmFpbGFibGUgdW50aWwgdGhlXG4gICAgICAvLyB0cmFuc2Zvcm0gc3RlcCkuXG4gICAgICAvL1xuICAgICAgLy8gSW5zdGVhZCwgZGlyZWN0aXZlcy9waXBlcyBhcmUgbWF0Y2hlZCBpbmRlcGVuZGVudGx5IGhlcmUsIHVzaW5nIHRoZSBSM1RhcmdldEJpbmRlci4gVGhpc1xuICAgICAgLy8gaXMgYW4gYWx0ZXJuYXRpdmUgaW1wbGVtZW50YXRpb24gb2YgdGVtcGxhdGUgbWF0Y2hpbmcgd2hpY2ggaXMgdXNlZCBmb3IgdGVtcGxhdGVcbiAgICAgIC8vIHR5cGUtY2hlY2tpbmcgYW5kIHdpbGwgZXZlbnR1YWxseSByZXBsYWNlIG1hdGNoaW5nIGluIHRoZSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLlxuXG5cbiAgICAgIC8vIFNldCB1cCB0aGUgUjNUYXJnZXRCaW5kZXIsIGFzIHdlbGwgYXMgYSAnZGlyZWN0aXZlcycgYXJyYXkgYW5kIGEgJ3BpcGVzJyBtYXAgdGhhdCBhcmVcbiAgICAgIC8vIGxhdGVyIGZlZCB0byB0aGUgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci4gRmlyc3QsIGEgU2VsZWN0b3JNYXRjaGVyIGlzIGNvbnN0cnVjdGVkIHRvXG4gICAgICAvLyBtYXRjaCBkaXJlY3RpdmVzIHRoYXQgYXJlIGluIHNjb3BlLlxuICAgICAgdHlwZSBNYXRjaGVkRGlyZWN0aXZlID0gRGlyZWN0aXZlTWV0YSZ7c2VsZWN0b3I6IHN0cmluZ307XG4gICAgICBjb25zdCBtYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcjxNYXRjaGVkRGlyZWN0aXZlPigpO1xuXG4gICAgICBmb3IgKGNvbnN0IGRpciBvZiBzY29wZS5jb21waWxhdGlvbi5kaXJlY3RpdmVzKSB7XG4gICAgICAgIGlmIChkaXIuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICAgICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKGRpci5zZWxlY3RvciksIGRpciBhcyBNYXRjaGVkRGlyZWN0aXZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgcGlwZXMgPSBuZXcgTWFwPHN0cmluZywgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+PigpO1xuICAgICAgZm9yIChjb25zdCBwaXBlIG9mIHNjb3BlLmNvbXBpbGF0aW9uLnBpcGVzKSB7XG4gICAgICAgIHBpcGVzLnNldChwaXBlLm5hbWUsIHBpcGUucmVmKTtcbiAgICAgIH1cblxuICAgICAgLy8gTmV4dCwgdGhlIGNvbXBvbmVudCB0ZW1wbGF0ZSBBU1QgaXMgYm91bmQgdXNpbmcgdGhlIFIzVGFyZ2V0QmluZGVyLiBUaGlzIHByb2R1Y2VzIGFcbiAgICAgIC8vIEJvdW5kVGFyZ2V0LCB3aGljaCBpcyBzaW1pbGFyIHRvIGEgdHMuVHlwZUNoZWNrZXIuXG4gICAgICBjb25zdCBiaW5kZXIgPSBuZXcgUjNUYXJnZXRCaW5kZXIobWF0Y2hlcik7XG4gICAgICBjb25zdCBib3VuZCA9IGJpbmRlci5iaW5kKHt0ZW1wbGF0ZTogbWV0YWRhdGEudGVtcGxhdGUubm9kZXN9KTtcblxuICAgICAgLy8gVGhlIEJvdW5kVGFyZ2V0IGtub3dzIHdoaWNoIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIG1hdGNoZWQgdGhlIHRlbXBsYXRlLlxuICAgICAgdHlwZSBVc2VkRGlyZWN0aXZlID1cbiAgICAgICAgICBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YSZ7cmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4sIGltcG9ydGVkRmlsZTogSW1wb3J0ZWRGaWxlfTtcbiAgICAgIGNvbnN0IHVzZWREaXJlY3RpdmVzOiBVc2VkRGlyZWN0aXZlW10gPSBib3VuZC5nZXRVc2VkRGlyZWN0aXZlcygpLm1hcChkaXJlY3RpdmUgPT4ge1xuICAgICAgICBjb25zdCB0eXBlID0gdGhpcy5yZWZFbWl0dGVyLmVtaXQoZGlyZWN0aXZlLnJlZiwgY29udGV4dCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVmOiBkaXJlY3RpdmUucmVmLFxuICAgICAgICAgIHR5cGU6IHR5cGUuZXhwcmVzc2lvbixcbiAgICAgICAgICBpbXBvcnRlZEZpbGU6IHR5cGUuaW1wb3J0ZWRGaWxlLFxuICAgICAgICAgIHNlbGVjdG9yOiBkaXJlY3RpdmUuc2VsZWN0b3IsXG4gICAgICAgICAgaW5wdXRzOiBkaXJlY3RpdmUuaW5wdXRzLnByb3BlcnR5TmFtZXMsXG4gICAgICAgICAgb3V0cHV0czogZGlyZWN0aXZlLm91dHB1dHMucHJvcGVydHlOYW1lcyxcbiAgICAgICAgICBleHBvcnRBczogZGlyZWN0aXZlLmV4cG9ydEFzLFxuICAgICAgICAgIGlzQ29tcG9uZW50OiBkaXJlY3RpdmUuaXNDb21wb25lbnQsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgdHlwZSBVc2VkUGlwZSA9IHtcbiAgICAgICAgcmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4sXG4gICAgICAgIHBpcGVOYW1lOiBzdHJpbmcsXG4gICAgICAgIGV4cHJlc3Npb246IEV4cHJlc3Npb24sXG4gICAgICAgIGltcG9ydGVkRmlsZTogSW1wb3J0ZWRGaWxlLFxuICAgICAgfTtcbiAgICAgIGNvbnN0IHVzZWRQaXBlczogVXNlZFBpcGVbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBwaXBlTmFtZSBvZiBib3VuZC5nZXRVc2VkUGlwZXMoKSkge1xuICAgICAgICBpZiAoIXBpcGVzLmhhcyhwaXBlTmFtZSkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwaXBlID0gcGlwZXMuZ2V0KHBpcGVOYW1lKSE7XG4gICAgICAgIGNvbnN0IHR5cGUgPSB0aGlzLnJlZkVtaXR0ZXIuZW1pdChwaXBlLCBjb250ZXh0KTtcbiAgICAgICAgdXNlZFBpcGVzLnB1c2goe1xuICAgICAgICAgIHJlZjogcGlwZSxcbiAgICAgICAgICBwaXBlTmFtZSxcbiAgICAgICAgICBleHByZXNzaW9uOiB0eXBlLmV4cHJlc3Npb24sXG4gICAgICAgICAgaW1wb3J0ZWRGaWxlOiB0eXBlLmltcG9ydGVkRmlsZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5zZW1hbnRpY0RlcEdyYXBoVXBkYXRlciAhPT0gbnVsbCkge1xuICAgICAgICBzeW1ib2wudXNlZERpcmVjdGl2ZXMgPSB1c2VkRGlyZWN0aXZlcy5tYXAoXG4gICAgICAgICAgICBkaXIgPT4gdGhpcy5zZW1hbnRpY0RlcEdyYXBoVXBkYXRlciEuZ2V0U2VtYW50aWNSZWZlcmVuY2UoZGlyLnJlZi5ub2RlLCBkaXIudHlwZSkpO1xuICAgICAgICBzeW1ib2wudXNlZFBpcGVzID0gdXNlZFBpcGVzLm1hcChcbiAgICAgICAgICAgIHBpcGUgPT5cbiAgICAgICAgICAgICAgICB0aGlzLnNlbWFudGljRGVwR3JhcGhVcGRhdGVyIS5nZXRTZW1hbnRpY1JlZmVyZW5jZShwaXBlLnJlZi5ub2RlLCBwaXBlLmV4cHJlc3Npb24pKTtcbiAgICAgIH1cblxuICAgICAgLy8gU2NhbiB0aHJvdWdoIHRoZSBkaXJlY3RpdmVzL3BpcGVzIGFjdHVhbGx5IHVzZWQgaW4gdGhlIHRlbXBsYXRlIGFuZCBjaGVjayB3aGV0aGVyIGFueVxuICAgICAgLy8gaW1wb3J0IHdoaWNoIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCB3b3VsZCBjcmVhdGUgYSBjeWNsZS5cbiAgICAgIGNvbnN0IGN5Y2xlc0Zyb21EaXJlY3RpdmVzID0gbmV3IE1hcDxVc2VkRGlyZWN0aXZlLCBDeWNsZT4oKTtcbiAgICAgIGZvciAoY29uc3QgdXNlZERpcmVjdGl2ZSBvZiB1c2VkRGlyZWN0aXZlcykge1xuICAgICAgICBjb25zdCBjeWNsZSA9XG4gICAgICAgICAgICB0aGlzLl9jaGVja0ZvckN5Y2xpY0ltcG9ydCh1c2VkRGlyZWN0aXZlLmltcG9ydGVkRmlsZSwgdXNlZERpcmVjdGl2ZS50eXBlLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKGN5Y2xlICE9PSBudWxsKSB7XG4gICAgICAgICAgY3ljbGVzRnJvbURpcmVjdGl2ZXMuc2V0KHVzZWREaXJlY3RpdmUsIGN5Y2xlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgY3ljbGVzRnJvbVBpcGVzID0gbmV3IE1hcDxVc2VkUGlwZSwgQ3ljbGU+KCk7XG4gICAgICBmb3IgKGNvbnN0IHVzZWRQaXBlIG9mIHVzZWRQaXBlcykge1xuICAgICAgICBjb25zdCBjeWNsZSA9XG4gICAgICAgICAgICB0aGlzLl9jaGVja0ZvckN5Y2xpY0ltcG9ydCh1c2VkUGlwZS5pbXBvcnRlZEZpbGUsIHVzZWRQaXBlLmV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgICAgICBpZiAoY3ljbGUgIT09IG51bGwpIHtcbiAgICAgICAgICBjeWNsZXNGcm9tUGlwZXMuc2V0KHVzZWRQaXBlLCBjeWNsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgY3ljbGVEZXRlY3RlZCA9IGN5Y2xlc0Zyb21EaXJlY3RpdmVzLnNpemUgIT09IDAgfHwgY3ljbGVzRnJvbVBpcGVzLnNpemUgIT09IDA7XG4gICAgICBpZiAoIWN5Y2xlRGV0ZWN0ZWQpIHtcbiAgICAgICAgLy8gTm8gY3ljbGUgd2FzIGRldGVjdGVkLiBSZWNvcmQgdGhlIGltcG9ydHMgdGhhdCBuZWVkIHRvIGJlIGNyZWF0ZWQgaW4gdGhlIGN5Y2xlIGRldGVjdG9yXG4gICAgICAgIC8vIHNvIHRoYXQgZnV0dXJlIGN5Y2xpYyBpbXBvcnQgY2hlY2tzIGNvbnNpZGVyIHRoZWlyIHByb2R1Y3Rpb24uXG4gICAgICAgIGZvciAoY29uc3Qge3R5cGUsIGltcG9ydGVkRmlsZX0gb2YgdXNlZERpcmVjdGl2ZXMpIHtcbiAgICAgICAgICB0aGlzLl9yZWNvcmRTeW50aGV0aWNJbXBvcnQoaW1wb3J0ZWRGaWxlLCB0eXBlLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHtleHByZXNzaW9uLCBpbXBvcnRlZEZpbGV9IG9mIHVzZWRQaXBlcykge1xuICAgICAgICAgIHRoaXMuX3JlY29yZFN5bnRoZXRpY0ltcG9ydChpbXBvcnRlZEZpbGUsIGV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgZGlyZWN0aXZlL3BpcGUgYXJyYXlzIGluIMm1Y21wIG5lZWQgdG8gYmUgd3JhcHBlZCBpbiBjbG9zdXJlcy5cbiAgICAgICAgLy8gVGhpcyBpcyByZXF1aXJlZCBpZiBhbnkgZGlyZWN0aXZlL3BpcGUgcmVmZXJlbmNlIGlzIHRvIGEgZGVjbGFyYXRpb24gaW4gdGhlIHNhbWUgZmlsZVxuICAgICAgICAvLyBidXQgZGVjbGFyZWQgYWZ0ZXIgdGhpcyBjb21wb25lbnQuXG4gICAgICAgIGNvbnN0IHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUgPVxuICAgICAgICAgICAgdXNlZERpcmVjdGl2ZXMuc29tZShcbiAgICAgICAgICAgICAgICBkaXIgPT4gaXNFeHByZXNzaW9uRm9yd2FyZFJlZmVyZW5jZShkaXIudHlwZSwgbm9kZS5uYW1lLCBjb250ZXh0KSkgfHxcbiAgICAgICAgICAgIHVzZWRQaXBlcy5zb21lKFxuICAgICAgICAgICAgICAgIHBpcGUgPT4gaXNFeHByZXNzaW9uRm9yd2FyZFJlZmVyZW5jZShwaXBlLmV4cHJlc3Npb24sIG5vZGUubmFtZSwgY29udGV4dCkpO1xuXG4gICAgICAgIGRhdGEuZGlyZWN0aXZlcyA9IHVzZWREaXJlY3RpdmVzO1xuICAgICAgICBkYXRhLnBpcGVzID0gbmV3IE1hcCh1c2VkUGlwZXMubWFwKHBpcGUgPT4gW3BpcGUucGlwZU5hbWUsIHBpcGUuZXhwcmVzc2lvbl0pKTtcbiAgICAgICAgZGF0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSA9IHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUgP1xuICAgICAgICAgICAgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZSA6XG4gICAgICAgICAgICBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3Q7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5jeWNsZUhhbmRsaW5nU3RyYXRlZ3kgPT09IEN5Y2xlSGFuZGxpbmdTdHJhdGVneS5Vc2VSZW1vdGVTY29waW5nKSB7XG4gICAgICAgICAgLy8gRGVjbGFyaW5nIHRoZSBkaXJlY3RpdmVEZWZzL3BpcGVEZWZzIGFycmF5cyBkaXJlY3RseSB3b3VsZCByZXF1aXJlIGltcG9ydHMgdGhhdCB3b3VsZFxuICAgICAgICAgIC8vIGNyZWF0ZSBhIGN5Y2xlLiBJbnN0ZWFkLCBtYXJrIHRoaXMgY29tcG9uZW50IGFzIHJlcXVpcmluZyByZW1vdGUgc2NvcGluZywgc28gdGhhdCB0aGVcbiAgICAgICAgICAvLyBOZ01vZHVsZSBmaWxlIHdpbGwgdGFrZSBjYXJlIG9mIHNldHRpbmcgdGhlIGRpcmVjdGl2ZXMgZm9yIHRoZSBjb21wb25lbnQuXG4gICAgICAgICAgdGhpcy5zY29wZVJlZ2lzdHJ5LnNldENvbXBvbmVudFJlbW90ZVNjb3BlKFxuICAgICAgICAgICAgICBub2RlLCB1c2VkRGlyZWN0aXZlcy5tYXAoZGlyID0+IGRpci5yZWYpLCB1c2VkUGlwZXMubWFwKHBpcGUgPT4gcGlwZS5yZWYpKTtcbiAgICAgICAgICBzeW1ib2wuaXNSZW1vdGVseVNjb3BlZCA9IHRydWU7XG5cbiAgICAgICAgICAvLyBJZiBhIHNlbWFudGljIGdyYXBoIGlzIGJlaW5nIHRyYWNrZWQsIHJlY29yZCB0aGUgZmFjdCB0aGF0IHRoaXMgY29tcG9uZW50IGlzIHJlbW90ZWx5XG4gICAgICAgICAgLy8gc2NvcGVkIHdpdGggdGhlIGRlY2xhcmluZyBOZ01vZHVsZSBzeW1ib2wgYXMgdGhlIE5nTW9kdWxlJ3MgZW1pdCBiZWNvbWVzIGRlcGVuZGVudCBvblxuICAgICAgICAgIC8vIHRoZSBkaXJlY3RpdmUvcGlwZSB1c2FnZXMgb2YgdGhpcyBjb21wb25lbnQuXG4gICAgICAgICAgaWYgKHRoaXMuc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG1vZHVsZVN5bWJvbCA9IHRoaXMuc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIuZ2V0U3ltYm9sKHNjb3BlLm5nTW9kdWxlKTtcbiAgICAgICAgICAgIGlmICghKG1vZHVsZVN5bWJvbCBpbnN0YW5jZW9mIE5nTW9kdWxlU3ltYm9sKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkICR7c2NvcGUubmdNb2R1bGUubmFtZX0gdG8gYmUgYW4gTmdNb2R1bGVTeW1ib2wuYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1vZHVsZVN5bWJvbC5hZGRSZW1vdGVseVNjb3BlZENvbXBvbmVudChcbiAgICAgICAgICAgICAgICBzeW1ib2wsIHN5bWJvbC51c2VkRGlyZWN0aXZlcywgc3ltYm9sLnVzZWRQaXBlcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFdlIGFyZSBub3QgYWJsZSB0byBoYW5kbGUgdGhpcyBjeWNsZSBzbyB0aHJvdyBhbiBlcnJvci5cbiAgICAgICAgICBjb25zdCByZWxhdGVkTWVzc2FnZXM6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXSA9IFtdO1xuICAgICAgICAgIGZvciAoY29uc3QgW2RpciwgY3ljbGVdIG9mIGN5Y2xlc0Zyb21EaXJlY3RpdmVzKSB7XG4gICAgICAgICAgICByZWxhdGVkTWVzc2FnZXMucHVzaChcbiAgICAgICAgICAgICAgICBtYWtlQ3ljbGljSW1wb3J0SW5mbyhkaXIucmVmLCBkaXIuaXNDb21wb25lbnQgPyAnY29tcG9uZW50JyA6ICdkaXJlY3RpdmUnLCBjeWNsZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGNvbnN0IFtwaXBlLCBjeWNsZV0gb2YgY3ljbGVzRnJvbVBpcGVzKSB7XG4gICAgICAgICAgICByZWxhdGVkTWVzc2FnZXMucHVzaChtYWtlQ3ljbGljSW1wb3J0SW5mbyhwaXBlLnJlZiwgJ3BpcGUnLCBjeWNsZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgICAgIEVycm9yQ29kZS5JTVBPUlRfQ1lDTEVfREVURUNURUQsIG5vZGUsXG4gICAgICAgICAgICAgICdPbmUgb3IgbW9yZSBpbXBvcnQgY3ljbGVzIHdvdWxkIG5lZWQgdG8gYmUgY3JlYXRlZCB0byBjb21waWxlIHRoaXMgY29tcG9uZW50LCAnICtcbiAgICAgICAgICAgICAgICAgICd3aGljaCBpcyBub3Qgc3VwcG9ydGVkIGJ5IHRoZSBjdXJyZW50IGNvbXBpbGVyIGNvbmZpZ3VyYXRpb24uJyxcbiAgICAgICAgICAgICAgcmVsYXRlZE1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAgIGlmIChhbmFseXNpcy5wcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5ICE9PSBudWxsICYmXG4gICAgICAgIGFuYWx5c2lzLm1ldGEucHJvdmlkZXJzIGluc3RhbmNlb2YgV3JhcHBlZE5vZGVFeHByKSB7XG4gICAgICBjb25zdCBwcm92aWRlckRpYWdub3N0aWNzID0gZ2V0UHJvdmlkZXJEaWFnbm9zdGljcyhcbiAgICAgICAgICBhbmFseXNpcy5wcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LCBhbmFseXNpcy5tZXRhLnByb3ZpZGVycyEubm9kZSxcbiAgICAgICAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeSk7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnByb3ZpZGVyRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGlmIChhbmFseXNpcy52aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSAhPT0gbnVsbCAmJlxuICAgICAgICBhbmFseXNpcy5tZXRhLnZpZXdQcm92aWRlcnMgaW5zdGFuY2VvZiBXcmFwcGVkTm9kZUV4cHIpIHtcbiAgICAgIGNvbnN0IHZpZXdQcm92aWRlckRpYWdub3N0aWNzID0gZ2V0UHJvdmlkZXJEaWFnbm9zdGljcyhcbiAgICAgICAgICBhbmFseXNpcy52aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSwgYW5hbHlzaXMubWV0YS52aWV3UHJvdmlkZXJzIS5ub2RlLFxuICAgICAgICAgIHRoaXMuaW5qZWN0YWJsZVJlZ2lzdHJ5KTtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udmlld1Byb3ZpZGVyRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGNvbnN0IGRpcmVjdGl2ZURpYWdub3N0aWNzID0gZ2V0RGlyZWN0aXZlRGlhZ25vc3RpY3MoXG4gICAgICAgIG5vZGUsIHRoaXMubWV0YVJlYWRlciwgdGhpcy5ldmFsdWF0b3IsIHRoaXMucmVmbGVjdG9yLCB0aGlzLnNjb3BlUmVnaXN0cnksICdDb21wb25lbnQnKTtcbiAgICBpZiAoZGlyZWN0aXZlRGlhZ25vc3RpY3MgIT09IG51bGwpIHtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4uZGlyZWN0aXZlRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGlmIChkaWFnbm9zdGljcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4ge2RpYWdub3N0aWNzfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge2RhdGF9O1xuICB9XG5cbiAgeGkxOG4oY3R4OiBYaTE4bkNvbnRleHQsIG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBSZWFkb25seTxDb21wb25lbnRBbmFseXNpc0RhdGE+KTpcbiAgICAgIHZvaWQge1xuICAgIGN0eC51cGRhdGVGcm9tVGVtcGxhdGUoXG4gICAgICAgIGFuYWx5c2lzLnRlbXBsYXRlLmNvbnRlbnQsIGFuYWx5c2lzLnRlbXBsYXRlLmRlY2xhcmF0aW9uLnJlc29sdmVkVGVtcGxhdGVVcmwsXG4gICAgICAgIGFuYWx5c2lzLnRlbXBsYXRlLmludGVycG9sYXRpb25Db25maWcgPz8gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk7XG4gIH1cblxuICB1cGRhdGVSZXNvdXJjZXMobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IENvbXBvbmVudEFuYWx5c2lzRGF0YSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhaW5pbmdGaWxlID0gbm9kZS5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWU7XG5cbiAgICAvLyBJZiB0aGUgdGVtcGxhdGUgaXMgZXh0ZXJuYWwsIHJlLXBhcnNlIGl0LlxuICAgIGNvbnN0IHRlbXBsYXRlRGVjbCA9IGFuYWx5c2lzLnRlbXBsYXRlLmRlY2xhcmF0aW9uO1xuICAgIGlmICghdGVtcGxhdGVEZWNsLmlzSW5saW5lKSB7XG4gICAgICBhbmFseXNpcy50ZW1wbGF0ZSA9IHRoaXMuZXh0cmFjdFRlbXBsYXRlKG5vZGUsIHRlbXBsYXRlRGVjbCk7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGFueSBleHRlcm5hbCBzdHlsZXNoZWV0cyBhbmQgcmVidWlsZCB0aGUgY29tYmluZWQgJ3N0eWxlcycgbGlzdC5cbiAgICAvLyBUT0RPKGFseGh1Yik6IHdyaXRlIHRlc3RzIGZvciBzdHlsZXMgd2hlbiB0aGUgcHJpbWFyeSBjb21waWxlciB1c2VzIHRoZSB1cGRhdGVSZXNvdXJjZXMgcGF0aFxuICAgIGxldCBzdHlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGFuYWx5c2lzLnN0eWxlVXJscyAhPT0gbnVsbCkge1xuICAgICAgZm9yIChjb25zdCBzdHlsZVVybCBvZiBhbmFseXNpcy5zdHlsZVVybHMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXNvbHZlZFN0eWxlVXJsID0gdGhpcy5yZXNvdXJjZUxvYWRlci5yZXNvbHZlKHN0eWxlVXJsLnVybCwgY29udGFpbmluZ0ZpbGUpO1xuICAgICAgICAgIGNvbnN0IHN0eWxlVGV4dCA9IHRoaXMucmVzb3VyY2VMb2FkZXIubG9hZChyZXNvbHZlZFN0eWxlVXJsKTtcbiAgICAgICAgICBzdHlsZXMucHVzaChzdHlsZVRleHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gUmVzb3VyY2UgcmVzb2x2ZSBmYWlsdXJlcyBzaG91bGQgYWxyZWFkeSBiZSBpbiB0aGUgZGlhZ25vc3RpY3MgbGlzdCBmcm9tIHRoZSBhbmFseXplXG4gICAgICAgICAgLy8gc3RhZ2UuIFdlIGRvIG5vdCBuZWVkIHRvIGRvIGFueXRoaW5nIHdpdGggdGhlbSB3aGVuIHVwZGF0aW5nIHJlc291cmNlcy5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYW5hbHlzaXMuaW5saW5lU3R5bGVzICE9PSBudWxsKSB7XG4gICAgICBmb3IgKGNvbnN0IHN0eWxlVGV4dCBvZiBhbmFseXNpcy5pbmxpbmVTdHlsZXMpIHtcbiAgICAgICAgc3R5bGVzLnB1c2goc3R5bGVUZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBzdHlsZVRleHQgb2YgYW5hbHlzaXMudGVtcGxhdGUuc3R5bGVzKSB7XG4gICAgICBzdHlsZXMucHVzaChzdHlsZVRleHQpO1xuICAgIH1cblxuICAgIGFuYWx5c2lzLm1ldGEuc3R5bGVzID0gc3R5bGVzO1xuICB9XG5cbiAgY29tcGlsZUZ1bGwoXG4gICAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogUmVhZG9ubHk8Q29tcG9uZW50QW5hbHlzaXNEYXRhPixcbiAgICAgIHJlc29sdXRpb246IFJlYWRvbmx5PENvbXBvbmVudFJlc29sdXRpb25EYXRhPiwgcG9vbDogQ29uc3RhbnRQb29sKTogQ29tcGlsZVJlc3VsdFtdIHtcbiAgICBpZiAoYW5hbHlzaXMudGVtcGxhdGUuZXJyb3JzICE9PSBudWxsICYmIGFuYWx5c2lzLnRlbXBsYXRlLmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGNvbnN0IG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEgPSB7Li4uYW5hbHlzaXMubWV0YSwgLi4ucmVzb2x1dGlvbn07XG4gICAgY29uc3QgZmFjID0gY29tcGlsZU5nRmFjdG9yeURlZkZpZWxkKHRvRmFjdG9yeU1ldGFkYXRhKG1ldGEsIEZhY3RvcnlUYXJnZXQuQ29tcG9uZW50KSk7XG4gICAgY29uc3QgZGVmID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBwb29sLCBtYWtlQmluZGluZ1BhcnNlcigpKTtcbiAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gYW5hbHlzaXMuY2xhc3NNZXRhZGF0YSAhPT0gbnVsbCA/XG4gICAgICAgIGNvbXBpbGVDbGFzc01ldGFkYXRhKGFuYWx5c2lzLmNsYXNzTWV0YWRhdGEpLnRvU3RtdCgpIDpcbiAgICAgICAgbnVsbDtcbiAgICByZXR1cm4gY29tcGlsZVJlc3VsdHMoZmFjLCBkZWYsIGNsYXNzTWV0YWRhdGEsICfJtWNtcCcpO1xuICB9XG5cbiAgY29tcGlsZVBhcnRpYWwoXG4gICAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogUmVhZG9ubHk8Q29tcG9uZW50QW5hbHlzaXNEYXRhPixcbiAgICAgIHJlc29sdXRpb246IFJlYWRvbmx5PENvbXBvbmVudFJlc29sdXRpb25EYXRhPik6IENvbXBpbGVSZXN1bHRbXSB7XG4gICAgaWYgKGFuYWx5c2lzLnRlbXBsYXRlLmVycm9ycyAhPT0gbnVsbCAmJiBhbmFseXNpcy50ZW1wbGF0ZS5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBjb25zdCB0ZW1wbGF0ZUluZm86IERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8gPSB7XG4gICAgICBjb250ZW50OiBhbmFseXNpcy50ZW1wbGF0ZS5jb250ZW50LFxuICAgICAgc291cmNlVXJsOiBhbmFseXNpcy50ZW1wbGF0ZS5kZWNsYXJhdGlvbi5yZXNvbHZlZFRlbXBsYXRlVXJsLFxuICAgICAgaXNJbmxpbmU6IGFuYWx5c2lzLnRlbXBsYXRlLmRlY2xhcmF0aW9uLmlzSW5saW5lLFxuICAgICAgaW5saW5lVGVtcGxhdGVMaXRlcmFsRXhwcmVzc2lvbjogYW5hbHlzaXMudGVtcGxhdGUuc291cmNlTWFwcGluZy50eXBlID09PSAnZGlyZWN0JyA/XG4gICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihhbmFseXNpcy50ZW1wbGF0ZS5zb3VyY2VNYXBwaW5nLm5vZGUpIDpcbiAgICAgICAgICBudWxsLFxuICAgIH07XG4gICAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHsuLi5hbmFseXNpcy5tZXRhLCAuLi5yZXNvbHV0aW9ufTtcbiAgICBjb25zdCBmYWMgPSBjb21waWxlRGVjbGFyZUZhY3RvcnkodG9GYWN0b3J5TWV0YWRhdGEobWV0YSwgRmFjdG9yeVRhcmdldC5Db21wb25lbnQpKTtcbiAgICBjb25zdCBkZWYgPSBjb21waWxlRGVjbGFyZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBhbmFseXNpcy50ZW1wbGF0ZSwgdGVtcGxhdGVJbmZvKTtcbiAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gYW5hbHlzaXMuY2xhc3NNZXRhZGF0YSAhPT0gbnVsbCA/XG4gICAgICAgIGNvbXBpbGVEZWNsYXJlQ2xhc3NNZXRhZGF0YShhbmFseXNpcy5jbGFzc01ldGFkYXRhKS50b1N0bXQoKSA6XG4gICAgICAgIG51bGw7XG4gICAgcmV0dXJuIGNvbXBpbGVSZXN1bHRzKGZhYywgZGVmLCBjbGFzc01ldGFkYXRhLCAnybVjbXAnKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jlc29sdmVMaXRlcmFsKGRlY29yYXRvcjogRGVjb3JhdG9yKTogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24ge1xuICAgIGlmICh0aGlzLmxpdGVyYWxDYWNoZS5oYXMoZGVjb3JhdG9yKSkge1xuICAgICAgcmV0dXJuIHRoaXMubGl0ZXJhbENhY2hlLmdldChkZWNvcmF0b3IpITtcbiAgICB9XG4gICAgaWYgKGRlY29yYXRvci5hcmdzID09PSBudWxsIHx8IGRlY29yYXRvci5hcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJJVFlfV1JPTkcsIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjb3JhdG9yKSxcbiAgICAgICAgICBgSW5jb3JyZWN0IG51bWJlciBvZiBhcmd1bWVudHMgdG8gQENvbXBvbmVudCBkZWNvcmF0b3JgKTtcbiAgICB9XG4gICAgY29uc3QgbWV0YSA9IHVud3JhcEV4cHJlc3Npb24oZGVjb3JhdG9yLmFyZ3NbMF0pO1xuXG4gICAgaWYgKCF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKG1ldGEpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUkdfTk9UX0xJVEVSQUwsIG1ldGEsIGBEZWNvcmF0b3IgYXJndW1lbnQgbXVzdCBiZSBsaXRlcmFsLmApO1xuICAgIH1cblxuICAgIHRoaXMubGl0ZXJhbENhY2hlLnNldChkZWNvcmF0b3IsIG1ldGEpO1xuICAgIHJldHVybiBtZXRhO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZUVudW1WYWx1ZShcbiAgICAgIGNvbXBvbmVudDogTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj4sIGZpZWxkOiBzdHJpbmcsIGVudW1TeW1ib2xOYW1lOiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gICAgbGV0IHJlc29sdmVkOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKGNvbXBvbmVudC5oYXMoZmllbGQpKSB7XG4gICAgICBjb25zdCBleHByID0gY29tcG9uZW50LmdldChmaWVsZCkhO1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLmV2YWx1YXRvci5ldmFsdWF0ZShleHByKSBhcyBhbnk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBFbnVtVmFsdWUgJiYgaXNBbmd1bGFyQ29yZVJlZmVyZW5jZSh2YWx1ZS5lbnVtUmVmLCBlbnVtU3ltYm9sTmFtZSkpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSB2YWx1ZS5yZXNvbHZlZCBhcyBudW1iZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgZXhwciwgdmFsdWUsIGAke2ZpZWxkfSBtdXN0IGJlIGEgbWVtYmVyIG9mICR7ZW51bVN5bWJvbE5hbWV9IGVudW0gZnJvbSBAYW5ndWxhci9jb3JlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXNvbHZlZDtcbiAgfVxuXG4gIHByaXZhdGUgX2V4dHJhY3RDb21wb25lbnRTdHlsZVVybHMoXG4gICAgICBjb21wb25lbnQ6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+LFxuICAgICAgKTogU3R5bGVVcmxNZXRhW10ge1xuICAgIGlmICghY29tcG9uZW50Lmhhcygnc3R5bGVVcmxzJykpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fZXh0cmFjdFN0eWxlVXJsc0Zyb21FeHByZXNzaW9uKGNvbXBvbmVudC5nZXQoJ3N0eWxlVXJscycpISk7XG4gIH1cblxuICBwcml2YXRlIF9leHRyYWN0U3R5bGVVcmxzRnJvbUV4cHJlc3Npb24oc3R5bGVVcmxzRXhwcjogdHMuRXhwcmVzc2lvbik6IFN0eWxlVXJsTWV0YVtdIHtcbiAgICBjb25zdCBzdHlsZVVybHM6IFN0eWxlVXJsTWV0YVtdID0gW107XG5cbiAgICBpZiAodHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKHN0eWxlVXJsc0V4cHIpKSB7XG4gICAgICBmb3IgKGNvbnN0IHN0eWxlVXJsRXhwciBvZiBzdHlsZVVybHNFeHByLmVsZW1lbnRzKSB7XG4gICAgICAgIGlmICh0cy5pc1NwcmVhZEVsZW1lbnQoc3R5bGVVcmxFeHByKSkge1xuICAgICAgICAgIHN0eWxlVXJscy5wdXNoKC4uLnRoaXMuX2V4dHJhY3RTdHlsZVVybHNGcm9tRXhwcmVzc2lvbihzdHlsZVVybEV4cHIuZXhwcmVzc2lvbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHN0eWxlVXJsID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoc3R5bGVVcmxFeHByKTtcblxuICAgICAgICAgIGlmICh0eXBlb2Ygc3R5bGVVcmwgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKHN0eWxlVXJsRXhwciwgc3R5bGVVcmwsICdzdHlsZVVybCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3R5bGVVcmxzLnB1c2goe1xuICAgICAgICAgICAgdXJsOiBzdHlsZVVybCxcbiAgICAgICAgICAgIHNvdXJjZTogUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3MuU3R5bGVzaGVldEZyb21EZWNvcmF0b3IsXG4gICAgICAgICAgICBub2RlRm9yRXJyb3I6IHN0eWxlVXJsRXhwcixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBldmFsdWF0ZWRTdHlsZVVybHMgPSB0aGlzLmV2YWx1YXRvci5ldmFsdWF0ZShzdHlsZVVybHNFeHByKTtcbiAgICAgIGlmICghaXNTdHJpbmdBcnJheShldmFsdWF0ZWRTdHlsZVVybHMpKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICBzdHlsZVVybHNFeHByLCBldmFsdWF0ZWRTdHlsZVVybHMsICdzdHlsZVVybHMgbXVzdCBiZSBhbiBhcnJheSBvZiBzdHJpbmdzJyk7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3Qgc3R5bGVVcmwgb2YgZXZhbHVhdGVkU3R5bGVVcmxzKSB7XG4gICAgICAgIHN0eWxlVXJscy5wdXNoKHtcbiAgICAgICAgICB1cmw6IHN0eWxlVXJsLFxuICAgICAgICAgIHNvdXJjZTogUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3MuU3R5bGVzaGVldEZyb21EZWNvcmF0b3IsXG4gICAgICAgICAgbm9kZUZvckVycm9yOiBzdHlsZVVybHNFeHByLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3R5bGVVcmxzO1xuICB9XG5cbiAgcHJpdmF0ZSBfZXh0cmFjdFN0eWxlUmVzb3VyY2VzKGNvbXBvbmVudDogTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj4sIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcpOlxuICAgICAgUmVhZG9ubHlTZXQ8UmVzb3VyY2U+IHtcbiAgICBjb25zdCBzdHlsZXMgPSBuZXcgU2V0PFJlc291cmNlPigpO1xuICAgIGZ1bmN0aW9uIHN0cmluZ0xpdGVyYWxFbGVtZW50cyhhcnJheTogdHMuQXJyYXlMaXRlcmFsRXhwcmVzc2lvbik6IHRzLlN0cmluZ0xpdGVyYWxMaWtlW10ge1xuICAgICAgcmV0dXJuIGFycmF5LmVsZW1lbnRzLmZpbHRlcihcbiAgICAgICAgICAoZTogdHMuRXhwcmVzc2lvbik6IGUgaXMgdHMuU3RyaW5nTGl0ZXJhbExpa2UgPT4gdHMuaXNTdHJpbmdMaXRlcmFsTGlrZShlKSk7XG4gICAgfVxuXG4gICAgLy8gSWYgc3R5bGVVcmxzIGlzIGEgbGl0ZXJhbCBhcnJheSwgcHJvY2VzcyBlYWNoIHJlc291cmNlIHVybCBpbmRpdmlkdWFsbHkgYW5kXG4gICAgLy8gcmVnaXN0ZXIgb25lcyB0aGF0IGFyZSBzdHJpbmcgbGl0ZXJhbHMuXG4gICAgY29uc3Qgc3R5bGVVcmxzRXhwciA9IGNvbXBvbmVudC5nZXQoJ3N0eWxlVXJscycpO1xuICAgIGlmIChzdHlsZVVybHNFeHByICE9PSB1bmRlZmluZWQgJiYgdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKHN0eWxlVXJsc0V4cHIpKSB7XG4gICAgICBmb3IgKGNvbnN0IGV4cHJlc3Npb24gb2Ygc3RyaW5nTGl0ZXJhbEVsZW1lbnRzKHN0eWxlVXJsc0V4cHIpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzb3VyY2VVcmwgPSB0aGlzLnJlc291cmNlTG9hZGVyLnJlc29sdmUoZXhwcmVzc2lvbi50ZXh0LCBjb250YWluaW5nRmlsZSk7XG4gICAgICAgICAgc3R5bGVzLmFkZCh7cGF0aDogYWJzb2x1dGVGcm9tKHJlc291cmNlVXJsKSwgZXhwcmVzc2lvbn0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBFcnJvcnMgaW4gc3R5bGUgcmVzb3VyY2UgZXh0cmFjdGlvbiBkbyBub3QgbmVlZCB0byBiZSBoYW5kbGVkIGhlcmUuIFdlIHdpbGwgcHJvZHVjZVxuICAgICAgICAgIC8vIGRpYWdub3N0aWNzIGZvciBlYWNoIG9uZSB0aGF0IGZhaWxzIGluIHRoZSBhbmFseXNpcywgYWZ0ZXIgd2UgZXZhbHVhdGUgdGhlIGBzdHlsZVVybHNgXG4gICAgICAgICAgLy8gZXhwcmVzc2lvbiB0byBkZXRlcm1pbmUgX2FsbF8gc3R5bGUgcmVzb3VyY2VzLCBub3QganVzdCB0aGUgc3RyaW5nIGxpdGVyYWxzLlxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgc3R5bGVzRXhwciA9IGNvbXBvbmVudC5nZXQoJ3N0eWxlcycpO1xuICAgIGlmIChzdHlsZXNFeHByICE9PSB1bmRlZmluZWQgJiYgdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKHN0eWxlc0V4cHIpKSB7XG4gICAgICBmb3IgKGNvbnN0IGV4cHJlc3Npb24gb2Ygc3RyaW5nTGl0ZXJhbEVsZW1lbnRzKHN0eWxlc0V4cHIpKSB7XG4gICAgICAgIHN0eWxlcy5hZGQoe3BhdGg6IG51bGwsIGV4cHJlc3Npb259KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3R5bGVzO1xuICB9XG5cbiAgcHJpdmF0ZSBfcHJlbG9hZEFuZFBhcnNlVGVtcGxhdGUoXG4gICAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IERlY29yYXRvciwgY29tcG9uZW50OiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPixcbiAgICAgIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcpOiBQcm9taXNlPFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZXxudWxsPiB7XG4gICAgaWYgKGNvbXBvbmVudC5oYXMoJ3RlbXBsYXRlVXJsJykpIHtcbiAgICAgIC8vIEV4dHJhY3QgdGhlIHRlbXBsYXRlVXJsIGFuZCBwcmVsb2FkIGl0LlxuICAgICAgY29uc3QgdGVtcGxhdGVVcmxFeHByID0gY29tcG9uZW50LmdldCgndGVtcGxhdGVVcmwnKSE7XG4gICAgICBjb25zdCB0ZW1wbGF0ZVVybCA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKHRlbXBsYXRlVXJsRXhwcik7XG4gICAgICBpZiAodHlwZW9mIHRlbXBsYXRlVXJsICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgdGVtcGxhdGVVcmxFeHByLCB0ZW1wbGF0ZVVybCwgJ3RlbXBsYXRlVXJsIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc291cmNlVXJsID0gdGhpcy5yZXNvdXJjZUxvYWRlci5yZXNvbHZlKHRlbXBsYXRlVXJsLCBjb250YWluaW5nRmlsZSk7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlUHJvbWlzZSA9XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlTG9hZGVyLnByZWxvYWQocmVzb3VyY2VVcmwsIHt0eXBlOiAndGVtcGxhdGUnLCBjb250YWluaW5nRmlsZX0pO1xuXG4gICAgICAgIC8vIElmIHRoZSBwcmVsb2FkIHdvcmtlZCwgdGhlbiBhY3R1YWxseSBsb2FkIGFuZCBwYXJzZSB0aGUgdGVtcGxhdGUsIGFuZCB3YWl0IGZvciBhbnkgc3R5bGVcbiAgICAgICAgLy8gVVJMcyB0byByZXNvbHZlLlxuICAgICAgICBpZiAodGVtcGxhdGVQcm9taXNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gdGVtcGxhdGVQcm9taXNlLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGVEZWNsID1cbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlVGVtcGxhdGVEZWNsYXJhdGlvbihkZWNvcmF0b3IsIGNvbXBvbmVudCwgY29udGFpbmluZ0ZpbGUpO1xuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGUgPSB0aGlzLmV4dHJhY3RUZW1wbGF0ZShub2RlLCB0ZW1wbGF0ZURlY2wpO1xuICAgICAgICAgICAgdGhpcy5wcmVhbmFseXplVGVtcGxhdGVDYWNoZS5zZXQobm9kZSwgdGVtcGxhdGUpO1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5tYWtlUmVzb3VyY2VOb3RGb3VuZEVycm9yKFxuICAgICAgICAgICAgdGVtcGxhdGVVcmwsIHRlbXBsYXRlVXJsRXhwciwgUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3MuVGVtcGxhdGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZURlY2wgPSB0aGlzLnBhcnNlVGVtcGxhdGVEZWNsYXJhdGlvbihkZWNvcmF0b3IsIGNvbXBvbmVudCwgY29udGFpbmluZ0ZpbGUpO1xuICAgICAgY29uc3QgdGVtcGxhdGUgPSB0aGlzLmV4dHJhY3RUZW1wbGF0ZShub2RlLCB0ZW1wbGF0ZURlY2wpO1xuICAgICAgdGhpcy5wcmVhbmFseXplVGVtcGxhdGVDYWNoZS5zZXQobm9kZSwgdGVtcGxhdGUpO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0ZW1wbGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0VGVtcGxhdGUobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgdGVtcGxhdGU6IFRlbXBsYXRlRGVjbGFyYXRpb24pOlxuICAgICAgUGFyc2VkVGVtcGxhdGVXaXRoU291cmNlIHtcbiAgICBpZiAodGVtcGxhdGUuaXNJbmxpbmUpIHtcbiAgICAgIGxldCBzb3VyY2VTdHI6IHN0cmluZztcbiAgICAgIGxldCBzb3VyY2VQYXJzZVJhbmdlOiBMZXhlclJhbmdlfG51bGwgPSBudWxsO1xuICAgICAgbGV0IHRlbXBsYXRlQ29udGVudDogc3RyaW5nO1xuICAgICAgbGV0IHNvdXJjZU1hcHBpbmc6IFRlbXBsYXRlU291cmNlTWFwcGluZztcbiAgICAgIGxldCBlc2NhcGVkU3RyaW5nID0gZmFsc2U7XG4gICAgICBsZXQgc291cmNlTWFwVXJsOiBzdHJpbmd8bnVsbDtcbiAgICAgIC8vIFdlIG9ubHkgc3VwcG9ydCBTb3VyY2VNYXBzIGZvciBpbmxpbmUgdGVtcGxhdGVzIHRoYXQgYXJlIHNpbXBsZSBzdHJpbmcgbGl0ZXJhbHMuXG4gICAgICBpZiAodHMuaXNTdHJpbmdMaXRlcmFsKHRlbXBsYXRlLmV4cHJlc3Npb24pIHx8XG4gICAgICAgICAgdHMuaXNOb1N1YnN0aXR1dGlvblRlbXBsYXRlTGl0ZXJhbCh0ZW1wbGF0ZS5leHByZXNzaW9uKSkge1xuICAgICAgICAvLyB0aGUgc3RhcnQgYW5kIGVuZCBvZiB0aGUgYHRlbXBsYXRlRXhwcmAgbm9kZSBpbmNsdWRlcyB0aGUgcXVvdGF0aW9uIG1hcmtzLCB3aGljaCB3ZSBtdXN0XG4gICAgICAgIC8vIHN0cmlwXG4gICAgICAgIHNvdXJjZVBhcnNlUmFuZ2UgPSBnZXRUZW1wbGF0ZVJhbmdlKHRlbXBsYXRlLmV4cHJlc3Npb24pO1xuICAgICAgICBzb3VyY2VTdHIgPSB0ZW1wbGF0ZS5leHByZXNzaW9uLmdldFNvdXJjZUZpbGUoKS50ZXh0O1xuICAgICAgICB0ZW1wbGF0ZUNvbnRlbnQgPSB0ZW1wbGF0ZS5leHByZXNzaW9uLnRleHQ7XG4gICAgICAgIGVzY2FwZWRTdHJpbmcgPSB0cnVlO1xuICAgICAgICBzb3VyY2VNYXBwaW5nID0ge1xuICAgICAgICAgIHR5cGU6ICdkaXJlY3QnLFxuICAgICAgICAgIG5vZGU6IHRlbXBsYXRlLmV4cHJlc3Npb24sXG4gICAgICAgIH07XG4gICAgICAgIHNvdXJjZU1hcFVybCA9IHRlbXBsYXRlLnJlc29sdmVkVGVtcGxhdGVVcmw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXNvbHZlZFRlbXBsYXRlID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUodGVtcGxhdGUuZXhwcmVzc2lvbik7XG4gICAgICAgIGlmICh0eXBlb2YgcmVzb2x2ZWRUZW1wbGF0ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICB0ZW1wbGF0ZS5leHByZXNzaW9uLCByZXNvbHZlZFRlbXBsYXRlLCAndGVtcGxhdGUgbXVzdCBiZSBhIHN0cmluZycpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFdlIGRvIG5vdCBwYXJzZSB0aGUgdGVtcGxhdGUgZGlyZWN0bHkgZnJvbSB0aGUgc291cmNlIGZpbGUgdXNpbmcgYSBsZXhlciByYW5nZSwgc29cbiAgICAgICAgLy8gdGhlIHRlbXBsYXRlIHNvdXJjZSBhbmQgY29udGVudCBhcmUgc2V0IHRvIHRoZSBzdGF0aWNhbGx5IHJlc29sdmVkIHRlbXBsYXRlLlxuICAgICAgICBzb3VyY2VTdHIgPSByZXNvbHZlZFRlbXBsYXRlO1xuICAgICAgICB0ZW1wbGF0ZUNvbnRlbnQgPSByZXNvbHZlZFRlbXBsYXRlO1xuICAgICAgICBzb3VyY2VNYXBwaW5nID0ge1xuICAgICAgICAgIHR5cGU6ICdpbmRpcmVjdCcsXG4gICAgICAgICAgbm9kZTogdGVtcGxhdGUuZXhwcmVzc2lvbixcbiAgICAgICAgICBjb21wb25lbnRDbGFzczogbm9kZSxcbiAgICAgICAgICB0ZW1wbGF0ZTogdGVtcGxhdGVDb250ZW50LFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEluZGlyZWN0IHRlbXBsYXRlcyBjYW5ub3QgYmUgbWFwcGVkIHRvIGEgcGFydGljdWxhciBieXRlIHJhbmdlIG9mIGFueSBpbnB1dCBmaWxlLCBzaW5jZVxuICAgICAgICAvLyB0aGV5J3JlIGNvbXB1dGVkIGJ5IGV4cHJlc3Npb25zIHRoYXQgbWF5IHNwYW4gbWFueSBmaWxlcy4gRG9uJ3QgYXR0ZW1wdCB0byBtYXAgdGhlbSBiYWNrXG4gICAgICAgIC8vIHRvIGEgZ2l2ZW4gZmlsZS5cbiAgICAgICAgc291cmNlTWFwVXJsID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4udGhpcy5fcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgc291cmNlU3RyLCBzb3VyY2VQYXJzZVJhbmdlLCBlc2NhcGVkU3RyaW5nLCBzb3VyY2VNYXBVcmwpLFxuICAgICAgICBjb250ZW50OiB0ZW1wbGF0ZUNvbnRlbnQsXG4gICAgICAgIHNvdXJjZU1hcHBpbmcsXG4gICAgICAgIGRlY2xhcmF0aW9uOiB0ZW1wbGF0ZSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlQ29udGVudCA9IHRoaXMucmVzb3VyY2VMb2FkZXIubG9hZCh0ZW1wbGF0ZS5yZXNvbHZlZFRlbXBsYXRlVXJsKTtcbiAgICAgIGlmICh0aGlzLmRlcFRyYWNrZXIgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZXBUcmFja2VyLmFkZFJlc291cmNlRGVwZW5kZW5jeShcbiAgICAgICAgICAgIG5vZGUuZ2V0U291cmNlRmlsZSgpLCBhYnNvbHV0ZUZyb20odGVtcGxhdGUucmVzb2x2ZWRUZW1wbGF0ZVVybCkpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi50aGlzLl9wYXJzZVRlbXBsYXRlKFxuICAgICAgICAgICAgdGVtcGxhdGUsIC8qIHNvdXJjZVN0ciAqLyB0ZW1wbGF0ZUNvbnRlbnQsIC8qIHNvdXJjZVBhcnNlUmFuZ2UgKi8gbnVsbCxcbiAgICAgICAgICAgIC8qIGVzY2FwZWRTdHJpbmcgKi8gZmFsc2UsXG4gICAgICAgICAgICAvKiBzb3VyY2VNYXBVcmwgKi8gdGVtcGxhdGUucmVzb2x2ZWRUZW1wbGF0ZVVybCksXG4gICAgICAgIGNvbnRlbnQ6IHRlbXBsYXRlQ29udGVudCxcbiAgICAgICAgc291cmNlTWFwcGluZzoge1xuICAgICAgICAgIHR5cGU6ICdleHRlcm5hbCcsXG4gICAgICAgICAgY29tcG9uZW50Q2xhc3M6IG5vZGUsXG4gICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBUUyBpbiBnMyBpcyB1bmFibGUgdG8gbWFrZSB0aGlzIGluZmVyZW5jZSBvbiBpdHMgb3duLCBzbyBjYXN0IGl0IGhlcmVcbiAgICAgICAgICAvLyB1bnRpbCBnMyBpcyBhYmxlIHRvIGZpZ3VyZSB0aGlzIG91dC5cbiAgICAgICAgICBub2RlOiAodGVtcGxhdGUgYXMgRXh0ZXJuYWxUZW1wbGF0ZURlY2xhcmF0aW9uKS50ZW1wbGF0ZVVybEV4cHJlc3Npb24sXG4gICAgICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlQ29udGVudCxcbiAgICAgICAgICB0ZW1wbGF0ZVVybDogdGVtcGxhdGUucmVzb2x2ZWRUZW1wbGF0ZVVybCxcbiAgICAgICAgfSxcbiAgICAgICAgZGVjbGFyYXRpb246IHRlbXBsYXRlLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVRlbXBsYXRlKFxuICAgICAgdGVtcGxhdGU6IFRlbXBsYXRlRGVjbGFyYXRpb24sIHNvdXJjZVN0cjogc3RyaW5nLCBzb3VyY2VQYXJzZVJhbmdlOiBMZXhlclJhbmdlfG51bGwsXG4gICAgICBlc2NhcGVkU3RyaW5nOiBib29sZWFuLCBzb3VyY2VNYXBVcmw6IHN0cmluZ3xudWxsKTogUGFyc2VkQ29tcG9uZW50VGVtcGxhdGUge1xuICAgIC8vIFdlIGFsd2F5cyBub3JtYWxpemUgbGluZSBlbmRpbmdzIGlmIHRoZSB0ZW1wbGF0ZSBoYXMgYmVlbiBlc2NhcGVkIChpLmUuIGlzIGlubGluZSkuXG4gICAgY29uc3QgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzID0gZXNjYXBlZFN0cmluZyB8fCB0aGlzLmkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVcztcblxuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlID0gcGFyc2VUZW1wbGF0ZShzb3VyY2VTdHIsIHNvdXJjZU1hcFVybCA/PyAnJywge1xuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlczogdGVtcGxhdGUucHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IHRlbXBsYXRlLmludGVycG9sYXRpb25Db25maWcsXG4gICAgICByYW5nZTogc291cmNlUGFyc2VSYW5nZSA/PyB1bmRlZmluZWQsXG4gICAgICBlc2NhcGVkU3RyaW5nLFxuICAgICAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdDogdGhpcy5lbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0LFxuICAgICAgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzLFxuICAgICAgYWx3YXlzQXR0ZW1wdEh0bWxUb1IzQXN0Q29udmVyc2lvbjogdGhpcy51c2VQb2lzb25lZERhdGEsXG4gICAgfSk7XG5cbiAgICAvLyBVbmZvcnR1bmF0ZWx5LCB0aGUgcHJpbWFyeSBwYXJzZSBvZiB0aGUgdGVtcGxhdGUgYWJvdmUgbWF5IG5vdCBjb250YWluIGFjY3VyYXRlIHNvdXJjZSBtYXBcbiAgICAvLyBpbmZvcm1hdGlvbi4gSWYgdXNlZCBkaXJlY3RseSwgaXQgd291bGQgcmVzdWx0IGluIGluY29ycmVjdCBjb2RlIGxvY2F0aW9ucyBpbiB0ZW1wbGF0ZVxuICAgIC8vIGVycm9ycywgZXRjLiBUaGVyZSBhcmUgdGhyZWUgbWFpbiBwcm9ibGVtczpcbiAgICAvL1xuICAgIC8vIDEuIGBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBmYWxzZWAgYW5uaWhpbGF0ZXMgdGhlIGNvcnJlY3RuZXNzIG9mIHRlbXBsYXRlIHNvdXJjZSBtYXBwaW5nLCBhc1xuICAgIC8vICAgIHRoZSB3aGl0ZXNwYWNlIHRyYW5zZm9ybWF0aW9uIGNoYW5nZXMgdGhlIGNvbnRlbnRzIG9mIEhUTUwgdGV4dCBub2RlcyBiZWZvcmUgdGhleSdyZVxuICAgIC8vICAgIHBhcnNlZCBpbnRvIEFuZ3VsYXIgZXhwcmVzc2lvbnMuXG4gICAgLy8gMi4gYHByZXNlcnZlTGluZUVuZGluZ3M6IGZhbHNlYCBjYXVzZXMgZ3Jvd2luZyBtaXNhbGlnbm1lbnRzIGluIHRlbXBsYXRlcyB0aGF0IHVzZSAnXFxyXFxuJ1xuICAgIC8vICAgIGxpbmUgZW5kaW5ncywgYnkgbm9ybWFsaXppbmcgdGhlbSB0byAnXFxuJy5cbiAgICAvLyAzLiBCeSBkZWZhdWx0LCB0aGUgdGVtcGxhdGUgcGFyc2VyIHN0cmlwcyBsZWFkaW5nIHRyaXZpYSBjaGFyYWN0ZXJzIChsaWtlIHNwYWNlcywgdGFicywgYW5kXG4gICAgLy8gICAgbmV3bGluZXMpLiBUaGlzIGFsc28gZGVzdHJveXMgc291cmNlIG1hcHBpbmcgaW5mb3JtYXRpb24uXG4gICAgLy9cbiAgICAvLyBJbiBvcmRlciB0byBndWFyYW50ZWUgdGhlIGNvcnJlY3RuZXNzIG9mIGRpYWdub3N0aWNzLCB0ZW1wbGF0ZXMgYXJlIHBhcnNlZCBhIHNlY29uZCB0aW1lXG4gICAgLy8gd2l0aCB0aGUgYWJvdmUgb3B0aW9ucyBzZXQgdG8gcHJlc2VydmUgc291cmNlIG1hcHBpbmdzLlxuXG4gICAgY29uc3Qge25vZGVzOiBkaWFnTm9kZXN9ID0gcGFyc2VUZW1wbGF0ZShzb3VyY2VTdHIsIHNvdXJjZU1hcFVybCA/PyAnJywge1xuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlczogdHJ1ZSxcbiAgICAgIHByZXNlcnZlTGluZUVuZGluZ3M6IHRydWUsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiB0ZW1wbGF0ZS5pbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgcmFuZ2U6IHNvdXJjZVBhcnNlUmFuZ2UgPz8gdW5kZWZpbmVkLFxuICAgICAgZXNjYXBlZFN0cmluZyxcbiAgICAgIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQ6IHRoaXMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCxcbiAgICAgIGkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVcyxcbiAgICAgIGxlYWRpbmdUcml2aWFDaGFyczogW10sXG4gICAgICBhbHdheXNBdHRlbXB0SHRtbFRvUjNBc3RDb252ZXJzaW9uOiB0aGlzLnVzZVBvaXNvbmVkRGF0YSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICAuLi5wYXJzZWRUZW1wbGF0ZSxcbiAgICAgIGRpYWdOb2RlcyxcbiAgICAgIGZpbGU6IG5ldyBQYXJzZVNvdXJjZUZpbGUoc291cmNlU3RyLCBzb3VyY2VNYXBVcmwgPz8gJycpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHBhcnNlVGVtcGxhdGVEZWNsYXJhdGlvbihcbiAgICAgIGRlY29yYXRvcjogRGVjb3JhdG9yLCBjb21wb25lbnQ6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+LFxuICAgICAgY29udGFpbmluZ0ZpbGU6IHN0cmluZyk6IFRlbXBsYXRlRGVjbGFyYXRpb24ge1xuICAgIGxldCBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuID0gdGhpcy5kZWZhdWx0UHJlc2VydmVXaGl0ZXNwYWNlcztcbiAgICBpZiAoY29tcG9uZW50LmhhcygncHJlc2VydmVXaGl0ZXNwYWNlcycpKSB7XG4gICAgICBjb25zdCBleHByID0gY29tcG9uZW50LmdldCgncHJlc2VydmVXaGl0ZXNwYWNlcycpITtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoZXhwcik7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihleHByLCB2YWx1ZSwgJ3ByZXNlcnZlV2hpdGVzcGFjZXMgbXVzdCBiZSBhIGJvb2xlYW4nKTtcbiAgICAgIH1cbiAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgaW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgaWYgKGNvbXBvbmVudC5oYXMoJ2ludGVycG9sYXRpb24nKSkge1xuICAgICAgY29uc3QgZXhwciA9IGNvbXBvbmVudC5nZXQoJ2ludGVycG9sYXRpb24nKSE7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKGV4cHIpO1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT09IDIgfHxcbiAgICAgICAgICAhdmFsdWUuZXZlcnkoZWxlbWVudCA9PiB0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICBleHByLCB2YWx1ZSwgJ2ludGVycG9sYXRpb24gbXVzdCBiZSBhbiBhcnJheSB3aXRoIDIgZWxlbWVudHMgb2Ygc3RyaW5nIHR5cGUnKTtcbiAgICAgIH1cbiAgICAgIGludGVycG9sYXRpb25Db25maWcgPSBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheSh2YWx1ZSBhcyBbc3RyaW5nLCBzdHJpbmddKTtcbiAgICB9XG5cbiAgICBpZiAoY29tcG9uZW50LmhhcygndGVtcGxhdGVVcmwnKSkge1xuICAgICAgY29uc3QgdGVtcGxhdGVVcmxFeHByID0gY29tcG9uZW50LmdldCgndGVtcGxhdGVVcmwnKSE7XG4gICAgICBjb25zdCB0ZW1wbGF0ZVVybCA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKHRlbXBsYXRlVXJsRXhwcik7XG4gICAgICBpZiAodHlwZW9mIHRlbXBsYXRlVXJsICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgdGVtcGxhdGVVcmxFeHByLCB0ZW1wbGF0ZVVybCwgJ3RlbXBsYXRlVXJsIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc291cmNlVXJsID0gdGhpcy5yZXNvdXJjZUxvYWRlci5yZXNvbHZlKHRlbXBsYXRlVXJsLCBjb250YWluaW5nRmlsZSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaXNJbmxpbmU6IGZhbHNlLFxuICAgICAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgICAgICB0ZW1wbGF0ZVVybCxcbiAgICAgICAgICB0ZW1wbGF0ZVVybEV4cHJlc3Npb246IHRlbXBsYXRlVXJsRXhwcixcbiAgICAgICAgICByZXNvbHZlZFRlbXBsYXRlVXJsOiByZXNvdXJjZVVybCxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5tYWtlUmVzb3VyY2VOb3RGb3VuZEVycm9yKFxuICAgICAgICAgICAgdGVtcGxhdGVVcmwsIHRlbXBsYXRlVXJsRXhwciwgUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3MuVGVtcGxhdGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50LmhhcygndGVtcGxhdGUnKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaXNJbmxpbmU6IHRydWUsXG4gICAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICAgIGV4cHJlc3Npb246IGNvbXBvbmVudC5nZXQoJ3RlbXBsYXRlJykhLFxuICAgICAgICB0ZW1wbGF0ZVVybDogY29udGFpbmluZ0ZpbGUsXG4gICAgICAgIHJlc29sdmVkVGVtcGxhdGVVcmw6IGNvbnRhaW5pbmdGaWxlLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5DT01QT05FTlRfTUlTU0lOR19URU1QTEFURSwgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLFxuICAgICAgICAgICdjb21wb25lbnQgaXMgbWlzc2luZyBhIHRlbXBsYXRlJyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZUltcG9ydGVkRmlsZShpbXBvcnRlZEZpbGU6IEltcG9ydGVkRmlsZSwgZXhwcjogRXhwcmVzc2lvbiwgb3JpZ2luOiB0cy5Tb3VyY2VGaWxlKTpcbiAgICAgIHRzLlNvdXJjZUZpbGV8bnVsbCB7XG4gICAgLy8gSWYgYGltcG9ydGVkRmlsZWAgaXMgbm90ICd1bmtub3duJyB0aGVuIGl0IGFjY3VyYXRlbHkgcmVmbGVjdHMgdGhlIHNvdXJjZSBmaWxlIHRoYXQgaXNcbiAgICAvLyBiZWluZyBpbXBvcnRlZC5cbiAgICBpZiAoaW1wb3J0ZWRGaWxlICE9PSAndW5rbm93bicpIHtcbiAgICAgIHJldHVybiBpbXBvcnRlZEZpbGU7XG4gICAgfVxuXG4gICAgLy8gT3RoZXJ3aXNlIGBleHByYCBoYXMgdG8gYmUgaW5zcGVjdGVkIHRvIGRldGVybWluZSB0aGUgZmlsZSB0aGF0IGlzIGJlaW5nIGltcG9ydGVkLiBJZiBgZXhwcmBcbiAgICAvLyBpcyBub3QgYW4gYEV4dGVybmFsRXhwcmAgdGhlbiBpdCBkb2VzIG5vdCBjb3JyZXNwb25kIHdpdGggYW4gaW1wb3J0LCBzbyByZXR1cm4gbnVsbCBpbiB0aGF0XG4gICAgLy8gY2FzZS5cbiAgICBpZiAoIShleHByIGluc3RhbmNlb2YgRXh0ZXJuYWxFeHByKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gRmlndXJlIG91dCB3aGF0IGZpbGUgaXMgYmVpbmcgaW1wb3J0ZWQuXG4gICAgcmV0dXJuIHRoaXMubW9kdWxlUmVzb2x2ZXIucmVzb2x2ZU1vZHVsZShleHByLnZhbHVlLm1vZHVsZU5hbWUhLCBvcmlnaW4uZmlsZU5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHdoZXRoZXIgYWRkaW5nIGFuIGltcG9ydCBmcm9tIGBvcmlnaW5gIHRvIHRoZSBzb3VyY2UtZmlsZSBjb3JyZXNwb25kaW5nIHRvIGBleHByYCB3b3VsZFxuICAgKiBjcmVhdGUgYSBjeWNsaWMgaW1wb3J0LlxuICAgKlxuICAgKiBAcmV0dXJucyBhIGBDeWNsZWAgb2JqZWN0IGlmIGEgY3ljbGUgd291bGQgYmUgY3JlYXRlZCwgb3RoZXJ3aXNlIGBudWxsYC5cbiAgICovXG4gIHByaXZhdGUgX2NoZWNrRm9yQ3ljbGljSW1wb3J0KFxuICAgICAgaW1wb3J0ZWRGaWxlOiBJbXBvcnRlZEZpbGUsIGV4cHI6IEV4cHJlc3Npb24sIG9yaWdpbjogdHMuU291cmNlRmlsZSk6IEN5Y2xlfG51bGwge1xuICAgIGNvbnN0IGltcG9ydGVkID0gdGhpcy5fcmVzb2x2ZUltcG9ydGVkRmlsZShpbXBvcnRlZEZpbGUsIGV4cHIsIG9yaWdpbik7XG4gICAgaWYgKGltcG9ydGVkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgaW1wb3J0IGlzIGxlZ2FsLlxuICAgIHJldHVybiB0aGlzLmN5Y2xlQW5hbHl6ZXIud291bGRDcmVhdGVDeWNsZShvcmlnaW4sIGltcG9ydGVkKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlY29yZFN5bnRoZXRpY0ltcG9ydChcbiAgICAgIGltcG9ydGVkRmlsZTogSW1wb3J0ZWRGaWxlLCBleHByOiBFeHByZXNzaW9uLCBvcmlnaW46IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICBjb25zdCBpbXBvcnRlZCA9IHRoaXMuX3Jlc29sdmVJbXBvcnRlZEZpbGUoaW1wb3J0ZWRGaWxlLCBleHByLCBvcmlnaW4pO1xuICAgIGlmIChpbXBvcnRlZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3ljbGVBbmFseXplci5yZWNvcmRTeW50aGV0aWNJbXBvcnQob3JpZ2luLCBpbXBvcnRlZCk7XG4gIH1cblxuICBwcml2YXRlIG1ha2VSZXNvdXJjZU5vdEZvdW5kRXJyb3IoXG4gICAgICBmaWxlOiBzdHJpbmcsIG5vZGVGb3JFcnJvcjogdHMuTm9kZSxcbiAgICAgIHJlc291cmNlVHlwZTogUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3MpOiBGYXRhbERpYWdub3N0aWNFcnJvciB7XG4gICAgbGV0IGVycm9yVGV4dDogc3RyaW5nO1xuICAgIHN3aXRjaCAocmVzb3VyY2VUeXBlKSB7XG4gICAgICBjYXNlIFJlc291cmNlVHlwZUZvckRpYWdub3N0aWNzLlRlbXBsYXRlOlxuICAgICAgICBlcnJvclRleHQgPSBgQ291bGQgbm90IGZpbmQgdGVtcGxhdGUgZmlsZSAnJHtmaWxlfScuYDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFJlc291cmNlVHlwZUZvckRpYWdub3N0aWNzLlN0eWxlc2hlZXRGcm9tVGVtcGxhdGU6XG4gICAgICAgIGVycm9yVGV4dCA9IGBDb3VsZCBub3QgZmluZCBzdHlsZXNoZWV0IGZpbGUgJyR7ZmlsZX0nIGxpbmtlZCBmcm9tIHRoZSB0ZW1wbGF0ZS5gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgUmVzb3VyY2VUeXBlRm9yRGlhZ25vc3RpY3MuU3R5bGVzaGVldEZyb21EZWNvcmF0b3I6XG4gICAgICAgIGVycm9yVGV4dCA9IGBDb3VsZCBub3QgZmluZCBzdHlsZXNoZWV0IGZpbGUgJyR7ZmlsZX0nLmA7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgIEVycm9yQ29kZS5DT01QT05FTlRfUkVTT1VSQ0VfTk9UX0ZPVU5ELCBub2RlRm9yRXJyb3IsIGVycm9yVGV4dCk7XG4gIH1cblxuICBwcml2YXRlIF9leHRyYWN0VGVtcGxhdGVTdHlsZVVybHModGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZSk6IFN0eWxlVXJsTWV0YVtdIHtcbiAgICBpZiAodGVtcGxhdGUuc3R5bGVVcmxzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZUZvckVycm9yID0gZ2V0VGVtcGxhdGVEZWNsYXJhdGlvbk5vZGVGb3JFcnJvcih0ZW1wbGF0ZS5kZWNsYXJhdGlvbik7XG4gICAgcmV0dXJuIHRlbXBsYXRlLnN0eWxlVXJscy5tYXAoXG4gICAgICAgIHVybCA9PiAoe3VybCwgc291cmNlOiBSZXNvdXJjZVR5cGVGb3JEaWFnbm9zdGljcy5TdHlsZXNoZWV0RnJvbVRlbXBsYXRlLCBub2RlRm9yRXJyb3J9KSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVSYW5nZSh0ZW1wbGF0ZUV4cHI6IHRzLkV4cHJlc3Npb24pIHtcbiAgY29uc3Qgc3RhcnRQb3MgPSB0ZW1wbGF0ZUV4cHIuZ2V0U3RhcnQoKSArIDE7XG4gIGNvbnN0IHtsaW5lLCBjaGFyYWN0ZXJ9ID1cbiAgICAgIHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKHRlbXBsYXRlRXhwci5nZXRTb3VyY2VGaWxlKCksIHN0YXJ0UG9zKTtcbiAgcmV0dXJuIHtcbiAgICBzdGFydFBvcyxcbiAgICBzdGFydExpbmU6IGxpbmUsXG4gICAgc3RhcnRDb2w6IGNoYXJhY3RlcixcbiAgICBlbmRQb3M6IHRlbXBsYXRlRXhwci5nZXRFbmQoKSAtIDEsXG4gIH07XG59XG5cbi8qKiBEZXRlcm1pbmVzIGlmIHRoZSByZXN1bHQgb2YgYW4gZXZhbHVhdGlvbiBpcyBhIHN0cmluZyBhcnJheS4gKi9cbmZ1bmN0aW9uIGlzU3RyaW5nQXJyYXkocmVzb2x2ZWRWYWx1ZTogUmVzb2x2ZWRWYWx1ZSk6IHJlc29sdmVkVmFsdWUgaXMgc3RyaW5nW10ge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShyZXNvbHZlZFZhbHVlKSAmJiByZXNvbHZlZFZhbHVlLmV2ZXJ5KGVsZW0gPT4gdHlwZW9mIGVsZW0gPT09ICdzdHJpbmcnKTtcbn1cblxuLyoqIERldGVybWluZXMgdGhlIG5vZGUgdG8gdXNlIGZvciBkZWJ1Z2dpbmcgcHVycG9zZXMgZm9yIHRoZSBnaXZlbiBUZW1wbGF0ZURlY2xhcmF0aW9uLiAqL1xuZnVuY3Rpb24gZ2V0VGVtcGxhdGVEZWNsYXJhdGlvbk5vZGVGb3JFcnJvcihkZWNsYXJhdGlvbjogVGVtcGxhdGVEZWNsYXJhdGlvbik6IHRzLk5vZGUge1xuICAvLyBUT0RPKHphcmVuZCk6IENoYW5nZSB0aGlzIHRvIGlmL2Vsc2Ugd2hlbiB0aGF0IGlzIGNvbXBhdGlibGUgd2l0aCBnMy4gVGhpcyB1c2VzIGEgc3dpdGNoXG4gIC8vIGJlY2F1c2UgaWYvZWxzZSBmYWlscyB0byBjb21waWxlIG9uIGczLiBUaGF0IGlzIGJlY2F1c2UgZzMgY29tcGlsZXMgdGhpcyBpbiBub24tc3RyaWN0IG1vZGVcbiAgLy8gd2hlcmUgdHlwZSBpbmZlcmVuY2UgZG9lcyBub3Qgd29yayBjb3JyZWN0bHkuXG4gIHN3aXRjaCAoZGVjbGFyYXRpb24uaXNJbmxpbmUpIHtcbiAgICBjYXNlIHRydWU6XG4gICAgICByZXR1cm4gZGVjbGFyYXRpb24uZXhwcmVzc2lvbjtcbiAgICBjYXNlIGZhbHNlOlxuICAgICAgcmV0dXJuIGRlY2xhcmF0aW9uLnRlbXBsYXRlVXJsRXhwcmVzc2lvbjtcbiAgfVxufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSB0ZW1wbGF0ZSB3aGljaCB3YXMgZXh0cmFjdGVkIGR1cmluZyBwYXJzaW5nLlxuICpcbiAqIFRoaXMgY29udGFpbnMgdGhlIGFjdHVhbCBwYXJzZWQgdGVtcGxhdGUgYXMgd2VsbCBhcyBhbnkgbWV0YWRhdGEgY29sbGVjdGVkIGR1cmluZyBpdHMgcGFyc2luZyxcbiAqIHNvbWUgb2Ygd2hpY2ggbWlnaHQgYmUgdXNlZnVsIGZvciByZS1wYXJzaW5nIHRoZSB0ZW1wbGF0ZSB3aXRoIGRpZmZlcmVudCBvcHRpb25zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZENvbXBvbmVudFRlbXBsYXRlIGV4dGVuZHMgUGFyc2VkVGVtcGxhdGUge1xuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIEFTVCwgcGFyc2VkIGluIGEgbWFubmVyIHdoaWNoIHByZXNlcnZlcyBzb3VyY2UgbWFwIGluZm9ybWF0aW9uIGZvciBkaWFnbm9zdGljcy5cbiAgICpcbiAgICogTm90IHVzZWZ1bCBmb3IgZW1pdC5cbiAgICovXG4gIGRpYWdOb2RlczogVG1wbEFzdE5vZGVbXTtcblxuICAvKipcbiAgICogVGhlIGBQYXJzZVNvdXJjZUZpbGVgIGZvciB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBmaWxlOiBQYXJzZVNvdXJjZUZpbGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkVGVtcGxhdGVXaXRoU291cmNlIGV4dGVuZHMgUGFyc2VkQ29tcG9uZW50VGVtcGxhdGUge1xuICAvKiogVGhlIHN0cmluZyBjb250ZW50cyBvZiB0aGUgdGVtcGxhdGUuICovXG4gIGNvbnRlbnQ6IHN0cmluZztcbiAgc291cmNlTWFwcGluZzogVGVtcGxhdGVTb3VyY2VNYXBwaW5nO1xuICBkZWNsYXJhdGlvbjogVGVtcGxhdGVEZWNsYXJhdGlvbjtcbn1cblxuLyoqXG4gKiBDb21tb24gZmllbGRzIGV4dHJhY3RlZCBmcm9tIHRoZSBkZWNsYXJhdGlvbiBvZiBhIHRlbXBsYXRlLlxuICovXG5pbnRlcmZhY2UgQ29tbW9uVGVtcGxhdGVEZWNsYXJhdGlvbiB7XG4gIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW47XG4gIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWc7XG4gIHRlbXBsYXRlVXJsOiBzdHJpbmc7XG4gIHJlc29sdmVkVGVtcGxhdGVVcmw6IHN0cmluZztcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBleHRyYWN0ZWQgZnJvbSB0aGUgZGVjbGFyYXRpb24gb2YgYW4gaW5saW5lIHRlbXBsYXRlLlxuICovXG5pbnRlcmZhY2UgSW5saW5lVGVtcGxhdGVEZWNsYXJhdGlvbiBleHRlbmRzIENvbW1vblRlbXBsYXRlRGVjbGFyYXRpb24ge1xuICBpc0lubGluZTogdHJ1ZTtcbiAgZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbjtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBleHRyYWN0ZWQgZnJvbSB0aGUgZGVjbGFyYXRpb24gb2YgYW4gZXh0ZXJuYWwgdGVtcGxhdGUuXG4gKi9cbmludGVyZmFjZSBFeHRlcm5hbFRlbXBsYXRlRGVjbGFyYXRpb24gZXh0ZW5kcyBDb21tb25UZW1wbGF0ZURlY2xhcmF0aW9uIHtcbiAgaXNJbmxpbmU6IGZhbHNlO1xuICB0ZW1wbGF0ZVVybEV4cHJlc3Npb246IHRzLkV4cHJlc3Npb247XG59XG5cbi8qKlxuICogVGhlIGRlY2xhcmF0aW9uIG9mIGEgdGVtcGxhdGUgZXh0cmFjdGVkIGZyb20gYSBjb21wb25lbnQgZGVjb3JhdG9yLlxuICpcbiAqIFRoaXMgZGF0YSBpcyBleHRyYWN0ZWQgYW5kIHN0b3JlZCBzZXBhcmF0ZWx5IHRvIGZhY2lsaXRhdGUgcmUtaW50ZXJwcmV0aW5nIHRoZSB0ZW1wbGF0ZVxuICogZGVjbGFyYXRpb24gd2hlbmV2ZXIgdGhlIGNvbXBpbGVyIGlzIG5vdGlmaWVkIG9mIGEgY2hhbmdlIHRvIGEgdGVtcGxhdGUgZmlsZS4gV2l0aCB0aGlzXG4gKiBpbmZvcm1hdGlvbiwgYENvbXBvbmVudERlY29yYXRvckhhbmRsZXJgIGlzIGFibGUgdG8gcmUtcmVhZCB0aGUgdGVtcGxhdGUgYW5kIHVwZGF0ZSB0aGUgY29tcG9uZW50XG4gKiByZWNvcmQgd2l0aG91dCBuZWVkaW5nIHRvIHBhcnNlIHRoZSBvcmlnaW5hbCBkZWNvcmF0b3IgYWdhaW4uXG4gKi9cbnR5cGUgVGVtcGxhdGVEZWNsYXJhdGlvbiA9IElubGluZVRlbXBsYXRlRGVjbGFyYXRpb258RXh0ZXJuYWxUZW1wbGF0ZURlY2xhcmF0aW9uO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEgZGlhZ25vc3RpYyByZWxhdGVkIGluZm9ybWF0aW9uIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBhIHBvdGVudGlhbCBjeWNsaWMgaW1wb3J0IHBhdGguXG4gKi9cbmZ1bmN0aW9uIG1ha2VDeWNsaWNJbXBvcnRJbmZvKFxuICAgIHJlZjogUmVmZXJlbmNlLCB0eXBlOiBzdHJpbmcsIGN5Y2xlOiBDeWNsZSk6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24ge1xuICBjb25zdCBuYW1lID0gcmVmLmRlYnVnTmFtZSB8fCAnKHVua25vd24pJztcbiAgY29uc3QgcGF0aCA9IGN5Y2xlLmdldFBhdGgoKS5tYXAoc2YgPT4gc2YuZmlsZU5hbWUpLmpvaW4oJyAtPiAnKTtcbiAgY29uc3QgbWVzc2FnZSA9XG4gICAgICBgVGhlICR7dHlwZX0gJyR7bmFtZX0nIGlzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIGJ1dCBpbXBvcnRpbmcgaXQgd291bGQgY3JlYXRlIGEgY3ljbGU6IGA7XG4gIHJldHVybiBtYWtlUmVsYXRlZEluZm9ybWF0aW9uKHJlZi5ub2RlLCBtZXNzYWdlICsgcGF0aCk7XG59XG5cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhIHNlbGVjdG9yIGlzIGEgdmFsaWQgY3VzdG9tIGVsZW1lbnQgdGFnIG5hbWUuXG4gKiBCYXNlZCBsb29zZWx5IG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvdmFsaWRhdGUtZWxlbWVudC1uYW1lLlxuICovXG5mdW5jdGlvbiBjaGVja0N1c3RvbUVsZW1lbnRTZWxlY3RvckZvckVycm9ycyhzZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICAvLyBBdm9pZCBmbGFnZ2luZyBjb21wb25lbnRzIHdpdGggYW4gYXR0cmlidXRlIG9yIGNsYXNzIHNlbGVjdG9yLiBUaGlzIGlzbid0IGJ1bGxldHByb29mIHNpbmNlIGl0XG4gIC8vIHdvbid0IGNhdGNoIGNhc2VzIGxpa2UgYGZvb1tdYmFyYCwgYnV0IHdlIGRvbid0IG5lZWQgaXQgdG8gYmUuIFRoaXMgaXMgbWFpbmx5IHRvIGF2b2lkIGZsYWdnaW5nXG4gIC8vIHNvbWV0aGluZyBsaWtlIGBmb28tYmFyW2Jhel1gIGluY29ycmVjdGx5LlxuICBpZiAoc2VsZWN0b3IuaW5jbHVkZXMoJy4nKSB8fCAoc2VsZWN0b3IuaW5jbHVkZXMoJ1snKSAmJiBzZWxlY3Rvci5pbmNsdWRlcygnXScpKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaWYgKCEoL15bYS16XS8udGVzdChzZWxlY3RvcikpKSB7XG4gICAgcmV0dXJuICdTZWxlY3RvciBvZiBhIFNoYWRvd0RvbS1lbmNhcHN1bGF0ZWQgY29tcG9uZW50IG11c3Qgc3RhcnQgd2l0aCBhIGxvd2VyIGNhc2UgbGV0dGVyLic7XG4gIH1cblxuICBpZiAoL1tBLVpdLy50ZXN0KHNlbGVjdG9yKSkge1xuICAgIHJldHVybiAnU2VsZWN0b3Igb2YgYSBTaGFkb3dEb20tZW5jYXBzdWxhdGVkIGNvbXBvbmVudCBtdXN0IGFsbCBiZSBpbiBsb3dlciBjYXNlLic7XG4gIH1cblxuICBpZiAoIXNlbGVjdG9yLmluY2x1ZGVzKCctJykpIHtcbiAgICByZXR1cm4gJ1NlbGVjdG9yIG9mIGEgY29tcG9uZW50IHRoYXQgdXNlcyBWaWV3RW5jYXBzdWxhdGlvbi5TaGFkb3dEb20gbXVzdCBjb250YWluIGEgaHlwaGVuLic7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==