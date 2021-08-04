/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { compileClassMetadata, compileDeclareClassMetadata, compileDeclareDirectiveFromMetadata, compileDirectiveFromMetadata, ExternalExpr, FactoryTarget, getSafePropertyAccessString, makeBindingParser, parseHostBindings, verifyHostBindings, WrappedNodeExpr } from '@angular/compiler';
import { emitDistinctChangesOnlyDefaultValue } from '@angular/compiler/src/core';
import * as ts from 'typescript';
import { ErrorCode, FatalDiagnosticError } from '../../diagnostics';
import { Reference } from '../../imports';
import { areTypeParametersEqual, extractSemanticTypeParameters, isArrayEqual, isSetEqual, isSymbolEqual, SemanticSymbol } from '../../incremental/semantic_graph';
import { ClassPropertyMapping, MetaType } from '../../metadata';
import { extractDirectiveTypeCheckMeta } from '../../metadata/src/util';
import { DynamicValue, EnumValue } from '../../partial_evaluator';
import { PerfEvent } from '../../perf';
import { ClassMemberKind, Decorator, filterToMembersWithDecorator, reflectObjectLiteral } from '../../reflection';
import { HandlerFlags, HandlerPrecedence } from '../../transform';
import { createValueHasWrongTypeError, getDirectiveDiagnostics, getProviderDiagnostics, getUndecoratedClassWithAngularFeaturesDiagnostic } from './diagnostics';
import { compileDeclareFactory, compileNgFactoryDefField } from './factory';
import { extractClassMetadata } from './metadata';
import { compileResults, createSourceSpan, findAngularDecorator, getConstructorDependencies, isAngularDecorator, readBaseClass, resolveProvidersRequiringFactory, toFactoryMetadata, tryUnwrapForwardRef, unwrapConstructorDependencies, unwrapExpression, validateConstructorDependencies, wrapFunctionExpressionsInParens, wrapTypeReference } from './util';
const EMPTY_OBJECT = {};
const FIELD_DECORATORS = [
    'Input', 'Output', 'ViewChild', 'ViewChildren', 'ContentChild', 'ContentChildren', 'HostBinding',
    'HostListener'
];
const LIFECYCLE_HOOKS = new Set([
    'ngOnChanges', 'ngOnInit', 'ngOnDestroy', 'ngDoCheck', 'ngAfterViewInit', 'ngAfterViewChecked',
    'ngAfterContentInit', 'ngAfterContentChecked'
]);
/**
 * Represents an Angular directive. Components are represented by `ComponentSymbol`, which inherits
 * from this symbol.
 */
export class DirectiveSymbol extends SemanticSymbol {
    constructor(decl, selector, inputs, outputs, exportAs, typeCheckMeta, typeParameters) {
        super(decl);
        this.selector = selector;
        this.inputs = inputs;
        this.outputs = outputs;
        this.exportAs = exportAs;
        this.typeCheckMeta = typeCheckMeta;
        this.typeParameters = typeParameters;
        this.baseClass = null;
    }
    isPublicApiAffected(previousSymbol) {
        // Note: since components and directives have exactly the same items contributing to their
        // public API, it is okay for a directive to change into a component and vice versa without
        // the API being affected.
        if (!(previousSymbol instanceof DirectiveSymbol)) {
            return true;
        }
        // Directives and components have a public API of:
        //  1. Their selector.
        //  2. The binding names of their inputs and outputs; a change in ordering is also considered
        //     to be a change in public API.
        //  3. The list of exportAs names and its ordering.
        return this.selector !== previousSymbol.selector ||
            !isArrayEqual(this.inputs.propertyNames, previousSymbol.inputs.propertyNames) ||
            !isArrayEqual(this.outputs.propertyNames, previousSymbol.outputs.propertyNames) ||
            !isArrayEqual(this.exportAs, previousSymbol.exportAs);
    }
    isTypeCheckApiAffected(previousSymbol) {
        // If the public API of the directive has changed, then so has its type-check API.
        if (this.isPublicApiAffected(previousSymbol)) {
            return true;
        }
        if (!(previousSymbol instanceof DirectiveSymbol)) {
            return true;
        }
        // The type-check block also depends on the class property names, as writes property bindings
        // directly into the backing fields.
        if (!isArrayEqual(Array.from(this.inputs), Array.from(previousSymbol.inputs), isInputMappingEqual) ||
            !isArrayEqual(Array.from(this.outputs), Array.from(previousSymbol.outputs), isInputMappingEqual)) {
            return true;
        }
        // The type parameters of a directive are emitted into the type constructors in the type-check
        // block of a component, so if the type parameters are not considered equal then consider the
        // type-check API of this directive to be affected.
        if (!areTypeParametersEqual(this.typeParameters, previousSymbol.typeParameters)) {
            return true;
        }
        // The type-check metadata is used during TCB code generation, so any changes should invalidate
        // prior type-check files.
        if (!isTypeCheckMetaEqual(this.typeCheckMeta, previousSymbol.typeCheckMeta)) {
            return true;
        }
        // Changing the base class of a directive means that its inputs/outputs etc may have changed,
        // so the type-check block of components that use this directive needs to be regenerated.
        if (!isBaseClassEqual(this.baseClass, previousSymbol.baseClass)) {
            return true;
        }
        return false;
    }
}
function isInputMappingEqual(current, previous) {
    return current[0] === previous[0] && current[1] === previous[1];
}
function isTypeCheckMetaEqual(current, previous) {
    if (current.hasNgTemplateContextGuard !== previous.hasNgTemplateContextGuard) {
        return false;
    }
    if (current.isGeneric !== previous.isGeneric) {
        // Note: changes in the number of type parameters is also considered in `areTypeParametersEqual`
        // so this check is technically not needed; it is done anyway for completeness in terms of
        // whether the `DirectiveTypeCheckMeta` struct itself compares equal or not.
        return false;
    }
    if (!isArrayEqual(current.ngTemplateGuards, previous.ngTemplateGuards, isTemplateGuardEqual)) {
        return false;
    }
    if (!isSetEqual(current.coercedInputFields, previous.coercedInputFields)) {
        return false;
    }
    if (!isSetEqual(current.restrictedInputFields, previous.restrictedInputFields)) {
        return false;
    }
    if (!isSetEqual(current.stringLiteralInputFields, previous.stringLiteralInputFields)) {
        return false;
    }
    if (!isSetEqual(current.undeclaredInputFields, previous.undeclaredInputFields)) {
        return false;
    }
    return true;
}
function isTemplateGuardEqual(current, previous) {
    return current.inputName === previous.inputName && current.type === previous.type;
}
function isBaseClassEqual(current, previous) {
    if (current === null || previous === null) {
        return current === previous;
    }
    return isSymbolEqual(current, previous);
}
export class DirectiveDecoratorHandler {
    constructor(reflector, evaluator, metaRegistry, scopeRegistry, metaReader, injectableRegistry, isCore, semanticDepGraphUpdater, annotateForClosureCompiler, compileUndecoratedClassesWithAngularFeatures, perf) {
        this.reflector = reflector;
        this.evaluator = evaluator;
        this.metaRegistry = metaRegistry;
        this.scopeRegistry = scopeRegistry;
        this.metaReader = metaReader;
        this.injectableRegistry = injectableRegistry;
        this.isCore = isCore;
        this.semanticDepGraphUpdater = semanticDepGraphUpdater;
        this.annotateForClosureCompiler = annotateForClosureCompiler;
        this.compileUndecoratedClassesWithAngularFeatures = compileUndecoratedClassesWithAngularFeatures;
        this.perf = perf;
        this.precedence = HandlerPrecedence.PRIMARY;
        this.name = DirectiveDecoratorHandler.name;
    }
    detect(node, decorators) {
        // If a class is undecorated but uses Angular features, we detect it as an
        // abstract directive. This is an unsupported pattern as of v10, but we want
        // to still detect these patterns so that we can report diagnostics, or compile
        // them for backwards compatibility in ngcc.
        if (!decorators) {
            const angularField = this.findClassFieldWithAngularFeatures(node);
            return angularField ? { trigger: angularField.node, decorator: null, metadata: null } :
                undefined;
        }
        else {
            const decorator = findAngularDecorator(decorators, 'Directive', this.isCore);
            return decorator ? { trigger: decorator.node, decorator, metadata: decorator } : undefined;
        }
    }
    analyze(node, decorator, flags = HandlerFlags.NONE) {
        // Skip processing of the class declaration if compilation of undecorated classes
        // with Angular features is disabled. Previously in ngtsc, such classes have always
        // been processed, but we want to enforce a consistent decorator mental model.
        // See: https://v9.angular.io/guide/migration-undecorated-classes.
        if (this.compileUndecoratedClassesWithAngularFeatures === false && decorator === null) {
            return { diagnostics: [getUndecoratedClassWithAngularFeaturesDiagnostic(node)] };
        }
        this.perf.eventCount(PerfEvent.AnalyzeDirective);
        const directiveResult = extractDirectiveMetadata(node, decorator, this.reflector, this.evaluator, this.isCore, flags, this.annotateForClosureCompiler);
        if (directiveResult === undefined) {
            return {};
        }
        const analysis = directiveResult.metadata;
        let providersRequiringFactory = null;
        if (directiveResult !== undefined && directiveResult.decorator.has('providers')) {
            providersRequiringFactory = resolveProvidersRequiringFactory(directiveResult.decorator.get('providers'), this.reflector, this.evaluator);
        }
        return {
            analysis: {
                inputs: directiveResult.inputs,
                outputs: directiveResult.outputs,
                meta: analysis,
                classMetadata: extractClassMetadata(node, this.reflector, this.isCore, this.annotateForClosureCompiler),
                baseClass: readBaseClass(node, this.reflector, this.evaluator),
                typeCheckMeta: extractDirectiveTypeCheckMeta(node, directiveResult.inputs, this.reflector),
                providersRequiringFactory,
                isPoisoned: false,
                isStructural: directiveResult.isStructural,
            }
        };
    }
    symbol(node, analysis) {
        const typeParameters = extractSemanticTypeParameters(node);
        return new DirectiveSymbol(node, analysis.meta.selector, analysis.inputs, analysis.outputs, analysis.meta.exportAs, analysis.typeCheckMeta, typeParameters);
    }
    register(node, analysis) {
        // Register this directive's information with the `MetadataRegistry`. This ensures that
        // the information about the directive is available during the compile() phase.
        const ref = new Reference(node);
        this.metaRegistry.registerDirectiveMetadata(Object.assign(Object.assign({ type: MetaType.Directive, ref, name: node.name.text, selector: analysis.meta.selector, exportAs: analysis.meta.exportAs, inputs: analysis.inputs, outputs: analysis.outputs, queries: analysis.meta.queries.map(query => query.propertyName), isComponent: false, baseClass: analysis.baseClass }, analysis.typeCheckMeta), { isPoisoned: analysis.isPoisoned, isStructural: analysis.isStructural }));
        this.injectableRegistry.registerInjectable(node);
    }
    resolve(node, analysis, symbol) {
        if (this.semanticDepGraphUpdater !== null && analysis.baseClass instanceof Reference) {
            symbol.baseClass = this.semanticDepGraphUpdater.getSymbol(analysis.baseClass.node);
        }
        const diagnostics = [];
        if (analysis.providersRequiringFactory !== null &&
            analysis.meta.providers instanceof WrappedNodeExpr) {
            const providerDiagnostics = getProviderDiagnostics(analysis.providersRequiringFactory, analysis.meta.providers.node, this.injectableRegistry);
            diagnostics.push(...providerDiagnostics);
        }
        const directiveDiagnostics = getDirectiveDiagnostics(node, this.metaReader, this.evaluator, this.reflector, this.scopeRegistry, 'Directive');
        if (directiveDiagnostics !== null) {
            diagnostics.push(...directiveDiagnostics);
        }
        return { diagnostics: diagnostics.length > 0 ? diagnostics : undefined };
    }
    compileFull(node, analysis, resolution, pool) {
        const fac = compileNgFactoryDefField(toFactoryMetadata(analysis.meta, FactoryTarget.Directive));
        const def = compileDirectiveFromMetadata(analysis.meta, pool, makeBindingParser());
        const classMetadata = analysis.classMetadata !== null ?
            compileClassMetadata(analysis.classMetadata).toStmt() :
            null;
        return compileResults(fac, def, classMetadata, 'ɵdir');
    }
    compilePartial(node, analysis, resolution) {
        const fac = compileDeclareFactory(toFactoryMetadata(analysis.meta, FactoryTarget.Directive));
        const def = compileDeclareDirectiveFromMetadata(analysis.meta);
        const classMetadata = analysis.classMetadata !== null ?
            compileDeclareClassMetadata(analysis.classMetadata).toStmt() :
            null;
        return compileResults(fac, def, classMetadata, 'ɵdir');
    }
    /**
     * Checks if a given class uses Angular features and returns the TypeScript node
     * that indicated the usage. Classes are considered using Angular features if they
     * contain class members that are either decorated with a known Angular decorator,
     * or if they correspond to a known Angular lifecycle hook.
     */
    findClassFieldWithAngularFeatures(node) {
        return this.reflector.getMembersOfClass(node).find(member => {
            if (!member.isStatic && member.kind === ClassMemberKind.Method &&
                LIFECYCLE_HOOKS.has(member.name)) {
                return true;
            }
            if (member.decorators) {
                return member.decorators.some(decorator => FIELD_DECORATORS.some(decoratorName => isAngularDecorator(decorator, decoratorName, this.isCore)));
            }
            return false;
        });
    }
}
/**
 * Helper function to extract metadata from a `Directive` or `Component`. `Directive`s without a
 * selector are allowed to be used for abstract base classes. These abstract directives should not
 * appear in the declarations of an `NgModule` and additional verification is done when processing
 * the module.
 */
