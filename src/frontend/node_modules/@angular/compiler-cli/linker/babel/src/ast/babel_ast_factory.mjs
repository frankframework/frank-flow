/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as t from '@babel/types';
import { assert } from '../../../../linker';
/**
 * A Babel flavored implementation of the AstFactory.
 */
export class BabelAstFactory {
    constructor(
    /** The absolute path to the source file being compiled. */
    sourceUrl) {
        this.sourceUrl = sourceUrl;
        this.createArrayLiteral = t.arrayExpression;
        this.createBlock = t.blockStatement;
        this.createConditional = t.conditionalExpression;
        this.createExpressionStatement = t.expressionStatement;
        this.createIdentifier = t.identifier;
        this.createIfStatement = t.ifStatement;
        this.createNewExpression = t.newExpression;
        this.createParenthesizedExpression = t.parenthesizedExpression;
        this.createReturnStatement = t.returnStatement;
        this.createThrowStatement = t.throwStatement;
        this.createUnaryExpression = t.unaryExpression;
    }
    attachComments(statement, leadingComments) {
        // We must process the comments in reverse because `t.addComment()` will add new ones in front.
        for (let i = leadingComments.length - 1; i >= 0; i--) {
            const comment = leadingComments[i];
            t.addComment(statement, 'leading', comment.toString(), !comment.multiline);
        }
    }
    createAssignment(target, value) {
        assert(target, isLExpression, 'must be a left hand side expression');
        return t.assignmentExpression('=', target, value);
    }
    createBinaryExpression(leftOperand, operator, rightOperand) {
        switch (operator) {
            case '&&':
            case '||':
            case '??':
                return t.logicalExpression(operator, leftOperand, rightOperand);
            default:
                return t.binaryExpression(operator, leftOperand, rightOperand);
        }
    }
    createCallExpression(callee, args, pure) {
        const call = t.callExpression(callee, args);
        if (pure) {
            t.addComment(call, 'leading', ' @__PURE__ ', /* line */ false);
        }
        return call;
    }
    createElementAccess(expression, element) {
        return t.memberExpression(expression, element, /* computed */ true);
    }
    createFunctionDeclaration(functionName, parameters, body) {
        assert(body, t.isBlockStatement, 'a block');
        return t.functionDeclaration(t.identifier(functionName), parameters.map(param => t.identifier(param)), body);
    }
    createFunctionExpression(functionName, parameters, body) {
        assert(body, t.isBlockStatement, 'a block');
        const name = functionName !== null ? t.identifier(functionName) : null;
        return t.functionExpression(name, parameters.map(param => t.identifier(param)), body);
    }
    createLiteral(value) {
        if (typeof value === 'string') {
            return t.stringLiteral(value);
        }
        else if (typeof value === 'number') {
            return t.numericLiteral(value);
        }
        else if (typeof value === 'boolean') {
            return t.booleanLiteral(value);
        }
        else if (value === undefined) {
            return t.identifier('undefined');
        }
        else if (value === null) {
            return t.nullLiteral();
        }
        else {
            throw new Error(`Invalid literal: ${value} (${typeof value})`);
        }
    }
    createObjectLiteral(properties) {
        return t.objectExpression(properties.map(prop => {
            const key = prop.quoted ? t.stringLiteral(prop.propertyName) : t.identifier(prop.propertyName);
            return t.objectProperty(key, prop.value);
        }));
    }
    createPropertyAccess(expression, propertyName) {
        return t.memberExpression(expression, t.identifier(propertyName), /* computed */ false);
    }
    createTaggedTemplate(tag, template) {
        const elements = template.elements.map((element, i) => this.setSourceMapRange(t.templateElement(element, i === template.elements.length - 1), element.range));
        return t.taggedTemplateExpression(tag, t.templateLiteral(elements, template.expressions));
    }
    createTypeOfExpression(expression) {
        return t.unaryExpression('typeof', expression);
    }
    createVariableDeclaration(variableName, initializer, type) {
        return t.variableDeclaration(type, [t.variableDeclarator(t.identifier(variableName), initializer)]);
    }
    setSourceMapRange(node, sourceMapRange) {
        if (sourceMapRange === null) {
            return node;
        }
        node.loc = {
            // Add in the filename so that we can map to external template files.
            // Note that Babel gets confused if you specify a filename when it is the original source
            // file. This happens when the template is inline, in which case just use `undefined`.
            filename: sourceMapRange.url !== this.sourceUrl ? sourceMapRange.url : undefined,
            start: {
                line: sourceMapRange.start.line + 1,
                column: sourceMapRange.start.column,
            },
            end: {
                line: sourceMapRange.end.line + 1,
                column: sourceMapRange.end.column,
            },
        }; // Needed because the Babel typings for `loc` don't include `filename`.
        node.start = sourceMapRange.start.offset;
        node.end = sourceMapRange.end.offset;
        return node;
    }
}
function isLExpression(expr) {
    // Some LVal types are not expressions, which prevents us from using `t.isLVal()`
    // directly with `assert()`.
    return t.isLVal(expr);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFiZWxfYXN0X2ZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsL3NyYy9hc3QvYmFiZWxfYXN0X2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSxjQUFjLENBQUM7QUFFbEMsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBRzFDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGVBQWU7SUFDMUI7SUFDSSwyREFBMkQ7SUFDbkQsU0FBaUI7UUFBakIsY0FBUyxHQUFULFNBQVMsQ0FBUTtRQVU3Qix1QkFBa0IsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO1FBb0J2QyxnQkFBVyxHQUFHLENBQUMsQ0FBQyxjQUFjLENBQUM7UUFVL0Isc0JBQWlCLEdBQUcsQ0FBQyxDQUFDLHFCQUFxQixDQUFDO1FBTTVDLDhCQUF5QixHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztRQWdCbEQscUJBQWdCLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQztRQUVoQyxzQkFBaUIsR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDO1FBa0JsQyx3QkFBbUIsR0FBRyxDQUFDLENBQUMsYUFBYSxDQUFDO1FBVXRDLGtDQUE2QixHQUFHLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQztRQU0xRCwwQkFBcUIsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO1FBUzFDLHlCQUFvQixHQUFHLENBQUMsQ0FBQyxjQUFjLENBQUM7UUFNeEMsMEJBQXFCLEdBQUcsQ0FBQyxDQUFDLGVBQWUsQ0FBQztJQWpIVixDQUFDO0lBRWpDLGNBQWMsQ0FBQyxTQUFzQixFQUFFLGVBQWlDO1FBQ3RFLCtGQUErRjtRQUMvRixLQUFLLElBQUksQ0FBQyxHQUFHLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDcEQsTUFBTSxPQUFPLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDNUU7SUFDSCxDQUFDO0lBSUQsZ0JBQWdCLENBQUMsTUFBb0IsRUFBRSxLQUFtQjtRQUN4RCxNQUFNLENBQUMsTUFBTSxFQUFFLGFBQWEsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO1FBQ3JFLE9BQU8sQ0FBQyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELHNCQUFzQixDQUNsQixXQUF5QixFQUFFLFFBQXdCLEVBQ25ELFlBQTBCO1FBQzVCLFFBQVEsUUFBUSxFQUFFO1lBQ2hCLEtBQUssSUFBSSxDQUFDO1lBQ1YsS0FBSyxJQUFJLENBQUM7WUFDVixLQUFLLElBQUk7Z0JBQ1AsT0FBTyxDQUFDLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNsRTtnQkFDRSxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO1NBQ2xFO0lBQ0gsQ0FBQztJQUlELG9CQUFvQixDQUFDLE1BQW9CLEVBQUUsSUFBb0IsRUFBRSxJQUFhO1FBQzVFLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVDLElBQUksSUFBSSxFQUFFO1lBQ1IsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDaEU7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFJRCxtQkFBbUIsQ0FBQyxVQUF3QixFQUFFLE9BQXFCO1FBQ2pFLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxPQUFPLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFJRCx5QkFBeUIsQ0FBQyxZQUFvQixFQUFFLFVBQW9CLEVBQUUsSUFBaUI7UUFFckYsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDNUMsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQ3hCLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN0RixDQUFDO0lBRUQsd0JBQXdCLENBQUMsWUFBeUIsRUFBRSxVQUFvQixFQUFFLElBQWlCO1FBRXpGLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sSUFBSSxHQUFHLFlBQVksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUN2RSxPQUFPLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBTUQsYUFBYSxDQUFDLEtBQTJDO1FBQ3ZELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO1lBQzdCLE9BQU8sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMvQjthQUFNLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO1lBQ3BDLE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNoQzthQUFNLElBQUksT0FBTyxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3JDLE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNoQzthQUFNLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUM5QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDbEM7YUFBTSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFDekIsT0FBTyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7U0FDeEI7YUFBTTtZQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLEtBQUssS0FBSyxPQUFPLEtBQUssR0FBRyxDQUFDLENBQUM7U0FDaEU7SUFDSCxDQUFDO0lBSUQsbUJBQW1CLENBQUMsVUFBaUQ7UUFDbkUsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM5QyxNQUFNLEdBQUcsR0FDTCxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdkYsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNOLENBQUM7SUFJRCxvQkFBb0IsQ0FBQyxVQUF3QixFQUFFLFlBQW9CO1FBQ2pFLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBSUQsb0JBQW9CLENBQUMsR0FBaUIsRUFBRSxRQUF1QztRQUM3RSxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FDbEMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQ2xDLENBQUMsQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN4RixPQUFPLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUlELHNCQUFzQixDQUFDLFVBQXdCO1FBQzdDLE9BQU8sQ0FBQyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUlELHlCQUF5QixDQUNyQixZQUFvQixFQUFFLFdBQThCLEVBQ3BELElBQTZCO1FBQy9CLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUN4QixJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUVELGlCQUFpQixDQUNiLElBQU8sRUFBRSxjQUFtQztRQUM5QyxJQUFJLGNBQWMsS0FBSyxJQUFJLEVBQUU7WUFDM0IsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELElBQUksQ0FBQyxHQUFHLEdBQUc7WUFDVCxxRUFBcUU7WUFDckUseUZBQXlGO1lBQ3pGLHNGQUFzRjtZQUN0RixRQUFRLEVBQUUsY0FBYyxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQ2hGLEtBQUssRUFBRTtnQkFDTCxJQUFJLEVBQUUsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQztnQkFDbkMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxLQUFLLENBQUMsTUFBTTthQUNwQztZQUNELEdBQUcsRUFBRTtnQkFDSCxJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQztnQkFDakMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTTthQUNsQztTQUNLLENBQUMsQ0FBRSx1RUFBdUU7UUFDbEYsSUFBSSxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUN6QyxJQUFJLENBQUMsR0FBRyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO1FBRXJDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGO0FBRUQsU0FBUyxhQUFhLENBQUMsSUFBa0I7SUFDdkMsaUZBQWlGO0lBQ2pGLDRCQUE0QjtJQUM1QixPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgdCBmcm9tICdAYmFiZWwvdHlwZXMnO1xuXG5pbXBvcnQge2Fzc2VydH0gZnJvbSAnLi4vLi4vLi4vLi4vbGlua2VyJztcbmltcG9ydCB7QXN0RmFjdG9yeSwgQmluYXJ5T3BlcmF0b3IsIExlYWRpbmdDb21tZW50LCBPYmplY3RMaXRlcmFsUHJvcGVydHksIFNvdXJjZU1hcFJhbmdlLCBUZW1wbGF0ZUxpdGVyYWwsIFZhcmlhYmxlRGVjbGFyYXRpb25UeXBlfSBmcm9tICcuLi8uLi8uLi8uLi9zcmMvbmd0c2MvdHJhbnNsYXRvcic7XG5cbi8qKlxuICogQSBCYWJlbCBmbGF2b3JlZCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgQXN0RmFjdG9yeS5cbiAqL1xuZXhwb3J0IGNsYXNzIEJhYmVsQXN0RmFjdG9yeSBpbXBsZW1lbnRzIEFzdEZhY3Rvcnk8dC5TdGF0ZW1lbnQsIHQuRXhwcmVzc2lvbj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIC8qKiBUaGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgc291cmNlIGZpbGUgYmVpbmcgY29tcGlsZWQuICovXG4gICAgICBwcml2YXRlIHNvdXJjZVVybDogc3RyaW5nKSB7fVxuXG4gIGF0dGFjaENvbW1lbnRzKHN0YXRlbWVudDogdC5TdGF0ZW1lbnQsIGxlYWRpbmdDb21tZW50czogTGVhZGluZ0NvbW1lbnRbXSk6IHZvaWQge1xuICAgIC8vIFdlIG11c3QgcHJvY2VzcyB0aGUgY29tbWVudHMgaW4gcmV2ZXJzZSBiZWNhdXNlIGB0LmFkZENvbW1lbnQoKWAgd2lsbCBhZGQgbmV3IG9uZXMgaW4gZnJvbnQuXG4gICAgZm9yIChsZXQgaSA9IGxlYWRpbmdDb21tZW50cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgY29tbWVudCA9IGxlYWRpbmdDb21tZW50c1tpXTtcbiAgICAgIHQuYWRkQ29tbWVudChzdGF0ZW1lbnQsICdsZWFkaW5nJywgY29tbWVudC50b1N0cmluZygpLCAhY29tbWVudC5tdWx0aWxpbmUpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUFycmF5TGl0ZXJhbCA9IHQuYXJyYXlFeHByZXNzaW9uO1xuXG4gIGNyZWF0ZUFzc2lnbm1lbnQodGFyZ2V0OiB0LkV4cHJlc3Npb24sIHZhbHVlOiB0LkV4cHJlc3Npb24pOiB0LkV4cHJlc3Npb24ge1xuICAgIGFzc2VydCh0YXJnZXQsIGlzTEV4cHJlc3Npb24sICdtdXN0IGJlIGEgbGVmdCBoYW5kIHNpZGUgZXhwcmVzc2lvbicpO1xuICAgIHJldHVybiB0LmFzc2lnbm1lbnRFeHByZXNzaW9uKCc9JywgdGFyZ2V0LCB2YWx1ZSk7XG4gIH1cblxuICBjcmVhdGVCaW5hcnlFeHByZXNzaW9uKFxuICAgICAgbGVmdE9wZXJhbmQ6IHQuRXhwcmVzc2lvbiwgb3BlcmF0b3I6IEJpbmFyeU9wZXJhdG9yLFxuICAgICAgcmlnaHRPcGVyYW5kOiB0LkV4cHJlc3Npb24pOiB0LkV4cHJlc3Npb24ge1xuICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgIGNhc2UgJyYmJzpcbiAgICAgIGNhc2UgJ3x8JzpcbiAgICAgIGNhc2UgJz8/JzpcbiAgICAgICAgcmV0dXJuIHQubG9naWNhbEV4cHJlc3Npb24ob3BlcmF0b3IsIGxlZnRPcGVyYW5kLCByaWdodE9wZXJhbmQpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHQuYmluYXJ5RXhwcmVzc2lvbihvcGVyYXRvciwgbGVmdE9wZXJhbmQsIHJpZ2h0T3BlcmFuZCk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlQmxvY2sgPSB0LmJsb2NrU3RhdGVtZW50O1xuXG4gIGNyZWF0ZUNhbGxFeHByZXNzaW9uKGNhbGxlZTogdC5FeHByZXNzaW9uLCBhcmdzOiB0LkV4cHJlc3Npb25bXSwgcHVyZTogYm9vbGVhbik6IHQuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY2FsbCA9IHQuY2FsbEV4cHJlc3Npb24oY2FsbGVlLCBhcmdzKTtcbiAgICBpZiAocHVyZSkge1xuICAgICAgdC5hZGRDb21tZW50KGNhbGwsICdsZWFkaW5nJywgJyBAX19QVVJFX18gJywgLyogbGluZSAqLyBmYWxzZSk7XG4gICAgfVxuICAgIHJldHVybiBjYWxsO1xuICB9XG5cbiAgY3JlYXRlQ29uZGl0aW9uYWwgPSB0LmNvbmRpdGlvbmFsRXhwcmVzc2lvbjtcblxuICBjcmVhdGVFbGVtZW50QWNjZXNzKGV4cHJlc3Npb246IHQuRXhwcmVzc2lvbiwgZWxlbWVudDogdC5FeHByZXNzaW9uKTogdC5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdC5tZW1iZXJFeHByZXNzaW9uKGV4cHJlc3Npb24sIGVsZW1lbnQsIC8qIGNvbXB1dGVkICovIHRydWUpO1xuICB9XG5cbiAgY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudCA9IHQuZXhwcmVzc2lvblN0YXRlbWVudDtcblxuICBjcmVhdGVGdW5jdGlvbkRlY2xhcmF0aW9uKGZ1bmN0aW9uTmFtZTogc3RyaW5nLCBwYXJhbWV0ZXJzOiBzdHJpbmdbXSwgYm9keTogdC5TdGF0ZW1lbnQpOlxuICAgICAgdC5TdGF0ZW1lbnQge1xuICAgIGFzc2VydChib2R5LCB0LmlzQmxvY2tTdGF0ZW1lbnQsICdhIGJsb2NrJyk7XG4gICAgcmV0dXJuIHQuZnVuY3Rpb25EZWNsYXJhdGlvbihcbiAgICAgICAgdC5pZGVudGlmaWVyKGZ1bmN0aW9uTmFtZSksIHBhcmFtZXRlcnMubWFwKHBhcmFtID0+IHQuaWRlbnRpZmllcihwYXJhbSkpLCBib2R5KTtcbiAgfVxuXG4gIGNyZWF0ZUZ1bmN0aW9uRXhwcmVzc2lvbihmdW5jdGlvbk5hbWU6IHN0cmluZ3xudWxsLCBwYXJhbWV0ZXJzOiBzdHJpbmdbXSwgYm9keTogdC5TdGF0ZW1lbnQpOlxuICAgICAgdC5FeHByZXNzaW9uIHtcbiAgICBhc3NlcnQoYm9keSwgdC5pc0Jsb2NrU3RhdGVtZW50LCAnYSBibG9jaycpO1xuICAgIGNvbnN0IG5hbWUgPSBmdW5jdGlvbk5hbWUgIT09IG51bGwgPyB0LmlkZW50aWZpZXIoZnVuY3Rpb25OYW1lKSA6IG51bGw7XG4gICAgcmV0dXJuIHQuZnVuY3Rpb25FeHByZXNzaW9uKG5hbWUsIHBhcmFtZXRlcnMubWFwKHBhcmFtID0+IHQuaWRlbnRpZmllcihwYXJhbSkpLCBib2R5KTtcbiAgfVxuXG4gIGNyZWF0ZUlkZW50aWZpZXIgPSB0LmlkZW50aWZpZXI7XG5cbiAgY3JlYXRlSWZTdGF0ZW1lbnQgPSB0LmlmU3RhdGVtZW50O1xuXG4gIGNyZWF0ZUxpdGVyYWwodmFsdWU6IHN0cmluZ3xudW1iZXJ8Ym9vbGVhbnxudWxsfHVuZGVmaW5lZCk6IHQuRXhwcmVzc2lvbiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB0LnN0cmluZ0xpdGVyYWwodmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIHQubnVtZXJpY0xpdGVyYWwodmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgIHJldHVybiB0LmJvb2xlYW5MaXRlcmFsKHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0LmlkZW50aWZpZXIoJ3VuZGVmaW5lZCcpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0Lm51bGxMaXRlcmFsKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsaXRlcmFsOiAke3ZhbHVlfSAoJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZU5ld0V4cHJlc3Npb24gPSB0Lm5ld0V4cHJlc3Npb247XG5cbiAgY3JlYXRlT2JqZWN0TGl0ZXJhbChwcm9wZXJ0aWVzOiBPYmplY3RMaXRlcmFsUHJvcGVydHk8dC5FeHByZXNzaW9uPltdKTogdC5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdC5vYmplY3RFeHByZXNzaW9uKHByb3BlcnRpZXMubWFwKHByb3AgPT4ge1xuICAgICAgY29uc3Qga2V5ID1cbiAgICAgICAgICBwcm9wLnF1b3RlZCA/IHQuc3RyaW5nTGl0ZXJhbChwcm9wLnByb3BlcnR5TmFtZSkgOiB0LmlkZW50aWZpZXIocHJvcC5wcm9wZXJ0eU5hbWUpO1xuICAgICAgcmV0dXJuIHQub2JqZWN0UHJvcGVydHkoa2V5LCBwcm9wLnZhbHVlKTtcbiAgICB9KSk7XG4gIH1cblxuICBjcmVhdGVQYXJlbnRoZXNpemVkRXhwcmVzc2lvbiA9IHQucGFyZW50aGVzaXplZEV4cHJlc3Npb247XG5cbiAgY3JlYXRlUHJvcGVydHlBY2Nlc3MoZXhwcmVzc2lvbjogdC5FeHByZXNzaW9uLCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IHQuRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHQubWVtYmVyRXhwcmVzc2lvbihleHByZXNzaW9uLCB0LmlkZW50aWZpZXIocHJvcGVydHlOYW1lKSwgLyogY29tcHV0ZWQgKi8gZmFsc2UpO1xuICB9XG5cbiAgY3JlYXRlUmV0dXJuU3RhdGVtZW50ID0gdC5yZXR1cm5TdGF0ZW1lbnQ7XG5cbiAgY3JlYXRlVGFnZ2VkVGVtcGxhdGUodGFnOiB0LkV4cHJlc3Npb24sIHRlbXBsYXRlOiBUZW1wbGF0ZUxpdGVyYWw8dC5FeHByZXNzaW9uPik6IHQuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZWxlbWVudHMgPSB0ZW1wbGF0ZS5lbGVtZW50cy5tYXAoXG4gICAgICAgIChlbGVtZW50LCBpKSA9PiB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKFxuICAgICAgICAgICAgdC50ZW1wbGF0ZUVsZW1lbnQoZWxlbWVudCwgaSA9PT0gdGVtcGxhdGUuZWxlbWVudHMubGVuZ3RoIC0gMSksIGVsZW1lbnQucmFuZ2UpKTtcbiAgICByZXR1cm4gdC50YWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24odGFnLCB0LnRlbXBsYXRlTGl0ZXJhbChlbGVtZW50cywgdGVtcGxhdGUuZXhwcmVzc2lvbnMpKTtcbiAgfVxuXG4gIGNyZWF0ZVRocm93U3RhdGVtZW50ID0gdC50aHJvd1N0YXRlbWVudDtcblxuICBjcmVhdGVUeXBlT2ZFeHByZXNzaW9uKGV4cHJlc3Npb246IHQuRXhwcmVzc2lvbik6IHQuRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHQudW5hcnlFeHByZXNzaW9uKCd0eXBlb2YnLCBleHByZXNzaW9uKTtcbiAgfVxuXG4gIGNyZWF0ZVVuYXJ5RXhwcmVzc2lvbiA9IHQudW5hcnlFeHByZXNzaW9uO1xuXG4gIGNyZWF0ZVZhcmlhYmxlRGVjbGFyYXRpb24oXG4gICAgICB2YXJpYWJsZU5hbWU6IHN0cmluZywgaW5pdGlhbGl6ZXI6IHQuRXhwcmVzc2lvbnxudWxsLFxuICAgICAgdHlwZTogVmFyaWFibGVEZWNsYXJhdGlvblR5cGUpOiB0LlN0YXRlbWVudCB7XG4gICAgcmV0dXJuIHQudmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgdHlwZSwgW3QudmFyaWFibGVEZWNsYXJhdG9yKHQuaWRlbnRpZmllcih2YXJpYWJsZU5hbWUpLCBpbml0aWFsaXplcildKTtcbiAgfVxuXG4gIHNldFNvdXJjZU1hcFJhbmdlPFQgZXh0ZW5kcyB0LlN0YXRlbWVudHx0LkV4cHJlc3Npb258dC5UZW1wbGF0ZUVsZW1lbnQ+KFxuICAgICAgbm9kZTogVCwgc291cmNlTWFwUmFuZ2U6IFNvdXJjZU1hcFJhbmdlfG51bGwpOiBUIHtcbiAgICBpZiAoc291cmNlTWFwUmFuZ2UgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH1cbiAgICBub2RlLmxvYyA9IHtcbiAgICAgIC8vIEFkZCBpbiB0aGUgZmlsZW5hbWUgc28gdGhhdCB3ZSBjYW4gbWFwIHRvIGV4dGVybmFsIHRlbXBsYXRlIGZpbGVzLlxuICAgICAgLy8gTm90ZSB0aGF0IEJhYmVsIGdldHMgY29uZnVzZWQgaWYgeW91IHNwZWNpZnkgYSBmaWxlbmFtZSB3aGVuIGl0IGlzIHRoZSBvcmlnaW5hbCBzb3VyY2VcbiAgICAgIC8vIGZpbGUuIFRoaXMgaGFwcGVucyB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBpbmxpbmUsIGluIHdoaWNoIGNhc2UganVzdCB1c2UgYHVuZGVmaW5lZGAuXG4gICAgICBmaWxlbmFtZTogc291cmNlTWFwUmFuZ2UudXJsICE9PSB0aGlzLnNvdXJjZVVybCA/IHNvdXJjZU1hcFJhbmdlLnVybCA6IHVuZGVmaW5lZCxcbiAgICAgIHN0YXJ0OiB7XG4gICAgICAgIGxpbmU6IHNvdXJjZU1hcFJhbmdlLnN0YXJ0LmxpbmUgKyAxLCAgLy8gbGluZXMgYXJlIDEtYmFzZWQgaW4gQmFiZWwuXG4gICAgICAgIGNvbHVtbjogc291cmNlTWFwUmFuZ2Uuc3RhcnQuY29sdW1uLFxuICAgICAgfSxcbiAgICAgIGVuZDoge1xuICAgICAgICBsaW5lOiBzb3VyY2VNYXBSYW5nZS5lbmQubGluZSArIDEsICAvLyBsaW5lcyBhcmUgMS1iYXNlZCBpbiBCYWJlbC5cbiAgICAgICAgY29sdW1uOiBzb3VyY2VNYXBSYW5nZS5lbmQuY29sdW1uLFxuICAgICAgfSxcbiAgICB9IGFzIGFueTsgIC8vIE5lZWRlZCBiZWNhdXNlIHRoZSBCYWJlbCB0eXBpbmdzIGZvciBgbG9jYCBkb24ndCBpbmNsdWRlIGBmaWxlbmFtZWAuXG4gICAgbm9kZS5zdGFydCA9IHNvdXJjZU1hcFJhbmdlLnN0YXJ0Lm9mZnNldDtcbiAgICBub2RlLmVuZCA9IHNvdXJjZU1hcFJhbmdlLmVuZC5vZmZzZXQ7XG5cbiAgICByZXR1cm4gbm9kZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0xFeHByZXNzaW9uKGV4cHI6IHQuRXhwcmVzc2lvbik6IGV4cHIgaXMgRXh0cmFjdDx0LkxWYWwsIHQuRXhwcmVzc2lvbj4ge1xuICAvLyBTb21lIExWYWwgdHlwZXMgYXJlIG5vdCBleHByZXNzaW9ucywgd2hpY2ggcHJldmVudHMgdXMgZnJvbSB1c2luZyBgdC5pc0xWYWwoKWBcbiAgLy8gZGlyZWN0bHkgd2l0aCBgYXNzZXJ0KClgLlxuICByZXR1cm4gdC5pc0xWYWwoZXhwcik7XG59XG4iXX0=