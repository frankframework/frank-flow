/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { FatalLinkerError } from '../../fatal_linker_error';
import { assert } from '../utils';
/**
 * This implementation of `AstHost` is able to get information from TypeScript AST nodes.
 *
 * This host is not actually used at runtime in the current code.
 *
 * It is implemented here to ensure that the `AstHost` abstraction is not unfairly skewed towards
 * the Babel implementation. It could also provide a basis for a 3rd TypeScript compiler plugin to
 * do linking in the future.
 */
export class TypeScriptAstHost {
    constructor() {
        this.isStringLiteral = ts.isStringLiteral;
        this.isNumericLiteral = ts.isNumericLiteral;
        this.isArrayLiteral = ts.isArrayLiteralExpression;
        this.isObjectLiteral = ts.isObjectLiteralExpression;
        this.isCallExpression = ts.isCallExpression;
    }
    getSymbolName(node) {
        if (ts.isIdentifier(node)) {
            return node.text;
        }
        else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
            return node.name.text;
        }
        else {
            return null;
        }
    }
    parseStringLiteral(str) {
        assert(str, this.isStringLiteral, 'a string literal');
        return str.text;
    }
    parseNumericLiteral(num) {
        assert(num, this.isNumericLiteral, 'a numeric literal');
        return parseInt(num.text);
    }
    isBooleanLiteral(node) {
        return isBooleanLiteral(node) || isMinifiedBooleanLiteral(node);
    }
    parseBooleanLiteral(bool) {
        if (isBooleanLiteral(bool)) {
            return bool.kind === ts.SyntaxKind.TrueKeyword;
        }
        else if (isMinifiedBooleanLiteral(bool)) {
            return !(+bool.operand.text);
        }
        else {
            throw new FatalLinkerError(bool, 'Unsupported syntax, expected a boolean literal.');
        }
    }
    parseArrayLiteral(array) {
        assert(array, this.isArrayLiteral, 'an array literal');
        return array.elements.map(element => {
            assert(element, isNotEmptyElement, 'element in array not to be empty');
            assert(element, isNotSpreadElement, 'element in array not to use spread syntax');
            return element;
        });
    }
    parseObjectLiteral(obj) {
        assert(obj, this.isObjectLiteral, 'an object literal');
        const result = new Map();
        for (const property of obj.properties) {
            assert(property, ts.isPropertyAssignment, 'a property assignment');
            assert(property.name, isPropertyName, 'a property name');
            result.set(property.name.text, property.initializer);
        }
        return result;
    }
    isFunctionExpression(node) {
        return ts.isFunctionExpression(node) || ts.isArrowFunction(node);
    }
    parseReturnValue(fn) {
        assert(fn, this.isFunctionExpression, 'a function');
        if (!ts.isBlock(fn.body)) {
            // it is a simple array function expression: `(...) => expr`
            return fn.body;
        }
        // it is a function (arrow or normal) with a body. E.g.:
        // * `(...) => { stmt; ... }`
        // * `function(...) { stmt; ... }`
        if (fn.body.statements.length !== 1) {
            throw new FatalLinkerError(fn.body, 'Unsupported syntax, expected a function body with a single return statement.');
        }
        const stmt = fn.body.statements[0];
        assert(stmt, ts.isReturnStatement, 'a function body with a single return statement');
        if (stmt.expression === undefined) {
            throw new FatalLinkerError(stmt, 'Unsupported syntax, expected function to return a value.');
        }
        return stmt.expression;
    }
    parseCallee(call) {
        assert(call, ts.isCallExpression, 'a call expression');
        return call.expression;
    }
    parseArguments(call) {
        assert(call, ts.isCallExpression, 'a call expression');
        return call.arguments.map(arg => {
            assert(arg, isNotSpreadElement, 'argument not to use spread syntax');
            return arg;
        });
    }
    getRange(node) {
        const file = node.getSourceFile();
        if (file === undefined) {
            throw new FatalLinkerError(node, 'Unable to read range for node - it is missing parent information.');
        }
        const startPos = node.getStart();
        const endPos = node.getEnd();
        const { line: startLine, character: startCol } = ts.getLineAndCharacterOfPosition(file, startPos);
        return { startLine, startCol, startPos, endPos };
    }
}
/**
 * Return true if the expression does not represent an empty element in an array literal.
 * For example in `[,foo]` the first element is "empty".
 */
