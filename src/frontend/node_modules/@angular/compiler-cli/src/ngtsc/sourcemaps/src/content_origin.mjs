/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * From where the content for a source file or source-map came.
 *
 * - Source files can be linked to source-maps by:
 *   - providing the content inline via a base64 encoded data comment,
 *   - providing a URL to the file path in a comment,
 *   - the loader inferring the source-map path from the source file path.
 * - Source-maps can link to source files by:
 *   - providing the content inline in the `sourcesContent` property
 *   - providing the path to the file in the `sources` property
 */
export var ContentOrigin;
(function (ContentOrigin) {
    /**
     * The contents were provided programmatically when calling `loadSourceFile()`.
     */
    ContentOrigin[ContentOrigin["Provided"] = 0] = "Provided";
    /**
     * The contents were extracted directly form the contents of the referring file.
     */
    ContentOrigin[ContentOrigin["Inline"] = 1] = "Inline";
    /**
     * The contents were loaded from the file-system, after being explicitly referenced or inferred
     * from the referring file.
     */
    ContentOrigin[ContentOrigin["FileSystem"] = 2] = "FileSystem";
})(ContentOrigin || (ContentOrigin = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudF9vcmlnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3NvdXJjZW1hcHMvc3JjL2NvbnRlbnRfb3JpZ2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQWNYO0FBZEQsV0FBWSxhQUFhO0lBQ3ZCOztPQUVHO0lBQ0gseURBQVEsQ0FBQTtJQUNSOztPQUVHO0lBQ0gscURBQU0sQ0FBQTtJQUNOOzs7T0FHRztJQUNILDZEQUFVLENBQUE7QUFDWixDQUFDLEVBZFcsYUFBYSxLQUFiLGFBQWEsUUFjeEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBGcm9tIHdoZXJlIHRoZSBjb250ZW50IGZvciBhIHNvdXJjZSBmaWxlIG9yIHNvdXJjZS1tYXAgY2FtZS5cbiAqXG4gKiAtIFNvdXJjZSBmaWxlcyBjYW4gYmUgbGlua2VkIHRvIHNvdXJjZS1tYXBzIGJ5OlxuICogICAtIHByb3ZpZGluZyB0aGUgY29udGVudCBpbmxpbmUgdmlhIGEgYmFzZTY0IGVuY29kZWQgZGF0YSBjb21tZW50LFxuICogICAtIHByb3ZpZGluZyBhIFVSTCB0byB0aGUgZmlsZSBwYXRoIGluIGEgY29tbWVudCxcbiAqICAgLSB0aGUgbG9hZGVyIGluZmVycmluZyB0aGUgc291cmNlLW1hcCBwYXRoIGZyb20gdGhlIHNvdXJjZSBmaWxlIHBhdGguXG4gKiAtIFNvdXJjZS1tYXBzIGNhbiBsaW5rIHRvIHNvdXJjZSBmaWxlcyBieTpcbiAqICAgLSBwcm92aWRpbmcgdGhlIGNvbnRlbnQgaW5saW5lIGluIHRoZSBgc291cmNlc0NvbnRlbnRgIHByb3BlcnR5XG4gKiAgIC0gcHJvdmlkaW5nIHRoZSBwYXRoIHRvIHRoZSBmaWxlIGluIHRoZSBgc291cmNlc2AgcHJvcGVydHlcbiAqL1xuZXhwb3J0IGVudW0gQ29udGVudE9yaWdpbiB7XG4gIC8qKlxuICAgKiBUaGUgY29udGVudHMgd2VyZSBwcm92aWRlZCBwcm9ncmFtbWF0aWNhbGx5IHdoZW4gY2FsbGluZyBgbG9hZFNvdXJjZUZpbGUoKWAuXG4gICAqL1xuICBQcm92aWRlZCxcbiAgLyoqXG4gICAqIFRoZSBjb250ZW50cyB3ZXJlIGV4dHJhY3RlZCBkaXJlY3RseSBmb3JtIHRoZSBjb250ZW50cyBvZiB0aGUgcmVmZXJyaW5nIGZpbGUuXG4gICAqL1xuICBJbmxpbmUsXG4gIC8qKlxuICAgKiBUaGUgY29udGVudHMgd2VyZSBsb2FkZWQgZnJvbSB0aGUgZmlsZS1zeXN0ZW0sIGFmdGVyIGJlaW5nIGV4cGxpY2l0bHkgcmVmZXJlbmNlZCBvciBpbmZlcnJlZFxuICAgKiBmcm9tIHRoZSByZWZlcnJpbmcgZmlsZS5cbiAgICovXG4gIEZpbGVTeXN0ZW0sXG59XG4iXX0=