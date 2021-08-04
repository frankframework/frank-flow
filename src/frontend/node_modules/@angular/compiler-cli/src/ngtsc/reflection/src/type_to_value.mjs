/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
/**
 * Potentially convert a `ts.TypeNode` to a `TypeValueReference`, which indicates how to use the
 * type given in the `ts.TypeNode` in a value position.
 *
 * This can return `null` if the `typeNode` is `null`, if it does not refer to a symbol with a value
 * declaration, or if it is not possible to statically understand.
 */
export function typeToValue(typeNode, checker) {
    // It's not possible to get a value expression if the parameter doesn't even have a type.
    if (typeNode === null) {
        return missingType();
    }
    if (!ts.isTypeReferenceNode(typeNode)) {
        return unsupportedType(typeNode);
    }
    const symbols = resolveTypeSymbols(typeNode, checker);
    if (symbols === null) {
        return unknownReference(typeNode);
    }
    const { local, decl } = symbols;
    // It's only valid to convert a type reference to a value reference if the type actually
    // has a value declaration associated with it. Note that const enums are an exception,
    // because while they do have a value declaration, they don't exist at runtime.
    if (decl.valueDeclaration === undefined || decl.flags & ts.SymbolFlags.ConstEnum) {
        let typeOnlyDecl = null;
        if (decl.declarations !== undefined && decl.declarations.length > 0) {
            typeOnlyDecl = decl.declarations[0];
        }
        return noValueDeclaration(typeNode, typeOnlyDecl);
    }
    // The type points to a valid value declaration. Rewrite the TypeReference into an
    // Expression which references the value pointed to by the TypeReference, if possible.
    // Look at the local `ts.Symbol`'s declarations and see if it comes from an import
    // statement. If so, extract the module specifier and the name of the imported type.
    const firstDecl = local.declarations && local.declarations[0];
    if (firstDecl !== undefined) {
        if (ts.isImportClause(firstDecl) && firstDecl.name !== undefined) {
            // This is a default import.
            //   import Foo from 'foo';
            if (firstDecl.isTypeOnly) {
                // Type-only imports cannot be represented as value.
                return typeOnlyImport(typeNode, firstDecl);
            }
            return {
                kind: 0 /* LOCAL */,
                expression: firstDecl.name,
                defaultImportStatement: firstDecl.parent,
            };
        }
        else if (ts.isImportSpecifier(firstDecl)) {
            // The symbol was imported by name
            //   import {Foo} from 'foo';
            // or
            //   import {Foo as Bar} from 'foo';
            if (firstDecl.parent.parent.isTypeOnly) {
                // Type-only imports cannot be represented as value.
                return typeOnlyImport(typeNode, firstDecl.parent.parent);
            }
            // Determine the name to import (`Foo`) from the import specifier, as the symbol names of
            // the imported type could refer to a local alias (like `Bar` in the example above).
            const importedName = (firstDecl.propertyName || firstDecl.name).text;
            // The first symbol name refers to the local name, which is replaced by `importedName` above.
            // Any remaining symbol names make up the complete path to the value.
            const [_localName, ...nestedPath] = symbols.symbolNames;
            const moduleName = extractModuleName(firstDecl.parent.parent.parent);
            return {
                kind: 1 /* IMPORTED */,
                valueDeclaration: decl.valueDeclaration,
                moduleName,
                importedName,
                nestedPath
            };
        }
        else if (ts.isNamespaceImport(firstDecl)) {
            // The import is a namespace import
            //   import * as Foo from 'foo';
            if (firstDecl.parent.isTypeOnly) {
                // Type-only imports cannot be represented as value.
                return typeOnlyImport(typeNode, firstDecl.parent);
            }
            if (symbols.symbolNames.length === 1) {
                // The type refers to the namespace itself, which cannot be represented as a value.
                return namespaceImport(typeNode, firstDecl.parent);
            }
            // The first symbol name refers to the local name of the namespace, which is is discarded
            // as a new namespace import will be generated. This is followed by the symbol name that needs
            // to be imported and any remaining names that constitute the complete path to the value.
            const [_ns, importedName, ...nestedPath] = symbols.symbolNames;
            const moduleName = extractModuleName(firstDecl.parent.parent);
            return {
                kind: 1 /* IMPORTED */,
                valueDeclaration: decl.valueDeclaration,
                moduleName,
                importedName,
                nestedPath
            };
        }
    }
    // If the type is not imported, the type reference can be converted into an expression as is.
    const expression = typeNodeToValueExpr(typeNode);
    if (expression !== null) {
        return {
            kind: 0 /* LOCAL */,
            expression,
            defaultImportStatement: null,
        };
    }
    else {
        return unsupportedType(typeNode);
    }
}
function unsupportedType(typeNode) {
    return {
        kind: 2 /* UNAVAILABLE */,
        reason: { kind: 5 /* UNSUPPORTED */, typeNode },
    };
}
function noValueDeclaration(typeNode, decl) {
    return {
        kind: 2 /* UNAVAILABLE */,
        reason: { kind: 1 /* NO_VALUE_DECLARATION */, typeNode, decl },
    };
}
function typeOnlyImport(typeNode, importClause) {
    return {
        kind: 2 /* UNAVAILABLE */,
        reason: { kind: 2 /* TYPE_ONLY_IMPORT */, typeNode, importClause },
    };
}
function unknownReference(typeNode) {
    return {
        kind: 2 /* UNAVAILABLE */,
        reason: { kind: 3 /* UNKNOWN_REFERENCE */, typeNode },
    };
}
function namespaceImport(typeNode, importClause) {
    return {
        kind: 2 /* UNAVAILABLE */,
        reason: { kind: 4 /* NAMESPACE */, typeNode, importClause },
    };
}
function missingType() {
    return {
        kind: 2 /* UNAVAILABLE */,
        reason: { kind: 0 /* MISSING_TYPE */ },
    };
}
/**
 * Attempt to extract a `ts.Expression` that's equivalent to a `ts.TypeNode`, as the two have
 * different AST shapes but can reference the same symbols.
 *
 * This will return `null` if an equivalent expression cannot be constructed.
 */
