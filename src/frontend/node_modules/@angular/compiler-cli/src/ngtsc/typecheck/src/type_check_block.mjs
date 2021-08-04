/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BindingPipe, DYNAMIC_TYPE, ImplicitReceiver, MethodCall, PropertyRead, PropertyWrite, ThisReceiver, TmplAstBoundAttribute, TmplAstBoundText, TmplAstElement, TmplAstIcu, TmplAstReference, TmplAstTemplate, TmplAstTextAttribute, TmplAstVariable } from '@angular/compiler';
import * as ts from 'typescript';
import { addExpressionIdentifier, ExpressionIdentifier, markIgnoreDiagnostics } from './comments';
import { addParseSpanInfo, addTemplateId, wrapForDiagnostics, wrapForTypeChecker } from './diagnostics';
import { astToTypescript, NULL_AS_ANY } from './expression';
import { ExpressionSemanticVisitor } from './template_semantics';
import { tsCallMethod, tsCastToAny, tsCreateElement, tsCreateTypeQueryForCoercedInput, tsCreateVariable, tsDeclareVariable } from './ts_util';
import { requiresInlineTypeCtor } from './type_constructor';
import { TypeParameterEmitter } from './type_parameter_emitter';
/**
 * Controls how generics for the component context class will be handled during TCB generation.
 */
export var TcbGenericContextBehavior;
(function (TcbGenericContextBehavior) {
    /**
     * References to generic parameter bounds will be emitted via the `TypeParameterEmitter`.
     *
     * The caller must verify that all parameter bounds are emittable in order to use this mode.
     */
    TcbGenericContextBehavior[TcbGenericContextBehavior["UseEmitter"] = 0] = "UseEmitter";
    /**
     * Generic parameter declarations will be copied directly from the `ts.ClassDeclaration` of the
     * component class.
     *
     * The caller must only use the generated TCB code in a context where such copies will still be
     * valid, such as an inline type check block.
     */
    TcbGenericContextBehavior[TcbGenericContextBehavior["CopyClassNodes"] = 1] = "CopyClassNodes";
    /**
     * Any generic parameters for the component context class will be set to `any`.
     *
     * Produces a less useful type, but is always safe to use.
     */
    TcbGenericContextBehavior[TcbGenericContextBehavior["FallbackToAny"] = 2] = "FallbackToAny";
})(TcbGenericContextBehavior || (TcbGenericContextBehavior = {}));
/**
 * Given a `ts.ClassDeclaration` for a component, and metadata regarding that component, compose a
 * "type check block" function.
 *
 * When passed through TypeScript's TypeChecker, type errors that arise within the type check block
 * function indicate issues in the template itself.
 *
 * As a side effect of generating a TCB for the component, `ts.Diagnostic`s may also be produced
 * directly for issues within the template which are identified during generation. These issues are
 * recorded in either the `domSchemaChecker` (which checks usage of DOM elements and bindings) as
 * well as the `oobRecorder` (which records errors when the type-checking code generator is unable
 * to sufficiently understand a template).
 *
 * @param env an `Environment` into which type-checking code will be generated.
 * @param ref a `Reference` to the component class which should be type-checked.
 * @param name a `ts.Identifier` to use for the generated `ts.FunctionDeclaration`.
 * @param meta metadata about the component's template and the function being generated.
 * @param domSchemaChecker used to check and record errors regarding improper usage of DOM elements
 * and bindings.
 * @param oobRecorder used to record errors regarding template elements which could not be correctly
 * translated into types during TCB generation.
 * @param genericContextBehavior controls how generic parameters (especially parameters with generic
 * bounds) will be referenced from the generated TCB code.
 */
export function generateTypeCheckBlock(env, ref, name, meta, domSchemaChecker, oobRecorder, genericContextBehavior) {
    const tcb = new Context(env, domSchemaChecker, oobRecorder, meta.id, meta.boundTarget, meta.pipes, meta.schemas);
    const scope = Scope.forNodes(tcb, null, tcb.boundTarget.target.template, /* guard */ null);
    const ctxRawType = env.referenceType(ref);
    if (!ts.isTypeReferenceNode(ctxRawType)) {
        throw new Error(`Expected TypeReferenceNode when referencing the ctx param for ${ref.debugName}`);
    }
    let typeParameters = undefined;
    let typeArguments = undefined;
    if (ref.node.typeParameters !== undefined) {
        if (!env.config.useContextGenericType) {
            genericContextBehavior = TcbGenericContextBehavior.FallbackToAny;
        }
        switch (genericContextBehavior) {
            case TcbGenericContextBehavior.UseEmitter:
                // Guaranteed to emit type parameters since we checked that the class has them above.
                typeParameters = new TypeParameterEmitter(ref.node.typeParameters, env.reflector)
                    .emit(typeRef => env.referenceType(typeRef));
                typeArguments = typeParameters.map(param => ts.factory.createTypeReferenceNode(param.name));
                break;
            case TcbGenericContextBehavior.CopyClassNodes:
                typeParameters = [...ref.node.typeParameters];
                typeArguments = typeParameters.map(param => ts.factory.createTypeReferenceNode(param.name));
                break;
            case TcbGenericContextBehavior.FallbackToAny:
                typeArguments = ref.node.typeParameters.map(() => ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                break;
        }
    }
    const paramList = [tcbCtxParam(ref.node, ctxRawType.typeName, typeArguments)];
    const scopeStatements = scope.render();
    const innerBody = ts.createBlock([
        ...env.getPreludeStatements(),
        ...scopeStatements,
    ]);
    // Wrap the body in an "if (true)" expression. This is unnecessary but has the effect of causing
    // the `ts.Printer` to format the type-check block nicely.
    const body = ts.createBlock([ts.createIf(ts.createTrue(), innerBody, undefined)]);
    const fnDecl = ts.createFunctionDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* asteriskToken */ undefined, 
    /* name */ name, 
    /* typeParameters */ env.config.useContextGenericType ? typeParameters : undefined, 
    /* parameters */ paramList, 
    /* type */ undefined, 
    /* body */ body);
    addTemplateId(fnDecl, meta.id);
    return fnDecl;
}
/**
 * A code generation operation that's involved in the construction of a Type Check Block.
 *
 * The generation of a TCB is non-linear. Bindings within a template may result in the need to
 * construct certain types earlier than they otherwise would be constructed. That is, if the
 * generation of a TCB for a template is broken down into specific operations (constructing a
 * directive, extracting a variable from a let- operation, etc), then it's possible for operations
 * earlier in the sequence to depend on operations which occur later in the sequence.
 *
 * `TcbOp` abstracts the different types of operations which are required to convert a template into
 * a TCB. This allows for two phases of processing for the template, where 1) a linear sequence of
 * `TcbOp`s is generated, and then 2) these operations are executed, not necessarily in linear
 * order.
 *
 * Each `TcbOp` may insert statements into the body of the TCB, and also optionally return a
 * `ts.Expression` which can be used to reference the operation's result.
 */
class TcbOp {
    /**
     * Replacement value or operation used while this `TcbOp` is executing (i.e. to resolve circular
     * references during its execution).
     *
     * This is usually a `null!` expression (which asks TS to infer an appropriate type), but another
     * `TcbOp` can be returned in cases where additional code generation is necessary to deal with
     * circular references.
     */
    circularFallback() {
        return INFER_TYPE_FOR_CIRCULAR_OP_EXPR;
    }
}
/**
 * A `TcbOp` which creates an expression for a native DOM element (or web component) from a
 * `TmplAstElement`.
 *
 * Executing this operation returns a reference to the element variable.
 */
class TcbElementOp extends TcbOp {
    constructor(tcb, scope, element) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.element = element;
    }
    get optional() {
        // The statement generated by this operation is only used for type-inference of the DOM
        // element's type and won't report diagnostics by itself, so the operation is marked as optional
        // to avoid generating statements for DOM elements that are never referenced.
        return true;
    }
    execute() {
        const id = this.tcb.allocateId();
        // Add the declaration of the element using document.createElement.
        const initializer = tsCreateElement(this.element.name);
        addParseSpanInfo(initializer, this.element.startSourceSpan || this.element.sourceSpan);
        this.scope.addStatement(tsCreateVariable(id, initializer));
        return id;
    }
}
/**
 * A `TcbOp` which creates an expression for particular let- `TmplAstVariable` on a
 * `TmplAstTemplate`'s context.
 *
 * Executing this operation returns a reference to the variable variable (lol).
 */
class TcbVariableOp extends TcbOp {
    constructor(tcb, scope, template, variable) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.template = template;
        this.variable = variable;
    }
    get optional() {
        return false;
    }
    execute() {
        // Look for a context variable for the template.
        const ctx = this.scope.resolve(this.template);
        // Allocate an identifier for the TmplAstVariable, and initialize it to a read of the variable
        // on the template context.
        const id = this.tcb.allocateId();
        const initializer = ts.createPropertyAccess(
        /* expression */ ctx, 
        /* name */ this.variable.value || '$implicit');
        addParseSpanInfo(id, this.variable.keySpan);
        // Declare the variable, and return its identifier.
        let variable;
        if (this.variable.valueSpan !== undefined) {
            addParseSpanInfo(initializer, this.variable.valueSpan);
            variable = tsCreateVariable(id, wrapForTypeChecker(initializer));
        }
        else {
            variable = tsCreateVariable(id, initializer);
        }
        addParseSpanInfo(variable.declarationList.declarations[0], this.variable.sourceSpan);
        this.scope.addStatement(variable);
        return id;
    }
}
/**
 * A `TcbOp` which generates a variable for a `TmplAstTemplate`'s context.
 *
 * Executing this operation returns a reference to the template's context variable.
 */
class TcbTemplateContextOp extends TcbOp {
    constructor(tcb, scope) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        // The declaration of the context variable is only needed when the context is actually referenced.
        this.optional = true;
    }
    execute() {
        // Allocate a template ctx variable and declare it with an 'any' type. The type of this variable
        // may be narrowed as a result of template guard conditions.
        const ctx = this.tcb.allocateId();
        const type = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        this.scope.addStatement(tsDeclareVariable(ctx, type));
        return ctx;
    }
}
/**
 * A `TcbOp` which descends into a `TmplAstTemplate`'s children and generates type-checking code for
 * them.
 *
 * This operation wraps the children's type-checking code in an `if` block, which may include one
 * or more type guard conditions that narrow types within the template body.
 */
class TcbTemplateBodyOp extends TcbOp {
    constructor(tcb, scope, template) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.template = template;
    }
    get optional() {
        return false;
    }
    execute() {
        // An `if` will be constructed, within which the template's children will be type checked. The
        // `if` is used for two reasons: it creates a new syntactic scope, isolating variables declared
        // in the template's TCB from the outer context, and it allows any directives on the templates
        // to perform type narrowing of either expressions or the template's context.
        //
        // The guard is the `if` block's condition. It's usually set to `true` but directives that exist
        // on the template can trigger extra guard expressions that serve to narrow types within the
        // `if`. `guard` is calculated by starting with `true` and adding other conditions as needed.
        // Collect these into `guards` by processing the directives.
        const directiveGuards = [];
        const directives = this.tcb.boundTarget.getDirectivesOfNode(this.template);
        if (directives !== null) {
            for (const dir of directives) {
                const dirInstId = this.scope.resolve(this.template, dir);
                const dirId = this.tcb.env.reference(dir.ref);
                // There are two kinds of guards. Template guards (ngTemplateGuards) allow type narrowing of
                // the expression passed to an @Input of the directive. Scan the directive to see if it has
                // any template guards, and generate them if needed.
                dir.ngTemplateGuards.forEach(guard => {
                    // For each template guard function on the directive, look for a binding to that input.
                    const boundInput = this.template.inputs.find(i => i.name === guard.inputName) ||
                        this.template.templateAttrs.find((i) => i instanceof TmplAstBoundAttribute && i.name === guard.inputName);
                    if (boundInput !== undefined) {
                        // If there is such a binding, generate an expression for it.
                        const expr = tcbExpression(boundInput.value, this.tcb, this.scope);
                        // The expression has already been checked in the type constructor invocation, so
                        // it should be ignored when used within a template guard.
                        markIgnoreDiagnostics(expr);
                        if (guard.type === 'binding') {
                            // Use the binding expression itself as guard.
                            directiveGuards.push(expr);
                        }
                        else {
                            // Call the guard function on the directive with the directive instance and that
                            // expression.
                            const guardInvoke = tsCallMethod(dirId, `ngTemplateGuard_${guard.inputName}`, [
                                dirInstId,
                                expr,
                            ]);
                            addParseSpanInfo(guardInvoke, boundInput.value.sourceSpan);
                            directiveGuards.push(guardInvoke);
                        }
                    }
                });
                // The second kind of guard is a template context guard. This guard narrows the template
                // rendering context variable `ctx`.
                if (dir.hasNgTemplateContextGuard) {
                    if (this.tcb.env.config.applyTemplateContextGuards) {
                        const ctx = this.scope.resolve(this.template);
                        const guardInvoke = tsCallMethod(dirId, 'ngTemplateContextGuard', [dirInstId, ctx]);
                        addParseSpanInfo(guardInvoke, this.template.sourceSpan);
                        directiveGuards.push(guardInvoke);
                    }
                    else if (this.template.variables.length > 0 &&
                        this.tcb.env.config.suggestionsForSuboptimalTypeInference) {
                        // The compiler could have inferred a better type for the variables in this template,
                        // but was prevented from doing so by the type-checking configuration. Issue a warning
                        // diagnostic.
                        this.tcb.oobRecorder.suboptimalTypeInference(this.tcb.id, this.template.variables);
                    }
                }
            }
        }
        // By default the guard is simply `true`.
        let guard = null;
        // If there are any guards from directives, use them instead.
        if (directiveGuards.length > 0) {
            // Pop the first value and use it as the initializer to reduce(). This way, a single guard
            // will be used on its own, but two or more will be combined into binary AND expressions.
            guard = directiveGuards.reduce((expr, dirGuard) => ts.createBinary(expr, ts.SyntaxKind.AmpersandAmpersandToken, dirGuard), directiveGuards.pop());
        }
        // Create a new Scope for the template. This constructs the list of operations for the template
        // children, as well as tracks bindings within the template.
        const tmplScope = Scope.forNodes(this.tcb, this.scope, this.template, guard);
        // Render the template's `Scope` into its statements.
        const statements = tmplScope.render();
        if (statements.length === 0) {
            // As an optimization, don't generate the scope's block if it has no statements. This is
            // beneficial for templates that contain for example `<span *ngIf="first"></span>`, in which
            // case there's no need to render the `NgIf` guard expression. This seems like a minor
            // improvement, however it reduces the number of flow-node antecedents that TypeScript needs
            // to keep into account for such cases, resulting in an overall reduction of
            // type-checking time.
            return null;
        }
        let tmplBlock = ts.createBlock(statements);
        if (guard !== null) {
            // The scope has a guard that needs to be applied, so wrap the template block into an `if`
            // statement containing the guard expression.
            tmplBlock = ts.createIf(/* expression */ guard, /* thenStatement */ tmplBlock);
        }
        this.scope.addStatement(tmplBlock);
        return null;
    }
}
/**
 * A `TcbOp` which renders a text binding (interpolation) into the TCB.
 *
 * Executing this operation returns nothing.
 */
class TcbTextInterpolationOp extends TcbOp {
    constructor(tcb, scope, binding) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.binding = binding;
    }
    get optional() {
        return false;
    }
    execute() {
        const expr = tcbExpression(this.binding.value, this.tcb, this.scope);
        this.scope.addStatement(ts.createExpressionStatement(expr));
        return null;
    }
}
/**
 * A `TcbOp` which constructs an instance of a directive. For generic directives, generic
 * parameters are set to `any` type.
 */
class TcbDirectiveTypeOpBase extends TcbOp {
    constructor(tcb, scope, node, dir) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.node = node;
        this.dir = dir;
    }
    get optional() {
        // The statement generated by this operation is only used to declare the directive's type and
        // won't report diagnostics by itself, so the operation is marked as optional to avoid
        // generating declarations for directives that don't have any inputs/outputs.
        return true;
    }
    execute() {
        const dirRef = this.dir.ref;
        const rawType = this.tcb.env.referenceType(this.dir.ref);
        let type;
        if (this.dir.isGeneric === false || dirRef.node.typeParameters === undefined) {
            type = rawType;
        }
        else {
            if (!ts.isTypeReferenceNode(rawType)) {
                throw new Error(`Expected TypeReferenceNode when referencing the type for ${this.dir.ref.debugName}`);
            }
            const typeArguments = dirRef.node.typeParameters.map(() => ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
            type = ts.factory.createTypeReferenceNode(rawType.typeName, typeArguments);
        }
        const id = this.tcb.allocateId();
        addExpressionIdentifier(type, ExpressionIdentifier.DIRECTIVE);
        addParseSpanInfo(type, this.node.startSourceSpan || this.node.sourceSpan);
        this.scope.addStatement(tsDeclareVariable(id, type));
        return id;
    }
}
/**
 * A `TcbOp` which constructs an instance of a non-generic directive _without_ setting any of its
 * inputs. Inputs  are later set in the `TcbDirectiveInputsOp`. Type checking was found to be
 * faster when done in this way as opposed to `TcbDirectiveCtorOp` which is only necessary when the
 * directive is generic.
 *
 * Executing this operation returns a reference to the directive instance variable with its inferred
 * type.
 */
class TcbNonGenericDirectiveTypeOp extends TcbDirectiveTypeOpBase {
    /**
     * Creates a variable declaration for this op's directive of the argument type. Returns the id of
     * the newly created variable.
     */
    execute() {
        const dirRef = this.dir.ref;
        if (this.dir.isGeneric) {
            throw new Error(`Assertion Error: expected ${dirRef.debugName} not to be generic.`);
        }
        return super.execute();
    }
}
/**
 * A `TcbOp` which constructs an instance of a generic directive with its generic parameters set
 * to `any` type. This op is like `TcbDirectiveTypeOp`, except that generic parameters are set to
 * `any` type. This is used for situations where we want to avoid inlining.
 *
 * Executing this operation returns a reference to the directive instance variable with its generic
 * type parameters set to `any`.
 */
class TcbGenericDirectiveTypeWithAnyParamsOp extends TcbDirectiveTypeOpBase {
    execute() {
        const dirRef = this.dir.ref;
        if (dirRef.node.typeParameters === undefined) {
            throw new Error(`Assertion Error: expected typeParameters when creating a declaration for ${dirRef.debugName}`);
        }
        return super.execute();
    }
}
/**
 * A `TcbOp` which creates a variable for a local ref in a template.
 * The initializer for the variable is the variable expression for the directive, template, or
 * element the ref refers to. When the reference is used in the template, those TCB statements will
 * access this variable as well. For example:
 * ```
 * var _t1 = document.createElement('div');
 * var _t2 = _t1;
 * _t2.value
 * ```
 * This operation supports more fluent lookups for the `TemplateTypeChecker` when getting a symbol
 * for a reference. In most cases, this isn't essential; that is, the information for the symbol
 * could be gathered without this operation using the `BoundTarget`. However, for the case of
 * ng-template references, we will need this reference variable to not only provide a location in
 * the shim file, but also to narrow the variable to the correct `TemplateRef<T>` type rather than
 * `TemplateRef<any>` (this work is still TODO).
 *
 * Executing this operation returns a reference to the directive instance variable with its inferred
 * type.
 */
class TcbReferenceOp extends TcbOp {
    constructor(tcb, scope, node, host, target) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.node = node;
        this.host = host;
        this.target = target;
        // The statement generated by this operation is only used to for the Type Checker
        // so it can map a reference variable in the template directly to a node in the TCB.
        this.optional = true;
    }
    execute() {
        const id = this.tcb.allocateId();
        let initializer = this.target instanceof TmplAstTemplate || this.target instanceof TmplAstElement ?
            this.scope.resolve(this.target) :
            this.scope.resolve(this.host, this.target);
        // The reference is either to an element, an <ng-template> node, or to a directive on an
        // element or template.
        if ((this.target instanceof TmplAstElement && !this.tcb.env.config.checkTypeOfDomReferences) ||
            !this.tcb.env.config.checkTypeOfNonDomReferences) {
            // References to DOM nodes are pinned to 'any' when `checkTypeOfDomReferences` is `false`.
            // References to `TemplateRef`s and directives are pinned to 'any' when
            // `checkTypeOfNonDomReferences` is `false`.
            initializer =
                ts.createAsExpression(initializer, ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
        }
        else if (this.target instanceof TmplAstTemplate) {
            // Direct references to an <ng-template> node simply require a value of type
            // `TemplateRef<any>`. To get this, an expression of the form
            // `(_t1 as any as TemplateRef<any>)` is constructed.
            initializer =
                ts.createAsExpression(initializer, ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
            initializer = ts.createAsExpression(initializer, this.tcb.env.referenceExternalType('@angular/core', 'TemplateRef', [DYNAMIC_TYPE]));
            initializer = ts.createParen(initializer);
        }
        addParseSpanInfo(initializer, this.node.sourceSpan);
        addParseSpanInfo(id, this.node.keySpan);
        this.scope.addStatement(tsCreateVariable(id, initializer));
        return id;
    }
}
/**
 * A `TcbOp` which is used when the target of a reference is missing. This operation generates a
 * variable of type any for usages of the invalid reference to resolve to. The invalid reference
 * itself is recorded out-of-band.
 */
class TcbInvalidReferenceOp extends TcbOp {
    constructor(tcb, scope) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        // The declaration of a missing reference is only needed when the reference is resolved.
        this.optional = true;
    }
    execute() {
        const id = this.tcb.allocateId();
        this.scope.addStatement(tsCreateVariable(id, NULL_AS_ANY));
        return id;
    }
}
/**
 * A `TcbOp` which constructs an instance of a directive with types inferred from its inputs. The
 * inputs themselves are not checked here; checking of inputs is achieved in `TcbDirectiveInputsOp`.
 * Any errors reported in this statement are ignored, as the type constructor call is only present
 * for type-inference.
 *
 * When a Directive is generic, it is required that the TCB generates the instance using this method
 * in order to infer the type information correctly.
 *
 * Executing this operation returns a reference to the directive instance variable with its inferred
 * type.
 */
class TcbDirectiveCtorOp extends TcbOp {
    constructor(tcb, scope, node, dir) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.node = node;
        this.dir = dir;
    }
    get optional() {
        // The statement generated by this operation is only used to infer the directive's type and
        // won't report diagnostics by itself, so the operation is marked as optional.
        return true;
    }
    execute() {
        const id = this.tcb.allocateId();
        addExpressionIdentifier(id, ExpressionIdentifier.DIRECTIVE);
        addParseSpanInfo(id, this.node.startSourceSpan || this.node.sourceSpan);
        const genericInputs = new Map();
        const inputs = getBoundInputs(this.dir, this.node, this.tcb);
        for (const input of inputs) {
            // Skip text attributes if configured to do so.
            if (!this.tcb.env.config.checkTypeOfAttributes &&
                input.attribute instanceof TmplAstTextAttribute) {
                continue;
            }
            for (const fieldName of input.fieldNames) {
                // Skip the field if an attribute has already been bound to it; we can't have a duplicate
                // key in the type constructor call.
                if (genericInputs.has(fieldName)) {
                    continue;
                }
                const expression = translateInput(input.attribute, this.tcb, this.scope);
                genericInputs.set(fieldName, {
                    type: 'binding',
                    field: fieldName,
                    expression,
                    sourceSpan: input.attribute.sourceSpan
                });
            }
        }
        // Add unset directive inputs for each of the remaining unset fields.
        for (const [fieldName] of this.dir.inputs) {
            if (!genericInputs.has(fieldName)) {
                genericInputs.set(fieldName, { type: 'unset', field: fieldName });
            }
        }
        // Call the type constructor of the directive to infer a type, and assign the directive
        // instance.
        const typeCtor = tcbCallTypeCtor(this.dir, this.tcb, Array.from(genericInputs.values()));
        markIgnoreDiagnostics(typeCtor);
        this.scope.addStatement(tsCreateVariable(id, typeCtor));
        return id;
    }
    circularFallback() {
        return new TcbDirectiveCtorCircularFallbackOp(this.tcb, this.scope, this.node, this.dir);
    }
}
/**
 * A `TcbOp` which generates code to check input bindings on an element that correspond with the
 * members of a directive.
 *
 * Executing this operation returns nothing.
 */
class TcbDirectiveInputsOp extends TcbOp {
    constructor(tcb, scope, node, dir) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.node = node;
        this.dir = dir;
    }
    get optional() {
        return false;
    }
    execute() {
        let dirId = null;
        // TODO(joost): report duplicate properties
        const inputs = getBoundInputs(this.dir, this.node, this.tcb);
        for (const input of inputs) {
            // For bound inputs, the property is assigned the binding expression.
            let expr = translateInput(input.attribute, this.tcb, this.scope);
            if (!this.tcb.env.config.checkTypeOfInputBindings) {
                // If checking the type of bindings is disabled, cast the resulting expression to 'any'
                // before the assignment.
                expr = tsCastToAny(expr);
            }
            else if (!this.tcb.env.config.strictNullInputBindings) {
                // If strict null checks are disabled, erase `null` and `undefined` from the type by
                // wrapping the expression in a non-null assertion.
                expr = ts.createNonNullExpression(expr);
            }
            let assignment = wrapForDiagnostics(expr);
            for (const fieldName of input.fieldNames) {
                let target;
                if (this.dir.coercedInputFields.has(fieldName)) {
                    // The input has a coercion declaration which should be used instead of assigning the
                    // expression into the input field directly. To achieve this, a variable is declared
                    // with a type of `typeof Directive.ngAcceptInputType_fieldName` which is then used as
                    // target of the assignment.
                    const dirTypeRef = this.tcb.env.referenceType(this.dir.ref);
                    if (!ts.isTypeReferenceNode(dirTypeRef)) {
                        throw new Error(`Expected TypeReferenceNode from reference to ${this.dir.ref.debugName}`);
                    }
                    const id = this.tcb.allocateId();
                    const type = tsCreateTypeQueryForCoercedInput(dirTypeRef.typeName, fieldName);
                    this.scope.addStatement(tsDeclareVariable(id, type));
                    target = id;
                }
                else if (this.dir.undeclaredInputFields.has(fieldName)) {
                    // If no coercion declaration is present nor is the field declared (i.e. the input is
                    // declared in a `@Directive` or `@Component` decorator's `inputs` property) there is no
                    // assignment target available, so this field is skipped.
                    continue;
                }
                else if (!this.tcb.env.config.honorAccessModifiersForInputBindings &&
                    this.dir.restrictedInputFields.has(fieldName)) {
                    // If strict checking of access modifiers is disabled and the field is restricted
                    // (i.e. private/protected/readonly), generate an assignment into a temporary variable
                    // that has the type of the field. This achieves type-checking but circumvents the access
                    // modifiers.
                    if (dirId === null) {
                        dirId = this.scope.resolve(this.node, this.dir);
                    }
                    const id = this.tcb.allocateId();
                    const dirTypeRef = this.tcb.env.referenceType(this.dir.ref);
                    if (!ts.isTypeReferenceNode(dirTypeRef)) {
                        throw new Error(`Expected TypeReferenceNode from reference to ${this.dir.ref.debugName}`);
                    }
                    const type = ts.createIndexedAccessTypeNode(ts.createTypeQueryNode(dirId), ts.createLiteralTypeNode(ts.createStringLiteral(fieldName)));
                    const temp = tsDeclareVariable(id, type);
                    this.scope.addStatement(temp);
                    target = id;
                }
                else {
                    if (dirId === null) {
                        dirId = this.scope.resolve(this.node, this.dir);
                    }
                    // To get errors assign directly to the fields on the instance, using property access
                    // when possible. String literal fields may not be valid JS identifiers so we use
                    // literal element access instead for those cases.
                    target = this.dir.stringLiteralInputFields.has(fieldName) ?
                        ts.createElementAccess(dirId, ts.createStringLiteral(fieldName)) :
                        ts.createPropertyAccess(dirId, ts.createIdentifier(fieldName));
                }
                if (input.attribute.keySpan !== undefined) {
                    addParseSpanInfo(target, input.attribute.keySpan);
                }
                // Finally the assignment is extended by assigning it into the target expression.
                assignment = ts.createBinary(target, ts.SyntaxKind.EqualsToken, assignment);
            }
            addParseSpanInfo(assignment, input.attribute.sourceSpan);
            // Ignore diagnostics for text attributes if configured to do so.
            if (!this.tcb.env.config.checkTypeOfAttributes &&
                input.attribute instanceof TmplAstTextAttribute) {
                markIgnoreDiagnostics(assignment);
            }
            this.scope.addStatement(ts.createExpressionStatement(assignment));
        }
        return null;
    }
}
/**
 * A `TcbOp` which is used to generate a fallback expression if the inference of a directive type
 * via `TcbDirectiveCtorOp` requires a reference to its own type. This can happen using a template
 * reference:
 *
 * ```html
 * <some-cmp #ref [prop]="ref.foo"></some-cmp>
 * ```
 *
 * In this case, `TcbDirectiveCtorCircularFallbackOp` will add a second inference of the directive
 * type to the type-check block, this time calling the directive's type constructor without any
 * input expressions. This infers the widest possible supertype for the directive, which is used to
 * resolve any recursive references required to infer the real type.
 */
class TcbDirectiveCtorCircularFallbackOp extends TcbOp {
    constructor(tcb, scope, node, dir) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.node = node;
        this.dir = dir;
    }
    get optional() {
        return false;
    }
    execute() {
        const id = this.tcb.allocateId();
        const typeCtor = this.tcb.env.typeCtorFor(this.dir);
        const circularPlaceholder = ts.createCall(typeCtor, /* typeArguments */ undefined, [ts.createNonNullExpression(ts.createNull())]);
        this.scope.addStatement(tsCreateVariable(id, circularPlaceholder));
        return id;
    }
}
/**
 * A `TcbOp` which feeds elements and unclaimed properties to the `DomSchemaChecker`.
 *
 * The DOM schema is not checked via TCB code generation. Instead, the `DomSchemaChecker` ingests
 * elements and property bindings and accumulates synthetic `ts.Diagnostic`s out-of-band. These are
 * later merged with the diagnostics generated from the TCB.
 *
 * For convenience, the TCB iteration of the template is used to drive the `DomSchemaChecker` via
 * the `TcbDomSchemaCheckerOp`.
 */
class TcbDomSchemaCheckerOp extends TcbOp {
    constructor(tcb, element, checkElement, claimedInputs) {
        super();
        this.tcb = tcb;
        this.element = element;
        this.checkElement = checkElement;
        this.claimedInputs = claimedInputs;
    }
    get optional() {
        return false;
    }
    execute() {
        if (this.checkElement) {
            this.tcb.domSchemaChecker.checkElement(this.tcb.id, this.element, this.tcb.schemas);
        }
        // TODO(alxhub): this could be more efficient.
        for (const binding of this.element.inputs) {
            if (binding.type === 0 /* Property */ && this.claimedInputs.has(binding.name)) {
                // Skip this binding as it was claimed by a directive.
                continue;
            }
            if (binding.type === 0 /* Property */) {
                if (binding.name !== 'style' && binding.name !== 'class') {
                    // A direct binding to a property.
                    const propertyName = ATTR_TO_PROP[binding.name] || binding.name;
                    this.tcb.domSchemaChecker.checkProperty(this.tcb.id, this.element, propertyName, binding.sourceSpan, this.tcb.schemas);
                }
            }
        }
        return null;
    }
}
/**
 * Mapping between attributes names that don't correspond to their element property names.
 * Note: this mapping has to be kept in sync with the equally named mapping in the runtime.
 */
const ATTR_TO_PROP = {
    'class': 'className',
    'for': 'htmlFor',
    'formaction': 'formAction',
    'innerHtml': 'innerHTML',
    'readonly': 'readOnly',
    'tabindex': 'tabIndex',
};
/**
 * A `TcbOp` which generates code to check "unclaimed inputs" - bindings on an element which were
 * not attributed to any directive or component, and are instead processed against the HTML element
 * itself.
 *
 * Currently, only the expressions of these bindings are checked. The targets of the bindings are
 * checked against the DOM schema via a `TcbDomSchemaCheckerOp`.
 *
 * Executing this operation returns nothing.
 */
class TcbUnclaimedInputsOp extends TcbOp {
    constructor(tcb, scope, element, claimedInputs) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.element = element;
        this.claimedInputs = claimedInputs;
    }
    get optional() {
        return false;
    }
    execute() {
        // `this.inputs` contains only those bindings not matched by any directive. These bindings go to
        // the element itself.
        let elId = null;
        // TODO(alxhub): this could be more efficient.
        for (const binding of this.element.inputs) {
            if (binding.type === 0 /* Property */ && this.claimedInputs.has(binding.name)) {
                // Skip this binding as it was claimed by a directive.
                continue;
            }
            let expr = tcbExpression(binding.value, this.tcb, this.scope);
            if (!this.tcb.env.config.checkTypeOfInputBindings) {
                // If checking the type of bindings is disabled, cast the resulting expression to 'any'
                // before the assignment.
                expr = tsCastToAny(expr);
            }
            else if (!this.tcb.env.config.strictNullInputBindings) {
                // If strict null checks are disabled, erase `null` and `undefined` from the type by
                // wrapping the expression in a non-null assertion.
                expr = ts.createNonNullExpression(expr);
            }
            if (this.tcb.env.config.checkTypeOfDomBindings && binding.type === 0 /* Property */) {
                if (binding.name !== 'style' && binding.name !== 'class') {
                    if (elId === null) {
                        elId = this.scope.resolve(this.element);
                    }
                    // A direct binding to a property.
                    const propertyName = ATTR_TO_PROP[binding.name] || binding.name;
                    const prop = ts.createElementAccess(elId, ts.createStringLiteral(propertyName));
                    const stmt = ts.createBinary(prop, ts.SyntaxKind.EqualsToken, wrapForDiagnostics(expr));
                    addParseSpanInfo(stmt, binding.sourceSpan);
                    this.scope.addStatement(ts.createExpressionStatement(stmt));
                }
                else {
                    this.scope.addStatement(ts.createExpressionStatement(expr));
                }
            }
            else {
                // A binding to an animation, attribute, class or style. For now, only validate the right-
                // hand side of the expression.
                // TODO: properly check class and style bindings.
                this.scope.addStatement(ts.createExpressionStatement(expr));
            }
        }
        return null;
    }
}
/**
 * A `TcbOp` which generates code to check event bindings on an element that correspond with the
 * outputs of a directive.
 *
 * Executing this operation returns nothing.
 */
