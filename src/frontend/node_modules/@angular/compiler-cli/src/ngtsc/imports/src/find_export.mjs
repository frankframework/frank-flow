/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isNamedDeclaration } from '../../util/src/typescript';
/**
 * Find the name, if any, by which a node is exported from a given file.
 */
export function findExportedNameOfNode(target, file, reflector) {
    const exports = reflector.getExportsOfModule(file);
    if (exports === null) {
        return null;
    }
    const declaredName = isNamedDeclaration(target) ? target.name.text : null;
    // Look for the export which declares the node.
    let foundExportName = null;
    for (const [exportName, declaration] of exports) {
        if (declaration.node !== target) {
            continue;
        }
        if (exportName === declaredName) {
            // A non-alias export exists which is always preferred, so use that one.
            return exportName;
        }
        foundExportName = exportName;
    }
    if (foundExportName === null) {
        throw new Error(`Failed to find exported name of node (${target.getText()}) in '${file.fileName}'.`);
    }
    return foundExportName;
}
/**
 * Check whether a given `ts.Symbol` represents a declaration of a given node.
 *
 * This is not quite as trivial as just checking the declarations, as some nodes are
 * `ts.ExportSpecifier`s and need to be unwrapped.
 */
function symbolDeclaresNode(sym, node, checker) {
    if (sym.declarations === undefined) {
        return false;
    }
    return sym.declarations.some(decl => {
        if (ts.isExportSpecifier(decl)) {
            const exportedSymbol = checker.getExportSpecifierLocalTargetSymbol(decl);
            if (exportedSymbol !== undefined) {
                return symbolDeclaresNode(exportedSymbol, node, checker);
            }
        }
        return decl === node;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZF9leHBvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2ltcG9ydHMvc3JjL2ZpbmRfZXhwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRTdEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUNsQyxNQUFlLEVBQUUsSUFBbUIsRUFBRSxTQUF5QjtJQUNqRSxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkQsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1FBQ3BCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxNQUFNLFlBQVksR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUUxRSwrQ0FBK0M7SUFDL0MsSUFBSSxlQUFlLEdBQWdCLElBQUksQ0FBQztJQUN4QyxLQUFLLE1BQU0sQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLElBQUksT0FBTyxFQUFFO1FBQy9DLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7WUFDL0IsU0FBUztTQUNWO1FBRUQsSUFBSSxVQUFVLEtBQUssWUFBWSxFQUFFO1lBQy9CLHdFQUF3RTtZQUN4RSxPQUFPLFVBQVUsQ0FBQztTQUNuQjtRQUVELGVBQWUsR0FBRyxVQUFVLENBQUM7S0FDOUI7SUFFRCxJQUFJLGVBQWUsS0FBSyxJQUFJLEVBQUU7UUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FDWCx5Q0FBeUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxTQUFTLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDO0tBQzFGO0lBQ0QsT0FBTyxlQUFlLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxHQUFjLEVBQUUsSUFBYSxFQUFFLE9BQXVCO0lBQ2hGLElBQUksR0FBRyxDQUFDLFlBQVksS0FBSyxTQUFTLEVBQUU7UUFDbEMsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDbEMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDOUIsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pFLElBQUksY0FBYyxLQUFLLFNBQVMsRUFBRTtnQkFDaEMsT0FBTyxrQkFBa0IsQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQzFEO1NBQ0Y7UUFDRCxPQUFPLElBQUksS0FBSyxJQUFJLENBQUM7SUFDdkIsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge2lzTmFtZWREZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5cbi8qKlxuICogRmluZCB0aGUgbmFtZSwgaWYgYW55LCBieSB3aGljaCBhIG5vZGUgaXMgZXhwb3J0ZWQgZnJvbSBhIGdpdmVuIGZpbGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5kRXhwb3J0ZWROYW1lT2ZOb2RlKFxuICAgIHRhcmdldDogdHMuTm9kZSwgZmlsZTogdHMuU291cmNlRmlsZSwgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgZXhwb3J0cyA9IHJlZmxlY3Rvci5nZXRFeHBvcnRzT2ZNb2R1bGUoZmlsZSk7XG4gIGlmIChleHBvcnRzID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBkZWNsYXJlZE5hbWUgPSBpc05hbWVkRGVjbGFyYXRpb24odGFyZ2V0KSA/IHRhcmdldC5uYW1lLnRleHQgOiBudWxsO1xuXG4gIC8vIExvb2sgZm9yIHRoZSBleHBvcnQgd2hpY2ggZGVjbGFyZXMgdGhlIG5vZGUuXG4gIGxldCBmb3VuZEV4cG9ydE5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCBbZXhwb3J0TmFtZSwgZGVjbGFyYXRpb25dIG9mIGV4cG9ydHMpIHtcbiAgICBpZiAoZGVjbGFyYXRpb24ubm9kZSAhPT0gdGFyZ2V0KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoZXhwb3J0TmFtZSA9PT0gZGVjbGFyZWROYW1lKSB7XG4gICAgICAvLyBBIG5vbi1hbGlhcyBleHBvcnQgZXhpc3RzIHdoaWNoIGlzIGFsd2F5cyBwcmVmZXJyZWQsIHNvIHVzZSB0aGF0IG9uZS5cbiAgICAgIHJldHVybiBleHBvcnROYW1lO1xuICAgIH1cblxuICAgIGZvdW5kRXhwb3J0TmFtZSA9IGV4cG9ydE5hbWU7XG4gIH1cblxuICBpZiAoZm91bmRFeHBvcnROYW1lID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRmFpbGVkIHRvIGZpbmQgZXhwb3J0ZWQgbmFtZSBvZiBub2RlICgke3RhcmdldC5nZXRUZXh0KCl9KSBpbiAnJHtmaWxlLmZpbGVOYW1lfScuYCk7XG4gIH1cbiAgcmV0dXJuIGZvdW5kRXhwb3J0TmFtZTtcbn1cblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIGEgZ2l2ZW4gYHRzLlN5bWJvbGAgcmVwcmVzZW50cyBhIGRlY2xhcmF0aW9uIG9mIGEgZ2l2ZW4gbm9kZS5cbiAqXG4gKiBUaGlzIGlzIG5vdCBxdWl0ZSBhcyB0cml2aWFsIGFzIGp1c3QgY2hlY2tpbmcgdGhlIGRlY2xhcmF0aW9ucywgYXMgc29tZSBub2RlcyBhcmVcbiAqIGB0cy5FeHBvcnRTcGVjaWZpZXJgcyBhbmQgbmVlZCB0byBiZSB1bndyYXBwZWQuXG4gKi9cbmZ1bmN0aW9uIHN5bWJvbERlY2xhcmVzTm9kZShzeW06IHRzLlN5bWJvbCwgbm9kZTogdHMuTm9kZSwgY2hlY2tlcjogdHMuVHlwZUNoZWNrZXIpOiBib29sZWFuIHtcbiAgaWYgKHN5bS5kZWNsYXJhdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBzeW0uZGVjbGFyYXRpb25zLnNvbWUoZGVjbCA9PiB7XG4gICAgaWYgKHRzLmlzRXhwb3J0U3BlY2lmaWVyKGRlY2wpKSB7XG4gICAgICBjb25zdCBleHBvcnRlZFN5bWJvbCA9IGNoZWNrZXIuZ2V0RXhwb3J0U3BlY2lmaWVyTG9jYWxUYXJnZXRTeW1ib2woZGVjbCk7XG4gICAgICBpZiAoZXhwb3J0ZWRTeW1ib2wgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gc3ltYm9sRGVjbGFyZXNOb2RlKGV4cG9ydGVkU3ltYm9sLCBub2RlLCBjaGVja2VyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlY2wgPT09IG5vZGU7XG4gIH0pO1xufVxuIl19