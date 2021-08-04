/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ASTWithSource, EmptyExpr, SafeKeyedRead } from '@angular/compiler';
import * as ts from 'typescript';
import { addParseSpanInfo, wrapForDiagnostics, wrapForTypeChecker } from './diagnostics';
import { tsCastToAny } from './ts_util';
export const NULL_AS_ANY = ts.createAsExpression(ts.createNull(), ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
const UNDEFINED = ts.createIdentifier('undefined');
const UNARY_OPS = new Map([
    ['+', ts.SyntaxKind.PlusToken],
    ['-', ts.SyntaxKind.MinusToken],
]);
const BINARY_OPS = new Map([
    ['+', ts.SyntaxKind.PlusToken],
    ['-', ts.SyntaxKind.MinusToken],
    ['<', ts.SyntaxKind.LessThanToken],
    ['>', ts.SyntaxKind.GreaterThanToken],
    ['<=', ts.SyntaxKind.LessThanEqualsToken],
    ['>=', ts.SyntaxKind.GreaterThanEqualsToken],
    ['==', ts.SyntaxKind.EqualsEqualsToken],
    ['===', ts.SyntaxKind.EqualsEqualsEqualsToken],
    ['*', ts.SyntaxKind.AsteriskToken],
    ['/', ts.SyntaxKind.SlashToken],
    ['%', ts.SyntaxKind.PercentToken],
    ['!=', ts.SyntaxKind.ExclamationEqualsToken],
    ['!==', ts.SyntaxKind.ExclamationEqualsEqualsToken],
    ['||', ts.SyntaxKind.BarBarToken],
    ['&&', ts.SyntaxKind.AmpersandAmpersandToken],
    ['&', ts.SyntaxKind.AmpersandToken],
    ['|', ts.SyntaxKind.BarToken],
    ['??', ts.SyntaxKind.QuestionQuestionToken],
]);
/**
 * Convert an `AST` to TypeScript code directly, without going through an intermediate `Expression`
 * AST.
 */
export function astToTypescript(ast, maybeResolve, config) {
    const translator = new AstTranslator(maybeResolve, config);
    return translator.translate(ast);
}
class AstTranslator {
    constructor(maybeResolve, config) {
        this.maybeResolve = maybeResolve;
        this.config = config;
    }
    translate(ast) {
        // Skip over an `ASTWithSource` as its `visit` method calls directly into its ast's `visit`,
        // which would prevent any custom resolution through `maybeResolve` for that node.
        if (ast instanceof ASTWithSource) {
            ast = ast.ast;
        }
        // The `EmptyExpr` doesn't have a dedicated method on `AstVisitor`, so it's special cased here.
        if (ast instanceof EmptyExpr) {
            const res = ts.factory.createIdentifier('undefined');
            addParseSpanInfo(res, ast.sourceSpan);
            return res;
        }
        // First attempt to let any custom resolution logic provide a translation for the given node.
        const resolved = this.maybeResolve(ast);
        if (resolved !== null) {
            return resolved;
        }
        return ast.visit(this);
    }
    visitUnary(ast) {
        const expr = this.translate(ast.expr);
        const op = UNARY_OPS.get(ast.operator);
        if (op === undefined) {
            throw new Error(`Unsupported Unary.operator: ${ast.operator}`);
        }
        const node = wrapForDiagnostics(ts.createPrefix(op, expr));
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitBinary(ast) {
        const lhs = wrapForDiagnostics(this.translate(ast.left));
        const rhs = wrapForDiagnostics(this.translate(ast.right));
        const op = BINARY_OPS.get(ast.operation);
        if (op === undefined) {
            throw new Error(`Unsupported Binary.operation: ${ast.operation}`);
        }
        const node = ts.createBinary(lhs, op, rhs);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitChain(ast) {
        const elements = ast.expressions.map(expr => this.translate(expr));
        const node = wrapForDiagnostics(ts.createCommaList(elements));
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitConditional(ast) {
        const condExpr = this.translate(ast.condition);
        const trueExpr = this.translate(ast.trueExp);
        // Wrap `falseExpr` in parens so that the trailing parse span info is not attributed to the
        // whole conditional.
        // In the following example, the last source span comment (5,6) could be seen as the
        // trailing comment for _either_ the whole conditional expression _or_ just the `falseExpr` that
        // is immediately before it:
        // `conditional /*1,2*/ ? trueExpr /*3,4*/ : falseExpr /*5,6*/`
        // This should be instead be `conditional /*1,2*/ ? trueExpr /*3,4*/ : (falseExpr /*5,6*/)`
        const falseExpr = wrapForTypeChecker(this.translate(ast.falseExp));
        const node = ts.createParen(ts.createConditional(condExpr, trueExpr, falseExpr));
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitFunctionCall(ast) {
        const receiver = wrapForDiagnostics(this.translate(ast.target));
        const args = ast.args.map(expr => this.translate(expr));
        const node = ts.createCall(receiver, undefined, args);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitImplicitReceiver(ast) {
        throw new Error('Method not implemented.');
    }
    visitThisReceiver(ast) {
        throw new Error('Method not implemented.');
    }
    visitInterpolation(ast) {
        // Build up a chain of binary + operations to simulate the string concatenation of the
        // interpolation's expressions. The chain is started using an actual string literal to ensure
        // the type is inferred as 'string'.
        return ast.expressions.reduce((lhs, ast) => ts.createBinary(lhs, ts.SyntaxKind.PlusToken, wrapForTypeChecker(this.translate(ast))), ts.createLiteral(''));
    }
    visitKeyedRead(ast) {
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const key = this.translate(ast.key);
        const node = ts.createElementAccess(receiver, key);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitKeyedWrite(ast) {
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const left = ts.createElementAccess(receiver, this.translate(ast.key));
        // TODO(joost): annotate `left` with the span of the element access, which is not currently
        //  available on `ast`.
        const right = wrapForTypeChecker(this.translate(ast.value));
        const node = wrapForDiagnostics(ts.createBinary(left, ts.SyntaxKind.EqualsToken, right));
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitLiteralArray(ast) {
        const elements = ast.expressions.map(expr => this.translate(expr));
        const literal = ts.createArrayLiteral(elements);
        // If strictLiteralTypes is disabled, array literals are cast to `any`.
        const node = this.config.strictLiteralTypes ? literal : tsCastToAny(literal);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitLiteralMap(ast) {
        const properties = ast.keys.map(({ key }, idx) => {
            const value = this.translate(ast.values[idx]);
            return ts.createPropertyAssignment(ts.createStringLiteral(key), value);
        });
        const literal = ts.createObjectLiteral(properties, true);
        // If strictLiteralTypes is disabled, object literals are cast to `any`.
        const node = this.config.strictLiteralTypes ? literal : tsCastToAny(literal);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitLiteralPrimitive(ast) {
        let node;
        if (ast.value === undefined) {
            node = ts.createIdentifier('undefined');
        }
        else if (ast.value === null) {
            node = ts.createNull();
        }
        else {
            node = ts.createLiteral(ast.value);
        }
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitMethodCall(ast) {
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const method = ts.createPropertyAccess(receiver, ast.name);
        addParseSpanInfo(method, ast.nameSpan);
        const args = ast.args.map(expr => this.translate(expr));
        const node = ts.createCall(method, undefined, args);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitNonNullAssert(ast) {
        const expr = wrapForDiagnostics(this.translate(ast.expression));
        const node = ts.createNonNullExpression(expr);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitPipe(ast) {
        throw new Error('Method not implemented.');
    }
    visitPrefixNot(ast) {
        const expression = wrapForDiagnostics(this.translate(ast.expression));
        const node = ts.createLogicalNot(expression);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitPropertyRead(ast) {
        // This is a normal property read - convert the receiver to an expression and emit the correct
        // TypeScript expression to read the property.
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const name = ts.createPropertyAccess(receiver, ast.name);
        addParseSpanInfo(name, ast.nameSpan);
        const node = wrapForDiagnostics(name);
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitPropertyWrite(ast) {
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const left = ts.createPropertyAccess(receiver, ast.name);
        addParseSpanInfo(left, ast.nameSpan);
        // TypeScript reports assignment errors on the entire lvalue expression. Annotate the lvalue of
        // the assignment with the sourceSpan, which includes receivers, rather than nameSpan for
        // consistency of the diagnostic location.
        // a.b.c = 1
        // ^^^^^^^^^ sourceSpan
        //     ^     nameSpan
        const leftWithPath = wrapForDiagnostics(left);
        addParseSpanInfo(leftWithPath, ast.sourceSpan);
        // The right needs to be wrapped in parens as well or we cannot accurately match its
        // span to just the RHS. For example, the span in `e = $event /*0,10*/` is ambiguous.
        // It could refer to either the whole binary expression or just the RHS.
        // We should instead generate `e = ($event /*0,10*/)` so we know the span 0,10 matches RHS.
        const right = wrapForTypeChecker(this.translate(ast.value));
        const node = wrapForDiagnostics(ts.createBinary(leftWithPath, ts.SyntaxKind.EqualsToken, right));
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitQuote(ast) {
        return NULL_AS_ANY;
    }
    visitSafeMethodCall(ast) {
        // See the comments in SafePropertyRead above for an explanation of the cases here.
        let node;
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const args = ast.args.map(expr => this.translate(expr));
        if (this.config.strictSafeNavigationTypes) {
            // "a?.method(...)" becomes (null as any ? a!.method(...) : undefined)
            const method = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
            addParseSpanInfo(method, ast.nameSpan);
            const call = ts.createCall(method, undefined, args);
            node = ts.createParen(ts.createConditional(NULL_AS_ANY, call, UNDEFINED));
        }
        else if (VeSafeLhsInferenceBugDetector.veWillInferAnyFor(ast)) {
            // "a?.method(...)" becomes (a as any).method(...)
            const method = ts.createPropertyAccess(tsCastToAny(receiver), ast.name);
            addParseSpanInfo(method, ast.nameSpan);
            node = ts.createCall(method, undefined, args);
        }
        else {
            // "a?.method(...)" becomes (a!.method(...) as any)
            const method = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
            addParseSpanInfo(method, ast.nameSpan);
            node = tsCastToAny(ts.createCall(method, undefined, args));
        }
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitSafePropertyRead(ast) {
        let node;
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        // The form of safe property reads depends on whether strictness is in use.
        if (this.config.strictSafeNavigationTypes) {
            // Basically, the return here is either the type of the complete expression with a null-safe
            // property read, or `undefined`. So a ternary is used to create an "or" type:
            // "a?.b" becomes (null as any ? a!.b : undefined)
            // The type of this expression is (typeof a!.b) | undefined, which is exactly as desired.
            const expr = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
            addParseSpanInfo(expr, ast.nameSpan);
            node = ts.createParen(ts.createConditional(NULL_AS_ANY, expr, UNDEFINED));
        }
        else if (VeSafeLhsInferenceBugDetector.veWillInferAnyFor(ast)) {
            // Emulate a View Engine bug where 'any' is inferred for the left-hand side of the safe
            // navigation operation. With this bug, the type of the left-hand side is regarded as any.
            // Therefore, the left-hand side only needs repeating in the output (to validate it), and then
            // 'any' is used for the rest of the expression. This is done using a comma operator:
            // "a?.b" becomes (a as any).b, which will of course have type 'any'.
            node = ts.createPropertyAccess(tsCastToAny(receiver), ast.name);
        }
        else {
            // The View Engine bug isn't active, so check the entire type of the expression, but the final
            // result is still inferred as `any`.
            // "a?.b" becomes (a!.b as any)
            const expr = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
            addParseSpanInfo(expr, ast.nameSpan);
            node = tsCastToAny(expr);
        }
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
    visitSafeKeyedRead(ast) {
        const receiver = wrapForDiagnostics(this.translate(ast.receiver));
        const key = this.translate(ast.key);
        let node;
        // The form of safe property reads depends on whether strictness is in use.
        if (this.config.strictSafeNavigationTypes) {
            // "a?.[...]" becomes (null as any ? a![...] : undefined)
            const expr = ts.createElementAccess(ts.createNonNullExpression(receiver), key);
            addParseSpanInfo(expr, ast.sourceSpan);
            node = ts.createParen(ts.createConditional(NULL_AS_ANY, expr, UNDEFINED));
        }
        else if (VeSafeLhsInferenceBugDetector.veWillInferAnyFor(ast)) {
            // "a?.[...]" becomes (a as any)[...]
            node = ts.createElementAccess(tsCastToAny(receiver), key);
        }
        else {
            // "a?.[...]" becomes (a!.[...] as any)
            const expr = ts.createElementAccess(ts.createNonNullExpression(receiver), key);
            addParseSpanInfo(expr, ast.sourceSpan);
            node = tsCastToAny(expr);
        }
        addParseSpanInfo(node, ast.sourceSpan);
        return node;
    }
}
/**
 * Checks whether View Engine will infer a type of 'any' for the left-hand side of a safe navigation
 * operation.
 *
 * In View Engine's template type-checker, certain receivers of safe navigation operations will
 * cause a temporary variable to be allocated as part of the checking expression, to save the value
 * of the receiver and use it more than once in the expression. This temporary variable has type
 * 'any'. In practice, this means certain receivers cause View Engine to not check the full
 * expression, and other receivers will receive more complete checking.
 *
 * For compatibility, this logic is adapted from View Engine's expression_converter.ts so that the
 * Ivy checker can emulate this bug when needed.
 */
class VeSafeLhsInferenceBugDetector {
    static veWillInferAnyFor(ast) {
        const visitor = VeSafeLhsInferenceBugDetector.SINGLETON;
        return ast instanceof SafeKeyedRead ? ast.receiver.visit(visitor) : ast.receiver.visit(visitor);
    }
    visitUnary(ast) {
        return ast.expr.visit(this);
    }
    visitBinary(ast) {
        return ast.left.visit(this) || ast.right.visit(this);
    }
    visitChain(ast) {
        return false;
    }
    visitConditional(ast) {
        return ast.condition.visit(this) || ast.trueExp.visit(this) || ast.falseExp.visit(this);
    }
    visitFunctionCall(ast) {
        return true;
    }
    visitImplicitReceiver(ast) {
        return false;
    }
    visitThisReceiver(ast) {
        return false;
    }
    visitInterpolation(ast) {
        return ast.expressions.some(exp => exp.visit(this));
    }
    visitKeyedRead(ast) {
        return false;
    }
    visitKeyedWrite(ast) {
        return false;
    }
    visitLiteralArray(ast) {
        return true;
    }
    visitLiteralMap(ast) {
        return true;
    }
    visitLiteralPrimitive(ast) {
        return false;
    }
    visitMethodCall(ast) {
        return true;
    }
    visitPipe(ast) {
        return true;
    }
    visitPrefixNot(ast) {
        return ast.expression.visit(this);
    }
    visitNonNullAssert(ast) {
        return ast.expression.visit(this);
    }
    visitPropertyRead(ast) {
        return false;
    }
    visitPropertyWrite(ast) {
        return false;
    }
    visitQuote(ast) {
        return false;
    }
    visitSafeMethodCall(ast) {
        return true;
    }
    visitSafePropertyRead(ast) {
        return false;
    }
    visitSafeKeyedRead(ast) {
        return false;
    }
}
VeSafeLhsInferenceBugDetector.SINGLETON = new VeSafeLhsInferenceBugDetector();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9leHByZXNzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBa0IsYUFBYSxFQUEyQyxTQUFTLEVBQThMLGFBQWEsRUFBd0QsTUFBTSxtQkFBbUIsQ0FBQztBQUN2WCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUlqQyxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDdkYsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUV0QyxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQ3BCLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUMvRixNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFbkQsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQWlDO0lBQ3hELENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO0lBQzlCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDO0NBQ2hDLENBQUMsQ0FBQztBQUVILE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUE0QjtJQUNwRCxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQztJQUM5QixDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQztJQUMvQixD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R0FBaUI7UUFDakMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0Qsa0JBQWtCLENBQUMsR0FBa0I7UUFDbkMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsVUFBVSxDQUFDLEdBQVU7UUFDbkIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsbUJBQW1CLENBQUMsR0FBbUI7UUFDckMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QscUJBQXFCLENBQUMsR0FBcUI7UUFDekMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0Qsa0JBQWtCLENBQUMsR0FBa0I7UUFDbkMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDOztBQTNFYyx1Q0FBUyxHQUFHLElBQUksNkJBQTZCLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FTVCwgQXN0VmlzaXRvciwgQVNUV2l0aFNvdXJjZSwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgS2V5ZWRSZWFkLCBLZXllZFdyaXRlLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIE1ldGhvZENhbGwsIE5vbk51bGxBc3NlcnQsIFByZWZpeE5vdCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBRdW90ZSwgU2FmZUtleWVkUmVhZCwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWQsIFRoaXNSZWNlaXZlciwgVW5hcnl9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge1R5cGVDaGVja2luZ0NvbmZpZ30gZnJvbSAnLi4vYXBpJztcblxuaW1wb3J0IHthZGRQYXJzZVNwYW5JbmZvLCB3cmFwRm9yRGlhZ25vc3RpY3MsIHdyYXBGb3JUeXBlQ2hlY2tlcn0gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge3RzQ2FzdFRvQW55fSBmcm9tICcuL3RzX3V0aWwnO1xuXG5leHBvcnQgY29uc3QgTlVMTF9BU19BTlkgPVxuICAgIHRzLmNyZWF0ZUFzRXhwcmVzc2lvbih0cy5jcmVhdGVOdWxsKCksIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKTtcbmNvbnN0IFVOREVGSU5FRCA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoJ3VuZGVmaW5lZCcpO1xuXG5jb25zdCBVTkFSWV9PUFMgPSBuZXcgTWFwPHN0cmluZywgdHMuUHJlZml4VW5hcnlPcGVyYXRvcj4oW1xuICBbJysnLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbl0sXG4gIFsnLScsIHRzLlN5bnRheEtpbmQuTWludXNUb2tlbl0sXG5dKTtcblxuY29uc3QgQklOQVJZX09QUyA9IG5ldyBNYXA8c3RyaW5nLCB0cy5CaW5hcnlPcGVyYXRvcj4oW1xuICBbJysnLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbl0sXG4gIFsnLScsIHRzLlN5bnRheEtpbmQuTWludXNUb2tlbl0sXG4gIFsnPCcsIHRzLlN5bnRheEtpbmQuTGVzc1RoYW5Ub2tlbl0sXG4gIFsnPicsIHRzLlN5bnRheEtpbmQuR3JlYXRlclRoYW5Ub2tlbl0sXG4gIFsnPD0nLCB0cy5TeW50YXhLaW5kLkxlc3NUaGFuRXF1YWxzVG9rZW5dLFxuICBbJz49JywgdHMuU3ludGF4S2luZC5HcmVhdGVyVGhhbkVxdWFsc1Rva2VuXSxcbiAgWyc9PScsIHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzVG9rZW5dLFxuICBbJz09PScsIHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzRXF1YWxzVG9rZW5dLFxuICBbJyonLCB0cy5TeW50YXhLaW5kLkFzdGVyaXNrVG9rZW5dLFxuICBbJy8nLCB0cy5TeW50YXhLaW5kLlNsYXNoVG9rZW5dLFxuICBbJyUnLCB0cy5TeW50YXhLaW5kLlBlcmNlbnRUb2tlbl0sXG4gIFsnIT0nLCB0cy5TeW50YXhLaW5kLkV4Y2xhbWF0aW9uRXF1YWxzVG9rZW5dLFxuICBbJyE9PScsIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNFcXVhbHNUb2tlbl0sXG4gIFsnfHwnLCB0cy5TeW50YXhLaW5kLkJhckJhclRva2VuXSxcbiAgWycmJicsIHRzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW5dLFxuICBbJyYnLCB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZFRva2VuXSxcbiAgWyd8JywgdHMuU3ludGF4S2luZC5CYXJUb2tlbl0sXG4gIFsnPz8nLCB0cy5TeW50YXhLaW5kLlF1ZXN0aW9uUXVlc3Rpb25Ub2tlbl0sXG5dKTtcblxuLyoqXG4gKiBDb252ZXJ0IGFuIGBBU1RgIHRvIFR5cGVTY3JpcHQgY29kZSBkaXJlY3RseSwgd2l0aG91dCBnb2luZyB0aHJvdWdoIGFuIGludGVybWVkaWF0ZSBgRXhwcmVzc2lvbmBcbiAqIEFTVC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzdFRvVHlwZXNjcmlwdChcbiAgICBhc3Q6IEFTVCwgbWF5YmVSZXNvbHZlOiAoYXN0OiBBU1QpID0+ICh0cy5FeHByZXNzaW9uIHwgbnVsbCksXG4gICAgY29uZmlnOiBUeXBlQ2hlY2tpbmdDb25maWcpOiB0cy5FeHByZXNzaW9uIHtcbiAgY29uc3QgdHJhbnNsYXRvciA9IG5ldyBBc3RUcmFuc2xhdG9yKG1heWJlUmVzb2x2ZSwgY29uZmlnKTtcbiAgcmV0dXJuIHRyYW5zbGF0b3IudHJhbnNsYXRlKGFzdCk7XG59XG5cbmNsYXNzIEFzdFRyYW5zbGF0b3IgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG1heWJlUmVzb2x2ZTogKGFzdDogQVNUKSA9PiAodHMuRXhwcmVzc2lvbiB8IG51bGwpLFxuICAgICAgcHJpdmF0ZSBjb25maWc6IFR5cGVDaGVja2luZ0NvbmZpZykge31cblxuICB0cmFuc2xhdGUoYXN0OiBBU1QpOiB0cy5FeHByZXNzaW9uIHtcbiAgICAvLyBTa2lwIG92ZXIgYW4gYEFTVFdpdGhTb3VyY2VgIGFzIGl0cyBgdmlzaXRgIG1ldGhvZCBjYWxscyBkaXJlY3RseSBpbnRvIGl0cyBhc3QncyBgdmlzaXRgLFxuICAgIC8vIHdoaWNoIHdvdWxkIHByZXZlbnQgYW55IGN1c3RvbSByZXNvbHV0aW9uIHRocm91Z2ggYG1heWJlUmVzb2x2ZWAgZm9yIHRoYXQgbm9kZS5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgQVNUV2l0aFNvdXJjZSkge1xuICAgICAgYXN0ID0gYXN0LmFzdDtcbiAgICB9XG5cbiAgICAvLyBUaGUgYEVtcHR5RXhwcmAgZG9lc24ndCBoYXZlIGEgZGVkaWNhdGVkIG1ldGhvZCBvbiBgQXN0VmlzaXRvcmAsIHNvIGl0J3Mgc3BlY2lhbCBjYXNlZCBoZXJlLlxuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRzLmZhY3RvcnkuY3JlYXRlSWRlbnRpZmllcigndW5kZWZpbmVkJyk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKHJlcywgYXN0LnNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvLyBGaXJzdCBhdHRlbXB0IHRvIGxldCBhbnkgY3VzdG9tIHJlc29sdXRpb24gbG9naWMgcHJvdmlkZSBhIHRyYW5zbGF0aW9uIGZvciB0aGUgZ2l2ZW4gbm9kZS5cbiAgICBjb25zdCByZXNvbHZlZCA9IHRoaXMubWF5YmVSZXNvbHZlKGFzdCk7XG4gICAgaWYgKHJlc29sdmVkICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFzdC52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0VW5hcnkoYXN0OiBVbmFyeSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGV4cHIgPSB0aGlzLnRyYW5zbGF0ZShhc3QuZXhwcik7XG4gICAgY29uc3Qgb3AgPSBVTkFSWV9PUFMuZ2V0KGFzdC5vcGVyYXRvcik7XG4gICAgaWYgKG9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgVW5hcnkub3BlcmF0b3I6ICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgICBjb25zdCBub2RlID0gd3JhcEZvckRpYWdub3N0aWNzKHRzLmNyZWF0ZVByZWZpeChvcCwgZXhwcikpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnkpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBsaHMgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LmxlZnQpKTtcbiAgICBjb25zdCByaHMgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnJpZ2h0KSk7XG4gICAgY29uc3Qgb3AgPSBCSU5BUllfT1BTLmdldChhc3Qub3BlcmF0aW9uKTtcbiAgICBpZiAob3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBCaW5hcnkub3BlcmF0aW9uOiAke2FzdC5vcGVyYXRpb259YCk7XG4gICAgfVxuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVCaW5hcnkobGhzLCBvcCwgcmhzKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbik6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IHRoaXMudHJhbnNsYXRlKGV4cHIpKTtcbiAgICBjb25zdCBub2RlID0gd3JhcEZvckRpYWdub3N0aWNzKHRzLmNyZWF0ZUNvbW1hTGlzdChlbGVtZW50cykpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29uZEV4cHIgPSB0aGlzLnRyYW5zbGF0ZShhc3QuY29uZGl0aW9uKTtcbiAgICBjb25zdCB0cnVlRXhwciA9IHRoaXMudHJhbnNsYXRlKGFzdC50cnVlRXhwKTtcbiAgICAvLyBXcmFwIGBmYWxzZUV4cHJgIGluIHBhcmVucyBzbyB0aGF0IHRoZSB0cmFpbGluZyBwYXJzZSBzcGFuIGluZm8gaXMgbm90IGF0dHJpYnV0ZWQgdG8gdGhlXG4gICAgLy8gd2hvbGUgY29uZGl0aW9uYWwuXG4gICAgLy8gSW4gdGhlIGZvbGxvd2luZyBleGFtcGxlLCB0aGUgbGFzdCBzb3VyY2Ugc3BhbiBjb21tZW50ICg1LDYpIGNvdWxkIGJlIHNlZW4gYXMgdGhlXG4gICAgLy8gdHJhaWxpbmcgY29tbWVudCBmb3IgX2VpdGhlcl8gdGhlIHdob2xlIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gX29yXyBqdXN0IHRoZSBgZmFsc2VFeHByYCB0aGF0XG4gICAgLy8gaXMgaW1tZWRpYXRlbHkgYmVmb3JlIGl0OlxuICAgIC8vIGBjb25kaXRpb25hbCAvKjEsMiovID8gdHJ1ZUV4cHIgLyozLDQqLyA6IGZhbHNlRXhwciAvKjUsNiovYFxuICAgIC8vIFRoaXMgc2hvdWxkIGJlIGluc3RlYWQgYmUgYGNvbmRpdGlvbmFsIC8qMSwyKi8gPyB0cnVlRXhwciAvKjMsNCovIDogKGZhbHNlRXhwciAvKjUsNiovKWBcbiAgICBjb25zdCBmYWxzZUV4cHIgPSB3cmFwRm9yVHlwZUNoZWNrZXIodGhpcy50cmFuc2xhdGUoYXN0LmZhbHNlRXhwKSk7XG4gICAgY29uc3Qgbm9kZSA9IHRzLmNyZWF0ZVBhcmVuKHRzLmNyZWF0ZUNvbmRpdGlvbmFsKGNvbmRFeHByLCB0cnVlRXhwciwgZmFsc2VFeHByKSk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC50YXJnZXQhKSk7XG4gICAgY29uc3QgYXJncyA9IGFzdC5hcmdzLm1hcChleHByID0+IHRoaXMudHJhbnNsYXRlKGV4cHIpKTtcbiAgICBjb25zdCBub2RlID0gdHMuY3JlYXRlQ2FsbChyZWNlaXZlciwgdW5kZWZpbmVkLCBhcmdzKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRUaGlzUmVjZWl2ZXIoYXN0OiBUaGlzUmVjZWl2ZXIpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbik6IHRzLkV4cHJlc3Npb24ge1xuICAgIC8vIEJ1aWxkIHVwIGEgY2hhaW4gb2YgYmluYXJ5ICsgb3BlcmF0aW9ucyB0byBzaW11bGF0ZSB0aGUgc3RyaW5nIGNvbmNhdGVuYXRpb24gb2YgdGhlXG4gICAgLy8gaW50ZXJwb2xhdGlvbidzIGV4cHJlc3Npb25zLiBUaGUgY2hhaW4gaXMgc3RhcnRlZCB1c2luZyBhbiBhY3R1YWwgc3RyaW5nIGxpdGVyYWwgdG8gZW5zdXJlXG4gICAgLy8gdGhlIHR5cGUgaXMgaW5mZXJyZWQgYXMgJ3N0cmluZycuXG4gICAgcmV0dXJuIGFzdC5leHByZXNzaW9ucy5yZWR1Y2UoXG4gICAgICAgIChsaHMsIGFzdCkgPT5cbiAgICAgICAgICAgIHRzLmNyZWF0ZUJpbmFyeShsaHMsIHRzLlN5bnRheEtpbmQuUGx1c1Rva2VuLCB3cmFwRm9yVHlwZUNoZWNrZXIodGhpcy50cmFuc2xhdGUoYXN0KSkpLFxuICAgICAgICB0cy5jcmVhdGVMaXRlcmFsKCcnKSk7XG4gIH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IGtleSA9IHRoaXMudHJhbnNsYXRlKGFzdC5rZXkpO1xuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKHJlY2VpdmVyLCBrZXkpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IGxlZnQgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKHJlY2VpdmVyLCB0aGlzLnRyYW5zbGF0ZShhc3Qua2V5KSk7XG4gICAgLy8gVE9ETyhqb29zdCk6IGFubm90YXRlIGBsZWZ0YCB3aXRoIHRoZSBzcGFuIG9mIHRoZSBlbGVtZW50IGFjY2Vzcywgd2hpY2ggaXMgbm90IGN1cnJlbnRseVxuICAgIC8vICBhdmFpbGFibGUgb24gYGFzdGAuXG4gICAgY29uc3QgcmlnaHQgPSB3cmFwRm9yVHlwZUNoZWNrZXIodGhpcy50cmFuc2xhdGUoYXN0LnZhbHVlKSk7XG4gICAgY29uc3Qgbm9kZSA9IHdyYXBGb3JEaWFnbm9zdGljcyh0cy5jcmVhdGVCaW5hcnkobGVmdCwgdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbiwgcmlnaHQpKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5KTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gdGhpcy50cmFuc2xhdGUoZXhwcikpO1xuICAgIGNvbnN0IGxpdGVyYWwgPSB0cy5jcmVhdGVBcnJheUxpdGVyYWwoZWxlbWVudHMpO1xuICAgIC8vIElmIHN0cmljdExpdGVyYWxUeXBlcyBpcyBkaXNhYmxlZCwgYXJyYXkgbGl0ZXJhbHMgYXJlIGNhc3QgdG8gYGFueWAuXG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuY29uZmlnLnN0cmljdExpdGVyYWxUeXBlcyA/IGxpdGVyYWwgOiB0c0Nhc3RUb0FueShsaXRlcmFsKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXApOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBwcm9wZXJ0aWVzID0gYXN0LmtleXMubWFwKCh7a2V5fSwgaWR4KSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXMudHJhbnNsYXRlKGFzdC52YWx1ZXNbaWR4XSk7XG4gICAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICAgIH0pO1xuICAgIGNvbnN0IGxpdGVyYWwgPSB0cy5jcmVhdGVPYmplY3RMaXRlcmFsKHByb3BlcnRpZXMsIHRydWUpO1xuICAgIC8vIElmIHN0cmljdExpdGVyYWxUeXBlcyBpcyBkaXNhYmxlZCwgb2JqZWN0IGxpdGVyYWxzIGFyZSBjYXN0IHRvIGBhbnlgLlxuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNvbmZpZy5zdHJpY3RMaXRlcmFsVHlwZXMgPyBsaXRlcmFsIDogdHNDYXN0VG9BbnkobGl0ZXJhbCk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgbGV0IG5vZGU6IHRzLkV4cHJlc3Npb247XG4gICAgaWYgKGFzdC52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBub2RlID0gdHMuY3JlYXRlSWRlbnRpZmllcigndW5kZWZpbmVkJyk7XG4gICAgfSBlbHNlIGlmIChhc3QudmFsdWUgPT09IG51bGwpIHtcbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVOdWxsKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVMaXRlcmFsKGFzdC52YWx1ZSk7XG4gICAgfVxuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IG1ldGhvZCA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHJlY2VpdmVyLCBhc3QubmFtZSk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhtZXRob2QsIGFzdC5uYW1lU3Bhbik7XG4gICAgY29uc3QgYXJncyA9IGFzdC5hcmdzLm1hcChleHByID0+IHRoaXMudHJhbnNsYXRlKGV4cHIpKTtcbiAgICBjb25zdCBub2RlID0gdHMuY3JlYXRlQ2FsbChtZXRob2QsIHVuZGVmaW5lZCwgYXJncyk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBOb25OdWxsQXNzZXJ0KTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZXhwciA9IHdyYXBGb3JEaWFnbm9zdGljcyh0aGlzLnRyYW5zbGF0ZShhc3QuZXhwcmVzc2lvbikpO1xuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihleHByKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlKTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90KTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IHdyYXBGb3JEaWFnbm9zdGljcyh0aGlzLnRyYW5zbGF0ZShhc3QuZXhwcmVzc2lvbikpO1xuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVMb2dpY2FsTm90KGV4cHJlc3Npb24pO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQpOiB0cy5FeHByZXNzaW9uIHtcbiAgICAvLyBUaGlzIGlzIGEgbm9ybWFsIHByb3BlcnR5IHJlYWQgLSBjb252ZXJ0IHRoZSByZWNlaXZlciB0byBhbiBleHByZXNzaW9uIGFuZCBlbWl0IHRoZSBjb3JyZWN0XG4gICAgLy8gVHlwZVNjcmlwdCBleHByZXNzaW9uIHRvIHJlYWQgdGhlIHByb3BlcnR5LlxuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IG5hbWUgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhyZWNlaXZlciwgYXN0Lm5hbWUpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obmFtZSwgYXN0Lm5hbWVTcGFuKTtcbiAgICBjb25zdCBub2RlID0gd3JhcEZvckRpYWdub3N0aWNzKG5hbWUpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IGxlZnQgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhyZWNlaXZlciwgYXN0Lm5hbWUpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obGVmdCwgYXN0Lm5hbWVTcGFuKTtcbiAgICAvLyBUeXBlU2NyaXB0IHJlcG9ydHMgYXNzaWdubWVudCBlcnJvcnMgb24gdGhlIGVudGlyZSBsdmFsdWUgZXhwcmVzc2lvbi4gQW5ub3RhdGUgdGhlIGx2YWx1ZSBvZlxuICAgIC8vIHRoZSBhc3NpZ25tZW50IHdpdGggdGhlIHNvdXJjZVNwYW4sIHdoaWNoIGluY2x1ZGVzIHJlY2VpdmVycywgcmF0aGVyIHRoYW4gbmFtZVNwYW4gZm9yXG4gICAgLy8gY29uc2lzdGVuY3kgb2YgdGhlIGRpYWdub3N0aWMgbG9jYXRpb24uXG4gICAgLy8gYS5iLmMgPSAxXG4gICAgLy8gXl5eXl5eXl5eIHNvdXJjZVNwYW5cbiAgICAvLyAgICAgXiAgICAgbmFtZVNwYW5cbiAgICBjb25zdCBsZWZ0V2l0aFBhdGggPSB3cmFwRm9yRGlhZ25vc3RpY3MobGVmdCk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhsZWZ0V2l0aFBhdGgsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICAvLyBUaGUgcmlnaHQgbmVlZHMgdG8gYmUgd3JhcHBlZCBpbiBwYXJlbnMgYXMgd2VsbCBvciB3ZSBjYW5ub3QgYWNjdXJhdGVseSBtYXRjaCBpdHNcbiAgICAvLyBzcGFuIHRvIGp1c3QgdGhlIFJIUy4gRm9yIGV4YW1wbGUsIHRoZSBzcGFuIGluIGBlID0gJGV2ZW50IC8qMCwxMCovYCBpcyBhbWJpZ3VvdXMuXG4gICAgLy8gSXQgY291bGQgcmVmZXIgdG8gZWl0aGVyIHRoZSB3aG9sZSBiaW5hcnkgZXhwcmVzc2lvbiBvciBqdXN0IHRoZSBSSFMuXG4gICAgLy8gV2Ugc2hvdWxkIGluc3RlYWQgZ2VuZXJhdGUgYGUgPSAoJGV2ZW50IC8qMCwxMCovKWAgc28gd2Uga25vdyB0aGUgc3BhbiAwLDEwIG1hdGNoZXMgUkhTLlxuICAgIGNvbnN0IHJpZ2h0ID0gd3JhcEZvclR5cGVDaGVja2VyKHRoaXMudHJhbnNsYXRlKGFzdC52YWx1ZSkpO1xuICAgIGNvbnN0IG5vZGUgPVxuICAgICAgICB3cmFwRm9yRGlhZ25vc3RpY3ModHMuY3JlYXRlQmluYXJ5KGxlZnRXaXRoUGF0aCwgdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbiwgcmlnaHQpKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIHJldHVybiBOVUxMX0FTX0FOWTtcbiAgfVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIC8vIFNlZSB0aGUgY29tbWVudHMgaW4gU2FmZVByb3BlcnR5UmVhZCBhYm92ZSBmb3IgYW4gZXhwbGFuYXRpb24gb2YgdGhlIGNhc2VzIGhlcmUuXG4gICAgbGV0IG5vZGU6IHRzLkV4cHJlc3Npb247XG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnJlY2VpdmVyKSk7XG4gICAgY29uc3QgYXJncyA9IGFzdC5hcmdzLm1hcChleHByID0+IHRoaXMudHJhbnNsYXRlKGV4cHIpKTtcbiAgICBpZiAodGhpcy5jb25maWcuc3RyaWN0U2FmZU5hdmlnYXRpb25UeXBlcykge1xuICAgICAgLy8gXCJhPy5tZXRob2QoLi4uKVwiIGJlY29tZXMgKG51bGwgYXMgYW55ID8gYSEubWV0aG9kKC4uLikgOiB1bmRlZmluZWQpXG4gICAgICBjb25zdCBtZXRob2QgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihyZWNlaXZlciksIGFzdC5uYW1lKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8obWV0aG9kLCBhc3QubmFtZVNwYW4pO1xuICAgICAgY29uc3QgY2FsbCA9IHRzLmNyZWF0ZUNhbGwobWV0aG9kLCB1bmRlZmluZWQsIGFyZ3MpO1xuICAgICAgbm9kZSA9IHRzLmNyZWF0ZVBhcmVuKHRzLmNyZWF0ZUNvbmRpdGlvbmFsKE5VTExfQVNfQU5ZLCBjYWxsLCBVTkRFRklORUQpKTtcbiAgICB9IGVsc2UgaWYgKFZlU2FmZUxoc0luZmVyZW5jZUJ1Z0RldGVjdG9yLnZlV2lsbEluZmVyQW55Rm9yKGFzdCkpIHtcbiAgICAgIC8vIFwiYT8ubWV0aG9kKC4uLilcIiBiZWNvbWVzIChhIGFzIGFueSkubWV0aG9kKC4uLilcbiAgICAgIGNvbnN0IG1ldGhvZCA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHRzQ2FzdFRvQW55KHJlY2VpdmVyKSwgYXN0Lm5hbWUpO1xuICAgICAgYWRkUGFyc2VTcGFuSW5mbyhtZXRob2QsIGFzdC5uYW1lU3Bhbik7XG4gICAgICBub2RlID0gdHMuY3JlYXRlQ2FsbChtZXRob2QsIHVuZGVmaW5lZCwgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFwiYT8ubWV0aG9kKC4uLilcIiBiZWNvbWVzIChhIS5tZXRob2QoLi4uKSBhcyBhbnkpXG4gICAgICBjb25zdCBtZXRob2QgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihyZWNlaXZlciksIGFzdC5uYW1lKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8obWV0aG9kLCBhc3QubmFtZVNwYW4pO1xuICAgICAgbm9kZSA9IHRzQ2FzdFRvQW55KHRzLmNyZWF0ZUNhbGwobWV0aG9kLCB1bmRlZmluZWQsIGFyZ3MpKTtcbiAgICB9XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgbGV0IG5vZGU6IHRzLkV4cHJlc3Npb247XG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnJlY2VpdmVyKSk7XG4gICAgLy8gVGhlIGZvcm0gb2Ygc2FmZSBwcm9wZXJ0eSByZWFkcyBkZXBlbmRzIG9uIHdoZXRoZXIgc3RyaWN0bmVzcyBpcyBpbiB1c2UuXG4gICAgaWYgKHRoaXMuY29uZmlnLnN0cmljdFNhZmVOYXZpZ2F0aW9uVHlwZXMpIHtcbiAgICAgIC8vIEJhc2ljYWxseSwgdGhlIHJldHVybiBoZXJlIGlzIGVpdGhlciB0aGUgdHlwZSBvZiB0aGUgY29tcGxldGUgZXhwcmVzc2lvbiB3aXRoIGEgbnVsbC1zYWZlXG4gICAgICAvLyBwcm9wZXJ0eSByZWFkLCBvciBgdW5kZWZpbmVkYC4gU28gYSB0ZXJuYXJ5IGlzIHVzZWQgdG8gY3JlYXRlIGFuIFwib3JcIiB0eXBlOlxuICAgICAgLy8gXCJhPy5iXCIgYmVjb21lcyAobnVsbCBhcyBhbnkgPyBhIS5iIDogdW5kZWZpbmVkKVxuICAgICAgLy8gVGhlIHR5cGUgb2YgdGhpcyBleHByZXNzaW9uIGlzICh0eXBlb2YgYSEuYikgfCB1bmRlZmluZWQsIHdoaWNoIGlzIGV4YWN0bHkgYXMgZGVzaXJlZC5cbiAgICAgIGNvbnN0IGV4cHIgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihyZWNlaXZlciksIGFzdC5uYW1lKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8oZXhwciwgYXN0Lm5hbWVTcGFuKTtcbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVQYXJlbih0cy5jcmVhdGVDb25kaXRpb25hbChOVUxMX0FTX0FOWSwgZXhwciwgVU5ERUZJTkVEKSk7XG4gICAgfSBlbHNlIGlmIChWZVNhZmVMaHNJbmZlcmVuY2VCdWdEZXRlY3Rvci52ZVdpbGxJbmZlckFueUZvcihhc3QpKSB7XG4gICAgICAvLyBFbXVsYXRlIGEgVmlldyBFbmdpbmUgYnVnIHdoZXJlICdhbnknIGlzIGluZmVycmVkIGZvciB0aGUgbGVmdC1oYW5kIHNpZGUgb2YgdGhlIHNhZmVcbiAgICAgIC8vIG5hdmlnYXRpb24gb3BlcmF0aW9uLiBXaXRoIHRoaXMgYnVnLCB0aGUgdHlwZSBvZiB0aGUgbGVmdC1oYW5kIHNpZGUgaXMgcmVnYXJkZWQgYXMgYW55LlxuICAgICAgLy8gVGhlcmVmb3JlLCB0aGUgbGVmdC1oYW5kIHNpZGUgb25seSBuZWVkcyByZXBlYXRpbmcgaW4gdGhlIG91dHB1dCAodG8gdmFsaWRhdGUgaXQpLCBhbmQgdGhlblxuICAgICAgLy8gJ2FueScgaXMgdXNlZCBmb3IgdGhlIHJlc3Qgb2YgdGhlIGV4cHJlc3Npb24uIFRoaXMgaXMgZG9uZSB1c2luZyBhIGNvbW1hIG9wZXJhdG9yOlxuICAgICAgLy8gXCJhPy5iXCIgYmVjb21lcyAoYSBhcyBhbnkpLmIsIHdoaWNoIHdpbGwgb2YgY291cnNlIGhhdmUgdHlwZSAnYW55Jy5cbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0c0Nhc3RUb0FueShyZWNlaXZlciksIGFzdC5uYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIFZpZXcgRW5naW5lIGJ1ZyBpc24ndCBhY3RpdmUsIHNvIGNoZWNrIHRoZSBlbnRpcmUgdHlwZSBvZiB0aGUgZXhwcmVzc2lvbiwgYnV0IHRoZSBmaW5hbFxuICAgICAgLy8gcmVzdWx0IGlzIHN0aWxsIGluZmVycmVkIGFzIGBhbnlgLlxuICAgICAgLy8gXCJhPy5iXCIgYmVjb21lcyAoYSEuYiBhcyBhbnkpXG4gICAgICBjb25zdCBleHByID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24ocmVjZWl2ZXIpLCBhc3QubmFtZSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKGV4cHIsIGFzdC5uYW1lU3Bhbik7XG4gICAgICBub2RlID0gdHNDYXN0VG9BbnkoZXhwcik7XG4gICAgfVxuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRTYWZlS2V5ZWRSZWFkKGFzdDogU2FmZUtleWVkUmVhZCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IGtleSA9IHRoaXMudHJhbnNsYXRlKGFzdC5rZXkpO1xuICAgIGxldCBub2RlOiB0cy5FeHByZXNzaW9uO1xuXG4gICAgLy8gVGhlIGZvcm0gb2Ygc2FmZSBwcm9wZXJ0eSByZWFkcyBkZXBlbmRzIG9uIHdoZXRoZXIgc3RyaWN0bmVzcyBpcyBpbiB1c2UuXG4gICAgaWYgKHRoaXMuY29uZmlnLnN0cmljdFNhZmVOYXZpZ2F0aW9uVHlwZXMpIHtcbiAgICAgIC8vIFwiYT8uWy4uLl1cIiBiZWNvbWVzIChudWxsIGFzIGFueSA/IGEhWy4uLl0gOiB1bmRlZmluZWQpXG4gICAgICBjb25zdCBleHByID0gdHMuY3JlYXRlRWxlbWVudEFjY2Vzcyh0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihyZWNlaXZlciksIGtleSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKGV4cHIsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVQYXJlbih0cy5jcmVhdGVDb25kaXRpb25hbChOVUxMX0FTX0FOWSwgZXhwciwgVU5ERUZJTkVEKSk7XG4gICAgfSBlbHNlIGlmIChWZVNhZmVMaHNJbmZlcmVuY2VCdWdEZXRlY3Rvci52ZVdpbGxJbmZlckFueUZvcihhc3QpKSB7XG4gICAgICAvLyBcImE/LlsuLi5dXCIgYmVjb21lcyAoYSBhcyBhbnkpWy4uLl1cbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKHRzQ2FzdFRvQW55KHJlY2VpdmVyKSwga2V5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gXCJhPy5bLi4uXVwiIGJlY29tZXMgKGEhLlsuLi5dIGFzIGFueSlcbiAgICAgIGNvbnN0IGV4cHIgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKHRzLmNyZWF0ZU5vbk51bGxFeHByZXNzaW9uKHJlY2VpdmVyKSwga2V5KTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8oZXhwciwgYXN0LnNvdXJjZVNwYW4pO1xuICAgICAgbm9kZSA9IHRzQ2FzdFRvQW55KGV4cHIpO1xuICAgIH1cbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIFZpZXcgRW5naW5lIHdpbGwgaW5mZXIgYSB0eXBlIG9mICdhbnknIGZvciB0aGUgbGVmdC1oYW5kIHNpZGUgb2YgYSBzYWZlIG5hdmlnYXRpb25cbiAqIG9wZXJhdGlvbi5cbiAqXG4gKiBJbiBWaWV3IEVuZ2luZSdzIHRlbXBsYXRlIHR5cGUtY2hlY2tlciwgY2VydGFpbiByZWNlaXZlcnMgb2Ygc2FmZSBuYXZpZ2F0aW9uIG9wZXJhdGlvbnMgd2lsbFxuICogY2F1c2UgYSB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gYmUgYWxsb2NhdGVkIGFzIHBhcnQgb2YgdGhlIGNoZWNraW5nIGV4cHJlc3Npb24sIHRvIHNhdmUgdGhlIHZhbHVlXG4gKiBvZiB0aGUgcmVjZWl2ZXIgYW5kIHVzZSBpdCBtb3JlIHRoYW4gb25jZSBpbiB0aGUgZXhwcmVzc2lvbi4gVGhpcyB0ZW1wb3JhcnkgdmFyaWFibGUgaGFzIHR5cGVcbiAqICdhbnknLiBJbiBwcmFjdGljZSwgdGhpcyBtZWFucyBjZXJ0YWluIHJlY2VpdmVycyBjYXVzZSBWaWV3IEVuZ2luZSB0byBub3QgY2hlY2sgdGhlIGZ1bGxcbiAqIGV4cHJlc3Npb24sIGFuZCBvdGhlciByZWNlaXZlcnMgd2lsbCByZWNlaXZlIG1vcmUgY29tcGxldGUgY2hlY2tpbmcuXG4gKlxuICogRm9yIGNvbXBhdGliaWxpdHksIHRoaXMgbG9naWMgaXMgYWRhcHRlZCBmcm9tIFZpZXcgRW5naW5lJ3MgZXhwcmVzc2lvbl9jb252ZXJ0ZXIudHMgc28gdGhhdCB0aGVcbiAqIEl2eSBjaGVja2VyIGNhbiBlbXVsYXRlIHRoaXMgYnVnIHdoZW4gbmVlZGVkLlxuICovXG5jbGFzcyBWZVNhZmVMaHNJbmZlcmVuY2VCdWdEZXRlY3RvciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBwcml2YXRlIHN0YXRpYyBTSU5HTEVUT04gPSBuZXcgVmVTYWZlTGhzSW5mZXJlbmNlQnVnRGV0ZWN0b3IoKTtcblxuICBzdGF0aWMgdmVXaWxsSW5mZXJBbnlGb3IoYXN0OiBTYWZlTWV0aG9kQ2FsbHxTYWZlUHJvcGVydHlSZWFkfFNhZmVLZXllZFJlYWQpIHtcbiAgICBjb25zdCB2aXNpdG9yID0gVmVTYWZlTGhzSW5mZXJlbmNlQnVnRGV0ZWN0b3IuU0lOR0xFVE9OO1xuICAgIHJldHVybiBhc3QgaW5zdGFuY2VvZiBTYWZlS2V5ZWRSZWFkID8gYXN0LnJlY2VpdmVyLnZpc2l0KHZpc2l0b3IpIDogYXN0LnJlY2VpdmVyLnZpc2l0KHZpc2l0b3IpO1xuICB9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IFVuYXJ5KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5leHByLnZpc2l0KHRoaXMpO1xuICB9XG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5sZWZ0LnZpc2l0KHRoaXMpIHx8IGFzdC5yaWdodC52aXNpdCh0aGlzKTtcbiAgfVxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5jb25kaXRpb24udmlzaXQodGhpcykgfHwgYXN0LnRydWVFeHAudmlzaXQodGhpcykgfHwgYXN0LmZhbHNlRXhwLnZpc2l0KHRoaXMpO1xuICB9XG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IFRoaXNSZWNlaXZlcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5leHByZXNzaW9ucy5zb21lKGV4cCA9PiBleHAudmlzaXQodGhpcykpO1xuICB9XG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgfVxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBQcmVmaXhOb3QpOiBib29sZWFuIHtcbiAgICByZXR1cm4gYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gIH1cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBTYWZlS2V5ZWRSZWFkKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=