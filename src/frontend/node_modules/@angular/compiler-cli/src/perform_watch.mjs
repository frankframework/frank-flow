/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as ts from 'typescript';
import { exitCodeFromResult, performCompilation, readConfiguration } from './perform_compile';
import * as api from './transformers/api';
import { createCompilerHost } from './transformers/entry_points';
import { createMessageDiagnostic } from './transformers/util';
function totalCompilationTimeDiagnostic(timeInMillis) {
    let duration;
    if (timeInMillis > 1000) {
        duration = `${(timeInMillis / 1000).toPrecision(2)}s`;
    }
    else {
        duration = `${timeInMillis}ms`;
    }
    return {
        category: ts.DiagnosticCategory.Message,
        messageText: `Total time: ${duration}`,
        code: api.DEFAULT_ERROR_CODE,
        source: api.SOURCE,
    };
}
export var FileChangeEvent;
(function (FileChangeEvent) {
    FileChangeEvent[FileChangeEvent["Change"] = 0] = "Change";
    FileChangeEvent[FileChangeEvent["CreateDelete"] = 1] = "CreateDelete";
    FileChangeEvent[FileChangeEvent["CreateDeleteDir"] = 2] = "CreateDeleteDir";
})(FileChangeEvent || (FileChangeEvent = {}));
export function createPerformWatchHost(configFileName, reportDiagnostics, existingOptions, createEmitCallback) {
    return {
        reportDiagnostics: reportDiagnostics,
        createCompilerHost: options => createCompilerHost({ options }),
        readConfiguration: () => readConfiguration(configFileName, existingOptions),
        createEmitCallback: options => createEmitCallback ? createEmitCallback(options) : undefined,
        onFileChange: (options, listener, ready) => {
            if (!options.basePath) {
                reportDiagnostics([{
                        category: ts.DiagnosticCategory.Error,
                        messageText: 'Invalid configuration option. baseDir not specified',
                        source: api.SOURCE,
                        code: api.DEFAULT_ERROR_CODE
                    }]);
                return { close: () => { } };
            }
            const watcher = chokidar.watch(options.basePath, {
                // ignore .dotfiles, .js and .map files.
                // can't ignore other files as we e.g. want to recompile if an `.html` file changes as well.
                ignored: /((^[\/\\])\..)|(\.js$)|(\.map$)|(\.metadata\.json|node_modules)/,
                ignoreInitial: true,
                persistent: true,
            });
            watcher.on('all', (event, path) => {
                switch (event) {
                    case 'change':
                        listener(FileChangeEvent.Change, path);
                        break;
                    case 'unlink':
                    case 'add':
                        listener(FileChangeEvent.CreateDelete, path);
                        break;
                    case 'unlinkDir':
                    case 'addDir':
                        listener(FileChangeEvent.CreateDeleteDir, path);
                        break;
                }
            });
            watcher.on('ready', ready);
            return { close: () => watcher.close(), ready };
        },
        setTimeout: (ts.sys.clearTimeout && ts.sys.setTimeout) || setTimeout,
        clearTimeout: (ts.sys.setTimeout && ts.sys.clearTimeout) || clearTimeout,
    };
}
/**
 * The logic in this function is adapted from `tsc.ts` from TypeScript.
 */
