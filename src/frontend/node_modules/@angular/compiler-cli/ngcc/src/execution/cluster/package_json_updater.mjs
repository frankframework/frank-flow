/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
import * as cluster from 'cluster';
import { applyChange, PackageJsonUpdate } from '../../writing/package_json_updater';
import { sendMessageToMaster } from './utils';
/**
 * A `PackageJsonUpdater` for cluster workers that will send update changes to the master process so
 * that it can safely handle update operations on multiple processes.
 */
export class ClusterWorkerPackageJsonUpdater {
    constructor() {
        if (cluster.isMaster) {
            throw new Error('Tried to create cluster worker PackageJsonUpdater on the master process.');
        }
    }
    createUpdate() {
        return new PackageJsonUpdate((...args) => this.writeChanges(...args));
    }
    /**
     * Apply the changes in-memory (if necessary) and send a message to the master process.
     */
    writeChanges(changes, packageJsonPath, preExistingParsedJson) {
        if (preExistingParsedJson) {
            for (const [propPath, value] of changes) {
                if (propPath.length === 0) {
                    throw new Error(`Missing property path for writing value to '${packageJsonPath}'.`);
                }
                // No need to take property positioning into account for in-memory representations.
                applyChange(preExistingParsedJson, propPath, value, 'unimportant');
            }
        }
        sendMessageToMaster({
            type: 'update-package-json',
            packageJsonPath,
            changes,
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZV9qc29uX3VwZGF0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvZXhlY3V0aW9uL2NsdXN0ZXIvcGFja2FnZV9qc29uX3VwZGF0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsOEJBQThCO0FBRTlCLE9BQU8sS0FBSyxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBSW5DLE9BQU8sRUFBQyxXQUFXLEVBQXFCLGlCQUFpQixFQUFxQixNQUFNLG9DQUFvQyxDQUFDO0FBRXpILE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUc1Qzs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sK0JBQStCO0lBQzFDO1FBQ0UsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO1lBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsMEVBQTBFLENBQUMsQ0FBQztTQUM3RjtJQUNILENBQUM7SUFFRCxZQUFZO1FBQ1YsT0FBTyxJQUFJLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFRDs7T0FFRztJQUNILFlBQVksQ0FDUixPQUE0QixFQUFFLGVBQStCLEVBQzdELHFCQUFrQztRQUNwQyxJQUFJLHFCQUFxQixFQUFFO1lBQ3pCLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSSxPQUFPLEVBQUU7Z0JBQ3ZDLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0NBQStDLGVBQWUsSUFBSSxDQUFDLENBQUM7aUJBQ3JGO2dCQUVELG1GQUFtRjtnQkFDbkYsV0FBVyxDQUFDLHFCQUFxQixFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLENBQUM7YUFDcEU7U0FDRjtRQUVELG1CQUFtQixDQUFDO1lBQ2xCLElBQUksRUFBRSxxQkFBcUI7WUFDM0IsZUFBZTtZQUNmLE9BQU87U0FDUixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIgLz5cblxuaW1wb3J0ICogYXMgY2x1c3RlciBmcm9tICdjbHVzdGVyJztcblxuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aH0gZnJvbSAnLi4vLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7SnNvbk9iamVjdH0gZnJvbSAnLi4vLi4vcGFja2FnZXMvZW50cnlfcG9pbnQnO1xuaW1wb3J0IHthcHBseUNoYW5nZSwgUGFja2FnZUpzb25DaGFuZ2UsIFBhY2thZ2VKc29uVXBkYXRlLCBQYWNrYWdlSnNvblVwZGF0ZXJ9IGZyb20gJy4uLy4uL3dyaXRpbmcvcGFja2FnZV9qc29uX3VwZGF0ZXInO1xuXG5pbXBvcnQge3NlbmRNZXNzYWdlVG9NYXN0ZXJ9IGZyb20gJy4vdXRpbHMnO1xuXG5cbi8qKlxuICogQSBgUGFja2FnZUpzb25VcGRhdGVyYCBmb3IgY2x1c3RlciB3b3JrZXJzIHRoYXQgd2lsbCBzZW5kIHVwZGF0ZSBjaGFuZ2VzIHRvIHRoZSBtYXN0ZXIgcHJvY2VzcyBzb1xuICogdGhhdCBpdCBjYW4gc2FmZWx5IGhhbmRsZSB1cGRhdGUgb3BlcmF0aW9ucyBvbiBtdWx0aXBsZSBwcm9jZXNzZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBDbHVzdGVyV29ya2VyUGFja2FnZUpzb25VcGRhdGVyIGltcGxlbWVudHMgUGFja2FnZUpzb25VcGRhdGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgaWYgKGNsdXN0ZXIuaXNNYXN0ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVHJpZWQgdG8gY3JlYXRlIGNsdXN0ZXIgd29ya2VyIFBhY2thZ2VKc29uVXBkYXRlciBvbiB0aGUgbWFzdGVyIHByb2Nlc3MuJyk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlVXBkYXRlKCk6IFBhY2thZ2VKc29uVXBkYXRlIHtcbiAgICByZXR1cm4gbmV3IFBhY2thZ2VKc29uVXBkYXRlKCguLi5hcmdzKSA9PiB0aGlzLndyaXRlQ2hhbmdlcyguLi5hcmdzKSk7XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgdGhlIGNoYW5nZXMgaW4tbWVtb3J5IChpZiBuZWNlc3NhcnkpIGFuZCBzZW5kIGEgbWVzc2FnZSB0byB0aGUgbWFzdGVyIHByb2Nlc3MuXG4gICAqL1xuICB3cml0ZUNoYW5nZXMoXG4gICAgICBjaGFuZ2VzOiBQYWNrYWdlSnNvbkNoYW5nZVtdLCBwYWNrYWdlSnNvblBhdGg6IEFic29sdXRlRnNQYXRoLFxuICAgICAgcHJlRXhpc3RpbmdQYXJzZWRKc29uPzogSnNvbk9iamVjdCk6IHZvaWQge1xuICAgIGlmIChwcmVFeGlzdGluZ1BhcnNlZEpzb24pIHtcbiAgICAgIGZvciAoY29uc3QgW3Byb3BQYXRoLCB2YWx1ZV0gb2YgY2hhbmdlcykge1xuICAgICAgICBpZiAocHJvcFBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIHByb3BlcnR5IHBhdGggZm9yIHdyaXRpbmcgdmFsdWUgdG8gJyR7cGFja2FnZUpzb25QYXRofScuYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBObyBuZWVkIHRvIHRha2UgcHJvcGVydHkgcG9zaXRpb25pbmcgaW50byBhY2NvdW50IGZvciBpbi1tZW1vcnkgcmVwcmVzZW50YXRpb25zLlxuICAgICAgICBhcHBseUNoYW5nZShwcmVFeGlzdGluZ1BhcnNlZEpzb24sIHByb3BQYXRoLCB2YWx1ZSwgJ3VuaW1wb3J0YW50Jyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VuZE1lc3NhZ2VUb01hc3Rlcih7XG4gICAgICB0eXBlOiAndXBkYXRlLXBhY2thZ2UtanNvbicsXG4gICAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgICBjaGFuZ2VzLFxuICAgIH0pO1xuICB9XG59XG4iXX0=