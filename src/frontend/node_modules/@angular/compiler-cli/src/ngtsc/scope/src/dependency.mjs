/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Reads Angular metadata from classes declared in .d.ts files and computes an `ExportScope`.
 *
 * Given an NgModule declared in a .d.ts file, this resolver can produce a transitive `ExportScope`
 * of all of the directives/pipes it exports. It does this by reading metadata off of Ivy static
 * fields on directives, components, pipes, and NgModules.
 */
export class MetadataDtsModuleScopeResolver {
    /**
     * @param dtsMetaReader a `MetadataReader` which can read metadata from `.d.ts` files.
     */
    constructor(dtsMetaReader, aliasingHost) {
        this.dtsMetaReader = dtsMetaReader;
        this.aliasingHost = aliasingHost;
        /**
         * Cache which holds fully resolved scopes for NgModule classes from .d.ts files.
         */
        this.cache = new Map();
    }
    /**
     * Resolve a `Reference`'d NgModule from a .d.ts file and produce a transitive `ExportScope`
     * listing the directives and pipes which that NgModule exports to others.
     *
     * This operation relies on a `Reference` instead of a direct TypeScrpt node as the `Reference`s
     * produced depend on how the original NgModule was imported.
     */
    resolve(ref) {
        const clazz = ref.node;
        const sourceFile = clazz.getSourceFile();
        if (!sourceFile.isDeclarationFile) {
            throw new Error(`Debug error: DtsModuleScopeResolver.read(${ref.debugName} from ${sourceFile.fileName}), but not a .d.ts file`);
        }
        if (this.cache.has(clazz)) {
            return this.cache.get(clazz);
        }
        // Build up the export scope - those directives and pipes made visible by this module.
        const directives = [];
        const pipes = [];
        const ngModules = new Set([clazz]);
        const meta = this.dtsMetaReader.getNgModuleMetadata(ref);
        if (meta === null) {
            this.cache.set(clazz, null);
            return null;
        }
        const declarations = new Set();
        for (const declRef of meta.declarations) {
            declarations.add(declRef.node);
        }
        // Only the 'exports' field of the NgModule's metadata is important. Imports and declarations
        // don't affect the export scope.
        for (const exportRef of meta.exports) {
            // Attempt to process the export as a directive.
            const directive = this.dtsMetaReader.getDirectiveMetadata(exportRef);
            if (directive !== null) {
                const isReExport = !declarations.has(exportRef.node);
                directives.push(this.maybeAlias(directive, sourceFile, isReExport));
                continue;
            }
            // Attempt to process the export as a pipe.
            const pipe = this.dtsMetaReader.getPipeMetadata(exportRef);
            if (pipe !== null) {
                const isReExport = !declarations.has(exportRef.node);
                pipes.push(this.maybeAlias(pipe, sourceFile, isReExport));
                continue;
            }
            // Attempt to process the export as a module.
            const exportScope = this.resolve(exportRef);
            if (exportScope !== null) {
                // It is a module. Add exported directives and pipes to the current scope. This might
                // involve rewriting the `Reference`s to those types to have an alias expression if one is
                // required.
                if (this.aliasingHost === null) {
                    // Fast path when aliases aren't required.
                    directives.push(...exportScope.exported.directives);
                    pipes.push(...exportScope.exported.pipes);
                }
                else {
                    // It's necessary to rewrite the `Reference`s to add alias expressions. This way, imports
                    // generated to these directives and pipes will use a shallow import to `sourceFile`
                    // instead of a deep import directly to the directive or pipe class.
                    //
                    // One important check here is whether the directive/pipe is declared in the same
                    // source file as the re-exporting NgModule. This can happen if both a directive, its
                    // NgModule, and the re-exporting NgModule are all in the same file. In this case,
                    // no import alias is needed as it would go to the same file anyway.
                    for (const directive of exportScope.exported.directives) {
                        directives.push(this.maybeAlias(directive, sourceFile, /* isReExport */ true));
                    }
                    for (const pipe of exportScope.exported.pipes) {
                        pipes.push(this.maybeAlias(pipe, sourceFile, /* isReExport */ true));
                    }
                    for (const ngModule of exportScope.exported.ngModules) {
                        ngModules.add(ngModule);
                    }
                }
            }
            continue;
            // The export was not a directive, a pipe, or a module. This is an error.
            // TODO(alxhub): produce a ts.Diagnostic
        }
        const exportScope = {
            exported: {
                directives,
                pipes,
                ngModules: Array.from(ngModules),
                isPoisoned: false,
            },
        };
        this.cache.set(clazz, exportScope);
        return exportScope;
    }
    maybeAlias(dirOrPipe, maybeAliasFrom, isReExport) {
        const ref = dirOrPipe.ref;
        if (this.aliasingHost === null || ref.node.getSourceFile() === maybeAliasFrom) {
            return dirOrPipe;
        }
        const alias = this.aliasingHost.getAliasIn(ref.node, maybeAliasFrom, isReExport);
        if (alias === null) {
            return dirOrPipe;
        }
        // TypeScript incorrectly narrows the type here:
        // https://github.com/microsoft/TypeScript/issues/43966.
        // TODO: Remove/Update once https://github.com/microsoft/TypeScript/issues/43966 is resolved.
        return Object.assign(Object.assign({}, dirOrPipe), { ref: ref.cloneWithAlias(alias) });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwZW5kZW5jeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2Mvc2NvcGUvc3JjL2RlcGVuZGVuY3kudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBY0g7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLDhCQUE4QjtJQU16Qzs7T0FFRztJQUNILFlBQW9CLGFBQTZCLEVBQVUsWUFBK0I7UUFBdEUsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQVUsaUJBQVksR0FBWixZQUFZLENBQW1CO1FBUjFGOztXQUVHO1FBQ0ssVUFBSyxHQUFHLElBQUksR0FBRyxFQUFzQyxDQUFDO0lBSytCLENBQUM7SUFFOUY7Ozs7OztPQU1HO0lBQ0gsT0FBTyxDQUFDLEdBQWdDO1FBQ3RDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDdkIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLEVBQUU7WUFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsR0FBRyxDQUFDLFNBQVMsU0FDckUsVUFBVSxDQUFDLFFBQVEseUJBQXlCLENBQUMsQ0FBQztTQUNuRDtRQUVELElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUUsQ0FBQztTQUMvQjtRQUVELHNGQUFzRjtRQUN0RixNQUFNLFVBQVUsR0FBb0IsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sS0FBSyxHQUFlLEVBQUUsQ0FBQztRQUM3QixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRXJELE1BQU0sSUFB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UyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztxQkFDekI7aUJBQ0Y7YUFDRjtZQUNELFNBQVM7WUFFVCx5RUFBeUU7WUFDekUsd0NBQXdDO1NBQ3pDO1FBRUQsTUFBTSxXQUFXLEdBQWdCO1lBQy9CLFFBQVEsRUFBRTtnQkFDUixVQUFVO2dCQUNWLEtBQUs7Z0JBQ0wsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNoQyxVQUFVLEVBQUUsS0FBSzthQUNsQjtTQUNGLENBQUM7UUFDRixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbkMsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVPLFVBQVUsQ0FDZCxTQUFZLEVBQUUsY0FBNkIsRUFBRSxVQUFtQjtRQUNsRSxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDO1FBQzFCLElBQUksSUFBSSxDQUFDLFlBQVksS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxjQUFjLEVBQUU7WUFDN0UsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNqRixJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFDbEIsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFFRCxnREFBZ0Q7UUFDaEQsd0RBQXdEO1FBQ3hELDZGQUE2RjtRQUM3RixPQUFPLGdDQUNGLFNBQVMsS0FDWixHQUFHLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FDMUIsQ0FBQztJQUNULENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtBbGlhc2luZ0hvc3QsIFJlZmVyZW5jZX0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0RpcmVjdGl2ZU1ldGEsIE1ldGFkYXRhUmVhZGVyLCBQaXBlTWV0YX0gZnJvbSAnLi4vLi4vbWV0YWRhdGEnO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9ufSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcblxuaW1wb3J0IHtFeHBvcnRTY29wZX0gZnJvbSAnLi9hcGknO1xuXG5leHBvcnQgaW50ZXJmYWNlIER0c01vZHVsZVNjb3BlUmVzb2x2ZXIge1xuICByZXNvbHZlKHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+KTogRXhwb3J0U2NvcGV8bnVsbDtcbn1cblxuLyoqXG4gKiBSZWFkcyBBbmd1bGFyIG1ldGFkYXRhIGZyb20gY2xhc3NlcyBkZWNsYXJlZCBpbiAuZC50cyBmaWxlcyBhbmQgY29tcHV0ZXMgYW4gYEV4cG9ydFNjb3BlYC5cbiAqXG4gKiBHaXZlbiBhbiBOZ01vZHVsZSBkZWNsYXJlZCBpbiBhIC5kLnRzIGZpbGUsIHRoaXMgcmVzb2x2ZXIgY2FuIHByb2R1Y2UgYSB0cmFuc2l0aXZlIGBFeHBvcnRTY29wZWBcbiAqIG9mIGFsbCBvZiB0aGUgZGlyZWN0aXZlcy9waXBlcyBpdCBleHBvcnRzLiBJdCBkb2VzIHRoaXMgYnkgcmVhZGluZyBtZXRhZGF0YSBvZmYgb2YgSXZ5IHN0YXRpY1xuICogZmllbGRzIG9uIGRpcmVjdGl2ZXMsIGNvbXBvbmVudHMsIHBpcGVzLCBhbmQgTmdNb2R1bGVzLlxuICovXG5leHBvcnQgY2xhc3MgTWV0YWRhdGFEdHNNb2R1bGVTY29wZVJlc29sdmVyIGltcGxlbWVudHMgRHRzTW9kdWxlU2NvcGVSZXNvbHZlciB7XG4gIC8qKlxuICAgKiBDYWNoZSB3aGljaCBob2xkcyBmdWxseSByZXNvbHZlZCBzY29wZXMgZm9yIE5nTW9kdWxlIGNsYXNzZXMgZnJvbSAuZC50cyBmaWxlcy5cbiAgICovXG4gIHByaXZhdGUgY2FjaGUgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIEV4cG9ydFNjb3BlfG51bGw+KCk7XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBkdHNNZXRhUmVhZGVyIGEgYE1ldGFkYXRhUmVhZGVyYCB3aGljaCBjYW4gcmVhZCBtZXRhZGF0YSBmcm9tIGAuZC50c2AgZmlsZXMuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGR0c01ldGFSZWFkZXI6IE1ldGFkYXRhUmVhZGVyLCBwcml2YXRlIGFsaWFzaW5nSG9zdDogQWxpYXNpbmdIb3N0fG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIFJlc29sdmUgYSBgUmVmZXJlbmNlYCdkIE5nTW9kdWxlIGZyb20gYSAuZC50cyBmaWxlIGFuZCBwcm9kdWNlIGEgdHJhbnNpdGl2ZSBgRXhwb3J0U2NvcGVgXG4gICAqIGxpc3RpbmcgdGhlIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIHdoaWNoIHRoYXQgTmdNb2R1bGUgZXhwb3J0cyB0byBvdGhlcnMuXG4gICAqXG4gICAqIFRoaXMgb3BlcmF0aW9uIHJlbGllcyBvbiBhIGBSZWZlcmVuY2VgIGluc3RlYWQgb2YgYSBkaXJlY3QgVHlwZVNjcnB0IG5vZGUgYXMgdGhlIGBSZWZlcmVuY2Vgc1xuICAgKiBwcm9kdWNlZCBkZXBlbmQgb24gaG93IHRoZSBvcmlnaW5hbCBOZ01vZHVsZSB3YXMgaW1wb3J0ZWQuXG4gICAqL1xuICByZXNvbHZlKHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+KTogRXhwb3J0U2NvcGV8bnVsbCB7XG4gICAgY29uc3QgY2xhenogPSByZWYubm9kZTtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gY2xhenouZ2V0U291cmNlRmlsZSgpO1xuICAgIGlmICghc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBEZWJ1ZyBlcnJvcjogRHRzTW9kdWxlU2NvcGVSZXNvbHZlci5yZWFkKCR7cmVmLmRlYnVnTmFtZX0gZnJvbSAke1xuICAgICAgICAgIHNvdXJjZUZpbGUuZmlsZU5hbWV9KSwgYnV0IG5vdCBhIC5kLnRzIGZpbGVgKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYWNoZS5oYXMoY2xhenopKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWNoZS5nZXQoY2xhenopITtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCB1cCB0aGUgZXhwb3J0IHNjb3BlIC0gdGhvc2UgZGlyZWN0aXZlcyBhbmQgcGlwZXMgbWFkZSB2aXNpYmxlIGJ5IHRoaXMgbW9kdWxlLlxuICAgIGNvbnN0IGRpcmVjdGl2ZXM6IERpcmVjdGl2ZU1ldGFbXSA9IFtdO1xuICAgIGNvbnN0IHBpcGVzOiBQaXBlTWV0YVtdID0gW107XG4gICAgY29uc3QgbmdNb2R1bGVzID0gbmV3IFNldDxDbGFzc0RlY2xhcmF0aW9uPihbY2xhenpdKTtcblxuICAgIGNvbnN0IG1ldGEgPSB0aGlzLmR0c01ldGFSZWFkZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShyZWYpO1xuICAgIGlmIChtZXRhID09PSBudWxsKSB7XG4gICAgICB0aGlzLmNhY2hlLnNldChjbGF6eiwgbnVsbCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNsYXJhdGlvbnMgPSBuZXcgU2V0PENsYXNzRGVjbGFyYXRpb24+KCk7XG4gICAgZm9yIChjb25zdCBkZWNsUmVmIG9mIG1ldGEuZGVjbGFyYXRpb25zKSB7XG4gICAgICBkZWNsYXJhdGlvbnMuYWRkKGRlY2xSZWYubm9kZSk7XG4gICAgfVxuXG4gICAgLy8gT25seSB0aGUgJ2V4cG9ydHMnIGZpZWxkIG9mIHRoZSBOZ01vZHVsZSdzIG1ldGFkYXRhIGlzIGltcG9ydGFudC4gSW1wb3J0cyBhbmQgZGVjbGFyYXRpb25zXG4gICAgLy8gZG9uJ3QgYWZmZWN0IHRoZSBleHBvcnQgc2NvcGUuXG4gICAgZm9yIChjb25zdCBleHBvcnRSZWYgb2YgbWV0YS5leHBvcnRzKSB7XG4gICAgICAvLyBBdHRlbXB0IHRvIHByb2Nlc3MgdGhlIGV4cG9ydCBhcyBhIGRpcmVjdGl2ZS5cbiAgICAgIGNvbnN0IGRpcmVjdGl2ZSA9IHRoaXMuZHRzTWV0YVJlYWRlci5nZXREaXJlY3RpdmVNZXRhZGF0YShleHBvcnRSZWYpO1xuICAgICAgaWYgKGRpcmVjdGl2ZSAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBpc1JlRXhwb3J0ID0gIWRlY2xhcmF0aW9ucy5oYXMoZXhwb3J0UmVmLm5vZGUpO1xuICAgICAgICBkaXJlY3RpdmVzLnB1c2godGhpcy5tYXliZUFsaWFzKGRpcmVjdGl2ZSwgc291cmNlRmlsZSwgaXNSZUV4cG9ydCkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQXR0ZW1wdCB0byBwcm9jZXNzIHRoZSBleHBvcnQgYXMgYSBwaXBlLlxuICAgICAgY29uc3QgcGlwZSA9IHRoaXMuZHRzTWV0YVJlYWRlci5nZXRQaXBlTWV0YWRhdGEoZXhwb3J0UmVmKTtcbiAgICAgIGlmIChwaXBlICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGlzUmVFeHBvcnQgPSAhZGVjbGFyYXRpb25zLmhhcyhleHBvcnRSZWYubm9kZSk7XG4gICAgICAgIHBpcGVzLnB1c2godGhpcy5tYXliZUFsaWFzKHBpcGUsIHNvdXJjZUZpbGUsIGlzUmVFeHBvcnQpKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEF0dGVtcHQgdG8gcHJvY2VzcyB0aGUgZXhwb3J0IGFzIGEgbW9kdWxlLlxuICAgICAgY29uc3QgZXhwb3J0U2NvcGUgPSB0aGlzLnJlc29sdmUoZXhwb3J0UmVmKTtcbiAgICAgIGlmIChleHBvcnRTY29wZSAhPT0gbnVsbCkge1xuICAgICAgICAvLyBJdCBpcyBhIG1vZHVsZS4gQWRkIGV4cG9ydGVkIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIHRvIHRoZSBjdXJyZW50IHNjb3BlLiBUaGlzIG1pZ2h0XG4gICAgICAgIC8vIGludm9sdmUgcmV3cml0aW5nIHRoZSBgUmVmZXJlbmNlYHMgdG8gdGhvc2UgdHlwZXMgdG8gaGF2ZSBhbiBhbGlhcyBleHByZXNzaW9uIGlmIG9uZSBpc1xuICAgICAgICAvLyByZXF1aXJlZC5cbiAgICAgICAgaWYgKHRoaXMuYWxpYXNpbmdIb3N0ID09PSBudWxsKSB7XG4gICAgICAgICAgLy8gRmFzdCBwYXRoIHdoZW4gYWxpYXNlcyBhcmVuJ3QgcmVxdWlyZWQuXG4gICAgICAgICAgZGlyZWN0aXZlcy5wdXNoKC4uLmV4cG9ydFNjb3BlLmV4cG9ydGVkLmRpcmVjdGl2ZXMpO1xuICAgICAgICAgIHBpcGVzLnB1c2goLi4uZXhwb3J0U2NvcGUuZXhwb3J0ZWQucGlwZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEl0J3MgbmVjZXNzYXJ5IHRvIHJld3JpdGUgdGhlIGBSZWZlcmVuY2VgcyB0byBhZGQgYWxpYXMgZXhwcmVzc2lvbnMuIFRoaXMgd2F5LCBpbXBvcnRzXG4gICAgICAgICAgLy8gZ2VuZXJhdGVkIHRvIHRoZXNlIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIHdpbGwgdXNlIGEgc2hhbGxvdyBpbXBvcnQgdG8gYHNvdXJjZUZpbGVgXG4gICAgICAgICAgLy8gaW5zdGVhZCBvZiBhIGRlZXAgaW1wb3J0IGRpcmVjdGx5IHRvIHRoZSBkaXJlY3RpdmUgb3IgcGlwZSBjbGFzcy5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIE9uZSBpbXBvcnRhbnQgY2hlY2sgaGVyZSBpcyB3aGV0aGVyIHRoZSBkaXJlY3RpdmUvcGlwZSBpcyBkZWNsYXJlZCBpbiB0aGUgc2FtZVxuICAgICAgICAgIC8vIHNvdXJjZSBmaWxlIGFzIHRoZSByZS1leHBvcnRpbmcgTmdNb2R1bGUuIFRoaXMgY2FuIGhhcHBlbiBpZiBib3RoIGEgZGlyZWN0aXZlLCBpdHNcbiAgICAgICAgICAvLyBOZ01vZHVsZSwgYW5kIHRoZSByZS1leHBvcnRpbmcgTmdNb2R1bGUgYXJlIGFsbCBpbiB0aGUgc2FtZSBmaWxlLiBJbiB0aGlzIGNhc2UsXG4gICAgICAgICAgLy8gbm8gaW1wb3J0IGFsaWFzIGlzIG5lZWRlZCBhcyBpdCB3b3VsZCBnbyB0byB0aGUgc2FtZSBmaWxlIGFueXdheS5cbiAgICAgICAgICBmb3IgKGNvbnN0IGRpcmVjdGl2ZSBvZiBleHBvcnRTY29wZS5leHBvcnRlZC5kaXJlY3RpdmVzKSB7XG4gICAgICAgICAgICBkaXJlY3RpdmVzLnB1c2godGhpcy5tYXliZUFsaWFzKGRpcmVjdGl2ZSwgc291cmNlRmlsZSwgLyogaXNSZUV4cG9ydCAqLyB0cnVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAoY29uc3QgcGlwZSBvZiBleHBvcnRTY29wZS5leHBvcnRlZC5waXBlcykge1xuICAgICAgICAgICAgcGlwZXMucHVzaCh0aGlzLm1heWJlQWxpYXMocGlwZSwgc291cmNlRmlsZSwgLyogaXNSZUV4cG9ydCAqLyB0cnVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAoY29uc3QgbmdNb2R1bGUgb2YgZXhwb3J0U2NvcGUuZXhwb3J0ZWQubmdNb2R1bGVzKSB7XG4gICAgICAgICAgICBuZ01vZHVsZXMuYWRkKG5nTW9kdWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAvLyBUaGUgZXhwb3J0IHdhcyBub3QgYSBkaXJlY3RpdmUsIGEgcGlwZSwgb3IgYSBtb2R1bGUuIFRoaXMgaXMgYW4gZXJyb3IuXG4gICAgICAvLyBUT0RPKGFseGh1Yik6IHByb2R1Y2UgYSB0cy5EaWFnbm9zdGljXG4gICAgfVxuXG4gICAgY29uc3QgZXhwb3J0U2NvcGU6IEV4cG9ydFNjb3BlID0ge1xuICAgICAgZXhwb3J0ZWQ6IHtcbiAgICAgICAgZGlyZWN0aXZlcyxcbiAgICAgICAgcGlwZXMsXG4gICAgICAgIG5nTW9kdWxlczogQXJyYXkuZnJvbShuZ01vZHVsZXMpLFxuICAgICAgICBpc1BvaXNvbmVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgICB0aGlzLmNhY2hlLnNldChjbGF6eiwgZXhwb3J0U2NvcGUpO1xuICAgIHJldHVybiBleHBvcnRTY29wZTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVBbGlhczxUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YXxQaXBlTWV0YT4oXG4gICAgICBkaXJPclBpcGU6IFQsIG1heWJlQWxpYXNGcm9tOiB0cy5Tb3VyY2VGaWxlLCBpc1JlRXhwb3J0OiBib29sZWFuKTogVCB7XG4gICAgY29uc3QgcmVmID0gZGlyT3JQaXBlLnJlZjtcbiAgICBpZiAodGhpcy5hbGlhc2luZ0hvc3QgPT09IG51bGwgfHwgcmVmLm5vZGUuZ2V0U291cmNlRmlsZSgpID09PSBtYXliZUFsaWFzRnJvbSkge1xuICAgICAgcmV0dXJuIGRpck9yUGlwZTtcbiAgICB9XG5cbiAgICBjb25zdCBhbGlhcyA9IHRoaXMuYWxpYXNpbmdIb3N0LmdldEFsaWFzSW4ocmVmLm5vZGUsIG1heWJlQWxpYXNGcm9tLCBpc1JlRXhwb3J0KTtcbiAgICBpZiAoYWxpYXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBkaXJPclBpcGU7XG4gICAgfVxuXG4gICAgLy8gVHlwZVNjcmlwdCBpbmNvcnJlY3RseSBuYXJyb3dzIHRoZSB0eXBlIGhlcmU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80Mzk2Ni5cbiAgICAvLyBUT0RPOiBSZW1vdmUvVXBkYXRlIG9uY2UgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80Mzk2NiBpcyByZXNvbHZlZC5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uZGlyT3JQaXBlLFxuICAgICAgcmVmOiByZWYuY2xvbmVXaXRoQWxpYXMoYWxpYXMpLFxuICAgIH0gYXMgVDtcbiAgfVxufVxuIl19