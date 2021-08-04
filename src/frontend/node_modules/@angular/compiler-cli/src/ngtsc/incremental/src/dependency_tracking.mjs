/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { absoluteFromSourceFile } from '../../file_system';
/**
 * An implementation of the `DependencyTracker` dependency graph API.
 *
 * The `FileDependencyGraph`'s primary job is to determine whether a given file has "logically"
 * changed, given the set of physical changes (direct changes to files on disk).
 *
 * A file is logically changed if at least one of three conditions is met:
 *
 * 1. The file itself has physically changed.
 * 2. One of its dependencies has physically changed.
 * 3. One of its resource dependencies has physically changed.
 */
export class FileDependencyGraph {
    constructor() {
        this.nodes = new Map();
    }
    addDependency(from, on) {
        this.nodeFor(from).dependsOn.add(absoluteFromSourceFile(on));
    }
    addResourceDependency(from, resource) {
        this.nodeFor(from).usesResources.add(resource);
    }
    recordDependencyAnalysisFailure(file) {
        this.nodeFor(file).failedAnalysis = true;
    }
    getResourceDependencies(from) {
        const node = this.nodes.get(from);
        return node ? [...node.usesResources] : [];
    }
    /**
     * Update the current dependency graph from a previous one, incorporating a set of physical
     * changes.
     *
     * This method performs two tasks:
     *
     * 1. For files which have not logically changed, their dependencies from `previous` are added to
     *    `this` graph.
     * 2. For files which have logically changed, they're added to a set of logically changed files
     *    which is eventually returned.
     *
     * In essence, for build `n`, this method performs:
     *
     * G(n) + L(n) = G(n - 1) + P(n)
     *
     * where:
     *
     * G(n) = the dependency graph of build `n`
     * L(n) = the logically changed files from build n - 1 to build n.
     * P(n) = the physically changed files from build n - 1 to build n.
     */
    updateWithPhysicalChanges(previous, changedTsPaths, deletedTsPaths, changedResources) {
        const logicallyChanged = new Set();
        for (const sf of previous.nodes.keys()) {
            const sfPath = absoluteFromSourceFile(sf);
            const node = previous.nodeFor(sf);
            if (isLogicallyChanged(sf, node, changedTsPaths, deletedTsPaths, changedResources)) {
                logicallyChanged.add(sfPath);
            }
            else if (!deletedTsPaths.has(sfPath)) {
                this.nodes.set(sf, {
                    dependsOn: new Set(node.dependsOn),
                    usesResources: new Set(node.usesResources),
                    failedAnalysis: false,
                });
            }
        }
        return logicallyChanged;
    }
    nodeFor(sf) {
        if (!this.nodes.has(sf)) {
            this.nodes.set(sf, {
                dependsOn: new Set(),
                usesResources: new Set(),
                failedAnalysis: false,
            });
        }
        return this.nodes.get(sf);
    }
}
/**
 * Determine whether `sf` has logically changed, given its dependencies and the set of physically
 * changed files and resources.
 */
