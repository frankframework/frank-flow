/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export class ReferenceGraph {
    constructor() {
        this.references = new Map();
    }
    add(from, to) {
        if (!this.references.has(from)) {
            this.references.set(from, new Set());
        }
        this.references.get(from).add(to);
    }
    transitiveReferencesOf(target) {
        const set = new Set();
        this.collectTransitiveReferences(set, target);
        return set;
    }
    pathFrom(source, target) {
        return this.collectPathFrom(source, target, new Set());
    }
    collectPathFrom(source, target, seen) {
        if (source === target) {
            // Looking for a path from the target to itself - that path is just the target. This is the
            // "base case" of the search.
            return [target];
        }
        else if (seen.has(source)) {
            // The search has already looked through this source before.
            return null;
        }
        // Consider outgoing edges from `source`.
        seen.add(source);
        if (!this.references.has(source)) {
            // There are no outgoing edges from `source`.
            return null;
        }
        else {
            // Look through the outgoing edges of `source`.
            // TODO(alxhub): use proper iteration when the legacy build is removed. (#27762)
            let candidatePath = null;
            this.references.get(source).forEach(edge => {
                // Early exit if a path has already been found.
                if (candidatePath !== null) {
                    return;
                }
                // Look for a path from this outgoing edge to `target`.
                const partialPath = this.collectPathFrom(edge, target, seen);
                if (partialPath !== null) {
                    // A path exists from `edge` to `target`. Insert `source` at the beginning.
                    candidatePath = [source, ...partialPath];
                }
            });
            return candidatePath;
        }
    }
    collectTransitiveReferences(set, decl) {
        if (this.references.has(decl)) {
            // TODO(alxhub): use proper iteration when the legacy build is removed. (#27762)
            this.references.get(decl).forEach(ref => {
                if (!set.has(ref)) {
                    set.add(ref);
                    this.collectTransitiveReferences(set, ref);
                }
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmZXJlbmNlX2dyYXBoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9lbnRyeV9wb2ludC9zcmMvcmVmZXJlbmNlX2dyYXBoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE1BQU0sT0FBTyxjQUFjO0lBQTNCO1FBQ1UsZUFBVSxHQUFHLElBQUksR0FBRyxFQUFhLENBQUM7SUFrRTVDLENBQUM7SUFoRUMsR0FBRyxDQUFDLElBQU8sRUFBRSxFQUFLO1FBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM5QixJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1NBQ3RDO1FBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxNQUFTO1FBQzlCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFLLENBQUM7UUFDekIsSUFBSSxDQUFDLDJCQUEyQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM5QyxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFRCxRQUFRLENBQUMsTUFBUyxFQUFFLE1BQVM7UUFDM0IsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFTyxlQUFlLENBQUMsTUFBUyxFQUFFLE1BQVMsRUFBRSxJQUFZO1FBQ3hELElBQUksTUFBTSxLQUFLLE1BQU0sRUFBRTtZQUNyQiwyRkFBMkY7WUFDM0YsNkJBQTZCO1lBQzdCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUNqQjthQUFNLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMzQiw0REFBNEQ7WUFDNUQsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELHlDQUF5QztRQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNoQyw2Q0FBNkM7WUFDN0MsT0FBTyxJQUFJLENBQUM7U0FDYjthQUFNO1lBQ0wsK0NBQStDO1lBQy9DLGdGQUFnRjtZQUNoRixJQUFJLGFBQWEsR0FBYSxJQUFJLENBQUM7WUFDbkMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUMxQywrQ0FBK0M7Z0JBQy9DLElBQUksYUFBYSxLQUFLLElBQUksRUFBRTtvQkFDMUIsT0FBTztpQkFDUjtnQkFDRCx1REFBdUQ7Z0JBQ3ZELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO29CQUN4QiwyRUFBMkU7b0JBQzNFLGFBQWEsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDO2lCQUMxQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsT0FBTyxhQUFhLENBQUM7U0FDdEI7SUFDSCxDQUFDO0lBRU8sMkJBQTJCLENBQUMsR0FBVyxFQUFFLElBQU87UUFDdEQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM3QixnRkFBZ0Y7WUFDaEYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUN2QyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDakIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDYixJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUM1QztZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtEZWNsYXJhdGlvbk5vZGV9IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuXG5leHBvcnQgY2xhc3MgUmVmZXJlbmNlR3JhcGg8VCA9IERlY2xhcmF0aW9uTm9kZT4ge1xuICBwcml2YXRlIHJlZmVyZW5jZXMgPSBuZXcgTWFwPFQsIFNldDxUPj4oKTtcblxuICBhZGQoZnJvbTogVCwgdG86IFQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVmZXJlbmNlcy5oYXMoZnJvbSkpIHtcbiAgICAgIHRoaXMucmVmZXJlbmNlcy5zZXQoZnJvbSwgbmV3IFNldCgpKTtcbiAgICB9XG4gICAgdGhpcy5yZWZlcmVuY2VzLmdldChmcm9tKSEuYWRkKHRvKTtcbiAgfVxuXG4gIHRyYW5zaXRpdmVSZWZlcmVuY2VzT2YodGFyZ2V0OiBUKTogU2V0PFQ+IHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PFQ+KCk7XG4gICAgdGhpcy5jb2xsZWN0VHJhbnNpdGl2ZVJlZmVyZW5jZXMoc2V0LCB0YXJnZXQpO1xuICAgIHJldHVybiBzZXQ7XG4gIH1cblxuICBwYXRoRnJvbShzb3VyY2U6IFQsIHRhcmdldDogVCk6IFRbXXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5jb2xsZWN0UGF0aEZyb20oc291cmNlLCB0YXJnZXQsIG5ldyBTZXQoKSk7XG4gIH1cblxuICBwcml2YXRlIGNvbGxlY3RQYXRoRnJvbShzb3VyY2U6IFQsIHRhcmdldDogVCwgc2VlbjogU2V0PFQ+KTogVFtdfG51bGwge1xuICAgIGlmIChzb3VyY2UgPT09IHRhcmdldCkge1xuICAgICAgLy8gTG9va2luZyBmb3IgYSBwYXRoIGZyb20gdGhlIHRhcmdldCB0byBpdHNlbGYgLSB0aGF0IHBhdGggaXMganVzdCB0aGUgdGFyZ2V0LiBUaGlzIGlzIHRoZVxuICAgICAgLy8gXCJiYXNlIGNhc2VcIiBvZiB0aGUgc2VhcmNoLlxuICAgICAgcmV0dXJuIFt0YXJnZXRdO1xuICAgIH0gZWxzZSBpZiAoc2Vlbi5oYXMoc291cmNlKSkge1xuICAgICAgLy8gVGhlIHNlYXJjaCBoYXMgYWxyZWFkeSBsb29rZWQgdGhyb3VnaCB0aGlzIHNvdXJjZSBiZWZvcmUuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgLy8gQ29uc2lkZXIgb3V0Z29pbmcgZWRnZXMgZnJvbSBgc291cmNlYC5cbiAgICBzZWVuLmFkZChzb3VyY2UpO1xuXG4gICAgaWYgKCF0aGlzLnJlZmVyZW5jZXMuaGFzKHNvdXJjZSkpIHtcbiAgICAgIC8vIFRoZXJlIGFyZSBubyBvdXRnb2luZyBlZGdlcyBmcm9tIGBzb3VyY2VgLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIExvb2sgdGhyb3VnaCB0aGUgb3V0Z29pbmcgZWRnZXMgb2YgYHNvdXJjZWAuXG4gICAgICAvLyBUT0RPKGFseGh1Yik6IHVzZSBwcm9wZXIgaXRlcmF0aW9uIHdoZW4gdGhlIGxlZ2FjeSBidWlsZCBpcyByZW1vdmVkLiAoIzI3NzYyKVxuICAgICAgbGV0IGNhbmRpZGF0ZVBhdGg6IFRbXXxudWxsID0gbnVsbDtcbiAgICAgIHRoaXMucmVmZXJlbmNlcy5nZXQoc291cmNlKSEuZm9yRWFjaChlZGdlID0+IHtcbiAgICAgICAgLy8gRWFybHkgZXhpdCBpZiBhIHBhdGggaGFzIGFscmVhZHkgYmVlbiBmb3VuZC5cbiAgICAgICAgaWYgKGNhbmRpZGF0ZVBhdGggIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gTG9vayBmb3IgYSBwYXRoIGZyb20gdGhpcyBvdXRnb2luZyBlZGdlIHRvIGB0YXJnZXRgLlxuICAgICAgICBjb25zdCBwYXJ0aWFsUGF0aCA9IHRoaXMuY29sbGVjdFBhdGhGcm9tKGVkZ2UsIHRhcmdldCwgc2Vlbik7XG4gICAgICAgIGlmIChwYXJ0aWFsUGF0aCAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIEEgcGF0aCBleGlzdHMgZnJvbSBgZWRnZWAgdG8gYHRhcmdldGAuIEluc2VydCBgc291cmNlYCBhdCB0aGUgYmVnaW5uaW5nLlxuICAgICAgICAgIGNhbmRpZGF0ZVBhdGggPSBbc291cmNlLCAuLi5wYXJ0aWFsUGF0aF07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gY2FuZGlkYXRlUGF0aDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNvbGxlY3RUcmFuc2l0aXZlUmVmZXJlbmNlcyhzZXQ6IFNldDxUPiwgZGVjbDogVCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnJlZmVyZW5jZXMuaGFzKGRlY2wpKSB7XG4gICAgICAvLyBUT0RPKGFseGh1Yik6IHVzZSBwcm9wZXIgaXRlcmF0aW9uIHdoZW4gdGhlIGxlZ2FjeSBidWlsZCBpcyByZW1vdmVkLiAoIzI3NzYyKVxuICAgICAgdGhpcy5yZWZlcmVuY2VzLmdldChkZWNsKSEuZm9yRWFjaChyZWYgPT4ge1xuICAgICAgICBpZiAoIXNldC5oYXMocmVmKSkge1xuICAgICAgICAgIHNldC5hZGQocmVmKTtcbiAgICAgICAgICB0aGlzLmNvbGxlY3RUcmFuc2l0aXZlUmVmZXJlbmNlcyhzZXQsIHJlZik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19