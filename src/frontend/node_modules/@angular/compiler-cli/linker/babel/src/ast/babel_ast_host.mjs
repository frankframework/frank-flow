/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as t from '@babel/types';
import { assert, FatalLinkerError } from '../../../../linker';
/**
 * This implementation of `AstHost` is able to get information from Babel AST nodes.
 */
export class BabelAstHost {
    constructor() {
        this.isStringLiteral = t.isStringLiteral;
        this.isNumericLiteral = t.isNumericLiteral;
        this.isArrayLiteral = t.isArrayExpression;
        this.isObjectLiteral = t.isObjectExpression;
        this.isCallExpression = t.isCallExpression;
    }
    getSymbolName(node) {
        if (t.isIdentifier(node)) {
            return node.name;
        }
        else if (t.isMemberExpression(node) && t.isIdentifier(node.property)) {
            return node.property.name;
        }
        else {
            return null;
        }
    }
    parseStringLiteral(str) {
        assert(str, t.isStringLiteral, 'a string literal');
        return str.value;
    }
    parseNumericLiteral(num) {
        assert(num, t.isNumericLiteral, 'a numeric literal');
        return num.value;
    }
    isBooleanLiteral(bool) {
        return t.isBooleanLiteral(bool) || isMinifiedBooleanLiteral(bool);
    }
    parseBooleanLiteral(bool) {
        if (t.isBooleanLiteral(bool)) {
            return bool.value;
        }
        else if (isMinifiedBooleanLiteral(bool)) {
            return !bool.argument.value;
        }
        else {
            throw new FatalLinkerError(bool, 'Unsupported syntax, expected a boolean literal.');
        }
    }
    parseArrayLiteral(array) {
        assert(array, t.isArrayExpression, 'an array literal');
        return array.elements.map(element => {
            assert(element, isNotEmptyElement, 'element in array not to be empty');
            assert(element, isNotSpreadElement, 'element in array not to use spread syntax');
            return element;
        });
    }
    parseObjectLiteral(obj) {
        assert(obj, t.isObjectExpression, 'an object literal');
        const result = new Map();
        for (const property of obj.properties) {
            assert(property, t.isObjectProperty, 'a property assignment');
            assert(property.value, t.isExpression, 'an expression');
            assert(property.key, isPropertyName, 'a property name');
            const key = t.isIdentifier(property.key) ? property.key.name : property.key.value;
            result.set(key, property.value);
        }
        return result;
    }
    isFunctionExpression(node) {
        return t.isFunction(node);
    }
    parseReturnValue(fn) {
        assert(fn, this.isFunctionExpression, 'a function');
        if (!t.isBlockStatement(fn.body)) {
            // it is a simple array function expression: `(...) => expr`
            return fn.body;
        }
        // it is a function (arrow or normal) with a body. E.g.:
        // * `(...) => { stmt; ... }`
        // * `function(...) { stmt; ... }`
        if (fn.body.body.length !== 1) {
            throw new FatalLinkerError(fn.body, 'Unsupported syntax, expected a function body with a single return statement.');
        }
        const stmt = fn.body.body[0];
        assert(stmt, t.isReturnStatement, 'a function body with a single return statement');
        if (stmt.argument === null) {
            throw new FatalLinkerError(stmt, 'Unsupported syntax, expected function to return a value.');
        }
        return stmt.argument;
    }
    parseCallee(call) {
        assert(call, t.isCallExpression, 'a call expression');
        assert(call.callee, t.isExpression, 'an expression');
        return call.callee;
    }
    parseArguments(call) {
        assert(call, t.isCallExpression, 'a call expression');
        return call.arguments.map(arg => {
            assert(arg, isNotSpreadArgument, 'argument not to use spread syntax');
            assert(arg, t.isExpression, 'argument to be an expression');
            return arg;
        });
    }
    getRange(node) {
        if (node.loc == null || node.start === null || node.end === null) {
            throw new FatalLinkerError(node, 'Unable to read range for node - it is missing location information.');
        }
        return {
            startLine: node.loc.start.line - 1,
            startCol: node.loc.start.column,
            startPos: node.start,
            endPos: node.end,
        };
    }
}
/**
 * Return true if the expression does not represent an empty element in an array literal.
 * For example in `[,foo]` the first element is "empty".
 */
