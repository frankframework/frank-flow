/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * @publicApi
 */
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["DECORATOR_ARG_NOT_LITERAL"] = 1001] = "DECORATOR_ARG_NOT_LITERAL";
    ErrorCode[ErrorCode["DECORATOR_ARITY_WRONG"] = 1002] = "DECORATOR_ARITY_WRONG";
    ErrorCode[ErrorCode["DECORATOR_NOT_CALLED"] = 1003] = "DECORATOR_NOT_CALLED";
    ErrorCode[ErrorCode["DECORATOR_ON_ANONYMOUS_CLASS"] = 1004] = "DECORATOR_ON_ANONYMOUS_CLASS";
    ErrorCode[ErrorCode["DECORATOR_UNEXPECTED"] = 1005] = "DECORATOR_UNEXPECTED";
    /**
     * This error code indicates that there are incompatible decorators on a type or a class field.
     */
    ErrorCode[ErrorCode["DECORATOR_COLLISION"] = 1006] = "DECORATOR_COLLISION";
    ErrorCode[ErrorCode["VALUE_HAS_WRONG_TYPE"] = 1010] = "VALUE_HAS_WRONG_TYPE";
    ErrorCode[ErrorCode["VALUE_NOT_LITERAL"] = 1011] = "VALUE_NOT_LITERAL";
    ErrorCode[ErrorCode["COMPONENT_MISSING_TEMPLATE"] = 2001] = "COMPONENT_MISSING_TEMPLATE";
    ErrorCode[ErrorCode["PIPE_MISSING_NAME"] = 2002] = "PIPE_MISSING_NAME";
    ErrorCode[ErrorCode["PARAM_MISSING_TOKEN"] = 2003] = "PARAM_MISSING_TOKEN";
    ErrorCode[ErrorCode["DIRECTIVE_MISSING_SELECTOR"] = 2004] = "DIRECTIVE_MISSING_SELECTOR";
    /** Raised when an undecorated class is passed in as a provider to a module or a directive. */
    ErrorCode[ErrorCode["UNDECORATED_PROVIDER"] = 2005] = "UNDECORATED_PROVIDER";
    /**
     * Raised when a Directive inherits its constructor from a base class without an Angular
     * decorator.
     */
    ErrorCode[ErrorCode["DIRECTIVE_INHERITS_UNDECORATED_CTOR"] = 2006] = "DIRECTIVE_INHERITS_UNDECORATED_CTOR";
    /**
     * Raised when an undecorated class that is using Angular features
     * has been discovered.
     */
    ErrorCode[ErrorCode["UNDECORATED_CLASS_USING_ANGULAR_FEATURES"] = 2007] = "UNDECORATED_CLASS_USING_ANGULAR_FEATURES";
    /**
     * Raised when an component cannot resolve an external resource, such as a template or a style
     * sheet.
     */
    ErrorCode[ErrorCode["COMPONENT_RESOURCE_NOT_FOUND"] = 2008] = "COMPONENT_RESOURCE_NOT_FOUND";
    /**
     * Raised when a component uses `ShadowDom` view encapsulation, but its selector
     * does not match the shadow DOM tag name requirements.
     */
    ErrorCode[ErrorCode["COMPONENT_INVALID_SHADOW_DOM_SELECTOR"] = 2009] = "COMPONENT_INVALID_SHADOW_DOM_SELECTOR";
    ErrorCode[ErrorCode["SYMBOL_NOT_EXPORTED"] = 3001] = "SYMBOL_NOT_EXPORTED";
    ErrorCode[ErrorCode["SYMBOL_EXPORTED_UNDER_DIFFERENT_NAME"] = 3002] = "SYMBOL_EXPORTED_UNDER_DIFFERENT_NAME";
    /**
     * Raised when a relationship between directives and/or pipes would cause a cyclic import to be
     * created that cannot be handled, such as in partial compilation mode.
     */
    ErrorCode[ErrorCode["IMPORT_CYCLE_DETECTED"] = 3003] = "IMPORT_CYCLE_DETECTED";
    ErrorCode[ErrorCode["CONFIG_FLAT_MODULE_NO_INDEX"] = 4001] = "CONFIG_FLAT_MODULE_NO_INDEX";
    ErrorCode[ErrorCode["CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK"] = 4002] = "CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK";
    /**
     * Raised when a host expression has a parse error, such as a host listener or host binding
     * expression containing a pipe.
     */
    ErrorCode[ErrorCode["HOST_BINDING_PARSE_ERROR"] = 5001] = "HOST_BINDING_PARSE_ERROR";
    /**
     * Raised when the compiler cannot parse a component's template.
     */
    ErrorCode[ErrorCode["TEMPLATE_PARSE_ERROR"] = 5002] = "TEMPLATE_PARSE_ERROR";
    /**
     * Raised when an NgModule contains an invalid reference in `declarations`.
     */
    ErrorCode[ErrorCode["NGMODULE_INVALID_DECLARATION"] = 6001] = "NGMODULE_INVALID_DECLARATION";
    /**
     * Raised when an NgModule contains an invalid type in `imports`.
     */
    ErrorCode[ErrorCode["NGMODULE_INVALID_IMPORT"] = 6002] = "NGMODULE_INVALID_IMPORT";
    /**
     * Raised when an NgModule contains an invalid type in `exports`.
     */
    ErrorCode[ErrorCode["NGMODULE_INVALID_EXPORT"] = 6003] = "NGMODULE_INVALID_EXPORT";
    /**
     * Raised when an NgModule contains a type in `exports` which is neither in `declarations` nor
     * otherwise imported.
     */
    ErrorCode[ErrorCode["NGMODULE_INVALID_REEXPORT"] = 6004] = "NGMODULE_INVALID_REEXPORT";
    /**
     * Raised when a `ModuleWithProviders` with a missing
     * generic type argument is passed into an `NgModule`.
     */
    ErrorCode[ErrorCode["NGMODULE_MODULE_WITH_PROVIDERS_MISSING_GENERIC"] = 6005] = "NGMODULE_MODULE_WITH_PROVIDERS_MISSING_GENERIC";
    /**
     * Raised when an NgModule exports multiple directives/pipes of the same name and the compiler
     * attempts to generate private re-exports within the NgModule file.
     */
    ErrorCode[ErrorCode["NGMODULE_REEXPORT_NAME_COLLISION"] = 6006] = "NGMODULE_REEXPORT_NAME_COLLISION";
    /**
     * Raised when a directive/pipe is part of the declarations of two or more NgModules.
     */
    ErrorCode[ErrorCode["NGMODULE_DECLARATION_NOT_UNIQUE"] = 6007] = "NGMODULE_DECLARATION_NOT_UNIQUE";
    /**
     * Not actually raised by the compiler, but reserved for documentation of a View Engine error when
     * a View Engine build depends on an Ivy-compiled NgModule.
     */
    ErrorCode[ErrorCode["NGMODULE_VE_DEPENDENCY_ON_IVY_LIB"] = 6999] = "NGMODULE_VE_DEPENDENCY_ON_IVY_LIB";
    /**
     * An element name failed validation against the DOM schema.
     */
    ErrorCode[ErrorCode["SCHEMA_INVALID_ELEMENT"] = 8001] = "SCHEMA_INVALID_ELEMENT";
    /**
     * An element's attribute name failed validation against the DOM schema.
     */
    ErrorCode[ErrorCode["SCHEMA_INVALID_ATTRIBUTE"] = 8002] = "SCHEMA_INVALID_ATTRIBUTE";
    /**
     * No matching directive was found for a `#ref="target"` expression.
     */
    ErrorCode[ErrorCode["MISSING_REFERENCE_TARGET"] = 8003] = "MISSING_REFERENCE_TARGET";
    /**
     * No matching pipe was found for a
     */
    ErrorCode[ErrorCode["MISSING_PIPE"] = 8004] = "MISSING_PIPE";
    /**
     * The left-hand side of an assignment expression was a template variable. Effectively, the
     * template looked like:
     *
     * ```
     * <ng-template let-something>
     *   <button (click)="something = ...">...</button>
     * </ng-template>
     * ```
     *
     * Template variables are read-only.
     */
    ErrorCode[ErrorCode["WRITE_TO_READ_ONLY_VARIABLE"] = 8005] = "WRITE_TO_READ_ONLY_VARIABLE";
    /**
     * A template variable was declared twice. For example:
     *
     * ```html
     * <div *ngFor="let i of items; let i = index">
     * </div>
     * ```
     */
    ErrorCode[ErrorCode["DUPLICATE_VARIABLE_DECLARATION"] = 8006] = "DUPLICATE_VARIABLE_DECLARATION";
    /**
     * The template type-checking engine would need to generate an inline type check block for a
     * component, but the current type-checking environment doesn't support it.
     */
    ErrorCode[ErrorCode["INLINE_TCB_REQUIRED"] = 8900] = "INLINE_TCB_REQUIRED";
    /**
     * The template type-checking engine would need to generate an inline type constructor for a
     * directive or component, but the current type-checking environment doesn't support it.
     */
    ErrorCode[ErrorCode["INLINE_TYPE_CTOR_REQUIRED"] = 8901] = "INLINE_TYPE_CTOR_REQUIRED";
    /**
     * An injectable already has a `ɵprov` property.
     */
    ErrorCode[ErrorCode["INJECTABLE_DUPLICATE_PROV"] = 9001] = "INJECTABLE_DUPLICATE_PROV";
    // 10XXX error codes are reserved for diagnostics with categories other than
    // `ts.DiagnosticCategory.Error`. These diagnostics are generated by the compiler when configured
    // to do so by a tool such as the Language Service, or by the Language Service itself.
    /**
     * Suggest users to enable `strictTemplates` to make use of full capabilities
     * provided by Angular language service.
     */
    ErrorCode[ErrorCode["SUGGEST_STRICT_TEMPLATES"] = 10001] = "SUGGEST_STRICT_TEMPLATES";
    /**
     * Indicates that a particular structural directive provides advanced type narrowing
     * functionality, but the current template type-checking configuration does not allow its usage in
     * type inference.
     */
    ErrorCode[ErrorCode["SUGGEST_SUBOPTIMAL_TYPE_INFERENCE"] = 10002] = "SUGGEST_SUBOPTIMAL_TYPE_INFERENCE";
})(ErrorCode || (ErrorCode = {}));
/**
 * @internal
 * Base URL for the error details page.
 * Keep this value in sync with a similar const in
 * `packages/core/src/render3/error_code.ts`.
 */
