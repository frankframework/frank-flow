/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { generatedModuleName } from './util';
export class SummaryGenerator {
    constructor() {
        this.shouldEmit = true;
        this.extensionPrefix = 'ngsummary';
    }
    generateShimForFile(sf, genFilePath) {
        // Collect a list of classes that need to have factory types emitted for them. This list is
        // overly broad as at this point the ts.TypeChecker has not been created and so it can't be used
        // to semantically understand which decorators are Angular decorators. It's okay to output an
        // overly broad set of summary exports as the exports are no-ops anyway, and summaries are a
        // compatibility layer which will be removed after Ivy is enabled.
        const symbolNames = [];
        for (const stmt of sf.statements) {
            if (ts.isClassDeclaration(stmt)) {
                // If the class isn't exported, or if it's not decorated, then skip it.
                if (!isExported(stmt) || stmt.decorators === undefined || stmt.name === undefined) {
                    continue;
                }
                symbolNames.push(stmt.name.text);
            }
            else if (ts.isExportDeclaration(stmt)) {
                // Look for an export statement of the form "export {...};". If it doesn't match that, then
                // skip it.
                if (stmt.exportClause === undefined || stmt.moduleSpecifier !== undefined ||
                    !ts.isNamedExports(stmt.exportClause)) {
                    continue;
                }
                for (const specifier of stmt.exportClause.elements) {
                    // At this point, there is no guarantee that specifier here refers to a class declaration,
                    // but that's okay.
                    // Use specifier.name as that's guaranteed to be the exported name, regardless of whether
                    // specifier.propertyName is set.
                    symbolNames.push(specifier.name.text);
                }
            }
        }
        const varLines = symbolNames.map(name => `export const ${name}NgSummary: any = null;`);
        if (varLines.length === 0) {
            // In the event there are no other exports, add an empty export to ensure the generated
            // summary file is still an ES module.
            varLines.push(`export const ɵempty = null;`);
        }
        const sourceText = varLines.join('\n');
        const genFile = ts.createSourceFile(genFilePath, sourceText, sf.languageVersion, true, ts.ScriptKind.TS);
        if (sf.moduleName !== undefined) {
            genFile.moduleName = generatedModuleName(sf.moduleName, sf.fileName, '.ngsummary');
        }
        return genFile;
    }
}
function isExported(decl) {
    return decl.modifiers !== undefined &&
        decl.modifiers.some(mod => mod.kind == ts.SyntaxKind.ExportKeyword);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VtbWFyeV9nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3NoaW1zL3NyYy9zdW1tYXJ5X2dlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUtqQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFM0MsTUFBTSxPQUFPLGdCQUFnQjtJQUE3QjtRQUNXLGVBQVUsR0FBRyxJQUFJLENBQUM7UUFDbEIsb0JBQWUsR0FBRyxXQUFXLENBQUM7SUFrRHpDLENBQUM7SUFoREMsbUJBQW1CLENBQUMsRUFBaUIsRUFBRSxXQUEyQjtRQUNoRSwyRkFBMkY7UUFDM0YsZ0dBQWdHO1FBQ2hHLDZGQUE2RjtRQUM3Riw0RkFBNEY7UUFDNUYsa0VBQWtFO1FBQ2xFLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUNqQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEVBQUUsQ0FBQyxVQUFVLEVBQUU7WUFDaEMsSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQy9CLHVFQUF1RTtnQkFDdkUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtvQkFDakYsU0FBUztpQkFDVjtnQkFDRCxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDbEM7aUJBQU0sSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3ZDLDJGQUEyRjtnQkFDM0YsV0FBVztnQkFDWCxJQUFJLElBQUksQ0FBQyxZQUFZLEtBQUssU0FBUyxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUssU0FBUztvQkFDckUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDekMsU0FBUztpQkFDVjtnQkFFRCxLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFO29CQUNsRCwwRkFBMEY7b0JBQzFGLG1CQUFtQjtvQkFFbkIseUZBQXlGO29CQUN6RixpQ0FBaUM7b0JBQ2pDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDdkM7YUFDRjtTQUNGO1FBRUQsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGdCQUFnQixJQUFJLHdCQUF3QixDQUFDLENBQUM7UUFFdkYsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN6Qix1RkFBdUY7WUFDdkYsc0NBQXNDO1lBQ3RDLFFBQVEsQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztTQUM5QztRQUNELE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkMsTUFBTSxPQUFPLEdBQ1QsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDLGVBQWUsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3RixJQUFJLEVBQUUsQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQy9CLE9BQU8sQ0FBQyxVQUFVLEdBQUcsbUJBQW1CLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1NBQ3BGO1FBQ0QsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztDQUNGO0FBRUQsU0FBUyxVQUFVLENBQUMsSUFBb0I7SUFDdEMsT0FBTyxJQUFJLENBQUMsU0FBUyxLQUFLLFNBQVM7UUFDL0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDMUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aH0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtQZXJGaWxlU2hpbUdlbmVyYXRvcn0gZnJvbSAnLi4vYXBpJztcblxuaW1wb3J0IHtnZW5lcmF0ZWRNb2R1bGVOYW1lfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgU3VtbWFyeUdlbmVyYXRvciBpbXBsZW1lbnRzIFBlckZpbGVTaGltR2VuZXJhdG9yIHtcbiAgcmVhZG9ubHkgc2hvdWxkRW1pdCA9IHRydWU7XG4gIHJlYWRvbmx5IGV4dGVuc2lvblByZWZpeCA9ICduZ3N1bW1hcnknO1xuXG4gIGdlbmVyYXRlU2hpbUZvckZpbGUoc2Y6IHRzLlNvdXJjZUZpbGUsIGdlbkZpbGVQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IHRzLlNvdXJjZUZpbGUge1xuICAgIC8vIENvbGxlY3QgYSBsaXN0IG9mIGNsYXNzZXMgdGhhdCBuZWVkIHRvIGhhdmUgZmFjdG9yeSB0eXBlcyBlbWl0dGVkIGZvciB0aGVtLiBUaGlzIGxpc3QgaXNcbiAgICAvLyBvdmVybHkgYnJvYWQgYXMgYXQgdGhpcyBwb2ludCB0aGUgdHMuVHlwZUNoZWNrZXIgaGFzIG5vdCBiZWVuIGNyZWF0ZWQgYW5kIHNvIGl0IGNhbid0IGJlIHVzZWRcbiAgICAvLyB0byBzZW1hbnRpY2FsbHkgdW5kZXJzdGFuZCB3aGljaCBkZWNvcmF0b3JzIGFyZSBBbmd1bGFyIGRlY29yYXRvcnMuIEl0J3Mgb2theSB0byBvdXRwdXQgYW5cbiAgICAvLyBvdmVybHkgYnJvYWQgc2V0IG9mIHN1bW1hcnkgZXhwb3J0cyBhcyB0aGUgZXhwb3J0cyBhcmUgbm8tb3BzIGFueXdheSwgYW5kIHN1bW1hcmllcyBhcmUgYVxuICAgIC8vIGNvbXBhdGliaWxpdHkgbGF5ZXIgd2hpY2ggd2lsbCBiZSByZW1vdmVkIGFmdGVyIEl2eSBpcyBlbmFibGVkLlxuICAgIGNvbnN0IHN5bWJvbE5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3Qgc3RtdCBvZiBzZi5zdGF0ZW1lbnRzKSB7XG4gICAgICBpZiAodHMuaXNDbGFzc0RlY2xhcmF0aW9uKHN0bXQpKSB7XG4gICAgICAgIC8vIElmIHRoZSBjbGFzcyBpc24ndCBleHBvcnRlZCwgb3IgaWYgaXQncyBub3QgZGVjb3JhdGVkLCB0aGVuIHNraXAgaXQuXG4gICAgICAgIGlmICghaXNFeHBvcnRlZChzdG10KSB8fCBzdG10LmRlY29yYXRvcnMgPT09IHVuZGVmaW5lZCB8fCBzdG10Lm5hbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHN5bWJvbE5hbWVzLnB1c2goc3RtdC5uYW1lLnRleHQpO1xuICAgICAgfSBlbHNlIGlmICh0cy5pc0V4cG9ydERlY2xhcmF0aW9uKHN0bXQpKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGFuIGV4cG9ydCBzdGF0ZW1lbnQgb2YgdGhlIGZvcm0gXCJleHBvcnQgey4uLn07XCIuIElmIGl0IGRvZXNuJ3QgbWF0Y2ggdGhhdCwgdGhlblxuICAgICAgICAvLyBza2lwIGl0LlxuICAgICAgICBpZiAoc3RtdC5leHBvcnRDbGF1c2UgPT09IHVuZGVmaW5lZCB8fCBzdG10Lm1vZHVsZVNwZWNpZmllciAhPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhdHMuaXNOYW1lZEV4cG9ydHMoc3RtdC5leHBvcnRDbGF1c2UpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IHNwZWNpZmllciBvZiBzdG10LmV4cG9ydENsYXVzZS5lbGVtZW50cykge1xuICAgICAgICAgIC8vIEF0IHRoaXMgcG9pbnQsIHRoZXJlIGlzIG5vIGd1YXJhbnRlZSB0aGF0IHNwZWNpZmllciBoZXJlIHJlZmVycyB0byBhIGNsYXNzIGRlY2xhcmF0aW9uLFxuICAgICAgICAgIC8vIGJ1dCB0aGF0J3Mgb2theS5cblxuICAgICAgICAgIC8vIFVzZSBzcGVjaWZpZXIubmFtZSBhcyB0aGF0J3MgZ3VhcmFudGVlZCB0byBiZSB0aGUgZXhwb3J0ZWQgbmFtZSwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyXG4gICAgICAgICAgLy8gc3BlY2lmaWVyLnByb3BlcnR5TmFtZSBpcyBzZXQuXG4gICAgICAgICAgc3ltYm9sTmFtZXMucHVzaChzcGVjaWZpZXIubmFtZS50ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHZhckxpbmVzID0gc3ltYm9sTmFtZXMubWFwKG5hbWUgPT4gYGV4cG9ydCBjb25zdCAke25hbWV9TmdTdW1tYXJ5OiBhbnkgPSBudWxsO2ApO1xuXG4gICAgaWYgKHZhckxpbmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gSW4gdGhlIGV2ZW50IHRoZXJlIGFyZSBubyBvdGhlciBleHBvcnRzLCBhZGQgYW4gZW1wdHkgZXhwb3J0IHRvIGVuc3VyZSB0aGUgZ2VuZXJhdGVkXG4gICAgICAvLyBzdW1tYXJ5IGZpbGUgaXMgc3RpbGwgYW4gRVMgbW9kdWxlLlxuICAgICAgdmFyTGluZXMucHVzaChgZXhwb3J0IGNvbnN0IMm1ZW1wdHkgPSBudWxsO2ApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUZXh0ID0gdmFyTGluZXMuam9pbignXFxuJyk7XG4gICAgY29uc3QgZ2VuRmlsZSA9XG4gICAgICAgIHRzLmNyZWF0ZVNvdXJjZUZpbGUoZ2VuRmlsZVBhdGgsIHNvdXJjZVRleHQsIHNmLmxhbmd1YWdlVmVyc2lvbiwgdHJ1ZSwgdHMuU2NyaXB0S2luZC5UUyk7XG4gICAgaWYgKHNmLm1vZHVsZU5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZ2VuRmlsZS5tb2R1bGVOYW1lID0gZ2VuZXJhdGVkTW9kdWxlTmFtZShzZi5tb2R1bGVOYW1lLCBzZi5maWxlTmFtZSwgJy5uZ3N1bW1hcnknKTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbkZpbGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNFeHBvcnRlZChkZWNsOiB0cy5EZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gZGVjbC5tb2RpZmllcnMgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgZGVjbC5tb2RpZmllcnMuc29tZShtb2QgPT4gbW9kLmtpbmQgPT0gdHMuU3ludGF4S2luZC5FeHBvcnRLZXl3b3JkKTtcbn1cbiJdfQ==