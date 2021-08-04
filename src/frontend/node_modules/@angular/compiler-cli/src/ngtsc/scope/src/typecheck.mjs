/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CssSelector, SelectorMatcher } from '@angular/compiler';
import * as ts from 'typescript';
import { flattenInheritedDirectiveMetadata } from '../../metadata';
/**
 * Computes scope information to be used in template type checking.
 */
export class TypeCheckScopeRegistry {
    constructor(scopeReader, metaReader) {
        this.scopeReader = scopeReader;
        this.metaReader = metaReader;
        /**
         * Cache of flattened directive metadata. Because flattened metadata is scope-invariant it's
         * cached individually, such that all scopes refer to the same flattened metadata.
         */
        this.flattenedDirectiveMetaCache = new Map();
        /**
         * Cache of the computed type check scope per NgModule declaration.
         */
        this.scopeCache = new Map();
    }
    /**
     * Computes the type-check scope information for the component declaration. If the NgModule
     * contains an error, then 'error' is returned. If the component is not declared in any NgModule,
     * an empty type-check scope is returned.
     */
    getTypeCheckScope(node) {
        const matcher = new SelectorMatcher();
        const directives = [];
        const pipes = new Map();
        const scope = this.scopeReader.getScopeForComponent(node);
        if (scope === null) {
            return {
                matcher,
                directives,
                pipes,
                schemas: [],
                isPoisoned: false,
            };
        }
        if (this.scopeCache.has(scope.ngModule)) {
            return this.scopeCache.get(scope.ngModule);
        }
        for (const meta of scope.compilation.directives) {
            if (meta.selector !== null) {
                const extMeta = this.getTypeCheckDirectiveMetadata(meta.ref);
                matcher.addSelectables(CssSelector.parse(meta.selector), extMeta);
                directives.push(extMeta);
            }
        }
        for (const { name, ref } of scope.compilation.pipes) {
            if (!ts.isClassDeclaration(ref.node)) {
                throw new Error(`Unexpected non-class declaration ${ts.SyntaxKind[ref.node.kind]} for pipe ${ref.debugName}`);
            }
            pipes.set(name, ref);
        }
        const typeCheckScope = {
            matcher,
            directives,
            pipes,
            schemas: scope.schemas,
            isPoisoned: scope.compilation.isPoisoned || scope.exported.isPoisoned,
        };
        this.scopeCache.set(scope.ngModule, typeCheckScope);
        return typeCheckScope;
    }
    getTypeCheckDirectiveMetadata(ref) {
        const clazz = ref.node;
        if (this.flattenedDirectiveMetaCache.has(clazz)) {
            return this.flattenedDirectiveMetaCache.get(clazz);
        }
        const meta = flattenInheritedDirectiveMetadata(this.metaReader, ref);
        this.flattenedDirectiveMetaCache.set(clazz, meta);
        return meta;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZWNoZWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9zY29wZS9zcmMvdHlwZWNoZWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQWtCLGVBQWUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQy9FLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBR2pDLE9BQU8sRUFBZ0IsaUNBQWlDLEVBQWlCLE1BQU0sZ0JBQWdCLENBQUM7QUFxQ2hHOztHQUVHO0FBQ0gsTUFBTSxPQUFPLHNCQUFzQjtJQVlqQyxZQUFvQixXQUFpQyxFQUFVLFVBQTBCO1FBQXJFLGdCQUFXLEdBQVgsV0FBVyxDQUFzQjtRQUFVLGVBQVUsR0FBVixVQUFVLENBQWdCO1FBWHpGOzs7V0FHRztRQUNLLGdDQUEyQixHQUFHLElBQUksR0FBRyxFQUFtQyxDQUFDO1FBRWpGOztXQUVHO1FBQ0ssZUFBVSxHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBRTJCLENBQUM7SUFFN0Y7Ozs7T0FJRztJQUNILGlCQUFpQixDQUFDLElBQXNCO1FBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksZUFBZSxFQUFpQixDQUFDO1FBQ3JELE1BQU0sVUFBVSxHQUFvQixFQUFFLENBQUM7UUFDdkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQTRELENBQUM7UUFFbEYsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxRCxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFDbEIsT0FBTztnQkFDTCxPQUFPO2dCQUNQLFVBQVU7Z0JBQ1YsS0FBSztnQkFDTCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxVQUFVLEVBQUUsS0FBSzthQUNsQixDQUFDO1NBQ0g7UUFFRCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUN2QyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUUsQ0FBQztTQUM3QztRQUVELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUU7WUFDL0MsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtnQkFDMUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDN0QsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDbEUsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUMxQjtTQUNGO1FBRUQsS0FBSyxNQUFNLEVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBQyxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO1lBQ2pELElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLG9DQUNaLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQzthQUMvRDtZQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQXVELENBQUMsQ0FBQztTQUMxRTtRQUVELE1BQU0sY0FBYyxHQUFtQjtZQUNyQyxPQUFPO1lBQ1AsVUFBVTtZQUNWLEtBQUs7WUFDTCxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU87WUFDdEIsVUFBVSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVTtTQUN0RSxDQUFDO1FBQ0YsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNwRCxPQUFPLGNBQWMsQ0FBQztJQUN4QixDQUFDO0lBRUQsNkJBQTZCLENBQUMsR0FBZ0M7UUFDNUQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUN2QixJQUFJLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDL0MsT0FBTyxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBRSxDQUFDO1NBQ3JEO1FBRUQsTUFBTSxJQUFJLEdBQUcsaUNBQWlDLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNyRSxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNsRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTY2hlbWFNZXRhZGF0YSwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtEaXJlY3RpdmVNZXRhLCBmbGF0dGVuSW5oZXJpdGVkRGlyZWN0aXZlTWV0YWRhdGEsIE1ldGFkYXRhUmVhZGVyfSBmcm9tICcuLi8uLi9tZXRhZGF0YSc7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb259IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuXG5pbXBvcnQge0NvbXBvbmVudFNjb3BlUmVhZGVyfSBmcm9tICcuL2NvbXBvbmVudF9zY29wZSc7XG5cbi8qKlxuICogVGhlIHNjb3BlIHRoYXQgaXMgdXNlZCBmb3IgdHlwZS1jaGVjayBjb2RlIGdlbmVyYXRpb24gb2YgYSBjb21wb25lbnQgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZUNoZWNrU2NvcGUge1xuICAvKipcbiAgICogQSBgU2VsZWN0b3JNYXRjaGVyYCBpbnN0YW5jZSB0aGF0IGNvbnRhaW5zIHRoZSBmbGF0dGVuZWQgZGlyZWN0aXZlIG1ldGFkYXRhIG9mIGFsbCBkaXJlY3RpdmVzXG4gICAqIHRoYXQgYXJlIGluIHRoZSBjb21waWxhdGlvbiBzY29wZSBvZiB0aGUgZGVjbGFyaW5nIE5nTW9kdWxlLlxuICAgKi9cbiAgbWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZU1ldGE+O1xuXG4gIC8qKlxuICAgKiBBbGwgb2YgdGhlIGRpcmVjdGl2ZXMgYXZhaWxhYmxlIGluIHRoZSBjb21waWxhdGlvbiBzY29wZSBvZiB0aGUgZGVjbGFyaW5nIE5nTW9kdWxlLlxuICAgKi9cbiAgZGlyZWN0aXZlczogRGlyZWN0aXZlTWV0YVtdO1xuXG4gIC8qKlxuICAgKiBUaGUgcGlwZXMgdGhhdCBhcmUgYXZhaWxhYmxlIGluIHRoZSBjb21waWxhdGlvbiBzY29wZS5cbiAgICovXG4gIHBpcGVzOiBNYXA8c3RyaW5nLCBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4+O1xuXG4gIC8qKlxuICAgKiBUaGUgc2NoZW1hcyB0aGF0IGFyZSB1c2VkIGluIHRoaXMgc2NvcGUuXG4gICAqL1xuICBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBvcmlnaW5hbCBjb21waWxhdGlvbiBzY29wZSB3aGljaCBwcm9kdWNlZCB0aGlzIGBUeXBlQ2hlY2tTY29wZWAgd2FzIGl0c2VsZiBwb2lzb25lZFxuICAgKiAoY29udGFpbmVkIHNlbWFudGljIGVycm9ycyBkdXJpbmcgaXRzIHByb2R1Y3Rpb24pLlxuICAgKi9cbiAgaXNQb2lzb25lZDogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBDb21wdXRlcyBzY29wZSBpbmZvcm1hdGlvbiB0byBiZSB1c2VkIGluIHRlbXBsYXRlIHR5cGUgY2hlY2tpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBUeXBlQ2hlY2tTY29wZVJlZ2lzdHJ5IHtcbiAgLyoqXG4gICAqIENhY2hlIG9mIGZsYXR0ZW5lZCBkaXJlY3RpdmUgbWV0YWRhdGEuIEJlY2F1c2UgZmxhdHRlbmVkIG1ldGFkYXRhIGlzIHNjb3BlLWludmFyaWFudCBpdCdzXG4gICAqIGNhY2hlZCBpbmRpdmlkdWFsbHksIHN1Y2ggdGhhdCBhbGwgc2NvcGVzIHJlZmVyIHRvIHRoZSBzYW1lIGZsYXR0ZW5lZCBtZXRhZGF0YS5cbiAgICovXG4gIHByaXZhdGUgZmxhdHRlbmVkRGlyZWN0aXZlTWV0YUNhY2hlID0gbmV3IE1hcDxDbGFzc0RlY2xhcmF0aW9uLCBEaXJlY3RpdmVNZXRhPigpO1xuXG4gIC8qKlxuICAgKiBDYWNoZSBvZiB0aGUgY29tcHV0ZWQgdHlwZSBjaGVjayBzY29wZSBwZXIgTmdNb2R1bGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIHNjb3BlQ2FjaGUgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIFR5cGVDaGVja1Njb3BlPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc2NvcGVSZWFkZXI6IENvbXBvbmVudFNjb3BlUmVhZGVyLCBwcml2YXRlIG1ldGFSZWFkZXI6IE1ldGFkYXRhUmVhZGVyKSB7fVxuXG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgdHlwZS1jaGVjayBzY29wZSBpbmZvcm1hdGlvbiBmb3IgdGhlIGNvbXBvbmVudCBkZWNsYXJhdGlvbi4gSWYgdGhlIE5nTW9kdWxlXG4gICAqIGNvbnRhaW5zIGFuIGVycm9yLCB0aGVuICdlcnJvcicgaXMgcmV0dXJuZWQuIElmIHRoZSBjb21wb25lbnQgaXMgbm90IGRlY2xhcmVkIGluIGFueSBOZ01vZHVsZSxcbiAgICogYW4gZW1wdHkgdHlwZS1jaGVjayBzY29wZSBpcyByZXR1cm5lZC5cbiAgICovXG4gIGdldFR5cGVDaGVja1Njb3BlKG5vZGU6IENsYXNzRGVjbGFyYXRpb24pOiBUeXBlQ2hlY2tTY29wZSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlTWV0YT4oKTtcbiAgICBjb25zdCBkaXJlY3RpdmVzOiBEaXJlY3RpdmVNZXRhW10gPSBbXTtcbiAgICBjb25zdCBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4+KCk7XG5cbiAgICBjb25zdCBzY29wZSA9IHRoaXMuc2NvcGVSZWFkZXIuZ2V0U2NvcGVGb3JDb21wb25lbnQobm9kZSk7XG4gICAgaWYgKHNjb3BlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBtYXRjaGVyLFxuICAgICAgICBkaXJlY3RpdmVzLFxuICAgICAgICBwaXBlcyxcbiAgICAgICAgc2NoZW1hczogW10sXG4gICAgICAgIGlzUG9pc29uZWQ6IGZhbHNlLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zY29wZUNhY2hlLmhhcyhzY29wZS5uZ01vZHVsZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjb3BlQ2FjaGUuZ2V0KHNjb3BlLm5nTW9kdWxlKSE7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtZXRhIG9mIHNjb3BlLmNvbXBpbGF0aW9uLmRpcmVjdGl2ZXMpIHtcbiAgICAgIGlmIChtZXRhLnNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGV4dE1ldGEgPSB0aGlzLmdldFR5cGVDaGVja0RpcmVjdGl2ZU1ldGFkYXRhKG1ldGEucmVmKTtcbiAgICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKSwgZXh0TWV0YSk7XG4gICAgICAgIGRpcmVjdGl2ZXMucHVzaChleHRNZXRhKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHtuYW1lLCByZWZ9IG9mIHNjb3BlLmNvbXBpbGF0aW9uLnBpcGVzKSB7XG4gICAgICBpZiAoIXRzLmlzQ2xhc3NEZWNsYXJhdGlvbihyZWYubm9kZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIG5vbi1jbGFzcyBkZWNsYXJhdGlvbiAke1xuICAgICAgICAgICAgdHMuU3ludGF4S2luZFtyZWYubm9kZS5raW5kXX0gZm9yIHBpcGUgJHtyZWYuZGVidWdOYW1lfWApO1xuICAgICAgfVxuICAgICAgcGlwZXMuc2V0KG5hbWUsIHJlZiBhcyBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4pO1xuICAgIH1cblxuICAgIGNvbnN0IHR5cGVDaGVja1Njb3BlOiBUeXBlQ2hlY2tTY29wZSA9IHtcbiAgICAgIG1hdGNoZXIsXG4gICAgICBkaXJlY3RpdmVzLFxuICAgICAgcGlwZXMsXG4gICAgICBzY2hlbWFzOiBzY29wZS5zY2hlbWFzLFxuICAgICAgaXNQb2lzb25lZDogc2NvcGUuY29tcGlsYXRpb24uaXNQb2lzb25lZCB8fCBzY29wZS5leHBvcnRlZC5pc1BvaXNvbmVkLFxuICAgIH07XG4gICAgdGhpcy5zY29wZUNhY2hlLnNldChzY29wZS5uZ01vZHVsZSwgdHlwZUNoZWNrU2NvcGUpO1xuICAgIHJldHVybiB0eXBlQ2hlY2tTY29wZTtcbiAgfVxuXG4gIGdldFR5cGVDaGVja0RpcmVjdGl2ZU1ldGFkYXRhKHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+KTogRGlyZWN0aXZlTWV0YSB7XG4gICAgY29uc3QgY2xhenogPSByZWYubm9kZTtcbiAgICBpZiAodGhpcy5mbGF0dGVuZWREaXJlY3RpdmVNZXRhQ2FjaGUuaGFzKGNsYXp6KSkge1xuICAgICAgcmV0dXJuIHRoaXMuZmxhdHRlbmVkRGlyZWN0aXZlTWV0YUNhY2hlLmdldChjbGF6eikhO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGEgPSBmbGF0dGVuSW5oZXJpdGVkRGlyZWN0aXZlTWV0YWRhdGEodGhpcy5tZXRhUmVhZGVyLCByZWYpO1xuICAgIHRoaXMuZmxhdHRlbmVkRGlyZWN0aXZlTWV0YUNhY2hlLnNldChjbGF6eiwgbWV0YSk7XG4gICAgcmV0dXJuIG1ldGE7XG4gIH1cbn1cbiJdfQ==