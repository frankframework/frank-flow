/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { dirname, resolve } from 'path';
import * as ts from 'typescript';
import { getImportOfIdentifier } from '../../../utils/typescript/imports';
import { getValueSymbolOfDeclaration } from '../../../utils/typescript/symbol';
import { getPosixPath } from './path_format';
import { getExportSymbolsOfFile } from './source_file_exports';
/**
 * Factory that creates a TypeScript transformer which ensures that
 * referenced identifiers are available at the target file location.
 *
 * Imports cannot be just added as sometimes identifiers collide in the
 * target source file and the identifier needs to be aliased.
 */
export class ImportRewriteTransformerFactory {
    constructor(importManager, typeChecker, compilerHost) {
        this.importManager = importManager;
        this.typeChecker = typeChecker;
        this.compilerHost = compilerHost;
        this.sourceFileExports = new Map();
    }
    create(ctx, newSourceFile) {
        const visitNode = (node) => {
            if (ts.isIdentifier(node)) {
                // Record the identifier reference and return the new identifier. The identifier
                // name can change if the generated import uses an namespaced import or aliased
                // import identifier (to avoid collisions).
                return this._recordIdentifierReference(node, newSourceFile);
            }
            return ts.visitEachChild(node, visitNode, ctx);
        };
        return (node) => ts.visitNode(node, visitNode);
    }
    _recordIdentifierReference(node, targetSourceFile) {
        // For object literal elements we don't want to check identifiers that describe the
        // property name. These identifiers do not refer to a value but rather to a property
        // name and therefore don't need to be imported. The exception is that for shorthand
        // property assignments the "name" identifier is both used as value and property name.
        if (ts.isObjectLiteralElementLike(node.parent) &&
            !ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node) {
            return node;
        }
        const resolvedImport = getImportOfIdentifier(this.typeChecker, node);
        const sourceFile = node.getSourceFile();
        if (resolvedImport) {
            const symbolName = resolvedImport.name;
            const moduleFileName = this.compilerHost.moduleNameToFileName(resolvedImport.importModule, sourceFile.fileName);
            // In case the identifier refers to an export in the target source file, we need to use
            // the local identifier in the scope of the target source file. This is necessary because
            // the export could be aliased and the alias is not available to the target source file.
            if (moduleFileName && resolve(moduleFileName) === resolve(targetSourceFile.fileName)) {
                const resolvedExport = this._getSourceFileExports(targetSourceFile).find(e => e.exportName === symbolName);
                if (resolvedExport) {
                    return resolvedExport.identifier;
                }
            }
            return this.importManager.addImportToSourceFile(targetSourceFile, symbolName, this._rewriteModuleImport(resolvedImport, targetSourceFile));
        }
        else {
            let symbol = getValueSymbolOfDeclaration(node, this.typeChecker);
            if (symbol) {
                // If the symbol refers to a shorthand property assignment, we want to resolve the
                // value symbol of the shorthand property assignment. This is necessary because the
                // value symbol is ambiguous for shorthand property assignment identifiers as the
                // identifier resolves to both property name and property value.
                if (symbol.valueDeclaration && ts.isShorthandPropertyAssignment(symbol.valueDeclaration)) {
                    symbol = this.typeChecker.getShorthandAssignmentValueSymbol(symbol.valueDeclaration);
                }
                const resolvedExport = this._getSourceFileExports(sourceFile).find(e => e.symbol === symbol);
                if (resolvedExport) {
                    return this.importManager.addImportToSourceFile(targetSourceFile, resolvedExport.exportName, getPosixPath(this.compilerHost.fileNameToModuleName(sourceFile.fileName, targetSourceFile.fileName)));
                }
            }
            // The referenced identifier cannot be imported. In that case we throw an exception
            // which can be handled outside of the transformer.
            throw new UnresolvedIdentifierError();
        }
    }
    /**
     * Gets the resolved exports of a given source file. Exports are cached
     * for subsequent calls.
     */
    _getSourceFileExports(sourceFile) {
        if (this.sourceFileExports.has(sourceFile)) {
            return this.sourceFileExports.get(sourceFile);
        }
        const sourceFileExports = getExportSymbolsOfFile(sourceFile, this.typeChecker);
        this.sourceFileExports.set(sourceFile, sourceFileExports);
        return sourceFileExports;
    }
    /** Rewrites a module import to be relative to the target file location. */
    _rewriteModuleImport(resolvedImport, newSourceFile) {
        if (!resolvedImport.importModule.startsWith('.')) {
            return resolvedImport.importModule;
        }
        const importFilePath = resolvedImport.node.getSourceFile().fileName;
        const resolvedModulePath = resolve(dirname(importFilePath), resolvedImport.importModule);
        const relativeModuleName = this.compilerHost.fileNameToModuleName(resolvedModulePath, newSourceFile.fileName);
        return getPosixPath(relativeModuleName);
    }
}
/** Error that will be thrown if a given identifier cannot be resolved. */
export class UnresolvedIdentifierError extends Error {
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0X3Jld3JpdGVfdmlzaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy9taWdyYXRpb25zL3VuZGVjb3JhdGVkLWNsYXNzZXMtd2l0aC1kaS9kZWNvcmF0b3JfcmV3cml0ZS9pbXBvcnRfcmV3cml0ZV92aXNpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxPQUFPLEVBQUUsT0FBTyxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQ3RDLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBR2pDLE9BQU8sRUFBQyxxQkFBcUIsRUFBUyxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hGLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBRTdFLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDM0MsT0FBTyxFQUFDLHNCQUFzQixFQUFpQixNQUFNLHVCQUF1QixDQUFDO0FBRzdFOzs7Ozs7R0FNRztBQUNILE1BQU0sT0FBTywrQkFBK0I7SUFHMUMsWUFDWSxhQUE0QixFQUFVLFdBQTJCLEVBQ2pFLFlBQTZCO1FBRDdCLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQVUsZ0JBQVcsR0FBWCxXQUFXLENBQWdCO1FBQ2pFLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUpqQyxzQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBbUMsQ0FBQztJQUkzQixDQUFDO0lBRTdDLE1BQU0sQ0FBb0IsR0FBNkIsRUFBRSxhQUE0QjtRQUVuRixNQUFNLFNBQVMsR0FBZSxDQUFDLElBQWEsRUFBRSxFQUFFO1lBQzlDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDekIsZ0ZBQWdGO2dCQUNoRiwrRUFBK0U7Z0JBQy9FLDJDQUEyQztnQkFDM0MsT0FBTyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO2FBQzdEO1lBRUQsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDakQsQ0FBQyxDQUFDO1FBRUYsT0FBTyxDQUFDLElBQU8sRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVPLDBCQUEwQixDQUFDLElBQW1CLEVBQUUsZ0JBQStCO1FBRXJGLG1GQUFtRjtRQUNuRixvRkFBb0Y7UUFDcEYsb0ZBQW9GO1FBQ3BGLHNGQUFzRjtRQUN0RixJQUFJLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQzFDLENBQUMsRUFBRSxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7WUFDL0UsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE1BQU0sY0FBYyxHQUFHLHFCQUFxQixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDckUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXhDLElBQUksY0FBYyxFQUFFO1lBQ2xCLE1BQU0sVUFBVSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUM7WUFDdkMsTUFBTSxjQUFjLEdBQ2hCLElBQUksQ0FBQyxZQUFZLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFN0YsdUZBQXVGO1lBQ3ZGLHlGQUF5RjtZQUN6Rix3RkFBd0Y7WUFDeEYsSUFBSSxjQUFjLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDcEYsTUFBTSxjQUFjLEdBQ2hCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssVUFBVSxDQUFDLENBQUM7Z0JBQ3hGLElBQUksY0FBYyxFQUFFO29CQUNsQixPQUFPLGNBQWMsQ0FBQyxVQUFVLENBQUM7aUJBQ2xDO2FBQ0Y7WUFFRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQzNDLGdCQUFnQixFQUFFLFVBQVUsRUFDNUIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDbEU7YUFBTTtZQUNMLElBQUksTUFBTSxHQUFHLDJCQUEyQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFakUsSUFBSSxNQUFNLEVBQUU7Z0JBQ1Ysa0ZBQWtGO2dCQUNsRixtRkFBbUY7Z0JBQ25GLGlGQUFpRjtnQkFDakYsZ0VBQWdFO2dCQUNoRSxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsSUFBSSxFQUFFLENBQUMsNkJBQTZCLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7b0JBQ3hGLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLGlDQUFpQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2lCQUN0RjtnQkFFRCxNQUFNLGNBQWMsR0FDaEIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLENBQUM7Z0JBRTFFLElBQUksY0FBYyxFQUFFO29CQUNsQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQzNDLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxVQUFVLEVBQzNDLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLG9CQUFvQixDQUMvQyxVQUFVLENBQUMsUUFBUSxFQUFFLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDM0Q7YUFDRjtZQUVELG1GQUFtRjtZQUNuRixtREFBbUQ7WUFDbkQsTUFBTSxJQUFJLHlCQUF5QixFQUFFLENBQUM7U0FDdkM7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0sscUJBQXFCLENBQUMsVUFBeUI7UUFDckQsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQzFDLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUUsQ0FBQztTQUNoRDtRQUVELE1BQU0saUJBQWlCLEdBQUcsc0JBQXNCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQzFELE9BQU8saUJBQWlCLENBQUM7SUFDM0IsQ0FBQztJQUVELDJFQUEyRTtJQUNuRSxvQkFBb0IsQ0FBQyxjQUFzQixFQUFFLGFBQTRCO1FBQy9FLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNoRCxPQUFPLGNBQWMsQ0FBQyxZQUFZLENBQUM7U0FDcEM7UUFFRCxNQUFNLGNBQWMsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUNwRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUUsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3pGLE1BQU0sa0JBQWtCLEdBQ3BCLElBQUksQ0FBQyxZQUFZLENBQUMsb0JBQW9CLENBQUMsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXZGLE9BQU8sWUFBWSxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDMUMsQ0FBQztDQUNGO0FBRUQsMEVBQTBFO0FBQzFFLE1BQU0sT0FBTyx5QkFBMEIsU0FBUSxLQUFLO0NBQUciLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBb3RDb21waWxlckhvc3R9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCB7ZGlybmFtZSwgcmVzb2x2ZX0gZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtJbXBvcnRNYW5hZ2VyfSBmcm9tICcuLi8uLi8uLi91dGlscy9pbXBvcnRfbWFuYWdlcic7XG5pbXBvcnQge2dldEltcG9ydE9mSWRlbnRpZmllciwgSW1wb3J0fSBmcm9tICcuLi8uLi8uLi91dGlscy90eXBlc2NyaXB0L2ltcG9ydHMnO1xuaW1wb3J0IHtnZXRWYWx1ZVN5bWJvbE9mRGVjbGFyYXRpb259IGZyb20gJy4uLy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvc3ltYm9sJztcblxuaW1wb3J0IHtnZXRQb3NpeFBhdGh9IGZyb20gJy4vcGF0aF9mb3JtYXQnO1xuaW1wb3J0IHtnZXRFeHBvcnRTeW1ib2xzT2ZGaWxlLCBSZXNvbHZlZEV4cG9ydH0gZnJvbSAnLi9zb3VyY2VfZmlsZV9leHBvcnRzJztcblxuXG4vKipcbiAqIEZhY3RvcnkgdGhhdCBjcmVhdGVzIGEgVHlwZVNjcmlwdCB0cmFuc2Zvcm1lciB3aGljaCBlbnN1cmVzIHRoYXRcbiAqIHJlZmVyZW5jZWQgaWRlbnRpZmllcnMgYXJlIGF2YWlsYWJsZSBhdCB0aGUgdGFyZ2V0IGZpbGUgbG9jYXRpb24uXG4gKlxuICogSW1wb3J0cyBjYW5ub3QgYmUganVzdCBhZGRlZCBhcyBzb21ldGltZXMgaWRlbnRpZmllcnMgY29sbGlkZSBpbiB0aGVcbiAqIHRhcmdldCBzb3VyY2UgZmlsZSBhbmQgdGhlIGlkZW50aWZpZXIgbmVlZHMgdG8gYmUgYWxpYXNlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIEltcG9ydFJld3JpdGVUcmFuc2Zvcm1lckZhY3Rvcnkge1xuICBwcml2YXRlIHNvdXJjZUZpbGVFeHBvcnRzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBSZXNvbHZlZEV4cG9ydFtdPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBpbXBvcnRNYW5hZ2VyOiBJbXBvcnRNYW5hZ2VyLCBwcml2YXRlIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcixcbiAgICAgIHByaXZhdGUgY29tcGlsZXJIb3N0OiBBb3RDb21waWxlckhvc3QpIHt9XG5cbiAgY3JlYXRlPFQgZXh0ZW5kcyB0cy5Ob2RlPihjdHg6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCwgbmV3U291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6XG4gICAgICB0cy5UcmFuc2Zvcm1lcjxUPiB7XG4gICAgY29uc3QgdmlzaXROb2RlOiB0cy5WaXNpdG9yID0gKG5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICAgIGlmICh0cy5pc0lkZW50aWZpZXIobm9kZSkpIHtcbiAgICAgICAgLy8gUmVjb3JkIHRoZSBpZGVudGlmaWVyIHJlZmVyZW5jZSBhbmQgcmV0dXJuIHRoZSBuZXcgaWRlbnRpZmllci4gVGhlIGlkZW50aWZpZXJcbiAgICAgICAgLy8gbmFtZSBjYW4gY2hhbmdlIGlmIHRoZSBnZW5lcmF0ZWQgaW1wb3J0IHVzZXMgYW4gbmFtZXNwYWNlZCBpbXBvcnQgb3IgYWxpYXNlZFxuICAgICAgICAvLyBpbXBvcnQgaWRlbnRpZmllciAodG8gYXZvaWQgY29sbGlzaW9ucykuXG4gICAgICAgIHJldHVybiB0aGlzLl9yZWNvcmRJZGVudGlmaWVyUmVmZXJlbmNlKG5vZGUsIG5ld1NvdXJjZUZpbGUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHMudmlzaXRFYWNoQ2hpbGQobm9kZSwgdmlzaXROb2RlLCBjdHgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gKG5vZGU6IFQpID0+IHRzLnZpc2l0Tm9kZShub2RlLCB2aXNpdE5vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVjb3JkSWRlbnRpZmllclJlZmVyZW5jZShub2RlOiB0cy5JZGVudGlmaWVyLCB0YXJnZXRTb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTpcbiAgICAgIHRzLk5vZGUge1xuICAgIC8vIEZvciBvYmplY3QgbGl0ZXJhbCBlbGVtZW50cyB3ZSBkb24ndCB3YW50IHRvIGNoZWNrIGlkZW50aWZpZXJzIHRoYXQgZGVzY3JpYmUgdGhlXG4gICAgLy8gcHJvcGVydHkgbmFtZS4gVGhlc2UgaWRlbnRpZmllcnMgZG8gbm90IHJlZmVyIHRvIGEgdmFsdWUgYnV0IHJhdGhlciB0byBhIHByb3BlcnR5XG4gICAgLy8gbmFtZSBhbmQgdGhlcmVmb3JlIGRvbid0IG5lZWQgdG8gYmUgaW1wb3J0ZWQuIFRoZSBleGNlcHRpb24gaXMgdGhhdCBmb3Igc2hvcnRoYW5kXG4gICAgLy8gcHJvcGVydHkgYXNzaWdubWVudHMgdGhlIFwibmFtZVwiIGlkZW50aWZpZXIgaXMgYm90aCB1c2VkIGFzIHZhbHVlIGFuZCBwcm9wZXJ0eSBuYW1lLlxuICAgIGlmICh0cy5pc09iamVjdExpdGVyYWxFbGVtZW50TGlrZShub2RlLnBhcmVudCkgJiZcbiAgICAgICAgIXRzLmlzU2hvcnRoYW5kUHJvcGVydHlBc3NpZ25tZW50KG5vZGUucGFyZW50KSAmJiBub2RlLnBhcmVudC5uYW1lID09PSBub2RlKSB7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvbHZlZEltcG9ydCA9IGdldEltcG9ydE9mSWRlbnRpZmllcih0aGlzLnR5cGVDaGVja2VyLCBub2RlKTtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gbm9kZS5nZXRTb3VyY2VGaWxlKCk7XG5cbiAgICBpZiAocmVzb2x2ZWRJbXBvcnQpIHtcbiAgICAgIGNvbnN0IHN5bWJvbE5hbWUgPSByZXNvbHZlZEltcG9ydC5uYW1lO1xuICAgICAgY29uc3QgbW9kdWxlRmlsZU5hbWUgPVxuICAgICAgICAgIHRoaXMuY29tcGlsZXJIb3N0Lm1vZHVsZU5hbWVUb0ZpbGVOYW1lKHJlc29sdmVkSW1wb3J0LmltcG9ydE1vZHVsZSwgc291cmNlRmlsZS5maWxlTmFtZSk7XG5cbiAgICAgIC8vIEluIGNhc2UgdGhlIGlkZW50aWZpZXIgcmVmZXJzIHRvIGFuIGV4cG9ydCBpbiB0aGUgdGFyZ2V0IHNvdXJjZSBmaWxlLCB3ZSBuZWVkIHRvIHVzZVxuICAgICAgLy8gdGhlIGxvY2FsIGlkZW50aWZpZXIgaW4gdGhlIHNjb3BlIG9mIHRoZSB0YXJnZXQgc291cmNlIGZpbGUuIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2VcbiAgICAgIC8vIHRoZSBleHBvcnQgY291bGQgYmUgYWxpYXNlZCBhbmQgdGhlIGFsaWFzIGlzIG5vdCBhdmFpbGFibGUgdG8gdGhlIHRhcmdldCBzb3VyY2UgZmlsZS5cbiAgICAgIGlmIChtb2R1bGVGaWxlTmFtZSAmJiByZXNvbHZlKG1vZHVsZUZpbGVOYW1lKSA9PT0gcmVzb2x2ZSh0YXJnZXRTb3VyY2VGaWxlLmZpbGVOYW1lKSkge1xuICAgICAgICBjb25zdCByZXNvbHZlZEV4cG9ydCA9XG4gICAgICAgICAgICB0aGlzLl9nZXRTb3VyY2VGaWxlRXhwb3J0cyh0YXJnZXRTb3VyY2VGaWxlKS5maW5kKGUgPT4gZS5leHBvcnROYW1lID09PSBzeW1ib2xOYW1lKTtcbiAgICAgICAgaWYgKHJlc29sdmVkRXhwb3J0KSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmVkRXhwb3J0LmlkZW50aWZpZXI7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuaW1wb3J0TWFuYWdlci5hZGRJbXBvcnRUb1NvdXJjZUZpbGUoXG4gICAgICAgICAgdGFyZ2V0U291cmNlRmlsZSwgc3ltYm9sTmFtZSxcbiAgICAgICAgICB0aGlzLl9yZXdyaXRlTW9kdWxlSW1wb3J0KHJlc29sdmVkSW1wb3J0LCB0YXJnZXRTb3VyY2VGaWxlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBzeW1ib2wgPSBnZXRWYWx1ZVN5bWJvbE9mRGVjbGFyYXRpb24obm9kZSwgdGhpcy50eXBlQ2hlY2tlcik7XG5cbiAgICAgIGlmIChzeW1ib2wpIHtcbiAgICAgICAgLy8gSWYgdGhlIHN5bWJvbCByZWZlcnMgdG8gYSBzaG9ydGhhbmQgcHJvcGVydHkgYXNzaWdubWVudCwgd2Ugd2FudCB0byByZXNvbHZlIHRoZVxuICAgICAgICAvLyB2YWx1ZSBzeW1ib2wgb2YgdGhlIHNob3J0aGFuZCBwcm9wZXJ0eSBhc3NpZ25tZW50LiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHRoZVxuICAgICAgICAvLyB2YWx1ZSBzeW1ib2wgaXMgYW1iaWd1b3VzIGZvciBzaG9ydGhhbmQgcHJvcGVydHkgYXNzaWdubWVudCBpZGVudGlmaWVycyBhcyB0aGVcbiAgICAgICAgLy8gaWRlbnRpZmllciByZXNvbHZlcyB0byBib3RoIHByb3BlcnR5IG5hbWUgYW5kIHByb3BlcnR5IHZhbHVlLlxuICAgICAgICBpZiAoc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24gJiYgdHMuaXNTaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQoc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pKSB7XG4gICAgICAgICAgc3ltYm9sID0gdGhpcy50eXBlQ2hlY2tlci5nZXRTaG9ydGhhbmRBc3NpZ25tZW50VmFsdWVTeW1ib2woc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzb2x2ZWRFeHBvcnQgPVxuICAgICAgICAgICAgdGhpcy5fZ2V0U291cmNlRmlsZUV4cG9ydHMoc291cmNlRmlsZSkuZmluZChlID0+IGUuc3ltYm9sID09PSBzeW1ib2wpO1xuXG4gICAgICAgIGlmIChyZXNvbHZlZEV4cG9ydCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmltcG9ydE1hbmFnZXIuYWRkSW1wb3J0VG9Tb3VyY2VGaWxlKFxuICAgICAgICAgICAgICB0YXJnZXRTb3VyY2VGaWxlLCByZXNvbHZlZEV4cG9ydC5leHBvcnROYW1lLFxuICAgICAgICAgICAgICBnZXRQb3NpeFBhdGgodGhpcy5jb21waWxlckhvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgICAgICAgICAgICAgICBzb3VyY2VGaWxlLmZpbGVOYW1lLCB0YXJnZXRTb3VyY2VGaWxlLmZpbGVOYW1lKSkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSByZWZlcmVuY2VkIGlkZW50aWZpZXIgY2Fubm90IGJlIGltcG9ydGVkLiBJbiB0aGF0IGNhc2Ugd2UgdGhyb3cgYW4gZXhjZXB0aW9uXG4gICAgICAvLyB3aGljaCBjYW4gYmUgaGFuZGxlZCBvdXRzaWRlIG9mIHRoZSB0cmFuc2Zvcm1lci5cbiAgICAgIHRocm93IG5ldyBVbnJlc29sdmVkSWRlbnRpZmllckVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIHJlc29sdmVkIGV4cG9ydHMgb2YgYSBnaXZlbiBzb3VyY2UgZmlsZS4gRXhwb3J0cyBhcmUgY2FjaGVkXG4gICAqIGZvciBzdWJzZXF1ZW50IGNhbGxzLlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0U291cmNlRmlsZUV4cG9ydHMoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IFJlc29sdmVkRXhwb3J0W10ge1xuICAgIGlmICh0aGlzLnNvdXJjZUZpbGVFeHBvcnRzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgcmV0dXJuIHRoaXMuc291cmNlRmlsZUV4cG9ydHMuZ2V0KHNvdXJjZUZpbGUpITtcbiAgICB9XG5cbiAgICBjb25zdCBzb3VyY2VGaWxlRXhwb3J0cyA9IGdldEV4cG9ydFN5bWJvbHNPZkZpbGUoc291cmNlRmlsZSwgdGhpcy50eXBlQ2hlY2tlcik7XG4gICAgdGhpcy5zb3VyY2VGaWxlRXhwb3J0cy5zZXQoc291cmNlRmlsZSwgc291cmNlRmlsZUV4cG9ydHMpO1xuICAgIHJldHVybiBzb3VyY2VGaWxlRXhwb3J0cztcbiAgfVxuXG4gIC8qKiBSZXdyaXRlcyBhIG1vZHVsZSBpbXBvcnQgdG8gYmUgcmVsYXRpdmUgdG8gdGhlIHRhcmdldCBmaWxlIGxvY2F0aW9uLiAqL1xuICBwcml2YXRlIF9yZXdyaXRlTW9kdWxlSW1wb3J0KHJlc29sdmVkSW1wb3J0OiBJbXBvcnQsIG5ld1NvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBzdHJpbmcge1xuICAgIGlmICghcmVzb2x2ZWRJbXBvcnQuaW1wb3J0TW9kdWxlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgcmV0dXJuIHJlc29sdmVkSW1wb3J0LmltcG9ydE1vZHVsZTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBvcnRGaWxlUGF0aCA9IHJlc29sdmVkSW1wb3J0Lm5vZGUuZ2V0U291cmNlRmlsZSgpLmZpbGVOYW1lO1xuICAgIGNvbnN0IHJlc29sdmVkTW9kdWxlUGF0aCA9IHJlc29sdmUoZGlybmFtZShpbXBvcnRGaWxlUGF0aCksIHJlc29sdmVkSW1wb3J0LmltcG9ydE1vZHVsZSk7XG4gICAgY29uc3QgcmVsYXRpdmVNb2R1bGVOYW1lID1cbiAgICAgICAgdGhpcy5jb21waWxlckhvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUocmVzb2x2ZWRNb2R1bGVQYXRoLCBuZXdTb3VyY2VGaWxlLmZpbGVOYW1lKTtcblxuICAgIHJldHVybiBnZXRQb3NpeFBhdGgocmVsYXRpdmVNb2R1bGVOYW1lKTtcbiAgfVxufVxuXG4vKiogRXJyb3IgdGhhdCB3aWxsIGJlIHRocm93biBpZiBhIGdpdmVuIGlkZW50aWZpZXIgY2Fubm90IGJlIHJlc29sdmVkLiAqL1xuZXhwb3J0IGNsYXNzIFVucmVzb2x2ZWRJZGVudGlmaWVyRXJyb3IgZXh0ZW5kcyBFcnJvciB7fVxuIl19