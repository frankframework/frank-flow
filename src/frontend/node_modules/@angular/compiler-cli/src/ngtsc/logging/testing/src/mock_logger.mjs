/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { LogLevel } from '../..';
export class MockLogger {
    constructor(level = LogLevel.info) {
        this.level = level;
        this.logs = {
            debug: [],
            info: [],
            warn: [],
            error: [],
        };
    }
    debug(...args) {
        this.logs.debug.push(args);
    }
    info(...args) {
        this.logs.info.push(args);
    }
    warn(...args) {
        this.logs.warn.push(args);
    }
    error(...args) {
        this.logs.error.push(args);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja19sb2dnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2xvZ2dpbmcvdGVzdGluZy9zcmMvbW9ja19sb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFTLFFBQVEsRUFBQyxNQUFNLE9BQU8sQ0FBQztBQUV2QyxNQUFNLE9BQU8sVUFBVTtJQUNyQixZQUFtQixRQUFRLFFBQVEsQ0FBQyxJQUFJO1FBQXJCLFVBQUssR0FBTCxLQUFLLENBQWdCO1FBRXhDLFNBQUksR0FBd0Q7WUFDMUQsS0FBSyxFQUFFLEVBQUU7WUFDVCxJQUFJLEVBQUUsRUFBRTtZQUNSLElBQUksRUFBRSxFQUFFO1lBQ1IsS0FBSyxFQUFFLEVBQUU7U0FDVixDQUFDO0lBUHlDLENBQUM7SUFRNUMsS0FBSyxDQUFDLEdBQUcsSUFBYztRQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUNELElBQUksQ0FBQyxHQUFHLElBQWM7UUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFDRCxJQUFJLENBQUMsR0FBRyxJQUFjO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBQ0QsS0FBSyxDQUFDLEdBQUcsSUFBYztRQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7TG9nZ2VyLCBMb2dMZXZlbH0gZnJvbSAnLi4vLi4nO1xuXG5leHBvcnQgY2xhc3MgTW9ja0xvZ2dlciBpbXBsZW1lbnRzIExvZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBsZXZlbCA9IExvZ0xldmVsLmluZm8pIHt9XG5cbiAgbG9nczoge1tQIGluIEV4Y2x1ZGU8a2V5b2YgTG9nZ2VyLCAnbGV2ZWwnPl06IHN0cmluZ1tdW119ID0ge1xuICAgIGRlYnVnOiBbXSxcbiAgICBpbmZvOiBbXSxcbiAgICB3YXJuOiBbXSxcbiAgICBlcnJvcjogW10sXG4gIH07XG4gIGRlYnVnKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgdGhpcy5sb2dzLmRlYnVnLnB1c2goYXJncyk7XG4gIH1cbiAgaW5mbyguLi5hcmdzOiBzdHJpbmdbXSkge1xuICAgIHRoaXMubG9ncy5pbmZvLnB1c2goYXJncyk7XG4gIH1cbiAgd2FybiguLi5hcmdzOiBzdHJpbmdbXSkge1xuICAgIHRoaXMubG9ncy53YXJuLnB1c2goYXJncyk7XG4gIH1cbiAgZXJyb3IoLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICB0aGlzLmxvZ3MuZXJyb3IucHVzaChhcmdzKTtcbiAgfVxufVxuIl19