/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
export function aliasTransformFactory(exportStatements) {
    return (context) => {
        return (file) => {
            if (ts.isBundle(file) || !exportStatements.has(file.fileName)) {
                return file;
            }
            const statements = [...file.statements];
            exportStatements.get(file.fileName).forEach(([moduleName, symbolName], aliasName) => {
                const stmt = ts.createExportDeclaration(
                /* decorators */ undefined, 
                /* modifiers */ undefined, 
                /* exportClause */ ts.createNamedExports([ts.createExportSpecifier(
                    /* propertyName */ symbolName, 
                    /* name */ aliasName)]), 
                /* moduleSpecifier */ ts.createStringLiteral(moduleName));
                statements.push(stmt);
            });
            return ts.updateSourceFileNode(file, statements);
        };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxpYXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3RyYW5zZm9ybS9zcmMvYWxpYXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsTUFBTSxVQUFVLHFCQUFxQixDQUFDLGdCQUE0RDtJQUVoRyxPQUFPLENBQUMsT0FBaUMsRUFBRSxFQUFFO1FBQzNDLE9BQU8sQ0FBQyxJQUFtQixFQUFFLEVBQUU7WUFDN0IsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDN0QsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRTtnQkFDbkYsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLHVCQUF1QjtnQkFDbkMsZ0JBQWdCLENBQUMsU0FBUztnQkFDMUIsZUFBZSxDQUFDLFNBQVM7Z0JBQ3pCLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxxQkFBcUI7b0JBQzlELGtCQUFrQixDQUFDLFVBQVU7b0JBQzdCLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUMzQixxQkFBcUIsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDOUQsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QixDQUFDLENBQUMsQ0FBQztZQUVILE9BQU8sRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNuRCxDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5leHBvcnQgZnVuY3Rpb24gYWxpYXNUcmFuc2Zvcm1GYWN0b3J5KGV4cG9ydFN0YXRlbWVudHM6IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIFtzdHJpbmcsIHN0cmluZ10+Pik6XG4gICAgdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+IHtcbiAgcmV0dXJuIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpID0+IHtcbiAgICByZXR1cm4gKGZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHtcbiAgICAgIGlmICh0cy5pc0J1bmRsZShmaWxlKSB8fCAhZXhwb3J0U3RhdGVtZW50cy5oYXMoZmlsZS5maWxlTmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbLi4uZmlsZS5zdGF0ZW1lbnRzXTtcbiAgICAgIGV4cG9ydFN0YXRlbWVudHMuZ2V0KGZpbGUuZmlsZU5hbWUpIS5mb3JFYWNoKChbbW9kdWxlTmFtZSwgc3ltYm9sTmFtZV0sIGFsaWFzTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBzdG10ID0gdHMuY3JlYXRlRXhwb3J0RGVjbGFyYXRpb24oXG4gICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAvKiBleHBvcnRDbGF1c2UgKi8gdHMuY3JlYXRlTmFtZWRFeHBvcnRzKFt0cy5jcmVhdGVFeHBvcnRTcGVjaWZpZXIoXG4gICAgICAgICAgICAgICAgLyogcHJvcGVydHlOYW1lICovIHN5bWJvbE5hbWUsXG4gICAgICAgICAgICAgICAgLyogbmFtZSAqLyBhbGlhc05hbWUpXSksXG4gICAgICAgICAgICAvKiBtb2R1bGVTcGVjaWZpZXIgKi8gdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChtb2R1bGVOYW1lKSk7XG4gICAgICAgIHN0YXRlbWVudHMucHVzaChzdG10KTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdHMudXBkYXRlU291cmNlRmlsZU5vZGUoZmlsZSwgc3RhdGVtZW50cyk7XG4gICAgfTtcbiAgfTtcbn1cbiJdfQ==