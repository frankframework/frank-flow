/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { commentRegex, fromComment, mapFileCommentRegex } from 'convert-source-map';
import { ContentOrigin } from './content_origin';
import { SourceFile } from './source_file';
const SCHEME_MATCHER = /^([a-z][a-z0-9.-]*):\/\//i;
/**
 * This class can be used to load a source file, its associated source map and any upstream sources.
 *
 * Since a source file might reference (or include) a source map, this class can load those too.
 * Since a source map might reference other source files, these are also loaded as needed.
 *
 * This is done recursively. The result is a "tree" of `SourceFile` objects, each containing
 * mappings to other `SourceFile` objects as necessary.
 */
export class SourceFileLoader {
    constructor(fs, logger, 
    /** A map of URL schemes to base paths. The scheme name should be lowercase. */
    schemeMap) {
        this.fs = fs;
        this.logger = logger;
        this.schemeMap = schemeMap;
        this.currentPaths = [];
    }
    loadSourceFile(sourcePath, contents = null, mapAndPath = null) {
        const contentsOrigin = contents !== null ? ContentOrigin.Provided : ContentOrigin.FileSystem;
        const sourceMapInfo = mapAndPath && Object.assign({ origin: ContentOrigin.Provided }, mapAndPath);
        return this.loadSourceFileInternal(sourcePath, contents, contentsOrigin, sourceMapInfo);
    }
    /**
     * The overload used internally to load source files referenced in a source-map.
     *
     * In this case there is no guarantee that it will return a non-null SourceMap.
     *
     * @param sourcePath The path to the source file to load.
     * @param contents The contents of the source file to load, if provided inline. If `null`,
     *     the contents will be read from the file at the `sourcePath`.
     * @param sourceOrigin Describes where the source content came from.
     * @param sourceMapInfo The raw contents and path of the source-map file. If `null` the
     *     source-map will be computed from the contents of the source file, either inline or loaded
     *     from the file-system.
     *
     * @returns a SourceFile if the content for one was provided or was able to be loaded from disk,
     * `null` otherwise.
     */
    loadSourceFileInternal(sourcePath, contents, sourceOrigin, sourceMapInfo) {
        const previousPaths = this.currentPaths.slice();
        try {
            if (contents === null) {
                if (!this.fs.exists(sourcePath)) {
                    return null;
                }
                contents = this.readSourceFile(sourcePath);
            }
            // If not provided try to load the source map based on the source itself
            if (sourceMapInfo === null) {
                sourceMapInfo = this.loadSourceMap(sourcePath, contents, sourceOrigin);
            }
            let sources = [];
            if (sourceMapInfo !== null) {
                const basePath = sourceMapInfo.mapPath || sourcePath;
                sources = this.processSources(basePath, sourceMapInfo);
            }
            return new SourceFile(sourcePath, contents, sourceMapInfo, sources, this.fs);
        }
        catch (e) {
            this.logger.warn(`Unable to fully load ${sourcePath} for source-map flattening: ${e.message}`);
            return null;
        }
        finally {
            // We are finished with this recursion so revert the paths being tracked
            this.currentPaths = previousPaths;
        }
    }
    /**
     * Find the source map associated with the source file whose `sourcePath` and `contents` are
     * provided.
     *
     * Source maps can be inline, as part of a base64 encoded comment, or external as a separate file
     * whose path is indicated in a comment or implied from the name of the source file itself.
     *
     * @param sourcePath the path to the source file.
     * @param sourceContents the contents of the source file.
     * @param sourceOrigin where the content of the source file came from.
     * @returns the parsed contents and path of the source-map, if loading was successful, null
     *     otherwise.
     */
    loadSourceMap(sourcePath, sourceContents, sourceOrigin) {
        // Only consider a source-map comment from the last non-empty line of the file, in case there
        // are embedded source-map comments elsewhere in the file (as can be the case with bundlers like
        // webpack).
        const lastLine = this.getLastNonEmptyLine(sourceContents);
        const inline = commentRegex.exec(lastLine);
        if (inline !== null) {
            return {
                map: fromComment(inline.pop()).sourcemap,
                mapPath: null,
                origin: ContentOrigin.Inline,
            };
        }
        if (sourceOrigin === ContentOrigin.Inline) {
            // The source file was provided inline and its contents did not include an inline source-map.
            // So we don't try to load an external source-map from the file-system, since this can lead to
            // invalid circular dependencies.
            return null;
        }
        const external = mapFileCommentRegex.exec(lastLine);
        if (external) {
            try {
                const fileName = external[1] || external[2];
                const externalMapPath = this.fs.resolve(this.fs.dirname(sourcePath), fileName);
                return {
                    map: this.readRawSourceMap(externalMapPath),
                    mapPath: externalMapPath,
                    origin: ContentOrigin.FileSystem,
                };
            }
            catch (e) {
                this.logger.warn(`Unable to fully load ${sourcePath} for source-map flattening: ${e.message}`);
                return null;
            }
        }
        const impliedMapPath = this.fs.resolve(sourcePath + '.map');
        if (this.fs.exists(impliedMapPath)) {
            return {
                map: this.readRawSourceMap(impliedMapPath),
                mapPath: impliedMapPath,
                origin: ContentOrigin.FileSystem,
            };
        }
        return null;
    }
    /**
     * Iterate over each of the "sources" for this source file's source map, recursively loading each
     * source file and its associated source map.
     */
    processSources(basePath, { map, origin: sourceMapOrigin }) {
        const sourceRoot = this.fs.resolve(this.fs.dirname(basePath), this.replaceSchemeWithPath(map.sourceRoot || ''));
        return map.sources.map((source, index) => {
            const path = this.fs.resolve(sourceRoot, this.replaceSchemeWithPath(source));
            const content = map.sourcesContent && map.sourcesContent[index] || null;
            // The origin of this source file is "inline" if we extracted it from the source-map's
            // `sourcesContent`, except when the source-map itself was "provided" in-memory.
            // An inline source file is treated as if it were from the file-system if the source-map that
            // contains it was provided in-memory. The first call to `loadSourceFile()` is special in that
            // if you "provide" the contents of the source-map in-memory then we don't want to block
            // loading sources from the file-system just because this source-map had an inline source.
            const sourceOrigin = content !== null && sourceMapOrigin !== ContentOrigin.Provided ?
                ContentOrigin.Inline :
                ContentOrigin.FileSystem;
            return this.loadSourceFileInternal(path, content, sourceOrigin, null);
        });
    }
    /**
     * Load the contents of the source file from disk.
     *
     * @param sourcePath The path to the source file.
     */
    readSourceFile(sourcePath) {
        this.trackPath(sourcePath);
        return this.fs.readFile(sourcePath);
    }
    /**
     * Load the source map from the file at `mapPath`, parsing its JSON contents into a `RawSourceMap`
     * object.
     *
     * @param mapPath The path to the source-map file.
     */
    readRawSourceMap(mapPath) {
        this.trackPath(mapPath);
        return JSON.parse(this.fs.readFile(mapPath));
    }
    /**
     * Track source file paths if we have loaded them from disk so that we don't get into an infinite
     * recursion.
     */
    trackPath(path) {
        if (this.currentPaths.includes(path)) {
            throw new Error(`Circular source file mapping dependency: ${this.currentPaths.join(' -> ')} -> ${path}`);
        }
        this.currentPaths.push(path);
    }
    getLastNonEmptyLine(contents) {
        let trailingWhitespaceIndex = contents.length - 1;
        while (trailingWhitespaceIndex > 0 &&
            (contents[trailingWhitespaceIndex] === '\n' ||
                contents[trailingWhitespaceIndex] === '\r')) {
            trailingWhitespaceIndex--;
        }
        let lastRealLineIndex = contents.lastIndexOf('\n', trailingWhitespaceIndex - 1);
        if (lastRealLineIndex === -1) {
            lastRealLineIndex = 0;
        }
        return contents.substr(lastRealLineIndex + 1);
    }
    /**
     * Replace any matched URL schemes with their corresponding path held in the schemeMap.
     *
     * Some build tools replace real file paths with scheme prefixed paths - e.g. `webpack://`.
     * We use the `schemeMap` passed to this class to convert such paths to "real" file paths.
     * In some cases, this is not possible, since the file was actually synthesized by the build tool.
     * But the end result is better than prefixing the sourceRoot in front of the scheme.
     */
    replaceSchemeWithPath(path) {
        return path.replace(SCHEME_MATCHER, (_, scheme) => this.schemeMap[scheme.toLowerCase()] || '');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlX2ZpbGVfbG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9zb3VyY2VtYXBzL3NyYy9zb3VyY2VfZmlsZV9sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUtsRixPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFL0MsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUV6QyxNQUFNLGNBQWMsR0FBRywyQkFBMkIsQ0FBQztBQUVuRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sT0FBTyxnQkFBZ0I7SUFHM0IsWUFDWSxFQUFzQixFQUFVLE1BQWM7SUFDdEQsK0VBQStFO0lBQ3ZFLFNBQXlDO1FBRnpDLE9BQUUsR0FBRixFQUFFLENBQW9CO1FBQVUsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUU5QyxjQUFTLEdBQVQsU0FBUyxDQUFnQztRQUw3QyxpQkFBWSxHQUFxQixFQUFFLENBQUM7SUFLWSxDQUFDO0lBNkJ6RCxjQUFjLENBQ1YsVUFBMEIsRUFBRSxXQUF3QixJQUFJLEVBQ3hELGFBQThCLElBQUk7UUFDcEMsTUFBTSxjQUFjLEdBQUcsUUFBUSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQztRQUM3RixNQUFNLGFBQWEsR0FDZixVQUFVLG9CQUFLLE1BQU0sRUFBRSxhQUFhLENBQUMsUUFBUSxJQUFLLFVBQVUsQ0FBQyxDQUFDO1FBQ2xFLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLGFBQWEs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QUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFFBQWdCO1FBQzFDLElBQUksdUJBQXVCLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDbEQsT0FBTyx1QkFBdUIsR0FBRyxDQUFDO1lBQzNCLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEtBQUssSUFBSTtnQkFDMUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEtBQUssSUFBSSxDQUFDLEVBQUU7WUFDbkQsdUJBQXVCLEVBQUUsQ0FBQztTQUMzQjtRQUNELElBQUksaUJBQWlCLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDaEYsSUFBSSxpQkFBaUIsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUM1QixpQkFBaUIsR0FBRyxDQUFDLENBQUM7U0FDdkI7UUFDRCxPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSyxxQkFBcUIsQ0FBQyxJQUFZO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FDZixjQUFjLEVBQUUsQ0FBQyxDQUFTLEVBQUUsTUFBYyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2pHLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtjb21tZW50UmVnZXgsIGZyb21Db21tZW50LCBtYXBGaWxlQ29tbWVudFJlZ2V4fSBmcm9tICdjb252ZXJ0LXNvdXJjZS1tYXAnO1xuXG5pbXBvcnQge0Fic29sdXRlRnNQYXRoLCBSZWFkb25seUZpbGVTeXN0ZW19IGZyb20gJy4uLy4uL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi9sb2dnaW5nJztcblxuaW1wb3J0IHtDb250ZW50T3JpZ2lufSBmcm9tICcuL2NvbnRlbnRfb3JpZ2luJztcbmltcG9ydCB7TWFwQW5kUGF0aCwgUmF3U291cmNlTWFwLCBTb3VyY2VNYXBJbmZvfSBmcm9tICcuL3Jhd19zb3VyY2VfbWFwJztcbmltcG9ydCB7U291cmNlRmlsZX0gZnJvbSAnLi9zb3VyY2VfZmlsZSc7XG5cbmNvbnN0IFNDSEVNRV9NQVRDSEVSID0gL14oW2Etel1bYS16MC05Li1dKik6XFwvXFwvL2k7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBjYW4gYmUgdXNlZCB0byBsb2FkIGEgc291cmNlIGZpbGUsIGl0cyBhc3NvY2lhdGVkIHNvdXJjZSBtYXAgYW5kIGFueSB1cHN0cmVhbSBzb3VyY2VzLlxuICpcbiAqIFNpbmNlIGEgc291cmNlIGZpbGUgbWlnaHQgcmVmZXJlbmNlIChvciBpbmNsdWRlKSBhIHNvdXJjZSBtYXAsIHRoaXMgY2xhc3MgY2FuIGxvYWQgdGhvc2UgdG9vLlxuICogU2luY2UgYSBzb3VyY2UgbWFwIG1pZ2h0IHJlZmVyZW5jZSBvdGhlciBzb3VyY2UgZmlsZXMsIHRoZXNlIGFyZSBhbHNvIGxvYWRlZCBhcyBuZWVkZWQuXG4gKlxuICogVGhpcyBpcyBkb25lIHJlY3Vyc2l2ZWx5LiBUaGUgcmVzdWx0IGlzIGEgXCJ0cmVlXCIgb2YgYFNvdXJjZUZpbGVgIG9iamVjdHMsIGVhY2ggY29udGFpbmluZ1xuICogbWFwcGluZ3MgdG8gb3RoZXIgYFNvdXJjZUZpbGVgIG9iamVjdHMgYXMgbmVjZXNzYXJ5LlxuICovXG5leHBvcnQgY2xhc3MgU291cmNlRmlsZUxvYWRlciB7XG4gIHByaXZhdGUgY3VycmVudFBhdGhzOiBBYnNvbHV0ZUZzUGF0aFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0sIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXIsXG4gICAgICAvKiogQSBtYXAgb2YgVVJMIHNjaGVtZXMgdG8gYmFzZSBwYXRocy4gVGhlIHNjaGVtZSBuYW1lIHNob3VsZCBiZSBsb3dlcmNhc2UuICovXG4gICAgICBwcml2YXRlIHNjaGVtZU1hcDogUmVjb3JkPHN0cmluZywgQWJzb2x1dGVGc1BhdGg+KSB7fVxuXG4gIC8qKlxuICAgKiBMb2FkIGEgc291cmNlIGZpbGUgZnJvbSB0aGUgcHJvdmlkZWQgY29udGVudCBhbmQgc291cmNlIG1hcCwgYW5kIHJlY3Vyc2l2ZWx5IGxvYWQgYW55XG4gICAqIHJlZmVyZW5jZWQgc291cmNlIGZpbGVzLlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlUGF0aCBUaGUgcGF0aCB0byB0aGUgc291cmNlIGZpbGUgdG8gbG9hZC5cbiAgICogQHBhcmFtIGNvbnRlbnRzIFRoZSBjb250ZW50cyBvZiB0aGUgc291cmNlIGZpbGUgdG8gbG9hZC5cbiAgICogQHBhcmFtIG1hcEFuZFBhdGggVGhlIHJhdyBzb3VyY2UtbWFwIGFuZCB0aGUgcGF0aCB0byB0aGUgc291cmNlLW1hcCBmaWxlLlxuICAgKiBAcmV0dXJucyBhIFNvdXJjZUZpbGUgb2JqZWN0IGNyZWF0ZWQgZnJvbSB0aGUgYGNvbnRlbnRzYCBhbmQgcHJvdmlkZWQgc291cmNlLW1hcCBpbmZvLlxuICAgKi9cbiAgbG9hZFNvdXJjZUZpbGUoc291cmNlUGF0aDogQWJzb2x1dGVGc1BhdGgsIGNvbnRlbnRzOiBzdHJpbmcsIG1hcEFuZFBhdGg6IE1hcEFuZFBhdGgpOiBTb3VyY2VGaWxlO1xuICAvKipcbiAgICogTG9hZCBhIHNvdXJjZSBmaWxlIGZyb20gdGhlIHByb3ZpZGVkIGNvbnRlbnQsIGNvbXB1dGUgaXRzIHNvdXJjZSBtYXAsIGFuZCByZWN1cnNpdmVseSBsb2FkIGFueVxuICAgKiByZWZlcmVuY2VkIHNvdXJjZSBmaWxlcy5cbiAgICpcbiAgICogQHBhcmFtIHNvdXJjZVBhdGggVGhlIHBhdGggdG8gdGhlIHNvdXJjZSBmaWxlIHRvIGxvYWQuXG4gICAqIEBwYXJhbSBjb250ZW50cyBUaGUgY29udGVudHMgb2YgdGhlIHNvdXJjZSBmaWxlIHRvIGxvYWQuXG4gICAqIEByZXR1cm5zIGEgU291cmNlRmlsZSBvYmplY3QgY3JlYXRlZCBmcm9tIHRoZSBgY29udGVudHNgIGFuZCBjb21wdXRlZCBzb3VyY2UtbWFwIGluZm8uXG4gICAqL1xuICBsb2FkU291cmNlRmlsZShzb3VyY2VQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgY29udGVudHM6IHN0cmluZyk6IFNvdXJjZUZpbGU7XG4gIC8qKlxuICAgKiBMb2FkIGEgc291cmNlIGZpbGUgZnJvbSB0aGUgZmlsZS1zeXN0ZW0sIGNvbXB1dGUgaXRzIHNvdXJjZSBtYXAsIGFuZCByZWN1cnNpdmVseSBsb2FkIGFueVxuICAgKiByZWZlcmVuY2VkIHNvdXJjZSBmaWxlcy5cbiAgICpcbiAgICogQHBhcmFtIHNvdXJjZVBhdGggVGhlIHBhdGggdG8gdGhlIHNvdXJjZSBmaWxlIHRvIGxvYWQuXG4gICAqIEByZXR1cm5zIGEgU291cmNlRmlsZSBvYmplY3QgaWYgaXRzIGNvbnRlbnRzIGNvdWxkIGJlIGxvYWRlZCBmcm9tIGRpc2ssIG9yIG51bGwgb3RoZXJ3aXNlLlxuICAgKi9cbiAgbG9hZFNvdXJjZUZpbGUoc291cmNlUGF0aDogQWJzb2x1dGVGc1BhdGgpOiBTb3VyY2VGaWxlfG51bGw7XG4gIGxvYWRTb3VyY2VGaWxlKFxuICAgICAgc291cmNlUGF0aDogQWJzb2x1dGVGc1BhdGgsIGNvbnRlbnRzOiBzdHJpbmd8bnVsbCA9IG51bGwsXG4gICAgICBtYXBBbmRQYXRoOiBNYXBBbmRQYXRofG51bGwgPSBudWxsKTogU291cmNlRmlsZXxudWxsIHtcbiAgICBjb25zdCBjb250ZW50c09yaWdpbiA9IGNvbnRlbnRzICE9PSBudWxsID8gQ29udGVudE9yaWdpbi5Qcm92aWRlZCA6IENvbnRlbnRPcmlnaW4uRmlsZVN5c3RlbTtcbiAgICBjb25zdCBzb3VyY2VNYXBJbmZvOiBTb3VyY2VNYXBJbmZvfG51bGwgPVxuICAgICAgICBtYXBBbmRQYXRoICYmIHtvcmlnaW46IENvbnRlbnRPcmlnaW4uUHJvdmlkZWQsIC4uLm1hcEFuZFBhdGh9O1xuICAgIHJldHVybiB0aGlzLmxvYWRTb3VyY2VGaWxlSW50ZXJuYWwoc291cmNlUGF0aCwgY29udGVudHMsIGNvbnRlbnRzT3JpZ2luLCBzb3VyY2VNYXBJbmZvKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgb3ZlcmxvYWQgdXNlZCBpbnRlcm5hbGx5IHRvIGxvYWQgc291cmNlIGZpbGVzIHJlZmVyZW5jZWQgaW4gYSBzb3VyY2UtbWFwLlxuICAgKlxuICAgKiBJbiB0aGlzIGNhc2UgdGhlcmUgaXMgbm8gZ3VhcmFudGVlIHRoYXQgaXQgd2lsbCByZXR1cm4gYSBub24tbnVsbCBTb3VyY2VNYXAuXG4gICAqXG4gICAqIEBwYXJhbSBzb3VyY2VQYXRoIFRoZSBwYXRoIHRvIHRoZSBzb3VyY2UgZmlsZSB0byBsb2FkLlxuICAgKiBAcGFyYW0gY29udGVudHMgVGhlIGNvbnRlbnRzIG9mIHRoZSBzb3VyY2UgZmlsZSB0byBsb2FkLCBpZiBwcm92aWRlZCBpbmxpbmUuIElmIGBudWxsYCxcbiAgICogICAgIHRoZSBjb250ZW50cyB3aWxsIGJlIHJlYWQgZnJvbSB0aGUgZmlsZSBhdCB0aGUgYHNvdXJjZVBhdGhgLlxuICAgKiBAcGFyYW0gc291cmNlT3JpZ2luIERlc2NyaWJlcyB3aGVyZSB0aGUgc291cmNlIGNvbnRlbnQgY2FtZSBmcm9tLlxuICAgKiBAcGFyYW0gc291cmNlTWFwSW5mbyBUaGUgcmF3IGNvbnRlbnRzIGFuZCBwYXRoIG9mIHRoZSBzb3VyY2UtbWFwIGZpbGUuIElmIGBudWxsYCB0aGVcbiAgICogICAgIHNvdXJjZS1tYXAgd2lsbCBiZSBjb21wdXRlZCBmcm9tIHRoZSBjb250ZW50cyBvZiB0aGUgc291cmNlIGZpbGUsIGVpdGhlciBpbmxpbmUgb3IgbG9hZGVkXG4gICAqICAgICBmcm9tIHRoZSBmaWxlLXN5c3RlbS5cbiAgICpcbiAgICogQHJldHVybnMgYSBTb3VyY2VGaWxlIGlmIHRoZSBjb250ZW50IGZvciBvbmUgd2FzIHByb3ZpZGVkIG9yIHdhcyBhYmxlIHRvIGJlIGxvYWRlZCBmcm9tIGRpc2ssXG4gICAqIGBudWxsYCBvdGhlcndpc2UuXG4gICAqL1xuICBwcml2YXRlIGxvYWRTb3VyY2VGaWxlSW50ZXJuYWwoXG4gICAgICBzb3VyY2VQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgY29udGVudHM6IHN0cmluZ3xudWxsLCBzb3VyY2VPcmlnaW46IENvbnRlbnRPcmlnaW4sXG4gICAgICBzb3VyY2VNYXBJbmZvOiBTb3VyY2VNYXBJbmZvfG51bGwpOiBTb3VyY2VGaWxlfG51bGwge1xuICAgIGNvbnN0IHByZXZpb3VzUGF0aHMgPSB0aGlzLmN1cnJlbnRQYXRocy5zbGljZSgpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoY29udGVudHMgPT09IG51bGwpIHtcbiAgICAgICAgaWYgKCF0aGlzLmZzLmV4aXN0cyhzb3VyY2VQYXRoKSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRlbnRzID0gdGhpcy5yZWFkU291cmNlRmlsZShzb3VyY2VQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgbm90IHByb3ZpZGVkIHRyeSB0byBsb2FkIHRoZSBzb3VyY2UgbWFwIGJhc2VkIG9uIHRoZSBzb3VyY2UgaXRzZWxmXG4gICAgICBpZiAoc291cmNlTWFwSW5mbyA9PT0gbnVsbCkge1xuICAgICAgICBzb3VyY2VNYXBJbmZvID0gdGhpcy5sb2FkU291cmNlTWFwKHNvdXJjZVBhdGgsIGNvbnRlbnRzLCBzb3VyY2VPcmlnaW4pO1xuICAgICAgfVxuXG4gICAgICBsZXQgc291cmNlczogKFNvdXJjZUZpbGV8bnVsbClbXSA9IFtdO1xuICAgICAgaWYgKHNvdXJjZU1hcEluZm8gIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgYmFzZVBhdGggPSBzb3VyY2VNYXBJbmZvLm1hcFBhdGggfHwgc291cmNlUGF0aDtcbiAgICAgICAgc291cmNlcyA9IHRoaXMucHJvY2Vzc1NvdXJjZXMoYmFzZVBhdGgsIHNvdXJjZU1hcEluZm8pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IFNvdXJjZUZpbGUoc291cmNlUGF0aCwgY29udGVudHMsIHNvdXJjZU1hcEluZm8sIHNvdXJjZXMsIHRoaXMuZnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oXG4gICAgICAgICAgYFVuYWJsZSB0byBmdWxseSBsb2FkICR7c291cmNlUGF0aH0gZm9yIHNvdXJjZS1tYXAgZmxhdHRlbmluZzogJHtlLm1lc3NhZ2V9YCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgLy8gV2UgYXJlIGZpbmlzaGVkIHdpdGggdGhpcyByZWN1cnNpb24gc28gcmV2ZXJ0IHRoZSBwYXRocyBiZWluZyB0cmFja2VkXG4gICAgICB0aGlzLmN1cnJlbnRQYXRocyA9IHByZXZpb3VzUGF0aHM7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgdGhlIHNvdXJjZSBtYXAgYXNzb2NpYXRlZCB3aXRoIHRoZSBzb3VyY2UgZmlsZSB3aG9zZSBgc291cmNlUGF0aGAgYW5kIGBjb250ZW50c2AgYXJlXG4gICAqIHByb3ZpZGVkLlxuICAgKlxuICAgKiBTb3VyY2UgbWFwcyBjYW4gYmUgaW5saW5lLCBhcyBwYXJ0IG9mIGEgYmFzZTY0IGVuY29kZWQgY29tbWVudCwgb3IgZXh0ZXJuYWwgYXMgYSBzZXBhcmF0ZSBmaWxlXG4gICAqIHdob3NlIHBhdGggaXMgaW5kaWNhdGVkIGluIGEgY29tbWVudCBvciBpbXBsaWVkIGZyb20gdGhlIG5hbWUgb2YgdGhlIHNvdXJjZSBmaWxlIGl0c2VsZi5cbiAgICpcbiAgICogQHBhcmFtIHNvdXJjZVBhdGggdGhlIHBhdGggdG8gdGhlIHNvdXJjZSBmaWxlLlxuICAgKiBAcGFyYW0gc291cmNlQ29udGVudHMgdGhlIGNvbnRlbnRzIG9mIHRoZSBzb3VyY2UgZmlsZS5cbiAgICogQHBhcmFtIHNvdXJjZU9yaWdpbiB3aGVyZSB0aGUgY29udGVudCBvZiB0aGUgc291cmNlIGZpbGUgY2FtZSBmcm9tLlxuICAgKiBAcmV0dXJucyB0aGUgcGFyc2VkIGNvbnRlbnRzIGFuZCBwYXRoIG9mIHRoZSBzb3VyY2UtbWFwLCBpZiBsb2FkaW5nIHdhcyBzdWNjZXNzZnVsLCBudWxsXG4gICAqICAgICBvdGhlcndpc2UuXG4gICAqL1xuICBwcml2YXRlIGxvYWRTb3VyY2VNYXAoXG4gICAgICBzb3VyY2VQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgc291cmNlQ29udGVudHM6IHN0cmluZyxcbiAgICAgIHNvdXJjZU9yaWdpbjogQ29udGVudE9yaWdpbik6IFNvdXJjZU1hcEluZm98bnVsbCB7XG4gICAgLy8gT25seSBjb25zaWRlciBhIHNvdXJjZS1tYXAgY29tbWVudCBmcm9tIHRoZSBsYXN0IG5vbi1lbXB0eSBsaW5lIG9mIHRoZSBmaWxlLCBpbiBjYXNlIHRoZXJlXG4gICAgLy8gYXJlIGVtYmVkZGVkIHNvdXJjZS1tYXAgY29tbWVudHMgZWxzZXdoZXJlIGluIHRoZSBmaWxlIChhcyBjYW4gYmUgdGhlIGNhc2Ugd2l0aCBidW5kbGVycyBsaWtlXG4gICAgLy8gd2VicGFjaykuXG4gICAgY29uc3QgbGFzdExpbmUgPSB0aGlzLmdldExhc3ROb25FbXB0eUxpbmUoc291cmNlQ29udGVudHMpO1xuICAgIGNvbnN0IGlubGluZSA9IGNvbW1lbnRSZWdleC5leGVjKGxhc3RMaW5lKTtcbiAgICBpZiAoaW5saW5lICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBtYXA6IGZyb21Db21tZW50KGlubGluZS5wb3AoKSEpLnNvdXJjZW1hcCxcbiAgICAgICAgbWFwUGF0aDogbnVsbCxcbiAgICAgICAgb3JpZ2luOiBDb250ZW50T3JpZ2luLklubGluZSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKHNvdXJjZU9yaWdpbiA9PT0gQ29udGVudE9yaWdpbi5JbmxpbmUpIHtcbiAgICAgIC8vIFRoZSBzb3VyY2UgZmlsZSB3YXMgcHJvdmlkZWQgaW5saW5lIGFuZCBpdHMgY29udGVudHMgZGlkIG5vdCBpbmNsdWRlIGFuIGlubGluZSBzb3VyY2UtbWFwLlxuICAgICAgLy8gU28gd2UgZG9uJ3QgdHJ5IHRvIGxvYWQgYW4gZXh0ZXJuYWwgc291cmNlLW1hcCBmcm9tIHRoZSBmaWxlLXN5c3RlbSwgc2luY2UgdGhpcyBjYW4gbGVhZCB0b1xuICAgICAgLy8gaW52YWxpZCBjaXJjdWxhciBkZXBlbmRlbmNpZXMuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBleHRlcm5hbCA9IG1hcEZpbGVDb21tZW50UmVnZXguZXhlYyhsYXN0TGluZSk7XG4gICAgaWYgKGV4dGVybmFsKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWxlTmFtZSA9IGV4dGVybmFsWzFdIHx8IGV4dGVybmFsWzJdO1xuICAgICAgICBjb25zdCBleHRlcm5hbE1hcFBhdGggPSB0aGlzLmZzLnJlc29sdmUodGhpcy5mcy5kaXJuYW1lKHNvdXJjZVBhdGgpLCBmaWxlTmFtZSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbWFwOiB0aGlzLnJlYWRSYXdTb3VyY2VNYXAoZXh0ZXJuYWxNYXBQYXRoKSxcbiAgICAgICAgICBtYXBQYXRoOiBleHRlcm5hbE1hcFBhdGgsXG4gICAgICAgICAgb3JpZ2luOiBDb250ZW50T3JpZ2luLkZpbGVTeXN0ZW0sXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLndhcm4oXG4gICAgICAgICAgICBgVW5hYmxlIHRvIGZ1bGx5IGxvYWQgJHtzb3VyY2VQYXRofSBmb3Igc291cmNlLW1hcCBmbGF0dGVuaW5nOiAke2UubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaW1wbGllZE1hcFBhdGggPSB0aGlzLmZzLnJlc29sdmUoc291cmNlUGF0aCArICcubWFwJyk7XG4gICAgaWYgKHRoaXMuZnMuZXhpc3RzKGltcGxpZWRNYXBQYXRoKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWFwOiB0aGlzLnJlYWRSYXdTb3VyY2VNYXAoaW1wbGllZE1hcFBhdGgpLFxuICAgICAgICBtYXBQYXRoOiBpbXBsaWVkTWFwUGF0aCxcbiAgICAgICAgb3JpZ2luOiBDb250ZW50T3JpZ2luLkZpbGVTeXN0ZW0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgb3ZlciBlYWNoIG9mIHRoZSBcInNvdXJjZXNcIiBmb3IgdGhpcyBzb3VyY2UgZmlsZSdzIHNvdXJjZSBtYXAsIHJlY3Vyc2l2ZWx5IGxvYWRpbmcgZWFjaFxuICAgKiBzb3VyY2UgZmlsZSBhbmQgaXRzIGFzc29jaWF0ZWQgc291cmNlIG1hcC5cbiAgICovXG4gIHByaXZhdGUgcHJvY2Vzc1NvdXJjZXMoYmFzZVBhdGg6IEFic29sdXRlRnNQYXRoLCB7bWFwLCBvcmlnaW46IHNvdXJjZU1hcE9yaWdpbn06IFNvdXJjZU1hcEluZm8pOlxuICAgICAgKFNvdXJjZUZpbGV8bnVsbClbXSB7XG4gICAgY29uc3Qgc291cmNlUm9vdCA9IHRoaXMuZnMucmVzb2x2ZShcbiAgICAgICAgdGhpcy5mcy5kaXJuYW1lKGJhc2VQYXRoKSwgdGhpcy5yZXBsYWNlU2NoZW1lV2l0aFBhdGgobWFwLnNvdXJjZVJvb3QgfHwgJycpKTtcbiAgICByZXR1cm4gbWFwLnNvdXJjZXMubWFwKChzb3VyY2UsIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCBwYXRoID0gdGhpcy5mcy5yZXNvbHZlKHNvdXJjZVJvb3QsIHRoaXMucmVwbGFjZVNjaGVtZVdpdGhQYXRoKHNvdXJjZSkpO1xuICAgICAgY29uc3QgY29udGVudCA9IG1hcC5zb3VyY2VzQ29udGVudCAmJiBtYXAuc291cmNlc0NvbnRlbnRbaW5kZXhdIHx8IG51bGw7XG4gICAgICAvLyBUaGUgb3JpZ2luIG9mIHRoaXMgc291cmNlIGZpbGUgaXMgXCJpbmxpbmVcIiBpZiB3ZSBleHRyYWN0ZWQgaXQgZnJvbSB0aGUgc291cmNlLW1hcCdzXG4gICAgICAvLyBgc291cmNlc0NvbnRlbnRgLCBleGNlcHQgd2hlbiB0aGUgc291cmNlLW1hcCBpdHNlbGYgd2FzIFwicHJvdmlkZWRcIiBpbi1tZW1vcnkuXG4gICAgICAvLyBBbiBpbmxpbmUgc291cmNlIGZpbGUgaXMgdHJlYXRlZCBhcyBpZiBpdCB3ZXJlIGZyb20gdGhlIGZpbGUtc3lzdGVtIGlmIHRoZSBzb3VyY2UtbWFwIHRoYXRcbiAgICAgIC8vIGNvbnRhaW5zIGl0IHdhcyBwcm92aWRlZCBpbi1tZW1vcnkuIFRoZSBmaXJzdCBjYWxsIHRvIGBsb2FkU291cmNlRmlsZSgpYCBpcyBzcGVjaWFsIGluIHRoYXRcbiAgICAgIC8vIGlmIHlvdSBcInByb3ZpZGVcIiB0aGUgY29udGVudHMgb2YgdGhlIHNvdXJjZS1tYXAgaW4tbWVtb3J5IHRoZW4gd2UgZG9uJ3Qgd2FudCB0byBibG9ja1xuICAgICAgLy8gbG9hZGluZyBzb3VyY2VzIGZyb20gdGhlIGZpbGUtc3lzdGVtIGp1c3QgYmVjYXVzZSB0aGlzIHNvdXJjZS1tYXAgaGFkIGFuIGlubGluZSBzb3VyY2UuXG4gICAgICBjb25zdCBzb3VyY2VPcmlnaW4gPSBjb250ZW50ICE9PSBudWxsICYmIHNvdXJjZU1hcE9yaWdpbiAhPT0gQ29udGVudE9yaWdpbi5Qcm92aWRlZCA/XG4gICAgICAgICAgQ29udGVudE9yaWdpbi5JbmxpbmUgOlxuICAgICAgICAgIENvbnRlbnRPcmlnaW4uRmlsZVN5c3RlbTtcbiAgICAgIHJldHVybiB0aGlzLmxvYWRTb3VyY2VGaWxlSW50ZXJuYWwocGF0aCwgY29udGVudCwgc291cmNlT3JpZ2luLCBudWxsKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIHRoZSBjb250ZW50cyBvZiB0aGUgc291cmNlIGZpbGUgZnJvbSBkaXNrLlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlUGF0aCBUaGUgcGF0aCB0byB0aGUgc291cmNlIGZpbGUuXG4gICAqL1xuICBwcml2YXRlIHJlYWRTb3VyY2VGaWxlKHNvdXJjZVBhdGg6IEFic29sdXRlRnNQYXRoKTogc3RyaW5nIHtcbiAgICB0aGlzLnRyYWNrUGF0aChzb3VyY2VQYXRoKTtcbiAgICByZXR1cm4gdGhpcy5mcy5yZWFkRmlsZShzb3VyY2VQYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIHRoZSBzb3VyY2UgbWFwIGZyb20gdGhlIGZpbGUgYXQgYG1hcFBhdGhgLCBwYXJzaW5nIGl0cyBKU09OIGNvbnRlbnRzIGludG8gYSBgUmF3U291cmNlTWFwYFxuICAgKiBvYmplY3QuXG4gICAqXG4gICAqIEBwYXJhbSBtYXBQYXRoIFRoZSBwYXRoIHRvIHRoZSBzb3VyY2UtbWFwIGZpbGUuXG4gICAqL1xuICBwcml2YXRlIHJlYWRSYXdTb3VyY2VNYXAobWFwUGF0aDogQWJzb2x1dGVGc1BhdGgpOiBSYXdTb3VyY2VNYXAge1xuICAgIHRoaXMudHJhY2tQYXRoKG1hcFBhdGgpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKHRoaXMuZnMucmVhZEZpbGUobWFwUGF0aCkpIGFzIFJhd1NvdXJjZU1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFjayBzb3VyY2UgZmlsZSBwYXRocyBpZiB3ZSBoYXZlIGxvYWRlZCB0aGVtIGZyb20gZGlzayBzbyB0aGF0IHdlIGRvbid0IGdldCBpbnRvIGFuIGluZmluaXRlXG4gICAqIHJlY3Vyc2lvbi5cbiAgICovXG4gIHByaXZhdGUgdHJhY2tQYXRoKHBhdGg6IEFic29sdXRlRnNQYXRoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY3VycmVudFBhdGhzLmluY2x1ZGVzKHBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENpcmN1bGFyIHNvdXJjZSBmaWxlIG1hcHBpbmcgZGVwZW5kZW5jeTogJHt0aGlzLmN1cnJlbnRQYXRocy5qb2luKCcgLT4gJyl9IC0+ICR7cGF0aH1gKTtcbiAgICB9XG4gICAgdGhpcy5jdXJyZW50UGF0aHMucHVzaChwYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TGFzdE5vbkVtcHR5TGluZShjb250ZW50czogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgdHJhaWxpbmdXaGl0ZXNwYWNlSW5kZXggPSBjb250ZW50cy5sZW5ndGggLSAxO1xuICAgIHdoaWxlICh0cmFpbGluZ1doaXRlc3BhY2VJbmRleCA+IDAgJiZcbiAgICAgICAgICAgKGNvbnRlbnRzW3RyYWlsaW5nV2hpdGVzcGFjZUluZGV4XSA9PT0gJ1xcbicgfHxcbiAgICAgICAgICAgIGNvbnRlbnRzW3RyYWlsaW5nV2hpdGVzcGFjZUluZGV4XSA9PT0gJ1xccicpKSB7XG4gICAgICB0cmFpbGluZ1doaXRlc3BhY2VJbmRleC0tO1xuICAgIH1cbiAgICBsZXQgbGFzdFJlYWxMaW5lSW5kZXggPSBjb250ZW50cy5sYXN0SW5kZXhPZignXFxuJywgdHJhaWxpbmdXaGl0ZXNwYWNlSW5kZXggLSAxKTtcbiAgICBpZiAobGFzdFJlYWxMaW5lSW5kZXggPT09IC0xKSB7XG4gICAgICBsYXN0UmVhbExpbmVJbmRleCA9IDA7XG4gICAgfVxuICAgIHJldHVybiBjb250ZW50cy5zdWJzdHIobGFzdFJlYWxMaW5lSW5kZXggKyAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYWNlIGFueSBtYXRjaGVkIFVSTCBzY2hlbWVzIHdpdGggdGhlaXIgY29ycmVzcG9uZGluZyBwYXRoIGhlbGQgaW4gdGhlIHNjaGVtZU1hcC5cbiAgICpcbiAgICogU29tZSBidWlsZCB0b29scyByZXBsYWNlIHJlYWwgZmlsZSBwYXRocyB3aXRoIHNjaGVtZSBwcmVmaXhlZCBwYXRocyAtIGUuZy4gYHdlYnBhY2s6Ly9gLlxuICAgKiBXZSB1c2UgdGhlIGBzY2hlbWVNYXBgIHBhc3NlZCB0byB0aGlzIGNsYXNzIHRvIGNvbnZlcnQgc3VjaCBwYXRocyB0byBcInJlYWxcIiBmaWxlIHBhdGhzLlxuICAgKiBJbiBzb21lIGNhc2VzLCB0aGlzIGlzIG5vdCBwb3NzaWJsZSwgc2luY2UgdGhlIGZpbGUgd2FzIGFjdHVhbGx5IHN5bnRoZXNpemVkIGJ5IHRoZSBidWlsZCB0b29sLlxuICAgKiBCdXQgdGhlIGVuZCByZXN1bHQgaXMgYmV0dGVyIHRoYW4gcHJlZml4aW5nIHRoZSBzb3VyY2VSb290IGluIGZyb250IG9mIHRoZSBzY2hlbWUuXG4gICAqL1xuICBwcml2YXRlIHJlcGxhY2VTY2hlbWVXaXRoUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwYXRoLnJlcGxhY2UoXG4gICAgICAgIFNDSEVNRV9NQVRDSEVSLCAoXzogc3RyaW5nLCBzY2hlbWU6IHN0cmluZykgPT4gdGhpcy5zY2hlbWVNYXBbc2NoZW1lLnRvTG93ZXJDYXNlKCldIHx8ICcnKTtcbiAgfVxufVxuIl19