/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __awaiter } from "tslib";
/// <reference types="node" />
import * as cluster from 'cluster';
import { stringifyTask } from '../tasks/utils';
import { Deferred, sendMessageToWorker } from './utils';
/**
 * The cluster master is responsible for analyzing all entry-points, planning the work that needs to
 * be done, distributing it to worker-processes and collecting/post-processing the results.
 */
export class ClusterMaster {
    constructor(maxWorkerCount, fileSystem, logger, fileWriter, pkgJsonUpdater, analyzeEntryPoints, createTaskCompletedCallback) {
        this.maxWorkerCount = maxWorkerCount;
        this.fileSystem = fileSystem;
        this.logger = logger;
        this.fileWriter = fileWriter;
        this.pkgJsonUpdater = pkgJsonUpdater;
        this.finishedDeferred = new Deferred();
        this.processingStartTime = -1;
        this.taskAssignments = new Map();
        this.remainingRespawnAttempts = 3;
        if (!cluster.isMaster) {
            throw new Error('Tried to instantiate `ClusterMaster` on a worker process.');
        }
        // Set the worker entry-point
        cluster.setupMaster({ exec: this.fileSystem.resolve(__dirname, 'worker.js') });
        this.taskQueue = analyzeEntryPoints();
        this.onTaskCompleted = createTaskCompletedCallback(this.taskQueue);
    }
    run() {
        if (this.taskQueue.allTasksCompleted) {
            return Promise.resolve();
        }
        // Set up listeners for worker events (emitted on `cluster`).
        cluster.on('online', this.wrapEventHandler(worker => this.onWorkerOnline(worker.id)));
        cluster.on('message', this.wrapEventHandler((worker, msg) => this.onWorkerMessage(worker.id, msg)));
        cluster.on('exit', this.wrapEventHandler((worker, code, signal) => this.onWorkerExit(worker, code, signal)));
        // Since we have pending tasks at the very minimum we need a single worker.
        cluster.fork();
        return this.finishedDeferred.promise.then(() => this.stopWorkers(), err => {
            this.stopWorkers();
            return Promise.reject(err);
        });
    }
    /** Try to find available (idle) workers and assign them available (non-blocked) tasks. */
    maybeDistributeWork() {
        let isWorkerAvailable = false;
        // First, check whether all tasks have been completed.
        if (this.taskQueue.allTasksCompleted) {
            const duration = Math.round((Date.now() - this.processingStartTime) / 100) / 10;
            this.logger.debug(`Processed tasks in ${duration}s.`);
            return this.finishedDeferred.resolve();
        }
        // Look for available workers and available tasks to assign to them.
        for (const [workerId, assignedTask] of Array.from(this.taskAssignments)) {
            if (assignedTask !== null) {
                // This worker already has a job; check other workers.
                continue;
            }
            else {
                // This worker is available.
                isWorkerAvailable = true;
            }
            // This worker needs a job. See if any are available.
            const task = this.taskQueue.getNextTask();
            if (task === null) {
                // No suitable work available right now.
                break;
            }
            // Process the next task on the worker.
            this.taskAssignments.set(workerId, { task });
            sendMessageToWorker(workerId, { type: 'process-task', task });
            isWorkerAvailable = false;
        }
        if (!isWorkerAvailable) {
            const spawnedWorkerCount = Object.keys(cluster.workers).length;
            if (spawnedWorkerCount < this.maxWorkerCount) {
                this.logger.debug('Spawning another worker process as there is more work to be done.');
                cluster.fork();
            }
            else {
                // If there are no available workers or no available tasks, log (for debugging purposes).
                this.logger.debug(`All ${spawnedWorkerCount} workers are currently busy and cannot take on more work.`);
            }
        }
        else {
            const busyWorkers = Array.from(this.taskAssignments)
                .filter(([_workerId, task]) => task !== null)
                .map(([workerId]) => workerId);
            const totalWorkerCount = this.taskAssignments.size;
            const idleWorkerCount = totalWorkerCount - busyWorkers.length;
            this.logger.debug(`No assignments for ${idleWorkerCount} idle (out of ${totalWorkerCount} total) ` +
                `workers. Busy workers: ${busyWorkers.join(', ')}`);
            if (busyWorkers.length === 0) {
                // This is a bug:
                // All workers are idle (meaning no tasks are in progress) and `taskQueue.allTasksCompleted`
                // is `false`, but there is still no assignable work.
                throw new Error('There are still unprocessed tasks in the queue and no tasks are currently in ' +
                    `progress, yet the queue did not return any available tasks: ${this.taskQueue}`);
            }
        }
    }
    /** Handle a worker's exiting. (Might be intentional or not.) */
    onWorkerExit(worker, code, signal) {
        // If the worker's exiting was intentional, nothing to do.
        if (worker.exitedAfterDisconnect)
            return;
        // The worker exited unexpectedly: Determine it's status and take an appropriate action.
        const assignment = this.taskAssignments.get(worker.id);
        this.taskAssignments.delete(worker.id);
        this.logger.warn(`Worker #${worker.id} exited unexpectedly (code: ${code} | signal: ${signal}).\n` +
            `  Current task: ${(assignment == null) ? '-' : stringifyTask(assignment.task)}\n` +
            `  Current phase: ${(assignment == null) ? '-' :
                (assignment.files == null) ? 'compiling' : 'writing files'}`);
        if (assignment == null) {
            // The crashed worker process was not in the middle of a task:
            // Just spawn another process.
            this.logger.debug(`Spawning another worker process to replace #${worker.id}...`);
            cluster.fork();
        }
        else {
            const { task, files } = assignment;
            if (files != null) {
                // The crashed worker process was in the middle of writing transformed files:
                // Revert any changes before re-processing the task.
                this.logger.debug(`Reverting ${files.length} transformed files...`);
                this.fileWriter.revertBundle(task.entryPoint, files, task.formatPropertiesToMarkAsProcessed);
            }
            // The crashed worker process was in the middle of a task:
            // Re-add the task back to the queue.
            this.taskQueue.markAsUnprocessed(task);
            // The crashing might be a result of increased memory consumption by ngcc.
            // Do not spawn another process, unless this was the last worker process.
            const spawnedWorkerCount = Object.keys(cluster.workers).length;
            if (spawnedWorkerCount > 0) {
                this.logger.debug(`Not spawning another worker process to replace #${worker.id}. Continuing with ${spawnedWorkerCount} workers...`);
                this.maybeDistributeWork();
            }
            else if (this.remainingRespawnAttempts > 0) {
                this.logger.debug(`Spawning another worker process to replace #${worker.id}...`);
                this.remainingRespawnAttempts--;
                cluster.fork();
            }
            else {
                throw new Error('All worker processes crashed and attempts to re-spawn them failed. ' +
                    'Please check your system and ensure there is enough memory available.');
            }
        }
    }
    /** Handle a message from a worker. */
    onWorkerMessage(workerId, msg) {
        if (!this.taskAssignments.has(workerId)) {
            const knownWorkers = Array.from(this.taskAssignments.keys());
            throw new Error(`Received message from unknown worker #${workerId} (known workers: ` +
                `${knownWorkers.join(', ')}): ${JSON.stringify(msg)}`);
        }
        switch (msg.type) {
            case 'error':
                throw new Error(`Error on worker #${workerId}: ${msg.error}`);
            case 'task-completed':
                return this.onWorkerTaskCompleted(workerId, msg);
            case 'transformed-files':
                return this.onWorkerTransformedFiles(workerId, msg);
            case 'update-package-json':
                return this.onWorkerUpdatePackageJson(workerId, msg);
            default:
                throw new Error(`Invalid message received from worker #${workerId}: ${JSON.stringify(msg)}`);
        }
    }
    /** Handle a worker's coming online. */
    onWorkerOnline(workerId) {
        if (this.taskAssignments.has(workerId)) {
            throw new Error(`Invariant violated: Worker #${workerId} came online more than once.`);
        }
        if (this.processingStartTime === -1) {
            this.logger.debug('Processing tasks...');
            this.processingStartTime = Date.now();
        }
        this.taskAssignments.set(workerId, null);
        this.maybeDistributeWork();
    }
    /** Handle a worker's having completed their assigned task. */
    onWorkerTaskCompleted(workerId, msg) {
        const assignment = this.taskAssignments.get(workerId) || null;
        if (assignment === null) {
            throw new Error(`Expected worker #${workerId} to have a task assigned, while handling message: ` +
                JSON.stringify(msg));
        }
        this.onTaskCompleted(assignment.task, msg.outcome, msg.message);
        this.taskQueue.markAsCompleted(assignment.task);
        this.taskAssignments.set(workerId, null);
        this.maybeDistributeWork();
    }
    /** Handle a worker's message regarding the files transformed while processing its task. */
    onWorkerTransformedFiles(workerId, msg) {
        const assignment = this.taskAssignments.get(workerId) || null;
        if (assignment === null) {
            throw new Error(`Expected worker #${workerId} to have a task assigned, while handling message: ` +
                JSON.stringify(msg));
        }
        const oldFiles = assignment.files;
        const newFiles = msg.files;
        if (oldFiles !== undefined) {
            throw new Error(`Worker #${workerId} reported transformed files more than once.\n` +
                `  Old files (${oldFiles.length}): [${oldFiles.join(', ')}]\n` +
                `  New files (${newFiles.length}): [${newFiles.join(', ')}]\n`);
        }
        assignment.files = newFiles;
    }
    /** Handle a worker's request to update a `package.json` file. */
    onWorkerUpdatePackageJson(workerId, msg) {
        const assignment = this.taskAssignments.get(workerId) || null;
        if (assignment === null) {
            throw new Error(`Expected worker #${workerId} to have a task assigned, while handling message: ` +
                JSON.stringify(msg));
        }
        const entryPoint = assignment.task.entryPoint;
        const expectedPackageJsonPath = this.fileSystem.resolve(entryPoint.path, 'package.json');
        if (expectedPackageJsonPath !== msg.packageJsonPath) {
            throw new Error(`Received '${msg.type}' message from worker #${workerId} for '${msg.packageJsonPath}', ` +
                `but was expecting '${expectedPackageJsonPath}' (based on task assignment).`);
        }
        // NOTE: Although the change in the parsed `package.json` will be reflected in tasks objects
        //       locally and thus also in future `process-task` messages sent to worker processes, any
        //       processes already running and processing a task for the same entry-point will not get
        //       the change.
        //       Do not rely on having an up-to-date `package.json` representation in worker processes.
        //       In other words, task processing should only rely on the info that was there when the
        //       file was initially parsed (during entry-point analysis) and not on the info that might
        //       be added later (during task processing).
        this.pkgJsonUpdater.writeChanges(msg.changes, msg.packageJsonPath, entryPoint.packageJson);
    }
    /** Stop all workers and stop listening on cluster events. */
    stopWorkers() {
        const workers = Object.values(cluster.workers);
        this.logger.debug(`Stopping ${workers.length} workers...`);
        cluster.removeAllListeners();
        workers.forEach(worker => worker.kill());
    }
    /**
     * Wrap an event handler to ensure that `finishedDeferred` will be rejected on error (regardless
     * if the handler completes synchronously or asynchronously).
     */
    wrapEventHandler(fn) {
        return (...args) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield fn(...args);
            }
            catch (err) {
                this.finishedDeferred.reject(err);
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFzdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2V4ZWN1dGlvbi9jbHVzdGVyL21hc3Rlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsOEJBQThCO0FBRTlCLE9BQU8sS0FBSyxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBUW5DLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUc3QyxPQUFPLEVBQUMsUUFBUSxFQUFFLG1CQUFtQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBR3REOzs7R0FHRztBQUNILE1BQU0sT0FBTyxhQUFhO0lBUXhCLFlBQ1ksY0FBc0IsRUFBVSxVQUE0QixFQUFVLE1BQWMsRUFDcEYsVUFBc0IsRUFBVSxjQUFrQyxFQUMxRSxrQkFBd0MsRUFDeEMsMkJBQXdEO1FBSGhELG1CQUFjLEdBQWQsY0FBYyxDQUFRO1FBQVUsZUFBVSxHQUFWLFVBQVUsQ0FBa0I7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQ3BGLGVBQVUsR0FBVixVQUFVLENBQVk7UUFBVSxtQkFBYyxHQUFkLGNBQWMsQ0FBb0I7UUFUdEUscUJBQWdCLEdBQUcsSUFBSSxRQUFRLEVBQVEsQ0FBQztRQUN4Qyx3QkFBbUIsR0FBVyxDQUFDLENBQUMsQ0FBQztRQUNqQyxvQkFBZSxHQUFHLElBQUksR0FBRyxFQUF1RCxDQUFDO1FBR2pGLDZCQUF3QixHQUFHLENBQUMsQ0FBQztRQU9uQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRTtZQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7U0FDOUU7UUFFRCw2QkFBNkI7UUFDN0IsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsV0FB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LENBQUM7SUFDSixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIgLz5cblxuaW1wb3J0ICogYXMgY2x1c3RlciBmcm9tICdjbHVzdGVyJztcblxuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aCwgUGF0aE1hbmlwdWxhdGlvbn0gZnJvbSAnLi4vLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge0ZpbGVXcml0ZXJ9IGZyb20gJy4uLy4uL3dyaXRpbmcvZmlsZV93cml0ZXInO1xuaW1wb3J0IHtQYWNrYWdlSnNvblVwZGF0ZXJ9IGZyb20gJy4uLy4uL3dyaXRpbmcvcGFja2FnZV9qc29uX3VwZGF0ZXInO1xuaW1wb3J0IHtBbmFseXplRW50cnlQb2ludHNGbn0gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7Q3JlYXRlVGFza0NvbXBsZXRlZENhbGxiYWNrLCBUYXNrLCBUYXNrQ29tcGxldGVkQ2FsbGJhY2ssIFRhc2tRdWV1ZX0gZnJvbSAnLi4vdGFza3MvYXBpJztcbmltcG9ydCB7c3RyaW5naWZ5VGFza30gZnJvbSAnLi4vdGFza3MvdXRpbHMnO1xuXG5pbXBvcnQge01lc3NhZ2VGcm9tV29ya2VyLCBUYXNrQ29tcGxldGVkTWVzc2FnZSwgVHJhbnNmb3JtZWRGaWxlc01lc3NhZ2UsIFVwZGF0ZVBhY2thZ2VKc29uTWVzc2FnZX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtEZWZlcnJlZCwgc2VuZE1lc3NhZ2VUb1dvcmtlcn0gZnJvbSAnLi91dGlscyc7XG5cblxuLyoqXG4gKiBUaGUgY2x1c3RlciBtYXN0ZXIgaXMgcmVzcG9uc2libGUgZm9yIGFuYWx5emluZyBhbGwgZW50cnktcG9pbnRzLCBwbGFubmluZyB0aGUgd29yayB0aGF0IG5lZWRzIHRvXG4gKiBiZSBkb25lLCBkaXN0cmlidXRpbmcgaXQgdG8gd29ya2VyLXByb2Nlc3NlcyBhbmQgY29sbGVjdGluZy9wb3N0LXByb2Nlc3NpbmcgdGhlIHJlc3VsdHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBDbHVzdGVyTWFzdGVyIHtcbiAgcHJpdmF0ZSBmaW5pc2hlZERlZmVycmVkID0gbmV3IERlZmVycmVkPHZvaWQ+KCk7XG4gIHByaXZhdGUgcHJvY2Vzc2luZ1N0YXJ0VGltZTogbnVtYmVyID0gLTE7XG4gIHByaXZhdGUgdGFza0Fzc2lnbm1lbnRzID0gbmV3IE1hcDxudW1iZXIsIHt0YXNrOiBUYXNrLCBmaWxlcz86IEFic29sdXRlRnNQYXRoW119fG51bGw+KCk7XG4gIHByaXZhdGUgdGFza1F1ZXVlOiBUYXNrUXVldWU7XG4gIHByaXZhdGUgb25UYXNrQ29tcGxldGVkOiBUYXNrQ29tcGxldGVkQ2FsbGJhY2s7XG4gIHByaXZhdGUgcmVtYWluaW5nUmVzcGF3bkF0dGVtcHRzID0gMztcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgbWF4V29ya2VyQ291bnQ6IG51bWJlciwgcHJpdmF0ZSBmaWxlU3lzdGVtOiBQYXRoTWFuaXB1bGF0aW9uLCBwcml2YXRlIGxvZ2dlcjogTG9nZ2VyLFxuICAgICAgcHJpdmF0ZSBmaWxlV3JpdGVyOiBGaWxlV3JpdGVyLCBwcml2YXRlIHBrZ0pzb25VcGRhdGVyOiBQYWNrYWdlSnNvblVwZGF0ZXIsXG4gICAgICBhbmFseXplRW50cnlQb2ludHM6IEFuYWx5emVFbnRyeVBvaW50c0ZuLFxuICAgICAgY3JlYXRlVGFza0NvbXBsZXRlZENhbGxiYWNrOiBDcmVhdGVUYXNrQ29tcGxldGVkQ2FsbGJhY2spIHtcbiAgICBpZiAoIWNsdXN0ZXIuaXNNYXN0ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVHJpZWQgdG8gaW5zdGFudGlhdGUgYENsdXN0ZXJNYXN0ZXJgIG9uIGEgd29ya2VyIHByb2Nlc3MuJyk7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSB3b3JrZXIgZW50cnktcG9pbnRcbiAgICBjbHVzdGVyLnNldHVwTWFzdGVyKHtleGVjOiB0aGlzLmZpbGVTeXN0ZW0ucmVzb2x2ZShfX2Rpcm5hbWUsICd3b3JrZXIuanMnKX0pO1xuXG4gICAgdGhpcy50YXNrUXVldWUgPSBhbmFseXplRW50cnlQb2ludHMoKTtcbiAgICB0aGlzLm9uVGFza0NvbXBsZXRlZCA9IGNyZWF0ZVRhc2tDb21wbGV0ZWRDYWxsYmFjayh0aGlzLnRhc2tRdWV1ZSk7XG4gIH1cblxuICBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMudGFza1F1ZXVlLmFsbFRhc2tzQ29tcGxldGVkKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyBmb3Igd29ya2VyIGV2ZW50cyAoZW1pdHRlZCBvbiBgY2x1c3RlcmApLlxuICAgIGNsdXN0ZXIub24oJ29ubGluZScsIHRoaXMud3JhcEV2ZW50SGFuZGxlcih3b3JrZXIgPT4gdGhpcy5vbldvcmtlck9ubGluZSh3b3JrZXIuaWQpKSk7XG5cbiAgICBjbHVzdGVyLm9uKFxuICAgICAgICAnbWVzc2FnZScsIHRoaXMud3JhcEV2ZW50SGFuZGxlcigod29ya2VyLCBtc2cpID0+IHRoaXMub25Xb3JrZXJNZXNzYWdlKHdvcmtlci5pZCwgbXNnKSkpO1xuXG4gICAgY2x1c3Rlci5vbihcbiAgICAgICAgJ2V4aXQnLFxuICAgICAgICB0aGlzLndyYXBFdmVudEhhbmRsZXIoKHdvcmtlciwgY29kZSwgc2lnbmFsKSA9PiB0aGlzLm9uV29ya2VyRXhpdCh3b3JrZXIsIGNvZGUsIHNpZ25hbCkpKTtcblxuICAgIC8vIFNpbmNlIHdlIGhhdmUgcGVuZGluZyB0YXNrcyBhdCB0aGUgdmVyeSBtaW5pbXVtIHdlIG5lZWQgYSBzaW5nbGUgd29ya2VyLlxuICAgIGNsdXN0ZXIuZm9yaygpO1xuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoZWREZWZlcnJlZC5wcm9taXNlLnRoZW4oKCkgPT4gdGhpcy5zdG9wV29ya2VycygpLCBlcnIgPT4ge1xuICAgICAgdGhpcy5zdG9wV29ya2VycygpO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKiogVHJ5IHRvIGZpbmQgYXZhaWxhYmxlIChpZGxlKSB3b3JrZXJzIGFuZCBhc3NpZ24gdGhlbSBhdmFpbGFibGUgKG5vbi1ibG9ja2VkKSB0YXNrcy4gKi9cbiAgcHJpdmF0ZSBtYXliZURpc3RyaWJ1dGVXb3JrKCk6IHZvaWQge1xuICAgIGxldCBpc1dvcmtlckF2YWlsYWJsZSA9IGZhbHNlO1xuXG4gICAgLy8gRmlyc3QsIGNoZWNrIHdoZXRoZXIgYWxsIHRhc2tzIGhhdmUgYmVlbiBjb21wbGV0ZWQuXG4gICAgaWYgKHRoaXMudGFza1F1ZXVlLmFsbFRhc2tzQ29tcGxldGVkKSB7XG4gICAgICBjb25zdCBkdXJhdGlvbiA9IE1hdGgucm91bmQoKERhdGUubm93KCkgLSB0aGlzLnByb2Nlc3NpbmdTdGFydFRpbWUpIC8gMTAwKSAvIDEwO1xuICAgICAgdGhpcy5sb2dnZXIuZGVidWcoYFByb2Nlc3NlZCB0YXNrcyBpbiAke2R1cmF0aW9ufXMuYCk7XG5cbiAgICAgIHJldHVybiB0aGlzLmZpbmlzaGVkRGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIExvb2sgZm9yIGF2YWlsYWJsZSB3b3JrZXJzIGFuZCBhdmFpbGFibGUgdGFza3MgdG8gYXNzaWduIHRvIHRoZW0uXG4gICAgZm9yIChjb25zdCBbd29ya2VySWQsIGFzc2lnbmVkVGFza10gb2YgQXJyYXkuZnJvbSh0aGlzLnRhc2tBc3NpZ25tZW50cykpIHtcbiAgICAgIGlmIChhc3NpZ25lZFRhc2sgIT09IG51bGwpIHtcbiAgICAgICAgLy8gVGhpcyB3b3JrZXIgYWxyZWFkeSBoYXMgYSBqb2I7IGNoZWNrIG90aGVyIHdvcmtlcnMuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyB3b3JrZXIgaXMgYXZhaWxhYmxlLlxuICAgICAgICBpc1dvcmtlckF2YWlsYWJsZSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoaXMgd29ya2VyIG5lZWRzIGEgam9iLiBTZWUgaWYgYW55IGFyZSBhdmFpbGFibGUuXG4gICAgICBjb25zdCB0YXNrID0gdGhpcy50YXNrUXVldWUuZ2V0TmV4dFRhc2soKTtcbiAgICAgIGlmICh0YXNrID09PSBudWxsKSB7XG4gICAgICAgIC8vIE5vIHN1aXRhYmxlIHdvcmsgYXZhaWxhYmxlIHJpZ2h0IG5vdy5cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIFByb2Nlc3MgdGhlIG5leHQgdGFzayBvbiB0aGUgd29ya2VyLlxuICAgICAgdGhpcy50YXNrQXNzaWdubWVudHMuc2V0KHdvcmtlcklkLCB7dGFza30pO1xuICAgICAgc2VuZE1lc3NhZ2VUb1dvcmtlcih3b3JrZXJJZCwge3R5cGU6ICdwcm9jZXNzLXRhc2snLCB0YXNrfSk7XG5cbiAgICAgIGlzV29ya2VyQXZhaWxhYmxlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCFpc1dvcmtlckF2YWlsYWJsZSkge1xuICAgICAgY29uc3Qgc3Bhd25lZFdvcmtlckNvdW50ID0gT2JqZWN0LmtleXMoY2x1c3Rlci53b3JrZXJzKS5sZW5ndGg7XG4gICAgICBpZiAoc3Bhd25lZFdvcmtlckNvdW50IDwgdGhpcy5tYXhXb3JrZXJDb3VudCkge1xuICAgICAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnU3Bhd25pbmcgYW5vdGhlciB3b3JrZXIgcHJvY2VzcyBhcyB0aGVyZSBpcyBtb3JlIHdvcmsgdG8gYmUgZG9uZS4nKTtcbiAgICAgICAgY2x1c3Rlci5mb3JrKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gYXZhaWxhYmxlIHdvcmtlcnMgb3Igbm8gYXZhaWxhYmxlIHRhc2tzLCBsb2cgKGZvciBkZWJ1Z2dpbmcgcHVycG9zZXMpLlxuICAgICAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhcbiAgICAgICAgICAgIGBBbGwgJHtzcGF3bmVkV29ya2VyQ291bnR9IHdvcmtlcnMgYXJlIGN1cnJlbnRseSBidXN5IGFuZCBjYW5ub3QgdGFrZSBvbiBtb3JlIHdvcmsuYCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGJ1c3lXb3JrZXJzID0gQXJyYXkuZnJvbSh0aGlzLnRhc2tBc3NpZ25tZW50cylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtfd29ya2VySWQsIHRhc2tdKSA9PiB0YXNrICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoW3dvcmtlcklkXSkgPT4gd29ya2VySWQpO1xuICAgICAgY29uc3QgdG90YWxXb3JrZXJDb3VudCA9IHRoaXMudGFza0Fzc2lnbm1lbnRzLnNpemU7XG4gICAgICBjb25zdCBpZGxlV29ya2VyQ291bnQgPSB0b3RhbFdvcmtlckNvdW50IC0gYnVzeVdvcmtlcnMubGVuZ3RoO1xuXG4gICAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhcbiAgICAgICAgICBgTm8gYXNzaWdubWVudHMgZm9yICR7aWRsZVdvcmtlckNvdW50fSBpZGxlIChvdXQgb2YgJHt0b3RhbFdvcmtlckNvdW50fSB0b3RhbCkgYCArXG4gICAgICAgICAgYHdvcmtlcnMuIEJ1c3kgd29ya2VyczogJHtidXN5V29ya2Vycy5qb2luKCcsICcpfWApO1xuXG4gICAgICBpZiAoYnVzeVdvcmtlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSBidWc6XG4gICAgICAgIC8vIEFsbCB3b3JrZXJzIGFyZSBpZGxlIChtZWFuaW5nIG5vIHRhc2tzIGFyZSBpbiBwcm9ncmVzcykgYW5kIGB0YXNrUXVldWUuYWxsVGFza3NDb21wbGV0ZWRgXG4gICAgICAgIC8vIGlzIGBmYWxzZWAsIGJ1dCB0aGVyZSBpcyBzdGlsbCBubyBhc3NpZ25hYmxlIHdvcmsuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdUaGVyZSBhcmUgc3RpbGwgdW5wcm9jZXNzZWQgdGFza3MgaW4gdGhlIHF1ZXVlIGFuZCBubyB0YXNrcyBhcmUgY3VycmVudGx5IGluICcgK1xuICAgICAgICAgICAgYHByb2dyZXNzLCB5ZXQgdGhlIHF1ZXVlIGRpZCBub3QgcmV0dXJuIGFueSBhdmFpbGFibGUgdGFza3M6ICR7dGhpcy50YXNrUXVldWV9YCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqIEhhbmRsZSBhIHdvcmtlcidzIGV4aXRpbmcuIChNaWdodCBiZSBpbnRlbnRpb25hbCBvciBub3QuKSAqL1xuICBwcml2YXRlIG9uV29ya2VyRXhpdCh3b3JrZXI6IGNsdXN0ZXIuV29ya2VyLCBjb2RlOiBudW1iZXJ8bnVsbCwgc2lnbmFsOiBzdHJpbmd8bnVsbCk6IHZvaWQge1xuICAgIC8vIElmIHRoZSB3b3JrZXIncyBleGl0aW5nIHdhcyBpbnRlbnRpb25hbCwgbm90aGluZyB0byBkby5cbiAgICBpZiAod29ya2VyLmV4aXRlZEFmdGVyRGlzY29ubmVjdCkgcmV0dXJuO1xuXG4gICAgLy8gVGhlIHdvcmtlciBleGl0ZWQgdW5leHBlY3RlZGx5OiBEZXRlcm1pbmUgaXQncyBzdGF0dXMgYW5kIHRha2UgYW4gYXBwcm9wcmlhdGUgYWN0aW9uLlxuICAgIGNvbnN0IGFzc2lnbm1lbnQgPSB0aGlzLnRhc2tBc3NpZ25tZW50cy5nZXQod29ya2VyLmlkKTtcbiAgICB0aGlzLnRhc2tBc3NpZ25tZW50cy5kZWxldGUod29ya2VyLmlkKTtcblxuICAgIHRoaXMubG9nZ2VyLndhcm4oXG4gICAgICAgIGBXb3JrZXIgIyR7d29ya2VyLmlkfSBleGl0ZWQgdW5leHBlY3RlZGx5IChjb2RlOiAke2NvZGV9IHwgc2lnbmFsOiAke3NpZ25hbH0pLlxcbmAgK1xuICAgICAgICBgICBDdXJyZW50IHRhc2s6ICR7KGFzc2lnbm1lbnQgPT0gbnVsbCkgPyAnLScgOiBzdHJpbmdpZnlUYXNrKGFzc2lnbm1lbnQudGFzayl9XFxuYCArXG4gICAgICAgIGAgIEN1cnJlbnQgcGhhc2U6ICR7XG4gICAgICAgICAgICAoYXNzaWdubWVudCA9PSBudWxsKSA/ICctJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChhc3NpZ25tZW50LmZpbGVzID09IG51bGwpID8gJ2NvbXBpbGluZycgOiAnd3JpdGluZyBmaWxlcyd9YCk7XG5cbiAgICBpZiAoYXNzaWdubWVudCA9PSBudWxsKSB7XG4gICAgICAvLyBUaGUgY3Jhc2hlZCB3b3JrZXIgcHJvY2VzcyB3YXMgbm90IGluIHRoZSBtaWRkbGUgb2YgYSB0YXNrOlxuICAgICAgLy8gSnVzdCBzcGF3biBhbm90aGVyIHByb2Nlc3MuXG4gICAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhgU3Bhd25pbmcgYW5vdGhlciB3b3JrZXIgcHJvY2VzcyB0byByZXBsYWNlICMke3dvcmtlci5pZH0uLi5gKTtcbiAgICAgIGNsdXN0ZXIuZm9yaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7dGFzaywgZmlsZXN9ID0gYXNzaWdubWVudDtcblxuICAgICAgaWYgKGZpbGVzICE9IG51bGwpIHtcbiAgICAgICAgLy8gVGhlIGNyYXNoZWQgd29ya2VyIHByb2Nlc3Mgd2FzIGluIHRoZSBtaWRkbGUgb2Ygd3JpdGluZyB0cmFuc2Zvcm1lZCBmaWxlczpcbiAgICAgICAgLy8gUmV2ZXJ0IGFueSBjaGFuZ2VzIGJlZm9yZSByZS1wcm9jZXNzaW5nIHRoZSB0YXNrLlxuICAgICAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhgUmV2ZXJ0aW5nICR7ZmlsZXMubGVuZ3RofSB0cmFuc2Zvcm1lZCBmaWxlcy4uLmApO1xuICAgICAgICB0aGlzLmZpbGVXcml0ZXIucmV2ZXJ0QnVuZGxlKFxuICAgICAgICAgICAgdGFzay5lbnRyeVBvaW50LCBmaWxlcywgdGFzay5mb3JtYXRQcm9wZXJ0aWVzVG9NYXJrQXNQcm9jZXNzZWQpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgY3Jhc2hlZCB3b3JrZXIgcHJvY2VzcyB3YXMgaW4gdGhlIG1pZGRsZSBvZiBhIHRhc2s6XG4gICAgICAvLyBSZS1hZGQgdGhlIHRhc2sgYmFjayB0byB0aGUgcXVldWUuXG4gICAgICB0aGlzLnRhc2tRdWV1ZS5tYXJrQXNVbnByb2Nlc3NlZCh0YXNrKTtcblxuICAgICAgLy8gVGhlIGNyYXNoaW5nIG1pZ2h0IGJlIGEgcmVzdWx0IG9mIGluY3JlYXNlZCBtZW1vcnkgY29uc3VtcHRpb24gYnkgbmdjYy5cbiAgICAgIC8vIERvIG5vdCBzcGF3biBhbm90aGVyIHByb2Nlc3MsIHVubGVzcyB0aGlzIHdhcyB0aGUgbGFzdCB3b3JrZXIgcHJvY2Vzcy5cbiAgICAgIGNvbnN0IHNwYXduZWRXb3JrZXJDb3VudCA9IE9iamVjdC5rZXlzKGNsdXN0ZXIud29ya2VycykubGVuZ3RoO1xuICAgICAgaWYgKHNwYXduZWRXb3JrZXJDb3VudCA+IDApIHtcbiAgICAgICAgdGhpcy5sb2dnZXIuZGVidWcoYE5vdCBzcGF3bmluZyBhbm90aGVyIHdvcmtlciBwcm9jZXNzIHRvIHJlcGxhY2UgIyR7XG4gICAgICAgICAgICB3b3JrZXIuaWR9LiBDb250aW51aW5nIHdpdGggJHtzcGF3bmVkV29ya2VyQ291bnR9IHdvcmtlcnMuLi5gKTtcbiAgICAgICAgdGhpcy5tYXliZURpc3RyaWJ1dGVXb3JrKCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMucmVtYWluaW5nUmVzcGF3bkF0dGVtcHRzID4gMCkge1xuICAgICAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhgU3Bhd25pbmcgYW5vdGhlciB3b3JrZXIgcHJvY2VzcyB0byByZXBsYWNlICMke3dvcmtlci5pZH0uLi5gKTtcbiAgICAgICAgdGhpcy5yZW1haW5pbmdSZXNwYXduQXR0ZW1wdHMtLTtcbiAgICAgICAgY2x1c3Rlci5mb3JrKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnQWxsIHdvcmtlciBwcm9jZXNzZXMgY3Jhc2hlZCBhbmQgYXR0ZW1wdHMgdG8gcmUtc3Bhd24gdGhlbSBmYWlsZWQuICcgK1xuICAgICAgICAgICAgJ1BsZWFzZSBjaGVjayB5b3VyIHN5c3RlbSBhbmQgZW5zdXJlIHRoZXJlIGlzIGVub3VnaCBtZW1vcnkgYXZhaWxhYmxlLicpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBIYW5kbGUgYSBtZXNzYWdlIGZyb20gYSB3b3JrZXIuICovXG4gIHByaXZhdGUgb25Xb3JrZXJNZXNzYWdlKHdvcmtlcklkOiBudW1iZXIsIG1zZzogTWVzc2FnZUZyb21Xb3JrZXIpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMudGFza0Fzc2lnbm1lbnRzLmhhcyh3b3JrZXJJZCkpIHtcbiAgICAgIGNvbnN0IGtub3duV29ya2VycyA9IEFycmF5LmZyb20odGhpcy50YXNrQXNzaWdubWVudHMua2V5cygpKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgUmVjZWl2ZWQgbWVzc2FnZSBmcm9tIHVua25vd24gd29ya2VyICMke3dvcmtlcklkfSAoa25vd24gd29ya2VyczogYCArXG4gICAgICAgICAgYCR7a25vd25Xb3JrZXJzLmpvaW4oJywgJyl9KTogJHtKU09OLnN0cmluZ2lmeShtc2cpfWApO1xuICAgIH1cblxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcbiAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBvbiB3b3JrZXIgIyR7d29ya2VySWR9OiAke21zZy5lcnJvcn1gKTtcbiAgICAgIGNhc2UgJ3Rhc2stY29tcGxldGVkJzpcbiAgICAgICAgcmV0dXJuIHRoaXMub25Xb3JrZXJUYXNrQ29tcGxldGVkKHdvcmtlcklkLCBtc2cpO1xuICAgICAgY2FzZSAndHJhbnNmb3JtZWQtZmlsZXMnOlxuICAgICAgICByZXR1cm4gdGhpcy5vbldvcmtlclRyYW5zZm9ybWVkRmlsZXMod29ya2VySWQsIG1zZyk7XG4gICAgICBjYXNlICd1cGRhdGUtcGFja2FnZS1qc29uJzpcbiAgICAgICAgcmV0dXJuIHRoaXMub25Xb3JrZXJVcGRhdGVQYWNrYWdlSnNvbih3b3JrZXJJZCwgbXNnKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBJbnZhbGlkIG1lc3NhZ2UgcmVjZWl2ZWQgZnJvbSB3b3JrZXIgIyR7d29ya2VySWR9OiAke0pTT04uc3RyaW5naWZ5KG1zZyl9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEhhbmRsZSBhIHdvcmtlcidzIGNvbWluZyBvbmxpbmUuICovXG4gIHByaXZhdGUgb25Xb3JrZXJPbmxpbmUod29ya2VySWQ6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICh0aGlzLnRhc2tBc3NpZ25tZW50cy5oYXMod29ya2VySWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFyaWFudCB2aW9sYXRlZDogV29ya2VyICMke3dvcmtlcklkfSBjYW1lIG9ubGluZSBtb3JlIHRoYW4gb25jZS5gKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nU3RhcnRUaW1lID09PSAtMSkge1xuICAgICAgdGhpcy5sb2dnZXIuZGVidWcoJ1Byb2Nlc3NpbmcgdGFza3MuLi4nKTtcbiAgICAgIHRoaXMucHJvY2Vzc2luZ1N0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgfVxuXG4gICAgdGhpcy50YXNrQXNzaWdubWVudHMuc2V0KHdvcmtlcklkLCBudWxsKTtcbiAgICB0aGlzLm1heWJlRGlzdHJpYnV0ZVdvcmsoKTtcbiAgfVxuXG4gIC8qKiBIYW5kbGUgYSB3b3JrZXIncyBoYXZpbmcgY29tcGxldGVkIHRoZWlyIGFzc2lnbmVkIHRhc2suICovXG4gIHByaXZhdGUgb25Xb3JrZXJUYXNrQ29tcGxldGVkKHdvcmtlcklkOiBudW1iZXIsIG1zZzogVGFza0NvbXBsZXRlZE1lc3NhZ2UpOiB2b2lkIHtcbiAgICBjb25zdCBhc3NpZ25tZW50ID0gdGhpcy50YXNrQXNzaWdubWVudHMuZ2V0KHdvcmtlcklkKSB8fCBudWxsO1xuXG4gICAgaWYgKGFzc2lnbm1lbnQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgRXhwZWN0ZWQgd29ya2VyICMke3dvcmtlcklkfSB0byBoYXZlIGEgdGFzayBhc3NpZ25lZCwgd2hpbGUgaGFuZGxpbmcgbWVzc2FnZTogYCArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobXNnKSk7XG4gICAgfVxuXG4gICAgdGhpcy5vblRhc2tDb21wbGV0ZWQoYXNzaWdubWVudC50YXNrLCBtc2cub3V0Y29tZSwgbXNnLm1lc3NhZ2UpO1xuXG4gICAgdGhpcy50YXNrUXVldWUubWFya0FzQ29tcGxldGVkKGFzc2lnbm1lbnQudGFzayk7XG4gICAgdGhpcy50YXNrQXNzaWdubWVudHMuc2V0KHdvcmtlcklkLCBudWxsKTtcbiAgICB0aGlzLm1heWJlRGlzdHJpYnV0ZVdvcmsoKTtcbiAgfVxuXG4gIC8qKiBIYW5kbGUgYSB3b3JrZXIncyBtZXNzYWdlIHJlZ2FyZGluZyB0aGUgZmlsZXMgdHJhbnNmb3JtZWQgd2hpbGUgcHJvY2Vzc2luZyBpdHMgdGFzay4gKi9cbiAgcHJpdmF0ZSBvbldvcmtlclRyYW5zZm9ybWVkRmlsZXMod29ya2VySWQ6IG51bWJlciwgbXNnOiBUcmFuc2Zvcm1lZEZpbGVzTWVzc2FnZSk6IHZvaWQge1xuICAgIGNvbnN0IGFzc2lnbm1lbnQgPSB0aGlzLnRhc2tBc3NpZ25tZW50cy5nZXQod29ya2VySWQpIHx8IG51bGw7XG5cbiAgICBpZiAoYXNzaWdubWVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBFeHBlY3RlZCB3b3JrZXIgIyR7d29ya2VySWR9IHRvIGhhdmUgYSB0YXNrIGFzc2lnbmVkLCB3aGlsZSBoYW5kbGluZyBtZXNzYWdlOiBgICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgICB9XG5cbiAgICBjb25zdCBvbGRGaWxlcyA9IGFzc2lnbm1lbnQuZmlsZXM7XG4gICAgY29uc3QgbmV3RmlsZXMgPSBtc2cuZmlsZXM7XG5cbiAgICBpZiAob2xkRmlsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBXb3JrZXIgIyR7d29ya2VySWR9IHJlcG9ydGVkIHRyYW5zZm9ybWVkIGZpbGVzIG1vcmUgdGhhbiBvbmNlLlxcbmAgK1xuICAgICAgICAgIGAgIE9sZCBmaWxlcyAoJHtvbGRGaWxlcy5sZW5ndGh9KTogWyR7b2xkRmlsZXMuam9pbignLCAnKX1dXFxuYCArXG4gICAgICAgICAgYCAgTmV3IGZpbGVzICgke25ld0ZpbGVzLmxlbmd0aH0pOiBbJHtuZXdGaWxlcy5qb2luKCcsICcpfV1cXG5gKTtcbiAgICB9XG5cbiAgICBhc3NpZ25tZW50LmZpbGVzID0gbmV3RmlsZXM7XG4gIH1cblxuICAvKiogSGFuZGxlIGEgd29ya2VyJ3MgcmVxdWVzdCB0byB1cGRhdGUgYSBgcGFja2FnZS5qc29uYCBmaWxlLiAqL1xuICBwcml2YXRlIG9uV29ya2VyVXBkYXRlUGFja2FnZUpzb24od29ya2VySWQ6IG51bWJlciwgbXNnOiBVcGRhdGVQYWNrYWdlSnNvbk1lc3NhZ2UpOiB2b2lkIHtcbiAgICBjb25zdCBhc3NpZ25tZW50ID0gdGhpcy50YXNrQXNzaWdubWVudHMuZ2V0KHdvcmtlcklkKSB8fCBudWxsO1xuXG4gICAgaWYgKGFzc2lnbm1lbnQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgRXhwZWN0ZWQgd29ya2VyICMke3dvcmtlcklkfSB0byBoYXZlIGEgdGFzayBhc3NpZ25lZCwgd2hpbGUgaGFuZGxpbmcgbWVzc2FnZTogYCArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobXNnKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZW50cnlQb2ludCA9IGFzc2lnbm1lbnQudGFzay5lbnRyeVBvaW50O1xuICAgIGNvbnN0IGV4cGVjdGVkUGFja2FnZUpzb25QYXRoID0gdGhpcy5maWxlU3lzdGVtLnJlc29sdmUoZW50cnlQb2ludC5wYXRoLCAncGFja2FnZS5qc29uJyk7XG5cbiAgICBpZiAoZXhwZWN0ZWRQYWNrYWdlSnNvblBhdGggIT09IG1zZy5wYWNrYWdlSnNvblBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgUmVjZWl2ZWQgJyR7bXNnLnR5cGV9JyBtZXNzYWdlIGZyb20gd29ya2VyICMke3dvcmtlcklkfSBmb3IgJyR7bXNnLnBhY2thZ2VKc29uUGF0aH0nLCBgICtcbiAgICAgICAgICBgYnV0IHdhcyBleHBlY3RpbmcgJyR7ZXhwZWN0ZWRQYWNrYWdlSnNvblBhdGh9JyAoYmFzZWQgb24gdGFzayBhc3NpZ25tZW50KS5gKTtcbiAgICB9XG5cbiAgICAvLyBOT1RFOiBBbHRob3VnaCB0aGUgY2hhbmdlIGluIHRoZSBwYXJzZWQgYHBhY2thZ2UuanNvbmAgd2lsbCBiZSByZWZsZWN0ZWQgaW4gdGFza3Mgb2JqZWN0c1xuICAgIC8vICAgICAgIGxvY2FsbHkgYW5kIHRodXMgYWxzbyBpbiBmdXR1cmUgYHByb2Nlc3MtdGFza2AgbWVzc2FnZXMgc2VudCB0byB3b3JrZXIgcHJvY2Vzc2VzLCBhbnlcbiAgICAvLyAgICAgICBwcm9jZXNzZXMgYWxyZWFkeSBydW5uaW5nIGFuZCBwcm9jZXNzaW5nIGEgdGFzayBmb3IgdGhlIHNhbWUgZW50cnktcG9pbnQgd2lsbCBub3QgZ2V0XG4gICAgLy8gICAgICAgdGhlIGNoYW5nZS5cbiAgICAvLyAgICAgICBEbyBub3QgcmVseSBvbiBoYXZpbmcgYW4gdXAtdG8tZGF0ZSBgcGFja2FnZS5qc29uYCByZXByZXNlbnRhdGlvbiBpbiB3b3JrZXIgcHJvY2Vzc2VzLlxuICAgIC8vICAgICAgIEluIG90aGVyIHdvcmRzLCB0YXNrIHByb2Nlc3Npbmcgc2hvdWxkIG9ubHkgcmVseSBvbiB0aGUgaW5mbyB0aGF0IHdhcyB0aGVyZSB3aGVuIHRoZVxuICAgIC8vICAgICAgIGZpbGUgd2FzIGluaXRpYWxseSBwYXJzZWQgKGR1cmluZyBlbnRyeS1wb2ludCBhbmFseXNpcykgYW5kIG5vdCBvbiB0aGUgaW5mbyB0aGF0IG1pZ2h0XG4gICAgLy8gICAgICAgYmUgYWRkZWQgbGF0ZXIgKGR1cmluZyB0YXNrIHByb2Nlc3NpbmcpLlxuICAgIHRoaXMucGtnSnNvblVwZGF0ZXIud3JpdGVDaGFuZ2VzKG1zZy5jaGFuZ2VzLCBtc2cucGFja2FnZUpzb25QYXRoLCBlbnRyeVBvaW50LnBhY2thZ2VKc29uKTtcbiAgfVxuXG4gIC8qKiBTdG9wIGFsbCB3b3JrZXJzIGFuZCBzdG9wIGxpc3RlbmluZyBvbiBjbHVzdGVyIGV2ZW50cy4gKi9cbiAgcHJpdmF0ZSBzdG9wV29ya2VycygpOiB2b2lkIHtcbiAgICBjb25zdCB3b3JrZXJzID0gT2JqZWN0LnZhbHVlcyhjbHVzdGVyLndvcmtlcnMpIGFzIGNsdXN0ZXIuV29ya2VyW107XG4gICAgdGhpcy5sb2dnZXIuZGVidWcoYFN0b3BwaW5nICR7d29ya2Vycy5sZW5ndGh9IHdvcmtlcnMuLi5gKTtcblxuICAgIGNsdXN0ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgd29ya2Vycy5mb3JFYWNoKHdvcmtlciA9PiB3b3JrZXIua2lsbCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcmFwIGFuIGV2ZW50IGhhbmRsZXIgdG8gZW5zdXJlIHRoYXQgYGZpbmlzaGVkRGVmZXJyZWRgIHdpbGwgYmUgcmVqZWN0ZWQgb24gZXJyb3IgKHJlZ2FyZGxlc3NcbiAgICogaWYgdGhlIGhhbmRsZXIgY29tcGxldGVzIHN5bmNocm9ub3VzbHkgb3IgYXN5bmNocm9ub3VzbHkpLlxuICAgKi9cbiAgcHJpdmF0ZSB3cmFwRXZlbnRIYW5kbGVyPEFyZ3MgZXh0ZW5kcyB1bmtub3duW10+KGZuOiAoLi4uYXJnczogQXJncykgPT4gdm9pZHxQcm9taXNlPHZvaWQ+KTpcbiAgICAgICguLi5hcmdzOiBBcmdzKSA9PiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gYXN5bmMgKC4uLmFyZ3M6IEFyZ3MpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZuKC4uLmFyZ3MpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMuZmluaXNoZWREZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG59XG4iXX0=