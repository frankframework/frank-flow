/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { makeRelatedInformation } from '../../diagnostics';
import { Reference } from '../../imports';
import { DynamicValue } from './dynamic';
import { EnumValue, KnownFn, ResolvedModule } from './result';
/**
 * Derives a type representation from a resolved value to be reported in a diagnostic.
 *
 * @param value The resolved value for which a type representation should be derived.
 * @param maxDepth The maximum nesting depth of objects and arrays, defaults to 1 level.
 */
export function describeResolvedType(value, maxDepth = 1) {
    var _a, _b;
    if (value === null) {
        return 'null';
    }
    else if (value === undefined) {
        return 'undefined';
    }
    else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
        return typeof value;
    }
    else if (value instanceof Map) {
        if (maxDepth === 0) {
            return 'object';
        }
        const entries = Array.from(value.entries()).map(([key, v]) => {
            return `${quoteKey(key)}: ${describeResolvedType(v, maxDepth - 1)}`;
        });
        return entries.length > 0 ? `{ ${entries.join('; ')} }` : '{}';
    }
    else if (value instanceof ResolvedModule) {
        return '(module)';
    }
    else if (value instanceof EnumValue) {
        return (_a = value.enumRef.debugName) !== null && _a !== void 0 ? _a : '(anonymous)';
    }
    else if (value instanceof Reference) {
        return (_b = value.debugName) !== null && _b !== void 0 ? _b : '(anonymous)';
    }
    else if (Array.isArray(value)) {
        if (maxDepth === 0) {
            return 'Array';
        }
        return `[${value.map(v => describeResolvedType(v, maxDepth - 1)).join(', ')}]`;
    }
    else if (value instanceof DynamicValue) {
        return '(not statically analyzable)';
    }
    else if (value instanceof KnownFn) {
        return 'Function';
    }
    else {
        return 'unknown';
    }
}
function quoteKey(key) {
    if (/^[a-z0-9_]+$/i.test(key)) {
        return key;
    }
    else {
        return `'${key.replace(/'/g, '\\\'')}'`;
    }
}
/**
 * Creates an array of related information diagnostics for a `DynamicValue` that describe the trace
 * of why an expression was evaluated as dynamic.
 *
 * @param node The node for which a `ts.Diagnostic` is to be created with the trace.
 * @param value The dynamic value for which a trace should be created.
 */
export function traceDynamicValue(node, value) {
    return value.accept(new TraceDynamicValueVisitor(node));
}
class TraceDynamicValueVisitor {
    constructor(node) {
        this.node = node;
        this.currentContainerNode = null;
    }
    visitDynamicInput(value) {
        const trace = value.reason.accept(this);
        if (this.shouldTrace(value.node)) {
            const info = makeRelatedInformation(value.node, 'Unable to evaluate this expression statically.');
            trace.unshift(info);
        }
        return trace;
    }
    visitDynamicString(value) {
        return [makeRelatedInformation(value.node, 'A string value could not be determined statically.')];
    }
    visitExternalReference(value) {
        const name = value.reason.debugName;
        const description = name !== null ? `'${name}'` : 'an anonymous declaration';
        return [makeRelatedInformation(value.node, `A value for ${description} cannot be determined statically, as it is an external declaration.`)];
    }
    visitComplexFunctionCall(value) {
        return [
            makeRelatedInformation(value.node, 'Unable to evaluate function call of complex function. A function must have exactly one return statement.'),
            makeRelatedInformation(value.reason.node, 'Function is declared here.')
        ];
    }
    visitInvalidExpressionType(value) {
        return [makeRelatedInformation(value.node, 'Unable to evaluate an invalid expression.')];
    }
    visitUnknown(value) {
        return [makeRelatedInformation(value.node, 'Unable to evaluate statically.')];
    }
    visitUnknownIdentifier(value) {
        return [makeRelatedInformation(value.node, 'Unknown reference.')];
    }
    visitDynamicType(value) {
        return [makeRelatedInformation(value.node, 'Dynamic type.')];
    }
    visitUnsupportedSyntax(value) {
        return [makeRelatedInformation(value.node, 'This syntax is not supported.')];
    }
    /**
     * Determines whether the dynamic value reported for the node should be traced, i.e. if it is not
     * part of the container for which the most recent trace was created.
     */
    shouldTrace(node) {
        if (node === this.node) {
            // Do not include a dynamic value for the origin node, as the main diagnostic is already
            // reported on that node.
            return false;
        }
        const container = getContainerNode(node);
        if (container === this.currentContainerNode) {
            // The node is part of the same container as the previous trace entry, so this dynamic value
            // should not become part of the trace.
            return false;
        }
        this.currentContainerNode = container;
        return true;
    }
}
/**
 * Determines the closest parent node that is to be considered as container, which is used to reduce
 * the granularity of tracing the dynamic values to a single entry per container. Currently, full
 * statements and destructuring patterns are considered as container.
 */
