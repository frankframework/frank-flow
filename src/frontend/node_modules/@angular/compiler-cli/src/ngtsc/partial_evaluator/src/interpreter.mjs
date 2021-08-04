/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { Reference } from '../../imports';
import { isConcreteDeclaration } from '../../reflection';
import { isDeclaration } from '../../util/src/typescript';
import { ArrayConcatBuiltinFn, ArraySliceBuiltinFn } from './builtin';
import { DynamicValue } from './dynamic';
import { resolveKnownDeclaration } from './known_declaration';
import { EnumValue, KnownFn, ResolvedModule } from './result';
function literalBinaryOp(op) {
    return { op, literal: true };
}
function referenceBinaryOp(op) {
    return { op, literal: false };
}
const BINARY_OPERATORS = new Map([
    [ts.SyntaxKind.PlusToken, literalBinaryOp((a, b) => a + b)],
    [ts.SyntaxKind.MinusToken, literalBinaryOp((a, b) => a - b)],
    [ts.SyntaxKind.AsteriskToken, literalBinaryOp((a, b) => a * b)],
    [ts.SyntaxKind.SlashToken, literalBinaryOp((a, b) => a / b)],
    [ts.SyntaxKind.PercentToken, literalBinaryOp((a, b) => a % b)],
    [ts.SyntaxKind.AmpersandToken, literalBinaryOp((a, b) => a & b)],
    [ts.SyntaxKind.BarToken, literalBinaryOp((a, b) => a | b)],
    [ts.SyntaxKind.CaretToken, literalBinaryOp((a, b) => a ^ b)],
    [ts.SyntaxKind.LessThanToken, literalBinaryOp((a, b) => a < b)],
    [ts.SyntaxKind.LessThanEqualsToken, literalBinaryOp((a, b) => a <= b)],
    [ts.SyntaxKind.GreaterThanToken, literalBinaryOp((a, b) => a > b)],
    [ts.SyntaxKind.GreaterThanEqualsToken, literalBinaryOp((a, b) => a >= b)],
    [ts.SyntaxKind.EqualsEqualsToken, literalBinaryOp((a, b) => a == b)],
    [ts.SyntaxKind.EqualsEqualsEqualsToken, literalBinaryOp((a, b) => a === b)],
    [ts.SyntaxKind.ExclamationEqualsToken, literalBinaryOp((a, b) => a != b)],
    [ts.SyntaxKind.ExclamationEqualsEqualsToken, literalBinaryOp((a, b) => a !== b)],
    [ts.SyntaxKind.LessThanLessThanToken, literalBinaryOp((a, b) => a << b)],
    [ts.SyntaxKind.GreaterThanGreaterThanToken, literalBinaryOp((a, b) => a >> b)],
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, literalBinaryOp((a, b) => a >>> b)],
    [ts.SyntaxKind.AsteriskAsteriskToken, literalBinaryOp((a, b) => Math.pow(a, b))],
    [ts.SyntaxKind.AmpersandAmpersandToken, referenceBinaryOp((a, b) => a && b)],
    [ts.SyntaxKind.BarBarToken, referenceBinaryOp((a, b) => a || b)]
]);
const UNARY_OPERATORS = new Map([
    [ts.SyntaxKind.TildeToken, a => ~a], [ts.SyntaxKind.MinusToken, a => -a],
    [ts.SyntaxKind.PlusToken, a => +a], [ts.SyntaxKind.ExclamationToken, a => !a]
]);
export class StaticInterpreter {
    constructor(host, checker, dependencyTracker) {
        this.host = host;
        this.checker = checker;
        this.dependencyTracker = dependencyTracker;
    }
    visit(node, context) {
        return this.visitExpression(node, context);
    }
    visitExpression(node, context) {
        let result;
        if (node.kind === ts.SyntaxKind.TrueKeyword) {
            return true;
        }
        else if (node.kind === ts.SyntaxKind.FalseKeyword) {
            return false;
        }
        else if (node.kind === ts.SyntaxKind.NullKeyword) {
            return null;
        }
        else if (ts.isStringLiteral(node)) {
            return node.text;
        }
        else if (ts.isNoSubstitutionTemplateLiteral(node)) {
            return node.text;
        }
        else if (ts.isTemplateExpression(node)) {
            result = this.visitTemplateExpression(node, context);
        }
        else if (ts.isNumericLiteral(node)) {
            return parseFloat(node.text);
        }
        else if (ts.isObjectLiteralExpression(node)) {
            result = this.visitObjectLiteralExpression(node, context);
        }
        else if (ts.isIdentifier(node)) {
            result = this.visitIdentifier(node, context);
        }
        else if (ts.isPropertyAccessExpression(node)) {
            result = this.visitPropertyAccessExpression(node, context);
        }
        else if (ts.isCallExpression(node)) {
            result = this.visitCallExpression(node, context);
        }
        else if (ts.isConditionalExpression(node)) {
            result = this.visitConditionalExpression(node, context);
        }
        else if (ts.isPrefixUnaryExpression(node)) {
            result = this.visitPrefixUnaryExpression(node, context);
        }
        else if (ts.isBinaryExpression(node)) {
            result = this.visitBinaryExpression(node, context);
        }
        else if (ts.isArrayLiteralExpression(node)) {
            result = this.visitArrayLiteralExpression(node, context);
        }
        else if (ts.isParenthesizedExpression(node)) {
            result = this.visitParenthesizedExpression(node, context);
        }
        else if (ts.isElementAccessExpression(node)) {
            result = this.visitElementAccessExpression(node, context);
        }
        else if (ts.isAsExpression(node)) {
            result = this.visitExpression(node.expression, context);
        }
        else if (ts.isNonNullExpression(node)) {
            result = this.visitExpression(node.expression, context);
        }
        else if (this.host.isClass(node)) {
            result = this.visitDeclaration(node, context);
        }
        else {
            return DynamicValue.fromUnsupportedSyntax(node);
        }
        if (result instanceof DynamicValue && result.node !== node) {
            return DynamicValue.fromDynamicInput(node, result);
        }
        return result;
    }
    visitArrayLiteralExpression(node, context) {
        const array = [];
        for (let i = 0; i < node.elements.length; i++) {
            const element = node.elements[i];
            if (ts.isSpreadElement(element)) {
                array.push(...this.visitSpreadElement(element, context));
            }
            else {
                array.push(this.visitExpression(element, context));
            }
        }
        return array;
    }
    visitObjectLiteralExpression(node, context) {
        const map = new Map();
        for (let i = 0; i < node.properties.length; i++) {
            const property = node.properties[i];
            if (ts.isPropertyAssignment(property)) {
                const name = this.stringNameFromPropertyName(property.name, context);
                // Check whether the name can be determined statically.
                if (name === undefined) {
                    return DynamicValue.fromDynamicInput(node, DynamicValue.fromDynamicString(property.name));
                }
                map.set(name, this.visitExpression(property.initializer, context));
            }
            else if (ts.isShorthandPropertyAssignment(property)) {
                const symbol = this.checker.getShorthandAssignmentValueSymbol(property);
                if (symbol === undefined || symbol.valueDeclaration === undefined) {
                    map.set(property.name.text, DynamicValue.fromUnknown(property));
                }
                else {
                    map.set(property.name.text, this.visitDeclaration(symbol.valueDeclaration, context));
                }
            }
            else if (ts.isSpreadAssignment(property)) {
                const spread = this.visitExpression(property.expression, context);
                if (spread instanceof DynamicValue) {
                    return DynamicValue.fromDynamicInput(node, spread);
                }
                else if (spread instanceof Map) {
                    spread.forEach((value, key) => map.set(key, value));
                }
                else if (spread instanceof ResolvedModule) {
                    spread.getExports().forEach((value, key) => map.set(key, value));
                }
                else {
                    return DynamicValue.fromDynamicInput(node, DynamicValue.fromInvalidExpressionType(property, spread));
                }
            }
            else {
                return DynamicValue.fromUnknown(node);
            }
        }
        return map;
    }
    visitTemplateExpression(node, context) {
        const pieces = [node.head.text];
        for (let i = 0; i < node.templateSpans.length; i++) {
            const span = node.templateSpans[i];
            const value = literal(this.visit(span.expression, context), () => DynamicValue.fromDynamicString(span.expression));
            if (value instanceof DynamicValue) {
                return DynamicValue.fromDynamicInput(node, value);
            }
            pieces.push(`${value}`, span.literal.text);
        }
        return pieces.join('');
    }
    visitIdentifier(node, context) {
        const decl = this.host.getDeclarationOfIdentifier(node);
        if (decl === null) {
            if (node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword) {
                return undefined;
            }
            else {
                // Check if the symbol here is imported.
                if (this.dependencyTracker !== null && this.host.getImportOfIdentifier(node) !== null) {
                    // It was, but no declaration for the node could be found. This means that the dependency
                    // graph for the current file cannot be properly updated to account for this (broken)
                    // import. Instead, the originating file is reported as failing dependency analysis,
                    // ensuring that future compilations will always attempt to re-resolve the previously
                    // broken identifier.
                    this.dependencyTracker.recordDependencyAnalysisFailure(context.originatingFile);
                }
                return DynamicValue.fromUnknownIdentifier(node);
            }
        }
        if (decl.known !== null) {
            return resolveKnownDeclaration(decl.known);
        }
        else if (isConcreteDeclaration(decl) && decl.identity !== null &&
            decl.identity.kind === 0 /* DownleveledEnum */) {
            return this.getResolvedEnum(decl.node, decl.identity.enumMembers, context);
        }
        const declContext = Object.assign(Object.assign({}, context), joinModuleContext(context, node, decl));
        const result = this.visitAmbiguousDeclaration(decl, declContext);
        if (result instanceof Reference) {
            // Only record identifiers to non-synthetic references. Synthetic references may not have the
            // same value at runtime as they do at compile time, so it's not legal to refer to them by the
            // identifier here.
            if (!result.synthetic) {
                result.addIdentifier(node);
            }
        }
        else if (result instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, result);
        }
        return result;
    }
    visitDeclaration(node, context) {
        if (this.dependencyTracker !== null) {
            this.dependencyTracker.addDependency(context.originatingFile, node.getSourceFile());
        }
        if (this.host.isClass(node)) {
            return this.getReference(node, context);
        }
        else if (ts.isVariableDeclaration(node)) {
            return this.visitVariableDeclaration(node, context);
        }
        else if (ts.isParameter(node) && context.scope.has(node)) {
            return context.scope.get(node);
        }
        else if (ts.isExportAssignment(node)) {
            return this.visitExpression(node.expression, context);
        }
        else if (ts.isEnumDeclaration(node)) {
            return this.visitEnumDeclaration(node, context);
        }
        else if (ts.isSourceFile(node)) {
            return this.visitSourceFile(node, context);
        }
        else if (ts.isBindingElement(node)) {
            return this.visitBindingElement(node, context);
        }
        else {
            return this.getReference(node, context);
        }
    }
    visitVariableDeclaration(node, context) {
        const value = this.host.getVariableValue(node);
        if (value !== null) {
            return this.visitExpression(value, context);
        }
        else if (isVariableDeclarationDeclared(node)) {
            // If the declaration has a literal type that can be statically reduced to a value, resolve to
            // that value. If not, the historical behavior for variable declarations is to return a
            // `Reference` to the variable, as the consumer could use it in a context where knowing its
            // static value is not necessary.
            //
            // Arguably, since the value cannot be statically determined, we should return a
            // `DynamicValue`. This returns a `Reference` because it's the same behavior as before
            // `visitType` was introduced.
            //
            // TODO(zarend): investigate switching to a `DynamicValue` and verify this won't break any
            // use cases, especially in ngcc
            if (node.type !== undefined) {
                const evaluatedType = this.visitType(node.type, context);
                if (!(evaluatedType instanceof DynamicValue)) {
                    return evaluatedType;
                }
            }
            return this.getReference(node, context);
        }
        else {
            return undefined;
        }
    }
    visitEnumDeclaration(node, context) {
        const enumRef = this.getReference(node, context);
        const map = new Map();
        node.members.forEach(member => {
            const name = this.stringNameFromPropertyName(member.name, context);
            if (name !== undefined) {
                const resolved = member.initializer && this.visit(member.initializer, context);
                map.set(name, new EnumValue(enumRef, name, resolved));
            }
        });
        return map;
    }
    visitElementAccessExpression(node, context) {
        const lhs = this.visitExpression(node.expression, context);
        if (lhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, lhs);
        }
        const rhs = this.visitExpression(node.argumentExpression, context);
        if (rhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, rhs);
        }
        if (typeof rhs !== 'string' && typeof rhs !== 'number') {
            return DynamicValue.fromInvalidExpressionType(node, rhs);
        }
        return this.accessHelper(node, lhs, rhs, context);
    }
    visitPropertyAccessExpression(node, context) {
        const lhs = this.visitExpression(node.expression, context);
        const rhs = node.name.text;
        // TODO: handle reference to class declaration.
        if (lhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, lhs);
        }
        return this.accessHelper(node, lhs, rhs, context);
    }
    visitSourceFile(node, context) {
        const declarations = this.host.getExportsOfModule(node);
        if (declarations === null) {
            return DynamicValue.fromUnknown(node);
        }
        return new ResolvedModule(declarations, decl => {
            if (decl.known !== null) {
                return resolveKnownDeclaration(decl.known);
            }
            const declContext = Object.assign(Object.assign({}, context), joinModuleContext(context, node, decl));
            // Visit both concrete and inline declarations.
            return this.visitAmbiguousDeclaration(decl, declContext);
        });
    }
    visitAmbiguousDeclaration(decl, declContext) {
        return decl.kind === 1 /* Inline */ && decl.implementation !== undefined &&
            !isDeclaration(decl.implementation) ?
            // Inline declarations whose `implementation` is a `ts.Expression` should be visited as
            // an expression.
            this.visitExpression(decl.implementation, declContext) :
            // Otherwise just visit the `node` as a declaration.
            this.visitDeclaration(decl.node, declContext);
    }
    accessHelper(node, lhs, rhs, context) {
        const strIndex = `${rhs}`;
        if (lhs instanceof Map) {
            if (lhs.has(strIndex)) {
                return lhs.get(strIndex);
            }
            else {
                return undefined;
            }
        }
        else if (lhs instanceof ResolvedModule) {
            return lhs.getExport(strIndex);
        }
        else if (Array.isArray(lhs)) {
            if (rhs === 'length') {
                return lhs.length;
            }
            else if (rhs === 'slice') {
                return new ArraySliceBuiltinFn(lhs);
            }
            else if (rhs === 'concat') {
                return new ArrayConcatBuiltinFn(lhs);
            }
            if (typeof rhs !== 'number' || !Number.isInteger(rhs)) {
                return DynamicValue.fromInvalidExpressionType(node, rhs);
            }
            return lhs[rhs];
        }
        else if (lhs instanceof Reference) {
            const ref = lhs.node;
            if (this.host.isClass(ref)) {
                const module = owningModule(context, lhs.bestGuessOwningModule);
                let value = undefined;
                const member = this.host.getMembersOfClass(ref).find(member => member.isStatic && member.name === strIndex);
                if (member !== undefined) {
                    if (member.value !== null) {
                        value = this.visitExpression(member.value, context);
                    }
                    else if (member.implementation !== null) {
                        value = new Reference(member.implementation, module);
                    }
                    else if (member.node) {
                        value = new Reference(member.node, module);
                    }
                }
                return value;
            }
            else if (isDeclaration(ref)) {
                return DynamicValue.fromDynamicInput(node, DynamicValue.fromExternalReference(ref, lhs));
            }
        }
        else if (lhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, lhs);
        }
        return DynamicValue.fromUnknown(node);
    }
    visitCallExpression(node, context) {
        const lhs = this.visitExpression(node.expression, context);
        if (lhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, lhs);
        }
        // If the call refers to a builtin function, attempt to evaluate the function.
        if (lhs instanceof KnownFn) {
            return lhs.evaluate(node, this.evaluateFunctionArguments(node, context));
        }
        if (!(lhs instanceof Reference)) {
            return DynamicValue.fromInvalidExpressionType(node.expression, lhs);
        }
        const fn = this.host.getDefinitionOfFunction(lhs.node);
        if (fn === null) {
            return DynamicValue.fromInvalidExpressionType(node.expression, lhs);
        }
        if (!isFunctionOrMethodReference(lhs)) {
            return DynamicValue.fromInvalidExpressionType(node.expression, lhs);
        }
        // If the function is foreign (declared through a d.ts file), attempt to resolve it with the
        // foreignFunctionResolver, if one is specified.
        if (fn.body === null) {
            let expr = null;
            if (context.foreignFunctionResolver) {
                expr = context.foreignFunctionResolver(lhs, node.arguments);
            }
            if (expr === null) {
                return DynamicValue.fromDynamicInput(node, DynamicValue.fromExternalReference(node.expression, lhs));
            }
            // If the function is declared in a different file, resolve the foreign function expression
            // using the absolute module name of that file (if any).
            if (lhs.bestGuessOwningModule !== null) {
                context = Object.assign(Object.assign({}, context), { absoluteModuleName: lhs.bestGuessOwningModule.specifier, resolutionContext: node.getSourceFile().fileName });
            }
            return this.visitFfrExpression(expr, context);
        }
        let res = this.visitFunctionBody(node, fn, context);
        // If the result of attempting to resolve the function body was a DynamicValue, attempt to use
        // the foreignFunctionResolver if one is present. This could still potentially yield a usable
        // value.
        if (res instanceof DynamicValue && context.foreignFunctionResolver !== undefined) {
            const ffrExpr = context.foreignFunctionResolver(lhs, node.arguments);
            if (ffrExpr !== null) {
                // The foreign function resolver was able to extract an expression from this function. See
                // if that expression leads to a non-dynamic result.
                const ffrRes = this.visitFfrExpression(ffrExpr, context);
                if (!(ffrRes instanceof DynamicValue)) {
                    // FFR yielded an actual result that's not dynamic, so use that instead of the original
                    // resolution.
                    res = ffrRes;
                }
            }
        }
        return res;
    }
    /**
     * Visit an expression which was extracted from a foreign-function resolver.
     *
     * This will process the result and ensure it's correct for FFR-resolved values, including marking
     * `Reference`s as synthetic.
     */
    visitFfrExpression(expr, context) {
        const res = this.visitExpression(expr, context);
        if (res instanceof Reference) {
            // This Reference was created synthetically, via a foreign function resolver. The real
            // runtime value of the function expression may be different than the foreign function
            // resolved value, so mark the Reference as synthetic to avoid it being misinterpreted.
            res.synthetic = true;
        }
        return res;
    }
    visitFunctionBody(node, fn, context) {
        if (fn.body === null) {
            return DynamicValue.fromUnknown(node);
        }
        else if (fn.body.length !== 1 || !ts.isReturnStatement(fn.body[0])) {
            return DynamicValue.fromComplexFunctionCall(node, fn);
        }
        const ret = fn.body[0];
        const args = this.evaluateFunctionArguments(node, context);
        const newScope = new Map();
        const calleeContext = Object.assign(Object.assign({}, context), { scope: newScope });
        fn.parameters.forEach((param, index) => {
            let arg = args[index];
            if (param.node.dotDotDotToken !== undefined) {
                arg = args.slice(index);
            }
            if (arg === undefined && param.initializer !== null) {
                arg = this.visitExpression(param.initializer, calleeContext);
            }
            newScope.set(param.node, arg);
        });
        return ret.expression !== undefined ? this.visitExpression(ret.expression, calleeContext) :
            undefined;
    }
    visitConditionalExpression(node, context) {
        const condition = this.visitExpression(node.condition, context);
        if (condition instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, condition);
        }
        if (condition) {
            return this.visitExpression(node.whenTrue, context);
        }
        else {
            return this.visitExpression(node.whenFalse, context);
        }
    }
    visitPrefixUnaryExpression(node, context) {
        const operatorKind = node.operator;
        if (!UNARY_OPERATORS.has(operatorKind)) {
            return DynamicValue.fromUnsupportedSyntax(node);
        }
        const op = UNARY_OPERATORS.get(operatorKind);
        const value = this.visitExpression(node.operand, context);
        if (value instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, value);
        }
        else {
            return op(value);
        }
    }
    visitBinaryExpression(node, context) {
        const tokenKind = node.operatorToken.kind;
        if (!BINARY_OPERATORS.has(tokenKind)) {
            return DynamicValue.fromUnsupportedSyntax(node);
        }
        const opRecord = BINARY_OPERATORS.get(tokenKind);
        let lhs, rhs;
        if (opRecord.literal) {
            lhs = literal(this.visitExpression(node.left, context), value => DynamicValue.fromInvalidExpressionType(node.left, value));
            rhs = literal(this.visitExpression(node.right, context), value => DynamicValue.fromInvalidExpressionType(node.right, value));
        }
        else {
            lhs = this.visitExpression(node.left, context);
            rhs = this.visitExpression(node.right, context);
        }
        if (lhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, lhs);
        }
        else if (rhs instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, rhs);
        }
        else {
            return opRecord.op(lhs, rhs);
        }
    }
    visitParenthesizedExpression(node, context) {
        return this.visitExpression(node.expression, context);
    }
    evaluateFunctionArguments(node, context) {
        const args = [];
        for (const arg of node.arguments) {
            if (ts.isSpreadElement(arg)) {
                args.push(...this.visitSpreadElement(arg, context));
            }
            else {
                args.push(this.visitExpression(arg, context));
            }
        }
        return args;
    }
    visitSpreadElement(node, context) {
        const spread = this.visitExpression(node.expression, context);
        if (spread instanceof DynamicValue) {
            return [DynamicValue.fromDynamicInput(node, spread)];
        }
        else if (!Array.isArray(spread)) {
            return [DynamicValue.fromInvalidExpressionType(node, spread)];
        }
        else {
            return spread;
        }
    }
    visitBindingElement(node, context) {
        const path = [];
        let closestDeclaration = node;
        while (ts.isBindingElement(closestDeclaration) ||
            ts.isArrayBindingPattern(closestDeclaration) ||
            ts.isObjectBindingPattern(closestDeclaration)) {
            if (ts.isBindingElement(closestDeclaration)) {
                path.unshift(closestDeclaration);
            }
            closestDeclaration = closestDeclaration.parent;
        }
        if (!ts.isVariableDeclaration(closestDeclaration) ||
            closestDeclaration.initializer === undefined) {
            return DynamicValue.fromUnknown(node);
        }
        let value = this.visit(closestDeclaration.initializer, context);
        for (const element of path) {
            let key;
            if (ts.isArrayBindingPattern(element.parent)) {
                key = element.parent.elements.indexOf(element);
            }
            else {
                const name = element.propertyName || element.name;
                if (ts.isIdentifier(name)) {
                    key = name.text;
                }
                else {
                    return DynamicValue.fromUnknown(element);
                }
            }
            value = this.accessHelper(element, value, key, context);
            if (value instanceof DynamicValue) {
                return value;
            }
        }
        return value;
    }
    stringNameFromPropertyName(node, context) {
        if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
            return node.text;
        }
        else if (ts.isComputedPropertyName(node)) {
            const literal = this.visitExpression(node.expression, context);
            return typeof literal === 'string' ? literal : undefined;
        }
        else {
            return undefined;
        }
    }
    getResolvedEnum(node, enumMembers, context) {
        const enumRef = this.getReference(node, context);
        const map = new Map();
        enumMembers.forEach(member => {
            const name = this.stringNameFromPropertyName(member.name, context);
            if (name !== undefined) {
                const resolved = this.visit(member.initializer, context);
                map.set(name, new EnumValue(enumRef, name, resolved));
            }
        });
        return map;
    }
    getReference(node, context) {
        return new Reference(node, owningModule(context));
    }
    visitType(node, context) {
        if (ts.isLiteralTypeNode(node)) {
            return this.visitExpression(node.literal, context);
        }
        else if (ts.isTupleTypeNode(node)) {
            return this.visitTupleType(node, context);
        }
        else if (ts.isNamedTupleMember(node)) {
            return this.visitType(node.type, context);
        }
        return DynamicValue.fromDynamicType(node);
    }
    visitTupleType(node, context) {
        const res = [];
        for (const elem of node.elements) {
            res.push(this.visitType(elem, context));
        }
        return res;
    }
}
function isFunctionOrMethodReference(ref) {
    return ts.isFunctionDeclaration(ref.node) || ts.isMethodDeclaration(ref.node) ||
        ts.isFunctionExpression(ref.node);
}
function literal(value, reject) {
    if (value instanceof EnumValue) {
        value = value.resolved;
    }
    if (value instanceof DynamicValue || value === null || value === undefined ||
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return reject(value);
}
function isVariableDeclarationDeclared(node) {
    if (node.parent === undefined || !ts.isVariableDeclarationList(node.parent)) {
        return false;
    }
    const declList = node.parent;
    if (declList.parent === undefined || !ts.isVariableStatement(declList.parent)) {
        return false;
    }
    const varStmt = declList.parent;
    return varStmt.modifiers !== undefined &&
        varStmt.modifiers.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword);
}
const EMPTY = {};
function joinModuleContext(existing, node, decl) {
    if (decl.viaModule !== null && decl.viaModule !== existing.absoluteModuleName) {
        return {
            absoluteModuleName: decl.viaModule,
            resolutionContext: node.getSourceFile().fileName,
        };
    }
    else {
        return EMPTY;
    }
}
function owningModule(context, override = null) {
    let specifier = context.absoluteModuleName;
    if (override !== null) {
        specifier = override.specifier;
    }
    if (specifier !== null) {
        return {
            specifier,
            resolutionContext: context.resolutionContext,
        };
    }
    else {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJwcmV0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3BhcnRpYWxfZXZhbHVhdG9yL3NyYy9pbnRlcnByZXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBR3hDLE9BQU8sRUFBZ0YscUJBQXFCLEVBQXlDLE1BQU0sa0JBQWtCLENBQUM7QUFDOUssT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRXhELE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUNwRSxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBRXZDLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQzVELE9BQU8sRUFBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBc0QsTUFBTSxVQUFVLENBQUM7QUFlakgsU0FBUyxlQUFlLENBQUMsRUFBMkI7SUFDbEQsT0FBTyxFQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsRUFBMkI7SUFDcEQsT0FBTyxFQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFDLENBQUM7QUFDOUIsQ0FBQztBQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLENBQW1DO0lBQ2pFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzNELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQy9ELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzlELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2hFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQy9ELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdEUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDcEUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLHVCQUF1QixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMzRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyw0QkFBNEIsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDaEYsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLHFCQUFxQixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4RSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsMkJBQTJCLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzlFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxzQ0FBc0MsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDMUYsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLHFCQUFxQixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEYsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLHVCQUF1QixFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzVFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDakUsQ0FBQyxDQUFDO0FBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQWlDO0lBQzlELENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVB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QjtTQUM3QyxDQUFDO0tBQ0g7U0FBTTtRQUNMLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge093bmluZ01vZHVsZX0gZnJvbSAnLi4vLi4vaW1wb3J0cy9zcmMvcmVmZXJlbmNlcyc7XG5pbXBvcnQge0RlcGVuZGVuY3lUcmFja2VyfSBmcm9tICcuLi8uLi9pbmNyZW1lbnRhbC9hcGknO1xuaW1wb3J0IHtEZWNsYXJhdGlvbiwgRGVjbGFyYXRpb25LaW5kLCBEZWNsYXJhdGlvbk5vZGUsIEVudW1NZW1iZXIsIEZ1bmN0aW9uRGVmaW5pdGlvbiwgaXNDb25jcmV0ZURlY2xhcmF0aW9uLCBSZWZsZWN0aW9uSG9zdCwgU3BlY2lhbERlY2xhcmF0aW9uS2luZH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge2lzRGVjbGFyYXRpb259IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0FycmF5Q29uY2F0QnVpbHRpbkZuLCBBcnJheVNsaWNlQnVpbHRpbkZufSBmcm9tICcuL2J1aWx0aW4nO1xuaW1wb3J0IHtEeW5hbWljVmFsdWV9IGZyb20gJy4vZHluYW1pYyc7XG5pbXBvcnQge0ZvcmVpZ25GdW5jdGlvblJlc29sdmVyfSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQge3Jlc29sdmVLbm93bkRlY2xhcmF0aW9ufSBmcm9tICcuL2tub3duX2RlY2xhcmF0aW9uJztcbmltcG9ydCB7RW51bVZhbHVlLCBLbm93bkZuLCBSZXNvbHZlZE1vZHVsZSwgUmVzb2x2ZWRWYWx1ZSwgUmVzb2x2ZWRWYWx1ZUFycmF5LCBSZXNvbHZlZFZhbHVlTWFwfSBmcm9tICcuL3Jlc3VsdCc7XG5cblxuXG4vKipcbiAqIFRyYWNrcyB0aGUgc2NvcGUgb2YgYSBmdW5jdGlvbiBib2R5LCB3aGljaCBpbmNsdWRlcyBgUmVzb2x2ZWRWYWx1ZWBzIGZvciB0aGUgcGFyYW1ldGVycyBvZiB0aGF0XG4gKiBib2R5LlxuICovXG50eXBlIFNjb3BlID0gTWFwPHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uLCBSZXNvbHZlZFZhbHVlPjtcblxuaW50ZXJmYWNlIEJpbmFyeU9wZXJhdG9yRGVmIHtcbiAgbGl0ZXJhbDogYm9vbGVhbjtcbiAgb3A6IChhOiBhbnksIGI6IGFueSkgPT4gUmVzb2x2ZWRWYWx1ZTtcbn1cblxuZnVuY3Rpb24gbGl0ZXJhbEJpbmFyeU9wKG9wOiAoYTogYW55LCBiOiBhbnkpID0+IGFueSk6IEJpbmFyeU9wZXJhdG9yRGVmIHtcbiAgcmV0dXJuIHtvcCwgbGl0ZXJhbDogdHJ1ZX07XG59XG5cbmZ1bmN0aW9uIHJlZmVyZW5jZUJpbmFyeU9wKG9wOiAoYTogYW55LCBiOiBhbnkpID0+IGFueSk6IEJpbmFyeU9wZXJhdG9yRGVmIHtcbiAgcmV0dXJuIHtvcCwgbGl0ZXJhbDogZmFsc2V9O1xufVxuXG5jb25zdCBCSU5BUllfT1BFUkFUT1JTID0gbmV3IE1hcDx0cy5TeW50YXhLaW5kLCBCaW5hcnlPcGVyYXRvckRlZj4oW1xuICBbdHMuU3ludGF4S2luZC5QbHVzVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSArIGIpXSxcbiAgW3RzLlN5bnRheEtpbmQuTWludXNUb2tlbiwgbGl0ZXJhbEJpbmFyeU9wKChhLCBiKSA9PiBhIC0gYildLFxuICBbdHMuU3ludGF4S2luZC5Bc3Rlcmlza1Rva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgKiBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLlNsYXNoVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSAvIGIpXSxcbiAgW3RzLlN5bnRheEtpbmQuUGVyY2VudFRva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgJSBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkFtcGVyc2FuZFRva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgJiBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkJhclRva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgfCBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkNhcmV0VG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSBeIGIpXSxcbiAgW3RzLlN5bnRheEtpbmQuTGVzc1RoYW5Ub2tlbiwgbGl0ZXJhbEJpbmFyeU9wKChhLCBiKSA9PiBhIDwgYildLFxuICBbdHMuU3ludGF4S2luZC5MZXNzVGhhbkVxdWFsc1Rva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgPD0gYildLFxuICBbdHMuU3ludGF4S2luZC5HcmVhdGVyVGhhblRva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgPiBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuRXF1YWxzVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSA+PSBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkVxdWFsc0VxdWFsc1Rva2VuLCBsaXRlcmFsQmluYXJ5T3AoKGEsIGIpID0+IGEgPT0gYildLFxuICBbdHMuU3ludGF4S2luZC5FcXVhbHNFcXVhbHNFcXVhbHNUb2tlbiwgbGl0ZXJhbEJpbmFyeU9wKChhLCBiKSA9PiBhID09PSBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkV4Y2xhbWF0aW9uRXF1YWxzVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSAhPSBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkV4Y2xhbWF0aW9uRXF1YWxzRXF1YWxzVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSAhPT0gYildLFxuICBbdHMuU3ludGF4S2luZC5MZXNzVGhhbkxlc3NUaGFuVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSA8PCBiKV0sXG4gIFt0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuR3JlYXRlclRoYW5Ub2tlbiwgbGl0ZXJhbEJpbmFyeU9wKChhLCBiKSA9PiBhID4+IGIpXSxcbiAgW3RzLlN5bnRheEtpbmQuR3JlYXRlclRoYW5HcmVhdGVyVGhhbkdyZWF0ZXJUaGFuVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gYSA+Pj4gYildLFxuICBbdHMuU3ludGF4S2luZC5Bc3Rlcmlza0FzdGVyaXNrVG9rZW4sIGxpdGVyYWxCaW5hcnlPcCgoYSwgYikgPT4gTWF0aC5wb3coYSwgYikpXSxcbiAgW3RzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW4sIHJlZmVyZW5jZUJpbmFyeU9wKChhLCBiKSA9PiBhICYmIGIpXSxcbiAgW3RzLlN5bnRheEtpbmQuQmFyQmFyVG9rZW4sIHJlZmVyZW5jZUJpbmFyeU9wKChhLCBiKSA9PiBhIHx8IGIpXVxuXSk7XG5cbmNvbnN0IFVOQVJZX09QRVJBVE9SUyA9IG5ldyBNYXA8dHMuU3ludGF4S2luZCwgKGE6IGFueSkgPT4gYW55PihbXG4gIFt0cy5TeW50YXhLaW5kLlRpbGRlVG9rZW4sIGEgPT4gfmFdLCBbdHMuU3ludGF4S2luZC5NaW51c1Rva2VuLCBhID0+IC1hXSxcbiAgW3RzLlN5bnRheEtpbmQuUGx1c1Rva2VuLCBhID0+ICthXSwgW3RzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25Ub2tlbiwgYSA9PiAhYV1cbl0pO1xuXG5pbnRlcmZhY2UgQ29udGV4dCB7XG4gIG9yaWdpbmF0aW5nRmlsZTogdHMuU291cmNlRmlsZTtcbiAgLyoqXG4gICAqIFRoZSBtb2R1bGUgbmFtZSAoaWYgYW55KSB3aGljaCB3YXMgdXNlZCB0byByZWFjaCB0aGUgY3VycmVudGx5IHJlc29sdmluZyBzeW1ib2xzLlxuICAgKi9cbiAgYWJzb2x1dGVNb2R1bGVOYW1lOiBzdHJpbmd8bnVsbDtcblxuICAvKipcbiAgICogQSBmaWxlIG5hbWUgcmVwcmVzZW50aW5nIHRoZSBjb250ZXh0IGluIHdoaWNoIHRoZSBjdXJyZW50IGBhYnNvbHV0ZU1vZHVsZU5hbWVgLCBpZiBhbnksIHdhc1xuICAgKiByZXNvbHZlZC5cbiAgICovXG4gIHJlc29sdXRpb25Db250ZXh0OiBzdHJpbmc7XG4gIHNjb3BlOiBTY29wZTtcbiAgZm9yZWlnbkZ1bmN0aW9uUmVzb2x2ZXI/OiBGb3JlaWduRnVuY3Rpb25SZXNvbHZlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRpY0ludGVycHJldGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGhvc3Q6IFJlZmxlY3Rpb25Ib3N0LCBwcml2YXRlIGNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLFxuICAgICAgcHJpdmF0ZSBkZXBlbmRlbmN5VHJhY2tlcjogRGVwZW5kZW5jeVRyYWNrZXJ8bnVsbCkge31cblxuICB2aXNpdChub2RlOiB0cy5FeHByZXNzaW9uLCBjb250ZXh0OiBDb250ZXh0KTogUmVzb2x2ZWRWYWx1ZSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKG5vZGUsIGNvbnRleHQpO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEV4cHJlc3Npb24obm9kZTogdHMuRXhwcmVzc2lvbiwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWUge1xuICAgIGxldCByZXN1bHQ6IFJlc29sdmVkVmFsdWU7XG4gICAgaWYgKG5vZGUua2luZCA9PT0gdHMuU3ludGF4S2luZC5UcnVlS2V5d29yZCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmIChub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuRmFsc2VLZXl3b3JkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIGlmIChub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuTnVsbEtleXdvcmQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAodHMuaXNTdHJpbmdMaXRlcmFsKG5vZGUpKSB7XG4gICAgICByZXR1cm4gbm9kZS50ZXh0O1xuICAgIH0gZWxzZSBpZiAodHMuaXNOb1N1YnN0aXR1dGlvblRlbXBsYXRlTGl0ZXJhbChub2RlKSkge1xuICAgICAgcmV0dXJuIG5vZGUudGV4dDtcbiAgICB9IGVsc2UgaWYgKHRzLmlzVGVtcGxhdGVFeHByZXNzaW9uKG5vZGUpKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLnZpc2l0VGVtcGxhdGVFeHByZXNzaW9uKG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNOdW1lcmljTGl0ZXJhbChub2RlKSkge1xuICAgICAgcmV0dXJuIHBhcnNlRmxvYXQobm9kZS50ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMudmlzaXRPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzSWRlbnRpZmllcihub2RlKSkge1xuICAgICAgcmVzdWx0ID0gdGhpcy52aXNpdElkZW50aWZpZXIobm9kZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgcmVzdWx0ID0gdGhpcy52aXNpdFByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzQ2FsbEV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMudmlzaXRDYWxsRXhwcmVzc2lvbihub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzQ29uZGl0aW9uYWxFeHByZXNzaW9uKG5vZGUpKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLnZpc2l0Q29uZGl0aW9uYWxFeHByZXNzaW9uKG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNQcmVmaXhVbmFyeUV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMudmlzaXRQcmVmaXhVbmFyeUV4cHJlc3Npb24obm9kZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmICh0cy5pc0JpbmFyeUV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMudmlzaXRCaW5hcnlFeHByZXNzaW9uKG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKG5vZGUpKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLnZpc2l0QXJyYXlMaXRlcmFsRXhwcmVzc2lvbihub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMudmlzaXRQYXJlbnRoZXNpemVkRXhwcmVzc2lvbihub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzRWxlbWVudEFjY2Vzc0V4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMudmlzaXRFbGVtZW50QWNjZXNzRXhwcmVzc2lvbihub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzQXNFeHByZXNzaW9uKG5vZGUpKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNOb25OdWxsRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgcmVzdWx0ID0gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaG9zdC5pc0NsYXNzKG5vZGUpKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLnZpc2l0RGVjbGFyYXRpb24obm9kZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbVVuc3VwcG9ydGVkU3ludGF4KG5vZGUpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlICYmIHJlc3VsdC5ub2RlICE9PSBub2RlKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljSW5wdXQobm9kZSwgcmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRBcnJheUxpdGVyYWxFeHByZXNzaW9uKG5vZGU6IHRzLkFycmF5TGl0ZXJhbEV4cHJlc3Npb24sIGNvbnRleHQ6IENvbnRleHQpOlxuICAgICAgUmVzb2x2ZWRWYWx1ZSB7XG4gICAgY29uc3QgYXJyYXk6IFJlc29sdmVkVmFsdWVBcnJheSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZWxlbWVudCA9IG5vZGUuZWxlbWVudHNbaV07XG4gICAgICBpZiAodHMuaXNTcHJlYWRFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICAgIGFycmF5LnB1c2goLi4udGhpcy52aXNpdFNwcmVhZEVsZW1lbnQoZWxlbWVudCwgY29udGV4dCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXJyYXkucHVzaCh0aGlzLnZpc2l0RXhwcmVzc2lvbihlbGVtZW50LCBjb250ZXh0KSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbiAgfVxuXG4gIHByb3RlY3RlZCB2aXNpdE9iamVjdExpdGVyYWxFeHByZXNzaW9uKG5vZGU6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uLCBjb250ZXh0OiBDb250ZXh0KTpcbiAgICAgIFJlc29sdmVkVmFsdWUge1xuICAgIGNvbnN0IG1hcDogUmVzb2x2ZWRWYWx1ZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBSZXNvbHZlZFZhbHVlPigpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5wcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IG5vZGUucHJvcGVydGllc1tpXTtcbiAgICAgIGlmICh0cy5pc1Byb3BlcnR5QXNzaWdubWVudChwcm9wZXJ0eSkpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMuc3RyaW5nTmFtZUZyb21Qcm9wZXJ0eU5hbWUocHJvcGVydHkubmFtZSwgY29udGV4dCk7XG4gICAgICAgIC8vIENoZWNrIHdoZXRoZXIgdGhlIG5hbWUgY2FuIGJlIGRldGVybWluZWQgc3RhdGljYWxseS5cbiAgICAgICAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNTdHJpbmcocHJvcGVydHkubmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIG1hcC5zZXQobmFtZSwgdGhpcy52aXNpdEV4cHJlc3Npb24ocHJvcGVydHkuaW5pdGlhbGl6ZXIsIGNvbnRleHQpKTtcbiAgICAgIH0gZWxzZSBpZiAodHMuaXNTaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcGVydHkpKSB7XG4gICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuY2hlY2tlci5nZXRTaG9ydGhhbmRBc3NpZ25tZW50VmFsdWVTeW1ib2wocHJvcGVydHkpO1xuICAgICAgICBpZiAoc3ltYm9sID09PSB1bmRlZmluZWQgfHwgc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIG1hcC5zZXQocHJvcGVydHkubmFtZS50ZXh0LCBEeW5hbWljVmFsdWUuZnJvbVVua25vd24ocHJvcGVydHkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXAuc2V0KHByb3BlcnR5Lm5hbWUudGV4dCwgdGhpcy52aXNpdERlY2xhcmF0aW9uKHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uLCBjb250ZXh0KSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHMuaXNTcHJlYWRBc3NpZ25tZW50KHByb3BlcnR5KSkge1xuICAgICAgICBjb25zdCBzcHJlYWQgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihwcm9wZXJ0eS5leHByZXNzaW9uLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKHNwcmVhZCBpbnN0YW5jZW9mIER5bmFtaWNWYWx1ZSkge1xuICAgICAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCBzcHJlYWQpO1xuICAgICAgICB9IGVsc2UgaWYgKHNwcmVhZCBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgICAgIHNwcmVhZC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBtYXAuc2V0KGtleSwgdmFsdWUpKTtcbiAgICAgICAgfSBlbHNlIGlmIChzcHJlYWQgaW5zdGFuY2VvZiBSZXNvbHZlZE1vZHVsZSkge1xuICAgICAgICAgIHNwcmVhZC5nZXRFeHBvcnRzKCkuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gbWFwLnNldChrZXksIHZhbHVlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KFxuICAgICAgICAgICAgICBub2RlLCBEeW5hbWljVmFsdWUuZnJvbUludmFsaWRFeHByZXNzaW9uVHlwZShwcm9wZXJ0eSwgc3ByZWFkKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbVVua25vd24obm9kZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtYXA7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0VGVtcGxhdGVFeHByZXNzaW9uKG5vZGU6IHRzLlRlbXBsYXRlRXhwcmVzc2lvbiwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWUge1xuICAgIGNvbnN0IHBpZWNlczogc3RyaW5nW10gPSBbbm9kZS5oZWFkLnRleHRdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS50ZW1wbGF0ZVNwYW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzcGFuID0gbm9kZS50ZW1wbGF0ZVNwYW5zW2ldO1xuICAgICAgY29uc3QgdmFsdWUgPSBsaXRlcmFsKFxuICAgICAgICAgIHRoaXMudmlzaXQoc3Bhbi5leHByZXNzaW9uLCBjb250ZXh0KSxcbiAgICAgICAgICAoKSA9PiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNTdHJpbmcoc3Bhbi5leHByZXNzaW9uKSk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KG5vZGUsIHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHBpZWNlcy5wdXNoKGAke3ZhbHVlfWAsIHNwYW4ubGl0ZXJhbC50ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHBpZWNlcy5qb2luKCcnKTtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRJZGVudGlmaWVyKG5vZGU6IHRzLklkZW50aWZpZXIsIGNvbnRleHQ6IENvbnRleHQpOiBSZXNvbHZlZFZhbHVlIHtcbiAgICBjb25zdCBkZWNsID0gdGhpcy5ob3N0LmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKG5vZGUpO1xuICAgIGlmIChkZWNsID09PSBudWxsKSB7XG4gICAgICBpZiAobm9kZS5vcmlnaW5hbEtleXdvcmRLaW5kID09PSB0cy5TeW50YXhLaW5kLlVuZGVmaW5lZEtleXdvcmQpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGlmIHRoZSBzeW1ib2wgaGVyZSBpcyBpbXBvcnRlZC5cbiAgICAgICAgaWYgKHRoaXMuZGVwZW5kZW5jeVRyYWNrZXIgIT09IG51bGwgJiYgdGhpcy5ob3N0LmdldEltcG9ydE9mSWRlbnRpZmllcihub2RlKSAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIEl0IHdhcywgYnV0IG5vIGRlY2xhcmF0aW9uIGZvciB0aGUgbm9kZSBjb3VsZCBiZSBmb3VuZC4gVGhpcyBtZWFucyB0aGF0IHRoZSBkZXBlbmRlbmN5XG4gICAgICAgICAgLy8gZ3JhcGggZm9yIHRoZSBjdXJyZW50IGZpbGUgY2Fubm90IGJlIHByb3Blcmx5IHVwZGF0ZWQgdG8gYWNjb3VudCBmb3IgdGhpcyAoYnJva2VuKVxuICAgICAgICAgIC8vIGltcG9ydC4gSW5zdGVhZCwgdGhlIG9yaWdpbmF0aW5nIGZpbGUgaXMgcmVwb3J0ZWQgYXMgZmFpbGluZyBkZXBlbmRlbmN5IGFuYWx5c2lzLFxuICAgICAgICAgIC8vIGVuc3VyaW5nIHRoYXQgZnV0dXJlIGNvbXBpbGF0aW9ucyB3aWxsIGFsd2F5cyBhdHRlbXB0IHRvIHJlLXJlc29sdmUgdGhlIHByZXZpb3VzbHlcbiAgICAgICAgICAvLyBicm9rZW4gaWRlbnRpZmllci5cbiAgICAgICAgICB0aGlzLmRlcGVuZGVuY3lUcmFja2VyLnJlY29yZERlcGVuZGVuY3lBbmFseXNpc0ZhaWx1cmUoY29udGV4dC5vcmlnaW5hdGluZ0ZpbGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbVVua25vd25JZGVudGlmaWVyKG5vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZGVjbC5rbm93biAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVLbm93bkRlY2xhcmF0aW9uKGRlY2wua25vd24pO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGlzQ29uY3JldGVEZWNsYXJhdGlvbihkZWNsKSAmJiBkZWNsLmlkZW50aXR5ICE9PSBudWxsICYmXG4gICAgICAgIGRlY2wuaWRlbnRpdHkua2luZCA9PT0gU3BlY2lhbERlY2xhcmF0aW9uS2luZC5Eb3dubGV2ZWxlZEVudW0pIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFJlc29sdmVkRW51bShkZWNsLm5vZGUsIGRlY2wuaWRlbnRpdHkuZW51bU1lbWJlcnMsIGNvbnRleHQpO1xuICAgIH1cbiAgICBjb25zdCBkZWNsQ29udGV4dCA9IHsuLi5jb250ZXh0LCAuLi5qb2luTW9kdWxlQ29udGV4dChjb250ZXh0LCBub2RlLCBkZWNsKX07XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy52aXNpdEFtYmlndW91c0RlY2xhcmF0aW9uKGRlY2wsIGRlY2xDb250ZXh0KTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUmVmZXJlbmNlKSB7XG4gICAgICAvLyBPbmx5IHJlY29yZCBpZGVudGlmaWVycyB0byBub24tc3ludGhldGljIHJlZmVyZW5jZXMuIFN5bnRoZXRpYyByZWZlcmVuY2VzIG1heSBub3QgaGF2ZSB0aGVcbiAgICAgIC8vIHNhbWUgdmFsdWUgYXQgcnVudGltZSBhcyB0aGV5IGRvIGF0IGNvbXBpbGUgdGltZSwgc28gaXQncyBub3QgbGVnYWwgdG8gcmVmZXIgdG8gdGhlbSBieSB0aGVcbiAgICAgIC8vIGlkZW50aWZpZXIgaGVyZS5cbiAgICAgIGlmICghcmVzdWx0LnN5bnRoZXRpYykge1xuICAgICAgICByZXN1bHQuYWRkSWRlbnRpZmllcihub2RlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIER5bmFtaWNWYWx1ZSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KG5vZGUsIHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0RGVjbGFyYXRpb24obm9kZTogRGVjbGFyYXRpb25Ob2RlLCBjb250ZXh0OiBDb250ZXh0KTogUmVzb2x2ZWRWYWx1ZSB7XG4gICAgaWYgKHRoaXMuZGVwZW5kZW5jeVRyYWNrZXIgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZGVwZW5kZW5jeVRyYWNrZXIuYWRkRGVwZW5kZW5jeShjb250ZXh0Lm9yaWdpbmF0aW5nRmlsZSwgbm9kZS5nZXRTb3VyY2VGaWxlKCkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5ob3N0LmlzQ2xhc3Mobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFJlZmVyZW5jZShub2RlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbihub2RlKSkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNQYXJhbWV0ZXIobm9kZSkgJiYgY29udGV4dC5zY29wZS5oYXMobm9kZSkpIHtcbiAgICAgIHJldHVybiBjb250ZXh0LnNjb3BlLmdldChub2RlKSE7XG4gICAgfSBlbHNlIGlmICh0cy5pc0V4cG9ydEFzc2lnbm1lbnQobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNFbnVtRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0RW51bURlY2xhcmF0aW9uKG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNTb3VyY2VGaWxlKG5vZGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdFNvdXJjZUZpbGUobm9kZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmICh0cy5pc0JpbmRpbmdFbGVtZW50KG5vZGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdEJpbmRpbmdFbGVtZW50KG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRSZWZlcmVuY2Uobm9kZSwgY29udGV4dCk7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgdmlzaXRWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGU6IHRzLlZhcmlhYmxlRGVjbGFyYXRpb24sIGNvbnRleHQ6IENvbnRleHQpOiBSZXNvbHZlZFZhbHVlIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaG9zdC5nZXRWYXJpYWJsZVZhbHVlKG5vZGUpO1xuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKHZhbHVlLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKGlzVmFyaWFibGVEZWNsYXJhdGlvbkRlY2xhcmVkKG5vZGUpKSB7XG4gICAgICAvLyBJZiB0aGUgZGVjbGFyYXRpb24gaGFzIGEgbGl0ZXJhbCB0eXBlIHRoYXQgY2FuIGJlIHN0YXRpY2FsbHkgcmVkdWNlZCB0byBhIHZhbHVlLCByZXNvbHZlIHRvXG4gICAgICAvLyB0aGF0IHZhbHVlLiBJZiBub3QsIHRoZSBoaXN0b3JpY2FsIGJlaGF2aW9yIGZvciB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgaXMgdG8gcmV0dXJuIGFcbiAgICAgIC8vIGBSZWZlcmVuY2VgIHRvIHRoZSB2YXJpYWJsZSwgYXMgdGhlIGNvbnN1bWVyIGNvdWxkIHVzZSBpdCBpbiBhIGNvbnRleHQgd2hlcmUga25vd2luZyBpdHNcbiAgICAgIC8vIHN0YXRpYyB2YWx1ZSBpcyBub3QgbmVjZXNzYXJ5LlxuICAgICAgLy9cbiAgICAgIC8vIEFyZ3VhYmx5LCBzaW5jZSB0aGUgdmFsdWUgY2Fubm90IGJlIHN0YXRpY2FsbHkgZGV0ZXJtaW5lZCwgd2Ugc2hvdWxkIHJldHVybiBhXG4gICAgICAvLyBgRHluYW1pY1ZhbHVlYC4gVGhpcyByZXR1cm5zIGEgYFJlZmVyZW5jZWAgYmVjYXVzZSBpdCdzIHRoZSBzYW1lIGJlaGF2aW9yIGFzIGJlZm9yZVxuICAgICAgLy8gYHZpc2l0VHlwZWAgd2FzIGludHJvZHVjZWQuXG4gICAgICAvL1xuICAgICAgLy8gVE9ETyh6YXJlbmQpOiBpbnZlc3RpZ2F0ZSBzd2l0Y2hpbmcgdG8gYSBgRHluYW1pY1ZhbHVlYCBhbmQgdmVyaWZ5IHRoaXMgd29uJ3QgYnJlYWsgYW55XG4gICAgICAvLyB1c2UgY2FzZXMsIGVzcGVjaWFsbHkgaW4gbmdjY1xuICAgICAgaWYgKG5vZGUudHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IGV2YWx1YXRlZFR5cGUgPSB0aGlzLnZpc2l0VHlwZShub2RlLnR5cGUsIGNvbnRleHQpO1xuICAgICAgICBpZiAoIShldmFsdWF0ZWRUeXBlIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBldmFsdWF0ZWRUeXBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5nZXRSZWZlcmVuY2Uobm9kZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEVudW1EZWNsYXJhdGlvbihub2RlOiB0cy5FbnVtRGVjbGFyYXRpb24sIGNvbnRleHQ6IENvbnRleHQpOiBSZXNvbHZlZFZhbHVlIHtcbiAgICBjb25zdCBlbnVtUmVmID0gdGhpcy5nZXRSZWZlcmVuY2Uobm9kZSwgY29udGV4dCk7XG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEVudW1WYWx1ZT4oKTtcbiAgICBub2RlLm1lbWJlcnMuZm9yRWFjaChtZW1iZXIgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuc3RyaW5nTmFtZUZyb21Qcm9wZXJ0eU5hbWUobWVtYmVyLm5hbWUsIGNvbnRleHQpO1xuICAgICAgaWYgKG5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IG1lbWJlci5pbml0aWFsaXplciAmJiB0aGlzLnZpc2l0KG1lbWJlci5pbml0aWFsaXplciwgY29udGV4dCk7XG4gICAgICAgIG1hcC5zZXQobmFtZSwgbmV3IEVudW1WYWx1ZShlbnVtUmVmLCBuYW1lLCByZXNvbHZlZCkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBtYXA7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0RWxlbWVudEFjY2Vzc0V4cHJlc3Npb24obm9kZTogdHMuRWxlbWVudEFjY2Vzc0V4cHJlc3Npb24sIGNvbnRleHQ6IENvbnRleHQpOlxuICAgICAgUmVzb2x2ZWRWYWx1ZSB7XG4gICAgY29uc3QgbGhzID0gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uLCBjb250ZXh0KTtcbiAgICBpZiAobGhzIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljSW5wdXQobm9kZSwgbGhzKTtcbiAgICB9XG4gICAgY29uc3QgcmhzID0gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5hcmd1bWVudEV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgIGlmIChyaHMgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCByaHMpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHJocyAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIHJocyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUludmFsaWRFeHByZXNzaW9uVHlwZShub2RlLCByaHMpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmFjY2Vzc0hlbHBlcihub2RlLCBsaHMsIHJocywgY29udGV4dCk7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0UHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG5vZGU6IHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbiwgY29udGV4dDogQ29udGV4dCk6XG4gICAgICBSZXNvbHZlZFZhbHVlIHtcbiAgICBjb25zdCBsaHMgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgIGNvbnN0IHJocyA9IG5vZGUubmFtZS50ZXh0O1xuICAgIC8vIFRPRE86IGhhbmRsZSByZWZlcmVuY2UgdG8gY2xhc3MgZGVjbGFyYXRpb24uXG4gICAgaWYgKGxocyBpbnN0YW5jZW9mIER5bmFtaWNWYWx1ZSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KG5vZGUsIGxocyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFjY2Vzc0hlbHBlcihub2RlLCBsaHMsIHJocywgY29udGV4dCk7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0U291cmNlRmlsZShub2RlOiB0cy5Tb3VyY2VGaWxlLCBjb250ZXh0OiBDb250ZXh0KTogUmVzb2x2ZWRWYWx1ZSB7XG4gICAgY29uc3QgZGVjbGFyYXRpb25zID0gdGhpcy5ob3N0LmdldEV4cG9ydHNPZk1vZHVsZShub2RlKTtcbiAgICBpZiAoZGVjbGFyYXRpb25zID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21Vbmtub3duKG5vZGUpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUmVzb2x2ZWRNb2R1bGUoZGVjbGFyYXRpb25zLCBkZWNsID0+IHtcbiAgICAgIGlmIChkZWNsLmtub3duICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlS25vd25EZWNsYXJhdGlvbihkZWNsLmtub3duKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGVjbENvbnRleHQgPSB7XG4gICAgICAgIC4uLmNvbnRleHQsXG4gICAgICAgIC4uLmpvaW5Nb2R1bGVDb250ZXh0KGNvbnRleHQsIG5vZGUsIGRlY2wpLFxuICAgICAgfTtcblxuICAgICAgLy8gVmlzaXQgYm90aCBjb25jcmV0ZSBhbmQgaW5saW5lIGRlY2xhcmF0aW9ucy5cbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QW1iaWd1b3VzRGVjbGFyYXRpb24oZGVjbCwgZGVjbENvbnRleHQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEFtYmlndW91c0RlY2xhcmF0aW9uKGRlY2w6IERlY2xhcmF0aW9uLCBkZWNsQ29udGV4dDogQ29udGV4dCkge1xuICAgIHJldHVybiBkZWNsLmtpbmQgPT09IERlY2xhcmF0aW9uS2luZC5JbmxpbmUgJiYgZGVjbC5pbXBsZW1lbnRhdGlvbiAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICAhaXNEZWNsYXJhdGlvbihkZWNsLmltcGxlbWVudGF0aW9uKSA/XG4gICAgICAgIC8vIElubGluZSBkZWNsYXJhdGlvbnMgd2hvc2UgYGltcGxlbWVudGF0aW9uYCBpcyBhIGB0cy5FeHByZXNzaW9uYCBzaG91bGQgYmUgdmlzaXRlZCBhc1xuICAgICAgICAvLyBhbiBleHByZXNzaW9uLlxuICAgICAgICB0aGlzLnZpc2l0RXhwcmVzc2lvbihkZWNsLmltcGxlbWVudGF0aW9uLCBkZWNsQ29udGV4dCkgOlxuICAgICAgICAvLyBPdGhlcndpc2UganVzdCB2aXNpdCB0aGUgYG5vZGVgIGFzIGEgZGVjbGFyYXRpb24uXG4gICAgICAgIHRoaXMudmlzaXREZWNsYXJhdGlvbihkZWNsLm5vZGUsIGRlY2xDb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgYWNjZXNzSGVscGVyKG5vZGU6IHRzLk5vZGUsIGxoczogUmVzb2x2ZWRWYWx1ZSwgcmhzOiBzdHJpbmd8bnVtYmVyLCBjb250ZXh0OiBDb250ZXh0KTpcbiAgICAgIFJlc29sdmVkVmFsdWUge1xuICAgIGNvbnN0IHN0ckluZGV4ID0gYCR7cmhzfWA7XG4gICAgaWYgKGxocyBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgaWYgKGxocy5oYXMoc3RySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBsaHMuZ2V0KHN0ckluZGV4KSE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGhzIGluc3RhbmNlb2YgUmVzb2x2ZWRNb2R1bGUpIHtcbiAgICAgIHJldHVybiBsaHMuZ2V0RXhwb3J0KHN0ckluZGV4KTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkobGhzKSkge1xuICAgICAgaWYgKHJocyA9PT0gJ2xlbmd0aCcpIHtcbiAgICAgICAgcmV0dXJuIGxocy5sZW5ndGg7XG4gICAgICB9IGVsc2UgaWYgKHJocyA9PT0gJ3NsaWNlJykge1xuICAgICAgICByZXR1cm4gbmV3IEFycmF5U2xpY2VCdWlsdGluRm4obGhzKTtcbiAgICAgIH0gZWxzZSBpZiAocmhzID09PSAnY29uY2F0Jykge1xuICAgICAgICByZXR1cm4gbmV3IEFycmF5Q29uY2F0QnVpbHRpbkZuKGxocyk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHJocyAhPT0gJ251bWJlcicgfHwgIU51bWJlci5pc0ludGVnZXIocmhzKSkge1xuICAgICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21JbnZhbGlkRXhwcmVzc2lvblR5cGUobm9kZSwgcmhzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsaHNbcmhzXTtcbiAgICB9IGVsc2UgaWYgKGxocyBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgICAgY29uc3QgcmVmID0gbGhzLm5vZGU7XG4gICAgICBpZiAodGhpcy5ob3N0LmlzQ2xhc3MocmVmKSkge1xuICAgICAgICBjb25zdCBtb2R1bGUgPSBvd25pbmdNb2R1bGUoY29udGV4dCwgbGhzLmJlc3RHdWVzc093bmluZ01vZHVsZSk7XG4gICAgICAgIGxldCB2YWx1ZTogUmVzb2x2ZWRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgbWVtYmVyID0gdGhpcy5ob3N0LmdldE1lbWJlcnNPZkNsYXNzKHJlZikuZmluZChcbiAgICAgICAgICAgIG1lbWJlciA9PiBtZW1iZXIuaXNTdGF0aWMgJiYgbWVtYmVyLm5hbWUgPT09IHN0ckluZGV4KTtcbiAgICAgICAgaWYgKG1lbWJlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKG1lbWJlci52YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihtZW1iZXIudmFsdWUsIGNvbnRleHQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVtYmVyLmltcGxlbWVudGF0aW9uICE9PSBudWxsKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ldyBSZWZlcmVuY2UobWVtYmVyLmltcGxlbWVudGF0aW9uLCBtb2R1bGUpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVtYmVyLm5vZGUpIHtcbiAgICAgICAgICAgIHZhbHVlID0gbmV3IFJlZmVyZW5jZShtZW1iZXIubm9kZSwgbW9kdWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChpc0RlY2xhcmF0aW9uKHJlZikpIHtcbiAgICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KFxuICAgICAgICAgICAgbm9kZSwgRHluYW1pY1ZhbHVlLmZyb21FeHRlcm5hbFJlZmVyZW5jZShyZWYsIGxocyBhcyBSZWZlcmVuY2U8dHMuRGVjbGFyYXRpb24+KSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChsaHMgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCBsaHMpO1xuICAgIH1cblxuICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbVVua25vd24obm9kZSk7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0Q2FsbEV4cHJlc3Npb24obm9kZTogdHMuQ2FsbEV4cHJlc3Npb24sIGNvbnRleHQ6IENvbnRleHQpOiBSZXNvbHZlZFZhbHVlIHtcbiAgICBjb25zdCBsaHMgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgIGlmIChsaHMgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCBsaHMpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBjYWxsIHJlZmVycyB0byBhIGJ1aWx0aW4gZnVuY3Rpb24sIGF0dGVtcHQgdG8gZXZhbHVhdGUgdGhlIGZ1bmN0aW9uLlxuICAgIGlmIChsaHMgaW5zdGFuY2VvZiBLbm93bkZuKSB7XG4gICAgICByZXR1cm4gbGhzLmV2YWx1YXRlKG5vZGUsIHRoaXMuZXZhbHVhdGVGdW5jdGlvbkFyZ3VtZW50cyhub2RlLCBjb250ZXh0KSk7XG4gICAgfVxuXG4gICAgaWYgKCEobGhzIGluc3RhbmNlb2YgUmVmZXJlbmNlKSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tSW52YWxpZEV4cHJlc3Npb25UeXBlKG5vZGUuZXhwcmVzc2lvbiwgbGhzKTtcbiAgICB9XG5cbiAgICBjb25zdCBmbiA9IHRoaXMuaG9zdC5nZXREZWZpbml0aW9uT2ZGdW5jdGlvbihsaHMubm9kZSk7XG4gICAgaWYgKGZuID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21JbnZhbGlkRXhwcmVzc2lvblR5cGUobm9kZS5leHByZXNzaW9uLCBsaHMpO1xuICAgIH1cblxuICAgIGlmICghaXNGdW5jdGlvbk9yTWV0aG9kUmVmZXJlbmNlKGxocykpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUludmFsaWRFeHByZXNzaW9uVHlwZShub2RlLmV4cHJlc3Npb24sIGxocyk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIGZ1bmN0aW9uIGlzIGZvcmVpZ24gKGRlY2xhcmVkIHRocm91Z2ggYSBkLnRzIGZpbGUpLCBhdHRlbXB0IHRvIHJlc29sdmUgaXQgd2l0aCB0aGVcbiAgICAvLyBmb3JlaWduRnVuY3Rpb25SZXNvbHZlciwgaWYgb25lIGlzIHNwZWNpZmllZC5cbiAgICBpZiAoZm4uYm9keSA9PT0gbnVsbCkge1xuICAgICAgbGV0IGV4cHI6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgICBpZiAoY29udGV4dC5mb3JlaWduRnVuY3Rpb25SZXNvbHZlcikge1xuICAgICAgICBleHByID0gY29udGV4dC5mb3JlaWduRnVuY3Rpb25SZXNvbHZlcihsaHMsIG5vZGUuYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICAgIGlmIChleHByID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChcbiAgICAgICAgICAgIG5vZGUsIER5bmFtaWNWYWx1ZS5mcm9tRXh0ZXJuYWxSZWZlcmVuY2Uobm9kZS5leHByZXNzaW9uLCBsaHMpKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIGZ1bmN0aW9uIGlzIGRlY2xhcmVkIGluIGEgZGlmZmVyZW50IGZpbGUsIHJlc29sdmUgdGhlIGZvcmVpZ24gZnVuY3Rpb24gZXhwcmVzc2lvblxuICAgICAgLy8gdXNpbmcgdGhlIGFic29sdXRlIG1vZHVsZSBuYW1lIG9mIHRoYXQgZmlsZSAoaWYgYW55KS5cbiAgICAgIGlmIChsaHMuYmVzdEd1ZXNzT3duaW5nTW9kdWxlICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnRleHQgPSB7XG4gICAgICAgICAgLi4uY29udGV4dCxcbiAgICAgICAgICBhYnNvbHV0ZU1vZHVsZU5hbWU6IGxocy5iZXN0R3Vlc3NPd25pbmdNb2R1bGUuc3BlY2lmaWVyLFxuICAgICAgICAgIHJlc29sdXRpb25Db250ZXh0OiBub2RlLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMudmlzaXRGZnJFeHByZXNzaW9uKGV4cHIsIGNvbnRleHQpO1xuICAgIH1cblxuICAgIGxldCByZXM6IFJlc29sdmVkVmFsdWUgPSB0aGlzLnZpc2l0RnVuY3Rpb25Cb2R5KG5vZGUsIGZuLCBjb250ZXh0KTtcblxuICAgIC8vIElmIHRoZSByZXN1bHQgb2YgYXR0ZW1wdGluZyB0byByZXNvbHZlIHRoZSBmdW5jdGlvbiBib2R5IHdhcyBhIER5bmFtaWNWYWx1ZSwgYXR0ZW1wdCB0byB1c2VcbiAgICAvLyB0aGUgZm9yZWlnbkZ1bmN0aW9uUmVzb2x2ZXIgaWYgb25lIGlzIHByZXNlbnQuIFRoaXMgY291bGQgc3RpbGwgcG90ZW50aWFsbHkgeWllbGQgYSB1c2FibGVcbiAgICAvLyB2YWx1ZS5cbiAgICBpZiAocmVzIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlICYmIGNvbnRleHQuZm9yZWlnbkZ1bmN0aW9uUmVzb2x2ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZmZyRXhwciA9IGNvbnRleHQuZm9yZWlnbkZ1bmN0aW9uUmVzb2x2ZXIobGhzLCBub2RlLmFyZ3VtZW50cyk7XG4gICAgICBpZiAoZmZyRXhwciAhPT0gbnVsbCkge1xuICAgICAgICAvLyBUaGUgZm9yZWlnbiBmdW5jdGlvbiByZXNvbHZlciB3YXMgYWJsZSB0byBleHRyYWN0IGFuIGV4cHJlc3Npb24gZnJvbSB0aGlzIGZ1bmN0aW9uLiBTZWVcbiAgICAgICAgLy8gaWYgdGhhdCBleHByZXNzaW9uIGxlYWRzIHRvIGEgbm9uLWR5bmFtaWMgcmVzdWx0LlxuICAgICAgICBjb25zdCBmZnJSZXMgPSB0aGlzLnZpc2l0RmZyRXhwcmVzc2lvbihmZnJFeHByLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKCEoZmZyUmVzIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSkge1xuICAgICAgICAgIC8vIEZGUiB5aWVsZGVkIGFuIGFjdHVhbCByZXN1bHQgdGhhdCdzIG5vdCBkeW5hbWljLCBzbyB1c2UgdGhhdCBpbnN0ZWFkIG9mIHRoZSBvcmlnaW5hbFxuICAgICAgICAgIC8vIHJlc29sdXRpb24uXG4gICAgICAgICAgcmVzID0gZmZyUmVzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBWaXNpdCBhbiBleHByZXNzaW9uIHdoaWNoIHdhcyBleHRyYWN0ZWQgZnJvbSBhIGZvcmVpZ24tZnVuY3Rpb24gcmVzb2x2ZXIuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBwcm9jZXNzIHRoZSByZXN1bHQgYW5kIGVuc3VyZSBpdCdzIGNvcnJlY3QgZm9yIEZGUi1yZXNvbHZlZCB2YWx1ZXMsIGluY2x1ZGluZyBtYXJraW5nXG4gICAqIGBSZWZlcmVuY2VgcyBhcyBzeW50aGV0aWMuXG4gICAqL1xuICBwcml2YXRlIHZpc2l0RmZyRXhwcmVzc2lvbihleHByOiB0cy5FeHByZXNzaW9uLCBjb250ZXh0OiBDb250ZXh0KTogUmVzb2x2ZWRWYWx1ZSB7XG4gICAgY29uc3QgcmVzID0gdGhpcy52aXNpdEV4cHJlc3Npb24oZXhwciwgY29udGV4dCk7XG4gICAgaWYgKHJlcyBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgICAgLy8gVGhpcyBSZWZlcmVuY2Ugd2FzIGNyZWF0ZWQgc3ludGhldGljYWxseSwgdmlhIGEgZm9yZWlnbiBmdW5jdGlvbiByZXNvbHZlci4gVGhlIHJlYWxcbiAgICAgIC8vIHJ1bnRpbWUgdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIGV4cHJlc3Npb24gbWF5IGJlIGRpZmZlcmVudCB0aGFuIHRoZSBmb3JlaWduIGZ1bmN0aW9uXG4gICAgICAvLyByZXNvbHZlZCB2YWx1ZSwgc28gbWFyayB0aGUgUmVmZXJlbmNlIGFzIHN5bnRoZXRpYyB0byBhdm9pZCBpdCBiZWluZyBtaXNpbnRlcnByZXRlZC5cbiAgICAgIHJlcy5zeW50aGV0aWMgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEZ1bmN0aW9uQm9keShub2RlOiB0cy5DYWxsRXhwcmVzc2lvbiwgZm46IEZ1bmN0aW9uRGVmaW5pdGlvbiwgY29udGV4dDogQ29udGV4dCk6XG4gICAgICBSZXNvbHZlZFZhbHVlIHtcbiAgICBpZiAoZm4uYm9keSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tVW5rbm93bihub2RlKTtcbiAgICB9IGVsc2UgaWYgKGZuLmJvZHkubGVuZ3RoICE9PSAxIHx8ICF0cy5pc1JldHVyblN0YXRlbWVudChmbi5ib2R5WzBdKSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tQ29tcGxleEZ1bmN0aW9uQ2FsbChub2RlLCBmbik7XG4gICAgfVxuICAgIGNvbnN0IHJldCA9IGZuLmJvZHlbMF0gYXMgdHMuUmV0dXJuU3RhdGVtZW50O1xuXG4gICAgY29uc3QgYXJncyA9IHRoaXMuZXZhbHVhdGVGdW5jdGlvbkFyZ3VtZW50cyhub2RlLCBjb250ZXh0KTtcbiAgICBjb25zdCBuZXdTY29wZTogU2NvcGUgPSBuZXcgTWFwPHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uLCBSZXNvbHZlZFZhbHVlPigpO1xuICAgIGNvbnN0IGNhbGxlZUNvbnRleHQgPSB7Li4uY29udGV4dCwgc2NvcGU6IG5ld1Njb3BlfTtcbiAgICBmbi5wYXJhbWV0ZXJzLmZvckVhY2goKHBhcmFtLCBpbmRleCkgPT4ge1xuICAgICAgbGV0IGFyZyA9IGFyZ3NbaW5kZXhdO1xuICAgICAgaWYgKHBhcmFtLm5vZGUuZG90RG90RG90VG9rZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhcmcgPSBhcmdzLnNsaWNlKGluZGV4KTtcbiAgICAgIH1cbiAgICAgIGlmIChhcmcgPT09IHVuZGVmaW5lZCAmJiBwYXJhbS5pbml0aWFsaXplciAhPT0gbnVsbCkge1xuICAgICAgICBhcmcgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihwYXJhbS5pbml0aWFsaXplciwgY2FsbGVlQ29udGV4dCk7XG4gICAgICB9XG4gICAgICBuZXdTY29wZS5zZXQocGFyYW0ubm9kZSwgYXJnKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXQuZXhwcmVzc2lvbiAhPT0gdW5kZWZpbmVkID8gdGhpcy52aXNpdEV4cHJlc3Npb24ocmV0LmV4cHJlc3Npb24sIGNhbGxlZUNvbnRleHQpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRDb25kaXRpb25hbEV4cHJlc3Npb24obm9kZTogdHMuQ29uZGl0aW9uYWxFeHByZXNzaW9uLCBjb250ZXh0OiBDb250ZXh0KTpcbiAgICAgIFJlc29sdmVkVmFsdWUge1xuICAgIGNvbnN0IGNvbmRpdGlvbiA9IHRoaXMudmlzaXRFeHByZXNzaW9uKG5vZGUuY29uZGl0aW9uLCBjb250ZXh0KTtcbiAgICBpZiAoY29uZGl0aW9uIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljSW5wdXQobm9kZSwgY29uZGl0aW9uKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZGl0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS53aGVuVHJ1ZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLndoZW5GYWxzZSwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdFByZWZpeFVuYXJ5RXhwcmVzc2lvbihub2RlOiB0cy5QcmVmaXhVbmFyeUV4cHJlc3Npb24sIGNvbnRleHQ6IENvbnRleHQpOlxuICAgICAgUmVzb2x2ZWRWYWx1ZSB7XG4gICAgY29uc3Qgb3BlcmF0b3JLaW5kID0gbm9kZS5vcGVyYXRvcjtcbiAgICBpZiAoIVVOQVJZX09QRVJBVE9SUy5oYXMob3BlcmF0b3JLaW5kKSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tVW5zdXBwb3J0ZWRTeW50YXgobm9kZSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3AgPSBVTkFSWV9PUEVSQVRPUlMuZ2V0KG9wZXJhdG9yS2luZCkhO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5vcGVyYW5kLCBjb250ZXh0KTtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcCh2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEJpbmFyeUV4cHJlc3Npb24obm9kZTogdHMuQmluYXJ5RXhwcmVzc2lvbiwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWUge1xuICAgIGNvbnN0IHRva2VuS2luZCA9IG5vZGUub3BlcmF0b3JUb2tlbi5raW5kO1xuICAgIGlmICghQklOQVJZX09QRVJBVE9SUy5oYXModG9rZW5LaW5kKSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tVW5zdXBwb3J0ZWRTeW50YXgobm9kZSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3BSZWNvcmQgPSBCSU5BUllfT1BFUkFUT1JTLmdldCh0b2tlbktpbmQpITtcbiAgICBsZXQgbGhzOiBSZXNvbHZlZFZhbHVlLCByaHM6IFJlc29sdmVkVmFsdWU7XG4gICAgaWYgKG9wUmVjb3JkLmxpdGVyYWwpIHtcbiAgICAgIGxocyA9IGxpdGVyYWwoXG4gICAgICAgICAgdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5sZWZ0LCBjb250ZXh0KSxcbiAgICAgICAgICB2YWx1ZSA9PiBEeW5hbWljVmFsdWUuZnJvbUludmFsaWRFeHByZXNzaW9uVHlwZShub2RlLmxlZnQsIHZhbHVlKSk7XG4gICAgICByaHMgPSBsaXRlcmFsKFxuICAgICAgICAgIHRoaXMudmlzaXRFeHByZXNzaW9uKG5vZGUucmlnaHQsIGNvbnRleHQpLFxuICAgICAgICAgIHZhbHVlID0+IER5bmFtaWNWYWx1ZS5mcm9tSW52YWxpZEV4cHJlc3Npb25UeXBlKG5vZGUucmlnaHQsIHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxocyA9IHRoaXMudmlzaXRFeHByZXNzaW9uKG5vZGUubGVmdCwgY29udGV4dCk7XG4gICAgICByaHMgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLnJpZ2h0LCBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKGxocyBpbnN0YW5jZW9mIER5bmFtaWNWYWx1ZSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KG5vZGUsIGxocyk7XG4gICAgfSBlbHNlIGlmIChyaHMgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCByaHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gb3BSZWNvcmQub3AobGhzLCByaHMpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRQYXJlbnRoZXNpemVkRXhwcmVzc2lvbihub2RlOiB0cy5QYXJlbnRoZXNpemVkRXhwcmVzc2lvbiwgY29udGV4dDogQ29udGV4dCk6XG4gICAgICBSZXNvbHZlZFZhbHVlIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uLCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgZXZhbHVhdGVGdW5jdGlvbkFyZ3VtZW50cyhub2RlOiB0cy5DYWxsRXhwcmVzc2lvbiwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWVBcnJheSB7XG4gICAgY29uc3QgYXJnczogUmVzb2x2ZWRWYWx1ZUFycmF5ID0gW107XG4gICAgZm9yIChjb25zdCBhcmcgb2Ygbm9kZS5hcmd1bWVudHMpIHtcbiAgICAgIGlmICh0cy5pc1NwcmVhZEVsZW1lbnQoYXJnKSkge1xuICAgICAgICBhcmdzLnB1c2goLi4udGhpcy52aXNpdFNwcmVhZEVsZW1lbnQoYXJnLCBjb250ZXh0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcmdzLnB1c2godGhpcy52aXNpdEV4cHJlc3Npb24oYXJnLCBjb250ZXh0KSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdFNwcmVhZEVsZW1lbnQobm9kZTogdHMuU3ByZWFkRWxlbWVudCwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWVBcnJheSB7XG4gICAgY29uc3Qgc3ByZWFkID0gdGhpcy52aXNpdEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uLCBjb250ZXh0KTtcbiAgICBpZiAoc3ByZWFkIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICByZXR1cm4gW0R5bmFtaWNWYWx1ZS5mcm9tRHluYW1pY0lucHV0KG5vZGUsIHNwcmVhZCldO1xuICAgIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoc3ByZWFkKSkge1xuICAgICAgcmV0dXJuIFtEeW5hbWljVmFsdWUuZnJvbUludmFsaWRFeHByZXNzaW9uVHlwZShub2RlLCBzcHJlYWQpXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNwcmVhZDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHZpc2l0QmluZGluZ0VsZW1lbnQobm9kZTogdHMuQmluZGluZ0VsZW1lbnQsIGNvbnRleHQ6IENvbnRleHQpOiBSZXNvbHZlZFZhbHVlIHtcbiAgICBjb25zdCBwYXRoOiB0cy5CaW5kaW5nRWxlbWVudFtdID0gW107XG4gICAgbGV0IGNsb3Nlc3REZWNsYXJhdGlvbjogdHMuTm9kZSA9IG5vZGU7XG5cbiAgICB3aGlsZSAodHMuaXNCaW5kaW5nRWxlbWVudChjbG9zZXN0RGVjbGFyYXRpb24pIHx8XG4gICAgICAgICAgIHRzLmlzQXJyYXlCaW5kaW5nUGF0dGVybihjbG9zZXN0RGVjbGFyYXRpb24pIHx8XG4gICAgICAgICAgIHRzLmlzT2JqZWN0QmluZGluZ1BhdHRlcm4oY2xvc2VzdERlY2xhcmF0aW9uKSkge1xuICAgICAgaWYgKHRzLmlzQmluZGluZ0VsZW1lbnQoY2xvc2VzdERlY2xhcmF0aW9uKSkge1xuICAgICAgICBwYXRoLnVuc2hpZnQoY2xvc2VzdERlY2xhcmF0aW9uKTtcbiAgICAgIH1cblxuICAgICAgY2xvc2VzdERlY2xhcmF0aW9uID0gY2xvc2VzdERlY2xhcmF0aW9uLnBhcmVudDtcbiAgICB9XG5cbiAgICBpZiAoIXRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbihjbG9zZXN0RGVjbGFyYXRpb24pIHx8XG4gICAgICAgIGNsb3Nlc3REZWNsYXJhdGlvbi5pbml0aWFsaXplciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21Vbmtub3duKG5vZGUpO1xuICAgIH1cblxuICAgIGxldCB2YWx1ZSA9IHRoaXMudmlzaXQoY2xvc2VzdERlY2xhcmF0aW9uLmluaXRpYWxpemVyLCBjb250ZXh0KTtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgcGF0aCkge1xuICAgICAgbGV0IGtleTogbnVtYmVyfHN0cmluZztcbiAgICAgIGlmICh0cy5pc0FycmF5QmluZGluZ1BhdHRlcm4oZWxlbWVudC5wYXJlbnQpKSB7XG4gICAgICAgIGtleSA9IGVsZW1lbnQucGFyZW50LmVsZW1lbnRzLmluZGV4T2YoZWxlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuYW1lID0gZWxlbWVudC5wcm9wZXJ0eU5hbWUgfHwgZWxlbWVudC5uYW1lO1xuICAgICAgICBpZiAodHMuaXNJZGVudGlmaWVyKG5hbWUpKSB7XG4gICAgICAgICAga2V5ID0gbmFtZS50ZXh0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbVVua25vd24oZWxlbWVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHZhbHVlID0gdGhpcy5hY2Nlc3NIZWxwZXIoZWxlbWVudCwgdmFsdWUsIGtleSwgY29udGV4dCk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIHByaXZhdGUgc3RyaW5nTmFtZUZyb21Qcm9wZXJ0eU5hbWUobm9kZTogdHMuUHJvcGVydHlOYW1lLCBjb250ZXh0OiBDb250ZXh0KTogc3RyaW5nfHVuZGVmaW5lZCB7XG4gICAgaWYgKHRzLmlzSWRlbnRpZmllcihub2RlKSB8fCB0cy5pc1N0cmluZ0xpdGVyYWwobm9kZSkgfHwgdHMuaXNOdW1lcmljTGl0ZXJhbChub2RlKSkge1xuICAgICAgcmV0dXJuIG5vZGUudGV4dDtcbiAgICB9IGVsc2UgaWYgKHRzLmlzQ29tcHV0ZWRQcm9wZXJ0eU5hbWUobm9kZSkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWwgPSB0aGlzLnZpc2l0RXhwcmVzc2lvbihub2RlLmV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgICAgcmV0dXJuIHR5cGVvZiBsaXRlcmFsID09PSAnc3RyaW5nJyA/IGxpdGVyYWwgOiB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRSZXNvbHZlZEVudW0obm9kZTogdHMuRGVjbGFyYXRpb24sIGVudW1NZW1iZXJzOiBFbnVtTWVtYmVyW10sIGNvbnRleHQ6IENvbnRleHQpOlxuICAgICAgUmVzb2x2ZWRWYWx1ZSB7XG4gICAgY29uc3QgZW51bVJlZiA9IHRoaXMuZ2V0UmVmZXJlbmNlKG5vZGUsIGNvbnRleHQpO1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBFbnVtVmFsdWU+KCk7XG4gICAgZW51bU1lbWJlcnMuZm9yRWFjaChtZW1iZXIgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuc3RyaW5nTmFtZUZyb21Qcm9wZXJ0eU5hbWUobWVtYmVyLm5hbWUsIGNvbnRleHQpO1xuICAgICAgaWYgKG5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHRoaXMudmlzaXQobWVtYmVyLmluaXRpYWxpemVyLCBjb250ZXh0KTtcbiAgICAgICAgbWFwLnNldChuYW1lLCBuZXcgRW51bVZhbHVlKGVudW1SZWYsIG5hbWUsIHJlc29sdmVkKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UmVmZXJlbmNlPFQgZXh0ZW5kcyBEZWNsYXJhdGlvbk5vZGU+KG5vZGU6IFQsIGNvbnRleHQ6IENvbnRleHQpOiBSZWZlcmVuY2U8VD4ge1xuICAgIHJldHVybiBuZXcgUmVmZXJlbmNlKG5vZGUsIG93bmluZ01vZHVsZShjb250ZXh0KSk7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0VHlwZShub2RlOiB0cy5UeXBlTm9kZSwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWUge1xuICAgIGlmICh0cy5pc0xpdGVyYWxUeXBlTm9kZShub2RlKSkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRFeHByZXNzaW9uKG5vZGUubGl0ZXJhbCwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmICh0cy5pc1R1cGxlVHlwZU5vZGUobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0VHVwbGVUeXBlKG5vZGUsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNOYW1lZFR1cGxlTWVtYmVyKG5vZGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdFR5cGUobm9kZS50eXBlLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljVHlwZShub2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRUdXBsZVR5cGUobm9kZTogdHMuVHVwbGVUeXBlTm9kZSwgY29udGV4dDogQ29udGV4dCk6IFJlc29sdmVkVmFsdWVBcnJheSB7XG4gICAgY29uc3QgcmVzOiBSZXNvbHZlZFZhbHVlQXJyYXkgPSBbXTtcblxuICAgIGZvciAoY29uc3QgZWxlbSBvZiBub2RlLmVsZW1lbnRzKSB7XG4gICAgICByZXMucHVzaCh0aGlzLnZpc2l0VHlwZShlbGVtLCBjb250ZXh0KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uT3JNZXRob2RSZWZlcmVuY2UocmVmOiBSZWZlcmVuY2U8dHMuTm9kZT4pOlxuICAgIHJlZiBpcyBSZWZlcmVuY2U8dHMuRnVuY3Rpb25EZWNsYXJhdGlvbnx0cy5NZXRob2REZWNsYXJhdGlvbnx0cy5GdW5jdGlvbkV4cHJlc3Npb24+IHtcbiAgcmV0dXJuIHRzLmlzRnVuY3Rpb25EZWNsYXJhdGlvbihyZWYubm9kZSkgfHwgdHMuaXNNZXRob2REZWNsYXJhdGlvbihyZWYubm9kZSkgfHxcbiAgICAgIHRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKHJlZi5ub2RlKTtcbn1cblxuZnVuY3Rpb24gbGl0ZXJhbChcbiAgICB2YWx1ZTogUmVzb2x2ZWRWYWx1ZSwgcmVqZWN0OiAodmFsdWU6IFJlc29sdmVkVmFsdWUpID0+IFJlc29sdmVkVmFsdWUpOiBSZXNvbHZlZFZhbHVlIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRW51bVZhbHVlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5yZXNvbHZlZDtcbiAgfVxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUgfHwgdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJldHVybiByZWplY3QodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBpc1ZhcmlhYmxlRGVjbGFyYXRpb25EZWNsYXJlZChub2RlOiB0cy5WYXJpYWJsZURlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gIGlmIChub2RlLnBhcmVudCA9PT0gdW5kZWZpbmVkIHx8ICF0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb25MaXN0KG5vZGUucGFyZW50KSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBkZWNsTGlzdCA9IG5vZGUucGFyZW50O1xuICBpZiAoZGVjbExpc3QucGFyZW50ID09PSB1bmRlZmluZWQgfHwgIXRzLmlzVmFyaWFibGVTdGF0ZW1lbnQoZGVjbExpc3QucGFyZW50KSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB2YXJTdG10ID0gZGVjbExpc3QucGFyZW50O1xuICByZXR1cm4gdmFyU3RtdC5tb2RpZmllcnMgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdmFyU3RtdC5tb2RpZmllcnMuc29tZShtb2QgPT4gbW9kLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuRGVjbGFyZUtleXdvcmQpO1xufVxuXG5jb25zdCBFTVBUWSA9IHt9O1xuXG5mdW5jdGlvbiBqb2luTW9kdWxlQ29udGV4dChleGlzdGluZzogQ29udGV4dCwgbm9kZTogdHMuTm9kZSwgZGVjbDogRGVjbGFyYXRpb24pOiB7XG4gIGFic29sdXRlTW9kdWxlTmFtZT86IHN0cmluZyxcbiAgcmVzb2x1dGlvbkNvbnRleHQ/OiBzdHJpbmcsXG59IHtcbiAgaWYgKGRlY2wudmlhTW9kdWxlICE9PSBudWxsICYmIGRlY2wudmlhTW9kdWxlICE9PSBleGlzdGluZy5hYnNvbHV0ZU1vZHVsZU5hbWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgYWJzb2x1dGVNb2R1bGVOYW1lOiBkZWNsLnZpYU1vZHVsZSxcbiAgICAgIHJlc29sdXRpb25Db250ZXh0OiBub2RlLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZSxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBFTVBUWTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvd25pbmdNb2R1bGUoY29udGV4dDogQ29udGV4dCwgb3ZlcnJpZGU6IE93bmluZ01vZHVsZXxudWxsID0gbnVsbCk6IE93bmluZ01vZHVsZXxudWxsIHtcbiAgbGV0IHNwZWNpZmllciA9IGNvbnRleHQuYWJzb2x1dGVNb2R1bGVOYW1lO1xuICBpZiAob3ZlcnJpZGUgIT09IG51bGwpIHtcbiAgICBzcGVjaWZpZXIgPSBvdmVycmlkZS5zcGVjaWZpZXI7XG4gIH1cbiAgaWYgKHNwZWNpZmllciAhPT0gbnVsbCkge1xuICAgIHJldHVybiB7XG4gICAgICBzcGVjaWZpZXIsXG4gICAgICByZXNvbHV0aW9uQ29udGV4dDogY29udGV4dC5yZXNvbHV0aW9uQ29udGV4dCxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iXX0=