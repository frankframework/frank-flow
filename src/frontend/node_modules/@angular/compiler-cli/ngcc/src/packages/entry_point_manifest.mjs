/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createHash } from 'crypto';
import { NGCC_VERSION } from './build_marker';
import { getEntryPointInfo, isEntryPoint } from './entry_point';
/**
 * Manages reading and writing a manifest file that contains a list of all the entry-points that
 * were found below a given basePath.
 *
 * This is a super-set of the entry-points that are actually processed for a given run of ngcc,
 * since some may already be processed, or excluded if they do not have the required format.
 */
export class EntryPointManifest {
    constructor(fs, config, logger) {
        this.fs = fs;
        this.config = config;
        this.logger = logger;
    }
    /**
     * Try to get the entry-point info from a manifest file for the given `basePath` if it exists and
     * is not out of date.
     *
     * Reasons for the manifest to be out of date are:
     *
     * * the file does not exist
     * * the ngcc version has changed
     * * the package lock-file (i.e. yarn.lock or package-lock.json) has changed
     * * the project configuration has changed
     * * one or more entry-points in the manifest are not valid
     *
     * @param basePath The path that would contain the entry-points and the manifest file.
     * @returns an array of entry-point information for all entry-points found below the given
     * `basePath` or `null` if the manifest was out of date.
     */
    readEntryPointsUsingManifest(basePath) {
        try {
            if (this.fs.basename(basePath) !== 'node_modules') {
                return null;
            }
            const manifestPath = this.getEntryPointManifestPath(basePath);
            if (!this.fs.exists(manifestPath)) {
                return null;
            }
            const computedLockFileHash = this.computeLockFileHash(basePath);
            if (computedLockFileHash === null) {
                return null;
            }
            const { ngccVersion, configFileHash, lockFileHash, entryPointPaths } = JSON.parse(this.fs.readFile(manifestPath));
            if (ngccVersion !== NGCC_VERSION || configFileHash !== this.config.hash ||
                lockFileHash !== computedLockFileHash) {
                return null;
            }
            this.logger.debug(`Entry-point manifest found for ${basePath} so loading entry-point information directly.`);
            const startTime = Date.now();
            const entryPoints = [];
            for (const [packagePath, entryPointPath, dependencyPaths = [], missingPaths = [], deepImportPaths = []] of entryPointPaths) {
                const result = getEntryPointInfo(this.fs, this.config, this.logger, this.fs.resolve(basePath, packagePath), this.fs.resolve(basePath, entryPointPath));
                if (!isEntryPoint(result)) {
                    throw new Error(`The entry-point manifest at ${manifestPath} contained an invalid pair of package paths: [${packagePath}, ${entryPointPath}]`);
                }
                else {
                    entryPoints.push({
                        entryPoint: result,
                        depInfo: {
                            dependencies: new Set(dependencyPaths),
                            missing: new Set(missingPaths),
                            deepImports: new Set(deepImportPaths),
                        }
                    });
                }
            }
            const duration = Math.round((Date.now() - startTime) / 100) / 10;
            this.logger.debug(`Reading entry-points using the manifest entries took ${duration}s.`);
            return entryPoints;
        }
        catch (e) {
            this.logger.warn(`Unable to read the entry-point manifest for ${basePath}:\n`, e.stack || e.toString());
            return null;
        }
    }
    /**
     * Write a manifest file at the given `basePath`.
     *
     * The manifest includes the current ngcc version and hashes of the package lock-file and current
     * project config. These will be used to check whether the manifest file is out of date. See
     * `readEntryPointsUsingManifest()`.
     *
     * @param basePath The path where the manifest file is to be written.
     * @param entryPoints A collection of entry-points to record in the manifest.
     */
    writeEntryPointManifest(basePath, entryPoints) {
        if (this.fs.basename(basePath) !== 'node_modules') {
            return;
        }
        const lockFileHash = this.computeLockFileHash(basePath);
        if (lockFileHash === null) {
            return;
        }
        const manifest = {
            ngccVersion: NGCC_VERSION,
            configFileHash: this.config.hash,
            lockFileHash: lockFileHash,
            entryPointPaths: entryPoints.map(e => {
                const entryPointPaths = [
                    this.fs.relative(basePath, e.entryPoint.packagePath),
                    this.fs.relative(basePath, e.entryPoint.path),
                ];
                // Only add depInfo arrays if needed.
                if (e.depInfo.dependencies.size > 0) {
                    entryPointPaths[2] = Array.from(e.depInfo.dependencies);
                }
                else if (e.depInfo.missing.size > 0 || e.depInfo.deepImports.size > 0) {
                    entryPointPaths[2] = [];
                }
                if (e.depInfo.missing.size > 0) {
                    entryPointPaths[3] = Array.from(e.depInfo.missing);
                }
                else if (e.depInfo.deepImports.size > 0) {
                    entryPointPaths[3] = [];
                }
                if (e.depInfo.deepImports.size > 0) {
                    entryPointPaths[4] = Array.from(e.depInfo.deepImports);
                }
                return entryPointPaths;
            }),
        };
        this.fs.writeFile(this.getEntryPointManifestPath(basePath), JSON.stringify(manifest));
    }
    getEntryPointManifestPath(basePath) {
        return this.fs.resolve(basePath, '__ngcc_entry_points__.json');
    }
    computeLockFileHash(basePath) {
        const directory = this.fs.dirname(basePath);
        for (const lockFileName of ['yarn.lock', 'package-lock.json']) {
            const lockFilePath = this.fs.resolve(directory, lockFileName);
            if (this.fs.exists(lockFilePath)) {
                const lockFileContents = this.fs.readFile(lockFilePath);
                return createHash(this.config.hashAlgorithm).update(lockFileContents).digest('hex');
            }
        }
        return null;
    }
}
/**
 * A specialized implementation of the `EntryPointManifest` that can be used to invalidate the
 * current manifest file.
 *
 * It always returns `null` from the `readEntryPointsUsingManifest()` method, which forces a new
 * manifest to be created, which will overwrite the current file when `writeEntryPointManifest()`
 * is called.
 */
