import { NgZone, OnDestroy } from '@angular/core';
import { IndividualConfig, ToastPackage } from './toastr-config';
import { ToastrService } from './toastr.service';
export declare class Toast implements OnDestroy {
    protected toastrService: ToastrService;
    toastPackage: ToastPackage;
    protected ngZone?: NgZone;
    message?: string | null;
    title?: string;
    options: IndividualConfig;
    duplicatesCount: number;
    originalTimeout: number;
    /** width of progress bar */
    width: number;
    /** a combination of toast type and options.toastClass */
    toastClasses: string;
    /** controls animation */
    state: {
        value: string;
        params: {
            easeTime: string | number;
            easing: string;
        };
    };
    /** hides component when waiting to be displayed */
    get displayStyle(): string | undefined;
    private timeout;
    private intervalId;
    private hideTime;
    private sub;
    private sub1;
    private sub2;
    private sub3;
    constructor(toastrService: ToastrService, toastPackage: ToastPackage, ngZone?: NgZone);
    ngOnDestroy(): void;
    /**
     * activates toast and sets timeout
     */
    activateToast(): void;
    /**
     * updates progress bar width
     */
    updateProgress(): void;
    resetTimeout(): void;
    /**
     * tells toastrService to remove this toast after animation time
     */
    remove(): void;
    tapToast(): void;
    stickAround(): void;
    delayedHideToast(): void;
    outsideTimeout(func: () => any, timeout: number): void;
    outsideInterval(func: () => any, timeout: number): void;
    private runInsideAngular;
}
