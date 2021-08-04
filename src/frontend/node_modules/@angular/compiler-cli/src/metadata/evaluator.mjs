/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isMetadataError, isMetadataGlobalReferenceExpression, isMetadataImportDefaultReference, isMetadataImportedSymbolReferenceExpression, isMetadataModuleReferenceExpression, isMetadataSymbolicReferenceExpression, isMetadataSymbolicSpreadExpression } from './schema';
// In TypeScript 2.1 the spread element kind was renamed.
const spreadElementSyntaxKind = ts.SyntaxKind.SpreadElement || ts.SyntaxKind.SpreadElementExpression;
function isMethodCallOf(callExpression, memberName) {
    const expression = callExpression.expression;
    if (expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const propertyAccessExpression = expression;
        const name = propertyAccessExpression.name;
        if (name.kind == ts.SyntaxKind.Identifier) {
            return name.text === memberName;
        }
    }
    return false;
}
function isCallOf(callExpression, ident) {
    const expression = callExpression.expression;
    if (expression.kind === ts.SyntaxKind.Identifier) {
        const identifier = expression;
        return identifier.text === ident;
    }
    return false;
}
/* @internal */
export function recordMapEntry(entry, node, nodeMap, sourceFile) {
    if (!nodeMap.has(entry)) {
        nodeMap.set(entry, node);
        if (node &&
            (isMetadataImportedSymbolReferenceExpression(entry) ||
                isMetadataImportDefaultReference(entry)) &&
            entry.line == null) {
            const info = sourceInfo(node, sourceFile);
            if (info.line != null)
                entry.line = info.line;
            if (info.character != null)
                entry.character = info.character;
        }
    }
    return entry;
}
/**
 * ts.forEachChild stops iterating children when the callback return a truthy value.
 * This method inverts this to implement an `every` style iterator. It will return
 * true if every call to `cb` returns `true`.
 */
function everyNodeChild(node, cb) {
    return !ts.forEachChild(node, node => !cb(node));
}
export function isPrimitive(value) {
    return Object(value) !== value;
}
function isDefined(obj) {
    return obj !== undefined;
}
function getSourceFileOfNode(node) {
    while (node && node.kind != ts.SyntaxKind.SourceFile) {
        node = node.parent;
    }
    return node;
}
/* @internal */
export function sourceInfo(node, sourceFile) {
    if (node) {
        sourceFile = sourceFile || getSourceFileOfNode(node);
        if (sourceFile) {
            return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        }
    }
    return {};
}
/* @internal */
export function errorSymbol(message, node, context, sourceFile) {
    const result = Object.assign({ __symbolic: 'error', message }, sourceInfo(node, sourceFile));
    if (context) {
        result.context = context;
    }
    return result;
}
/**
 * Produce a symbolic representation of an expression folding values into their final value when
 * possible.
 */
