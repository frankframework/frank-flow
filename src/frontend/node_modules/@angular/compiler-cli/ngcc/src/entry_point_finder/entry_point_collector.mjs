import { getEntryPointInfo, IGNORED_ENTRY_POINT, INCOMPATIBLE_ENTRY_POINT, isEntryPoint, NO_ENTRY_POINT } from '../packages/entry_point';
import { NGCC_DIRECTORY } from '../writing/new_entry_point_file_writer';
/**
 * A class that traverses a file-tree, starting at a given path, looking for all entry-points,
 * also capturing the dependencies of each entry-point that is found.
 */
export class EntryPointCollector {
    constructor(fs, config, logger, resolver) {
        this.fs = fs;
        this.config = config;
        this.logger = logger;
        this.resolver = resolver;
    }
    /**
     * Look for Angular packages that need to be compiled, starting at the source directory.
     * The function will recurse into directories that start with `@...`, e.g. `@angular/...`.
     *
     * @param sourceDirectory An absolute path to the root directory where searching begins.
     * @returns an array of `EntryPoint`s that were found within `sourceDirectory`.
     */
    walkDirectoryForPackages(sourceDirectory) {
        // Try to get a primary entry point from this directory
        const primaryEntryPoint = getEntryPointInfo(this.fs, this.config, this.logger, sourceDirectory, sourceDirectory);
        // If there is an entry-point but it is not compatible with ngcc (it has a bad package.json or
        // invalid typings) then exit. It is unlikely that such an entry point has a dependency on an
        // Angular library.
        if (primaryEntryPoint === INCOMPATIBLE_ENTRY_POINT) {
            return [];
        }
        const entryPoints = [];
        if (primaryEntryPoint !== NO_ENTRY_POINT) {
            if (primaryEntryPoint !== IGNORED_ENTRY_POINT) {
                entryPoints.push(this.resolver.getEntryPointWithDependencies(primaryEntryPoint));
            }
            this.collectSecondaryEntryPoints(entryPoints, sourceDirectory, sourceDirectory, this.fs.readdir(sourceDirectory));
            // Also check for any nested node_modules in this package but only if at least one of the
            // entry-points was compiled by Angular.
            if (entryPoints.some(e => e.entryPoint.compiledByAngular)) {
                const nestedNodeModulesPath = this.fs.join(sourceDirectory, 'node_modules');
                if (this.fs.exists(nestedNodeModulesPath)) {
                    entryPoints.push(...this.walkDirectoryForPackages(nestedNodeModulesPath));
                }
            }
            return entryPoints;
        }
        // The `sourceDirectory` was not a package (i.e. there was no package.json)
        // So search its sub-directories for Angular packages and entry-points
        for (const path of this.fs.readdir(sourceDirectory)) {
            if (isIgnorablePath(path)) {
                // Ignore hidden files, node_modules and ngcc directory
                continue;
            }
            const absolutePath = this.fs.resolve(sourceDirectory, path);
            const stat = this.fs.lstat(absolutePath);
            if (stat.isSymbolicLink() || !stat.isDirectory()) {
                // Ignore symbolic links and non-directories
                continue;
            }
            entryPoints.push(...this.walkDirectoryForPackages(this.fs.join(sourceDirectory, path)));
        }
        return entryPoints;
    }
    /**
     * Search the `directory` looking for any secondary entry-points for a package, adding any that
     * are found to the `entryPoints` array.
     *
     * @param entryPoints An array where we will add any entry-points found in this directory.
     * @param packagePath The absolute path to the package that may contain entry-points.
     * @param directory The current directory being searched.
     * @param paths The paths contained in the current `directory`.
     */
    collectSecondaryEntryPoints(entryPoints, packagePath, directory, paths) {
        for (const path of paths) {
            if (isIgnorablePath(path)) {
                // Ignore hidden files, node_modules and ngcc directory
                continue;
            }
            const absolutePath = this.fs.resolve(directory, path);
            const stat = this.fs.lstat(absolutePath);
            if (stat.isSymbolicLink()) {
                // Ignore symbolic links
                continue;
            }
            const isDirectory = stat.isDirectory();
            if (!path.endsWith('.js') && !isDirectory) {
                // Ignore files that do not end in `.js`
                continue;
            }
            // If the path is a JS file then strip its extension and see if we can match an
            // entry-point (even if it is an ignored one).
            const possibleEntryPointPath = isDirectory ? absolutePath : stripJsExtension(absolutePath);
            const subEntryPoint = getEntryPointInfo(this.fs, this.config, this.logger, packagePath, possibleEntryPointPath);
            if (isEntryPoint(subEntryPoint)) {
                entryPoints.push(this.resolver.getEntryPointWithDependencies(subEntryPoint));
            }
            if (!isDirectory) {
                // This path is not a directory so we are done.
                continue;
            }
            // If not an entry-point itself, this directory may contain entry-points of its own.
            const canContainEntryPoints = subEntryPoint === NO_ENTRY_POINT || subEntryPoint === INCOMPATIBLE_ENTRY_POINT;
            const childPaths = this.fs.readdir(absolutePath);
            if (canContainEntryPoints &&
                childPaths.some(childPath => childPath.endsWith('.js') &&
                    this.fs.stat(this.fs.resolve(absolutePath, childPath)).isFile())) {
                // We do not consider non-entry-point directories that contain JS files as they are very
                // unlikely to be containers for sub-entry-points.
                continue;
            }
            this.collectSecondaryEntryPoints(entryPoints, packagePath, absolutePath, childPaths);
        }
    }
}
function stripJsExtension(filePath) {
    return filePath.replace(/\.js$/, '');
}
function isIgnorablePath(path) {
    return path.startsWith('.') || path === 'node_modules' || path === NGCC_DIRECTORY;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50cnlfcG9pbnRfY29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2VudHJ5X3BvaW50X2ZpbmRlci9lbnRyeV9wb2ludF9jb2xsZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBWUEsT0FBTyxFQUFDLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLHdCQUF3QixFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUN2SSxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sd0NBQXdDLENBQUM7QUFFdEU7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLG1CQUFtQjtJQUM5QixZQUNZLEVBQXNCLEVBQVUsTUFBeUIsRUFBVSxNQUFjLEVBQ2pGLFFBQTRCO1FBRDVCLE9BQUUsR0FBRixFQUFFLENBQW9CO1FBQVUsV0FBTSxHQUFOLE1BQU0sQ0FBbUI7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQ2pGLGFBQVEsR0FBUixRQUFRLENBQW9CO0lBQUcsQ0FBQztJQUU1Qzs7Ozs7O09BTUc7SUFDSCx3QkFBd0IsQ0FBQyxlQUErQjtRQUN0RCx1REFBdUQ7UUFDdkQsTUFBTSxpQkFBaUIsR0FDbkIsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTNGLDhGQUE4RjtRQUM5Riw2RkFBNkY7UUFDN0YsbUJBQW1CO1FBQ25CLElBQUksaUJBQWlCLEtBQUssd0JBQXdCLEVBQUU7WUFDbEQsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUVELE1BQU0sV0FBVyxHQUFpQyxFQUFFLENBQUM7UUFDckQsSUFBSSxpQkFBaUIsS0FBSyxjQUFjLEVBQUU7WUFDeEMsSUFBSSxpQkFBaUIsS0FBSyxtQkFBbUIsRUFB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QUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksS0FBSyxjQUFjLElBQUksSUFBSSxLQUFLLGNBQWMsQ0FBQztBQUNwRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0Fic29sdXRlRnNQYXRoLCBQYXRoU2VnbWVudCwgUmVhZG9ubHlGaWxlU3lzdGVtfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtMb2dnZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9sb2dnaW5nJztcbmltcG9ydCB7RW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXN9IGZyb20gJy4uL2RlcGVuZGVuY2llcy9kZXBlbmRlbmN5X2hvc3QnO1xuaW1wb3J0IHtEZXBlbmRlbmN5UmVzb2x2ZXJ9IGZyb20gJy4uL2RlcGVuZGVuY2llcy9kZXBlbmRlbmN5X3Jlc29sdmVyJztcbmltcG9ydCB7TmdjY0NvbmZpZ3VyYXRpb259IGZyb20gJy4uL3BhY2thZ2VzL2NvbmZpZ3VyYXRpb24nO1xuaW1wb3J0IHtnZXRFbnRyeVBvaW50SW5mbywgSUdOT1JFRF9FTlRSWV9QT0lOVCwgSU5DT01QQVRJQkxFX0VOVFJZX1BPSU5ULCBpc0VudHJ5UG9pbnQsIE5PX0VOVFJZX1BPSU5UfSBmcm9tICcuLi9wYWNrYWdlcy9lbnRyeV9wb2ludCc7XG5pbXBvcnQge05HQ0NfRElSRUNUT1JZfSBmcm9tICcuLi93cml0aW5nL25ld19lbnRyeV9wb2ludF9maWxlX3dyaXRlcic7XG5cbi8qKlxuICogQSBjbGFzcyB0aGF0IHRyYXZlcnNlcyBhIGZpbGUtdHJlZSwgc3RhcnRpbmcgYXQgYSBnaXZlbiBwYXRoLCBsb29raW5nIGZvciBhbGwgZW50cnktcG9pbnRzLFxuICogYWxzbyBjYXB0dXJpbmcgdGhlIGRlcGVuZGVuY2llcyBvZiBlYWNoIGVudHJ5LXBvaW50IHRoYXQgaXMgZm91bmQuXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRyeVBvaW50Q29sbGVjdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0sIHByaXZhdGUgY29uZmlnOiBOZ2NjQ29uZmlndXJhdGlvbiwgcHJpdmF0ZSBsb2dnZXI6IExvZ2dlcixcbiAgICAgIHByaXZhdGUgcmVzb2x2ZXI6IERlcGVuZGVuY3lSZXNvbHZlcikge31cblxuICAvKipcbiAgICogTG9vayBmb3IgQW5ndWxhciBwYWNrYWdlcyB0aGF0IG5lZWQgdG8gYmUgY29tcGlsZWQsIHN0YXJ0aW5nIGF0IHRoZSBzb3VyY2UgZGlyZWN0b3J5LlxuICAgKiBUaGUgZnVuY3Rpb24gd2lsbCByZWN1cnNlIGludG8gZGlyZWN0b3JpZXMgdGhhdCBzdGFydCB3aXRoIGBALi4uYCwgZS5nLiBgQGFuZ3VsYXIvLi4uYC5cbiAgICpcbiAgICogQHBhcmFtIHNvdXJjZURpcmVjdG9yeSBBbiBhYnNvbHV0ZSBwYXRoIHRvIHRoZSByb290IGRpcmVjdG9yeSB3aGVyZSBzZWFyY2hpbmcgYmVnaW5zLlxuICAgKiBAcmV0dXJucyBhbiBhcnJheSBvZiBgRW50cnlQb2ludGBzIHRoYXQgd2VyZSBmb3VuZCB3aXRoaW4gYHNvdXJjZURpcmVjdG9yeWAuXG4gICAqL1xuICB3YWxrRGlyZWN0b3J5Rm9yUGFja2FnZXMoc291cmNlRGlyZWN0b3J5OiBBYnNvbHV0ZUZzUGF0aCk6IEVudHJ5UG9pbnRXaXRoRGVwZW5kZW5jaWVzW10ge1xuICAgIC8vIFRyeSB0byBnZXQgYSBwcmltYXJ5IGVudHJ5IHBvaW50IGZyb20gdGhpcyBkaXJlY3RvcnlcbiAgICBjb25zdCBwcmltYXJ5RW50cnlQb2ludCA9XG4gICAgICAgIGdldEVudHJ5UG9pbnRJbmZvKHRoaXMuZnMsIHRoaXMuY29uZmlnLCB0aGlzLmxvZ2dlciwgc291cmNlRGlyZWN0b3J5LCBzb3VyY2VEaXJlY3RvcnkpO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgYW4gZW50cnktcG9pbnQgYnV0IGl0IGlzIG5vdCBjb21wYXRpYmxlIHdpdGggbmdjYyAoaXQgaGFzIGEgYmFkIHBhY2thZ2UuanNvbiBvclxuICAgIC8vIGludmFsaWQgdHlwaW5ncykgdGhlbiBleGl0LiBJdCBpcyB1bmxpa2VseSB0aGF0IHN1Y2ggYW4gZW50cnkgcG9pbnQgaGFzIGEgZGVwZW5kZW5jeSBvbiBhblxuICAgIC8vIEFuZ3VsYXIgbGlicmFyeS5cbiAgICBpZiAocHJpbWFyeUVudHJ5UG9pbnQgPT09IElOQ09NUEFUSUJMRV9FTlRSWV9QT0lOVCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IGVudHJ5UG9pbnRzOiBFbnRyeVBvaW50V2l0aERlcGVuZGVuY2llc1tdID0gW107XG4gICAgaWYgKHByaW1hcnlFbnRyeVBvaW50ICE9PSBOT19FTlRSWV9QT0lOVCkge1xuICAgICAgaWYgKHByaW1hcnlFbnRyeVBvaW50ICE9PSBJR05PUkVEX0VOVFJZX1BPSU5UKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzLnB1c2godGhpcy5yZXNvbHZlci5nZXRFbnRyeVBvaW50V2l0aERlcGVuZGVuY2llcyhwcmltYXJ5RW50cnlQb2ludCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5jb2xsZWN0U2Vjb25kYXJ5RW50cnlQb2ludHMoXG4gICAgICAgICAgZW50cnlQb2ludHMsIHNvdXJjZURpcmVjdG9yeSwgc291cmNlRGlyZWN0b3J5LCB0aGlzLmZzLnJlYWRkaXIoc291cmNlRGlyZWN0b3J5KSk7XG5cbiAgICAgIC8vIEFsc28gY2hlY2sgZm9yIGFueSBuZXN0ZWQgbm9kZV9tb2R1bGVzIGluIHRoaXMgcGFja2FnZSBidXQgb25seSBpZiBhdCBsZWFzdCBvbmUgb2YgdGhlXG4gICAgICAvLyBlbnRyeS1wb2ludHMgd2FzIGNvbXBpbGVkIGJ5IEFuZ3VsYXIuXG4gICAgICBpZiAoZW50cnlQb2ludHMuc29tZShlID0+IGUuZW50cnlQb2ludC5jb21waWxlZEJ5QW5ndWxhcikpIHtcbiAgICAgICAgY29uc3QgbmVzdGVkTm9kZU1vZHVsZXNQYXRoID0gdGhpcy5mcy5qb2luKHNvdXJjZURpcmVjdG9yeSwgJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICBpZiAodGhpcy5mcy5leGlzdHMobmVzdGVkTm9kZU1vZHVsZXNQYXRoKSkge1xuICAgICAgICAgIGVudHJ5UG9pbnRzLnB1c2goLi4udGhpcy53YWxrRGlyZWN0b3J5Rm9yUGFja2FnZXMobmVzdGVkTm9kZU1vZHVsZXNQYXRoKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGVudHJ5UG9pbnRzO1xuICAgIH1cblxuICAgIC8vIFRoZSBgc291cmNlRGlyZWN0b3J5YCB3YXMgbm90IGEgcGFja2FnZSAoaS5lLiB0aGVyZSB3YXMgbm8gcGFja2FnZS5qc29uKVxuICAgIC8vIFNvIHNlYXJjaCBpdHMgc3ViLWRpcmVjdG9yaWVzIGZvciBBbmd1bGFyIHBhY2thZ2VzIGFuZCBlbnRyeS1wb2ludHNcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgdGhpcy5mcy5yZWFkZGlyKHNvdXJjZURpcmVjdG9yeSkpIHtcbiAgICAgIGlmIChpc0lnbm9yYWJsZVBhdGgocGF0aCkpIHtcbiAgICAgICAgLy8gSWdub3JlIGhpZGRlbiBmaWxlcywgbm9kZV9tb2R1bGVzIGFuZCBuZ2NjIGRpcmVjdG9yeVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWJzb2x1dGVQYXRoID0gdGhpcy5mcy5yZXNvbHZlKHNvdXJjZURpcmVjdG9yeSwgcGF0aCk7XG4gICAgICBjb25zdCBzdGF0ID0gdGhpcy5mcy5sc3RhdChhYnNvbHV0ZVBhdGgpO1xuICAgICAgaWYgKHN0YXQuaXNTeW1ib2xpY0xpbmsoKSB8fCAhc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIC8vIElnbm9yZSBzeW1ib2xpYyBsaW5rcyBhbmQgbm9uLWRpcmVjdG9yaWVzXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbnRyeVBvaW50cy5wdXNoKC4uLnRoaXMud2Fsa0RpcmVjdG9yeUZvclBhY2thZ2VzKHRoaXMuZnMuam9pbihzb3VyY2VEaXJlY3RvcnksIHBhdGgpKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5UG9pbnRzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlYXJjaCB0aGUgYGRpcmVjdG9yeWAgbG9va2luZyBmb3IgYW55IHNlY29uZGFyeSBlbnRyeS1wb2ludHMgZm9yIGEgcGFja2FnZSwgYWRkaW5nIGFueSB0aGF0XG4gICAqIGFyZSBmb3VuZCB0byB0aGUgYGVudHJ5UG9pbnRzYCBhcnJheS5cbiAgICpcbiAgICogQHBhcmFtIGVudHJ5UG9pbnRzIEFuIGFycmF5IHdoZXJlIHdlIHdpbGwgYWRkIGFueSBlbnRyeS1wb2ludHMgZm91bmQgaW4gdGhpcyBkaXJlY3RvcnkuXG4gICAqIEBwYXJhbSBwYWNrYWdlUGF0aCBUaGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgcGFja2FnZSB0aGF0IG1heSBjb250YWluIGVudHJ5LXBvaW50cy5cbiAgICogQHBhcmFtIGRpcmVjdG9yeSBUaGUgY3VycmVudCBkaXJlY3RvcnkgYmVpbmcgc2VhcmNoZWQuXG4gICAqIEBwYXJhbSBwYXRocyBUaGUgcGF0aHMgY29udGFpbmVkIGluIHRoZSBjdXJyZW50IGBkaXJlY3RvcnlgLlxuICAgKi9cbiAgcHJpdmF0ZSBjb2xsZWN0U2Vjb25kYXJ5RW50cnlQb2ludHMoXG4gICAgICBlbnRyeVBvaW50czogRW50cnlQb2ludFdpdGhEZXBlbmRlbmNpZXNbXSwgcGFja2FnZVBhdGg6IEFic29sdXRlRnNQYXRoLFxuICAgICAgZGlyZWN0b3J5OiBBYnNvbHV0ZUZzUGF0aCwgcGF0aHM6IFBhdGhTZWdtZW50W10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcbiAgICAgIGlmIChpc0lnbm9yYWJsZVBhdGgocGF0aCkpIHtcbiAgICAgICAgLy8gSWdub3JlIGhpZGRlbiBmaWxlcywgbm9kZV9tb2R1bGVzIGFuZCBuZ2NjIGRpcmVjdG9yeVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWJzb2x1dGVQYXRoID0gdGhpcy5mcy5yZXNvbHZlKGRpcmVjdG9yeSwgcGF0aCk7XG4gICAgICBjb25zdCBzdGF0ID0gdGhpcy5mcy5sc3RhdChhYnNvbHV0ZVBhdGgpO1xuICAgICAgaWYgKHN0YXQuaXNTeW1ib2xpY0xpbmsoKSkge1xuICAgICAgICAvLyBJZ25vcmUgc3ltYm9saWMgbGlua3NcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRGlyZWN0b3J5ID0gc3RhdC5pc0RpcmVjdG9yeSgpO1xuICAgICAgaWYgKCFwYXRoLmVuZHNXaXRoKCcuanMnKSAmJiAhaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgLy8gSWdub3JlIGZpbGVzIHRoYXQgZG8gbm90IGVuZCBpbiBgLmpzYFxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIHBhdGggaXMgYSBKUyBmaWxlIHRoZW4gc3RyaXAgaXRzIGV4dGVuc2lvbiBhbmQgc2VlIGlmIHdlIGNhbiBtYXRjaCBhblxuICAgICAgLy8gZW50cnktcG9pbnQgKGV2ZW4gaWYgaXQgaXMgYW4gaWdub3JlZCBvbmUpLlxuICAgICAgY29uc3QgcG9zc2libGVFbnRyeVBvaW50UGF0aCA9IGlzRGlyZWN0b3J5ID8gYWJzb2x1dGVQYXRoIDogc3RyaXBKc0V4dGVuc2lvbihhYnNvbHV0ZVBhdGgpO1xuICAgICAgY29uc3Qgc3ViRW50cnlQb2ludCA9XG4gICAgICAgICAgZ2V0RW50cnlQb2ludEluZm8odGhpcy5mcywgdGhpcy5jb25maWcsIHRoaXMubG9nZ2VyLCBwYWNrYWdlUGF0aCwgcG9zc2libGVFbnRyeVBvaW50UGF0aCk7XG4gICAgICBpZiAoaXNFbnRyeVBvaW50KHN1YkVudHJ5UG9pbnQpKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzLnB1c2godGhpcy5yZXNvbHZlci5nZXRFbnRyeVBvaW50V2l0aERlcGVuZGVuY2llcyhzdWJFbnRyeVBvaW50KSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgLy8gVGhpcyBwYXRoIGlzIG5vdCBhIGRpcmVjdG9yeSBzbyB3ZSBhcmUgZG9uZS5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIG5vdCBhbiBlbnRyeS1wb2ludCBpdHNlbGYsIHRoaXMgZGlyZWN0b3J5IG1heSBjb250YWluIGVudHJ5LXBvaW50cyBvZiBpdHMgb3duLlxuICAgICAgY29uc3QgY2FuQ29udGFpbkVudHJ5UG9pbnRzID1cbiAgICAgICAgICBzdWJFbnRyeVBvaW50ID09PSBOT19FTlRSWV9QT0lOVCB8fCBzdWJFbnRyeVBvaW50ID09PSBJTkNPTVBBVElCTEVfRU5UUllfUE9JTlQ7XG4gICAgICBjb25zdCBjaGlsZFBhdGhzID0gdGhpcy5mcy5yZWFkZGlyKGFic29sdXRlUGF0aCk7XG4gICAgICBpZiAoY2FuQ29udGFpbkVudHJ5UG9pbnRzICYmXG4gICAgICAgICAgY2hpbGRQYXRocy5zb21lKFxuICAgICAgICAgICAgICBjaGlsZFBhdGggPT4gY2hpbGRQYXRoLmVuZHNXaXRoKCcuanMnKSAmJlxuICAgICAgICAgICAgICAgICAgdGhpcy5mcy5zdGF0KHRoaXMuZnMucmVzb2x2ZShhYnNvbHV0ZVBhdGgsIGNoaWxkUGF0aCkpLmlzRmlsZSgpKSkge1xuICAgICAgICAvLyBXZSBkbyBub3QgY29uc2lkZXIgbm9uLWVudHJ5LXBvaW50IGRpcmVjdG9yaWVzIHRoYXQgY29udGFpbiBKUyBmaWxlcyBhcyB0aGV5IGFyZSB2ZXJ5XG4gICAgICAgIC8vIHVubGlrZWx5IHRvIGJlIGNvbnRhaW5lcnMgZm9yIHN1Yi1lbnRyeS1wb2ludHMuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5jb2xsZWN0U2Vjb25kYXJ5RW50cnlQb2ludHMoZW50cnlQb2ludHMsIHBhY2thZ2VQYXRoLCBhYnNvbHV0ZVBhdGgsIGNoaWxkUGF0aHMpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpcEpzRXh0ZW5zaW9uPFQgZXh0ZW5kcyBzdHJpbmc+KGZpbGVQYXRoOiBUKTogVCB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKC9cXC5qcyQvLCAnJykgYXMgVDtcbn1cblxuZnVuY3Rpb24gaXNJZ25vcmFibGVQYXRoKHBhdGg6IFBhdGhTZWdtZW50KTogYm9vbGVhbiB7XG4gIHJldHVybiBwYXRoLnN0YXJ0c1dpdGgoJy4nKSB8fCBwYXRoID09PSAnbm9kZV9tb2R1bGVzJyB8fCBwYXRoID09PSBOR0NDX0RJUkVDVE9SWTtcbn1cbiJdfQ==