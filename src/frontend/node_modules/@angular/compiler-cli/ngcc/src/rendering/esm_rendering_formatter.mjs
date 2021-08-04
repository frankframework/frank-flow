import * as ts from 'typescript';
import { absoluteFromSourceFile, toRelativeImport } from '../../../src/ngtsc/file_system';
import { translateStatement } from '../../../src/ngtsc/translator';
import { isDtsPath } from '../../../src/ngtsc/util/src/typescript';
import { getContainingStatement, isAssignment } from '../host/esm2015_host';
import { POST_R3_MARKER, PRE_R3_MARKER } from '../host/ngcc_host';
import { stripExtension } from './utils';
/**
 * A RenderingFormatter that works with ECMAScript Module import and export statements.
 */
export class EsmRenderingFormatter {
    constructor(fs, host, isCore) {
        this.fs = fs;
        this.host = host;
        this.isCore = isCore;
        this.printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    }
    /**
     *  Add the imports at the top of the file, after any imports that are already there.
     */
    addImports(output, imports, sf) {
        if (imports.length === 0) {
            return;
        }
        const insertionPoint = this.findEndOfImports(sf);
        const renderedImports = imports.map(i => `import * as ${i.qualifier.text} from '${i.specifier}';\n`).join('');
        output.appendLeft(insertionPoint, renderedImports);
    }
    /**
     * Add the exports to the end of the file.
     */
    addExports(output, entryPointBasePath, exports, importManager, file) {
        exports.forEach(e => {
            let exportFrom = '';
            const isDtsFile = isDtsPath(entryPointBasePath);
            const from = isDtsFile ? e.dtsFrom : e.from;
            if (from) {
                const basePath = stripExtension(from);
                const relativePath = this.fs.relative(this.fs.dirname(entryPointBasePath), basePath);
                const relativeImport = toRelativeImport(relativePath);
                exportFrom = entryPointBasePath !== basePath ? ` from '${relativeImport}'` : '';
            }
            const exportStr = `\nexport {${e.identifier}}${exportFrom};`;
            output.append(exportStr);
        });
    }
    /**
     * Add plain exports to the end of the file.
     *
     * Unlike `addExports`, direct exports go directly in a .js and .d.ts file and don't get added to
     * an entrypoint.
     */
    addDirectExports(output, exports, importManager, file) {
        for (const e of exports) {
            const exportStatement = `\nexport {${e.symbolName} as ${e.asAlias}} from '${e.fromModule}';`;
            output.append(exportStatement);
        }
    }
    /**
     * Add the constants directly after the imports.
     */
    addConstants(output, constants, file) {
        if (constants === '') {
            return;
        }
        const insertionPoint = this.findEndOfImports(file);
        // Append the constants to the right of the insertion point, to ensure they get ordered after
        // added imports (those are appended left to the insertion point).
        output.appendRight(insertionPoint, '\n' + constants + '\n');
    }
    /**
     * Add the definitions directly after their decorated class.
     */
    addDefinitions(output, compiledClass, definitions) {
        const classSymbol = this.host.getClassSymbol(compiledClass.declaration);
        if (!classSymbol) {
            throw new Error(`Compiled class does not have a valid symbol: ${compiledClass.name}`);
        }
        const declarationStatement = getContainingStatement(classSymbol.implementation.valueDeclaration);
        const insertionPoint = declarationStatement.getEnd();
        output.appendLeft(insertionPoint, '\n' + definitions);
    }
    /**
     * Add the adjacent statements after all static properties of the class.
     */
    addAdjacentStatements(output, compiledClass, statements) {
        const classSymbol = this.host.getClassSymbol(compiledClass.declaration);
        if (!classSymbol) {
            throw new Error(`Compiled class does not have a valid symbol: ${compiledClass.name}`);
        }
        const endOfClass = this.host.getEndOfClass(classSymbol);
        output.appendLeft(endOfClass.getEnd(), '\n' + statements);
    }
    /**
     * Remove static decorator properties from classes.
     */
    removeDecorators(output, decoratorsToRemove) {
        decoratorsToRemove.forEach((nodesToRemove, containerNode) => {
            if (ts.isArrayLiteralExpression(containerNode)) {
                const items = containerNode.elements;
                if (items.length === nodesToRemove.length) {
                    // Remove the entire statement
                    const statement = findStatement(containerNode);
                    if (statement) {
                        if (ts.isExpressionStatement(statement)) {
                            // The statement looks like: `SomeClass = __decorate(...);`
                            // Remove it completely
                            output.remove(statement.getFullStart(), statement.getEnd());
                        }
                        else if (ts.isReturnStatement(statement) && statement.expression &&
                            isAssignment(statement.expression)) {
                            // The statement looks like: `return SomeClass = __decorate(...);`
                            // We only want to end up with: `return SomeClass;`
                            const startOfRemoval = statement.expression.left.getEnd();
                            const endOfRemoval = getEndExceptSemicolon(statement);
                            output.remove(startOfRemoval, endOfRemoval);
                        }
                    }
                }
                else {
                    nodesToRemove.forEach(node => {
                        // remove any trailing comma
                        const nextSibling = getNextSiblingInArray(node, items);
                        let end;
                        if (nextSibling !== null &&
                            output.slice(nextSibling.getFullStart() - 1, nextSibling.getFullStart()) === ',') {
                            end = nextSibling.getFullStart() - 1 + nextSibling.getLeadingTriviaWidth();
                        }
                        else if (output.slice(node.getEnd(), node.getEnd() + 1) === ',') {
                            end = node.getEnd() + 1;
                        }
                        else {
                            end = node.getEnd();
                        }
                        output.remove(node.getFullStart(), end);
                    });
                }
            }
        });
    }
    /**
     * Rewrite the IVY switch markers to indicate we are in IVY mode.
     */
    rewriteSwitchableDeclarations(outputText, sourceFile, declarations) {
        declarations.forEach(declaration => {
            const start = declaration.initializer.getStart();
            const end = declaration.initializer.getEnd();
            const replacement = declaration.initializer.text.replace(PRE_R3_MARKER, POST_R3_MARKER);
            outputText.overwrite(start, end, replacement);
        });
    }
    /**
     * Add the type parameters to the appropriate functions that return `ModuleWithProviders`
     * structures.
     *
     * This function will only get called on typings files.
     */
    addModuleWithProvidersParams(outputText, moduleWithProviders, importManager) {
        moduleWithProviders.forEach(info => {
            const ngModuleName = info.ngModule.node.name.text;
            const declarationFile = absoluteFromSourceFile(info.declaration.getSourceFile());
            const ngModuleFile = absoluteFromSourceFile(info.ngModule.node.getSourceFile());
            const relativePath = this.fs.relative(this.fs.dirname(declarationFile), ngModuleFile);
            const relativeImport = toRelativeImport(relativePath);
            const importPath = info.ngModule.ownedByModuleGuess ||
                (declarationFile !== ngModuleFile ? stripExtension(relativeImport) : null);
            const ngModule = generateImportString(importManager, importPath, ngModuleName);
            if (info.declaration.type) {
                const typeName = info.declaration.type && ts.isTypeReferenceNode(info.declaration.type) ?
                    info.declaration.type.typeName :
                    null;
                if (this.isCoreModuleWithProvidersType(typeName)) {
                    // The declaration already returns `ModuleWithProvider` but it needs the `NgModule` type
                    // parameter adding.
                    outputText.overwrite(info.declaration.type.getStart(), info.declaration.type.getEnd(), `ModuleWithProviders<${ngModule}>`);
                }
                else {
                    // The declaration returns an unknown type so we need to convert it to a union that
                    // includes the ngModule property.
                    const originalTypeString = info.declaration.type.getText();
                    outputText.overwrite(info.declaration.type.getStart(), info.declaration.type.getEnd(), `(${originalTypeString})&{ngModule:${ngModule}}`);
                }
            }
            else {
                // The declaration has no return type so provide one.
                const lastToken = info.declaration.getLastToken();
                const insertPoint = lastToken && lastToken.kind === ts.SyntaxKind.SemicolonToken ?
                    lastToken.getStart() :
                    info.declaration.getEnd();
                outputText.appendLeft(insertPoint, `: ${generateImportString(importManager, '@angular/core', 'ModuleWithProviders')}<${ngModule}>`);
            }
        });
    }
    /**
     * Convert a `Statement` to JavaScript code in a format suitable for rendering by this formatter.
     *
     * @param stmt The `Statement` to print.
     * @param sourceFile A `ts.SourceFile` that provides context for the statement. See
     *     `ts.Printer#printNode()` for more info.
     * @param importManager The `ImportManager` to use for managing imports.
     *
     * @return The JavaScript code corresponding to `stmt` (in the appropriate format).
     */
    printStatement(stmt, sourceFile, importManager) {
        const node = translateStatement(stmt, importManager);
        const code = this.printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
        return code;
    }
    findEndOfImports(sf) {
        for (const stmt of sf.statements) {
            if (!ts.isImportDeclaration(stmt) && !ts.isImportEqualsDeclaration(stmt) &&
                !ts.isNamespaceImport(stmt)) {
                return stmt.getStart();
            }
        }
        return 0;
    }
    /**
     * Check whether the given type is the core Angular `ModuleWithProviders` interface.
     * @param typeName The type to check.
     * @returns true if the type is the core Angular `ModuleWithProviders` interface.
     */
    isCoreModuleWithProvidersType(typeName) {
        const id = typeName && ts.isIdentifier(typeName) ? this.host.getImportOfIdentifier(typeName) : null;
        return (id && id.name === 'ModuleWithProviders' && (this.isCore || id.from === '@angular/core'));
    }
}
function findStatement(node) {
    while (node) {
        if (ts.isExpressionStatement(node) || ts.isReturnStatement(node)) {
            return node;
        }
        node = node.parent;
    }
    return undefined;
}
function generateImportString(importManager, importPath, importName) {
    const importAs = importPath ? importManager.generateNamedImport(importPath, importName) : null;
    return importAs && importAs.moduleImport ? `${importAs.moduleImport.text}.${importAs.symbol}` :
        `${importName}`;
}
function getNextSiblingInArray(node, array) {
    const index = array.indexOf(node);
    return index !== -1 && array.length > index + 1 ? array[index + 1] : null;
}
function getEndExceptSemicolon(statement) {
    const lastToken = statement.getLastToken();
    return (lastToken && lastToken.kind === ts.SyntaxKind.SemicolonToken) ? statement.getEnd() - 1 :
        statement.getEnd();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtX3JlbmRlcmluZ19mb3JtYXR0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvcmVuZGVyaW5nL2VzbV9yZW5kZXJpbmdfZm9ybWF0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVNBLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxzQkFBc0IsRUFBb0MsZ0JBQWdCLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUUxSCxPQUFPLEVBQXdCLGtCQUFrQixFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDeEYsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBSWpFLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSxZQUFZLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUMxRSxPQUFPLEVBQXFCLGNBQWMsRUFBRSxhQUFhLEVBQWdDLE1BQU0sbUJBQW1CLENBQUM7QUFHbkgsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV2Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxxQkFBcUI7SUFHaEMsWUFDYyxFQUFvQixFQUFZLElBQXdCLEVBQ3hELE1BQWU7UUFEZixPQUFFLEdBQUYsRUFBRSxDQUFrQjtRQUFZLFNBQUksR0FBSixJQUFJLENBQW9CO1FBQ3hELFdBQU0sR0FBTixNQUFNLENBQVM7UUFKbkIsWUFBTyxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBSXpDLENBQUM7SUFFakM7O09BRUc7SUFDSCxVQUFVLENBQUMsTUFBbUIsRUFBRSxPQUFpQixFQUFFLEVBQWlCO1FBQ2xFLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDeEIsT0FBTztTQUNSO1FBRUQsTUFB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LEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDL0YsT0FBTyxRQUFRLElBQUksUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNwRCxHQUFHLFVBQVUsRUFBRSxDQUFDO0FBQzdELENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUFvQixJQUFPLEVBQUUsS0FBc0I7SUFDL0UsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsQyxPQUFPLEtBQUssS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUM1RSxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxTQUF1QjtJQUNwRCxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDM0MsT0FBTyxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN4QixTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDN0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtTdGF0ZW1lbnR9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCBNYWdpY1N0cmluZyBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7YWJzb2x1dGVGcm9tU291cmNlRmlsZSwgQWJzb2x1dGVGc1BhdGgsIFBhdGhNYW5pcHVsYXRpb24sIHRvUmVsYXRpdmVJbXBvcnR9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge1JlZXhwb3J0fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvaW1wb3J0cyc7XG5pbXBvcnQge0ltcG9ydCwgSW1wb3J0TWFuYWdlciwgdHJhbnNsYXRlU3RhdGVtZW50fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvdHJhbnNsYXRvcic7XG5pbXBvcnQge2lzRHRzUGF0aH0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtNb2R1bGVXaXRoUHJvdmlkZXJzSW5mb30gZnJvbSAnLi4vYW5hbHlzaXMvbW9kdWxlX3dpdGhfcHJvdmlkZXJzX2FuYWx5emVyJztcbmltcG9ydCB7RXhwb3J0SW5mb30gZnJvbSAnLi4vYW5hbHlzaXMvcHJpdmF0ZV9kZWNsYXJhdGlvbnNfYW5hbHl6ZXInO1xuaW1wb3J0IHtDb21waWxlZENsYXNzfSBmcm9tICcuLi9hbmFseXNpcy90eXBlcyc7XG5pbXBvcnQge2dldENvbnRhaW5pbmdTdGF0ZW1lbnQsIGlzQXNzaWdubWVudH0gZnJvbSAnLi4vaG9zdC9lc20yMDE1X2hvc3QnO1xuaW1wb3J0IHtOZ2NjUmVmbGVjdGlvbkhvc3QsIFBPU1RfUjNfTUFSS0VSLCBQUkVfUjNfTUFSS0VSLCBTd2l0Y2hhYmxlVmFyaWFibGVEZWNsYXJhdGlvbn0gZnJvbSAnLi4vaG9zdC9uZ2NjX2hvc3QnO1xuXG5pbXBvcnQge1JlZHVuZGFudERlY29yYXRvck1hcCwgUmVuZGVyaW5nRm9ybWF0dGVyfSBmcm9tICcuL3JlbmRlcmluZ19mb3JtYXR0ZXInO1xuaW1wb3J0IHtzdHJpcEV4dGVuc2lvbn0gZnJvbSAnLi91dGlscyc7XG5cbi8qKlxuICogQSBSZW5kZXJpbmdGb3JtYXR0ZXIgdGhhdCB3b3JrcyB3aXRoIEVDTUFTY3JpcHQgTW9kdWxlIGltcG9ydCBhbmQgZXhwb3J0IHN0YXRlbWVudHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBFc21SZW5kZXJpbmdGb3JtYXR0ZXIgaW1wbGVtZW50cyBSZW5kZXJpbmdGb3JtYXR0ZXIge1xuICBwcm90ZWN0ZWQgcHJpbnRlciA9IHRzLmNyZWF0ZVByaW50ZXIoe25ld0xpbmU6IHRzLk5ld0xpbmVLaW5kLkxpbmVGZWVkfSk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcm90ZWN0ZWQgZnM6IFBhdGhNYW5pcHVsYXRpb24sIHByb3RlY3RlZCBob3N0OiBOZ2NjUmVmbGVjdGlvbkhvc3QsXG4gICAgICBwcm90ZWN0ZWQgaXNDb3JlOiBib29sZWFuKSB7fVxuXG4gIC8qKlxuICAgKiAgQWRkIHRoZSBpbXBvcnRzIGF0IHRoZSB0b3Agb2YgdGhlIGZpbGUsIGFmdGVyIGFueSBpbXBvcnRzIHRoYXQgYXJlIGFscmVhZHkgdGhlcmUuXG4gICAqL1xuICBhZGRJbXBvcnRzKG91dHB1dDogTWFnaWNTdHJpbmcsIGltcG9ydHM6IEltcG9ydFtdLCBzZjogdHMuU291cmNlRmlsZSk6IHZvaWQge1xuICAgIGlmIChpbXBvcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGluc2VydGlvblBvaW50ID0gdGhpcy5maW5kRW5kT2ZJbXBvcnRzKHNmKTtcbiAgICBjb25zdCByZW5kZXJlZEltcG9ydHMgPVxuICAgICAgICBpbXBvcnRzLm1hcChpID0+IGBpbXBvcnQgKiBhcyAke2kucXVhbGlmaWVyLnRleHR9IGZyb20gJyR7aS5zcGVjaWZpZXJ9JztcXG5gKS5qb2luKCcnKTtcbiAgICBvdXRwdXQuYXBwZW5kTGVmdChpbnNlcnRpb25Qb2ludCwgcmVuZGVyZWRJbXBvcnRzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgdGhlIGV4cG9ydHMgdG8gdGhlIGVuZCBvZiB0aGUgZmlsZS5cbiAgICovXG4gIGFkZEV4cG9ydHMoXG4gICAgICBvdXRwdXQ6IE1hZ2ljU3RyaW5nLCBlbnRyeVBvaW50QmFzZVBhdGg6IEFic29sdXRlRnNQYXRoLCBleHBvcnRzOiBFeHBvcnRJbmZvW10sXG4gICAgICBpbXBvcnRNYW5hZ2VyOiBJbXBvcnRNYW5hZ2VyLCBmaWxlOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgZXhwb3J0cy5mb3JFYWNoKGUgPT4ge1xuICAgICAgbGV0IGV4cG9ydEZyb20gPSAnJztcbiAgICAgIGNvbnN0IGlzRHRzRmlsZSA9IGlzRHRzUGF0aChlbnRyeVBvaW50QmFzZVBhdGgpO1xuICAgICAgY29uc3QgZnJvbSA9IGlzRHRzRmlsZSA/IGUuZHRzRnJvbSA6IGUuZnJvbTtcblxuICAgICAgaWYgKGZyb20pIHtcbiAgICAgICAgY29uc3QgYmFzZVBhdGggPSBzdHJpcEV4dGVuc2lvbihmcm9tKTtcbiAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gdGhpcy5mcy5yZWxhdGl2ZSh0aGlzLmZzLmRpcm5hbWUoZW50cnlQb2ludEJhc2VQYXRoKSwgYmFzZVBhdGgpO1xuICAgICAgICBjb25zdCByZWxhdGl2ZUltcG9ydCA9IHRvUmVsYXRpdmVJbXBvcnQocmVsYXRpdmVQYXRoKTtcbiAgICAgICAgZXhwb3J0RnJvbSA9IGVudHJ5UG9pbnRCYXNlUGF0aCAhPT0gYmFzZVBhdGggPyBgIGZyb20gJyR7cmVsYXRpdmVJbXBvcnR9J2AgOiAnJztcbiAgICAgIH1cblxuICAgICAgY29uc3QgZXhwb3J0U3RyID0gYFxcbmV4cG9ydCB7JHtlLmlkZW50aWZpZXJ9fSR7ZXhwb3J0RnJvbX07YDtcbiAgICAgIG91dHB1dC5hcHBlbmQoZXhwb3J0U3RyKTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFkZCBwbGFpbiBleHBvcnRzIHRvIHRoZSBlbmQgb2YgdGhlIGZpbGUuXG4gICAqXG4gICAqIFVubGlrZSBgYWRkRXhwb3J0c2AsIGRpcmVjdCBleHBvcnRzIGdvIGRpcmVjdGx5IGluIGEgLmpzIGFuZCAuZC50cyBmaWxlIGFuZCBkb24ndCBnZXQgYWRkZWQgdG9cbiAgICogYW4gZW50cnlwb2ludC5cbiAgICovXG4gIGFkZERpcmVjdEV4cG9ydHMoXG4gICAgICBvdXRwdXQ6IE1hZ2ljU3RyaW5nLCBleHBvcnRzOiBSZWV4cG9ydFtdLCBpbXBvcnRNYW5hZ2VyOiBJbXBvcnRNYW5hZ2VyLFxuICAgICAgZmlsZTogdHMuU291cmNlRmlsZSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgZSBvZiBleHBvcnRzKSB7XG4gICAgICBjb25zdCBleHBvcnRTdGF0ZW1lbnQgPSBgXFxuZXhwb3J0IHske2Uuc3ltYm9sTmFtZX0gYXMgJHtlLmFzQWxpYXN9fSBmcm9tICcke2UuZnJvbU1vZHVsZX0nO2A7XG4gICAgICBvdXRwdXQuYXBwZW5kKGV4cG9ydFN0YXRlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgY29uc3RhbnRzIGRpcmVjdGx5IGFmdGVyIHRoZSBpbXBvcnRzLlxuICAgKi9cbiAgYWRkQ29uc3RhbnRzKG91dHB1dDogTWFnaWNTdHJpbmcsIGNvbnN0YW50czogc3RyaW5nLCBmaWxlOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgaWYgKGNvbnN0YW50cyA9PT0gJycpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgaW5zZXJ0aW9uUG9pbnQgPSB0aGlzLmZpbmRFbmRPZkltcG9ydHMoZmlsZSk7XG5cbiAgICAvLyBBcHBlbmQgdGhlIGNvbnN0YW50cyB0byB0aGUgcmlnaHQgb2YgdGhlIGluc2VydGlvbiBwb2ludCwgdG8gZW5zdXJlIHRoZXkgZ2V0IG9yZGVyZWQgYWZ0ZXJcbiAgICAvLyBhZGRlZCBpbXBvcnRzICh0aG9zZSBhcmUgYXBwZW5kZWQgbGVmdCB0byB0aGUgaW5zZXJ0aW9uIHBvaW50KS5cbiAgICBvdXRwdXQuYXBwZW5kUmlnaHQoaW5zZXJ0aW9uUG9pbnQsICdcXG4nICsgY29uc3RhbnRzICsgJ1xcbicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgZGVmaW5pdGlvbnMgZGlyZWN0bHkgYWZ0ZXIgdGhlaXIgZGVjb3JhdGVkIGNsYXNzLlxuICAgKi9cbiAgYWRkRGVmaW5pdGlvbnMob3V0cHV0OiBNYWdpY1N0cmluZywgY29tcGlsZWRDbGFzczogQ29tcGlsZWRDbGFzcywgZGVmaW5pdGlvbnM6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNsYXNzU3ltYm9sID0gdGhpcy5ob3N0LmdldENsYXNzU3ltYm9sKGNvbXBpbGVkQ2xhc3MuZGVjbGFyYXRpb24pO1xuICAgIGlmICghY2xhc3NTeW1ib2wpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcGlsZWQgY2xhc3MgZG9lcyBub3QgaGF2ZSBhIHZhbGlkIHN5bWJvbDogJHtjb21waWxlZENsYXNzLm5hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IGRlY2xhcmF0aW9uU3RhdGVtZW50ID1cbiAgICAgICAgZ2V0Q29udGFpbmluZ1N0YXRlbWVudChjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uKTtcbiAgICBjb25zdCBpbnNlcnRpb25Qb2ludCA9IGRlY2xhcmF0aW9uU3RhdGVtZW50LmdldEVuZCgpO1xuICAgIG91dHB1dC5hcHBlbmRMZWZ0KGluc2VydGlvblBvaW50LCAnXFxuJyArIGRlZmluaXRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgdGhlIGFkamFjZW50IHN0YXRlbWVudHMgYWZ0ZXIgYWxsIHN0YXRpYyBwcm9wZXJ0aWVzIG9mIHRoZSBjbGFzcy5cbiAgICovXG4gIGFkZEFkamFjZW50U3RhdGVtZW50cyhvdXRwdXQ6IE1hZ2ljU3RyaW5nLCBjb21waWxlZENsYXNzOiBDb21waWxlZENsYXNzLCBzdGF0ZW1lbnRzOiBzdHJpbmcpOlxuICAgICAgdm9pZCB7XG4gICAgY29uc3QgY2xhc3NTeW1ib2wgPSB0aGlzLmhvc3QuZ2V0Q2xhc3NTeW1ib2woY29tcGlsZWRDbGFzcy5kZWNsYXJhdGlvbik7XG4gICAgaWYgKCFjbGFzc1N5bWJvbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21waWxlZCBjbGFzcyBkb2VzIG5vdCBoYXZlIGEgdmFsaWQgc3ltYm9sOiAke2NvbXBpbGVkQ2xhc3MubmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgZW5kT2ZDbGFzcyA9IHRoaXMuaG9zdC5nZXRFbmRPZkNsYXNzKGNsYXNzU3ltYm9sKTtcbiAgICBvdXRwdXQuYXBwZW5kTGVmdChlbmRPZkNsYXNzLmdldEVuZCgpLCAnXFxuJyArIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBzdGF0aWMgZGVjb3JhdG9yIHByb3BlcnRpZXMgZnJvbSBjbGFzc2VzLlxuICAgKi9cbiAgcmVtb3ZlRGVjb3JhdG9ycyhvdXRwdXQ6IE1hZ2ljU3RyaW5nLCBkZWNvcmF0b3JzVG9SZW1vdmU6IFJlZHVuZGFudERlY29yYXRvck1hcCk6IHZvaWQge1xuICAgIGRlY29yYXRvcnNUb1JlbW92ZS5mb3JFYWNoKChub2Rlc1RvUmVtb3ZlLCBjb250YWluZXJOb2RlKSA9PiB7XG4gICAgICBpZiAodHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKGNvbnRhaW5lck5vZGUpKSB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gY29udGFpbmVyTm9kZS5lbGVtZW50cztcbiAgICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gbm9kZXNUb1JlbW92ZS5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBSZW1vdmUgdGhlIGVudGlyZSBzdGF0ZW1lbnRcbiAgICAgICAgICBjb25zdCBzdGF0ZW1lbnQgPSBmaW5kU3RhdGVtZW50KGNvbnRhaW5lck5vZGUpO1xuICAgICAgICAgIGlmIChzdGF0ZW1lbnQpIHtcbiAgICAgICAgICAgIGlmICh0cy5pc0V4cHJlc3Npb25TdGF0ZW1lbnQoc3RhdGVtZW50KSkge1xuICAgICAgICAgICAgICAvLyBUaGUgc3RhdGVtZW50IGxvb2tzIGxpa2U6IGBTb21lQ2xhc3MgPSBfX2RlY29yYXRlKC4uLik7YFxuICAgICAgICAgICAgICAvLyBSZW1vdmUgaXQgY29tcGxldGVseVxuICAgICAgICAgICAgICBvdXRwdXQucmVtb3ZlKHN0YXRlbWVudC5nZXRGdWxsU3RhcnQoKSwgc3RhdGVtZW50LmdldEVuZCgpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICAgICAgdHMuaXNSZXR1cm5TdGF0ZW1lbnQoc3RhdGVtZW50KSAmJiBzdGF0ZW1lbnQuZXhwcmVzc2lvbiAmJlxuICAgICAgICAgICAgICAgIGlzQXNzaWdubWVudChzdGF0ZW1lbnQuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAgICAgLy8gVGhlIHN0YXRlbWVudCBsb29rcyBsaWtlOiBgcmV0dXJuIFNvbWVDbGFzcyA9IF9fZGVjb3JhdGUoLi4uKTtgXG4gICAgICAgICAgICAgIC8vIFdlIG9ubHkgd2FudCB0byBlbmQgdXAgd2l0aDogYHJldHVybiBTb21lQ2xhc3M7YFxuICAgICAgICAgICAgICBjb25zdCBzdGFydE9mUmVtb3ZhbCA9IHN0YXRlbWVudC5leHByZXNzaW9uLmxlZnQuZ2V0RW5kKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGVuZE9mUmVtb3ZhbCA9IGdldEVuZEV4Y2VwdFNlbWljb2xvbihzdGF0ZW1lbnQpO1xuICAgICAgICAgICAgICBvdXRwdXQucmVtb3ZlKHN0YXJ0T2ZSZW1vdmFsLCBlbmRPZlJlbW92YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBub2Rlc1RvUmVtb3ZlLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICAgICAgICAvLyByZW1vdmUgYW55IHRyYWlsaW5nIGNvbW1hXG4gICAgICAgICAgICBjb25zdCBuZXh0U2libGluZyA9IGdldE5leHRTaWJsaW5nSW5BcnJheShub2RlLCBpdGVtcyk7XG4gICAgICAgICAgICBsZXQgZW5kOiBudW1iZXI7XG5cbiAgICAgICAgICAgIGlmIChuZXh0U2libGluZyAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgIG91dHB1dC5zbGljZShuZXh0U2libGluZy5nZXRGdWxsU3RhcnQoKSAtIDEsIG5leHRTaWJsaW5nLmdldEZ1bGxTdGFydCgpKSA9PT0gJywnKSB7XG4gICAgICAgICAgICAgIGVuZCA9IG5leHRTaWJsaW5nLmdldEZ1bGxTdGFydCgpIC0gMSArIG5leHRTaWJsaW5nLmdldExlYWRpbmdUcml2aWFXaWR0aCgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvdXRwdXQuc2xpY2Uobm9kZS5nZXRFbmQoKSwgbm9kZS5nZXRFbmQoKSArIDEpID09PSAnLCcpIHtcbiAgICAgICAgICAgICAgZW5kID0gbm9kZS5nZXRFbmQoKSArIDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlbmQgPSBub2RlLmdldEVuZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb3V0cHV0LnJlbW92ZShub2RlLmdldEZ1bGxTdGFydCgpLCBlbmQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV3cml0ZSB0aGUgSVZZIHN3aXRjaCBtYXJrZXJzIHRvIGluZGljYXRlIHdlIGFyZSBpbiBJVlkgbW9kZS5cbiAgICovXG4gIHJld3JpdGVTd2l0Y2hhYmxlRGVjbGFyYXRpb25zKFxuICAgICAgb3V0cHV0VGV4dDogTWFnaWNTdHJpbmcsIHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsXG4gICAgICBkZWNsYXJhdGlvbnM6IFN3aXRjaGFibGVWYXJpYWJsZURlY2xhcmF0aW9uW10pOiB2b2lkIHtcbiAgICBkZWNsYXJhdGlvbnMuZm9yRWFjaChkZWNsYXJhdGlvbiA9PiB7XG4gICAgICBjb25zdCBzdGFydCA9IGRlY2xhcmF0aW9uLmluaXRpYWxpemVyLmdldFN0YXJ0KCk7XG4gICAgICBjb25zdCBlbmQgPSBkZWNsYXJhdGlvbi5pbml0aWFsaXplci5nZXRFbmQoKTtcbiAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gZGVjbGFyYXRpb24uaW5pdGlhbGl6ZXIudGV4dC5yZXBsYWNlKFBSRV9SM19NQVJLRVIsIFBPU1RfUjNfTUFSS0VSKTtcbiAgICAgIG91dHB1dFRleHQub3ZlcndyaXRlKHN0YXJ0LCBlbmQsIHJlcGxhY2VtZW50KTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgdHlwZSBwYXJhbWV0ZXJzIHRvIHRoZSBhcHByb3ByaWF0ZSBmdW5jdGlvbnMgdGhhdCByZXR1cm4gYE1vZHVsZVdpdGhQcm92aWRlcnNgXG4gICAqIHN0cnVjdHVyZXMuXG4gICAqXG4gICAqIFRoaXMgZnVuY3Rpb24gd2lsbCBvbmx5IGdldCBjYWxsZWQgb24gdHlwaW5ncyBmaWxlcy5cbiAgICovXG4gIGFkZE1vZHVsZVdpdGhQcm92aWRlcnNQYXJhbXMoXG4gICAgICBvdXRwdXRUZXh0OiBNYWdpY1N0cmluZywgbW9kdWxlV2l0aFByb3ZpZGVyczogTW9kdWxlV2l0aFByb3ZpZGVyc0luZm9bXSxcbiAgICAgIGltcG9ydE1hbmFnZXI6IEltcG9ydE1hbmFnZXIpOiB2b2lkIHtcbiAgICBtb2R1bGVXaXRoUHJvdmlkZXJzLmZvckVhY2goaW5mbyA9PiB7XG4gICAgICBjb25zdCBuZ01vZHVsZU5hbWUgPSBpbmZvLm5nTW9kdWxlLm5vZGUubmFtZS50ZXh0O1xuICAgICAgY29uc3QgZGVjbGFyYXRpb25GaWxlID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShpbmZvLmRlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgICBjb25zdCBuZ01vZHVsZUZpbGUgPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKGluZm8ubmdNb2R1bGUubm9kZS5nZXRTb3VyY2VGaWxlKCkpO1xuICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gdGhpcy5mcy5yZWxhdGl2ZSh0aGlzLmZzLmRpcm5hbWUoZGVjbGFyYXRpb25GaWxlKSwgbmdNb2R1bGVGaWxlKTtcbiAgICAgIGNvbnN0IHJlbGF0aXZlSW1wb3J0ID0gdG9SZWxhdGl2ZUltcG9ydChyZWxhdGl2ZVBhdGgpO1xuICAgICAgY29uc3QgaW1wb3J0UGF0aCA9IGluZm8ubmdNb2R1bGUub3duZWRCeU1vZHVsZUd1ZXNzIHx8XG4gICAgICAgICAgKGRlY2xhcmF0aW9uRmlsZSAhPT0gbmdNb2R1bGVGaWxlID8gc3RyaXBFeHRlbnNpb24ocmVsYXRpdmVJbXBvcnQpIDogbnVsbCk7XG4gICAgICBjb25zdCBuZ01vZHVsZSA9IGdlbmVyYXRlSW1wb3J0U3RyaW5nKGltcG9ydE1hbmFnZXIsIGltcG9ydFBhdGgsIG5nTW9kdWxlTmFtZSk7XG5cbiAgICAgIGlmIChpbmZvLmRlY2xhcmF0aW9uLnR5cGUpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSBpbmZvLmRlY2xhcmF0aW9uLnR5cGUgJiYgdHMuaXNUeXBlUmVmZXJlbmNlTm9kZShpbmZvLmRlY2xhcmF0aW9uLnR5cGUpID9cbiAgICAgICAgICAgIGluZm8uZGVjbGFyYXRpb24udHlwZS50eXBlTmFtZSA6XG4gICAgICAgICAgICBudWxsO1xuICAgICAgICBpZiAodGhpcy5pc0NvcmVNb2R1bGVXaXRoUHJvdmlkZXJzVHlwZSh0eXBlTmFtZSkpIHtcbiAgICAgICAgICAvLyBUaGUgZGVjbGFyYXRpb24gYWxyZWFkeSByZXR1cm5zIGBNb2R1bGVXaXRoUHJvdmlkZXJgIGJ1dCBpdCBuZWVkcyB0aGUgYE5nTW9kdWxlYCB0eXBlXG4gICAgICAgICAgLy8gcGFyYW1ldGVyIGFkZGluZy5cbiAgICAgICAgICBvdXRwdXRUZXh0Lm92ZXJ3cml0ZShcbiAgICAgICAgICAgICAgaW5mby5kZWNsYXJhdGlvbi50eXBlLmdldFN0YXJ0KCksIGluZm8uZGVjbGFyYXRpb24udHlwZS5nZXRFbmQoKSxcbiAgICAgICAgICAgICAgYE1vZHVsZVdpdGhQcm92aWRlcnM8JHtuZ01vZHVsZX0+YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVGhlIGRlY2xhcmF0aW9uIHJldHVybnMgYW4gdW5rbm93biB0eXBlIHNvIHdlIG5lZWQgdG8gY29udmVydCBpdCB0byBhIHVuaW9uIHRoYXRcbiAgICAgICAgICAvLyBpbmNsdWRlcyB0aGUgbmdNb2R1bGUgcHJvcGVydHkuXG4gICAgICAgICAgY29uc3Qgb3JpZ2luYWxUeXBlU3RyaW5nID0gaW5mby5kZWNsYXJhdGlvbi50eXBlLmdldFRleHQoKTtcbiAgICAgICAgICBvdXRwdXRUZXh0Lm92ZXJ3cml0ZShcbiAgICAgICAgICAgICAgaW5mby5kZWNsYXJhdGlvbi50eXBlLmdldFN0YXJ0KCksIGluZm8uZGVjbGFyYXRpb24udHlwZS5nZXRFbmQoKSxcbiAgICAgICAgICAgICAgYCgke29yaWdpbmFsVHlwZVN0cmluZ30pJntuZ01vZHVsZToke25nTW9kdWxlfX1gKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIGRlY2xhcmF0aW9uIGhhcyBubyByZXR1cm4gdHlwZSBzbyBwcm92aWRlIG9uZS5cbiAgICAgICAgY29uc3QgbGFzdFRva2VuID0gaW5mby5kZWNsYXJhdGlvbi5nZXRMYXN0VG9rZW4oKTtcbiAgICAgICAgY29uc3QgaW5zZXJ0UG9pbnQgPSBsYXN0VG9rZW4gJiYgbGFzdFRva2VuLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuU2VtaWNvbG9uVG9rZW4gP1xuICAgICAgICAgICAgbGFzdFRva2VuLmdldFN0YXJ0KCkgOlxuICAgICAgICAgICAgaW5mby5kZWNsYXJhdGlvbi5nZXRFbmQoKTtcbiAgICAgICAgb3V0cHV0VGV4dC5hcHBlbmRMZWZ0KFxuICAgICAgICAgICAgaW5zZXJ0UG9pbnQsXG4gICAgICAgICAgICBgOiAke2dlbmVyYXRlSW1wb3J0U3RyaW5nKGltcG9ydE1hbmFnZXIsICdAYW5ndWxhci9jb3JlJywgJ01vZHVsZVdpdGhQcm92aWRlcnMnKX08JHtcbiAgICAgICAgICAgICAgICBuZ01vZHVsZX0+YCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhIGBTdGF0ZW1lbnRgIHRvIEphdmFTY3JpcHQgY29kZSBpbiBhIGZvcm1hdCBzdWl0YWJsZSBmb3IgcmVuZGVyaW5nIGJ5IHRoaXMgZm9ybWF0dGVyLlxuICAgKlxuICAgKiBAcGFyYW0gc3RtdCBUaGUgYFN0YXRlbWVudGAgdG8gcHJpbnQuXG4gICAqIEBwYXJhbSBzb3VyY2VGaWxlIEEgYHRzLlNvdXJjZUZpbGVgIHRoYXQgcHJvdmlkZXMgY29udGV4dCBmb3IgdGhlIHN0YXRlbWVudC4gU2VlXG4gICAqICAgICBgdHMuUHJpbnRlciNwcmludE5vZGUoKWAgZm9yIG1vcmUgaW5mby5cbiAgICogQHBhcmFtIGltcG9ydE1hbmFnZXIgVGhlIGBJbXBvcnRNYW5hZ2VyYCB0byB1c2UgZm9yIG1hbmFnaW5nIGltcG9ydHMuXG4gICAqXG4gICAqIEByZXR1cm4gVGhlIEphdmFTY3JpcHQgY29kZSBjb3JyZXNwb25kaW5nIHRvIGBzdG10YCAoaW4gdGhlIGFwcHJvcHJpYXRlIGZvcm1hdCkuXG4gICAqL1xuICBwcmludFN0YXRlbWVudChzdG10OiBTdGF0ZW1lbnQsIHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsIGltcG9ydE1hbmFnZXI6IEltcG9ydE1hbmFnZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IG5vZGUgPSB0cmFuc2xhdGVTdGF0ZW1lbnQoc3RtdCwgaW1wb3J0TWFuYWdlcik7XG4gICAgY29uc3QgY29kZSA9IHRoaXMucHJpbnRlci5wcmludE5vZGUodHMuRW1pdEhpbnQuVW5zcGVjaWZpZWQsIG5vZGUsIHNvdXJjZUZpbGUpO1xuXG4gICAgcmV0dXJuIGNvZGU7XG4gIH1cblxuICBwcm90ZWN0ZWQgZmluZEVuZE9mSW1wb3J0cyhzZjogdHMuU291cmNlRmlsZSk6IG51bWJlciB7XG4gICAgZm9yIChjb25zdCBzdG10IG9mIHNmLnN0YXRlbWVudHMpIHtcbiAgICAgIGlmICghdHMuaXNJbXBvcnREZWNsYXJhdGlvbihzdG10KSAmJiAhdHMuaXNJbXBvcnRFcXVhbHNEZWNsYXJhdGlvbihzdG10KSAmJlxuICAgICAgICAgICF0cy5pc05hbWVzcGFjZUltcG9ydChzdG10KSkge1xuICAgICAgICByZXR1cm4gc3RtdC5nZXRTdGFydCgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIHRoZSBnaXZlbiB0eXBlIGlzIHRoZSBjb3JlIEFuZ3VsYXIgYE1vZHVsZVdpdGhQcm92aWRlcnNgIGludGVyZmFjZS5cbiAgICogQHBhcmFtIHR5cGVOYW1lIFRoZSB0eXBlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB0cnVlIGlmIHRoZSB0eXBlIGlzIHRoZSBjb3JlIEFuZ3VsYXIgYE1vZHVsZVdpdGhQcm92aWRlcnNgIGludGVyZmFjZS5cbiAgICovXG4gIHByaXZhdGUgaXNDb3JlTW9kdWxlV2l0aFByb3ZpZGVyc1R5cGUodHlwZU5hbWU6IHRzLkVudGl0eU5hbWV8bnVsbCkge1xuICAgIGNvbnN0IGlkID1cbiAgICAgICAgdHlwZU5hbWUgJiYgdHMuaXNJZGVudGlmaWVyKHR5cGVOYW1lKSA/IHRoaXMuaG9zdC5nZXRJbXBvcnRPZklkZW50aWZpZXIodHlwZU5hbWUpIDogbnVsbDtcbiAgICByZXR1cm4gKFxuICAgICAgICBpZCAmJiBpZC5uYW1lID09PSAnTW9kdWxlV2l0aFByb3ZpZGVycycgJiYgKHRoaXMuaXNDb3JlIHx8IGlkLmZyb20gPT09ICdAYW5ndWxhci9jb3JlJykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRTdGF0ZW1lbnQobm9kZTogdHMuTm9kZSk6IHRzLlN0YXRlbWVudHx1bmRlZmluZWQge1xuICB3aGlsZSAobm9kZSkge1xuICAgIGlmICh0cy5pc0V4cHJlc3Npb25TdGF0ZW1lbnQobm9kZSkgfHwgdHMuaXNSZXR1cm5TdGF0ZW1lbnQobm9kZSkpIHtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH1cbiAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVJbXBvcnRTdHJpbmcoXG4gICAgaW1wb3J0TWFuYWdlcjogSW1wb3J0TWFuYWdlciwgaW1wb3J0UGF0aDogc3RyaW5nfG51bGwsIGltcG9ydE5hbWU6IHN0cmluZykge1xuICBjb25zdCBpbXBvcnRBcyA9IGltcG9ydFBhdGggPyBpbXBvcnRNYW5hZ2VyLmdlbmVyYXRlTmFtZWRJbXBvcnQoaW1wb3J0UGF0aCwgaW1wb3J0TmFtZSkgOiBudWxsO1xuICByZXR1cm4gaW1wb3J0QXMgJiYgaW1wb3J0QXMubW9kdWxlSW1wb3J0ID8gYCR7aW1wb3J0QXMubW9kdWxlSW1wb3J0LnRleHR9LiR7aW1wb3J0QXMuc3ltYm9sfWAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7aW1wb3J0TmFtZX1gO1xufVxuXG5mdW5jdGlvbiBnZXROZXh0U2libGluZ0luQXJyYXk8VCBleHRlbmRzIHRzLk5vZGU+KG5vZGU6IFQsIGFycmF5OiB0cy5Ob2RlQXJyYXk8VD4pOiBUfG51bGwge1xuICBjb25zdCBpbmRleCA9IGFycmF5LmluZGV4T2Yobm9kZSk7XG4gIHJldHVybiBpbmRleCAhPT0gLTEgJiYgYXJyYXkubGVuZ3RoID4gaW5kZXggKyAxID8gYXJyYXlbaW5kZXggKyAxXSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldEVuZEV4Y2VwdFNlbWljb2xvbihzdGF0ZW1lbnQ6IHRzLlN0YXRlbWVudCk6IG51bWJlciB7XG4gIGNvbnN0IGxhc3RUb2tlbiA9IHN0YXRlbWVudC5nZXRMYXN0VG9rZW4oKTtcbiAgcmV0dXJuIChsYXN0VG9rZW4gJiYgbGFzdFRva2VuLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuU2VtaWNvbG9uVG9rZW4pID8gc3RhdGVtZW50LmdldEVuZCgpIC0gMSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlbWVudC5nZXRFbmQoKTtcbn1cbiJdfQ==