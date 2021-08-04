import { ComponentFactoryResolver, ApplicationRef, Injector, TemplateRef, Type } from '@angular/core';
import { NgxSmartModalComponent } from '../../src/components/ngx-smart-modal.component';
import { INgxSmartModalOptions } from '../../src/config/ngx-smart-modal.config';
import { NgxSmartModalStackService } from '../../src/services/ngx-smart-modal-stack.service';
import { ModalInstance } from './modal-instance';
export declare type Content<T> = string | TemplateRef<T> | Type<T>;
export declare class NgxSmartModalService {
    private _componentFactoryResolver;
    private _appRef;
    private _injector;
    private _modalStack;
    private applicationRef;
    private _document;
    private _platformId;
    private lastElementFocused;
    constructor(_componentFactoryResolver: ComponentFactoryResolver, _appRef: ApplicationRef, _injector: Injector, _modalStack: NgxSmartModalStackService, applicationRef: ApplicationRef, _document: any, _platformId: any);
    /**
     * Add a new modal instance. This step is essential and allows to retrieve any modal at any time.
     * It stores an object that contains the given modal identifier and the modal itself directly in the `modalStack`.
     *
     * @param modalInstance The object that contains the given modal identifier and the modal itself.
     * @param force Optional parameter that forces the overriding of modal instance if it already exists.
     * @returns nothing special.
     */
    addModal(modalInstance: ModalInstance, force?: boolean): void;
    /**
     * Retrieve a modal instance by its identifier.
     *
     * @param id The modal identifier used at creation time.
     */
    getModal(id: string): NgxSmartModalComponent;
    /**
     * Alias of `getModal` to retrieve a modal instance by its identifier.
     *
     * @param id The modal identifier used at creation time.
     */
    get(id: string): NgxSmartModalComponent;
    /**
     * Open a given modal
     *
     * @param id The modal identifier used at creation time.
     * @param force Tell the modal to open top of all other opened modals
     */
    open(id: string, force?: boolean): boolean;
    /**
     * Close a given modal
     *
     * @param id The modal identifier used at creation time.
     */
    close(id: string): boolean;
    /**
     * Close all opened modals
     */
    closeAll(): void;
    /**
     * Toggles a given modal
     * If the retrieved modal is opened it closes it, else it opens it.
     *
     * @param id The modal identifier used at creation time.
     * @param force Tell the modal to open top of all other opened modals
     */
    toggle(id: string, force?: boolean): boolean;
    /**
     * Retrieve all the created modals.
     *
     * @returns an array that contains all modal instances.
     */
    getModalStack(): ModalInstance[];
    /**
     * Retrieve all the opened modals. It looks for all modal instances with their `visible` property set to `true`.
     *
     * @returns an array that contains all the opened modals.
     */
    getOpenedModals(): ModalInstance[];
    /**
     * Retrieve the opened modal with highest z-index.
     *
     * @returns the opened modal with highest z-index.
     */
    getTopOpenedModal(): NgxSmartModalComponent;
    /**
     * Get the higher `z-index` value between all the modal instances. It iterates over the `ModalStack` array and
     * calculates a higher value (it takes the highest index value between all the modal instances and adds 1).
     * Use it to make a modal appear foreground.
     *
     * @returns a higher index from all the existing modal instances.
     */
    getHigherIndex(): number;
    /**
     * It gives the number of modal instances. It's helpful to know if the modal stack is empty or not.
     *
     * @returns the number of modal instances.
     */
    getModalStackCount(): number;
    /**
     * Remove a modal instance from the modal stack.
     *
     * @param id The modal identifier.
     * @returns the removed modal instance.
     */
    removeModal(id: string): void;
    /**
     * Associate data to an identified modal. If the modal isn't already associated to some data, it creates a new
     * entry in the `modalData` array with its `id` and the given `data`. If the modal already has data, it rewrites
     * them with the new ones. Finally if no modal found it returns an error message in the console and false value
     * as method output.
     *
     * @param data The data you want to associate to the modal.
     * @param id The modal identifier.
     * @param force If true, overrides the previous stored data if there was.
     * @returns true if the given modal exists and the process has been tried, either false.
     */
    setModalData(data: any, id: string, force?: boolean): boolean;
    /**
     * Retrieve modal data by its identifier.
     *
     * @param id The modal identifier used at creation time.
     * @returns the associated modal data.
     */
    getModalData(id: string): any;
    /**
     * Reset the data attached to a given modal.
     *
     * @param id The modal identifier used at creation time.
     * @returns the removed data or false if modal doesn't exist.
     */
    resetModalData(id: string): any | boolean;
    /**
     * Close the latest opened modal if it has been declared as escapable
     * Using a debounce system because one or more modals could be listening
     * escape key press event.
     */
    closeLatestModal(): void;
    /**
     * Create dynamic NgxSmartModalComponent
     * @param id The modal identifier used at creation time.
     * @param content The modal content ( string, templateRef or Component )
     */
    create<T>(id: string, content: Content<T>, options?: INgxSmartModalOptions): NgxSmartModalComponent;
    private _addEvents();
    private _initModal(modalInstance);
    private _openModal(modal, top?);
    private _toggleModal(modal, top?);
    private _closeModal(modal);
    private _dismissModal(modal);
    private _deleteModal(modalInstance);
    /**
     * Resolve content according to the types
     * @param content The modal content ( string, templateRef or Component )
     */
    private _resolveNgContent<T>(content);
    /**
     * Close the latest opened modal if escape key event is emitted
     * @param event The Keyboard Event
     */
    private _escapeKeyboardEvent;
    /**
     * Is current platform browser
     */
    private readonly isBrowser;
    /**
     * While modal is open, the focus stay on it
     * @param event The Keyboar dEvent
     */
    private _trapFocusModal;
}