function isNotEmptyElement(e) {
    return e !== null;
}
/**
 * Return true if the expression is not a spread element of an array literal.
 * For example in `[x, ...rest]` the `...rest` expression is a spread element.
 */
function isNotSpreadElement(e) {
    return !t.isSpreadElement(e);
}
/**
 * Return true if the expression can be considered a text based property name.
 */
function isPropertyName(e) {
    return t.isIdentifier(e) || t.isStringLiteral(e) || t.isNumericLiteral(e);
}
/**
 * Return true if the argument is not a spread element.
 */
function isNotSpreadArgument(arg) {
    return !t.isSpreadElement(arg);
}
/**
 * Return true if the node is either `!0` or `!1`.
 */
function isMinifiedBooleanLiteral(node) {
    return t.isUnaryExpression(node) && node.prefix && node.operator === '!' &&
        t.isNumericLiteral(node.argument) && (node.argument.value === 0 || node.argument.value === 1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFiZWxfYXN0X2hvc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsL3NyYy9hc3QvYmFiZWxfYXN0X2hvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSxjQUFjLENBQUM7QUFFbEMsT0FBTyxFQUFDLE1BQU0sRUFBVyxnQkFBZ0IsRUFBUSxNQUFNLG9CQUFvQixDQUFDO0FBRTVFOztHQUVHO0FBQ0gsTUFBTSxPQUFPLFlBQVk7SUFBekI7UUFXRSxvQkFBZSxHQUFHLENBQUMsQ0FBQyxlQUFlLENBQUM7UUFPcEMscUJBQWdCLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO1FBcUJ0QyxtQkFBYyxHQUFHLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztRQVdyQyxvQkFBZSxHQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztRQTRDdkMscUJBQWdCLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBMkJ4QyxDQUFDO0lBeEhDLGFBQWEsQ0FBQyxJQUFrQjtRQUM5QixJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQ2xCO2FBQU0sSUFBSSxDQUFDLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdEUsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztTQUMzQjthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUM7SUFJRCxrQkFBa0IsQ0FBQyxHQUFpQjtRQUNsQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxlQUFlLEVBQUUsa0JBQWtCLENBQUMsQ0FB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LE9BQU8sQ0FBQyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHO1FBQ3BFLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDcEcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJ0BiYWJlbC90eXBlcyc7XG5cbmltcG9ydCB7YXNzZXJ0LCBBc3RIb3N0LCBGYXRhbExpbmtlckVycm9yLCBSYW5nZX0gZnJvbSAnLi4vLi4vLi4vLi4vbGlua2VyJztcblxuLyoqXG4gKiBUaGlzIGltcGxlbWVudGF0aW9uIG9mIGBBc3RIb3N0YCBpcyBhYmxlIHRvIGdldCBpbmZvcm1hdGlvbiBmcm9tIEJhYmVsIEFTVCBub2Rlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIEJhYmVsQXN0SG9zdCBpbXBsZW1lbnRzIEFzdEhvc3Q8dC5FeHByZXNzaW9uPiB7XG4gIGdldFN5bWJvbE5hbWUobm9kZTogdC5FeHByZXNzaW9uKTogc3RyaW5nfG51bGwge1xuICAgIGlmICh0LmlzSWRlbnRpZmllcihub2RlKSkge1xuICAgICAgcmV0dXJuIG5vZGUubmFtZTtcbiAgICB9IGVsc2UgaWYgKHQuaXNNZW1iZXJFeHByZXNzaW9uKG5vZGUpICYmIHQuaXNJZGVudGlmaWVyKG5vZGUucHJvcGVydHkpKSB7XG4gICAgICByZXR1cm4gbm9kZS5wcm9wZXJ0eS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBpc1N0cmluZ0xpdGVyYWwgPSB0LmlzU3RyaW5nTGl0ZXJhbDtcblxuICBwYXJzZVN0cmluZ0xpdGVyYWwoc3RyOiB0LkV4cHJlc3Npb24pOiBzdHJpbmcge1xuICAgIGFzc2VydChzdHIsIHQuaXNTdHJpbmdMaXRlcmFsLCAnYSBzdHJpbmcgbGl0ZXJhbCcpO1xuICAgIHJldHVybiBzdHIudmFsdWU7XG4gIH1cblxuICBpc051bWVyaWNMaXRlcmFsID0gdC5pc051bWVyaWNMaXRlcmFsO1xuXG4gIHBhcnNlTnVtZXJpY0xpdGVyYWwobnVtOiB0LkV4cHJlc3Npb24pOiBudW1iZXIge1xuICAgIGFzc2VydChudW0sIHQuaXNOdW1lcmljTGl0ZXJhbCwgJ2EgbnVtZXJpYyBsaXRlcmFsJyk7XG4gICAgcmV0dXJuIG51bS52YWx1ZTtcbiAgfVxuXG4gIGlzQm9vbGVhbkxpdGVyYWwoYm9vbDogdC5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHQuaXNCb29sZWFuTGl0ZXJhbChib29sKSB8fCBpc01pbmlmaWVkQm9vbGVhbkxpdGVyYWwoYm9vbCk7XG4gIH1cblxuICBwYXJzZUJvb2xlYW5MaXRlcmFsKGJvb2w6IHQuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICh0LmlzQm9vbGVhbkxpdGVyYWwoYm9vbCkpIHtcbiAgICAgIHJldHVybiBib29sLnZhbHVlO1xuICAgIH0gZWxzZSBpZiAoaXNNaW5pZmllZEJvb2xlYW5MaXRlcmFsKGJvb2wpKSB7XG4gICAgICByZXR1cm4gIWJvb2wuYXJndW1lbnQudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbExpbmtlckVycm9yKGJvb2wsICdVbnN1cHBvcnRlZCBzeW50YXgsIGV4cGVjdGVkIGEgYm9vbGVhbiBsaXRlcmFsLicpO1xuICAgIH1cbiAgfVxuXG4gIGlzQXJyYXlMaXRlcmFsID0gdC5pc0FycmF5RXhwcmVzc2lvbjtcblxuICBwYXJzZUFycmF5TGl0ZXJhbChhcnJheTogdC5FeHByZXNzaW9uKTogdC5FeHByZXNzaW9uW10ge1xuICAgIGFzc2VydChhcnJheSwgdC5pc0FycmF5RXhwcmVzc2lvbiwgJ2FuIGFycmF5IGxpdGVyYWwnKTtcbiAgICByZXR1cm4gYXJyYXkuZWxlbWVudHMubWFwKGVsZW1lbnQgPT4ge1xuICAgICAgYXNzZXJ0KGVsZW1lbnQsIGlzTm90RW1wdHlFbGVtZW50LCAnZWxlbWVudCBpbiBhcnJheSBub3QgdG8gYmUgZW1wdHknKTtcbiAgICAgIGFzc2VydChlbGVtZW50LCBpc05vdFNwcmVhZEVsZW1lbnQsICdlbGVtZW50IGluIGFycmF5IG5vdCB0byB1c2Ugc3ByZWFkIHN5bnRheCcpO1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfSk7XG4gIH1cblxuICBpc09iamVjdExpdGVyYWwgPSB0LmlzT2JqZWN0RXhwcmVzc2lvbjtcblxuICBwYXJzZU9iamVjdExpdGVyYWwob2JqOiB0LkV4cHJlc3Npb24pOiBNYXA8c3RyaW5nLCB0LkV4cHJlc3Npb24+IHtcbiAgICBhc3NlcnQob2JqLCB0LmlzT2JqZWN0RXhwcmVzc2lvbiwgJ2FuIG9iamVjdCBsaXRlcmFsJyk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgdC5FeHByZXNzaW9uPigpO1xuICAgIGZvciAoY29uc3QgcHJvcGVydHkgb2Ygb2JqLnByb3BlcnRpZXMpIHtcbiAgICAgIGFzc2VydChwcm9wZXJ0eSwgdC5pc09iamVjdFByb3BlcnR5LCAnYSBwcm9wZXJ0eSBhc3NpZ25tZW50Jyk7XG4gICAgICBhc3NlcnQocHJvcGVydHkudmFsdWUsIHQuaXNFeHByZXNzaW9uLCAnYW4gZXhwcmVzc2lvbicpO1xuICAgICAgYXNzZXJ0KHByb3BlcnR5LmtleSwgaXNQcm9wZXJ0eU5hbWUsICdhIHByb3BlcnR5IG5hbWUnKTtcbiAgICAgIGNvbnN0IGtleSA9IHQuaXNJZGVudGlmaWVyKHByb3BlcnR5LmtleSkgPyBwcm9wZXJ0eS5rZXkubmFtZSA6IHByb3BlcnR5LmtleS52YWx1ZTtcbiAgICAgIHJlc3VsdC5zZXQoa2V5LCBwcm9wZXJ0eS52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBpc0Z1bmN0aW9uRXhwcmVzc2lvbihub2RlOiB0LkV4cHJlc3Npb24pOiBub2RlIGlzIEV4dHJhY3Q8dC5GdW5jdGlvbiwgdC5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHQuaXNGdW5jdGlvbihub2RlKTtcbiAgfVxuXG4gIHBhcnNlUmV0dXJuVmFsdWUoZm46IHQuRXhwcmVzc2lvbik6IHQuRXhwcmVzc2lvbiB7XG4gICAgYXNzZXJ0KGZuLCB0aGlzLmlzRnVuY3Rpb25FeHByZXNzaW9uLCAnYSBmdW5jdGlvbicpO1xuICAgIGlmICghdC5pc0Jsb2NrU3RhdGVtZW50KGZuLmJvZHkpKSB7XG4gICAgICAvLyBpdCBpcyBhIHNpbXBsZSBhcnJheSBmdW5jdGlvbiBleHByZXNzaW9uOiBgKC4uLikgPT4gZXhwcmBcbiAgICAgIHJldHVybiBmbi5ib2R5O1xuICAgIH1cblxuICAgIC8vIGl0IGlzIGEgZnVuY3Rpb24gKGFycm93IG9yIG5vcm1hbCkgd2l0aCBhIGJvZHkuIEUuZy46XG4gICAgLy8gKiBgKC4uLikgPT4geyBzdG10OyAuLi4gfWBcbiAgICAvLyAqIGBmdW5jdGlvbiguLi4pIHsgc3RtdDsgLi4uIH1gXG5cbiAgICBpZiAoZm4uYm9keS5ib2R5Lmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTGlua2VyRXJyb3IoXG4gICAgICAgICAgZm4uYm9keSwgJ1Vuc3VwcG9ydGVkIHN5bnRheCwgZXhwZWN0ZWQgYSBmdW5jdGlvbiBib2R5IHdpdGggYSBzaW5nbGUgcmV0dXJuIHN0YXRlbWVudC4nKTtcbiAgICB9XG4gICAgY29uc3Qgc3RtdCA9IGZuLmJvZHkuYm9keVswXTtcbiAgICBhc3NlcnQoc3RtdCwgdC5pc1JldHVyblN0YXRlbWVudCwgJ2EgZnVuY3Rpb24gYm9keSB3aXRoIGEgc2luZ2xlIHJldHVybiBzdGF0ZW1lbnQnKTtcbiAgICBpZiAoc3RtdC5hcmd1bWVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTGlua2VyRXJyb3Ioc3RtdCwgJ1Vuc3VwcG9ydGVkIHN5bnRheCwgZXhwZWN0ZWQgZnVuY3Rpb24gdG8gcmV0dXJuIGEgdmFsdWUuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0bXQuYXJndW1lbnQ7XG4gIH1cblxuICBpc0NhbGxFeHByZXNzaW9uID0gdC5pc0NhbGxFeHByZXNzaW9uO1xuICBwYXJzZUNhbGxlZShjYWxsOiB0LkV4cHJlc3Npb24pOiB0LkV4cHJlc3Npb24ge1xuICAgIGFzc2VydChjYWxsLCB0LmlzQ2FsbEV4cHJlc3Npb24sICdhIGNhbGwgZXhwcmVzc2lvbicpO1xuICAgIGFzc2VydChjYWxsLmNhbGxlZSwgdC5pc0V4cHJlc3Npb24sICdhbiBleHByZXNzaW9uJyk7XG4gICAgcmV0dXJuIGNhbGwuY2FsbGVlO1xuICB9XG4gIHBhcnNlQXJndW1lbnRzKGNhbGw6IHQuRXhwcmVzc2lvbik6IHQuRXhwcmVzc2lvbltdIHtcbiAgICBhc3NlcnQoY2FsbCwgdC5pc0NhbGxFeHByZXNzaW9uLCAnYSBjYWxsIGV4cHJlc3Npb24nKTtcbiAgICByZXR1cm4gY2FsbC5hcmd1bWVudHMubWFwKGFyZyA9PiB7XG4gICAgICBhc3NlcnQoYXJnLCBpc05vdFNwcmVhZEFyZ3VtZW50LCAnYXJndW1lbnQgbm90IHRvIHVzZSBzcHJlYWQgc3ludGF4Jyk7XG4gICAgICBhc3NlcnQoYXJnLCB0LmlzRXhwcmVzc2lvbiwgJ2FyZ3VtZW50IHRvIGJlIGFuIGV4cHJlc3Npb24nKTtcbiAgICAgIHJldHVybiBhcmc7XG4gICAgfSk7XG4gIH1cblxuICBnZXRSYW5nZShub2RlOiB0LkV4cHJlc3Npb24pOiBSYW5nZSB7XG4gICAgaWYgKG5vZGUubG9jID09IG51bGwgfHwgbm9kZS5zdGFydCA9PT0gbnVsbCB8fCBub2RlLmVuZCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTGlua2VyRXJyb3IoXG4gICAgICAgICAgbm9kZSwgJ1VuYWJsZSB0byByZWFkIHJhbmdlIGZvciBub2RlIC0gaXQgaXMgbWlzc2luZyBsb2NhdGlvbiBpbmZvcm1hdGlvbi4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0TGluZTogbm9kZS5sb2Muc3RhcnQubGluZSAtIDEsICAvLyBCYWJlbCBsaW5lcyBhcmUgMS1iYXNlZFxuICAgICAgc3RhcnRDb2w6IG5vZGUubG9jLnN0YXJ0LmNvbHVtbixcbiAgICAgIHN0YXJ0UG9zOiBub2RlLnN0YXJ0LFxuICAgICAgZW5kUG9zOiBub2RlLmVuZCxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdGhlIGV4cHJlc3Npb24gZG9lcyBub3QgcmVwcmVzZW50IGFuIGVtcHR5IGVsZW1lbnQgaW4gYW4gYXJyYXkgbGl0ZXJhbC5cbiAqIEZvciBleGFtcGxlIGluIGBbLGZvb11gIHRoZSBmaXJzdCBlbGVtZW50IGlzIFwiZW1wdHlcIi5cbiAqL1xuZnVuY3Rpb24gaXNOb3RFbXB0eUVsZW1lbnQoZTogdC5FeHByZXNzaW9ufHQuU3ByZWFkRWxlbWVudHxudWxsKTogZSBpcyB0LkV4cHJlc3Npb258XG4gICAgdC5TcHJlYWRFbGVtZW50IHtcbiAgcmV0dXJuIGUgIT09IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdGhlIGV4cHJlc3Npb24gaXMgbm90IGEgc3ByZWFkIGVsZW1lbnQgb2YgYW4gYXJyYXkgbGl0ZXJhbC5cbiAqIEZvciBleGFtcGxlIGluIGBbeCwgLi4ucmVzdF1gIHRoZSBgLi4ucmVzdGAgZXhwcmVzc2lvbiBpcyBhIHNwcmVhZCBlbGVtZW50LlxuICovXG5mdW5jdGlvbiBpc05vdFNwcmVhZEVsZW1lbnQoZTogdC5FeHByZXNzaW9ufHQuU3ByZWFkRWxlbWVudCk6IGUgaXMgdC5FeHByZXNzaW9uIHtcbiAgcmV0dXJuICF0LmlzU3ByZWFkRWxlbWVudChlKTtcbn1cblxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGNhbiBiZSBjb25zaWRlcmVkIGEgdGV4dCBiYXNlZCBwcm9wZXJ0eSBuYW1lLlxuICovXG5mdW5jdGlvbiBpc1Byb3BlcnR5TmFtZShlOiB0LkV4cHJlc3Npb24pOiBlIGlzIHQuSWRlbnRpZmllcnx0LlN0cmluZ0xpdGVyYWx8dC5OdW1lcmljTGl0ZXJhbCB7XG4gIHJldHVybiB0LmlzSWRlbnRpZmllcihlKSB8fCB0LmlzU3RyaW5nTGl0ZXJhbChlKSB8fCB0LmlzTnVtZXJpY0xpdGVyYWwoZSk7XG59XG5cbi8qKlxuICogVGhlIGRlY2xhcmVkIHR5cGUgb2YgYW4gYXJndW1lbnQgdG8gYSBjYWxsIGV4cHJlc3Npb24uXG4gKi9cbnR5cGUgQXJndW1lbnRUeXBlID0gdC5DYWxsRXhwcmVzc2lvblsnYXJndW1lbnRzJ11bbnVtYmVyXTtcblxuLyoqXG4gKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgYXJndW1lbnQgaXMgbm90IGEgc3ByZWFkIGVsZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIGlzTm90U3ByZWFkQXJndW1lbnQoYXJnOiBBcmd1bWVudFR5cGUpOiBhcmcgaXMgRXhjbHVkZTxBcmd1bWVudFR5cGUsIHQuU3ByZWFkRWxlbWVudD4ge1xuICByZXR1cm4gIXQuaXNTcHJlYWRFbGVtZW50KGFyZyk7XG59XG5cbnR5cGUgTWluaWZpZWRCb29sZWFuTGl0ZXJhbCA9IHQuRXhwcmVzc2lvbiZ0LlVuYXJ5RXhwcmVzc2lvbiZ7YXJndW1lbnQ6IHQuTnVtZXJpY0xpdGVyYWx9O1xuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHRoZSBub2RlIGlzIGVpdGhlciBgITBgIG9yIGAhMWAuXG4gKi9cbmZ1bmN0aW9uIGlzTWluaWZpZWRCb29sZWFuTGl0ZXJhbChub2RlOiB0LkV4cHJlc3Npb24pOiBub2RlIGlzIE1pbmlmaWVkQm9vbGVhbkxpdGVyYWwge1xuICByZXR1cm4gdC5pc1VuYXJ5RXhwcmVzc2lvbihub2RlKSAmJiBub2RlLnByZWZpeCAmJiBub2RlLm9wZXJhdG9yID09PSAnIScgJiZcbiAgICAgIHQuaXNOdW1lcmljTGl0ZXJhbChub2RlLmFyZ3VtZW50KSAmJiAobm9kZS5hcmd1bWVudC52YWx1ZSA9PT0gMCB8fCBub2RlLmFyZ3VtZW50LnZhbHVlID09PSAxKTtcbn1cbiJdfQ==