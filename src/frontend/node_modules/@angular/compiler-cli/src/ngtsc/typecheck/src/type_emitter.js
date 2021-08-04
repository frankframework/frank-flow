(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler-cli/src/ngtsc/typecheck/src/type_emitter", ["require", "exports", "typescript", "@angular/compiler-cli/src/ngtsc/imports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeEmitter = exports.canEmitType = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var ts = require("typescript");
    var imports_1 = require("@angular/compiler-cli/src/ngtsc/imports");
    var INELIGIBLE = {};
    /**
     * Determines whether the provided type can be emitted, which means that it can be safely emitted
     * into a different location.
     *
     * If this function returns true, a `TypeEmitter` should be able to succeed. Vice versa, if this
     * function returns false, then using the `TypeEmitter` should not be attempted as it is known to
     * fail.
     */
    function canEmitType(type, resolver) {
        return canEmitTypeWorker(type);
        function canEmitTypeWorker(type) {
            return visitNode(type) !== INELIGIBLE;
        }
        // To determine whether a type can be emitted, we have to recursively look through all type nodes.
        // If a type reference node is found at any position within the type and that type reference
        // cannot be emitted, then the `INELIGIBLE` constant is returned to stop the recursive walk as
        // the type as a whole cannot be emitted in that case. Otherwise, the result of visiting all child
        // nodes determines the result. If no ineligible type reference node is found then the walk
        // returns `undefined`, indicating that no type node was visited that could not be emitted.
        function visitNode(node) {
            // Emitting a type reference node in a different context requires that an import for the type
            // can be created. If a type reference node cannot be emitted, `INELIGIBLE` is returned to stop
            // the walk.
            if (ts.isTypeReferenceNode(node) && !canEmitTypeReference(node)) {
                return INELIGIBLE;
            }
            else {
                return ts.forEachChild(node, visitNode);
            }
        }
        function canEmitTypeReference(type) {
            var reference = resolver(type);
            // If the type could not be resolved, it can not be emitted.
            if (reference === null) {
                return false;
            }
            // If the type is a reference, consider the type to be eligible for emitting.
            if (reference instanceof imports_1.Reference) {
                return true;
            }
            // The type can be emitted if either it does not have any type arguments, or all of them can be
            // emitted.
            return type.typeArguments === undefined || type.typeArguments.every(canEmitTypeWorker);
        }
    }
    exports.canEmitType = canEmitType;
    /**
     * Given a `ts.TypeNode`, this class derives an equivalent `ts.TypeNode` that has been emitted into
     * a different context.
     *
     * For example, consider the following code:
     *
     * ```
     * import {NgIterable} from '@angular/core';
     *
     * class NgForOf<T, U extends NgIterable<T>> {}
     * ```
     *
     * Here, the generic type parameters `T` and `U` can be emitted into a different context, as the
     * type reference to `NgIterable` originates from an absolute module import so that it can be
     * emitted anywhere, using that same module import. The process of emitting translates the
     * `NgIterable` type reference to a type reference that is valid in the context in which it is
     * emitted, for example:
     *
     * ```
     * import * as i0 from '@angular/core';
     * import * as i1 from '@angular/common';
     *
     * const _ctor1: <T, U extends i0.NgIterable<T>>(o: Pick<i1.NgForOf<T, U>, 'ngForOf'>):
     * i1.NgForOf<T, U>;
     * ```
     *
     * Notice how the type reference for `NgIterable` has been translated into a qualified name,
     * referring to the namespace import that was created.
     */
    var TypeEmitter = /** @class */ (function () {
        function TypeEmitter(resolver, emitReference) {
            this.resolver = resolver;
            this.emitReference = emitReference;
        }
        TypeEmitter.prototype.emitType = function (type) {
            var _this = this;
            var typeReferenceTransformer = function (context) {
                var visitNode = function (node) {
                    if (ts.isTypeReferenceNode(node)) {
                        return _this.emitTypeReference(node);
                    }
                    else {
                        return ts.visitEachChild(node, visitNode, context);
                    }
                };
                return function (node) { return ts.visitNode(node, visitNode); };
            };
            return ts.transform(type, [typeReferenceTransformer]).transformed[0];
        };
        TypeEmitter.prototype.emitTypeReference = function (type) {
            var _this = this;
            // Determine the reference that the type corresponds with.
            var reference = this.resolver(type);
            if (reference === null) {
                throw new Error('Unable to emit an unresolved reference');
            }
            // Emit the type arguments, if any.
            var typeArguments = undefined;
            if (type.typeArguments !== undefined) {
                typeArguments = ts.createNodeArray(type.typeArguments.map(function (typeArg) { return _this.emitType(typeArg); }));
            }
            // Emit the type name.
            var typeName = type.typeName;
            if (reference instanceof imports_1.Reference) {
                var emittedType = this.emitReference(reference);
                if (!ts.isTypeReferenceNode(emittedType)) {
                    throw new Error("Expected TypeReferenceNode for emitted reference, got " + ts.SyntaxKind[emittedType.kind]);
                }
                typeName = emittedType.typeName;
            }
            return ts.updateTypeReferenceNode(type, typeName, typeArguments);
        };
        return TypeEmitter;
    }());
    exports.TypeEmitter = TypeEmitter;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9lbWl0dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy90eXBlY2hlY2svc3JjL3R5cGVfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwrQkFBaUM7SUFDakMsbUVBQXdDO0lBc0J4QyxJQUFNLFVBQVUsR0FBZSxFQUFnQixDQUFDO0lBRWhEOzs7Ozs7O09BT0c7SUFDSCxTQUFnQixXQUFXLENBQUMsSUFBaUIsRUFBRSxRQUErQjtRQUM1RSxPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9CLFNBQVMsaUJBQWlCLENBQUMsSUFBaUI7WUFDMUMsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssVUFBVSxDQUFDO1FBQ3hDLENBQUM7UUFFRCxrR0FBa0c7UUFDbEcsNEZBQTRGO1FBQzVGLDhGQUE4RjtRQUM5RixrR0FBa0c7UUFDbEcsMkZBQTJGO1FBQzNGLDJGQUEyRjtRQUMzRixTQUFTLFNBQVMsQ0FBQyxJQUFhO1lBQzlCLDZGQUE2RjtZQUM3RiwrRkFBK0Y7WUFDL0YsWUFBWTtZQUNaLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQy9ELE9BQU8sVUFBVSxDQUFDO2FBQ25CO2lCQUFNO2dCQUNMLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7YUFDekM7UUFDSCxDQUFDO1FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxJQUEwQjtZQUN0RCxJQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFakMsNERBQTREO1lBQzVELElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtnQkFDdEIsT0FBTyxL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IEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuXG4vKipcbiAqIEEgcmVzb2x2ZWQgdHlwZSByZWZlcmVuY2UgY2FuIGVpdGhlciBiZSBhIGBSZWZlcmVuY2VgLCB0aGUgb3JpZ2luYWwgYHRzLlR5cGVSZWZlcmVuY2VOb2RlYCBpdHNlbGZcbiAqIG9yIG51bGwuIEEgdmFsdWUgb2YgbnVsbCBpbmRpY2F0ZXMgdGhhdCBubyByZWZlcmVuY2UgY291bGQgYmUgcmVzb2x2ZWQgb3IgdGhhdCB0aGUgcmVmZXJlbmNlIGNhblxuICogbm90IGJlIGVtaXR0ZWQuXG4gKi9cbmV4cG9ydCB0eXBlIFJlc29sdmVkVHlwZVJlZmVyZW5jZSA9IFJlZmVyZW5jZXx0cy5UeXBlUmVmZXJlbmNlTm9kZXxudWxsO1xuXG4vKipcbiAqIEEgdHlwZSByZWZlcmVuY2UgcmVzb2x2ZXIgZnVuY3Rpb24gaXMgcmVzcG9uc2libGUgZm9yIGZpbmRpbmcgdGhlIGRlY2xhcmF0aW9uIG9mIHRoZSB0eXBlXG4gKiByZWZlcmVuY2UgYW5kIHZlcmlmeWluZyB3aGV0aGVyIGl0IGNhbiBiZSBlbWl0dGVkLlxuICovXG5leHBvcnQgdHlwZSBUeXBlUmVmZXJlbmNlUmVzb2x2ZXIgPSAodHlwZTogdHMuVHlwZVJlZmVyZW5jZU5vZGUpID0+IFJlc29sdmVkVHlwZVJlZmVyZW5jZTtcblxuLyoqXG4gKiBBIG1hcmtlciB0byBpbmRpY2F0ZSB0aGF0IGEgdHlwZSByZWZlcmVuY2UgaXMgaW5lbGlnaWJsZSBmb3IgZW1pdHRpbmcuIFRoaXMgbmVlZHMgdG8gYmUgdHJ1dGh5XG4gKiBhcyBpdCdzIHJldHVybmVkIGZyb20gYHRzLmZvckVhY2hDaGlsZGAsIHdoaWNoIG9ubHkgcmV0dXJucyB0cnV0aHkgdmFsdWVzLlxuICovXG50eXBlIElORUxJR0lCTEUgPSB7XG4gIF9fYnJhbmQ6ICdpbmVsaWdpYmxlJztcbn07XG5jb25zdCBJTkVMSUdJQkxFOiBJTkVMSUdJQkxFID0ge30gYXMgSU5FTElHSUJMRTtcblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHR5cGUgY2FuIGJlIGVtaXR0ZWQsIHdoaWNoIG1lYW5zIHRoYXQgaXQgY2FuIGJlIHNhZmVseSBlbWl0dGVkXG4gKiBpbnRvIGEgZGlmZmVyZW50IGxvY2F0aW9uLlxuICpcbiAqIElmIHRoaXMgZnVuY3Rpb24gcmV0dXJucyB0cnVlLCBhIGBUeXBlRW1pdHRlcmAgc2hvdWxkIGJlIGFibGUgdG8gc3VjY2VlZC4gVmljZSB2ZXJzYSwgaWYgdGhpc1xuICogZnVuY3Rpb24gcmV0dXJucyBmYWxzZSwgdGhlbiB1c2luZyB0aGUgYFR5cGVFbWl0dGVyYCBzaG91bGQgbm90IGJlIGF0dGVtcHRlZCBhcyBpdCBpcyBrbm93biB0b1xuICogZmFpbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbkVtaXRUeXBlKHR5cGU6IHRzLlR5cGVOb2RlLCByZXNvbHZlcjogVHlwZVJlZmVyZW5jZVJlc29sdmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjYW5FbWl0VHlwZVdvcmtlcih0eXBlKTtcblxuICBmdW5jdGlvbiBjYW5FbWl0VHlwZVdvcmtlcih0eXBlOiB0cy5UeXBlTm9kZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB2aXNpdE5vZGUodHlwZSkgIT09IElORUxJR0lCTEU7XG4gIH1cblxuICAvLyBUbyBkZXRlcm1pbmUgd2hldGhlciBhIHR5cGUgY2FuIGJlIGVtaXR0ZWQsIHdlIGhhdmUgdG8gcmVjdXJzaXZlbHkgbG9vayB0aHJvdWdoIGFsbCB0eXBlIG5vZGVzLlxuICAvLyBJZiBhIHR5cGUgcmVmZXJlbmNlIG5vZGUgaXMgZm91bmQgYXQgYW55IHBvc2l0aW9uIHdpdGhpbiB0aGUgdHlwZSBhbmQgdGhhdCB0eXBlIHJlZmVyZW5jZVxuICAvLyBjYW5ub3QgYmUgZW1pdHRlZCwgdGhlbiB0aGUgYElORUxJR0lCTEVgIGNvbnN0YW50IGlzIHJldHVybmVkIHRvIHN0b3AgdGhlIHJlY3Vyc2l2ZSB3YWxrIGFzXG4gIC8vIHRoZSB0eXBlIGFzIGEgd2hvbGUgY2Fubm90IGJlIGVtaXR0ZWQgaW4gdGhhdCBjYXNlLiBPdGhlcndpc2UsIHRoZSByZXN1bHQgb2YgdmlzaXRpbmcgYWxsIGNoaWxkXG4gIC8vIG5vZGVzIGRldGVybWluZXMgdGhlIHJlc3VsdC4gSWYgbm8gaW5lbGlnaWJsZSB0eXBlIHJlZmVyZW5jZSBub2RlIGlzIGZvdW5kIHRoZW4gdGhlIHdhbGtcbiAgLy8gcmV0dXJucyBgdW5kZWZpbmVkYCwgaW5kaWNhdGluZyB0aGF0IG5vIHR5cGUgbm9kZSB3YXMgdmlzaXRlZCB0aGF0IGNvdWxkIG5vdCBiZSBlbWl0dGVkLlxuICBmdW5jdGlvbiB2aXNpdE5vZGUobm9kZTogdHMuTm9kZSk6IElORUxJR0lCTEV8dW5kZWZpbmVkIHtcbiAgICAvLyBFbWl0dGluZyBhIHR5cGUgcmVmZXJlbmNlIG5vZGUgaW4gYSBkaWZmZXJlbnQgY29udGV4dCByZXF1aXJlcyB0aGF0IGFuIGltcG9ydCBmb3IgdGhlIHR5cGVcbiAgICAvLyBjYW4gYmUgY3JlYXRlZC4gSWYgYSB0eXBlIHJlZmVyZW5jZSBub2RlIGNhbm5vdCBiZSBlbWl0dGVkLCBgSU5FTElHSUJMRWAgaXMgcmV0dXJuZWQgdG8gc3RvcFxuICAgIC8vIHRoZSB3YWxrLlxuICAgIGlmICh0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKG5vZGUpICYmICFjYW5FbWl0VHlwZVJlZmVyZW5jZShub2RlKSkge1xuICAgICAgcmV0dXJuIElORUxJR0lCTEU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cy5mb3JFYWNoQ2hpbGQobm9kZSwgdmlzaXROb2RlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjYW5FbWl0VHlwZVJlZmVyZW5jZSh0eXBlOiB0cy5UeXBlUmVmZXJlbmNlTm9kZSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHJlZmVyZW5jZSA9IHJlc29sdmVyKHR5cGUpO1xuXG4gICAgLy8gSWYgdGhlIHR5cGUgY291bGQgbm90IGJlIHJlc29sdmVkLCBpdCBjYW4gbm90IGJlIGVtaXR0ZWQuXG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSB0eXBlIGlzIGEgcmVmZXJlbmNlLCBjb25zaWRlciB0aGUgdHlwZSB0byBiZSBlbGlnaWJsZSBmb3IgZW1pdHRpbmcuXG4gICAgaWYgKHJlZmVyZW5jZSBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gVGhlIHR5cGUgY2FuIGJlIGVtaXR0ZWQgaWYgZWl0aGVyIGl0IGRvZXMgbm90IGhhdmUgYW55IHR5cGUgYXJndW1lbnRzLCBvciBhbGwgb2YgdGhlbSBjYW4gYmVcbiAgICAvLyBlbWl0dGVkLlxuICAgIHJldHVybiB0eXBlLnR5cGVBcmd1bWVudHMgPT09IHVuZGVmaW5lZCB8fCB0eXBlLnR5cGVBcmd1bWVudHMuZXZlcnkoY2FuRW1pdFR5cGVXb3JrZXIpO1xuICB9XG59XG5cbi8qKlxuICogR2l2ZW4gYSBgdHMuVHlwZU5vZGVgLCB0aGlzIGNsYXNzIGRlcml2ZXMgYW4gZXF1aXZhbGVudCBgdHMuVHlwZU5vZGVgIHRoYXQgaGFzIGJlZW4gZW1pdHRlZCBpbnRvXG4gKiBhIGRpZmZlcmVudCBjb250ZXh0LlxuICpcbiAqIEZvciBleGFtcGxlLCBjb25zaWRlciB0aGUgZm9sbG93aW5nIGNvZGU6XG4gKlxuICogYGBgXG4gKiBpbXBvcnQge05nSXRlcmFibGV9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuICpcbiAqIGNsYXNzIE5nRm9yT2Y8VCwgVSBleHRlbmRzIE5nSXRlcmFibGU8VD4+IHt9XG4gKiBgYGBcbiAqXG4gKiBIZXJlLCB0aGUgZ2VuZXJpYyB0eXBlIHBhcmFtZXRlcnMgYFRgIGFuZCBgVWAgY2FuIGJlIGVtaXR0ZWQgaW50byBhIGRpZmZlcmVudCBjb250ZXh0LCBhcyB0aGVcbiAqIHR5cGUgcmVmZXJlbmNlIHRvIGBOZ0l0ZXJhYmxlYCBvcmlnaW5hdGVzIGZyb20gYW4gYWJzb2x1dGUgbW9kdWxlIGltcG9ydCBzbyB0aGF0IGl0IGNhbiBiZVxuICogZW1pdHRlZCBhbnl3aGVyZSwgdXNpbmcgdGhhdCBzYW1lIG1vZHVsZSBpbXBvcnQuIFRoZSBwcm9jZXNzIG9mIGVtaXR0aW5nIHRyYW5zbGF0ZXMgdGhlXG4gKiBgTmdJdGVyYWJsZWAgdHlwZSByZWZlcmVuY2UgdG8gYSB0eXBlIHJlZmVyZW5jZSB0aGF0IGlzIHZhbGlkIGluIHRoZSBjb250ZXh0IGluIHdoaWNoIGl0IGlzXG4gKiBlbWl0dGVkLCBmb3IgZXhhbXBsZTpcbiAqXG4gKiBgYGBcbiAqIGltcG9ydCAqIGFzIGkwIGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuICogaW1wb3J0ICogYXMgaTEgZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbiAqXG4gKiBjb25zdCBfY3RvcjE6IDxULCBVIGV4dGVuZHMgaTAuTmdJdGVyYWJsZTxUPj4obzogUGljazxpMS5OZ0Zvck9mPFQsIFU+LCAnbmdGb3JPZic+KTpcbiAqIGkxLk5nRm9yT2Y8VCwgVT47XG4gKiBgYGBcbiAqXG4gKiBOb3RpY2UgaG93IHRoZSB0eXBlIHJlZmVyZW5jZSBmb3IgYE5nSXRlcmFibGVgIGhhcyBiZWVuIHRyYW5zbGF0ZWQgaW50byBhIHF1YWxpZmllZCBuYW1lLFxuICogcmVmZXJyaW5nIHRvIHRoZSBuYW1lc3BhY2UgaW1wb3J0IHRoYXQgd2FzIGNyZWF0ZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBUeXBlRW1pdHRlciB7XG4gIC8qKlxuICAgKiBSZXNvbHZlciBmdW5jdGlvbiB0aGF0IGNvbXB1dGVzIGEgYFJlZmVyZW5jZWAgY29ycmVzcG9uZGluZyB3aXRoIGEgYHRzLlR5cGVSZWZlcmVuY2VOb2RlYC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZXI6IFR5cGVSZWZlcmVuY2VSZXNvbHZlcjtcblxuICAvKipcbiAgICogR2l2ZW4gYSBgUmVmZXJlbmNlYCwgdGhpcyBmdW5jdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgdGhlIGFjdHVhbCBlbWl0dGluZyB3b3JrLiBJdCBzaG91bGRcbiAgICogcHJvZHVjZSBhIGB0cy5UeXBlTm9kZWAgdGhhdCBpcyB2YWxpZCB3aXRoaW4gdGhlIGRlc2lyZWQgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZW1pdFJlZmVyZW5jZTogKHJlZjogUmVmZXJlbmNlKSA9PiB0cy5UeXBlTm9kZTtcblxuICBjb25zdHJ1Y3RvcihyZXNvbHZlcjogVHlwZVJlZmVyZW5jZVJlc29sdmVyLCBlbWl0UmVmZXJlbmNlOiAocmVmOiBSZWZlcmVuY2UpID0+IHRzLlR5cGVOb2RlKSB7XG4gICAgdGhpcy5yZXNvbHZlciA9IHJlc29sdmVyO1xuICAgIHRoaXMuZW1pdFJlZmVyZW5jZSA9IGVtaXRSZWZlcmVuY2U7XG4gIH1cblxuICBlbWl0VHlwZSh0eXBlOiB0cy5UeXBlTm9kZSk6IHRzLlR5cGVOb2RlIHtcbiAgICBjb25zdCB0eXBlUmVmZXJlbmNlVHJhbnNmb3JtZXI6IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5UeXBlTm9kZT4gPSBjb250ZXh0ID0+IHtcbiAgICAgIGNvbnN0IHZpc2l0Tm9kZSA9IChub2RlOiB0cy5Ob2RlKTogdHMuTm9kZSA9PiB7XG4gICAgICAgIGlmICh0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKG5vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZW1pdFR5cGVSZWZlcmVuY2Uobm9kZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0Tm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICByZXR1cm4gbm9kZSA9PiB0cy52aXNpdE5vZGUobm9kZSwgdmlzaXROb2RlKTtcbiAgICB9O1xuICAgIHJldHVybiB0cy50cmFuc2Zvcm0odHlwZSwgW3R5cGVSZWZlcmVuY2VUcmFuc2Zvcm1lcl0pLnRyYW5zZm9ybWVkWzBdO1xuICB9XG5cbiAgcHJpdmF0ZSBlbWl0VHlwZVJlZmVyZW5jZSh0eXBlOiB0cy5UeXBlUmVmZXJlbmNlTm9kZSk6IHRzLlR5cGVOb2RlIHtcbiAgICAvLyBEZXRlcm1pbmUgdGhlIHJlZmVyZW5jZSB0aGF0IHRoZSB0eXBlIGNvcnJlc3BvbmRzIHdpdGguXG4gICAgY29uc3QgcmVmZXJlbmNlID0gdGhpcy5yZXNvbHZlcih0eXBlKTtcbiAgICBpZiAocmVmZXJlbmNlID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBlbWl0IGFuIHVucmVzb2x2ZWQgcmVmZXJlbmNlJyk7XG4gICAgfVxuXG4gICAgLy8gRW1pdCB0aGUgdHlwZSBhcmd1bWVudHMsIGlmIGFueS5cbiAgICBsZXQgdHlwZUFyZ3VtZW50czogdHMuTm9kZUFycmF5PHRzLlR5cGVOb2RlPnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGUudHlwZUFyZ3VtZW50cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0eXBlQXJndW1lbnRzID0gdHMuY3JlYXRlTm9kZUFycmF5KHR5cGUudHlwZUFyZ3VtZW50cy5tYXAodHlwZUFyZyA9PiB0aGlzLmVtaXRUeXBlKHR5cGVBcmcpKSk7XG4gICAgfVxuXG4gICAgLy8gRW1pdCB0aGUgdHlwZSBuYW1lLlxuICAgIGxldCB0eXBlTmFtZSA9IHR5cGUudHlwZU5hbWU7XG4gICAgaWYgKHJlZmVyZW5jZSBpbnN0YW5jZW9mIFJlZmVyZW5jZSkge1xuICAgICAgY29uc3QgZW1pdHRlZFR5cGUgPSB0aGlzLmVtaXRSZWZlcmVuY2UocmVmZXJlbmNlKTtcbiAgICAgIGlmICghdHMuaXNUeXBlUmVmZXJlbmNlTm9kZShlbWl0dGVkVHlwZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBUeXBlUmVmZXJlbmNlTm9kZSBmb3IgZW1pdHRlZCByZWZlcmVuY2UsIGdvdCAke1xuICAgICAgICAgICAgdHMuU3ludGF4S2luZFtlbWl0dGVkVHlwZS5raW5kXX1gKTtcbiAgICAgIH1cblxuICAgICAgdHlwZU5hbWUgPSBlbWl0dGVkVHlwZS50eXBlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHMudXBkYXRlVHlwZVJlZmVyZW5jZU5vZGUodHlwZSwgdHlwZU5hbWUsIHR5cGVBcmd1bWVudHMpO1xuICB9XG59XG4iXX0=