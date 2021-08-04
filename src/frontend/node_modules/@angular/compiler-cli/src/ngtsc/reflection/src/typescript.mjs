/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { ClassMemberKind, isDecoratorIdentifier } from './host';
import { typeToValue } from './type_to_value';
import { isNamedClassDeclaration } from './util';
/**
 * reflector.ts implements static reflection of declarations using the TypeScript `ts.TypeChecker`.
 */
export class TypeScriptReflectionHost {
    constructor(checker) {
        this.checker = checker;
    }
    getDecoratorsOfDeclaration(declaration) {
        if (declaration.decorators === undefined || declaration.decorators.length === 0) {
            return null;
        }
        return declaration.decorators.map(decorator => this._reflectDecorator(decorator))
            .filter((dec) => dec !== null);
    }
    getMembersOfClass(clazz) {
        const tsClazz = castDeclarationToClassOrDie(clazz);
        return tsClazz.members.map(member => this._reflectMember(member))
            .filter((member) => member !== null);
    }
    getConstructorParameters(clazz) {
        const tsClazz = castDeclarationToClassOrDie(clazz);
        const isDeclaration = tsClazz.getSourceFile().isDeclarationFile;
        // For non-declaration files, we want to find the constructor with a `body`. The constructors
        // without a `body` are overloads whereas we want the implementation since it's the one that'll
        // be executed and which can have decorators. For declaration files, we take the first one that
        // we get.
        const ctor = tsClazz.members.find((member) => ts.isConstructorDeclaration(member) && (isDeclaration || member.body !== undefined));
        if (ctor === undefined) {
            return null;
        }
        return ctor.parameters.map(node => {
            // The name of the parameter is easy.
            const name = parameterName(node.name);
            const decorators = this.getDecoratorsOfDeclaration(node);
            // It may or may not be possible to write an expression that refers to the value side of the
            // type named for the parameter.
            let originalTypeNode = node.type || null;
            let typeNode = originalTypeNode;
            // Check if we are dealing with a simple nullable union type e.g. `foo: Foo|null`
            // and extract the type. More complex union types e.g. `foo: Foo|Bar` are not supported.
            // We also don't need to support `foo: Foo|undefined` because Angular's DI injects `null` for
            // optional tokes that don't have providers.
            if (typeNode && ts.isUnionTypeNode(typeNode)) {
                let childTypeNodes = typeNode.types.filter(childTypeNode => !(ts.isLiteralTypeNode(childTypeNode) &&
                    childTypeNode.literal.kind === ts.SyntaxKind.NullKeyword));
                if (childTypeNodes.length === 1) {
                    typeNode = childTypeNodes[0];
                }
            }
            const typeValueReference = typeToValue(typeNode, this.checker);
            return {
                name,
                nameNode: node.name,
                typeValueReference,
                typeNode: originalTypeNode,
                decorators,
            };
        });
    }
    getImportOfIdentifier(id) {
        const directImport = this.getDirectImportOfIdentifier(id);
        if (directImport !== null) {
            return directImport;
        }
        else if (ts.isQualifiedName(id.parent) && id.parent.right === id) {
            return this.getImportOfNamespacedIdentifier(id, getQualifiedNameRoot(id.parent));
        }
        else if (ts.isPropertyAccessExpression(id.parent) && id.parent.name === id) {
            return this.getImportOfNamespacedIdentifier(id, getFarLeftIdentifier(id.parent));
        }
        else {
            return null;
        }
    }
    getExportsOfModule(node) {
        // In TypeScript code, modules are only ts.SourceFiles. Throw if the node isn't a module.
        if (!ts.isSourceFile(node)) {
            throw new Error(`getExportsOfModule() called on non-SourceFile in TS code`);
        }
        // Reflect the module to a Symbol, and use getExportsOfModule() to get a list of exported
        // Symbols.
        const symbol = this.checker.getSymbolAtLocation(node);
        if (symbol === undefined) {
            return null;
        }
        const map = new Map();
        this.checker.getExportsOfModule(symbol).forEach(exportSymbol => {
            // Map each exported Symbol to a Declaration and add it to the map.
            const decl = this.getDeclarationOfSymbol(exportSymbol, null);
            if (decl !== null) {
                map.set(exportSymbol.name, decl);
            }
        });
        return map;
    }
    isClass(node) {
        // For our purposes, classes are "named" ts.ClassDeclarations;
        // (`node.name` can be undefined in unnamed default exports: `default export class { ... }`).
        return isNamedClassDeclaration(node);
    }
    hasBaseClass(clazz) {
        return this.getBaseClassExpression(clazz) !== null;
    }
    getBaseClassExpression(clazz) {
        if (!(ts.isClassDeclaration(clazz) || ts.isClassExpression(clazz)) ||
            clazz.heritageClauses === undefined) {
            return null;
        }
        const extendsClause = clazz.heritageClauses.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
        if (extendsClause === undefined) {
            return null;
        }
        const extendsType = extendsClause.types[0];
        if (extendsType === undefined) {
            return null;
        }
        return extendsType.expression;
    }
    getDeclarationOfIdentifier(id) {
        // Resolve the identifier to a Symbol, and return the declaration of that.
        let symbol = this.checker.getSymbolAtLocation(id);
        if (symbol === undefined) {
            return null;
        }
        return this.getDeclarationOfSymbol(symbol, id);
    }
    getDefinitionOfFunction(node) {
        if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node) &&
            !ts.isFunctionExpression(node)) {
            return null;
        }
        return {
            node,
            body: node.body !== undefined ? Array.from(node.body.statements) : null,
            parameters: node.parameters.map(param => {
                const name = parameterName(param.name);
                const initializer = param.initializer || null;
                return { name, node: param, initializer };
            }),
        };
    }
    getGenericArityOfClass(clazz) {
        if (!ts.isClassDeclaration(clazz)) {
            return null;
        }
        return clazz.typeParameters !== undefined ? clazz.typeParameters.length : 0;
    }
    getVariableValue(declaration) {
        return declaration.initializer || null;
    }
    getDtsDeclaration(_) {
        return null;
    }
    getInternalNameOfClass(clazz) {
        return clazz.name;
    }
    getAdjacentNameOfClass(clazz) {
        return clazz.name;
    }
    isStaticallyExported(clazz) {
        // First check if there's an `export` modifier directly on the class declaration.
        let topLevel = clazz;
        if (ts.isVariableDeclaration(clazz) && ts.isVariableDeclarationList(clazz.parent)) {
            topLevel = clazz.parent.parent;
        }
        if (topLevel.modifiers !== undefined &&
            topLevel.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
            // The node is part of a declaration that's directly exported.
            return true;
        }
        // If `topLevel` is not directly exported via a modifier, then it might be indirectly exported,
        // e.g.:
        //
        // class Foo {}
        // export {Foo};
        //
        // The only way to check this is to look at the module level for exports of the class. As a
        // performance optimization, this check is only performed if the class is actually declared at
        // the top level of the file and thus eligible for exporting in the first place.
        if (topLevel.parent === undefined || !ts.isSourceFile(topLevel.parent)) {
            return false;
        }
        const localExports = this.getLocalExportedClassesOfSourceFile(clazz.getSourceFile());
        return localExports.has(clazz);
    }
    getDirectImportOfIdentifier(id) {
        const symbol = this.checker.getSymbolAtLocation(id);
        if (symbol === undefined || symbol.declarations === undefined ||
            symbol.declarations.length !== 1) {
            return null;
        }
        const decl = symbol.declarations[0];
        const importDecl = getContainingImportDeclaration(decl);
        // Ignore declarations that are defined locally (not imported).
        if (importDecl === null) {
            return null;
        }
        // The module specifier is guaranteed to be a string literal, so this should always pass.
        if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
            // Not allowed to happen in TypeScript ASTs.
            return null;
        }
        return { from: importDecl.moduleSpecifier.text, name: getExportedName(decl, id) };
    }
    /**
     * Try to get the import info for this identifier as though it is a namespaced import.
     *
     * For example, if the identifier is the `Directive` part of a qualified type chain like:
     *
     * ```
     * core.Directive
     * ```
     *
     * then it might be that `core` is a namespace import such as:
     *
     * ```
     * import * as core from 'tslib';
     * ```
     *
     * @param id the TypeScript identifier to find the import info for.
     * @returns The import info if this is a namespaced import or `null`.
     */
    getImportOfNamespacedIdentifier(id, namespaceIdentifier) {
        if (namespaceIdentifier === null) {
            return null;
        }
        const namespaceSymbol = this.checker.getSymbolAtLocation(namespaceIdentifier);
        if (!namespaceSymbol || namespaceSymbol.declarations === undefined) {
            return null;
        }
        const declaration = namespaceSymbol.declarations.length === 1 ? namespaceSymbol.declarations[0] : null;
        if (!declaration) {
            return null;
        }
        const namespaceDeclaration = ts.isNamespaceImport(declaration) ? declaration : null;
        if (!namespaceDeclaration) {
            return null;
        }
        const importDeclaration = namespaceDeclaration.parent.parent;
        if (!ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
            // Should not happen as this would be invalid TypesScript
            return null;
        }
        return {
            from: importDeclaration.moduleSpecifier.text,
            name: id.text,
        };
    }
    /**
     * Resolve a `ts.Symbol` to its declaration, keeping track of the `viaModule` along the way.
     */
    getDeclarationOfSymbol(symbol, originalId) {
        // If the symbol points to a ShorthandPropertyAssignment, resolve it.
        let valueDeclaration = undefined;
        if (symbol.valueDeclaration !== undefined) {
            valueDeclaration = symbol.valueDeclaration;
        }
        else if (symbol.declarations !== undefined && symbol.declarations.length > 0) {
            valueDeclaration = symbol.declarations[0];
        }
        if (valueDeclaration !== undefined && ts.isShorthandPropertyAssignment(valueDeclaration)) {
            const shorthandSymbol = this.checker.getShorthandAssignmentValueSymbol(valueDeclaration);
            if (shorthandSymbol === undefined) {
                return null;
            }
            return this.getDeclarationOfSymbol(shorthandSymbol, originalId);
        }
        else if (valueDeclaration !== undefined && ts.isExportSpecifier(valueDeclaration)) {
            const targetSymbol = this.checker.getExportSpecifierLocalTargetSymbol(valueDeclaration);
            if (targetSymbol === undefined) {
                return null;
            }
            return this.getDeclarationOfSymbol(targetSymbol, originalId);
        }
        const importInfo = originalId && this.getImportOfIdentifier(originalId);
        const viaModule = importInfo !== null && importInfo.from !== null && !importInfo.from.startsWith('.') ?
            importInfo.from :
            null;
        // Now, resolve the Symbol to its declaration by following any and all aliases.
        while (symbol.flags & ts.SymbolFlags.Alias) {
            symbol = this.checker.getAliasedSymbol(symbol);
        }
        // Look at the resolved Symbol's declarations and pick one of them to return. Value declarations
        // are given precedence over type declarations.
        if (symbol.valueDeclaration !== undefined) {
            return {
                node: symbol.valueDeclaration,
                known: null,
                viaModule,
                identity: null,
                kind: 0 /* Concrete */,
            };
        }
        else if (symbol.declarations !== undefined && symbol.declarations.length > 0) {
            return {
                node: symbol.declarations[0],
                known: null,
                viaModule,
                identity: null,
                kind: 0 /* Concrete */,
            };
        }
        else {
            return null;
        }
    }
    _reflectDecorator(node) {
        // Attempt to resolve the decorator expression into a reference to a concrete Identifier. The
        // expression may contain a call to a function which returns the decorator function, in which
        // case we want to return the arguments.
        let decoratorExpr = node.expression;
        let args = null;
        // Check for call expressions.
        if (ts.isCallExpression(decoratorExpr)) {
            args = Array.from(decoratorExpr.arguments);
            decoratorExpr = decoratorExpr.expression;
        }
        // The final resolved decorator should be a `ts.Identifier` - if it's not, then something is
        // wrong and the decorator can't be resolved statically.
        if (!isDecoratorIdentifier(decoratorExpr)) {
            return null;
        }
        const decoratorIdentifier = ts.isIdentifier(decoratorExpr) ? decoratorExpr : decoratorExpr.name;
        const importDecl = this.getImportOfIdentifier(decoratorIdentifier);
        return {
            name: decoratorIdentifier.text,
            identifier: decoratorExpr,
            import: importDecl,
            node,
            args,
        };
    }
    _reflectMember(node) {
        let kind = null;
        let value = null;
        let name = null;
        let nameNode = null;
        if (ts.isPropertyDeclaration(node)) {
            kind = ClassMemberKind.Property;
            value = node.initializer || null;
        }
        else if (ts.isGetAccessorDeclaration(node)) {
            kind = ClassMemberKind.Getter;
        }
        else if (ts.isSetAccessorDeclaration(node)) {
            kind = ClassMemberKind.Setter;
        }
        else if (ts.isMethodDeclaration(node)) {
            kind = ClassMemberKind.Method;
        }
        else if (ts.isConstructorDeclaration(node)) {
            kind = ClassMemberKind.Constructor;
        }
        else {
            return null;
        }
        if (ts.isConstructorDeclaration(node)) {
            name = 'constructor';
        }
        else if (ts.isIdentifier(node.name)) {
            name = node.name.text;
            nameNode = node.name;
        }
        else if (ts.isStringLiteral(node.name)) {
            name = node.name.text;
            nameNode = node.name;
        }
        else {
            return null;
        }
        const decorators = this.getDecoratorsOfDeclaration(node);
        const isStatic = node.modifiers !== undefined &&
            node.modifiers.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
        return {
            node,
            implementation: node,
            kind,
            type: node.type || null,
            name,
            nameNode,
            decorators,
            value,
            isStatic,
        };
    }
    /**
     * Get the set of classes declared in `file` which are exported.
     */
    getLocalExportedClassesOfSourceFile(file) {
        const cacheSf = file;
        if (cacheSf[LocalExportedClasses] !== undefined) {
            // TS does not currently narrow symbol-keyed fields, hence the non-null assert is needed.
            return cacheSf[LocalExportedClasses];
        }
        const exportSet = new Set();
        cacheSf[LocalExportedClasses] = exportSet;
        const sfSymbol = this.checker.getSymbolAtLocation(cacheSf);
        if (sfSymbol === undefined || sfSymbol.exports === undefined) {
            return exportSet;
        }
        // Scan the exported symbol of the `ts.SourceFile` for the original `symbol` of the class
        // declaration.
        //
        // Note: when checking multiple classes declared in the same file, this repeats some operations.
        // In theory, this could be expensive if run in the context of a massive input file (like a
        // large FESM in ngcc). If performance does become an issue here, it should be possible to
        // create a `Set<>`
        // Unfortunately, `ts.Iterator` doesn't implement the iterator protocol, so iteration here is
        // done manually.
        const iter = sfSymbol.exports.values();
        let item = iter.next();
        while (item.done !== true) {
            let exportedSymbol = item.value;
            // If this exported symbol comes from an `export {Foo}` statement, then the symbol is actually
            // for the export declaration, not the original declaration. Such a symbol will be an alias,
            // so unwrap aliasing if necessary.
            if (exportedSymbol.flags & ts.SymbolFlags.Alias) {
                exportedSymbol = this.checker.getAliasedSymbol(exportedSymbol);
            }
            if (exportedSymbol.valueDeclaration !== undefined &&
                exportedSymbol.valueDeclaration.getSourceFile() === file &&
                this.isClass(exportedSymbol.valueDeclaration)) {
                exportSet.add(exportedSymbol.valueDeclaration);
            }
            item = iter.next();
        }
        return exportSet;
    }
}
export function reflectNameOfDeclaration(decl) {
    const id = reflectIdentifierOfDeclaration(decl);
    return id && id.text || null;
}
export function reflectIdentifierOfDeclaration(decl) {
    if (ts.isClassDeclaration(decl) || ts.isFunctionDeclaration(decl)) {
        return decl.name || null;
    }
    else if (ts.isVariableDeclaration(decl)) {
        if (ts.isIdentifier(decl.name)) {
            return decl.name;
        }
    }
    return null;
}
export function reflectTypeEntityToDeclaration(type, checker) {
    let realSymbol = checker.getSymbolAtLocation(type);
    if (realSymbol === undefined) {
        throw new Error(`Cannot resolve type entity ${type.getText()} to symbol`);
    }
    while (realSymbol.flags & ts.SymbolFlags.Alias) {
        realSymbol = checker.getAliasedSymbol(realSymbol);
    }
    let node = null;
    if (realSymbol.valueDeclaration !== undefined) {
        node = realSymbol.valueDeclaration;
    }
    else if (realSymbol.declarations !== undefined && realSymbol.declarations.length === 1) {
        node = realSymbol.declarations[0];
    }
    else {
        throw new Error(`Cannot resolve type entity symbol to declaration`);
    }
    if (ts.isQualifiedName(type)) {
        if (!ts.isIdentifier(type.left)) {
            throw new Error(`Cannot handle qualified name with non-identifier lhs`);
        }
        const symbol = checker.getSymbolAtLocation(type.left);
        if (symbol === undefined || symbol.declarations === undefined ||
            symbol.declarations.length !== 1) {
            throw new Error(`Cannot resolve qualified type entity lhs to symbol`);
        }
        const decl = symbol.declarations[0];
        if (ts.isNamespaceImport(decl)) {
            const clause = decl.parent;
            const importDecl = clause.parent;
            if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
                throw new Error(`Module specifier is not a string`);
            }
            return { node, from: importDecl.moduleSpecifier.text };
        }
        else {
            throw new Error(`Unknown import type?`);
        }
    }
    else {
        return { node, from: null };
    }
}
export function filterToMembersWithDecorator(members, name, module) {
    return members.filter(member => !member.isStatic)
        .map(member => {
        if (member.decorators === null) {
            return null;
        }
        const decorators = member.decorators.filter(dec => {
            if (dec.import !== null) {
                return dec.import.name === name && (module === undefined || dec.import.from === module);
            }
            else {
                return dec.name === name && module === undefined;
            }
        });
        if (decorators.length === 0) {
            return null;
        }
        return { member, decorators };
    })
        .filter((value) => value !== null);
}
export function findMember(members, name, isStatic = false) {
    return members.find(member => member.isStatic === isStatic && member.name === name) || null;
}
export function reflectObjectLiteral(node) {
    const map = new Map();
    node.properties.forEach(prop => {
        if (ts.isPropertyAssignment(prop)) {
            const name = propertyNameToString(prop.name);
            if (name === null) {
                return;
            }
            map.set(name, prop.initializer);
        }
        else if (ts.isShorthandPropertyAssignment(prop)) {
            map.set(prop.name.text, prop.name);
        }
        else {
            return;
        }
    });
    return map;
}
function castDeclarationToClassOrDie(declaration) {
    if (!ts.isClassDeclaration(declaration)) {
        throw new Error(`Reflecting on a ${ts.SyntaxKind[declaration.kind]} instead of a ClassDeclaration.`);
    }
    return declaration;
}
function parameterName(name) {
    if (ts.isIdentifier(name)) {
        return name.text;
    }
    else {
        return null;
    }
}
function propertyNameToString(node) {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
        return node.text;
    }
    else {
        return null;
    }
}
/**
 * Compute the left most identifier in a qualified type chain. E.g. the `a` of `a.b.c.SomeType`.
 * @param qualifiedName The starting property access expression from which we want to compute
 * the left most identifier.
 * @returns the left most identifier in the chain or `null` if it is not an identifier.
 */
