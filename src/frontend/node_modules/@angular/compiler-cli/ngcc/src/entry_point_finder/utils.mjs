/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getFileSystem } from '../../../src/ngtsc/file_system';
/**
 * Extract all the base-paths that we need to search for entry-points.
 *
 * This always contains the standard base-path (`sourceDirectory`).
 * But it also parses the `paths` mappings object to guess additional base-paths.
 *
 * For example:
 *
 * ```
 * getBasePaths('/node_modules', {baseUrl: '/dist', paths: {'*': ['lib/*', 'lib/generated/*']}})
 * > ['/node_modules', '/dist/lib']
 * ```
 *
 * Notice that `'/dist'` is not included as there is no `'*'` path,
 * and `'/dist/lib/generated'` is not included as it is covered by `'/dist/lib'`.
 *
 * @param sourceDirectory The standard base-path (e.g. node_modules).
 * @param pathMappings Path mapping configuration, from which to extract additional base-paths.
 */
export function getBasePaths(logger, sourceDirectory, pathMappings) {
    const fs = getFileSystem();
    const basePaths = [sourceDirectory];
    if (pathMappings) {
        const baseUrl = fs.resolve(pathMappings.baseUrl);
        if (fs.isRoot(baseUrl)) {
            logger.warn(`The provided pathMappings baseUrl is the root path ${baseUrl}.\n` +
                `This is likely to mess up how ngcc finds entry-points and is probably not correct.\n` +
                `Please check your path mappings configuration such as in the tsconfig.json file.`);
        }
        for (const paths of Object.values(pathMappings.paths)) {
            for (const path of paths) {
                let foundMatch = false;
                // We only want base paths that exist and are not files
                const { prefix, hasWildcard } = extractPathPrefix(path);
                let basePath = fs.resolve(baseUrl, prefix);
                if (fs.exists(basePath) && fs.stat(basePath).isFile()) {
                    basePath = fs.dirname(basePath);
                }
                if (fs.exists(basePath)) {
                    // The `basePath` is itself a directory
                    basePaths.push(basePath);
                    foundMatch = true;
                }
                if (hasWildcard) {
                    // The path contains a wildcard (`*`) so also try searching for directories that start
                    // with the wildcard prefix path segment.
                    const wildcardContainer = fs.dirname(basePath);
                    const wildcardPrefix = fs.basename(basePath);
                    if (isExistingDirectory(fs, wildcardContainer)) {
                        const candidates = fs.readdir(wildcardContainer);
                        for (const candidate of candidates) {
                            if (candidate.startsWith(wildcardPrefix)) {
                                const candidatePath = fs.resolve(wildcardContainer, candidate);
                                if (isExistingDirectory(fs, candidatePath)) {
                                    foundMatch = true;
                                    basePaths.push(candidatePath);
                                }
                            }
                        }
                    }
                }
                if (!foundMatch) {
                    // We neither found a direct match (i.e. `basePath` is an existing directory) nor a
                    // directory that starts with a wildcard prefix.
                    logger.debug(`The basePath "${basePath}" computed from baseUrl "${baseUrl}" and path mapping "${path}" does not exist in the file-system.\n` +
                        `It will not be scanned for entry-points.`);
                }
            }
        }
    }
    const dedupedBasePaths = dedupePaths(fs, basePaths);
    // We want to ensure that the `sourceDirectory` is included when it is a node_modules folder.
    // Otherwise our entry-point finding algorithm would fail to walk that folder.
    if (fs.basename(sourceDirectory) === 'node_modules' &&
        !dedupedBasePaths.includes(sourceDirectory)) {
        dedupedBasePaths.unshift(sourceDirectory);
    }
    return dedupedBasePaths;
}
function isExistingDirectory(fs, path) {
    return fs.exists(path) && fs.stat(path).isDirectory();
}
/**
 * Extract everything in the `path` up to the first `*`.
 * @param path The path to parse.
 * @returns The extracted prefix and a flag to indicate whether there was a wildcard `*`.
 */
function extractPathPrefix(path) {
    const [prefix, rest] = path.split('*', 2);
    return { prefix, hasWildcard: rest !== undefined };
}
/**
 * Run a task and track how long it takes.
 *
 * @param task The task whose duration we are tracking.
 * @param log The function to call with the duration of the task.
 * @returns The result of calling `task`.
 */
