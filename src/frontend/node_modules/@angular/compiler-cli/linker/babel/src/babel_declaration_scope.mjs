import * as t from '@babel/types';
/**
 * This class represents the lexical scope of a partial declaration in Babel source code.
 *
 * Its only responsibility is to compute a reference object for the scope of shared constant
 * statements that will be generated during partial linking.
 */
export class BabelDeclarationScope {
    /**
     * Construct a new `BabelDeclarationScope`.
     *
     * @param declarationScope the Babel scope containing the declaration call expression.
     */
    constructor(declarationScope) {
        this.declarationScope = declarationScope;
    }
    /**
     * Compute the Babel `NodePath` that can be used to reference the lexical scope where any
     * shared constant statements would be inserted.
     *
     * There will only be a shared constant scope if the expression is in an ECMAScript module, or a
     * UMD module. Otherwise `null` is returned to indicate that constant statements must be emitted
     * locally to the generated linked definition, to avoid polluting the global scope.
     *
     * @param expression the expression that points to the Angular core framework import.
     */
    getConstantScopeRef(expression) {
        // If the expression is of the form `a.b.c` then we want to get the far LHS (e.g. `a`).
        let bindingExpression = expression;
        while (t.isMemberExpression(bindingExpression)) {
            bindingExpression = bindingExpression.object;
        }
        if (!t.isIdentifier(bindingExpression)) {
            return null;
        }
        // The binding of the expression is where this identifier was declared.
        // This could be a variable declaration, an import namespace or a function parameter.
        const binding = this.declarationScope.getBinding(bindingExpression.name);
        if (binding === undefined) {
            return null;
        }
        // We only support shared constant statements if the binding was in a UMD module (i.e. declared
        // within a `t.Function`) or an ECMASCript module (i.e. declared at the top level of a
        // `t.Program` that is marked as a module).
        const path = binding.scope.path;
        if (!path.isFunctionParent() && !(path.isProgram() && path.node.sourceType === 'module')) {
            return null;
        }
        return path;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFiZWxfZGVjbGFyYXRpb25fc2NvcGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsL3NyYy9iYWJlbF9kZWNsYXJhdGlvbl9zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFRQSxPQUFPLEtBQUssQ0FBQyxNQUFNLGNBQWMsQ0FBQztBQU1sQzs7Ozs7R0FLRztBQUNILE1BQU0sT0FBTyxxQkFBcUI7SUFDaEM7Ozs7T0FJRztJQUNILFlBQW9CLGdCQUF1QjtRQUF2QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQU87SUFBRyxDQUFDO0lBRS9DOzs7Ozs7Ozs7T0FTRztJQUNILG1CQUFtQixDQUFDLFVBQXdCO1FBQzFDLHVGQUF1RjtRQUN2RixJQUFJLGlCQUFpQixHQUFHLFVBQVUsQ0FBQztRQUNuQyxPQUFPLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO1lBQzlDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLE1BQU0sQ0FBQztTQUM5QztRQUVELElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7WUFDdEMsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELHVFQUF1RTtRQUN2RSxxRkFBcUY7UUFDckYsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6RSxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELCtGQUErRjtRQUMvRixzRkFBc0Y7UUFDdEYsMkNBQTJDO1FBQzNDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxLQUFLLFFBQVEsQ0FBQyxFQUFFO1lBQ3hGLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtOb2RlUGF0aCwgU2NvcGV9IGZyb20gJ0BiYWJlbC90cmF2ZXJzZSc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJ0BiYWJlbC90eXBlcyc7XG5cbmltcG9ydCB7RGVjbGFyYXRpb25TY29wZX0gZnJvbSAnLi4vLi4vLi4vbGlua2VyJztcblxuZXhwb3J0IHR5cGUgQ29uc3RhbnRTY29wZVBhdGggPSBOb2RlUGF0aDx0LkZ1bmN0aW9ufHQuUHJvZ3JhbT47XG5cbi8qKlxuICogVGhpcyBjbGFzcyByZXByZXNlbnRzIHRoZSBsZXhpY2FsIHNjb3BlIG9mIGEgcGFydGlhbCBkZWNsYXJhdGlvbiBpbiBCYWJlbCBzb3VyY2UgY29kZS5cbiAqXG4gKiBJdHMgb25seSByZXNwb25zaWJpbGl0eSBpcyB0byBjb21wdXRlIGEgcmVmZXJlbmNlIG9iamVjdCBmb3IgdGhlIHNjb3BlIG9mIHNoYXJlZCBjb25zdGFudFxuICogc3RhdGVtZW50cyB0aGF0IHdpbGwgYmUgZ2VuZXJhdGVkIGR1cmluZyBwYXJ0aWFsIGxpbmtpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBCYWJlbERlY2xhcmF0aW9uU2NvcGUgaW1wbGVtZW50cyBEZWNsYXJhdGlvblNjb3BlPENvbnN0YW50U2NvcGVQYXRoLCB0LkV4cHJlc3Npb24+IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIG5ldyBgQmFiZWxEZWNsYXJhdGlvblNjb3BlYC5cbiAgICpcbiAgICogQHBhcmFtIGRlY2xhcmF0aW9uU2NvcGUgdGhlIEJhYmVsIHNjb3BlIGNvbnRhaW5pbmcgdGhlIGRlY2xhcmF0aW9uIGNhbGwgZXhwcmVzc2lvbi5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGVjbGFyYXRpb25TY29wZTogU2NvcGUpIHt9XG5cbiAgLyoqXG4gICAqIENvbXB1dGUgdGhlIEJhYmVsIGBOb2RlUGF0aGAgdGhhdCBjYW4gYmUgdXNlZCB0byByZWZlcmVuY2UgdGhlIGxleGljYWwgc2NvcGUgd2hlcmUgYW55XG4gICAqIHNoYXJlZCBjb25zdGFudCBzdGF0ZW1lbnRzIHdvdWxkIGJlIGluc2VydGVkLlxuICAgKlxuICAgKiBUaGVyZSB3aWxsIG9ubHkgYmUgYSBzaGFyZWQgY29uc3RhbnQgc2NvcGUgaWYgdGhlIGV4cHJlc3Npb24gaXMgaW4gYW4gRUNNQVNjcmlwdCBtb2R1bGUsIG9yIGFcbiAgICogVU1EIG1vZHVsZS4gT3RoZXJ3aXNlIGBudWxsYCBpcyByZXR1cm5lZCB0byBpbmRpY2F0ZSB0aGF0IGNvbnN0YW50IHN0YXRlbWVudHMgbXVzdCBiZSBlbWl0dGVkXG4gICAqIGxvY2FsbHkgdG8gdGhlIGdlbmVyYXRlZCBsaW5rZWQgZGVmaW5pdGlvbiwgdG8gYXZvaWQgcG9sbHV0aW5nIHRoZSBnbG9iYWwgc2NvcGUuXG4gICAqXG4gICAqIEBwYXJhbSBleHByZXNzaW9uIHRoZSBleHByZXNzaW9uIHRoYXQgcG9pbnRzIHRvIHRoZSBBbmd1bGFyIGNvcmUgZnJhbWV3b3JrIGltcG9ydC5cbiAgICovXG4gIGdldENvbnN0YW50U2NvcGVSZWYoZXhwcmVzc2lvbjogdC5FeHByZXNzaW9uKTogQ29uc3RhbnRTY29wZVBhdGh8bnVsbCB7XG4gICAgLy8gSWYgdGhlIGV4cHJlc3Npb24gaXMgb2YgdGhlIGZvcm0gYGEuYi5jYCB0aGVuIHdlIHdhbnQgdG8gZ2V0IHRoZSBmYXIgTEhTIChlLmcuIGBhYCkuXG4gICAgbGV0IGJpbmRpbmdFeHByZXNzaW9uID0gZXhwcmVzc2lvbjtcbiAgICB3aGlsZSAodC5pc01lbWJlckV4cHJlc3Npb24oYmluZGluZ0V4cHJlc3Npb24pKSB7XG4gICAgICBiaW5kaW5nRXhwcmVzc2lvbiA9IGJpbmRpbmdFeHByZXNzaW9uLm9iamVjdDtcbiAgICB9XG5cbiAgICBpZiAoIXQuaXNJZGVudGlmaWVyKGJpbmRpbmdFeHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gVGhlIGJpbmRpbmcgb2YgdGhlIGV4cHJlc3Npb24gaXMgd2hlcmUgdGhpcyBpZGVudGlmaWVyIHdhcyBkZWNsYXJlZC5cbiAgICAvLyBUaGlzIGNvdWxkIGJlIGEgdmFyaWFibGUgZGVjbGFyYXRpb24sIGFuIGltcG9ydCBuYW1lc3BhY2Ugb3IgYSBmdW5jdGlvbiBwYXJhbWV0ZXIuXG4gICAgY29uc3QgYmluZGluZyA9IHRoaXMuZGVjbGFyYXRpb25TY29wZS5nZXRCaW5kaW5nKGJpbmRpbmdFeHByZXNzaW9uLm5hbWUpO1xuICAgIGlmIChiaW5kaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdlIG9ubHkgc3VwcG9ydCBzaGFyZWQgY29uc3RhbnQgc3RhdGVtZW50cyBpZiB0aGUgYmluZGluZyB3YXMgaW4gYSBVTUQgbW9kdWxlIChpLmUuIGRlY2xhcmVkXG4gICAgLy8gd2l0aGluIGEgYHQuRnVuY3Rpb25gKSBvciBhbiBFQ01BU0NyaXB0IG1vZHVsZSAoaS5lLiBkZWNsYXJlZCBhdCB0aGUgdG9wIGxldmVsIG9mIGFcbiAgICAvLyBgdC5Qcm9ncmFtYCB0aGF0IGlzIG1hcmtlZCBhcyBhIG1vZHVsZSkuXG4gICAgY29uc3QgcGF0aCA9IGJpbmRpbmcuc2NvcGUucGF0aDtcbiAgICBpZiAoIXBhdGguaXNGdW5jdGlvblBhcmVudCgpICYmICEocGF0aC5pc1Byb2dyYW0oKSAmJiBwYXRoLm5vZGUuc291cmNlVHlwZSA9PT0gJ21vZHVsZScpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gcGF0aDtcbiAgfVxufVxuIl19