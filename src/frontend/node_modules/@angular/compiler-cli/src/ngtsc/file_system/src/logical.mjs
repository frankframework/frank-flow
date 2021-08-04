import { absoluteFrom, dirname, isLocalRelativePath, relative, resolve, toRelativeImport } from './helpers';
import { stripExtension } from './util';
export const LogicalProjectPath = {
    /**
     * Get the relative path between two `LogicalProjectPath`s.
     *
     * This will return a `PathSegment` which would be a valid module specifier to use in `from` when
     * importing from `to`.
     */
    relativePathBetween: function (from, to) {
        const relativePath = relative(dirname(resolve(from)), resolve(to));
        return toRelativeImport(relativePath);
    },
};
/**
 * A utility class which can translate absolute paths to source files into logical paths in
 * TypeScript's logical file system, based on the root directories of the project.
 */
export class LogicalFileSystem {
    constructor(rootDirs, compilerHost) {
        this.compilerHost = compilerHost;
        /**
         * A cache of file paths to project paths, because computation of these paths is slightly
         * expensive.
         */
        this.cache = new Map();
        // Make a copy and sort it by length in reverse order (longest first). This speeds up lookups,
        // since there's no need to keep going through the array once a match is found.
        this.rootDirs = rootDirs.concat([]).sort((a, b) => b.length - a.length);
        this.canonicalRootDirs =
            this.rootDirs.map(dir => this.compilerHost.getCanonicalFileName(dir));
    }
    /**
     * Get the logical path in the project of a `ts.SourceFile`.
     *
     * This method is provided as a convenient alternative to calling
     * `logicalPathOfFile(absoluteFromSourceFile(sf))`.
     */
    logicalPathOfSf(sf) {
        return this.logicalPathOfFile(absoluteFrom(sf.fileName));
    }
    /**
     * Get the logical path in the project of a source file.
     *
     * @returns A `LogicalProjectPath` to the source file, or `null` if the source file is not in any
     * of the TS project's root directories.
     */
    logicalPathOfFile(physicalFile) {
        const canonicalFilePath = this.compilerHost.getCanonicalFileName(physicalFile);
        if (!this.cache.has(canonicalFilePath)) {
            let logicalFile = null;
            for (let i = 0; i < this.rootDirs.length; i++) {
                const rootDir = this.rootDirs[i];
                const canonicalRootDir = this.canonicalRootDirs[i];
                if (isWithinBasePath(canonicalRootDir, canonicalFilePath)) {
                    // Note that we match against canonical paths but then create the logical path from
                    // original paths.
                    logicalFile = this.createLogicalProjectPath(physicalFile, rootDir);
                    // The logical project does not include any special "node_modules" nested directories.
                    if (logicalFile.indexOf('/node_modules/') !== -1) {
                        logicalFile = null;
                    }
                    else {
                        break;
                    }
                }
            }
            this.cache.set(canonicalFilePath, logicalFile);
        }
        return this.cache.get(canonicalFilePath);
    }
    createLogicalProjectPath(file, rootDir) {
        const logicalPath = stripExtension(file.substr(rootDir.length));
        return (logicalPath.startsWith('/') ? logicalPath : '/' + logicalPath);
    }
}
/**
 * Is the `path` a descendant of the `base`?
 * E.g. `foo/bar/zee` is within `foo/bar` but not within `foo/car`.
 */
