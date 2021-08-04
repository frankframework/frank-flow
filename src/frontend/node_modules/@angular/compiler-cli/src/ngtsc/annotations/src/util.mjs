/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ExternalExpr, LiteralExpr, ParseLocation, ParseSourceFile, ParseSourceSpan, ReadPropExpr, WrappedNodeExpr } from '@angular/compiler';
import * as ts from 'typescript';
import { ErrorCode, FatalDiagnosticError, makeDiagnostic, makeRelatedInformation } from '../../diagnostics';
import { ImportFlags, Reference } from '../../imports';
import { attachDefaultImportDeclaration } from '../../imports/src/default';
import { Decorator, isNamedClassDeclaration } from '../../reflection';
export function getConstructorDependencies(clazz, reflector, isCore) {
    const deps = [];
    const errors = [];
    let ctorParams = reflector.getConstructorParameters(clazz);
    if (ctorParams === null) {
        if (reflector.hasBaseClass(clazz)) {
            return null;
        }
        else {
            ctorParams = [];
        }
    }
    ctorParams.forEach((param, idx) => {
        let token = valueReferenceToExpression(param.typeValueReference);
        let attributeNameType = null;
        let optional = false, self = false, skipSelf = false, host = false;
        (param.decorators || []).filter(dec => isCore || isAngularCore(dec)).forEach(dec => {
            const name = isCore || dec.import === null ? dec.name : dec.import.name;
            if (name === 'Inject') {
                if (dec.args === null || dec.args.length !== 1) {
                    throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, Decorator.nodeForError(dec), `Unexpected number of arguments to @Inject().`);
                }
                token = new WrappedNodeExpr(dec.args[0]);
            }
            else if (name === 'Optional') {
                optional = true;
            }
            else if (name === 'SkipSelf') {
                skipSelf = true;
            }
            else if (name === 'Self') {
                self = true;
            }
            else if (name === 'Host') {
                host = true;
            }
            else if (name === 'Attribute') {
                if (dec.args === null || dec.args.length !== 1) {
                    throw new FatalDiagnosticError(ErrorCode.DECORATOR_ARITY_WRONG, Decorator.nodeForError(dec), `Unexpected number of arguments to @Attribute().`);
                }
                const attributeName = dec.args[0];
                token = new WrappedNodeExpr(attributeName);
                if (ts.isStringLiteralLike(attributeName)) {
                    attributeNameType = new LiteralExpr(attributeName.text);
                }
                else {
                    attributeNameType =
                        new WrappedNodeExpr(ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword));
                }
            }
            else {
                throw new FatalDiagnosticError(ErrorCode.DECORATOR_UNEXPECTED, Decorator.nodeForError(dec), `Unexpected decorator ${name} on parameter.`);
            }
        });
        if (token === null) {
            if (param.typeValueReference.kind !== 2 /* UNAVAILABLE */) {
                throw new Error('Illegal state: expected value reference to be unavailable if no token is present');
            }
            errors.push({
                index: idx,
                param,
                reason: param.typeValueReference.reason,
            });
        }
        else {
            deps.push({ token, attributeNameType, optional, self, skipSelf, host });
        }
    });
    if (errors.length === 0) {
        return { deps };
    }
    else {
        return { deps: null, errors };
    }
}
export function valueReferenceToExpression(valueRef) {
    if (valueRef.kind === 2 /* UNAVAILABLE */) {
        return null;
    }
    else if (valueRef.kind === 0 /* LOCAL */) {
        const expr = new WrappedNodeExpr(valueRef.expression);
        if (valueRef.defaultImportStatement !== null) {
            attachDefaultImportDeclaration(expr, valueRef.defaultImportStatement);
        }
        return expr;
    }
    else {
        let importExpr = new ExternalExpr({ moduleName: valueRef.moduleName, name: valueRef.importedName });
        if (valueRef.nestedPath !== null) {
            for (const property of valueRef.nestedPath) {
                importExpr = new ReadPropExpr(importExpr, property);
            }
        }
        return importExpr;
    }
}
/**
 * Convert `ConstructorDeps` into the `R3DependencyMetadata` array for those deps if they're valid,
 * or into an `'invalid'` signal if they're not.
 *
 * This is a companion function to `validateConstructorDependencies` which accepts invalid deps.
 */
export function unwrapConstructorDependencies(deps) {
    if (deps === null) {
        return null;
    }
    else if (deps.deps !== null) {
        // These constructor dependencies are valid.
        return deps.deps;
    }
    else {
        // These deps are invalid.
        return 'invalid';
    }
}
export function getValidConstructorDependencies(clazz, reflector, isCore) {
    return validateConstructorDependencies(clazz, getConstructorDependencies(clazz, reflector, isCore));
}
/**
 * Validate that `ConstructorDeps` does not have any invalid dependencies and convert them into the
 * `R3DependencyMetadata` array if so, or raise a diagnostic if some deps are invalid.
 *
 * This is a companion function to `unwrapConstructorDependencies` which does not accept invalid
 * deps.
 */
export function validateConstructorDependencies(clazz, deps) {
    if (deps === null) {
        return null;
    }
    else if (deps.deps !== null) {
        return deps.deps;
    }
    else {
        // TODO(alxhub): this cast is necessary because the g3 typescript version doesn't narrow here.
        // There is at least one error.
        const error = deps.errors[0];
        throw createUnsuitableInjectionTokenError(clazz, error);
    }
}
/**
 * Creates a fatal error with diagnostic for an invalid injection token.
 * @param clazz The class for which the injection token was unavailable.
 * @param error The reason why no valid injection token is available.
 */
function createUnsuitableInjectionTokenError(clazz, error) {
    const { param, index, reason } = error;
    let chainMessage = undefined;
    let hints = undefined;
    switch (reason.kind) {
        case 5 /* UNSUPPORTED */:
            chainMessage = 'Consider using the @Inject decorator to specify an injection token.';
            hints = [
                makeRelatedInformation(reason.typeNode, 'This type is not supported as injection token.'),
            ];
            break;
        case 1 /* NO_VALUE_DECLARATION */:
            chainMessage = 'Consider using the @Inject decorator to specify an injection token.';
            hints = [
                makeRelatedInformation(reason.typeNode, 'This type does not have a value, so it cannot be used as injection token.'),
            ];
            if (reason.decl !== null) {
                hints.push(makeRelatedInformation(reason.decl, 'The type is declared here.'));
            }
            break;
        case 2 /* TYPE_ONLY_IMPORT */:
            chainMessage =
                'Consider changing the type-only import to a regular import, or use the @Inject decorator to specify an injection token.';
            hints = [
                makeRelatedInformation(reason.typeNode, 'This type is imported using a type-only import, which prevents it from being usable as an injection token.'),
                makeRelatedInformation(reason.importClause, 'The type-only import occurs here.'),
            ];
            break;
        case 4 /* NAMESPACE */:
            chainMessage = 'Consider using the @Inject decorator to specify an injection token.';
            hints = [
                makeRelatedInformation(reason.typeNode, 'This type corresponds with a namespace, which cannot be used as injection token.'),
                makeRelatedInformation(reason.importClause, 'The namespace import occurs here.'),
            ];
            break;
        case 3 /* UNKNOWN_REFERENCE */:
            chainMessage = 'The type should reference a known declaration.';
            hints = [makeRelatedInformation(reason.typeNode, 'This type could not be resolved.')];
            break;
        case 0 /* MISSING_TYPE */:
            chainMessage =
                'Consider adding a type to the parameter or use the @Inject decorator to specify an injection token.';
            break;
    }
    const chain = {
        messageText: `No suitable injection token for parameter '${param.name || index}' of class '${clazz.name.text}'.`,
        category: ts.DiagnosticCategory.Error,
        code: 0,
        next: [{
                messageText: chainMessage,
                category: ts.DiagnosticCategory.Message,
                code: 0,
            }],
    };
    return new FatalDiagnosticError(ErrorCode.PARAM_MISSING_TOKEN, param.nameNode, chain, hints);
}
export function toR3Reference(valueRef, typeRef, valueContext, typeContext, refEmitter) {
    return {
        value: refEmitter.emit(valueRef, valueContext).expression,
        type: refEmitter
            .emit(typeRef, typeContext, ImportFlags.ForceNewImport | ImportFlags.AllowTypeImports)
            .expression,
    };
}
export function isAngularCore(decorator) {
    return decorator.import !== null && decorator.import.from === '@angular/core';
}
export function isAngularCoreReference(reference, symbolName) {
    return reference.ownedByModuleGuess === '@angular/core' && reference.debugName === symbolName;
}
export function findAngularDecorator(decorators, name, isCore) {
    return decorators.find(decorator => isAngularDecorator(decorator, name, isCore));
}
export function isAngularDecorator(decorator, name, isCore) {
    if (isCore) {
        return decorator.name === name;
    }
    else if (isAngularCore(decorator)) {
        return decorator.import.name === name;
    }
    return false;
}
/**
 * Unwrap a `ts.Expression`, removing outer type-casts or parentheses until the expression is in its
 * lowest level form.
 *
 * For example, the expression "(foo as Type)" unwraps to "foo".
 */
export function unwrapExpression(node) {
    while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) {
        node = node.expression;
    }
    return node;
}
function expandForwardRef(arg) {
    arg = unwrapExpression(arg);
    if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) {
        return null;
    }
    const body = arg.body;
    // Either the body is a ts.Expression directly, or a block with a single return statement.
    if (ts.isBlock(body)) {
        // Block body - look for a single return statement.
        if (body.statements.length !== 1) {
            return null;
        }
        const stmt = body.statements[0];
        if (!ts.isReturnStatement(stmt) || stmt.expression === undefined) {
            return null;
        }
        return stmt.expression;
    }
    else {
        // Shorthand body - return as an expression.
        return body;
    }
}
/**
 * If the given `node` is a forwardRef() expression then resolve its inner value, otherwise return
 * `null`.
 *
 * @param node the forwardRef() expression to resolve
 * @param reflector a ReflectionHost
 * @returns the resolved expression, if the original expression was a forwardRef(), or `null`
 *     otherwise.
 */
