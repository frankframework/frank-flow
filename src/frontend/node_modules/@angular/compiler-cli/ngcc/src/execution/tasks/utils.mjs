import { DtsProcessing, TaskDependencies } from './api';
/** Stringify a task for debugging purposes. */
export const stringifyTask = (task) => `{entryPoint: ${task.entryPoint.name}, formatProperty: ${task.formatProperty}, ` +
    `processDts: ${DtsProcessing[task.processDts]}}`;
/**
 * Compute a mapping of tasks to the tasks that are dependent on them (if any).
 *
 * Task A can depend upon task B, if either:
 *
 * * A and B have the same entry-point _and_ B is generating the typings for that entry-point
 *   (i.e. has `processDts: true`).
 * * A's entry-point depends on B's entry-point _and_ B is also generating typings.
 *
 * NOTE: If a task is not generating typings, then it cannot affect anything which depends on its
 *       entry-point, regardless of the dependency graph. To put this another way, only the task
 *       which produces the typings for a dependency needs to have been completed.
 *
 * As a performance optimization, we take into account the fact that `tasks` are sorted in such a
 * way that a task can only depend on earlier tasks (i.e. dependencies always come before
 * dependents in the list of tasks).
 *
 * @param tasks A (partially ordered) list of tasks.
 * @param graph The dependency graph between entry-points.
 * @return A map from each task to those tasks directly dependent upon it.
 */
export function computeTaskDependencies(tasks, graph) {
    const dependencies = new TaskDependencies();
    const candidateDependencies = new Map();
    tasks.forEach(task => {
        const entryPointPath = task.entryPoint.path;
        // Find the earlier tasks (`candidateDependencies`) that this task depends upon.
        const deps = graph.dependenciesOf(entryPointPath);
        const taskDependencies = deps.filter(dep => candidateDependencies.has(dep))
            .map(dep => candidateDependencies.get(dep));
        // If this task has dependencies, add it to the dependencies and dependents maps.
        if (taskDependencies.length > 0) {
            for (const dependency of taskDependencies) {
                const taskDependents = getDependentsSet(dependencies, dependency);
                taskDependents.add(task);
            }
        }
        if (task.processDts !== DtsProcessing.No) {
            // SANITY CHECK:
            // There should only be one task per entry-point that generates typings (and thus can be a
            // dependency of other tasks), so the following should theoretically never happen, but check
            // just in case.
            if (candidateDependencies.has(entryPointPath)) {
                const otherTask = candidateDependencies.get(entryPointPath);
                throw new Error('Invariant violated: Multiple tasks are assigned generating typings for ' +
                    `'${entryPointPath}':\n  - ${stringifyTask(otherTask)}\n  - ${stringifyTask(task)}`);
            }
            // This task can potentially be a dependency (i.e. it generates typings), so add it to the
            // list of candidate dependencies for subsequent tasks.
            candidateDependencies.set(entryPointPath, task);
        }
        else {
            // This task is not generating typings so we need to add it to the dependents of the task that
            // does generate typings, if that exists
            if (candidateDependencies.has(entryPointPath)) {
                const typingsTask = candidateDependencies.get(entryPointPath);
                const typingsTaskDependents = getDependentsSet(dependencies, typingsTask);
                typingsTaskDependents.add(task);
            }
        }
    });
    return dependencies;
}
export function getDependentsSet(map, task) {
    if (!map.has(task)) {
        map.set(task, new Set());
    }
    return map.get(task);
}
/**
 * Invert the given mapping of Task dependencies.
 *
 * @param dependencies The mapping of tasks to the tasks that depend upon them.
 * @returns A mapping of tasks to the tasks that they depend upon.
 */