export class TcbDirectiveOutputsOp extends TcbOp {
    constructor(tcb, scope, node, dir) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.node = node;
        this.dir = dir;
    }
    get optional() {
        return false;
    }
    execute() {
        let dirId = null;
        const outputs = this.dir.outputs;
        for (const output of this.node.outputs) {
            if (output.type !== 0 /* Regular */ || !outputs.hasBindingPropertyName(output.name)) {
                continue;
            }
            // TODO(alxhub): consider supporting multiple fields with the same property name for outputs.
            const field = outputs.getByBindingPropertyName(output.name)[0].classPropertyName;
            if (dirId === null) {
                dirId = this.scope.resolve(this.node, this.dir);
            }
            const outputField = ts.createElementAccess(dirId, ts.createStringLiteral(field));
            addParseSpanInfo(outputField, output.keySpan);
            if (this.tcb.env.config.checkTypeOfOutputEvents) {
                // For strict checking of directive events, generate a call to the `subscribe` method
                // on the directive's output field to let type information flow into the handler function's
                // `$event` parameter.
                const handler = tcbCreateEventHandler(output, this.tcb, this.scope, 0 /* Infer */);
                const subscribeFn = ts.createPropertyAccess(outputField, 'subscribe');
                const call = ts.createCall(subscribeFn, /* typeArguments */ undefined, [handler]);
                addParseSpanInfo(call, output.sourceSpan);
                this.scope.addStatement(ts.createExpressionStatement(call));
            }
            else {
                // If strict checking of directive events is disabled:
                //
                // * We still generate the access to the output field as a statement in the TCB so consumers
                //   of the `TemplateTypeChecker` can still find the node for the class member for the
                //   output.
                // * Emit a handler function where the `$event` parameter has an explicit `any` type.
                this.scope.addStatement(ts.createExpressionStatement(outputField));
                const handler = tcbCreateEventHandler(output, this.tcb, this.scope, 1 /* Any */);
                this.scope.addStatement(ts.createExpressionStatement(handler));
            }
            ExpressionSemanticVisitor.visit(output.handler, this.tcb.id, this.tcb.boundTarget, this.tcb.oobRecorder);
        }
        return null;
    }
}
/**
 * A `TcbOp` which generates code to check "unclaimed outputs" - event bindings on an element which
 * were not attributed to any directive or component, and are instead processed against the HTML
 * element itself.
 *
 * Executing this operation returns nothing.
 */
class TcbUnclaimedOutputsOp extends TcbOp {
    constructor(tcb, scope, element, claimedOutputs) {
        super();
        this.tcb = tcb;
        this.scope = scope;
        this.element = element;
        this.claimedOutputs = claimedOutputs;
    }
    get optional() {
        return false;
    }
    execute() {
        let elId = null;
        // TODO(alxhub): this could be more efficient.
        for (const output of this.element.outputs) {
            if (this.claimedOutputs.has(output.name)) {
                // Skip this event handler as it was claimed by a directive.
                continue;
            }
            if (output.type === 1 /* Animation */) {
                // Animation output bindings always have an `$event` parameter of type `AnimationEvent`.
                const eventType = this.tcb.env.config.checkTypeOfAnimationEvents ?
                    this.tcb.env.referenceExternalType('@angular/animations', 'AnimationEvent') :
                    1 /* Any */;
                const handler = tcbCreateEventHandler(output, this.tcb, this.scope, eventType);
                this.scope.addStatement(ts.createExpressionStatement(handler));
            }
            else if (this.tcb.env.config.checkTypeOfDomEvents) {
                // If strict checking of DOM events is enabled, generate a call to `addEventListener` on
                // the element instance so that TypeScript's type inference for
                // `HTMLElement.addEventListener` using `HTMLElementEventMap` to infer an accurate type for
                // `$event` depending on the event name. For unknown event names, TypeScript resorts to the
                // base `Event` type.
                const handler = tcbCreateEventHandler(output, this.tcb, this.scope, 0 /* Infer */);
                if (elId === null) {
                    elId = this.scope.resolve(this.element);
                }
                const propertyAccess = ts.createPropertyAccess(elId, 'addEventListener');
                addParseSpanInfo(propertyAccess, output.keySpan);
                const call = ts.createCall(
                /* expression */ propertyAccess, 
                /* typeArguments */ undefined, 
                /* arguments */ [ts.createStringLiteral(output.name), handler]);
                addParseSpanInfo(call, output.sourceSpan);
                this.scope.addStatement(ts.createExpressionStatement(call));
            }
            else {
                // If strict checking of DOM inputs is disabled, emit a handler function where the `$event`
                // parameter has an explicit `any` type.
                const handler = tcbCreateEventHandler(output, this.tcb, this.scope, 1 /* Any */);
                this.scope.addStatement(ts.createExpressionStatement(handler));
            }
            ExpressionSemanticVisitor.visit(output.handler, this.tcb.id, this.tcb.boundTarget, this.tcb.oobRecorder);
        }
        return null;
    }
}
/**
 * A `TcbOp` which generates a completion point for the component context.
 *
 * This completion point looks like `ctx. ;` in the TCB output, and does not produce diagnostics.
 * TypeScript autocompletion APIs can be used at this completion point (after the '.') to produce
 * autocompletion results of properties and methods from the template's component context.
 */
class TcbComponentContextCompletionOp extends TcbOp {
    constructor(scope) {
        super();
        this.scope = scope;
        this.optional = false;
    }
    execute() {
        const ctx = ts.createIdentifier('ctx');
        const ctxDot = ts.createPropertyAccess(ctx, '');
        markIgnoreDiagnostics(ctxDot);
        addExpressionIdentifier(ctxDot, ExpressionIdentifier.COMPONENT_COMPLETION);
        this.scope.addStatement(ts.createExpressionStatement(ctxDot));
        return null;
    }
}
/**
 * Value used to break a circular reference between `TcbOp`s.
 *
 * This value is returned whenever `TcbOp`s have a circular dependency. The expression is a non-null
 * assertion of the null value (in TypeScript, the expression `null!`). This construction will infer
 * the least narrow type for whatever it's assigned to.
 */
const INFER_TYPE_FOR_CIRCULAR_OP_EXPR = ts.createNonNullExpression(ts.createNull());
/**
 * Overall generation context for the type check block.
 *
 * `Context` handles operations during code generation which are global with respect to the whole
 * block. It's responsible for variable name allocation and management of any imports needed. It
 * also contains the template metadata itself.
 */
export class Context {
    constructor(env, domSchemaChecker, oobRecorder, id, boundTarget, pipes, schemas) {
        this.env = env;
        this.domSchemaChecker = domSchemaChecker;
        this.oobRecorder = oobRecorder;
        this.id = id;
        this.boundTarget = boundTarget;
        this.pipes = pipes;
        this.schemas = schemas;
        this.nextId = 1;
    }
    /**
     * Allocate a new variable name for use within the `Context`.
     *
     * Currently this uses a monotonically increasing counter, but in the future the variable name
     * might change depending on the type of data being stored.
     */
    allocateId() {
        return ts.createIdentifier(`_t${this.nextId++}`);
    }
    getPipeByName(name) {
        if (!this.pipes.has(name)) {
            return null;
        }
        return this.pipes.get(name);
    }
}
/**
 * Local scope within the type check block for a particular template.
 *
 * The top-level template and each nested `<ng-template>` have their own `Scope`, which exist in a
 * hierarchy. The structure of this hierarchy mirrors the syntactic scopes in the generated type
 * check block, where each nested template is encased in an `if` structure.
 *
 * As a template's `TcbOp`s are executed in a given `Scope`, statements are added via
 * `addStatement()`. When this processing is complete, the `Scope` can be turned into a `ts.Block`
 * via `renderToBlock()`.
 *
 * If a `TcbOp` requires the output of another, it can call `resolve()`.
 */
class Scope {
    constructor(tcb, parent = null, guard = null) {
        this.tcb = tcb;
        this.parent = parent;
        this.guard = guard;
        /**
         * A queue of operations which need to be performed to generate the TCB code for this scope.
         *
         * This array can contain either a `TcbOp` which has yet to be executed, or a `ts.Expression|null`
         * representing the memoized result of executing the operation. As operations are executed, their
         * results are written into the `opQueue`, overwriting the original operation.
         *
         * If an operation is in the process of being executed, it is temporarily overwritten here with
         * `INFER_TYPE_FOR_CIRCULAR_OP_EXPR`. This way, if a cycle is encountered where an operation
         * depends transitively on its own result, the inner operation will infer the least narrow type
         * that fits instead. This has the same semantics as TypeScript itself when types are referenced
         * circularly.
         */
        this.opQueue = [];
        /**
         * A map of `TmplAstElement`s to the index of their `TcbElementOp` in the `opQueue`
         */
        this.elementOpMap = new Map();
        /**
         * A map of maps which tracks the index of `TcbDirectiveCtorOp`s in the `opQueue` for each
         * directive on a `TmplAstElement` or `TmplAstTemplate` node.
         */
        this.directiveOpMap = new Map();
        /**
         * A map of `TmplAstReference`s to the index of their `TcbReferenceOp` in the `opQueue`
         */
        this.referenceOpMap = new Map();
        /**
         * Map of immediately nested <ng-template>s (within this `Scope`) represented by `TmplAstTemplate`
         * nodes to the index of their `TcbTemplateContextOp`s in the `opQueue`.
         */
        this.templateCtxOpMap = new Map();
        /**
         * Map of variables declared on the template that created this `Scope` (represented by
         * `TmplAstVariable` nodes) to the index of their `TcbVariableOp`s in the `opQueue`.
         */
        this.varMap = new Map();
        /**
         * Statements for this template.
         *
         * Executing the `TcbOp`s in the `opQueue` populates this array.
         */
        this.statements = [];
    }
    /**
     * Constructs a `Scope` given either a `TmplAstTemplate` or a list of `TmplAstNode`s.
     *
     * @param tcb the overall context of TCB generation.
     * @param parent the `Scope` of the parent template (if any) or `null` if this is the root
     * `Scope`.
     * @param templateOrNodes either a `TmplAstTemplate` representing the template for which to
     * calculate the `Scope`, or a list of nodes if no outer template object is available.
     * @param guard an expression that is applied to this scope for type narrowing purposes.
     */
    static forNodes(tcb, parent, templateOrNodes, guard) {
        const scope = new Scope(tcb, parent, guard);
        if (parent === null && tcb.env.config.enableTemplateTypeChecker) {
            // Add an autocompletion point for the component context.
            scope.opQueue.push(new TcbComponentContextCompletionOp(scope));
        }
        let children;
        // If given an actual `TmplAstTemplate` instance, then process any additional information it
        // has.
        if (templateOrNodes instanceof TmplAstTemplate) {
            // The template's variable declarations need to be added as `TcbVariableOp`s.
            const varMap = new Map();
            for (const v of templateOrNodes.variables) {
                // Validate that variables on the `TmplAstTemplate` are only declared once.
                if (!varMap.has(v.name)) {
                    varMap.set(v.name, v);
                }
                else {
                    const firstDecl = varMap.get(v.name);
                    tcb.oobRecorder.duplicateTemplateVar(tcb.id, v, firstDecl);
                }
                const opIndex = scope.opQueue.push(new TcbVariableOp(tcb, scope, templateOrNodes, v)) - 1;
                scope.varMap.set(v, opIndex);
            }
            children = templateOrNodes.children;
        }
        else {
            children = templateOrNodes;
        }
        for (const node of children) {
            scope.appendNode(node);
        }
        return scope;
    }
    /**
     * Look up a `ts.Expression` representing the value of some operation in the current `Scope`,
     * including any parent scope(s). This method always returns a mutable clone of the
     * `ts.Expression` with the comments cleared.
     *
     * @param node a `TmplAstNode` of the operation in question. The lookup performed will depend on
     * the type of this node:
     *
     * Assuming `directive` is not present, then `resolve` will return:
     *
     * * `TmplAstElement` - retrieve the expression for the element DOM node
     * * `TmplAstTemplate` - retrieve the template context variable
     * * `TmplAstVariable` - retrieve a template let- variable
     * * `TmplAstReference` - retrieve variable created for the local ref
     *
     * @param directive if present, a directive type on a `TmplAstElement` or `TmplAstTemplate` to
     * look up instead of the default for an element or template node.
     */
    resolve(node, directive) {
        // Attempt to resolve the operation locally.
        const res = this.resolveLocal(node, directive);
        if (res !== null) {
            // We want to get a clone of the resolved expression and clear the trailing comments
            // so they don't continue to appear in every place the expression is used.
            // As an example, this would otherwise produce:
            // var _t1 /**T:DIR*/ /*1,2*/ = _ctor1();
            // _t1 /**T:DIR*/ /*1,2*/.input = 'value';
            //
            // In addition, returning a clone prevents the consumer of `Scope#resolve` from
            // attaching comments at the declaration site.
            const clone = ts.getMutableClone(res);
            ts.setSyntheticTrailingComments(clone, []);
            return clone;
        }
        else if (this.parent !== null) {
            // Check with the parent.
            return this.parent.resolve(node, directive);
        }
        else {
            throw new Error(`Could not resolve ${node} / ${directive}`);
        }
    }
    /**
     * Add a statement to this scope.
     */
    addStatement(stmt) {
        this.statements.push(stmt);
    }
    /**
     * Get the statements.
     */
    render() {
        for (let i = 0; i < this.opQueue.length; i++) {
            // Optional statements cannot be skipped when we are generating the TCB for use
            // by the TemplateTypeChecker.
            const skipOptional = !this.tcb.env.config.enableTemplateTypeChecker;
            this.executeOp(i, skipOptional);
        }
        return this.statements;
    }
    /**
     * Returns an expression of all template guards that apply to this scope, including those of
     * parent scopes. If no guards have been applied, null is returned.
     */
    guards() {
        let parentGuards = null;
        if (this.parent !== null) {
            // Start with the guards from the parent scope, if present.
            parentGuards = this.parent.guards();
        }
        if (this.guard === null) {
            // This scope does not have a guard, so return the parent's guards as is.
            return parentGuards;
        }
        else if (parentGuards === null) {
            // There's no guards from the parent scope, so this scope's guard represents all available
            // guards.
            return this.guard;
        }
        else {
            // Both the parent scope and this scope provide a guard, so create a combination of the two.
            // It is important that the parent guard is used as left operand, given that it may provide
            // narrowing that is required for this scope's guard to be valid.
            return ts.createBinary(parentGuards, ts.SyntaxKind.AmpersandAmpersandToken, this.guard);
        }
    }
    resolveLocal(ref, directive) {
        if (ref instanceof TmplAstReference && this.referenceOpMap.has(ref)) {
            return this.resolveOp(this.referenceOpMap.get(ref));
        }
        else if (ref instanceof TmplAstVariable && this.varMap.has(ref)) {
            // Resolving a context variable for this template.
            // Execute the `TcbVariableOp` associated with the `TmplAstVariable`.
            return this.resolveOp(this.varMap.get(ref));
        }
        else if (ref instanceof TmplAstTemplate && directive === undefined &&
            this.templateCtxOpMap.has(ref)) {
            // Resolving the context of the given sub-template.
            // Execute the `TcbTemplateContextOp` for the template.
            return this.resolveOp(this.templateCtxOpMap.get(ref));
        }
        else if ((ref instanceof TmplAstElement || ref instanceof TmplAstTemplate) &&
            directive !== undefined && this.directiveOpMap.has(ref)) {
            // Resolving a directive on an element or sub-template.
            const dirMap = this.directiveOpMap.get(ref);
            if (dirMap.has(directive)) {
                return this.resolveOp(dirMap.get(directive));
            }
            else {
                return null;
            }
        }
        else if (ref instanceof TmplAstElement && this.elementOpMap.has(ref)) {
            // Resolving the DOM node of an element in this template.
            return this.resolveOp(this.elementOpMap.get(ref));
        }
        else {
            return null;
        }
    }
    /**
     * Like `executeOp`, but assert that the operation actually returned `ts.Expression`.
     */
    resolveOp(opIndex) {
        const res = this.executeOp(opIndex, /* skipOptional */ false);
        if (res === null) {
            throw new Error(`Error resolving operation, got null`);
        }
        return res;
    }
    /**
     * Execute a particular `TcbOp` in the `opQueue`.
     *
     * This method replaces the operation in the `opQueue` with the result of execution (once done)
     * and also protects against a circular dependency from the operation to itself by temporarily
     * setting the operation's result to a special expression.
     */
    executeOp(opIndex, skipOptional) {
        const op = this.opQueue[opIndex];
        if (!(op instanceof TcbOp)) {
            return op;
        }
        if (skipOptional && op.optional) {
            return null;
        }
        // Set the result of the operation in the queue to its circular fallback. If executing this
        // operation results in a circular dependency, this will prevent an infinite loop and allow for
        // the resolution of such cycles.
        this.opQueue[opIndex] = op.circularFallback();
        const res = op.execute();
        // Once the operation has finished executing, it's safe to cache the real result.
        this.opQueue[opIndex] = res;
        return res;
    }
    appendNode(node) {
        if (node instanceof TmplAstElement) {
            const opIndex = this.opQueue.push(new TcbElementOp(this.tcb, this, node)) - 1;
            this.elementOpMap.set(node, opIndex);
            this.appendDirectivesAndInputsOfNode(node);
            this.appendOutputsOfNode(node);
            for (const child of node.children) {
                this.appendNode(child);
            }
            this.checkAndAppendReferencesOfNode(node);
        }
        else if (node instanceof TmplAstTemplate) {
            // Template children are rendered in a child scope.
            this.appendDirectivesAndInputsOfNode(node);
            this.appendOutputsOfNode(node);
            const ctxIndex = this.opQueue.push(new TcbTemplateContextOp(this.tcb, this)) - 1;
            this.templateCtxOpMap.set(node, ctxIndex);
            if (this.tcb.env.config.checkTemplateBodies) {
                this.opQueue.push(new TcbTemplateBodyOp(this.tcb, this, node));
            }
            else if (this.tcb.env.config.alwaysCheckSchemaInTemplateBodies) {
                this.appendDeepSchemaChecks(node.children);
            }
            this.checkAndAppendReferencesOfNode(node);
        }
        else if (node instanceof TmplAstBoundText) {
            this.opQueue.push(new TcbTextInterpolationOp(this.tcb, this, node));
        }
        else if (node instanceof TmplAstIcu) {
            this.appendIcuExpressions(node);
        }
    }
    checkAndAppendReferencesOfNode(node) {
        for (const ref of node.references) {
            const target = this.tcb.boundTarget.getReferenceTarget(ref);
            let ctxIndex;
            if (target === null) {
                // The reference is invalid if it doesn't have a target, so report it as an error.
                this.tcb.oobRecorder.missingReferenceTarget(this.tcb.id, ref);
                // Any usages of the invalid reference will be resolved to a variable of type any.
                ctxIndex = this.opQueue.push(new TcbInvalidReferenceOp(this.tcb, this)) - 1;
            }
            else if (target instanceof TmplAstTemplate || target instanceof TmplAstElement) {
                ctxIndex = this.opQueue.push(new TcbReferenceOp(this.tcb, this, ref, node, target)) - 1;
            }
            else {
                ctxIndex =
                    this.opQueue.push(new TcbReferenceOp(this.tcb, this, ref, node, target.directive)) - 1;
            }
            this.referenceOpMap.set(ref, ctxIndex);
        }
    }
    appendDirectivesAndInputsOfNode(node) {
        // Collect all the inputs on the element.
        const claimedInputs = new Set();
        const directives = this.tcb.boundTarget.getDirectivesOfNode(node);
        if (directives === null || directives.length === 0) {
            // If there are no directives, then all inputs are unclaimed inputs, so queue an operation
            // to add them if needed.
            if (node instanceof TmplAstElement) {
                this.opQueue.push(new TcbUnclaimedInputsOp(this.tcb, this, node, claimedInputs));
                this.opQueue.push(new TcbDomSchemaCheckerOp(this.tcb, node, /* checkElement */ true, claimedInputs));
            }
            return;
        }
        const dirMap = new Map();
        for (const dir of directives) {
            let directiveOp;
            const host = this.tcb.env.reflector;
            const dirRef = dir.ref;
            if (!dir.isGeneric) {
                // The most common case is that when a directive is not generic, we use the normal
                // `TcbNonDirectiveTypeOp`.
                directiveOp = new TcbNonGenericDirectiveTypeOp(this.tcb, this, node, dir);
            }
            else if (!requiresInlineTypeCtor(dirRef.node, host) ||
                this.tcb.env.config.useInlineTypeConstructors) {
                // For generic directives, we use a type constructor to infer types. If a directive requires
                // an inline type constructor, then inlining must be available to use the
                // `TcbDirectiveCtorOp`. If not we, we fallback to using `any` – see below.
                directiveOp = new TcbDirectiveCtorOp(this.tcb, this, node, dir);
            }
            else {
                // If inlining is not available, then we give up on infering the generic params, and use
                // `any` type for the directive's generic parameters.
                directiveOp = new TcbGenericDirectiveTypeWithAnyParamsOp(this.tcb, this, node, dir);
            }
            const dirIndex = this.opQueue.push(directiveOp) - 1;
            dirMap.set(dir, dirIndex);
            this.opQueue.push(new TcbDirectiveInputsOp(this.tcb, this, node, dir));
        }
        this.directiveOpMap.set(node, dirMap);
        // After expanding the directives, we might need to queue an operation to check any unclaimed
        // inputs.
        if (node instanceof TmplAstElement) {
            // Go through the directives and remove any inputs that it claims from `elementInputs`.
            for (const dir of directives) {
                for (const propertyName of dir.inputs.propertyNames) {
                    claimedInputs.add(propertyName);
                }
            }
            this.opQueue.push(new TcbUnclaimedInputsOp(this.tcb, this, node, claimedInputs));
            // If there are no directives which match this element, then it's a "plain" DOM element (or a
            // web component), and should be checked against the DOM schema. If any directives match,
            // we must assume that the element could be custom (either a component, or a directive like
            // <router-outlet>) and shouldn't validate the element name itself.
            const checkElement = directives.length === 0;
            this.opQueue.push(new TcbDomSchemaCheckerOp(this.tcb, node, checkElement, claimedInputs));
        }
    }
    appendOutputsOfNode(node) {
        // Collect all the outputs on the element.
        const claimedOutputs = new Set();
        const directives = this.tcb.boundTarget.getDirectivesOfNode(node);
        if (directives === null || directives.length === 0) {
            // If there are no directives, then all outputs are unclaimed outputs, so queue an operation
            // to add them if needed.
            if (node instanceof TmplAstElement) {
                this.opQueue.push(new TcbUnclaimedOutputsOp(this.tcb, this, node, claimedOutputs));
            }
            return;
        }
        // Queue operations for all directives to check the relevant outputs for a directive.
        for (const dir of directives) {
            this.opQueue.push(new TcbDirectiveOutputsOp(this.tcb, this, node, dir));
        }
        // After expanding the directives, we might need to queue an operation to check any unclaimed
        // outputs.
        if (node instanceof TmplAstElement) {
            // Go through the directives and register any outputs that it claims in `claimedOutputs`.
            for (const dir of directives) {
                for (const outputProperty of dir.outputs.propertyNames) {
                    claimedOutputs.add(outputProperty);
                }
            }
            this.opQueue.push(new TcbUnclaimedOutputsOp(this.tcb, this, node, claimedOutputs));
        }
    }
    appendDeepSchemaChecks(nodes) {
        for (const node of nodes) {
            if (!(node instanceof TmplAstElement || node instanceof TmplAstTemplate)) {
                continue;
            }
            if (node instanceof TmplAstElement) {
                const claimedInputs = new Set();
                const directives = this.tcb.boundTarget.getDirectivesOfNode(node);
                let hasDirectives;
                if (directives === null || directives.length === 0) {
                    hasDirectives = false;
                }
                else {
                    hasDirectives = true;
                    for (const dir of directives) {
                        for (const propertyName of dir.inputs.propertyNames) {
                            claimedInputs.add(propertyName);
                        }
                    }
                }
                this.opQueue.push(new TcbDomSchemaCheckerOp(this.tcb, node, !hasDirectives, claimedInputs));
            }
            this.appendDeepSchemaChecks(node.children);
        }
    }
    appendIcuExpressions(node) {
        for (const variable of Object.values(node.vars)) {
            this.opQueue.push(new TcbTextInterpolationOp(this.tcb, this, variable));
        }
        for (const placeholder of Object.values(node.placeholders)) {
            if (placeholder instanceof TmplAstBoundText) {
                this.opQueue.push(new TcbTextInterpolationOp(this.tcb, this, placeholder));
            }
        }
    }
}
/**
 * Create the `ctx` parameter to the top-level TCB function, with the given generic type arguments.
 */
function tcbCtxParam(node, name, typeArguments) {
    const type = ts.factory.createTypeReferenceNode(name, typeArguments);
    return ts.factory.createParameterDeclaration(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* dotDotDotToken */ undefined, 
    /* name */ 'ctx', 
    /* questionToken */ undefined, 
    /* type */ type, 
    /* initializer */ undefined);
}
/**
 * Process an `AST` expression and convert it into a `ts.Expression`, generating references to the
 * correct identifiers in the current scope.
 */
