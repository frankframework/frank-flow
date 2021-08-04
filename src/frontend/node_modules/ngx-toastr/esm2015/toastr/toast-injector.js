import { Subject } from 'rxjs';
import { ToastPackage } from './toastr-config';
/**
 * Reference to a toast opened via the Toastr service.
 */
export class ToastRef {
    constructor(_overlayRef) {
        this._overlayRef = _overlayRef;
        /** Count of duplicates of this toast */
        this.duplicatesCount = 0;
        /** Subject for notifying the user that the toast has finished closing. */
        this._afterClosed = new Subject();
        /** triggered when toast is activated */
        this._activate = new Subject();
        /** notifies the toast that it should close before the timeout */
        this._manualClose = new Subject();
        /** notifies the toast that it should reset the timeouts */
        this._resetTimeout = new Subject();
        /** notifies the toast that it should count a duplicate toast */
        this._countDuplicate = new Subject();
    }
    manualClose() {
        this._manualClose.next();
        this._manualClose.complete();
    }
    manualClosed() {
        return this._manualClose.asObservable();
    }
    timeoutReset() {
        return this._resetTimeout.asObservable();
    }
    countDuplicate() {
        return this._countDuplicate.asObservable();
    }
    /**
     * Close the toast.
     */
    close() {
        this._overlayRef.detach();
        this._afterClosed.next();
        this._manualClose.next();
        this._afterClosed.complete();
        this._manualClose.complete();
        this._activate.complete();
        this._resetTimeout.complete();
        this._countDuplicate.complete();
    }
    /** Gets an observable that is notified when the toast is finished closing. */
    afterClosed() {
        return this._afterClosed.asObservable();
    }
    isInactive() {
        return this._activate.isStopped;
    }
    activate() {
        this._activate.next();
        this._activate.complete();
    }
    /** Gets an observable that is notified when the toast has started opening. */
    afterActivate() {
        return this._activate.asObservable();
    }
    /** Reset the toast timouts and count duplicates */
    onDuplicate(resetTimeout, countDuplicate) {
        if (resetTimeout) {
            this._resetTimeout.next();
        }
        if (countDuplicate) {
            this._countDuplicate.next(++this.duplicatesCount);
        }
    }
}
/** Custom injector type specifically for instantiating components with a toast. */
export class ToastInjector {
    constructor(_toastPackage, _parentInjector) {
        this._toastPackage = _toastPackage;
        this._parentInjector = _parentInjector;
    }
    get(token, notFoundValue, flags) {
        if (token === ToastPackage) {
            return this._toastPackage;
        }
        return this._parentInjector.get(token, notFoundValue, flags);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9hc3QtaW5qZWN0b3IuanMiLCJzb3VyY2VSb290IjoiLi4vLi4vc3JjL2xpYi8iLCJzb3VyY2VzIjpbInRvYXN0ci90b2FzdC1pbmplY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQWMsT0FBTyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBRTNDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUUvQzs7R0FFRztBQUNILE1BQU0sT0FBTyxRQUFRO0lBa0JuQixZQUFvQixXQUF1QjtRQUF2QixnQkFBVyxHQUFYLFdBQVcsQ0FBWTtRQWQzQyx3Q0FBd0M7UUFDaEMsb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFFNUIsMEVBQTBFO1FBQ2xFLGlCQUFZLEdBQUcsSUFBSSxPQUFPLEVBQVEsQ0FBQztRQUMzQyx3Q0FBd0M7UUFDaEMsY0FBUyxHQUFHLElBQUksT0FBTyxFQUFRLENBQUM7UUFDeEMsaUVBQWlFO1FBQ3pELGlCQUFZLEdBQUcsSUFBSSxPQUFPLEVBQVEsQ0FBQztRQUMzQywyREFBMkQ7UUFDbkQsa0JBQWEsR0FBRyxJQUFJLE9BQU8sRUFBUSxDQUFDO1FBQzVDLGdFQUFnRTtRQUN4RCxvQkFBZSxHQUFHLElBQUksT0FBTyxFQUFVLENBQUM7SUFFRixDQUFDO0lBRS9DLFdBQVc7UUFDVCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVELFlBQVk7UUFDVixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUVELFlBQVk7UUFDVixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDM0MsQ0FBQztJQUVELGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSztRQUNILElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzFCLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDOUIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRUQsOEVBQThFO0lBQzlFLFdBQVc7UUFDVCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUVELFVBQVU7UUFDUixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxRQUFRO1FBQ04sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFRCw4RUFBOEU7SUFDOUUsYUFBYTtRQUNYLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN2QyxDQUFDO0lBRUQsbURBQW1EO0lBQ25ELFdBQVcsQ0FBQyxZQUFxQixFQUFFLGNBQXVCO1FBQ3hELElBQUksWUFBWSxFQUFFO1lBQ2hCLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDM0I7UUFDRCxJQUFJLGNBQWMsRUFBRTtZQUNsQixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztTQUNuRDtJQUNILENBQUM7Q0FDRjtBQUVELG1GQUFtRjtBQUNuRixNQUFNLE9BQU8sYUFBYTtJQUN4QixZQUNVLGFBQTJCLEVBQzNCLGVBQXlCO1FBRHpCLGtCQUFhLEdBQWIsYUFBYSxDQUFjO1FBQzNCLG9CQUFlLEdBQWYsZUFBZSxDQUFVO0lBQ2hDLENBQUM7SUFFSixHQUFHLENBQUksS0FBVSxFQUFFLGFBQWlCLEVBQUUsS0FBbUI7UUFDdkQsSUFBSSxLQUFLLEtBQUssWUFBWSxFQUFFO1lBQzFCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQztTQUMzQjtRQUNELE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUksS0FBSyxFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsRSxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RvciwgSW5qZWN0RmxhZ3MgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IE9ic2VydmFibGUsIFN1YmplY3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE92ZXJsYXlSZWYgfSBmcm9tICcuLi9vdmVybGF5L292ZXJsYXktcmVmJztcbmltcG9ydCB7IFRvYXN0UGFja2FnZSB9IGZyb20gJy4vdG9hc3RyLWNvbmZpZyc7XG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgdG9hc3Qgb3BlbmVkIHZpYSB0aGUgVG9hc3RyIHNlcnZpY2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBUb2FzdFJlZjxUPiB7XG4gIC8qKiBUaGUgaW5zdGFuY2Ugb2YgY29tcG9uZW50IG9wZW5lZCBpbnRvIHRoZSB0b2FzdC4gKi9cbiAgY29tcG9uZW50SW5zdGFuY2UhOiBUO1xuXG4gIC8qKiBDb3VudCBvZiBkdXBsaWNhdGVzIG9mIHRoaXMgdG9hc3QgKi9cbiAgcHJpdmF0ZSBkdXBsaWNhdGVzQ291bnQgPSAwO1xuXG4gIC8qKiBTdWJqZWN0IGZvciBub3RpZnlpbmcgdGhlIHVzZXIgdGhhdCB0aGUgdG9hc3QgaGFzIGZpbmlzaGVkIGNsb3NpbmcuICovXG4gIHByaXZhdGUgX2FmdGVyQ2xvc2VkID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcbiAgLyoqIHRyaWdnZXJlZCB3aGVuIHRvYXN0IGlzIGFjdGl2YXRlZCAqL1xuICBwcml2YXRlIF9hY3RpdmF0ZSA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XG4gIC8qKiBub3RpZmllcyB0aGUgdG9hc3QgdGhhdCBpdCBzaG91bGQgY2xvc2UgYmVmb3JlIHRoZSB0aW1lb3V0ICovXG4gIHByaXZhdGUgX21hbnVhbENsb3NlID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcbiAgLyoqIG5vdGlmaWVzIHRoZSB0b2FzdCB0aGF0IGl0IHNob3VsZCByZXNldCB0aGUgdGltZW91dHMgKi9cbiAgcHJpdmF0ZSBfcmVzZXRUaW1lb3V0ID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcbiAgLyoqIG5vdGlmaWVzIHRoZSB0b2FzdCB0aGF0IGl0IHNob3VsZCBjb3VudCBhIGR1cGxpY2F0ZSB0b2FzdCAqL1xuICBwcml2YXRlIF9jb3VudER1cGxpY2F0ZSA9IG5ldyBTdWJqZWN0PG51bWJlcj4oKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9vdmVybGF5UmVmOiBPdmVybGF5UmVmKSB7fVxuXG4gIG1hbnVhbENsb3NlKCkge1xuICAgIHRoaXMuX21hbnVhbENsb3NlLm5leHQoKTtcbiAgICB0aGlzLl9tYW51YWxDbG9zZS5jb21wbGV0ZSgpO1xuICB9XG5cbiAgbWFudWFsQ2xvc2VkKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuX21hbnVhbENsb3NlLmFzT2JzZXJ2YWJsZSgpO1xuICB9XG5cbiAgdGltZW91dFJlc2V0KCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuX3Jlc2V0VGltZW91dC5hc09ic2VydmFibGUoKTtcbiAgfVxuXG4gIGNvdW50RHVwbGljYXRlKCk6IE9ic2VydmFibGU8bnVtYmVyPiB7XG4gICAgcmV0dXJuIHRoaXMuX2NvdW50RHVwbGljYXRlLmFzT2JzZXJ2YWJsZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3NlIHRoZSB0b2FzdC5cbiAgICovXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuX292ZXJsYXlSZWYuZGV0YWNoKCk7XG4gICAgdGhpcy5fYWZ0ZXJDbG9zZWQubmV4dCgpO1xuICAgIHRoaXMuX21hbnVhbENsb3NlLm5leHQoKTtcbiAgICB0aGlzLl9hZnRlckNsb3NlZC5jb21wbGV0ZSgpO1xuICAgIHRoaXMuX21hbnVhbENsb3NlLmNvbXBsZXRlKCk7XG4gICAgdGhpcy5fYWN0aXZhdGUuY29tcGxldGUoKTtcbiAgICB0aGlzLl9yZXNldFRpbWVvdXQuY29tcGxldGUoKTtcbiAgICB0aGlzLl9jb3VudER1cGxpY2F0ZS5jb21wbGV0ZSgpO1xuICB9XG5cbiAgLyoqIEdldHMgYW4gb2JzZXJ2YWJsZSB0aGF0IGlzIG5vdGlmaWVkIHdoZW4gdGhlIHRvYXN0IGlzIGZpbmlzaGVkIGNsb3NpbmcuICovXG4gIGFmdGVyQ2xvc2VkKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuX2FmdGVyQ2xvc2VkLmFzT2JzZXJ2YWJsZSgpO1xuICB9XG5cbiAgaXNJbmFjdGl2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fYWN0aXZhdGUuaXNTdG9wcGVkO1xuICB9XG5cbiAgYWN0aXZhdGUoKSB7XG4gICAgdGhpcy5fYWN0aXZhdGUubmV4dCgpO1xuICAgIHRoaXMuX2FjdGl2YXRlLmNvbXBsZXRlKCk7XG4gIH1cblxuICAvKiogR2V0cyBhbiBvYnNlcnZhYmxlIHRoYXQgaXMgbm90aWZpZWQgd2hlbiB0aGUgdG9hc3QgaGFzIHN0YXJ0ZWQgb3BlbmluZy4gKi9cbiAgYWZ0ZXJBY3RpdmF0ZSgpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLl9hY3RpdmF0ZS5hc09ic2VydmFibGUoKTtcbiAgfVxuXG4gIC8qKiBSZXNldCB0aGUgdG9hc3QgdGltb3V0cyBhbmQgY291bnQgZHVwbGljYXRlcyAqL1xuICBvbkR1cGxpY2F0ZShyZXNldFRpbWVvdXQ6IGJvb2xlYW4sIGNvdW50RHVwbGljYXRlOiBib29sZWFuKSB7XG4gICAgaWYgKHJlc2V0VGltZW91dCkge1xuICAgICAgdGhpcy5fcmVzZXRUaW1lb3V0Lm5leHQoKTtcbiAgICB9XG4gICAgaWYgKGNvdW50RHVwbGljYXRlKSB7XG4gICAgICB0aGlzLl9jb3VudER1cGxpY2F0ZS5uZXh0KCsrdGhpcy5kdXBsaWNhdGVzQ291bnQpO1xuICAgIH1cbiAgfVxufVxuXG4vKiogQ3VzdG9tIGluamVjdG9yIHR5cGUgc3BlY2lmaWNhbGx5IGZvciBpbnN0YW50aWF0aW5nIGNvbXBvbmVudHMgd2l0aCBhIHRvYXN0LiAqL1xuZXhwb3J0IGNsYXNzIFRvYXN0SW5qZWN0b3IgaW1wbGVtZW50cyBJbmplY3RvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgX3RvYXN0UGFja2FnZTogVG9hc3RQYWNrYWdlLFxuICAgIHByaXZhdGUgX3BhcmVudEluamVjdG9yOiBJbmplY3RvclxuICApIHt9XG5cbiAgZ2V0PFQ+KHRva2VuOiBhbnksIG5vdEZvdW5kVmFsdWU/OiBULCBmbGFncz86IEluamVjdEZsYWdzKTogVCB8IFRvYXN0UGFja2FnZSB7XG4gICAgaWYgKHRva2VuID09PSBUb2FzdFBhY2thZ2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl90b2FzdFBhY2thZ2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9wYXJlbnRJbmplY3Rvci5nZXQ8VD4odG9rZW4sIG5vdEZvdW5kVmFsdWUsIGZsYWdzKTtcbiAgfVxufVxuIl19