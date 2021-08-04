/**
 * Determines whether the provided symbols represent the same declaration.
 */
export function isSymbolEqual(a, b) {
    if (a.decl === b.decl) {
        // If the declaration is identical then it must represent the same symbol.
        return true;
    }
    if (a.identifier === null || b.identifier === null) {
        // Unidentifiable symbols are assumed to be different.
        return false;
    }
    return a.path === b.path && a.identifier === b.identifier;
}
/**
 * Determines whether the provided references to a semantic symbol are still equal, i.e. represent
 * the same symbol and are imported by the same path.
 */
export function isReferenceEqual(a, b) {
    if (!isSymbolEqual(a.symbol, b.symbol)) {
        // If the reference's target symbols are different, the reference itself is different.
        return false;
    }
    // The reference still corresponds with the same symbol, now check that the path by which it is
    // imported has not changed.
    return a.importPath === b.importPath;
}
export function referenceEquality(a, b) {
    return a === b;
}
/**
 * Determines if the provided arrays are equal to each other, using the provided equality tester
 * that is called for all entries in the array.
 */
export function isArrayEqual(a, b, equalityTester = referenceEquality) {
    if (a === null || b === null) {
        return a === b;
    }
    if (a.length !== b.length) {
        return false;
    }
    return !a.some((item, index) => !equalityTester(item, b[index]));
}
/**
 * Determines if the provided sets are equal to each other, using the provided equality tester.
 * Sets that only differ in ordering are considered equal.
 */
