import { needsCleaning } from '../../packages/build_marker';
import { BackupFileCleaner, NgccDirectoryCleaner, PackageJsonCleaner } from './cleaning_strategies';
import { isLocalDirectory } from './utils';
/**
 * A class that can clean ngcc artifacts from a directory.
 */
export class PackageCleaner {
    constructor(fs, cleaners) {
        this.fs = fs;
        this.cleaners = cleaners;
    }
    /**
     * Recurse through the file-system cleaning files and directories as determined by the configured
     * cleaning-strategies.
     *
     * @param directory the current directory to clean
     */
    clean(directory) {
        const basenames = this.fs.readdir(directory);
        for (const basename of basenames) {
            if (basename === 'node_modules') {
                continue;
            }
            const path = this.fs.resolve(directory, basename);
            for (const cleaner of this.cleaners) {
                if (cleaner.canClean(path, basename)) {
                    cleaner.clean(path, basename);
                    break;
                }
            }
            // Recurse into subdirectories (note that a cleaner may have removed this path)
            if (isLocalDirectory(this.fs, path)) {
                this.clean(path);
            }
        }
    }
}
/**
 * Iterate through the given `entryPoints` identifying the package for each that has at least one
 * outdated processed format, then cleaning those packages.
 *
 * Note that we have to clean entire packages because there is no clear file-system boundary
 * between entry-points within a package. So if one entry-point is outdated we have to clean
 * everything within that package.
 *
 * @param fileSystem the current file-system
 * @param entryPoints the entry-points that have been collected for this run of ngcc
 * @returns true if packages needed to be cleaned.
 */
