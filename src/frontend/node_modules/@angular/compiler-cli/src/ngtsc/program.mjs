/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { HtmlParser, MessageBundle } from '@angular/compiler';
import * as ts from 'typescript';
import * as api from '../transformers/api';
import { i18nExtract } from '../transformers/i18n';
import { verifySupportedTypeScriptVersion } from '../typescript_support';
import { freshCompilationTicket, incrementalFromCompilerTicket, NgCompiler, NgCompilerHost } from './core';
import { absoluteFrom, getFileSystem, resolve } from './file_system';
import { TrackedIncrementalBuildStrategy } from './incremental';
import { ActivePerfRecorder, PerfCheckpoint as PerfCheckpoint, PerfEvent, PerfPhase } from './perf';
import { TsCreateProgramDriver } from './program_driver';
import { retagAllTsFiles, untagAllTsFiles } from './shims';
import { OptimizeFor } from './typecheck/api';
/**
 * Entrypoint to the Angular Compiler (Ivy+) which sits behind the `api.Program` interface, allowing
 * it to be a drop-in replacement for the legacy View Engine compiler to tooling such as the
 * command-line main() function or the Angular CLI.
 */
export class NgtscProgram {
    constructor(rootNames, options, delegateHost, oldProgram) {
        this.options = options;
        const perfRecorder = ActivePerfRecorder.zeroedToNow();
        perfRecorder.phase(PerfPhase.Setup);
        // First, check whether the current TS version is supported.
        if (!options.disableTypeScriptVersionCheck) {
            verifySupportedTypeScriptVersion();
        }
        this.closureCompilerEnabled = !!options.annotateForClosureCompiler;
        const reuseProgram = oldProgram === null || oldProgram === void 0 ? void 0 : oldProgram.compiler.getCurrentProgram();
        this.host = NgCompilerHost.wrap(delegateHost, rootNames, options, reuseProgram !== null && reuseProgram !== void 0 ? reuseProgram : null);
        if (reuseProgram !== undefined) {
            // Prior to reusing the old program, restore shim tagging for all its `ts.SourceFile`s.
            // TypeScript checks the `referencedFiles` of `ts.SourceFile`s for changes when evaluating
            // incremental reuse of data from the old program, so it's important that these match in order
            // to get the most benefit out of reuse.
            retagAllTsFiles(reuseProgram);
        }
        this.tsProgram = perfRecorder.inPhase(PerfPhase.TypeScriptProgramCreate, () => ts.createProgram(this.host.inputFiles, options, this.host, reuseProgram));
        perfRecorder.phase(PerfPhase.Unaccounted);
        perfRecorder.memory(PerfCheckpoint.TypeScriptProgramCreate);
        this.host.postProgramCreationCleanup();
        // Shim tagging has served its purpose, and tags can now be removed from all `ts.SourceFile`s in
        // the program.
        untagAllTsFiles(this.tsProgram);
        const programDriver = new TsCreateProgramDriver(this.tsProgram, this.host, this.options, this.host.shimExtensionPrefixes);
        this.incrementalStrategy = oldProgram !== undefined ?
            oldProgram.incrementalStrategy.toNextBuildStrategy() :
            new TrackedIncrementalBuildStrategy();
        const modifiedResourceFiles = new Set();
        if (this.host.getModifiedResourceFiles !== undefined) {
            const strings = this.host.getModifiedResourceFiles();
            if (strings !== undefined) {
                for (const fileString of strings) {
                    modifiedResourceFiles.add(absoluteFrom(fileString));
                }
            }
        }
        let ticket;
        if (oldProgram === undefined) {
            ticket = freshCompilationTicket(this.tsProgram, options, this.incrementalStrategy, programDriver, perfRecorder, 
            /* enableTemplateTypeChecker */ false, /* usePoisonedData */ false);
        }
        else {
            ticket = incrementalFromCompilerTicket(oldProgram.compiler, this.tsProgram, this.incrementalStrategy, programDriver, modifiedResourceFiles, perfRecorder);
        }
        // Create the NgCompiler which will drive the rest of the compilation.
        this.compiler = NgCompiler.fromTicket(ticket, this.host);
    }
    getTsProgram() {
        return this.tsProgram;
    }
    getReuseTsProgram() {
        return this.compiler.getCurrentProgram();
    }
    getTsOptionDiagnostics(cancellationToken) {
        return this.compiler.perfRecorder.inPhase(PerfPhase.TypeScriptDiagnostics, () => this.tsProgram.getOptionsDiagnostics(cancellationToken));
    }
    getTsSyntacticDiagnostics(sourceFile, cancellationToken) {
        return this.compiler.perfRecorder.inPhase(PerfPhase.TypeScriptDiagnostics, () => {
            const ignoredFiles = this.compiler.ignoreForDiagnostics;
            let res;
            if (sourceFile !== undefined) {
                if (ignoredFiles.has(sourceFile)) {
                    return [];
                }
                res = this.tsProgram.getSyntacticDiagnostics(sourceFile, cancellationToken);
            }
            else {
                const diagnostics = [];
                for (const sf of this.tsProgram.getSourceFiles()) {
                    if (!ignoredFiles.has(sf)) {
                        diagnostics.push(...this.tsProgram.getSyntacticDiagnostics(sf, cancellationToken));
                    }
                }
                res = diagnostics;
            }
            return res;
        });
    }
    getTsSemanticDiagnostics(sourceFile, cancellationToken) {
        return this.compiler.perfRecorder.inPhase(PerfPhase.TypeScriptDiagnostics, () => {
            const ignoredFiles = this.compiler.ignoreForDiagnostics;
            let res;
            if (sourceFile !== undefined) {
                if (ignoredFiles.has(sourceFile)) {
                    return [];
                }
                res = this.tsProgram.getSemanticDiagnostics(sourceFile, cancellationToken);
            }
            else {
                const diagnostics = [];
                for (const sf of this.tsProgram.getSourceFiles()) {
                    if (!ignoredFiles.has(sf)) {
                        diagnostics.push(...this.tsProgram.getSemanticDiagnostics(sf, cancellationToken));
                    }
                }
                res = diagnostics;
            }
            return res;
        });
    }
    getNgOptionDiagnostics(cancellationToken) {
        return this.compiler.getOptionDiagnostics();
    }
    getNgStructuralDiagnostics(cancellationToken) {
        return [];
    }
    getNgSemanticDiagnostics(fileName, cancellationToken) {
        let sf = undefined;
        if (fileName !== undefined) {
            sf = this.tsProgram.getSourceFile(fileName);
            if (sf === undefined) {
                // There are no diagnostics for files which don't exist in the program - maybe the caller
                // has stale data?
                return [];
            }
        }
        if (sf === undefined) {
            return this.compiler.getDiagnostics();
        }
        else {
            return this.compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram);
        }
    }
    /**
     * Ensure that the `NgCompiler` has properly analyzed the program, and allow for the asynchronous
     * loading of any resources during the process.
     *
     * This is used by the Angular CLI to allow for spawning (async) child compilations for things
     * like SASS files used in `styleUrls`.
     */
    loadNgStructureAsync() {
        return this.compiler.analyzeAsync();
    }
    listLazyRoutes(entryRoute) {
        return this.compiler.listLazyRoutes(entryRoute);
    }
    emitXi18n() {
        var _a, _b, _c;
        const ctx = new MessageBundle(new HtmlParser(), [], {}, (_a = this.options.i18nOutLocale) !== null && _a !== void 0 ? _a : null);
        this.compiler.xi18n(ctx);
        i18nExtract((_b = this.options.i18nOutFormat) !== null && _b !== void 0 ? _b : null, (_c = this.options.i18nOutFile) !== null && _c !== void 0 ? _c : null, this.host, this.options, ctx, resolve);
    }
    emit(opts) {
        // Check if emission of the i18n messages bundle was requested.
        if (opts !== undefined && opts.emitFlags !== undefined &&
            opts.emitFlags & api.EmitFlags.I18nBundle) {
            this.emitXi18n();
            // `api.EmitFlags` is a View Engine compiler concept. We only pay attention to the absence of
            // the other flags here if i18n emit was requested (since this is usually done in the xi18n
            // flow, where we don't want to emit JS at all).
            if (!(opts.emitFlags & api.EmitFlags.JS)) {
                return {
                    diagnostics: [],
                    emitSkipped: true,
                    emittedFiles: [],
                };
            }
        }
        this.compiler.perfRecorder.memory(PerfCheckpoint.PreEmit);
        const res = this.compiler.perfRecorder.inPhase(PerfPhase.TypeScriptEmit, () => {
            const { transformers } = this.compiler.prepareEmit();
            const ignoreFiles = this.compiler.ignoreForEmit;
            const emitCallback = opts && opts.emitCallback || defaultEmitCallback;
            const writeFile = (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
                if (sourceFiles !== undefined) {
                    // Record successful writes for any `ts.SourceFile` (that's not a declaration file)
                    // that's an input to this write.
                    for (const writtenSf of sourceFiles) {
                        if (writtenSf.isDeclarationFile) {
                            continue;
                        }
                        this.compiler.incrementalCompilation.recordSuccessfulEmit(writtenSf);
                    }
                }
                this.host.writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles);
            };
            const customTransforms = opts && opts.customTransformers;
            const beforeTransforms = transformers.before || [];
            const afterDeclarationsTransforms = transformers.afterDeclarations;
            if (customTransforms !== undefined && customTransforms.beforeTs !== undefined) {
                beforeTransforms.push(...customTransforms.beforeTs);
            }
            const emitResults = [];
            for (const targetSourceFile of this.tsProgram.getSourceFiles()) {
                if (targetSourceFile.isDeclarationFile || ignoreFiles.has(targetSourceFile)) {
                    continue;
                }
                if (this.compiler.incrementalCompilation.safeToSkipEmit(targetSourceFile)) {
                    this.compiler.perfRecorder.eventCount(PerfEvent.EmitSkipSourceFile);
                    continue;
                }
                this.compiler.perfRecorder.eventCount(PerfEvent.EmitSourceFile);
                emitResults.push(emitCallback({
                    targetSourceFile,
                    program: this.tsProgram,
                    host: this.host,
                    options: this.options,
                    emitOnlyDtsFiles: false,
                    writeFile,
                    customTransformers: {
                        before: beforeTransforms,
                        after: customTransforms && customTransforms.afterTs,
                        afterDeclarations: afterDeclarationsTransforms,
                    },
                }));
            }
            this.compiler.perfRecorder.memory(PerfCheckpoint.Emit);
            // Run the emit, including a custom transformer that will downlevel the Ivy decorators in
            // code.
            return ((opts && opts.mergeEmitResultsCallback) || mergeEmitResults)(emitResults);
        });
        // Record performance analysis information to disk if we've been asked to do so.
        if (this.options.tracePerformance !== undefined) {
            const perf = this.compiler.perfRecorder.finalize();
            getFileSystem().writeFile(getFileSystem().resolve(this.options.tracePerformance), JSON.stringify(perf, null, 2));
        }
        return res;
    }
    getIndexedComponents() {
        return this.compiler.getIndexedComponents();
    }
    getLibrarySummaries() {
        throw new Error('Method not implemented.');
    }
    getEmittedGeneratedFiles() {
        throw new Error('Method not implemented.');
    }
    getEmittedSourceFiles() {
        throw new Error('Method not implemented.');
    }
}
const defaultEmitCallback = ({ program, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers }) => program.emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
function mergeEmitResults(emitResults) {
    const diagnostics = [];
    let emitSkipped = false;
    const emittedFiles = [];
    for (const er of emitResults) {
        diagnostics.push(...er.diagnostics);
        emitSkipped = emitSkipped || er.emitSkipped;
        emittedFiles.push(...(er.emittedFiles || []));
    }
    return { diagnostics, emitSkipped, emittedFiles };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3JhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcHJvZ3JhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQWdCLFVBQVUsRUFBRSxhQUFhLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMzRSxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEtBQUssR0FBRyxNQUFNLHFCQUFxQixDQUFDO0FBQzNDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUV2RSxPQUFPLEVBQW9CLHNCQUFzQixFQUFFLDZCQUE2QixFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFNUgsT0FBTyxFQUFDLFlBQVksRUFBa0IsYUFBYSxFQUFFLE9BQU8sRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNuRixPQUFPLEVBQUMsK0JBQStCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFOUQsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGNBQWMsSUFBSSxjQUFjLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUNsRyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUV2RCxPQUFPLEVBQUMsZUFBZSxFQUFFLGVBQWUsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUN6RCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFFNUM7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxZQUFZO0lBWXZCLFlBQ0ksU0FBZ0MsRUFBVSxPQUEwQixFQUNwRSxZQUE4QixFQUFFLFVBQXlCO1FBRGYsWUFBTyxHQUFQLE9BQU8sQ0FBbUI7UUFFdEUs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LENBQUM7SUFDeEIsTUFBTSxZQUFZLEdBQWEsRUFBRSxDQUFDO0lBQ2xDLEtBQUssTUFBTSxFQUFFLElBQUksV0FBVyxFQUFFO1FBQzVCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDcEMsV0FBVyxHQUFHLFdBQVcsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDO1FBQzVDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztLQUMvQztJQUVELE9BQU8sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBQyxDQUFDO0FBQ2xELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtHZW5lcmF0ZWRGaWxlLCBIdG1sUGFyc2VyLCBNZXNzYWdlQnVuZGxlfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0ICogYXMgYXBpIGZyb20gJy4uL3RyYW5zZm9ybWVycy9hcGknO1xuaW1wb3J0IHtpMThuRXh0cmFjdH0gZnJvbSAnLi4vdHJhbnNmb3JtZXJzL2kxOG4nO1xuaW1wb3J0IHt2ZXJpZnlTdXBwb3J0ZWRUeXBlU2NyaXB0VmVyc2lvbn0gZnJvbSAnLi4vdHlwZXNjcmlwdF9zdXBwb3J0JztcblxuaW1wb3J0IHtDb21waWxhdGlvblRpY2tldCwgZnJlc2hDb21waWxhdGlvblRpY2tldCwgaW5jcmVtZW50YWxGcm9tQ29tcGlsZXJUaWNrZXQsIE5nQ29tcGlsZXIsIE5nQ29tcGlsZXJIb3N0fSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtOZ0NvbXBpbGVyT3B0aW9uc30gZnJvbSAnLi9jb3JlL2FwaSc7XG5pbXBvcnQge2Fic29sdXRlRnJvbSwgQWJzb2x1dGVGc1BhdGgsIGdldEZpbGVTeXN0ZW0sIHJlc29sdmV9IGZyb20gJy4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtUcmFja2VkSW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5fSBmcm9tICcuL2luY3JlbWVudGFsJztcbmltcG9ydCB7SW5kZXhlZENvbXBvbmVudH0gZnJvbSAnLi9pbmRleGVyJztcbmltcG9ydCB7QWN0aXZlUGVyZlJlY29yZGVyLCBQZXJmQ2hlY2twb2ludCBhcyBQZXJmQ2hlY2twb2ludCwgUGVyZkV2ZW50LCBQZXJmUGhhc2V9IGZyb20gJy4vcGVyZic7XG5pbXBvcnQge1RzQ3JlYXRlUHJvZ3JhbURyaXZlcn0gZnJvbSAnLi9wcm9ncmFtX2RyaXZlcic7XG5pbXBvcnQge0RlY2xhcmF0aW9uTm9kZX0gZnJvbSAnLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7cmV0YWdBbGxUc0ZpbGVzLCB1bnRhZ0FsbFRzRmlsZXN9IGZyb20gJy4vc2hpbXMnO1xuaW1wb3J0IHtPcHRpbWl6ZUZvcn0gZnJvbSAnLi90eXBlY2hlY2svYXBpJztcblxuLyoqXG4gKiBFbnRyeXBvaW50IHRvIHRoZSBBbmd1bGFyIENvbXBpbGVyIChJdnkrKSB3aGljaCBzaXRzIGJlaGluZCB0aGUgYGFwaS5Qcm9ncmFtYCBpbnRlcmZhY2UsIGFsbG93aW5nXG4gKiBpdCB0byBiZSBhIGRyb3AtaW4gcmVwbGFjZW1lbnQgZm9yIHRoZSBsZWdhY3kgVmlldyBFbmdpbmUgY29tcGlsZXIgdG8gdG9vbGluZyBzdWNoIGFzIHRoZVxuICogY29tbWFuZC1saW5lIG1haW4oKSBmdW5jdGlvbiBvciB0aGUgQW5ndWxhciBDTEkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ3RzY1Byb2dyYW0gaW1wbGVtZW50cyBhcGkuUHJvZ3JhbSB7XG4gIHJlYWRvbmx5IGNvbXBpbGVyOiBOZ0NvbXBpbGVyO1xuXG4gIC8qKlxuICAgKiBUaGUgcHJpbWFyeSBUeXBlU2NyaXB0IHByb2dyYW0sIHdoaWNoIGlzIHVzZWQgZm9yIGFuYWx5c2lzIGFuZCBlbWl0LlxuICAgKi9cbiAgcHJpdmF0ZSB0c1Byb2dyYW06IHRzLlByb2dyYW07XG5cbiAgcHJpdmF0ZSBjbG9zdXJlQ29tcGlsZXJFbmFibGVkOiBib29sZWFuO1xuICBwcml2YXRlIGhvc3Q6IE5nQ29tcGlsZXJIb3N0O1xuICBwcml2YXRlIGluY3JlbWVudGFsU3RyYXRlZ3k6IFRyYWNrZWRJbmNyZW1lbnRhbEJ1aWxkU3RyYXRlZ3k7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICByb290TmFtZXM6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPiwgcHJpdmF0ZSBvcHRpb25zOiBOZ0NvbXBpbGVyT3B0aW9ucyxcbiAgICAgIGRlbGVnYXRlSG9zdDogYXBpLkNvbXBpbGVySG9zdCwgb2xkUHJvZ3JhbT86IE5ndHNjUHJvZ3JhbSkge1xuICAgIGNvbnN0IHBlcmZSZWNvcmRlciA9IEFjdGl2ZVBlcmZSZWNvcmRlci56ZXJvZWRUb05vdygpO1xuXG4gICAgcGVyZlJlY29yZGVyLnBoYXNlKFBlcmZQaGFzZS5TZXR1cCk7XG5cbiAgICAvLyBGaXJzdCwgY2hlY2sgd2hldGhlciB0aGUgY3VycmVudCBUUyB2ZXJzaW9uIGlzIHN1cHBvcnRlZC5cbiAgICBpZiAoIW9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2spIHtcbiAgICAgIHZlcmlmeVN1cHBvcnRlZFR5cGVTY3JpcHRWZXJzaW9uKCk7XG4gICAgfVxuXG4gICAgdGhpcy5jbG9zdXJlQ29tcGlsZXJFbmFibGVkID0gISFvcHRpb25zLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyO1xuXG4gICAgY29uc3QgcmV1c2VQcm9ncmFtID0gb2xkUHJvZ3JhbT8uY29tcGlsZXIuZ2V0Q3VycmVudFByb2dyYW0oKTtcbiAgICB0aGlzLmhvc3QgPSBOZ0NvbXBpbGVySG9zdC53cmFwKGRlbGVnYXRlSG9zdCwgcm9vdE5hbWVzLCBvcHRpb25zLCByZXVzZVByb2dyYW0gPz8gbnVsbCk7XG5cbiAgICBpZiAocmV1c2VQcm9ncmFtICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFByaW9yIHRvIHJldXNpbmcgdGhlIG9sZCBwcm9ncmFtLCByZXN0b3JlIHNoaW0gdGFnZ2luZyBmb3IgYWxsIGl0cyBgdHMuU291cmNlRmlsZWBzLlxuICAgICAgLy8gVHlwZVNjcmlwdCBjaGVja3MgdGhlIGByZWZlcmVuY2VkRmlsZXNgIG9mIGB0cy5Tb3VyY2VGaWxlYHMgZm9yIGNoYW5nZXMgd2hlbiBldmFsdWF0aW5nXG4gICAgICAvLyBpbmNyZW1lbnRhbCByZXVzZSBvZiBkYXRhIGZyb20gdGhlIG9sZCBwcm9ncmFtLCBzbyBpdCdzIGltcG9ydGFudCB0aGF0IHRoZXNlIG1hdGNoIGluIG9yZGVyXG4gICAgICAvLyB0byBnZXQgdGhlIG1vc3QgYmVuZWZpdCBvdXQgb2YgcmV1c2UuXG4gICAgICByZXRhZ0FsbFRzRmlsZXMocmV1c2VQcm9ncmFtKTtcbiAgICB9XG5cbiAgICB0aGlzLnRzUHJvZ3JhbSA9IHBlcmZSZWNvcmRlci5pblBoYXNlKFxuICAgICAgICBQZXJmUGhhc2UuVHlwZVNjcmlwdFByb2dyYW1DcmVhdGUsXG4gICAgICAgICgpID0+IHRzLmNyZWF0ZVByb2dyYW0odGhpcy5ob3N0LmlucHV0RmlsZXMsIG9wdGlvbnMsIHRoaXMuaG9zdCwgcmV1c2VQcm9ncmFtKSk7XG5cbiAgICBwZXJmUmVjb3JkZXIucGhhc2UoUGVyZlBoYXNlLlVuYWNjb3VudGVkKTtcbiAgICBwZXJmUmVjb3JkZXIubWVtb3J5KFBlcmZDaGVja3BvaW50LlR5cGVTY3JpcHRQcm9ncmFtQ3JlYXRlKTtcblxuICAgIHRoaXMuaG9zdC5wb3N0UHJvZ3JhbUNyZWF0aW9uQ2xlYW51cCgpO1xuXG4gICAgLy8gU2hpbSB0YWdnaW5nIGhhcyBzZXJ2ZWQgaXRzIHB1cnBvc2UsIGFuZCB0YWdzIGNhbiBub3cgYmUgcmVtb3ZlZCBmcm9tIGFsbCBgdHMuU291cmNlRmlsZWBzIGluXG4gICAgLy8gdGhlIHByb2dyYW0uXG4gICAgdW50YWdBbGxUc0ZpbGVzKHRoaXMudHNQcm9ncmFtKTtcblxuICAgIGNvbnN0IHByb2dyYW1Ecml2ZXIgPSBuZXcgVHNDcmVhdGVQcm9ncmFtRHJpdmVyKFxuICAgICAgICB0aGlzLnRzUHJvZ3JhbSwgdGhpcy5ob3N0LCB0aGlzLm9wdGlvbnMsIHRoaXMuaG9zdC5zaGltRXh0ZW5zaW9uUHJlZml4ZXMpO1xuXG4gICAgdGhpcy5pbmNyZW1lbnRhbFN0cmF0ZWd5ID0gb2xkUHJvZ3JhbSAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgb2xkUHJvZ3JhbS5pbmNyZW1lbnRhbFN0cmF0ZWd5LnRvTmV4dEJ1aWxkU3RyYXRlZ3koKSA6XG4gICAgICAgIG5ldyBUcmFja2VkSW5jcmVtZW50YWxCdWlsZFN0cmF0ZWd5KCk7XG4gICAgY29uc3QgbW9kaWZpZWRSZXNvdXJjZUZpbGVzID0gbmV3IFNldDxBYnNvbHV0ZUZzUGF0aD4oKTtcbiAgICBpZiAodGhpcy5ob3N0LmdldE1vZGlmaWVkUmVzb3VyY2VGaWxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBzdHJpbmdzID0gdGhpcy5ob3N0LmdldE1vZGlmaWVkUmVzb3VyY2VGaWxlcygpO1xuICAgICAgaWYgKHN0cmluZ3MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGVTdHJpbmcgb2Ygc3RyaW5ncykge1xuICAgICAgICAgIG1vZGlmaWVkUmVzb3VyY2VGaWxlcy5hZGQoYWJzb2x1dGVGcm9tKGZpbGVTdHJpbmcpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGxldCB0aWNrZXQ6IENvbXBpbGF0aW9uVGlja2V0O1xuICAgIGlmIChvbGRQcm9ncmFtID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRpY2tldCA9IGZyZXNoQ29tcGlsYXRpb25UaWNrZXQoXG4gICAgICAgICAgdGhpcy50c1Byb2dyYW0sIG9wdGlvbnMsIHRoaXMuaW5jcmVtZW50YWxTdHJhdGVneSwgcHJvZ3JhbURyaXZlciwgcGVyZlJlY29yZGVyLFxuICAgICAgICAgIC8qIGVuYWJsZVRlbXBsYXRlVHlwZUNoZWNrZXIgKi8gZmFsc2UsIC8qIHVzZVBvaXNvbmVkRGF0YSAqLyBmYWxzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRpY2tldCA9IGluY3JlbWVudGFsRnJvbUNvbXBpbGVyVGlja2V0KFxuICAgICAgICAgIG9sZFByb2dyYW0uY29tcGlsZXIsXG4gICAgICAgICAgdGhpcy50c1Byb2dyYW0sXG4gICAgICAgICAgdGhpcy5pbmNyZW1lbnRhbFN0cmF0ZWd5LFxuICAgICAgICAgIHByb2dyYW1Ecml2ZXIsXG4gICAgICAgICAgbW9kaWZpZWRSZXNvdXJjZUZpbGVzLFxuICAgICAgICAgIHBlcmZSZWNvcmRlcixcbiAgICAgICk7XG4gICAgfVxuXG5cbiAgICAvLyBDcmVhdGUgdGhlIE5nQ29tcGlsZXIgd2hpY2ggd2lsbCBkcml2ZSB0aGUgcmVzdCBvZiB0aGUgY29tcGlsYXRpb24uXG4gICAgdGhpcy5jb21waWxlciA9IE5nQ29tcGlsZXIuZnJvbVRpY2tldCh0aWNrZXQsIHRoaXMuaG9zdCk7XG4gIH1cblxuICBnZXRUc1Byb2dyYW0oKTogdHMuUHJvZ3JhbSB7XG4gICAgcmV0dXJuIHRoaXMudHNQcm9ncmFtO1xuICB9XG5cbiAgZ2V0UmV1c2VUc1Byb2dyYW0oKTogdHMuUHJvZ3JhbSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZXIuZ2V0Q3VycmVudFByb2dyYW0oKTtcbiAgfVxuXG4gIGdldFRzT3B0aW9uRGlhZ25vc3RpY3MoY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbnxcbiAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQpOiByZWFkb25seSB0cy5EaWFnbm9zdGljW10ge1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5pblBoYXNlKFxuICAgICAgICBQZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzLFxuICAgICAgICAoKSA9PiB0aGlzLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoY2FuY2VsbGF0aW9uVG9rZW4pKTtcbiAgfVxuXG4gIGdldFRzU3ludGFjdGljRGlhZ25vc3RpY3MoXG4gICAgICBzb3VyY2VGaWxlPzogdHMuU291cmNlRmlsZXx1bmRlZmluZWQsXG4gICAgICBjYW5jZWxsYXRpb25Ub2tlbj86IHRzLkNhbmNlbGxhdGlvblRva2VufHVuZGVmaW5lZCk6IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZXIucGVyZlJlY29yZGVyLmluUGhhc2UoUGVyZlBoYXNlLlR5cGVTY3JpcHREaWFnbm9zdGljcywgKCkgPT4ge1xuICAgICAgY29uc3QgaWdub3JlZEZpbGVzID0gdGhpcy5jb21waWxlci5pZ25vcmVGb3JEaWFnbm9zdGljcztcbiAgICAgIGxldCByZXM6IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGlnbm9yZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICByZXMgPSB0aGlzLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlLCBjYW5jZWxsYXRpb25Ub2tlbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc2Ygb2YgdGhpcy50c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgICAgIGlmICghaWdub3JlZEZpbGVzLmhhcyhzZikpIHtcbiAgICAgICAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udGhpcy50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YsIGNhbmNlbGxhdGlvblRva2VuKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlcyA9IGRpYWdub3N0aWNzO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9KTtcbiAgfVxuXG4gIGdldFRzU2VtYW50aWNEaWFnbm9zdGljcyhcbiAgICAgIHNvdXJjZUZpbGU/OiB0cy5Tb3VyY2VGaWxlfHVuZGVmaW5lZCxcbiAgICAgIGNhbmNlbGxhdGlvblRva2VuPzogdHMuQ2FuY2VsbGF0aW9uVG9rZW58dW5kZWZpbmVkKTogcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdIHtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlci5wZXJmUmVjb3JkZXIuaW5QaGFzZShQZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzLCAoKSA9PiB7XG4gICAgICBjb25zdCBpZ25vcmVkRmlsZXMgPSB0aGlzLmNvbXBpbGVyLmlnbm9yZUZvckRpYWdub3N0aWNzO1xuICAgICAgbGV0IHJlczogcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoaWdub3JlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcyA9IHRoaXMudHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSwgY2FuY2VsbGF0aW9uVG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHNmIG9mIHRoaXMudHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICBpZiAoIWlnbm9yZWRGaWxlcy5oYXMoc2YpKSB7XG4gICAgICAgICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRoaXMudHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YsIGNhbmNlbGxhdGlvblRva2VuKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlcyA9IGRpYWdub3N0aWNzO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9KTtcbiAgfVxuXG4gIGdldE5nT3B0aW9uRGlhZ25vc3RpY3MoY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbnxcbiAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQpOiByZWFkb25seSh0cy5EaWFnbm9zdGljfGFwaS5EaWFnbm9zdGljKVtdIHtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlci5nZXRPcHRpb25EaWFnbm9zdGljcygpO1xuICB9XG5cbiAgZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbnxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkKTogcmVhZG9ubHkgYXBpLkRpYWdub3N0aWNbXSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKFxuICAgICAgZmlsZU5hbWU/OiBzdHJpbmd8dW5kZWZpbmVkLCBjYW5jZWxsYXRpb25Ub2tlbj86IHRzLkNhbmNlbGxhdGlvblRva2VufHVuZGVmaW5lZCk6XG4gICAgICByZWFkb25seSh0cy5EaWFnbm9zdGljfGFwaS5EaWFnbm9zdGljKVtdIHtcbiAgICBsZXQgc2Y6IHRzLlNvdXJjZUZpbGV8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChmaWxlTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzZiA9IHRoaXMudHNQcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZU5hbWUpO1xuICAgICAgaWYgKHNmID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gVGhlcmUgYXJlIG5vIGRpYWdub3N0aWNzIGZvciBmaWxlcyB3aGljaCBkb24ndCBleGlzdCBpbiB0aGUgcHJvZ3JhbSAtIG1heWJlIHRoZSBjYWxsZXJcbiAgICAgICAgLy8gaGFzIHN0YWxlIGRhdGE/XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2YgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29tcGlsZXIuZ2V0RGlhZ25vc3RpY3MoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuY29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNmLCBPcHRpbWl6ZUZvci5XaG9sZVByb2dyYW0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFbnN1cmUgdGhhdCB0aGUgYE5nQ29tcGlsZXJgIGhhcyBwcm9wZXJseSBhbmFseXplZCB0aGUgcHJvZ3JhbSwgYW5kIGFsbG93IGZvciB0aGUgYXN5bmNocm9ub3VzXG4gICAqIGxvYWRpbmcgb2YgYW55IHJlc291cmNlcyBkdXJpbmcgdGhlIHByb2Nlc3MuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZCBieSB0aGUgQW5ndWxhciBDTEkgdG8gYWxsb3cgZm9yIHNwYXduaW5nIChhc3luYykgY2hpbGQgY29tcGlsYXRpb25zIGZvciB0aGluZ3NcbiAgICogbGlrZSBTQVNTIGZpbGVzIHVzZWQgaW4gYHN0eWxlVXJsc2AuXG4gICAqL1xuICBsb2FkTmdTdHJ1Y3R1cmVBc3luYygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlci5hbmFseXplQXN5bmMoKTtcbiAgfVxuXG4gIGxpc3RMYXp5Um91dGVzKGVudHJ5Um91dGU/OiBzdHJpbmd8dW5kZWZpbmVkKTogYXBpLkxhenlSb3V0ZVtdIHtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlci5saXN0TGF6eVJvdXRlcyhlbnRyeVJvdXRlKTtcbiAgfVxuXG4gIHByaXZhdGUgZW1pdFhpMThuKCk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IG5ldyBNZXNzYWdlQnVuZGxlKG5ldyBIdG1sUGFyc2VyKCksIFtdLCB7fSwgdGhpcy5vcHRpb25zLmkxOG5PdXRMb2NhbGUgPz8gbnVsbCk7XG4gICAgdGhpcy5jb21waWxlci54aTE4bihjdHgpO1xuICAgIGkxOG5FeHRyYWN0KFxuICAgICAgICB0aGlzLm9wdGlvbnMuaTE4bk91dEZvcm1hdCA/PyBudWxsLCB0aGlzLm9wdGlvbnMuaTE4bk91dEZpbGUgPz8gbnVsbCwgdGhpcy5ob3N0LFxuICAgICAgICB0aGlzLm9wdGlvbnMsIGN0eCwgcmVzb2x2ZSk7XG4gIH1cblxuICBlbWl0KG9wdHM/OiB7XG4gICAgZW1pdEZsYWdzPzogYXBpLkVtaXRGbGFnc3x1bmRlZmluZWQ7XG4gICAgY2FuY2VsbGF0aW9uVG9rZW4/OiB0cy5DYW5jZWxsYXRpb25Ub2tlbiB8IHVuZGVmaW5lZDtcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnM/OiBhcGkuQ3VzdG9tVHJhbnNmb3JtZXJzIHwgdW5kZWZpbmVkO1xuICAgIGVtaXRDYWxsYmFjaz86IGFwaS5Uc0VtaXRDYWxsYmFjayB8IHVuZGVmaW5lZDtcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s/OiBhcGkuVHNNZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2sgfCB1bmRlZmluZWQ7XG4gIH18dW5kZWZpbmVkKTogdHMuRW1pdFJlc3VsdCB7XG4gICAgLy8gQ2hlY2sgaWYgZW1pc3Npb24gb2YgdGhlIGkxOG4gbWVzc2FnZXMgYnVuZGxlIHdhcyByZXF1ZXN0ZWQuXG4gICAgaWYgKG9wdHMgIT09IHVuZGVmaW5lZCAmJiBvcHRzLmVtaXRGbGFncyAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgIG9wdHMuZW1pdEZsYWdzICYgYXBpLkVtaXRGbGFncy5JMThuQnVuZGxlKSB7XG4gICAgICB0aGlzLmVtaXRYaTE4bigpO1xuXG4gICAgICAvLyBgYXBpLkVtaXRGbGFnc2AgaXMgYSBWaWV3IEVuZ2luZSBjb21waWxlciBjb25jZXB0LiBXZSBvbmx5IHBheSBhdHRlbnRpb24gdG8gdGhlIGFic2VuY2Ugb2ZcbiAgICAgIC8vIHRoZSBvdGhlciBmbGFncyBoZXJlIGlmIGkxOG4gZW1pdCB3YXMgcmVxdWVzdGVkIChzaW5jZSB0aGlzIGlzIHVzdWFsbHkgZG9uZSBpbiB0aGUgeGkxOG5cbiAgICAgIC8vIGZsb3csIHdoZXJlIHdlIGRvbid0IHdhbnQgdG8gZW1pdCBKUyBhdCBhbGwpLlxuICAgICAgaWYgKCEob3B0cy5lbWl0RmxhZ3MgJiBhcGkuRW1pdEZsYWdzLkpTKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRpYWdub3N0aWNzOiBbXSxcbiAgICAgICAgICBlbWl0U2tpcHBlZDogdHJ1ZSxcbiAgICAgICAgICBlbWl0dGVkRmlsZXM6IFtdLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY29tcGlsZXIucGVyZlJlY29yZGVyLm1lbW9yeShQZXJmQ2hlY2twb2ludC5QcmVFbWl0KTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuY29tcGlsZXIucGVyZlJlY29yZGVyLmluUGhhc2UoUGVyZlBoYXNlLlR5cGVTY3JpcHRFbWl0LCAoKSA9PiB7XG4gICAgICBjb25zdCB7dHJhbnNmb3JtZXJzfSA9IHRoaXMuY29tcGlsZXIucHJlcGFyZUVtaXQoKTtcbiAgICAgIGNvbnN0IGlnbm9yZUZpbGVzID0gdGhpcy5jb21waWxlci5pZ25vcmVGb3JFbWl0O1xuICAgICAgY29uc3QgZW1pdENhbGxiYWNrID0gb3B0cyAmJiBvcHRzLmVtaXRDYWxsYmFjayB8fCBkZWZhdWx0RW1pdENhbGxiYWNrO1xuXG4gICAgICBjb25zdCB3cml0ZUZpbGU6IHRzLldyaXRlRmlsZUNhbGxiYWNrID1cbiAgICAgICAgICAoZmlsZU5hbWU6IHN0cmluZywgZGF0YTogc3RyaW5nLCB3cml0ZUJ5dGVPcmRlck1hcms6IGJvb2xlYW4sXG4gICAgICAgICAgIG9uRXJyb3I6ICgobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkKXx1bmRlZmluZWQsXG4gICAgICAgICAgIHNvdXJjZUZpbGVzOiBSZWFkb25seUFycmF5PHRzLlNvdXJjZUZpbGU+fHVuZGVmaW5lZCkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZUZpbGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgLy8gUmVjb3JkIHN1Y2Nlc3NmdWwgd3JpdGVzIGZvciBhbnkgYHRzLlNvdXJjZUZpbGVgICh0aGF0J3Mgbm90IGEgZGVjbGFyYXRpb24gZmlsZSlcbiAgICAgICAgICAgICAgLy8gdGhhdCdzIGFuIGlucHV0IHRvIHRoaXMgd3JpdGUuXG4gICAgICAgICAgICAgIGZvciAoY29uc3Qgd3JpdHRlblNmIG9mIHNvdXJjZUZpbGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdyaXR0ZW5TZi5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHdyaXR0ZW5TZik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaG9zdC53cml0ZUZpbGUoZmlsZU5hbWUsIGRhdGEsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgICAgIH07XG5cbiAgICAgIGNvbnN0IGN1c3RvbVRyYW5zZm9ybXMgPSBvcHRzICYmIG9wdHMuY3VzdG9tVHJhbnNmb3JtZXJzO1xuICAgICAgY29uc3QgYmVmb3JlVHJhbnNmb3JtcyA9IHRyYW5zZm9ybWVycy5iZWZvcmUgfHwgW107XG4gICAgICBjb25zdCBhZnRlckRlY2xhcmF0aW9uc1RyYW5zZm9ybXMgPSB0cmFuc2Zvcm1lcnMuYWZ0ZXJEZWNsYXJhdGlvbnM7XG5cbiAgICAgIGlmIChjdXN0b21UcmFuc2Zvcm1zICE9PSB1bmRlZmluZWQgJiYgY3VzdG9tVHJhbnNmb3Jtcy5iZWZvcmVUcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJlZm9yZVRyYW5zZm9ybXMucHVzaCguLi5jdXN0b21UcmFuc2Zvcm1zLmJlZm9yZVRzKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZW1pdFJlc3VsdHM6IHRzLkVtaXRSZXN1bHRbXSA9IFtdO1xuXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFNvdXJjZUZpbGUgb2YgdGhpcy50c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgICBpZiAodGFyZ2V0U291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSB8fCBpZ25vcmVGaWxlcy5oYXModGFyZ2V0U291cmNlRmlsZSkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbXBpbGVyLmluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQodGFyZ2V0U291cmNlRmlsZSkpIHtcbiAgICAgICAgICB0aGlzLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5ldmVudENvdW50KFBlcmZFdmVudC5FbWl0U2tpcFNvdXJjZUZpbGUpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb21waWxlci5wZXJmUmVjb3JkZXIuZXZlbnRDb3VudChQZXJmRXZlbnQuRW1pdFNvdXJjZUZpbGUpO1xuXG4gICAgICAgIGVtaXRSZXN1bHRzLnB1c2goZW1pdENhbGxiYWNrKHtcbiAgICAgICAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgICAgICAgIHByb2dyYW06IHRoaXMudHNQcm9ncmFtLFxuICAgICAgICAgIGhvc3Q6IHRoaXMuaG9zdCxcbiAgICAgICAgICBvcHRpb25zOiB0aGlzLm9wdGlvbnMsXG4gICAgICAgICAgZW1pdE9ubHlEdHNGaWxlczogZmFsc2UsXG4gICAgICAgICAgd3JpdGVGaWxlLFxuICAgICAgICAgIGN1c3RvbVRyYW5zZm9ybWVyczoge1xuICAgICAgICAgICAgYmVmb3JlOiBiZWZvcmVUcmFuc2Zvcm1zLFxuICAgICAgICAgICAgYWZ0ZXI6IGN1c3RvbVRyYW5zZm9ybXMgJiYgY3VzdG9tVHJhbnNmb3Jtcy5hZnRlclRzLFxuICAgICAgICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnM6IGFmdGVyRGVjbGFyYXRpb25zVHJhbnNmb3JtcyxcbiAgICAgICAgICB9IGFzIGFueSxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5tZW1vcnkoUGVyZkNoZWNrcG9pbnQuRW1pdCk7XG5cbiAgICAgIC8vIFJ1biB0aGUgZW1pdCwgaW5jbHVkaW5nIGEgY3VzdG9tIHRyYW5zZm9ybWVyIHRoYXQgd2lsbCBkb3dubGV2ZWwgdGhlIEl2eSBkZWNvcmF0b3JzIGluXG4gICAgICAvLyBjb2RlLlxuICAgICAgcmV0dXJuICgob3B0cyAmJiBvcHRzLm1lcmdlRW1pdFJlc3VsdHNDYWxsYmFjaykgfHwgbWVyZ2VFbWl0UmVzdWx0cykoZW1pdFJlc3VsdHMpO1xuICAgIH0pO1xuXG4gICAgLy8gUmVjb3JkIHBlcmZvcm1hbmNlIGFuYWx5c2lzIGluZm9ybWF0aW9uIHRvIGRpc2sgaWYgd2UndmUgYmVlbiBhc2tlZCB0byBkbyBzby5cbiAgICBpZiAodGhpcy5vcHRpb25zLnRyYWNlUGVyZm9ybWFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgcGVyZiA9IHRoaXMuY29tcGlsZXIucGVyZlJlY29yZGVyLmZpbmFsaXplKCk7XG4gICAgICBnZXRGaWxlU3lzdGVtKCkud3JpdGVGaWxlKFxuICAgICAgICAgIGdldEZpbGVTeXN0ZW0oKS5yZXNvbHZlKHRoaXMub3B0aW9ucy50cmFjZVBlcmZvcm1hbmNlKSwgSlNPTi5zdHJpbmdpZnkocGVyZiwgbnVsbCwgMikpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgZ2V0SW5kZXhlZENvbXBvbmVudHMoKTogTWFwPERlY2xhcmF0aW9uTm9kZSwgSW5kZXhlZENvbXBvbmVudD4ge1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVyLmdldEluZGV4ZWRDb21wb25lbnRzKCk7XG4gIH1cblxuICBnZXRMaWJyYXJ5U3VtbWFyaWVzKCk6IE1hcDxzdHJpbmcsIGFwaS5MaWJyYXJ5U3VtbWFyeT4ge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIGdldEVtaXR0ZWRHZW5lcmF0ZWRGaWxlcygpOiBNYXA8c3RyaW5nLCBHZW5lcmF0ZWRGaWxlPiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgZ2V0RW1pdHRlZFNvdXJjZUZpbGVzKCk6IE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cbn1cblxuY29uc3QgZGVmYXVsdEVtaXRDYWxsYmFjazogYXBpLlRzRW1pdENhbGxiYWNrID0gKHtcbiAgcHJvZ3JhbSxcbiAgdGFyZ2V0U291cmNlRmlsZSxcbiAgd3JpdGVGaWxlLFxuICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgY3VzdG9tVHJhbnNmb3JtZXJzXG59KSA9PlxuICAgIHByb2dyYW0uZW1pdChcbiAgICAgICAgdGFyZ2V0U291cmNlRmlsZSwgd3JpdGVGaWxlLCBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywgY3VzdG9tVHJhbnNmb3JtZXJzKTtcblxuZnVuY3Rpb24gbWVyZ2VFbWl0UmVzdWx0cyhlbWl0UmVzdWx0czogdHMuRW1pdFJlc3VsdFtdKTogdHMuRW1pdFJlc3VsdCB7XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgbGV0IGVtaXRTa2lwcGVkID0gZmFsc2U7XG4gIGNvbnN0IGVtaXR0ZWRGaWxlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBlciBvZiBlbWl0UmVzdWx0cykge1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4uZXIuZGlhZ25vc3RpY3MpO1xuICAgIGVtaXRTa2lwcGVkID0gZW1pdFNraXBwZWQgfHwgZXIuZW1pdFNraXBwZWQ7XG4gICAgZW1pdHRlZEZpbGVzLnB1c2goLi4uKGVyLmVtaXR0ZWRGaWxlcyB8fCBbXSkpO1xuICB9XG5cbiAgcmV0dXJuIHtkaWFnbm9zdGljcywgZW1pdFNraXBwZWQsIGVtaXR0ZWRGaWxlc307XG59XG4iXX0=