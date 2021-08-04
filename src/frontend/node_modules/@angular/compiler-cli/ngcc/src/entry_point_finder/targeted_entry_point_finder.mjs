import { hasBeenProcessed } from '../packages/build_marker';
import { getEntryPointInfo, isEntryPoint } from '../packages/entry_point';
import { TracingEntryPointFinder } from './tracing_entry_point_finder';
/**
 * An EntryPointFinder that starts from a target entry-point and only finds
 * entry-points that are dependencies of the target.
 *
 * This is faster than searching the entire file-system for all the entry-points,
 * and is used primarily by the CLI integration.
 */
export class TargetedEntryPointFinder extends TracingEntryPointFinder {
    constructor(fs, config, logger, resolver, basePath, pathMappings, targetPath) {
        super(fs, config, logger, resolver, basePath, pathMappings);
        this.targetPath = targetPath;
    }
    /**
     * Search for Angular entry-points that can be reached from the entry-point specified by the given
     * `targetPath`.
     */
    findEntryPoints() {
        const entryPoints = super.findEntryPoints();
        const invalidTarget = entryPoints.invalidEntryPoints.find(i => i.entryPoint.path === this.targetPath);
        if (invalidTarget !== undefined) {
            throw new Error(`The target entry-point "${invalidTarget.entryPoint.name}" has missing dependencies:\n` +
                invalidTarget.missingDependencies.map(dep => ` - ${dep}\n`).join(''));
        }
        return entryPoints;
    }
    /**
     * Determine whether the entry-point at the given `targetPath` needs to be processed.
     *
     * @param propertiesToConsider the package.json properties that should be considered for
     *     processing.
     * @param compileAllFormats true if all formats need to be processed, or false if it is enough for
     *     one of the formats covered by the `propertiesToConsider` is processed.
     */
    targetNeedsProcessingOrCleaning(propertiesToConsider, compileAllFormats) {
        const entryPointWithDeps = this.getEntryPointWithDeps(this.targetPath);
        if (entryPointWithDeps === null) {
            return false;
        }
        for (const property of propertiesToConsider) {
            if (entryPointWithDeps.entryPoint.packageJson[property]) {
                // Here is a property that should be processed.
                if (!hasBeenProcessed(entryPointWithDeps.entryPoint.packageJson, property)) {
                    return true;
                }
                if (!compileAllFormats) {
                    // This property has been processed, and we only need one.
                    return false;
                }
            }
        }
        // All `propertiesToConsider` that appear in this entry-point have been processed.
        // In other words, there were no properties that need processing.
        return false;
    }
    /**
     * Return an array containing the `targetPath` from which to start the trace.
     */
    getInitialEntryPointPaths() {
        return [this.targetPath];
    }
    /**
     * For the given `entryPointPath`, compute, or retrieve, the entry-point information, including
     * paths to other entry-points that this entry-point depends upon.
     *
     * @param entryPointPath the path to the entry-point whose information and dependencies are to be
     *     retrieved or computed.
     *
     * @returns the entry-point and its dependencies or `null` if the entry-point is not compiled by
     *     Angular or cannot be determined.
     */
    getEntryPointWithDeps(entryPointPath) {
        const packagePath = this.computePackagePath(entryPointPath);
        const entryPoint = getEntryPointInfo(this.fs, this.config, this.logger, packagePath, entryPointPath);
        if (!isEntryPoint(entryPoint) || !entryPoint.compiledByAngular) {
            return null;
        }
        return this.resolver.getEntryPointWithDependencies(entryPoint);
    }
    /**
     * Compute the path to the package that contains the given entry-point.
     *
     * In this entry-point finder it is not trivial to find the containing package, since it is
     * possible that this entry-point is not directly below the directory containing the package.
     * Moreover, the import path could be affected by path-mapping.
     *
     * @param entryPointPath the path to the entry-point, whose package path we want to compute.
     */
    computePackagePath(entryPointPath) {
        // First try the main basePath, to avoid having to compute the other basePaths from the paths
        // mappings, which can be computationally intensive.
        if (this.isPathContainedBy(this.basePath, entryPointPath)) {
            const packagePath = this.computePackagePathFromContainingPath(entryPointPath, this.basePath);
            if (packagePath !== null) {
                return packagePath;
            }
        }
        // The main `basePath` didn't work out so now we try the `basePaths` computed from the paths
        // mappings in `tsconfig.json`.
        for (const basePath of this.getBasePaths()) {
            if (this.isPathContainedBy(basePath, entryPointPath)) {
                const packagePath = this.computePackagePathFromContainingPath(entryPointPath, basePath);
                if (packagePath !== null) {
                    return packagePath;
                }
                // If we got here then we couldn't find a `packagePath` for the current `basePath`.
                // Since `basePath`s are guaranteed not to be a sub-directory of each other then no other
                // `basePath` will match either.
                break;
            }
        }
        // Finally, if we couldn't find a `packagePath` using `basePaths` then try to find the nearest
        // `node_modules` that contains the `entryPointPath`, if there is one, and use it as a
        // `basePath`.
        return this.computePackagePathFromNearestNodeModules(entryPointPath);
    }
    /**
     * Compute whether the `test` path is contained within the `base` path.
     *
     * Note that this doesn't use a simple `startsWith()` since that would result in a false positive
     * for `test` paths such as `a/b/c-x` when the `base` path is `a/b/c`.
     *
     * Since `fs.relative()` can be quite expensive we check the fast possibilities first.
     */
    isPathContainedBy(base, test) {
        return test === base ||
            (test.startsWith(base) && !this.fs.relative(base, test).startsWith('..'));
    }
    /**
     * Search down to the `entryPointPath` from the `containingPath` for the first `package.json` that
     * we come to. This is the path to the entry-point's containing package. For example if
     * `containingPath` is `/a/b/c` and `entryPointPath` is `/a/b/c/d/e` and there exists
     * `/a/b/c/d/package.json` and `/a/b/c/d/e/package.json`, then we will return `/a/b/c/d`.
     *
     * To account for nested `node_modules` we actually start the search at the last `node_modules` in
     * the `entryPointPath` that is below the `containingPath`. E.g. if `containingPath` is `/a/b/c`
     * and `entryPointPath` is `/a/b/c/d/node_modules/x/y/z`, we start the search at
     * `/a/b/c/d/node_modules`.
     */
    computePackagePathFromContainingPath(entryPointPath, containingPath) {
        let packagePath = containingPath;
        const segments = this.splitPath(this.fs.relative(containingPath, entryPointPath));
        let nodeModulesIndex = segments.lastIndexOf('node_modules');
        // If there are no `node_modules` in the relative path between the `basePath` and the
        // `entryPointPath` then just try the `basePath` as the `packagePath`.
        // (This can be the case with path-mapped entry-points.)
        if (nodeModulesIndex === -1) {
            if (this.fs.exists(this.fs.join(packagePath, 'package.json'))) {
                return packagePath;
            }
        }
        // Start the search at the deepest nested `node_modules` folder that is below the `basePath`
        // but above the `entryPointPath`, if there are any.
        while (nodeModulesIndex >= 0) {
            packagePath = this.fs.join(packagePath, segments.shift());
            nodeModulesIndex--;
        }
        // Note that we start at the folder below the current candidate `packagePath` because the
        // initial candidate `packagePath` is either a `node_modules` folder or the `basePath` with
        // no `package.json`.
        for (const segment of segments) {
            packagePath = this.fs.join(packagePath, segment);
            if (this.fs.exists(this.fs.join(packagePath, 'package.json'))) {
                return packagePath;
            }
        }
        return null;
    }
    /**
     * Search up the directory tree from the `entryPointPath` looking for a `node_modules` directory
     * that we can use as a potential starting point for computing the package path.
     */
    computePackagePathFromNearestNodeModules(entryPointPath) {
        let packagePath = entryPointPath;
        let scopedPackagePath = packagePath;
        let containerPath = this.fs.dirname(packagePath);
        while (!this.fs.isRoot(containerPath) && !containerPath.endsWith('node_modules')) {
            scopedPackagePath = packagePath;
            packagePath = containerPath;
            containerPath = this.fs.dirname(containerPath);
        }
        if (this.fs.exists(this.fs.join(packagePath, 'package.json'))) {
            // The directory directly below `node_modules` is a package - use it
            return packagePath;
        }
        else if (this.fs.basename(packagePath).startsWith('@') &&
            this.fs.exists(this.fs.join(scopedPackagePath, 'package.json'))) {
            // The directory directly below the `node_modules` is a scope and the directory directly
            // below that is a scoped package - use it
            return scopedPackagePath;
        }
        else {
            // If we get here then none of the `basePaths` contained the `entryPointPath` and the
            // `entryPointPath` contains no `node_modules` that contains a package or a scoped
            // package. All we can do is assume that this entry-point is a primary entry-point to a
            // package.
            return entryPointPath;
        }
    }
    /**
     * Split the given `path` into path segments using an FS independent algorithm.
     */
    splitPath(path) {
        const segments = [];
        let container = this.fs.dirname(path);
        while (path !== container) {
            segments.unshift(this.fs.basename(path));
            path = container;
            container = this.fs.dirname(container);
        }
        return segments;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFyZ2V0ZWRfZW50cnlfcG9pbnRfZmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2VudHJ5X3BvaW50X2ZpbmRlci90YXJnZXRlZF9lbnRyeV9wb2ludF9maW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBV0EsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUQsT0FBTyxFQUF5QixpQkFBaUIsRUFBRSxZQUFZLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUdoRyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUVyRTs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8sd0JBQXlCLFNBQVEsdUJBQXVCO0lBQ25FLFlBQ0ksRUFBc0IsRUFBRSxNQUF5QixFQUFFLE1BQWMsRUFDakUsUUFBNEIsRUFBRSxRQUF3QixFQUFFLFlBQW9DLEVBQ3BGLFVBQTBCO1FBQ3BDLEtBQUssQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRGxELGVBQVUsR0FBVixVQUFVLENBQWdCO0lBRXRDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxlQUFlO1FBQ2IsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRTVDLE1BQU0sYUFBYSxHQUNmLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEYsSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFO1lBQy9CLE1BQU0sSUFBSSxLQUFLLENBQ1gsMkJBQTJCLGFBQWEsQ0FBQyxVQUFVLENBQUMsSUFBSSwrQkFBK0I7Z0JBQ3ZGLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDM0U7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILCtCQUErQixDQUMzQixvQkFBOEMsRUFBRSxpQkFBMEI7UUFDNUUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksa0JBQWtCLEtBQUssSUFBSSxFQUFFO1lBQy9CLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLG9CQUFvQixFQUFFO1lBQzNDLElBQUksa0JBQWtCLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDdkQsK0NBQStDO2dCQUMvQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsRUFBRTtvQkFDMUUsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQ0QsSUFBSSxDQUFDLGlCQUFpQixFQUFFO29CQUN0QiwwREFBMEQ7b0JBQzFELE9BQU8sS0FBSyxDQUFDO2lCQUNkO2FBQ0Y7U0FDRjtRQUNELGtGQUFrRjtRQUNsRixpRUFBaUU7UUFDakUsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQ7O09BRUc7SUFDTyx5QkFBeUI7UUFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRUQ7Ozs7Ozs7OztPQVNHO0lBQ08scUJBQXFCLENBQUMsY0FBOEI7UUFDNUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzVELE1BQU0sVUFBVSxHQUNaLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUN0RixJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixFQUFFO1lBQzlELE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsNkJBQTZCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0ssa0JBQWtCLENBQUMsY0FBOEI7UUFDdkQsNkZBQTZGO1FBQzdGLG9EQUFvRDtRQUNwRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQyxFQUFFO1lBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzdGLElBQUksV0FBVyxLQUFLLElBQUksRUFBRTtnQkFDeEIsT0FBTyxXQUFXLENBQUM7YUFDcEI7U0FDRjtRQUVELDRGQUE0RjtRQUM1RiwrQkFBK0I7UUFDL0IsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUU7WUFDMUMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQyxFQUFFO2dCQUNwRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsb0NBQW9DLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RixJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUU7b0JBQ3hCLE9BQU8sV0FBVyxDQUFDO2lCQUNwQjtnQkFDRCxtRkFBbUY7Z0JBQ25GLHlGQUF5RjtnQkFDekYsZ0NBQWdDO2dCQUNoQyxNQUFNO2FBQ1A7U0FDRjtRQUVELDhGQUE4RjtRQUM5RixzRkFBc0Y7UUFDdEYsY0FBYztRQUNkLE9BQU8sSUFBSSxDQUFDLHdDQUF3QyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0ssaUJBQWlCLENBQUMsSUFBb0IsRUFBRSxJQUFvQjtRQUNsRSxPQUFPLElBQUksS0FBSyxJQUFJO1lBQ2hCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7T0FVRztJQUNLLG9DQUFvQyxDQUN4QyxjQUE4QixFQUFFLGNBQThCO1FBQ2hFLElBQUksV0FBVyxHQUFHLGNBQWMsQ0FBQztRQUNqQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBQ2xGLElBQUksZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxjQUE2QixDQUFDLENBQUM7UUFFM0UscUZBQXFGO1FBQ3JGLHNFQUFzRTtRQUN0RSx3REFBd0Q7UUFDeEQsSUFBSSxnQkFBZ0IsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUMzQixJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQyxFQUFFO2dCQUM3RCxPQUFPLFdBQVcsQ0FBQzthQUNwQjtTQUNGO1FBRUQsNEZBQTRGO1FBQzVGLG9EQUFvRDtRQUNwRCxPQUFPLGdCQUFnQixJQUFJLENBQUMsRUFBRTtZQUM1QixXQUFXLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUcsQ0FBQyxDQUFDO1lBQzNELGdCQUFnQixFQUFFLENBQUM7U0FDcEI7UUFFRCx5RkFBeUY7UUFDekYsMkZBQTJGO1FBQzNGLHFCQUFxQjtRQUNyQixLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRTtZQUM5QixXQUFXLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2pELElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxDQUFDLEVBQUU7Z0JBQzdELE9BQU8sV0FBVyxDQUFDO2FBQ3BCO1NBQ0Y7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSyx3Q0FBd0MsQ0FBQyxjQUE4QjtRQUM3RSxJQUFJLFdBQVcsR0FBRyxjQUFjLENBQUM7UUFDakMsSUFBSSxpQkFBaUIsR0FBRyxXQUFXLENBQUM7UUFDcEMsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDakQsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFBRTtZQUNoRixpQkFBaUIsR0FBRyxXQUFXLENBQUM7WUFDaEMsV0FBVyxHQUFHLGFBQWEsQ0FBQztZQUM1QixhQUFhLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDaEQ7UUFFRCxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQyxFQUFFO1lBQzdELG9FQUFvRTtZQUNwRSxPQUFPLFdBQVcsQ0FBQztTQUNwQjthQUFNLElBQ0gsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUM3QyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLENBQUMsQ0FBQyxFQUFFO1lBQ25FLHdGQUF3RjtZQUN4RiwwQ0FBMEM7WUFDMUMsT0FBTyxpQkFBaUIsQ0FBQztTQUMxQjthQUFNO1lBQ0wscUZBQXFGO1lBQ3JGLGtGQUFrRjtZQUNsRix1RkFBdUY7WUFDdkYsV0FBVztZQUNYLE9BQU8sY0FBYyxDQUFDO1NBQ3ZCO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssU0FBUyxDQUFDLElBQWdDO1FBQ2hELE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUNwQixJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDekIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLElBQUksR0FBRyxTQUFTLENBQUM7WUFDakIsU0FBUyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3hDO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0Fic29sdXRlRnNQYXRoLCBQYXRoU2VnbWVudCwgUmVhZG9ubHlGaWxlU3lzdGVtfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtMb2dnZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9sb2dnaW5nJztcbmltcG9ydCB7RW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXN9IGZyb20gJy4uL2RlcGVuZGVuY2llcy9kZXBlbmRlbmN5X2hvc3QnO1xuaW1wb3J0IHtEZXBlbmRlbmN5UmVzb2x2ZXIsIFNvcnRlZEVudHJ5UG9pbnRzSW5mb30gZnJvbSAnLi4vZGVwZW5kZW5jaWVzL2RlcGVuZGVuY3lfcmVzb2x2ZXInO1xuaW1wb3J0IHtoYXNCZWVuUHJvY2Vzc2VkfSBmcm9tICcuLi9wYWNrYWdlcy9idWlsZF9tYXJrZXInO1xuaW1wb3J0IHtOZ2NjQ29uZmlndXJhdGlvbn0gZnJvbSAnLi4vcGFja2FnZXMvY29uZmlndXJhdGlvbic7XG5pbXBvcnQge0VudHJ5UG9pbnRKc29uUHJvcGVydHksIGdldEVudHJ5UG9pbnRJbmZvLCBpc0VudHJ5UG9pbnR9IGZyb20gJy4uL3BhY2thZ2VzL2VudHJ5X3BvaW50JztcbmltcG9ydCB7UGF0aE1hcHBpbmdzfSBmcm9tICcuLi9wYXRoX21hcHBpbmdzJztcblxuaW1wb3J0IHtUcmFjaW5nRW50cnlQb2ludEZpbmRlcn0gZnJvbSAnLi90cmFjaW5nX2VudHJ5X3BvaW50X2ZpbmRlcic7XG5cbi8qKlxuICogQW4gRW50cnlQb2ludEZpbmRlciB0aGF0IHN0YXJ0cyBmcm9tIGEgdGFyZ2V0IGVudHJ5LXBvaW50IGFuZCBvbmx5IGZpbmRzXG4gKiBlbnRyeS1wb2ludHMgdGhhdCBhcmUgZGVwZW5kZW5jaWVzIG9mIHRoZSB0YXJnZXQuXG4gKlxuICogVGhpcyBpcyBmYXN0ZXIgdGhhbiBzZWFyY2hpbmcgdGhlIGVudGlyZSBmaWxlLXN5c3RlbSBmb3IgYWxsIHRoZSBlbnRyeS1wb2ludHMsXG4gKiBhbmQgaXMgdXNlZCBwcmltYXJpbHkgYnkgdGhlIENMSSBpbnRlZ3JhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIFRhcmdldGVkRW50cnlQb2ludEZpbmRlciBleHRlbmRzIFRyYWNpbmdFbnRyeVBvaW50RmluZGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBmczogUmVhZG9ubHlGaWxlU3lzdGVtLCBjb25maWc6IE5nY2NDb25maWd1cmF0aW9uLCBsb2dnZXI6IExvZ2dlcixcbiAgICAgIHJlc29sdmVyOiBEZXBlbmRlbmN5UmVzb2x2ZXIsIGJhc2VQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgcGF0aE1hcHBpbmdzOiBQYXRoTWFwcGluZ3N8dW5kZWZpbmVkLFxuICAgICAgcHJpdmF0ZSB0YXJnZXRQYXRoOiBBYnNvbHV0ZUZzUGF0aCkge1xuICAgIHN1cGVyKGZzLCBjb25maWcsIGxvZ2dlciwgcmVzb2x2ZXIsIGJhc2VQYXRoLCBwYXRoTWFwcGluZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlYXJjaCBmb3IgQW5ndWxhciBlbnRyeS1wb2ludHMgdGhhdCBjYW4gYmUgcmVhY2hlZCBmcm9tIHRoZSBlbnRyeS1wb2ludCBzcGVjaWZpZWQgYnkgdGhlIGdpdmVuXG4gICAqIGB0YXJnZXRQYXRoYC5cbiAgICovXG4gIGZpbmRFbnRyeVBvaW50cygpOiBTb3J0ZWRFbnRyeVBvaW50c0luZm8ge1xuICAgIGNvbnN0IGVudHJ5UG9pbnRzID0gc3VwZXIuZmluZEVudHJ5UG9pbnRzKCk7XG5cbiAgICBjb25zdCBpbnZhbGlkVGFyZ2V0ID1cbiAgICAgICAgZW50cnlQb2ludHMuaW52YWxpZEVudHJ5UG9pbnRzLmZpbmQoaSA9PiBpLmVudHJ5UG9pbnQucGF0aCA9PT0gdGhpcy50YXJnZXRQYXRoKTtcbiAgICBpZiAoaW52YWxpZFRhcmdldCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFRoZSB0YXJnZXQgZW50cnktcG9pbnQgXCIke2ludmFsaWRUYXJnZXQuZW50cnlQb2ludC5uYW1lfVwiIGhhcyBtaXNzaW5nIGRlcGVuZGVuY2llczpcXG5gICtcbiAgICAgICAgICBpbnZhbGlkVGFyZ2V0Lm1pc3NpbmdEZXBlbmRlbmNpZXMubWFwKGRlcCA9PiBgIC0gJHtkZXB9XFxuYCkuam9pbignJykpO1xuICAgIH1cbiAgICByZXR1cm4gZW50cnlQb2ludHM7XG4gIH1cblxuICAvKipcbiAgICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGVudHJ5LXBvaW50IGF0IHRoZSBnaXZlbiBgdGFyZ2V0UGF0aGAgbmVlZHMgdG8gYmUgcHJvY2Vzc2VkLlxuICAgKlxuICAgKiBAcGFyYW0gcHJvcGVydGllc1RvQ29uc2lkZXIgdGhlIHBhY2thZ2UuanNvbiBwcm9wZXJ0aWVzIHRoYXQgc2hvdWxkIGJlIGNvbnNpZGVyZWQgZm9yXG4gICAqICAgICBwcm9jZXNzaW5nLlxuICAgKiBAcGFyYW0gY29tcGlsZUFsbEZvcm1hdHMgdHJ1ZSBpZiBhbGwgZm9ybWF0cyBuZWVkIHRvIGJlIHByb2Nlc3NlZCwgb3IgZmFsc2UgaWYgaXQgaXMgZW5vdWdoIGZvclxuICAgKiAgICAgb25lIG9mIHRoZSBmb3JtYXRzIGNvdmVyZWQgYnkgdGhlIGBwcm9wZXJ0aWVzVG9Db25zaWRlcmAgaXMgcHJvY2Vzc2VkLlxuICAgKi9cbiAgdGFyZ2V0TmVlZHNQcm9jZXNzaW5nT3JDbGVhbmluZyhcbiAgICAgIHByb3BlcnRpZXNUb0NvbnNpZGVyOiBFbnRyeVBvaW50SnNvblByb3BlcnR5W10sIGNvbXBpbGVBbGxGb3JtYXRzOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZW50cnlQb2ludFdpdGhEZXBzID0gdGhpcy5nZXRFbnRyeVBvaW50V2l0aERlcHModGhpcy50YXJnZXRQYXRoKTtcbiAgICBpZiAoZW50cnlQb2ludFdpdGhEZXBzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBwcm9wZXJ0aWVzVG9Db25zaWRlcikge1xuICAgICAgaWYgKGVudHJ5UG9pbnRXaXRoRGVwcy5lbnRyeVBvaW50LnBhY2thZ2VKc29uW3Byb3BlcnR5XSkge1xuICAgICAgICAvLyBIZXJlIGlzIGEgcHJvcGVydHkgdGhhdCBzaG91bGQgYmUgcHJvY2Vzc2VkLlxuICAgICAgICBpZiAoIWhhc0JlZW5Qcm9jZXNzZWQoZW50cnlQb2ludFdpdGhEZXBzLmVudHJ5UG9pbnQucGFja2FnZUpzb24sIHByb3BlcnR5KSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghY29tcGlsZUFsbEZvcm1hdHMpIHtcbiAgICAgICAgICAvLyBUaGlzIHByb3BlcnR5IGhhcyBiZWVuIHByb2Nlc3NlZCwgYW5kIHdlIG9ubHkgbmVlZCBvbmUuXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFsbCBgcHJvcGVydGllc1RvQ29uc2lkZXJgIHRoYXQgYXBwZWFyIGluIHRoaXMgZW50cnktcG9pbnQgaGF2ZSBiZWVuIHByb2Nlc3NlZC5cbiAgICAvLyBJbiBvdGhlciB3b3JkcywgdGhlcmUgd2VyZSBubyBwcm9wZXJ0aWVzIHRoYXQgbmVlZCBwcm9jZXNzaW5nLlxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gYXJyYXkgY29udGFpbmluZyB0aGUgYHRhcmdldFBhdGhgIGZyb20gd2hpY2ggdG8gc3RhcnQgdGhlIHRyYWNlLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldEluaXRpYWxFbnRyeVBvaW50UGF0aHMoKTogQWJzb2x1dGVGc1BhdGhbXSB7XG4gICAgcmV0dXJuIFt0aGlzLnRhcmdldFBhdGhdO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciB0aGUgZ2l2ZW4gYGVudHJ5UG9pbnRQYXRoYCwgY29tcHV0ZSwgb3IgcmV0cmlldmUsIHRoZSBlbnRyeS1wb2ludCBpbmZvcm1hdGlvbiwgaW5jbHVkaW5nXG4gICAqIHBhdGhzIHRvIG90aGVyIGVudHJ5LXBvaW50cyB0aGF0IHRoaXMgZW50cnktcG9pbnQgZGVwZW5kcyB1cG9uLlxuICAgKlxuICAgKiBAcGFyYW0gZW50cnlQb2ludFBhdGggdGhlIHBhdGggdG8gdGhlIGVudHJ5LXBvaW50IHdob3NlIGluZm9ybWF0aW9uIGFuZCBkZXBlbmRlbmNpZXMgYXJlIHRvIGJlXG4gICAqICAgICByZXRyaWV2ZWQgb3IgY29tcHV0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIHRoZSBlbnRyeS1wb2ludCBhbmQgaXRzIGRlcGVuZGVuY2llcyBvciBgbnVsbGAgaWYgdGhlIGVudHJ5LXBvaW50IGlzIG5vdCBjb21waWxlZCBieVxuICAgKiAgICAgQW5ndWxhciBvciBjYW5ub3QgYmUgZGV0ZXJtaW5lZC5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRFbnRyeVBvaW50V2l0aERlcHMoZW50cnlQb2ludFBhdGg6IEFic29sdXRlRnNQYXRoKTogRW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXN8bnVsbCB7XG4gICAgY29uc3QgcGFja2FnZVBhdGggPSB0aGlzLmNvbXB1dGVQYWNrYWdlUGF0aChlbnRyeVBvaW50UGF0aCk7XG4gICAgY29uc3QgZW50cnlQb2ludCA9XG4gICAgICAgIGdldEVudHJ5UG9pbnRJbmZvKHRoaXMuZnMsIHRoaXMuY29uZmlnLCB0aGlzLmxvZ2dlciwgcGFja2FnZVBhdGgsIGVudHJ5UG9pbnRQYXRoKTtcbiAgICBpZiAoIWlzRW50cnlQb2ludChlbnRyeVBvaW50KSB8fCAhZW50cnlQb2ludC5jb21waWxlZEJ5QW5ndWxhcikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJlc29sdmVyLmdldEVudHJ5UG9pbnRXaXRoRGVwZW5kZW5jaWVzKGVudHJ5UG9pbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXB1dGUgdGhlIHBhdGggdG8gdGhlIHBhY2thZ2UgdGhhdCBjb250YWlucyB0aGUgZ2l2ZW4gZW50cnktcG9pbnQuXG4gICAqXG4gICAqIEluIHRoaXMgZW50cnktcG9pbnQgZmluZGVyIGl0IGlzIG5vdCB0cml2aWFsIHRvIGZpbmQgdGhlIGNvbnRhaW5pbmcgcGFja2FnZSwgc2luY2UgaXQgaXNcbiAgICogcG9zc2libGUgdGhhdCB0aGlzIGVudHJ5LXBvaW50IGlzIG5vdCBkaXJlY3RseSBiZWxvdyB0aGUgZGlyZWN0b3J5IGNvbnRhaW5pbmcgdGhlIHBhY2thZ2UuXG4gICAqIE1vcmVvdmVyLCB0aGUgaW1wb3J0IHBhdGggY291bGQgYmUgYWZmZWN0ZWQgYnkgcGF0aC1tYXBwaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gZW50cnlQb2ludFBhdGggdGhlIHBhdGggdG8gdGhlIGVudHJ5LXBvaW50LCB3aG9zZSBwYWNrYWdlIHBhdGggd2Ugd2FudCB0byBjb21wdXRlLlxuICAgKi9cbiAgcHJpdmF0ZSBjb21wdXRlUGFja2FnZVBhdGgoZW50cnlQb2ludFBhdGg6IEFic29sdXRlRnNQYXRoKTogQWJzb2x1dGVGc1BhdGgge1xuICAgIC8vIEZpcnN0IHRyeSB0aGUgbWFpbiBiYXNlUGF0aCwgdG8gYXZvaWQgaGF2aW5nIHRvIGNvbXB1dGUgdGhlIG90aGVyIGJhc2VQYXRocyBmcm9tIHRoZSBwYXRoc1xuICAgIC8vIG1hcHBpbmdzLCB3aGljaCBjYW4gYmUgY29tcHV0YXRpb25hbGx5IGludGVuc2l2ZS5cbiAgICBpZiAodGhpcy5pc1BhdGhDb250YWluZWRCeSh0aGlzLmJhc2VQYXRoLCBlbnRyeVBvaW50UGF0aCkpIHtcbiAgICAgIGNvbnN0IHBhY2thZ2VQYXRoID0gdGhpcy5jb21wdXRlUGFja2FnZVBhdGhGcm9tQ29udGFpbmluZ1BhdGgoZW50cnlQb2ludFBhdGgsIHRoaXMuYmFzZVBhdGgpO1xuICAgICAgaWYgKHBhY2thZ2VQYXRoICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBwYWNrYWdlUGF0aDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUaGUgbWFpbiBgYmFzZVBhdGhgIGRpZG4ndCB3b3JrIG91dCBzbyBub3cgd2UgdHJ5IHRoZSBgYmFzZVBhdGhzYCBjb21wdXRlZCBmcm9tIHRoZSBwYXRoc1xuICAgIC8vIG1hcHBpbmdzIGluIGB0c2NvbmZpZy5qc29uYC5cbiAgICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIHRoaXMuZ2V0QmFzZVBhdGhzKCkpIHtcbiAgICAgIGlmICh0aGlzLmlzUGF0aENvbnRhaW5lZEJ5KGJhc2VQYXRoLCBlbnRyeVBvaW50UGF0aCkpIHtcbiAgICAgICAgY29uc3QgcGFja2FnZVBhdGggPSB0aGlzLmNvbXB1dGVQYWNrYWdlUGF0aEZyb21Db250YWluaW5nUGF0aChlbnRyeVBvaW50UGF0aCwgYmFzZVBhdGgpO1xuICAgICAgICBpZiAocGFja2FnZVBhdGggIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gcGFja2FnZVBhdGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgd2UgZ290IGhlcmUgdGhlbiB3ZSBjb3VsZG4ndCBmaW5kIGEgYHBhY2thZ2VQYXRoYCBmb3IgdGhlIGN1cnJlbnQgYGJhc2VQYXRoYC5cbiAgICAgICAgLy8gU2luY2UgYGJhc2VQYXRoYHMgYXJlIGd1YXJhbnRlZWQgbm90IHRvIGJlIGEgc3ViLWRpcmVjdG9yeSBvZiBlYWNoIG90aGVyIHRoZW4gbm8gb3RoZXJcbiAgICAgICAgLy8gYGJhc2VQYXRoYCB3aWxsIG1hdGNoIGVpdGhlci5cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmluYWxseSwgaWYgd2UgY291bGRuJ3QgZmluZCBhIGBwYWNrYWdlUGF0aGAgdXNpbmcgYGJhc2VQYXRoc2AgdGhlbiB0cnkgdG8gZmluZCB0aGUgbmVhcmVzdFxuICAgIC8vIGBub2RlX21vZHVsZXNgIHRoYXQgY29udGFpbnMgdGhlIGBlbnRyeVBvaW50UGF0aGAsIGlmIHRoZXJlIGlzIG9uZSwgYW5kIHVzZSBpdCBhcyBhXG4gICAgLy8gYGJhc2VQYXRoYC5cbiAgICByZXR1cm4gdGhpcy5jb21wdXRlUGFja2FnZVBhdGhGcm9tTmVhcmVzdE5vZGVNb2R1bGVzKGVudHJ5UG9pbnRQYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlIHdoZXRoZXIgdGhlIGB0ZXN0YCBwYXRoIGlzIGNvbnRhaW5lZCB3aXRoaW4gdGhlIGBiYXNlYCBwYXRoLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBkb2Vzbid0IHVzZSBhIHNpbXBsZSBgc3RhcnRzV2l0aCgpYCBzaW5jZSB0aGF0IHdvdWxkIHJlc3VsdCBpbiBhIGZhbHNlIHBvc2l0aXZlXG4gICAqIGZvciBgdGVzdGAgcGF0aHMgc3VjaCBhcyBgYS9iL2MteGAgd2hlbiB0aGUgYGJhc2VgIHBhdGggaXMgYGEvYi9jYC5cbiAgICpcbiAgICogU2luY2UgYGZzLnJlbGF0aXZlKClgIGNhbiBiZSBxdWl0ZSBleHBlbnNpdmUgd2UgY2hlY2sgdGhlIGZhc3QgcG9zc2liaWxpdGllcyBmaXJzdC5cbiAgICovXG4gIHByaXZhdGUgaXNQYXRoQ29udGFpbmVkQnkoYmFzZTogQWJzb2x1dGVGc1BhdGgsIHRlc3Q6IEFic29sdXRlRnNQYXRoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRlc3QgPT09IGJhc2UgfHxcbiAgICAgICAgKHRlc3Quc3RhcnRzV2l0aChiYXNlKSAmJiAhdGhpcy5mcy5yZWxhdGl2ZShiYXNlLCB0ZXN0KS5zdGFydHNXaXRoKCcuLicpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggZG93biB0byB0aGUgYGVudHJ5UG9pbnRQYXRoYCBmcm9tIHRoZSBgY29udGFpbmluZ1BhdGhgIGZvciB0aGUgZmlyc3QgYHBhY2thZ2UuanNvbmAgdGhhdFxuICAgKiB3ZSBjb21lIHRvLiBUaGlzIGlzIHRoZSBwYXRoIHRvIHRoZSBlbnRyeS1wb2ludCdzIGNvbnRhaW5pbmcgcGFja2FnZS4gRm9yIGV4YW1wbGUgaWZcbiAgICogYGNvbnRhaW5pbmdQYXRoYCBpcyBgL2EvYi9jYCBhbmQgYGVudHJ5UG9pbnRQYXRoYCBpcyBgL2EvYi9jL2QvZWAgYW5kIHRoZXJlIGV4aXN0c1xuICAgKiBgL2EvYi9jL2QvcGFja2FnZS5qc29uYCBhbmQgYC9hL2IvYy9kL2UvcGFja2FnZS5qc29uYCwgdGhlbiB3ZSB3aWxsIHJldHVybiBgL2EvYi9jL2RgLlxuICAgKlxuICAgKiBUbyBhY2NvdW50IGZvciBuZXN0ZWQgYG5vZGVfbW9kdWxlc2Agd2UgYWN0dWFsbHkgc3RhcnQgdGhlIHNlYXJjaCBhdCB0aGUgbGFzdCBgbm9kZV9tb2R1bGVzYCBpblxuICAgKiB0aGUgYGVudHJ5UG9pbnRQYXRoYCB0aGF0IGlzIGJlbG93IHRoZSBgY29udGFpbmluZ1BhdGhgLiBFLmcuIGlmIGBjb250YWluaW5nUGF0aGAgaXMgYC9hL2IvY2BcbiAgICogYW5kIGBlbnRyeVBvaW50UGF0aGAgaXMgYC9hL2IvYy9kL25vZGVfbW9kdWxlcy94L3kvemAsIHdlIHN0YXJ0IHRoZSBzZWFyY2ggYXRcbiAgICogYC9hL2IvYy9kL25vZGVfbW9kdWxlc2AuXG4gICAqL1xuICBwcml2YXRlIGNvbXB1dGVQYWNrYWdlUGF0aEZyb21Db250YWluaW5nUGF0aChcbiAgICAgIGVudHJ5UG9pbnRQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgY29udGFpbmluZ1BhdGg6IEFic29sdXRlRnNQYXRoKTogQWJzb2x1dGVGc1BhdGh8bnVsbCB7XG4gICAgbGV0IHBhY2thZ2VQYXRoID0gY29udGFpbmluZ1BhdGg7XG4gICAgY29uc3Qgc2VnbWVudHMgPSB0aGlzLnNwbGl0UGF0aCh0aGlzLmZzLnJlbGF0aXZlKGNvbnRhaW5pbmdQYXRoLCBlbnRyeVBvaW50UGF0aCkpO1xuICAgIGxldCBub2RlTW9kdWxlc0luZGV4ID0gc2VnbWVudHMubGFzdEluZGV4T2YoJ25vZGVfbW9kdWxlcycgYXMgUGF0aFNlZ21lbnQpO1xuXG4gICAgLy8gSWYgdGhlcmUgYXJlIG5vIGBub2RlX21vZHVsZXNgIGluIHRoZSByZWxhdGl2ZSBwYXRoIGJldHdlZW4gdGhlIGBiYXNlUGF0aGAgYW5kIHRoZVxuICAgIC8vIGBlbnRyeVBvaW50UGF0aGAgdGhlbiBqdXN0IHRyeSB0aGUgYGJhc2VQYXRoYCBhcyB0aGUgYHBhY2thZ2VQYXRoYC5cbiAgICAvLyAoVGhpcyBjYW4gYmUgdGhlIGNhc2Ugd2l0aCBwYXRoLW1hcHBlZCBlbnRyeS1wb2ludHMuKVxuICAgIGlmIChub2RlTW9kdWxlc0luZGV4ID09PSAtMSkge1xuICAgICAgaWYgKHRoaXMuZnMuZXhpc3RzKHRoaXMuZnMuam9pbihwYWNrYWdlUGF0aCwgJ3BhY2thZ2UuanNvbicpKSkge1xuICAgICAgICByZXR1cm4gcGFja2FnZVBhdGg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU3RhcnQgdGhlIHNlYXJjaCBhdCB0aGUgZGVlcGVzdCBuZXN0ZWQgYG5vZGVfbW9kdWxlc2AgZm9sZGVyIHRoYXQgaXMgYmVsb3cgdGhlIGBiYXNlUGF0aGBcbiAgICAvLyBidXQgYWJvdmUgdGhlIGBlbnRyeVBvaW50UGF0aGAsIGlmIHRoZXJlIGFyZSBhbnkuXG4gICAgd2hpbGUgKG5vZGVNb2R1bGVzSW5kZXggPj0gMCkge1xuICAgICAgcGFja2FnZVBhdGggPSB0aGlzLmZzLmpvaW4ocGFja2FnZVBhdGgsIHNlZ21lbnRzLnNoaWZ0KCkhKTtcbiAgICAgIG5vZGVNb2R1bGVzSW5kZXgtLTtcbiAgICB9XG5cbiAgICAvLyBOb3RlIHRoYXQgd2Ugc3RhcnQgYXQgdGhlIGZvbGRlciBiZWxvdyB0aGUgY3VycmVudCBjYW5kaWRhdGUgYHBhY2thZ2VQYXRoYCBiZWNhdXNlIHRoZVxuICAgIC8vIGluaXRpYWwgY2FuZGlkYXRlIGBwYWNrYWdlUGF0aGAgaXMgZWl0aGVyIGEgYG5vZGVfbW9kdWxlc2AgZm9sZGVyIG9yIHRoZSBgYmFzZVBhdGhgIHdpdGhcbiAgICAvLyBubyBgcGFja2FnZS5qc29uYC5cbiAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2Ygc2VnbWVudHMpIHtcbiAgICAgIHBhY2thZ2VQYXRoID0gdGhpcy5mcy5qb2luKHBhY2thZ2VQYXRoLCBzZWdtZW50KTtcbiAgICAgIGlmICh0aGlzLmZzLmV4aXN0cyh0aGlzLmZzLmpvaW4ocGFja2FnZVBhdGgsICdwYWNrYWdlLmpzb24nKSkpIHtcbiAgICAgICAgcmV0dXJuIHBhY2thZ2VQYXRoO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggdXAgdGhlIGRpcmVjdG9yeSB0cmVlIGZyb20gdGhlIGBlbnRyeVBvaW50UGF0aGAgbG9va2luZyBmb3IgYSBgbm9kZV9tb2R1bGVzYCBkaXJlY3RvcnlcbiAgICogdGhhdCB3ZSBjYW4gdXNlIGFzIGEgcG90ZW50aWFsIHN0YXJ0aW5nIHBvaW50IGZvciBjb21wdXRpbmcgdGhlIHBhY2thZ2UgcGF0aC5cbiAgICovXG4gIHByaXZhdGUgY29tcHV0ZVBhY2thZ2VQYXRoRnJvbU5lYXJlc3ROb2RlTW9kdWxlcyhlbnRyeVBvaW50UGF0aDogQWJzb2x1dGVGc1BhdGgpOiBBYnNvbHV0ZUZzUGF0aCB7XG4gICAgbGV0IHBhY2thZ2VQYXRoID0gZW50cnlQb2ludFBhdGg7XG4gICAgbGV0IHNjb3BlZFBhY2thZ2VQYXRoID0gcGFja2FnZVBhdGg7XG4gICAgbGV0IGNvbnRhaW5lclBhdGggPSB0aGlzLmZzLmRpcm5hbWUocGFja2FnZVBhdGgpO1xuICAgIHdoaWxlICghdGhpcy5mcy5pc1Jvb3QoY29udGFpbmVyUGF0aCkgJiYgIWNvbnRhaW5lclBhdGguZW5kc1dpdGgoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICBzY29wZWRQYWNrYWdlUGF0aCA9IHBhY2thZ2VQYXRoO1xuICAgICAgcGFja2FnZVBhdGggPSBjb250YWluZXJQYXRoO1xuICAgICAgY29udGFpbmVyUGF0aCA9IHRoaXMuZnMuZGlybmFtZShjb250YWluZXJQYXRoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mcy5leGlzdHModGhpcy5mcy5qb2luKHBhY2thZ2VQYXRoLCAncGFja2FnZS5qc29uJykpKSB7XG4gICAgICAvLyBUaGUgZGlyZWN0b3J5IGRpcmVjdGx5IGJlbG93IGBub2RlX21vZHVsZXNgIGlzIGEgcGFja2FnZSAtIHVzZSBpdFxuICAgICAgcmV0dXJuIHBhY2thZ2VQYXRoO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHRoaXMuZnMuYmFzZW5hbWUocGFja2FnZVBhdGgpLnN0YXJ0c1dpdGgoJ0AnKSAmJlxuICAgICAgICB0aGlzLmZzLmV4aXN0cyh0aGlzLmZzLmpvaW4oc2NvcGVkUGFja2FnZVBhdGgsICdwYWNrYWdlLmpzb24nKSkpIHtcbiAgICAgIC8vIFRoZSBkaXJlY3RvcnkgZGlyZWN0bHkgYmVsb3cgdGhlIGBub2RlX21vZHVsZXNgIGlzIGEgc2NvcGUgYW5kIHRoZSBkaXJlY3RvcnkgZGlyZWN0bHlcbiAgICAgIC8vIGJlbG93IHRoYXQgaXMgYSBzY29wZWQgcGFja2FnZSAtIHVzZSBpdFxuICAgICAgcmV0dXJuIHNjb3BlZFBhY2thZ2VQYXRoO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB3ZSBnZXQgaGVyZSB0aGVuIG5vbmUgb2YgdGhlIGBiYXNlUGF0aHNgIGNvbnRhaW5lZCB0aGUgYGVudHJ5UG9pbnRQYXRoYCBhbmQgdGhlXG4gICAgICAvLyBgZW50cnlQb2ludFBhdGhgIGNvbnRhaW5zIG5vIGBub2RlX21vZHVsZXNgIHRoYXQgY29udGFpbnMgYSBwYWNrYWdlIG9yIGEgc2NvcGVkXG4gICAgICAvLyBwYWNrYWdlLiBBbGwgd2UgY2FuIGRvIGlzIGFzc3VtZSB0aGF0IHRoaXMgZW50cnktcG9pbnQgaXMgYSBwcmltYXJ5IGVudHJ5LXBvaW50IHRvIGFcbiAgICAgIC8vIHBhY2thZ2UuXG4gICAgICByZXR1cm4gZW50cnlQb2ludFBhdGg7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNwbGl0IHRoZSBnaXZlbiBgcGF0aGAgaW50byBwYXRoIHNlZ21lbnRzIHVzaW5nIGFuIEZTIGluZGVwZW5kZW50IGFsZ29yaXRobS5cbiAgICovXG4gIHByaXZhdGUgc3BsaXRQYXRoKHBhdGg6IFBhdGhTZWdtZW50fEFic29sdXRlRnNQYXRoKSB7XG4gICAgY29uc3Qgc2VnbWVudHMgPSBbXTtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5mcy5kaXJuYW1lKHBhdGgpO1xuICAgIHdoaWxlIChwYXRoICE9PSBjb250YWluZXIpIHtcbiAgICAgIHNlZ21lbnRzLnVuc2hpZnQodGhpcy5mcy5iYXNlbmFtZShwYXRoKSk7XG4gICAgICBwYXRoID0gY29udGFpbmVyO1xuICAgICAgY29udGFpbmVyID0gdGhpcy5mcy5kaXJuYW1lKGNvbnRhaW5lcik7XG4gICAgfVxuICAgIHJldHVybiBzZWdtZW50cztcbiAgfVxufVxuIl19