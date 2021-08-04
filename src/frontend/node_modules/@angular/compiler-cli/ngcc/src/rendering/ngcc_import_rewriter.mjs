/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { validateAndRewriteCoreSymbol } from '../../../src/ngtsc/imports';
export class NgccFlatImportRewriter {
    shouldImportSymbol(symbol, specifier) {
        if (specifier === '@angular/core') {
            // Don't use imports for @angular/core symbols in a flat bundle, as they'll be visible
            // directly.
            return false;
        }
        else {
            return true;
        }
    }
    rewriteSymbol(symbol, specifier) {
        if (specifier === '@angular/core') {
            return validateAndRewriteCoreSymbol(symbol);
        }
        else {
            return symbol;
        }
    }
    rewriteSpecifier(originalModulePath, inContextOfFile) {
        return originalModulePath;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdjY19pbXBvcnRfcmV3cml0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvcmVuZGVyaW5nL25nY2NfaW1wb3J0X3Jld3JpdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBaUIsNEJBQTRCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUV4RixNQUFNLE9BQU8sc0JBQXNCO0lBQ2pDLGtCQUFrQixDQUFDLE1BQWMsRUFBRSxTQUFpQjtRQUNsRCxJQUFJLFNBQVMsS0FBSyxlQUFlLEVBQUU7WUFDakMsc0ZBQXNGO1lBQ3RGLFlBQVk7WUFDWixPQUFPLEtBQUssQ0FBQztTQUNkO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQztTQUNiO0lBQ0gsQ0FBQztJQUVELGFBQWEsQ0FBQyxNQUFjLEVBQUUsU0FBaUI7UUFDN0MsSUFBSSxTQUFTLEtBQUssZUFBZSxFQUFFO1lBQ2pDLE9BQU8sNEJBQTRCLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDN0M7YUFBTTtZQUNMLE9BQU8sTUFBTSxDQUFDO1NBQ2Y7SUFDSCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsa0JBQTBCLEVBQUUsZUFBdUI7UUFDbEUsT0FBTyxrQkFBa0IsQ0FBQztJQUM1QixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJcbi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0ltcG9ydFJld3JpdGVyLCB2YWxpZGF0ZUFuZFJld3JpdGVDb3JlU3ltYm9sfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvaW1wb3J0cyc7XG5cbmV4cG9ydCBjbGFzcyBOZ2NjRmxhdEltcG9ydFJld3JpdGVyIGltcGxlbWVudHMgSW1wb3J0UmV3cml0ZXIge1xuICBzaG91bGRJbXBvcnRTeW1ib2woc3ltYm9sOiBzdHJpbmcsIHNwZWNpZmllcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKHNwZWNpZmllciA9PT0gJ0Bhbmd1bGFyL2NvcmUnKSB7XG4gICAgICAvLyBEb24ndCB1c2UgaW1wb3J0cyBmb3IgQGFuZ3VsYXIvY29yZSBzeW1ib2xzIGluIGEgZmxhdCBidW5kbGUsIGFzIHRoZXknbGwgYmUgdmlzaWJsZVxuICAgICAgLy8gZGlyZWN0bHkuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJld3JpdGVTeW1ib2woc3ltYm9sOiBzdHJpbmcsIHNwZWNpZmllcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoc3BlY2lmaWVyID09PSAnQGFuZ3VsYXIvY29yZScpIHtcbiAgICAgIHJldHVybiB2YWxpZGF0ZUFuZFJld3JpdGVDb3JlU3ltYm9sKHN5bWJvbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzeW1ib2w7XG4gICAgfVxuICB9XG5cbiAgcmV3cml0ZVNwZWNpZmllcihvcmlnaW5hbE1vZHVsZVBhdGg6IHN0cmluZywgaW5Db250ZXh0T2ZGaWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBvcmlnaW5hbE1vZHVsZVBhdGg7XG4gIH1cbn1cbiJdfQ==