/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { absoluteFromSourceFile, isLocalRelativePath } from '../../../src/ngtsc/file_system';
import { isDtsPath } from '../../../src/ngtsc/util/src/typescript';
import { InPlaceFileWriter } from './in_place_file_writer';
export const NGCC_DIRECTORY = '__ivy_ngcc__';
export const NGCC_PROPERTY_EXTENSION = '_ivy_ngcc';
/**
 * This FileWriter creates a copy of the original entry-point, then writes the transformed
 * files onto the files in this copy, and finally updates the package.json with a new
 * entry-point format property that points to this new entry-point.
 *
 * If there are transformed typings files in this bundle, they are updated in-place (see the
 * `InPlaceFileWriter`).
 */
export class NewEntryPointFileWriter extends InPlaceFileWriter {
    constructor(fs, logger, errorOnFailedEntryPoint, pkgJsonUpdater) {
        super(fs, logger, errorOnFailedEntryPoint);
        this.pkgJsonUpdater = pkgJsonUpdater;
    }
    writeBundle(bundle, transformedFiles, formatProperties) {
        // The new folder is at the root of the overall package
        const entryPoint = bundle.entryPoint;
        const ngccFolder = this.fs.join(entryPoint.packagePath, NGCC_DIRECTORY);
        this.copyBundle(bundle, entryPoint.packagePath, ngccFolder, transformedFiles);
        transformedFiles.forEach(file => this.writeFile(file, entryPoint.packagePath, ngccFolder));
        this.updatePackageJson(entryPoint, formatProperties, ngccFolder);
    }
    revertBundle(entryPoint, transformedFilePaths, formatProperties) {
        // IMPLEMENTATION NOTE:
        //
        // The changes made by `copyBundle()` are not reverted here. The non-transformed copied files
        // are identical to the original ones and they will be overwritten when re-processing the
        // entry-point anyway.
        //
        // This way, we avoid the overhead of having to inform the master process about all source files
        // being copied in `copyBundle()`.
        // Revert the transformed files.
        for (const filePath of transformedFilePaths) {
            this.revertFile(filePath, entryPoint.packagePath);
        }
        // Revert any changes to `package.json`.
        this.revertPackageJson(entryPoint, formatProperties);
    }
    copyBundle(bundle, packagePath, ngccFolder, transformedFiles) {
        const doNotCopy = new Set(transformedFiles.map(f => f.path));
        bundle.src.program.getSourceFiles().forEach(sourceFile => {
            const originalPath = absoluteFromSourceFile(sourceFile);
            if (doNotCopy.has(originalPath)) {
                return;
            }
            const relativePath = this.fs.relative(packagePath, originalPath);
            const isInsidePackage = isLocalRelativePath(relativePath);
            if (!sourceFile.isDeclarationFile && isInsidePackage) {
                const newPath = this.fs.resolve(ngccFolder, relativePath);
                this.fs.ensureDir(this.fs.dirname(newPath));
                this.fs.copyFile(originalPath, newPath);
                this.copyAndUpdateSourceMap(originalPath, newPath);
            }
        });
    }
    /**
     * If a source file has an associated source-map, then copy this, while updating its sourceRoot
     * accordingly.
     *
     * For now don't try to parse the source for inline source-maps or external source-map links,
     * since that is more complex and will slow ngcc down.
     * Instead just check for a source-map file residing next to the source file, which is by far
     * the most common case.
     *
     * @param originalSrcPath absolute path to the original source file being copied.
     * @param newSrcPath absolute path to where the source will be written.
     */
    copyAndUpdateSourceMap(originalSrcPath, newSrcPath) {
        var _a;
        const sourceMapPath = (originalSrcPath + '.map');
        if (this.fs.exists(sourceMapPath)) {
            try {
                const sourceMap = JSON.parse(this.fs.readFile(sourceMapPath));
                const newSourceMapPath = (newSrcPath + '.map');
                const relativePath = this.fs.relative(this.fs.dirname(newSourceMapPath), this.fs.dirname(sourceMapPath));
                sourceMap.sourceRoot = this.fs.join(relativePath, sourceMap.sourceRoot || '.');
                this.fs.ensureDir(this.fs.dirname(newSourceMapPath));
                this.fs.writeFile(newSourceMapPath, JSON.stringify(sourceMap));
            }
            catch (e) {
                this.logger.warn(`Failed to process source-map at ${sourceMapPath}`);
                this.logger.warn((_a = e.message) !== null && _a !== void 0 ? _a : e);
            }
        }
    }
    writeFile(file, packagePath, ngccFolder) {
        if (isDtsPath(file.path.replace(/\.map$/, ''))) {
            // This is either `.d.ts` or `.d.ts.map` file
            super.writeFileAndBackup(file);
        }
        else {
            const relativePath = this.fs.relative(packagePath, file.path);
            const newFilePath = this.fs.resolve(ngccFolder, relativePath);
            this.fs.ensureDir(this.fs.dirname(newFilePath));
            this.fs.writeFile(newFilePath, file.contents);
        }
    }
    revertFile(filePath, packagePath) {
        if (isDtsPath(filePath.replace(/\.map$/, ''))) {
            // This is either `.d.ts` or `.d.ts.map` file
            super.revertFileAndBackup(filePath);
        }
        else if (this.fs.exists(filePath)) {
            const relativePath = this.fs.relative(packagePath, filePath);
            const newFilePath = this.fs.resolve(packagePath, NGCC_DIRECTORY, relativePath);
            this.fs.removeFile(newFilePath);
        }
    }
    updatePackageJson(entryPoint, formatProperties, ngccFolder) {
        if (formatProperties.length === 0) {
            // No format properties need updating.
            return;
        }
        const packageJson = entryPoint.packageJson;
        const packageJsonPath = this.fs.join(entryPoint.path, 'package.json');
        // All format properties point to the same format-path.
        const oldFormatProp = formatProperties[0];
        const oldFormatPath = packageJson[oldFormatProp];
        const oldAbsFormatPath = this.fs.resolve(entryPoint.path, oldFormatPath);
        const newAbsFormatPath = this.fs.resolve(ngccFolder, this.fs.relative(entryPoint.packagePath, oldAbsFormatPath));
        const newFormatPath = this.fs.relative(entryPoint.path, newAbsFormatPath);
        // Update all properties in `package.json` (both in memory and on disk).
        const update = this.pkgJsonUpdater.createUpdate();
        for (const formatProperty of formatProperties) {
            if (packageJson[formatProperty] !== oldFormatPath) {
                throw new Error(`Unable to update '${packageJsonPath}': Format properties ` +
                    `(${formatProperties.join(', ')}) map to more than one format-path.`);
            }
            update.addChange([`${formatProperty}${NGCC_PROPERTY_EXTENSION}`], newFormatPath, { before: formatProperty });
        }
        update.writeChanges(packageJsonPath, packageJson);
    }
    revertPackageJson(entryPoint, formatProperties) {
        if (formatProperties.length === 0) {
            // No format properties need reverting.
            return;
        }
        const packageJson = entryPoint.packageJson;
        const packageJsonPath = this.fs.join(entryPoint.path, 'package.json');
        // Revert all properties in `package.json` (both in memory and on disk).
        // Since `updatePackageJson()` only adds properties, it is safe to just remove them (if they
        // exist).
        const update = this.pkgJsonUpdater.createUpdate();
        for (const formatProperty of formatProperties) {
            update.addChange([`${formatProperty}${NGCC_PROPERTY_EXTENSION}`], undefined);
        }
        update.writeChanges(packageJsonPath, packageJson);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV3X2VudHJ5X3BvaW50X2ZpbGVfd3JpdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL3dyaXRpbmcvbmV3X2VudHJ5X3BvaW50X2ZpbGVfd3JpdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBQyxzQkFBc0IsRUFBOEIsbUJBQW1CLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUV2SCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sd0NBQXdDLENBQUM7QUFLakUsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHekQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLGNBQWMsQ0FBQztBQUM3QyxNQUFNLENBQUMsTUFBTSx1QkFBdUIsR0FBRyxXQUFXLENBQUM7QUFFbkQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxpQkFBaUI7SUFDNUQsWUFDSSxFQUFjLEVBQUUsTUFBYyxFQUFFLHVCQUFnQyxFQUN4RCxjQUFrQztRQUM1QyxLQUFLLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBRGpDLG1CQUFjLEdBQWQsY0FBYyxDQUFvQjtJQUU5QyxDQUFDO0lBRUQsV0FBVyxDQUNQLE1BQXdCLEVBQUUsZ0JBQStCLEVBQ3pELGdCQUEwQztRQUM1Qyx1REFBdUQ7UUFDdkQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQUNyQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixDQUFD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QU87U0FDUjtRQUVELE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUM7UUFDM0MsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQztRQUV0RSx3RUFBd0U7UUFDeEUsNEZBQTRGO1FBQzVGLFVBQVU7UUFDVixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBRWxELEtBQUssTUFBTSxjQUFjLElBQUksZ0JBQWdCLEVBQUU7WUFDN0MsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsY0FBYyxHQUFHLHVCQUF1QixFQUFFLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztTQUM5RTtRQUVELE1BQU0sQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3BELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIlxuLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGUsIEFic29sdXRlRnNQYXRoLCBGaWxlU3lzdGVtLCBpc0xvY2FsUmVsYXRpdmVQYXRofSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtMb2dnZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9sb2dnaW5nJztcbmltcG9ydCB7aXNEdHNQYXRofSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0VudHJ5UG9pbnQsIEVudHJ5UG9pbnRKc29uUHJvcGVydHl9IGZyb20gJy4uL3BhY2thZ2VzL2VudHJ5X3BvaW50JztcbmltcG9ydCB7RW50cnlQb2ludEJ1bmRsZX0gZnJvbSAnLi4vcGFja2FnZXMvZW50cnlfcG9pbnRfYnVuZGxlJztcbmltcG9ydCB7RmlsZVRvV3JpdGV9IGZyb20gJy4uL3JlbmRlcmluZy91dGlscyc7XG5cbmltcG9ydCB7SW5QbGFjZUZpbGVXcml0ZXJ9IGZyb20gJy4vaW5fcGxhY2VfZmlsZV93cml0ZXInO1xuaW1wb3J0IHtQYWNrYWdlSnNvblVwZGF0ZXJ9IGZyb20gJy4vcGFja2FnZV9qc29uX3VwZGF0ZXInO1xuXG5leHBvcnQgY29uc3QgTkdDQ19ESVJFQ1RPUlkgPSAnX19pdnlfbmdjY19fJztcbmV4cG9ydCBjb25zdCBOR0NDX1BST1BFUlRZX0VYVEVOU0lPTiA9ICdfaXZ5X25nY2MnO1xuXG4vKipcbiAqIFRoaXMgRmlsZVdyaXRlciBjcmVhdGVzIGEgY29weSBvZiB0aGUgb3JpZ2luYWwgZW50cnktcG9pbnQsIHRoZW4gd3JpdGVzIHRoZSB0cmFuc2Zvcm1lZFxuICogZmlsZXMgb250byB0aGUgZmlsZXMgaW4gdGhpcyBjb3B5LCBhbmQgZmluYWxseSB1cGRhdGVzIHRoZSBwYWNrYWdlLmpzb24gd2l0aCBhIG5ld1xuICogZW50cnktcG9pbnQgZm9ybWF0IHByb3BlcnR5IHRoYXQgcG9pbnRzIHRvIHRoaXMgbmV3IGVudHJ5LXBvaW50LlxuICpcbiAqIElmIHRoZXJlIGFyZSB0cmFuc2Zvcm1lZCB0eXBpbmdzIGZpbGVzIGluIHRoaXMgYnVuZGxlLCB0aGV5IGFyZSB1cGRhdGVkIGluLXBsYWNlIChzZWUgdGhlXG4gKiBgSW5QbGFjZUZpbGVXcml0ZXJgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE5ld0VudHJ5UG9pbnRGaWxlV3JpdGVyIGV4dGVuZHMgSW5QbGFjZUZpbGVXcml0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIGZzOiBGaWxlU3lzdGVtLCBsb2dnZXI6IExvZ2dlciwgZXJyb3JPbkZhaWxlZEVudHJ5UG9pbnQ6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIHBrZ0pzb25VcGRhdGVyOiBQYWNrYWdlSnNvblVwZGF0ZXIpIHtcbiAgICBzdXBlcihmcywgbG9nZ2VyLCBlcnJvck9uRmFpbGVkRW50cnlQb2ludCk7XG4gIH1cblxuICB3cml0ZUJ1bmRsZShcbiAgICAgIGJ1bmRsZTogRW50cnlQb2ludEJ1bmRsZSwgdHJhbnNmb3JtZWRGaWxlczogRmlsZVRvV3JpdGVbXSxcbiAgICAgIGZvcm1hdFByb3BlcnRpZXM6IEVudHJ5UG9pbnRKc29uUHJvcGVydHlbXSkge1xuICAgIC8vIFRoZSBuZXcgZm9sZGVyIGlzIGF0IHRoZSByb290IG9mIHRoZSBvdmVyYWxsIHBhY2thZ2VcbiAgICBjb25zdCBlbnRyeVBvaW50ID0gYnVuZGxlLmVudHJ5UG9pbnQ7XG4gICAgY29uc3QgbmdjY0ZvbGRlciA9IHRoaXMuZnMuam9pbihlbnRyeVBvaW50LnBhY2thZ2VQYXRoLCBOR0NDX0RJUkVDVE9SWSk7XG4gICAgdGhpcy5jb3B5QnVuZGxlKGJ1bmRsZSwgZW50cnlQb2ludC5wYWNrYWdlUGF0aCwgbmdjY0ZvbGRlciwgdHJhbnNmb3JtZWRGaWxlcyk7XG4gICAgdHJhbnNmb3JtZWRGaWxlcy5mb3JFYWNoKGZpbGUgPT4gdGhpcy53cml0ZUZpbGUoZmlsZSwgZW50cnlQb2ludC5wYWNrYWdlUGF0aCwgbmdjY0ZvbGRlcikpO1xuICAgIHRoaXMudXBkYXRlUGFja2FnZUpzb24oZW50cnlQb2ludCwgZm9ybWF0UHJvcGVydGllcywgbmdjY0ZvbGRlcik7XG4gIH1cblxuICByZXZlcnRCdW5kbGUoXG4gICAgICBlbnRyeVBvaW50OiBFbnRyeVBvaW50LCB0cmFuc2Zvcm1lZEZpbGVQYXRoczogQWJzb2x1dGVGc1BhdGhbXSxcbiAgICAgIGZvcm1hdFByb3BlcnRpZXM6IEVudHJ5UG9pbnRKc29uUHJvcGVydHlbXSk6IHZvaWQge1xuICAgIC8vIElNUExFTUVOVEFUSU9OIE5PVEU6XG4gICAgLy9cbiAgICAvLyBUaGUgY2hhbmdlcyBtYWRlIGJ5IGBjb3B5QnVuZGxlKClgIGFyZSBub3QgcmV2ZXJ0ZWQgaGVyZS4gVGhlIG5vbi10cmFuc2Zvcm1lZCBjb3BpZWQgZmlsZXNcbiAgICAvLyBhcmUgaWRlbnRpY2FsIHRvIHRoZSBvcmlnaW5hbCBvbmVzIGFuZCB0aGV5IHdpbGwgYmUgb3ZlcndyaXR0ZW4gd2hlbiByZS1wcm9jZXNzaW5nIHRoZVxuICAgIC8vIGVudHJ5LXBvaW50IGFueXdheS5cbiAgICAvL1xuICAgIC8vIFRoaXMgd2F5LCB3ZSBhdm9pZCB0aGUgb3ZlcmhlYWQgb2YgaGF2aW5nIHRvIGluZm9ybSB0aGUgbWFzdGVyIHByb2Nlc3MgYWJvdXQgYWxsIHNvdXJjZSBmaWxlc1xuICAgIC8vIGJlaW5nIGNvcGllZCBpbiBgY29weUJ1bmRsZSgpYC5cblxuICAgIC8vIFJldmVydCB0aGUgdHJhbnNmb3JtZWQgZmlsZXMuXG4gICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiB0cmFuc2Zvcm1lZEZpbGVQYXRocykge1xuICAgICAgdGhpcy5yZXZlcnRGaWxlKGZpbGVQYXRoLCBlbnRyeVBvaW50LnBhY2thZ2VQYXRoKTtcbiAgICB9XG5cbiAgICAvLyBSZXZlcnQgYW55IGNoYW5nZXMgdG8gYHBhY2thZ2UuanNvbmAuXG4gICAgdGhpcy5yZXZlcnRQYWNrYWdlSnNvbihlbnRyeVBvaW50LCBmb3JtYXRQcm9wZXJ0aWVzKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBjb3B5QnVuZGxlKFxuICAgICAgYnVuZGxlOiBFbnRyeVBvaW50QnVuZGxlLCBwYWNrYWdlUGF0aDogQWJzb2x1dGVGc1BhdGgsIG5nY2NGb2xkZXI6IEFic29sdXRlRnNQYXRoLFxuICAgICAgdHJhbnNmb3JtZWRGaWxlczogRmlsZVRvV3JpdGVbXSkge1xuICAgIGNvbnN0IGRvTm90Q29weSA9IG5ldyBTZXQodHJhbnNmb3JtZWRGaWxlcy5tYXAoZiA9PiBmLnBhdGgpKTtcbiAgICBidW5kbGUuc3JjLnByb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5mb3JFYWNoKHNvdXJjZUZpbGUgPT4ge1xuICAgICAgY29uc3Qgb3JpZ2luYWxQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzb3VyY2VGaWxlKTtcbiAgICAgIGlmIChkb05vdENvcHkuaGFzKG9yaWdpbmFsUGF0aCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gdGhpcy5mcy5yZWxhdGl2ZShwYWNrYWdlUGF0aCwgb3JpZ2luYWxQYXRoKTtcbiAgICAgIGNvbnN0IGlzSW5zaWRlUGFja2FnZSA9IGlzTG9jYWxSZWxhdGl2ZVBhdGgocmVsYXRpdmVQYXRoKTtcbiAgICAgIGlmICghc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSAmJiBpc0luc2lkZVBhY2thZ2UpIHtcbiAgICAgICAgY29uc3QgbmV3UGF0aCA9IHRoaXMuZnMucmVzb2x2ZShuZ2NjRm9sZGVyLCByZWxhdGl2ZVBhdGgpO1xuICAgICAgICB0aGlzLmZzLmVuc3VyZURpcih0aGlzLmZzLmRpcm5hbWUobmV3UGF0aCkpO1xuICAgICAgICB0aGlzLmZzLmNvcHlGaWxlKG9yaWdpbmFsUGF0aCwgbmV3UGF0aCk7XG4gICAgICAgIHRoaXMuY29weUFuZFVwZGF0ZVNvdXJjZU1hcChvcmlnaW5hbFBhdGgsIG5ld1BhdGgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIGEgc291cmNlIGZpbGUgaGFzIGFuIGFzc29jaWF0ZWQgc291cmNlLW1hcCwgdGhlbiBjb3B5IHRoaXMsIHdoaWxlIHVwZGF0aW5nIGl0cyBzb3VyY2VSb290XG4gICAqIGFjY29yZGluZ2x5LlxuICAgKlxuICAgKiBGb3Igbm93IGRvbid0IHRyeSB0byBwYXJzZSB0aGUgc291cmNlIGZvciBpbmxpbmUgc291cmNlLW1hcHMgb3IgZXh0ZXJuYWwgc291cmNlLW1hcCBsaW5rcyxcbiAgICogc2luY2UgdGhhdCBpcyBtb3JlIGNvbXBsZXggYW5kIHdpbGwgc2xvdyBuZ2NjIGRvd24uXG4gICAqIEluc3RlYWQganVzdCBjaGVjayBmb3IgYSBzb3VyY2UtbWFwIGZpbGUgcmVzaWRpbmcgbmV4dCB0byB0aGUgc291cmNlIGZpbGUsIHdoaWNoIGlzIGJ5IGZhclxuICAgKiB0aGUgbW9zdCBjb21tb24gY2FzZS5cbiAgICpcbiAgICogQHBhcmFtIG9yaWdpbmFsU3JjUGF0aCBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZSBiZWluZyBjb3BpZWQuXG4gICAqIEBwYXJhbSBuZXdTcmNQYXRoIGFic29sdXRlIHBhdGggdG8gd2hlcmUgdGhlIHNvdXJjZSB3aWxsIGJlIHdyaXR0ZW4uXG4gICAqL1xuICBwcm90ZWN0ZWQgY29weUFuZFVwZGF0ZVNvdXJjZU1hcChvcmlnaW5hbFNyY1BhdGg6IEFic29sdXRlRnNQYXRoLCBuZXdTcmNQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6XG4gICAgICB2b2lkIHtcbiAgICBjb25zdCBzb3VyY2VNYXBQYXRoID0gKG9yaWdpbmFsU3JjUGF0aCArICcubWFwJykgYXMgQWJzb2x1dGVGc1BhdGg7XG4gICAgaWYgKHRoaXMuZnMuZXhpc3RzKHNvdXJjZU1hcFBhdGgpKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzb3VyY2VNYXAgPVxuICAgICAgICAgICAgSlNPTi5wYXJzZSh0aGlzLmZzLnJlYWRGaWxlKHNvdXJjZU1hcFBhdGgpKSBhcyB7c291cmNlUm9vdDogc3RyaW5nLCBba2V5OiBzdHJpbmddOiBhbnl9O1xuICAgICAgICBjb25zdCBuZXdTb3VyY2VNYXBQYXRoID0gKG5ld1NyY1BhdGggKyAnLm1hcCcpIGFzIEFic29sdXRlRnNQYXRoO1xuICAgICAgICBjb25zdCByZWxhdGl2ZVBhdGggPVxuICAgICAgICAgICAgdGhpcy5mcy5yZWxhdGl2ZSh0aGlzLmZzLmRpcm5hbWUobmV3U291cmNlTWFwUGF0aCksIHRoaXMuZnMuZGlybmFtZShzb3VyY2VNYXBQYXRoKSk7XG4gICAgICAgIHNvdXJjZU1hcC5zb3VyY2VSb290ID0gdGhpcy5mcy5qb2luKHJlbGF0aXZlUGF0aCwgc291cmNlTWFwLnNvdXJjZVJvb3QgfHwgJy4nKTtcbiAgICAgICAgdGhpcy5mcy5lbnN1cmVEaXIodGhpcy5mcy5kaXJuYW1lKG5ld1NvdXJjZU1hcFBhdGgpKTtcbiAgICAgICAgdGhpcy5mcy53cml0ZUZpbGUobmV3U291cmNlTWFwUGF0aCwgSlNPTi5zdHJpbmdpZnkoc291cmNlTWFwKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLndhcm4oYEZhaWxlZCB0byBwcm9jZXNzIHNvdXJjZS1tYXAgYXQgJHtzb3VyY2VNYXBQYXRofWApO1xuICAgICAgICB0aGlzLmxvZ2dlci53YXJuKGUubWVzc2FnZSA/PyBlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgd3JpdGVGaWxlKGZpbGU6IEZpbGVUb1dyaXRlLCBwYWNrYWdlUGF0aDogQWJzb2x1dGVGc1BhdGgsIG5nY2NGb2xkZXI6IEFic29sdXRlRnNQYXRoKTpcbiAgICAgIHZvaWQge1xuICAgIGlmIChpc0R0c1BhdGgoZmlsZS5wYXRoLnJlcGxhY2UoL1xcLm1hcCQvLCAnJykpKSB7XG4gICAgICAvLyBUaGlzIGlzIGVpdGhlciBgLmQudHNgIG9yIGAuZC50cy5tYXBgIGZpbGVcbiAgICAgIHN1cGVyLndyaXRlRmlsZUFuZEJhY2t1cChmaWxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gdGhpcy5mcy5yZWxhdGl2ZShwYWNrYWdlUGF0aCwgZmlsZS5wYXRoKTtcbiAgICAgIGNvbnN0IG5ld0ZpbGVQYXRoID0gdGhpcy5mcy5yZXNvbHZlKG5nY2NGb2xkZXIsIHJlbGF0aXZlUGF0aCk7XG4gICAgICB0aGlzLmZzLmVuc3VyZURpcih0aGlzLmZzLmRpcm5hbWUobmV3RmlsZVBhdGgpKTtcbiAgICAgIHRoaXMuZnMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoLCBmaWxlLmNvbnRlbnRzKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgcmV2ZXJ0RmlsZShmaWxlUGF0aDogQWJzb2x1dGVGc1BhdGgsIHBhY2thZ2VQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IHZvaWQge1xuICAgIGlmIChpc0R0c1BhdGgoZmlsZVBhdGgucmVwbGFjZSgvXFwubWFwJC8sICcnKSkpIHtcbiAgICAgIC8vIFRoaXMgaXMgZWl0aGVyIGAuZC50c2Agb3IgYC5kLnRzLm1hcGAgZmlsZVxuICAgICAgc3VwZXIucmV2ZXJ0RmlsZUFuZEJhY2t1cChmaWxlUGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmZzLmV4aXN0cyhmaWxlUGF0aCkpIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHRoaXMuZnMucmVsYXRpdmUocGFja2FnZVBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IG5ld0ZpbGVQYXRoID0gdGhpcy5mcy5yZXNvbHZlKHBhY2thZ2VQYXRoLCBOR0NDX0RJUkVDVE9SWSwgcmVsYXRpdmVQYXRoKTtcbiAgICAgIHRoaXMuZnMucmVtb3ZlRmlsZShuZXdGaWxlUGF0aCk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHVwZGF0ZVBhY2thZ2VKc29uKFxuICAgICAgZW50cnlQb2ludDogRW50cnlQb2ludCwgZm9ybWF0UHJvcGVydGllczogRW50cnlQb2ludEpzb25Qcm9wZXJ0eVtdLFxuICAgICAgbmdjY0ZvbGRlcjogQWJzb2x1dGVGc1BhdGgpIHtcbiAgICBpZiAoZm9ybWF0UHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIE5vIGZvcm1hdCBwcm9wZXJ0aWVzIG5lZWQgdXBkYXRpbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGFja2FnZUpzb24gPSBlbnRyeVBvaW50LnBhY2thZ2VKc29uO1xuICAgIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHRoaXMuZnMuam9pbihlbnRyeVBvaW50LnBhdGgsICdwYWNrYWdlLmpzb24nKTtcblxuICAgIC8vIEFsbCBmb3JtYXQgcHJvcGVydGllcyBwb2ludCB0byB0aGUgc2FtZSBmb3JtYXQtcGF0aC5cbiAgICBjb25zdCBvbGRGb3JtYXRQcm9wID0gZm9ybWF0UHJvcGVydGllc1swXSE7XG4gICAgY29uc3Qgb2xkRm9ybWF0UGF0aCA9IHBhY2thZ2VKc29uW29sZEZvcm1hdFByb3BdITtcbiAgICBjb25zdCBvbGRBYnNGb3JtYXRQYXRoID0gdGhpcy5mcy5yZXNvbHZlKGVudHJ5UG9pbnQucGF0aCwgb2xkRm9ybWF0UGF0aCk7XG4gICAgY29uc3QgbmV3QWJzRm9ybWF0UGF0aCA9XG4gICAgICAgIHRoaXMuZnMucmVzb2x2ZShuZ2NjRm9sZGVyLCB0aGlzLmZzLnJlbGF0aXZlKGVudHJ5UG9pbnQucGFja2FnZVBhdGgsIG9sZEFic0Zvcm1hdFBhdGgpKTtcbiAgICBjb25zdCBuZXdGb3JtYXRQYXRoID0gdGhpcy5mcy5yZWxhdGl2ZShlbnRyeVBvaW50LnBhdGgsIG5ld0Fic0Zvcm1hdFBhdGgpO1xuXG4gICAgLy8gVXBkYXRlIGFsbCBwcm9wZXJ0aWVzIGluIGBwYWNrYWdlLmpzb25gIChib3RoIGluIG1lbW9yeSBhbmQgb24gZGlzaykuXG4gICAgY29uc3QgdXBkYXRlID0gdGhpcy5wa2dKc29uVXBkYXRlci5jcmVhdGVVcGRhdGUoKTtcblxuICAgIGZvciAoY29uc3QgZm9ybWF0UHJvcGVydHkgb2YgZm9ybWF0UHJvcGVydGllcykge1xuICAgICAgaWYgKHBhY2thZ2VKc29uW2Zvcm1hdFByb3BlcnR5XSAhPT0gb2xkRm9ybWF0UGF0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgVW5hYmxlIHRvIHVwZGF0ZSAnJHtwYWNrYWdlSnNvblBhdGh9JzogRm9ybWF0IHByb3BlcnRpZXMgYCArXG4gICAgICAgICAgICBgKCR7Zm9ybWF0UHJvcGVydGllcy5qb2luKCcsICcpfSkgbWFwIHRvIG1vcmUgdGhhbiBvbmUgZm9ybWF0LXBhdGguYCk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZS5hZGRDaGFuZ2UoXG4gICAgICAgICAgW2Ake2Zvcm1hdFByb3BlcnR5fSR7TkdDQ19QUk9QRVJUWV9FWFRFTlNJT059YF0sIG5ld0Zvcm1hdFBhdGgsIHtiZWZvcmU6IGZvcm1hdFByb3BlcnR5fSk7XG4gICAgfVxuXG4gICAgdXBkYXRlLndyaXRlQ2hhbmdlcyhwYWNrYWdlSnNvblBhdGgsIHBhY2thZ2VKc29uKTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZXZlcnRQYWNrYWdlSnNvbihlbnRyeVBvaW50OiBFbnRyeVBvaW50LCBmb3JtYXRQcm9wZXJ0aWVzOiBFbnRyeVBvaW50SnNvblByb3BlcnR5W10pIHtcbiAgICBpZiAoZm9ybWF0UHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIE5vIGZvcm1hdCBwcm9wZXJ0aWVzIG5lZWQgcmV2ZXJ0aW5nLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gZW50cnlQb2ludC5wYWNrYWdlSnNvbjtcbiAgICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSB0aGlzLmZzLmpvaW4oZW50cnlQb2ludC5wYXRoLCAncGFja2FnZS5qc29uJyk7XG5cbiAgICAvLyBSZXZlcnQgYWxsIHByb3BlcnRpZXMgaW4gYHBhY2thZ2UuanNvbmAgKGJvdGggaW4gbWVtb3J5IGFuZCBvbiBkaXNrKS5cbiAgICAvLyBTaW5jZSBgdXBkYXRlUGFja2FnZUpzb24oKWAgb25seSBhZGRzIHByb3BlcnRpZXMsIGl0IGlzIHNhZmUgdG8ganVzdCByZW1vdmUgdGhlbSAoaWYgdGhleVxuICAgIC8vIGV4aXN0KS5cbiAgICBjb25zdCB1cGRhdGUgPSB0aGlzLnBrZ0pzb25VcGRhdGVyLmNyZWF0ZVVwZGF0ZSgpO1xuXG4gICAgZm9yIChjb25zdCBmb3JtYXRQcm9wZXJ0eSBvZiBmb3JtYXRQcm9wZXJ0aWVzKSB7XG4gICAgICB1cGRhdGUuYWRkQ2hhbmdlKFtgJHtmb3JtYXRQcm9wZXJ0eX0ke05HQ0NfUFJPUEVSVFlfRVhURU5TSU9OfWBdLCB1bmRlZmluZWQpO1xuICAgIH1cblxuICAgIHVwZGF0ZS53cml0ZUNoYW5nZXMocGFja2FnZUpzb25QYXRoLCBwYWNrYWdlSnNvbik7XG4gIH1cbn1cbiJdfQ==