export function trackDuration(task, log) {
    const startTime = Date.now();
    const result = task();
    const duration = Math.round((Date.now() - startTime) / 100) / 10;
    log(duration);
    return result;
}
/**
 * Remove paths that are contained by other paths.
 *
 * For example:
 * Given `['a/b/c', 'a/b/x', 'a/b', 'd/e', 'd/f']` we will end up with `['a/b', 'd/e', 'd/f]`.
 * (Note that we do not get `d` even though `d/e` and `d/f` share a base directory, since `d` is not
 * one of the base paths.)
 */
function dedupePaths(fs, paths) {
    const root = { children: new Map() };
    for (const path of paths) {
        addPath(fs, root, path);
    }
    return flattenTree(root);
}
/**
 * Add a path (defined by the `segments`) to the current `node` in the tree.
 */
function addPath(fs, root, path) {
    let node = root;
    if (!fs.isRoot(path)) {
        const segments = path.split('/');
        for (let index = 0; index < segments.length; index++) {
            if (isLeaf(node)) {
                // We hit a leaf so don't bother processing any more of the path
                return;
            }
            // This is not the end of the path continue to process the rest of this path.
            const next = segments[index];
            if (!node.children.has(next)) {
                node.children.set(next, { children: new Map() });
            }
            node = node.children.get(next);
        }
    }
    // This path has finished so convert this node to a leaf
    convertToLeaf(node, path);
}
/**
 * Flatten the tree of nodes back into an array of absolute paths.
 */
