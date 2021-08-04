/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as path from 'path';
import * as ts from 'typescript';
import { CompilerHostAdapter, MetadataBundler } from './bundler';
import { privateEntriesToIndex } from './index_writer';
const DTS = /\.d\.ts$/;
const JS_EXT = /(\.js|)$/;
function createSyntheticIndexHost(delegate, syntheticIndex) {
    const normalSyntheticIndexName = path.normalize(syntheticIndex.name);
    const newHost = Object.create(delegate);
    newHost.fileExists = (fileName) => {
        return path.normalize(fileName) == normalSyntheticIndexName || delegate.fileExists(fileName);
    };
    newHost.readFile = (fileName) => {
        return path.normalize(fileName) == normalSyntheticIndexName ? syntheticIndex.content :
            delegate.readFile(fileName);
    };
    newHost.getSourceFile =
        (fileName, languageVersion, onError) => {
            if (path.normalize(fileName) == normalSyntheticIndexName) {
                const sf = ts.createSourceFile(fileName, syntheticIndex.content, languageVersion, true);
                if (delegate.fileNameToModuleName) {
                    sf.moduleName = delegate.fileNameToModuleName(fileName);
                }
                return sf;
            }
            return delegate.getSourceFile(fileName, languageVersion, onError);
        };
    newHost.writeFile =
        (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
            delegate.writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles);
            if (fileName.match(DTS) && sourceFiles && sourceFiles.length == 1 &&
                path.normalize(sourceFiles[0].fileName) === normalSyntheticIndexName) {
                // If we are writing the synthetic index, write the metadata along side.
                const metadataName = fileName.replace(DTS, '.metadata.json');
                const indexMetadata = syntheticIndex.getMetadata();
                delegate.writeFile(metadataName, indexMetadata, writeByteOrderMark, onError, []);
            }
        };
    return newHost;
}
export function createBundleIndexHost(ngOptions, rootFiles, host, getMetadataCache) {
    const files = rootFiles.filter(f => !DTS.test(f));
    let indexFile;
    if (files.length === 1) {
        indexFile = files[0];
    }
    else {
        for (const f of files) {
            // Assume the shortest file path called index.ts is the entry point. Note that we
            // need to use the posix path delimiter here because TypeScript internally only
            // passes posix paths.
            if (f.endsWith('/index.ts')) {
                if (!indexFile || indexFile.length > f.length) {
                    indexFile = f;
                }
            }
        }
    }
    if (!indexFile) {
        return {
            host,
            errors: [{
                    file: null,
                    start: null,
                    length: null,
                    messageText: 'Angular compiler option "flatModuleIndex" requires one and only one .ts file in the "files" field.',
                    category: ts.DiagnosticCategory.Error,
                    code: 0
                }]
        };
    }
    const indexModule = indexFile.replace(/\.ts$/, '');
    // The operation of producing a metadata bundle happens twice - once during setup and once during
    // the emit phase. The first time, the bundle is produced without a metadata cache, to compute the
    // contents of the flat module index. The bundle produced during emit does use the metadata cache
    // with associated transforms, so the metadata will have lowered expressions, resource inlining,
    // etc.
    const getMetadataBundle = (cache) => {
        const bundler = new MetadataBundler(indexModule, ngOptions.flatModuleId, new CompilerHostAdapter(host, cache, ngOptions), ngOptions.flatModulePrivateSymbolPrefix);
        return bundler.getMetadataBundle();
    };
    // First, produce the bundle with no MetadataCache.
    const metadataBundle = getMetadataBundle(/* MetadataCache */ null);
    const name = path.join(path.dirname(indexModule), ngOptions.flatModuleOutFile.replace(JS_EXT, '.ts'));
    const libraryIndex = `./${path.basename(indexModule)}`;
    const content = privateEntriesToIndex(libraryIndex, metadataBundle.privates);
    host = createSyntheticIndexHost(host, {
        name,
        content,
        getMetadata: () => {
            // The second metadata bundle production happens on-demand, and uses the getMetadataCache
            // closure to retrieve an up-to-date MetadataCache which is configured with whatever metadata
            // transforms were used to produce the JS output.
            const metadataBundle = getMetadataBundle(getMetadataCache());
            return JSON.stringify(metadataBundle.metadata);
        }
    });
    return { host, indexName: name };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlX2luZGV4X2hvc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL21ldGFkYXRhL2J1bmRsZV9pbmRleF9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBS2pDLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxlQUFlLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0QsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFckQsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDO0FBQ3ZCLE1BQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQztBQUUxQixTQUFTLHdCQUF3QixDQUM3QixRQUFXLEVBQUUsY0FBMEU7SUFDekYsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVyRSxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxRQUFnQixFQUFXLEVBQUU7UUFDakQsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLHdCQUF3QixJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0YsQ0FBQyxDQUFDO0lBRUYsT0FBTyxDQUFDLFFBQVEsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtRQUN0QyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksd0JBQXdCLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN4QixRQUFRLENBQUMsUUFBUSxD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QWMsR0FBRyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7WUFDN0QsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxFQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFDLENBQUM7QUFDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Q29tcGlsZXJPcHRpb25zfSBmcm9tICcuLi90cmFuc2Zvcm1lcnMvYXBpJztcbmltcG9ydCB7TWV0YWRhdGFDYWNoZX0gZnJvbSAnLi4vdHJhbnNmb3JtZXJzL21ldGFkYXRhX2NhY2hlJztcblxuaW1wb3J0IHtDb21waWxlckhvc3RBZGFwdGVyLCBNZXRhZGF0YUJ1bmRsZXJ9IGZyb20gJy4vYnVuZGxlcic7XG5pbXBvcnQge3ByaXZhdGVFbnRyaWVzVG9JbmRleH0gZnJvbSAnLi9pbmRleF93cml0ZXInO1xuXG5jb25zdCBEVFMgPSAvXFwuZFxcLnRzJC87XG5jb25zdCBKU19FWFQgPSAvKFxcLmpzfCkkLztcblxuZnVuY3Rpb24gY3JlYXRlU3ludGhldGljSW5kZXhIb3N0PEggZXh0ZW5kcyB0cy5Db21waWxlckhvc3Q+KFxuICAgIGRlbGVnYXRlOiBILCBzeW50aGV0aWNJbmRleDoge25hbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCBnZXRNZXRhZGF0YTogKCkgPT4gc3RyaW5nfSk6IEgge1xuICBjb25zdCBub3JtYWxTeW50aGV0aWNJbmRleE5hbWUgPSBwYXRoLm5vcm1hbGl6ZShzeW50aGV0aWNJbmRleC5uYW1lKTtcblxuICBjb25zdCBuZXdIb3N0ID0gT2JqZWN0LmNyZWF0ZShkZWxlZ2F0ZSk7XG4gIG5ld0hvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKTogYm9vbGVhbiA9PiB7XG4gICAgcmV0dXJuIHBhdGgubm9ybWFsaXplKGZpbGVOYW1lKSA9PSBub3JtYWxTeW50aGV0aWNJbmRleE5hbWUgfHwgZGVsZWdhdGUuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gIH07XG5cbiAgbmV3SG9zdC5yZWFkRmlsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHBhdGgubm9ybWFsaXplKGZpbGVOYW1lKSA9PSBub3JtYWxTeW50aGV0aWNJbmRleE5hbWUgPyBzeW50aGV0aWNJbmRleC5jb250ZW50IDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGVnYXRlLnJlYWRGaWxlKGZpbGVOYW1lKTtcbiAgfTtcblxuICBuZXdIb3N0LmdldFNvdXJjZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGxhbmd1YWdlVmVyc2lvbjogdHMuU2NyaXB0VGFyZ2V0LCBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCkgPT4ge1xuICAgICAgICBpZiAocGF0aC5ub3JtYWxpemUoZmlsZU5hbWUpID09IG5vcm1hbFN5bnRoZXRpY0luZGV4TmFtZSkge1xuICAgICAgICAgIGNvbnN0IHNmID0gdHMuY3JlYXRlU291cmNlRmlsZShmaWxlTmFtZSwgc3ludGhldGljSW5kZXguY29udGVudCwgbGFuZ3VhZ2VWZXJzaW9uLCB0cnVlKTtcbiAgICAgICAgICBpZiAoKGRlbGVnYXRlIGFzIGFueSkuZmlsZU5hbWVUb01vZHVsZU5hbWUpIHtcbiAgICAgICAgICAgIHNmLm1vZHVsZU5hbWUgPSAoZGVsZWdhdGUgYXMgYW55KS5maWxlTmFtZVRvTW9kdWxlTmFtZShmaWxlTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBzZjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVsZWdhdGUuZ2V0U291cmNlRmlsZShmaWxlTmFtZSwgbGFuZ3VhZ2VWZXJzaW9uLCBvbkVycm9yKTtcbiAgICAgIH07XG5cbiAgbmV3SG9zdC53cml0ZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGRhdGE6IHN0cmluZywgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgICAgIG9uRXJyb3I6ICgobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkKXx1bmRlZmluZWQsIHNvdXJjZUZpbGVzOiBSZWFkb25seTx0cy5Tb3VyY2VGaWxlPltdKSA9PiB7XG4gICAgICAgIGRlbGVnYXRlLndyaXRlRmlsZShmaWxlTmFtZSwgZGF0YSwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICAgIGlmIChmaWxlTmFtZS5tYXRjaChEVFMpICYmIHNvdXJjZUZpbGVzICYmIHNvdXJjZUZpbGVzLmxlbmd0aCA9PSAxICYmXG4gICAgICAgICAgICBwYXRoLm5vcm1hbGl6ZShzb3VyY2VGaWxlc1swXS5maWxlTmFtZSkgPT09IG5vcm1hbFN5bnRoZXRpY0luZGV4TmFtZSkge1xuICAgICAgICAgIC8vIElmIHdlIGFyZSB3cml0aW5nIHRoZSBzeW50aGV0aWMgaW5kZXgsIHdyaXRlIHRoZSBtZXRhZGF0YSBhbG9uZyBzaWRlLlxuICAgICAgICAgIGNvbnN0IG1ldGFkYXRhTmFtZSA9IGZpbGVOYW1lLnJlcGxhY2UoRFRTLCAnLm1ldGFkYXRhLmpzb24nKTtcbiAgICAgICAgICBjb25zdCBpbmRleE1ldGFkYXRhID0gc3ludGhldGljSW5kZXguZ2V0TWV0YWRhdGEoKTtcbiAgICAgICAgICBkZWxlZ2F0ZS53cml0ZUZpbGUobWV0YWRhdGFOYW1lLCBpbmRleE1ldGFkYXRhLCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIFtdKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgcmV0dXJuIG5ld0hvc3Q7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCdW5kbGVJbmRleEhvc3Q8SCBleHRlbmRzIHRzLkNvbXBpbGVySG9zdD4oXG4gICAgbmdPcHRpb25zOiBDb21waWxlck9wdGlvbnMsIHJvb3RGaWxlczogUmVhZG9ubHlBcnJheTxzdHJpbmc+LCBob3N0OiBILFxuICAgIGdldE1ldGFkYXRhQ2FjaGU6ICgpID0+XG4gICAgICAgIE1ldGFkYXRhQ2FjaGUpOiB7aG9zdDogSCwgaW5kZXhOYW1lPzogc3RyaW5nLCBlcnJvcnM/OiB0cy5EaWFnbm9zdGljW119IHtcbiAgY29uc3QgZmlsZXMgPSByb290RmlsZXMuZmlsdGVyKGYgPT4gIURUUy50ZXN0KGYpKTtcbiAgbGV0IGluZGV4RmlsZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMSkge1xuICAgIGluZGV4RmlsZSA9IGZpbGVzWzBdO1xuICB9IGVsc2Uge1xuICAgIGZvciAoY29uc3QgZiBvZiBmaWxlcykge1xuICAgICAgLy8gQXNzdW1lIHRoZSBzaG9ydGVzdCBmaWxlIHBhdGggY2FsbGVkIGluZGV4LnRzIGlzIHRoZSBlbnRyeSBwb2ludC4gTm90ZSB0aGF0IHdlXG4gICAgICAvLyBuZWVkIHRvIHVzZSB0aGUgcG9zaXggcGF0aCBkZWxpbWl0ZXIgaGVyZSBiZWNhdXNlIFR5cGVTY3JpcHQgaW50ZXJuYWxseSBvbmx5XG4gICAgICAvLyBwYXNzZXMgcG9zaXggcGF0aHMuXG4gICAgICBpZiAoZi5lbmRzV2l0aCgnL2luZGV4LnRzJykpIHtcbiAgICAgICAgaWYgKCFpbmRleEZpbGUgfHwgaW5kZXhGaWxlLmxlbmd0aCA+IGYubGVuZ3RoKSB7XG4gICAgICAgICAgaW5kZXhGaWxlID0gZjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAoIWluZGV4RmlsZSkge1xuICAgIHJldHVybiB7XG4gICAgICBob3N0LFxuICAgICAgZXJyb3JzOiBbe1xuICAgICAgICBmaWxlOiBudWxsIGFzIGFueSBhcyB0cy5Tb3VyY2VGaWxlLFxuICAgICAgICBzdGFydDogbnVsbCBhcyBhbnkgYXMgbnVtYmVyLFxuICAgICAgICBsZW5ndGg6IG51bGwgYXMgYW55IGFzIG51bWJlcixcbiAgICAgICAgbWVzc2FnZVRleHQ6XG4gICAgICAgICAgICAnQW5ndWxhciBjb21waWxlciBvcHRpb24gXCJmbGF0TW9kdWxlSW5kZXhcIiByZXF1aXJlcyBvbmUgYW5kIG9ubHkgb25lIC50cyBmaWxlIGluIHRoZSBcImZpbGVzXCIgZmllbGQuJyxcbiAgICAgICAgY2F0ZWdvcnk6IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcixcbiAgICAgICAgY29kZTogMFxuICAgICAgfV1cbiAgICB9O1xuICB9XG5cbiAgY29uc3QgaW5kZXhNb2R1bGUgPSBpbmRleEZpbGUucmVwbGFjZSgvXFwudHMkLywgJycpO1xuXG4gIC8vIFRoZSBvcGVyYXRpb24gb2YgcHJvZHVjaW5nIGEgbWV0YWRhdGEgYnVuZGxlIGhhcHBlbnMgdHdpY2UgLSBvbmNlIGR1cmluZyBzZXR1cCBhbmQgb25jZSBkdXJpbmdcbiAgLy8gdGhlIGVtaXQgcGhhc2UuIFRoZSBmaXJzdCB0aW1lLCB0aGUgYnVuZGxlIGlzIHByb2R1Y2VkIHdpdGhvdXQgYSBtZXRhZGF0YSBjYWNoZSwgdG8gY29tcHV0ZSB0aGVcbiAgLy8gY29udGVudHMgb2YgdGhlIGZsYXQgbW9kdWxlIGluZGV4LiBUaGUgYnVuZGxlIHByb2R1Y2VkIGR1cmluZyBlbWl0IGRvZXMgdXNlIHRoZSBtZXRhZGF0YSBjYWNoZVxuICAvLyB3aXRoIGFzc29jaWF0ZWQgdHJhbnNmb3Jtcywgc28gdGhlIG1ldGFkYXRhIHdpbGwgaGF2ZSBsb3dlcmVkIGV4cHJlc3Npb25zLCByZXNvdXJjZSBpbmxpbmluZyxcbiAgLy8gZXRjLlxuICBjb25zdCBnZXRNZXRhZGF0YUJ1bmRsZSA9IChjYWNoZTogTWV0YWRhdGFDYWNoZXxudWxsKSA9PiB7XG4gICAgY29uc3QgYnVuZGxlciA9IG5ldyBNZXRhZGF0YUJ1bmRsZXIoXG4gICAgICAgIGluZGV4TW9kdWxlLCBuZ09wdGlvbnMuZmxhdE1vZHVsZUlkLCBuZXcgQ29tcGlsZXJIb3N0QWRhcHRlcihob3N0LCBjYWNoZSwgbmdPcHRpb25zKSxcbiAgICAgICAgbmdPcHRpb25zLmZsYXRNb2R1bGVQcml2YXRlU3ltYm9sUHJlZml4KTtcbiAgICByZXR1cm4gYnVuZGxlci5nZXRNZXRhZGF0YUJ1bmRsZSgpO1xuICB9O1xuXG4gIC8vIEZpcnN0LCBwcm9kdWNlIHRoZSBidW5kbGUgd2l0aCBubyBNZXRhZGF0YUNhY2hlLlxuICBjb25zdCBtZXRhZGF0YUJ1bmRsZSA9IGdldE1ldGFkYXRhQnVuZGxlKC8qIE1ldGFkYXRhQ2FjaGUgKi8gbnVsbCk7XG4gIGNvbnN0IG5hbWUgPVxuICAgICAgcGF0aC5qb2luKHBhdGguZGlybmFtZShpbmRleE1vZHVsZSksIG5nT3B0aW9ucy5mbGF0TW9kdWxlT3V0RmlsZSEucmVwbGFjZShKU19FWFQsICcudHMnKSk7XG4gIGNvbnN0IGxpYnJhcnlJbmRleCA9IGAuLyR7cGF0aC5iYXNlbmFtZShpbmRleE1vZHVsZSl9YDtcbiAgY29uc3QgY29udGVudCA9IHByaXZhdGVFbnRyaWVzVG9JbmRleChsaWJyYXJ5SW5kZXgsIG1ldGFkYXRhQnVuZGxlLnByaXZhdGVzKTtcblxuICBob3N0ID0gY3JlYXRlU3ludGhldGljSW5kZXhIb3N0KGhvc3QsIHtcbiAgICBuYW1lLFxuICAgIGNvbnRlbnQsXG4gICAgZ2V0TWV0YWRhdGE6ICgpID0+IHtcbiAgICAgIC8vIFRoZSBzZWNvbmQgbWV0YWRhdGEgYnVuZGxlIHByb2R1Y3Rpb24gaGFwcGVucyBvbi1kZW1hbmQsIGFuZCB1c2VzIHRoZSBnZXRNZXRhZGF0YUNhY2hlXG4gICAgICAvLyBjbG9zdXJlIHRvIHJldHJpZXZlIGFuIHVwLXRvLWRhdGUgTWV0YWRhdGFDYWNoZSB3aGljaCBpcyBjb25maWd1cmVkIHdpdGggd2hhdGV2ZXIgbWV0YWRhdGFcbiAgICAgIC8vIHRyYW5zZm9ybXMgd2VyZSB1c2VkIHRvIHByb2R1Y2UgdGhlIEpTIG91dHB1dC5cbiAgICAgIGNvbnN0IG1ldGFkYXRhQnVuZGxlID0gZ2V0TWV0YWRhdGFCdW5kbGUoZ2V0TWV0YWRhdGFDYWNoZSgpKTtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtZXRhZGF0YUJ1bmRsZS5tZXRhZGF0YSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHtob3N0LCBpbmRleE5hbWU6IG5hbWV9O1xufVxuIl19