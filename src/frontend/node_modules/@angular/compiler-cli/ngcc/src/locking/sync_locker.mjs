/**
 * SyncLocker is used to prevent more than one instance of ngcc executing at the same time,
 * when being called in a synchronous context.
 *
 * * When ngcc starts executing, it creates a file in the `compiler-cli/ngcc` folder.
 * * If it finds one is already there then it fails with a suitable error message.
 * * When ngcc completes executing, it removes the file so that future ngcc executions can start.
 */
export class SyncLocker {
    constructor(lockFile) {
        this.lockFile = lockFile;
    }
    /**
     * Run the given function guarded by the lock file.
     *
     * @param fn the function to run.
     * @returns the value returned from the `fn` call.
     */
    lock(fn) {
        this.create();
        try {
            return fn();
        }
        finally {
            this.lockFile.remove();
        }
    }
    /**
     * Write a lock file to disk, or error if there is already one there.
     */
    create() {
        try {
            this.lockFile.write();
        }
        catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
            this.handleExistingLockFile();
        }
    }
    /**
     * The lock-file already exists so raise a helpful error.
     */
    handleExistingLockFile() {
        const pid = this.lockFile.read();
        throw new Error(`ngcc is already running at process with id ${pid}.\n` +
            `If you are running multiple builds in parallel then you might try pre-processing your node_modules via the command line ngcc tool before starting the builds.\n` +
            `(If you are sure no ngcc process is running then you should delete the lock-file at ${this.lockFile.path}.)`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3luY19sb2NrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvbG9ja2luZy9zeW5jX2xvY2tlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFTQTs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxPQUFPLFVBQVU7SUFDckIsWUFBb0IsUUFBa0I7UUFBbEIsYUFBUSxHQUFSLFFBQVEsQ0FBVTtJQUFHLENBQUM7SUFFMUM7Ozs7O09BS0c7SUFDSCxJQUFJLENBQUksRUFBVztRQUNqQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDZCxJQUFJO1lBQ0YsT0FBTyxFQUFFLEVBQUUsQ0FBQztTQUNiO2dCQUFTO1lBQ1IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztTQUN4QjtJQUNILENBQUM7SUFFRDs7T0FFRztJQUNPLE1BQU07UUFDZCxJQUFJO1lBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztTQUN2QjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDdkIsTUFBTSxDQUFDLENBQUM7YUFDVDtZQUNELElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1NBQy9CO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ08sc0JBQXNCO1FBQzlCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDakMsTUFBTSxJQUFJLEtBQUssQ0FDWCw4Q0FBOEMsR0FBRyxLQUFLO1lBQ3RELGlLQUFpSztZQUNqSyx1RkFDSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0xvY2tGaWxlfSBmcm9tICcuL2xvY2tfZmlsZSc7XG5cbi8qKlxuICogU3luY0xvY2tlciBpcyB1c2VkIHRvIHByZXZlbnQgbW9yZSB0aGFuIG9uZSBpbnN0YW5jZSBvZiBuZ2NjIGV4ZWN1dGluZyBhdCB0aGUgc2FtZSB0aW1lLFxuICogd2hlbiBiZWluZyBjYWxsZWQgaW4gYSBzeW5jaHJvbm91cyBjb250ZXh0LlxuICpcbiAqICogV2hlbiBuZ2NjIHN0YXJ0cyBleGVjdXRpbmcsIGl0IGNyZWF0ZXMgYSBmaWxlIGluIHRoZSBgY29tcGlsZXItY2xpL25nY2NgIGZvbGRlci5cbiAqICogSWYgaXQgZmluZHMgb25lIGlzIGFscmVhZHkgdGhlcmUgdGhlbiBpdCBmYWlscyB3aXRoIGEgc3VpdGFibGUgZXJyb3IgbWVzc2FnZS5cbiAqICogV2hlbiBuZ2NjIGNvbXBsZXRlcyBleGVjdXRpbmcsIGl0IHJlbW92ZXMgdGhlIGZpbGUgc28gdGhhdCBmdXR1cmUgbmdjYyBleGVjdXRpb25zIGNhbiBzdGFydC5cbiAqL1xuZXhwb3J0IGNsYXNzIFN5bmNMb2NrZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGxvY2tGaWxlOiBMb2NrRmlsZSkge31cblxuICAvKipcbiAgICogUnVuIHRoZSBnaXZlbiBmdW5jdGlvbiBndWFyZGVkIGJ5IHRoZSBsb2NrIGZpbGUuXG4gICAqXG4gICAqIEBwYXJhbSBmbiB0aGUgZnVuY3Rpb24gdG8gcnVuLlxuICAgKiBAcmV0dXJucyB0aGUgdmFsdWUgcmV0dXJuZWQgZnJvbSB0aGUgYGZuYCBjYWxsLlxuICAgKi9cbiAgbG9jazxUPihmbjogKCkgPT4gVCk6IFQge1xuICAgIHRoaXMuY3JlYXRlKCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmxvY2tGaWxlLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSBhIGxvY2sgZmlsZSB0byBkaXNrLCBvciBlcnJvciBpZiB0aGVyZSBpcyBhbHJlYWR5IG9uZSB0aGVyZS5cbiAgICovXG4gIHByb3RlY3RlZCBjcmVhdGUoKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMubG9ja0ZpbGUud3JpdGUoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5jb2RlICE9PSAnRUVYSVNUJykge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgICAgdGhpcy5oYW5kbGVFeGlzdGluZ0xvY2tGaWxlKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBsb2NrLWZpbGUgYWxyZWFkeSBleGlzdHMgc28gcmFpc2UgYSBoZWxwZnVsIGVycm9yLlxuICAgKi9cbiAgcHJvdGVjdGVkIGhhbmRsZUV4aXN0aW5nTG9ja0ZpbGUoKTogdm9pZCB7XG4gICAgY29uc3QgcGlkID0gdGhpcy5sb2NrRmlsZS5yZWFkKCk7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgbmdjYyBpcyBhbHJlYWR5IHJ1bm5pbmcgYXQgcHJvY2VzcyB3aXRoIGlkICR7cGlkfS5cXG5gICtcbiAgICAgICAgYElmIHlvdSBhcmUgcnVubmluZyBtdWx0aXBsZSBidWlsZHMgaW4gcGFyYWxsZWwgdGhlbiB5b3UgbWlnaHQgdHJ5IHByZS1wcm9jZXNzaW5nIHlvdXIgbm9kZV9tb2R1bGVzIHZpYSB0aGUgY29tbWFuZCBsaW5lIG5nY2MgdG9vbCBiZWZvcmUgc3RhcnRpbmcgdGhlIGJ1aWxkcy5cXG5gICtcbiAgICAgICAgYChJZiB5b3UgYXJlIHN1cmUgbm8gbmdjYyBwcm9jZXNzIGlzIHJ1bm5pbmcgdGhlbiB5b3Ugc2hvdWxkIGRlbGV0ZSB0aGUgbG9jay1maWxlIGF0ICR7XG4gICAgICAgICAgICB0aGlzLmxvY2tGaWxlLnBhdGh9LilgKTtcbiAgfVxufVxuIl19