/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { Reference } from '../../imports';
import { isNamedClassDeclaration } from '../../reflection';
import { canEmitType, TypeEmitter } from './type_emitter';
/**
 * See `TypeEmitter` for more information on the emitting process.
 */
export class TypeParameterEmitter {
    constructor(typeParameters, reflector) {
        this.typeParameters = typeParameters;
        this.reflector = reflector;
    }
    /**
     * Determines whether the type parameters can be emitted. If this returns true, then a call to
     * `emit` is known to succeed. Vice versa, if false is returned then `emit` should not be
     * called, as it would fail.
     */
    canEmit() {
        if (this.typeParameters === undefined) {
            return true;
        }
        return this.typeParameters.every(typeParam => {
            return this.canEmitType(typeParam.constraint) && this.canEmitType(typeParam.default);
        });
    }
    canEmitType(type) {
        if (type === undefined) {
            return true;
        }
        return canEmitType(type, typeReference => this.resolveTypeReference(typeReference));
    }
    /**
     * Emits the type parameters using the provided emitter function for `Reference`s.
     */
    emit(emitReference) {
        if (this.typeParameters === undefined) {
            return undefined;
        }
        const emitter = new TypeEmitter(type => this.resolveTypeReference(type), emitReference);
        return this.typeParameters.map(typeParam => {
            const constraint = typeParam.constraint !== undefined ? emitter.emitType(typeParam.constraint) : undefined;
            const defaultType = typeParam.default !== undefined ? emitter.emitType(typeParam.default) : undefined;
            return ts.updateTypeParameterDeclaration(
            /* node */ typeParam, 
            /* name */ typeParam.name, 
            /* constraint */ constraint, 
            /* defaultType */ defaultType);
        });
    }
    resolveTypeReference(type) {
        const target = ts.isIdentifier(type.typeName) ? type.typeName : type.typeName.right;
        const declaration = this.reflector.getDeclarationOfIdentifier(target);
        // If no declaration could be resolved or does not have a `ts.Declaration`, the type cannot be
        // resolved.
        if (declaration === null || declaration.node === null) {
            return null;
        }
        // If the declaration corresponds with a local type parameter, the type reference can be used
        // as is.
        if (this.isLocalTypeParameter(declaration.node)) {
            return type;
        }
        let owningModule = null;
        if (declaration.viaModule !== null) {
            owningModule = {
                specifier: declaration.viaModule,
                resolutionContext: type.getSourceFile().fileName,
            };
        }
        // If no owning module is known, the reference needs to be exported to be able to emit an import
        // statement for it. If the declaration is not exported, null is returned to prevent emit.
        if (owningModule === null && !this.isStaticallyExported(declaration.node)) {
            return null;
        }
        return new Reference(declaration.node, owningModule);
    }
    isStaticallyExported(decl) {
        return isNamedClassDeclaration(decl) && this.reflector.isStaticallyExported(decl);
    }
    isLocalTypeParameter(decl) {
        // Checking for local type parameters only occurs during resolution of type parameters, so it is
        // guaranteed that type parameters are present.
        return this.typeParameters.some(param => param === decl);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9wYXJhbWV0ZXJfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy90eXBlX3BhcmFtZXRlcl9lbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBZSxTQUFTLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFrQix1QkFBdUIsRUFBaUIsTUFBTSxrQkFBa0IsQ0FBQztBQUUxRixPQUFPLEVBQUMsV0FBVyxFQUF5QixXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUcvRTs7R0FFRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7SUFDL0IsWUFDWSxjQUFtRSxFQUNuRSxTQUF5QjtRQUR6QixtQkFBYyxHQUFkLGNBQWMsQ0FBcUQ7UUFDbkUsY0FBUyxHQUFULFNBQVMsQ0FBZ0I7SUFBRyxDQUFDO0lBRXpDOzs7O09BSUc7SUFDSCxPQUFPO1FBQ0wsSUFBSSxJQUFJLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRTtZQUNyQyxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMzQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZGLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLFdBQVcsQ0FBQyxJQUEyQjtRQUM3QyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDdEIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sV0FBVyxDQUFDLElBQUks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LEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDO0lBQzVELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7T3duaW5nTW9kdWxlLCBSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbk5vZGUsIGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uLCBSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5cbmltcG9ydCB7Y2FuRW1pdFR5cGUsIFJlc29sdmVkVHlwZVJlZmVyZW5jZSwgVHlwZUVtaXR0ZXJ9IGZyb20gJy4vdHlwZV9lbWl0dGVyJztcblxuXG4vKipcbiAqIFNlZSBgVHlwZUVtaXR0ZXJgIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoZSBlbWl0dGluZyBwcm9jZXNzLlxuICovXG5leHBvcnQgY2xhc3MgVHlwZVBhcmFtZXRlckVtaXR0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdHlwZVBhcmFtZXRlcnM6IHRzLk5vZGVBcnJheTx0cy5UeXBlUGFyYW1ldGVyRGVjbGFyYXRpb24+fHVuZGVmaW5lZCxcbiAgICAgIHByaXZhdGUgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCkge31cblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSB0eXBlIHBhcmFtZXRlcnMgY2FuIGJlIGVtaXR0ZWQuIElmIHRoaXMgcmV0dXJucyB0cnVlLCB0aGVuIGEgY2FsbCB0b1xuICAgKiBgZW1pdGAgaXMga25vd24gdG8gc3VjY2VlZC4gVmljZSB2ZXJzYSwgaWYgZmFsc2UgaXMgcmV0dXJuZWQgdGhlbiBgZW1pdGAgc2hvdWxkIG5vdCBiZVxuICAgKiBjYWxsZWQsIGFzIGl0IHdvdWxkIGZhaWwuXG4gICAqL1xuICBjYW5FbWl0KCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLnR5cGVQYXJhbWV0ZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnR5cGVQYXJhbWV0ZXJzLmV2ZXJ5KHR5cGVQYXJhbSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5jYW5FbWl0VHlwZSh0eXBlUGFyYW0uY29uc3RyYWludCkgJiYgdGhpcy5jYW5FbWl0VHlwZSh0eXBlUGFyYW0uZGVmYXVsdCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNhbkVtaXRUeXBlKHR5cGU6IHRzLlR5cGVOb2RlfHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICAgIGlmICh0eXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBjYW5FbWl0VHlwZSh0eXBlLCB0eXBlUmVmZXJlbmNlID0+IHRoaXMucmVzb2x2ZVR5cGVSZWZlcmVuY2UodHlwZVJlZmVyZW5jZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEVtaXRzIHRoZSB0eXBlIHBhcmFtZXRlcnMgdXNpbmcgdGhlIHByb3ZpZGVkIGVtaXR0ZXIgZnVuY3Rpb24gZm9yIGBSZWZlcmVuY2Vgcy5cbiAgICovXG4gIGVtaXQoZW1pdFJlZmVyZW5jZTogKHJlZjogUmVmZXJlbmNlKSA9PiB0cy5UeXBlTm9kZSk6IHRzLlR5cGVQYXJhbWV0ZXJEZWNsYXJhdGlvbltdfHVuZGVmaW5lZCB7XG4gICAgaWYgKHRoaXMudHlwZVBhcmFtZXRlcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCBlbWl0dGVyID0gbmV3IFR5cGVFbWl0dGVyKHR5cGUgPT4gdGhpcy5yZXNvbHZlVHlwZVJlZmVyZW5jZSh0eXBlKSwgZW1pdFJlZmVyZW5jZSk7XG5cbiAgICByZXR1cm4gdGhpcy50eXBlUGFyYW1ldGVycy5tYXAodHlwZVBhcmFtID0+IHtcbiAgICAgIGNvbnN0IGNvbnN0cmFpbnQgPVxuICAgICAgICAgIHR5cGVQYXJhbS5jb25zdHJhaW50ICE9PSB1bmRlZmluZWQgPyBlbWl0dGVyLmVtaXRUeXBlKHR5cGVQYXJhbS5jb25zdHJhaW50KSA6IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGRlZmF1bHRUeXBlID1cbiAgICAgICAgICB0eXBlUGFyYW0uZGVmYXVsdCAhPT0gdW5kZWZpbmVkID8gZW1pdHRlci5lbWl0VHlwZSh0eXBlUGFyYW0uZGVmYXVsdCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgIHJldHVybiB0cy51cGRhdGVUeXBlUGFyYW1ldGVyRGVjbGFyYXRpb24oXG4gICAgICAgICAgLyogbm9kZSAqLyB0eXBlUGFyYW0sXG4gICAgICAgICAgLyogbmFtZSAqLyB0eXBlUGFyYW0ubmFtZSxcbiAgICAgICAgICAvKiBjb25zdHJhaW50ICovIGNvbnN0cmFpbnQsXG4gICAgICAgICAgLyogZGVmYXVsdFR5cGUgKi8gZGVmYXVsdFR5cGUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNvbHZlVHlwZVJlZmVyZW5jZSh0eXBlOiB0cy5UeXBlUmVmZXJlbmNlTm9kZSk6IFJlc29sdmVkVHlwZVJlZmVyZW5jZSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdHMuaXNJZGVudGlmaWVyKHR5cGUudHlwZU5hbWUpID8gdHlwZS50eXBlTmFtZSA6IHR5cGUudHlwZU5hbWUucmlnaHQ7XG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSB0aGlzLnJlZmxlY3Rvci5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcih0YXJnZXQpO1xuXG4gICAgLy8gSWYgbm8gZGVjbGFyYXRpb24gY291bGQgYmUgcmVzb2x2ZWQgb3IgZG9lcyBub3QgaGF2ZSBhIGB0cy5EZWNsYXJhdGlvbmAsIHRoZSB0eXBlIGNhbm5vdCBiZVxuICAgIC8vIHJlc29sdmVkLlxuICAgIGlmIChkZWNsYXJhdGlvbiA9PT0gbnVsbCB8fCBkZWNsYXJhdGlvbi5ub2RlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgZGVjbGFyYXRpb24gY29ycmVzcG9uZHMgd2l0aCBhIGxvY2FsIHR5cGUgcGFyYW1ldGVyLCB0aGUgdHlwZSByZWZlcmVuY2UgY2FuIGJlIHVzZWRcbiAgICAvLyBhcyBpcy5cbiAgICBpZiAodGhpcy5pc0xvY2FsVHlwZVBhcmFtZXRlcihkZWNsYXJhdGlvbi5ub2RlKSkge1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuXG4gICAgbGV0IG93bmluZ01vZHVsZTogT3duaW5nTW9kdWxlfG51bGwgPSBudWxsO1xuICAgIGlmIChkZWNsYXJhdGlvbi52aWFNb2R1bGUgIT09IG51bGwpIHtcbiAgICAgIG93bmluZ01vZHVsZSA9IHtcbiAgICAgICAgc3BlY2lmaWVyOiBkZWNsYXJhdGlvbi52aWFNb2R1bGUsXG4gICAgICAgIHJlc29sdXRpb25Db250ZXh0OiB0eXBlLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gb3duaW5nIG1vZHVsZSBpcyBrbm93biwgdGhlIHJlZmVyZW5jZSBuZWVkcyB0byBiZSBleHBvcnRlZCB0byBiZSBhYmxlIHRvIGVtaXQgYW4gaW1wb3J0XG4gICAgLy8gc3RhdGVtZW50IGZvciBpdC4gSWYgdGhlIGRlY2xhcmF0aW9uIGlzIG5vdCBleHBvcnRlZCwgbnVsbCBpcyByZXR1cm5lZCB0byBwcmV2ZW50IGVtaXQuXG4gICAgaWYgKG93bmluZ01vZHVsZSA9PT0gbnVsbCAmJiAhdGhpcy5pc1N0YXRpY2FsbHlFeHBvcnRlZChkZWNsYXJhdGlvbi5ub2RlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZWZlcmVuY2UoZGVjbGFyYXRpb24ubm9kZSwgb3duaW5nTW9kdWxlKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNTdGF0aWNhbGx5RXhwb3J0ZWQoZGVjbDogRGVjbGFyYXRpb25Ob2RlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKGRlY2wpICYmIHRoaXMucmVmbGVjdG9yLmlzU3RhdGljYWxseUV4cG9ydGVkKGRlY2wpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xvY2FsVHlwZVBhcmFtZXRlcihkZWNsOiBEZWNsYXJhdGlvbk5vZGUpOiBib29sZWFuIHtcbiAgICAvLyBDaGVja2luZyBmb3IgbG9jYWwgdHlwZSBwYXJhbWV0ZXJzIG9ubHkgb2NjdXJzIGR1cmluZyByZXNvbHV0aW9uIG9mIHR5cGUgcGFyYW1ldGVycywgc28gaXQgaXNcbiAgICAvLyBndWFyYW50ZWVkIHRoYXQgdHlwZSBwYXJhbWV0ZXJzIGFyZSBwcmVzZW50LlxuICAgIHJldHVybiB0aGlzLnR5cGVQYXJhbWV0ZXJzIS5zb21lKHBhcmFtID0+IHBhcmFtID09PSBkZWNsKTtcbiAgfVxufVxuIl19