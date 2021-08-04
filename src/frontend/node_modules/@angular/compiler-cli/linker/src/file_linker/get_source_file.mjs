/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Create a `GetSourceFileFn` that will return the `SourceFile` being linked or `null`, if not
 * available.
 */
export function createGetSourceFile(sourceUrl, code, loader) {
    if (loader === null) {
        // No source-mapping so just return a function that always returns `null`.
        return () => null;
    }
    else {
        // Source-mapping is available so return a function that will load (and cache) the `SourceFile`.
        let sourceFile = undefined;
        return () => {
            if (sourceFile === undefined) {
                sourceFile = loader.loadSourceFile(sourceUrl, code);
            }
            return sourceFile;
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0X3NvdXJjZV9maWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL2xpbmtlci9zcmMvZmlsZV9saW5rZXIvZ2V0X3NvdXJjZV9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQVVIOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FDL0IsU0FBeUIsRUFBRSxJQUFZLEVBQUUsTUFBNkI7SUFDeEUsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ25CLDBFQUEwRTtRQUMxRSxPQUFPLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztLQUNuQjtTQUFNO1FBQ0wsZ0dBQWdHO1FBQ2hHLElBQUksVUFBVSxHQUE4QixTQUFTLENBQUM7UUFDdEQsT0FBTyxHQUFHLEVBQUU7WUFDVixJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUU7Z0JBQzVCLFVBQVUsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNyRDtZQUNELE9BQU8sVUFBVSxDQUFDO1FBQ3BCLENBQUMsQ0FBQztLQUNIO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0Fic29sdXRlRnNQYXRofSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtTb3VyY2VGaWxlLCBTb3VyY2VGaWxlTG9hZGVyfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2Mvc291cmNlbWFwcyc7XG5cbi8qKlxuICogQSBmdW5jdGlvbiB0aGF0IHdpbGwgcmV0dXJuIGEgYFNvdXJjZUZpbGVgIG9iamVjdCAob3IgbnVsbCkgZm9yIHRoZSBjdXJyZW50IGZpbGUgYmVpbmcgbGlua2VkLlxuICovXG5leHBvcnQgdHlwZSBHZXRTb3VyY2VGaWxlRm4gPSAoKSA9PiBTb3VyY2VGaWxlfG51bGw7XG5cbi8qKlxuICogQ3JlYXRlIGEgYEdldFNvdXJjZUZpbGVGbmAgdGhhdCB3aWxsIHJldHVybiB0aGUgYFNvdXJjZUZpbGVgIGJlaW5nIGxpbmtlZCBvciBgbnVsbGAsIGlmIG5vdFxuICogYXZhaWxhYmxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2V0U291cmNlRmlsZShcbiAgICBzb3VyY2VVcmw6IEFic29sdXRlRnNQYXRoLCBjb2RlOiBzdHJpbmcsIGxvYWRlcjogU291cmNlRmlsZUxvYWRlcnxudWxsKTogR2V0U291cmNlRmlsZUZuIHtcbiAgaWYgKGxvYWRlciA9PT0gbnVsbCkge1xuICAgIC8vIE5vIHNvdXJjZS1tYXBwaW5nIHNvIGp1c3QgcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCBhbHdheXMgcmV0dXJucyBgbnVsbGAuXG4gICAgcmV0dXJuICgpID0+IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgLy8gU291cmNlLW1hcHBpbmcgaXMgYXZhaWxhYmxlIHNvIHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBsb2FkIChhbmQgY2FjaGUpIHRoZSBgU291cmNlRmlsZWAuXG4gICAgbGV0IHNvdXJjZUZpbGU6IFNvdXJjZUZpbGV8bnVsbHx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChzb3VyY2VGaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc291cmNlRmlsZSA9IGxvYWRlci5sb2FkU291cmNlRmlsZShzb3VyY2VVcmwsIGNvZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNvdXJjZUZpbGU7XG4gICAgfTtcbiAgfVxufVxuIl19