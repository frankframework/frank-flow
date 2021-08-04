/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
/**
 * A cache that holds on to source files that can be shared for processing all entry-points in a
 * single invocation of ngcc. In particular, the following files are shared across all entry-points
 * through this cache:
 *
 * 1. Default library files such as `lib.dom.d.ts` and `lib.es5.d.ts`. These files don't change
 *    and some are very large, so parsing is expensive. Therefore, the parsed `ts.SourceFile`s for
 *    the default library files are cached.
 * 2. The typings of @angular scoped packages. The typing files for @angular packages are typically
 *    used in the entry-points that ngcc processes, so benefit from a single source file cache.
 *    Especially `@angular/core/core.d.ts` is large and expensive to parse repeatedly. In contrast
 *    to default library files, we have to account for these files to be invalidated during a single
 *    invocation of ngcc, as ngcc will overwrite the .d.ts files during its processing.
 *
 * The lifecycle of this cache corresponds with a single invocation of ngcc. Separate invocations,
 * e.g. the CLI's synchronous module resolution fallback will therefore all have their own cache.
 * This allows for the source file cache to be garbage collected once ngcc processing has completed.
 */
export class SharedFileCache {
    constructor(fs) {
        this.fs = fs;
        this.sfCache = new Map();
    }
    /**
     * Loads a `ts.SourceFile` if the provided `fileName` is deemed appropriate to be cached. To
     * optimize for memory usage, only files that are generally used in all entry-points are cached.
     * If `fileName` is not considered to benefit from caching or the requested file does not exist,
     * then `undefined` is returned.
     */
    getCachedSourceFile(fileName) {
        const absPath = this.fs.resolve(fileName);
        if (isDefaultLibrary(absPath, this.fs)) {
            return this.getStableCachedFile(absPath);
        }
        else if (isAngularDts(absPath, this.fs)) {
            return this.getVolatileCachedFile(absPath);
        }
        else {
            return undefined;
        }
    }
    /**
     * Attempts to load the source file from the cache, or parses the file into a `ts.SourceFile` if
     * it's not yet cached. This method assumes that the file will not be modified for the duration
     * that this cache is valid for. If that assumption does not hold, the `getVolatileCachedFile`
     * method is to be used instead.
     */
    getStableCachedFile(absPath) {
        if (!this.sfCache.has(absPath)) {
            const content = readFile(absPath, this.fs);
            if (content === undefined) {
                return undefined;
            }
            const sf = ts.createSourceFile(absPath, content, ts.ScriptTarget.ES2015);
            this.sfCache.set(absPath, sf);
        }
        return this.sfCache.get(absPath);
    }
    /**
     * In contrast to `getStableCachedFile`, this method always verifies that the cached source file
     * is the same as what's stored on disk. This is done for files that are expected to change during
     * ngcc's processing, such as @angular scoped packages for which the .d.ts files are overwritten
     * by ngcc. If the contents on disk have changed compared to a previously cached source file, the
     * content from disk is re-parsed and the cache entry is replaced.
     */
    getVolatileCachedFile(absPath) {
        const content = readFile(absPath, this.fs);
        if (content === undefined) {
            return undefined;
        }
        if (!this.sfCache.has(absPath) || this.sfCache.get(absPath).text !== content) {
            const sf = ts.createSourceFile(absPath, content, ts.ScriptTarget.ES2015);
            this.sfCache.set(absPath, sf);
        }
        return this.sfCache.get(absPath);
    }
}
const DEFAULT_LIB_PATTERN = ['node_modules', 'typescript', 'lib', /^lib\..+\.d\.ts$/];
/**
 * Determines whether the provided path corresponds with a default library file inside of the
 * typescript package.
 *
 * @param absPath The path for which to determine if it corresponds with a default library file.
 * @param fs The filesystem to use for inspecting the path.
 */
export function isDefaultLibrary(absPath, fs) {
    return isFile(absPath, DEFAULT_LIB_PATTERN, fs);
}
const ANGULAR_DTS_PATTERN = ['node_modules', '@angular', /./, /\.d\.ts$/];
/**
 * Determines whether the provided path corresponds with a .d.ts file inside of an @angular
 * scoped package. This logic only accounts for the .d.ts files in the root, which is sufficient
 * to find the large, flattened entry-point files that benefit from caching.
 *
 * @param absPath The path for which to determine if it corresponds with an @angular .d.ts file.
 * @param fs The filesystem to use for inspecting the path.
 */
