import { isRelativePath, resolveFileWithPostfixes } from '../utils';
/**
 * This is a very cut-down implementation of the TypeScript module resolution strategy.
 *
 * It is specific to the needs of ngcc and is not intended to be a drop-in replacement
 * for the TS module resolver. It is used to compute the dependencies between entry-points
 * that may be compiled by ngcc.
 *
 * The algorithm only finds `.js` files for internal/relative imports and paths to
 * the folder containing the `package.json` of the entry-point for external imports.
 *
 * It can cope with nested `node_modules` folders and also supports `paths`/`baseUrl`
 * configuration properties, as provided in a `ts.CompilerOptions` object.
 */
export class ModuleResolver {
    constructor(fs, pathMappings, relativeExtensions = ['', '.js', '/index.js']) {
        this.fs = fs;
        this.relativeExtensions = relativeExtensions;
        this.pathMappings = pathMappings ? this.processPathMappings(pathMappings) : [];
    }
    /**
     * Resolve an absolute path for the `moduleName` imported into a file at `fromPath`.
     * @param moduleName The name of the import to resolve.
     * @param fromPath The path to the file containing the import.
     * @returns A path to the resolved module or null if missing.
     * Specifically:
     *  * the absolute path to the package.json of an external module
     *  * a JavaScript file of an internal module
     *  * null if none exists.
     */
    resolveModuleImport(moduleName, fromPath) {
        if (isRelativePath(moduleName)) {
            return this.resolveAsRelativePath(moduleName, fromPath);
        }
        else {
            return this.pathMappings.length && this.resolveByPathMappings(moduleName, fromPath) ||
                this.resolveAsEntryPoint(moduleName, fromPath);
        }
    }
    /**
     * Convert the `pathMappings` into a collection of `PathMapper` functions.
     */
    processPathMappings(pathMappings) {
        const baseUrl = this.fs.resolve(pathMappings.baseUrl);
        return Object.keys(pathMappings.paths).map(pathPattern => {
            const matcher = splitOnStar(pathPattern);
            const templates = pathMappings.paths[pathPattern].map(splitOnStar);
            return { matcher, templates, baseUrl };
        });
    }
    /**
     * Try to resolve a module name, as a relative path, from the `fromPath`.
     *
     * As it is relative, it only looks for files that end in one of the `relativeExtensions`.
     * For example: `${moduleName}.js` or `${moduleName}/index.js`.
     * If neither of these files exist then the method returns `null`.
     */
    resolveAsRelativePath(moduleName, fromPath) {
        const resolvedPath = resolveFileWithPostfixes(this.fs, this.fs.resolve(this.fs.dirname(fromPath), moduleName), this.relativeExtensions);
        return resolvedPath && new ResolvedRelativeModule(resolvedPath);
    }
    /**
     * Try to resolve the `moduleName`, by applying the computed `pathMappings` and
     * then trying to resolve the mapped path as a relative or external import.
     *
     * Whether the mapped path is relative is defined as it being "below the `fromPath`" and not
     * containing `node_modules`.
     *
     * If the mapped path is not relative but does not resolve to an external entry-point, then we
     * check whether it would have resolved to a relative path, in which case it is marked as a
     * "deep-import".
     */
    resolveByPathMappings(moduleName, fromPath) {
        const mappedPaths = this.findMappedPaths(moduleName);
        if (mappedPaths.length > 0) {
            const packagePath = this.findPackagePath(fromPath);
            if (packagePath !== null) {
                for (const mappedPath of mappedPaths) {
                    if (this.isEntryPoint(mappedPath)) {
                        return new ResolvedExternalModule(mappedPath);
                    }
                    const nonEntryPointImport = this.resolveAsRelativePath(mappedPath, fromPath);
                    if (nonEntryPointImport !== null) {
                        return isRelativeImport(packagePath, mappedPath) ? nonEntryPointImport :
                            new ResolvedDeepImport(mappedPath);
                    }
                }
            }
        }
        return null;
    }
    /**
     * Try to resolve the `moduleName` as an external entry-point by searching the `node_modules`
     * folders up the tree for a matching `.../node_modules/${moduleName}`.
     *
     * If a folder is found but the path does not contain a `package.json` then it is marked as a
     * "deep-import".
     */
    resolveAsEntryPoint(moduleName, fromPath) {
        let folder = fromPath;
        while (!this.fs.isRoot(folder)) {
            folder = this.fs.dirname(folder);
            if (folder.endsWith('node_modules')) {
                // Skip up if the folder already ends in node_modules
                folder = this.fs.dirname(folder);
            }
            const modulePath = this.fs.resolve(folder, 'node_modules', moduleName);
            if (this.isEntryPoint(modulePath)) {
                return new ResolvedExternalModule(modulePath);
            }
            else if (this.resolveAsRelativePath(modulePath, fromPath)) {
                return new ResolvedDeepImport(modulePath);
            }
        }
        return null;
    }
    /**
     * Can we consider the given path as an entry-point to a package?
     *
     * This is achieved by checking for the existence of `${modulePath}/package.json`.
     */
    isEntryPoint(modulePath) {
        return this.fs.exists(this.fs.join(modulePath, 'package.json'));
    }
    /**
     * Apply the `pathMappers` to the `moduleName` and return all the possible
     * paths that match.
     *
     * The mapped path is computed for each template in `mapping.templates` by
     * replacing the `matcher.prefix` and `matcher.postfix` strings in `path with the
     * `template.prefix` and `template.postfix` strings.
     */
    findMappedPaths(moduleName) {
        const matches = this.pathMappings.map(mapping => this.matchMapping(moduleName, mapping));
        let bestMapping;
        let bestMatch;
        for (let index = 0; index < this.pathMappings.length; index++) {
            const mapping = this.pathMappings[index];
            const match = matches[index];
            if (match !== null) {
                // If this mapping had no wildcard then this must be a complete match.
                if (!mapping.matcher.hasWildcard) {
                    bestMatch = match;
                    bestMapping = mapping;
                    break;
                }
                // The best matched mapping is the one with the longest prefix.
                if (!bestMapping || mapping.matcher.prefix > bestMapping.matcher.prefix) {
                    bestMatch = match;
                    bestMapping = mapping;
                }
            }
        }
        return (bestMapping !== undefined && bestMatch !== undefined) ?
            this.computeMappedTemplates(bestMapping, bestMatch) :
            [];
    }
    /**
     * Attempt to find a mapped path for the given `path` and a `mapping`.
     *
     * The `path` matches the `mapping` if if it starts with `matcher.prefix` and ends with
     * `matcher.postfix`.
     *
     * @returns the wildcard segment of a matched `path`, or `null` if no match.
     */
    matchMapping(path, mapping) {
        const { prefix, postfix, hasWildcard } = mapping.matcher;
        if (hasWildcard) {
            return (path.startsWith(prefix) && path.endsWith(postfix)) ?
                path.substring(prefix.length, path.length - postfix.length) :
                null;
        }
        else {
            return (path === prefix) ? '' : null;
        }
    }
    /**
     * Compute the candidate paths from the given mapping's templates using the matched
     * string.
     */
    computeMappedTemplates(mapping, match) {
        return mapping.templates.map(template => this.fs.resolve(mapping.baseUrl, template.prefix + match + template.postfix));
    }
    /**
     * Search up the folder tree for the first folder that contains `package.json`
     * or `null` if none is found.
     */
    findPackagePath(path) {
        let folder = path;
        while (!this.fs.isRoot(folder)) {
            folder = this.fs.dirname(folder);
            if (this.fs.exists(this.fs.join(folder, 'package.json'))) {
                return folder;
            }
        }
        return null;
    }
}
/**
 * A module that is external to the package doing the importing.
 * In this case we capture the folder containing the entry-point.
 */