export const ERROR_DETAILS_PAGE_BASE_URL = 'https://angular.io/errors';
/**
 * @internal
 * Contains a set of error messages that have detailed guides at angular.io.
 * Full list of available error guides can be found at https://angular.io/errors
 */
export const COMPILER_ERRORS_WITH_GUIDES = new Set([
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    ErrorCode.IMPORT_CYCLE_DETECTED,
    ErrorCode.PARAM_MISSING_TOKEN,
    ErrorCode.SCHEMA_INVALID_ELEMENT,
    ErrorCode.SCHEMA_INVALID_ATTRIBUTE,
    ErrorCode.MISSING_REFERENCE_TARGET,
    ErrorCode.COMPONENT_INVALID_SHADOW_DOM_SELECTOR,
]);
/**
 * @internal
 */
export function ngErrorCode(code) {
    return parseInt('-99' + code);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3JfY29kZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvZGlhZ25vc3RpY3Mvc3JjL2Vycm9yX2NvZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUg7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxTQThMWDtBQTlMRCxXQUFZLFNBQVM7SUFDbkIsc0ZBQWdDLENBQUE7SUFDaEMsOEVBQTRCLENBQUE7SUFDNUIsNEVBQTJCLENBQUE7SUFDM0IsNEZBQW1DLENBQUE7SUFDbkMsNEVBQTJCLENBQUE7SUFFM0I7O09BRUc7SUFDSCwwRUFBMEIsQ0FBQTtJQUUxQiw0RUFBMkIsQ0FBQTtJQUMzQixzRUFBd0IsQ0FBQTtJQUV4Qix3RkFBaUMsQ0FBQTtJQUNqQyxzRUFBd0IsQ0FBQTtJQUN4QiwwRUFBMEIsQ0FBQTtJQUMxQix3RkFBaUMsQ0FBQTtJQUVqQyw4RkFBOEY7SUFDOUYsNEVBQTJCLENBQUE7SUFFM0I7OztPQUdHO0lBQ0gsMEdBQTBDLENBQUE7SUFFMUM7OztPQUdHO0lBQ0gsb0hBQStDLENBQUE7SUFFL0M7OztPQUdHO0lBQ0gsNEZBQW1DLENBQUE7SUFFbkM7OztPQUdHO0lBQ0gsOEdBQTRDLENBQUE7SUFFNUMsMEVBQTBCLENBQUE7SUFDMUIsNEdBQTJDLENBQUE7SUFDM0M7OztPQUdHO0lBQ0gsOEVBQTRCLENBQUE7SUFFNUIsMEZBQWtDLENBQUE7SUFDbEMsa0pBQThELENBQUE7SUFFOUQ7OztPQUdHO0lBQ0gsb0ZBQStCLENBQUE7SUFFL0I7O09BRUc7SUFDSCw0RUFBMkIsQ0FBQTtJQUUzQjs7T0FFRztJQUNILDRGQUFtQyxDQUFBO0lBRW5DOztPQUVHO0lBQ0gsa0ZBQThCLENBQUE7SUFFOUI7O09BRUc7SUFDSCxrRkFBOEIsQ0FBQTtJQUU5Qjs7O09BR0c7SUFDSCxzRkFBZ0MsQ0FBQTtJQUVoQzs7O09BR0c7SUFDSCxnSUFBcUQsQ0FBQTtJQUVyRDs7O09BR0c7SUFDSCxvR0FBdUMsQ0FBQTtJQUV2Qzs7T0FFRztJQUNILGtHQUFzQyxDQUFBO0lBRXRDOzs7T0FHRztJQUNILHNHQUF3QyxDQUFBO0lBRXhDOztPQUVHO0lBQ0gsZ0ZBQTZCLENBQUE7SUFFN0I7O09BRUc7SUFDSCxvRkFBK0IsQ0FBQTtJQUUvQjs7T0FFRztJQUNILG9GQUErQixDQUFBO0lBRS9COztPQUVHO0lBQ0gsNERBQW1CLENBQUE7SUFFbkI7Ozs7Ozs7Ozs7O09BV0c7SUFDSCwwRkFBa0MsQ0FBQTtJQUVsQzs7Ozs7OztPQU9HO0lBQ0gsZ0dBQXFDLENBQUE7SUFFckM7OztPQUdHO0lBQ0gsMEVBQTBCLENBQUE7SUFFMUI7OztPQUdHO0lBQ0gsc0ZBQWdDLENBQUE7SUFFaEM7O09BRUc7SUFDSCxzRkFBZ0MsQ0FBQTtJQUVoQyw0RUFBNEU7SUFDNUUsaUdBQWlHO0lBQ2pHLHNGQUFzRjtJQUV0Rjs7O09BR0c7SUFDSCxxRkFBZ0MsQ0FBQTtJQUVoQzs7OztPQUlHO0lBQ0gsdUdBQXlDLENBQUE7QUFDM0MsQ0FBQyxFQTlMVyxTQUFTLEtBQVQsU0FBUyxRQThMcEI7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxNQUFNLDJCQUEyQixHQUFHLDJCQUEyQixDQUFDO0FBRXZFOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUNqRCxTQUFTLENBQUMseUJBQXlCO0lBQ25DLFNBQVMsQ0FBQyxxQkFBcUI7SUFDL0IsU0FBUyxDQUFDLG1CQUFtQjtJQUM3QixTQUFTLENBQUMsc0JBQXNCO0lBQ2hDLFNBQVMsQ0FBQyx3QkFBd0I7SUFDbEMsU0FBUyxDQUFDLHdCQUF3QjtJQUNsQyxTQUFTLENBQUMscUNBQXFDO0NBQ2hELENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxJQUFlO0lBQ3pDLE9BQU8sUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQztBQUNoQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZW51bSBFcnJvckNvZGUge1xuICBERUNPUkFUT1JfQVJHX05PVF9MSVRFUkFMID0gMTAwMSxcbiAgREVDT1JBVE9SX0FSSVRZX1dST05HID0gMTAwMixcbiAgREVDT1JBVE9SX05PVF9DQUxMRUQgPSAxMDAzLFxuICBERUNPUkFUT1JfT05fQU5PTllNT1VTX0NMQVNTID0gMTAwNCxcbiAgREVDT1JBVE9SX1VORVhQRUNURUQgPSAxMDA1LFxuXG4gIC8qKlxuICAgKiBUaGlzIGVycm9yIGNvZGUgaW5kaWNhdGVzIHRoYXQgdGhlcmUgYXJlIGluY29tcGF0aWJsZSBkZWNvcmF0b3JzIG9uIGEgdHlwZSBvciBhIGNsYXNzIGZpZWxkLlxuICAgKi9cbiAgREVDT1JBVE9SX0NPTExJU0lPTiA9IDEwMDYsXG5cbiAgVkFMVUVfSEFTX1dST05HX1RZUEUgPSAxMDEwLFxuICBWQUxVRV9OT1RfTElURVJBTCA9IDEwMTEsXG5cbiAgQ09NUE9ORU5UX01JU1NJTkdfVEVNUExBVEUgPSAyMDAxLFxuICBQSVBFX01JU1NJTkdfTkFNRSA9IDIwMDIsXG4gIFBBUkFNX01JU1NJTkdfVE9LRU4gPSAyMDAzLFxuICBESVJFQ1RJVkVfTUlTU0lOR19TRUxFQ1RPUiA9IDIwMDQsXG5cbiAgLyoqIFJhaXNlZCB3aGVuIGFuIHVuZGVjb3JhdGVkIGNsYXNzIGlzIHBhc3NlZCBpbiBhcyBhIHByb3ZpZGVyIHRvIGEgbW9kdWxlIG9yIGEgZGlyZWN0aXZlLiAqL1xuICBVTkRFQ09SQVRFRF9QUk9WSURFUiA9IDIwMDUsXG5cbiAgLyoqXG4gICAqIFJhaXNlZCB3aGVuIGEgRGlyZWN0aXZlIGluaGVyaXRzIGl0cyBjb25zdHJ1Y3RvciBmcm9tIGEgYmFzZSBjbGFzcyB3aXRob3V0IGFuIEFuZ3VsYXJcbiAgICogZGVjb3JhdG9yLlxuICAgKi9cbiAgRElSRUNUSVZFX0lOSEVSSVRTX1VOREVDT1JBVEVEX0NUT1IgPSAyMDA2LFxuXG4gIC8qKlxuICAgKiBSYWlzZWQgd2hlbiBhbiB1bmRlY29yYXRlZCBjbGFzcyB0aGF0IGlzIHVzaW5nIEFuZ3VsYXIgZmVhdHVyZXNcbiAgICogaGFzIGJlZW4gZGlzY292ZXJlZC5cbiAgICovXG4gIFVOREVDT1JBVEVEX0NMQVNTX1VTSU5HX0FOR1VMQVJfRkVBVFVSRVMgPSAyMDA3LFxuXG4gIC8qKlxuICAgKiBSYWlzZWQgd2hlbiBhbiBjb21wb25lbnQgY2Fubm90IHJlc29sdmUgYW4gZXh0ZXJuYWwgcmVzb3VyY2UsIHN1Y2ggYXMgYSB0ZW1wbGF0ZSBvciBhIHN0eWxlXG4gICAqIHNoZWV0LlxuICAgKi9cbiAgQ09NUE9ORU5UX1JFU09VUkNFX05PVF9GT1VORCA9IDIwMDgsXG5cbiAgLyoqXG4gICAqIFJhaXNlZCB3aGVuIGEgY29tcG9uZW50IHVzZXMgYFNoYWRvd0RvbWAgdmlldyBlbmNhcHN1bGF0aW9uLCBidXQgaXRzIHNlbGVjdG9yXG4gICAqIGRvZXMgbm90IG1hdGNoIHRoZSBzaGFkb3cgRE9NIHRhZyBuYW1lIHJlcXVpcmVtZW50cy5cbiAgICovXG4gIENPTVBPTkVOVF9JTlZBTElEX1NIQURPV19ET01fU0VMRUNUT1IgPSAyMDA5LFxuXG4gIFNZTUJPTF9OT1RfRVhQT1JURUQgPSAzMDAxLFxuICBTWU1CT0xfRVhQT1JURURfVU5ERVJfRElGRkVSRU5UX05BTUUgPSAzMDAyLFxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYSByZWxhdGlvbnNoaXAgYmV0d2VlbiBkaXJlY3RpdmVzIGFuZC9vciBwaXBlcyB3b3VsZCBjYXVzZSBhIGN5Y2xpYyBpbXBvcnQgdG8gYmVcbiAgICogY3JlYXRlZCB0aGF0IGNhbm5vdCBiZSBoYW5kbGVkLCBzdWNoIGFzIGluIHBhcnRpYWwgY29tcGlsYXRpb24gbW9kZS5cbiAgICovXG4gIElNUE9SVF9DWUNMRV9ERVRFQ1RFRCA9IDMwMDMsXG5cbiAgQ09ORklHX0ZMQVRfTU9EVUxFX05PX0lOREVYID0gNDAwMSxcbiAgQ09ORklHX1NUUklDVF9URU1QTEFURVNfSU1QTElFU19GVUxMX1RFTVBMQVRFX1RZUEVDSEVDSyA9IDQwMDIsXG5cbiAgLyoqXG4gICAqIFJhaXNlZCB3aGVuIGEgaG9zdCBleHByZXNzaW9uIGhhcyBhIHBhcnNlIGVycm9yLCBzdWNoIGFzIGEgaG9zdCBsaXN0ZW5lciBvciBob3N0IGJpbmRpbmdcbiAgICogZXhwcmVzc2lvbiBjb250YWluaW5nIGEgcGlwZS5cbiAgICovXG4gIEhPU1RfQklORElOR19QQVJTRV9FUlJPUiA9IDUwMDEsXG5cbiAgLyoqXG4gICAqIFJhaXNlZCB3aGVuIHRoZSBjb21waWxlciBjYW5ub3QgcGFyc2UgYSBjb21wb25lbnQncyB0ZW1wbGF0ZS5cbiAgICovXG4gIFRFTVBMQVRFX1BBUlNFX0VSUk9SID0gNTAwMixcblxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYW4gTmdNb2R1bGUgY29udGFpbnMgYW4gaW52YWxpZCByZWZlcmVuY2UgaW4gYGRlY2xhcmF0aW9uc2AuXG4gICAqL1xuICBOR01PRFVMRV9JTlZBTElEX0RFQ0xBUkFUSU9OID0gNjAwMSxcblxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYW4gTmdNb2R1bGUgY29udGFpbnMgYW4gaW52YWxpZCB0eXBlIGluIGBpbXBvcnRzYC5cbiAgICovXG4gIE5HTU9EVUxFX0lOVkFMSURfSU1QT1JUID0gNjAwMixcblxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYW4gTmdNb2R1bGUgY29udGFpbnMgYW4gaW52YWxpZCB0eXBlIGluIGBleHBvcnRzYC5cbiAgICovXG4gIE5HTU9EVUxFX0lOVkFMSURfRVhQT1JUID0gNjAwMyxcblxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYW4gTmdNb2R1bGUgY29udGFpbnMgYSB0eXBlIGluIGBleHBvcnRzYCB3aGljaCBpcyBuZWl0aGVyIGluIGBkZWNsYXJhdGlvbnNgIG5vclxuICAgKiBvdGhlcndpc2UgaW1wb3J0ZWQuXG4gICAqL1xuICBOR01PRFVMRV9JTlZBTElEX1JFRVhQT1JUID0gNjAwNCxcblxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYSBgTW9kdWxlV2l0aFByb3ZpZGVyc2Agd2l0aCBhIG1pc3NpbmdcbiAgICogZ2VuZXJpYyB0eXBlIGFyZ3VtZW50IGlzIHBhc3NlZCBpbnRvIGFuIGBOZ01vZHVsZWAuXG4gICAqL1xuICBOR01PRFVMRV9NT0RVTEVfV0lUSF9QUk9WSURFUlNfTUlTU0lOR19HRU5FUklDID0gNjAwNSxcblxuICAvKipcbiAgICogUmFpc2VkIHdoZW4gYW4gTmdNb2R1bGUgZXhwb3J0cyBtdWx0aXBsZSBkaXJlY3RpdmVzL3BpcGVzIG9mIHRoZSBzYW1lIG5hbWUgYW5kIHRoZSBjb21waWxlclxuICAgKiBhdHRlbXB0cyB0byBnZW5lcmF0ZSBwcml2YXRlIHJlLWV4cG9ydHMgd2l0aGluIHRoZSBOZ01vZHVsZSBmaWxlLlxuICAgKi9cbiAgTkdNT0RVTEVfUkVFWFBPUlRfTkFNRV9DT0xMSVNJT04gPSA2MDA2LFxuXG4gIC8qKlxuICAgKiBSYWlzZWQgd2hlbiBhIGRpcmVjdGl2ZS9waXBlIGlzIHBhcnQgb2YgdGhlIGRlY2xhcmF0aW9ucyBvZiB0d28gb3IgbW9yZSBOZ01vZHVsZXMuXG4gICAqL1xuICBOR01PRFVMRV9ERUNMQVJBVElPTl9OT1RfVU5JUVVFID0gNjAwNyxcblxuICAvKipcbiAgICogTm90IGFjdHVhbGx5IHJhaXNlZCBieSB0aGUgY29tcGlsZXIsIGJ1dCByZXNlcnZlZCBmb3IgZG9jdW1lbnRhdGlvbiBvZiBhIFZpZXcgRW5naW5lIGVycm9yIHdoZW5cbiAgICogYSBWaWV3IEVuZ2luZSBidWlsZCBkZXBlbmRzIG9uIGFuIEl2eS1jb21waWxlZCBOZ01vZHVsZS5cbiAgICovXG4gIE5HTU9EVUxFX1ZFX0RFUEVOREVOQ1lfT05fSVZZX0xJQiA9IDY5OTksXG5cbiAgLyoqXG4gICAqIEFuIGVsZW1lbnQgbmFtZSBmYWlsZWQgdmFsaWRhdGlvbiBhZ2FpbnN0IHRoZSBET00gc2NoZW1hLlxuICAgKi9cbiAgU0NIRU1BX0lOVkFMSURfRUxFTUVOVCA9IDgwMDEsXG5cbiAgLyoqXG4gICAqIEFuIGVsZW1lbnQncyBhdHRyaWJ1dGUgbmFtZSBmYWlsZWQgdmFsaWRhdGlvbiBhZ2FpbnN0IHRoZSBET00gc2NoZW1hLlxuICAgKi9cbiAgU0NIRU1BX0lOVkFMSURfQVRUUklCVVRFID0gODAwMixcblxuICAvKipcbiAgICogTm8gbWF0Y2hpbmcgZGlyZWN0aXZlIHdhcyBmb3VuZCBmb3IgYSBgI3JlZj1cInRhcmdldFwiYCBleHByZXNzaW9uLlxuICAgKi9cbiAgTUlTU0lOR19SRUZFUkVOQ0VfVEFSR0VUID0gODAwMyxcblxuICAvKipcbiAgICogTm8gbWF0Y2hpbmcgcGlwZSB3YXMgZm91bmQgZm9yIGFcbiAgICovXG4gIE1JU1NJTkdfUElQRSA9IDgwMDQsXG5cbiAgLyoqXG4gICAqIFRoZSBsZWZ0LWhhbmQgc2lkZSBvZiBhbiBhc3NpZ25tZW50IGV4cHJlc3Npb24gd2FzIGEgdGVtcGxhdGUgdmFyaWFibGUuIEVmZmVjdGl2ZWx5LCB0aGVcbiAgICogdGVtcGxhdGUgbG9va2VkIGxpa2U6XG4gICAqXG4gICAqIGBgYFxuICAgKiA8bmctdGVtcGxhdGUgbGV0LXNvbWV0aGluZz5cbiAgICogICA8YnV0dG9uIChjbGljayk9XCJzb21ldGhpbmcgPSAuLi5cIj4uLi48L2J1dHRvbj5cbiAgICogPC9uZy10ZW1wbGF0ZT5cbiAgICogYGBgXG4gICAqXG4gICAqIFRlbXBsYXRlIHZhcmlhYmxlcyBhcmUgcmVhZC1vbmx5LlxuICAgKi9cbiAgV1JJVEVfVE9fUkVBRF9PTkxZX1ZBUklBQkxFID0gODAwNSxcblxuICAvKipcbiAgICogQSB0ZW1wbGF0ZSB2YXJpYWJsZSB3YXMgZGVjbGFyZWQgdHdpY2UuIEZvciBleGFtcGxlOlxuICAgKlxuICAgKiBgYGBodG1sXG4gICAqIDxkaXYgKm5nRm9yPVwibGV0IGkgb2YgaXRlbXM7IGxldCBpID0gaW5kZXhcIj5cbiAgICogPC9kaXY+XG4gICAqIGBgYFxuICAgKi9cbiAgRFVQTElDQVRFX1ZBUklBQkxFX0RFQ0xBUkFUSU9OID0gODAwNixcblxuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgZW5naW5lIHdvdWxkIG5lZWQgdG8gZ2VuZXJhdGUgYW4gaW5saW5lIHR5cGUgY2hlY2sgYmxvY2sgZm9yIGFcbiAgICogY29tcG9uZW50LCBidXQgdGhlIGN1cnJlbnQgdHlwZS1jaGVja2luZyBlbnZpcm9ubWVudCBkb2Vzbid0IHN1cHBvcnQgaXQuXG4gICAqL1xuICBJTkxJTkVfVENCX1JFUVVJUkVEID0gODkwMCxcblxuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgZW5naW5lIHdvdWxkIG5lZWQgdG8gZ2VuZXJhdGUgYW4gaW5saW5lIHR5cGUgY29uc3RydWN0b3IgZm9yIGFcbiAgICogZGlyZWN0aXZlIG9yIGNvbXBvbmVudCwgYnV0IHRoZSBjdXJyZW50IHR5cGUtY2hlY2tpbmcgZW52aXJvbm1lbnQgZG9lc24ndCBzdXBwb3J0IGl0LlxuICAgKi9cbiAgSU5MSU5FX1RZUEVfQ1RPUl9SRVFVSVJFRCA9IDg5MDEsXG5cbiAgLyoqXG4gICAqIEFuIGluamVjdGFibGUgYWxyZWFkeSBoYXMgYSBgybVwcm92YCBwcm9wZXJ0eS5cbiAgICovXG4gIElOSkVDVEFCTEVfRFVQTElDQVRFX1BST1YgPSA5MDAxLFxuXG4gIC8vIDEwWFhYIGVycm9yIGNvZGVzIGFyZSByZXNlcnZlZCBmb3IgZGlhZ25vc3RpY3Mgd2l0aCBjYXRlZ29yaWVzIG90aGVyIHRoYW5cbiAgLy8gYHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcmAuIFRoZXNlIGRpYWdub3N0aWNzIGFyZSBnZW5lcmF0ZWQgYnkgdGhlIGNvbXBpbGVyIHdoZW4gY29uZmlndXJlZFxuICAvLyB0byBkbyBzbyBieSBhIHRvb2wgc3VjaCBhcyB0aGUgTGFuZ3VhZ2UgU2VydmljZSwgb3IgYnkgdGhlIExhbmd1YWdlIFNlcnZpY2UgaXRzZWxmLlxuXG4gIC8qKlxuICAgKiBTdWdnZXN0IHVzZXJzIHRvIGVuYWJsZSBgc3RyaWN0VGVtcGxhdGVzYCB0byBtYWtlIHVzZSBvZiBmdWxsIGNhcGFiaWxpdGllc1xuICAgKiBwcm92aWRlZCBieSBBbmd1bGFyIGxhbmd1YWdlIHNlcnZpY2UuXG4gICAqL1xuICBTVUdHRVNUX1NUUklDVF9URU1QTEFURVMgPSAxMDAwMSxcblxuICAvKipcbiAgICogSW5kaWNhdGVzIHRoYXQgYSBwYXJ0aWN1bGFyIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHByb3ZpZGVzIGFkdmFuY2VkIHR5cGUgbmFycm93aW5nXG4gICAqIGZ1bmN0aW9uYWxpdHksIGJ1dCB0aGUgY3VycmVudCB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIGNvbmZpZ3VyYXRpb24gZG9lcyBub3QgYWxsb3cgaXRzIHVzYWdlIGluXG4gICAqIHR5cGUgaW5mZXJlbmNlLlxuICAgKi9cbiAgU1VHR0VTVF9TVUJPUFRJTUFMX1RZUEVfSU5GRVJFTkNFID0gMTAwMDIsXG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKiBCYXNlIFVSTCBmb3IgdGhlIGVycm9yIGRldGFpbHMgcGFnZS5cbiAqIEtlZXAgdGhpcyB2YWx1ZSBpbiBzeW5jIHdpdGggYSBzaW1pbGFyIGNvbnN0IGluXG4gKiBgcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9lcnJvcl9jb2RlLnRzYC5cbiAqL1xuZXhwb3J0IGNvbnN0IEVSUk9SX0RFVEFJTFNfUEFHRV9CQVNFX1VSTCA9ICdodHRwczovL2FuZ3VsYXIuaW8vZXJyb3JzJztcblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqIENvbnRhaW5zIGEgc2V0IG9mIGVycm9yIG1lc3NhZ2VzIHRoYXQgaGF2ZSBkZXRhaWxlZCBndWlkZXMgYXQgYW5ndWxhci5pby5cbiAqIEZ1bGwgbGlzdCBvZiBhdmFpbGFibGUgZXJyb3IgZ3VpZGVzIGNhbiBiZSBmb3VuZCBhdCBodHRwczovL2FuZ3VsYXIuaW8vZXJyb3JzXG4gKi9cbmV4cG9ydCBjb25zdCBDT01QSUxFUl9FUlJPUlNfV0lUSF9HVUlERVMgPSBuZXcgU2V0KFtcbiAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUkdfTk9UX0xJVEVSQUwsXG4gIEVycm9yQ29kZS5JTVBPUlRfQ1lDTEVfREVURUNURUQsXG4gIEVycm9yQ29kZS5QQVJBTV9NSVNTSU5HX1RPS0VOLFxuICBFcnJvckNvZGUuU0NIRU1BX0lOVkFMSURfRUxFTUVOVCxcbiAgRXJyb3JDb2RlLlNDSEVNQV9JTlZBTElEX0FUVFJJQlVURSxcbiAgRXJyb3JDb2RlLk1JU1NJTkdfUkVGRVJFTkNFX1RBUkdFVCxcbiAgRXJyb3JDb2RlLkNPTVBPTkVOVF9JTlZBTElEX1NIQURPV19ET01fU0VMRUNUT1IsXG5dKTtcblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5nRXJyb3JDb2RlKGNvZGU6IEVycm9yQ29kZSk6IG51bWJlciB7XG4gIHJldHVybiBwYXJzZUludCgnLTk5JyArIGNvZGUpO1xufVxuIl19