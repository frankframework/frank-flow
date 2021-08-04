/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { normalize } from 'path';
import * as ts from 'typescript';
import { isNullCheck, isSafeAccess } from '../../utils/typescript/nodes';
import { hasOneOfTypes, isNullableType } from '../../utils/typescript/symbol';
/** Names of symbols from `@angular/forms` whose `parent` accesses have to be migrated. */
const abstractControlSymbols = ['AbstractControl', 'FormArray', 'FormControl', 'FormGroup'];
/**
 * Finds the `PropertyAccessExpression`-s that are accessing the `parent` property in
 * such a way that may result in a compilation error after the v11 type changes.
 */
export function findParentAccesses(typeChecker, sourceFile) {
    const results = [];
    sourceFile.forEachChild(function walk(node) {
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'parent' && !isNullCheck(node) &&
            !isSafeAccess(node) && results.indexOf(node) === -1 &&
            isAbstractControlReference(typeChecker, node) && isNullableType(typeChecker, node)) {
            results.unshift(node);
        }
        node.forEachChild(walk);
    });
    return results;
}
/** Checks whether a property access is on an `AbstractControl` coming from `@angular/forms`. */
function isAbstractControlReference(typeChecker, node) {
    var _a, _b;
    let current = node;
    const formsPattern = /node_modules\/?.*\/@angular\/forms/;
    // Walks up the property access chain and tries to find a symbol tied to a `SourceFile`.
    // If such a node is found, we check whether the type is one of the `AbstractControl` symbols
    // and whether it comes from the `@angular/forms` directory in the `node_modules`.
    while (ts.isPropertyAccessExpression(current)) {
        const symbol = (_a = typeChecker.getTypeAtLocation(current.expression)) === null || _a === void 0 ? void 0 : _a.getSymbol();
        if (symbol) {
            const sourceFile = (_b = symbol.valueDeclaration) === null || _b === void 0 ? void 0 : _b.getSourceFile();
            return sourceFile != null &&
                formsPattern.test(normalize(sourceFile.fileName).replace(/\\/g, '/')) &&
                hasOneOfTypes(typeChecker, current.expression, abstractControlSymbols);
        }
        current = current.expression;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy9taWdyYXRpb25zL2Fic3RyYWN0LWNvbnRyb2wtcGFyZW50L3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUMvQixPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsV0FBVyxFQUFFLFlBQVksRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ3ZFLE9BQU8sRUFBQyxhQUFhLEVBQUUsY0FBYyxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFFNUUsMEZBQTBGO0FBQzFGLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBRTVGOzs7R0FHRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FDOUIsV0FBMkIsRUFBRSxVQUF5QjtJQUN4RCxNQUFNLE9BQU8sR0FBa0MsRUFBRSxDQUFDO0lBRWxELFVBQVUsQ0FBQyxZQUFZLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBYTtRQUNqRCxJQUFJLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1lBQ3hGLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25ELDBCQUEwQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ3RGLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkI7UUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFCLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVELGdHQUFnRztBQUNoRyxTQUFTLDBCQUEwQixDQUMvQixXQUEyQixFQUFFLElBQWlDOztJQUNoRSxJQUFJLE9BQU8sR0FBa0IsSUFBSSxDQUFDO0lBQ2xDLE1BQU0sWUFBWSxHQUFHLG9DQUFvQyxDQUFDO0lBQzFELHdGQUF3RjtJQUN4Riw2RkFBNkY7SUFDN0Ysa0ZBQWtGO0lBQ2xGLE9BQU8sRUFBRSxDQUFDLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQUEsV0FBVyxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsMENBQUUsU0FBUyxFQUFFLENBQUM7UUFDOUUsSUFBSSxNQUFNLEVBQUU7WUFDVixNQUFNLFVBQVUsR0FBRyxNQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsMENBQUUsYUFBYSxFQUFFLENBQUM7WUFDNUQsT0FBTyxVQUFVLElBQUksSUFBSTtnQkFDckIsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ3JFLGFBQWEsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1NBQzVFO1FBQ0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7S0FDOUI7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtub3JtYWxpemV9IGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge2lzTnVsbENoZWNrLCBpc1NhZmVBY2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvbm9kZXMnO1xuaW1wb3J0IHtoYXNPbmVPZlR5cGVzLCBpc051bGxhYmxlVHlwZX0gZnJvbSAnLi4vLi4vdXRpbHMvdHlwZXNjcmlwdC9zeW1ib2wnO1xuXG4vKiogTmFtZXMgb2Ygc3ltYm9scyBmcm9tIGBAYW5ndWxhci9mb3Jtc2Agd2hvc2UgYHBhcmVudGAgYWNjZXNzZXMgaGF2ZSB0byBiZSBtaWdyYXRlZC4gKi9cbmNvbnN0IGFic3RyYWN0Q29udHJvbFN5bWJvbHMgPSBbJ0Fic3RyYWN0Q29udHJvbCcsICdGb3JtQXJyYXknLCAnRm9ybUNvbnRyb2wnLCAnRm9ybUdyb3VwJ107XG5cbi8qKlxuICogRmluZHMgdGhlIGBQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb25gLXMgdGhhdCBhcmUgYWNjZXNzaW5nIHRoZSBgcGFyZW50YCBwcm9wZXJ0eSBpblxuICogc3VjaCBhIHdheSB0aGF0IG1heSByZXN1bHQgaW4gYSBjb21waWxhdGlvbiBlcnJvciBhZnRlciB0aGUgdjExIHR5cGUgY2hhbmdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRQYXJlbnRBY2Nlc3NlcyhcbiAgICB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiB0cy5Qcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHJlc3VsdHM6IHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbltdID0gW107XG5cbiAgc291cmNlRmlsZS5mb3JFYWNoQ2hpbGQoZnVuY3Rpb24gd2Fsayhub2RlOiB0cy5Ob2RlKSB7XG4gICAgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG5vZGUpICYmIG5vZGUubmFtZS50ZXh0ID09PSAncGFyZW50JyAmJiAhaXNOdWxsQ2hlY2sobm9kZSkgJiZcbiAgICAgICAgIWlzU2FmZUFjY2Vzcyhub2RlKSAmJiByZXN1bHRzLmluZGV4T2Yobm9kZSkgPT09IC0xICYmXG4gICAgICAgIGlzQWJzdHJhY3RDb250cm9sUmVmZXJlbmNlKHR5cGVDaGVja2VyLCBub2RlKSAmJiBpc051bGxhYmxlVHlwZSh0eXBlQ2hlY2tlciwgbm9kZSkpIHtcbiAgICAgIHJlc3VsdHMudW5zaGlmdChub2RlKTtcbiAgICB9XG5cbiAgICBub2RlLmZvckVhY2hDaGlsZCh3YWxrKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbi8qKiBDaGVja3Mgd2hldGhlciBhIHByb3BlcnR5IGFjY2VzcyBpcyBvbiBhbiBgQWJzdHJhY3RDb250cm9sYCBjb21pbmcgZnJvbSBgQGFuZ3VsYXIvZm9ybXNgLiAqL1xuZnVuY3Rpb24gaXNBYnN0cmFjdENvbnRyb2xSZWZlcmVuY2UoXG4gICAgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLCBub2RlOiB0cy5Qcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgbGV0IGN1cnJlbnQ6IHRzLkV4cHJlc3Npb24gPSBub2RlO1xuICBjb25zdCBmb3Jtc1BhdHRlcm4gPSAvbm9kZV9tb2R1bGVzXFwvPy4qXFwvQGFuZ3VsYXJcXC9mb3Jtcy87XG4gIC8vIFdhbGtzIHVwIHRoZSBwcm9wZXJ0eSBhY2Nlc3MgY2hhaW4gYW5kIHRyaWVzIHRvIGZpbmQgYSBzeW1ib2wgdGllZCB0byBhIGBTb3VyY2VGaWxlYC5cbiAgLy8gSWYgc3VjaCBhIG5vZGUgaXMgZm91bmQsIHdlIGNoZWNrIHdoZXRoZXIgdGhlIHR5cGUgaXMgb25lIG9mIHRoZSBgQWJzdHJhY3RDb250cm9sYCBzeW1ib2xzXG4gIC8vIGFuZCB3aGV0aGVyIGl0IGNvbWVzIGZyb20gdGhlIGBAYW5ndWxhci9mb3Jtc2AgZGlyZWN0b3J5IGluIHRoZSBgbm9kZV9tb2R1bGVzYC5cbiAgd2hpbGUgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKGN1cnJlbnQpKSB7XG4gICAgY29uc3Qgc3ltYm9sID0gdHlwZUNoZWNrZXIuZ2V0VHlwZUF0TG9jYXRpb24oY3VycmVudC5leHByZXNzaW9uKT8uZ2V0U3ltYm9sKCk7XG4gICAgaWYgKHN5bWJvbCkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uPy5nZXRTb3VyY2VGaWxlKCk7XG4gICAgICByZXR1cm4gc291cmNlRmlsZSAhPSBudWxsICYmXG4gICAgICAgICAgZm9ybXNQYXR0ZXJuLnRlc3Qobm9ybWFsaXplKHNvdXJjZUZpbGUuZmlsZU5hbWUpLnJlcGxhY2UoL1xcXFwvZywgJy8nKSkgJiZcbiAgICAgICAgICBoYXNPbmVPZlR5cGVzKHR5cGVDaGVja2VyLCBjdXJyZW50LmV4cHJlc3Npb24sIGFic3RyYWN0Q29udHJvbFN5bWJvbHMpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gY3VycmVudC5leHByZXNzaW9uO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbiJdfQ==