/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { readBaseClass } from '../../../src/ngtsc/annotations/src/util';
import { Reference } from '../../../src/ngtsc/imports';
import { HandlerFlags } from '../../../src/ngtsc/transform';
import { createComponentDecorator, createDirectiveDecorator, hasDirectiveDecorator, hasPipeDecorator } from './utils';
export class UndecoratedChildMigration {
    apply(clazz, host) {
        // This migration looks at NgModules and considers the directives (and pipes) it declares.
        // It verifies that these classes have decorators.
        const moduleMeta = host.metadata.getNgModuleMetadata(new Reference(clazz));
        if (moduleMeta === null) {
            // Not an NgModule; don't care.
            return null;
        }
        // Examine each of the declarations to see if it needs to be migrated.
        for (const decl of moduleMeta.declarations) {
            this.maybeMigrate(decl, host);
        }
        return null;
    }
    maybeMigrate(ref, host) {
        if (hasDirectiveDecorator(host, ref.node) || hasPipeDecorator(host, ref.node)) {
            // Stop if one of the classes in the chain is actually decorated with @Directive, @Component,
            // or @Pipe.
            return;
        }
        const baseRef = readBaseClass(ref.node, host.reflectionHost, host.evaluator);
        if (baseRef === null) {
            // Stop: can't migrate a class with no parent.
            return;
        }
        else if (baseRef === 'dynamic') {
            // Stop: can't migrate a class with an indeterminate parent.
            return;
        }
        // Apply the migration recursively, to handle inheritance chains.
        this.maybeMigrate(baseRef, host);
        // After the above call, `host.metadata` should have metadata for the base class, if indeed this
        // is a directive inheritance chain.
        const baseMeta = host.metadata.getDirectiveMetadata(baseRef);
        if (baseMeta === null) {
            // Stop: this isn't a directive inheritance chain after all.
            return;
        }
        // Otherwise, decorate the class with @Component() or @Directive(), as appropriate.
        if (baseMeta.isComponent) {
            host.injectSyntheticDecorator(ref.node, createComponentDecorator(ref.node, baseMeta), HandlerFlags.FULL_INHERITANCE);
        }
        else {
            host.injectSyntheticDecorator(ref.node, createDirectiveDecorator(ref.node, baseMeta), HandlerFlags.FULL_INHERITANCE);
        }
        // Success!
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5kZWNvcmF0ZWRfY2hpbGRfbWlncmF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL21pZ3JhdGlvbnMvdW5kZWNvcmF0ZWRfY2hpbGRfbWlncmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RSxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFckQsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBRzFELE9BQU8sRUFBQyx3QkFBd0IsRUFBRSx3QkFBd0IsRUFBRSxxQkFBcUIsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVwSCxNQUFNLE9BQU8seUJBQXlCO0lBQ3BDLEtBQUssQ0FBQyxLQUF1QixFQUFFLElBQW1CO1FBQ2hELDBGQUEwRjtRQUMxRixrREFBa0Q7UUFDbEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzNFLElBQUksVUFBVSxLQUFLLElBQUksRUFBRTtZQUN2QiwrQkFBK0I7WUFDL0IsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELHNFQUFzRTtRQUN0RSxLQUFLLE1BQU0sSUFBSSxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUU7WUFDMUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDL0I7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxZQUFZLENBQUMsR0FBZ0MsRUFBRSxJQUFtQjtRQUNoRSxJQUFJLHFCQUFxQixDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM3RSw2RkFBNkY7WUFDN0YsWUFBWTtZQUNaLE9BQU87U0FDUjtRQUVELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzdFLElBQUksT0FBTyxLQUFLLElBQUksRUFBRTtZQUNwQiw4Q0FBOEM7WUFDOUMsT0FBTztTQUNSO2FBQU0sSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFO1lBQ2hDLDREQUE0RDtZQUM1RCxPQUFPO1NBQ1I7UUFFRCxpRUFBaUU7UUFDakUsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFakMsZ0dBQWdHO1FBQ2hHLG9DQUFvQztRQUNwQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzdELElBQUksUUFBUSxLQUFLLElBQUksRUFBRTtZQUNyQiw0REFBNEQ7WUFDNUQsT0FBTztTQUNSO1FBRUQsbUZBQW1GO1FBQ25GLElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRTtZQUN4QixJQUFJLENBQUMsd0JBQXdCLENBQ3pCLEdBQUcsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxZQUFZLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztTQUM1RjthQUFNO1lBQ0wsSUFBSSxDQUFDLHdCQUF3QixDQUN6QixHQUFHLENBQUMsSUFBSSxFQUFFLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsWUFBWSxDQUFDLGdCQUFnQixDQUFDLENBQUM7U0FDNUY7UUFFRCxXQUFXO0lBQ2IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge3JlYWRCYXNlQ2xhc3N9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvdXRpbCc7XG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ltcG9ydHMnO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9ufSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvcmVmbGVjdGlvbic7XG5pbXBvcnQge0hhbmRsZXJGbGFnc30gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL3RyYW5zZm9ybSc7XG5cbmltcG9ydCB7TWlncmF0aW9uLCBNaWdyYXRpb25Ib3N0fSBmcm9tICcuL21pZ3JhdGlvbic7XG5pbXBvcnQge2NyZWF0ZUNvbXBvbmVudERlY29yYXRvciwgY3JlYXRlRGlyZWN0aXZlRGVjb3JhdG9yLCBoYXNEaXJlY3RpdmVEZWNvcmF0b3IsIGhhc1BpcGVEZWNvcmF0b3J9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgY2xhc3MgVW5kZWNvcmF0ZWRDaGlsZE1pZ3JhdGlvbiBpbXBsZW1lbnRzIE1pZ3JhdGlvbiB7XG4gIGFwcGx5KGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uLCBob3N0OiBNaWdyYXRpb25Ib3N0KTogdHMuRGlhZ25vc3RpY3xudWxsIHtcbiAgICAvLyBUaGlzIG1pZ3JhdGlvbiBsb29rcyBhdCBOZ01vZHVsZXMgYW5kIGNvbnNpZGVycyB0aGUgZGlyZWN0aXZlcyAoYW5kIHBpcGVzKSBpdCBkZWNsYXJlcy5cbiAgICAvLyBJdCB2ZXJpZmllcyB0aGF0IHRoZXNlIGNsYXNzZXMgaGF2ZSBkZWNvcmF0b3JzLlxuICAgIGNvbnN0IG1vZHVsZU1ldGEgPSBob3N0Lm1ldGFkYXRhLmdldE5nTW9kdWxlTWV0YWRhdGEobmV3IFJlZmVyZW5jZShjbGF6eikpO1xuICAgIGlmIChtb2R1bGVNZXRhID09PSBudWxsKSB7XG4gICAgICAvLyBOb3QgYW4gTmdNb2R1bGU7IGRvbid0IGNhcmUuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBFeGFtaW5lIGVhY2ggb2YgdGhlIGRlY2xhcmF0aW9ucyB0byBzZWUgaWYgaXQgbmVlZHMgdG8gYmUgbWlncmF0ZWQuXG4gICAgZm9yIChjb25zdCBkZWNsIG9mIG1vZHVsZU1ldGEuZGVjbGFyYXRpb25zKSB7XG4gICAgICB0aGlzLm1heWJlTWlncmF0ZShkZWNsLCBob3N0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG1heWJlTWlncmF0ZShyZWY6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPiwgaG9zdDogTWlncmF0aW9uSG9zdCk6IHZvaWQge1xuICAgIGlmIChoYXNEaXJlY3RpdmVEZWNvcmF0b3IoaG9zdCwgcmVmLm5vZGUpIHx8IGhhc1BpcGVEZWNvcmF0b3IoaG9zdCwgcmVmLm5vZGUpKSB7XG4gICAgICAvLyBTdG9wIGlmIG9uZSBvZiB0aGUgY2xhc3NlcyBpbiB0aGUgY2hhaW4gaXMgYWN0dWFsbHkgZGVjb3JhdGVkIHdpdGggQERpcmVjdGl2ZSwgQENvbXBvbmVudCxcbiAgICAgIC8vIG9yIEBQaXBlLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJhc2VSZWYgPSByZWFkQmFzZUNsYXNzKHJlZi5ub2RlLCBob3N0LnJlZmxlY3Rpb25Ib3N0LCBob3N0LmV2YWx1YXRvcik7XG4gICAgaWYgKGJhc2VSZWYgPT09IG51bGwpIHtcbiAgICAgIC8vIFN0b3A6IGNhbid0IG1pZ3JhdGUgYSBjbGFzcyB3aXRoIG5vIHBhcmVudC5cbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGJhc2VSZWYgPT09ICdkeW5hbWljJykge1xuICAgICAgLy8gU3RvcDogY2FuJ3QgbWlncmF0ZSBhIGNsYXNzIHdpdGggYW4gaW5kZXRlcm1pbmF0ZSBwYXJlbnQuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQXBwbHkgdGhlIG1pZ3JhdGlvbiByZWN1cnNpdmVseSwgdG8gaGFuZGxlIGluaGVyaXRhbmNlIGNoYWlucy5cbiAgICB0aGlzLm1heWJlTWlncmF0ZShiYXNlUmVmLCBob3N0KTtcblxuICAgIC8vIEFmdGVyIHRoZSBhYm92ZSBjYWxsLCBgaG9zdC5tZXRhZGF0YWAgc2hvdWxkIGhhdmUgbWV0YWRhdGEgZm9yIHRoZSBiYXNlIGNsYXNzLCBpZiBpbmRlZWQgdGhpc1xuICAgIC8vIGlzIGEgZGlyZWN0aXZlIGluaGVyaXRhbmNlIGNoYWluLlxuICAgIGNvbnN0IGJhc2VNZXRhID0gaG9zdC5tZXRhZGF0YS5nZXREaXJlY3RpdmVNZXRhZGF0YShiYXNlUmVmKTtcbiAgICBpZiAoYmFzZU1ldGEgPT09IG51bGwpIHtcbiAgICAgIC8vIFN0b3A6IHRoaXMgaXNuJ3QgYSBkaXJlY3RpdmUgaW5oZXJpdGFuY2UgY2hhaW4gYWZ0ZXIgYWxsLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSwgZGVjb3JhdGUgdGhlIGNsYXNzIHdpdGggQENvbXBvbmVudCgpIG9yIEBEaXJlY3RpdmUoKSwgYXMgYXBwcm9wcmlhdGUuXG4gICAgaWYgKGJhc2VNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICBob3N0LmluamVjdFN5bnRoZXRpY0RlY29yYXRvcihcbiAgICAgICAgICByZWYubm9kZSwgY3JlYXRlQ29tcG9uZW50RGVjb3JhdG9yKHJlZi5ub2RlLCBiYXNlTWV0YSksIEhhbmRsZXJGbGFncy5GVUxMX0lOSEVSSVRBTkNFKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaG9zdC5pbmplY3RTeW50aGV0aWNEZWNvcmF0b3IoXG4gICAgICAgICAgcmVmLm5vZGUsIGNyZWF0ZURpcmVjdGl2ZURlY29yYXRvcihyZWYubm9kZSwgYmFzZU1ldGEpLCBIYW5kbGVyRmxhZ3MuRlVMTF9JTkhFUklUQU5DRSk7XG4gICAgfVxuXG4gICAgLy8gU3VjY2VzcyFcbiAgfVxufVxuIl19