/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { hasNameIdentifier } from '../utils';
/**
 * Consider the following ES5 code that may have been generated for a class:
 *
 * ```
 * var A = (function(){
 *   function A() {}
 *   return A;
 * }());
 * A.staticProp = true;
 * ```
 *
 * Here, TypeScript marks the symbol for "A" as a so-called "expando symbol", which causes
 * "staticProp" to be added as an export of the "A" symbol.
 *
 * In the example above, symbol "A" has been assigned some flags to indicate that it represents a
 * class. Due to this flag, the symbol is considered an expando symbol and as such, "staticProp" is
 * stored in `ts.Symbol.exports`.
 *
 * A problem arises when "A" is not at the top-level, i.e. in UMD bundles. In that case, the symbol
 * does not have the flag that marks the symbol as a class. Therefore, TypeScript inspects "A"'s
 * initializer expression, which is an IIFE in the above example. Unfortunately however, only IIFEs
 * of the form `(function(){})()` qualify as initializer for an "expando symbol"; the slightly
 * different form seen in the example above, `(function(){}())`, does not. This prevents the "A"
 * symbol from being considered an expando symbol, in turn preventing "staticProp" from being stored
 * in `ts.Symbol.exports`.
 *
 * The logic for identifying symbols as "expando symbols" can be found here:
 * https://github.com/microsoft/TypeScript/blob/v3.4.5/src/compiler/binder.ts#L2656-L2685
 *
 * Notice how the `getExpandoInitializer` function is available on the "ts" namespace in the
 * compiled bundle, so we are able to override this function to accommodate for the alternative
 * IIFE notation. The original implementation can be found at:
 * https://github.com/Microsoft/TypeScript/blob/v3.4.5/src/compiler/utilities.ts#L1864-L1887
 *
 * Issue tracked in https://github.com/microsoft/TypeScript/issues/31778
 *
 * @returns the function to pass to `restoreGetExpandoInitializer` to undo the patch, or null if
 * the issue is known to have been fixed.
 */
export function patchTsGetExpandoInitializer() {
    if (isTs31778GetExpandoInitializerFixed()) {
        return null;
    }
    const originalGetExpandoInitializer = ts.getExpandoInitializer;
    if (originalGetExpandoInitializer === undefined) {
        throw makeUnsupportedTypeScriptError();
    }
    // Override the function to add support for recognizing the IIFE structure used in ES5 bundles.
    ts.getExpandoInitializer = (initializer, isPrototypeAssignment) => {
        // If the initializer is a call expression within parenthesis, unwrap the parenthesis
        // upfront such that unsupported IIFE syntax `(function(){}())` becomes `function(){}()`,
        // which is supported.
        if (ts.isParenthesizedExpression(initializer) && ts.isCallExpression(initializer.expression)) {
            initializer = initializer.expression;
        }
        return originalGetExpandoInitializer(initializer, isPrototypeAssignment);
    };
    return originalGetExpandoInitializer;
}
export function restoreGetExpandoInitializer(originalGetExpandoInitializer) {
    if (originalGetExpandoInitializer !== null) {
        ts.getExpandoInitializer = originalGetExpandoInitializer;
    }
}
let ts31778FixedResult = null;
function isTs31778GetExpandoInitializerFixed() {
    // If the result has already been computed, return early.
    if (ts31778FixedResult !== null) {
        return ts31778FixedResult;
    }
    // Determine if the issue has been fixed by checking if an expando property is present in a
    // minimum reproduction using unpatched TypeScript.
    ts31778FixedResult = checkIfExpandoPropertyIsPresent();
    // If the issue does not appear to have been fixed, verify that applying the patch has the desired
    // effect.
    if (!ts31778FixedResult) {
        const originalGetExpandoInitializer = patchTsGetExpandoInitializer();
        try {
            const patchIsSuccessful = checkIfExpandoPropertyIsPresent();
            if (!patchIsSuccessful) {
                throw makeUnsupportedTypeScriptError();
            }
        }
        finally {
            restoreGetExpandoInitializer(originalGetExpandoInitializer);
        }
    }
    return ts31778FixedResult;
}
/**
 * Verifies whether TS issue 31778 has been fixed by inspecting a symbol from a minimum
 * reproduction. If the symbol does in fact have the "expando" as export, the issue has been fixed.
 *
 * See https://github.com/microsoft/TypeScript/issues/31778 for details.
 */
