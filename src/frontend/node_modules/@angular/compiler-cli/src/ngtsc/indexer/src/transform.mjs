/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ParseSourceFile } from '@angular/compiler';
import { getTemplateIdentifiers } from './template';
/**
 * Generates `IndexedComponent` entries from a `IndexingContext`, which has information
 * about components discovered in the program registered in it.
 *
 * The context must be populated before `generateAnalysis` is called.
 */
export function generateAnalysis(context) {
    const analysis = new Map();
    context.components.forEach(({ declaration, selector, boundTemplate, templateMeta }) => {
        const name = declaration.name.getText();
        const usedComponents = new Set();
        const usedDirs = boundTemplate.getUsedDirectives();
        usedDirs.forEach(dir => {
            if (dir.isComponent) {
                usedComponents.add(dir.ref.node);
            }
        });
        // Get source files for the component and the template. If the template is inline, its source
        // file is the component's.
        const componentFile = new ParseSourceFile(declaration.getSourceFile().getFullText(), declaration.getSourceFile().fileName);
        let templateFile;
        if (templateMeta.isInline) {
            templateFile = componentFile;
        }
        else {
            templateFile = templateMeta.file;
        }
        analysis.set(declaration, {
            name,
            selector,
            file: componentFile,
            template: {
                identifiers: getTemplateIdentifiers(boundTemplate),
                usedComponents,
                isInline: templateMeta.isInline,
                file: templateFile,
            },
        });
    });
    return analysis;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9pbmRleGVyL3NyYy90cmFuc2Zvcm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBSWxELE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUVsRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxPQUF3QjtJQUN2RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBcUMsQ0FBQztJQUU5RCxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFDLEVBQUUsRUFBRTtRQUNsRixNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXhDLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFtQixDQUFDO1FBQ2xELE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ25ELFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDckIsSUFBSSxHQUFHLENBQUMsV0FBVyxFQUFFO2dCQUNuQixjQUFjLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDbEM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILDZGQUE2RjtRQUM3RiwyQkFBMkI7UUFDM0IsTUFBTSxhQUFhLEdBQUcsSUFBSSxlQUFlLENBQ3JDLFdBQVcsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxXQUFXLENBQUMsYUFBYSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDckYsSUFBSSxZQUE2QixDQUFDO1FBQ2xDLElBQUksWUFBWSxDQUFDLFFBQVEsRUFBRTtZQUN6QixZQUFZLEdBQUcsYUFBYSxDQUFDO1NBQzlCO2FBQU07WUFDTCxZQUFZLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQztTQUNsQztRQUVELFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFO1lBQ3hCLElBQUk7WUFDSixRQUFRO1lBQ1IsSUFBSSxFQUFFLGFBQWE7WUFDbkIsUUFBUSxFQUFFO2dCQUNSLFdBQVcsRUFBRSxzQkFBc0IsQ0FBQyxhQUFhLENBQUM7Z0JBQ2xELGNBQWM7Z0JBQ2QsUUFBUSxFQUFFLFlBQVksQ0FBQyxRQUFRO2dCQUMvQixJQUFJLEVBQUUsWUFBWTthQUNuQjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlU291cmNlRmlsZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtEZWNsYXJhdGlvbk5vZGV9IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtJbmRleGVkQ29tcG9uZW50fSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0luZGV4aW5nQ29udGV4dH0gZnJvbSAnLi9jb250ZXh0JztcbmltcG9ydCB7Z2V0VGVtcGxhdGVJZGVudGlmaWVyc30gZnJvbSAnLi90ZW1wbGF0ZSc7XG5cbi8qKlxuICogR2VuZXJhdGVzIGBJbmRleGVkQ29tcG9uZW50YCBlbnRyaWVzIGZyb20gYSBgSW5kZXhpbmdDb250ZXh0YCwgd2hpY2ggaGFzIGluZm9ybWF0aW9uXG4gKiBhYm91dCBjb21wb25lbnRzIGRpc2NvdmVyZWQgaW4gdGhlIHByb2dyYW0gcmVnaXN0ZXJlZCBpbiBpdC5cbiAqXG4gKiBUaGUgY29udGV4dCBtdXN0IGJlIHBvcHVsYXRlZCBiZWZvcmUgYGdlbmVyYXRlQW5hbHlzaXNgIGlzIGNhbGxlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQW5hbHlzaXMoY29udGV4dDogSW5kZXhpbmdDb250ZXh0KTogTWFwPERlY2xhcmF0aW9uTm9kZSwgSW5kZXhlZENvbXBvbmVudD4ge1xuICBjb25zdCBhbmFseXNpcyA9IG5ldyBNYXA8RGVjbGFyYXRpb25Ob2RlLCBJbmRleGVkQ29tcG9uZW50PigpO1xuXG4gIGNvbnRleHQuY29tcG9uZW50cy5mb3JFYWNoKCh7ZGVjbGFyYXRpb24sIHNlbGVjdG9yLCBib3VuZFRlbXBsYXRlLCB0ZW1wbGF0ZU1ldGF9KSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IGRlY2xhcmF0aW9uLm5hbWUuZ2V0VGV4dCgpO1xuXG4gICAgY29uc3QgdXNlZENvbXBvbmVudHMgPSBuZXcgU2V0PERlY2xhcmF0aW9uTm9kZT4oKTtcbiAgICBjb25zdCB1c2VkRGlycyA9IGJvdW5kVGVtcGxhdGUuZ2V0VXNlZERpcmVjdGl2ZXMoKTtcbiAgICB1c2VkRGlycy5mb3JFYWNoKGRpciA9PiB7XG4gICAgICBpZiAoZGlyLmlzQ29tcG9uZW50KSB7XG4gICAgICAgIHVzZWRDb21wb25lbnRzLmFkZChkaXIucmVmLm5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gR2V0IHNvdXJjZSBmaWxlcyBmb3IgdGhlIGNvbXBvbmVudCBhbmQgdGhlIHRlbXBsYXRlLiBJZiB0aGUgdGVtcGxhdGUgaXMgaW5saW5lLCBpdHMgc291cmNlXG4gICAgLy8gZmlsZSBpcyB0aGUgY29tcG9uZW50J3MuXG4gICAgY29uc3QgY29tcG9uZW50RmlsZSA9IG5ldyBQYXJzZVNvdXJjZUZpbGUoXG4gICAgICAgIGRlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKS5nZXRGdWxsVGV4dCgpLCBkZWNsYXJhdGlvbi5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWUpO1xuICAgIGxldCB0ZW1wbGF0ZUZpbGU6IFBhcnNlU291cmNlRmlsZTtcbiAgICBpZiAodGVtcGxhdGVNZXRhLmlzSW5saW5lKSB7XG4gICAgICB0ZW1wbGF0ZUZpbGUgPSBjb21wb25lbnRGaWxlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0ZW1wbGF0ZUZpbGUgPSB0ZW1wbGF0ZU1ldGEuZmlsZTtcbiAgICB9XG5cbiAgICBhbmFseXNpcy5zZXQoZGVjbGFyYXRpb24sIHtcbiAgICAgIG5hbWUsXG4gICAgICBzZWxlY3RvcixcbiAgICAgIGZpbGU6IGNvbXBvbmVudEZpbGUsXG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBpZGVudGlmaWVyczogZ2V0VGVtcGxhdGVJZGVudGlmaWVycyhib3VuZFRlbXBsYXRlKSxcbiAgICAgICAgdXNlZENvbXBvbmVudHMsXG4gICAgICAgIGlzSW5saW5lOiB0ZW1wbGF0ZU1ldGEuaXNJbmxpbmUsXG4gICAgICAgIGZpbGU6IHRlbXBsYXRlRmlsZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiBhbmFseXNpcztcbn1cbiJdfQ==