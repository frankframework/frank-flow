import { __awaiter } from "tslib";
import { NGCC_TIMED_OUT_EXIT_CODE } from '../constants';
class TimeoutError extends Error {
    constructor() {
        super(...arguments);
        this.code = NGCC_TIMED_OUT_EXIT_CODE;
    }
}
/**
 * AsyncLocker is used to prevent more than one instance of ngcc executing at the same time,
 * when being called in an asynchronous context.
 *
 * * When ngcc starts executing, it creates a file in the `compiler-cli/ngcc` folder.
 * * If it finds one is already there then it pauses and waits for the file to be removed by the
 *   other process. If the file is not removed within a set timeout period given by
 *   `retryDelay*retryAttempts` an error is thrown with a suitable error message.
 * * If the process locking the file changes, then we restart the timeout.
 * * When ngcc completes executing, it removes the file so that future ngcc executions can start.
 */
export class AsyncLocker {
    constructor(lockFile, logger, retryDelay, retryAttempts) {
        this.lockFile = lockFile;
        this.logger = logger;
        this.retryDelay = retryDelay;
        this.retryAttempts = retryAttempts;
    }
    /**
     * Run a function guarded by the lock file.
     *
     * @param fn The function to run.
     */
    lock(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.create();
            try {
                return yield fn();
            }
            finally {
                this.lockFile.remove();
            }
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            let pid = '';
            for (let attempts = 0; attempts < this.retryAttempts; attempts++) {
                try {
                    return this.lockFile.write();
                }
                catch (e) {
                    if (e.code !== 'EEXIST') {
                        throw e;
                    }
                    const newPid = this.lockFile.read();
                    if (newPid !== pid) {
                        // The process locking the file has changed, so restart the timeout
                        attempts = 0;
                        pid = newPid;
                    }
                    if (attempts === 0) {
                        this.logger.info(`Another process, with id ${pid}, is currently running ngcc.\n` +
                            `Waiting up to ${this.retryDelay * this.retryAttempts / 1000}s for it to finish.\n` +
                            `(If you are sure no ngcc process is running then you should delete the lock-file at ${this.lockFile.path}.)`);
                    }
                    // The file is still locked by another process so wait for a bit and retry
                    yield new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
            // If we fall out of the loop then we ran out of rety attempts
            throw new TimeoutError(`Timed out waiting ${this.retryAttempts * this.retryDelay /
                1000}s for another ngcc process, with id ${pid}, to complete.\n` +
                `(If you are sure no ngcc process is running then you should delete the lock-file at ${this.lockFile.path}.)`);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNfbG9ja2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2xvY2tpbmcvYXN5bmNfbG9ja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFRQSxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFJdEQsTUFBTSxZQUFhLFNBQVEsS0FBSztJQUFoQzs7UUFDRSxTQUFJLEdBQUcsd0JBQXdCLENBQUM7SUFDbEMsQ0FBQztDQUFBO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQU0sT0FBTyxXQUFXO0lBQ3RCLFlBQ1ksUUFBa0IsRUFBWSxNQUFjLEVBQVUsVUFBa0IsRUFDeEUsYUFBcUI7UUFEckIsYUFBUSxHQUFSLFFBQVEsQ0FBVTtRQUFZLFdBQU0sR0FBTixNQUFNLENBQVE7UUFBVSxlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQ3hFLGtCQUFhLEdBQWIsYUFBYSxDQUFRO0lBQUcsQ0FBQztJQUVyQzs7OztPQUlHO0lBQ0csSUFBSSxDQUFJLEVBQW9COztZQUNoQyxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNwQixJQUFJO2dCQUNGLE9BQU8sTUFBTSxFQUFFLEVBQUUsQ0FBQzthQUNuQjtvQkFBUztnQkFDUixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ3hCO1FBQ0gsQ0FBQztLQUFBO0lBRWUsTUFBTTs7WUFDcEIsSUFBSSxHQUFHLEdBQVcsRUFBRSxDQUFDO1lBQ3JCLEtBQUssSUFBSSxRQUFRLEdBQUcsQ0FBQyxFQUFFLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxFQUFFO2dCQUNoRSxJQUFJO29CQUNGLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztpQkFDOUI7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTt3QkFDdkIsTUFBTSxDQUFDLENBQUM7cUJBQ1Q7b0JBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxNQUFNLEtBQUssR0FBRyxFQUFFO3dCQUNsQixtRUFBbUU7d0JBQ25FLFFBQVEsR0FBRyxDQUFDLENBQUM7d0JBQ2IsR0FBRyxHQUFHLE1BQU0sQ0FBQztxQkFDZDtvQkFDRCxJQUFJLFFBQVEsS0FBSyxDQUFDLEVBQUU7d0JBQ2xCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNaLDRCQUE0QixHQUFHLGdDQUFnQzs0QkFDL0QsaUJBQWlCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLHVCQUF1Qjs0QkFDbkYsdUZBQ0ksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDO3FCQUNqQztvQkFDRCwwRUFBMEU7b0JBQzFFLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2lCQUNwRTthQUNGO1lBQ0QsOERBQThEO1lBQzlELE1BQU0sSUFBSSxZQUFZLENBQ2xCLHFCQUNJLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLFVBQVU7Z0JBQ3BDLElBQUksdUNBQXVDLEdBQUcsa0JBQWtCO2dCQUNwRSx1RkFDSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FBQztLQUFBO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge05HQ0NfVElNRURfT1VUX0VYSVRfQ09ERX0gZnJvbSAnLi4vY29uc3RhbnRzJztcblxuaW1wb3J0IHtMb2NrRmlsZX0gZnJvbSAnLi9sb2NrX2ZpbGUnO1xuXG5jbGFzcyBUaW1lb3V0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvZGUgPSBOR0NDX1RJTUVEX09VVF9FWElUX0NPREU7XG59XG5cbi8qKlxuICogQXN5bmNMb2NrZXIgaXMgdXNlZCB0byBwcmV2ZW50IG1vcmUgdGhhbiBvbmUgaW5zdGFuY2Ugb2YgbmdjYyBleGVjdXRpbmcgYXQgdGhlIHNhbWUgdGltZSxcbiAqIHdoZW4gYmVpbmcgY2FsbGVkIGluIGFuIGFzeW5jaHJvbm91cyBjb250ZXh0LlxuICpcbiAqICogV2hlbiBuZ2NjIHN0YXJ0cyBleGVjdXRpbmcsIGl0IGNyZWF0ZXMgYSBmaWxlIGluIHRoZSBgY29tcGlsZXItY2xpL25nY2NgIGZvbGRlci5cbiAqICogSWYgaXQgZmluZHMgb25lIGlzIGFscmVhZHkgdGhlcmUgdGhlbiBpdCBwYXVzZXMgYW5kIHdhaXRzIGZvciB0aGUgZmlsZSB0byBiZSByZW1vdmVkIGJ5IHRoZVxuICogICBvdGhlciBwcm9jZXNzLiBJZiB0aGUgZmlsZSBpcyBub3QgcmVtb3ZlZCB3aXRoaW4gYSBzZXQgdGltZW91dCBwZXJpb2QgZ2l2ZW4gYnlcbiAqICAgYHJldHJ5RGVsYXkqcmV0cnlBdHRlbXB0c2AgYW4gZXJyb3IgaXMgdGhyb3duIHdpdGggYSBzdWl0YWJsZSBlcnJvciBtZXNzYWdlLlxuICogKiBJZiB0aGUgcHJvY2VzcyBsb2NraW5nIHRoZSBmaWxlIGNoYW5nZXMsIHRoZW4gd2UgcmVzdGFydCB0aGUgdGltZW91dC5cbiAqICogV2hlbiBuZ2NjIGNvbXBsZXRlcyBleGVjdXRpbmcsIGl0IHJlbW92ZXMgdGhlIGZpbGUgc28gdGhhdCBmdXR1cmUgbmdjYyBleGVjdXRpb25zIGNhbiBzdGFydC5cbiAqL1xuZXhwb3J0IGNsYXNzIEFzeW5jTG9ja2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGxvY2tGaWxlOiBMb2NrRmlsZSwgcHJvdGVjdGVkIGxvZ2dlcjogTG9nZ2VyLCBwcml2YXRlIHJldHJ5RGVsYXk6IG51bWJlcixcbiAgICAgIHByaXZhdGUgcmV0cnlBdHRlbXB0czogbnVtYmVyKSB7fVxuXG4gIC8qKlxuICAgKiBSdW4gYSBmdW5jdGlvbiBndWFyZGVkIGJ5IHRoZSBsb2NrIGZpbGUuXG4gICAqXG4gICAqIEBwYXJhbSBmbiBUaGUgZnVuY3Rpb24gdG8gcnVuLlxuICAgKi9cbiAgYXN5bmMgbG9jazxUPihmbjogKCkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICAgIGF3YWl0IHRoaXMuY3JlYXRlKCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBmbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmxvY2tGaWxlLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBjcmVhdGUoKSB7XG4gICAgbGV0IHBpZDogc3RyaW5nID0gJyc7XG4gICAgZm9yIChsZXQgYXR0ZW1wdHMgPSAwOyBhdHRlbXB0cyA8IHRoaXMucmV0cnlBdHRlbXB0czsgYXR0ZW1wdHMrKykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9ja0ZpbGUud3JpdGUoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKGUuY29kZSAhPT0gJ0VFWElTVCcpIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5ld1BpZCA9IHRoaXMubG9ja0ZpbGUucmVhZCgpO1xuICAgICAgICBpZiAobmV3UGlkICE9PSBwaWQpIHtcbiAgICAgICAgICAvLyBUaGUgcHJvY2VzcyBsb2NraW5nIHRoZSBmaWxlIGhhcyBjaGFuZ2VkLCBzbyByZXN0YXJ0IHRoZSB0aW1lb3V0XG4gICAgICAgICAgYXR0ZW1wdHMgPSAwO1xuICAgICAgICAgIHBpZCA9IG5ld1BpZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXR0ZW1wdHMgPT09IDApIHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKFxuICAgICAgICAgICAgICBgQW5vdGhlciBwcm9jZXNzLCB3aXRoIGlkICR7cGlkfSwgaXMgY3VycmVudGx5IHJ1bm5pbmcgbmdjYy5cXG5gICtcbiAgICAgICAgICAgICAgYFdhaXRpbmcgdXAgdG8gJHt0aGlzLnJldHJ5RGVsYXkgKiB0aGlzLnJldHJ5QXR0ZW1wdHMgLyAxMDAwfXMgZm9yIGl0IHRvIGZpbmlzaC5cXG5gICtcbiAgICAgICAgICAgICAgYChJZiB5b3UgYXJlIHN1cmUgbm8gbmdjYyBwcm9jZXNzIGlzIHJ1bm5pbmcgdGhlbiB5b3Ugc2hvdWxkIGRlbGV0ZSB0aGUgbG9jay1maWxlIGF0ICR7XG4gICAgICAgICAgICAgICAgICB0aGlzLmxvY2tGaWxlLnBhdGh9LilgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGUgZmlsZSBpcyBzdGlsbCBsb2NrZWQgYnkgYW5vdGhlciBwcm9jZXNzIHNvIHdhaXQgZm9yIGEgYml0IGFuZCByZXRyeVxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy5yZXRyeURlbGF5KSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIElmIHdlIGZhbGwgb3V0IG9mIHRoZSBsb29wIHRoZW4gd2UgcmFuIG91dCBvZiByZXR5IGF0dGVtcHRzXG4gICAgdGhyb3cgbmV3IFRpbWVvdXRFcnJvcihcbiAgICAgICAgYFRpbWVkIG91dCB3YWl0aW5nICR7XG4gICAgICAgICAgICB0aGlzLnJldHJ5QXR0ZW1wdHMgKiB0aGlzLnJldHJ5RGVsYXkgL1xuICAgICAgICAgICAgMTAwMH1zIGZvciBhbm90aGVyIG5nY2MgcHJvY2Vzcywgd2l0aCBpZCAke3BpZH0sIHRvIGNvbXBsZXRlLlxcbmAgK1xuICAgICAgICBgKElmIHlvdSBhcmUgc3VyZSBubyBuZ2NjIHByb2Nlc3MgaXMgcnVubmluZyB0aGVuIHlvdSBzaG91bGQgZGVsZXRlIHRoZSBsb2NrLWZpbGUgYXQgJHtcbiAgICAgICAgICAgIHRoaXMubG9ja0ZpbGUucGF0aH0uKWApO1xuICB9XG59XG4iXX0=