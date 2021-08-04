/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isFunctionLikeDeclaration, unwrapExpression } from '../../../../utils/typescript/functions';
import { getPropertyNameText } from '../../../../utils/typescript/property_name';
export var ResolvedUsage;
(function (ResolvedUsage) {
    ResolvedUsage[ResolvedUsage["SYNCHRONOUS"] = 0] = "SYNCHRONOUS";
    ResolvedUsage[ResolvedUsage["ASYNCHRONOUS"] = 1] = "ASYNCHRONOUS";
    ResolvedUsage[ResolvedUsage["AMBIGUOUS"] = 2] = "AMBIGUOUS";
})(ResolvedUsage || (ResolvedUsage = {}));
/**
 * List of TypeScript syntax tokens that can be used within a binary expression as
 * compound assignment. These imply a read and write of the left-side expression.
 */
const BINARY_COMPOUND_TOKENS = [
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
];
/**
 * List of known asynchronous external call expressions which aren't analyzable
 * but are guaranteed to not execute the passed argument synchronously.
 */
const ASYNC_EXTERNAL_CALLS = [
    { parent: ['Promise'], name: 'then' },
    { parent: ['Promise'], name: 'catch' },
    { parent: [null, 'Window'], name: 'requestAnimationFrame' },
    { parent: [null, 'Window'], name: 'setTimeout' },
    { parent: [null, 'Window'], name: 'setInterval' },
    { parent: ['*'], name: 'addEventListener' },
];
/**
 * Class that can be used to determine if a given TypeScript node is used within
 * other given TypeScript nodes. This is achieved by walking through all children
 * of the given node and checking for usages of the given declaration. The visitor
 * also handles potential control flow changes caused by call/new expressions.
 */
