/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
/** Checks whether the given TypeScript node has the specified modifier set. */
export function hasModifier(node, modifierKind) {
    return !!node.modifiers && node.modifiers.some(m => m.kind === modifierKind);
}
/** Find the closest parent node of a particular kind. */
export function closestNode(node, kind) {
    let current = node;
    while (current && !ts.isSourceFile(current)) {
        if (current.kind === kind) {
            return current;
        }
        current = current.parent;
    }
    return null;
}
/**
 * Checks whether a particular node is part of a null check. E.g. given:
 * `foo.bar ? foo.bar.value : null` the null check would be `foo.bar`.
 */
export function isNullCheck(node) {
    if (!node.parent) {
        return false;
    }
    // `foo.bar && foo.bar.value` where `node` is `foo.bar`.
    if (ts.isBinaryExpression(node.parent) && node.parent.left === node) {
        return true;
    }
    // `foo.bar && foo.bar.parent && foo.bar.parent.value`
    // where `node` is `foo.bar`.
    if (node.parent.parent && ts.isBinaryExpression(node.parent.parent) &&
        node.parent.parent.left === node.parent) {
        return true;
    }
    // `if (foo.bar) {...}` where `node` is `foo.bar`.
    if (ts.isIfStatement(node.parent) && node.parent.expression === node) {
        return true;
    }
    // `foo.bar ? foo.bar.value : null` where `node` is `foo.bar`.
    if (ts.isConditionalExpression(node.parent) && node.parent.condition === node) {
        return true;
    }
    return false;
}
/** Checks whether a property access is safe (e.g. `foo.parent?.value`). */
export function isSafeAccess(node) {
    return node.parent != null && ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node && node.parent.questionDotToken != null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvdXRpbHMvdHlwZXNjcmlwdC9ub2Rlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQywrRUFBK0U7QUFDL0UsTUFBTSxVQUFVLFdBQVcsQ0FBQyxJQUFhLEVBQUUsWUFBMkI7SUFDcEUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUM7QUFDL0UsQ0FBQztBQUVELHlEQUF5RDtBQUN6RCxNQUFNLFVBQVUsV0FBVyxDQUFvQixJQUFhLEVBQUUsSUFBbUI7SUFDL0UsSUFBSSxPQUFPLEdBQVksSUFBSSxDQUFDO0lBRTVCLE9BQU8sT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUMzQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1lBQ3pCLE9BQU8sT0FBWSxDQUFDO1NBQ3JCO1FBQ0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7S0FDMUI7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUFDLElBQWE7SUFDdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDaEIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELHdEQUF3RDtJQUN4RCxJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQ25FLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxzREFBc0Q7SUFDdEQsNkJBQTZCO0lBQzdCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQy9ELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQzNDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxrREFBa0Q7SUFDbEQsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDcEUsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUVELDhEQUE4RDtJQUM5RCxJQUFJLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO1FBQzdFLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCwyRUFBMkU7QUFDM0UsTUFBTSxVQUFVLFlBQVksQ0FBQyxJQUFhO0lBQ3hDLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDcEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDO0FBQzlFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbi8qKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gVHlwZVNjcmlwdCBub2RlIGhhcyB0aGUgc3BlY2lmaWVkIG1vZGlmaWVyIHNldC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNNb2RpZmllcihub2RlOiB0cy5Ob2RlLCBtb2RpZmllcktpbmQ6IHRzLlN5bnRheEtpbmQpIHtcbiAgcmV0dXJuICEhbm9kZS5tb2RpZmllcnMgJiYgbm9kZS5tb2RpZmllcnMuc29tZShtID0+IG0ua2luZCA9PT0gbW9kaWZpZXJLaW5kKTtcbn1cblxuLyoqIEZpbmQgdGhlIGNsb3Nlc3QgcGFyZW50IG5vZGUgb2YgYSBwYXJ0aWN1bGFyIGtpbmQuICovXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VzdE5vZGU8VCBleHRlbmRzIHRzLk5vZGU+KG5vZGU6IHRzLk5vZGUsIGtpbmQ6IHRzLlN5bnRheEtpbmQpOiBUfG51bGwge1xuICBsZXQgY3VycmVudDogdHMuTm9kZSA9IG5vZGU7XG5cbiAgd2hpbGUgKGN1cnJlbnQgJiYgIXRzLmlzU291cmNlRmlsZShjdXJyZW50KSkge1xuICAgIGlmIChjdXJyZW50LmtpbmQgPT09IGtpbmQpIHtcbiAgICAgIHJldHVybiBjdXJyZW50IGFzIFQ7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIGEgcGFydGljdWxhciBub2RlIGlzIHBhcnQgb2YgYSBudWxsIGNoZWNrLiBFLmcuIGdpdmVuOlxuICogYGZvby5iYXIgPyBmb28uYmFyLnZhbHVlIDogbnVsbGAgdGhlIG51bGwgY2hlY2sgd291bGQgYmUgYGZvby5iYXJgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOdWxsQ2hlY2sobm9kZTogdHMuTm9kZSk6IGJvb2xlYW4ge1xuICBpZiAoIW5vZGUucGFyZW50KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gYGZvby5iYXIgJiYgZm9vLmJhci52YWx1ZWAgd2hlcmUgYG5vZGVgIGlzIGBmb28uYmFyYC5cbiAgaWYgKHRzLmlzQmluYXJ5RXhwcmVzc2lvbihub2RlLnBhcmVudCkgJiYgbm9kZS5wYXJlbnQubGVmdCA9PT0gbm9kZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gYGZvby5iYXIgJiYgZm9vLmJhci5wYXJlbnQgJiYgZm9vLmJhci5wYXJlbnQudmFsdWVgXG4gIC8vIHdoZXJlIGBub2RlYCBpcyBgZm9vLmJhcmAuXG4gIGlmIChub2RlLnBhcmVudC5wYXJlbnQgJiYgdHMuaXNCaW5hcnlFeHByZXNzaW9uKG5vZGUucGFyZW50LnBhcmVudCkgJiZcbiAgICAgIG5vZGUucGFyZW50LnBhcmVudC5sZWZ0ID09PSBub2RlLnBhcmVudCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gYGlmIChmb28uYmFyKSB7Li4ufWAgd2hlcmUgYG5vZGVgIGlzIGBmb28uYmFyYC5cbiAgaWYgKHRzLmlzSWZTdGF0ZW1lbnQobm9kZS5wYXJlbnQpICYmIG5vZGUucGFyZW50LmV4cHJlc3Npb24gPT09IG5vZGUpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIGBmb28uYmFyID8gZm9vLmJhci52YWx1ZSA6IG51bGxgIHdoZXJlIGBub2RlYCBpcyBgZm9vLmJhcmAuXG4gIGlmICh0cy5pc0NvbmRpdGlvbmFsRXhwcmVzc2lvbihub2RlLnBhcmVudCkgJiYgbm9kZS5wYXJlbnQuY29uZGl0aW9uID09PSBub2RlKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKiBDaGVja3Mgd2hldGhlciBhIHByb3BlcnR5IGFjY2VzcyBpcyBzYWZlIChlLmcuIGBmb28ucGFyZW50Py52YWx1ZWApLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2FmZUFjY2Vzcyhub2RlOiB0cy5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlLnBhcmVudCAhPSBudWxsICYmIHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG5vZGUucGFyZW50KSAmJlxuICAgICAgbm9kZS5wYXJlbnQuZXhwcmVzc2lvbiA9PT0gbm9kZSAmJiBub2RlLnBhcmVudC5xdWVzdGlvbkRvdFRva2VuICE9IG51bGw7XG59XG4iXX0=