export function isAngularDts(absPath, fs) {
    return isFile(absPath, ANGULAR_DTS_PATTERN, fs);
}
/**
 * Helper function to determine whether a file corresponds with a given pattern of segments.
 *
 * @param path The path for which to determine if it corresponds with the provided segments.
 * @param segments Array of segments; the `path` must have ending segments that match the
 * patterns in this array.
 * @param fs The filesystem to use for inspecting the path.
 */
function isFile(path, segments, fs) {
    for (let i = segments.length - 1; i >= 0; i--) {
        const pattern = segments[i];
        const segment = fs.basename(path);
        if (typeof pattern === 'string') {
            if (pattern !== segment) {
                return false;
            }
        }
        else {
            if (!pattern.test(segment)) {
                return false;
            }
        }
        path = fs.dirname(path);
    }
    return true;
}
/**
 * A cache for processing a single entry-point. This exists to share `ts.SourceFile`s between the
 * source and typing programs that are created for a single program.
 */
export class EntryPointFileCache {
    constructor(fs, sharedFileCache) {
        this.fs = fs;
        this.sharedFileCache = sharedFileCache;
        this.sfCache = new Map();
    }
    /**
     * Returns and caches a parsed `ts.SourceFile` for the provided `fileName`. If the `fileName` is
     * cached in the shared file cache, that result is used. Otherwise, the source file is cached
     * internally. This method returns `undefined` if the requested file does not exist.
     *
     * @param fileName The path of the file to retrieve a source file for.
     * @param languageVersion The language version to use for parsing the file.
     */
    getCachedSourceFile(fileName, languageVersion) {
        const staticSf = this.sharedFileCache.getCachedSourceFile(fileName);
        if (staticSf !== undefined) {
            return staticSf;
        }
        const absPath = this.fs.resolve(fileName);
        if (this.sfCache.has(absPath)) {
            return this.sfCache.get(absPath);
        }
        const content = readFile(absPath, this.fs);
        if (content === undefined) {
            return undefined;
        }
        const sf = ts.createSourceFile(fileName, content, languageVersion);
        this.sfCache.set(absPath, sf);
        return sf;
    }
}
function readFile(absPath, fs) {
    if (!fs.exists(absPath) || !fs.stat(absPath).isFile()) {
        return undefined;
    }
    return fs.readFile(absPath);
}
/**
 * Creates a `ts.ModuleResolutionCache` that uses the provided filesystem for path operations.
 *
 * @param fs The filesystem to use for path operations.
 */