export function tryUnwrapForwardRef(node, reflector) {
    node = unwrapExpression(node);
    if (!ts.isCallExpression(node) || node.arguments.length !== 1) {
        return null;
    }
    const fn = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
    if (!ts.isIdentifier(fn)) {
        return null;
    }
    const expr = expandForwardRef(node.arguments[0]);
    if (expr === null) {
        return null;
    }
    const imp = reflector.getImportOfIdentifier(fn);
    if (imp === null || imp.from !== '@angular/core' || imp.name !== 'forwardRef') {
        return null;
    }
    return expr;
}
/**
 * A foreign function resolver for `staticallyResolve` which unwraps forwardRef() expressions.
 *
 * @param ref a Reference to the declaration of the function being called (which might be
 * forwardRef)
 * @param args the arguments to the invocation of the forwardRef expression
 * @returns an unwrapped argument if `ref` pointed to forwardRef, or null otherwise
 */
export function forwardRefResolver(ref, args) {
    if (!isAngularCoreReference(ref, 'forwardRef') || args.length !== 1) {
        return null;
    }
    return expandForwardRef(args[0]);
}
/**
 * Combines an array of resolver functions into a one.
 * @param resolvers Resolvers to be combined.
 */
export function combineResolvers(resolvers) {
    return (ref, args) => {
        for (const resolver of resolvers) {
            const resolved = resolver(ref, args);
            if (resolved !== null) {
                return resolved;
            }
        }
        return null;
    };
}
export function isExpressionForwardReference(expr, context, contextSource) {
    if (isWrappedTsNodeExpr(expr)) {
        const node = ts.getOriginalNode(expr.node);
        return node.getSourceFile() === contextSource && context.pos < node.pos;
    }
    else {
        return false;
    }
}
export function isWrappedTsNodeExpr(expr) {
    return expr instanceof WrappedNodeExpr;
}
export function readBaseClass(node, reflector, evaluator) {
    const baseExpression = reflector.getBaseClassExpression(node);
    if (baseExpression !== null) {
        const baseClass = evaluator.evaluate(baseExpression);
        if (baseClass instanceof Reference && reflector.isClass(baseClass.node)) {
            return baseClass;
        }
        else {
            return 'dynamic';
        }
    }
    return null;
}
const parensWrapperTransformerFactory = (context) => {
    const visitor = (node) => {
        const visited = ts.visitEachChild(node, visitor, context);
        if (ts.isArrowFunction(visited) || ts.isFunctionExpression(visited)) {
            return ts.createParen(visited);
        }
        return visited;
    };
    return (node) => ts.visitEachChild(node, visitor, context);
};
/**
 * Wraps all functions in a given expression in parentheses. This is needed to avoid problems
 * where Tsickle annotations added between analyse and transform phases in Angular may trigger
 * automatic semicolon insertion, e.g. if a function is the expression in a `return` statement.
 * More
 * info can be found in Tsickle source code here:
 * https://github.com/angular/tsickle/blob/d7974262571c8a17d684e5ba07680e1b1993afdd/src/jsdoc_transformer.ts#L1021
 *
 * @param expression Expression where functions should be wrapped in parentheses
 */
export function wrapFunctionExpressionsInParens(expression) {
    return ts.transform(expression, [parensWrapperTransformerFactory]).transformed[0];
}
/**
 * Create a `ts.Diagnostic` which indicates the given class is part of the declarations of two or
 * more NgModules.
 *
 * The resulting `ts.Diagnostic` will have a context entry for each NgModule showing the point where
 * the directive/pipe exists in its `declarations` (if possible).
 */
export function makeDuplicateDeclarationError(node, data, kind) {
    const context = [];
    for (const decl of data) {
        if (decl.rawDeclarations === null) {
            continue;
        }
        // Try to find the reference to the declaration within the declarations array, to hang the
        // error there. If it can't be found, fall back on using the NgModule's name.
        const contextNode = decl.ref.getOriginForDiagnostics(decl.rawDeclarations, decl.ngModule.name);
        context.push(makeRelatedInformation(contextNode, `'${node.name.text}' is listed in the declarations of the NgModule '${decl.ngModule.name.text}'.`));
    }
    // Finally, produce the diagnostic.
    return makeDiagnostic(ErrorCode.NGMODULE_DECLARATION_NOT_UNIQUE, node.name, `The ${kind} '${node.name.text}' is declared by more than one NgModule.`, context);
}
/**
 * Resolves the given `rawProviders` into `ClassDeclarations` and returns
 * a set containing those that are known to require a factory definition.
 * @param rawProviders Expression that declared the providers array in the source.
 */
export function resolveProvidersRequiringFactory(rawProviders, reflector, evaluator) {
    const providers = new Set();
    const resolvedProviders = evaluator.evaluate(rawProviders);
    if (!Array.isArray(resolvedProviders)) {
        return providers;
    }
    resolvedProviders.forEach(function processProviders(provider) {
        let tokenClass = null;
        if (Array.isArray(provider)) {
            // If we ran into an array, recurse into it until we've resolve all the classes.
            provider.forEach(processProviders);
        }
        else if (provider instanceof Reference) {
            tokenClass = provider;
        }
        else if (provider instanceof Map && provider.has('useClass') && !provider.has('deps')) {
            const useExisting = provider.get('useClass');
            if (useExisting instanceof Reference) {
                tokenClass = useExisting;
            }
        }
        // TODO(alxhub): there was a bug where `getConstructorParameters` would return `null` for a
        // class in a .d.ts file, always, even if the class had a constructor. This was fixed for
        // `getConstructorParameters`, but that fix causes more classes to be recognized here as needing
        // provider checks, which is a breaking change in g3. Avoid this breakage for now by skipping
        // classes from .d.ts files here directly, until g3 can be cleaned up.
        if (tokenClass !== null && !tokenClass.node.getSourceFile().isDeclarationFile &&
            reflector.isClass(tokenClass.node)) {
            const constructorParameters = reflector.getConstructorParameters(tokenClass.node);
            // Note that we only want to capture providers with a non-trivial constructor,
            // because they're the ones that might be using DI and need to be decorated.
            if (constructorParameters !== null && constructorParameters.length > 0) {
                providers.add(tokenClass);
            }
        }
    });
    return providers;
}
/**
 * Create an R3Reference for a class.
 *
 * The `value` is the exported declaration of the class from its source file.
 * The `type` is an expression that would be used by ngcc in the typings (.d.ts) files.
 */
export function wrapTypeReference(reflector, clazz) {
    const dtsClass = reflector.getDtsDeclaration(clazz);
    const value = new WrappedNodeExpr(clazz.name);
    const type = dtsClass !== null && isNamedClassDeclaration(dtsClass) ?
        new WrappedNodeExpr(dtsClass.name) :
        value;
    return { value, type };
}
/** Creates a ParseSourceSpan for a TypeScript node. */
export function createSourceSpan(node) {
    const sf = node.getSourceFile();
    const [startOffset, endOffset] = [node.getStart(), node.getEnd()];
    const { line: startLine, character: startCol } = sf.getLineAndCharacterOfPosition(startOffset);
    const { line: endLine, character: endCol } = sf.getLineAndCharacterOfPosition(endOffset);
    const parseSf = new ParseSourceFile(sf.getFullText(), sf.fileName);
    // +1 because values are zero-indexed.
    return new ParseSourceSpan(new ParseLocation(parseSf, startOffset, startLine + 1, startCol + 1), new ParseLocation(parseSf, endOffset, endLine + 1, endCol + 1));
}
/**
 * Collate the factory and definition compiled results into an array of CompileResult objects.
 */
