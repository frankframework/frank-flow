import { stringifyTask } from '../utils';
/**
 * A base `TaskQueue` implementation to be used as base for concrete implementations.
 */
export class BaseTaskQueue {
    constructor(logger, tasks, dependencies) {
        this.logger = logger;
        this.tasks = tasks;
        this.dependencies = dependencies;
        this.inProgressTasks = new Set();
        /**
         * A map of tasks that should be skipped, mapped to the task that caused them to be skipped.
         */
        this.tasksToSkip = new Map();
    }
    get allTasksCompleted() {
        return (this.tasks.length === 0) && (this.inProgressTasks.size === 0);
    }
    getNextTask() {
        let nextTask = this.computeNextTask();
        while (nextTask !== null) {
            if (!this.tasksToSkip.has(nextTask)) {
                break;
            }
            // We are skipping this task so mark it as complete
            this.markAsCompleted(nextTask);
            const failedTask = this.tasksToSkip.get(nextTask);
            this.logger.warn(`Skipping processing of ${nextTask.entryPoint.name} because its dependency ${failedTask.entryPoint.name} failed to compile.`);
            nextTask = this.computeNextTask();
        }
        return nextTask;
    }
    markAsCompleted(task) {
        if (!this.inProgressTasks.has(task)) {
            throw new Error(`Trying to mark task that was not in progress as completed: ${stringifyTask(task)}`);
        }
        this.inProgressTasks.delete(task);
    }
    markAsFailed(task) {
        if (this.dependencies.has(task)) {
            for (const dependentTask of this.dependencies.get(task)) {
                this.skipDependentTasks(dependentTask, task);
            }
        }
    }
    markAsUnprocessed(task) {
        if (!this.inProgressTasks.has(task)) {
            throw new Error(`Trying to mark task that was not in progress as unprocessed: ${stringifyTask(task)}`);
        }
        this.inProgressTasks.delete(task);
        this.tasks.unshift(task);
    }
    toString() {
        const inProgTasks = Array.from(this.inProgressTasks);
        return `${this.constructor.name}\n` +
            `  All tasks completed: ${this.allTasksCompleted}\n` +
            `  Unprocessed tasks (${this.tasks.length}): ${this.stringifyTasks(this.tasks, '    ')}\n` +
            `  In-progress tasks (${inProgTasks.length}): ${this.stringifyTasks(inProgTasks, '    ')}`;
    }
    /**
     * Mark the given `task` as to be skipped, then recursive skip all its dependents.
     *
     * @param task The task to skip
     * @param failedTask The task that failed, causing this task to be skipped
     */
    skipDependentTasks(task, failedTask) {
        this.tasksToSkip.set(task, failedTask);
        if (this.dependencies.has(task)) {
            for (const dependentTask of this.dependencies.get(task)) {
                this.skipDependentTasks(dependentTask, failedTask);
            }
        }
    }
    stringifyTasks(tasks, indentation) {
        return tasks.map(task => `\n${indentation}- ${stringifyTask(task)}`).join('');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZV90YXNrX3F1ZXVlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2V4ZWN1dGlvbi90YXNrcy9xdWV1ZXMvYmFzZV90YXNrX3F1ZXVlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVNBLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFHdkM7O0dBRUc7QUFDSCxNQUFNLE9BQWdCLGFBQWE7SUFXakMsWUFDYyxNQUFjLEVBQVksS0FBNEIsRUFDdEQsWUFBOEI7UUFEOUIsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUFZLFVBQUssR0FBTCxLQUFLLENBQXVCO1FBQ3RELGlCQUFZLEdBQVosWUFBWSxDQUFrQjtRQVRsQyxvQkFBZSxHQUFHLElBQUksR0FBRyxFQUFRLENBQUM7UUFFNUM7O1dBRUc7UUFDSyxnQkFBVyxHQUFHLElBQUksR0FBRyxFQUFjLENBQUM7SUFJRyxDQUFDO0lBWmhELElBQUksaUJBQWlCO1FBQ25CLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFjRCxXQUFXO1FBQ1QsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3RDLE9BQU8sUUFBUSxLQUFLLElBQUksRUFBRTtZQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ25DLE1BQU07YUFDUDtZQUNELG1EQUFtRDtZQUNuRCxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQy9CLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FB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QyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge1BhcnRpYWxseU9yZGVyZWRUYXNrcywgVGFzaywgVGFza0RlcGVuZGVuY2llcywgVGFza1F1ZXVlfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHtzdHJpbmdpZnlUYXNrfSBmcm9tICcuLi91dGlscyc7XG5cblxuLyoqXG4gKiBBIGJhc2UgYFRhc2tRdWV1ZWAgaW1wbGVtZW50YXRpb24gdG8gYmUgdXNlZCBhcyBiYXNlIGZvciBjb25jcmV0ZSBpbXBsZW1lbnRhdGlvbnMuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlVGFza1F1ZXVlIGltcGxlbWVudHMgVGFza1F1ZXVlIHtcbiAgZ2V0IGFsbFRhc2tzQ29tcGxldGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAodGhpcy50YXNrcy5sZW5ndGggPT09IDApICYmICh0aGlzLmluUHJvZ3Jlc3NUYXNrcy5zaXplID09PSAwKTtcbiAgfVxuICBwcm90ZWN0ZWQgaW5Qcm9ncmVzc1Rhc2tzID0gbmV3IFNldDxUYXNrPigpO1xuXG4gIC8qKlxuICAgKiBBIG1hcCBvZiB0YXNrcyB0aGF0IHNob3VsZCBiZSBza2lwcGVkLCBtYXBwZWQgdG8gdGhlIHRhc2sgdGhhdCBjYXVzZWQgdGhlbSB0byBiZSBza2lwcGVkLlxuICAgKi9cbiAgcHJpdmF0ZSB0YXNrc1RvU2tpcCA9IG5ldyBNYXA8VGFzaywgVGFzaz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByb3RlY3RlZCBsb2dnZXI6IExvZ2dlciwgcHJvdGVjdGVkIHRhc2tzOiBQYXJ0aWFsbHlPcmRlcmVkVGFza3MsXG4gICAgICBwcm90ZWN0ZWQgZGVwZW5kZW5jaWVzOiBUYXNrRGVwZW5kZW5jaWVzKSB7fVxuXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBjb21wdXRlTmV4dFRhc2soKTogVGFza3xudWxsO1xuXG4gIGdldE5leHRUYXNrKCk6IFRhc2t8bnVsbCB7XG4gICAgbGV0IG5leHRUYXNrID0gdGhpcy5jb21wdXRlTmV4dFRhc2soKTtcbiAgICB3aGlsZSAobmV4dFRhc2sgIT09IG51bGwpIHtcbiAgICAgIGlmICghdGhpcy50YXNrc1RvU2tpcC5oYXMobmV4dFRhc2spKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gV2UgYXJlIHNraXBwaW5nIHRoaXMgdGFzayBzbyBtYXJrIGl0IGFzIGNvbXBsZXRlXG4gICAgICB0aGlzLm1hcmtBc0NvbXBsZXRlZChuZXh0VGFzayk7XG4gICAgICBjb25zdCBmYWlsZWRUYXNrID0gdGhpcy50YXNrc1RvU2tpcC5nZXQobmV4dFRhc2spITtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oYFNraXBwaW5nIHByb2Nlc3Npbmcgb2YgJHtuZXh0VGFzay5lbnRyeVBvaW50Lm5hbWV9IGJlY2F1c2UgaXRzIGRlcGVuZGVuY3kgJHtcbiAgICAgICAgICBmYWlsZWRUYXNrLmVudHJ5UG9pbnQubmFtZX0gZmFpbGVkIHRvIGNvbXBpbGUuYCk7XG4gICAgICBuZXh0VGFzayA9IHRoaXMuY29tcHV0ZU5leHRUYXNrKCk7XG4gICAgfVxuICAgIHJldHVybiBuZXh0VGFzaztcbiAgfVxuXG4gIG1hcmtBc0NvbXBsZXRlZCh0YXNrOiBUYXNrKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmluUHJvZ3Jlc3NUYXNrcy5oYXModGFzaykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVHJ5aW5nIHRvIG1hcmsgdGFzayB0aGF0IHdhcyBub3QgaW4gcHJvZ3Jlc3MgYXMgY29tcGxldGVkOiAke3N0cmluZ2lmeVRhc2sodGFzayl9YCk7XG4gICAgfVxuXG4gICAgdGhpcy5pblByb2dyZXNzVGFza3MuZGVsZXRlKHRhc2spO1xuICB9XG5cbiAgbWFya0FzRmFpbGVkKHRhc2s6IFRhc2spOiB2b2lkIHtcbiAgICBpZiAodGhpcy5kZXBlbmRlbmNpZXMuaGFzKHRhc2spKSB7XG4gICAgICBmb3IgKGNvbnN0IGRlcGVuZGVudFRhc2sgb2YgdGhpcy5kZXBlbmRlbmNpZXMuZ2V0KHRhc2spISkge1xuICAgICAgICB0aGlzLnNraXBEZXBlbmRlbnRUYXNrcyhkZXBlbmRlbnRUYXNrLCB0YXNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBtYXJrQXNVbnByb2Nlc3NlZCh0YXNrOiBUYXNrKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmluUHJvZ3Jlc3NUYXNrcy5oYXModGFzaykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVHJ5aW5nIHRvIG1hcmsgdGFzayB0aGF0IHdhcyBub3QgaW4gcHJvZ3Jlc3MgYXMgdW5wcm9jZXNzZWQ6ICR7c3RyaW5naWZ5VGFzayh0YXNrKX1gKTtcbiAgICB9XG5cbiAgICB0aGlzLmluUHJvZ3Jlc3NUYXNrcy5kZWxldGUodGFzayk7XG4gICAgdGhpcy50YXNrcy51bnNoaWZ0KHRhc2spO1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBpblByb2dUYXNrcyA9IEFycmF5LmZyb20odGhpcy5pblByb2dyZXNzVGFza3MpO1xuXG4gICAgcmV0dXJuIGAke3RoaXMuY29uc3RydWN0b3IubmFtZX1cXG5gICtcbiAgICAgICAgYCAgQWxsIHRhc2tzIGNvbXBsZXRlZDogJHt0aGlzLmFsbFRhc2tzQ29tcGxldGVkfVxcbmAgK1xuICAgICAgICBgICBVbnByb2Nlc3NlZCB0YXNrcyAoJHt0aGlzLnRhc2tzLmxlbmd0aH0pOiAke3RoaXMuc3RyaW5naWZ5VGFza3ModGhpcy50YXNrcywgJyAgICAnKX1cXG5gICtcbiAgICAgICAgYCAgSW4tcHJvZ3Jlc3MgdGFza3MgKCR7aW5Qcm9nVGFza3MubGVuZ3RofSk6ICR7dGhpcy5zdHJpbmdpZnlUYXNrcyhpblByb2dUYXNrcywgJyAgICAnKX1gO1xuICB9XG5cbiAgLyoqXG4gICAqIE1hcmsgdGhlIGdpdmVuIGB0YXNrYCBhcyB0byBiZSBza2lwcGVkLCB0aGVuIHJlY3Vyc2l2ZSBza2lwIGFsbCBpdHMgZGVwZW5kZW50cy5cbiAgICpcbiAgICogQHBhcmFtIHRhc2sgVGhlIHRhc2sgdG8gc2tpcFxuICAgKiBAcGFyYW0gZmFpbGVkVGFzayBUaGUgdGFzayB0aGF0IGZhaWxlZCwgY2F1c2luZyB0aGlzIHRhc2sgdG8gYmUgc2tpcHBlZFxuICAgKi9cbiAgcHJvdGVjdGVkIHNraXBEZXBlbmRlbnRUYXNrcyh0YXNrOiBUYXNrLCBmYWlsZWRUYXNrOiBUYXNrKSB7XG4gICAgdGhpcy50YXNrc1RvU2tpcC5zZXQodGFzaywgZmFpbGVkVGFzayk7XG4gICAgaWYgKHRoaXMuZGVwZW5kZW5jaWVzLmhhcyh0YXNrKSkge1xuICAgICAgZm9yIChjb25zdCBkZXBlbmRlbnRUYXNrIG9mIHRoaXMuZGVwZW5kZW5jaWVzLmdldCh0YXNrKSEpIHtcbiAgICAgICAgdGhpcy5za2lwRGVwZW5kZW50VGFza3MoZGVwZW5kZW50VGFzaywgZmFpbGVkVGFzayk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHN0cmluZ2lmeVRhc2tzKHRhc2tzOiBUYXNrW10sIGluZGVudGF0aW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0YXNrcy5tYXAodGFzayA9PiBgXFxuJHtpbmRlbnRhdGlvbn0tICR7c3RyaW5naWZ5VGFzayh0YXNrKX1gKS5qb2luKCcnKTtcbiAgfVxufVxuIl19