function getQualifiedNameRoot(qualifiedName) {
    while (ts.isQualifiedName(qualifiedName.left)) {
        qualifiedName = qualifiedName.left;
    }
    return ts.isIdentifier(qualifiedName.left) ? qualifiedName.left : null;
}
/**
 * Compute the left most identifier in a property access chain. E.g. the `a` of `a.b.c.d`.
 * @param propertyAccess The starting property access expression from which we want to compute
 * the left most identifier.
 * @returns the left most identifier in the chain or `null` if it is not an identifier.
 */
function getFarLeftIdentifier(propertyAccess) {
    while (ts.isPropertyAccessExpression(propertyAccess.expression)) {
        propertyAccess = propertyAccess.expression;
    }
    return ts.isIdentifier(propertyAccess.expression) ? propertyAccess.expression : null;
}
/**
 * Return the ImportDeclaration for the given `node` if it is either an `ImportSpecifier` or a
 * `NamespaceImport`. If not return `null`.
 */
function getContainingImportDeclaration(node) {
    return ts.isImportSpecifier(node) ? node.parent.parent.parent :
        ts.isNamespaceImport(node) ? node.parent.parent : null;
}
/**
 * Compute the name by which the `decl` was exported, not imported.
 * If no such declaration can be found (e.g. it is a namespace import)
 * then fallback to the `originalId`.
 */
