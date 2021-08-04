/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { PerfPhase } from '../../perf';
/**
 * A cached graph of imports in the `ts.Program`.
 *
 * The `ImportGraph` keeps track of dependencies (imports) of individual `ts.SourceFile`s. Only
 * dependencies within the same program are tracked; imports into packages on NPM are not.
 */
export class ImportGraph {
    constructor(checker, perf) {
        this.checker = checker;
        this.perf = perf;
        this.map = new Map();
    }
    /**
     * List the direct (not transitive) imports of a given `ts.SourceFile`.
     *
     * This operation is cached.
     */
    importsOf(sf) {
        if (!this.map.has(sf)) {
            this.map.set(sf, this.scanImports(sf));
        }
        return this.map.get(sf);
    }
    /**
     * Lists the transitive imports of a given `ts.SourceFile`.
     */
    transitiveImportsOf(sf) {
        const imports = new Set();
        this.transitiveImportsOfHelper(sf, imports);
        return imports;
    }
    transitiveImportsOfHelper(sf, results) {
        if (results.has(sf)) {
            return;
        }
        results.add(sf);
        this.importsOf(sf).forEach(imported => {
            this.transitiveImportsOfHelper(imported, results);
        });
    }
    /**
     * Find an import path from the `start` SourceFile to the `end` SourceFile.
     *
     * This function implements a breadth first search that results in finding the
     * shortest path between the `start` and `end` points.
     *
     * @param start the starting point of the path.
     * @param end the ending point of the path.
     * @returns an array of source files that connect the `start` and `end` source files, or `null` if
     *     no path could be found.
     */
    findPath(start, end) {
        if (start === end) {
            // Escape early for the case where `start` and `end` are the same.
            return [start];
        }
        const found = new Set([start]);
        const queue = [new Found(start, null)];
        while (queue.length > 0) {
            const current = queue.shift();
            const imports = this.importsOf(current.sourceFile);
            for (const importedFile of imports) {
                if (!found.has(importedFile)) {
                    const next = new Found(importedFile, current);
                    if (next.sourceFile === end) {
                        // We have hit the target `end` path so we can stop here.
                        return next.toPath();
                    }
                    found.add(importedFile);
                    queue.push(next);
                }
            }
        }
        return null;
    }
    /**
     * Add a record of an import from `sf` to `imported`, that's not present in the original
     * `ts.Program` but will be remembered by the `ImportGraph`.
     */
    addSyntheticImport(sf, imported) {
        if (isLocalFile(imported)) {
            this.importsOf(sf).add(imported);
        }
    }
    scanImports(sf) {
        return this.perf.inPhase(PerfPhase.CycleDetection, () => {
            const imports = new Set();
            // Look through the source file for import and export statements.
            for (const stmt of sf.statements) {
                if ((!ts.isImportDeclaration(stmt) && !ts.isExportDeclaration(stmt)) ||
                    stmt.moduleSpecifier === undefined) {
                    continue;
                }
                if (ts.isImportDeclaration(stmt) && stmt.importClause !== undefined &&
                    stmt.importClause.isTypeOnly) {
                    // Exclude type-only imports as they are always elided, so they don't contribute to
                    // cycles.
                    continue;
                }
                const symbol = this.checker.getSymbolAtLocation(stmt.moduleSpecifier);
                if (symbol === undefined || symbol.valueDeclaration === undefined) {
                    // No symbol could be found to skip over this import/export.
                    continue;
                }
                const moduleFile = symbol.valueDeclaration;
                if (ts.isSourceFile(moduleFile) && isLocalFile(moduleFile)) {
                    // Record this local import.
                    imports.add(moduleFile);
                }
            }
            return imports;
        });
    }
}
function isLocalFile(sf) {
    return !sf.isDeclarationFile;
}
/**
 * A helper class to track which SourceFiles are being processed when searching for a path in
 * `getPath()` above.
 */
