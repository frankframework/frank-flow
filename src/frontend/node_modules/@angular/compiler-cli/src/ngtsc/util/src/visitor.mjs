/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
/**
 * Visit a node with the given visitor and return a transformed copy.
 */
export function visit(node, visitor, context) {
    return visitor._visit(node, context);
}
/**
 * Abstract base class for visitors, which processes certain nodes specially to allow insertion
 * of other nodes before them.
 */
export class Visitor {
    constructor() {
        /**
         * Maps statements to an array of statements that should be inserted before them.
         */
        this._before = new Map();
        /**
         * Maps statements to an array of statements that should be inserted after them.
         */
        this._after = new Map();
    }
    /**
     * Visit a class declaration, returning at least the transformed declaration and optionally other
     * nodes to insert before the declaration.
     */
    visitClassDeclaration(node) {
        return { node };
    }
    _visitListEntryNode(node, visitor) {
        const result = visitor(node);
        if (result.before !== undefined) {
            // Record that some nodes should be inserted before the given declaration. The declaration's
            // parent's _visit call is responsible for performing this insertion.
            this._before.set(result.node, result.before);
        }
        if (result.after !== undefined) {
            // Same with nodes that should be inserted after.
            this._after.set(result.node, result.after);
        }
        return result.node;
    }
    /**
     * Visit types of nodes which don't have their own explicit visitor.
     */
    visitOtherNode(node) {
        return node;
    }
    /**
     * @internal
     */
    _visit(node, context) {
        // First, visit the node. visitedNode starts off as `null` but should be set after visiting
        // is completed.
        let visitedNode = null;
        node = ts.visitEachChild(node, child => this._visit(child, context), context);
        if (ts.isClassDeclaration(node)) {
            visitedNode =
                this._visitListEntryNode(node, (node) => this.visitClassDeclaration(node));
        }
        else {
            visitedNode = this.visitOtherNode(node);
        }
        // If the visited node has a `statements` array then process them, maybe replacing the visited
        // node and adding additional statements.
        if (hasStatements(visitedNode)) {
            visitedNode = this._maybeProcessStatements(visitedNode);
        }
        return visitedNode;
    }
    _maybeProcessStatements(node) {
        // Shortcut - if every statement doesn't require nodes to be prepended or appended,
        // this is a no-op.
        if (node.statements.every(stmt => !this._before.has(stmt) && !this._after.has(stmt))) {
            return node;
        }
        // There are statements to prepend, so clone the original node.
        const clone = ts.getMutableClone(node);
        // Build a new list of statements and patch it onto the clone.
        const newStatements = [];
        clone.statements.forEach(stmt => {
            if (this._before.has(stmt)) {
                newStatements.push(...this._before.get(stmt));
                this._before.delete(stmt);
            }
            newStatements.push(stmt);
            if (this._after.has(stmt)) {
                newStatements.push(...this._after.get(stmt));
                this._after.delete(stmt);
            }
        });
        clone.statements = ts.createNodeArray(newStatements, node.statements.hasTrailingComma);
        return clone;
    }
}
function hasStatements(node) {
    const block = node;
    return block.statements !== undefined && Array.isArray(block.statements);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlzaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdXRpbC9zcmMvdmlzaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQVlqQzs7R0FFRztBQUNILE1BQU0sVUFBVSxLQUFLLENBQ2pCLElBQU8sRUFBRSxPQUFnQixFQUFFLE9BQWlDO0lBQzlELE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdkMsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sT0FBZ0IsT0FBTztJQUE3QjtRQUNFOztXQUVHO1FBQ0ssWUFBTyxHQUFHLElBQUksR0FBRyxFQUEyQixDQUFDO1FBRXJEOztXQUVHO1FBQ0ssV0FBTSxHQUFHLElBQUksR0FBRyxFQUEyQixDQUFDO0lBdUZ0RCxDQUFDO0lBckZDOzs7T0FHRztJQUNILHFCQUFxQixDQUFDLElBQXlCO1FBRTdDLE9BQU8sRUFBQyxJQUFJLEVBQUMsQ0FBQztJQUNoQixDQUFDO0lBRU8sbUJBQW1CLENBQ3ZCLElBQU8sRUFBRSxPQUEyRDtRQUN0RSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0IsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtZQUMvQiw0RkFBNEY7WUFDNUYscUVBQXFFO1lBQ3JFLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQzlDO1FBQ0QsSUFBSSxNQUFNLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUM5QixpREFBaUQ7WUFDakQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxD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QUM7SUFDekMsT0FBTyxLQUFLLENBQUMsVUFBVSxLQUFLLFNBQVMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMzRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG4vKipcbiAqIFJlc3VsdCB0eXBlIG9mIHZpc2l0aW5nIGEgbm9kZSB0aGF0J3MgdHlwaWNhbGx5IGFuIGVudHJ5IGluIGEgbGlzdCwgd2hpY2ggYWxsb3dzIHNwZWNpZnlpbmcgdGhhdFxuICogbm9kZXMgc2hvdWxkIGJlIGFkZGVkIGJlZm9yZSB0aGUgdmlzaXRlZCBub2RlIGluIHRoZSBvdXRwdXQuXG4gKi9cbmV4cG9ydCB0eXBlIFZpc2l0TGlzdEVudHJ5UmVzdWx0PEIgZXh0ZW5kcyB0cy5Ob2RlLCBUIGV4dGVuZHMgQj4gPSB7XG4gIG5vZGU6IFQsXG4gIGJlZm9yZT86IEJbXSxcbiAgYWZ0ZXI/OiBCW10sXG59O1xuXG4vKipcbiAqIFZpc2l0IGEgbm9kZSB3aXRoIHRoZSBnaXZlbiB2aXNpdG9yIGFuZCByZXR1cm4gYSB0cmFuc2Zvcm1lZCBjb3B5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmlzaXQ8VCBleHRlbmRzIHRzLk5vZGU+KFxuICAgIG5vZGU6IFQsIHZpc2l0b3I6IFZpc2l0b3IsIGNvbnRleHQ6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCk6IFQge1xuICByZXR1cm4gdmlzaXRvci5fdmlzaXQobm9kZSwgY29udGV4dCk7XG59XG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgdmlzaXRvcnMsIHdoaWNoIHByb2Nlc3NlcyBjZXJ0YWluIG5vZGVzIHNwZWNpYWxseSB0byBhbGxvdyBpbnNlcnRpb25cbiAqIG9mIG90aGVyIG5vZGVzIGJlZm9yZSB0aGVtLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVmlzaXRvciB7XG4gIC8qKlxuICAgKiBNYXBzIHN0YXRlbWVudHMgdG8gYW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IHNob3VsZCBiZSBpbnNlcnRlZCBiZWZvcmUgdGhlbS5cbiAgICovXG4gIHByaXZhdGUgX2JlZm9yZSA9IG5ldyBNYXA8dHMuTm9kZSwgdHMuU3RhdGVtZW50W10+KCk7XG5cbiAgLyoqXG4gICAqIE1hcHMgc3RhdGVtZW50cyB0byBhbiBhcnJheSBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGluc2VydGVkIGFmdGVyIHRoZW0uXG4gICAqL1xuICBwcml2YXRlIF9hZnRlciA9IG5ldyBNYXA8dHMuTm9kZSwgdHMuU3RhdGVtZW50W10+KCk7XG5cbiAgLyoqXG4gICAqIFZpc2l0IGEgY2xhc3MgZGVjbGFyYXRpb24sIHJldHVybmluZyBhdCBsZWFzdCB0aGUgdHJhbnNmb3JtZWQgZGVjbGFyYXRpb24gYW5kIG9wdGlvbmFsbHkgb3RoZXJcbiAgICogbm9kZXMgdG8gaW5zZXJ0IGJlZm9yZSB0aGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICB2aXNpdENsYXNzRGVjbGFyYXRpb24obm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbik6XG4gICAgICBWaXNpdExpc3RFbnRyeVJlc3VsdDx0cy5TdGF0ZW1lbnQsIHRzLkNsYXNzRGVjbGFyYXRpb24+IHtcbiAgICByZXR1cm4ge25vZGV9O1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRMaXN0RW50cnlOb2RlPFQgZXh0ZW5kcyB0cy5TdGF0ZW1lbnQ+KFxuICAgICAgbm9kZTogVCwgdmlzaXRvcjogKG5vZGU6IFQpID0+IFZpc2l0TGlzdEVudHJ5UmVzdWx0PHRzLlN0YXRlbWVudCwgVD4pOiBUIHtcbiAgICBjb25zdCByZXN1bHQgPSB2aXNpdG9yKG5vZGUpO1xuICAgIGlmIChyZXN1bHQuYmVmb3JlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFJlY29yZCB0aGF0IHNvbWUgbm9kZXMgc2hvdWxkIGJlIGluc2VydGVkIGJlZm9yZSB0aGUgZ2l2ZW4gZGVjbGFyYXRpb24uIFRoZSBkZWNsYXJhdGlvbidzXG4gICAgICAvLyBwYXJlbnQncyBfdmlzaXQgY2FsbCBpcyByZXNwb25zaWJsZSBmb3IgcGVyZm9ybWluZyB0aGlzIGluc2VydGlvbi5cbiAgICAgIHRoaXMuX2JlZm9yZS5zZXQocmVzdWx0Lm5vZGUsIHJlc3VsdC5iZWZvcmUpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LmFmdGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFNhbWUgd2l0aCBub2RlcyB0aGF0IHNob3VsZCBiZSBpbnNlcnRlZCBhZnRlci5cbiAgICAgIHRoaXMuX2FmdGVyLnNldChyZXN1bHQubm9kZSwgcmVzdWx0LmFmdGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdC5ub2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIFZpc2l0IHR5cGVzIG9mIG5vZGVzIHdoaWNoIGRvbid0IGhhdmUgdGhlaXIgb3duIGV4cGxpY2l0IHZpc2l0b3IuXG4gICAqL1xuICB2aXNpdE90aGVyTm9kZTxUIGV4dGVuZHMgdHMuTm9kZT4obm9kZTogVCk6IFQge1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgX3Zpc2l0PFQgZXh0ZW5kcyB0cy5Ob2RlPihub2RlOiBULCBjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpOiBUIHtcbiAgICAvLyBGaXJzdCwgdmlzaXQgdGhlIG5vZGUuIHZpc2l0ZWROb2RlIHN0YXJ0cyBvZmYgYXMgYG51bGxgIGJ1dCBzaG91bGQgYmUgc2V0IGFmdGVyIHZpc2l0aW5nXG4gICAgLy8gaXMgY29tcGxldGVkLlxuICAgIGxldCB2aXNpdGVkTm9kZTogVHxudWxsID0gbnVsbDtcblxuICAgIG5vZGUgPSB0cy52aXNpdEVhY2hDaGlsZChub2RlLCBjaGlsZCA9PiB0aGlzLl92aXNpdChjaGlsZCwgY29udGV4dCksIGNvbnRleHQpIGFzIFQ7XG5cbiAgICBpZiAodHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICB2aXNpdGVkTm9kZSA9XG4gICAgICAgICAgdGhpcy5fdmlzaXRMaXN0RW50cnlOb2RlKFxuICAgICAgICAgICAgICBub2RlLCAobm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbikgPT4gdGhpcy52aXNpdENsYXNzRGVjbGFyYXRpb24obm9kZSkpIGFzIHR5cGVvZiBub2RlO1xuICAgIH0gZWxzZSB7XG4gICAgICB2aXNpdGVkTm9kZSA9IHRoaXMudmlzaXRPdGhlck5vZGUobm9kZSk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHZpc2l0ZWQgbm9kZSBoYXMgYSBgc3RhdGVtZW50c2AgYXJyYXkgdGhlbiBwcm9jZXNzIHRoZW0sIG1heWJlIHJlcGxhY2luZyB0aGUgdmlzaXRlZFxuICAgIC8vIG5vZGUgYW5kIGFkZGluZyBhZGRpdGlvbmFsIHN0YXRlbWVudHMuXG4gICAgaWYgKGhhc1N0YXRlbWVudHModmlzaXRlZE5vZGUpKSB7XG4gICAgICB2aXNpdGVkTm9kZSA9IHRoaXMuX21heWJlUHJvY2Vzc1N0YXRlbWVudHModmlzaXRlZE5vZGUpO1xuICAgIH1cblxuICAgIHJldHVybiB2aXNpdGVkTm9kZTtcbiAgfVxuXG4gIHByaXZhdGUgX21heWJlUHJvY2Vzc1N0YXRlbWVudHM8VCBleHRlbmRzIHRzLk5vZGUme3N0YXRlbWVudHM6IHRzLk5vZGVBcnJheTx0cy5TdGF0ZW1lbnQ+fT4oXG4gICAgICBub2RlOiBUKTogVCB7XG4gICAgLy8gU2hvcnRjdXQgLSBpZiBldmVyeSBzdGF0ZW1lbnQgZG9lc24ndCByZXF1aXJlIG5vZGVzIHRvIGJlIHByZXBlbmRlZCBvciBhcHBlbmRlZCxcbiAgICAvLyB0aGlzIGlzIGEgbm8tb3AuXG4gICAgaWYgKG5vZGUuc3RhdGVtZW50cy5ldmVyeShzdG10ID0+ICF0aGlzLl9iZWZvcmUuaGFzKHN0bXQpICYmICF0aGlzLl9hZnRlci5oYXMoc3RtdCkpKSB7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICAvLyBUaGVyZSBhcmUgc3RhdGVtZW50cyB0byBwcmVwZW5kLCBzbyBjbG9uZSB0aGUgb3JpZ2luYWwgbm9kZS5cbiAgICBjb25zdCBjbG9uZSA9IHRzLmdldE11dGFibGVDbG9uZShub2RlKTtcblxuICAgIC8vIEJ1aWxkIGEgbmV3IGxpc3Qgb2Ygc3RhdGVtZW50cyBhbmQgcGF0Y2ggaXQgb250byB0aGUgY2xvbmUuXG4gICAgY29uc3QgbmV3U3RhdGVtZW50czogdHMuU3RhdGVtZW50W10gPSBbXTtcbiAgICBjbG9uZS5zdGF0ZW1lbnRzLmZvckVhY2goc3RtdCA9PiB7XG4gICAgICBpZiAodGhpcy5fYmVmb3JlLmhhcyhzdG10KSkge1xuICAgICAgICBuZXdTdGF0ZW1lbnRzLnB1c2goLi4uKHRoaXMuX2JlZm9yZS5nZXQoc3RtdCkhIGFzIHRzLlN0YXRlbWVudFtdKSk7XG4gICAgICAgIHRoaXMuX2JlZm9yZS5kZWxldGUoc3RtdCk7XG4gICAgICB9XG4gICAgICBuZXdTdGF0ZW1lbnRzLnB1c2goc3RtdCk7XG4gICAgICBpZiAodGhpcy5fYWZ0ZXIuaGFzKHN0bXQpKSB7XG4gICAgICAgIG5ld1N0YXRlbWVudHMucHVzaCguLi4odGhpcy5fYWZ0ZXIuZ2V0KHN0bXQpISBhcyB0cy5TdGF0ZW1lbnRbXSkpO1xuICAgICAgICB0aGlzLl9hZnRlci5kZWxldGUoc3RtdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgY2xvbmUuc3RhdGVtZW50cyA9IHRzLmNyZWF0ZU5vZGVBcnJheShuZXdTdGF0ZW1lbnRzLCBub2RlLnN0YXRlbWVudHMuaGFzVHJhaWxpbmdDb21tYSk7XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhc1N0YXRlbWVudHMobm9kZTogdHMuTm9kZSk6IG5vZGUgaXMgdHMuTm9kZSZ7c3RhdGVtZW50czogdHMuTm9kZUFycmF5PHRzLlN0YXRlbWVudD59IHtcbiAgY29uc3QgYmxvY2sgPSBub2RlIGFzIHtzdGF0ZW1lbnRzPzogYW55fTtcbiAgcmV0dXJuIGJsb2NrLnN0YXRlbWVudHMgIT09IHVuZGVmaW5lZCAmJiBBcnJheS5pc0FycmF5KGJsb2NrLnN0YXRlbWVudHMpO1xufVxuIl19