export function typeNodeToValueExpr(node) {
    if (ts.isTypeReferenceNode(node)) {
        return entityNameToValue(node.typeName);
    }
    else {
        return null;
    }
}
/**
 * Resolve a `TypeReference` node to the `ts.Symbol`s for both its declaration and its local source.
 *
 * In the event that the `TypeReference` refers to a locally declared symbol, these will be the
 * same. If the `TypeReference` refers to an imported symbol, then `decl` will be the fully resolved
 * `ts.Symbol` of the referenced symbol. `local` will be the `ts.Symbol` of the `ts.Identifier`
 * which points to the import statement by which the symbol was imported.
 *
 * All symbol names that make up the type reference are returned left-to-right into the
 * `symbolNames` array, which is guaranteed to include at least one entry.
 */
function resolveTypeSymbols(typeRef, checker) {
    const typeName = typeRef.typeName;
    // typeRefSymbol is the ts.Symbol of the entire type reference.
    const typeRefSymbol = checker.getSymbolAtLocation(typeName);
    if (typeRefSymbol === undefined) {
        return null;
    }
    // `local` is the `ts.Symbol` for the local `ts.Identifier` for the type.
    // If the type is actually locally declared or is imported by name, for example:
    //   import {Foo} from './foo';
    // then it'll be the same as `typeRefSymbol`.
    //
    // If the type is imported via a namespace import, for example:
    //   import * as foo from './foo';
    // and then referenced as:
    //   constructor(f: foo.Foo)
    // then `local` will be the `ts.Symbol` of `foo`, whereas `typeRefSymbol` will be the `ts.Symbol`
    // of `foo.Foo`. This allows tracking of the import behind whatever type reference exists.
    let local = typeRefSymbol;
    // Destructure a name like `foo.X.Y.Z` as follows:
    // - in `leftMost`, the `ts.Identifier` of the left-most name (`foo`) in the qualified name.
    //   This identifier is used to resolve the `ts.Symbol` for `local`.
    // - in `symbolNames`, all names involved in the qualified path, or a single symbol name if the
    //   type is not qualified.
    let leftMost = typeName;
    const symbolNames = [];
    while (ts.isQualifiedName(leftMost)) {
        symbolNames.unshift(leftMost.right.text);
        leftMost = leftMost.left;
    }
    symbolNames.unshift(leftMost.text);
    if (leftMost !== typeName) {
        const localTmp = checker.getSymbolAtLocation(leftMost);
        if (localTmp !== undefined) {
            local = localTmp;
        }
    }
    // De-alias the top-level type reference symbol to get the symbol of the actual declaration.
    let decl = typeRefSymbol;
    if (typeRefSymbol.flags & ts.SymbolFlags.Alias) {
        decl = checker.getAliasedSymbol(typeRefSymbol);
    }
    return { local, decl, symbolNames };
}
function entityNameToValue(node) {
    if (ts.isQualifiedName(node)) {
        const left = entityNameToValue(node.left);
        return left !== null ? ts.createPropertyAccess(left, node.right) : null;
    }
    else if (ts.isIdentifier(node)) {
        return ts.getMutableClone(node);
    }
    else {
        return null;
    }
}
function extractModuleName(node) {
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
        throw new Error('not a module specifier');
    }
    return node.moduleSpecifier.text;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV90b192YWx1ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcmVmbGVjdGlvbi9zcmMvdHlwZV90b192YWx1ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUlqQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUN2QixRQUEwQixFQUFFLE9BQXVCO0lBQ3JELHlGQUF5RjtJQUN6RixJQUFJLFFBQVEsS0FBSyxJQUFJLEVBQUU7UUFDckIsT0FBTyxXQUFXLEVBQUUsQ0FBQztLQUN0QjtJQUVELElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDckMsT0FBTyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbEM7SUFFRCxNQUFNLE9BQU8sR0FBRyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdEQsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1FBQ3BCLE9BQU8sZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbkM7SUFFRCxNQUFNLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBQyxHQUFHLE9BQU8sQ0FBQztJQUM5Qix3RkFBd0Y7SUFDeEYsc0ZBQXNGO0lBQ3RGLCtFQUErRTtJQUMvRSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRTtRQUNoRixJQUFJLFlBQVksR0FBd0IsSUFBSSxDQUFDO1FBQzdDLElBQUksSUFBSSxDQUFDLFlBQVksS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ25FLFlBQVks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LENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQTBCO0lBQ25ELElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7S0FDM0M7SUFDRCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO0FBQ25DLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7VHlwZVZhbHVlUmVmZXJlbmNlLCBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLCBVbmF2YWlsYWJsZVR5cGVWYWx1ZVJlZmVyZW5jZSwgVmFsdWVVbmF2YWlsYWJsZUtpbmR9IGZyb20gJy4vaG9zdCc7XG5cbi8qKlxuICogUG90ZW50aWFsbHkgY29udmVydCBhIGB0cy5UeXBlTm9kZWAgdG8gYSBgVHlwZVZhbHVlUmVmZXJlbmNlYCwgd2hpY2ggaW5kaWNhdGVzIGhvdyB0byB1c2UgdGhlXG4gKiB0eXBlIGdpdmVuIGluIHRoZSBgdHMuVHlwZU5vZGVgIGluIGEgdmFsdWUgcG9zaXRpb24uXG4gKlxuICogVGhpcyBjYW4gcmV0dXJuIGBudWxsYCBpZiB0aGUgYHR5cGVOb2RlYCBpcyBgbnVsbGAsIGlmIGl0IGRvZXMgbm90IHJlZmVyIHRvIGEgc3ltYm9sIHdpdGggYSB2YWx1ZVxuICogZGVjbGFyYXRpb24sIG9yIGlmIGl0IGlzIG5vdCBwb3NzaWJsZSB0byBzdGF0aWNhbGx5IHVuZGVyc3RhbmQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0eXBlVG9WYWx1ZShcbiAgICB0eXBlTm9kZTogdHMuVHlwZU5vZGV8bnVsbCwgY2hlY2tlcjogdHMuVHlwZUNoZWNrZXIpOiBUeXBlVmFsdWVSZWZlcmVuY2Uge1xuICAvLyBJdCdzIG5vdCBwb3NzaWJsZSB0byBnZXQgYSB2YWx1ZSBleHByZXNzaW9uIGlmIHRoZSBwYXJhbWV0ZXIgZG9lc24ndCBldmVuIGhhdmUgYSB0eXBlLlxuICBpZiAodHlwZU5vZGUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gbWlzc2luZ1R5cGUoKTtcbiAgfVxuXG4gIGlmICghdHMuaXNUeXBlUmVmZXJlbmNlTm9kZSh0eXBlTm9kZSkpIHtcbiAgICByZXR1cm4gdW5zdXBwb3J0ZWRUeXBlKHR5cGVOb2RlKTtcbiAgfVxuXG4gIGNvbnN0IHN5bWJvbHMgPSByZXNvbHZlVHlwZVN5bWJvbHModHlwZU5vZGUsIGNoZWNrZXIpO1xuICBpZiAoc3ltYm9scyA9PT0gbnVsbCkge1xuICAgIHJldHVybiB1bmtub3duUmVmZXJlbmNlKHR5cGVOb2RlKTtcbiAgfVxuXG4gIGNvbnN0IHtsb2NhbCwgZGVjbH0gPSBzeW1ib2xzO1xuICAvLyBJdCdzIG9ubHkgdmFsaWQgdG8gY29udmVydCBhIHR5cGUgcmVmZXJlbmNlIHRvIGEgdmFsdWUgcmVmZXJlbmNlIGlmIHRoZSB0eXBlIGFjdHVhbGx5XG4gIC8vIGhhcyBhIHZhbHVlIGRlY2xhcmF0aW9uIGFzc29jaWF0ZWQgd2l0aCBpdC4gTm90ZSB0aGF0IGNvbnN0IGVudW1zIGFyZSBhbiBleGNlcHRpb24sXG4gIC8vIGJlY2F1c2Ugd2hpbGUgdGhleSBkbyBoYXZlIGEgdmFsdWUgZGVjbGFyYXRpb24sIHRoZXkgZG9uJ3QgZXhpc3QgYXQgcnVudGltZS5cbiAgaWYgKGRlY2wudmFsdWVEZWNsYXJhdGlvbiA9PT0gdW5kZWZpbmVkIHx8IGRlY2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5Db25zdEVudW0pIHtcbiAgICBsZXQgdHlwZU9ubHlEZWNsOiB0cy5EZWNsYXJhdGlvbnxudWxsID0gbnVsbDtcbiAgICBpZiAoZGVjbC5kZWNsYXJhdGlvbnMgIT09IHVuZGVmaW5lZCAmJiBkZWNsLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICB0eXBlT25seURlY2wgPSBkZWNsLmRlY2xhcmF0aW9uc1swXTtcbiAgICB9XG4gICAgcmV0dXJuIG5vVmFsdWVEZWNsYXJhdGlvbih0eXBlTm9kZSwgdHlwZU9ubHlEZWNsKTtcbiAgfVxuXG4gIC8vIFRoZSB0eXBlIHBvaW50cyB0byBhIHZhbGlkIHZhbHVlIGRlY2xhcmF0aW9uLiBSZXdyaXRlIHRoZSBUeXBlUmVmZXJlbmNlIGludG8gYW5cbiAgLy8gRXhwcmVzc2lvbiB3aGljaCByZWZlcmVuY2VzIHRoZSB2YWx1ZSBwb2ludGVkIHRvIGJ5IHRoZSBUeXBlUmVmZXJlbmNlLCBpZiBwb3NzaWJsZS5cblxuICAvLyBMb29rIGF0IHRoZSBsb2NhbCBgdHMuU3ltYm9sYCdzIGRlY2xhcmF0aW9ucyBhbmQgc2VlIGlmIGl0IGNvbWVzIGZyb20gYW4gaW1wb3J0XG4gIC8vIHN0YXRlbWVudC4gSWYgc28sIGV4dHJhY3QgdGhlIG1vZHVsZSBzcGVjaWZpZXIgYW5kIHRoZSBuYW1lIG9mIHRoZSBpbXBvcnRlZCB0eXBlLlxuICBjb25zdCBmaXJzdERlY2wgPSBsb2NhbC5kZWNsYXJhdGlvbnMgJiYgbG9jYWwuZGVjbGFyYXRpb25zWzBdO1xuICBpZiAoZmlyc3REZWNsICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAodHMuaXNJbXBvcnRDbGF1c2UoZmlyc3REZWNsKSAmJiBmaXJzdERlY2wubmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgZGVmYXVsdCBpbXBvcnQuXG4gICAgICAvLyAgIGltcG9ydCBGb28gZnJvbSAnZm9vJztcblxuICAgICAgaWYgKGZpcnN0RGVjbC5pc1R5cGVPbmx5KSB7XG4gICAgICAgIC8vIFR5cGUtb25seSBpbXBvcnRzIGNhbm5vdCBiZSByZXByZXNlbnRlZCBhcyB2YWx1ZS5cbiAgICAgICAgcmV0dXJuIHR5cGVPbmx5SW1wb3J0KHR5cGVOb2RlLCBmaXJzdERlY2wpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLkxPQ0FMLFxuICAgICAgICBleHByZXNzaW9uOiBmaXJzdERlY2wubmFtZSxcbiAgICAgICAgZGVmYXVsdEltcG9ydFN0YXRlbWVudDogZmlyc3REZWNsLnBhcmVudCxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0cy5pc0ltcG9ydFNwZWNpZmllcihmaXJzdERlY2wpKSB7XG4gICAgICAvLyBUaGUgc3ltYm9sIHdhcyBpbXBvcnRlZCBieSBuYW1lXG4gICAgICAvLyAgIGltcG9ydCB7Rm9vfSBmcm9tICdmb28nO1xuICAgICAgLy8gb3JcbiAgICAgIC8vICAgaW1wb3J0IHtGb28gYXMgQmFyfSBmcm9tICdmb28nO1xuXG4gICAgICBpZiAoZmlyc3REZWNsLnBhcmVudC5wYXJlbnQuaXNUeXBlT25seSkge1xuICAgICAgICAvLyBUeXBlLW9ubHkgaW1wb3J0cyBjYW5ub3QgYmUgcmVwcmVzZW50ZWQgYXMgdmFsdWUuXG4gICAgICAgIHJldHVybiB0eXBlT25seUltcG9ydCh0eXBlTm9kZSwgZmlyc3REZWNsLnBhcmVudC5wYXJlbnQpO1xuICAgICAgfVxuXG4gICAgICAvLyBEZXRlcm1pbmUgdGhlIG5hbWUgdG8gaW1wb3J0IChgRm9vYCkgZnJvbSB0aGUgaW1wb3J0IHNwZWNpZmllciwgYXMgdGhlIHN5bWJvbCBuYW1lcyBvZlxuICAgICAgLy8gdGhlIGltcG9ydGVkIHR5cGUgY291bGQgcmVmZXIgdG8gYSBsb2NhbCBhbGlhcyAobGlrZSBgQmFyYCBpbiB0aGUgZXhhbXBsZSBhYm92ZSkuXG4gICAgICBjb25zdCBpbXBvcnRlZE5hbWUgPSAoZmlyc3REZWNsLnByb3BlcnR5TmFtZSB8fCBmaXJzdERlY2wubmFtZSkudGV4dDtcblxuICAgICAgLy8gVGhlIGZpcnN0IHN5bWJvbCBuYW1lIHJlZmVycyB0byB0aGUgbG9jYWwgbmFtZSwgd2hpY2ggaXMgcmVwbGFjZWQgYnkgYGltcG9ydGVkTmFtZWAgYWJvdmUuXG4gICAgICAvLyBBbnkgcmVtYWluaW5nIHN5bWJvbCBuYW1lcyBtYWtlIHVwIHRoZSBjb21wbGV0ZSBwYXRoIHRvIHRoZSB2YWx1ZS5cbiAgICAgIGNvbnN0IFtfbG9jYWxOYW1lLCAuLi5uZXN0ZWRQYXRoXSA9IHN5bWJvbHMuc3ltYm9sTmFtZXM7XG5cbiAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBleHRyYWN0TW9kdWxlTmFtZShmaXJzdERlY2wucGFyZW50LnBhcmVudC5wYXJlbnQpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogVHlwZVZhbHVlUmVmZXJlbmNlS2luZC5JTVBPUlRFRCxcbiAgICAgICAgdmFsdWVEZWNsYXJhdGlvbjogZGVjbC52YWx1ZURlY2xhcmF0aW9uLFxuICAgICAgICBtb2R1bGVOYW1lLFxuICAgICAgICBpbXBvcnRlZE5hbWUsXG4gICAgICAgIG5lc3RlZFBhdGhcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0cy5pc05hbWVzcGFjZUltcG9ydChmaXJzdERlY2wpKSB7XG4gICAgICAvLyBUaGUgaW1wb3J0IGlzIGEgbmFtZXNwYWNlIGltcG9ydFxuICAgICAgLy8gICBpbXBvcnQgKiBhcyBGb28gZnJvbSAnZm9vJztcblxuICAgICAgaWYgKGZpcnN0RGVjbC5wYXJlbnQuaXNUeXBlT25seSkge1xuICAgICAgICAvLyBUeXBlLW9ubHkgaW1wb3J0cyBjYW5ub3QgYmUgcmVwcmVzZW50ZWQgYXMgdmFsdWUuXG4gICAgICAgIHJldHVybiB0eXBlT25seUltcG9ydCh0eXBlTm9kZSwgZmlyc3REZWNsLnBhcmVudCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzeW1ib2xzLnN5bWJvbE5hbWVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAvLyBUaGUgdHlwZSByZWZlcnMgdG8gdGhlIG5hbWVzcGFjZSBpdHNlbGYsIHdoaWNoIGNhbm5vdCBiZSByZXByZXNlbnRlZCBhcyBhIHZhbHVlLlxuICAgICAgICByZXR1cm4gbmFtZXNwYWNlSW1wb3J0KHR5cGVOb2RlLCBmaXJzdERlY2wucGFyZW50KTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpcnN0IHN5bWJvbCBuYW1lIHJlZmVycyB0byB0aGUgbG9jYWwgbmFtZSBvZiB0aGUgbmFtZXNwYWNlLCB3aGljaCBpcyBpcyBkaXNjYXJkZWRcbiAgICAgIC8vIGFzIGEgbmV3IG5hbWVzcGFjZSBpbXBvcnQgd2lsbCBiZSBnZW5lcmF0ZWQuIFRoaXMgaXMgZm9sbG93ZWQgYnkgdGhlIHN5bWJvbCBuYW1lIHRoYXQgbmVlZHNcbiAgICAgIC8vIHRvIGJlIGltcG9ydGVkIGFuZCBhbnkgcmVtYWluaW5nIG5hbWVzIHRoYXQgY29uc3RpdHV0ZSB0aGUgY29tcGxldGUgcGF0aCB0byB0aGUgdmFsdWUuXG4gICAgICBjb25zdCBbX25zLCBpbXBvcnRlZE5hbWUsIC4uLm5lc3RlZFBhdGhdID0gc3ltYm9scy5zeW1ib2xOYW1lcztcblxuICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IGV4dHJhY3RNb2R1bGVOYW1lKGZpcnN0RGVjbC5wYXJlbnQucGFyZW50KTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6IFR5cGVWYWx1ZVJlZmVyZW5jZUtpbmQuSU1QT1JURUQsXG4gICAgICAgIHZhbHVlRGVjbGFyYXRpb246IGRlY2wudmFsdWVEZWNsYXJhdGlvbixcbiAgICAgICAgbW9kdWxlTmFtZSxcbiAgICAgICAgaW1wb3J0ZWROYW1lLFxuICAgICAgICBuZXN0ZWRQYXRoXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIHRoZSB0eXBlIGlzIG5vdCBpbXBvcnRlZCwgdGhlIHR5cGUgcmVmZXJlbmNlIGNhbiBiZSBjb252ZXJ0ZWQgaW50byBhbiBleHByZXNzaW9uIGFzIGlzLlxuICBjb25zdCBleHByZXNzaW9uID0gdHlwZU5vZGVUb1ZhbHVlRXhwcih0eXBlTm9kZSk7XG4gIGlmIChleHByZXNzaW9uICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6IFR5cGVWYWx1ZVJlZmVyZW5jZUtpbmQuTE9DQUwsXG4gICAgICBleHByZXNzaW9uLFxuICAgICAgZGVmYXVsdEltcG9ydFN0YXRlbWVudDogbnVsbCxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bnN1cHBvcnRlZFR5cGUodHlwZU5vZGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVuc3VwcG9ydGVkVHlwZSh0eXBlTm9kZTogdHMuVHlwZU5vZGUpOiBVbmF2YWlsYWJsZVR5cGVWYWx1ZVJlZmVyZW5jZSB7XG4gIHJldHVybiB7XG4gICAga2luZDogVHlwZVZhbHVlUmVmZXJlbmNlS2luZC5VTkFWQUlMQUJMRSxcbiAgICByZWFzb246IHtraW5kOiBWYWx1ZVVuYXZhaWxhYmxlS2luZC5VTlNVUFBPUlRFRCwgdHlwZU5vZGV9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBub1ZhbHVlRGVjbGFyYXRpb24oXG4gICAgdHlwZU5vZGU6IHRzLlR5cGVOb2RlLCBkZWNsOiB0cy5EZWNsYXJhdGlvbnxudWxsKTogVW5hdmFpbGFibGVUeXBlVmFsdWVSZWZlcmVuY2Uge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFR5cGVWYWx1ZVJlZmVyZW5jZUtpbmQuVU5BVkFJTEFCTEUsXG4gICAgcmVhc29uOiB7a2luZDogVmFsdWVVbmF2YWlsYWJsZUtpbmQuTk9fVkFMVUVfREVDTEFSQVRJT04sIHR5cGVOb2RlLCBkZWNsfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdHlwZU9ubHlJbXBvcnQoXG4gICAgdHlwZU5vZGU6IHRzLlR5cGVOb2RlLCBpbXBvcnRDbGF1c2U6IHRzLkltcG9ydENsYXVzZSk6IFVuYXZhaWxhYmxlVHlwZVZhbHVlUmVmZXJlbmNlIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLlVOQVZBSUxBQkxFLFxuICAgIHJlYXNvbjoge2tpbmQ6IFZhbHVlVW5hdmFpbGFibGVLaW5kLlRZUEVfT05MWV9JTVBPUlQsIHR5cGVOb2RlLCBpbXBvcnRDbGF1c2V9LFxuICB9O1xufVxuXG5mdW5jdGlvbiB1bmtub3duUmVmZXJlbmNlKHR5cGVOb2RlOiB0cy5UeXBlTm9kZSk6IFVuYXZhaWxhYmxlVHlwZVZhbHVlUmVmZXJlbmNlIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLlVOQVZBSUxBQkxFLFxuICAgIHJlYXNvbjoge2tpbmQ6IFZhbHVlVW5hdmFpbGFibGVLaW5kLlVOS05PV05fUkVGRVJFTkNFLCB0eXBlTm9kZX0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG5hbWVzcGFjZUltcG9ydChcbiAgICB0eXBlTm9kZTogdHMuVHlwZU5vZGUsIGltcG9ydENsYXVzZTogdHMuSW1wb3J0Q2xhdXNlKTogVW5hdmFpbGFibGVUeXBlVmFsdWVSZWZlcmVuY2Uge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFR5cGVWYWx1ZVJlZmVyZW5jZUtpbmQuVU5BVkFJTEFCTEUsXG4gICAgcmVhc29uOiB7a2luZDogVmFsdWVVbmF2YWlsYWJsZUtpbmQuTkFNRVNQQUNFLCB0eXBlTm9kZSwgaW1wb3J0Q2xhdXNlfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWlzc2luZ1R5cGUoKTogVW5hdmFpbGFibGVUeXBlVmFsdWVSZWZlcmVuY2Uge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IFR5cGVWYWx1ZVJlZmVyZW5jZUtpbmQuVU5BVkFJTEFCTEUsXG4gICAgcmVhc29uOiB7a2luZDogVmFsdWVVbmF2YWlsYWJsZUtpbmQuTUlTU0lOR19UWVBFfSxcbiAgfTtcbn1cblxuLyoqXG4gKiBBdHRlbXB0IHRvIGV4dHJhY3QgYSBgdHMuRXhwcmVzc2lvbmAgdGhhdCdzIGVxdWl2YWxlbnQgdG8gYSBgdHMuVHlwZU5vZGVgLCBhcyB0aGUgdHdvIGhhdmVcbiAqIGRpZmZlcmVudCBBU1Qgc2hhcGVzIGJ1dCBjYW4gcmVmZXJlbmNlIHRoZSBzYW1lIHN5bWJvbHMuXG4gKlxuICogVGhpcyB3aWxsIHJldHVybiBgbnVsbGAgaWYgYW4gZXF1aXZhbGVudCBleHByZXNzaW9uIGNhbm5vdCBiZSBjb25zdHJ1Y3RlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHR5cGVOb2RlVG9WYWx1ZUV4cHIobm9kZTogdHMuVHlwZU5vZGUpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICBpZiAodHMuaXNUeXBlUmVmZXJlbmNlTm9kZShub2RlKSkge1xuICAgIHJldHVybiBlbnRpdHlOYW1lVG9WYWx1ZShub2RlLnR5cGVOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFJlc29sdmUgYSBgVHlwZVJlZmVyZW5jZWAgbm9kZSB0byB0aGUgYHRzLlN5bWJvbGBzIGZvciBib3RoIGl0cyBkZWNsYXJhdGlvbiBhbmQgaXRzIGxvY2FsIHNvdXJjZS5cbiAqXG4gKiBJbiB0aGUgZXZlbnQgdGhhdCB0aGUgYFR5cGVSZWZlcmVuY2VgIHJlZmVycyB0byBhIGxvY2FsbHkgZGVjbGFyZWQgc3ltYm9sLCB0aGVzZSB3aWxsIGJlIHRoZVxuICogc2FtZS4gSWYgdGhlIGBUeXBlUmVmZXJlbmNlYCByZWZlcnMgdG8gYW4gaW1wb3J0ZWQgc3ltYm9sLCB0aGVuIGBkZWNsYCB3aWxsIGJlIHRoZSBmdWxseSByZXNvbHZlZFxuICogYHRzLlN5bWJvbGAgb2YgdGhlIHJlZmVyZW5jZWQgc3ltYm9sLiBgbG9jYWxgIHdpbGwgYmUgdGhlIGB0cy5TeW1ib2xgIG9mIHRoZSBgdHMuSWRlbnRpZmllcmBcbiAqIHdoaWNoIHBvaW50cyB0byB0aGUgaW1wb3J0IHN0YXRlbWVudCBieSB3aGljaCB0aGUgc3ltYm9sIHdhcyBpbXBvcnRlZC5cbiAqXG4gKiBBbGwgc3ltYm9sIG5hbWVzIHRoYXQgbWFrZSB1cCB0aGUgdHlwZSByZWZlcmVuY2UgYXJlIHJldHVybmVkIGxlZnQtdG8tcmlnaHQgaW50byB0aGVcbiAqIGBzeW1ib2xOYW1lc2AgYXJyYXksIHdoaWNoIGlzIGd1YXJhbnRlZWQgdG8gaW5jbHVkZSBhdCBsZWFzdCBvbmUgZW50cnkuXG4gKi9cbmZ1bmN0aW9uIHJlc29sdmVUeXBlU3ltYm9scyh0eXBlUmVmOiB0cy5UeXBlUmVmZXJlbmNlTm9kZSwgY2hlY2tlcjogdHMuVHlwZUNoZWNrZXIpOlxuICAgIHtsb2NhbDogdHMuU3ltYm9sLCBkZWNsOiB0cy5TeW1ib2wsIHN5bWJvbE5hbWVzOiBzdHJpbmdbXX18bnVsbCB7XG4gIGNvbnN0IHR5cGVOYW1lID0gdHlwZVJlZi50eXBlTmFtZTtcbiAgLy8gdHlwZVJlZlN5bWJvbCBpcyB0aGUgdHMuU3ltYm9sIG9mIHRoZSBlbnRpcmUgdHlwZSByZWZlcmVuY2UuXG4gIGNvbnN0IHR5cGVSZWZTeW1ib2w6IHRzLlN5bWJvbHx1bmRlZmluZWQgPSBjaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24odHlwZU5hbWUpO1xuICBpZiAodHlwZVJlZlN5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBgbG9jYWxgIGlzIHRoZSBgdHMuU3ltYm9sYCBmb3IgdGhlIGxvY2FsIGB0cy5JZGVudGlmaWVyYCBmb3IgdGhlIHR5cGUuXG4gIC8vIElmIHRoZSB0eXBlIGlzIGFjdHVhbGx5IGxvY2FsbHkgZGVjbGFyZWQgb3IgaXMgaW1wb3J0ZWQgYnkgbmFtZSwgZm9yIGV4YW1wbGU6XG4gIC8vICAgaW1wb3J0IHtGb299IGZyb20gJy4vZm9vJztcbiAgLy8gdGhlbiBpdCdsbCBiZSB0aGUgc2FtZSBhcyBgdHlwZVJlZlN5bWJvbGAuXG4gIC8vXG4gIC8vIElmIHRoZSB0eXBlIGlzIGltcG9ydGVkIHZpYSBhIG5hbWVzcGFjZSBpbXBvcnQsIGZvciBleGFtcGxlOlxuICAvLyAgIGltcG9ydCAqIGFzIGZvbyBmcm9tICcuL2Zvbyc7XG4gIC8vIGFuZCB0aGVuIHJlZmVyZW5jZWQgYXM6XG4gIC8vICAgY29uc3RydWN0b3IoZjogZm9vLkZvbylcbiAgLy8gdGhlbiBgbG9jYWxgIHdpbGwgYmUgdGhlIGB0cy5TeW1ib2xgIG9mIGBmb29gLCB3aGVyZWFzIGB0eXBlUmVmU3ltYm9sYCB3aWxsIGJlIHRoZSBgdHMuU3ltYm9sYFxuICAvLyBvZiBgZm9vLkZvb2AuIFRoaXMgYWxsb3dzIHRyYWNraW5nIG9mIHRoZSBpbXBvcnQgYmVoaW5kIHdoYXRldmVyIHR5cGUgcmVmZXJlbmNlIGV4aXN0cy5cbiAgbGV0IGxvY2FsID0gdHlwZVJlZlN5bWJvbDtcblxuICAvLyBEZXN0cnVjdHVyZSBhIG5hbWUgbGlrZSBgZm9vLlguWS5aYCBhcyBmb2xsb3dzOlxuICAvLyAtIGluIGBsZWZ0TW9zdGAsIHRoZSBgdHMuSWRlbnRpZmllcmAgb2YgdGhlIGxlZnQtbW9zdCBuYW1lIChgZm9vYCkgaW4gdGhlIHF1YWxpZmllZCBuYW1lLlxuICAvLyAgIFRoaXMgaWRlbnRpZmllciBpcyB1c2VkIHRvIHJlc29sdmUgdGhlIGB0cy5TeW1ib2xgIGZvciBgbG9jYWxgLlxuICAvLyAtIGluIGBzeW1ib2xOYW1lc2AsIGFsbCBuYW1lcyBpbnZvbHZlZCBpbiB0aGUgcXVhbGlmaWVkIHBhdGgsIG9yIGEgc2luZ2xlIHN5bWJvbCBuYW1lIGlmIHRoZVxuICAvLyAgIHR5cGUgaXMgbm90IHF1YWxpZmllZC5cbiAgbGV0IGxlZnRNb3N0ID0gdHlwZU5hbWU7XG4gIGNvbnN0IHN5bWJvbE5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICB3aGlsZSAodHMuaXNRdWFsaWZpZWROYW1lKGxlZnRNb3N0KSkge1xuICAgIHN5bWJvbE5hbWVzLnVuc2hpZnQobGVmdE1vc3QucmlnaHQudGV4dCk7XG4gICAgbGVmdE1vc3QgPSBsZWZ0TW9zdC5sZWZ0O1xuICB9XG4gIHN5bWJvbE5hbWVzLnVuc2hpZnQobGVmdE1vc3QudGV4dCk7XG5cbiAgaWYgKGxlZnRNb3N0ICE9PSB0eXBlTmFtZSkge1xuICAgIGNvbnN0IGxvY2FsVG1wID0gY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGxlZnRNb3N0KTtcbiAgICBpZiAobG9jYWxUbXAgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbG9jYWwgPSBsb2NhbFRtcDtcbiAgICB9XG4gIH1cblxuICAvLyBEZS1hbGlhcyB0aGUgdG9wLWxldmVsIHR5cGUgcmVmZXJlbmNlIHN5bWJvbCB0byBnZXQgdGhlIHN5bWJvbCBvZiB0aGUgYWN0dWFsIGRlY2xhcmF0aW9uLlxuICBsZXQgZGVjbCA9IHR5cGVSZWZTeW1ib2w7XG4gIGlmICh0eXBlUmVmU3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICBkZWNsID0gY2hlY2tlci5nZXRBbGlhc2VkU3ltYm9sKHR5cGVSZWZTeW1ib2wpO1xuICB9XG4gIHJldHVybiB7bG9jYWwsIGRlY2wsIHN5bWJvbE5hbWVzfTtcbn1cblxuZnVuY3Rpb24gZW50aXR5TmFtZVRvVmFsdWUobm9kZTogdHMuRW50aXR5TmFtZSk6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmICh0cy5pc1F1YWxpZmllZE5hbWUobm9kZSkpIHtcbiAgICBjb25zdCBsZWZ0ID0gZW50aXR5TmFtZVRvVmFsdWUobm9kZS5sZWZ0KTtcbiAgICByZXR1cm4gbGVmdCAhPT0gbnVsbCA/IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGxlZnQsIG5vZGUucmlnaHQpIDogbnVsbDtcbiAgfSBlbHNlIGlmICh0cy5pc0lkZW50aWZpZXIobm9kZSkpIHtcbiAgICByZXR1cm4gdHMuZ2V0TXV0YWJsZUNsb25lKG5vZGUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RNb2R1bGVOYW1lKG5vZGU6IHRzLkltcG9ydERlY2xhcmF0aW9uKTogc3RyaW5nIHtcbiAgaWYgKCF0cy5pc1N0cmluZ0xpdGVyYWwobm9kZS5tb2R1bGVTcGVjaWZpZXIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdub3QgYSBtb2R1bGUgc3BlY2lmaWVyJyk7XG4gIH1cbiAgcmV0dXJuIG5vZGUubW9kdWxlU3BlY2lmaWVyLnRleHQ7XG59XG4iXX0=