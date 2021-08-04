/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { ErrorCode, ngErrorCode } from '../../diagnostics';
/**
 * Produce `ts.Diagnostic`s for classes that are visible from exported types (e.g. directives
 * exposed by exported `NgModule`s) that are not themselves exported.
 *
 * This function reconciles two concepts:
 *
 * A class is Exported if it's exported from the main library `entryPoint` file.
 * A class is Visible if, via Angular semantics, a downstream consumer can import an Exported class
 * and be affected by the class in question. For example, an Exported NgModule may expose a
 * directive class to its consumers. Consumers that import the NgModule may have the directive
 * applied to elements in their templates. In this case, the directive is considered Visible.
 *
 * `checkForPrivateExports` attempts to verify that all Visible classes are Exported, and report
 * `ts.Diagnostic`s for those that aren't.
 *
 * @param entryPoint `ts.SourceFile` of the library's entrypoint, which should export the library's
 * public API.
 * @param checker `ts.TypeChecker` for the current program.
 * @param refGraph `ReferenceGraph` tracking the visibility of Angular types.
 * @returns an array of `ts.Diagnostic`s representing errors when visible classes are not exported
 * properly.
 */
export function checkForPrivateExports(entryPoint, checker, refGraph) {
    const diagnostics = [];
    // Firstly, compute the exports of the entry point. These are all the Exported classes.
    const topLevelExports = new Set();
    // Do this via `ts.TypeChecker.getExportsOfModule`.
    const moduleSymbol = checker.getSymbolAtLocation(entryPoint);
    if (moduleSymbol === undefined) {
        throw new Error(`Internal error: failed to get symbol for entrypoint`);
    }
    const exportedSymbols = checker.getExportsOfModule(moduleSymbol);
    // Loop through the exported symbols, de-alias if needed, and add them to `topLevelExports`.
    // TODO(alxhub): use proper iteration when build.sh is removed. (#27762)
    exportedSymbols.forEach(symbol => {
        if (symbol.flags & ts.SymbolFlags.Alias) {
            symbol = checker.getAliasedSymbol(symbol);
        }
        const decl = symbol.valueDeclaration;
        if (decl !== undefined) {
            topLevelExports.add(decl);
        }
    });
    // Next, go through each exported class and expand it to the set of classes it makes Visible,
    // using the `ReferenceGraph`. For each Visible class, verify that it's also Exported, and queue
    // an error if it isn't. `checkedSet` ensures only one error is queued per class.
    const checkedSet = new Set();
    // Loop through each Exported class.
    // TODO(alxhub): use proper iteration when the legacy build is removed. (#27762)
    topLevelExports.forEach(mainExport => {
        // Loop through each class made Visible by the Exported class.
        refGraph.transitiveReferencesOf(mainExport).forEach(transitiveReference => {
            // Skip classes which have already been checked.
            if (checkedSet.has(transitiveReference)) {
                return;
            }
            checkedSet.add(transitiveReference);
            // Verify that the Visible class is also Exported.
            if (!topLevelExports.has(transitiveReference)) {
                // This is an error, `mainExport` makes `transitiveReference` Visible, but
                // `transitiveReference` is not Exported from the entrypoint. Construct a diagnostic to
                // give to the user explaining the situation.
                const descriptor = getDescriptorOfDeclaration(transitiveReference);
                const name = getNameOfDeclaration(transitiveReference);
                // Construct the path of visibility, from `mainExport` to `transitiveReference`.
                let visibleVia = 'NgModule exports';
                const transitivePath = refGraph.pathFrom(mainExport, transitiveReference);
                if (transitivePath !== null) {
                    visibleVia = transitivePath.map(seg => getNameOfDeclaration(seg)).join(' -> ');
                }
                const diagnostic = Object.assign(Object.assign({ category: ts.DiagnosticCategory.Error, code: ngErrorCode(ErrorCode.SYMBOL_NOT_EXPORTED), file: transitiveReference.getSourceFile() }, getPosOfDeclaration(transitiveReference)), { messageText: `Unsupported private ${descriptor} ${name}. This ${descriptor} is visible to consumers via ${visibleVia}, but is not exported from the top-level library entrypoint.` });
                diagnostics.push(diagnostic);
            }
        });
    });
    return diagnostics;
}
function getPosOfDeclaration(decl) {
    const node = getIdentifierOfDeclaration(decl) || decl;
    return {
        start: node.getStart(),
        length: node.getEnd() + 1 - node.getStart(),
    };
}
function getIdentifierOfDeclaration(decl) {
    if ((ts.isClassDeclaration(decl) || ts.isVariableDeclaration(decl) ||
        ts.isFunctionDeclaration(decl)) &&
        decl.name !== undefined && ts.isIdentifier(decl.name)) {
        return decl.name;
    }
    else {
        return null;
    }
}
function getNameOfDeclaration(decl) {
    const id = getIdentifierOfDeclaration(decl);
    return id !== null ? id.text : '(unnamed)';
}
function getDescriptorOfDeclaration(decl) {
    switch (decl.kind) {
        case ts.SyntaxKind.ClassDeclaration:
            return 'class';
        case ts.SyntaxKind.FunctionDeclaration:
            return 'function';
        case ts.SyntaxKind.VariableDeclaration:
            return 'variable';
        case ts.SyntaxKind.EnumDeclaration:
            return 'enum';
        default:
            return 'declaration';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJpdmF0ZV9leHBvcnRfY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvZW50cnlfcG9pbnQvc3JjL3ByaXZhdGVfZXhwb3J0X2NoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUt6RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBcUJHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUNsQyxVQUF5QixFQUFFLE9BQXVCLEVBQUUsUUFBd0I7SUFDOUUsTUFBTSxXQUFXLEdBQW9CLEVBQUUsQ0FBQztJQUV4Qyx1RkFBdUY7SUFDdkYsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQW1CLENBQUM7SUFFbkQsbURBQW1EO0lBQ25ELE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM3RCxJQUFJLFlBQVksS0FBSyxTQUFTLEVBQUU7UUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO0tBQ3hFO0lBQ0QsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRWpFLDRGQUE0RjtJQUM1Rix3RUFBd0U7SUFDeEUsZUFBZSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUMvQixJQUFJLE1BQU0sQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7WUFDdkMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUMzQztRQUNELE1BQU0sSUFBSSxHQUFHLE1BQU0s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QUksQ0FBQztLQUNsQjtTQUFNO1FBQ0wsT0FBTyxJQUFJLENBQUM7S0FDYjtBQUNILENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUFDLElBQXFCO0lBQ2pELE1BQU0sRUFBRSxHQUFHLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLE9BQU8sRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzdDLENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUFDLElBQXFCO0lBQ3ZELFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRTtRQUNqQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCO1lBQ2pDLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7WUFDcEMsT0FBTyxVQUFVLENBQUM7UUFDcEIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtZQUNwQyxPQUFPLFVBQVUsQ0FBQztRQUNwQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsZUFBZTtZQUNoQyxPQUFPLE1BQU0sQ0FBQztRQUNoQjtZQUNFLE9BQU8sYUFBYSxDQUFDO0tBQ3hCO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFcnJvckNvZGUsIG5nRXJyb3JDb2RlfSBmcm9tICcuLi8uLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge0RlY2xhcmF0aW9uTm9kZX0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5cbmltcG9ydCB7UmVmZXJlbmNlR3JhcGh9IGZyb20gJy4vcmVmZXJlbmNlX2dyYXBoJztcblxuLyoqXG4gKiBQcm9kdWNlIGB0cy5EaWFnbm9zdGljYHMgZm9yIGNsYXNzZXMgdGhhdCBhcmUgdmlzaWJsZSBmcm9tIGV4cG9ydGVkIHR5cGVzIChlLmcuIGRpcmVjdGl2ZXNcbiAqIGV4cG9zZWQgYnkgZXhwb3J0ZWQgYE5nTW9kdWxlYHMpIHRoYXQgYXJlIG5vdCB0aGVtc2VsdmVzIGV4cG9ydGVkLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gcmVjb25jaWxlcyB0d28gY29uY2VwdHM6XG4gKlxuICogQSBjbGFzcyBpcyBFeHBvcnRlZCBpZiBpdCdzIGV4cG9ydGVkIGZyb20gdGhlIG1haW4gbGlicmFyeSBgZW50cnlQb2ludGAgZmlsZS5cbiAqIEEgY2xhc3MgaXMgVmlzaWJsZSBpZiwgdmlhIEFuZ3VsYXIgc2VtYW50aWNzLCBhIGRvd25zdHJlYW0gY29uc3VtZXIgY2FuIGltcG9ydCBhbiBFeHBvcnRlZCBjbGFzc1xuICogYW5kIGJlIGFmZmVjdGVkIGJ5IHRoZSBjbGFzcyBpbiBxdWVzdGlvbi4gRm9yIGV4YW1wbGUsIGFuIEV4cG9ydGVkIE5nTW9kdWxlIG1heSBleHBvc2UgYVxuICogZGlyZWN0aXZlIGNsYXNzIHRvIGl0cyBjb25zdW1lcnMuIENvbnN1bWVycyB0aGF0IGltcG9ydCB0aGUgTmdNb2R1bGUgbWF5IGhhdmUgdGhlIGRpcmVjdGl2ZVxuICogYXBwbGllZCB0byBlbGVtZW50cyBpbiB0aGVpciB0ZW1wbGF0ZXMuIEluIHRoaXMgY2FzZSwgdGhlIGRpcmVjdGl2ZSBpcyBjb25zaWRlcmVkIFZpc2libGUuXG4gKlxuICogYGNoZWNrRm9yUHJpdmF0ZUV4cG9ydHNgIGF0dGVtcHRzIHRvIHZlcmlmeSB0aGF0IGFsbCBWaXNpYmxlIGNsYXNzZXMgYXJlIEV4cG9ydGVkLCBhbmQgcmVwb3J0XG4gKiBgdHMuRGlhZ25vc3RpY2BzIGZvciB0aG9zZSB0aGF0IGFyZW4ndC5cbiAqXG4gKiBAcGFyYW0gZW50cnlQb2ludCBgdHMuU291cmNlRmlsZWAgb2YgdGhlIGxpYnJhcnkncyBlbnRyeXBvaW50LCB3aGljaCBzaG91bGQgZXhwb3J0IHRoZSBsaWJyYXJ5J3NcbiAqIHB1YmxpYyBBUEkuXG4gKiBAcGFyYW0gY2hlY2tlciBgdHMuVHlwZUNoZWNrZXJgIGZvciB0aGUgY3VycmVudCBwcm9ncmFtLlxuICogQHBhcmFtIHJlZkdyYXBoIGBSZWZlcmVuY2VHcmFwaGAgdHJhY2tpbmcgdGhlIHZpc2liaWxpdHkgb2YgQW5ndWxhciB0eXBlcy5cbiAqIEByZXR1cm5zIGFuIGFycmF5IG9mIGB0cy5EaWFnbm9zdGljYHMgcmVwcmVzZW50aW5nIGVycm9ycyB3aGVuIHZpc2libGUgY2xhc3NlcyBhcmUgbm90IGV4cG9ydGVkXG4gKiBwcm9wZXJseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrRm9yUHJpdmF0ZUV4cG9ydHMoXG4gICAgZW50cnlQb2ludDogdHMuU291cmNlRmlsZSwgY2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIHJlZkdyYXBoOiBSZWZlcmVuY2VHcmFwaCk6IHRzLkRpYWdub3N0aWNbXSB7XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAvLyBGaXJzdGx5LCBjb21wdXRlIHRoZSBleHBvcnRzIG9mIHRoZSBlbnRyeSBwb2ludC4gVGhlc2UgYXJlIGFsbCB0aGUgRXhwb3J0ZWQgY2xhc3Nlcy5cbiAgY29uc3QgdG9wTGV2ZWxFeHBvcnRzID0gbmV3IFNldDxEZWNsYXJhdGlvbk5vZGU+KCk7XG5cbiAgLy8gRG8gdGhpcyB2aWEgYHRzLlR5cGVDaGVja2VyLmdldEV4cG9ydHNPZk1vZHVsZWAuXG4gIGNvbnN0IG1vZHVsZVN5bWJvbCA9IGNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihlbnRyeVBvaW50KTtcbiAgaWYgKG1vZHVsZVN5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBlcnJvcjogZmFpbGVkIHRvIGdldCBzeW1ib2wgZm9yIGVudHJ5cG9pbnRgKTtcbiAgfVxuICBjb25zdCBleHBvcnRlZFN5bWJvbHMgPSBjaGVja2VyLmdldEV4cG9ydHNPZk1vZHVsZShtb2R1bGVTeW1ib2wpO1xuXG4gIC8vIExvb3AgdGhyb3VnaCB0aGUgZXhwb3J0ZWQgc3ltYm9scywgZGUtYWxpYXMgaWYgbmVlZGVkLCBhbmQgYWRkIHRoZW0gdG8gYHRvcExldmVsRXhwb3J0c2AuXG4gIC8vIFRPRE8oYWx4aHViKTogdXNlIHByb3BlciBpdGVyYXRpb24gd2hlbiBidWlsZC5zaCBpcyByZW1vdmVkLiAoIzI3NzYyKVxuICBleHBvcnRlZFN5bWJvbHMuZm9yRWFjaChzeW1ib2wgPT4ge1xuICAgIGlmIChzeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgc3ltYm9sID0gY2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHN5bWJvbCk7XG4gICAgfVxuICAgIGNvbnN0IGRlY2wgPSBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbjtcbiAgICBpZiAoZGVjbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0b3BMZXZlbEV4cG9ydHMuYWRkKGRlY2wpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gTmV4dCwgZ28gdGhyb3VnaCBlYWNoIGV4cG9ydGVkIGNsYXNzIGFuZCBleHBhbmQgaXQgdG8gdGhlIHNldCBvZiBjbGFzc2VzIGl0IG1ha2VzIFZpc2libGUsXG4gIC8vIHVzaW5nIHRoZSBgUmVmZXJlbmNlR3JhcGhgLiBGb3IgZWFjaCBWaXNpYmxlIGNsYXNzLCB2ZXJpZnkgdGhhdCBpdCdzIGFsc28gRXhwb3J0ZWQsIGFuZCBxdWV1ZVxuICAvLyBhbiBlcnJvciBpZiBpdCBpc24ndC4gYGNoZWNrZWRTZXRgIGVuc3VyZXMgb25seSBvbmUgZXJyb3IgaXMgcXVldWVkIHBlciBjbGFzcy5cbiAgY29uc3QgY2hlY2tlZFNldCA9IG5ldyBTZXQ8RGVjbGFyYXRpb25Ob2RlPigpO1xuXG4gIC8vIExvb3AgdGhyb3VnaCBlYWNoIEV4cG9ydGVkIGNsYXNzLlxuICAvLyBUT0RPKGFseGh1Yik6IHVzZSBwcm9wZXIgaXRlcmF0aW9uIHdoZW4gdGhlIGxlZ2FjeSBidWlsZCBpcyByZW1vdmVkLiAoIzI3NzYyKVxuICB0b3BMZXZlbEV4cG9ydHMuZm9yRWFjaChtYWluRXhwb3J0ID0+IHtcbiAgICAvLyBMb29wIHRocm91Z2ggZWFjaCBjbGFzcyBtYWRlIFZpc2libGUgYnkgdGhlIEV4cG9ydGVkIGNsYXNzLlxuICAgIHJlZkdyYXBoLnRyYW5zaXRpdmVSZWZlcmVuY2VzT2YobWFpbkV4cG9ydCkuZm9yRWFjaCh0cmFuc2l0aXZlUmVmZXJlbmNlID0+IHtcbiAgICAgIC8vIFNraXAgY2xhc3NlcyB3aGljaCBoYXZlIGFscmVhZHkgYmVlbiBjaGVja2VkLlxuICAgICAgaWYgKGNoZWNrZWRTZXQuaGFzKHRyYW5zaXRpdmVSZWZlcmVuY2UpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNoZWNrZWRTZXQuYWRkKHRyYW5zaXRpdmVSZWZlcmVuY2UpO1xuXG4gICAgICAvLyBWZXJpZnkgdGhhdCB0aGUgVmlzaWJsZSBjbGFzcyBpcyBhbHNvIEV4cG9ydGVkLlxuICAgICAgaWYgKCF0b3BMZXZlbEV4cG9ydHMuaGFzKHRyYW5zaXRpdmVSZWZlcmVuY2UpKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYW4gZXJyb3IsIGBtYWluRXhwb3J0YCBtYWtlcyBgdHJhbnNpdGl2ZVJlZmVyZW5jZWAgVmlzaWJsZSwgYnV0XG4gICAgICAgIC8vIGB0cmFuc2l0aXZlUmVmZXJlbmNlYCBpcyBub3QgRXhwb3J0ZWQgZnJvbSB0aGUgZW50cnlwb2ludC4gQ29uc3RydWN0IGEgZGlhZ25vc3RpYyB0b1xuICAgICAgICAvLyBnaXZlIHRvIHRoZSB1c2VyIGV4cGxhaW5pbmcgdGhlIHNpdHVhdGlvbi5cblxuICAgICAgICBjb25zdCBkZXNjcmlwdG9yID0gZ2V0RGVzY3JpcHRvck9mRGVjbGFyYXRpb24odHJhbnNpdGl2ZVJlZmVyZW5jZSk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBnZXROYW1lT2ZEZWNsYXJhdGlvbih0cmFuc2l0aXZlUmVmZXJlbmNlKTtcblxuICAgICAgICAvLyBDb25zdHJ1Y3QgdGhlIHBhdGggb2YgdmlzaWJpbGl0eSwgZnJvbSBgbWFpbkV4cG9ydGAgdG8gYHRyYW5zaXRpdmVSZWZlcmVuY2VgLlxuICAgICAgICBsZXQgdmlzaWJsZVZpYSA9ICdOZ01vZHVsZSBleHBvcnRzJztcbiAgICAgICAgY29uc3QgdHJhbnNpdGl2ZVBhdGggPSByZWZHcmFwaC5wYXRoRnJvbShtYWluRXhwb3J0LCB0cmFuc2l0aXZlUmVmZXJlbmNlKTtcbiAgICAgICAgaWYgKHRyYW5zaXRpdmVQYXRoICE9PSBudWxsKSB7XG4gICAgICAgICAgdmlzaWJsZVZpYSA9IHRyYW5zaXRpdmVQYXRoLm1hcChzZWcgPT4gZ2V0TmFtZU9mRGVjbGFyYXRpb24oc2VnKSkuam9pbignIC0+ICcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyA9IHtcbiAgICAgICAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgICAgICAgIGNvZGU6IG5nRXJyb3JDb2RlKEVycm9yQ29kZS5TWU1CT0xfTk9UX0VYUE9SVEVEKSxcbiAgICAgICAgICBmaWxlOiB0cmFuc2l0aXZlUmVmZXJlbmNlLmdldFNvdXJjZUZpbGUoKSxcbiAgICAgICAgICAuLi5nZXRQb3NPZkRlY2xhcmF0aW9uKHRyYW5zaXRpdmVSZWZlcmVuY2UpLFxuICAgICAgICAgIG1lc3NhZ2VUZXh0OiBgVW5zdXBwb3J0ZWQgcHJpdmF0ZSAke2Rlc2NyaXB0b3J9ICR7bmFtZX0uIFRoaXMgJHtcbiAgICAgICAgICAgICAgZGVzY3JpcHRvcn0gaXMgdmlzaWJsZSB0byBjb25zdW1lcnMgdmlhICR7XG4gICAgICAgICAgICAgIHZpc2libGVWaWF9LCBidXQgaXMgbm90IGV4cG9ydGVkIGZyb20gdGhlIHRvcC1sZXZlbCBsaWJyYXJ5IGVudHJ5cG9pbnQuYCxcbiAgICAgICAgfTtcblxuICAgICAgICBkaWFnbm9zdGljcy5wdXNoKGRpYWdub3N0aWMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmZ1bmN0aW9uIGdldFBvc09mRGVjbGFyYXRpb24oZGVjbDogRGVjbGFyYXRpb25Ob2RlKToge3N0YXJ0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyfSB7XG4gIGNvbnN0IG5vZGU6IHRzLk5vZGUgPSBnZXRJZGVudGlmaWVyT2ZEZWNsYXJhdGlvbihkZWNsKSB8fCBkZWNsO1xuICByZXR1cm4ge1xuICAgIHN0YXJ0OiBub2RlLmdldFN0YXJ0KCksXG4gICAgbGVuZ3RoOiBub2RlLmdldEVuZCgpICsgMSAtIG5vZGUuZ2V0U3RhcnQoKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0SWRlbnRpZmllck9mRGVjbGFyYXRpb24oZGVjbDogRGVjbGFyYXRpb25Ob2RlKTogdHMuSWRlbnRpZmllcnxudWxsIHtcbiAgaWYgKCh0cy5pc0NsYXNzRGVjbGFyYXRpb24oZGVjbCkgfHwgdHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKGRlY2wpIHx8XG4gICAgICAgdHMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKGRlY2wpKSAmJlxuICAgICAgZGVjbC5uYW1lICE9PSB1bmRlZmluZWQgJiYgdHMuaXNJZGVudGlmaWVyKGRlY2wubmFtZSkpIHtcbiAgICByZXR1cm4gZGVjbC5uYW1lO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldE5hbWVPZkRlY2xhcmF0aW9uKGRlY2w6IERlY2xhcmF0aW9uTm9kZSk6IHN0cmluZyB7XG4gIGNvbnN0IGlkID0gZ2V0SWRlbnRpZmllck9mRGVjbGFyYXRpb24oZGVjbCk7XG4gIHJldHVybiBpZCAhPT0gbnVsbCA/IGlkLnRleHQgOiAnKHVubmFtZWQpJztcbn1cblxuZnVuY3Rpb24gZ2V0RGVzY3JpcHRvck9mRGVjbGFyYXRpb24oZGVjbDogRGVjbGFyYXRpb25Ob2RlKTogc3RyaW5nIHtcbiAgc3dpdGNoIChkZWNsLmtpbmQpIHtcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ2xhc3NEZWNsYXJhdGlvbjpcbiAgICAgIHJldHVybiAnY2xhc3MnO1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvbkRlY2xhcmF0aW9uOlxuICAgICAgcmV0dXJuICdmdW5jdGlvbic7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlZhcmlhYmxlRGVjbGFyYXRpb246XG4gICAgICByZXR1cm4gJ3ZhcmlhYmxlJztcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuRW51bURlY2xhcmF0aW9uOlxuICAgICAgcmV0dXJuICdlbnVtJztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICdkZWNsYXJhdGlvbic7XG4gIH1cbn1cbiJdfQ==