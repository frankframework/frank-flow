/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SchematicsException, } from '@angular-devkit/schematics';
import { relative } from 'path';
import * as ts from 'typescript';
import { getProjectTsConfigPaths } from '../../utils/project_tsconfig_paths';
import { canMigrateFile, createMigrationProgram } from '../../utils/typescript/compiler_host';
import { UndecoratedClassesWithDecoratedFieldsTransform } from './transform';
/**
 * Migration that adds an Angular decorator to classes that have Angular field decorators.
 * https://hackmd.io/vuQfavzfRG6KUCtU7oK_EA
 */
export default function () {
    return (tree, ctx) => {
        const { buildPaths, testPaths } = getProjectTsConfigPaths(tree);
        const basePath = process.cwd();
        const allPaths = [...buildPaths, ...testPaths];
        const failures = [];
        if (!allPaths.length) {
            throw new SchematicsException('Could not find any tsconfig file. Cannot add an Angular decorator to undecorated classes.');
        }
        for (const tsconfigPath of allPaths) {
            failures.push(...runUndecoratedClassesMigration(tree, tsconfigPath, basePath));
        }
        if (failures.length) {
            ctx.logger.info('Could not migrate all undecorated classes that use Angular features.');
            ctx.logger.info('Please manually fix the following failures:');
            failures.forEach(message => ctx.logger.warn(`⮑   ${message}`));
        }
    };
}
function runUndecoratedClassesMigration(tree, tsconfigPath, basePath) {
    const failures = [];
    const { program } = createMigrationProgram(tree, tsconfigPath, basePath);
    const typeChecker = program.getTypeChecker();
    const sourceFiles = program.getSourceFiles().filter(sourceFile => canMigrateFile(basePath, sourceFile, program));
    const updateRecorders = new Map();
    const transform = new UndecoratedClassesWithDecoratedFieldsTransform(typeChecker, getUpdateRecorder);
    // Migrate all source files in the project.
    transform.migrate(sourceFiles).forEach(({ node, message }) => {
        const nodeSourceFile = node.getSourceFile();
        const relativeFilePath = relative(basePath, nodeSourceFile.fileName);
        const { line, character } = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart());
        failures.push(`${relativeFilePath}@${line + 1}:${character + 1}: ${message}`);
    });
    // Record the changes collected in the import manager.
    transform.recordChanges();
    // Walk through each update recorder and commit the update. We need to commit the
    // updates in batches per source file as there can be only one recorder per source
    // file in order to avoid shifted character offsets.
    updateRecorders.forEach(recorder => recorder.commitUpdate());
    return failures;
    /** Gets the update recorder for the specified source file. */
    function getUpdateRecorder(sourceFile) {
        if (updateRecorders.has(sourceFile)) {
            return updateRecorders.get(sourceFile);
        }
        const treeRecorder = tree.beginUpdate(relative(basePath, sourceFile.fileName));
        const recorder = {
            addClassTodo(node, message) {
                treeRecorder.insertRight(node.getStart(), `// TODO: ${message}\n`);
            },
            addClassDecorator(node, text) {
                // New imports should be inserted at the left while decorators should be inserted
                // at the right in order to ensure that imports are inserted before the decorator
                // if the start position of import and decorator is the source file start.
                treeRecorder.insertRight(node.getStart(), `${text}\n`);
            },
            addNewImport(start, importText) {
                // New imports should be inserted at the left while decorators should be inserted
                // at the right in order to ensure that imports are inserted before the decorator
                // if the start position of import and decorator is the source file start.
                treeRecorder.insertLeft(start, importText);
            },
            updateExistingImport(namedBindings, newNamedBindings) {
                treeRecorder.remove(namedBindings.getStart(), namedBindings.getWidth());
                treeRecorder.insertRight(namedBindings.getStart(), newNamedBindings);
            },
            commitUpdate() {
                tree.commitUpdate(treeRecorder);
            }
        };
        updateRecorders.set(sourceFile, recorder);
        return recorder;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy91bmRlY29yYXRlZC1jbGFzc2VzLXdpdGgtZGVjb3JhdGVkLWZpZWxkcy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQXlCLG1CQUFtQixHQUFRLE1BQU0sNEJBQTRCLENBQUM7QUFDOUYsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUM5QixPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRSxPQUFPLEVBQUMsY0FBYyxFQUFFLHNCQUFzQixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFFNUYsT0FBTyxFQUFDLDhDQUE4QyxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBRzNFOzs7R0FHRztBQUNILE1BQU0sQ0FBQyxPQUFPO0lBQ1osT0FBTyxDQUFDLElBQVUsRUFBRSxHQUFxQixFQUFFLEVBQUU7UUFDM0MsTUFBTSxFQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUMsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5RCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDL0IsTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLFVBQVUsRUFBRSxHQUFHLFNBQVMsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUU5QixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRTtZQUNwQixNQUFNLElBQUksbUJBQW1CLENBQ3pCLDJGQUEyRixDQUFDLENBQUM7U0FDbEc7UUFFRCxLQUFLLE1BQU0sWUFBWSxJQUFJLFFBQVEsRUFBRTtZQUNuQyxRQUFRLENBQUMsSUFBSSxD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QixDQUFDLElBQXlCLEVBQUUsSUFBWTtnQkFDdkQsaUZBQWlGO2dCQUNqRixpRkFBaUY7Z0JBQ2pGLDBFQUEwRTtnQkFDMUUsWUFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDO1lBQ3pELENBQUM7WUFDRCxZQUFZLENBQUMsS0FBYSxFQUFFLFVBQWtCO2dCQUM1QyxpRkFBaUY7Z0JBQ2pGLGlGQUFpRjtnQkFDakYsMEVBQTBFO2dCQUMxRSxZQUFZLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztZQUM3QyxDQUFDO1lBQ0Qsb0JBQW9CLENBQUMsYUFBOEIsRUFBRSxnQkFBd0I7Z0JBQzNFLFlBQVksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUN4RSxZQUFZLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7WUFDRCxZQUFZO2dCQUNWLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDbEMsQ0FBQztTQUNGLENBQUM7UUFDRixlQUFlLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQyxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1J1bGUsIFNjaGVtYXRpY0NvbnRleHQsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFRyZWUsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge3JlbGF0aXZlfSBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2dldFByb2plY3RUc0NvbmZpZ1BhdGhzfSBmcm9tICcuLi8uLi91dGlscy9wcm9qZWN0X3RzY29uZmlnX3BhdGhzJztcbmltcG9ydCB7Y2FuTWlncmF0ZUZpbGUsIGNyZWF0ZU1pZ3JhdGlvblByb2dyYW19IGZyb20gJy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvY29tcGlsZXJfaG9zdCc7XG5cbmltcG9ydCB7VW5kZWNvcmF0ZWRDbGFzc2VzV2l0aERlY29yYXRlZEZpZWxkc1RyYW5zZm9ybX0gZnJvbSAnLi90cmFuc2Zvcm0nO1xuaW1wb3J0IHtVcGRhdGVSZWNvcmRlcn0gZnJvbSAnLi91cGRhdGVfcmVjb3JkZXInO1xuXG4vKipcbiAqIE1pZ3JhdGlvbiB0aGF0IGFkZHMgYW4gQW5ndWxhciBkZWNvcmF0b3IgdG8gY2xhc3NlcyB0aGF0IGhhdmUgQW5ndWxhciBmaWVsZCBkZWNvcmF0b3JzLlxuICogaHR0cHM6Ly9oYWNrbWQuaW8vdnVRZmF2emZSRzZLVUN0VTdvS19FQVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbigpOiBSdWxlIHtcbiAgcmV0dXJuICh0cmVlOiBUcmVlLCBjdHg6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB7YnVpbGRQYXRocywgdGVzdFBhdGhzfSA9IGdldFByb2plY3RUc0NvbmZpZ1BhdGhzKHRyZWUpO1xuICAgIGNvbnN0IGJhc2VQYXRoID0gcHJvY2Vzcy5jd2QoKTtcbiAgICBjb25zdCBhbGxQYXRocyA9IFsuLi5idWlsZFBhdGhzLCAuLi50ZXN0UGF0aHNdO1xuICAgIGNvbnN0IGZhaWx1cmVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgaWYgKCFhbGxQYXRocy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKFxuICAgICAgICAgICdDb3VsZCBub3QgZmluZCBhbnkgdHNjb25maWcgZmlsZS4gQ2Fubm90IGFkZCBhbiBBbmd1bGFyIGRlY29yYXRvciB0byB1bmRlY29yYXRlZCBjbGFzc2VzLicpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgdHNjb25maWdQYXRoIG9mIGFsbFBhdGhzKSB7XG4gICAgICBmYWlsdXJlcy5wdXNoKC4uLnJ1blVuZGVjb3JhdGVkQ2xhc3Nlc01pZ3JhdGlvbih0cmVlLCB0c2NvbmZpZ1BhdGgsIGJhc2VQYXRoKSk7XG4gICAgfVxuXG4gICAgaWYgKGZhaWx1cmVzLmxlbmd0aCkge1xuICAgICAgY3R4LmxvZ2dlci5pbmZvKCdDb3VsZCBub3QgbWlncmF0ZSBhbGwgdW5kZWNvcmF0ZWQgY2xhc3NlcyB0aGF0IHVzZSBBbmd1bGFyIGZlYXR1cmVzLicpO1xuICAgICAgY3R4LmxvZ2dlci5pbmZvKCdQbGVhc2UgbWFudWFsbHkgZml4IHRoZSBmb2xsb3dpbmcgZmFpbHVyZXM6Jyk7XG4gICAgICBmYWlsdXJlcy5mb3JFYWNoKG1lc3NhZ2UgPT4gY3R4LmxvZ2dlci53YXJuKGDirpEgICAke21lc3NhZ2V9YCkpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gcnVuVW5kZWNvcmF0ZWRDbGFzc2VzTWlncmF0aW9uKFxuICAgIHRyZWU6IFRyZWUsIHRzY29uZmlnUGF0aDogc3RyaW5nLCBiYXNlUGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBmYWlsdXJlczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qge3Byb2dyYW19ID0gY3JlYXRlTWlncmF0aW9uUHJvZ3JhbSh0cmVlLCB0c2NvbmZpZ1BhdGgsIGJhc2VQYXRoKTtcbiAgY29uc3QgdHlwZUNoZWNrZXIgPSBwcm9ncmFtLmdldFR5cGVDaGVja2VyKCk7XG4gIGNvbnN0IHNvdXJjZUZpbGVzID1cbiAgICAgIHByb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoc291cmNlRmlsZSA9PiBjYW5NaWdyYXRlRmlsZShiYXNlUGF0aCwgc291cmNlRmlsZSwgcHJvZ3JhbSkpO1xuICBjb25zdCB1cGRhdGVSZWNvcmRlcnMgPSBuZXcgTWFwPHRzLlNvdXJjZUZpbGUsIFVwZGF0ZVJlY29yZGVyPigpO1xuICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgbmV3IFVuZGVjb3JhdGVkQ2xhc3Nlc1dpdGhEZWNvcmF0ZWRGaWVsZHNUcmFuc2Zvcm0odHlwZUNoZWNrZXIsIGdldFVwZGF0ZVJlY29yZGVyKTtcblxuICAvLyBNaWdyYXRlIGFsbCBzb3VyY2UgZmlsZXMgaW4gdGhlIHByb2plY3QuXG4gIHRyYW5zZm9ybS5taWdyYXRlKHNvdXJjZUZpbGVzKS5mb3JFYWNoKCh7bm9kZSwgbWVzc2FnZX0pID0+IHtcbiAgICBjb25zdCBub2RlU291cmNlRmlsZSA9IG5vZGUuZ2V0U291cmNlRmlsZSgpO1xuICAgIGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSByZWxhdGl2ZShiYXNlUGF0aCwgbm9kZVNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICAgIGNvbnN0IHtsaW5lLCBjaGFyYWN0ZXJ9ID1cbiAgICAgICAgdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24obm9kZS5nZXRTb3VyY2VGaWxlKCksIG5vZGUuZ2V0U3RhcnQoKSk7XG4gICAgZmFpbHVyZXMucHVzaChgJHtyZWxhdGl2ZUZpbGVQYXRofUAke2xpbmUgKyAxfToke2NoYXJhY3RlciArIDF9OiAke21lc3NhZ2V9YCk7XG4gIH0pO1xuXG4gIC8vIFJlY29yZCB0aGUgY2hhbmdlcyBjb2xsZWN0ZWQgaW4gdGhlIGltcG9ydCBtYW5hZ2VyLlxuICB0cmFuc2Zvcm0ucmVjb3JkQ2hhbmdlcygpO1xuXG4gIC8vIFdhbGsgdGhyb3VnaCBlYWNoIHVwZGF0ZSByZWNvcmRlciBhbmQgY29tbWl0IHRoZSB1cGRhdGUuIFdlIG5lZWQgdG8gY29tbWl0IHRoZVxuICAvLyB1cGRhdGVzIGluIGJhdGNoZXMgcGVyIHNvdXJjZSBmaWxlIGFzIHRoZXJlIGNhbiBiZSBvbmx5IG9uZSByZWNvcmRlciBwZXIgc291cmNlXG4gIC8vIGZpbGUgaW4gb3JkZXIgdG8gYXZvaWQgc2hpZnRlZCBjaGFyYWN0ZXIgb2Zmc2V0cy5cbiAgdXBkYXRlUmVjb3JkZXJzLmZvckVhY2gocmVjb3JkZXIgPT4gcmVjb3JkZXIuY29tbWl0VXBkYXRlKCkpO1xuXG4gIHJldHVybiBmYWlsdXJlcztcblxuICAvKiogR2V0cyB0aGUgdXBkYXRlIHJlY29yZGVyIGZvciB0aGUgc3BlY2lmaWVkIHNvdXJjZSBmaWxlLiAqL1xuICBmdW5jdGlvbiBnZXRVcGRhdGVSZWNvcmRlcihzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogVXBkYXRlUmVjb3JkZXIge1xuICAgIGlmICh1cGRhdGVSZWNvcmRlcnMuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICByZXR1cm4gdXBkYXRlUmVjb3JkZXJzLmdldChzb3VyY2VGaWxlKSE7XG4gICAgfVxuICAgIGNvbnN0IHRyZWVSZWNvcmRlciA9IHRyZWUuYmVnaW5VcGRhdGUocmVsYXRpdmUoYmFzZVBhdGgsIHNvdXJjZUZpbGUuZmlsZU5hbWUpKTtcbiAgICBjb25zdCByZWNvcmRlcjogVXBkYXRlUmVjb3JkZXIgPSB7XG4gICAgICBhZGRDbGFzc1RvZG8obm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbiwgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgICAgIHRyZWVSZWNvcmRlci5pbnNlcnRSaWdodChub2RlLmdldFN0YXJ0KCksIGAvLyBUT0RPOiAke21lc3NhZ2V9XFxuYCk7XG4gICAgICB9LFxuICAgICAgYWRkQ2xhc3NEZWNvcmF0b3Iobm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbiwgdGV4dDogc3RyaW5nKSB7XG4gICAgICAgIC8vIE5ldyBpbXBvcnRzIHNob3VsZCBiZSBpbnNlcnRlZCBhdCB0aGUgbGVmdCB3aGlsZSBkZWNvcmF0b3JzIHNob3VsZCBiZSBpbnNlcnRlZFxuICAgICAgICAvLyBhdCB0aGUgcmlnaHQgaW4gb3JkZXIgdG8gZW5zdXJlIHRoYXQgaW1wb3J0cyBhcmUgaW5zZXJ0ZWQgYmVmb3JlIHRoZSBkZWNvcmF0b3JcbiAgICAgICAgLy8gaWYgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIGltcG9ydCBhbmQgZGVjb3JhdG9yIGlzIHRoZSBzb3VyY2UgZmlsZSBzdGFydC5cbiAgICAgICAgdHJlZVJlY29yZGVyLmluc2VydFJpZ2h0KG5vZGUuZ2V0U3RhcnQoKSwgYCR7dGV4dH1cXG5gKTtcbiAgICAgIH0sXG4gICAgICBhZGROZXdJbXBvcnQoc3RhcnQ6IG51bWJlciwgaW1wb3J0VGV4dDogc3RyaW5nKSB7XG4gICAgICAgIC8vIE5ldyBpbXBvcnRzIHNob3VsZCBiZSBpbnNlcnRlZCBhdCB0aGUgbGVmdCB3aGlsZSBkZWNvcmF0b3JzIHNob3VsZCBiZSBpbnNlcnRlZFxuICAgICAgICAvLyBhdCB0aGUgcmlnaHQgaW4gb3JkZXIgdG8gZW5zdXJlIHRoYXQgaW1wb3J0cyBhcmUgaW5zZXJ0ZWQgYmVmb3JlIHRoZSBkZWNvcmF0b3JcbiAgICAgICAgLy8gaWYgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIGltcG9ydCBhbmQgZGVjb3JhdG9yIGlzIHRoZSBzb3VyY2UgZmlsZSBzdGFydC5cbiAgICAgICAgdHJlZVJlY29yZGVyLmluc2VydExlZnQoc3RhcnQsIGltcG9ydFRleHQpO1xuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4aXN0aW5nSW1wb3J0KG5hbWVkQmluZGluZ3M6IHRzLk5hbWVkSW1wb3J0cywgbmV3TmFtZWRCaW5kaW5nczogc3RyaW5nKSB7XG4gICAgICAgIHRyZWVSZWNvcmRlci5yZW1vdmUobmFtZWRCaW5kaW5ncy5nZXRTdGFydCgpLCBuYW1lZEJpbmRpbmdzLmdldFdpZHRoKCkpO1xuICAgICAgICB0cmVlUmVjb3JkZXIuaW5zZXJ0UmlnaHQobmFtZWRCaW5kaW5ncy5nZXRTdGFydCgpLCBuZXdOYW1lZEJpbmRpbmdzKTtcbiAgICAgIH0sXG4gICAgICBjb21taXRVcGRhdGUoKSB7XG4gICAgICAgIHRyZWUuY29tbWl0VXBkYXRlKHRyZWVSZWNvcmRlcik7XG4gICAgICB9XG4gICAgfTtcbiAgICB1cGRhdGVSZWNvcmRlcnMuc2V0KHNvdXJjZUZpbGUsIHJlY29yZGVyKTtcbiAgICByZXR1cm4gcmVjb3JkZXI7XG4gIH1cbn1cbiJdfQ==