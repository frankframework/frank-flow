/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createLoweredSymbol, isLoweredSymbol } from '@angular/compiler';
import * as ts from 'typescript';
import { isMetadataGlobalReferenceExpression } from '../metadata/index';
function toMap(items, select) {
    return new Map(items.map(i => [select(i), i]));
}
// We will never lower expressions in a nested lexical scope so avoid entering them.
// This also avoids a bug in TypeScript 2.3 where the lexical scopes get out of sync
// when using visitEachChild.
function isLexicalScope(node) {
    switch (node.kind) {
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.FunctionType:
        case ts.SyntaxKind.TypeLiteral:
        case ts.SyntaxKind.ArrayType:
            return true;
    }
    return false;
}
function transformSourceFile(sourceFile, requests, context) {
    const inserts = [];
    // Calculate the range of interesting locations. The transform will only visit nodes in this
    // range to improve the performance on large files.
    const locations = Array.from(requests.keys());
    const min = Math.min(...locations);
    const max = Math.max(...locations);
    // Visit nodes matching the request and synthetic nodes added by tsickle
    function shouldVisit(pos, end) {
        return (pos <= max && end >= min) || pos == -1;
    }
    function visitSourceFile(sourceFile) {
        function topLevelStatement(node) {
            const declarations = [];
            function visitNode(node) {
                // Get the original node before tsickle
                const { pos, end, kind, parent: originalParent } = ts.getOriginalNode(node);
                const nodeRequest = requests.get(pos);
                if (nodeRequest && nodeRequest.kind == kind && nodeRequest.end == end) {
                    // This node is requested to be rewritten as a reference to the exported name.
                    if (originalParent && originalParent.kind === ts.SyntaxKind.VariableDeclaration) {
                        // As the value represents the whole initializer of a variable declaration,
                        // just refer to that variable. This e.g. helps to preserve closure comments
                        // at the right place.
                        const varParent = originalParent;
                        if (varParent.name.kind === ts.SyntaxKind.Identifier) {
                            const varName = varParent.name.text;
                            const exportName = nodeRequest.name;
                            declarations.push({
                                name: exportName,
                                node: ts.createIdentifier(varName),
                                order: 1 /* AfterStmt */
                            });
                            return node;
                        }
                    }
                    // Record that the node needs to be moved to an exported variable with the given name
                    const exportName = nodeRequest.name;
                    declarations.push({ name: exportName, node, order: 0 /* BeforeStmt */ });
                    return ts.createIdentifier(exportName);
                }
                let result = node;
                if (shouldVisit(pos, end) && !isLexicalScope(node)) {
                    result = ts.visitEachChild(node, visitNode, context);
                }
                return result;
            }
            // Get the original node before tsickle
            const { pos, end } = ts.getOriginalNode(node);
            let resultStmt;
            if (shouldVisit(pos, end)) {
                resultStmt = ts.visitEachChild(node, visitNode, context);
            }
            else {
                resultStmt = node;
            }
            if (declarations.length) {
                inserts.push({ relativeTo: resultStmt, declarations });
            }
            return resultStmt;
        }
        let newStatements = sourceFile.statements.map(topLevelStatement);
        if (inserts.length) {
            // Insert the declarations relative to the rewritten statement that references them.
            const insertMap = toMap(inserts, i => i.relativeTo);
            const tmpStatements = [];
            newStatements.forEach(statement => {
                const insert = insertMap.get(statement);
                if (insert) {
                    const before = insert.declarations.filter(d => d.order === 0 /* BeforeStmt */);
                    if (before.length) {
                        tmpStatements.push(createVariableStatementForDeclarations(before));
                    }
                    tmpStatements.push(statement);
                    const after = insert.declarations.filter(d => d.order === 1 /* AfterStmt */);
                    if (after.length) {
                        tmpStatements.push(createVariableStatementForDeclarations(after));
                    }
                }
                else {
                    tmpStatements.push(statement);
                }
            });
            // Insert an exports clause to export the declarations
            tmpStatements.push(ts.createExportDeclaration(
            /* decorators */ undefined, 
            /* modifiers */ undefined, ts.createNamedExports(inserts
                .reduce((accumulator, insert) => [...accumulator, ...insert.declarations], [])
                .map(declaration => ts.createExportSpecifier(
            /* propertyName */ undefined, declaration.name)))));
            newStatements = tmpStatements;
        }
        const newSf = ts.updateSourceFileNode(sourceFile, ts.setTextRange(ts.createNodeArray(newStatements), sourceFile.statements));
        if (!(sourceFile.flags & ts.NodeFlags.Synthesized)) {
            newSf.flags &= ~ts.NodeFlags.Synthesized;
        }
        return newSf;
    }
    return visitSourceFile(sourceFile);
}
function createVariableStatementForDeclarations(declarations) {
    const varDecls = declarations.map(i => ts.createVariableDeclaration(i.name, /* type */ undefined, i.node));
    return ts.createVariableStatement(
    /* modifiers */ undefined, ts.createVariableDeclarationList(varDecls, ts.NodeFlags.Const));
}
export function getExpressionLoweringTransformFactory(requestsMap, program) {
    // Return the factory
    return (context) => (sourceFile) => {
        // We need to use the original SourceFile for reading metadata, and not the transformed one.
        const originalFile = program.getSourceFile(sourceFile.fileName);
        if (originalFile) {
            const requests = requestsMap.getRequests(originalFile);
            if (requests && requests.size) {
                return transformSourceFile(sourceFile, requests, context);
            }
        }
        return sourceFile;
    };
}
function isEligibleForLowering(node) {
    if (node) {
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
            case ts.SyntaxKind.Decorator:
                // Lower expressions that are local to the module scope or
                // in a decorator.
                return true;
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.FunctionDeclaration:
                // Don't lower expressions in a declaration.
                return false;
            case ts.SyntaxKind.VariableDeclaration:
                const isExported = (ts.getCombinedModifierFlags(node) &
                    ts.ModifierFlags.Export) == 0;
                // This might be unnecessary, as the variable might be exported and only used as a reference
                // in another expression. However, the variable also might be involved in provider
                // definitions. If that's the case, there is a specific token (`ROUTES`) which the compiler
                // attempts to understand deeply. Sub-expressions within that token (`loadChildren` for
                // example) might also require lowering even if the top-level declaration is already
                // properly exported.
                const varNode = node;
                return isExported ||
                    (varNode.initializer !== undefined &&
                        (ts.isObjectLiteralExpression(varNode.initializer) ||
                            ts.isArrayLiteralExpression(varNode.initializer) ||
                            ts.isCallExpression(varNode.initializer)));
        }
        return isEligibleForLowering(node.parent);
    }
    return true;
}
function isPrimitive(value) {
    return Object(value) !== value;
}
function isRewritten(value) {
    return isMetadataGlobalReferenceExpression(value) && isLoweredSymbol(value.name);
}
function isLiteralFieldNamed(node, names) {
    if (node.parent && node.parent.kind == ts.SyntaxKind.PropertyAssignment) {
        const property = node.parent;
        if (property.parent && property.parent.kind == ts.SyntaxKind.ObjectLiteralExpression &&
            property.name && property.name.kind == ts.SyntaxKind.Identifier) {
            const propertyName = property.name;
            return names.has(propertyName.text);
        }
    }
    return false;
}
export class LowerMetadataTransform {
    constructor(lowerableFieldNames) {
        this.requests = new Map();
        this.lowerableFieldNames = new Set(lowerableFieldNames);
    }
    // RequestMap
    getRequests(sourceFile) {
        let result = this.requests.get(sourceFile.fileName);
        if (!result) {
            // Force the metadata for this source file to be collected which
            // will recursively call start() populating the request map;
            this.cache.getMetadata(sourceFile);
            // If we still don't have the requested metadata, the file is not a module
            // or is a declaration file so return an empty map.
            result = this.requests.get(sourceFile.fileName) || new Map();
        }
        return result;
    }
    // MetadataTransformer
    connect(cache) {
        this.cache = cache;
    }
    start(sourceFile) {
        let identNumber = 0;
        const freshIdent = () => createLoweredSymbol(identNumber++);
        const requests = new Map();
        this.requests.set(sourceFile.fileName, requests);
        const replaceNode = (node) => {
            const name = freshIdent();
            requests.set(node.pos, { name, kind: node.kind, location: node.pos, end: node.end });
            return { __symbolic: 'reference', name };
        };
        const isExportedSymbol = (() => {
            let exportTable;
            return (node) => {
                if (node.kind == ts.SyntaxKind.Identifier) {
                    const ident = node;
                    if (!exportTable) {
                        exportTable = createExportTableFor(sourceFile);
                    }
                    return exportTable.has(ident.text);
                }
                return false;
            };
        })();
        const isExportedPropertyAccess = (node) => {
            if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const pae = node;
                if (isExportedSymbol(pae.expression)) {
                    return true;
                }
            }
            return false;
        };
        const hasLowerableParentCache = new Map();
        const shouldBeLowered = (node) => {
            if (node === undefined) {
                return false;
            }
            let lowerable = false;
            if ((node.kind === ts.SyntaxKind.ArrowFunction ||
                node.kind === ts.SyntaxKind.FunctionExpression) &&
                isEligibleForLowering(node)) {
                lowerable = true;
            }
            else if (isLiteralFieldNamed(node, this.lowerableFieldNames) && isEligibleForLowering(node) &&
                !isExportedSymbol(node) && !isExportedPropertyAccess(node)) {
                lowerable = true;
            }
            return lowerable;
        };
        const hasLowerableParent = (node) => {
            if (node === undefined) {
                return false;
            }
            if (!hasLowerableParentCache.has(node)) {
                hasLowerableParentCache.set(node, shouldBeLowered(node.parent) || hasLowerableParent(node.parent));
            }
            return hasLowerableParentCache.get(node);
        };
        const isLowerable = (node) => {
            if (node === undefined) {
                return false;
            }
            return shouldBeLowered(node) && !hasLowerableParent(node);
        };
        return (value, node) => {
            if (!isPrimitive(value) && !isRewritten(value) && isLowerable(node)) {
                return replaceNode(node);
            }
            return value;
        };
    }
}
function createExportTableFor(sourceFile) {
    const exportTable = new Set();
    // Lazily collect all the exports from the source file
    ts.forEachChild(sourceFile, function scan(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
                if ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) != 0) {
                    const classDeclaration = node;
                    const name = classDeclaration.name;
                    if (name)
                        exportTable.add(name.text);
                }
                break;
            case ts.SyntaxKind.VariableStatement:
                const variableStatement = node;
                for (const declaration of variableStatement.declarationList.declarations) {
                    scan(declaration);
                }
                break;
            case ts.SyntaxKind.VariableDeclaration:
                const variableDeclaration = node;
                if ((ts.getCombinedModifierFlags(variableDeclaration) & ts.ModifierFlags.Export) != 0 &&
                    variableDeclaration.name.kind == ts.SyntaxKind.Identifier) {
                    const name = variableDeclaration.name;
                    exportTable.add(name.text);
                }
                break;
            case ts.SyntaxKind.ExportDeclaration:
                const exportDeclaration = node;
                const { moduleSpecifier, exportClause } = exportDeclaration;
                if (!moduleSpecifier && exportClause && ts.isNamedExports(exportClause)) {
                    exportClause.elements.forEach(spec => {
                        exportTable.add(spec.name.text);
                    });
                }
        }
    });
    return exportTable;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG93ZXJfZXhwcmVzc2lvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL3RyYW5zZm9ybWVycy9sb3dlcl9leHByZXNzaW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsbUJBQW1CLEVBQUUsZUFBZSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDdkUsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFtQixtQ0FBbUMsRUFBbUQsTUFBTSxtQkFBbUIsQ0FBQztBQTZCMUksU0FBUyxLQUFLLENBQU8sS0FBVSxFQUFFLE1BQXNCO0lBQ3JELE9BQU8sSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RCxDQUFDO0FBRUQsb0ZBQW9GO0FBQ3BGLG9GQUFvRjtBQUNwRiw2QkFBNkI7QUFDN0IsU0FBUyxjQUFjLENBQUMsSUFBYTtJQUNuQyxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDakIsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQztRQUNqQyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUM7UUFDdEMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDO1FBQ3ZDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUM7UUFDbkMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDO1FBQ3BDLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUM7UUFDaEMsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQztRQUMvQixLQUFLLEVB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QUFDO2lCQUNKO1NBQ0o7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjcmVhdGVMb3dlcmVkU3ltYm9sLCBpc0xvd2VyZWRTeW1ib2x9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0NvbGxlY3Rvck9wdGlvbnMsIGlzTWV0YWRhdGFHbG9iYWxSZWZlcmVuY2VFeHByZXNzaW9uLCBNZXRhZGF0YUNvbGxlY3RvciwgTWV0YWRhdGFWYWx1ZSwgTW9kdWxlTWV0YWRhdGF9IGZyb20gJy4uL21ldGFkYXRhL2luZGV4JztcblxuaW1wb3J0IHtNZXRhZGF0YUNhY2hlLCBNZXRhZGF0YVRyYW5zZm9ybWVyLCBWYWx1ZVRyYW5zZm9ybX0gZnJvbSAnLi9tZXRhZGF0YV9jYWNoZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG93ZXJpbmdSZXF1ZXN0IHtcbiAga2luZDogdHMuU3ludGF4S2luZDtcbiAgbG9jYXRpb246IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgUmVxdWVzdExvY2F0aW9uTWFwID0gTWFwPG51bWJlciwgTG93ZXJpbmdSZXF1ZXN0PjtcblxuY29uc3QgZW51bSBEZWNsYXJhdGlvbk9yZGVyIHtcbiAgQmVmb3JlU3RtdCxcbiAgQWZ0ZXJTdG10XG59XG5cbmludGVyZmFjZSBEZWNsYXJhdGlvbiB7XG4gIG5hbWU6IHN0cmluZztcbiAgbm9kZTogdHMuTm9kZTtcbiAgb3JkZXI6IERlY2xhcmF0aW9uT3JkZXI7XG59XG5cbmludGVyZmFjZSBEZWNsYXJhdGlvbkluc2VydCB7XG4gIGRlY2xhcmF0aW9uczogRGVjbGFyYXRpb25bXTtcbiAgcmVsYXRpdmVUbzogdHMuTm9kZTtcbn1cblxuZnVuY3Rpb24gdG9NYXA8VCwgSz4oaXRlbXM6IFRbXSwgc2VsZWN0OiAoaXRlbTogVCkgPT4gSyk6IE1hcDxLLCBUPiB7XG4gIHJldHVybiBuZXcgTWFwKGl0ZW1zLm1hcDxbSywgVF0+KGkgPT4gW3NlbGVjdChpKSwgaV0pKTtcbn1cblxuLy8gV2Ugd2lsbCBuZXZlciBsb3dlciBleHByZXNzaW9ucyBpbiBhIG5lc3RlZCBsZXhpY2FsIHNjb3BlIHNvIGF2b2lkIGVudGVyaW5nIHRoZW0uXG4vLyBUaGlzIGFsc28gYXZvaWRzIGEgYnVnIGluIFR5cGVTY3JpcHQgMi4zIHdoZXJlIHRoZSBsZXhpY2FsIHNjb3BlcyBnZXQgb3V0IG9mIHN5bmNcbi8vIHdoZW4gdXNpbmcgdmlzaXRFYWNoQ2hpbGQuXG5mdW5jdGlvbiBpc0xleGljYWxTY29wZShub2RlOiB0cy5Ob2RlKTogYm9vbGVhbiB7XG4gIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkFycm93RnVuY3Rpb246XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkZ1bmN0aW9uRXhwcmVzc2lvbjpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuRnVuY3Rpb25EZWNsYXJhdGlvbjpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ2xhc3NFeHByZXNzaW9uOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbGFzc0RlY2xhcmF0aW9uOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvblR5cGU6XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlR5cGVMaXRlcmFsOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5BcnJheVR5cGU6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybVNvdXJjZUZpbGUoXG4gICAgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgcmVxdWVzdHM6IFJlcXVlc3RMb2NhdGlvbk1hcCxcbiAgICBjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpOiB0cy5Tb3VyY2VGaWxlIHtcbiAgY29uc3QgaW5zZXJ0czogRGVjbGFyYXRpb25JbnNlcnRbXSA9IFtdO1xuXG4gIC8vIENhbGN1bGF0ZSB0aGUgcmFuZ2Ugb2YgaW50ZXJlc3RpbmcgbG9jYXRpb25zLiBUaGUgdHJhbnNmb3JtIHdpbGwgb25seSB2aXNpdCBub2RlcyBpbiB0aGlzXG4gIC8vIHJhbmdlIHRvIGltcHJvdmUgdGhlIHBlcmZvcm1hbmNlIG9uIGxhcmdlIGZpbGVzLlxuICBjb25zdCBsb2NhdGlvbnMgPSBBcnJheS5mcm9tKHJlcXVlc3RzLmtleXMoKSk7XG4gIGNvbnN0IG1pbiA9IE1hdGgubWluKC4uLmxvY2F0aW9ucyk7XG4gIGNvbnN0IG1heCA9IE1hdGgubWF4KC4uLmxvY2F0aW9ucyk7XG5cbiAgLy8gVmlzaXQgbm9kZXMgbWF0Y2hpbmcgdGhlIHJlcXVlc3QgYW5kIHN5bnRoZXRpYyBub2RlcyBhZGRlZCBieSB0c2lja2xlXG4gIGZ1bmN0aW9uIHNob3VsZFZpc2l0KHBvczogbnVtYmVyLCBlbmQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiAocG9zIDw9IG1heCAmJiBlbmQgPj0gbWluKSB8fCBwb3MgPT0gLTE7XG4gIH1cblxuICBmdW5jdGlvbiB2aXNpdFNvdXJjZUZpbGUoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGUge1xuICAgIGZ1bmN0aW9uIHRvcExldmVsU3RhdGVtZW50KG5vZGU6IHRzLlN0YXRlbWVudCk6IHRzLlN0YXRlbWVudCB7XG4gICAgICBjb25zdCBkZWNsYXJhdGlvbnM6IERlY2xhcmF0aW9uW10gPSBbXTtcblxuICAgICAgZnVuY3Rpb24gdmlzaXROb2RlKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlIHtcbiAgICAgICAgLy8gR2V0IHRoZSBvcmlnaW5hbCBub2RlIGJlZm9yZSB0c2lja2xlXG4gICAgICAgIGNvbnN0IHtwb3MsIGVuZCwga2luZCwgcGFyZW50OiBvcmlnaW5hbFBhcmVudH0gPSB0cy5nZXRPcmlnaW5hbE5vZGUobm9kZSk7XG4gICAgICAgIGNvbnN0IG5vZGVSZXF1ZXN0ID0gcmVxdWVzdHMuZ2V0KHBvcyk7XG4gICAgICAgIGlmIChub2RlUmVxdWVzdCAmJiBub2RlUmVxdWVzdC5raW5kID09IGtpbmQgJiYgbm9kZVJlcXVlc3QuZW5kID09IGVuZCkge1xuICAgICAgICAgIC8vIFRoaXMgbm9kZSBpcyByZXF1ZXN0ZWQgdG8gYmUgcmV3cml0dGVuIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBleHBvcnRlZCBuYW1lLlxuICAgICAgICAgIGlmIChvcmlnaW5hbFBhcmVudCAmJiBvcmlnaW5hbFBhcmVudC5raW5kID09PSB0cy5TeW50YXhLaW5kLlZhcmlhYmxlRGVjbGFyYXRpb24pIHtcbiAgICAgICAgICAgIC8vIEFzIHRoZSB2YWx1ZSByZXByZXNlbnRzIHRoZSB3aG9sZSBpbml0aWFsaXplciBvZiBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uLFxuICAgICAgICAgICAgLy8ganVzdCByZWZlciB0byB0aGF0IHZhcmlhYmxlLiBUaGlzIGUuZy4gaGVscHMgdG8gcHJlc2VydmUgY2xvc3VyZSBjb21tZW50c1xuICAgICAgICAgICAgLy8gYXQgdGhlIHJpZ2h0IHBsYWNlLlxuICAgICAgICAgICAgY29uc3QgdmFyUGFyZW50ID0gb3JpZ2luYWxQYXJlbnQgYXMgdHMuVmFyaWFibGVEZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIGlmICh2YXJQYXJlbnQubmFtZS5raW5kID09PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgICAgICAgICAgY29uc3QgdmFyTmFtZSA9IHZhclBhcmVudC5uYW1lLnRleHQ7XG4gICAgICAgICAgICAgIGNvbnN0IGV4cG9ydE5hbWUgPSBub2RlUmVxdWVzdC5uYW1lO1xuICAgICAgICAgICAgICBkZWNsYXJhdGlvbnMucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogZXhwb3J0TmFtZSxcbiAgICAgICAgICAgICAgICBub2RlOiB0cy5jcmVhdGVJZGVudGlmaWVyKHZhck5hbWUpLFxuICAgICAgICAgICAgICAgIG9yZGVyOiBEZWNsYXJhdGlvbk9yZGVyLkFmdGVyU3RtdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJlY29yZCB0aGF0IHRoZSBub2RlIG5lZWRzIHRvIGJlIG1vdmVkIHRvIGFuIGV4cG9ydGVkIHZhcmlhYmxlIHdpdGggdGhlIGdpdmVuIG5hbWVcbiAgICAgICAgICBjb25zdCBleHBvcnROYW1lID0gbm9kZVJlcXVlc3QubmFtZTtcbiAgICAgICAgICBkZWNsYXJhdGlvbnMucHVzaCh7bmFtZTogZXhwb3J0TmFtZSwgbm9kZSwgb3JkZXI6IERlY2xhcmF0aW9uT3JkZXIuQmVmb3JlU3RtdH0pO1xuICAgICAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKGV4cG9ydE5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGxldCByZXN1bHQgPSBub2RlO1xuICAgICAgICBpZiAoc2hvdWxkVmlzaXQocG9zLCBlbmQpICYmICFpc0xleGljYWxTY29wZShub2RlKSkge1xuICAgICAgICAgIHJlc3VsdCA9IHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0Tm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IHRoZSBvcmlnaW5hbCBub2RlIGJlZm9yZSB0c2lja2xlXG4gICAgICBjb25zdCB7cG9zLCBlbmR9ID0gdHMuZ2V0T3JpZ2luYWxOb2RlKG5vZGUpO1xuICAgICAgbGV0IHJlc3VsdFN0bXQ6IHRzLlN0YXRlbWVudDtcbiAgICAgIGlmIChzaG91bGRWaXNpdChwb3MsIGVuZCkpIHtcbiAgICAgICAgcmVzdWx0U3RtdCA9IHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0Tm9kZSwgY29udGV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRTdG10ID0gbm9kZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaW5zZXJ0cy5wdXNoKHtyZWxhdGl2ZVRvOiByZXN1bHRTdG10LCBkZWNsYXJhdGlvbnN9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHRTdG10O1xuICAgIH1cblxuICAgIGxldCBuZXdTdGF0ZW1lbnRzID0gc291cmNlRmlsZS5zdGF0ZW1lbnRzLm1hcCh0b3BMZXZlbFN0YXRlbWVudCk7XG5cbiAgICBpZiAoaW5zZXJ0cy5sZW5ndGgpIHtcbiAgICAgIC8vIEluc2VydCB0aGUgZGVjbGFyYXRpb25zIHJlbGF0aXZlIHRvIHRoZSByZXdyaXR0ZW4gc3RhdGVtZW50IHRoYXQgcmVmZXJlbmNlcyB0aGVtLlxuICAgICAgY29uc3QgaW5zZXJ0TWFwID0gdG9NYXAoaW5zZXJ0cywgaSA9PiBpLnJlbGF0aXZlVG8pO1xuICAgICAgY29uc3QgdG1wU3RhdGVtZW50czogdHMuU3RhdGVtZW50W10gPSBbXTtcbiAgICAgIG5ld1N0YXRlbWVudHMuZm9yRWFjaChzdGF0ZW1lbnQgPT4ge1xuICAgICAgICBjb25zdCBpbnNlcnQgPSBpbnNlcnRNYXAuZ2V0KHN0YXRlbWVudCk7XG4gICAgICAgIGlmIChpbnNlcnQpIHtcbiAgICAgICAgICBjb25zdCBiZWZvcmUgPSBpbnNlcnQuZGVjbGFyYXRpb25zLmZpbHRlcihkID0+IGQub3JkZXIgPT09IERlY2xhcmF0aW9uT3JkZXIuQmVmb3JlU3RtdCk7XG4gICAgICAgICAgaWYgKGJlZm9yZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRtcFN0YXRlbWVudHMucHVzaChjcmVhdGVWYXJpYWJsZVN0YXRlbWVudEZvckRlY2xhcmF0aW9ucyhiZWZvcmUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdG1wU3RhdGVtZW50cy5wdXNoKHN0YXRlbWVudCk7XG4gICAgICAgICAgY29uc3QgYWZ0ZXIgPSBpbnNlcnQuZGVjbGFyYXRpb25zLmZpbHRlcihkID0+IGQub3JkZXIgPT09IERlY2xhcmF0aW9uT3JkZXIuQWZ0ZXJTdG10KTtcbiAgICAgICAgICBpZiAoYWZ0ZXIubGVuZ3RoKSB7XG4gICAgICAgICAgICB0bXBTdGF0ZW1lbnRzLnB1c2goY3JlYXRlVmFyaWFibGVTdGF0ZW1lbnRGb3JEZWNsYXJhdGlvbnMoYWZ0ZXIpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG1wU3RhdGVtZW50cy5wdXNoKHN0YXRlbWVudCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBJbnNlcnQgYW4gZXhwb3J0cyBjbGF1c2UgdG8gZXhwb3J0IHRoZSBkZWNsYXJhdGlvbnNcbiAgICAgIHRtcFN0YXRlbWVudHMucHVzaCh0cy5jcmVhdGVFeHBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgIHRzLmNyZWF0ZU5hbWVkRXhwb3J0cyhcbiAgICAgICAgICAgICAgaW5zZXJ0c1xuICAgICAgICAgICAgICAgICAgLnJlZHVjZShcbiAgICAgICAgICAgICAgICAgICAgICAoYWNjdW11bGF0b3IsIGluc2VydCkgPT4gWy4uLmFjY3VtdWxhdG9yLCAuLi5pbnNlcnQuZGVjbGFyYXRpb25zXSxcbiAgICAgICAgICAgICAgICAgICAgICBbXSBhcyBEZWNsYXJhdGlvbltdKVxuICAgICAgICAgICAgICAgICAgLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICBkZWNsYXJhdGlvbiA9PiB0cy5jcmVhdGVFeHBvcnRTcGVjaWZpZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8qIHByb3BlcnR5TmFtZSAqLyB1bmRlZmluZWQsIGRlY2xhcmF0aW9uLm5hbWUpKSkpKTtcblxuICAgICAgbmV3U3RhdGVtZW50cyA9IHRtcFN0YXRlbWVudHM7XG4gICAgfVxuXG4gICAgY29uc3QgbmV3U2YgPSB0cy51cGRhdGVTb3VyY2VGaWxlTm9kZShcbiAgICAgICAgc291cmNlRmlsZSwgdHMuc2V0VGV4dFJhbmdlKHRzLmNyZWF0ZU5vZGVBcnJheShuZXdTdGF0ZW1lbnRzKSwgc291cmNlRmlsZS5zdGF0ZW1lbnRzKSk7XG4gICAgaWYgKCEoc291cmNlRmlsZS5mbGFncyAmIHRzLk5vZGVGbGFncy5TeW50aGVzaXplZCkpIHtcbiAgICAgIChuZXdTZi5mbGFncyBhcyB0cy5Ob2RlRmxhZ3MpICY9IH50cy5Ob2RlRmxhZ3MuU3ludGhlc2l6ZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1NmO1xuICB9XG5cbiAgcmV0dXJuIHZpc2l0U291cmNlRmlsZShzb3VyY2VGaWxlKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVmFyaWFibGVTdGF0ZW1lbnRGb3JEZWNsYXJhdGlvbnMoZGVjbGFyYXRpb25zOiBEZWNsYXJhdGlvbltdKTogdHMuVmFyaWFibGVTdGF0ZW1lbnQge1xuICBjb25zdCB2YXJEZWNscyA9IGRlY2xhcmF0aW9ucy5tYXAoXG4gICAgICBpID0+IHRzLmNyZWF0ZVZhcmlhYmxlRGVjbGFyYXRpb24oaS5uYW1lLCAvKiB0eXBlICovIHVuZGVmaW5lZCwgaS5ub2RlIGFzIHRzLkV4cHJlc3Npb24pKTtcbiAgcmV0dXJuIHRzLmNyZWF0ZVZhcmlhYmxlU3RhdGVtZW50KFxuICAgICAgLyogbW9kaWZpZXJzICovIHVuZGVmaW5lZCwgdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbkxpc3QodmFyRGVjbHMsIHRzLk5vZGVGbGFncy5Db25zdCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RXhwcmVzc2lvbkxvd2VyaW5nVHJhbnNmb3JtRmFjdG9yeShcbiAgICByZXF1ZXN0c01hcDogUmVxdWVzdHNNYXAsIHByb2dyYW06IHRzLlByb2dyYW0pOiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PlxuICAgIChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB0cy5Tb3VyY2VGaWxlIHtcbiAgLy8gUmV0dXJuIHRoZSBmYWN0b3J5XG4gIHJldHVybiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGUgPT4ge1xuICAgIC8vIFdlIG5lZWQgdG8gdXNlIHRoZSBvcmlnaW5hbCBTb3VyY2VGaWxlIGZvciByZWFkaW5nIG1ldGFkYXRhLCBhbmQgbm90IHRoZSB0cmFuc2Zvcm1lZCBvbmUuXG4gICAgY29uc3Qgb3JpZ2luYWxGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICAgIGlmIChvcmlnaW5hbEZpbGUpIHtcbiAgICAgIGNvbnN0IHJlcXVlc3RzID0gcmVxdWVzdHNNYXAuZ2V0UmVxdWVzdHMob3JpZ2luYWxGaWxlKTtcbiAgICAgIGlmIChyZXF1ZXN0cyAmJiByZXF1ZXN0cy5zaXplKSB7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1Tb3VyY2VGaWxlKHNvdXJjZUZpbGUsIHJlcXVlc3RzLCBjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNvdXJjZUZpbGU7XG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVxdWVzdHNNYXAge1xuICBnZXRSZXF1ZXN0cyhzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogUmVxdWVzdExvY2F0aW9uTWFwO1xufVxuXG5mdW5jdGlvbiBpc0VsaWdpYmxlRm9yTG93ZXJpbmcobm9kZTogdHMuTm9kZXx1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgaWYgKG5vZGUpIHtcbiAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlNvdXJjZUZpbGU6XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRGVjb3JhdG9yOlxuICAgICAgICAvLyBMb3dlciBleHByZXNzaW9ucyB0aGF0IGFyZSBsb2NhbCB0byB0aGUgbW9kdWxlIHNjb3BlIG9yXG4gICAgICAgIC8vIGluIGEgZGVjb3JhdG9yLlxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbGFzc0RlY2xhcmF0aW9uOlxuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkludGVyZmFjZURlY2xhcmF0aW9uOlxuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkVudW1EZWNsYXJhdGlvbjpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvbkRlY2xhcmF0aW9uOlxuICAgICAgICAvLyBEb24ndCBsb3dlciBleHByZXNzaW9ucyBpbiBhIGRlY2xhcmF0aW9uLlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVmFyaWFibGVEZWNsYXJhdGlvbjpcbiAgICAgICAgY29uc3QgaXNFeHBvcnRlZCA9ICh0cy5nZXRDb21iaW5lZE1vZGlmaWVyRmxhZ3Mobm9kZSBhcyB0cy5WYXJpYWJsZURlY2xhcmF0aW9uKSAmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuTW9kaWZpZXJGbGFncy5FeHBvcnQpID09IDA7XG4gICAgICAgIC8vIFRoaXMgbWlnaHQgYmUgdW5uZWNlc3NhcnksIGFzIHRoZSB2YXJpYWJsZSBtaWdodCBiZSBleHBvcnRlZCBhbmQgb25seSB1c2VkIGFzIGEgcmVmZXJlbmNlXG4gICAgICAgIC8vIGluIGFub3RoZXIgZXhwcmVzc2lvbi4gSG93ZXZlciwgdGhlIHZhcmlhYmxlIGFsc28gbWlnaHQgYmUgaW52b2x2ZWQgaW4gcHJvdmlkZXJcbiAgICAgICAgLy8gZGVmaW5pdGlvbnMuIElmIHRoYXQncyB0aGUgY2FzZSwgdGhlcmUgaXMgYSBzcGVjaWZpYyB0b2tlbiAoYFJPVVRFU2ApIHdoaWNoIHRoZSBjb21waWxlclxuICAgICAgICAvLyBhdHRlbXB0cyB0byB1bmRlcnN0YW5kIGRlZXBseS4gU3ViLWV4cHJlc3Npb25zIHdpdGhpbiB0aGF0IHRva2VuIChgbG9hZENoaWxkcmVuYCBmb3JcbiAgICAgICAgLy8gZXhhbXBsZSkgbWlnaHQgYWxzbyByZXF1aXJlIGxvd2VyaW5nIGV2ZW4gaWYgdGhlIHRvcC1sZXZlbCBkZWNsYXJhdGlvbiBpcyBhbHJlYWR5XG4gICAgICAgIC8vIHByb3Blcmx5IGV4cG9ydGVkLlxuICAgICAgICBjb25zdCB2YXJOb2RlID0gbm9kZSBhcyB0cy5WYXJpYWJsZURlY2xhcmF0aW9uO1xuICAgICAgICByZXR1cm4gaXNFeHBvcnRlZCB8fFxuICAgICAgICAgICAgKHZhck5vZGUuaW5pdGlhbGl6ZXIgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgICh0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKHZhck5vZGUuaW5pdGlhbGl6ZXIpIHx8XG4gICAgICAgICAgICAgIHRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbih2YXJOb2RlLmluaXRpYWxpemVyKSB8fFxuICAgICAgICAgICAgICB0cy5pc0NhbGxFeHByZXNzaW9uKHZhck5vZGUuaW5pdGlhbGl6ZXIpKSk7XG4gICAgfVxuICAgIHJldHVybiBpc0VsaWdpYmxlRm9yTG93ZXJpbmcobm9kZS5wYXJlbnQpO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZSh2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBPYmplY3QodmFsdWUpICE9PSB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gaXNSZXdyaXR0ZW4odmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNNZXRhZGF0YUdsb2JhbFJlZmVyZW5jZUV4cHJlc3Npb24odmFsdWUpICYmIGlzTG93ZXJlZFN5bWJvbCh2YWx1ZS5uYW1lKTtcbn1cblxuZnVuY3Rpb24gaXNMaXRlcmFsRmllbGROYW1lZChub2RlOiB0cy5Ob2RlLCBuYW1lczogU2V0PHN0cmluZz4pOiBib29sZWFuIHtcbiAgaWYgKG5vZGUucGFyZW50ICYmIG5vZGUucGFyZW50LmtpbmQgPT0gdHMuU3ludGF4S2luZC5Qcm9wZXJ0eUFzc2lnbm1lbnQpIHtcbiAgICBjb25zdCBwcm9wZXJ0eSA9IG5vZGUucGFyZW50IGFzIHRzLlByb3BlcnR5QXNzaWdubWVudDtcbiAgICBpZiAocHJvcGVydHkucGFyZW50ICYmIHByb3BlcnR5LnBhcmVudC5raW5kID09IHRzLlN5bnRheEtpbmQuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24gJiZcbiAgICAgICAgcHJvcGVydHkubmFtZSAmJiBwcm9wZXJ0eS5uYW1lLmtpbmQgPT0gdHMuU3ludGF4S2luZC5JZGVudGlmaWVyKSB7XG4gICAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eS5uYW1lIGFzIHRzLklkZW50aWZpZXI7XG4gICAgICByZXR1cm4gbmFtZXMuaGFzKHByb3BlcnR5TmFtZS50ZXh0KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgY2xhc3MgTG93ZXJNZXRhZGF0YVRyYW5zZm9ybSBpbXBsZW1lbnRzIFJlcXVlc3RzTWFwLCBNZXRhZGF0YVRyYW5zZm9ybWVyIHtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgY2FjaGUhOiBNZXRhZGF0YUNhY2hlO1xuICBwcml2YXRlIHJlcXVlc3RzID0gbmV3IE1hcDxzdHJpbmcsIFJlcXVlc3RMb2NhdGlvbk1hcD4oKTtcbiAgcHJpdmF0ZSBsb3dlcmFibGVGaWVsZE5hbWVzOiBTZXQ8c3RyaW5nPjtcblxuICBjb25zdHJ1Y3Rvcihsb3dlcmFibGVGaWVsZE5hbWVzOiBzdHJpbmdbXSkge1xuICAgIHRoaXMubG93ZXJhYmxlRmllbGROYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPihsb3dlcmFibGVGaWVsZE5hbWVzKTtcbiAgfVxuXG4gIC8vIFJlcXVlc3RNYXBcbiAgZ2V0UmVxdWVzdHMoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IFJlcXVlc3RMb2NhdGlvbk1hcCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucmVxdWVzdHMuZ2V0KHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAvLyBGb3JjZSB0aGUgbWV0YWRhdGEgZm9yIHRoaXMgc291cmNlIGZpbGUgdG8gYmUgY29sbGVjdGVkIHdoaWNoXG4gICAgICAvLyB3aWxsIHJlY3Vyc2l2ZWx5IGNhbGwgc3RhcnQoKSBwb3B1bGF0aW5nIHRoZSByZXF1ZXN0IG1hcDtcbiAgICAgIHRoaXMuY2FjaGUuZ2V0TWV0YWRhdGEoc291cmNlRmlsZSk7XG5cbiAgICAgIC8vIElmIHdlIHN0aWxsIGRvbid0IGhhdmUgdGhlIHJlcXVlc3RlZCBtZXRhZGF0YSwgdGhlIGZpbGUgaXMgbm90IGEgbW9kdWxlXG4gICAgICAvLyBvciBpcyBhIGRlY2xhcmF0aW9uIGZpbGUgc28gcmV0dXJuIGFuIGVtcHR5IG1hcC5cbiAgICAgIHJlc3VsdCA9IHRoaXMucmVxdWVzdHMuZ2V0KHNvdXJjZUZpbGUuZmlsZU5hbWUpIHx8IG5ldyBNYXA8bnVtYmVyLCBMb3dlcmluZ1JlcXVlc3Q+KCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBNZXRhZGF0YVRyYW5zZm9ybWVyXG4gIGNvbm5lY3QoY2FjaGU6IE1ldGFkYXRhQ2FjaGUpOiB2b2lkIHtcbiAgICB0aGlzLmNhY2hlID0gY2FjaGU7XG4gIH1cblxuICBzdGFydChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogVmFsdWVUcmFuc2Zvcm18dW5kZWZpbmVkIHtcbiAgICBsZXQgaWRlbnROdW1iZXIgPSAwO1xuICAgIGNvbnN0IGZyZXNoSWRlbnQgPSAoKSA9PiBjcmVhdGVMb3dlcmVkU3ltYm9sKGlkZW50TnVtYmVyKyspO1xuICAgIGNvbnN0IHJlcXVlc3RzID0gbmV3IE1hcDxudW1iZXIsIExvd2VyaW5nUmVxdWVzdD4oKTtcbiAgICB0aGlzLnJlcXVlc3RzLnNldChzb3VyY2VGaWxlLmZpbGVOYW1lLCByZXF1ZXN0cyk7XG5cbiAgICBjb25zdCByZXBsYWNlTm9kZSA9IChub2RlOiB0cy5Ob2RlKSA9PiB7XG4gICAgICBjb25zdCBuYW1lID0gZnJlc2hJZGVudCgpO1xuICAgICAgcmVxdWVzdHMuc2V0KG5vZGUucG9zLCB7bmFtZSwga2luZDogbm9kZS5raW5kLCBsb2NhdGlvbjogbm9kZS5wb3MsIGVuZDogbm9kZS5lbmR9KTtcbiAgICAgIHJldHVybiB7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG5hbWV9O1xuICAgIH07XG5cbiAgICBjb25zdCBpc0V4cG9ydGVkU3ltYm9sID0gKCgpID0+IHtcbiAgICAgIGxldCBleHBvcnRUYWJsZTogU2V0PHN0cmluZz47XG4gICAgICByZXR1cm4gKG5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICAgICAgaWYgKG5vZGUua2luZCA9PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgICAgICBjb25zdCBpZGVudCA9IG5vZGUgYXMgdHMuSWRlbnRpZmllcjtcblxuICAgICAgICAgIGlmICghZXhwb3J0VGFibGUpIHtcbiAgICAgICAgICAgIGV4cG9ydFRhYmxlID0gY3JlYXRlRXhwb3J0VGFibGVGb3Ioc291cmNlRmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBleHBvcnRUYWJsZS5oYXMoaWRlbnQudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfTtcbiAgICB9KSgpO1xuXG4gICAgY29uc3QgaXNFeHBvcnRlZFByb3BlcnR5QWNjZXNzID0gKG5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICAgIGlmIChub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IHBhZSA9IG5vZGUgYXMgdHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uO1xuICAgICAgICBpZiAoaXNFeHBvcnRlZFN5bWJvbChwYWUuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBjb25zdCBoYXNMb3dlcmFibGVQYXJlbnRDYWNoZSA9IG5ldyBNYXA8dHMuTm9kZSwgYm9vbGVhbj4oKTtcblxuICAgIGNvbnN0IHNob3VsZEJlTG93ZXJlZCA9IChub2RlOiB0cy5Ob2RlfHVuZGVmaW5lZCk6IGJvb2xlYW4gPT4ge1xuICAgICAgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBsZXQgbG93ZXJhYmxlOiBib29sZWFuID0gZmFsc2U7XG4gICAgICBpZiAoKG5vZGUua2luZCA9PT0gdHMuU3ludGF4S2luZC5BcnJvd0Z1bmN0aW9uIHx8XG4gICAgICAgICAgIG5vZGUua2luZCA9PT0gdHMuU3ludGF4S2luZC5GdW5jdGlvbkV4cHJlc3Npb24pICYmXG4gICAgICAgICAgaXNFbGlnaWJsZUZvckxvd2VyaW5nKG5vZGUpKSB7XG4gICAgICAgIGxvd2VyYWJsZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgIGlzTGl0ZXJhbEZpZWxkTmFtZWQobm9kZSwgdGhpcy5sb3dlcmFibGVGaWVsZE5hbWVzKSAmJiBpc0VsaWdpYmxlRm9yTG93ZXJpbmcobm9kZSkgJiZcbiAgICAgICAgICAhaXNFeHBvcnRlZFN5bWJvbChub2RlKSAmJiAhaXNFeHBvcnRlZFByb3BlcnR5QWNjZXNzKG5vZGUpKSB7XG4gICAgICAgIGxvd2VyYWJsZSA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gbG93ZXJhYmxlO1xuICAgIH07XG5cbiAgICBjb25zdCBoYXNMb3dlcmFibGVQYXJlbnQgPSAobm9kZTogdHMuTm9kZXx1bmRlZmluZWQpOiBib29sZWFuID0+IHtcbiAgICAgIGlmIChub2RlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFoYXNMb3dlcmFibGVQYXJlbnRDYWNoZS5oYXMobm9kZSkpIHtcbiAgICAgICAgaGFzTG93ZXJhYmxlUGFyZW50Q2FjaGUuc2V0KFxuICAgICAgICAgICAgbm9kZSwgc2hvdWxkQmVMb3dlcmVkKG5vZGUucGFyZW50KSB8fCBoYXNMb3dlcmFibGVQYXJlbnQobm9kZS5wYXJlbnQpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBoYXNMb3dlcmFibGVQYXJlbnRDYWNoZS5nZXQobm9kZSkhO1xuICAgIH07XG5cbiAgICBjb25zdCBpc0xvd2VyYWJsZSA9IChub2RlOiB0cy5Ob2RlfHVuZGVmaW5lZCk6IGJvb2xlYW4gPT4ge1xuICAgICAgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hvdWxkQmVMb3dlcmVkKG5vZGUpICYmICFoYXNMb3dlcmFibGVQYXJlbnQobm9kZSk7XG4gICAgfTtcblxuICAgIHJldHVybiAodmFsdWU6IE1ldGFkYXRhVmFsdWUsIG5vZGU6IHRzLk5vZGUpOiBNZXRhZGF0YVZhbHVlID0+IHtcbiAgICAgIGlmICghaXNQcmltaXRpdmUodmFsdWUpICYmICFpc1Jld3JpdHRlbih2YWx1ZSkgJiYgaXNMb3dlcmFibGUobm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIHJlcGxhY2VOb2RlKG5vZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlRXhwb3J0VGFibGVGb3Ioc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IFNldDxzdHJpbmc+IHtcbiAgY29uc3QgZXhwb3J0VGFibGUgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgLy8gTGF6aWx5IGNvbGxlY3QgYWxsIHRoZSBleHBvcnRzIGZyb20gdGhlIHNvdXJjZSBmaWxlXG4gIHRzLmZvckVhY2hDaGlsZChzb3VyY2VGaWxlLCBmdW5jdGlvbiBzY2FuKG5vZGUpIHtcbiAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkNsYXNzRGVjbGFyYXRpb246XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRnVuY3Rpb25EZWNsYXJhdGlvbjpcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5JbnRlcmZhY2VEZWNsYXJhdGlvbjpcbiAgICAgICAgaWYgKCh0cy5nZXRDb21iaW5lZE1vZGlmaWVyRmxhZ3Mobm9kZSBhcyB0cy5EZWNsYXJhdGlvbikgJiB0cy5Nb2RpZmllckZsYWdzLkV4cG9ydCkgIT0gMCkge1xuICAgICAgICAgIGNvbnN0IGNsYXNzRGVjbGFyYXRpb24gPVxuICAgICAgICAgICAgICBub2RlIGFzICh0cy5DbGFzc0RlY2xhcmF0aW9uIHwgdHMuRnVuY3Rpb25EZWNsYXJhdGlvbiB8IHRzLkludGVyZmFjZURlY2xhcmF0aW9uKTtcbiAgICAgICAgICBjb25zdCBuYW1lID0gY2xhc3NEZWNsYXJhdGlvbi5uYW1lO1xuICAgICAgICAgIGlmIChuYW1lKSBleHBvcnRUYWJsZS5hZGQobmFtZS50ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5WYXJpYWJsZVN0YXRlbWVudDpcbiAgICAgICAgY29uc3QgdmFyaWFibGVTdGF0ZW1lbnQgPSBub2RlIGFzIHRzLlZhcmlhYmxlU3RhdGVtZW50O1xuICAgICAgICBmb3IgKGNvbnN0IGRlY2xhcmF0aW9uIG9mIHZhcmlhYmxlU3RhdGVtZW50LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgICBzY2FuKGRlY2xhcmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5WYXJpYWJsZURlY2xhcmF0aW9uOlxuICAgICAgICBjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9uID0gbm9kZSBhcyB0cy5WYXJpYWJsZURlY2xhcmF0aW9uO1xuICAgICAgICBpZiAoKHRzLmdldENvbWJpbmVkTW9kaWZpZXJGbGFncyh2YXJpYWJsZURlY2xhcmF0aW9uKSAmIHRzLk1vZGlmaWVyRmxhZ3MuRXhwb3J0KSAhPSAwICYmXG4gICAgICAgICAgICB2YXJpYWJsZURlY2xhcmF0aW9uLm5hbWUua2luZCA9PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgICAgICBjb25zdCBuYW1lID0gdmFyaWFibGVEZWNsYXJhdGlvbi5uYW1lIGFzIHRzLklkZW50aWZpZXI7XG4gICAgICAgICAgZXhwb3J0VGFibGUuYWRkKG5hbWUudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRXhwb3J0RGVjbGFyYXRpb246XG4gICAgICAgIGNvbnN0IGV4cG9ydERlY2xhcmF0aW9uID0gbm9kZSBhcyB0cy5FeHBvcnREZWNsYXJhdGlvbjtcbiAgICAgICAgY29uc3Qge21vZHVsZVNwZWNpZmllciwgZXhwb3J0Q2xhdXNlfSA9IGV4cG9ydERlY2xhcmF0aW9uO1xuICAgICAgICBpZiAoIW1vZHVsZVNwZWNpZmllciAmJiBleHBvcnRDbGF1c2UgJiYgdHMuaXNOYW1lZEV4cG9ydHMoZXhwb3J0Q2xhdXNlKSkge1xuICAgICAgICAgIGV4cG9ydENsYXVzZS5lbGVtZW50cy5mb3JFYWNoKHNwZWMgPT4ge1xuICAgICAgICAgICAgZXhwb3J0VGFibGUuYWRkKHNwZWMubmFtZS50ZXh0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHJldHVybiBleHBvcnRUYWJsZTtcbn1cbiJdfQ==