export function createModuleResolutionCache(fs) {
    return ts.createModuleResolutionCache(fs.pwd(), fileName => {
        return fs.isCaseSensitive() ? fileName : fileName.toLowerCase();
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlX2ZpbGVfY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvcGFja2FnZXMvc291cmNlX2ZpbGVfY2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFHakM7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0gsTUFBTSxPQUFPLGVBQWU7SUFHMUIsWUFBb0IsRUFBc0I7UUFBdEIsT0FBRSxHQUFGLEVBQUUsQ0FBb0I7UUFGbEMsWUFBTyxHQUFHLElBQUksR0FBRyxFQUFpQyxDQUFDO0lBRWQsQ0FBQztJQUU5Qzs7Ozs7T0FLRztJQUNILG1CQUFtQixDQUFDLFFBQWdCO1FBQ2xDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFDLElBQUksZ0JBQWdCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUN0QyxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUMxQzthQUFNLElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDekMsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDNUM7YUFBTTtZQUNMLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ssbUJBQW1CLENBQUMsT0FBdUI7UUFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzlCLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFD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RUFBRSxFQUFFO1FBQ3JELE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0lBQ0QsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzlCLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUFDLEVBQXNCO0lBQ2hFLE9BQU8sRUFBRSxDQUFDLDJCQUEyQixDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUN6RCxPQUFPLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDbEUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7QWJzb2x1dGVGc1BhdGgsIFJlYWRvbmx5RmlsZVN5c3RlbX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcblxuLyoqXG4gKiBBIGNhY2hlIHRoYXQgaG9sZHMgb24gdG8gc291cmNlIGZpbGVzIHRoYXQgY2FuIGJlIHNoYXJlZCBmb3IgcHJvY2Vzc2luZyBhbGwgZW50cnktcG9pbnRzIGluIGFcbiAqIHNpbmdsZSBpbnZvY2F0aW9uIG9mIG5nY2MuIEluIHBhcnRpY3VsYXIsIHRoZSBmb2xsb3dpbmcgZmlsZXMgYXJlIHNoYXJlZCBhY3Jvc3MgYWxsIGVudHJ5LXBvaW50c1xuICogdGhyb3VnaCB0aGlzIGNhY2hlOlxuICpcbiAqIDEuIERlZmF1bHQgbGlicmFyeSBmaWxlcyBzdWNoIGFzIGBsaWIuZG9tLmQudHNgIGFuZCBgbGliLmVzNS5kLnRzYC4gVGhlc2UgZmlsZXMgZG9uJ3QgY2hhbmdlXG4gKiAgICBhbmQgc29tZSBhcmUgdmVyeSBsYXJnZSwgc28gcGFyc2luZyBpcyBleHBlbnNpdmUuIFRoZXJlZm9yZSwgdGhlIHBhcnNlZCBgdHMuU291cmNlRmlsZWBzIGZvclxuICogICAgdGhlIGRlZmF1bHQgbGlicmFyeSBmaWxlcyBhcmUgY2FjaGVkLlxuICogMi4gVGhlIHR5cGluZ3Mgb2YgQGFuZ3VsYXIgc2NvcGVkIHBhY2thZ2VzLiBUaGUgdHlwaW5nIGZpbGVzIGZvciBAYW5ndWxhciBwYWNrYWdlcyBhcmUgdHlwaWNhbGx5XG4gKiAgICB1c2VkIGluIHRoZSBlbnRyeS1wb2ludHMgdGhhdCBuZ2NjIHByb2Nlc3Nlcywgc28gYmVuZWZpdCBmcm9tIGEgc2luZ2xlIHNvdXJjZSBmaWxlIGNhY2hlLlxuICogICAgRXNwZWNpYWxseSBgQGFuZ3VsYXIvY29yZS9jb3JlLmQudHNgIGlzIGxhcmdlIGFuZCBleHBlbnNpdmUgdG8gcGFyc2UgcmVwZWF0ZWRseS4gSW4gY29udHJhc3RcbiAqICAgIHRvIGRlZmF1bHQgbGlicmFyeSBmaWxlcywgd2UgaGF2ZSB0byBhY2NvdW50IGZvciB0aGVzZSBmaWxlcyB0byBiZSBpbnZhbGlkYXRlZCBkdXJpbmcgYSBzaW5nbGVcbiAqICAgIGludm9jYXRpb24gb2YgbmdjYywgYXMgbmdjYyB3aWxsIG92ZXJ3cml0ZSB0aGUgLmQudHMgZmlsZXMgZHVyaW5nIGl0cyBwcm9jZXNzaW5nLlxuICpcbiAqIFRoZSBsaWZlY3ljbGUgb2YgdGhpcyBjYWNoZSBjb3JyZXNwb25kcyB3aXRoIGEgc2luZ2xlIGludm9jYXRpb24gb2YgbmdjYy4gU2VwYXJhdGUgaW52b2NhdGlvbnMsXG4gKiBlLmcuIHRoZSBDTEkncyBzeW5jaHJvbm91cyBtb2R1bGUgcmVzb2x1dGlvbiBmYWxsYmFjayB3aWxsIHRoZXJlZm9yZSBhbGwgaGF2ZSB0aGVpciBvd24gY2FjaGUuXG4gKiBUaGlzIGFsbG93cyBmb3IgdGhlIHNvdXJjZSBmaWxlIGNhY2hlIHRvIGJlIGdhcmJhZ2UgY29sbGVjdGVkIG9uY2UgbmdjYyBwcm9jZXNzaW5nIGhhcyBjb21wbGV0ZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBTaGFyZWRGaWxlQ2FjaGUge1xuICBwcml2YXRlIHNmQ2FjaGUgPSBuZXcgTWFwPEFic29sdXRlRnNQYXRoLCB0cy5Tb3VyY2VGaWxlPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZnM6IFJlYWRvbmx5RmlsZVN5c3RlbSkge31cblxuICAvKipcbiAgICogTG9hZHMgYSBgdHMuU291cmNlRmlsZWAgaWYgdGhlIHByb3ZpZGVkIGBmaWxlTmFtZWAgaXMgZGVlbWVkIGFwcHJvcHJpYXRlIHRvIGJlIGNhY2hlZC4gVG9cbiAgICogb3B0aW1pemUgZm9yIG1lbW9yeSB1c2FnZSwgb25seSBmaWxlcyB0aGF0IGFyZSBnZW5lcmFsbHkgdXNlZCBpbiBhbGwgZW50cnktcG9pbnRzIGFyZSBjYWNoZWQuXG4gICAqIElmIGBmaWxlTmFtZWAgaXMgbm90IGNvbnNpZGVyZWQgdG8gYmVuZWZpdCBmcm9tIGNhY2hpbmcgb3IgdGhlIHJlcXVlc3RlZCBmaWxlIGRvZXMgbm90IGV4aXN0LFxuICAgKiB0aGVuIGB1bmRlZmluZWRgIGlzIHJldHVybmVkLlxuICAgKi9cbiAgZ2V0Q2FjaGVkU291cmNlRmlsZShmaWxlTmFtZTogc3RyaW5nKTogdHMuU291cmNlRmlsZXx1bmRlZmluZWQge1xuICAgIGNvbnN0IGFic1BhdGggPSB0aGlzLmZzLnJlc29sdmUoZmlsZU5hbWUpO1xuICAgIGlmIChpc0RlZmF1bHRMaWJyYXJ5KGFic1BhdGgsIHRoaXMuZnMpKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRTdGFibGVDYWNoZWRGaWxlKGFic1BhdGgpO1xuICAgIH0gZWxzZSBpZiAoaXNBbmd1bGFyRHRzKGFic1BhdGgsIHRoaXMuZnMpKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRWb2xhdGlsZUNhY2hlZEZpbGUoYWJzUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGxvYWQgdGhlIHNvdXJjZSBmaWxlIGZyb20gdGhlIGNhY2hlLCBvciBwYXJzZXMgdGhlIGZpbGUgaW50byBhIGB0cy5Tb3VyY2VGaWxlYCBpZlxuICAgKiBpdCdzIG5vdCB5ZXQgY2FjaGVkLiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoYXQgdGhlIGZpbGUgd2lsbCBub3QgYmUgbW9kaWZpZWQgZm9yIHRoZSBkdXJhdGlvblxuICAgKiB0aGF0IHRoaXMgY2FjaGUgaXMgdmFsaWQgZm9yLiBJZiB0aGF0IGFzc3VtcHRpb24gZG9lcyBub3QgaG9sZCwgdGhlIGBnZXRWb2xhdGlsZUNhY2hlZEZpbGVgXG4gICAqIG1ldGhvZCBpcyB0byBiZSB1c2VkIGluc3RlYWQuXG4gICAqL1xuICBwcml2YXRlIGdldFN0YWJsZUNhY2hlZEZpbGUoYWJzUGF0aDogQWJzb2x1dGVGc1BhdGgpOiB0cy5Tb3VyY2VGaWxlfHVuZGVmaW5lZCB7XG4gICAgaWYgKCF0aGlzLnNmQ2FjaGUuaGFzKGFic1BhdGgpKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gcmVhZEZpbGUoYWJzUGF0aCwgdGhpcy5mcyk7XG4gICAgICBpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBjb25zdCBzZiA9IHRzLmNyZWF0ZVNvdXJjZUZpbGUoYWJzUGF0aCwgY29udGVudCwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNSk7XG4gICAgICB0aGlzLnNmQ2FjaGUuc2V0KGFic1BhdGgsIHNmKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2ZDYWNoZS5nZXQoYWJzUGF0aCkhO1xuICB9XG5cbiAgLyoqXG4gICAqIEluIGNvbnRyYXN0IHRvIGBnZXRTdGFibGVDYWNoZWRGaWxlYCwgdGhpcyBtZXRob2QgYWx3YXlzIHZlcmlmaWVzIHRoYXQgdGhlIGNhY2hlZCBzb3VyY2UgZmlsZVxuICAgKiBpcyB0aGUgc2FtZSBhcyB3aGF0J3Mgc3RvcmVkIG9uIGRpc2suIFRoaXMgaXMgZG9uZSBmb3IgZmlsZXMgdGhhdCBhcmUgZXhwZWN0ZWQgdG8gY2hhbmdlIGR1cmluZ1xuICAgKiBuZ2NjJ3MgcHJvY2Vzc2luZywgc3VjaCBhcyBAYW5ndWxhciBzY29wZWQgcGFja2FnZXMgZm9yIHdoaWNoIHRoZSAuZC50cyBmaWxlcyBhcmUgb3ZlcndyaXR0ZW5cbiAgICogYnkgbmdjYy4gSWYgdGhlIGNvbnRlbnRzIG9uIGRpc2sgaGF2ZSBjaGFuZ2VkIGNvbXBhcmVkIHRvIGEgcHJldmlvdXNseSBjYWNoZWQgc291cmNlIGZpbGUsIHRoZVxuICAgKiBjb250ZW50IGZyb20gZGlzayBpcyByZS1wYXJzZWQgYW5kIHRoZSBjYWNoZSBlbnRyeSBpcyByZXBsYWNlZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0Vm9sYXRpbGVDYWNoZWRGaWxlKGFic1BhdGg6IEFic29sdXRlRnNQYXRoKTogdHMuU291cmNlRmlsZXx1bmRlZmluZWQge1xuICAgIGNvbnN0IGNvbnRlbnQgPSByZWFkRmlsZShhYnNQYXRoLCB0aGlzLmZzKTtcbiAgICBpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuc2ZDYWNoZS5oYXMoYWJzUGF0aCkgfHwgdGhpcy5zZkNhY2hlLmdldChhYnNQYXRoKSEudGV4dCAhPT0gY29udGVudCkge1xuICAgICAgY29uc3Qgc2YgPSB0cy5jcmVhdGVTb3VyY2VGaWxlKGFic1BhdGgsIGNvbnRlbnQsIHRzLlNjcmlwdFRhcmdldC5FUzIwMTUpO1xuICAgICAgdGhpcy5zZkNhY2hlLnNldChhYnNQYXRoLCBzZik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNmQ2FjaGUuZ2V0KGFic1BhdGgpITtcbiAgfVxufVxuXG5jb25zdCBERUZBVUxUX0xJQl9QQVRURVJOID0gWydub2RlX21vZHVsZXMnLCAndHlwZXNjcmlwdCcsICdsaWInLCAvXmxpYlxcLi4rXFwuZFxcLnRzJC9dO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgcHJvdmlkZWQgcGF0aCBjb3JyZXNwb25kcyB3aXRoIGEgZGVmYXVsdCBsaWJyYXJ5IGZpbGUgaW5zaWRlIG9mIHRoZVxuICogdHlwZXNjcmlwdCBwYWNrYWdlLlxuICpcbiAqIEBwYXJhbSBhYnNQYXRoIFRoZSBwYXRoIGZvciB3aGljaCB0byBkZXRlcm1pbmUgaWYgaXQgY29ycmVzcG9uZHMgd2l0aCBhIGRlZmF1bHQgbGlicmFyeSBmaWxlLlxuICogQHBhcmFtIGZzIFRoZSBmaWxlc3lzdGVtIHRvIHVzZSBmb3IgaW5zcGVjdGluZyB0aGUgcGF0aC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRGVmYXVsdExpYnJhcnkoYWJzUGF0aDogQWJzb2x1dGVGc1BhdGgsIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0pOiBib29sZWFuIHtcbiAgcmV0dXJuIGlzRmlsZShhYnNQYXRoLCBERUZBVUxUX0xJQl9QQVRURVJOLCBmcyk7XG59XG5cbmNvbnN0IEFOR1VMQVJfRFRTX1BBVFRFUk4gPSBbJ25vZGVfbW9kdWxlcycsICdAYW5ndWxhcicsIC8uLywgL1xcLmRcXC50cyQvXTtcblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHBhdGggY29ycmVzcG9uZHMgd2l0aCBhIC5kLnRzIGZpbGUgaW5zaWRlIG9mIGFuIEBhbmd1bGFyXG4gKiBzY29wZWQgcGFja2FnZS4gVGhpcyBsb2dpYyBvbmx5IGFjY291bnRzIGZvciB0aGUgLmQudHMgZmlsZXMgaW4gdGhlIHJvb3QsIHdoaWNoIGlzIHN1ZmZpY2llbnRcbiAqIHRvIGZpbmQgdGhlIGxhcmdlLCBmbGF0dGVuZWQgZW50cnktcG9pbnQgZmlsZXMgdGhhdCBiZW5lZml0IGZyb20gY2FjaGluZy5cbiAqXG4gKiBAcGFyYW0gYWJzUGF0aCBUaGUgcGF0aCBmb3Igd2hpY2ggdG8gZGV0ZXJtaW5lIGlmIGl0IGNvcnJlc3BvbmRzIHdpdGggYW4gQGFuZ3VsYXIgLmQudHMgZmlsZS5cbiAqIEBwYXJhbSBmcyBUaGUgZmlsZXN5c3RlbSB0byB1c2UgZm9yIGluc3BlY3RpbmcgdGhlIHBhdGguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FuZ3VsYXJEdHMoYWJzUGF0aDogQWJzb2x1dGVGc1BhdGgsIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0pOiBib29sZWFuIHtcbiAgcmV0dXJuIGlzRmlsZShhYnNQYXRoLCBBTkdVTEFSX0RUU19QQVRURVJOLCBmcyk7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGRldGVybWluZSB3aGV0aGVyIGEgZmlsZSBjb3JyZXNwb25kcyB3aXRoIGEgZ2l2ZW4gcGF0dGVybiBvZiBzZWdtZW50cy5cbiAqXG4gKiBAcGFyYW0gcGF0aCBUaGUgcGF0aCBmb3Igd2hpY2ggdG8gZGV0ZXJtaW5lIGlmIGl0IGNvcnJlc3BvbmRzIHdpdGggdGhlIHByb3ZpZGVkIHNlZ21lbnRzLlxuICogQHBhcmFtIHNlZ21lbnRzIEFycmF5IG9mIHNlZ21lbnRzOyB0aGUgYHBhdGhgIG11c3QgaGF2ZSBlbmRpbmcgc2VnbWVudHMgdGhhdCBtYXRjaCB0aGVcbiAqIHBhdHRlcm5zIGluIHRoaXMgYXJyYXkuXG4gKiBAcGFyYW0gZnMgVGhlIGZpbGVzeXN0ZW0gdG8gdXNlIGZvciBpbnNwZWN0aW5nIHRoZSBwYXRoLlxuICovXG5mdW5jdGlvbiBpc0ZpbGUoXG4gICAgcGF0aDogQWJzb2x1dGVGc1BhdGgsIHNlZ21lbnRzOiBSZWFkb25seUFycmF5PHN0cmluZ3xSZWdFeHA+LCBmczogUmVhZG9ubHlGaWxlU3lzdGVtKTogYm9vbGVhbiB7XG4gIGZvciAobGV0IGkgPSBzZWdtZW50cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IHBhdHRlcm4gPSBzZWdtZW50c1tpXTtcbiAgICBjb25zdCBzZWdtZW50ID0gZnMuYmFzZW5hbWUocGF0aCk7XG4gICAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnc3RyaW5nJykge1xuICAgICAgaWYgKHBhdHRlcm4gIT09IHNlZ21lbnQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXBhdHRlcm4udGVzdChzZWdtZW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHBhdGggPSBmcy5kaXJuYW1lKHBhdGgpO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIEEgY2FjaGUgZm9yIHByb2Nlc3NpbmcgYSBzaW5nbGUgZW50cnktcG9pbnQuIFRoaXMgZXhpc3RzIHRvIHNoYXJlIGB0cy5Tb3VyY2VGaWxlYHMgYmV0d2VlbiB0aGVcbiAqIHNvdXJjZSBhbmQgdHlwaW5nIHByb2dyYW1zIHRoYXQgYXJlIGNyZWF0ZWQgZm9yIGEgc2luZ2xlIHByb2dyYW0uXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRyeVBvaW50RmlsZUNhY2hlIHtcbiAgcHJpdmF0ZSByZWFkb25seSBzZkNhY2hlID0gbmV3IE1hcDxBYnNvbHV0ZUZzUGF0aCwgdHMuU291cmNlRmlsZT4oKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0sIHByaXZhdGUgc2hhcmVkRmlsZUNhY2hlOiBTaGFyZWRGaWxlQ2FjaGUpIHt9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW5kIGNhY2hlcyBhIHBhcnNlZCBgdHMuU291cmNlRmlsZWAgZm9yIHRoZSBwcm92aWRlZCBgZmlsZU5hbWVgLiBJZiB0aGUgYGZpbGVOYW1lYCBpc1xuICAgKiBjYWNoZWQgaW4gdGhlIHNoYXJlZCBmaWxlIGNhY2hlLCB0aGF0IHJlc3VsdCBpcyB1c2VkLiBPdGhlcndpc2UsIHRoZSBzb3VyY2UgZmlsZSBpcyBjYWNoZWRcbiAgICogaW50ZXJuYWxseS4gVGhpcyBtZXRob2QgcmV0dXJucyBgdW5kZWZpbmVkYCBpZiB0aGUgcmVxdWVzdGVkIGZpbGUgZG9lcyBub3QgZXhpc3QuXG4gICAqXG4gICAqIEBwYXJhbSBmaWxlTmFtZSBUaGUgcGF0aCBvZiB0aGUgZmlsZSB0byByZXRyaWV2ZSBhIHNvdXJjZSBmaWxlIGZvci5cbiAgICogQHBhcmFtIGxhbmd1YWdlVmVyc2lvbiBUaGUgbGFuZ3VhZ2UgdmVyc2lvbiB0byB1c2UgZm9yIHBhcnNpbmcgdGhlIGZpbGUuXG4gICAqL1xuICBnZXRDYWNoZWRTb3VyY2VGaWxlKGZpbGVOYW1lOiBzdHJpbmcsIGxhbmd1YWdlVmVyc2lvbjogdHMuU2NyaXB0VGFyZ2V0KTogdHMuU291cmNlRmlsZXx1bmRlZmluZWQge1xuICAgIGNvbnN0IHN0YXRpY1NmID0gdGhpcy5zaGFyZWRGaWxlQ2FjaGUuZ2V0Q2FjaGVkU291cmNlRmlsZShmaWxlTmFtZSk7XG4gICAgaWYgKHN0YXRpY1NmICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBzdGF0aWNTZjtcbiAgICB9XG5cbiAgICBjb25zdCBhYnNQYXRoID0gdGhpcy5mcy5yZXNvbHZlKGZpbGVOYW1lKTtcbiAgICBpZiAodGhpcy5zZkNhY2hlLmhhcyhhYnNQYXRoKSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2ZDYWNoZS5nZXQoYWJzUGF0aCk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudCA9IHJlYWRGaWxlKGFic1BhdGgsIHRoaXMuZnMpO1xuICAgIGlmIChjb250ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGNvbnN0IHNmID0gdHMuY3JlYXRlU291cmNlRmlsZShmaWxlTmFtZSwgY29udGVudCwgbGFuZ3VhZ2VWZXJzaW9uKTtcbiAgICB0aGlzLnNmQ2FjaGUuc2V0KGFic1BhdGgsIHNmKTtcbiAgICByZXR1cm4gc2Y7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZEZpbGUoYWJzUGF0aDogQWJzb2x1dGVGc1BhdGgsIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0pOiBzdHJpbmd8dW5kZWZpbmVkIHtcbiAgaWYgKCFmcy5leGlzdHMoYWJzUGF0aCkgfHwgIWZzLnN0YXQoYWJzUGF0aCkuaXNGaWxlKCkpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiBmcy5yZWFkRmlsZShhYnNQYXRoKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYHRzLk1vZHVsZVJlc29sdXRpb25DYWNoZWAgdGhhdCB1c2VzIHRoZSBwcm92aWRlZCBmaWxlc3lzdGVtIGZvciBwYXRoIG9wZXJhdGlvbnMuXG4gKlxuICogQHBhcmFtIGZzIFRoZSBmaWxlc3lzdGVtIHRvIHVzZSBmb3IgcGF0aCBvcGVyYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW9kdWxlUmVzb2x1dGlvbkNhY2hlKGZzOiBSZWFkb25seUZpbGVTeXN0ZW0pOiB0cy5Nb2R1bGVSZXNvbHV0aW9uQ2FjaGUge1xuICByZXR1cm4gdHMuY3JlYXRlTW9kdWxlUmVzb2x1dGlvbkNhY2hlKGZzLnB3ZCgpLCBmaWxlTmFtZSA9PiB7XG4gICAgcmV0dXJuIGZzLmlzQ2FzZVNlbnNpdGl2ZSgpID8gZmlsZU5hbWUgOiBmaWxlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICB9KTtcbn1cbiJdfQ==