function isLogicallyChanged(sf, node, changedTsPaths, deletedTsPaths, changedResources) {
    // A file is assumed to have logically changed if its dependencies could not be determined
    // accurately.
    if (node.failedAnalysis) {
        return true;
    }
    const sfPath = absoluteFromSourceFile(sf);
    // A file is logically changed if it has physically changed itself (including being deleted).
    if (changedTsPaths.has(sfPath) || deletedTsPaths.has(sfPath)) {
        return true;
    }
    // A file is logically changed if one of its dependencies has physically changed.
    for (const dep of node.dependsOn) {
        if (changedTsPaths.has(dep) || deletedTsPaths.has(dep)) {
            return true;
        }
    }
    // A file is logically changed if one of its resources has physically changed.
    for (const dep of node.usesResources) {
        if (changedResources.has(dep)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwZW5kZW5jeV90cmFja2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvaW5jcmVtZW50YWwvc3JjL2RlcGVuZGVuY3lfdHJhY2tpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLHNCQUFzQixFQUFpQixNQUFNLG1CQUFtQixDQUFDO0FBR3pFOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxPQUFPLG1CQUFtQjtJQUFoQztRQUVVLFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBZSxDQUFDO0lBMEV6QyxDQUFDO0lBeEVDLGFBQWEsQ0FBQyxJQUFPLEVBQUUsRUFBSztRQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRUQscUJBQXFCLENBQUMsSUFBTyxFQUFFLFFBQXdCO1FBQ3JELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQsK0JBQStCLENBQUMsSUFBTztRQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFDM0MsQ0FBQztJQUVELHVCQUF1QixDQUFDLElBQU87UUFDN0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFbEMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUM3QyxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09Bb0JHO0lBQ0gseUJBQXlCLENBQ3JCLFFBQWdDLEVBQUUsY0FBbUMsRUFDckUsY0FBbUMsRUFDbkMsZ0JBQXFDO1FBQ3ZDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFFbkQsS0FBSyxNQUFNLEVBQUUsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ3RDLE1BQU0sTUFBTSxHQUFHLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbEMsSUFBSSxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsRUFBRTtnQkFDbEYsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQzlCO2lCQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN0QyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUU7b0JBQ2pCLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO29CQUNsQyxhQUFhLEVBQUUsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztvQkFDMUMsY0FBYyxFQUFFLEtBQUs7aUJBQ3RCLENBQUMsQ0FBQzthQUNKO1NBQ0Y7UUFFRCxPQUFPLGdCQUFnQixDQUFDO0lBQzFCLENBQUM7SUFFTyxPQUFPLENBQUMsRUFBSztRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFO2dCQUNqQixTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQWtCO2dCQUNwQyxhQUFhLEVBQUUsSUFBSSxHQUFHLEVBQWtCO2dCQUN4QyxjQUFjLEVBQUUsS0FBSzthQUN0QixDQUFDLENBQUM7U0FDSjtRQUNELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFFLENBQUM7SUFDN0IsQ0FBQztDQUNGO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FDdkIsRUFBSyxFQUFFLElBQWMsRUFBRSxjQUEyQyxFQUNsRSxjQUEyQyxFQUMzQyxnQkFBNkM7SUFDL0MsMEZBQTBGO0lBQzFGLGNBQWM7SUFDZCxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDdkIsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUVELE1BQU0sTUFBTSxHQUFHLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRTFDLDZGQUE2RjtJQUM3RixJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUM1RCxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsaUZBQWlGO0lBQ2pGLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNoQyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN0RCxPQUFPLElBQUksQ0FBQztTQUNiO0tBQ0Y7SUFFRCw4RUFBOEU7SUFDOUUsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO1FBQ3BDLElBQUksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQzdCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7S0FDRjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHthYnNvbHV0ZUZyb21Tb3VyY2VGaWxlLCBBYnNvbHV0ZUZzUGF0aH0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtEZXBlbmRlbmN5VHJhY2tlcn0gZnJvbSAnLi4vYXBpJztcblxuLyoqXG4gKiBBbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgYERlcGVuZGVuY3lUcmFja2VyYCBkZXBlbmRlbmN5IGdyYXBoIEFQSS5cbiAqXG4gKiBUaGUgYEZpbGVEZXBlbmRlbmN5R3JhcGhgJ3MgcHJpbWFyeSBqb2IgaXMgdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYSBnaXZlbiBmaWxlIGhhcyBcImxvZ2ljYWxseVwiXG4gKiBjaGFuZ2VkLCBnaXZlbiB0aGUgc2V0IG9mIHBoeXNpY2FsIGNoYW5nZXMgKGRpcmVjdCBjaGFuZ2VzIHRvIGZpbGVzIG9uIGRpc2spLlxuICpcbiAqIEEgZmlsZSBpcyBsb2dpY2FsbHkgY2hhbmdlZCBpZiBhdCBsZWFzdCBvbmUgb2YgdGhyZWUgY29uZGl0aW9ucyBpcyBtZXQ6XG4gKlxuICogMS4gVGhlIGZpbGUgaXRzZWxmIGhhcyBwaHlzaWNhbGx5IGNoYW5nZWQuXG4gKiAyLiBPbmUgb2YgaXRzIGRlcGVuZGVuY2llcyBoYXMgcGh5c2ljYWxseSBjaGFuZ2VkLlxuICogMy4gT25lIG9mIGl0cyByZXNvdXJjZSBkZXBlbmRlbmNpZXMgaGFzIHBoeXNpY2FsbHkgY2hhbmdlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIEZpbGVEZXBlbmRlbmN5R3JhcGg8VCBleHRlbmRzIHtmaWxlTmFtZTogc3RyaW5nfSA9IHRzLlNvdXJjZUZpbGU+IGltcGxlbWVudHNcbiAgICBEZXBlbmRlbmN5VHJhY2tlcjxUPiB7XG4gIHByaXZhdGUgbm9kZXMgPSBuZXcgTWFwPFQsIEZpbGVOb2RlPigpO1xuXG4gIGFkZERlcGVuZGVuY3koZnJvbTogVCwgb246IFQpOiB2b2lkIHtcbiAgICB0aGlzLm5vZGVGb3IoZnJvbSkuZGVwZW5kc09uLmFkZChhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKG9uKSk7XG4gIH1cblxuICBhZGRSZXNvdXJjZURlcGVuZGVuY3koZnJvbTogVCwgcmVzb3VyY2U6IEFic29sdXRlRnNQYXRoKTogdm9pZCB7XG4gICAgdGhpcy5ub2RlRm9yKGZyb20pLnVzZXNSZXNvdXJjZXMuYWRkKHJlc291cmNlKTtcbiAgfVxuXG4gIHJlY29yZERlcGVuZGVuY3lBbmFseXNpc0ZhaWx1cmUoZmlsZTogVCk6IHZvaWQge1xuICAgIHRoaXMubm9kZUZvcihmaWxlKS5mYWlsZWRBbmFseXNpcyA9IHRydWU7XG4gIH1cblxuICBnZXRSZXNvdXJjZURlcGVuZGVuY2llcyhmcm9tOiBUKTogQWJzb2x1dGVGc1BhdGhbXSB7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KGZyb20pO1xuXG4gICAgcmV0dXJuIG5vZGUgPyBbLi4ubm9kZS51c2VzUmVzb3VyY2VzXSA6IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgY3VycmVudCBkZXBlbmRlbmN5IGdyYXBoIGZyb20gYSBwcmV2aW91cyBvbmUsIGluY29ycG9yYXRpbmcgYSBzZXQgb2YgcGh5c2ljYWxcbiAgICogY2hhbmdlcy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgcGVyZm9ybXMgdHdvIHRhc2tzOlxuICAgKlxuICAgKiAxLiBGb3IgZmlsZXMgd2hpY2ggaGF2ZSBub3QgbG9naWNhbGx5IGNoYW5nZWQsIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIGBwcmV2aW91c2AgYXJlIGFkZGVkIHRvXG4gICAqICAgIGB0aGlzYCBncmFwaC5cbiAgICogMi4gRm9yIGZpbGVzIHdoaWNoIGhhdmUgbG9naWNhbGx5IGNoYW5nZWQsIHRoZXkncmUgYWRkZWQgdG8gYSBzZXQgb2YgbG9naWNhbGx5IGNoYW5nZWQgZmlsZXNcbiAgICogICAgd2hpY2ggaXMgZXZlbnR1YWxseSByZXR1cm5lZC5cbiAgICpcbiAgICogSW4gZXNzZW5jZSwgZm9yIGJ1aWxkIGBuYCwgdGhpcyBtZXRob2QgcGVyZm9ybXM6XG4gICAqXG4gICAqIEcobikgKyBMKG4pID0gRyhuIC0gMSkgKyBQKG4pXG4gICAqXG4gICAqIHdoZXJlOlxuICAgKlxuICAgKiBHKG4pID0gdGhlIGRlcGVuZGVuY3kgZ3JhcGggb2YgYnVpbGQgYG5gXG4gICAqIEwobikgPSB0aGUgbG9naWNhbGx5IGNoYW5nZWQgZmlsZXMgZnJvbSBidWlsZCBuIC0gMSB0byBidWlsZCBuLlxuICAgKiBQKG4pID0gdGhlIHBoeXNpY2FsbHkgY2hhbmdlZCBmaWxlcyBmcm9tIGJ1aWxkIG4gLSAxIHRvIGJ1aWxkIG4uXG4gICAqL1xuICB1cGRhdGVXaXRoUGh5c2ljYWxDaGFuZ2VzKFxuICAgICAgcHJldmlvdXM6IEZpbGVEZXBlbmRlbmN5R3JhcGg8VD4sIGNoYW5nZWRUc1BhdGhzOiBTZXQ8QWJzb2x1dGVGc1BhdGg+LFxuICAgICAgZGVsZXRlZFRzUGF0aHM6IFNldDxBYnNvbHV0ZUZzUGF0aD4sXG4gICAgICBjaGFuZ2VkUmVzb3VyY2VzOiBTZXQ8QWJzb2x1dGVGc1BhdGg+KTogU2V0PEFic29sdXRlRnNQYXRoPiB7XG4gICAgY29uc3QgbG9naWNhbGx5Q2hhbmdlZCA9IG5ldyBTZXQ8QWJzb2x1dGVGc1BhdGg+KCk7XG5cbiAgICBmb3IgKGNvbnN0IHNmIG9mIHByZXZpb3VzLm5vZGVzLmtleXMoKSkge1xuICAgICAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG4gICAgICBjb25zdCBub2RlID0gcHJldmlvdXMubm9kZUZvcihzZik7XG4gICAgICBpZiAoaXNMb2dpY2FsbHlDaGFuZ2VkKHNmLCBub2RlLCBjaGFuZ2VkVHNQYXRocywgZGVsZXRlZFRzUGF0aHMsIGNoYW5nZWRSZXNvdXJjZXMpKSB7XG4gICAgICAgIGxvZ2ljYWxseUNoYW5nZWQuYWRkKHNmUGF0aCk7XG4gICAgICB9IGVsc2UgaWYgKCFkZWxldGVkVHNQYXRocy5oYXMoc2ZQYXRoKSkge1xuICAgICAgICB0aGlzLm5vZGVzLnNldChzZiwge1xuICAgICAgICAgIGRlcGVuZHNPbjogbmV3IFNldChub2RlLmRlcGVuZHNPbiksXG4gICAgICAgICAgdXNlc1Jlc291cmNlczogbmV3IFNldChub2RlLnVzZXNSZXNvdXJjZXMpLFxuICAgICAgICAgIGZhaWxlZEFuYWx5c2lzOiBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxvZ2ljYWxseUNoYW5nZWQ7XG4gIH1cblxuICBwcml2YXRlIG5vZGVGb3Ioc2Y6IFQpOiBGaWxlTm9kZSB7XG4gICAgaWYgKCF0aGlzLm5vZGVzLmhhcyhzZikpIHtcbiAgICAgIHRoaXMubm9kZXMuc2V0KHNmLCB7XG4gICAgICAgIGRlcGVuZHNPbjogbmV3IFNldDxBYnNvbHV0ZUZzUGF0aD4oKSxcbiAgICAgICAgdXNlc1Jlc291cmNlczogbmV3IFNldDxBYnNvbHV0ZUZzUGF0aD4oKSxcbiAgICAgICAgZmFpbGVkQW5hbHlzaXM6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5vZGVzLmdldChzZikhO1xuICB9XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIHdoZXRoZXIgYHNmYCBoYXMgbG9naWNhbGx5IGNoYW5nZWQsIGdpdmVuIGl0cyBkZXBlbmRlbmNpZXMgYW5kIHRoZSBzZXQgb2YgcGh5c2ljYWxseVxuICogY2hhbmdlZCBmaWxlcyBhbmQgcmVzb3VyY2VzLlxuICovXG5mdW5jdGlvbiBpc0xvZ2ljYWxseUNoYW5nZWQ8VCBleHRlbmRzIHtmaWxlTmFtZTogc3RyaW5nfT4oXG4gICAgc2Y6IFQsIG5vZGU6IEZpbGVOb2RlLCBjaGFuZ2VkVHNQYXRoczogUmVhZG9ubHlTZXQ8QWJzb2x1dGVGc1BhdGg+LFxuICAgIGRlbGV0ZWRUc1BhdGhzOiBSZWFkb25seVNldDxBYnNvbHV0ZUZzUGF0aD4sXG4gICAgY2hhbmdlZFJlc291cmNlczogUmVhZG9ubHlTZXQ8QWJzb2x1dGVGc1BhdGg+KTogYm9vbGVhbiB7XG4gIC8vIEEgZmlsZSBpcyBhc3N1bWVkIHRvIGhhdmUgbG9naWNhbGx5IGNoYW5nZWQgaWYgaXRzIGRlcGVuZGVuY2llcyBjb3VsZCBub3QgYmUgZGV0ZXJtaW5lZFxuICAvLyBhY2N1cmF0ZWx5LlxuICBpZiAobm9kZS5mYWlsZWRBbmFseXNpcykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG5cbiAgLy8gQSBmaWxlIGlzIGxvZ2ljYWxseSBjaGFuZ2VkIGlmIGl0IGhhcyBwaHlzaWNhbGx5IGNoYW5nZWQgaXRzZWxmIChpbmNsdWRpbmcgYmVpbmcgZGVsZXRlZCkuXG4gIGlmIChjaGFuZ2VkVHNQYXRocy5oYXMoc2ZQYXRoKSB8fCBkZWxldGVkVHNQYXRocy5oYXMoc2ZQYXRoKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gQSBmaWxlIGlzIGxvZ2ljYWxseSBjaGFuZ2VkIGlmIG9uZSBvZiBpdHMgZGVwZW5kZW5jaWVzIGhhcyBwaHlzaWNhbGx5IGNoYW5nZWQuXG4gIGZvciAoY29uc3QgZGVwIG9mIG5vZGUuZGVwZW5kc09uKSB7XG4gICAgaWYgKGNoYW5nZWRUc1BhdGhzLmhhcyhkZXApIHx8IGRlbGV0ZWRUc1BhdGhzLmhhcyhkZXApKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBBIGZpbGUgaXMgbG9naWNhbGx5IGNoYW5nZWQgaWYgb25lIG9mIGl0cyByZXNvdXJjZXMgaGFzIHBoeXNpY2FsbHkgY2hhbmdlZC5cbiAgZm9yIChjb25zdCBkZXAgb2Ygbm9kZS51c2VzUmVzb3VyY2VzKSB7XG4gICAgaWYgKGNoYW5nZWRSZXNvdXJjZXMuaGFzKGRlcCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmludGVyZmFjZSBGaWxlTm9kZSB7XG4gIGRlcGVuZHNPbjogU2V0PEFic29sdXRlRnNQYXRoPjtcbiAgdXNlc1Jlc291cmNlczogU2V0PEFic29sdXRlRnNQYXRoPjtcbiAgZmFpbGVkQW5hbHlzaXM6IGJvb2xlYW47XG59XG4iXX0=