function tcbExpression(ast, tcb, scope) {
    const translator = new TcbExpressionTranslator(tcb, scope);
    return translator.translate(ast);
}
class TcbExpressionTranslator {
    constructor(tcb, scope) {
        this.tcb = tcb;
        this.scope = scope;
    }
    translate(ast) {
        // `astToTypescript` actually does the conversion. A special resolver `tcbResolve` is passed
        // which interprets specific expression nodes that interact with the `ImplicitReceiver`. These
        // nodes actually refer to identifiers within the current scope.
        return astToTypescript(ast, ast => this.resolve(ast), this.tcb.env.config);
    }
    /**
     * Resolve an `AST` expression within the given scope.
     *
     * Some `AST` expressions refer to top-level concepts (references, variables, the component
     * context). This method assists in resolving those.
     */
    resolve(ast) {
        if (ast instanceof PropertyRead && ast.receiver instanceof ImplicitReceiver) {
            // Try to resolve a bound target for this expression. If no such target is available, then
            // the expression is referencing the top-level component context. In that case, `null` is
            // returned here to let it fall through resolution so it will be caught when the
            // `ImplicitReceiver` is resolved in the branch below.
            return this.resolveTarget(ast);
        }
        else if (ast instanceof PropertyWrite && ast.receiver instanceof ImplicitReceiver) {
            const target = this.resolveTarget(ast);
            if (target === null) {
                return null;
            }
            const expr = this.translate(ast.value);
            const result = ts.createParen(ts.createBinary(target, ts.SyntaxKind.EqualsToken, expr));
            addParseSpanInfo(result, ast.sourceSpan);
            return result;
        }
        else if (ast instanceof ImplicitReceiver) {
            // AST instances representing variables and references look very similar to property reads
            // or method calls from the component context: both have the shape
            // PropertyRead(ImplicitReceiver, 'propName') or MethodCall(ImplicitReceiver, 'methodName').
            //
            // `translate` will first try to `resolve` the outer PropertyRead/MethodCall. If this works,
            // it's because the `BoundTarget` found an expression target for the whole expression, and
            // therefore `translate` will never attempt to `resolve` the ImplicitReceiver of that
            // PropertyRead/MethodCall.
            //
            // Therefore if `resolve` is called on an `ImplicitReceiver`, it's because no outer
            // PropertyRead/MethodCall resolved to a variable or reference, and therefore this is a
            // property read or method call on the component context itself.
            return ts.createIdentifier('ctx');
        }
        else if (ast instanceof BindingPipe) {
            const expr = this.translate(ast.exp);
            const pipeRef = this.tcb.getPipeByName(ast.name);
            let pipe;
            if (pipeRef === null) {
                // No pipe by that name exists in scope. Record this as an error.
                this.tcb.oobRecorder.missingPipe(this.tcb.id, ast);
                // Use an 'any' value to at least allow the rest of the expression to be checked.
                pipe = NULL_AS_ANY;
            }
            else {
                // Use a variable declared as the pipe's type.
                pipe = this.tcb.env.pipeInst(pipeRef);
            }
            const args = ast.args.map(arg => this.translate(arg));
            let methodAccess = ts.factory.createPropertyAccessExpression(pipe, 'transform');
            addParseSpanInfo(methodAccess, ast.nameSpan);
            if (!this.tcb.env.config.checkTypeOfPipes) {
                methodAccess = ts.factory.createAsExpression(methodAccess, ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
            }
            const result = ts.createCall(
            /* expression */ methodAccess, 
            /* typeArguments */ undefined, 
            /* argumentsArray */ [expr, ...args]);
            addParseSpanInfo(result, ast.sourceSpan);
            return result;
        }
        else if (ast instanceof MethodCall && ast.receiver instanceof ImplicitReceiver &&
            !(ast.receiver instanceof ThisReceiver)) {
            // Resolve the special `$any(expr)` syntax to insert a cast of the argument to type `any`.
            // `$any(expr)` -> `expr as any`
            if (ast.name === '$any' && ast.args.length === 1) {
                const expr = this.translate(ast.args[0]);
                const exprAsAny = ts.createAsExpression(expr, ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                const result = ts.createParen(exprAsAny);
                addParseSpanInfo(result, ast.sourceSpan);
                return result;
            }
            // Attempt to resolve a bound target for the method, and generate the method call if a target
            // could be resolved. If no target is available, then the method is referencing the top-level
            // component context, in which case `null` is returned to let the `ImplicitReceiver` being
            // resolved to the component context.
            const receiver = this.resolveTarget(ast);
            if (receiver === null) {
                return null;
            }
            const method = wrapForDiagnostics(receiver);
            addParseSpanInfo(method, ast.nameSpan);
            const args = ast.args.map(arg => this.translate(arg));
            const node = ts.createCall(method, undefined, args);
            addParseSpanInfo(node, ast.sourceSpan);
            return node;
        }
        else {
            // This AST isn't special after all.
            return null;
        }
    }
    /**
     * Attempts to resolve a bound target for a given expression, and translates it into the
     * appropriate `ts.Expression` that represents the bound target. If no target is available,
     * `null` is returned.
     */
    resolveTarget(ast) {
        const binding = this.tcb.boundTarget.getExpressionTarget(ast);
        if (binding === null) {
            return null;
        }
        const expr = this.scope.resolve(binding);
        addParseSpanInfo(expr, ast.sourceSpan);
        return expr;
    }
}
/**
 * Call the type constructor of a directive instance on a given template node, inferring a type for
 * the directive instance from any bound inputs.
 */
function tcbCallTypeCtor(dir, tcb, inputs) {
    const typeCtor = tcb.env.typeCtorFor(dir);
    // Construct an array of `ts.PropertyAssignment`s for each of the directive's inputs.
    const members = inputs.map(input => {
        const propertyName = ts.createStringLiteral(input.field);
        if (input.type === 'binding') {
            // For bound inputs, the property is assigned the binding expression.
            let expr = input.expression;
            if (!tcb.env.config.checkTypeOfInputBindings) {
                // If checking the type of bindings is disabled, cast the resulting expression to 'any'
                // before the assignment.
                expr = tsCastToAny(expr);
            }
            else if (!tcb.env.config.strictNullInputBindings) {
                // If strict null checks are disabled, erase `null` and `undefined` from the type by
                // wrapping the expression in a non-null assertion.
                expr = ts.createNonNullExpression(expr);
            }
            const assignment = ts.createPropertyAssignment(propertyName, wrapForDiagnostics(expr));
            addParseSpanInfo(assignment, input.sourceSpan);
            return assignment;
        }
        else {
            // A type constructor is required to be called with all input properties, so any unset
            // inputs are simply assigned a value of type `any` to ignore them.
            return ts.createPropertyAssignment(propertyName, NULL_AS_ANY);
        }
    });
    // Call the `ngTypeCtor` method on the directive class, with an object literal argument created
    // from the matched inputs.
    return ts.createCall(
    /* expression */ typeCtor, 
    /* typeArguments */ undefined, 
    /* argumentsArray */ [ts.createObjectLiteral(members)]);
}
function getBoundInputs(directive, node, tcb) {
    const boundInputs = [];
    const processAttribute = (attr) => {
        // Skip non-property bindings.
        if (attr instanceof TmplAstBoundAttribute && attr.type !== 0 /* Property */) {
            return;
        }
        // Skip the attribute if the directive does not have an input for it.
        const inputs = directive.inputs.getByBindingPropertyName(attr.name);
        if (inputs === null) {
            return;
        }
        const fieldNames = inputs.map(input => input.classPropertyName);
        boundInputs.push({ attribute: attr, fieldNames });
    };
    node.inputs.forEach(processAttribute);
    node.attributes.forEach(processAttribute);
    if (node instanceof TmplAstTemplate) {
        node.templateAttrs.forEach(processAttribute);
    }
    return boundInputs;
}
/**
 * Translates the given attribute binding to a `ts.Expression`.
 */
function translateInput(attr, tcb, scope) {
    if (attr instanceof TmplAstBoundAttribute) {
        // Produce an expression representing the value of the binding.
        return tcbExpression(attr.value, tcb, scope);
    }
    else {
        // For regular attributes with a static string value, use the represented string literal.
        return ts.createStringLiteral(attr.value);
    }
}
const EVENT_PARAMETER = '$event';
/**
 * Creates an arrow function to be used as handler function for event bindings. The handler
 * function has a single parameter `$event` and the bound event's handler `AST` represented as a
 * TypeScript expression as its body.
 *
 * When `eventType` is set to `Infer`, the `$event` parameter will not have an explicit type. This
 * allows for the created handler function to have its `$event` parameter's type inferred based on
 * how it's used, to enable strict type checking of event bindings. When set to `Any`, the `$event`
 * parameter will have an explicit `any` type, effectively disabling strict type checking of event
 * bindings. Alternatively, an explicit type can be passed for the `$event` parameter.
 */
function tcbCreateEventHandler(event, tcb, scope, eventType) {
    const handler = tcbEventHandlerExpression(event.handler, tcb, scope);
    let eventParamType;
    if (eventType === 0 /* Infer */) {
        eventParamType = undefined;
    }
    else if (eventType === 1 /* Any */) {
        eventParamType = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }
    else {
        eventParamType = eventType;
    }
    // Obtain all guards that have been applied to the scope and its parents, as they have to be
    // repeated within the handler function for their narrowing to be in effect within the handler.
    const guards = scope.guards();
    let body = ts.createExpressionStatement(handler);
    if (guards !== null) {
        // Wrap the body in an `if` statement containing all guards that have to be applied.
        body = ts.createIf(guards, body);
    }
    const eventParam = ts.createParameter(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* dotDotDotToken */ undefined, 
    /* name */ EVENT_PARAMETER, 
    /* questionToken */ undefined, 
    /* type */ eventParamType);
    addExpressionIdentifier(eventParam, ExpressionIdentifier.EVENT_PARAMETER);
    return ts.createFunctionExpression(
    /* modifier */ undefined, 
    /* asteriskToken */ undefined, 
    /* name */ undefined, 
    /* typeParameters */ undefined, 
    /* parameters */ [eventParam], 
    /* type */ ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), 
    /* body */ ts.createBlock([body]));
}
/**
 * Similar to `tcbExpression`, this function converts the provided `AST` expression into a
 * `ts.Expression`, with special handling of the `$event` variable that can be used within event
 * bindings.
 */
function tcbEventHandlerExpression(ast, tcb, scope) {
    const translator = new TcbEventHandlerTranslator(tcb, scope);
    return translator.translate(ast);
}
class TcbEventHandlerTranslator extends TcbExpressionTranslator {
    resolve(ast) {
        // Recognize a property read on the implicit receiver corresponding with the event parameter
        // that is available in event bindings. Since this variable is a parameter of the handler
        // function that the converted expression becomes a child of, just create a reference to the
        // parameter by its name.
        if (ast instanceof PropertyRead && ast.receiver instanceof ImplicitReceiver &&
            !(ast.receiver instanceof ThisReceiver) && ast.name === EVENT_PARAMETER) {
            const event = ts.createIdentifier(EVENT_PARAMETER);
            addParseSpanInfo(event, ast.nameSpan);
            return event;
        }
        return super.resolve(ast);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jaGVja19ibG9jay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy90eXBlX2NoZWNrX2Jsb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBTSxXQUFXLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQW9DLFlBQVksRUFBRSxhQUFhLEVBQWtCLFlBQVksRUFBRSxxQkFBcUIsRUFBcUIsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBZSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsb0JBQW9CLEVBQUUsZUFBZSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDclksT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFPakMsT0FBTyxFQUFDLHVCQUF1QixFQUFFLG9CQUFvQixFQUFFLHFCQUFxQixFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ2hHLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFHdEcsT0FBTyxFQUFDLGVBQWUsRUFBRSxXQUFXLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFMUQsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDL0QsT0FBTyxFQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLGdDQUFnQyxFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQzVJLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzFELE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBRTlEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVkseUJBdUJY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OlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNULCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEJvdW5kVGFyZ2V0LCBEWU5BTUlDX1RZUEUsIEltcGxpY2l0UmVjZWl2ZXIsIE1ldGhvZENhbGwsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VTb3VyY2VTcGFuLCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFNjaGVtYU1ldGFkYXRhLCBUaGlzUmVjZWl2ZXIsIFRtcGxBc3RCb3VuZEF0dHJpYnV0ZSwgVG1wbEFzdEJvdW5kRXZlbnQsIFRtcGxBc3RCb3VuZFRleHQsIFRtcGxBc3RFbGVtZW50LCBUbXBsQXN0SWN1LCBUbXBsQXN0Tm9kZSwgVG1wbEFzdFJlZmVyZW5jZSwgVG1wbEFzdFRlbXBsYXRlLCBUbXBsQXN0VGV4dEF0dHJpYnV0ZSwgVG1wbEFzdFZhcmlhYmxlfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtDbGFzc1Byb3BlcnR5TmFtZX0gZnJvbSAnLi4vLi4vbWV0YWRhdGEnO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge1RlbXBsYXRlSWQsIFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBUeXBlQ2hlY2tCbG9ja01ldGFkYXRhfSBmcm9tICcuLi9hcGknO1xuXG5pbXBvcnQge2FkZEV4cHJlc3Npb25JZGVudGlmaWVyLCBFeHByZXNzaW9uSWRlbnRpZmllciwgbWFya0lnbm9yZURpYWdub3N0aWNzfSBmcm9tICcuL2NvbW1lbnRzJztcbmltcG9ydCB7YWRkUGFyc2VTcGFuSW5mbywgYWRkVGVtcGxhdGVJZCwgd3JhcEZvckRpYWdub3N0aWNzLCB3cmFwRm9yVHlwZUNoZWNrZXJ9IGZyb20gJy4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtEb21TY2hlbWFDaGVja2VyfSBmcm9tICcuL2RvbSc7XG5pbXBvcnQge0Vudmlyb25tZW50fSBmcm9tICcuL2Vudmlyb25tZW50JztcbmltcG9ydCB7YXN0VG9UeXBlc2NyaXB0LCBOVUxMX0FTX0FOWX0gZnJvbSAnLi9leHByZXNzaW9uJztcbmltcG9ydCB7T3V0T2ZCYW5kRGlhZ25vc3RpY1JlY29yZGVyfSBmcm9tICcuL29vYic7XG5pbXBvcnQge0V4cHJlc3Npb25TZW1hbnRpY1Zpc2l0b3J9IGZyb20gJy4vdGVtcGxhdGVfc2VtYW50aWNzJztcbmltcG9ydCB7dHNDYWxsTWV0aG9kLCB0c0Nhc3RUb0FueSwgdHNDcmVhdGVFbGVtZW50LCB0c0NyZWF0ZVR5cGVRdWVyeUZvckNvZXJjZWRJbnB1dCwgdHNDcmVhdGVWYXJpYWJsZSwgdHNEZWNsYXJlVmFyaWFibGV9IGZyb20gJy4vdHNfdXRpbCc7XG5pbXBvcnQge3JlcXVpcmVzSW5saW5lVHlwZUN0b3J9IGZyb20gJy4vdHlwZV9jb25zdHJ1Y3Rvcic7XG5pbXBvcnQge1R5cGVQYXJhbWV0ZXJFbWl0dGVyfSBmcm9tICcuL3R5cGVfcGFyYW1ldGVyX2VtaXR0ZXInO1xuXG4vKipcbiAqIENvbnRyb2xzIGhvdyBnZW5lcmljcyBmb3IgdGhlIGNvbXBvbmVudCBjb250ZXh0IGNsYXNzIHdpbGwgYmUgaGFuZGxlZCBkdXJpbmcgVENCIGdlbmVyYXRpb24uXG4gKi9cbmV4cG9ydCBlbnVtIFRjYkdlbmVyaWNDb250ZXh0QmVoYXZpb3Ige1xuICAvKipcbiAgICogUmVmZXJlbmNlcyB0byBnZW5lcmljIHBhcmFtZXRlciBib3VuZHMgd2lsbCBiZSBlbWl0dGVkIHZpYSB0aGUgYFR5cGVQYXJhbWV0ZXJFbWl0dGVyYC5cbiAgICpcbiAgICogVGhlIGNhbGxlciBtdXN0IHZlcmlmeSB0aGF0IGFsbCBwYXJhbWV0ZXIgYm91bmRzIGFyZSBlbWl0dGFibGUgaW4gb3JkZXIgdG8gdXNlIHRoaXMgbW9kZS5cbiAgICovXG4gIFVzZUVtaXR0ZXIsXG5cbiAgLyoqXG4gICAqIEdlbmVyaWMgcGFyYW1ldGVyIGRlY2xhcmF0aW9ucyB3aWxsIGJlIGNvcGllZCBkaXJlY3RseSBmcm9tIHRoZSBgdHMuQ2xhc3NEZWNsYXJhdGlvbmAgb2YgdGhlXG4gICAqIGNvbXBvbmVudCBjbGFzcy5cbiAgICpcbiAgICogVGhlIGNhbGxlciBtdXN0IG9ubHkgdXNlIHRoZSBnZW5lcmF0ZWQgVENCIGNvZGUgaW4gYSBjb250ZXh0IHdoZXJlIHN1Y2ggY29waWVzIHdpbGwgc3RpbGwgYmVcbiAgICogdmFsaWQsIHN1Y2ggYXMgYW4gaW5saW5lIHR5cGUgY2hlY2sgYmxvY2suXG4gICAqL1xuICBDb3B5Q2xhc3NOb2RlcyxcblxuICAvKipcbiAgICogQW55IGdlbmVyaWMgcGFyYW1ldGVycyBmb3IgdGhlIGNvbXBvbmVudCBjb250ZXh0IGNsYXNzIHdpbGwgYmUgc2V0IHRvIGBhbnlgLlxuICAgKlxuICAgKiBQcm9kdWNlcyBhIGxlc3MgdXNlZnVsIHR5cGUsIGJ1dCBpcyBhbHdheXMgc2FmZSB0byB1c2UuXG4gICAqL1xuICBGYWxsYmFja1RvQW55LFxufVxuXG4vKipcbiAqIEdpdmVuIGEgYHRzLkNsYXNzRGVjbGFyYXRpb25gIGZvciBhIGNvbXBvbmVudCwgYW5kIG1ldGFkYXRhIHJlZ2FyZGluZyB0aGF0IGNvbXBvbmVudCwgY29tcG9zZSBhXG4gKiBcInR5cGUgY2hlY2sgYmxvY2tcIiBmdW5jdGlvbi5cbiAqXG4gKiBXaGVuIHBhc3NlZCB0aHJvdWdoIFR5cGVTY3JpcHQncyBUeXBlQ2hlY2tlciwgdHlwZSBlcnJvcnMgdGhhdCBhcmlzZSB3aXRoaW4gdGhlIHR5cGUgY2hlY2sgYmxvY2tcbiAqIGZ1bmN0aW9uIGluZGljYXRlIGlzc3VlcyBpbiB0aGUgdGVtcGxhdGUgaXRzZWxmLlxuICpcbiAqIEFzIGEgc2lkZSBlZmZlY3Qgb2YgZ2VuZXJhdGluZyBhIFRDQiBmb3IgdGhlIGNvbXBvbmVudCwgYHRzLkRpYWdub3N0aWNgcyBtYXkgYWxzbyBiZSBwcm9kdWNlZFxuICogZGlyZWN0bHkgZm9yIGlzc3VlcyB3aXRoaW4gdGhlIHRlbXBsYXRlIHdoaWNoIGFyZSBpZGVudGlmaWVkIGR1cmluZyBnZW5lcmF0aW9uLiBUaGVzZSBpc3N1ZXMgYXJlXG4gKiByZWNvcmRlZCBpbiBlaXRoZXIgdGhlIGBkb21TY2hlbWFDaGVja2VyYCAod2hpY2ggY2hlY2tzIHVzYWdlIG9mIERPTSBlbGVtZW50cyBhbmQgYmluZGluZ3MpIGFzXG4gKiB3ZWxsIGFzIHRoZSBgb29iUmVjb3JkZXJgICh3aGljaCByZWNvcmRzIGVycm9ycyB3aGVuIHRoZSB0eXBlLWNoZWNraW5nIGNvZGUgZ2VuZXJhdG9yIGlzIHVuYWJsZVxuICogdG8gc3VmZmljaWVudGx5IHVuZGVyc3RhbmQgYSB0ZW1wbGF0ZSkuXG4gKlxuICogQHBhcmFtIGVudiBhbiBgRW52aXJvbm1lbnRgIGludG8gd2hpY2ggdHlwZS1jaGVja2luZyBjb2RlIHdpbGwgYmUgZ2VuZXJhdGVkLlxuICogQHBhcmFtIHJlZiBhIGBSZWZlcmVuY2VgIHRvIHRoZSBjb21wb25lbnQgY2xhc3Mgd2hpY2ggc2hvdWxkIGJlIHR5cGUtY2hlY2tlZC5cbiAqIEBwYXJhbSBuYW1lIGEgYHRzLklkZW50aWZpZXJgIHRvIHVzZSBmb3IgdGhlIGdlbmVyYXRlZCBgdHMuRnVuY3Rpb25EZWNsYXJhdGlvbmAuXG4gKiBAcGFyYW0gbWV0YSBtZXRhZGF0YSBhYm91dCB0aGUgY29tcG9uZW50J3MgdGVtcGxhdGUgYW5kIHRoZSBmdW5jdGlvbiBiZWluZyBnZW5lcmF0ZWQuXG4gKiBAcGFyYW0gZG9tU2NoZW1hQ2hlY2tlciB1c2VkIHRvIGNoZWNrIGFuZCByZWNvcmQgZXJyb3JzIHJlZ2FyZGluZyBpbXByb3BlciB1c2FnZSBvZiBET00gZWxlbWVudHNcbiAqIGFuZCBiaW5kaW5ncy5cbiAqIEBwYXJhbSBvb2JSZWNvcmRlciB1c2VkIHRvIHJlY29yZCBlcnJvcnMgcmVnYXJkaW5nIHRlbXBsYXRlIGVsZW1lbnRzIHdoaWNoIGNvdWxkIG5vdCBiZSBjb3JyZWN0bHlcbiAqIHRyYW5zbGF0ZWQgaW50byB0eXBlcyBkdXJpbmcgVENCIGdlbmVyYXRpb24uXG4gKiBAcGFyYW0gZ2VuZXJpY0NvbnRleHRCZWhhdmlvciBjb250cm9scyBob3cgZ2VuZXJpYyBwYXJhbWV0ZXJzIChlc3BlY2lhbGx5IHBhcmFtZXRlcnMgd2l0aCBnZW5lcmljXG4gKiBib3VuZHMpIHdpbGwgYmUgcmVmZXJlbmNlZCBmcm9tIHRoZSBnZW5lcmF0ZWQgVENCIGNvZGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVR5cGVDaGVja0Jsb2NrKFxuICAgIGVudjogRW52aXJvbm1lbnQsIHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+LCBuYW1lOiB0cy5JZGVudGlmaWVyLFxuICAgIG1ldGE6IFR5cGVDaGVja0Jsb2NrTWV0YWRhdGEsIGRvbVNjaGVtYUNoZWNrZXI6IERvbVNjaGVtYUNoZWNrZXIsXG4gICAgb29iUmVjb3JkZXI6IE91dE9mQmFuZERpYWdub3N0aWNSZWNvcmRlcixcbiAgICBnZW5lcmljQ29udGV4dEJlaGF2aW9yOiBUY2JHZW5lcmljQ29udGV4dEJlaGF2aW9yKTogdHMuRnVuY3Rpb25EZWNsYXJhdGlvbiB7XG4gIGNvbnN0IHRjYiA9IG5ldyBDb250ZXh0KFxuICAgICAgZW52LCBkb21TY2hlbWFDaGVja2VyLCBvb2JSZWNvcmRlciwgbWV0YS5pZCwgbWV0YS5ib3VuZFRhcmdldCwgbWV0YS5waXBlcywgbWV0YS5zY2hlbWFzKTtcbiAgY29uc3Qgc2NvcGUgPSBTY29wZS5mb3JOb2Rlcyh0Y2IsIG51bGwsIHRjYi5ib3VuZFRhcmdldC50YXJnZXQudGVtcGxhdGUgISwgLyogZ3VhcmQgKi8gbnVsbCk7XG4gIGNvbnN0IGN0eFJhd1R5cGUgPSBlbnYucmVmZXJlbmNlVHlwZShyZWYpO1xuICBpZiAoIXRzLmlzVHlwZVJlZmVyZW5jZU5vZGUoY3R4UmF3VHlwZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBFeHBlY3RlZCBUeXBlUmVmZXJlbmNlTm9kZSB3aGVuIHJlZmVyZW5jaW5nIHRoZSBjdHggcGFyYW0gZm9yICR7cmVmLmRlYnVnTmFtZX1gKTtcbiAgfVxuXG4gIGxldCB0eXBlUGFyYW1ldGVyczogdHMuVHlwZVBhcmFtZXRlckRlY2xhcmF0aW9uW118dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgdHlwZUFyZ3VtZW50czogdHMuVHlwZU5vZGVbXXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgaWYgKHJlZi5ub2RlLnR5cGVQYXJhbWV0ZXJzICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoIWVudi5jb25maWcudXNlQ29udGV4dEdlbmVyaWNUeXBlKSB7XG4gICAgICBnZW5lcmljQ29udGV4dEJlaGF2aW9yID0gVGNiR2VuZXJpY0NvbnRleHRCZWhhdmlvci5GYWxsYmFja1RvQW55O1xuICAgIH1cblxuICAgIHN3aXRjaCAoZ2VuZXJpY0NvbnRleHRCZWhhdmlvcikge1xuICAgICAgY2FzZSBUY2JHZW5lcmljQ29udGV4dEJlaGF2aW9yLlVzZUVtaXR0ZXI6XG4gICAgICAgIC8vIEd1YXJhbnRlZWQgdG8gZW1pdCB0eXBlIHBhcmFtZXRlcnMgc2luY2Ugd2UgY2hlY2tlZCB0aGF0IHRoZSBjbGFzcyBoYXMgdGhlbSBhYm92ZS5cbiAgICAgICAgdHlwZVBhcmFtZXRlcnMgPSBuZXcgVHlwZVBhcmFtZXRlckVtaXR0ZXIocmVmLm5vZGUudHlwZVBhcmFtZXRlcnMsIGVudi5yZWZsZWN0b3IpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbWl0KHR5cGVSZWYgPT4gZW52LnJlZmVyZW5jZVR5cGUodHlwZVJlZikpITtcbiAgICAgICAgdHlwZUFyZ3VtZW50cyA9IHR5cGVQYXJhbWV0ZXJzLm1hcChwYXJhbSA9PiB0cy5mYWN0b3J5LmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKHBhcmFtLm5hbWUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFRjYkdlbmVyaWNDb250ZXh0QmVoYXZpb3IuQ29weUNsYXNzTm9kZXM6XG4gICAgICAgIHR5cGVQYXJhbWV0ZXJzID0gWy4uLnJlZi5ub2RlLnR5cGVQYXJhbWV0ZXJzXTtcbiAgICAgICAgdHlwZUFyZ3VtZW50cyA9IHR5cGVQYXJhbWV0ZXJzLm1hcChwYXJhbSA9PiB0cy5mYWN0b3J5LmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKHBhcmFtLm5hbWUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFRjYkdlbmVyaWNDb250ZXh0QmVoYXZpb3IuRmFsbGJhY2tUb0FueTpcbiAgICAgICAgdHlwZUFyZ3VtZW50cyA9IHJlZi5ub2RlLnR5cGVQYXJhbWV0ZXJzLm1hcChcbiAgICAgICAgICAgICgpID0+IHRzLmZhY3RvcnkuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuQW55S2V5d29yZCkpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBjb25zdCBwYXJhbUxpc3QgPSBbdGNiQ3R4UGFyYW0ocmVmLm5vZGUsIGN0eFJhd1R5cGUudHlwZU5hbWUsIHR5cGVBcmd1bWVudHMpXTtcblxuICBjb25zdCBzY29wZVN0YXRlbWVudHMgPSBzY29wZS5yZW5kZXIoKTtcbiAgY29uc3QgaW5uZXJCb2R5ID0gdHMuY3JlYXRlQmxvY2soW1xuICAgIC4uLmVudi5nZXRQcmVsdWRlU3RhdGVtZW50cygpLFxuICAgIC4uLnNjb3BlU3RhdGVtZW50cyxcbiAgXSk7XG5cbiAgLy8gV3JhcCB0aGUgYm9keSBpbiBhbiBcImlmICh0cnVlKVwiIGV4cHJlc3Npb24uIFRoaXMgaXMgdW5uZWNlc3NhcnkgYnV0IGhhcyB0aGUgZWZmZWN0IG9mIGNhdXNpbmdcbiAgLy8gdGhlIGB0cy5QcmludGVyYCB0byBmb3JtYXQgdGhlIHR5cGUtY2hlY2sgYmxvY2sgbmljZWx5LlxuICBjb25zdCBib2R5ID0gdHMuY3JlYXRlQmxvY2soW3RzLmNyZWF0ZUlmKHRzLmNyZWF0ZVRydWUoKSwgaW5uZXJCb2R5LCB1bmRlZmluZWQpXSk7XG4gIGNvbnN0IGZuRGVjbCA9IHRzLmNyZWF0ZUZ1bmN0aW9uRGVjbGFyYXRpb24oXG4gICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBhc3Rlcmlza1Rva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG5hbWUgKi8gbmFtZSxcbiAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIGVudi5jb25maWcudXNlQ29udGV4dEdlbmVyaWNUeXBlID8gdHlwZVBhcmFtZXRlcnMgOiB1bmRlZmluZWQsXG4gICAgICAvKiBwYXJhbWV0ZXJzICovIHBhcmFtTGlzdCxcbiAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogYm9keSAqLyBib2R5KTtcbiAgYWRkVGVtcGxhdGVJZChmbkRlY2wsIG1ldGEuaWQpO1xuICByZXR1cm4gZm5EZWNsO1xufVxuXG4vKipcbiAqIEEgY29kZSBnZW5lcmF0aW9uIG9wZXJhdGlvbiB0aGF0J3MgaW52b2x2ZWQgaW4gdGhlIGNvbnN0cnVjdGlvbiBvZiBhIFR5cGUgQ2hlY2sgQmxvY2suXG4gKlxuICogVGhlIGdlbmVyYXRpb24gb2YgYSBUQ0IgaXMgbm9uLWxpbmVhci4gQmluZGluZ3Mgd2l0aGluIGEgdGVtcGxhdGUgbWF5IHJlc3VsdCBpbiB0aGUgbmVlZCB0b1xuICogY29uc3RydWN0IGNlcnRhaW4gdHlwZXMgZWFybGllciB0aGFuIHRoZXkgb3RoZXJ3aXNlIHdvdWxkIGJlIGNvbnN0cnVjdGVkLiBUaGF0IGlzLCBpZiB0aGVcbiAqIGdlbmVyYXRpb24gb2YgYSBUQ0IgZm9yIGEgdGVtcGxhdGUgaXMgYnJva2VuIGRvd24gaW50byBzcGVjaWZpYyBvcGVyYXRpb25zIChjb25zdHJ1Y3RpbmcgYVxuICogZGlyZWN0aXZlLCBleHRyYWN0aW5nIGEgdmFyaWFibGUgZnJvbSBhIGxldC0gb3BlcmF0aW9uLCBldGMpLCB0aGVuIGl0J3MgcG9zc2libGUgZm9yIG9wZXJhdGlvbnNcbiAqIGVhcmxpZXIgaW4gdGhlIHNlcXVlbmNlIHRvIGRlcGVuZCBvbiBvcGVyYXRpb25zIHdoaWNoIG9jY3VyIGxhdGVyIGluIHRoZSBzZXF1ZW5jZS5cbiAqXG4gKiBgVGNiT3BgIGFic3RyYWN0cyB0aGUgZGlmZmVyZW50IHR5cGVzIG9mIG9wZXJhdGlvbnMgd2hpY2ggYXJlIHJlcXVpcmVkIHRvIGNvbnZlcnQgYSB0ZW1wbGF0ZSBpbnRvXG4gKiBhIFRDQi4gVGhpcyBhbGxvd3MgZm9yIHR3byBwaGFzZXMgb2YgcHJvY2Vzc2luZyBmb3IgdGhlIHRlbXBsYXRlLCB3aGVyZSAxKSBhIGxpbmVhciBzZXF1ZW5jZSBvZlxuICogYFRjYk9wYHMgaXMgZ2VuZXJhdGVkLCBhbmQgdGhlbiAyKSB0aGVzZSBvcGVyYXRpb25zIGFyZSBleGVjdXRlZCwgbm90IG5lY2Vzc2FyaWx5IGluIGxpbmVhclxuICogb3JkZXIuXG4gKlxuICogRWFjaCBgVGNiT3BgIG1heSBpbnNlcnQgc3RhdGVtZW50cyBpbnRvIHRoZSBib2R5IG9mIHRoZSBUQ0IsIGFuZCBhbHNvIG9wdGlvbmFsbHkgcmV0dXJuIGFcbiAqIGB0cy5FeHByZXNzaW9uYCB3aGljaCBjYW4gYmUgdXNlZCB0byByZWZlcmVuY2UgdGhlIG9wZXJhdGlvbidzIHJlc3VsdC5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVGNiT3Age1xuICAvKipcbiAgICogU2V0IHRvIHRydWUgaWYgdGhpcyBvcGVyYXRpb24gY2FuIGJlIGNvbnNpZGVyZWQgb3B0aW9uYWwuIE9wdGlvbmFsIG9wZXJhdGlvbnMgYXJlIG9ubHkgZXhlY3V0ZWRcbiAgICogd2hlbiBkZXBlbmRlZCB1cG9uIGJ5IG90aGVyIG9wZXJhdGlvbnMsIG90aGVyd2lzZSB0aGV5IGFyZSBkaXNyZWdhcmRlZC4gVGhpcyBhbGxvd3MgZm9yIGxlc3NcbiAgICogY29kZSB0byBnZW5lcmF0ZSwgcGFyc2UgYW5kIHR5cGUtY2hlY2ssIG92ZXJhbGwgcG9zaXRpdmVseSBjb250cmlidXRpbmcgdG8gcGVyZm9ybWFuY2UuXG4gICAqL1xuICBhYnN0cmFjdCByZWFkb25seSBvcHRpb25hbDogYm9vbGVhbjtcblxuICBhYnN0cmFjdCBleGVjdXRlKCk6IHRzLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogUmVwbGFjZW1lbnQgdmFsdWUgb3Igb3BlcmF0aW9uIHVzZWQgd2hpbGUgdGhpcyBgVGNiT3BgIGlzIGV4ZWN1dGluZyAoaS5lLiB0byByZXNvbHZlIGNpcmN1bGFyXG4gICAqIHJlZmVyZW5jZXMgZHVyaW5nIGl0cyBleGVjdXRpb24pLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzdWFsbHkgYSBgbnVsbCFgIGV4cHJlc3Npb24gKHdoaWNoIGFza3MgVFMgdG8gaW5mZXIgYW4gYXBwcm9wcmlhdGUgdHlwZSksIGJ1dCBhbm90aGVyXG4gICAqIGBUY2JPcGAgY2FuIGJlIHJldHVybmVkIGluIGNhc2VzIHdoZXJlIGFkZGl0aW9uYWwgY29kZSBnZW5lcmF0aW9uIGlzIG5lY2Vzc2FyeSB0byBkZWFsIHdpdGhcbiAgICogY2lyY3VsYXIgcmVmZXJlbmNlcy5cbiAgICovXG4gIGNpcmN1bGFyRmFsbGJhY2soKTogVGNiT3B8dHMuRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIElORkVSX1RZUEVfRk9SX0NJUkNVTEFSX09QX0VYUFI7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggY3JlYXRlcyBhbiBleHByZXNzaW9uIGZvciBhIG5hdGl2ZSBET00gZWxlbWVudCAob3Igd2ViIGNvbXBvbmVudCkgZnJvbSBhXG4gKiBgVG1wbEFzdEVsZW1lbnRgLlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBlbGVtZW50IHZhcmlhYmxlLlxuICovXG5jbGFzcyBUY2JFbGVtZW50T3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBlbGVtZW50OiBUbXBsQXN0RWxlbWVudCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgLy8gVGhlIHN0YXRlbWVudCBnZW5lcmF0ZWQgYnkgdGhpcyBvcGVyYXRpb24gaXMgb25seSB1c2VkIGZvciB0eXBlLWluZmVyZW5jZSBvZiB0aGUgRE9NXG4gICAgLy8gZWxlbWVudCdzIHR5cGUgYW5kIHdvbid0IHJlcG9ydCBkaWFnbm9zdGljcyBieSBpdHNlbGYsIHNvIHRoZSBvcGVyYXRpb24gaXMgbWFya2VkIGFzIG9wdGlvbmFsXG4gICAgLy8gdG8gYXZvaWQgZ2VuZXJhdGluZyBzdGF0ZW1lbnRzIGZvciBET00gZWxlbWVudHMgdGhhdCBhcmUgbmV2ZXIgcmVmZXJlbmNlZC5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgLy8gQWRkIHRoZSBkZWNsYXJhdGlvbiBvZiB0aGUgZWxlbWVudCB1c2luZyBkb2N1bWVudC5jcmVhdGVFbGVtZW50LlxuICAgIGNvbnN0IGluaXRpYWxpemVyID0gdHNDcmVhdGVFbGVtZW50KHRoaXMuZWxlbWVudC5uYW1lKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGluaXRpYWxpemVyLCB0aGlzLmVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuIHx8IHRoaXMuZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0NyZWF0ZVZhcmlhYmxlKGlkLCBpbml0aWFsaXplcikpO1xuICAgIHJldHVybiBpZDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBjcmVhdGVzIGFuIGV4cHJlc3Npb24gZm9yIHBhcnRpY3VsYXIgbGV0LSBgVG1wbEFzdFZhcmlhYmxlYCBvbiBhXG4gKiBgVG1wbEFzdFRlbXBsYXRlYCdzIGNvbnRleHQuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIHZhcmlhYmxlIHZhcmlhYmxlIChsb2wpLlxuICovXG5jbGFzcyBUY2JWYXJpYWJsZU9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSB0ZW1wbGF0ZTogVG1wbEFzdFRlbXBsYXRlLFxuICAgICAgcHJpdmF0ZSB2YXJpYWJsZTogVG1wbEFzdFZhcmlhYmxlKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGdldCBvcHRpb25hbCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBleGVjdXRlKCk6IHRzLklkZW50aWZpZXIge1xuICAgIC8vIExvb2sgZm9yIGEgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhlIHRlbXBsYXRlLlxuICAgIGNvbnN0IGN0eCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLnRlbXBsYXRlKTtcblxuICAgIC8vIEFsbG9jYXRlIGFuIGlkZW50aWZpZXIgZm9yIHRoZSBUbXBsQXN0VmFyaWFibGUsIGFuZCBpbml0aWFsaXplIGl0IHRvIGEgcmVhZCBvZiB0aGUgdmFyaWFibGVcbiAgICAvLyBvbiB0aGUgdGVtcGxhdGUgY29udGV4dC5cbiAgICBjb25zdCBpZCA9IHRoaXMudGNiLmFsbG9jYXRlSWQoKTtcbiAgICBjb25zdCBpbml0aWFsaXplciA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKFxuICAgICAgICAvKiBleHByZXNzaW9uICovIGN0eCxcbiAgICAgICAgLyogbmFtZSAqLyB0aGlzLnZhcmlhYmxlLnZhbHVlIHx8ICckaW1wbGljaXQnKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGlkLCB0aGlzLnZhcmlhYmxlLmtleVNwYW4pO1xuXG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUsIGFuZCByZXR1cm4gaXRzIGlkZW50aWZpZXIuXG4gICAgbGV0IHZhcmlhYmxlOiB0cy5WYXJpYWJsZVN0YXRlbWVudDtcbiAgICBpZiAodGhpcy52YXJpYWJsZS52YWx1ZVNwYW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgYWRkUGFyc2VTcGFuSW5mbyhpbml0aWFsaXplciwgdGhpcy52YXJpYWJsZS52YWx1ZVNwYW4pO1xuICAgICAgdmFyaWFibGUgPSB0c0NyZWF0ZVZhcmlhYmxlKGlkLCB3cmFwRm9yVHlwZUNoZWNrZXIoaW5pdGlhbGl6ZXIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyaWFibGUgPSB0c0NyZWF0ZVZhcmlhYmxlKGlkLCBpbml0aWFsaXplcik7XG4gICAgfVxuICAgIGFkZFBhcnNlU3BhbkluZm8odmFyaWFibGUuZGVjbGFyYXRpb25MaXN0LmRlY2xhcmF0aW9uc1swXSwgdGhpcy52YXJpYWJsZS5zb3VyY2VTcGFuKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh2YXJpYWJsZSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGdlbmVyYXRlcyBhIHZhcmlhYmxlIGZvciBhIGBUbXBsQXN0VGVtcGxhdGVgJ3MgY29udGV4dC5cbiAqXG4gKiBFeGVjdXRpbmcgdGhpcyBvcGVyYXRpb24gcmV0dXJucyBhIHJlZmVyZW5jZSB0byB0aGUgdGVtcGxhdGUncyBjb250ZXh0IHZhcmlhYmxlLlxuICovXG5jbGFzcyBUY2JUZW1wbGF0ZUNvbnRleHRPcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgc2NvcGU6IFNjb3BlKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIFRoZSBkZWNsYXJhdGlvbiBvZiB0aGUgY29udGV4dCB2YXJpYWJsZSBpcyBvbmx5IG5lZWRlZCB3aGVuIHRoZSBjb250ZXh0IGlzIGFjdHVhbGx5IHJlZmVyZW5jZWQuXG4gIHJlYWRvbmx5IG9wdGlvbmFsID0gdHJ1ZTtcblxuICBleGVjdXRlKCk6IHRzLklkZW50aWZpZXIge1xuICAgIC8vIEFsbG9jYXRlIGEgdGVtcGxhdGUgY3R4IHZhcmlhYmxlIGFuZCBkZWNsYXJlIGl0IHdpdGggYW4gJ2FueScgdHlwZS4gVGhlIHR5cGUgb2YgdGhpcyB2YXJpYWJsZVxuICAgIC8vIG1heSBiZSBuYXJyb3dlZCBhcyBhIHJlc3VsdCBvZiB0ZW1wbGF0ZSBndWFyZCBjb25kaXRpb25zLlxuICAgIGNvbnN0IGN0eCA9IHRoaXMudGNiLmFsbG9jYXRlSWQoKTtcbiAgICBjb25zdCB0eXBlID0gdHMuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuQW55S2V5d29yZCk7XG4gICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHNEZWNsYXJlVmFyaWFibGUoY3R4LCB0eXBlKSk7XG4gICAgcmV0dXJuIGN0eDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBkZXNjZW5kcyBpbnRvIGEgYFRtcGxBc3RUZW1wbGF0ZWAncyBjaGlsZHJlbiBhbmQgZ2VuZXJhdGVzIHR5cGUtY2hlY2tpbmcgY29kZSBmb3JcbiAqIHRoZW0uXG4gKlxuICogVGhpcyBvcGVyYXRpb24gd3JhcHMgdGhlIGNoaWxkcmVuJ3MgdHlwZS1jaGVja2luZyBjb2RlIGluIGFuIGBpZmAgYmxvY2ssIHdoaWNoIG1heSBpbmNsdWRlIG9uZVxuICogb3IgbW9yZSB0eXBlIGd1YXJkIGNvbmRpdGlvbnMgdGhhdCBuYXJyb3cgdHlwZXMgd2l0aGluIHRoZSB0ZW1wbGF0ZSBib2R5LlxuICovXG5jbGFzcyBUY2JUZW1wbGF0ZUJvZHlPcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgc2NvcGU6IFNjb3BlLCBwcml2YXRlIHRlbXBsYXRlOiBUbXBsQXN0VGVtcGxhdGUpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogbnVsbCB7XG4gICAgLy8gQW4gYGlmYCB3aWxsIGJlIGNvbnN0cnVjdGVkLCB3aXRoaW4gd2hpY2ggdGhlIHRlbXBsYXRlJ3MgY2hpbGRyZW4gd2lsbCBiZSB0eXBlIGNoZWNrZWQuIFRoZVxuICAgIC8vIGBpZmAgaXMgdXNlZCBmb3IgdHdvIHJlYXNvbnM6IGl0IGNyZWF0ZXMgYSBuZXcgc3ludGFjdGljIHNjb3BlLCBpc29sYXRpbmcgdmFyaWFibGVzIGRlY2xhcmVkXG4gICAgLy8gaW4gdGhlIHRlbXBsYXRlJ3MgVENCIGZyb20gdGhlIG91dGVyIGNvbnRleHQsIGFuZCBpdCBhbGxvd3MgYW55IGRpcmVjdGl2ZXMgb24gdGhlIHRlbXBsYXRlc1xuICAgIC8vIHRvIHBlcmZvcm0gdHlwZSBuYXJyb3dpbmcgb2YgZWl0aGVyIGV4cHJlc3Npb25zIG9yIHRoZSB0ZW1wbGF0ZSdzIGNvbnRleHQuXG4gICAgLy9cbiAgICAvLyBUaGUgZ3VhcmQgaXMgdGhlIGBpZmAgYmxvY2sncyBjb25kaXRpb24uIEl0J3MgdXN1YWxseSBzZXQgdG8gYHRydWVgIGJ1dCBkaXJlY3RpdmVzIHRoYXQgZXhpc3RcbiAgICAvLyBvbiB0aGUgdGVtcGxhdGUgY2FuIHRyaWdnZXIgZXh0cmEgZ3VhcmQgZXhwcmVzc2lvbnMgdGhhdCBzZXJ2ZSB0byBuYXJyb3cgdHlwZXMgd2l0aGluIHRoZVxuICAgIC8vIGBpZmAuIGBndWFyZGAgaXMgY2FsY3VsYXRlZCBieSBzdGFydGluZyB3aXRoIGB0cnVlYCBhbmQgYWRkaW5nIG90aGVyIGNvbmRpdGlvbnMgYXMgbmVlZGVkLlxuICAgIC8vIENvbGxlY3QgdGhlc2UgaW50byBgZ3VhcmRzYCBieSBwcm9jZXNzaW5nIHRoZSBkaXJlY3RpdmVzLlxuICAgIGNvbnN0IGRpcmVjdGl2ZUd1YXJkczogdHMuRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBjb25zdCBkaXJlY3RpdmVzID0gdGhpcy50Y2IuYm91bmRUYXJnZXQuZ2V0RGlyZWN0aXZlc09mTm9kZSh0aGlzLnRlbXBsYXRlKTtcbiAgICBpZiAoZGlyZWN0aXZlcyAhPT0gbnVsbCkge1xuICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgICBjb25zdCBkaXJJbnN0SWQgPSB0aGlzLnNjb3BlLnJlc29sdmUodGhpcy50ZW1wbGF0ZSwgZGlyKTtcbiAgICAgICAgY29uc3QgZGlySWQgPVxuICAgICAgICAgICAgdGhpcy50Y2IuZW52LnJlZmVyZW5jZShkaXIucmVmIGFzIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+Pik7XG5cbiAgICAgICAgLy8gVGhlcmUgYXJlIHR3byBraW5kcyBvZiBndWFyZHMuIFRlbXBsYXRlIGd1YXJkcyAobmdUZW1wbGF0ZUd1YXJkcykgYWxsb3cgdHlwZSBuYXJyb3dpbmcgb2ZcbiAgICAgICAgLy8gdGhlIGV4cHJlc3Npb24gcGFzc2VkIHRvIGFuIEBJbnB1dCBvZiB0aGUgZGlyZWN0aXZlLiBTY2FuIHRoZSBkaXJlY3RpdmUgdG8gc2VlIGlmIGl0IGhhc1xuICAgICAgICAvLyBhbnkgdGVtcGxhdGUgZ3VhcmRzLCBhbmQgZ2VuZXJhdGUgdGhlbSBpZiBuZWVkZWQuXG4gICAgICAgIGRpci5uZ1RlbXBsYXRlR3VhcmRzLmZvckVhY2goZ3VhcmQgPT4ge1xuICAgICAgICAgIC8vIEZvciBlYWNoIHRlbXBsYXRlIGd1YXJkIGZ1bmN0aW9uIG9uIHRoZSBkaXJlY3RpdmUsIGxvb2sgZm9yIGEgYmluZGluZyB0byB0aGF0IGlucHV0LlxuICAgICAgICAgIGNvbnN0IGJvdW5kSW5wdXQgPSB0aGlzLnRlbXBsYXRlLmlucHV0cy5maW5kKGkgPT4gaS5uYW1lID09PSBndWFyZC5pbnB1dE5hbWUpIHx8XG4gICAgICAgICAgICAgIHRoaXMudGVtcGxhdGUudGVtcGxhdGVBdHRycy5maW5kKFxuICAgICAgICAgICAgICAgICAgKGk6IFRtcGxBc3RUZXh0QXR0cmlidXRlfFRtcGxBc3RCb3VuZEF0dHJpYnV0ZSk6IGkgaXMgVG1wbEFzdEJvdW5kQXR0cmlidXRlID0+XG4gICAgICAgICAgICAgICAgICAgICAgaSBpbnN0YW5jZW9mIFRtcGxBc3RCb3VuZEF0dHJpYnV0ZSAmJiBpLm5hbWUgPT09IGd1YXJkLmlucHV0TmFtZSk7XG4gICAgICAgICAgaWYgKGJvdW5kSW5wdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gSWYgdGhlcmUgaXMgc3VjaCBhIGJpbmRpbmcsIGdlbmVyYXRlIGFuIGV4cHJlc3Npb24gZm9yIGl0LlxuICAgICAgICAgICAgY29uc3QgZXhwciA9IHRjYkV4cHJlc3Npb24oYm91bmRJbnB1dC52YWx1ZSwgdGhpcy50Y2IsIHRoaXMuc2NvcGUpO1xuXG4gICAgICAgICAgICAvLyBUaGUgZXhwcmVzc2lvbiBoYXMgYWxyZWFkeSBiZWVuIGNoZWNrZWQgaW4gdGhlIHR5cGUgY29uc3RydWN0b3IgaW52b2NhdGlvbiwgc29cbiAgICAgICAgICAgIC8vIGl0IHNob3VsZCBiZSBpZ25vcmVkIHdoZW4gdXNlZCB3aXRoaW4gYSB0ZW1wbGF0ZSBndWFyZC5cbiAgICAgICAgICAgIG1hcmtJZ25vcmVEaWFnbm9zdGljcyhleHByKTtcblxuICAgICAgICAgICAgaWYgKGd1YXJkLnR5cGUgPT09ICdiaW5kaW5nJykge1xuICAgICAgICAgICAgICAvLyBVc2UgdGhlIGJpbmRpbmcgZXhwcmVzc2lvbiBpdHNlbGYgYXMgZ3VhcmQuXG4gICAgICAgICAgICAgIGRpcmVjdGl2ZUd1YXJkcy5wdXNoKGV4cHIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gQ2FsbCB0aGUgZ3VhcmQgZnVuY3Rpb24gb24gdGhlIGRpcmVjdGl2ZSB3aXRoIHRoZSBkaXJlY3RpdmUgaW5zdGFuY2UgYW5kIHRoYXRcbiAgICAgICAgICAgICAgLy8gZXhwcmVzc2lvbi5cbiAgICAgICAgICAgICAgY29uc3QgZ3VhcmRJbnZva2UgPSB0c0NhbGxNZXRob2QoZGlySWQsIGBuZ1RlbXBsYXRlR3VhcmRfJHtndWFyZC5pbnB1dE5hbWV9YCwgW1xuICAgICAgICAgICAgICAgIGRpckluc3RJZCxcbiAgICAgICAgICAgICAgICBleHByLFxuICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgYWRkUGFyc2VTcGFuSW5mbyhndWFyZEludm9rZSwgYm91bmRJbnB1dC52YWx1ZS5zb3VyY2VTcGFuKTtcbiAgICAgICAgICAgICAgZGlyZWN0aXZlR3VhcmRzLnB1c2goZ3VhcmRJbnZva2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVGhlIHNlY29uZCBraW5kIG9mIGd1YXJkIGlzIGEgdGVtcGxhdGUgY29udGV4dCBndWFyZC4gVGhpcyBndWFyZCBuYXJyb3dzIHRoZSB0ZW1wbGF0ZVxuICAgICAgICAvLyByZW5kZXJpbmcgY29udGV4dCB2YXJpYWJsZSBgY3R4YC5cbiAgICAgICAgaWYgKGRpci5oYXNOZ1RlbXBsYXRlQ29udGV4dEd1YXJkKSB7XG4gICAgICAgICAgaWYgKHRoaXMudGNiLmVudi5jb25maWcuYXBwbHlUZW1wbGF0ZUNvbnRleHRHdWFyZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLnRlbXBsYXRlKTtcbiAgICAgICAgICAgIGNvbnN0IGd1YXJkSW52b2tlID0gdHNDYWxsTWV0aG9kKGRpcklkLCAnbmdUZW1wbGF0ZUNvbnRleHRHdWFyZCcsIFtkaXJJbnN0SWQsIGN0eF0pO1xuICAgICAgICAgICAgYWRkUGFyc2VTcGFuSW5mbyhndWFyZEludm9rZSwgdGhpcy50ZW1wbGF0ZS5zb3VyY2VTcGFuKTtcbiAgICAgICAgICAgIGRpcmVjdGl2ZUd1YXJkcy5wdXNoKGd1YXJkSW52b2tlKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgICB0aGlzLnRlbXBsYXRlLnZhcmlhYmxlcy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgICAgIHRoaXMudGNiLmVudi5jb25maWcuc3VnZ2VzdGlvbnNGb3JTdWJvcHRpbWFsVHlwZUluZmVyZW5jZSkge1xuICAgICAgICAgICAgLy8gVGhlIGNvbXBpbGVyIGNvdWxkIGhhdmUgaW5mZXJyZWQgYSBiZXR0ZXIgdHlwZSBmb3IgdGhlIHZhcmlhYmxlcyBpbiB0aGlzIHRlbXBsYXRlLFxuICAgICAgICAgICAgLy8gYnV0IHdhcyBwcmV2ZW50ZWQgZnJvbSBkb2luZyBzbyBieSB0aGUgdHlwZS1jaGVja2luZyBjb25maWd1cmF0aW9uLiBJc3N1ZSBhIHdhcm5pbmdcbiAgICAgICAgICAgIC8vIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aGlzLnRjYi5vb2JSZWNvcmRlci5zdWJvcHRpbWFsVHlwZUluZmVyZW5jZSh0aGlzLnRjYi5pZCwgdGhpcy50ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEJ5IGRlZmF1bHQgdGhlIGd1YXJkIGlzIHNpbXBseSBgdHJ1ZWAuXG4gICAgbGV0IGd1YXJkOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gICAgLy8gSWYgdGhlcmUgYXJlIGFueSBndWFyZHMgZnJvbSBkaXJlY3RpdmVzLCB1c2UgdGhlbSBpbnN0ZWFkLlxuICAgIGlmIChkaXJlY3RpdmVHdWFyZHMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gUG9wIHRoZSBmaXJzdCB2YWx1ZSBhbmQgdXNlIGl0IGFzIHRoZSBpbml0aWFsaXplciB0byByZWR1Y2UoKS4gVGhpcyB3YXksIGEgc2luZ2xlIGd1YXJkXG4gICAgICAvLyB3aWxsIGJlIHVzZWQgb24gaXRzIG93biwgYnV0IHR3byBvciBtb3JlIHdpbGwgYmUgY29tYmluZWQgaW50byBiaW5hcnkgQU5EIGV4cHJlc3Npb25zLlxuICAgICAgZ3VhcmQgPSBkaXJlY3RpdmVHdWFyZHMucmVkdWNlKFxuICAgICAgICAgIChleHByLCBkaXJHdWFyZCkgPT5cbiAgICAgICAgICAgICAgdHMuY3JlYXRlQmluYXJ5KGV4cHIsIHRzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW4sIGRpckd1YXJkKSxcbiAgICAgICAgICBkaXJlY3RpdmVHdWFyZHMucG9wKCkhKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgYSBuZXcgU2NvcGUgZm9yIHRoZSB0ZW1wbGF0ZS4gVGhpcyBjb25zdHJ1Y3RzIHRoZSBsaXN0IG9mIG9wZXJhdGlvbnMgZm9yIHRoZSB0ZW1wbGF0ZVxuICAgIC8vIGNoaWxkcmVuLCBhcyB3ZWxsIGFzIHRyYWNrcyBiaW5kaW5ncyB3aXRoaW4gdGhlIHRlbXBsYXRlLlxuICAgIGNvbnN0IHRtcGxTY29wZSA9IFNjb3BlLmZvck5vZGVzKHRoaXMudGNiLCB0aGlzLnNjb3BlLCB0aGlzLnRlbXBsYXRlLCBndWFyZCk7XG5cbiAgICAvLyBSZW5kZXIgdGhlIHRlbXBsYXRlJ3MgYFNjb3BlYCBpbnRvIGl0cyBzdGF0ZW1lbnRzLlxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSB0bXBsU2NvcGUucmVuZGVyKCk7XG4gICAgaWYgKHN0YXRlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBBcyBhbiBvcHRpbWl6YXRpb24sIGRvbid0IGdlbmVyYXRlIHRoZSBzY29wZSdzIGJsb2NrIGlmIGl0IGhhcyBubyBzdGF0ZW1lbnRzLiBUaGlzIGlzXG4gICAgICAvLyBiZW5lZmljaWFsIGZvciB0ZW1wbGF0ZXMgdGhhdCBjb250YWluIGZvciBleGFtcGxlIGA8c3BhbiAqbmdJZj1cImZpcnN0XCI+PC9zcGFuPmAsIGluIHdoaWNoXG4gICAgICAvLyBjYXNlIHRoZXJlJ3Mgbm8gbmVlZCB0byByZW5kZXIgdGhlIGBOZ0lmYCBndWFyZCBleHByZXNzaW9uLiBUaGlzIHNlZW1zIGxpa2UgYSBtaW5vclxuICAgICAgLy8gaW1wcm92ZW1lbnQsIGhvd2V2ZXIgaXQgcmVkdWNlcyB0aGUgbnVtYmVyIG9mIGZsb3ctbm9kZSBhbnRlY2VkZW50cyB0aGF0IFR5cGVTY3JpcHQgbmVlZHNcbiAgICAgIC8vIHRvIGtlZXAgaW50byBhY2NvdW50IGZvciBzdWNoIGNhc2VzLCByZXN1bHRpbmcgaW4gYW4gb3ZlcmFsbCByZWR1Y3Rpb24gb2ZcbiAgICAgIC8vIHR5cGUtY2hlY2tpbmcgdGltZS5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCB0bXBsQmxvY2s6IHRzLlN0YXRlbWVudCA9IHRzLmNyZWF0ZUJsb2NrKHN0YXRlbWVudHMpO1xuICAgIGlmIChndWFyZCAhPT0gbnVsbCkge1xuICAgICAgLy8gVGhlIHNjb3BlIGhhcyBhIGd1YXJkIHRoYXQgbmVlZHMgdG8gYmUgYXBwbGllZCwgc28gd3JhcCB0aGUgdGVtcGxhdGUgYmxvY2sgaW50byBhbiBgaWZgXG4gICAgICAvLyBzdGF0ZW1lbnQgY29udGFpbmluZyB0aGUgZ3VhcmQgZXhwcmVzc2lvbi5cbiAgICAgIHRtcGxCbG9jayA9IHRzLmNyZWF0ZUlmKC8qIGV4cHJlc3Npb24gKi8gZ3VhcmQsIC8qIHRoZW5TdGF0ZW1lbnQgKi8gdG1wbEJsb2NrKTtcbiAgICB9XG4gICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodG1wbEJsb2NrKTtcblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIHJlbmRlcnMgYSB0ZXh0IGJpbmRpbmcgKGludGVycG9sYXRpb24pIGludG8gdGhlIFRDQi5cbiAqXG4gKiBFeGVjdXRpbmcgdGhpcyBvcGVyYXRpb24gcmV0dXJucyBub3RoaW5nLlxuICovXG5jbGFzcyBUY2JUZXh0SW50ZXJwb2xhdGlvbk9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBzY29wZTogU2NvcGUsIHByaXZhdGUgYmluZGluZzogVG1wbEFzdEJvdW5kVGV4dCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiBudWxsIHtcbiAgICBjb25zdCBleHByID0gdGNiRXhwcmVzc2lvbih0aGlzLmJpbmRpbmcudmFsdWUsIHRoaXMudGNiLCB0aGlzLnNjb3BlKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGV4cHIpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBjb25zdHJ1Y3RzIGFuIGluc3RhbmNlIG9mIGEgZGlyZWN0aXZlLiBGb3IgZ2VuZXJpYyBkaXJlY3RpdmVzLCBnZW5lcmljXG4gKiBwYXJhbWV0ZXJzIGFyZSBzZXQgdG8gYGFueWAgdHlwZS5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVGNiRGlyZWN0aXZlVHlwZU9wQmFzZSBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcm90ZWN0ZWQgdGNiOiBDb250ZXh0LCBwcm90ZWN0ZWQgc2NvcGU6IFNjb3BlLFxuICAgICAgcHJvdGVjdGVkIG5vZGU6IFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0RWxlbWVudCwgcHJvdGVjdGVkIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIC8vIFRoZSBzdGF0ZW1lbnQgZ2VuZXJhdGVkIGJ5IHRoaXMgb3BlcmF0aW9uIGlzIG9ubHkgdXNlZCB0byBkZWNsYXJlIHRoZSBkaXJlY3RpdmUncyB0eXBlIGFuZFxuICAgIC8vIHdvbid0IHJlcG9ydCBkaWFnbm9zdGljcyBieSBpdHNlbGYsIHNvIHRoZSBvcGVyYXRpb24gaXMgbWFya2VkIGFzIG9wdGlvbmFsIHRvIGF2b2lkXG4gICAgLy8gZ2VuZXJhdGluZyBkZWNsYXJhdGlvbnMgZm9yIGRpcmVjdGl2ZXMgdGhhdCBkb24ndCBoYXZlIGFueSBpbnB1dHMvb3V0cHV0cy5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgZGlyUmVmID0gdGhpcy5kaXIucmVmIGFzIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+PjtcblxuICAgIGNvbnN0IHJhd1R5cGUgPSB0aGlzLnRjYi5lbnYucmVmZXJlbmNlVHlwZSh0aGlzLmRpci5yZWYpO1xuXG4gICAgbGV0IHR5cGU6IHRzLlR5cGVOb2RlO1xuICAgIGlmICh0aGlzLmRpci5pc0dlbmVyaWMgPT09IGZhbHNlIHx8IGRpclJlZi5ub2RlLnR5cGVQYXJhbWV0ZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHR5cGUgPSByYXdUeXBlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRzLmlzVHlwZVJlZmVyZW5jZU5vZGUocmF3VHlwZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEV4cGVjdGVkIFR5cGVSZWZlcmVuY2VOb2RlIHdoZW4gcmVmZXJlbmNpbmcgdGhlIHR5cGUgZm9yICR7dGhpcy5kaXIucmVmLmRlYnVnTmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHR5cGVBcmd1bWVudHMgPSBkaXJSZWYubm9kZS50eXBlUGFyYW1ldGVycy5tYXAoXG4gICAgICAgICAgKCkgPT4gdHMuZmFjdG9yeS5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5BbnlLZXl3b3JkKSk7XG4gICAgICB0eXBlID0gdHMuZmFjdG9yeS5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZShyYXdUeXBlLnR5cGVOYW1lLCB0eXBlQXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IHRoaXMudGNiLmFsbG9jYXRlSWQoKTtcbiAgICBhZGRFeHByZXNzaW9uSWRlbnRpZmllcih0eXBlLCBFeHByZXNzaW9uSWRlbnRpZmllci5ESVJFQ1RJVkUpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8odHlwZSwgdGhpcy5ub2RlLnN0YXJ0U291cmNlU3BhbiB8fCB0aGlzLm5vZGUuc291cmNlU3Bhbik7XG4gICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHNEZWNsYXJlVmFyaWFibGUoaWQsIHR5cGUpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggY29uc3RydWN0cyBhbiBpbnN0YW5jZSBvZiBhIG5vbi1nZW5lcmljIGRpcmVjdGl2ZSBfd2l0aG91dF8gc2V0dGluZyBhbnkgb2YgaXRzXG4gKiBpbnB1dHMuIElucHV0cyAgYXJlIGxhdGVyIHNldCBpbiB0aGUgYFRjYkRpcmVjdGl2ZUlucHV0c09wYC4gVHlwZSBjaGVja2luZyB3YXMgZm91bmQgdG8gYmVcbiAqIGZhc3RlciB3aGVuIGRvbmUgaW4gdGhpcyB3YXkgYXMgb3Bwb3NlZCB0byBgVGNiRGlyZWN0aXZlQ3Rvck9wYCB3aGljaCBpcyBvbmx5IG5lY2Vzc2FyeSB3aGVuIHRoZVxuICogZGlyZWN0aXZlIGlzIGdlbmVyaWMuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpbnN0YW5jZSB2YXJpYWJsZSB3aXRoIGl0cyBpbmZlcnJlZFxuICogdHlwZS5cbiAqL1xuY2xhc3MgVGNiTm9uR2VuZXJpY0RpcmVjdGl2ZVR5cGVPcCBleHRlbmRzIFRjYkRpcmVjdGl2ZVR5cGVPcEJhc2Uge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGZvciB0aGlzIG9wJ3MgZGlyZWN0aXZlIG9mIHRoZSBhcmd1bWVudCB0eXBlLiBSZXR1cm5zIHRoZSBpZCBvZlxuICAgKiB0aGUgbmV3bHkgY3JlYXRlZCB2YXJpYWJsZS5cbiAgICovXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgZGlyUmVmID0gdGhpcy5kaXIucmVmIGFzIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+PjtcbiAgICBpZiAodGhpcy5kaXIuaXNHZW5lcmljKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbiBFcnJvcjogZXhwZWN0ZWQgJHtkaXJSZWYuZGVidWdOYW1lfSBub3QgdG8gYmUgZ2VuZXJpYy5gKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLmV4ZWN1dGUoKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBjb25zdHJ1Y3RzIGFuIGluc3RhbmNlIG9mIGEgZ2VuZXJpYyBkaXJlY3RpdmUgd2l0aCBpdHMgZ2VuZXJpYyBwYXJhbWV0ZXJzIHNldFxuICogdG8gYGFueWAgdHlwZS4gVGhpcyBvcCBpcyBsaWtlIGBUY2JEaXJlY3RpdmVUeXBlT3BgLCBleGNlcHQgdGhhdCBnZW5lcmljIHBhcmFtZXRlcnMgYXJlIHNldCB0b1xuICogYGFueWAgdHlwZS4gVGhpcyBpcyB1c2VkIGZvciBzaXR1YXRpb25zIHdoZXJlIHdlIHdhbnQgdG8gYXZvaWQgaW5saW5pbmcuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpbnN0YW5jZSB2YXJpYWJsZSB3aXRoIGl0cyBnZW5lcmljXG4gKiB0eXBlIHBhcmFtZXRlcnMgc2V0IHRvIGBhbnlgLlxuICovXG5jbGFzcyBUY2JHZW5lcmljRGlyZWN0aXZlVHlwZVdpdGhBbnlQYXJhbXNPcCBleHRlbmRzIFRjYkRpcmVjdGl2ZVR5cGVPcEJhc2Uge1xuICBleGVjdXRlKCk6IHRzLklkZW50aWZpZXIge1xuICAgIGNvbnN0IGRpclJlZiA9IHRoaXMuZGlyLnJlZiBhcyBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj47XG4gICAgaWYgKGRpclJlZi5ub2RlLnR5cGVQYXJhbWV0ZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uIEVycm9yOiBleHBlY3RlZCB0eXBlUGFyYW1ldGVycyB3aGVuIGNyZWF0aW5nIGEgZGVjbGFyYXRpb24gZm9yICR7XG4gICAgICAgICAgZGlyUmVmLmRlYnVnTmFtZX1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VwZXIuZXhlY3V0ZSgpO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGNyZWF0ZXMgYSB2YXJpYWJsZSBmb3IgYSBsb2NhbCByZWYgaW4gYSB0ZW1wbGF0ZS5cbiAqIFRoZSBpbml0aWFsaXplciBmb3IgdGhlIHZhcmlhYmxlIGlzIHRoZSB2YXJpYWJsZSBleHByZXNzaW9uIGZvciB0aGUgZGlyZWN0aXZlLCB0ZW1wbGF0ZSwgb3JcbiAqIGVsZW1lbnQgdGhlIHJlZiByZWZlcnMgdG8uIFdoZW4gdGhlIHJlZmVyZW5jZSBpcyB1c2VkIGluIHRoZSB0ZW1wbGF0ZSwgdGhvc2UgVENCIHN0YXRlbWVudHMgd2lsbFxuICogYWNjZXNzIHRoaXMgdmFyaWFibGUgYXMgd2VsbC4gRm9yIGV4YW1wbGU6XG4gKiBgYGBcbiAqIHZhciBfdDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAqIHZhciBfdDIgPSBfdDE7XG4gKiBfdDIudmFsdWVcbiAqIGBgYFxuICogVGhpcyBvcGVyYXRpb24gc3VwcG9ydHMgbW9yZSBmbHVlbnQgbG9va3VwcyBmb3IgdGhlIGBUZW1wbGF0ZVR5cGVDaGVja2VyYCB3aGVuIGdldHRpbmcgYSBzeW1ib2xcbiAqIGZvciBhIHJlZmVyZW5jZS4gSW4gbW9zdCBjYXNlcywgdGhpcyBpc24ndCBlc3NlbnRpYWw7IHRoYXQgaXMsIHRoZSBpbmZvcm1hdGlvbiBmb3IgdGhlIHN5bWJvbFxuICogY291bGQgYmUgZ2F0aGVyZWQgd2l0aG91dCB0aGlzIG9wZXJhdGlvbiB1c2luZyB0aGUgYEJvdW5kVGFyZ2V0YC4gSG93ZXZlciwgZm9yIHRoZSBjYXNlIG9mXG4gKiBuZy10ZW1wbGF0ZSByZWZlcmVuY2VzLCB3ZSB3aWxsIG5lZWQgdGhpcyByZWZlcmVuY2UgdmFyaWFibGUgdG8gbm90IG9ubHkgcHJvdmlkZSBhIGxvY2F0aW9uIGluXG4gKiB0aGUgc2hpbSBmaWxlLCBidXQgYWxzbyB0byBuYXJyb3cgdGhlIHZhcmlhYmxlIHRvIHRoZSBjb3JyZWN0IGBUZW1wbGF0ZVJlZjxUPmAgdHlwZSByYXRoZXIgdGhhblxuICogYFRlbXBsYXRlUmVmPGFueT5gICh0aGlzIHdvcmsgaXMgc3RpbGwgVE9ETykuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpbnN0YW5jZSB2YXJpYWJsZSB3aXRoIGl0cyBpbmZlcnJlZFxuICogdHlwZS5cbiAqL1xuY2xhc3MgVGNiUmVmZXJlbmNlT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWFkb25seSB0Y2I6IENvbnRleHQsIHByaXZhdGUgcmVhZG9ubHkgc2NvcGU6IFNjb3BlLFxuICAgICAgcHJpdmF0ZSByZWFkb25seSBub2RlOiBUbXBsQXN0UmVmZXJlbmNlLFxuICAgICAgcHJpdmF0ZSByZWFkb25seSBob3N0OiBUbXBsQXN0RWxlbWVudHxUbXBsQXN0VGVtcGxhdGUsXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IHRhcmdldDogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGF8VG1wbEFzdFRlbXBsYXRlfFRtcGxBc3RFbGVtZW50KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIFRoZSBzdGF0ZW1lbnQgZ2VuZXJhdGVkIGJ5IHRoaXMgb3BlcmF0aW9uIGlzIG9ubHkgdXNlZCB0byBmb3IgdGhlIFR5cGUgQ2hlY2tlclxuICAvLyBzbyBpdCBjYW4gbWFwIGEgcmVmZXJlbmNlIHZhcmlhYmxlIGluIHRoZSB0ZW1wbGF0ZSBkaXJlY3RseSB0byBhIG5vZGUgaW4gdGhlIFRDQi5cbiAgcmVhZG9ubHkgb3B0aW9uYWwgPSB0cnVlO1xuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgbGV0IGluaXRpYWxpemVyID1cbiAgICAgICAgdGhpcy50YXJnZXQgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUgfHwgdGhpcy50YXJnZXQgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCA/XG4gICAgICAgIHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLnRhcmdldCkgOlxuICAgICAgICB0aGlzLnNjb3BlLnJlc29sdmUodGhpcy5ob3N0LCB0aGlzLnRhcmdldCk7XG5cbiAgICAvLyBUaGUgcmVmZXJlbmNlIGlzIGVpdGhlciB0byBhbiBlbGVtZW50LCBhbiA8bmctdGVtcGxhdGU+IG5vZGUsIG9yIHRvIGEgZGlyZWN0aXZlIG9uIGFuXG4gICAgLy8gZWxlbWVudCBvciB0ZW1wbGF0ZS5cbiAgICBpZiAoKHRoaXMudGFyZ2V0IGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQgJiYgIXRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZEb21SZWZlcmVuY2VzKSB8fFxuICAgICAgICAhdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZk5vbkRvbVJlZmVyZW5jZXMpIHtcbiAgICAgIC8vIFJlZmVyZW5jZXMgdG8gRE9NIG5vZGVzIGFyZSBwaW5uZWQgdG8gJ2FueScgd2hlbiBgY2hlY2tUeXBlT2ZEb21SZWZlcmVuY2VzYCBpcyBgZmFsc2VgLlxuICAgICAgLy8gUmVmZXJlbmNlcyB0byBgVGVtcGxhdGVSZWZgcyBhbmQgZGlyZWN0aXZlcyBhcmUgcGlubmVkIHRvICdhbnknIHdoZW5cbiAgICAgIC8vIGBjaGVja1R5cGVPZk5vbkRvbVJlZmVyZW5jZXNgIGlzIGBmYWxzZWAuXG4gICAgICBpbml0aWFsaXplciA9XG4gICAgICAgICAgdHMuY3JlYXRlQXNFeHByZXNzaW9uKGluaXRpYWxpemVyLCB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5BbnlLZXl3b3JkKSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRhcmdldCBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSkge1xuICAgICAgLy8gRGlyZWN0IHJlZmVyZW5jZXMgdG8gYW4gPG5nLXRlbXBsYXRlPiBub2RlIHNpbXBseSByZXF1aXJlIGEgdmFsdWUgb2YgdHlwZVxuICAgICAgLy8gYFRlbXBsYXRlUmVmPGFueT5gLiBUbyBnZXQgdGhpcywgYW4gZXhwcmVzc2lvbiBvZiB0aGUgZm9ybVxuICAgICAgLy8gYChfdDEgYXMgYW55IGFzIFRlbXBsYXRlUmVmPGFueT4pYCBpcyBjb25zdHJ1Y3RlZC5cbiAgICAgIGluaXRpYWxpemVyID1cbiAgICAgICAgICB0cy5jcmVhdGVBc0V4cHJlc3Npb24oaW5pdGlhbGl6ZXIsIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKTtcbiAgICAgIGluaXRpYWxpemVyID0gdHMuY3JlYXRlQXNFeHByZXNzaW9uKFxuICAgICAgICAgIGluaXRpYWxpemVyLFxuICAgICAgICAgIHRoaXMudGNiLmVudi5yZWZlcmVuY2VFeHRlcm5hbFR5cGUoJ0Bhbmd1bGFyL2NvcmUnLCAnVGVtcGxhdGVSZWYnLCBbRFlOQU1JQ19UWVBFXSkpO1xuICAgICAgaW5pdGlhbGl6ZXIgPSB0cy5jcmVhdGVQYXJlbihpbml0aWFsaXplcik7XG4gICAgfVxuICAgIGFkZFBhcnNlU3BhbkluZm8oaW5pdGlhbGl6ZXIsIHRoaXMubm9kZS5zb3VyY2VTcGFuKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGlkLCB0aGlzLm5vZGUua2V5U3Bhbik7XG5cbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0NyZWF0ZVZhcmlhYmxlKGlkLCBpbml0aWFsaXplcikpO1xuICAgIHJldHVybiBpZDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBpcyB1c2VkIHdoZW4gdGhlIHRhcmdldCBvZiBhIHJlZmVyZW5jZSBpcyBtaXNzaW5nLiBUaGlzIG9wZXJhdGlvbiBnZW5lcmF0ZXMgYVxuICogdmFyaWFibGUgb2YgdHlwZSBhbnkgZm9yIHVzYWdlcyBvZiB0aGUgaW52YWxpZCByZWZlcmVuY2UgdG8gcmVzb2x2ZSB0by4gVGhlIGludmFsaWQgcmVmZXJlbmNlXG4gKiBpdHNlbGYgaXMgcmVjb3JkZWQgb3V0LW9mLWJhbmQuXG4gKi9cbmNsYXNzIFRjYkludmFsaWRSZWZlcmVuY2VPcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB0Y2I6IENvbnRleHQsIHByaXZhdGUgcmVhZG9ubHkgc2NvcGU6IFNjb3BlKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIFRoZSBkZWNsYXJhdGlvbiBvZiBhIG1pc3NpbmcgcmVmZXJlbmNlIGlzIG9ubHkgbmVlZGVkIHdoZW4gdGhlIHJlZmVyZW5jZSBpcyByZXNvbHZlZC5cbiAgcmVhZG9ubHkgb3B0aW9uYWwgPSB0cnVlO1xuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHNDcmVhdGVWYXJpYWJsZShpZCwgTlVMTF9BU19BTlkpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggY29uc3RydWN0cyBhbiBpbnN0YW5jZSBvZiBhIGRpcmVjdGl2ZSB3aXRoIHR5cGVzIGluZmVycmVkIGZyb20gaXRzIGlucHV0cy4gVGhlXG4gKiBpbnB1dHMgdGhlbXNlbHZlcyBhcmUgbm90IGNoZWNrZWQgaGVyZTsgY2hlY2tpbmcgb2YgaW5wdXRzIGlzIGFjaGlldmVkIGluIGBUY2JEaXJlY3RpdmVJbnB1dHNPcGAuXG4gKiBBbnkgZXJyb3JzIHJlcG9ydGVkIGluIHRoaXMgc3RhdGVtZW50IGFyZSBpZ25vcmVkLCBhcyB0aGUgdHlwZSBjb25zdHJ1Y3RvciBjYWxsIGlzIG9ubHkgcHJlc2VudFxuICogZm9yIHR5cGUtaW5mZXJlbmNlLlxuICpcbiAqIFdoZW4gYSBEaXJlY3RpdmUgaXMgZ2VuZXJpYywgaXQgaXMgcmVxdWlyZWQgdGhhdCB0aGUgVENCIGdlbmVyYXRlcyB0aGUgaW5zdGFuY2UgdXNpbmcgdGhpcyBtZXRob2RcbiAqIGluIG9yZGVyIHRvIGluZmVyIHRoZSB0eXBlIGluZm9ybWF0aW9uIGNvcnJlY3RseS5cbiAqXG4gKiBFeGVjdXRpbmcgdGhpcyBvcGVyYXRpb24gcmV0dXJucyBhIHJlZmVyZW5jZSB0byB0aGUgZGlyZWN0aXZlIGluc3RhbmNlIHZhcmlhYmxlIHdpdGggaXRzIGluZmVycmVkXG4gKiB0eXBlLlxuICovXG5jbGFzcyBUY2JEaXJlY3RpdmVDdG9yT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgc2NvcGU6IFNjb3BlLCBwcml2YXRlIG5vZGU6IFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0RWxlbWVudCxcbiAgICAgIHByaXZhdGUgZGlyOiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgLy8gVGhlIHN0YXRlbWVudCBnZW5lcmF0ZWQgYnkgdGhpcyBvcGVyYXRpb24gaXMgb25seSB1c2VkIHRvIGluZmVyIHRoZSBkaXJlY3RpdmUncyB0eXBlIGFuZFxuICAgIC8vIHdvbid0IHJlcG9ydCBkaWFnbm9zdGljcyBieSBpdHNlbGYsIHNvIHRoZSBvcGVyYXRpb24gaXMgbWFya2VkIGFzIG9wdGlvbmFsLlxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiB0cy5JZGVudGlmaWVyIHtcbiAgICBjb25zdCBpZCA9IHRoaXMudGNiLmFsbG9jYXRlSWQoKTtcbiAgICBhZGRFeHByZXNzaW9uSWRlbnRpZmllcihpZCwgRXhwcmVzc2lvbklkZW50aWZpZXIuRElSRUNUSVZFKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGlkLCB0aGlzLm5vZGUuc3RhcnRTb3VyY2VTcGFuIHx8IHRoaXMubm9kZS5zb3VyY2VTcGFuKTtcblxuICAgIGNvbnN0IGdlbmVyaWNJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgVGNiRGlyZWN0aXZlSW5wdXQ+KCk7XG5cbiAgICBjb25zdCBpbnB1dHMgPSBnZXRCb3VuZElucHV0cyh0aGlzLmRpciwgdGhpcy5ub2RlLCB0aGlzLnRjYik7XG4gICAgZm9yIChjb25zdCBpbnB1dCBvZiBpbnB1dHMpIHtcbiAgICAgIC8vIFNraXAgdGV4dCBhdHRyaWJ1dGVzIGlmIGNvbmZpZ3VyZWQgdG8gZG8gc28uXG4gICAgICBpZiAoIXRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZBdHRyaWJ1dGVzICYmXG4gICAgICAgICAgaW5wdXQuYXR0cmlidXRlIGluc3RhbmNlb2YgVG1wbEFzdFRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGZpZWxkTmFtZSBvZiBpbnB1dC5maWVsZE5hbWVzKSB7XG4gICAgICAgIC8vIFNraXAgdGhlIGZpZWxkIGlmIGFuIGF0dHJpYnV0ZSBoYXMgYWxyZWFkeSBiZWVuIGJvdW5kIHRvIGl0OyB3ZSBjYW4ndCBoYXZlIGEgZHVwbGljYXRlXG4gICAgICAgIC8vIGtleSBpbiB0aGUgdHlwZSBjb25zdHJ1Y3RvciBjYWxsLlxuICAgICAgICBpZiAoZ2VuZXJpY0lucHV0cy5oYXMoZmllbGROYW1lKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHRyYW5zbGF0ZUlucHV0KGlucHV0LmF0dHJpYnV0ZSwgdGhpcy50Y2IsIHRoaXMuc2NvcGUpO1xuICAgICAgICBnZW5lcmljSW5wdXRzLnNldChmaWVsZE5hbWUsIHtcbiAgICAgICAgICB0eXBlOiAnYmluZGluZycsXG4gICAgICAgICAgZmllbGQ6IGZpZWxkTmFtZSxcbiAgICAgICAgICBleHByZXNzaW9uLFxuICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LmF0dHJpYnV0ZS5zb3VyY2VTcGFuXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFkZCB1bnNldCBkaXJlY3RpdmUgaW5wdXRzIGZvciBlYWNoIG9mIHRoZSByZW1haW5pbmcgdW5zZXQgZmllbGRzLlxuICAgIGZvciAoY29uc3QgW2ZpZWxkTmFtZV0gb2YgdGhpcy5kaXIuaW5wdXRzKSB7XG4gICAgICBpZiAoIWdlbmVyaWNJbnB1dHMuaGFzKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgZ2VuZXJpY0lucHV0cy5zZXQoZmllbGROYW1lLCB7dHlwZTogJ3Vuc2V0JywgZmllbGQ6IGZpZWxkTmFtZX0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENhbGwgdGhlIHR5cGUgY29uc3RydWN0b3Igb2YgdGhlIGRpcmVjdGl2ZSB0byBpbmZlciBhIHR5cGUsIGFuZCBhc3NpZ24gdGhlIGRpcmVjdGl2ZVxuICAgIC8vIGluc3RhbmNlLlxuICAgIGNvbnN0IHR5cGVDdG9yID0gdGNiQ2FsbFR5cGVDdG9yKHRoaXMuZGlyLCB0aGlzLnRjYiwgQXJyYXkuZnJvbShnZW5lcmljSW5wdXRzLnZhbHVlcygpKSk7XG4gICAgbWFya0lnbm9yZURpYWdub3N0aWNzKHR5cGVDdG9yKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0NyZWF0ZVZhcmlhYmxlKGlkLCB0eXBlQ3RvcikpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIGNpcmN1bGFyRmFsbGJhY2soKTogVGNiT3Age1xuICAgIHJldHVybiBuZXcgVGNiRGlyZWN0aXZlQ3RvckNpcmN1bGFyRmFsbGJhY2tPcCh0aGlzLnRjYiwgdGhpcy5zY29wZSwgdGhpcy5ub2RlLCB0aGlzLmRpcik7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggZ2VuZXJhdGVzIGNvZGUgdG8gY2hlY2sgaW5wdXQgYmluZGluZ3Mgb24gYW4gZWxlbWVudCB0aGF0IGNvcnJlc3BvbmQgd2l0aCB0aGVcbiAqIG1lbWJlcnMgb2YgYSBkaXJlY3RpdmUuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgbm90aGluZy5cbiAqL1xuY2xhc3MgVGNiRGlyZWN0aXZlSW5wdXRzT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgc2NvcGU6IFNjb3BlLCBwcml2YXRlIG5vZGU6IFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0RWxlbWVudCxcbiAgICAgIHByaXZhdGUgZGlyOiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiBudWxsIHtcbiAgICBsZXQgZGlySWQ6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgICAvLyBUT0RPKGpvb3N0KTogcmVwb3J0IGR1cGxpY2F0ZSBwcm9wZXJ0aWVzXG5cbiAgICBjb25zdCBpbnB1dHMgPSBnZXRCb3VuZElucHV0cyh0aGlzLmRpciwgdGhpcy5ub2RlLCB0aGlzLnRjYik7XG4gICAgZm9yIChjb25zdCBpbnB1dCBvZiBpbnB1dHMpIHtcbiAgICAgIC8vIEZvciBib3VuZCBpbnB1dHMsIHRoZSBwcm9wZXJ0eSBpcyBhc3NpZ25lZCB0aGUgYmluZGluZyBleHByZXNzaW9uLlxuICAgICAgbGV0IGV4cHIgPSB0cmFuc2xhdGVJbnB1dChpbnB1dC5hdHRyaWJ1dGUsIHRoaXMudGNiLCB0aGlzLnNjb3BlKTtcbiAgICAgIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZklucHV0QmluZGluZ3MpIHtcbiAgICAgICAgLy8gSWYgY2hlY2tpbmcgdGhlIHR5cGUgb2YgYmluZGluZ3MgaXMgZGlzYWJsZWQsIGNhc3QgdGhlIHJlc3VsdGluZyBleHByZXNzaW9uIHRvICdhbnknXG4gICAgICAgIC8vIGJlZm9yZSB0aGUgYXNzaWdubWVudC5cbiAgICAgICAgZXhwciA9IHRzQ2FzdFRvQW55KGV4cHIpO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5zdHJpY3ROdWxsSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBzdHJpY3QgbnVsbCBjaGVja3MgYXJlIGRpc2FibGVkLCBlcmFzZSBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIGZyb20gdGhlIHR5cGUgYnlcbiAgICAgICAgLy8gd3JhcHBpbmcgdGhlIGV4cHJlc3Npb24gaW4gYSBub24tbnVsbCBhc3NlcnRpb24uXG4gICAgICAgIGV4cHIgPSB0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihleHByKTtcbiAgICAgIH1cblxuICAgICAgbGV0IGFzc2lnbm1lbnQ6IHRzLkV4cHJlc3Npb24gPSB3cmFwRm9yRGlhZ25vc3RpY3MoZXhwcik7XG5cbiAgICAgIGZvciAoY29uc3QgZmllbGROYW1lIG9mIGlucHV0LmZpZWxkTmFtZXMpIHtcbiAgICAgICAgbGV0IHRhcmdldDogdHMuTGVmdEhhbmRTaWRlRXhwcmVzc2lvbjtcbiAgICAgICAgaWYgKHRoaXMuZGlyLmNvZXJjZWRJbnB1dEZpZWxkcy5oYXMoZmllbGROYW1lKSkge1xuICAgICAgICAgIC8vIFRoZSBpbnB1dCBoYXMgYSBjb2VyY2lvbiBkZWNsYXJhdGlvbiB3aGljaCBzaG91bGQgYmUgdXNlZCBpbnN0ZWFkIG9mIGFzc2lnbmluZyB0aGVcbiAgICAgICAgICAvLyBleHByZXNzaW9uIGludG8gdGhlIGlucHV0IGZpZWxkIGRpcmVjdGx5LiBUbyBhY2hpZXZlIHRoaXMsIGEgdmFyaWFibGUgaXMgZGVjbGFyZWRcbiAgICAgICAgICAvLyB3aXRoIGEgdHlwZSBvZiBgdHlwZW9mIERpcmVjdGl2ZS5uZ0FjY2VwdElucHV0VHlwZV9maWVsZE5hbWVgIHdoaWNoIGlzIHRoZW4gdXNlZCBhc1xuICAgICAgICAgIC8vIHRhcmdldCBvZiB0aGUgYXNzaWdubWVudC5cbiAgICAgICAgICBjb25zdCBkaXJUeXBlUmVmID0gdGhpcy50Y2IuZW52LnJlZmVyZW5jZVR5cGUodGhpcy5kaXIucmVmKTtcbiAgICAgICAgICBpZiAoIXRzLmlzVHlwZVJlZmVyZW5jZU5vZGUoZGlyVHlwZVJlZikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRXhwZWN0ZWQgVHlwZVJlZmVyZW5jZU5vZGUgZnJvbSByZWZlcmVuY2UgdG8gJHt0aGlzLmRpci5yZWYuZGVidWdOYW1lfWApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy50Y2IuYWxsb2NhdGVJZCgpO1xuICAgICAgICAgIGNvbnN0IHR5cGUgPSB0c0NyZWF0ZVR5cGVRdWVyeUZvckNvZXJjZWRJbnB1dChkaXJUeXBlUmVmLnR5cGVOYW1lLCBmaWVsZE5hbWUpO1xuICAgICAgICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzRGVjbGFyZVZhcmlhYmxlKGlkLCB0eXBlKSk7XG5cbiAgICAgICAgICB0YXJnZXQgPSBpZDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmRpci51bmRlY2xhcmVkSW5wdXRGaWVsZHMuaGFzKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgICAvLyBJZiBubyBjb2VyY2lvbiBkZWNsYXJhdGlvbiBpcyBwcmVzZW50IG5vciBpcyB0aGUgZmllbGQgZGVjbGFyZWQgKGkuZS4gdGhlIGlucHV0IGlzXG4gICAgICAgICAgLy8gZGVjbGFyZWQgaW4gYSBgQERpcmVjdGl2ZWAgb3IgYEBDb21wb25lbnRgIGRlY29yYXRvcidzIGBpbnB1dHNgIHByb3BlcnR5KSB0aGVyZSBpcyBub1xuICAgICAgICAgIC8vIGFzc2lnbm1lbnQgdGFyZ2V0IGF2YWlsYWJsZSwgc28gdGhpcyBmaWVsZCBpcyBza2lwcGVkLlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgIXRoaXMudGNiLmVudi5jb25maWcuaG9ub3JBY2Nlc3NNb2RpZmllcnNGb3JJbnB1dEJpbmRpbmdzICYmXG4gICAgICAgICAgICB0aGlzLmRpci5yZXN0cmljdGVkSW5wdXRGaWVsZHMuaGFzKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgICAvLyBJZiBzdHJpY3QgY2hlY2tpbmcgb2YgYWNjZXNzIG1vZGlmaWVycyBpcyBkaXNhYmxlZCBhbmQgdGhlIGZpZWxkIGlzIHJlc3RyaWN0ZWRcbiAgICAgICAgICAvLyAoaS5lLiBwcml2YXRlL3Byb3RlY3RlZC9yZWFkb25seSksIGdlbmVyYXRlIGFuIGFzc2lnbm1lbnQgaW50byBhIHRlbXBvcmFyeSB2YXJpYWJsZVxuICAgICAgICAgIC8vIHRoYXQgaGFzIHRoZSB0eXBlIG9mIHRoZSBmaWVsZC4gVGhpcyBhY2hpZXZlcyB0eXBlLWNoZWNraW5nIGJ1dCBjaXJjdW12ZW50cyB0aGUgYWNjZXNzXG4gICAgICAgICAgLy8gbW9kaWZpZXJzLlxuICAgICAgICAgIGlmIChkaXJJZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZGlySWQgPSB0aGlzLnNjb3BlLnJlc29sdmUodGhpcy5ub2RlLCB0aGlzLmRpcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgICAgICAgY29uc3QgZGlyVHlwZVJlZiA9IHRoaXMudGNiLmVudi5yZWZlcmVuY2VUeXBlKHRoaXMuZGlyLnJlZik7XG4gICAgICAgICAgaWYgKCF0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKGRpclR5cGVSZWYpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEV4cGVjdGVkIFR5cGVSZWZlcmVuY2VOb2RlIGZyb20gcmVmZXJlbmNlIHRvICR7dGhpcy5kaXIucmVmLmRlYnVnTmFtZX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdHlwZSA9IHRzLmNyZWF0ZUluZGV4ZWRBY2Nlc3NUeXBlTm9kZShcbiAgICAgICAgICAgICAgdHMuY3JlYXRlVHlwZVF1ZXJ5Tm9kZShkaXJJZCBhcyB0cy5JZGVudGlmaWVyKSxcbiAgICAgICAgICAgICAgdHMuY3JlYXRlTGl0ZXJhbFR5cGVOb2RlKHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoZmllbGROYW1lKSkpO1xuICAgICAgICAgIGNvbnN0IHRlbXAgPSB0c0RlY2xhcmVWYXJpYWJsZShpZCwgdHlwZSk7XG4gICAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodGVtcCk7XG4gICAgICAgICAgdGFyZ2V0ID0gaWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGRpcklkID09PSBudWxsKSB7XG4gICAgICAgICAgICBkaXJJZCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLm5vZGUsIHRoaXMuZGlyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUbyBnZXQgZXJyb3JzIGFzc2lnbiBkaXJlY3RseSB0byB0aGUgZmllbGRzIG9uIHRoZSBpbnN0YW5jZSwgdXNpbmcgcHJvcGVydHkgYWNjZXNzXG4gICAgICAgICAgLy8gd2hlbiBwb3NzaWJsZS4gU3RyaW5nIGxpdGVyYWwgZmllbGRzIG1heSBub3QgYmUgdmFsaWQgSlMgaWRlbnRpZmllcnMgc28gd2UgdXNlXG4gICAgICAgICAgLy8gbGl0ZXJhbCBlbGVtZW50IGFjY2VzcyBpbnN0ZWFkIGZvciB0aG9zZSBjYXNlcy5cbiAgICAgICAgICB0YXJnZXQgPSB0aGlzLmRpci5zdHJpbmdMaXRlcmFsSW5wdXRGaWVsZHMuaGFzKGZpZWxkTmFtZSkgP1xuICAgICAgICAgICAgICB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKGRpcklkLCB0cy5jcmVhdGVTdHJpbmdMaXRlcmFsKGZpZWxkTmFtZSkpIDpcbiAgICAgICAgICAgICAgdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoZGlySWQsIHRzLmNyZWF0ZUlkZW50aWZpZXIoZmllbGROYW1lKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5wdXQuYXR0cmlidXRlLmtleVNwYW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGFkZFBhcnNlU3BhbkluZm8odGFyZ2V0LCBpbnB1dC5hdHRyaWJ1dGUua2V5U3Bhbik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRmluYWxseSB0aGUgYXNzaWdubWVudCBpcyBleHRlbmRlZCBieSBhc3NpZ25pbmcgaXQgaW50byB0aGUgdGFyZ2V0IGV4cHJlc3Npb24uXG4gICAgICAgIGFzc2lnbm1lbnQgPSB0cy5jcmVhdGVCaW5hcnkodGFyZ2V0LCB0cy5TeW50YXhLaW5kLkVxdWFsc1Rva2VuLCBhc3NpZ25tZW50KTtcbiAgICAgIH1cblxuICAgICAgYWRkUGFyc2VTcGFuSW5mbyhhc3NpZ25tZW50LCBpbnB1dC5hdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gICAgICAvLyBJZ25vcmUgZGlhZ25vc3RpY3MgZm9yIHRleHQgYXR0cmlidXRlcyBpZiBjb25maWd1cmVkIHRvIGRvIHNvLlxuICAgICAgaWYgKCF0aGlzLnRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mQXR0cmlidXRlcyAmJlxuICAgICAgICAgIGlucHV0LmF0dHJpYnV0ZSBpbnN0YW5jZW9mIFRtcGxBc3RUZXh0QXR0cmlidXRlKSB7XG4gICAgICAgIG1hcmtJZ25vcmVEaWFnbm9zdGljcyhhc3NpZ25tZW50KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChhc3NpZ25tZW50KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggaXMgdXNlZCB0byBnZW5lcmF0ZSBhIGZhbGxiYWNrIGV4cHJlc3Npb24gaWYgdGhlIGluZmVyZW5jZSBvZiBhIGRpcmVjdGl2ZSB0eXBlXG4gKiB2aWEgYFRjYkRpcmVjdGl2ZUN0b3JPcGAgcmVxdWlyZXMgYSByZWZlcmVuY2UgdG8gaXRzIG93biB0eXBlLiBUaGlzIGNhbiBoYXBwZW4gdXNpbmcgYSB0ZW1wbGF0ZVxuICogcmVmZXJlbmNlOlxuICpcbiAqIGBgYGh0bWxcbiAqIDxzb21lLWNtcCAjcmVmIFtwcm9wXT1cInJlZi5mb29cIj48L3NvbWUtY21wPlxuICogYGBgXG4gKlxuICogSW4gdGhpcyBjYXNlLCBgVGNiRGlyZWN0aXZlQ3RvckNpcmN1bGFyRmFsbGJhY2tPcGAgd2lsbCBhZGQgYSBzZWNvbmQgaW5mZXJlbmNlIG9mIHRoZSBkaXJlY3RpdmVcbiAqIHR5cGUgdG8gdGhlIHR5cGUtY2hlY2sgYmxvY2ssIHRoaXMgdGltZSBjYWxsaW5nIHRoZSBkaXJlY3RpdmUncyB0eXBlIGNvbnN0cnVjdG9yIHdpdGhvdXQgYW55XG4gKiBpbnB1dCBleHByZXNzaW9ucy4gVGhpcyBpbmZlcnMgdGhlIHdpZGVzdCBwb3NzaWJsZSBzdXBlcnR5cGUgZm9yIHRoZSBkaXJlY3RpdmUsIHdoaWNoIGlzIHVzZWQgdG9cbiAqIHJlc29sdmUgYW55IHJlY3Vyc2l2ZSByZWZlcmVuY2VzIHJlcXVpcmVkIHRvIGluZmVyIHRoZSByZWFsIHR5cGUuXG4gKi9cbmNsYXNzIFRjYkRpcmVjdGl2ZUN0b3JDaXJjdWxhckZhbGxiYWNrT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgc2NvcGU6IFNjb3BlLCBwcml2YXRlIG5vZGU6IFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0RWxlbWVudCxcbiAgICAgIHByaXZhdGUgZGlyOiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiB0cy5JZGVudGlmaWVyIHtcbiAgICBjb25zdCBpZCA9IHRoaXMudGNiLmFsbG9jYXRlSWQoKTtcbiAgICBjb25zdCB0eXBlQ3RvciA9IHRoaXMudGNiLmVudi50eXBlQ3RvckZvcih0aGlzLmRpcik7XG4gICAgY29uc3QgY2lyY3VsYXJQbGFjZWhvbGRlciA9IHRzLmNyZWF0ZUNhbGwoXG4gICAgICAgIHR5cGVDdG9yLCAvKiB0eXBlQXJndW1lbnRzICovIHVuZGVmaW5lZCwgW3RzLmNyZWF0ZU5vbk51bGxFeHByZXNzaW9uKHRzLmNyZWF0ZU51bGwoKSldKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0NyZWF0ZVZhcmlhYmxlKGlkLCBjaXJjdWxhclBsYWNlaG9sZGVyKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGZlZWRzIGVsZW1lbnRzIGFuZCB1bmNsYWltZWQgcHJvcGVydGllcyB0byB0aGUgYERvbVNjaGVtYUNoZWNrZXJgLlxuICpcbiAqIFRoZSBET00gc2NoZW1hIGlzIG5vdCBjaGVja2VkIHZpYSBUQ0IgY29kZSBnZW5lcmF0aW9uLiBJbnN0ZWFkLCB0aGUgYERvbVNjaGVtYUNoZWNrZXJgIGluZ2VzdHNcbiAqIGVsZW1lbnRzIGFuZCBwcm9wZXJ0eSBiaW5kaW5ncyBhbmQgYWNjdW11bGF0ZXMgc3ludGhldGljIGB0cy5EaWFnbm9zdGljYHMgb3V0LW9mLWJhbmQuIFRoZXNlIGFyZVxuICogbGF0ZXIgbWVyZ2VkIHdpdGggdGhlIGRpYWdub3N0aWNzIGdlbmVyYXRlZCBmcm9tIHRoZSBUQ0IuXG4gKlxuICogRm9yIGNvbnZlbmllbmNlLCB0aGUgVENCIGl0ZXJhdGlvbiBvZiB0aGUgdGVtcGxhdGUgaXMgdXNlZCB0byBkcml2ZSB0aGUgYERvbVNjaGVtYUNoZWNrZXJgIHZpYVxuICogdGhlIGBUY2JEb21TY2hlbWFDaGVja2VyT3BgLlxuICovXG5jbGFzcyBUY2JEb21TY2hlbWFDaGVja2VyT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgZWxlbWVudDogVG1wbEFzdEVsZW1lbnQsIHByaXZhdGUgY2hlY2tFbGVtZW50OiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSBjbGFpbWVkSW5wdXRzOiBTZXQ8c3RyaW5nPikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmICh0aGlzLmNoZWNrRWxlbWVudCkge1xuICAgICAgdGhpcy50Y2IuZG9tU2NoZW1hQ2hlY2tlci5jaGVja0VsZW1lbnQodGhpcy50Y2IuaWQsIHRoaXMuZWxlbWVudCwgdGhpcy50Y2Iuc2NoZW1hcyk7XG4gICAgfVxuXG4gICAgLy8gVE9ETyhhbHhodWIpOiB0aGlzIGNvdWxkIGJlIG1vcmUgZWZmaWNpZW50LlxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiB0aGlzLmVsZW1lbnQuaW5wdXRzKSB7XG4gICAgICBpZiAoYmluZGluZy50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSAmJiB0aGlzLmNsYWltZWRJbnB1dHMuaGFzKGJpbmRpbmcubmFtZSkpIHtcbiAgICAgICAgLy8gU2tpcCB0aGlzIGJpbmRpbmcgYXMgaXQgd2FzIGNsYWltZWQgYnkgYSBkaXJlY3RpdmUuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYmluZGluZy50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgICBpZiAoYmluZGluZy5uYW1lICE9PSAnc3R5bGUnICYmIGJpbmRpbmcubmFtZSAhPT0gJ2NsYXNzJykge1xuICAgICAgICAgIC8vIEEgZGlyZWN0IGJpbmRpbmcgdG8gYSBwcm9wZXJ0eS5cbiAgICAgICAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBBVFRSX1RPX1BST1BbYmluZGluZy5uYW1lXSB8fCBiaW5kaW5nLm5hbWU7XG4gICAgICAgICAgdGhpcy50Y2IuZG9tU2NoZW1hQ2hlY2tlci5jaGVja1Byb3BlcnR5KFxuICAgICAgICAgICAgICB0aGlzLnRjYi5pZCwgdGhpcy5lbGVtZW50LCBwcm9wZXJ0eU5hbWUsIGJpbmRpbmcuc291cmNlU3BhbiwgdGhpcy50Y2Iuc2NoZW1hcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuXG4vKipcbiAqIE1hcHBpbmcgYmV0d2VlbiBhdHRyaWJ1dGVzIG5hbWVzIHRoYXQgZG9uJ3QgY29ycmVzcG9uZCB0byB0aGVpciBlbGVtZW50IHByb3BlcnR5IG5hbWVzLlxuICogTm90ZTogdGhpcyBtYXBwaW5nIGhhcyB0byBiZSBrZXB0IGluIHN5bmMgd2l0aCB0aGUgZXF1YWxseSBuYW1lZCBtYXBwaW5nIGluIHRoZSBydW50aW1lLlxuICovXG5jb25zdCBBVFRSX1RPX1BST1A6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgJ2NsYXNzJzogJ2NsYXNzTmFtZScsXG4gICdmb3InOiAnaHRtbEZvcicsXG4gICdmb3JtYWN0aW9uJzogJ2Zvcm1BY3Rpb24nLFxuICAnaW5uZXJIdG1sJzogJ2lubmVySFRNTCcsXG4gICdyZWFkb25seSc6ICdyZWFkT25seScsXG4gICd0YWJpbmRleCc6ICd0YWJJbmRleCcsXG59O1xuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBnZW5lcmF0ZXMgY29kZSB0byBjaGVjayBcInVuY2xhaW1lZCBpbnB1dHNcIiAtIGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQgd2hpY2ggd2VyZVxuICogbm90IGF0dHJpYnV0ZWQgdG8gYW55IGRpcmVjdGl2ZSBvciBjb21wb25lbnQsIGFuZCBhcmUgaW5zdGVhZCBwcm9jZXNzZWQgYWdhaW5zdCB0aGUgSFRNTCBlbGVtZW50XG4gKiBpdHNlbGYuXG4gKlxuICogQ3VycmVudGx5LCBvbmx5IHRoZSBleHByZXNzaW9ucyBvZiB0aGVzZSBiaW5kaW5ncyBhcmUgY2hlY2tlZC4gVGhlIHRhcmdldHMgb2YgdGhlIGJpbmRpbmdzIGFyZVxuICogY2hlY2tlZCBhZ2FpbnN0IHRoZSBET00gc2NoZW1hIHZpYSBhIGBUY2JEb21TY2hlbWFDaGVja2VyT3BgLlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIG5vdGhpbmcuXG4gKi9cbmNsYXNzIFRjYlVuY2xhaW1lZElucHV0c09wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBlbGVtZW50OiBUbXBsQXN0RWxlbWVudCxcbiAgICAgIHByaXZhdGUgY2xhaW1lZElucHV0czogU2V0PHN0cmluZz4pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogbnVsbCB7XG4gICAgLy8gYHRoaXMuaW5wdXRzYCBjb250YWlucyBvbmx5IHRob3NlIGJpbmRpbmdzIG5vdCBtYXRjaGVkIGJ5IGFueSBkaXJlY3RpdmUuIFRoZXNlIGJpbmRpbmdzIGdvIHRvXG4gICAgLy8gdGhlIGVsZW1lbnQgaXRzZWxmLlxuICAgIGxldCBlbElkOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gICAgLy8gVE9ETyhhbHhodWIpOiB0aGlzIGNvdWxkIGJlIG1vcmUgZWZmaWNpZW50LlxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiB0aGlzLmVsZW1lbnQuaW5wdXRzKSB7XG4gICAgICBpZiAoYmluZGluZy50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSAmJiB0aGlzLmNsYWltZWRJbnB1dHMuaGFzKGJpbmRpbmcubmFtZSkpIHtcbiAgICAgICAgLy8gU2tpcCB0aGlzIGJpbmRpbmcgYXMgaXQgd2FzIGNsYWltZWQgYnkgYSBkaXJlY3RpdmUuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBsZXQgZXhwciA9IHRjYkV4cHJlc3Npb24oYmluZGluZy52YWx1ZSwgdGhpcy50Y2IsIHRoaXMuc2NvcGUpO1xuICAgICAgaWYgKCF0aGlzLnRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBjaGVja2luZyB0aGUgdHlwZSBvZiBiaW5kaW5ncyBpcyBkaXNhYmxlZCwgY2FzdCB0aGUgcmVzdWx0aW5nIGV4cHJlc3Npb24gdG8gJ2FueSdcbiAgICAgICAgLy8gYmVmb3JlIHRoZSBhc3NpZ25tZW50LlxuICAgICAgICBleHByID0gdHNDYXN0VG9BbnkoZXhwcik7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRjYi5lbnYuY29uZmlnLnN0cmljdE51bGxJbnB1dEJpbmRpbmdzKSB7XG4gICAgICAgIC8vIElmIHN0cmljdCBudWxsIGNoZWNrcyBhcmUgZGlzYWJsZWQsIGVyYXNlIGBudWxsYCBhbmQgYHVuZGVmaW5lZGAgZnJvbSB0aGUgdHlwZSBieVxuICAgICAgICAvLyB3cmFwcGluZyB0aGUgZXhwcmVzc2lvbiBpbiBhIG5vbi1udWxsIGFzc2VydGlvbi5cbiAgICAgICAgZXhwciA9IHRzLmNyZWF0ZU5vbk51bGxFeHByZXNzaW9uKGV4cHIpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZkRvbUJpbmRpbmdzICYmIGJpbmRpbmcudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgaWYgKGJpbmRpbmcubmFtZSAhPT0gJ3N0eWxlJyAmJiBiaW5kaW5nLm5hbWUgIT09ICdjbGFzcycpIHtcbiAgICAgICAgICBpZiAoZWxJZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZWxJZCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLmVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBBIGRpcmVjdCBiaW5kaW5nIHRvIGEgcHJvcGVydHkuXG4gICAgICAgICAgY29uc3QgcHJvcGVydHlOYW1lID0gQVRUUl9UT19QUk9QW2JpbmRpbmcubmFtZV0gfHwgYmluZGluZy5uYW1lO1xuICAgICAgICAgIGNvbnN0IHByb3AgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKGVsSWQsIHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwocHJvcGVydHlOYW1lKSk7XG4gICAgICAgICAgY29uc3Qgc3RtdCA9IHRzLmNyZWF0ZUJpbmFyeShwcm9wLCB0cy5TeW50YXhLaW5kLkVxdWFsc1Rva2VuLCB3cmFwRm9yRGlhZ25vc3RpY3MoZXhwcikpO1xuICAgICAgICAgIGFkZFBhcnNlU3BhbkluZm8oc3RtdCwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KHN0bXQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGV4cHIpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQSBiaW5kaW5nIHRvIGFuIGFuaW1hdGlvbiwgYXR0cmlidXRlLCBjbGFzcyBvciBzdHlsZS4gRm9yIG5vdywgb25seSB2YWxpZGF0ZSB0aGUgcmlnaHQtXG4gICAgICAgIC8vIGhhbmQgc2lkZSBvZiB0aGUgZXhwcmVzc2lvbi5cbiAgICAgICAgLy8gVE9ETzogcHJvcGVybHkgY2hlY2sgY2xhc3MgYW5kIHN0eWxlIGJpbmRpbmdzLlxuICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGV4cHIpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBnZW5lcmF0ZXMgY29kZSB0byBjaGVjayBldmVudCBiaW5kaW5ncyBvbiBhbiBlbGVtZW50IHRoYXQgY29ycmVzcG9uZCB3aXRoIHRoZVxuICogb3V0cHV0cyBvZiBhIGRpcmVjdGl2ZS5cbiAqXG4gKiBFeGVjdXRpbmcgdGhpcyBvcGVyYXRpb24gcmV0dXJucyBub3RoaW5nLlxuICovXG5leHBvcnQgY2xhc3MgVGNiRGlyZWN0aXZlT3V0cHV0c09wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgICBwcml2YXRlIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogbnVsbCB7XG4gICAgbGV0IGRpcklkOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGNvbnN0IG91dHB1dHMgPSB0aGlzLmRpci5vdXRwdXRzO1xuXG4gICAgZm9yIChjb25zdCBvdXRwdXQgb2YgdGhpcy5ub2RlLm91dHB1dHMpIHtcbiAgICAgIGlmIChvdXRwdXQudHlwZSAhPT0gUGFyc2VkRXZlbnRUeXBlLlJlZ3VsYXIgfHwgIW91dHB1dHMuaGFzQmluZGluZ1Byb3BlcnR5TmFtZShvdXRwdXQubmFtZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPKGFseGh1Yik6IGNvbnNpZGVyIHN1cHBvcnRpbmcgbXVsdGlwbGUgZmllbGRzIHdpdGggdGhlIHNhbWUgcHJvcGVydHkgbmFtZSBmb3Igb3V0cHV0cy5cbiAgICAgIGNvbnN0IGZpZWxkID0gb3V0cHV0cy5nZXRCeUJpbmRpbmdQcm9wZXJ0eU5hbWUob3V0cHV0Lm5hbWUpIVswXS5jbGFzc1Byb3BlcnR5TmFtZTtcblxuICAgICAgaWYgKGRpcklkID09PSBudWxsKSB7XG4gICAgICAgIGRpcklkID0gdGhpcy5zY29wZS5yZXNvbHZlKHRoaXMubm9kZSwgdGhpcy5kaXIpO1xuICAgICAgfVxuICAgICAgY29uc3Qgb3V0cHV0RmllbGQgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKGRpcklkLCB0cy5jcmVhdGVTdHJpbmdMaXRlcmFsKGZpZWxkKSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKG91dHB1dEZpZWxkLCBvdXRwdXQua2V5U3Bhbik7XG4gICAgICBpZiAodGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZk91dHB1dEV2ZW50cykge1xuICAgICAgICAvLyBGb3Igc3RyaWN0IGNoZWNraW5nIG9mIGRpcmVjdGl2ZSBldmVudHMsIGdlbmVyYXRlIGEgY2FsbCB0byB0aGUgYHN1YnNjcmliZWAgbWV0aG9kXG4gICAgICAgIC8vIG9uIHRoZSBkaXJlY3RpdmUncyBvdXRwdXQgZmllbGQgdG8gbGV0IHR5cGUgaW5mb3JtYXRpb24gZmxvdyBpbnRvIHRoZSBoYW5kbGVyIGZ1bmN0aW9uJ3NcbiAgICAgICAgLy8gYCRldmVudGAgcGFyYW1ldGVyLlxuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGNiQ3JlYXRlRXZlbnRIYW5kbGVyKG91dHB1dCwgdGhpcy50Y2IsIHRoaXMuc2NvcGUsIEV2ZW50UGFyYW1UeXBlLkluZmVyKTtcbiAgICAgICAgY29uc3Qgc3Vic2NyaWJlRm4gPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhvdXRwdXRGaWVsZCwgJ3N1YnNjcmliZScpO1xuICAgICAgICBjb25zdCBjYWxsID0gdHMuY3JlYXRlQ2FsbChzdWJzY3JpYmVGbiwgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsIFtoYW5kbGVyXSk7XG4gICAgICAgIGFkZFBhcnNlU3BhbkluZm8oY2FsbCwgb3V0cHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGNhbGwpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIHN0cmljdCBjaGVja2luZyBvZiBkaXJlY3RpdmUgZXZlbnRzIGlzIGRpc2FibGVkOlxuICAgICAgICAvL1xuICAgICAgICAvLyAqIFdlIHN0aWxsIGdlbmVyYXRlIHRoZSBhY2Nlc3MgdG8gdGhlIG91dHB1dCBmaWVsZCBhcyBhIHN0YXRlbWVudCBpbiB0aGUgVENCIHNvIGNvbnN1bWVyc1xuICAgICAgICAvLyAgIG9mIHRoZSBgVGVtcGxhdGVUeXBlQ2hlY2tlcmAgY2FuIHN0aWxsIGZpbmQgdGhlIG5vZGUgZm9yIHRoZSBjbGFzcyBtZW1iZXIgZm9yIHRoZVxuICAgICAgICAvLyAgIG91dHB1dC5cbiAgICAgICAgLy8gKiBFbWl0IGEgaGFuZGxlciBmdW5jdGlvbiB3aGVyZSB0aGUgYCRldmVudGAgcGFyYW1ldGVyIGhhcyBhbiBleHBsaWNpdCBgYW55YCB0eXBlLlxuICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KG91dHB1dEZpZWxkKSk7XG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0Y2JDcmVhdGVFdmVudEhhbmRsZXIob3V0cHV0LCB0aGlzLnRjYiwgdGhpcy5zY29wZSwgRXZlbnRQYXJhbVR5cGUuQW55KTtcbiAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChoYW5kbGVyKSk7XG4gICAgICB9XG5cbiAgICAgIEV4cHJlc3Npb25TZW1hbnRpY1Zpc2l0b3IudmlzaXQoXG4gICAgICAgICAgb3V0cHV0LmhhbmRsZXIsIHRoaXMudGNiLmlkLCB0aGlzLnRjYi5ib3VuZFRhcmdldCwgdGhpcy50Y2Iub29iUmVjb3JkZXIpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGdlbmVyYXRlcyBjb2RlIHRvIGNoZWNrIFwidW5jbGFpbWVkIG91dHB1dHNcIiAtIGV2ZW50IGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQgd2hpY2hcbiAqIHdlcmUgbm90IGF0dHJpYnV0ZWQgdG8gYW55IGRpcmVjdGl2ZSBvciBjb21wb25lbnQsIGFuZCBhcmUgaW5zdGVhZCBwcm9jZXNzZWQgYWdhaW5zdCB0aGUgSFRNTFxuICogZWxlbWVudCBpdHNlbGYuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgbm90aGluZy5cbiAqL1xuY2xhc3MgVGNiVW5jbGFpbWVkT3V0cHV0c09wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBlbGVtZW50OiBUbXBsQXN0RWxlbWVudCxcbiAgICAgIHByaXZhdGUgY2xhaW1lZE91dHB1dHM6IFNldDxzdHJpbmc+KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGdldCBvcHRpb25hbCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBleGVjdXRlKCk6IG51bGwge1xuICAgIGxldCBlbElkOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gICAgLy8gVE9ETyhhbHhodWIpOiB0aGlzIGNvdWxkIGJlIG1vcmUgZWZmaWNpZW50LlxuICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIHRoaXMuZWxlbWVudC5vdXRwdXRzKSB7XG4gICAgICBpZiAodGhpcy5jbGFpbWVkT3V0cHV0cy5oYXMob3V0cHV0Lm5hbWUpKSB7XG4gICAgICAgIC8vIFNraXAgdGhpcyBldmVudCBoYW5kbGVyIGFzIGl0IHdhcyBjbGFpbWVkIGJ5IGEgZGlyZWN0aXZlLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG91dHB1dC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgIC8vIEFuaW1hdGlvbiBvdXRwdXQgYmluZGluZ3MgYWx3YXlzIGhhdmUgYW4gYCRldmVudGAgcGFyYW1ldGVyIG9mIHR5cGUgYEFuaW1hdGlvbkV2ZW50YC5cbiAgICAgICAgY29uc3QgZXZlbnRUeXBlID0gdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZkFuaW1hdGlvbkV2ZW50cyA/XG4gICAgICAgICAgICB0aGlzLnRjYi5lbnYucmVmZXJlbmNlRXh0ZXJuYWxUeXBlKCdAYW5ndWxhci9hbmltYXRpb25zJywgJ0FuaW1hdGlvbkV2ZW50JykgOlxuICAgICAgICAgICAgRXZlbnRQYXJhbVR5cGUuQW55O1xuXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0Y2JDcmVhdGVFdmVudEhhbmRsZXIob3V0cHV0LCB0aGlzLnRjYiwgdGhpcy5zY29wZSwgZXZlbnRUeXBlKTtcbiAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChoYW5kbGVyKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZEb21FdmVudHMpIHtcbiAgICAgICAgLy8gSWYgc3RyaWN0IGNoZWNraW5nIG9mIERPTSBldmVudHMgaXMgZW5hYmxlZCwgZ2VuZXJhdGUgYSBjYWxsIHRvIGBhZGRFdmVudExpc3RlbmVyYCBvblxuICAgICAgICAvLyB0aGUgZWxlbWVudCBpbnN0YW5jZSBzbyB0aGF0IFR5cGVTY3JpcHQncyB0eXBlIGluZmVyZW5jZSBmb3JcbiAgICAgICAgLy8gYEhUTUxFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXJgIHVzaW5nIGBIVE1MRWxlbWVudEV2ZW50TWFwYCB0byBpbmZlciBhbiBhY2N1cmF0ZSB0eXBlIGZvclxuICAgICAgICAvLyBgJGV2ZW50YCBkZXBlbmRpbmcgb24gdGhlIGV2ZW50IG5hbWUuIEZvciB1bmtub3duIGV2ZW50IG5hbWVzLCBUeXBlU2NyaXB0IHJlc29ydHMgdG8gdGhlXG4gICAgICAgIC8vIGJhc2UgYEV2ZW50YCB0eXBlLlxuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGNiQ3JlYXRlRXZlbnRIYW5kbGVyKG91dHB1dCwgdGhpcy50Y2IsIHRoaXMuc2NvcGUsIEV2ZW50UGFyYW1UeXBlLkluZmVyKTtcblxuICAgICAgICBpZiAoZWxJZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGVsSWQgPSB0aGlzLnNjb3BlLnJlc29sdmUodGhpcy5lbGVtZW50KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm9wZXJ0eUFjY2VzcyA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGVsSWQsICdhZGRFdmVudExpc3RlbmVyJyk7XG4gICAgICAgIGFkZFBhcnNlU3BhbkluZm8ocHJvcGVydHlBY2Nlc3MsIG91dHB1dC5rZXlTcGFuKTtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRzLmNyZWF0ZUNhbGwoXG4gICAgICAgICAgICAvKiBleHByZXNzaW9uICovIHByb3BlcnR5QWNjZXNzLFxuICAgICAgICAgICAgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAvKiBhcmd1bWVudHMgKi9bdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChvdXRwdXQubmFtZSksIGhhbmRsZXJdKTtcbiAgICAgICAgYWRkUGFyc2VTcGFuSW5mbyhjYWxsLCBvdXRwdXQuc291cmNlU3Bhbik7XG4gICAgICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzLmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQoY2FsbCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgc3RyaWN0IGNoZWNraW5nIG9mIERPTSBpbnB1dHMgaXMgZGlzYWJsZWQsIGVtaXQgYSBoYW5kbGVyIGZ1bmN0aW9uIHdoZXJlIHRoZSBgJGV2ZW50YFxuICAgICAgICAvLyBwYXJhbWV0ZXIgaGFzIGFuIGV4cGxpY2l0IGBhbnlgIHR5cGUuXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0Y2JDcmVhdGVFdmVudEhhbmRsZXIob3V0cHV0LCB0aGlzLnRjYiwgdGhpcy5zY29wZSwgRXZlbnRQYXJhbVR5cGUuQW55KTtcbiAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChoYW5kbGVyKSk7XG4gICAgICB9XG5cbiAgICAgIEV4cHJlc3Npb25TZW1hbnRpY1Zpc2l0b3IudmlzaXQoXG4gICAgICAgICAgb3V0cHV0LmhhbmRsZXIsIHRoaXMudGNiLmlkLCB0aGlzLnRjYi5ib3VuZFRhcmdldCwgdGhpcy50Y2Iub29iUmVjb3JkZXIpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGdlbmVyYXRlcyBhIGNvbXBsZXRpb24gcG9pbnQgZm9yIHRoZSBjb21wb25lbnQgY29udGV4dC5cbiAqXG4gKiBUaGlzIGNvbXBsZXRpb24gcG9pbnQgbG9va3MgbGlrZSBgY3R4LiA7YCBpbiB0aGUgVENCIG91dHB1dCwgYW5kIGRvZXMgbm90IHByb2R1Y2UgZGlhZ25vc3RpY3MuXG4gKiBUeXBlU2NyaXB0IGF1dG9jb21wbGV0aW9uIEFQSXMgY2FuIGJlIHVzZWQgYXQgdGhpcyBjb21wbGV0aW9uIHBvaW50IChhZnRlciB0aGUgJy4nKSB0byBwcm9kdWNlXG4gKiBhdXRvY29tcGxldGlvbiByZXN1bHRzIG9mIHByb3BlcnRpZXMgYW5kIG1ldGhvZHMgZnJvbSB0aGUgdGVtcGxhdGUncyBjb21wb25lbnQgY29udGV4dC5cbiAqL1xuY2xhc3MgVGNiQ29tcG9uZW50Q29udGV4dENvbXBsZXRpb25PcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzY29wZTogU2NvcGUpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgcmVhZG9ubHkgb3B0aW9uYWwgPSBmYWxzZTtcblxuICBleGVjdXRlKCk6IG51bGwge1xuICAgIGNvbnN0IGN0eCA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoJ2N0eCcpO1xuICAgIGNvbnN0IGN0eERvdCA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGN0eCwgJycpO1xuICAgIG1hcmtJZ25vcmVEaWFnbm9zdGljcyhjdHhEb3QpO1xuICAgIGFkZEV4cHJlc3Npb25JZGVudGlmaWVyKGN0eERvdCwgRXhwcmVzc2lvbklkZW50aWZpZXIuQ09NUE9ORU5UX0NPTVBMRVRJT04pO1xuICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzLmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQoY3R4RG90KSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBWYWx1ZSB1c2VkIHRvIGJyZWFrIGEgY2lyY3VsYXIgcmVmZXJlbmNlIGJldHdlZW4gYFRjYk9wYHMuXG4gKlxuICogVGhpcyB2YWx1ZSBpcyByZXR1cm5lZCB3aGVuZXZlciBgVGNiT3BgcyBoYXZlIGEgY2lyY3VsYXIgZGVwZW5kZW5jeS4gVGhlIGV4cHJlc3Npb24gaXMgYSBub24tbnVsbFxuICogYXNzZXJ0aW9uIG9mIHRoZSBudWxsIHZhbHVlIChpbiBUeXBlU2NyaXB0LCB0aGUgZXhwcmVzc2lvbiBgbnVsbCFgKS4gVGhpcyBjb25zdHJ1Y3Rpb24gd2lsbCBpbmZlclxuICogdGhlIGxlYXN0IG5hcnJvdyB0eXBlIGZvciB3aGF0ZXZlciBpdCdzIGFzc2lnbmVkIHRvLlxuICovXG5jb25zdCBJTkZFUl9UWVBFX0ZPUl9DSVJDVUxBUl9PUF9FWFBSID0gdHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24odHMuY3JlYXRlTnVsbCgpKTtcblxuLyoqXG4gKiBPdmVyYWxsIGdlbmVyYXRpb24gY29udGV4dCBmb3IgdGhlIHR5cGUgY2hlY2sgYmxvY2suXG4gKlxuICogYENvbnRleHRgIGhhbmRsZXMgb3BlcmF0aW9ucyBkdXJpbmcgY29kZSBnZW5lcmF0aW9uIHdoaWNoIGFyZSBnbG9iYWwgd2l0aCByZXNwZWN0IHRvIHRoZSB3aG9sZVxuICogYmxvY2suIEl0J3MgcmVzcG9uc2libGUgZm9yIHZhcmlhYmxlIG5hbWUgYWxsb2NhdGlvbiBhbmQgbWFuYWdlbWVudCBvZiBhbnkgaW1wb3J0cyBuZWVkZWQuIEl0XG4gKiBhbHNvIGNvbnRhaW5zIHRoZSB0ZW1wbGF0ZSBtZXRhZGF0YSBpdHNlbGYuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZXh0IHtcbiAgcHJpdmF0ZSBuZXh0SWQgPSAxO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgZW52OiBFbnZpcm9ubWVudCwgcmVhZG9ubHkgZG9tU2NoZW1hQ2hlY2tlcjogRG9tU2NoZW1hQ2hlY2tlcixcbiAgICAgIHJlYWRvbmx5IG9vYlJlY29yZGVyOiBPdXRPZkJhbmREaWFnbm9zdGljUmVjb3JkZXIsIHJlYWRvbmx5IGlkOiBUZW1wbGF0ZUlkLFxuICAgICAgcmVhZG9ubHkgYm91bmRUYXJnZXQ6IEJvdW5kVGFyZ2V0PFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhPixcbiAgICAgIHByaXZhdGUgcGlwZXM6IE1hcDxzdHJpbmcsIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+Pj4sXG4gICAgICByZWFkb25seSBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdKSB7fVxuXG4gIC8qKlxuICAgKiBBbGxvY2F0ZSBhIG5ldyB2YXJpYWJsZSBuYW1lIGZvciB1c2Ugd2l0aGluIHRoZSBgQ29udGV4dGAuXG4gICAqXG4gICAqIEN1cnJlbnRseSB0aGlzIHVzZXMgYSBtb25vdG9uaWNhbGx5IGluY3JlYXNpbmcgY291bnRlciwgYnV0IGluIHRoZSBmdXR1cmUgdGhlIHZhcmlhYmxlIG5hbWVcbiAgICogbWlnaHQgY2hhbmdlIGRlcGVuZGluZyBvbiB0aGUgdHlwZSBvZiBkYXRhIGJlaW5nIHN0b3JlZC5cbiAgICovXG4gIGFsbG9jYXRlSWQoKTogdHMuSWRlbnRpZmllciB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoYF90JHt0aGlzLm5leHRJZCsrfWApO1xuICB9XG5cbiAgZ2V0UGlwZUJ5TmFtZShuYW1lOiBzdHJpbmcpOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj58bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBpcGVzLmhhcyhuYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBpcGVzLmdldChuYW1lKSE7XG4gIH1cbn1cblxuLyoqXG4gKiBMb2NhbCBzY29wZSB3aXRoaW4gdGhlIHR5cGUgY2hlY2sgYmxvY2sgZm9yIGEgcGFydGljdWxhciB0ZW1wbGF0ZS5cbiAqXG4gKiBUaGUgdG9wLWxldmVsIHRlbXBsYXRlIGFuZCBlYWNoIG5lc3RlZCBgPG5nLXRlbXBsYXRlPmAgaGF2ZSB0aGVpciBvd24gYFNjb3BlYCwgd2hpY2ggZXhpc3QgaW4gYVxuICogaGllcmFyY2h5LiBUaGUgc3RydWN0dXJlIG9mIHRoaXMgaGllcmFyY2h5IG1pcnJvcnMgdGhlIHN5bnRhY3RpYyBzY29wZXMgaW4gdGhlIGdlbmVyYXRlZCB0eXBlXG4gKiBjaGVjayBibG9jaywgd2hlcmUgZWFjaCBuZXN0ZWQgdGVtcGxhdGUgaXMgZW5jYXNlZCBpbiBhbiBgaWZgIHN0cnVjdHVyZS5cbiAqXG4gKiBBcyBhIHRlbXBsYXRlJ3MgYFRjYk9wYHMgYXJlIGV4ZWN1dGVkIGluIGEgZ2l2ZW4gYFNjb3BlYCwgc3RhdGVtZW50cyBhcmUgYWRkZWQgdmlhXG4gKiBgYWRkU3RhdGVtZW50KClgLiBXaGVuIHRoaXMgcHJvY2Vzc2luZyBpcyBjb21wbGV0ZSwgdGhlIGBTY29wZWAgY2FuIGJlIHR1cm5lZCBpbnRvIGEgYHRzLkJsb2NrYFxuICogdmlhIGByZW5kZXJUb0Jsb2NrKClgLlxuICpcbiAqIElmIGEgYFRjYk9wYCByZXF1aXJlcyB0aGUgb3V0cHV0IG9mIGFub3RoZXIsIGl0IGNhbiBjYWxsIGByZXNvbHZlKClgLlxuICovXG5jbGFzcyBTY29wZSB7XG4gIC8qKlxuICAgKiBBIHF1ZXVlIG9mIG9wZXJhdGlvbnMgd2hpY2ggbmVlZCB0byBiZSBwZXJmb3JtZWQgdG8gZ2VuZXJhdGUgdGhlIFRDQiBjb2RlIGZvciB0aGlzIHNjb3BlLlxuICAgKlxuICAgKiBUaGlzIGFycmF5IGNhbiBjb250YWluIGVpdGhlciBhIGBUY2JPcGAgd2hpY2ggaGFzIHlldCB0byBiZSBleGVjdXRlZCwgb3IgYSBgdHMuRXhwcmVzc2lvbnxudWxsYFxuICAgKiByZXByZXNlbnRpbmcgdGhlIG1lbW9pemVkIHJlc3VsdCBvZiBleGVjdXRpbmcgdGhlIG9wZXJhdGlvbi4gQXMgb3BlcmF0aW9ucyBhcmUgZXhlY3V0ZWQsIHRoZWlyXG4gICAqIHJlc3VsdHMgYXJlIHdyaXR0ZW4gaW50byB0aGUgYG9wUXVldWVgLCBvdmVyd3JpdGluZyB0aGUgb3JpZ2luYWwgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBJZiBhbiBvcGVyYXRpb24gaXMgaW4gdGhlIHByb2Nlc3Mgb2YgYmVpbmcgZXhlY3V0ZWQsIGl0IGlzIHRlbXBvcmFyaWx5IG92ZXJ3cml0dGVuIGhlcmUgd2l0aFxuICAgKiBgSU5GRVJfVFlQRV9GT1JfQ0lSQ1VMQVJfT1BfRVhQUmAuIFRoaXMgd2F5LCBpZiBhIGN5Y2xlIGlzIGVuY291bnRlcmVkIHdoZXJlIGFuIG9wZXJhdGlvblxuICAgKiBkZXBlbmRzIHRyYW5zaXRpdmVseSBvbiBpdHMgb3duIHJlc3VsdCwgdGhlIGlubmVyIG9wZXJhdGlvbiB3aWxsIGluZmVyIHRoZSBsZWFzdCBuYXJyb3cgdHlwZVxuICAgKiB0aGF0IGZpdHMgaW5zdGVhZC4gVGhpcyBoYXMgdGhlIHNhbWUgc2VtYW50aWNzIGFzIFR5cGVTY3JpcHQgaXRzZWxmIHdoZW4gdHlwZXMgYXJlIHJlZmVyZW5jZWRcbiAgICogY2lyY3VsYXJseS5cbiAgICovXG4gIHByaXZhdGUgb3BRdWV1ZTogKFRjYk9wfHRzLkV4cHJlc3Npb258bnVsbClbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBBIG1hcCBvZiBgVG1wbEFzdEVsZW1lbnRgcyB0byB0aGUgaW5kZXggb2YgdGhlaXIgYFRjYkVsZW1lbnRPcGAgaW4gdGhlIGBvcFF1ZXVlYFxuICAgKi9cbiAgcHJpdmF0ZSBlbGVtZW50T3BNYXAgPSBuZXcgTWFwPFRtcGxBc3RFbGVtZW50LCBudW1iZXI+KCk7XG4gIC8qKlxuICAgKiBBIG1hcCBvZiBtYXBzIHdoaWNoIHRyYWNrcyB0aGUgaW5kZXggb2YgYFRjYkRpcmVjdGl2ZUN0b3JPcGBzIGluIHRoZSBgb3BRdWV1ZWAgZm9yIGVhY2hcbiAgICogZGlyZWN0aXZlIG9uIGEgYFRtcGxBc3RFbGVtZW50YCBvciBgVG1wbEFzdFRlbXBsYXRlYCBub2RlLlxuICAgKi9cbiAgcHJpdmF0ZSBkaXJlY3RpdmVPcE1hcCA9XG4gICAgICBuZXcgTWFwPFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSwgTWFwPFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBudW1iZXI+PigpO1xuXG4gIC8qKlxuICAgKiBBIG1hcCBvZiBgVG1wbEFzdFJlZmVyZW5jZWBzIHRvIHRoZSBpbmRleCBvZiB0aGVpciBgVGNiUmVmZXJlbmNlT3BgIGluIHRoZSBgb3BRdWV1ZWBcbiAgICovXG4gIHByaXZhdGUgcmVmZXJlbmNlT3BNYXAgPSBuZXcgTWFwPFRtcGxBc3RSZWZlcmVuY2UsIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogTWFwIG9mIGltbWVkaWF0ZWx5IG5lc3RlZCA8bmctdGVtcGxhdGU+cyAod2l0aGluIHRoaXMgYFNjb3BlYCkgcmVwcmVzZW50ZWQgYnkgYFRtcGxBc3RUZW1wbGF0ZWBcbiAgICogbm9kZXMgdG8gdGhlIGluZGV4IG9mIHRoZWlyIGBUY2JUZW1wbGF0ZUNvbnRleHRPcGBzIGluIHRoZSBgb3BRdWV1ZWAuXG4gICAqL1xuICBwcml2YXRlIHRlbXBsYXRlQ3R4T3BNYXAgPSBuZXcgTWFwPFRtcGxBc3RUZW1wbGF0ZSwgbnVtYmVyPigpO1xuXG4gIC8qKlxuICAgKiBNYXAgb2YgdmFyaWFibGVzIGRlY2xhcmVkIG9uIHRoZSB0ZW1wbGF0ZSB0aGF0IGNyZWF0ZWQgdGhpcyBgU2NvcGVgIChyZXByZXNlbnRlZCBieVxuICAgKiBgVG1wbEFzdFZhcmlhYmxlYCBub2RlcykgdG8gdGhlIGluZGV4IG9mIHRoZWlyIGBUY2JWYXJpYWJsZU9wYHMgaW4gdGhlIGBvcFF1ZXVlYC5cbiAgICovXG4gIHByaXZhdGUgdmFyTWFwID0gbmV3IE1hcDxUbXBsQXN0VmFyaWFibGUsIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogU3RhdGVtZW50cyBmb3IgdGhpcyB0ZW1wbGF0ZS5cbiAgICpcbiAgICogRXhlY3V0aW5nIHRoZSBgVGNiT3BgcyBpbiB0aGUgYG9wUXVldWVgIHBvcHVsYXRlcyB0aGlzIGFycmF5LlxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0ZW1lbnRzOiB0cy5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBwYXJlbnQ6IFNjb3BlfG51bGwgPSBudWxsLFxuICAgICAgcHJpdmF0ZSBndWFyZDogdHMuRXhwcmVzc2lvbnxudWxsID0gbnVsbCkge31cblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhIGBTY29wZWAgZ2l2ZW4gZWl0aGVyIGEgYFRtcGxBc3RUZW1wbGF0ZWAgb3IgYSBsaXN0IG9mIGBUbXBsQXN0Tm9kZWBzLlxuICAgKlxuICAgKiBAcGFyYW0gdGNiIHRoZSBvdmVyYWxsIGNvbnRleHQgb2YgVENCIGdlbmVyYXRpb24uXG4gICAqIEBwYXJhbSBwYXJlbnQgdGhlIGBTY29wZWAgb2YgdGhlIHBhcmVudCB0ZW1wbGF0ZSAoaWYgYW55KSBvciBgbnVsbGAgaWYgdGhpcyBpcyB0aGUgcm9vdFxuICAgKiBgU2NvcGVgLlxuICAgKiBAcGFyYW0gdGVtcGxhdGVPck5vZGVzIGVpdGhlciBhIGBUbXBsQXN0VGVtcGxhdGVgIHJlcHJlc2VudGluZyB0aGUgdGVtcGxhdGUgZm9yIHdoaWNoIHRvXG4gICAqIGNhbGN1bGF0ZSB0aGUgYFNjb3BlYCwgb3IgYSBsaXN0IG9mIG5vZGVzIGlmIG5vIG91dGVyIHRlbXBsYXRlIG9iamVjdCBpcyBhdmFpbGFibGUuXG4gICAqIEBwYXJhbSBndWFyZCBhbiBleHByZXNzaW9uIHRoYXQgaXMgYXBwbGllZCB0byB0aGlzIHNjb3BlIGZvciB0eXBlIG5hcnJvd2luZyBwdXJwb3Nlcy5cbiAgICovXG4gIHN0YXRpYyBmb3JOb2RlcyhcbiAgICAgIHRjYjogQ29udGV4dCwgcGFyZW50OiBTY29wZXxudWxsLCB0ZW1wbGF0ZU9yTm9kZXM6IFRtcGxBc3RUZW1wbGF0ZXwoVG1wbEFzdE5vZGVbXSksXG4gICAgICBndWFyZDogdHMuRXhwcmVzc2lvbnxudWxsKTogU2NvcGUge1xuICAgIGNvbnN0IHNjb3BlID0gbmV3IFNjb3BlKHRjYiwgcGFyZW50LCBndWFyZCk7XG5cbiAgICBpZiAocGFyZW50ID09PSBudWxsICYmIHRjYi5lbnYuY29uZmlnLmVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIpIHtcbiAgICAgIC8vIEFkZCBhbiBhdXRvY29tcGxldGlvbiBwb2ludCBmb3IgdGhlIGNvbXBvbmVudCBjb250ZXh0LlxuICAgICAgc2NvcGUub3BRdWV1ZS5wdXNoKG5ldyBUY2JDb21wb25lbnRDb250ZXh0Q29tcGxldGlvbk9wKHNjb3BlKSk7XG4gICAgfVxuXG4gICAgbGV0IGNoaWxkcmVuOiBUbXBsQXN0Tm9kZVtdO1xuXG4gICAgLy8gSWYgZ2l2ZW4gYW4gYWN0dWFsIGBUbXBsQXN0VGVtcGxhdGVgIGluc3RhbmNlLCB0aGVuIHByb2Nlc3MgYW55IGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gaXRcbiAgICAvLyBoYXMuXG4gICAgaWYgKHRlbXBsYXRlT3JOb2RlcyBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSkge1xuICAgICAgLy8gVGhlIHRlbXBsYXRlJ3MgdmFyaWFibGUgZGVjbGFyYXRpb25zIG5lZWQgdG8gYmUgYWRkZWQgYXMgYFRjYlZhcmlhYmxlT3Bgcy5cbiAgICAgIGNvbnN0IHZhck1hcCA9IG5ldyBNYXA8c3RyaW5nLCBUbXBsQXN0VmFyaWFibGU+KCk7XG5cbiAgICAgIGZvciAoY29uc3QgdiBvZiB0ZW1wbGF0ZU9yTm9kZXMudmFyaWFibGVzKSB7XG4gICAgICAgIC8vIFZhbGlkYXRlIHRoYXQgdmFyaWFibGVzIG9uIHRoZSBgVG1wbEFzdFRlbXBsYXRlYCBhcmUgb25seSBkZWNsYXJlZCBvbmNlLlxuICAgICAgICBpZiAoIXZhck1hcC5oYXModi5uYW1lKSkge1xuICAgICAgICAgIHZhck1hcC5zZXQodi5uYW1lLCB2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBmaXJzdERlY2wgPSB2YXJNYXAuZ2V0KHYubmFtZSkhO1xuICAgICAgICAgIHRjYi5vb2JSZWNvcmRlci5kdXBsaWNhdGVUZW1wbGF0ZVZhcih0Y2IuaWQsIHYsIGZpcnN0RGVjbCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvcEluZGV4ID0gc2NvcGUub3BRdWV1ZS5wdXNoKG5ldyBUY2JWYXJpYWJsZU9wKHRjYiwgc2NvcGUsIHRlbXBsYXRlT3JOb2RlcywgdikpIC0gMTtcbiAgICAgICAgc2NvcGUudmFyTWFwLnNldCh2LCBvcEluZGV4KTtcbiAgICAgIH1cbiAgICAgIGNoaWxkcmVuID0gdGVtcGxhdGVPck5vZGVzLmNoaWxkcmVuO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaGlsZHJlbiA9IHRlbXBsYXRlT3JOb2RlcztcbiAgICB9XG4gICAgZm9yIChjb25zdCBub2RlIG9mIGNoaWxkcmVuKSB7XG4gICAgICBzY29wZS5hcHBlbmROb2RlKG5vZGUpO1xuICAgIH1cbiAgICByZXR1cm4gc2NvcGU7XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCBhIGB0cy5FeHByZXNzaW9uYCByZXByZXNlbnRpbmcgdGhlIHZhbHVlIG9mIHNvbWUgb3BlcmF0aW9uIGluIHRoZSBjdXJyZW50IGBTY29wZWAsXG4gICAqIGluY2x1ZGluZyBhbnkgcGFyZW50IHNjb3BlKHMpLiBUaGlzIG1ldGhvZCBhbHdheXMgcmV0dXJucyBhIG11dGFibGUgY2xvbmUgb2YgdGhlXG4gICAqIGB0cy5FeHByZXNzaW9uYCB3aXRoIHRoZSBjb21tZW50cyBjbGVhcmVkLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZSBhIGBUbXBsQXN0Tm9kZWAgb2YgdGhlIG9wZXJhdGlvbiBpbiBxdWVzdGlvbi4gVGhlIGxvb2t1cCBwZXJmb3JtZWQgd2lsbCBkZXBlbmQgb25cbiAgICogdGhlIHR5cGUgb2YgdGhpcyBub2RlOlxuICAgKlxuICAgKiBBc3N1bWluZyBgZGlyZWN0aXZlYCBpcyBub3QgcHJlc2VudCwgdGhlbiBgcmVzb2x2ZWAgd2lsbCByZXR1cm46XG4gICAqXG4gICAqICogYFRtcGxBc3RFbGVtZW50YCAtIHJldHJpZXZlIHRoZSBleHByZXNzaW9uIGZvciB0aGUgZWxlbWVudCBET00gbm9kZVxuICAgKiAqIGBUbXBsQXN0VGVtcGxhdGVgIC0gcmV0cmlldmUgdGhlIHRlbXBsYXRlIGNvbnRleHQgdmFyaWFibGVcbiAgICogKiBgVG1wbEFzdFZhcmlhYmxlYCAtIHJldHJpZXZlIGEgdGVtcGxhdGUgbGV0LSB2YXJpYWJsZVxuICAgKiAqIGBUbXBsQXN0UmVmZXJlbmNlYCAtIHJldHJpZXZlIHZhcmlhYmxlIGNyZWF0ZWQgZm9yIHRoZSBsb2NhbCByZWZcbiAgICpcbiAgICogQHBhcmFtIGRpcmVjdGl2ZSBpZiBwcmVzZW50LCBhIGRpcmVjdGl2ZSB0eXBlIG9uIGEgYFRtcGxBc3RFbGVtZW50YCBvciBgVG1wbEFzdFRlbXBsYXRlYCB0b1xuICAgKiBsb29rIHVwIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQgZm9yIGFuIGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZS5cbiAgICovXG4gIHJlc29sdmUoXG4gICAgICBub2RlOiBUbXBsQXN0RWxlbWVudHxUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdFZhcmlhYmxlfFRtcGxBc3RSZWZlcmVuY2UsXG4gICAgICBkaXJlY3RpdmU/OiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIC8vIEF0dGVtcHQgdG8gcmVzb2x2ZSB0aGUgb3BlcmF0aW9uIGxvY2FsbHkuXG4gICAgY29uc3QgcmVzID0gdGhpcy5yZXNvbHZlTG9jYWwobm9kZSwgZGlyZWN0aXZlKTtcbiAgICBpZiAocmVzICE9PSBudWxsKSB7XG4gICAgICAvLyBXZSB3YW50IHRvIGdldCBhIGNsb25lIG9mIHRoZSByZXNvbHZlZCBleHByZXNzaW9uIGFuZCBjbGVhciB0aGUgdHJhaWxpbmcgY29tbWVudHNcbiAgICAgIC8vIHNvIHRoZXkgZG9uJ3QgY29udGludWUgdG8gYXBwZWFyIGluIGV2ZXJ5IHBsYWNlIHRoZSBleHByZXNzaW9uIGlzIHVzZWQuXG4gICAgICAvLyBBcyBhbiBleGFtcGxlLCB0aGlzIHdvdWxkIG90aGVyd2lzZSBwcm9kdWNlOlxuICAgICAgLy8gdmFyIF90MSAvKipUOkRJUiovIC8qMSwyKi8gPSBfY3RvcjEoKTtcbiAgICAgIC8vIF90MSAvKipUOkRJUiovIC8qMSwyKi8uaW5wdXQgPSAndmFsdWUnO1xuICAgICAgLy9cbiAgICAgIC8vIEluIGFkZGl0aW9uLCByZXR1cm5pbmcgYSBjbG9uZSBwcmV2ZW50cyB0aGUgY29uc3VtZXIgb2YgYFNjb3BlI3Jlc29sdmVgIGZyb21cbiAgICAgIC8vIGF0dGFjaGluZyBjb21tZW50cyBhdCB0aGUgZGVjbGFyYXRpb24gc2l0ZS5cblxuICAgICAgY29uc3QgY2xvbmUgPSB0cy5nZXRNdXRhYmxlQ2xvbmUocmVzKTtcbiAgICAgIHRzLnNldFN5bnRoZXRpY1RyYWlsaW5nQ29tbWVudHMoY2xvbmUsIFtdKTtcbiAgICAgIHJldHVybiBjbG9uZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAvLyBDaGVjayB3aXRoIHRoZSBwYXJlbnQuXG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnQucmVzb2x2ZShub2RlLCBkaXJlY3RpdmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCByZXNvbHZlICR7bm9kZX0gLyAke2RpcmVjdGl2ZX1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgc3RhdGVtZW50IHRvIHRoaXMgc2NvcGUuXG4gICAqL1xuICBhZGRTdGF0ZW1lbnQoc3RtdDogdHMuU3RhdGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5zdGF0ZW1lbnRzLnB1c2goc3RtdCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBzdGF0ZW1lbnRzLlxuICAgKi9cbiAgcmVuZGVyKCk6IHRzLlN0YXRlbWVudFtdIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMub3BRdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gT3B0aW9uYWwgc3RhdGVtZW50cyBjYW5ub3QgYmUgc2tpcHBlZCB3aGVuIHdlIGFyZSBnZW5lcmF0aW5nIHRoZSBUQ0IgZm9yIHVzZVxuICAgICAgLy8gYnkgdGhlIFRlbXBsYXRlVHlwZUNoZWNrZXIuXG4gICAgICBjb25zdCBza2lwT3B0aW9uYWwgPSAhdGhpcy50Y2IuZW52LmNvbmZpZy5lbmFibGVUZW1wbGF0ZVR5cGVDaGVja2VyO1xuICAgICAgdGhpcy5leGVjdXRlT3AoaSwgc2tpcE9wdGlvbmFsKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc3RhdGVtZW50cztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGV4cHJlc3Npb24gb2YgYWxsIHRlbXBsYXRlIGd1YXJkcyB0aGF0IGFwcGx5IHRvIHRoaXMgc2NvcGUsIGluY2x1ZGluZyB0aG9zZSBvZlxuICAgKiBwYXJlbnQgc2NvcGVzLiBJZiBubyBndWFyZHMgaGF2ZSBiZWVuIGFwcGxpZWQsIG51bGwgaXMgcmV0dXJuZWQuXG4gICAqL1xuICBndWFyZHMoKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgcGFyZW50R3VhcmRzOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGlmICh0aGlzLnBhcmVudCAhPT0gbnVsbCkge1xuICAgICAgLy8gU3RhcnQgd2l0aCB0aGUgZ3VhcmRzIGZyb20gdGhlIHBhcmVudCBzY29wZSwgaWYgcHJlc2VudC5cbiAgICAgIHBhcmVudEd1YXJkcyA9IHRoaXMucGFyZW50Lmd1YXJkcygpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmd1YXJkID09PSBudWxsKSB7XG4gICAgICAvLyBUaGlzIHNjb3BlIGRvZXMgbm90IGhhdmUgYSBndWFyZCwgc28gcmV0dXJuIHRoZSBwYXJlbnQncyBndWFyZHMgYXMgaXMuXG4gICAgICByZXR1cm4gcGFyZW50R3VhcmRzO1xuICAgIH0gZWxzZSBpZiAocGFyZW50R3VhcmRzID09PSBudWxsKSB7XG4gICAgICAvLyBUaGVyZSdzIG5vIGd1YXJkcyBmcm9tIHRoZSBwYXJlbnQgc2NvcGUsIHNvIHRoaXMgc2NvcGUncyBndWFyZCByZXByZXNlbnRzIGFsbCBhdmFpbGFibGVcbiAgICAgIC8vIGd1YXJkcy5cbiAgICAgIHJldHVybiB0aGlzLmd1YXJkO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBCb3RoIHRoZSBwYXJlbnQgc2NvcGUgYW5kIHRoaXMgc2NvcGUgcHJvdmlkZSBhIGd1YXJkLCBzbyBjcmVhdGUgYSBjb21iaW5hdGlvbiBvZiB0aGUgdHdvLlxuICAgICAgLy8gSXQgaXMgaW1wb3J0YW50IHRoYXQgdGhlIHBhcmVudCBndWFyZCBpcyB1c2VkIGFzIGxlZnQgb3BlcmFuZCwgZ2l2ZW4gdGhhdCBpdCBtYXkgcHJvdmlkZVxuICAgICAgLy8gbmFycm93aW5nIHRoYXQgaXMgcmVxdWlyZWQgZm9yIHRoaXMgc2NvcGUncyBndWFyZCB0byBiZSB2YWxpZC5cbiAgICAgIHJldHVybiB0cy5jcmVhdGVCaW5hcnkocGFyZW50R3VhcmRzLCB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZEFtcGVyc2FuZFRva2VuLCB0aGlzLmd1YXJkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVMb2NhbChcbiAgICAgIHJlZjogVG1wbEFzdEVsZW1lbnR8VG1wbEFzdFRlbXBsYXRlfFRtcGxBc3RWYXJpYWJsZXxUbXBsQXN0UmVmZXJlbmNlLFxuICAgICAgZGlyZWN0aXZlPzogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChyZWYgaW5zdGFuY2VvZiBUbXBsQXN0UmVmZXJlbmNlICYmIHRoaXMucmVmZXJlbmNlT3BNYXAuaGFzKHJlZikpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVPcCh0aGlzLnJlZmVyZW5jZU9wTWFwLmdldChyZWYpISk7XG4gICAgfSBlbHNlIGlmIChyZWYgaW5zdGFuY2VvZiBUbXBsQXN0VmFyaWFibGUgJiYgdGhpcy52YXJNYXAuaGFzKHJlZikpIHtcbiAgICAgIC8vIFJlc29sdmluZyBhIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoaXMgdGVtcGxhdGUuXG4gICAgICAvLyBFeGVjdXRlIHRoZSBgVGNiVmFyaWFibGVPcGAgYXNzb2NpYXRlZCB3aXRoIHRoZSBgVG1wbEFzdFZhcmlhYmxlYC5cbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVPcCh0aGlzLnZhck1hcC5nZXQocmVmKSEpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHJlZiBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSAmJiBkaXJlY3RpdmUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICB0aGlzLnRlbXBsYXRlQ3R4T3BNYXAuaGFzKHJlZikpIHtcbiAgICAgIC8vIFJlc29sdmluZyB0aGUgY29udGV4dCBvZiB0aGUgZ2l2ZW4gc3ViLXRlbXBsYXRlLlxuICAgICAgLy8gRXhlY3V0ZSB0aGUgYFRjYlRlbXBsYXRlQ29udGV4dE9wYCBmb3IgdGhlIHRlbXBsYXRlLlxuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZU9wKHRoaXMudGVtcGxhdGVDdHhPcE1hcC5nZXQocmVmKSEpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIChyZWYgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCB8fCByZWYgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUpICYmXG4gICAgICAgIGRpcmVjdGl2ZSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuZGlyZWN0aXZlT3BNYXAuaGFzKHJlZikpIHtcbiAgICAgIC8vIFJlc29sdmluZyBhIGRpcmVjdGl2ZSBvbiBhbiBlbGVtZW50IG9yIHN1Yi10ZW1wbGF0ZS5cbiAgICAgIGNvbnN0IGRpck1hcCA9IHRoaXMuZGlyZWN0aXZlT3BNYXAuZ2V0KHJlZikhO1xuICAgICAgaWYgKGRpck1hcC5oYXMoZGlyZWN0aXZlKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXNvbHZlT3AoZGlyTWFwLmdldChkaXJlY3RpdmUpISk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJlZiBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50ICYmIHRoaXMuZWxlbWVudE9wTWFwLmhhcyhyZWYpKSB7XG4gICAgICAvLyBSZXNvbHZpbmcgdGhlIERPTSBub2RlIG9mIGFuIGVsZW1lbnQgaW4gdGhpcyB0ZW1wbGF0ZS5cbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVPcCh0aGlzLmVsZW1lbnRPcE1hcC5nZXQocmVmKSEpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTGlrZSBgZXhlY3V0ZU9wYCwgYnV0IGFzc2VydCB0aGF0IHRoZSBvcGVyYXRpb24gYWN0dWFsbHkgcmV0dXJuZWQgYHRzLkV4cHJlc3Npb25gLlxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlT3Aob3BJbmRleDogbnVtYmVyKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgcmVzID0gdGhpcy5leGVjdXRlT3Aob3BJbmRleCwgLyogc2tpcE9wdGlvbmFsICovIGZhbHNlKTtcbiAgICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIHJlc29sdmluZyBvcGVyYXRpb24sIGdvdCBudWxsYCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSBhIHBhcnRpY3VsYXIgYFRjYk9wYCBpbiB0aGUgYG9wUXVldWVgLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCByZXBsYWNlcyB0aGUgb3BlcmF0aW9uIGluIHRoZSBgb3BRdWV1ZWAgd2l0aCB0aGUgcmVzdWx0IG9mIGV4ZWN1dGlvbiAob25jZSBkb25lKVxuICAgKiBhbmQgYWxzbyBwcm90ZWN0cyBhZ2FpbnN0IGEgY2lyY3VsYXIgZGVwZW5kZW5jeSBmcm9tIHRoZSBvcGVyYXRpb24gdG8gaXRzZWxmIGJ5IHRlbXBvcmFyaWx5XG4gICAqIHNldHRpbmcgdGhlIG9wZXJhdGlvbidzIHJlc3VsdCB0byBhIHNwZWNpYWwgZXhwcmVzc2lvbi5cbiAgICovXG4gIHByaXZhdGUgZXhlY3V0ZU9wKG9wSW5kZXg6IG51bWJlciwgc2tpcE9wdGlvbmFsOiBib29sZWFuKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBjb25zdCBvcCA9IHRoaXMub3BRdWV1ZVtvcEluZGV4XTtcbiAgICBpZiAoIShvcCBpbnN0YW5jZW9mIFRjYk9wKSkge1xuICAgICAgcmV0dXJuIG9wO1xuICAgIH1cblxuICAgIGlmIChza2lwT3B0aW9uYWwgJiYgb3Aub3B0aW9uYWwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFNldCB0aGUgcmVzdWx0IG9mIHRoZSBvcGVyYXRpb24gaW4gdGhlIHF1ZXVlIHRvIGl0cyBjaXJjdWxhciBmYWxsYmFjay4gSWYgZXhlY3V0aW5nIHRoaXNcbiAgICAvLyBvcGVyYXRpb24gcmVzdWx0cyBpbiBhIGNpcmN1bGFyIGRlcGVuZGVuY3ksIHRoaXMgd2lsbCBwcmV2ZW50IGFuIGluZmluaXRlIGxvb3AgYW5kIGFsbG93IGZvclxuICAgIC8vIHRoZSByZXNvbHV0aW9uIG9mIHN1Y2ggY3ljbGVzLlxuICAgIHRoaXMub3BRdWV1ZVtvcEluZGV4XSA9IG9wLmNpcmN1bGFyRmFsbGJhY2soKTtcbiAgICBjb25zdCByZXMgPSBvcC5leGVjdXRlKCk7XG4gICAgLy8gT25jZSB0aGUgb3BlcmF0aW9uIGhhcyBmaW5pc2hlZCBleGVjdXRpbmcsIGl0J3Mgc2FmZSB0byBjYWNoZSB0aGUgcmVhbCByZXN1bHQuXG4gICAgdGhpcy5vcFF1ZXVlW29wSW5kZXhdID0gcmVzO1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZE5vZGUobm9kZTogVG1wbEFzdE5vZGUpOiB2b2lkIHtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50KSB7XG4gICAgICBjb25zdCBvcEluZGV4ID0gdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYkVsZW1lbnRPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSkpIC0gMTtcbiAgICAgIHRoaXMuZWxlbWVudE9wTWFwLnNldChub2RlLCBvcEluZGV4KTtcbiAgICAgIHRoaXMuYXBwZW5kRGlyZWN0aXZlc0FuZElucHV0c09mTm9kZShub2RlKTtcbiAgICAgIHRoaXMuYXBwZW5kT3V0cHV0c09mTm9kZShub2RlKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgICB0aGlzLmFwcGVuZE5vZGUoY2hpbGQpO1xuICAgICAgfVxuICAgICAgdGhpcy5jaGVja0FuZEFwcGVuZFJlZmVyZW5jZXNPZk5vZGUobm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlKSB7XG4gICAgICAvLyBUZW1wbGF0ZSBjaGlsZHJlbiBhcmUgcmVuZGVyZWQgaW4gYSBjaGlsZCBzY29wZS5cbiAgICAgIHRoaXMuYXBwZW5kRGlyZWN0aXZlc0FuZElucHV0c09mTm9kZShub2RlKTtcbiAgICAgIHRoaXMuYXBwZW5kT3V0cHV0c09mTm9kZShub2RlKTtcbiAgICAgIGNvbnN0IGN0eEluZGV4ID0gdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlRlbXBsYXRlQ29udGV4dE9wKHRoaXMudGNiLCB0aGlzKSkgLSAxO1xuICAgICAgdGhpcy50ZW1wbGF0ZUN0eE9wTWFwLnNldChub2RlLCBjdHhJbmRleCk7XG4gICAgICBpZiAodGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1RlbXBsYXRlQm9kaWVzKSB7XG4gICAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JUZW1wbGF0ZUJvZHlPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnRjYi5lbnYuY29uZmlnLmFsd2F5c0NoZWNrU2NoZW1hSW5UZW1wbGF0ZUJvZGllcykge1xuICAgICAgICB0aGlzLmFwcGVuZERlZXBTY2hlbWFDaGVja3Mobm9kZS5jaGlsZHJlbik7XG4gICAgICB9XG4gICAgICB0aGlzLmNoZWNrQW5kQXBwZW5kUmVmZXJlbmNlc09mTm9kZShub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0Qm91bmRUZXh0KSB7XG4gICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiVGV4dEludGVycG9sYXRpb25PcCh0aGlzLnRjYiwgdGhpcywgbm9kZSkpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RJY3UpIHtcbiAgICAgIHRoaXMuYXBwZW5kSWN1RXhwcmVzc2lvbnMobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGVja0FuZEFwcGVuZFJlZmVyZW5jZXNPZk5vZGUobm9kZTogVG1wbEFzdEVsZW1lbnR8VG1wbEFzdFRlbXBsYXRlKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCByZWYgb2Ygbm9kZS5yZWZlcmVuY2VzKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXRSZWZlcmVuY2VUYXJnZXQocmVmKTtcblxuICAgICAgbGV0IGN0eEluZGV4OiBudW1iZXI7XG4gICAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgIC8vIFRoZSByZWZlcmVuY2UgaXMgaW52YWxpZCBpZiBpdCBkb2Vzbid0IGhhdmUgYSB0YXJnZXQsIHNvIHJlcG9ydCBpdCBhcyBhbiBlcnJvci5cbiAgICAgICAgdGhpcy50Y2Iub29iUmVjb3JkZXIubWlzc2luZ1JlZmVyZW5jZVRhcmdldCh0aGlzLnRjYi5pZCwgcmVmKTtcblxuICAgICAgICAvLyBBbnkgdXNhZ2VzIG9mIHRoZSBpbnZhbGlkIHJlZmVyZW5jZSB3aWxsIGJlIHJlc29sdmVkIHRvIGEgdmFyaWFibGUgb2YgdHlwZSBhbnkuXG4gICAgICAgIGN0eEluZGV4ID0gdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYkludmFsaWRSZWZlcmVuY2VPcCh0aGlzLnRjYiwgdGhpcykpIC0gMTtcbiAgICAgIH0gZWxzZSBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlIHx8IHRhcmdldCBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50KSB7XG4gICAgICAgIGN0eEluZGV4ID0gdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlJlZmVyZW5jZU9wKHRoaXMudGNiLCB0aGlzLCByZWYsIG5vZGUsIHRhcmdldCkpIC0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN0eEluZGV4ID1cbiAgICAgICAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JSZWZlcmVuY2VPcCh0aGlzLnRjYiwgdGhpcywgcmVmLCBub2RlLCB0YXJnZXQuZGlyZWN0aXZlKSkgLSAxO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWZlcmVuY2VPcE1hcC5zZXQocmVmLCBjdHhJbmRleCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcHBlbmREaXJlY3RpdmVzQW5kSW5wdXRzT2ZOb2RlKG5vZGU6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSk6IHZvaWQge1xuICAgIC8vIENvbGxlY3QgYWxsIHRoZSBpbnB1dHMgb24gdGhlIGVsZW1lbnQuXG4gICAgY29uc3QgY2xhaW1lZElucHV0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGUpO1xuICAgIGlmIChkaXJlY3RpdmVzID09PSBudWxsIHx8IGRpcmVjdGl2ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gZGlyZWN0aXZlcywgdGhlbiBhbGwgaW5wdXRzIGFyZSB1bmNsYWltZWQgaW5wdXRzLCBzbyBxdWV1ZSBhbiBvcGVyYXRpb25cbiAgICAgIC8vIHRvIGFkZCB0aGVtIGlmIG5lZWRlZC5cbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlVuY2xhaW1lZElucHV0c09wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBjbGFpbWVkSW5wdXRzKSk7XG4gICAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKFxuICAgICAgICAgICAgbmV3IFRjYkRvbVNjaGVtYUNoZWNrZXJPcCh0aGlzLnRjYiwgbm9kZSwgLyogY2hlY2tFbGVtZW50ICovIHRydWUsIGNsYWltZWRJbnB1dHMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJNYXAgPSBuZXcgTWFwPFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgbGV0IGRpcmVjdGl2ZU9wOiBUY2JPcDtcbiAgICAgIGNvbnN0IGhvc3QgPSB0aGlzLnRjYi5lbnYucmVmbGVjdG9yO1xuICAgICAgY29uc3QgZGlyUmVmID0gZGlyLnJlZiBhcyBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj47XG5cbiAgICAgIGlmICghZGlyLmlzR2VuZXJpYykge1xuICAgICAgICAvLyBUaGUgbW9zdCBjb21tb24gY2FzZSBpcyB0aGF0IHdoZW4gYSBkaXJlY3RpdmUgaXMgbm90IGdlbmVyaWMsIHdlIHVzZSB0aGUgbm9ybWFsXG4gICAgICAgIC8vIGBUY2JOb25EaXJlY3RpdmVUeXBlT3BgLlxuICAgICAgICBkaXJlY3RpdmVPcCA9IG5ldyBUY2JOb25HZW5lcmljRGlyZWN0aXZlVHlwZU9wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBkaXIpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAhcmVxdWlyZXNJbmxpbmVUeXBlQ3RvcihkaXJSZWYubm9kZSwgaG9zdCkgfHxcbiAgICAgICAgICB0aGlzLnRjYi5lbnYuY29uZmlnLnVzZUlubGluZVR5cGVDb25zdHJ1Y3RvcnMpIHtcbiAgICAgICAgLy8gRm9yIGdlbmVyaWMgZGlyZWN0aXZlcywgd2UgdXNlIGEgdHlwZSBjb25zdHJ1Y3RvciB0byBpbmZlciB0eXBlcy4gSWYgYSBkaXJlY3RpdmUgcmVxdWlyZXNcbiAgICAgICAgLy8gYW4gaW5saW5lIHR5cGUgY29uc3RydWN0b3IsIHRoZW4gaW5saW5pbmcgbXVzdCBiZSBhdmFpbGFibGUgdG8gdXNlIHRoZVxuICAgICAgICAvLyBgVGNiRGlyZWN0aXZlQ3Rvck9wYC4gSWYgbm90IHdlLCB3ZSBmYWxsYmFjayB0byB1c2luZyBgYW55YCDigJMgc2VlIGJlbG93LlxuICAgICAgICBkaXJlY3RpdmVPcCA9IG5ldyBUY2JEaXJlY3RpdmVDdG9yT3AodGhpcy50Y2IsIHRoaXMsIG5vZGUsIGRpcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiBpbmxpbmluZyBpcyBub3QgYXZhaWxhYmxlLCB0aGVuIHdlIGdpdmUgdXAgb24gaW5mZXJpbmcgdGhlIGdlbmVyaWMgcGFyYW1zLCBhbmQgdXNlXG4gICAgICAgIC8vIGBhbnlgIHR5cGUgZm9yIHRoZSBkaXJlY3RpdmUncyBnZW5lcmljIHBhcmFtZXRlcnMuXG4gICAgICAgIGRpcmVjdGl2ZU9wID0gbmV3IFRjYkdlbmVyaWNEaXJlY3RpdmVUeXBlV2l0aEFueVBhcmFtc09wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBkaXIpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkaXJJbmRleCA9IHRoaXMub3BRdWV1ZS5wdXNoKGRpcmVjdGl2ZU9wKSAtIDE7XG4gICAgICBkaXJNYXAuc2V0KGRpciwgZGlySW5kZXgpO1xuXG4gICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiRGlyZWN0aXZlSW5wdXRzT3AodGhpcy50Y2IsIHRoaXMsIG5vZGUsIGRpcikpO1xuICAgIH1cbiAgICB0aGlzLmRpcmVjdGl2ZU9wTWFwLnNldChub2RlLCBkaXJNYXApO1xuXG4gICAgLy8gQWZ0ZXIgZXhwYW5kaW5nIHRoZSBkaXJlY3RpdmVzLCB3ZSBtaWdodCBuZWVkIHRvIHF1ZXVlIGFuIG9wZXJhdGlvbiB0byBjaGVjayBhbnkgdW5jbGFpbWVkXG4gICAgLy8gaW5wdXRzLlxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgIC8vIEdvIHRocm91Z2ggdGhlIGRpcmVjdGl2ZXMgYW5kIHJlbW92ZSBhbnkgaW5wdXRzIHRoYXQgaXQgY2xhaW1zIGZyb20gYGVsZW1lbnRJbnB1dHNgLlxuICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5TmFtZSBvZiBkaXIuaW5wdXRzLnByb3BlcnR5TmFtZXMpIHtcbiAgICAgICAgICBjbGFpbWVkSW5wdXRzLmFkZChwcm9wZXJ0eU5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JVbmNsYWltZWRJbnB1dHNPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSwgY2xhaW1lZElucHV0cykpO1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIGRpcmVjdGl2ZXMgd2hpY2ggbWF0Y2ggdGhpcyBlbGVtZW50LCB0aGVuIGl0J3MgYSBcInBsYWluXCIgRE9NIGVsZW1lbnQgKG9yIGFcbiAgICAgIC8vIHdlYiBjb21wb25lbnQpLCBhbmQgc2hvdWxkIGJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgRE9NIHNjaGVtYS4gSWYgYW55IGRpcmVjdGl2ZXMgbWF0Y2gsXG4gICAgICAvLyB3ZSBtdXN0IGFzc3VtZSB0aGF0IHRoZSBlbGVtZW50IGNvdWxkIGJlIGN1c3RvbSAoZWl0aGVyIGEgY29tcG9uZW50LCBvciBhIGRpcmVjdGl2ZSBsaWtlXG4gICAgICAvLyA8cm91dGVyLW91dGxldD4pIGFuZCBzaG91bGRuJ3QgdmFsaWRhdGUgdGhlIGVsZW1lbnQgbmFtZSBpdHNlbGYuXG4gICAgICBjb25zdCBjaGVja0VsZW1lbnQgPSBkaXJlY3RpdmVzLmxlbmd0aCA9PT0gMDtcbiAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JEb21TY2hlbWFDaGVja2VyT3AodGhpcy50Y2IsIG5vZGUsIGNoZWNrRWxlbWVudCwgY2xhaW1lZElucHV0cykpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kT3V0cHV0c09mTm9kZShub2RlOiBUbXBsQXN0RWxlbWVudHxUbXBsQXN0VGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvLyBDb2xsZWN0IGFsbCB0aGUgb3V0cHV0cyBvbiB0aGUgZWxlbWVudC5cbiAgICBjb25zdCBjbGFpbWVkT3V0cHV0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGUpO1xuICAgIGlmIChkaXJlY3RpdmVzID09PSBudWxsIHx8IGRpcmVjdGl2ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gZGlyZWN0aXZlcywgdGhlbiBhbGwgb3V0cHV0cyBhcmUgdW5jbGFpbWVkIG91dHB1dHMsIHNvIHF1ZXVlIGFuIG9wZXJhdGlvblxuICAgICAgLy8gdG8gYWRkIHRoZW0gaWYgbmVlZGVkLlxuICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCkge1xuICAgICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiVW5jbGFpbWVkT3V0cHV0c09wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBjbGFpbWVkT3V0cHV0cykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFF1ZXVlIG9wZXJhdGlvbnMgZm9yIGFsbCBkaXJlY3RpdmVzIHRvIGNoZWNrIHRoZSByZWxldmFudCBvdXRwdXRzIGZvciBhIGRpcmVjdGl2ZS5cbiAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJlY3RpdmVzKSB7XG4gICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiRGlyZWN0aXZlT3V0cHV0c09wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBkaXIpKTtcbiAgICB9XG5cbiAgICAvLyBBZnRlciBleHBhbmRpbmcgdGhlIGRpcmVjdGl2ZXMsIHdlIG1pZ2h0IG5lZWQgdG8gcXVldWUgYW4gb3BlcmF0aW9uIHRvIGNoZWNrIGFueSB1bmNsYWltZWRcbiAgICAvLyBvdXRwdXRzLlxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgIC8vIEdvIHRocm91Z2ggdGhlIGRpcmVjdGl2ZXMgYW5kIHJlZ2lzdGVyIGFueSBvdXRwdXRzIHRoYXQgaXQgY2xhaW1zIGluIGBjbGFpbWVkT3V0cHV0c2AuXG4gICAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJlY3RpdmVzKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb3V0cHV0UHJvcGVydHkgb2YgZGlyLm91dHB1dHMucHJvcGVydHlOYW1lcykge1xuICAgICAgICAgIGNsYWltZWRPdXRwdXRzLmFkZChvdXRwdXRQcm9wZXJ0eSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlVuY2xhaW1lZE91dHB1dHNPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSwgY2xhaW1lZE91dHB1dHMpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZERlZXBTY2hlbWFDaGVja3Mobm9kZXM6IFRtcGxBc3ROb2RlW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCB8fCBub2RlIGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCkge1xuICAgICAgICBjb25zdCBjbGFpbWVkSW5wdXRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGUpO1xuICAgICAgICBsZXQgaGFzRGlyZWN0aXZlczogYm9vbGVhbjtcbiAgICAgICAgaWYgKGRpcmVjdGl2ZXMgPT09IG51bGwgfHwgZGlyZWN0aXZlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBoYXNEaXJlY3RpdmVzID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFzRGlyZWN0aXZlcyA9IHRydWU7XG4gICAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9wZXJ0eU5hbWUgb2YgZGlyLmlucHV0cy5wcm9wZXJ0eU5hbWVzKSB7XG4gICAgICAgICAgICAgIGNsYWltZWRJbnB1dHMuYWRkKHByb3BlcnR5TmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JEb21TY2hlbWFDaGVja2VyT3AodGhpcy50Y2IsIG5vZGUsICFoYXNEaXJlY3RpdmVzLCBjbGFpbWVkSW5wdXRzKSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXBwZW5kRGVlcFNjaGVtYUNoZWNrcyhub2RlLmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZEljdUV4cHJlc3Npb25zKG5vZGU6IFRtcGxBc3RJY3UpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHZhcmlhYmxlIG9mIE9iamVjdC52YWx1ZXMobm9kZS52YXJzKSkge1xuICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlRleHRJbnRlcnBvbGF0aW9uT3AodGhpcy50Y2IsIHRoaXMsIHZhcmlhYmxlKSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGxhY2Vob2xkZXIgb2YgT2JqZWN0LnZhbHVlcyhub2RlLnBsYWNlaG9sZGVycykpIHtcbiAgICAgIGlmIChwbGFjZWhvbGRlciBpbnN0YW5jZW9mIFRtcGxBc3RCb3VuZFRleHQpIHtcbiAgICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlRleHRJbnRlcnBvbGF0aW9uT3AodGhpcy50Y2IsIHRoaXMsIHBsYWNlaG9sZGVyKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmludGVyZmFjZSBUY2JCb3VuZElucHV0IHtcbiAgYXR0cmlidXRlOiBUbXBsQXN0Qm91bmRBdHRyaWJ1dGV8VG1wbEFzdFRleHRBdHRyaWJ1dGU7XG4gIGZpZWxkTmFtZXM6IENsYXNzUHJvcGVydHlOYW1lW107XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBgY3R4YCBwYXJhbWV0ZXIgdG8gdGhlIHRvcC1sZXZlbCBUQ0IgZnVuY3Rpb24sIHdpdGggdGhlIGdpdmVuIGdlbmVyaWMgdHlwZSBhcmd1bWVudHMuXG4gKi9cbmZ1bmN0aW9uIHRjYkN0eFBhcmFtKFxuICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4sIG5hbWU6IHRzLkVudGl0eU5hbWUsXG4gICAgdHlwZUFyZ3VtZW50czogdHMuVHlwZU5vZGVbXXx1bmRlZmluZWQpOiB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbiB7XG4gIGNvbnN0IHR5cGUgPSB0cy5mYWN0b3J5LmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKG5hbWUsIHR5cGVBcmd1bWVudHMpO1xuICByZXR1cm4gdHMuZmFjdG9yeS5jcmVhdGVQYXJhbWV0ZXJEZWNsYXJhdGlvbihcbiAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogbW9kaWZpZXJzICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIGRvdERvdERvdFRva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG5hbWUgKi8gJ2N0eCcsXG4gICAgICAvKiBxdWVzdGlvblRva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIHR5cGUgKi8gdHlwZSxcbiAgICAgIC8qIGluaXRpYWxpemVyICovIHVuZGVmaW5lZCk7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbiBgQVNUYCBleHByZXNzaW9uIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgdHMuRXhwcmVzc2lvbmAsIGdlbmVyYXRpbmcgcmVmZXJlbmNlcyB0byB0aGVcbiAqIGNvcnJlY3QgaWRlbnRpZmllcnMgaW4gdGhlIGN1cnJlbnQgc2NvcGUuXG4gKi9cbmZ1bmN0aW9uIHRjYkV4cHJlc3Npb24oYXN0OiBBU1QsIHRjYjogQ29udGV4dCwgc2NvcGU6IFNjb3BlKTogdHMuRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHRyYW5zbGF0b3IgPSBuZXcgVGNiRXhwcmVzc2lvblRyYW5zbGF0b3IodGNiLCBzY29wZSk7XG4gIHJldHVybiB0cmFuc2xhdG9yLnRyYW5zbGF0ZShhc3QpO1xufVxuXG5jbGFzcyBUY2JFeHByZXNzaW9uVHJhbnNsYXRvciB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCB0Y2I6IENvbnRleHQsIHByb3RlY3RlZCBzY29wZTogU2NvcGUpIHt9XG5cbiAgdHJhbnNsYXRlKGFzdDogQVNUKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgLy8gYGFzdFRvVHlwZXNjcmlwdGAgYWN0dWFsbHkgZG9lcyB0aGUgY29udmVyc2lvbi4gQSBzcGVjaWFsIHJlc29sdmVyIGB0Y2JSZXNvbHZlYCBpcyBwYXNzZWRcbiAgICAvLyB3aGljaCBpbnRlcnByZXRzIHNwZWNpZmljIGV4cHJlc3Npb24gbm9kZXMgdGhhdCBpbnRlcmFjdCB3aXRoIHRoZSBgSW1wbGljaXRSZWNlaXZlcmAuIFRoZXNlXG4gICAgLy8gbm9kZXMgYWN0dWFsbHkgcmVmZXIgdG8gaWRlbnRpZmllcnMgd2l0aGluIHRoZSBjdXJyZW50IHNjb3BlLlxuICAgIHJldHVybiBhc3RUb1R5cGVzY3JpcHQoYXN0LCBhc3QgPT4gdGhpcy5yZXNvbHZlKGFzdCksIHRoaXMudGNiLmVudi5jb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc29sdmUgYW4gYEFTVGAgZXhwcmVzc2lvbiB3aXRoaW4gdGhlIGdpdmVuIHNjb3BlLlxuICAgKlxuICAgKiBTb21lIGBBU1RgIGV4cHJlc3Npb25zIHJlZmVyIHRvIHRvcC1sZXZlbCBjb25jZXB0cyAocmVmZXJlbmNlcywgdmFyaWFibGVzLCB0aGUgY29tcG9uZW50XG4gICAqIGNvbnRleHQpLiBUaGlzIG1ldGhvZCBhc3Npc3RzIGluIHJlc29sdmluZyB0aG9zZS5cbiAgICovXG4gIHByb3RlY3RlZCByZXNvbHZlKGFzdDogQVNUKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIC8vIFRyeSB0byByZXNvbHZlIGEgYm91bmQgdGFyZ2V0IGZvciB0aGlzIGV4cHJlc3Npb24uIElmIG5vIHN1Y2ggdGFyZ2V0IGlzIGF2YWlsYWJsZSwgdGhlblxuICAgICAgLy8gdGhlIGV4cHJlc3Npb24gaXMgcmVmZXJlbmNpbmcgdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC4gSW4gdGhhdCBjYXNlLCBgbnVsbGAgaXNcbiAgICAgIC8vIHJldHVybmVkIGhlcmUgdG8gbGV0IGl0IGZhbGwgdGhyb3VnaCByZXNvbHV0aW9uIHNvIGl0IHdpbGwgYmUgY2F1Z2h0IHdoZW4gdGhlXG4gICAgICAvLyBgSW1wbGljaXRSZWNlaXZlcmAgaXMgcmVzb2x2ZWQgaW4gdGhlIGJyYW5jaCBiZWxvdy5cbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVUYXJnZXQoYXN0KTtcbiAgICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIFByb3BlcnR5V3JpdGUgJiYgYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZXNvbHZlVGFyZ2V0KGFzdCk7XG4gICAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBleHByID0gdGhpcy50cmFuc2xhdGUoYXN0LnZhbHVlKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRzLmNyZWF0ZVBhcmVuKHRzLmNyZWF0ZUJpbmFyeSh0YXJnZXQsIHRzLlN5bnRheEtpbmQuRXF1YWxzVG9rZW4sIGV4cHIpKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8ocmVzdWx0LCBhc3Quc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgLy8gQVNUIGluc3RhbmNlcyByZXByZXNlbnRpbmcgdmFyaWFibGVzIGFuZCByZWZlcmVuY2VzIGxvb2sgdmVyeSBzaW1pbGFyIHRvIHByb3BlcnR5IHJlYWRzXG4gICAgICAvLyBvciBtZXRob2QgY2FsbHMgZnJvbSB0aGUgY29tcG9uZW50IGNvbnRleHQ6IGJvdGggaGF2ZSB0aGUgc2hhcGVcbiAgICAgIC8vIFByb3BlcnR5UmVhZChJbXBsaWNpdFJlY2VpdmVyLCAncHJvcE5hbWUnKSBvciBNZXRob2RDYWxsKEltcGxpY2l0UmVjZWl2ZXIsICdtZXRob2ROYW1lJykuXG4gICAgICAvL1xuICAgICAgLy8gYHRyYW5zbGF0ZWAgd2lsbCBmaXJzdCB0cnkgdG8gYHJlc29sdmVgIHRoZSBvdXRlciBQcm9wZXJ0eVJlYWQvTWV0aG9kQ2FsbC4gSWYgdGhpcyB3b3JrcyxcbiAgICAgIC8vIGl0J3MgYmVjYXVzZSB0aGUgYEJvdW5kVGFyZ2V0YCBmb3VuZCBhbiBleHByZXNzaW9uIHRhcmdldCBmb3IgdGhlIHdob2xlIGV4cHJlc3Npb24sIGFuZFxuICAgICAgLy8gdGhlcmVmb3JlIGB0cmFuc2xhdGVgIHdpbGwgbmV2ZXIgYXR0ZW1wdCB0byBgcmVzb2x2ZWAgdGhlIEltcGxpY2l0UmVjZWl2ZXIgb2YgdGhhdFxuICAgICAgLy8gUHJvcGVydHlSZWFkL01ldGhvZENhbGwuXG4gICAgICAvL1xuICAgICAgLy8gVGhlcmVmb3JlIGlmIGByZXNvbHZlYCBpcyBjYWxsZWQgb24gYW4gYEltcGxpY2l0UmVjZWl2ZXJgLCBpdCdzIGJlY2F1c2Ugbm8gb3V0ZXJcbiAgICAgIC8vIFByb3BlcnR5UmVhZC9NZXRob2RDYWxsIHJlc29sdmVkIHRvIGEgdmFyaWFibGUgb3IgcmVmZXJlbmNlLCBhbmQgdGhlcmVmb3JlIHRoaXMgaXMgYVxuICAgICAgLy8gcHJvcGVydHkgcmVhZCBvciBtZXRob2QgY2FsbCBvbiB0aGUgY29tcG9uZW50IGNvbnRleHQgaXRzZWxmLlxuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ2N0eCcpO1xuICAgIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgQmluZGluZ1BpcGUpIHtcbiAgICAgIGNvbnN0IGV4cHIgPSB0aGlzLnRyYW5zbGF0ZShhc3QuZXhwKTtcbiAgICAgIGNvbnN0IHBpcGVSZWYgPSB0aGlzLnRjYi5nZXRQaXBlQnlOYW1lKGFzdC5uYW1lKTtcbiAgICAgIGxldCBwaXBlOiB0cy5FeHByZXNzaW9ufG51bGw7XG4gICAgICBpZiAocGlwZVJlZiA9PT0gbnVsbCkge1xuICAgICAgICAvLyBObyBwaXBlIGJ5IHRoYXQgbmFtZSBleGlzdHMgaW4gc2NvcGUuIFJlY29yZCB0aGlzIGFzIGFuIGVycm9yLlxuICAgICAgICB0aGlzLnRjYi5vb2JSZWNvcmRlci5taXNzaW5nUGlwZSh0aGlzLnRjYi5pZCwgYXN0KTtcblxuICAgICAgICAvLyBVc2UgYW4gJ2FueScgdmFsdWUgdG8gYXQgbGVhc3QgYWxsb3cgdGhlIHJlc3Qgb2YgdGhlIGV4cHJlc3Npb24gdG8gYmUgY2hlY2tlZC5cbiAgICAgICAgcGlwZSA9IE5VTExfQVNfQU5ZO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVXNlIGEgdmFyaWFibGUgZGVjbGFyZWQgYXMgdGhlIHBpcGUncyB0eXBlLlxuICAgICAgICBwaXBlID0gdGhpcy50Y2IuZW52LnBpcGVJbnN0KHBpcGVSZWYpO1xuICAgICAgfVxuICAgICAgY29uc3QgYXJncyA9IGFzdC5hcmdzLm1hcChhcmcgPT4gdGhpcy50cmFuc2xhdGUoYXJnKSk7XG4gICAgICBsZXQgbWV0aG9kQWNjZXNzOiB0cy5FeHByZXNzaW9uID1cbiAgICAgICAgICB0cy5mYWN0b3J5LmNyZWF0ZVByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihwaXBlLCAndHJhbnNmb3JtJyk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKG1ldGhvZEFjY2VzcywgYXN0Lm5hbWVTcGFuKTtcbiAgICAgIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZlBpcGVzKSB7XG4gICAgICAgIG1ldGhvZEFjY2VzcyA9IHRzLmZhY3RvcnkuY3JlYXRlQXNFeHByZXNzaW9uKFxuICAgICAgICAgICAgbWV0aG9kQWNjZXNzLCB0cy5mYWN0b3J5LmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0ID0gdHMuY3JlYXRlQ2FsbChcbiAgICAgICAgICAvKiBleHByZXNzaW9uICovIG1ldGhvZEFjY2VzcyxcbiAgICAgICAgICAvKiB0eXBlQXJndW1lbnRzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAvKiBhcmd1bWVudHNBcnJheSAqL1tleHByLCAuLi5hcmdzXSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKHJlc3VsdCwgYXN0LnNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBhc3QgaW5zdGFuY2VvZiBNZXRob2RDYWxsICYmIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiZcbiAgICAgICAgIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBUaGlzUmVjZWl2ZXIpKSB7XG4gICAgICAvLyBSZXNvbHZlIHRoZSBzcGVjaWFsIGAkYW55KGV4cHIpYCBzeW50YXggdG8gaW5zZXJ0IGEgY2FzdCBvZiB0aGUgYXJndW1lbnQgdG8gdHlwZSBgYW55YC5cbiAgICAgIC8vIGAkYW55KGV4cHIpYCAtPiBgZXhwciBhcyBhbnlgXG4gICAgICBpZiAoYXN0Lm5hbWUgPT09ICckYW55JyAmJiBhc3QuYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3QgZXhwciA9IHRoaXMudHJhbnNsYXRlKGFzdC5hcmdzWzBdKTtcbiAgICAgICAgY29uc3QgZXhwckFzQW55ID1cbiAgICAgICAgICAgIHRzLmNyZWF0ZUFzRXhwcmVzc2lvbihleHByLCB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5BbnlLZXl3b3JkKSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRzLmNyZWF0ZVBhcmVuKGV4cHJBc0FueSk7XG4gICAgICAgIGFkZFBhcnNlU3BhbkluZm8ocmVzdWx0LCBhc3Quc291cmNlU3Bhbik7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIC8vIEF0dGVtcHQgdG8gcmVzb2x2ZSBhIGJvdW5kIHRhcmdldCBmb3IgdGhlIG1ldGhvZCwgYW5kIGdlbmVyYXRlIHRoZSBtZXRob2QgY2FsbCBpZiBhIHRhcmdldFxuICAgICAgLy8gY291bGQgYmUgcmVzb2x2ZWQuIElmIG5vIHRhcmdldCBpcyBhdmFpbGFibGUsIHRoZW4gdGhlIG1ldGhvZCBpcyByZWZlcmVuY2luZyB0aGUgdG9wLWxldmVsXG4gICAgICAvLyBjb21wb25lbnQgY29udGV4dCwgaW4gd2hpY2ggY2FzZSBgbnVsbGAgaXMgcmV0dXJuZWQgdG8gbGV0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAgYmVpbmdcbiAgICAgIC8vIHJlc29sdmVkIHRvIHRoZSBjb21wb25lbnQgY29udGV4dC5cbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5yZXNvbHZlVGFyZ2V0KGFzdCk7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1ldGhvZCA9IHdyYXBGb3JEaWFnbm9zdGljcyhyZWNlaXZlcik7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKG1ldGhvZCwgYXN0Lm5hbWVTcGFuKTtcbiAgICAgIGNvbnN0IGFyZ3MgPSBhc3QuYXJncy5tYXAoYXJnID0+IHRoaXMudHJhbnNsYXRlKGFyZykpO1xuICAgICAgY29uc3Qgbm9kZSA9IHRzLmNyZWF0ZUNhbGwobWV0aG9kLCB1bmRlZmluZWQsIGFyZ3MpO1xuICAgICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhpcyBBU1QgaXNuJ3Qgc3BlY2lhbCBhZnRlciBhbGwuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXR0ZW1wdHMgdG8gcmVzb2x2ZSBhIGJvdW5kIHRhcmdldCBmb3IgYSBnaXZlbiBleHByZXNzaW9uLCBhbmQgdHJhbnNsYXRlcyBpdCBpbnRvIHRoZVxuICAgKiBhcHByb3ByaWF0ZSBgdHMuRXhwcmVzc2lvbmAgdGhhdCByZXByZXNlbnRzIHRoZSBib3VuZCB0YXJnZXQuIElmIG5vIHRhcmdldCBpcyBhdmFpbGFibGUsXG4gICAqIGBudWxsYCBpcyByZXR1cm5lZC5cbiAgICovXG4gIHByb3RlY3RlZCByZXNvbHZlVGFyZ2V0KGFzdDogQVNUKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBjb25zdCBiaW5kaW5nID0gdGhpcy50Y2IuYm91bmRUYXJnZXQuZ2V0RXhwcmVzc2lvblRhcmdldChhc3QpO1xuICAgIGlmIChiaW5kaW5nID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBleHByID0gdGhpcy5zY29wZS5yZXNvbHZlKGJpbmRpbmcpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8oZXhwciwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbi8qKlxuICogQ2FsbCB0aGUgdHlwZSBjb25zdHJ1Y3RvciBvZiBhIGRpcmVjdGl2ZSBpbnN0YW5jZSBvbiBhIGdpdmVuIHRlbXBsYXRlIG5vZGUsIGluZmVycmluZyBhIHR5cGUgZm9yXG4gKiB0aGUgZGlyZWN0aXZlIGluc3RhbmNlIGZyb20gYW55IGJvdW5kIGlucHV0cy5cbiAqL1xuZnVuY3Rpb24gdGNiQ2FsbFR5cGVDdG9yKFxuICAgIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEsIHRjYjogQ29udGV4dCwgaW5wdXRzOiBUY2JEaXJlY3RpdmVJbnB1dFtdKTogdHMuRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHR5cGVDdG9yID0gdGNiLmVudi50eXBlQ3RvckZvcihkaXIpO1xuXG4gIC8vIENvbnN0cnVjdCBhbiBhcnJheSBvZiBgdHMuUHJvcGVydHlBc3NpZ25tZW50YHMgZm9yIGVhY2ggb2YgdGhlIGRpcmVjdGl2ZSdzIGlucHV0cy5cbiAgY29uc3QgbWVtYmVycyA9IGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoaW5wdXQuZmllbGQpO1xuXG4gICAgaWYgKGlucHV0LnR5cGUgPT09ICdiaW5kaW5nJykge1xuICAgICAgLy8gRm9yIGJvdW5kIGlucHV0cywgdGhlIHByb3BlcnR5IGlzIGFzc2lnbmVkIHRoZSBiaW5kaW5nIGV4cHJlc3Npb24uXG4gICAgICBsZXQgZXhwciA9IGlucHV0LmV4cHJlc3Npb247XG4gICAgICBpZiAoIXRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBjaGVja2luZyB0aGUgdHlwZSBvZiBiaW5kaW5ncyBpcyBkaXNhYmxlZCwgY2FzdCB0aGUgcmVzdWx0aW5nIGV4cHJlc3Npb24gdG8gJ2FueSdcbiAgICAgICAgLy8gYmVmb3JlIHRoZSBhc3NpZ25tZW50LlxuICAgICAgICBleHByID0gdHNDYXN0VG9BbnkoZXhwcik7XG4gICAgICB9IGVsc2UgaWYgKCF0Y2IuZW52LmNvbmZpZy5zdHJpY3ROdWxsSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBzdHJpY3QgbnVsbCBjaGVja3MgYXJlIGRpc2FibGVkLCBlcmFzZSBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIGZyb20gdGhlIHR5cGUgYnlcbiAgICAgICAgLy8gd3JhcHBpbmcgdGhlIGV4cHJlc3Npb24gaW4gYSBub24tbnVsbCBhc3NlcnRpb24uXG4gICAgICAgIGV4cHIgPSB0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihleHByKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYXNzaWdubWVudCA9IHRzLmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudChwcm9wZXJ0eU5hbWUsIHdyYXBGb3JEaWFnbm9zdGljcyhleHByKSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKGFzc2lnbm1lbnQsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzc2lnbm1lbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEEgdHlwZSBjb25zdHJ1Y3RvciBpcyByZXF1aXJlZCB0byBiZSBjYWxsZWQgd2l0aCBhbGwgaW5wdXQgcHJvcGVydGllcywgc28gYW55IHVuc2V0XG4gICAgICAvLyBpbnB1dHMgYXJlIHNpbXBseSBhc3NpZ25lZCBhIHZhbHVlIG9mIHR5cGUgYGFueWAgdG8gaWdub3JlIHRoZW0uXG4gICAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KHByb3BlcnR5TmFtZSwgTlVMTF9BU19BTlkpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQ2FsbCB0aGUgYG5nVHlwZUN0b3JgIG1ldGhvZCBvbiB0aGUgZGlyZWN0aXZlIGNsYXNzLCB3aXRoIGFuIG9iamVjdCBsaXRlcmFsIGFyZ3VtZW50IGNyZWF0ZWRcbiAgLy8gZnJvbSB0aGUgbWF0Y2hlZCBpbnB1dHMuXG4gIHJldHVybiB0cy5jcmVhdGVDYWxsKFxuICAgICAgLyogZXhwcmVzc2lvbiAqLyB0eXBlQ3RvcixcbiAgICAgIC8qIHR5cGVBcmd1bWVudHMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogYXJndW1lbnRzQXJyYXkgKi9bdHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChtZW1iZXJzKV0pO1xufVxuXG5mdW5jdGlvbiBnZXRCb3VuZElucHV0cyhcbiAgICBkaXJlY3RpdmU6IFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgdGNiOiBDb250ZXh0KTogVGNiQm91bmRJbnB1dFtdIHtcbiAgY29uc3QgYm91bmRJbnB1dHM6IFRjYkJvdW5kSW5wdXRbXSA9IFtdO1xuXG4gIGNvbnN0IHByb2Nlc3NBdHRyaWJ1dGUgPSAoYXR0cjogVG1wbEFzdEJvdW5kQXR0cmlidXRlfFRtcGxBc3RUZXh0QXR0cmlidXRlKSA9PiB7XG4gICAgLy8gU2tpcCBub24tcHJvcGVydHkgYmluZGluZ3MuXG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUgJiYgYXR0ci50eXBlICE9PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNraXAgdGhlIGF0dHJpYnV0ZSBpZiB0aGUgZGlyZWN0aXZlIGRvZXMgbm90IGhhdmUgYW4gaW5wdXQgZm9yIGl0LlxuICAgIGNvbnN0IGlucHV0cyA9IGRpcmVjdGl2ZS5pbnB1dHMuZ2V0QnlCaW5kaW5nUHJvcGVydHlOYW1lKGF0dHIubmFtZSk7XG4gICAgaWYgKGlucHV0cyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBmaWVsZE5hbWVzID0gaW5wdXRzLm1hcChpbnB1dCA9PiBpbnB1dC5jbGFzc1Byb3BlcnR5TmFtZSk7XG4gICAgYm91bmRJbnB1dHMucHVzaCh7YXR0cmlidXRlOiBhdHRyLCBmaWVsZE5hbWVzfSk7XG4gIH07XG5cbiAgbm9kZS5pbnB1dHMuZm9yRWFjaChwcm9jZXNzQXR0cmlidXRlKTtcbiAgbm9kZS5hdHRyaWJ1dGVzLmZvckVhY2gocHJvY2Vzc0F0dHJpYnV0ZSk7XG4gIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlKSB7XG4gICAgbm9kZS50ZW1wbGF0ZUF0dHJzLmZvckVhY2gocHJvY2Vzc0F0dHJpYnV0ZSk7XG4gIH1cblxuICByZXR1cm4gYm91bmRJbnB1dHM7XG59XG5cbi8qKlxuICogVHJhbnNsYXRlcyB0aGUgZ2l2ZW4gYXR0cmlidXRlIGJpbmRpbmcgdG8gYSBgdHMuRXhwcmVzc2lvbmAuXG4gKi9cbmZ1bmN0aW9uIHRyYW5zbGF0ZUlucHV0KFxuICAgIGF0dHI6IFRtcGxBc3RCb3VuZEF0dHJpYnV0ZXxUbXBsQXN0VGV4dEF0dHJpYnV0ZSwgdGNiOiBDb250ZXh0LCBzY29wZTogU2NvcGUpOiB0cy5FeHByZXNzaW9uIHtcbiAgaWYgKGF0dHIgaW5zdGFuY2VvZiBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUpIHtcbiAgICAvLyBQcm9kdWNlIGFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSB2YWx1ZSBvZiB0aGUgYmluZGluZy5cbiAgICByZXR1cm4gdGNiRXhwcmVzc2lvbihhdHRyLnZhbHVlLCB0Y2IsIHNjb3BlKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBGb3IgcmVndWxhciBhdHRyaWJ1dGVzIHdpdGggYSBzdGF0aWMgc3RyaW5nIHZhbHVlLCB1c2UgdGhlIHJlcHJlc2VudGVkIHN0cmluZyBsaXRlcmFsLlxuICAgIHJldHVybiB0cy5jcmVhdGVTdHJpbmdMaXRlcmFsKGF0dHIudmFsdWUpO1xuICB9XG59XG5cbi8qKlxuICogQW4gaW5wdXQgYmluZGluZyB0aGF0IGNvcnJlc3BvbmRzIHdpdGggYSBmaWVsZCBvZiBhIGRpcmVjdGl2ZS5cbiAqL1xuaW50ZXJmYWNlIFRjYkRpcmVjdGl2ZUJvdW5kSW5wdXQge1xuICB0eXBlOiAnYmluZGluZyc7XG5cbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIGEgZmllbGQgb24gdGhlIGRpcmVjdGl2ZSB0aGF0IGlzIHNldC5cbiAgICovXG4gIGZpZWxkOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoZSBgdHMuRXhwcmVzc2lvbmAgY29ycmVzcG9uZGluZyB3aXRoIHRoZSBpbnB1dCBiaW5kaW5nIGV4cHJlc3Npb24uXG4gICAqL1xuICBleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgc291cmNlIHNwYW4gb2YgdGhlIGZ1bGwgYXR0cmlidXRlIGJpbmRpbmcuXG4gICAqL1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogSW5kaWNhdGVzIHRoYXQgYSBjZXJ0YWluIGZpZWxkIG9mIGEgZGlyZWN0aXZlIGRvZXMgbm90IGhhdmUgYSBjb3JyZXNwb25kaW5nIGlucHV0IGJpbmRpbmcuXG4gKi9cbmludGVyZmFjZSBUY2JEaXJlY3RpdmVVbnNldElucHV0IHtcbiAgdHlwZTogJ3Vuc2V0JztcblxuICAvKipcbiAgICogVGhlIG5hbWUgb2YgYSBmaWVsZCBvbiB0aGUgZGlyZWN0aXZlIGZvciB3aGljaCBubyBpbnB1dCBiaW5kaW5nIGlzIHByZXNlbnQuXG4gICAqL1xuICBmaWVsZDogc3RyaW5nO1xufVxuXG50eXBlIFRjYkRpcmVjdGl2ZUlucHV0ID0gVGNiRGlyZWN0aXZlQm91bmRJbnB1dHxUY2JEaXJlY3RpdmVVbnNldElucHV0O1xuXG5jb25zdCBFVkVOVF9QQVJBTUVURVIgPSAnJGV2ZW50JztcblxuY29uc3QgZW51bSBFdmVudFBhcmFtVHlwZSB7XG4gIC8qIEdlbmVyYXRlcyBjb2RlIHRvIGluZmVyIHRoZSB0eXBlIG9mIGAkZXZlbnRgIGJhc2VkIG9uIGhvdyB0aGUgbGlzdGVuZXIgaXMgcmVnaXN0ZXJlZC4gKi9cbiAgSW5mZXIsXG5cbiAgLyogRGVjbGFyZXMgdGhlIHR5cGUgb2YgdGhlIGAkZXZlbnRgIHBhcmFtZXRlciBhcyBgYW55YC4gKi9cbiAgQW55LFxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyb3cgZnVuY3Rpb24gdG8gYmUgdXNlZCBhcyBoYW5kbGVyIGZ1bmN0aW9uIGZvciBldmVudCBiaW5kaW5ncy4gVGhlIGhhbmRsZXJcbiAqIGZ1bmN0aW9uIGhhcyBhIHNpbmdsZSBwYXJhbWV0ZXIgYCRldmVudGAgYW5kIHRoZSBib3VuZCBldmVudCdzIGhhbmRsZXIgYEFTVGAgcmVwcmVzZW50ZWQgYXMgYVxuICogVHlwZVNjcmlwdCBleHByZXNzaW9uIGFzIGl0cyBib2R5LlxuICpcbiAqIFdoZW4gYGV2ZW50VHlwZWAgaXMgc2V0IHRvIGBJbmZlcmAsIHRoZSBgJGV2ZW50YCBwYXJhbWV0ZXIgd2lsbCBub3QgaGF2ZSBhbiBleHBsaWNpdCB0eXBlLiBUaGlzXG4gKiBhbGxvd3MgZm9yIHRoZSBjcmVhdGVkIGhhbmRsZXIgZnVuY3Rpb24gdG8gaGF2ZSBpdHMgYCRldmVudGAgcGFyYW1ldGVyJ3MgdHlwZSBpbmZlcnJlZCBiYXNlZCBvblxuICogaG93IGl0J3MgdXNlZCwgdG8gZW5hYmxlIHN0cmljdCB0eXBlIGNoZWNraW5nIG9mIGV2ZW50IGJpbmRpbmdzLiBXaGVuIHNldCB0byBgQW55YCwgdGhlIGAkZXZlbnRgXG4gKiBwYXJhbWV0ZXIgd2lsbCBoYXZlIGFuIGV4cGxpY2l0IGBhbnlgIHR5cGUsIGVmZmVjdGl2ZWx5IGRpc2FibGluZyBzdHJpY3QgdHlwZSBjaGVja2luZyBvZiBldmVudFxuICogYmluZGluZ3MuIEFsdGVybmF0aXZlbHksIGFuIGV4cGxpY2l0IHR5cGUgY2FuIGJlIHBhc3NlZCBmb3IgdGhlIGAkZXZlbnRgIHBhcmFtZXRlci5cbiAqL1xuZnVuY3Rpb24gdGNiQ3JlYXRlRXZlbnRIYW5kbGVyKFxuICAgIGV2ZW50OiBUbXBsQXN0Qm91bmRFdmVudCwgdGNiOiBDb250ZXh0LCBzY29wZTogU2NvcGUsXG4gICAgZXZlbnRUeXBlOiBFdmVudFBhcmFtVHlwZXx0cy5UeXBlTm9kZSk6IHRzLkV4cHJlc3Npb24ge1xuICBjb25zdCBoYW5kbGVyID0gdGNiRXZlbnRIYW5kbGVyRXhwcmVzc2lvbihldmVudC5oYW5kbGVyLCB0Y2IsIHNjb3BlKTtcblxuICBsZXQgZXZlbnRQYXJhbVR5cGU6IHRzLlR5cGVOb2RlfHVuZGVmaW5lZDtcbiAgaWYgKGV2ZW50VHlwZSA9PT0gRXZlbnRQYXJhbVR5cGUuSW5mZXIpIHtcbiAgICBldmVudFBhcmFtVHlwZSA9IHVuZGVmaW5lZDtcbiAgfSBlbHNlIGlmIChldmVudFR5cGUgPT09IEV2ZW50UGFyYW1UeXBlLkFueSkge1xuICAgIGV2ZW50UGFyYW1UeXBlID0gdHMuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuQW55S2V5d29yZCk7XG4gIH0gZWxzZSB7XG4gICAgZXZlbnRQYXJhbVR5cGUgPSBldmVudFR5cGU7XG4gIH1cblxuICAvLyBPYnRhaW4gYWxsIGd1YXJkcyB0aGF0IGhhdmUgYmVlbiBhcHBsaWVkIHRvIHRoZSBzY29wZSBhbmQgaXRzIHBhcmVudHMsIGFzIHRoZXkgaGF2ZSB0byBiZVxuICAvLyByZXBlYXRlZCB3aXRoaW4gdGhlIGhhbmRsZXIgZnVuY3Rpb24gZm9yIHRoZWlyIG5hcnJvd2luZyB0byBiZSBpbiBlZmZlY3Qgd2l0aGluIHRoZSBoYW5kbGVyLlxuICBjb25zdCBndWFyZHMgPSBzY29wZS5ndWFyZHMoKTtcblxuICBsZXQgYm9keTogdHMuU3RhdGVtZW50ID0gdHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChoYW5kbGVyKTtcbiAgaWYgKGd1YXJkcyAhPT0gbnVsbCkge1xuICAgIC8vIFdyYXAgdGhlIGJvZHkgaW4gYW4gYGlmYCBzdGF0ZW1lbnQgY29udGFpbmluZyBhbGwgZ3VhcmRzIHRoYXQgaGF2ZSB0byBiZSBhcHBsaWVkLlxuICAgIGJvZHkgPSB0cy5jcmVhdGVJZihndWFyZHMsIGJvZHkpO1xuICB9XG5cbiAgY29uc3QgZXZlbnRQYXJhbSA9IHRzLmNyZWF0ZVBhcmFtZXRlcihcbiAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogbW9kaWZpZXJzICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIGRvdERvdERvdFRva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG5hbWUgKi8gRVZFTlRfUEFSQU1FVEVSLFxuICAgICAgLyogcXVlc3Rpb25Ub2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAvKiB0eXBlICovIGV2ZW50UGFyYW1UeXBlKTtcbiAgYWRkRXhwcmVzc2lvbklkZW50aWZpZXIoZXZlbnRQYXJhbSwgRXhwcmVzc2lvbklkZW50aWZpZXIuRVZFTlRfUEFSQU1FVEVSKTtcblxuICByZXR1cm4gdHMuY3JlYXRlRnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgLyogbW9kaWZpZXIgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogYXN0ZXJpc2tUb2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBuYW1lICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIHBhcmFtZXRlcnMgKi9bZXZlbnRQYXJhbV0sXG4gICAgICAvKiB0eXBlICovIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpLFxuICAgICAgLyogYm9keSAqLyB0cy5jcmVhdGVCbG9jayhbYm9keV0pKTtcbn1cblxuLyoqXG4gKiBTaW1pbGFyIHRvIGB0Y2JFeHByZXNzaW9uYCwgdGhpcyBmdW5jdGlvbiBjb252ZXJ0cyB0aGUgcHJvdmlkZWQgYEFTVGAgZXhwcmVzc2lvbiBpbnRvIGFcbiAqIGB0cy5FeHByZXNzaW9uYCwgd2l0aCBzcGVjaWFsIGhhbmRsaW5nIG9mIHRoZSBgJGV2ZW50YCB2YXJpYWJsZSB0aGF0IGNhbiBiZSB1c2VkIHdpdGhpbiBldmVudFxuICogYmluZGluZ3MuXG4gKi9cbmZ1bmN0aW9uIHRjYkV2ZW50SGFuZGxlckV4cHJlc3Npb24oYXN0OiBBU1QsIHRjYjogQ29udGV4dCwgc2NvcGU6IFNjb3BlKTogdHMuRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHRyYW5zbGF0b3IgPSBuZXcgVGNiRXZlbnRIYW5kbGVyVHJhbnNsYXRvcih0Y2IsIHNjb3BlKTtcbiAgcmV0dXJuIHRyYW5zbGF0b3IudHJhbnNsYXRlKGFzdCk7XG59XG5cbmNsYXNzIFRjYkV2ZW50SGFuZGxlclRyYW5zbGF0b3IgZXh0ZW5kcyBUY2JFeHByZXNzaW9uVHJhbnNsYXRvciB7XG4gIHByb3RlY3RlZCByZXNvbHZlKGFzdDogQVNUKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICAvLyBSZWNvZ25pemUgYSBwcm9wZXJ0eSByZWFkIG9uIHRoZSBpbXBsaWNpdCByZWNlaXZlciBjb3JyZXNwb25kaW5nIHdpdGggdGhlIGV2ZW50IHBhcmFtZXRlclxuICAgIC8vIHRoYXQgaXMgYXZhaWxhYmxlIGluIGV2ZW50IGJpbmRpbmdzLiBTaW5jZSB0aGlzIHZhcmlhYmxlIGlzIGEgcGFyYW1ldGVyIG9mIHRoZSBoYW5kbGVyXG4gICAgLy8gZnVuY3Rpb24gdGhhdCB0aGUgY29udmVydGVkIGV4cHJlc3Npb24gYmVjb21lcyBhIGNoaWxkIG9mLCBqdXN0IGNyZWF0ZSBhIHJlZmVyZW5jZSB0byB0aGVcbiAgICAvLyBwYXJhbWV0ZXIgYnkgaXRzIG5hbWUuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmXG4gICAgICAgICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgVGhpc1JlY2VpdmVyKSAmJiBhc3QubmFtZSA9PT0gRVZFTlRfUEFSQU1FVEVSKSB7XG4gICAgICBjb25zdCBldmVudCA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoRVZFTlRfUEFSQU1FVEVSKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8oZXZlbnQsIGFzdC5uYW1lU3Bhbik7XG4gICAgICByZXR1cm4gZXZlbnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyLnJlc29sdmUoYXN0KTtcbiAgfVxufVxuIl19