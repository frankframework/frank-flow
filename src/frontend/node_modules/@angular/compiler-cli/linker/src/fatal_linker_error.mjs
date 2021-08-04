/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * An unrecoverable error during linking.
 */
export class FatalLinkerError extends Error {
    /**
     * Create a new FatalLinkerError.
     *
     * @param node The AST node where the error occurred.
     * @param message A description of the error.
     */
    constructor(node, message) {
        super(message);
        this.node = node;
        this.type = 'FatalLinkerError';
    }
}
/**
 * Whether the given object `e` is a FatalLinkerError.
 */
export function isFatalLinkerError(e) {
    return e && e.type === 'FatalLinkerError';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmF0YWxfbGlua2VyX2Vycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL2xpbmtlci9zcmMvZmF0YWxfbGlua2VyX2Vycm9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGdCQUFpQixTQUFRLEtBQUs7SUFHekM7Ozs7O09BS0c7SUFDSCxZQUFtQixJQUFhLEVBQUUsT0FBZTtRQUMvQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFERSxTQUFJLEdBQUosSUFBSSxDQUFTO1FBUnZCLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztJQVVuQyxDQUFDO0NBQ0Y7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxDQUFNO0lBQ3ZDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssa0JBQWtCLENBQUM7QUFDNUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIEFuIHVucmVjb3ZlcmFibGUgZXJyb3IgZHVyaW5nIGxpbmtpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBGYXRhbExpbmtlckVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICByZWFkb25seSB0eXBlID0gJ0ZhdGFsTGlua2VyRXJyb3InO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgRmF0YWxMaW5rZXJFcnJvci5cbiAgICpcbiAgICogQHBhcmFtIG5vZGUgVGhlIEFTVCBub2RlIHdoZXJlIHRoZSBlcnJvciBvY2N1cnJlZC5cbiAgICogQHBhcmFtIG1lc3NhZ2UgQSBkZXNjcmlwdGlvbiBvZiB0aGUgZXJyb3IuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbm9kZTogdW5rbm93biwgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBXaGV0aGVyIHRoZSBnaXZlbiBvYmplY3QgYGVgIGlzIGEgRmF0YWxMaW5rZXJFcnJvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRmF0YWxMaW5rZXJFcnJvcihlOiBhbnkpOiBlIGlzIEZhdGFsTGlua2VyRXJyb3Ige1xuICByZXR1cm4gZSAmJiBlLnR5cGUgPT09ICdGYXRhbExpbmtlckVycm9yJztcbn1cbiJdfQ==