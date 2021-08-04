/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { absoluteFrom, dirname } from '../../../src/ngtsc/file_system';
export const NGCC_BACKUP_EXTENSION = '.__ivy_ngcc_bak';
/**
 * This FileWriter overwrites the transformed file, in-place, while creating
 * a back-up of the original file with an extra `.__ivy_ngcc_bak` extension.
 */
export class InPlaceFileWriter {
    constructor(fs, logger, errorOnFailedEntryPoint) {
        this.fs = fs;
        this.logger = logger;
        this.errorOnFailedEntryPoint = errorOnFailedEntryPoint;
    }
    writeBundle(_bundle, transformedFiles, _formatProperties) {
        transformedFiles.forEach(file => this.writeFileAndBackup(file));
    }
    revertBundle(_entryPoint, transformedFilePaths, _formatProperties) {
        for (const filePath of transformedFilePaths) {
            this.revertFileAndBackup(filePath);
        }
    }
    writeFileAndBackup(file) {
        this.fs.ensureDir(dirname(file.path));
        const backPath = absoluteFrom(`${file.path}${NGCC_BACKUP_EXTENSION}`);
        if (this.fs.exists(backPath)) {
            if (this.errorOnFailedEntryPoint) {
                throw new Error(`Tried to overwrite ${backPath} with an ngcc back up file, which is disallowed.`);
            }
            else {
                this.logger.error(`Tried to write ${backPath} with an ngcc back up file but it already exists so not writing, nor backing up, ${file.path}.\n` +
                    `This error may be caused by one of the following:\n` +
                    `* two or more entry-points overlap and ngcc has been asked to process some files more than once.\n` +
                    `  In this case, you should check other entry-points in this package\n` +
                    `  and set up a config to ignore any that you are not using.\n` +
                    `* a previous run of ngcc was killed in the middle of processing, in a way that cannot be recovered.\n` +
                    `  In this case, you should try cleaning the node_modules directory and any dist directories that contain local libraries. Then try again.`);
            }
        }
        else {
            if (this.fs.exists(file.path)) {
                this.fs.moveFile(file.path, backPath);
            }
            this.fs.writeFile(file.path, file.contents);
        }
    }
    revertFileAndBackup(filePath) {
        if (this.fs.exists(filePath)) {
            this.fs.removeFile(filePath);
            const backPath = absoluteFrom(`${filePath}${NGCC_BACKUP_EXTENSION}`);
            if (this.fs.exists(backPath)) {
                this.fs.moveFile(backPath, filePath);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5fcGxhY2VfZmlsZV93cml0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvd3JpdGluZy9pbl9wbGFjZV9maWxlX3dyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQUMsWUFBWSxFQUFrQixPQUFPLEVBQWEsTUFBTSxnQ0FBZ0MsQ0FBQztBQVFqRyxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxpQkFBaUIsQ0FBQztBQUN2RDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBQzVCLFlBQ2MsRUFBYyxFQUFZLE1BQWMsRUFDeEMsdUJBQWdDO1FBRGhDLE9BQUUsR0FBRixFQUFFLENBQVk7UUFBWSxXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQ3hDLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBUztJQUFHLENBQUM7SUFFbEQsV0FBVyxDQUNQLE9BQXlCLEVBQUUsZ0JBQStCLEVBQzFELGlCQUE0QztRQUM5QyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsWUFBWSxDQUNSLFdBQXVCLEVBQUUsb0JBQXNDLEVBQy9ELGlCQUEyQztRQUM3QyxLQUFLLE1BQU0sUUFBUSxJQUFJLG9CQUFvQixFQUFFO1lBQzNDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNwQztJQUNILENBQUM7SUFFUyxrQkFBa0IsQ0FBQyxJQUFpQjtRQUM1QyxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdEMsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7UUFDdEUsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUM1QixJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtnQkFDaEMsTUFBTSxJQUFJLEtBQUssQ0FDWCxzQkFBc0IsUUFBUSxrREFBa0QsQ0FBQyxDQUFDO2FBQ3ZGO2lCQUFNO2dCQUNMLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUNiLGtCQUNJLFFBQVEsb0ZBQ1IsSUFBSSxDQUFDLElBQUksS0FBSztvQkFDbEIscURBQXFEO29CQUNyRCxvR0FBb0c7b0JBQ3BHLHVFQUF1RTtvQkFDdkUsK0RBQStEO29CQUMvRCx1R0FBdUc7b0JBQ3ZHLDJJQUEySSxDQUFDLENBQUM7YUFDbEo7U0FDRjthQUFNO1lBQ0wsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzdCLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7YUFDdkM7WUFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUM3QztJQUNILENBQUM7SUFFUyxtQkFBbUIsQ0FBQyxRQUF3QjtRQUNwRCxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzVCLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRTdCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxHQUFHLFFBQVEsR0FBRyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7WUFDckUsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ3RDO1NBQ0Y7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7YWJzb2x1dGVGcm9tLCBBYnNvbHV0ZUZzUGF0aCwgZGlybmFtZSwgRmlsZVN5c3RlbX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge0VudHJ5UG9pbnQsIEVudHJ5UG9pbnRKc29uUHJvcGVydHl9IGZyb20gJy4uL3BhY2thZ2VzL2VudHJ5X3BvaW50JztcbmltcG9ydCB7RW50cnlQb2ludEJ1bmRsZX0gZnJvbSAnLi4vcGFja2FnZXMvZW50cnlfcG9pbnRfYnVuZGxlJztcbmltcG9ydCB7RmlsZVRvV3JpdGV9IGZyb20gJy4uL3JlbmRlcmluZy91dGlscyc7XG5cbmltcG9ydCB7RmlsZVdyaXRlcn0gZnJvbSAnLi9maWxlX3dyaXRlcic7XG5cbmV4cG9ydCBjb25zdCBOR0NDX0JBQ0tVUF9FWFRFTlNJT04gPSAnLl9faXZ5X25nY2NfYmFrJztcbi8qKlxuICogVGhpcyBGaWxlV3JpdGVyIG92ZXJ3cml0ZXMgdGhlIHRyYW5zZm9ybWVkIGZpbGUsIGluLXBsYWNlLCB3aGlsZSBjcmVhdGluZ1xuICogYSBiYWNrLXVwIG9mIHRoZSBvcmlnaW5hbCBmaWxlIHdpdGggYW4gZXh0cmEgYC5fX2l2eV9uZ2NjX2Jha2AgZXh0ZW5zaW9uLlxuICovXG5leHBvcnQgY2xhc3MgSW5QbGFjZUZpbGVXcml0ZXIgaW1wbGVtZW50cyBGaWxlV3JpdGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcm90ZWN0ZWQgZnM6IEZpbGVTeXN0ZW0sIHByb3RlY3RlZCBsb2dnZXI6IExvZ2dlcixcbiAgICAgIHByb3RlY3RlZCBlcnJvck9uRmFpbGVkRW50cnlQb2ludDogYm9vbGVhbikge31cblxuICB3cml0ZUJ1bmRsZShcbiAgICAgIF9idW5kbGU6IEVudHJ5UG9pbnRCdW5kbGUsIHRyYW5zZm9ybWVkRmlsZXM6IEZpbGVUb1dyaXRlW10sXG4gICAgICBfZm9ybWF0UHJvcGVydGllcz86IEVudHJ5UG9pbnRKc29uUHJvcGVydHlbXSkge1xuICAgIHRyYW5zZm9ybWVkRmlsZXMuZm9yRWFjaChmaWxlID0+IHRoaXMud3JpdGVGaWxlQW5kQmFja3VwKGZpbGUpKTtcbiAgfVxuXG4gIHJldmVydEJ1bmRsZShcbiAgICAgIF9lbnRyeVBvaW50OiBFbnRyeVBvaW50LCB0cmFuc2Zvcm1lZEZpbGVQYXRoczogQWJzb2x1dGVGc1BhdGhbXSxcbiAgICAgIF9mb3JtYXRQcm9wZXJ0aWVzOiBFbnRyeVBvaW50SnNvblByb3BlcnR5W10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIHRyYW5zZm9ybWVkRmlsZVBhdGhzKSB7XG4gICAgICB0aGlzLnJldmVydEZpbGVBbmRCYWNrdXAoZmlsZVBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCB3cml0ZUZpbGVBbmRCYWNrdXAoZmlsZTogRmlsZVRvV3JpdGUpOiB2b2lkIHtcbiAgICB0aGlzLmZzLmVuc3VyZURpcihkaXJuYW1lKGZpbGUucGF0aCkpO1xuICAgIGNvbnN0IGJhY2tQYXRoID0gYWJzb2x1dGVGcm9tKGAke2ZpbGUucGF0aH0ke05HQ0NfQkFDS1VQX0VYVEVOU0lPTn1gKTtcbiAgICBpZiAodGhpcy5mcy5leGlzdHMoYmFja1BhdGgpKSB7XG4gICAgICBpZiAodGhpcy5lcnJvck9uRmFpbGVkRW50cnlQb2ludCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgVHJpZWQgdG8gb3ZlcndyaXRlICR7YmFja1BhdGh9IHdpdGggYW4gbmdjYyBiYWNrIHVwIGZpbGUsIHdoaWNoIGlzIGRpc2FsbG93ZWQuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcihcbiAgICAgICAgICAgIGBUcmllZCB0byB3cml0ZSAke1xuICAgICAgICAgICAgICAgIGJhY2tQYXRofSB3aXRoIGFuIG5nY2MgYmFjayB1cCBmaWxlIGJ1dCBpdCBhbHJlYWR5IGV4aXN0cyBzbyBub3Qgd3JpdGluZywgbm9yIGJhY2tpbmcgdXAsICR7XG4gICAgICAgICAgICAgICAgZmlsZS5wYXRofS5cXG5gICtcbiAgICAgICAgICAgIGBUaGlzIGVycm9yIG1heSBiZSBjYXVzZWQgYnkgb25lIG9mIHRoZSBmb2xsb3dpbmc6XFxuYCArXG4gICAgICAgICAgICBgKiB0d28gb3IgbW9yZSBlbnRyeS1wb2ludHMgb3ZlcmxhcCBhbmQgbmdjYyBoYXMgYmVlbiBhc2tlZCB0byBwcm9jZXNzIHNvbWUgZmlsZXMgbW9yZSB0aGFuIG9uY2UuXFxuYCArXG4gICAgICAgICAgICBgICBJbiB0aGlzIGNhc2UsIHlvdSBzaG91bGQgY2hlY2sgb3RoZXIgZW50cnktcG9pbnRzIGluIHRoaXMgcGFja2FnZVxcbmAgK1xuICAgICAgICAgICAgYCAgYW5kIHNldCB1cCBhIGNvbmZpZyB0byBpZ25vcmUgYW55IHRoYXQgeW91IGFyZSBub3QgdXNpbmcuXFxuYCArXG4gICAgICAgICAgICBgKiBhIHByZXZpb3VzIHJ1biBvZiBuZ2NjIHdhcyBraWxsZWQgaW4gdGhlIG1pZGRsZSBvZiBwcm9jZXNzaW5nLCBpbiBhIHdheSB0aGF0IGNhbm5vdCBiZSByZWNvdmVyZWQuXFxuYCArXG4gICAgICAgICAgICBgICBJbiB0aGlzIGNhc2UsIHlvdSBzaG91bGQgdHJ5IGNsZWFuaW5nIHRoZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5IGFuZCBhbnkgZGlzdCBkaXJlY3RvcmllcyB0aGF0IGNvbnRhaW4gbG9jYWwgbGlicmFyaWVzLiBUaGVuIHRyeSBhZ2Fpbi5gKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMuZnMuZXhpc3RzKGZpbGUucGF0aCkpIHtcbiAgICAgICAgdGhpcy5mcy5tb3ZlRmlsZShmaWxlLnBhdGgsIGJhY2tQYXRoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnMud3JpdGVGaWxlKGZpbGUucGF0aCwgZmlsZS5jb250ZW50cyk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHJldmVydEZpbGVBbmRCYWNrdXAoZmlsZVBhdGg6IEFic29sdXRlRnNQYXRoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZnMuZXhpc3RzKGZpbGVQYXRoKSkge1xuICAgICAgdGhpcy5mcy5yZW1vdmVGaWxlKGZpbGVQYXRoKTtcblxuICAgICAgY29uc3QgYmFja1BhdGggPSBhYnNvbHV0ZUZyb20oYCR7ZmlsZVBhdGh9JHtOR0NDX0JBQ0tVUF9FWFRFTlNJT059YCk7XG4gICAgICBpZiAodGhpcy5mcy5leGlzdHMoYmFja1BhdGgpKSB7XG4gICAgICAgIHRoaXMuZnMubW92ZUZpbGUoYmFja1BhdGgsIGZpbGVQYXRoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==