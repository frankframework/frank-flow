/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { extname, join } from '@angular-devkit/core';
const VALID_EXTENSIONS = ['.scss', '.sass', '.css', '.styl', '.less', '.ts'];
function* visitFiles(directory) {
    for (const path of directory.subfiles) {
        const extension = extname(path);
        if (VALID_EXTENSIONS.includes(extension)) {
            yield join(directory.path, path);
        }
    }
    for (const path of directory.subdirs) {
        if (path === 'node_modules' || path.startsWith('.') || path === 'dist') {
            continue;
        }
        yield* visitFiles(directory.dir(path));
    }
}
export default function () {
    return (tree) => {
        var _a;
        // Visit all files in an Angular workspace monorepo.
        for (const file of visitFiles(tree.root)) {
            const content = (_a = tree.read(file)) === null || _a === void 0 ? void 0 : _a.toString();
            if (content === null || content === void 0 ? void 0 : content.includes('/deep/ ')) {
                tree.overwrite(file, content.replace(/\/deep\/ /g, '::ng-deep '));
            }
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy9kZWVwLXNoYWRvdy1waWVyY2luZy1zZWxlY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLElBQUksRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBR25ELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBRTdFLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFtQjtJQUN0QyxLQUFLLE1BQU0sSUFBSSxJQUFJLFNBQVMsQ0FBQyxRQUFRLEVBQUU7UUFDckMsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLElBQUksZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ3hDLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDbEM7S0FDRjtJQUVELEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRTtRQUNwQyxJQUFJLElBQUksS0FBSyxjQUFjLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEtBQUssTUFBTSxFQUFFO1lBQ3RFLFNBQVM7U0FDVjtRQUVELEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDeEM7QUFDSCxDQUFDO0FBRUQsTUFBTSxDQUFDLE9BQU87SUFDWixPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUU7O1FBQ2Qsb0RBQW9EO1FBQ3BELEtBQUssTUFBTSxJQUFJLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN4QyxNQUFNLE9BQU8sR0FBRyxNQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDBDQUFFLFFBQVEsRUFBRSxDQUFDO1lBQzVDLElBQUksT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQzthQUNuRTtTQUNGO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2V4dG5hbWUsIGpvaW59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7RGlyRW50cnksIFJ1bGV9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcblxuY29uc3QgVkFMSURfRVhURU5TSU9OUyA9IFsnLnNjc3MnLCAnLnNhc3MnLCAnLmNzcycsICcuc3R5bCcsICcubGVzcycsICcudHMnXTtcblxuZnVuY3Rpb24qIHZpc2l0RmlsZXMoZGlyZWN0b3J5OiBEaXJFbnRyeSk6IEl0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPiB7XG4gIGZvciAoY29uc3QgcGF0aCBvZiBkaXJlY3Rvcnkuc3ViZmlsZXMpIHtcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHBhdGgpO1xuICAgIGlmIChWQUxJRF9FWFRFTlNJT05TLmluY2x1ZGVzKGV4dGVuc2lvbikpIHtcbiAgICAgIHlpZWxkIGpvaW4oZGlyZWN0b3J5LnBhdGgsIHBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgcGF0aCBvZiBkaXJlY3Rvcnkuc3ViZGlycykge1xuICAgIGlmIChwYXRoID09PSAnbm9kZV9tb2R1bGVzJyB8fCBwYXRoLnN0YXJ0c1dpdGgoJy4nKSB8fCBwYXRoID09PSAnZGlzdCcpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHlpZWxkKiB2aXNpdEZpbGVzKGRpcmVjdG9yeS5kaXIocGF0aCkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKCk6IFJ1bGUge1xuICByZXR1cm4gKHRyZWUpID0+IHtcbiAgICAvLyBWaXNpdCBhbGwgZmlsZXMgaW4gYW4gQW5ndWxhciB3b3Jrc3BhY2UgbW9ub3JlcG8uXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIHZpc2l0RmlsZXModHJlZS5yb290KSkge1xuICAgICAgY29uc3QgY29udGVudCA9IHRyZWUucmVhZChmaWxlKT8udG9TdHJpbmcoKTtcbiAgICAgIGlmIChjb250ZW50Py5pbmNsdWRlcygnL2RlZXAvICcpKSB7XG4gICAgICAgIHRyZWUub3ZlcndyaXRlKGZpbGUsIGNvbnRlbnQucmVwbGFjZSgvXFwvZGVlcFxcLyAvZywgJzo6bmctZGVlcCAnKSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuIl19