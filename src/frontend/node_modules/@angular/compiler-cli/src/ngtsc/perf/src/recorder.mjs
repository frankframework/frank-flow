/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
import { PerfCheckpoint, PerfEvent, PerfPhase } from './api';
import { mark, timeSinceInMicros } from './clock';
/**
 * A `PerfRecorder` that actively tracks performance statistics.
 */
export class ActivePerfRecorder {
    constructor(zeroTime) {
        this.zeroTime = zeroTime;
        this.currentPhase = PerfPhase.Unaccounted;
        this.currentPhaseEntered = this.zeroTime;
        this.counters = Array(PerfEvent.LAST).fill(0);
        this.phaseTime = Array(PerfPhase.LAST).fill(0);
        this.bytes = Array(PerfCheckpoint.LAST).fill(0);
        // Take an initial memory snapshot before any other compilation work begins.
        this.memory(PerfCheckpoint.Initial);
    }
    /**
     * Creates an `ActivePerfRecoder` with its zero point set to the current time.
     */
    static zeroedToNow() {
        return new ActivePerfRecorder(mark());
    }
    reset() {
        this.counters = Array(PerfEvent.LAST).fill(0);
        this.phaseTime = Array(PerfPhase.LAST).fill(0);
        this.bytes = Array(PerfCheckpoint.LAST).fill(0);
        this.zeroTime = mark();
        this.currentPhase = PerfPhase.Unaccounted;
        this.currentPhaseEntered = this.zeroTime;
    }
    memory(after) {
        this.bytes[after] = process.memoryUsage().heapUsed;
    }
    phase(phase) {
        const previous = this.currentPhase;
        this.phaseTime[this.currentPhase] += timeSinceInMicros(this.currentPhaseEntered);
        this.currentPhase = phase;
        this.currentPhaseEntered = mark();
        return previous;
    }
    inPhase(phase, fn) {
        const previousPhase = this.phase(phase);
        try {
            return fn();
        }
        finally {
            this.phase(previousPhase);
        }
    }
    eventCount(counter, incrementBy = 1) {
        this.counters[counter] += incrementBy;
    }
    /**
     * Return the current performance metrics as a serializable object.
     */
    finalize() {
        // Track the last segment of time spent in `this.currentPhase` in the time array.
        this.phase(PerfPhase.Unaccounted);
        const results = {
            events: {},
            phases: {},
            memory: {},
        };
        for (let i = 0; i < this.phaseTime.length; i++) {
            if (this.phaseTime[i] > 0) {
                results.phases[PerfPhase[i]] = this.phaseTime[i];
            }
        }
        for (let i = 0; i < this.phaseTime.length; i++) {
            if (this.counters[i] > 0) {
                results.events[PerfEvent[i]] = this.counters[i];
            }
        }
        for (let i = 0; i < this.bytes.length; i++) {
            if (this.bytes[i] > 0) {
                results.memory[PerfCheckpoint[i]] = this.bytes[i];
            }
        }
        return results;
    }
}
/**
 * A `PerfRecorder` that delegates to a target `PerfRecorder` which can be updated later.
 *
 * `DelegatingPerfRecorder` is useful when a compiler class that needs a `PerfRecorder` can outlive
 * the current compilation. This is true for most compiler classes as resource-only changes reuse
 * the same `NgCompiler` for a new compilation.
 */