export function isSetEqual(a, b, equalityTester = referenceEquality) {
    if (a === null || b === null) {
        return a === b;
    }
    if (a.size !== b.size) {
        return false;
    }
    for (const itemA of a) {
        let found = false;
        for (const itemB of b) {
            if (equalityTester(itemA, itemB)) {
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvaW5jcmVtZW50YWwvc2VtYW50aWNfZ3JhcGgvc3JjL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0E7O0dBRUc7QUFDSCxNQUFNLFVBQVUsYUFBYSxDQUFDLENBQWlCLEVBQUUsQ0FBaUI7SUFDaEUsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFDckIsMEVBQTBFO1FBQzFFLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO1FBQ2xELHNEQUFzRDtRQUN0RCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQzVELENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsQ0FBb0IsRUFBRSxDQUFvQjtJQUN6RSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3RDLHNGQUFzRjtRQUN0RixPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsK0ZBQStGO0lBQy9GLDRCQUE0QjtJQUM1QixPQUFPLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUN2QyxDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQixDQUFJLENBQUksRUFBRSxDQUFJO0lBQzdDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNqQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLFlBQVksQ0FDeEIsQ0FBb0IsRUFBRSxDQUFvQixFQUMxQyxpQkFBMEMsaUJBQWlCO0lBQzdELElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQzVCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNoQjtJQUVELElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFO1FBQ3pCLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25FLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsVUFBVSxDQUN0QixDQUFzQixFQUFFLENBQXNCLEVBQzlDLGlCQUEwQyxpQkFBaUI7SUFDN0QsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLEVBQUU7UUFDNUIsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2hCO0lBRUQsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFDckIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELEtBQUssTUFBTSxLQUFLLElBQUksQ0FBQyxFQUFFO1FBQ3JCLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNsQixLQUFLLE1BQU0sS0FBSyxJQUFJLENBQUMsRUFBRTtZQUNyQixJQUFJLGNBQWMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7Z0JBQ2hDLEtBQUssR0FBRyxJQUFJLENBQUM7Z0JBQ2IsTUFBTTthQUNQO1NBQ0Y7UUFDRCxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsT0FBTyxLQUFLLENBQUM7U0FDZDtLQUNGO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1NlbWFudGljUmVmZXJlbmNlLCBTZW1hbnRpY1N5bWJvbH0gZnJvbSAnLi9hcGknO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgcHJvdmlkZWQgc3ltYm9scyByZXByZXNlbnQgdGhlIHNhbWUgZGVjbGFyYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N5bWJvbEVxdWFsKGE6IFNlbWFudGljU3ltYm9sLCBiOiBTZW1hbnRpY1N5bWJvbCk6IGJvb2xlYW4ge1xuICBpZiAoYS5kZWNsID09PSBiLmRlY2wpIHtcbiAgICAvLyBJZiB0aGUgZGVjbGFyYXRpb24gaXMgaWRlbnRpY2FsIHRoZW4gaXQgbXVzdCByZXByZXNlbnQgdGhlIHNhbWUgc3ltYm9sLlxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKGEuaWRlbnRpZmllciA9PT0gbnVsbCB8fCBiLmlkZW50aWZpZXIgPT09IG51bGwpIHtcbiAgICAvLyBVbmlkZW50aWZpYWJsZSBzeW1ib2xzIGFyZSBhc3N1bWVkIHRvIGJlIGRpZmZlcmVudC5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYS5wYXRoID09PSBiLnBhdGggJiYgYS5pZGVudGlmaWVyID09PSBiLmlkZW50aWZpZXI7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBwcm92aWRlZCByZWZlcmVuY2VzIHRvIGEgc2VtYW50aWMgc3ltYm9sIGFyZSBzdGlsbCBlcXVhbCwgaS5lLiByZXByZXNlbnRcbiAqIHRoZSBzYW1lIHN5bWJvbCBhbmQgYXJlIGltcG9ydGVkIGJ5IHRoZSBzYW1lIHBhdGguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlZmVyZW5jZUVxdWFsKGE6IFNlbWFudGljUmVmZXJlbmNlLCBiOiBTZW1hbnRpY1JlZmVyZW5jZSk6IGJvb2xlYW4ge1xuICBpZiAoIWlzU3ltYm9sRXF1YWwoYS5zeW1ib2wsIGIuc3ltYm9sKSkge1xuICAgIC8vIElmIHRoZSByZWZlcmVuY2UncyB0YXJnZXQgc3ltYm9scyBhcmUgZGlmZmVyZW50LCB0aGUgcmVmZXJlbmNlIGl0c2VsZiBpcyBkaWZmZXJlbnQuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gVGhlIHJlZmVyZW5jZSBzdGlsbCBjb3JyZXNwb25kcyB3aXRoIHRoZSBzYW1lIHN5bWJvbCwgbm93IGNoZWNrIHRoYXQgdGhlIHBhdGggYnkgd2hpY2ggaXQgaXNcbiAgLy8gaW1wb3J0ZWQgaGFzIG5vdCBjaGFuZ2VkLlxuICByZXR1cm4gYS5pbXBvcnRQYXRoID09PSBiLmltcG9ydFBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZlcmVuY2VFcXVhbGl0eTxUPihhOiBULCBiOiBUKTogYm9vbGVhbiB7XG4gIHJldHVybiBhID09PSBiO1xufVxuXG4vKipcbiAqIERldGVybWluZXMgaWYgdGhlIHByb3ZpZGVkIGFycmF5cyBhcmUgZXF1YWwgdG8gZWFjaCBvdGhlciwgdXNpbmcgdGhlIHByb3ZpZGVkIGVxdWFsaXR5IHRlc3RlclxuICogdGhhdCBpcyBjYWxsZWQgZm9yIGFsbCBlbnRyaWVzIGluIHRoZSBhcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXlFcXVhbDxUPihcbiAgICBhOiByZWFkb25seSBUW118bnVsbCwgYjogcmVhZG9ubHkgVFtdfG51bGwsXG4gICAgZXF1YWxpdHlUZXN0ZXI6IChhOiBULCBiOiBUKSA9PiBib29sZWFuID0gcmVmZXJlbmNlRXF1YWxpdHkpOiBib29sZWFuIHtcbiAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG5cbiAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiAhYS5zb21lKChpdGVtLCBpbmRleCkgPT4gIWVxdWFsaXR5VGVzdGVyKGl0ZW0sIGJbaW5kZXhdKSk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiB0aGUgcHJvdmlkZWQgc2V0cyBhcmUgZXF1YWwgdG8gZWFjaCBvdGhlciwgdXNpbmcgdGhlIHByb3ZpZGVkIGVxdWFsaXR5IHRlc3Rlci5cbiAqIFNldHMgdGhhdCBvbmx5IGRpZmZlciBpbiBvcmRlcmluZyBhcmUgY29uc2lkZXJlZCBlcXVhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2V0RXF1YWw8VD4oXG4gICAgYTogUmVhZG9ubHlTZXQ8VD58bnVsbCwgYjogUmVhZG9ubHlTZXQ8VD58bnVsbCxcbiAgICBlcXVhbGl0eVRlc3RlcjogKGE6IFQsIGI6IFQpID0+IGJvb2xlYW4gPSByZWZlcmVuY2VFcXVhbGl0eSk6IGJvb2xlYW4ge1xuICBpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cblxuICBpZiAoYS5zaXplICE9PSBiLnNpemUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmb3IgKGNvbnN0IGl0ZW1BIG9mIGEpIHtcbiAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IGl0ZW1CIG9mIGIpIHtcbiAgICAgIGlmIChlcXVhbGl0eVRlc3RlcihpdGVtQSwgaXRlbUIpKSB7XG4gICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghZm91bmQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cbiJdfQ==