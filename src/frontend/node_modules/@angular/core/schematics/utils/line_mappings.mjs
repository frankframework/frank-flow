/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const LF_CHAR = 10;
const CR_CHAR = 13;
const LINE_SEP_CHAR = 8232;
const PARAGRAPH_CHAR = 8233;
/** Gets the line and character for the given position from the line starts map. */
export function getLineAndCharacterFromPosition(lineStartsMap, position) {
    const lineIndex = findClosestLineStartPosition(lineStartsMap, position);
    return { character: position - lineStartsMap[lineIndex], line: lineIndex };
}
/**
 * Computes the line start map of the given text. This can be used in order to
 * retrieve the line and character of a given text position index.
 */
export function computeLineStartsMap(text) {
    const result = [0];
    let pos = 0;
    while (pos < text.length) {
        const char = text.charCodeAt(pos++);
        // Handles the "CRLF" line break. In that case we peek the character
        // after the "CR" and check if it is a line feed.
        if (char === CR_CHAR) {
            if (text.charCodeAt(pos) === LF_CHAR) {
                pos++;
            }
            result.push(pos);
        }
        else if (char === LF_CHAR || char === LINE_SEP_CHAR || char === PARAGRAPH_CHAR) {
            result.push(pos);
        }
    }
    result.push(pos);
    return result;
}
/** Finds the closest line start for the given position. */
function findClosestLineStartPosition(linesMap, position, low = 0, high = linesMap.length - 1) {
    while (low <= high) {
        const pivotIdx = Math.floor((low + high) / 2);
        const pivotEl = linesMap[pivotIdx];
        if (pivotEl === position) {
            return pivotIdx;
        }
        else if (position > pivotEl) {
            low = pivotIdx + 1;
        }
        else {
            high = pivotIdx - 1;
        }
    }
    // In case there was no exact match, return the closest "lower" line index. We also
    // subtract the index by one because want the index of the previous line start.
    return low - 1;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZV9tYXBwaW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy91dGlscy9saW5lX21hcHBpbmdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUNuQixNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDbkIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUU1QixtRkFBbUY7QUFDbkYsTUFBTSxVQUFVLCtCQUErQixDQUFDLGFBQXVCLEVBQUUsUUFBZ0I7SUFDdkYsTUFBTSxTQUFTLEdBQUcsNEJBQTRCLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3hFLE9BQU8sRUFBQyxTQUFTLEVBQUUsUUFBUSxHQUFHLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFDLENBQUM7QUFDM0UsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxJQUFZO0lBQy9DLE1BQU0sTUFBTSxHQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0IsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ1osT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUN4QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDcEMsb0VBQW9FO1FBQ3BFLGlEQUFpRDtRQUNqRCxJQUFJLElBQUksS0FBSyxPQUFPLEVBQUU7WUFDcEIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLE9BQU8sRUFBRTtnQkFDcEMsR0FBRyxFQUFFLENBQUM7YUFDUDtZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDbEI7YUFBTSxJQUFJLElBQUksS0FBSyxPQUFPLElBQUksSUFBSSxLQUFLLGFBQWEsSUFBSSxJQUFJLEtBQUssY0FBYyxFQUFFO1lBQ2hGLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDbEI7S0FDRjtJQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakIsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVELDJEQUEyRDtBQUMzRCxTQUFTLDRCQUE0QixDQUNqQyxRQUFhLEVBQUUsUUFBVyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQztJQUNqRSxPQUFPLEdBQUcsSUFBSSxJQUFJLEVBQUU7UUFDbEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM5QyxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFbkMsSUFBSSxPQUFPLEtBQUssUUFBUSxFQUFFO1lBQ3hCLE9BQU8sUUFBUSxDQUFDO1NBQ2pCO2FBQU0sSUFBSSxRQUFRLEdBQUcsT0FBTyxFQUFFO1lBQzdCLEdBQUcsR0FBRyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1NBQ3BCO2FBQU07WUFDTCxJQUFJLEdBQUcsUUFBUSxHQUFHLENBQUMsQ0FBQztTQUNyQjtLQUNGO0lBRUQsbUZBQW1GO0lBQ25GLCtFQUErRTtJQUMvRSxPQUFPLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDakIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5jb25zdCBMRl9DSEFSID0gMTA7XG5jb25zdCBDUl9DSEFSID0gMTM7XG5jb25zdCBMSU5FX1NFUF9DSEFSID0gODIzMjtcbmNvbnN0IFBBUkFHUkFQSF9DSEFSID0gODIzMztcblxuLyoqIEdldHMgdGhlIGxpbmUgYW5kIGNoYXJhY3RlciBmb3IgdGhlIGdpdmVuIHBvc2l0aW9uIGZyb20gdGhlIGxpbmUgc3RhcnRzIG1hcC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMaW5lQW5kQ2hhcmFjdGVyRnJvbVBvc2l0aW9uKGxpbmVTdGFydHNNYXA6IG51bWJlcltdLCBwb3NpdGlvbjogbnVtYmVyKSB7XG4gIGNvbnN0IGxpbmVJbmRleCA9IGZpbmRDbG9zZXN0TGluZVN0YXJ0UG9zaXRpb24obGluZVN0YXJ0c01hcCwgcG9zaXRpb24pO1xuICByZXR1cm4ge2NoYXJhY3RlcjogcG9zaXRpb24gLSBsaW5lU3RhcnRzTWFwW2xpbmVJbmRleF0sIGxpbmU6IGxpbmVJbmRleH07XG59XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIGxpbmUgc3RhcnQgbWFwIG9mIHRoZSBnaXZlbiB0ZXh0LiBUaGlzIGNhbiBiZSB1c2VkIGluIG9yZGVyIHRvXG4gKiByZXRyaWV2ZSB0aGUgbGluZSBhbmQgY2hhcmFjdGVyIG9mIGEgZ2l2ZW4gdGV4dCBwb3NpdGlvbiBpbmRleC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVMaW5lU3RhcnRzTWFwKHRleHQ6IHN0cmluZyk6IG51bWJlcltdIHtcbiAgY29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFswXTtcbiAgbGV0IHBvcyA9IDA7XG4gIHdoaWxlIChwb3MgPCB0ZXh0Lmxlbmd0aCkge1xuICAgIGNvbnN0IGNoYXIgPSB0ZXh0LmNoYXJDb2RlQXQocG9zKyspO1xuICAgIC8vIEhhbmRsZXMgdGhlIFwiQ1JMRlwiIGxpbmUgYnJlYWsuIEluIHRoYXQgY2FzZSB3ZSBwZWVrIHRoZSBjaGFyYWN0ZXJcbiAgICAvLyBhZnRlciB0aGUgXCJDUlwiIGFuZCBjaGVjayBpZiBpdCBpcyBhIGxpbmUgZmVlZC5cbiAgICBpZiAoY2hhciA9PT0gQ1JfQ0hBUikge1xuICAgICAgaWYgKHRleHQuY2hhckNvZGVBdChwb3MpID09PSBMRl9DSEFSKSB7XG4gICAgICAgIHBvcysrO1xuICAgICAgfVxuICAgICAgcmVzdWx0LnB1c2gocG9zKTtcbiAgICB9IGVsc2UgaWYgKGNoYXIgPT09IExGX0NIQVIgfHwgY2hhciA9PT0gTElORV9TRVBfQ0hBUiB8fCBjaGFyID09PSBQQVJBR1JBUEhfQ0hBUikge1xuICAgICAgcmVzdWx0LnB1c2gocG9zKTtcbiAgICB9XG4gIH1cbiAgcmVzdWx0LnB1c2gocG9zKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIEZpbmRzIHRoZSBjbG9zZXN0IGxpbmUgc3RhcnQgZm9yIHRoZSBnaXZlbiBwb3NpdGlvbi4gKi9cbmZ1bmN0aW9uIGZpbmRDbG9zZXN0TGluZVN0YXJ0UG9zaXRpb248VD4oXG4gICAgbGluZXNNYXA6IFRbXSwgcG9zaXRpb246IFQsIGxvdyA9IDAsIGhpZ2ggPSBsaW5lc01hcC5sZW5ndGggLSAxKSB7XG4gIHdoaWxlIChsb3cgPD0gaGlnaCkge1xuICAgIGNvbnN0IHBpdm90SWR4ID0gTWF0aC5mbG9vcigobG93ICsgaGlnaCkgLyAyKTtcbiAgICBjb25zdCBwaXZvdEVsID0gbGluZXNNYXBbcGl2b3RJZHhdO1xuXG4gICAgaWYgKHBpdm90RWwgPT09IHBvc2l0aW9uKSB7XG4gICAgICByZXR1cm4gcGl2b3RJZHg7XG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA+IHBpdm90RWwpIHtcbiAgICAgIGxvdyA9IHBpdm90SWR4ICsgMTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGlnaCA9IHBpdm90SWR4IC0gMTtcbiAgICB9XG4gIH1cblxuICAvLyBJbiBjYXNlIHRoZXJlIHdhcyBubyBleGFjdCBtYXRjaCwgcmV0dXJuIHRoZSBjbG9zZXN0IFwibG93ZXJcIiBsaW5lIGluZGV4LiBXZSBhbHNvXG4gIC8vIHN1YnRyYWN0IHRoZSBpbmRleCBieSBvbmUgYmVjYXVzZSB3YW50IHRoZSBpbmRleCBvZiB0aGUgcHJldmlvdXMgbGluZSBzdGFydC5cbiAgcmV0dXJuIGxvdyAtIDE7XG59XG4iXX0=