class Found {
    constructor(sourceFile, parent) {
        this.sourceFile = sourceFile;
        this.parent = parent;
    }
    /**
     * Back track through this found SourceFile and its ancestors to generate an array of
     * SourceFiles that form am import path between two SourceFiles.
     */
    toPath() {
        const array = [];
        let current = this;
        while (current !== null) {
            array.push(current.sourceFile);
            current = current.parent;
        }
        // Pushing and then reversing, O(n), rather than unshifting repeatedly, O(n^2), avoids
        // manipulating the array on every iteration: https://stackoverflow.com/a/26370620
        return array.reverse();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvY3ljbGVzL3NyYy9pbXBvcnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxTQUFTLEVBQWUsTUFBTSxZQUFZLENBQUM7QUFFbkQ7Ozs7O0dBS0c7QUFDSCxNQUFNLE9BQU8sV0FBVztJQUd0QixZQUFvQixPQUF1QixFQUFVLElBQWtCO1FBQW5ELFlBQU8sR0FBUCxPQUFPLENBQWdCO1FBQVUsU0FBSSxHQUFKLElBQUksQ0FBYztRQUYvRCxRQUFHLEdBQUcsSUFBSSxHQUFHLEVBQXFDLENBQUM7SUFFZSxDQUFDO0lBRTNFOzs7O09BSUc7SUFDSCxTQUFTLENBQUMsRUFBaUI7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDeEM7UUFDRCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBRSxDQUFDO0lBQzNCLENBQUM7SUFFRDs7T0FFRztJQUNILG1CQUFtQixDQUFDLEVBQWlCO1FBQ25DLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO1FBQ3pDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztJQUVPLHlCQUF5QixDQUFDLEVBQWlCLEVBQUUsT0FBMkI7UUFDOUUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFD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Q0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7b0JBQ2pFLDREQUE0RDtvQkFDNUQsU0FBUztpQkFDVjtnQkFDRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7Z0JBQzNDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUU7b0JBQzFELDRCQUE0QjtvQkFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztpQkFDekI7YUFDRjtZQUNELE9BQU8sT0FBTyxDQUFDO1FBQ2pCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQsU0FBUyxXQUFXLENBQUMsRUFBaUI7SUFDcEMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztBQUMvQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxLQUFLO0lBQ1QsWUFBcUIsVUFBeUIsRUFBVyxNQUFrQjtRQUF0RCxlQUFVLEdBQVYsVUFBVSxDQUFlO1FBQVcsV0FBTSxHQUFOLE1BQU0sQ0FBWTtJQUFHLENBQUM7SUFFL0U7OztPQUdHO0lBQ0gsTUFBTTtRQUNKLE1BQU0sS0FBSyxHQUFvQixFQUFFLENBQUM7UUFDbEMsSUFBSSxPQUFPLEdBQWUsSUFBSSxDQUFDO1FBQy9CLE9BQU8sT0FBTyxLQUFLLElBQUksRUFBRTtZQUN2QixLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMvQixPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztTQUMxQjtRQUNELHNGQUFzRjtRQUN0RixrRkFBa0Y7UUFDbEYsT0FBTyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDekIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge1BlcmZQaGFzZSwgUGVyZlJlY29yZGVyfSBmcm9tICcuLi8uLi9wZXJmJztcblxuLyoqXG4gKiBBIGNhY2hlZCBncmFwaCBvZiBpbXBvcnRzIGluIHRoZSBgdHMuUHJvZ3JhbWAuXG4gKlxuICogVGhlIGBJbXBvcnRHcmFwaGAga2VlcHMgdHJhY2sgb2YgZGVwZW5kZW5jaWVzIChpbXBvcnRzKSBvZiBpbmRpdmlkdWFsIGB0cy5Tb3VyY2VGaWxlYHMuIE9ubHlcbiAqIGRlcGVuZGVuY2llcyB3aXRoaW4gdGhlIHNhbWUgcHJvZ3JhbSBhcmUgdHJhY2tlZDsgaW1wb3J0cyBpbnRvIHBhY2thZ2VzIG9uIE5QTSBhcmUgbm90LlxuICovXG5leHBvcnQgY2xhc3MgSW1wb3J0R3JhcGgge1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8dHMuU291cmNlRmlsZSwgU2V0PHRzLlNvdXJjZUZpbGU+PigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIHByaXZhdGUgcGVyZjogUGVyZlJlY29yZGVyKSB7fVxuXG4gIC8qKlxuICAgKiBMaXN0IHRoZSBkaXJlY3QgKG5vdCB0cmFuc2l0aXZlKSBpbXBvcnRzIG9mIGEgZ2l2ZW4gYHRzLlNvdXJjZUZpbGVgLlxuICAgKlxuICAgKiBUaGlzIG9wZXJhdGlvbiBpcyBjYWNoZWQuXG4gICAqL1xuICBpbXBvcnRzT2Yoc2Y6IHRzLlNvdXJjZUZpbGUpOiBTZXQ8dHMuU291cmNlRmlsZT4ge1xuICAgIGlmICghdGhpcy5tYXAuaGFzKHNmKSkge1xuICAgICAgdGhpcy5tYXAuc2V0KHNmLCB0aGlzLnNjYW5JbXBvcnRzKHNmKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1hcC5nZXQoc2YpITtcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0cyB0aGUgdHJhbnNpdGl2ZSBpbXBvcnRzIG9mIGEgZ2l2ZW4gYHRzLlNvdXJjZUZpbGVgLlxuICAgKi9cbiAgdHJhbnNpdGl2ZUltcG9ydHNPZihzZjogdHMuU291cmNlRmlsZSk6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gICAgY29uc3QgaW1wb3J0cyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcbiAgICB0aGlzLnRyYW5zaXRpdmVJbXBvcnRzT2ZIZWxwZXIoc2YsIGltcG9ydHMpO1xuICAgIHJldHVybiBpbXBvcnRzO1xuICB9XG5cbiAgcHJpdmF0ZSB0cmFuc2l0aXZlSW1wb3J0c09mSGVscGVyKHNmOiB0cy5Tb3VyY2VGaWxlLCByZXN1bHRzOiBTZXQ8dHMuU291cmNlRmlsZT4pOiB2b2lkIHtcbiAgICBpZiAocmVzdWx0cy5oYXMoc2YpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJlc3VsdHMuYWRkKHNmKTtcbiAgICB0aGlzLmltcG9ydHNPZihzZikuZm9yRWFjaChpbXBvcnRlZCA9PiB7XG4gICAgICB0aGlzLnRyYW5zaXRpdmVJbXBvcnRzT2ZIZWxwZXIoaW1wb3J0ZWQsIHJlc3VsdHMpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgYW4gaW1wb3J0IHBhdGggZnJvbSB0aGUgYHN0YXJ0YCBTb3VyY2VGaWxlIHRvIHRoZSBgZW5kYCBTb3VyY2VGaWxlLlxuICAgKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGltcGxlbWVudHMgYSBicmVhZHRoIGZpcnN0IHNlYXJjaCB0aGF0IHJlc3VsdHMgaW4gZmluZGluZyB0aGVcbiAgICogc2hvcnRlc3QgcGF0aCBiZXR3ZWVuIHRoZSBgc3RhcnRgIGFuZCBgZW5kYCBwb2ludHMuXG4gICAqXG4gICAqIEBwYXJhbSBzdGFydCB0aGUgc3RhcnRpbmcgcG9pbnQgb2YgdGhlIHBhdGguXG4gICAqIEBwYXJhbSBlbmQgdGhlIGVuZGluZyBwb2ludCBvZiB0aGUgcGF0aC5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2Ygc291cmNlIGZpbGVzIHRoYXQgY29ubmVjdCB0aGUgYHN0YXJ0YCBhbmQgYGVuZGAgc291cmNlIGZpbGVzLCBvciBgbnVsbGAgaWZcbiAgICogICAgIG5vIHBhdGggY291bGQgYmUgZm91bmQuXG4gICAqL1xuICBmaW5kUGF0aChzdGFydDogdHMuU291cmNlRmlsZSwgZW5kOiB0cy5Tb3VyY2VGaWxlKTogdHMuU291cmNlRmlsZVtdfG51bGwge1xuICAgIGlmIChzdGFydCA9PT0gZW5kKSB7XG4gICAgICAvLyBFc2NhcGUgZWFybHkgZm9yIHRoZSBjYXNlIHdoZXJlIGBzdGFydGAgYW5kIGBlbmRgIGFyZSB0aGUgc2FtZS5cbiAgICAgIHJldHVybiBbc3RhcnRdO1xuICAgIH1cblxuICAgIGNvbnN0IGZvdW5kID0gbmV3IFNldDx0cy5Tb3VyY2VGaWxlPihbc3RhcnRdKTtcbiAgICBjb25zdCBxdWV1ZTogRm91bmRbXSA9IFtuZXcgRm91bmQoc3RhcnQsIG51bGwpXTtcblxuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gcXVldWUuc2hpZnQoKSE7XG4gICAgICBjb25zdCBpbXBvcnRzID0gdGhpcy5pbXBvcnRzT2YoY3VycmVudC5zb3VyY2VGaWxlKTtcbiAgICAgIGZvciAoY29uc3QgaW1wb3J0ZWRGaWxlIG9mIGltcG9ydHMpIHtcbiAgICAgICAgaWYgKCFmb3VuZC5oYXMoaW1wb3J0ZWRGaWxlKSkge1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgRm91bmQoaW1wb3J0ZWRGaWxlLCBjdXJyZW50KTtcbiAgICAgICAgICBpZiAobmV4dC5zb3VyY2VGaWxlID09PSBlbmQpIHtcbiAgICAgICAgICAgIC8vIFdlIGhhdmUgaGl0IHRoZSB0YXJnZXQgYGVuZGAgcGF0aCBzbyB3ZSBjYW4gc3RvcCBoZXJlLlxuICAgICAgICAgICAgcmV0dXJuIG5leHQudG9QYXRoKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvdW5kLmFkZChpbXBvcnRlZEZpbGUpO1xuICAgICAgICAgIHF1ZXVlLnB1c2gobmV4dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgcmVjb3JkIG9mIGFuIGltcG9ydCBmcm9tIGBzZmAgdG8gYGltcG9ydGVkYCwgdGhhdCdzIG5vdCBwcmVzZW50IGluIHRoZSBvcmlnaW5hbFxuICAgKiBgdHMuUHJvZ3JhbWAgYnV0IHdpbGwgYmUgcmVtZW1iZXJlZCBieSB0aGUgYEltcG9ydEdyYXBoYC5cbiAgICovXG4gIGFkZFN5bnRoZXRpY0ltcG9ydChzZjogdHMuU291cmNlRmlsZSwgaW1wb3J0ZWQ6IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICBpZiAoaXNMb2NhbEZpbGUoaW1wb3J0ZWQpKSB7XG4gICAgICB0aGlzLmltcG9ydHNPZihzZikuYWRkKGltcG9ydGVkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNjYW5JbXBvcnRzKHNmOiB0cy5Tb3VyY2VGaWxlKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgICByZXR1cm4gdGhpcy5wZXJmLmluUGhhc2UoUGVyZlBoYXNlLkN5Y2xlRGV0ZWN0aW9uLCAoKSA9PiB7XG4gICAgICBjb25zdCBpbXBvcnRzID0gbmV3IFNldDx0cy5Tb3VyY2VGaWxlPigpO1xuICAgICAgLy8gTG9vayB0aHJvdWdoIHRoZSBzb3VyY2UgZmlsZSBmb3IgaW1wb3J0IGFuZCBleHBvcnQgc3RhdGVtZW50cy5cbiAgICAgIGZvciAoY29uc3Qgc3RtdCBvZiBzZi5zdGF0ZW1lbnRzKSB7XG4gICAgICAgIGlmICgoIXRzLmlzSW1wb3J0RGVjbGFyYXRpb24oc3RtdCkgJiYgIXRzLmlzRXhwb3J0RGVjbGFyYXRpb24oc3RtdCkpIHx8XG4gICAgICAgICAgICBzdG10Lm1vZHVsZVNwZWNpZmllciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHMuaXNJbXBvcnREZWNsYXJhdGlvbihzdG10KSAmJiBzdG10LmltcG9ydENsYXVzZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBzdG10LmltcG9ydENsYXVzZS5pc1R5cGVPbmx5KSB7XG4gICAgICAgICAgLy8gRXhjbHVkZSB0eXBlLW9ubHkgaW1wb3J0cyBhcyB0aGV5IGFyZSBhbHdheXMgZWxpZGVkLCBzbyB0aGV5IGRvbid0IGNvbnRyaWJ1dGUgdG9cbiAgICAgICAgICAvLyBjeWNsZXMuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihzdG10Lm1vZHVsZVNwZWNpZmllcik7XG4gICAgICAgIGlmIChzeW1ib2wgPT09IHVuZGVmaW5lZCB8fCBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gTm8gc3ltYm9sIGNvdWxkIGJlIGZvdW5kIHRvIHNraXAgb3ZlciB0aGlzIGltcG9ydC9leHBvcnQuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbW9kdWxlRmlsZSA9IHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uO1xuICAgICAgICBpZiAodHMuaXNTb3VyY2VGaWxlKG1vZHVsZUZpbGUpICYmIGlzTG9jYWxGaWxlKG1vZHVsZUZpbGUpKSB7XG4gICAgICAgICAgLy8gUmVjb3JkIHRoaXMgbG9jYWwgaW1wb3J0LlxuICAgICAgICAgIGltcG9ydHMuYWRkKG1vZHVsZUZpbGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gaW1wb3J0cztcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0xvY2FsRmlsZShzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIXNmLmlzRGVjbGFyYXRpb25GaWxlO1xufVxuXG4vKipcbiAqIEEgaGVscGVyIGNsYXNzIHRvIHRyYWNrIHdoaWNoIFNvdXJjZUZpbGVzIGFyZSBiZWluZyBwcm9jZXNzZWQgd2hlbiBzZWFyY2hpbmcgZm9yIGEgcGF0aCBpblxuICogYGdldFBhdGgoKWAgYWJvdmUuXG4gKi9cbmNsYXNzIEZvdW5kIHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgcmVhZG9ubHkgcGFyZW50OiBGb3VuZHxudWxsKSB7fVxuXG4gIC8qKlxuICAgKiBCYWNrIHRyYWNrIHRocm91Z2ggdGhpcyBmb3VuZCBTb3VyY2VGaWxlIGFuZCBpdHMgYW5jZXN0b3JzIHRvIGdlbmVyYXRlIGFuIGFycmF5IG9mXG4gICAqIFNvdXJjZUZpbGVzIHRoYXQgZm9ybSBhbSBpbXBvcnQgcGF0aCBiZXR3ZWVuIHR3byBTb3VyY2VGaWxlcy5cbiAgICovXG4gIHRvUGF0aCgpOiB0cy5Tb3VyY2VGaWxlW10ge1xuICAgIGNvbnN0IGFycmF5OiB0cy5Tb3VyY2VGaWxlW10gPSBbXTtcbiAgICBsZXQgY3VycmVudDogRm91bmR8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQgIT09IG51bGwpIHtcbiAgICAgIGFycmF5LnB1c2goY3VycmVudC5zb3VyY2VGaWxlKTtcbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICB9XG4gICAgLy8gUHVzaGluZyBhbmQgdGhlbiByZXZlcnNpbmcsIE8obiksIHJhdGhlciB0aGFuIHVuc2hpZnRpbmcgcmVwZWF0ZWRseSwgTyhuXjIpLCBhdm9pZHNcbiAgICAvLyBtYW5pcHVsYXRpbmcgdGhlIGFycmF5IG9uIGV2ZXJ5IGl0ZXJhdGlvbjogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzI2MzcwNjIwXG4gICAgcmV0dXJuIGFycmF5LnJldmVyc2UoKTtcbiAgfVxufVxuIl19