export class DeclarationUsageVisitor {
    constructor(declaration, typeChecker, baseContext = new Map()) {
        this.declaration = declaration;
        this.typeChecker = typeChecker;
        this.baseContext = baseContext;
        /** Set of visited symbols that caused a jump in control flow. */
        this.visitedJumpExprNodes = new Set();
        /**
         * Queue of nodes that need to be checked for declaration usage and
         * are guaranteed to be executed synchronously.
         */
        this.nodeQueue = [];
        /**
         * Nodes which need to be checked for declaration usage but aren't
         * guaranteed to execute synchronously.
         */
        this.ambiguousNodeQueue = [];
        /**
         * Function context that holds the TypeScript node values for all parameters
         * of the currently analyzed function block.
         */
        this.context = new Map();
    }
    isReferringToSymbol(node) {
        const symbol = this.typeChecker.getSymbolAtLocation(node);
        return !!symbol && symbol.valueDeclaration === this.declaration;
    }
    addJumpExpressionToQueue(callExpression) {
        const node = unwrapExpression(callExpression.expression);
        // In case the given expression is already referring to a function-like declaration,
        // we don't need to resolve the symbol of the expression as the jump expression is
        // defined inline and we can just add the given node to the queue.
        if (isFunctionLikeDeclaration(node) && node.body) {
            this.nodeQueue.push(node.body);
            return;
        }
        const callExprSymbol = this._getDeclarationSymbolOfNode(node);
        if (!callExprSymbol || !callExprSymbol.valueDeclaration) {
            this.peekIntoJumpExpression(callExpression);
            return;
        }
        const expressionDecl = this._resolveNodeFromContext(callExprSymbol.valueDeclaration);
        // Note that we should not add previously visited symbols to the queue as
        // this could cause cycles.
        if (!isFunctionLikeDeclaration(expressionDecl) ||
            this.visitedJumpExprNodes.has(expressionDecl) || !expressionDecl.body) {
            this.peekIntoJumpExpression(callExpression);
            return;
        }
        // Update the context for the new jump expression and its specified arguments.
        this._updateContext(callExpression.arguments, expressionDecl.parameters);
        this.visitedJumpExprNodes.add(expressionDecl);
        this.nodeQueue.push(expressionDecl.body);
    }
    addNewExpressionToQueue(node) {
        const newExprSymbol = this._getDeclarationSymbolOfNode(unwrapExpression(node.expression));
        // Only handle new expressions which resolve to classes. Technically "new" could
        // also call void functions or objects with a constructor signature. Also note that
        // we should not visit already visited symbols as this could cause cycles.
        if (!newExprSymbol || !newExprSymbol.valueDeclaration ||
            !ts.isClassDeclaration(newExprSymbol.valueDeclaration)) {
            this.peekIntoJumpExpression(node);
            return;
        }
        const targetConstructor = newExprSymbol.valueDeclaration.members.find(ts.isConstructorDeclaration);
        if (targetConstructor && targetConstructor.body &&
            !this.visitedJumpExprNodes.has(targetConstructor)) {
            // Update the context for the new expression and its specified constructor
            // parameters if arguments are passed to the class constructor.
            if (node.arguments) {
                this._updateContext(node.arguments, targetConstructor.parameters);
            }
            this.visitedJumpExprNodes.add(targetConstructor);
            this.nodeQueue.push(targetConstructor.body);
        }
        else {
            this.peekIntoJumpExpression(node);
        }
    }
    visitPropertyAccessors(node, checkSetter, checkGetter) {
        const propertySymbol = this._getPropertyAccessSymbol(node);
        if ((propertySymbol === null || propertySymbol === void 0 ? void 0 : propertySymbol.declarations) === undefined || propertySymbol.declarations.length === 0 ||
            (propertySymbol.getFlags() & ts.SymbolFlags.Accessor) === 0) {
            return;
        }
        // Since we checked the symbol flags and the symbol is describing an accessor, the
        // declarations are guaranteed to only contain the getters and setters.
        const accessors = propertySymbol.declarations;
        accessors
            .filter(d => (checkSetter && ts.isSetAccessor(d) || checkGetter && ts.isGetAccessor(d)) &&
            d.body && !this.visitedJumpExprNodes.has(d))
            .forEach(d => {
            this.visitedJumpExprNodes.add(d);
            this.nodeQueue.push(d.body);
        });
    }
    visitBinaryExpression(node) {
        const leftExpr = unwrapExpression(node.left);
        if (!ts.isPropertyAccessExpression(leftExpr)) {
            return false;
        }
        if (BINARY_COMPOUND_TOKENS.indexOf(node.operatorToken.kind) !== -1) {
            // Compound assignments always cause the getter and setter to be called.
            // Therefore we need to check the setter and getter of the property access.
            this.visitPropertyAccessors(leftExpr, /* setter */ true, /* getter */ true);
        }
        else if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            // Value assignments using the equals token only cause the "setter" to be called.
            // Therefore we need to analyze the setter declaration of the property access.
            this.visitPropertyAccessors(leftExpr, /* setter */ true, /* getter */ false);
        }
        else {
            // If the binary expression is not an assignment, it's a simple property read and
            // we need to check the getter declaration if present.
            this.visitPropertyAccessors(leftExpr, /* setter */ false, /* getter */ true);
        }
        return true;
    }
    getResolvedNodeUsage(searchNode) {
        this.nodeQueue = [searchNode];
        this.visitedJumpExprNodes.clear();
        this.context.clear();
        // Copy base context values into the current function block context. The
        // base context is useful if nodes need to be mapped to other nodes. e.g.
        // abstract super class methods are mapped to their implementation node of
        // the derived class.
        this.baseContext.forEach((value, key) => this.context.set(key, value));
        return this.isSynchronouslyUsedInNode(searchNode);
    }
    isSynchronouslyUsedInNode(searchNode) {
        this.ambiguousNodeQueue = [];
        while (this.nodeQueue.length) {
            const node = this.nodeQueue.shift();
            if (ts.isIdentifier(node) && this.isReferringToSymbol(node)) {
                return ResolvedUsage.SYNCHRONOUS;
            }
            // Handle call expressions within TypeScript nodes that cause a jump in control
            // flow. We resolve the call expression value declaration and add it to the node queue.
            if (ts.isCallExpression(node)) {
                this.addJumpExpressionToQueue(node);
            }
            // Handle new expressions that cause a jump in control flow. We resolve the
            // constructor declaration of the target class and add it to the node queue.
            if (ts.isNewExpression(node)) {
                this.addNewExpressionToQueue(node);
            }
            // We also need to handle binary expressions where a value can be either assigned to
            // the property, or a value is read from a property expression. Depending on the
            // binary expression operator, setters or getters need to be analyzed.
            if (ts.isBinaryExpression(node)) {
                // In case the binary expression contained a property expression on the left side, we
                // don't want to continue visiting this property expression on its own. This is necessary
                // because visiting the expression on its own causes a loss of context. e.g. property
                // access expressions *do not* always cause a value read (e.g. property assignments)
                if (this.visitBinaryExpression(node)) {
                    this.nodeQueue.push(node.right);
                    continue;
                }
            }
            // Handle property access expressions. Property expressions which are part of binary
            // expressions won't be added to the node queue, so these access expressions are
            // guaranteed to be "read" accesses and we need to check the "getter" declaration.
            if (ts.isPropertyAccessExpression(node)) {
                this.visitPropertyAccessors(node, /* setter */ false, /* getter */ true);
            }
            // Do not visit nodes that declare a block of statements but are not executed
            // synchronously (e.g. function declarations). We only want to check TypeScript
            // nodes which are synchronously executed in the control flow.
            if (!isFunctionLikeDeclaration(node)) {
                this.nodeQueue.push(...node.getChildren());
            }
        }
        if (this.ambiguousNodeQueue.length) {
            // Update the node queue to all stored ambiguous nodes. These nodes are not
            // guaranteed to be executed and therefore in case of a synchronous usage
            // within one of those nodes, the resolved usage is ambiguous.
            this.nodeQueue = this.ambiguousNodeQueue;
            const usage = this.isSynchronouslyUsedInNode(searchNode);
            return usage === ResolvedUsage.SYNCHRONOUS ? ResolvedUsage.AMBIGUOUS : usage;
        }
        return ResolvedUsage.ASYNCHRONOUS;
    }
    /**
     * Peeks into the given jump expression by adding all function like declarations
     * which are referenced in the jump expression arguments to the ambiguous node
     * queue. These arguments could technically access the given declaration but it's
     * not guaranteed that the jump expression is executed. In that case the resolved
     * usage is ambiguous.
     */
    peekIntoJumpExpression(jumpExp) {
        if (!jumpExp.arguments) {
            return;
        }
        // For some call expressions we don't want to add the arguments to the
        // ambiguous node queue. e.g. "setTimeout" is not analyzable but is
        // guaranteed to execute its argument asynchronously. We handle a subset
        // of these call expressions by having a hardcoded list of some.
        if (ts.isCallExpression(jumpExp)) {
            const symbol = this._getDeclarationSymbolOfNode(jumpExp.expression);
            if (symbol && symbol.valueDeclaration) {
                const parentNode = symbol.valueDeclaration.parent;
                if (parentNode && (ts.isInterfaceDeclaration(parentNode) || ts.isSourceFile(parentNode)) &&
                    (ts.isMethodSignature(symbol.valueDeclaration) ||
                        ts.isFunctionDeclaration(symbol.valueDeclaration)) &&
                    symbol.valueDeclaration.name) {
                    const parentName = ts.isInterfaceDeclaration(parentNode) ? parentNode.name.text : null;
                    const callName = getPropertyNameText(symbol.valueDeclaration.name);
                    if (ASYNC_EXTERNAL_CALLS.some(c => (c.name === callName &&
                        (c.parent.indexOf(parentName) !== -1 || c.parent.indexOf('*') !== -1)))) {
                        return;
                    }
                }
            }
        }
        jumpExp.arguments.forEach((node) => {
            node = this._resolveDeclarationOfNode(node);
            if (ts.isVariableDeclaration(node) && node.initializer) {
                node = node.initializer;
            }
            if (isFunctionLikeDeclaration(node) && !!node.body) {
                this.ambiguousNodeQueue.push(node.body);
            }
        });
    }
    /**
     * Resolves a given node from the context. In case the node is not mapped in
     * the context, the original node is returned.
     */
    _resolveNodeFromContext(node) {
        if (this.context.has(node)) {
            return this.context.get(node);
        }
        return node;
    }
    /**
     * Updates the context to reflect the newly set parameter values. This allows future
     * references to function parameters to be resolved to the actual node through the context.
     */
    _updateContext(callArgs, parameters) {
        parameters.forEach((parameter, index) => {
            let argumentNode = callArgs[index];
            if (!argumentNode) {
                if (!parameter.initializer) {
                    return;
                }
                // Argument can be undefined in case the function parameter has a default
                // value. In that case we want to store the parameter default value in the context.
                argumentNode = parameter.initializer;
            }
            if (ts.isIdentifier(argumentNode)) {
                this.context.set(parameter, this._resolveDeclarationOfNode(argumentNode));
            }
            else {
                this.context.set(parameter, argumentNode);
            }
        });
    }
    /**
     * Resolves the declaration of a given TypeScript node. For example an identifier can
     * refer to a function parameter. This parameter can then be resolved through the
     * function context.
     */
    _resolveDeclarationOfNode(node) {
        const symbol = this._getDeclarationSymbolOfNode(node);
        if (!symbol || !symbol.valueDeclaration) {
            return node;
        }
        return this._resolveNodeFromContext(symbol.valueDeclaration);
    }
    /**
     * Gets the declaration symbol of a given TypeScript node. Resolves aliased
     * symbols to the symbol containing the value declaration.
     */
    _getDeclarationSymbolOfNode(node) {
        let symbol = this.typeChecker.getSymbolAtLocation(node);
        if (!symbol) {
            return null;
        }
        // Resolve the symbol to it's original declaration symbol.
        while (symbol.flags & ts.SymbolFlags.Alias) {
            symbol = this.typeChecker.getAliasedSymbol(symbol);
        }
        return symbol;
    }
    /** Gets the symbol of the given property access expression. */
    _getPropertyAccessSymbol(node) {
        let propertySymbol = this._getDeclarationSymbolOfNode(node.name);
        if (!propertySymbol || !propertySymbol.valueDeclaration) {
            return null;
        }
        if (!this.context.has(propertySymbol.valueDeclaration)) {
            return propertySymbol;
        }
        // In case the context has the value declaration of the given property access
        // name identifier, we need to replace the "propertySymbol" with the symbol
        // referring to the resolved symbol based on the context. e.g. abstract properties
        // can ultimately resolve into an accessor declaration based on the implementation.
        const contextNode = this._resolveNodeFromContext(propertySymbol.valueDeclaration);
        if (!ts.isAccessor(contextNode)) {
            return null;
        }
        // Resolve the symbol referring to the "accessor" using the name identifier
        // of the accessor declaration.
        return this._getDeclarationSymbolOfNode(contextNode.name);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjbGFyYXRpb25fdXNhZ2VfdmlzaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy9taWdyYXRpb25zL3N0YXRpYy1xdWVyaWVzL3N0cmF0ZWdpZXMvdXNhZ2Vfc3RyYXRlZ3kvZGVjbGFyYXRpb25fdXNhZ2VfdmlzaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNuRyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSw0Q0FBNEMsQ0FBQztBQUkvRSxNQUFNLENBQU4sSUFBWSxhQUlYO0FBSkQsV0FBWSxhQUFhO0lBQ3ZCLCtEQUFXLENBQUE7SUFDWCxpRUFBWSxDQUFBO0lBQ1osMkRBQVMsQ0FBQTtBQUNYLENBQUMsRUFKVyxhQUFhLEtBQWIsYUFBYSxRQUl4QjtBQUVEOzs7R0FHRztBQUNILE1BQU0sc0JBQXNCLEdBQUc7SUFDN0IsRUFBRSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0I7SUFDOUIsRUFBRSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7SUFDakMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0I7SUFDbEMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjO0lBQzVCLEVBQUUsQ0FBQyxVQUFVLENBQUMsMkJBQTJCO0lBQ3pDLEVBQUUsQ0FBQyxVQUFVLENBQUMsZUFBZTtJQUM3QixFQUFFLENBQUMsVUFBVSxDQUFDLGdCQUFnQjtJQUM5QixFQUFFLENBQUMsVUFBVSxDQUFDLGdCQUFnQjtDQUMvQixDQUFDO0FBRUY7OztHQUdHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRztJQUMzQixFQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLElB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LGtGQUFrRjtRQUNsRixtRkFBbUY7UUFDbkYsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRWxGLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQy9CLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCwyRUFBMkU7UUFDM0UsK0JBQStCO1FBQy9CLE9BQU8sSUFBSSxDQUFDLDJCQUEyQixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1RCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge2lzRnVuY3Rpb25MaWtlRGVjbGFyYXRpb24sIHVud3JhcEV4cHJlc3Npb259IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvZnVuY3Rpb25zJztcbmltcG9ydCB7Z2V0UHJvcGVydHlOYW1lVGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vdXRpbHMvdHlwZXNjcmlwdC9wcm9wZXJ0eV9uYW1lJztcblxuZXhwb3J0IHR5cGUgRnVuY3Rpb25Db250ZXh0ID0gTWFwPHRzLk5vZGUsIHRzLk5vZGU+O1xuXG5leHBvcnQgZW51bSBSZXNvbHZlZFVzYWdlIHtcbiAgU1lOQ0hST05PVVMsXG4gIEFTWU5DSFJPTk9VUyxcbiAgQU1CSUdVT1VTLFxufVxuXG4vKipcbiAqIExpc3Qgb2YgVHlwZVNjcmlwdCBzeW50YXggdG9rZW5zIHRoYXQgY2FuIGJlIHVzZWQgd2l0aGluIGEgYmluYXJ5IGV4cHJlc3Npb24gYXNcbiAqIGNvbXBvdW5kIGFzc2lnbm1lbnQuIFRoZXNlIGltcGx5IGEgcmVhZCBhbmQgd3JpdGUgb2YgdGhlIGxlZnQtc2lkZSBleHByZXNzaW9uLlxuICovXG5jb25zdCBCSU5BUllfQ09NUE9VTkRfVE9LRU5TID0gW1xuICB0cy5TeW50YXhLaW5kLkNhcmV0RXF1YWxzVG9rZW4sXG4gIHRzLlN5bnRheEtpbmQuQXN0ZXJpc2tFcXVhbHNUb2tlbixcbiAgdHMuU3ludGF4S2luZC5BbXBlcnNhbmRFcXVhbHNUb2tlbixcbiAgdHMuU3ludGF4S2luZC5CYXJFcXVhbHNUb2tlbixcbiAgdHMuU3ludGF4S2luZC5Bc3Rlcmlza0FzdGVyaXNrRXF1YWxzVG9rZW4sXG4gIHRzLlN5bnRheEtpbmQuUGx1c0VxdWFsc1Rva2VuLFxuICB0cy5TeW50YXhLaW5kLk1pbnVzRXF1YWxzVG9rZW4sXG4gIHRzLlN5bnRheEtpbmQuU2xhc2hFcXVhbHNUb2tlbixcbl07XG5cbi8qKlxuICogTGlzdCBvZiBrbm93biBhc3luY2hyb25vdXMgZXh0ZXJuYWwgY2FsbCBleHByZXNzaW9ucyB3aGljaCBhcmVuJ3QgYW5hbHl6YWJsZVxuICogYnV0IGFyZSBndWFyYW50ZWVkIHRvIG5vdCBleGVjdXRlIHRoZSBwYXNzZWQgYXJndW1lbnQgc3luY2hyb25vdXNseS5cbiAqL1xuY29uc3QgQVNZTkNfRVhURVJOQUxfQ0FMTFMgPSBbXG4gIHtwYXJlbnQ6IFsnUHJvbWlzZSddLCBuYW1lOiAndGhlbid9LFxuICB7cGFyZW50OiBbJ1Byb21pc2UnXSwgbmFtZTogJ2NhdGNoJ30sXG4gIHtwYXJlbnQ6IFtudWxsLCAnV2luZG93J10sIG5hbWU6ICdyZXF1ZXN0QW5pbWF0aW9uRnJhbWUnfSxcbiAge3BhcmVudDogW251bGwsICdXaW5kb3cnXSwgbmFtZTogJ3NldFRpbWVvdXQnfSxcbiAge3BhcmVudDogW251bGwsICdXaW5kb3cnXSwgbmFtZTogJ3NldEludGVydmFsJ30sXG4gIHtwYXJlbnQ6IFsnKiddLCBuYW1lOiAnYWRkRXZlbnRMaXN0ZW5lcid9LFxuXTtcblxuLyoqXG4gKiBDbGFzcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGRldGVybWluZSBpZiBhIGdpdmVuIFR5cGVTY3JpcHQgbm9kZSBpcyB1c2VkIHdpdGhpblxuICogb3RoZXIgZ2l2ZW4gVHlwZVNjcmlwdCBub2Rlcy4gVGhpcyBpcyBhY2hpZXZlZCBieSB3YWxraW5nIHRocm91Z2ggYWxsIGNoaWxkcmVuXG4gKiBvZiB0aGUgZ2l2ZW4gbm9kZSBhbmQgY2hlY2tpbmcgZm9yIHVzYWdlcyBvZiB0aGUgZ2l2ZW4gZGVjbGFyYXRpb24uIFRoZSB2aXNpdG9yXG4gKiBhbHNvIGhhbmRsZXMgcG90ZW50aWFsIGNvbnRyb2wgZmxvdyBjaGFuZ2VzIGNhdXNlZCBieSBjYWxsL25ldyBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIERlY2xhcmF0aW9uVXNhZ2VWaXNpdG9yIHtcbiAgLyoqIFNldCBvZiB2aXNpdGVkIHN5bWJvbHMgdGhhdCBjYXVzZWQgYSBqdW1wIGluIGNvbnRyb2wgZmxvdy4gKi9cbiAgcHJpdmF0ZSB2aXNpdGVkSnVtcEV4cHJOb2RlcyA9IG5ldyBTZXQ8dHMuTm9kZT4oKTtcblxuICAvKipcbiAgICogUXVldWUgb2Ygbm9kZXMgdGhhdCBuZWVkIHRvIGJlIGNoZWNrZWQgZm9yIGRlY2xhcmF0aW9uIHVzYWdlIGFuZFxuICAgKiBhcmUgZ3VhcmFudGVlZCB0byBiZSBleGVjdXRlZCBzeW5jaHJvbm91c2x5LlxuICAgKi9cbiAgcHJpdmF0ZSBub2RlUXVldWU6IHRzLk5vZGVbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBOb2RlcyB3aGljaCBuZWVkIHRvIGJlIGNoZWNrZWQgZm9yIGRlY2xhcmF0aW9uIHVzYWdlIGJ1dCBhcmVuJ3RcbiAgICogZ3VhcmFudGVlZCB0byBleGVjdXRlIHN5bmNocm9ub3VzbHkuXG4gICAqL1xuICBwcml2YXRlIGFtYmlndW91c05vZGVRdWV1ZTogdHMuTm9kZVtdID0gW107XG5cbiAgLyoqXG4gICAqIEZ1bmN0aW9uIGNvbnRleHQgdGhhdCBob2xkcyB0aGUgVHlwZVNjcmlwdCBub2RlIHZhbHVlcyBmb3IgYWxsIHBhcmFtZXRlcnNcbiAgICogb2YgdGhlIGN1cnJlbnRseSBhbmFseXplZCBmdW5jdGlvbiBibG9jay5cbiAgICovXG4gIHByaXZhdGUgY29udGV4dDogRnVuY3Rpb25Db250ZXh0ID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBkZWNsYXJhdGlvbjogdHMuTm9kZSwgcHJpdmF0ZSB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsXG4gICAgICBwcml2YXRlIGJhc2VDb250ZXh0OiBGdW5jdGlvbkNvbnRleHQgPSBuZXcgTWFwKCkpIHt9XG5cbiAgcHJpdmF0ZSBpc1JlZmVycmluZ1RvU3ltYm9sKG5vZGU6IHRzLk5vZGUpOiBib29sZWFuIHtcbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLnR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obm9kZSk7XG4gICAgcmV0dXJuICEhc3ltYm9sICYmIHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uID09PSB0aGlzLmRlY2xhcmF0aW9uO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRKdW1wRXhwcmVzc2lvblRvUXVldWUoY2FsbEV4cHJlc3Npb246IHRzLkNhbGxFeHByZXNzaW9uKSB7XG4gICAgY29uc3Qgbm9kZSA9IHVud3JhcEV4cHJlc3Npb24oY2FsbEV4cHJlc3Npb24uZXhwcmVzc2lvbik7XG5cbiAgICAvLyBJbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGFscmVhZHkgcmVmZXJyaW5nIHRvIGEgZnVuY3Rpb24tbGlrZSBkZWNsYXJhdGlvbixcbiAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgdGhlIHN5bWJvbCBvZiB0aGUgZXhwcmVzc2lvbiBhcyB0aGUganVtcCBleHByZXNzaW9uIGlzXG4gICAgLy8gZGVmaW5lZCBpbmxpbmUgYW5kIHdlIGNhbiBqdXN0IGFkZCB0aGUgZ2l2ZW4gbm9kZSB0byB0aGUgcXVldWUuXG4gICAgaWYgKGlzRnVuY3Rpb25MaWtlRGVjbGFyYXRpb24obm9kZSkgJiYgbm9kZS5ib2R5KSB7XG4gICAgICB0aGlzLm5vZGVRdWV1ZS5wdXNoKG5vZGUuYm9keSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbEV4cHJTeW1ib2wgPSB0aGlzLl9nZXREZWNsYXJhdGlvblN5bWJvbE9mTm9kZShub2RlKTtcblxuICAgIGlmICghY2FsbEV4cHJTeW1ib2wgfHwgIWNhbGxFeHByU3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pIHtcbiAgICAgIHRoaXMucGVla0ludG9KdW1wRXhwcmVzc2lvbihjYWxsRXhwcmVzc2lvbik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbkRlY2wgPSB0aGlzLl9yZXNvbHZlTm9kZUZyb21Db250ZXh0KGNhbGxFeHByU3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pO1xuXG4gICAgLy8gTm90ZSB0aGF0IHdlIHNob3VsZCBub3QgYWRkIHByZXZpb3VzbHkgdmlzaXRlZCBzeW1ib2xzIHRvIHRoZSBxdWV1ZSBhc1xuICAgIC8vIHRoaXMgY291bGQgY2F1c2UgY3ljbGVzLlxuICAgIGlmICghaXNGdW5jdGlvbkxpa2VEZWNsYXJhdGlvbihleHByZXNzaW9uRGVjbCkgfHxcbiAgICAgICAgdGhpcy52aXNpdGVkSnVtcEV4cHJOb2Rlcy5oYXMoZXhwcmVzc2lvbkRlY2wpIHx8ICFleHByZXNzaW9uRGVjbC5ib2R5KSB7XG4gICAgICB0aGlzLnBlZWtJbnRvSnVtcEV4cHJlc3Npb24oY2FsbEV4cHJlc3Npb24pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSB0aGUgY29udGV4dCBmb3IgdGhlIG5ldyBqdW1wIGV4cHJlc3Npb24gYW5kIGl0cyBzcGVjaWZpZWQgYXJndW1lbnRzLlxuICAgIHRoaXMuX3VwZGF0ZUNvbnRleHQoY2FsbEV4cHJlc3Npb24uYXJndW1lbnRzLCBleHByZXNzaW9uRGVjbC5wYXJhbWV0ZXJzKTtcblxuICAgIHRoaXMudmlzaXRlZEp1bXBFeHByTm9kZXMuYWRkKGV4cHJlc3Npb25EZWNsKTtcbiAgICB0aGlzLm5vZGVRdWV1ZS5wdXNoKGV4cHJlc3Npb25EZWNsLmJvZHkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGROZXdFeHByZXNzaW9uVG9RdWV1ZShub2RlOiB0cy5OZXdFeHByZXNzaW9uKSB7XG4gICAgY29uc3QgbmV3RXhwclN5bWJvbCA9IHRoaXMuX2dldERlY2xhcmF0aW9uU3ltYm9sT2ZOb2RlKHVud3JhcEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uKSk7XG5cbiAgICAvLyBPbmx5IGhhbmRsZSBuZXcgZXhwcmVzc2lvbnMgd2hpY2ggcmVzb2x2ZSB0byBjbGFzc2VzLiBUZWNobmljYWxseSBcIm5ld1wiIGNvdWxkXG4gICAgLy8gYWxzbyBjYWxsIHZvaWQgZnVuY3Rpb25zIG9yIG9iamVjdHMgd2l0aCBhIGNvbnN0cnVjdG9yIHNpZ25hdHVyZS4gQWxzbyBub3RlIHRoYXRcbiAgICAvLyB3ZSBzaG91bGQgbm90IHZpc2l0IGFscmVhZHkgdmlzaXRlZCBzeW1ib2xzIGFzIHRoaXMgY291bGQgY2F1c2UgY3ljbGVzLlxuICAgIGlmICghbmV3RXhwclN5bWJvbCB8fCAhbmV3RXhwclN5bWJvbC52YWx1ZURlY2xhcmF0aW9uIHx8XG4gICAgICAgICF0cy5pc0NsYXNzRGVjbGFyYXRpb24obmV3RXhwclN5bWJvbC52YWx1ZURlY2xhcmF0aW9uKSkge1xuICAgICAgdGhpcy5wZWVrSW50b0p1bXBFeHByZXNzaW9uKG5vZGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldENvbnN0cnVjdG9yID1cbiAgICAgICAgbmV3RXhwclN5bWJvbC52YWx1ZURlY2xhcmF0aW9uLm1lbWJlcnMuZmluZCh0cy5pc0NvbnN0cnVjdG9yRGVjbGFyYXRpb24pO1xuXG4gICAgaWYgKHRhcmdldENvbnN0cnVjdG9yICYmIHRhcmdldENvbnN0cnVjdG9yLmJvZHkgJiZcbiAgICAgICAgIXRoaXMudmlzaXRlZEp1bXBFeHByTm9kZXMuaGFzKHRhcmdldENvbnN0cnVjdG9yKSkge1xuICAgICAgLy8gVXBkYXRlIHRoZSBjb250ZXh0IGZvciB0aGUgbmV3IGV4cHJlc3Npb24gYW5kIGl0cyBzcGVjaWZpZWQgY29uc3RydWN0b3JcbiAgICAgIC8vIHBhcmFtZXRlcnMgaWYgYXJndW1lbnRzIGFyZSBwYXNzZWQgdG8gdGhlIGNsYXNzIGNvbnN0cnVjdG9yLlxuICAgICAgaWYgKG5vZGUuYXJndW1lbnRzKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUNvbnRleHQobm9kZS5hcmd1bWVudHMsIHRhcmdldENvbnN0cnVjdG9yLnBhcmFtZXRlcnMpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnZpc2l0ZWRKdW1wRXhwck5vZGVzLmFkZCh0YXJnZXRDb25zdHJ1Y3Rvcik7XG4gICAgICB0aGlzLm5vZGVRdWV1ZS5wdXNoKHRhcmdldENvbnN0cnVjdG9yLmJvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBlZWtJbnRvSnVtcEV4cHJlc3Npb24obm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdFByb3BlcnR5QWNjZXNzb3JzKFxuICAgICAgbm9kZTogdHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uLCBjaGVja1NldHRlcjogYm9vbGVhbiwgY2hlY2tHZXR0ZXI6IGJvb2xlYW4pIHtcbiAgICBjb25zdCBwcm9wZXJ0eVN5bWJvbCA9IHRoaXMuX2dldFByb3BlcnR5QWNjZXNzU3ltYm9sKG5vZGUpO1xuXG4gICAgaWYgKHByb3BlcnR5U3ltYm9sPy5kZWNsYXJhdGlvbnMgPT09IHVuZGVmaW5lZCB8fCBwcm9wZXJ0eVN5bWJvbC5kZWNsYXJhdGlvbnMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgIChwcm9wZXJ0eVN5bWJvbC5nZXRGbGFncygpICYgdHMuU3ltYm9sRmxhZ3MuQWNjZXNzb3IpID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU2luY2Ugd2UgY2hlY2tlZCB0aGUgc3ltYm9sIGZsYWdzIGFuZCB0aGUgc3ltYm9sIGlzIGRlc2NyaWJpbmcgYW4gYWNjZXNzb3IsIHRoZVxuICAgIC8vIGRlY2xhcmF0aW9ucyBhcmUgZ3VhcmFudGVlZCB0byBvbmx5IGNvbnRhaW4gdGhlIGdldHRlcnMgYW5kIHNldHRlcnMuXG4gICAgY29uc3QgYWNjZXNzb3JzID0gcHJvcGVydHlTeW1ib2wuZGVjbGFyYXRpb25zIGFzIHRzLkFjY2Vzc29yRGVjbGFyYXRpb25bXTtcblxuICAgIGFjY2Vzc29yc1xuICAgICAgICAuZmlsdGVyKFxuICAgICAgICAgICAgZCA9PiAoY2hlY2tTZXR0ZXIgJiYgdHMuaXNTZXRBY2Nlc3NvcihkKSB8fCBjaGVja0dldHRlciAmJiB0cy5pc0dldEFjY2Vzc29yKGQpKSAmJlxuICAgICAgICAgICAgICAgIGQuYm9keSAmJiAhdGhpcy52aXNpdGVkSnVtcEV4cHJOb2Rlcy5oYXMoZCkpXG4gICAgICAgIC5mb3JFYWNoKGQgPT4ge1xuICAgICAgICAgIHRoaXMudmlzaXRlZEp1bXBFeHByTm9kZXMuYWRkKGQpO1xuICAgICAgICAgIHRoaXMubm9kZVF1ZXVlLnB1c2goZC5ib2R5ISk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEJpbmFyeUV4cHJlc3Npb24obm9kZTogdHMuQmluYXJ5RXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGxlZnRFeHByID0gdW53cmFwRXhwcmVzc2lvbihub2RlLmxlZnQpO1xuXG4gICAgaWYgKCF0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihsZWZ0RXhwcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoQklOQVJZX0NPTVBPVU5EX1RPS0VOUy5pbmRleE9mKG5vZGUub3BlcmF0b3JUb2tlbi5raW5kKSAhPT0gLTEpIHtcbiAgICAgIC8vIENvbXBvdW5kIGFzc2lnbm1lbnRzIGFsd2F5cyBjYXVzZSB0aGUgZ2V0dGVyIGFuZCBzZXR0ZXIgdG8gYmUgY2FsbGVkLlxuICAgICAgLy8gVGhlcmVmb3JlIHdlIG5lZWQgdG8gY2hlY2sgdGhlIHNldHRlciBhbmQgZ2V0dGVyIG9mIHRoZSBwcm9wZXJ0eSBhY2Nlc3MuXG4gICAgICB0aGlzLnZpc2l0UHJvcGVydHlBY2Nlc3NvcnMobGVmdEV4cHIsIC8qIHNldHRlciAqLyB0cnVlLCAvKiBnZXR0ZXIgKi8gdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChub2RlLm9wZXJhdG9yVG9rZW4ua2luZCA9PT0gdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbikge1xuICAgICAgLy8gVmFsdWUgYXNzaWdubWVudHMgdXNpbmcgdGhlIGVxdWFscyB0b2tlbiBvbmx5IGNhdXNlIHRoZSBcInNldHRlclwiIHRvIGJlIGNhbGxlZC5cbiAgICAgIC8vIFRoZXJlZm9yZSB3ZSBuZWVkIHRvIGFuYWx5emUgdGhlIHNldHRlciBkZWNsYXJhdGlvbiBvZiB0aGUgcHJvcGVydHkgYWNjZXNzLlxuICAgICAgdGhpcy52aXNpdFByb3BlcnR5QWNjZXNzb3JzKGxlZnRFeHByLCAvKiBzZXR0ZXIgKi8gdHJ1ZSwgLyogZ2V0dGVyICovIGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgdGhlIGJpbmFyeSBleHByZXNzaW9uIGlzIG5vdCBhbiBhc3NpZ25tZW50LCBpdCdzIGEgc2ltcGxlIHByb3BlcnR5IHJlYWQgYW5kXG4gICAgICAvLyB3ZSBuZWVkIHRvIGNoZWNrIHRoZSBnZXR0ZXIgZGVjbGFyYXRpb24gaWYgcHJlc2VudC5cbiAgICAgIHRoaXMudmlzaXRQcm9wZXJ0eUFjY2Vzc29ycyhsZWZ0RXhwciwgLyogc2V0dGVyICovIGZhbHNlLCAvKiBnZXR0ZXIgKi8gdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZ2V0UmVzb2x2ZWROb2RlVXNhZ2Uoc2VhcmNoTm9kZTogdHMuTm9kZSk6IFJlc29sdmVkVXNhZ2Uge1xuICAgIHRoaXMubm9kZVF1ZXVlID0gW3NlYXJjaE5vZGVdO1xuICAgIHRoaXMudmlzaXRlZEp1bXBFeHByTm9kZXMuY2xlYXIoKTtcbiAgICB0aGlzLmNvbnRleHQuY2xlYXIoKTtcblxuICAgIC8vIENvcHkgYmFzZSBjb250ZXh0IHZhbHVlcyBpbnRvIHRoZSBjdXJyZW50IGZ1bmN0aW9uIGJsb2NrIGNvbnRleHQuIFRoZVxuICAgIC8vIGJhc2UgY29udGV4dCBpcyB1c2VmdWwgaWYgbm9kZXMgbmVlZCB0byBiZSBtYXBwZWQgdG8gb3RoZXIgbm9kZXMuIGUuZy5cbiAgICAvLyBhYnN0cmFjdCBzdXBlciBjbGFzcyBtZXRob2RzIGFyZSBtYXBwZWQgdG8gdGhlaXIgaW1wbGVtZW50YXRpb24gbm9kZSBvZlxuICAgIC8vIHRoZSBkZXJpdmVkIGNsYXNzLlxuICAgIHRoaXMuYmFzZUNvbnRleHQuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gdGhpcy5jb250ZXh0LnNldChrZXksIHZhbHVlKSk7XG5cbiAgICByZXR1cm4gdGhpcy5pc1N5bmNocm9ub3VzbHlVc2VkSW5Ob2RlKHNlYXJjaE5vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc1N5bmNocm9ub3VzbHlVc2VkSW5Ob2RlKHNlYXJjaE5vZGU6IHRzLk5vZGUpOiBSZXNvbHZlZFVzYWdlIHtcbiAgICB0aGlzLmFtYmlndW91c05vZGVRdWV1ZSA9IFtdO1xuXG4gICAgd2hpbGUgKHRoaXMubm9kZVF1ZXVlLmxlbmd0aCkge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMubm9kZVF1ZXVlLnNoaWZ0KCkhO1xuXG4gICAgICBpZiAodHMuaXNJZGVudGlmaWVyKG5vZGUpICYmIHRoaXMuaXNSZWZlcnJpbmdUb1N5bWJvbChub2RlKSkge1xuICAgICAgICByZXR1cm4gUmVzb2x2ZWRVc2FnZS5TWU5DSFJPTk9VUztcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIGNhbGwgZXhwcmVzc2lvbnMgd2l0aGluIFR5cGVTY3JpcHQgbm9kZXMgdGhhdCBjYXVzZSBhIGp1bXAgaW4gY29udHJvbFxuICAgICAgLy8gZmxvdy4gV2UgcmVzb2x2ZSB0aGUgY2FsbCBleHByZXNzaW9uIHZhbHVlIGRlY2xhcmF0aW9uIGFuZCBhZGQgaXQgdG8gdGhlIG5vZGUgcXVldWUuXG4gICAgICBpZiAodHMuaXNDYWxsRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgICB0aGlzLmFkZEp1bXBFeHByZXNzaW9uVG9RdWV1ZShub2RlKTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIG5ldyBleHByZXNzaW9ucyB0aGF0IGNhdXNlIGEganVtcCBpbiBjb250cm9sIGZsb3cuIFdlIHJlc29sdmUgdGhlXG4gICAgICAvLyBjb25zdHJ1Y3RvciBkZWNsYXJhdGlvbiBvZiB0aGUgdGFyZ2V0IGNsYXNzIGFuZCBhZGQgaXQgdG8gdGhlIG5vZGUgcXVldWUuXG4gICAgICBpZiAodHMuaXNOZXdFeHByZXNzaW9uKG5vZGUpKSB7XG4gICAgICAgIHRoaXMuYWRkTmV3RXhwcmVzc2lvblRvUXVldWUobm9kZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIGFsc28gbmVlZCB0byBoYW5kbGUgYmluYXJ5IGV4cHJlc3Npb25zIHdoZXJlIGEgdmFsdWUgY2FuIGJlIGVpdGhlciBhc3NpZ25lZCB0b1xuICAgICAgLy8gdGhlIHByb3BlcnR5LCBvciBhIHZhbHVlIGlzIHJlYWQgZnJvbSBhIHByb3BlcnR5IGV4cHJlc3Npb24uIERlcGVuZGluZyBvbiB0aGVcbiAgICAgIC8vIGJpbmFyeSBleHByZXNzaW9uIG9wZXJhdG9yLCBzZXR0ZXJzIG9yIGdldHRlcnMgbmVlZCB0byBiZSBhbmFseXplZC5cbiAgICAgIGlmICh0cy5pc0JpbmFyeUV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgICAgLy8gSW4gY2FzZSB0aGUgYmluYXJ5IGV4cHJlc3Npb24gY29udGFpbmVkIGEgcHJvcGVydHkgZXhwcmVzc2lvbiBvbiB0aGUgbGVmdCBzaWRlLCB3ZVxuICAgICAgICAvLyBkb24ndCB3YW50IHRvIGNvbnRpbnVlIHZpc2l0aW5nIHRoaXMgcHJvcGVydHkgZXhwcmVzc2lvbiBvbiBpdHMgb3duLiBUaGlzIGlzIG5lY2Vzc2FyeVxuICAgICAgICAvLyBiZWNhdXNlIHZpc2l0aW5nIHRoZSBleHByZXNzaW9uIG9uIGl0cyBvd24gY2F1c2VzIGEgbG9zcyBvZiBjb250ZXh0LiBlLmcuIHByb3BlcnR5XG4gICAgICAgIC8vIGFjY2VzcyBleHByZXNzaW9ucyAqZG8gbm90KiBhbHdheXMgY2F1c2UgYSB2YWx1ZSByZWFkIChlLmcuIHByb3BlcnR5IGFzc2lnbm1lbnRzKVxuICAgICAgICBpZiAodGhpcy52aXNpdEJpbmFyeUV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgICAgICB0aGlzLm5vZGVRdWV1ZS5wdXNoKG5vZGUucmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEhhbmRsZSBwcm9wZXJ0eSBhY2Nlc3MgZXhwcmVzc2lvbnMuIFByb3BlcnR5IGV4cHJlc3Npb25zIHdoaWNoIGFyZSBwYXJ0IG9mIGJpbmFyeVxuICAgICAgLy8gZXhwcmVzc2lvbnMgd29uJ3QgYmUgYWRkZWQgdG8gdGhlIG5vZGUgcXVldWUsIHNvIHRoZXNlIGFjY2VzcyBleHByZXNzaW9ucyBhcmVcbiAgICAgIC8vIGd1YXJhbnRlZWQgdG8gYmUgXCJyZWFkXCIgYWNjZXNzZXMgYW5kIHdlIG5lZWQgdG8gY2hlY2sgdGhlIFwiZ2V0dGVyXCIgZGVjbGFyYXRpb24uXG4gICAgICBpZiAodHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgICAgdGhpcy52aXNpdFByb3BlcnR5QWNjZXNzb3JzKG5vZGUsIC8qIHNldHRlciAqLyBmYWxzZSwgLyogZ2V0dGVyICovIHRydWUpO1xuICAgICAgfVxuXG4gICAgICAvLyBEbyBub3QgdmlzaXQgbm9kZXMgdGhhdCBkZWNsYXJlIGEgYmxvY2sgb2Ygc3RhdGVtZW50cyBidXQgYXJlIG5vdCBleGVjdXRlZFxuICAgICAgLy8gc3luY2hyb25vdXNseSAoZS5nLiBmdW5jdGlvbiBkZWNsYXJhdGlvbnMpLiBXZSBvbmx5IHdhbnQgdG8gY2hlY2sgVHlwZVNjcmlwdFxuICAgICAgLy8gbm9kZXMgd2hpY2ggYXJlIHN5bmNocm9ub3VzbHkgZXhlY3V0ZWQgaW4gdGhlIGNvbnRyb2wgZmxvdy5cbiAgICAgIGlmICghaXNGdW5jdGlvbkxpa2VEZWNsYXJhdGlvbihub2RlKSkge1xuICAgICAgICB0aGlzLm5vZGVRdWV1ZS5wdXNoKC4uLm5vZGUuZ2V0Q2hpbGRyZW4oKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYW1iaWd1b3VzTm9kZVF1ZXVlLmxlbmd0aCkge1xuICAgICAgLy8gVXBkYXRlIHRoZSBub2RlIHF1ZXVlIHRvIGFsbCBzdG9yZWQgYW1iaWd1b3VzIG5vZGVzLiBUaGVzZSBub2RlcyBhcmUgbm90XG4gICAgICAvLyBndWFyYW50ZWVkIHRvIGJlIGV4ZWN1dGVkIGFuZCB0aGVyZWZvcmUgaW4gY2FzZSBvZiBhIHN5bmNocm9ub3VzIHVzYWdlXG4gICAgICAvLyB3aXRoaW4gb25lIG9mIHRob3NlIG5vZGVzLCB0aGUgcmVzb2x2ZWQgdXNhZ2UgaXMgYW1iaWd1b3VzLlxuICAgICAgdGhpcy5ub2RlUXVldWUgPSB0aGlzLmFtYmlndW91c05vZGVRdWV1ZTtcbiAgICAgIGNvbnN0IHVzYWdlID0gdGhpcy5pc1N5bmNocm9ub3VzbHlVc2VkSW5Ob2RlKHNlYXJjaE5vZGUpO1xuICAgICAgcmV0dXJuIHVzYWdlID09PSBSZXNvbHZlZFVzYWdlLlNZTkNIUk9OT1VTID8gUmVzb2x2ZWRVc2FnZS5BTUJJR1VPVVMgOiB1c2FnZTtcbiAgICB9XG4gICAgcmV0dXJuIFJlc29sdmVkVXNhZ2UuQVNZTkNIUk9OT1VTO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlZWtzIGludG8gdGhlIGdpdmVuIGp1bXAgZXhwcmVzc2lvbiBieSBhZGRpbmcgYWxsIGZ1bmN0aW9uIGxpa2UgZGVjbGFyYXRpb25zXG4gICAqIHdoaWNoIGFyZSByZWZlcmVuY2VkIGluIHRoZSBqdW1wIGV4cHJlc3Npb24gYXJndW1lbnRzIHRvIHRoZSBhbWJpZ3VvdXMgbm9kZVxuICAgKiBxdWV1ZS4gVGhlc2UgYXJndW1lbnRzIGNvdWxkIHRlY2huaWNhbGx5IGFjY2VzcyB0aGUgZ2l2ZW4gZGVjbGFyYXRpb24gYnV0IGl0J3NcbiAgICogbm90IGd1YXJhbnRlZWQgdGhhdCB0aGUganVtcCBleHByZXNzaW9uIGlzIGV4ZWN1dGVkLiBJbiB0aGF0IGNhc2UgdGhlIHJlc29sdmVkXG4gICAqIHVzYWdlIGlzIGFtYmlndW91cy5cbiAgICovXG4gIHByaXZhdGUgcGVla0ludG9KdW1wRXhwcmVzc2lvbihqdW1wRXhwOiB0cy5DYWxsRXhwcmVzc2lvbnx0cy5OZXdFeHByZXNzaW9uKSB7XG4gICAgaWYgKCFqdW1wRXhwLmFyZ3VtZW50cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEZvciBzb21lIGNhbGwgZXhwcmVzc2lvbnMgd2UgZG9uJ3Qgd2FudCB0byBhZGQgdGhlIGFyZ3VtZW50cyB0byB0aGVcbiAgICAvLyBhbWJpZ3VvdXMgbm9kZSBxdWV1ZS4gZS5nLiBcInNldFRpbWVvdXRcIiBpcyBub3QgYW5hbHl6YWJsZSBidXQgaXNcbiAgICAvLyBndWFyYW50ZWVkIHRvIGV4ZWN1dGUgaXRzIGFyZ3VtZW50IGFzeW5jaHJvbm91c2x5LiBXZSBoYW5kbGUgYSBzdWJzZXRcbiAgICAvLyBvZiB0aGVzZSBjYWxsIGV4cHJlc3Npb25zIGJ5IGhhdmluZyBhIGhhcmRjb2RlZCBsaXN0IG9mIHNvbWUuXG4gICAgaWYgKHRzLmlzQ2FsbEV4cHJlc3Npb24oanVtcEV4cCkpIHtcbiAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuX2dldERlY2xhcmF0aW9uU3ltYm9sT2ZOb2RlKGp1bXBFeHAuZXhwcmVzc2lvbik7XG4gICAgICBpZiAoc3ltYm9sICYmIHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbi5wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnROb2RlICYmICh0cy5pc0ludGVyZmFjZURlY2xhcmF0aW9uKHBhcmVudE5vZGUpIHx8IHRzLmlzU291cmNlRmlsZShwYXJlbnROb2RlKSkgJiZcbiAgICAgICAgICAgICh0cy5pc01ldGhvZFNpZ25hdHVyZShzeW1ib2wudmFsdWVEZWNsYXJhdGlvbikgfHxcbiAgICAgICAgICAgICB0cy5pc0Z1bmN0aW9uRGVjbGFyYXRpb24oc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pKSAmJlxuICAgICAgICAgICAgc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24ubmFtZSkge1xuICAgICAgICAgIGNvbnN0IHBhcmVudE5hbWUgPSB0cy5pc0ludGVyZmFjZURlY2xhcmF0aW9uKHBhcmVudE5vZGUpID8gcGFyZW50Tm9kZS5uYW1lLnRleHQgOiBudWxsO1xuICAgICAgICAgIGNvbnN0IGNhbGxOYW1lID0gZ2V0UHJvcGVydHlOYW1lVGV4dChzeW1ib2wudmFsdWVEZWNsYXJhdGlvbi5uYW1lKTtcbiAgICAgICAgICBpZiAoQVNZTkNfRVhURVJOQUxfQ0FMTFMuc29tZShcbiAgICAgICAgICAgICAgICAgIGMgPT5cbiAgICAgICAgICAgICAgICAgICAgICAoYy5uYW1lID09PSBjYWxsTmFtZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAoYy5wYXJlbnQuaW5kZXhPZihwYXJlbnROYW1lKSAhPT0gLTEgfHwgYy5wYXJlbnQuaW5kZXhPZignKicpICE9PSAtMSkpKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGp1bXBFeHAuYXJndW1lbnRzIS5mb3JFYWNoKChub2RlOiB0cy5Ob2RlKSA9PiB7XG4gICAgICBub2RlID0gdGhpcy5fcmVzb2x2ZURlY2xhcmF0aW9uT2ZOb2RlKG5vZGUpO1xuXG4gICAgICBpZiAodHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGUpICYmIG5vZGUuaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUuaW5pdGlhbGl6ZXI7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0Z1bmN0aW9uTGlrZURlY2xhcmF0aW9uKG5vZGUpICYmICEhbm9kZS5ib2R5KSB7XG4gICAgICAgIHRoaXMuYW1iaWd1b3VzTm9kZVF1ZXVlLnB1c2gobm9kZS5ib2R5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyBhIGdpdmVuIG5vZGUgZnJvbSB0aGUgY29udGV4dC4gSW4gY2FzZSB0aGUgbm9kZSBpcyBub3QgbWFwcGVkIGluXG4gICAqIHRoZSBjb250ZXh0LCB0aGUgb3JpZ2luYWwgbm9kZSBpcyByZXR1cm5lZC5cbiAgICovXG4gIHByaXZhdGUgX3Jlc29sdmVOb2RlRnJvbUNvbnRleHQobm9kZTogdHMuTm9kZSk6IHRzLk5vZGUge1xuICAgIGlmICh0aGlzLmNvbnRleHQuaGFzKG5vZGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb250ZXh0LmdldChub2RlKSE7XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIGNvbnRleHQgdG8gcmVmbGVjdCB0aGUgbmV3bHkgc2V0IHBhcmFtZXRlciB2YWx1ZXMuIFRoaXMgYWxsb3dzIGZ1dHVyZVxuICAgKiByZWZlcmVuY2VzIHRvIGZ1bmN0aW9uIHBhcmFtZXRlcnMgdG8gYmUgcmVzb2x2ZWQgdG8gdGhlIGFjdHVhbCBub2RlIHRocm91Z2ggdGhlIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVDb250ZXh0KFxuICAgICAgY2FsbEFyZ3M6IHRzLk5vZGVBcnJheTx0cy5FeHByZXNzaW9uPiwgcGFyYW1ldGVyczogdHMuTm9kZUFycmF5PHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uPikge1xuICAgIHBhcmFtZXRlcnMuZm9yRWFjaCgocGFyYW1ldGVyLCBpbmRleCkgPT4ge1xuICAgICAgbGV0IGFyZ3VtZW50Tm9kZTogdHMuTm9kZSA9IGNhbGxBcmdzW2luZGV4XTtcblxuICAgICAgaWYgKCFhcmd1bWVudE5vZGUpIHtcbiAgICAgICAgaWYgKCFwYXJhbWV0ZXIuaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcmd1bWVudCBjYW4gYmUgdW5kZWZpbmVkIGluIGNhc2UgdGhlIGZ1bmN0aW9uIHBhcmFtZXRlciBoYXMgYSBkZWZhdWx0XG4gICAgICAgIC8vIHZhbHVlLiBJbiB0aGF0IGNhc2Ugd2Ugd2FudCB0byBzdG9yZSB0aGUgcGFyYW1ldGVyIGRlZmF1bHQgdmFsdWUgaW4gdGhlIGNvbnRleHQuXG4gICAgICAgIGFyZ3VtZW50Tm9kZSA9IHBhcmFtZXRlci5pbml0aWFsaXplcjtcbiAgICAgIH1cblxuICAgICAgaWYgKHRzLmlzSWRlbnRpZmllcihhcmd1bWVudE5vZGUpKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5zZXQocGFyYW1ldGVyLCB0aGlzLl9yZXNvbHZlRGVjbGFyYXRpb25PZk5vZGUoYXJndW1lbnROb2RlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNvbnRleHQuc2V0KHBhcmFtZXRlciwgYXJndW1lbnROb2RlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyB0aGUgZGVjbGFyYXRpb24gb2YgYSBnaXZlbiBUeXBlU2NyaXB0IG5vZGUuIEZvciBleGFtcGxlIGFuIGlkZW50aWZpZXIgY2FuXG4gICAqIHJlZmVyIHRvIGEgZnVuY3Rpb24gcGFyYW1ldGVyLiBUaGlzIHBhcmFtZXRlciBjYW4gdGhlbiBiZSByZXNvbHZlZCB0aHJvdWdoIHRoZVxuICAgKiBmdW5jdGlvbiBjb250ZXh0LlxuICAgKi9cbiAgcHJpdmF0ZSBfcmVzb2x2ZURlY2xhcmF0aW9uT2ZOb2RlKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlIHtcbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXREZWNsYXJhdGlvblN5bWJvbE9mTm9kZShub2RlKTtcblxuICAgIGlmICghc3ltYm9sIHx8ICFzeW1ib2wudmFsdWVEZWNsYXJhdGlvbikge1xuICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3Jlc29sdmVOb2RlRnJvbUNvbnRleHQoc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGRlY2xhcmF0aW9uIHN5bWJvbCBvZiBhIGdpdmVuIFR5cGVTY3JpcHQgbm9kZS4gUmVzb2x2ZXMgYWxpYXNlZFxuICAgKiBzeW1ib2xzIHRvIHRoZSBzeW1ib2wgY29udGFpbmluZyB0aGUgdmFsdWUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9nZXREZWNsYXJhdGlvblN5bWJvbE9mTm9kZShub2RlOiB0cy5Ob2RlKTogdHMuU3ltYm9sfG51bGwge1xuICAgIGxldCBzeW1ib2wgPSB0aGlzLnR5cGVDaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obm9kZSk7XG5cbiAgICBpZiAoIXN5bWJvbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUmVzb2x2ZSB0aGUgc3ltYm9sIHRvIGl0J3Mgb3JpZ2luYWwgZGVjbGFyYXRpb24gc3ltYm9sLlxuICAgIHdoaWxlIChzeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgc3ltYm9sID0gdGhpcy50eXBlQ2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHN5bWJvbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN5bWJvbDtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBzeW1ib2wgb2YgdGhlIGdpdmVuIHByb3BlcnR5IGFjY2VzcyBleHByZXNzaW9uLiAqL1xuICBwcml2YXRlIF9nZXRQcm9wZXJ0eUFjY2Vzc1N5bWJvbChub2RlOiB0cy5Qcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24pOiB0cy5TeW1ib2x8bnVsbCB7XG4gICAgbGV0IHByb3BlcnR5U3ltYm9sID0gdGhpcy5fZ2V0RGVjbGFyYXRpb25TeW1ib2xPZk5vZGUobm9kZS5uYW1lKTtcblxuICAgIGlmICghcHJvcGVydHlTeW1ib2wgfHwgIXByb3BlcnR5U3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5jb250ZXh0Lmhhcyhwcm9wZXJ0eVN5bWJvbC52YWx1ZURlY2xhcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHByb3BlcnR5U3ltYm9sO1xuICAgIH1cblxuICAgIC8vIEluIGNhc2UgdGhlIGNvbnRleHQgaGFzIHRoZSB2YWx1ZSBkZWNsYXJhdGlvbiBvZiB0aGUgZ2l2ZW4gcHJvcGVydHkgYWNjZXNzXG4gICAgLy8gbmFtZSBpZGVudGlmaWVyLCB3ZSBuZWVkIHRvIHJlcGxhY2UgdGhlIFwicHJvcGVydHlTeW1ib2xcIiB3aXRoIHRoZSBzeW1ib2xcbiAgICAvLyByZWZlcnJpbmcgdG8gdGhlIHJlc29sdmVkIHN5bWJvbCBiYXNlZCBvbiB0aGUgY29udGV4dC4gZS5nLiBhYnN0cmFjdCBwcm9wZXJ0aWVzXG4gICAgLy8gY2FuIHVsdGltYXRlbHkgcmVzb2x2ZSBpbnRvIGFuIGFjY2Vzc29yIGRlY2xhcmF0aW9uIGJhc2VkIG9uIHRoZSBpbXBsZW1lbnRhdGlvbi5cbiAgICBjb25zdCBjb250ZXh0Tm9kZSA9IHRoaXMuX3Jlc29sdmVOb2RlRnJvbUNvbnRleHQocHJvcGVydHlTeW1ib2wudmFsdWVEZWNsYXJhdGlvbik7XG5cbiAgICBpZiAoIXRzLmlzQWNjZXNzb3IoY29udGV4dE5vZGUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIHRoZSBzeW1ib2wgcmVmZXJyaW5nIHRvIHRoZSBcImFjY2Vzc29yXCIgdXNpbmcgdGhlIG5hbWUgaWRlbnRpZmllclxuICAgIC8vIG9mIHRoZSBhY2Nlc3NvciBkZWNsYXJhdGlvbi5cbiAgICByZXR1cm4gdGhpcy5fZ2V0RGVjbGFyYXRpb25TeW1ib2xPZk5vZGUoY29udGV4dE5vZGUubmFtZSk7XG4gIH1cbn1cbiJdfQ==