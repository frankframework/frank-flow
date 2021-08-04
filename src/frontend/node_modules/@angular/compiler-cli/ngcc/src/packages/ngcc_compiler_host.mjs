/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { NgtscCompilerHost } from '../../../src/ngtsc/file_system';
import { isWithinPackage } from '../analysis/util';
import { isRelativePath } from '../utils';
/**
 * Represents a compiler host that resolves a module import as a JavaScript source file if
 * available, instead of the .d.ts typings file that would have been resolved by TypeScript. This
 * is necessary for packages that have their typings in the same directory as the sources, which
 * would otherwise let TypeScript prefer the .d.ts file instead of the JavaScript source file.
 */
export class NgccSourcesCompilerHost extends NgtscCompilerHost {
    constructor(fs, options, cache, moduleResolutionCache, packagePath) {
        super(fs, options);
        this.cache = cache;
        this.moduleResolutionCache = moduleResolutionCache;
        this.packagePath = packagePath;
    }
    getSourceFile(fileName, languageVersion) {
        return this.cache.getCachedSourceFile(fileName, languageVersion);
    }
    resolveModuleNames(moduleNames, containingFile, reusedNames, redirectedReference) {
        return moduleNames.map(moduleName => {
            const { resolvedModule } = ts.resolveModuleName(moduleName, containingFile, this.options, this, this.moduleResolutionCache, redirectedReference);
            // If the module request originated from a relative import in a JavaScript source file,
            // TypeScript may have resolved the module to its .d.ts declaration file if the .js source
            // file was in the same directory. This is undesirable, as we need to have the actual
            // JavaScript being present in the program. This logic recognizes this scenario and rewrites
            // the resolved .d.ts declaration file to its .js counterpart, if it exists.
            if ((resolvedModule === null || resolvedModule === void 0 ? void 0 : resolvedModule.extension) === ts.Extension.Dts && containingFile.endsWith('.js') &&
                isRelativePath(moduleName)) {
                const jsFile = resolvedModule.resolvedFileName.replace(/\.d\.ts$/, '.js');
                if (this.fileExists(jsFile)) {
                    return Object.assign(Object.assign({}, resolvedModule), { resolvedFileName: jsFile, extension: ts.Extension.Js });
                }
            }
            // Prevent loading JavaScript source files outside of the package root, which would happen for
            // packages that don't have .d.ts files. As ngcc should only operate on the .js files
            // contained within the package, any files outside the package are simply discarded. This does
            // result in a partial program with error diagnostics, however ngcc won't gather diagnostics
            // for the program it creates so these diagnostics won't be reported.
            if ((resolvedModule === null || resolvedModule === void 0 ? void 0 : resolvedModule.extension) === ts.Extension.Js &&
                !isWithinPackage(this.packagePath, this.fs.resolve(resolvedModule.resolvedFileName))) {
                return undefined;
            }
            return resolvedModule;
        });
    }
}
/**
 * A compiler host implementation that is used for the typings program. It leverages the entry-point
 * cache for source files and module resolution, as these results can be reused across the sources
 * program.
 */
