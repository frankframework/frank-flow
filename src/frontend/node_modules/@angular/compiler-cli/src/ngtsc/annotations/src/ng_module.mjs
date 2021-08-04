/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { compileClassMetadata, compileDeclareClassMetadata, compileDeclareInjectorFromMetadata, compileDeclareNgModuleFromMetadata, compileInjector, compileNgModule, CUSTOM_ELEMENTS_SCHEMA, ExternalExpr, FactoryTarget, InvokeFunctionExpr, LiteralArrayExpr, LiteralExpr, NO_ERRORS_SCHEMA, R3Identifiers, STRING_TYPE, WrappedNodeExpr } from '@angular/compiler';
import * as ts from 'typescript';
import { ErrorCode, FatalDiagnosticError, makeDiagnostic, makeRelatedInformation } from '../../diagnostics';
import { Reference } from '../../imports';
import { isArrayEqual, isReferenceEqual, isSymbolEqual, SemanticSymbol } from '../../incremental/semantic_graph';
import { PerfEvent } from '../../perf';
import { Decorator, isNamedClassDeclaration, reflectObjectLiteral, typeNodeToValueExpr } from '../../reflection';
import { HandlerPrecedence } from '../../transform';
import { getSourceFile } from '../../util/src/typescript';
import { createValueHasWrongTypeError, getProviderDiagnostics } from './diagnostics';
import { compileDeclareFactory, compileNgFactoryDefField } from './factory';
import { extractClassMetadata } from './metadata';
import { combineResolvers, findAngularDecorator, forwardRefResolver, getValidConstructorDependencies, isExpressionForwardReference, resolveProvidersRequiringFactory, toR3Reference, unwrapExpression, wrapFunctionExpressionsInParens, wrapTypeReference } from './util';
/**
 * Represents an Angular NgModule.
 */
export class NgModuleSymbol extends SemanticSymbol {
    constructor() {
        super(...arguments);
        this.remotelyScopedComponents = [];
    }
    isPublicApiAffected(previousSymbol) {
        if (!(previousSymbol instanceof NgModuleSymbol)) {
            return true;
        }
        // NgModules don't have a public API that could affect emit of Angular decorated classes.
        return false;
    }
    isEmitAffected(previousSymbol) {
        if (!(previousSymbol instanceof NgModuleSymbol)) {
            return true;
        }
        // compare our remotelyScopedComponents to the previous symbol
        if (previousSymbol.remotelyScopedComponents.length !== this.remotelyScopedComponents.length) {
            return true;
        }
        for (const currEntry of this.remotelyScopedComponents) {
            const prevEntry = previousSymbol.remotelyScopedComponents.find(prevEntry => {
                return isSymbolEqual(prevEntry.component, currEntry.component);
            });
            if (prevEntry === undefined) {
                // No previous entry was found, which means that this component became remotely scoped and
                // hence this NgModule needs to be re-emitted.
                return true;
            }
            if (!isArrayEqual(currEntry.usedDirectives, prevEntry.usedDirectives, isReferenceEqual)) {
                // The list of used directives or their order has changed. Since this NgModule emits
                // references to the list of used directives, it should be re-emitted to update this list.
                // Note: the NgModule does not have to be re-emitted when any of the directives has had
                // their public API changed, as the NgModule only emits a reference to the symbol by its
                // name. Therefore, testing for symbol equality is sufficient.
                return true;
            }
            if (!isArrayEqual(currEntry.usedPipes, prevEntry.usedPipes, isReferenceEqual)) {
                return true;
            }
        }
        return false;
    }
    isTypeCheckApiAffected(previousSymbol) {
        if (!(previousSymbol instanceof NgModuleSymbol)) {
            return true;
        }
        return false;
    }
    addRemotelyScopedComponent(component, usedDirectives, usedPipes) {
        this.remotelyScopedComponents.push({ component, usedDirectives, usedPipes });
    }
}
/**
 * Compiles @NgModule annotations to ngModuleDef fields.
 */