function isWithinBasePath(base, path) {
    return isLocalRelativePath(relative(base, path));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9naWNhbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0vc3JjL2xvZ2ljYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUUxRyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBWXRDLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHO0lBQ2hDOzs7OztPQUtHO0lBQ0gsbUJBQW1CLEVBQUUsVUFBUyxJQUF3QixFQUFFLEVBQXNCO1FBQzVFLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbkUsT0FBTyxnQkFBZ0IsQ0FBQyxZQUFZLENBQWdCLENBQUM7SUFDdkQsQ0FBQztDQUNGLENBQUM7QUFFRjs7O0dBR0c7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBa0I1QixZQUNJLFFBQTBCLEVBQ2xCLFlBQTJEO1FBQTNELGlCQUFZLEdBQVosWUFBWSxDQUErQztRQVJ2RTs7O1dBR0c7UUFDSyxVQUFLLEdBQWlELElBQUksR0FBRyxFQUFFLENBQUM7UUFLdEUsOEZBQThGO1FBQzlGLCtFQUErRTtRQUMvRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLGlCQUFpQjtZQUNsQixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFtQixDQUFDLENBQUM7SUFDOUYsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsZUFBZSxDQUFDLEVBQWlCO1FBQy9CLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxpQkFBaUIsQ0FBQyxZQUE0QjtRQUM1QyxNQUFNLGlCQUFpQixHQUNuQixJQUFJLENBQUMsWUFBWSxDQUFDLG9CQUFvQixDQUFDLFlBQVksQ0FBbUIsQ0FBQztRQUMzRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsRUFBRTtZQUN0QyxJQUFJLFdBQVcsR0FBNEIsSUFBSSxDQUFDO1lBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDN0MsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDakMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELElBQUksZ0JBQWdCLENBQUMsZ0JBQWdCLEVBQUUsaUJBQWlCLENBQUMsRUFBRTtvQkFDekQsbUZBQW1GO29CQUNuRixrQkFBa0I7b0JBQ2xCLFdBQVcsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUNuRSxzRkFBc0Y7b0JBQ3RGLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO3dCQUNoRCxXQUFXLEdBQUcsSUFBSSxDQUFDO3FCQUNwQjt5QkFBTTt3QkFDTCxNQUFNO3FCQUNQO2lCQUNGO2FBQ0Y7WUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsQ0FBQztTQUNoRDtRQUNELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUUsQ0FBQztJQUM1QyxDQUFDO0lBRU8sd0JBQXdCLENBQUMsSUFBb0IsRUFBRSxPQUF1QjtRQUU1RSxNQUFNLFdBQVcsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNoRSxPQUFPLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsV0FBVyxDQUF1QixDQUFDO0lBQy9GLENBQUM7Q0FDRjtBQUVEOzs7R0FHRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsSUFBb0IsRUFBRSxJQUFvQjtJQUNsRSxPQUFPLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNuRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHthYnNvbHV0ZUZyb20sIGRpcm5hbWUsIGlzTG9jYWxSZWxhdGl2ZVBhdGgsIHJlbGF0aXZlLCByZXNvbHZlLCB0b1JlbGF0aXZlSW1wb3J0fSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aCwgQnJhbmRlZFBhdGgsIFBhdGhTZWdtZW50fSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7c3RyaXBFeHRlbnNpb259IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vKipcbiAqIEEgcGF0aCB0aGF0J3MgcmVsYXRpdmUgdG8gdGhlIGxvZ2ljYWwgcm9vdCBvZiBhIFR5cGVTY3JpcHQgcHJvamVjdCAob25lIG9mIHRoZSBwcm9qZWN0J3NcbiAqIHJvb3REaXJzKS5cbiAqXG4gKiBQYXRocyBpbiB0aGUgdHlwZSBzeXN0ZW0gdXNlIFBPU0lYIGZvcm1hdC5cbiAqL1xuZXhwb3J0IHR5cGUgTG9naWNhbFByb2plY3RQYXRoID0gQnJhbmRlZFBhdGg8J0xvZ2ljYWxQcm9qZWN0UGF0aCc+O1xuXG5leHBvcnQgY29uc3QgTG9naWNhbFByb2plY3RQYXRoID0ge1xuICAvKipcbiAgICogR2V0IHRoZSByZWxhdGl2ZSBwYXRoIGJldHdlZW4gdHdvIGBMb2dpY2FsUHJvamVjdFBhdGhgcy5cbiAgICpcbiAgICogVGhpcyB3aWxsIHJldHVybiBhIGBQYXRoU2VnbWVudGAgd2hpY2ggd291bGQgYmUgYSB2YWxpZCBtb2R1bGUgc3BlY2lmaWVyIHRvIHVzZSBpbiBgZnJvbWAgd2hlblxuICAgKiBpbXBvcnRpbmcgZnJvbSBgdG9gLlxuICAgKi9cbiAgcmVsYXRpdmVQYXRoQmV0d2VlbjogZnVuY3Rpb24oZnJvbTogTG9naWNhbFByb2plY3RQYXRoLCB0bzogTG9naWNhbFByb2plY3RQYXRoKTogUGF0aFNlZ21lbnQge1xuICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHJlbGF0aXZlKGRpcm5hbWUocmVzb2x2ZShmcm9tKSksIHJlc29sdmUodG8pKTtcbiAgICByZXR1cm4gdG9SZWxhdGl2ZUltcG9ydChyZWxhdGl2ZVBhdGgpIGFzIFBhdGhTZWdtZW50O1xuICB9LFxufTtcblxuLyoqXG4gKiBBIHV0aWxpdHkgY2xhc3Mgd2hpY2ggY2FuIHRyYW5zbGF0ZSBhYnNvbHV0ZSBwYXRocyB0byBzb3VyY2UgZmlsZXMgaW50byBsb2dpY2FsIHBhdGhzIGluXG4gKiBUeXBlU2NyaXB0J3MgbG9naWNhbCBmaWxlIHN5c3RlbSwgYmFzZWQgb24gdGhlIHJvb3QgZGlyZWN0b3JpZXMgb2YgdGhlIHByb2plY3QuXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2dpY2FsRmlsZVN5c3RlbSB7XG4gIC8qKlxuICAgKiBUaGUgcm9vdCBkaXJlY3RvcmllcyBvZiB0aGUgcHJvamVjdCwgc29ydGVkIHdpdGggdGhlIGxvbmdlc3QgcGF0aCBmaXJzdC5cbiAgICovXG4gIHByaXZhdGUgcm9vdERpcnM6IEFic29sdXRlRnNQYXRoW107XG5cbiAgLyoqXG4gICAqIFRoZSBzYW1lIHJvb3QgZGlyZWN0b3JpZXMgYXMgYHJvb3REaXJzYCBidXQgd2l0aCBlYWNoIG9uZSBjb252ZXJ0ZWQgdG8gaXRzXG4gICAqIGNhbm9uaWNhbCBmb3JtIGZvciBtYXRjaGluZyBpbiBjYXNlLWluc2Vuc2l0aXZlIGZpbGUtc3lzdGVtcy5cbiAgICovXG4gIHByaXZhdGUgY2Fub25pY2FsUm9vdERpcnM6IEFic29sdXRlRnNQYXRoW107XG5cbiAgLyoqXG4gICAqIEEgY2FjaGUgb2YgZmlsZSBwYXRocyB0byBwcm9qZWN0IHBhdGhzLCBiZWNhdXNlIGNvbXB1dGF0aW9uIG9mIHRoZXNlIHBhdGhzIGlzIHNsaWdodGx5XG4gICAqIGV4cGVuc2l2ZS5cbiAgICovXG4gIHByaXZhdGUgY2FjaGU6IE1hcDxBYnNvbHV0ZUZzUGF0aCwgTG9naWNhbFByb2plY3RQYXRofG51bGw+ID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcm9vdERpcnM6IEFic29sdXRlRnNQYXRoW10sXG4gICAgICBwcml2YXRlIGNvbXBpbGVySG9zdDogUGljazx0cy5Db21waWxlckhvc3QsICdnZXRDYW5vbmljYWxGaWxlTmFtZSc+KSB7XG4gICAgLy8gTWFrZSBhIGNvcHkgYW5kIHNvcnQgaXQgYnkgbGVuZ3RoIGluIHJldmVyc2Ugb3JkZXIgKGxvbmdlc3QgZmlyc3QpLiBUaGlzIHNwZWVkcyB1cCBsb29rdXBzLFxuICAgIC8vIHNpbmNlIHRoZXJlJ3Mgbm8gbmVlZCB0byBrZWVwIGdvaW5nIHRocm91Z2ggdGhlIGFycmF5IG9uY2UgYSBtYXRjaCBpcyBmb3VuZC5cbiAgICB0aGlzLnJvb3REaXJzID0gcm9vdERpcnMuY29uY2F0KFtdKS5zb3J0KChhLCBiKSA9PiBiLmxlbmd0aCAtIGEubGVuZ3RoKTtcbiAgICB0aGlzLmNhbm9uaWNhbFJvb3REaXJzID1cbiAgICAgICAgdGhpcy5yb290RGlycy5tYXAoZGlyID0+IHRoaXMuY29tcGlsZXJIb3N0LmdldENhbm9uaWNhbEZpbGVOYW1lKGRpcikgYXMgQWJzb2x1dGVGc1BhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbG9naWNhbCBwYXRoIGluIHRoZSBwcm9qZWN0IG9mIGEgYHRzLlNvdXJjZUZpbGVgLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBwcm92aWRlZCBhcyBhIGNvbnZlbmllbnQgYWx0ZXJuYXRpdmUgdG8gY2FsbGluZ1xuICAgKiBgbG9naWNhbFBhdGhPZkZpbGUoYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZikpYC5cbiAgICovXG4gIGxvZ2ljYWxQYXRoT2ZTZihzZjogdHMuU291cmNlRmlsZSk6IExvZ2ljYWxQcm9qZWN0UGF0aHxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5sb2dpY2FsUGF0aE9mRmlsZShhYnNvbHV0ZUZyb20oc2YuZmlsZU5hbWUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGxvZ2ljYWwgcGF0aCBpbiB0aGUgcHJvamVjdCBvZiBhIHNvdXJjZSBmaWxlLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGBMb2dpY2FsUHJvamVjdFBhdGhgIHRvIHRoZSBzb3VyY2UgZmlsZSwgb3IgYG51bGxgIGlmIHRoZSBzb3VyY2UgZmlsZSBpcyBub3QgaW4gYW55XG4gICAqIG9mIHRoZSBUUyBwcm9qZWN0J3Mgcm9vdCBkaXJlY3Rvcmllcy5cbiAgICovXG4gIGxvZ2ljYWxQYXRoT2ZGaWxlKHBoeXNpY2FsRmlsZTogQWJzb2x1dGVGc1BhdGgpOiBMb2dpY2FsUHJvamVjdFBhdGh8bnVsbCB7XG4gICAgY29uc3QgY2Fub25pY2FsRmlsZVBhdGggPVxuICAgICAgICB0aGlzLmNvbXBpbGVySG9zdC5nZXRDYW5vbmljYWxGaWxlTmFtZShwaHlzaWNhbEZpbGUpIGFzIEFic29sdXRlRnNQYXRoO1xuICAgIGlmICghdGhpcy5jYWNoZS5oYXMoY2Fub25pY2FsRmlsZVBhdGgpKSB7XG4gICAgICBsZXQgbG9naWNhbEZpbGU6IExvZ2ljYWxQcm9qZWN0UGF0aHxudWxsID0gbnVsbDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5yb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCByb290RGlyID0gdGhpcy5yb290RGlyc1tpXTtcbiAgICAgICAgY29uc3QgY2Fub25pY2FsUm9vdERpciA9IHRoaXMuY2Fub25pY2FsUm9vdERpcnNbaV07XG4gICAgICAgIGlmIChpc1dpdGhpbkJhc2VQYXRoKGNhbm9uaWNhbFJvb3REaXIsIGNhbm9uaWNhbEZpbGVQYXRoKSkge1xuICAgICAgICAgIC8vIE5vdGUgdGhhdCB3ZSBtYXRjaCBhZ2FpbnN0IGNhbm9uaWNhbCBwYXRocyBidXQgdGhlbiBjcmVhdGUgdGhlIGxvZ2ljYWwgcGF0aCBmcm9tXG4gICAgICAgICAgLy8gb3JpZ2luYWwgcGF0aHMuXG4gICAgICAgICAgbG9naWNhbEZpbGUgPSB0aGlzLmNyZWF0ZUxvZ2ljYWxQcm9qZWN0UGF0aChwaHlzaWNhbEZpbGUsIHJvb3REaXIpO1xuICAgICAgICAgIC8vIFRoZSBsb2dpY2FsIHByb2plY3QgZG9lcyBub3QgaW5jbHVkZSBhbnkgc3BlY2lhbCBcIm5vZGVfbW9kdWxlc1wiIG5lc3RlZCBkaXJlY3Rvcmllcy5cbiAgICAgICAgICBpZiAobG9naWNhbEZpbGUuaW5kZXhPZignL25vZGVfbW9kdWxlcy8nKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxvZ2ljYWxGaWxlID0gbnVsbDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmNhY2hlLnNldChjYW5vbmljYWxGaWxlUGF0aCwgbG9naWNhbEZpbGUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jYWNoZS5nZXQoY2Fub25pY2FsRmlsZVBhdGgpITtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTG9naWNhbFByb2plY3RQYXRoKGZpbGU6IEFic29sdXRlRnNQYXRoLCByb290RGlyOiBBYnNvbHV0ZUZzUGF0aCk6XG4gICAgICBMb2dpY2FsUHJvamVjdFBhdGgge1xuICAgIGNvbnN0IGxvZ2ljYWxQYXRoID0gc3RyaXBFeHRlbnNpb24oZmlsZS5zdWJzdHIocm9vdERpci5sZW5ndGgpKTtcbiAgICByZXR1cm4gKGxvZ2ljYWxQYXRoLnN0YXJ0c1dpdGgoJy8nKSA/IGxvZ2ljYWxQYXRoIDogJy8nICsgbG9naWNhbFBhdGgpIGFzIExvZ2ljYWxQcm9qZWN0UGF0aDtcbiAgfVxufVxuXG4vKipcbiAqIElzIHRoZSBgcGF0aGAgYSBkZXNjZW5kYW50IG9mIHRoZSBgYmFzZWA/XG4gKiBFLmcuIGBmb28vYmFyL3plZWAgaXMgd2l0aGluIGBmb28vYmFyYCBidXQgbm90IHdpdGhpbiBgZm9vL2NhcmAuXG4gKi9cbmZ1bmN0aW9uIGlzV2l0aGluQmFzZVBhdGgoYmFzZTogQWJzb2x1dGVGc1BhdGgsIHBhdGg6IEFic29sdXRlRnNQYXRoKTogYm9vbGVhbiB7XG4gIHJldHVybiBpc0xvY2FsUmVsYXRpdmVQYXRoKHJlbGF0aXZlKGJhc2UsIHBhdGgpKTtcbn1cbiJdfQ==