export class Evaluator {
    constructor(symbols, nodeMap, options = {}, recordExport) {
        this.symbols = symbols;
        this.nodeMap = nodeMap;
        this.options = options;
        this.recordExport = recordExport;
    }
    nameOf(node) {
        if (node && node.kind == ts.SyntaxKind.Identifier) {
            return node.text;
        }
        const result = node && this.evaluateNode(node);
        if (isMetadataError(result) || typeof result === 'string') {
            return result;
        }
        else {
            return errorSymbol('Name expected', node, { received: (node && node.getText()) || '<missing>' });
        }
    }
    /**
     * Returns true if the expression represented by `node` can be folded into a literal expression.
     *
     * For example, a literal is always foldable. This means that literal expressions such as `1.2`
     * `"Some value"` `true` `false` are foldable.
     *
     * - An object literal is foldable if all the properties in the literal are foldable.
     * - An array literal is foldable if all the elements are foldable.
     * - A call is foldable if it is a call to a Array.prototype.concat or a call to CONST_EXPR.
     * - A property access is foldable if the object is foldable.
     * - A array index is foldable if index expression is foldable and the array is foldable.
     * - Binary operator expressions are foldable if the left and right expressions are foldable and
     *   it is one of '+', '-', '*', '/', '%', '||', and '&&'.
     * - An identifier is foldable if a value can be found for its symbol in the evaluator symbol
     *   table.
     */
    isFoldable(node) {
        return this.isFoldableWorker(node, new Map());
    }
    isFoldableWorker(node, folding) {
        if (node) {
            switch (node.kind) {
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return everyNodeChild(node, child => {
                        if (child.kind === ts.SyntaxKind.PropertyAssignment) {
                            const propertyAssignment = child;
                            return this.isFoldableWorker(propertyAssignment.initializer, folding);
                        }
                        return false;
                    });
                case ts.SyntaxKind.ArrayLiteralExpression:
                    return everyNodeChild(node, child => this.isFoldableWorker(child, folding));
                case ts.SyntaxKind.CallExpression:
                    const callExpression = node;
                    // We can fold a <array>.concat(<v>).
                    if (isMethodCallOf(callExpression, 'concat') &&
                        arrayOrEmpty(callExpression.arguments).length === 1) {
                        const arrayNode = callExpression.expression.expression;
                        if (this.isFoldableWorker(arrayNode, folding) &&
                            this.isFoldableWorker(callExpression.arguments[0], folding)) {
                            // It needs to be an array.
                            const arrayValue = this.evaluateNode(arrayNode);
                            if (arrayValue && Array.isArray(arrayValue)) {
                                return true;
                            }
                        }
                    }
                    // We can fold a call to CONST_EXPR
                    if (isCallOf(callExpression, 'CONST_EXPR') &&
                        arrayOrEmpty(callExpression.arguments).length === 1)
                        return this.isFoldableWorker(callExpression.arguments[0], folding);
                    return false;
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.NumericLiteral:
                case ts.SyntaxKind.NullKeyword:
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.FalseKeyword:
                case ts.SyntaxKind.TemplateHead:
                case ts.SyntaxKind.TemplateMiddle:
                case ts.SyntaxKind.TemplateTail:
                    return true;
                case ts.SyntaxKind.ParenthesizedExpression:
                    const parenthesizedExpression = node;
                    return this.isFoldableWorker(parenthesizedExpression.expression, folding);
                case ts.SyntaxKind.BinaryExpression:
                    const binaryExpression = node;
                    switch (binaryExpression.operatorToken.kind) {
                        case ts.SyntaxKind.PlusToken:
                        case ts.SyntaxKind.MinusToken:
                        case ts.SyntaxKind.AsteriskToken:
                        case ts.SyntaxKind.SlashToken:
                        case ts.SyntaxKind.PercentToken:
                        case ts.SyntaxKind.AmpersandAmpersandToken:
                        case ts.SyntaxKind.BarBarToken:
                            return this.isFoldableWorker(binaryExpression.left, folding) &&
                                this.isFoldableWorker(binaryExpression.right, folding);
                        default:
                            return false;
                    }
                case ts.SyntaxKind.PropertyAccessExpression:
                    const propertyAccessExpression = node;
                    return this.isFoldableWorker(propertyAccessExpression.expression, folding);
                case ts.SyntaxKind.ElementAccessExpression:
                    const elementAccessExpression = node;
                    return this.isFoldableWorker(elementAccessExpression.expression, folding) &&
                        this.isFoldableWorker(elementAccessExpression.argumentExpression, folding);
                case ts.SyntaxKind.Identifier:
                    let identifier = node;
                    let reference = this.symbols.resolve(identifier.text);
                    if (reference !== undefined && isPrimitive(reference)) {
                        return true;
                    }
                    break;
                case ts.SyntaxKind.TemplateExpression:
                    const templateExpression = node;
                    return templateExpression.templateSpans.every(span => this.isFoldableWorker(span.expression, folding));
            }
        }
        return false;
    }
    /**
     * Produce a JSON serialiable object representing `node`. The foldable values in the expression
     * tree are folded. For example, a node representing `1 + 2` is folded into `3`.
     */
    evaluateNode(node, preferReference) {
        const t = this;
        let error;
        function recordEntry(entry, node) {
            if (t.options.substituteExpression) {
                const newEntry = t.options.substituteExpression(entry, node);
                if (t.recordExport && newEntry != entry && isMetadataGlobalReferenceExpression(newEntry)) {
                    t.recordExport(newEntry.name, entry);
                }
                entry = newEntry;
            }
            return recordMapEntry(entry, node, t.nodeMap);
        }
        function isFoldableError(value) {
            return !t.options.verboseInvalidExpression && isMetadataError(value);
        }
        const resolveName = (name, preferReference) => {
            const reference = this.symbols.resolve(name, preferReference);
            if (reference === undefined) {
                // Encode as a global reference. StaticReflector will check the reference.
                return recordEntry({ __symbolic: 'reference', name }, node);
            }
            if (reference && isMetadataSymbolicReferenceExpression(reference)) {
                return recordEntry(Object.assign({}, reference), node);
            }
            return reference;
        };
        switch (node.kind) {
            case ts.SyntaxKind.ObjectLiteralExpression:
                let obj = {};
                let quoted = [];
                ts.forEachChild(node, child => {
                    switch (child.kind) {
                        case ts.SyntaxKind.ShorthandPropertyAssignment:
                        case ts.SyntaxKind.PropertyAssignment:
                            const assignment = child;
                            if (assignment.name.kind == ts.SyntaxKind.StringLiteral) {
                                const name = assignment.name.text;
                                quoted.push(name);
                            }
                            const propertyName = this.nameOf(assignment.name);
                            if (isFoldableError(propertyName)) {
                                error = propertyName;
                                return true;
                            }
                            const propertyValue = isPropertyAssignment(assignment) ?
                                this.evaluateNode(assignment.initializer, /* preferReference */ true) :
                                resolveName(propertyName, /* preferReference */ true);
                            if (isFoldableError(propertyValue)) {
                                error = propertyValue;
                                return true; // Stop the forEachChild.
                            }
                            else {
                                obj[propertyName] = isPropertyAssignment(assignment) ?
                                    recordEntry(propertyValue, assignment.initializer) :
                                    propertyValue;
                            }
                    }
                });
                if (error)
                    return error;
                if (this.options.quotedNames && quoted.length) {
                    obj['$quoted$'] = quoted;
                }
                return recordEntry(obj, node);
            case ts.SyntaxKind.ArrayLiteralExpression:
                let arr = [];
                ts.forEachChild(node, child => {
                    const value = this.evaluateNode(child, /* preferReference */ true);
                    // Check for error
                    if (isFoldableError(value)) {
                        error = value;
                        return true; // Stop the forEachChild.
                    }
                    // Handle spread expressions
                    if (isMetadataSymbolicSpreadExpression(value)) {
                        if (Array.isArray(value.expression)) {
                            for (const spreadValue of value.expression) {
                                arr.push(spreadValue);
                            }
                            return;
                        }
                    }
                    arr.push(value);
                });
                if (error)
                    return error;
                return recordEntry(arr, node);
            case spreadElementSyntaxKind:
                let spreadExpression = this.evaluateNode(node.expression);
                return recordEntry({ __symbolic: 'spread', expression: spreadExpression }, node);
            case ts.SyntaxKind.CallExpression:
                const callExpression = node;
                if (isCallOf(callExpression, 'forwardRef') &&
                    arrayOrEmpty(callExpression.arguments).length === 1) {
                    const firstArgument = callExpression.arguments[0];
                    if (firstArgument.kind == ts.SyntaxKind.ArrowFunction) {
                        const arrowFunction = firstArgument;
                        return recordEntry(this.evaluateNode(arrowFunction.body), node);
                    }
                }
                const args = arrayOrEmpty(callExpression.arguments).map(arg => this.evaluateNode(arg));
                if (this.isFoldable(callExpression)) {
                    if (isMethodCallOf(callExpression, 'concat')) {
                        const arrayValue = this.evaluateNode(callExpression.expression.expression);
                        if (isFoldableError(arrayValue))
                            return arrayValue;
                        return arrayValue.concat(args[0]);
                    }
                }
                // Always fold a CONST_EXPR even if the argument is not foldable.
                if (isCallOf(callExpression, 'CONST_EXPR') &&
                    arrayOrEmpty(callExpression.arguments).length === 1) {
                    return recordEntry(args[0], node);
                }
                const expression = this.evaluateNode(callExpression.expression);
                if (isFoldableError(expression)) {
                    return recordEntry(expression, node);
                }
                let result = { __symbolic: 'call', expression: expression };
                if (args && args.length) {
                    result.arguments = args;
                }
                return recordEntry(result, node);
            case ts.SyntaxKind.NewExpression:
                const newExpression = node;
                const newArgs = arrayOrEmpty(newExpression.arguments).map(arg => this.evaluateNode(arg));
                const newTarget = this.evaluateNode(newExpression.expression);
                if (isMetadataError(newTarget)) {
                    return recordEntry(newTarget, node);
                }
                const call = { __symbolic: 'new', expression: newTarget };
                if (newArgs.length) {
                    call.arguments = newArgs;
                }
                return recordEntry(call, node);
            case ts.SyntaxKind.PropertyAccessExpression: {
                const propertyAccessExpression = node;
                const expression = this.evaluateNode(propertyAccessExpression.expression);
                if (isFoldableError(expression)) {
                    return recordEntry(expression, node);
                }
                const member = this.nameOf(propertyAccessExpression.name);
                if (isFoldableError(member)) {
                    return recordEntry(member, node);
                }
                if (expression && this.isFoldable(propertyAccessExpression.expression))
                    return expression[member];
                if (isMetadataModuleReferenceExpression(expression)) {
                    // A select into a module reference and be converted into a reference to the symbol
                    // in the module
                    return recordEntry({ __symbolic: 'reference', module: expression.module, name: member }, node);
                }
                return recordEntry({ __symbolic: 'select', expression, member }, node);
            }
            case ts.SyntaxKind.ElementAccessExpression: {
                const elementAccessExpression = node;
                const expression = this.evaluateNode(elementAccessExpression.expression);
                if (isFoldableError(expression)) {
                    return recordEntry(expression, node);
                }
                if (!elementAccessExpression.argumentExpression) {
                    return recordEntry(errorSymbol('Expression form not supported', node), node);
                }
                const index = this.evaluateNode(elementAccessExpression.argumentExpression);
                if (isFoldableError(expression)) {
                    return recordEntry(expression, node);
                }
                if (this.isFoldable(elementAccessExpression.expression) &&
                    this.isFoldable(elementAccessExpression.argumentExpression))
                    return expression[index];
                return recordEntry({ __symbolic: 'index', expression, index }, node);
            }
            case ts.SyntaxKind.Identifier:
                const identifier = node;
                const name = identifier.text;
                return resolveName(name, preferReference);
            case ts.SyntaxKind.TypeReference:
                const typeReferenceNode = node;
                const typeNameNode = typeReferenceNode.typeName;
                const getReference = node => {
                    if (typeNameNode.kind === ts.SyntaxKind.QualifiedName) {
                        const qualifiedName = node;
                        const left = this.evaluateNode(qualifiedName.left);
                        if (isMetadataModuleReferenceExpression(left)) {
                            return recordEntry({
                                __symbolic: 'reference',
                                module: left.module,
                                name: qualifiedName.right.text
                            }, node);
                        }
                        // Record a type reference to a declared type as a select.
                        return { __symbolic: 'select', expression: left, member: qualifiedName.right.text };
                    }
                    else {
                        const identifier = typeNameNode;
                        const symbol = this.symbols.resolve(identifier.text);
                        if (isFoldableError(symbol) || isMetadataSymbolicReferenceExpression(symbol)) {
                            return recordEntry(symbol, node);
                        }
                        return recordEntry(errorSymbol('Could not resolve type', node, { typeName: identifier.text }), node);
                    }
                };
                const typeReference = getReference(typeNameNode);
                if (isFoldableError(typeReference)) {
                    return recordEntry(typeReference, node);
                }
                if (!isMetadataModuleReferenceExpression(typeReference) &&
                    typeReferenceNode.typeArguments && typeReferenceNode.typeArguments.length) {
                    const args = typeReferenceNode.typeArguments.map(element => this.evaluateNode(element));
                    // TODO: Remove typecast when upgraded to 2.0 as it will be correctly inferred.
                    // Some versions of 1.9 do not infer this correctly.
                    typeReference.arguments = args;
                }
                return recordEntry(typeReference, node);
            case ts.SyntaxKind.UnionType:
                const unionType = node;
                // Remove null and undefined from the list of unions.
                const references = unionType.types
                    .filter(n => n.kind !== ts.SyntaxKind.UndefinedKeyword &&
                    !(ts.isLiteralTypeNode(n) && n.literal.kind === ts.SyntaxKind.NullKeyword))
                    .map(n => this.evaluateNode(n));
                // The remmaining reference must be the same. If two have type arguments consider them
                // different even if the type arguments are the same.
                let candidate = null;
                for (let i = 0; i < references.length; i++) {
                    const reference = references[i];
                    if (isMetadataSymbolicReferenceExpression(reference)) {
                        if (candidate) {
                            if (reference.name == candidate.name &&
                                reference.module == candidate.module && !reference.arguments) {
                                candidate = reference;
                            }
                        }
                        else {
                            candidate = reference;
                        }
                    }
                    else {
                        return reference;
                    }
                }
                if (candidate)
                    return candidate;
                break;
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.TemplateHead:
            case ts.SyntaxKind.TemplateTail:
            case ts.SyntaxKind.TemplateMiddle:
                return node.text;
            case ts.SyntaxKind.NumericLiteral:
                return parseFloat(node.text);
            case ts.SyntaxKind.AnyKeyword:
                return recordEntry({ __symbolic: 'reference', name: 'any' }, node);
            case ts.SyntaxKind.StringKeyword:
                return recordEntry({ __symbolic: 'reference', name: 'string' }, node);
            case ts.SyntaxKind.NumberKeyword:
                return recordEntry({ __symbolic: 'reference', name: 'number' }, node);
            case ts.SyntaxKind.BooleanKeyword:
                return recordEntry({ __symbolic: 'reference', name: 'boolean' }, node);
            case ts.SyntaxKind.ArrayType:
                const arrayTypeNode = node;
                return recordEntry({
                    __symbolic: 'reference',
                    name: 'Array',
                    arguments: [this.evaluateNode(arrayTypeNode.elementType)]
                }, node);
            case ts.SyntaxKind.NullKeyword:
                return null;
            case ts.SyntaxKind.TrueKeyword:
                return true;
            case ts.SyntaxKind.FalseKeyword:
                return false;
            case ts.SyntaxKind.ParenthesizedExpression:
                const parenthesizedExpression = node;
                return this.evaluateNode(parenthesizedExpression.expression);
            case ts.SyntaxKind.TypeAssertionExpression:
                const typeAssertion = node;
                return this.evaluateNode(typeAssertion.expression);
            case ts.SyntaxKind.PrefixUnaryExpression:
                const prefixUnaryExpression = node;
                const operand = this.evaluateNode(prefixUnaryExpression.operand);
                if (isDefined(operand) && isPrimitive(operand)) {
                    switch (prefixUnaryExpression.operator) {
                        case ts.SyntaxKind.PlusToken:
                            return +operand;
                        case ts.SyntaxKind.MinusToken:
                            return -operand;
                        case ts.SyntaxKind.TildeToken:
                            return ~operand;
                        case ts.SyntaxKind.ExclamationToken:
                            return !operand;
                    }
                }
                let operatorText;
                switch (prefixUnaryExpression.operator) {
                    case ts.SyntaxKind.PlusToken:
                        operatorText = '+';
                        break;
                    case ts.SyntaxKind.MinusToken:
                        operatorText = '-';
                        break;
                    case ts.SyntaxKind.TildeToken:
                        operatorText = '~';
                        break;
                    case ts.SyntaxKind.ExclamationToken:
                        operatorText = '!';
                        break;
                    default:
                        return undefined;
                }
                return recordEntry({ __symbolic: 'pre', operator: operatorText, operand: operand }, node);
            case ts.SyntaxKind.BinaryExpression:
                const binaryExpression = node;
                const left = this.evaluateNode(binaryExpression.left);
                const right = this.evaluateNode(binaryExpression.right);
                if (isDefined(left) && isDefined(right)) {
                    if (isPrimitive(left) && isPrimitive(right))
                        switch (binaryExpression.operatorToken.kind) {
                            case ts.SyntaxKind.BarBarToken:
                                return left || right;
                            case ts.SyntaxKind.AmpersandAmpersandToken:
                                return left && right;
                            case ts.SyntaxKind.AmpersandToken:
                                return left & right;
                            case ts.SyntaxKind.BarToken:
                                return left | right;
                            case ts.SyntaxKind.CaretToken:
                                return left ^ right;
                            case ts.SyntaxKind.EqualsEqualsToken:
                                return left == right;
                            case ts.SyntaxKind.ExclamationEqualsToken:
                                return left != right;
                            case ts.SyntaxKind.EqualsEqualsEqualsToken:
                                return left === right;
                            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                                return left !== right;
                            case ts.SyntaxKind.LessThanToken:
                                return left < right;
                            case ts.SyntaxKind.GreaterThanToken:
                                return left > right;
                            case ts.SyntaxKind.LessThanEqualsToken:
                                return left <= right;
                            case ts.SyntaxKind.GreaterThanEqualsToken:
                                return left >= right;
                            case ts.SyntaxKind.LessThanLessThanToken:
                                return left << right;
                            case ts.SyntaxKind.GreaterThanGreaterThanToken:
                                return left >> right;
                            case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                                return left >>> right;
                            case ts.SyntaxKind.PlusToken:
                                return left + right;
                            case ts.SyntaxKind.MinusToken:
                                return left - right;
                            case ts.SyntaxKind.AsteriskToken:
                                return left * right;
                            case ts.SyntaxKind.SlashToken:
                                return left / right;
                            case ts.SyntaxKind.PercentToken:
                                return left % right;
                        }
                    return recordEntry({
                        __symbolic: 'binop',
                        operator: binaryExpression.operatorToken.getText(),
                        left: left,
                        right: right
                    }, node);
                }
                break;
            case ts.SyntaxKind.ConditionalExpression:
                const conditionalExpression = node;
                const condition = this.evaluateNode(conditionalExpression.condition);
                const thenExpression = this.evaluateNode(conditionalExpression.whenTrue);
                const elseExpression = this.evaluateNode(conditionalExpression.whenFalse);
                if (isPrimitive(condition)) {
                    return condition ? thenExpression : elseExpression;
                }
                return recordEntry({ __symbolic: 'if', condition, thenExpression, elseExpression }, node);
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
                return recordEntry(errorSymbol('Lambda not supported', node), node);
            case ts.SyntaxKind.TaggedTemplateExpression:
                return recordEntry(errorSymbol('Tagged template expressions are not supported in metadata', node), node);
            case ts.SyntaxKind.TemplateExpression:
                const templateExpression = node;
                if (this.isFoldable(node)) {
                    return templateExpression.templateSpans.reduce((previous, current) => previous + this.evaluateNode(current.expression) +
                        this.evaluateNode(current.literal), this.evaluateNode(templateExpression.head));
                }
                else {
                    return templateExpression.templateSpans.reduce((previous, current) => {
                        const expr = this.evaluateNode(current.expression);
                        const literal = this.evaluateNode(current.literal);
                        if (isFoldableError(expr))
                            return expr;
                        if (isFoldableError(literal))
                            return literal;
                        if (typeof previous === 'string' && typeof expr === 'string' &&
                            typeof literal === 'string') {
                            return previous + expr + literal;
                        }
                        let result = expr;
                        if (previous !== '') {
                            result = { __symbolic: 'binop', operator: '+', left: previous, right: expr };
                        }
                        if (literal != '') {
                            result = { __symbolic: 'binop', operator: '+', left: result, right: literal };
                        }
                        return result;
                    }, this.evaluateNode(templateExpression.head));
                }
            case ts.SyntaxKind.AsExpression:
                const asExpression = node;
                return this.evaluateNode(asExpression.expression);
            case ts.SyntaxKind.ClassExpression:
                return { __symbolic: 'class' };
        }
        return recordEntry(errorSymbol('Expression form not supported', node), node);
    }
}
function isPropertyAssignment(node) {
    return node.kind == ts.SyntaxKind.PropertyAssignment;
}
const empty = ts.createNodeArray();
function arrayOrEmpty(v) {
    return v || empty;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZhbHVhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9tZXRhZGF0YS9ldmFsdWF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFHakMsT0FBTyxFQUFxRCxlQUFlLEVBQUUsbUNBQW1DLEVBQUUsZ0NBQWdDLEVBQUUsMkNBQTJDLEVBQUUsbUNBQW1DLEVBQUUscUNBQXFDLEVBQUUsa0NBQWtDLEVBQXFKLE1BQU0sVUFBVSxDQUFDO0FBS3JkLHlEQUF5RDtBQUN6RCxNQUFNLHVCQUF1QixHQUN4QixFQUFFLENBQUMsVUFBa0IsQ0FBQyxhQUFhLElBQUssRUFBRSxDQUFDLFVBQWtCLENBQUMsdUJBQXVCLENBQUM7QUFFM0YsU0FBUyxjQUFjLENBQUMsY0FBaUMsRUFBRSxVQUFrQjtJQUMzRSxNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsVUFBVSxDQUFDO0lBQzdDLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLHdCQUF3QixFQUFFO1FBQzlELE1BQU0sd0JBQXdCLEdBQWdDLFVBQVUsQ0FBQztRQUN6RSxNQUFNLElBQUksR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLENBQUM7UUFDM0MsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLENBQUM7U0FDakM7S0FDRjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLGNBQWlDLEVBQUUsS0FBYTtJQUNoRSxNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsVUFBVSxDQUFDO0lBQzdDLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxFQUFFLENB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QVUsQ0FBQyxlQUFlO2dCQUNoQyxPQUFPLEVBQUMsVUFBVSxFQUFFLE9BQU8sRUFBQyxDQUFDO1NBQ2hDO1FBQ0QsT0FBTyxXQUFXLENBQUMsV0FBVyxDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9FLENBQUM7Q0FDRjtBQUVELFNBQVMsb0JBQW9CLENBQUMsSUFBYTtJQUN6QyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQztBQUN2RCxDQUFDO0FBRUQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLGVBQWUsRUFBTyxDQUFDO0FBRXhDLFNBQVMsWUFBWSxDQUFvQixDQUE0QjtJQUNuRSxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUM7QUFDcEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtDb2xsZWN0b3JPcHRpb25zfSBmcm9tICcuL2NvbGxlY3Rvcic7XG5pbXBvcnQge0NsYXNzTWV0YWRhdGEsIEZ1bmN0aW9uTWV0YWRhdGEsIEludGVyZmFjZU1ldGFkYXRhLCBpc01ldGFkYXRhRXJyb3IsIGlzTWV0YWRhdGFHbG9iYWxSZWZlcmVuY2VFeHByZXNzaW9uLCBpc01ldGFkYXRhSW1wb3J0RGVmYXVsdFJlZmVyZW5jZSwgaXNNZXRhZGF0YUltcG9ydGVkU3ltYm9sUmVmZXJlbmNlRXhwcmVzc2lvbiwgaXNNZXRhZGF0YU1vZHVsZVJlZmVyZW5jZUV4cHJlc3Npb24sIGlzTWV0YWRhdGFTeW1ib2xpY1JlZmVyZW5jZUV4cHJlc3Npb24sIGlzTWV0YWRhdGFTeW1ib2xpY1NwcmVhZEV4cHJlc3Npb24sIE1ldGFkYXRhRW50cnksIE1ldGFkYXRhRXJyb3IsIE1ldGFkYXRhSW1wb3J0ZWRTeW1ib2xSZWZlcmVuY2VFeHByZXNzaW9uLCBNZXRhZGF0YVNvdXJjZUxvY2F0aW9uSW5mbywgTWV0YWRhdGFTeW1ib2xpY0NhbGxFeHByZXNzaW9uLCBNZXRhZGF0YVZhbHVlfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQge1N5bWJvbHN9IGZyb20gJy4vc3ltYm9scyc7XG5cblxuXG4vLyBJbiBUeXBlU2NyaXB0IDIuMSB0aGUgc3ByZWFkIGVsZW1lbnQga2luZCB3YXMgcmVuYW1lZC5cbmNvbnN0IHNwcmVhZEVsZW1lbnRTeW50YXhLaW5kOiB0cy5TeW50YXhLaW5kID1cbiAgICAodHMuU3ludGF4S2luZCBhcyBhbnkpLlNwcmVhZEVsZW1lbnQgfHwgKHRzLlN5bnRheEtpbmQgYXMgYW55KS5TcHJlYWRFbGVtZW50RXhwcmVzc2lvbjtcblxuZnVuY3Rpb24gaXNNZXRob2RDYWxsT2YoY2FsbEV4cHJlc3Npb246IHRzLkNhbGxFeHByZXNzaW9uLCBtZW1iZXJOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IGNhbGxFeHByZXNzaW9uLmV4cHJlc3Npb247XG4gIGlmIChleHByZXNzaW9uLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKSB7XG4gICAgY29uc3QgcHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uID0gPHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbj5leHByZXNzaW9uO1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24ubmFtZTtcbiAgICBpZiAobmFtZS5raW5kID09IHRzLlN5bnRheEtpbmQuSWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG5hbWUudGV4dCA9PT0gbWVtYmVyTmFtZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBpc0NhbGxPZihjYWxsRXhwcmVzc2lvbjogdHMuQ2FsbEV4cHJlc3Npb24sIGlkZW50OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IGNhbGxFeHByZXNzaW9uLmV4cHJlc3Npb247XG4gIGlmIChleHByZXNzaW9uLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuSWRlbnRpZmllcikge1xuICAgIGNvbnN0IGlkZW50aWZpZXIgPSA8dHMuSWRlbnRpZmllcj5leHByZXNzaW9uO1xuICAgIHJldHVybiBpZGVudGlmaWVyLnRleHQgPT09IGlkZW50O1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb3JkTWFwRW50cnk8VCBleHRlbmRzIE1ldGFkYXRhRW50cnk+KFxuICAgIGVudHJ5OiBULCBub2RlOiB0cy5Ob2RlLFxuICAgIG5vZGVNYXA6IE1hcDxNZXRhZGF0YVZhbHVlfENsYXNzTWV0YWRhdGF8SW50ZXJmYWNlTWV0YWRhdGF8RnVuY3Rpb25NZXRhZGF0YSwgdHMuTm9kZT4sXG4gICAgc291cmNlRmlsZT86IHRzLlNvdXJjZUZpbGUpIHtcbiAgaWYgKCFub2RlTWFwLmhhcyhlbnRyeSkpIHtcbiAgICBub2RlTWFwLnNldChlbnRyeSwgbm9kZSk7XG4gICAgaWYgKG5vZGUgJiZcbiAgICAgICAgKGlzTWV0YWRhdGFJbXBvcnRlZFN5bWJvbFJlZmVyZW5jZUV4cHJlc3Npb24oZW50cnkpIHx8XG4gICAgICAgICBpc01ldGFkYXRhSW1wb3J0RGVmYXVsdFJlZmVyZW5jZShlbnRyeSkpICYmXG4gICAgICAgIGVudHJ5LmxpbmUgPT0gbnVsbCkge1xuICAgICAgY29uc3QgaW5mbyA9IHNvdXJjZUluZm8obm9kZSwgc291cmNlRmlsZSk7XG4gICAgICBpZiAoaW5mby5saW5lICE9IG51bGwpIGVudHJ5LmxpbmUgPSBpbmZvLmxpbmU7XG4gICAgICBpZiAoaW5mby5jaGFyYWN0ZXIgIT0gbnVsbCkgZW50cnkuY2hhcmFjdGVyID0gaW5mby5jaGFyYWN0ZXI7XG4gICAgfVxuICB9XG4gIHJldHVybiBlbnRyeTtcbn1cblxuLyoqXG4gKiB0cy5mb3JFYWNoQ2hpbGQgc3RvcHMgaXRlcmF0aW5nIGNoaWxkcmVuIHdoZW4gdGhlIGNhbGxiYWNrIHJldHVybiBhIHRydXRoeSB2YWx1ZS5cbiAqIFRoaXMgbWV0aG9kIGludmVydHMgdGhpcyB0byBpbXBsZW1lbnQgYW4gYGV2ZXJ5YCBzdHlsZSBpdGVyYXRvci4gSXQgd2lsbCByZXR1cm5cbiAqIHRydWUgaWYgZXZlcnkgY2FsbCB0byBgY2JgIHJldHVybnMgYHRydWVgLlxuICovXG5mdW5jdGlvbiBldmVyeU5vZGVDaGlsZChub2RlOiB0cy5Ob2RlLCBjYjogKG5vZGU6IHRzLk5vZGUpID0+IGJvb2xlYW4pIHtcbiAgcmV0dXJuICF0cy5mb3JFYWNoQ2hpbGQobm9kZSwgbm9kZSA9PiAhY2Iobm9kZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQcmltaXRpdmUodmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gT2JqZWN0KHZhbHVlKSAhPT0gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGlzRGVmaW5lZChvYmo6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gb2JqICE9PSB1bmRlZmluZWQ7XG59XG5cbi8vIGltcG9ydCB7cHJvcGVydHlOYW1lIGFzIG5hbWV9IGZyb20gJ3BsYWNlJ1xuLy8gaW1wb3J0IHtuYW1lfSBmcm9tICdwbGFjZSdcbmV4cG9ydCBpbnRlcmZhY2UgSW1wb3J0U3BlY2lmaWVyTWV0YWRhdGEge1xuICBuYW1lOiBzdHJpbmc7XG4gIHByb3BlcnR5TmFtZT86IHN0cmluZztcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSW1wb3J0TWV0YWRhdGEge1xuICBkZWZhdWx0TmFtZT86IHN0cmluZzsgICAgICAgICAgICAgICAgICAgICAgLy8gaW1wb3J0IGQgZnJvbSAncGxhY2UnXG4gIG5hbWVzcGFjZT86IHN0cmluZzsgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbXBvcnQgKiBhcyBkIGZyb20gJ3BsYWNlJ1xuICBuYW1lZEltcG9ydHM/OiBJbXBvcnRTcGVjaWZpZXJNZXRhZGF0YVtdOyAgLy8gaW1wb3J0IHthfSBmcm9tICdwbGFjZSdcbiAgZnJvbTogc3RyaW5nOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZyb20gJ3BsYWNlJ1xufVxuXG5cbmZ1bmN0aW9uIGdldFNvdXJjZUZpbGVPZk5vZGUobm9kZTogdHMuTm9kZXx1bmRlZmluZWQpOiB0cy5Tb3VyY2VGaWxlIHtcbiAgd2hpbGUgKG5vZGUgJiYgbm9kZS5raW5kICE9IHRzLlN5bnRheEtpbmQuU291cmNlRmlsZSkge1xuICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgfVxuICByZXR1cm4gPHRzLlNvdXJjZUZpbGU+bm9kZTtcbn1cblxuLyogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gc291cmNlSW5mbyhcbiAgICBub2RlOiB0cy5Ob2RlfHVuZGVmaW5lZCwgc291cmNlRmlsZTogdHMuU291cmNlRmlsZXx1bmRlZmluZWQpOiBNZXRhZGF0YVNvdXJjZUxvY2F0aW9uSW5mbyB7XG4gIGlmIChub2RlKSB7XG4gICAgc291cmNlRmlsZSA9IHNvdXJjZUZpbGUgfHwgZ2V0U291cmNlRmlsZU9mTm9kZShub2RlKTtcbiAgICBpZiAoc291cmNlRmlsZSkge1xuICAgICAgcmV0dXJuIHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKHNvdXJjZUZpbGUsIG5vZGUuZ2V0U3RhcnQoc291cmNlRmlsZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4ge307XG59XG5cbi8qIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVycm9yU3ltYm9sKFxuICAgIG1lc3NhZ2U6IHN0cmluZywgbm9kZT86IHRzLk5vZGUsIGNvbnRleHQ/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30sXG4gICAgc291cmNlRmlsZT86IHRzLlNvdXJjZUZpbGUpOiBNZXRhZGF0YUVycm9yIHtcbiAgY29uc3QgcmVzdWx0OiBNZXRhZGF0YUVycm9yID0ge19fc3ltYm9saWM6ICdlcnJvcicsIG1lc3NhZ2UsIC4uLnNvdXJjZUluZm8obm9kZSwgc291cmNlRmlsZSl9O1xuICBpZiAoY29udGV4dCkge1xuICAgIHJlc3VsdC5jb250ZXh0ID0gY29udGV4dDtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFByb2R1Y2UgYSBzeW1ib2xpYyByZXByZXNlbnRhdGlvbiBvZiBhbiBleHByZXNzaW9uIGZvbGRpbmcgdmFsdWVzIGludG8gdGhlaXIgZmluYWwgdmFsdWUgd2hlblxuICogcG9zc2libGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmFsdWF0b3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgc3ltYm9sczogU3ltYm9scywgcHJpdmF0ZSBub2RlTWFwOiBNYXA8TWV0YWRhdGFFbnRyeSwgdHMuTm9kZT4sXG4gICAgICBwcml2YXRlIG9wdGlvbnM6IENvbGxlY3Rvck9wdGlvbnMgPSB7fSxcbiAgICAgIHByaXZhdGUgcmVjb3JkRXhwb3J0PzogKG5hbWU6IHN0cmluZywgdmFsdWU6IE1ldGFkYXRhVmFsdWUpID0+IHZvaWQpIHt9XG5cbiAgbmFtZU9mKG5vZGU6IHRzLk5vZGV8dW5kZWZpbmVkKTogc3RyaW5nfE1ldGFkYXRhRXJyb3Ige1xuICAgIGlmIChub2RlICYmIG5vZGUua2luZCA9PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgIHJldHVybiAoPHRzLklkZW50aWZpZXI+bm9kZSkudGV4dDtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gbm9kZSAmJiB0aGlzLmV2YWx1YXRlTm9kZShub2RlKTtcbiAgICBpZiAoaXNNZXRhZGF0YUVycm9yKHJlc3VsdCkgfHwgdHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBlcnJvclN5bWJvbChcbiAgICAgICAgICAnTmFtZSBleHBlY3RlZCcsIG5vZGUsIHtyZWNlaXZlZDogKG5vZGUgJiYgbm9kZS5nZXRUZXh0KCkpIHx8ICc8bWlzc2luZz4nfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZXhwcmVzc2lvbiByZXByZXNlbnRlZCBieSBgbm9kZWAgY2FuIGJlIGZvbGRlZCBpbnRvIGEgbGl0ZXJhbCBleHByZXNzaW9uLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgYSBsaXRlcmFsIGlzIGFsd2F5cyBmb2xkYWJsZS4gVGhpcyBtZWFucyB0aGF0IGxpdGVyYWwgZXhwcmVzc2lvbnMgc3VjaCBhcyBgMS4yYFxuICAgKiBgXCJTb21lIHZhbHVlXCJgIGB0cnVlYCBgZmFsc2VgIGFyZSBmb2xkYWJsZS5cbiAgICpcbiAgICogLSBBbiBvYmplY3QgbGl0ZXJhbCBpcyBmb2xkYWJsZSBpZiBhbGwgdGhlIHByb3BlcnRpZXMgaW4gdGhlIGxpdGVyYWwgYXJlIGZvbGRhYmxlLlxuICAgKiAtIEFuIGFycmF5IGxpdGVyYWwgaXMgZm9sZGFibGUgaWYgYWxsIHRoZSBlbGVtZW50cyBhcmUgZm9sZGFibGUuXG4gICAqIC0gQSBjYWxsIGlzIGZvbGRhYmxlIGlmIGl0IGlzIGEgY2FsbCB0byBhIEFycmF5LnByb3RvdHlwZS5jb25jYXQgb3IgYSBjYWxsIHRvIENPTlNUX0VYUFIuXG4gICAqIC0gQSBwcm9wZXJ0eSBhY2Nlc3MgaXMgZm9sZGFibGUgaWYgdGhlIG9iamVjdCBpcyBmb2xkYWJsZS5cbiAgICogLSBBIGFycmF5IGluZGV4IGlzIGZvbGRhYmxlIGlmIGluZGV4IGV4cHJlc3Npb24gaXMgZm9sZGFibGUgYW5kIHRoZSBhcnJheSBpcyBmb2xkYWJsZS5cbiAgICogLSBCaW5hcnkgb3BlcmF0b3IgZXhwcmVzc2lvbnMgYXJlIGZvbGRhYmxlIGlmIHRoZSBsZWZ0IGFuZCByaWdodCBleHByZXNzaW9ucyBhcmUgZm9sZGFibGUgYW5kXG4gICAqICAgaXQgaXMgb25lIG9mICcrJywgJy0nLCAnKicsICcvJywgJyUnLCAnfHwnLCBhbmQgJyYmJy5cbiAgICogLSBBbiBpZGVudGlmaWVyIGlzIGZvbGRhYmxlIGlmIGEgdmFsdWUgY2FuIGJlIGZvdW5kIGZvciBpdHMgc3ltYm9sIGluIHRoZSBldmFsdWF0b3Igc3ltYm9sXG4gICAqICAgdGFibGUuXG4gICAqL1xuICBwdWJsaWMgaXNGb2xkYWJsZShub2RlOiB0cy5Ob2RlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb2xkYWJsZVdvcmtlcihub2RlLCBuZXcgTWFwPHRzLk5vZGUsIGJvb2xlYW4+KCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0ZvbGRhYmxlV29ya2VyKG5vZGU6IHRzLk5vZGV8dW5kZWZpbmVkLCBmb2xkaW5nOiBNYXA8dHMuTm9kZSwgYm9vbGVhbj4pOiBib29sZWFuIHtcbiAgICBpZiAobm9kZSkge1xuICAgICAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk9iamVjdExpdGVyYWxFeHByZXNzaW9uOlxuICAgICAgICAgIHJldHVybiBldmVyeU5vZGVDaGlsZChub2RlLCBjaGlsZCA9PiB7XG4gICAgICAgICAgICBpZiAoY2hpbGQua2luZCA9PT0gdHMuU3ludGF4S2luZC5Qcm9wZXJ0eUFzc2lnbm1lbnQpIHtcbiAgICAgICAgICAgICAgY29uc3QgcHJvcGVydHlBc3NpZ25tZW50ID0gPHRzLlByb3BlcnR5QXNzaWdubWVudD5jaGlsZDtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNGb2xkYWJsZVdvcmtlcihwcm9wZXJ0eUFzc2lnbm1lbnQuaW5pdGlhbGl6ZXIsIGZvbGRpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0pO1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQXJyYXlMaXRlcmFsRXhwcmVzc2lvbjpcbiAgICAgICAgICByZXR1cm4gZXZlcnlOb2RlQ2hpbGQobm9kZSwgY2hpbGQgPT4gdGhpcy5pc0ZvbGRhYmxlV29ya2VyKGNoaWxkLCBmb2xkaW5nKSk7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DYWxsRXhwcmVzc2lvbjpcbiAgICAgICAgICBjb25zdCBjYWxsRXhwcmVzc2lvbiA9IDx0cy5DYWxsRXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICAgIC8vIFdlIGNhbiBmb2xkIGEgPGFycmF5Pi5jb25jYXQoPHY+KS5cbiAgICAgICAgICBpZiAoaXNNZXRob2RDYWxsT2YoY2FsbEV4cHJlc3Npb24sICdjb25jYXQnKSAmJlxuICAgICAgICAgICAgICBhcnJheU9yRW1wdHkoY2FsbEV4cHJlc3Npb24uYXJndW1lbnRzKS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGNvbnN0IGFycmF5Tm9kZSA9ICg8dHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uPmNhbGxFeHByZXNzaW9uLmV4cHJlc3Npb24pLmV4cHJlc3Npb247XG4gICAgICAgICAgICBpZiAodGhpcy5pc0ZvbGRhYmxlV29ya2VyKGFycmF5Tm9kZSwgZm9sZGluZykgJiZcbiAgICAgICAgICAgICAgICB0aGlzLmlzRm9sZGFibGVXb3JrZXIoY2FsbEV4cHJlc3Npb24uYXJndW1lbnRzWzBdLCBmb2xkaW5nKSkge1xuICAgICAgICAgICAgICAvLyBJdCBuZWVkcyB0byBiZSBhbiBhcnJheS5cbiAgICAgICAgICAgICAgY29uc3QgYXJyYXlWYWx1ZSA9IHRoaXMuZXZhbHVhdGVOb2RlKGFycmF5Tm9kZSk7XG4gICAgICAgICAgICAgIGlmIChhcnJheVZhbHVlICYmIEFycmF5LmlzQXJyYXkoYXJyYXlWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFdlIGNhbiBmb2xkIGEgY2FsbCB0byBDT05TVF9FWFBSXG4gICAgICAgICAgaWYgKGlzQ2FsbE9mKGNhbGxFeHByZXNzaW9uLCAnQ09OU1RfRVhQUicpICYmXG4gICAgICAgICAgICAgIGFycmF5T3JFbXB0eShjYWxsRXhwcmVzc2lvbi5hcmd1bWVudHMpLmxlbmd0aCA9PT0gMSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzRm9sZGFibGVXb3JrZXIoY2FsbEV4cHJlc3Npb24uYXJndW1lbnRzWzBdLCBmb2xkaW5nKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Ob1N1YnN0aXR1dGlvblRlbXBsYXRlTGl0ZXJhbDpcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlN0cmluZ0xpdGVyYWw6XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5OdW1lcmljTGl0ZXJhbDpcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk51bGxLZXl3b3JkOlxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVHJ1ZUtleXdvcmQ6XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5GYWxzZUtleXdvcmQ6XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UZW1wbGF0ZUhlYWQ6XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UZW1wbGF0ZU1pZGRsZTpcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlRlbXBsYXRlVGFpbDpcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlBhcmVudGhlc2l6ZWRFeHByZXNzaW9uOlxuICAgICAgICAgIGNvbnN0IHBhcmVudGhlc2l6ZWRFeHByZXNzaW9uID0gPHRzLlBhcmVudGhlc2l6ZWRFeHByZXNzaW9uPm5vZGU7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaXNGb2xkYWJsZVdvcmtlcihwYXJlbnRoZXNpemVkRXhwcmVzc2lvbi5leHByZXNzaW9uLCBmb2xkaW5nKTtcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkJpbmFyeUV4cHJlc3Npb246XG4gICAgICAgICAgY29uc3QgYmluYXJ5RXhwcmVzc2lvbiA9IDx0cy5CaW5hcnlFeHByZXNzaW9uPm5vZGU7XG4gICAgICAgICAgc3dpdGNoIChiaW5hcnlFeHByZXNzaW9uLm9wZXJhdG9yVG9rZW4ua2luZCkge1xuICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbjpcbiAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5NaW51c1Rva2VuOlxuICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkFzdGVyaXNrVG9rZW46XG4gICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuU2xhc2hUb2tlbjpcbiAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5QZXJjZW50VG9rZW46XG4gICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW46XG4gICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQmFyQmFyVG9rZW46XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmlzRm9sZGFibGVXb3JrZXIoYmluYXJ5RXhwcmVzc2lvbi5sZWZ0LCBmb2xkaW5nKSAmJlxuICAgICAgICAgICAgICAgICAgdGhpcy5pc0ZvbGRhYmxlV29ya2VyKGJpbmFyeUV4cHJlc3Npb24ucmlnaHQsIGZvbGRpbmcpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbjpcbiAgICAgICAgICBjb25zdCBwcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24gPSA8dHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uPm5vZGU7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaXNGb2xkYWJsZVdvcmtlcihwcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24uZXhwcmVzc2lvbiwgZm9sZGluZyk7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FbGVtZW50QWNjZXNzRXhwcmVzc2lvbjpcbiAgICAgICAgICBjb25zdCBlbGVtZW50QWNjZXNzRXhwcmVzc2lvbiA9IDx0cy5FbGVtZW50QWNjZXNzRXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICAgIHJldHVybiB0aGlzLmlzRm9sZGFibGVXb3JrZXIoZWxlbWVudEFjY2Vzc0V4cHJlc3Npb24uZXhwcmVzc2lvbiwgZm9sZGluZykgJiZcbiAgICAgICAgICAgICAgdGhpcy5pc0ZvbGRhYmxlV29ya2VyKGVsZW1lbnRBY2Nlc3NFeHByZXNzaW9uLmFyZ3VtZW50RXhwcmVzc2lvbiwgZm9sZGluZyk7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5JZGVudGlmaWVyOlxuICAgICAgICAgIGxldCBpZGVudGlmaWVyID0gPHRzLklkZW50aWZpZXI+bm9kZTtcbiAgICAgICAgICBsZXQgcmVmZXJlbmNlID0gdGhpcy5zeW1ib2xzLnJlc29sdmUoaWRlbnRpZmllci50ZXh0KTtcbiAgICAgICAgICBpZiAocmVmZXJlbmNlICE9PSB1bmRlZmluZWQgJiYgaXNQcmltaXRpdmUocmVmZXJlbmNlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVGVtcGxhdGVFeHByZXNzaW9uOlxuICAgICAgICAgIGNvbnN0IHRlbXBsYXRlRXhwcmVzc2lvbiA9IDx0cy5UZW1wbGF0ZUV4cHJlc3Npb24+bm9kZTtcbiAgICAgICAgICByZXR1cm4gdGVtcGxhdGVFeHByZXNzaW9uLnRlbXBsYXRlU3BhbnMuZXZlcnkoXG4gICAgICAgICAgICAgIHNwYW4gPT4gdGhpcy5pc0ZvbGRhYmxlV29ya2VyKHNwYW4uZXhwcmVzc2lvbiwgZm9sZGluZykpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogUHJvZHVjZSBhIEpTT04gc2VyaWFsaWFibGUgb2JqZWN0IHJlcHJlc2VudGluZyBgbm9kZWAuIFRoZSBmb2xkYWJsZSB2YWx1ZXMgaW4gdGhlIGV4cHJlc3Npb25cbiAgICogdHJlZSBhcmUgZm9sZGVkLiBGb3IgZXhhbXBsZSwgYSBub2RlIHJlcHJlc2VudGluZyBgMSArIDJgIGlzIGZvbGRlZCBpbnRvIGAzYC5cbiAgICovXG4gIHB1YmxpYyBldmFsdWF0ZU5vZGUobm9kZTogdHMuTm9kZSwgcHJlZmVyUmVmZXJlbmNlPzogYm9vbGVhbik6IE1ldGFkYXRhVmFsdWUge1xuICAgIGNvbnN0IHQgPSB0aGlzO1xuICAgIGxldCBlcnJvcjogTWV0YWRhdGFFcnJvcnx1bmRlZmluZWQ7XG5cbiAgICBmdW5jdGlvbiByZWNvcmRFbnRyeShlbnRyeTogTWV0YWRhdGFWYWx1ZSwgbm9kZTogdHMuTm9kZSk6IE1ldGFkYXRhVmFsdWUge1xuICAgICAgaWYgKHQub3B0aW9ucy5zdWJzdGl0dXRlRXhwcmVzc2lvbikge1xuICAgICAgICBjb25zdCBuZXdFbnRyeSA9IHQub3B0aW9ucy5zdWJzdGl0dXRlRXhwcmVzc2lvbihlbnRyeSwgbm9kZSk7XG4gICAgICAgIGlmICh0LnJlY29yZEV4cG9ydCAmJiBuZXdFbnRyeSAhPSBlbnRyeSAmJiBpc01ldGFkYXRhR2xvYmFsUmVmZXJlbmNlRXhwcmVzc2lvbihuZXdFbnRyeSkpIHtcbiAgICAgICAgICB0LnJlY29yZEV4cG9ydChuZXdFbnRyeS5uYW1lLCBlbnRyeSk7XG4gICAgICAgIH1cbiAgICAgICAgZW50cnkgPSBuZXdFbnRyeTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZWNvcmRNYXBFbnRyeShlbnRyeSwgbm9kZSwgdC5ub2RlTWFwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0ZvbGRhYmxlRXJyb3IodmFsdWU6IGFueSk6IHZhbHVlIGlzIE1ldGFkYXRhRXJyb3Ige1xuICAgICAgcmV0dXJuICF0Lm9wdGlvbnMudmVyYm9zZUludmFsaWRFeHByZXNzaW9uICYmIGlzTWV0YWRhdGFFcnJvcih2YWx1ZSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb2x2ZU5hbWUgPSAobmFtZTogc3RyaW5nLCBwcmVmZXJSZWZlcmVuY2U/OiBib29sZWFuKTogTWV0YWRhdGFWYWx1ZSA9PiB7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSB0aGlzLnN5bWJvbHMucmVzb2x2ZShuYW1lLCBwcmVmZXJSZWZlcmVuY2UpO1xuICAgICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIEVuY29kZSBhcyBhIGdsb2JhbCByZWZlcmVuY2UuIFN0YXRpY1JlZmxlY3RvciB3aWxsIGNoZWNrIHRoZSByZWZlcmVuY2UuXG4gICAgICAgIHJldHVybiByZWNvcmRFbnRyeSh7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG5hbWV9LCBub2RlKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZWZlcmVuY2UgJiYgaXNNZXRhZGF0YVN5bWJvbGljUmVmZXJlbmNlRXhwcmVzc2lvbihyZWZlcmVuY2UpKSB7XG4gICAgICAgIHJldHVybiByZWNvcmRFbnRyeSh7Li4ucmVmZXJlbmNlfSwgbm9kZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVmZXJlbmNlO1xuICAgIH07XG5cbiAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk9iamVjdExpdGVyYWxFeHByZXNzaW9uOlxuICAgICAgICBsZXQgb2JqOiB7W25hbWU6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICAgICAgbGV0IHF1b3RlZDogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgdHMuZm9yRWFjaENoaWxkKG5vZGUsIGNoaWxkID0+IHtcbiAgICAgICAgICBzd2l0Y2ggKGNoaWxkLmtpbmQpIHtcbiAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5TaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQ6XG4gICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuUHJvcGVydHlBc3NpZ25tZW50OlxuICAgICAgICAgICAgICBjb25zdCBhc3NpZ25tZW50ID0gPHRzLlByb3BlcnR5QXNzaWdubWVudHx0cy5TaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQ+Y2hpbGQ7XG4gICAgICAgICAgICAgIGlmIChhc3NpZ25tZW50Lm5hbWUua2luZCA9PSB0cy5TeW50YXhLaW5kLlN0cmluZ0xpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gKGFzc2lnbm1lbnQubmFtZSBhcyB0cy5TdHJpbmdMaXRlcmFsKS50ZXh0O1xuICAgICAgICAgICAgICAgIHF1b3RlZC5wdXNoKG5hbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IHRoaXMubmFtZU9mKGFzc2lnbm1lbnQubmFtZSk7XG4gICAgICAgICAgICAgIGlmIChpc0ZvbGRhYmxlRXJyb3IocHJvcGVydHlOYW1lKSkge1xuICAgICAgICAgICAgICAgIGVycm9yID0gcHJvcGVydHlOYW1lO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5VmFsdWUgPSBpc1Byb3BlcnR5QXNzaWdubWVudChhc3NpZ25tZW50KSA/XG4gICAgICAgICAgICAgICAgICB0aGlzLmV2YWx1YXRlTm9kZShhc3NpZ25tZW50LmluaXRpYWxpemVyLCAvKiBwcmVmZXJSZWZlcmVuY2UgKi8gdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgcmVzb2x2ZU5hbWUocHJvcGVydHlOYW1lLCAvKiBwcmVmZXJSZWZlcmVuY2UgKi8gdHJ1ZSk7XG4gICAgICAgICAgICAgIGlmIChpc0ZvbGRhYmxlRXJyb3IocHJvcGVydHlWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBlcnJvciA9IHByb3BlcnR5VmFsdWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7ICAvLyBTdG9wIHRoZSBmb3JFYWNoQ2hpbGQuXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqW3Byb3BlcnR5TmFtZV0gPSBpc1Byb3BlcnR5QXNzaWdubWVudChhc3NpZ25tZW50KSA/XG4gICAgICAgICAgICAgICAgICAgIHJlY29yZEVudHJ5KHByb3BlcnR5VmFsdWUsIGFzc2lnbm1lbnQuaW5pdGlhbGl6ZXIpIDpcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChlcnJvcikgcmV0dXJuIGVycm9yO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnF1b3RlZE5hbWVzICYmIHF1b3RlZC5sZW5ndGgpIHtcbiAgICAgICAgICBvYmpbJyRxdW90ZWQkJ10gPSBxdW90ZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KG9iaiwgbm9kZSk7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQXJyYXlMaXRlcmFsRXhwcmVzc2lvbjpcbiAgICAgICAgbGV0IGFycjogTWV0YWRhdGFWYWx1ZVtdID0gW107XG4gICAgICAgIHRzLmZvckVhY2hDaGlsZChub2RlLCBjaGlsZCA9PiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLmV2YWx1YXRlTm9kZShjaGlsZCwgLyogcHJlZmVyUmVmZXJlbmNlICovIHRydWUpO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIGVycm9yXG4gICAgICAgICAgaWYgKGlzRm9sZGFibGVFcnJvcih2YWx1ZSkpIHtcbiAgICAgICAgICAgIGVycm9yID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgIC8vIFN0b3AgdGhlIGZvckVhY2hDaGlsZC5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBIYW5kbGUgc3ByZWFkIGV4cHJlc3Npb25zXG4gICAgICAgICAgaWYgKGlzTWV0YWRhdGFTeW1ib2xpY1NwcmVhZEV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZS5leHByZXNzaW9uKSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHNwcmVhZFZhbHVlIG9mIHZhbHVlLmV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChzcHJlYWRWYWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGFyci5wdXNoKHZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChlcnJvcikgcmV0dXJuIGVycm9yO1xuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoYXJyLCBub2RlKTtcbiAgICAgIGNhc2Ugc3ByZWFkRWxlbWVudFN5bnRheEtpbmQ6XG4gICAgICAgIGxldCBzcHJlYWRFeHByZXNzaW9uID0gdGhpcy5ldmFsdWF0ZU5vZGUoKG5vZGUgYXMgYW55KS5leHByZXNzaW9uKTtcbiAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHtfX3N5bWJvbGljOiAnc3ByZWFkJywgZXhwcmVzc2lvbjogc3ByZWFkRXhwcmVzc2lvbn0sIG5vZGUpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkNhbGxFeHByZXNzaW9uOlxuICAgICAgICBjb25zdCBjYWxsRXhwcmVzc2lvbiA9IDx0cy5DYWxsRXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICBpZiAoaXNDYWxsT2YoY2FsbEV4cHJlc3Npb24sICdmb3J3YXJkUmVmJykgJiZcbiAgICAgICAgICAgIGFycmF5T3JFbXB0eShjYWxsRXhwcmVzc2lvbi5hcmd1bWVudHMpLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGNvbnN0IGZpcnN0QXJndW1lbnQgPSBjYWxsRXhwcmVzc2lvbi5hcmd1bWVudHNbMF07XG4gICAgICAgICAgaWYgKGZpcnN0QXJndW1lbnQua2luZCA9PSB0cy5TeW50YXhLaW5kLkFycm93RnVuY3Rpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGFycm93RnVuY3Rpb24gPSA8dHMuQXJyb3dGdW5jdGlvbj5maXJzdEFyZ3VtZW50O1xuICAgICAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHRoaXMuZXZhbHVhdGVOb2RlKGFycm93RnVuY3Rpb24uYm9keSksIG5vZGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhcmdzID0gYXJyYXlPckVtcHR5KGNhbGxFeHByZXNzaW9uLmFyZ3VtZW50cykubWFwKGFyZyA9PiB0aGlzLmV2YWx1YXRlTm9kZShhcmcpKTtcbiAgICAgICAgaWYgKHRoaXMuaXNGb2xkYWJsZShjYWxsRXhwcmVzc2lvbikpIHtcbiAgICAgICAgICBpZiAoaXNNZXRob2RDYWxsT2YoY2FsbEV4cHJlc3Npb24sICdjb25jYXQnKSkge1xuICAgICAgICAgICAgY29uc3QgYXJyYXlWYWx1ZSA9IDxNZXRhZGF0YVZhbHVlW10+dGhpcy5ldmFsdWF0ZU5vZGUoXG4gICAgICAgICAgICAgICAgKDx0cy5Qcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24+Y2FsbEV4cHJlc3Npb24uZXhwcmVzc2lvbikuZXhwcmVzc2lvbik7XG4gICAgICAgICAgICBpZiAoaXNGb2xkYWJsZUVycm9yKGFycmF5VmFsdWUpKSByZXR1cm4gYXJyYXlWYWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBhcnJheVZhbHVlLmNvbmNhdChhcmdzWzBdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQWx3YXlzIGZvbGQgYSBDT05TVF9FWFBSIGV2ZW4gaWYgdGhlIGFyZ3VtZW50IGlzIG5vdCBmb2xkYWJsZS5cbiAgICAgICAgaWYgKGlzQ2FsbE9mKGNhbGxFeHByZXNzaW9uLCAnQ09OU1RfRVhQUicpICYmXG4gICAgICAgICAgICBhcnJheU9yRW1wdHkoY2FsbEV4cHJlc3Npb24uYXJndW1lbnRzKS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoYXJnc1swXSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHRoaXMuZXZhbHVhdGVOb2RlKGNhbGxFeHByZXNzaW9uLmV4cHJlc3Npb24pO1xuICAgICAgICBpZiAoaXNGb2xkYWJsZUVycm9yKGV4cHJlc3Npb24pKSB7XG4gICAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KGV4cHJlc3Npb24sIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGxldCByZXN1bHQ6IE1ldGFkYXRhU3ltYm9saWNDYWxsRXhwcmVzc2lvbiA9IHtfX3N5bWJvbGljOiAnY2FsbCcsIGV4cHJlc3Npb246IGV4cHJlc3Npb259O1xuICAgICAgICBpZiAoYXJncyAmJiBhcmdzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5hcmd1bWVudHMgPSBhcmdzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZWNvcmRFbnRyeShyZXN1bHQsIG5vZGUpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk5ld0V4cHJlc3Npb246XG4gICAgICAgIGNvbnN0IG5ld0V4cHJlc3Npb24gPSA8dHMuTmV3RXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICBjb25zdCBuZXdBcmdzID0gYXJyYXlPckVtcHR5KG5ld0V4cHJlc3Npb24uYXJndW1lbnRzKS5tYXAoYXJnID0+IHRoaXMuZXZhbHVhdGVOb2RlKGFyZykpO1xuICAgICAgICBjb25zdCBuZXdUYXJnZXQgPSB0aGlzLmV2YWx1YXRlTm9kZShuZXdFeHByZXNzaW9uLmV4cHJlc3Npb24pO1xuICAgICAgICBpZiAoaXNNZXRhZGF0YUVycm9yKG5ld1RhcmdldCkpIHtcbiAgICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkobmV3VGFyZ2V0LCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjYWxsOiBNZXRhZGF0YVN5bWJvbGljQ2FsbEV4cHJlc3Npb24gPSB7X19zeW1ib2xpYzogJ25ldycsIGV4cHJlc3Npb246IG5ld1RhcmdldH07XG4gICAgICAgIGlmIChuZXdBcmdzLmxlbmd0aCkge1xuICAgICAgICAgIGNhbGwuYXJndW1lbnRzID0gbmV3QXJncztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoY2FsbCwgbm9kZSk7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uOiB7XG4gICAgICAgIGNvbnN0IHByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbiA9IDx0cy5Qcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24+bm9kZTtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHRoaXMuZXZhbHVhdGVOb2RlKHByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbi5leHByZXNzaW9uKTtcbiAgICAgICAgaWYgKGlzRm9sZGFibGVFcnJvcihleHByZXNzaW9uKSkge1xuICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeShleHByZXNzaW9uLCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtZW1iZXIgPSB0aGlzLm5hbWVPZihwcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24ubmFtZSk7XG4gICAgICAgIGlmIChpc0ZvbGRhYmxlRXJyb3IobWVtYmVyKSkge1xuICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeShtZW1iZXIsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleHByZXNzaW9uICYmIHRoaXMuaXNGb2xkYWJsZShwcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24uZXhwcmVzc2lvbikpXG4gICAgICAgICAgcmV0dXJuICg8YW55PmV4cHJlc3Npb24pW21lbWJlcl07XG4gICAgICAgIGlmIChpc01ldGFkYXRhTW9kdWxlUmVmZXJlbmNlRXhwcmVzc2lvbihleHByZXNzaW9uKSkge1xuICAgICAgICAgIC8vIEEgc2VsZWN0IGludG8gYSBtb2R1bGUgcmVmZXJlbmNlIGFuZCBiZSBjb252ZXJ0ZWQgaW50byBhIHJlZmVyZW5jZSB0byB0aGUgc3ltYm9sXG4gICAgICAgICAgLy8gaW4gdGhlIG1vZHVsZVxuICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeShcbiAgICAgICAgICAgICAge19fc3ltYm9saWM6ICdyZWZlcmVuY2UnLCBtb2R1bGU6IGV4cHJlc3Npb24ubW9kdWxlLCBuYW1lOiBtZW1iZXJ9LCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoe19fc3ltYm9saWM6ICdzZWxlY3QnLCBleHByZXNzaW9uLCBtZW1iZXJ9LCBub2RlKTtcbiAgICAgIH1cbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FbGVtZW50QWNjZXNzRXhwcmVzc2lvbjoge1xuICAgICAgICBjb25zdCBlbGVtZW50QWNjZXNzRXhwcmVzc2lvbiA9IDx0cy5FbGVtZW50QWNjZXNzRXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5ldmFsdWF0ZU5vZGUoZWxlbWVudEFjY2Vzc0V4cHJlc3Npb24uZXhwcmVzc2lvbik7XG4gICAgICAgIGlmIChpc0ZvbGRhYmxlRXJyb3IoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoZXhwcmVzc2lvbiwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbGVtZW50QWNjZXNzRXhwcmVzc2lvbi5hcmd1bWVudEV4cHJlc3Npb24pIHtcbiAgICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoZXJyb3JTeW1ib2woJ0V4cHJlc3Npb24gZm9ybSBub3Qgc3VwcG9ydGVkJywgbm9kZSksIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5ldmFsdWF0ZU5vZGUoZWxlbWVudEFjY2Vzc0V4cHJlc3Npb24uYXJndW1lbnRFeHByZXNzaW9uKTtcbiAgICAgICAgaWYgKGlzRm9sZGFibGVFcnJvcihleHByZXNzaW9uKSkge1xuICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeShleHByZXNzaW9uLCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5pc0ZvbGRhYmxlKGVsZW1lbnRBY2Nlc3NFeHByZXNzaW9uLmV4cHJlc3Npb24pICYmXG4gICAgICAgICAgICB0aGlzLmlzRm9sZGFibGUoZWxlbWVudEFjY2Vzc0V4cHJlc3Npb24uYXJndW1lbnRFeHByZXNzaW9uKSlcbiAgICAgICAgICByZXR1cm4gKDxhbnk+ZXhwcmVzc2lvbilbPHN0cmluZ3xudW1iZXI+aW5kZXhdO1xuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoe19fc3ltYm9saWM6ICdpbmRleCcsIGV4cHJlc3Npb24sIGluZGV4fSwgbm9kZSk7XG4gICAgICB9XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IDx0cy5JZGVudGlmaWVyPm5vZGU7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyLnRleHQ7XG4gICAgICAgIHJldHVybiByZXNvbHZlTmFtZShuYW1lLCBwcmVmZXJSZWZlcmVuY2UpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlR5cGVSZWZlcmVuY2U6XG4gICAgICAgIGNvbnN0IHR5cGVSZWZlcmVuY2VOb2RlID0gPHRzLlR5cGVSZWZlcmVuY2VOb2RlPm5vZGU7XG4gICAgICAgIGNvbnN0IHR5cGVOYW1lTm9kZSA9IHR5cGVSZWZlcmVuY2VOb2RlLnR5cGVOYW1lO1xuICAgICAgICBjb25zdCBnZXRSZWZlcmVuY2U6ICh0eXBlTmFtZU5vZGU6IHRzLklkZW50aWZpZXJ8dHMuUXVhbGlmaWVkTmFtZSkgPT4gTWV0YWRhdGFWYWx1ZSA9XG4gICAgICAgICAgICBub2RlID0+IHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVOYW1lTm9kZS5raW5kID09PSB0cy5TeW50YXhLaW5kLlF1YWxpZmllZE5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBxdWFsaWZpZWROYW1lID0gPHRzLlF1YWxpZmllZE5hbWU+bm9kZTtcbiAgICAgICAgICAgICAgICBjb25zdCBsZWZ0ID0gdGhpcy5ldmFsdWF0ZU5vZGUocXVhbGlmaWVkTmFtZS5sZWZ0KTtcbiAgICAgICAgICAgICAgICBpZiAoaXNNZXRhZGF0YU1vZHVsZVJlZmVyZW5jZUV4cHJlc3Npb24obGVmdCkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeShcbiAgICAgICAgICAgICAgICAgICAgICA8TWV0YWRhdGFJbXBvcnRlZFN5bWJvbFJlZmVyZW5jZUV4cHJlc3Npb24+e1xuICAgICAgICAgICAgICAgICAgICAgICAgX19zeW1ib2xpYzogJ3JlZmVyZW5jZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGU6IGxlZnQubW9kdWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcXVhbGlmaWVkTmFtZS5yaWdodC50ZXh0XG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICBub2RlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gUmVjb3JkIGEgdHlwZSByZWZlcmVuY2UgdG8gYSBkZWNsYXJlZCB0eXBlIGFzIGEgc2VsZWN0LlxuICAgICAgICAgICAgICAgIHJldHVybiB7X19zeW1ib2xpYzogJ3NlbGVjdCcsIGV4cHJlc3Npb246IGxlZnQsIG1lbWJlcjogcXVhbGlmaWVkTmFtZS5yaWdodC50ZXh0fTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gPHRzLklkZW50aWZpZXI+dHlwZU5hbWVOb2RlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuc3ltYm9scy5yZXNvbHZlKGlkZW50aWZpZXIudGV4dCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzRm9sZGFibGVFcnJvcihzeW1ib2wpIHx8IGlzTWV0YWRhdGFTeW1ib2xpY1JlZmVyZW5jZUV4cHJlc3Npb24oc3ltYm9sKSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHN5bWJvbCwgbm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeShcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JTeW1ib2woJ0NvdWxkIG5vdCByZXNvbHZlIHR5cGUnLCBub2RlLCB7dHlwZU5hbWU6IGlkZW50aWZpZXIudGV4dH0pLCBub2RlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdHlwZVJlZmVyZW5jZSA9IGdldFJlZmVyZW5jZSh0eXBlTmFtZU5vZGUpO1xuICAgICAgICBpZiAoaXNGb2xkYWJsZUVycm9yKHR5cGVSZWZlcmVuY2UpKSB7XG4gICAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHR5cGVSZWZlcmVuY2UsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNNZXRhZGF0YU1vZHVsZVJlZmVyZW5jZUV4cHJlc3Npb24odHlwZVJlZmVyZW5jZSkgJiZcbiAgICAgICAgICAgIHR5cGVSZWZlcmVuY2VOb2RlLnR5cGVBcmd1bWVudHMgJiYgdHlwZVJlZmVyZW5jZU5vZGUudHlwZUFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBhcmdzID0gdHlwZVJlZmVyZW5jZU5vZGUudHlwZUFyZ3VtZW50cy5tYXAoZWxlbWVudCA9PiB0aGlzLmV2YWx1YXRlTm9kZShlbGVtZW50KSk7XG4gICAgICAgICAgLy8gVE9ETzogUmVtb3ZlIHR5cGVjYXN0IHdoZW4gdXBncmFkZWQgdG8gMi4wIGFzIGl0IHdpbGwgYmUgY29ycmVjdGx5IGluZmVycmVkLlxuICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgMS45IGRvIG5vdCBpbmZlciB0aGlzIGNvcnJlY3RseS5cbiAgICAgICAgICAoPE1ldGFkYXRhSW1wb3J0ZWRTeW1ib2xSZWZlcmVuY2VFeHByZXNzaW9uPnR5cGVSZWZlcmVuY2UpLmFyZ3VtZW50cyA9IGFyZ3M7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHR5cGVSZWZlcmVuY2UsIG5vZGUpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlVuaW9uVHlwZTpcbiAgICAgICAgY29uc3QgdW5pb25UeXBlID0gPHRzLlVuaW9uVHlwZU5vZGU+bm9kZTtcbiAgICAgICAgLy8gUmVtb3ZlIG51bGwgYW5kIHVuZGVmaW5lZCBmcm9tIHRoZSBsaXN0IG9mIHVuaW9ucy5cbiAgICAgICAgY29uc3QgcmVmZXJlbmNlcyA9XG4gICAgICAgICAgICB1bmlvblR5cGUudHlwZXNcbiAgICAgICAgICAgICAgICAuZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgICBuID0+IG4ua2luZCAhPT0gdHMuU3ludGF4S2luZC5VbmRlZmluZWRLZXl3b3JkICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAhKHRzLmlzTGl0ZXJhbFR5cGVOb2RlKG4pICYmIG4ubGl0ZXJhbC5raW5kID09PSB0cy5TeW50YXhLaW5kLk51bGxLZXl3b3JkKSlcbiAgICAgICAgICAgICAgICAubWFwKG4gPT4gdGhpcy5ldmFsdWF0ZU5vZGUobikpO1xuXG4gICAgICAgIC8vIFRoZSByZW1tYWluaW5nIHJlZmVyZW5jZSBtdXN0IGJlIHRoZSBzYW1lLiBJZiB0d28gaGF2ZSB0eXBlIGFyZ3VtZW50cyBjb25zaWRlciB0aGVtXG4gICAgICAgIC8vIGRpZmZlcmVudCBldmVuIGlmIHRoZSB0eXBlIGFyZ3VtZW50cyBhcmUgdGhlIHNhbWUuXG4gICAgICAgIGxldCBjYW5kaWRhdGU6IGFueSA9IG51bGw7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZSA9IHJlZmVyZW5jZXNbaV07XG4gICAgICAgICAgaWYgKGlzTWV0YWRhdGFTeW1ib2xpY1JlZmVyZW5jZUV4cHJlc3Npb24ocmVmZXJlbmNlKSkge1xuICAgICAgICAgICAgaWYgKGNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICBpZiAoKHJlZmVyZW5jZSBhcyBhbnkpLm5hbWUgPT0gY2FuZGlkYXRlLm5hbWUgJiZcbiAgICAgICAgICAgICAgICAgIChyZWZlcmVuY2UgYXMgYW55KS5tb2R1bGUgPT0gY2FuZGlkYXRlLm1vZHVsZSAmJiAhKHJlZmVyZW5jZSBhcyBhbnkpLmFyZ3VtZW50cykge1xuICAgICAgICAgICAgICAgIGNhbmRpZGF0ZSA9IHJlZmVyZW5jZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2FuZGlkYXRlID0gcmVmZXJlbmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcmVmZXJlbmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FuZGlkYXRlKSByZXR1cm4gY2FuZGlkYXRlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Ob1N1YnN0aXR1dGlvblRlbXBsYXRlTGl0ZXJhbDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5TdHJpbmdMaXRlcmFsOlxuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlRlbXBsYXRlSGVhZDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UZW1wbGF0ZVRhaWw6XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVGVtcGxhdGVNaWRkbGU6XG4gICAgICAgIHJldHVybiAoPHRzLkxpdGVyYWxMaWtlTm9kZT5ub2RlKS50ZXh0O1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk51bWVyaWNMaXRlcmFsOlxuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCgoPHRzLkxpdGVyYWxFeHByZXNzaW9uPm5vZGUpLnRleHQpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkFueUtleXdvcmQ6XG4gICAgICAgIHJldHVybiByZWNvcmRFbnRyeSh7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG5hbWU6ICdhbnknfSwgbm9kZSk7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuU3RyaW5nS2V5d29yZDpcbiAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHtfX3N5bWJvbGljOiAncmVmZXJlbmNlJywgbmFtZTogJ3N0cmluZyd9LCBub2RlKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5OdW1iZXJLZXl3b3JkOlxuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoe19fc3ltYm9saWM6ICdyZWZlcmVuY2UnLCBuYW1lOiAnbnVtYmVyJ30sIG5vZGUpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkJvb2xlYW5LZXl3b3JkOlxuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoe19fc3ltYm9saWM6ICdyZWZlcmVuY2UnLCBuYW1lOiAnYm9vbGVhbid9LCBub2RlKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5BcnJheVR5cGU6XG4gICAgICAgIGNvbnN0IGFycmF5VHlwZU5vZGUgPSA8dHMuQXJyYXlUeXBlTm9kZT5ub2RlO1xuICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIF9fc3ltYm9saWM6ICdyZWZlcmVuY2UnLFxuICAgICAgICAgICAgICBuYW1lOiAnQXJyYXknLFxuICAgICAgICAgICAgICBhcmd1bWVudHM6IFt0aGlzLmV2YWx1YXRlTm9kZShhcnJheVR5cGVOb2RlLmVsZW1lbnRUeXBlKV1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5OdWxsS2V5d29yZDpcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVHJ1ZUtleXdvcmQ6XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkZhbHNlS2V5d29yZDpcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlBhcmVudGhlc2l6ZWRFeHByZXNzaW9uOlxuICAgICAgICBjb25zdCBwYXJlbnRoZXNpemVkRXhwcmVzc2lvbiA9IDx0cy5QYXJlbnRoZXNpemVkRXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICByZXR1cm4gdGhpcy5ldmFsdWF0ZU5vZGUocGFyZW50aGVzaXplZEV4cHJlc3Npb24uZXhwcmVzc2lvbik7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVHlwZUFzc2VydGlvbkV4cHJlc3Npb246XG4gICAgICAgIGNvbnN0IHR5cGVBc3NlcnRpb24gPSA8dHMuVHlwZUFzc2VydGlvbj5ub2RlO1xuICAgICAgICByZXR1cm4gdGhpcy5ldmFsdWF0ZU5vZGUodHlwZUFzc2VydGlvbi5leHByZXNzaW9uKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5QcmVmaXhVbmFyeUV4cHJlc3Npb246XG4gICAgICAgIGNvbnN0IHByZWZpeFVuYXJ5RXhwcmVzc2lvbiA9IDx0cy5QcmVmaXhVbmFyeUV4cHJlc3Npb24+bm9kZTtcbiAgICAgICAgY29uc3Qgb3BlcmFuZCA9IHRoaXMuZXZhbHVhdGVOb2RlKHByZWZpeFVuYXJ5RXhwcmVzc2lvbi5vcGVyYW5kKTtcbiAgICAgICAgaWYgKGlzRGVmaW5lZChvcGVyYW5kKSAmJiBpc1ByaW1pdGl2ZShvcGVyYW5kKSkge1xuICAgICAgICAgIHN3aXRjaCAocHJlZml4VW5hcnlFeHByZXNzaW9uLm9wZXJhdG9yKSB7XG4gICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuUGx1c1Rva2VuOlxuICAgICAgICAgICAgICByZXR1cm4gKyhvcGVyYW5kIGFzIGFueSk7XG4gICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTWludXNUb2tlbjpcbiAgICAgICAgICAgICAgcmV0dXJuIC0ob3BlcmFuZCBhcyBhbnkpO1xuICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlRpbGRlVG9rZW46XG4gICAgICAgICAgICAgIHJldHVybiB+KG9wZXJhbmQgYXMgYW55KTtcbiAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FeGNsYW1hdGlvblRva2VuOlxuICAgICAgICAgICAgICByZXR1cm4gIW9wZXJhbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCBvcGVyYXRvclRleHQ6ICcrJ3wnLSd8J34nfCchJztcbiAgICAgICAgc3dpdGNoIChwcmVmaXhVbmFyeUV4cHJlc3Npb24ub3BlcmF0b3IpIHtcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuUGx1c1Rva2VuOlxuICAgICAgICAgICAgb3BlcmF0b3JUZXh0ID0gJysnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk1pbnVzVG9rZW46XG4gICAgICAgICAgICBvcGVyYXRvclRleHQgPSAnLSc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVGlsZGVUb2tlbjpcbiAgICAgICAgICAgIG9wZXJhdG9yVGV4dCA9ICd+JztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FeGNsYW1hdGlvblRva2VuOlxuICAgICAgICAgICAgb3BlcmF0b3JUZXh0ID0gJyEnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHtfX3N5bWJvbGljOiAncHJlJywgb3BlcmF0b3I6IG9wZXJhdG9yVGV4dCwgb3BlcmFuZDogb3BlcmFuZH0sIG5vZGUpO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkJpbmFyeUV4cHJlc3Npb246XG4gICAgICAgIGNvbnN0IGJpbmFyeUV4cHJlc3Npb24gPSA8dHMuQmluYXJ5RXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICBjb25zdCBsZWZ0ID0gdGhpcy5ldmFsdWF0ZU5vZGUoYmluYXJ5RXhwcmVzc2lvbi5sZWZ0KTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLmV2YWx1YXRlTm9kZShiaW5hcnlFeHByZXNzaW9uLnJpZ2h0KTtcbiAgICAgICAgaWYgKGlzRGVmaW5lZChsZWZ0KSAmJiBpc0RlZmluZWQocmlnaHQpKSB7XG4gICAgICAgICAgaWYgKGlzUHJpbWl0aXZlKGxlZnQpICYmIGlzUHJpbWl0aXZlKHJpZ2h0KSlcbiAgICAgICAgICAgIHN3aXRjaCAoYmluYXJ5RXhwcmVzc2lvbi5vcGVyYXRvclRva2VuLmtpbmQpIHtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkJhckJhclRva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiA8YW55PmxlZnQgfHwgPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZEFtcGVyc2FuZFRva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiA8YW55PmxlZnQgJiYgPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZFRva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiA8YW55PmxlZnQgJiA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQmFyVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCB8IDxhbnk+cmlnaHQ7XG4gICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DYXJldFRva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiA8YW55PmxlZnQgXiA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCA9PSA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNUb2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0ICE9IDxhbnk+cmlnaHQ7XG4gICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FcXVhbHNFcXVhbHNFcXVhbHNUb2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0ID09PSA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNFcXVhbHNUb2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0ICE9PSA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTGVzc1RoYW5Ub2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0IDwgPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCA+IDxhbnk+cmlnaHQ7XG4gICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5MZXNzVGhhbkVxdWFsc1Rva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiA8YW55PmxlZnQgPD0gPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuRXF1YWxzVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCA+PSA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTGVzc1RoYW5MZXNzVGhhblRva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiAoPGFueT5sZWZ0KSA8PCAoPGFueT5yaWdodCk7XG4gICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5HcmVhdGVyVGhhbkdyZWF0ZXJUaGFuVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCA+PiA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuR3JlYXRlclRoYW5HcmVhdGVyVGhhbkdyZWF0ZXJUaGFuVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCA+Pj4gPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0ICsgPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk1pbnVzVG9rZW46XG4gICAgICAgICAgICAgICAgcmV0dXJuIDxhbnk+bGVmdCAtIDxhbnk+cmlnaHQ7XG4gICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Bc3Rlcmlza1Rva2VuOlxuICAgICAgICAgICAgICAgIHJldHVybiA8YW55PmxlZnQgKiA8YW55PnJpZ2h0O1xuICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuU2xhc2hUb2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0IC8gPGFueT5yaWdodDtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlBlcmNlbnRUb2tlbjpcbiAgICAgICAgICAgICAgICByZXR1cm4gPGFueT5sZWZ0ICUgPGFueT5yaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmVjb3JkRW50cnkoXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBfX3N5bWJvbGljOiAnYmlub3AnLFxuICAgICAgICAgICAgICAgIG9wZXJhdG9yOiBiaW5hcnlFeHByZXNzaW9uLm9wZXJhdG9yVG9rZW4uZ2V0VGV4dCgpLFxuICAgICAgICAgICAgICAgIGxlZnQ6IGxlZnQsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHJpZ2h0XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkNvbmRpdGlvbmFsRXhwcmVzc2lvbjpcbiAgICAgICAgY29uc3QgY29uZGl0aW9uYWxFeHByZXNzaW9uID0gPHRzLkNvbmRpdGlvbmFsRXhwcmVzc2lvbj5ub2RlO1xuICAgICAgICBjb25zdCBjb25kaXRpb24gPSB0aGlzLmV2YWx1YXRlTm9kZShjb25kaXRpb25hbEV4cHJlc3Npb24uY29uZGl0aW9uKTtcbiAgICAgICAgY29uc3QgdGhlbkV4cHJlc3Npb24gPSB0aGlzLmV2YWx1YXRlTm9kZShjb25kaXRpb25hbEV4cHJlc3Npb24ud2hlblRydWUpO1xuICAgICAgICBjb25zdCBlbHNlRXhwcmVzc2lvbiA9IHRoaXMuZXZhbHVhdGVOb2RlKGNvbmRpdGlvbmFsRXhwcmVzc2lvbi53aGVuRmFsc2UpO1xuICAgICAgICBpZiAoaXNQcmltaXRpdmUoY29uZGl0aW9uKSkge1xuICAgICAgICAgIHJldHVybiBjb25kaXRpb24gPyB0aGVuRXhwcmVzc2lvbiA6IGVsc2VFeHByZXNzaW9uO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZWNvcmRFbnRyeSh7X19zeW1ib2xpYzogJ2lmJywgY29uZGl0aW9uLCB0aGVuRXhwcmVzc2lvbiwgZWxzZUV4cHJlc3Npb259LCBub2RlKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvbkV4cHJlc3Npb246XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQXJyb3dGdW5jdGlvbjpcbiAgICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KGVycm9yU3ltYm9sKCdMYW1iZGEgbm90IHN1cHBvcnRlZCcsIG5vZGUpLCBub2RlKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb246XG4gICAgICAgIHJldHVybiByZWNvcmRFbnRyeShcbiAgICAgICAgICAgIGVycm9yU3ltYm9sKCdUYWdnZWQgdGVtcGxhdGUgZXhwcmVzc2lvbnMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gbWV0YWRhdGEnLCBub2RlKSwgbm9kZSk7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVGVtcGxhdGVFeHByZXNzaW9uOlxuICAgICAgICBjb25zdCB0ZW1wbGF0ZUV4cHJlc3Npb24gPSA8dHMuVGVtcGxhdGVFeHByZXNzaW9uPm5vZGU7XG4gICAgICAgIGlmICh0aGlzLmlzRm9sZGFibGUobm9kZSkpIHtcbiAgICAgICAgICByZXR1cm4gdGVtcGxhdGVFeHByZXNzaW9uLnRlbXBsYXRlU3BhbnMucmVkdWNlKFxuICAgICAgICAgICAgICAocHJldmlvdXMsIGN1cnJlbnQpID0+IHByZXZpb3VzICsgPHN0cmluZz50aGlzLmV2YWx1YXRlTm9kZShjdXJyZW50LmV4cHJlc3Npb24pICtcbiAgICAgICAgICAgICAgICAgIDxzdHJpbmc+dGhpcy5ldmFsdWF0ZU5vZGUoY3VycmVudC5saXRlcmFsKSxcbiAgICAgICAgICAgICAgdGhpcy5ldmFsdWF0ZU5vZGUodGVtcGxhdGVFeHByZXNzaW9uLmhlYWQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGVtcGxhdGVFeHByZXNzaW9uLnRlbXBsYXRlU3BhbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXhwciA9IHRoaXMuZXZhbHVhdGVOb2RlKGN1cnJlbnQuZXhwcmVzc2lvbik7XG4gICAgICAgICAgICBjb25zdCBsaXRlcmFsID0gdGhpcy5ldmFsdWF0ZU5vZGUoY3VycmVudC5saXRlcmFsKTtcbiAgICAgICAgICAgIGlmIChpc0ZvbGRhYmxlRXJyb3IoZXhwcikpIHJldHVybiBleHByO1xuICAgICAgICAgICAgaWYgKGlzRm9sZGFibGVFcnJvcihsaXRlcmFsKSkgcmV0dXJuIGxpdGVyYWw7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHByZXZpb3VzID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgZXhwciA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgICAgICB0eXBlb2YgbGl0ZXJhbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHByZXZpb3VzICsgZXhwciArIGxpdGVyYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gZXhwcjtcbiAgICAgICAgICAgIGlmIChwcmV2aW91cyAhPT0gJycpIHtcbiAgICAgICAgICAgICAgcmVzdWx0ID0ge19fc3ltYm9saWM6ICdiaW5vcCcsIG9wZXJhdG9yOiAnKycsIGxlZnQ6IHByZXZpb3VzLCByaWdodDogZXhwcn07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGl0ZXJhbCAhPSAnJykge1xuICAgICAgICAgICAgICByZXN1bHQgPSB7X19zeW1ib2xpYzogJ2Jpbm9wJywgb3BlcmF0b3I6ICcrJywgbGVmdDogcmVzdWx0LCByaWdodDogbGl0ZXJhbH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH0sIHRoaXMuZXZhbHVhdGVOb2RlKHRlbXBsYXRlRXhwcmVzc2lvbi5oZWFkKSk7XG4gICAgICAgIH1cbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Bc0V4cHJlc3Npb246XG4gICAgICAgIGNvbnN0IGFzRXhwcmVzc2lvbiA9IDx0cy5Bc0V4cHJlc3Npb24+bm9kZTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVOb2RlKGFzRXhwcmVzc2lvbi5leHByZXNzaW9uKTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbGFzc0V4cHJlc3Npb246XG4gICAgICAgIHJldHVybiB7X19zeW1ib2xpYzogJ2NsYXNzJ307XG4gICAgfVxuICAgIHJldHVybiByZWNvcmRFbnRyeShlcnJvclN5bWJvbCgnRXhwcmVzc2lvbiBmb3JtIG5vdCBzdXBwb3J0ZWQnLCBub2RlKSwgbm9kZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNQcm9wZXJ0eUFzc2lnbm1lbnQobm9kZTogdHMuTm9kZSk6IG5vZGUgaXMgdHMuUHJvcGVydHlBc3NpZ25tZW50IHtcbiAgcmV0dXJuIG5vZGUua2luZCA9PSB0cy5TeW50YXhLaW5kLlByb3BlcnR5QXNzaWdubWVudDtcbn1cblxuY29uc3QgZW1wdHkgPSB0cy5jcmVhdGVOb2RlQXJyYXk8YW55PigpO1xuXG5mdW5jdGlvbiBhcnJheU9yRW1wdHk8VCBleHRlbmRzIHRzLk5vZGU+KHY6IHRzLk5vZGVBcnJheTxUPnx1bmRlZmluZWQpOiB0cy5Ob2RlQXJyYXk8VD4ge1xuICByZXR1cm4gdiB8fCBlbXB0eTtcbn1cbiJdfQ==