export function cleanOutdatedPackages(fileSystem, entryPoints) {
    const packagesToClean = new Set();
    for (const entryPoint of entryPoints) {
        if (needsCleaning(entryPoint.packageJson)) {
            packagesToClean.add(entryPoint.packagePath);
        }
    }
    const cleaner = new PackageCleaner(fileSystem, [
        new PackageJsonCleaner(fileSystem),
        new NgccDirectoryCleaner(fileSystem),
        new BackupFileCleaner(fileSystem),
    ]);
    for (const packagePath of packagesToClean) {
        cleaner.clean(packagePath);
    }
    return packagesToClean.size > 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZV9jbGVhbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL3dyaXRpbmcvY2xlYW5pbmcvcGFja2FnZV9jbGVhbmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUcxRCxPQUFPLEVBQUMsaUJBQWlCLEVBQW9CLG9CQUFvQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDcEgsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRXpDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUFDekIsWUFBb0IsRUFBc0IsRUFBVSxRQUE0QjtRQUE1RCxPQUFFLEdBQUYsRUFBRSxDQUFvQjtRQUFVLGFBQVEsR0FBUixRQUFRLENBQW9CO0lBQUcsQ0FBQztJQUVwRjs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxTQUF5QjtRQUM3QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QyxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRTtZQUNoQyxJQUFJLFFBQVEsS0FBSyxjQUFjLEVBQUU7Z0JBQy9CLFNBQVM7YUFDVjtZQUVELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNsRCxLQUFLLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7Z0JBQ25DLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUU7b0JBQ3BDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUM5QixNQUFNO2lCQUNQO2FBQ0Y7WUFDRCwrRUFBK0U7WUFDL0UsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNuQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xCO1NBQ0Y7SUFDSCxDQUFDO0NBQ0Y7QUFHRDs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sVUFBVSxxQkFBcUIsQ0FBQyxVQUFzQixFQUFFLFdBQXlCO0lBQ3JGLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBQ2xELEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFO1FBQ3BDLElBQUksYUFBYSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUN6QyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUM3QztLQUNGO0lBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxjQUFjLENBQUMsVUFBVSxFQUFFO1FBQzdDLElBQUksa0JBQWtCLENBQUMsVUFBVSxDQUFDO1FBQ2xDLElBQUksb0JBQW9CLENBQUMsVUFBVSxDQUFDO1FBQ3BDLElBQUksaUJBQWlCLENBQUMsVUFBVSxDQUFDO0tBQ2xDLENBQUMsQ0FBQztJQUNILEtBQUssTUFBTSxXQUFXLElBQUksZUFBZSxFQUFFO1FBQ3pDLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDNUI7SUFFRCxPQUFPLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7QWJzb2x1dGVGc1BhdGgsIEZpbGVTeXN0ZW0sIFJlYWRvbmx5RmlsZVN5c3RlbX0gZnJvbSAnLi4vLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7bmVlZHNDbGVhbmluZ30gZnJvbSAnLi4vLi4vcGFja2FnZXMvYnVpbGRfbWFya2VyJztcbmltcG9ydCB7RW50cnlQb2ludH0gZnJvbSAnLi4vLi4vcGFja2FnZXMvZW50cnlfcG9pbnQnO1xuXG5pbXBvcnQge0JhY2t1cEZpbGVDbGVhbmVyLCBDbGVhbmluZ1N0cmF0ZWd5LCBOZ2NjRGlyZWN0b3J5Q2xlYW5lciwgUGFja2FnZUpzb25DbGVhbmVyfSBmcm9tICcuL2NsZWFuaW5nX3N0cmF0ZWdpZXMnO1xuaW1wb3J0IHtpc0xvY2FsRGlyZWN0b3J5fSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBBIGNsYXNzIHRoYXQgY2FuIGNsZWFuIG5nY2MgYXJ0aWZhY3RzIGZyb20gYSBkaXJlY3RvcnkuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYWNrYWdlQ2xlYW5lciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZnM6IFJlYWRvbmx5RmlsZVN5c3RlbSwgcHJpdmF0ZSBjbGVhbmVyczogQ2xlYW5pbmdTdHJhdGVneVtdKSB7fVxuXG4gIC8qKlxuICAgKiBSZWN1cnNlIHRocm91Z2ggdGhlIGZpbGUtc3lzdGVtIGNsZWFuaW5nIGZpbGVzIGFuZCBkaXJlY3RvcmllcyBhcyBkZXRlcm1pbmVkIGJ5IHRoZSBjb25maWd1cmVkXG4gICAqIGNsZWFuaW5nLXN0cmF0ZWdpZXMuXG4gICAqXG4gICAqIEBwYXJhbSBkaXJlY3RvcnkgdGhlIGN1cnJlbnQgZGlyZWN0b3J5IHRvIGNsZWFuXG4gICAqL1xuICBjbGVhbihkaXJlY3Rvcnk6IEFic29sdXRlRnNQYXRoKSB7XG4gICAgY29uc3QgYmFzZW5hbWVzID0gdGhpcy5mcy5yZWFkZGlyKGRpcmVjdG9yeSk7XG4gICAgZm9yIChjb25zdCBiYXNlbmFtZSBvZiBiYXNlbmFtZXMpIHtcbiAgICAgIGlmIChiYXNlbmFtZSA9PT0gJ25vZGVfbW9kdWxlcycpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhdGggPSB0aGlzLmZzLnJlc29sdmUoZGlyZWN0b3J5LCBiYXNlbmFtZSk7XG4gICAgICBmb3IgKGNvbnN0IGNsZWFuZXIgb2YgdGhpcy5jbGVhbmVycykge1xuICAgICAgICBpZiAoY2xlYW5lci5jYW5DbGVhbihwYXRoLCBiYXNlbmFtZSkpIHtcbiAgICAgICAgICBjbGVhbmVyLmNsZWFuKHBhdGgsIGJhc2VuYW1lKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gUmVjdXJzZSBpbnRvIHN1YmRpcmVjdG9yaWVzIChub3RlIHRoYXQgYSBjbGVhbmVyIG1heSBoYXZlIHJlbW92ZWQgdGhpcyBwYXRoKVxuICAgICAgaWYgKGlzTG9jYWxEaXJlY3RvcnkodGhpcy5mcywgcGF0aCkpIHtcbiAgICAgICAgdGhpcy5jbGVhbihwYXRoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuXG4vKipcbiAqIEl0ZXJhdGUgdGhyb3VnaCB0aGUgZ2l2ZW4gYGVudHJ5UG9pbnRzYCBpZGVudGlmeWluZyB0aGUgcGFja2FnZSBmb3IgZWFjaCB0aGF0IGhhcyBhdCBsZWFzdCBvbmVcbiAqIG91dGRhdGVkIHByb2Nlc3NlZCBmb3JtYXQsIHRoZW4gY2xlYW5pbmcgdGhvc2UgcGFja2FnZXMuXG4gKlxuICogTm90ZSB0aGF0IHdlIGhhdmUgdG8gY2xlYW4gZW50aXJlIHBhY2thZ2VzIGJlY2F1c2UgdGhlcmUgaXMgbm8gY2xlYXIgZmlsZS1zeXN0ZW0gYm91bmRhcnlcbiAqIGJldHdlZW4gZW50cnktcG9pbnRzIHdpdGhpbiBhIHBhY2thZ2UuIFNvIGlmIG9uZSBlbnRyeS1wb2ludCBpcyBvdXRkYXRlZCB3ZSBoYXZlIHRvIGNsZWFuXG4gKiBldmVyeXRoaW5nIHdpdGhpbiB0aGF0IHBhY2thZ2UuXG4gKlxuICogQHBhcmFtIGZpbGVTeXN0ZW0gdGhlIGN1cnJlbnQgZmlsZS1zeXN0ZW1cbiAqIEBwYXJhbSBlbnRyeVBvaW50cyB0aGUgZW50cnktcG9pbnRzIHRoYXQgaGF2ZSBiZWVuIGNvbGxlY3RlZCBmb3IgdGhpcyBydW4gb2YgbmdjY1xuICogQHJldHVybnMgdHJ1ZSBpZiBwYWNrYWdlcyBuZWVkZWQgdG8gYmUgY2xlYW5lZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsZWFuT3V0ZGF0ZWRQYWNrYWdlcyhmaWxlU3lzdGVtOiBGaWxlU3lzdGVtLCBlbnRyeVBvaW50czogRW50cnlQb2ludFtdKTogYm9vbGVhbiB7XG4gIGNvbnN0IHBhY2thZ2VzVG9DbGVhbiA9IG5ldyBTZXQ8QWJzb2x1dGVGc1BhdGg+KCk7XG4gIGZvciAoY29uc3QgZW50cnlQb2ludCBvZiBlbnRyeVBvaW50cykge1xuICAgIGlmIChuZWVkc0NsZWFuaW5nKGVudHJ5UG9pbnQucGFja2FnZUpzb24pKSB7XG4gICAgICBwYWNrYWdlc1RvQ2xlYW4uYWRkKGVudHJ5UG9pbnQucGFja2FnZVBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGNsZWFuZXIgPSBuZXcgUGFja2FnZUNsZWFuZXIoZmlsZVN5c3RlbSwgW1xuICAgIG5ldyBQYWNrYWdlSnNvbkNsZWFuZXIoZmlsZVN5c3RlbSksXG4gICAgbmV3IE5nY2NEaXJlY3RvcnlDbGVhbmVyKGZpbGVTeXN0ZW0pLFxuICAgIG5ldyBCYWNrdXBGaWxlQ2xlYW5lcihmaWxlU3lzdGVtKSxcbiAgXSk7XG4gIGZvciAoY29uc3QgcGFja2FnZVBhdGggb2YgcGFja2FnZXNUb0NsZWFuKSB7XG4gICAgY2xlYW5lci5jbGVhbihwYWNrYWdlUGF0aCk7XG4gIH1cblxuICByZXR1cm4gcGFja2FnZXNUb0NsZWFuLnNpemUgPiAwO1xufVxuIl19