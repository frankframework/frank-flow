/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { checkIfGenericTypeBoundsAreContextFree } from './tcb_util';
import { tsCreateTypeQueryForCoercedInput } from './ts_util';
export function generateTypeCtorDeclarationFn(node, meta, nodeTypeRef, typeParams, reflector) {
    if (requiresInlineTypeCtor(node, reflector)) {
        throw new Error(`${node.name.text} requires an inline type constructor`);
    }
    const rawTypeArgs = typeParams !== undefined ? generateGenericArgs(typeParams) : undefined;
    const rawType = ts.createTypeReferenceNode(nodeTypeRef, rawTypeArgs);
    const initParam = constructTypeCtorParameter(node, meta, rawType);
    const typeParameters = typeParametersWithDefaultTypes(typeParams);
    if (meta.body) {
        const fnType = ts.createFunctionTypeNode(
        /* typeParameters */ typeParameters, 
        /* parameters */ [initParam], 
        /* type */ rawType);
        const decl = ts.createVariableDeclaration(
        /* name */ meta.fnName, 
        /* type */ fnType, 
        /* body */ ts.createNonNullExpression(ts.createNull()));
        const declList = ts.createVariableDeclarationList([decl], ts.NodeFlags.Const);
        return ts.createVariableStatement(
        /* modifiers */ undefined, 
        /* declarationList */ declList);
    }
    else {
        return ts.createFunctionDeclaration(
        /* decorators */ undefined, 
        /* modifiers */ [ts.createModifier(ts.SyntaxKind.DeclareKeyword)], 
        /* asteriskToken */ undefined, 
        /* name */ meta.fnName, 
        /* typeParameters */ typeParameters, 
        /* parameters */ [initParam], 
        /* type */ rawType, 
        /* body */ undefined);
    }
}
/**
 * Generate an inline type constructor for the given class and metadata.
 *
 * An inline type constructor is a specially shaped TypeScript static method, intended to be placed
 * within a directive class itself, that permits type inference of any generic type parameters of
 * the class from the types of expressions bound to inputs or outputs, and the types of elements
 * that match queries performed by the directive. It also catches any errors in the types of these
 * expressions. This method is never called at runtime, but is used in type-check blocks to
 * construct directive types.
 *
 * An inline type constructor for NgFor looks like:
 *
 * static ngTypeCtor<T>(init: Pick<NgForOf<T>, 'ngForOf'|'ngForTrackBy'|'ngForTemplate'>):
 *   NgForOf<T>;
 *
 * A typical constructor would be:
 *
 * NgForOf.ngTypeCtor(init: {
 *   ngForOf: ['foo', 'bar'],
 *   ngForTrackBy: null as any,
 *   ngForTemplate: null as any,
 * }); // Infers a type of NgForOf<string>.
 *
 * Any inputs declared on the type for which no property binding is present are assigned a value of
 * type `any`, to avoid producing any type errors for unset inputs.
 *
 * Inline type constructors are used when the type being created has bounded generic types which
 * make writing a declared type constructor (via `generateTypeCtorDeclarationFn`) difficult or
 * impossible.
 *
 * @param node the `ClassDeclaration<ts.ClassDeclaration>` for which a type constructor will be
 * generated.
 * @param meta additional metadata required to generate the type constructor.
 * @returns a `ts.MethodDeclaration` for the type constructor.
 */
