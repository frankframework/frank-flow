/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { copyFileShimData, retagAllTsFiles, ShimReferenceTagger, untagAllTsFiles } from '../../shims';
import { toUnredirectedSourceFile } from '../../util/src/typescript';
import { UpdateMode } from './api';
/**
 * Delegates all methods of `ts.CompilerHost` to a delegate, with the exception of
 * `getSourceFile`, `fileExists` and `writeFile` which are implemented in `TypeCheckProgramHost`.
 *
 * If a new method is added to `ts.CompilerHost` which is not delegated, a type error will be
 * generated for this class.
 */
export class DelegatingCompilerHost {
    constructor(delegate) {
        this.delegate = delegate;
        // Excluded are 'getSourceFile', 'fileExists' and 'writeFile', which are actually implemented by
        // `TypeCheckProgramHost` below.
        this.createHash = this.delegateMethod('createHash');
        this.directoryExists = this.delegateMethod('directoryExists');
        this.getCancellationToken = this.delegateMethod('getCancellationToken');
        this.getCanonicalFileName = this.delegateMethod('getCanonicalFileName');
        this.getCurrentDirectory = this.delegateMethod('getCurrentDirectory');
        this.getDefaultLibFileName = this.delegateMethod('getDefaultLibFileName');
        this.getDefaultLibLocation = this.delegateMethod('getDefaultLibLocation');
        this.getDirectories = this.delegateMethod('getDirectories');
        this.getEnvironmentVariable = this.delegateMethod('getEnvironmentVariable');
        this.getNewLine = this.delegateMethod('getNewLine');
        this.getParsedCommandLine = this.delegateMethod('getParsedCommandLine');
        this.getSourceFileByPath = this.delegateMethod('getSourceFileByPath');
        this.readDirectory = this.delegateMethod('readDirectory');
        this.readFile = this.delegateMethod('readFile');
        this.realpath = this.delegateMethod('realpath');
        this.resolveModuleNames = this.delegateMethod('resolveModuleNames');
        this.resolveTypeReferenceDirectives = this.delegateMethod('resolveTypeReferenceDirectives');
        this.trace = this.delegateMethod('trace');
        this.useCaseSensitiveFileNames = this.delegateMethod('useCaseSensitiveFileNames');
    }
    delegateMethod(name) {
        return this.delegate[name] !== undefined ? this.delegate[name].bind(this.delegate) :
            undefined;
    }
}
/**
 * A `ts.CompilerHost` which augments source files.
 */
class UpdatedProgramHost extends DelegatingCompilerHost {
    constructor(sfMap, originalProgram, delegate, shimExtensionPrefixes) {
        super(delegate);
        this.originalProgram = originalProgram;
        this.shimExtensionPrefixes = shimExtensionPrefixes;
        /**
         * The `ShimReferenceTagger` responsible for tagging `ts.SourceFile`s loaded via this host.
         *
         * The `UpdatedProgramHost` is used in the creation of a new `ts.Program`. Even though this new
         * program is based on a prior one, TypeScript will still start from the root files and enumerate
         * all source files to include in the new program.  This means that just like during the original
         * program's creation, these source files must be tagged with references to per-file shims in
         * order for those shims to be loaded, and then cleaned up afterwards. Thus the
         * `UpdatedProgramHost` has its own `ShimReferenceTagger` to perform this function.
         */
        this.shimTagger = new ShimReferenceTagger(this.shimExtensionPrefixes);
        this.sfMap = sfMap;
    }
    getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
        // Try to use the same `ts.SourceFile` as the original program, if possible. This guarantees
        // that program reuse will be as efficient as possible.
        let delegateSf = this.originalProgram.getSourceFile(fileName);
        if (delegateSf === undefined) {
            // Something went wrong and a source file is being requested that's not in the original
            // program. Just in case, try to retrieve it from the delegate.
            delegateSf = this.delegate.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
        }
        if (delegateSf === undefined) {
            return undefined;
        }
        // Look for replacements.
        let sf;
        if (this.sfMap.has(fileName)) {
            sf = this.sfMap.get(fileName);
            copyFileShimData(delegateSf, sf);
        }
        else {
            sf = delegateSf;
        }
        // TypeScript doesn't allow returning redirect source files. To avoid unforeseen errors we
        // return the original source file instead of the redirect target.
        sf = toUnredirectedSourceFile(sf);
        this.shimTagger.tag(sf);
        return sf;
    }
    postProgramCreationCleanup() {
        this.shimTagger.finalize();
    }
    writeFile() {
        throw new Error(`TypeCheckProgramHost should never write files`);
    }
    fileExists(fileName) {
        return this.sfMap.has(fileName) || this.delegate.fileExists(fileName);
    }
}
/**
 * Updates a `ts.Program` instance with a new one that incorporates specific changes, using the
 * TypeScript compiler APIs for incremental program creation.
 */
