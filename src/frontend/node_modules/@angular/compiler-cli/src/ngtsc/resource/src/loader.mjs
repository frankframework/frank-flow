/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __awaiter } from "tslib";
import * as ts from 'typescript';
import { join } from '../../file_system';
const CSS_PREPROCESSOR_EXT = /(\.scss|\.sass|\.less|\.styl)$/;
const RESOURCE_MARKER = '.$ngresource$';
const RESOURCE_MARKER_TS = RESOURCE_MARKER + '.ts';
/**
 * `ResourceLoader` which delegates to an `NgCompilerAdapter`'s resource loading methods.
 */
export class AdapterResourceLoader {
    constructor(adapter, options) {
        this.adapter = adapter;
        this.options = options;
        this.cache = new Map();
        this.fetching = new Map();
        this.lookupResolutionHost = createLookupResolutionHost(this.adapter);
        this.canPreload = !!this.adapter.readResource;
        this.canPreprocess = !!this.adapter.transformResource;
    }
    /**
     * Resolve the url of a resource relative to the file that contains the reference to it.
     * The return value of this method can be used in the `load()` and `preload()` methods.
     *
     * Uses the provided CompilerHost if it supports mapping resources to filenames.
     * Otherwise, uses a fallback mechanism that searches the module resolution candidates.
     *
     * @param url The, possibly relative, url of the resource.
     * @param fromFile The path to the file that contains the URL of the resource.
     * @returns A resolved url of resource.
     * @throws An error if the resource cannot be resolved.
     */
    resolve(url, fromFile) {
        let resolvedUrl = null;
        if (this.adapter.resourceNameToFileName) {
            resolvedUrl = this.adapter.resourceNameToFileName(url, fromFile, (url, fromFile) => this.fallbackResolve(url, fromFile));
        }
        else {
            resolvedUrl = this.fallbackResolve(url, fromFile);
        }
        if (resolvedUrl === null) {
            throw new Error(`HostResourceResolver: could not resolve ${url} in context of ${fromFile})`);
        }
        return resolvedUrl;
    }
    /**
     * Preload the specified resource, asynchronously.
     *
     * Once the resource is loaded, its value is cached so it can be accessed synchronously via the
     * `load()` method.
     *
     * @param resolvedUrl The url (resolved by a call to `resolve()`) of the resource to preload.
     * @param context Information about the resource such as the type and containing file.
     * @returns A Promise that is resolved once the resource has been loaded or `undefined` if the
     * file has already been loaded.
     * @throws An Error if pre-loading is not available.
     */
    preload(resolvedUrl, context) {
        if (!this.adapter.readResource) {
            throw new Error('HostResourceLoader: the CompilerHost provided does not support pre-loading resources.');
        }
        if (this.cache.has(resolvedUrl)) {
            return undefined;
        }
        else if (this.fetching.has(resolvedUrl)) {
            return this.fetching.get(resolvedUrl);
        }
        let result = this.adapter.readResource(resolvedUrl);
        if (this.adapter.transformResource && context.type === 'style') {
            const resourceContext = {
                type: 'style',
                containingFile: context.containingFile,
                resourceFile: resolvedUrl,
            };
            result = Promise.resolve(result).then((str) => __awaiter(this, void 0, void 0, function* () {
                const transformResult = yield this.adapter.transformResource(str, resourceContext);
                return transformResult === null ? str : transformResult.content;
            }));
        }
        if (typeof result === 'string') {
            this.cache.set(resolvedUrl, result);
            return undefined;
        }
        else {
            const fetchCompletion = result.then(str => {
                this.fetching.delete(resolvedUrl);
                this.cache.set(resolvedUrl, str);
            });
            this.fetching.set(resolvedUrl, fetchCompletion);
            return fetchCompletion;
        }
    }
    /**
     * Preprocess the content data of an inline resource, asynchronously.
     *
     * @param data The existing content data from the inline resource.
     * @param context Information regarding the resource such as the type and containing file.
     * @returns A Promise that resolves to the processed data. If no processing occurs, the
     * same data string that was passed to the function will be resolved.
     */
    preprocessInline(data, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.adapter.transformResource || context.type !== 'style') {
                return data;
            }
            const transformResult = yield this.adapter.transformResource(data, { type: 'style', containingFile: context.containingFile, resourceFile: null });
            if (transformResult === null) {
                return data;
            }
            return transformResult.content;
        });
    }
    /**
     * Load the resource at the given url, synchronously.
     *
     * The contents of the resource may have been cached by a previous call to `preload()`.
     *
     * @param resolvedUrl The url (resolved by a call to `resolve()`) of the resource to load.
     * @returns The contents of the resource.
     */
    load(resolvedUrl) {
        if (this.cache.has(resolvedUrl)) {
            return this.cache.get(resolvedUrl);
        }
        const result = this.adapter.readResource ? this.adapter.readResource(resolvedUrl) :
            this.adapter.readFile(resolvedUrl);
        if (typeof result !== 'string') {
            throw new Error(`HostResourceLoader: loader(${resolvedUrl}) returned a Promise`);
        }
        this.cache.set(resolvedUrl, result);
        return result;
    }
    /**
     * Invalidate the entire resource cache.
     */
    invalidate() {
        this.cache.clear();
    }
    /**
     * Attempt to resolve `url` in the context of `fromFile`, while respecting the rootDirs
     * option from the tsconfig. First, normalize the file name.
     */
    fallbackResolve(url, fromFile) {
        let candidateLocations;
        if (url.startsWith('/')) {
            // This path is not really an absolute path, but instead the leading '/' means that it's
            // rooted in the project rootDirs. So look for it according to the rootDirs.
            candidateLocations = this.getRootedCandidateLocations(url);
        }
        else {
            // This path is a "relative" path and can be resolved as such. To make this easier on the
            // downstream resolver, the './' prefix is added if missing to distinguish these paths from
            // absolute node_modules paths.
            if (!url.startsWith('.')) {
                url = `./${url}`;
            }
            candidateLocations = this.getResolvedCandidateLocations(url, fromFile);
        }
        for (const candidate of candidateLocations) {
            if (this.adapter.fileExists(candidate)) {
                return candidate;
            }
            else if (CSS_PREPROCESSOR_EXT.test(candidate)) {
                /**
                 * If the user specified styleUrl points to *.scss, but the Sass compiler was run before
                 * Angular, then the resource may have been generated as *.css. Simply try the resolution
                 * again.
                 */
                const cssFallbackUrl = candidate.replace(CSS_PREPROCESSOR_EXT, '.css');
                if (this.adapter.fileExists(cssFallbackUrl)) {
                    return cssFallbackUrl;
                }
            }
        }
        return null;
    }
    getRootedCandidateLocations(url) {
        // The path already starts with '/', so add a '.' to make it relative.
        const segment = ('.' + url);
        return this.adapter.rootDirs.map(rootDir => join(rootDir, segment));
    }
    /**
     * TypeScript provides utilities to resolve module names, but not resource files (which aren't
     * a part of the ts.Program). However, TypeScript's module resolution can be used creatively
     * to locate where resource files should be expected to exist. Since module resolution returns
     * a list of file names that were considered, the loader can enumerate the possible locations
     * for the file by setting up a module resolution for it that will fail.
     */
    getResolvedCandidateLocations(url, fromFile) {
        // clang-format off
        const failedLookup = ts.resolveModuleName(url + RESOURCE_MARKER, fromFile, this.options, this.lookupResolutionHost);
        // clang-format on
        if (failedLookup.failedLookupLocations === undefined) {
            throw new Error(`Internal error: expected to find failedLookupLocations during resolution of resource '${url}' in context of ${fromFile}`);
        }
        return failedLookup.failedLookupLocations
            .filter(candidate => candidate.endsWith(RESOURCE_MARKER_TS))
            .map(candidate => candidate.slice(0, -RESOURCE_MARKER_TS.length));
    }
}
/**
 * Derives a `ts.ModuleResolutionHost` from a compiler adapter that recognizes the special resource
 * marker and does not go to the filesystem for these requests, as they are known not to exist.
 */
