/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { absoluteFromSourceFile } from '../../file_system';
import { isNonDeclarationTsPath } from '../../util/src/typescript';
import { isShim, sfExtensionData } from './expando';
import { makeShimFileName } from './util';
/**
 * Manipulates the `referencedFiles` property of `ts.SourceFile`s to add references to shim files
 * for each original source file, causing the shims to be loaded into the program as well.
 *
 * `ShimReferenceTagger`s are intended to operate during program creation only.
 */
export class ShimReferenceTagger {
    constructor(shimExtensions) {
        /**
         * Tracks which original files have been processed and had shims generated if necessary.
         *
         * This is used to avoid generating shims twice for the same file.
         */
        this.tagged = new Set();
        /**
         * Whether shim tagging is currently being performed.
         */
        this.enabled = true;
        this.suffixes = shimExtensions.map(extension => `.${extension}.ts`);
    }
    /**
     * Tag `sf` with any needed references if it's not a shim itself.
     */
    tag(sf) {
        if (!this.enabled || sf.isDeclarationFile || isShim(sf) || this.tagged.has(sf) ||
            !isNonDeclarationTsPath(sf.fileName)) {
            return;
        }
        const ext = sfExtensionData(sf);
        // If this file has never been tagged before, capture its `referencedFiles` in the extension
        // data.
        if (ext.originalReferencedFiles === null) {
            ext.originalReferencedFiles = sf.referencedFiles;
        }
        const referencedFiles = [...ext.originalReferencedFiles];
        const sfPath = absoluteFromSourceFile(sf);
        for (const suffix of this.suffixes) {
            referencedFiles.push({
                fileName: makeShimFileName(sfPath, suffix),
                pos: 0,
                end: 0,
            });
        }
        ext.taggedReferenceFiles = referencedFiles;
        sf.referencedFiles = referencedFiles;
        this.tagged.add(sf);
    }
    /**
     * Disable the `ShimReferenceTagger` and free memory associated with tracking tagged files.
     */
    finalize() {
        this.enabled = false;
        this.tagged.clear();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmZXJlbmNlX3RhZ2dlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2Mvc2hpbXMvc3JjL3JlZmVyZW5jZV90YWdnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDekQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFakUsT0FBTyxFQUFDLE1BQU0sRUFBRSxlQUFlLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDbEQsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXhDOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLG1CQUFtQjtJQWU5QixZQUFZLGNBQXdCO1FBWnBDOzs7O1dBSUc7UUFDSyxXQUFNLEdBQUcsSUFBSSxHQUFHLEVBQWlCLENBQUM7UUFFMUM7O1dBRUc7UUFDSyxZQUFPLEdBQVksSUFBSSxDQUFDO1FBRzlCLElBQUksQ0FBQyxRQUFRLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUMsRUFBaUI7UUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLGlCQUFpQixJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDMUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDeEMsT0FBTztTQUNSO1FBRUQsTUFBTSxHQUFHLEdBQUcsZUFBZSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRWhDLDRGQUE0RjtRQUM1RixRQUFRO1FBQ1IsSUFBSSxHQUFHLENBQUMsdUJBQXVCLEtBQUssSUFBSSxFQUFFO1lBQ3hDLEdBQUcsQ0FBQyx1QkFBdUIsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQ2xEO1FBRUQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBR3pELE1BQU0sTUFBTSxHQUFHLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFDLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNsQyxlQUFlLENBQUMsSUFBSSxDQUFDO2dCQUNuQixRQUFRLEVBQUUsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQztnQkFDMUMsR0FBRyxFQUFFLENBQUM7Z0JBQ04sR0FBRyxFQUFFLENBQUM7YUFDUCxDQUFDLENBQUM7U0FDSjtRQUVELEdBQUcsQ0FBQyxvQkFBb0IsR0FBRyxlQUFlLENBQUM7UUFDM0MsRUFBRSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsUUFBUTtRQUNOLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDdEIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGV9IGZyb20gJy4uLy4uL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7aXNOb25EZWNsYXJhdGlvblRzUGF0aH0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7aXNTaGltLCBzZkV4dGVuc2lvbkRhdGF9IGZyb20gJy4vZXhwYW5kbyc7XG5pbXBvcnQge21ha2VTaGltRmlsZU5hbWV9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogTWFuaXB1bGF0ZXMgdGhlIGByZWZlcmVuY2VkRmlsZXNgIHByb3BlcnR5IG9mIGB0cy5Tb3VyY2VGaWxlYHMgdG8gYWRkIHJlZmVyZW5jZXMgdG8gc2hpbSBmaWxlc1xuICogZm9yIGVhY2ggb3JpZ2luYWwgc291cmNlIGZpbGUsIGNhdXNpbmcgdGhlIHNoaW1zIHRvIGJlIGxvYWRlZCBpbnRvIHRoZSBwcm9ncmFtIGFzIHdlbGwuXG4gKlxuICogYFNoaW1SZWZlcmVuY2VUYWdnZXJgcyBhcmUgaW50ZW5kZWQgdG8gb3BlcmF0ZSBkdXJpbmcgcHJvZ3JhbSBjcmVhdGlvbiBvbmx5LlxuICovXG5leHBvcnQgY2xhc3MgU2hpbVJlZmVyZW5jZVRhZ2dlciB7XG4gIHByaXZhdGUgc3VmZml4ZXM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBUcmFja3Mgd2hpY2ggb3JpZ2luYWwgZmlsZXMgaGF2ZSBiZWVuIHByb2Nlc3NlZCBhbmQgaGFkIHNoaW1zIGdlbmVyYXRlZCBpZiBuZWNlc3NhcnkuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZCB0byBhdm9pZCBnZW5lcmF0aW5nIHNoaW1zIHR3aWNlIGZvciB0aGUgc2FtZSBmaWxlLlxuICAgKi9cbiAgcHJpdmF0ZSB0YWdnZWQgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgc2hpbSB0YWdnaW5nIGlzIGN1cnJlbnRseSBiZWluZyBwZXJmb3JtZWQuXG4gICAqL1xuICBwcml2YXRlIGVuYWJsZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIGNvbnN0cnVjdG9yKHNoaW1FeHRlbnNpb25zOiBzdHJpbmdbXSkge1xuICAgIHRoaXMuc3VmZml4ZXMgPSBzaGltRXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IGAuJHtleHRlbnNpb259LnRzYCk7XG4gIH1cblxuICAvKipcbiAgICogVGFnIGBzZmAgd2l0aCBhbnkgbmVlZGVkIHJlZmVyZW5jZXMgaWYgaXQncyBub3QgYSBzaGltIGl0c2VsZi5cbiAgICovXG4gIHRhZyhzZjogdHMuU291cmNlRmlsZSk6IHZvaWQge1xuICAgIGlmICghdGhpcy5lbmFibGVkIHx8IHNmLmlzRGVjbGFyYXRpb25GaWxlIHx8IGlzU2hpbShzZikgfHwgdGhpcy50YWdnZWQuaGFzKHNmKSB8fFxuICAgICAgICAhaXNOb25EZWNsYXJhdGlvblRzUGF0aChzZi5maWxlTmFtZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBleHQgPSBzZkV4dGVuc2lvbkRhdGEoc2YpO1xuXG4gICAgLy8gSWYgdGhpcyBmaWxlIGhhcyBuZXZlciBiZWVuIHRhZ2dlZCBiZWZvcmUsIGNhcHR1cmUgaXRzIGByZWZlcmVuY2VkRmlsZXNgIGluIHRoZSBleHRlbnNpb25cbiAgICAvLyBkYXRhLlxuICAgIGlmIChleHQub3JpZ2luYWxSZWZlcmVuY2VkRmlsZXMgPT09IG51bGwpIHtcbiAgICAgIGV4dC5vcmlnaW5hbFJlZmVyZW5jZWRGaWxlcyA9IHNmLnJlZmVyZW5jZWRGaWxlcztcbiAgICB9XG5cbiAgICBjb25zdCByZWZlcmVuY2VkRmlsZXMgPSBbLi4uZXh0Lm9yaWdpbmFsUmVmZXJlbmNlZEZpbGVzXTtcblxuXG4gICAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG4gICAgZm9yIChjb25zdCBzdWZmaXggb2YgdGhpcy5zdWZmaXhlcykge1xuICAgICAgcmVmZXJlbmNlZEZpbGVzLnB1c2goe1xuICAgICAgICBmaWxlTmFtZTogbWFrZVNoaW1GaWxlTmFtZShzZlBhdGgsIHN1ZmZpeCksXG4gICAgICAgIHBvczogMCxcbiAgICAgICAgZW5kOiAwLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZXh0LnRhZ2dlZFJlZmVyZW5jZUZpbGVzID0gcmVmZXJlbmNlZEZpbGVzO1xuICAgIHNmLnJlZmVyZW5jZWRGaWxlcyA9IHJlZmVyZW5jZWRGaWxlcztcbiAgICB0aGlzLnRhZ2dlZC5hZGQoc2YpO1xuICB9XG5cbiAgLyoqXG4gICAqIERpc2FibGUgdGhlIGBTaGltUmVmZXJlbmNlVGFnZ2VyYCBhbmQgZnJlZSBtZW1vcnkgYXNzb2NpYXRlZCB3aXRoIHRyYWNraW5nIHRhZ2dlZCBmaWxlcy5cbiAgICovXG4gIGZpbmFsaXplKCk6IHZvaWQge1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgIHRoaXMudGFnZ2VkLmNsZWFyKCk7XG4gIH1cbn1cbiJdfQ==