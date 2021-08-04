/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
import { __awaiter } from "tslib";
import * as cluster from 'cluster';
import { parseCommandLineOptions } from '../../command_line_options';
import { getSharedSetup } from '../../ngcc_options';
import { getCreateCompileFn } from '../create_compile_function';
import { stringifyTask } from '../tasks/utils';
import { ClusterWorkerPackageJsonUpdater } from './package_json_updater';
import { sendMessageToMaster } from './utils';
// Cluster worker entry point
if (require.main === module) {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        process.title = 'ngcc (worker)';
        try {
            const { logger, pathMappings, enableI18nLegacyMessageIdFormat, fileSystem, tsConfig, getFileWriter, } = getSharedSetup(parseCommandLineOptions(process.argv.slice(2)));
            // NOTE: To avoid file corruption, `ngcc` invocation only creates _one_ instance of
            // `PackageJsonUpdater` that actually writes to disk (across all processes).
            // In cluster workers we use a `PackageJsonUpdater` that delegates to the cluster master.
            const pkgJsonUpdater = new ClusterWorkerPackageJsonUpdater();
            const fileWriter = getFileWriter(pkgJsonUpdater);
            // The function for creating the `compile()` function.
            const createCompileFn = getCreateCompileFn(fileSystem, logger, fileWriter, enableI18nLegacyMessageIdFormat, tsConfig, pathMappings);
            yield startWorker(logger, createCompileFn);
            process.exitCode = 0;
        }
        catch (e) {
            console.error(e.stack || e.message);
            process.exit(1);
        }
    }))();
}
export function startWorker(logger, createCompileFn) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cluster.isMaster) {
            throw new Error('Tried to run cluster worker on the master process.');
        }
        const compile = createCompileFn(transformedFiles => sendMessageToMaster({
            type: 'transformed-files',
            files: transformedFiles.map(f => f.path),
        }), (_task, outcome, message) => sendMessageToMaster({ type: 'task-completed', outcome, message }));
        // Listen for `ProcessTaskMessage`s and process tasks.
        cluster.worker.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            try {
                switch (msg.type) {
                    case 'process-task':
                        logger.debug(`[Worker #${cluster.worker.id}] Processing task: ${stringifyTask(msg.task)}`);
                        return yield compile(msg.task);
                    default:
                        throw new Error(`[Worker #${cluster.worker.id}] Invalid message received: ${JSON.stringify(msg)}`);
                }
            }
            catch (err) {
                switch (err && err.code) {
                    case 'ENOMEM':
                        // Not being able to allocate enough memory is not necessarily a problem with processing
                        // the current task. It could just mean that there are too many tasks being processed
                        // simultaneously.
                        //
                        // Exit with an error and let the cluster master decide how to handle this.
                        logger.warn(`[Worker #${cluster.worker.id}] ${err.stack || err.message}`);
                        return process.exit(1);
                    default:
                        yield sendMessageToMaster({
                            type: 'error',
                            error: (err instanceof Error) ? (err.stack || err.message) : err,
                        });
                }
            }
        }));
        // Return a promise that is never resolved.
        return new Promise(() => undefined);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2V4ZWN1dGlvbi9jbHVzdGVyL3dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCw4QkFBOEI7O0FBRTlCLE9BQU8sS0FBSyxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBR25DLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ25FLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUVsRCxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUM5RCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFHN0MsT0FBTyxFQUFDLCtCQUErQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDdkUsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRTVDLDZCQUE2QjtBQUM3QixJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO0lBQzNCLENBQUMsR0FBUyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEtBQUssR0FBRyxlQUFlLENBQUM7UUFFaEMsSUFBSTtZQUNGLE1BQU0sRUFDSixNQUFNLEVBQ04sWUFBWSxFQUNaLCtCQUErQixFQUMvQixVQUFVLEVBQ1YsUUFBUSxFQUNSLGFBQWEsR0FDZCxHQUFHLGNBQWMsQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFbkUsbUZBQW1GO1lBQ25GLDRFQUE0RTtZQUM1RSx5RkFBeUY7WUFDekYsTUFBTSxjQUFjLEdBQUcsSUFBSSwrQkFBK0IsRUFBRSxDQUFDO1lBQzdELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxjQUFjLENB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R0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDdEMsQ0FBQztDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIiAvPlxuXG5pbXBvcnQgKiBhcyBjbHVzdGVyIGZyb20gJ2NsdXN0ZXInO1xuXG5pbXBvcnQge0xvZ2dlcn0gZnJvbSAnLi4vLi4vLi4vLi4vc3JjL25ndHNjL2xvZ2dpbmcnO1xuaW1wb3J0IHtwYXJzZUNvbW1hbmRMaW5lT3B0aW9uc30gZnJvbSAnLi4vLi4vY29tbWFuZF9saW5lX29wdGlvbnMnO1xuaW1wb3J0IHtnZXRTaGFyZWRTZXR1cH0gZnJvbSAnLi4vLi4vbmdjY19vcHRpb25zJztcbmltcG9ydCB7Q3JlYXRlQ29tcGlsZUZufSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHtnZXRDcmVhdGVDb21waWxlRm59IGZyb20gJy4uL2NyZWF0ZV9jb21waWxlX2Z1bmN0aW9uJztcbmltcG9ydCB7c3RyaW5naWZ5VGFza30gZnJvbSAnLi4vdGFza3MvdXRpbHMnO1xuXG5pbXBvcnQge01lc3NhZ2VUb1dvcmtlcn0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtDbHVzdGVyV29ya2VyUGFja2FnZUpzb25VcGRhdGVyfSBmcm9tICcuL3BhY2thZ2VfanNvbl91cGRhdGVyJztcbmltcG9ydCB7c2VuZE1lc3NhZ2VUb01hc3Rlcn0gZnJvbSAnLi91dGlscyc7XG5cbi8vIENsdXN0ZXIgd29ya2VyIGVudHJ5IHBvaW50XG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgKGFzeW5jICgpID0+IHtcbiAgICBwcm9jZXNzLnRpdGxlID0gJ25nY2MgKHdvcmtlciknO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbG9nZ2VyLFxuICAgICAgICBwYXRoTWFwcGluZ3MsXG4gICAgICAgIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQsXG4gICAgICAgIGZpbGVTeXN0ZW0sXG4gICAgICAgIHRzQ29uZmlnLFxuICAgICAgICBnZXRGaWxlV3JpdGVyLFxuICAgICAgfSA9IGdldFNoYXJlZFNldHVwKHBhcnNlQ29tbWFuZExpbmVPcHRpb25zKHByb2Nlc3MuYXJndi5zbGljZSgyKSkpO1xuXG4gICAgICAvLyBOT1RFOiBUbyBhdm9pZCBmaWxlIGNvcnJ1cHRpb24sIGBuZ2NjYCBpbnZvY2F0aW9uIG9ubHkgY3JlYXRlcyBfb25lXyBpbnN0YW5jZSBvZlxuICAgICAgLy8gYFBhY2thZ2VKc29uVXBkYXRlcmAgdGhhdCBhY3R1YWxseSB3cml0ZXMgdG8gZGlzayAoYWNyb3NzIGFsbCBwcm9jZXNzZXMpLlxuICAgICAgLy8gSW4gY2x1c3RlciB3b3JrZXJzIHdlIHVzZSBhIGBQYWNrYWdlSnNvblVwZGF0ZXJgIHRoYXQgZGVsZWdhdGVzIHRvIHRoZSBjbHVzdGVyIG1hc3Rlci5cbiAgICAgIGNvbnN0IHBrZ0pzb25VcGRhdGVyID0gbmV3IENsdXN0ZXJXb3JrZXJQYWNrYWdlSnNvblVwZGF0ZXIoKTtcbiAgICAgIGNvbnN0IGZpbGVXcml0ZXIgPSBnZXRGaWxlV3JpdGVyKHBrZ0pzb25VcGRhdGVyKTtcblxuICAgICAgLy8gVGhlIGZ1bmN0aW9uIGZvciBjcmVhdGluZyB0aGUgYGNvbXBpbGUoKWAgZnVuY3Rpb24uXG4gICAgICBjb25zdCBjcmVhdGVDb21waWxlRm4gPSBnZXRDcmVhdGVDb21waWxlRm4oXG4gICAgICAgICAgZmlsZVN5c3RlbSwgbG9nZ2VyLCBmaWxlV3JpdGVyLCBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0LCB0c0NvbmZpZywgcGF0aE1hcHBpbmdzKTtcblxuICAgICAgYXdhaXQgc3RhcnRXb3JrZXIobG9nZ2VyLCBjcmVhdGVDb21waWxlRm4pO1xuICAgICAgcHJvY2Vzcy5leGl0Q29kZSA9IDA7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlLnN0YWNrIHx8IGUubWVzc2FnZSk7XG4gICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgfVxuICB9KSgpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RhcnRXb3JrZXIobG9nZ2VyOiBMb2dnZXIsIGNyZWF0ZUNvbXBpbGVGbjogQ3JlYXRlQ29tcGlsZUZuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChjbHVzdGVyLmlzTWFzdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUcmllZCB0byBydW4gY2x1c3RlciB3b3JrZXIgb24gdGhlIG1hc3RlciBwcm9jZXNzLicpO1xuICB9XG5cbiAgY29uc3QgY29tcGlsZSA9IGNyZWF0ZUNvbXBpbGVGbihcbiAgICAgIHRyYW5zZm9ybWVkRmlsZXMgPT4gc2VuZE1lc3NhZ2VUb01hc3Rlcih7XG4gICAgICAgIHR5cGU6ICd0cmFuc2Zvcm1lZC1maWxlcycsXG4gICAgICAgIGZpbGVzOiB0cmFuc2Zvcm1lZEZpbGVzLm1hcChmID0+IGYucGF0aCksXG4gICAgICB9KSxcbiAgICAgIChfdGFzaywgb3V0Y29tZSwgbWVzc2FnZSkgPT4gc2VuZE1lc3NhZ2VUb01hc3Rlcih7dHlwZTogJ3Rhc2stY29tcGxldGVkJywgb3V0Y29tZSwgbWVzc2FnZX0pKTtcblxuXG4gIC8vIExpc3RlbiBmb3IgYFByb2Nlc3NUYXNrTWVzc2FnZWBzIGFuZCBwcm9jZXNzIHRhc2tzLlxuICBjbHVzdGVyLndvcmtlci5vbignbWVzc2FnZScsIGFzeW5jIChtc2c6IE1lc3NhZ2VUb1dvcmtlcikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3Byb2Nlc3MtdGFzayc6XG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgICAgICAgICBgW1dvcmtlciAjJHtjbHVzdGVyLndvcmtlci5pZH1dIFByb2Nlc3NpbmcgdGFzazogJHtzdHJpbmdpZnlUYXNrKG1zZy50YXNrKX1gKTtcbiAgICAgICAgICByZXR1cm4gYXdhaXQgY29tcGlsZShtc2cudGFzayk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgW1dvcmtlciAjJHtjbHVzdGVyLndvcmtlci5pZH1dIEludmFsaWQgbWVzc2FnZSByZWNlaXZlZDogJHtKU09OLnN0cmluZ2lmeShtc2cpfWApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgc3dpdGNoIChlcnIgJiYgZXJyLmNvZGUpIHtcbiAgICAgICAgY2FzZSAnRU5PTUVNJzpcbiAgICAgICAgICAvLyBOb3QgYmVpbmcgYWJsZSB0byBhbGxvY2F0ZSBlbm91Z2ggbWVtb3J5IGlzIG5vdCBuZWNlc3NhcmlseSBhIHByb2JsZW0gd2l0aCBwcm9jZXNzaW5nXG4gICAgICAgICAgLy8gdGhlIGN1cnJlbnQgdGFzay4gSXQgY291bGQganVzdCBtZWFuIHRoYXQgdGhlcmUgYXJlIHRvbyBtYW55IHRhc2tzIGJlaW5nIHByb2Nlc3NlZFxuICAgICAgICAgIC8vIHNpbXVsdGFuZW91c2x5LlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gRXhpdCB3aXRoIGFuIGVycm9yIGFuZCBsZXQgdGhlIGNsdXN0ZXIgbWFzdGVyIGRlY2lkZSBob3cgdG8gaGFuZGxlIHRoaXMuXG4gICAgICAgICAgbG9nZ2VyLndhcm4oYFtXb3JrZXIgIyR7Y2x1c3Rlci53b3JrZXIuaWR9XSAke2Vyci5zdGFjayB8fCBlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICByZXR1cm4gcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGF3YWl0IHNlbmRNZXNzYWdlVG9NYXN0ZXIoe1xuICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgIGVycm9yOiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpID8gKGVyci5zdGFjayB8fCBlcnIubWVzc2FnZSkgOiBlcnIsXG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICAvLyBSZXR1cm4gYSBwcm9taXNlIHRoYXQgaXMgbmV2ZXIgcmVzb2x2ZWQuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB1bmRlZmluZWQpO1xufVxuIl19