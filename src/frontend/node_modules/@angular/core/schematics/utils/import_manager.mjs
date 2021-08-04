/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { dirname, resolve } from 'path';
import * as ts from 'typescript';
/**
 * Import manager that can be used to add TypeScript imports to given source
 * files. The manager ensures that multiple transformations are applied properly
 * without shifted offsets and that similar existing import declarations are re-used.
 */
export class ImportManager {
    constructor(getUpdateRecorder, printer) {
        this.getUpdateRecorder = getUpdateRecorder;
        this.printer = printer;
        /** Map of import declarations that need to be updated to include the given symbols. */
        this.updatedImports = new Map();
        /** Map of source-files and their previously used identifier names. */
        this.usedIdentifierNames = new Map();
        /**
         * Array of previously resolved symbol imports. Cache can be re-used to return
         * the same identifier without checking the source-file again.
         */
        this.importCache = [];
    }
    /**
     * Adds an import to the given source-file and returns the TypeScript
     * identifier that can be used to access the newly imported symbol.
     */
    addImportToSourceFile(sourceFile, symbolName, moduleName, typeImport = false) {
        const sourceDir = dirname(sourceFile.fileName);
        let importStartIndex = 0;
        let existingImport = null;
        // In case the given import has been already generated previously, we just return
        // the previous generated identifier in order to avoid duplicate generated imports.
        const cachedImport = this.importCache.find(c => c.sourceFile === sourceFile && c.symbolName === symbolName &&
            c.moduleName === moduleName);
        if (cachedImport) {
            return cachedImport.identifier;
        }
        // Walk through all source-file top-level statements and search for import declarations
        // that already match the specified "moduleName" and can be updated to import the
        // given symbol. If no matching import can be found, the last import in the source-file
        // will be used as starting point for a new import that will be generated.
        for (let i = sourceFile.statements.length - 1; i >= 0; i--) {
            const statement = sourceFile.statements[i];
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
                !statement.importClause) {
                continue;
            }
            if (importStartIndex === 0) {
                importStartIndex = this._getEndPositionOfNode(statement);
            }
            const moduleSpecifier = statement.moduleSpecifier.text;
            if (moduleSpecifier.startsWith('.') &&
                resolve(sourceDir, moduleSpecifier) !== resolve(sourceDir, moduleName) ||
                moduleSpecifier !== moduleName) {
                continue;
            }
            if (statement.importClause.namedBindings) {
                const namedBindings = statement.importClause.namedBindings;
                // In case a "Type" symbol is imported, we can't use namespace imports
                // because these only export symbols available at runtime (no types)
                if (ts.isNamespaceImport(namedBindings) && !typeImport) {
                    return ts.createPropertyAccess(ts.createIdentifier(namedBindings.name.text), ts.createIdentifier(symbolName || 'default'));
                }
                else if (ts.isNamedImports(namedBindings) && symbolName) {
                    const existingElement = namedBindings.elements.find(e => e.propertyName ? e.propertyName.text === symbolName : e.name.text === symbolName);
                    if (existingElement) {
                        return ts.createIdentifier(existingElement.name.text);
                    }
                    // In case the symbol could not be found in an existing import, we
                    // keep track of the import declaration as it can be updated to include
                    // the specified symbol name without having to create a new import.
                    existingImport = statement;
                }
            }
            else if (statement.importClause.name && !symbolName) {
                return ts.createIdentifier(statement.importClause.name.text);
            }
        }
        if (existingImport) {
            const propertyIdentifier = ts.createIdentifier(symbolName);
            const generatedUniqueIdentifier = this._getUniqueIdentifier(sourceFile, symbolName);
            const needsGeneratedUniqueName = generatedUniqueIdentifier.text !== symbolName;
            const importName = needsGeneratedUniqueName ? generatedUniqueIdentifier : propertyIdentifier;
            // Since it can happen that multiple classes need to be imported within the
            // specified source file and we want to add the identifiers to the existing
            // import declaration, we need to keep track of the updated import declarations.
            // We can't directly update the import declaration for each identifier as this
            // would throw off the recorder offsets. We need to keep track of the new identifiers
            // for the import and perform the import transformation as batches per source-file.
            this.updatedImports.set(existingImport, (this.updatedImports.get(existingImport) || []).concat({
                propertyName: needsGeneratedUniqueName ? propertyIdentifier : undefined,
                importName: importName,
            }));
            // Keep track of all updated imports so that we don't generate duplicate
            // similar imports as these can't be statically analyzed in the source-file yet.
            this.importCache.push({ sourceFile, moduleName, symbolName, identifier: importName });
            return importName;
        }
        let identifier = null;
        let newImport = null;
        if (symbolName) {
            const propertyIdentifier = ts.createIdentifier(symbolName);
            const generatedUniqueIdentifier = this._getUniqueIdentifier(sourceFile, symbolName);
            const needsGeneratedUniqueName = generatedUniqueIdentifier.text !== symbolName;
            identifier = needsGeneratedUniqueName ? generatedUniqueIdentifier : propertyIdentifier;
            newImport = ts.createImportDeclaration(undefined, undefined, ts.createImportClause(undefined, ts.createNamedImports([ts.createImportSpecifier(needsGeneratedUniqueName ? propertyIdentifier : undefined, identifier)])), ts.createStringLiteral(moduleName));
        }
        else {
            identifier = this._getUniqueIdentifier(sourceFile, 'defaultExport');
            newImport = ts.createImportDeclaration(undefined, undefined, ts.createImportClause(identifier, undefined), ts.createStringLiteral(moduleName));
        }
        const newImportText = this.printer.printNode(ts.EmitHint.Unspecified, newImport, sourceFile);
        // If the import is generated at the start of the source file, we want to add
        // a new-line after the import. Otherwise if the import is generated after an
        // existing import, we need to prepend a new-line so that the import is not on
        // the same line as the existing import anchor.
        this.getUpdateRecorder(sourceFile)
            .addNewImport(importStartIndex, importStartIndex === 0 ? `${newImportText}\n` : `\n${newImportText}`);
        // Keep track of all generated imports so that we don't generate duplicate
        // similar imports as these can't be statically analyzed in the source-file yet.
        this.importCache.push({ sourceFile, symbolName, moduleName, identifier });
        return identifier;
    }
    /**
     * Stores the collected import changes within the appropriate update recorders. The
     * updated imports can only be updated *once* per source-file because previous updates
     * could otherwise shift the source-file offsets.
     */
    recordChanges() {
        this.updatedImports.forEach((expressions, importDecl) => {
            const sourceFile = importDecl.getSourceFile();
            const recorder = this.getUpdateRecorder(sourceFile);
            const namedBindings = importDecl.importClause.namedBindings;
            const newNamedBindings = ts.updateNamedImports(namedBindings, namedBindings.elements.concat(expressions.map(({ propertyName, importName }) => ts.createImportSpecifier(propertyName, importName))));
            const newNamedBindingsText = this.printer.printNode(ts.EmitHint.Unspecified, newNamedBindings, sourceFile);
            recorder.updateExistingImport(namedBindings, newNamedBindingsText);
        });
    }
    /** Gets an unique identifier with a base name for the given source file. */
    _getUniqueIdentifier(sourceFile, baseName) {
        if (this.isUniqueIdentifierName(sourceFile, baseName)) {
            this._recordUsedIdentifier(sourceFile, baseName);
            return ts.createIdentifier(baseName);
        }
        let name = null;
        let counter = 1;
        do {
            name = `${baseName}_${counter++}`;
        } while (!this.isUniqueIdentifierName(sourceFile, name));
        this._recordUsedIdentifier(sourceFile, name);
        return ts.createIdentifier(name);
    }
    /**
     * Checks whether the specified identifier name is used within the given
     * source file.
     */
    isUniqueIdentifierName(sourceFile, name) {
        if (this.usedIdentifierNames.has(sourceFile) &&
            this.usedIdentifierNames.get(sourceFile).indexOf(name) !== -1) {
            return false;
        }
        // Walk through the source file and search for an identifier matching
        // the given name. In that case, it's not guaranteed that this name
        // is unique in the given declaration scope and we just return false.
        const nodeQueue = [sourceFile];
        while (nodeQueue.length) {
            const node = nodeQueue.shift();
            if (ts.isIdentifier(node) && node.text === name) {
                return false;
            }
            nodeQueue.push(...node.getChildren());
        }
        return true;
    }
    _recordUsedIdentifier(sourceFile, identifierName) {
        this.usedIdentifierNames.set(sourceFile, (this.usedIdentifierNames.get(sourceFile) || []).concat(identifierName));
    }
    /**
     * Determines the full end of a given node. By default the end position of a node is
     * before all trailing comments. This could mean that generated imports shift comments.
     */
    _getEndPositionOfNode(node) {
        const nodeEndPos = node.getEnd();
        const commentRanges = ts.getTrailingCommentRanges(node.getSourceFile().text, nodeEndPos);
        if (!commentRanges || !commentRanges.length) {
            return nodeEndPos;
        }
        return commentRanges[commentRanges.length - 1].end;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0X21hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvdXRpbHMvaW1wb3J0X21hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDdEMsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFRakM7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxhQUFhO0lBaUJ4QixZQUNZLGlCQUFxRSxFQUNyRSxPQUFtQjtRQURuQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9EO1FBQ3JFLFlBQU8sR0FBUCxPQUFPLENBQVk7UUFsQi9CLHVGQUF1RjtRQUMvRSxtQkFBYyxHQUNsQixJQUFJLEdBQUcsRUFBcUYsQ0FBQztRQUNqRyxzRUFBc0U7UUFDOUQsd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7UUFDakU7OztXQUdHO1FBQ0ssZ0JBQVcsR0FLYixFQUFFLENBQUM7SUFJeUIsQ0FBQztJQUVuQzs7O09BR0c7SUFDSCxxQkFBcUIsQ0FDakIsVUFBeUIsRUFBRSxVQUF1QixFQUFFLFVBQWtCLEVBQ3RFLFVBQVUsR0FBRyxLQUFLO1FBQ3BCLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDL0MsSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7UUFDekIsSUFBSSxjQUFjLEdBQThCLElBQUksQ0FBQztRQUVyRCxpRkFBaUY7UUFDakYsbUZBQW1GO1FBQ25GLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUN0QyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssVUFBVSxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssVUFBVTtZQUMz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LENBQUM7U0FDdkM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxVQUF5QixFQUFFLGNBQXNCO1FBQzdFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQ3hCLFVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFDM0YsQ0FBQztJQUVEOzs7T0FHRztJQUNLLHFCQUFxQixDQUFDLElBQWE7UUFDekMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pDLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzNDLE9BQU8sVUFBVSxDQUFDO1NBQ25CO1FBQ0QsT0FBTyxhQUFhLENBQUMsYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUM7SUFDdEQsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZGlybmFtZSwgcmVzb2x2ZX0gZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuLyoqIFVwZGF0ZSByZWNvcmRlciBmb3IgbWFuYWdpbmcgaW1wb3J0cy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW1wb3J0TWFuYWdlclVwZGF0ZVJlY29yZGVyIHtcbiAgYWRkTmV3SW1wb3J0KHN0YXJ0OiBudW1iZXIsIGltcG9ydFRleHQ6IHN0cmluZyk6IHZvaWQ7XG4gIHVwZGF0ZUV4aXN0aW5nSW1wb3J0KG5hbWVkQmluZGluZ3M6IHRzLk5hbWVkSW1wb3J0cywgbmV3TmFtZWRCaW5kaW5nczogc3RyaW5nKTogdm9pZDtcbn1cblxuLyoqXG4gKiBJbXBvcnQgbWFuYWdlciB0aGF0IGNhbiBiZSB1c2VkIHRvIGFkZCBUeXBlU2NyaXB0IGltcG9ydHMgdG8gZ2l2ZW4gc291cmNlXG4gKiBmaWxlcy4gVGhlIG1hbmFnZXIgZW5zdXJlcyB0aGF0IG11bHRpcGxlIHRyYW5zZm9ybWF0aW9ucyBhcmUgYXBwbGllZCBwcm9wZXJseVxuICogd2l0aG91dCBzaGlmdGVkIG9mZnNldHMgYW5kIHRoYXQgc2ltaWxhciBleGlzdGluZyBpbXBvcnQgZGVjbGFyYXRpb25zIGFyZSByZS11c2VkLlxuICovXG5leHBvcnQgY2xhc3MgSW1wb3J0TWFuYWdlciB7XG4gIC8qKiBNYXAgb2YgaW1wb3J0IGRlY2xhcmF0aW9ucyB0aGF0IG5lZWQgdG8gYmUgdXBkYXRlZCB0byBpbmNsdWRlIHRoZSBnaXZlbiBzeW1ib2xzLiAqL1xuICBwcml2YXRlIHVwZGF0ZWRJbXBvcnRzID1cbiAgICAgIG5ldyBNYXA8dHMuSW1wb3J0RGVjbGFyYXRpb24sIHtwcm9wZXJ0eU5hbWU/OiB0cy5JZGVudGlmaWVyLCBpbXBvcnROYW1lOiB0cy5JZGVudGlmaWVyfVtdPigpO1xuICAvKiogTWFwIG9mIHNvdXJjZS1maWxlcyBhbmQgdGhlaXIgcHJldmlvdXNseSB1c2VkIGlkZW50aWZpZXIgbmFtZXMuICovXG4gIHByaXZhdGUgdXNlZElkZW50aWZpZXJOYW1lcyA9IG5ldyBNYXA8dHMuU291cmNlRmlsZSwgc3RyaW5nW10+KCk7XG4gIC8qKlxuICAgKiBBcnJheSBvZiBwcmV2aW91c2x5IHJlc29sdmVkIHN5bWJvbCBpbXBvcnRzLiBDYWNoZSBjYW4gYmUgcmUtdXNlZCB0byByZXR1cm5cbiAgICogdGhlIHNhbWUgaWRlbnRpZmllciB3aXRob3V0IGNoZWNraW5nIHRoZSBzb3VyY2UtZmlsZSBhZ2Fpbi5cbiAgICovXG4gIHByaXZhdGUgaW1wb3J0Q2FjaGU6IHtcbiAgICBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlLFxuICAgIHN5bWJvbE5hbWU6IHN0cmluZ3xudWxsLFxuICAgIG1vZHVsZU5hbWU6IHN0cmluZyxcbiAgICBpZGVudGlmaWVyOiB0cy5JZGVudGlmaWVyXG4gIH1bXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBnZXRVcGRhdGVSZWNvcmRlcjogKHNmOiB0cy5Tb3VyY2VGaWxlKSA9PiBJbXBvcnRNYW5hZ2VyVXBkYXRlUmVjb3JkZXIsXG4gICAgICBwcml2YXRlIHByaW50ZXI6IHRzLlByaW50ZXIpIHt9XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gaW1wb3J0IHRvIHRoZSBnaXZlbiBzb3VyY2UtZmlsZSBhbmQgcmV0dXJucyB0aGUgVHlwZVNjcmlwdFxuICAgKiBpZGVudGlmaWVyIHRoYXQgY2FuIGJlIHVzZWQgdG8gYWNjZXNzIHRoZSBuZXdseSBpbXBvcnRlZCBzeW1ib2wuXG4gICAqL1xuICBhZGRJbXBvcnRUb1NvdXJjZUZpbGUoXG4gICAgICBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlLCBzeW1ib2xOYW1lOiBzdHJpbmd8bnVsbCwgbW9kdWxlTmFtZTogc3RyaW5nLFxuICAgICAgdHlwZUltcG9ydCA9IGZhbHNlKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3Qgc291cmNlRGlyID0gZGlybmFtZShzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgICBsZXQgaW1wb3J0U3RhcnRJbmRleCA9IDA7XG4gICAgbGV0IGV4aXN0aW5nSW1wb3J0OiB0cy5JbXBvcnREZWNsYXJhdGlvbnxudWxsID0gbnVsbDtcblxuICAgIC8vIEluIGNhc2UgdGhlIGdpdmVuIGltcG9ydCBoYXMgYmVlbiBhbHJlYWR5IGdlbmVyYXRlZCBwcmV2aW91c2x5LCB3ZSBqdXN0IHJldHVyblxuICAgIC8vIHRoZSBwcmV2aW91cyBnZW5lcmF0ZWQgaWRlbnRpZmllciBpbiBvcmRlciB0byBhdm9pZCBkdXBsaWNhdGUgZ2VuZXJhdGVkIGltcG9ydHMuXG4gICAgY29uc3QgY2FjaGVkSW1wb3J0ID0gdGhpcy5pbXBvcnRDYWNoZS5maW5kKFxuICAgICAgICBjID0+IGMuc291cmNlRmlsZSA9PT0gc291cmNlRmlsZSAmJiBjLnN5bWJvbE5hbWUgPT09IHN5bWJvbE5hbWUgJiZcbiAgICAgICAgICAgIGMubW9kdWxlTmFtZSA9PT0gbW9kdWxlTmFtZSk7XG4gICAgaWYgKGNhY2hlZEltcG9ydCkge1xuICAgICAgcmV0dXJuIGNhY2hlZEltcG9ydC5pZGVudGlmaWVyO1xuICAgIH1cblxuICAgIC8vIFdhbGsgdGhyb3VnaCBhbGwgc291cmNlLWZpbGUgdG9wLWxldmVsIHN0YXRlbWVudHMgYW5kIHNlYXJjaCBmb3IgaW1wb3J0IGRlY2xhcmF0aW9uc1xuICAgIC8vIHRoYXQgYWxyZWFkeSBtYXRjaCB0aGUgc3BlY2lmaWVkIFwibW9kdWxlTmFtZVwiIGFuZCBjYW4gYmUgdXBkYXRlZCB0byBpbXBvcnQgdGhlXG4gICAgLy8gZ2l2ZW4gc3ltYm9sLiBJZiBubyBtYXRjaGluZyBpbXBvcnQgY2FuIGJlIGZvdW5kLCB0aGUgbGFzdCBpbXBvcnQgaW4gdGhlIHNvdXJjZS1maWxlXG4gICAgLy8gd2lsbCBiZSB1c2VkIGFzIHN0YXJ0aW5nIHBvaW50IGZvciBhIG5ldyBpbXBvcnQgdGhhdCB3aWxsIGJlIGdlbmVyYXRlZC5cbiAgICBmb3IgKGxldCBpID0gc291cmNlRmlsZS5zdGF0ZW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBzdGF0ZW1lbnQgPSBzb3VyY2VGaWxlLnN0YXRlbWVudHNbaV07XG5cbiAgICAgIGlmICghdHMuaXNJbXBvcnREZWNsYXJhdGlvbihzdGF0ZW1lbnQpIHx8ICF0cy5pc1N0cmluZ0xpdGVyYWwoc3RhdGVtZW50Lm1vZHVsZVNwZWNpZmllcikgfHxcbiAgICAgICAgICAhc3RhdGVtZW50LmltcG9ydENsYXVzZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGltcG9ydFN0YXJ0SW5kZXggPT09IDApIHtcbiAgICAgICAgaW1wb3J0U3RhcnRJbmRleCA9IHRoaXMuX2dldEVuZFBvc2l0aW9uT2ZOb2RlKHN0YXRlbWVudCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1vZHVsZVNwZWNpZmllciA9IHN0YXRlbWVudC5tb2R1bGVTcGVjaWZpZXIudGV4dDtcblxuICAgICAgaWYgKG1vZHVsZVNwZWNpZmllci5zdGFydHNXaXRoKCcuJykgJiZcbiAgICAgICAgICAgICAgcmVzb2x2ZShzb3VyY2VEaXIsIG1vZHVsZVNwZWNpZmllcikgIT09IHJlc29sdmUoc291cmNlRGlyLCBtb2R1bGVOYW1lKSB8fFxuICAgICAgICAgIG1vZHVsZVNwZWNpZmllciAhPT0gbW9kdWxlTmFtZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRlbWVudC5pbXBvcnRDbGF1c2UubmFtZWRCaW5kaW5ncykge1xuICAgICAgICBjb25zdCBuYW1lZEJpbmRpbmdzID0gc3RhdGVtZW50LmltcG9ydENsYXVzZS5uYW1lZEJpbmRpbmdzO1xuXG4gICAgICAgIC8vIEluIGNhc2UgYSBcIlR5cGVcIiBzeW1ib2wgaXMgaW1wb3J0ZWQsIHdlIGNhbid0IHVzZSBuYW1lc3BhY2UgaW1wb3J0c1xuICAgICAgICAvLyBiZWNhdXNlIHRoZXNlIG9ubHkgZXhwb3J0IHN5bWJvbHMgYXZhaWxhYmxlIGF0IHJ1bnRpbWUgKG5vIHR5cGVzKVxuICAgICAgICBpZiAodHMuaXNOYW1lc3BhY2VJbXBvcnQobmFtZWRCaW5kaW5ncykgJiYgIXR5cGVJbXBvcnQpIHtcbiAgICAgICAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoXG4gICAgICAgICAgICAgIHRzLmNyZWF0ZUlkZW50aWZpZXIobmFtZWRCaW5kaW5ncy5uYW1lLnRleHQpLFxuICAgICAgICAgICAgICB0cy5jcmVhdGVJZGVudGlmaWVyKHN5bWJvbE5hbWUgfHwgJ2RlZmF1bHQnKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHMuaXNOYW1lZEltcG9ydHMobmFtZWRCaW5kaW5ncykgJiYgc3ltYm9sTmFtZSkge1xuICAgICAgICAgIGNvbnN0IGV4aXN0aW5nRWxlbWVudCA9IG5hbWVkQmluZGluZ3MuZWxlbWVudHMuZmluZChcbiAgICAgICAgICAgICAgZSA9PlxuICAgICAgICAgICAgICAgICAgZS5wcm9wZXJ0eU5hbWUgPyBlLnByb3BlcnR5TmFtZS50ZXh0ID09PSBzeW1ib2xOYW1lIDogZS5uYW1lLnRleHQgPT09IHN5bWJvbE5hbWUpO1xuXG4gICAgICAgICAgaWYgKGV4aXN0aW5nRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoZXhpc3RpbmdFbGVtZW50Lm5hbWUudGV4dCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gSW4gY2FzZSB0aGUgc3ltYm9sIGNvdWxkIG5vdCBiZSBmb3VuZCBpbiBhbiBleGlzdGluZyBpbXBvcnQsIHdlXG4gICAgICAgICAgLy8ga2VlcCB0cmFjayBvZiB0aGUgaW1wb3J0IGRlY2xhcmF0aW9uIGFzIGl0IGNhbiBiZSB1cGRhdGVkIHRvIGluY2x1ZGVcbiAgICAgICAgICAvLyB0aGUgc3BlY2lmaWVkIHN5bWJvbCBuYW1lIHdpdGhvdXQgaGF2aW5nIHRvIGNyZWF0ZSBhIG5ldyBpbXBvcnQuXG4gICAgICAgICAgZXhpc3RpbmdJbXBvcnQgPSBzdGF0ZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3RhdGVtZW50LmltcG9ydENsYXVzZS5uYW1lICYmICFzeW1ib2xOYW1lKSB7XG4gICAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKHN0YXRlbWVudC5pbXBvcnRDbGF1c2UubmFtZS50ZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZXhpc3RpbmdJbXBvcnQpIHtcbiAgICAgIGNvbnN0IHByb3BlcnR5SWRlbnRpZmllciA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoc3ltYm9sTmFtZSEpO1xuICAgICAgY29uc3QgZ2VuZXJhdGVkVW5pcXVlSWRlbnRpZmllciA9IHRoaXMuX2dldFVuaXF1ZUlkZW50aWZpZXIoc291cmNlRmlsZSwgc3ltYm9sTmFtZSEpO1xuICAgICAgY29uc3QgbmVlZHNHZW5lcmF0ZWRVbmlxdWVOYW1lID0gZ2VuZXJhdGVkVW5pcXVlSWRlbnRpZmllci50ZXh0ICE9PSBzeW1ib2xOYW1lO1xuICAgICAgY29uc3QgaW1wb3J0TmFtZSA9IG5lZWRzR2VuZXJhdGVkVW5pcXVlTmFtZSA/IGdlbmVyYXRlZFVuaXF1ZUlkZW50aWZpZXIgOiBwcm9wZXJ0eUlkZW50aWZpZXI7XG5cbiAgICAgIC8vIFNpbmNlIGl0IGNhbiBoYXBwZW4gdGhhdCBtdWx0aXBsZSBjbGFzc2VzIG5lZWQgdG8gYmUgaW1wb3J0ZWQgd2l0aGluIHRoZVxuICAgICAgLy8gc3BlY2lmaWVkIHNvdXJjZSBmaWxlIGFuZCB3ZSB3YW50IHRvIGFkZCB0aGUgaWRlbnRpZmllcnMgdG8gdGhlIGV4aXN0aW5nXG4gICAgICAvLyBpbXBvcnQgZGVjbGFyYXRpb24sIHdlIG5lZWQgdG8ga2VlcCB0cmFjayBvZiB0aGUgdXBkYXRlZCBpbXBvcnQgZGVjbGFyYXRpb25zLlxuICAgICAgLy8gV2UgY2FuJ3QgZGlyZWN0bHkgdXBkYXRlIHRoZSBpbXBvcnQgZGVjbGFyYXRpb24gZm9yIGVhY2ggaWRlbnRpZmllciBhcyB0aGlzXG4gICAgICAvLyB3b3VsZCB0aHJvdyBvZmYgdGhlIHJlY29yZGVyIG9mZnNldHMuIFdlIG5lZWQgdG8ga2VlcCB0cmFjayBvZiB0aGUgbmV3IGlkZW50aWZpZXJzXG4gICAgICAvLyBmb3IgdGhlIGltcG9ydCBhbmQgcGVyZm9ybSB0aGUgaW1wb3J0IHRyYW5zZm9ybWF0aW9uIGFzIGJhdGNoZXMgcGVyIHNvdXJjZS1maWxlLlxuICAgICAgdGhpcy51cGRhdGVkSW1wb3J0cy5zZXQoXG4gICAgICAgICAgZXhpc3RpbmdJbXBvcnQsICh0aGlzLnVwZGF0ZWRJbXBvcnRzLmdldChleGlzdGluZ0ltcG9ydCkgfHwgW10pLmNvbmNhdCh7XG4gICAgICAgICAgICBwcm9wZXJ0eU5hbWU6IG5lZWRzR2VuZXJhdGVkVW5pcXVlTmFtZSA/IHByb3BlcnR5SWRlbnRpZmllciA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGltcG9ydE5hbWU6IGltcG9ydE5hbWUsXG4gICAgICAgICAgfSkpO1xuXG4gICAgICAvLyBLZWVwIHRyYWNrIG9mIGFsbCB1cGRhdGVkIGltcG9ydHMgc28gdGhhdCB3ZSBkb24ndCBnZW5lcmF0ZSBkdXBsaWNhdGVcbiAgICAgIC8vIHNpbWlsYXIgaW1wb3J0cyBhcyB0aGVzZSBjYW4ndCBiZSBzdGF0aWNhbGx5IGFuYWx5emVkIGluIHRoZSBzb3VyY2UtZmlsZSB5ZXQuXG4gICAgICB0aGlzLmltcG9ydENhY2hlLnB1c2goe3NvdXJjZUZpbGUsIG1vZHVsZU5hbWUsIHN5bWJvbE5hbWUsIGlkZW50aWZpZXI6IGltcG9ydE5hbWV9KTtcblxuICAgICAgcmV0dXJuIGltcG9ydE5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGlkZW50aWZpZXI6IHRzLklkZW50aWZpZXJ8bnVsbCA9IG51bGw7XG4gICAgbGV0IG5ld0ltcG9ydDogdHMuSW1wb3J0RGVjbGFyYXRpb258bnVsbCA9IG51bGw7XG5cbiAgICBpZiAoc3ltYm9sTmFtZSkge1xuICAgICAgY29uc3QgcHJvcGVydHlJZGVudGlmaWVyID0gdHMuY3JlYXRlSWRlbnRpZmllcihzeW1ib2xOYW1lKTtcbiAgICAgIGNvbnN0IGdlbmVyYXRlZFVuaXF1ZUlkZW50aWZpZXIgPSB0aGlzLl9nZXRVbmlxdWVJZGVudGlmaWVyKHNvdXJjZUZpbGUsIHN5bWJvbE5hbWUpO1xuICAgICAgY29uc3QgbmVlZHNHZW5lcmF0ZWRVbmlxdWVOYW1lID0gZ2VuZXJhdGVkVW5pcXVlSWRlbnRpZmllci50ZXh0ICE9PSBzeW1ib2xOYW1lO1xuICAgICAgaWRlbnRpZmllciA9IG5lZWRzR2VuZXJhdGVkVW5pcXVlTmFtZSA/IGdlbmVyYXRlZFVuaXF1ZUlkZW50aWZpZXIgOiBwcm9wZXJ0eUlkZW50aWZpZXI7XG5cbiAgICAgIG5ld0ltcG9ydCA9IHRzLmNyZWF0ZUltcG9ydERlY2xhcmF0aW9uKFxuICAgICAgICAgIHVuZGVmaW5lZCwgdW5kZWZpbmVkLFxuICAgICAgICAgIHRzLmNyZWF0ZUltcG9ydENsYXVzZShcbiAgICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB0cy5jcmVhdGVOYW1lZEltcG9ydHMoW3RzLmNyZWF0ZUltcG9ydFNwZWNpZmllcihcbiAgICAgICAgICAgICAgICAgIG5lZWRzR2VuZXJhdGVkVW5pcXVlTmFtZSA/IHByb3BlcnR5SWRlbnRpZmllciA6IHVuZGVmaW5lZCwgaWRlbnRpZmllcildKSksXG4gICAgICAgICAgdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChtb2R1bGVOYW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlkZW50aWZpZXIgPSB0aGlzLl9nZXRVbmlxdWVJZGVudGlmaWVyKHNvdXJjZUZpbGUsICdkZWZhdWx0RXhwb3J0Jyk7XG4gICAgICBuZXdJbXBvcnQgPSB0cy5jcmVhdGVJbXBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHMuY3JlYXRlSW1wb3J0Q2xhdXNlKGlkZW50aWZpZXIsIHVuZGVmaW5lZCksXG4gICAgICAgICAgdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChtb2R1bGVOYW1lKSk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV3SW1wb3J0VGV4dCA9IHRoaXMucHJpbnRlci5wcmludE5vZGUodHMuRW1pdEhpbnQuVW5zcGVjaWZpZWQsIG5ld0ltcG9ydCwgc291cmNlRmlsZSk7XG4gICAgLy8gSWYgdGhlIGltcG9ydCBpcyBnZW5lcmF0ZWQgYXQgdGhlIHN0YXJ0IG9mIHRoZSBzb3VyY2UgZmlsZSwgd2Ugd2FudCB0byBhZGRcbiAgICAvLyBhIG5ldy1saW5lIGFmdGVyIHRoZSBpbXBvcnQuIE90aGVyd2lzZSBpZiB0aGUgaW1wb3J0IGlzIGdlbmVyYXRlZCBhZnRlciBhblxuICAgIC8vIGV4aXN0aW5nIGltcG9ydCwgd2UgbmVlZCB0byBwcmVwZW5kIGEgbmV3LWxpbmUgc28gdGhhdCB0aGUgaW1wb3J0IGlzIG5vdCBvblxuICAgIC8vIHRoZSBzYW1lIGxpbmUgYXMgdGhlIGV4aXN0aW5nIGltcG9ydCBhbmNob3IuXG4gICAgdGhpcy5nZXRVcGRhdGVSZWNvcmRlcihzb3VyY2VGaWxlKVxuICAgICAgICAuYWRkTmV3SW1wb3J0KFxuICAgICAgICAgICAgaW1wb3J0U3RhcnRJbmRleCwgaW1wb3J0U3RhcnRJbmRleCA9PT0gMCA/IGAke25ld0ltcG9ydFRleHR9XFxuYCA6IGBcXG4ke25ld0ltcG9ydFRleHR9YCk7XG5cbiAgICAvLyBLZWVwIHRyYWNrIG9mIGFsbCBnZW5lcmF0ZWQgaW1wb3J0cyBzbyB0aGF0IHdlIGRvbid0IGdlbmVyYXRlIGR1cGxpY2F0ZVxuICAgIC8vIHNpbWlsYXIgaW1wb3J0cyBhcyB0aGVzZSBjYW4ndCBiZSBzdGF0aWNhbGx5IGFuYWx5emVkIGluIHRoZSBzb3VyY2UtZmlsZSB5ZXQuXG4gICAgdGhpcy5pbXBvcnRDYWNoZS5wdXNoKHtzb3VyY2VGaWxlLCBzeW1ib2xOYW1lLCBtb2R1bGVOYW1lLCBpZGVudGlmaWVyfSk7XG5cbiAgICByZXR1cm4gaWRlbnRpZmllcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9yZXMgdGhlIGNvbGxlY3RlZCBpbXBvcnQgY2hhbmdlcyB3aXRoaW4gdGhlIGFwcHJvcHJpYXRlIHVwZGF0ZSByZWNvcmRlcnMuIFRoZVxuICAgKiB1cGRhdGVkIGltcG9ydHMgY2FuIG9ubHkgYmUgdXBkYXRlZCAqb25jZSogcGVyIHNvdXJjZS1maWxlIGJlY2F1c2UgcHJldmlvdXMgdXBkYXRlc1xuICAgKiBjb3VsZCBvdGhlcndpc2Ugc2hpZnQgdGhlIHNvdXJjZS1maWxlIG9mZnNldHMuXG4gICAqL1xuICByZWNvcmRDaGFuZ2VzKCkge1xuICAgIHRoaXMudXBkYXRlZEltcG9ydHMuZm9yRWFjaCgoZXhwcmVzc2lvbnMsIGltcG9ydERlY2wpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBpbXBvcnREZWNsLmdldFNvdXJjZUZpbGUoKTtcbiAgICAgIGNvbnN0IHJlY29yZGVyID0gdGhpcy5nZXRVcGRhdGVSZWNvcmRlcihzb3VyY2VGaWxlKTtcbiAgICAgIGNvbnN0IG5hbWVkQmluZGluZ3MgPSBpbXBvcnREZWNsLmltcG9ydENsYXVzZSEubmFtZWRCaW5kaW5ncyBhcyB0cy5OYW1lZEltcG9ydHM7XG4gICAgICBjb25zdCBuZXdOYW1lZEJpbmRpbmdzID0gdHMudXBkYXRlTmFtZWRJbXBvcnRzKFxuICAgICAgICAgIG5hbWVkQmluZGluZ3MsXG4gICAgICAgICAgbmFtZWRCaW5kaW5ncy5lbGVtZW50cy5jb25jYXQoZXhwcmVzc2lvbnMubWFwKFxuICAgICAgICAgICAgICAoe3Byb3BlcnR5TmFtZSwgaW1wb3J0TmFtZX0pID0+IHRzLmNyZWF0ZUltcG9ydFNwZWNpZmllcihwcm9wZXJ0eU5hbWUsIGltcG9ydE5hbWUpKSkpO1xuXG4gICAgICBjb25zdCBuZXdOYW1lZEJpbmRpbmdzVGV4dCA9XG4gICAgICAgICAgdGhpcy5wcmludGVyLnByaW50Tm9kZSh0cy5FbWl0SGludC5VbnNwZWNpZmllZCwgbmV3TmFtZWRCaW5kaW5ncywgc291cmNlRmlsZSk7XG4gICAgICByZWNvcmRlci51cGRhdGVFeGlzdGluZ0ltcG9ydChuYW1lZEJpbmRpbmdzLCBuZXdOYW1lZEJpbmRpbmdzVGV4dCk7XG4gICAgfSk7XG4gIH1cblxuICAvKiogR2V0cyBhbiB1bmlxdWUgaWRlbnRpZmllciB3aXRoIGEgYmFzZSBuYW1lIGZvciB0aGUgZ2l2ZW4gc291cmNlIGZpbGUuICovXG4gIHByaXZhdGUgX2dldFVuaXF1ZUlkZW50aWZpZXIoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgYmFzZU5hbWU6IHN0cmluZyk6IHRzLklkZW50aWZpZXIge1xuICAgIGlmICh0aGlzLmlzVW5pcXVlSWRlbnRpZmllck5hbWUoc291cmNlRmlsZSwgYmFzZU5hbWUpKSB7XG4gICAgICB0aGlzLl9yZWNvcmRVc2VkSWRlbnRpZmllcihzb3VyY2VGaWxlLCBiYXNlTmFtZSk7XG4gICAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcihiYXNlTmFtZSk7XG4gICAgfVxuXG4gICAgbGV0IG5hbWUgPSBudWxsO1xuICAgIGxldCBjb3VudGVyID0gMTtcbiAgICBkbyB7XG4gICAgICBuYW1lID0gYCR7YmFzZU5hbWV9XyR7Y291bnRlcisrfWA7XG4gICAgfSB3aGlsZSAoIXRoaXMuaXNVbmlxdWVJZGVudGlmaWVyTmFtZShzb3VyY2VGaWxlLCBuYW1lKSk7XG5cbiAgICB0aGlzLl9yZWNvcmRVc2VkSWRlbnRpZmllcihzb3VyY2VGaWxlLCBuYW1lISk7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIobmFtZSEpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyB3aGV0aGVyIHRoZSBzcGVjaWZpZWQgaWRlbnRpZmllciBuYW1lIGlzIHVzZWQgd2l0aGluIHRoZSBnaXZlblxuICAgKiBzb3VyY2UgZmlsZS5cbiAgICovXG4gIHByaXZhdGUgaXNVbmlxdWVJZGVudGlmaWVyTmFtZShzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlLCBuYW1lOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy51c2VkSWRlbnRpZmllck5hbWVzLmhhcyhzb3VyY2VGaWxlKSAmJlxuICAgICAgICB0aGlzLnVzZWRJZGVudGlmaWVyTmFtZXMuZ2V0KHNvdXJjZUZpbGUpIS5pbmRleE9mKG5hbWUpICE9PSAtMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFdhbGsgdGhyb3VnaCB0aGUgc291cmNlIGZpbGUgYW5kIHNlYXJjaCBmb3IgYW4gaWRlbnRpZmllciBtYXRjaGluZ1xuICAgIC8vIHRoZSBnaXZlbiBuYW1lLiBJbiB0aGF0IGNhc2UsIGl0J3Mgbm90IGd1YXJhbnRlZWQgdGhhdCB0aGlzIG5hbWVcbiAgICAvLyBpcyB1bmlxdWUgaW4gdGhlIGdpdmVuIGRlY2xhcmF0aW9uIHNjb3BlIGFuZCB3ZSBqdXN0IHJldHVybiBmYWxzZS5cbiAgICBjb25zdCBub2RlUXVldWU6IHRzLk5vZGVbXSA9IFtzb3VyY2VGaWxlXTtcbiAgICB3aGlsZSAobm9kZVF1ZXVlLmxlbmd0aCkge1xuICAgICAgY29uc3Qgbm9kZSA9IG5vZGVRdWV1ZS5zaGlmdCgpITtcbiAgICAgIGlmICh0cy5pc0lkZW50aWZpZXIobm9kZSkgJiYgbm9kZS50ZXh0ID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIG5vZGVRdWV1ZS5wdXNoKC4uLm5vZGUuZ2V0Q2hpbGRyZW4oKSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVjb3JkVXNlZElkZW50aWZpZXIoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgaWRlbnRpZmllck5hbWU6IHN0cmluZykge1xuICAgIHRoaXMudXNlZElkZW50aWZpZXJOYW1lcy5zZXQoXG4gICAgICAgIHNvdXJjZUZpbGUsICh0aGlzLnVzZWRJZGVudGlmaWVyTmFtZXMuZ2V0KHNvdXJjZUZpbGUpIHx8IFtdKS5jb25jYXQoaWRlbnRpZmllck5hbWUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIHRoZSBmdWxsIGVuZCBvZiBhIGdpdmVuIG5vZGUuIEJ5IGRlZmF1bHQgdGhlIGVuZCBwb3NpdGlvbiBvZiBhIG5vZGUgaXNcbiAgICogYmVmb3JlIGFsbCB0cmFpbGluZyBjb21tZW50cy4gVGhpcyBjb3VsZCBtZWFuIHRoYXQgZ2VuZXJhdGVkIGltcG9ydHMgc2hpZnQgY29tbWVudHMuXG4gICAqL1xuICBwcml2YXRlIF9nZXRFbmRQb3NpdGlvbk9mTm9kZShub2RlOiB0cy5Ob2RlKSB7XG4gICAgY29uc3Qgbm9kZUVuZFBvcyA9IG5vZGUuZ2V0RW5kKCk7XG4gICAgY29uc3QgY29tbWVudFJhbmdlcyA9IHRzLmdldFRyYWlsaW5nQ29tbWVudFJhbmdlcyhub2RlLmdldFNvdXJjZUZpbGUoKS50ZXh0LCBub2RlRW5kUG9zKTtcbiAgICBpZiAoIWNvbW1lbnRSYW5nZXMgfHwgIWNvbW1lbnRSYW5nZXMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gbm9kZUVuZFBvcztcbiAgICB9XG4gICAgcmV0dXJuIGNvbW1lbnRSYW5nZXNbY29tbWVudFJhbmdlcy5sZW5ndGggLSAxXSEuZW5kO1xuICB9XG59XG4iXX0=