export class NgModuleDecoratorHandler {
    constructor(reflector, evaluator, metaReader, metaRegistry, scopeRegistry, referencesRegistry, isCore, routeAnalyzer, refEmitter, factoryTracker, annotateForClosureCompiler, injectableRegistry, perf, localeId) {
        this.reflector = reflector;
        this.evaluator = evaluator;
        this.metaReader = metaReader;
        this.metaRegistry = metaRegistry;
        this.scopeRegistry = scopeRegistry;
        this.referencesRegistry = referencesRegistry;
        this.isCore = isCore;
        this.routeAnalyzer = routeAnalyzer;
        this.refEmitter = refEmitter;
        this.factoryTracker = factoryTracker;
        this.annotateForClosureCompiler = annotateForClosureCompiler;
        this.injectableRegistry = injectableRegistry;
        this.perf = perf;
        this.localeId = localeId;
        this.precedence = HandlerPrecedence.PRIMARY;
        this.name = NgModuleDecoratorHandler.name;
    }
    detect(node, decorators) {
        if (!decorators) {
            return undefined;
        }
        const decorator = findAngularDecorator(decorators, 'NgModule', this.isCore);
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
    }
    analyze(node, decorator) {
        this.perf.eventCount(PerfEvent.AnalyzeNgModule);
        const name = node.name.text;
        if (decorator.args === null || decorator.args.length > 1) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, Decorator.nodeForError(decorator), `Incorrect number of arguments to @NgModule decorator`);
        }
        // @NgModule can be invoked without arguments. In case it is, pretend as if a blank object
        // literal was specified. This simplifies the code below.
        const meta = decorator.args.length === 1 ? unwrapExpression(decorator.args[0]) :
            ts.createObjectLiteral([]);
        if (!ts.isObjectLiteralExpression(meta)) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARG_NOT_LITERAL, meta, '@NgModule argument must be an object literal');
        }
        const ngModule = reflectObjectLiteral(meta);
        if (ngModule.has('jit')) {
            // The only allowed value is true, so there's no need to expand further.
            return {};
        }
        const moduleResolvers = combineResolvers([
            ref => this._extractModuleFromModuleWithProvidersFn(ref.node),
            forwardRefResolver,
        ]);
        const diagnostics = [];
        // Extract the module declarations, imports, and exports.
        let declarationRefs = [];
        let rawDeclarations = null;
        if (ngModule.has('declarations')) {
            rawDeclarations = ngModule.get('declarations');
            const declarationMeta = this.evaluator.evaluate(rawDeclarations, forwardRefResolver);
            declarationRefs =
                this.resolveTypeList(rawDeclarations, declarationMeta, name, 'declarations');
            // Look through the declarations to make sure they're all a part of the current compilation.
            for (const ref of declarationRefs) {
                if (ref.node.getSourceFile().isDeclarationFile) {
                    const errorNode = ref.getOriginForDiagnostics(rawDeclarations);
                    diagnostics.push(makeDiagnostic(ErrorCode.NGMODULE_INVALID_DECLARATION, errorNode, `Cannot declare '${ref.node.name
                        .text}' in an NgModule as it's not a part of the current compilation.`, [makeRelatedInformation(ref.node.name, `'${ref.node.name.text}' is declared here.`)]));
                }
            }
        }
        if (diagnostics.length > 0) {
            return { diagnostics };
        }
        let importRefs = [];
        let rawImports = null;
        if (ngModule.has('imports')) {
            rawImports = ngModule.get('imports');
            const importsMeta = this.evaluator.evaluate(rawImports, moduleResolvers);
            importRefs = this.resolveTypeList(rawImports, importsMeta, name, 'imports');
        }
        let exportRefs = [];
        let rawExports = null;
        if (ngModule.has('exports')) {
            rawExports = ngModule.get('exports');
            const exportsMeta = this.evaluator.evaluate(rawExports, moduleResolvers);
            exportRefs = this.resolveTypeList(rawExports, exportsMeta, name, 'exports');
            this.referencesRegistry.add(node, ...exportRefs);
        }
        let bootstrapRefs = [];
        if (ngModule.has('bootstrap')) {
            const expr = ngModule.get('bootstrap');
            const bootstrapMeta = this.evaluator.evaluate(expr, forwardRefResolver);
            bootstrapRefs = this.resolveTypeList(expr, bootstrapMeta, name, 'bootstrap');
        }
        const schemas = [];
        if (ngModule.has('schemas')) {
            const rawExpr = ngModule.get('schemas');
            const result = this.evaluator.evaluate(rawExpr);
            if (!Array.isArray(result)) {
                throw createValueHasWrongTypeError(rawExpr, result, `NgModule.schemas must be an array`);
            }
            for (const schemaRef of result) {
                if (!(schemaRef instanceof Reference)) {
                    throw createValueHasWrongTypeError(rawExpr, result, 'NgModule.schemas must be an array of schemas');
                }
                const id = schemaRef.getIdentityIn(schemaRef.node.getSourceFile());
                if (id === null || schemaRef.ownedByModuleGuess !== '@angular/core') {
                    throw createValueHasWrongTypeError(rawExpr, result, 'NgModule.schemas must be an array of schemas');
                }
                // Since `id` is the `ts.Identifer` within the schema ref's declaration file, it's safe to
                // use `id.text` here to figure out which schema is in use. Even if the actual reference was
                // renamed when the user imported it, these names will match.
                switch (id.text) {
                    case 'CUSTOM_ELEMENTS_SCHEMA':
                        schemas.push(CUSTOM_ELEMENTS_SCHEMA);
                        break;
                    case 'NO_ERRORS_SCHEMA':
                        schemas.push(NO_ERRORS_SCHEMA);
                        break;
                    default:
                        throw createValueHasWrongTypeError(rawExpr, schemaRef, `'${schemaRef.debugName}' is not a valid NgModule schema`);
                }
            }
        }
        const id = ngModule.has('id') ? new WrappedNodeExpr(ngModule.get('id')) : null;
        const valueContext = node.getSourceFile();
        let typeContext = valueContext;
        const typeNode = this.reflector.getDtsDeclaration(node);
        if (typeNode !== null) {
            typeContext = typeNode.getSourceFile();
        }
        const bootstrap = bootstrapRefs.map(bootstrap => this._toR3Reference(bootstrap, valueContext, typeContext));
        const declarations = declarationRefs.map(decl => this._toR3Reference(decl, valueContext, typeContext));
        const imports = importRefs.map(imp => this._toR3Reference(imp, valueContext, typeContext));
        const exports = exportRefs.map(exp => this._toR3Reference(exp, valueContext, typeContext));
        const isForwardReference = (ref) => isExpressionForwardReference(ref.value, node.name, valueContext);
        const containsForwardDecls = bootstrap.some(isForwardReference) ||
            declarations.some(isForwardReference) || imports.some(isForwardReference) ||
            exports.some(isForwardReference);
        const type = wrapTypeReference(this.reflector, node);
        const internalType = new WrappedNodeExpr(this.reflector.getInternalNameOfClass(node));
        const adjacentType = new WrappedNodeExpr(this.reflector.getAdjacentNameOfClass(node));
        const ngModuleMetadata = {
            type,
            internalType,
            adjacentType,
            bootstrap,
            declarations,
            exports,
            imports,
            containsForwardDecls,
            id,
            emitInline: false,
            // TODO: to be implemented as a part of FW-1004.
            schemas: [],
        };
        const rawProviders = ngModule.has('providers') ? ngModule.get('providers') : null;
        const wrapperProviders = rawProviders !== null ?
            new WrappedNodeExpr(this.annotateForClosureCompiler ? wrapFunctionExpressionsInParens(rawProviders) :
                rawProviders) :
            null;
        // At this point, only add the module's imports as the injectors' imports. Any exported modules
        // are added during `resolve`, as we need scope information to be able to filter out directives
        // and pipes from the module exports.
        const injectorImports = [];
        if (ngModule.has('imports')) {
            injectorImports.push(new WrappedNodeExpr(ngModule.get('imports')));
        }
        if (this.routeAnalyzer !== null) {
            this.routeAnalyzer.add(node.getSourceFile(), name, rawImports, rawExports, rawProviders);
        }
        const injectorMetadata = {
            name,
            type,
            internalType,
            providers: wrapperProviders,
            imports: injectorImports,
        };
        const factoryMetadata = {
            name,
            type,
            internalType,
            typeArgumentCount: 0,
            deps: getValidConstructorDependencies(node, this.reflector, this.isCore),
            target: FactoryTarget.NgModule,
        };
        return {
            analysis: {
                id,
                schemas,
                mod: ngModuleMetadata,
                inj: injectorMetadata,
                fac: factoryMetadata,
                declarations: declarationRefs,
                rawDeclarations,
                imports: importRefs,
                exports: exportRefs,
                providers: rawProviders,
                providersRequiringFactory: rawProviders ?
                    resolveProvidersRequiringFactory(rawProviders, this.reflector, this.evaluator) :
                    null,
                classMetadata: extractClassMetadata(node, this.reflector, this.isCore, this.annotateForClosureCompiler),
                factorySymbolName: node.name.text,
            },
        };
    }
    symbol(node) {
        return new NgModuleSymbol(node);
    }
    register(node, analysis) {
        // Register this module's information with the LocalModuleScopeRegistry. This ensures that
        // during the compile() phase, the module's metadata is available for selector scope
        // computation.
        this.metaRegistry.registerNgModuleMetadata({
            ref: new Reference(node),
            schemas: analysis.schemas,
            declarations: analysis.declarations,
            imports: analysis.imports,
            exports: analysis.exports,
            rawDeclarations: analysis.rawDeclarations,
        });
        if (this.factoryTracker !== null) {
            this.factoryTracker.track(node.getSourceFile(), {
                name: analysis.factorySymbolName,
                hasId: analysis.id !== null,
            });
        }
        this.injectableRegistry.registerInjectable(node);
    }
    resolve(node, analysis) {
        const scope = this.scopeRegistry.getScopeOfModule(node);
        const diagnostics = [];
        const scopeDiagnostics = this.scopeRegistry.getDiagnosticsOfModule(node);
        if (scopeDiagnostics !== null) {
            diagnostics.push(...scopeDiagnostics);
        }
        if (analysis.providersRequiringFactory !== null) {
            const providerDiagnostics = getProviderDiagnostics(analysis.providersRequiringFactory, analysis.providers, this.injectableRegistry);
            diagnostics.push(...providerDiagnostics);
        }
        const data = {
            injectorImports: [],
        };
        if (scope !== null && !scope.compilation.isPoisoned) {
            // Using the scope information, extend the injector's imports using the modules that are
            // specified as module exports.
            const context = getSourceFile(node);
            for (const exportRef of analysis.exports) {
                if (isNgModule(exportRef.node, scope.compilation)) {
                    data.injectorImports.push(this.refEmitter.emit(exportRef, context).expression);
                }
            }
            for (const decl of analysis.declarations) {
                const metadata = this.metaReader.getDirectiveMetadata(decl);
                if (metadata !== null && metadata.selector === null) {
                    throw new FatalDiagnosticError(ErrorCode.DIRECTIVE_MISSING_SELECTOR, decl.node, `Directive ${decl.node.name.text} has no selector, please add it!`);
                }
            }
        }
        if (diagnostics.length > 0) {
            return { diagnostics };
        }
        if (scope === null || scope.compilation.isPoisoned || scope.exported.isPoisoned ||
            scope.reexports === null) {
            return { data };
        }
        else {
            return {
                data,
                reexports: scope.reexports,
            };
        }
    }
    compileFull(node, { inj, mod, fac, classMetadata, declarations }, { injectorImports }) {
        const factoryFn = compileNgFactoryDefField(fac);
        const ngInjectorDef = compileInjector(this.mergeInjectorImports(inj, injectorImports));
        const ngModuleDef = compileNgModule(mod);
        const statements = ngModuleDef.statements;
        const metadata = classMetadata !== null ? compileClassMetadata(classMetadata) : null;
        this.insertMetadataStatement(statements, metadata);
        this.appendRemoteScopingStatements(statements, node, declarations);
        return this.compileNgModule(factoryFn, ngInjectorDef, ngModuleDef);
    }
    compilePartial(node, { inj, fac, mod, classMetadata }, { injectorImports }) {
        const factoryFn = compileDeclareFactory(fac);
        const injectorDef = compileDeclareInjectorFromMetadata(this.mergeInjectorImports(inj, injectorImports));
        const ngModuleDef = compileDeclareNgModuleFromMetadata(mod);
        const metadata = classMetadata !== null ? compileDeclareClassMetadata(classMetadata) : null;
        this.insertMetadataStatement(ngModuleDef.statements, metadata);
        // NOTE: no remote scoping required as this is banned in partial compilation.
        return this.compileNgModule(factoryFn, injectorDef, ngModuleDef);
    }
    /**
     *  Merge the injector imports (which are 'exports' that were later found to be NgModules)
     *  computed during resolution with the ones from analysis.
     */
    mergeInjectorImports(inj, injectorImports) {
        return Object.assign(Object.assign({}, inj), { imports: [...inj.imports, ...injectorImports] });
    }
    /**
     * Add class metadata statements, if provided, to the `ngModuleStatements`.
     */
    insertMetadataStatement(ngModuleStatements, metadata) {
        if (metadata !== null) {
            ngModuleStatements.unshift(metadata.toStmt());
        }
    }
    /**
     * Add remote scoping statements, as needed, to the `ngModuleStatements`.
     */
    appendRemoteScopingStatements(ngModuleStatements, node, declarations) {
        const context = getSourceFile(node);
        for (const decl of declarations) {
            const remoteScope = this.scopeRegistry.getRemoteScope(decl.node);
            if (remoteScope !== null) {
                const directives = remoteScope.directives.map(directive => this.refEmitter.emit(directive, context).expression);
                const pipes = remoteScope.pipes.map(pipe => this.refEmitter.emit(pipe, context).expression);
                const directiveArray = new LiteralArrayExpr(directives);
                const pipesArray = new LiteralArrayExpr(pipes);
                const declExpr = this.refEmitter.emit(decl, context).expression;
                const setComponentScope = new ExternalExpr(R3Identifiers.setComponentScope);
                const callExpr = new InvokeFunctionExpr(setComponentScope, [declExpr, directiveArray, pipesArray]);
                ngModuleStatements.push(callExpr.toStmt());
            }
        }
    }
    compileNgModule(factoryFn, injectorDef, ngModuleDef) {
        const res = [
            factoryFn,
            {
                name: 'ɵmod',
                initializer: ngModuleDef.expression,
                statements: ngModuleDef.statements,
                type: ngModuleDef.type,
            },
            {
                name: 'ɵinj',
                initializer: injectorDef.expression,
                statements: injectorDef.statements,
                type: injectorDef.type,
            },
        ];
        if (this.localeId) {
            // QUESTION: can this stuff be removed?
            res.push({
                name: 'ɵloc',
                initializer: new LiteralExpr(this.localeId),
                statements: [],
                type: STRING_TYPE
            });
        }
        return res;
    }
    _toR3Reference(valueRef, valueContext, typeContext) {
        if (valueRef.hasOwningModuleGuess) {
            return toR3Reference(valueRef, valueRef, valueContext, valueContext, this.refEmitter);
        }
        else {
            let typeRef = valueRef;
            let typeNode = this.reflector.getDtsDeclaration(typeRef.node);
            if (typeNode !== null && isNamedClassDeclaration(typeNode)) {
                typeRef = new Reference(typeNode);
            }
            return toR3Reference(valueRef, typeRef, valueContext, typeContext, this.refEmitter);
        }
    }
    /**
     * Given a `FunctionDeclaration`, `MethodDeclaration` or `FunctionExpression`, check if it is
     * typed as a `ModuleWithProviders` and return an expression referencing the module if available.
     */
    _extractModuleFromModuleWithProvidersFn(node) {
        const type = node.type || null;
        return type &&
            (this._reflectModuleFromTypeParam(type, node) || this._reflectModuleFromLiteralType(type));
    }
    /**
     * Retrieve an `NgModule` identifier (T) from the specified `type`, if it is of the form:
     * `ModuleWithProviders<T>`
     * @param type The type to reflect on.
     * @returns the identifier of the NgModule type if found, or null otherwise.
     */
    _reflectModuleFromTypeParam(type, node) {
        // Examine the type of the function to see if it's a ModuleWithProviders reference.
        if (!ts.isTypeReferenceNode(type)) {
            return null;
        }
        const typeName = type &&
            (ts.isIdentifier(type.typeName) && type.typeName ||
                ts.isQualifiedName(type.typeName) && type.typeName.right) ||
            null;
        if (typeName === null) {
            return null;
        }
        // Look at the type itself to see where it comes from.
        const id = this.reflector.getImportOfIdentifier(typeName);
        // If it's not named ModuleWithProviders, bail.
        if (id === null || id.name !== 'ModuleWithProviders') {
            return null;
        }
        // If it's not from @angular/core, bail.
        if (!this.isCore && id.from !== '@angular/core') {
            return null;
        }
        // If there's no type parameter specified, bail.
        if (type.typeArguments === undefined || type.typeArguments.length !== 1) {
            const parent = ts.isMethodDeclaration(node) && ts.isClassDeclaration(node.parent) ? node.parent : null;
            const symbolName = (parent && parent.name ? parent.name.getText() + '.' : '') +
                (node.name ? node.name.getText() : 'anonymous');
            throw new FatalDiagnosticError(ErrorCode.NGMODULE_MODULE_WITH_PROVIDERS_MISSING_GENERIC, type, `${symbolName} returns a ModuleWithProviders type without a generic type argument. ` +
                `Please add a generic type argument to the ModuleWithProviders type. If this ` +
                `occurrence is in library code you don't control, please contact the library authors.`);
        }
        const arg = type.typeArguments[0];
        return typeNodeToValueExpr(arg);
    }
    /**
     * Retrieve an `NgModule` identifier (T) from the specified `type`, if it is of the form:
     * `A|B|{ngModule: T}|C`.
     * @param type The type to reflect on.
     * @returns the identifier of the NgModule type if found, or null otherwise.
     */
    _reflectModuleFromLiteralType(type) {
        if (!ts.isIntersectionTypeNode(type)) {
            return null;
        }
        for (const t of type.types) {
            if (ts.isTypeLiteralNode(t)) {
                for (const m of t.members) {
                    const ngModuleType = ts.isPropertySignature(m) && ts.isIdentifier(m.name) &&
                        m.name.text === 'ngModule' && m.type ||
                        null;
                    const ngModuleExpression = ngModuleType && typeNodeToValueExpr(ngModuleType);
                    if (ngModuleExpression) {
                        return ngModuleExpression;
                    }
                }
            }
        }
        return null;
    }
    // Verify that a "Declaration" reference is a `ClassDeclaration` reference.
    isClassDeclarationReference(ref) {
        return this.reflector.isClass(ref.node);
    }
    /**
     * Compute a list of `Reference`s from a resolved metadata value.
     */
    resolveTypeList(expr, resolvedList, className, arrayName) {
        const refList = [];
        if (!Array.isArray(resolvedList)) {
            throw createValueHasWrongTypeError(expr, resolvedList, `Expected array when reading the NgModule.${arrayName} of ${className}`);
        }
        resolvedList.forEach((entry, idx) => {
            // Unwrap ModuleWithProviders for modules that are locally declared (and thus static
            // resolution was able to descend into the function and return an object literal, a Map).
            if (entry instanceof Map && entry.has('ngModule')) {
                entry = entry.get('ngModule');
            }
            if (Array.isArray(entry)) {
                // Recurse into nested arrays.
                refList.push(...this.resolveTypeList(expr, entry, className, arrayName));
            }
            else if (entry instanceof Reference) {
                if (!this.isClassDeclarationReference(entry)) {
                    throw createValueHasWrongTypeError(entry.node, entry, `Value at position ${idx} in the NgModule.${arrayName} of ${className} is not a class`);
                }
                refList.push(entry);
            }
            else {
                // TODO(alxhub): Produce a better diagnostic here - the array index may be an inner array.
                throw createValueHasWrongTypeError(expr, entry, `Value at position ${idx} in the NgModule.${arrayName} of ${className} is not a reference`);
            }
        });
        return refList;
    }
}
function isNgModule(node, compilation) {
    return !compilation.directives.some(directive => directive.ref.node === node) &&
        !compilation.pipes.some(pipe => pipe.ref.node === node);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvbmdfbW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxvQkFBb0IsRUFBRSwyQkFBMkIsRUFBRSxrQ0FBa0MsRUFBRSxrQ0FBa0MsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLHNCQUFzQixFQUFjLFlBQVksRUFBRSxhQUFhLEVBQXFCLGtCQUFrQixFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBNEQsYUFBYSxFQUFrRixXQUFXLEVBQUUsZUFBZSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDOWdCLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxTQUFTLEVBQUUsb0JBQW9CLEVBQUUsY0FBYyxFQUFFLHNCQUFzQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDMUcsT0FBTyxFQUFDLFNBQVMsRUFBbUIsTUFBTSxlQUFlLENBQUM7QUFDMUQsT0FBTyxFQUFDLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQXFCLGNBQWMsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBR2xJLE9BQU8sRUFBQyxTQUFTLEVBQWUsTUFBTSxZQUFZLENBQUM7QUFDbkQsT0FBTyxFQUFtQixTQUFTLEVBQUUsdUJBQXVCLEVBQWtCLG9CQUFvQixFQUFFLG1CQUFtQixFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFJakosT0FBTyxFQUFnRSxpQkFBaUIsRUFBZ0IsTUFBTSxpQkFBaUIsQ0FBQztBQUNoSSxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFeEQsT0FBTyxFQUFDLDRCQUE0QixFQUFFLHNCQUFzQixFQUFDLE1BQU0sZUFBZSxDQUFD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QUMsQ0FBQyxDQUFDO2FBQzFFO2lCQUFNLElBQUksS0FBSyxZQUFZLFNBQVMsRUFBRTtnQkFDckMsSUFBSSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLENBQUMsRUFBRTtvQkFDNUMsTUFBTSw0QkFBNEIsQ0FDOUIsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQ2pCLHFCQUFxQixHQUFHLG9CQUFvQixTQUFTLE9BQ2pELFNBQVMsaUJBQWlCLENBQUMsQ0FBQztpQkFDckM7Z0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNyQjtpQkFBTTtnQkFDTCwwRkFBMEY7Z0JBQzFGLE1BQU0sNEJBQTRCLENBQzlCLElBQUksRUFBRSxLQUFLLEVBQ1gscUJBQXFCLEdBQUcsb0JBQW9CLFNBQVMsT0FDakQsU0FBUyxxQkFBcUIsQ0FBQyxDQUFDO2FBQ3pDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0NBQ0Y7QUFFRCxTQUFTLFVBQVUsQ0FBQyxJQUFzQixFQUFFLFdBQXNCO0lBQ2hFLE9BQU8sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQztRQUN6RSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7QUFDOUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXBpbGVDbGFzc01ldGFkYXRhLCBjb21waWxlRGVjbGFyZUNsYXNzTWV0YWRhdGEsIGNvbXBpbGVEZWNsYXJlSW5qZWN0b3JGcm9tTWV0YWRhdGEsIGNvbXBpbGVEZWNsYXJlTmdNb2R1bGVGcm9tTWV0YWRhdGEsIGNvbXBpbGVJbmplY3RvciwgY29tcGlsZU5nTW9kdWxlLCBDVVNUT01fRUxFTUVOVFNfU0NIRU1BLCBFeHByZXNzaW9uLCBFeHRlcm5hbEV4cHIsIEZhY3RvcnlUYXJnZXQsIElkZW50aWZpZXJzIGFzIFIzLCBJbnZva2VGdW5jdGlvbkV4cHIsIExpdGVyYWxBcnJheUV4cHIsIExpdGVyYWxFeHByLCBOT19FUlJPUlNfU0NIRU1BLCBSM0NsYXNzTWV0YWRhdGEsIFIzQ29tcGlsZWRFeHByZXNzaW9uLCBSM0ZhY3RvcnlNZXRhZGF0YSwgUjNJZGVudGlmaWVycywgUjNJbmplY3Rvck1ldGFkYXRhLCBSM05nTW9kdWxlTWV0YWRhdGEsIFIzUmVmZXJlbmNlLCBTY2hlbWFNZXRhZGF0YSwgU3RhdGVtZW50LCBTVFJJTkdfVFlQRSwgV3JhcHBlZE5vZGVFeHByfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFcnJvckNvZGUsIEZhdGFsRGlhZ25vc3RpY0Vycm9yLCBtYWtlRGlhZ25vc3RpYywgbWFrZVJlbGF0ZWRJbmZvcm1hdGlvbn0gZnJvbSAnLi4vLi4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtSZWZlcmVuY2UsIFJlZmVyZW5jZUVtaXR0ZXJ9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtpc0FycmF5RXF1YWwsIGlzUmVmZXJlbmNlRXF1YWwsIGlzU3ltYm9sRXF1YWwsIFNlbWFudGljUmVmZXJlbmNlLCBTZW1hbnRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vaW5jcmVtZW50YWwvc2VtYW50aWNfZ3JhcGgnO1xuaW1wb3J0IHtJbmplY3RhYmxlQ2xhc3NSZWdpc3RyeSwgTWV0YWRhdGFSZWFkZXIsIE1ldGFkYXRhUmVnaXN0cnl9IGZyb20gJy4uLy4uL21ldGFkYXRhJztcbmltcG9ydCB7UGFydGlhbEV2YWx1YXRvciwgUmVzb2x2ZWRWYWx1ZX0gZnJvbSAnLi4vLi4vcGFydGlhbF9ldmFsdWF0b3InO1xuaW1wb3J0IHtQZXJmRXZlbnQsIFBlcmZSZWNvcmRlcn0gZnJvbSAnLi4vLi4vcGVyZic7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIERlY29yYXRvciwgaXNOYW1lZENsYXNzRGVjbGFyYXRpb24sIFJlZmxlY3Rpb25Ib3N0LCByZWZsZWN0T2JqZWN0TGl0ZXJhbCwgdHlwZU5vZGVUb1ZhbHVlRXhwcn0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge05nTW9kdWxlUm91dGVBbmFseXplcn0gZnJvbSAnLi4vLi4vcm91dGluZyc7XG5pbXBvcnQge0xvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeSwgU2NvcGVEYXRhfSBmcm9tICcuLi8uLi9zY29wZSc7XG5pbXBvcnQge0ZhY3RvcnlUcmFja2VyfSBmcm9tICcuLi8uLi9zaGltcy9hcGknO1xuaW1wb3J0IHtBbmFseXNpc091dHB1dCwgQ29tcGlsZVJlc3VsdCwgRGVjb3JhdG9ySGFuZGxlciwgRGV0ZWN0UmVzdWx0LCBIYW5kbGVyUHJlY2VkZW5jZSwgUmVzb2x2ZVJlc3VsdH0gZnJvbSAnLi4vLi4vdHJhbnNmb3JtJztcbmltcG9ydCB7Z2V0U291cmNlRmlsZX0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Y3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvciwgZ2V0UHJvdmlkZXJEaWFnbm9zdGljc30gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge2NvbXBpbGVEZWNsYXJlRmFjdG9yeSwgY29tcGlsZU5nRmFjdG9yeURlZkZpZWxkfSBmcm9tICcuL2ZhY3RvcnknO1xuaW1wb3J0IHtleHRyYWN0Q2xhc3NNZXRhZGF0YX0gZnJvbSAnLi9tZXRhZGF0YSc7XG5pbXBvcnQge1JlZmVyZW5jZXNSZWdpc3RyeX0gZnJvbSAnLi9yZWZlcmVuY2VzX3JlZ2lzdHJ5JztcbmltcG9ydCB7Y29tYmluZVJlc29sdmVycywgZmluZEFuZ3VsYXJEZWNvcmF0b3IsIGZvcndhcmRSZWZSZXNvbHZlciwgZ2V0VmFsaWRDb25zdHJ1Y3RvckRlcGVuZGVuY2llcywgaXNFeHByZXNzaW9uRm9yd2FyZFJlZmVyZW5jZSwgcmVzb2x2ZVByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnksIHRvUjNSZWZlcmVuY2UsIHVud3JhcEV4cHJlc3Npb24sIHdyYXBGdW5jdGlvbkV4cHJlc3Npb25zSW5QYXJlbnMsIHdyYXBUeXBlUmVmZXJlbmNlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5nTW9kdWxlQW5hbHlzaXMge1xuICBtb2Q6IFIzTmdNb2R1bGVNZXRhZGF0YTtcbiAgaW5qOiBSM0luamVjdG9yTWV0YWRhdGE7XG4gIGZhYzogUjNGYWN0b3J5TWV0YWRhdGE7XG4gIGNsYXNzTWV0YWRhdGE6IFIzQ2xhc3NNZXRhZGF0YXxudWxsO1xuICBkZWNsYXJhdGlvbnM6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPltdO1xuICByYXdEZWNsYXJhdGlvbnM6IHRzLkV4cHJlc3Npb258bnVsbDtcbiAgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXTtcbiAgaW1wb3J0czogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+W107XG4gIGV4cG9ydHM6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPltdO1xuICBpZDogRXhwcmVzc2lvbnxudWxsO1xuICBmYWN0b3J5U3ltYm9sTmFtZTogc3RyaW5nO1xuICBwcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5OiBTZXQ8UmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+PnxudWxsO1xuICBwcm92aWRlcnM6IHRzLkV4cHJlc3Npb258bnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOZ01vZHVsZVJlc29sdXRpb24ge1xuICBpbmplY3RvckltcG9ydHM6IEV4cHJlc3Npb25bXTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIEFuZ3VsYXIgTmdNb2R1bGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ01vZHVsZVN5bWJvbCBleHRlbmRzIFNlbWFudGljU3ltYm9sIHtcbiAgcHJpdmF0ZSByZW1vdGVseVNjb3BlZENvbXBvbmVudHM6IHtcbiAgICBjb21wb25lbnQ6IFNlbWFudGljU3ltYm9sLFxuICAgIHVzZWREaXJlY3RpdmVzOiBTZW1hbnRpY1JlZmVyZW5jZVtdLFxuICAgIHVzZWRQaXBlczogU2VtYW50aWNSZWZlcmVuY2VbXVxuICB9W10gPSBbXTtcblxuICBpc1B1YmxpY0FwaUFmZmVjdGVkKHByZXZpb3VzU3ltYm9sOiBTZW1hbnRpY1N5bWJvbCk6IGJvb2xlYW4ge1xuICAgIGlmICghKHByZXZpb3VzU3ltYm9sIGluc3RhbmNlb2YgTmdNb2R1bGVTeW1ib2wpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBOZ01vZHVsZXMgZG9uJ3QgaGF2ZSBhIHB1YmxpYyBBUEkgdGhhdCBjb3VsZCBhZmZlY3QgZW1pdCBvZiBBbmd1bGFyIGRlY29yYXRlZCBjbGFzc2VzLlxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzRW1pdEFmZmVjdGVkKHByZXZpb3VzU3ltYm9sOiBTZW1hbnRpY1N5bWJvbCk6IGJvb2xlYW4ge1xuICAgIGlmICghKHByZXZpb3VzU3ltYm9sIGluc3RhbmNlb2YgTmdNb2R1bGVTeW1ib2wpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBjb21wYXJlIG91ciByZW1vdGVseVNjb3BlZENvbXBvbmVudHMgdG8gdGhlIHByZXZpb3VzIHN5bWJvbFxuICAgIGlmIChwcmV2aW91c1N5bWJvbC5yZW1vdGVseVNjb3BlZENvbXBvbmVudHMubGVuZ3RoICE9PSB0aGlzLnJlbW90ZWx5U2NvcGVkQ29tcG9uZW50cy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY3VyckVudHJ5IG9mIHRoaXMucmVtb3RlbHlTY29wZWRDb21wb25lbnRzKSB7XG4gICAgICBjb25zdCBwcmV2RW50cnkgPSBwcmV2aW91c1N5bWJvbC5yZW1vdGVseVNjb3BlZENvbXBvbmVudHMuZmluZChwcmV2RW50cnkgPT4ge1xuICAgICAgICByZXR1cm4gaXNTeW1ib2xFcXVhbChwcmV2RW50cnkuY29tcG9uZW50LCBjdXJyRW50cnkuY29tcG9uZW50KTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocHJldkVudHJ5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gTm8gcHJldmlvdXMgZW50cnkgd2FzIGZvdW5kLCB3aGljaCBtZWFucyB0aGF0IHRoaXMgY29tcG9uZW50IGJlY2FtZSByZW1vdGVseSBzY29wZWQgYW5kXG4gICAgICAgIC8vIGhlbmNlIHRoaXMgTmdNb2R1bGUgbmVlZHMgdG8gYmUgcmUtZW1pdHRlZC5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghaXNBcnJheUVxdWFsKGN1cnJFbnRyeS51c2VkRGlyZWN0aXZlcywgcHJldkVudHJ5LnVzZWREaXJlY3RpdmVzLCBpc1JlZmVyZW5jZUVxdWFsKSkge1xuICAgICAgICAvLyBUaGUgbGlzdCBvZiB1c2VkIGRpcmVjdGl2ZXMgb3IgdGhlaXIgb3JkZXIgaGFzIGNoYW5nZWQuIFNpbmNlIHRoaXMgTmdNb2R1bGUgZW1pdHNcbiAgICAgICAgLy8gcmVmZXJlbmNlcyB0byB0aGUgbGlzdCBvZiB1c2VkIGRpcmVjdGl2ZXMsIGl0IHNob3VsZCBiZSByZS1lbWl0dGVkIHRvIHVwZGF0ZSB0aGlzIGxpc3QuXG4gICAgICAgIC8vIE5vdGU6IHRoZSBOZ01vZHVsZSBkb2VzIG5vdCBoYXZlIHRvIGJlIHJlLWVtaXR0ZWQgd2hlbiBhbnkgb2YgdGhlIGRpcmVjdGl2ZXMgaGFzIGhhZFxuICAgICAgICAvLyB0aGVpciBwdWJsaWMgQVBJIGNoYW5nZWQsIGFzIHRoZSBOZ01vZHVsZSBvbmx5IGVtaXRzIGEgcmVmZXJlbmNlIHRvIHRoZSBzeW1ib2wgYnkgaXRzXG4gICAgICAgIC8vIG5hbWUuIFRoZXJlZm9yZSwgdGVzdGluZyBmb3Igc3ltYm9sIGVxdWFsaXR5IGlzIHN1ZmZpY2llbnQuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzQXJyYXlFcXVhbChjdXJyRW50cnkudXNlZFBpcGVzLCBwcmV2RW50cnkudXNlZFBpcGVzLCBpc1JlZmVyZW5jZUVxdWFsKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaXNUeXBlQ2hlY2tBcGlBZmZlY3RlZChwcmV2aW91c1N5bWJvbDogU2VtYW50aWNTeW1ib2wpOiBib29sZWFuIHtcbiAgICBpZiAoIShwcmV2aW91c1N5bWJvbCBpbnN0YW5jZW9mIE5nTW9kdWxlU3ltYm9sKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYWRkUmVtb3RlbHlTY29wZWRDb21wb25lbnQoXG4gICAgICBjb21wb25lbnQ6IFNlbWFudGljU3ltYm9sLCB1c2VkRGlyZWN0aXZlczogU2VtYW50aWNSZWZlcmVuY2VbXSxcbiAgICAgIHVzZWRQaXBlczogU2VtYW50aWNSZWZlcmVuY2VbXSk6IHZvaWQge1xuICAgIHRoaXMucmVtb3RlbHlTY29wZWRDb21wb25lbnRzLnB1c2goe2NvbXBvbmVudCwgdXNlZERpcmVjdGl2ZXMsIHVzZWRQaXBlc30pO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZXMgQE5nTW9kdWxlIGFubm90YXRpb25zIHRvIG5nTW9kdWxlRGVmIGZpZWxkcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE5nTW9kdWxlRGVjb3JhdG9ySGFuZGxlciBpbXBsZW1lbnRzXG4gICAgRGVjb3JhdG9ySGFuZGxlcjxEZWNvcmF0b3IsIE5nTW9kdWxlQW5hbHlzaXMsIE5nTW9kdWxlU3ltYm9sLCBOZ01vZHVsZVJlc29sdXRpb24+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIHByaXZhdGUgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yLFxuICAgICAgcHJpdmF0ZSBtZXRhUmVhZGVyOiBNZXRhZGF0YVJlYWRlciwgcHJpdmF0ZSBtZXRhUmVnaXN0cnk6IE1ldGFkYXRhUmVnaXN0cnksXG4gICAgICBwcml2YXRlIHNjb3BlUmVnaXN0cnk6IExvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeSxcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlc1JlZ2lzdHJ5OiBSZWZlcmVuY2VzUmVnaXN0cnksIHByaXZhdGUgaXNDb3JlOiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSByb3V0ZUFuYWx5emVyOiBOZ01vZHVsZVJvdXRlQW5hbHl6ZXJ8bnVsbCwgcHJpdmF0ZSByZWZFbWl0dGVyOiBSZWZlcmVuY2VFbWl0dGVyLFxuICAgICAgcHJpdmF0ZSBmYWN0b3J5VHJhY2tlcjogRmFjdG9yeVRyYWNrZXJ8bnVsbCwgcHJpdmF0ZSBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcjogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgaW5qZWN0YWJsZVJlZ2lzdHJ5OiBJbmplY3RhYmxlQ2xhc3NSZWdpc3RyeSwgcHJpdmF0ZSBwZXJmOiBQZXJmUmVjb3JkZXIsXG4gICAgICBwcml2YXRlIGxvY2FsZUlkPzogc3RyaW5nKSB7fVxuXG4gIHJlYWRvbmx5IHByZWNlZGVuY2UgPSBIYW5kbGVyUHJlY2VkZW5jZS5QUklNQVJZO1xuICByZWFkb25seSBuYW1lID0gTmdNb2R1bGVEZWNvcmF0b3JIYW5kbGVyLm5hbWU7XG5cbiAgZGV0ZWN0KG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGRlY29yYXRvcnM6IERlY29yYXRvcltdfG51bGwpOiBEZXRlY3RSZXN1bHQ8RGVjb3JhdG9yPnx1bmRlZmluZWQge1xuICAgIGlmICghZGVjb3JhdG9ycykge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgY29uc3QgZGVjb3JhdG9yID0gZmluZEFuZ3VsYXJEZWNvcmF0b3IoZGVjb3JhdG9ycywgJ05nTW9kdWxlJywgdGhpcy5pc0NvcmUpO1xuICAgIGlmIChkZWNvcmF0b3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJpZ2dlcjogZGVjb3JhdG9yLm5vZGUsXG4gICAgICAgIGRlY29yYXRvcjogZGVjb3JhdG9yLFxuICAgICAgICBtZXRhZGF0YTogZGVjb3JhdG9yLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICBhbmFseXplKG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGRlY29yYXRvcjogUmVhZG9ubHk8RGVjb3JhdG9yPik6XG4gICAgICBBbmFseXNpc091dHB1dDxOZ01vZHVsZUFuYWx5c2lzPiB7XG4gICAgdGhpcy5wZXJmLmV2ZW50Q291bnQoUGVyZkV2ZW50LkFuYWx5emVOZ01vZHVsZSk7XG5cbiAgICBjb25zdCBuYW1lID0gbm9kZS5uYW1lLnRleHQ7XG4gICAgaWYgKGRlY29yYXRvci5hcmdzID09PSBudWxsIHx8IGRlY29yYXRvci5hcmdzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSSVRZX1dST05HLCBEZWNvcmF0b3Iubm9kZUZvckVycm9yKGRlY29yYXRvciksXG4gICAgICAgICAgYEluY29ycmVjdCBudW1iZXIgb2YgYXJndW1lbnRzIHRvIEBOZ01vZHVsZSBkZWNvcmF0b3JgKTtcbiAgICB9XG5cbiAgICAvLyBATmdNb2R1bGUgY2FuIGJlIGludm9rZWQgd2l0aG91dCBhcmd1bWVudHMuIEluIGNhc2UgaXQgaXMsIHByZXRlbmQgYXMgaWYgYSBibGFuayBvYmplY3RcbiAgICAvLyBsaXRlcmFsIHdhcyBzcGVjaWZpZWQuIFRoaXMgc2ltcGxpZmllcyB0aGUgY29kZSBiZWxvdy5cbiAgICBjb25zdCBtZXRhID0gZGVjb3JhdG9yLmFyZ3MubGVuZ3RoID09PSAxID8gdW53cmFwRXhwcmVzc2lvbihkZWNvcmF0b3IuYXJnc1swXSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5jcmVhdGVPYmplY3RMaXRlcmFsKFtdKTtcblxuICAgIGlmICghdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihtZXRhKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJHX05PVF9MSVRFUkFMLCBtZXRhLFxuICAgICAgICAgICdATmdNb2R1bGUgYXJndW1lbnQgbXVzdCBiZSBhbiBvYmplY3QgbGl0ZXJhbCcpO1xuICAgIH1cbiAgICBjb25zdCBuZ01vZHVsZSA9IHJlZmxlY3RPYmplY3RMaXRlcmFsKG1ldGEpO1xuXG4gICAgaWYgKG5nTW9kdWxlLmhhcygnaml0JykpIHtcbiAgICAgIC8vIFRoZSBvbmx5IGFsbG93ZWQgdmFsdWUgaXMgdHJ1ZSwgc28gdGhlcmUncyBubyBuZWVkIHRvIGV4cGFuZCBmdXJ0aGVyLlxuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIGNvbnN0IG1vZHVsZVJlc29sdmVycyA9IGNvbWJpbmVSZXNvbHZlcnMoW1xuICAgICAgcmVmID0+IHRoaXMuX2V4dHJhY3RNb2R1bGVGcm9tTW9kdWxlV2l0aFByb3ZpZGVyc0ZuKHJlZi5ub2RlKSxcbiAgICAgIGZvcndhcmRSZWZSZXNvbHZlcixcbiAgICBdKTtcblxuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAgIC8vIEV4dHJhY3QgdGhlIG1vZHVsZSBkZWNsYXJhdGlvbnMsIGltcG9ydHMsIGFuZCBleHBvcnRzLlxuICAgIGxldCBkZWNsYXJhdGlvblJlZnM6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPltdID0gW107XG4gICAgbGV0IHJhd0RlY2xhcmF0aW9uczogdHMuRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAobmdNb2R1bGUuaGFzKCdkZWNsYXJhdGlvbnMnKSkge1xuICAgICAgcmF3RGVjbGFyYXRpb25zID0gbmdNb2R1bGUuZ2V0KCdkZWNsYXJhdGlvbnMnKSE7XG4gICAgICBjb25zdCBkZWNsYXJhdGlvbk1ldGEgPSB0aGlzLmV2YWx1YXRvci5ldmFsdWF0ZShyYXdEZWNsYXJhdGlvbnMsIGZvcndhcmRSZWZSZXNvbHZlcik7XG4gICAgICBkZWNsYXJhdGlvblJlZnMgPVxuICAgICAgICAgIHRoaXMucmVzb2x2ZVR5cGVMaXN0KHJhd0RlY2xhcmF0aW9ucywgZGVjbGFyYXRpb25NZXRhLCBuYW1lLCAnZGVjbGFyYXRpb25zJyk7XG5cbiAgICAgIC8vIExvb2sgdGhyb3VnaCB0aGUgZGVjbGFyYXRpb25zIHRvIG1ha2Ugc3VyZSB0aGV5J3JlIGFsbCBhIHBhcnQgb2YgdGhlIGN1cnJlbnQgY29tcGlsYXRpb24uXG4gICAgICBmb3IgKGNvbnN0IHJlZiBvZiBkZWNsYXJhdGlvblJlZnMpIHtcbiAgICAgICAgaWYgKHJlZi5ub2RlLmdldFNvdXJjZUZpbGUoKS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICAgIGNvbnN0IGVycm9yTm9kZTogdHMuRXhwcmVzc2lvbiA9IHJlZi5nZXRPcmlnaW5Gb3JEaWFnbm9zdGljcyhyYXdEZWNsYXJhdGlvbnMpO1xuXG4gICAgICAgICAgZGlhZ25vc3RpY3MucHVzaChtYWtlRGlhZ25vc3RpYyhcbiAgICAgICAgICAgICAgRXJyb3JDb2RlLk5HTU9EVUxFX0lOVkFMSURfREVDTEFSQVRJT04sIGVycm9yTm9kZSxcbiAgICAgICAgICAgICAgYENhbm5vdCBkZWNsYXJlICcke1xuICAgICAgICAgICAgICAgICAgcmVmLm5vZGUubmFtZVxuICAgICAgICAgICAgICAgICAgICAgIC50ZXh0fScgaW4gYW4gTmdNb2R1bGUgYXMgaXQncyBub3QgYSBwYXJ0IG9mIHRoZSBjdXJyZW50IGNvbXBpbGF0aW9uLmAsXG4gICAgICAgICAgICAgIFttYWtlUmVsYXRlZEluZm9ybWF0aW9uKFxuICAgICAgICAgICAgICAgICAgcmVmLm5vZGUubmFtZSwgYCcke3JlZi5ub2RlLm5hbWUudGV4dH0nIGlzIGRlY2xhcmVkIGhlcmUuYCldKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHtkaWFnbm9zdGljc307XG4gICAgfVxuXG4gICAgbGV0IGltcG9ydFJlZnM6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPltdID0gW107XG4gICAgbGV0IHJhd0ltcG9ydHM6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKG5nTW9kdWxlLmhhcygnaW1wb3J0cycpKSB7XG4gICAgICByYXdJbXBvcnRzID0gbmdNb2R1bGUuZ2V0KCdpbXBvcnRzJykhO1xuICAgICAgY29uc3QgaW1wb3J0c01ldGEgPSB0aGlzLmV2YWx1YXRvci5ldmFsdWF0ZShyYXdJbXBvcnRzLCBtb2R1bGVSZXNvbHZlcnMpO1xuICAgICAgaW1wb3J0UmVmcyA9IHRoaXMucmVzb2x2ZVR5cGVMaXN0KHJhd0ltcG9ydHMsIGltcG9ydHNNZXRhLCBuYW1lLCAnaW1wb3J0cycpO1xuICAgIH1cbiAgICBsZXQgZXhwb3J0UmVmczogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+W10gPSBbXTtcbiAgICBsZXQgcmF3RXhwb3J0czogdHMuRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAobmdNb2R1bGUuaGFzKCdleHBvcnRzJykpIHtcbiAgICAgIHJhd0V4cG9ydHMgPSBuZ01vZHVsZS5nZXQoJ2V4cG9ydHMnKSE7XG4gICAgICBjb25zdCBleHBvcnRzTWV0YSA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKHJhd0V4cG9ydHMsIG1vZHVsZVJlc29sdmVycyk7XG4gICAgICBleHBvcnRSZWZzID0gdGhpcy5yZXNvbHZlVHlwZUxpc3QocmF3RXhwb3J0cywgZXhwb3J0c01ldGEsIG5hbWUsICdleHBvcnRzJyk7XG4gICAgICB0aGlzLnJlZmVyZW5jZXNSZWdpc3RyeS5hZGQobm9kZSwgLi4uZXhwb3J0UmVmcyk7XG4gICAgfVxuICAgIGxldCBib290c3RyYXBSZWZzOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj5bXSA9IFtdO1xuICAgIGlmIChuZ01vZHVsZS5oYXMoJ2Jvb3RzdHJhcCcpKSB7XG4gICAgICBjb25zdCBleHByID0gbmdNb2R1bGUuZ2V0KCdib290c3RyYXAnKSE7XG4gICAgICBjb25zdCBib290c3RyYXBNZXRhID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoZXhwciwgZm9yd2FyZFJlZlJlc29sdmVyKTtcbiAgICAgIGJvb3RzdHJhcFJlZnMgPSB0aGlzLnJlc29sdmVUeXBlTGlzdChleHByLCBib290c3RyYXBNZXRhLCBuYW1lLCAnYm9vdHN0cmFwJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSA9IFtdO1xuICAgIGlmIChuZ01vZHVsZS5oYXMoJ3NjaGVtYXMnKSkge1xuICAgICAgY29uc3QgcmF3RXhwciA9IG5nTW9kdWxlLmdldCgnc2NoZW1hcycpITtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKHJhd0V4cHIpO1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcbiAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihyYXdFeHByLCByZXN1bHQsIGBOZ01vZHVsZS5zY2hlbWFzIG11c3QgYmUgYW4gYXJyYXlgKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBzY2hlbWFSZWYgb2YgcmVzdWx0KSB7XG4gICAgICAgIGlmICghKHNjaGVtYVJlZiBpbnN0YW5jZW9mIFJlZmVyZW5jZSkpIHtcbiAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICByYXdFeHByLCByZXN1bHQsICdOZ01vZHVsZS5zY2hlbWFzIG11c3QgYmUgYW4gYXJyYXkgb2Ygc2NoZW1hcycpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGlkID0gc2NoZW1hUmVmLmdldElkZW50aXR5SW4oc2NoZW1hUmVmLm5vZGUuZ2V0U291cmNlRmlsZSgpKTtcbiAgICAgICAgaWYgKGlkID09PSBudWxsIHx8IHNjaGVtYVJlZi5vd25lZEJ5TW9kdWxlR3Vlc3MgIT09ICdAYW5ndWxhci9jb3JlJykge1xuICAgICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICAgIHJhd0V4cHIsIHJlc3VsdCwgJ05nTW9kdWxlLnNjaGVtYXMgbXVzdCBiZSBhbiBhcnJheSBvZiBzY2hlbWFzJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2luY2UgYGlkYCBpcyB0aGUgYHRzLklkZW50aWZlcmAgd2l0aGluIHRoZSBzY2hlbWEgcmVmJ3MgZGVjbGFyYXRpb24gZmlsZSwgaXQncyBzYWZlIHRvXG4gICAgICAgIC8vIHVzZSBgaWQudGV4dGAgaGVyZSB0byBmaWd1cmUgb3V0IHdoaWNoIHNjaGVtYSBpcyBpbiB1c2UuIEV2ZW4gaWYgdGhlIGFjdHVhbCByZWZlcmVuY2Ugd2FzXG4gICAgICAgIC8vIHJlbmFtZWQgd2hlbiB0aGUgdXNlciBpbXBvcnRlZCBpdCwgdGhlc2UgbmFtZXMgd2lsbCBtYXRjaC5cbiAgICAgICAgc3dpdGNoIChpZC50ZXh0KSB7XG4gICAgICAgICAgY2FzZSAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQSc6XG4gICAgICAgICAgICBzY2hlbWFzLnB1c2goQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdOT19FUlJPUlNfU0NIRU1BJzpcbiAgICAgICAgICAgIHNjaGVtYXMucHVzaChOT19FUlJPUlNfU0NIRU1BKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgIHJhd0V4cHIsIHNjaGVtYVJlZiwgYCcke3NjaGVtYVJlZi5kZWJ1Z05hbWV9JyBpcyBub3QgYSB2YWxpZCBOZ01vZHVsZSBzY2hlbWFgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGlkOiBFeHByZXNzaW9ufG51bGwgPVxuICAgICAgICBuZ01vZHVsZS5oYXMoJ2lkJykgPyBuZXcgV3JhcHBlZE5vZGVFeHByKG5nTW9kdWxlLmdldCgnaWQnKSEpIDogbnVsbDtcbiAgICBjb25zdCB2YWx1ZUNvbnRleHQgPSBub2RlLmdldFNvdXJjZUZpbGUoKTtcblxuICAgIGxldCB0eXBlQ29udGV4dCA9IHZhbHVlQ29udGV4dDtcbiAgICBjb25zdCB0eXBlTm9kZSA9IHRoaXMucmVmbGVjdG9yLmdldER0c0RlY2xhcmF0aW9uKG5vZGUpO1xuICAgIGlmICh0eXBlTm9kZSAhPT0gbnVsbCkge1xuICAgICAgdHlwZUNvbnRleHQgPSB0eXBlTm9kZS5nZXRTb3VyY2VGaWxlKCk7XG4gICAgfVxuXG4gICAgY29uc3QgYm9vdHN0cmFwID1cbiAgICAgICAgYm9vdHN0cmFwUmVmcy5tYXAoYm9vdHN0cmFwID0+IHRoaXMuX3RvUjNSZWZlcmVuY2UoYm9vdHN0cmFwLCB2YWx1ZUNvbnRleHQsIHR5cGVDb250ZXh0KSk7XG4gICAgY29uc3QgZGVjbGFyYXRpb25zID1cbiAgICAgICAgZGVjbGFyYXRpb25SZWZzLm1hcChkZWNsID0+IHRoaXMuX3RvUjNSZWZlcmVuY2UoZGVjbCwgdmFsdWVDb250ZXh0LCB0eXBlQ29udGV4dCkpO1xuICAgIGNvbnN0IGltcG9ydHMgPSBpbXBvcnRSZWZzLm1hcChpbXAgPT4gdGhpcy5fdG9SM1JlZmVyZW5jZShpbXAsIHZhbHVlQ29udGV4dCwgdHlwZUNvbnRleHQpKTtcbiAgICBjb25zdCBleHBvcnRzID0gZXhwb3J0UmVmcy5tYXAoZXhwID0+IHRoaXMuX3RvUjNSZWZlcmVuY2UoZXhwLCB2YWx1ZUNvbnRleHQsIHR5cGVDb250ZXh0KSk7XG5cbiAgICBjb25zdCBpc0ZvcndhcmRSZWZlcmVuY2UgPSAocmVmOiBSM1JlZmVyZW5jZSkgPT5cbiAgICAgICAgaXNFeHByZXNzaW9uRm9yd2FyZFJlZmVyZW5jZShyZWYudmFsdWUsIG5vZGUubmFtZSEsIHZhbHVlQ29udGV4dCk7XG4gICAgY29uc3QgY29udGFpbnNGb3J3YXJkRGVjbHMgPSBib290c3RyYXAuc29tZShpc0ZvcndhcmRSZWZlcmVuY2UpIHx8XG4gICAgICAgIGRlY2xhcmF0aW9ucy5zb21lKGlzRm9yd2FyZFJlZmVyZW5jZSkgfHwgaW1wb3J0cy5zb21lKGlzRm9yd2FyZFJlZmVyZW5jZSkgfHxcbiAgICAgICAgZXhwb3J0cy5zb21lKGlzRm9yd2FyZFJlZmVyZW5jZSk7XG5cbiAgICBjb25zdCB0eXBlID0gd3JhcFR5cGVSZWZlcmVuY2UodGhpcy5yZWZsZWN0b3IsIG5vZGUpO1xuICAgIGNvbnN0IGludGVybmFsVHlwZSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIodGhpcy5yZWZsZWN0b3IuZ2V0SW50ZXJuYWxOYW1lT2ZDbGFzcyhub2RlKSk7XG4gICAgY29uc3QgYWRqYWNlbnRUeXBlID0gbmV3IFdyYXBwZWROb2RlRXhwcih0aGlzLnJlZmxlY3Rvci5nZXRBZGphY2VudE5hbWVPZkNsYXNzKG5vZGUpKTtcblxuICAgIGNvbnN0IG5nTW9kdWxlTWV0YWRhdGE6IFIzTmdNb2R1bGVNZXRhZGF0YSA9IHtcbiAgICAgIHR5cGUsXG4gICAgICBpbnRlcm5hbFR5cGUsXG4gICAgICBhZGphY2VudFR5cGUsXG4gICAgICBib290c3RyYXAsXG4gICAgICBkZWNsYXJhdGlvbnMsXG4gICAgICBleHBvcnRzLFxuICAgICAgaW1wb3J0cyxcbiAgICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzLFxuICAgICAgaWQsXG4gICAgICBlbWl0SW5saW5lOiBmYWxzZSxcbiAgICAgIC8vIFRPRE86IHRvIGJlIGltcGxlbWVudGVkIGFzIGEgcGFydCBvZiBGVy0xMDA0LlxuICAgICAgc2NoZW1hczogW10sXG4gICAgfTtcblxuICAgIGNvbnN0IHJhd1Byb3ZpZGVycyA9IG5nTW9kdWxlLmhhcygncHJvdmlkZXJzJykgPyBuZ01vZHVsZS5nZXQoJ3Byb3ZpZGVycycpISA6IG51bGw7XG4gICAgY29uc3Qgd3JhcHBlclByb3ZpZGVycyA9IHJhd1Byb3ZpZGVycyAhPT0gbnVsbCA/XG4gICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIoXG4gICAgICAgICAgICB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID8gd3JhcEZ1bmN0aW9uRXhwcmVzc2lvbnNJblBhcmVucyhyYXdQcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByYXdQcm92aWRlcnMpIDpcbiAgICAgICAgbnVsbDtcblxuICAgIC8vIEF0IHRoaXMgcG9pbnQsIG9ubHkgYWRkIHRoZSBtb2R1bGUncyBpbXBvcnRzIGFzIHRoZSBpbmplY3RvcnMnIGltcG9ydHMuIEFueSBleHBvcnRlZCBtb2R1bGVzXG4gICAgLy8gYXJlIGFkZGVkIGR1cmluZyBgcmVzb2x2ZWAsIGFzIHdlIG5lZWQgc2NvcGUgaW5mb3JtYXRpb24gdG8gYmUgYWJsZSB0byBmaWx0ZXIgb3V0IGRpcmVjdGl2ZXNcbiAgICAvLyBhbmQgcGlwZXMgZnJvbSB0aGUgbW9kdWxlIGV4cG9ydHMuXG4gICAgY29uc3QgaW5qZWN0b3JJbXBvcnRzOiBXcmFwcGVkTm9kZUV4cHI8dHMuRXhwcmVzc2lvbj5bXSA9IFtdO1xuICAgIGlmIChuZ01vZHVsZS5oYXMoJ2ltcG9ydHMnKSkge1xuICAgICAgaW5qZWN0b3JJbXBvcnRzLnB1c2gobmV3IFdyYXBwZWROb2RlRXhwcihuZ01vZHVsZS5nZXQoJ2ltcG9ydHMnKSEpKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5yb3V0ZUFuYWx5emVyICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnJvdXRlQW5hbHl6ZXIuYWRkKG5vZGUuZ2V0U291cmNlRmlsZSgpLCBuYW1lLCByYXdJbXBvcnRzLCByYXdFeHBvcnRzLCByYXdQcm92aWRlcnMpO1xuICAgIH1cblxuICAgIGNvbnN0IGluamVjdG9yTWV0YWRhdGE6IFIzSW5qZWN0b3JNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWUsXG4gICAgICB0eXBlLFxuICAgICAgaW50ZXJuYWxUeXBlLFxuICAgICAgcHJvdmlkZXJzOiB3cmFwcGVyUHJvdmlkZXJzLFxuICAgICAgaW1wb3J0czogaW5qZWN0b3JJbXBvcnRzLFxuICAgIH07XG5cbiAgICBjb25zdCBmYWN0b3J5TWV0YWRhdGE6IFIzRmFjdG9yeU1ldGFkYXRhID0ge1xuICAgICAgbmFtZSxcbiAgICAgIHR5cGUsXG4gICAgICBpbnRlcm5hbFR5cGUsXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgIGRlcHM6IGdldFZhbGlkQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMobm9kZSwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuaXNDb3JlKSxcbiAgICAgIHRhcmdldDogRmFjdG9yeVRhcmdldC5OZ01vZHVsZSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFuYWx5c2lzOiB7XG4gICAgICAgIGlkLFxuICAgICAgICBzY2hlbWFzLFxuICAgICAgICBtb2Q6IG5nTW9kdWxlTWV0YWRhdGEsXG4gICAgICAgIGluajogaW5qZWN0b3JNZXRhZGF0YSxcbiAgICAgICAgZmFjOiBmYWN0b3J5TWV0YWRhdGEsXG4gICAgICAgIGRlY2xhcmF0aW9uczogZGVjbGFyYXRpb25SZWZzLFxuICAgICAgICByYXdEZWNsYXJhdGlvbnMsXG4gICAgICAgIGltcG9ydHM6IGltcG9ydFJlZnMsXG4gICAgICAgIGV4cG9ydHM6IGV4cG9ydFJlZnMsXG4gICAgICAgIHByb3ZpZGVyczogcmF3UHJvdmlkZXJzLFxuICAgICAgICBwcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5OiByYXdQcm92aWRlcnMgP1xuICAgICAgICAgICAgcmVzb2x2ZVByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkocmF3UHJvdmlkZXJzLCB0aGlzLnJlZmxlY3RvciwgdGhpcy5ldmFsdWF0b3IpIDpcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgIGNsYXNzTWV0YWRhdGE6IGV4dHJhY3RDbGFzc01ldGFkYXRhKFxuICAgICAgICAgICAgbm9kZSwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuaXNDb3JlLCB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSxcbiAgICAgICAgZmFjdG9yeVN5bWJvbE5hbWU6IG5vZGUubmFtZS50ZXh0LFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgc3ltYm9sKG5vZGU6IENsYXNzRGVjbGFyYXRpb24pOiBOZ01vZHVsZVN5bWJvbCB7XG4gICAgcmV0dXJuIG5ldyBOZ01vZHVsZVN5bWJvbChub2RlKTtcbiAgfVxuXG4gIHJlZ2lzdGVyKG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBOZ01vZHVsZUFuYWx5c2lzKTogdm9pZCB7XG4gICAgLy8gUmVnaXN0ZXIgdGhpcyBtb2R1bGUncyBpbmZvcm1hdGlvbiB3aXRoIHRoZSBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnkuIFRoaXMgZW5zdXJlcyB0aGF0XG4gICAgLy8gZHVyaW5nIHRoZSBjb21waWxlKCkgcGhhc2UsIHRoZSBtb2R1bGUncyBtZXRhZGF0YSBpcyBhdmFpbGFibGUgZm9yIHNlbGVjdG9yIHNjb3BlXG4gICAgLy8gY29tcHV0YXRpb24uXG4gICAgdGhpcy5tZXRhUmVnaXN0cnkucmVnaXN0ZXJOZ01vZHVsZU1ldGFkYXRhKHtcbiAgICAgIHJlZjogbmV3IFJlZmVyZW5jZShub2RlKSxcbiAgICAgIHNjaGVtYXM6IGFuYWx5c2lzLnNjaGVtYXMsXG4gICAgICBkZWNsYXJhdGlvbnM6IGFuYWx5c2lzLmRlY2xhcmF0aW9ucyxcbiAgICAgIGltcG9ydHM6IGFuYWx5c2lzLmltcG9ydHMsXG4gICAgICBleHBvcnRzOiBhbmFseXNpcy5leHBvcnRzLFxuICAgICAgcmF3RGVjbGFyYXRpb25zOiBhbmFseXNpcy5yYXdEZWNsYXJhdGlvbnMsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5mYWN0b3J5VHJhY2tlciAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5mYWN0b3J5VHJhY2tlci50cmFjayhub2RlLmdldFNvdXJjZUZpbGUoKSwge1xuICAgICAgICBuYW1lOiBhbmFseXNpcy5mYWN0b3J5U3ltYm9sTmFtZSxcbiAgICAgICAgaGFzSWQ6IGFuYWx5c2lzLmlkICE9PSBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbmplY3RhYmxlUmVnaXN0cnkucmVnaXN0ZXJJbmplY3RhYmxlKG5vZGUpO1xuICB9XG5cbiAgcmVzb2x2ZShub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogUmVhZG9ubHk8TmdNb2R1bGVBbmFseXNpcz4pOlxuICAgICAgUmVzb2x2ZVJlc3VsdDxOZ01vZHVsZVJlc29sdXRpb24+IHtcbiAgICBjb25zdCBzY29wZSA9IHRoaXMuc2NvcGVSZWdpc3RyeS5nZXRTY29wZU9mTW9kdWxlKG5vZGUpO1xuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAgIGNvbnN0IHNjb3BlRGlhZ25vc3RpY3MgPSB0aGlzLnNjb3BlUmVnaXN0cnkuZ2V0RGlhZ25vc3RpY3NPZk1vZHVsZShub2RlKTtcbiAgICBpZiAoc2NvcGVEaWFnbm9zdGljcyAhPT0gbnVsbCkge1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi5zY29wZURpYWdub3N0aWNzKTtcbiAgICB9XG5cbiAgICBpZiAoYW5hbHlzaXMucHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcHJvdmlkZXJEaWFnbm9zdGljcyA9IGdldFByb3ZpZGVyRGlhZ25vc3RpY3MoXG4gICAgICAgICAgYW5hbHlzaXMucHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSwgYW5hbHlzaXMucHJvdmlkZXJzISwgdGhpcy5pbmplY3RhYmxlUmVnaXN0cnkpO1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi5wcm92aWRlckRpYWdub3N0aWNzKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhOiBOZ01vZHVsZVJlc29sdXRpb24gPSB7XG4gICAgICBpbmplY3RvckltcG9ydHM6IFtdLFxuICAgIH07XG5cbiAgICBpZiAoc2NvcGUgIT09IG51bGwgJiYgIXNjb3BlLmNvbXBpbGF0aW9uLmlzUG9pc29uZWQpIHtcbiAgICAgIC8vIFVzaW5nIHRoZSBzY29wZSBpbmZvcm1hdGlvbiwgZXh0ZW5kIHRoZSBpbmplY3RvcidzIGltcG9ydHMgdXNpbmcgdGhlIG1vZHVsZXMgdGhhdCBhcmVcbiAgICAgIC8vIHNwZWNpZmllZCBhcyBtb2R1bGUgZXhwb3J0cy5cbiAgICAgIGNvbnN0IGNvbnRleHQgPSBnZXRTb3VyY2VGaWxlKG5vZGUpO1xuICAgICAgZm9yIChjb25zdCBleHBvcnRSZWYgb2YgYW5hbHlzaXMuZXhwb3J0cykge1xuICAgICAgICBpZiAoaXNOZ01vZHVsZShleHBvcnRSZWYubm9kZSwgc2NvcGUuY29tcGlsYXRpb24pKSB7XG4gICAgICAgICAgZGF0YS5pbmplY3RvckltcG9ydHMucHVzaCh0aGlzLnJlZkVtaXR0ZXIuZW1pdChleHBvcnRSZWYsIGNvbnRleHQpLmV4cHJlc3Npb24pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgZGVjbCBvZiBhbmFseXNpcy5kZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLm1ldGFSZWFkZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGVjbCk7XG5cbiAgICAgICAgaWYgKG1ldGFkYXRhICE9PSBudWxsICYmIG1ldGFkYXRhLnNlbGVjdG9yID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgICAgICBFcnJvckNvZGUuRElSRUNUSVZFX01JU1NJTkdfU0VMRUNUT1IsIGRlY2wubm9kZSxcbiAgICAgICAgICAgICAgYERpcmVjdGl2ZSAke2RlY2wubm9kZS5uYW1lLnRleHR9IGhhcyBubyBzZWxlY3RvciwgcGxlYXNlIGFkZCBpdCFgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkaWFnbm9zdGljcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4ge2RpYWdub3N0aWNzfTtcbiAgICB9XG5cbiAgICBpZiAoc2NvcGUgPT09IG51bGwgfHwgc2NvcGUuY29tcGlsYXRpb24uaXNQb2lzb25lZCB8fCBzY29wZS5leHBvcnRlZC5pc1BvaXNvbmVkIHx8XG4gICAgICAgIHNjb3BlLnJlZXhwb3J0cyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHtkYXRhfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGF0YSxcbiAgICAgICAgcmVleHBvcnRzOiBzY29wZS5yZWV4cG9ydHMsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNvbXBpbGVGdWxsKFxuICAgICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbixcbiAgICAgIHtpbmosIG1vZCwgZmFjLCBjbGFzc01ldGFkYXRhLCBkZWNsYXJhdGlvbnN9OiBSZWFkb25seTxOZ01vZHVsZUFuYWx5c2lzPixcbiAgICAgIHtpbmplY3RvckltcG9ydHN9OiBSZWFkb25seTxOZ01vZHVsZVJlc29sdXRpb24+KTogQ29tcGlsZVJlc3VsdFtdIHtcbiAgICBjb25zdCBmYWN0b3J5Rm4gPSBjb21waWxlTmdGYWN0b3J5RGVmRmllbGQoZmFjKTtcbiAgICBjb25zdCBuZ0luamVjdG9yRGVmID0gY29tcGlsZUluamVjdG9yKHRoaXMubWVyZ2VJbmplY3RvckltcG9ydHMoaW5qLCBpbmplY3RvckltcG9ydHMpKTtcbiAgICBjb25zdCBuZ01vZHVsZURlZiA9IGNvbXBpbGVOZ01vZHVsZShtb2QpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBuZ01vZHVsZURlZi5zdGF0ZW1lbnRzO1xuICAgIGNvbnN0IG1ldGFkYXRhID0gY2xhc3NNZXRhZGF0YSAhPT0gbnVsbCA/IGNvbXBpbGVDbGFzc01ldGFkYXRhKGNsYXNzTWV0YWRhdGEpIDogbnVsbDtcbiAgICB0aGlzLmluc2VydE1ldGFkYXRhU3RhdGVtZW50KHN0YXRlbWVudHMsIG1ldGFkYXRhKTtcbiAgICB0aGlzLmFwcGVuZFJlbW90ZVNjb3BpbmdTdGF0ZW1lbnRzKHN0YXRlbWVudHMsIG5vZGUsIGRlY2xhcmF0aW9ucyk7XG5cbiAgICByZXR1cm4gdGhpcy5jb21waWxlTmdNb2R1bGUoZmFjdG9yeUZuLCBuZ0luamVjdG9yRGVmLCBuZ01vZHVsZURlZik7XG4gIH1cblxuICBjb21waWxlUGFydGlhbChcbiAgICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIHtpbmosIGZhYywgbW9kLCBjbGFzc01ldGFkYXRhfTogUmVhZG9ubHk8TmdNb2R1bGVBbmFseXNpcz4sXG4gICAgICB7aW5qZWN0b3JJbXBvcnRzfTogUmVhZG9ubHk8TmdNb2R1bGVSZXNvbHV0aW9uPik6IENvbXBpbGVSZXN1bHRbXSB7XG4gICAgY29uc3QgZmFjdG9yeUZuID0gY29tcGlsZURlY2xhcmVGYWN0b3J5KGZhYyk7XG4gICAgY29uc3QgaW5qZWN0b3JEZWYgPVxuICAgICAgICBjb21waWxlRGVjbGFyZUluamVjdG9yRnJvbU1ldGFkYXRhKHRoaXMubWVyZ2VJbmplY3RvckltcG9ydHMoaW5qLCBpbmplY3RvckltcG9ydHMpKTtcbiAgICBjb25zdCBuZ01vZHVsZURlZiA9IGNvbXBpbGVEZWNsYXJlTmdNb2R1bGVGcm9tTWV0YWRhdGEobW9kKTtcbiAgICBjb25zdCBtZXRhZGF0YSA9IGNsYXNzTWV0YWRhdGEgIT09IG51bGwgPyBjb21waWxlRGVjbGFyZUNsYXNzTWV0YWRhdGEoY2xhc3NNZXRhZGF0YSkgOiBudWxsO1xuICAgIHRoaXMuaW5zZXJ0TWV0YWRhdGFTdGF0ZW1lbnQobmdNb2R1bGVEZWYuc3RhdGVtZW50cywgbWV0YWRhdGEpO1xuICAgIC8vIE5PVEU6IG5vIHJlbW90ZSBzY29waW5nIHJlcXVpcmVkIGFzIHRoaXMgaXMgYmFubmVkIGluIHBhcnRpYWwgY29tcGlsYXRpb24uXG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZU5nTW9kdWxlKGZhY3RvcnlGbiwgaW5qZWN0b3JEZWYsIG5nTW9kdWxlRGVmKTtcbiAgfVxuXG4gIC8qKlxuICAgKiAgTWVyZ2UgdGhlIGluamVjdG9yIGltcG9ydHMgKHdoaWNoIGFyZSAnZXhwb3J0cycgdGhhdCB3ZXJlIGxhdGVyIGZvdW5kIHRvIGJlIE5nTW9kdWxlcylcbiAgICogIGNvbXB1dGVkIGR1cmluZyByZXNvbHV0aW9uIHdpdGggdGhlIG9uZXMgZnJvbSBhbmFseXNpcy5cbiAgICovXG4gIHByaXZhdGUgbWVyZ2VJbmplY3RvckltcG9ydHMoaW5qOiBSM0luamVjdG9yTWV0YWRhdGEsIGluamVjdG9ySW1wb3J0czogRXhwcmVzc2lvbltdKTpcbiAgICAgIFIzSW5qZWN0b3JNZXRhZGF0YSB7XG4gICAgcmV0dXJuIHsuLi5pbmosIGltcG9ydHM6IFsuLi5pbmouaW1wb3J0cywgLi4uaW5qZWN0b3JJbXBvcnRzXX07XG4gIH1cblxuICAvKipcbiAgICogQWRkIGNsYXNzIG1ldGFkYXRhIHN0YXRlbWVudHMsIGlmIHByb3ZpZGVkLCB0byB0aGUgYG5nTW9kdWxlU3RhdGVtZW50c2AuXG4gICAqL1xuICBwcml2YXRlIGluc2VydE1ldGFkYXRhU3RhdGVtZW50KG5nTW9kdWxlU3RhdGVtZW50czogU3RhdGVtZW50W10sIG1ldGFkYXRhOiBFeHByZXNzaW9ufG51bGwpOlxuICAgICAgdm9pZCB7XG4gICAgaWYgKG1ldGFkYXRhICE9PSBudWxsKSB7XG4gICAgICBuZ01vZHVsZVN0YXRlbWVudHMudW5zaGlmdChtZXRhZGF0YS50b1N0bXQoKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCByZW1vdGUgc2NvcGluZyBzdGF0ZW1lbnRzLCBhcyBuZWVkZWQsIHRvIHRoZSBgbmdNb2R1bGVTdGF0ZW1lbnRzYC5cbiAgICovXG4gIHByaXZhdGUgYXBwZW5kUmVtb3RlU2NvcGluZ1N0YXRlbWVudHMoXG4gICAgICBuZ01vZHVsZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdLCBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLFxuICAgICAgZGVjbGFyYXRpb25zOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj5bXSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRleHQgPSBnZXRTb3VyY2VGaWxlKG5vZGUpO1xuICAgIGZvciAoY29uc3QgZGVjbCBvZiBkZWNsYXJhdGlvbnMpIHtcbiAgICAgIGNvbnN0IHJlbW90ZVNjb3BlID0gdGhpcy5zY29wZVJlZ2lzdHJ5LmdldFJlbW90ZVNjb3BlKGRlY2wubm9kZSk7XG4gICAgICBpZiAocmVtb3RlU2NvcGUgIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgZGlyZWN0aXZlcyA9IHJlbW90ZVNjb3BlLmRpcmVjdGl2ZXMubWFwKFxuICAgICAgICAgICAgZGlyZWN0aXZlID0+IHRoaXMucmVmRW1pdHRlci5lbWl0KGRpcmVjdGl2ZSwgY29udGV4dCkuZXhwcmVzc2lvbik7XG4gICAgICAgIGNvbnN0IHBpcGVzID0gcmVtb3RlU2NvcGUucGlwZXMubWFwKHBpcGUgPT4gdGhpcy5yZWZFbWl0dGVyLmVtaXQocGlwZSwgY29udGV4dCkuZXhwcmVzc2lvbik7XG4gICAgICAgIGNvbnN0IGRpcmVjdGl2ZUFycmF5ID0gbmV3IExpdGVyYWxBcnJheUV4cHIoZGlyZWN0aXZlcyk7XG4gICAgICAgIGNvbnN0IHBpcGVzQXJyYXkgPSBuZXcgTGl0ZXJhbEFycmF5RXhwcihwaXBlcyk7XG4gICAgICAgIGNvbnN0IGRlY2xFeHByID0gdGhpcy5yZWZFbWl0dGVyLmVtaXQoZGVjbCwgY29udGV4dCkuZXhwcmVzc2lvbjtcbiAgICAgICAgY29uc3Qgc2V0Q29tcG9uZW50U2NvcGUgPSBuZXcgRXh0ZXJuYWxFeHByKFIzSWRlbnRpZmllcnMuc2V0Q29tcG9uZW50U2NvcGUpO1xuICAgICAgICBjb25zdCBjYWxsRXhwciA9XG4gICAgICAgICAgICBuZXcgSW52b2tlRnVuY3Rpb25FeHByKHNldENvbXBvbmVudFNjb3BlLCBbZGVjbEV4cHIsIGRpcmVjdGl2ZUFycmF5LCBwaXBlc0FycmF5XSk7XG5cbiAgICAgICAgbmdNb2R1bGVTdGF0ZW1lbnRzLnB1c2goY2FsbEV4cHIudG9TdG10KCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgZmFjdG9yeUZuOiBDb21waWxlUmVzdWx0LCBpbmplY3RvckRlZjogUjNDb21waWxlZEV4cHJlc3Npb24sXG4gICAgICBuZ01vZHVsZURlZjogUjNDb21waWxlZEV4cHJlc3Npb24pOiBDb21waWxlUmVzdWx0W10ge1xuICAgIGNvbnN0IHJlczogQ29tcGlsZVJlc3VsdFtdID0gW1xuICAgICAgZmFjdG9yeUZuLFxuICAgICAge1xuICAgICAgICBuYW1lOiAnybVtb2QnLFxuICAgICAgICBpbml0aWFsaXplcjogbmdNb2R1bGVEZWYuZXhwcmVzc2lvbixcbiAgICAgICAgc3RhdGVtZW50czogbmdNb2R1bGVEZWYuc3RhdGVtZW50cyxcbiAgICAgICAgdHlwZTogbmdNb2R1bGVEZWYudHlwZSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICfJtWluaicsXG4gICAgICAgIGluaXRpYWxpemVyOiBpbmplY3RvckRlZi5leHByZXNzaW9uLFxuICAgICAgICBzdGF0ZW1lbnRzOiBpbmplY3RvckRlZi5zdGF0ZW1lbnRzLFxuICAgICAgICB0eXBlOiBpbmplY3RvckRlZi50eXBlLFxuICAgICAgfSxcbiAgICBdO1xuXG4gICAgaWYgKHRoaXMubG9jYWxlSWQpIHtcbiAgICAgIC8vIFFVRVNUSU9OOiBjYW4gdGhpcyBzdHVmZiBiZSByZW1vdmVkP1xuICAgICAgcmVzLnB1c2goe1xuICAgICAgICBuYW1lOiAnybVsb2MnLFxuICAgICAgICBpbml0aWFsaXplcjogbmV3IExpdGVyYWxFeHByKHRoaXMubG9jYWxlSWQpLFxuICAgICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgICAgdHlwZTogU1RSSU5HX1RZUEVcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcml2YXRlIF90b1IzUmVmZXJlbmNlKFxuICAgICAgdmFsdWVSZWY6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPiwgdmFsdWVDb250ZXh0OiB0cy5Tb3VyY2VGaWxlLFxuICAgICAgdHlwZUNvbnRleHQ6IHRzLlNvdXJjZUZpbGUpOiBSM1JlZmVyZW5jZSB7XG4gICAgaWYgKHZhbHVlUmVmLmhhc093bmluZ01vZHVsZUd1ZXNzKSB7XG4gICAgICByZXR1cm4gdG9SM1JlZmVyZW5jZSh2YWx1ZVJlZiwgdmFsdWVSZWYsIHZhbHVlQ29udGV4dCwgdmFsdWVDb250ZXh0LCB0aGlzLnJlZkVtaXR0ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdHlwZVJlZiA9IHZhbHVlUmVmO1xuICAgICAgbGV0IHR5cGVOb2RlID0gdGhpcy5yZWZsZWN0b3IuZ2V0RHRzRGVjbGFyYXRpb24odHlwZVJlZi5ub2RlKTtcbiAgICAgIGlmICh0eXBlTm9kZSAhPT0gbnVsbCAmJiBpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbih0eXBlTm9kZSkpIHtcbiAgICAgICAgdHlwZVJlZiA9IG5ldyBSZWZlcmVuY2UodHlwZU5vZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRvUjNSZWZlcmVuY2UodmFsdWVSZWYsIHR5cGVSZWYsIHZhbHVlQ29udGV4dCwgdHlwZUNvbnRleHQsIHRoaXMucmVmRW1pdHRlcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgYEZ1bmN0aW9uRGVjbGFyYXRpb25gLCBgTWV0aG9kRGVjbGFyYXRpb25gIG9yIGBGdW5jdGlvbkV4cHJlc3Npb25gLCBjaGVjayBpZiBpdCBpc1xuICAgKiB0eXBlZCBhcyBhIGBNb2R1bGVXaXRoUHJvdmlkZXJzYCBhbmQgcmV0dXJuIGFuIGV4cHJlc3Npb24gcmVmZXJlbmNpbmcgdGhlIG1vZHVsZSBpZiBhdmFpbGFibGUuXG4gICAqL1xuICBwcml2YXRlIF9leHRyYWN0TW9kdWxlRnJvbU1vZHVsZVdpdGhQcm92aWRlcnNGbihub2RlOiB0cy5GdW5jdGlvbkRlY2xhcmF0aW9ufFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5NZXRob2REZWNsYXJhdGlvbnxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuRnVuY3Rpb25FeHByZXNzaW9uKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBjb25zdCB0eXBlID0gbm9kZS50eXBlIHx8IG51bGw7XG4gICAgcmV0dXJuIHR5cGUgJiZcbiAgICAgICAgKHRoaXMuX3JlZmxlY3RNb2R1bGVGcm9tVHlwZVBhcmFtKHR5cGUsIG5vZGUpIHx8IHRoaXMuX3JlZmxlY3RNb2R1bGVGcm9tTGl0ZXJhbFR5cGUodHlwZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGFuIGBOZ01vZHVsZWAgaWRlbnRpZmllciAoVCkgZnJvbSB0aGUgc3BlY2lmaWVkIGB0eXBlYCwgaWYgaXQgaXMgb2YgdGhlIGZvcm06XG4gICAqIGBNb2R1bGVXaXRoUHJvdmlkZXJzPFQ+YFxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSB0byByZWZsZWN0IG9uLlxuICAgKiBAcmV0dXJucyB0aGUgaWRlbnRpZmllciBvZiB0aGUgTmdNb2R1bGUgdHlwZSBpZiBmb3VuZCwgb3IgbnVsbCBvdGhlcndpc2UuXG4gICAqL1xuICBwcml2YXRlIF9yZWZsZWN0TW9kdWxlRnJvbVR5cGVQYXJhbShcbiAgICAgIHR5cGU6IHRzLlR5cGVOb2RlLFxuICAgICAgbm9kZTogdHMuRnVuY3Rpb25EZWNsYXJhdGlvbnx0cy5NZXRob2REZWNsYXJhdGlvbnx0cy5GdW5jdGlvbkV4cHJlc3Npb24pOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIC8vIEV4YW1pbmUgdGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIHRvIHNlZSBpZiBpdCdzIGEgTW9kdWxlV2l0aFByb3ZpZGVycyByZWZlcmVuY2UuXG4gICAgaWYgKCF0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKHR5cGUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlTmFtZSA9IHR5cGUgJiZcbiAgICAgICAgICAgICh0cy5pc0lkZW50aWZpZXIodHlwZS50eXBlTmFtZSkgJiYgdHlwZS50eXBlTmFtZSB8fFxuICAgICAgICAgICAgIHRzLmlzUXVhbGlmaWVkTmFtZSh0eXBlLnR5cGVOYW1lKSAmJiB0eXBlLnR5cGVOYW1lLnJpZ2h0KSB8fFxuICAgICAgICBudWxsO1xuICAgIGlmICh0eXBlTmFtZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gTG9vayBhdCB0aGUgdHlwZSBpdHNlbGYgdG8gc2VlIHdoZXJlIGl0IGNvbWVzIGZyb20uXG4gICAgY29uc3QgaWQgPSB0aGlzLnJlZmxlY3Rvci5nZXRJbXBvcnRPZklkZW50aWZpZXIodHlwZU5hbWUpO1xuXG4gICAgLy8gSWYgaXQncyBub3QgbmFtZWQgTW9kdWxlV2l0aFByb3ZpZGVycywgYmFpbC5cbiAgICBpZiAoaWQgPT09IG51bGwgfHwgaWQubmFtZSAhPT0gJ01vZHVsZVdpdGhQcm92aWRlcnMnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBJZiBpdCdzIG5vdCBmcm9tIEBhbmd1bGFyL2NvcmUsIGJhaWwuXG4gICAgaWYgKCF0aGlzLmlzQ29yZSAmJiBpZC5mcm9tICE9PSAnQGFuZ3VsYXIvY29yZScpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlJ3Mgbm8gdHlwZSBwYXJhbWV0ZXIgc3BlY2lmaWVkLCBiYWlsLlxuICAgIGlmICh0eXBlLnR5cGVBcmd1bWVudHMgPT09IHVuZGVmaW5lZCB8fCB0eXBlLnR5cGVBcmd1bWVudHMubGVuZ3RoICE9PSAxKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPVxuICAgICAgICAgIHRzLmlzTWV0aG9kRGVjbGFyYXRpb24obm9kZSkgJiYgdHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUucGFyZW50KSA/IG5vZGUucGFyZW50IDogbnVsbDtcbiAgICAgIGNvbnN0IHN5bWJvbE5hbWUgPSAocGFyZW50ICYmIHBhcmVudC5uYW1lID8gcGFyZW50Lm5hbWUuZ2V0VGV4dCgpICsgJy4nIDogJycpICtcbiAgICAgICAgICAobm9kZS5uYW1lID8gbm9kZS5uYW1lLmdldFRleHQoKSA6ICdhbm9ueW1vdXMnKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuTkdNT0RVTEVfTU9EVUxFX1dJVEhfUFJPVklERVJTX01JU1NJTkdfR0VORVJJQywgdHlwZSxcbiAgICAgICAgICBgJHtzeW1ib2xOYW1lfSByZXR1cm5zIGEgTW9kdWxlV2l0aFByb3ZpZGVycyB0eXBlIHdpdGhvdXQgYSBnZW5lcmljIHR5cGUgYXJndW1lbnQuIGAgK1xuICAgICAgICAgICAgICBgUGxlYXNlIGFkZCBhIGdlbmVyaWMgdHlwZSBhcmd1bWVudCB0byB0aGUgTW9kdWxlV2l0aFByb3ZpZGVycyB0eXBlLiBJZiB0aGlzIGAgK1xuICAgICAgICAgICAgICBgb2NjdXJyZW5jZSBpcyBpbiBsaWJyYXJ5IGNvZGUgeW91IGRvbid0IGNvbnRyb2wsIHBsZWFzZSBjb250YWN0IHRoZSBsaWJyYXJ5IGF1dGhvcnMuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgYXJnID0gdHlwZS50eXBlQXJndW1lbnRzWzBdO1xuXG4gICAgcmV0dXJuIHR5cGVOb2RlVG9WYWx1ZUV4cHIoYXJnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhbiBgTmdNb2R1bGVgIGlkZW50aWZpZXIgKFQpIGZyb20gdGhlIHNwZWNpZmllZCBgdHlwZWAsIGlmIGl0IGlzIG9mIHRoZSBmb3JtOlxuICAgKiBgQXxCfHtuZ01vZHVsZTogVH18Q2AuXG4gICAqIEBwYXJhbSB0eXBlIFRoZSB0eXBlIHRvIHJlZmxlY3Qgb24uXG4gICAqIEByZXR1cm5zIHRoZSBpZGVudGlmaWVyIG9mIHRoZSBOZ01vZHVsZSB0eXBlIGlmIGZvdW5kLCBvciBudWxsIG90aGVyd2lzZS5cbiAgICovXG4gIHByaXZhdGUgX3JlZmxlY3RNb2R1bGVGcm9tTGl0ZXJhbFR5cGUodHlwZTogdHMuVHlwZU5vZGUpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmICghdHMuaXNJbnRlcnNlY3Rpb25UeXBlTm9kZSh0eXBlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdCBvZiB0eXBlLnR5cGVzKSB7XG4gICAgICBpZiAodHMuaXNUeXBlTGl0ZXJhbE5vZGUodCkpIHtcbiAgICAgICAgZm9yIChjb25zdCBtIG9mIHQubWVtYmVycykge1xuICAgICAgICAgIGNvbnN0IG5nTW9kdWxlVHlwZSA9IHRzLmlzUHJvcGVydHlTaWduYXR1cmUobSkgJiYgdHMuaXNJZGVudGlmaWVyKG0ubmFtZSkgJiZcbiAgICAgICAgICAgICAgICAgIG0ubmFtZS50ZXh0ID09PSAnbmdNb2R1bGUnICYmIG0udHlwZSB8fFxuICAgICAgICAgICAgICBudWxsO1xuICAgICAgICAgIGNvbnN0IG5nTW9kdWxlRXhwcmVzc2lvbiA9IG5nTW9kdWxlVHlwZSAmJiB0eXBlTm9kZVRvVmFsdWVFeHByKG5nTW9kdWxlVHlwZSk7XG4gICAgICAgICAgaWYgKG5nTW9kdWxlRXhwcmVzc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIG5nTW9kdWxlRXhwcmVzc2lvbjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBWZXJpZnkgdGhhdCBhIFwiRGVjbGFyYXRpb25cIiByZWZlcmVuY2UgaXMgYSBgQ2xhc3NEZWNsYXJhdGlvbmAgcmVmZXJlbmNlLlxuICBwcml2YXRlIGlzQ2xhc3NEZWNsYXJhdGlvblJlZmVyZW5jZShyZWY6IFJlZmVyZW5jZSk6IHJlZiBpcyBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4ge1xuICAgIHJldHVybiB0aGlzLnJlZmxlY3Rvci5pc0NsYXNzKHJlZi5ub2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlIGEgbGlzdCBvZiBgUmVmZXJlbmNlYHMgZnJvbSBhIHJlc29sdmVkIG1ldGFkYXRhIHZhbHVlLlxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlVHlwZUxpc3QoXG4gICAgICBleHByOiB0cy5Ob2RlLCByZXNvbHZlZExpc3Q6IFJlc29sdmVkVmFsdWUsIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgICAgYXJyYXlOYW1lOiBzdHJpbmcpOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj5bXSB7XG4gICAgY29uc3QgcmVmTGlzdDogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+W10gPSBbXTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkocmVzb2x2ZWRMaXN0KSkge1xuICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICBleHByLCByZXNvbHZlZExpc3QsXG4gICAgICAgICAgYEV4cGVjdGVkIGFycmF5IHdoZW4gcmVhZGluZyB0aGUgTmdNb2R1bGUuJHthcnJheU5hbWV9IG9mICR7Y2xhc3NOYW1lfWApO1xuICAgIH1cblxuICAgIHJlc29sdmVkTGlzdC5mb3JFYWNoKChlbnRyeSwgaWR4KSA9PiB7XG4gICAgICAvLyBVbndyYXAgTW9kdWxlV2l0aFByb3ZpZGVycyBmb3IgbW9kdWxlcyB0aGF0IGFyZSBsb2NhbGx5IGRlY2xhcmVkIChhbmQgdGh1cyBzdGF0aWNcbiAgICAgIC8vIHJlc29sdXRpb24gd2FzIGFibGUgdG8gZGVzY2VuZCBpbnRvIHRoZSBmdW5jdGlvbiBhbmQgcmV0dXJuIGFuIG9iamVjdCBsaXRlcmFsLCBhIE1hcCkuXG4gICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBNYXAgJiYgZW50cnkuaGFzKCduZ01vZHVsZScpKSB7XG4gICAgICAgIGVudHJ5ID0gZW50cnkuZ2V0KCduZ01vZHVsZScpITtcbiAgICAgIH1cblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cnkpKSB7XG4gICAgICAgIC8vIFJlY3Vyc2UgaW50byBuZXN0ZWQgYXJyYXlzLlxuICAgICAgICByZWZMaXN0LnB1c2goLi4udGhpcy5yZXNvbHZlVHlwZUxpc3QoZXhwciwgZW50cnksIGNsYXNzTmFtZSwgYXJyYXlOYW1lKSk7XG4gICAgICB9IGVsc2UgaWYgKGVudHJ5IGluc3RhbmNlb2YgUmVmZXJlbmNlKSB7XG4gICAgICAgIGlmICghdGhpcy5pc0NsYXNzRGVjbGFyYXRpb25SZWZlcmVuY2UoZW50cnkpKSB7XG4gICAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICAgICAgZW50cnkubm9kZSwgZW50cnksXG4gICAgICAgICAgICAgIGBWYWx1ZSBhdCBwb3NpdGlvbiAke2lkeH0gaW4gdGhlIE5nTW9kdWxlLiR7YXJyYXlOYW1lfSBvZiAke1xuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lfSBpcyBub3QgYSBjbGFzc2ApO1xuICAgICAgICB9XG4gICAgICAgIHJlZkxpc3QucHVzaChlbnRyeSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IFByb2R1Y2UgYSBiZXR0ZXIgZGlhZ25vc3RpYyBoZXJlIC0gdGhlIGFycmF5IGluZGV4IG1heSBiZSBhbiBpbm5lciBhcnJheS5cbiAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICAgIGV4cHIsIGVudHJ5LFxuICAgICAgICAgICAgYFZhbHVlIGF0IHBvc2l0aW9uICR7aWR4fSBpbiB0aGUgTmdNb2R1bGUuJHthcnJheU5hbWV9IG9mICR7XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lfSBpcyBub3QgYSByZWZlcmVuY2VgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZWZMaXN0O1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzTmdNb2R1bGUobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgY29tcGlsYXRpb246IFNjb3BlRGF0YSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIWNvbXBpbGF0aW9uLmRpcmVjdGl2ZXMuc29tZShkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLnJlZi5ub2RlID09PSBub2RlKSAmJlxuICAgICAgIWNvbXBpbGF0aW9uLnBpcGVzLnNvbWUocGlwZSA9PiBwaXBlLnJlZi5ub2RlID09PSBub2RlKTtcbn1cbiJdfQ==