function flattenTree(root) {
    const paths = [];
    const nodes = [root];
    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (isLeaf(node)) {
            // We found a leaf so store the currentPath
            paths.push(node.path);
        }
        else {
            node.children.forEach(value => nodes.push(value));
        }
    }
    return paths;
}
function isLeaf(node) {
    return node.path !== undefined;
}
function convertToLeaf(node, path) {
    node.path = path;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvZW50cnlfcG9pbnRfZmluZGVyL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBaUIsYUFBYSxFQUF1QyxNQUFNLGdDQUFnQyxDQUFDO0FBSW5IOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxNQUFNLFVBQVUsWUFBWSxDQUN4QixNQUFjLEVBQUUsZUFBK0IsRUFDL0MsWUFBb0M7SUFDdEMsTUFBTSxFQUFFLEdBQUcsYUFBYSxFQUFFLENBQUM7SUFDM0IsTUFBTSxTQUFTLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNwQyxJQUFJLFlBQVksRUFBRTtRQUNoQixNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqRCxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDdEIsTUFBTSxDQUFDLElBQUksQ0FDUCxzREFBc0QsT0FBTyxLQUFLO2dCQUNsRSxzRkFBc0Y7Z0JBQ3RGLGtGQUFrRixDQUFDLENBQUM7U0FDekY7UUFDRCxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3JELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO2dCQUN4QixJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7Z0JBRXZCLHVEQUF1RDtnQkFDdkQsTUFBTSxFQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEQsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQzND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ZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0Fic29sdXRlRnNQYXRoLCBnZXRGaWxlU3lzdGVtLCBQYXRoTWFuaXB1bGF0aW9uLCBSZWFkb25seUZpbGVTeXN0ZW19IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0xvZ2dlcn0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2xvZ2dpbmcnO1xuaW1wb3J0IHtQYXRoTWFwcGluZ3N9IGZyb20gJy4uL3BhdGhfbWFwcGluZ3MnO1xuXG4vKipcbiAqIEV4dHJhY3QgYWxsIHRoZSBiYXNlLXBhdGhzIHRoYXQgd2UgbmVlZCB0byBzZWFyY2ggZm9yIGVudHJ5LXBvaW50cy5cbiAqXG4gKiBUaGlzIGFsd2F5cyBjb250YWlucyB0aGUgc3RhbmRhcmQgYmFzZS1wYXRoIChgc291cmNlRGlyZWN0b3J5YCkuXG4gKiBCdXQgaXQgYWxzbyBwYXJzZXMgdGhlIGBwYXRoc2AgbWFwcGluZ3Mgb2JqZWN0IHRvIGd1ZXNzIGFkZGl0aW9uYWwgYmFzZS1wYXRocy5cbiAqXG4gKiBGb3IgZXhhbXBsZTpcbiAqXG4gKiBgYGBcbiAqIGdldEJhc2VQYXRocygnL25vZGVfbW9kdWxlcycsIHtiYXNlVXJsOiAnL2Rpc3QnLCBwYXRoczogeycqJzogWydsaWIvKicsICdsaWIvZ2VuZXJhdGVkLyonXX19KVxuICogPiBbJy9ub2RlX21vZHVsZXMnLCAnL2Rpc3QvbGliJ11cbiAqIGBgYFxuICpcbiAqIE5vdGljZSB0aGF0IGAnL2Rpc3QnYCBpcyBub3QgaW5jbHVkZWQgYXMgdGhlcmUgaXMgbm8gYCcqJ2AgcGF0aCxcbiAqIGFuZCBgJy9kaXN0L2xpYi9nZW5lcmF0ZWQnYCBpcyBub3QgaW5jbHVkZWQgYXMgaXQgaXMgY292ZXJlZCBieSBgJy9kaXN0L2xpYidgLlxuICpcbiAqIEBwYXJhbSBzb3VyY2VEaXJlY3RvcnkgVGhlIHN0YW5kYXJkIGJhc2UtcGF0aCAoZS5nLiBub2RlX21vZHVsZXMpLlxuICogQHBhcmFtIHBhdGhNYXBwaW5ncyBQYXRoIG1hcHBpbmcgY29uZmlndXJhdGlvbiwgZnJvbSB3aGljaCB0byBleHRyYWN0IGFkZGl0aW9uYWwgYmFzZS1wYXRocy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEJhc2VQYXRocyhcbiAgICBsb2dnZXI6IExvZ2dlciwgc291cmNlRGlyZWN0b3J5OiBBYnNvbHV0ZUZzUGF0aCxcbiAgICBwYXRoTWFwcGluZ3M6IFBhdGhNYXBwaW5nc3x1bmRlZmluZWQpOiBBYnNvbHV0ZUZzUGF0aFtdIHtcbiAgY29uc3QgZnMgPSBnZXRGaWxlU3lzdGVtKCk7XG4gIGNvbnN0IGJhc2VQYXRocyA9IFtzb3VyY2VEaXJlY3RvcnldO1xuICBpZiAocGF0aE1hcHBpbmdzKSB7XG4gICAgY29uc3QgYmFzZVVybCA9IGZzLnJlc29sdmUocGF0aE1hcHBpbmdzLmJhc2VVcmwpO1xuICAgIGlmIChmcy5pc1Jvb3QoYmFzZVVybCkpIHtcbiAgICAgIGxvZ2dlci53YXJuKFxuICAgICAgICAgIGBUaGUgcHJvdmlkZWQgcGF0aE1hcHBpbmdzIGJhc2VVcmwgaXMgdGhlIHJvb3QgcGF0aCAke2Jhc2VVcmx9LlxcbmAgK1xuICAgICAgICAgIGBUaGlzIGlzIGxpa2VseSB0byBtZXNzIHVwIGhvdyBuZ2NjIGZpbmRzIGVudHJ5LXBvaW50cyBhbmQgaXMgcHJvYmFibHkgbm90IGNvcnJlY3QuXFxuYCArXG4gICAgICAgICAgYFBsZWFzZSBjaGVjayB5b3VyIHBhdGggbWFwcGluZ3MgY29uZmlndXJhdGlvbiBzdWNoIGFzIGluIHRoZSB0c2NvbmZpZy5qc29uIGZpbGUuYCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGF0aHMgb2YgT2JqZWN0LnZhbHVlcyhwYXRoTWFwcGluZ3MucGF0aHMpKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcbiAgICAgICAgbGV0IGZvdW5kTWF0Y2ggPSBmYWxzZTtcblxuICAgICAgICAvLyBXZSBvbmx5IHdhbnQgYmFzZSBwYXRocyB0aGF0IGV4aXN0IGFuZCBhcmUgbm90IGZpbGVzXG4gICAgICAgIGNvbnN0IHtwcmVmaXgsIGhhc1dpbGRjYXJkfSA9IGV4dHJhY3RQYXRoUHJlZml4KHBhdGgpO1xuICAgICAgICBsZXQgYmFzZVBhdGggPSBmcy5yZXNvbHZlKGJhc2VVcmwsIHByZWZpeCk7XG4gICAgICAgIGlmIChmcy5leGlzdHMoYmFzZVBhdGgpICYmIGZzLnN0YXQoYmFzZVBhdGgpLmlzRmlsZSgpKSB7XG4gICAgICAgICAgYmFzZVBhdGggPSBmcy5kaXJuYW1lKGJhc2VQYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmcy5leGlzdHMoYmFzZVBhdGgpKSB7XG4gICAgICAgICAgLy8gVGhlIGBiYXNlUGF0aGAgaXMgaXRzZWxmIGEgZGlyZWN0b3J5XG4gICAgICAgICAgYmFzZVBhdGhzLnB1c2goYmFzZVBhdGgpO1xuICAgICAgICAgIGZvdW5kTWF0Y2ggPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc1dpbGRjYXJkKSB7XG4gICAgICAgICAgLy8gVGhlIHBhdGggY29udGFpbnMgYSB3aWxkY2FyZCAoYCpgKSBzbyBhbHNvIHRyeSBzZWFyY2hpbmcgZm9yIGRpcmVjdG9yaWVzIHRoYXQgc3RhcnRcbiAgICAgICAgICAvLyB3aXRoIHRoZSB3aWxkY2FyZCBwcmVmaXggcGF0aCBzZWdtZW50LlxuICAgICAgICAgIGNvbnN0IHdpbGRjYXJkQ29udGFpbmVyID0gZnMuZGlybmFtZShiYXNlUGF0aCk7XG4gICAgICAgICAgY29uc3Qgd2lsZGNhcmRQcmVmaXggPSBmcy5iYXNlbmFtZShiYXNlUGF0aCk7XG4gICAgICAgICAgaWYgKGlzRXhpc3RpbmdEaXJlY3RvcnkoZnMsIHdpbGRjYXJkQ29udGFpbmVyKSkge1xuICAgICAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IGZzLnJlYWRkaXIod2lsZGNhcmRDb250YWluZXIpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgY2FuZGlkYXRlcykge1xuICAgICAgICAgICAgICBpZiAoY2FuZGlkYXRlLnN0YXJ0c1dpdGgod2lsZGNhcmRQcmVmaXgpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FuZGlkYXRlUGF0aCA9IGZzLnJlc29sdmUod2lsZGNhcmRDb250YWluZXIsIGNhbmRpZGF0ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGlzRXhpc3RpbmdEaXJlY3RvcnkoZnMsIGNhbmRpZGF0ZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICBmb3VuZE1hdGNoID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGJhc2VQYXRocy5wdXNoKGNhbmRpZGF0ZVBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZm91bmRNYXRjaCkge1xuICAgICAgICAgIC8vIFdlIG5laXRoZXIgZm91bmQgYSBkaXJlY3QgbWF0Y2ggKGkuZS4gYGJhc2VQYXRoYCBpcyBhbiBleGlzdGluZyBkaXJlY3RvcnkpIG5vciBhXG4gICAgICAgICAgLy8gZGlyZWN0b3J5IHRoYXQgc3RhcnRzIHdpdGggYSB3aWxkY2FyZCBwcmVmaXguXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgICAgICAgICBgVGhlIGJhc2VQYXRoIFwiJHtiYXNlUGF0aH1cIiBjb21wdXRlZCBmcm9tIGJhc2VVcmwgXCIke2Jhc2VVcmx9XCIgYW5kIHBhdGggbWFwcGluZyBcIiR7XG4gICAgICAgICAgICAgICAgICBwYXRofVwiIGRvZXMgbm90IGV4aXN0IGluIHRoZSBmaWxlLXN5c3RlbS5cXG5gICtcbiAgICAgICAgICAgICAgYEl0IHdpbGwgbm90IGJlIHNjYW5uZWQgZm9yIGVudHJ5LXBvaW50cy5gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGRlZHVwZWRCYXNlUGF0aHMgPSBkZWR1cGVQYXRocyhmcywgYmFzZVBhdGhzKTtcblxuICAvLyBXZSB3YW50IHRvIGVuc3VyZSB0aGF0IHRoZSBgc291cmNlRGlyZWN0b3J5YCBpcyBpbmNsdWRlZCB3aGVuIGl0IGlzIGEgbm9kZV9tb2R1bGVzIGZvbGRlci5cbiAgLy8gT3RoZXJ3aXNlIG91ciBlbnRyeS1wb2ludCBmaW5kaW5nIGFsZ29yaXRobSB3b3VsZCBmYWlsIHRvIHdhbGsgdGhhdCBmb2xkZXIuXG4gIGlmIChmcy5iYXNlbmFtZShzb3VyY2VEaXJlY3RvcnkpID09PSAnbm9kZV9tb2R1bGVzJyAmJlxuICAgICAgIWRlZHVwZWRCYXNlUGF0aHMuaW5jbHVkZXMoc291cmNlRGlyZWN0b3J5KSkge1xuICAgIGRlZHVwZWRCYXNlUGF0aHMudW5zaGlmdChzb3VyY2VEaXJlY3RvcnkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZHVwZWRCYXNlUGF0aHM7XG59XG5cbmZ1bmN0aW9uIGlzRXhpc3RpbmdEaXJlY3RvcnkoZnM6IFJlYWRvbmx5RmlsZVN5c3RlbSwgcGF0aDogQWJzb2x1dGVGc1BhdGgpOiBib29sZWFuIHtcbiAgcmV0dXJuIGZzLmV4aXN0cyhwYXRoKSAmJiBmcy5zdGF0KHBhdGgpLmlzRGlyZWN0b3J5KCk7XG59XG5cbi8qKlxuICogRXh0cmFjdCBldmVyeXRoaW5nIGluIHRoZSBgcGF0aGAgdXAgdG8gdGhlIGZpcnN0IGAqYC5cbiAqIEBwYXJhbSBwYXRoIFRoZSBwYXRoIHRvIHBhcnNlLlxuICogQHJldHVybnMgVGhlIGV4dHJhY3RlZCBwcmVmaXggYW5kIGEgZmxhZyB0byBpbmRpY2F0ZSB3aGV0aGVyIHRoZXJlIHdhcyBhIHdpbGRjYXJkIGAqYC5cbiAqL1xuZnVuY3Rpb24gZXh0cmFjdFBhdGhQcmVmaXgocGF0aDogc3RyaW5nKToge3ByZWZpeDogc3RyaW5nLCBoYXNXaWxkY2FyZDogYm9vbGVhbn0ge1xuICBjb25zdCBbcHJlZml4LCByZXN0XSA9IHBhdGguc3BsaXQoJyonLCAyKTtcbiAgcmV0dXJuIHtwcmVmaXgsIGhhc1dpbGRjYXJkOiByZXN0ICE9PSB1bmRlZmluZWR9O1xufVxuXG4vKipcbiAqIFJ1biBhIHRhc2sgYW5kIHRyYWNrIGhvdyBsb25nIGl0IHRha2VzLlxuICpcbiAqIEBwYXJhbSB0YXNrIFRoZSB0YXNrIHdob3NlIGR1cmF0aW9uIHdlIGFyZSB0cmFja2luZy5cbiAqIEBwYXJhbSBsb2cgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2l0aCB0aGUgZHVyYXRpb24gb2YgdGhlIHRhc2suXG4gKiBAcmV0dXJucyBUaGUgcmVzdWx0IG9mIGNhbGxpbmcgYHRhc2tgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhY2tEdXJhdGlvbjxUID0gdm9pZD4odGFzazogKCkgPT4gVCBleHRlbmRzIFByb21pc2U8dW5rbm93bj4/IG5ldmVyIDogVCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nOiAoZHVyYXRpb246IG51bWJlcikgPT4gdm9pZCk6IFQge1xuICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICBjb25zdCByZXN1bHQgPSB0YXNrKCk7XG4gIGNvbnN0IGR1cmF0aW9uID0gTWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSkgLyAxMDApIC8gMTA7XG4gIGxvZyhkdXJhdGlvbik7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogUmVtb3ZlIHBhdGhzIHRoYXQgYXJlIGNvbnRhaW5lZCBieSBvdGhlciBwYXRocy5cbiAqXG4gKiBGb3IgZXhhbXBsZTpcbiAqIEdpdmVuIGBbJ2EvYi9jJywgJ2EvYi94JywgJ2EvYicsICdkL2UnLCAnZC9mJ11gIHdlIHdpbGwgZW5kIHVwIHdpdGggYFsnYS9iJywgJ2QvZScsICdkL2ZdYC5cbiAqIChOb3RlIHRoYXQgd2UgZG8gbm90IGdldCBgZGAgZXZlbiB0aG91Z2ggYGQvZWAgYW5kIGBkL2ZgIHNoYXJlIGEgYmFzZSBkaXJlY3RvcnksIHNpbmNlIGBkYCBpcyBub3RcbiAqIG9uZSBvZiB0aGUgYmFzZSBwYXRocy4pXG4gKi9cbmZ1bmN0aW9uIGRlZHVwZVBhdGhzKGZzOiBQYXRoTWFuaXB1bGF0aW9uLCBwYXRoczogQWJzb2x1dGVGc1BhdGhbXSk6IEFic29sdXRlRnNQYXRoW10ge1xuICBjb25zdCByb290OiBOb2RlID0ge2NoaWxkcmVuOiBuZXcgTWFwKCl9O1xuICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcbiAgICBhZGRQYXRoKGZzLCByb290LCBwYXRoKTtcbiAgfVxuICByZXR1cm4gZmxhdHRlblRyZWUocm9vdCk7XG59XG5cbi8qKlxuICogQWRkIGEgcGF0aCAoZGVmaW5lZCBieSB0aGUgYHNlZ21lbnRzYCkgdG8gdGhlIGN1cnJlbnQgYG5vZGVgIGluIHRoZSB0cmVlLlxuICovXG5mdW5jdGlvbiBhZGRQYXRoKGZzOiBQYXRoTWFuaXB1bGF0aW9uLCByb290OiBOb2RlLCBwYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IHZvaWQge1xuICBsZXQgbm9kZSA9IHJvb3Q7XG4gIGlmICghZnMuaXNSb290KHBhdGgpKSB7XG4gICAgY29uc3Qgc2VnbWVudHMgPSBwYXRoLnNwbGl0KCcvJyk7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHNlZ21lbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgaWYgKGlzTGVhZihub2RlKSkge1xuICAgICAgICAvLyBXZSBoaXQgYSBsZWFmIHNvIGRvbid0IGJvdGhlciBwcm9jZXNzaW5nIGFueSBtb3JlIG9mIHRoZSBwYXRoXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIFRoaXMgaXMgbm90IHRoZSBlbmQgb2YgdGhlIHBhdGggY29udGludWUgdG8gcHJvY2VzcyB0aGUgcmVzdCBvZiB0aGlzIHBhdGguXG4gICAgICBjb25zdCBuZXh0ID0gc2VnbWVudHNbaW5kZXhdO1xuICAgICAgaWYgKCFub2RlLmNoaWxkcmVuLmhhcyhuZXh0KSkge1xuICAgICAgICBub2RlLmNoaWxkcmVuLnNldChuZXh0LCB7Y2hpbGRyZW46IG5ldyBNYXAoKX0pO1xuICAgICAgfVxuICAgICAgbm9kZSA9IG5vZGUuY2hpbGRyZW4uZ2V0KG5leHQpITtcbiAgICB9XG4gIH1cbiAgLy8gVGhpcyBwYXRoIGhhcyBmaW5pc2hlZCBzbyBjb252ZXJ0IHRoaXMgbm9kZSB0byBhIGxlYWZcbiAgY29udmVydFRvTGVhZihub2RlLCBwYXRoKTtcbn1cblxuLyoqXG4gKiBGbGF0dGVuIHRoZSB0cmVlIG9mIG5vZGVzIGJhY2sgaW50byBhbiBhcnJheSBvZiBhYnNvbHV0ZSBwYXRocy5cbiAqL1xuZnVuY3Rpb24gZmxhdHRlblRyZWUocm9vdDogTm9kZSk6IEFic29sdXRlRnNQYXRoW10ge1xuICBjb25zdCBwYXRoczogQWJzb2x1dGVGc1BhdGhbXSA9IFtdO1xuICBjb25zdCBub2RlczogTm9kZVtdID0gW3Jvb3RdO1xuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbm9kZXMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgY29uc3Qgbm9kZSA9IG5vZGVzW2luZGV4XTtcbiAgICBpZiAoaXNMZWFmKG5vZGUpKSB7XG4gICAgICAvLyBXZSBmb3VuZCBhIGxlYWYgc28gc3RvcmUgdGhlIGN1cnJlbnRQYXRoXG4gICAgICBwYXRocy5wdXNoKG5vZGUucGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCh2YWx1ZSA9PiBub2Rlcy5wdXNoKHZhbHVlKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBwYXRocztcbn1cblxuZnVuY3Rpb24gaXNMZWFmKG5vZGU6IE5vZGUpOiBub2RlIGlzIExlYWYge1xuICByZXR1cm4gbm9kZS5wYXRoICE9PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0xlYWYobm9kZTogTm9kZSwgcGF0aDogQWJzb2x1dGVGc1BhdGgpIHtcbiAgbm9kZS5wYXRoID0gcGF0aDtcbn1cblxuaW50ZXJmYWNlIE5vZGUge1xuICBjaGlsZHJlbjogTWFwPHN0cmluZywgTm9kZT47XG4gIHBhdGg/OiBBYnNvbHV0ZUZzUGF0aDtcbn1cblxudHlwZSBMZWFmID0gUmVxdWlyZWQ8Tm9kZT47XG4iXX0=