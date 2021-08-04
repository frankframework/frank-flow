/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '@angular/compiler';
const UNARY_OPERATORS = new Map([
    [o.UnaryOperator.Minus, '-'],
    [o.UnaryOperator.Plus, '+'],
]);
const BINARY_OPERATORS = new Map([
    [o.BinaryOperator.And, '&&'],
    [o.BinaryOperator.Bigger, '>'],
    [o.BinaryOperator.BiggerEquals, '>='],
    [o.BinaryOperator.BitwiseAnd, '&'],
    [o.BinaryOperator.Divide, '/'],
    [o.BinaryOperator.Equals, '=='],
    [o.BinaryOperator.Identical, '==='],
    [o.BinaryOperator.Lower, '<'],
    [o.BinaryOperator.LowerEquals, '<='],
    [o.BinaryOperator.Minus, '-'],
    [o.BinaryOperator.Modulo, '%'],
    [o.BinaryOperator.Multiply, '*'],
    [o.BinaryOperator.NotEquals, '!='],
    [o.BinaryOperator.NotIdentical, '!=='],
    [o.BinaryOperator.Or, '||'],
    [o.BinaryOperator.Plus, '+'],
    [o.BinaryOperator.NullishCoalesce, '??'],
]);
export class ExpressionTranslatorVisitor {
    constructor(factory, imports, options) {
        this.factory = factory;
        this.imports = imports;
        this.downlevelTaggedTemplates = options.downlevelTaggedTemplates === true;
        this.downlevelVariableDeclarations = options.downlevelVariableDeclarations === true;
        this.recordWrappedNode = options.recordWrappedNode || (() => { });
    }
    visitDeclareVarStmt(stmt, context) {
        var _a;
        const varType = this.downlevelVariableDeclarations ?
            'var' :
            stmt.hasModifier(o.StmtModifier.Final) ? 'const' : 'let';
        return this.attachComments(this.factory.createVariableDeclaration(stmt.name, (_a = stmt.value) === null || _a === void 0 ? void 0 : _a.visitExpression(this, context.withExpressionMode), varType), stmt.leadingComments);
    }
    visitDeclareFunctionStmt(stmt, context) {
        return this.attachComments(this.factory.createFunctionDeclaration(stmt.name, stmt.params.map(param => param.name), this.factory.createBlock(this.visitStatements(stmt.statements, context.withStatementMode))), stmt.leadingComments);
    }
    visitExpressionStmt(stmt, context) {
        return this.attachComments(this.factory.createExpressionStatement(stmt.expr.visitExpression(this, context.withStatementMode)), stmt.leadingComments);
    }
    visitReturnStmt(stmt, context) {
        return this.attachComments(this.factory.createReturnStatement(stmt.value.visitExpression(this, context.withExpressionMode)), stmt.leadingComments);
    }
    visitDeclareClassStmt(_stmt, _context) {
        throw new Error('Method not implemented.');
    }
    visitIfStmt(stmt, context) {
        return this.attachComments(this.factory.createIfStatement(stmt.condition.visitExpression(this, context), this.factory.createBlock(this.visitStatements(stmt.trueCase, context.withStatementMode)), stmt.falseCase.length > 0 ? this.factory.createBlock(this.visitStatements(stmt.falseCase, context.withStatementMode)) :
            null), stmt.leadingComments);
    }
    visitTryCatchStmt(_stmt, _context) {
        throw new Error('Method not implemented.');
    }
    visitThrowStmt(stmt, context) {
        return this.attachComments(this.factory.createThrowStatement(stmt.error.visitExpression(this, context.withExpressionMode)), stmt.leadingComments);
    }
    visitReadVarExpr(ast, _context) {
        const identifier = this.factory.createIdentifier(ast.name);
        this.setSourceMapRange(identifier, ast.sourceSpan);
        return identifier;
    }
    visitWriteVarExpr(expr, context) {
        const assignment = this.factory.createAssignment(this.setSourceMapRange(this.factory.createIdentifier(expr.name), expr.sourceSpan), expr.value.visitExpression(this, context));
        return context.isStatement ? assignment :
            this.factory.createParenthesizedExpression(assignment);
    }
    visitWriteKeyExpr(expr, context) {
        const exprContext = context.withExpressionMode;
        const target = this.factory.createElementAccess(expr.receiver.visitExpression(this, exprContext), expr.index.visitExpression(this, exprContext));
        const assignment = this.factory.createAssignment(target, expr.value.visitExpression(this, exprContext));
        return context.isStatement ? assignment :
            this.factory.createParenthesizedExpression(assignment);
    }
    visitWritePropExpr(expr, context) {
        const target = this.factory.createPropertyAccess(expr.receiver.visitExpression(this, context), expr.name);
        return this.factory.createAssignment(target, expr.value.visitExpression(this, context));
    }
    visitInvokeMethodExpr(ast, context) {
        const target = ast.receiver.visitExpression(this, context);
        return this.setSourceMapRange(this.factory.createCallExpression(ast.name !== null ? this.factory.createPropertyAccess(target, ast.name) : target, ast.args.map(arg => arg.visitExpression(this, context)), 
        /* pure */ false), ast.sourceSpan);
    }
    visitInvokeFunctionExpr(ast, context) {
        return this.setSourceMapRange(this.factory.createCallExpression(ast.fn.visitExpression(this, context), ast.args.map(arg => arg.visitExpression(this, context)), ast.pure), ast.sourceSpan);
    }
    visitTaggedTemplateExpr(ast, context) {
        return this.setSourceMapRange(this.createTaggedTemplateExpression(ast.tag.visitExpression(this, context), {
            elements: ast.template.elements.map(e => {
                var _a;
                return createTemplateElement({
                    cooked: e.text,
                    raw: e.rawText,
                    range: (_a = e.sourceSpan) !== null && _a !== void 0 ? _a : ast.sourceSpan,
                });
            }),
            expressions: ast.template.expressions.map(e => e.visitExpression(this, context))
        }), ast.sourceSpan);
    }
    visitInstantiateExpr(ast, context) {
        return this.factory.createNewExpression(ast.classExpr.visitExpression(this, context), ast.args.map(arg => arg.visitExpression(this, context)));
    }
    visitLiteralExpr(ast, _context) {
        return this.setSourceMapRange(this.factory.createLiteral(ast.value), ast.sourceSpan);
    }
    visitLocalizedString(ast, context) {
        // A `$localize` message consists of `messageParts` and `expressions`, which get interleaved
        // together. The interleaved pieces look like:
        // `[messagePart0, expression0, messagePart1, expression1, messagePart2]`
        //
        // Note that there is always a message part at the start and end, and so therefore
        // `messageParts.length === expressions.length + 1`.
        //
        // Each message part may be prefixed with "metadata", which is wrapped in colons (:) delimiters.
        // The metadata is attached to the first and subsequent message parts by calls to
        // `serializeI18nHead()` and `serializeI18nTemplatePart()` respectively.
        //
        // The first message part (i.e. `ast.messageParts[0]`) is used to initialize `messageParts`
        // array.
        const elements = [createTemplateElement(ast.serializeI18nHead())];
        const expressions = [];
        for (let i = 0; i < ast.expressions.length; i++) {
            const placeholder = this.setSourceMapRange(ast.expressions[i].visitExpression(this, context), ast.getPlaceholderSourceSpan(i));
            expressions.push(placeholder);
            elements.push(createTemplateElement(ast.serializeI18nTemplatePart(i + 1)));
        }
        const localizeTag = this.factory.createIdentifier('$localize');
        return this.setSourceMapRange(this.createTaggedTemplateExpression(localizeTag, { elements, expressions }), ast.sourceSpan);
    }
    createTaggedTemplateExpression(tag, template) {
        return this.downlevelTaggedTemplates ? this.createES5TaggedTemplateFunctionCall(tag, template) :
            this.factory.createTaggedTemplate(tag, template);
    }
    /**
     * Translate the tagged template literal into a call that is compatible with ES5, using the
     * imported `__makeTemplateObject` helper for ES5 formatted output.
     */
    createES5TaggedTemplateFunctionCall(tagHandler, { elements, expressions }) {
        // Ensure that the `__makeTemplateObject()` helper has been imported.
        const { moduleImport, symbol } = this.imports.generateNamedImport('tslib', '__makeTemplateObject');
        const __makeTemplateObjectHelper = (moduleImport === null) ?
            this.factory.createIdentifier(symbol) :
            this.factory.createPropertyAccess(moduleImport, symbol);
        // Collect up the cooked and raw strings into two separate arrays.
        const cooked = [];
        const raw = [];
        for (const element of elements) {
            cooked.push(this.factory.setSourceMapRange(this.factory.createLiteral(element.cooked), element.range));
            raw.push(this.factory.setSourceMapRange(this.factory.createLiteral(element.raw), element.range));
        }
        // Generate the helper call in the form: `__makeTemplateObject([cooked], [raw]);`
        const templateHelperCall = this.factory.createCallExpression(__makeTemplateObjectHelper, [this.factory.createArrayLiteral(cooked), this.factory.createArrayLiteral(raw)], 
        /* pure */ false);
        // Finally create the tagged handler call in the form:
        // `tag(__makeTemplateObject([cooked], [raw]), ...expressions);`
        return this.factory.createCallExpression(tagHandler, [templateHelperCall, ...expressions], 
        /* pure */ false);
    }
    visitExternalExpr(ast, _context) {
        if (ast.value.name === null) {
            if (ast.value.moduleName === null) {
                throw new Error('Invalid import without name nor moduleName');
            }
            return this.imports.generateNamespaceImport(ast.value.moduleName);
        }
        // If a moduleName is specified, this is a normal import. If there's no module name, it's a
        // reference to a global/ambient symbol.
        if (ast.value.moduleName !== null) {
            // This is a normal import. Find the imported module.
            const { moduleImport, symbol } = this.imports.generateNamedImport(ast.value.moduleName, ast.value.name);
            if (moduleImport === null) {
                // The symbol was ambient after all.
                return this.factory.createIdentifier(symbol);
            }
            else {
                return this.factory.createPropertyAccess(moduleImport, symbol);
            }
        }
        else {
            // The symbol is ambient, so just reference it.
            return this.factory.createIdentifier(ast.value.name);
        }
    }
    visitConditionalExpr(ast, context) {
        let cond = ast.condition.visitExpression(this, context);
        // Ordinarily the ternary operator is right-associative. The following are equivalent:
        //   `a ? b : c ? d : e` => `a ? b : (c ? d : e)`
        //
        // However, occasionally Angular needs to produce a left-associative conditional, such as in
        // the case of a null-safe navigation production: `{{a?.b ? c : d}}`. This template produces
        // a ternary of the form:
        //   `a == null ? null : rest of expression`
        // If the rest of the expression is also a ternary though, this would produce the form:
        //   `a == null ? null : a.b ? c : d`
        // which, if left as right-associative, would be incorrectly associated as:
        //   `a == null ? null : (a.b ? c : d)`
        //
        // In such cases, the left-associativity needs to be enforced with parentheses:
        //   `(a == null ? null : a.b) ? c : d`
        //
        // Such parentheses could always be included in the condition (guaranteeing correct behavior) in
        // all cases, but this has a code size cost. Instead, parentheses are added only when a
        // conditional expression is directly used as the condition of another.
        //
        // TODO(alxhub): investigate better logic for precendence of conditional operators
        if (ast.condition instanceof o.ConditionalExpr) {
            // The condition of this ternary needs to be wrapped in parentheses to maintain
            // left-associativity.
            cond = this.factory.createParenthesizedExpression(cond);
        }
        return this.factory.createConditional(cond, ast.trueCase.visitExpression(this, context), ast.falseCase.visitExpression(this, context));
    }
    visitNotExpr(ast, context) {
        return this.factory.createUnaryExpression('!', ast.condition.visitExpression(this, context));
    }
    visitAssertNotNullExpr(ast, context) {
        return ast.condition.visitExpression(this, context);
    }
    visitCastExpr(ast, context) {
        return ast.value.visitExpression(this, context);
    }
    visitFunctionExpr(ast, context) {
        var _a;
        return this.factory.createFunctionExpression((_a = ast.name) !== null && _a !== void 0 ? _a : null, ast.params.map(param => param.name), this.factory.createBlock(this.visitStatements(ast.statements, context)));
    }
    visitBinaryOperatorExpr(ast, context) {
        if (!BINARY_OPERATORS.has(ast.operator)) {
            throw new Error(`Unknown binary operator: ${o.BinaryOperator[ast.operator]}`);
        }
        return this.factory.createBinaryExpression(ast.lhs.visitExpression(this, context), BINARY_OPERATORS.get(ast.operator), ast.rhs.visitExpression(this, context));
    }
    visitReadPropExpr(ast, context) {
        return this.factory.createPropertyAccess(ast.receiver.visitExpression(this, context), ast.name);
    }
    visitReadKeyExpr(ast, context) {
        return this.factory.createElementAccess(ast.receiver.visitExpression(this, context), ast.index.visitExpression(this, context));
    }
    visitLiteralArrayExpr(ast, context) {
        return this.factory.createArrayLiteral(ast.entries.map(expr => this.setSourceMapRange(expr.visitExpression(this, context), ast.sourceSpan)));
    }
    visitLiteralMapExpr(ast, context) {
        const properties = ast.entries.map(entry => {
            return {
                propertyName: entry.key,
                quoted: entry.quoted,
                value: entry.value.visitExpression(this, context)
            };
        });
        return this.setSourceMapRange(this.factory.createObjectLiteral(properties), ast.sourceSpan);
    }
    visitCommaExpr(ast, context) {
        throw new Error('Method not implemented.');
    }
    visitWrappedNodeExpr(ast, _context) {
        this.recordWrappedNode(ast);
        return ast.node;
    }
    visitTypeofExpr(ast, context) {
        return this.factory.createTypeOfExpression(ast.expr.visitExpression(this, context));
    }
    visitUnaryOperatorExpr(ast, context) {
        if (!UNARY_OPERATORS.has(ast.operator)) {
            throw new Error(`Unknown unary operator: ${o.UnaryOperator[ast.operator]}`);
        }
        return this.factory.createUnaryExpression(UNARY_OPERATORS.get(ast.operator), ast.expr.visitExpression(this, context));
    }
    visitStatements(statements, context) {
        return statements.map(stmt => stmt.visitStatement(this, context))
            .filter(stmt => stmt !== undefined);
    }
    setSourceMapRange(ast, span) {
        return this.factory.setSourceMapRange(ast, createRange(span));
    }
    attachComments(statement, leadingComments) {
        if (leadingComments !== undefined) {
            this.factory.attachComments(statement, leadingComments);
        }
        return statement;
    }
}
/**
 * Convert a cooked-raw string object into one that can be used by the AST factories.
 */