export function extractDirectiveMetadata(clazz, decorator, reflector, evaluator, isCore, flags, annotateForClosureCompiler, defaultSelector = null) {
    let directive;
    if (decorator === null || decorator.args === null || decorator.args.length === 0) {
        directive = new Map();
    }
    else if (decorator.args.length !== 1) {
        throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, Decorator.nodeForError(decorator), `Incorrect number of arguments to @${decorator.name} decorator`);
    }
    else {
        const meta = unwrapExpression(decorator.args[0]);
        if (!ts.isObjectLiteralExpression(meta)) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARG_NOT_LITERAL, meta, `@${decorator.name} argument must be an object literal`);
        }
        directive = reflectObjectLiteral(meta);
    }
    if (directive.has('jit')) {
        // The only allowed value is true, so there's no need to expand further.
        return undefined;
    }
    const members = reflector.getMembersOfClass(clazz);
    // Precompute a list of ts.ClassElements that have decorators. This includes things like @Input,
    // @Output, @HostBinding, etc.
    const decoratedElements = members.filter(member => !member.isStatic && member.decorators !== null);
    const coreModule = isCore ? undefined : '@angular/core';
    // Construct the map of inputs both from the @Directive/@Component
    // decorator, and the decorated
    // fields.
    const inputsFromMeta = parseFieldToPropertyMapping(directive, 'inputs', evaluator);
    const inputsFromFields = parseDecoratedFields(filterToMembersWithDecorator(decoratedElements, 'Input', coreModule), evaluator, resolveInput);
    // And outputs.
    const outputsFromMeta = parseFieldToPropertyMapping(directive, 'outputs', evaluator);
    const outputsFromFields = parseDecoratedFields(filterToMembersWithDecorator(decoratedElements, 'Output', coreModule), evaluator, resolveOutput);
    // Construct the list of queries.
    const contentChildFromFields = queriesFromFields(filterToMembersWithDecorator(decoratedElements, 'ContentChild', coreModule), reflector, evaluator);
    const contentChildrenFromFields = queriesFromFields(filterToMembersWithDecorator(decoratedElements, 'ContentChildren', coreModule), reflector, evaluator);
    const queries = [...contentChildFromFields, ...contentChildrenFromFields];
    // Construct the list of view queries.
    const viewChildFromFields = queriesFromFields(filterToMembersWithDecorator(decoratedElements, 'ViewChild', coreModule), reflector, evaluator);
    const viewChildrenFromFields = queriesFromFields(filterToMembersWithDecorator(decoratedElements, 'ViewChildren', coreModule), reflector, evaluator);
    const viewQueries = [...viewChildFromFields, ...viewChildrenFromFields];
    if (directive.has('queries')) {
        const queriesFromDecorator = extractQueriesFromDecorator(directive.get('queries'), reflector, evaluator, isCore);
        queries.push(...queriesFromDecorator.content);
        viewQueries.push(...queriesFromDecorator.view);
    }
    // Parse the selector.
    let selector = defaultSelector;
    if (directive.has('selector')) {
        const expr = directive.get('selector');
        const resolved = evaluator.evaluate(expr);
        if (typeof resolved !== 'string') {
            throw createValueHasWrongTypeError(expr, resolved, `selector must be a string`);
        }
        // use default selector in case selector is an empty string
        selector = resolved === '' ? defaultSelector : resolved;
        if (!selector) {
            throw new FatalDiagnosticError(ErrorCode.DIRECTIVE_MISSING_SELECTOR, expr, `Directive ${clazz.name.text} has no selector, please add it!`);
        }
    }
    const host = extractHostBindings(decoratedElements, evaluator, coreModule, directive);
    const providers = directive.has('providers') ?
        new WrappedNodeExpr(annotateForClosureCompiler ?
            wrapFunctionExpressionsInParens(directive.get('providers')) :
            directive.get('providers')) :
        null;
    // Determine if `ngOnChanges` is a lifecycle hook defined on the component.
    const usesOnChanges = members.some(member => !member.isStatic && member.kind === ClassMemberKind.Method &&
        member.name === 'ngOnChanges');
    // Parse exportAs.
    let exportAs = null;
    if (directive.has('exportAs')) {
        const expr = directive.get('exportAs');
        const resolved = evaluator.evaluate(expr);
        if (typeof resolved !== 'string') {
            throw createValueHasWrongTypeError(expr, resolved, `exportAs must be a string`);
        }
        exportAs = resolved.split(',').map(part => part.trim());
    }
    const rawCtorDeps = getConstructorDependencies(clazz, reflector, isCore);
    // Non-abstract directives (those with a selector) require valid constructor dependencies, whereas
    // abstract directives are allowed to have invalid dependencies, given that a subclass may call
    // the constructor explicitly.
    const ctorDeps = selector !== null ? validateConstructorDependencies(clazz, rawCtorDeps) :
        unwrapConstructorDependencies(rawCtorDeps);
    // Structural directives must have a `TemplateRef` dependency.
    const isStructural = ctorDeps !== null && ctorDeps !== 'invalid' &&
        ctorDeps.some(dep => (dep.token instanceof ExternalExpr) &&
            dep.token.value.moduleName === '@angular/core' &&
            dep.token.value.name === 'TemplateRef');
    // Detect if the component inherits from another class
    const usesInheritance = reflector.hasBaseClass(clazz);
    const type = wrapTypeReference(reflector, clazz);
    const internalType = new WrappedNodeExpr(reflector.getInternalNameOfClass(clazz));
    const inputs = ClassPropertyMapping.fromMappedObject(Object.assign(Object.assign({}, inputsFromMeta), inputsFromFields));
    const outputs = ClassPropertyMapping.fromMappedObject(Object.assign(Object.assign({}, outputsFromMeta), outputsFromFields));
    const metadata = {
        name: clazz.name.text,
        deps: ctorDeps,
        host,
        lifecycle: {
            usesOnChanges,
        },
        inputs: inputs.toJointMappedObject(),
        outputs: outputs.toDirectMappedObject(),
        queries,
        viewQueries,
        selector,
        fullInheritance: !!(flags & HandlerFlags.FULL_INHERITANCE),
        type,
        internalType,
        typeArgumentCount: reflector.getGenericArityOfClass(clazz) || 0,
        typeSourceSpan: createSourceSpan(clazz.name),
        usesInheritance,
        exportAs,
        providers
    };
    return {
        decorator: directive,
        metadata,
        inputs,
        outputs,
        isStructural,
    };
}
export function extractQueryMetadata(exprNode, name, args, propertyName, reflector, evaluator) {
    var _a;
    if (args.length === 0) {
        throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, exprNode, `@${name} must have arguments`);
    }
    const first = name === 'ViewChild' || name === 'ContentChild';
    const node = (_a = tryUnwrapForwardRef(args[0], reflector)) !== null && _a !== void 0 ? _a : args[0];
    const arg = evaluator.evaluate(node);
    /** Whether or not this query should collect only static results (see view/api.ts)  */
    let isStatic = false;
    // Extract the predicate
    let predicate = null;
    if (arg instanceof Reference || arg instanceof DynamicValue) {
        // References and predicates that could not be evaluated statically are emitted as is.
        predicate = new WrappedNodeExpr(node);
    }
    else if (typeof arg === 'string') {
        predicate = [arg];
    }
    else if (isStringArrayOrDie(arg, `@${name} predicate`, node)) {
        predicate = arg;
    }
    else {
        throw createValueHasWrongTypeError(node, arg, `@${name} predicate cannot be interpreted`);
    }
    // Extract the read and descendants options.
    let read = null;
    // The default value for descendants is true for every decorator except @ContentChildren.
    let descendants = name !== 'ContentChildren';
    let emitDistinctChangesOnly = emitDistinctChangesOnlyDefaultValue;
    if (args.length === 2) {
        const optionsExpr = unwrapExpression(args[1]);
        if (!ts.isObjectLiteralExpression(optionsExpr)) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARG_NOT_LITERAL, optionsExpr, `@${name} options must be an object literal`);
        }
        const options = reflectObjectLiteral(optionsExpr);
        if (options.has('read')) {
            read = new WrappedNodeExpr(options.get('read'));
        }
        if (options.has('descendants')) {
            const descendantsExpr = options.get('descendants');
            const descendantsValue = evaluator.evaluate(descendantsExpr);
            if (typeof descendantsValue !== 'boolean') {
                throw createValueHasWrongTypeError(descendantsExpr, descendantsValue, `@${name} options.descendants must be a boolean`);
            }
            descendants = descendantsValue;
        }
        if (options.has('emitDistinctChangesOnly')) {
            const emitDistinctChangesOnlyExpr = options.get('emitDistinctChangesOnly');
            const emitDistinctChangesOnlyValue = evaluator.evaluate(emitDistinctChangesOnlyExpr);
            if (typeof emitDistinctChangesOnlyValue !== 'boolean') {
                throw createValueHasWrongTypeError(emitDistinctChangesOnlyExpr, emitDistinctChangesOnlyValue, `@${name} options.emitDistinctChangesOnly must be a boolean`);
            }
            emitDistinctChangesOnly = emitDistinctChangesOnlyValue;
        }
        if (options.has('static')) {
            const staticValue = evaluator.evaluate(options.get('static'));
            if (typeof staticValue !== 'boolean') {
                throw createValueHasWrongTypeError(node, staticValue, `@${name} options.static must be a boolean`);
            }
            isStatic = staticValue;
        }
    }
    else if (args.length > 2) {
        // Too many arguments.
        throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, node, `@${name} has too many arguments`);
    }
    return {
        propertyName,
        predicate,
        first,
        descendants,
        read,
        static: isStatic,
        emitDistinctChangesOnly,
    };
}
export function extractQueriesFromDecorator(queryData, reflector, evaluator, isCore) {
    const content = [], view = [];
    if (!ts.isObjectLiteralExpression(queryData)) {
        throw new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator queries metadata must be an object literal');
    }
    reflectObjectLiteral(queryData).forEach((queryExpr, propertyName) => {
        queryExpr = unwrapExpression(queryExpr);
        if (!ts.isNewExpression(queryExpr)) {
            throw new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator query metadata must be an instance of a query type');
        }
        const queryType = ts.isPropertyAccessExpression(queryExpr.expression) ?
            queryExpr.expression.name :
            queryExpr.expression;
        if (!ts.isIdentifier(queryType)) {
            throw new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator query metadata must be an instance of a query type');
        }
        const type = reflector.getImportOfIdentifier(queryType);
        if (type === null || (!isCore && type.from !== '@angular/core') ||
            !QUERY_TYPES.has(type.name)) {
            throw new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator query metadata must be an instance of a query type');
        }
        const query = extractQueryMetadata(queryExpr, type.name, queryExpr.arguments || [], propertyName, reflector, evaluator);
        if (type.name.startsWith('Content')) {
            content.push(query);
        }
        else {
            view.push(query);
        }
    });
    return { content, view };
}
function isStringArrayOrDie(value, name, node) {
    if (!Array.isArray(value)) {
        return false;
    }
    for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string') {
            throw createValueHasWrongTypeError(node, value[i], `Failed to resolve ${name} at position ${i} to a string`);
        }
    }
    return true;
}
export function parseFieldArrayValue(directive, field, evaluator) {
    if (!directive.has(field)) {
        return null;
    }
    // Resolve the field of interest from the directive metadata to a string[].
    const expression = directive.get(field);
    const value = evaluator.evaluate(expression);
    if (!isStringArrayOrDie(value, field, expression)) {
        throw createValueHasWrongTypeError(expression, value, `Failed to resolve @Directive.${field} to a string array`);
    }
    return value;
}
/**
 * Interpret property mapping fields on the decorator (e.g. inputs or outputs) and return the
 * correctly shaped metadata object.
 */
function parseFieldToPropertyMapping(directive, field, evaluator) {
    const metaValues = parseFieldArrayValue(directive, field, evaluator);
    if (!metaValues) {
        return EMPTY_OBJECT;
    }
    return metaValues.reduce((results, value) => {
        // Either the value is 'field' or 'field: property'. In the first case, `property` will
        // be undefined, in which case the field name should also be used as the property name.
        const [field, property] = value.split(':', 2).map(str => str.trim());
        results[field] = property || field;
        return results;
    }, {});
}
/**
 * Parse property decorators (e.g. `Input` or `Output`) and return the correctly shaped metadata
 * object.
 */