function createLookupResolutionHost(adapter) {
    var _a, _b, _c;
    return {
        directoryExists(directoryName) {
            if (directoryName.includes(RESOURCE_MARKER)) {
                return false;
            }
            else if (adapter.directoryExists !== undefined) {
                return adapter.directoryExists(directoryName);
            }
            else {
                // TypeScript's module resolution logic assumes that the directory exists when no host
                // implementation is available.
                return true;
            }
        },
        fileExists(fileName) {
            if (fileName.includes(RESOURCE_MARKER)) {
                return false;
            }
            else {
                return adapter.fileExists(fileName);
            }
        },
        readFile: adapter.readFile.bind(adapter),
        getCurrentDirectory: adapter.getCurrentDirectory.bind(adapter),
        getDirectories: (_a = adapter.getDirectories) === null || _a === void 0 ? void 0 : _a.bind(adapter),
        realpath: (_b = adapter.realpath) === null || _b === void 0 ? void 0 : _b.bind(adapter),
        trace: (_c = adapter.trace) === null || _c === void 0 ? void 0 : _c.bind(adapter),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9yZXNvdXJjZS9zcmMvbG9hZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUlqQyxPQUFPLEVBQWlCLElBQUksRUFBYyxNQUFNLG1CQUFtQixDQUFDO0FBR3BFLE1BQU0sb0JBQW9CLEdBQUcsZ0NBQWdDLENBQUM7QUFFOUQsTUFBTSxlQUFlLEdBQUcsZUFBZSxDQUFDO0FBQ3hDLE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxHQUFHLEtBQUssQ0FBQztBQUVuRDs7R0FFRztBQUNILE1BQU0sT0FBTyxxQkFBcUI7SUFRaEMsWUFBb0IsT0FBMEIsRUFBVSxPQUEyQjtRQUEvRCxZQUFPLEdBQVAsT0FBTyxDQUFtQjtRQUFVLFlBQU8sR0FBUCxPQUFPLENBQW9CO1FBUDNFLFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUNsQyxhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7UUFDNUMseUJBQW9CLEdBQUcsMEJBQTBCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXhFLGVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7UUFDekMsa0JBQWEsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztJQUVxQyxDQUFDO0lBRXZGOzs7Ozs7Ozs7OztPQVdHO0lBQ0gsT0FBTyxDQUFDLEdBQVcsRUFBRSxRQUFnQjtRQUNuQyxJQUFJLFdBQVcsR0FBZ0IsSUFBSSxDQUFDO1FBQ3BDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRTtZQUN2QyxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8s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RUFBRTtnQkFDdEMsT0FBTyxLQUFLLENBQUM7YUFDZDtpQkFBTTtnQkFDTCxPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDckM7UUFDSCxDQUFDO1FBQ0QsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUN4QyxtQkFBbUIsRUFBRSxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUM5RCxjQUFjLEVBQUUsTUFBQSxPQUFPLENBQUMsY0FBYywwQ0FBRSxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQ3JELFFBQVEsRUFBRSxNQUFBLE9BQU8sQ0FBQyxRQUFRLDBDQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDekMsS0FBSyxFQUFFLE1BQUEsT0FBTyxDQUFDLEtBQUssMENBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQztLQUNwQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtSZXNvdXJjZUxvYWRlciwgUmVzb3VyY2VMb2FkZXJDb250ZXh0fSBmcm9tICcuLi8uLi9hbm5vdGF0aW9ucyc7XG5pbXBvcnQge05nQ29tcGlsZXJBZGFwdGVyLCBSZXNvdXJjZUhvc3RDb250ZXh0fSBmcm9tICcuLi8uLi9jb3JlL2FwaSc7XG5pbXBvcnQge0Fic29sdXRlRnNQYXRoLCBqb2luLCBQYXRoU2VnbWVudH0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtSZXF1aXJlZERlbGVnYXRpb25zfSBmcm9tICcuLi8uLi91dGlsL3NyYy90eXBlc2NyaXB0JztcblxuY29uc3QgQ1NTX1BSRVBST0NFU1NPUl9FWFQgPSAvKFxcLnNjc3N8XFwuc2Fzc3xcXC5sZXNzfFxcLnN0eWwpJC87XG5cbmNvbnN0IFJFU09VUkNFX01BUktFUiA9ICcuJG5ncmVzb3VyY2UkJztcbmNvbnN0IFJFU09VUkNFX01BUktFUl9UUyA9IFJFU09VUkNFX01BUktFUiArICcudHMnO1xuXG4vKipcbiAqIGBSZXNvdXJjZUxvYWRlcmAgd2hpY2ggZGVsZWdhdGVzIHRvIGFuIGBOZ0NvbXBpbGVyQWRhcHRlcmAncyByZXNvdXJjZSBsb2FkaW5nIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBBZGFwdGVyUmVzb3VyY2VMb2FkZXIgaW1wbGVtZW50cyBSZXNvdXJjZUxvYWRlciB7XG4gIHByaXZhdGUgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBwcml2YXRlIGZldGNoaW5nID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8dm9pZD4+KCk7XG4gIHByaXZhdGUgbG9va3VwUmVzb2x1dGlvbkhvc3QgPSBjcmVhdGVMb29rdXBSZXNvbHV0aW9uSG9zdCh0aGlzLmFkYXB0ZXIpO1xuXG4gIGNhblByZWxvYWQgPSAhIXRoaXMuYWRhcHRlci5yZWFkUmVzb3VyY2U7XG4gIGNhblByZXByb2Nlc3MgPSAhIXRoaXMuYWRhcHRlci50cmFuc2Zvcm1SZXNvdXJjZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFkYXB0ZXI6IE5nQ29tcGlsZXJBZGFwdGVyLCBwcml2YXRlIG9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucykge31cblxuICAvKipcbiAgICogUmVzb2x2ZSB0aGUgdXJsIG9mIGEgcmVzb3VyY2UgcmVsYXRpdmUgdG8gdGhlIGZpbGUgdGhhdCBjb250YWlucyB0aGUgcmVmZXJlbmNlIHRvIGl0LlxuICAgKiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgbWV0aG9kIGNhbiBiZSB1c2VkIGluIHRoZSBgbG9hZCgpYCBhbmQgYHByZWxvYWQoKWAgbWV0aG9kcy5cbiAgICpcbiAgICogVXNlcyB0aGUgcHJvdmlkZWQgQ29tcGlsZXJIb3N0IGlmIGl0IHN1cHBvcnRzIG1hcHBpbmcgcmVzb3VyY2VzIHRvIGZpbGVuYW1lcy5cbiAgICogT3RoZXJ3aXNlLCB1c2VzIGEgZmFsbGJhY2sgbWVjaGFuaXNtIHRoYXQgc2VhcmNoZXMgdGhlIG1vZHVsZSByZXNvbHV0aW9uIGNhbmRpZGF0ZXMuXG4gICAqXG4gICAqIEBwYXJhbSB1cmwgVGhlLCBwb3NzaWJseSByZWxhdGl2ZSwgdXJsIG9mIHRoZSByZXNvdXJjZS5cbiAgICogQHBhcmFtIGZyb21GaWxlIFRoZSBwYXRoIHRvIHRoZSBmaWxlIHRoYXQgY29udGFpbnMgdGhlIFVSTCBvZiB0aGUgcmVzb3VyY2UuXG4gICAqIEByZXR1cm5zIEEgcmVzb2x2ZWQgdXJsIG9mIHJlc291cmNlLlxuICAgKiBAdGhyb3dzIEFuIGVycm9yIGlmIHRoZSByZXNvdXJjZSBjYW5ub3QgYmUgcmVzb2x2ZWQuXG4gICAqL1xuICByZXNvbHZlKHVybDogc3RyaW5nLCBmcm9tRmlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgcmVzb2x2ZWRVcmw6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5hZGFwdGVyLnJlc291cmNlTmFtZVRvRmlsZU5hbWUpIHtcbiAgICAgIHJlc29sdmVkVXJsID0gdGhpcy5hZGFwdGVyLnJlc291cmNlTmFtZVRvRmlsZU5hbWUoXG4gICAgICAgICAgdXJsLCBmcm9tRmlsZSwgKHVybDogc3RyaW5nLCBmcm9tRmlsZTogc3RyaW5nKSA9PiB0aGlzLmZhbGxiYWNrUmVzb2x2ZSh1cmwsIGZyb21GaWxlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc29sdmVkVXJsID0gdGhpcy5mYWxsYmFja1Jlc29sdmUodXJsLCBmcm9tRmlsZSk7XG4gICAgfVxuICAgIGlmIChyZXNvbHZlZFVybCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIb3N0UmVzb3VyY2VSZXNvbHZlcjogY291bGQgbm90IHJlc29sdmUgJHt1cmx9IGluIGNvbnRleHQgb2YgJHtmcm9tRmlsZX0pYCk7XG4gICAgfVxuICAgIHJldHVybiByZXNvbHZlZFVybDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVsb2FkIHRoZSBzcGVjaWZpZWQgcmVzb3VyY2UsIGFzeW5jaHJvbm91c2x5LlxuICAgKlxuICAgKiBPbmNlIHRoZSByZXNvdXJjZSBpcyBsb2FkZWQsIGl0cyB2YWx1ZSBpcyBjYWNoZWQgc28gaXQgY2FuIGJlIGFjY2Vzc2VkIHN5bmNocm9ub3VzbHkgdmlhIHRoZVxuICAgKiBgbG9hZCgpYCBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSByZXNvbHZlZFVybCBUaGUgdXJsIChyZXNvbHZlZCBieSBhIGNhbGwgdG8gYHJlc29sdmUoKWApIG9mIHRoZSByZXNvdXJjZSB0byBwcmVsb2FkLlxuICAgKiBAcGFyYW0gY29udGV4dCBJbmZvcm1hdGlvbiBhYm91dCB0aGUgcmVzb3VyY2Ugc3VjaCBhcyB0aGUgdHlwZSBhbmQgY29udGFpbmluZyBmaWxlLlxuICAgKiBAcmV0dXJucyBBIFByb21pc2UgdGhhdCBpcyByZXNvbHZlZCBvbmNlIHRoZSByZXNvdXJjZSBoYXMgYmVlbiBsb2FkZWQgb3IgYHVuZGVmaW5lZGAgaWYgdGhlXG4gICAqIGZpbGUgaGFzIGFscmVhZHkgYmVlbiBsb2FkZWQuXG4gICAqIEB0aHJvd3MgQW4gRXJyb3IgaWYgcHJlLWxvYWRpbmcgaXMgbm90IGF2YWlsYWJsZS5cbiAgICovXG4gIHByZWxvYWQocmVzb2x2ZWRVcmw6IHN0cmluZywgY29udGV4dDogUmVzb3VyY2VMb2FkZXJDb250ZXh0KTogUHJvbWlzZTx2b2lkPnx1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5hZGFwdGVyLnJlYWRSZXNvdXJjZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdIb3N0UmVzb3VyY2VMb2FkZXI6IHRoZSBDb21waWxlckhvc3QgcHJvdmlkZWQgZG9lcyBub3Qgc3VwcG9ydCBwcmUtbG9hZGluZyByZXNvdXJjZXMuJyk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNhY2hlLmhhcyhyZXNvbHZlZFVybCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIGlmICh0aGlzLmZldGNoaW5nLmhhcyhyZXNvbHZlZFVybCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmZldGNoaW5nLmdldChyZXNvbHZlZFVybCk7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMuYWRhcHRlci5yZWFkUmVzb3VyY2UocmVzb2x2ZWRVcmwpO1xuXG4gICAgaWYgKHRoaXMuYWRhcHRlci50cmFuc2Zvcm1SZXNvdXJjZSAmJiBjb250ZXh0LnR5cGUgPT09ICdzdHlsZScpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlQ29udGV4dDogUmVzb3VyY2VIb3N0Q29udGV4dCA9IHtcbiAgICAgICAgdHlwZTogJ3N0eWxlJyxcbiAgICAgICAgY29udGFpbmluZ0ZpbGU6IGNvbnRleHQuY29udGFpbmluZ0ZpbGUsXG4gICAgICAgIHJlc291cmNlRmlsZTogcmVzb2x2ZWRVcmwsXG4gICAgICB9O1xuICAgICAgcmVzdWx0ID0gUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkudGhlbihhc3luYyAoc3RyKSA9PiB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybVJlc3VsdCA9IGF3YWl0IHRoaXMuYWRhcHRlci50cmFuc2Zvcm1SZXNvdXJjZSEoc3RyLCByZXNvdXJjZUNvbnRleHQpO1xuICAgICAgICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0ID09PSBudWxsID8gc3RyIDogdHJhbnNmb3JtUmVzdWx0LmNvbnRlbnQ7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuY2FjaGUuc2V0KHJlc29sdmVkVXJsLCByZXN1bHQpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZmV0Y2hDb21wbGV0aW9uID0gcmVzdWx0LnRoZW4oc3RyID0+IHtcbiAgICAgICAgdGhpcy5mZXRjaGluZy5kZWxldGUocmVzb2x2ZWRVcmwpO1xuICAgICAgICB0aGlzLmNhY2hlLnNldChyZXNvbHZlZFVybCwgc3RyKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5mZXRjaGluZy5zZXQocmVzb2x2ZWRVcmwsIGZldGNoQ29tcGxldGlvbik7XG4gICAgICByZXR1cm4gZmV0Y2hDb21wbGV0aW9uO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwcm9jZXNzIHRoZSBjb250ZW50IGRhdGEgb2YgYW4gaW5saW5lIHJlc291cmNlLCBhc3luY2hyb25vdXNseS5cbiAgICpcbiAgICogQHBhcmFtIGRhdGEgVGhlIGV4aXN0aW5nIGNvbnRlbnQgZGF0YSBmcm9tIHRoZSBpbmxpbmUgcmVzb3VyY2UuXG4gICAqIEBwYXJhbSBjb250ZXh0IEluZm9ybWF0aW9uIHJlZ2FyZGluZyB0aGUgcmVzb3VyY2Ugc3VjaCBhcyB0aGUgdHlwZSBhbmQgY29udGFpbmluZyBmaWxlLlxuICAgKiBAcmV0dXJucyBBIFByb21pc2UgdGhhdCByZXNvbHZlcyB0byB0aGUgcHJvY2Vzc2VkIGRhdGEuIElmIG5vIHByb2Nlc3Npbmcgb2NjdXJzLCB0aGVcbiAgICogc2FtZSBkYXRhIHN0cmluZyB0aGF0IHdhcyBwYXNzZWQgdG8gdGhlIGZ1bmN0aW9uIHdpbGwgYmUgcmVzb2x2ZWQuXG4gICAqL1xuICBhc3luYyBwcmVwcm9jZXNzSW5saW5lKGRhdGE6IHN0cmluZywgY29udGV4dDogUmVzb3VyY2VMb2FkZXJDb250ZXh0KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBpZiAoIXRoaXMuYWRhcHRlci50cmFuc2Zvcm1SZXNvdXJjZSB8fCBjb250ZXh0LnR5cGUgIT09ICdzdHlsZScpIHtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IHRyYW5zZm9ybVJlc3VsdCA9IGF3YWl0IHRoaXMuYWRhcHRlci50cmFuc2Zvcm1SZXNvdXJjZShcbiAgICAgICAgZGF0YSwge3R5cGU6ICdzdHlsZScsIGNvbnRhaW5pbmdGaWxlOiBjb250ZXh0LmNvbnRhaW5pbmdGaWxlLCByZXNvdXJjZUZpbGU6IG51bGx9KTtcbiAgICBpZiAodHJhbnNmb3JtUmVzdWx0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0LmNvbnRlbnQ7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCB0aGUgcmVzb3VyY2UgYXQgdGhlIGdpdmVuIHVybCwgc3luY2hyb25vdXNseS5cbiAgICpcbiAgICogVGhlIGNvbnRlbnRzIG9mIHRoZSByZXNvdXJjZSBtYXkgaGF2ZSBiZWVuIGNhY2hlZCBieSBhIHByZXZpb3VzIGNhbGwgdG8gYHByZWxvYWQoKWAuXG4gICAqXG4gICAqIEBwYXJhbSByZXNvbHZlZFVybCBUaGUgdXJsIChyZXNvbHZlZCBieSBhIGNhbGwgdG8gYHJlc29sdmUoKWApIG9mIHRoZSByZXNvdXJjZSB0byBsb2FkLlxuICAgKiBAcmV0dXJucyBUaGUgY29udGVudHMgb2YgdGhlIHJlc291cmNlLlxuICAgKi9cbiAgbG9hZChyZXNvbHZlZFVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5jYWNoZS5oYXMocmVzb2x2ZWRVcmwpKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWNoZS5nZXQocmVzb2x2ZWRVcmwpITtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLmFkYXB0ZXIucmVhZFJlc291cmNlID8gdGhpcy5hZGFwdGVyLnJlYWRSZXNvdXJjZShyZXNvbHZlZFVybCkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkYXB0ZXIucmVhZEZpbGUocmVzb2x2ZWRVcmwpO1xuICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIb3N0UmVzb3VyY2VMb2FkZXI6IGxvYWRlcigke3Jlc29sdmVkVXJsfSkgcmV0dXJuZWQgYSBQcm9taXNlYCk7XG4gICAgfVxuICAgIHRoaXMuY2FjaGUuc2V0KHJlc29sdmVkVXJsLCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogSW52YWxpZGF0ZSB0aGUgZW50aXJlIHJlc291cmNlIGNhY2hlLlxuICAgKi9cbiAgaW52YWxpZGF0ZSgpOiB2b2lkIHtcbiAgICB0aGlzLmNhY2hlLmNsZWFyKCk7XG4gIH1cblxuICAvKipcbiAgICogQXR0ZW1wdCB0byByZXNvbHZlIGB1cmxgIGluIHRoZSBjb250ZXh0IG9mIGBmcm9tRmlsZWAsIHdoaWxlIHJlc3BlY3RpbmcgdGhlIHJvb3REaXJzXG4gICAqIG9wdGlvbiBmcm9tIHRoZSB0c2NvbmZpZy4gRmlyc3QsIG5vcm1hbGl6ZSB0aGUgZmlsZSBuYW1lLlxuICAgKi9cbiAgcHJpdmF0ZSBmYWxsYmFja1Jlc29sdmUodXJsOiBzdHJpbmcsIGZyb21GaWxlOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gICAgbGV0IGNhbmRpZGF0ZUxvY2F0aW9uczogc3RyaW5nW107XG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIC8vIFRoaXMgcGF0aCBpcyBub3QgcmVhbGx5IGFuIGFic29sdXRlIHBhdGgsIGJ1dCBpbnN0ZWFkIHRoZSBsZWFkaW5nICcvJyBtZWFucyB0aGF0IGl0J3NcbiAgICAgIC8vIHJvb3RlZCBpbiB0aGUgcHJvamVjdCByb290RGlycy4gU28gbG9vayBmb3IgaXQgYWNjb3JkaW5nIHRvIHRoZSByb290RGlycy5cbiAgICAgIGNhbmRpZGF0ZUxvY2F0aW9ucyA9IHRoaXMuZ2V0Um9vdGVkQ2FuZGlkYXRlTG9jYXRpb25zKHVybCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoaXMgcGF0aCBpcyBhIFwicmVsYXRpdmVcIiBwYXRoIGFuZCBjYW4gYmUgcmVzb2x2ZWQgYXMgc3VjaC4gVG8gbWFrZSB0aGlzIGVhc2llciBvbiB0aGVcbiAgICAgIC8vIGRvd25zdHJlYW0gcmVzb2x2ZXIsIHRoZSAnLi8nIHByZWZpeCBpcyBhZGRlZCBpZiBtaXNzaW5nIHRvIGRpc3Rpbmd1aXNoIHRoZXNlIHBhdGhzIGZyb21cbiAgICAgIC8vIGFic29sdXRlIG5vZGVfbW9kdWxlcyBwYXRocy5cbiAgICAgIGlmICghdXJsLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICB1cmwgPSBgLi8ke3VybH1gO1xuICAgICAgfVxuICAgICAgY2FuZGlkYXRlTG9jYXRpb25zID0gdGhpcy5nZXRSZXNvbHZlZENhbmRpZGF0ZUxvY2F0aW9ucyh1cmwsIGZyb21GaWxlKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBjYW5kaWRhdGVMb2NhdGlvbnMpIHtcbiAgICAgIGlmICh0aGlzLmFkYXB0ZXIuZmlsZUV4aXN0cyhjYW5kaWRhdGUpKSB7XG4gICAgICAgIHJldHVybiBjYW5kaWRhdGU7XG4gICAgICB9IGVsc2UgaWYgKENTU19QUkVQUk9DRVNTT1JfRVhULnRlc3QoY2FuZGlkYXRlKSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogSWYgdGhlIHVzZXIgc3BlY2lmaWVkIHN0eWxlVXJsIHBvaW50cyB0byAqLnNjc3MsIGJ1dCB0aGUgU2FzcyBjb21waWxlciB3YXMgcnVuIGJlZm9yZVxuICAgICAgICAgKiBBbmd1bGFyLCB0aGVuIHRoZSByZXNvdXJjZSBtYXkgaGF2ZSBiZWVuIGdlbmVyYXRlZCBhcyAqLmNzcy4gU2ltcGx5IHRyeSB0aGUgcmVzb2x1dGlvblxuICAgICAgICAgKiBhZ2Fpbi5cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0IGNzc0ZhbGxiYWNrVXJsID0gY2FuZGlkYXRlLnJlcGxhY2UoQ1NTX1BSRVBST0NFU1NPUl9FWFQsICcuY3NzJyk7XG4gICAgICAgIGlmICh0aGlzLmFkYXB0ZXIuZmlsZUV4aXN0cyhjc3NGYWxsYmFja1VybCkpIHtcbiAgICAgICAgICByZXR1cm4gY3NzRmFsbGJhY2tVcmw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGdldFJvb3RlZENhbmRpZGF0ZUxvY2F0aW9ucyh1cmw6IHN0cmluZyk6IEFic29sdXRlRnNQYXRoW10ge1xuICAgIC8vIFRoZSBwYXRoIGFscmVhZHkgc3RhcnRzIHdpdGggJy8nLCBzbyBhZGQgYSAnLicgdG8gbWFrZSBpdCByZWxhdGl2ZS5cbiAgICBjb25zdCBzZWdtZW50OiBQYXRoU2VnbWVudCA9ICgnLicgKyB1cmwpIGFzIFBhdGhTZWdtZW50O1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIucm9vdERpcnMubWFwKHJvb3REaXIgPT4gam9pbihyb290RGlyLCBzZWdtZW50KSk7XG4gIH1cblxuICAvKipcbiAgICogVHlwZVNjcmlwdCBwcm92aWRlcyB1dGlsaXRpZXMgdG8gcmVzb2x2ZSBtb2R1bGUgbmFtZXMsIGJ1dCBub3QgcmVzb3VyY2UgZmlsZXMgKHdoaWNoIGFyZW4ndFxuICAgKiBhIHBhcnQgb2YgdGhlIHRzLlByb2dyYW0pLiBIb3dldmVyLCBUeXBlU2NyaXB0J3MgbW9kdWxlIHJlc29sdXRpb24gY2FuIGJlIHVzZWQgY3JlYXRpdmVseVxuICAgKiB0byBsb2NhdGUgd2hlcmUgcmVzb3VyY2UgZmlsZXMgc2hvdWxkIGJlIGV4cGVjdGVkIHRvIGV4aXN0LiBTaW5jZSBtb2R1bGUgcmVzb2x1dGlvbiByZXR1cm5zXG4gICAqIGEgbGlzdCBvZiBmaWxlIG5hbWVzIHRoYXQgd2VyZSBjb25zaWRlcmVkLCB0aGUgbG9hZGVyIGNhbiBlbnVtZXJhdGUgdGhlIHBvc3NpYmxlIGxvY2F0aW9uc1xuICAgKiBmb3IgdGhlIGZpbGUgYnkgc2V0dGluZyB1cCBhIG1vZHVsZSByZXNvbHV0aW9uIGZvciBpdCB0aGF0IHdpbGwgZmFpbC5cbiAgICovXG4gIHByaXZhdGUgZ2V0UmVzb2x2ZWRDYW5kaWRhdGVMb2NhdGlvbnModXJsOiBzdHJpbmcsIGZyb21GaWxlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgLy8gYGZhaWxlZExvb2t1cExvY2F0aW9uc2AgaXMgaW4gdGhlIG5hbWUgb2YgdGhlIHR5cGUgdHMuUmVzb2x2ZWRNb2R1bGVXaXRoRmFpbGVkTG9va3VwTG9jYXRpb25zXG4gICAgLy8gYnV0IGlzIG1hcmtlZCBAaW50ZXJuYWwgaW4gVHlwZVNjcmlwdC4gU2VlXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8yODc3MC5cbiAgICB0eXBlIFJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyA9XG4gICAgICAgIHRzLlJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyZ7ZmFpbGVkTG9va3VwTG9jYXRpb25zOiBSZWFkb25seUFycmF5PHN0cmluZz59O1xuXG4gICAgLy8gY2xhbmctZm9ybWF0IG9mZlxuICAgIGNvbnN0IGZhaWxlZExvb2t1cCA9IHRzLnJlc29sdmVNb2R1bGVOYW1lKHVybCArIFJFU09VUkNFX01BUktFUiwgZnJvbUZpbGUsIHRoaXMub3B0aW9ucywgdGhpcy5sb29rdXBSZXNvbHV0aW9uSG9zdCkgYXMgUmVzb2x2ZWRNb2R1bGVXaXRoRmFpbGVkTG9va3VwTG9jYXRpb25zO1xuICAgIC8vIGNsYW5nLWZvcm1hdCBvblxuICAgIGlmIChmYWlsZWRMb29rdXAuZmFpbGVkTG9va3VwTG9jYXRpb25zID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgSW50ZXJuYWwgZXJyb3I6IGV4cGVjdGVkIHRvIGZpbmQgZmFpbGVkTG9va3VwTG9jYXRpb25zIGR1cmluZyByZXNvbHV0aW9uIG9mIHJlc291cmNlICcke1xuICAgICAgICAgICAgICB1cmx9JyBpbiBjb250ZXh0IG9mICR7ZnJvbUZpbGV9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhaWxlZExvb2t1cC5mYWlsZWRMb29rdXBMb2NhdGlvbnNcbiAgICAgICAgLmZpbHRlcihjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmVuZHNXaXRoKFJFU09VUkNFX01BUktFUl9UUykpXG4gICAgICAgIC5tYXAoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5zbGljZSgwLCAtUkVTT1VSQ0VfTUFSS0VSX1RTLmxlbmd0aCkpO1xuICB9XG59XG5cbi8qKlxuICogRGVyaXZlcyBhIGB0cy5Nb2R1bGVSZXNvbHV0aW9uSG9zdGAgZnJvbSBhIGNvbXBpbGVyIGFkYXB0ZXIgdGhhdCByZWNvZ25pemVzIHRoZSBzcGVjaWFsIHJlc291cmNlXG4gKiBtYXJrZXIgYW5kIGRvZXMgbm90IGdvIHRvIHRoZSBmaWxlc3lzdGVtIGZvciB0aGVzZSByZXF1ZXN0cywgYXMgdGhleSBhcmUga25vd24gbm90IHRvIGV4aXN0LlxuICovXG5mdW5jdGlvbiBjcmVhdGVMb29rdXBSZXNvbHV0aW9uSG9zdChhZGFwdGVyOiBOZ0NvbXBpbGVyQWRhcHRlcik6XG4gICAgUmVxdWlyZWREZWxlZ2F0aW9uczx0cy5Nb2R1bGVSZXNvbHV0aW9uSG9zdD4ge1xuICByZXR1cm4ge1xuICAgIGRpcmVjdG9yeUV4aXN0cyhkaXJlY3RvcnlOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgIGlmIChkaXJlY3RvcnlOYW1lLmluY2x1ZGVzKFJFU09VUkNFX01BUktFUikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChhZGFwdGVyLmRpcmVjdG9yeUV4aXN0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBhZGFwdGVyLmRpcmVjdG9yeUV4aXN0cyhkaXJlY3RvcnlOYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFR5cGVTY3JpcHQncyBtb2R1bGUgcmVzb2x1dGlvbiBsb2dpYyBhc3N1bWVzIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgd2hlbiBubyBob3N0XG4gICAgICAgIC8vIGltcGxlbWVudGF0aW9uIGlzIGF2YWlsYWJsZS5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSxcbiAgICBmaWxlRXhpc3RzKGZpbGVOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcyhSRVNPVVJDRV9NQVJLRVIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBhZGFwdGVyLmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcmVhZEZpbGU6IGFkYXB0ZXIucmVhZEZpbGUuYmluZChhZGFwdGVyKSxcbiAgICBnZXRDdXJyZW50RGlyZWN0b3J5OiBhZGFwdGVyLmdldEN1cnJlbnREaXJlY3RvcnkuYmluZChhZGFwdGVyKSxcbiAgICBnZXREaXJlY3RvcmllczogYWRhcHRlci5nZXREaXJlY3Rvcmllcz8uYmluZChhZGFwdGVyKSxcbiAgICByZWFscGF0aDogYWRhcHRlci5yZWFscGF0aD8uYmluZChhZGFwdGVyKSxcbiAgICB0cmFjZTogYWRhcHRlci50cmFjZT8uYmluZChhZGFwdGVyKSxcbiAgfTtcbn1cbiJdfQ==