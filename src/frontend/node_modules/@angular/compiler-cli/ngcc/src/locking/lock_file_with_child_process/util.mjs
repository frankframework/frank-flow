/**
 * Remove the lock-file at the provided `lockFilePath` from the given file-system.
 *
 * It only removes the file if the pid stored in the file matches the provided `pid`.
 * The provided `pid` is of the process that is exiting and so no longer needs to hold the lock.
 */
export function removeLockFile(fs, logger, lockFilePath, pid) {
    try {
        logger.debug(`Attempting to remove lock-file at ${lockFilePath}.`);
        const lockFilePid = fs.readFile(lockFilePath);
        if (lockFilePid === pid) {
            logger.debug(`PIDs match (${pid}), so removing ${lockFilePath}.`);
            fs.removeFile(lockFilePath);
        }
        else {
            logger.debug(`PIDs do not match (${pid} and ${lockFilePid}), so not removing ${lockFilePath}.`);
        }
    }
    catch (e) {
        if (e.code === 'ENOENT') {
            logger.debug(`The lock-file at ${lockFilePath} was already removed.`);
            // File already removed so quietly exit
        }
        else {
            throw e;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9sb2NraW5nL2xvY2tfZmlsZV93aXRoX2NoaWxkX3Byb2Nlc3MvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFVQTs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQzFCLEVBQWMsRUFBRSxNQUFjLEVBQUUsWUFBNEIsRUFBRSxHQUFXO0lBQzNFLElBQUk7UUFDRixNQUFNLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ25FLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDOUMsSUFBSSxXQUFXLEtBQUssR0FBRyxFQUFFO1lBQ3ZCLE1BQU0sQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLGtCQUFrQixZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQ2xFLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDN0I7YUFBTTtZQUNMLE1BQU0sQ0FBQyxLQUFLLENBQ1Isc0JBQXNCLEdBQUcsUUFBUSxXQUFXLHNCQUFzQixZQUFZLEdBQUcsQ0FBQyxDQUFDO1NBQ3hGO0tBQ0Y7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDdkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsWUFBWSx1QkFBdUIsQ0FBQyxDQUFDO1lBQ3RFLHVDQUF1QztTQUN4QzthQUFNO1lBQ0wsTUFBTSxDQUFDLENBQUM7U0FDVDtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aCwgRmlsZVN5c3RlbX0gZnJvbSAnLi4vLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5cbi8qKlxuICogUmVtb3ZlIHRoZSBsb2NrLWZpbGUgYXQgdGhlIHByb3ZpZGVkIGBsb2NrRmlsZVBhdGhgIGZyb20gdGhlIGdpdmVuIGZpbGUtc3lzdGVtLlxuICpcbiAqIEl0IG9ubHkgcmVtb3ZlcyB0aGUgZmlsZSBpZiB0aGUgcGlkIHN0b3JlZCBpbiB0aGUgZmlsZSBtYXRjaGVzIHRoZSBwcm92aWRlZCBgcGlkYC5cbiAqIFRoZSBwcm92aWRlZCBgcGlkYCBpcyBvZiB0aGUgcHJvY2VzcyB0aGF0IGlzIGV4aXRpbmcgYW5kIHNvIG5vIGxvbmdlciBuZWVkcyB0byBob2xkIHRoZSBsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlTG9ja0ZpbGUoXG4gICAgZnM6IEZpbGVTeXN0ZW0sIGxvZ2dlcjogTG9nZ2VyLCBsb2NrRmlsZVBhdGg6IEFic29sdXRlRnNQYXRoLCBwaWQ6IHN0cmluZykge1xuICB0cnkge1xuICAgIGxvZ2dlci5kZWJ1ZyhgQXR0ZW1wdGluZyB0byByZW1vdmUgbG9jay1maWxlIGF0ICR7bG9ja0ZpbGVQYXRofS5gKTtcbiAgICBjb25zdCBsb2NrRmlsZVBpZCA9IGZzLnJlYWRGaWxlKGxvY2tGaWxlUGF0aCk7XG4gICAgaWYgKGxvY2tGaWxlUGlkID09PSBwaWQpIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgUElEcyBtYXRjaCAoJHtwaWR9KSwgc28gcmVtb3ZpbmcgJHtsb2NrRmlsZVBhdGh9LmApO1xuICAgICAgZnMucmVtb3ZlRmlsZShsb2NrRmlsZVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZGVidWcoXG4gICAgICAgICAgYFBJRHMgZG8gbm90IG1hdGNoICgke3BpZH0gYW5kICR7bG9ja0ZpbGVQaWR9KSwgc28gbm90IHJlbW92aW5nICR7bG9ja0ZpbGVQYXRofS5gKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZS5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgbG9nZ2VyLmRlYnVnKGBUaGUgbG9jay1maWxlIGF0ICR7bG9ja0ZpbGVQYXRofSB3YXMgYWxyZWFkeSByZW1vdmVkLmApO1xuICAgICAgLy8gRmlsZSBhbHJlYWR5IHJlbW92ZWQgc28gcXVpZXRseSBleGl0XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG4iXX0=