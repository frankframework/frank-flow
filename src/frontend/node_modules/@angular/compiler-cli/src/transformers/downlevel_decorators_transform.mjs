/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isAliasImportDeclaration, loadIsReferencedAliasDeclarationPatch } from './patch_alias_reference_resolution';
/**
 * Whether a given decorator should be treated as an Angular decorator.
 * Either it's used in @angular/core, or it's imported from there.
 */
function isAngularDecorator(decorator, isCore) {
    return isCore || (decorator.import !== null && decorator.import.from === '@angular/core');
}
/*
 #####################################################################
  Code below has been extracted from the tsickle decorator downlevel transformer
  and a few local modifications have been applied:

    1. Tsickle by default processed all decorators that had the `@Annotation` JSDoc.
       We modified the transform to only be concerned with known Angular decorators.
    2. Tsickle by default added `@nocollapse` to all generated `ctorParameters` properties.
       We only do this when `annotateForClosureCompiler` is enabled.
    3. Tsickle does not handle union types for dependency injection. i.e. if a injected type
       is denoted with `@Optional`, the actual type could be set to `T | null`.
       See: https://github.com/angular/angular-cli/commit/826803d0736b807867caff9f8903e508970ad5e4.
    4. Tsickle relied on `emitDecoratorMetadata` to be set to `true`. This is due to a limitation
       in TypeScript transformers that never has been fixed. We were able to work around this
       limitation so that `emitDecoratorMetadata` doesn't need to be specified.
       See: `patchAliasReferenceResolution` for more details.

  Here is a link to the tsickle revision on which this transformer is based:
  https://github.com/angular/tsickle/blob/fae06becb1570f491806060d83f29f2d50c43cdd/src/decorator_downlevel_transformer.ts
 #####################################################################
*/
/**
 * Creates the AST for the decorator field type annotation, which has the form
 *     { type: Function, args?: any[] }[]
 */
function createDecoratorInvocationType() {
    const typeElements = [];
    typeElements.push(ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('Function'), undefined), undefined));
    typeElements.push(ts.createPropertySignature(undefined, 'args', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)), undefined));
    return ts.createArrayTypeNode(ts.createTypeLiteralNode(typeElements));
}
/**
 * Extracts the type of the decorator (the function or expression invoked), as well as all the
 * arguments passed to the decorator. Returns an AST with the form:
 *
 *     // For @decorator(arg1, arg2)
 *     { type: decorator, args: [arg1, arg2] }
 */
function extractMetadataFromSingleDecorator(decorator, diagnostics) {
    const metadataProperties = [];
    const expr = decorator.expression;
    switch (expr.kind) {
        case ts.SyntaxKind.Identifier:
            // The decorator was a plain @Foo.
            metadataProperties.push(ts.createPropertyAssignment('type', expr));
            break;
        case ts.SyntaxKind.CallExpression:
            // The decorator was a call, like @Foo(bar).
            const call = expr;
            metadataProperties.push(ts.createPropertyAssignment('type', call.expression));
            if (call.arguments.length) {
                const args = [];
                for (const arg of call.arguments) {
                    args.push(arg);
                }
                const argsArrayLiteral = ts.createArrayLiteral(args);
                argsArrayLiteral.elements.hasTrailingComma = true;
                metadataProperties.push(ts.createPropertyAssignment('args', argsArrayLiteral));
            }
            break;
        default:
            diagnostics.push({
                file: decorator.getSourceFile(),
                start: decorator.getStart(),
                length: decorator.getEnd() - decorator.getStart(),
                messageText: `${ts.SyntaxKind[decorator.kind]} not implemented in gathering decorator metadata.`,
                category: ts.DiagnosticCategory.Error,
                code: 0,
            });
            break;
    }
    return ts.createObjectLiteral(metadataProperties);
}
/**
 * Takes a list of decorator metadata object ASTs and produces an AST for a
 * static class property of an array of those metadata objects.
 */
function createDecoratorClassProperty(decoratorList) {
    const modifier = ts.createToken(ts.SyntaxKind.StaticKeyword);
    const type = createDecoratorInvocationType();
    const initializer = ts.createArrayLiteral(decoratorList, true);
    // NB: the .decorators property does not get a @nocollapse property. There is
    // no good reason why - it means .decorators is not runtime accessible if you
    // compile with collapse properties, whereas propDecorators is, which doesn't
    // follow any stringent logic. However this has been the case previously, and
    // adding it back in leads to substantial code size increases as Closure fails
    // to tree shake these props without @nocollapse.
    return ts.createProperty(undefined, [modifier], 'decorators', undefined, type, initializer);
}
/**
 * Creates the AST for the 'ctorParameters' field type annotation:
 *   () => ({ type: any, decorators?: {type: Function, args?: any[]}[] }|null)[]
 */
function createCtorParametersClassPropertyType() {
    // Sorry about this. Try reading just the string literals below.
    const typeElements = [];
    typeElements.push(ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('any'), undefined), undefined));
    typeElements.push(ts.createPropertySignature(undefined, 'decorators', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createTypeLiteralNode([
        ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('Function'), undefined), undefined),
        ts.createPropertySignature(undefined, 'args', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createTypeReferenceNode(ts.createIdentifier('any'), undefined)), undefined),
    ])), undefined));
    return ts.createFunctionTypeNode(undefined, [], ts.createArrayTypeNode(ts.createUnionTypeNode([
        ts.createTypeLiteralNode(typeElements),
        ts.createLiteralTypeNode(ts.createNull()),
    ])));
}
/**
 * Sets a Closure \@nocollapse synthetic comment on the given node. This prevents Closure Compiler
 * from collapsing the apparently static property, which would make it impossible to find for code
 * trying to detect it at runtime.
 */
function addNoCollapseComment(n) {
    ts.setSyntheticLeadingComments(n, [{
            kind: ts.SyntaxKind.MultiLineCommentTrivia,
            text: '* @nocollapse ',
            pos: -1,
            end: -1,
            hasTrailingNewLine: true
        }]);
}
/**
 * createCtorParametersClassProperty creates a static 'ctorParameters' property containing
 * downleveled decorator information.
 *
 * The property contains an arrow function that returns an array of object literals of the shape:
 *     static ctorParameters = () => [{
 *       type: SomeClass|undefined,  // the type of the param that's decorated, if it's a value.
 *       decorators: [{
 *         type: DecoratorFn,  // the type of the decorator that's invoked.
 *         args: [ARGS],       // the arguments passed to the decorator.
 *       }]
 *     }];
 */
function createCtorParametersClassProperty(diagnostics, entityNameToExpression, ctorParameters, isClosureCompilerEnabled) {
    const params = [];
    for (const ctorParam of ctorParameters) {
        if (!ctorParam.type && ctorParam.decorators.length === 0) {
            params.push(ts.createNull());
            continue;
        }
        const paramType = ctorParam.type ?
            typeReferenceToExpression(entityNameToExpression, ctorParam.type) :
            undefined;
        const members = [ts.createPropertyAssignment('type', paramType || ts.createIdentifier('undefined'))];
        const decorators = [];
        for (const deco of ctorParam.decorators) {
            decorators.push(extractMetadataFromSingleDecorator(deco, diagnostics));
        }
        if (decorators.length) {
            members.push(ts.createPropertyAssignment('decorators', ts.createArrayLiteral(decorators)));
        }
        params.push(ts.createObjectLiteral(members));
    }
    const initializer = ts.createArrowFunction(undefined, undefined, [], undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.createArrayLiteral(params, true));
    const type = createCtorParametersClassPropertyType();
    const ctorProp = ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], 'ctorParameters', undefined, type, initializer);
    if (isClosureCompilerEnabled) {
        addNoCollapseComment(ctorProp);
    }
    return ctorProp;
}
/**
 * createPropDecoratorsClassProperty creates a static 'propDecorators' property containing type
 * information for every property that has a decorator applied.
 *
 *     static propDecorators: {[key: string]: {type: Function, args?: any[]}[]} = {
 *       propA: [{type: MyDecorator, args: [1, 2]}, ...],
 *       ...
 *     };
 */
function createPropDecoratorsClassProperty(diagnostics, properties) {
    //  `static propDecorators: {[key: string]: ` + {type: Function, args?: any[]}[] + `} = {\n`);
    const entries = [];
    for (const [name, decorators] of properties.entries()) {
        entries.push(ts.createPropertyAssignment(name, ts.createArrayLiteral(decorators.map(deco => extractMetadataFromSingleDecorator(deco, diagnostics)))));
    }
    const initializer = ts.createObjectLiteral(entries, true);
    const type = ts.createTypeLiteralNode([ts.createIndexSignature(undefined, undefined, [ts.createParameter(undefined, undefined, undefined, 'key', undefined, ts.createTypeReferenceNode('string', undefined), undefined)], createDecoratorInvocationType())]);
    return ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], 'propDecorators', undefined, type, initializer);
}
/**
 * Returns an expression representing the (potentially) value part for the given node.
 *
 * This is a partial re-implementation of TypeScript's serializeTypeReferenceNode. This is a
 * workaround for https://github.com/Microsoft/TypeScript/issues/17516 (serializeTypeReferenceNode
 * not being exposed). In practice this implementation is sufficient for Angular's use of type
 * metadata.
 */
function typeReferenceToExpression(entityNameToExpression, node) {
    let kind = node.kind;
    if (ts.isLiteralTypeNode(node)) {
        // Treat literal types like their base type (boolean, string, number).
        kind = node.literal.kind;
    }
    switch (kind) {
        case ts.SyntaxKind.FunctionType:
        case ts.SyntaxKind.ConstructorType:
            return ts.createIdentifier('Function');
        case ts.SyntaxKind.ArrayType:
        case ts.SyntaxKind.TupleType:
            return ts.createIdentifier('Array');
        case ts.SyntaxKind.TypePredicate:
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
        case ts.SyntaxKind.BooleanKeyword:
            return ts.createIdentifier('Boolean');
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.StringKeyword:
            return ts.createIdentifier('String');
        case ts.SyntaxKind.ObjectKeyword:
            return ts.createIdentifier('Object');
        case ts.SyntaxKind.NumberKeyword:
        case ts.SyntaxKind.NumericLiteral:
            return ts.createIdentifier('Number');
        case ts.SyntaxKind.TypeReference:
            const typeRef = node;
            // Ignore any generic types, just return the base type.
            return entityNameToExpression(typeRef.typeName);
        case ts.SyntaxKind.UnionType:
            const childTypeNodes = node
                .types.filter(t => !(ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword));
            return childTypeNodes.length === 1 ?
                typeReferenceToExpression(entityNameToExpression, childTypeNodes[0]) :
                undefined;
        default:
            return undefined;
    }
}
/**
 * Checks whether a given symbol refers to a value that exists at runtime (as distinct from a type).
 *
 * Expands aliases, which is important for the case where
 *   import * as x from 'some-module';
 * and x is now a value (the module object).
 */
function symbolIsRuntimeValue(typeChecker, symbol) {
    if (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = typeChecker.getAliasedSymbol(symbol);
    }
    // Note that const enums are a special case, because
    // while they have a value, they don't exist at runtime.
    return (symbol.flags & ts.SymbolFlags.Value & ts.SymbolFlags.ConstEnumExcludes) !== 0;
}
/**
 * Gets a transformer for downleveling Angular decorators.
 * @param typeChecker Reference to the program's type checker.
 * @param host Reflection host that is used for determining decorators.
 * @param diagnostics List which will be populated with diagnostics if any.
 * @param isCore Whether the current TypeScript program is for the `@angular/core` package.
 * @param isClosureCompilerEnabled Whether closure annotations need to be added where needed.
 * @param skipClassDecorators Whether class decorators should be skipped from downleveling.
 *   This is useful for JIT mode where class decorators should be preserved as they could rely
 *   on immediate execution. e.g. downleveling `@Injectable` means that the injectable factory
 *   is not created, and injecting the token will not work. If this decorator would not be
 *   downleveled, the `Injectable` decorator will execute immediately on file load, and
 *   Angular will generate the corresponding injectable factory.
 */