function createTemplateElement({ cooked, raw, range }) {
    return { cooked, raw, range: createRange(range) };
}
/**
 * Convert an OutputAST source-span into a range that can be used by the AST factories.
 */
function createRange(span) {
    if (span === null) {
        return null;
    }
    const { start, end } = span;
    const { url, content } = start.file;
    if (!url) {
        return null;
    }
    return {
        url,
        content,
        start: { offset: start.offset, line: start.line, column: start.col },
        end: { offset: end.offset, line: end.line, column: end.col },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNsYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHJhbnNsYXRvci9zcmMvdHJhbnNsYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLG1CQUFtQixDQUFDO0FBT3ZDLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFpQztJQUM5RCxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztDQUM1QixDQUFDLENBQUM7QUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFtQztJQUNqRSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQztJQUNyQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQztJQUNsQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQztJQUNuQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQztJQUM3QixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztJQUNwQyxDQUFDLENBQUMsQ0FB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RUFBRSxHQUFHLENBQUMsR0FBRyxFQUFDO0tBQzNELENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCB7Y3JlYXRlVGFnZ2VkVGVtcGxhdGV9IGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0FzdEZhY3RvcnksIEJpbmFyeU9wZXJhdG9yLCBPYmplY3RMaXRlcmFsUHJvcGVydHksIFNvdXJjZU1hcFJhbmdlLCBUZW1wbGF0ZUVsZW1lbnQsIFRlbXBsYXRlTGl0ZXJhbCwgVW5hcnlPcGVyYXRvcn0gZnJvbSAnLi9hcGkvYXN0X2ZhY3RvcnknO1xuaW1wb3J0IHtJbXBvcnRHZW5lcmF0b3J9IGZyb20gJy4vYXBpL2ltcG9ydF9nZW5lcmF0b3InO1xuaW1wb3J0IHtDb250ZXh0fSBmcm9tICcuL2NvbnRleHQnO1xuXG5jb25zdCBVTkFSWV9PUEVSQVRPUlMgPSBuZXcgTWFwPG8uVW5hcnlPcGVyYXRvciwgVW5hcnlPcGVyYXRvcj4oW1xuICBbby5VbmFyeU9wZXJhdG9yLk1pbnVzLCAnLSddLFxuICBbby5VbmFyeU9wZXJhdG9yLlBsdXMsICcrJ10sXG5dKTtcblxuY29uc3QgQklOQVJZX09QRVJBVE9SUyA9IG5ldyBNYXA8by5CaW5hcnlPcGVyYXRvciwgQmluYXJ5T3BlcmF0b3I+KFtcbiAgW28uQmluYXJ5T3BlcmF0b3IuQW5kLCAnJiYnXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyLCAnPiddLFxuICBbby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHMsICc+PSddLFxuICBbby5CaW5hcnlPcGVyYXRvci5CaXR3aXNlQW5kLCAnJiddLFxuICBbby5CaW5hcnlPcGVyYXRvci5EaXZpZGUsICcvJ10sXG4gIFtvLkJpbmFyeU9wZXJhdG9yLkVxdWFscywgJz09J10sXG4gIFtvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCwgJz09PSddLFxuICBbby5CaW5hcnlPcGVyYXRvci5Mb3dlciwgJzwnXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHMsICc8PSddLFxuICBbby5CaW5hcnlPcGVyYXRvci5NaW51cywgJy0nXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuTW9kdWxvLCAnJSddLFxuICBbby5CaW5hcnlPcGVyYXRvci5NdWx0aXBseSwgJyonXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzLCAnIT0nXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsLCAnIT09J10sXG4gIFtvLkJpbmFyeU9wZXJhdG9yLk9yLCAnfHwnXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuUGx1cywgJysnXSxcbiAgW28uQmluYXJ5T3BlcmF0b3IuTnVsbGlzaENvYWxlc2NlLCAnPz8nXSxcbl0pO1xuXG5leHBvcnQgdHlwZSBSZWNvcmRXcmFwcGVkTm9kZUZuPFRFeHByZXNzaW9uPiA9IChub2RlOiBvLldyYXBwZWROb2RlRXhwcjxURXhwcmVzc2lvbj4pID0+IHZvaWQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhbnNsYXRvck9wdGlvbnM8VEV4cHJlc3Npb24+IHtcbiAgZG93bmxldmVsVGFnZ2VkVGVtcGxhdGVzPzogYm9vbGVhbjtcbiAgZG93bmxldmVsVmFyaWFibGVEZWNsYXJhdGlvbnM/OiBib29sZWFuO1xuICByZWNvcmRXcmFwcGVkTm9kZT86IFJlY29yZFdyYXBwZWROb2RlRm48VEV4cHJlc3Npb24+O1xuICBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBFeHByZXNzaW9uVHJhbnNsYXRvclZpc2l0b3I8VFN0YXRlbWVudCwgVEV4cHJlc3Npb24+IGltcGxlbWVudHMgby5FeHByZXNzaW9uVmlzaXRvcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5TdGF0ZW1lbnRWaXNpdG9yIHtcbiAgcHJpdmF0ZSBkb3dubGV2ZWxUYWdnZWRUZW1wbGF0ZXM6IGJvb2xlYW47XG4gIHByaXZhdGUgZG93bmxldmVsVmFyaWFibGVEZWNsYXJhdGlvbnM6IGJvb2xlYW47XG4gIHByaXZhdGUgcmVjb3JkV3JhcHBlZE5vZGU6IFJlY29yZFdyYXBwZWROb2RlRm48VEV4cHJlc3Npb24+O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBmYWN0b3J5OiBBc3RGYWN0b3J5PFRTdGF0ZW1lbnQsIFRFeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgaW1wb3J0czogSW1wb3J0R2VuZXJhdG9yPFRFeHByZXNzaW9uPiwgb3B0aW9uczogVHJhbnNsYXRvck9wdGlvbnM8VEV4cHJlc3Npb24+KSB7XG4gICAgdGhpcy5kb3dubGV2ZWxUYWdnZWRUZW1wbGF0ZXMgPSBvcHRpb25zLmRvd25sZXZlbFRhZ2dlZFRlbXBsYXRlcyA9PT0gdHJ1ZTtcbiAgICB0aGlzLmRvd25sZXZlbFZhcmlhYmxlRGVjbGFyYXRpb25zID0gb3B0aW9ucy5kb3dubGV2ZWxWYXJpYWJsZURlY2xhcmF0aW9ucyA9PT0gdHJ1ZTtcbiAgICB0aGlzLnJlY29yZFdyYXBwZWROb2RlID0gb3B0aW9ucy5yZWNvcmRXcmFwcGVkTm9kZSB8fCAoKCkgPT4ge30pO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjb250ZXh0OiBDb250ZXh0KTogVFN0YXRlbWVudCB7XG4gICAgY29uc3QgdmFyVHlwZSA9IHRoaXMuZG93bmxldmVsVmFyaWFibGVEZWNsYXJhdGlvbnMgP1xuICAgICAgICAndmFyJyA6XG4gICAgICAgIHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRmluYWwpID8gJ2NvbnN0JyA6ICdsZXQnO1xuICAgIHJldHVybiB0aGlzLmF0dGFjaENvbW1lbnRzKFxuICAgICAgICB0aGlzLmZhY3RvcnkuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgICAgIHN0bXQubmFtZSwgc3RtdC52YWx1ZT8udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQud2l0aEV4cHJlc3Npb25Nb2RlKSwgdmFyVHlwZSksXG4gICAgICAgIHN0bXQubGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBvLkRlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IENvbnRleHQpOiBUU3RhdGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5hdHRhY2hDb21tZW50cyhcbiAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZUZ1bmN0aW9uRGVjbGFyYXRpb24oXG4gICAgICAgICAgICBzdG10Lm5hbWUsIHN0bXQucGFyYW1zLm1hcChwYXJhbSA9PiBwYXJhbS5uYW1lKSxcbiAgICAgICAgICAgIHRoaXMuZmFjdG9yeS5jcmVhdGVCbG9jayhcbiAgICAgICAgICAgICAgICB0aGlzLnZpc2l0U3RhdGVtZW50cyhzdG10LnN0YXRlbWVudHMsIGNvbnRleHQud2l0aFN0YXRlbWVudE1vZGUpKSksXG4gICAgICAgIHN0bXQubGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0RXhwcmVzc2lvblN0bXQoc3RtdDogby5FeHByZXNzaW9uU3RhdGVtZW50LCBjb250ZXh0OiBDb250ZXh0KTogVFN0YXRlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuYXR0YWNoQ29tbWVudHMoXG4gICAgICAgIHRoaXMuZmFjdG9yeS5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KFxuICAgICAgICAgICAgc3RtdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0LndpdGhTdGF0ZW1lbnRNb2RlKSksXG4gICAgICAgIHN0bXQubGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBvLlJldHVyblN0YXRlbWVudCwgY29udGV4dDogQ29udGV4dCk6IFRTdGF0ZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmF0dGFjaENvbW1lbnRzKFxuICAgICAgICB0aGlzLmZhY3RvcnkuY3JlYXRlUmV0dXJuU3RhdGVtZW50KFxuICAgICAgICAgICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dC53aXRoRXhwcmVzc2lvbk1vZGUpKSxcbiAgICAgICAgc3RtdC5sZWFkaW5nQ29tbWVudHMpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KF9zdG10OiBvLkNsYXNzU3RtdCwgX2NvbnRleHQ6IENvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRJZlN0bXQoc3RtdDogby5JZlN0bXQsIGNvbnRleHQ6IENvbnRleHQpOiBUU3RhdGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5hdHRhY2hDb21tZW50cyhcbiAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZUlmU3RhdGVtZW50KFxuICAgICAgICAgICAgc3RtdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZUJsb2NrKFxuICAgICAgICAgICAgICAgIHRoaXMudmlzaXRTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGNvbnRleHQud2l0aFN0YXRlbWVudE1vZGUpKSxcbiAgICAgICAgICAgIHN0bXQuZmFsc2VDYXNlLmxlbmd0aCA+IDAgPyB0aGlzLmZhY3RvcnkuY3JlYXRlQmxvY2sodGhpcy52aXNpdFN0YXRlbWVudHMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0bXQuZmFsc2VDYXNlLCBjb250ZXh0LndpdGhTdGF0ZW1lbnRNb2RlKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwpLFxuICAgICAgICBzdG10LmxlYWRpbmdDb21tZW50cyk7XG4gIH1cblxuICB2aXNpdFRyeUNhdGNoU3RtdChfc3RtdDogby5UcnlDYXRjaFN0bXQsIF9jb250ZXh0OiBDb250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IG8uVGhyb3dTdG10LCBjb250ZXh0OiBDb250ZXh0KTogVFN0YXRlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuYXR0YWNoQ29tbWVudHMoXG4gICAgICAgIHRoaXMuZmFjdG9yeS5jcmVhdGVUaHJvd1N0YXRlbWVudChcbiAgICAgICAgICAgIHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQud2l0aEV4cHJlc3Npb25Nb2RlKSksXG4gICAgICAgIHN0bXQubGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBvLlJlYWRWYXJFeHByLCBfY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICBjb25zdCBpZGVudGlmaWVyID0gdGhpcy5mYWN0b3J5LmNyZWF0ZUlkZW50aWZpZXIoYXN0Lm5hbWUhKTtcbiAgICB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKGlkZW50aWZpZXIsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gaWRlbnRpZmllcjtcbiAgfVxuXG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IG8uV3JpdGVWYXJFeHByLCBjb250ZXh0OiBDb250ZXh0KTogVEV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGFzc2lnbm1lbnQgPSB0aGlzLmZhY3RvcnkuY3JlYXRlQXNzaWdubWVudChcbiAgICAgICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZSh0aGlzLmZhY3RvcnkuY3JlYXRlSWRlbnRpZmllcihleHByLm5hbWUpLCBleHByLnNvdXJjZVNwYW4pLFxuICAgICAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICApO1xuICAgIHJldHVybiBjb250ZXh0LmlzU3RhdGVtZW50ID8gYXNzaWdubWVudCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZhY3RvcnkuY3JlYXRlUGFyZW50aGVzaXplZEV4cHJlc3Npb24oYXNzaWdubWVudCk7XG4gIH1cblxuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBvLldyaXRlS2V5RXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICBjb25zdCBleHByQ29udGV4dCA9IGNvbnRleHQud2l0aEV4cHJlc3Npb25Nb2RlO1xuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZmFjdG9yeS5jcmVhdGVFbGVtZW50QWNjZXNzKFxuICAgICAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBleHByQ29udGV4dCksXG4gICAgICAgIGV4cHIuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGV4cHJDb250ZXh0KSxcbiAgICApO1xuICAgIGNvbnN0IGFzc2lnbm1lbnQgPVxuICAgICAgICB0aGlzLmZhY3RvcnkuY3JlYXRlQXNzaWdubWVudCh0YXJnZXQsIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGV4cHJDb250ZXh0KSk7XG4gICAgcmV0dXJuIGNvbnRleHQuaXNTdGF0ZW1lbnQgPyBhc3NpZ25tZW50IDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmFjdG9yeS5jcmVhdGVQYXJlbnRoZXNpemVkRXhwcmVzc2lvbihhc3NpZ25tZW50KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBvLldyaXRlUHJvcEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgY29uc3QgdGFyZ2V0ID1cbiAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZVByb3BlcnR5QWNjZXNzKGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBleHByLm5hbWUpO1xuICAgIHJldHVybiB0aGlzLmZhY3RvcnkuY3JlYXRlQXNzaWdubWVudCh0YXJnZXQsIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0SW52b2tlTWV0aG9kRXhwcihhc3Q6IG8uSW52b2tlTWV0aG9kRXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICBjb25zdCB0YXJnZXQgPSBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKFxuICAgICAgICB0aGlzLmZhY3RvcnkuY3JlYXRlQ2FsbEV4cHJlc3Npb24oXG4gICAgICAgICAgICBhc3QubmFtZSAhPT0gbnVsbCA/IHRoaXMuZmFjdG9yeS5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0YXJnZXQsIGFzdC5uYW1lKSA6IHRhcmdldCxcbiAgICAgICAgICAgIGFzdC5hcmdzLm1hcChhcmcgPT4gYXJnLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSksXG4gICAgICAgICAgICAvKiBwdXJlICovIGZhbHNlKSxcbiAgICAgICAgYXN0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoYXN0OiBvLkludm9rZUZ1bmN0aW9uRXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShcbiAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZUNhbGxFeHByZXNzaW9uKFxuICAgICAgICAgICAgYXN0LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgICAgIGFzdC5hcmdzLm1hcChhcmcgPT4gYXJnLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSksIGFzdC5wdXJlKSxcbiAgICAgICAgYXN0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRUYWdnZWRUZW1wbGF0ZUV4cHIoYXN0OiBvLlRhZ2dlZFRlbXBsYXRlRXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShcbiAgICAgICAgdGhpcy5jcmVhdGVUYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24oYXN0LnRhZy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHtcbiAgICAgICAgICBlbGVtZW50czogYXN0LnRlbXBsYXRlLmVsZW1lbnRzLm1hcChlID0+IGNyZWF0ZVRlbXBsYXRlRWxlbWVudCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb29rZWQ6IGUudGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJhdzogZS5yYXdUZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmFuZ2U6IGUuc291cmNlU3BhbiA/PyBhc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgZXhwcmVzc2lvbnM6IGFzdC50ZW1wbGF0ZS5leHByZXNzaW9ucy5tYXAoZSA9PiBlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSlcbiAgICAgICAgfSksXG4gICAgICAgIGFzdC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogby5JbnN0YW50aWF0ZUV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yeS5jcmVhdGVOZXdFeHByZXNzaW9uKFxuICAgICAgICBhc3QuY2xhc3NFeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgYXN0LmFyZ3MubWFwKGFyZyA9PiBhcmcudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogby5MaXRlcmFsRXhwciwgX2NvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0U291cmNlTWFwUmFuZ2UodGhpcy5mYWN0b3J5LmNyZWF0ZUxpdGVyYWwoYXN0LnZhbHVlKSwgYXN0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBvLkxvY2FsaXplZFN0cmluZywgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICAvLyBBIGAkbG9jYWxpemVgIG1lc3NhZ2UgY29uc2lzdHMgb2YgYG1lc3NhZ2VQYXJ0c2AgYW5kIGBleHByZXNzaW9uc2AsIHdoaWNoIGdldCBpbnRlcmxlYXZlZFxuICAgIC8vIHRvZ2V0aGVyLiBUaGUgaW50ZXJsZWF2ZWQgcGllY2VzIGxvb2sgbGlrZTpcbiAgICAvLyBgW21lc3NhZ2VQYXJ0MCwgZXhwcmVzc2lvbjAsIG1lc3NhZ2VQYXJ0MSwgZXhwcmVzc2lvbjEsIG1lc3NhZ2VQYXJ0Ml1gXG4gICAgLy9cbiAgICAvLyBOb3RlIHRoYXQgdGhlcmUgaXMgYWx3YXlzIGEgbWVzc2FnZSBwYXJ0IGF0IHRoZSBzdGFydCBhbmQgZW5kLCBhbmQgc28gdGhlcmVmb3JlXG4gICAgLy8gYG1lc3NhZ2VQYXJ0cy5sZW5ndGggPT09IGV4cHJlc3Npb25zLmxlbmd0aCArIDFgLlxuICAgIC8vXG4gICAgLy8gRWFjaCBtZXNzYWdlIHBhcnQgbWF5IGJlIHByZWZpeGVkIHdpdGggXCJtZXRhZGF0YVwiLCB3aGljaCBpcyB3cmFwcGVkIGluIGNvbG9ucyAoOikgZGVsaW1pdGVycy5cbiAgICAvLyBUaGUgbWV0YWRhdGEgaXMgYXR0YWNoZWQgdG8gdGhlIGZpcnN0IGFuZCBzdWJzZXF1ZW50IG1lc3NhZ2UgcGFydHMgYnkgY2FsbHMgdG9cbiAgICAvLyBgc2VyaWFsaXplSTE4bkhlYWQoKWAgYW5kIGBzZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KClgIHJlc3BlY3RpdmVseS5cbiAgICAvL1xuICAgIC8vIFRoZSBmaXJzdCBtZXNzYWdlIHBhcnQgKGkuZS4gYGFzdC5tZXNzYWdlUGFydHNbMF1gKSBpcyB1c2VkIHRvIGluaXRpYWxpemUgYG1lc3NhZ2VQYXJ0c2BcbiAgICAvLyBhcnJheS5cbiAgICBjb25zdCBlbGVtZW50czogVGVtcGxhdGVFbGVtZW50W10gPSBbY3JlYXRlVGVtcGxhdGVFbGVtZW50KGFzdC5zZXJpYWxpemVJMThuSGVhZCgpKV07XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IFRFeHByZXNzaW9uW10gPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzdC5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXIgPSB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKFxuICAgICAgICAgIGFzdC5leHByZXNzaW9uc1tpXS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5nZXRQbGFjZWhvbGRlclNvdXJjZVNwYW4oaSkpO1xuICAgICAgZXhwcmVzc2lvbnMucHVzaChwbGFjZWhvbGRlcik7XG4gICAgICBlbGVtZW50cy5wdXNoKGNyZWF0ZVRlbXBsYXRlRWxlbWVudChhc3Quc2VyaWFsaXplSTE4blRlbXBsYXRlUGFydChpICsgMSkpKTtcbiAgICB9XG5cbiAgICBjb25zdCBsb2NhbGl6ZVRhZyA9IHRoaXMuZmFjdG9yeS5jcmVhdGVJZGVudGlmaWVyKCckbG9jYWxpemUnKTtcbiAgICByZXR1cm4gdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShcbiAgICAgICAgdGhpcy5jcmVhdGVUYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24obG9jYWxpemVUYWcsIHtlbGVtZW50cywgZXhwcmVzc2lvbnN9KSwgYXN0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVUYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24odGFnOiBURXhwcmVzc2lvbiwgdGVtcGxhdGU6IFRlbXBsYXRlTGl0ZXJhbDxURXhwcmVzc2lvbj4pOlxuICAgICAgVEV4cHJlc3Npb24ge1xuICAgIHJldHVybiB0aGlzLmRvd25sZXZlbFRhZ2dlZFRlbXBsYXRlcyA/IHRoaXMuY3JlYXRlRVM1VGFnZ2VkVGVtcGxhdGVGdW5jdGlvbkNhbGwodGFnLCB0ZW1wbGF0ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmFjdG9yeS5jcmVhdGVUYWdnZWRUZW1wbGF0ZSh0YWcsIHRlbXBsYXRlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2xhdGUgdGhlIHRhZ2dlZCB0ZW1wbGF0ZSBsaXRlcmFsIGludG8gYSBjYWxsIHRoYXQgaXMgY29tcGF0aWJsZSB3aXRoIEVTNSwgdXNpbmcgdGhlXG4gICAqIGltcG9ydGVkIGBfX21ha2VUZW1wbGF0ZU9iamVjdGAgaGVscGVyIGZvciBFUzUgZm9ybWF0dGVkIG91dHB1dC5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRVM1VGFnZ2VkVGVtcGxhdGVGdW5jdGlvbkNhbGwoXG4gICAgICB0YWdIYW5kbGVyOiBURXhwcmVzc2lvbiwge2VsZW1lbnRzLCBleHByZXNzaW9uc306IFRlbXBsYXRlTGl0ZXJhbDxURXhwcmVzc2lvbj4pOiBURXhwcmVzc2lvbiB7XG4gICAgLy8gRW5zdXJlIHRoYXQgdGhlIGBfX21ha2VUZW1wbGF0ZU9iamVjdCgpYCBoZWxwZXIgaGFzIGJlZW4gaW1wb3J0ZWQuXG4gICAgY29uc3Qge21vZHVsZUltcG9ydCwgc3ltYm9sfSA9XG4gICAgICAgIHRoaXMuaW1wb3J0cy5nZW5lcmF0ZU5hbWVkSW1wb3J0KCd0c2xpYicsICdfX21ha2VUZW1wbGF0ZU9iamVjdCcpO1xuICAgIGNvbnN0IF9fbWFrZVRlbXBsYXRlT2JqZWN0SGVscGVyID0gKG1vZHVsZUltcG9ydCA9PT0gbnVsbCkgP1xuICAgICAgICB0aGlzLmZhY3RvcnkuY3JlYXRlSWRlbnRpZmllcihzeW1ib2wpIDpcbiAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZVByb3BlcnR5QWNjZXNzKG1vZHVsZUltcG9ydCwgc3ltYm9sKTtcblxuICAgIC8vIENvbGxlY3QgdXAgdGhlIGNvb2tlZCBhbmQgcmF3IHN0cmluZ3MgaW50byB0d28gc2VwYXJhdGUgYXJyYXlzLlxuICAgIGNvbnN0IGNvb2tlZDogVEV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IHJhdzogVEV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgY29va2VkLnB1c2godGhpcy5mYWN0b3J5LnNldFNvdXJjZU1hcFJhbmdlKFxuICAgICAgICAgIHRoaXMuZmFjdG9yeS5jcmVhdGVMaXRlcmFsKGVsZW1lbnQuY29va2VkKSwgZWxlbWVudC5yYW5nZSkpO1xuICAgICAgcmF3LnB1c2goXG4gICAgICAgICAgdGhpcy5mYWN0b3J5LnNldFNvdXJjZU1hcFJhbmdlKHRoaXMuZmFjdG9yeS5jcmVhdGVMaXRlcmFsKGVsZW1lbnQucmF3KSwgZWxlbWVudC5yYW5nZSkpO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIHRoZSBoZWxwZXIgY2FsbCBpbiB0aGUgZm9ybTogYF9fbWFrZVRlbXBsYXRlT2JqZWN0KFtjb29rZWRdLCBbcmF3XSk7YFxuICAgIGNvbnN0IHRlbXBsYXRlSGVscGVyQ2FsbCA9IHRoaXMuZmFjdG9yeS5jcmVhdGVDYWxsRXhwcmVzc2lvbihcbiAgICAgICAgX19tYWtlVGVtcGxhdGVPYmplY3RIZWxwZXIsXG4gICAgICAgIFt0aGlzLmZhY3RvcnkuY3JlYXRlQXJyYXlMaXRlcmFsKGNvb2tlZCksIHRoaXMuZmFjdG9yeS5jcmVhdGVBcnJheUxpdGVyYWwocmF3KV0sXG4gICAgICAgIC8qIHB1cmUgKi8gZmFsc2UpO1xuXG4gICAgLy8gRmluYWxseSBjcmVhdGUgdGhlIHRhZ2dlZCBoYW5kbGVyIGNhbGwgaW4gdGhlIGZvcm06XG4gICAgLy8gYHRhZyhfX21ha2VUZW1wbGF0ZU9iamVjdChbY29va2VkXSwgW3Jhd10pLCAuLi5leHByZXNzaW9ucyk7YFxuICAgIHJldHVybiB0aGlzLmZhY3RvcnkuY3JlYXRlQ2FsbEV4cHJlc3Npb24oXG4gICAgICAgIHRhZ0hhbmRsZXIsIFt0ZW1wbGF0ZUhlbHBlckNhbGwsIC4uLmV4cHJlc3Npb25zXSxcbiAgICAgICAgLyogcHVyZSAqLyBmYWxzZSk7XG4gIH1cblxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByLCBfY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICBpZiAoYXN0LnZhbHVlLm5hbWUgPT09IG51bGwpIHtcbiAgICAgIGlmIChhc3QudmFsdWUubW9kdWxlTmFtZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW1wb3J0IHdpdGhvdXQgbmFtZSBub3IgbW9kdWxlTmFtZScpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuaW1wb3J0cy5nZW5lcmF0ZU5hbWVzcGFjZUltcG9ydChhc3QudmFsdWUubW9kdWxlTmFtZSk7XG4gICAgfVxuICAgIC8vIElmIGEgbW9kdWxlTmFtZSBpcyBzcGVjaWZpZWQsIHRoaXMgaXMgYSBub3JtYWwgaW1wb3J0LiBJZiB0aGVyZSdzIG5vIG1vZHVsZSBuYW1lLCBpdCdzIGFcbiAgICAvLyByZWZlcmVuY2UgdG8gYSBnbG9iYWwvYW1iaWVudCBzeW1ib2wuXG4gICAgaWYgKGFzdC52YWx1ZS5tb2R1bGVOYW1lICE9PSBudWxsKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgbm9ybWFsIGltcG9ydC4gRmluZCB0aGUgaW1wb3J0ZWQgbW9kdWxlLlxuICAgICAgY29uc3Qge21vZHVsZUltcG9ydCwgc3ltYm9sfSA9XG4gICAgICAgICAgdGhpcy5pbXBvcnRzLmdlbmVyYXRlTmFtZWRJbXBvcnQoYXN0LnZhbHVlLm1vZHVsZU5hbWUsIGFzdC52YWx1ZS5uYW1lKTtcbiAgICAgIGlmIChtb2R1bGVJbXBvcnQgPT09IG51bGwpIHtcbiAgICAgICAgLy8gVGhlIHN5bWJvbCB3YXMgYW1iaWVudCBhZnRlciBhbGwuXG4gICAgICAgIHJldHVybiB0aGlzLmZhY3RvcnkuY3JlYXRlSWRlbnRpZmllcihzeW1ib2wpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmFjdG9yeS5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyhtb2R1bGVJbXBvcnQsIHN5bWJvbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBzeW1ib2wgaXMgYW1iaWVudCwgc28ganVzdCByZWZlcmVuY2UgaXQuXG4gICAgICByZXR1cm4gdGhpcy5mYWN0b3J5LmNyZWF0ZUlkZW50aWZpZXIoYXN0LnZhbHVlLm5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogby5Db25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgbGV0IGNvbmQ6IFRFeHByZXNzaW9uID0gYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG5cbiAgICAvLyBPcmRpbmFyaWx5IHRoZSB0ZXJuYXJ5IG9wZXJhdG9yIGlzIHJpZ2h0LWFzc29jaWF0aXZlLiBUaGUgZm9sbG93aW5nIGFyZSBlcXVpdmFsZW50OlxuICAgIC8vICAgYGEgPyBiIDogYyA/IGQgOiBlYCA9PiBgYSA/IGIgOiAoYyA/IGQgOiBlKWBcbiAgICAvL1xuICAgIC8vIEhvd2V2ZXIsIG9jY2FzaW9uYWxseSBBbmd1bGFyIG5lZWRzIHRvIHByb2R1Y2UgYSBsZWZ0LWFzc29jaWF0aXZlIGNvbmRpdGlvbmFsLCBzdWNoIGFzIGluXG4gICAgLy8gdGhlIGNhc2Ugb2YgYSBudWxsLXNhZmUgbmF2aWdhdGlvbiBwcm9kdWN0aW9uOiBge3thPy5iID8gYyA6IGR9fWAuIFRoaXMgdGVtcGxhdGUgcHJvZHVjZXNcbiAgICAvLyBhIHRlcm5hcnkgb2YgdGhlIGZvcm06XG4gICAgLy8gICBgYSA9PSBudWxsID8gbnVsbCA6IHJlc3Qgb2YgZXhwcmVzc2lvbmBcbiAgICAvLyBJZiB0aGUgcmVzdCBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhbHNvIGEgdGVybmFyeSB0aG91Z2gsIHRoaXMgd291bGQgcHJvZHVjZSB0aGUgZm9ybTpcbiAgICAvLyAgIGBhID09IG51bGwgPyBudWxsIDogYS5iID8gYyA6IGRgXG4gICAgLy8gd2hpY2gsIGlmIGxlZnQgYXMgcmlnaHQtYXNzb2NpYXRpdmUsIHdvdWxkIGJlIGluY29ycmVjdGx5IGFzc29jaWF0ZWQgYXM6XG4gICAgLy8gICBgYSA9PSBudWxsID8gbnVsbCA6IChhLmIgPyBjIDogZClgXG4gICAgLy9cbiAgICAvLyBJbiBzdWNoIGNhc2VzLCB0aGUgbGVmdC1hc3NvY2lhdGl2aXR5IG5lZWRzIHRvIGJlIGVuZm9yY2VkIHdpdGggcGFyZW50aGVzZXM6XG4gICAgLy8gICBgKGEgPT0gbnVsbCA/IG51bGwgOiBhLmIpID8gYyA6IGRgXG4gICAgLy9cbiAgICAvLyBTdWNoIHBhcmVudGhlc2VzIGNvdWxkIGFsd2F5cyBiZSBpbmNsdWRlZCBpbiB0aGUgY29uZGl0aW9uIChndWFyYW50ZWVpbmcgY29ycmVjdCBiZWhhdmlvcikgaW5cbiAgICAvLyBhbGwgY2FzZXMsIGJ1dCB0aGlzIGhhcyBhIGNvZGUgc2l6ZSBjb3N0LiBJbnN0ZWFkLCBwYXJlbnRoZXNlcyBhcmUgYWRkZWQgb25seSB3aGVuIGFcbiAgICAvLyBjb25kaXRpb25hbCBleHByZXNzaW9uIGlzIGRpcmVjdGx5IHVzZWQgYXMgdGhlIGNvbmRpdGlvbiBvZiBhbm90aGVyLlxuICAgIC8vXG4gICAgLy8gVE9ETyhhbHhodWIpOiBpbnZlc3RpZ2F0ZSBiZXR0ZXIgbG9naWMgZm9yIHByZWNlbmRlbmNlIG9mIGNvbmRpdGlvbmFsIG9wZXJhdG9yc1xuICAgIGlmIChhc3QuY29uZGl0aW9uIGluc3RhbmNlb2Ygby5Db25kaXRpb25hbEV4cHIpIHtcbiAgICAgIC8vIFRoZSBjb25kaXRpb24gb2YgdGhpcyB0ZXJuYXJ5IG5lZWRzIHRvIGJlIHdyYXBwZWQgaW4gcGFyZW50aGVzZXMgdG8gbWFpbnRhaW5cbiAgICAgIC8vIGxlZnQtYXNzb2NpYXRpdml0eS5cbiAgICAgIGNvbmQgPSB0aGlzLmZhY3RvcnkuY3JlYXRlUGFyZW50aGVzaXplZEV4cHJlc3Npb24oY29uZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yeS5jcmVhdGVDb25kaXRpb25hbChcbiAgICAgICAgY29uZCwgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSxcbiAgICAgICAgYXN0LmZhbHNlQ2FzZSEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0Tm90RXhwcihhc3Q6IG8uTm90RXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5mYWN0b3J5LmNyZWF0ZVVuYXJ5RXhwcmVzc2lvbignIScsIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0QXNzZXJ0Tm90TnVsbEV4cHIoYXN0OiBvLkFzc2VydE5vdE51bGwsIGNvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRDYXN0RXhwcihhc3Q6IG8uQ2FzdEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IG8uRnVuY3Rpb25FeHByLCBjb250ZXh0OiBDb250ZXh0KTogVEV4cHJlc3Npb24ge1xuICAgIHJldHVybiB0aGlzLmZhY3RvcnkuY3JlYXRlRnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICBhc3QubmFtZSA/PyBudWxsLCBhc3QucGFyYW1zLm1hcChwYXJhbSA9PiBwYXJhbS5uYW1lKSxcbiAgICAgICAgdGhpcy5mYWN0b3J5LmNyZWF0ZUJsb2NrKHRoaXMudmlzaXRTdGF0ZW1lbnRzKGFzdC5zdGF0ZW1lbnRzLCBjb250ZXh0KSkpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBvLkJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICBpZiAoIUJJTkFSWV9PUEVSQVRPUlMuaGFzKGFzdC5vcGVyYXRvcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBiaW5hcnkgb3BlcmF0b3I6ICR7by5CaW5hcnlPcGVyYXRvclthc3Qub3BlcmF0b3JdfWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5mYWN0b3J5LmNyZWF0ZUJpbmFyeUV4cHJlc3Npb24oXG4gICAgICAgIGFzdC5saHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICBCSU5BUllfT1BFUkFUT1JTLmdldChhc3Qub3BlcmF0b3IpISxcbiAgICAgICAgYXN0LnJocy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksXG4gICAgKTtcbiAgfVxuXG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogby5SZWFkUHJvcEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiBURXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yeS5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyhhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QubmFtZSk7XG4gIH1cblxuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogby5SZWFkS2V5RXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5mYWN0b3J5LmNyZWF0ZUVsZW1lbnRBY2Nlc3MoXG4gICAgICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogby5MaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBDb250ZXh0KTogVEV4cHJlc3Npb24ge1xuICAgIHJldHVybiB0aGlzLmZhY3RvcnkuY3JlYXRlQXJyYXlMaXRlcmFsKGFzdC5lbnRyaWVzLm1hcChcbiAgICAgICAgZXhwciA9PiB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3Quc291cmNlU3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBvLkxpdGVyYWxNYXBFeHByLCBjb250ZXh0OiBDb250ZXh0KTogVEV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHByb3BlcnRpZXM6IE9iamVjdExpdGVyYWxQcm9wZXJ0eTxURXhwcmVzc2lvbj5bXSA9IGFzdC5lbnRyaWVzLm1hcChlbnRyeSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwcm9wZXJ0eU5hbWU6IGVudHJ5LmtleSxcbiAgICAgICAgcXVvdGVkOiBlbnRyeS5xdW90ZWQsXG4gICAgICAgIHZhbHVlOiBlbnRyeS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dClcbiAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuc2V0U291cmNlTWFwUmFuZ2UodGhpcy5mYWN0b3J5LmNyZWF0ZU9iamVjdExpdGVyYWwocHJvcGVydGllcyksIGFzdC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWFFeHByKGFzdDogby5Db21tYUV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBfY29udGV4dDogQ29udGV4dCk6IGFueSB7XG4gICAgdGhpcy5yZWNvcmRXcmFwcGVkTm9kZShhc3QpO1xuICAgIHJldHVybiBhc3Qubm9kZTtcbiAgfVxuXG4gIHZpc2l0VHlwZW9mRXhwcihhc3Q6IG8uVHlwZW9mRXhwciwgY29udGV4dDogQ29udGV4dCk6IFRFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5mYWN0b3J5LmNyZWF0ZVR5cGVPZkV4cHJlc3Npb24oYXN0LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0VW5hcnlPcGVyYXRvckV4cHIoYXN0OiBvLlVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBDb250ZXh0KTogVEV4cHJlc3Npb24ge1xuICAgIGlmICghVU5BUllfT1BFUkFUT1JTLmhhcyhhc3Qub3BlcmF0b3IpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdW5hcnkgb3BlcmF0b3I6ICR7by5VbmFyeU9wZXJhdG9yW2FzdC5vcGVyYXRvcl19YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZhY3RvcnkuY3JlYXRlVW5hcnlFeHByZXNzaW9uKFxuICAgICAgICBVTkFSWV9PUEVSQVRPUlMuZ2V0KGFzdC5vcGVyYXRvcikhLCBhc3QuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdFN0YXRlbWVudHMoc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgY29udGV4dDogQ29udGV4dCk6IFRTdGF0ZW1lbnRbXSB7XG4gICAgcmV0dXJuIHN0YXRlbWVudHMubWFwKHN0bXQgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjb250ZXh0KSlcbiAgICAgICAgLmZpbHRlcihzdG10ID0+IHN0bXQgIT09IHVuZGVmaW5lZCk7XG4gIH1cblxuICBwcml2YXRlIHNldFNvdXJjZU1hcFJhbmdlPFQgZXh0ZW5kcyBURXhwcmVzc2lvbnxUU3RhdGVtZW50Pihhc3Q6IFQsIHNwYW46IG8uUGFyc2VTb3VyY2VTcGFufG51bGwpOlxuICAgICAgVCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yeS5zZXRTb3VyY2VNYXBSYW5nZShhc3QsIGNyZWF0ZVJhbmdlKHNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoQ29tbWVudHMoc3RhdGVtZW50OiBUU3RhdGVtZW50LCBsZWFkaW5nQ29tbWVudHM6IG8uTGVhZGluZ0NvbW1lbnRbXXx1bmRlZmluZWQpOlxuICAgICAgVFN0YXRlbWVudCB7XG4gICAgaWYgKGxlYWRpbmdDb21tZW50cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZhY3RvcnkuYXR0YWNoQ29tbWVudHMoc3RhdGVtZW50LCBsZWFkaW5nQ29tbWVudHMpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGVtZW50O1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydCBhIGNvb2tlZC1yYXcgc3RyaW5nIG9iamVjdCBpbnRvIG9uZSB0aGF0IGNhbiBiZSB1c2VkIGJ5IHRoZSBBU1QgZmFjdG9yaWVzLlxuICovXG5mdW5jdGlvbiBjcmVhdGVUZW1wbGF0ZUVsZW1lbnQoXG4gICAge2Nvb2tlZCwgcmF3LCByYW5nZX06IHtjb29rZWQ6IHN0cmluZywgcmF3OiBzdHJpbmcsIHJhbmdlOiBvLlBhcnNlU291cmNlU3BhbnxudWxsfSk6XG4gICAgVGVtcGxhdGVFbGVtZW50IHtcbiAgcmV0dXJuIHtjb29rZWQsIHJhdywgcmFuZ2U6IGNyZWF0ZVJhbmdlKHJhbmdlKX07XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBPdXRwdXRBU1Qgc291cmNlLXNwYW4gaW50byBhIHJhbmdlIHRoYXQgY2FuIGJlIHVzZWQgYnkgdGhlIEFTVCBmYWN0b3JpZXMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVJhbmdlKHNwYW46IG8uUGFyc2VTb3VyY2VTcGFufG51bGwpOiBTb3VyY2VNYXBSYW5nZXxudWxsIHtcbiAgaWYgKHNwYW4gPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCB7c3RhcnQsIGVuZH0gPSBzcGFuO1xuICBjb25zdCB7dXJsLCBjb250ZW50fSA9IHN0YXJ0LmZpbGU7XG4gIGlmICghdXJsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB1cmwsXG4gICAgY29udGVudCxcbiAgICBzdGFydDoge29mZnNldDogc3RhcnQub2Zmc2V0LCBsaW5lOiBzdGFydC5saW5lLCBjb2x1bW46IHN0YXJ0LmNvbH0sXG4gICAgZW5kOiB7b2Zmc2V0OiBlbmQub2Zmc2V0LCBsaW5lOiBlbmQubGluZSwgY29sdW1uOiBlbmQuY29sfSxcbiAgfTtcbn1cbiJdfQ==