export function generateInlineTypeCtor(node, meta) {
    // Build rawType, a `ts.TypeNode` of the class with its generic parameters passed through from
    // the definition without any type bounds. For example, if the class is
    // `FooDirective<T extends Bar>`, its rawType would be `FooDirective<T>`.
    const rawTypeArgs = node.typeParameters !== undefined ? generateGenericArgs(node.typeParameters) : undefined;
    const rawType = ts.createTypeReferenceNode(node.name, rawTypeArgs);
    const initParam = constructTypeCtorParameter(node, meta, rawType);
    // If this constructor is being generated into a .ts file, then it needs a fake body. The body
    // is set to a return of `null!`. If the type constructor is being generated into a .d.ts file,
    // it needs no body.
    let body = undefined;
    if (meta.body) {
        body = ts.createBlock([
            ts.createReturn(ts.createNonNullExpression(ts.createNull())),
        ]);
    }
    // Create the type constructor method declaration.
    return ts.createMethod(
    /* decorators */ undefined, 
    /* modifiers */ [ts.createModifier(ts.SyntaxKind.StaticKeyword)], 
    /* asteriskToken */ undefined, 
    /* name */ meta.fnName, 
    /* questionToken */ undefined, 
    /* typeParameters */ typeParametersWithDefaultTypes(node.typeParameters), 
    /* parameters */ [initParam], 
    /* type */ rawType, 
    /* body */ body);
}
function constructTypeCtorParameter(node, meta, rawType) {
    // initType is the type of 'init', the single argument to the type constructor method.
    // If the Directive has any inputs, its initType will be:
    //
    // Pick<rawType, 'inputA'|'inputB'>
    //
    // Pick here is used to select only those fields from which the generic type parameters of the
    // directive will be inferred.
    //
    // In the special case there are no inputs, initType is set to {}.
    let initType = null;
    const keys = meta.fields.inputs;
    const plainKeys = [];
    const coercedKeys = [];
    for (const key of keys) {
        if (!meta.coercedInputFields.has(key)) {
            plainKeys.push(ts.createLiteralTypeNode(ts.createStringLiteral(key)));
        }
        else {
            coercedKeys.push(ts.createPropertySignature(
            /* modifiers */ undefined, 
            /* name */ key, 
            /* questionToken */ undefined, 
            /* type */ tsCreateTypeQueryForCoercedInput(rawType.typeName, key), 
            /* initializer */ undefined));
        }
    }
    if (plainKeys.length > 0) {
        // Construct a union of all the field names.
        const keyTypeUnion = ts.createUnionTypeNode(plainKeys);
        // Construct the Pick<rawType, keyTypeUnion>.
        initType = ts.createTypeReferenceNode('Pick', [rawType, keyTypeUnion]);
    }
    if (coercedKeys.length > 0) {
        const coercedLiteral = ts.createTypeLiteralNode(coercedKeys);
        initType = initType !== null ? ts.createIntersectionTypeNode([initType, coercedLiteral]) :
            coercedLiteral;
    }
    if (initType === null) {
        // Special case - no inputs, outputs, or other fields which could influence the result type.
        initType = ts.createTypeLiteralNode([]);
    }
    // Create the 'init' parameter itself.
    return ts.createParameter(
    /* decorators */ undefined, 
    /* modifiers */ undefined, 
    /* dotDotDotToken */ undefined, 
    /* name */ 'init', 
    /* questionToken */ undefined, 
    /* type */ initType, 
    /* initializer */ undefined);
}
function generateGenericArgs(params) {
    return params.map(param => ts.createTypeReferenceNode(param.name, undefined));
}
export function requiresInlineTypeCtor(node, host) {
    // The class requires an inline type constructor if it has generic type bounds that can not be
    // emitted into a different context.
    return !checkIfGenericTypeBoundsAreContextFree(node, host);
}
/**
 * Add a default `= any` to type parameters that don't have a default value already.
 *
 * TypeScript uses the default type of a type parameter whenever inference of that parameter fails.
 * This can happen when inferring a complex type from 'any'. For example, if `NgFor`'s inference is
 * done with the TCB code:
 *
 * ```
 * class NgFor<T> {
 *   ngForOf: T[];
 * }
 *
 * declare function ctor<T>(o: Pick<NgFor<T>, 'ngForOf'|'ngForTrackBy'|'ngForTemplate'>): NgFor<T>;
 * ```
 *
 * An invocation looks like:
 *
 * ```
 * var _t1 = ctor({ngForOf: [1, 2], ngForTrackBy: null as any, ngForTemplate: null as any});
 * ```
 *
 * This correctly infers the type `NgFor<number>` for `_t1`, since `T` is inferred from the
 * assignment of type `number[]` to `ngForOf`'s type `T[]`. However, if `any` is passed instead:
 *
 * ```
 * var _t2 = ctor({ngForOf: [1, 2] as any, ngForTrackBy: null as any, ngForTemplate: null as any});
 * ```
 *
 * then inference for `T` fails (it cannot be inferred from `T[] = any`). In this case, `T` takes
 * the type `{}`, and so `_t2` is inferred as `NgFor<{}>`. This is obviously wrong.
 *
 * Adding a default type to the generic declaration in the constructor solves this problem, as the
 * default type will be used in the event that inference fails.
 *
 * ```
 * declare function ctor<T = any>(o: Pick<NgFor<T>, 'ngForOf'>): NgFor<T>;
 *
 * var _t3 = ctor({ngForOf: [1, 2] as any});
 * ```
 *
 * This correctly infers `T` as `any`, and therefore `_t3` as `NgFor<any>`.
 */
