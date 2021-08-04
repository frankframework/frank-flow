/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AST, ASTWithSource, BindingPipe, MethodCall, PropertyRead, PropertyWrite, SafeMethodCall, SafePropertyRead, TmplAstBoundAttribute, TmplAstBoundEvent, TmplAstElement, TmplAstReference, TmplAstTemplate, TmplAstTextAttribute, TmplAstVariable } from '@angular/compiler';
import * as ts from 'typescript';
import { isAssignment, isSymbolWithValueDeclaration } from '../../util/src/typescript';
import { SymbolKind } from '../api';
import { ExpressionIdentifier, findAllMatchingNodes, findFirstMatchingNode, hasExpressionIdentifier } from './comments';
import { isAccessExpression } from './ts_util';
/**
 * Generates and caches `Symbol`s for various template structures for a given component.
 *
 * The `SymbolBuilder` internally caches the `Symbol`s it creates, and must be destroyed and
 * replaced if the component's template changes.
 */
export class SymbolBuilder {
    constructor(shimPath, typeCheckBlock, templateData, componentScopeReader, 
    // The `ts.TypeChecker` depends on the current type-checking program, and so must be requested
    // on-demand instead of cached.
    getTypeChecker) {
        this.shimPath = shimPath;
        this.typeCheckBlock = typeCheckBlock;
        this.templateData = templateData;
        this.componentScopeReader = componentScopeReader;
        this.getTypeChecker = getTypeChecker;
        this.symbolCache = new Map();
    }
    getSymbol(node) {
        if (this.symbolCache.has(node)) {
            return this.symbolCache.get(node);
        }
        let symbol = null;
        if (node instanceof TmplAstBoundAttribute || node instanceof TmplAstTextAttribute) {
            // TODO(atscott): input and output bindings only return the first directive match but should
            // return a list of bindings for all of them.
            symbol = this.getSymbolOfInputBinding(node);
        }
        else if (node instanceof TmplAstBoundEvent) {
            symbol = this.getSymbolOfBoundEvent(node);
        }
        else if (node instanceof TmplAstElement) {
            symbol = this.getSymbolOfElement(node);
        }
        else if (node instanceof TmplAstTemplate) {
            symbol = this.getSymbolOfAstTemplate(node);
        }
        else if (node instanceof TmplAstVariable) {
            symbol = this.getSymbolOfVariable(node);
        }
        else if (node instanceof TmplAstReference) {
            symbol = this.getSymbolOfReference(node);
        }
        else if (node instanceof BindingPipe) {
            symbol = this.getSymbolOfPipe(node);
        }
        else if (node instanceof AST) {
            symbol = this.getSymbolOfTemplateExpression(node);
        }
        else {
            // TODO(atscott): TmplAstContent, TmplAstIcu
        }
        this.symbolCache.set(node, symbol);
        return symbol;
    }
    getSymbolOfAstTemplate(template) {
        const directives = this.getDirectivesOfNode(template);
        return { kind: SymbolKind.Template, directives, templateNode: template };
    }
    getSymbolOfElement(element) {
        var _a;
        const elementSourceSpan = (_a = element.startSourceSpan) !== null && _a !== void 0 ? _a : element.sourceSpan;
        const node = findFirstMatchingNode(this.typeCheckBlock, { withSpan: elementSourceSpan, filter: ts.isVariableDeclaration });
        if (node === null) {
            return null;
        }
        const symbolFromDeclaration = this.getSymbolOfTsNode(node);
        if (symbolFromDeclaration === null || symbolFromDeclaration.tsSymbol === null) {
            return null;
        }
        const directives = this.getDirectivesOfNode(element);
        // All statements in the TCB are `Expression`s that optionally include more information.
        // An `ElementSymbol` uses the information returned for the variable declaration expression,
        // adds the directives for the element, and updates the `kind` to be `SymbolKind.Element`.
        return Object.assign(Object.assign({}, symbolFromDeclaration), { kind: SymbolKind.Element, directives, templateNode: element });
    }
    getDirectivesOfNode(element) {
        var _a;
        const elementSourceSpan = (_a = element.startSourceSpan) !== null && _a !== void 0 ? _a : element.sourceSpan;
        const tcbSourceFile = this.typeCheckBlock.getSourceFile();
        // directives could be either:
        // - var _t1: TestDir /*T:D*/ = (null!);
        // - var _t1 /*T:D*/ = _ctor1({});
        const isDirectiveDeclaration = (node) => (ts.isTypeNode(node) || ts.isIdentifier(node)) && ts.isVariableDeclaration(node.parent) &&
            hasExpressionIdentifier(tcbSourceFile, node, ExpressionIdentifier.DIRECTIVE);
        const nodes = findAllMatchingNodes(this.typeCheckBlock, { withSpan: elementSourceSpan, filter: isDirectiveDeclaration });
        return nodes
            .map(node => {
            var _a;
            const symbol = this.getSymbolOfTsNode(node.parent);
            if (symbol === null || !isSymbolWithValueDeclaration(symbol.tsSymbol) ||
                !ts.isClassDeclaration(symbol.tsSymbol.valueDeclaration)) {
                return null;
            }
            const meta = this.getDirectiveMeta(element, symbol.tsSymbol.valueDeclaration);
            if (meta === null) {
                return null;
            }
            const ngModule = this.getDirectiveModule(symbol.tsSymbol.valueDeclaration);
            if (meta.selector === null) {
                return null;
            }
            const isComponent = (_a = meta.isComponent) !== null && _a !== void 0 ? _a : null;
            const directiveSymbol = Object.assign(Object.assign({}, symbol), { tsSymbol: symbol.tsSymbol, selector: meta.selector, isComponent,
                ngModule, kind: SymbolKind.Directive, isStructural: meta.isStructural });
            return directiveSymbol;
        })
            .filter((d) => d !== null);
    }
    getDirectiveMeta(host, directiveDeclaration) {
        var _a;
        const directives = this.templateData.boundTarget.getDirectivesOfNode(host);
        if (directives === null) {
            return null;
        }
        return (_a = directives.find(m => m.ref.node === directiveDeclaration)) !== null && _a !== void 0 ? _a : null;
    }
    getDirectiveModule(declaration) {
        const scope = this.componentScopeReader.getScopeForComponent(declaration);
        if (scope === null) {
            return null;
        }
        return scope.ngModule;
    }
    getSymbolOfBoundEvent(eventBinding) {
        const consumer = this.templateData.boundTarget.getConsumerOfBinding(eventBinding);
        if (consumer === null) {
            return null;
        }
        // Outputs in the TCB look like one of the two:
        // * _t1["outputField"].subscribe(handler);
        // * _t1.addEventListener(handler);
        // Even with strict null checks disabled, we still produce the access as a separate statement
        // so that it can be found here.
        let expectedAccess;
        if (consumer instanceof TmplAstTemplate || consumer instanceof TmplAstElement) {
            expectedAccess = 'addEventListener';
        }
        else {
            const bindingPropertyNames = consumer.outputs.getByBindingPropertyName(eventBinding.name);
            if (bindingPropertyNames === null || bindingPropertyNames.length === 0) {
                return null;
            }
            // Note that we only get the expectedAccess text from a single consumer of the binding. If
            // there are multiple consumers (not supported in the `boundTarget` API) and one of them has
            // an alias, it will not get matched here.
            expectedAccess = bindingPropertyNames[0].classPropertyName;
        }
        function filter(n) {
            if (!isAccessExpression(n)) {
                return false;
            }
            if (ts.isPropertyAccessExpression(n)) {
                return n.name.getText() === expectedAccess;
            }
            else {
                return ts.isStringLiteral(n.argumentExpression) &&
                    n.argumentExpression.text === expectedAccess;
            }
        }
        const outputFieldAccesses = findAllMatchingNodes(this.typeCheckBlock, { withSpan: eventBinding.keySpan, filter });
        const bindings = [];
        for (const outputFieldAccess of outputFieldAccesses) {
            if (consumer instanceof TmplAstTemplate || consumer instanceof TmplAstElement) {
                if (!ts.isPropertyAccessExpression(outputFieldAccess)) {
                    continue;
                }
                const addEventListener = outputFieldAccess.name;
                const tsSymbol = this.getTypeChecker().getSymbolAtLocation(addEventListener);
                const tsType = this.getTypeChecker().getTypeAtLocation(addEventListener);
                const positionInShimFile = this.getShimPositionForNode(addEventListener);
                const target = this.getSymbol(consumer);
                if (target === null || tsSymbol === undefined) {
                    continue;
                }
                bindings.push({
                    kind: SymbolKind.Binding,
                    tsSymbol,
                    tsType,
                    target,
                    shimLocation: { shimPath: this.shimPath, positionInShimFile },
                });
            }
            else {
                if (!ts.isElementAccessExpression(outputFieldAccess)) {
                    continue;
                }
                const tsSymbol = this.getTypeChecker().getSymbolAtLocation(outputFieldAccess.argumentExpression);
                if (tsSymbol === undefined) {
                    continue;
                }
                const target = this.getDirectiveSymbolForAccessExpression(outputFieldAccess, consumer);
                if (target === null) {
                    continue;
                }
                const positionInShimFile = this.getShimPositionForNode(outputFieldAccess);
                const tsType = this.getTypeChecker().getTypeAtLocation(outputFieldAccess);
                bindings.push({
                    kind: SymbolKind.Binding,
                    tsSymbol,
                    tsType,
                    target,
                    shimLocation: { shimPath: this.shimPath, positionInShimFile },
                });
            }
        }
        if (bindings.length === 0) {
            return null;
        }
        return { kind: SymbolKind.Output, bindings };
    }
    getSymbolOfInputBinding(binding) {
        const consumer = this.templateData.boundTarget.getConsumerOfBinding(binding);
        if (consumer === null) {
            return null;
        }
        if (consumer instanceof TmplAstElement || consumer instanceof TmplAstTemplate) {
            const host = this.getSymbol(consumer);
            return host !== null ? { kind: SymbolKind.DomBinding, host } : null;
        }
        const nodes = findAllMatchingNodes(this.typeCheckBlock, { withSpan: binding.sourceSpan, filter: isAssignment });
        const bindings = [];
        for (const node of nodes) {
            if (!isAccessExpression(node.left)) {
                continue;
            }
            const symbolInfo = this.getSymbolOfTsNode(node.left);
            if (symbolInfo === null || symbolInfo.tsSymbol === null) {
                continue;
            }
            const target = this.getDirectiveSymbolForAccessExpression(node.left, consumer);
            if (target === null) {
                continue;
            }
            bindings.push(Object.assign(Object.assign({}, symbolInfo), { tsSymbol: symbolInfo.tsSymbol, kind: SymbolKind.Binding, target }));
        }
        if (bindings.length === 0) {
            return null;
        }
        return { kind: SymbolKind.Input, bindings };
    }
    getDirectiveSymbolForAccessExpression(node, { isComponent, selector, isStructural }) {
        var _a;
        // In either case, `_t1["index"]` or `_t1.index`, `node.expression` is _t1.
        // The retrieved symbol for _t1 will be the variable declaration.
        const tsSymbol = this.getTypeChecker().getSymbolAtLocation(node.expression);
        if ((tsSymbol === null || tsSymbol === void 0 ? void 0 : tsSymbol.declarations) === undefined || tsSymbol.declarations.length === 0 ||
            selector === null) {
            return null;
        }
        const [declaration] = tsSymbol.declarations;
        if (!ts.isVariableDeclaration(declaration) ||
            !hasExpressionIdentifier(
            // The expression identifier could be on the type (for regular directives) or the name
            // (for generic directives and the ctor op).
            declaration.getSourceFile(), (_a = declaration.type) !== null && _a !== void 0 ? _a : declaration.name, ExpressionIdentifier.DIRECTIVE)) {
            return null;
        }
        const symbol = this.getSymbolOfTsNode(declaration);
        if (symbol === null || !isSymbolWithValueDeclaration(symbol.tsSymbol) ||
            !ts.isClassDeclaration(symbol.tsSymbol.valueDeclaration)) {
            return null;
        }
        const ngModule = this.getDirectiveModule(symbol.tsSymbol.valueDeclaration);
        return {
            kind: SymbolKind.Directive,
            tsSymbol: symbol.tsSymbol,
            tsType: symbol.tsType,
            shimLocation: symbol.shimLocation,
            isComponent,
            isStructural,
            selector,
            ngModule,
        };
    }
    getSymbolOfVariable(variable) {
        const node = findFirstMatchingNode(this.typeCheckBlock, { withSpan: variable.sourceSpan, filter: ts.isVariableDeclaration });
        if (node === null || node.initializer === undefined) {
            return null;
        }
        const expressionSymbol = this.getSymbolOfTsNode(node.initializer);
        if (expressionSymbol === null) {
            return null;
        }
        return {
            tsType: expressionSymbol.tsType,
            tsSymbol: expressionSymbol.tsSymbol,
            initializerLocation: expressionSymbol.shimLocation,
            kind: SymbolKind.Variable,
            declaration: variable,
            localVarLocation: {
                shimPath: this.shimPath,
                positionInShimFile: this.getShimPositionForNode(node.name),
            }
        };
    }
    getSymbolOfReference(ref) {
        const target = this.templateData.boundTarget.getReferenceTarget(ref);
        // Find the node for the reference declaration, i.e. `var _t2 = _t1;`
        let node = findFirstMatchingNode(this.typeCheckBlock, { withSpan: ref.sourceSpan, filter: ts.isVariableDeclaration });
        if (node === null || target === null || node.initializer === undefined) {
            return null;
        }
        // Get the original declaration for the references variable, with the exception of template refs
        // which are of the form var _t3 = (_t2 as any as i2.TemplateRef<any>)
        // TODO(atscott): Consider adding an `ExpressionIdentifier` to tag variable declaration
        // initializers as invalid for symbol retrieval.
        const originalDeclaration = ts.isParenthesizedExpression(node.initializer) &&
            ts.isAsExpression(node.initializer.expression) ?
            this.getTypeChecker().getSymbolAtLocation(node.name) :
            this.getTypeChecker().getSymbolAtLocation(node.initializer);
        if (originalDeclaration === undefined || originalDeclaration.valueDeclaration === undefined) {
            return null;
        }
        const symbol = this.getSymbolOfTsNode(originalDeclaration.valueDeclaration);
        if (symbol === null || symbol.tsSymbol === null) {
            return null;
        }
        const referenceVarShimLocation = {
            shimPath: this.shimPath,
            positionInShimFile: this.getShimPositionForNode(node),
        };
        if (target instanceof TmplAstTemplate || target instanceof TmplAstElement) {
            return {
                kind: SymbolKind.Reference,
                tsSymbol: symbol.tsSymbol,
                tsType: symbol.tsType,
                target,
                declaration: ref,
                targetLocation: symbol.shimLocation,
                referenceVarLocation: referenceVarShimLocation,
            };
        }
        else {
            if (!ts.isClassDeclaration(target.directive.ref.node)) {
                return null;
            }
            return {
                kind: SymbolKind.Reference,
                tsSymbol: symbol.tsSymbol,
                tsType: symbol.tsType,
                declaration: ref,
                target: target.directive.ref.node,
                targetLocation: symbol.shimLocation,
                referenceVarLocation: referenceVarShimLocation,
            };
        }
    }
    getSymbolOfPipe(expression) {
        const methodAccess = findFirstMatchingNode(this.typeCheckBlock, { withSpan: expression.nameSpan, filter: ts.isPropertyAccessExpression });
        if (methodAccess === null) {
            return null;
        }
        const pipeVariableNode = methodAccess.expression;
        const pipeDeclaration = this.getTypeChecker().getSymbolAtLocation(pipeVariableNode);
        if (pipeDeclaration === undefined || pipeDeclaration.valueDeclaration === undefined) {
            return null;
        }
        const pipeInstance = this.getSymbolOfTsNode(pipeDeclaration.valueDeclaration);
        // The instance should never be null, nor should the symbol lack a value declaration. This
        // is because the node used to look for the `pipeInstance` symbol info is a value
        // declaration of another symbol (i.e. the `pipeDeclaration` symbol).
        if (pipeInstance === null || !isSymbolWithValueDeclaration(pipeInstance.tsSymbol)) {
            return null;
        }
        const symbolInfo = this.getSymbolOfTsNode(methodAccess);
        if (symbolInfo === null) {
            return null;
        }
        return Object.assign(Object.assign({ kind: SymbolKind.Pipe }, symbolInfo), { classSymbol: Object.assign(Object.assign({}, pipeInstance), { tsSymbol: pipeInstance.tsSymbol }) });
    }
    getSymbolOfTemplateExpression(expression) {
        if (expression instanceof ASTWithSource) {
            expression = expression.ast;
        }
        const expressionTarget = this.templateData.boundTarget.getExpressionTarget(expression);
        if (expressionTarget !== null) {
            return this.getSymbol(expressionTarget);
        }
        // The `name` part of a `PropertyWrite` and `MethodCall` does not have its own
        // AST so there is no way to retrieve a `Symbol` for just the `name` via a specific node.
        const withSpan = (expression instanceof PropertyWrite || expression instanceof MethodCall) ?
            expression.nameSpan :
            expression.sourceSpan;
        let node = null;
        // Property reads in templates usually map to a `PropertyAccessExpression`
        // (e.g. `ctx.foo`) so try looking for one first.
        if (expression instanceof PropertyRead) {
            node = findFirstMatchingNode(this.typeCheckBlock, { withSpan, filter: ts.isPropertyAccessExpression });
        }
        // Otherwise fall back to searching for any AST node.
        if (node === null) {
            node = findFirstMatchingNode(this.typeCheckBlock, { withSpan, filter: anyNodeFilter });
        }
        if (node === null) {
            return null;
        }
        while (ts.isParenthesizedExpression(node)) {
            node = node.expression;
        }
        // - If we have safe property read ("a?.b") we want to get the Symbol for b, the `whenTrue`
        // expression.
        // - If our expression is a pipe binding ("a | test:b:c"), we want the Symbol for the
        // `transform` on the pipe.
        // - Otherwise, we retrieve the symbol for the node itself with no special considerations
        if ((expression instanceof SafePropertyRead || expression instanceof SafeMethodCall) &&
            ts.isConditionalExpression(node)) {
            const whenTrueSymbol = (expression instanceof SafeMethodCall && ts.isCallExpression(node.whenTrue)) ?
                this.getSymbolOfTsNode(node.whenTrue.expression) :
                this.getSymbolOfTsNode(node.whenTrue);
            if (whenTrueSymbol === null) {
                return null;
            }
            return Object.assign(Object.assign({}, whenTrueSymbol), { kind: SymbolKind.Expression, 
                // Rather than using the type of only the `whenTrue` part of the expression, we should
                // still get the type of the whole conditional expression to include `|undefined`.
                tsType: this.getTypeChecker().getTypeAtLocation(node) });
        }
        else {
            const symbolInfo = this.getSymbolOfTsNode(node);
            return symbolInfo === null ? null : Object.assign(Object.assign({}, symbolInfo), { kind: SymbolKind.Expression });
        }
    }
    getSymbolOfTsNode(node) {
        var _a;
        while (ts.isParenthesizedExpression(node)) {
            node = node.expression;
        }
        let tsSymbol;
        if (ts.isPropertyAccessExpression(node)) {
            tsSymbol = this.getTypeChecker().getSymbolAtLocation(node.name);
        }
        else if (ts.isElementAccessExpression(node)) {
            tsSymbol = this.getTypeChecker().getSymbolAtLocation(node.argumentExpression);
        }
        else {
            tsSymbol = this.getTypeChecker().getSymbolAtLocation(node);
        }
        const positionInShimFile = this.getShimPositionForNode(node);
        const type = this.getTypeChecker().getTypeAtLocation(node);
        return {
            // If we could not find a symbol, fall back to the symbol on the type for the node.
            // Some nodes won't have a "symbol at location" but will have a symbol for the type.
            // Examples of this would be literals and `document.createElement('div')`.
            tsSymbol: (_a = tsSymbol !== null && tsSymbol !== void 0 ? tsSymbol : type.symbol) !== null && _a !== void 0 ? _a : null,
            tsType: type,
            shimLocation: { shimPath: this.shimPath, positionInShimFile },
        };
    }
    getShimPositionForNode(node) {
        if (ts.isTypeReferenceNode(node)) {
            return this.getShimPositionForNode(node.typeName);
        }
        else if (ts.isQualifiedName(node)) {
            return node.right.getStart();
        }
        else if (ts.isPropertyAccessExpression(node)) {
            return node.name.getStart();
        }
        else if (ts.isElementAccessExpression(node)) {
            return node.argumentExpression.getStart();
        }
        else {
            return node.getStart();
        }
    }
}
/** Filter predicate function that matches any AST node. */
function anyNodeFilter(n) {
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfc3ltYm9sX2J1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3R5cGVjaGVjay9zcmMvdGVtcGxhdGVfc3ltYm9sX2J1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEdBQUcsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxxQkFBcUIsRUFBRSxpQkFBaUIsRUFBRSxjQUFjLEVBQWUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLG9CQUFvQixFQUFFLGVBQWUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzlSLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBS2pDLE9BQU8sRUFBQyxZQUFZLEVBQUUsNEJBQTRCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNyRixPQUFPLEVBQWdMLFVBQVUsRUFBK0UsTUFBTSxRQUFRLENBQUM7QUFFL1IsT0FBTyxFQUFDLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLHFCQUFxQixFQUFFLHVCQUF1QixFQUFDLE1BQU0sWUFBWSxDQUFDO0FBRXRILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUU3Qzs7Ozs7R0FLRztBQUNILE1BQU0sT0FBTyxhQUFhO0lBR3hCLFlBQ3FCLFFBQXdCLEVBQ3hCLGNBQXVCLEVBQ3ZCLFlBQTBCLEVBQzFCLG9CQUEwQztJQUMzRCw4RkFBOEY7SUFDOUYsK0JBQStCO0lBQ2QsY0FBb0M7UUFOcEMsYUFBUSxHQUFSLFFBQVEsQ0FBZ0I7UUFDeEIsbUJBQWMsR0FBZCxjQUFjLENBQVM7UUFDdkIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDMUIseUJBQW9CLEdBQXBCLG9CQUFvQixD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RUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFDO1NBQzVELENBQUM7SUFDSixDQUFDO0lBRU8sc0JBQXNCLENBQUMsSUFBYTtRQUMxQyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNoQyxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDbkQ7YUFBTSxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbkMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQzlCO2FBQU0sSUFBSSxFQUFFLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDOUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQzdCO2FBQU0sSUFBSSxFQUFFLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDN0MsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQUM7U0FDM0M7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQ3hCO0lBQ0gsQ0FBQztDQUNGO0FBRUQsMkRBQTJEO0FBQzNELFNBQVMsYUFBYSxDQUFDLENBQVU7SUFDL0IsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBCaW5kaW5nUGlwZSwgTWV0aG9kQ2FsbCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBTYWZlTWV0aG9kQ2FsbCwgU2FmZVByb3BlcnR5UmVhZCwgVG1wbEFzdEJvdW5kQXR0cmlidXRlLCBUbXBsQXN0Qm91bmRFdmVudCwgVG1wbEFzdEVsZW1lbnQsIFRtcGxBc3ROb2RlLCBUbXBsQXN0UmVmZXJlbmNlLCBUbXBsQXN0VGVtcGxhdGUsIFRtcGxBc3RUZXh0QXR0cmlidXRlLCBUbXBsQXN0VmFyaWFibGV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0Fic29sdXRlRnNQYXRofSBmcm9tICcuLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb259IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtDb21wb25lbnRTY29wZVJlYWRlcn0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtpc0Fzc2lnbm1lbnQsIGlzU3ltYm9sV2l0aFZhbHVlRGVjbGFyYXRpb259IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtCaW5kaW5nU3ltYm9sLCBEaXJlY3RpdmVTeW1ib2wsIERvbUJpbmRpbmdTeW1ib2wsIEVsZW1lbnRTeW1ib2wsIEV4cHJlc3Npb25TeW1ib2wsIElucHV0QmluZGluZ1N5bWJvbCwgT3V0cHV0QmluZGluZ1N5bWJvbCwgUGlwZVN5bWJvbCwgUmVmZXJlbmNlU3ltYm9sLCBTaGltTG9jYXRpb24sIFN5bWJvbCwgU3ltYm9sS2luZCwgVGVtcGxhdGVTeW1ib2wsIFRzTm9kZVN5bWJvbEluZm8sIFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBWYXJpYWJsZVN5bWJvbH0gZnJvbSAnLi4vYXBpJztcblxuaW1wb3J0IHtFeHByZXNzaW9uSWRlbnRpZmllciwgZmluZEFsbE1hdGNoaW5nTm9kZXMsIGZpbmRGaXJzdE1hdGNoaW5nTm9kZSwgaGFzRXhwcmVzc2lvbklkZW50aWZpZXJ9IGZyb20gJy4vY29tbWVudHMnO1xuaW1wb3J0IHtUZW1wbGF0ZURhdGF9IGZyb20gJy4vY29udGV4dCc7XG5pbXBvcnQge2lzQWNjZXNzRXhwcmVzc2lvbn0gZnJvbSAnLi90c191dGlsJztcblxuLyoqXG4gKiBHZW5lcmF0ZXMgYW5kIGNhY2hlcyBgU3ltYm9sYHMgZm9yIHZhcmlvdXMgdGVtcGxhdGUgc3RydWN0dXJlcyBmb3IgYSBnaXZlbiBjb21wb25lbnQuXG4gKlxuICogVGhlIGBTeW1ib2xCdWlsZGVyYCBpbnRlcm5hbGx5IGNhY2hlcyB0aGUgYFN5bWJvbGBzIGl0IGNyZWF0ZXMsIGFuZCBtdXN0IGJlIGRlc3Ryb3llZCBhbmRcbiAqIHJlcGxhY2VkIGlmIHRoZSBjb21wb25lbnQncyB0ZW1wbGF0ZSBjaGFuZ2VzLlxuICovXG5leHBvcnQgY2xhc3MgU3ltYm9sQnVpbGRlciB7XG4gIHByaXZhdGUgc3ltYm9sQ2FjaGUgPSBuZXcgTWFwPEFTVHxUbXBsQXN0Tm9kZSwgU3ltYm9sfG51bGw+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IHNoaW1QYXRoOiBBYnNvbHV0ZUZzUGF0aCxcbiAgICAgIHByaXZhdGUgcmVhZG9ubHkgdHlwZUNoZWNrQmxvY2s6IHRzLk5vZGUsXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IHRlbXBsYXRlRGF0YTogVGVtcGxhdGVEYXRhLFxuICAgICAgcHJpdmF0ZSByZWFkb25seSBjb21wb25lbnRTY29wZVJlYWRlcjogQ29tcG9uZW50U2NvcGVSZWFkZXIsXG4gICAgICAvLyBUaGUgYHRzLlR5cGVDaGVja2VyYCBkZXBlbmRzIG9uIHRoZSBjdXJyZW50IHR5cGUtY2hlY2tpbmcgcHJvZ3JhbSwgYW5kIHNvIG11c3QgYmUgcmVxdWVzdGVkXG4gICAgICAvLyBvbi1kZW1hbmQgaW5zdGVhZCBvZiBjYWNoZWQuXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IGdldFR5cGVDaGVja2VyOiAoKSA9PiB0cy5UeXBlQ2hlY2tlcixcbiAgKSB7fVxuXG4gIGdldFN5bWJvbChub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQpOiBUZW1wbGF0ZVN5bWJvbHxFbGVtZW50U3ltYm9sfG51bGw7XG4gIGdldFN5bWJvbChub2RlOiBUbXBsQXN0UmVmZXJlbmNlfFRtcGxBc3RWYXJpYWJsZSk6IFJlZmVyZW5jZVN5bWJvbHxWYXJpYWJsZVN5bWJvbHxudWxsO1xuICBnZXRTeW1ib2wobm9kZTogQVNUfFRtcGxBc3ROb2RlKTogU3ltYm9sfG51bGw7XG4gIGdldFN5bWJvbChub2RlOiBBU1R8VG1wbEFzdE5vZGUpOiBTeW1ib2x8bnVsbCB7XG4gICAgaWYgKHRoaXMuc3ltYm9sQ2FjaGUuaGFzKG5vZGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy5zeW1ib2xDYWNoZS5nZXQobm9kZSkhO1xuICAgIH1cblxuICAgIGxldCBzeW1ib2w6IFN5bWJvbHxudWxsID0gbnVsbDtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RCb3VuZEF0dHJpYnV0ZSB8fCBub2RlIGluc3RhbmNlb2YgVG1wbEFzdFRleHRBdHRyaWJ1dGUpIHtcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGlucHV0IGFuZCBvdXRwdXQgYmluZGluZ3Mgb25seSByZXR1cm4gdGhlIGZpcnN0IGRpcmVjdGl2ZSBtYXRjaCBidXQgc2hvdWxkXG4gICAgICAvLyByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIGZvciBhbGwgb2YgdGhlbS5cbiAgICAgIHN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZJbnB1dEJpbmRpbmcobm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEJvdW5kRXZlbnQpIHtcbiAgICAgIHN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZCb3VuZEV2ZW50KG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50KSB7XG4gICAgICBzeW1ib2wgPSB0aGlzLmdldFN5bWJvbE9mRWxlbWVudChub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUpIHtcbiAgICAgIHN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZBc3RUZW1wbGF0ZShub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0VmFyaWFibGUpIHtcbiAgICAgIHN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZWYXJpYWJsZShub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0UmVmZXJlbmNlKSB7XG4gICAgICBzeW1ib2wgPSB0aGlzLmdldFN5bWJvbE9mUmVmZXJlbmNlKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIEJpbmRpbmdQaXBlKSB7XG4gICAgICBzeW1ib2wgPSB0aGlzLmdldFN5bWJvbE9mUGlwZShub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBBU1QpIHtcbiAgICAgIHN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZUZW1wbGF0ZUV4cHJlc3Npb24obm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IFRtcGxBc3RDb250ZW50LCBUbXBsQXN0SWN1XG4gICAgfVxuXG4gICAgdGhpcy5zeW1ib2xDYWNoZS5zZXQobm9kZSwgc3ltYm9sKTtcbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRTeW1ib2xPZkFzdFRlbXBsYXRlKHRlbXBsYXRlOiBUbXBsQXN0VGVtcGxhdGUpOiBUZW1wbGF0ZVN5bWJvbHxudWxsIHtcbiAgICBjb25zdCBkaXJlY3RpdmVzID0gdGhpcy5nZXREaXJlY3RpdmVzT2ZOb2RlKHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2tpbmQ6IFN5bWJvbEtpbmQuVGVtcGxhdGUsIGRpcmVjdGl2ZXMsIHRlbXBsYXRlTm9kZTogdGVtcGxhdGV9O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRTeW1ib2xPZkVsZW1lbnQoZWxlbWVudDogVG1wbEFzdEVsZW1lbnQpOiBFbGVtZW50U3ltYm9sfG51bGwge1xuICAgIGNvbnN0IGVsZW1lbnRTb3VyY2VTcGFuID0gZWxlbWVudC5zdGFydFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuO1xuXG4gICAgY29uc3Qgbm9kZSA9IGZpbmRGaXJzdE1hdGNoaW5nTm9kZShcbiAgICAgICAgdGhpcy50eXBlQ2hlY2tCbG9jaywge3dpdGhTcGFuOiBlbGVtZW50U291cmNlU3BhbiwgZmlsdGVyOiB0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb259KTtcbiAgICBpZiAobm9kZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc3ltYm9sRnJvbURlY2xhcmF0aW9uID0gdGhpcy5nZXRTeW1ib2xPZlRzTm9kZShub2RlKTtcbiAgICBpZiAoc3ltYm9sRnJvbURlY2xhcmF0aW9uID09PSBudWxsIHx8IHN5bWJvbEZyb21EZWNsYXJhdGlvbi50c1N5bWJvbCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGlyZWN0aXZlcyA9IHRoaXMuZ2V0RGlyZWN0aXZlc09mTm9kZShlbGVtZW50KTtcbiAgICAvLyBBbGwgc3RhdGVtZW50cyBpbiB0aGUgVENCIGFyZSBgRXhwcmVzc2lvbmBzIHRoYXQgb3B0aW9uYWxseSBpbmNsdWRlIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgLy8gQW4gYEVsZW1lbnRTeW1ib2xgIHVzZXMgdGhlIGluZm9ybWF0aW9uIHJldHVybmVkIGZvciB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gZXhwcmVzc2lvbixcbiAgICAvLyBhZGRzIHRoZSBkaXJlY3RpdmVzIGZvciB0aGUgZWxlbWVudCwgYW5kIHVwZGF0ZXMgdGhlIGBraW5kYCB0byBiZSBgU3ltYm9sS2luZC5FbGVtZW50YC5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uc3ltYm9sRnJvbURlY2xhcmF0aW9uLFxuICAgICAga2luZDogU3ltYm9sS2luZC5FbGVtZW50LFxuICAgICAgZGlyZWN0aXZlcyxcbiAgICAgIHRlbXBsYXRlTm9kZTogZWxlbWVudCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXREaXJlY3RpdmVzT2ZOb2RlKGVsZW1lbnQ6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSk6IERpcmVjdGl2ZVN5bWJvbFtdIHtcbiAgICBjb25zdCBlbGVtZW50U291cmNlU3BhbiA9IGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc291cmNlU3BhbjtcbiAgICBjb25zdCB0Y2JTb3VyY2VGaWxlID0gdGhpcy50eXBlQ2hlY2tCbG9jay5nZXRTb3VyY2VGaWxlKCk7XG4gICAgLy8gZGlyZWN0aXZlcyBjb3VsZCBiZSBlaXRoZXI6XG4gICAgLy8gLSB2YXIgX3QxOiBUZXN0RGlyIC8qVDpEKi8gPSAobnVsbCEpO1xuICAgIC8vIC0gdmFyIF90MSAvKlQ6RCovID0gX2N0b3IxKHt9KTtcbiAgICBjb25zdCBpc0RpcmVjdGl2ZURlY2xhcmF0aW9uID0gKG5vZGU6IHRzLk5vZGUpOiBub2RlIGlzIHRzLlR5cGVOb2RlfHRzLklkZW50aWZpZXIgPT5cbiAgICAgICAgKHRzLmlzVHlwZU5vZGUobm9kZSkgfHwgdHMuaXNJZGVudGlmaWVyKG5vZGUpKSAmJiB0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24obm9kZS5wYXJlbnQpICYmXG4gICAgICAgIGhhc0V4cHJlc3Npb25JZGVudGlmaWVyKHRjYlNvdXJjZUZpbGUsIG5vZGUsIEV4cHJlc3Npb25JZGVudGlmaWVyLkRJUkVDVElWRSk7XG5cbiAgICBjb25zdCBub2RlcyA9IGZpbmRBbGxNYXRjaGluZ05vZGVzKFxuICAgICAgICB0aGlzLnR5cGVDaGVja0Jsb2NrLCB7d2l0aFNwYW46IGVsZW1lbnRTb3VyY2VTcGFuLCBmaWx0ZXI6IGlzRGlyZWN0aXZlRGVjbGFyYXRpb259KTtcbiAgICByZXR1cm4gbm9kZXNcbiAgICAgICAgLm1hcChub2RlID0+IHtcbiAgICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmdldFN5bWJvbE9mVHNOb2RlKG5vZGUucGFyZW50KTtcbiAgICAgICAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8ICFpc1N5bWJvbFdpdGhWYWx1ZURlY2xhcmF0aW9uKHN5bWJvbC50c1N5bWJvbCkgfHxcbiAgICAgICAgICAgICAgIXRzLmlzQ2xhc3NEZWNsYXJhdGlvbihzeW1ib2wudHNTeW1ib2wudmFsdWVEZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBtZXRhID0gdGhpcy5nZXREaXJlY3RpdmVNZXRhKGVsZW1lbnQsIHN5bWJvbC50c1N5bWJvbC52YWx1ZURlY2xhcmF0aW9uKTtcbiAgICAgICAgICBpZiAobWV0YSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgbmdNb2R1bGUgPSB0aGlzLmdldERpcmVjdGl2ZU1vZHVsZShzeW1ib2wudHNTeW1ib2wudmFsdWVEZWNsYXJhdGlvbik7XG4gICAgICAgICAgaWYgKG1ldGEuc2VsZWN0b3IgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBpc0NvbXBvbmVudCA9IG1ldGEuaXNDb21wb25lbnQgPz8gbnVsbDtcbiAgICAgICAgICBjb25zdCBkaXJlY3RpdmVTeW1ib2w6IERpcmVjdGl2ZVN5bWJvbCA9IHtcbiAgICAgICAgICAgIC4uLnN5bWJvbCxcbiAgICAgICAgICAgIHRzU3ltYm9sOiBzeW1ib2wudHNTeW1ib2wsXG4gICAgICAgICAgICBzZWxlY3RvcjogbWV0YS5zZWxlY3RvcixcbiAgICAgICAgICAgIGlzQ29tcG9uZW50LFxuICAgICAgICAgICAgbmdNb2R1bGUsXG4gICAgICAgICAgICBraW5kOiBTeW1ib2xLaW5kLkRpcmVjdGl2ZSxcbiAgICAgICAgICAgIGlzU3RydWN0dXJhbDogbWV0YS5pc1N0cnVjdHVyYWwsXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gZGlyZWN0aXZlU3ltYm9sO1xuICAgICAgICB9KVxuICAgICAgICAuZmlsdGVyKChkKTogZCBpcyBEaXJlY3RpdmVTeW1ib2wgPT4gZCAhPT0gbnVsbCk7XG4gIH1cblxuICBwcml2YXRlIGdldERpcmVjdGl2ZU1ldGEoXG4gICAgICBob3N0OiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgICBkaXJlY3RpdmVEZWNsYXJhdGlvbjogdHMuRGVjbGFyYXRpb24pOiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YXxudWxsIHtcbiAgICBjb25zdCBkaXJlY3RpdmVzID0gdGhpcy50ZW1wbGF0ZURhdGEuYm91bmRUYXJnZXQuZ2V0RGlyZWN0aXZlc09mTm9kZShob3N0KTtcbiAgICBpZiAoZGlyZWN0aXZlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcmVjdGl2ZXMuZmluZChtID0+IG0ucmVmLm5vZGUgPT09IGRpcmVjdGl2ZURlY2xhcmF0aW9uKSA/PyBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXREaXJlY3RpdmVNb2R1bGUoZGVjbGFyYXRpb246IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBDbGFzc0RlY2xhcmF0aW9ufG51bGwge1xuICAgIGNvbnN0IHNjb3BlID0gdGhpcy5jb21wb25lbnRTY29wZVJlYWRlci5nZXRTY29wZUZvckNvbXBvbmVudChkZWNsYXJhdGlvbiBhcyBDbGFzc0RlY2xhcmF0aW9uKTtcbiAgICBpZiAoc2NvcGUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gc2NvcGUubmdNb2R1bGU7XG4gIH1cblxuICBwcml2YXRlIGdldFN5bWJvbE9mQm91bmRFdmVudChldmVudEJpbmRpbmc6IFRtcGxBc3RCb3VuZEV2ZW50KTogT3V0cHV0QmluZGluZ1N5bWJvbHxudWxsIHtcbiAgICBjb25zdCBjb25zdW1lciA9IHRoaXMudGVtcGxhdGVEYXRhLmJvdW5kVGFyZ2V0LmdldENvbnN1bWVyT2ZCaW5kaW5nKGV2ZW50QmluZGluZyk7XG4gICAgaWYgKGNvbnN1bWVyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBPdXRwdXRzIGluIHRoZSBUQ0IgbG9vayBsaWtlIG9uZSBvZiB0aGUgdHdvOlxuICAgIC8vICogX3QxW1wib3V0cHV0RmllbGRcIl0uc3Vic2NyaWJlKGhhbmRsZXIpO1xuICAgIC8vICogX3QxLmFkZEV2ZW50TGlzdGVuZXIoaGFuZGxlcik7XG4gICAgLy8gRXZlbiB3aXRoIHN0cmljdCBudWxsIGNoZWNrcyBkaXNhYmxlZCwgd2Ugc3RpbGwgcHJvZHVjZSB0aGUgYWNjZXNzIGFzIGEgc2VwYXJhdGUgc3RhdGVtZW50XG4gICAgLy8gc28gdGhhdCBpdCBjYW4gYmUgZm91bmQgaGVyZS5cbiAgICBsZXQgZXhwZWN0ZWRBY2Nlc3M6IHN0cmluZztcbiAgICBpZiAoY29uc3VtZXIgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUgfHwgY29uc3VtZXIgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCkge1xuICAgICAgZXhwZWN0ZWRBY2Nlc3MgPSAnYWRkRXZlbnRMaXN0ZW5lcic7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGJpbmRpbmdQcm9wZXJ0eU5hbWVzID0gY29uc3VtZXIub3V0cHV0cy5nZXRCeUJpbmRpbmdQcm9wZXJ0eU5hbWUoZXZlbnRCaW5kaW5nLm5hbWUpO1xuICAgICAgaWYgKGJpbmRpbmdQcm9wZXJ0eU5hbWVzID09PSBudWxsIHx8IGJpbmRpbmdQcm9wZXJ0eU5hbWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBvbmx5IGdldCB0aGUgZXhwZWN0ZWRBY2Nlc3MgdGV4dCBmcm9tIGEgc2luZ2xlIGNvbnN1bWVyIG9mIHRoZSBiaW5kaW5nLiBJZlxuICAgICAgLy8gdGhlcmUgYXJlIG11bHRpcGxlIGNvbnN1bWVycyAobm90IHN1cHBvcnRlZCBpbiB0aGUgYGJvdW5kVGFyZ2V0YCBBUEkpIGFuZCBvbmUgb2YgdGhlbSBoYXNcbiAgICAgIC8vIGFuIGFsaWFzLCBpdCB3aWxsIG5vdCBnZXQgbWF0Y2hlZCBoZXJlLlxuICAgICAgZXhwZWN0ZWRBY2Nlc3MgPSBiaW5kaW5nUHJvcGVydHlOYW1lc1swXS5jbGFzc1Byb3BlcnR5TmFtZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaWx0ZXIobjogdHMuTm9kZSk6IG4gaXMgdHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9ufHRzLkVsZW1lbnRBY2Nlc3NFeHByZXNzaW9uIHtcbiAgICAgIGlmICghaXNBY2Nlc3NFeHByZXNzaW9uKG4pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG4pKSB7XG4gICAgICAgIHJldHVybiBuLm5hbWUuZ2V0VGV4dCgpID09PSBleHBlY3RlZEFjY2VzcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cy5pc1N0cmluZ0xpdGVyYWwobi5hcmd1bWVudEV4cHJlc3Npb24pICYmXG4gICAgICAgICAgICBuLmFyZ3VtZW50RXhwcmVzc2lvbi50ZXh0ID09PSBleHBlY3RlZEFjY2VzcztcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgb3V0cHV0RmllbGRBY2Nlc3NlcyA9XG4gICAgICAgIGZpbmRBbGxNYXRjaGluZ05vZGVzKHRoaXMudHlwZUNoZWNrQmxvY2ssIHt3aXRoU3BhbjogZXZlbnRCaW5kaW5nLmtleVNwYW4sIGZpbHRlcn0pO1xuXG4gICAgY29uc3QgYmluZGluZ3M6IEJpbmRpbmdTeW1ib2xbXSA9IFtdO1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmllbGRBY2Nlc3Mgb2Ygb3V0cHV0RmllbGRBY2Nlc3Nlcykge1xuICAgICAgaWYgKGNvbnN1bWVyIGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlIHx8IGNvbnN1bWVyIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgICAgaWYgKCF0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihvdXRwdXRGaWVsZEFjY2VzcykpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFkZEV2ZW50TGlzdGVuZXIgPSBvdXRwdXRGaWVsZEFjY2Vzcy5uYW1lO1xuICAgICAgICBjb25zdCB0c1N5bWJvbCA9IHRoaXMuZ2V0VHlwZUNoZWNrZXIoKS5nZXRTeW1ib2xBdExvY2F0aW9uKGFkZEV2ZW50TGlzdGVuZXIpO1xuICAgICAgICBjb25zdCB0c1R5cGUgPSB0aGlzLmdldFR5cGVDaGVja2VyKCkuZ2V0VHlwZUF0TG9jYXRpb24oYWRkRXZlbnRMaXN0ZW5lcik7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uSW5TaGltRmlsZSA9IHRoaXMuZ2V0U2hpbVBvc2l0aW9uRm9yTm9kZShhZGRFdmVudExpc3RlbmVyKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5nZXRTeW1ib2woY29uc3VtZXIpO1xuXG4gICAgICAgIGlmICh0YXJnZXQgPT09IG51bGwgfHwgdHNTeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgYmluZGluZ3MucHVzaCh7XG4gICAgICAgICAga2luZDogU3ltYm9sS2luZC5CaW5kaW5nLFxuICAgICAgICAgIHRzU3ltYm9sLFxuICAgICAgICAgIHRzVHlwZSxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgc2hpbUxvY2F0aW9uOiB7c2hpbVBhdGg6IHRoaXMuc2hpbVBhdGgsIHBvc2l0aW9uSW5TaGltRmlsZX0sXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCF0cy5pc0VsZW1lbnRBY2Nlc3NFeHByZXNzaW9uKG91dHB1dEZpZWxkQWNjZXNzKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRzU3ltYm9sID1cbiAgICAgICAgICAgIHRoaXMuZ2V0VHlwZUNoZWNrZXIoKS5nZXRTeW1ib2xBdExvY2F0aW9uKG91dHB1dEZpZWxkQWNjZXNzLmFyZ3VtZW50RXhwcmVzc2lvbik7XG4gICAgICAgIGlmICh0c1N5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZ2V0RGlyZWN0aXZlU3ltYm9sRm9yQWNjZXNzRXhwcmVzc2lvbihvdXRwdXRGaWVsZEFjY2VzcywgY29uc3VtZXIpO1xuICAgICAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwb3NpdGlvbkluU2hpbUZpbGUgPSB0aGlzLmdldFNoaW1Qb3NpdGlvbkZvck5vZGUob3V0cHV0RmllbGRBY2Nlc3MpO1xuICAgICAgICBjb25zdCB0c1R5cGUgPSB0aGlzLmdldFR5cGVDaGVja2VyKCkuZ2V0VHlwZUF0TG9jYXRpb24ob3V0cHV0RmllbGRBY2Nlc3MpO1xuICAgICAgICBiaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICBraW5kOiBTeW1ib2xLaW5kLkJpbmRpbmcsXG4gICAgICAgICAgdHNTeW1ib2wsXG4gICAgICAgICAgdHNUeXBlLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBzaGltTG9jYXRpb246IHtzaGltUGF0aDogdGhpcy5zaGltUGF0aCwgcG9zaXRpb25JblNoaW1GaWxlfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7a2luZDogU3ltYm9sS2luZC5PdXRwdXQsIGJpbmRpbmdzfTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0U3ltYm9sT2ZJbnB1dEJpbmRpbmcoYmluZGluZzogVG1wbEFzdEJvdW5kQXR0cmlidXRlfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRtcGxBc3RUZXh0QXR0cmlidXRlKTogSW5wdXRCaW5kaW5nU3ltYm9sfERvbUJpbmRpbmdTeW1ib2x8bnVsbCB7XG4gICAgY29uc3QgY29uc3VtZXIgPSB0aGlzLnRlbXBsYXRlRGF0YS5ib3VuZFRhcmdldC5nZXRDb25zdW1lck9mQmluZGluZyhiaW5kaW5nKTtcbiAgICBpZiAoY29uc3VtZXIgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChjb25zdW1lciBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50IHx8IGNvbnN1bWVyIGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlKSB7XG4gICAgICBjb25zdCBob3N0ID0gdGhpcy5nZXRTeW1ib2woY29uc3VtZXIpO1xuICAgICAgcmV0dXJuIGhvc3QgIT09IG51bGwgPyB7a2luZDogU3ltYm9sS2luZC5Eb21CaW5kaW5nLCBob3N0fSA6IG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBmaW5kQWxsTWF0Y2hpbmdOb2RlcyhcbiAgICAgICAgdGhpcy50eXBlQ2hlY2tCbG9jaywge3dpdGhTcGFuOiBiaW5kaW5nLnNvdXJjZVNwYW4sIGZpbHRlcjogaXNBc3NpZ25tZW50fSk7XG4gICAgY29uc3QgYmluZGluZ3M6IEJpbmRpbmdTeW1ib2xbXSA9IFtdO1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuICAgICAgaWYgKCFpc0FjY2Vzc0V4cHJlc3Npb24obm9kZS5sZWZ0KSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3ltYm9sSW5mbyA9IHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUobm9kZS5sZWZ0KTtcbiAgICAgIGlmIChzeW1ib2xJbmZvID09PSBudWxsIHx8IHN5bWJvbEluZm8udHNTeW1ib2wgPT09IG51bGwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZ2V0RGlyZWN0aXZlU3ltYm9sRm9yQWNjZXNzRXhwcmVzc2lvbihub2RlLmxlZnQsIGNvbnN1bWVyKTtcbiAgICAgIGlmICh0YXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBiaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgLi4uc3ltYm9sSW5mbyxcbiAgICAgICAgdHNTeW1ib2w6IHN5bWJvbEluZm8udHNTeW1ib2wsXG4gICAgICAgIGtpbmQ6IFN5bWJvbEtpbmQuQmluZGluZyxcbiAgICAgICAgdGFyZ2V0LFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChiaW5kaW5ncy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7a2luZDogU3ltYm9sS2luZC5JbnB1dCwgYmluZGluZ3N9O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXREaXJlY3RpdmVTeW1ib2xGb3JBY2Nlc3NFeHByZXNzaW9uKFxuICAgICAgbm9kZTogdHMuRWxlbWVudEFjY2Vzc0V4cHJlc3Npb258dHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uLFxuICAgICAge2lzQ29tcG9uZW50LCBzZWxlY3RvciwgaXNTdHJ1Y3R1cmFsfTogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpOiBEaXJlY3RpdmVTeW1ib2x8bnVsbCB7XG4gICAgLy8gSW4gZWl0aGVyIGNhc2UsIGBfdDFbXCJpbmRleFwiXWAgb3IgYF90MS5pbmRleGAsIGBub2RlLmV4cHJlc3Npb25gIGlzIF90MS5cbiAgICAvLyBUaGUgcmV0cmlldmVkIHN5bWJvbCBmb3IgX3QxIHdpbGwgYmUgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgIGNvbnN0IHRzU3ltYm9sID0gdGhpcy5nZXRUeXBlQ2hlY2tlcigpLmdldFN5bWJvbEF0TG9jYXRpb24obm9kZS5leHByZXNzaW9uKTtcbiAgICBpZiAodHNTeW1ib2w/LmRlY2xhcmF0aW9ucyA9PT0gdW5kZWZpbmVkIHx8IHRzU3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgc2VsZWN0b3IgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IFtkZWNsYXJhdGlvbl0gPSB0c1N5bWJvbC5kZWNsYXJhdGlvbnM7XG4gICAgaWYgKCF0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pIHx8XG4gICAgICAgICFoYXNFeHByZXNzaW9uSWRlbnRpZmllcihcbiAgICAgICAgICAgIC8vIFRoZSBleHByZXNzaW9uIGlkZW50aWZpZXIgY291bGQgYmUgb24gdGhlIHR5cGUgKGZvciByZWd1bGFyIGRpcmVjdGl2ZXMpIG9yIHRoZSBuYW1lXG4gICAgICAgICAgICAvLyAoZm9yIGdlbmVyaWMgZGlyZWN0aXZlcyBhbmQgdGhlIGN0b3Igb3ApLlxuICAgICAgICAgICAgZGVjbGFyYXRpb24uZ2V0U291cmNlRmlsZSgpLCBkZWNsYXJhdGlvbi50eXBlID8/IGRlY2xhcmF0aW9uLm5hbWUsXG4gICAgICAgICAgICBFeHByZXNzaW9uSWRlbnRpZmllci5ESVJFQ1RJVkUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmdldFN5bWJvbE9mVHNOb2RlKGRlY2xhcmF0aW9uKTtcbiAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8ICFpc1N5bWJvbFdpdGhWYWx1ZURlY2xhcmF0aW9uKHN5bWJvbC50c1N5bWJvbCkgfHxcbiAgICAgICAgIXRzLmlzQ2xhc3NEZWNsYXJhdGlvbihzeW1ib2wudHNTeW1ib2wudmFsdWVEZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG5nTW9kdWxlID0gdGhpcy5nZXREaXJlY3RpdmVNb2R1bGUoc3ltYm9sLnRzU3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiBTeW1ib2xLaW5kLkRpcmVjdGl2ZSxcbiAgICAgIHRzU3ltYm9sOiBzeW1ib2wudHNTeW1ib2wsXG4gICAgICB0c1R5cGU6IHN5bWJvbC50c1R5cGUsXG4gICAgICBzaGltTG9jYXRpb246IHN5bWJvbC5zaGltTG9jYXRpb24sXG4gICAgICBpc0NvbXBvbmVudCxcbiAgICAgIGlzU3RydWN0dXJhbCxcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbmdNb2R1bGUsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0U3ltYm9sT2ZWYXJpYWJsZSh2YXJpYWJsZTogVG1wbEFzdFZhcmlhYmxlKTogVmFyaWFibGVTeW1ib2x8bnVsbCB7XG4gICAgY29uc3Qgbm9kZSA9IGZpbmRGaXJzdE1hdGNoaW5nTm9kZShcbiAgICAgICAgdGhpcy50eXBlQ2hlY2tCbG9jaywge3dpdGhTcGFuOiB2YXJpYWJsZS5zb3VyY2VTcGFuLCBmaWx0ZXI6IHRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbn0pO1xuICAgIGlmIChub2RlID09PSBudWxsIHx8IG5vZGUuaW5pdGlhbGl6ZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvblN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUobm9kZS5pbml0aWFsaXplcik7XG4gICAgaWYgKGV4cHJlc3Npb25TeW1ib2wgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB0c1R5cGU6IGV4cHJlc3Npb25TeW1ib2wudHNUeXBlLFxuICAgICAgdHNTeW1ib2w6IGV4cHJlc3Npb25TeW1ib2wudHNTeW1ib2wsXG4gICAgICBpbml0aWFsaXplckxvY2F0aW9uOiBleHByZXNzaW9uU3ltYm9sLnNoaW1Mb2NhdGlvbixcbiAgICAgIGtpbmQ6IFN5bWJvbEtpbmQuVmFyaWFibGUsXG4gICAgICBkZWNsYXJhdGlvbjogdmFyaWFibGUsXG4gICAgICBsb2NhbFZhckxvY2F0aW9uOiB7XG4gICAgICAgIHNoaW1QYXRoOiB0aGlzLnNoaW1QYXRoLFxuICAgICAgICBwb3NpdGlvbkluU2hpbUZpbGU6IHRoaXMuZ2V0U2hpbVBvc2l0aW9uRm9yTm9kZShub2RlLm5hbWUpLFxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGdldFN5bWJvbE9mUmVmZXJlbmNlKHJlZjogVG1wbEFzdFJlZmVyZW5jZSk6IFJlZmVyZW5jZVN5bWJvbHxudWxsIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRlbXBsYXRlRGF0YS5ib3VuZFRhcmdldC5nZXRSZWZlcmVuY2VUYXJnZXQocmVmKTtcbiAgICAvLyBGaW5kIHRoZSBub2RlIGZvciB0aGUgcmVmZXJlbmNlIGRlY2xhcmF0aW9uLCBpLmUuIGB2YXIgX3QyID0gX3QxO2BcbiAgICBsZXQgbm9kZSA9IGZpbmRGaXJzdE1hdGNoaW5nTm9kZShcbiAgICAgICAgdGhpcy50eXBlQ2hlY2tCbG9jaywge3dpdGhTcGFuOiByZWYuc291cmNlU3BhbiwgZmlsdGVyOiB0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb259KTtcbiAgICBpZiAobm9kZSA9PT0gbnVsbCB8fCB0YXJnZXQgPT09IG51bGwgfHwgbm9kZS5pbml0aWFsaXplciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIG9yaWdpbmFsIGRlY2xhcmF0aW9uIGZvciB0aGUgcmVmZXJlbmNlcyB2YXJpYWJsZSwgd2l0aCB0aGUgZXhjZXB0aW9uIG9mIHRlbXBsYXRlIHJlZnNcbiAgICAvLyB3aGljaCBhcmUgb2YgdGhlIGZvcm0gdmFyIF90MyA9IChfdDIgYXMgYW55IGFzIGkyLlRlbXBsYXRlUmVmPGFueT4pXG4gICAgLy8gVE9ETyhhdHNjb3R0KTogQ29uc2lkZXIgYWRkaW5nIGFuIGBFeHByZXNzaW9uSWRlbnRpZmllcmAgdG8gdGFnIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4gICAgLy8gaW5pdGlhbGl6ZXJzIGFzIGludmFsaWQgZm9yIHN5bWJvbCByZXRyaWV2YWwuXG4gICAgY29uc3Qgb3JpZ2luYWxEZWNsYXJhdGlvbiA9IHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24obm9kZS5pbml0aWFsaXplcikgJiZcbiAgICAgICAgICAgIHRzLmlzQXNFeHByZXNzaW9uKG5vZGUuaW5pdGlhbGl6ZXIuZXhwcmVzc2lvbikgP1xuICAgICAgICB0aGlzLmdldFR5cGVDaGVja2VyKCkuZ2V0U3ltYm9sQXRMb2NhdGlvbihub2RlLm5hbWUpIDpcbiAgICAgICAgdGhpcy5nZXRUeXBlQ2hlY2tlcigpLmdldFN5bWJvbEF0TG9jYXRpb24obm9kZS5pbml0aWFsaXplcik7XG4gICAgaWYgKG9yaWdpbmFsRGVjbGFyYXRpb24gPT09IHVuZGVmaW5lZCB8fCBvcmlnaW5hbERlY2xhcmF0aW9uLnZhbHVlRGVjbGFyYXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUob3JpZ2luYWxEZWNsYXJhdGlvbi52YWx1ZURlY2xhcmF0aW9uKTtcbiAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8IHN5bWJvbC50c1N5bWJvbCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmZXJlbmNlVmFyU2hpbUxvY2F0aW9uOiBTaGltTG9jYXRpb24gPSB7XG4gICAgICBzaGltUGF0aDogdGhpcy5zaGltUGF0aCxcbiAgICAgIHBvc2l0aW9uSW5TaGltRmlsZTogdGhpcy5nZXRTaGltUG9zaXRpb25Gb3JOb2RlKG5vZGUpLFxuICAgIH07XG4gICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSB8fCB0YXJnZXQgaW5zdGFuY2VvZiBUbXBsQXN0RWxlbWVudCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogU3ltYm9sS2luZC5SZWZlcmVuY2UsXG4gICAgICAgIHRzU3ltYm9sOiBzeW1ib2wudHNTeW1ib2wsXG4gICAgICAgIHRzVHlwZTogc3ltYm9sLnRzVHlwZSxcbiAgICAgICAgdGFyZ2V0LFxuICAgICAgICBkZWNsYXJhdGlvbjogcmVmLFxuICAgICAgICB0YXJnZXRMb2NhdGlvbjogc3ltYm9sLnNoaW1Mb2NhdGlvbixcbiAgICAgICAgcmVmZXJlbmNlVmFyTG9jYXRpb246IHJlZmVyZW5jZVZhclNoaW1Mb2NhdGlvbixcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdHMuaXNDbGFzc0RlY2xhcmF0aW9uKHRhcmdldC5kaXJlY3RpdmUucmVmLm5vZGUpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiBTeW1ib2xLaW5kLlJlZmVyZW5jZSxcbiAgICAgICAgdHNTeW1ib2w6IHN5bWJvbC50c1N5bWJvbCxcbiAgICAgICAgdHNUeXBlOiBzeW1ib2wudHNUeXBlLFxuICAgICAgICBkZWNsYXJhdGlvbjogcmVmLFxuICAgICAgICB0YXJnZXQ6IHRhcmdldC5kaXJlY3RpdmUucmVmLm5vZGUsXG4gICAgICAgIHRhcmdldExvY2F0aW9uOiBzeW1ib2wuc2hpbUxvY2F0aW9uLFxuICAgICAgICByZWZlcmVuY2VWYXJMb2NhdGlvbjogcmVmZXJlbmNlVmFyU2hpbUxvY2F0aW9uLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldFN5bWJvbE9mUGlwZShleHByZXNzaW9uOiBCaW5kaW5nUGlwZSk6IFBpcGVTeW1ib2x8bnVsbCB7XG4gICAgY29uc3QgbWV0aG9kQWNjZXNzID0gZmluZEZpcnN0TWF0Y2hpbmdOb2RlKFxuICAgICAgICB0aGlzLnR5cGVDaGVja0Jsb2NrLFxuICAgICAgICB7d2l0aFNwYW46IGV4cHJlc3Npb24ubmFtZVNwYW4sIGZpbHRlcjogdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb259KTtcbiAgICBpZiAobWV0aG9kQWNjZXNzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBwaXBlVmFyaWFibGVOb2RlID0gbWV0aG9kQWNjZXNzLmV4cHJlc3Npb247XG4gICAgY29uc3QgcGlwZURlY2xhcmF0aW9uID0gdGhpcy5nZXRUeXBlQ2hlY2tlcigpLmdldFN5bWJvbEF0TG9jYXRpb24ocGlwZVZhcmlhYmxlTm9kZSk7XG4gICAgaWYgKHBpcGVEZWNsYXJhdGlvbiA9PT0gdW5kZWZpbmVkIHx8IHBpcGVEZWNsYXJhdGlvbi52YWx1ZURlY2xhcmF0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHBpcGVJbnN0YW5jZSA9IHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUocGlwZURlY2xhcmF0aW9uLnZhbHVlRGVjbGFyYXRpb24pO1xuICAgIC8vIFRoZSBpbnN0YW5jZSBzaG91bGQgbmV2ZXIgYmUgbnVsbCwgbm9yIHNob3VsZCB0aGUgc3ltYm9sIGxhY2sgYSB2YWx1ZSBkZWNsYXJhdGlvbi4gVGhpc1xuICAgIC8vIGlzIGJlY2F1c2UgdGhlIG5vZGUgdXNlZCB0byBsb29rIGZvciB0aGUgYHBpcGVJbnN0YW5jZWAgc3ltYm9sIGluZm8gaXMgYSB2YWx1ZVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mIGFub3RoZXIgc3ltYm9sIChpLmUuIHRoZSBgcGlwZURlY2xhcmF0aW9uYCBzeW1ib2wpLlxuICAgIGlmIChwaXBlSW5zdGFuY2UgPT09IG51bGwgfHwgIWlzU3ltYm9sV2l0aFZhbHVlRGVjbGFyYXRpb24ocGlwZUluc3RhbmNlLnRzU3ltYm9sKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc3ltYm9sSW5mbyA9IHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUobWV0aG9kQWNjZXNzKTtcbiAgICBpZiAoc3ltYm9sSW5mbyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6IFN5bWJvbEtpbmQuUGlwZSxcbiAgICAgIC4uLnN5bWJvbEluZm8sXG4gICAgICBjbGFzc1N5bWJvbDoge1xuICAgICAgICAuLi5waXBlSW5zdGFuY2UsXG4gICAgICAgIHRzU3ltYm9sOiBwaXBlSW5zdGFuY2UudHNTeW1ib2wsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGdldFN5bWJvbE9mVGVtcGxhdGVFeHByZXNzaW9uKGV4cHJlc3Npb246IEFTVCk6IFZhcmlhYmxlU3ltYm9sfFJlZmVyZW5jZVN5bWJvbFxuICAgICAgfEV4cHJlc3Npb25TeW1ib2x8bnVsbCB7XG4gICAgaWYgKGV4cHJlc3Npb24gaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlKSB7XG4gICAgICBleHByZXNzaW9uID0gZXhwcmVzc2lvbi5hc3Q7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvblRhcmdldCA9IHRoaXMudGVtcGxhdGVEYXRhLmJvdW5kVGFyZ2V0LmdldEV4cHJlc3Npb25UYXJnZXQoZXhwcmVzc2lvbik7XG4gICAgaWYgKGV4cHJlc3Npb25UYXJnZXQgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFN5bWJvbChleHByZXNzaW9uVGFyZ2V0KTtcbiAgICB9XG5cbiAgICAvLyBUaGUgYG5hbWVgIHBhcnQgb2YgYSBgUHJvcGVydHlXcml0ZWAgYW5kIGBNZXRob2RDYWxsYCBkb2VzIG5vdCBoYXZlIGl0cyBvd25cbiAgICAvLyBBU1Qgc28gdGhlcmUgaXMgbm8gd2F5IHRvIHJldHJpZXZlIGEgYFN5bWJvbGAgZm9yIGp1c3QgdGhlIGBuYW1lYCB2aWEgYSBzcGVjaWZpYyBub2RlLlxuICAgIGNvbnN0IHdpdGhTcGFuID0gKGV4cHJlc3Npb24gaW5zdGFuY2VvZiBQcm9wZXJ0eVdyaXRlIHx8IGV4cHJlc3Npb24gaW5zdGFuY2VvZiBNZXRob2RDYWxsKSA/XG4gICAgICAgIGV4cHJlc3Npb24ubmFtZVNwYW4gOlxuICAgICAgICBleHByZXNzaW9uLnNvdXJjZVNwYW47XG5cbiAgICBsZXQgbm9kZTogdHMuTm9kZXxudWxsID0gbnVsbDtcblxuICAgIC8vIFByb3BlcnR5IHJlYWRzIGluIHRlbXBsYXRlcyB1c3VhbGx5IG1hcCB0byBhIGBQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb25gXG4gICAgLy8gKGUuZy4gYGN0eC5mb29gKSBzbyB0cnkgbG9va2luZyBmb3Igb25lIGZpcnN0LlxuICAgIGlmIChleHByZXNzaW9uIGluc3RhbmNlb2YgUHJvcGVydHlSZWFkKSB7XG4gICAgICBub2RlID0gZmluZEZpcnN0TWF0Y2hpbmdOb2RlKFxuICAgICAgICAgIHRoaXMudHlwZUNoZWNrQmxvY2ssIHt3aXRoU3BhbiwgZmlsdGVyOiB0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbn0pO1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSBmYWxsIGJhY2sgdG8gc2VhcmNoaW5nIGZvciBhbnkgQVNUIG5vZGUuXG4gICAgaWYgKG5vZGUgPT09IG51bGwpIHtcbiAgICAgIG5vZGUgPSBmaW5kRmlyc3RNYXRjaGluZ05vZGUodGhpcy50eXBlQ2hlY2tCbG9jaywge3dpdGhTcGFuLCBmaWx0ZXI6IGFueU5vZGVGaWx0ZXJ9KTtcbiAgICB9XG5cbiAgICBpZiAobm9kZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgd2hpbGUgKHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIG5vZGUgPSBub2RlLmV4cHJlc3Npb247XG4gICAgfVxuXG4gICAgLy8gLSBJZiB3ZSBoYXZlIHNhZmUgcHJvcGVydHkgcmVhZCAoXCJhPy5iXCIpIHdlIHdhbnQgdG8gZ2V0IHRoZSBTeW1ib2wgZm9yIGIsIHRoZSBgd2hlblRydWVgXG4gICAgLy8gZXhwcmVzc2lvbi5cbiAgICAvLyAtIElmIG91ciBleHByZXNzaW9uIGlzIGEgcGlwZSBiaW5kaW5nIChcImEgfCB0ZXN0OmI6Y1wiKSwgd2Ugd2FudCB0aGUgU3ltYm9sIGZvciB0aGVcbiAgICAvLyBgdHJhbnNmb3JtYCBvbiB0aGUgcGlwZS5cbiAgICAvLyAtIE90aGVyd2lzZSwgd2UgcmV0cmlldmUgdGhlIHN5bWJvbCBmb3IgdGhlIG5vZGUgaXRzZWxmIHdpdGggbm8gc3BlY2lhbCBjb25zaWRlcmF0aW9uc1xuICAgIGlmICgoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIFNhZmVQcm9wZXJ0eVJlYWQgfHwgZXhwcmVzc2lvbiBpbnN0YW5jZW9mIFNhZmVNZXRob2RDYWxsKSAmJlxuICAgICAgICB0cy5pc0NvbmRpdGlvbmFsRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgY29uc3Qgd2hlblRydWVTeW1ib2wgPVxuICAgICAgICAgIChleHByZXNzaW9uIGluc3RhbmNlb2YgU2FmZU1ldGhvZENhbGwgJiYgdHMuaXNDYWxsRXhwcmVzc2lvbihub2RlLndoZW5UcnVlKSkgP1xuICAgICAgICAgIHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUobm9kZS53aGVuVHJ1ZS5leHByZXNzaW9uKSA6XG4gICAgICAgICAgdGhpcy5nZXRTeW1ib2xPZlRzTm9kZShub2RlLndoZW5UcnVlKTtcbiAgICAgIGlmICh3aGVuVHJ1ZVN5bWJvbCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ud2hlblRydWVTeW1ib2wsXG4gICAgICAgIGtpbmQ6IFN5bWJvbEtpbmQuRXhwcmVzc2lvbixcbiAgICAgICAgLy8gUmF0aGVyIHRoYW4gdXNpbmcgdGhlIHR5cGUgb2Ygb25seSB0aGUgYHdoZW5UcnVlYCBwYXJ0IG9mIHRoZSBleHByZXNzaW9uLCB3ZSBzaG91bGRcbiAgICAgICAgLy8gc3RpbGwgZ2V0IHRoZSB0eXBlIG9mIHRoZSB3aG9sZSBjb25kaXRpb25hbCBleHByZXNzaW9uIHRvIGluY2x1ZGUgYHx1bmRlZmluZWRgLlxuICAgICAgICB0c1R5cGU6IHRoaXMuZ2V0VHlwZUNoZWNrZXIoKS5nZXRUeXBlQXRMb2NhdGlvbihub2RlKVxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc3ltYm9sSW5mbyA9IHRoaXMuZ2V0U3ltYm9sT2ZUc05vZGUobm9kZSk7XG4gICAgICByZXR1cm4gc3ltYm9sSW5mbyA9PT0gbnVsbCA/IG51bGwgOiB7Li4uc3ltYm9sSW5mbywga2luZDogU3ltYm9sS2luZC5FeHByZXNzaW9ufTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldFN5bWJvbE9mVHNOb2RlKG5vZGU6IHRzLk5vZGUpOiBUc05vZGVTeW1ib2xJbmZvfG51bGwge1xuICAgIHdoaWxlICh0cy5pc1BhcmVudGhlc2l6ZWRFeHByZXNzaW9uKG5vZGUpKSB7XG4gICAgICBub2RlID0gbm9kZS5leHByZXNzaW9uO1xuICAgIH1cblxuICAgIGxldCB0c1N5bWJvbDogdHMuU3ltYm9sfHVuZGVmaW5lZDtcbiAgICBpZiAodHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHRzU3ltYm9sID0gdGhpcy5nZXRUeXBlQ2hlY2tlcigpLmdldFN5bWJvbEF0TG9jYXRpb24obm9kZS5uYW1lKTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzRWxlbWVudEFjY2Vzc0V4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHRzU3ltYm9sID0gdGhpcy5nZXRUeXBlQ2hlY2tlcigpLmdldFN5bWJvbEF0TG9jYXRpb24obm9kZS5hcmd1bWVudEV4cHJlc3Npb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0c1N5bWJvbCA9IHRoaXMuZ2V0VHlwZUNoZWNrZXIoKS5nZXRTeW1ib2xBdExvY2F0aW9uKG5vZGUpO1xuICAgIH1cblxuICAgIGNvbnN0IHBvc2l0aW9uSW5TaGltRmlsZSA9IHRoaXMuZ2V0U2hpbVBvc2l0aW9uRm9yTm9kZShub2RlKTtcbiAgICBjb25zdCB0eXBlID0gdGhpcy5nZXRUeXBlQ2hlY2tlcigpLmdldFR5cGVBdExvY2F0aW9uKG5vZGUpO1xuICAgIHJldHVybiB7XG4gICAgICAvLyBJZiB3ZSBjb3VsZCBub3QgZmluZCBhIHN5bWJvbCwgZmFsbCBiYWNrIHRvIHRoZSBzeW1ib2wgb24gdGhlIHR5cGUgZm9yIHRoZSBub2RlLlxuICAgICAgLy8gU29tZSBub2RlcyB3b24ndCBoYXZlIGEgXCJzeW1ib2wgYXQgbG9jYXRpb25cIiBidXQgd2lsbCBoYXZlIGEgc3ltYm9sIGZvciB0aGUgdHlwZS5cbiAgICAgIC8vIEV4YW1wbGVzIG9mIHRoaXMgd291bGQgYmUgbGl0ZXJhbHMgYW5kIGBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKWAuXG4gICAgICB0c1N5bWJvbDogdHNTeW1ib2wgPz8gdHlwZS5zeW1ib2wgPz8gbnVsbCxcbiAgICAgIHRzVHlwZTogdHlwZSxcbiAgICAgIHNoaW1Mb2NhdGlvbjoge3NoaW1QYXRoOiB0aGlzLnNoaW1QYXRoLCBwb3NpdGlvbkluU2hpbUZpbGV9LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGdldFNoaW1Qb3NpdGlvbkZvck5vZGUobm9kZTogdHMuTm9kZSk6IG51bWJlciB7XG4gICAgaWYgKHRzLmlzVHlwZVJlZmVyZW5jZU5vZGUobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFNoaW1Qb3NpdGlvbkZvck5vZGUobm9kZS50eXBlTmFtZSk7XG4gICAgfSBlbHNlIGlmICh0cy5pc1F1YWxpZmllZE5hbWUobm9kZSkpIHtcbiAgICAgIHJldHVybiBub2RlLnJpZ2h0LmdldFN0YXJ0KCk7XG4gICAgfSBlbHNlIGlmICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgcmV0dXJuIG5vZGUubmFtZS5nZXRTdGFydCgpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNFbGVtZW50QWNjZXNzRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgcmV0dXJuIG5vZGUuYXJndW1lbnRFeHByZXNzaW9uLmdldFN0YXJ0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlLmdldFN0YXJ0KCk7XG4gICAgfVxuICB9XG59XG5cbi8qKiBGaWx0ZXIgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgbWF0Y2hlcyBhbnkgQVNUIG5vZGUuICovXG5mdW5jdGlvbiBhbnlOb2RlRmlsdGVyKG46IHRzLk5vZGUpOiBuIGlzIHRzLk5vZGUge1xuICByZXR1cm4gdHJ1ZTtcbn1cbiJdfQ==