function checkIfExpandoPropertyIsPresent() {
    const sourceText = `
    (function() {
      var A = (function() {
        function A() {}
        return A;
      }());
      A.expando = true;
    }());`;
    const sourceFile = ts.createSourceFile('test.js', sourceText, ts.ScriptTarget.ES5, true, ts.ScriptKind.JS);
    const host = {
        getSourceFile() {
            return sourceFile;
        },
        fileExists() {
            return true;
        },
        readFile() {
            return '';
        },
        writeFile() { },
        getDefaultLibFileName() {
            return '';
        },
        getCurrentDirectory() {
            return '';
        },
        getDirectories() {
            return [];
        },
        getCanonicalFileName(fileName) {
            return fileName;
        },
        useCaseSensitiveFileNames() {
            return true;
        },
        getNewLine() {
            return '\n';
        },
    };
    const options = { noResolve: true, noLib: true, noEmit: true, allowJs: true };
    const program = ts.createProgram(['test.js'], options, host);
    function visitor(node) {
        if (ts.isVariableDeclaration(node) && hasNameIdentifier(node) && node.name.text === 'A') {
            return node;
        }
        return ts.forEachChild(node, visitor);
    }
    const declaration = ts.forEachChild(sourceFile, visitor);
    if (declaration === undefined) {
        throw new Error('Unable to find declaration of outer A');
    }
    const symbol = program.getTypeChecker().getSymbolAtLocation(declaration.name);
    if (symbol === undefined) {
        throw new Error('Unable to resolve symbol of outer A');
    }
    return symbol.exports !== undefined && symbol.exports.has('expando');
}
function makeUnsupportedTypeScriptError() {
    return new Error('The TypeScript version used is not supported by ngcc.');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0Y2hfdHNfZXhwYW5kb19pbml0aWFsaXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9wYWNrYWdlcy9wYXRjaF90c19leHBhbmRvX2luaXRpYWxpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2pDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUUzQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQ0c7QUFDSCxNQUFNLFVBQVUsNEJBQTRCO0lBQzFDLElBQUksbUNBQW1DLEVBQUUsRUFBRTtRQUN6QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsTUFBTSw2QkFBNkIsR0FBSSxFQUFVLENBQUMscUJBQXFCLENBQUM7SUFDeEUsSUFBSSw2QkFBNkIsS0FBSyxTQUFTLEVBQUU7UUFDL0MsTUFBTSw4QkFBOEIsRUFBRSxDQUFDO0tBQ3hDO0lBRUQsK0ZBQStGO0lBQzlGLEVBQVUsQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLFdBQW9CLEVBQ3BCLHFCQUE4QixFQUEyQixFQUFFO1FBQzlGLHFGQUFxRjtRQUNyRix5RkFBeUY7UUFDekYsc0JBQXNCO1FBQ3RCLElBQUksRUFBRSxDQUFDLHlCQUF5QixDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDNUYsV0FBVyxHQUFHLFdBQVcsQ0FBQyxVQUFVLENBQUM7U0FDdEM7UUFDRCxPQUFPLDZCQUE2QixDQUFDLFdBQVcsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQzNFLENBQUMsQ0FBQztJQUNGLE9BQU8sNkJBQTZCLENBQUM7QUFDdkMsQ0FBQztBQUVELE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyw2QkFBc0M7SUFDakYsSUFBSSw2QkFBNkIsS0FBSyxJQUFJLEVBQUU7UUFDekMsRUFBVSxDQUFDLHFCQUFxQixHQUFHLDZCQUE2QixDQUFDO0tBQ25FO0FBQ0gsQ0FBQztBQUVELElBQUksa0JBQWtCLEdBQWlCLElBQUksQ0FBQztBQUU1QyxTQUFTLG1DQUFtQztJQUMxQyx5REFBeUQ7SUFDekQsSUFBSSxrQkFBa0IsS0FBSyxJQUFJLEVBQUU7UUFDL0IsT0FBTyxrQkFBa0IsQ0FBQztLQUMzQjtJQUVELDJGQUEyRjtJQUMzRixtREFBbUQ7SUFDbkQsa0JBQWtCLEdBQUcsK0JBQStCLEVBQUUsQ0FBQztJQUV2RCxrR0FBa0c7SUFDbEcsVUFBVTtJQUNWLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtRQUN2QixNQUFNLDZCQUE2QixHQUFHLDRCQUE0QixFQUFFLENBQUM7UUFDckUsSUFBSTtZQUNGLE1BQU0saUJBQWlCLEdBQUcsK0JBQStCLEVBQUUsQ0FBQztZQUM1RCxJQUFJLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ3RCLE1BQU0sOEJBQThCLEVBQUUsQ0FBQzthQUN4QztTQUNGO2dCQUFTO1lBQ1IsNEJBQTRCLENBQUMsNkJBQTZCLENBQUMsQ0FBQztTQUM3RDtLQUNGO0lBRUQsT0FBTyxrQkFBa0IsQ0FBQztBQUM1QixDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLCtCQUErQjtJQUN0QyxNQUFNLFVBQVUsR0FBRzs7Ozs7OztVQU9YLENBQUM7SUFDVCxNQUFNLFVBQVUsR0FDWixFQUFFLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM1RixNQUFNLElBQUksR0FBb0I7UUFDNUIsYUFBYTtZQUVQLE9BQU8sVUFBVSxDQUFDO1FBQ3BCLENBQUM7UUFDTCxVQUFVO1lBQ1IsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsUUFBUTtZQUVGLE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUNMLFNBQVMsS0FBSSxDQUFDO1FBQ2QscUJBQXFCO1lBQ25CLE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUNELG1CQUFtQjtZQUNqQixPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUM7UUFDRCxjQUFjO1lBQ1osT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDO1FBQ0Qsb0JBQW9CLENBQUMsUUFBZ0I7WUFDbkMsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUNELHlCQUF5QjtZQUN2QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxVQUFVO1lBQ1IsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO0tBQ0YsQ0FBQztJQUNGLE1BQU0sT0FBTyxHQUFHLEVBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDO0lBQzVFLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFN0QsU0FBUyxPQUFPLENBQUMsSUFBYTtRQUM1QixJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxHQUFHLEVBQUU7WUFDdkYsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3pELElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtRQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlFLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtRQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7S0FDeEQ7SUFDRCxPQUFPLE1BQU0sQ0FBQyxPQUFPLEtBQUssU0FBUyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQXdCLENBQUMsQ0FBQztBQUN0RixDQUFDO0FBRUQsU0FBUyw4QkFBOEI7SUFDckMsT0FBTyxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0FBQzVFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtoYXNOYW1lSWRlbnRpZmllcn0gZnJvbSAnLi4vdXRpbHMnO1xuXG4vKipcbiAqIENvbnNpZGVyIHRoZSBmb2xsb3dpbmcgRVM1IGNvZGUgdGhhdCBtYXkgaGF2ZSBiZWVuIGdlbmVyYXRlZCBmb3IgYSBjbGFzczpcbiAqXG4gKiBgYGBcbiAqIHZhciBBID0gKGZ1bmN0aW9uKCl7XG4gKiAgIGZ1bmN0aW9uIEEoKSB7fVxuICogICByZXR1cm4gQTtcbiAqIH0oKSk7XG4gKiBBLnN0YXRpY1Byb3AgPSB0cnVlO1xuICogYGBgXG4gKlxuICogSGVyZSwgVHlwZVNjcmlwdCBtYXJrcyB0aGUgc3ltYm9sIGZvciBcIkFcIiBhcyBhIHNvLWNhbGxlZCBcImV4cGFuZG8gc3ltYm9sXCIsIHdoaWNoIGNhdXNlc1xuICogXCJzdGF0aWNQcm9wXCIgdG8gYmUgYWRkZWQgYXMgYW4gZXhwb3J0IG9mIHRoZSBcIkFcIiBzeW1ib2wuXG4gKlxuICogSW4gdGhlIGV4YW1wbGUgYWJvdmUsIHN5bWJvbCBcIkFcIiBoYXMgYmVlbiBhc3NpZ25lZCBzb21lIGZsYWdzIHRvIGluZGljYXRlIHRoYXQgaXQgcmVwcmVzZW50cyBhXG4gKiBjbGFzcy4gRHVlIHRvIHRoaXMgZmxhZywgdGhlIHN5bWJvbCBpcyBjb25zaWRlcmVkIGFuIGV4cGFuZG8gc3ltYm9sIGFuZCBhcyBzdWNoLCBcInN0YXRpY1Byb3BcIiBpc1xuICogc3RvcmVkIGluIGB0cy5TeW1ib2wuZXhwb3J0c2AuXG4gKlxuICogQSBwcm9ibGVtIGFyaXNlcyB3aGVuIFwiQVwiIGlzIG5vdCBhdCB0aGUgdG9wLWxldmVsLCBpLmUuIGluIFVNRCBidW5kbGVzLiBJbiB0aGF0IGNhc2UsIHRoZSBzeW1ib2xcbiAqIGRvZXMgbm90IGhhdmUgdGhlIGZsYWcgdGhhdCBtYXJrcyB0aGUgc3ltYm9sIGFzIGEgY2xhc3MuIFRoZXJlZm9yZSwgVHlwZVNjcmlwdCBpbnNwZWN0cyBcIkFcIidzXG4gKiBpbml0aWFsaXplciBleHByZXNzaW9uLCB3aGljaCBpcyBhbiBJSUZFIGluIHRoZSBhYm92ZSBleGFtcGxlLiBVbmZvcnR1bmF0ZWx5IGhvd2V2ZXIsIG9ubHkgSUlGRXNcbiAqIG9mIHRoZSBmb3JtIGAoZnVuY3Rpb24oKXt9KSgpYCBxdWFsaWZ5IGFzIGluaXRpYWxpemVyIGZvciBhbiBcImV4cGFuZG8gc3ltYm9sXCI7IHRoZSBzbGlnaHRseVxuICogZGlmZmVyZW50IGZvcm0gc2VlbiBpbiB0aGUgZXhhbXBsZSBhYm92ZSwgYChmdW5jdGlvbigpe30oKSlgLCBkb2VzIG5vdC4gVGhpcyBwcmV2ZW50cyB0aGUgXCJBXCJcbiAqIHN5bWJvbCBmcm9tIGJlaW5nIGNvbnNpZGVyZWQgYW4gZXhwYW5kbyBzeW1ib2wsIGluIHR1cm4gcHJldmVudGluZyBcInN0YXRpY1Byb3BcIiBmcm9tIGJlaW5nIHN0b3JlZFxuICogaW4gYHRzLlN5bWJvbC5leHBvcnRzYC5cbiAqXG4gKiBUaGUgbG9naWMgZm9yIGlkZW50aWZ5aW5nIHN5bWJvbHMgYXMgXCJleHBhbmRvIHN5bWJvbHNcIiBjYW4gYmUgZm91bmQgaGVyZTpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9ibG9iL3YzLjQuNS9zcmMvY29tcGlsZXIvYmluZGVyLnRzI0wyNjU2LUwyNjg1XG4gKlxuICogTm90aWNlIGhvdyB0aGUgYGdldEV4cGFuZG9Jbml0aWFsaXplcmAgZnVuY3Rpb24gaXMgYXZhaWxhYmxlIG9uIHRoZSBcInRzXCIgbmFtZXNwYWNlIGluIHRoZVxuICogY29tcGlsZWQgYnVuZGxlLCBzbyB3ZSBhcmUgYWJsZSB0byBvdmVycmlkZSB0aGlzIGZ1bmN0aW9uIHRvIGFjY29tbW9kYXRlIGZvciB0aGUgYWx0ZXJuYXRpdmVcbiAqIElJRkUgbm90YXRpb24uIFRoZSBvcmlnaW5hbCBpbXBsZW1lbnRhdGlvbiBjYW4gYmUgZm91bmQgYXQ6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvYmxvYi92My40LjUvc3JjL2NvbXBpbGVyL3V0aWxpdGllcy50cyNMMTg2NC1MMTg4N1xuICpcbiAqIElzc3VlIHRyYWNrZWQgaW4gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zMTc3OFxuICpcbiAqIEByZXR1cm5zIHRoZSBmdW5jdGlvbiB0byBwYXNzIHRvIGByZXN0b3JlR2V0RXhwYW5kb0luaXRpYWxpemVyYCB0byB1bmRvIHRoZSBwYXRjaCwgb3IgbnVsbCBpZlxuICogdGhlIGlzc3VlIGlzIGtub3duIHRvIGhhdmUgYmVlbiBmaXhlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoVHNHZXRFeHBhbmRvSW5pdGlhbGl6ZXIoKTogdW5rbm93biB7XG4gIGlmIChpc1RzMzE3NzhHZXRFeHBhbmRvSW5pdGlhbGl6ZXJGaXhlZCgpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBvcmlnaW5hbEdldEV4cGFuZG9Jbml0aWFsaXplciA9ICh0cyBhcyBhbnkpLmdldEV4cGFuZG9Jbml0aWFsaXplcjtcbiAgaWYgKG9yaWdpbmFsR2V0RXhwYW5kb0luaXRpYWxpemVyID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBtYWtlVW5zdXBwb3J0ZWRUeXBlU2NyaXB0RXJyb3IoKTtcbiAgfVxuXG4gIC8vIE92ZXJyaWRlIHRoZSBmdW5jdGlvbiB0byBhZGQgc3VwcG9ydCBmb3IgcmVjb2duaXppbmcgdGhlIElJRkUgc3RydWN0dXJlIHVzZWQgaW4gRVM1IGJ1bmRsZXMuXG4gICh0cyBhcyBhbnkpLmdldEV4cGFuZG9Jbml0aWFsaXplciA9IChpbml0aWFsaXplcjogdHMuTm9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJvdG90eXBlQXNzaWdubWVudDogYm9vbGVhbik6IHRzLkV4cHJlc3Npb258dW5kZWZpbmVkID0+IHtcbiAgICAvLyBJZiB0aGUgaW5pdGlhbGl6ZXIgaXMgYSBjYWxsIGV4cHJlc3Npb24gd2l0aGluIHBhcmVudGhlc2lzLCB1bndyYXAgdGhlIHBhcmVudGhlc2lzXG4gICAgLy8gdXBmcm9udCBzdWNoIHRoYXQgdW5zdXBwb3J0ZWQgSUlGRSBzeW50YXggYChmdW5jdGlvbigpe30oKSlgIGJlY29tZXMgYGZ1bmN0aW9uKCl7fSgpYCxcbiAgICAvLyB3aGljaCBpcyBzdXBwb3J0ZWQuXG4gICAgaWYgKHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24oaW5pdGlhbGl6ZXIpICYmIHRzLmlzQ2FsbEV4cHJlc3Npb24oaW5pdGlhbGl6ZXIuZXhwcmVzc2lvbikpIHtcbiAgICAgIGluaXRpYWxpemVyID0gaW5pdGlhbGl6ZXIuZXhwcmVzc2lvbjtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsR2V0RXhwYW5kb0luaXRpYWxpemVyKGluaXRpYWxpemVyLCBpc1Byb3RvdHlwZUFzc2lnbm1lbnQpO1xuICB9O1xuICByZXR1cm4gb3JpZ2luYWxHZXRFeHBhbmRvSW5pdGlhbGl6ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXN0b3JlR2V0RXhwYW5kb0luaXRpYWxpemVyKG9yaWdpbmFsR2V0RXhwYW5kb0luaXRpYWxpemVyOiB1bmtub3duKTogdm9pZCB7XG4gIGlmIChvcmlnaW5hbEdldEV4cGFuZG9Jbml0aWFsaXplciAhPT0gbnVsbCkge1xuICAgICh0cyBhcyBhbnkpLmdldEV4cGFuZG9Jbml0aWFsaXplciA9IG9yaWdpbmFsR2V0RXhwYW5kb0luaXRpYWxpemVyO1xuICB9XG59XG5cbmxldCB0czMxNzc4Rml4ZWRSZXN1bHQ6IGJvb2xlYW58bnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGlzVHMzMTc3OEdldEV4cGFuZG9Jbml0aWFsaXplckZpeGVkKCk6IGJvb2xlYW4ge1xuICAvLyBJZiB0aGUgcmVzdWx0IGhhcyBhbHJlYWR5IGJlZW4gY29tcHV0ZWQsIHJldHVybiBlYXJseS5cbiAgaWYgKHRzMzE3NzhGaXhlZFJlc3VsdCAhPT0gbnVsbCkge1xuICAgIHJldHVybiB0czMxNzc4Rml4ZWRSZXN1bHQ7XG4gIH1cblxuICAvLyBEZXRlcm1pbmUgaWYgdGhlIGlzc3VlIGhhcyBiZWVuIGZpeGVkIGJ5IGNoZWNraW5nIGlmIGFuIGV4cGFuZG8gcHJvcGVydHkgaXMgcHJlc2VudCBpbiBhXG4gIC8vIG1pbmltdW0gcmVwcm9kdWN0aW9uIHVzaW5nIHVucGF0Y2hlZCBUeXBlU2NyaXB0LlxuICB0czMxNzc4Rml4ZWRSZXN1bHQgPSBjaGVja0lmRXhwYW5kb1Byb3BlcnR5SXNQcmVzZW50KCk7XG5cbiAgLy8gSWYgdGhlIGlzc3VlIGRvZXMgbm90IGFwcGVhciB0byBoYXZlIGJlZW4gZml4ZWQsIHZlcmlmeSB0aGF0IGFwcGx5aW5nIHRoZSBwYXRjaCBoYXMgdGhlIGRlc2lyZWRcbiAgLy8gZWZmZWN0LlxuICBpZiAoIXRzMzE3NzhGaXhlZFJlc3VsdCkge1xuICAgIGNvbnN0IG9yaWdpbmFsR2V0RXhwYW5kb0luaXRpYWxpemVyID0gcGF0Y2hUc0dldEV4cGFuZG9Jbml0aWFsaXplcigpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXRjaElzU3VjY2Vzc2Z1bCA9IGNoZWNrSWZFeHBhbmRvUHJvcGVydHlJc1ByZXNlbnQoKTtcbiAgICAgIGlmICghcGF0Y2hJc1N1Y2Nlc3NmdWwpIHtcbiAgICAgICAgdGhyb3cgbWFrZVVuc3VwcG9ydGVkVHlwZVNjcmlwdEVycm9yKCk7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHJlc3RvcmVHZXRFeHBhbmRvSW5pdGlhbGl6ZXIob3JpZ2luYWxHZXRFeHBhbmRvSW5pdGlhbGl6ZXIpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0czMxNzc4Rml4ZWRSZXN1bHQ7XG59XG5cbi8qKlxuICogVmVyaWZpZXMgd2hldGhlciBUUyBpc3N1ZSAzMTc3OCBoYXMgYmVlbiBmaXhlZCBieSBpbnNwZWN0aW5nIGEgc3ltYm9sIGZyb20gYSBtaW5pbXVtXG4gKiByZXByb2R1Y3Rpb24uIElmIHRoZSBzeW1ib2wgZG9lcyBpbiBmYWN0IGhhdmUgdGhlIFwiZXhwYW5kb1wiIGFzIGV4cG9ydCwgdGhlIGlzc3VlIGhhcyBiZWVuIGZpeGVkLlxuICpcbiAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMxNzc4IGZvciBkZXRhaWxzLlxuICovXG5mdW5jdGlvbiBjaGVja0lmRXhwYW5kb1Byb3BlcnR5SXNQcmVzZW50KCk6IGJvb2xlYW4ge1xuICBjb25zdCBzb3VyY2VUZXh0ID0gYFxuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBBID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICBmdW5jdGlvbiBBKCkge31cbiAgICAgICAgcmV0dXJuIEE7XG4gICAgICB9KCkpO1xuICAgICAgQS5leHBhbmRvID0gdHJ1ZTtcbiAgICB9KCkpO2A7XG4gIGNvbnN0IHNvdXJjZUZpbGUgPVxuICAgICAgdHMuY3JlYXRlU291cmNlRmlsZSgndGVzdC5qcycsIHNvdXJjZVRleHQsIHRzLlNjcmlwdFRhcmdldC5FUzUsIHRydWUsIHRzLlNjcmlwdEtpbmQuSlMpO1xuICBjb25zdCBob3N0OiB0cy5Db21waWxlckhvc3QgPSB7XG4gICAgZ2V0U291cmNlRmlsZSgpOiB0cy5Tb3VyY2VGaWxlIHxcbiAgICAgICAgdW5kZWZpbmVkIHtcbiAgICAgICAgICByZXR1cm4gc291cmNlRmlsZTtcbiAgICAgICAgfSxcbiAgICBmaWxlRXhpc3RzKCk6IGJvb2xlYW4ge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICByZWFkRmlsZSgpOiBzdHJpbmcgfFxuICAgICAgICB1bmRlZmluZWQge1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfSxcbiAgICB3cml0ZUZpbGUoKSB7fSxcbiAgICBnZXREZWZhdWx0TGliRmlsZU5hbWUoKTogc3RyaW5nIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9LFxuICAgIGdldEN1cnJlbnREaXJlY3RvcnkoKTogc3RyaW5nIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9LFxuICAgIGdldERpcmVjdG9yaWVzKCk6IHN0cmluZ1tdIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9LFxuICAgIGdldENhbm9uaWNhbEZpbGVOYW1lKGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lO1xuICAgIH0sXG4gICAgdXNlQ2FzZVNlbnNpdGl2ZUZpbGVOYW1lcygpOiBib29sZWFuIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgZ2V0TmV3TGluZSgpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuICdcXG4nO1xuICAgIH0sXG4gIH07XG4gIGNvbnN0IG9wdGlvbnMgPSB7bm9SZXNvbHZlOiB0cnVlLCBub0xpYjogdHJ1ZSwgbm9FbWl0OiB0cnVlLCBhbGxvd0pzOiB0cnVlfTtcbiAgY29uc3QgcHJvZ3JhbSA9IHRzLmNyZWF0ZVByb2dyYW0oWyd0ZXN0LmpzJ10sIG9wdGlvbnMsIGhvc3QpO1xuXG4gIGZ1bmN0aW9uIHZpc2l0b3Iobm9kZTogdHMuTm9kZSk6IHRzLlZhcmlhYmxlRGVjbGFyYXRpb258dW5kZWZpbmVkIHtcbiAgICBpZiAodHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGUpICYmIGhhc05hbWVJZGVudGlmaWVyKG5vZGUpICYmIG5vZGUubmFtZS50ZXh0ID09PSAnQScpIHtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH1cbiAgICByZXR1cm4gdHMuZm9yRWFjaENoaWxkKG5vZGUsIHZpc2l0b3IpO1xuICB9XG5cbiAgY29uc3QgZGVjbGFyYXRpb24gPSB0cy5mb3JFYWNoQ2hpbGQoc291cmNlRmlsZSwgdmlzaXRvcik7XG4gIGlmIChkZWNsYXJhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBkZWNsYXJhdGlvbiBvZiBvdXRlciBBJyk7XG4gIH1cblxuICBjb25zdCBzeW1ib2wgPSBwcm9ncmFtLmdldFR5cGVDaGVja2VyKCkuZ2V0U3ltYm9sQXRMb2NhdGlvbihkZWNsYXJhdGlvbi5uYW1lKTtcbiAgaWYgKHN5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVzb2x2ZSBzeW1ib2wgb2Ygb3V0ZXIgQScpO1xuICB9XG4gIHJldHVybiBzeW1ib2wuZXhwb3J0cyAhPT0gdW5kZWZpbmVkICYmIHN5bWJvbC5leHBvcnRzLmhhcygnZXhwYW5kbycgYXMgdHMuX19TdHJpbmcpO1xufVxuXG5mdW5jdGlvbiBtYWtlVW5zdXBwb3J0ZWRUeXBlU2NyaXB0RXJyb3IoKTogRXJyb3Ige1xuICByZXR1cm4gbmV3IEVycm9yKCdUaGUgVHlwZVNjcmlwdCB2ZXJzaW9uIHVzZWQgaXMgbm90IHN1cHBvcnRlZCBieSBuZ2NjLicpO1xufVxuIl19