export class NgccDtsCompilerHost extends NgtscCompilerHost {
    constructor(fs, options, cache, moduleResolutionCache) {
        super(fs, options);
        this.cache = cache;
        this.moduleResolutionCache = moduleResolutionCache;
    }
    getSourceFile(fileName, languageVersion) {
        return this.cache.getCachedSourceFile(fileName, languageVersion);
    }
    resolveModuleNames(moduleNames, containingFile, reusedNames, redirectedReference) {
        return moduleNames.map(moduleName => {
            const { resolvedModule } = ts.resolveModuleName(moduleName, containingFile, this.options, this, this.moduleResolutionCache, redirectedReference);
            return resolvedModule;
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdjY19jb21waWxlcl9ob3N0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL3BhY2thZ2VzL25nY2NfY29tcGlsZXJfaG9zdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQTZCLGlCQUFpQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0YsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pELE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFHeEM7Ozs7O0dBS0c7QUFDSCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsaUJBQWlCO0lBQzVELFlBQ0ksRUFBYyxFQUFFLE9BQTJCLEVBQVUsS0FBMEIsRUFDdkUscUJBQStDLEVBQzdDLFdBQTJCO1FBQ3ZDLEtBQUssQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFIb0MsVUFBSyxHQUFMLEtBQUssQ0FBcUI7UUFDdkUsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUEwQjtRQUM3QyxnQkFBVyxHQUFYLFdBQVcsQ0FBZ0I7SUFFekMsQ0FBQztJQUVELGFBQWEsQ0FBQyxRQUFnQixFQUFFLGVBQWdDO1FBQzlELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELGtCQUFrQixDQUNkLFdBQXFCLEVBQUUsY0FBc0IsRUFBRSxXQUFzQixFQUNyRSxtQkFBaUQ7UUFDbkQsT0FBTyxXQUFXLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ2xDLE1BQU0sRUFBQyxjQUFjLEVBQUMsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQ3pDLFVBQVUsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUMxRSxtQkFBbUIsQ0FBQyxDQUFDO1lBRXpCLHVGQUF1RjtZQUN2RiwwRkFBMEY7WUFDMUYscUZBQXFGO1lBQ3JGLDRGQUE0RjtZQUM1Riw0RUFBNEU7WUFDNUUsSUFBSSxDQUFBLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxTQUFTLE1BQUssRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7Z0JBQ2hGLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDOUIsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzFFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDM0IsdUNBQVcsY0FBYyxLQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUU7aUJBQ2xGO2FBQ0Y7WUFFRCw4RkFBOEY7WUFDOUYscUZBQXFGO1lBQ3JGLDhGQUE4RjtZQUM5Riw0RkFBNEY7WUFDNUYscUVBQXFFO1lBQ3JFLElBQUksQ0FBQSxjQUFjLGFBQWQsY0FBYyx1QkFBZCxjQUFjLENBQUUsU0FBUyxNQUFLLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDN0MsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxFQUFFO2dCQUN4RixPQUFPLFNBQVMsQ0FBQzthQUNsQjtZQUVELE9BQU8sY0FBYyxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxtQkFBb0IsU0FBUSxpQkFBaUI7SUFDeEQsWUFDSSxFQUFjLEVBQUUsT0FBMkIsRUFBVSxLQUEwQixFQUN2RSxxQkFBK0M7UUFDekQsS0FBSyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUZvQyxVQUFLLEdBQUwsS0FBSyxDQUFxQjtRQUN2RSwwQkFBcUIsR0FBckIscUJBQXFCLENBQTBCO0lBRTNELENBQUM7SUFFRCxhQUFhLENBQUMsUUFBZ0IsRUFBRSxlQUFnQztRQUM5RCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRCxrQkFBa0IsQ0FDZCxXQUFxQixFQUFFLGNBQXNCLEVBQUUsV0FBc0IsRUFDckUsbUJBQWlEO1FBQ25ELE9BQU8sV0FBVyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUNsQyxNQUFNLEVBQUMsY0FBYyxFQUFDLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUN6QyxVQUFVLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFDMUUsbUJBQW1CLENBQUMsQ0FBQztZQUN6QixPQUFPLGNBQWMsQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7QWJzb2x1dGVGc1BhdGgsIEZpbGVTeXN0ZW0sIE5ndHNjQ29tcGlsZXJIb3N0fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtpc1dpdGhpblBhY2thZ2V9IGZyb20gJy4uL2FuYWx5c2lzL3V0aWwnO1xuaW1wb3J0IHtpc1JlbGF0aXZlUGF0aH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHtFbnRyeVBvaW50RmlsZUNhY2hlfSBmcm9tICcuL3NvdXJjZV9maWxlX2NhY2hlJztcblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgY29tcGlsZXIgaG9zdCB0aGF0IHJlc29sdmVzIGEgbW9kdWxlIGltcG9ydCBhcyBhIEphdmFTY3JpcHQgc291cmNlIGZpbGUgaWZcbiAqIGF2YWlsYWJsZSwgaW5zdGVhZCBvZiB0aGUgLmQudHMgdHlwaW5ncyBmaWxlIHRoYXQgd291bGQgaGF2ZSBiZWVuIHJlc29sdmVkIGJ5IFR5cGVTY3JpcHQuIFRoaXNcbiAqIGlzIG5lY2Vzc2FyeSBmb3IgcGFja2FnZXMgdGhhdCBoYXZlIHRoZWlyIHR5cGluZ3MgaW4gdGhlIHNhbWUgZGlyZWN0b3J5IGFzIHRoZSBzb3VyY2VzLCB3aGljaFxuICogd291bGQgb3RoZXJ3aXNlIGxldCBUeXBlU2NyaXB0IHByZWZlciB0aGUgLmQudHMgZmlsZSBpbnN0ZWFkIG9mIHRoZSBKYXZhU2NyaXB0IHNvdXJjZSBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgTmdjY1NvdXJjZXNDb21waWxlckhvc3QgZXh0ZW5kcyBOZ3RzY0NvbXBpbGVySG9zdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgZnM6IEZpbGVTeXN0ZW0sIG9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucywgcHJpdmF0ZSBjYWNoZTogRW50cnlQb2ludEZpbGVDYWNoZSxcbiAgICAgIHByaXZhdGUgbW9kdWxlUmVzb2x1dGlvbkNhY2hlOiB0cy5Nb2R1bGVSZXNvbHV0aW9uQ2FjaGUsXG4gICAgICBwcm90ZWN0ZWQgcGFja2FnZVBhdGg6IEFic29sdXRlRnNQYXRoKSB7XG4gICAgc3VwZXIoZnMsIG9wdGlvbnMpO1xuICB9XG5cbiAgZ2V0U291cmNlRmlsZShmaWxlTmFtZTogc3RyaW5nLCBsYW5ndWFnZVZlcnNpb246IHRzLlNjcmlwdFRhcmdldCk6IHRzLlNvdXJjZUZpbGV8dW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5jYWNoZS5nZXRDYWNoZWRTb3VyY2VGaWxlKGZpbGVOYW1lLCBsYW5ndWFnZVZlcnNpb24pO1xuICB9XG5cbiAgcmVzb2x2ZU1vZHVsZU5hbWVzKFxuICAgICAgbW9kdWxlTmFtZXM6IHN0cmluZ1tdLCBjb250YWluaW5nRmlsZTogc3RyaW5nLCByZXVzZWROYW1lcz86IHN0cmluZ1tdLFxuICAgICAgcmVkaXJlY3RlZFJlZmVyZW5jZT86IHRzLlJlc29sdmVkUHJvamVjdFJlZmVyZW5jZSk6IEFycmF5PHRzLlJlc29sdmVkTW9kdWxlfHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiBtb2R1bGVOYW1lcy5tYXAobW9kdWxlTmFtZSA9PiB7XG4gICAgICBjb25zdCB7cmVzb2x2ZWRNb2R1bGV9ID0gdHMucmVzb2x2ZU1vZHVsZU5hbWUoXG4gICAgICAgICAgbW9kdWxlTmFtZSwgY29udGFpbmluZ0ZpbGUsIHRoaXMub3B0aW9ucywgdGhpcywgdGhpcy5tb2R1bGVSZXNvbHV0aW9uQ2FjaGUsXG4gICAgICAgICAgcmVkaXJlY3RlZFJlZmVyZW5jZSk7XG5cbiAgICAgIC8vIElmIHRoZSBtb2R1bGUgcmVxdWVzdCBvcmlnaW5hdGVkIGZyb20gYSByZWxhdGl2ZSBpbXBvcnQgaW4gYSBKYXZhU2NyaXB0IHNvdXJjZSBmaWxlLFxuICAgICAgLy8gVHlwZVNjcmlwdCBtYXkgaGF2ZSByZXNvbHZlZCB0aGUgbW9kdWxlIHRvIGl0cyAuZC50cyBkZWNsYXJhdGlvbiBmaWxlIGlmIHRoZSAuanMgc291cmNlXG4gICAgICAvLyBmaWxlIHdhcyBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuIFRoaXMgaXMgdW5kZXNpcmFibGUsIGFzIHdlIG5lZWQgdG8gaGF2ZSB0aGUgYWN0dWFsXG4gICAgICAvLyBKYXZhU2NyaXB0IGJlaW5nIHByZXNlbnQgaW4gdGhlIHByb2dyYW0uIFRoaXMgbG9naWMgcmVjb2duaXplcyB0aGlzIHNjZW5hcmlvIGFuZCByZXdyaXRlc1xuICAgICAgLy8gdGhlIHJlc29sdmVkIC5kLnRzIGRlY2xhcmF0aW9uIGZpbGUgdG8gaXRzIC5qcyBjb3VudGVycGFydCwgaWYgaXQgZXhpc3RzLlxuICAgICAgaWYgKHJlc29sdmVkTW9kdWxlPy5leHRlbnNpb24gPT09IHRzLkV4dGVuc2lvbi5EdHMgJiYgY29udGFpbmluZ0ZpbGUuZW5kc1dpdGgoJy5qcycpICYmXG4gICAgICAgICAgaXNSZWxhdGl2ZVBhdGgobW9kdWxlTmFtZSkpIHtcbiAgICAgICAgY29uc3QganNGaWxlID0gcmVzb2x2ZWRNb2R1bGUucmVzb2x2ZWRGaWxlTmFtZS5yZXBsYWNlKC9cXC5kXFwudHMkLywgJy5qcycpO1xuICAgICAgICBpZiAodGhpcy5maWxlRXhpc3RzKGpzRmlsZSkpIHtcbiAgICAgICAgICByZXR1cm4gey4uLnJlc29sdmVkTW9kdWxlLCByZXNvbHZlZEZpbGVOYW1lOiBqc0ZpbGUsIGV4dGVuc2lvbjogdHMuRXh0ZW5zaW9uLkpzfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBQcmV2ZW50IGxvYWRpbmcgSmF2YVNjcmlwdCBzb3VyY2UgZmlsZXMgb3V0c2lkZSBvZiB0aGUgcGFja2FnZSByb290LCB3aGljaCB3b3VsZCBoYXBwZW4gZm9yXG4gICAgICAvLyBwYWNrYWdlcyB0aGF0IGRvbid0IGhhdmUgLmQudHMgZmlsZXMuIEFzIG5nY2Mgc2hvdWxkIG9ubHkgb3BlcmF0ZSBvbiB0aGUgLmpzIGZpbGVzXG4gICAgICAvLyBjb250YWluZWQgd2l0aGluIHRoZSBwYWNrYWdlLCBhbnkgZmlsZXMgb3V0c2lkZSB0aGUgcGFja2FnZSBhcmUgc2ltcGx5IGRpc2NhcmRlZC4gVGhpcyBkb2VzXG4gICAgICAvLyByZXN1bHQgaW4gYSBwYXJ0aWFsIHByb2dyYW0gd2l0aCBlcnJvciBkaWFnbm9zdGljcywgaG93ZXZlciBuZ2NjIHdvbid0IGdhdGhlciBkaWFnbm9zdGljc1xuICAgICAgLy8gZm9yIHRoZSBwcm9ncmFtIGl0IGNyZWF0ZXMgc28gdGhlc2UgZGlhZ25vc3RpY3Mgd29uJ3QgYmUgcmVwb3J0ZWQuXG4gICAgICBpZiAocmVzb2x2ZWRNb2R1bGU/LmV4dGVuc2lvbiA9PT0gdHMuRXh0ZW5zaW9uLkpzICYmXG4gICAgICAgICAgIWlzV2l0aGluUGFja2FnZSh0aGlzLnBhY2thZ2VQYXRoLCB0aGlzLmZzLnJlc29sdmUocmVzb2x2ZWRNb2R1bGUucmVzb2x2ZWRGaWxlTmFtZSkpKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXNvbHZlZE1vZHVsZTtcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgY29tcGlsZXIgaG9zdCBpbXBsZW1lbnRhdGlvbiB0aGF0IGlzIHVzZWQgZm9yIHRoZSB0eXBpbmdzIHByb2dyYW0uIEl0IGxldmVyYWdlcyB0aGUgZW50cnktcG9pbnRcbiAqIGNhY2hlIGZvciBzb3VyY2UgZmlsZXMgYW5kIG1vZHVsZSByZXNvbHV0aW9uLCBhcyB0aGVzZSByZXN1bHRzIGNhbiBiZSByZXVzZWQgYWNyb3NzIHRoZSBzb3VyY2VzXG4gKiBwcm9ncmFtLlxuICovXG5leHBvcnQgY2xhc3MgTmdjY0R0c0NvbXBpbGVySG9zdCBleHRlbmRzIE5ndHNjQ29tcGlsZXJIb3N0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBmczogRmlsZVN5c3RlbSwgb3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zLCBwcml2YXRlIGNhY2hlOiBFbnRyeVBvaW50RmlsZUNhY2hlLFxuICAgICAgcHJpdmF0ZSBtb2R1bGVSZXNvbHV0aW9uQ2FjaGU6IHRzLk1vZHVsZVJlc29sdXRpb25DYWNoZSkge1xuICAgIHN1cGVyKGZzLCBvcHRpb25zKTtcbiAgfVxuXG4gIGdldFNvdXJjZUZpbGUoZmlsZU5hbWU6IHN0cmluZywgbGFuZ3VhZ2VWZXJzaW9uOiB0cy5TY3JpcHRUYXJnZXQpOiB0cy5Tb3VyY2VGaWxlfHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuY2FjaGUuZ2V0Q2FjaGVkU291cmNlRmlsZShmaWxlTmFtZSwgbGFuZ3VhZ2VWZXJzaW9uKTtcbiAgfVxuXG4gIHJlc29sdmVNb2R1bGVOYW1lcyhcbiAgICAgIG1vZHVsZU5hbWVzOiBzdHJpbmdbXSwgY29udGFpbmluZ0ZpbGU6IHN0cmluZywgcmV1c2VkTmFtZXM/OiBzdHJpbmdbXSxcbiAgICAgIHJlZGlyZWN0ZWRSZWZlcmVuY2U/OiB0cy5SZXNvbHZlZFByb2plY3RSZWZlcmVuY2UpOiBBcnJheTx0cy5SZXNvbHZlZE1vZHVsZXx1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gbW9kdWxlTmFtZXMubWFwKG1vZHVsZU5hbWUgPT4ge1xuICAgICAgY29uc3Qge3Jlc29sdmVkTW9kdWxlfSA9IHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICAgIG1vZHVsZU5hbWUsIGNvbnRhaW5pbmdGaWxlLCB0aGlzLm9wdGlvbnMsIHRoaXMsIHRoaXMubW9kdWxlUmVzb2x1dGlvbkNhY2hlLFxuICAgICAgICAgIHJlZGlyZWN0ZWRSZWZlcmVuY2UpO1xuICAgICAgcmV0dXJuIHJlc29sdmVkTW9kdWxlO1xuICAgIH0pO1xuICB9XG59XG4iXX0=