export function getBlockedTasks(dependencies) {
    const blockedTasks = new Map();
    for (const [dependency, dependents] of dependencies) {
        for (const dependent of dependents) {
            const dependentSet = getDependentsSet(blockedTasks, dependent);
            dependentSet.add(dependency);
        }
    }
    return blockedTasks;
}
/**
 * Sort a list of tasks by priority.
 *
 * Priority is determined by the number of other tasks that a task is (transitively) blocking:
 * The more tasks a task is blocking the higher its priority is, because processing it will
 * potentially unblock more tasks.
 *
 * To keep the behavior predictable, if two tasks block the same number of other tasks, their
 * relative order in the original `tasks` lists is preserved.
 *
 * @param tasks A (partially ordered) list of tasks.
 * @param dependencies The mapping of tasks to the tasks that depend upon them.
 * @return The list of tasks sorted by priority.
 */
export function sortTasksByPriority(tasks, dependencies) {
    const priorityPerTask = new Map();
    const computePriority = (task, idx) => [dependencies.has(task) ? dependencies.get(task).size : 0, idx];
    tasks.forEach((task, i) => priorityPerTask.set(task, computePriority(task, i)));
    return tasks.slice().sort((task1, task2) => {
        const [p1, idx1] = priorityPerTask.get(task1);
        const [p2, idx2] = priorityPerTask.get(task2);
        return (p2 - p1) || (idx1 - idx2);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvZXhlY3V0aW9uL3Rhc2tzL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVNBLE9BQU8sRUFBQyxhQUFhLEVBQStCLGdCQUFnQixFQUFDLE1BQU0sT0FBTyxDQUFDO0FBRW5GLCtDQUErQztBQUMvQyxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxJQUFVLEVBQVUsRUFBRSxDQUNoRCxnQkFBZ0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLHFCQUFxQixJQUFJLENBQUMsY0FBYyxJQUFJO0lBQ2hGLGVBQWUsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO0FBRXJEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9CRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FDbkMsS0FBNEIsRUFBRSxLQUEyQjtJQUMzRCxNQUFNLFlBQVksR0FBRyxJQUFJLGdCQUFnQixFQUFFLENBQUM7SUFDNUMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBZ0IsQ0FBQztJQUV0RCxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ25CLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBRTVDLGdGQUFnRjtRQUNoRixNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM3QyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFFLENBQUMsQ0FB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LENBQUMsRUFBRSxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFaEYsT0FBTyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO1FBQ3pDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUUsQ0FBQztRQUMvQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFFLENBQUM7UUFFL0MsT0FBTyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7RGVwR3JhcGh9IGZyb20gJ2RlcGVuZGVuY3ktZ3JhcGgnO1xuaW1wb3J0IHtFbnRyeVBvaW50fSBmcm9tICcuLi8uLi9wYWNrYWdlcy9lbnRyeV9wb2ludCc7XG5pbXBvcnQge0R0c1Byb2Nlc3NpbmcsIFBhcnRpYWxseU9yZGVyZWRUYXNrcywgVGFzaywgVGFza0RlcGVuZGVuY2llc30gZnJvbSAnLi9hcGknO1xuXG4vKiogU3RyaW5naWZ5IGEgdGFzayBmb3IgZGVidWdnaW5nIHB1cnBvc2VzLiAqL1xuZXhwb3J0IGNvbnN0IHN0cmluZ2lmeVRhc2sgPSAodGFzazogVGFzayk6IHN0cmluZyA9PlxuICAgIGB7ZW50cnlQb2ludDogJHt0YXNrLmVudHJ5UG9pbnQubmFtZX0sIGZvcm1hdFByb3BlcnR5OiAke3Rhc2suZm9ybWF0UHJvcGVydHl9LCBgICtcbiAgICBgcHJvY2Vzc0R0czogJHtEdHNQcm9jZXNzaW5nW3Rhc2sucHJvY2Vzc0R0c119fWA7XG5cbi8qKlxuICogQ29tcHV0ZSBhIG1hcHBpbmcgb2YgdGFza3MgdG8gdGhlIHRhc2tzIHRoYXQgYXJlIGRlcGVuZGVudCBvbiB0aGVtIChpZiBhbnkpLlxuICpcbiAqIFRhc2sgQSBjYW4gZGVwZW5kIHVwb24gdGFzayBCLCBpZiBlaXRoZXI6XG4gKlxuICogKiBBIGFuZCBCIGhhdmUgdGhlIHNhbWUgZW50cnktcG9pbnQgX2FuZF8gQiBpcyBnZW5lcmF0aW5nIHRoZSB0eXBpbmdzIGZvciB0aGF0IGVudHJ5LXBvaW50XG4gKiAgIChpLmUuIGhhcyBgcHJvY2Vzc0R0czogdHJ1ZWApLlxuICogKiBBJ3MgZW50cnktcG9pbnQgZGVwZW5kcyBvbiBCJ3MgZW50cnktcG9pbnQgX2FuZF8gQiBpcyBhbHNvIGdlbmVyYXRpbmcgdHlwaW5ncy5cbiAqXG4gKiBOT1RFOiBJZiBhIHRhc2sgaXMgbm90IGdlbmVyYXRpbmcgdHlwaW5ncywgdGhlbiBpdCBjYW5ub3QgYWZmZWN0IGFueXRoaW5nIHdoaWNoIGRlcGVuZHMgb24gaXRzXG4gKiAgICAgICBlbnRyeS1wb2ludCwgcmVnYXJkbGVzcyBvZiB0aGUgZGVwZW5kZW5jeSBncmFwaC4gVG8gcHV0IHRoaXMgYW5vdGhlciB3YXksIG9ubHkgdGhlIHRhc2tcbiAqICAgICAgIHdoaWNoIHByb2R1Y2VzIHRoZSB0eXBpbmdzIGZvciBhIGRlcGVuZGVuY3kgbmVlZHMgdG8gaGF2ZSBiZWVuIGNvbXBsZXRlZC5cbiAqXG4gKiBBcyBhIHBlcmZvcm1hbmNlIG9wdGltaXphdGlvbiwgd2UgdGFrZSBpbnRvIGFjY291bnQgdGhlIGZhY3QgdGhhdCBgdGFza3NgIGFyZSBzb3J0ZWQgaW4gc3VjaCBhXG4gKiB3YXkgdGhhdCBhIHRhc2sgY2FuIG9ubHkgZGVwZW5kIG9uIGVhcmxpZXIgdGFza3MgKGkuZS4gZGVwZW5kZW5jaWVzIGFsd2F5cyBjb21lIGJlZm9yZVxuICogZGVwZW5kZW50cyBpbiB0aGUgbGlzdCBvZiB0YXNrcykuXG4gKlxuICogQHBhcmFtIHRhc2tzIEEgKHBhcnRpYWxseSBvcmRlcmVkKSBsaXN0IG9mIHRhc2tzLlxuICogQHBhcmFtIGdyYXBoIFRoZSBkZXBlbmRlbmN5IGdyYXBoIGJldHdlZW4gZW50cnktcG9pbnRzLlxuICogQHJldHVybiBBIG1hcCBmcm9tIGVhY2ggdGFzayB0byB0aG9zZSB0YXNrcyBkaXJlY3RseSBkZXBlbmRlbnQgdXBvbiBpdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVUYXNrRGVwZW5kZW5jaWVzKFxuICAgIHRhc2tzOiBQYXJ0aWFsbHlPcmRlcmVkVGFza3MsIGdyYXBoOiBEZXBHcmFwaDxFbnRyeVBvaW50Pik6IFRhc2tEZXBlbmRlbmNpZXMge1xuICBjb25zdCBkZXBlbmRlbmNpZXMgPSBuZXcgVGFza0RlcGVuZGVuY2llcygpO1xuICBjb25zdCBjYW5kaWRhdGVEZXBlbmRlbmNpZXMgPSBuZXcgTWFwPHN0cmluZywgVGFzaz4oKTtcblxuICB0YXNrcy5mb3JFYWNoKHRhc2sgPT4ge1xuICAgIGNvbnN0IGVudHJ5UG9pbnRQYXRoID0gdGFzay5lbnRyeVBvaW50LnBhdGg7XG5cbiAgICAvLyBGaW5kIHRoZSBlYXJsaWVyIHRhc2tzIChgY2FuZGlkYXRlRGVwZW5kZW5jaWVzYCkgdGhhdCB0aGlzIHRhc2sgZGVwZW5kcyB1cG9uLlxuICAgIGNvbnN0IGRlcHMgPSBncmFwaC5kZXBlbmRlbmNpZXNPZihlbnRyeVBvaW50UGF0aCk7XG4gICAgY29uc3QgdGFza0RlcGVuZGVuY2llcyA9IGRlcHMuZmlsdGVyKGRlcCA9PiBjYW5kaWRhdGVEZXBlbmRlbmNpZXMuaGFzKGRlcCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRlcCA9PiBjYW5kaWRhdGVEZXBlbmRlbmNpZXMuZ2V0KGRlcCkhKTtcblxuICAgIC8vIElmIHRoaXMgdGFzayBoYXMgZGVwZW5kZW5jaWVzLCBhZGQgaXQgdG8gdGhlIGRlcGVuZGVuY2llcyBhbmQgZGVwZW5kZW50cyBtYXBzLlxuICAgIGlmICh0YXNrRGVwZW5kZW5jaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3QgZGVwZW5kZW5jeSBvZiB0YXNrRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGNvbnN0IHRhc2tEZXBlbmRlbnRzID0gZ2V0RGVwZW5kZW50c1NldChkZXBlbmRlbmNpZXMsIGRlcGVuZGVuY3kpO1xuICAgICAgICB0YXNrRGVwZW5kZW50cy5hZGQodGFzayk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRhc2sucHJvY2Vzc0R0cyAhPT0gRHRzUHJvY2Vzc2luZy5Obykge1xuICAgICAgLy8gU0FOSVRZIENIRUNLOlxuICAgICAgLy8gVGhlcmUgc2hvdWxkIG9ubHkgYmUgb25lIHRhc2sgcGVyIGVudHJ5LXBvaW50IHRoYXQgZ2VuZXJhdGVzIHR5cGluZ3MgKGFuZCB0aHVzIGNhbiBiZSBhXG4gICAgICAvLyBkZXBlbmRlbmN5IG9mIG90aGVyIHRhc2tzKSwgc28gdGhlIGZvbGxvd2luZyBzaG91bGQgdGhlb3JldGljYWxseSBuZXZlciBoYXBwZW4sIGJ1dCBjaGVja1xuICAgICAgLy8ganVzdCBpbiBjYXNlLlxuICAgICAgaWYgKGNhbmRpZGF0ZURlcGVuZGVuY2llcy5oYXMoZW50cnlQb2ludFBhdGgpKSB7XG4gICAgICAgIGNvbnN0IG90aGVyVGFzayA9IGNhbmRpZGF0ZURlcGVuZGVuY2llcy5nZXQoZW50cnlQb2ludFBhdGgpITtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ0ludmFyaWFudCB2aW9sYXRlZDogTXVsdGlwbGUgdGFza3MgYXJlIGFzc2lnbmVkIGdlbmVyYXRpbmcgdHlwaW5ncyBmb3IgJyArXG4gICAgICAgICAgICBgJyR7ZW50cnlQb2ludFBhdGh9JzpcXG4gIC0gJHtzdHJpbmdpZnlUYXNrKG90aGVyVGFzayl9XFxuICAtICR7c3RyaW5naWZ5VGFzayh0YXNrKX1gKTtcbiAgICAgIH1cbiAgICAgIC8vIFRoaXMgdGFzayBjYW4gcG90ZW50aWFsbHkgYmUgYSBkZXBlbmRlbmN5IChpLmUuIGl0IGdlbmVyYXRlcyB0eXBpbmdzKSwgc28gYWRkIGl0IHRvIHRoZVxuICAgICAgLy8gbGlzdCBvZiBjYW5kaWRhdGUgZGVwZW5kZW5jaWVzIGZvciBzdWJzZXF1ZW50IHRhc2tzLlxuICAgICAgY2FuZGlkYXRlRGVwZW5kZW5jaWVzLnNldChlbnRyeVBvaW50UGF0aCwgdGFzayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoaXMgdGFzayBpcyBub3QgZ2VuZXJhdGluZyB0eXBpbmdzIHNvIHdlIG5lZWQgdG8gYWRkIGl0IHRvIHRoZSBkZXBlbmRlbnRzIG9mIHRoZSB0YXNrIHRoYXRcbiAgICAgIC8vIGRvZXMgZ2VuZXJhdGUgdHlwaW5ncywgaWYgdGhhdCBleGlzdHNcbiAgICAgIGlmIChjYW5kaWRhdGVEZXBlbmRlbmNpZXMuaGFzKGVudHJ5UG9pbnRQYXRoKSkge1xuICAgICAgICBjb25zdCB0eXBpbmdzVGFzayA9IGNhbmRpZGF0ZURlcGVuZGVuY2llcy5nZXQoZW50cnlQb2ludFBhdGgpITtcbiAgICAgICAgY29uc3QgdHlwaW5nc1Rhc2tEZXBlbmRlbnRzID0gZ2V0RGVwZW5kZW50c1NldChkZXBlbmRlbmNpZXMsIHR5cGluZ3NUYXNrKTtcbiAgICAgICAgdHlwaW5nc1Rhc2tEZXBlbmRlbnRzLmFkZCh0YXNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkZXBlbmRlbmNpZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREZXBlbmRlbnRzU2V0KG1hcDogVGFza0RlcGVuZGVuY2llcywgdGFzazogVGFzayk6IFNldDxUYXNrPiB7XG4gIGlmICghbWFwLmhhcyh0YXNrKSkge1xuICAgIG1hcC5zZXQodGFzaywgbmV3IFNldCgpKTtcbiAgfVxuICByZXR1cm4gbWFwLmdldCh0YXNrKSE7XG59XG5cbi8qKlxuICogSW52ZXJ0IHRoZSBnaXZlbiBtYXBwaW5nIG9mIFRhc2sgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSBkZXBlbmRlbmNpZXMgVGhlIG1hcHBpbmcgb2YgdGFza3MgdG8gdGhlIHRhc2tzIHRoYXQgZGVwZW5kIHVwb24gdGhlbS5cbiAqIEByZXR1cm5zIEEgbWFwcGluZyBvZiB0YXNrcyB0byB0aGUgdGFza3MgdGhhdCB0aGV5IGRlcGVuZCB1cG9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmxvY2tlZFRhc2tzKGRlcGVuZGVuY2llczogVGFza0RlcGVuZGVuY2llcyk6IE1hcDxUYXNrLCBTZXQ8VGFzaz4+IHtcbiAgY29uc3QgYmxvY2tlZFRhc2tzID0gbmV3IE1hcDxUYXNrLCBTZXQ8VGFzaz4+KCk7XG4gIGZvciAoY29uc3QgW2RlcGVuZGVuY3ksIGRlcGVuZGVudHNdIG9mIGRlcGVuZGVuY2llcykge1xuICAgIGZvciAoY29uc3QgZGVwZW5kZW50IG9mIGRlcGVuZGVudHMpIHtcbiAgICAgIGNvbnN0IGRlcGVuZGVudFNldCA9IGdldERlcGVuZGVudHNTZXQoYmxvY2tlZFRhc2tzLCBkZXBlbmRlbnQpO1xuICAgICAgZGVwZW5kZW50U2V0LmFkZChkZXBlbmRlbmN5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJsb2NrZWRUYXNrcztcbn1cblxuLyoqXG4gKiBTb3J0IGEgbGlzdCBvZiB0YXNrcyBieSBwcmlvcml0eS5cbiAqXG4gKiBQcmlvcml0eSBpcyBkZXRlcm1pbmVkIGJ5IHRoZSBudW1iZXIgb2Ygb3RoZXIgdGFza3MgdGhhdCBhIHRhc2sgaXMgKHRyYW5zaXRpdmVseSkgYmxvY2tpbmc6XG4gKiBUaGUgbW9yZSB0YXNrcyBhIHRhc2sgaXMgYmxvY2tpbmcgdGhlIGhpZ2hlciBpdHMgcHJpb3JpdHkgaXMsIGJlY2F1c2UgcHJvY2Vzc2luZyBpdCB3aWxsXG4gKiBwb3RlbnRpYWxseSB1bmJsb2NrIG1vcmUgdGFza3MuXG4gKlxuICogVG8ga2VlcCB0aGUgYmVoYXZpb3IgcHJlZGljdGFibGUsIGlmIHR3byB0YXNrcyBibG9jayB0aGUgc2FtZSBudW1iZXIgb2Ygb3RoZXIgdGFza3MsIHRoZWlyXG4gKiByZWxhdGl2ZSBvcmRlciBpbiB0aGUgb3JpZ2luYWwgYHRhc2tzYCBsaXN0cyBpcyBwcmVzZXJ2ZWQuXG4gKlxuICogQHBhcmFtIHRhc2tzIEEgKHBhcnRpYWxseSBvcmRlcmVkKSBsaXN0IG9mIHRhc2tzLlxuICogQHBhcmFtIGRlcGVuZGVuY2llcyBUaGUgbWFwcGluZyBvZiB0YXNrcyB0byB0aGUgdGFza3MgdGhhdCBkZXBlbmQgdXBvbiB0aGVtLlxuICogQHJldHVybiBUaGUgbGlzdCBvZiB0YXNrcyBzb3J0ZWQgYnkgcHJpb3JpdHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzb3J0VGFza3NCeVByaW9yaXR5KFxuICAgIHRhc2tzOiBQYXJ0aWFsbHlPcmRlcmVkVGFza3MsIGRlcGVuZGVuY2llczogVGFza0RlcGVuZGVuY2llcyk6IFBhcnRpYWxseU9yZGVyZWRUYXNrcyB7XG4gIGNvbnN0IHByaW9yaXR5UGVyVGFzayA9IG5ldyBNYXA8VGFzaywgW251bWJlciwgbnVtYmVyXT4oKTtcbiAgY29uc3QgY29tcHV0ZVByaW9yaXR5ID0gKHRhc2s6IFRhc2ssIGlkeDogbnVtYmVyKTpcbiAgICAgIFtudW1iZXIsIG51bWJlcl0gPT4gW2RlcGVuZGVuY2llcy5oYXModGFzaykgPyBkZXBlbmRlbmNpZXMuZ2V0KHRhc2spIS5zaXplIDogMCwgaWR4XTtcblxuICB0YXNrcy5mb3JFYWNoKCh0YXNrLCBpKSA9PiBwcmlvcml0eVBlclRhc2suc2V0KHRhc2ssIGNvbXB1dGVQcmlvcml0eSh0YXNrLCBpKSkpO1xuXG4gIHJldHVybiB0YXNrcy5zbGljZSgpLnNvcnQoKHRhc2sxLCB0YXNrMikgPT4ge1xuICAgIGNvbnN0IFtwMSwgaWR4MV0gPSBwcmlvcml0eVBlclRhc2suZ2V0KHRhc2sxKSE7XG4gICAgY29uc3QgW3AyLCBpZHgyXSA9IHByaW9yaXR5UGVyVGFzay5nZXQodGFzazIpITtcblxuICAgIHJldHVybiAocDIgLSBwMSkgfHwgKGlkeDEgLSBpZHgyKTtcbiAgfSk7XG59XG4iXX0=