function getContainerNode(node) {
    let currentNode = node;
    while (currentNode !== undefined) {
        switch (currentNode.kind) {
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.VariableStatement:
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.SwitchStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.ContinueStatement:
            case ts.SyntaxKind.BreakStatement:
            case ts.SyntaxKind.ThrowStatement:
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.ArrayBindingPattern:
                return currentNode;
        }
        currentNode = currentNode.parent;
    }
    return node.getSourceFile();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhZ25vc3RpY3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3BhcnRpYWxfZXZhbHVhdG9yL3NyYy9kaWFnbm9zdGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUN6RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXhDLE9BQU8sRUFBQyxZQUFZLEVBQXNCLE1BQU0sV0FBVyxDQUFDO0FBQzVELE9BQU8sRUFBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBZ0IsTUFBTSxVQUFVLENBQUM7QUFFM0U7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsS0FBb0IsRUFBRSxXQUFtQixDQUFDOztJQUM3RSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7UUFDbEIsT0FBTyxNQUFNLENBQUM7S0FDZjtTQUFNLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtRQUM5QixPQUFPLFdBQVcsQ0FBQztLQUNwQjtTQUFNLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxLQUFLLFNBQVMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDL0YsT0FBTyxPQUFPLEtBQUssQ0FBQztLQUNyQjtTQUFNLElBQUksS0FBSyxZQUFZLEdBQUcsRUFBRTtRQUMvQixJQUFJLFFBQVEsS0FBSyxDQUFDLEVBQUU7WUFDbEIsT0FBTyxRQUFRLENBQUM7U0FDakI7UUFDRCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMs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RUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUM7WUFDbEMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQztZQUNsQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLENBQUM7WUFDeEMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtnQkFDcEMsT0FBTyxXQUFXLENBQUM7U0FDdEI7UUFFRCxXQUFXLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztLQUNsQztJQUNELE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7bWFrZVJlbGF0ZWRJbmZvcm1hdGlvbn0gZnJvbSAnLi4vLi4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtGdW5jdGlvbkRlZmluaXRpb259IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtEeW5hbWljVmFsdWUsIER5bmFtaWNWYWx1ZVZpc2l0b3J9IGZyb20gJy4vZHluYW1pYyc7XG5pbXBvcnQge0VudW1WYWx1ZSwgS25vd25GbiwgUmVzb2x2ZWRNb2R1bGUsIFJlc29sdmVkVmFsdWV9IGZyb20gJy4vcmVzdWx0JztcblxuLyoqXG4gKiBEZXJpdmVzIGEgdHlwZSByZXByZXNlbnRhdGlvbiBmcm9tIGEgcmVzb2x2ZWQgdmFsdWUgdG8gYmUgcmVwb3J0ZWQgaW4gYSBkaWFnbm9zdGljLlxuICpcbiAqIEBwYXJhbSB2YWx1ZSBUaGUgcmVzb2x2ZWQgdmFsdWUgZm9yIHdoaWNoIGEgdHlwZSByZXByZXNlbnRhdGlvbiBzaG91bGQgYmUgZGVyaXZlZC5cbiAqIEBwYXJhbSBtYXhEZXB0aCBUaGUgbWF4aW11bSBuZXN0aW5nIGRlcHRoIG9mIG9iamVjdHMgYW5kIGFycmF5cywgZGVmYXVsdHMgdG8gMSBsZXZlbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlc2NyaWJlUmVzb2x2ZWRUeXBlKHZhbHVlOiBSZXNvbHZlZFZhbHVlLCBtYXhEZXB0aDogbnVtYmVyID0gMSk6IHN0cmluZyB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiAnbnVsbCc7XG4gIH0gZWxzZSBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlO1xuICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTWFwKSB7XG4gICAgaWYgKG1heERlcHRoID09PSAwKSB7XG4gICAgICByZXR1cm4gJ29iamVjdCc7XG4gICAgfVxuICAgIGNvbnN0IGVudHJpZXMgPSBBcnJheS5mcm9tKHZhbHVlLmVudHJpZXMoKSkubWFwKChba2V5LCB2XSkgPT4ge1xuICAgICAgcmV0dXJuIGAke3F1b3RlS2V5KGtleSl9OiAke2Rlc2NyaWJlUmVzb2x2ZWRUeXBlKHYsIG1heERlcHRoIC0gMSl9YDtcbiAgICB9KTtcbiAgICByZXR1cm4gZW50cmllcy5sZW5ndGggPiAwID8gYHsgJHtlbnRyaWVzLmpvaW4oJzsgJyl9IH1gIDogJ3t9JztcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFJlc29sdmVkTW9kdWxlKSB7XG4gICAgcmV0dXJuICcobW9kdWxlKSc7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBFbnVtVmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUuZW51bVJlZi5kZWJ1Z05hbWUgPz8gJyhhbm9ueW1vdXMpJztcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgIHJldHVybiB2YWx1ZS5kZWJ1Z05hbWUgPz8gJyhhbm9ueW1vdXMpJztcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGlmIChtYXhEZXB0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuICdBcnJheSc7XG4gICAgfVxuICAgIHJldHVybiBgWyR7dmFsdWUubWFwKHYgPT4gZGVzY3JpYmVSZXNvbHZlZFR5cGUodiwgbWF4RGVwdGggLSAxKSkuam9pbignLCAnKX1dYDtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIER5bmFtaWNWYWx1ZSkge1xuICAgIHJldHVybiAnKG5vdCBzdGF0aWNhbGx5IGFuYWx5emFibGUpJztcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEtub3duRm4pIHtcbiAgICByZXR1cm4gJ0Z1bmN0aW9uJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJ3Vua25vd24nO1xuICB9XG59XG5cbmZ1bmN0aW9uIHF1b3RlS2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKC9eW2EtejAtOV9dKyQvaS50ZXN0KGtleSkpIHtcbiAgICByZXR1cm4ga2V5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBgJyR7a2V5LnJlcGxhY2UoLycvZywgJ1xcXFxcXCcnKX0nYDtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgcmVsYXRlZCBpbmZvcm1hdGlvbiBkaWFnbm9zdGljcyBmb3IgYSBgRHluYW1pY1ZhbHVlYCB0aGF0IGRlc2NyaWJlIHRoZSB0cmFjZVxuICogb2Ygd2h5IGFuIGV4cHJlc3Npb24gd2FzIGV2YWx1YXRlZCBhcyBkeW5hbWljLlxuICpcbiAqIEBwYXJhbSBub2RlIFRoZSBub2RlIGZvciB3aGljaCBhIGB0cy5EaWFnbm9zdGljYCBpcyB0byBiZSBjcmVhdGVkIHdpdGggdGhlIHRyYWNlLlxuICogQHBhcmFtIHZhbHVlIFRoZSBkeW5hbWljIHZhbHVlIGZvciB3aGljaCBhIHRyYWNlIHNob3VsZCBiZSBjcmVhdGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhY2VEeW5hbWljVmFsdWUoXG4gICAgbm9kZTogdHMuTm9kZSwgdmFsdWU6IER5bmFtaWNWYWx1ZSk6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXSB7XG4gIHJldHVybiB2YWx1ZS5hY2NlcHQobmV3IFRyYWNlRHluYW1pY1ZhbHVlVmlzaXRvcihub2RlKSk7XG59XG5cbmNsYXNzIFRyYWNlRHluYW1pY1ZhbHVlVmlzaXRvciBpbXBsZW1lbnRzIER5bmFtaWNWYWx1ZVZpc2l0b3I8dHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbltdPiB7XG4gIHByaXZhdGUgY3VycmVudENvbnRhaW5lck5vZGU6IHRzLk5vZGV8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBub2RlOiB0cy5Ob2RlKSB7fVxuXG4gIHZpc2l0RHluYW1pY0lucHV0KHZhbHVlOiBEeW5hbWljVmFsdWU8RHluYW1pY1ZhbHVlPik6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXSB7XG4gICAgY29uc3QgdHJhY2UgPSB2YWx1ZS5yZWFzb24uYWNjZXB0KHRoaXMpO1xuICAgIGlmICh0aGlzLnNob3VsZFRyYWNlKHZhbHVlLm5vZGUpKSB7XG4gICAgICBjb25zdCBpbmZvID1cbiAgICAgICAgICBtYWtlUmVsYXRlZEluZm9ybWF0aW9uKHZhbHVlLm5vZGUsICdVbmFibGUgdG8gZXZhbHVhdGUgdGhpcyBleHByZXNzaW9uIHN0YXRpY2FsbHkuJyk7XG4gICAgICB0cmFjZS51bnNoaWZ0KGluZm8pO1xuICAgIH1cbiAgICByZXR1cm4gdHJhY2U7XG4gIH1cblxuICB2aXNpdER5bmFtaWNTdHJpbmcodmFsdWU6IER5bmFtaWNWYWx1ZSk6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXSB7XG4gICAgcmV0dXJuIFttYWtlUmVsYXRlZEluZm9ybWF0aW9uKFxuICAgICAgICB2YWx1ZS5ub2RlLCAnQSBzdHJpbmcgdmFsdWUgY291bGQgbm90IGJlIGRldGVybWluZWQgc3RhdGljYWxseS4nKV07XG4gIH1cblxuICB2aXNpdEV4dGVybmFsUmVmZXJlbmNlKHZhbHVlOiBEeW5hbWljVmFsdWU8UmVmZXJlbmNlPHRzLkRlY2xhcmF0aW9uPj4pOlxuICAgICAgdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbltdIHtcbiAgICBjb25zdCBuYW1lID0gdmFsdWUucmVhc29uLmRlYnVnTmFtZTtcbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IG5hbWUgIT09IG51bGwgPyBgJyR7bmFtZX0nYCA6ICdhbiBhbm9ueW1vdXMgZGVjbGFyYXRpb24nO1xuICAgIHJldHVybiBbbWFrZVJlbGF0ZWRJbmZvcm1hdGlvbihcbiAgICAgICAgdmFsdWUubm9kZSxcbiAgICAgICAgYEEgdmFsdWUgZm9yICR7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbn0gY2Fubm90IGJlIGRldGVybWluZWQgc3RhdGljYWxseSwgYXMgaXQgaXMgYW4gZXh0ZXJuYWwgZGVjbGFyYXRpb24uYCldO1xuICB9XG5cbiAgdmlzaXRDb21wbGV4RnVuY3Rpb25DYWxsKHZhbHVlOiBEeW5hbWljVmFsdWU8RnVuY3Rpb25EZWZpbml0aW9uPik6XG4gICAgICB0cy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uW10ge1xuICAgIHJldHVybiBbXG4gICAgICBtYWtlUmVsYXRlZEluZm9ybWF0aW9uKFxuICAgICAgICAgIHZhbHVlLm5vZGUsXG4gICAgICAgICAgJ1VuYWJsZSB0byBldmFsdWF0ZSBmdW5jdGlvbiBjYWxsIG9mIGNvbXBsZXggZnVuY3Rpb24uIEEgZnVuY3Rpb24gbXVzdCBoYXZlIGV4YWN0bHkgb25lIHJldHVybiBzdGF0ZW1lbnQuJyksXG4gICAgICBtYWtlUmVsYXRlZEluZm9ybWF0aW9uKHZhbHVlLnJlYXNvbi5ub2RlLCAnRnVuY3Rpb24gaXMgZGVjbGFyZWQgaGVyZS4nKVxuICAgIF07XG4gIH1cblxuICB2aXNpdEludmFsaWRFeHByZXNzaW9uVHlwZSh2YWx1ZTogRHluYW1pY1ZhbHVlKTogdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbltdIHtcbiAgICByZXR1cm4gW21ha2VSZWxhdGVkSW5mb3JtYXRpb24odmFsdWUubm9kZSwgJ1VuYWJsZSB0byBldmFsdWF0ZSBhbiBpbnZhbGlkIGV4cHJlc3Npb24uJyldO1xuICB9XG5cbiAgdmlzaXRVbmtub3duKHZhbHVlOiBEeW5hbWljVmFsdWUpOiB0cy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uW10ge1xuICAgIHJldHVybiBbbWFrZVJlbGF0ZWRJbmZvcm1hdGlvbih2YWx1ZS5ub2RlLCAnVW5hYmxlIHRvIGV2YWx1YXRlIHN0YXRpY2FsbHkuJyldO1xuICB9XG5cbiAgdmlzaXRVbmtub3duSWRlbnRpZmllcih2YWx1ZTogRHluYW1pY1ZhbHVlKTogdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbltdIHtcbiAgICByZXR1cm4gW21ha2VSZWxhdGVkSW5mb3JtYXRpb24odmFsdWUubm9kZSwgJ1Vua25vd24gcmVmZXJlbmNlLicpXTtcbiAgfVxuXG4gIHZpc2l0RHluYW1pY1R5cGUodmFsdWU6IER5bmFtaWNWYWx1ZSk6IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb25bXSB7XG4gICAgcmV0dXJuIFttYWtlUmVsYXRlZEluZm9ybWF0aW9uKHZhbHVlLm5vZGUsICdEeW5hbWljIHR5cGUuJyldO1xuICB9XG5cbiAgdmlzaXRVbnN1cHBvcnRlZFN5bnRheCh2YWx1ZTogRHluYW1pY1ZhbHVlKTogdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbltdIHtcbiAgICByZXR1cm4gW21ha2VSZWxhdGVkSW5mb3JtYXRpb24odmFsdWUubm9kZSwgJ1RoaXMgc3ludGF4IGlzIG5vdCBzdXBwb3J0ZWQuJyldO1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgd2hldGhlciB0aGUgZHluYW1pYyB2YWx1ZSByZXBvcnRlZCBmb3IgdGhlIG5vZGUgc2hvdWxkIGJlIHRyYWNlZCwgaS5lLiBpZiBpdCBpcyBub3RcbiAgICogcGFydCBvZiB0aGUgY29udGFpbmVyIGZvciB3aGljaCB0aGUgbW9zdCByZWNlbnQgdHJhY2Ugd2FzIGNyZWF0ZWQuXG4gICAqL1xuICBwcml2YXRlIHNob3VsZFRyYWNlKG5vZGU6IHRzLk5vZGUpOiBib29sZWFuIHtcbiAgICBpZiAobm9kZSA9PT0gdGhpcy5ub2RlKSB7XG4gICAgICAvLyBEbyBub3QgaW5jbHVkZSBhIGR5bmFtaWMgdmFsdWUgZm9yIHRoZSBvcmlnaW4gbm9kZSwgYXMgdGhlIG1haW4gZGlhZ25vc3RpYyBpcyBhbHJlYWR5XG4gICAgICAvLyByZXBvcnRlZCBvbiB0aGF0IG5vZGUuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGFpbmVyID0gZ2V0Q29udGFpbmVyTm9kZShub2RlKTtcbiAgICBpZiAoY29udGFpbmVyID09PSB0aGlzLmN1cnJlbnRDb250YWluZXJOb2RlKSB7XG4gICAgICAvLyBUaGUgbm9kZSBpcyBwYXJ0IG9mIHRoZSBzYW1lIGNvbnRhaW5lciBhcyB0aGUgcHJldmlvdXMgdHJhY2UgZW50cnksIHNvIHRoaXMgZHluYW1pYyB2YWx1ZVxuICAgICAgLy8gc2hvdWxkIG5vdCBiZWNvbWUgcGFydCBvZiB0aGUgdHJhY2UuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50Q29udGFpbmVyTm9kZSA9IGNvbnRhaW5lcjtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG4vKipcbiAqIERldGVybWluZXMgdGhlIGNsb3Nlc3QgcGFyZW50IG5vZGUgdGhhdCBpcyB0byBiZSBjb25zaWRlcmVkIGFzIGNvbnRhaW5lciwgd2hpY2ggaXMgdXNlZCB0byByZWR1Y2VcbiAqIHRoZSBncmFudWxhcml0eSBvZiB0cmFjaW5nIHRoZSBkeW5hbWljIHZhbHVlcyB0byBhIHNpbmdsZSBlbnRyeSBwZXIgY29udGFpbmVyLiBDdXJyZW50bHksIGZ1bGxcbiAqIHN0YXRlbWVudHMgYW5kIGRlc3RydWN0dXJpbmcgcGF0dGVybnMgYXJlIGNvbnNpZGVyZWQgYXMgY29udGFpbmVyLlxuICovXG5mdW5jdGlvbiBnZXRDb250YWluZXJOb2RlKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlIHtcbiAgbGV0IGN1cnJlbnROb2RlOiB0cy5Ob2RlfHVuZGVmaW5lZCA9IG5vZGU7XG4gIHdoaWxlIChjdXJyZW50Tm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc3dpdGNoIChjdXJyZW50Tm9kZS5raW5kKSB7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRXhwcmVzc2lvblN0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5WYXJpYWJsZVN0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5SZXR1cm5TdGF0ZW1lbnQ6XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuSWZTdGF0ZW1lbnQ6XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuU3dpdGNoU3RhdGVtZW50OlxuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkRvU3RhdGVtZW50OlxuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLldoaWxlU3RhdGVtZW50OlxuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkZvclN0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Gb3JJblN0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Gb3JPZlN0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5Db250aW51ZVN0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5CcmVha1N0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5UaHJvd1N0YXRlbWVudDpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5PYmplY3RCaW5kaW5nUGF0dGVybjpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5BcnJheUJpbmRpbmdQYXR0ZXJuOlxuICAgICAgICByZXR1cm4gY3VycmVudE5vZGU7XG4gICAgfVxuXG4gICAgY3VycmVudE5vZGUgPSBjdXJyZW50Tm9kZS5wYXJlbnQ7XG4gIH1cbiAgcmV0dXJuIG5vZGUuZ2V0U291cmNlRmlsZSgpO1xufVxuIl19