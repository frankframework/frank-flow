/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { getImportOfIdentifier } from '../../utils/typescript/imports';
/** Finds all the Identifier nodes in a file that refer to `Native` view encapsulation. */
export function findNativeEncapsulationNodes(typeChecker, sourceFile) {
    const results = new Set();
    sourceFile.forEachChild(function walkNode(node) {
        // Note that we look directly for nodes in the form of `<something>.Native`, rather than going
        // for `Component` class decorators, because it's much simpler and it allows us to handle cases
        // where `ViewEncapsulation.Native` might be used in a different context (e.g. a variable).
        // Using the encapsulation outside of a decorator is an edge case, but we do have public APIs
        // where it can be passed in (see the `defaultViewEncapsulation` property on the
        // `COMPILER_OPTIONS` provider).
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name) &&
            node.name.text === 'Native' && ts.isIdentifier(node.expression)) {
            const expressionImport = getImportOfIdentifier(typeChecker, node.expression);
            if (expressionImport && expressionImport.name === 'ViewEncapsulation' &&
                expressionImport.importModule === '@angular/core') {
                results.add(node.name);
            }
        }
        else {
            node.forEachChild(walkNode);
        }
    });
    return results;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy9taWdyYXRpb25zL25hdGl2ZS12aWV3LWVuY2Fwc3VsYXRpb24vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRSwwRkFBMEY7QUFDMUYsTUFBTSxVQUFVLDRCQUE0QixDQUN4QyxXQUEyQixFQUFFLFVBQXlCO0lBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO0lBRXpDLFVBQVUsQ0FBQyxZQUFZLENBQUMsU0FBUyxRQUFRLENBQUMsSUFBYTtRQUNyRCw4RkFBOEY7UUFDOUYsK0ZBQStGO1FBQy9GLDJGQUEyRjtRQUMzRiw2RkFBNkY7UUFDN0YsZ0ZBQWdGO1FBQ2hGLGdDQUFnQztRQUNoQyxJQUFJLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDakUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ25FLE1BQU0sZ0JBQWdCLEdBQUcscUJBQXFCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM3RSxJQUFJLGdCQUFnQixJQUFJLGdCQUFnQixDQUFDLElBQUksS0FBSyxtQkFBbUI7Z0JBQ2pFLGdCQUFnQixDQUFDLFlBQVksS0FBSyxlQUFlLEVBQUU7Z0JBQ3JELE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3hCO1NBQ0Y7YUFBTTtZQUNMLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDN0I7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Z2V0SW1wb3J0T2ZJZGVudGlmaWVyfSBmcm9tICcuLi8uLi91dGlscy90eXBlc2NyaXB0L2ltcG9ydHMnO1xuXG4vKiogRmluZHMgYWxsIHRoZSBJZGVudGlmaWVyIG5vZGVzIGluIGEgZmlsZSB0aGF0IHJlZmVyIHRvIGBOYXRpdmVgIHZpZXcgZW5jYXBzdWxhdGlvbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5kTmF0aXZlRW5jYXBzdWxhdGlvbk5vZGVzKFxuICAgIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlciwgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IFNldDx0cy5JZGVudGlmaWVyPiB7XG4gIGNvbnN0IHJlc3VsdHMgPSBuZXcgU2V0PHRzLklkZW50aWZpZXI+KCk7XG5cbiAgc291cmNlRmlsZS5mb3JFYWNoQ2hpbGQoZnVuY3Rpb24gd2Fsa05vZGUobm9kZTogdHMuTm9kZSkge1xuICAgIC8vIE5vdGUgdGhhdCB3ZSBsb29rIGRpcmVjdGx5IGZvciBub2RlcyBpbiB0aGUgZm9ybSBvZiBgPHNvbWV0aGluZz4uTmF0aXZlYCwgcmF0aGVyIHRoYW4gZ29pbmdcbiAgICAvLyBmb3IgYENvbXBvbmVudGAgY2xhc3MgZGVjb3JhdG9ycywgYmVjYXVzZSBpdCdzIG11Y2ggc2ltcGxlciBhbmQgaXQgYWxsb3dzIHVzIHRvIGhhbmRsZSBjYXNlc1xuICAgIC8vIHdoZXJlIGBWaWV3RW5jYXBzdWxhdGlvbi5OYXRpdmVgIG1pZ2h0IGJlIHVzZWQgaW4gYSBkaWZmZXJlbnQgY29udGV4dCAoZS5nLiBhIHZhcmlhYmxlKS5cbiAgICAvLyBVc2luZyB0aGUgZW5jYXBzdWxhdGlvbiBvdXRzaWRlIG9mIGEgZGVjb3JhdG9yIGlzIGFuIGVkZ2UgY2FzZSwgYnV0IHdlIGRvIGhhdmUgcHVibGljIEFQSXNcbiAgICAvLyB3aGVyZSBpdCBjYW4gYmUgcGFzc2VkIGluIChzZWUgdGhlIGBkZWZhdWx0Vmlld0VuY2Fwc3VsYXRpb25gIHByb3BlcnR5IG9uIHRoZVxuICAgIC8vIGBDT01QSUxFUl9PUFRJT05TYCBwcm92aWRlcikuXG4gICAgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG5vZGUpICYmIHRzLmlzSWRlbnRpZmllcihub2RlLm5hbWUpICYmXG4gICAgICAgIG5vZGUubmFtZS50ZXh0ID09PSAnTmF0aXZlJyAmJiB0cy5pc0lkZW50aWZpZXIobm9kZS5leHByZXNzaW9uKSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvbkltcG9ydCA9IGdldEltcG9ydE9mSWRlbnRpZmllcih0eXBlQ2hlY2tlciwgbm9kZS5leHByZXNzaW9uKTtcbiAgICAgIGlmIChleHByZXNzaW9uSW1wb3J0ICYmIGV4cHJlc3Npb25JbXBvcnQubmFtZSA9PT0gJ1ZpZXdFbmNhcHN1bGF0aW9uJyAmJlxuICAgICAgICAgIGV4cHJlc3Npb25JbXBvcnQuaW1wb3J0TW9kdWxlID09PSAnQGFuZ3VsYXIvY29yZScpIHtcbiAgICAgICAgcmVzdWx0cy5hZGQobm9kZS5uYW1lKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZS5mb3JFYWNoQ2hpbGQod2Fsa05vZGUpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iXX0=