export function getDownlevelDecoratorsTransform(typeChecker, host, diagnostics, isCore, isClosureCompilerEnabled, skipClassDecorators) {
    return (context) => {
        // Ensure that referenced type symbols are not elided by TypeScript. Imports for
        // such parameter type symbols previously could be type-only, but now might be also
        // used in the `ctorParameters` static property as a value. We want to make sure
        // that TypeScript does not elide imports for such type references. Read more
        // about this in the description for `loadIsReferencedAliasDeclarationPatch`.
        const referencedParameterTypes = loadIsReferencedAliasDeclarationPatch(context);
        /**
         * Converts an EntityName (from a type annotation) to an expression (accessing a value).
         *
         * For a given qualified name, this walks depth first to find the leftmost identifier,
         * and then converts the path into a property access that can be used as expression.
         */
        function entityNameToExpression(name) {
            const symbol = typeChecker.getSymbolAtLocation(name);
            // Check if the entity name references a symbol that is an actual value. If it is not, it
            // cannot be referenced by an expression, so return undefined.
            if (!symbol || !symbolIsRuntimeValue(typeChecker, symbol) || !symbol.declarations ||
                symbol.declarations.length === 0) {
                return undefined;
            }
            // If we deal with a qualified name, build up a property access expression
            // that could be used in the JavaScript output.
            if (ts.isQualifiedName(name)) {
                const containerExpr = entityNameToExpression(name.left);
                if (containerExpr === undefined) {
                    return undefined;
                }
                return ts.createPropertyAccess(containerExpr, name.right);
            }
            const decl = symbol.declarations[0];
            // If the given entity name has been resolved to an alias import declaration,
            // ensure that the alias declaration is not elided by TypeScript, and use its
            // name identifier to reference it at runtime.
            if (isAliasImportDeclaration(decl)) {
                referencedParameterTypes.add(decl);
                // If the entity name resolves to an alias import declaration, we reference the
                // entity based on the alias import name. This ensures that TypeScript properly
                // resolves the link to the import. Cloning the original entity name identifier
                // could lead to an incorrect resolution at local scope. e.g. Consider the following
                // snippet: `constructor(Dep: Dep) {}`. In such a case, the local `Dep` identifier
                // would resolve to the actual parameter name, and not to the desired import.
                // This happens because the entity name identifier symbol is internally considered
                // as type-only and therefore TypeScript tries to resolve it as value manually.
                // We can help TypeScript and avoid this non-reliable resolution by using an identifier
                // that is not type-only and is directly linked to the import alias declaration.
                if (decl.name !== undefined) {
                    return ts.getMutableClone(decl.name);
                }
            }
            // Clone the original entity name identifier so that it can be used to reference
            // its value at runtime. This is used when the identifier is resolving to a file
            // local declaration (otherwise it would resolve to an alias import declaration).
            return ts.getMutableClone(name);
        }
        /**
         * Transforms a class element. Returns a three tuple of name, transformed element, and
         * decorators found. Returns an undefined name if there are no decorators to lower on the
         * element, or the element has an exotic name.
         */
        function transformClassElement(element) {
            element = ts.visitEachChild(element, decoratorDownlevelVisitor, context);
            const decoratorsToKeep = [];
            const toLower = [];
            const decorators = host.getDecoratorsOfDeclaration(element) || [];
            for (const decorator of decorators) {
                // We only deal with concrete nodes in TypeScript sources, so we don't
                // need to handle synthetically created decorators.
                const decoratorNode = decorator.node;
                if (!isAngularDecorator(decorator, isCore)) {
                    decoratorsToKeep.push(decoratorNode);
                    continue;
                }
                toLower.push(decoratorNode);
            }
            if (!toLower.length)
                return [undefined, element, []];
            if (!element.name || !ts.isIdentifier(element.name)) {
                // Method has a weird name, e.g.
                //   [Symbol.foo]() {...}
                diagnostics.push({
                    file: element.getSourceFile(),
                    start: element.getStart(),
                    length: element.getEnd() - element.getStart(),
                    messageText: `Cannot process decorators for class element with non-analyzable name.`,
                    category: ts.DiagnosticCategory.Error,
                    code: 0,
                });
                return [undefined, element, []];
            }
            const name = element.name.text;
            const mutable = ts.getMutableClone(element);
            mutable.decorators = decoratorsToKeep.length ?
                ts.setTextRange(ts.createNodeArray(decoratorsToKeep), mutable.decorators) :
                undefined;
            return [name, mutable, toLower];
        }
        /**
         * Transforms a constructor. Returns the transformed constructor and the list of parameter
         * information collected, consisting of decorators and optional type.
         */
        function transformConstructor(ctor) {
            ctor = ts.visitEachChild(ctor, decoratorDownlevelVisitor, context);
            const newParameters = [];
            const oldParameters = ts.visitParameterList(ctor.parameters, decoratorDownlevelVisitor, context);
            const parametersInfo = [];
            for (const param of oldParameters) {
                const decoratorsToKeep = [];
                const paramInfo = { decorators: [], type: null };
                const decorators = host.getDecoratorsOfDeclaration(param) || [];
                for (const decorator of decorators) {
                    // We only deal with concrete nodes in TypeScript sources, so we don't
                    // need to handle synthetically created decorators.
                    const decoratorNode = decorator.node;
                    if (!isAngularDecorator(decorator, isCore)) {
                        decoratorsToKeep.push(decoratorNode);
                        continue;
                    }
                    paramInfo.decorators.push(decoratorNode);
                }
                if (param.type) {
                    // param has a type provided, e.g. "foo: Bar".
                    // The type will be emitted as a value expression in entityNameToExpression, which takes
                    // care not to emit anything for types that cannot be expressed as a value (e.g.
                    // interfaces).
                    paramInfo.type = param.type;
                }
                parametersInfo.push(paramInfo);
                const newParam = ts.updateParameter(param, 
                // Must pass 'undefined' to avoid emitting decorator metadata.
                decoratorsToKeep.length ? decoratorsToKeep : undefined, param.modifiers, param.dotDotDotToken, param.name, param.questionToken, param.type, param.initializer);
                newParameters.push(newParam);
            }
            const updated = ts.updateConstructor(ctor, ctor.decorators, ctor.modifiers, newParameters, ts.visitFunctionBody(ctor.body, decoratorDownlevelVisitor, context));
            return [updated, parametersInfo];
        }
        /**
         * Transforms a single class declaration:
         * - dispatches to strip decorators on members
         * - converts decorators on the class to annotations
         * - creates a ctorParameters property
         * - creates a propDecorators property
         */
        function transformClassDeclaration(classDecl) {
            classDecl = ts.getMutableClone(classDecl);
            const newMembers = [];
            const decoratedProperties = new Map();
            let classParameters = null;
            for (const member of classDecl.members) {
                switch (member.kind) {
                    case ts.SyntaxKind.PropertyDeclaration:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                    case ts.SyntaxKind.MethodDeclaration: {
                        const [name, newMember, decorators] = transformClassElement(member);
                        newMembers.push(newMember);
                        if (name)
                            decoratedProperties.set(name, decorators);
                        continue;
                    }
                    case ts.SyntaxKind.Constructor: {
                        const ctor = member;
                        if (!ctor.body)
                            break;
                        const [newMember, parametersInfo] = transformConstructor(member);
                        classParameters = parametersInfo;
                        newMembers.push(newMember);
                        continue;
                    }
                    default:
                        break;
                }
                newMembers.push(ts.visitEachChild(member, decoratorDownlevelVisitor, context));
            }
            // The `ReflectionHost.getDecoratorsOfDeclaration()` method will not return certain kinds of
            // decorators that will never be Angular decorators. So we cannot rely on it to capture all
            // the decorators that should be kept. Instead we start off with a set of the raw decorators
            // on the class, and only remove the ones that have been identified for downleveling.
            const decoratorsToKeep = new Set(classDecl.decorators);
            const possibleAngularDecorators = host.getDecoratorsOfDeclaration(classDecl) || [];
            let hasAngularDecorator = false;
            const decoratorsToLower = [];
            for (const decorator of possibleAngularDecorators) {
                // We only deal with concrete nodes in TypeScript sources, so we don't
                // need to handle synthetically created decorators.
                const decoratorNode = decorator.node;
                const isNgDecorator = isAngularDecorator(decorator, isCore);
                // Keep track if we come across an Angular class decorator. This is used
                // for to determine whether constructor parameters should be captured or not.
                if (isNgDecorator) {
                    hasAngularDecorator = true;
                }
                if (isNgDecorator && !skipClassDecorators) {
                    decoratorsToLower.push(extractMetadataFromSingleDecorator(decoratorNode, diagnostics));
                    decoratorsToKeep.delete(decoratorNode);
                }
            }
            if (decoratorsToLower.length) {
                newMembers.push(createDecoratorClassProperty(decoratorsToLower));
            }
            if (classParameters) {
                if (hasAngularDecorator || classParameters.some(p => !!p.decorators.length)) {
                    // Capture constructor parameters if the class has Angular decorator applied,
                    // or if any of the parameters has decorators applied directly.
                    newMembers.push(createCtorParametersClassProperty(diagnostics, entityNameToExpression, classParameters, isClosureCompilerEnabled));
                }
            }
            if (decoratedProperties.size) {
                newMembers.push(createPropDecoratorsClassProperty(diagnostics, decoratedProperties));
            }
            const members = ts.setTextRange(ts.createNodeArray(newMembers, classDecl.members.hasTrailingComma), classDecl.members);
            return ts.updateClassDeclaration(classDecl, decoratorsToKeep.size ? Array.from(decoratorsToKeep) : undefined, classDecl.modifiers, classDecl.name, classDecl.typeParameters, classDecl.heritageClauses, members);
        }
        /**
         * Transformer visitor that looks for Angular decorators and replaces them with
         * downleveled static properties. Also collects constructor type metadata for
         * class declaration that are decorated with an Angular decorator.
         */
        function decoratorDownlevelVisitor(node) {
            if (ts.isClassDeclaration(node)) {
                return transformClassDeclaration(node);
            }
            return ts.visitEachChild(node, decoratorDownlevelVisitor, context);
        }
        return (sf) => {
            // Downlevel decorators and constructor parameter types. We will keep track of all
            // referenced constructor parameter types so that we can instruct TypeScript to
            // not elide their imports if they previously were only type-only.
            return ts.visitEachChild(sf, decoratorDownlevelVisitor, context);
        };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG93bmxldmVsX2RlY29yYXRvcnNfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy90cmFuc2Zvcm1lcnMvZG93bmxldmVsX2RlY29yYXRvcnNfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyx3QkFBd0IsRUFBRSxxQ0FBcUMsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBRW5IOzs7R0FHRztBQUNILFNBQVMsa0JBQWtCLENBQUMsU0FBb0IsRUFBRSxNQUFlO0lBQy9ELE9BQU8sTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxJQUFJLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssZUFBZSxDQUFDLENBQUM7QUFDNUYsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztFQW9CRTtBQUVGOzs7R0FHRztBQUNILFNBQVMsNkJBQTZCO0lBQ3BDLE1BQU0sWUFBWSxHQUFxQixFQUFFLENBQUM7SUFDMUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQ3hDLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUM1QixFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDeEYsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQ3hDLFNBQVMsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxFQUM5RCxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLHFCQUFx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Ii8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7RGVjb3JhdG9yLCBSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi4vbmd0c2MvcmVmbGVjdGlvbic7XG5pbXBvcnQge2lzQWxpYXNJbXBvcnREZWNsYXJhdGlvbiwgbG9hZElzUmVmZXJlbmNlZEFsaWFzRGVjbGFyYXRpb25QYXRjaH0gZnJvbSAnLi9wYXRjaF9hbGlhc19yZWZlcmVuY2VfcmVzb2x1dGlvbic7XG5cbi8qKlxuICogV2hldGhlciBhIGdpdmVuIGRlY29yYXRvciBzaG91bGQgYmUgdHJlYXRlZCBhcyBhbiBBbmd1bGFyIGRlY29yYXRvci5cbiAqIEVpdGhlciBpdCdzIHVzZWQgaW4gQGFuZ3VsYXIvY29yZSwgb3IgaXQncyBpbXBvcnRlZCBmcm9tIHRoZXJlLlxuICovXG5mdW5jdGlvbiBpc0FuZ3VsYXJEZWNvcmF0b3IoZGVjb3JhdG9yOiBEZWNvcmF0b3IsIGlzQ29yZTogYm9vbGVhbik6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNDb3JlIHx8IChkZWNvcmF0b3IuaW1wb3J0ICE9PSBudWxsICYmIGRlY29yYXRvci5pbXBvcnQuZnJvbSA9PT0gJ0Bhbmd1bGFyL2NvcmUnKTtcbn1cblxuLypcbiAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcbiAgQ29kZSBiZWxvdyBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgZG93bmxldmVsIHRyYW5zZm9ybWVyXG4gIGFuZCBhIGZldyBsb2NhbCBtb2RpZmljYXRpb25zIGhhdmUgYmVlbiBhcHBsaWVkOlxuXG4gICAgMS4gVHNpY2tsZSBieSBkZWZhdWx0IHByb2Nlc3NlZCBhbGwgZGVjb3JhdG9ycyB0aGF0IGhhZCB0aGUgYEBBbm5vdGF0aW9uYCBKU0RvYy5cbiAgICAgICBXZSBtb2RpZmllZCB0aGUgdHJhbnNmb3JtIHRvIG9ubHkgYmUgY29uY2VybmVkIHdpdGgga25vd24gQW5ndWxhciBkZWNvcmF0b3JzLlxuICAgIDIuIFRzaWNrbGUgYnkgZGVmYXVsdCBhZGRlZCBgQG5vY29sbGFwc2VgIHRvIGFsbCBnZW5lcmF0ZWQgYGN0b3JQYXJhbWV0ZXJzYCBwcm9wZXJ0aWVzLlxuICAgICAgIFdlIG9ubHkgZG8gdGhpcyB3aGVuIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgaXMgZW5hYmxlZC5cbiAgICAzLiBUc2lja2xlIGRvZXMgbm90IGhhbmRsZSB1bmlvbiB0eXBlcyBmb3IgZGVwZW5kZW5jeSBpbmplY3Rpb24uIGkuZS4gaWYgYSBpbmplY3RlZCB0eXBlXG4gICAgICAgaXMgZGVub3RlZCB3aXRoIGBAT3B0aW9uYWxgLCB0aGUgYWN0dWFsIHR5cGUgY291bGQgYmUgc2V0IHRvIGBUIHwgbnVsbGAuXG4gICAgICAgU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9jb21taXQvODI2ODAzZDA3MzZiODA3ODY3Y2FmZjlmODkwM2U1MDg5NzBhZDVlNC5cbiAgICA0LiBUc2lja2xlIHJlbGllZCBvbiBgZW1pdERlY29yYXRvck1ldGFkYXRhYCB0byBiZSBzZXQgdG8gYHRydWVgLiBUaGlzIGlzIGR1ZSB0byBhIGxpbWl0YXRpb25cbiAgICAgICBpbiBUeXBlU2NyaXB0IHRyYW5zZm9ybWVycyB0aGF0IG5ldmVyIGhhcyBiZWVuIGZpeGVkLiBXZSB3ZXJlIGFibGUgdG8gd29yayBhcm91bmQgdGhpc1xuICAgICAgIGxpbWl0YXRpb24gc28gdGhhdCBgZW1pdERlY29yYXRvck1ldGFkYXRhYCBkb2Vzbid0IG5lZWQgdG8gYmUgc3BlY2lmaWVkLlxuICAgICAgIFNlZTogYHBhdGNoQWxpYXNSZWZlcmVuY2VSZXNvbHV0aW9uYCBmb3IgbW9yZSBkZXRhaWxzLlxuXG4gIEhlcmUgaXMgYSBsaW5rIHRvIHRoZSB0c2lja2xlIHJldmlzaW9uIG9uIHdoaWNoIHRoaXMgdHJhbnNmb3JtZXIgaXMgYmFzZWQ6XG4gIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL3RzaWNrbGUvYmxvYi9mYWUwNmJlY2IxNTcwZjQ5MTgwNjA2MGQ4M2YyOWYyZDUwYzQzY2RkL3NyYy9kZWNvcmF0b3JfZG93bmxldmVsX3RyYW5zZm9ybWVyLnRzXG4gIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4qL1xuXG4vKipcbiAqIENyZWF0ZXMgdGhlIEFTVCBmb3IgdGhlIGRlY29yYXRvciBmaWVsZCB0eXBlIGFubm90YXRpb24sIHdoaWNoIGhhcyB0aGUgZm9ybVxuICogICAgIHsgdHlwZTogRnVuY3Rpb24sIGFyZ3M/OiBhbnlbXSB9W11cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVjb3JhdG9ySW52b2NhdGlvblR5cGUoKTogdHMuVHlwZU5vZGUge1xuICBjb25zdCB0eXBlRWxlbWVudHM6IHRzLlR5cGVFbGVtZW50W10gPSBbXTtcbiAgdHlwZUVsZW1lbnRzLnB1c2godHMuY3JlYXRlUHJvcGVydHlTaWduYXR1cmUoXG4gICAgICB1bmRlZmluZWQsICd0eXBlJywgdW5kZWZpbmVkLFxuICAgICAgdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUodHMuY3JlYXRlSWRlbnRpZmllcignRnVuY3Rpb24nKSwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkKSk7XG4gIHR5cGVFbGVtZW50cy5wdXNoKHRzLmNyZWF0ZVByb3BlcnR5U2lnbmF0dXJlKFxuICAgICAgdW5kZWZpbmVkLCAnYXJncycsIHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuUXVlc3Rpb25Ub2tlbiksXG4gICAgICB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKSwgdW5kZWZpbmVkKSk7XG4gIHJldHVybiB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZSh0eXBlRWxlbWVudHMpKTtcbn1cblxuLyoqXG4gKiBFeHRyYWN0cyB0aGUgdHlwZSBvZiB0aGUgZGVjb3JhdG9yICh0aGUgZnVuY3Rpb24gb3IgZXhwcmVzc2lvbiBpbnZva2VkKSwgYXMgd2VsbCBhcyBhbGwgdGhlXG4gKiBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBkZWNvcmF0b3IuIFJldHVybnMgYW4gQVNUIHdpdGggdGhlIGZvcm06XG4gKlxuICogICAgIC8vIEZvciBAZGVjb3JhdG9yKGFyZzEsIGFyZzIpXG4gKiAgICAgeyB0eXBlOiBkZWNvcmF0b3IsIGFyZ3M6IFthcmcxLCBhcmcyXSB9XG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RNZXRhZGF0YUZyb21TaW5nbGVEZWNvcmF0b3IoXG4gICAgZGVjb3JhdG9yOiB0cy5EZWNvcmF0b3IsIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10pOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbiB7XG4gIGNvbnN0IG1ldGFkYXRhUHJvcGVydGllczogdHMuT2JqZWN0TGl0ZXJhbEVsZW1lbnRMaWtlW10gPSBbXTtcbiAgY29uc3QgZXhwciA9IGRlY29yYXRvci5leHByZXNzaW9uO1xuICBzd2l0Y2ggKGV4cHIua2luZCkge1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5JZGVudGlmaWVyOlxuICAgICAgLy8gVGhlIGRlY29yYXRvciB3YXMgYSBwbGFpbiBARm9vLlxuICAgICAgbWV0YWRhdGFQcm9wZXJ0aWVzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KCd0eXBlJywgZXhwcikpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkNhbGxFeHByZXNzaW9uOlxuICAgICAgLy8gVGhlIGRlY29yYXRvciB3YXMgYSBjYWxsLCBsaWtlIEBGb28oYmFyKS5cbiAgICAgIGNvbnN0IGNhbGwgPSBleHByIGFzIHRzLkNhbGxFeHByZXNzaW9uO1xuICAgICAgbWV0YWRhdGFQcm9wZXJ0aWVzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KCd0eXBlJywgY2FsbC5leHByZXNzaW9uKSk7XG4gICAgICBpZiAoY2FsbC5hcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGFyZ3M6IHRzLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGFyZyBvZiBjYWxsLmFyZ3VtZW50cykge1xuICAgICAgICAgIGFyZ3MucHVzaChhcmcpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFyZ3NBcnJheUxpdGVyYWwgPSB0cy5jcmVhdGVBcnJheUxpdGVyYWwoYXJncyk7XG4gICAgICAgIGFyZ3NBcnJheUxpdGVyYWwuZWxlbWVudHMuaGFzVHJhaWxpbmdDb21tYSA9IHRydWU7XG4gICAgICAgIG1ldGFkYXRhUHJvcGVydGllcy5wdXNoKHRzLmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudCgnYXJncycsIGFyZ3NBcnJheUxpdGVyYWwpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKHtcbiAgICAgICAgZmlsZTogZGVjb3JhdG9yLmdldFNvdXJjZUZpbGUoKSxcbiAgICAgICAgc3RhcnQ6IGRlY29yYXRvci5nZXRTdGFydCgpLFxuICAgICAgICBsZW5ndGg6IGRlY29yYXRvci5nZXRFbmQoKSAtIGRlY29yYXRvci5nZXRTdGFydCgpLFxuICAgICAgICBtZXNzYWdlVGV4dDpcbiAgICAgICAgICAgIGAke3RzLlN5bnRheEtpbmRbZGVjb3JhdG9yLmtpbmRdfSBub3QgaW1wbGVtZW50ZWQgaW4gZ2F0aGVyaW5nIGRlY29yYXRvciBtZXRhZGF0YS5gLFxuICAgICAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgICAgICBjb2RlOiAwLFxuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgfVxuICByZXR1cm4gdHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChtZXRhZGF0YVByb3BlcnRpZXMpO1xufVxuXG4vKipcbiAqIFRha2VzIGEgbGlzdCBvZiBkZWNvcmF0b3IgbWV0YWRhdGEgb2JqZWN0IEFTVHMgYW5kIHByb2R1Y2VzIGFuIEFTVCBmb3IgYVxuICogc3RhdGljIGNsYXNzIHByb3BlcnR5IG9mIGFuIGFycmF5IG9mIHRob3NlIG1ldGFkYXRhIG9iamVjdHMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZURlY29yYXRvckNsYXNzUHJvcGVydHkoZGVjb3JhdG9yTGlzdDogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb25bXSkge1xuICBjb25zdCBtb2RpZmllciA9IHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuU3RhdGljS2V5d29yZCk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEZWNvcmF0b3JJbnZvY2F0aW9uVHlwZSgpO1xuICBjb25zdCBpbml0aWFsaXplciA9IHRzLmNyZWF0ZUFycmF5TGl0ZXJhbChkZWNvcmF0b3JMaXN0LCB0cnVlKTtcbiAgLy8gTkI6IHRoZSAuZGVjb3JhdG9ycyBwcm9wZXJ0eSBkb2VzIG5vdCBnZXQgYSBAbm9jb2xsYXBzZSBwcm9wZXJ0eS4gVGhlcmUgaXNcbiAgLy8gbm8gZ29vZCByZWFzb24gd2h5IC0gaXQgbWVhbnMgLmRlY29yYXRvcnMgaXMgbm90IHJ1bnRpbWUgYWNjZXNzaWJsZSBpZiB5b3VcbiAgLy8gY29tcGlsZSB3aXRoIGNvbGxhcHNlIHByb3BlcnRpZXMsIHdoZXJlYXMgcHJvcERlY29yYXRvcnMgaXMsIHdoaWNoIGRvZXNuJ3RcbiAgLy8gZm9sbG93IGFueSBzdHJpbmdlbnQgbG9naWMuIEhvd2V2ZXIgdGhpcyBoYXMgYmVlbiB0aGUgY2FzZSBwcmV2aW91c2x5LCBhbmRcbiAgLy8gYWRkaW5nIGl0IGJhY2sgaW4gbGVhZHMgdG8gc3Vic3RhbnRpYWwgY29kZSBzaXplIGluY3JlYXNlcyBhcyBDbG9zdXJlIGZhaWxzXG4gIC8vIHRvIHRyZWUgc2hha2UgdGhlc2UgcHJvcHMgd2l0aG91dCBAbm9jb2xsYXBzZS5cbiAgcmV0dXJuIHRzLmNyZWF0ZVByb3BlcnR5KHVuZGVmaW5lZCwgW21vZGlmaWVyXSwgJ2RlY29yYXRvcnMnLCB1bmRlZmluZWQsIHR5cGUsIGluaXRpYWxpemVyKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIHRoZSBBU1QgZm9yIHRoZSAnY3RvclBhcmFtZXRlcnMnIGZpZWxkIHR5cGUgYW5ub3RhdGlvbjpcbiAqICAgKCkgPT4gKHsgdHlwZTogYW55LCBkZWNvcmF0b3JzPzoge3R5cGU6IEZ1bmN0aW9uLCBhcmdzPzogYW55W119W10gfXxudWxsKVtdXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUN0b3JQYXJhbWV0ZXJzQ2xhc3NQcm9wZXJ0eVR5cGUoKTogdHMuVHlwZU5vZGUge1xuICAvLyBTb3JyeSBhYm91dCB0aGlzLiBUcnkgcmVhZGluZyBqdXN0IHRoZSBzdHJpbmcgbGl0ZXJhbHMgYmVsb3cuXG4gIGNvbnN0IHR5cGVFbGVtZW50czogdHMuVHlwZUVsZW1lbnRbXSA9IFtdO1xuICB0eXBlRWxlbWVudHMucHVzaCh0cy5jcmVhdGVQcm9wZXJ0eVNpZ25hdHVyZShcbiAgICAgIHVuZGVmaW5lZCwgJ3R5cGUnLCB1bmRlZmluZWQsXG4gICAgICB0cy5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZSh0cy5jcmVhdGVJZGVudGlmaWVyKCdhbnknKSwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkKSk7XG4gIHR5cGVFbGVtZW50cy5wdXNoKHRzLmNyZWF0ZVByb3BlcnR5U2lnbmF0dXJlKFxuICAgICAgdW5kZWZpbmVkLCAnZGVjb3JhdG9ycycsIHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuUXVlc3Rpb25Ub2tlbiksXG4gICAgICB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZShbXG4gICAgICAgIHRzLmNyZWF0ZVByb3BlcnR5U2lnbmF0dXJlKFxuICAgICAgICAgICAgdW5kZWZpbmVkLCAndHlwZScsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRzLmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKHRzLmNyZWF0ZUlkZW50aWZpZXIoJ0Z1bmN0aW9uJyksIHVuZGVmaW5lZCksIHVuZGVmaW5lZCksXG4gICAgICAgIHRzLmNyZWF0ZVByb3BlcnR5U2lnbmF0dXJlKFxuICAgICAgICAgICAgdW5kZWZpbmVkLCAnYXJncycsIHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuUXVlc3Rpb25Ub2tlbiksXG4gICAgICAgICAgICB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKFxuICAgICAgICAgICAgICAgIHRzLmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKHRzLmNyZWF0ZUlkZW50aWZpZXIoJ2FueScpLCB1bmRlZmluZWQpKSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCksXG4gICAgICBdKSksXG4gICAgICB1bmRlZmluZWQpKTtcblxuICByZXR1cm4gdHMuY3JlYXRlRnVuY3Rpb25UeXBlTm9kZSh1bmRlZmluZWQsIFtdLCB0cy5jcmVhdGVBcnJheVR5cGVOb2RlKHRzLmNyZWF0ZVVuaW9uVHlwZU5vZGUoW1xuICAgIHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZSh0eXBlRWxlbWVudHMpLFxuICAgIHRzLmNyZWF0ZUxpdGVyYWxUeXBlTm9kZSh0cy5jcmVhdGVOdWxsKCkpLFxuICBdKSkpO1xufVxuXG4vKipcbiAqIFNldHMgYSBDbG9zdXJlIFxcQG5vY29sbGFwc2Ugc3ludGhldGljIGNvbW1lbnQgb24gdGhlIGdpdmVuIG5vZGUuIFRoaXMgcHJldmVudHMgQ2xvc3VyZSBDb21waWxlclxuICogZnJvbSBjb2xsYXBzaW5nIHRoZSBhcHBhcmVudGx5IHN0YXRpYyBwcm9wZXJ0eSwgd2hpY2ggd291bGQgbWFrZSBpdCBpbXBvc3NpYmxlIHRvIGZpbmQgZm9yIGNvZGVcbiAqIHRyeWluZyB0byBkZXRlY3QgaXQgYXQgcnVudGltZS5cbiAqL1xuZnVuY3Rpb24gYWRkTm9Db2xsYXBzZUNvbW1lbnQobjogdHMuTm9kZSkge1xuICB0cy5zZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHMobiwgW3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2luZDogdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiAnKiBAbm9jb2xsYXBzZSAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3M6IC0xLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmQ6IC0xLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNUcmFpbGluZ05ld0xpbmU6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1dKTtcbn1cblxuLyoqXG4gKiBjcmVhdGVDdG9yUGFyYW1ldGVyc0NsYXNzUHJvcGVydHkgY3JlYXRlcyBhIHN0YXRpYyAnY3RvclBhcmFtZXRlcnMnIHByb3BlcnR5IGNvbnRhaW5pbmdcbiAqIGRvd25sZXZlbGVkIGRlY29yYXRvciBpbmZvcm1hdGlvbi5cbiAqXG4gKiBUaGUgcHJvcGVydHkgY29udGFpbnMgYW4gYXJyb3cgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIGFycmF5IG9mIG9iamVjdCBsaXRlcmFscyBvZiB0aGUgc2hhcGU6XG4gKiAgICAgc3RhdGljIGN0b3JQYXJhbWV0ZXJzID0gKCkgPT4gW3tcbiAqICAgICAgIHR5cGU6IFNvbWVDbGFzc3x1bmRlZmluZWQsICAvLyB0aGUgdHlwZSBvZiB0aGUgcGFyYW0gdGhhdCdzIGRlY29yYXRlZCwgaWYgaXQncyBhIHZhbHVlLlxuICogICAgICAgZGVjb3JhdG9yczogW3tcbiAqICAgICAgICAgdHlwZTogRGVjb3JhdG9yRm4sICAvLyB0aGUgdHlwZSBvZiB0aGUgZGVjb3JhdG9yIHRoYXQncyBpbnZva2VkLlxuICogICAgICAgICBhcmdzOiBbQVJHU10sICAgICAgIC8vIHRoZSBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBkZWNvcmF0b3IuXG4gKiAgICAgICB9XVxuICogICAgIH1dO1xuICovXG5mdW5jdGlvbiBjcmVhdGVDdG9yUGFyYW1ldGVyc0NsYXNzUHJvcGVydHkoXG4gICAgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSxcbiAgICBlbnRpdHlOYW1lVG9FeHByZXNzaW9uOiAobjogdHMuRW50aXR5TmFtZSkgPT4gdHMuRXhwcmVzc2lvbiB8IHVuZGVmaW5lZCxcbiAgICBjdG9yUGFyYW1ldGVyczogUGFyYW1ldGVyRGVjb3JhdGlvbkluZm9bXSxcbiAgICBpc0Nsb3N1cmVDb21waWxlckVuYWJsZWQ6IGJvb2xlYW4pOiB0cy5Qcm9wZXJ0eURlY2xhcmF0aW9uIHtcbiAgY29uc3QgcGFyYW1zOiB0cy5FeHByZXNzaW9uW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IGN0b3JQYXJhbSBvZiBjdG9yUGFyYW1ldGVycykge1xuICAgIGlmICghY3RvclBhcmFtLnR5cGUgJiYgY3RvclBhcmFtLmRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBwYXJhbXMucHVzaCh0cy5jcmVhdGVOdWxsKCkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1UeXBlID0gY3RvclBhcmFtLnR5cGUgP1xuICAgICAgICB0eXBlUmVmZXJlbmNlVG9FeHByZXNzaW9uKGVudGl0eU5hbWVUb0V4cHJlc3Npb24sIGN0b3JQYXJhbS50eXBlKSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICBjb25zdCBtZW1iZXJzID1cbiAgICAgICAgW3RzLmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudCgndHlwZScsIHBhcmFtVHlwZSB8fCB0cy5jcmVhdGVJZGVudGlmaWVyKCd1bmRlZmluZWQnKSldO1xuXG4gICAgY29uc3QgZGVjb3JhdG9yczogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGZvciAoY29uc3QgZGVjbyBvZiBjdG9yUGFyYW0uZGVjb3JhdG9ycykge1xuICAgICAgZGVjb3JhdG9ycy5wdXNoKGV4dHJhY3RNZXRhZGF0YUZyb21TaW5nbGVEZWNvcmF0b3IoZGVjbywgZGlhZ25vc3RpY3MpKTtcbiAgICB9XG4gICAgaWYgKGRlY29yYXRvcnMubGVuZ3RoKSB7XG4gICAgICBtZW1iZXJzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KCdkZWNvcmF0b3JzJywgdHMuY3JlYXRlQXJyYXlMaXRlcmFsKGRlY29yYXRvcnMpKSk7XG4gICAgfVxuICAgIHBhcmFtcy5wdXNoKHRzLmNyZWF0ZU9iamVjdExpdGVyYWwobWVtYmVycykpO1xuICB9XG5cbiAgY29uc3QgaW5pdGlhbGl6ZXIgPSB0cy5jcmVhdGVBcnJvd0Z1bmN0aW9uKFxuICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFtdLCB1bmRlZmluZWQsIHRzLmNyZWF0ZVRva2VuKHRzLlN5bnRheEtpbmQuRXF1YWxzR3JlYXRlclRoYW5Ub2tlbiksXG4gICAgICB0cy5jcmVhdGVBcnJheUxpdGVyYWwocGFyYW1zLCB0cnVlKSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVDdG9yUGFyYW1ldGVyc0NsYXNzUHJvcGVydHlUeXBlKCk7XG4gIGNvbnN0IGN0b3JQcm9wID0gdHMuY3JlYXRlUHJvcGVydHkoXG4gICAgICB1bmRlZmluZWQsIFt0cy5jcmVhdGVUb2tlbih0cy5TeW50YXhLaW5kLlN0YXRpY0tleXdvcmQpXSwgJ2N0b3JQYXJhbWV0ZXJzJywgdW5kZWZpbmVkLCB0eXBlLFxuICAgICAgaW5pdGlhbGl6ZXIpO1xuICBpZiAoaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkKSB7XG4gICAgYWRkTm9Db2xsYXBzZUNvbW1lbnQoY3RvclByb3ApO1xuICB9XG4gIHJldHVybiBjdG9yUHJvcDtcbn1cblxuLyoqXG4gKiBjcmVhdGVQcm9wRGVjb3JhdG9yc0NsYXNzUHJvcGVydHkgY3JlYXRlcyBhIHN0YXRpYyAncHJvcERlY29yYXRvcnMnIHByb3BlcnR5IGNvbnRhaW5pbmcgdHlwZVxuICogaW5mb3JtYXRpb24gZm9yIGV2ZXJ5IHByb3BlcnR5IHRoYXQgaGFzIGEgZGVjb3JhdG9yIGFwcGxpZWQuXG4gKlxuICogICAgIHN0YXRpYyBwcm9wRGVjb3JhdG9yczoge1trZXk6IHN0cmluZ106IHt0eXBlOiBGdW5jdGlvbiwgYXJncz86IGFueVtdfVtdfSA9IHtcbiAqICAgICAgIHByb3BBOiBbe3R5cGU6IE15RGVjb3JhdG9yLCBhcmdzOiBbMSwgMl19LCAuLi5dLFxuICogICAgICAgLi4uXG4gKiAgICAgfTtcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUHJvcERlY29yYXRvcnNDbGFzc1Byb3BlcnR5KFxuICAgIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10sIHByb3BlcnRpZXM6IE1hcDxzdHJpbmcsIHRzLkRlY29yYXRvcltdPik6IHRzLlByb3BlcnR5RGVjbGFyYXRpb24ge1xuICAvLyAgYHN0YXRpYyBwcm9wRGVjb3JhdG9yczoge1trZXk6IHN0cmluZ106IGAgKyB7dHlwZTogRnVuY3Rpb24sIGFyZ3M/OiBhbnlbXX1bXSArIGB9ID0ge1xcbmApO1xuICBjb25zdCBlbnRyaWVzOiB0cy5PYmplY3RMaXRlcmFsRWxlbWVudExpa2VbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBkZWNvcmF0b3JzXSBvZiBwcm9wZXJ0aWVzLmVudHJpZXMoKSkge1xuICAgIGVudHJpZXMucHVzaCh0cy5jcmVhdGVQcm9wZXJ0eUFzc2lnbm1lbnQoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIHRzLmNyZWF0ZUFycmF5TGl0ZXJhbChcbiAgICAgICAgICAgIGRlY29yYXRvcnMubWFwKGRlY28gPT4gZXh0cmFjdE1ldGFkYXRhRnJvbVNpbmdsZURlY29yYXRvcihkZWNvLCBkaWFnbm9zdGljcykpKSkpO1xuICB9XG4gIGNvbnN0IGluaXRpYWxpemVyID0gdHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChlbnRyaWVzLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IHRzLmNyZWF0ZVR5cGVMaXRlcmFsTm9kZShbdHMuY3JlYXRlSW5kZXhTaWduYXR1cmUoXG4gICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgW3RzLmNyZWF0ZVBhcmFtZXRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgJ2tleScsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUoJ3N0cmluZycsIHVuZGVmaW5lZCksIHVuZGVmaW5lZCldLFxuICAgICAgY3JlYXRlRGVjb3JhdG9ySW52b2NhdGlvblR5cGUoKSldKTtcbiAgcmV0dXJuIHRzLmNyZWF0ZVByb3BlcnR5KFxuICAgICAgdW5kZWZpbmVkLCBbdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKV0sICdwcm9wRGVjb3JhdG9ycycsIHVuZGVmaW5lZCwgdHlwZSxcbiAgICAgIGluaXRpYWxpemVyKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSAocG90ZW50aWFsbHkpIHZhbHVlIHBhcnQgZm9yIHRoZSBnaXZlbiBub2RlLlxuICpcbiAqIFRoaXMgaXMgYSBwYXJ0aWFsIHJlLWltcGxlbWVudGF0aW9uIG9mIFR5cGVTY3JpcHQncyBzZXJpYWxpemVUeXBlUmVmZXJlbmNlTm9kZS4gVGhpcyBpcyBhXG4gKiB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzE3NTE2IChzZXJpYWxpemVUeXBlUmVmZXJlbmNlTm9kZVxuICogbm90IGJlaW5nIGV4cG9zZWQpLiBJbiBwcmFjdGljZSB0aGlzIGltcGxlbWVudGF0aW9uIGlzIHN1ZmZpY2llbnQgZm9yIEFuZ3VsYXIncyB1c2Ugb2YgdHlwZVxuICogbWV0YWRhdGEuXG4gKi9cbmZ1bmN0aW9uIHR5cGVSZWZlcmVuY2VUb0V4cHJlc3Npb24oXG4gICAgZW50aXR5TmFtZVRvRXhwcmVzc2lvbjogKG46IHRzLkVudGl0eU5hbWUpID0+IHRzLkV4cHJlc3Npb24gfCB1bmRlZmluZWQsXG4gICAgbm9kZTogdHMuVHlwZU5vZGUpOiB0cy5FeHByZXNzaW9ufHVuZGVmaW5lZCB7XG4gIGxldCBraW5kID0gbm9kZS5raW5kO1xuICBpZiAodHMuaXNMaXRlcmFsVHlwZU5vZGUobm9kZSkpIHtcbiAgICAvLyBUcmVhdCBsaXRlcmFsIHR5cGVzIGxpa2UgdGhlaXIgYmFzZSB0eXBlIChib29sZWFuLCBzdHJpbmcsIG51bWJlcikuXG4gICAga2luZCA9IG5vZGUubGl0ZXJhbC5raW5kO1xuICB9XG4gIHN3aXRjaCAoa2luZCkge1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvblR5cGU6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkNvbnN0cnVjdG9yVHlwZTpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKCdGdW5jdGlvbicpO1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5BcnJheVR5cGU6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlR1cGxlVHlwZTpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKCdBcnJheScpO1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5UeXBlUHJlZGljYXRlOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5UcnVlS2V5d29yZDpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuRmFsc2VLZXl3b3JkOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5Cb29sZWFuS2V5d29yZDpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKCdCb29sZWFuJyk7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlN0cmluZ0xpdGVyYWw6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlN0cmluZ0tleXdvcmQ6XG4gICAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcignU3RyaW5nJyk7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLk9iamVjdEtleXdvcmQ6XG4gICAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcignT2JqZWN0Jyk7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLk51bWJlcktleXdvcmQ6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLk51bWVyaWNMaXRlcmFsOlxuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ051bWJlcicpO1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5UeXBlUmVmZXJlbmNlOlxuICAgICAgY29uc3QgdHlwZVJlZiA9IG5vZGUgYXMgdHMuVHlwZVJlZmVyZW5jZU5vZGU7XG4gICAgICAvLyBJZ25vcmUgYW55IGdlbmVyaWMgdHlwZXMsIGp1c3QgcmV0dXJuIHRoZSBiYXNlIHR5cGUuXG4gICAgICByZXR1cm4gZW50aXR5TmFtZVRvRXhwcmVzc2lvbih0eXBlUmVmLnR5cGVOYW1lKTtcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuVW5pb25UeXBlOlxuICAgICAgY29uc3QgY2hpbGRUeXBlTm9kZXMgPVxuICAgICAgICAgIChub2RlIGFzIHRzLlVuaW9uVHlwZU5vZGUpXG4gICAgICAgICAgICAgIC50eXBlcy5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICB0ID0+ICEodHMuaXNMaXRlcmFsVHlwZU5vZGUodCkgJiYgdC5saXRlcmFsLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuTnVsbEtleXdvcmQpKTtcbiAgICAgIHJldHVybiBjaGlsZFR5cGVOb2Rlcy5sZW5ndGggPT09IDEgP1xuICAgICAgICAgIHR5cGVSZWZlcmVuY2VUb0V4cHJlc3Npb24oZW50aXR5TmFtZVRvRXhwcmVzc2lvbiwgY2hpbGRUeXBlTm9kZXNbMF0pIDpcbiAgICAgICAgICB1bmRlZmluZWQ7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhIGdpdmVuIHN5bWJvbCByZWZlcnMgdG8gYSB2YWx1ZSB0aGF0IGV4aXN0cyBhdCBydW50aW1lIChhcyBkaXN0aW5jdCBmcm9tIGEgdHlwZSkuXG4gKlxuICogRXhwYW5kcyBhbGlhc2VzLCB3aGljaCBpcyBpbXBvcnRhbnQgZm9yIHRoZSBjYXNlIHdoZXJlXG4gKiAgIGltcG9ydCAqIGFzIHggZnJvbSAnc29tZS1tb2R1bGUnO1xuICogYW5kIHggaXMgbm93IGEgdmFsdWUgKHRoZSBtb2R1bGUgb2JqZWN0KS5cbiAqL1xuZnVuY3Rpb24gc3ltYm9sSXNSdW50aW1lVmFsdWUodHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLCBzeW1ib2w6IHRzLlN5bWJvbCk6IGJvb2xlYW4ge1xuICBpZiAoc3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICBzeW1ib2wgPSB0eXBlQ2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHN5bWJvbCk7XG4gIH1cblxuICAvLyBOb3RlIHRoYXQgY29uc3QgZW51bXMgYXJlIGEgc3BlY2lhbCBjYXNlLCBiZWNhdXNlXG4gIC8vIHdoaWxlIHRoZXkgaGF2ZSBhIHZhbHVlLCB0aGV5IGRvbid0IGV4aXN0IGF0IHJ1bnRpbWUuXG4gIHJldHVybiAoc3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuVmFsdWUgJiB0cy5TeW1ib2xGbGFncy5Db25zdEVudW1FeGNsdWRlcykgIT09IDA7XG59XG5cbi8qKiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mbyBkZXNjcmliZXMgdGhlIGluZm9ybWF0aW9uIGZvciBhIHNpbmdsZSBjb25zdHJ1Y3RvciBwYXJhbWV0ZXIuICovXG5pbnRlcmZhY2UgUGFyYW1ldGVyRGVjb3JhdGlvbkluZm8ge1xuICAvKipcbiAgICogVGhlIHR5cGUgZGVjbGFyYXRpb24gZm9yIHRoZSBwYXJhbWV0ZXIuIE9ubHkgc2V0IGlmIHRoZSB0eXBlIGlzIGEgdmFsdWUgKGUuZy4gYSBjbGFzcywgbm90IGFuXG4gICAqIGludGVyZmFjZSkuXG4gICAqL1xuICB0eXBlOiB0cy5UeXBlTm9kZXxudWxsO1xuICAvKiogVGhlIGxpc3Qgb2YgZGVjb3JhdG9ycyBmb3VuZCBvbiB0aGUgcGFyYW1ldGVyLCBudWxsIGlmIG5vbmUuICovXG4gIGRlY29yYXRvcnM6IHRzLkRlY29yYXRvcltdO1xufVxuXG4vKipcbiAqIEdldHMgYSB0cmFuc2Zvcm1lciBmb3IgZG93bmxldmVsaW5nIEFuZ3VsYXIgZGVjb3JhdG9ycy5cbiAqIEBwYXJhbSB0eXBlQ2hlY2tlciBSZWZlcmVuY2UgdG8gdGhlIHByb2dyYW0ncyB0eXBlIGNoZWNrZXIuXG4gKiBAcGFyYW0gaG9zdCBSZWZsZWN0aW9uIGhvc3QgdGhhdCBpcyB1c2VkIGZvciBkZXRlcm1pbmluZyBkZWNvcmF0b3JzLlxuICogQHBhcmFtIGRpYWdub3N0aWNzIExpc3Qgd2hpY2ggd2lsbCBiZSBwb3B1bGF0ZWQgd2l0aCBkaWFnbm9zdGljcyBpZiBhbnkuXG4gKiBAcGFyYW0gaXNDb3JlIFdoZXRoZXIgdGhlIGN1cnJlbnQgVHlwZVNjcmlwdCBwcm9ncmFtIGlzIGZvciB0aGUgYEBhbmd1bGFyL2NvcmVgIHBhY2thZ2UuXG4gKiBAcGFyYW0gaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkIFdoZXRoZXIgY2xvc3VyZSBhbm5vdGF0aW9ucyBuZWVkIHRvIGJlIGFkZGVkIHdoZXJlIG5lZWRlZC5cbiAqIEBwYXJhbSBza2lwQ2xhc3NEZWNvcmF0b3JzIFdoZXRoZXIgY2xhc3MgZGVjb3JhdG9ycyBzaG91bGQgYmUgc2tpcHBlZCBmcm9tIGRvd25sZXZlbGluZy5cbiAqICAgVGhpcyBpcyB1c2VmdWwgZm9yIEpJVCBtb2RlIHdoZXJlIGNsYXNzIGRlY29yYXRvcnMgc2hvdWxkIGJlIHByZXNlcnZlZCBhcyB0aGV5IGNvdWxkIHJlbHlcbiAqICAgb24gaW1tZWRpYXRlIGV4ZWN1dGlvbi4gZS5nLiBkb3dubGV2ZWxpbmcgYEBJbmplY3RhYmxlYCBtZWFucyB0aGF0IHRoZSBpbmplY3RhYmxlIGZhY3RvcnlcbiAqICAgaXMgbm90IGNyZWF0ZWQsIGFuZCBpbmplY3RpbmcgdGhlIHRva2VuIHdpbGwgbm90IHdvcmsuIElmIHRoaXMgZGVjb3JhdG9yIHdvdWxkIG5vdCBiZVxuICogICBkb3dubGV2ZWxlZCwgdGhlIGBJbmplY3RhYmxlYCBkZWNvcmF0b3Igd2lsbCBleGVjdXRlIGltbWVkaWF0ZWx5IG9uIGZpbGUgbG9hZCwgYW5kXG4gKiAgIEFuZ3VsYXIgd2lsbCBnZW5lcmF0ZSB0aGUgY29ycmVzcG9uZGluZyBpbmplY3RhYmxlIGZhY3RvcnkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXREb3dubGV2ZWxEZWNvcmF0b3JzVHJhbnNmb3JtKFxuICAgIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlciwgaG9zdDogUmVmbGVjdGlvbkhvc3QsIGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10sXG4gICAgaXNDb3JlOiBib29sZWFuLCBpc0Nsb3N1cmVDb21waWxlckVuYWJsZWQ6IGJvb2xlYW4sXG4gICAgc2tpcENsYXNzRGVjb3JhdG9yczogYm9vbGVhbik6IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPiB7XG4gIHJldHVybiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PiB7XG4gICAgLy8gRW5zdXJlIHRoYXQgcmVmZXJlbmNlZCB0eXBlIHN5bWJvbHMgYXJlIG5vdCBlbGlkZWQgYnkgVHlwZVNjcmlwdC4gSW1wb3J0cyBmb3JcbiAgICAvLyBzdWNoIHBhcmFtZXRlciB0eXBlIHN5bWJvbHMgcHJldmlvdXNseSBjb3VsZCBiZSB0eXBlLW9ubHksIGJ1dCBub3cgbWlnaHQgYmUgYWxzb1xuICAgIC8vIHVzZWQgaW4gdGhlIGBjdG9yUGFyYW1ldGVyc2Agc3RhdGljIHByb3BlcnR5IGFzIGEgdmFsdWUuIFdlIHdhbnQgdG8gbWFrZSBzdXJlXG4gICAgLy8gdGhhdCBUeXBlU2NyaXB0IGRvZXMgbm90IGVsaWRlIGltcG9ydHMgZm9yIHN1Y2ggdHlwZSByZWZlcmVuY2VzLiBSZWFkIG1vcmVcbiAgICAvLyBhYm91dCB0aGlzIGluIHRoZSBkZXNjcmlwdGlvbiBmb3IgYGxvYWRJc1JlZmVyZW5jZWRBbGlhc0RlY2xhcmF0aW9uUGF0Y2hgLlxuICAgIGNvbnN0IHJlZmVyZW5jZWRQYXJhbWV0ZXJUeXBlcyA9IGxvYWRJc1JlZmVyZW5jZWRBbGlhc0RlY2xhcmF0aW9uUGF0Y2goY29udGV4dCk7XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBhbiBFbnRpdHlOYW1lIChmcm9tIGEgdHlwZSBhbm5vdGF0aW9uKSB0byBhbiBleHByZXNzaW9uIChhY2Nlc3NpbmcgYSB2YWx1ZSkuXG4gICAgICpcbiAgICAgKiBGb3IgYSBnaXZlbiBxdWFsaWZpZWQgbmFtZSwgdGhpcyB3YWxrcyBkZXB0aCBmaXJzdCB0byBmaW5kIHRoZSBsZWZ0bW9zdCBpZGVudGlmaWVyLFxuICAgICAqIGFuZCB0aGVuIGNvbnZlcnRzIHRoZSBwYXRoIGludG8gYSBwcm9wZXJ0eSBhY2Nlc3MgdGhhdCBjYW4gYmUgdXNlZCBhcyBleHByZXNzaW9uLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGVudGl0eU5hbWVUb0V4cHJlc3Npb24obmFtZTogdHMuRW50aXR5TmFtZSk6IHRzLkV4cHJlc3Npb258dW5kZWZpbmVkIHtcbiAgICAgIGNvbnN0IHN5bWJvbCA9IHR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obmFtZSk7XG4gICAgICAvLyBDaGVjayBpZiB0aGUgZW50aXR5IG5hbWUgcmVmZXJlbmNlcyBhIHN5bWJvbCB0aGF0IGlzIGFuIGFjdHVhbCB2YWx1ZS4gSWYgaXQgaXMgbm90LCBpdFxuICAgICAgLy8gY2Fubm90IGJlIHJlZmVyZW5jZWQgYnkgYW4gZXhwcmVzc2lvbiwgc28gcmV0dXJuIHVuZGVmaW5lZC5cbiAgICAgIGlmICghc3ltYm9sIHx8ICFzeW1ib2xJc1J1bnRpbWVWYWx1ZSh0eXBlQ2hlY2tlciwgc3ltYm9sKSB8fCAhc3ltYm9sLmRlY2xhcmF0aW9ucyB8fFxuICAgICAgICAgIHN5bWJvbC5kZWNsYXJhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICAvLyBJZiB3ZSBkZWFsIHdpdGggYSBxdWFsaWZpZWQgbmFtZSwgYnVpbGQgdXAgYSBwcm9wZXJ0eSBhY2Nlc3MgZXhwcmVzc2lvblxuICAgICAgLy8gdGhhdCBjb3VsZCBiZSB1c2VkIGluIHRoZSBKYXZhU2NyaXB0IG91dHB1dC5cbiAgICAgIGlmICh0cy5pc1F1YWxpZmllZE5hbWUobmFtZSkpIHtcbiAgICAgICAgY29uc3QgY29udGFpbmVyRXhwciA9IGVudGl0eU5hbWVUb0V4cHJlc3Npb24obmFtZS5sZWZ0KTtcbiAgICAgICAgaWYgKGNvbnRhaW5lckV4cHIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGNvbnRhaW5lckV4cHIsIG5hbWUucmlnaHQpO1xuICAgICAgfVxuICAgICAgY29uc3QgZGVjbCA9IHN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gICAgICAvLyBJZiB0aGUgZ2l2ZW4gZW50aXR5IG5hbWUgaGFzIGJlZW4gcmVzb2x2ZWQgdG8gYW4gYWxpYXMgaW1wb3J0IGRlY2xhcmF0aW9uLFxuICAgICAgLy8gZW5zdXJlIHRoYXQgdGhlIGFsaWFzIGRlY2xhcmF0aW9uIGlzIG5vdCBlbGlkZWQgYnkgVHlwZVNjcmlwdCwgYW5kIHVzZSBpdHNcbiAgICAgIC8vIG5hbWUgaWRlbnRpZmllciB0byByZWZlcmVuY2UgaXQgYXQgcnVudGltZS5cbiAgICAgIGlmIChpc0FsaWFzSW1wb3J0RGVjbGFyYXRpb24oZGVjbCkpIHtcbiAgICAgICAgcmVmZXJlbmNlZFBhcmFtZXRlclR5cGVzLmFkZChkZWNsKTtcbiAgICAgICAgLy8gSWYgdGhlIGVudGl0eSBuYW1lIHJlc29sdmVzIHRvIGFuIGFsaWFzIGltcG9ydCBkZWNsYXJhdGlvbiwgd2UgcmVmZXJlbmNlIHRoZVxuICAgICAgICAvLyBlbnRpdHkgYmFzZWQgb24gdGhlIGFsaWFzIGltcG9ydCBuYW1lLiBUaGlzIGVuc3VyZXMgdGhhdCBUeXBlU2NyaXB0IHByb3Blcmx5XG4gICAgICAgIC8vIHJlc29sdmVzIHRoZSBsaW5rIHRvIHRoZSBpbXBvcnQuIENsb25pbmcgdGhlIG9yaWdpbmFsIGVudGl0eSBuYW1lIGlkZW50aWZpZXJcbiAgICAgICAgLy8gY291bGQgbGVhZCB0byBhbiBpbmNvcnJlY3QgcmVzb2x1dGlvbiBhdCBsb2NhbCBzY29wZS4gZS5nLiBDb25zaWRlciB0aGUgZm9sbG93aW5nXG4gICAgICAgIC8vIHNuaXBwZXQ6IGBjb25zdHJ1Y3RvcihEZXA6IERlcCkge31gLiBJbiBzdWNoIGEgY2FzZSwgdGhlIGxvY2FsIGBEZXBgIGlkZW50aWZpZXJcbiAgICAgICAgLy8gd291bGQgcmVzb2x2ZSB0byB0aGUgYWN0dWFsIHBhcmFtZXRlciBuYW1lLCBhbmQgbm90IHRvIHRoZSBkZXNpcmVkIGltcG9ydC5cbiAgICAgICAgLy8gVGhpcyBoYXBwZW5zIGJlY2F1c2UgdGhlIGVudGl0eSBuYW1lIGlkZW50aWZpZXIgc3ltYm9sIGlzIGludGVybmFsbHkgY29uc2lkZXJlZFxuICAgICAgICAvLyBhcyB0eXBlLW9ubHkgYW5kIHRoZXJlZm9yZSBUeXBlU2NyaXB0IHRyaWVzIHRvIHJlc29sdmUgaXQgYXMgdmFsdWUgbWFudWFsbHkuXG4gICAgICAgIC8vIFdlIGNhbiBoZWxwIFR5cGVTY3JpcHQgYW5kIGF2b2lkIHRoaXMgbm9uLXJlbGlhYmxlIHJlc29sdXRpb24gYnkgdXNpbmcgYW4gaWRlbnRpZmllclxuICAgICAgICAvLyB0aGF0IGlzIG5vdCB0eXBlLW9ubHkgYW5kIGlzIGRpcmVjdGx5IGxpbmtlZCB0byB0aGUgaW1wb3J0IGFsaWFzIGRlY2xhcmF0aW9uLlxuICAgICAgICBpZiAoZGVjbC5uYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gdHMuZ2V0TXV0YWJsZUNsb25lKGRlY2wubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIENsb25lIHRoZSBvcmlnaW5hbCBlbnRpdHkgbmFtZSBpZGVudGlmaWVyIHNvIHRoYXQgaXQgY2FuIGJlIHVzZWQgdG8gcmVmZXJlbmNlXG4gICAgICAvLyBpdHMgdmFsdWUgYXQgcnVudGltZS4gVGhpcyBpcyB1c2VkIHdoZW4gdGhlIGlkZW50aWZpZXIgaXMgcmVzb2x2aW5nIHRvIGEgZmlsZVxuICAgICAgLy8gbG9jYWwgZGVjbGFyYXRpb24gKG90aGVyd2lzZSBpdCB3b3VsZCByZXNvbHZlIHRvIGFuIGFsaWFzIGltcG9ydCBkZWNsYXJhdGlvbikuXG4gICAgICByZXR1cm4gdHMuZ2V0TXV0YWJsZUNsb25lKG5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSBjbGFzcyBlbGVtZW50LiBSZXR1cm5zIGEgdGhyZWUgdHVwbGUgb2YgbmFtZSwgdHJhbnNmb3JtZWQgZWxlbWVudCwgYW5kXG4gICAgICogZGVjb3JhdG9ycyBmb3VuZC4gUmV0dXJucyBhbiB1bmRlZmluZWQgbmFtZSBpZiB0aGVyZSBhcmUgbm8gZGVjb3JhdG9ycyB0byBsb3dlciBvbiB0aGVcbiAgICAgKiBlbGVtZW50LCBvciB0aGUgZWxlbWVudCBoYXMgYW4gZXhvdGljIG5hbWUuXG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtQ2xhc3NFbGVtZW50KGVsZW1lbnQ6IHRzLkNsYXNzRWxlbWVudCk6XG4gICAgICAgIFtzdHJpbmd8dW5kZWZpbmVkLCB0cy5DbGFzc0VsZW1lbnQsIHRzLkRlY29yYXRvcltdXSB7XG4gICAgICBlbGVtZW50ID0gdHMudmlzaXRFYWNoQ2hpbGQoZWxlbWVudCwgZGVjb3JhdG9yRG93bmxldmVsVmlzaXRvciwgY29udGV4dCk7XG4gICAgICBjb25zdCBkZWNvcmF0b3JzVG9LZWVwOiB0cy5EZWNvcmF0b3JbXSA9IFtdO1xuICAgICAgY29uc3QgdG9Mb3dlcjogdHMuRGVjb3JhdG9yW10gPSBbXTtcbiAgICAgIGNvbnN0IGRlY29yYXRvcnMgPSBob3N0LmdldERlY29yYXRvcnNPZkRlY2xhcmF0aW9uKGVsZW1lbnQpIHx8IFtdO1xuICAgICAgZm9yIChjb25zdCBkZWNvcmF0b3Igb2YgZGVjb3JhdG9ycykge1xuICAgICAgICAvLyBXZSBvbmx5IGRlYWwgd2l0aCBjb25jcmV0ZSBub2RlcyBpbiBUeXBlU2NyaXB0IHNvdXJjZXMsIHNvIHdlIGRvbid0XG4gICAgICAgIC8vIG5lZWQgdG8gaGFuZGxlIHN5bnRoZXRpY2FsbHkgY3JlYXRlZCBkZWNvcmF0b3JzLlxuICAgICAgICBjb25zdCBkZWNvcmF0b3JOb2RlID0gZGVjb3JhdG9yLm5vZGUhIGFzIHRzLkRlY29yYXRvcjtcbiAgICAgICAgaWYgKCFpc0FuZ3VsYXJEZWNvcmF0b3IoZGVjb3JhdG9yLCBpc0NvcmUpKSB7XG4gICAgICAgICAgZGVjb3JhdG9yc1RvS2VlcC5wdXNoKGRlY29yYXRvck5vZGUpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRvTG93ZXIucHVzaChkZWNvcmF0b3JOb2RlKTtcbiAgICAgIH1cbiAgICAgIGlmICghdG9Mb3dlci5sZW5ndGgpIHJldHVybiBbdW5kZWZpbmVkLCBlbGVtZW50LCBbXV07XG5cbiAgICAgIGlmICghZWxlbWVudC5uYW1lIHx8ICF0cy5pc0lkZW50aWZpZXIoZWxlbWVudC5uYW1lKSkge1xuICAgICAgICAvLyBNZXRob2QgaGFzIGEgd2VpcmQgbmFtZSwgZS5nLlxuICAgICAgICAvLyAgIFtTeW1ib2wuZm9vXSgpIHsuLi59XG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goe1xuICAgICAgICAgIGZpbGU6IGVsZW1lbnQuZ2V0U291cmNlRmlsZSgpLFxuICAgICAgICAgIHN0YXJ0OiBlbGVtZW50LmdldFN0YXJ0KCksXG4gICAgICAgICAgbGVuZ3RoOiBlbGVtZW50LmdldEVuZCgpIC0gZWxlbWVudC5nZXRTdGFydCgpLFxuICAgICAgICAgIG1lc3NhZ2VUZXh0OiBgQ2Fubm90IHByb2Nlc3MgZGVjb3JhdG9ycyBmb3IgY2xhc3MgZWxlbWVudCB3aXRoIG5vbi1hbmFseXphYmxlIG5hbWUuYCxcbiAgICAgICAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gW3VuZGVmaW5lZCwgZWxlbWVudCwgW11dO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBuYW1lID0gKGVsZW1lbnQubmFtZSBhcyB0cy5JZGVudGlmaWVyKS50ZXh0O1xuICAgICAgY29uc3QgbXV0YWJsZSA9IHRzLmdldE11dGFibGVDbG9uZShlbGVtZW50KTtcbiAgICAgIChtdXRhYmxlIGFzIGFueSkuZGVjb3JhdG9ycyA9IGRlY29yYXRvcnNUb0tlZXAubGVuZ3RoID9cbiAgICAgICAgICB0cy5zZXRUZXh0UmFuZ2UodHMuY3JlYXRlTm9kZUFycmF5KGRlY29yYXRvcnNUb0tlZXApLCBtdXRhYmxlLmRlY29yYXRvcnMpIDpcbiAgICAgICAgICB1bmRlZmluZWQ7XG4gICAgICByZXR1cm4gW25hbWUsIG11dGFibGUsIHRvTG93ZXJdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSBjb25zdHJ1Y3Rvci4gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgY29uc3RydWN0b3IgYW5kIHRoZSBsaXN0IG9mIHBhcmFtZXRlclxuICAgICAqIGluZm9ybWF0aW9uIGNvbGxlY3RlZCwgY29uc2lzdGluZyBvZiBkZWNvcmF0b3JzIGFuZCBvcHRpb25hbCB0eXBlLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRyYW5zZm9ybUNvbnN0cnVjdG9yKGN0b3I6IHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb24pOlxuICAgICAgICBbdHMuQ29uc3RydWN0b3JEZWNsYXJhdGlvbiwgUGFyYW1ldGVyRGVjb3JhdGlvbkluZm9bXV0ge1xuICAgICAgY3RvciA9IHRzLnZpc2l0RWFjaENoaWxkKGN0b3IsIGRlY29yYXRvckRvd25sZXZlbFZpc2l0b3IsIGNvbnRleHQpO1xuXG4gICAgICBjb25zdCBuZXdQYXJhbWV0ZXJzOiB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbltdID0gW107XG4gICAgICBjb25zdCBvbGRQYXJhbWV0ZXJzID1cbiAgICAgICAgICB0cy52aXNpdFBhcmFtZXRlckxpc3QoY3Rvci5wYXJhbWV0ZXJzLCBkZWNvcmF0b3JEb3dubGV2ZWxWaXNpdG9yLCBjb250ZXh0KTtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnNJbmZvOiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mb1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHBhcmFtIG9mIG9sZFBhcmFtZXRlcnMpIHtcbiAgICAgICAgY29uc3QgZGVjb3JhdG9yc1RvS2VlcDogdHMuRGVjb3JhdG9yW10gPSBbXTtcbiAgICAgICAgY29uc3QgcGFyYW1JbmZvOiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mbyA9IHtkZWNvcmF0b3JzOiBbXSwgdHlwZTogbnVsbH07XG4gICAgICAgIGNvbnN0IGRlY29yYXRvcnMgPSBob3N0LmdldERlY29yYXRvcnNPZkRlY2xhcmF0aW9uKHBhcmFtKSB8fCBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGRlY29yYXRvciBvZiBkZWNvcmF0b3JzKSB7XG4gICAgICAgICAgLy8gV2Ugb25seSBkZWFsIHdpdGggY29uY3JldGUgbm9kZXMgaW4gVHlwZVNjcmlwdCBzb3VyY2VzLCBzbyB3ZSBkb24ndFxuICAgICAgICAgIC8vIG5lZWQgdG8gaGFuZGxlIHN5bnRoZXRpY2FsbHkgY3JlYXRlZCBkZWNvcmF0b3JzLlxuICAgICAgICAgIGNvbnN0IGRlY29yYXRvck5vZGUgPSBkZWNvcmF0b3Iubm9kZSEgYXMgdHMuRGVjb3JhdG9yO1xuICAgICAgICAgIGlmICghaXNBbmd1bGFyRGVjb3JhdG9yKGRlY29yYXRvciwgaXNDb3JlKSkge1xuICAgICAgICAgICAgZGVjb3JhdG9yc1RvS2VlcC5wdXNoKGRlY29yYXRvck5vZGUpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmFtSW5mbyEuZGVjb3JhdG9ycy5wdXNoKGRlY29yYXRvck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYXJhbS50eXBlKSB7XG4gICAgICAgICAgLy8gcGFyYW0gaGFzIGEgdHlwZSBwcm92aWRlZCwgZS5nLiBcImZvbzogQmFyXCIuXG4gICAgICAgICAgLy8gVGhlIHR5cGUgd2lsbCBiZSBlbWl0dGVkIGFzIGEgdmFsdWUgZXhwcmVzc2lvbiBpbiBlbnRpdHlOYW1lVG9FeHByZXNzaW9uLCB3aGljaCB0YWtlc1xuICAgICAgICAgIC8vIGNhcmUgbm90IHRvIGVtaXQgYW55dGhpbmcgZm9yIHR5cGVzIHRoYXQgY2Fubm90IGJlIGV4cHJlc3NlZCBhcyBhIHZhbHVlIChlLmcuXG4gICAgICAgICAgLy8gaW50ZXJmYWNlcykuXG4gICAgICAgICAgcGFyYW1JbmZvIS50eXBlID0gcGFyYW0udHlwZTtcbiAgICAgICAgfVxuICAgICAgICBwYXJhbWV0ZXJzSW5mby5wdXNoKHBhcmFtSW5mbyk7XG4gICAgICAgIGNvbnN0IG5ld1BhcmFtID0gdHMudXBkYXRlUGFyYW1ldGVyKFxuICAgICAgICAgICAgcGFyYW0sXG4gICAgICAgICAgICAvLyBNdXN0IHBhc3MgJ3VuZGVmaW5lZCcgdG8gYXZvaWQgZW1pdHRpbmcgZGVjb3JhdG9yIG1ldGFkYXRhLlxuICAgICAgICAgICAgZGVjb3JhdG9yc1RvS2VlcC5sZW5ndGggPyBkZWNvcmF0b3JzVG9LZWVwIDogdW5kZWZpbmVkLCBwYXJhbS5tb2RpZmllcnMsXG4gICAgICAgICAgICBwYXJhbS5kb3REb3REb3RUb2tlbiwgcGFyYW0ubmFtZSwgcGFyYW0ucXVlc3Rpb25Ub2tlbiwgcGFyYW0udHlwZSwgcGFyYW0uaW5pdGlhbGl6ZXIpO1xuICAgICAgICBuZXdQYXJhbWV0ZXJzLnB1c2gobmV3UGFyYW0pO1xuICAgICAgfVxuICAgICAgY29uc3QgdXBkYXRlZCA9IHRzLnVwZGF0ZUNvbnN0cnVjdG9yKFxuICAgICAgICAgIGN0b3IsIGN0b3IuZGVjb3JhdG9ycywgY3Rvci5tb2RpZmllcnMsIG5ld1BhcmFtZXRlcnMsXG4gICAgICAgICAgdHMudmlzaXRGdW5jdGlvbkJvZHkoY3Rvci5ib2R5LCBkZWNvcmF0b3JEb3dubGV2ZWxWaXNpdG9yLCBjb250ZXh0KSk7XG4gICAgICByZXR1cm4gW3VwZGF0ZWQsIHBhcmFtZXRlcnNJbmZvXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2Zvcm1zIGEgc2luZ2xlIGNsYXNzIGRlY2xhcmF0aW9uOlxuICAgICAqIC0gZGlzcGF0Y2hlcyB0byBzdHJpcCBkZWNvcmF0b3JzIG9uIG1lbWJlcnNcbiAgICAgKiAtIGNvbnZlcnRzIGRlY29yYXRvcnMgb24gdGhlIGNsYXNzIHRvIGFubm90YXRpb25zXG4gICAgICogLSBjcmVhdGVzIGEgY3RvclBhcmFtZXRlcnMgcHJvcGVydHlcbiAgICAgKiAtIGNyZWF0ZXMgYSBwcm9wRGVjb3JhdG9ycyBwcm9wZXJ0eVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRyYW5zZm9ybUNsYXNzRGVjbGFyYXRpb24oY2xhc3NEZWNsOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogdHMuQ2xhc3NEZWNsYXJhdGlvbiB7XG4gICAgICBjbGFzc0RlY2wgPSB0cy5nZXRNdXRhYmxlQ2xvbmUoY2xhc3NEZWNsKTtcblxuICAgICAgY29uc3QgbmV3TWVtYmVyczogdHMuQ2xhc3NFbGVtZW50W10gPSBbXTtcbiAgICAgIGNvbnN0IGRlY29yYXRlZFByb3BlcnRpZXMgPSBuZXcgTWFwPHN0cmluZywgdHMuRGVjb3JhdG9yW10+KCk7XG4gICAgICBsZXQgY2xhc3NQYXJhbWV0ZXJzOiBQYXJhbWV0ZXJEZWNvcmF0aW9uSW5mb1tdfG51bGwgPSBudWxsO1xuXG4gICAgICBmb3IgKGNvbnN0IG1lbWJlciBvZiBjbGFzc0RlY2wubWVtYmVycykge1xuICAgICAgICBzd2l0Y2ggKG1lbWJlci5raW5kKSB7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlByb3BlcnR5RGVjbGFyYXRpb246XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkdldEFjY2Vzc29yOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5TZXRBY2Nlc3NvcjpcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTWV0aG9kRGVjbGFyYXRpb246IHtcbiAgICAgICAgICAgIGNvbnN0IFtuYW1lLCBuZXdNZW1iZXIsIGRlY29yYXRvcnNdID0gdHJhbnNmb3JtQ2xhc3NFbGVtZW50KG1lbWJlcik7XG4gICAgICAgICAgICBuZXdNZW1iZXJzLnB1c2gobmV3TWVtYmVyKTtcbiAgICAgICAgICAgIGlmIChuYW1lKSBkZWNvcmF0ZWRQcm9wZXJ0aWVzLnNldChuYW1lLCBkZWNvcmF0b3JzKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ29uc3RydWN0b3I6IHtcbiAgICAgICAgICAgIGNvbnN0IGN0b3IgPSBtZW1iZXIgYXMgdHMuQ29uc3RydWN0b3JEZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIGlmICghY3Rvci5ib2R5KSBicmVhaztcbiAgICAgICAgICAgIGNvbnN0IFtuZXdNZW1iZXIsIHBhcmFtZXRlcnNJbmZvXSA9XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtQ29uc3RydWN0b3IobWVtYmVyIGFzIHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb24pO1xuICAgICAgICAgICAgY2xhc3NQYXJhbWV0ZXJzID0gcGFyYW1ldGVyc0luZm87XG4gICAgICAgICAgICBuZXdNZW1iZXJzLnB1c2gobmV3TWVtYmVyKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgbmV3TWVtYmVycy5wdXNoKHRzLnZpc2l0RWFjaENoaWxkKG1lbWJlciwgZGVjb3JhdG9yRG93bmxldmVsVmlzaXRvciwgY29udGV4dCkpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgYFJlZmxlY3Rpb25Ib3N0LmdldERlY29yYXRvcnNPZkRlY2xhcmF0aW9uKClgIG1ldGhvZCB3aWxsIG5vdCByZXR1cm4gY2VydGFpbiBraW5kcyBvZlxuICAgICAgLy8gZGVjb3JhdG9ycyB0aGF0IHdpbGwgbmV2ZXIgYmUgQW5ndWxhciBkZWNvcmF0b3JzLiBTbyB3ZSBjYW5ub3QgcmVseSBvbiBpdCB0byBjYXB0dXJlIGFsbFxuICAgICAgLy8gdGhlIGRlY29yYXRvcnMgdGhhdCBzaG91bGQgYmUga2VwdC4gSW5zdGVhZCB3ZSBzdGFydCBvZmYgd2l0aCBhIHNldCBvZiB0aGUgcmF3IGRlY29yYXRvcnNcbiAgICAgIC8vIG9uIHRoZSBjbGFzcywgYW5kIG9ubHkgcmVtb3ZlIHRoZSBvbmVzIHRoYXQgaGF2ZSBiZWVuIGlkZW50aWZpZWQgZm9yIGRvd25sZXZlbGluZy5cbiAgICAgIGNvbnN0IGRlY29yYXRvcnNUb0tlZXAgPSBuZXcgU2V0PHRzLkRlY29yYXRvcj4oY2xhc3NEZWNsLmRlY29yYXRvcnMpO1xuICAgICAgY29uc3QgcG9zc2libGVBbmd1bGFyRGVjb3JhdG9ycyA9IGhvc3QuZ2V0RGVjb3JhdG9yc09mRGVjbGFyYXRpb24oY2xhc3NEZWNsKSB8fCBbXTtcblxuICAgICAgbGV0IGhhc0FuZ3VsYXJEZWNvcmF0b3IgPSBmYWxzZTtcbiAgICAgIGNvbnN0IGRlY29yYXRvcnNUb0xvd2VyID0gW107XG4gICAgICBmb3IgKGNvbnN0IGRlY29yYXRvciBvZiBwb3NzaWJsZUFuZ3VsYXJEZWNvcmF0b3JzKSB7XG4gICAgICAgIC8vIFdlIG9ubHkgZGVhbCB3aXRoIGNvbmNyZXRlIG5vZGVzIGluIFR5cGVTY3JpcHQgc291cmNlcywgc28gd2UgZG9uJ3RcbiAgICAgICAgLy8gbmVlZCB0byBoYW5kbGUgc3ludGhldGljYWxseSBjcmVhdGVkIGRlY29yYXRvcnMuXG4gICAgICAgIGNvbnN0IGRlY29yYXRvck5vZGUgPSBkZWNvcmF0b3Iubm9kZSEgYXMgdHMuRGVjb3JhdG9yO1xuICAgICAgICBjb25zdCBpc05nRGVjb3JhdG9yID0gaXNBbmd1bGFyRGVjb3JhdG9yKGRlY29yYXRvciwgaXNDb3JlKTtcblxuICAgICAgICAvLyBLZWVwIHRyYWNrIGlmIHdlIGNvbWUgYWNyb3NzIGFuIEFuZ3VsYXIgY2xhc3MgZGVjb3JhdG9yLiBUaGlzIGlzIHVzZWRcbiAgICAgICAgLy8gZm9yIHRvIGRldGVybWluZSB3aGV0aGVyIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMgc2hvdWxkIGJlIGNhcHR1cmVkIG9yIG5vdC5cbiAgICAgICAgaWYgKGlzTmdEZWNvcmF0b3IpIHtcbiAgICAgICAgICBoYXNBbmd1bGFyRGVjb3JhdG9yID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc05nRGVjb3JhdG9yICYmICFza2lwQ2xhc3NEZWNvcmF0b3JzKSB7XG4gICAgICAgICAgZGVjb3JhdG9yc1RvTG93ZXIucHVzaChleHRyYWN0TWV0YWRhdGFGcm9tU2luZ2xlRGVjb3JhdG9yKGRlY29yYXRvck5vZGUsIGRpYWdub3N0aWNzKSk7XG4gICAgICAgICAgZGVjb3JhdG9yc1RvS2VlcC5kZWxldGUoZGVjb3JhdG9yTm9kZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGRlY29yYXRvcnNUb0xvd2VyLmxlbmd0aCkge1xuICAgICAgICBuZXdNZW1iZXJzLnB1c2goY3JlYXRlRGVjb3JhdG9yQ2xhc3NQcm9wZXJ0eShkZWNvcmF0b3JzVG9Mb3dlcikpO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzUGFyYW1ldGVycykge1xuICAgICAgICBpZiAoaGFzQW5ndWxhckRlY29yYXRvciB8fCBjbGFzc1BhcmFtZXRlcnMuc29tZShwID0+ICEhcC5kZWNvcmF0b3JzLmxlbmd0aCkpIHtcbiAgICAgICAgICAvLyBDYXB0dXJlIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMgaWYgdGhlIGNsYXNzIGhhcyBBbmd1bGFyIGRlY29yYXRvciBhcHBsaWVkLFxuICAgICAgICAgIC8vIG9yIGlmIGFueSBvZiB0aGUgcGFyYW1ldGVycyBoYXMgZGVjb3JhdG9ycyBhcHBsaWVkIGRpcmVjdGx5LlxuICAgICAgICAgIG5ld01lbWJlcnMucHVzaChjcmVhdGVDdG9yUGFyYW1ldGVyc0NsYXNzUHJvcGVydHkoXG4gICAgICAgICAgICAgIGRpYWdub3N0aWNzLCBlbnRpdHlOYW1lVG9FeHByZXNzaW9uLCBjbGFzc1BhcmFtZXRlcnMsIGlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZGVjb3JhdGVkUHJvcGVydGllcy5zaXplKSB7XG4gICAgICAgIG5ld01lbWJlcnMucHVzaChjcmVhdGVQcm9wRGVjb3JhdG9yc0NsYXNzUHJvcGVydHkoZGlhZ25vc3RpY3MsIGRlY29yYXRlZFByb3BlcnRpZXMpKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbWVtYmVycyA9IHRzLnNldFRleHRSYW5nZShcbiAgICAgICAgICB0cy5jcmVhdGVOb2RlQXJyYXkobmV3TWVtYmVycywgY2xhc3NEZWNsLm1lbWJlcnMuaGFzVHJhaWxpbmdDb21tYSksIGNsYXNzRGVjbC5tZW1iZXJzKTtcblxuICAgICAgcmV0dXJuIHRzLnVwZGF0ZUNsYXNzRGVjbGFyYXRpb24oXG4gICAgICAgICAgY2xhc3NEZWNsLCBkZWNvcmF0b3JzVG9LZWVwLnNpemUgPyBBcnJheS5mcm9tKGRlY29yYXRvcnNUb0tlZXApIDogdW5kZWZpbmVkLFxuICAgICAgICAgIGNsYXNzRGVjbC5tb2RpZmllcnMsIGNsYXNzRGVjbC5uYW1lLCBjbGFzc0RlY2wudHlwZVBhcmFtZXRlcnMsIGNsYXNzRGVjbC5oZXJpdGFnZUNsYXVzZXMsXG4gICAgICAgICAgbWVtYmVycyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtZXIgdmlzaXRvciB0aGF0IGxvb2tzIGZvciBBbmd1bGFyIGRlY29yYXRvcnMgYW5kIHJlcGxhY2VzIHRoZW0gd2l0aFxuICAgICAqIGRvd25sZXZlbGVkIHN0YXRpYyBwcm9wZXJ0aWVzLiBBbHNvIGNvbGxlY3RzIGNvbnN0cnVjdG9yIHR5cGUgbWV0YWRhdGEgZm9yXG4gICAgICogY2xhc3MgZGVjbGFyYXRpb24gdGhhdCBhcmUgZGVjb3JhdGVkIHdpdGggYW4gQW5ndWxhciBkZWNvcmF0b3IuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZGVjb3JhdG9yRG93bmxldmVsVmlzaXRvcihub2RlOiB0cy5Ob2RlKTogdHMuTm9kZSB7XG4gICAgICBpZiAodHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1DbGFzc0RlY2xhcmF0aW9uKG5vZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIGRlY29yYXRvckRvd25sZXZlbFZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cblxuICAgIHJldHVybiAoc2Y6IHRzLlNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIERvd25sZXZlbCBkZWNvcmF0b3JzIGFuZCBjb25zdHJ1Y3RvciBwYXJhbWV0ZXIgdHlwZXMuIFdlIHdpbGwga2VlcCB0cmFjayBvZiBhbGxcbiAgICAgIC8vIHJlZmVyZW5jZWQgY29uc3RydWN0b3IgcGFyYW1ldGVyIHR5cGVzIHNvIHRoYXQgd2UgY2FuIGluc3RydWN0IFR5cGVTY3JpcHQgdG9cbiAgICAgIC8vIG5vdCBlbGlkZSB0aGVpciBpbXBvcnRzIGlmIHRoZXkgcHJldmlvdXNseSB3ZXJlIG9ubHkgdHlwZS1vbmx5LlxuICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKHNmLCBkZWNvcmF0b3JEb3dubGV2ZWxWaXNpdG9yLCBjb250ZXh0KTtcbiAgICB9O1xuICB9O1xufVxuIl19