export class TsCreateProgramDriver {
    constructor(originalProgram, originalHost, options, shimExtensionPrefixes) {
        this.originalProgram = originalProgram;
        this.originalHost = originalHost;
        this.options = options;
        this.shimExtensionPrefixes = shimExtensionPrefixes;
        /**
         * A map of source file paths to replacement `ts.SourceFile`s for those paths.
         *
         * Effectively, this tracks the delta between the user's program (represented by the
         * `originalHost`) and the template type-checking program being managed.
         */
        this.sfMap = new Map();
        this.program = this.originalProgram;
        this.supportsInlineOperations = true;
    }
    getProgram() {
        return this.program;
    }
    updateFiles(contents, updateMode) {
        if (contents.size === 0) {
            // No changes have been requested. Is it safe to skip updating entirely?
            // If UpdateMode is Incremental, then yes. If UpdateMode is Complete, then it's safe to skip
            // only if there are no active changes already (that would be cleared by the update).
            if (updateMode !== UpdateMode.Complete || this.sfMap.size === 0) {
                // No changes would be made to the `ts.Program` anyway, so it's safe to do nothing here.
                return;
            }
        }
        if (updateMode === UpdateMode.Complete) {
            this.sfMap.clear();
        }
        for (const [filePath, text] of contents.entries()) {
            this.sfMap.set(filePath, ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true));
        }
        const host = new UpdatedProgramHost(this.sfMap, this.originalProgram, this.originalHost, this.shimExtensionPrefixes);
        const oldProgram = this.program;
        // Retag the old program's `ts.SourceFile`s with shim tags, to allow TypeScript to reuse the
        // most data.
        retagAllTsFiles(oldProgram);
        this.program = ts.createProgram({
            host,
            rootNames: this.program.getRootFileNames(),
            options: this.options,
            oldProgram,
        });
        host.postProgramCreationCleanup();
        // And untag them afterwards. We explicitly untag both programs here, because the oldProgram
        // may still be used for emit and needs to not contain tags.
        untagAllTsFiles(this.program);
        untagAllTsFiles(oldProgram);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHNfY3JlYXRlX3Byb2dyYW1fZHJpdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9wcm9ncmFtX2RyaXZlci9zcmMvdHNfY3JlYXRlX3Byb2dyYW1fZHJpdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBR2pDLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ3BHLE9BQU8sRUFBc0Isd0JBQXdCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUV4RixPQUFPLEVBQWdCLFVBQVUsRUFBQyxNQUFNLE9BQU8sQ0FBQztBQUVoRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8sc0JBQXNCO0lBRWpDLFlBQXNCLFFBQXlCO1FBQXpCLGFBQVEsR0FBUixRQUFRLENBQWlCO1FBTy9DLGdHQUFnRztRQUNoRyxnQ0FBZ0M7UUFDaEMsZUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDL0Msb0JBQWUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDekQseUJBQW9CLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ25FLHlCQUFvQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUNuRSx3QkFBbUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakUsMEJBQXFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3JFLDBCQUFxQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsdUJBQXVC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OUIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0Fic29sdXRlRnNQYXRofSBmcm9tICcuLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge2NvcHlGaWxlU2hpbURhdGEsIHJldGFnQWxsVHNGaWxlcywgU2hpbVJlZmVyZW5jZVRhZ2dlciwgdW50YWdBbGxUc0ZpbGVzfSBmcm9tICcuLi8uLi9zaGltcyc7XG5pbXBvcnQge1JlcXVpcmVkRGVsZWdhdGlvbnMsIHRvVW5yZWRpcmVjdGVkU291cmNlRmlsZX0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7UHJvZ3JhbURyaXZlciwgVXBkYXRlTW9kZX0gZnJvbSAnLi9hcGknO1xuXG4vKipcbiAqIERlbGVnYXRlcyBhbGwgbWV0aG9kcyBvZiBgdHMuQ29tcGlsZXJIb3N0YCB0byBhIGRlbGVnYXRlLCB3aXRoIHRoZSBleGNlcHRpb24gb2ZcbiAqIGBnZXRTb3VyY2VGaWxlYCwgYGZpbGVFeGlzdHNgIGFuZCBgd3JpdGVGaWxlYCB3aGljaCBhcmUgaW1wbGVtZW50ZWQgaW4gYFR5cGVDaGVja1Byb2dyYW1Ib3N0YC5cbiAqXG4gKiBJZiBhIG5ldyBtZXRob2QgaXMgYWRkZWQgdG8gYHRzLkNvbXBpbGVySG9zdGAgd2hpY2ggaXMgbm90IGRlbGVnYXRlZCwgYSB0eXBlIGVycm9yIHdpbGwgYmVcbiAqIGdlbmVyYXRlZCBmb3IgdGhpcyBjbGFzcy5cbiAqL1xuZXhwb3J0IGNsYXNzIERlbGVnYXRpbmdDb21waWxlckhvc3QgaW1wbGVtZW50c1xuICAgIE9taXQ8UmVxdWlyZWREZWxlZ2F0aW9uczx0cy5Db21waWxlckhvc3Q+LCAnZ2V0U291cmNlRmlsZSd8J2ZpbGVFeGlzdHMnfCd3cml0ZUZpbGUnPiB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBkZWxlZ2F0ZTogdHMuQ29tcGlsZXJIb3N0KSB7fVxuXG4gIHByaXZhdGUgZGVsZWdhdGVNZXRob2Q8TSBleHRlbmRzIGtleW9mIHRzLkNvbXBpbGVySG9zdD4obmFtZTogTSk6IHRzLkNvbXBpbGVySG9zdFtNXSB7XG4gICAgcmV0dXJuIHRoaXMuZGVsZWdhdGVbbmFtZV0gIT09IHVuZGVmaW5lZCA/ICh0aGlzLmRlbGVnYXRlW25hbWVdIGFzIGFueSkuYmluZCh0aGlzLmRlbGVnYXRlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8vIEV4Y2x1ZGVkIGFyZSAnZ2V0U291cmNlRmlsZScsICdmaWxlRXhpc3RzJyBhbmQgJ3dyaXRlRmlsZScsIHdoaWNoIGFyZSBhY3R1YWxseSBpbXBsZW1lbnRlZCBieVxuICAvLyBgVHlwZUNoZWNrUHJvZ3JhbUhvc3RgIGJlbG93LlxuICBjcmVhdGVIYXNoID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnY3JlYXRlSGFzaCcpO1xuICBkaXJlY3RvcnlFeGlzdHMgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdkaXJlY3RvcnlFeGlzdHMnKTtcbiAgZ2V0Q2FuY2VsbGF0aW9uVG9rZW4gPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXRDYW5jZWxsYXRpb25Ub2tlbicpO1xuICBnZXRDYW5vbmljYWxGaWxlTmFtZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ2dldENhbm9uaWNhbEZpbGVOYW1lJyk7XG4gIGdldEN1cnJlbnREaXJlY3RvcnkgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXRDdXJyZW50RGlyZWN0b3J5Jyk7XG4gIGdldERlZmF1bHRMaWJGaWxlTmFtZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ2dldERlZmF1bHRMaWJGaWxlTmFtZScpO1xuICBnZXREZWZhdWx0TGliTG9jYXRpb24gPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXREZWZhdWx0TGliTG9jYXRpb24nKTtcbiAgZ2V0RGlyZWN0b3JpZXMgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXREaXJlY3RvcmllcycpO1xuICBnZXRFbnZpcm9ubWVudFZhcmlhYmxlID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0RW52aXJvbm1lbnRWYXJpYWJsZScpO1xuICBnZXROZXdMaW5lID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0TmV3TGluZScpO1xuICBnZXRQYXJzZWRDb21tYW5kTGluZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ2dldFBhcnNlZENvbW1hbmRMaW5lJyk7XG4gIGdldFNvdXJjZUZpbGVCeVBhdGggPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXRTb3VyY2VGaWxlQnlQYXRoJyk7XG4gIHJlYWREaXJlY3RvcnkgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdyZWFkRGlyZWN0b3J5Jyk7XG4gIHJlYWRGaWxlID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgncmVhZEZpbGUnKTtcbiAgcmVhbHBhdGggPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdyZWFscGF0aCcpO1xuICByZXNvbHZlTW9kdWxlTmFtZXMgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdyZXNvbHZlTW9kdWxlTmFtZXMnKTtcbiAgcmVzb2x2ZVR5cGVSZWZlcmVuY2VEaXJlY3RpdmVzID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgncmVzb2x2ZVR5cGVSZWZlcmVuY2VEaXJlY3RpdmVzJyk7XG4gIHRyYWNlID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgndHJhY2UnKTtcbiAgdXNlQ2FzZVNlbnNpdGl2ZUZpbGVOYW1lcyA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ3VzZUNhc2VTZW5zaXRpdmVGaWxlTmFtZXMnKTtcbn1cblxuLyoqXG4gKiBBIGB0cy5Db21waWxlckhvc3RgIHdoaWNoIGF1Z21lbnRzIHNvdXJjZSBmaWxlcy5cbiAqL1xuY2xhc3MgVXBkYXRlZFByb2dyYW1Ib3N0IGV4dGVuZHMgRGVsZWdhdGluZ0NvbXBpbGVySG9zdCB7XG4gIC8qKlxuICAgKiBNYXAgb2Ygc291cmNlIGZpbGUgbmFtZXMgdG8gYHRzLlNvdXJjZUZpbGVgIGluc3RhbmNlcy5cbiAgICovXG4gIHByaXZhdGUgc2ZNYXA6IE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+O1xuXG4gIC8qKlxuICAgKiBUaGUgYFNoaW1SZWZlcmVuY2VUYWdnZXJgIHJlc3BvbnNpYmxlIGZvciB0YWdnaW5nIGB0cy5Tb3VyY2VGaWxlYHMgbG9hZGVkIHZpYSB0aGlzIGhvc3QuXG4gICAqXG4gICAqIFRoZSBgVXBkYXRlZFByb2dyYW1Ib3N0YCBpcyB1c2VkIGluIHRoZSBjcmVhdGlvbiBvZiBhIG5ldyBgdHMuUHJvZ3JhbWAuIEV2ZW4gdGhvdWdoIHRoaXMgbmV3XG4gICAqIHByb2dyYW0gaXMgYmFzZWQgb24gYSBwcmlvciBvbmUsIFR5cGVTY3JpcHQgd2lsbCBzdGlsbCBzdGFydCBmcm9tIHRoZSByb290IGZpbGVzIGFuZCBlbnVtZXJhdGVcbiAgICogYWxsIHNvdXJjZSBmaWxlcyB0byBpbmNsdWRlIGluIHRoZSBuZXcgcHJvZ3JhbS4gIFRoaXMgbWVhbnMgdGhhdCBqdXN0IGxpa2UgZHVyaW5nIHRoZSBvcmlnaW5hbFxuICAgKiBwcm9ncmFtJ3MgY3JlYXRpb24sIHRoZXNlIHNvdXJjZSBmaWxlcyBtdXN0IGJlIHRhZ2dlZCB3aXRoIHJlZmVyZW5jZXMgdG8gcGVyLWZpbGUgc2hpbXMgaW5cbiAgICogb3JkZXIgZm9yIHRob3NlIHNoaW1zIHRvIGJlIGxvYWRlZCwgYW5kIHRoZW4gY2xlYW5lZCB1cCBhZnRlcndhcmRzLiBUaHVzIHRoZVxuICAgKiBgVXBkYXRlZFByb2dyYW1Ib3N0YCBoYXMgaXRzIG93biBgU2hpbVJlZmVyZW5jZVRhZ2dlcmAgdG8gcGVyZm9ybSB0aGlzIGZ1bmN0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBzaGltVGFnZ2VyID0gbmV3IFNoaW1SZWZlcmVuY2VUYWdnZXIodGhpcy5zaGltRXh0ZW5zaW9uUHJlZml4ZXMpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgc2ZNYXA6IE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+LCBwcml2YXRlIG9yaWdpbmFsUHJvZ3JhbTogdHMuUHJvZ3JhbSxcbiAgICAgIGRlbGVnYXRlOiB0cy5Db21waWxlckhvc3QsIHByaXZhdGUgc2hpbUV4dGVuc2lvblByZWZpeGVzOiBzdHJpbmdbXSkge1xuICAgIHN1cGVyKGRlbGVnYXRlKTtcbiAgICB0aGlzLnNmTWFwID0gc2ZNYXA7XG4gIH1cblxuICBnZXRTb3VyY2VGaWxlKFxuICAgICAgZmlsZU5hbWU6IHN0cmluZywgbGFuZ3VhZ2VWZXJzaW9uOiB0cy5TY3JpcHRUYXJnZXQsXG4gICAgICBvbkVycm9yPzogKChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQpfHVuZGVmaW5lZCxcbiAgICAgIHNob3VsZENyZWF0ZU5ld1NvdXJjZUZpbGU/OiBib29sZWFufHVuZGVmaW5lZCk6IHRzLlNvdXJjZUZpbGV8dW5kZWZpbmVkIHtcbiAgICAvLyBUcnkgdG8gdXNlIHRoZSBzYW1lIGB0cy5Tb3VyY2VGaWxlYCBhcyB0aGUgb3JpZ2luYWwgcHJvZ3JhbSwgaWYgcG9zc2libGUuIFRoaXMgZ3VhcmFudGVlc1xuICAgIC8vIHRoYXQgcHJvZ3JhbSByZXVzZSB3aWxsIGJlIGFzIGVmZmljaWVudCBhcyBwb3NzaWJsZS5cbiAgICBsZXQgZGVsZWdhdGVTZjogdHMuU291cmNlRmlsZXx1bmRlZmluZWQgPSB0aGlzLm9yaWdpbmFsUHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGVOYW1lKTtcbiAgICBpZiAoZGVsZWdhdGVTZiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyBhbmQgYSBzb3VyY2UgZmlsZSBpcyBiZWluZyByZXF1ZXN0ZWQgdGhhdCdzIG5vdCBpbiB0aGUgb3JpZ2luYWxcbiAgICAgIC8vIHByb2dyYW0uIEp1c3QgaW4gY2FzZSwgdHJ5IHRvIHJldHJpZXZlIGl0IGZyb20gdGhlIGRlbGVnYXRlLlxuICAgICAgZGVsZWdhdGVTZiA9IHRoaXMuZGVsZWdhdGUuZ2V0U291cmNlRmlsZShcbiAgICAgICAgICBmaWxlTmFtZSwgbGFuZ3VhZ2VWZXJzaW9uLCBvbkVycm9yLCBzaG91bGRDcmVhdGVOZXdTb3VyY2VGaWxlKSE7XG4gICAgfVxuICAgIGlmIChkZWxlZ2F0ZVNmID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gTG9vayBmb3IgcmVwbGFjZW1lbnRzLlxuICAgIGxldCBzZjogdHMuU291cmNlRmlsZTtcbiAgICBpZiAodGhpcy5zZk1hcC5oYXMoZmlsZU5hbWUpKSB7XG4gICAgICBzZiA9IHRoaXMuc2ZNYXAuZ2V0KGZpbGVOYW1lKSE7XG4gICAgICBjb3B5RmlsZVNoaW1EYXRhKGRlbGVnYXRlU2YsIHNmKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2YgPSBkZWxlZ2F0ZVNmO1xuICAgIH1cbiAgICAvLyBUeXBlU2NyaXB0IGRvZXNuJ3QgYWxsb3cgcmV0dXJuaW5nIHJlZGlyZWN0IHNvdXJjZSBmaWxlcy4gVG8gYXZvaWQgdW5mb3Jlc2VlbiBlcnJvcnMgd2VcbiAgICAvLyByZXR1cm4gdGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlIGluc3RlYWQgb2YgdGhlIHJlZGlyZWN0IHRhcmdldC5cbiAgICBzZiA9IHRvVW5yZWRpcmVjdGVkU291cmNlRmlsZShzZik7XG5cbiAgICB0aGlzLnNoaW1UYWdnZXIudGFnKHNmKTtcbiAgICByZXR1cm4gc2Y7XG4gIH1cblxuICBwb3N0UHJvZ3JhbUNyZWF0aW9uQ2xlYW51cCgpOiB2b2lkIHtcbiAgICB0aGlzLnNoaW1UYWdnZXIuZmluYWxpemUoKTtcbiAgfVxuXG4gIHdyaXRlRmlsZSgpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlQ2hlY2tQcm9ncmFtSG9zdCBzaG91bGQgbmV2ZXIgd3JpdGUgZmlsZXNgKTtcbiAgfVxuXG4gIGZpbGVFeGlzdHMoZmlsZU5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnNmTWFwLmhhcyhmaWxlTmFtZSkgfHwgdGhpcy5kZWxlZ2F0ZS5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgfVxufVxuXG5cbi8qKlxuICogVXBkYXRlcyBhIGB0cy5Qcm9ncmFtYCBpbnN0YW5jZSB3aXRoIGEgbmV3IG9uZSB0aGF0IGluY29ycG9yYXRlcyBzcGVjaWZpYyBjaGFuZ2VzLCB1c2luZyB0aGVcbiAqIFR5cGVTY3JpcHQgY29tcGlsZXIgQVBJcyBmb3IgaW5jcmVtZW50YWwgcHJvZ3JhbSBjcmVhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIFRzQ3JlYXRlUHJvZ3JhbURyaXZlciBpbXBsZW1lbnRzIFByb2dyYW1Ecml2ZXIge1xuICAvKipcbiAgICogQSBtYXAgb2Ygc291cmNlIGZpbGUgcGF0aHMgdG8gcmVwbGFjZW1lbnQgYHRzLlNvdXJjZUZpbGVgcyBmb3IgdGhvc2UgcGF0aHMuXG4gICAqXG4gICAqIEVmZmVjdGl2ZWx5LCB0aGlzIHRyYWNrcyB0aGUgZGVsdGEgYmV0d2VlbiB0aGUgdXNlcidzIHByb2dyYW0gKHJlcHJlc2VudGVkIGJ5IHRoZVxuICAgKiBgb3JpZ2luYWxIb3N0YCkgYW5kIHRoZSB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIHByb2dyYW0gYmVpbmcgbWFuYWdlZC5cbiAgICovXG4gIHByaXZhdGUgc2ZNYXAgPSBuZXcgTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT4oKTtcblxuICBwcml2YXRlIHByb2dyYW06IHRzLlByb2dyYW0gPSB0aGlzLm9yaWdpbmFsUHJvZ3JhbTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgb3JpZ2luYWxQcm9ncmFtOiB0cy5Qcm9ncmFtLCBwcml2YXRlIG9yaWdpbmFsSG9zdDogdHMuQ29tcGlsZXJIb3N0LFxuICAgICAgcHJpdmF0ZSBvcHRpb25zOiB0cy5Db21waWxlck9wdGlvbnMsIHByaXZhdGUgc2hpbUV4dGVuc2lvblByZWZpeGVzOiBzdHJpbmdbXSkge31cblxuICByZWFkb25seSBzdXBwb3J0c0lubGluZU9wZXJhdGlvbnMgPSB0cnVlO1xuXG4gIGdldFByb2dyYW0oKTogdHMuUHJvZ3JhbSB7XG4gICAgcmV0dXJuIHRoaXMucHJvZ3JhbTtcbiAgfVxuXG4gIHVwZGF0ZUZpbGVzKGNvbnRlbnRzOiBNYXA8QWJzb2x1dGVGc1BhdGgsIHN0cmluZz4sIHVwZGF0ZU1vZGU6IFVwZGF0ZU1vZGUpOiB2b2lkIHtcbiAgICBpZiAoY29udGVudHMuc2l6ZSA9PT0gMCkge1xuICAgICAgLy8gTm8gY2hhbmdlcyBoYXZlIGJlZW4gcmVxdWVzdGVkLiBJcyBpdCBzYWZlIHRvIHNraXAgdXBkYXRpbmcgZW50aXJlbHk/XG4gICAgICAvLyBJZiBVcGRhdGVNb2RlIGlzIEluY3JlbWVudGFsLCB0aGVuIHllcy4gSWYgVXBkYXRlTW9kZSBpcyBDb21wbGV0ZSwgdGhlbiBpdCdzIHNhZmUgdG8gc2tpcFxuICAgICAgLy8gb25seSBpZiB0aGVyZSBhcmUgbm8gYWN0aXZlIGNoYW5nZXMgYWxyZWFkeSAodGhhdCB3b3VsZCBiZSBjbGVhcmVkIGJ5IHRoZSB1cGRhdGUpLlxuXG4gICAgICBpZiAodXBkYXRlTW9kZSAhPT0gVXBkYXRlTW9kZS5Db21wbGV0ZSB8fCB0aGlzLnNmTWFwLnNpemUgPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2hhbmdlcyB3b3VsZCBiZSBtYWRlIHRvIHRoZSBgdHMuUHJvZ3JhbWAgYW55d2F5LCBzbyBpdCdzIHNhZmUgdG8gZG8gbm90aGluZyBoZXJlLlxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHVwZGF0ZU1vZGUgPT09IFVwZGF0ZU1vZGUuQ29tcGxldGUpIHtcbiAgICAgIHRoaXMuc2ZNYXAuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IFtmaWxlUGF0aCwgdGV4dF0gb2YgY29udGVudHMuZW50cmllcygpKSB7XG4gICAgICB0aGlzLnNmTWFwLnNldChmaWxlUGF0aCwgdHMuY3JlYXRlU291cmNlRmlsZShmaWxlUGF0aCwgdGV4dCwgdHMuU2NyaXB0VGFyZ2V0LkxhdGVzdCwgdHJ1ZSkpO1xuICAgIH1cblxuICAgIGNvbnN0IGhvc3QgPSBuZXcgVXBkYXRlZFByb2dyYW1Ib3N0KFxuICAgICAgICB0aGlzLnNmTWFwLCB0aGlzLm9yaWdpbmFsUHJvZ3JhbSwgdGhpcy5vcmlnaW5hbEhvc3QsIHRoaXMuc2hpbUV4dGVuc2lvblByZWZpeGVzKTtcbiAgICBjb25zdCBvbGRQcm9ncmFtID0gdGhpcy5wcm9ncmFtO1xuXG4gICAgLy8gUmV0YWcgdGhlIG9sZCBwcm9ncmFtJ3MgYHRzLlNvdXJjZUZpbGVgcyB3aXRoIHNoaW0gdGFncywgdG8gYWxsb3cgVHlwZVNjcmlwdCB0byByZXVzZSB0aGVcbiAgICAvLyBtb3N0IGRhdGEuXG4gICAgcmV0YWdBbGxUc0ZpbGVzKG9sZFByb2dyYW0pO1xuXG4gICAgdGhpcy5wcm9ncmFtID0gdHMuY3JlYXRlUHJvZ3JhbSh7XG4gICAgICBob3N0LFxuICAgICAgcm9vdE5hbWVzOiB0aGlzLnByb2dyYW0uZ2V0Um9vdEZpbGVOYW1lcygpLFxuICAgICAgb3B0aW9uczogdGhpcy5vcHRpb25zLFxuICAgICAgb2xkUHJvZ3JhbSxcbiAgICB9KTtcbiAgICBob3N0LnBvc3RQcm9ncmFtQ3JlYXRpb25DbGVhbnVwKCk7XG5cbiAgICAvLyBBbmQgdW50YWcgdGhlbSBhZnRlcndhcmRzLiBXZSBleHBsaWNpdGx5IHVudGFnIGJvdGggcHJvZ3JhbXMgaGVyZSwgYmVjYXVzZSB0aGUgb2xkUHJvZ3JhbVxuICAgIC8vIG1heSBzdGlsbCBiZSB1c2VkIGZvciBlbWl0IGFuZCBuZWVkcyB0byBub3QgY29udGFpbiB0YWdzLlxuICAgIHVudGFnQWxsVHNGaWxlcyh0aGlzLnByb2dyYW0pO1xuICAgIHVudGFnQWxsVHNGaWxlcyhvbGRQcm9ncmFtKTtcbiAgfVxufVxuIl19