export class DelegatingPerfRecorder {
    constructor(target) {
        this.target = target;
    }
    eventCount(counter, incrementBy) {
        this.target.eventCount(counter, incrementBy);
    }
    phase(phase) {
        return this.target.phase(phase);
    }
    inPhase(phase, fn) {
        // Note: this doesn't delegate to `this.target.inPhase` but instead is implemented manually here
        // to avoid adding an additional frame of noise to the stack when debugging.
        const previousPhase = this.target.phase(phase);
        try {
            return fn();
        }
        finally {
            this.target.phase(previousPhase);
        }
    }
    memory(after) {
        this.target.memory(after);
    }
    reset() {
        this.target.reset();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb3JkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3BlcmYvc3JjL3JlY29yZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILDhCQUE4QjtBQUU5QixPQUFPLEVBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQWUsTUFBTSxPQUFPLENBQUM7QUFDekUsT0FBTyxFQUFTLElBQUksRUFBRSxpQkFBaUIsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVd4RDs7R0FFRztBQUNILE1BQU0sT0FBTyxrQkFBa0I7SUFlN0IsWUFBNEIsUUFBZ0I7UUFBaEIsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQVZwQyxpQkFBWSxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDckMsd0JBQW1CLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQVUxQyxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVoRCw0RUFBNEU7UUFDNUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQWREOztPQUVHO0lBQ0gsTUFBTSxDQUFDLFdBQVc7UUFDaEIsT0FBTyxJQUFJLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQVdELEtBQUs7UUFDSCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQztRQUMxQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUMzQyxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQXFCO1FBQzFCLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQztJQUNyRCxDQUFDO0lBRUQsS0FBSyxDQUFDLEtBQWdCO1FBQ3BCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDakYsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7UUFDMUIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2xDLE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFFRCxPQUFPLENBQUksS0FBZ0IsRUFBRSxFQUFXO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEMsSUFBSTtZQUNGLE9BQU8sRUFBRSxFQUFFLENBQUM7U0FDYjtnQkFBUztZQUNSLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDM0I7SUFDSCxDQUFDO0lBRUQsVUFBVSxDQUFDLE9BQWtCLEVBQUUsY0FBc0IsQ0FBQztRQUNwRCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFdBQVcsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04saUZBQWlGO1FBQ2pGLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRWxDLE1BQU0sT0FBTyxHQUFnQjtZQUMzQixNQUFNLEVBQUUsRUFBRTtZQUNWLE1BQU0sRUFBRSxFQUFFO1lBQ1YsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDO1FBRUYsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzlDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3pCLE9BQU8sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsRDtTQUNGO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzlDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNqRDtTQUNGO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3JCLE9BQU8sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNuRDtTQUNGO1FBRUQsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztDQUNGO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLHNCQUFzQjtJQUNqQyxZQUFtQixNQUFvQjtRQUFwQixXQUFNLEdBQU4sTUFBTSxDQUFjO0lBQUcsQ0FBQztJQUUzQyxVQUFVLENBQUMsT0FBa0IsRUFBRSxXQUFvQjtRQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFnQjtRQUNwQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxPQUFPLENBQUksS0FBZ0IsRUFBRSxFQUFXO1FBQ3RDLGdHQUFnRztRQUNoRyw0RUFBNEU7UUFDNUUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0MsSUFBSTtZQUNGLE9BQU8sRUFBRSxFQUFFLENBQUM7U0FDYjtnQkFBUztZQUNSLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQ2xDO0lBQ0gsQ0FBQztJQUVELE1BQU0sQ0FBQyxLQUFxQjtRQUMxQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDdEIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIiAvPlxuXG5pbXBvcnQge1BlcmZDaGVja3BvaW50LCBQZXJmRXZlbnQsIFBlcmZQaGFzZSwgUGVyZlJlY29yZGVyfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0hyVGltZSwgbWFyaywgdGltZVNpbmNlSW5NaWNyb3N9IGZyb20gJy4vY2xvY2snO1xuXG4vKipcbiAqIFNlcmlhbGl6YWJsZSBwZXJmb3JtYW5jZSBkYXRhIGZvciB0aGUgY29tcGlsYXRpb24sIHVzaW5nIHN0cmluZyBuYW1lcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQZXJmUmVzdWx0cyB7XG4gIGV2ZW50czogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgcGhhc2VzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+O1xuICBtZW1vcnk6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG59XG5cbi8qKlxuICogQSBgUGVyZlJlY29yZGVyYCB0aGF0IGFjdGl2ZWx5IHRyYWNrcyBwZXJmb3JtYW5jZSBzdGF0aXN0aWNzLlxuICovXG5leHBvcnQgY2xhc3MgQWN0aXZlUGVyZlJlY29yZGVyIGltcGxlbWVudHMgUGVyZlJlY29yZGVyIHtcbiAgcHJpdmF0ZSBjb3VudGVyczogbnVtYmVyW107XG4gIHByaXZhdGUgcGhhc2VUaW1lOiBudW1iZXJbXTtcbiAgcHJpdmF0ZSBieXRlczogbnVtYmVyW107XG5cbiAgcHJpdmF0ZSBjdXJyZW50UGhhc2UgPSBQZXJmUGhhc2UuVW5hY2NvdW50ZWQ7XG4gIHByaXZhdGUgY3VycmVudFBoYXNlRW50ZXJlZCA9IHRoaXMuemVyb1RpbWU7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYEFjdGl2ZVBlcmZSZWNvZGVyYCB3aXRoIGl0cyB6ZXJvIHBvaW50IHNldCB0byB0aGUgY3VycmVudCB0aW1lLlxuICAgKi9cbiAgc3RhdGljIHplcm9lZFRvTm93KCk6IEFjdGl2ZVBlcmZSZWNvcmRlciB7XG4gICAgcmV0dXJuIG5ldyBBY3RpdmVQZXJmUmVjb3JkZXIobWFyaygpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocHJpdmF0ZSB6ZXJvVGltZTogSHJUaW1lKSB7XG4gICAgdGhpcy5jb3VudGVycyA9IEFycmF5KFBlcmZFdmVudC5MQVNUKS5maWxsKDApO1xuICAgIHRoaXMucGhhc2VUaW1lID0gQXJyYXkoUGVyZlBoYXNlLkxBU1QpLmZpbGwoMCk7XG4gICAgdGhpcy5ieXRlcyA9IEFycmF5KFBlcmZDaGVja3BvaW50LkxBU1QpLmZpbGwoMCk7XG5cbiAgICAvLyBUYWtlIGFuIGluaXRpYWwgbWVtb3J5IHNuYXBzaG90IGJlZm9yZSBhbnkgb3RoZXIgY29tcGlsYXRpb24gd29yayBiZWdpbnMuXG4gICAgdGhpcy5tZW1vcnkoUGVyZkNoZWNrcG9pbnQuSW5pdGlhbCk7XG4gIH1cblxuICByZXNldCgpOiB2b2lkIHtcbiAgICB0aGlzLmNvdW50ZXJzID0gQXJyYXkoUGVyZkV2ZW50LkxBU1QpLmZpbGwoMCk7XG4gICAgdGhpcy5waGFzZVRpbWUgPSBBcnJheShQZXJmUGhhc2UuTEFTVCkuZmlsbCgwKTtcbiAgICB0aGlzLmJ5dGVzID0gQXJyYXkoUGVyZkNoZWNrcG9pbnQuTEFTVCkuZmlsbCgwKTtcbiAgICB0aGlzLnplcm9UaW1lID0gbWFyaygpO1xuICAgIHRoaXMuY3VycmVudFBoYXNlID0gUGVyZlBoYXNlLlVuYWNjb3VudGVkO1xuICAgIHRoaXMuY3VycmVudFBoYXNlRW50ZXJlZCA9IHRoaXMuemVyb1RpbWU7XG4gIH1cblxuICBtZW1vcnkoYWZ0ZXI6IFBlcmZDaGVja3BvaW50KTogdm9pZCB7XG4gICAgdGhpcy5ieXRlc1thZnRlcl0gPSBwcm9jZXNzLm1lbW9yeVVzYWdlKCkuaGVhcFVzZWQ7XG4gIH1cblxuICBwaGFzZShwaGFzZTogUGVyZlBoYXNlKTogUGVyZlBoYXNlIHtcbiAgICBjb25zdCBwcmV2aW91cyA9IHRoaXMuY3VycmVudFBoYXNlO1xuICAgIHRoaXMucGhhc2VUaW1lW3RoaXMuY3VycmVudFBoYXNlXSArPSB0aW1lU2luY2VJbk1pY3Jvcyh0aGlzLmN1cnJlbnRQaGFzZUVudGVyZWQpO1xuICAgIHRoaXMuY3VycmVudFBoYXNlID0gcGhhc2U7XG4gICAgdGhpcy5jdXJyZW50UGhhc2VFbnRlcmVkID0gbWFyaygpO1xuICAgIHJldHVybiBwcmV2aW91cztcbiAgfVxuXG4gIGluUGhhc2U8VD4ocGhhc2U6IFBlcmZQaGFzZSwgZm46ICgpID0+IFQpOiBUIHtcbiAgICBjb25zdCBwcmV2aW91c1BoYXNlID0gdGhpcy5waGFzZShwaGFzZSk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnBoYXNlKHByZXZpb3VzUGhhc2UpO1xuICAgIH1cbiAgfVxuXG4gIGV2ZW50Q291bnQoY291bnRlcjogUGVyZkV2ZW50LCBpbmNyZW1lbnRCeTogbnVtYmVyID0gMSk6IHZvaWQge1xuICAgIHRoaXMuY291bnRlcnNbY291bnRlcl0gKz0gaW5jcmVtZW50Qnk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBjdXJyZW50IHBlcmZvcm1hbmNlIG1ldHJpY3MgYXMgYSBzZXJpYWxpemFibGUgb2JqZWN0LlxuICAgKi9cbiAgZmluYWxpemUoKTogUGVyZlJlc3VsdHMge1xuICAgIC8vIFRyYWNrIHRoZSBsYXN0IHNlZ21lbnQgb2YgdGltZSBzcGVudCBpbiBgdGhpcy5jdXJyZW50UGhhc2VgIGluIHRoZSB0aW1lIGFycmF5LlxuICAgIHRoaXMucGhhc2UoUGVyZlBoYXNlLlVuYWNjb3VudGVkKTtcblxuICAgIGNvbnN0IHJlc3VsdHM6IFBlcmZSZXN1bHRzID0ge1xuICAgICAgZXZlbnRzOiB7fSxcbiAgICAgIHBoYXNlczoge30sXG4gICAgICBtZW1vcnk6IHt9LFxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGhhc2VUaW1lLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5waGFzZVRpbWVbaV0gPiAwKSB7XG4gICAgICAgIHJlc3VsdHMucGhhc2VzW1BlcmZQaGFzZVtpXV0gPSB0aGlzLnBoYXNlVGltZVtpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGhhc2VUaW1lLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5jb3VudGVyc1tpXSA+IDApIHtcbiAgICAgICAgcmVzdWx0cy5ldmVudHNbUGVyZkV2ZW50W2ldXSA9IHRoaXMuY291bnRlcnNbaV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJ5dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5ieXRlc1tpXSA+IDApIHtcbiAgICAgICAgcmVzdWx0cy5tZW1vcnlbUGVyZkNoZWNrcG9pbnRbaV1dID0gdGhpcy5ieXRlc1tpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxufVxuXG4vKipcbiAqIEEgYFBlcmZSZWNvcmRlcmAgdGhhdCBkZWxlZ2F0ZXMgdG8gYSB0YXJnZXQgYFBlcmZSZWNvcmRlcmAgd2hpY2ggY2FuIGJlIHVwZGF0ZWQgbGF0ZXIuXG4gKlxuICogYERlbGVnYXRpbmdQZXJmUmVjb3JkZXJgIGlzIHVzZWZ1bCB3aGVuIGEgY29tcGlsZXIgY2xhc3MgdGhhdCBuZWVkcyBhIGBQZXJmUmVjb3JkZXJgIGNhbiBvdXRsaXZlXG4gKiB0aGUgY3VycmVudCBjb21waWxhdGlvbi4gVGhpcyBpcyB0cnVlIGZvciBtb3N0IGNvbXBpbGVyIGNsYXNzZXMgYXMgcmVzb3VyY2Utb25seSBjaGFuZ2VzIHJldXNlXG4gKiB0aGUgc2FtZSBgTmdDb21waWxlcmAgZm9yIGEgbmV3IGNvbXBpbGF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgRGVsZWdhdGluZ1BlcmZSZWNvcmRlciBpbXBsZW1lbnRzIFBlcmZSZWNvcmRlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0YXJnZXQ6IFBlcmZSZWNvcmRlcikge31cblxuICBldmVudENvdW50KGNvdW50ZXI6IFBlcmZFdmVudCwgaW5jcmVtZW50Qnk/OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnRhcmdldC5ldmVudENvdW50KGNvdW50ZXIsIGluY3JlbWVudEJ5KTtcbiAgfVxuXG4gIHBoYXNlKHBoYXNlOiBQZXJmUGhhc2UpOiBQZXJmUGhhc2Uge1xuICAgIHJldHVybiB0aGlzLnRhcmdldC5waGFzZShwaGFzZSk7XG4gIH1cblxuICBpblBoYXNlPFQ+KHBoYXNlOiBQZXJmUGhhc2UsIGZuOiAoKSA9PiBUKTogVCB7XG4gICAgLy8gTm90ZTogdGhpcyBkb2Vzbid0IGRlbGVnYXRlIHRvIGB0aGlzLnRhcmdldC5pblBoYXNlYCBidXQgaW5zdGVhZCBpcyBpbXBsZW1lbnRlZCBtYW51YWxseSBoZXJlXG4gICAgLy8gdG8gYXZvaWQgYWRkaW5nIGFuIGFkZGl0aW9uYWwgZnJhbWUgb2Ygbm9pc2UgdG8gdGhlIHN0YWNrIHdoZW4gZGVidWdnaW5nLlxuICAgIGNvbnN0IHByZXZpb3VzUGhhc2UgPSB0aGlzLnRhcmdldC5waGFzZShwaGFzZSk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnRhcmdldC5waGFzZShwcmV2aW91c1BoYXNlKTtcbiAgICB9XG4gIH1cblxuICBtZW1vcnkoYWZ0ZXI6IFBlcmZDaGVja3BvaW50KTogdm9pZCB7XG4gICAgdGhpcy50YXJnZXQubWVtb3J5KGFmdGVyKTtcbiAgfVxuXG4gIHJlc2V0KCk6IHZvaWQge1xuICAgIHRoaXMudGFyZ2V0LnJlc2V0KCk7XG4gIH1cbn1cbiJdfQ==