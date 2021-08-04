(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('@angular/animations'), require('rxjs'), require('@angular/platform-browser'), require('@angular/common')) :
    typeof define === 'function' && define.amd ? define('ngx-toastr', ['exports', '@angular/core', '@angular/animations', 'rxjs', '@angular/platform-browser', '@angular/common'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global['ngx-toastr'] = {}, global.ng.core, global.ng.animations, global.rxjs, global.ng.platformBrowser, global.ng.common));
}(this, (function (exports, i0, animations, rxjs, i3, i1) { 'use strict';

    var ToastContainerDirective = /** @class */ (function () {
        function ToastContainerDirective(el) {
            this.el = el;
        }
        ToastContainerDirective.prototype.getContainerElement = function () {
            return this.el.nativeElement;
        };
        return ToastContainerDirective;
    }());
    ToastContainerDirective.decorators = [
        { type: i0.Directive, args: [{
                    selector: '[toastContainer]',
                    exportAs: 'toastContainer',
                },] }
    ];
    ToastContainerDirective.ctorParameters = function () { return [
        { type: i0.ElementRef }
    ]; };
    var ToastContainerModule = /** @class */ (function () {
        function ToastContainerModule() {
        }
        return ToastContainerModule;
    }());
    ToastContainerModule.decorators = [
        { type: i0.NgModule, args: [{
                    declarations: [ToastContainerDirective],
                    exports: [ToastContainerDirective],
                },] }
    ];

    /**
     * Everything a toast needs to launch
     */
    var ToastPackage = /** @class */ (function () {
        function ToastPackage(toastId, config, message, title, toastType, toastRef) {
            var _this = this;
            this.toastId = toastId;
            this.config = config;
            this.message = message;
            this.title = title;
            this.toastType = toastType;
            this.toastRef = toastRef;
            this._onTap = new rxjs.Subject();
            this._onAction = new rxjs.Subject();
            this.toastRef.afterClosed().subscribe(function () {
                _this._onAction.complete();
                _this._onTap.complete();
            });
        }
        /** Fired on click */
        ToastPackage.prototype.triggerTap = function () {
            this._onTap.next();
            if (this.config.tapToDismiss) {
                this._onTap.complete();
            }
        };
        ToastPackage.prototype.onTap = function () {
            return this._onTap.asObservable();
        };
        /** available for use in custom toast */
        ToastPackage.prototype.triggerAction = function (action) {
            this._onAction.next(action);
        };
        ToastPackage.prototype.onAction = function () {
            return this._onAction.asObservable();
        };
        return ToastPackage;
    }());
    var DefaultNoComponentGlobalConfig = {
        maxOpened: 0,
        autoDismiss: false,
        newestOnTop: true,
        preventDuplicates: false,
        countDuplicates: false,
        resetTimeoutOnDuplicate: false,
        includeTitleDuplicates: false,
        iconClasses: {
            error: 'toast-error',
            info: 'toast-info',
            success: 'toast-success',
            warning: 'toast-warning',
        },
        // Individual
        closeButton: false,
        disableTimeOut: false,
        timeOut: 5000,
        extendedTimeOut: 1000,
        enableHtml: false,
        progressBar: false,
        toastClass: 'ngx-toastr',
        positionClass: 'toast-top-right',
        titleClass: 'toast-title',
        messageClass: 'toast-message',
        easing: 'ease-in',
        easeTime: 300,
        tapToDismiss: true,
        onActivateTick: false,
        progressAnimation: 'decreasing',
    };
    var TOAST_CONFIG = new i0.InjectionToken('ToastConfig');

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b)
                if (Object.prototype.hasOwnProperty.call(b, p))
                    d[p] = b[p]; };
        return extendStatics(d, b);
    };
    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }
    var __assign = function () {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s)
                    if (Object.prototype.hasOwnProperty.call(s, p))
                        t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    function __rest(s, e) {
        var t = {};
        for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
                t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }
    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
            r = Reflect.decorate(decorators, target, key, desc);
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if (d = decorators[i])
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }
    function __param(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); };
    }
    function __metadata(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
            return Reflect.metadata(metadataKey, metadataValue);
    }
    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try {
                step(generator.next(value));
            }
            catch (e) {
                reject(e);
            } }
            function rejected(value) { try {
                step(generator["throw"](value));
            }
            catch (e) {
                reject(e);
            } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }
    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function () { if (t[0] & 1)
                throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f)
                throw new TypeError("Generator is already executing.");
            while (_)
                try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                        return t;
                    if (y = 0, t)
                        op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op;
                            break;
                        case 4:
                            _.label++;
                            return { value: op[1], done: false };
                        case 5:
                            _.label++;
                            y = op[1];
                            op = [0];
                            continue;
                        case 7:
                            op = _.ops.pop();
                            _.trys.pop();
                            continue;
                        default:
                            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                                _ = 0;
                                continue;
                            }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                                _.label = op[1];
                                break;
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1];
                                t = op;
                                break;
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2];
                                _.ops.push(op);
                                break;
                            }
                            if (t[2])
                                _.ops.pop();
                            _.trys.pop();
                            continue;
                    }
                    op = body.call(thisArg, _);
                }
                catch (e) {
                    op = [6, e];
                    y = 0;
                }
                finally {
                    f = t = 0;
                }
            if (op[0] & 5)
                throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    }
    var __createBinding = Object.create ? (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
    }) : (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        o[k2] = m[k];
    });
    function __exportStar(m, o) {
        for (var p in m)
            if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
                __createBinding(o, m, p);
    }
    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m)
            return m.call(o);
        if (o && typeof o.length === "number")
            return {
                next: function () {
                    if (o && i >= o.length)
                        o = void 0;
                    return { value: o && o[i++], done: !o };
                }
            };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m)
            return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
                ar.push(r.value);
        }
        catch (error) {
            e = { error: error };
        }
        finally {
            try {
                if (r && !r.done && (m = i["return"]))
                    m.call(i);
            }
            finally {
                if (e)
                    throw e.error;
            }
        }
        return ar;
    }
    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }
    function __spreadArrays() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++)
            s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    ;
    function __await(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    }
    function __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n])
            i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try {
            step(g[n](v));
        }
        catch (e) {
            settle(q[0][3], e);
        } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length)
            resume(q[0][0], q[0][1]); }
    }
    function __asyncDelegator(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }
    function __asyncValues(o) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function (v) { resolve({ value: v, done: d }); }, reject); }
    }
    function __makeTemplateObject(cooked, raw) {
        if (Object.defineProperty) {
            Object.defineProperty(cooked, "raw", { value: raw });
        }
        else {
            cooked.raw = raw;
        }
        return cooked;
    }
    ;
    var __setModuleDefault = Object.create ? (function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function (o, v) {
        o["default"] = v;
    };
    function __importStar(mod) {
        if (mod && mod.__esModule)
            return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    }
    function __importDefault(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }
    function __classPrivateFieldGet(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    }
    function __classPrivateFieldSet(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    }

    /**
     * A `ComponentPortal` is a portal that instantiates some Component upon attachment.
     */
    var ComponentPortal = /** @class */ (function () {
        function ComponentPortal(component, injector) {
            this.component = component;
            this.injector = injector;
        }
        /** Attach this portal to a host. */
        ComponentPortal.prototype.attach = function (host, newestOnTop) {
            this._attachedHost = host;
            return host.attach(this, newestOnTop);
        };
        /** Detach this portal from its host */
        ComponentPortal.prototype.detach = function () {
            var host = this._attachedHost;
            if (host) {
                this._attachedHost = undefined;
                return host.detach();
            }
        };
        Object.defineProperty(ComponentPortal.prototype, "isAttached", {
            /** Whether this portal is attached to a host. */
            get: function () {
                return this._attachedHost != null;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Sets the PortalHost reference without performing `attach()`. This is used directly by
         * the PortalHost when it is performing an `attach()` or `detach()`.
         */
        ComponentPortal.prototype.setAttachedHost = function (host) {
            this._attachedHost = host;
        };
        return ComponentPortal;
    }());
    /**
     * Partial implementation of PortalHost that only deals with attaching a
     * ComponentPortal
     */
    var BasePortalHost = /** @class */ (function () {
        function BasePortalHost() {
        }
        BasePortalHost.prototype.attach = function (portal, newestOnTop) {
            this._attachedPortal = portal;
            return this.attachComponentPortal(portal, newestOnTop);
        };
        BasePortalHost.prototype.detach = function () {
            if (this._attachedPortal) {
                this._attachedPortal.setAttachedHost();
            }
            this._attachedPortal = undefined;
            if (this._disposeFn) {
                this._disposeFn();
                this._disposeFn = undefined;
            }
        };
        BasePortalHost.prototype.setDisposeFn = function (fn) {
            this._disposeFn = fn;
        };
        return BasePortalHost;
    }());

    /**
     * A PortalHost for attaching portals to an arbitrary DOM element outside of the Angular
     * application context.
     *
     * This is the only part of the portal core that directly touches the DOM.
     */
    var DomPortalHost = /** @class */ (function (_super) {
        __extends(DomPortalHost, _super);
        function DomPortalHost(_hostDomElement, _componentFactoryResolver, _appRef) {
            var _this = _super.call(this) || this;
            _this._hostDomElement = _hostDomElement;
            _this._componentFactoryResolver = _componentFactoryResolver;
            _this._appRef = _appRef;
            return _this;
        }
        /**
         * Attach the given ComponentPortal to DOM element using the ComponentFactoryResolver.
         * @param portal Portal to be attached
         */
        DomPortalHost.prototype.attachComponentPortal = function (portal, newestOnTop) {
            var _this = this;
            var componentFactory = this._componentFactoryResolver.resolveComponentFactory(portal.component);
            var componentRef;
            // If the portal specifies a ViewContainerRef, we will use that as the attachment point
            // for the component (in terms of Angular's component tree, not rendering).
            // When the ViewContainerRef is missing, we use the factory to create the component directly
            // and then manually attach the ChangeDetector for that component to the application (which
            // happens automatically when using a ViewContainer).
            componentRef = componentFactory.create(portal.injector);
            // When creating a component outside of a ViewContainer, we need to manually register
            // its ChangeDetector with the application. This API is unfortunately not yet published
            // in Angular core. The change detector must also be deregistered when the component
            // is destroyed to prevent memory leaks.
            this._appRef.attachView(componentRef.hostView);
            this.setDisposeFn(function () {
                _this._appRef.detachView(componentRef.hostView);
                componentRef.destroy();
            });
            // At this point the component has been instantiated, so we move it to the location in the DOM
            // where we want it to be rendered.
            if (newestOnTop) {
                this._hostDomElement.insertBefore(this._getComponentRootNode(componentRef), this._hostDomElement.firstChild);
            }
            else {
                this._hostDomElement.appendChild(this._getComponentRootNode(componentRef));
            }
            return componentRef;
        };
        /** Gets the root HTMLElement for an instantiated component. */
        DomPortalHost.prototype._getComponentRootNode = function (componentRef) {
            return componentRef.hostView.rootNodes[0];
        };
        return DomPortalHost;
    }(BasePortalHost));

    /** Container inside which all toasts will render. */
    var OverlayContainer = /** @class */ (function () {
        function OverlayContainer(_document) {
            this._document = _document;
        }
        OverlayContainer.prototype.ngOnDestroy = function () {
            if (this._containerElement && this._containerElement.parentNode) {
                this._containerElement.parentNode.removeChild(this._containerElement);
            }
        };
        /**
         * This method returns the overlay container element. It will lazily
         * create the element the first time  it is called to facilitate using
         * the container in non-browser environments.
         * @returns the container element
         */
        OverlayContainer.prototype.getContainerElement = function () {
            if (!this._containerElement) {
                this._createContainer();
            }
            return this._containerElement;
        };
        /**
         * Create the overlay container element, which is simply a div
         * with the 'cdk-overlay-container' class on the document body.
         */
        OverlayContainer.prototype._createContainer = function () {
            var container = this._document.createElement('div');
            container.classList.add('overlay-container');
            this._document.body.appendChild(container);
            this._containerElement = container;
        };
        return OverlayContainer;
    }());
    OverlayContainer.ɵprov = i0.ɵɵdefineInjectable({ factory: function OverlayContainer_Factory() { return new OverlayContainer(i0.ɵɵinject(i1.DOCUMENT)); }, token: OverlayContainer, providedIn: "root" });
    OverlayContainer.decorators = [
        { type: i0.Injectable, args: [{ providedIn: 'root' },] }
    ];
    OverlayContainer.ctorParameters = function () { return [
        { type: undefined, decorators: [{ type: i0.Inject, args: [i1.DOCUMENT,] }] }
    ]; };

    /**
     * Reference to an overlay that has been created with the Overlay service.
     * Used to manipulate or dispose of said overlay.
     */
    var OverlayRef = /** @class */ (function () {
        function OverlayRef(_portalHost) {
            this._portalHost = _portalHost;
        }
        OverlayRef.prototype.attach = function (portal, newestOnTop) {
            if (newestOnTop === void 0) { newestOnTop = true; }
            return this._portalHost.attach(portal, newestOnTop);
        };
        /**
         * Detaches an overlay from a portal.
         * @returns Resolves when the overlay has been detached.
         */
        OverlayRef.prototype.detach = function () {
            return this._portalHost.detach();
        };
        return OverlayRef;
    }());

    /* tslint:disable:no-non-null-assertion */
    /**
     * Service to create Overlays. Overlays are dynamically added pieces of floating UI, meant to be
     * used as a low-level building building block for other components. Dialogs, tooltips, menus,
     * selects, etc. can all be built using overlays. The service should primarily be used by authors
     * of re-usable components rather than developers building end-user applications.
     *
     * An overlay *is* a PortalHost, so any kind of Portal can be loaded into one.
     */
    var Overlay = /** @class */ (function () {
        function Overlay(_overlayContainer, _componentFactoryResolver, _appRef, _document) {
            this._overlayContainer = _overlayContainer;
            this._componentFactoryResolver = _componentFactoryResolver;
            this._appRef = _appRef;
            this._document = _document;
            // Namespace panes by overlay container
            this._paneElements = new Map();
        }
        /**
         * Creates an overlay.
         * @returns A reference to the created overlay.
         */
        Overlay.prototype.create = function (positionClass, overlayContainer) {
            // get existing pane if possible
            return this._createOverlayRef(this.getPaneElement(positionClass, overlayContainer));
        };
        Overlay.prototype.getPaneElement = function (positionClass, overlayContainer) {
            if (positionClass === void 0) { positionClass = ''; }
            if (!this._paneElements.get(overlayContainer)) {
                this._paneElements.set(overlayContainer, {});
            }
            if (!this._paneElements.get(overlayContainer)[positionClass]) {
                this._paneElements.get(overlayContainer)[positionClass] = this._createPaneElement(positionClass, overlayContainer);
            }
            return this._paneElements.get(overlayContainer)[positionClass];
        };
        /**
         * Creates the DOM element for an overlay and appends it to the overlay container.
         * @returns Newly-created pane element
         */
        Overlay.prototype._createPaneElement = function (positionClass, overlayContainer) {
            var pane = this._document.createElement('div');
            pane.id = 'toast-container';
            pane.classList.add(positionClass);
            pane.classList.add('toast-container');
            if (!overlayContainer) {
                this._overlayContainer.getContainerElement().appendChild(pane);
            }
            else {
                overlayContainer.getContainerElement().appendChild(pane);
            }
            return pane;
        };
        /**
         * Create a DomPortalHost into which the overlay content can be loaded.
         * @param pane The DOM element to turn into a portal host.
         * @returns A portal host for the given DOM element.
         */
        Overlay.prototype._createPortalHost = function (pane) {
            return new DomPortalHost(pane, this._componentFactoryResolver, this._appRef);
        };
        /**
         * Creates an OverlayRef for an overlay in the given DOM element.
         * @param pane DOM element for the overlay
         */
        Overlay.prototype._createOverlayRef = function (pane) {
            return new OverlayRef(this._createPortalHost(pane));
        };
        return Overlay;
    }());
    Overlay.ɵprov = i0.ɵɵdefineInjectable({ factory: function Overlay_Factory() { return new Overlay(i0.ɵɵinject(OverlayContainer), i0.ɵɵinject(i0.ComponentFactoryResolver), i0.ɵɵinject(i0.ApplicationRef), i0.ɵɵinject(i1.DOCUMENT)); }, token: Overlay, providedIn: "root" });
    Overlay.decorators = [
        { type: i0.Injectable, args: [{ providedIn: 'root' },] }
    ];
    Overlay.ctorParameters = function () { return [
        { type: OverlayContainer },
        { type: i0.ComponentFactoryResolver },
        { type: i0.ApplicationRef },
        { type: undefined, decorators: [{ type: i0.Inject, args: [i1.DOCUMENT,] }] }
    ]; };

    /**
     * Reference to a toast opened via the Toastr service.
     */
    var ToastRef = /** @class */ (function () {
        function ToastRef(_overlayRef) {
            this._overlayRef = _overlayRef;
            /** Count of duplicates of this toast */
            this.duplicatesCount = 0;
            /** Subject for notifying the user that the toast has finished closing. */
            this._afterClosed = new rxjs.Subject();
            /** triggered when toast is activated */
            this._activate = new rxjs.Subject();
            /** notifies the toast that it should close before the timeout */
            this._manualClose = new rxjs.Subject();
            /** notifies the toast that it should reset the timeouts */
            this._resetTimeout = new rxjs.Subject();
            /** notifies the toast that it should count a duplicate toast */
            this._countDuplicate = new rxjs.Subject();
        }
        ToastRef.prototype.manualClose = function () {
            this._manualClose.next();
            this._manualClose.complete();
        };
        ToastRef.prototype.manualClosed = function () {
            return this._manualClose.asObservable();
        };
        ToastRef.prototype.timeoutReset = function () {
            return this._resetTimeout.asObservable();
        };
        ToastRef.prototype.countDuplicate = function () {
            return this._countDuplicate.asObservable();
        };
        /**
         * Close the toast.
         */
        ToastRef.prototype.close = function () {
            this._overlayRef.detach();
            this._afterClosed.next();
            this._manualClose.next();
            this._afterClosed.complete();
            this._manualClose.complete();
            this._activate.complete();
            this._resetTimeout.complete();
            this._countDuplicate.complete();
        };
        /** Gets an observable that is notified when the toast is finished closing. */
        ToastRef.prototype.afterClosed = function () {
            return this._afterClosed.asObservable();
        };
        ToastRef.prototype.isInactive = function () {
            return this._activate.isStopped;
        };
        ToastRef.prototype.activate = function () {
            this._activate.next();
            this._activate.complete();
        };
        /** Gets an observable that is notified when the toast has started opening. */
        ToastRef.prototype.afterActivate = function () {
            return this._activate.asObservable();
        };
        /** Reset the toast timouts and count duplicates */
        ToastRef.prototype.onDuplicate = function (resetTimeout, countDuplicate) {
            if (resetTimeout) {
                this._resetTimeout.next();
            }
            if (countDuplicate) {
                this._countDuplicate.next(++this.duplicatesCount);
            }
        };
        return ToastRef;
    }());
    /** Custom injector type specifically for instantiating components with a toast. */
    var ToastInjector = /** @class */ (function () {
        function ToastInjector(_toastPackage, _parentInjector) {
            this._toastPackage = _toastPackage;
            this._parentInjector = _parentInjector;
        }
        ToastInjector.prototype.get = function (token, notFoundValue, flags) {
            if (token === ToastPackage) {
                return this._toastPackage;
            }
            return this._parentInjector.get(token, notFoundValue, flags);
        };
        return ToastInjector;
    }());

    var ToastrService = /** @class */ (function () {
        function ToastrService(token, overlay, _injector, sanitizer, ngZone) {
            this.overlay = overlay;
            this._injector = _injector;
            this.sanitizer = sanitizer;
            this.ngZone = ngZone;
            this.currentlyActive = 0;
            this.toasts = [];
            this.index = 0;
            this.toastrConfig = Object.assign(Object.assign({}, token.default), token.config);
            if (token.config.iconClasses) {
                this.toastrConfig.iconClasses = Object.assign(Object.assign({}, token.default.iconClasses), token.config.iconClasses);
            }
        }
        /** show toast */
        ToastrService.prototype.show = function (message, title, override, type) {
            if (override === void 0) { override = {}; }
            if (type === void 0) { type = ''; }
            return this._preBuildNotification(type, message, title, this.applyConfig(override));
        };
        /** show successful toast */
        ToastrService.prototype.success = function (message, title, override) {
            if (override === void 0) { override = {}; }
            var type = this.toastrConfig.iconClasses.success || '';
            return this._preBuildNotification(type, message, title, this.applyConfig(override));
        };
        /** show error toast */
        ToastrService.prototype.error = function (message, title, override) {
            if (override === void 0) { override = {}; }
            var type = this.toastrConfig.iconClasses.error || '';
            return this._preBuildNotification(type, message, title, this.applyConfig(override));
        };
        /** show info toast */
        ToastrService.prototype.info = function (message, title, override) {
            if (override === void 0) { override = {}; }
            var type = this.toastrConfig.iconClasses.info || '';
            return this._preBuildNotification(type, message, title, this.applyConfig(override));
        };
        /** show warning toast */
        ToastrService.prototype.warning = function (message, title, override) {
            if (override === void 0) { override = {}; }
            var type = this.toastrConfig.iconClasses.warning || '';
            return this._preBuildNotification(type, message, title, this.applyConfig(override));
        };
        /**
         * Remove all or a single toast by id
         */
        ToastrService.prototype.clear = function (toastId) {
            var e_1, _a;
            try {
                // Call every toastRef manualClose function
                for (var _b = __values(this.toasts), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var toast = _c.value;
                    if (toastId !== undefined) {
                        if (toast.toastId === toastId) {
                            toast.toastRef.manualClose();
                            return;
                        }
                    }
                    else {
                        toast.toastRef.manualClose();
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        /**
         * Remove and destroy a single toast by id
         */
        ToastrService.prototype.remove = function (toastId) {
            var found = this._findToast(toastId);
            if (!found) {
                return false;
            }
            found.activeToast.toastRef.close();
            this.toasts.splice(found.index, 1);
            this.currentlyActive = this.currentlyActive - 1;
            if (!this.toastrConfig.maxOpened || !this.toasts.length) {
                return false;
            }
            if (this.currentlyActive < this.toastrConfig.maxOpened && this.toasts[this.currentlyActive]) {
                var p = this.toasts[this.currentlyActive].toastRef;
                if (!p.isInactive()) {
                    this.currentlyActive = this.currentlyActive + 1;
                    p.activate();
                }
            }
            return true;
        };
        /**
         * Determines if toast message is already shown
         */
        ToastrService.prototype.findDuplicate = function (title, message, resetOnDuplicate, countDuplicates) {
            var e_2, _a;
            if (title === void 0) { title = ''; }
            if (message === void 0) { message = ''; }
            var includeTitleDuplicates = this.toastrConfig.includeTitleDuplicates;
            try {
                for (var _b = __values(this.toasts), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var toast = _c.value;
                    var hasDuplicateTitle = includeTitleDuplicates && toast.title === title;
                    if ((!includeTitleDuplicates || hasDuplicateTitle) && toast.message === message) {
                        toast.toastRef.onDuplicate(resetOnDuplicate, countDuplicates);
                        return toast;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return null;
        };
        /** create a clone of global config and apply individual settings */
        ToastrService.prototype.applyConfig = function (override) {
            if (override === void 0) { override = {}; }
            return Object.assign(Object.assign({}, this.toastrConfig), override);
        };
        /**
         * Find toast object by id
         */
        ToastrService.prototype._findToast = function (toastId) {
            for (var i = 0; i < this.toasts.length; i++) {
                if (this.toasts[i].toastId === toastId) {
                    return { index: i, activeToast: this.toasts[i] };
                }
            }
            return null;
        };
        /**
         * Determines the need to run inside angular's zone then builds the toast
         */
        ToastrService.prototype._preBuildNotification = function (toastType, message, title, config) {
            var _this = this;
            if (config.onActivateTick) {
                return this.ngZone.run(function () { return _this._buildNotification(toastType, message, title, config); });
            }
            return this._buildNotification(toastType, message, title, config);
        };
        /**
         * Creates and attaches toast data to component
         * returns the active toast, or in case preventDuplicates is enabled the original/non-duplicate active toast.
         */
        ToastrService.prototype._buildNotification = function (toastType, message, title, config) {
            if (!config.toastComponent) {
                throw new Error('toastComponent required');
            }
            // max opened and auto dismiss = true
            // if timeout = 0 resetting it would result in setting this.hideTime = Date.now(). Hence, we only want to reset timeout if there is
            // a timeout at all
            var duplicate = this.findDuplicate(title, message, this.toastrConfig.resetTimeoutOnDuplicate && config.timeOut > 0, this.toastrConfig.countDuplicates);
            if (((this.toastrConfig.includeTitleDuplicates && title) || message) &&
                this.toastrConfig.preventDuplicates &&
                duplicate !== null) {
                return duplicate;
            }
            this.previousToastMessage = message;
            var keepInactive = false;
            if (this.toastrConfig.maxOpened && this.currentlyActive >= this.toastrConfig.maxOpened) {
                keepInactive = true;
                if (this.toastrConfig.autoDismiss) {
                    this.clear(this.toasts[0].toastId);
                }
            }
            var overlayRef = this.overlay.create(config.positionClass, this.overlayContainer);
            this.index = this.index + 1;
            var sanitizedMessage = message;
            if (message && config.enableHtml) {
                sanitizedMessage = this.sanitizer.sanitize(i0.SecurityContext.HTML, message);
            }
            var toastRef = new ToastRef(overlayRef);
            var toastPackage = new ToastPackage(this.index, config, sanitizedMessage, title, toastType, toastRef);
            var toastInjector = new ToastInjector(toastPackage, this._injector);
            var component = new ComponentPortal(config.toastComponent, toastInjector);
            var portal = overlayRef.attach(component, this.toastrConfig.newestOnTop);
            toastRef.componentInstance = portal.instance;
            var ins = {
                toastId: this.index,
                title: title || '',
                message: message || '',
                toastRef: toastRef,
                onShown: toastRef.afterActivate(),
                onHidden: toastRef.afterClosed(),
                onTap: toastPackage.onTap(),
                onAction: toastPackage.onAction(),
                portal: portal,
            };
            if (!keepInactive) {
                this.currentlyActive = this.currentlyActive + 1;
                setTimeout(function () {
                    ins.toastRef.activate();
                });
            }
            this.toasts.push(ins);
            return ins;
        };
        return ToastrService;
    }());
    ToastrService.ɵprov = i0.ɵɵdefineInjectable({ factory: function ToastrService_Factory() { return new ToastrService(i0.ɵɵinject(TOAST_CONFIG), i0.ɵɵinject(Overlay), i0.ɵɵinject(i0.INJECTOR), i0.ɵɵinject(i3.DomSanitizer), i0.ɵɵinject(i0.NgZone)); }, token: ToastrService, providedIn: "root" });
    ToastrService.decorators = [
        { type: i0.Injectable, args: [{ providedIn: 'root' },] }
    ];
    ToastrService.ctorParameters = function () { return [
        { type: undefined, decorators: [{ type: i0.Inject, args: [TOAST_CONFIG,] }] },
        { type: Overlay },
        { type: i0.Injector },
        { type: i3.DomSanitizer },
        { type: i0.NgZone }
    ]; };

    var Toast = /** @class */ (function () {
        function Toast(toastrService, toastPackage, ngZone) {
            var _this = this;
            this.toastrService = toastrService;
            this.toastPackage = toastPackage;
            this.ngZone = ngZone;
            /** width of progress bar */
            this.width = -1;
            /** a combination of toast type and options.toastClass */
            this.toastClasses = '';
            /** controls animation */
            this.state = {
                value: 'inactive',
                params: {
                    easeTime: this.toastPackage.config.easeTime,
                    easing: 'ease-in'
                }
            };
            this.message = toastPackage.message;
            this.title = toastPackage.title;
            this.options = toastPackage.config;
            this.originalTimeout = toastPackage.config.timeOut;
            this.toastClasses = toastPackage.toastType + " " + toastPackage.config.toastClass;
            this.sub = toastPackage.toastRef.afterActivate().subscribe(function () {
                _this.activateToast();
            });
            this.sub1 = toastPackage.toastRef.manualClosed().subscribe(function () {
                _this.remove();
            });
            this.sub2 = toastPackage.toastRef.timeoutReset().subscribe(function () {
                _this.resetTimeout();
            });
            this.sub3 = toastPackage.toastRef.countDuplicate().subscribe(function (count) {
                _this.duplicatesCount = count;
            });
        }
        Object.defineProperty(Toast.prototype, "displayStyle", {
            /** hides component when waiting to be displayed */
            get: function () {
                if (this.state.value === 'inactive') {
                    return 'none';
                }
                return;
            },
            enumerable: false,
            configurable: true
        });
        Toast.prototype.ngOnDestroy = function () {
            this.sub.unsubscribe();
            this.sub1.unsubscribe();
            this.sub2.unsubscribe();
            this.sub3.unsubscribe();
            clearInterval(this.intervalId);
            clearTimeout(this.timeout);
        };
        /**
         * activates toast and sets timeout
         */
        Toast.prototype.activateToast = function () {
            var _this = this;
            this.state = Object.assign(Object.assign({}, this.state), { value: 'active' });
            if (!(this.options.disableTimeOut === true || this.options.disableTimeOut === 'timeOut') && this.options.timeOut) {
                this.outsideTimeout(function () { return _this.remove(); }, this.options.timeOut);
                this.hideTime = new Date().getTime() + this.options.timeOut;
                if (this.options.progressBar) {
                    this.outsideInterval(function () { return _this.updateProgress(); }, 10);
                }
            }
        };
        /**
         * updates progress bar width
         */
        Toast.prototype.updateProgress = function () {
            if (this.width === 0 || this.width === 100 || !this.options.timeOut) {
                return;
            }
            var now = new Date().getTime();
            var remaining = this.hideTime - now;
            this.width = (remaining / this.options.timeOut) * 100;
            if (this.options.progressAnimation === 'increasing') {
                this.width = 100 - this.width;
            }
            if (this.width <= 0) {
                this.width = 0;
            }
            if (this.width >= 100) {
                this.width = 100;
            }
        };
        Toast.prototype.resetTimeout = function () {
            var _this = this;
            clearTimeout(this.timeout);
            clearInterval(this.intervalId);
            this.state = Object.assign(Object.assign({}, this.state), { value: 'active' });
            this.outsideTimeout(function () { return _this.remove(); }, this.originalTimeout);
            this.options.timeOut = this.originalTimeout;
            this.hideTime = new Date().getTime() + (this.options.timeOut || 0);
            this.width = -1;
            if (this.options.progressBar) {
                this.outsideInterval(function () { return _this.updateProgress(); }, 10);
            }
        };
        /**
         * tells toastrService to remove this toast after animation time
         */
        Toast.prototype.remove = function () {
            var _this = this;
            if (this.state.value === 'removed') {
                return;
            }
            clearTimeout(this.timeout);
            this.state = Object.assign(Object.assign({}, this.state), { value: 'removed' });
            this.outsideTimeout(function () { return _this.toastrService.remove(_this.toastPackage.toastId); }, +this.toastPackage.config.easeTime);
        };
        Toast.prototype.tapToast = function () {
            if (this.state.value === 'removed') {
                return;
            }
            this.toastPackage.triggerTap();
            if (this.options.tapToDismiss) {
                this.remove();
            }
        };
        Toast.prototype.stickAround = function () {
            if (this.state.value === 'removed') {
                return;
            }
            clearTimeout(this.timeout);
            this.options.timeOut = 0;
            this.hideTime = 0;
            // disable progressBar
            clearInterval(this.intervalId);
            this.width = 0;
        };
        Toast.prototype.delayedHideToast = function () {
            var _this = this;
            if ((this.options.disableTimeOut === true || this.options.disableTimeOut === 'extendedTimeOut') ||
                this.options.extendedTimeOut === 0 ||
                this.state.value === 'removed') {
                return;
            }
            this.outsideTimeout(function () { return _this.remove(); }, this.options.extendedTimeOut);
            this.options.timeOut = this.options.extendedTimeOut;
            this.hideTime = new Date().getTime() + (this.options.timeOut || 0);
            this.width = -1;
            if (this.options.progressBar) {
                this.outsideInterval(function () { return _this.updateProgress(); }, 10);
            }
        };
        Toast.prototype.outsideTimeout = function (func, timeout) {
            var _this = this;
            if (this.ngZone) {
                this.ngZone.runOutsideAngular(function () { return (_this.timeout = setTimeout(function () { return _this.runInsideAngular(func); }, timeout)); });
            }
            else {
                this.timeout = setTimeout(function () { return func(); }, timeout);
            }
        };
        Toast.prototype.outsideInterval = function (func, timeout) {
            var _this = this;
            if (this.ngZone) {
                this.ngZone.runOutsideAngular(function () { return (_this.intervalId = setInterval(function () { return _this.runInsideAngular(func); }, timeout)); });
            }
            else {
                this.intervalId = setInterval(function () { return func(); }, timeout);
            }
        };
        Toast.prototype.runInsideAngular = function (func) {
            if (this.ngZone) {
                this.ngZone.run(function () { return func(); });
            }
            else {
                func();
            }
        };
        return Toast;
    }());
    Toast.decorators = [
        { type: i0.Component, args: [{
                    selector: '[toast-component]',
                    template: "\n  <button *ngIf=\"options.closeButton\" (click)=\"remove()\" class=\"toast-close-button\" aria-label=\"Close\">\n    <span aria-hidden=\"true\">&times;</span>\n  </button>\n  <div *ngIf=\"title\" [class]=\"options.titleClass\" [attr.aria-label]=\"title\">\n    {{ title }} <ng-container *ngIf=\"duplicatesCount\">[{{ duplicatesCount + 1 }}]</ng-container>\n  </div>\n  <div *ngIf=\"message && options.enableHtml\" role=\"alertdialog\" aria-live=\"polite\"\n    [class]=\"options.messageClass\" [innerHTML]=\"message\">\n  </div>\n  <div *ngIf=\"message && !options.enableHtml\" role=\"alertdialog\" aria-live=\"polite\"\n    [class]=\"options.messageClass\" [attr.aria-label]=\"message\">\n    {{ message }}\n  </div>\n  <div *ngIf=\"options.progressBar\">\n    <div class=\"toast-progress\" [style.width]=\"width + '%'\"></div>\n  </div>\n  ",
                    animations: [
                        animations.trigger('flyInOut', [
                            animations.state('inactive', animations.style({ opacity: 0 })),
                            animations.state('active', animations.style({ opacity: 1 })),
                            animations.state('removed', animations.style({ opacity: 0 })),
                            animations.transition('inactive => active', animations.animate('{{ easeTime }}ms {{ easing }}')),
                            animations.transition('active => removed', animations.animate('{{ easeTime }}ms {{ easing }}'))
                        ])
                    ],
                    preserveWhitespaces: false
                },] }
    ];
    Toast.ctorParameters = function () { return [
        { type: ToastrService },
        { type: ToastPackage },
        { type: i0.NgZone }
    ]; };
    Toast.propDecorators = {
        toastClasses: [{ type: i0.HostBinding, args: ['class',] }],
        state: [{ type: i0.HostBinding, args: ['@flyInOut',] }],
        displayStyle: [{ type: i0.HostBinding, args: ['style.display',] }],
        tapToast: [{ type: i0.HostListener, args: ['click',] }],
        stickAround: [{ type: i0.HostListener, args: ['mouseenter',] }],
        delayedHideToast: [{ type: i0.HostListener, args: ['mouseleave',] }]
    };

    var DefaultGlobalConfig = Object.assign(Object.assign({}, DefaultNoComponentGlobalConfig), { toastComponent: Toast });
    var ToastrModule = /** @class */ (function () {
        function ToastrModule() {
        }
        ToastrModule.forRoot = function (config) {
            if (config === void 0) { config = {}; }
            return {
                ngModule: ToastrModule,
                providers: [
                    {
                        provide: TOAST_CONFIG,
                        useValue: {
                            default: DefaultGlobalConfig,
                            config: config,
                        },
                    },
                ],
            };
        };
        return ToastrModule;
    }());
    ToastrModule.decorators = [
        { type: i0.NgModule, args: [{
                    imports: [i1.CommonModule],
                    declarations: [Toast],
                    exports: [Toast],
                    entryComponents: [Toast],
                },] }
    ];
    var ToastrComponentlessModule = /** @class */ (function () {
        function ToastrComponentlessModule() {
        }
        ToastrComponentlessModule.forRoot = function (config) {
            if (config === void 0) { config = {}; }
            return {
                ngModule: ToastrModule,
                providers: [
                    {
                        provide: TOAST_CONFIG,
                        useValue: {
                            default: DefaultNoComponentGlobalConfig,
                            config: config,
                        },
                    },
                ],
            };
        };
        return ToastrComponentlessModule;
    }());
    ToastrComponentlessModule.decorators = [
        { type: i0.NgModule, args: [{
                    imports: [i1.CommonModule],
                },] }
    ];

    var ToastNoAnimation = /** @class */ (function () {
        function ToastNoAnimation(toastrService, toastPackage, appRef) {
            var _this = this;
            this.toastrService = toastrService;
            this.toastPackage = toastPackage;
            this.appRef = appRef;
            /** width of progress bar */
            this.width = -1;
            /** a combination of toast type and options.toastClass */
            this.toastClasses = '';
            /** controls animation */
            this.state = 'inactive';
            this.message = toastPackage.message;
            this.title = toastPackage.title;
            this.options = toastPackage.config;
            this.originalTimeout = toastPackage.config.timeOut;
            this.toastClasses = toastPackage.toastType + " " + toastPackage.config.toastClass;
            this.sub = toastPackage.toastRef.afterActivate().subscribe(function () {
                _this.activateToast();
            });
            this.sub1 = toastPackage.toastRef.manualClosed().subscribe(function () {
                _this.remove();
            });
            this.sub2 = toastPackage.toastRef.timeoutReset().subscribe(function () {
                _this.resetTimeout();
            });
            this.sub3 = toastPackage.toastRef.countDuplicate().subscribe(function (count) {
                _this.duplicatesCount = count;
            });
        }
        Object.defineProperty(ToastNoAnimation.prototype, "displayStyle", {
            /** hides component when waiting to be displayed */
            get: function () {
                if (this.state === 'inactive') {
                    return 'none';
                }
            },
            enumerable: false,
            configurable: true
        });
        ToastNoAnimation.prototype.ngOnDestroy = function () {
            this.sub.unsubscribe();
            this.sub1.unsubscribe();
            this.sub2.unsubscribe();
            this.sub3.unsubscribe();
            clearInterval(this.intervalId);
            clearTimeout(this.timeout);
        };
        /**
         * activates toast and sets timeout
         */
        ToastNoAnimation.prototype.activateToast = function () {
            var _this = this;
            this.state = 'active';
            if (!(this.options.disableTimeOut === true || this.options.disableTimeOut === 'timeOut') && this.options.timeOut) {
                this.timeout = setTimeout(function () {
                    _this.remove();
                }, this.options.timeOut);
                this.hideTime = new Date().getTime() + this.options.timeOut;
                if (this.options.progressBar) {
                    this.intervalId = setInterval(function () { return _this.updateProgress(); }, 10);
                }
            }
            if (this.options.onActivateTick) {
                this.appRef.tick();
            }
        };
        /**
         * updates progress bar width
         */
        ToastNoAnimation.prototype.updateProgress = function () {
            if (this.width === 0 || this.width === 100 || !this.options.timeOut) {
                return;
            }
            var now = new Date().getTime();
            var remaining = this.hideTime - now;
            this.width = (remaining / this.options.timeOut) * 100;
            if (this.options.progressAnimation === 'increasing') {
                this.width = 100 - this.width;
            }
            if (this.width <= 0) {
                this.width = 0;
            }
            if (this.width >= 100) {
                this.width = 100;
            }
        };
        ToastNoAnimation.prototype.resetTimeout = function () {
            var _this = this;
            clearTimeout(this.timeout);
            clearInterval(this.intervalId);
            this.state = 'active';
            this.options.timeOut = this.originalTimeout;
            this.timeout = setTimeout(function () { return _this.remove(); }, this.originalTimeout);
            this.hideTime = new Date().getTime() + (this.originalTimeout || 0);
            this.width = -1;
            if (this.options.progressBar) {
                this.intervalId = setInterval(function () { return _this.updateProgress(); }, 10);
            }
        };
        /**
         * tells toastrService to remove this toast after animation time
         */
        ToastNoAnimation.prototype.remove = function () {
            var _this = this;
            if (this.state === 'removed') {
                return;
            }
            clearTimeout(this.timeout);
            this.state = 'removed';
            this.timeout = setTimeout(function () { return _this.toastrService.remove(_this.toastPackage.toastId); });
        };
        ToastNoAnimation.prototype.tapToast = function () {
            if (this.state === 'removed') {
                return;
            }
            this.toastPackage.triggerTap();
            if (this.options.tapToDismiss) {
                this.remove();
            }
        };
        ToastNoAnimation.prototype.stickAround = function () {
            if (this.state === 'removed') {
                return;
            }
            clearTimeout(this.timeout);
            this.options.timeOut = 0;
            this.hideTime = 0;
            // disable progressBar
            clearInterval(this.intervalId);
            this.width = 0;
        };
        ToastNoAnimation.prototype.delayedHideToast = function () {
            var _this = this;
            if ((this.options.disableTimeOut === true || this.options.disableTimeOut === 'extendedTimeOut') ||
                this.options.extendedTimeOut === 0 ||
                this.state === 'removed') {
                return;
            }
            this.timeout = setTimeout(function () { return _this.remove(); }, this.options.extendedTimeOut);
            this.options.timeOut = this.options.extendedTimeOut;
            this.hideTime = new Date().getTime() + (this.options.timeOut || 0);
            this.width = -1;
            if (this.options.progressBar) {
                this.intervalId = setInterval(function () { return _this.updateProgress(); }, 10);
            }
        };
        return ToastNoAnimation;
    }());
    ToastNoAnimation.decorators = [
        { type: i0.Component, args: [{
                    selector: '[toast-component]',
                    template: "\n  <button *ngIf=\"options.closeButton\" (click)=\"remove()\" class=\"toast-close-button\" aria-label=\"Close\">\n    <span aria-hidden=\"true\">&times;</span>\n  </button>\n  <div *ngIf=\"title\" [class]=\"options.titleClass\" [attr.aria-label]=\"title\">\n    {{ title }} <ng-container *ngIf=\"duplicatesCount\">[{{ duplicatesCount + 1 }}]</ng-container>\n  </div>\n  <div *ngIf=\"message && options.enableHtml\" role=\"alert\" aria-live=\"polite\"\n    [class]=\"options.messageClass\" [innerHTML]=\"message\">\n  </div>\n  <div *ngIf=\"message && !options.enableHtml\" role=\"alert\" aria-live=\"polite\"\n    [class]=\"options.messageClass\" [attr.aria-label]=\"message\">\n    {{ message }}\n  </div>\n  <div *ngIf=\"options.progressBar\">\n    <div class=\"toast-progress\" [style.width]=\"width + '%'\"></div>\n  </div>\n  "
                },] }
    ];
    ToastNoAnimation.ctorParameters = function () { return [
        { type: ToastrService },
        { type: ToastPackage },
        { type: i0.ApplicationRef }
    ]; };
    ToastNoAnimation.propDecorators = {
        toastClasses: [{ type: i0.HostBinding, args: ['class',] }],
        displayStyle: [{ type: i0.HostBinding, args: ['style.display',] }],
        tapToast: [{ type: i0.HostListener, args: ['click',] }],
        stickAround: [{ type: i0.HostListener, args: ['mouseenter',] }],
        delayedHideToast: [{ type: i0.HostListener, args: ['mouseleave',] }]
    };
    var DefaultNoAnimationsGlobalConfig = Object.assign(Object.assign({}, DefaultNoComponentGlobalConfig), { toastComponent: ToastNoAnimation });
    var ToastNoAnimationModule = /** @class */ (function () {
        function ToastNoAnimationModule() {
        }
        ToastNoAnimationModule.forRoot = function (config) {
            if (config === void 0) { config = {}; }
            return {
                ngModule: ToastNoAnimationModule,
                providers: [
                    {
                        provide: TOAST_CONFIG,
                        useValue: {
                            default: DefaultNoAnimationsGlobalConfig,
                            config: config,
                        },
                    },
                ],
            };
        };
        return ToastNoAnimationModule;
    }());
    ToastNoAnimationModule.decorators = [
        { type: i0.NgModule, args: [{
                    imports: [i1.CommonModule],
                    declarations: [ToastNoAnimation],
                    exports: [ToastNoAnimation],
                    entryComponents: [ToastNoAnimation],
                },] }
    ];

    /**
     * Generated bundle index. Do not edit.
     */

    exports.BasePortalHost = BasePortalHost;
    exports.ComponentPortal = ComponentPortal;
    exports.DefaultGlobalConfig = DefaultGlobalConfig;
    exports.DefaultNoAnimationsGlobalConfig = DefaultNoAnimationsGlobalConfig;
    exports.DefaultNoComponentGlobalConfig = DefaultNoComponentGlobalConfig;
    exports.Overlay = Overlay;
    exports.OverlayContainer = OverlayContainer;
    exports.OverlayRef = OverlayRef;
    exports.TOAST_CONFIG = TOAST_CONFIG;
    exports.Toast = Toast;
    exports.ToastContainerDirective = ToastContainerDirective;
    exports.ToastContainerModule = ToastContainerModule;
    exports.ToastInjector = ToastInjector;
    exports.ToastNoAnimation = ToastNoAnimation;
    exports.ToastNoAnimationModule = ToastNoAnimationModule;
    exports.ToastPackage = ToastPackage;
    exports.ToastRef = ToastRef;
    exports.ToastrComponentlessModule = ToastrComponentlessModule;
    exports.ToastrModule = ToastrModule;
    exports.ToastrService = ToastrService;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=ngx-toastr.umd.js.map
