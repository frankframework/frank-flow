import { getBlockedTasks, sortTasksByPriority, stringifyTask } from '../utils';
import { BaseTaskQueue } from './base_task_queue';
/**
 * A `TaskQueue` implementation that assumes tasks are processed in parallel, thus has to ensure a
 * task's dependencies have been processed before processing the task.
 */
export class ParallelTaskQueue extends BaseTaskQueue {
    constructor(logger, tasks, dependencies) {
        super(logger, sortTasksByPriority(tasks, dependencies), dependencies);
        this.blockedTasks = getBlockedTasks(dependencies);
    }
    computeNextTask() {
        // Look for the first available (i.e. not blocked) task.
        // (NOTE: Since tasks are sorted by priority, the first available one is the best choice.)
        const nextTaskIdx = this.tasks.findIndex(task => !this.blockedTasks.has(task));
        if (nextTaskIdx === -1)
            return null;
        // Remove the task from the list of available tasks and add it to the list of in-progress tasks.
        const nextTask = this.tasks[nextTaskIdx];
        this.tasks.splice(nextTaskIdx, 1);
        this.inProgressTasks.add(nextTask);
        return nextTask;
    }
    markAsCompleted(task) {
        super.markAsCompleted(task);
        if (!this.dependencies.has(task)) {
            return;
        }
        // Unblock the tasks that are dependent upon `task`
        for (const dependentTask of this.dependencies.get(task)) {
            if (this.blockedTasks.has(dependentTask)) {
                const blockingTasks = this.blockedTasks.get(dependentTask);
                // Remove the completed task from the lists of tasks blocking other tasks.
                blockingTasks.delete(task);
                if (blockingTasks.size === 0) {
                    // If the dependent task is not blocked any more, mark it for unblocking.
                    this.blockedTasks.delete(dependentTask);
                }
            }
        }
    }
    toString() {
        return `${super.toString()}\n` +
            `  Blocked tasks (${this.blockedTasks.size}): ${this.stringifyBlockedTasks('    ')}`;
    }
    stringifyBlockedTasks(indentation) {
        return Array.from(this.blockedTasks)
            .map(([task, blockingTasks]) => `\n${indentation}- ${stringifyTask(task)} (${blockingTasks.size}): ` +
            this.stringifyTasks(Array.from(blockingTasks), `${indentation}    `))
            .join('');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyYWxsZWxfdGFza19xdWV1ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9leGVjdXRpb24vdGFza3MvcXVldWVzL3BhcmFsbGVsX3Rhc2tfcXVldWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFDLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxhQUFhLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDN0UsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRWhEOzs7R0FHRztBQUNILE1BQU0sT0FBTyxpQkFBa0IsU0FBUSxhQUFhO0lBUWxELFlBQVksTUFBYyxFQUFFLEtBQTRCLEVBQUUsWUFBOEI7UUFDdEYsS0FBSyxDQUFDLE1BQU0sRUFBRSxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDdEUsSUFBSSxDQUFDLFlBQVksR0FBRyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELGVBQWU7UUFDYix3REFBd0Q7UUFDeEQsMEZBQTBGO1FBQzFGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQy9FLElBQUksV0FBVyxLQUFLLENBQUMsQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRXBDLGdHQUFnRztRQUNoRyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVuQyxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQsZUFBZSxDQUFDLElBQVU7UUFDeEIsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU1QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEMsT0FBTztTQUNSO1FBRUQsbURBQW1EO1FBQ25ELEtBQUssTUFBTSxhQUFhLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLEVBQUU7WUFDeEQsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRTtnQkFDeEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFFLENBQUM7Z0JBQzVELDBFQUEwRTtnQkFDMUUsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDM0IsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtvQkFDNUIseUVBQXlFO29CQUN6RSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztpQkFDekM7YUFDRjtTQUNGO0lBQ0gsQ0FBQztJQUVELFFBQVE7UUFDTixPQUFPLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJO1lBQzFCLG9CQUFvQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUMzRixDQUFDO0lBRU8scUJBQXFCLENBQUMsV0FBbUI7UUFDL0MsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7YUFDL0IsR0FBRyxDQUNBLENBQUMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLEVBQUUsRUFBRSxDQUN0QixLQUFLLFdBQVcsS0FBSyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssYUFBYSxDQUFDLElBQUksS0FBSztZQUNwRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsR0FBRyxXQUFXLE1BQU0sQ0FBQyxDQUFDO2FBQzVFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNoQixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge1BhcnRpYWxseU9yZGVyZWRUYXNrcywgVGFzaywgVGFza0RlcGVuZGVuY2llc30gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7Z2V0QmxvY2tlZFRhc2tzLCBzb3J0VGFza3NCeVByaW9yaXR5LCBzdHJpbmdpZnlUYXNrfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQge0Jhc2VUYXNrUXVldWV9IGZyb20gJy4vYmFzZV90YXNrX3F1ZXVlJztcblxuLyoqXG4gKiBBIGBUYXNrUXVldWVgIGltcGxlbWVudGF0aW9uIHRoYXQgYXNzdW1lcyB0YXNrcyBhcmUgcHJvY2Vzc2VkIGluIHBhcmFsbGVsLCB0aHVzIGhhcyB0byBlbnN1cmUgYVxuICogdGFzaydzIGRlcGVuZGVuY2llcyBoYXZlIGJlZW4gcHJvY2Vzc2VkIGJlZm9yZSBwcm9jZXNzaW5nIHRoZSB0YXNrLlxuICovXG5leHBvcnQgY2xhc3MgUGFyYWxsZWxUYXNrUXVldWUgZXh0ZW5kcyBCYXNlVGFza1F1ZXVlIHtcbiAgLyoqXG4gICAqIEEgbWFwIGZyb20gVGFza3MgdG8gdGhlIFRhc2tzIHRoYXQgaXQgZGVwZW5kcyB1cG9uLlxuICAgKlxuICAgKiBUaGlzIGlzIHRoZSByZXZlcnNlIG1hcHBpbmcgb2YgYFRhc2tEZXBlbmRlbmNpZXNgLlxuICAgKi9cbiAgcHJpdmF0ZSBibG9ja2VkVGFza3M6IE1hcDxUYXNrLCBTZXQ8VGFzaz4+O1xuXG4gIGNvbnN0cnVjdG9yKGxvZ2dlcjogTG9nZ2VyLCB0YXNrczogUGFydGlhbGx5T3JkZXJlZFRhc2tzLCBkZXBlbmRlbmNpZXM6IFRhc2tEZXBlbmRlbmNpZXMpIHtcbiAgICBzdXBlcihsb2dnZXIsIHNvcnRUYXNrc0J5UHJpb3JpdHkodGFza3MsIGRlcGVuZGVuY2llcyksIGRlcGVuZGVuY2llcyk7XG4gICAgdGhpcy5ibG9ja2VkVGFza3MgPSBnZXRCbG9ja2VkVGFza3MoZGVwZW5kZW5jaWVzKTtcbiAgfVxuXG4gIGNvbXB1dGVOZXh0VGFzaygpOiBUYXNrfG51bGwge1xuICAgIC8vIExvb2sgZm9yIHRoZSBmaXJzdCBhdmFpbGFibGUgKGkuZS4gbm90IGJsb2NrZWQpIHRhc2suXG4gICAgLy8gKE5PVEU6IFNpbmNlIHRhc2tzIGFyZSBzb3J0ZWQgYnkgcHJpb3JpdHksIHRoZSBmaXJzdCBhdmFpbGFibGUgb25lIGlzIHRoZSBiZXN0IGNob2ljZS4pXG4gICAgY29uc3QgbmV4dFRhc2tJZHggPSB0aGlzLnRhc2tzLmZpbmRJbmRleCh0YXNrID0+ICF0aGlzLmJsb2NrZWRUYXNrcy5oYXModGFzaykpO1xuICAgIGlmIChuZXh0VGFza0lkeCA9PT0gLTEpIHJldHVybiBudWxsO1xuXG4gICAgLy8gUmVtb3ZlIHRoZSB0YXNrIGZyb20gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIHRhc2tzIGFuZCBhZGQgaXQgdG8gdGhlIGxpc3Qgb2YgaW4tcHJvZ3Jlc3MgdGFza3MuXG4gICAgY29uc3QgbmV4dFRhc2sgPSB0aGlzLnRhc2tzW25leHRUYXNrSWR4XTtcbiAgICB0aGlzLnRhc2tzLnNwbGljZShuZXh0VGFza0lkeCwgMSk7XG4gICAgdGhpcy5pblByb2dyZXNzVGFza3MuYWRkKG5leHRUYXNrKTtcblxuICAgIHJldHVybiBuZXh0VGFzaztcbiAgfVxuXG4gIG1hcmtBc0NvbXBsZXRlZCh0YXNrOiBUYXNrKTogdm9pZCB7XG4gICAgc3VwZXIubWFya0FzQ29tcGxldGVkKHRhc2spO1xuXG4gICAgaWYgKCF0aGlzLmRlcGVuZGVuY2llcy5oYXModGFzaykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVbmJsb2NrIHRoZSB0YXNrcyB0aGF0IGFyZSBkZXBlbmRlbnQgdXBvbiBgdGFza2BcbiAgICBmb3IgKGNvbnN0IGRlcGVuZGVudFRhc2sgb2YgdGhpcy5kZXBlbmRlbmNpZXMuZ2V0KHRhc2spISkge1xuICAgICAgaWYgKHRoaXMuYmxvY2tlZFRhc2tzLmhhcyhkZXBlbmRlbnRUYXNrKSkge1xuICAgICAgICBjb25zdCBibG9ja2luZ1Rhc2tzID0gdGhpcy5ibG9ja2VkVGFza3MuZ2V0KGRlcGVuZGVudFRhc2spITtcbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBjb21wbGV0ZWQgdGFzayBmcm9tIHRoZSBsaXN0cyBvZiB0YXNrcyBibG9ja2luZyBvdGhlciB0YXNrcy5cbiAgICAgICAgYmxvY2tpbmdUYXNrcy5kZWxldGUodGFzayk7XG4gICAgICAgIGlmIChibG9ja2luZ1Rhc2tzLnNpemUgPT09IDApIHtcbiAgICAgICAgICAvLyBJZiB0aGUgZGVwZW5kZW50IHRhc2sgaXMgbm90IGJsb2NrZWQgYW55IG1vcmUsIG1hcmsgaXQgZm9yIHVuYmxvY2tpbmcuXG4gICAgICAgICAgdGhpcy5ibG9ja2VkVGFza3MuZGVsZXRlKGRlcGVuZGVudFRhc2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7c3VwZXIudG9TdHJpbmcoKX1cXG5gICtcbiAgICAgICAgYCAgQmxvY2tlZCB0YXNrcyAoJHt0aGlzLmJsb2NrZWRUYXNrcy5zaXplfSk6ICR7dGhpcy5zdHJpbmdpZnlCbG9ja2VkVGFza3MoJyAgICAnKX1gO1xuICB9XG5cbiAgcHJpdmF0ZSBzdHJpbmdpZnlCbG9ja2VkVGFza3MoaW5kZW50YXRpb246IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5ibG9ja2VkVGFza3MpXG4gICAgICAgIC5tYXAoXG4gICAgICAgICAgICAoW3Rhc2ssIGJsb2NraW5nVGFza3NdKSA9PlxuICAgICAgICAgICAgICAgIGBcXG4ke2luZGVudGF0aW9ufS0gJHtzdHJpbmdpZnlUYXNrKHRhc2spfSAoJHtibG9ja2luZ1Rhc2tzLnNpemV9KTogYCArXG4gICAgICAgICAgICAgICAgdGhpcy5zdHJpbmdpZnlUYXNrcyhBcnJheS5mcm9tKGJsb2NraW5nVGFza3MpLCBgJHtpbmRlbnRhdGlvbn0gICAgYCkpXG4gICAgICAgIC5qb2luKCcnKTtcbiAgfVxufVxuIl19