function typeParametersWithDefaultTypes(params) {
    if (params === undefined) {
        return undefined;
    }
    return params.map(param => {
        if (param.default === undefined) {
            return ts.updateTypeParameterDeclaration(
            /* node */ param, 
            /* name */ param.name, 
            /* constraint */ param.constraint, 
            /* defaultType */ ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
        }
        else {
            return param;
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jb25zdHJ1Y3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy90eXBlX2NvbnN0cnVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBSWpDLE9BQU8sRUFBQyxzQ0FBc0MsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUVsRSxPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFM0QsTUFBTSxVQUFVLDZCQUE2QixDQUN6QyxJQUEyQyxFQUFFLElBQXNCLEVBQUUsV0FBMEIsRUFDL0YsVUFBbUQsRUFBRSxTQUF5QjtJQUNoRixJQUFJLHNCQUFzQixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsRUFBRTtRQUMzQyxNQUFNLElBQUksS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLHNDQUFzQyxDQUFDLENBQUM7S0FDMUU7SUFFRCxNQUFNLFdBQVcsR0FBRyxVQUFVLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzNGLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFckUsTUFBTSxTQUFTLEdBQUcsMEJBQTBCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVsRSxNQUFNLGNBQWMsR0FBRyw4QkFBOEIsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUVsRSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDYixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsc0JBQXNCO1FBQ3BDLG9CQUFvQixDQUFDLGNB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TyxTQUFTLENBQUM7S0FDbEI7SUFFRCxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDeEIsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRTtZQUMvQixPQUFPLEVBQUUsQ0FBQyw4QkFBOEI7WUFDcEMsVUFBVSxDQUFDLEtBQUs7WUFDaEIsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJO1lBQ3JCLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVO1lBQ2pDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7U0FDM0U7YUFBTTtZQUNMLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7SUFDSCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbiwgUmVmbGVjdGlvbkhvc3R9IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtUeXBlQ3Rvck1ldGFkYXRhfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHtjaGVja0lmR2VuZXJpY1R5cGVCb3VuZHNBcmVDb250ZXh0RnJlZX0gZnJvbSAnLi90Y2JfdXRpbCc7XG5cbmltcG9ydCB7dHNDcmVhdGVUeXBlUXVlcnlGb3JDb2VyY2VkSW5wdXR9IGZyb20gJy4vdHNfdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVR5cGVDdG9yRGVjbGFyYXRpb25GbihcbiAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+LCBtZXRhOiBUeXBlQ3Rvck1ldGFkYXRhLCBub2RlVHlwZVJlZjogdHMuRW50aXR5TmFtZSxcbiAgICB0eXBlUGFyYW1zOiB0cy5UeXBlUGFyYW1ldGVyRGVjbGFyYXRpb25bXXx1bmRlZmluZWQsIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QpOiB0cy5TdGF0ZW1lbnQge1xuICBpZiAocmVxdWlyZXNJbmxpbmVUeXBlQ3Rvcihub2RlLCByZWZsZWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGAke25vZGUubmFtZS50ZXh0fSByZXF1aXJlcyBhbiBpbmxpbmUgdHlwZSBjb25zdHJ1Y3RvcmApO1xuICB9XG5cbiAgY29uc3QgcmF3VHlwZUFyZ3MgPSB0eXBlUGFyYW1zICE9PSB1bmRlZmluZWQgPyBnZW5lcmF0ZUdlbmVyaWNBcmdzKHR5cGVQYXJhbXMpIDogdW5kZWZpbmVkO1xuICBjb25zdCByYXdUeXBlID0gdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUobm9kZVR5cGVSZWYsIHJhd1R5cGVBcmdzKTtcblxuICBjb25zdCBpbml0UGFyYW0gPSBjb25zdHJ1Y3RUeXBlQ3RvclBhcmFtZXRlcihub2RlLCBtZXRhLCByYXdUeXBlKTtcblxuICBjb25zdCB0eXBlUGFyYW1ldGVycyA9IHR5cGVQYXJhbWV0ZXJzV2l0aERlZmF1bHRUeXBlcyh0eXBlUGFyYW1zKTtcblxuICBpZiAobWV0YS5ib2R5KSB7XG4gICAgY29uc3QgZm5UeXBlID0gdHMuY3JlYXRlRnVuY3Rpb25UeXBlTm9kZShcbiAgICAgICAgLyogdHlwZVBhcmFtZXRlcnMgKi8gdHlwZVBhcmFtZXRlcnMsXG4gICAgICAgIC8qIHBhcmFtZXRlcnMgKi9baW5pdFBhcmFtXSxcbiAgICAgICAgLyogdHlwZSAqLyByYXdUeXBlLFxuICAgICk7XG5cbiAgICBjb25zdCBkZWNsID0gdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgLyogbmFtZSAqLyBtZXRhLmZuTmFtZSxcbiAgICAgICAgLyogdHlwZSAqLyBmblR5cGUsXG4gICAgICAgIC8qIGJvZHkgKi8gdHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24odHMuY3JlYXRlTnVsbCgpKSk7XG4gICAgY29uc3QgZGVjbExpc3QgPSB0cy5jcmVhdGVWYXJpYWJsZURlY2xhcmF0aW9uTGlzdChbZGVjbF0sIHRzLk5vZGVGbGFncy5Db25zdCk7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVZhcmlhYmxlU3RhdGVtZW50KFxuICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAvKiBkZWNsYXJhdGlvbkxpc3QgKi8gZGVjbExpc3QpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0cy5jcmVhdGVGdW5jdGlvbkRlY2xhcmF0aW9uKFxuICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgICAgLyogbW9kaWZpZXJzICovW3RzLmNyZWF0ZU1vZGlmaWVyKHRzLlN5bnRheEtpbmQuRGVjbGFyZUtleXdvcmQpXSxcbiAgICAgICAgLyogYXN0ZXJpc2tUb2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAgIC8qIG5hbWUgKi8gbWV0YS5mbk5hbWUsXG4gICAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIHR5cGVQYXJhbWV0ZXJzLFxuICAgICAgICAvKiBwYXJhbWV0ZXJzICovW2luaXRQYXJhbV0sXG4gICAgICAgIC8qIHR5cGUgKi8gcmF3VHlwZSxcbiAgICAgICAgLyogYm9keSAqLyB1bmRlZmluZWQpO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGUgYW4gaW5saW5lIHR5cGUgY29uc3RydWN0b3IgZm9yIHRoZSBnaXZlbiBjbGFzcyBhbmQgbWV0YWRhdGEuXG4gKlxuICogQW4gaW5saW5lIHR5cGUgY29uc3RydWN0b3IgaXMgYSBzcGVjaWFsbHkgc2hhcGVkIFR5cGVTY3JpcHQgc3RhdGljIG1ldGhvZCwgaW50ZW5kZWQgdG8gYmUgcGxhY2VkXG4gKiB3aXRoaW4gYSBkaXJlY3RpdmUgY2xhc3MgaXRzZWxmLCB0aGF0IHBlcm1pdHMgdHlwZSBpbmZlcmVuY2Ugb2YgYW55IGdlbmVyaWMgdHlwZSBwYXJhbWV0ZXJzIG9mXG4gKiB0aGUgY2xhc3MgZnJvbSB0aGUgdHlwZXMgb2YgZXhwcmVzc2lvbnMgYm91bmQgdG8gaW5wdXRzIG9yIG91dHB1dHMsIGFuZCB0aGUgdHlwZXMgb2YgZWxlbWVudHNcbiAqIHRoYXQgbWF0Y2ggcXVlcmllcyBwZXJmb3JtZWQgYnkgdGhlIGRpcmVjdGl2ZS4gSXQgYWxzbyBjYXRjaGVzIGFueSBlcnJvcnMgaW4gdGhlIHR5cGVzIG9mIHRoZXNlXG4gKiBleHByZXNzaW9ucy4gVGhpcyBtZXRob2QgaXMgbmV2ZXIgY2FsbGVkIGF0IHJ1bnRpbWUsIGJ1dCBpcyB1c2VkIGluIHR5cGUtY2hlY2sgYmxvY2tzIHRvXG4gKiBjb25zdHJ1Y3QgZGlyZWN0aXZlIHR5cGVzLlxuICpcbiAqIEFuIGlubGluZSB0eXBlIGNvbnN0cnVjdG9yIGZvciBOZ0ZvciBsb29rcyBsaWtlOlxuICpcbiAqIHN0YXRpYyBuZ1R5cGVDdG9yPFQ+KGluaXQ6IFBpY2s8TmdGb3JPZjxUPiwgJ25nRm9yT2YnfCduZ0ZvclRyYWNrQnknfCduZ0ZvclRlbXBsYXRlJz4pOlxuICogICBOZ0Zvck9mPFQ+O1xuICpcbiAqIEEgdHlwaWNhbCBjb25zdHJ1Y3RvciB3b3VsZCBiZTpcbiAqXG4gKiBOZ0Zvck9mLm5nVHlwZUN0b3IoaW5pdDoge1xuICogICBuZ0Zvck9mOiBbJ2ZvbycsICdiYXInXSxcbiAqICAgbmdGb3JUcmFja0J5OiBudWxsIGFzIGFueSxcbiAqICAgbmdGb3JUZW1wbGF0ZTogbnVsbCBhcyBhbnksXG4gKiB9KTsgLy8gSW5mZXJzIGEgdHlwZSBvZiBOZ0Zvck9mPHN0cmluZz4uXG4gKlxuICogQW55IGlucHV0cyBkZWNsYXJlZCBvbiB0aGUgdHlwZSBmb3Igd2hpY2ggbm8gcHJvcGVydHkgYmluZGluZyBpcyBwcmVzZW50IGFyZSBhc3NpZ25lZCBhIHZhbHVlIG9mXG4gKiB0eXBlIGBhbnlgLCB0byBhdm9pZCBwcm9kdWNpbmcgYW55IHR5cGUgZXJyb3JzIGZvciB1bnNldCBpbnB1dHMuXG4gKlxuICogSW5saW5lIHR5cGUgY29uc3RydWN0b3JzIGFyZSB1c2VkIHdoZW4gdGhlIHR5cGUgYmVpbmcgY3JlYXRlZCBoYXMgYm91bmRlZCBnZW5lcmljIHR5cGVzIHdoaWNoXG4gKiBtYWtlIHdyaXRpbmcgYSBkZWNsYXJlZCB0eXBlIGNvbnN0cnVjdG9yICh2aWEgYGdlbmVyYXRlVHlwZUN0b3JEZWNsYXJhdGlvbkZuYCkgZGlmZmljdWx0IG9yXG4gKiBpbXBvc3NpYmxlLlxuICpcbiAqIEBwYXJhbSBub2RlIHRoZSBgQ2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPmAgZm9yIHdoaWNoIGEgdHlwZSBjb25zdHJ1Y3RvciB3aWxsIGJlXG4gKiBnZW5lcmF0ZWQuXG4gKiBAcGFyYW0gbWV0YSBhZGRpdGlvbmFsIG1ldGFkYXRhIHJlcXVpcmVkIHRvIGdlbmVyYXRlIHRoZSB0eXBlIGNvbnN0cnVjdG9yLlxuICogQHJldHVybnMgYSBgdHMuTWV0aG9kRGVjbGFyYXRpb25gIGZvciB0aGUgdHlwZSBjb25zdHJ1Y3Rvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlSW5saW5lVHlwZUN0b3IoXG4gICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPiwgbWV0YTogVHlwZUN0b3JNZXRhZGF0YSk6IHRzLk1ldGhvZERlY2xhcmF0aW9uIHtcbiAgLy8gQnVpbGQgcmF3VHlwZSwgYSBgdHMuVHlwZU5vZGVgIG9mIHRoZSBjbGFzcyB3aXRoIGl0cyBnZW5lcmljIHBhcmFtZXRlcnMgcGFzc2VkIHRocm91Z2ggZnJvbVxuICAvLyB0aGUgZGVmaW5pdGlvbiB3aXRob3V0IGFueSB0eXBlIGJvdW5kcy4gRm9yIGV4YW1wbGUsIGlmIHRoZSBjbGFzcyBpc1xuICAvLyBgRm9vRGlyZWN0aXZlPFQgZXh0ZW5kcyBCYXI+YCwgaXRzIHJhd1R5cGUgd291bGQgYmUgYEZvb0RpcmVjdGl2ZTxUPmAuXG4gIGNvbnN0IHJhd1R5cGVBcmdzID1cbiAgICAgIG5vZGUudHlwZVBhcmFtZXRlcnMgIT09IHVuZGVmaW5lZCA/IGdlbmVyYXRlR2VuZXJpY0FyZ3Mobm9kZS50eXBlUGFyYW1ldGVycykgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHJhd1R5cGUgPSB0cy5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZShub2RlLm5hbWUsIHJhd1R5cGVBcmdzKTtcblxuICBjb25zdCBpbml0UGFyYW0gPSBjb25zdHJ1Y3RUeXBlQ3RvclBhcmFtZXRlcihub2RlLCBtZXRhLCByYXdUeXBlKTtcblxuICAvLyBJZiB0aGlzIGNvbnN0cnVjdG9yIGlzIGJlaW5nIGdlbmVyYXRlZCBpbnRvIGEgLnRzIGZpbGUsIHRoZW4gaXQgbmVlZHMgYSBmYWtlIGJvZHkuIFRoZSBib2R5XG4gIC8vIGlzIHNldCB0byBhIHJldHVybiBvZiBgbnVsbCFgLiBJZiB0aGUgdHlwZSBjb25zdHJ1Y3RvciBpcyBiZWluZyBnZW5lcmF0ZWQgaW50byBhIC5kLnRzIGZpbGUsXG4gIC8vIGl0IG5lZWRzIG5vIGJvZHkuXG4gIGxldCBib2R5OiB0cy5CbG9ja3x1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGlmIChtZXRhLmJvZHkpIHtcbiAgICBib2R5ID0gdHMuY3JlYXRlQmxvY2soW1xuICAgICAgdHMuY3JlYXRlUmV0dXJuKHRzLmNyZWF0ZU5vbk51bGxFeHByZXNzaW9uKHRzLmNyZWF0ZU51bGwoKSkpLFxuICAgIF0pO1xuICB9XG5cbiAgLy8gQ3JlYXRlIHRoZSB0eXBlIGNvbnN0cnVjdG9yIG1ldGhvZCBkZWNsYXJhdGlvbi5cbiAgcmV0dXJuIHRzLmNyZWF0ZU1ldGhvZChcbiAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogbW9kaWZpZXJzICovW3RzLmNyZWF0ZU1vZGlmaWVyKHRzLlN5bnRheEtpbmQuU3RhdGljS2V5d29yZCldLFxuICAgICAgLyogYXN0ZXJpc2tUb2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBuYW1lICovIG1ldGEuZm5OYW1lLFxuICAgICAgLyogcXVlc3Rpb25Ub2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAvKiB0eXBlUGFyYW1ldGVycyAqLyB0eXBlUGFyYW1ldGVyc1dpdGhEZWZhdWx0VHlwZXMobm9kZS50eXBlUGFyYW1ldGVycyksXG4gICAgICAvKiBwYXJhbWV0ZXJzICovW2luaXRQYXJhbV0sXG4gICAgICAvKiB0eXBlICovIHJhd1R5cGUsXG4gICAgICAvKiBib2R5ICovIGJvZHksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGNvbnN0cnVjdFR5cGVDdG9yUGFyYW1ldGVyKFxuICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4sIG1ldGE6IFR5cGVDdG9yTWV0YWRhdGEsXG4gICAgcmF3VHlwZTogdHMuVHlwZVJlZmVyZW5jZU5vZGUpOiB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbiB7XG4gIC8vIGluaXRUeXBlIGlzIHRoZSB0eXBlIG9mICdpbml0JywgdGhlIHNpbmdsZSBhcmd1bWVudCB0byB0aGUgdHlwZSBjb25zdHJ1Y3RvciBtZXRob2QuXG4gIC8vIElmIHRoZSBEaXJlY3RpdmUgaGFzIGFueSBpbnB1dHMsIGl0cyBpbml0VHlwZSB3aWxsIGJlOlxuICAvL1xuICAvLyBQaWNrPHJhd1R5cGUsICdpbnB1dEEnfCdpbnB1dEInPlxuICAvL1xuICAvLyBQaWNrIGhlcmUgaXMgdXNlZCB0byBzZWxlY3Qgb25seSB0aG9zZSBmaWVsZHMgZnJvbSB3aGljaCB0aGUgZ2VuZXJpYyB0eXBlIHBhcmFtZXRlcnMgb2YgdGhlXG4gIC8vIGRpcmVjdGl2ZSB3aWxsIGJlIGluZmVycmVkLlxuICAvL1xuICAvLyBJbiB0aGUgc3BlY2lhbCBjYXNlIHRoZXJlIGFyZSBubyBpbnB1dHMsIGluaXRUeXBlIGlzIHNldCB0byB7fS5cbiAgbGV0IGluaXRUeXBlOiB0cy5UeXBlTm9kZXxudWxsID0gbnVsbDtcblxuICBjb25zdCBrZXlzOiBzdHJpbmdbXSA9IG1ldGEuZmllbGRzLmlucHV0cztcbiAgY29uc3QgcGxhaW5LZXlzOiB0cy5MaXRlcmFsVHlwZU5vZGVbXSA9IFtdO1xuICBjb25zdCBjb2VyY2VkS2V5czogdHMuUHJvcGVydHlTaWduYXR1cmVbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgaWYgKCFtZXRhLmNvZXJjZWRJbnB1dEZpZWxkcy5oYXMoa2V5KSkge1xuICAgICAgcGxhaW5LZXlzLnB1c2godHMuY3JlYXRlTGl0ZXJhbFR5cGVOb2RlKHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoa2V5KSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb2VyY2VkS2V5cy5wdXNoKHRzLmNyZWF0ZVByb3BlcnR5U2lnbmF0dXJlKFxuICAgICAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgLyogbmFtZSAqLyBrZXksXG4gICAgICAgICAgLyogcXVlc3Rpb25Ub2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgLyogdHlwZSAqLyB0c0NyZWF0ZVR5cGVRdWVyeUZvckNvZXJjZWRJbnB1dChyYXdUeXBlLnR5cGVOYW1lLCBrZXkpLFxuICAgICAgICAgIC8qIGluaXRpYWxpemVyICovIHVuZGVmaW5lZCkpO1xuICAgIH1cbiAgfVxuICBpZiAocGxhaW5LZXlzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBDb25zdHJ1Y3QgYSB1bmlvbiBvZiBhbGwgdGhlIGZpZWxkIG5hbWVzLlxuICAgIGNvbnN0IGtleVR5cGVVbmlvbiA9IHRzLmNyZWF0ZVVuaW9uVHlwZU5vZGUocGxhaW5LZXlzKTtcblxuICAgIC8vIENvbnN0cnVjdCB0aGUgUGljazxyYXdUeXBlLCBrZXlUeXBlVW5pb24+LlxuICAgIGluaXRUeXBlID0gdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUoJ1BpY2snLCBbcmF3VHlwZSwga2V5VHlwZVVuaW9uXSk7XG4gIH1cbiAgaWYgKGNvZXJjZWRLZXlzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBjb2VyY2VkTGl0ZXJhbCA9IHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZShjb2VyY2VkS2V5cyk7XG5cbiAgICBpbml0VHlwZSA9IGluaXRUeXBlICE9PSBudWxsID8gdHMuY3JlYXRlSW50ZXJzZWN0aW9uVHlwZU5vZGUoW2luaXRUeXBlLCBjb2VyY2VkTGl0ZXJhbF0pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29lcmNlZExpdGVyYWw7XG4gIH1cblxuICBpZiAoaW5pdFR5cGUgPT09IG51bGwpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2UgLSBubyBpbnB1dHMsIG91dHB1dHMsIG9yIG90aGVyIGZpZWxkcyB3aGljaCBjb3VsZCBpbmZsdWVuY2UgdGhlIHJlc3VsdCB0eXBlLlxuICAgIGluaXRUeXBlID0gdHMuY3JlYXRlVHlwZUxpdGVyYWxOb2RlKFtdKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSB0aGUgJ2luaXQnIHBhcmFtZXRlciBpdHNlbGYuXG4gIHJldHVybiB0cy5jcmVhdGVQYXJhbWV0ZXIoXG4gICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBkb3REb3REb3RUb2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBuYW1lICovICdpbml0JyxcbiAgICAgIC8qIHF1ZXN0aW9uVG9rZW4gKi8gdW5kZWZpbmVkLFxuICAgICAgLyogdHlwZSAqLyBpbml0VHlwZSxcbiAgICAgIC8qIGluaXRpYWxpemVyICovIHVuZGVmaW5lZCk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlR2VuZXJpY0FyZ3MocGFyYW1zOiBSZWFkb25seUFycmF5PHRzLlR5cGVQYXJhbWV0ZXJEZWNsYXJhdGlvbj4pOiB0cy5UeXBlTm9kZVtdIHtcbiAgcmV0dXJuIHBhcmFtcy5tYXAocGFyYW0gPT4gdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUocGFyYW0ubmFtZSwgdW5kZWZpbmVkKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlc0lubGluZVR5cGVDdG9yKFxuICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4sIGhvc3Q6IFJlZmxlY3Rpb25Ib3N0KTogYm9vbGVhbiB7XG4gIC8vIFRoZSBjbGFzcyByZXF1aXJlcyBhbiBpbmxpbmUgdHlwZSBjb25zdHJ1Y3RvciBpZiBpdCBoYXMgZ2VuZXJpYyB0eXBlIGJvdW5kcyB0aGF0IGNhbiBub3QgYmVcbiAgLy8gZW1pdHRlZCBpbnRvIGEgZGlmZmVyZW50IGNvbnRleHQuXG4gIHJldHVybiAhY2hlY2tJZkdlbmVyaWNUeXBlQm91bmRzQXJlQ29udGV4dEZyZWUobm9kZSwgaG9zdCk7XG59XG5cbi8qKlxuICogQWRkIGEgZGVmYXVsdCBgPSBhbnlgIHRvIHR5cGUgcGFyYW1ldGVycyB0aGF0IGRvbid0IGhhdmUgYSBkZWZhdWx0IHZhbHVlIGFscmVhZHkuXG4gKlxuICogVHlwZVNjcmlwdCB1c2VzIHRoZSBkZWZhdWx0IHR5cGUgb2YgYSB0eXBlIHBhcmFtZXRlciB3aGVuZXZlciBpbmZlcmVuY2Ugb2YgdGhhdCBwYXJhbWV0ZXIgZmFpbHMuXG4gKiBUaGlzIGNhbiBoYXBwZW4gd2hlbiBpbmZlcnJpbmcgYSBjb21wbGV4IHR5cGUgZnJvbSAnYW55Jy4gRm9yIGV4YW1wbGUsIGlmIGBOZ0ZvcmAncyBpbmZlcmVuY2UgaXNcbiAqIGRvbmUgd2l0aCB0aGUgVENCIGNvZGU6XG4gKlxuICogYGBgXG4gKiBjbGFzcyBOZ0ZvcjxUPiB7XG4gKiAgIG5nRm9yT2Y6IFRbXTtcbiAqIH1cbiAqXG4gKiBkZWNsYXJlIGZ1bmN0aW9uIGN0b3I8VD4obzogUGljazxOZ0ZvcjxUPiwgJ25nRm9yT2YnfCduZ0ZvclRyYWNrQnknfCduZ0ZvclRlbXBsYXRlJz4pOiBOZ0ZvcjxUPjtcbiAqIGBgYFxuICpcbiAqIEFuIGludm9jYXRpb24gbG9va3MgbGlrZTpcbiAqXG4gKiBgYGBcbiAqIHZhciBfdDEgPSBjdG9yKHtuZ0Zvck9mOiBbMSwgMl0sIG5nRm9yVHJhY2tCeTogbnVsbCBhcyBhbnksIG5nRm9yVGVtcGxhdGU6IG51bGwgYXMgYW55fSk7XG4gKiBgYGBcbiAqXG4gKiBUaGlzIGNvcnJlY3RseSBpbmZlcnMgdGhlIHR5cGUgYE5nRm9yPG51bWJlcj5gIGZvciBgX3QxYCwgc2luY2UgYFRgIGlzIGluZmVycmVkIGZyb20gdGhlXG4gKiBhc3NpZ25tZW50IG9mIHR5cGUgYG51bWJlcltdYCB0byBgbmdGb3JPZmAncyB0eXBlIGBUW11gLiBIb3dldmVyLCBpZiBgYW55YCBpcyBwYXNzZWQgaW5zdGVhZDpcbiAqXG4gKiBgYGBcbiAqIHZhciBfdDIgPSBjdG9yKHtuZ0Zvck9mOiBbMSwgMl0gYXMgYW55LCBuZ0ZvclRyYWNrQnk6IG51bGwgYXMgYW55LCBuZ0ZvclRlbXBsYXRlOiBudWxsIGFzIGFueX0pO1xuICogYGBgXG4gKlxuICogdGhlbiBpbmZlcmVuY2UgZm9yIGBUYCBmYWlscyAoaXQgY2Fubm90IGJlIGluZmVycmVkIGZyb20gYFRbXSA9IGFueWApLiBJbiB0aGlzIGNhc2UsIGBUYCB0YWtlc1xuICogdGhlIHR5cGUgYHt9YCwgYW5kIHNvIGBfdDJgIGlzIGluZmVycmVkIGFzIGBOZ0Zvcjx7fT5gLiBUaGlzIGlzIG9idmlvdXNseSB3cm9uZy5cbiAqXG4gKiBBZGRpbmcgYSBkZWZhdWx0IHR5cGUgdG8gdGhlIGdlbmVyaWMgZGVjbGFyYXRpb24gaW4gdGhlIGNvbnN0cnVjdG9yIHNvbHZlcyB0aGlzIHByb2JsZW0sIGFzIHRoZVxuICogZGVmYXVsdCB0eXBlIHdpbGwgYmUgdXNlZCBpbiB0aGUgZXZlbnQgdGhhdCBpbmZlcmVuY2UgZmFpbHMuXG4gKlxuICogYGBgXG4gKiBkZWNsYXJlIGZ1bmN0aW9uIGN0b3I8VCA9IGFueT4obzogUGljazxOZ0ZvcjxUPiwgJ25nRm9yT2YnPik6IE5nRm9yPFQ+O1xuICpcbiAqIHZhciBfdDMgPSBjdG9yKHtuZ0Zvck9mOiBbMSwgMl0gYXMgYW55fSk7XG4gKiBgYGBcbiAqXG4gKiBUaGlzIGNvcnJlY3RseSBpbmZlcnMgYFRgIGFzIGBhbnlgLCBhbmQgdGhlcmVmb3JlIGBfdDNgIGFzIGBOZ0Zvcjxhbnk+YC5cbiAqL1xuZnVuY3Rpb24gdHlwZVBhcmFtZXRlcnNXaXRoRGVmYXVsdFR5cGVzKHBhcmFtczogUmVhZG9ubHlBcnJheTx0cy5UeXBlUGFyYW1ldGVyRGVjbGFyYXRpb24+fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZCk6IHRzLlR5cGVQYXJhbWV0ZXJEZWNsYXJhdGlvbltdfHVuZGVmaW5lZCB7XG4gIGlmIChwYXJhbXMgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICByZXR1cm4gcGFyYW1zLm1hcChwYXJhbSA9PiB7XG4gICAgaWYgKHBhcmFtLmRlZmF1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRzLnVwZGF0ZVR5cGVQYXJhbWV0ZXJEZWNsYXJhdGlvbihcbiAgICAgICAgICAvKiBub2RlICovIHBhcmFtLFxuICAgICAgICAgIC8qIG5hbWUgKi8gcGFyYW0ubmFtZSxcbiAgICAgICAgICAvKiBjb25zdHJhaW50ICovIHBhcmFtLmNvbnN0cmFpbnQsXG4gICAgICAgICAgLyogZGVmYXVsdFR5cGUgKi8gdHMuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuQW55S2V5d29yZCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGFyYW07XG4gICAgfVxuICB9KTtcbn1cbiJdfQ==