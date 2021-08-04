/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { Reference } from '../../imports';
const INELIGIBLE = {};
/**
 * Determines whether the provided type can be emitted, which means that it can be safely emitted
 * into a different location.
 *
 * If this function returns true, a `TypeEmitter` should be able to succeed. Vice versa, if this
 * function returns false, then using the `TypeEmitter` should not be attempted as it is known to
 * fail.
 */
export function canEmitType(type, resolver) {
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
        const reference = resolver(type);
        // If the type could not be resolved, it can not be emitted.
        if (reference === null) {
            return false;
        }
        // If the type is a reference, consider the type to be eligible for emitting.
        if (reference instanceof Reference) {
            return true;
        }
        // The type can be emitted if either it does not have any type arguments, or all of them can be
        // emitted.
        return type.typeArguments === undefined || type.typeArguments.every(canEmitTypeWorker);
    }
}
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
export class TypeEmitter {
    constructor(resolver, emitReference) {
        this.resolver = resolver;
        this.emitReference = emitReference;
    }
    emitType(type) {
        const typeReferenceTransformer = context => {
            const visitNode = (node) => {
                if (ts.isTypeReferenceNode(node)) {
                    return this.emitTypeReference(node);
                }
                else {
                    return ts.visitEachChild(node, visitNode, context);
                }
            };
            return node => ts.visitNode(node, visitNode);
        };
        return ts.transform(type, [typeReferenceTransformer]).transformed[0];
    }
    emitTypeReference(type) {
        // Determine the reference that the type corresponds with.
        const reference = this.resolver(type);
        if (reference === null) {
            throw new Error('Unable to emit an unresolved reference');
        }
        // Emit the type arguments, if any.
        let typeArguments = undefined;
        if (type.typeArguments !== undefined) {
            typeArguments = ts.createNodeArray(type.typeArguments.map(typeArg => this.emitType(typeArg)));
        }
        // Emit the type name.
        let typeName = type.typeName;
        if (reference instanceof Reference) {
            const emittedType = this.emitReference(reference);
            if (!ts.isTypeReferenceNode(emittedType)) {
                throw new Error(`Expected TypeReferenceNode for emitted reference, got ${ts.SyntaxKind[emittedType.kind]}`);
            }
            typeName = emittedType.typeName;
        }
        return ts.updateTypeReferenceNode(type, typeName, typeArguments);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9lbWl0dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy90eXBlY2hlY2svc3JjL3R5cGVfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBc0J4QyxNQUFNLFVBQVUsR0FBZSxFQUFnQixDQUFDO0FBRWhEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUFDLElBQWlCLEVBQUUsUUFBK0I7SUFDNUUsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUUvQixTQUFTLGlCQUFpQixDQUFDLElBQWlCO1FBQzFDLE9BQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLFVBQVUsQ0FBQztJQUN4QyxDQUFDO0lBRUQsa0dBQWtHO0lBQ2xHLDRGQUE0RjtJQUM1Riw4RkFBOEY7SUFDOUYsa0dBQWtHO0lBQ2xHLDJGQUEyRjtJQUMzRiwyRkFBMkY7SUFDM0YsU0FBUyxTQUFTLENBQUMsSUFBYTtRQUM5Qiw2RkFBNkY7UUFDN0YsK0ZBQStGO1FBQy9GLFlBQVk7UUFDWixJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQy9ELE9BQU8sVUFBVSxDQUFDO1NBQ25CO2FBQU07WUFDTCxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1NBQ3pDO0lBQ0gsQ0FBQztJQUVELFNBQVMsb0JBQW9CLENBQUMsSUFBMEI7UUFDdEQsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWpDLDREQUE0RDtRQUM1RCxJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUU7WUFDdEIsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUVELDZFQUE2RTtRQUM3RSxJQUFJLFNBQVMsWUFBWSxTQUFTLEVBQUU7WUFDbEMsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELCtGQUErRjtRQUMvRixXQUFXO1FBQ1gsT0FBTyxJQUFJLENBQUMsYUFBYSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E0Qkc7QUFDSCxNQUFNLE9BQU8sV0FBVztJQVl0QixZQUFZLFFBQStCLEVBQUUsYUFBOEM7UUFDekYsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7SUFDckMsQ0FBQztJQUVELFFBQVEsQ0FBQyxJQUFpQjtRQUN4QixNQUFNLHdCQUF3QixHQUF1QyxPQUFPLENBQUMsRUFBRTtZQUM3RSxNQUFNLFNBQVMsR0FBRyxDQUFDLElBQWEsRUFBVyxFQUFFO2dCQUMzQyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDaEMsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQ3JDO3FCQUFNO29CQUNMLE9BQU8sRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2lCQUNwRDtZQUNILENBQUMsQ0FBQztZQUNGLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMvQyxDQUFDLENBQUM7UUFDRixPQUFPLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU8saUJBQWlCLENBQUMsSUFBMEI7UUFDbEQsMERBQTBEO1FBQzFELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO1lBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztTQUMzRDtRQUVELG1DQUFtQztRQUNuQyxJQUFJLGFBQWEsR0FBd0MsU0FBUyxDQUFDO1FBQ25FLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQUU7WUFDcEMsYUFBYSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUMvRjtRQUVELHNCQUFzQjtRQUN0QixJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQzdCLElBQUksU0FBUyxZQUFZLFNBQVMsRUFBRTtZQUNsQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMseURBQ1osRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQ3hDO1lBRUQsUUFBUSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUM7U0FDakM7UUFFRCxPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ25FLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5cbi8qKlxuICogQSByZXNvbHZlZCB0eXBlIHJlZmVyZW5jZSBjYW4gZWl0aGVyIGJlIGEgYFJlZmVyZW5jZWAsIHRoZSBvcmlnaW5hbCBgdHMuVHlwZVJlZmVyZW5jZU5vZGVgIGl0c2VsZlxuICogb3IgbnVsbC4gQSB2YWx1ZSBvZiBudWxsIGluZGljYXRlcyB0aGF0IG5vIHJlZmVyZW5jZSBjb3VsZCBiZSByZXNvbHZlZCBvciB0aGF0IHRoZSByZWZlcmVuY2UgY2FuXG4gKiBub3QgYmUgZW1pdHRlZC5cbiAqL1xuZXhwb3J0IHR5cGUgUmVzb2x2ZWRUeXBlUmVmZXJlbmNlID0gUmVmZXJlbmNlfHRzLlR5cGVSZWZlcmVuY2VOb2RlfG51bGw7XG5cbi8qKlxuICogQSB0eXBlIHJlZmVyZW5jZSByZXNvbHZlciBmdW5jdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgZmluZGluZyB0aGUgZGVjbGFyYXRpb24gb2YgdGhlIHR5cGVcbiAqIHJlZmVyZW5jZSBhbmQgdmVyaWZ5aW5nIHdoZXRoZXIgaXQgY2FuIGJlIGVtaXR0ZWQuXG4gKi9cbmV4cG9ydCB0eXBlIFR5cGVSZWZlcmVuY2VSZXNvbHZlciA9ICh0eXBlOiB0cy5UeXBlUmVmZXJlbmNlTm9kZSkgPT4gUmVzb2x2ZWRUeXBlUmVmZXJlbmNlO1xuXG4vKipcbiAqIEEgbWFya2VyIHRvIGluZGljYXRlIHRoYXQgYSB0eXBlIHJlZmVyZW5jZSBpcyBpbmVsaWdpYmxlIGZvciBlbWl0dGluZy4gVGhpcyBuZWVkcyB0byBiZSB0cnV0aHlcbiAqIGFzIGl0J3MgcmV0dXJuZWQgZnJvbSBgdHMuZm9yRWFjaENoaWxkYCwgd2hpY2ggb25seSByZXR1cm5zIHRydXRoeSB2YWx1ZXMuXG4gKi9cbnR5cGUgSU5FTElHSUJMRSA9IHtcbiAgX19icmFuZDogJ2luZWxpZ2libGUnO1xufTtcbmNvbnN0IElORUxJR0lCTEU6IElORUxJR0lCTEUgPSB7fSBhcyBJTkVMSUdJQkxFO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgcHJvdmlkZWQgdHlwZSBjYW4gYmUgZW1pdHRlZCwgd2hpY2ggbWVhbnMgdGhhdCBpdCBjYW4gYmUgc2FmZWx5IGVtaXR0ZWRcbiAqIGludG8gYSBkaWZmZXJlbnQgbG9jYXRpb24uXG4gKlxuICogSWYgdGhpcyBmdW5jdGlvbiByZXR1cm5zIHRydWUsIGEgYFR5cGVFbWl0dGVyYCBzaG91bGQgYmUgYWJsZSB0byBzdWNjZWVkLiBWaWNlIHZlcnNhLCBpZiB0aGlzXG4gKiBmdW5jdGlvbiByZXR1cm5zIGZhbHNlLCB0aGVuIHVzaW5nIHRoZSBgVHlwZUVtaXR0ZXJgIHNob3VsZCBub3QgYmUgYXR0ZW1wdGVkIGFzIGl0IGlzIGtub3duIHRvXG4gKiBmYWlsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2FuRW1pdFR5cGUodHlwZTogdHMuVHlwZU5vZGUsIHJlc29sdmVyOiBUeXBlUmVmZXJlbmNlUmVzb2x2ZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNhbkVtaXRUeXBlV29ya2VyKHR5cGUpO1xuXG4gIGZ1bmN0aW9uIGNhbkVtaXRUeXBlV29ya2VyKHR5cGU6IHRzLlR5cGVOb2RlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHZpc2l0Tm9kZSh0eXBlKSAhPT0gSU5FTElHSUJMRTtcbiAgfVxuXG4gIC8vIFRvIGRldGVybWluZSB3aGV0aGVyIGEgdHlwZSBjYW4gYmUgZW1pdHRlZCwgd2UgaGF2ZSB0byByZWN1cnNpdmVseSBsb29rIHRocm91Z2ggYWxsIHR5cGUgbm9kZXMuXG4gIC8vIElmIGEgdHlwZSByZWZlcmVuY2Ugbm9kZSBpcyBmb3VuZCBhdCBhbnkgcG9zaXRpb24gd2l0aGluIHRoZSB0eXBlIGFuZCB0aGF0IHR5cGUgcmVmZXJlbmNlXG4gIC8vIGNhbm5vdCBiZSBlbWl0dGVkLCB0aGVuIHRoZSBgSU5FTElHSUJMRWAgY29uc3RhbnQgaXMgcmV0dXJuZWQgdG8gc3RvcCB0aGUgcmVjdXJzaXZlIHdhbGsgYXNcbiAgLy8gdGhlIHR5cGUgYXMgYSB3aG9sZSBjYW5ub3QgYmUgZW1pdHRlZCBpbiB0aGF0IGNhc2UuIE90aGVyd2lzZSwgdGhlIHJlc3VsdCBvZiB2aXNpdGluZyBhbGwgY2hpbGRcbiAgLy8gbm9kZXMgZGV0ZXJtaW5lcyB0aGUgcmVzdWx0LiBJZiBubyBpbmVsaWdpYmxlIHR5cGUgcmVmZXJlbmNlIG5vZGUgaXMgZm91bmQgdGhlbiB0aGUgd2Fsa1xuICAvLyByZXR1cm5zIGB1bmRlZmluZWRgLCBpbmRpY2F0aW5nIHRoYXQgbm8gdHlwZSBub2RlIHdhcyB2aXNpdGVkIHRoYXQgY291bGQgbm90IGJlIGVtaXR0ZWQuXG4gIGZ1bmN0aW9uIHZpc2l0Tm9kZShub2RlOiB0cy5Ob2RlKTogSU5FTElHSUJMRXx1bmRlZmluZWQge1xuICAgIC8vIEVtaXR0aW5nIGEgdHlwZSByZWZlcmVuY2Ugbm9kZSBpbiBhIGRpZmZlcmVudCBjb250ZXh0IHJlcXVpcmVzIHRoYXQgYW4gaW1wb3J0IGZvciB0aGUgdHlwZVxuICAgIC8vIGNhbiBiZSBjcmVhdGVkLiBJZiBhIHR5cGUgcmVmZXJlbmNlIG5vZGUgY2Fubm90IGJlIGVtaXR0ZWQsIGBJTkVMSUdJQkxFYCBpcyByZXR1cm5lZCB0byBzdG9wXG4gICAgLy8gdGhlIHdhbGsuXG4gICAgaWYgKHRzLmlzVHlwZVJlZmVyZW5jZU5vZGUobm9kZSkgJiYgIWNhbkVtaXRUeXBlUmVmZXJlbmNlKG5vZGUpKSB7XG4gICAgICByZXR1cm4gSU5FTElHSUJMRTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRzLmZvckVhY2hDaGlsZChub2RlLCB2aXNpdE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNhbkVtaXRUeXBlUmVmZXJlbmNlKHR5cGU6IHRzLlR5cGVSZWZlcmVuY2VOb2RlKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcmVmZXJlbmNlID0gcmVzb2x2ZXIodHlwZSk7XG5cbiAgICAvLyBJZiB0aGUgdHlwZSBjb3VsZCBub3QgYmUgcmVzb2x2ZWQsIGl0IGNhbiBub3QgYmUgZW1pdHRlZC5cbiAgICBpZiAocmVmZXJlbmNlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHR5cGUgaXMgYSByZWZlcmVuY2UsIGNvbnNpZGVyIHRoZSB0eXBlIHRvIGJlIGVsaWdpYmxlIGZvciBlbWl0dGluZy5cbiAgICBpZiAocmVmZXJlbmNlIGluc3RhbmNlb2YgUmVmZXJlbmNlKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBUaGUgdHlwZSBjYW4gYmUgZW1pdHRlZCBpZiBlaXRoZXIgaXQgZG9lcyBub3QgaGF2ZSBhbnkgdHlwZSBhcmd1bWVudHMsIG9yIGFsbCBvZiB0aGVtIGNhbiBiZVxuICAgIC8vIGVtaXR0ZWQuXG4gICAgcmV0dXJuIHR5cGUudHlwZUFyZ3VtZW50cyA9PT0gdW5kZWZpbmVkIHx8IHR5cGUudHlwZUFyZ3VtZW50cy5ldmVyeShjYW5FbWl0VHlwZVdvcmtlcik7XG4gIH1cbn1cblxuLyoqXG4gKiBHaXZlbiBhIGB0cy5UeXBlTm9kZWAsIHRoaXMgY2xhc3MgZGVyaXZlcyBhbiBlcXVpdmFsZW50IGB0cy5UeXBlTm9kZWAgdGhhdCBoYXMgYmVlbiBlbWl0dGVkIGludG9cbiAqIGEgZGlmZmVyZW50IGNvbnRleHQuXG4gKlxuICogRm9yIGV4YW1wbGUsIGNvbnNpZGVyIHRoZSBmb2xsb3dpbmcgY29kZTpcbiAqXG4gKiBgYGBcbiAqIGltcG9ydCB7TmdJdGVyYWJsZX0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG4gKlxuICogY2xhc3MgTmdGb3JPZjxULCBVIGV4dGVuZHMgTmdJdGVyYWJsZTxUPj4ge31cbiAqIGBgYFxuICpcbiAqIEhlcmUsIHRoZSBnZW5lcmljIHR5cGUgcGFyYW1ldGVycyBgVGAgYW5kIGBVYCBjYW4gYmUgZW1pdHRlZCBpbnRvIGEgZGlmZmVyZW50IGNvbnRleHQsIGFzIHRoZVxuICogdHlwZSByZWZlcmVuY2UgdG8gYE5nSXRlcmFibGVgIG9yaWdpbmF0ZXMgZnJvbSBhbiBhYnNvbHV0ZSBtb2R1bGUgaW1wb3J0IHNvIHRoYXQgaXQgY2FuIGJlXG4gKiBlbWl0dGVkIGFueXdoZXJlLCB1c2luZyB0aGF0IHNhbWUgbW9kdWxlIGltcG9ydC4gVGhlIHByb2Nlc3Mgb2YgZW1pdHRpbmcgdHJhbnNsYXRlcyB0aGVcbiAqIGBOZ0l0ZXJhYmxlYCB0eXBlIHJlZmVyZW5jZSB0byBhIHR5cGUgcmVmZXJlbmNlIHRoYXQgaXMgdmFsaWQgaW4gdGhlIGNvbnRleHQgaW4gd2hpY2ggaXQgaXNcbiAqIGVtaXR0ZWQsIGZvciBleGFtcGxlOlxuICpcbiAqIGBgYFxuICogaW1wb3J0ICogYXMgaTAgZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG4gKiBpbXBvcnQgKiBhcyBpMSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuICpcbiAqIGNvbnN0IF9jdG9yMTogPFQsIFUgZXh0ZW5kcyBpMC5OZ0l0ZXJhYmxlPFQ+PihvOiBQaWNrPGkxLk5nRm9yT2Y8VCwgVT4sICduZ0Zvck9mJz4pOlxuICogaTEuTmdGb3JPZjxULCBVPjtcbiAqIGBgYFxuICpcbiAqIE5vdGljZSBob3cgdGhlIHR5cGUgcmVmZXJlbmNlIGZvciBgTmdJdGVyYWJsZWAgaGFzIGJlZW4gdHJhbnNsYXRlZCBpbnRvIGEgcXVhbGlmaWVkIG5hbWUsXG4gKiByZWZlcnJpbmcgdG8gdGhlIG5hbWVzcGFjZSBpbXBvcnQgdGhhdCB3YXMgY3JlYXRlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFR5cGVFbWl0dGVyIHtcbiAgLyoqXG4gICAqIFJlc29sdmVyIGZ1bmN0aW9uIHRoYXQgY29tcHV0ZXMgYSBgUmVmZXJlbmNlYCBjb3JyZXNwb25kaW5nIHdpdGggYSBgdHMuVHlwZVJlZmVyZW5jZU5vZGVgLlxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlcjogVHlwZVJlZmVyZW5jZVJlc29sdmVyO1xuXG4gIC8qKlxuICAgKiBHaXZlbiBhIGBSZWZlcmVuY2VgLCB0aGlzIGZ1bmN0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciB0aGUgYWN0dWFsIGVtaXR0aW5nIHdvcmsuIEl0IHNob3VsZFxuICAgKiBwcm9kdWNlIGEgYHRzLlR5cGVOb2RlYCB0aGF0IGlzIHZhbGlkIHdpdGhpbiB0aGUgZGVzaXJlZCBjb250ZXh0LlxuICAgKi9cbiAgcHJpdmF0ZSBlbWl0UmVmZXJlbmNlOiAocmVmOiBSZWZlcmVuY2UpID0+IHRzLlR5cGVOb2RlO1xuXG4gIGNvbnN0cnVjdG9yKHJlc29sdmVyOiBUeXBlUmVmZXJlbmNlUmVzb2x2ZXIsIGVtaXRSZWZlcmVuY2U6IChyZWY6IFJlZmVyZW5jZSkgPT4gdHMuVHlwZU5vZGUpIHtcbiAgICB0aGlzLnJlc29sdmVyID0gcmVzb2x2ZXI7XG4gICAgdGhpcy5lbWl0UmVmZXJlbmNlID0gZW1pdFJlZmVyZW5jZTtcbiAgfVxuXG4gIGVtaXRUeXBlKHR5cGU6IHRzLlR5cGVOb2RlKTogdHMuVHlwZU5vZGUge1xuICAgIGNvbnN0IHR5cGVSZWZlcmVuY2VUcmFuc2Zvcm1lcjogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlR5cGVOb2RlPiA9IGNvbnRleHQgPT4ge1xuICAgICAgY29uc3QgdmlzaXROb2RlID0gKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlID0+IHtcbiAgICAgICAgaWYgKHRzLmlzVHlwZVJlZmVyZW5jZU5vZGUobm9kZSkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5lbWl0VHlwZVJlZmVyZW5jZShub2RlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdHMudmlzaXRFYWNoQ2hpbGQobm9kZSwgdmlzaXROb2RlLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJldHVybiBub2RlID0+IHRzLnZpc2l0Tm9kZShub2RlLCB2aXNpdE5vZGUpO1xuICAgIH07XG4gICAgcmV0dXJuIHRzLnRyYW5zZm9ybSh0eXBlLCBbdHlwZVJlZmVyZW5jZVRyYW5zZm9ybWVyXSkudHJhbnNmb3JtZWRbMF07XG4gIH1cblxuICBwcml2YXRlIGVtaXRUeXBlUmVmZXJlbmNlKHR5cGU6IHRzLlR5cGVSZWZlcmVuY2VOb2RlKTogdHMuVHlwZU5vZGUge1xuICAgIC8vIERldGVybWluZSB0aGUgcmVmZXJlbmNlIHRoYXQgdGhlIHR5cGUgY29ycmVzcG9uZHMgd2l0aC5cbiAgICBjb25zdCByZWZlcmVuY2UgPSB0aGlzLnJlc29sdmVyKHR5cGUpO1xuICAgIGlmIChyZWZlcmVuY2UgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGVtaXQgYW4gdW5yZXNvbHZlZCByZWZlcmVuY2UnKTtcbiAgICB9XG5cbiAgICAvLyBFbWl0IHRoZSB0eXBlIGFyZ3VtZW50cywgaWYgYW55LlxuICAgIGxldCB0eXBlQXJndW1lbnRzOiB0cy5Ob2RlQXJyYXk8dHMuVHlwZU5vZGU+fHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZS50eXBlQXJndW1lbnRzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHR5cGVBcmd1bWVudHMgPSB0cy5jcmVhdGVOb2RlQXJyYXkodHlwZS50eXBlQXJndW1lbnRzLm1hcCh0eXBlQXJnID0+IHRoaXMuZW1pdFR5cGUodHlwZUFyZykpKTtcbiAgICB9XG5cbiAgICAvLyBFbWl0IHRoZSB0eXBlIG5hbWUuXG4gICAgbGV0IHR5cGVOYW1lID0gdHlwZS50eXBlTmFtZTtcbiAgICBpZiAocmVmZXJlbmNlIGluc3RhbmNlb2YgUmVmZXJlbmNlKSB7XG4gICAgICBjb25zdCBlbWl0dGVkVHlwZSA9IHRoaXMuZW1pdFJlZmVyZW5jZShyZWZlcmVuY2UpO1xuICAgICAgaWYgKCF0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKGVtaXR0ZWRUeXBlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIFR5cGVSZWZlcmVuY2VOb2RlIGZvciBlbWl0dGVkIHJlZmVyZW5jZSwgZ290ICR7XG4gICAgICAgICAgICB0cy5TeW50YXhLaW5kW2VtaXR0ZWRUeXBlLmtpbmRdfWApO1xuICAgICAgfVxuXG4gICAgICB0eXBlTmFtZSA9IGVtaXR0ZWRUeXBlLnR5cGVOYW1lO1xuICAgIH1cblxuICAgIHJldHVybiB0cy51cGRhdGVUeXBlUmVmZXJlbmNlTm9kZSh0eXBlLCB0eXBlTmFtZSwgdHlwZUFyZ3VtZW50cyk7XG4gIH1cbn1cbiJdfQ==