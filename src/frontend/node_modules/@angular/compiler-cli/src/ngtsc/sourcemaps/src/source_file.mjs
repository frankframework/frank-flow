/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { removeComments, removeMapFileComments } from 'convert-source-map';
import { decode, encode } from 'sourcemap-codec';
import { compareSegments, offsetSegment } from './segment_marker';
export function removeSourceMapComments(contents) {
    return removeMapFileComments(removeComments(contents)).replace(/\n\n$/, '\n');
}
export class SourceFile {
    constructor(
    /** The path to this source file. */
    sourcePath, 
    /** The contents of this source file. */
    contents, 
    /** The raw source map (if any) referenced by this source file. */
    rawMap, 
    /** Any source files referenced by the raw source map associated with this source file. */
    sources, fs) {
        this.sourcePath = sourcePath;
        this.contents = contents;
        this.rawMap = rawMap;
        this.sources = sources;
        this.fs = fs;
        this.contents = removeSourceMapComments(contents);
        this.startOfLinePositions = computeStartOfLinePositions(this.contents);
        this.flattenedMappings = this.flattenMappings();
    }
    /**
     * Render the raw source map generated from the flattened mappings.
     */
    renderFlattenedSourceMap() {
        const sources = new IndexedMap();
        const names = new IndexedSet();
        const mappings = [];
        const sourcePathDir = this.fs.dirname(this.sourcePath);
        // Computing the relative path can be expensive, and we are likely to have the same path for
        // many (if not all!) mappings.
        const relativeSourcePathCache = new Cache(input => this.fs.relative(sourcePathDir, input));
        for (const mapping of this.flattenedMappings) {
            const sourceIndex = sources.set(relativeSourcePathCache.get(mapping.originalSource.sourcePath), mapping.originalSource.contents);
            const mappingArray = [
                mapping.generatedSegment.column,
                sourceIndex,
                mapping.originalSegment.line,
                mapping.originalSegment.column,
            ];
            if (mapping.name !== undefined) {
                const nameIndex = names.add(mapping.name);
                mappingArray.push(nameIndex);
            }
            // Ensure a mapping line array for this mapping.
            const line = mapping.generatedSegment.line;
            while (line >= mappings.length) {
                mappings.push([]);
            }
            // Add this mapping to the line
            mappings[line].push(mappingArray);
        }
        const sourceMap = {
            version: 3,
            file: this.fs.relative(sourcePathDir, this.sourcePath),
            sources: sources.keys,
            names: names.values,
            mappings: encode(mappings),
            sourcesContent: sources.values,
        };
        return sourceMap;
    }
    /**
     * Find the original mapped location for the given `line` and `column` in the generated file.
     *
     * First we search for a mapping whose generated segment is at or directly before the given
     * location. Then we compute the offset between the given location and the matching generated
     * segment. Finally we apply this offset to the original source segment to get the desired
     * original location.
     */
    getOriginalLocation(line, column) {
        if (this.flattenedMappings.length === 0) {
            return null;
        }
        let position;
        if (line < this.startOfLinePositions.length) {
            position = this.startOfLinePositions[line] + column;
        }
        else {
            // The line is off the end of the file, so just assume we are at the end of the file.
            position = this.contents.length;
        }
        const locationSegment = { line, column, position, next: undefined };
        let mappingIndex = findLastMappingIndexBefore(this.flattenedMappings, locationSegment, false, 0);
        if (mappingIndex < 0) {
            mappingIndex = 0;
        }
        const { originalSegment, originalSource, generatedSegment } = this.flattenedMappings[mappingIndex];
        const offset = locationSegment.position - generatedSegment.position;
        const offsetOriginalSegment = offsetSegment(originalSource.startOfLinePositions, originalSegment, offset);
        return {
            file: originalSource.sourcePath,
            line: offsetOriginalSegment.line,
            column: offsetOriginalSegment.column,
        };
    }
    /**
     * Flatten the parsed mappings for this source file, so that all the mappings are to pure original
     * source files with no transitive source maps.
     */
    flattenMappings() {
        const mappings = parseMappings(this.rawMap && this.rawMap.map, this.sources, this.startOfLinePositions);
        ensureOriginalSegmentLinks(mappings);
        const flattenedMappings = [];
        for (let mappingIndex = 0; mappingIndex < mappings.length; mappingIndex++) {
            const aToBmapping = mappings[mappingIndex];
            const bSource = aToBmapping.originalSource;
            if (bSource.flattenedMappings.length === 0) {
                // The b source file has no mappings of its own (i.e. it is a pure original file)
                // so just use the mapping as-is.
                flattenedMappings.push(aToBmapping);
                continue;
            }
            // The `incomingStart` and `incomingEnd` are the `SegmentMarker`s in `B` that represent the
            // section of `B` source file that is being mapped to by the current `aToBmapping`.
            //
            // For example, consider the mappings from A to B:
            //
            // src A   src B     mapping
            //
            //   a ----- a       [0, 0]
            //   b       b
            //   f -  /- c       [4, 2]
            //   g  \ /  d
            //   c -/\   e
            //   d    \- f       [2, 5]
            //   e
            //
            // For mapping [0,0] the incoming start and end are 0 and 2 (i.e. the range a, b, c)
            // For mapping [4,2] the incoming start and end are 2 and 5 (i.e. the range c, d, e, f)
            //
            const incomingStart = aToBmapping.originalSegment;
            const incomingEnd = incomingStart.next;
            // The `outgoingStartIndex` and `outgoingEndIndex` are the indices of the range of mappings
            // that leave `b` that we are interested in merging with the aToBmapping.
            // We actually care about all the markers from the last bToCmapping directly before the
            // `incomingStart` to the last bToCmaping directly before the `incomingEnd`, inclusive.
            //
            // For example, if we consider the range 2 to 5 from above (i.e. c, d, e, f) with the
            // following mappings from B to C:
            //
            //   src B   src C     mapping
            //     a
            //     b ----- b       [1, 0]
            //   - c       c
            //  |  d       d
            //  |  e ----- 1       [4, 3]
            //   - f  \    2
            //         \   3
            //          \- e       [4, 6]
            //
            // The range with `incomingStart` at 2 and `incomingEnd` at 5 has outgoing start mapping of
            // [1,0] and outgoing end mapping of [4, 6], which also includes [4, 3].
            //
            let outgoingStartIndex = findLastMappingIndexBefore(bSource.flattenedMappings, incomingStart, false, 0);
            if (outgoingStartIndex < 0) {
                outgoingStartIndex = 0;
            }
            const outgoingEndIndex = incomingEnd !== undefined ?
                findLastMappingIndexBefore(bSource.flattenedMappings, incomingEnd, true, outgoingStartIndex) :
                bSource.flattenedMappings.length - 1;
            for (let bToCmappingIndex = outgoingStartIndex; bToCmappingIndex <= outgoingEndIndex; bToCmappingIndex++) {
                const bToCmapping = bSource.flattenedMappings[bToCmappingIndex];
                flattenedMappings.push(mergeMappings(this, aToBmapping, bToCmapping));
            }
        }
        return flattenedMappings;
    }
}
/**
 *
 * @param mappings The collection of mappings whose segment-markers we are searching.
 * @param marker The segment-marker to match against those of the given `mappings`.
 * @param exclusive If exclusive then we must find a mapping with a segment-marker that is
 * exclusively earlier than the given `marker`.
 * If not exclusive then we can return the highest mappings with an equivalent segment-marker to the
 * given `marker`.
 * @param lowerIndex If provided, this is used as a hint that the marker we are searching for has an
 * index that is no lower than this.
 */
export function findLastMappingIndexBefore(mappings, marker, exclusive, lowerIndex) {
    let upperIndex = mappings.length - 1;
    const test = exclusive ? -1 : 0;
    if (compareSegments(mappings[lowerIndex].generatedSegment, marker) > test) {
        // Exit early since the marker is outside the allowed range of mappings.
        return -1;
    }
    let matchingIndex = -1;
    while (lowerIndex <= upperIndex) {
        const index = (upperIndex + lowerIndex) >> 1;
        if (compareSegments(mappings[index].generatedSegment, marker) <= test) {
            matchingIndex = index;
            lowerIndex = index + 1;
        }
        else {
            upperIndex = index - 1;
        }
    }
    return matchingIndex;
}
/**
 * Merge two mappings that go from A to B and B to C, to result in a mapping that goes from A to C.
 */