export function compileResults(fac, def, metadataStmt, propName) {
    const statements = def.statements;
    if (metadataStmt !== null) {
        statements.push(metadataStmt);
    }
    return [
        fac, {
            name: propName,
            initializer: def.expression,
            statements: def.statements,
            type: def.type,
        }
    ];
}
export function toFactoryMetadata(meta, target) {
    return {
        name: meta.name,
        type: meta.type,
        internalType: meta.internalType,
        typeArgumentCount: meta.typeArgumentCount,
        deps: meta.deps,
        target
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvYW5ub3RhdGlvbnMvc3JjL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFhLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQTJELFlBQVksRUFBYSxlQUFlLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUc1TixPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsU0FBUyxFQUFFLG9CQUFvQixFQUFFLGNBQWMsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzFHLE9BQU8sRUFBQyxXQUFXLEVBQUUsU0FBUyxFQUFtQixNQUFNLGVBQWUsQ0FBQztBQUN2RSxPQUFPLEVBQUMsOEJBQThCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUV6RSxPQUFPLEVBQWtDLFNBQVMsRUFBc0MsdUJBQXVCLEVBQThILE1BQU0sa0JBQWtCLENBQUM7QUFpQnRRLE1BQU0sVUFBVSwwQkFBMEIsQ0FDdEMsS0FBdUIsRUFBRSxTQUF5QixFQUFFLE1BQWU7SUFDckUsTUFBTSxJQUFJLEdBQTJCLEVBQUUsQ0FBQztJQUN4QyxNQUFNLE1BQU0sR0FBMEIsRUFBRSxDQUFDO0lBQ3pDLElBQUksVUFBVSxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMzRCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDdkIsSUFBSSxTQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ2pDLE9BQU8sSUFBSSxDQUFDO1NBQ2I7YUFBTTtZQUNMLFVBQVUsR0FBRyxFQUFFLENBQUM7U0FDakI7S0FDRjtJQUNELFVBQVUsQ0FBQyxPQUFPLENBQUMs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QVksQ0FBQyxDQUFDO0tBQy9CO0lBQ0QsT0FBTztRQUNMLEdBQUcsRUFBRTtZQUNILElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLEdBQUcsQ0FBQyxVQUFVO1lBQzNCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVTtZQUMxQixJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUk7U0FDZjtLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQixDQUM3QixJQUF1QyxFQUFFLE1BQXFCO0lBQ2hFLE9BQU87UUFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVk7UUFDL0IsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtRQUN6QyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixNQUFNO0tBQ1AsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtFeHByZXNzaW9uLCBFeHRlcm5hbEV4cHIsIExpdGVyYWxFeHByLCBQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZUZpbGUsIFBhcnNlU291cmNlU3BhbiwgUjNDb21waWxlZEV4cHJlc3Npb24sIFIzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM1JlZmVyZW5jZSwgUmVhZFByb3BFeHByLCBTdGF0ZW1lbnQsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtSM0ZhY3RvcnlNZXRhZGF0YX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXIvc3JjL2NvbXBpbGVyJztcbmltcG9ydCB7RmFjdG9yeVRhcmdldH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9hcGknO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7RXJyb3JDb2RlLCBGYXRhbERpYWdub3N0aWNFcnJvciwgbWFrZURpYWdub3N0aWMsIG1ha2VSZWxhdGVkSW5mb3JtYXRpb259IGZyb20gJy4uLy4uL2RpYWdub3N0aWNzJztcbmltcG9ydCB7SW1wb3J0RmxhZ3MsIFJlZmVyZW5jZSwgUmVmZXJlbmNlRW1pdHRlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge2F0dGFjaERlZmF1bHRJbXBvcnREZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vaW1wb3J0cy9zcmMvZGVmYXVsdCc7XG5pbXBvcnQge0ZvcmVpZ25GdW5jdGlvblJlc29sdmVyLCBQYXJ0aWFsRXZhbHVhdG9yfSBmcm9tICcuLi8uLi9wYXJ0aWFsX2V2YWx1YXRvcic7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIEN0b3JQYXJhbWV0ZXIsIERlY29yYXRvciwgSW1wb3J0LCBJbXBvcnRlZFR5cGVWYWx1ZVJlZmVyZW5jZSwgaXNOYW1lZENsYXNzRGVjbGFyYXRpb24sIExvY2FsVHlwZVZhbHVlUmVmZXJlbmNlLCBSZWZsZWN0aW9uSG9zdCwgVHlwZVZhbHVlUmVmZXJlbmNlLCBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLCBVbmF2YWlsYWJsZVZhbHVlLCBWYWx1ZVVuYXZhaWxhYmxlS2luZH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge0RlY2xhcmF0aW9uRGF0YX0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtDb21waWxlUmVzdWx0fSBmcm9tICcuLi8uLi90cmFuc2Zvcm0nO1xuXG5leHBvcnQgdHlwZSBDb25zdHJ1Y3RvckRlcHMgPSB7XG4gIGRlcHM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59fHtcbiAgZGVwczogbnVsbDtcbiAgZXJyb3JzOiBDb25zdHJ1Y3RvckRlcEVycm9yW107XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnN0cnVjdG9yRGVwRXJyb3Ige1xuICBpbmRleDogbnVtYmVyO1xuICBwYXJhbTogQ3RvclBhcmFtZXRlcjtcbiAgcmVhc29uOiBVbmF2YWlsYWJsZVZhbHVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29uc3RydWN0b3JEZXBlbmRlbmNpZXMoXG4gICAgY2xheno6IENsYXNzRGVjbGFyYXRpb24sIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIGlzQ29yZTogYm9vbGVhbik6IENvbnN0cnVjdG9yRGVwc3xudWxsIHtcbiAgY29uc3QgZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IFtdO1xuICBjb25zdCBlcnJvcnM6IENvbnN0cnVjdG9yRGVwRXJyb3JbXSA9IFtdO1xuICBsZXQgY3RvclBhcmFtcyA9IHJlZmxlY3Rvci5nZXRDb25zdHJ1Y3RvclBhcmFtZXRlcnMoY2xhenopO1xuICBpZiAoY3RvclBhcmFtcyA9PT0gbnVsbCkge1xuICAgIGlmIChyZWZsZWN0b3IuaGFzQmFzZUNsYXNzKGNsYXp6KSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0b3JQYXJhbXMgPSBbXTtcbiAgICB9XG4gIH1cbiAgY3RvclBhcmFtcy5mb3JFYWNoKChwYXJhbSwgaWR4KSA9PiB7XG4gICAgbGV0IHRva2VuID0gdmFsdWVSZWZlcmVuY2VUb0V4cHJlc3Npb24ocGFyYW0udHlwZVZhbHVlUmVmZXJlbmNlKTtcbiAgICBsZXQgYXR0cmlidXRlTmFtZVR5cGU6IEV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgbGV0IG9wdGlvbmFsID0gZmFsc2UsIHNlbGYgPSBmYWxzZSwgc2tpcFNlbGYgPSBmYWxzZSwgaG9zdCA9IGZhbHNlO1xuXG4gICAgKHBhcmFtLmRlY29yYXRvcnMgfHwgW10pLmZpbHRlcihkZWMgPT4gaXNDb3JlIHx8IGlzQW5ndWxhckNvcmUoZGVjKSkuZm9yRWFjaChkZWMgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGlzQ29yZSB8fCBkZWMuaW1wb3J0ID09PSBudWxsID8gZGVjLm5hbWUgOiBkZWMuaW1wb3J0IS5uYW1lO1xuICAgICAgaWYgKG5hbWUgPT09ICdJbmplY3QnKSB7XG4gICAgICAgIGlmIChkZWMuYXJncyA9PT0gbnVsbCB8fCBkZWMuYXJncy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJJVFlfV1JPTkcsIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjKSxcbiAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgbnVtYmVyIG9mIGFyZ3VtZW50cyB0byBASW5qZWN0KCkuYCk7XG4gICAgICAgIH1cbiAgICAgICAgdG9rZW4gPSBuZXcgV3JhcHBlZE5vZGVFeHByKGRlYy5hcmdzWzBdKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ09wdGlvbmFsJykge1xuICAgICAgICBvcHRpb25hbCA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdTa2lwU2VsZicpIHtcbiAgICAgICAgc2tpcFNlbGYgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnU2VsZicpIHtcbiAgICAgICAgc2VsZiA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdIb3N0Jykge1xuICAgICAgICBob3N0ID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ0F0dHJpYnV0ZScpIHtcbiAgICAgICAgaWYgKGRlYy5hcmdzID09PSBudWxsIHx8IGRlYy5hcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUklUWV9XUk9ORywgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWMpLFxuICAgICAgICAgICAgICBgVW5leHBlY3RlZCBudW1iZXIgb2YgYXJndW1lbnRzIHRvIEBBdHRyaWJ1dGUoKS5gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhdHRyaWJ1dGVOYW1lID0gZGVjLmFyZ3NbMF07XG4gICAgICAgIHRva2VuID0gbmV3IFdyYXBwZWROb2RlRXhwcihhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgaWYgKHRzLmlzU3RyaW5nTGl0ZXJhbExpa2UoYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVOYW1lVHlwZSA9IG5ldyBMaXRlcmFsRXhwcihhdHRyaWJ1dGVOYW1lLnRleHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF0dHJpYnV0ZU5hbWVUeXBlID1cbiAgICAgICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcih0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5Vbmtub3duS2V5d29yZCkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX1VORVhQRUNURUQsIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjKSxcbiAgICAgICAgICAgIGBVbmV4cGVjdGVkIGRlY29yYXRvciAke25hbWV9IG9uIHBhcmFtZXRlci5gKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh0b2tlbiA9PT0gbnVsbCkge1xuICAgICAgaWYgKHBhcmFtLnR5cGVWYWx1ZVJlZmVyZW5jZS5raW5kICE9PSBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLlVOQVZBSUxBQkxFKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdJbGxlZ2FsIHN0YXRlOiBleHBlY3RlZCB2YWx1ZSByZWZlcmVuY2UgdG8gYmUgdW5hdmFpbGFibGUgaWYgbm8gdG9rZW4gaXMgcHJlc2VudCcpO1xuICAgICAgfVxuICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICBwYXJhbSxcbiAgICAgICAgcmVhc29uOiBwYXJhbS50eXBlVmFsdWVSZWZlcmVuY2UucmVhc29uLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlcHMucHVzaCh7dG9rZW4sIGF0dHJpYnV0ZU5hbWVUeXBlLCBvcHRpb25hbCwgc2VsZiwgc2tpcFNlbGYsIGhvc3R9KTtcbiAgICB9XG4gIH0pO1xuICBpZiAoZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7ZGVwc307XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtkZXBzOiBudWxsLCBlcnJvcnN9O1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydCBhIGBUeXBlVmFsdWVSZWZlcmVuY2VgIHRvIGFuIGBFeHByZXNzaW9uYCB3aGljaCByZWZlcnMgdG8gdGhlIHR5cGUgYXMgYSB2YWx1ZS5cbiAqXG4gKiBMb2NhbCByZWZlcmVuY2VzIGFyZSBjb252ZXJ0ZWQgdG8gYSBgV3JhcHBlZE5vZGVFeHByYCBvZiB0aGUgVHlwZVNjcmlwdCBleHByZXNzaW9uLCBhbmQgbm9uLWxvY2FsXG4gKiByZWZlcmVuY2VzIGFyZSBjb252ZXJ0ZWQgdG8gYW4gYEV4dGVybmFsRXhwcmAuIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdmFsaWQgaW4gdGhlIGNvbnRleHQgb2YgdGhlXG4gKiBmaWxlIGluIHdoaWNoIHRoZSBgVHlwZVZhbHVlUmVmZXJlbmNlYCBvcmlnaW5hdGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsdWVSZWZlcmVuY2VUb0V4cHJlc3Npb24odmFsdWVSZWY6IExvY2FsVHlwZVZhbHVlUmVmZXJlbmNlfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEltcG9ydGVkVHlwZVZhbHVlUmVmZXJlbmNlKTogRXhwcmVzc2lvbjtcbmV4cG9ydCBmdW5jdGlvbiB2YWx1ZVJlZmVyZW5jZVRvRXhwcmVzc2lvbih2YWx1ZVJlZjogVHlwZVZhbHVlUmVmZXJlbmNlKTogRXhwcmVzc2lvbnxudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHZhbHVlUmVmZXJlbmNlVG9FeHByZXNzaW9uKHZhbHVlUmVmOiBUeXBlVmFsdWVSZWZlcmVuY2UpOiBFeHByZXNzaW9ufG51bGwge1xuICBpZiAodmFsdWVSZWYua2luZCA9PT0gVHlwZVZhbHVlUmVmZXJlbmNlS2luZC5VTkFWQUlMQUJMRSkge1xuICAgIHJldHVybiBudWxsO1xuICB9IGVsc2UgaWYgKHZhbHVlUmVmLmtpbmQgPT09IFR5cGVWYWx1ZVJlZmVyZW5jZUtpbmQuTE9DQUwpIHtcbiAgICBjb25zdCBleHByID0gbmV3IFdyYXBwZWROb2RlRXhwcih2YWx1ZVJlZi5leHByZXNzaW9uKTtcbiAgICBpZiAodmFsdWVSZWYuZGVmYXVsdEltcG9ydFN0YXRlbWVudCAhPT0gbnVsbCkge1xuICAgICAgYXR0YWNoRGVmYXVsdEltcG9ydERlY2xhcmF0aW9uKGV4cHIsIHZhbHVlUmVmLmRlZmF1bHRJbXBvcnRTdGF0ZW1lbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZXhwcjtcbiAgfSBlbHNlIHtcbiAgICBsZXQgaW1wb3J0RXhwcjogRXhwcmVzc2lvbiA9XG4gICAgICAgIG5ldyBFeHRlcm5hbEV4cHIoe21vZHVsZU5hbWU6IHZhbHVlUmVmLm1vZHVsZU5hbWUsIG5hbWU6IHZhbHVlUmVmLmltcG9ydGVkTmFtZX0pO1xuICAgIGlmICh2YWx1ZVJlZi5uZXN0ZWRQYXRoICE9PSBudWxsKSB7XG4gICAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIHZhbHVlUmVmLm5lc3RlZFBhdGgpIHtcbiAgICAgICAgaW1wb3J0RXhwciA9IG5ldyBSZWFkUHJvcEV4cHIoaW1wb3J0RXhwciwgcHJvcGVydHkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW1wb3J0RXhwcjtcbiAgfVxufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbnN0cnVjdG9yRGVwc2AgaW50byB0aGUgYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBhcnJheSBmb3IgdGhvc2UgZGVwcyBpZiB0aGV5J3JlIHZhbGlkLFxuICogb3IgaW50byBhbiBgJ2ludmFsaWQnYCBzaWduYWwgaWYgdGhleSdyZSBub3QuXG4gKlxuICogVGhpcyBpcyBhIGNvbXBhbmlvbiBmdW5jdGlvbiB0byBgdmFsaWRhdGVDb25zdHJ1Y3RvckRlcGVuZGVuY2llc2Agd2hpY2ggYWNjZXB0cyBpbnZhbGlkIGRlcHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bndyYXBDb25zdHJ1Y3RvckRlcGVuZGVuY2llcyhkZXBzOiBDb25zdHJ1Y3RvckRlcHN8bnVsbCk6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118XG4gICAgJ2ludmFsaWQnfG51bGwge1xuICBpZiAoZGVwcyA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9IGVsc2UgaWYgKGRlcHMuZGVwcyAhPT0gbnVsbCkge1xuICAgIC8vIFRoZXNlIGNvbnN0cnVjdG9yIGRlcGVuZGVuY2llcyBhcmUgdmFsaWQuXG4gICAgcmV0dXJuIGRlcHMuZGVwcztcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGVzZSBkZXBzIGFyZSBpbnZhbGlkLlxuICAgIHJldHVybiAnaW52YWxpZCc7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFZhbGlkQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMoXG4gICAgY2xheno6IENsYXNzRGVjbGFyYXRpb24sIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIGlzQ29yZTogYm9vbGVhbik6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118XG4gICAgbnVsbCB7XG4gIHJldHVybiB2YWxpZGF0ZUNvbnN0cnVjdG9yRGVwZW5kZW5jaWVzKFxuICAgICAgY2xhenosIGdldENvbnN0cnVjdG9yRGVwZW5kZW5jaWVzKGNsYXp6LCByZWZsZWN0b3IsIGlzQ29yZSkpO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIHRoYXQgYENvbnN0cnVjdG9yRGVwc2AgZG9lcyBub3QgaGF2ZSBhbnkgaW52YWxpZCBkZXBlbmRlbmNpZXMgYW5kIGNvbnZlcnQgdGhlbSBpbnRvIHRoZVxuICogYFIzRGVwZW5kZW5jeU1ldGFkYXRhYCBhcnJheSBpZiBzbywgb3IgcmFpc2UgYSBkaWFnbm9zdGljIGlmIHNvbWUgZGVwcyBhcmUgaW52YWxpZC5cbiAqXG4gKiBUaGlzIGlzIGEgY29tcGFuaW9uIGZ1bmN0aW9uIHRvIGB1bndyYXBDb25zdHJ1Y3RvckRlcGVuZGVuY2llc2Agd2hpY2ggZG9lcyBub3QgYWNjZXB0IGludmFsaWRcbiAqIGRlcHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUNvbnN0cnVjdG9yRGVwZW5kZW5jaWVzKFxuICAgIGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uLCBkZXBzOiBDb25zdHJ1Y3RvckRlcHN8bnVsbCk6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118bnVsbCB7XG4gIGlmIChkZXBzID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoZGVwcy5kZXBzICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGRlcHMuZGVwcztcbiAgfSBlbHNlIHtcbiAgICAvLyBUT0RPKGFseGh1Yik6IHRoaXMgY2FzdCBpcyBuZWNlc3NhcnkgYmVjYXVzZSB0aGUgZzMgdHlwZXNjcmlwdCB2ZXJzaW9uIGRvZXNuJ3QgbmFycm93IGhlcmUuXG4gICAgLy8gVGhlcmUgaXMgYXQgbGVhc3Qgb25lIGVycm9yLlxuICAgIGNvbnN0IGVycm9yID0gKGRlcHMgYXMge2Vycm9yczogQ29uc3RydWN0b3JEZXBFcnJvcltdfSkuZXJyb3JzWzBdO1xuICAgIHRocm93IGNyZWF0ZVVuc3VpdGFibGVJbmplY3Rpb25Ub2tlbkVycm9yKGNsYXp6LCBlcnJvcik7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZmF0YWwgZXJyb3Igd2l0aCBkaWFnbm9zdGljIGZvciBhbiBpbnZhbGlkIGluamVjdGlvbiB0b2tlbi5cbiAqIEBwYXJhbSBjbGF6eiBUaGUgY2xhc3MgZm9yIHdoaWNoIHRoZSBpbmplY3Rpb24gdG9rZW4gd2FzIHVuYXZhaWxhYmxlLlxuICogQHBhcmFtIGVycm9yIFRoZSByZWFzb24gd2h5IG5vIHZhbGlkIGluamVjdGlvbiB0b2tlbiBpcyBhdmFpbGFibGUuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVVuc3VpdGFibGVJbmplY3Rpb25Ub2tlbkVycm9yKFxuICAgIGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uLCBlcnJvcjogQ29uc3RydWN0b3JEZXBFcnJvcik6IEZhdGFsRGlhZ25vc3RpY0Vycm9yIHtcbiAgY29uc3Qge3BhcmFtLCBpbmRleCwgcmVhc29ufSA9IGVycm9yO1xuICBsZXQgY2hhaW5NZXNzYWdlOiBzdHJpbmd8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgaGludHM6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIHN3aXRjaCAocmVhc29uLmtpbmQpIHtcbiAgICBjYXNlIFZhbHVlVW5hdmFpbGFibGVLaW5kLlVOU1VQUE9SVEVEOlxuICAgICAgY2hhaW5NZXNzYWdlID0gJ0NvbnNpZGVyIHVzaW5nIHRoZSBASW5qZWN0IGRlY29yYXRvciB0byBzcGVjaWZ5IGFuIGluamVjdGlvbiB0b2tlbi4nO1xuICAgICAgaGludHMgPSBbXG4gICAgICAgIG1ha2VSZWxhdGVkSW5mb3JtYXRpb24ocmVhc29uLnR5cGVOb2RlLCAnVGhpcyB0eXBlIGlzIG5vdCBzdXBwb3J0ZWQgYXMgaW5qZWN0aW9uIHRva2VuLicpLFxuICAgICAgXTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgVmFsdWVVbmF2YWlsYWJsZUtpbmQuTk9fVkFMVUVfREVDTEFSQVRJT046XG4gICAgICBjaGFpbk1lc3NhZ2UgPSAnQ29uc2lkZXIgdXNpbmcgdGhlIEBJbmplY3QgZGVjb3JhdG9yIHRvIHNwZWNpZnkgYW4gaW5qZWN0aW9uIHRva2VuLic7XG4gICAgICBoaW50cyA9IFtcbiAgICAgICAgbWFrZVJlbGF0ZWRJbmZvcm1hdGlvbihcbiAgICAgICAgICAgIHJlYXNvbi50eXBlTm9kZSxcbiAgICAgICAgICAgICdUaGlzIHR5cGUgZG9lcyBub3QgaGF2ZSBhIHZhbHVlLCBzbyBpdCBjYW5ub3QgYmUgdXNlZCBhcyBpbmplY3Rpb24gdG9rZW4uJyksXG4gICAgICBdO1xuICAgICAgaWYgKHJlYXNvbi5kZWNsICE9PSBudWxsKSB7XG4gICAgICAgIGhpbnRzLnB1c2gobWFrZVJlbGF0ZWRJbmZvcm1hdGlvbihyZWFzb24uZGVjbCwgJ1RoZSB0eXBlIGlzIGRlY2xhcmVkIGhlcmUuJykpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBWYWx1ZVVuYXZhaWxhYmxlS2luZC5UWVBFX09OTFlfSU1QT1JUOlxuICAgICAgY2hhaW5NZXNzYWdlID1cbiAgICAgICAgICAnQ29uc2lkZXIgY2hhbmdpbmcgdGhlIHR5cGUtb25seSBpbXBvcnQgdG8gYSByZWd1bGFyIGltcG9ydCwgb3IgdXNlIHRoZSBASW5qZWN0IGRlY29yYXRvciB0byBzcGVjaWZ5IGFuIGluamVjdGlvbiB0b2tlbi4nO1xuICAgICAgaGludHMgPSBbXG4gICAgICAgIG1ha2VSZWxhdGVkSW5mb3JtYXRpb24oXG4gICAgICAgICAgICByZWFzb24udHlwZU5vZGUsXG4gICAgICAgICAgICAnVGhpcyB0eXBlIGlzIGltcG9ydGVkIHVzaW5nIGEgdHlwZS1vbmx5IGltcG9ydCwgd2hpY2ggcHJldmVudHMgaXQgZnJvbSBiZWluZyB1c2FibGUgYXMgYW4gaW5qZWN0aW9uIHRva2VuLicpLFxuICAgICAgICBtYWtlUmVsYXRlZEluZm9ybWF0aW9uKHJlYXNvbi5pbXBvcnRDbGF1c2UsICdUaGUgdHlwZS1vbmx5IGltcG9ydCBvY2N1cnMgaGVyZS4nKSxcbiAgICAgIF07XG4gICAgICBicmVhaztcbiAgICBjYXNlIFZhbHVlVW5hdmFpbGFibGVLaW5kLk5BTUVTUEFDRTpcbiAgICAgIGNoYWluTWVzc2FnZSA9ICdDb25zaWRlciB1c2luZyB0aGUgQEluamVjdCBkZWNvcmF0b3IgdG8gc3BlY2lmeSBhbiBpbmplY3Rpb24gdG9rZW4uJztcbiAgICAgIGhpbnRzID0gW1xuICAgICAgICBtYWtlUmVsYXRlZEluZm9ybWF0aW9uKFxuICAgICAgICAgICAgcmVhc29uLnR5cGVOb2RlLFxuICAgICAgICAgICAgJ1RoaXMgdHlwZSBjb3JyZXNwb25kcyB3aXRoIGEgbmFtZXNwYWNlLCB3aGljaCBjYW5ub3QgYmUgdXNlZCBhcyBpbmplY3Rpb24gdG9rZW4uJyksXG4gICAgICAgIG1ha2VSZWxhdGVkSW5mb3JtYXRpb24ocmVhc29uLmltcG9ydENsYXVzZSwgJ1RoZSBuYW1lc3BhY2UgaW1wb3J0IG9jY3VycyBoZXJlLicpLFxuICAgICAgXTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgVmFsdWVVbmF2YWlsYWJsZUtpbmQuVU5LTk9XTl9SRUZFUkVOQ0U6XG4gICAgICBjaGFpbk1lc3NhZ2UgPSAnVGhlIHR5cGUgc2hvdWxkIHJlZmVyZW5jZSBhIGtub3duIGRlY2xhcmF0aW9uLic7XG4gICAgICBoaW50cyA9IFttYWtlUmVsYXRlZEluZm9ybWF0aW9uKHJlYXNvbi50eXBlTm9kZSwgJ1RoaXMgdHlwZSBjb3VsZCBub3QgYmUgcmVzb2x2ZWQuJyldO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBWYWx1ZVVuYXZhaWxhYmxlS2luZC5NSVNTSU5HX1RZUEU6XG4gICAgICBjaGFpbk1lc3NhZ2UgPVxuICAgICAgICAgICdDb25zaWRlciBhZGRpbmcgYSB0eXBlIHRvIHRoZSBwYXJhbWV0ZXIgb3IgdXNlIHRoZSBASW5qZWN0IGRlY29yYXRvciB0byBzcGVjaWZ5IGFuIGluamVjdGlvbiB0b2tlbi4nO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBjb25zdCBjaGFpbjogdHMuRGlhZ25vc3RpY01lc3NhZ2VDaGFpbiA9IHtcbiAgICBtZXNzYWdlVGV4dDogYE5vIHN1aXRhYmxlIGluamVjdGlvbiB0b2tlbiBmb3IgcGFyYW1ldGVyICcke3BhcmFtLm5hbWUgfHwgaW5kZXh9JyBvZiBjbGFzcyAnJHtcbiAgICAgICAgY2xhenoubmFtZS50ZXh0fScuYCxcbiAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgIGNvZGU6IDAsXG4gICAgbmV4dDogW3tcbiAgICAgIG1lc3NhZ2VUZXh0OiBjaGFpbk1lc3NhZ2UsXG4gICAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5Lk1lc3NhZ2UsXG4gICAgICBjb2RlOiAwLFxuICAgIH1dLFxuICB9O1xuXG4gIHJldHVybiBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoRXJyb3JDb2RlLlBBUkFNX01JU1NJTkdfVE9LRU4sIHBhcmFtLm5hbWVOb2RlLCBjaGFpbiwgaGludHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9SM1JlZmVyZW5jZShcbiAgICB2YWx1ZVJlZjogUmVmZXJlbmNlLCB0eXBlUmVmOiBSZWZlcmVuY2UsIHZhbHVlQ29udGV4dDogdHMuU291cmNlRmlsZSxcbiAgICB0eXBlQ29udGV4dDogdHMuU291cmNlRmlsZSwgcmVmRW1pdHRlcjogUmVmZXJlbmNlRW1pdHRlcik6IFIzUmVmZXJlbmNlIHtcbiAgcmV0dXJuIHtcbiAgICB2YWx1ZTogcmVmRW1pdHRlci5lbWl0KHZhbHVlUmVmLCB2YWx1ZUNvbnRleHQpLmV4cHJlc3Npb24sXG4gICAgdHlwZTogcmVmRW1pdHRlclxuICAgICAgICAgICAgICAuZW1pdCh0eXBlUmVmLCB0eXBlQ29udGV4dCwgSW1wb3J0RmxhZ3MuRm9yY2VOZXdJbXBvcnQgfCBJbXBvcnRGbGFncy5BbGxvd1R5cGVJbXBvcnRzKVxuICAgICAgICAgICAgICAuZXhwcmVzc2lvbixcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQW5ndWxhckNvcmUoZGVjb3JhdG9yOiBEZWNvcmF0b3IpOiBkZWNvcmF0b3IgaXMgRGVjb3JhdG9yJntpbXBvcnQ6IEltcG9ydH0ge1xuICByZXR1cm4gZGVjb3JhdG9yLmltcG9ydCAhPT0gbnVsbCAmJiBkZWNvcmF0b3IuaW1wb3J0LmZyb20gPT09ICdAYW5ndWxhci9jb3JlJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQW5ndWxhckNvcmVSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UsIHN5bWJvbE5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gcmVmZXJlbmNlLm93bmVkQnlNb2R1bGVHdWVzcyA9PT0gJ0Bhbmd1bGFyL2NvcmUnICYmIHJlZmVyZW5jZS5kZWJ1Z05hbWUgPT09IHN5bWJvbE5hbWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaW5kQW5ndWxhckRlY29yYXRvcihcbiAgICBkZWNvcmF0b3JzOiBEZWNvcmF0b3JbXSwgbmFtZTogc3RyaW5nLCBpc0NvcmU6IGJvb2xlYW4pOiBEZWNvcmF0b3J8dW5kZWZpbmVkIHtcbiAgcmV0dXJuIGRlY29yYXRvcnMuZmluZChkZWNvcmF0b3IgPT4gaXNBbmd1bGFyRGVjb3JhdG9yKGRlY29yYXRvciwgbmFtZSwgaXNDb3JlKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuZ3VsYXJEZWNvcmF0b3IoZGVjb3JhdG9yOiBEZWNvcmF0b3IsIG5hbWU6IHN0cmluZywgaXNDb3JlOiBib29sZWFuKTogYm9vbGVhbiB7XG4gIGlmIChpc0NvcmUpIHtcbiAgICByZXR1cm4gZGVjb3JhdG9yLm5hbWUgPT09IG5hbWU7XG4gIH0gZWxzZSBpZiAoaXNBbmd1bGFyQ29yZShkZWNvcmF0b3IpKSB7XG4gICAgcmV0dXJuIGRlY29yYXRvci5pbXBvcnQubmFtZSA9PT0gbmFtZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogVW53cmFwIGEgYHRzLkV4cHJlc3Npb25gLCByZW1vdmluZyBvdXRlciB0eXBlLWNhc3RzIG9yIHBhcmVudGhlc2VzIHVudGlsIHRoZSBleHByZXNzaW9uIGlzIGluIGl0c1xuICogbG93ZXN0IGxldmVsIGZvcm0uXG4gKlxuICogRm9yIGV4YW1wbGUsIHRoZSBleHByZXNzaW9uIFwiKGZvbyBhcyBUeXBlKVwiIHVud3JhcHMgdG8gXCJmb29cIi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVud3JhcEV4cHJlc3Npb24obm9kZTogdHMuRXhwcmVzc2lvbik6IHRzLkV4cHJlc3Npb24ge1xuICB3aGlsZSAodHMuaXNBc0V4cHJlc3Npb24obm9kZSkgfHwgdHMuaXNQYXJlbnRoZXNpemVkRXhwcmVzc2lvbihub2RlKSkge1xuICAgIG5vZGUgPSBub2RlLmV4cHJlc3Npb247XG4gIH1cbiAgcmV0dXJuIG5vZGU7XG59XG5cbmZ1bmN0aW9uIGV4cGFuZEZvcndhcmRSZWYoYXJnOiB0cy5FeHByZXNzaW9uKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgYXJnID0gdW53cmFwRXhwcmVzc2lvbihhcmcpO1xuICBpZiAoIXRzLmlzQXJyb3dGdW5jdGlvbihhcmcpICYmICF0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihhcmcpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBib2R5ID0gYXJnLmJvZHk7XG4gIC8vIEVpdGhlciB0aGUgYm9keSBpcyBhIHRzLkV4cHJlc3Npb24gZGlyZWN0bHksIG9yIGEgYmxvY2sgd2l0aCBhIHNpbmdsZSByZXR1cm4gc3RhdGVtZW50LlxuICBpZiAodHMuaXNCbG9jayhib2R5KSkge1xuICAgIC8vIEJsb2NrIGJvZHkgLSBsb29rIGZvciBhIHNpbmdsZSByZXR1cm4gc3RhdGVtZW50LlxuICAgIGlmIChib2R5LnN0YXRlbWVudHMubGVuZ3RoICE9PSAxKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3RtdCA9IGJvZHkuc3RhdGVtZW50c1swXTtcbiAgICBpZiAoIXRzLmlzUmV0dXJuU3RhdGVtZW50KHN0bXQpIHx8IHN0bXQuZXhwcmVzc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHN0bXQuZXhwcmVzc2lvbjtcbiAgfSBlbHNlIHtcbiAgICAvLyBTaG9ydGhhbmQgYm9keSAtIHJldHVybiBhcyBhbiBleHByZXNzaW9uLlxuICAgIHJldHVybiBib2R5O1xuICB9XG59XG5cblxuLyoqXG4gKiBJZiB0aGUgZ2l2ZW4gYG5vZGVgIGlzIGEgZm9yd2FyZFJlZigpIGV4cHJlc3Npb24gdGhlbiByZXNvbHZlIGl0cyBpbm5lciB2YWx1ZSwgb3RoZXJ3aXNlIHJldHVyblxuICogYG51bGxgLlxuICpcbiAqIEBwYXJhbSBub2RlIHRoZSBmb3J3YXJkUmVmKCkgZXhwcmVzc2lvbiB0byByZXNvbHZlXG4gKiBAcGFyYW0gcmVmbGVjdG9yIGEgUmVmbGVjdGlvbkhvc3RcbiAqIEByZXR1cm5zIHRoZSByZXNvbHZlZCBleHByZXNzaW9uLCBpZiB0aGUgb3JpZ2luYWwgZXhwcmVzc2lvbiB3YXMgYSBmb3J3YXJkUmVmKCksIG9yIGBudWxsYFxuICogICAgIG90aGVyd2lzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyeVVud3JhcEZvcndhcmRSZWYobm9kZTogdHMuRXhwcmVzc2lvbiwgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCk6IHRzLkV4cHJlc3Npb258XG4gICAgbnVsbCB7XG4gIG5vZGUgPSB1bndyYXBFeHByZXNzaW9uKG5vZGUpO1xuICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24obm9kZSkgfHwgbm9kZS5hcmd1bWVudHMubGVuZ3RoICE9PSAxKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBmbiA9XG4gICAgICB0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24pID8gbm9kZS5leHByZXNzaW9uLm5hbWUgOiBub2RlLmV4cHJlc3Npb247XG4gIGlmICghdHMuaXNJZGVudGlmaWVyKGZuKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgZXhwciA9IGV4cGFuZEZvcndhcmRSZWYobm9kZS5hcmd1bWVudHNbMF0pO1xuICBpZiAoZXhwciA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgaW1wID0gcmVmbGVjdG9yLmdldEltcG9ydE9mSWRlbnRpZmllcihmbik7XG4gIGlmIChpbXAgPT09IG51bGwgfHwgaW1wLmZyb20gIT09ICdAYW5ndWxhci9jb3JlJyB8fCBpbXAubmFtZSAhPT0gJ2ZvcndhcmRSZWYnKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gZXhwcjtcbn1cblxuLyoqXG4gKiBBIGZvcmVpZ24gZnVuY3Rpb24gcmVzb2x2ZXIgZm9yIGBzdGF0aWNhbGx5UmVzb2x2ZWAgd2hpY2ggdW53cmFwcyBmb3J3YXJkUmVmKCkgZXhwcmVzc2lvbnMuXG4gKlxuICogQHBhcmFtIHJlZiBhIFJlZmVyZW5jZSB0byB0aGUgZGVjbGFyYXRpb24gb2YgdGhlIGZ1bmN0aW9uIGJlaW5nIGNhbGxlZCAod2hpY2ggbWlnaHQgYmVcbiAqIGZvcndhcmRSZWYpXG4gKiBAcGFyYW0gYXJncyB0aGUgYXJndW1lbnRzIHRvIHRoZSBpbnZvY2F0aW9uIG9mIHRoZSBmb3J3YXJkUmVmIGV4cHJlc3Npb25cbiAqIEByZXR1cm5zIGFuIHVud3JhcHBlZCBhcmd1bWVudCBpZiBgcmVmYCBwb2ludGVkIHRvIGZvcndhcmRSZWYsIG9yIG51bGwgb3RoZXJ3aXNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3J3YXJkUmVmUmVzb2x2ZXIoXG4gICAgcmVmOiBSZWZlcmVuY2U8dHMuRnVuY3Rpb25EZWNsYXJhdGlvbnx0cy5NZXRob2REZWNsYXJhdGlvbnx0cy5GdW5jdGlvbkV4cHJlc3Npb24+LFxuICAgIGFyZ3M6IFJlYWRvbmx5QXJyYXk8dHMuRXhwcmVzc2lvbj4pOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICBpZiAoIWlzQW5ndWxhckNvcmVSZWZlcmVuY2UocmVmLCAnZm9yd2FyZFJlZicpIHx8IGFyZ3MubGVuZ3RoICE9PSAxKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIGV4cGFuZEZvcndhcmRSZWYoYXJnc1swXSk7XG59XG5cbi8qKlxuICogQ29tYmluZXMgYW4gYXJyYXkgb2YgcmVzb2x2ZXIgZnVuY3Rpb25zIGludG8gYSBvbmUuXG4gKiBAcGFyYW0gcmVzb2x2ZXJzIFJlc29sdmVycyB0byBiZSBjb21iaW5lZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbWJpbmVSZXNvbHZlcnMocmVzb2x2ZXJzOiBGb3JlaWduRnVuY3Rpb25SZXNvbHZlcltdKTogRm9yZWlnbkZ1bmN0aW9uUmVzb2x2ZXIge1xuICByZXR1cm4gKHJlZjogUmVmZXJlbmNlPHRzLkZ1bmN0aW9uRGVjbGFyYXRpb258dHMuTWV0aG9kRGVjbGFyYXRpb258dHMuRnVuY3Rpb25FeHByZXNzaW9uPixcbiAgICAgICAgICBhcmdzOiBSZWFkb25seUFycmF5PHRzLkV4cHJlc3Npb24+KTogdHMuRXhwcmVzc2lvbnxudWxsID0+IHtcbiAgICBmb3IgKGNvbnN0IHJlc29sdmVyIG9mIHJlc29sdmVycykge1xuICAgICAgY29uc3QgcmVzb2x2ZWQgPSByZXNvbHZlcihyZWYsIGFyZ3MpO1xuICAgICAgaWYgKHJlc29sdmVkICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0V4cHJlc3Npb25Gb3J3YXJkUmVmZXJlbmNlKFxuICAgIGV4cHI6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHRzLk5vZGUsIGNvbnRleHRTb3VyY2U6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgaWYgKGlzV3JhcHBlZFRzTm9kZUV4cHIoZXhwcikpIHtcbiAgICBjb25zdCBub2RlID0gdHMuZ2V0T3JpZ2luYWxOb2RlKGV4cHIubm9kZSk7XG4gICAgcmV0dXJuIG5vZGUuZ2V0U291cmNlRmlsZSgpID09PSBjb250ZXh0U291cmNlICYmIGNvbnRleHQucG9zIDwgbm9kZS5wb3M7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1dyYXBwZWRUc05vZGVFeHByKGV4cHI6IEV4cHJlc3Npb24pOiBleHByIGlzIFdyYXBwZWROb2RlRXhwcjx0cy5Ob2RlPiB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2YgV3JhcHBlZE5vZGVFeHByO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEJhc2VDbGFzcyhcbiAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPnwnZHluYW1pYyd8bnVsbCB7XG4gIGNvbnN0IGJhc2VFeHByZXNzaW9uID0gcmVmbGVjdG9yLmdldEJhc2VDbGFzc0V4cHJlc3Npb24obm9kZSk7XG4gIGlmIChiYXNlRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGJhc2VDbGFzcyA9IGV2YWx1YXRvci5ldmFsdWF0ZShiYXNlRXhwcmVzc2lvbik7XG4gICAgaWYgKGJhc2VDbGFzcyBpbnN0YW5jZW9mIFJlZmVyZW5jZSAmJiByZWZsZWN0b3IuaXNDbGFzcyhiYXNlQ2xhc3Mubm9kZSkpIHtcbiAgICAgIHJldHVybiBiYXNlQ2xhc3MgYXMgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ2R5bmFtaWMnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5jb25zdCBwYXJlbnNXcmFwcGVyVHJhbnNmb3JtZXJGYWN0b3J5OiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuRXhwcmVzc2lvbj4gPVxuICAgIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpID0+IHtcbiAgICAgIGNvbnN0IHZpc2l0b3I6IHRzLlZpc2l0b3IgPSAobm9kZTogdHMuTm9kZSk6IHRzLk5vZGUgPT4ge1xuICAgICAgICBjb25zdCB2aXNpdGVkID0gdHMudmlzaXRFYWNoQ2hpbGQobm9kZSwgdmlzaXRvciwgY29udGV4dCk7XG4gICAgICAgIGlmICh0cy5pc0Fycm93RnVuY3Rpb24odmlzaXRlZCkgfHwgdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24odmlzaXRlZCkpIHtcbiAgICAgICAgICByZXR1cm4gdHMuY3JlYXRlUGFyZW4odmlzaXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZpc2l0ZWQ7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIChub2RlOiB0cy5FeHByZXNzaW9uKSA9PiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9O1xuXG4vKipcbiAqIFdyYXBzIGFsbCBmdW5jdGlvbnMgaW4gYSBnaXZlbiBleHByZXNzaW9uIGluIHBhcmVudGhlc2VzLiBUaGlzIGlzIG5lZWRlZCB0byBhdm9pZCBwcm9ibGVtc1xuICogd2hlcmUgVHNpY2tsZSBhbm5vdGF0aW9ucyBhZGRlZCBiZXR3ZWVuIGFuYWx5c2UgYW5kIHRyYW5zZm9ybSBwaGFzZXMgaW4gQW5ndWxhciBtYXkgdHJpZ2dlclxuICogYXV0b21hdGljIHNlbWljb2xvbiBpbnNlcnRpb24sIGUuZy4gaWYgYSBmdW5jdGlvbiBpcyB0aGUgZXhwcmVzc2lvbiBpbiBhIGByZXR1cm5gIHN0YXRlbWVudC5cbiAqIE1vcmVcbiAqIGluZm8gY2FuIGJlIGZvdW5kIGluIFRzaWNrbGUgc291cmNlIGNvZGUgaGVyZTpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL3RzaWNrbGUvYmxvYi9kNzk3NDI2MjU3MWM4YTE3ZDY4NGU1YmEwNzY4MGUxYjE5OTNhZmRkL3NyYy9qc2RvY190cmFuc2Zvcm1lci50cyNMMTAyMVxuICpcbiAqIEBwYXJhbSBleHByZXNzaW9uIEV4cHJlc3Npb24gd2hlcmUgZnVuY3Rpb25zIHNob3VsZCBiZSB3cmFwcGVkIGluIHBhcmVudGhlc2VzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cmFwRnVuY3Rpb25FeHByZXNzaW9uc0luUGFyZW5zKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiB0cy5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIHRzLnRyYW5zZm9ybShleHByZXNzaW9uLCBbcGFyZW5zV3JhcHBlclRyYW5zZm9ybWVyRmFjdG9yeV0pLnRyYW5zZm9ybWVkWzBdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGB0cy5EaWFnbm9zdGljYCB3aGljaCBpbmRpY2F0ZXMgdGhlIGdpdmVuIGNsYXNzIGlzIHBhcnQgb2YgdGhlIGRlY2xhcmF0aW9ucyBvZiB0d28gb3JcbiAqIG1vcmUgTmdNb2R1bGVzLlxuICpcbiAqIFRoZSByZXN1bHRpbmcgYHRzLkRpYWdub3N0aWNgIHdpbGwgaGF2ZSBhIGNvbnRleHQgZW50cnkgZm9yIGVhY2ggTmdNb2R1bGUgc2hvd2luZyB0aGUgcG9pbnQgd2hlcmVcbiAqIHRoZSBkaXJlY3RpdmUvcGlwZSBleGlzdHMgaW4gaXRzIGBkZWNsYXJhdGlvbnNgIChpZiBwb3NzaWJsZSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlRHVwbGljYXRlRGVjbGFyYXRpb25FcnJvcihcbiAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkYXRhOiBEZWNsYXJhdGlvbkRhdGFbXSwga2luZDogc3RyaW5nKTogdHMuRGlhZ25vc3RpYyB7XG4gIGNvbnN0IGNvbnRleHQ6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGRlY2wgb2YgZGF0YSkge1xuICAgIGlmIChkZWNsLnJhd0RlY2xhcmF0aW9ucyA9PT0gbnVsbCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRyeSB0byBmaW5kIHRoZSByZWZlcmVuY2UgdG8gdGhlIGRlY2xhcmF0aW9uIHdpdGhpbiB0aGUgZGVjbGFyYXRpb25zIGFycmF5LCB0byBoYW5nIHRoZVxuICAgIC8vIGVycm9yIHRoZXJlLiBJZiBpdCBjYW4ndCBiZSBmb3VuZCwgZmFsbCBiYWNrIG9uIHVzaW5nIHRoZSBOZ01vZHVsZSdzIG5hbWUuXG4gICAgY29uc3QgY29udGV4dE5vZGUgPSBkZWNsLnJlZi5nZXRPcmlnaW5Gb3JEaWFnbm9zdGljcyhkZWNsLnJhd0RlY2xhcmF0aW9ucywgZGVjbC5uZ01vZHVsZS5uYW1lKTtcbiAgICBjb250ZXh0LnB1c2gobWFrZVJlbGF0ZWRJbmZvcm1hdGlvbihcbiAgICAgICAgY29udGV4dE5vZGUsXG4gICAgICAgIGAnJHtub2RlLm5hbWUudGV4dH0nIGlzIGxpc3RlZCBpbiB0aGUgZGVjbGFyYXRpb25zIG9mIHRoZSBOZ01vZHVsZSAnJHtcbiAgICAgICAgICAgIGRlY2wubmdNb2R1bGUubmFtZS50ZXh0fScuYCkpO1xuICB9XG5cbiAgLy8gRmluYWxseSwgcHJvZHVjZSB0aGUgZGlhZ25vc3RpYy5cbiAgcmV0dXJuIG1ha2VEaWFnbm9zdGljKFxuICAgICAgRXJyb3JDb2RlLk5HTU9EVUxFX0RFQ0xBUkFUSU9OX05PVF9VTklRVUUsIG5vZGUubmFtZSxcbiAgICAgIGBUaGUgJHtraW5kfSAnJHtub2RlLm5hbWUudGV4dH0nIGlzIGRlY2xhcmVkIGJ5IG1vcmUgdGhhbiBvbmUgTmdNb2R1bGUuYCwgY29udGV4dCk7XG59XG5cbi8qKlxuICogUmVzb2x2ZXMgdGhlIGdpdmVuIGByYXdQcm92aWRlcnNgIGludG8gYENsYXNzRGVjbGFyYXRpb25zYCBhbmQgcmV0dXJuc1xuICogYSBzZXQgY29udGFpbmluZyB0aG9zZSB0aGF0IGFyZSBrbm93biB0byByZXF1aXJlIGEgZmFjdG9yeSBkZWZpbml0aW9uLlxuICogQHBhcmFtIHJhd1Byb3ZpZGVycyBFeHByZXNzaW9uIHRoYXQgZGVjbGFyZWQgdGhlIHByb3ZpZGVycyBhcnJheSBpbiB0aGUgc291cmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkoXG4gICAgcmF3UHJvdmlkZXJzOiB0cy5FeHByZXNzaW9uLCByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFNldDxSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4+IHtcbiAgY29uc3QgcHJvdmlkZXJzID0gbmV3IFNldDxSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4+KCk7XG4gIGNvbnN0IHJlc29sdmVkUHJvdmlkZXJzID0gZXZhbHVhdG9yLmV2YWx1YXRlKHJhd1Byb3ZpZGVycyk7XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KHJlc29sdmVkUHJvdmlkZXJzKSkge1xuICAgIHJldHVybiBwcm92aWRlcnM7XG4gIH1cblxuICByZXNvbHZlZFByb3ZpZGVycy5mb3JFYWNoKGZ1bmN0aW9uIHByb2Nlc3NQcm92aWRlcnMocHJvdmlkZXIpIHtcbiAgICBsZXQgdG9rZW5DbGFzczogUmVmZXJlbmNlfG51bGwgPSBudWxsO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocHJvdmlkZXIpKSB7XG4gICAgICAvLyBJZiB3ZSByYW4gaW50byBhbiBhcnJheSwgcmVjdXJzZSBpbnRvIGl0IHVudGlsIHdlJ3ZlIHJlc29sdmUgYWxsIHRoZSBjbGFzc2VzLlxuICAgICAgcHJvdmlkZXIuZm9yRWFjaChwcm9jZXNzUHJvdmlkZXJzKTtcbiAgICB9IGVsc2UgaWYgKHByb3ZpZGVyIGluc3RhbmNlb2YgUmVmZXJlbmNlKSB7XG4gICAgICB0b2tlbkNsYXNzID0gcHJvdmlkZXI7XG4gICAgfSBlbHNlIGlmIChwcm92aWRlciBpbnN0YW5jZW9mIE1hcCAmJiBwcm92aWRlci5oYXMoJ3VzZUNsYXNzJykgJiYgIXByb3ZpZGVyLmhhcygnZGVwcycpKSB7XG4gICAgICBjb25zdCB1c2VFeGlzdGluZyA9IHByb3ZpZGVyLmdldCgndXNlQ2xhc3MnKSE7XG4gICAgICBpZiAodXNlRXhpc3RpbmcgaW5zdGFuY2VvZiBSZWZlcmVuY2UpIHtcbiAgICAgICAgdG9rZW5DbGFzcyA9IHVzZUV4aXN0aW5nO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRPRE8oYWx4aHViKTogdGhlcmUgd2FzIGEgYnVnIHdoZXJlIGBnZXRDb25zdHJ1Y3RvclBhcmFtZXRlcnNgIHdvdWxkIHJldHVybiBgbnVsbGAgZm9yIGFcbiAgICAvLyBjbGFzcyBpbiBhIC5kLnRzIGZpbGUsIGFsd2F5cywgZXZlbiBpZiB0aGUgY2xhc3MgaGFkIGEgY29uc3RydWN0b3IuIFRoaXMgd2FzIGZpeGVkIGZvclxuICAgIC8vIGBnZXRDb25zdHJ1Y3RvclBhcmFtZXRlcnNgLCBidXQgdGhhdCBmaXggY2F1c2VzIG1vcmUgY2xhc3NlcyB0byBiZSByZWNvZ25pemVkIGhlcmUgYXMgbmVlZGluZ1xuICAgIC8vIHByb3ZpZGVyIGNoZWNrcywgd2hpY2ggaXMgYSBicmVha2luZyBjaGFuZ2UgaW4gZzMuIEF2b2lkIHRoaXMgYnJlYWthZ2UgZm9yIG5vdyBieSBza2lwcGluZ1xuICAgIC8vIGNsYXNzZXMgZnJvbSAuZC50cyBmaWxlcyBoZXJlIGRpcmVjdGx5LCB1bnRpbCBnMyBjYW4gYmUgY2xlYW5lZCB1cC5cbiAgICBpZiAodG9rZW5DbGFzcyAhPT0gbnVsbCAmJiAhdG9rZW5DbGFzcy5ub2RlLmdldFNvdXJjZUZpbGUoKS5pc0RlY2xhcmF0aW9uRmlsZSAmJlxuICAgICAgICByZWZsZWN0b3IuaXNDbGFzcyh0b2tlbkNsYXNzLm5vZGUpKSB7XG4gICAgICBjb25zdCBjb25zdHJ1Y3RvclBhcmFtZXRlcnMgPSByZWZsZWN0b3IuZ2V0Q29uc3RydWN0b3JQYXJhbWV0ZXJzKHRva2VuQ2xhc3Mubm9kZSk7XG5cbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBvbmx5IHdhbnQgdG8gY2FwdHVyZSBwcm92aWRlcnMgd2l0aCBhIG5vbi10cml2aWFsIGNvbnN0cnVjdG9yLFxuICAgICAgLy8gYmVjYXVzZSB0aGV5J3JlIHRoZSBvbmVzIHRoYXQgbWlnaHQgYmUgdXNpbmcgREkgYW5kIG5lZWQgdG8gYmUgZGVjb3JhdGVkLlxuICAgICAgaWYgKGNvbnN0cnVjdG9yUGFyYW1ldGVycyAhPT0gbnVsbCAmJiBjb25zdHJ1Y3RvclBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBwcm92aWRlcnMuYWRkKHRva2VuQ2xhc3MgYXMgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+KTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwcm92aWRlcnM7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIFIzUmVmZXJlbmNlIGZvciBhIGNsYXNzLlxuICpcbiAqIFRoZSBgdmFsdWVgIGlzIHRoZSBleHBvcnRlZCBkZWNsYXJhdGlvbiBvZiB0aGUgY2xhc3MgZnJvbSBpdHMgc291cmNlIGZpbGUuXG4gKiBUaGUgYHR5cGVgIGlzIGFuIGV4cHJlc3Npb24gdGhhdCB3b3VsZCBiZSB1c2VkIGJ5IG5nY2MgaW4gdGhlIHR5cGluZ3MgKC5kLnRzKSBmaWxlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyYXBUeXBlUmVmZXJlbmNlKHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogUjNSZWZlcmVuY2Uge1xuICBjb25zdCBkdHNDbGFzcyA9IHJlZmxlY3Rvci5nZXREdHNEZWNsYXJhdGlvbihjbGF6eik7XG4gIGNvbnN0IHZhbHVlID0gbmV3IFdyYXBwZWROb2RlRXhwcihjbGF6ei5uYW1lKTtcbiAgY29uc3QgdHlwZSA9IGR0c0NsYXNzICE9PSBudWxsICYmIGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKGR0c0NsYXNzKSA/XG4gICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGR0c0NsYXNzLm5hbWUpIDpcbiAgICAgIHZhbHVlO1xuICByZXR1cm4ge3ZhbHVlLCB0eXBlfTtcbn1cblxuLyoqIENyZWF0ZXMgYSBQYXJzZVNvdXJjZVNwYW4gZm9yIGEgVHlwZVNjcmlwdCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNvdXJjZVNwYW4obm9kZTogdHMuTm9kZSk6IFBhcnNlU291cmNlU3BhbiB7XG4gIGNvbnN0IHNmID0gbm9kZS5nZXRTb3VyY2VGaWxlKCk7XG4gIGNvbnN0IFtzdGFydE9mZnNldCwgZW5kT2Zmc2V0XSA9IFtub2RlLmdldFN0YXJ0KCksIG5vZGUuZ2V0RW5kKCldO1xuICBjb25zdCB7bGluZTogc3RhcnRMaW5lLCBjaGFyYWN0ZXI6IHN0YXJ0Q29sfSA9IHNmLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKHN0YXJ0T2Zmc2V0KTtcbiAgY29uc3Qge2xpbmU6IGVuZExpbmUsIGNoYXJhY3RlcjogZW5kQ29sfSA9IHNmLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKGVuZE9mZnNldCk7XG4gIGNvbnN0IHBhcnNlU2YgPSBuZXcgUGFyc2VTb3VyY2VGaWxlKHNmLmdldEZ1bGxUZXh0KCksIHNmLmZpbGVOYW1lKTtcblxuICAvLyArMSBiZWNhdXNlIHZhbHVlcyBhcmUgemVyby1pbmRleGVkLlxuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgIG5ldyBQYXJzZUxvY2F0aW9uKHBhcnNlU2YsIHN0YXJ0T2Zmc2V0LCBzdGFydExpbmUgKyAxLCBzdGFydENvbCArIDEpLFxuICAgICAgbmV3IFBhcnNlTG9jYXRpb24ocGFyc2VTZiwgZW5kT2Zmc2V0LCBlbmRMaW5lICsgMSwgZW5kQ29sICsgMSkpO1xufVxuXG4vKipcbiAqIENvbGxhdGUgdGhlIGZhY3RvcnkgYW5kIGRlZmluaXRpb24gY29tcGlsZWQgcmVzdWx0cyBpbnRvIGFuIGFycmF5IG9mIENvbXBpbGVSZXN1bHQgb2JqZWN0cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVSZXN1bHRzKFxuICAgIGZhYzogQ29tcGlsZVJlc3VsdCwgZGVmOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiwgbWV0YWRhdGFTdG10OiBTdGF0ZW1lbnR8bnVsbCxcbiAgICBwcm9wTmFtZTogc3RyaW5nKTogQ29tcGlsZVJlc3VsdFtdIHtcbiAgY29uc3Qgc3RhdGVtZW50cyA9IGRlZi5zdGF0ZW1lbnRzO1xuICBpZiAobWV0YWRhdGFTdG10ICE9PSBudWxsKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKG1ldGFkYXRhU3RtdCk7XG4gIH1cbiAgcmV0dXJuIFtcbiAgICBmYWMsIHtcbiAgICAgIG5hbWU6IHByb3BOYW1lLFxuICAgICAgaW5pdGlhbGl6ZXI6IGRlZi5leHByZXNzaW9uLFxuICAgICAgc3RhdGVtZW50czogZGVmLnN0YXRlbWVudHMsXG4gICAgICB0eXBlOiBkZWYudHlwZSxcbiAgICB9XG4gIF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0ZhY3RvcnlNZXRhZGF0YShcbiAgICBtZXRhOiBPbWl0PFIzRmFjdG9yeU1ldGFkYXRhLCAndGFyZ2V0Jz4sIHRhcmdldDogRmFjdG9yeVRhcmdldCk6IFIzRmFjdG9yeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGludGVybmFsVHlwZTogbWV0YS5pbnRlcm5hbFR5cGUsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IG1ldGEudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgZGVwczogbWV0YS5kZXBzLFxuICAgIHRhcmdldFxuICB9O1xufVxuIl19