export class ResolvedExternalModule {
    constructor(entryPointPath) {
        this.entryPointPath = entryPointPath;
    }
}
/**
 * A module that is relative to the module doing the importing, and so internal to the
 * source module's package.
 */
export class ResolvedRelativeModule {
    constructor(modulePath) {
        this.modulePath = modulePath;
    }
}
/**
 * A module that is external to the package doing the importing but pointing to a
 * module that is deep inside a package, rather than to an entry-point of the package.
 */
export class ResolvedDeepImport {
    constructor(importPath) {
        this.importPath = importPath;
    }
}
function splitOnStar(str) {
    const [prefix, postfix] = str.split('*', 2);
    return { prefix, postfix: postfix || '', hasWildcard: postfix !== undefined };
}
function isRelativeImport(from, to) {
    return to.startsWith(from) && !to.includes('node_modules');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlX3Jlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2RlcGVuZGVuY2llcy9tb2R1bGVfcmVzb2x2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFDLGNBQWMsRUFBRSx3QkFBd0IsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUVsRTs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxNQUFNLE9BQU8sY0FBYztJQUd6QixZQUNZLEVBQXNCLEVBQUUsWUFBMkIsRUFDbEQscUJBQXFCLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxXQUFXLENBQUM7UUFEOUMsT0FBRSxHQUFGLEVBQUUsQ0FBb0I7UUFDckIsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUEyQjtRQUN4RCxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDakYsQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNILG1CQUFtQixDQUFDLFVBQWtCLEVBQUUsUUFBd0I7UUFDOUQsSUFBSSxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDOUIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ3pEO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDO2dCQUMvRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ3BEO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssbUJBQW1CLENBQUMsWUFBMEI7UUFDcEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEVB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b0IsRUFBRSxFQUFrQjtJQUNoRSxPQUFPLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzdELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7QWJzb2x1dGVGc1BhdGgsIFJlYWRvbmx5RmlsZVN5c3RlbX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7UGF0aE1hcHBpbmdzfSBmcm9tICcuLi9wYXRoX21hcHBpbmdzJztcbmltcG9ydCB7aXNSZWxhdGl2ZVBhdGgsIHJlc29sdmVGaWxlV2l0aFBvc3RmaXhlc30gZnJvbSAnLi4vdXRpbHMnO1xuXG4vKipcbiAqIFRoaXMgaXMgYSB2ZXJ5IGN1dC1kb3duIGltcGxlbWVudGF0aW9uIG9mIHRoZSBUeXBlU2NyaXB0IG1vZHVsZSByZXNvbHV0aW9uIHN0cmF0ZWd5LlxuICpcbiAqIEl0IGlzIHNwZWNpZmljIHRvIHRoZSBuZWVkcyBvZiBuZ2NjIGFuZCBpcyBub3QgaW50ZW5kZWQgdG8gYmUgYSBkcm9wLWluIHJlcGxhY2VtZW50XG4gKiBmb3IgdGhlIFRTIG1vZHVsZSByZXNvbHZlci4gSXQgaXMgdXNlZCB0byBjb21wdXRlIHRoZSBkZXBlbmRlbmNpZXMgYmV0d2VlbiBlbnRyeS1wb2ludHNcbiAqIHRoYXQgbWF5IGJlIGNvbXBpbGVkIGJ5IG5nY2MuXG4gKlxuICogVGhlIGFsZ29yaXRobSBvbmx5IGZpbmRzIGAuanNgIGZpbGVzIGZvciBpbnRlcm5hbC9yZWxhdGl2ZSBpbXBvcnRzIGFuZCBwYXRocyB0b1xuICogdGhlIGZvbGRlciBjb250YWluaW5nIHRoZSBgcGFja2FnZS5qc29uYCBvZiB0aGUgZW50cnktcG9pbnQgZm9yIGV4dGVybmFsIGltcG9ydHMuXG4gKlxuICogSXQgY2FuIGNvcGUgd2l0aCBuZXN0ZWQgYG5vZGVfbW9kdWxlc2AgZm9sZGVycyBhbmQgYWxzbyBzdXBwb3J0cyBgcGF0aHNgL2BiYXNlVXJsYFxuICogY29uZmlndXJhdGlvbiBwcm9wZXJ0aWVzLCBhcyBwcm92aWRlZCBpbiBhIGB0cy5Db21waWxlck9wdGlvbnNgIG9iamVjdC5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vZHVsZVJlc29sdmVyIHtcbiAgcHJpdmF0ZSBwYXRoTWFwcGluZ3M6IFByb2Nlc3NlZFBhdGhNYXBwaW5nW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0sIHBhdGhNYXBwaW5ncz86IFBhdGhNYXBwaW5ncyxcbiAgICAgIHJlYWRvbmx5IHJlbGF0aXZlRXh0ZW5zaW9ucyA9IFsnJywgJy5qcycsICcvaW5kZXguanMnXSkge1xuICAgIHRoaXMucGF0aE1hcHBpbmdzID0gcGF0aE1hcHBpbmdzID8gdGhpcy5wcm9jZXNzUGF0aE1hcHBpbmdzKHBhdGhNYXBwaW5ncykgOiBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlIGFuIGFic29sdXRlIHBhdGggZm9yIHRoZSBgbW9kdWxlTmFtZWAgaW1wb3J0ZWQgaW50byBhIGZpbGUgYXQgYGZyb21QYXRoYC5cbiAgICogQHBhcmFtIG1vZHVsZU5hbWUgVGhlIG5hbWUgb2YgdGhlIGltcG9ydCB0byByZXNvbHZlLlxuICAgKiBAcGFyYW0gZnJvbVBhdGggVGhlIHBhdGggdG8gdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW1wb3J0LlxuICAgKiBAcmV0dXJucyBBIHBhdGggdG8gdGhlIHJlc29sdmVkIG1vZHVsZSBvciBudWxsIGlmIG1pc3NpbmcuXG4gICAqIFNwZWNpZmljYWxseTpcbiAgICogICogdGhlIGFic29sdXRlIHBhdGggdG8gdGhlIHBhY2thZ2UuanNvbiBvZiBhbiBleHRlcm5hbCBtb2R1bGVcbiAgICogICogYSBKYXZhU2NyaXB0IGZpbGUgb2YgYW4gaW50ZXJuYWwgbW9kdWxlXG4gICAqICAqIG51bGwgaWYgbm9uZSBleGlzdHMuXG4gICAqL1xuICByZXNvbHZlTW9kdWxlSW1wb3J0KG1vZHVsZU5hbWU6IHN0cmluZywgZnJvbVBhdGg6IEFic29sdXRlRnNQYXRoKTogUmVzb2x2ZWRNb2R1bGV8bnVsbCB7XG4gICAgaWYgKGlzUmVsYXRpdmVQYXRoKG1vZHVsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlQXNSZWxhdGl2ZVBhdGgobW9kdWxlTmFtZSwgZnJvbVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXRoTWFwcGluZ3MubGVuZ3RoICYmIHRoaXMucmVzb2x2ZUJ5UGF0aE1hcHBpbmdzKG1vZHVsZU5hbWUsIGZyb21QYXRoKSB8fFxuICAgICAgICAgIHRoaXMucmVzb2x2ZUFzRW50cnlQb2ludChtb2R1bGVOYW1lLCBmcm9tUGF0aCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgdGhlIGBwYXRoTWFwcGluZ3NgIGludG8gYSBjb2xsZWN0aW9uIG9mIGBQYXRoTWFwcGVyYCBmdW5jdGlvbnMuXG4gICAqL1xuICBwcml2YXRlIHByb2Nlc3NQYXRoTWFwcGluZ3MocGF0aE1hcHBpbmdzOiBQYXRoTWFwcGluZ3MpOiBQcm9jZXNzZWRQYXRoTWFwcGluZ1tdIHtcbiAgICBjb25zdCBiYXNlVXJsID0gdGhpcy5mcy5yZXNvbHZlKHBhdGhNYXBwaW5ncy5iYXNlVXJsKTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocGF0aE1hcHBpbmdzLnBhdGhzKS5tYXAocGF0aFBhdHRlcm4gPT4ge1xuICAgICAgY29uc3QgbWF0Y2hlciA9IHNwbGl0T25TdGFyKHBhdGhQYXR0ZXJuKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlcyA9IHBhdGhNYXBwaW5ncy5wYXRoc1twYXRoUGF0dGVybl0ubWFwKHNwbGl0T25TdGFyKTtcbiAgICAgIHJldHVybiB7bWF0Y2hlciwgdGVtcGxhdGVzLCBiYXNlVXJsfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcnkgdG8gcmVzb2x2ZSBhIG1vZHVsZSBuYW1lLCBhcyBhIHJlbGF0aXZlIHBhdGgsIGZyb20gdGhlIGBmcm9tUGF0aGAuXG4gICAqXG4gICAqIEFzIGl0IGlzIHJlbGF0aXZlLCBpdCBvbmx5IGxvb2tzIGZvciBmaWxlcyB0aGF0IGVuZCBpbiBvbmUgb2YgdGhlIGByZWxhdGl2ZUV4dGVuc2lvbnNgLlxuICAgKiBGb3IgZXhhbXBsZTogYCR7bW9kdWxlTmFtZX0uanNgIG9yIGAke21vZHVsZU5hbWV9L2luZGV4LmpzYC5cbiAgICogSWYgbmVpdGhlciBvZiB0aGVzZSBmaWxlcyBleGlzdCB0aGVuIHRoZSBtZXRob2QgcmV0dXJucyBgbnVsbGAuXG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVBc1JlbGF0aXZlUGF0aChtb2R1bGVOYW1lOiBzdHJpbmcsIGZyb21QYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IFJlc29sdmVkTW9kdWxlfG51bGwge1xuICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHJlc29sdmVGaWxlV2l0aFBvc3RmaXhlcyhcbiAgICAgICAgdGhpcy5mcywgdGhpcy5mcy5yZXNvbHZlKHRoaXMuZnMuZGlybmFtZShmcm9tUGF0aCksIG1vZHVsZU5hbWUpLCB0aGlzLnJlbGF0aXZlRXh0ZW5zaW9ucyk7XG4gICAgcmV0dXJuIHJlc29sdmVkUGF0aCAmJiBuZXcgUmVzb2x2ZWRSZWxhdGl2ZU1vZHVsZShyZXNvbHZlZFBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyeSB0byByZXNvbHZlIHRoZSBgbW9kdWxlTmFtZWAsIGJ5IGFwcGx5aW5nIHRoZSBjb21wdXRlZCBgcGF0aE1hcHBpbmdzYCBhbmRcbiAgICogdGhlbiB0cnlpbmcgdG8gcmVzb2x2ZSB0aGUgbWFwcGVkIHBhdGggYXMgYSByZWxhdGl2ZSBvciBleHRlcm5hbCBpbXBvcnQuXG4gICAqXG4gICAqIFdoZXRoZXIgdGhlIG1hcHBlZCBwYXRoIGlzIHJlbGF0aXZlIGlzIGRlZmluZWQgYXMgaXQgYmVpbmcgXCJiZWxvdyB0aGUgYGZyb21QYXRoYFwiIGFuZCBub3RcbiAgICogY29udGFpbmluZyBgbm9kZV9tb2R1bGVzYC5cbiAgICpcbiAgICogSWYgdGhlIG1hcHBlZCBwYXRoIGlzIG5vdCByZWxhdGl2ZSBidXQgZG9lcyBub3QgcmVzb2x2ZSB0byBhbiBleHRlcm5hbCBlbnRyeS1wb2ludCwgdGhlbiB3ZVxuICAgKiBjaGVjayB3aGV0aGVyIGl0IHdvdWxkIGhhdmUgcmVzb2x2ZWQgdG8gYSByZWxhdGl2ZSBwYXRoLCBpbiB3aGljaCBjYXNlIGl0IGlzIG1hcmtlZCBhcyBhXG4gICAqIFwiZGVlcC1pbXBvcnRcIi5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUJ5UGF0aE1hcHBpbmdzKG1vZHVsZU5hbWU6IHN0cmluZywgZnJvbVBhdGg6IEFic29sdXRlRnNQYXRoKTogUmVzb2x2ZWRNb2R1bGV8bnVsbCB7XG4gICAgY29uc3QgbWFwcGVkUGF0aHMgPSB0aGlzLmZpbmRNYXBwZWRQYXRocyhtb2R1bGVOYW1lKTtcbiAgICBpZiAobWFwcGVkUGF0aHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcGFja2FnZVBhdGggPSB0aGlzLmZpbmRQYWNrYWdlUGF0aChmcm9tUGF0aCk7XG4gICAgICBpZiAocGFja2FnZVBhdGggIT09IG51bGwpIHtcbiAgICAgICAgZm9yIChjb25zdCBtYXBwZWRQYXRoIG9mIG1hcHBlZFBhdGhzKSB7XG4gICAgICAgICAgaWYgKHRoaXMuaXNFbnRyeVBvaW50KG1hcHBlZFBhdGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlc29sdmVkRXh0ZXJuYWxNb2R1bGUobWFwcGVkUGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5vbkVudHJ5UG9pbnRJbXBvcnQgPSB0aGlzLnJlc29sdmVBc1JlbGF0aXZlUGF0aChtYXBwZWRQYXRoLCBmcm9tUGF0aCk7XG4gICAgICAgICAgaWYgKG5vbkVudHJ5UG9pbnRJbXBvcnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBpc1JlbGF0aXZlSW1wb3J0KHBhY2thZ2VQYXRoLCBtYXBwZWRQYXRoKSA/IG5vbkVudHJ5UG9pbnRJbXBvcnQgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFJlc29sdmVkRGVlcEltcG9ydChtYXBwZWRQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogVHJ5IHRvIHJlc29sdmUgdGhlIGBtb2R1bGVOYW1lYCBhcyBhbiBleHRlcm5hbCBlbnRyeS1wb2ludCBieSBzZWFyY2hpbmcgdGhlIGBub2RlX21vZHVsZXNgXG4gICAqIGZvbGRlcnMgdXAgdGhlIHRyZWUgZm9yIGEgbWF0Y2hpbmcgYC4uLi9ub2RlX21vZHVsZXMvJHttb2R1bGVOYW1lfWAuXG4gICAqXG4gICAqIElmIGEgZm9sZGVyIGlzIGZvdW5kIGJ1dCB0aGUgcGF0aCBkb2VzIG5vdCBjb250YWluIGEgYHBhY2thZ2UuanNvbmAgdGhlbiBpdCBpcyBtYXJrZWQgYXMgYVxuICAgKiBcImRlZXAtaW1wb3J0XCIuXG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVBc0VudHJ5UG9pbnQobW9kdWxlTmFtZTogc3RyaW5nLCBmcm9tUGF0aDogQWJzb2x1dGVGc1BhdGgpOiBSZXNvbHZlZE1vZHVsZXxudWxsIHtcbiAgICBsZXQgZm9sZGVyID0gZnJvbVBhdGg7XG4gICAgd2hpbGUgKCF0aGlzLmZzLmlzUm9vdChmb2xkZXIpKSB7XG4gICAgICBmb2xkZXIgPSB0aGlzLmZzLmRpcm5hbWUoZm9sZGVyKTtcbiAgICAgIGlmIChmb2xkZXIuZW5kc1dpdGgoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgIC8vIFNraXAgdXAgaWYgdGhlIGZvbGRlciBhbHJlYWR5IGVuZHMgaW4gbm9kZV9tb2R1bGVzXG4gICAgICAgIGZvbGRlciA9IHRoaXMuZnMuZGlybmFtZShmb2xkZXIpO1xuICAgICAgfVxuICAgICAgY29uc3QgbW9kdWxlUGF0aCA9IHRoaXMuZnMucmVzb2x2ZShmb2xkZXIsICdub2RlX21vZHVsZXMnLCBtb2R1bGVOYW1lKTtcbiAgICAgIGlmICh0aGlzLmlzRW50cnlQb2ludChtb2R1bGVQYXRoKSkge1xuICAgICAgICByZXR1cm4gbmV3IFJlc29sdmVkRXh0ZXJuYWxNb2R1bGUobW9kdWxlUGF0aCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMucmVzb2x2ZUFzUmVsYXRpdmVQYXRoKG1vZHVsZVBhdGgsIGZyb21QYXRoKSkge1xuICAgICAgICByZXR1cm4gbmV3IFJlc29sdmVkRGVlcEltcG9ydChtb2R1bGVQYXRoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDYW4gd2UgY29uc2lkZXIgdGhlIGdpdmVuIHBhdGggYXMgYW4gZW50cnktcG9pbnQgdG8gYSBwYWNrYWdlP1xuICAgKlxuICAgKiBUaGlzIGlzIGFjaGlldmVkIGJ5IGNoZWNraW5nIGZvciB0aGUgZXhpc3RlbmNlIG9mIGAke21vZHVsZVBhdGh9L3BhY2thZ2UuanNvbmAuXG4gICAqL1xuICBwcml2YXRlIGlzRW50cnlQb2ludChtb2R1bGVQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmZzLmV4aXN0cyh0aGlzLmZzLmpvaW4obW9kdWxlUGF0aCwgJ3BhY2thZ2UuanNvbicpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBseSB0aGUgYHBhdGhNYXBwZXJzYCB0byB0aGUgYG1vZHVsZU5hbWVgIGFuZCByZXR1cm4gYWxsIHRoZSBwb3NzaWJsZVxuICAgKiBwYXRocyB0aGF0IG1hdGNoLlxuICAgKlxuICAgKiBUaGUgbWFwcGVkIHBhdGggaXMgY29tcHV0ZWQgZm9yIGVhY2ggdGVtcGxhdGUgaW4gYG1hcHBpbmcudGVtcGxhdGVzYCBieVxuICAgKiByZXBsYWNpbmcgdGhlIGBtYXRjaGVyLnByZWZpeGAgYW5kIGBtYXRjaGVyLnBvc3RmaXhgIHN0cmluZ3MgaW4gYHBhdGggd2l0aCB0aGVcbiAgICogYHRlbXBsYXRlLnByZWZpeGAgYW5kIGB0ZW1wbGF0ZS5wb3N0Zml4YCBzdHJpbmdzLlxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kTWFwcGVkUGF0aHMobW9kdWxlTmFtZTogc3RyaW5nKTogQWJzb2x1dGVGc1BhdGhbXSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMucGF0aE1hcHBpbmdzLm1hcChtYXBwaW5nID0+IHRoaXMubWF0Y2hNYXBwaW5nKG1vZHVsZU5hbWUsIG1hcHBpbmcpKTtcblxuICAgIGxldCBiZXN0TWFwcGluZzogUHJvY2Vzc2VkUGF0aE1hcHBpbmd8dW5kZWZpbmVkO1xuICAgIGxldCBiZXN0TWF0Y2g6IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5wYXRoTWFwcGluZ3MubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBtYXBwaW5nID0gdGhpcy5wYXRoTWFwcGluZ3NbaW5kZXhdO1xuICAgICAgY29uc3QgbWF0Y2ggPSBtYXRjaGVzW2luZGV4XTtcbiAgICAgIGlmIChtYXRjaCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBJZiB0aGlzIG1hcHBpbmcgaGFkIG5vIHdpbGRjYXJkIHRoZW4gdGhpcyBtdXN0IGJlIGEgY29tcGxldGUgbWF0Y2guXG4gICAgICAgIGlmICghbWFwcGluZy5tYXRjaGVyLmhhc1dpbGRjYXJkKSB7XG4gICAgICAgICAgYmVzdE1hdGNoID0gbWF0Y2g7XG4gICAgICAgICAgYmVzdE1hcHBpbmcgPSBtYXBwaW5nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRoZSBiZXN0IG1hdGNoZWQgbWFwcGluZyBpcyB0aGUgb25lIHdpdGggdGhlIGxvbmdlc3QgcHJlZml4LlxuICAgICAgICBpZiAoIWJlc3RNYXBwaW5nIHx8IG1hcHBpbmcubWF0Y2hlci5wcmVmaXggPiBiZXN0TWFwcGluZy5tYXRjaGVyLnByZWZpeCkge1xuICAgICAgICAgIGJlc3RNYXRjaCA9IG1hdGNoO1xuICAgICAgICAgIGJlc3RNYXBwaW5nID0gbWFwcGluZztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAoYmVzdE1hcHBpbmcgIT09IHVuZGVmaW5lZCAmJiBiZXN0TWF0Y2ggIT09IHVuZGVmaW5lZCkgP1xuICAgICAgICB0aGlzLmNvbXB1dGVNYXBwZWRUZW1wbGF0ZXMoYmVzdE1hcHBpbmcsIGJlc3RNYXRjaCkgOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRlbXB0IHRvIGZpbmQgYSBtYXBwZWQgcGF0aCBmb3IgdGhlIGdpdmVuIGBwYXRoYCBhbmQgYSBgbWFwcGluZ2AuXG4gICAqXG4gICAqIFRoZSBgcGF0aGAgbWF0Y2hlcyB0aGUgYG1hcHBpbmdgIGlmIGlmIGl0IHN0YXJ0cyB3aXRoIGBtYXRjaGVyLnByZWZpeGAgYW5kIGVuZHMgd2l0aFxuICAgKiBgbWF0Y2hlci5wb3N0Zml4YC5cbiAgICpcbiAgICogQHJldHVybnMgdGhlIHdpbGRjYXJkIHNlZ21lbnQgb2YgYSBtYXRjaGVkIGBwYXRoYCwgb3IgYG51bGxgIGlmIG5vIG1hdGNoLlxuICAgKi9cbiAgcHJpdmF0ZSBtYXRjaE1hcHBpbmcocGF0aDogc3RyaW5nLCBtYXBwaW5nOiBQcm9jZXNzZWRQYXRoTWFwcGluZyk6IHN0cmluZ3xudWxsIHtcbiAgICBjb25zdCB7cHJlZml4LCBwb3N0Zml4LCBoYXNXaWxkY2FyZH0gPSBtYXBwaW5nLm1hdGNoZXI7XG4gICAgaWYgKGhhc1dpbGRjYXJkKSB7XG4gICAgICByZXR1cm4gKHBhdGguc3RhcnRzV2l0aChwcmVmaXgpICYmIHBhdGguZW5kc1dpdGgocG9zdGZpeCkpID9cbiAgICAgICAgICBwYXRoLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoLCBwYXRoLmxlbmd0aCAtIHBvc3RmaXgubGVuZ3RoKSA6XG4gICAgICAgICAgbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIChwYXRoID09PSBwcmVmaXgpID8gJycgOiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlIHRoZSBjYW5kaWRhdGUgcGF0aHMgZnJvbSB0aGUgZ2l2ZW4gbWFwcGluZydzIHRlbXBsYXRlcyB1c2luZyB0aGUgbWF0Y2hlZFxuICAgKiBzdHJpbmcuXG4gICAqL1xuICBwcml2YXRlIGNvbXB1dGVNYXBwZWRUZW1wbGF0ZXMobWFwcGluZzogUHJvY2Vzc2VkUGF0aE1hcHBpbmcsIG1hdGNoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbWFwcGluZy50ZW1wbGF0ZXMubWFwKFxuICAgICAgICB0ZW1wbGF0ZSA9PiB0aGlzLmZzLnJlc29sdmUobWFwcGluZy5iYXNlVXJsLCB0ZW1wbGF0ZS5wcmVmaXggKyBtYXRjaCArIHRlbXBsYXRlLnBvc3RmaXgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggdXAgdGhlIGZvbGRlciB0cmVlIGZvciB0aGUgZmlyc3QgZm9sZGVyIHRoYXQgY29udGFpbnMgYHBhY2thZ2UuanNvbmBcbiAgICogb3IgYG51bGxgIGlmIG5vbmUgaXMgZm91bmQuXG4gICAqL1xuICBwcml2YXRlIGZpbmRQYWNrYWdlUGF0aChwYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IEFic29sdXRlRnNQYXRofG51bGwge1xuICAgIGxldCBmb2xkZXIgPSBwYXRoO1xuICAgIHdoaWxlICghdGhpcy5mcy5pc1Jvb3QoZm9sZGVyKSkge1xuICAgICAgZm9sZGVyID0gdGhpcy5mcy5kaXJuYW1lKGZvbGRlcik7XG4gICAgICBpZiAodGhpcy5mcy5leGlzdHModGhpcy5mcy5qb2luKGZvbGRlciwgJ3BhY2thZ2UuanNvbicpKSkge1xuICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKiogVGhlIHJlc3VsdCBvZiByZXNvbHZpbmcgYW4gaW1wb3J0IHRvIGEgbW9kdWxlLiAqL1xuZXhwb3J0IHR5cGUgUmVzb2x2ZWRNb2R1bGUgPSBSZXNvbHZlZEV4dGVybmFsTW9kdWxlfFJlc29sdmVkUmVsYXRpdmVNb2R1bGV8UmVzb2x2ZWREZWVwSW1wb3J0O1xuXG4vKipcbiAqIEEgbW9kdWxlIHRoYXQgaXMgZXh0ZXJuYWwgdG8gdGhlIHBhY2thZ2UgZG9pbmcgdGhlIGltcG9ydGluZy5cbiAqIEluIHRoaXMgY2FzZSB3ZSBjYXB0dXJlIHRoZSBmb2xkZXIgY29udGFpbmluZyB0aGUgZW50cnktcG9pbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXNvbHZlZEV4dGVybmFsTW9kdWxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIGVudHJ5UG9pbnRQYXRoOiBBYnNvbHV0ZUZzUGF0aCkge31cbn1cblxuLyoqXG4gKiBBIG1vZHVsZSB0aGF0IGlzIHJlbGF0aXZlIHRvIHRoZSBtb2R1bGUgZG9pbmcgdGhlIGltcG9ydGluZywgYW5kIHNvIGludGVybmFsIHRvIHRoZVxuICogc291cmNlIG1vZHVsZSdzIHBhY2thZ2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXNvbHZlZFJlbGF0aXZlTW9kdWxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG1vZHVsZVBhdGg6IEFic29sdXRlRnNQYXRoKSB7fVxufVxuXG4vKipcbiAqIEEgbW9kdWxlIHRoYXQgaXMgZXh0ZXJuYWwgdG8gdGhlIHBhY2thZ2UgZG9pbmcgdGhlIGltcG9ydGluZyBidXQgcG9pbnRpbmcgdG8gYVxuICogbW9kdWxlIHRoYXQgaXMgZGVlcCBpbnNpZGUgYSBwYWNrYWdlLCByYXRoZXIgdGhhbiB0byBhbiBlbnRyeS1wb2ludCBvZiB0aGUgcGFja2FnZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc29sdmVkRGVlcEltcG9ydCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbXBvcnRQYXRoOiBBYnNvbHV0ZUZzUGF0aCkge31cbn1cblxuZnVuY3Rpb24gc3BsaXRPblN0YXIoc3RyOiBzdHJpbmcpOiBQYXRoTWFwcGluZ1BhdHRlcm4ge1xuICBjb25zdCBbcHJlZml4LCBwb3N0Zml4XSA9IHN0ci5zcGxpdCgnKicsIDIpO1xuICByZXR1cm4ge3ByZWZpeCwgcG9zdGZpeDogcG9zdGZpeCB8fCAnJywgaGFzV2lsZGNhcmQ6IHBvc3RmaXggIT09IHVuZGVmaW5lZH07XG59XG5cbmludGVyZmFjZSBQcm9jZXNzZWRQYXRoTWFwcGluZyB7XG4gIGJhc2VVcmw6IEFic29sdXRlRnNQYXRoO1xuICBtYXRjaGVyOiBQYXRoTWFwcGluZ1BhdHRlcm47XG4gIHRlbXBsYXRlczogUGF0aE1hcHBpbmdQYXR0ZXJuW107XG59XG5cbmludGVyZmFjZSBQYXRoTWFwcGluZ1BhdHRlcm4ge1xuICBwcmVmaXg6IHN0cmluZztcbiAgcG9zdGZpeDogc3RyaW5nO1xuICBoYXNXaWxkY2FyZDogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gaXNSZWxhdGl2ZUltcG9ydChmcm9tOiBBYnNvbHV0ZUZzUGF0aCwgdG86IEFic29sdXRlRnNQYXRoKSB7XG4gIHJldHVybiB0by5zdGFydHNXaXRoKGZyb20pICYmICF0by5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJyk7XG59XG4iXX0=