function getExportedName(decl, originalId) {
    return ts.isImportSpecifier(decl) ?
        (decl.propertyName !== undefined ? decl.propertyName : decl.name).text :
        originalId.text;
}
const LocalExportedClasses = Symbol('LocalExportedClasses');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcmVmbGVjdGlvbi9zcmMvdHlwZXNjcmlwdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQWdDLGVBQWUsRUFBdUcscUJBQXFCLEVBQWlCLE1BQU0sUUFBUSxDQUFDO0FBQ2xOLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFL0M7O0dBRUc7QUFFSCxNQUFNLE9BQU8sd0JBQXdCO0lBQ25DLFlBQXNCLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUcsQ0FBQztJQUVqRCwwQkFBMEIsQ0FBQyxXQUE0QjtRQUNyRCxJQUFJLFdBQVcsQ0FBQyxVQUFVLEtBQUssU0FBUyxJQUFJLFdBQVcsQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUMvRSxPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsT0FBTyxXQUFXLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUM1RSxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQW9CLEVBQUUsQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELGlCQUFpQixDQUFDLEtBQXVCO1FBQ3ZDLE1BQU0sT0FBTyxHQUFHLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25ELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJ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QUEwQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUMvRCxjQUFjLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQztLQUM1QztJQUNELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUN2RixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FBQyxJQUFhO0lBQ25ELE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTyxDQUFDLE1BQU8sQ0FBQyxNQUFPLENBQUMsQ0FBQztRQUM5QixFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDN0YsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxJQUFvQixFQUFFLFVBQXlCO0lBQ3RFLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDL0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hFLFVBQVUsQ0FBQyxJQUFJLENBQUM7QUFDdEIsQ0FBQztBQUVELE1BQU0sb0JBQW9CLEdBQUcsTUFBTSxDQUFDLHNCQUFzQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbiwgQ2xhc3NNZW1iZXIsIENsYXNzTWVtYmVyS2luZCwgQ3RvclBhcmFtZXRlciwgRGVjbGFyYXRpb24sIERlY2xhcmF0aW9uS2luZCwgRGVjbGFyYXRpb25Ob2RlLCBEZWNvcmF0b3IsIEZ1bmN0aW9uRGVmaW5pdGlvbiwgSW1wb3J0LCBpc0RlY29yYXRvcklkZW50aWZpZXIsIFJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuL2hvc3QnO1xuaW1wb3J0IHt0eXBlVG9WYWx1ZX0gZnJvbSAnLi90eXBlX3RvX3ZhbHVlJztcbmltcG9ydCB7aXNOYW1lZENsYXNzRGVjbGFyYXRpb259IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogcmVmbGVjdG9yLnRzIGltcGxlbWVudHMgc3RhdGljIHJlZmxlY3Rpb24gb2YgZGVjbGFyYXRpb25zIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGB0cy5UeXBlQ2hlY2tlcmAuXG4gKi9cblxuZXhwb3J0IGNsYXNzIFR5cGVTY3JpcHRSZWZsZWN0aW9uSG9zdCBpbXBsZW1lbnRzIFJlZmxlY3Rpb25Ib3N0IHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIGNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKSB7fVxuXG4gIGdldERlY29yYXRvcnNPZkRlY2xhcmF0aW9uKGRlY2xhcmF0aW9uOiBEZWNsYXJhdGlvbk5vZGUpOiBEZWNvcmF0b3JbXXxudWxsIHtcbiAgICBpZiAoZGVjbGFyYXRpb24uZGVjb3JhdG9ycyA9PT0gdW5kZWZpbmVkIHx8IGRlY2xhcmF0aW9uLmRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uLmRlY29yYXRvcnMubWFwKGRlY29yYXRvciA9PiB0aGlzLl9yZWZsZWN0RGVjb3JhdG9yKGRlY29yYXRvcikpXG4gICAgICAgIC5maWx0ZXIoKGRlYyk6IGRlYyBpcyBEZWNvcmF0b3IgPT4gZGVjICE9PSBudWxsKTtcbiAgfVxuXG4gIGdldE1lbWJlcnNPZkNsYXNzKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogQ2xhc3NNZW1iZXJbXSB7XG4gICAgY29uc3QgdHNDbGF6eiA9IGNhc3REZWNsYXJhdGlvblRvQ2xhc3NPckRpZShjbGF6eik7XG4gICAgcmV0dXJuIHRzQ2xhenoubWVtYmVycy5tYXAobWVtYmVyID0+IHRoaXMuX3JlZmxlY3RNZW1iZXIobWVtYmVyKSlcbiAgICAgICAgLmZpbHRlcigobWVtYmVyKTogbWVtYmVyIGlzIENsYXNzTWVtYmVyID0+IG1lbWJlciAhPT0gbnVsbCk7XG4gIH1cblxuICBnZXRDb25zdHJ1Y3RvclBhcmFtZXRlcnMoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiBDdG9yUGFyYW1ldGVyW118bnVsbCB7XG4gICAgY29uc3QgdHNDbGF6eiA9IGNhc3REZWNsYXJhdGlvblRvQ2xhc3NPckRpZShjbGF6eik7XG5cbiAgICBjb25zdCBpc0RlY2xhcmF0aW9uID0gdHNDbGF6ei5nZXRTb3VyY2VGaWxlKCkuaXNEZWNsYXJhdGlvbkZpbGU7XG4gICAgLy8gRm9yIG5vbi1kZWNsYXJhdGlvbiBmaWxlcywgd2Ugd2FudCB0byBmaW5kIHRoZSBjb25zdHJ1Y3RvciB3aXRoIGEgYGJvZHlgLiBUaGUgY29uc3RydWN0b3JzXG4gICAgLy8gd2l0aG91dCBhIGBib2R5YCBhcmUgb3ZlcmxvYWRzIHdoZXJlYXMgd2Ugd2FudCB0aGUgaW1wbGVtZW50YXRpb24gc2luY2UgaXQncyB0aGUgb25lIHRoYXQnbGxcbiAgICAvLyBiZSBleGVjdXRlZCBhbmQgd2hpY2ggY2FuIGhhdmUgZGVjb3JhdG9ycy4gRm9yIGRlY2xhcmF0aW9uIGZpbGVzLCB3ZSB0YWtlIHRoZSBmaXJzdCBvbmUgdGhhdFxuICAgIC8vIHdlIGdldC5cbiAgICBjb25zdCBjdG9yID0gdHNDbGF6ei5tZW1iZXJzLmZpbmQoXG4gICAgICAgIChtZW1iZXIpOiBtZW1iZXIgaXMgdHMuQ29uc3RydWN0b3JEZWNsYXJhdGlvbiA9PlxuICAgICAgICAgICAgdHMuaXNDb25zdHJ1Y3RvckRlY2xhcmF0aW9uKG1lbWJlcikgJiYgKGlzRGVjbGFyYXRpb24gfHwgbWVtYmVyLmJvZHkgIT09IHVuZGVmaW5lZCkpO1xuICAgIGlmIChjdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBjdG9yLnBhcmFtZXRlcnMubWFwKG5vZGUgPT4ge1xuICAgICAgLy8gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciBpcyBlYXN5LlxuICAgICAgY29uc3QgbmFtZSA9IHBhcmFtZXRlck5hbWUobm9kZS5uYW1lKTtcblxuICAgICAgY29uc3QgZGVjb3JhdG9ycyA9IHRoaXMuZ2V0RGVjb3JhdG9yc09mRGVjbGFyYXRpb24obm9kZSk7XG5cbiAgICAgIC8vIEl0IG1heSBvciBtYXkgbm90IGJlIHBvc3NpYmxlIHRvIHdyaXRlIGFuIGV4cHJlc3Npb24gdGhhdCByZWZlcnMgdG8gdGhlIHZhbHVlIHNpZGUgb2YgdGhlXG4gICAgICAvLyB0eXBlIG5hbWVkIGZvciB0aGUgcGFyYW1ldGVyLlxuXG4gICAgICBsZXQgb3JpZ2luYWxUeXBlTm9kZSA9IG5vZGUudHlwZSB8fCBudWxsO1xuICAgICAgbGV0IHR5cGVOb2RlID0gb3JpZ2luYWxUeXBlTm9kZTtcblxuICAgICAgLy8gQ2hlY2sgaWYgd2UgYXJlIGRlYWxpbmcgd2l0aCBhIHNpbXBsZSBudWxsYWJsZSB1bmlvbiB0eXBlIGUuZy4gYGZvbzogRm9vfG51bGxgXG4gICAgICAvLyBhbmQgZXh0cmFjdCB0aGUgdHlwZS4gTW9yZSBjb21wbGV4IHVuaW9uIHR5cGVzIGUuZy4gYGZvbzogRm9vfEJhcmAgYXJlIG5vdCBzdXBwb3J0ZWQuXG4gICAgICAvLyBXZSBhbHNvIGRvbid0IG5lZWQgdG8gc3VwcG9ydCBgZm9vOiBGb298dW5kZWZpbmVkYCBiZWNhdXNlIEFuZ3VsYXIncyBESSBpbmplY3RzIGBudWxsYCBmb3JcbiAgICAgIC8vIG9wdGlvbmFsIHRva2VzIHRoYXQgZG9uJ3QgaGF2ZSBwcm92aWRlcnMuXG4gICAgICBpZiAodHlwZU5vZGUgJiYgdHMuaXNVbmlvblR5cGVOb2RlKHR5cGVOb2RlKSkge1xuICAgICAgICBsZXQgY2hpbGRUeXBlTm9kZXMgPSB0eXBlTm9kZS50eXBlcy5maWx0ZXIoXG4gICAgICAgICAgICBjaGlsZFR5cGVOb2RlID0+XG4gICAgICAgICAgICAgICAgISh0cy5pc0xpdGVyYWxUeXBlTm9kZShjaGlsZFR5cGVOb2RlKSAmJlxuICAgICAgICAgICAgICAgICAgY2hpbGRUeXBlTm9kZS5saXRlcmFsLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuTnVsbEtleXdvcmQpKTtcblxuICAgICAgICBpZiAoY2hpbGRUeXBlTm9kZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgdHlwZU5vZGUgPSBjaGlsZFR5cGVOb2Rlc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCB0eXBlVmFsdWVSZWZlcmVuY2UgPSB0eXBlVG9WYWx1ZSh0eXBlTm9kZSwgdGhpcy5jaGVja2VyKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgbmFtZU5vZGU6IG5vZGUubmFtZSxcbiAgICAgICAgdHlwZVZhbHVlUmVmZXJlbmNlLFxuICAgICAgICB0eXBlTm9kZTogb3JpZ2luYWxUeXBlTm9kZSxcbiAgICAgICAgZGVjb3JhdG9ycyxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBnZXRJbXBvcnRPZklkZW50aWZpZXIoaWQ6IHRzLklkZW50aWZpZXIpOiBJbXBvcnR8bnVsbCB7XG4gICAgY29uc3QgZGlyZWN0SW1wb3J0ID0gdGhpcy5nZXREaXJlY3RJbXBvcnRPZklkZW50aWZpZXIoaWQpO1xuICAgIGlmIChkaXJlY3RJbXBvcnQgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBkaXJlY3RJbXBvcnQ7XG4gICAgfSBlbHNlIGlmICh0cy5pc1F1YWxpZmllZE5hbWUoaWQucGFyZW50KSAmJiBpZC5wYXJlbnQucmlnaHQgPT09IGlkKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRJbXBvcnRPZk5hbWVzcGFjZWRJZGVudGlmaWVyKGlkLCBnZXRRdWFsaWZpZWROYW1lUm9vdChpZC5wYXJlbnQpKTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKGlkLnBhcmVudCkgJiYgaWQucGFyZW50Lm5hbWUgPT09IGlkKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRJbXBvcnRPZk5hbWVzcGFjZWRJZGVudGlmaWVyKGlkLCBnZXRGYXJMZWZ0SWRlbnRpZmllcihpZC5wYXJlbnQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZ2V0RXhwb3J0c09mTW9kdWxlKG5vZGU6IHRzLk5vZGUpOiBNYXA8c3RyaW5nLCBEZWNsYXJhdGlvbj58bnVsbCB7XG4gICAgLy8gSW4gVHlwZVNjcmlwdCBjb2RlLCBtb2R1bGVzIGFyZSBvbmx5IHRzLlNvdXJjZUZpbGVzLiBUaHJvdyBpZiB0aGUgbm9kZSBpc24ndCBhIG1vZHVsZS5cbiAgICBpZiAoIXRzLmlzU291cmNlRmlsZShub2RlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBnZXRFeHBvcnRzT2ZNb2R1bGUoKSBjYWxsZWQgb24gbm9uLVNvdXJjZUZpbGUgaW4gVFMgY29kZWApO1xuICAgIH1cblxuICAgIC8vIFJlZmxlY3QgdGhlIG1vZHVsZSB0byBhIFN5bWJvbCwgYW5kIHVzZSBnZXRFeHBvcnRzT2ZNb2R1bGUoKSB0byBnZXQgYSBsaXN0IG9mIGV4cG9ydGVkXG4gICAgLy8gU3ltYm9scy5cbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihub2RlKTtcbiAgICBpZiAoc3ltYm9sID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBEZWNsYXJhdGlvbj4oKTtcbiAgICB0aGlzLmNoZWNrZXIuZ2V0RXhwb3J0c09mTW9kdWxlKHN5bWJvbCkuZm9yRWFjaChleHBvcnRTeW1ib2wgPT4ge1xuICAgICAgLy8gTWFwIGVhY2ggZXhwb3J0ZWQgU3ltYm9sIHRvIGEgRGVjbGFyYXRpb24gYW5kIGFkZCBpdCB0byB0aGUgbWFwLlxuICAgICAgY29uc3QgZGVjbCA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZlN5bWJvbChleHBvcnRTeW1ib2wsIG51bGwpO1xuICAgICAgaWYgKGRlY2wgIT09IG51bGwpIHtcbiAgICAgICAgbWFwLnNldChleHBvcnRTeW1ib2wubmFtZSwgZGVjbCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIGlzQ2xhc3Mobm9kZTogdHMuTm9kZSk6IG5vZGUgaXMgQ2xhc3NEZWNsYXJhdGlvbiB7XG4gICAgLy8gRm9yIG91ciBwdXJwb3NlcywgY2xhc3NlcyBhcmUgXCJuYW1lZFwiIHRzLkNsYXNzRGVjbGFyYXRpb25zO1xuICAgIC8vIChgbm9kZS5uYW1lYCBjYW4gYmUgdW5kZWZpbmVkIGluIHVubmFtZWQgZGVmYXVsdCBleHBvcnRzOiBgZGVmYXVsdCBleHBvcnQgY2xhc3MgeyAuLi4gfWApLlxuICAgIHJldHVybiBpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbihub2RlKTtcbiAgfVxuXG4gIGhhc0Jhc2VDbGFzcyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmdldEJhc2VDbGFzc0V4cHJlc3Npb24oY2xhenopICE9PSBudWxsO1xuICB9XG5cbiAgZ2V0QmFzZUNsYXNzRXhwcmVzc2lvbihjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKCEodHMuaXNDbGFzc0RlY2xhcmF0aW9uKGNsYXp6KSB8fCB0cy5pc0NsYXNzRXhwcmVzc2lvbihjbGF6eikpIHx8XG4gICAgICAgIGNsYXp6Lmhlcml0YWdlQ2xhdXNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZXh0ZW5kc0NsYXVzZSA9XG4gICAgICAgIGNsYXp6Lmhlcml0YWdlQ2xhdXNlcy5maW5kKGNsYXVzZSA9PiBjbGF1c2UudG9rZW4gPT09IHRzLlN5bnRheEtpbmQuRXh0ZW5kc0tleXdvcmQpO1xuICAgIGlmIChleHRlbmRzQ2xhdXNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBleHRlbmRzVHlwZSA9IGV4dGVuZHNDbGF1c2UudHlwZXNbMF07XG4gICAgaWYgKGV4dGVuZHNUeXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZXh0ZW5kc1R5cGUuZXhwcmVzc2lvbjtcbiAgfVxuXG4gIGdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaWRlbnRpZmllciB0byBhIFN5bWJvbCwgYW5kIHJldHVybiB0aGUgZGVjbGFyYXRpb24gb2YgdGhhdC5cbiAgICBsZXQgc3ltYm9sOiB0cy5TeW1ib2x8dW5kZWZpbmVkID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oaWQpO1xuICAgIGlmIChzeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldERlY2xhcmF0aW9uT2ZTeW1ib2woc3ltYm9sLCBpZCk7XG4gIH1cblxuICBnZXREZWZpbml0aW9uT2ZGdW5jdGlvbihub2RlOiB0cy5Ob2RlKTogRnVuY3Rpb25EZWZpbml0aW9ufG51bGwge1xuICAgIGlmICghdHMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUpICYmICF0cy5pc01ldGhvZERlY2xhcmF0aW9uKG5vZGUpICYmXG4gICAgICAgICF0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBub2RlLFxuICAgICAgYm9keTogbm9kZS5ib2R5ICE9PSB1bmRlZmluZWQgPyBBcnJheS5mcm9tKG5vZGUuYm9keS5zdGF0ZW1lbnRzKSA6IG51bGwsXG4gICAgICBwYXJhbWV0ZXJzOiBub2RlLnBhcmFtZXRlcnMubWFwKHBhcmFtID0+IHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcmFtZXRlck5hbWUocGFyYW0ubmFtZSk7XG4gICAgICAgIGNvbnN0IGluaXRpYWxpemVyID0gcGFyYW0uaW5pdGlhbGl6ZXIgfHwgbnVsbDtcbiAgICAgICAgcmV0dXJuIHtuYW1lLCBub2RlOiBwYXJhbSwgaW5pdGlhbGl6ZXJ9O1xuICAgICAgfSksXG4gICAgfTtcbiAgfVxuXG4gIGdldEdlbmVyaWNBcml0eU9mQ2xhc3MoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiBudW1iZXJ8bnVsbCB7XG4gICAgaWYgKCF0cy5pc0NsYXNzRGVjbGFyYXRpb24oY2xhenopKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNsYXp6LnR5cGVQYXJhbWV0ZXJzICE9PSB1bmRlZmluZWQgPyBjbGF6ei50eXBlUGFyYW1ldGVycy5sZW5ndGggOiAwO1xuICB9XG5cbiAgZ2V0VmFyaWFibGVWYWx1ZShkZWNsYXJhdGlvbjogdHMuVmFyaWFibGVEZWNsYXJhdGlvbik6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uLmluaXRpYWxpemVyIHx8IG51bGw7XG4gIH1cblxuICBnZXREdHNEZWNsYXJhdGlvbihfOiBDbGFzc0RlY2xhcmF0aW9uKTogdHMuRGVjbGFyYXRpb258bnVsbCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXRJbnRlcm5hbE5hbWVPZkNsYXNzKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogdHMuSWRlbnRpZmllciB7XG4gICAgcmV0dXJuIGNsYXp6Lm5hbWU7XG4gIH1cblxuICBnZXRBZGphY2VudE5hbWVPZkNsYXNzKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogdHMuSWRlbnRpZmllciB7XG4gICAgcmV0dXJuIGNsYXp6Lm5hbWU7XG4gIH1cblxuICBpc1N0YXRpY2FsbHlFeHBvcnRlZChjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIC8vIEZpcnN0IGNoZWNrIGlmIHRoZXJlJ3MgYW4gYGV4cG9ydGAgbW9kaWZpZXIgZGlyZWN0bHkgb24gdGhlIGNsYXNzIGRlY2xhcmF0aW9uLlxuICAgIGxldCB0b3BMZXZlbDogdHMuTm9kZSA9IGNsYXp6O1xuICAgIGlmICh0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oY2xhenopICYmIHRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbkxpc3QoY2xhenoucGFyZW50KSkge1xuICAgICAgdG9wTGV2ZWwgPSBjbGF6ei5wYXJlbnQucGFyZW50O1xuICAgIH1cbiAgICBpZiAodG9wTGV2ZWwubW9kaWZpZXJzICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgdG9wTGV2ZWwubW9kaWZpZXJzLnNvbWUobW9kaWZpZXIgPT4gbW9kaWZpZXIua2luZCA9PT0gdHMuU3ludGF4S2luZC5FeHBvcnRLZXl3b3JkKSkge1xuICAgICAgLy8gVGhlIG5vZGUgaXMgcGFydCBvZiBhIGRlY2xhcmF0aW9uIHRoYXQncyBkaXJlY3RseSBleHBvcnRlZC5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIElmIGB0b3BMZXZlbGAgaXMgbm90IGRpcmVjdGx5IGV4cG9ydGVkIHZpYSBhIG1vZGlmaWVyLCB0aGVuIGl0IG1pZ2h0IGJlIGluZGlyZWN0bHkgZXhwb3J0ZWQsXG4gICAgLy8gZS5nLjpcbiAgICAvL1xuICAgIC8vIGNsYXNzIEZvbyB7fVxuICAgIC8vIGV4cG9ydCB7Rm9vfTtcbiAgICAvL1xuICAgIC8vIFRoZSBvbmx5IHdheSB0byBjaGVjayB0aGlzIGlzIHRvIGxvb2sgYXQgdGhlIG1vZHVsZSBsZXZlbCBmb3IgZXhwb3J0cyBvZiB0aGUgY2xhc3MuIEFzIGFcbiAgICAvLyBwZXJmb3JtYW5jZSBvcHRpbWl6YXRpb24sIHRoaXMgY2hlY2sgaXMgb25seSBwZXJmb3JtZWQgaWYgdGhlIGNsYXNzIGlzIGFjdHVhbGx5IGRlY2xhcmVkIGF0XG4gICAgLy8gdGhlIHRvcCBsZXZlbCBvZiB0aGUgZmlsZSBhbmQgdGh1cyBlbGlnaWJsZSBmb3IgZXhwb3J0aW5nIGluIHRoZSBmaXJzdCBwbGFjZS5cbiAgICBpZiAodG9wTGV2ZWwucGFyZW50ID09PSB1bmRlZmluZWQgfHwgIXRzLmlzU291cmNlRmlsZSh0b3BMZXZlbC5wYXJlbnQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgbG9jYWxFeHBvcnRzID0gdGhpcy5nZXRMb2NhbEV4cG9ydGVkQ2xhc3Nlc09mU291cmNlRmlsZShjbGF6ei5nZXRTb3VyY2VGaWxlKCkpO1xuICAgIHJldHVybiBsb2NhbEV4cG9ydHMuaGFzKGNsYXp6KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXREaXJlY3RJbXBvcnRPZklkZW50aWZpZXIoaWQ6IHRzLklkZW50aWZpZXIpOiBJbXBvcnR8bnVsbCB7XG4gICAgY29uc3Qgc3ltYm9sID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oaWQpO1xuXG4gICAgaWYgKHN5bWJvbCA9PT0gdW5kZWZpbmVkIHx8IHN5bWJvbC5kZWNsYXJhdGlvbnMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBzeW1ib2wuZGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGVjbCA9IHN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gICAgY29uc3QgaW1wb3J0RGVjbCA9IGdldENvbnRhaW5pbmdJbXBvcnREZWNsYXJhdGlvbihkZWNsKTtcblxuICAgIC8vIElnbm9yZSBkZWNsYXJhdGlvbnMgdGhhdCBhcmUgZGVmaW5lZCBsb2NhbGx5IChub3QgaW1wb3J0ZWQpLlxuICAgIGlmIChpbXBvcnREZWNsID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBUaGUgbW9kdWxlIHNwZWNpZmllciBpcyBndWFyYW50ZWVkIHRvIGJlIGEgc3RyaW5nIGxpdGVyYWwsIHNvIHRoaXMgc2hvdWxkIGFsd2F5cyBwYXNzLlxuICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKGltcG9ydERlY2wubW9kdWxlU3BlY2lmaWVyKSkge1xuICAgICAgLy8gTm90IGFsbG93ZWQgdG8gaGFwcGVuIGluIFR5cGVTY3JpcHQgQVNUcy5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7ZnJvbTogaW1wb3J0RGVjbC5tb2R1bGVTcGVjaWZpZXIudGV4dCwgbmFtZTogZ2V0RXhwb3J0ZWROYW1lKGRlY2wsIGlkKX07XG4gIH1cblxuICAvKipcbiAgICogVHJ5IHRvIGdldCB0aGUgaW1wb3J0IGluZm8gZm9yIHRoaXMgaWRlbnRpZmllciBhcyB0aG91Z2ggaXQgaXMgYSBuYW1lc3BhY2VkIGltcG9ydC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGlmIHRoZSBpZGVudGlmaWVyIGlzIHRoZSBgRGlyZWN0aXZlYCBwYXJ0IG9mIGEgcXVhbGlmaWVkIHR5cGUgY2hhaW4gbGlrZTpcbiAgICpcbiAgICogYGBgXG4gICAqIGNvcmUuRGlyZWN0aXZlXG4gICAqIGBgYFxuICAgKlxuICAgKiB0aGVuIGl0IG1pZ2h0IGJlIHRoYXQgYGNvcmVgIGlzIGEgbmFtZXNwYWNlIGltcG9ydCBzdWNoIGFzOlxuICAgKlxuICAgKiBgYGBcbiAgICogaW1wb3J0ICogYXMgY29yZSBmcm9tICd0c2xpYic7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gaWQgdGhlIFR5cGVTY3JpcHQgaWRlbnRpZmllciB0byBmaW5kIHRoZSBpbXBvcnQgaW5mbyBmb3IuXG4gICAqIEByZXR1cm5zIFRoZSBpbXBvcnQgaW5mbyBpZiB0aGlzIGlzIGEgbmFtZXNwYWNlZCBpbXBvcnQgb3IgYG51bGxgLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldEltcG9ydE9mTmFtZXNwYWNlZElkZW50aWZpZXIoXG4gICAgICBpZDogdHMuSWRlbnRpZmllciwgbmFtZXNwYWNlSWRlbnRpZmllcjogdHMuSWRlbnRpZmllcnxudWxsKTogSW1wb3J0fG51bGwge1xuICAgIGlmIChuYW1lc3BhY2VJZGVudGlmaWVyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbmFtZXNwYWNlU3ltYm9sID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obmFtZXNwYWNlSWRlbnRpZmllcik7XG4gICAgaWYgKCFuYW1lc3BhY2VTeW1ib2wgfHwgbmFtZXNwYWNlU3ltYm9sLmRlY2xhcmF0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZGVjbGFyYXRpb24gPVxuICAgICAgICBuYW1lc3BhY2VTeW1ib2wuZGVjbGFyYXRpb25zLmxlbmd0aCA9PT0gMSA/IG5hbWVzcGFjZVN5bWJvbC5kZWNsYXJhdGlvbnNbMF0gOiBudWxsO1xuICAgIGlmICghZGVjbGFyYXRpb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBuYW1lc3BhY2VEZWNsYXJhdGlvbiA9IHRzLmlzTmFtZXNwYWNlSW1wb3J0KGRlY2xhcmF0aW9uKSA/IGRlY2xhcmF0aW9uIDogbnVsbDtcbiAgICBpZiAoIW5hbWVzcGFjZURlY2xhcmF0aW9uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBvcnREZWNsYXJhdGlvbiA9IG5hbWVzcGFjZURlY2xhcmF0aW9uLnBhcmVudC5wYXJlbnQ7XG4gICAgaWYgKCF0cy5pc1N0cmluZ0xpdGVyYWwoaW1wb3J0RGVjbGFyYXRpb24ubW9kdWxlU3BlY2lmaWVyKSkge1xuICAgICAgLy8gU2hvdWxkIG5vdCBoYXBwZW4gYXMgdGhpcyB3b3VsZCBiZSBpbnZhbGlkIFR5cGVzU2NyaXB0XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZnJvbTogaW1wb3J0RGVjbGFyYXRpb24ubW9kdWxlU3BlY2lmaWVyLnRleHQsXG4gICAgICBuYW1lOiBpZC50ZXh0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZSBhIGB0cy5TeW1ib2xgIHRvIGl0cyBkZWNsYXJhdGlvbiwga2VlcGluZyB0cmFjayBvZiB0aGUgYHZpYU1vZHVsZWAgYWxvbmcgdGhlIHdheS5cbiAgICovXG4gIHByb3RlY3RlZCBnZXREZWNsYXJhdGlvbk9mU3ltYm9sKHN5bWJvbDogdHMuU3ltYm9sLCBvcmlnaW5hbElkOiB0cy5JZGVudGlmaWVyfG51bGwpOiBEZWNsYXJhdGlvblxuICAgICAgfG51bGwge1xuICAgIC8vIElmIHRoZSBzeW1ib2wgcG9pbnRzIHRvIGEgU2hvcnRoYW5kUHJvcGVydHlBc3NpZ25tZW50LCByZXNvbHZlIGl0LlxuICAgIGxldCB2YWx1ZURlY2xhcmF0aW9uOiB0cy5EZWNsYXJhdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbHVlRGVjbGFyYXRpb24gPSBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbjtcbiAgICB9IGVsc2UgaWYgKHN5bWJvbC5kZWNsYXJhdGlvbnMgIT09IHVuZGVmaW5lZCAmJiBzeW1ib2wuZGVjbGFyYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHZhbHVlRGVjbGFyYXRpb24gPSBzeW1ib2wuZGVjbGFyYXRpb25zWzBdO1xuICAgIH1cbiAgICBpZiAodmFsdWVEZWNsYXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmIHRzLmlzU2hvcnRoYW5kUHJvcGVydHlBc3NpZ25tZW50KHZhbHVlRGVjbGFyYXRpb24pKSB7XG4gICAgICBjb25zdCBzaG9ydGhhbmRTeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U2hvcnRoYW5kQXNzaWdubWVudFZhbHVlU3ltYm9sKHZhbHVlRGVjbGFyYXRpb24pO1xuICAgICAgaWYgKHNob3J0aGFuZFN5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0RGVjbGFyYXRpb25PZlN5bWJvbChzaG9ydGhhbmRTeW1ib2wsIG9yaWdpbmFsSWQpO1xuICAgIH0gZWxzZSBpZiAodmFsdWVEZWNsYXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmIHRzLmlzRXhwb3J0U3BlY2lmaWVyKHZhbHVlRGVjbGFyYXRpb24pKSB7XG4gICAgICBjb25zdCB0YXJnZXRTeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0RXhwb3J0U3BlY2lmaWVyTG9jYWxUYXJnZXRTeW1ib2wodmFsdWVEZWNsYXJhdGlvbik7XG4gICAgICBpZiAodGFyZ2V0U3ltYm9sID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5nZXREZWNsYXJhdGlvbk9mU3ltYm9sKHRhcmdldFN5bWJvbCwgb3JpZ2luYWxJZCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW1wb3J0SW5mbyA9IG9yaWdpbmFsSWQgJiYgdGhpcy5nZXRJbXBvcnRPZklkZW50aWZpZXIob3JpZ2luYWxJZCk7XG4gICAgY29uc3QgdmlhTW9kdWxlID1cbiAgICAgICAgaW1wb3J0SW5mbyAhPT0gbnVsbCAmJiBpbXBvcnRJbmZvLmZyb20gIT09IG51bGwgJiYgIWltcG9ydEluZm8uZnJvbS5zdGFydHNXaXRoKCcuJykgP1xuICAgICAgICBpbXBvcnRJbmZvLmZyb20gOlxuICAgICAgICBudWxsO1xuXG4gICAgLy8gTm93LCByZXNvbHZlIHRoZSBTeW1ib2wgdG8gaXRzIGRlY2xhcmF0aW9uIGJ5IGZvbGxvd2luZyBhbnkgYW5kIGFsbCBhbGlhc2VzLlxuICAgIHdoaWxlIChzeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgc3ltYm9sID0gdGhpcy5jaGVja2VyLmdldEFsaWFzZWRTeW1ib2woc3ltYm9sKTtcbiAgICB9XG5cbiAgICAvLyBMb29rIGF0IHRoZSByZXNvbHZlZCBTeW1ib2wncyBkZWNsYXJhdGlvbnMgYW5kIHBpY2sgb25lIG9mIHRoZW0gdG8gcmV0dXJuLiBWYWx1ZSBkZWNsYXJhdGlvbnNcbiAgICAvLyBhcmUgZ2l2ZW4gcHJlY2VkZW5jZSBvdmVyIHR5cGUgZGVjbGFyYXRpb25zLlxuICAgIGlmIChzeW1ib2wudmFsdWVEZWNsYXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBub2RlOiBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbixcbiAgICAgICAga25vd246IG51bGwsXG4gICAgICAgIHZpYU1vZHVsZSxcbiAgICAgICAgaWRlbnRpdHk6IG51bGwsXG4gICAgICAgIGtpbmQ6IERlY2xhcmF0aW9uS2luZC5Db25jcmV0ZSxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChzeW1ib2wuZGVjbGFyYXRpb25zICE9PSB1bmRlZmluZWQgJiYgc3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBub2RlOiBzeW1ib2wuZGVjbGFyYXRpb25zWzBdLFxuICAgICAgICBrbm93bjogbnVsbCxcbiAgICAgICAgdmlhTW9kdWxlLFxuICAgICAgICBpZGVudGl0eTogbnVsbCxcbiAgICAgICAga2luZDogRGVjbGFyYXRpb25LaW5kLkNvbmNyZXRlLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVmbGVjdERlY29yYXRvcihub2RlOiB0cy5EZWNvcmF0b3IpOiBEZWNvcmF0b3J8bnVsbCB7XG4gICAgLy8gQXR0ZW1wdCB0byByZXNvbHZlIHRoZSBkZWNvcmF0b3IgZXhwcmVzc2lvbiBpbnRvIGEgcmVmZXJlbmNlIHRvIGEgY29uY3JldGUgSWRlbnRpZmllci4gVGhlXG4gICAgLy8gZXhwcmVzc2lvbiBtYXkgY29udGFpbiBhIGNhbGwgdG8gYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIHRoZSBkZWNvcmF0b3IgZnVuY3Rpb24sIGluIHdoaWNoXG4gICAgLy8gY2FzZSB3ZSB3YW50IHRvIHJldHVybiB0aGUgYXJndW1lbnRzLlxuICAgIGxldCBkZWNvcmF0b3JFeHByOiB0cy5FeHByZXNzaW9uID0gbm9kZS5leHByZXNzaW9uO1xuICAgIGxldCBhcmdzOiB0cy5FeHByZXNzaW9uW118bnVsbCA9IG51bGw7XG5cbiAgICAvLyBDaGVjayBmb3IgY2FsbCBleHByZXNzaW9ucy5cbiAgICBpZiAodHMuaXNDYWxsRXhwcmVzc2lvbihkZWNvcmF0b3JFeHByKSkge1xuICAgICAgYXJncyA9IEFycmF5LmZyb20oZGVjb3JhdG9yRXhwci5hcmd1bWVudHMpO1xuICAgICAgZGVjb3JhdG9yRXhwciA9IGRlY29yYXRvckV4cHIuZXhwcmVzc2lvbjtcbiAgICB9XG5cbiAgICAvLyBUaGUgZmluYWwgcmVzb2x2ZWQgZGVjb3JhdG9yIHNob3VsZCBiZSBhIGB0cy5JZGVudGlmaWVyYCAtIGlmIGl0J3Mgbm90LCB0aGVuIHNvbWV0aGluZyBpc1xuICAgIC8vIHdyb25nIGFuZCB0aGUgZGVjb3JhdG9yIGNhbid0IGJlIHJlc29sdmVkIHN0YXRpY2FsbHkuXG4gICAgaWYgKCFpc0RlY29yYXRvcklkZW50aWZpZXIoZGVjb3JhdG9yRXhwcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRlY29yYXRvcklkZW50aWZpZXIgPSB0cy5pc0lkZW50aWZpZXIoZGVjb3JhdG9yRXhwcikgPyBkZWNvcmF0b3JFeHByIDogZGVjb3JhdG9yRXhwci5uYW1lO1xuICAgIGNvbnN0IGltcG9ydERlY2wgPSB0aGlzLmdldEltcG9ydE9mSWRlbnRpZmllcihkZWNvcmF0b3JJZGVudGlmaWVyKTtcblxuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiBkZWNvcmF0b3JJZGVudGlmaWVyLnRleHQsXG4gICAgICBpZGVudGlmaWVyOiBkZWNvcmF0b3JFeHByLFxuICAgICAgaW1wb3J0OiBpbXBvcnREZWNsLFxuICAgICAgbm9kZSxcbiAgICAgIGFyZ3MsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlZmxlY3RNZW1iZXIobm9kZTogdHMuQ2xhc3NFbGVtZW50KTogQ2xhc3NNZW1iZXJ8bnVsbCB7XG4gICAgbGV0IGtpbmQ6IENsYXNzTWVtYmVyS2luZHxudWxsID0gbnVsbDtcbiAgICBsZXQgdmFsdWU6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgbmFtZU5vZGU6IHRzLklkZW50aWZpZXJ8dHMuU3RyaW5nTGl0ZXJhbHxudWxsID0gbnVsbDtcblxuICAgIGlmICh0cy5pc1Byb3BlcnR5RGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIGtpbmQgPSBDbGFzc01lbWJlcktpbmQuUHJvcGVydHk7XG4gICAgICB2YWx1ZSA9IG5vZGUuaW5pdGlhbGl6ZXIgfHwgbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRzLmlzR2V0QWNjZXNzb3JEZWNsYXJhdGlvbihub2RlKSkge1xuICAgICAga2luZCA9IENsYXNzTWVtYmVyS2luZC5HZXR0ZXI7XG4gICAgfSBlbHNlIGlmICh0cy5pc1NldEFjY2Vzc29yRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIGtpbmQgPSBDbGFzc01lbWJlcktpbmQuU2V0dGVyO1xuICAgIH0gZWxzZSBpZiAodHMuaXNNZXRob2REZWNsYXJhdGlvbihub2RlKSkge1xuICAgICAga2luZCA9IENsYXNzTWVtYmVyS2luZC5NZXRob2Q7XG4gICAgfSBlbHNlIGlmICh0cy5pc0NvbnN0cnVjdG9yRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIGtpbmQgPSBDbGFzc01lbWJlcktpbmQuQ29uc3RydWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICh0cy5pc0NvbnN0cnVjdG9yRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIG5hbWUgPSAnY29uc3RydWN0b3InO1xuICAgIH0gZWxzZSBpZiAodHMuaXNJZGVudGlmaWVyKG5vZGUubmFtZSkpIHtcbiAgICAgIG5hbWUgPSBub2RlLm5hbWUudGV4dDtcbiAgICAgIG5hbWVOb2RlID0gbm9kZS5uYW1lO1xuICAgIH0gZWxzZSBpZiAodHMuaXNTdHJpbmdMaXRlcmFsKG5vZGUubmFtZSkpIHtcbiAgICAgIG5hbWUgPSBub2RlLm5hbWUudGV4dDtcbiAgICAgIG5hbWVOb2RlID0gbm9kZS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNvcmF0b3JzID0gdGhpcy5nZXREZWNvcmF0b3JzT2ZEZWNsYXJhdGlvbihub2RlKTtcbiAgICBjb25zdCBpc1N0YXRpYyA9IG5vZGUubW9kaWZpZXJzICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgbm9kZS5tb2RpZmllcnMuc29tZShtb2QgPT4gbW9kLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuU3RhdGljS2V5d29yZCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbm9kZSxcbiAgICAgIGltcGxlbWVudGF0aW9uOiBub2RlLFxuICAgICAga2luZCxcbiAgICAgIHR5cGU6IG5vZGUudHlwZSB8fCBudWxsLFxuICAgICAgbmFtZSxcbiAgICAgIG5hbWVOb2RlLFxuICAgICAgZGVjb3JhdG9ycyxcbiAgICAgIHZhbHVlLFxuICAgICAgaXNTdGF0aWMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHNldCBvZiBjbGFzc2VzIGRlY2xhcmVkIGluIGBmaWxlYCB3aGljaCBhcmUgZXhwb3J0ZWQuXG4gICAqL1xuICBwcml2YXRlIGdldExvY2FsRXhwb3J0ZWRDbGFzc2VzT2ZTb3VyY2VGaWxlKGZpbGU6IHRzLlNvdXJjZUZpbGUpOiBTZXQ8Q2xhc3NEZWNsYXJhdGlvbj4ge1xuICAgIGNvbnN0IGNhY2hlU2Y6IFNvdXJjZUZpbGVXaXRoQ2FjaGVkRXhwb3J0cyA9IGZpbGUgYXMgU291cmNlRmlsZVdpdGhDYWNoZWRFeHBvcnRzO1xuICAgIGlmIChjYWNoZVNmW0xvY2FsRXhwb3J0ZWRDbGFzc2VzXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBUUyBkb2VzIG5vdCBjdXJyZW50bHkgbmFycm93IHN5bWJvbC1rZXllZCBmaWVsZHMsIGhlbmNlIHRoZSBub24tbnVsbCBhc3NlcnQgaXMgbmVlZGVkLlxuICAgICAgcmV0dXJuIGNhY2hlU2ZbTG9jYWxFeHBvcnRlZENsYXNzZXNdITtcbiAgICB9XG5cbiAgICBjb25zdCBleHBvcnRTZXQgPSBuZXcgU2V0PENsYXNzRGVjbGFyYXRpb24+KCk7XG4gICAgY2FjaGVTZltMb2NhbEV4cG9ydGVkQ2xhc3Nlc10gPSBleHBvcnRTZXQ7XG5cbiAgICBjb25zdCBzZlN5bWJvbCA9IHRoaXMuY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGNhY2hlU2YpO1xuXG4gICAgaWYgKHNmU3ltYm9sID09PSB1bmRlZmluZWQgfHwgc2ZTeW1ib2wuZXhwb3J0cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZXhwb3J0U2V0O1xuICAgIH1cblxuICAgIC8vIFNjYW4gdGhlIGV4cG9ydGVkIHN5bWJvbCBvZiB0aGUgYHRzLlNvdXJjZUZpbGVgIGZvciB0aGUgb3JpZ2luYWwgYHN5bWJvbGAgb2YgdGhlIGNsYXNzXG4gICAgLy8gZGVjbGFyYXRpb24uXG4gICAgLy9cbiAgICAvLyBOb3RlOiB3aGVuIGNoZWNraW5nIG11bHRpcGxlIGNsYXNzZXMgZGVjbGFyZWQgaW4gdGhlIHNhbWUgZmlsZSwgdGhpcyByZXBlYXRzIHNvbWUgb3BlcmF0aW9ucy5cbiAgICAvLyBJbiB0aGVvcnksIHRoaXMgY291bGQgYmUgZXhwZW5zaXZlIGlmIHJ1biBpbiB0aGUgY29udGV4dCBvZiBhIG1hc3NpdmUgaW5wdXQgZmlsZSAobGlrZSBhXG4gICAgLy8gbGFyZ2UgRkVTTSBpbiBuZ2NjKS4gSWYgcGVyZm9ybWFuY2UgZG9lcyBiZWNvbWUgYW4gaXNzdWUgaGVyZSwgaXQgc2hvdWxkIGJlIHBvc3NpYmxlIHRvXG4gICAgLy8gY3JlYXRlIGEgYFNldDw+YFxuXG4gICAgLy8gVW5mb3J0dW5hdGVseSwgYHRzLkl0ZXJhdG9yYCBkb2Vzbid0IGltcGxlbWVudCB0aGUgaXRlcmF0b3IgcHJvdG9jb2wsIHNvIGl0ZXJhdGlvbiBoZXJlIGlzXG4gICAgLy8gZG9uZSBtYW51YWxseS5cbiAgICBjb25zdCBpdGVyID0gc2ZTeW1ib2wuZXhwb3J0cy52YWx1ZXMoKTtcbiAgICBsZXQgaXRlbSA9IGl0ZXIubmV4dCgpO1xuICAgIHdoaWxlIChpdGVtLmRvbmUgIT09IHRydWUpIHtcbiAgICAgIGxldCBleHBvcnRlZFN5bWJvbCA9IGl0ZW0udmFsdWU7XG5cbiAgICAgIC8vIElmIHRoaXMgZXhwb3J0ZWQgc3ltYm9sIGNvbWVzIGZyb20gYW4gYGV4cG9ydCB7Rm9vfWAgc3RhdGVtZW50LCB0aGVuIHRoZSBzeW1ib2wgaXMgYWN0dWFsbHlcbiAgICAgIC8vIGZvciB0aGUgZXhwb3J0IGRlY2xhcmF0aW9uLCBub3QgdGhlIG9yaWdpbmFsIGRlY2xhcmF0aW9uLiBTdWNoIGEgc3ltYm9sIHdpbGwgYmUgYW4gYWxpYXMsXG4gICAgICAvLyBzbyB1bndyYXAgYWxpYXNpbmcgaWYgbmVjZXNzYXJ5LlxuICAgICAgaWYgKGV4cG9ydGVkU3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICAgICAgZXhwb3J0ZWRTeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0QWxpYXNlZFN5bWJvbChleHBvcnRlZFN5bWJvbCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChleHBvcnRlZFN5bWJvbC52YWx1ZURlY2xhcmF0aW9uICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICBleHBvcnRlZFN5bWJvbC52YWx1ZURlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKSA9PT0gZmlsZSAmJlxuICAgICAgICAgIHRoaXMuaXNDbGFzcyhleHBvcnRlZFN5bWJvbC52YWx1ZURlY2xhcmF0aW9uKSkge1xuICAgICAgICBleHBvcnRTZXQuYWRkKGV4cG9ydGVkU3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pO1xuICAgICAgfVxuICAgICAgaXRlbSA9IGl0ZXIubmV4dCgpO1xuICAgIH1cblxuICAgIHJldHVybiBleHBvcnRTZXQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmxlY3ROYW1lT2ZEZWNsYXJhdGlvbihkZWNsOiB0cy5EZWNsYXJhdGlvbik6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgaWQgPSByZWZsZWN0SWRlbnRpZmllck9mRGVjbGFyYXRpb24oZGVjbCk7XG4gIHJldHVybiBpZCAmJiBpZC50ZXh0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZsZWN0SWRlbnRpZmllck9mRGVjbGFyYXRpb24oZGVjbDogdHMuRGVjbGFyYXRpb24pOiB0cy5JZGVudGlmaWVyfG51bGwge1xuICBpZiAodHMuaXNDbGFzc0RlY2xhcmF0aW9uKGRlY2wpIHx8IHRzLmlzRnVuY3Rpb25EZWNsYXJhdGlvbihkZWNsKSkge1xuICAgIHJldHVybiBkZWNsLm5hbWUgfHwgbnVsbDtcbiAgfSBlbHNlIGlmICh0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbCkpIHtcbiAgICBpZiAodHMuaXNJZGVudGlmaWVyKGRlY2wubmFtZSkpIHtcbiAgICAgIHJldHVybiBkZWNsLm5hbWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmbGVjdFR5cGVFbnRpdHlUb0RlY2xhcmF0aW9uKFxuICAgIHR5cGU6IHRzLkVudGl0eU5hbWUsIGNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKToge25vZGU6IHRzLkRlY2xhcmF0aW9uLCBmcm9tOiBzdHJpbmd8bnVsbH0ge1xuICBsZXQgcmVhbFN5bWJvbCA9IGNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbih0eXBlKTtcbiAgaWYgKHJlYWxTeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlc29sdmUgdHlwZSBlbnRpdHkgJHt0eXBlLmdldFRleHQoKX0gdG8gc3ltYm9sYCk7XG4gIH1cbiAgd2hpbGUgKHJlYWxTeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgIHJlYWxTeW1ib2wgPSBjaGVja2VyLmdldEFsaWFzZWRTeW1ib2wocmVhbFN5bWJvbCk7XG4gIH1cblxuICBsZXQgbm9kZTogdHMuRGVjbGFyYXRpb258bnVsbCA9IG51bGw7XG4gIGlmIChyZWFsU3ltYm9sLnZhbHVlRGVjbGFyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIG5vZGUgPSByZWFsU3ltYm9sLnZhbHVlRGVjbGFyYXRpb247XG4gIH0gZWxzZSBpZiAocmVhbFN5bWJvbC5kZWNsYXJhdGlvbnMgIT09IHVuZGVmaW5lZCAmJiByZWFsU3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGggPT09IDEpIHtcbiAgICBub2RlID0gcmVhbFN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVzb2x2ZSB0eXBlIGVudGl0eSBzeW1ib2wgdG8gZGVjbGFyYXRpb25gKTtcbiAgfVxuXG4gIGlmICh0cy5pc1F1YWxpZmllZE5hbWUodHlwZSkpIHtcbiAgICBpZiAoIXRzLmlzSWRlbnRpZmllcih0eXBlLmxlZnQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBoYW5kbGUgcXVhbGlmaWVkIG5hbWUgd2l0aCBub24taWRlbnRpZmllciBsaHNgKTtcbiAgICB9XG4gICAgY29uc3Qgc3ltYm9sID0gY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHR5cGUubGVmdCk7XG4gICAgaWYgKHN5bWJvbCA9PT0gdW5kZWZpbmVkIHx8IHN5bWJvbC5kZWNsYXJhdGlvbnMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBzeW1ib2wuZGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVzb2x2ZSBxdWFsaWZpZWQgdHlwZSBlbnRpdHkgbGhzIHRvIHN5bWJvbGApO1xuICAgIH1cbiAgICBjb25zdCBkZWNsID0gc3ltYm9sLmRlY2xhcmF0aW9uc1swXTtcbiAgICBpZiAodHMuaXNOYW1lc3BhY2VJbXBvcnQoZGVjbCkpIHtcbiAgICAgIGNvbnN0IGNsYXVzZSA9IGRlY2wucGFyZW50ITtcbiAgICAgIGNvbnN0IGltcG9ydERlY2wgPSBjbGF1c2UucGFyZW50ITtcbiAgICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKGltcG9ydERlY2wubW9kdWxlU3BlY2lmaWVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE1vZHVsZSBzcGVjaWZpZXIgaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4ge25vZGUsIGZyb206IGltcG9ydERlY2wubW9kdWxlU3BlY2lmaWVyLnRleHR9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaW1wb3J0IHR5cGU/YCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiB7bm9kZSwgZnJvbTogbnVsbH07XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IobWVtYmVyczogQ2xhc3NNZW1iZXJbXSwgbmFtZTogc3RyaW5nLCBtb2R1bGU/OiBzdHJpbmcpOlxuICAgIHttZW1iZXI6IENsYXNzTWVtYmVyLCBkZWNvcmF0b3JzOiBEZWNvcmF0b3JbXX1bXSB7XG4gIHJldHVybiBtZW1iZXJzLmZpbHRlcihtZW1iZXIgPT4gIW1lbWJlci5pc1N0YXRpYylcbiAgICAgIC5tYXAobWVtYmVyID0+IHtcbiAgICAgICAgaWYgKG1lbWJlci5kZWNvcmF0b3JzID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNvcmF0b3JzID0gbWVtYmVyLmRlY29yYXRvcnMuZmlsdGVyKGRlYyA9PiB7XG4gICAgICAgICAgaWYgKGRlYy5pbXBvcnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWMuaW1wb3J0Lm5hbWUgPT09IG5hbWUgJiYgKG1vZHVsZSA9PT0gdW5kZWZpbmVkIHx8IGRlYy5pbXBvcnQuZnJvbSA9PT0gbW9kdWxlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRlYy5uYW1lID09PSBuYW1lICYmIG1vZHVsZSA9PT0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge21lbWJlciwgZGVjb3JhdG9yc307XG4gICAgICB9KVxuICAgICAgLmZpbHRlcigodmFsdWUpOiB2YWx1ZSBpcyB7bWVtYmVyOiBDbGFzc01lbWJlciwgZGVjb3JhdG9yczogRGVjb3JhdG9yW119ID0+IHZhbHVlICE9PSBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZW1iZXIoXG4gICAgbWVtYmVyczogQ2xhc3NNZW1iZXJbXSwgbmFtZTogc3RyaW5nLCBpc1N0YXRpYzogYm9vbGVhbiA9IGZhbHNlKTogQ2xhc3NNZW1iZXJ8bnVsbCB7XG4gIHJldHVybiBtZW1iZXJzLmZpbmQobWVtYmVyID0+IG1lbWJlci5pc1N0YXRpYyA9PT0gaXNTdGF0aWMgJiYgbWVtYmVyLm5hbWUgPT09IG5hbWUpIHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZsZWN0T2JqZWN0TGl0ZXJhbChub2RlOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbik6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+IHtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+KCk7XG4gIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgIGlmICh0cy5pc1Byb3BlcnR5QXNzaWdubWVudChwcm9wKSkge1xuICAgICAgY29uc3QgbmFtZSA9IHByb3BlcnR5TmFtZVRvU3RyaW5nKHByb3AubmFtZSk7XG4gICAgICBpZiAobmFtZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBtYXAuc2V0KG5hbWUsIHByb3AuaW5pdGlhbGl6ZXIpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNTaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcCkpIHtcbiAgICAgIG1hcC5zZXQocHJvcC5uYW1lLnRleHQsIHByb3AubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBjYXN0RGVjbGFyYXRpb25Ub0NsYXNzT3JEaWUoZGVjbGFyYXRpb246IENsYXNzRGVjbGFyYXRpb24pOlxuICAgIENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4ge1xuICBpZiAoIXRzLmlzQ2xhc3NEZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBSZWZsZWN0aW5nIG9uIGEgJHt0cy5TeW50YXhLaW5kW2RlY2xhcmF0aW9uLmtpbmRdfSBpbnN0ZWFkIG9mIGEgQ2xhc3NEZWNsYXJhdGlvbi5gKTtcbiAgfVxuICByZXR1cm4gZGVjbGFyYXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcmFtZXRlck5hbWUobmFtZTogdHMuQmluZGluZ05hbWUpOiBzdHJpbmd8bnVsbCB7XG4gIGlmICh0cy5pc0lkZW50aWZpZXIobmFtZSkpIHtcbiAgICByZXR1cm4gbmFtZS50ZXh0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb3BlcnR5TmFtZVRvU3RyaW5nKG5vZGU6IHRzLlByb3BlcnR5TmFtZSk6IHN0cmluZ3xudWxsIHtcbiAgaWYgKHRzLmlzSWRlbnRpZmllcihub2RlKSB8fCB0cy5pc1N0cmluZ0xpdGVyYWwobm9kZSkgfHwgdHMuaXNOdW1lcmljTGl0ZXJhbChub2RlKSkge1xuICAgIHJldHVybiBub2RlLnRleHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21wdXRlIHRoZSBsZWZ0IG1vc3QgaWRlbnRpZmllciBpbiBhIHF1YWxpZmllZCB0eXBlIGNoYWluLiBFLmcuIHRoZSBgYWAgb2YgYGEuYi5jLlNvbWVUeXBlYC5cbiAqIEBwYXJhbSBxdWFsaWZpZWROYW1lIFRoZSBzdGFydGluZyBwcm9wZXJ0eSBhY2Nlc3MgZXhwcmVzc2lvbiBmcm9tIHdoaWNoIHdlIHdhbnQgdG8gY29tcHV0ZVxuICogdGhlIGxlZnQgbW9zdCBpZGVudGlmaWVyLlxuICogQHJldHVybnMgdGhlIGxlZnQgbW9zdCBpZGVudGlmaWVyIGluIHRoZSBjaGFpbiBvciBgbnVsbGAgaWYgaXQgaXMgbm90IGFuIGlkZW50aWZpZXIuXG4gKi9cbmZ1bmN0aW9uIGdldFF1YWxpZmllZE5hbWVSb290KHF1YWxpZmllZE5hbWU6IHRzLlF1YWxpZmllZE5hbWUpOiB0cy5JZGVudGlmaWVyfG51bGwge1xuICB3aGlsZSAodHMuaXNRdWFsaWZpZWROYW1lKHF1YWxpZmllZE5hbWUubGVmdCkpIHtcbiAgICBxdWFsaWZpZWROYW1lID0gcXVhbGlmaWVkTmFtZS5sZWZ0O1xuICB9XG4gIHJldHVybiB0cy5pc0lkZW50aWZpZXIocXVhbGlmaWVkTmFtZS5sZWZ0KSA/IHF1YWxpZmllZE5hbWUubGVmdCA6IG51bGw7XG59XG5cbi8qKlxuICogQ29tcHV0ZSB0aGUgbGVmdCBtb3N0IGlkZW50aWZpZXIgaW4gYSBwcm9wZXJ0eSBhY2Nlc3MgY2hhaW4uIEUuZy4gdGhlIGBhYCBvZiBgYS5iLmMuZGAuXG4gKiBAcGFyYW0gcHJvcGVydHlBY2Nlc3MgVGhlIHN0YXJ0aW5nIHByb3BlcnR5IGFjY2VzcyBleHByZXNzaW9uIGZyb20gd2hpY2ggd2Ugd2FudCB0byBjb21wdXRlXG4gKiB0aGUgbGVmdCBtb3N0IGlkZW50aWZpZXIuXG4gKiBAcmV0dXJucyB0aGUgbGVmdCBtb3N0IGlkZW50aWZpZXIgaW4gdGhlIGNoYWluIG9yIGBudWxsYCBpZiBpdCBpcyBub3QgYW4gaWRlbnRpZmllci5cbiAqL1xuZnVuY3Rpb24gZ2V0RmFyTGVmdElkZW50aWZpZXIocHJvcGVydHlBY2Nlc3M6IHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbik6IHRzLklkZW50aWZpZXJ8bnVsbCB7XG4gIHdoaWxlICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihwcm9wZXJ0eUFjY2Vzcy5leHByZXNzaW9uKSkge1xuICAgIHByb3BlcnR5QWNjZXNzID0gcHJvcGVydHlBY2Nlc3MuZXhwcmVzc2lvbjtcbiAgfVxuICByZXR1cm4gdHMuaXNJZGVudGlmaWVyKHByb3BlcnR5QWNjZXNzLmV4cHJlc3Npb24pID8gcHJvcGVydHlBY2Nlc3MuZXhwcmVzc2lvbiA6IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBJbXBvcnREZWNsYXJhdGlvbiBmb3IgdGhlIGdpdmVuIGBub2RlYCBpZiBpdCBpcyBlaXRoZXIgYW4gYEltcG9ydFNwZWNpZmllcmAgb3IgYVxuICogYE5hbWVzcGFjZUltcG9ydGAuIElmIG5vdCByZXR1cm4gYG51bGxgLlxuICovXG5mdW5jdGlvbiBnZXRDb250YWluaW5nSW1wb3J0RGVjbGFyYXRpb24obm9kZTogdHMuTm9kZSk6IHRzLkltcG9ydERlY2xhcmF0aW9ufG51bGwge1xuICByZXR1cm4gdHMuaXNJbXBvcnRTcGVjaWZpZXIobm9kZSkgPyBub2RlLnBhcmVudCEucGFyZW50IS5wYXJlbnQhIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuaXNOYW1lc3BhY2VJbXBvcnQobm9kZSkgPyBub2RlLnBhcmVudC5wYXJlbnQgOiBudWxsO1xufVxuXG4vKipcbiAqIENvbXB1dGUgdGhlIG5hbWUgYnkgd2hpY2ggdGhlIGBkZWNsYCB3YXMgZXhwb3J0ZWQsIG5vdCBpbXBvcnRlZC5cbiAqIElmIG5vIHN1Y2ggZGVjbGFyYXRpb24gY2FuIGJlIGZvdW5kIChlLmcuIGl0IGlzIGEgbmFtZXNwYWNlIGltcG9ydClcbiAqIHRoZW4gZmFsbGJhY2sgdG8gdGhlIGBvcmlnaW5hbElkYC5cbiAqL1xuZnVuY3Rpb24gZ2V0RXhwb3J0ZWROYW1lKGRlY2w6IHRzLkRlY2xhcmF0aW9uLCBvcmlnaW5hbElkOiB0cy5JZGVudGlmaWVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRzLmlzSW1wb3J0U3BlY2lmaWVyKGRlY2wpID9cbiAgICAgIChkZWNsLnByb3BlcnR5TmFtZSAhPT0gdW5kZWZpbmVkID8gZGVjbC5wcm9wZXJ0eU5hbWUgOiBkZWNsLm5hbWUpLnRleHQgOlxuICAgICAgb3JpZ2luYWxJZC50ZXh0O1xufVxuXG5jb25zdCBMb2NhbEV4cG9ydGVkQ2xhc3NlcyA9IFN5bWJvbCgnTG9jYWxFeHBvcnRlZENsYXNzZXMnKTtcblxuLyoqXG4gKiBBIGB0cy5Tb3VyY2VGaWxlYCBleHBhbmRvIHdoaWNoIGluY2x1ZGVzIGEgY2FjaGVkIGBTZXRgIG9mIGxvY2FsIGBDbGFzc0RlY2xhcmF0aW9uc2AgdGhhdCBhcmVcbiAqIGV4cG9ydGVkIGVpdGhlciBkaXJlY3RseSAoYGV4cG9ydCBjbGFzcyAuLi5gKSBvciBpbmRpcmVjdGx5ICh2aWEgYGV4cG9ydCB7Li4ufWApLlxuICpcbiAqIFRoaXMgY2FjaGUgZG9lcyBub3QgY2F1c2UgbWVtb3J5IGxlYWtzIGFzOlxuICpcbiAqICAxLiBUaGUgb25seSByZWZlcmVuY2VzIGNhY2hlZCBoZXJlIGFyZSBsb2NhbCB0byB0aGUgYHRzLlNvdXJjZUZpbGVgLCBhbmQgdGh1cyBhbHNvIGF2YWlsYWJsZSBpblxuICogICAgIGB0aGlzLnN0YXRlbWVudHNgLlxuICpcbiAqICAyLiBUaGUgb25seSB3YXkgdGhpcyBgU2V0YCBjb3VsZCBjaGFuZ2UgaXMgaWYgdGhlIHNvdXJjZSBmaWxlIGl0c2VsZiB3YXMgY2hhbmdlZCwgd2hpY2ggd291bGRcbiAqICAgICBpbnZhbGlkYXRlIHRoZSBlbnRpcmUgYHRzLlNvdXJjZUZpbGVgIG9iamVjdCBpbiBmYXZvciBvZiBhIG5ldyB2ZXJzaW9uLiBUaHVzLCBjaGFuZ2luZyB0aGVcbiAqICAgICBzb3VyY2UgZmlsZSBhbHNvIGludmFsaWRhdGVzIHRoaXMgY2FjaGUuXG4gKi9cbmludGVyZmFjZSBTb3VyY2VGaWxlV2l0aENhY2hlZEV4cG9ydHMgZXh0ZW5kcyB0cy5Tb3VyY2VGaWxlIHtcbiAgLyoqXG4gICAqIENhY2hlZCBgU2V0YCBvZiBgQ2xhc3NEZWNsYXJhdGlvbmBzIHdoaWNoIGFyZSBsb2NhbGx5IGRlY2xhcmVkIGluIHRoaXMgZmlsZSBhbmQgYXJlIGV4cG9ydGVkXG4gICAqIGVpdGhlciBkaXJlY3RseSBvciBpbmRpcmVjdGx5LlxuICAgKi9cbiAgW0xvY2FsRXhwb3J0ZWRDbGFzc2VzXT86IFNldDxDbGFzc0RlY2xhcmF0aW9uPjtcbn1cbiJdfQ==