function parseDecoratedFields(fields, evaluator, mapValueResolver) {
    return fields.reduce((results, field) => {
        const fieldName = field.member.name;
        field.decorators.forEach(decorator => {
            // The decorator either doesn't have an argument (@Input()) in which case the property
            // name is used, or it has one argument (@Output('named')).
            if (decorator.args == null || decorator.args.length === 0) {
                results[fieldName] = fieldName;
            }
            else if (decorator.args.length === 1) {
                const property = evaluator.evaluate(decorator.args[0]);
                if (typeof property !== 'string') {
                    throw createValueHasWrongTypeError(Decorator.nodeForError(decorator), property, `@${decorator.name} decorator argument must resolve to a string`);
                }
                results[fieldName] = mapValueResolver(property, fieldName);
            }
            else {
                // Too many arguments.
                throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, Decorator.nodeForError(decorator), `@${decorator.name} can have at most one argument, got ${decorator.args.length} argument(s)`);
            }
        });
        return results;
    }, {});
}
function resolveInput(publicName, internalName) {
    return [publicName, internalName];
}
function resolveOutput(publicName, internalName) {
    return publicName;
}
export function queriesFromFields(fields, reflector, evaluator) {
    return fields.map(({ member, decorators }) => {
        const decorator = decorators[0];
        const node = member.node || Decorator.nodeForError(decorator);
        // Throw in case of `@Input() @ContentChild('foo') foo: any`, which is not supported in Ivy
        if (member.decorators.some(v => v.name === 'Input')) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_COLLISION, node, 'Cannot combine @Input decorators with query decorators');
        }
        if (decorators.length !== 1) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_COLLISION, node, 'Cannot have multiple query decorators on the same class member');
        }
        else if (!isPropertyTypeMember(member)) {
            throw new FatalDiagnosticError(ErrorCode.DECORATOR_UNEXPECTED, node, 'Query decorator must go on a property-type member');
        }
        return extractQueryMetadata(node, decorator.name, decorator.args || [], member.name, reflector, evaluator);
    });
}
function isPropertyTypeMember(member) {
    return member.kind === ClassMemberKind.Getter || member.kind === ClassMemberKind.Setter ||
        member.kind === ClassMemberKind.Property;
}
function evaluateHostExpressionBindings(hostExpr, evaluator) {
    const hostMetaMap = evaluator.evaluate(hostExpr);
    if (!(hostMetaMap instanceof Map)) {
        throw createValueHasWrongTypeError(hostExpr, hostMetaMap, `Decorator host metadata must be an object`);
    }
    const hostMetadata = {};
    hostMetaMap.forEach((value, key) => {
        // Resolve Enum references to their declared value.
        if (value instanceof EnumValue) {
            value = value.resolved;
        }
        if (typeof key !== 'string') {
            throw createValueHasWrongTypeError(hostExpr, key, `Decorator host metadata must be a string -> string object, but found unparseable key`);
        }
        if (typeof value == 'string') {
            hostMetadata[key] = value;
        }
        else if (value instanceof DynamicValue) {
            hostMetadata[key] = new WrappedNodeExpr(value.node);
        }
        else {
            throw createValueHasWrongTypeError(hostExpr, value, `Decorator host metadata must be a string -> string object, but found unparseable value`);
        }
    });
    const bindings = parseHostBindings(hostMetadata);
    const errors = verifyHostBindings(bindings, createSourceSpan(hostExpr));
    if (errors.length > 0) {
        throw new FatalDiagnosticError(
        // TODO: provide more granular diagnostic and output specific host expression that
        // triggered an error instead of the whole host object.
        ErrorCode.HOST_BINDING_PARSE_ERROR, hostExpr, errors.map((error) => error.msg).join('\n'));
    }
    return bindings;
}
export function extractHostBindings(members, evaluator, coreModule, metadata) {
    let bindings;
    if (metadata && metadata.has('host')) {
        bindings = evaluateHostExpressionBindings(metadata.get('host'), evaluator);
    }
    else {
        bindings = parseHostBindings({});
    }
    filterToMembersWithDecorator(members, 'HostBinding', coreModule)
        .forEach(({ member, decorators }) => {
        decorators.forEach(decorator => {
            let hostPropertyName = member.name;
            if (decorator.args !== null && decorator.args.length > 0) {
                if (decorator.args.length !== 1) {
                    throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, Decorator.nodeForError(decorator), `@HostBinding can have at most one argument, got ${decorator.args.length} argument(s)`);
                }
                const resolved = evaluator.evaluate(decorator.args[0]);
                if (typeof resolved !== 'string') {
                    throw createValueHasWrongTypeError(Decorator.nodeForError(decorator), resolved, `@HostBinding's argument must be a string`);
                }
                hostPropertyName = resolved;
            }
            // Since this is a decorator, we know that the value is a class member. Always access it
            // through `this` so that further down the line it can't be confused for a literal value
            // (e.g. if there's a property called `true`). There is no size penalty, because all
            // values (except literals) are converted to `ctx.propName` eventually.
            bindings.properties[hostPropertyName] = getSafePropertyAccessString('this', member.name);
        });
    });
    filterToMembersWithDecorator(members, 'HostListener', coreModule)
        .forEach(({ member, decorators }) => {
        decorators.forEach(decorator => {
            let eventName = member.name;
            let args = [];
            if (decorator.args !== null && decorator.args.length > 0) {
                if (decorator.args.length > 2) {
                    throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, decorator.args[2], `@HostListener can have at most two arguments`);
                }
                const resolved = evaluator.evaluate(decorator.args[0]);
                if (typeof resolved !== 'string') {
                    throw createValueHasWrongTypeError(decorator.args[0], resolved, `@HostListener's event name argument must be a string`);
                }
                eventName = resolved;
                if (decorator.args.length === 2) {
                    const expression = decorator.args[1];
                    const resolvedArgs = evaluator.evaluate(decorator.args[1]);
                    if (!isStringArrayOrDie(resolvedArgs, '@HostListener.args', expression)) {
                        throw createValueHasWrongTypeError(decorator.args[1], resolvedArgs, `@HostListener's second argument must be a string array`);
                    }
                    args = resolvedArgs;
                }
            }
            bindings.listeners[eventName] = `${member.name}(${args.join(',')})`;
        });
    });
    return bindings;
}
const QUERY_TYPES = new Set([
    'ContentChild',
    'ContentChildren',
    'ViewChild',
    'ViewChildren',
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvZGlyZWN0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxvQkFBb0IsRUFBRSwyQkFBMkIsRUFBRSxtQ0FBbUMsRUFBRSw0QkFBNEIsRUFBNEIsWUFBWSxFQUFFLGFBQWEsRUFBRSwyQkFBMkIsRUFBRSxpQkFBaUIsRUFBa0MsaUJBQWlCLEVBQXVGLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzNhLE9BQU8sRUFBQyxtQ0FBbUMsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQy9FLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxTQUFTLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNsRSxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ3hDLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw2QkFBNkIsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBMkIsY0FBYyxFQUF3QixNQUFNLGtDQUFrQyxDQUFDO0FBQ2hOLE9BQU8sRUFBc0Isb0JBQW9CLEVBQXdHLFFBQVEsRUFBb0IsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1TSxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RSxPQUFPLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBbUIsTUFBTSx5QkFBeUIsQ0FBQztBQUNsRixPQUFPLEVBQUMsU0FBUyxFQUFlLE1BQU0sWUFBWSxDQUFDO0FBQ25ELE9BQU8sRUFBZ0MsZUFBZSxFQUFFLFNBQVMsRUFBRSw0QkFBNEIsRUFBa0Isb0JBQW9CLEVBQUMsTUFBTSxrQkFBa0Is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LElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDckMsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUUsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLEVBQUU7d0JBQ3ZFLE1BQU0sNEJBQTRCLENBQzlCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxFQUMvQix3REFBd0QsQ0FBQyxDQUFDO3FCQUMvRDtvQkFDRCxJQUFJLEdBQUcsWUFBWSxDQUFDO2lCQUNyQjthQUNGO1lBRUQsUUFBUSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1FBQ3RFLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDUCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDO0FBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDMUIsY0FBYztJQUNkLGlCQUFpQjtJQUNqQixXQUFXO0lBQ1gsY0FBYztDQUNmLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXBpbGVDbGFzc01ldGFkYXRhLCBjb21waWxlRGVjbGFyZUNsYXNzTWV0YWRhdGEsIGNvbXBpbGVEZWNsYXJlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBDb25zdGFudFBvb2wsIEV4cHJlc3Npb24sIEV4dGVybmFsRXhwciwgRmFjdG9yeVRhcmdldCwgZ2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nLCBtYWtlQmluZGluZ1BhcnNlciwgUGFyc2VkSG9zdEJpbmRpbmdzLCBQYXJzZUVycm9yLCBwYXJzZUhvc3RCaW5kaW5ncywgUjNDbGFzc01ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0ZhY3RvcnlNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhLCBTdGF0ZW1lbnQsIHZlcmlmeUhvc3RCaW5kaW5ncywgV3JhcHBlZE5vZGVFeHByfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQge2VtaXREaXN0aW5jdENoYW5nZXNPbmx5RGVmYXVsdFZhbHVlfSBmcm9tICdAYW5ndWxhci9jb21waWxlci9zcmMvY29yZSc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFcnJvckNvZGUsIEZhdGFsRGlhZ25vc3RpY0Vycm9yfSBmcm9tICcuLi8uLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge2FyZVR5cGVQYXJhbWV0ZXJzRXF1YWwsIGV4dHJhY3RTZW1hbnRpY1R5cGVQYXJhbWV0ZXJzLCBpc0FycmF5RXF1YWwsIGlzU2V0RXF1YWwsIGlzU3ltYm9sRXF1YWwsIFNlbWFudGljRGVwR3JhcGhVcGRhdGVyLCBTZW1hbnRpY1N5bWJvbCwgU2VtYW50aWNUeXBlUGFyYW1ldGVyfSBmcm9tICcuLi8uLi9pbmNyZW1lbnRhbC9zZW1hbnRpY19ncmFwaCc7XG5pbXBvcnQge0JpbmRpbmdQcm9wZXJ0eU5hbWUsIENsYXNzUHJvcGVydHlNYXBwaW5nLCBDbGFzc1Byb3BlcnR5TmFtZSwgRGlyZWN0aXZlVHlwZUNoZWNrTWV0YSwgSW5qZWN0YWJsZUNsYXNzUmVnaXN0cnksIE1ldGFkYXRhUmVhZGVyLCBNZXRhZGF0YVJlZ2lzdHJ5LCBNZXRhVHlwZSwgVGVtcGxhdGVHdWFyZE1ldGF9IGZyb20gJy4uLy4uL21ldGFkYXRhJztcbmltcG9ydCB7ZXh0cmFjdERpcmVjdGl2ZVR5cGVDaGVja01ldGF9IGZyb20gJy4uLy4uL21ldGFkYXRhL3NyYy91dGlsJztcbmltcG9ydCB7RHluYW1pY1ZhbHVlLCBFbnVtVmFsdWUsIFBhcnRpYWxFdmFsdWF0b3J9IGZyb20gJy4uLy4uL3BhcnRpYWxfZXZhbHVhdG9yJztcbmltcG9ydCB7UGVyZkV2ZW50LCBQZXJmUmVjb3JkZXJ9IGZyb20gJy4uLy4uL3BlcmYnO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBDbGFzc01lbWJlciwgQ2xhc3NNZW1iZXJLaW5kLCBEZWNvcmF0b3IsIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IsIFJlZmxlY3Rpb25Ib3N0LCByZWZsZWN0T2JqZWN0TGl0ZXJhbH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge0xvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtBbmFseXNpc091dHB1dCwgQ29tcGlsZVJlc3VsdCwgRGVjb3JhdG9ySGFuZGxlciwgRGV0ZWN0UmVzdWx0LCBIYW5kbGVyRmxhZ3MsIEhhbmRsZXJQcmVjZWRlbmNlLCBSZXNvbHZlUmVzdWx0fSBmcm9tICcuLi8uLi90cmFuc2Zvcm0nO1xuXG5pbXBvcnQge2NyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IsIGdldERpcmVjdGl2ZURpYWdub3N0aWNzLCBnZXRQcm92aWRlckRpYWdub3N0aWNzLCBnZXRVbmRlY29yYXRlZENsYXNzV2l0aEFuZ3VsYXJGZWF0dXJlc0RpYWdub3N0aWN9IGZyb20gJy4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtjb21waWxlRGVjbGFyZUZhY3RvcnksIGNvbXBpbGVOZ0ZhY3RvcnlEZWZGaWVsZH0gZnJvbSAnLi9mYWN0b3J5JztcbmltcG9ydCB7ZXh0cmFjdENsYXNzTWV0YWRhdGF9IGZyb20gJy4vbWV0YWRhdGEnO1xuaW1wb3J0IHtjb21waWxlUmVzdWx0cywgY3JlYXRlU291cmNlU3BhbiwgZmluZEFuZ3VsYXJEZWNvcmF0b3IsIGdldENvbnN0cnVjdG9yRGVwZW5kZW5jaWVzLCBpc0FuZ3VsYXJEZWNvcmF0b3IsIHJlYWRCYXNlQ2xhc3MsIHJlc29sdmVQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LCB0b0ZhY3RvcnlNZXRhZGF0YSwgdHJ5VW53cmFwRm9yd2FyZFJlZiwgdW53cmFwQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMsIHVud3JhcEV4cHJlc3Npb24sIHZhbGlkYXRlQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMsIHdyYXBGdW5jdGlvbkV4cHJlc3Npb25zSW5QYXJlbnMsIHdyYXBUeXBlUmVmZXJlbmNlfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9PQkpFQ1Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5jb25zdCBGSUVMRF9ERUNPUkFUT1JTID0gW1xuICAnSW5wdXQnLCAnT3V0cHV0JywgJ1ZpZXdDaGlsZCcsICdWaWV3Q2hpbGRyZW4nLCAnQ29udGVudENoaWxkJywgJ0NvbnRlbnRDaGlsZHJlbicsICdIb3N0QmluZGluZycsXG4gICdIb3N0TGlzdGVuZXInXG5dO1xuY29uc3QgTElGRUNZQ0xFX0hPT0tTID0gbmV3IFNldChbXG4gICduZ09uQ2hhbmdlcycsICduZ09uSW5pdCcsICduZ09uRGVzdHJveScsICduZ0RvQ2hlY2snLCAnbmdBZnRlclZpZXdJbml0JywgJ25nQWZ0ZXJWaWV3Q2hlY2tlZCcsXG4gICduZ0FmdGVyQ29udGVudEluaXQnLCAnbmdBZnRlckNvbnRlbnRDaGVja2VkJ1xuXSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0aXZlSGFuZGxlckRhdGEge1xuICBiYXNlQ2xhc3M6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPnwnZHluYW1pYyd8bnVsbDtcbiAgdHlwZUNoZWNrTWV0YTogRGlyZWN0aXZlVHlwZUNoZWNrTWV0YTtcbiAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YTtcbiAgY2xhc3NNZXRhZGF0YTogUjNDbGFzc01ldGFkYXRhfG51bGw7XG4gIHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3Rvcnk6IFNldDxSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4+fG51bGw7XG4gIGlucHV0czogQ2xhc3NQcm9wZXJ0eU1hcHBpbmc7XG4gIG91dHB1dHM6IENsYXNzUHJvcGVydHlNYXBwaW5nO1xuICBpc1BvaXNvbmVkOiBib29sZWFuO1xuICBpc1N0cnVjdHVyYWw6IGJvb2xlYW47XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBBbmd1bGFyIGRpcmVjdGl2ZS4gQ29tcG9uZW50cyBhcmUgcmVwcmVzZW50ZWQgYnkgYENvbXBvbmVudFN5bWJvbGAsIHdoaWNoIGluaGVyaXRzXG4gKiBmcm9tIHRoaXMgc3ltYm9sLlxuICovXG5leHBvcnQgY2xhc3MgRGlyZWN0aXZlU3ltYm9sIGV4dGVuZHMgU2VtYW50aWNTeW1ib2wge1xuICBiYXNlQ2xhc3M6IFNlbWFudGljU3ltYm9sfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgZGVjbDogQ2xhc3NEZWNsYXJhdGlvbiwgcHVibGljIHJlYWRvbmx5IHNlbGVjdG9yOiBzdHJpbmd8bnVsbCxcbiAgICAgIHB1YmxpYyByZWFkb25seSBpbnB1dHM6IENsYXNzUHJvcGVydHlNYXBwaW5nLCBwdWJsaWMgcmVhZG9ubHkgb3V0cHV0czogQ2xhc3NQcm9wZXJ0eU1hcHBpbmcsXG4gICAgICBwdWJsaWMgcmVhZG9ubHkgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGwsXG4gICAgICBwdWJsaWMgcmVhZG9ubHkgdHlwZUNoZWNrTWV0YTogRGlyZWN0aXZlVHlwZUNoZWNrTWV0YSxcbiAgICAgIHB1YmxpYyByZWFkb25seSB0eXBlUGFyYW1ldGVyczogU2VtYW50aWNUeXBlUGFyYW1ldGVyW118bnVsbCkge1xuICAgIHN1cGVyKGRlY2wpO1xuICB9XG5cbiAgaXNQdWJsaWNBcGlBZmZlY3RlZChwcmV2aW91c1N5bWJvbDogU2VtYW50aWNTeW1ib2wpOiBib29sZWFuIHtcbiAgICAvLyBOb3RlOiBzaW5jZSBjb21wb25lbnRzIGFuZCBkaXJlY3RpdmVzIGhhdmUgZXhhY3RseSB0aGUgc2FtZSBpdGVtcyBjb250cmlidXRpbmcgdG8gdGhlaXJcbiAgICAvLyBwdWJsaWMgQVBJLCBpdCBpcyBva2F5IGZvciBhIGRpcmVjdGl2ZSB0byBjaGFuZ2UgaW50byBhIGNvbXBvbmVudCBhbmQgdmljZSB2ZXJzYSB3aXRob3V0XG4gICAgLy8gdGhlIEFQSSBiZWluZyBhZmZlY3RlZC5cbiAgICBpZiAoIShwcmV2aW91c1N5bWJvbCBpbnN0YW5jZW9mIERpcmVjdGl2ZVN5bWJvbCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIERpcmVjdGl2ZXMgYW5kIGNvbXBvbmVudHMgaGF2ZSBhIHB1YmxpYyBBUEkgb2Y6XG4gICAgLy8gIDEuIFRoZWlyIHNlbGVjdG9yLlxuICAgIC8vICAyLiBUaGUgYmluZGluZyBuYW1lcyBvZiB0aGVpciBpbnB1dHMgYW5kIG91dHB1dHM7IGEgY2hhbmdlIGluIG9yZGVyaW5nIGlzIGFsc28gY29uc2lkZXJlZFxuICAgIC8vICAgICB0byBiZSBhIGNoYW5nZSBpbiBwdWJsaWMgQVBJLlxuICAgIC8vICAzLiBUaGUgbGlzdCBvZiBleHBvcnRBcyBuYW1lcyBhbmQgaXRzIG9yZGVyaW5nLlxuICAgIHJldHVybiB0aGlzLnNlbGVjdG9yICE9PSBwcmV2aW91c1N5bWJvbC5zZWxlY3RvciB8fFxuICAgICAgICAhaXNBcnJheUVxdWFsKHRoaXMuaW5wdXRzLnByb3BlcnR5TmFtZXMsIHByZXZpb3VzU3ltYm9sLmlucHV0cy5wcm9wZXJ0eU5hbWVzKSB8fFxuICAgICAgICAhaXNBcnJheUVxdWFsKHRoaXMub3V0cHV0cy5wcm9wZXJ0eU5hbWVzLCBwcmV2aW91c1N5bWJvbC5vdXRwdXRzLnByb3BlcnR5TmFtZXMpIHx8XG4gICAgICAgICFpc0FycmF5RXF1YWwodGhpcy5leHBvcnRBcywgcHJldmlvdXNTeW1ib2wuZXhwb3J0QXMpO1xuICB9XG5cbiAgaXNUeXBlQ2hlY2tBcGlBZmZlY3RlZChwcmV2aW91c1N5bWJvbDogU2VtYW50aWNTeW1ib2wpOiBib29sZWFuIHtcbiAgICAvLyBJZiB0aGUgcHVibGljIEFQSSBvZiB0aGUgZGlyZWN0aXZlIGhhcyBjaGFuZ2VkLCB0aGVuIHNvIGhhcyBpdHMgdHlwZS1jaGVjayBBUEkuXG4gICAgaWYgKHRoaXMuaXNQdWJsaWNBcGlBZmZlY3RlZChwcmV2aW91c1N5bWJvbCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICghKHByZXZpb3VzU3ltYm9sIGluc3RhbmNlb2YgRGlyZWN0aXZlU3ltYm9sKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gVGhlIHR5cGUtY2hlY2sgYmxvY2sgYWxzbyBkZXBlbmRzIG9uIHRoZSBjbGFzcyBwcm9wZXJ0eSBuYW1lcywgYXMgd3JpdGVzIHByb3BlcnR5IGJpbmRpbmdzXG4gICAgLy8gZGlyZWN0bHkgaW50byB0aGUgYmFja2luZyBmaWVsZHMuXG4gICAgaWYgKCFpc0FycmF5RXF1YWwoXG4gICAgICAgICAgICBBcnJheS5mcm9tKHRoaXMuaW5wdXRzKSwgQXJyYXkuZnJvbShwcmV2aW91c1N5bWJvbC5pbnB1dHMpLCBpc0lucHV0TWFwcGluZ0VxdWFsKSB8fFxuICAgICAgICAhaXNBcnJheUVxdWFsKFxuICAgICAgICAgICAgQXJyYXkuZnJvbSh0aGlzLm91dHB1dHMpLCBBcnJheS5mcm9tKHByZXZpb3VzU3ltYm9sLm91dHB1dHMpLCBpc0lucHV0TWFwcGluZ0VxdWFsKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gVGhlIHR5cGUgcGFyYW1ldGVycyBvZiBhIGRpcmVjdGl2ZSBhcmUgZW1pdHRlZCBpbnRvIHRoZSB0eXBlIGNvbnN0cnVjdG9ycyBpbiB0aGUgdHlwZS1jaGVja1xuICAgIC8vIGJsb2NrIG9mIGEgY29tcG9uZW50LCBzbyBpZiB0aGUgdHlwZSBwYXJhbWV0ZXJzIGFyZSBub3QgY29uc2lkZXJlZCBlcXVhbCB0aGVuIGNvbnNpZGVyIHRoZVxuICAgIC8vIHR5cGUtY2hlY2sgQVBJIG9mIHRoaXMgZGlyZWN0aXZlIHRvIGJlIGFmZmVjdGVkLlxuICAgIGlmICghYXJlVHlwZVBhcmFtZXRlcnNFcXVhbCh0aGlzLnR5cGVQYXJhbWV0ZXJzLCBwcmV2aW91c1N5bWJvbC50eXBlUGFyYW1ldGVycykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIFRoZSB0eXBlLWNoZWNrIG1ldGFkYXRhIGlzIHVzZWQgZHVyaW5nIFRDQiBjb2RlIGdlbmVyYXRpb24sIHNvIGFueSBjaGFuZ2VzIHNob3VsZCBpbnZhbGlkYXRlXG4gICAgLy8gcHJpb3IgdHlwZS1jaGVjayBmaWxlcy5cbiAgICBpZiAoIWlzVHlwZUNoZWNrTWV0YUVxdWFsKHRoaXMudHlwZUNoZWNrTWV0YSwgcHJldmlvdXNTeW1ib2wudHlwZUNoZWNrTWV0YSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIENoYW5naW5nIHRoZSBiYXNlIGNsYXNzIG9mIGEgZGlyZWN0aXZlIG1lYW5zIHRoYXQgaXRzIGlucHV0cy9vdXRwdXRzIGV0YyBtYXkgaGF2ZSBjaGFuZ2VkLFxuICAgIC8vIHNvIHRoZSB0eXBlLWNoZWNrIGJsb2NrIG9mIGNvbXBvbmVudHMgdGhhdCB1c2UgdGhpcyBkaXJlY3RpdmUgbmVlZHMgdG8gYmUgcmVnZW5lcmF0ZWQuXG4gICAgaWYgKCFpc0Jhc2VDbGFzc0VxdWFsKHRoaXMuYmFzZUNsYXNzLCBwcmV2aW91c1N5bWJvbC5iYXNlQ2xhc3MpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNJbnB1dE1hcHBpbmdFcXVhbChcbiAgICBjdXJyZW50OiBbQ2xhc3NQcm9wZXJ0eU5hbWUsIEJpbmRpbmdQcm9wZXJ0eU5hbWVdLFxuICAgIHByZXZpb3VzOiBbQ2xhc3NQcm9wZXJ0eU5hbWUsIEJpbmRpbmdQcm9wZXJ0eU5hbWVdKTogYm9vbGVhbiB7XG4gIHJldHVybiBjdXJyZW50WzBdID09PSBwcmV2aW91c1swXSAmJiBjdXJyZW50WzFdID09PSBwcmV2aW91c1sxXTtcbn1cblxuZnVuY3Rpb24gaXNUeXBlQ2hlY2tNZXRhRXF1YWwoXG4gICAgY3VycmVudDogRGlyZWN0aXZlVHlwZUNoZWNrTWV0YSwgcHJldmlvdXM6IERpcmVjdGl2ZVR5cGVDaGVja01ldGEpOiBib29sZWFuIHtcbiAgaWYgKGN1cnJlbnQuaGFzTmdUZW1wbGF0ZUNvbnRleHRHdWFyZCAhPT0gcHJldmlvdXMuaGFzTmdUZW1wbGF0ZUNvbnRleHRHdWFyZCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoY3VycmVudC5pc0dlbmVyaWMgIT09IHByZXZpb3VzLmlzR2VuZXJpYykge1xuICAgIC8vIE5vdGU6IGNoYW5nZXMgaW4gdGhlIG51bWJlciBvZiB0eXBlIHBhcmFtZXRlcnMgaXMgYWxzbyBjb25zaWRlcmVkIGluIGBhcmVUeXBlUGFyYW1ldGVyc0VxdWFsYFxuICAgIC8vIHNvIHRoaXMgY2hlY2sgaXMgdGVjaG5pY2FsbHkgbm90IG5lZWRlZDsgaXQgaXMgZG9uZSBhbnl3YXkgZm9yIGNvbXBsZXRlbmVzcyBpbiB0ZXJtcyBvZlxuICAgIC8vIHdoZXRoZXIgdGhlIGBEaXJlY3RpdmVUeXBlQ2hlY2tNZXRhYCBzdHJ1Y3QgaXRzZWxmIGNvbXBhcmVzIGVxdWFsIG9yIG5vdC5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCFpc0FycmF5RXF1YWwoY3VycmVudC5uZ1RlbXBsYXRlR3VhcmRzLCBwcmV2aW91cy5uZ1RlbXBsYXRlR3VhcmRzLCBpc1RlbXBsYXRlR3VhcmRFcXVhbCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCFpc1NldEVxdWFsKGN1cnJlbnQuY29lcmNlZElucHV0RmllbGRzLCBwcmV2aW91cy5jb2VyY2VkSW5wdXRGaWVsZHMpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICghaXNTZXRFcXVhbChjdXJyZW50LnJlc3RyaWN0ZWRJbnB1dEZpZWxkcywgcHJldmlvdXMucmVzdHJpY3RlZElucHV0RmllbGRzKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoIWlzU2V0RXF1YWwoY3VycmVudC5zdHJpbmdMaXRlcmFsSW5wdXRGaWVsZHMsIHByZXZpb3VzLnN0cmluZ0xpdGVyYWxJbnB1dEZpZWxkcykpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCFpc1NldEVxdWFsKGN1cnJlbnQudW5kZWNsYXJlZElucHV0RmllbGRzLCBwcmV2aW91cy51bmRlY2xhcmVkSW5wdXRGaWVsZHMpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpc1RlbXBsYXRlR3VhcmRFcXVhbChjdXJyZW50OiBUZW1wbGF0ZUd1YXJkTWV0YSwgcHJldmlvdXM6IFRlbXBsYXRlR3VhcmRNZXRhKTogYm9vbGVhbiB7XG4gIHJldHVybiBjdXJyZW50LmlucHV0TmFtZSA9PT0gcHJldmlvdXMuaW5wdXROYW1lICYmIGN1cnJlbnQudHlwZSA9PT0gcHJldmlvdXMudHlwZTtcbn1cblxuZnVuY3Rpb24gaXNCYXNlQ2xhc3NFcXVhbChjdXJyZW50OiBTZW1hbnRpY1N5bWJvbHxudWxsLCBwcmV2aW91czogU2VtYW50aWNTeW1ib2x8bnVsbCk6IGJvb2xlYW4ge1xuICBpZiAoY3VycmVudCA9PT0gbnVsbCB8fCBwcmV2aW91cyA9PT0gbnVsbCkge1xuICAgIHJldHVybiBjdXJyZW50ID09PSBwcmV2aW91cztcbiAgfVxuXG4gIHJldHVybiBpc1N5bWJvbEVxdWFsKGN1cnJlbnQsIHByZXZpb3VzKTtcbn1cblxuZXhwb3J0IGNsYXNzIERpcmVjdGl2ZURlY29yYXRvckhhbmRsZXIgaW1wbGVtZW50c1xuICAgIERlY29yYXRvckhhbmRsZXI8RGVjb3JhdG9yfG51bGwsIERpcmVjdGl2ZUhhbmRsZXJEYXRhLCBEaXJlY3RpdmVTeW1ib2wsIHVua25vd24+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIHByaXZhdGUgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yLFxuICAgICAgcHJpdmF0ZSBtZXRhUmVnaXN0cnk6IE1ldGFkYXRhUmVnaXN0cnksIHByaXZhdGUgc2NvcGVSZWdpc3RyeTogTG9jYWxNb2R1bGVTY29wZVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBtZXRhUmVhZGVyOiBNZXRhZGF0YVJlYWRlciwgcHJpdmF0ZSBpbmplY3RhYmxlUmVnaXN0cnk6IEluamVjdGFibGVDbGFzc1JlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBpc0NvcmU6IGJvb2xlYW4sIHByaXZhdGUgc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXI6IFNlbWFudGljRGVwR3JhcGhVcGRhdGVyfG51bGwsXG4gICAgICBwcml2YXRlIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyOiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSBjb21waWxlVW5kZWNvcmF0ZWRDbGFzc2VzV2l0aEFuZ3VsYXJGZWF0dXJlczogYm9vbGVhbiwgcHJpdmF0ZSBwZXJmOiBQZXJmUmVjb3JkZXIpIHt9XG5cbiAgcmVhZG9ubHkgcHJlY2VkZW5jZSA9IEhhbmRsZXJQcmVjZWRlbmNlLlBSSU1BUlk7XG4gIHJlYWRvbmx5IG5hbWUgPSBEaXJlY3RpdmVEZWNvcmF0b3JIYW5kbGVyLm5hbWU7XG5cbiAgZGV0ZWN0KG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGRlY29yYXRvcnM6IERlY29yYXRvcltdfG51bGwpOlxuICAgICAgRGV0ZWN0UmVzdWx0PERlY29yYXRvcnxudWxsPnx1bmRlZmluZWQge1xuICAgIC8vIElmIGEgY2xhc3MgaXMgdW5kZWNvcmF0ZWQgYnV0IHVzZXMgQW5ndWxhciBmZWF0dXJlcywgd2UgZGV0ZWN0IGl0IGFzIGFuXG4gICAgLy8gYWJzdHJhY3QgZGlyZWN0aXZlLiBUaGlzIGlzIGFuIHVuc3VwcG9ydGVkIHBhdHRlcm4gYXMgb2YgdjEwLCBidXQgd2Ugd2FudFxuICAgIC8vIHRvIHN0aWxsIGRldGVjdCB0aGVzZSBwYXR0ZXJucyBzbyB0aGF0IHdlIGNhbiByZXBvcnQgZGlhZ25vc3RpY3MsIG9yIGNvbXBpbGVcbiAgICAvLyB0aGVtIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSBpbiBuZ2NjLlxuICAgIGlmICghZGVjb3JhdG9ycykge1xuICAgICAgY29uc3QgYW5ndWxhckZpZWxkID0gdGhpcy5maW5kQ2xhc3NGaWVsZFdpdGhBbmd1bGFyRmVhdHVyZXMobm9kZSk7XG4gICAgICByZXR1cm4gYW5ndWxhckZpZWxkID8ge3RyaWdnZXI6IGFuZ3VsYXJGaWVsZC5ub2RlLCBkZWNvcmF0b3I6IG51bGwsIG1ldGFkYXRhOiBudWxsfSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBkZWNvcmF0b3IgPSBmaW5kQW5ndWxhckRlY29yYXRvcihkZWNvcmF0b3JzLCAnRGlyZWN0aXZlJywgdGhpcy5pc0NvcmUpO1xuICAgICAgcmV0dXJuIGRlY29yYXRvciA/IHt0cmlnZ2VyOiBkZWNvcmF0b3Iubm9kZSwgZGVjb3JhdG9yLCBtZXRhZGF0YTogZGVjb3JhdG9yfSA6IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICBhbmFseXplKG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGRlY29yYXRvcjogUmVhZG9ubHk8RGVjb3JhdG9yfG51bGw+LCBmbGFncyA9IEhhbmRsZXJGbGFncy5OT05FKTpcbiAgICAgIEFuYWx5c2lzT3V0cHV0PERpcmVjdGl2ZUhhbmRsZXJEYXRhPiB7XG4gICAgLy8gU2tpcCBwcm9jZXNzaW5nIG9mIHRoZSBjbGFzcyBkZWNsYXJhdGlvbiBpZiBjb21waWxhdGlvbiBvZiB1bmRlY29yYXRlZCBjbGFzc2VzXG4gICAgLy8gd2l0aCBBbmd1bGFyIGZlYXR1cmVzIGlzIGRpc2FibGVkLiBQcmV2aW91c2x5IGluIG5ndHNjLCBzdWNoIGNsYXNzZXMgaGF2ZSBhbHdheXNcbiAgICAvLyBiZWVuIHByb2Nlc3NlZCwgYnV0IHdlIHdhbnQgdG8gZW5mb3JjZSBhIGNvbnNpc3RlbnQgZGVjb3JhdG9yIG1lbnRhbCBtb2RlbC5cbiAgICAvLyBTZWU6IGh0dHBzOi8vdjkuYW5ndWxhci5pby9ndWlkZS9taWdyYXRpb24tdW5kZWNvcmF0ZWQtY2xhc3Nlcy5cbiAgICBpZiAodGhpcy5jb21waWxlVW5kZWNvcmF0ZWRDbGFzc2VzV2l0aEFuZ3VsYXJGZWF0dXJlcyA9PT0gZmFsc2UgJiYgZGVjb3JhdG9yID09PSBudWxsKSB7XG4gICAgICByZXR1cm4ge2RpYWdub3N0aWNzOiBbZ2V0VW5kZWNvcmF0ZWRDbGFzc1dpdGhBbmd1bGFyRmVhdHVyZXNEaWFnbm9zdGljKG5vZGUpXX07XG4gICAgfVxuXG4gICAgdGhpcy5wZXJmLmV2ZW50Q291bnQoUGVyZkV2ZW50LkFuYWx5emVEaXJlY3RpdmUpO1xuXG4gICAgY29uc3QgZGlyZWN0aXZlUmVzdWx0ID0gZXh0cmFjdERpcmVjdGl2ZU1ldGFkYXRhKFxuICAgICAgICBub2RlLCBkZWNvcmF0b3IsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvciwgdGhpcy5pc0NvcmUsIGZsYWdzLFxuICAgICAgICB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKTtcbiAgICBpZiAoZGlyZWN0aXZlUmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gICAgY29uc3QgYW5hbHlzaXMgPSBkaXJlY3RpdmVSZXN1bHQubWV0YWRhdGE7XG5cbiAgICBsZXQgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeTogU2V0PFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj58bnVsbCA9IG51bGw7XG4gICAgaWYgKGRpcmVjdGl2ZVJlc3VsdCAhPT0gdW5kZWZpbmVkICYmIGRpcmVjdGl2ZVJlc3VsdC5kZWNvcmF0b3IuaGFzKCdwcm92aWRlcnMnKSkge1xuICAgICAgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSA9IHJlc29sdmVQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5KFxuICAgICAgICAgIGRpcmVjdGl2ZVJlc3VsdC5kZWNvcmF0b3IuZ2V0KCdwcm92aWRlcnMnKSEsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFuYWx5c2lzOiB7XG4gICAgICAgIGlucHV0czogZGlyZWN0aXZlUmVzdWx0LmlucHV0cyxcbiAgICAgICAgb3V0cHV0czogZGlyZWN0aXZlUmVzdWx0Lm91dHB1dHMsXG4gICAgICAgIG1ldGE6IGFuYWx5c2lzLFxuICAgICAgICBjbGFzc01ldGFkYXRhOiBleHRyYWN0Q2xhc3NNZXRhZGF0YShcbiAgICAgICAgICAgIG5vZGUsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmlzQ29yZSwgdGhpcy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciksXG4gICAgICAgIGJhc2VDbGFzczogcmVhZEJhc2VDbGFzcyhub2RlLCB0aGlzLnJlZmxlY3RvciwgdGhpcy5ldmFsdWF0b3IpLFxuICAgICAgICB0eXBlQ2hlY2tNZXRhOiBleHRyYWN0RGlyZWN0aXZlVHlwZUNoZWNrTWV0YShub2RlLCBkaXJlY3RpdmVSZXN1bHQuaW5wdXRzLCB0aGlzLnJlZmxlY3RvciksXG4gICAgICAgIHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnksXG4gICAgICAgIGlzUG9pc29uZWQ6IGZhbHNlLFxuICAgICAgICBpc1N0cnVjdHVyYWw6IGRpcmVjdGl2ZVJlc3VsdC5pc1N0cnVjdHVyYWwsXG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHN5bWJvbChub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogUmVhZG9ubHk8RGlyZWN0aXZlSGFuZGxlckRhdGE+KTogRGlyZWN0aXZlU3ltYm9sIHtcbiAgICBjb25zdCB0eXBlUGFyYW1ldGVycyA9IGV4dHJhY3RTZW1hbnRpY1R5cGVQYXJhbWV0ZXJzKG5vZGUpO1xuXG4gICAgcmV0dXJuIG5ldyBEaXJlY3RpdmVTeW1ib2woXG4gICAgICAgIG5vZGUsIGFuYWx5c2lzLm1ldGEuc2VsZWN0b3IsIGFuYWx5c2lzLmlucHV0cywgYW5hbHlzaXMub3V0cHV0cywgYW5hbHlzaXMubWV0YS5leHBvcnRBcyxcbiAgICAgICAgYW5hbHlzaXMudHlwZUNoZWNrTWV0YSwgdHlwZVBhcmFtZXRlcnMpO1xuICB9XG5cbiAgcmVnaXN0ZXIobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IFJlYWRvbmx5PERpcmVjdGl2ZUhhbmRsZXJEYXRhPik6IHZvaWQge1xuICAgIC8vIFJlZ2lzdGVyIHRoaXMgZGlyZWN0aXZlJ3MgaW5mb3JtYXRpb24gd2l0aCB0aGUgYE1ldGFkYXRhUmVnaXN0cnlgLiBUaGlzIGVuc3VyZXMgdGhhdFxuICAgIC8vIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZGlyZWN0aXZlIGlzIGF2YWlsYWJsZSBkdXJpbmcgdGhlIGNvbXBpbGUoKSBwaGFzZS5cbiAgICBjb25zdCByZWYgPSBuZXcgUmVmZXJlbmNlKG5vZGUpO1xuICAgIHRoaXMubWV0YVJlZ2lzdHJ5LnJlZ2lzdGVyRGlyZWN0aXZlTWV0YWRhdGEoe1xuICAgICAgdHlwZTogTWV0YVR5cGUuRGlyZWN0aXZlLFxuICAgICAgcmVmLFxuICAgICAgbmFtZTogbm9kZS5uYW1lLnRleHQsXG4gICAgICBzZWxlY3RvcjogYW5hbHlzaXMubWV0YS5zZWxlY3RvcixcbiAgICAgIGV4cG9ydEFzOiBhbmFseXNpcy5tZXRhLmV4cG9ydEFzLFxuICAgICAgaW5wdXRzOiBhbmFseXNpcy5pbnB1dHMsXG4gICAgICBvdXRwdXRzOiBhbmFseXNpcy5vdXRwdXRzLFxuICAgICAgcXVlcmllczogYW5hbHlzaXMubWV0YS5xdWVyaWVzLm1hcChxdWVyeSA9PiBxdWVyeS5wcm9wZXJ0eU5hbWUpLFxuICAgICAgaXNDb21wb25lbnQ6IGZhbHNlLFxuICAgICAgYmFzZUNsYXNzOiBhbmFseXNpcy5iYXNlQ2xhc3MsXG4gICAgICAuLi5hbmFseXNpcy50eXBlQ2hlY2tNZXRhLFxuICAgICAgaXNQb2lzb25lZDogYW5hbHlzaXMuaXNQb2lzb25lZCxcbiAgICAgIGlzU3RydWN0dXJhbDogYW5hbHlzaXMuaXNTdHJ1Y3R1cmFsLFxuICAgIH0pO1xuXG4gICAgdGhpcy5pbmplY3RhYmxlUmVnaXN0cnkucmVnaXN0ZXJJbmplY3RhYmxlKG5vZGUpO1xuICB9XG5cbiAgcmVzb2x2ZShub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogRGlyZWN0aXZlSGFuZGxlckRhdGEsIHN5bWJvbDogRGlyZWN0aXZlU3ltYm9sKTpcbiAgICAgIFJlc29sdmVSZXN1bHQ8dW5rbm93bj4ge1xuICAgIGlmICh0aGlzLnNlbWFudGljRGVwR3JhcGhVcGRhdGVyICE9PSBudWxsICYmIGFuYWx5c2lzLmJhc2VDbGFzcyBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgICAgc3ltYm9sLmJhc2VDbGFzcyA9IHRoaXMuc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIuZ2V0U3ltYm9sKGFuYWx5c2lzLmJhc2VDbGFzcy5ub2RlKTtcbiAgICB9XG5cbiAgICBjb25zdCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gICAgaWYgKGFuYWx5c2lzLnByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkgIT09IG51bGwgJiZcbiAgICAgICAgYW5hbHlzaXMubWV0YS5wcm92aWRlcnMgaW5zdGFuY2VvZiBXcmFwcGVkTm9kZUV4cHIpIHtcbiAgICAgIGNvbnN0IHByb3ZpZGVyRGlhZ25vc3RpY3MgPSBnZXRQcm92aWRlckRpYWdub3N0aWNzKFxuICAgICAgICAgIGFuYWx5c2lzLnByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnksIGFuYWx5c2lzLm1ldGEucHJvdmlkZXJzIS5ub2RlLFxuICAgICAgICAgIHRoaXMuaW5qZWN0YWJsZVJlZ2lzdHJ5KTtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4ucHJvdmlkZXJEaWFnbm9zdGljcyk7XG4gICAgfVxuXG4gICAgY29uc3QgZGlyZWN0aXZlRGlhZ25vc3RpY3MgPSBnZXREaXJlY3RpdmVEaWFnbm9zdGljcyhcbiAgICAgICAgbm9kZSwgdGhpcy5tZXRhUmVhZGVyLCB0aGlzLmV2YWx1YXRvciwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuc2NvcGVSZWdpc3RyeSwgJ0RpcmVjdGl2ZScpO1xuICAgIGlmIChkaXJlY3RpdmVEaWFnbm9zdGljcyAhPT0gbnVsbCkge1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi5kaXJlY3RpdmVEaWFnbm9zdGljcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtkaWFnbm9zdGljczogZGlhZ25vc3RpY3MubGVuZ3RoID4gMCA/IGRpYWdub3N0aWNzIDogdW5kZWZpbmVkfTtcbiAgfVxuXG4gIGNvbXBpbGVGdWxsKFxuICAgICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IFJlYWRvbmx5PERpcmVjdGl2ZUhhbmRsZXJEYXRhPixcbiAgICAgIHJlc29sdXRpb246IFJlYWRvbmx5PHVua25vd24+LCBwb29sOiBDb25zdGFudFBvb2wpOiBDb21waWxlUmVzdWx0W10ge1xuICAgIGNvbnN0IGZhYyA9IGNvbXBpbGVOZ0ZhY3RvcnlEZWZGaWVsZCh0b0ZhY3RvcnlNZXRhZGF0YShhbmFseXNpcy5tZXRhLCBGYWN0b3J5VGFyZ2V0LkRpcmVjdGl2ZSkpO1xuICAgIGNvbnN0IGRlZiA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEoYW5hbHlzaXMubWV0YSwgcG9vbCwgbWFrZUJpbmRpbmdQYXJzZXIoKSk7XG4gICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IGFuYWx5c2lzLmNsYXNzTWV0YWRhdGEgIT09IG51bGwgP1xuICAgICAgICBjb21waWxlQ2xhc3NNZXRhZGF0YShhbmFseXNpcy5jbGFzc01ldGFkYXRhKS50b1N0bXQoKSA6XG4gICAgICAgIG51bGw7XG4gICAgcmV0dXJuIGNvbXBpbGVSZXN1bHRzKGZhYywgZGVmLCBjbGFzc01ldGFkYXRhLCAnybVkaXInKTtcbiAgfVxuXG4gIGNvbXBpbGVQYXJ0aWFsKFxuICAgICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IFJlYWRvbmx5PERpcmVjdGl2ZUhhbmRsZXJEYXRhPixcbiAgICAgIHJlc29sdXRpb246IFJlYWRvbmx5PHVua25vd24+KTogQ29tcGlsZVJlc3VsdFtdIHtcbiAgICBjb25zdCBmYWMgPSBjb21waWxlRGVjbGFyZUZhY3RvcnkodG9GYWN0b3J5TWV0YWRhdGEoYW5hbHlzaXMubWV0YSwgRmFjdG9yeVRhcmdldC5EaXJlY3RpdmUpKTtcbiAgICBjb25zdCBkZWYgPSBjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YShhbmFseXNpcy5tZXRhKTtcbiAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gYW5hbHlzaXMuY2xhc3NNZXRhZGF0YSAhPT0gbnVsbCA/XG4gICAgICAgIGNvbXBpbGVEZWNsYXJlQ2xhc3NNZXRhZGF0YShhbmFseXNpcy5jbGFzc01ldGFkYXRhKS50b1N0bXQoKSA6XG4gICAgICAgIG51bGw7XG4gICAgcmV0dXJuIGNvbXBpbGVSZXN1bHRzKGZhYywgZGVmLCBjbGFzc01ldGFkYXRhLCAnybVkaXInKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYSBnaXZlbiBjbGFzcyB1c2VzIEFuZ3VsYXIgZmVhdHVyZXMgYW5kIHJldHVybnMgdGhlIFR5cGVTY3JpcHQgbm9kZVxuICAgKiB0aGF0IGluZGljYXRlZCB0aGUgdXNhZ2UuIENsYXNzZXMgYXJlIGNvbnNpZGVyZWQgdXNpbmcgQW5ndWxhciBmZWF0dXJlcyBpZiB0aGV5XG4gICAqIGNvbnRhaW4gY2xhc3MgbWVtYmVycyB0aGF0IGFyZSBlaXRoZXIgZGVjb3JhdGVkIHdpdGggYSBrbm93biBBbmd1bGFyIGRlY29yYXRvcixcbiAgICogb3IgaWYgdGhleSBjb3JyZXNwb25kIHRvIGEga25vd24gQW5ndWxhciBsaWZlY3ljbGUgaG9vay5cbiAgICovXG4gIHByaXZhdGUgZmluZENsYXNzRmllbGRXaXRoQW5ndWxhckZlYXR1cmVzKG5vZGU6IENsYXNzRGVjbGFyYXRpb24pOiBDbGFzc01lbWJlcnx1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnJlZmxlY3Rvci5nZXRNZW1iZXJzT2ZDbGFzcyhub2RlKS5maW5kKG1lbWJlciA9PiB7XG4gICAgICBpZiAoIW1lbWJlci5pc1N0YXRpYyAmJiBtZW1iZXIua2luZCA9PT0gQ2xhc3NNZW1iZXJLaW5kLk1ldGhvZCAmJlxuICAgICAgICAgIExJRkVDWUNMRV9IT09LUy5oYXMobWVtYmVyLm5hbWUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG1lbWJlci5kZWNvcmF0b3JzKSB7XG4gICAgICAgIHJldHVybiBtZW1iZXIuZGVjb3JhdG9ycy5zb21lKFxuICAgICAgICAgICAgZGVjb3JhdG9yID0+IEZJRUxEX0RFQ09SQVRPUlMuc29tZShcbiAgICAgICAgICAgICAgICBkZWNvcmF0b3JOYW1lID0+IGlzQW5ndWxhckRlY29yYXRvcihkZWNvcmF0b3IsIGRlY29yYXRvck5hbWUsIHRoaXMuaXNDb3JlKSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGV4dHJhY3QgbWV0YWRhdGEgZnJvbSBhIGBEaXJlY3RpdmVgIG9yIGBDb21wb25lbnRgLiBgRGlyZWN0aXZlYHMgd2l0aG91dCBhXG4gKiBzZWxlY3RvciBhcmUgYWxsb3dlZCB0byBiZSB1c2VkIGZvciBhYnN0cmFjdCBiYXNlIGNsYXNzZXMuIFRoZXNlIGFic3RyYWN0IGRpcmVjdGl2ZXMgc2hvdWxkIG5vdFxuICogYXBwZWFyIGluIHRoZSBkZWNsYXJhdGlvbnMgb2YgYW4gYE5nTW9kdWxlYCBhbmQgYWRkaXRpb25hbCB2ZXJpZmljYXRpb24gaXMgZG9uZSB3aGVuIHByb2Nlc3NpbmdcbiAqIHRoZSBtb2R1bGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0RGlyZWN0aXZlTWV0YWRhdGEoXG4gICAgY2xheno6IENsYXNzRGVjbGFyYXRpb24sIGRlY29yYXRvcjogUmVhZG9ubHk8RGVjb3JhdG9yfG51bGw+LCByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvciwgaXNDb3JlOiBib29sZWFuLCBmbGFnczogSGFuZGxlckZsYWdzLFxuICAgIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyOiBib29sZWFuLCBkZWZhdWx0U2VsZWN0b3I6IHN0cmluZ3xudWxsID0gbnVsbCk6IHtcbiAgZGVjb3JhdG9yOiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPixcbiAgbWV0YWRhdGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsXG4gIGlucHV0czogQ2xhc3NQcm9wZXJ0eU1hcHBpbmcsXG4gIG91dHB1dHM6IENsYXNzUHJvcGVydHlNYXBwaW5nLFxuICBpc1N0cnVjdHVyYWw6IGJvb2xlYW47XG59fHVuZGVmaW5lZCB7XG4gIGxldCBkaXJlY3RpdmU6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+O1xuICBpZiAoZGVjb3JhdG9yID09PSBudWxsIHx8IGRlY29yYXRvci5hcmdzID09PSBudWxsIHx8IGRlY29yYXRvci5hcmdzLmxlbmd0aCA9PT0gMCkge1xuICAgIGRpcmVjdGl2ZSA9IG5ldyBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPigpO1xuICB9IGVsc2UgaWYgKGRlY29yYXRvci5hcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUklUWV9XUk9ORywgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLFxuICAgICAgICBgSW5jb3JyZWN0IG51bWJlciBvZiBhcmd1bWVudHMgdG8gQCR7ZGVjb3JhdG9yLm5hbWV9IGRlY29yYXRvcmApO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IG1ldGEgPSB1bndyYXBFeHByZXNzaW9uKGRlY29yYXRvci5hcmdzWzBdKTtcbiAgICBpZiAoIXRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24obWV0YSkpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSR19OT1RfTElURVJBTCwgbWV0YSxcbiAgICAgICAgICBgQCR7ZGVjb3JhdG9yLm5hbWV9IGFyZ3VtZW50IG11c3QgYmUgYW4gb2JqZWN0IGxpdGVyYWxgKTtcbiAgICB9XG4gICAgZGlyZWN0aXZlID0gcmVmbGVjdE9iamVjdExpdGVyYWwobWV0YSk7XG4gIH1cblxuICBpZiAoZGlyZWN0aXZlLmhhcygnaml0JykpIHtcbiAgICAvLyBUaGUgb25seSBhbGxvd2VkIHZhbHVlIGlzIHRydWUsIHNvIHRoZXJlJ3Mgbm8gbmVlZCB0byBleHBhbmQgZnVydGhlci5cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgbWVtYmVycyA9IHJlZmxlY3Rvci5nZXRNZW1iZXJzT2ZDbGFzcyhjbGF6eik7XG5cbiAgLy8gUHJlY29tcHV0ZSBhIGxpc3Qgb2YgdHMuQ2xhc3NFbGVtZW50cyB0aGF0IGhhdmUgZGVjb3JhdG9ycy4gVGhpcyBpbmNsdWRlcyB0aGluZ3MgbGlrZSBASW5wdXQsXG4gIC8vIEBPdXRwdXQsIEBIb3N0QmluZGluZywgZXRjLlxuICBjb25zdCBkZWNvcmF0ZWRFbGVtZW50cyA9XG4gICAgICBtZW1iZXJzLmZpbHRlcihtZW1iZXIgPT4gIW1lbWJlci5pc1N0YXRpYyAmJiBtZW1iZXIuZGVjb3JhdG9ycyAhPT0gbnVsbCk7XG5cbiAgY29uc3QgY29yZU1vZHVsZSA9IGlzQ29yZSA/IHVuZGVmaW5lZCA6ICdAYW5ndWxhci9jb3JlJztcblxuICAvLyBDb25zdHJ1Y3QgdGhlIG1hcCBvZiBpbnB1dHMgYm90aCBmcm9tIHRoZSBARGlyZWN0aXZlL0BDb21wb25lbnRcbiAgLy8gZGVjb3JhdG9yLCBhbmQgdGhlIGRlY29yYXRlZFxuICAvLyBmaWVsZHMuXG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhID0gcGFyc2VGaWVsZFRvUHJvcGVydHlNYXBwaW5nKGRpcmVjdGl2ZSwgJ2lucHV0cycsIGV2YWx1YXRvcik7XG4gIGNvbnN0IGlucHV0c0Zyb21GaWVsZHMgPSBwYXJzZURlY29yYXRlZEZpZWxkcyhcbiAgICAgIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IoZGVjb3JhdGVkRWxlbWVudHMsICdJbnB1dCcsIGNvcmVNb2R1bGUpLCBldmFsdWF0b3IsXG4gICAgICByZXNvbHZlSW5wdXQpO1xuXG4gIC8vIEFuZCBvdXRwdXRzLlxuICBjb25zdCBvdXRwdXRzRnJvbU1ldGEgPSBwYXJzZUZpZWxkVG9Qcm9wZXJ0eU1hcHBpbmcoZGlyZWN0aXZlLCAnb3V0cHV0cycsIGV2YWx1YXRvcik7XG4gIGNvbnN0IG91dHB1dHNGcm9tRmllbGRzID1cbiAgICAgIHBhcnNlRGVjb3JhdGVkRmllbGRzKFxuICAgICAgICAgIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IoZGVjb3JhdGVkRWxlbWVudHMsICdPdXRwdXQnLCBjb3JlTW9kdWxlKSwgZXZhbHVhdG9yLFxuICAgICAgICAgIHJlc29sdmVPdXRwdXQpIGFzIHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ307XG4gIC8vIENvbnN0cnVjdCB0aGUgbGlzdCBvZiBxdWVyaWVzLlxuICBjb25zdCBjb250ZW50Q2hpbGRGcm9tRmllbGRzID0gcXVlcmllc0Zyb21GaWVsZHMoXG4gICAgICBmaWx0ZXJUb01lbWJlcnNXaXRoRGVjb3JhdG9yKGRlY29yYXRlZEVsZW1lbnRzLCAnQ29udGVudENoaWxkJywgY29yZU1vZHVsZSksIHJlZmxlY3RvcixcbiAgICAgIGV2YWx1YXRvcik7XG4gIGNvbnN0IGNvbnRlbnRDaGlsZHJlbkZyb21GaWVsZHMgPSBxdWVyaWVzRnJvbUZpZWxkcyhcbiAgICAgIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IoZGVjb3JhdGVkRWxlbWVudHMsICdDb250ZW50Q2hpbGRyZW4nLCBjb3JlTW9kdWxlKSwgcmVmbGVjdG9yLFxuICAgICAgZXZhbHVhdG9yKTtcblxuICBjb25zdCBxdWVyaWVzID0gWy4uLmNvbnRlbnRDaGlsZEZyb21GaWVsZHMsIC4uLmNvbnRlbnRDaGlsZHJlbkZyb21GaWVsZHNdO1xuXG4gIC8vIENvbnN0cnVjdCB0aGUgbGlzdCBvZiB2aWV3IHF1ZXJpZXMuXG4gIGNvbnN0IHZpZXdDaGlsZEZyb21GaWVsZHMgPSBxdWVyaWVzRnJvbUZpZWxkcyhcbiAgICAgIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IoZGVjb3JhdGVkRWxlbWVudHMsICdWaWV3Q2hpbGQnLCBjb3JlTW9kdWxlKSwgcmVmbGVjdG9yLFxuICAgICAgZXZhbHVhdG9yKTtcbiAgY29uc3Qgdmlld0NoaWxkcmVuRnJvbUZpZWxkcyA9IHF1ZXJpZXNGcm9tRmllbGRzKFxuICAgICAgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvcihkZWNvcmF0ZWRFbGVtZW50cywgJ1ZpZXdDaGlsZHJlbicsIGNvcmVNb2R1bGUpLCByZWZsZWN0b3IsXG4gICAgICBldmFsdWF0b3IpO1xuICBjb25zdCB2aWV3UXVlcmllcyA9IFsuLi52aWV3Q2hpbGRGcm9tRmllbGRzLCAuLi52aWV3Q2hpbGRyZW5Gcm9tRmllbGRzXTtcblxuICBpZiAoZGlyZWN0aXZlLmhhcygncXVlcmllcycpKSB7XG4gICAgY29uc3QgcXVlcmllc0Zyb21EZWNvcmF0b3IgPVxuICAgICAgICBleHRyYWN0UXVlcmllc0Zyb21EZWNvcmF0b3IoZGlyZWN0aXZlLmdldCgncXVlcmllcycpISwgcmVmbGVjdG9yLCBldmFsdWF0b3IsIGlzQ29yZSk7XG4gICAgcXVlcmllcy5wdXNoKC4uLnF1ZXJpZXNGcm9tRGVjb3JhdG9yLmNvbnRlbnQpO1xuICAgIHZpZXdRdWVyaWVzLnB1c2goLi4ucXVlcmllc0Zyb21EZWNvcmF0b3Iudmlldyk7XG4gIH1cblxuICAvLyBQYXJzZSB0aGUgc2VsZWN0b3IuXG4gIGxldCBzZWxlY3RvciA9IGRlZmF1bHRTZWxlY3RvcjtcbiAgaWYgKGRpcmVjdGl2ZS5oYXMoJ3NlbGVjdG9yJykpIHtcbiAgICBjb25zdCBleHByID0gZGlyZWN0aXZlLmdldCgnc2VsZWN0b3InKSE7XG4gICAgY29uc3QgcmVzb2x2ZWQgPSBldmFsdWF0b3IuZXZhbHVhdGUoZXhwcik7XG4gICAgaWYgKHR5cGVvZiByZXNvbHZlZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoZXhwciwgcmVzb2x2ZWQsIGBzZWxlY3RvciBtdXN0IGJlIGEgc3RyaW5nYCk7XG4gICAgfVxuICAgIC8vIHVzZSBkZWZhdWx0IHNlbGVjdG9yIGluIGNhc2Ugc2VsZWN0b3IgaXMgYW4gZW1wdHkgc3RyaW5nXG4gICAgc2VsZWN0b3IgPSByZXNvbHZlZCA9PT0gJycgPyBkZWZhdWx0U2VsZWN0b3IgOiByZXNvbHZlZDtcbiAgICBpZiAoIXNlbGVjdG9yKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgRXJyb3JDb2RlLkRJUkVDVElWRV9NSVNTSU5HX1NFTEVDVE9SLCBleHByLFxuICAgICAgICAgIGBEaXJlY3RpdmUgJHtjbGF6ei5uYW1lLnRleHR9IGhhcyBubyBzZWxlY3RvciwgcGxlYXNlIGFkZCBpdCFgKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBob3N0ID0gZXh0cmFjdEhvc3RCaW5kaW5ncyhkZWNvcmF0ZWRFbGVtZW50cywgZXZhbHVhdG9yLCBjb3JlTW9kdWxlLCBkaXJlY3RpdmUpO1xuXG4gIGNvbnN0IHByb3ZpZGVyczogRXhwcmVzc2lvbnxudWxsID0gZGlyZWN0aXZlLmhhcygncHJvdmlkZXJzJykgP1xuICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihcbiAgICAgICAgICBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA/XG4gICAgICAgICAgICAgIHdyYXBGdW5jdGlvbkV4cHJlc3Npb25zSW5QYXJlbnMoZGlyZWN0aXZlLmdldCgncHJvdmlkZXJzJykhKSA6XG4gICAgICAgICAgICAgIGRpcmVjdGl2ZS5nZXQoJ3Byb3ZpZGVycycpISkgOlxuICAgICAgbnVsbDtcblxuICAvLyBEZXRlcm1pbmUgaWYgYG5nT25DaGFuZ2VzYCBpcyBhIGxpZmVjeWNsZSBob29rIGRlZmluZWQgb24gdGhlIGNvbXBvbmVudC5cbiAgY29uc3QgdXNlc09uQ2hhbmdlcyA9IG1lbWJlcnMuc29tZShcbiAgICAgIG1lbWJlciA9PiAhbWVtYmVyLmlzU3RhdGljICYmIG1lbWJlci5raW5kID09PSBDbGFzc01lbWJlcktpbmQuTWV0aG9kICYmXG4gICAgICAgICAgbWVtYmVyLm5hbWUgPT09ICduZ09uQ2hhbmdlcycpO1xuXG4gIC8vIFBhcnNlIGV4cG9ydEFzLlxuICBsZXQgZXhwb3J0QXM6IHN0cmluZ1tdfG51bGwgPSBudWxsO1xuICBpZiAoZGlyZWN0aXZlLmhhcygnZXhwb3J0QXMnKSkge1xuICAgIGNvbnN0IGV4cHIgPSBkaXJlY3RpdmUuZ2V0KCdleHBvcnRBcycpITtcbiAgICBjb25zdCByZXNvbHZlZCA9IGV2YWx1YXRvci5ldmFsdWF0ZShleHByKTtcbiAgICBpZiAodHlwZW9mIHJlc29sdmVkICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihleHByLCByZXNvbHZlZCwgYGV4cG9ydEFzIG11c3QgYmUgYSBzdHJpbmdgKTtcbiAgICB9XG4gICAgZXhwb3J0QXMgPSByZXNvbHZlZC5zcGxpdCgnLCcpLm1hcChwYXJ0ID0+IHBhcnQudHJpbSgpKTtcbiAgfVxuXG4gIGNvbnN0IHJhd0N0b3JEZXBzID0gZ2V0Q29uc3RydWN0b3JEZXBlbmRlbmNpZXMoY2xhenosIHJlZmxlY3RvciwgaXNDb3JlKTtcblxuICAvLyBOb24tYWJzdHJhY3QgZGlyZWN0aXZlcyAodGhvc2Ugd2l0aCBhIHNlbGVjdG9yKSByZXF1aXJlIHZhbGlkIGNvbnN0cnVjdG9yIGRlcGVuZGVuY2llcywgd2hlcmVhc1xuICAvLyBhYnN0cmFjdCBkaXJlY3RpdmVzIGFyZSBhbGxvd2VkIHRvIGhhdmUgaW52YWxpZCBkZXBlbmRlbmNpZXMsIGdpdmVuIHRoYXQgYSBzdWJjbGFzcyBtYXkgY2FsbFxuICAvLyB0aGUgY29uc3RydWN0b3IgZXhwbGljaXRseS5cbiAgY29uc3QgY3RvckRlcHMgPSBzZWxlY3RvciAhPT0gbnVsbCA/IHZhbGlkYXRlQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMoY2xhenosIHJhd0N0b3JEZXBzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bndyYXBDb25zdHJ1Y3RvckRlcGVuZGVuY2llcyhyYXdDdG9yRGVwcyk7XG5cbiAgLy8gU3RydWN0dXJhbCBkaXJlY3RpdmVzIG11c3QgaGF2ZSBhIGBUZW1wbGF0ZVJlZmAgZGVwZW5kZW5jeS5cbiAgY29uc3QgaXNTdHJ1Y3R1cmFsID0gY3RvckRlcHMgIT09IG51bGwgJiYgY3RvckRlcHMgIT09ICdpbnZhbGlkJyAmJlxuICAgICAgY3RvckRlcHMuc29tZShcbiAgICAgICAgICBkZXAgPT4gKGRlcC50b2tlbiBpbnN0YW5jZW9mIEV4dGVybmFsRXhwcikgJiZcbiAgICAgICAgICAgICAgZGVwLnRva2VuLnZhbHVlLm1vZHVsZU5hbWUgPT09ICdAYW5ndWxhci9jb3JlJyAmJlxuICAgICAgICAgICAgICBkZXAudG9rZW4udmFsdWUubmFtZSA9PT0gJ1RlbXBsYXRlUmVmJyk7XG5cbiAgLy8gRGV0ZWN0IGlmIHRoZSBjb21wb25lbnQgaW5oZXJpdHMgZnJvbSBhbm90aGVyIGNsYXNzXG4gIGNvbnN0IHVzZXNJbmhlcml0YW5jZSA9IHJlZmxlY3Rvci5oYXNCYXNlQ2xhc3MoY2xhenopO1xuICBjb25zdCB0eXBlID0gd3JhcFR5cGVSZWZlcmVuY2UocmVmbGVjdG9yLCBjbGF6eik7XG4gIGNvbnN0IGludGVybmFsVHlwZSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIocmVmbGVjdG9yLmdldEludGVybmFsTmFtZU9mQ2xhc3MoY2xhenopKTtcblxuICBjb25zdCBpbnB1dHMgPSBDbGFzc1Byb3BlcnR5TWFwcGluZy5mcm9tTWFwcGVkT2JqZWN0KHsuLi5pbnB1dHNGcm9tTWV0YSwgLi4uaW5wdXRzRnJvbUZpZWxkc30pO1xuICBjb25zdCBvdXRwdXRzID0gQ2xhc3NQcm9wZXJ0eU1hcHBpbmcuZnJvbU1hcHBlZE9iamVjdCh7Li4ub3V0cHV0c0Zyb21NZXRhLCAuLi5vdXRwdXRzRnJvbUZpZWxkc30pO1xuXG4gIGNvbnN0IG1ldGFkYXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhID0ge1xuICAgIG5hbWU6IGNsYXp6Lm5hbWUudGV4dCxcbiAgICBkZXBzOiBjdG9yRGVwcyxcbiAgICBob3N0LFxuICAgIGxpZmVjeWNsZToge1xuICAgICAgdXNlc09uQ2hhbmdlcyxcbiAgICB9LFxuICAgIGlucHV0czogaW5wdXRzLnRvSm9pbnRNYXBwZWRPYmplY3QoKSxcbiAgICBvdXRwdXRzOiBvdXRwdXRzLnRvRGlyZWN0TWFwcGVkT2JqZWN0KCksXG4gICAgcXVlcmllcyxcbiAgICB2aWV3UXVlcmllcyxcbiAgICBzZWxlY3RvcixcbiAgICBmdWxsSW5oZXJpdGFuY2U6ICEhKGZsYWdzICYgSGFuZGxlckZsYWdzLkZVTExfSU5IRVJJVEFOQ0UpLFxuICAgIHR5cGUsXG4gICAgaW50ZXJuYWxUeXBlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiByZWZsZWN0b3IuZ2V0R2VuZXJpY0FyaXR5T2ZDbGFzcyhjbGF6eikgfHwgMCxcbiAgICB0eXBlU291cmNlU3BhbjogY3JlYXRlU291cmNlU3BhbihjbGF6ei5uYW1lKSxcbiAgICB1c2VzSW5oZXJpdGFuY2UsXG4gICAgZXhwb3J0QXMsXG4gICAgcHJvdmlkZXJzXG4gIH07XG4gIHJldHVybiB7XG4gICAgZGVjb3JhdG9yOiBkaXJlY3RpdmUsXG4gICAgbWV0YWRhdGEsXG4gICAgaW5wdXRzLFxuICAgIG91dHB1dHMsXG4gICAgaXNTdHJ1Y3R1cmFsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFF1ZXJ5TWV0YWRhdGEoXG4gICAgZXhwck5vZGU6IHRzLk5vZGUsIG5hbWU6IHN0cmluZywgYXJnczogUmVhZG9ubHlBcnJheTx0cy5FeHByZXNzaW9uPiwgcHJvcGVydHlOYW1lOiBzdHJpbmcsXG4gICAgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCwgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yKTogUjNRdWVyeU1ldGFkYXRhIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSSVRZX1dST05HLCBleHByTm9kZSwgYEAke25hbWV9IG11c3QgaGF2ZSBhcmd1bWVudHNgKTtcbiAgfVxuICBjb25zdCBmaXJzdCA9IG5hbWUgPT09ICdWaWV3Q2hpbGQnIHx8IG5hbWUgPT09ICdDb250ZW50Q2hpbGQnO1xuICBjb25zdCBub2RlID0gdHJ5VW53cmFwRm9yd2FyZFJlZihhcmdzWzBdLCByZWZsZWN0b3IpID8/IGFyZ3NbMF07XG4gIGNvbnN0IGFyZyA9IGV2YWx1YXRvci5ldmFsdWF0ZShub2RlKTtcblxuICAvKiogV2hldGhlciBvciBub3QgdGhpcyBxdWVyeSBzaG91bGQgY29sbGVjdCBvbmx5IHN0YXRpYyByZXN1bHRzIChzZWUgdmlldy9hcGkudHMpICAqL1xuICBsZXQgaXNTdGF0aWM6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAvLyBFeHRyYWN0IHRoZSBwcmVkaWNhdGVcbiAgbGV0IHByZWRpY2F0ZTogRXhwcmVzc2lvbnxzdHJpbmdbXXxudWxsID0gbnVsbDtcbiAgaWYgKGFyZyBpbnN0YW5jZW9mIFJlZmVyZW5jZSB8fCBhcmcgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAvLyBSZWZlcmVuY2VzIGFuZCBwcmVkaWNhdGVzIHRoYXQgY291bGQgbm90IGJlIGV2YWx1YXRlZCBzdGF0aWNhbGx5IGFyZSBlbWl0dGVkIGFzIGlzLlxuICAgIHByZWRpY2F0ZSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIobm9kZSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICBwcmVkaWNhdGUgPSBbYXJnXTtcbiAgfSBlbHNlIGlmIChpc1N0cmluZ0FycmF5T3JEaWUoYXJnLCBgQCR7bmFtZX0gcHJlZGljYXRlYCwgbm9kZSkpIHtcbiAgICBwcmVkaWNhdGUgPSBhcmc7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihub2RlLCBhcmcsIGBAJHtuYW1lfSBwcmVkaWNhdGUgY2Fubm90IGJlIGludGVycHJldGVkYCk7XG4gIH1cblxuICAvLyBFeHRyYWN0IHRoZSByZWFkIGFuZCBkZXNjZW5kYW50cyBvcHRpb25zLlxuICBsZXQgcmVhZDogRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgLy8gVGhlIGRlZmF1bHQgdmFsdWUgZm9yIGRlc2NlbmRhbnRzIGlzIHRydWUgZm9yIGV2ZXJ5IGRlY29yYXRvciBleGNlcHQgQENvbnRlbnRDaGlsZHJlbi5cbiAgbGV0IGRlc2NlbmRhbnRzOiBib29sZWFuID0gbmFtZSAhPT0gJ0NvbnRlbnRDaGlsZHJlbic7XG4gIGxldCBlbWl0RGlzdGluY3RDaGFuZ2VzT25seTogYm9vbGVhbiA9IGVtaXREaXN0aW5jdENoYW5nZXNPbmx5RGVmYXVsdFZhbHVlO1xuICBpZiAoYXJncy5sZW5ndGggPT09IDIpIHtcbiAgICBjb25zdCBvcHRpb25zRXhwciA9IHVud3JhcEV4cHJlc3Npb24oYXJnc1sxXSk7XG4gICAgaWYgKCF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKG9wdGlvbnNFeHByKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJHX05PVF9MSVRFUkFMLCBvcHRpb25zRXhwcixcbiAgICAgICAgICBgQCR7bmFtZX0gb3B0aW9ucyBtdXN0IGJlIGFuIG9iamVjdCBsaXRlcmFsYCk7XG4gICAgfVxuICAgIGNvbnN0IG9wdGlvbnMgPSByZWZsZWN0T2JqZWN0TGl0ZXJhbChvcHRpb25zRXhwcik7XG4gICAgaWYgKG9wdGlvbnMuaGFzKCdyZWFkJykpIHtcbiAgICAgIHJlYWQgPSBuZXcgV3JhcHBlZE5vZGVFeHByKG9wdGlvbnMuZ2V0KCdyZWFkJykhKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5oYXMoJ2Rlc2NlbmRhbnRzJykpIHtcbiAgICAgIGNvbnN0IGRlc2NlbmRhbnRzRXhwciA9IG9wdGlvbnMuZ2V0KCdkZXNjZW5kYW50cycpITtcbiAgICAgIGNvbnN0IGRlc2NlbmRhbnRzVmFsdWUgPSBldmFsdWF0b3IuZXZhbHVhdGUoZGVzY2VuZGFudHNFeHByKTtcbiAgICAgIGlmICh0eXBlb2YgZGVzY2VuZGFudHNWYWx1ZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICBkZXNjZW5kYW50c0V4cHIsIGRlc2NlbmRhbnRzVmFsdWUsIGBAJHtuYW1lfSBvcHRpb25zLmRlc2NlbmRhbnRzIG11c3QgYmUgYSBib29sZWFuYCk7XG4gICAgICB9XG4gICAgICBkZXNjZW5kYW50cyA9IGRlc2NlbmRhbnRzVmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuaGFzKCdlbWl0RGlzdGluY3RDaGFuZ2VzT25seScpKSB7XG4gICAgICBjb25zdCBlbWl0RGlzdGluY3RDaGFuZ2VzT25seUV4cHIgPSBvcHRpb25zLmdldCgnZW1pdERpc3RpbmN0Q2hhbmdlc09ubHknKSE7XG4gICAgICBjb25zdCBlbWl0RGlzdGluY3RDaGFuZ2VzT25seVZhbHVlID0gZXZhbHVhdG9yLmV2YWx1YXRlKGVtaXREaXN0aW5jdENoYW5nZXNPbmx5RXhwcik7XG4gICAgICBpZiAodHlwZW9mIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5VmFsdWUgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlFeHByLCBlbWl0RGlzdGluY3RDaGFuZ2VzT25seVZhbHVlLFxuICAgICAgICAgICAgYEAke25hbWV9IG9wdGlvbnMuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgbXVzdCBiZSBhIGJvb2xlYW5gKTtcbiAgICAgIH1cbiAgICAgIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID0gZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlWYWx1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5oYXMoJ3N0YXRpYycpKSB7XG4gICAgICBjb25zdCBzdGF0aWNWYWx1ZSA9IGV2YWx1YXRvci5ldmFsdWF0ZShvcHRpb25zLmdldCgnc3RhdGljJykhKTtcbiAgICAgIGlmICh0eXBlb2Ygc3RhdGljVmFsdWUgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgbm9kZSwgc3RhdGljVmFsdWUsIGBAJHtuYW1lfSBvcHRpb25zLnN0YXRpYyBtdXN0IGJlIGEgYm9vbGVhbmApO1xuICAgICAgfVxuICAgICAgaXNTdGF0aWMgPSBzdGF0aWNWYWx1ZTtcbiAgICB9XG5cbiAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA+IDIpIHtcbiAgICAvLyBUb28gbWFueSBhcmd1bWVudHMuXG4gICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSSVRZX1dST05HLCBub2RlLCBgQCR7bmFtZX0gaGFzIHRvbyBtYW55IGFyZ3VtZW50c2ApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBwcm9wZXJ0eU5hbWUsXG4gICAgcHJlZGljYXRlLFxuICAgIGZpcnN0LFxuICAgIGRlc2NlbmRhbnRzLFxuICAgIHJlYWQsXG4gICAgc3RhdGljOiBpc1N0YXRpYyxcbiAgICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RRdWVyaWVzRnJvbURlY29yYXRvcihcbiAgICBxdWVyeURhdGE6IHRzLkV4cHJlc3Npb24sIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcixcbiAgICBpc0NvcmU6IGJvb2xlYW4pOiB7XG4gIGNvbnRlbnQ6IFIzUXVlcnlNZXRhZGF0YVtdLFxuICB2aWV3OiBSM1F1ZXJ5TWV0YWRhdGFbXSxcbn0ge1xuICBjb25zdCBjb250ZW50OiBSM1F1ZXJ5TWV0YWRhdGFbXSA9IFtdLCB2aWV3OiBSM1F1ZXJ5TWV0YWRhdGFbXSA9IFtdO1xuICBpZiAoIXRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24ocXVlcnlEYXRhKSkge1xuICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgRXJyb3JDb2RlLlZBTFVFX0hBU19XUk9OR19UWVBFLCBxdWVyeURhdGEsXG4gICAgICAgICdEZWNvcmF0b3IgcXVlcmllcyBtZXRhZGF0YSBtdXN0IGJlIGFuIG9iamVjdCBsaXRlcmFsJyk7XG4gIH1cbiAgcmVmbGVjdE9iamVjdExpdGVyYWwocXVlcnlEYXRhKS5mb3JFYWNoKChxdWVyeUV4cHIsIHByb3BlcnR5TmFtZSkgPT4ge1xuICAgIHF1ZXJ5RXhwciA9IHVud3JhcEV4cHJlc3Npb24ocXVlcnlFeHByKTtcbiAgICBpZiAoIXRzLmlzTmV3RXhwcmVzc2lvbihxdWVyeUV4cHIpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgRXJyb3JDb2RlLlZBTFVFX0hBU19XUk9OR19UWVBFLCBxdWVyeURhdGEsXG4gICAgICAgICAgJ0RlY29yYXRvciBxdWVyeSBtZXRhZGF0YSBtdXN0IGJlIGFuIGluc3RhbmNlIG9mIGEgcXVlcnkgdHlwZScpO1xuICAgIH1cbiAgICBjb25zdCBxdWVyeVR5cGUgPSB0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihxdWVyeUV4cHIuZXhwcmVzc2lvbikgP1xuICAgICAgICBxdWVyeUV4cHIuZXhwcmVzc2lvbi5uYW1lIDpcbiAgICAgICAgcXVlcnlFeHByLmV4cHJlc3Npb247XG4gICAgaWYgKCF0cy5pc0lkZW50aWZpZXIocXVlcnlUeXBlKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5WQUxVRV9IQVNfV1JPTkdfVFlQRSwgcXVlcnlEYXRhLFxuICAgICAgICAgICdEZWNvcmF0b3IgcXVlcnkgbWV0YWRhdGEgbXVzdCBiZSBhbiBpbnN0YW5jZSBvZiBhIHF1ZXJ5IHR5cGUnKTtcbiAgICB9XG4gICAgY29uc3QgdHlwZSA9IHJlZmxlY3Rvci5nZXRJbXBvcnRPZklkZW50aWZpZXIocXVlcnlUeXBlKTtcbiAgICBpZiAodHlwZSA9PT0gbnVsbCB8fCAoIWlzQ29yZSAmJiB0eXBlLmZyb20gIT09ICdAYW5ndWxhci9jb3JlJykgfHxcbiAgICAgICAgIVFVRVJZX1RZUEVTLmhhcyh0eXBlLm5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgRXJyb3JDb2RlLlZBTFVFX0hBU19XUk9OR19UWVBFLCBxdWVyeURhdGEsXG4gICAgICAgICAgJ0RlY29yYXRvciBxdWVyeSBtZXRhZGF0YSBtdXN0IGJlIGFuIGluc3RhbmNlIG9mIGEgcXVlcnkgdHlwZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHF1ZXJ5ID0gZXh0cmFjdFF1ZXJ5TWV0YWRhdGEoXG4gICAgICAgIHF1ZXJ5RXhwciwgdHlwZS5uYW1lLCBxdWVyeUV4cHIuYXJndW1lbnRzIHx8IFtdLCBwcm9wZXJ0eU5hbWUsIHJlZmxlY3RvciwgZXZhbHVhdG9yKTtcbiAgICBpZiAodHlwZS5uYW1lLnN0YXJ0c1dpdGgoJ0NvbnRlbnQnKSkge1xuICAgICAgY29udGVudC5wdXNoKHF1ZXJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmlldy5wdXNoKHF1ZXJ5KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4ge2NvbnRlbnQsIHZpZXd9O1xufVxuXG5mdW5jdGlvbiBpc1N0cmluZ0FycmF5T3JEaWUodmFsdWU6IGFueSwgbmFtZTogc3RyaW5nLCBub2RlOiB0cy5FeHByZXNzaW9uKTogdmFsdWUgaXMgc3RyaW5nW10ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0eXBlb2YgdmFsdWVbaV0gIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgIG5vZGUsIHZhbHVlW2ldLCBgRmFpbGVkIHRvIHJlc29sdmUgJHtuYW1lfSBhdCBwb3NpdGlvbiAke2l9IHRvIGEgc3RyaW5nYCk7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VGaWVsZEFycmF5VmFsdWUoXG4gICAgZGlyZWN0aXZlOiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPiwgZmllbGQ6IHN0cmluZywgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yKTogbnVsbHxcbiAgICBzdHJpbmdbXSB7XG4gIGlmICghZGlyZWN0aXZlLmhhcyhmaWVsZCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIFJlc29sdmUgdGhlIGZpZWxkIG9mIGludGVyZXN0IGZyb20gdGhlIGRpcmVjdGl2ZSBtZXRhZGF0YSB0byBhIHN0cmluZ1tdLlxuICBjb25zdCBleHByZXNzaW9uID0gZGlyZWN0aXZlLmdldChmaWVsZCkhO1xuICBjb25zdCB2YWx1ZSA9IGV2YWx1YXRvci5ldmFsdWF0ZShleHByZXNzaW9uKTtcbiAgaWYgKCFpc1N0cmluZ0FycmF5T3JEaWUodmFsdWUsIGZpZWxkLCBleHByZXNzaW9uKSkge1xuICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgIGV4cHJlc3Npb24sIHZhbHVlLCBgRmFpbGVkIHRvIHJlc29sdmUgQERpcmVjdGl2ZS4ke2ZpZWxkfSB0byBhIHN0cmluZyBhcnJheWApO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIEludGVycHJldCBwcm9wZXJ0eSBtYXBwaW5nIGZpZWxkcyBvbiB0aGUgZGVjb3JhdG9yIChlLmcuIGlucHV0cyBvciBvdXRwdXRzKSBhbmQgcmV0dXJuIHRoZVxuICogY29ycmVjdGx5IHNoYXBlZCBtZXRhZGF0YSBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIHBhcnNlRmllbGRUb1Byb3BlcnR5TWFwcGluZyhcbiAgICBkaXJlY3RpdmU6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+LCBmaWVsZDogc3RyaW5nLFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBtZXRhVmFsdWVzID0gcGFyc2VGaWVsZEFycmF5VmFsdWUoZGlyZWN0aXZlLCBmaWVsZCwgZXZhbHVhdG9yKTtcbiAgaWYgKCFtZXRhVmFsdWVzKSB7XG4gICAgcmV0dXJuIEVNUFRZX09CSkVDVDtcbiAgfVxuXG4gIHJldHVybiBtZXRhVmFsdWVzLnJlZHVjZSgocmVzdWx0cywgdmFsdWUpID0+IHtcbiAgICAvLyBFaXRoZXIgdGhlIHZhbHVlIGlzICdmaWVsZCcgb3IgJ2ZpZWxkOiBwcm9wZXJ0eScuIEluIHRoZSBmaXJzdCBjYXNlLCBgcHJvcGVydHlgIHdpbGxcbiAgICAvLyBiZSB1bmRlZmluZWQsIGluIHdoaWNoIGNhc2UgdGhlIGZpZWxkIG5hbWUgc2hvdWxkIGFsc28gYmUgdXNlZCBhcyB0aGUgcHJvcGVydHkgbmFtZS5cbiAgICBjb25zdCBbZmllbGQsIHByb3BlcnR5XSA9IHZhbHVlLnNwbGl0KCc6JywgMikubWFwKHN0ciA9PiBzdHIudHJpbSgpKTtcbiAgICByZXN1bHRzW2ZpZWxkXSA9IHByb3BlcnR5IHx8IGZpZWxkO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9LCB7fSBhcyB7W2ZpZWxkOiBzdHJpbmddOiBzdHJpbmd9KTtcbn1cblxuLyoqXG4gKiBQYXJzZSBwcm9wZXJ0eSBkZWNvcmF0b3JzIChlLmcuIGBJbnB1dGAgb3IgYE91dHB1dGApIGFuZCByZXR1cm4gdGhlIGNvcnJlY3RseSBzaGFwZWQgbWV0YWRhdGFcbiAqIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gcGFyc2VEZWNvcmF0ZWRGaWVsZHMoXG4gICAgZmllbGRzOiB7bWVtYmVyOiBDbGFzc01lbWJlciwgZGVjb3JhdG9yczogRGVjb3JhdG9yW119W10sIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcixcbiAgICBtYXBWYWx1ZVJlc29sdmVyOiAocHVibGljTmFtZTogc3RyaW5nLCBpbnRlcm5hbE5hbWU6IHN0cmluZykgPT5cbiAgICAgICAgc3RyaW5nIHwgW3N0cmluZywgc3RyaW5nXSk6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ3xbc3RyaW5nLCBzdHJpbmddfSB7XG4gIHJldHVybiBmaWVsZHMucmVkdWNlKChyZXN1bHRzLCBmaWVsZCkgPT4ge1xuICAgIGNvbnN0IGZpZWxkTmFtZSA9IGZpZWxkLm1lbWJlci5uYW1lO1xuICAgIGZpZWxkLmRlY29yYXRvcnMuZm9yRWFjaChkZWNvcmF0b3IgPT4ge1xuICAgICAgLy8gVGhlIGRlY29yYXRvciBlaXRoZXIgZG9lc24ndCBoYXZlIGFuIGFyZ3VtZW50IChASW5wdXQoKSkgaW4gd2hpY2ggY2FzZSB0aGUgcHJvcGVydHlcbiAgICAgIC8vIG5hbWUgaXMgdXNlZCwgb3IgaXQgaGFzIG9uZSBhcmd1bWVudCAoQE91dHB1dCgnbmFtZWQnKSkuXG4gICAgICBpZiAoZGVjb3JhdG9yLmFyZ3MgPT0gbnVsbCB8fCBkZWNvcmF0b3IuYXJncy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmVzdWx0c1tmaWVsZE5hbWVdID0gZmllbGROYW1lO1xuICAgICAgfSBlbHNlIGlmIChkZWNvcmF0b3IuYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3QgcHJvcGVydHkgPSBldmFsdWF0b3IuZXZhbHVhdGUoZGVjb3JhdG9yLmFyZ3NbMF0pO1xuICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICAgIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjb3JhdG9yKSwgcHJvcGVydHksXG4gICAgICAgICAgICAgIGBAJHtkZWNvcmF0b3IubmFtZX0gZGVjb3JhdG9yIGFyZ3VtZW50IG11c3QgcmVzb2x2ZSB0byBhIHN0cmluZ2ApO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdHNbZmllbGROYW1lXSA9IG1hcFZhbHVlUmVzb2x2ZXIocHJvcGVydHksIGZpZWxkTmFtZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUb28gbWFueSBhcmd1bWVudHMuXG4gICAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJJVFlfV1JPTkcsIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjb3JhdG9yKSxcbiAgICAgICAgICAgIGBAJHtkZWNvcmF0b3IubmFtZX0gY2FuIGhhdmUgYXQgbW9zdCBvbmUgYXJndW1lbnQsIGdvdCAke1xuICAgICAgICAgICAgICAgIGRlY29yYXRvci5hcmdzLmxlbmd0aH0gYXJndW1lbnQocylgKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSwge30gYXMge1tmaWVsZDogc3RyaW5nXTogc3RyaW5nIHwgW3N0cmluZywgc3RyaW5nXX0pO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSW5wdXQocHVibGljTmFtZTogc3RyaW5nLCBpbnRlcm5hbE5hbWU6IHN0cmluZyk6IFtzdHJpbmcsIHN0cmluZ10ge1xuICByZXR1cm4gW3B1YmxpY05hbWUsIGludGVybmFsTmFtZV07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPdXRwdXQocHVibGljTmFtZTogc3RyaW5nLCBpbnRlcm5hbE5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcHVibGljTmFtZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJpZXNGcm9tRmllbGRzKFxuICAgIGZpZWxkczoge21lbWJlcjogQ2xhc3NNZW1iZXIsIGRlY29yYXRvcnM6IERlY29yYXRvcltdfVtdLCByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFIzUXVlcnlNZXRhZGF0YVtdIHtcbiAgcmV0dXJuIGZpZWxkcy5tYXAoKHttZW1iZXIsIGRlY29yYXRvcnN9KSA9PiB7XG4gICAgY29uc3QgZGVjb3JhdG9yID0gZGVjb3JhdG9yc1swXTtcbiAgICBjb25zdCBub2RlID0gbWVtYmVyLm5vZGUgfHwgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpO1xuXG4gICAgLy8gVGhyb3cgaW4gY2FzZSBvZiBgQElucHV0KCkgQENvbnRlbnRDaGlsZCgnZm9vJykgZm9vOiBhbnlgLCB3aGljaCBpcyBub3Qgc3VwcG9ydGVkIGluIEl2eVxuICAgIGlmIChtZW1iZXIuZGVjb3JhdG9ycyEuc29tZSh2ID0+IHYubmFtZSA9PT0gJ0lucHV0JykpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0NPTExJU0lPTiwgbm9kZSxcbiAgICAgICAgICAnQ2Fubm90IGNvbWJpbmUgQElucHV0IGRlY29yYXRvcnMgd2l0aCBxdWVyeSBkZWNvcmF0b3JzJyk7XG4gICAgfVxuICAgIGlmIChkZWNvcmF0b3JzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQ09MTElTSU9OLCBub2RlLFxuICAgICAgICAgICdDYW5ub3QgaGF2ZSBtdWx0aXBsZSBxdWVyeSBkZWNvcmF0b3JzIG9uIHRoZSBzYW1lIGNsYXNzIG1lbWJlcicpO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvcGVydHlUeXBlTWVtYmVyKG1lbWJlcikpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX1VORVhQRUNURUQsIG5vZGUsXG4gICAgICAgICAgJ1F1ZXJ5IGRlY29yYXRvciBtdXN0IGdvIG9uIGEgcHJvcGVydHktdHlwZSBtZW1iZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGV4dHJhY3RRdWVyeU1ldGFkYXRhKFxuICAgICAgICBub2RlLCBkZWNvcmF0b3IubmFtZSwgZGVjb3JhdG9yLmFyZ3MgfHwgW10sIG1lbWJlci5uYW1lLCByZWZsZWN0b3IsIGV2YWx1YXRvcik7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpc1Byb3BlcnR5VHlwZU1lbWJlcihtZW1iZXI6IENsYXNzTWVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBtZW1iZXIua2luZCA9PT0gQ2xhc3NNZW1iZXJLaW5kLkdldHRlciB8fCBtZW1iZXIua2luZCA9PT0gQ2xhc3NNZW1iZXJLaW5kLlNldHRlciB8fFxuICAgICAgbWVtYmVyLmtpbmQgPT09IENsYXNzTWVtYmVyS2luZC5Qcm9wZXJ0eTtcbn1cblxudHlwZSBTdHJpbmdNYXA8VD4gPSB7XG4gIFtrZXk6IHN0cmluZ106IFQ7XG59O1xuXG5mdW5jdGlvbiBldmFsdWF0ZUhvc3RFeHByZXNzaW9uQmluZGluZ3MoXG4gICAgaG9zdEV4cHI6IHRzLkV4cHJlc3Npb24sIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGNvbnN0IGhvc3RNZXRhTWFwID0gZXZhbHVhdG9yLmV2YWx1YXRlKGhvc3RFeHByKTtcbiAgaWYgKCEoaG9zdE1ldGFNYXAgaW5zdGFuY2VvZiBNYXApKSB7XG4gICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgaG9zdEV4cHIsIGhvc3RNZXRhTWFwLCBgRGVjb3JhdG9yIGhvc3QgbWV0YWRhdGEgbXVzdCBiZSBhbiBvYmplY3RgKTtcbiAgfVxuICBjb25zdCBob3N0TWV0YWRhdGE6IFN0cmluZ01hcDxzdHJpbmd8RXhwcmVzc2lvbj4gPSB7fTtcbiAgaG9zdE1ldGFNYXAuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgIC8vIFJlc29sdmUgRW51bSByZWZlcmVuY2VzIHRvIHRoZWlyIGRlY2xhcmVkIHZhbHVlLlxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEVudW1WYWx1ZSkge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5yZXNvbHZlZDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgaG9zdEV4cHIsIGtleSxcbiAgICAgICAgICBgRGVjb3JhdG9yIGhvc3QgbWV0YWRhdGEgbXVzdCBiZSBhIHN0cmluZyAtPiBzdHJpbmcgb2JqZWN0LCBidXQgZm91bmQgdW5wYXJzZWFibGUga2V5YCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgaG9zdE1ldGFkYXRhW2tleV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICBob3N0TWV0YWRhdGFba2V5XSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIodmFsdWUubm9kZSBhcyB0cy5FeHByZXNzaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICBob3N0RXhwciwgdmFsdWUsXG4gICAgICAgICAgYERlY29yYXRvciBob3N0IG1ldGFkYXRhIG11c3QgYmUgYSBzdHJpbmcgLT4gc3RyaW5nIG9iamVjdCwgYnV0IGZvdW5kIHVucGFyc2VhYmxlIHZhbHVlYCk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3RNZXRhZGF0YSk7XG5cbiAgY29uc3QgZXJyb3JzID0gdmVyaWZ5SG9zdEJpbmRpbmdzKGJpbmRpbmdzLCBjcmVhdGVTb3VyY2VTcGFuKGhvc3RFeHByKSk7XG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgLy8gVE9ETzogcHJvdmlkZSBtb3JlIGdyYW51bGFyIGRpYWdub3N0aWMgYW5kIG91dHB1dCBzcGVjaWZpYyBob3N0IGV4cHJlc3Npb24gdGhhdFxuICAgICAgICAvLyB0cmlnZ2VyZWQgYW4gZXJyb3IgaW5zdGVhZCBvZiB0aGUgd2hvbGUgaG9zdCBvYmplY3QuXG4gICAgICAgIEVycm9yQ29kZS5IT1NUX0JJTkRJTkdfUEFSU0VfRVJST1IsIGhvc3RFeHByLFxuICAgICAgICBlcnJvcnMubWFwKChlcnJvcjogUGFyc2VFcnJvcikgPT4gZXJyb3IubXNnKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0SG9zdEJpbmRpbmdzKFxuICAgIG1lbWJlcnM6IENsYXNzTWVtYmVyW10sIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvciwgY29yZU1vZHVsZTogc3RyaW5nfHVuZGVmaW5lZCxcbiAgICBtZXRhZGF0YT86IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgbGV0IGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3M7XG4gIGlmIChtZXRhZGF0YSAmJiBtZXRhZGF0YS5oYXMoJ2hvc3QnKSkge1xuICAgIGJpbmRpbmdzID0gZXZhbHVhdGVIb3N0RXhwcmVzc2lvbkJpbmRpbmdzKG1ldGFkYXRhLmdldCgnaG9zdCcpISwgZXZhbHVhdG9yKTtcbiAgfSBlbHNlIHtcbiAgICBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKHt9KTtcbiAgfVxuXG4gIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IobWVtYmVycywgJ0hvc3RCaW5kaW5nJywgY29yZU1vZHVsZSlcbiAgICAgIC5mb3JFYWNoKCh7bWVtYmVyLCBkZWNvcmF0b3JzfSkgPT4ge1xuICAgICAgICBkZWNvcmF0b3JzLmZvckVhY2goZGVjb3JhdG9yID0+IHtcbiAgICAgICAgICBsZXQgaG9zdFByb3BlcnR5TmFtZTogc3RyaW5nID0gbWVtYmVyLm5hbWU7XG4gICAgICAgICAgaWYgKGRlY29yYXRvci5hcmdzICE9PSBudWxsICYmIGRlY29yYXRvci5hcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGlmIChkZWNvcmF0b3IuYXJncy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgICAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUklUWV9XUk9ORywgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLFxuICAgICAgICAgICAgICAgICAgYEBIb3N0QmluZGluZyBjYW4gaGF2ZSBhdCBtb3N0IG9uZSBhcmd1bWVudCwgZ290ICR7XG4gICAgICAgICAgICAgICAgICAgICAgZGVjb3JhdG9yLmFyZ3MubGVuZ3RofSBhcmd1bWVudChzKWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGV2YWx1YXRvci5ldmFsdWF0ZShkZWNvcmF0b3IuYXJnc1swXSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlc29sdmVkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgICAgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLCByZXNvbHZlZCxcbiAgICAgICAgICAgICAgICAgIGBASG9zdEJpbmRpbmcncyBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGhvc3RQcm9wZXJ0eU5hbWUgPSByZXNvbHZlZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTaW5jZSB0aGlzIGlzIGEgZGVjb3JhdG9yLCB3ZSBrbm93IHRoYXQgdGhlIHZhbHVlIGlzIGEgY2xhc3MgbWVtYmVyLiBBbHdheXMgYWNjZXNzIGl0XG4gICAgICAgICAgLy8gdGhyb3VnaCBgdGhpc2Agc28gdGhhdCBmdXJ0aGVyIGRvd24gdGhlIGxpbmUgaXQgY2FuJ3QgYmUgY29uZnVzZWQgZm9yIGEgbGl0ZXJhbCB2YWx1ZVxuICAgICAgICAgIC8vIChlLmcuIGlmIHRoZXJlJ3MgYSBwcm9wZXJ0eSBjYWxsZWQgYHRydWVgKS4gVGhlcmUgaXMgbm8gc2l6ZSBwZW5hbHR5LCBiZWNhdXNlIGFsbFxuICAgICAgICAgIC8vIHZhbHVlcyAoZXhjZXB0IGxpdGVyYWxzKSBhcmUgY29udmVydGVkIHRvIGBjdHgucHJvcE5hbWVgIGV2ZW50dWFsbHkuXG4gICAgICAgICAgYmluZGluZ3MucHJvcGVydGllc1tob3N0UHJvcGVydHlOYW1lXSA9IGdldFNhZmVQcm9wZXJ0eUFjY2Vzc1N0cmluZygndGhpcycsIG1lbWJlci5uYW1lKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICBmaWx0ZXJUb01lbWJlcnNXaXRoRGVjb3JhdG9yKG1lbWJlcnMsICdIb3N0TGlzdGVuZXInLCBjb3JlTW9kdWxlKVxuICAgICAgLmZvckVhY2goKHttZW1iZXIsIGRlY29yYXRvcnN9KSA9PiB7XG4gICAgICAgIGRlY29yYXRvcnMuZm9yRWFjaChkZWNvcmF0b3IgPT4ge1xuICAgICAgICAgIGxldCBldmVudE5hbWU6IHN0cmluZyA9IG1lbWJlci5uYW1lO1xuICAgICAgICAgIGxldCBhcmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGlmIChkZWNvcmF0b3IuYXJncyAhPT0gbnVsbCAmJiBkZWNvcmF0b3IuYXJncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBpZiAoZGVjb3JhdG9yLmFyZ3MubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSSVRZX1dST05HLCBkZWNvcmF0b3IuYXJnc1syXSxcbiAgICAgICAgICAgICAgICAgIGBASG9zdExpc3RlbmVyIGNhbiBoYXZlIGF0IG1vc3QgdHdvIGFyZ3VtZW50c2ApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGV2YWx1YXRvci5ldmFsdWF0ZShkZWNvcmF0b3IuYXJnc1swXSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlc29sdmVkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgICAgZGVjb3JhdG9yLmFyZ3NbMF0sIHJlc29sdmVkLFxuICAgICAgICAgICAgICAgICAgYEBIb3N0TGlzdGVuZXIncyBldmVudCBuYW1lIGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmdgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZXZlbnROYW1lID0gcmVzb2x2ZWQ7XG5cbiAgICAgICAgICAgIGlmIChkZWNvcmF0b3IuYXJncy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRlY29yYXRvci5hcmdzWzFdO1xuICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZEFyZ3MgPSBldmFsdWF0b3IuZXZhbHVhdGUoZGVjb3JhdG9yLmFyZ3NbMV0pO1xuICAgICAgICAgICAgICBpZiAoIWlzU3RyaW5nQXJyYXlPckRpZShyZXNvbHZlZEFyZ3MsICdASG9zdExpc3RlbmVyLmFyZ3MnLCBleHByZXNzaW9uKSkge1xuICAgICAgICAgICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIGRlY29yYXRvci5hcmdzWzFdLCByZXNvbHZlZEFyZ3MsXG4gICAgICAgICAgICAgICAgICAgIGBASG9zdExpc3RlbmVyJ3Mgc2Vjb25kIGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcgYXJyYXlgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhcmdzID0gcmVzb2x2ZWRBcmdzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGJpbmRpbmdzLmxpc3RlbmVyc1tldmVudE5hbWVdID0gYCR7bWVtYmVyLm5hbWV9KCR7YXJncy5qb2luKCcsJyl9KWA7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gIHJldHVybiBiaW5kaW5ncztcbn1cblxuY29uc3QgUVVFUllfVFlQRVMgPSBuZXcgU2V0KFtcbiAgJ0NvbnRlbnRDaGlsZCcsXG4gICdDb250ZW50Q2hpbGRyZW4nLFxuICAnVmlld0NoaWxkJyxcbiAgJ1ZpZXdDaGlsZHJlbicsXG5dKTtcbiJdfQ==