export function mergeMappings(generatedSource, ab, bc) {
    const name = bc.name || ab.name;
    // We need to modify the segment-markers of the new mapping to take into account the shifts that
    // occur due to the combination of the two mappings.
    // For example:
    // * Simple map where the B->C starts at the same place the A->B ends:
    //
    // ```
    // A: 1 2 b c d
    //        |        A->B [2,0]
    //        |              |
    // B:     b c d    A->C [2,1]
    //        |                |
    //        |        B->C [0,1]
    // C:   a b c d e
    // ```
    // * More complicated case where diffs of segment-markers is needed:
    //
    // ```
    // A: b 1 2 c d
    //     \
    //      |            A->B  [0,1*]    [0,1*]
    //      |                   |         |+3
    // B: a b 1 2 c d    A->C  [0,1]     [3,2]
    //    |      /                |+1       |
    //    |     /        B->C [0*,0]    [4*,2]
    //    |    /
    // C: a b c d e
    // ```
    //
    // `[0,1]` mapping from A->C:
    // The difference between the "original segment-marker" of A->B (1*) and the "generated
    // segment-marker of B->C (0*): `1 - 0 = +1`.
    // Since it is positive we must increment the "original segment-marker" with `1` to give [0,1].
    //
    // `[3,2]` mapping from A->C:
    // The difference between the "original segment-marker" of A->B (1*) and the "generated
    // segment-marker" of B->C (4*): `1 - 4 = -3`.
    // Since it is negative we must increment the "generated segment-marker" with `3` to give [3,2].
    const diff = compareSegments(bc.generatedSegment, ab.originalSegment);
    if (diff > 0) {
        return {
            name,
            generatedSegment: offsetSegment(generatedSource.startOfLinePositions, ab.generatedSegment, diff),
            originalSource: bc.originalSource,
            originalSegment: bc.originalSegment,
        };
    }
    else {
        return {
            name,
            generatedSegment: ab.generatedSegment,
            originalSource: bc.originalSource,
            originalSegment: offsetSegment(bc.originalSource.startOfLinePositions, bc.originalSegment, -diff),
        };
    }
}
/**
 * Parse the `rawMappings` into an array of parsed mappings, which reference source-files provided
 * in the `sources` parameter.
 */
export function parseMappings(rawMap, sources, generatedSourceStartOfLinePositions) {
    if (rawMap === null) {
        return [];
    }
    const rawMappings = decode(rawMap.mappings);
    if (rawMappings === null) {
        return [];
    }
    const mappings = [];
    for (let generatedLine = 0; generatedLine < rawMappings.length; generatedLine++) {
        const generatedLineMappings = rawMappings[generatedLine];
        for (const rawMapping of generatedLineMappings) {
            if (rawMapping.length >= 4) {
                const originalSource = sources[rawMapping[1]];
                if (originalSource === null || originalSource === undefined) {
                    // the original source is missing so ignore this mapping
                    continue;
                }
                const generatedColumn = rawMapping[0];
                const name = rawMapping.length === 5 ? rawMap.names[rawMapping[4]] : undefined;
                const line = rawMapping[2];
                const column = rawMapping[3];
                const generatedSegment = {
                    line: generatedLine,
                    column: generatedColumn,
                    position: generatedSourceStartOfLinePositions[generatedLine] + generatedColumn,
                    next: undefined,
                };
                const originalSegment = {
                    line,
                    column,
                    position: originalSource.startOfLinePositions[line] + column,
                    next: undefined,
                };
                mappings.push({ name, generatedSegment, originalSegment, originalSource });
            }
        }
    }
    return mappings;
}
/**
 * Extract the segment markers from the original source files in each mapping of an array of
 * `mappings`.
 *
 * @param mappings The mappings whose original segments we want to extract
 * @returns Return a map from original source-files (referenced in the `mappings`) to arrays of
 * segment-markers sorted by their order in their source file.
 */
export function extractOriginalSegments(mappings) {
    const originalSegments = new Map();
    for (const mapping of mappings) {
        const originalSource = mapping.originalSource;
        if (!originalSegments.has(originalSource)) {
            originalSegments.set(originalSource, []);
        }
        const segments = originalSegments.get(originalSource);
        segments.push(mapping.originalSegment);
    }
    originalSegments.forEach(segmentMarkers => segmentMarkers.sort(compareSegments));
    return originalSegments;
}
/**
 * Update the original segments of each of the given `mappings` to include a link to the next
 * segment in the source file.
 *
 * @param mappings the mappings whose segments should be updated
 */
export function ensureOriginalSegmentLinks(mappings) {
    const segmentsBySource = extractOriginalSegments(mappings);
    segmentsBySource.forEach(markers => {
        for (let i = 0; i < markers.length - 1; i++) {
            markers[i].next = markers[i + 1];
        }
    });
}
export function computeStartOfLinePositions(str) {
    // The `1` is to indicate a newline character between the lines.
    // Note that in the actual contents there could be more than one character that indicates a
    // newline
    // - e.g. \r\n - but that is not important here since segment-markers are in line/column pairs and
    // so differences in length due to extra `\r` characters do not affect the algorithms.
    const NEWLINE_MARKER_OFFSET = 1;
    const lineLengths = computeLineLengths(str);
    const startPositions = [0]; // First line starts at position 0
    for (let i = 0; i < lineLengths.length - 1; i++) {
        startPositions.push(startPositions[i] + lineLengths[i] + NEWLINE_MARKER_OFFSET);
    }
    return startPositions;
}
function computeLineLengths(str) {
    return (str.split(/\n/)).map(s => s.length);
}
/**
 * A collection of mappings between `keys` and `values` stored in the order in which the keys are
 * first seen.
 *
 * The difference between this and a standard `Map` is that when you add a key-value pair the index
 * of the `key` is returned.
 */
class IndexedMap {
    constructor() {
        this.map = new Map();
        /**
         * An array of keys added to this map.
         *
         * This array is guaranteed to be in the order of the first time the key was added to the map.
         */
        this.keys = [];
        /**
         * An array of values added to this map.
         *
         * This array is guaranteed to be in the order of the first time the associated key was added to
         * the map.
         */
        this.values = [];
    }
    /**
     * Associate the `value` with the `key` and return the index of the key in the collection.
     *
     * If the `key` already exists then the `value` is not set and the index of that `key` is
     * returned; otherwise the `key` and `value` are stored and the index of the new `key` is
     * returned.
     *
     * @param key the key to associated with the `value`.
     * @param value the value to associated with the `key`.
     * @returns the index of the `key` in the `keys` array.
     */
    set(key, value) {
        if (this.map.has(key)) {
            return this.map.get(key);
        }
        const index = this.values.push(value) - 1;
        this.keys.push(key);
        this.map.set(key, index);
        return index;
    }
}
/**
 * A collection of `values` stored in the order in which they were added.
 *
 * The difference between this and a standard `Set` is that when you add a value the index of that
 * item is returned.
 */
