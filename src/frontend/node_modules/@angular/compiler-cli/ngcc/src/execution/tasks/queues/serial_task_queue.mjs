/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { stringifyTask } from '../utils';
import { BaseTaskQueue } from './base_task_queue';
/**
 * A `TaskQueue` implementation that assumes tasks are processed serially and each one is completed
 * before requesting the next one.
 */
export class SerialTaskQueue extends BaseTaskQueue {
    computeNextTask() {
        const nextTask = this.tasks.shift() || null;
        if (nextTask) {
            if (this.inProgressTasks.size > 0) {
                // `SerialTaskQueue` can have max one in-progress task.
                const inProgressTask = this.inProgressTasks.values().next().value;
                throw new Error('Trying to get next task, while there is already a task in progress: ' +
                    stringifyTask(inProgressTask));
            }
            this.inProgressTasks.add(nextTask);
        }
        return nextTask;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsX3Rhc2tfcXVldWUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvZXhlY3V0aW9uL3Rhc2tzL3F1ZXVlcy9zZXJpYWxfdGFza19xdWV1ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRXZDLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUdoRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sZUFBZ0IsU0FBUSxhQUFhO0lBQ2hELGVBQWU7UUFDYixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLElBQUksQ0FBQztRQUU1QyxJQUFJLFFBQVEsRUFBRTtZQUNaLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO2dCQUNqQyx1REFBdUQ7Z0JBQ3ZELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDO2dCQUNsRSxNQUFNLElBQUksS0FBSyxDQUNYLHNFQUFzRTtvQkFDdEUsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7YUFDcEM7WUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNwQztRQUVELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1Rhc2t9IGZyb20gJy4uL2FwaSc7XG5pbXBvcnQge3N0cmluZ2lmeVRhc2t9IGZyb20gJy4uL3V0aWxzJztcblxuaW1wb3J0IHtCYXNlVGFza1F1ZXVlfSBmcm9tICcuL2Jhc2VfdGFza19xdWV1ZSc7XG5cblxuLyoqXG4gKiBBIGBUYXNrUXVldWVgIGltcGxlbWVudGF0aW9uIHRoYXQgYXNzdW1lcyB0YXNrcyBhcmUgcHJvY2Vzc2VkIHNlcmlhbGx5IGFuZCBlYWNoIG9uZSBpcyBjb21wbGV0ZWRcbiAqIGJlZm9yZSByZXF1ZXN0aW5nIHRoZSBuZXh0IG9uZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFNlcmlhbFRhc2tRdWV1ZSBleHRlbmRzIEJhc2VUYXNrUXVldWUge1xuICBjb21wdXRlTmV4dFRhc2soKTogVGFza3xudWxsIHtcbiAgICBjb25zdCBuZXh0VGFzayA9IHRoaXMudGFza3Muc2hpZnQoKSB8fCBudWxsO1xuXG4gICAgaWYgKG5leHRUYXNrKSB7XG4gICAgICBpZiAodGhpcy5pblByb2dyZXNzVGFza3Muc2l6ZSA+IDApIHtcbiAgICAgICAgLy8gYFNlcmlhbFRhc2tRdWV1ZWAgY2FuIGhhdmUgbWF4IG9uZSBpbi1wcm9ncmVzcyB0YXNrLlxuICAgICAgICBjb25zdCBpblByb2dyZXNzVGFzayA9IHRoaXMuaW5Qcm9ncmVzc1Rhc2tzLnZhbHVlcygpLm5leHQoKS52YWx1ZTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ1RyeWluZyB0byBnZXQgbmV4dCB0YXNrLCB3aGlsZSB0aGVyZSBpcyBhbHJlYWR5IGEgdGFzayBpbiBwcm9ncmVzczogJyArXG4gICAgICAgICAgICBzdHJpbmdpZnlUYXNrKGluUHJvZ3Jlc3NUYXNrKSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5Qcm9ncmVzc1Rhc2tzLmFkZChuZXh0VGFzayk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5leHRUYXNrO1xuICB9XG59XG4iXX0=