function isNotEmptyElement(e) {
    return !ts.isOmittedExpression(e);
}
/**
 * Return true if the expression is not a spread element of an array literal.
 * For example in `[x, ...rest]` the `...rest` expression is a spread element.
 */
function isNotSpreadElement(e) {
    return !ts.isSpreadElement(e);
}
/**
 * Return true if the expression can be considered a text based property name.
 */
function isPropertyName(e) {
    return ts.isIdentifier(e) || ts.isStringLiteral(e) || ts.isNumericLiteral(e);
}
/**
 * Return true if the node is either `true` or `false` literals.
 */
function isBooleanLiteral(node) {
    return node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}
/**
 * Return true if the node is either `!0` or `!1`.
 */
function isMinifiedBooleanLiteral(node) {
    return ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken &&
        ts.isNumericLiteral(node.operand) && (node.operand.text === '0' || node.operand.text === '1');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdF9hc3RfaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9saW5rZXIvc3JjL2FzdC90eXBlc2NyaXB0L3R5cGVzY3JpcHRfYXN0X2hvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUdoQzs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sT0FBTyxpQkFBaUI7SUFBOUI7UUFXRSxvQkFBZSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUM7UUFPckMscUJBQWdCLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDO1FBcUJ2QyxtQkFBYyxHQUFHLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQztRQVc3QyxvQkFBZSxHQUFHLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQztRQTBDL0MscUJBQWdCLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDO0lBMEJ6QyxDQUFDO0lBckhDLGFBQWEsQ0FBQyxJQUFtQjtRQUMvQixJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQ2xCO2FBQU0sSUFBSSxFQUFFLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDNUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztTQUN2QjthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUM7SUFJRCxrQkFBa0IsQ0FBQyxHQUFrQjtRQUNuQyxN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QUMsZ0JBQWdCO1FBQ3ZGLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDcEcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtGYXRhbExpbmtlckVycm9yfSBmcm9tICcuLi8uLi9mYXRhbF9saW5rZXJfZXJyb3InO1xuaW1wb3J0IHtBc3RIb3N0LCBSYW5nZX0gZnJvbSAnLi4vYXN0X2hvc3QnO1xuaW1wb3J0IHthc3NlcnR9IGZyb20gJy4uL3V0aWxzJztcblxuXG4vKipcbiAqIFRoaXMgaW1wbGVtZW50YXRpb24gb2YgYEFzdEhvc3RgIGlzIGFibGUgdG8gZ2V0IGluZm9ybWF0aW9uIGZyb20gVHlwZVNjcmlwdCBBU1Qgbm9kZXMuXG4gKlxuICogVGhpcyBob3N0IGlzIG5vdCBhY3R1YWxseSB1c2VkIGF0IHJ1bnRpbWUgaW4gdGhlIGN1cnJlbnQgY29kZS5cbiAqXG4gKiBJdCBpcyBpbXBsZW1lbnRlZCBoZXJlIHRvIGVuc3VyZSB0aGF0IHRoZSBgQXN0SG9zdGAgYWJzdHJhY3Rpb24gaXMgbm90IHVuZmFpcmx5IHNrZXdlZCB0b3dhcmRzXG4gKiB0aGUgQmFiZWwgaW1wbGVtZW50YXRpb24uIEl0IGNvdWxkIGFsc28gcHJvdmlkZSBhIGJhc2lzIGZvciBhIDNyZCBUeXBlU2NyaXB0IGNvbXBpbGVyIHBsdWdpbiB0b1xuICogZG8gbGlua2luZyBpbiB0aGUgZnV0dXJlLlxuICovXG5leHBvcnQgY2xhc3MgVHlwZVNjcmlwdEFzdEhvc3QgaW1wbGVtZW50cyBBc3RIb3N0PHRzLkV4cHJlc3Npb24+IHtcbiAgZ2V0U3ltYm9sTmFtZShub2RlOiB0cy5FeHByZXNzaW9uKTogc3RyaW5nfG51bGwge1xuICAgIGlmICh0cy5pc0lkZW50aWZpZXIobm9kZSkpIHtcbiAgICAgIHJldHVybiBub2RlLnRleHQ7XG4gICAgfSBlbHNlIGlmICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihub2RlKSAmJiB0cy5pc0lkZW50aWZpZXIobm9kZS5uYW1lKSkge1xuICAgICAgcmV0dXJuIG5vZGUubmFtZS50ZXh0O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBpc1N0cmluZ0xpdGVyYWwgPSB0cy5pc1N0cmluZ0xpdGVyYWw7XG5cbiAgcGFyc2VTdHJpbmdMaXRlcmFsKHN0cjogdHMuRXhwcmVzc2lvbik6IHN0cmluZyB7XG4gICAgYXNzZXJ0KHN0ciwgdGhpcy5pc1N0cmluZ0xpdGVyYWwsICdhIHN0cmluZyBsaXRlcmFsJyk7XG4gICAgcmV0dXJuIHN0ci50ZXh0O1xuICB9XG5cbiAgaXNOdW1lcmljTGl0ZXJhbCA9IHRzLmlzTnVtZXJpY0xpdGVyYWw7XG5cbiAgcGFyc2VOdW1lcmljTGl0ZXJhbChudW06IHRzLkV4cHJlc3Npb24pOiBudW1iZXIge1xuICAgIGFzc2VydChudW0sIHRoaXMuaXNOdW1lcmljTGl0ZXJhbCwgJ2EgbnVtZXJpYyBsaXRlcmFsJyk7XG4gICAgcmV0dXJuIHBhcnNlSW50KG51bS50ZXh0KTtcbiAgfVxuXG4gIGlzQm9vbGVhbkxpdGVyYWwobm9kZTogdHMuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBpc0Jvb2xlYW5MaXRlcmFsKG5vZGUpIHx8IGlzTWluaWZpZWRCb29sZWFuTGl0ZXJhbChub2RlKTtcbiAgfVxuXG4gIHBhcnNlQm9vbGVhbkxpdGVyYWwoYm9vbDogdHMuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmIChpc0Jvb2xlYW5MaXRlcmFsKGJvb2wpKSB7XG4gICAgICByZXR1cm4gYm9vbC5raW5kID09PSB0cy5TeW50YXhLaW5kLlRydWVLZXl3b3JkO1xuICAgIH0gZWxzZSBpZiAoaXNNaW5pZmllZEJvb2xlYW5MaXRlcmFsKGJvb2wpKSB7XG4gICAgICByZXR1cm4gISgrYm9vbC5vcGVyYW5kLnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxMaW5rZXJFcnJvcihib29sLCAnVW5zdXBwb3J0ZWQgc3ludGF4LCBleHBlY3RlZCBhIGJvb2xlYW4gbGl0ZXJhbC4nKTtcbiAgICB9XG4gIH1cblxuICBpc0FycmF5TGl0ZXJhbCA9IHRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbjtcblxuICBwYXJzZUFycmF5TGl0ZXJhbChhcnJheTogdHMuRXhwcmVzc2lvbik6IHRzLkV4cHJlc3Npb25bXSB7XG4gICAgYXNzZXJ0KGFycmF5LCB0aGlzLmlzQXJyYXlMaXRlcmFsLCAnYW4gYXJyYXkgbGl0ZXJhbCcpO1xuICAgIHJldHVybiBhcnJheS5lbGVtZW50cy5tYXAoZWxlbWVudCA9PiB7XG4gICAgICBhc3NlcnQoZWxlbWVudCwgaXNOb3RFbXB0eUVsZW1lbnQsICdlbGVtZW50IGluIGFycmF5IG5vdCB0byBiZSBlbXB0eScpO1xuICAgICAgYXNzZXJ0KGVsZW1lbnQsIGlzTm90U3ByZWFkRWxlbWVudCwgJ2VsZW1lbnQgaW4gYXJyYXkgbm90IHRvIHVzZSBzcHJlYWQgc3ludGF4Jyk7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9KTtcbiAgfVxuXG4gIGlzT2JqZWN0TGl0ZXJhbCA9IHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb247XG5cbiAgcGFyc2VPYmplY3RMaXRlcmFsKG9iajogdHMuRXhwcmVzc2lvbik6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+IHtcbiAgICBhc3NlcnQob2JqLCB0aGlzLmlzT2JqZWN0TGl0ZXJhbCwgJ2FuIG9iamVjdCBsaXRlcmFsJyk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj4oKTtcbiAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIG9iai5wcm9wZXJ0aWVzKSB7XG4gICAgICBhc3NlcnQocHJvcGVydHksIHRzLmlzUHJvcGVydHlBc3NpZ25tZW50LCAnYSBwcm9wZXJ0eSBhc3NpZ25tZW50Jyk7XG4gICAgICBhc3NlcnQocHJvcGVydHkubmFtZSwgaXNQcm9wZXJ0eU5hbWUsICdhIHByb3BlcnR5IG5hbWUnKTtcbiAgICAgIHJlc3VsdC5zZXQocHJvcGVydHkubmFtZS50ZXh0LCBwcm9wZXJ0eS5pbml0aWFsaXplcik7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBpc0Z1bmN0aW9uRXhwcmVzc2lvbihub2RlOiB0cy5FeHByZXNzaW9uKTogbm9kZSBpcyB0cy5GdW5jdGlvbkV4cHJlc3Npb258dHMuQXJyb3dGdW5jdGlvbiB7XG4gICAgcmV0dXJuIHRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKG5vZGUpIHx8IHRzLmlzQXJyb3dGdW5jdGlvbihub2RlKTtcbiAgfVxuXG4gIHBhcnNlUmV0dXJuVmFsdWUoZm46IHRzLkV4cHJlc3Npb24pOiB0cy5FeHByZXNzaW9uIHtcbiAgICBhc3NlcnQoZm4sIHRoaXMuaXNGdW5jdGlvbkV4cHJlc3Npb24sICdhIGZ1bmN0aW9uJyk7XG4gICAgaWYgKCF0cy5pc0Jsb2NrKGZuLmJvZHkpKSB7XG4gICAgICAvLyBpdCBpcyBhIHNpbXBsZSBhcnJheSBmdW5jdGlvbiBleHByZXNzaW9uOiBgKC4uLikgPT4gZXhwcmBcbiAgICAgIHJldHVybiBmbi5ib2R5O1xuICAgIH1cblxuICAgIC8vIGl0IGlzIGEgZnVuY3Rpb24gKGFycm93IG9yIG5vcm1hbCkgd2l0aCBhIGJvZHkuIEUuZy46XG4gICAgLy8gKiBgKC4uLikgPT4geyBzdG10OyAuLi4gfWBcbiAgICAvLyAqIGBmdW5jdGlvbiguLi4pIHsgc3RtdDsgLi4uIH1gXG5cbiAgICBpZiAoZm4uYm9keS5zdGF0ZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTGlua2VyRXJyb3IoXG4gICAgICAgICAgZm4uYm9keSwgJ1Vuc3VwcG9ydGVkIHN5bnRheCwgZXhwZWN0ZWQgYSBmdW5jdGlvbiBib2R5IHdpdGggYSBzaW5nbGUgcmV0dXJuIHN0YXRlbWVudC4nKTtcbiAgICB9XG4gICAgY29uc3Qgc3RtdCA9IGZuLmJvZHkuc3RhdGVtZW50c1swXTtcbiAgICBhc3NlcnQoc3RtdCwgdHMuaXNSZXR1cm5TdGF0ZW1lbnQsICdhIGZ1bmN0aW9uIGJvZHkgd2l0aCBhIHNpbmdsZSByZXR1cm4gc3RhdGVtZW50Jyk7XG4gICAgaWYgKHN0bXQuZXhwcmVzc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxMaW5rZXJFcnJvcihzdG10LCAnVW5zdXBwb3J0ZWQgc3ludGF4LCBleHBlY3RlZCBmdW5jdGlvbiB0byByZXR1cm4gYSB2YWx1ZS4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RtdC5leHByZXNzaW9uO1xuICB9XG5cbiAgaXNDYWxsRXhwcmVzc2lvbiA9IHRzLmlzQ2FsbEV4cHJlc3Npb247XG5cbiAgcGFyc2VDYWxsZWUoY2FsbDogdHMuRXhwcmVzc2lvbik6IHRzLkV4cHJlc3Npb24ge1xuICAgIGFzc2VydChjYWxsLCB0cy5pc0NhbGxFeHByZXNzaW9uLCAnYSBjYWxsIGV4cHJlc3Npb24nKTtcbiAgICByZXR1cm4gY2FsbC5leHByZXNzaW9uO1xuICB9XG5cbiAgcGFyc2VBcmd1bWVudHMoY2FsbDogdHMuRXhwcmVzc2lvbik6IHRzLkV4cHJlc3Npb25bXSB7XG4gICAgYXNzZXJ0KGNhbGwsIHRzLmlzQ2FsbEV4cHJlc3Npb24sICdhIGNhbGwgZXhwcmVzc2lvbicpO1xuICAgIHJldHVybiBjYWxsLmFyZ3VtZW50cy5tYXAoYXJnID0+IHtcbiAgICAgIGFzc2VydChhcmcsIGlzTm90U3ByZWFkRWxlbWVudCwgJ2FyZ3VtZW50IG5vdCB0byB1c2Ugc3ByZWFkIHN5bnRheCcpO1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9KTtcbiAgfVxuXG4gIGdldFJhbmdlKG5vZGU6IHRzLkV4cHJlc3Npb24pOiBSYW5nZSB7XG4gICAgY29uc3QgZmlsZSA9IG5vZGUuZ2V0U291cmNlRmlsZSgpO1xuICAgIGlmIChmaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbExpbmtlckVycm9yKFxuICAgICAgICAgIG5vZGUsICdVbmFibGUgdG8gcmVhZCByYW5nZSBmb3Igbm9kZSAtIGl0IGlzIG1pc3NpbmcgcGFyZW50IGluZm9ybWF0aW9uLicpO1xuICAgIH1cbiAgICBjb25zdCBzdGFydFBvcyA9IG5vZGUuZ2V0U3RhcnQoKTtcbiAgICBjb25zdCBlbmRQb3MgPSBub2RlLmdldEVuZCgpO1xuICAgIGNvbnN0IHtsaW5lOiBzdGFydExpbmUsIGNoYXJhY3Rlcjogc3RhcnRDb2x9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oZmlsZSwgc3RhcnRQb3MpO1xuICAgIHJldHVybiB7c3RhcnRMaW5lLCBzdGFydENvbCwgc3RhcnRQb3MsIGVuZFBvc307XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgZXhwcmVzc2lvbiBkb2VzIG5vdCByZXByZXNlbnQgYW4gZW1wdHkgZWxlbWVudCBpbiBhbiBhcnJheSBsaXRlcmFsLlxuICogRm9yIGV4YW1wbGUgaW4gYFssZm9vXWAgdGhlIGZpcnN0IGVsZW1lbnQgaXMgXCJlbXB0eVwiLlxuICovXG5mdW5jdGlvbiBpc05vdEVtcHR5RWxlbWVudChlOiB0cy5FeHByZXNzaW9ufHRzLlNwcmVhZEVsZW1lbnR8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5PbWl0dGVkRXhwcmVzc2lvbik6IGUgaXMgdHMuRXhwcmVzc2lvbnx0cy5TcHJlYWRFbGVtZW50IHtcbiAgcmV0dXJuICF0cy5pc09taXR0ZWRFeHByZXNzaW9uKGUpO1xufVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIG5vdCBhIHNwcmVhZCBlbGVtZW50IG9mIGFuIGFycmF5IGxpdGVyYWwuXG4gKiBGb3IgZXhhbXBsZSBpbiBgW3gsIC4uLnJlc3RdYCB0aGUgYC4uLnJlc3RgIGV4cHJlc3Npb24gaXMgYSBzcHJlYWQgZWxlbWVudC5cbiAqL1xuZnVuY3Rpb24gaXNOb3RTcHJlYWRFbGVtZW50KGU6IHRzLkV4cHJlc3Npb258dHMuU3ByZWFkRWxlbWVudCk6IGUgaXMgdHMuRXhwcmVzc2lvbiB7XG4gIHJldHVybiAhdHMuaXNTcHJlYWRFbGVtZW50KGUpO1xufVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGNhbiBiZSBjb25zaWRlcmVkIGEgdGV4dCBiYXNlZCBwcm9wZXJ0eSBuYW1lLlxuICovXG5mdW5jdGlvbiBpc1Byb3BlcnR5TmFtZShlOiB0cy5Qcm9wZXJ0eU5hbWUpOiBlIGlzIHRzLklkZW50aWZpZXJ8dHMuU3RyaW5nTGl0ZXJhbHx0cy5OdW1lcmljTGl0ZXJhbCB7XG4gIHJldHVybiB0cy5pc0lkZW50aWZpZXIoZSkgfHwgdHMuaXNTdHJpbmdMaXRlcmFsKGUpIHx8IHRzLmlzTnVtZXJpY0xpdGVyYWwoZSk7XG59XG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdGhlIG5vZGUgaXMgZWl0aGVyIGB0cnVlYCBvciBgZmFsc2VgIGxpdGVyYWxzLlxuICovXG5mdW5jdGlvbiBpc0Jvb2xlYW5MaXRlcmFsKG5vZGU6IHRzLkV4cHJlc3Npb24pOiBub2RlIGlzIHRzLlRydWVMaXRlcmFsfHRzLkZhbHNlTGl0ZXJhbCB7XG4gIHJldHVybiBub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuVHJ1ZUtleXdvcmQgfHwgbm9kZS5raW5kID09PSB0cy5TeW50YXhLaW5kLkZhbHNlS2V5d29yZDtcbn1cblxudHlwZSBNaW5pZmllZEJvb2xlYW5MaXRlcmFsID0gdHMuUHJlZml4VW5hcnlFeHByZXNzaW9uJntvcGVyYW5kOiB0cy5OdW1lcmljTGl0ZXJhbH07XG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdGhlIG5vZGUgaXMgZWl0aGVyIGAhMGAgb3IgYCExYC5cbiAqL1xuZnVuY3Rpb24gaXNNaW5pZmllZEJvb2xlYW5MaXRlcmFsKG5vZGU6IHRzLkV4cHJlc3Npb24pOiBub2RlIGlzIE1pbmlmaWVkQm9vbGVhbkxpdGVyYWwge1xuICByZXR1cm4gdHMuaXNQcmVmaXhVbmFyeUV4cHJlc3Npb24obm9kZSkgJiYgbm9kZS5vcGVyYXRvciA9PT0gdHMuU3ludGF4S2luZC5FeGNsYW1hdGlvblRva2VuICYmXG4gICAgICB0cy5pc051bWVyaWNMaXRlcmFsKG5vZGUub3BlcmFuZCkgJiYgKG5vZGUub3BlcmFuZC50ZXh0ID09PSAnMCcgfHwgbm9kZS5vcGVyYW5kLnRleHQgPT09ICcxJyk7XG59XG4iXX0=