export function performWatchCompilation(host) {
    let cachedProgram; // Program cached from last compilation
    let cachedCompilerHost; // CompilerHost cached from last compilation
    let cachedOptions; // CompilerOptions cached from last compilation
    let timerHandleForRecompilation; // Handle for 0.25s wait timer to trigger recompilation
    const ignoreFilesForWatch = new Set();
    const fileCache = new Map();
    const firstCompileResult = doCompilation();
    // Watch basePath, ignoring .dotfiles
    let resolveReadyPromise;
    const readyPromise = new Promise(resolve => resolveReadyPromise = resolve);
    // Note: ! is ok as options are filled after the first compilation
    // Note: ! is ok as resolvedReadyPromise is filled by the previous call
    const fileWatcher = host.onFileChange(cachedOptions.options, watchedFileChanged, resolveReadyPromise);
    return { close, ready: cb => readyPromise.then(cb), firstCompileResult };
    function cacheEntry(fileName) {
        fileName = path.normalize(fileName);
        let entry = fileCache.get(fileName);
        if (!entry) {
            entry = {};
            fileCache.set(fileName, entry);
        }
        return entry;
    }
    function close() {
        fileWatcher.close();
        if (timerHandleForRecompilation) {
            host.clearTimeout(timerHandleForRecompilation.timerHandle);
            timerHandleForRecompilation = undefined;
        }
    }
    // Invoked to perform initial compilation or re-compilation in watch mode
    function doCompilation() {
        if (!cachedOptions) {
            cachedOptions = host.readConfiguration();
        }
        if (cachedOptions.errors && cachedOptions.errors.length) {
            host.reportDiagnostics(cachedOptions.errors);
            return cachedOptions.errors;
        }
        const startTime = Date.now();
        if (!cachedCompilerHost) {
            cachedCompilerHost = host.createCompilerHost(cachedOptions.options);
            const originalWriteFileCallback = cachedCompilerHost.writeFile;
            cachedCompilerHost.writeFile = function (fileName, data, writeByteOrderMark, onError, sourceFiles = []) {
                ignoreFilesForWatch.add(path.normalize(fileName));
                return originalWriteFileCallback(fileName, data, writeByteOrderMark, onError, sourceFiles);
            };
            const originalFileExists = cachedCompilerHost.fileExists;
            cachedCompilerHost.fileExists = function (fileName) {
                const ce = cacheEntry(fileName);
                if (ce.exists == null) {
                    ce.exists = originalFileExists.call(this, fileName);
                }
                return ce.exists;
            };
            const originalGetSourceFile = cachedCompilerHost.getSourceFile;
            cachedCompilerHost.getSourceFile = function (fileName, languageVersion) {
                const ce = cacheEntry(fileName);
                if (!ce.sf) {
                    ce.sf = originalGetSourceFile.call(this, fileName, languageVersion);
                }
                return ce.sf;
            };
            const originalReadFile = cachedCompilerHost.readFile;
            cachedCompilerHost.readFile = function (fileName) {
                const ce = cacheEntry(fileName);
                if (ce.content == null) {
                    ce.content = originalReadFile.call(this, fileName);
                }
                return ce.content;
            };
            // Provide access to the file paths that triggered this rebuild
            cachedCompilerHost.getModifiedResourceFiles = function () {
                if (timerHandleForRecompilation === undefined) {
                    return undefined;
                }
                return timerHandleForRecompilation.modifiedResourceFiles;
            };
        }
        ignoreFilesForWatch.clear();
        const oldProgram = cachedProgram;
        // We clear out the `cachedProgram` here as a
        // program can only be used as `oldProgram` 1x
        cachedProgram = undefined;
        const compileResult = performCompilation({
            rootNames: cachedOptions.rootNames,
            options: cachedOptions.options,
            host: cachedCompilerHost,
            oldProgram: oldProgram,
            emitCallback: host.createEmitCallback(cachedOptions.options)
        });
        if (compileResult.diagnostics.length) {
            host.reportDiagnostics(compileResult.diagnostics);
        }
        const endTime = Date.now();
        if (cachedOptions.options.diagnostics) {
            const totalTime = (endTime - startTime) / 1000;
            host.reportDiagnostics([totalCompilationTimeDiagnostic(endTime - startTime)]);
        }
        const exitCode = exitCodeFromResult(compileResult.diagnostics);
        if (exitCode == 0) {
            cachedProgram = compileResult.program;
            host.reportDiagnostics([createMessageDiagnostic('Compilation complete. Watching for file changes.')]);
        }
        else {
            host.reportDiagnostics([createMessageDiagnostic('Compilation failed. Watching for file changes.')]);
        }
        return compileResult.diagnostics;
    }
    function resetOptions() {
        cachedProgram = undefined;
        cachedCompilerHost = undefined;
        cachedOptions = undefined;
    }
    function watchedFileChanged(event, fileName) {
        const normalizedPath = path.normalize(fileName);
        if (cachedOptions && event === FileChangeEvent.Change &&
            // TODO(chuckj): validate that this is sufficient to skip files that were written.
            // This assumes that the file path we write is the same file path we will receive in the
            // change notification.
            normalizedPath === path.normalize(cachedOptions.project)) {
            // If the configuration file changes, forget everything and start the recompilation timer
            resetOptions();
        }
        else if (event === FileChangeEvent.CreateDelete || event === FileChangeEvent.CreateDeleteDir) {
            // If a file was added or removed, reread the configuration
            // to determine the new list of root files.
            cachedOptions = undefined;
        }
        if (event === FileChangeEvent.CreateDeleteDir) {
            fileCache.clear();
        }
        else {
            fileCache.delete(normalizedPath);
        }
        if (!ignoreFilesForWatch.has(normalizedPath)) {
            // Ignore the file if the file is one that was written by the compiler.
            startTimerForRecompilation(normalizedPath);
        }
    }
    // Upon detecting a file change, wait for 250ms and then perform a recompilation. This gives batch
    // operations (such as saving all modified files in an editor) a chance to complete before we kick
    // off a new compilation.
    function startTimerForRecompilation(changedPath) {
        if (timerHandleForRecompilation) {
            host.clearTimeout(timerHandleForRecompilation.timerHandle);
        }
        else {
            timerHandleForRecompilation = {
                modifiedResourceFiles: new Set(),
                timerHandle: undefined
            };
        }
        timerHandleForRecompilation.timerHandle = host.setTimeout(recompile, 250);
        timerHandleForRecompilation.modifiedResourceFiles.add(changedPath);
    }
    function recompile() {
        host.reportDiagnostics([createMessageDiagnostic('File change detected. Starting incremental compilation.')]);
        doCompilation();
        timerHandleForRecompilation = undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVyZm9ybV93YXRjaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvcGVyZm9ybV93YXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNyQyxPQUFPLEtBQUssSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUM3QixPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQWMsa0JBQWtCLEVBQXVCLGtCQUFrQixFQUE0QixpQkFBaUIsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3hKLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDL0QsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFNUQsU0FBUyw4QkFBOEIsQ0FBQyxZQUFvQjtJQUMxRCxJQUFJLFFBQWdCLENBQUM7SUFDckIsSUFBSSxZQUFZLEdBQUcsSUFBSSxFQUFFO1FBQ3ZCLFFBQVEsR0FBRyxHQUFHLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0tBQ3ZEO1NBQU07UUFDTCxRQUFRLEdBQUcsR0FBRyxZQUFZLElBQUksQ0FBQztLQUNoQztJQUNELE9BQU87UUFDTCxRQUFRLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLE9BQU87UUFDdkMsV0FBVyxFQUFFLGVBQWUsUUFBUSxFQUFFO1FBQ3RDLElBQUksRUFBRSxHQUFHLENBQUMsa0JBQWtCO1FBQzVCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTTtLQUNuQixDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sQ0FBTixJQUFZLGVBSVg7QUFKRCxXQUFZLGVBQWU7SUFD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QXlCO0lBQ3pCLFNBQVMsMEJBQTBCLENBQUMsV0FBbUI7UUFDckQsSUFBSSwyQkFBMkIsRUFBRTtZQUMvQixJQUFJLENBQUMsWUFBWSxDQUFDLDJCQUEyQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQzVEO2FBQU07WUFDTCwyQkFBMkIsR0FBRztnQkFDNUIscUJBQXFCLEVBQUUsSUFBSSxHQUFHLEVBQVU7Z0JBQ3hDLFdBQVcsRUFBRSxTQUFTO2FBQ3ZCLENBQUM7U0FDSDtRQUNELDJCQUEyQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUMxRSwyQkFBMkIsQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVELFNBQVMsU0FBUztRQUNoQixJQUFJLENBQUMsaUJBQWlCLENBQ2xCLENBQUMsdUJBQXVCLENBQUMseURBQXlELENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUYsYUFBYSxFQUFFLENBQUM7UUFDaEIsMkJBQTJCLEdBQUcsU0FBUyxDQUFDO0lBQzFDLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNob2tpZGFyIGZyb20gJ2Nob2tpZGFyJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtEaWFnbm9zdGljcywgZXhpdENvZGVGcm9tUmVzdWx0LCBQYXJzZWRDb25maWd1cmF0aW9uLCBwZXJmb3JtQ29tcGlsYXRpb24sIFBlcmZvcm1Db21waWxhdGlvblJlc3VsdCwgcmVhZENvbmZpZ3VyYXRpb259IGZyb20gJy4vcGVyZm9ybV9jb21waWxlJztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICcuL3RyYW5zZm9ybWVycy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21waWxlckhvc3R9IGZyb20gJy4vdHJhbnNmb3JtZXJzL2VudHJ5X3BvaW50cyc7XG5pbXBvcnQge2NyZWF0ZU1lc3NhZ2VEaWFnbm9zdGljfSBmcm9tICcuL3RyYW5zZm9ybWVycy91dGlsJztcblxuZnVuY3Rpb24gdG90YWxDb21waWxhdGlvblRpbWVEaWFnbm9zdGljKHRpbWVJbk1pbGxpczogbnVtYmVyKTogYXBpLkRpYWdub3N0aWMge1xuICBsZXQgZHVyYXRpb246IHN0cmluZztcbiAgaWYgKHRpbWVJbk1pbGxpcyA+IDEwMDApIHtcbiAgICBkdXJhdGlvbiA9IGAkeyh0aW1lSW5NaWxsaXMgLyAxMDAwKS50b1ByZWNpc2lvbigyKX1zYDtcbiAgfSBlbHNlIHtcbiAgICBkdXJhdGlvbiA9IGAke3RpbWVJbk1pbGxpc31tc2A7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5Lk1lc3NhZ2UsXG4gICAgbWVzc2FnZVRleHQ6IGBUb3RhbCB0aW1lOiAke2R1cmF0aW9ufWAsXG4gICAgY29kZTogYXBpLkRFRkFVTFRfRVJST1JfQ09ERSxcbiAgICBzb3VyY2U6IGFwaS5TT1VSQ0UsXG4gIH07XG59XG5cbmV4cG9ydCBlbnVtIEZpbGVDaGFuZ2VFdmVudCB7XG4gIENoYW5nZSxcbiAgQ3JlYXRlRGVsZXRlLFxuICBDcmVhdGVEZWxldGVEaXIsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVyZm9ybVdhdGNoSG9zdCB7XG4gIHJlcG9ydERpYWdub3N0aWNzKGRpYWdub3N0aWNzOiBEaWFnbm9zdGljcyk6IHZvaWQ7XG4gIHJlYWRDb25maWd1cmF0aW9uKCk6IFBhcnNlZENvbmZpZ3VyYXRpb247XG4gIGNyZWF0ZUNvbXBpbGVySG9zdChvcHRpb25zOiBhcGkuQ29tcGlsZXJPcHRpb25zKTogYXBpLkNvbXBpbGVySG9zdDtcbiAgY3JlYXRlRW1pdENhbGxiYWNrKG9wdGlvbnM6IGFwaS5Db21waWxlck9wdGlvbnMpOiBhcGkuVHNFbWl0Q2FsbGJhY2t8dW5kZWZpbmVkO1xuICBvbkZpbGVDaGFuZ2UoXG4gICAgICBvcHRpb25zOiBhcGkuQ29tcGlsZXJPcHRpb25zLCBsaXN0ZW5lcjogKGV2ZW50OiBGaWxlQ2hhbmdlRXZlbnQsIGZpbGVOYW1lOiBzdHJpbmcpID0+IHZvaWQsXG4gICAgICByZWFkeTogKCkgPT4gdm9pZCk6IHtjbG9zZTogKCkgPT4gdm9pZH07XG4gIHNldFRpbWVvdXQoY2FsbGJhY2s6ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpOiBhbnk7XG4gIGNsZWFyVGltZW91dCh0aW1lb3V0SWQ6IGFueSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQZXJmb3JtV2F0Y2hIb3N0KFxuICAgIGNvbmZpZ0ZpbGVOYW1lOiBzdHJpbmcsIHJlcG9ydERpYWdub3N0aWNzOiAoZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzKSA9PiB2b2lkLFxuICAgIGV4aXN0aW5nT3B0aW9ucz86IHRzLkNvbXBpbGVyT3B0aW9ucyxcbiAgICBjcmVhdGVFbWl0Q2FsbGJhY2s/OiAob3B0aW9uczogYXBpLkNvbXBpbGVyT3B0aW9ucykgPT5cbiAgICAgICAgYXBpLlRzRW1pdENhbGxiYWNrIHwgdW5kZWZpbmVkKTogUGVyZm9ybVdhdGNoSG9zdCB7XG4gIHJldHVybiB7XG4gICAgcmVwb3J0RGlhZ25vc3RpY3M6IHJlcG9ydERpYWdub3N0aWNzLFxuICAgIGNyZWF0ZUNvbXBpbGVySG9zdDogb3B0aW9ucyA9PiBjcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnN9KSxcbiAgICByZWFkQ29uZmlndXJhdGlvbjogKCkgPT4gcmVhZENvbmZpZ3VyYXRpb24oY29uZmlnRmlsZU5hbWUsIGV4aXN0aW5nT3B0aW9ucyksXG4gICAgY3JlYXRlRW1pdENhbGxiYWNrOiBvcHRpb25zID0+IGNyZWF0ZUVtaXRDYWxsYmFjayA/IGNyZWF0ZUVtaXRDYWxsYmFjayhvcHRpb25zKSA6IHVuZGVmaW5lZCxcbiAgICBvbkZpbGVDaGFuZ2U6IChvcHRpb25zLCBsaXN0ZW5lciwgcmVhZHk6ICgpID0+IHZvaWQpID0+IHtcbiAgICAgIGlmICghb3B0aW9ucy5iYXNlUGF0aCkge1xuICAgICAgICByZXBvcnREaWFnbm9zdGljcyhbe1xuICAgICAgICAgIGNhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsXG4gICAgICAgICAgbWVzc2FnZVRleHQ6ICdJbnZhbGlkIGNvbmZpZ3VyYXRpb24gb3B0aW9uLiBiYXNlRGlyIG5vdCBzcGVjaWZpZWQnLFxuICAgICAgICAgIHNvdXJjZTogYXBpLlNPVVJDRSxcbiAgICAgICAgICBjb2RlOiBhcGkuREVGQVVMVF9FUlJPUl9DT0RFXG4gICAgICAgIH1dKTtcbiAgICAgICAgcmV0dXJuIHtjbG9zZTogKCkgPT4ge319O1xuICAgICAgfVxuICAgICAgY29uc3Qgd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKG9wdGlvbnMuYmFzZVBhdGgsIHtcbiAgICAgICAgLy8gaWdub3JlIC5kb3RmaWxlcywgLmpzIGFuZCAubWFwIGZpbGVzLlxuICAgICAgICAvLyBjYW4ndCBpZ25vcmUgb3RoZXIgZmlsZXMgYXMgd2UgZS5nLiB3YW50IHRvIHJlY29tcGlsZSBpZiBhbiBgLmh0bWxgIGZpbGUgY2hhbmdlcyBhcyB3ZWxsLlxuICAgICAgICBpZ25vcmVkOiAvKCheW1xcL1xcXFxdKVxcLi4pfChcXC5qcyQpfChcXC5tYXAkKXwoXFwubWV0YWRhdGFcXC5qc29ufG5vZGVfbW9kdWxlcykvLFxuICAgICAgICBpZ25vcmVJbml0aWFsOiB0cnVlLFxuICAgICAgICBwZXJzaXN0ZW50OiB0cnVlLFxuICAgICAgfSk7XG4gICAgICB3YXRjaGVyLm9uKCdhbGwnLCAoZXZlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgICBjYXNlICdjaGFuZ2UnOlxuICAgICAgICAgICAgbGlzdGVuZXIoRmlsZUNoYW5nZUV2ZW50LkNoYW5nZSwgcGF0aCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICd1bmxpbmsnOlxuICAgICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgICAgICBsaXN0ZW5lcihGaWxlQ2hhbmdlRXZlbnQuQ3JlYXRlRGVsZXRlLCBwYXRoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3VubGlua0Rpcic6XG4gICAgICAgICAgY2FzZSAnYWRkRGlyJzpcbiAgICAgICAgICAgIGxpc3RlbmVyKEZpbGVDaGFuZ2VFdmVudC5DcmVhdGVEZWxldGVEaXIsIHBhdGgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgd2F0Y2hlci5vbigncmVhZHknLCByZWFkeSk7XG4gICAgICByZXR1cm4ge2Nsb3NlOiAoKSA9PiB3YXRjaGVyLmNsb3NlKCksIHJlYWR5fTtcbiAgICB9LFxuICAgIHNldFRpbWVvdXQ6ICh0cy5zeXMuY2xlYXJUaW1lb3V0ICYmIHRzLnN5cy5zZXRUaW1lb3V0KSB8fCBzZXRUaW1lb3V0LFxuICAgIGNsZWFyVGltZW91dDogKHRzLnN5cy5zZXRUaW1lb3V0ICYmIHRzLnN5cy5jbGVhclRpbWVvdXQpIHx8IGNsZWFyVGltZW91dCxcbiAgfTtcbn1cblxuaW50ZXJmYWNlIENhY2hlRW50cnkge1xuICBleGlzdHM/OiBib29sZWFuO1xuICBzZj86IHRzLlNvdXJjZUZpbGU7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBRdWV1ZWRDb21waWxhdGlvbkluZm8ge1xuICB0aW1lckhhbmRsZTogYW55O1xuICBtb2RpZmllZFJlc291cmNlRmlsZXM6IFNldDxzdHJpbmc+O1xufVxuXG4vKipcbiAqIFRoZSBsb2dpYyBpbiB0aGlzIGZ1bmN0aW9uIGlzIGFkYXB0ZWQgZnJvbSBgdHNjLnRzYCBmcm9tIFR5cGVTY3JpcHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwZXJmb3JtV2F0Y2hDb21waWxhdGlvbihob3N0OiBQZXJmb3JtV2F0Y2hIb3N0KTpcbiAgICB7Y2xvc2U6ICgpID0+IHZvaWQsIHJlYWR5OiAoY2I6ICgpID0+IHZvaWQpID0+IHZvaWQsIGZpcnN0Q29tcGlsZVJlc3VsdDogRGlhZ25vc3RpY3N9IHtcbiAgbGV0IGNhY2hlZFByb2dyYW06IGFwaS5Qcm9ncmFtfHVuZGVmaW5lZDsgICAgICAgICAgICAvLyBQcm9ncmFtIGNhY2hlZCBmcm9tIGxhc3QgY29tcGlsYXRpb25cbiAgbGV0IGNhY2hlZENvbXBpbGVySG9zdDogYXBpLkNvbXBpbGVySG9zdHx1bmRlZmluZWQ7ICAvLyBDb21waWxlckhvc3QgY2FjaGVkIGZyb20gbGFzdCBjb21waWxhdGlvblxuICBsZXQgY2FjaGVkT3B0aW9uczogUGFyc2VkQ29uZmlndXJhdGlvbnx1bmRlZmluZWQ7ICAvLyBDb21waWxlck9wdGlvbnMgY2FjaGVkIGZyb20gbGFzdCBjb21waWxhdGlvblxuICBsZXQgdGltZXJIYW5kbGVGb3JSZWNvbXBpbGF0aW9uOiBRdWV1ZWRDb21waWxhdGlvbkluZm98XG4gICAgICB1bmRlZmluZWQ7ICAvLyBIYW5kbGUgZm9yIDAuMjVzIHdhaXQgdGltZXIgdG8gdHJpZ2dlciByZWNvbXBpbGF0aW9uXG5cbiAgY29uc3QgaWdub3JlRmlsZXNGb3JXYXRjaCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQ2FjaGVFbnRyeT4oKTtcblxuICBjb25zdCBmaXJzdENvbXBpbGVSZXN1bHQgPSBkb0NvbXBpbGF0aW9uKCk7XG5cbiAgLy8gV2F0Y2ggYmFzZVBhdGgsIGlnbm9yaW5nIC5kb3RmaWxlc1xuICBsZXQgcmVzb2x2ZVJlYWR5UHJvbWlzZTogKCkgPT4gdm9pZDtcbiAgY29uc3QgcmVhZHlQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiByZXNvbHZlUmVhZHlQcm9taXNlID0gcmVzb2x2ZSk7XG4gIC8vIE5vdGU6ICEgaXMgb2sgYXMgb3B0aW9ucyBhcmUgZmlsbGVkIGFmdGVyIHRoZSBmaXJzdCBjb21waWxhdGlvblxuICAvLyBOb3RlOiAhIGlzIG9rIGFzIHJlc29sdmVkUmVhZHlQcm9taXNlIGlzIGZpbGxlZCBieSB0aGUgcHJldmlvdXMgY2FsbFxuICBjb25zdCBmaWxlV2F0Y2hlciA9XG4gICAgICBob3N0Lm9uRmlsZUNoYW5nZShjYWNoZWRPcHRpb25zIS5vcHRpb25zLCB3YXRjaGVkRmlsZUNoYW5nZWQsIHJlc29sdmVSZWFkeVByb21pc2UhKTtcblxuICByZXR1cm4ge2Nsb3NlLCByZWFkeTogY2IgPT4gcmVhZHlQcm9taXNlLnRoZW4oY2IpLCBmaXJzdENvbXBpbGVSZXN1bHR9O1xuXG4gIGZ1bmN0aW9uIGNhY2hlRW50cnkoZmlsZU5hbWU6IHN0cmluZyk6IENhY2hlRW50cnkge1xuICAgIGZpbGVOYW1lID0gcGF0aC5ub3JtYWxpemUoZmlsZU5hbWUpO1xuICAgIGxldCBlbnRyeSA9IGZpbGVDYWNoZS5nZXQoZmlsZU5hbWUpO1xuICAgIGlmICghZW50cnkpIHtcbiAgICAgIGVudHJ5ID0ge307XG4gICAgICBmaWxlQ2FjaGUuc2V0KGZpbGVOYW1lLCBlbnRyeSk7XG4gICAgfVxuICAgIHJldHVybiBlbnRyeTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsb3NlKCkge1xuICAgIGZpbGVXYXRjaGVyLmNsb3NlKCk7XG4gICAgaWYgKHRpbWVySGFuZGxlRm9yUmVjb21waWxhdGlvbikge1xuICAgICAgaG9zdC5jbGVhclRpbWVvdXQodGltZXJIYW5kbGVGb3JSZWNvbXBpbGF0aW9uLnRpbWVySGFuZGxlKTtcbiAgICAgIHRpbWVySGFuZGxlRm9yUmVjb21waWxhdGlvbiA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICAvLyBJbnZva2VkIHRvIHBlcmZvcm0gaW5pdGlhbCBjb21waWxhdGlvbiBvciByZS1jb21waWxhdGlvbiBpbiB3YXRjaCBtb2RlXG4gIGZ1bmN0aW9uIGRvQ29tcGlsYXRpb24oKTogRGlhZ25vc3RpY3Mge1xuICAgIGlmICghY2FjaGVkT3B0aW9ucykge1xuICAgICAgY2FjaGVkT3B0aW9ucyA9IGhvc3QucmVhZENvbmZpZ3VyYXRpb24oKTtcbiAgICB9XG4gICAgaWYgKGNhY2hlZE9wdGlvbnMuZXJyb3JzICYmIGNhY2hlZE9wdGlvbnMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgaG9zdC5yZXBvcnREaWFnbm9zdGljcyhjYWNoZWRPcHRpb25zLmVycm9ycyk7XG4gICAgICByZXR1cm4gY2FjaGVkT3B0aW9ucy5lcnJvcnM7XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgaWYgKCFjYWNoZWRDb21waWxlckhvc3QpIHtcbiAgICAgIGNhY2hlZENvbXBpbGVySG9zdCA9IGhvc3QuY3JlYXRlQ29tcGlsZXJIb3N0KGNhY2hlZE9wdGlvbnMub3B0aW9ucyk7XG4gICAgICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZUNhbGxiYWNrID0gY2FjaGVkQ29tcGlsZXJIb3N0LndyaXRlRmlsZTtcbiAgICAgIGNhY2hlZENvbXBpbGVySG9zdC53cml0ZUZpbGUgPSBmdW5jdGlvbihcbiAgICAgICAgICBmaWxlTmFtZTogc3RyaW5nLCBkYXRhOiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM6IFJlYWRvbmx5QXJyYXk8dHMuU291cmNlRmlsZT4gPSBbXSkge1xuICAgICAgICBpZ25vcmVGaWxlc0ZvcldhdGNoLmFkZChwYXRoLm5vcm1hbGl6ZShmaWxlTmFtZSkpO1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxXcml0ZUZpbGVDYWxsYmFjayhmaWxlTmFtZSwgZGF0YSwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICB9O1xuICAgICAgY29uc3Qgb3JpZ2luYWxGaWxlRXhpc3RzID0gY2FjaGVkQ29tcGlsZXJIb3N0LmZpbGVFeGlzdHM7XG4gICAgICBjYWNoZWRDb21waWxlckhvc3QuZmlsZUV4aXN0cyA9IGZ1bmN0aW9uKGZpbGVOYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2UgPSBjYWNoZUVudHJ5KGZpbGVOYW1lKTtcbiAgICAgICAgaWYgKGNlLmV4aXN0cyA9PSBudWxsKSB7XG4gICAgICAgICAgY2UuZXhpc3RzID0gb3JpZ2luYWxGaWxlRXhpc3RzLmNhbGwodGhpcywgZmlsZU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjZS5leGlzdHMhO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IG9yaWdpbmFsR2V0U291cmNlRmlsZSA9IGNhY2hlZENvbXBpbGVySG9zdC5nZXRTb3VyY2VGaWxlO1xuICAgICAgY2FjaGVkQ29tcGlsZXJIb3N0LmdldFNvdXJjZUZpbGUgPSBmdW5jdGlvbihcbiAgICAgICAgICBmaWxlTmFtZTogc3RyaW5nLCBsYW5ndWFnZVZlcnNpb246IHRzLlNjcmlwdFRhcmdldCkge1xuICAgICAgICBjb25zdCBjZSA9IGNhY2hlRW50cnkoZmlsZU5hbWUpO1xuICAgICAgICBpZiAoIWNlLnNmKSB7XG4gICAgICAgICAgY2Uuc2YgPSBvcmlnaW5hbEdldFNvdXJjZUZpbGUuY2FsbCh0aGlzLCBmaWxlTmFtZSwgbGFuZ3VhZ2VWZXJzaW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2Uuc2YhO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IG9yaWdpbmFsUmVhZEZpbGUgPSBjYWNoZWRDb21waWxlckhvc3QucmVhZEZpbGU7XG4gICAgICBjYWNoZWRDb21waWxlckhvc3QucmVhZEZpbGUgPSBmdW5jdGlvbihmaWxlTmFtZTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNlID0gY2FjaGVFbnRyeShmaWxlTmFtZSk7XG4gICAgICAgIGlmIChjZS5jb250ZW50ID09IG51bGwpIHtcbiAgICAgICAgICBjZS5jb250ZW50ID0gb3JpZ2luYWxSZWFkRmlsZS5jYWxsKHRoaXMsIGZpbGVOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2UuY29udGVudCE7XG4gICAgICB9O1xuICAgICAgLy8gUHJvdmlkZSBhY2Nlc3MgdG8gdGhlIGZpbGUgcGF0aHMgdGhhdCB0cmlnZ2VyZWQgdGhpcyByZWJ1aWxkXG4gICAgICBjYWNoZWRDb21waWxlckhvc3QuZ2V0TW9kaWZpZWRSZXNvdXJjZUZpbGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aW1lckhhbmRsZUZvclJlY29tcGlsYXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRpbWVySGFuZGxlRm9yUmVjb21waWxhdGlvbi5tb2RpZmllZFJlc291cmNlRmlsZXM7XG4gICAgICB9O1xuICAgIH1cbiAgICBpZ25vcmVGaWxlc0ZvcldhdGNoLmNsZWFyKCk7XG4gICAgY29uc3Qgb2xkUHJvZ3JhbSA9IGNhY2hlZFByb2dyYW07XG4gICAgLy8gV2UgY2xlYXIgb3V0IHRoZSBgY2FjaGVkUHJvZ3JhbWAgaGVyZSBhcyBhXG4gICAgLy8gcHJvZ3JhbSBjYW4gb25seSBiZSB1c2VkIGFzIGBvbGRQcm9ncmFtYCAxeFxuICAgIGNhY2hlZFByb2dyYW0gPSB1bmRlZmluZWQ7XG4gICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IHBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgICByb290TmFtZXM6IGNhY2hlZE9wdGlvbnMucm9vdE5hbWVzLFxuICAgICAgb3B0aW9uczogY2FjaGVkT3B0aW9ucy5vcHRpb25zLFxuICAgICAgaG9zdDogY2FjaGVkQ29tcGlsZXJIb3N0LFxuICAgICAgb2xkUHJvZ3JhbTogb2xkUHJvZ3JhbSxcbiAgICAgIGVtaXRDYWxsYmFjazogaG9zdC5jcmVhdGVFbWl0Q2FsbGJhY2soY2FjaGVkT3B0aW9ucy5vcHRpb25zKVxuICAgIH0pO1xuXG4gICAgaWYgKGNvbXBpbGVSZXN1bHQuZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgICBob3N0LnJlcG9ydERpYWdub3N0aWNzKGNvbXBpbGVSZXN1bHQuZGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGNvbnN0IGVuZFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGlmIChjYWNoZWRPcHRpb25zLm9wdGlvbnMuZGlhZ25vc3RpY3MpIHtcbiAgICAgIGNvbnN0IHRvdGFsVGltZSA9IChlbmRUaW1lIC0gc3RhcnRUaW1lKSAvIDEwMDA7XG4gICAgICBob3N0LnJlcG9ydERpYWdub3N0aWNzKFt0b3RhbENvbXBpbGF0aW9uVGltZURpYWdub3N0aWMoZW5kVGltZSAtIHN0YXJ0VGltZSldKTtcbiAgICB9XG4gICAgY29uc3QgZXhpdENvZGUgPSBleGl0Q29kZUZyb21SZXN1bHQoY29tcGlsZVJlc3VsdC5kaWFnbm9zdGljcyk7XG4gICAgaWYgKGV4aXRDb2RlID09IDApIHtcbiAgICAgIGNhY2hlZFByb2dyYW0gPSBjb21waWxlUmVzdWx0LnByb2dyYW07XG4gICAgICBob3N0LnJlcG9ydERpYWdub3N0aWNzKFxuICAgICAgICAgIFtjcmVhdGVNZXNzYWdlRGlhZ25vc3RpYygnQ29tcGlsYXRpb24gY29tcGxldGUuIFdhdGNoaW5nIGZvciBmaWxlIGNoYW5nZXMuJyldKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaG9zdC5yZXBvcnREaWFnbm9zdGljcyhcbiAgICAgICAgICBbY3JlYXRlTWVzc2FnZURpYWdub3N0aWMoJ0NvbXBpbGF0aW9uIGZhaWxlZC4gV2F0Y2hpbmcgZm9yIGZpbGUgY2hhbmdlcy4nKV0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb21waWxlUmVzdWx0LmRpYWdub3N0aWNzO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVzZXRPcHRpb25zKCkge1xuICAgIGNhY2hlZFByb2dyYW0gPSB1bmRlZmluZWQ7XG4gICAgY2FjaGVkQ29tcGlsZXJIb3N0ID0gdW5kZWZpbmVkO1xuICAgIGNhY2hlZE9wdGlvbnMgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBmdW5jdGlvbiB3YXRjaGVkRmlsZUNoYW5nZWQoZXZlbnQ6IEZpbGVDaGFuZ2VFdmVudCwgZmlsZU5hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gcGF0aC5ub3JtYWxpemUoZmlsZU5hbWUpO1xuXG4gICAgaWYgKGNhY2hlZE9wdGlvbnMgJiYgZXZlbnQgPT09IEZpbGVDaGFuZ2VFdmVudC5DaGFuZ2UgJiZcbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiB2YWxpZGF0ZSB0aGF0IHRoaXMgaXMgc3VmZmljaWVudCB0byBza2lwIGZpbGVzIHRoYXQgd2VyZSB3cml0dGVuLlxuICAgICAgICAvLyBUaGlzIGFzc3VtZXMgdGhhdCB0aGUgZmlsZSBwYXRoIHdlIHdyaXRlIGlzIHRoZSBzYW1lIGZpbGUgcGF0aCB3ZSB3aWxsIHJlY2VpdmUgaW4gdGhlXG4gICAgICAgIC8vIGNoYW5nZSBub3RpZmljYXRpb24uXG4gICAgICAgIG5vcm1hbGl6ZWRQYXRoID09PSBwYXRoLm5vcm1hbGl6ZShjYWNoZWRPcHRpb25zLnByb2plY3QpKSB7XG4gICAgICAvLyBJZiB0aGUgY29uZmlndXJhdGlvbiBmaWxlIGNoYW5nZXMsIGZvcmdldCBldmVyeXRoaW5nIGFuZCBzdGFydCB0aGUgcmVjb21waWxhdGlvbiB0aW1lclxuICAgICAgcmVzZXRPcHRpb25zKCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgZXZlbnQgPT09IEZpbGVDaGFuZ2VFdmVudC5DcmVhdGVEZWxldGUgfHwgZXZlbnQgPT09IEZpbGVDaGFuZ2VFdmVudC5DcmVhdGVEZWxldGVEaXIpIHtcbiAgICAgIC8vIElmIGEgZmlsZSB3YXMgYWRkZWQgb3IgcmVtb3ZlZCwgcmVyZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICAvLyB0byBkZXRlcm1pbmUgdGhlIG5ldyBsaXN0IG9mIHJvb3QgZmlsZXMuXG4gICAgICBjYWNoZWRPcHRpb25zID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmIChldmVudCA9PT0gRmlsZUNoYW5nZUV2ZW50LkNyZWF0ZURlbGV0ZURpcikge1xuICAgICAgZmlsZUNhY2hlLmNsZWFyKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbGVDYWNoZS5kZWxldGUobm9ybWFsaXplZFBhdGgpO1xuICAgIH1cblxuICAgIGlmICghaWdub3JlRmlsZXNGb3JXYXRjaC5oYXMobm9ybWFsaXplZFBhdGgpKSB7XG4gICAgICAvLyBJZ25vcmUgdGhlIGZpbGUgaWYgdGhlIGZpbGUgaXMgb25lIHRoYXQgd2FzIHdyaXR0ZW4gYnkgdGhlIGNvbXBpbGVyLlxuICAgICAgc3RhcnRUaW1lckZvclJlY29tcGlsYXRpb24obm9ybWFsaXplZFBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFVwb24gZGV0ZWN0aW5nIGEgZmlsZSBjaGFuZ2UsIHdhaXQgZm9yIDI1MG1zIGFuZCB0aGVuIHBlcmZvcm0gYSByZWNvbXBpbGF0aW9uLiBUaGlzIGdpdmVzIGJhdGNoXG4gIC8vIG9wZXJhdGlvbnMgKHN1Y2ggYXMgc2F2aW5nIGFsbCBtb2RpZmllZCBmaWxlcyBpbiBhbiBlZGl0b3IpIGEgY2hhbmNlIHRvIGNvbXBsZXRlIGJlZm9yZSB3ZSBraWNrXG4gIC8vIG9mZiBhIG5ldyBjb21waWxhdGlvbi5cbiAgZnVuY3Rpb24gc3RhcnRUaW1lckZvclJlY29tcGlsYXRpb24oY2hhbmdlZFBhdGg6IHN0cmluZykge1xuICAgIGlmICh0aW1lckhhbmRsZUZvclJlY29tcGlsYXRpb24pIHtcbiAgICAgIGhvc3QuY2xlYXJUaW1lb3V0KHRpbWVySGFuZGxlRm9yUmVjb21waWxhdGlvbi50aW1lckhhbmRsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRpbWVySGFuZGxlRm9yUmVjb21waWxhdGlvbiA9IHtcbiAgICAgICAgbW9kaWZpZWRSZXNvdXJjZUZpbGVzOiBuZXcgU2V0PHN0cmluZz4oKSxcbiAgICAgICAgdGltZXJIYW5kbGU6IHVuZGVmaW5lZFxuICAgICAgfTtcbiAgICB9XG4gICAgdGltZXJIYW5kbGVGb3JSZWNvbXBpbGF0aW9uLnRpbWVySGFuZGxlID0gaG9zdC5zZXRUaW1lb3V0KHJlY29tcGlsZSwgMjUwKTtcbiAgICB0aW1lckhhbmRsZUZvclJlY29tcGlsYXRpb24ubW9kaWZpZWRSZXNvdXJjZUZpbGVzLmFkZChjaGFuZ2VkUGF0aCk7XG4gIH1cblxuICBmdW5jdGlvbiByZWNvbXBpbGUoKSB7XG4gICAgaG9zdC5yZXBvcnREaWFnbm9zdGljcyhcbiAgICAgICAgW2NyZWF0ZU1lc3NhZ2VEaWFnbm9zdGljKCdGaWxlIGNoYW5nZSBkZXRlY3RlZC4gU3RhcnRpbmcgaW5jcmVtZW50YWwgY29tcGlsYXRpb24uJyldKTtcbiAgICBkb0NvbXBpbGF0aW9uKCk7XG4gICAgdGltZXJIYW5kbGVGb3JSZWNvbXBpbGF0aW9uID0gdW5kZWZpbmVkO1xuICB9XG59XG4iXX0=