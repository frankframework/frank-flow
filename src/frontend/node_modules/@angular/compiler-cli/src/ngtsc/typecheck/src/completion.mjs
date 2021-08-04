/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { TmplAstReference } from '@angular/compiler';
import { EmptyExpr, MethodCall, PropertyRead, PropertyWrite, SafeMethodCall, SafePropertyRead } from '@angular/compiler/src/compiler';
import * as ts from 'typescript';
import { CompletionKind } from '../api';
import { ExpressionIdentifier, findFirstMatchingNode } from './comments';
/**
 * Powers autocompletion for a specific component.
 *
 * Internally caches autocompletion results, and must be discarded if the component template or
 * surrounding TS program have changed.
 */
export class CompletionEngine {
    constructor(tcb, data, shimPath) {
        this.tcb = tcb;
        this.data = data;
        this.shimPath = shimPath;
        /**
         * Cache of completions for various levels of the template, including the root template (`null`).
         * Memoizes `getTemplateContextCompletions`.
         */
        this.templateContextCache = new Map();
        this.expressionCompletionCache = new Map();
        // Find the component completion expression within the TCB. This looks like: `ctx. /* ... */;`
        const globalRead = findFirstMatchingNode(this.tcb, {
            filter: ts.isPropertyAccessExpression,
            withExpressionIdentifier: ExpressionIdentifier.COMPONENT_COMPLETION
        });
        if (globalRead !== null) {
            this.componentContext = {
                shimPath: this.shimPath,
                // `globalRead.name` is an empty `ts.Identifier`, so its start position immediately follows
                // the `.` in `ctx.`. TS autocompletion APIs can then be used to access completion results
                // for the component context.
                positionInShimFile: globalRead.name.getStart(),
            };
        }
        else {
            this.componentContext = null;
        }
    }
    /**
     * Get global completions within the given template context and AST node.
     *
     * @param context the given template context - either a `TmplAstTemplate` embedded view, or `null`
     *     for the root
     * template context.
     * @param node the given AST node
     */
    getGlobalCompletions(context, node) {
        if (this.componentContext === null) {
            return null;
        }
        const templateContext = this.getTemplateContextCompletions(context);
        if (templateContext === null) {
            return null;
        }
        let nodeContext = null;
        if (node instanceof EmptyExpr) {
            const nodeLocation = findFirstMatchingNode(this.tcb, {
                filter: ts.isIdentifier,
                withSpan: node.sourceSpan,
            });
            if (nodeLocation !== null) {
                nodeContext = {
                    shimPath: this.shimPath,
                    positionInShimFile: nodeLocation.getStart(),
                };
            }
        }
        return {
            componentContext: this.componentContext,
            templateContext,
            nodeContext,
        };
    }
    getExpressionCompletionLocation(expr) {
        if (this.expressionCompletionCache.has(expr)) {
            return this.expressionCompletionCache.get(expr);
        }
        // Completion works inside property reads and method calls.
        let tsExpr = null;
        if (expr instanceof PropertyRead || expr instanceof MethodCall ||
            expr instanceof PropertyWrite) {
            // Non-safe navigation operations are trivial: `foo.bar` or `foo.bar()`
            tsExpr = findFirstMatchingNode(this.tcb, {
                filter: ts.isPropertyAccessExpression,
                withSpan: expr.nameSpan,
            });
        }
        else if (expr instanceof SafePropertyRead || expr instanceof SafeMethodCall) {
            // Safe navigation operations are a little more complex, and involve a ternary. Completion
            // happens in the "true" case of the ternary.
            const ternaryExpr = findFirstMatchingNode(this.tcb, {
                filter: ts.isParenthesizedExpression,
                withSpan: expr.sourceSpan,
            });
            if (ternaryExpr === null || !ts.isConditionalExpression(ternaryExpr.expression)) {
                return null;
            }
            const whenTrue = ternaryExpr.expression.whenTrue;
            if (expr instanceof SafePropertyRead && ts.isPropertyAccessExpression(whenTrue)) {
                tsExpr = whenTrue;
            }
            else if (expr instanceof SafeMethodCall && ts.isCallExpression(whenTrue) &&
                ts.isPropertyAccessExpression(whenTrue.expression)) {
                tsExpr = whenTrue.expression;
            }
        }
        if (tsExpr === null) {
            return null;
        }
        const res = {
            shimPath: this.shimPath,
            positionInShimFile: tsExpr.name.getEnd(),
        };
        this.expressionCompletionCache.set(expr, res);
        return res;
    }
    /**
     * Get global completions within the given template context - either a `TmplAstTemplate` embedded
     * view, or `null` for the root context.
     */
    getTemplateContextCompletions(context) {
        if (this.templateContextCache.has(context)) {
            return this.templateContextCache.get(context);
        }
        const templateContext = new Map();
        // The bound template already has details about the references and variables in scope in the
        // `context` template - they just need to be converted to `Completion`s.
        for (const node of this.data.boundTarget.getEntitiesInTemplateScope(context)) {
            if (node instanceof TmplAstReference) {
                templateContext.set(node.name, {
                    kind: CompletionKind.Reference,
                    node,
                });
            }
            else {
                templateContext.set(node.name, {
                    kind: CompletionKind.Variable,
                    node,
                });
            }
        }
        this.templateContextCache.set(context, templateContext);
        return templateContext;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGxldGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9jb21wbGV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxnQkFBZ0IsRUFBa0IsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRSxPQUFPLEVBQU0sU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBYyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3RKLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBR2pDLE9BQU8sRUFBQyxjQUFjLEVBQTBFLE1BQU0sUUFBUSxDQUFDO0FBRS9HLE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxxQkFBcUIsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUd2RTs7Ozs7R0FLRztBQUNILE1BQU0sT0FBTyxnQkFBZ0I7SUFjM0IsWUFBb0IsR0FBWSxFQUFVLElBQWtCLEVBQVUsUUFBd0I7UUFBMUUsUUFBRyxHQUFILEdBQUcsQ0FBUztRQUFVLFNBQUksR0FBSixJQUFJLENBQWM7UUFBVSxhQUFRLEdBQVIsUUFBUSxDQUFnQjtRQVg5Rjs7O1dBR0c7UUFDSyx5QkFBb0IsR0FDeEIsSUFBSSxHQUFHLEVBQTZFLENBQUM7UUFFakYsOEJBQXlCLEdBQzdCLElBQUksR0FBRyxFQUF5RSxDQUFDO1FBSW5GLDhGQUE4RjtRQUM5RixNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ2pELE1BQU0sRUFBRSxFQUFFLENBQUMsMEJBQTBCO1lBQ3JDLHdCQUF3QixFQUFFLG9CQUFvQixDQUFDLG9CQUFvQjtTQUNwRSxDQUFDLENBQUM7UUFFSCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDdkIsSUFB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YyxDQUFDLFFBQVE7b0JBQzdCLElBQUk7aUJBQ0wsQ0FBQyxDQUFDO2FBQ0o7U0FDRjtRQUVELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ3hELE9BQU8sZUFBZSxDQUFDO0lBQ3pCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1RtcGxBc3RSZWZlcmVuY2UsIFRtcGxBc3RUZW1wbGF0ZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtBU1QsIEVtcHR5RXhwciwgTWV0aG9kQ2FsbCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBTYWZlTWV0aG9kQ2FsbCwgU2FmZVByb3BlcnR5UmVhZCwgVG1wbEFzdE5vZGV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyL3NyYy9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aH0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtDb21wbGV0aW9uS2luZCwgR2xvYmFsQ29tcGxldGlvbiwgUmVmZXJlbmNlQ29tcGxldGlvbiwgU2hpbUxvY2F0aW9uLCBWYXJpYWJsZUNvbXBsZXRpb259IGZyb20gJy4uL2FwaSc7XG5cbmltcG9ydCB7RXhwcmVzc2lvbklkZW50aWZpZXIsIGZpbmRGaXJzdE1hdGNoaW5nTm9kZX0gZnJvbSAnLi9jb21tZW50cyc7XG5pbXBvcnQge1RlbXBsYXRlRGF0YX0gZnJvbSAnLi9jb250ZXh0JztcblxuLyoqXG4gKiBQb3dlcnMgYXV0b2NvbXBsZXRpb24gZm9yIGEgc3BlY2lmaWMgY29tcG9uZW50LlxuICpcbiAqIEludGVybmFsbHkgY2FjaGVzIGF1dG9jb21wbGV0aW9uIHJlc3VsdHMsIGFuZCBtdXN0IGJlIGRpc2NhcmRlZCBpZiB0aGUgY29tcG9uZW50IHRlbXBsYXRlIG9yXG4gKiBzdXJyb3VuZGluZyBUUyBwcm9ncmFtIGhhdmUgY2hhbmdlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25FbmdpbmUge1xuICBwcml2YXRlIGNvbXBvbmVudENvbnRleHQ6IFNoaW1Mb2NhdGlvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBDYWNoZSBvZiBjb21wbGV0aW9ucyBmb3IgdmFyaW91cyBsZXZlbHMgb2YgdGhlIHRlbXBsYXRlLCBpbmNsdWRpbmcgdGhlIHJvb3QgdGVtcGxhdGUgKGBudWxsYCkuXG4gICAqIE1lbW9pemVzIGBnZXRUZW1wbGF0ZUNvbnRleHRDb21wbGV0aW9uc2AuXG4gICAqL1xuICBwcml2YXRlIHRlbXBsYXRlQ29udGV4dENhY2hlID1cbiAgICAgIG5ldyBNYXA8VG1wbEFzdFRlbXBsYXRlfG51bGwsIE1hcDxzdHJpbmcsIFJlZmVyZW5jZUNvbXBsZXRpb258VmFyaWFibGVDb21wbGV0aW9uPj4oKTtcblxuICBwcml2YXRlIGV4cHJlc3Npb25Db21wbGV0aW9uQ2FjaGUgPVxuICAgICAgbmV3IE1hcDxQcm9wZXJ0eVJlYWR8U2FmZVByb3BlcnR5UmVhZHxNZXRob2RDYWxsfFNhZmVNZXRob2RDYWxsLCBTaGltTG9jYXRpb24+KCk7XG5cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRjYjogdHMuTm9kZSwgcHJpdmF0ZSBkYXRhOiBUZW1wbGF0ZURhdGEsIHByaXZhdGUgc2hpbVBhdGg6IEFic29sdXRlRnNQYXRoKSB7XG4gICAgLy8gRmluZCB0aGUgY29tcG9uZW50IGNvbXBsZXRpb24gZXhwcmVzc2lvbiB3aXRoaW4gdGhlIFRDQi4gVGhpcyBsb29rcyBsaWtlOiBgY3R4LiAvKiAuLi4gKi87YFxuICAgIGNvbnN0IGdsb2JhbFJlYWQgPSBmaW5kRmlyc3RNYXRjaGluZ05vZGUodGhpcy50Y2IsIHtcbiAgICAgIGZpbHRlcjogdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24sXG4gICAgICB3aXRoRXhwcmVzc2lvbklkZW50aWZpZXI6IEV4cHJlc3Npb25JZGVudGlmaWVyLkNPTVBPTkVOVF9DT01QTEVUSU9OXG4gICAgfSk7XG5cbiAgICBpZiAoZ2xvYmFsUmVhZCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5jb21wb25lbnRDb250ZXh0ID0ge1xuICAgICAgICBzaGltUGF0aDogdGhpcy5zaGltUGF0aCxcbiAgICAgICAgLy8gYGdsb2JhbFJlYWQubmFtZWAgaXMgYW4gZW1wdHkgYHRzLklkZW50aWZpZXJgLCBzbyBpdHMgc3RhcnQgcG9zaXRpb24gaW1tZWRpYXRlbHkgZm9sbG93c1xuICAgICAgICAvLyB0aGUgYC5gIGluIGBjdHguYC4gVFMgYXV0b2NvbXBsZXRpb24gQVBJcyBjYW4gdGhlbiBiZSB1c2VkIHRvIGFjY2VzcyBjb21wbGV0aW9uIHJlc3VsdHNcbiAgICAgICAgLy8gZm9yIHRoZSBjb21wb25lbnQgY29udGV4dC5cbiAgICAgICAgcG9zaXRpb25JblNoaW1GaWxlOiBnbG9iYWxSZWFkLm5hbWUuZ2V0U3RhcnQoKSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29tcG9uZW50Q29udGV4dCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBnbG9iYWwgY29tcGxldGlvbnMgd2l0aGluIHRoZSBnaXZlbiB0ZW1wbGF0ZSBjb250ZXh0IGFuZCBBU1Qgbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIGNvbnRleHQgdGhlIGdpdmVuIHRlbXBsYXRlIGNvbnRleHQgLSBlaXRoZXIgYSBgVG1wbEFzdFRlbXBsYXRlYCBlbWJlZGRlZCB2aWV3LCBvciBgbnVsbGBcbiAgICogICAgIGZvciB0aGUgcm9vdFxuICAgKiB0ZW1wbGF0ZSBjb250ZXh0LlxuICAgKiBAcGFyYW0gbm9kZSB0aGUgZ2l2ZW4gQVNUIG5vZGVcbiAgICovXG4gIGdldEdsb2JhbENvbXBsZXRpb25zKGNvbnRleHQ6IFRtcGxBc3RUZW1wbGF0ZXxudWxsLCBub2RlOiBBU1R8VG1wbEFzdE5vZGUpOiBHbG9iYWxDb21wbGV0aW9uXG4gICAgICB8bnVsbCB7XG4gICAgaWYgKHRoaXMuY29tcG9uZW50Q29udGV4dCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcGxhdGVDb250ZXh0ID0gdGhpcy5nZXRUZW1wbGF0ZUNvbnRleHRDb21wbGV0aW9ucyhjb250ZXh0KTtcbiAgICBpZiAodGVtcGxhdGVDb250ZXh0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgbm9kZUNvbnRleHQ6IFNoaW1Mb2NhdGlvbnxudWxsID0gbnVsbDtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEVtcHR5RXhwcikge1xuICAgICAgY29uc3Qgbm9kZUxvY2F0aW9uID0gZmluZEZpcnN0TWF0Y2hpbmdOb2RlKHRoaXMudGNiLCB7XG4gICAgICAgIGZpbHRlcjogdHMuaXNJZGVudGlmaWVyLFxuICAgICAgICB3aXRoU3Bhbjogbm9kZS5zb3VyY2VTcGFuLFxuICAgICAgfSk7XG4gICAgICBpZiAobm9kZUxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgICAgIG5vZGVDb250ZXh0ID0ge1xuICAgICAgICAgIHNoaW1QYXRoOiB0aGlzLnNoaW1QYXRoLFxuICAgICAgICAgIHBvc2l0aW9uSW5TaGltRmlsZTogbm9kZUxvY2F0aW9uLmdldFN0YXJ0KCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbXBvbmVudENvbnRleHQ6IHRoaXMuY29tcG9uZW50Q29udGV4dCxcbiAgICAgIHRlbXBsYXRlQ29udGV4dCxcbiAgICAgIG5vZGVDb250ZXh0LFxuICAgIH07XG4gIH1cblxuICBnZXRFeHByZXNzaW9uQ29tcGxldGlvbkxvY2F0aW9uKGV4cHI6IFByb3BlcnR5UmVhZHxQcm9wZXJ0eVdyaXRlfE1ldGhvZENhbGx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2FmZU1ldGhvZENhbGwpOiBTaGltTG9jYXRpb258bnVsbCB7XG4gICAgaWYgKHRoaXMuZXhwcmVzc2lvbkNvbXBsZXRpb25DYWNoZS5oYXMoZXhwcikpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4cHJlc3Npb25Db21wbGV0aW9uQ2FjaGUuZ2V0KGV4cHIpITtcbiAgICB9XG5cbiAgICAvLyBDb21wbGV0aW9uIHdvcmtzIGluc2lkZSBwcm9wZXJ0eSByZWFkcyBhbmQgbWV0aG9kIGNhbGxzLlxuICAgIGxldCB0c0V4cHI6IHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAoZXhwciBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCB8fCBleHByIGluc3RhbmNlb2YgTWV0aG9kQ2FsbCB8fFxuICAgICAgICBleHByIGluc3RhbmNlb2YgUHJvcGVydHlXcml0ZSkge1xuICAgICAgLy8gTm9uLXNhZmUgbmF2aWdhdGlvbiBvcGVyYXRpb25zIGFyZSB0cml2aWFsOiBgZm9vLmJhcmAgb3IgYGZvby5iYXIoKWBcbiAgICAgIHRzRXhwciA9IGZpbmRGaXJzdE1hdGNoaW5nTm9kZSh0aGlzLnRjYiwge1xuICAgICAgICBmaWx0ZXI6IHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uLFxuICAgICAgICB3aXRoU3BhbjogZXhwci5uYW1lU3BhbixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIFNhZmVQcm9wZXJ0eVJlYWQgfHwgZXhwciBpbnN0YW5jZW9mIFNhZmVNZXRob2RDYWxsKSB7XG4gICAgICAvLyBTYWZlIG5hdmlnYXRpb24gb3BlcmF0aW9ucyBhcmUgYSBsaXR0bGUgbW9yZSBjb21wbGV4LCBhbmQgaW52b2x2ZSBhIHRlcm5hcnkuIENvbXBsZXRpb25cbiAgICAgIC8vIGhhcHBlbnMgaW4gdGhlIFwidHJ1ZVwiIGNhc2Ugb2YgdGhlIHRlcm5hcnkuXG4gICAgICBjb25zdCB0ZXJuYXJ5RXhwciA9IGZpbmRGaXJzdE1hdGNoaW5nTm9kZSh0aGlzLnRjYiwge1xuICAgICAgICBmaWx0ZXI6IHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24sXG4gICAgICAgIHdpdGhTcGFuOiBleHByLnNvdXJjZVNwYW4sXG4gICAgICB9KTtcbiAgICAgIGlmICh0ZXJuYXJ5RXhwciA9PT0gbnVsbCB8fCAhdHMuaXNDb25kaXRpb25hbEV4cHJlc3Npb24odGVybmFyeUV4cHIuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBjb25zdCB3aGVuVHJ1ZSA9IHRlcm5hcnlFeHByLmV4cHJlc3Npb24ud2hlblRydWU7XG5cbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgU2FmZVByb3BlcnR5UmVhZCAmJiB0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbih3aGVuVHJ1ZSkpIHtcbiAgICAgICAgdHNFeHByID0gd2hlblRydWU7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgIGV4cHIgaW5zdGFuY2VvZiBTYWZlTWV0aG9kQ2FsbCAmJiB0cy5pc0NhbGxFeHByZXNzaW9uKHdoZW5UcnVlKSAmJlxuICAgICAgICAgIHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKHdoZW5UcnVlLmV4cHJlc3Npb24pKSB7XG4gICAgICAgIHRzRXhwciA9IHdoZW5UcnVlLmV4cHJlc3Npb247XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRzRXhwciA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzOiBTaGltTG9jYXRpb24gPSB7XG4gICAgICBzaGltUGF0aDogdGhpcy5zaGltUGF0aCxcbiAgICAgIHBvc2l0aW9uSW5TaGltRmlsZTogdHNFeHByLm5hbWUuZ2V0RW5kKCksXG4gICAgfTtcbiAgICB0aGlzLmV4cHJlc3Npb25Db21wbGV0aW9uQ2FjaGUuc2V0KGV4cHIsIHJlcyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgZ2xvYmFsIGNvbXBsZXRpb25zIHdpdGhpbiB0aGUgZ2l2ZW4gdGVtcGxhdGUgY29udGV4dCAtIGVpdGhlciBhIGBUbXBsQXN0VGVtcGxhdGVgIGVtYmVkZGVkXG4gICAqIHZpZXcsIG9yIGBudWxsYCBmb3IgdGhlIHJvb3QgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZ2V0VGVtcGxhdGVDb250ZXh0Q29tcGxldGlvbnMoY29udGV4dDogVG1wbEFzdFRlbXBsYXRlfG51bGwpOlxuICAgICAgTWFwPHN0cmluZywgUmVmZXJlbmNlQ29tcGxldGlvbnxWYXJpYWJsZUNvbXBsZXRpb24+fG51bGwge1xuICAgIGlmICh0aGlzLnRlbXBsYXRlQ29udGV4dENhY2hlLmhhcyhjb250ZXh0KSkge1xuICAgICAgcmV0dXJuIHRoaXMudGVtcGxhdGVDb250ZXh0Q2FjaGUuZ2V0KGNvbnRleHQpITtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUNvbnRleHQgPSBuZXcgTWFwPHN0cmluZywgUmVmZXJlbmNlQ29tcGxldGlvbnxWYXJpYWJsZUNvbXBsZXRpb24+KCk7XG5cbiAgICAvLyBUaGUgYm91bmQgdGVtcGxhdGUgYWxyZWFkeSBoYXMgZGV0YWlscyBhYm91dCB0aGUgcmVmZXJlbmNlcyBhbmQgdmFyaWFibGVzIGluIHNjb3BlIGluIHRoZVxuICAgIC8vIGBjb250ZXh0YCB0ZW1wbGF0ZSAtIHRoZXkganVzdCBuZWVkIHRvIGJlIGNvbnZlcnRlZCB0byBgQ29tcGxldGlvbmBzLlxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiB0aGlzLmRhdGEuYm91bmRUYXJnZXQuZ2V0RW50aXRpZXNJblRlbXBsYXRlU2NvcGUoY29udGV4dCkpIHtcbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdFJlZmVyZW5jZSkge1xuICAgICAgICB0ZW1wbGF0ZUNvbnRleHQuc2V0KG5vZGUubmFtZSwge1xuICAgICAgICAgIGtpbmQ6IENvbXBsZXRpb25LaW5kLlJlZmVyZW5jZSxcbiAgICAgICAgICBub2RlLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXBsYXRlQ29udGV4dC5zZXQobm9kZS5uYW1lLCB7XG4gICAgICAgICAga2luZDogQ29tcGxldGlvbktpbmQuVmFyaWFibGUsXG4gICAgICAgICAgbm9kZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50ZW1wbGF0ZUNvbnRleHRDYWNoZS5zZXQoY29udGV4dCwgdGVtcGxhdGVDb250ZXh0KTtcbiAgICByZXR1cm4gdGVtcGxhdGVDb250ZXh0O1xuICB9XG59XG4iXX0=