export class InvalidatingEntryPointManifest extends EntryPointManifest {
    readEntryPointsUsingManifest(_basePath) {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50cnlfcG9pbnRfbWFuaWZlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvcGFja2FnZXMvZW50cnlfcG9pbnRfbWFuaWZlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQU1sQyxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFNUMsT0FBTyxFQUFDLGlCQUFpQixFQUFFLFlBQVksRUFBOEIsTUFBTSxlQUFlLENBQUM7QUFFM0Y7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLGtCQUFrQjtJQUM3QixZQUFvQixFQUFjLEVBQVUsTUFBeUIsRUFBVSxNQUFjO1FBQXpFLE9BQUUsR0FBRixFQUFFLENBQVk7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFtQjtRQUFVLFdBQU0sR0FBTixNQUFNLENBQVE7SUFBRyxDQUFDO0lBRWpHOzs7Ozs7Ozs7Ozs7Ozs7T0FlRztJQUNILDRCQUE0QixDQUFDLFFBQXdCO1FBQ25ELElBQUk7WUFDRixJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLGNBQWMsRUFBRTtnQkFDakQsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM5RCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQ2pDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNoRSxJQUFJLG9CQUFvQixLQUFLLElBQUksRUFBRTtnQkFDakMsT0FB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LFNBQVEsa0JBQWtCO0lBQ3BFLDRCQUE0QixDQUFDLFNBQXlCO1FBQ3BELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge2NyZWF0ZUhhc2h9IGZyb20gJ2NyeXB0byc7XG5cbmltcG9ydCB7QWJzb2x1dGVGc1BhdGgsIEZpbGVTeXN0ZW0sIFBhdGhTZWdtZW50fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtMb2dnZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9sb2dnaW5nJztcbmltcG9ydCB7RW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXN9IGZyb20gJy4uL2RlcGVuZGVuY2llcy9kZXBlbmRlbmN5X2hvc3QnO1xuXG5pbXBvcnQge05HQ0NfVkVSU0lPTn0gZnJvbSAnLi9idWlsZF9tYXJrZXInO1xuaW1wb3J0IHtOZ2NjQ29uZmlndXJhdGlvbn0gZnJvbSAnLi9jb25maWd1cmF0aW9uJztcbmltcG9ydCB7Z2V0RW50cnlQb2ludEluZm8sIGlzRW50cnlQb2ludCwgUGFja2FnZUpzb25Gb3JtYXRQcm9wZXJ0aWVzfSBmcm9tICcuL2VudHJ5X3BvaW50JztcblxuLyoqXG4gKiBNYW5hZ2VzIHJlYWRpbmcgYW5kIHdyaXRpbmcgYSBtYW5pZmVzdCBmaWxlIHRoYXQgY29udGFpbnMgYSBsaXN0IG9mIGFsbCB0aGUgZW50cnktcG9pbnRzIHRoYXRcbiAqIHdlcmUgZm91bmQgYmVsb3cgYSBnaXZlbiBiYXNlUGF0aC5cbiAqXG4gKiBUaGlzIGlzIGEgc3VwZXItc2V0IG9mIHRoZSBlbnRyeS1wb2ludHMgdGhhdCBhcmUgYWN0dWFsbHkgcHJvY2Vzc2VkIGZvciBhIGdpdmVuIHJ1biBvZiBuZ2NjLFxuICogc2luY2Ugc29tZSBtYXkgYWxyZWFkeSBiZSBwcm9jZXNzZWQsIG9yIGV4Y2x1ZGVkIGlmIHRoZXkgZG8gbm90IGhhdmUgdGhlIHJlcXVpcmVkIGZvcm1hdC5cbiAqL1xuZXhwb3J0IGNsYXNzIEVudHJ5UG9pbnRNYW5pZmVzdCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZnM6IEZpbGVTeXN0ZW0sIHByaXZhdGUgY29uZmlnOiBOZ2NjQ29uZmlndXJhdGlvbiwgcHJpdmF0ZSBsb2dnZXI6IExvZ2dlcikge31cblxuICAvKipcbiAgICogVHJ5IHRvIGdldCB0aGUgZW50cnktcG9pbnQgaW5mbyBmcm9tIGEgbWFuaWZlc3QgZmlsZSBmb3IgdGhlIGdpdmVuIGBiYXNlUGF0aGAgaWYgaXQgZXhpc3RzIGFuZFxuICAgKiBpcyBub3Qgb3V0IG9mIGRhdGUuXG4gICAqXG4gICAqIFJlYXNvbnMgZm9yIHRoZSBtYW5pZmVzdCB0byBiZSBvdXQgb2YgZGF0ZSBhcmU6XG4gICAqXG4gICAqICogdGhlIGZpbGUgZG9lcyBub3QgZXhpc3RcbiAgICogKiB0aGUgbmdjYyB2ZXJzaW9uIGhhcyBjaGFuZ2VkXG4gICAqICogdGhlIHBhY2thZ2UgbG9jay1maWxlIChpLmUuIHlhcm4ubG9jayBvciBwYWNrYWdlLWxvY2suanNvbikgaGFzIGNoYW5nZWRcbiAgICogKiB0aGUgcHJvamVjdCBjb25maWd1cmF0aW9uIGhhcyBjaGFuZ2VkXG4gICAqICogb25lIG9yIG1vcmUgZW50cnktcG9pbnRzIGluIHRoZSBtYW5pZmVzdCBhcmUgbm90IHZhbGlkXG4gICAqXG4gICAqIEBwYXJhbSBiYXNlUGF0aCBUaGUgcGF0aCB0aGF0IHdvdWxkIGNvbnRhaW4gdGhlIGVudHJ5LXBvaW50cyBhbmQgdGhlIG1hbmlmZXN0IGZpbGUuXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIGVudHJ5LXBvaW50IGluZm9ybWF0aW9uIGZvciBhbGwgZW50cnktcG9pbnRzIGZvdW5kIGJlbG93IHRoZSBnaXZlblxuICAgKiBgYmFzZVBhdGhgIG9yIGBudWxsYCBpZiB0aGUgbWFuaWZlc3Qgd2FzIG91dCBvZiBkYXRlLlxuICAgKi9cbiAgcmVhZEVudHJ5UG9pbnRzVXNpbmdNYW5pZmVzdChiYXNlUGF0aDogQWJzb2x1dGVGc1BhdGgpOiBFbnRyeVBvaW50V2l0aERlcGVuZGVuY2llc1tdfG51bGwge1xuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy5mcy5iYXNlbmFtZShiYXNlUGF0aCkgIT09ICdub2RlX21vZHVsZXMnKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYW5pZmVzdFBhdGggPSB0aGlzLmdldEVudHJ5UG9pbnRNYW5pZmVzdFBhdGgoYmFzZVBhdGgpO1xuICAgICAgaWYgKCF0aGlzLmZzLmV4aXN0cyhtYW5pZmVzdFBhdGgpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb21wdXRlZExvY2tGaWxlSGFzaCA9IHRoaXMuY29tcHV0ZUxvY2tGaWxlSGFzaChiYXNlUGF0aCk7XG4gICAgICBpZiAoY29tcHV0ZWRMb2NrRmlsZUhhc2ggPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHtuZ2NjVmVyc2lvbiwgY29uZmlnRmlsZUhhc2gsIGxvY2tGaWxlSGFzaCwgZW50cnlQb2ludFBhdGhzfSA9XG4gICAgICAgICAgSlNPTi5wYXJzZSh0aGlzLmZzLnJlYWRGaWxlKG1hbmlmZXN0UGF0aCkpIGFzIEVudHJ5UG9pbnRNYW5pZmVzdEZpbGU7XG4gICAgICBpZiAobmdjY1ZlcnNpb24gIT09IE5HQ0NfVkVSU0lPTiB8fCBjb25maWdGaWxlSGFzaCAhPT0gdGhpcy5jb25maWcuaGFzaCB8fFxuICAgICAgICAgIGxvY2tGaWxlSGFzaCAhPT0gY29tcHV0ZWRMb2NrRmlsZUhhc2gpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKGBFbnRyeS1wb2ludCBtYW5pZmVzdCBmb3VuZCBmb3IgJHtcbiAgICAgICAgICBiYXNlUGF0aH0gc28gbG9hZGluZyBlbnRyeS1wb2ludCBpbmZvcm1hdGlvbiBkaXJlY3RseS5gKTtcbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cbiAgICAgIGNvbnN0IGVudHJ5UG9pbnRzOiBFbnRyeVBvaW50V2l0aERlcGVuZGVuY2llc1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0XG4gICAgICAgICAgICAgICBbcGFja2FnZVBhdGgsIGVudHJ5UG9pbnRQYXRoLCBkZXBlbmRlbmN5UGF0aHMgPSBbXSwgbWlzc2luZ1BhdGhzID0gW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWVwSW1wb3J0UGF0aHMgPSBbXV0gb2YgZW50cnlQb2ludFBhdGhzKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGdldEVudHJ5UG9pbnRJbmZvKFxuICAgICAgICAgICAgdGhpcy5mcywgdGhpcy5jb25maWcsIHRoaXMubG9nZ2VyLCB0aGlzLmZzLnJlc29sdmUoYmFzZVBhdGgsIHBhY2thZ2VQYXRoKSxcbiAgICAgICAgICAgIHRoaXMuZnMucmVzb2x2ZShiYXNlUGF0aCwgZW50cnlQb2ludFBhdGgpKTtcbiAgICAgICAgaWYgKCFpc0VudHJ5UG9pbnQocmVzdWx0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIGVudHJ5LXBvaW50IG1hbmlmZXN0IGF0ICR7XG4gICAgICAgICAgICAgIG1hbmlmZXN0UGF0aH0gY29udGFpbmVkIGFuIGludmFsaWQgcGFpciBvZiBwYWNrYWdlIHBhdGhzOiBbJHtwYWNrYWdlUGF0aH0sICR7XG4gICAgICAgICAgICAgIGVudHJ5UG9pbnRQYXRofV1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnRyeVBvaW50cy5wdXNoKHtcbiAgICAgICAgICAgIGVudHJ5UG9pbnQ6IHJlc3VsdCxcbiAgICAgICAgICAgIGRlcEluZm86IHtcbiAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiBuZXcgU2V0KGRlcGVuZGVuY3lQYXRocyksXG4gICAgICAgICAgICAgIG1pc3Npbmc6IG5ldyBTZXQobWlzc2luZ1BhdGhzKSxcbiAgICAgICAgICAgICAgZGVlcEltcG9ydHM6IG5ldyBTZXQoZGVlcEltcG9ydFBhdGhzKSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgZHVyYXRpb24gPSBNYXRoLnJvdW5kKChEYXRlLm5vdygpIC0gc3RhcnRUaW1lKSAvIDEwMCkgLyAxMDtcbiAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKGBSZWFkaW5nIGVudHJ5LXBvaW50cyB1c2luZyB0aGUgbWFuaWZlc3QgZW50cmllcyB0b29rICR7ZHVyYXRpb259cy5gKTtcbiAgICAgIHJldHVybiBlbnRyeVBvaW50cztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKFxuICAgICAgICAgIGBVbmFibGUgdG8gcmVhZCB0aGUgZW50cnktcG9pbnQgbWFuaWZlc3QgZm9yICR7YmFzZVBhdGh9OlxcbmAsIGUuc3RhY2sgfHwgZS50b1N0cmluZygpKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSBhIG1hbmlmZXN0IGZpbGUgYXQgdGhlIGdpdmVuIGBiYXNlUGF0aGAuXG4gICAqXG4gICAqIFRoZSBtYW5pZmVzdCBpbmNsdWRlcyB0aGUgY3VycmVudCBuZ2NjIHZlcnNpb24gYW5kIGhhc2hlcyBvZiB0aGUgcGFja2FnZSBsb2NrLWZpbGUgYW5kIGN1cnJlbnRcbiAgICogcHJvamVjdCBjb25maWcuIFRoZXNlIHdpbGwgYmUgdXNlZCB0byBjaGVjayB3aGV0aGVyIHRoZSBtYW5pZmVzdCBmaWxlIGlzIG91dCBvZiBkYXRlLiBTZWVcbiAgICogYHJlYWRFbnRyeVBvaW50c1VzaW5nTWFuaWZlc3QoKWAuXG4gICAqXG4gICAqIEBwYXJhbSBiYXNlUGF0aCBUaGUgcGF0aCB3aGVyZSB0aGUgbWFuaWZlc3QgZmlsZSBpcyB0byBiZSB3cml0dGVuLlxuICAgKiBAcGFyYW0gZW50cnlQb2ludHMgQSBjb2xsZWN0aW9uIG9mIGVudHJ5LXBvaW50cyB0byByZWNvcmQgaW4gdGhlIG1hbmlmZXN0LlxuICAgKi9cbiAgd3JpdGVFbnRyeVBvaW50TWFuaWZlc3QoYmFzZVBhdGg6IEFic29sdXRlRnNQYXRoLCBlbnRyeVBvaW50czogRW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXNbXSk6XG4gICAgICB2b2lkIHtcbiAgICBpZiAodGhpcy5mcy5iYXNlbmFtZShiYXNlUGF0aCkgIT09ICdub2RlX21vZHVsZXMnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbG9ja0ZpbGVIYXNoID0gdGhpcy5jb21wdXRlTG9ja0ZpbGVIYXNoKGJhc2VQYXRoKTtcbiAgICBpZiAobG9ja0ZpbGVIYXNoID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG1hbmlmZXN0OiBFbnRyeVBvaW50TWFuaWZlc3RGaWxlID0ge1xuICAgICAgbmdjY1ZlcnNpb246IE5HQ0NfVkVSU0lPTixcbiAgICAgIGNvbmZpZ0ZpbGVIYXNoOiB0aGlzLmNvbmZpZy5oYXNoLFxuICAgICAgbG9ja0ZpbGVIYXNoOiBsb2NrRmlsZUhhc2gsXG4gICAgICBlbnRyeVBvaW50UGF0aHM6IGVudHJ5UG9pbnRzLm1hcChlID0+IHtcbiAgICAgICAgY29uc3QgZW50cnlQb2ludFBhdGhzOiBFbnRyeVBvaW50UGF0aHMgPSBbXG4gICAgICAgICAgdGhpcy5mcy5yZWxhdGl2ZShiYXNlUGF0aCwgZS5lbnRyeVBvaW50LnBhY2thZ2VQYXRoKSxcbiAgICAgICAgICB0aGlzLmZzLnJlbGF0aXZlKGJhc2VQYXRoLCBlLmVudHJ5UG9pbnQucGF0aCksXG4gICAgICAgIF07XG4gICAgICAgIC8vIE9ubHkgYWRkIGRlcEluZm8gYXJyYXlzIGlmIG5lZWRlZC5cbiAgICAgICAgaWYgKGUuZGVwSW5mby5kZXBlbmRlbmNpZXMuc2l6ZSA+IDApIHtcbiAgICAgICAgICBlbnRyeVBvaW50UGF0aHNbMl0gPSBBcnJheS5mcm9tKGUuZGVwSW5mby5kZXBlbmRlbmNpZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKGUuZGVwSW5mby5taXNzaW5nLnNpemUgPiAwIHx8IGUuZGVwSW5mby5kZWVwSW1wb3J0cy5zaXplID4gMCkge1xuICAgICAgICAgIGVudHJ5UG9pbnRQYXRoc1syXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlLmRlcEluZm8ubWlzc2luZy5zaXplID4gMCkge1xuICAgICAgICAgIGVudHJ5UG9pbnRQYXRoc1szXSA9IEFycmF5LmZyb20oZS5kZXBJbmZvLm1pc3NpbmcpO1xuICAgICAgICB9IGVsc2UgaWYgKGUuZGVwSW5mby5kZWVwSW1wb3J0cy5zaXplID4gMCkge1xuICAgICAgICAgIGVudHJ5UG9pbnRQYXRoc1szXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlLmRlcEluZm8uZGVlcEltcG9ydHMuc2l6ZSA+IDApIHtcbiAgICAgICAgICBlbnRyeVBvaW50UGF0aHNbNF0gPSBBcnJheS5mcm9tKGUuZGVwSW5mby5kZWVwSW1wb3J0cyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVudHJ5UG9pbnRQYXRocztcbiAgICAgIH0pLFxuICAgIH07XG4gICAgdGhpcy5mcy53cml0ZUZpbGUodGhpcy5nZXRFbnRyeVBvaW50TWFuaWZlc3RQYXRoKGJhc2VQYXRoKSwgSlNPTi5zdHJpbmdpZnkobWFuaWZlc3QpKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RW50cnlQb2ludE1hbmlmZXN0UGF0aChiYXNlUGF0aDogQWJzb2x1dGVGc1BhdGgpIHtcbiAgICByZXR1cm4gdGhpcy5mcy5yZXNvbHZlKGJhc2VQYXRoLCAnX19uZ2NjX2VudHJ5X3BvaW50c19fLmpzb24nKTtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZUxvY2tGaWxlSGFzaChiYXNlUGF0aDogQWJzb2x1dGVGc1BhdGgpOiBzdHJpbmd8bnVsbCB7XG4gICAgY29uc3QgZGlyZWN0b3J5ID0gdGhpcy5mcy5kaXJuYW1lKGJhc2VQYXRoKTtcbiAgICBmb3IgKGNvbnN0IGxvY2tGaWxlTmFtZSBvZiBbJ3lhcm4ubG9jaycsICdwYWNrYWdlLWxvY2suanNvbiddKSB7XG4gICAgICBjb25zdCBsb2NrRmlsZVBhdGggPSB0aGlzLmZzLnJlc29sdmUoZGlyZWN0b3J5LCBsb2NrRmlsZU5hbWUpO1xuICAgICAgaWYgKHRoaXMuZnMuZXhpc3RzKGxvY2tGaWxlUGF0aCkpIHtcbiAgICAgICAgY29uc3QgbG9ja0ZpbGVDb250ZW50cyA9IHRoaXMuZnMucmVhZEZpbGUobG9ja0ZpbGVQYXRoKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUhhc2godGhpcy5jb25maWcuaGFzaEFsZ29yaXRobSkudXBkYXRlKGxvY2tGaWxlQ29udGVudHMpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgYEVudHJ5UG9pbnRNYW5pZmVzdGAgdGhhdCBjYW4gYmUgdXNlZCB0byBpbnZhbGlkYXRlIHRoZVxuICogY3VycmVudCBtYW5pZmVzdCBmaWxlLlxuICpcbiAqIEl0IGFsd2F5cyByZXR1cm5zIGBudWxsYCBmcm9tIHRoZSBgcmVhZEVudHJ5UG9pbnRzVXNpbmdNYW5pZmVzdCgpYCBtZXRob2QsIHdoaWNoIGZvcmNlcyBhIG5ld1xuICogbWFuaWZlc3QgdG8gYmUgY3JlYXRlZCwgd2hpY2ggd2lsbCBvdmVyd3JpdGUgdGhlIGN1cnJlbnQgZmlsZSB3aGVuIGB3cml0ZUVudHJ5UG9pbnRNYW5pZmVzdCgpYFxuICogaXMgY2FsbGVkLlxuICovXG5leHBvcnQgY2xhc3MgSW52YWxpZGF0aW5nRW50cnlQb2ludE1hbmlmZXN0IGV4dGVuZHMgRW50cnlQb2ludE1hbmlmZXN0IHtcbiAgcmVhZEVudHJ5UG9pbnRzVXNpbmdNYW5pZmVzdChfYmFzZVBhdGg6IEFic29sdXRlRnNQYXRoKTogRW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXNbXXxudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBFbnRyeVBvaW50UGF0aHMgPSBbXG4gIHN0cmluZyxcbiAgc3RyaW5nLFxuICBBcnJheTxBYnNvbHV0ZUZzUGF0aD4/LFxuICBBcnJheTxBYnNvbHV0ZUZzUGF0aHxQYXRoU2VnbWVudD4/LFxuICBBcnJheTxBYnNvbHV0ZUZzUGF0aD4/LFxuXTtcblxuLyoqXG4gKiBUaGUgSlNPTiBmb3JtYXQgb2YgdGhlIG1hbmlmZXN0IGZpbGUgdGhhdCBpcyB3cml0dGVuIHRvIGRpc2suXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW50cnlQb2ludE1hbmlmZXN0RmlsZSB7XG4gIG5nY2NWZXJzaW9uOiBzdHJpbmc7XG4gIGNvbmZpZ0ZpbGVIYXNoOiBzdHJpbmc7XG4gIGxvY2tGaWxlSGFzaDogc3RyaW5nO1xuICBlbnRyeVBvaW50UGF0aHM6IEVudHJ5UG9pbnRQYXRoc1tdO1xufVxuXG5cbi8qKiBUaGUgSlNPTiBmb3JtYXQgb2YgdGhlIGVudHJ5cG9pbnQgcHJvcGVydGllcy4gKi9cbmV4cG9ydCB0eXBlIE5ld0VudHJ5UG9pbnRQcm9wZXJ0aWVzTWFwID0ge1xuICBbUHJvcGVydHkgaW4gUGFja2FnZUpzb25Gb3JtYXRQcm9wZXJ0aWVzIGFzIGAke1Byb3BlcnR5fV9pdnlfbmdjY2BdPzogc3RyaW5nO1xufTtcbiJdfQ==