class IndexedSet {
    constructor() {
        this.map = new Map();
        /**
         * An array of values added to this set.
         * This array is guaranteed to be in the order of the first time the value was added to the set.
         */
        this.values = [];
    }
    /**
     * Add the `value` to the `values` array, if it doesn't already exist; returning the index of the
     * `value` in the `values` array.
     *
     * If the `value` already exists then the index of that `value` is returned, otherwise the new
     * `value` is stored and the new index returned.
     *
     * @param value the value to add to the set.
     * @returns the index of the `value` in the `values` array.
     */
    add(value) {
        if (this.map.has(value)) {
            return this.map.get(value);
        }
        const index = this.values.push(value) - 1;
        this.map.set(value, index);
        return index;
    }
}
class Cache {
    constructor(computeFn) {
        this.computeFn = computeFn;
        this.map = new Map();
    }
    get(input) {
        if (!this.map.has(input)) {
            this.map.set(input, this.computeFn(input));
        }
        return this.map.get(input);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlX2ZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3NvdXJjZW1hcHMvc3JjL3NvdXJjZV9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBQyxjQUFjLEVBQUUscUJBQXFCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN6RSxPQUFPLEVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBc0MsTUFBTSxpQkFBaUIsQ0FBQztBQUtwRixPQUFPLEVBQUMsZUFBZSxFQUFFLGFBQWEsRUFBZ0IsTUFBTSxrQkFBa0IsQ0FBQztBQUUvRSxNQUFNLFVBQVUsdUJBQXVCLENBQUMsUUFBZ0I7SUFDdEQsT0FBTyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2hGLENBQUM7QUFFRCxNQUFNLE9BQU8sVUFBVTtJQVdyQjtJQUNJLG9DQUFvQztJQUMzQixVQUEwQjtJQUNuQyx3Q0FBd0M7SUFDL0IsUUFBZ0I7SUFDekIsa0VBQWtFO0lBQ3pELE1BQTBCO0lBQ25DLDBGQUEwRjtJQUNqRixPQUE0QixFQUM3QixFQUFvQjtRQVBuQixlQUFVLEdBQVYsVUFBVSxDQUFnQjtRQUUxQixhQUFRLEdBQVIsUUFBUSxDQUFRO1FBRWhCLFdBQU0sR0FBTixNQUFNLENBQW9CO1FBRTFCLFlBQU8sR0FBUCxPQUFPLENBQXFCO1FBQzdCLE9BQUUsR0FBRixFQUFFLENBQWtCO1FBRTlCLElBQUksQ0FBQyxRQUFRLEdBQUcsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLG9CQUFvQixHQUFHLDJCQUEyQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUMsaUJBQWlC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InNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtyZW1vdmVDb21tZW50cywgcmVtb3ZlTWFwRmlsZUNvbW1lbnRzfSBmcm9tICdjb252ZXJ0LXNvdXJjZS1tYXAnO1xuaW1wb3J0IHtkZWNvZGUsIGVuY29kZSwgU291cmNlTWFwTWFwcGluZ3MsIFNvdXJjZU1hcFNlZ21lbnR9IGZyb20gJ3NvdXJjZW1hcC1jb2RlYyc7XG5cbmltcG9ydCB7QWJzb2x1dGVGc1BhdGgsIFBhdGhNYW5pcHVsYXRpb259IGZyb20gJy4uLy4uL2ZpbGVfc3lzdGVtJztcblxuaW1wb3J0IHtSYXdTb3VyY2VNYXAsIFNvdXJjZU1hcEluZm99IGZyb20gJy4vcmF3X3NvdXJjZV9tYXAnO1xuaW1wb3J0IHtjb21wYXJlU2VnbWVudHMsIG9mZnNldFNlZ21lbnQsIFNlZ21lbnRNYXJrZXJ9IGZyb20gJy4vc2VnbWVudF9tYXJrZXInO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU291cmNlTWFwQ29tbWVudHMoY29udGVudHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiByZW1vdmVNYXBGaWxlQ29tbWVudHMocmVtb3ZlQ29tbWVudHMoY29udGVudHMpKS5yZXBsYWNlKC9cXG5cXG4kLywgJ1xcbicpO1xufVxuXG5leHBvcnQgY2xhc3MgU291cmNlRmlsZSB7XG4gIC8qKlxuICAgKiBUaGUgcGFyc2VkIG1hcHBpbmdzIHRoYXQgaGF2ZSBiZWVuIGZsYXR0ZW5lZCBzbyB0aGF0IGFueSBpbnRlcm1lZGlhdGUgc291cmNlIG1hcHBpbmdzIGhhdmUgYmVlblxuICAgKiBmbGF0dGVuZWQuXG4gICAqXG4gICAqIFRoZSByZXN1bHQgaXMgdGhhdCBhbnkgc291cmNlIGZpbGUgbWVudGlvbmVkIGluIHRoZSBmbGF0dGVuZWQgbWFwcGluZ3MgaGF2ZSBubyBzb3VyY2UgbWFwIChhcmVcbiAgICogcHVyZSBvcmlnaW5hbCBzb3VyY2UgZmlsZXMpLlxuICAgKi9cbiAgcmVhZG9ubHkgZmxhdHRlbmVkTWFwcGluZ3M6IE1hcHBpbmdbXTtcbiAgcmVhZG9ubHkgc3RhcnRPZkxpbmVQb3NpdGlvbnM6IG51bWJlcltdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgLyoqIFRoZSBwYXRoIHRvIHRoaXMgc291cmNlIGZpbGUuICovXG4gICAgICByZWFkb25seSBzb3VyY2VQYXRoOiBBYnNvbHV0ZUZzUGF0aCxcbiAgICAgIC8qKiBUaGUgY29udGVudHMgb2YgdGhpcyBzb3VyY2UgZmlsZS4gKi9cbiAgICAgIHJlYWRvbmx5IGNvbnRlbnRzOiBzdHJpbmcsXG4gICAgICAvKiogVGhlIHJhdyBzb3VyY2UgbWFwIChpZiBhbnkpIHJlZmVyZW5jZWQgYnkgdGhpcyBzb3VyY2UgZmlsZS4gKi9cbiAgICAgIHJlYWRvbmx5IHJhd01hcDogU291cmNlTWFwSW5mb3xudWxsLFxuICAgICAgLyoqIEFueSBzb3VyY2UgZmlsZXMgcmVmZXJlbmNlZCBieSB0aGUgcmF3IHNvdXJjZSBtYXAgYXNzb2NpYXRlZCB3aXRoIHRoaXMgc291cmNlIGZpbGUuICovXG4gICAgICByZWFkb25seSBzb3VyY2VzOiAoU291cmNlRmlsZXxudWxsKVtdLFxuICAgICAgcHJpdmF0ZSBmczogUGF0aE1hbmlwdWxhdGlvbixcbiAgKSB7XG4gICAgdGhpcy5jb250ZW50cyA9IHJlbW92ZVNvdXJjZU1hcENvbW1lbnRzKGNvbnRlbnRzKTtcbiAgICB0aGlzLnN0YXJ0T2ZMaW5lUG9zaXRpb25zID0gY29tcHV0ZVN0YXJ0T2ZMaW5lUG9zaXRpb25zKHRoaXMuY29udGVudHMpO1xuICAgIHRoaXMuZmxhdHRlbmVkTWFwcGluZ3MgPSB0aGlzLmZsYXR0ZW5NYXBwaW5ncygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbmRlciB0aGUgcmF3IHNvdXJjZSBtYXAgZ2VuZXJhdGVkIGZyb20gdGhlIGZsYXR0ZW5lZCBtYXBwaW5ncy5cbiAgICovXG4gIHJlbmRlckZsYXR0ZW5lZFNvdXJjZU1hcCgpOiBSYXdTb3VyY2VNYXAge1xuICAgIGNvbnN0IHNvdXJjZXMgPSBuZXcgSW5kZXhlZE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBjb25zdCBuYW1lcyA9IG5ldyBJbmRleGVkU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBtYXBwaW5nczogU291cmNlTWFwTWFwcGluZ3MgPSBbXTtcbiAgICBjb25zdCBzb3VyY2VQYXRoRGlyID0gdGhpcy5mcy5kaXJuYW1lKHRoaXMuc291cmNlUGF0aCk7XG4gICAgLy8gQ29tcHV0aW5nIHRoZSByZWxhdGl2ZSBwYXRoIGNhbiBiZSBleHBlbnNpdmUsIGFuZCB3ZSBhcmUgbGlrZWx5IHRvIGhhdmUgdGhlIHNhbWUgcGF0aCBmb3JcbiAgICAvLyBtYW55IChpZiBub3QgYWxsISkgbWFwcGluZ3MuXG4gICAgY29uc3QgcmVsYXRpdmVTb3VyY2VQYXRoQ2FjaGUgPVxuICAgICAgICBuZXcgQ2FjaGU8c3RyaW5nLCBzdHJpbmc+KGlucHV0ID0+IHRoaXMuZnMucmVsYXRpdmUoc291cmNlUGF0aERpciwgaW5wdXQpKTtcblxuICAgIGZvciAoY29uc3QgbWFwcGluZyBvZiB0aGlzLmZsYXR0ZW5lZE1hcHBpbmdzKSB7XG4gICAgICBjb25zdCBzb3VyY2VJbmRleCA9IHNvdXJjZXMuc2V0KFxuICAgICAgICAgIHJlbGF0aXZlU291cmNlUGF0aENhY2hlLmdldChtYXBwaW5nLm9yaWdpbmFsU291cmNlLnNvdXJjZVBhdGgpLFxuICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxTb3VyY2UuY29udGVudHMpO1xuICAgICAgY29uc3QgbWFwcGluZ0FycmF5OiBTb3VyY2VNYXBTZWdtZW50ID0gW1xuICAgICAgICBtYXBwaW5nLmdlbmVyYXRlZFNlZ21lbnQuY29sdW1uLFxuICAgICAgICBzb3VyY2VJbmRleCxcbiAgICAgICAgbWFwcGluZy5vcmlnaW5hbFNlZ21lbnQubGluZSxcbiAgICAgICAgbWFwcGluZy5vcmlnaW5hbFNlZ21lbnQuY29sdW1uLFxuICAgICAgXTtcbiAgICAgIGlmIChtYXBwaW5nLm5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBuYW1lSW5kZXggPSBuYW1lcy5hZGQobWFwcGluZy5uYW1lKTtcbiAgICAgICAgbWFwcGluZ0FycmF5LnB1c2gobmFtZUluZGV4KTtcbiAgICAgIH1cblxuICAgICAgLy8gRW5zdXJlIGEgbWFwcGluZyBsaW5lIGFycmF5IGZvciB0aGlzIG1hcHBpbmcuXG4gICAgICBjb25zdCBsaW5lID0gbWFwcGluZy5nZW5lcmF0ZWRTZWdtZW50LmxpbmU7XG4gICAgICB3aGlsZSAobGluZSA+PSBtYXBwaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgbWFwcGluZ3MucHVzaChbXSk7XG4gICAgICB9XG4gICAgICAvLyBBZGQgdGhpcyBtYXBwaW5nIHRvIHRoZSBsaW5lXG4gICAgICBtYXBwaW5nc1tsaW5lXS5wdXNoKG1hcHBpbmdBcnJheSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc291cmNlTWFwOiBSYXdTb3VyY2VNYXAgPSB7XG4gICAgICB2ZXJzaW9uOiAzLFxuICAgICAgZmlsZTogdGhpcy5mcy5yZWxhdGl2ZShzb3VyY2VQYXRoRGlyLCB0aGlzLnNvdXJjZVBhdGgpLFxuICAgICAgc291cmNlczogc291cmNlcy5rZXlzLFxuICAgICAgbmFtZXM6IG5hbWVzLnZhbHVlcyxcbiAgICAgIG1hcHBpbmdzOiBlbmNvZGUobWFwcGluZ3MpLFxuICAgICAgc291cmNlc0NvbnRlbnQ6IHNvdXJjZXMudmFsdWVzLFxuICAgIH07XG4gICAgcmV0dXJuIHNvdXJjZU1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBvcmlnaW5hbCBtYXBwZWQgbG9jYXRpb24gZm9yIHRoZSBnaXZlbiBgbGluZWAgYW5kIGBjb2x1bW5gIGluIHRoZSBnZW5lcmF0ZWQgZmlsZS5cbiAgICpcbiAgICogRmlyc3Qgd2Ugc2VhcmNoIGZvciBhIG1hcHBpbmcgd2hvc2UgZ2VuZXJhdGVkIHNlZ21lbnQgaXMgYXQgb3IgZGlyZWN0bHkgYmVmb3JlIHRoZSBnaXZlblxuICAgKiBsb2NhdGlvbi4gVGhlbiB3ZSBjb21wdXRlIHRoZSBvZmZzZXQgYmV0d2VlbiB0aGUgZ2l2ZW4gbG9jYXRpb24gYW5kIHRoZSBtYXRjaGluZyBnZW5lcmF0ZWRcbiAgICogc2VnbWVudC4gRmluYWxseSB3ZSBhcHBseSB0aGlzIG9mZnNldCB0byB0aGUgb3JpZ2luYWwgc291cmNlIHNlZ21lbnQgdG8gZ2V0IHRoZSBkZXNpcmVkXG4gICAqIG9yaWdpbmFsIGxvY2F0aW9uLlxuICAgKi9cbiAgZ2V0T3JpZ2luYWxMb2NhdGlvbihsaW5lOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKTpcbiAgICAgIHtmaWxlOiBBYnNvbHV0ZUZzUGF0aCwgbGluZTogbnVtYmVyLCBjb2x1bW46IG51bWJlcn18bnVsbCB7XG4gICAgaWYgKHRoaXMuZmxhdHRlbmVkTWFwcGluZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgcG9zaXRpb246IG51bWJlcjtcbiAgICBpZiAobGluZSA8IHRoaXMuc3RhcnRPZkxpbmVQb3NpdGlvbnMubGVuZ3RoKSB7XG4gICAgICBwb3NpdGlvbiA9IHRoaXMuc3RhcnRPZkxpbmVQb3NpdGlvbnNbbGluZV0gKyBjb2x1bW47XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBsaW5lIGlzIG9mZiB0aGUgZW5kIG9mIHRoZSBmaWxlLCBzbyBqdXN0IGFzc3VtZSB3ZSBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgZmlsZS5cbiAgICAgIHBvc2l0aW9uID0gdGhpcy5jb250ZW50cy5sZW5ndGg7XG4gICAgfVxuXG4gICAgY29uc3QgbG9jYXRpb25TZWdtZW50OiBTZWdtZW50TWFya2VyID0ge2xpbmUsIGNvbHVtbiwgcG9zaXRpb24sIG5leHQ6IHVuZGVmaW5lZH07XG5cbiAgICBsZXQgbWFwcGluZ0luZGV4ID1cbiAgICAgICAgZmluZExhc3RNYXBwaW5nSW5kZXhCZWZvcmUodGhpcy5mbGF0dGVuZWRNYXBwaW5ncywgbG9jYXRpb25TZWdtZW50LCBmYWxzZSwgMCk7XG4gICAgaWYgKG1hcHBpbmdJbmRleCA8IDApIHtcbiAgICAgIG1hcHBpbmdJbmRleCA9IDA7XG4gICAgfVxuICAgIGNvbnN0IHtvcmlnaW5hbFNlZ21lbnQsIG9yaWdpbmFsU291cmNlLCBnZW5lcmF0ZWRTZWdtZW50fSA9XG4gICAgICAgIHRoaXMuZmxhdHRlbmVkTWFwcGluZ3NbbWFwcGluZ0luZGV4XTtcbiAgICBjb25zdCBvZmZzZXQgPSBsb2NhdGlvblNlZ21lbnQucG9zaXRpb24gLSBnZW5lcmF0ZWRTZWdtZW50LnBvc2l0aW9uO1xuICAgIGNvbnN0IG9mZnNldE9yaWdpbmFsU2VnbWVudCA9XG4gICAgICAgIG9mZnNldFNlZ21lbnQob3JpZ2luYWxTb3VyY2Uuc3RhcnRPZkxpbmVQb3NpdGlvbnMsIG9yaWdpbmFsU2VnbWVudCwgb2Zmc2V0KTtcblxuICAgIHJldHVybiB7XG4gICAgICBmaWxlOiBvcmlnaW5hbFNvdXJjZS5zb3VyY2VQYXRoLFxuICAgICAgbGluZTogb2Zmc2V0T3JpZ2luYWxTZWdtZW50LmxpbmUsXG4gICAgICBjb2x1bW46IG9mZnNldE9yaWdpbmFsU2VnbWVudC5jb2x1bW4sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVuIHRoZSBwYXJzZWQgbWFwcGluZ3MgZm9yIHRoaXMgc291cmNlIGZpbGUsIHNvIHRoYXQgYWxsIHRoZSBtYXBwaW5ncyBhcmUgdG8gcHVyZSBvcmlnaW5hbFxuICAgKiBzb3VyY2UgZmlsZXMgd2l0aCBubyB0cmFuc2l0aXZlIHNvdXJjZSBtYXBzLlxuICAgKi9cbiAgcHJpdmF0ZSBmbGF0dGVuTWFwcGluZ3MoKTogTWFwcGluZ1tdIHtcbiAgICBjb25zdCBtYXBwaW5ncyA9XG4gICAgICAgIHBhcnNlTWFwcGluZ3ModGhpcy5yYXdNYXAgJiYgdGhpcy5yYXdNYXAubWFwLCB0aGlzLnNvdXJjZXMsIHRoaXMuc3RhcnRPZkxpbmVQb3NpdGlvbnMpO1xuICAgIGVuc3VyZU9yaWdpbmFsU2VnbWVudExpbmtzKG1hcHBpbmdzKTtcbiAgICBjb25zdCBmbGF0dGVuZWRNYXBwaW5nczogTWFwcGluZ1tdID0gW107XG4gICAgZm9yIChsZXQgbWFwcGluZ0luZGV4ID0gMDsgbWFwcGluZ0luZGV4IDwgbWFwcGluZ3MubGVuZ3RoOyBtYXBwaW5nSW5kZXgrKykge1xuICAgICAgY29uc3QgYVRvQm1hcHBpbmcgPSBtYXBwaW5nc1ttYXBwaW5nSW5kZXhdO1xuICAgICAgY29uc3QgYlNvdXJjZSA9IGFUb0JtYXBwaW5nLm9yaWdpbmFsU291cmNlO1xuICAgICAgaWYgKGJTb3VyY2UuZmxhdHRlbmVkTWFwcGluZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIFRoZSBiIHNvdXJjZSBmaWxlIGhhcyBubyBtYXBwaW5ncyBvZiBpdHMgb3duIChpLmUuIGl0IGlzIGEgcHVyZSBvcmlnaW5hbCBmaWxlKVxuICAgICAgICAvLyBzbyBqdXN0IHVzZSB0aGUgbWFwcGluZyBhcy1pcy5cbiAgICAgICAgZmxhdHRlbmVkTWFwcGluZ3MucHVzaChhVG9CbWFwcGluZyk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgYGluY29taW5nU3RhcnRgIGFuZCBgaW5jb21pbmdFbmRgIGFyZSB0aGUgYFNlZ21lbnRNYXJrZXJgcyBpbiBgQmAgdGhhdCByZXByZXNlbnQgdGhlXG4gICAgICAvLyBzZWN0aW9uIG9mIGBCYCBzb3VyY2UgZmlsZSB0aGF0IGlzIGJlaW5nIG1hcHBlZCB0byBieSB0aGUgY3VycmVudCBgYVRvQm1hcHBpbmdgLlxuICAgICAgLy9cbiAgICAgIC8vIEZvciBleGFtcGxlLCBjb25zaWRlciB0aGUgbWFwcGluZ3MgZnJvbSBBIHRvIEI6XG4gICAgICAvL1xuICAgICAgLy8gc3JjIEEgICBzcmMgQiAgICAgbWFwcGluZ1xuICAgICAgLy9cbiAgICAgIC8vICAgYSAtLS0tLSBhICAgICAgIFswLCAwXVxuICAgICAgLy8gICBiICAgICAgIGJcbiAgICAgIC8vICAgZiAtICAvLSBjICAgICAgIFs0LCAyXVxuICAgICAgLy8gICBnICBcXCAvICBkXG4gICAgICAvLyAgIGMgLS9cXCAgIGVcbiAgICAgIC8vICAgZCAgICBcXC0gZiAgICAgICBbMiwgNV1cbiAgICAgIC8vICAgZVxuICAgICAgLy9cbiAgICAgIC8vIEZvciBtYXBwaW5nIFswLDBdIHRoZSBpbmNvbWluZyBzdGFydCBhbmQgZW5kIGFyZSAwIGFuZCAyIChpLmUuIHRoZSByYW5nZSBhLCBiLCBjKVxuICAgICAgLy8gRm9yIG1hcHBpbmcgWzQsMl0gdGhlIGluY29taW5nIHN0YXJ0IGFuZCBlbmQgYXJlIDIgYW5kIDUgKGkuZS4gdGhlIHJhbmdlIGMsIGQsIGUsIGYpXG4gICAgICAvL1xuICAgICAgY29uc3QgaW5jb21pbmdTdGFydCA9IGFUb0JtYXBwaW5nLm9yaWdpbmFsU2VnbWVudDtcbiAgICAgIGNvbnN0IGluY29taW5nRW5kID0gaW5jb21pbmdTdGFydC5uZXh0O1xuXG4gICAgICAvLyBUaGUgYG91dGdvaW5nU3RhcnRJbmRleGAgYW5kIGBvdXRnb2luZ0VuZEluZGV4YCBhcmUgdGhlIGluZGljZXMgb2YgdGhlIHJhbmdlIG9mIG1hcHBpbmdzXG4gICAgICAvLyB0aGF0IGxlYXZlIGBiYCB0aGF0IHdlIGFyZSBpbnRlcmVzdGVkIGluIG1lcmdpbmcgd2l0aCB0aGUgYVRvQm1hcHBpbmcuXG4gICAgICAvLyBXZSBhY3R1YWxseSBjYXJlIGFib3V0IGFsbCB0aGUgbWFya2VycyBmcm9tIHRoZSBsYXN0IGJUb0NtYXBwaW5nIGRpcmVjdGx5IGJlZm9yZSB0aGVcbiAgICAgIC8vIGBpbmNvbWluZ1N0YXJ0YCB0byB0aGUgbGFzdCBiVG9DbWFwaW5nIGRpcmVjdGx5IGJlZm9yZSB0aGUgYGluY29taW5nRW5kYCwgaW5jbHVzaXZlLlxuICAgICAgLy9cbiAgICAgIC8vIEZvciBleGFtcGxlLCBpZiB3ZSBjb25zaWRlciB0aGUgcmFuZ2UgMiB0byA1IGZyb20gYWJvdmUgKGkuZS4gYywgZCwgZSwgZikgd2l0aCB0aGVcbiAgICAgIC8vIGZvbGxvd2luZyBtYXBwaW5ncyBmcm9tIEIgdG8gQzpcbiAgICAgIC8vXG4gICAgICAvLyAgIHNyYyBCICAgc3JjIEMgICAgIG1hcHBpbmdcbiAgICAgIC8vICAgICBhXG4gICAgICAvLyAgICAgYiAtLS0tLSBiICAgICAgIFsxLCAwXVxuICAgICAgLy8gICAtIGMgICAgICAgY1xuICAgICAgLy8gIHwgIGQgICAgICAgZFxuICAgICAgLy8gIHwgIGUgLS0tLS0gMSAgICAgICBbNCwgM11cbiAgICAgIC8vICAgLSBmICBcXCAgICAyXG4gICAgICAvLyAgICAgICAgIFxcICAgM1xuICAgICAgLy8gICAgICAgICAgXFwtIGUgICAgICAgWzQsIDZdXG4gICAgICAvL1xuICAgICAgLy8gVGhlIHJhbmdlIHdpdGggYGluY29taW5nU3RhcnRgIGF0IDIgYW5kIGBpbmNvbWluZ0VuZGAgYXQgNSBoYXMgb3V0Z29pbmcgc3RhcnQgbWFwcGluZyBvZlxuICAgICAgLy8gWzEsMF0gYW5kIG91dGdvaW5nIGVuZCBtYXBwaW5nIG9mIFs0LCA2XSwgd2hpY2ggYWxzbyBpbmNsdWRlcyBbNCwgM10uXG4gICAgICAvL1xuICAgICAgbGV0IG91dGdvaW5nU3RhcnRJbmRleCA9XG4gICAgICAgICAgZmluZExhc3RNYXBwaW5nSW5kZXhCZWZvcmUoYlNvdXJjZS5mbGF0dGVuZWRNYXBwaW5ncywgaW5jb21pbmdTdGFydCwgZmFsc2UsIDApO1xuICAgICAgaWYgKG91dGdvaW5nU3RhcnRJbmRleCA8IDApIHtcbiAgICAgICAgb3V0Z29pbmdTdGFydEluZGV4ID0gMDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG91dGdvaW5nRW5kSW5kZXggPSBpbmNvbWluZ0VuZCAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgICBmaW5kTGFzdE1hcHBpbmdJbmRleEJlZm9yZShcbiAgICAgICAgICAgICAgYlNvdXJjZS5mbGF0dGVuZWRNYXBwaW5ncywgaW5jb21pbmdFbmQsIHRydWUsIG91dGdvaW5nU3RhcnRJbmRleCkgOlxuICAgICAgICAgIGJTb3VyY2UuZmxhdHRlbmVkTWFwcGluZ3MubGVuZ3RoIC0gMTtcblxuICAgICAgZm9yIChsZXQgYlRvQ21hcHBpbmdJbmRleCA9IG91dGdvaW5nU3RhcnRJbmRleDsgYlRvQ21hcHBpbmdJbmRleCA8PSBvdXRnb2luZ0VuZEluZGV4O1xuICAgICAgICAgICBiVG9DbWFwcGluZ0luZGV4KyspIHtcbiAgICAgICAgY29uc3QgYlRvQ21hcHBpbmc6IE1hcHBpbmcgPSBiU291cmNlLmZsYXR0ZW5lZE1hcHBpbmdzW2JUb0NtYXBwaW5nSW5kZXhdO1xuICAgICAgICBmbGF0dGVuZWRNYXBwaW5ncy5wdXNoKG1lcmdlTWFwcGluZ3ModGhpcywgYVRvQm1hcHBpbmcsIGJUb0NtYXBwaW5nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmbGF0dGVuZWRNYXBwaW5ncztcbiAgfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gbWFwcGluZ3MgVGhlIGNvbGxlY3Rpb24gb2YgbWFwcGluZ3Mgd2hvc2Ugc2VnbWVudC1tYXJrZXJzIHdlIGFyZSBzZWFyY2hpbmcuXG4gKiBAcGFyYW0gbWFya2VyIFRoZSBzZWdtZW50LW1hcmtlciB0byBtYXRjaCBhZ2FpbnN0IHRob3NlIG9mIHRoZSBnaXZlbiBgbWFwcGluZ3NgLlxuICogQHBhcmFtIGV4Y2x1c2l2ZSBJZiBleGNsdXNpdmUgdGhlbiB3ZSBtdXN0IGZpbmQgYSBtYXBwaW5nIHdpdGggYSBzZWdtZW50LW1hcmtlciB0aGF0IGlzXG4gKiBleGNsdXNpdmVseSBlYXJsaWVyIHRoYW4gdGhlIGdpdmVuIGBtYXJrZXJgLlxuICogSWYgbm90IGV4Y2x1c2l2ZSB0aGVuIHdlIGNhbiByZXR1cm4gdGhlIGhpZ2hlc3QgbWFwcGluZ3Mgd2l0aCBhbiBlcXVpdmFsZW50IHNlZ21lbnQtbWFya2VyIHRvIHRoZVxuICogZ2l2ZW4gYG1hcmtlcmAuXG4gKiBAcGFyYW0gbG93ZXJJbmRleCBJZiBwcm92aWRlZCwgdGhpcyBpcyB1c2VkIGFzIGEgaGludCB0aGF0IHRoZSBtYXJrZXIgd2UgYXJlIHNlYXJjaGluZyBmb3IgaGFzIGFuXG4gKiBpbmRleCB0aGF0IGlzIG5vIGxvd2VyIHRoYW4gdGhpcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRMYXN0TWFwcGluZ0luZGV4QmVmb3JlKFxuICAgIG1hcHBpbmdzOiBNYXBwaW5nW10sIG1hcmtlcjogU2VnbWVudE1hcmtlciwgZXhjbHVzaXZlOiBib29sZWFuLCBsb3dlckluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuICBsZXQgdXBwZXJJbmRleCA9IG1hcHBpbmdzLmxlbmd0aCAtIDE7XG4gIGNvbnN0IHRlc3QgPSBleGNsdXNpdmUgPyAtMSA6IDA7XG5cbiAgaWYgKGNvbXBhcmVTZWdtZW50cyhtYXBwaW5nc1tsb3dlckluZGV4XS5nZW5lcmF0ZWRTZWdtZW50LCBtYXJrZXIpID4gdGVzdCkge1xuICAgIC8vIEV4aXQgZWFybHkgc2luY2UgdGhlIG1hcmtlciBpcyBvdXRzaWRlIHRoZSBhbGxvd2VkIHJhbmdlIG9mIG1hcHBpbmdzLlxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGxldCBtYXRjaGluZ0luZGV4ID0gLTE7XG4gIHdoaWxlIChsb3dlckluZGV4IDw9IHVwcGVySW5kZXgpIHtcbiAgICBjb25zdCBpbmRleCA9ICh1cHBlckluZGV4ICsgbG93ZXJJbmRleCkgPj4gMTtcbiAgICBpZiAoY29tcGFyZVNlZ21lbnRzKG1hcHBpbmdzW2luZGV4XS5nZW5lcmF0ZWRTZWdtZW50LCBtYXJrZXIpIDw9IHRlc3QpIHtcbiAgICAgIG1hdGNoaW5nSW5kZXggPSBpbmRleDtcbiAgICAgIGxvd2VySW5kZXggPSBpbmRleCArIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwcGVySW5kZXggPSBpbmRleCAtIDE7XG4gICAgfVxuICB9XG4gIHJldHVybiBtYXRjaGluZ0luZGV4O1xufVxuXG4vKipcbiAqIEEgTWFwcGluZyBjb25zaXN0cyBvZiB0d28gc2VnbWVudCBtYXJrZXJzOiBvbmUgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UgYW5kIG9uZSBpbiB0aGUgb3JpZ2luYWxcbiAqIHNvdXJjZSwgd2hpY2ggaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGVhY2ggc2VnbWVudC4gVGhlIGVuZCBvZiBhIHNlZ21lbnQgaXMgaW5kaWNhdGVkIGJ5IHRoZSBmaXJzdFxuICogc2VnbWVudCBtYXJrZXIgb2YgYW5vdGhlciBtYXBwaW5nIHdob3NlIHN0YXJ0IGlzIGdyZWF0ZXIgb3IgZXF1YWwgdG8gdGhpcyBvbmUuXG4gKlxuICogSXQgbWF5IGFsc28gaW5jbHVkZSBhIG5hbWUgYXNzb2NpYXRlZCB3aXRoIHRoZSBzZWdtZW50IGJlaW5nIG1hcHBlZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNYXBwaW5nIHtcbiAgcmVhZG9ubHkgZ2VuZXJhdGVkU2VnbWVudDogU2VnbWVudE1hcmtlcjtcbiAgcmVhZG9ubHkgb3JpZ2luYWxTb3VyY2U6IFNvdXJjZUZpbGU7XG4gIHJlYWRvbmx5IG9yaWdpbmFsU2VnbWVudDogU2VnbWVudE1hcmtlcjtcbiAgcmVhZG9ubHkgbmFtZT86IHN0cmluZztcbn1cblxuXG5cbi8qKlxuICogTWVyZ2UgdHdvIG1hcHBpbmdzIHRoYXQgZ28gZnJvbSBBIHRvIEIgYW5kIEIgdG8gQywgdG8gcmVzdWx0IGluIGEgbWFwcGluZyB0aGF0IGdvZXMgZnJvbSBBIHRvIEMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZU1hcHBpbmdzKGdlbmVyYXRlZFNvdXJjZTogU291cmNlRmlsZSwgYWI6IE1hcHBpbmcsIGJjOiBNYXBwaW5nKTogTWFwcGluZyB7XG4gIGNvbnN0IG5hbWUgPSBiYy5uYW1lIHx8IGFiLm5hbWU7XG5cbiAgLy8gV2UgbmVlZCB0byBtb2RpZnkgdGhlIHNlZ21lbnQtbWFya2VycyBvZiB0aGUgbmV3IG1hcHBpbmcgdG8gdGFrZSBpbnRvIGFjY291bnQgdGhlIHNoaWZ0cyB0aGF0XG4gIC8vIG9jY3VyIGR1ZSB0byB0aGUgY29tYmluYXRpb24gb2YgdGhlIHR3byBtYXBwaW5ncy5cbiAgLy8gRm9yIGV4YW1wbGU6XG5cbiAgLy8gKiBTaW1wbGUgbWFwIHdoZXJlIHRoZSBCLT5DIHN0YXJ0cyBhdCB0aGUgc2FtZSBwbGFjZSB0aGUgQS0+QiBlbmRzOlxuICAvL1xuICAvLyBgYGBcbiAgLy8gQTogMSAyIGIgYyBkXG4gIC8vICAgICAgICB8ICAgICAgICBBLT5CIFsyLDBdXG4gIC8vICAgICAgICB8ICAgICAgICAgICAgICB8XG4gIC8vIEI6ICAgICBiIGMgZCAgICBBLT5DIFsyLDFdXG4gIC8vICAgICAgICB8ICAgICAgICAgICAgICAgIHxcbiAgLy8gICAgICAgIHwgICAgICAgIEItPkMgWzAsMV1cbiAgLy8gQzogICBhIGIgYyBkIGVcbiAgLy8gYGBgXG5cbiAgLy8gKiBNb3JlIGNvbXBsaWNhdGVkIGNhc2Ugd2hlcmUgZGlmZnMgb2Ygc2VnbWVudC1tYXJrZXJzIGlzIG5lZWRlZDpcbiAgLy9cbiAgLy8gYGBgXG4gIC8vIEE6IGIgMSAyIGMgZFxuICAvLyAgICAgXFxcbiAgLy8gICAgICB8ICAgICAgICAgICAgQS0+QiAgWzAsMSpdICAgIFswLDEqXVxuICAvLyAgICAgIHwgICAgICAgICAgICAgICAgICAgfCAgICAgICAgIHwrM1xuICAvLyBCOiBhIGIgMSAyIGMgZCAgICBBLT5DICBbMCwxXSAgICAgWzMsMl1cbiAgLy8gICAgfCAgICAgIC8gICAgICAgICAgICAgICAgfCsxICAgICAgIHxcbiAgLy8gICAgfCAgICAgLyAgICAgICAgQi0+QyBbMCosMF0gICAgWzQqLDJdXG4gIC8vICAgIHwgICAgL1xuICAvLyBDOiBhIGIgYyBkIGVcbiAgLy8gYGBgXG4gIC8vXG4gIC8vIGBbMCwxXWAgbWFwcGluZyBmcm9tIEEtPkM6XG4gIC8vIFRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIFwib3JpZ2luYWwgc2VnbWVudC1tYXJrZXJcIiBvZiBBLT5CICgxKikgYW5kIHRoZSBcImdlbmVyYXRlZFxuICAvLyBzZWdtZW50LW1hcmtlciBvZiBCLT5DICgwKik6IGAxIC0gMCA9ICsxYC5cbiAgLy8gU2luY2UgaXQgaXMgcG9zaXRpdmUgd2UgbXVzdCBpbmNyZW1lbnQgdGhlIFwib3JpZ2luYWwgc2VnbWVudC1tYXJrZXJcIiB3aXRoIGAxYCB0byBnaXZlIFswLDFdLlxuICAvL1xuICAvLyBgWzMsMl1gIG1hcHBpbmcgZnJvbSBBLT5DOlxuICAvLyBUaGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBcIm9yaWdpbmFsIHNlZ21lbnQtbWFya2VyXCIgb2YgQS0+QiAoMSopIGFuZCB0aGUgXCJnZW5lcmF0ZWRcbiAgLy8gc2VnbWVudC1tYXJrZXJcIiBvZiBCLT5DICg0Kik6IGAxIC0gNCA9IC0zYC5cbiAgLy8gU2luY2UgaXQgaXMgbmVnYXRpdmUgd2UgbXVzdCBpbmNyZW1lbnQgdGhlIFwiZ2VuZXJhdGVkIHNlZ21lbnQtbWFya2VyXCIgd2l0aCBgM2AgdG8gZ2l2ZSBbMywyXS5cblxuICBjb25zdCBkaWZmID0gY29tcGFyZVNlZ21lbnRzKGJjLmdlbmVyYXRlZFNlZ21lbnQsIGFiLm9yaWdpbmFsU2VnbWVudCk7XG4gIGlmIChkaWZmID4gMCkge1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lLFxuICAgICAgZ2VuZXJhdGVkU2VnbWVudDpcbiAgICAgICAgICBvZmZzZXRTZWdtZW50KGdlbmVyYXRlZFNvdXJjZS5zdGFydE9mTGluZVBvc2l0aW9ucywgYWIuZ2VuZXJhdGVkU2VnbWVudCwgZGlmZiksXG4gICAgICBvcmlnaW5hbFNvdXJjZTogYmMub3JpZ2luYWxTb3VyY2UsXG4gICAgICBvcmlnaW5hbFNlZ21lbnQ6IGJjLm9yaWdpbmFsU2VnbWVudCxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lLFxuICAgICAgZ2VuZXJhdGVkU2VnbWVudDogYWIuZ2VuZXJhdGVkU2VnbWVudCxcbiAgICAgIG9yaWdpbmFsU291cmNlOiBiYy5vcmlnaW5hbFNvdXJjZSxcbiAgICAgIG9yaWdpbmFsU2VnbWVudDpcbiAgICAgICAgICBvZmZzZXRTZWdtZW50KGJjLm9yaWdpbmFsU291cmNlLnN0YXJ0T2ZMaW5lUG9zaXRpb25zLCBiYy5vcmlnaW5hbFNlZ21lbnQsIC1kaWZmKSxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUGFyc2UgdGhlIGByYXdNYXBwaW5nc2AgaW50byBhbiBhcnJheSBvZiBwYXJzZWQgbWFwcGluZ3MsIHdoaWNoIHJlZmVyZW5jZSBzb3VyY2UtZmlsZXMgcHJvdmlkZWRcbiAqIGluIHRoZSBgc291cmNlc2AgcGFyYW1ldGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VNYXBwaW5ncyhcbiAgICByYXdNYXA6IFJhd1NvdXJjZU1hcHxudWxsLCBzb3VyY2VzOiAoU291cmNlRmlsZXxudWxsKVtdLFxuICAgIGdlbmVyYXRlZFNvdXJjZVN0YXJ0T2ZMaW5lUG9zaXRpb25zOiBudW1iZXJbXSk6IE1hcHBpbmdbXSB7XG4gIGlmIChyYXdNYXAgPT09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCByYXdNYXBwaW5ncyA9IGRlY29kZShyYXdNYXAubWFwcGluZ3MpO1xuICBpZiAocmF3TWFwcGluZ3MgPT09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCBtYXBwaW5nczogTWFwcGluZ1tdID0gW107XG4gIGZvciAobGV0IGdlbmVyYXRlZExpbmUgPSAwOyBnZW5lcmF0ZWRMaW5lIDwgcmF3TWFwcGluZ3MubGVuZ3RoOyBnZW5lcmF0ZWRMaW5lKyspIHtcbiAgICBjb25zdCBnZW5lcmF0ZWRMaW5lTWFwcGluZ3MgPSByYXdNYXBwaW5nc1tnZW5lcmF0ZWRMaW5lXTtcbiAgICBmb3IgKGNvbnN0IHJhd01hcHBpbmcgb2YgZ2VuZXJhdGVkTGluZU1hcHBpbmdzKSB7XG4gICAgICBpZiAocmF3TWFwcGluZy5sZW5ndGggPj0gNCkge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNvdXJjZSA9IHNvdXJjZXNbcmF3TWFwcGluZ1sxXSFdO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2UgPT09IG51bGwgfHwgb3JpZ2luYWxTb3VyY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHRoZSBvcmlnaW5hbCBzb3VyY2UgaXMgbWlzc2luZyBzbyBpZ25vcmUgdGhpcyBtYXBwaW5nXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZ2VuZXJhdGVkQ29sdW1uID0gcmF3TWFwcGluZ1swXTtcbiAgICAgICAgY29uc3QgbmFtZSA9IHJhd01hcHBpbmcubGVuZ3RoID09PSA1ID8gcmF3TWFwLm5hbWVzW3Jhd01hcHBpbmdbNF1dIDogdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBsaW5lID0gcmF3TWFwcGluZ1syXSE7XG4gICAgICAgIGNvbnN0IGNvbHVtbiA9IHJhd01hcHBpbmdbM10hO1xuICAgICAgICBjb25zdCBnZW5lcmF0ZWRTZWdtZW50OiBTZWdtZW50TWFya2VyID0ge1xuICAgICAgICAgIGxpbmU6IGdlbmVyYXRlZExpbmUsXG4gICAgICAgICAgY29sdW1uOiBnZW5lcmF0ZWRDb2x1bW4sXG4gICAgICAgICAgcG9zaXRpb246IGdlbmVyYXRlZFNvdXJjZVN0YXJ0T2ZMaW5lUG9zaXRpb25zW2dlbmVyYXRlZExpbmVdICsgZ2VuZXJhdGVkQ29sdW1uLFxuICAgICAgICAgIG5leHQ6IHVuZGVmaW5lZCxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTZWdtZW50OiBTZWdtZW50TWFya2VyID0ge1xuICAgICAgICAgIGxpbmUsXG4gICAgICAgICAgY29sdW1uLFxuICAgICAgICAgIHBvc2l0aW9uOiBvcmlnaW5hbFNvdXJjZS5zdGFydE9mTGluZVBvc2l0aW9uc1tsaW5lXSArIGNvbHVtbixcbiAgICAgICAgICBuZXh0OiB1bmRlZmluZWQsXG4gICAgICAgIH07XG4gICAgICAgIG1hcHBpbmdzLnB1c2goe25hbWUsIGdlbmVyYXRlZFNlZ21lbnQsIG9yaWdpbmFsU2VnbWVudCwgb3JpZ2luYWxTb3VyY2V9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG1hcHBpbmdzO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgdGhlIHNlZ21lbnQgbWFya2VycyBmcm9tIHRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZXMgaW4gZWFjaCBtYXBwaW5nIG9mIGFuIGFycmF5IG9mXG4gKiBgbWFwcGluZ3NgLlxuICpcbiAqIEBwYXJhbSBtYXBwaW5ncyBUaGUgbWFwcGluZ3Mgd2hvc2Ugb3JpZ2luYWwgc2VnbWVudHMgd2Ugd2FudCB0byBleHRyYWN0XG4gKiBAcmV0dXJucyBSZXR1cm4gYSBtYXAgZnJvbSBvcmlnaW5hbCBzb3VyY2UtZmlsZXMgKHJlZmVyZW5jZWQgaW4gdGhlIGBtYXBwaW5nc2ApIHRvIGFycmF5cyBvZlxuICogc2VnbWVudC1tYXJrZXJzIHNvcnRlZCBieSB0aGVpciBvcmRlciBpbiB0aGVpciBzb3VyY2UgZmlsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RPcmlnaW5hbFNlZ21lbnRzKG1hcHBpbmdzOiBNYXBwaW5nW10pOiBNYXA8U291cmNlRmlsZSwgU2VnbWVudE1hcmtlcltdPiB7XG4gIGNvbnN0IG9yaWdpbmFsU2VnbWVudHMgPSBuZXcgTWFwPFNvdXJjZUZpbGUsIFNlZ21lbnRNYXJrZXJbXT4oKTtcbiAgZm9yIChjb25zdCBtYXBwaW5nIG9mIG1hcHBpbmdzKSB7XG4gICAgY29uc3Qgb3JpZ2luYWxTb3VyY2UgPSBtYXBwaW5nLm9yaWdpbmFsU291cmNlO1xuICAgIGlmICghb3JpZ2luYWxTZWdtZW50cy5oYXMob3JpZ2luYWxTb3VyY2UpKSB7XG4gICAgICBvcmlnaW5hbFNlZ21lbnRzLnNldChvcmlnaW5hbFNvdXJjZSwgW10pO1xuICAgIH1cbiAgICBjb25zdCBzZWdtZW50cyA9IG9yaWdpbmFsU2VnbWVudHMuZ2V0KG9yaWdpbmFsU291cmNlKSE7XG4gICAgc2VnbWVudHMucHVzaChtYXBwaW5nLm9yaWdpbmFsU2VnbWVudCk7XG4gIH1cbiAgb3JpZ2luYWxTZWdtZW50cy5mb3JFYWNoKHNlZ21lbnRNYXJrZXJzID0+IHNlZ21lbnRNYXJrZXJzLnNvcnQoY29tcGFyZVNlZ21lbnRzKSk7XG4gIHJldHVybiBvcmlnaW5hbFNlZ21lbnRzO1xufVxuXG4vKipcbiAqIFVwZGF0ZSB0aGUgb3JpZ2luYWwgc2VnbWVudHMgb2YgZWFjaCBvZiB0aGUgZ2l2ZW4gYG1hcHBpbmdzYCB0byBpbmNsdWRlIGEgbGluayB0byB0aGUgbmV4dFxuICogc2VnbWVudCBpbiB0aGUgc291cmNlIGZpbGUuXG4gKlxuICogQHBhcmFtIG1hcHBpbmdzIHRoZSBtYXBwaW5ncyB3aG9zZSBzZWdtZW50cyBzaG91bGQgYmUgdXBkYXRlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlT3JpZ2luYWxTZWdtZW50TGlua3MobWFwcGluZ3M6IE1hcHBpbmdbXSk6IHZvaWQge1xuICBjb25zdCBzZWdtZW50c0J5U291cmNlID0gZXh0cmFjdE9yaWdpbmFsU2VnbWVudHMobWFwcGluZ3MpO1xuICBzZWdtZW50c0J5U291cmNlLmZvckVhY2gobWFya2VycyA9PiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgbWFya2Vyc1tpXS5uZXh0ID0gbWFya2Vyc1tpICsgMV07XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVTdGFydE9mTGluZVBvc2l0aW9ucyhzdHI6IHN0cmluZykge1xuICAvLyBUaGUgYDFgIGlzIHRvIGluZGljYXRlIGEgbmV3bGluZSBjaGFyYWN0ZXIgYmV0d2VlbiB0aGUgbGluZXMuXG4gIC8vIE5vdGUgdGhhdCBpbiB0aGUgYWN0dWFsIGNvbnRlbnRzIHRoZXJlIGNvdWxkIGJlIG1vcmUgdGhhbiBvbmUgY2hhcmFjdGVyIHRoYXQgaW5kaWNhdGVzIGFcbiAgLy8gbmV3bGluZVxuICAvLyAtIGUuZy4gXFxyXFxuIC0gYnV0IHRoYXQgaXMgbm90IGltcG9ydGFudCBoZXJlIHNpbmNlIHNlZ21lbnQtbWFya2VycyBhcmUgaW4gbGluZS9jb2x1bW4gcGFpcnMgYW5kXG4gIC8vIHNvIGRpZmZlcmVuY2VzIGluIGxlbmd0aCBkdWUgdG8gZXh0cmEgYFxccmAgY2hhcmFjdGVycyBkbyBub3QgYWZmZWN0IHRoZSBhbGdvcml0aG1zLlxuICBjb25zdCBORVdMSU5FX01BUktFUl9PRkZTRVQgPSAxO1xuICBjb25zdCBsaW5lTGVuZ3RocyA9IGNvbXB1dGVMaW5lTGVuZ3RocyhzdHIpO1xuICBjb25zdCBzdGFydFBvc2l0aW9ucyA9IFswXTsgIC8vIEZpcnN0IGxpbmUgc3RhcnRzIGF0IHBvc2l0aW9uIDBcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lTGVuZ3Rocy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICBzdGFydFBvc2l0aW9ucy5wdXNoKHN0YXJ0UG9zaXRpb25zW2ldICsgbGluZUxlbmd0aHNbaV0gKyBORVdMSU5FX01BUktFUl9PRkZTRVQpO1xuICB9XG4gIHJldHVybiBzdGFydFBvc2l0aW9ucztcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUxpbmVMZW5ndGhzKHN0cjogc3RyaW5nKTogbnVtYmVyW10ge1xuICByZXR1cm4gKHN0ci5zcGxpdCgvXFxuLykpLm1hcChzID0+IHMubGVuZ3RoKTtcbn1cblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gb2YgbWFwcGluZ3MgYmV0d2VlbiBga2V5c2AgYW5kIGB2YWx1ZXNgIHN0b3JlZCBpbiB0aGUgb3JkZXIgaW4gd2hpY2ggdGhlIGtleXMgYXJlXG4gKiBmaXJzdCBzZWVuLlxuICpcbiAqIFRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhpcyBhbmQgYSBzdGFuZGFyZCBgTWFwYCBpcyB0aGF0IHdoZW4geW91IGFkZCBhIGtleS12YWx1ZSBwYWlyIHRoZSBpbmRleFxuICogb2YgdGhlIGBrZXlgIGlzIHJldHVybmVkLlxuICovXG5jbGFzcyBJbmRleGVkTWFwPEssIFY+IHtcbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPEssIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2Yga2V5cyBhZGRlZCB0byB0aGlzIG1hcC5cbiAgICpcbiAgICogVGhpcyBhcnJheSBpcyBndWFyYW50ZWVkIHRvIGJlIGluIHRoZSBvcmRlciBvZiB0aGUgZmlyc3QgdGltZSB0aGUga2V5IHdhcyBhZGRlZCB0byB0aGUgbWFwLlxuICAgKi9cbiAgcmVhZG9ubHkga2V5czogS1tdID0gW107XG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIHZhbHVlcyBhZGRlZCB0byB0aGlzIG1hcC5cbiAgICpcbiAgICogVGhpcyBhcnJheSBpcyBndWFyYW50ZWVkIHRvIGJlIGluIHRoZSBvcmRlciBvZiB0aGUgZmlyc3QgdGltZSB0aGUgYXNzb2NpYXRlZCBrZXkgd2FzIGFkZGVkIHRvXG4gICAqIHRoZSBtYXAuXG4gICAqL1xuICByZWFkb25seSB2YWx1ZXM6IFZbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBBc3NvY2lhdGUgdGhlIGB2YWx1ZWAgd2l0aCB0aGUgYGtleWAgYW5kIHJldHVybiB0aGUgaW5kZXggb2YgdGhlIGtleSBpbiB0aGUgY29sbGVjdGlvbi5cbiAgICpcbiAgICogSWYgdGhlIGBrZXlgIGFscmVhZHkgZXhpc3RzIHRoZW4gdGhlIGB2YWx1ZWAgaXMgbm90IHNldCBhbmQgdGhlIGluZGV4IG9mIHRoYXQgYGtleWAgaXNcbiAgICogcmV0dXJuZWQ7IG90aGVyd2lzZSB0aGUgYGtleWAgYW5kIGB2YWx1ZWAgYXJlIHN0b3JlZCBhbmQgdGhlIGluZGV4IG9mIHRoZSBuZXcgYGtleWAgaXNcbiAgICogcmV0dXJuZWQuXG4gICAqXG4gICAqIEBwYXJhbSBrZXkgdGhlIGtleSB0byBhc3NvY2lhdGVkIHdpdGggdGhlIGB2YWx1ZWAuXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgdmFsdWUgdG8gYXNzb2NpYXRlZCB3aXRoIHRoZSBga2V5YC5cbiAgICogQHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBga2V5YCBpbiB0aGUgYGtleXNgIGFycmF5LlxuICAgKi9cbiAgc2V0KGtleTogSywgdmFsdWU6IFYpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLm1hcC5oYXMoa2V5KSkge1xuICAgICAgcmV0dXJuIHRoaXMubWFwLmdldChrZXkpITtcbiAgICB9XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLnZhbHVlcy5wdXNoKHZhbHVlKSAtIDE7XG4gICAgdGhpcy5rZXlzLnB1c2goa2V5KTtcbiAgICB0aGlzLm1hcC5zZXQoa2V5LCBpbmRleCk7XG4gICAgcmV0dXJuIGluZGV4O1xuICB9XG59XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIGB2YWx1ZXNgIHN0b3JlZCBpbiB0aGUgb3JkZXIgaW4gd2hpY2ggdGhleSB3ZXJlIGFkZGVkLlxuICpcbiAqIFRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhpcyBhbmQgYSBzdGFuZGFyZCBgU2V0YCBpcyB0aGF0IHdoZW4geW91IGFkZCBhIHZhbHVlIHRoZSBpbmRleCBvZiB0aGF0XG4gKiBpdGVtIGlzIHJldHVybmVkLlxuICovXG5jbGFzcyBJbmRleGVkU2V0PFY+IHtcbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPFYsIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgdmFsdWVzIGFkZGVkIHRvIHRoaXMgc2V0LlxuICAgKiBUaGlzIGFycmF5IGlzIGd1YXJhbnRlZWQgdG8gYmUgaW4gdGhlIG9yZGVyIG9mIHRoZSBmaXJzdCB0aW1lIHRoZSB2YWx1ZSB3YXMgYWRkZWQgdG8gdGhlIHNldC5cbiAgICovXG4gIHJlYWRvbmx5IHZhbHVlczogVltdID0gW107XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgYHZhbHVlYCB0byB0aGUgYHZhbHVlc2AgYXJyYXksIGlmIGl0IGRvZXNuJ3QgYWxyZWFkeSBleGlzdDsgcmV0dXJuaW5nIHRoZSBpbmRleCBvZiB0aGVcbiAgICogYHZhbHVlYCBpbiB0aGUgYHZhbHVlc2AgYXJyYXkuXG4gICAqXG4gICAqIElmIHRoZSBgdmFsdWVgIGFscmVhZHkgZXhpc3RzIHRoZW4gdGhlIGluZGV4IG9mIHRoYXQgYHZhbHVlYCBpcyByZXR1cm5lZCwgb3RoZXJ3aXNlIHRoZSBuZXdcbiAgICogYHZhbHVlYCBpcyBzdG9yZWQgYW5kIHRoZSBuZXcgaW5kZXggcmV0dXJuZWQuXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSB0aGUgdmFsdWUgdG8gYWRkIHRvIHRoZSBzZXQuXG4gICAqIEByZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgYHZhbHVlYCBpbiB0aGUgYHZhbHVlc2AgYXJyYXkuXG4gICAqL1xuICBhZGQodmFsdWU6IFYpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLm1hcC5oYXModmFsdWUpKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KHZhbHVlKSE7XG4gICAgfVxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy52YWx1ZXMucHVzaCh2YWx1ZSkgLSAxO1xuICAgIHRoaXMubWFwLnNldCh2YWx1ZSwgaW5kZXgpO1xuICAgIHJldHVybiBpbmRleDtcbiAgfVxufVxuXG5jbGFzcyBDYWNoZTxJbnB1dCwgQ2FjaGVkPiB7XG4gIHByaXZhdGUgbWFwID0gbmV3IE1hcDxJbnB1dCwgQ2FjaGVkPigpO1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNvbXB1dGVGbjogKGlucHV0OiBJbnB1dCkgPT4gQ2FjaGVkKSB7fVxuICBnZXQoaW5wdXQ6IElucHV0KTogQ2FjaGVkIHtcbiAgICBpZiAoIXRoaXMubWFwLmhhcyhpbnB1dCkpIHtcbiAgICAgIHRoaXMubWFwLnNldChpbnB1dCwgdGhpcy5jb21wdXRlRm4oaW5wdXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubWFwLmdldChpbnB1dCkhO1xuICB9XG59XG4iXX0=