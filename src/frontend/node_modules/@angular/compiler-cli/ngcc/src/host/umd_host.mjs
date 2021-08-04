/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { absoluteFrom } from '../../../src/ngtsc/file_system';
import { isNamedFunctionDeclaration } from '../../../src/ngtsc/reflection';
import { FactoryMap, getTsHelperFnFromIdentifier, stripExtension } from '../utils';
import { extractGetterFnExpression, findNamespaceOfIdentifier, findRequireCallReference, isDefinePropertyReexportStatement, isExportsAssignment, isExportsDeclaration, isExportsStatement, isExternalImport, isRequireCall, isWildcardReexportStatement, skipAliases } from './commonjs_umd_utils';
import { getInnerClassDeclaration, getOuterNodeFromInnerDeclaration, isAssignment } from './esm2015_host';
import { Esm5ReflectionHost } from './esm5_host';
import { stripParentheses } from './utils';
export class UmdReflectionHost extends Esm5ReflectionHost {
    constructor(logger, isCore, src, dts = null) {
        super(logger, isCore, src, dts);
        this.umdModules = new FactoryMap(sf => this.computeUmdModule(sf));
        this.umdExports = new FactoryMap(sf => this.computeExportsOfUmdModule(sf));
        this.umdImportPaths = new FactoryMap(param => this.computeImportPath(param));
        this.program = src.program;
        this.compilerHost = src.host;
    }
    getImportOfIdentifier(id) {
        // Is `id` a namespaced property access, e.g. `Directive` in `core.Directive`?
        // If so capture the symbol of the namespace, e.g. `core`.
        const nsIdentifier = findNamespaceOfIdentifier(id);
        const importParameter = nsIdentifier && this.findUmdImportParameter(nsIdentifier);
        const from = importParameter && this.getUmdImportPath(importParameter);
        return from !== null ? { from, name: id.text } : null;
    }
    getDeclarationOfIdentifier(id) {
        // First we try one of the following:
        // 1. The `exports` identifier - referring to the current file/module.
        // 2. An identifier (e.g. `foo`) that refers to an imported UMD module.
        // 3. A UMD style export identifier (e.g. the `foo` of `exports.foo`).
        const declaration = this.getExportsDeclaration(id) || this.getUmdModuleDeclaration(id) ||
            this.getUmdDeclaration(id);
        if (declaration !== null) {
            return declaration;
        }
        // Try to get the declaration using the super class.
        const superDeclaration = super.getDeclarationOfIdentifier(id);
        if (superDeclaration === null) {
            return null;
        }
        // Check to see if the declaration is the inner node of a declaration IIFE.
        const outerNode = getOuterNodeFromInnerDeclaration(superDeclaration.node);
        if (outerNode === null) {
            return superDeclaration;
        }
        // We are only interested if the outer declaration is of the form
        // `exports.<name> = <initializer>`.
        if (!isExportsAssignment(outerNode)) {
            return superDeclaration;
        }
        return {
            kind: 1 /* Inline */,
            node: outerNode.left,
            implementation: outerNode.right,
            known: null,
            viaModule: null,
        };
    }
    getExportsOfModule(module) {
        return super.getExportsOfModule(module) || this.umdExports.get(module.getSourceFile());
    }
    getUmdModule(sourceFile) {
        if (sourceFile.isDeclarationFile) {
            return null;
        }
        return this.umdModules.get(sourceFile);
    }
    getUmdImportPath(importParameter) {
        return this.umdImportPaths.get(importParameter);
    }
    /**
     * Get the top level statements for a module.
     *
     * In UMD modules these are the body of the UMD factory function.
     *
     * @param sourceFile The module whose statements we want.
     * @returns An array of top level statements for the given module.
     */
    getModuleStatements(sourceFile) {
        const umdModule = this.getUmdModule(sourceFile);
        return umdModule !== null ? Array.from(umdModule.factoryFn.body.statements) : [];
    }
    getClassSymbolFromOuterDeclaration(declaration) {
        const superSymbol = super.getClassSymbolFromOuterDeclaration(declaration);
        if (superSymbol) {
            return superSymbol;
        }
        if (!isExportsDeclaration(declaration)) {
            return undefined;
        }
        let initializer = skipAliases(declaration.parent.right);
        if (ts.isIdentifier(initializer)) {
            const implementation = this.getDeclarationOfIdentifier(initializer);
            if (implementation !== null) {
                const implementationSymbol = this.getClassSymbol(implementation.node);
                if (implementationSymbol !== null) {
                    return implementationSymbol;
                }
            }
        }
        const innerDeclaration = getInnerClassDeclaration(initializer);
        if (innerDeclaration !== null) {
            return this.createClassSymbol(declaration.name, innerDeclaration);
        }
        return undefined;
    }
    getClassSymbolFromInnerDeclaration(declaration) {
        const superClassSymbol = super.getClassSymbolFromInnerDeclaration(declaration);
        if (superClassSymbol !== undefined) {
            return superClassSymbol;
        }
        if (!isNamedFunctionDeclaration(declaration)) {
            return undefined;
        }
        const outerNode = getOuterNodeFromInnerDeclaration(declaration);
        if (outerNode === null || !isExportsAssignment(outerNode)) {
            return undefined;
        }
        return this.createClassSymbol(outerNode.left.name, declaration);
    }
    /**
     * Extract all "classes" from the `statement` and add them to the `classes` map.
     */
    addClassSymbolsFromStatement(classes, statement) {
        super.addClassSymbolsFromStatement(classes, statement);
        // Also check for exports of the form: `exports.<name> = <class def>;`
        if (isExportsStatement(statement)) {
            const classSymbol = this.getClassSymbol(statement.expression.left);
            if (classSymbol) {
                classes.set(classSymbol.implementation, classSymbol);
            }
        }
    }
    /**
     * Analyze the given statement to see if it corresponds with an exports declaration like
     * `exports.MyClass = MyClass_1 = <class def>;`. If so, the declaration of `MyClass_1`
     * is associated with the `MyClass` identifier.
     *
     * @param statement The statement that needs to be preprocessed.
     */
    preprocessStatement(statement) {
        super.preprocessStatement(statement);
        if (!isExportsStatement(statement)) {
            return;
        }
        const declaration = statement.expression.left;
        const initializer = statement.expression.right;
        if (!isAssignment(initializer) || !ts.isIdentifier(initializer.left) ||
            !this.isClass(declaration)) {
            return;
        }
        const aliasedIdentifier = initializer.left;
        const aliasedDeclaration = this.getDeclarationOfIdentifier(aliasedIdentifier);
        if (aliasedDeclaration === null || aliasedDeclaration.node === null) {
            throw new Error(`Unable to locate declaration of ${aliasedIdentifier.text} in "${statement.getText()}"`);
        }
        this.aliasedClassDeclarations.set(aliasedDeclaration.node, declaration.name);
    }
    computeUmdModule(sourceFile) {
        if (sourceFile.statements.length !== 1) {
            throw new Error(`Expected UMD module file (${sourceFile.fileName}) to contain exactly one statement, ` +
                `but found ${sourceFile.statements.length}.`);
        }
        return parseStatementForUmdModule(sourceFile.statements[0]);
    }
    computeExportsOfUmdModule(sourceFile) {
        const moduleMap = new Map();
        for (const statement of this.getModuleStatements(sourceFile)) {
            if (isExportsStatement(statement)) {
                const exportDeclaration = this.extractBasicUmdExportDeclaration(statement);
                if (!moduleMap.has(exportDeclaration.name)) {
                    // We assume that the first `exports.<name>` is the actual declaration, and that any
                    // subsequent statements that match are decorating the original declaration.
                    // For example:
                    // ```
                    // exports.foo = <declaration>;
                    // exports.foo = __decorate(<decorator>, exports.foo);
                    // ```
                    // The declaration is the first line not the second.
                    moduleMap.set(exportDeclaration.name, exportDeclaration.declaration);
                }
            }
            else if (isWildcardReexportStatement(statement)) {
                const reexports = this.extractUmdWildcardReexports(statement, sourceFile);
                for (const reexport of reexports) {
                    moduleMap.set(reexport.name, reexport.declaration);
                }
            }
            else if (isDefinePropertyReexportStatement(statement)) {
                const exportDeclaration = this.extractUmdDefinePropertyExportDeclaration(statement);
                if (exportDeclaration !== null) {
                    moduleMap.set(exportDeclaration.name, exportDeclaration.declaration);
                }
            }
        }
        return moduleMap;
    }
    computeImportPath(param) {
        const umdModule = this.getUmdModule(param.getSourceFile());
        if (umdModule === null) {
            return null;
        }
        const imports = getImportsOfUmdModule(umdModule);
        if (imports === null) {
            return null;
        }
        let importPath = null;
        for (const i of imports) {
            // Add all imports to the map to speed up future look ups.
            this.umdImportPaths.set(i.parameter, i.path);
            if (i.parameter === param) {
                importPath = i.path;
            }
        }
        return importPath;
    }
    extractBasicUmdExportDeclaration(statement) {
        var _a;
        const name = statement.expression.left.name.text;
        const exportExpression = skipAliases(statement.expression.right);
        const declaration = (_a = this.getDeclarationOfExpression(exportExpression)) !== null && _a !== void 0 ? _a : {
            kind: 1 /* Inline */,
            node: statement.expression.left,
            implementation: statement.expression.right,
            known: null,
            viaModule: null,
        };
        return { name, declaration };
    }
    extractUmdWildcardReexports(statement, containingFile) {
        const reexportArg = statement.expression.arguments[0];
        const requireCall = isRequireCall(reexportArg) ?
            reexportArg :
            ts.isIdentifier(reexportArg) ? findRequireCallReference(reexportArg, this.checker) : null;
        let importPath = null;
        if (requireCall !== null) {
            importPath = requireCall.arguments[0].text;
        }
        else if (ts.isIdentifier(reexportArg)) {
            const importParameter = this.findUmdImportParameter(reexportArg);
            importPath = importParameter && this.getUmdImportPath(importParameter);
        }
        if (importPath === null) {
            return [];
        }
        const importedFile = this.resolveModuleName(importPath, containingFile);
        if (importedFile === undefined) {
            return [];
        }
        const importedExports = this.getExportsOfModule(importedFile);
        if (importedExports === null) {
            return [];
        }
        const viaModule = stripExtension(importedFile.fileName);
        const reexports = [];
        importedExports.forEach((decl, name) => reexports.push({ name, declaration: Object.assign(Object.assign({}, decl), { viaModule }) }));
        return reexports;
    }
    extractUmdDefinePropertyExportDeclaration(statement) {
        const args = statement.expression.arguments;
        const name = args[1].text;
        const getterFnExpression = extractGetterFnExpression(statement);
        if (getterFnExpression === null) {
            return null;
        }
        const declaration = this.getDeclarationOfExpression(getterFnExpression);
        if (declaration !== null) {
            return { name, declaration };
        }
        return {
            name,
            declaration: {
                kind: 1 /* Inline */,
                node: args[1],
                implementation: getterFnExpression,
                known: null,
                viaModule: null,
            },
        };
    }
    /**
     * Is the identifier a parameter on a UMD factory function, e.g. `function factory(this, core)`?
     * If so then return its declaration.
     */
    findUmdImportParameter(id) {
        const symbol = id && this.checker.getSymbolAtLocation(id) || null;
        const declaration = symbol && symbol.valueDeclaration;
        return declaration && ts.isParameter(declaration) ? declaration : null;
    }
    getUmdDeclaration(id) {
        const nsIdentifier = findNamespaceOfIdentifier(id);
        if (nsIdentifier === null) {
            return null;
        }
        if (nsIdentifier.parent.parent && isExportsAssignment(nsIdentifier.parent.parent)) {
            const initializer = nsIdentifier.parent.parent.right;
            if (ts.isIdentifier(initializer)) {
                return this.getDeclarationOfIdentifier(initializer);
            }
            return this.detectKnownDeclaration({
                kind: 1 /* Inline */,
                node: nsIdentifier.parent.parent.left,
                implementation: skipAliases(nsIdentifier.parent.parent.right),
                viaModule: null,
                known: null,
            });
        }
        const moduleDeclaration = this.getUmdModuleDeclaration(nsIdentifier);
        if (moduleDeclaration === null || moduleDeclaration.node === null ||
            !ts.isSourceFile(moduleDeclaration.node)) {
            return null;
        }
        const moduleExports = this.getExportsOfModule(moduleDeclaration.node);
        if (moduleExports === null) {
            return null;
        }
        // We need to compute the `viaModule` because  the `getExportsOfModule()` call
        // did not know that we were importing the declaration.
        const declaration = moduleExports.get(id.text);
        if (!moduleExports.has(id.text)) {
            return null;
        }
        // We need to compute the `viaModule` because  the `getExportsOfModule()` call
        // did not know that we were importing the declaration.
        const viaModule = declaration.viaModule === null ? moduleDeclaration.viaModule : declaration.viaModule;
        return Object.assign(Object.assign({}, declaration), { viaModule, known: getTsHelperFnFromIdentifier(id) });
    }
    getExportsDeclaration(id) {
        if (!isExportsIdentifier(id)) {
            return null;
        }
        // Sadly, in the case of `exports.foo = bar`, we can't use `this.findUmdImportParameter(id)`
        // to check whether this `exports` is from the IIFE body arguments, because
        // `this.checker.getSymbolAtLocation(id)` will return the symbol for the `foo` identifier
        // rather than the `exports` identifier.
        //
        // Instead we search the symbols in the current local scope.
        const exportsSymbol = this.checker.getSymbolsInScope(id, ts.SymbolFlags.Variable)
            .find(symbol => symbol.name === 'exports');
        const node = (exportsSymbol === null || exportsSymbol === void 0 ? void 0 : exportsSymbol.valueDeclaration) !== undefined &&
            !ts.isFunctionExpression(exportsSymbol.valueDeclaration.parent) ?
            // There is a locally defined `exports` variable that is not a function parameter.
            // So this `exports` identifier must be a local variable and does not represent the module.
            exportsSymbol.valueDeclaration :
            // There is no local symbol or it is a parameter of an IIFE.
            // So this `exports` represents the current "module".
            id.getSourceFile();
        return {
            kind: 0 /* Concrete */,
            node,
            viaModule: null,
            known: null,
            identity: null,
        };
    }
    getUmdModuleDeclaration(id) {
        const importPath = this.getImportPathFromParameter(id) || this.getImportPathFromRequireCall(id);
        if (importPath === null) {
            return null;
        }
        const module = this.resolveModuleName(importPath, id.getSourceFile());
        if (module === undefined) {
            return null;
        }
        const viaModule = isExternalImport(importPath) ? importPath : null;
        return { kind: 0 /* Concrete */, node: module, viaModule, known: null, identity: null };
    }
    getImportPathFromParameter(id) {
        const importParameter = this.findUmdImportParameter(id);
        if (importParameter === null) {
            return null;
        }
        return this.getUmdImportPath(importParameter);
    }
    getImportPathFromRequireCall(id) {
        const requireCall = findRequireCallReference(id, this.checker);
        if (requireCall === null) {
            return null;
        }
        return requireCall.arguments[0].text;
    }
    /**
     * If this is an IIFE then try to grab the outer and inner classes otherwise fallback on the super
     * class.
     */
    getDeclarationOfExpression(expression) {
        const inner = getInnerClassDeclaration(expression);
        if (inner !== null) {
            const outer = getOuterNodeFromInnerDeclaration(inner);
            if (outer !== null && isExportsAssignment(outer)) {
                return {
                    kind: 1 /* Inline */,
                    node: outer.left,
                    implementation: inner,
                    known: null,
                    viaModule: null,
                };
            }
        }
        return super.getDeclarationOfExpression(expression);
    }
    resolveModuleName(moduleName, containingFile) {
        if (this.compilerHost.resolveModuleNames) {
            const moduleInfo = this.compilerHost.resolveModuleNames([moduleName], containingFile.fileName, undefined, undefined, this.program.getCompilerOptions())[0];
            return moduleInfo && this.program.getSourceFile(absoluteFrom(moduleInfo.resolvedFileName));
        }
        else {
            const moduleInfo = ts.resolveModuleName(moduleName, containingFile.fileName, this.program.getCompilerOptions(), this.compilerHost);
            return moduleInfo.resolvedModule &&
                this.program.getSourceFile(absoluteFrom(moduleInfo.resolvedModule.resolvedFileName));
        }
    }
}
export function parseStatementForUmdModule(statement) {
    const wrapperCall = getUmdWrapperCall(statement);
    if (!wrapperCall)
        return null;
    const wrapperFn = wrapperCall.expression;
    if (!ts.isFunctionExpression(wrapperFn))
        return null;
    const factoryFnParamIndex = wrapperFn.parameters.findIndex(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === 'factory');
    if (factoryFnParamIndex === -1)
        return null;
    const factoryFn = stripParentheses(wrapperCall.arguments[factoryFnParamIndex]);
    if (!factoryFn || !ts.isFunctionExpression(factoryFn))
        return null;
    return { wrapperFn, factoryFn };
}
function getUmdWrapperCall(statement) {
    if (!ts.isExpressionStatement(statement) || !ts.isParenthesizedExpression(statement.expression) ||
        !ts.isCallExpression(statement.expression.expression) ||
        !ts.isFunctionExpression(statement.expression.expression.expression)) {
        return null;
    }
    return statement.expression.expression;
}
export function getImportsOfUmdModule(umdModule) {
    const imports = [];
    for (let i = 1; i < umdModule.factoryFn.parameters.length; i++) {
        imports.push({
            parameter: umdModule.factoryFn.parameters[i],
            path: getRequiredModulePath(umdModule.wrapperFn, i)
        });
    }
    return imports;
}
function getRequiredModulePath(wrapperFn, paramIndex) {
    const statement = wrapperFn.body.statements[0];
    if (!ts.isExpressionStatement(statement)) {
        throw new Error('UMD wrapper body is not an expression statement:\n' + wrapperFn.body.getText());
    }
    const modulePaths = [];
    findModulePaths(statement.expression);
    // Since we were only interested in the `require()` calls, we miss the `exports` argument, so we
    // need to subtract 1.
    // E.g. `function(exports, dep1, dep2)` maps to `function(exports, require('path/to/dep1'),
    // require('path/to/dep2'))`
    return modulePaths[paramIndex - 1];
    // Search the statement for calls to `require('...')` and extract the string value of the first
    // argument
    function findModulePaths(node) {
        if (isRequireCall(node)) {
            const argument = node.arguments[0];
            if (ts.isStringLiteral(argument)) {
                modulePaths.push(argument.text);
            }
        }
        else {
            node.forEachChild(findModulePaths);
        }
    }
}
/**
 * Is the `node` an identifier with the name "exports"?
 */
function isExportsIdentifier(node) {
    return ts.isIdentifier(node) && node.text === 'exports';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW1kX2hvc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvaG9zdC91bWRfaG9zdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFNUQsT0FBTyxFQUF1QywwQkFBMEIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBRS9HLE9BQU8sRUFBQyxVQUFVLEVBQUUsMkJBQTJCLEVBQUUsY0FBYyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRWpGLE9BQU8sRUFBdUUseUJBQXlCLEVBQUUseUJBQXlCLEVBQUUsd0JBQXdCLEVBQUUsaUNBQWlDLEVBQUUsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBNEIsTUFBTSxzQkFBc0IsQ0FBQztBQUNsWSxPQUFPLEVBQUMsd0JBQXdCLEVBQUUsZ0NBQWdDLEVBQUUsWUFBWSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDeEcsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBRS9DLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV6QyxNQUFNLE9BQU8saUJBQWtCLFNBQVEsa0JBQWtCO0lBVXZELFlBQVksTUFBYyxFQUFFLE1BQWUsRUFBRSxHQUFrQixFQUFFLE1BQTBCLElBQUk7UUFDN0YsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBVnhCLGVBQVUsR0FDaEIsSUFBSSxVQUFVLENBQWdDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFD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LElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkMsSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUNoQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNqQztTQUNGO2FBQU07WUFDTCxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ3BDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsbUJBQW1CLENBQUMsSUFBYTtJQUN4QyxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLENBQUM7QUFDMUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHthYnNvbHV0ZUZyb219IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0xvZ2dlcn0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2xvZ2dpbmcnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbiwgRGVjbGFyYXRpb25LaW5kLCBJbXBvcnQsIGlzTmFtZWRGdW5jdGlvbkRlY2xhcmF0aW9ufSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvcmVmbGVjdGlvbic7XG5pbXBvcnQge0J1bmRsZVByb2dyYW19IGZyb20gJy4uL3BhY2thZ2VzL2J1bmRsZV9wcm9ncmFtJztcbmltcG9ydCB7RmFjdG9yeU1hcCwgZ2V0VHNIZWxwZXJGbkZyb21JZGVudGlmaWVyLCBzdHJpcEV4dGVuc2lvbn0gZnJvbSAnLi4vdXRpbHMnO1xuXG5pbXBvcnQge0RlZmluZVByb3BlcnR5UmVleHBvcnRTdGF0ZW1lbnQsIEV4cG9ydERlY2xhcmF0aW9uLCBFeHBvcnRzU3RhdGVtZW50LCBleHRyYWN0R2V0dGVyRm5FeHByZXNzaW9uLCBmaW5kTmFtZXNwYWNlT2ZJZGVudGlmaWVyLCBmaW5kUmVxdWlyZUNhbGxSZWZlcmVuY2UsIGlzRGVmaW5lUHJvcGVydHlSZWV4cG9ydFN0YXRlbWVudCwgaXNFeHBvcnRzQXNzaWdubWVudCwgaXNFeHBvcnRzRGVjbGFyYXRpb24sIGlzRXhwb3J0c1N0YXRlbWVudCwgaXNFeHRlcm5hbEltcG9ydCwgaXNSZXF1aXJlQ2FsbCwgaXNXaWxkY2FyZFJlZXhwb3J0U3RhdGVtZW50LCBza2lwQWxpYXNlcywgV2lsZGNhcmRSZWV4cG9ydFN0YXRlbWVudH0gZnJvbSAnLi9jb21tb25qc191bWRfdXRpbHMnO1xuaW1wb3J0IHtnZXRJbm5lckNsYXNzRGVjbGFyYXRpb24sIGdldE91dGVyTm9kZUZyb21Jbm5lckRlY2xhcmF0aW9uLCBpc0Fzc2lnbm1lbnR9IGZyb20gJy4vZXNtMjAxNV9ob3N0JztcbmltcG9ydCB7RXNtNVJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuL2VzbTVfaG9zdCc7XG5pbXBvcnQge05nY2NDbGFzc1N5bWJvbH0gZnJvbSAnLi9uZ2NjX2hvc3QnO1xuaW1wb3J0IHtzdHJpcFBhcmVudGhlc2VzfSBmcm9tICcuL3V0aWxzJztcblxuZXhwb3J0IGNsYXNzIFVtZFJlZmxlY3Rpb25Ib3N0IGV4dGVuZHMgRXNtNVJlZmxlY3Rpb25Ib3N0IHtcbiAgcHJvdGVjdGVkIHVtZE1vZHVsZXMgPVxuICAgICAgbmV3IEZhY3RvcnlNYXA8dHMuU291cmNlRmlsZSwgVW1kTW9kdWxlfG51bGw+KHNmID0+IHRoaXMuY29tcHV0ZVVtZE1vZHVsZShzZikpO1xuICBwcm90ZWN0ZWQgdW1kRXhwb3J0cyA9IG5ldyBGYWN0b3J5TWFwPHRzLlNvdXJjZUZpbGUsIE1hcDxzdHJpbmcsIERlY2xhcmF0aW9uPnxudWxsPihcbiAgICAgIHNmID0+IHRoaXMuY29tcHV0ZUV4cG9ydHNPZlVtZE1vZHVsZShzZikpO1xuICBwcm90ZWN0ZWQgdW1kSW1wb3J0UGF0aHMgPVxuICAgICAgbmV3IEZhY3RvcnlNYXA8dHMuUGFyYW1ldGVyRGVjbGFyYXRpb24sIHN0cmluZ3xudWxsPihwYXJhbSA9PiB0aGlzLmNvbXB1dGVJbXBvcnRQYXRoKHBhcmFtKSk7XG4gIHByb3RlY3RlZCBwcm9ncmFtOiB0cy5Qcm9ncmFtO1xuICBwcm90ZWN0ZWQgY29tcGlsZXJIb3N0OiB0cy5Db21waWxlckhvc3Q7XG5cbiAgY29uc3RydWN0b3IobG9nZ2VyOiBMb2dnZXIsIGlzQ29yZTogYm9vbGVhbiwgc3JjOiBCdW5kbGVQcm9ncmFtLCBkdHM6IEJ1bmRsZVByb2dyYW18bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcihsb2dnZXIsIGlzQ29yZSwgc3JjLCBkdHMpO1xuICAgIHRoaXMucHJvZ3JhbSA9IHNyYy5wcm9ncmFtO1xuICAgIHRoaXMuY29tcGlsZXJIb3N0ID0gc3JjLmhvc3Q7XG4gIH1cblxuICBnZXRJbXBvcnRPZklkZW50aWZpZXIoaWQ6IHRzLklkZW50aWZpZXIpOiBJbXBvcnR8bnVsbCB7XG4gICAgLy8gSXMgYGlkYCBhIG5hbWVzcGFjZWQgcHJvcGVydHkgYWNjZXNzLCBlLmcuIGBEaXJlY3RpdmVgIGluIGBjb3JlLkRpcmVjdGl2ZWA/XG4gICAgLy8gSWYgc28gY2FwdHVyZSB0aGUgc3ltYm9sIG9mIHRoZSBuYW1lc3BhY2UsIGUuZy4gYGNvcmVgLlxuICAgIGNvbnN0IG5zSWRlbnRpZmllciA9IGZpbmROYW1lc3BhY2VPZklkZW50aWZpZXIoaWQpO1xuICAgIGNvbnN0IGltcG9ydFBhcmFtZXRlciA9IG5zSWRlbnRpZmllciAmJiB0aGlzLmZpbmRVbWRJbXBvcnRQYXJhbWV0ZXIobnNJZGVudGlmaWVyKTtcbiAgICBjb25zdCBmcm9tID0gaW1wb3J0UGFyYW1ldGVyICYmIHRoaXMuZ2V0VW1kSW1wb3J0UGF0aChpbXBvcnRQYXJhbWV0ZXIpO1xuICAgIHJldHVybiBmcm9tICE9PSBudWxsID8ge2Zyb20sIG5hbWU6IGlkLnRleHR9IDogbnVsbDtcbiAgfVxuXG4gIGdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgLy8gRmlyc3Qgd2UgdHJ5IG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgIC8vIDEuIFRoZSBgZXhwb3J0c2AgaWRlbnRpZmllciAtIHJlZmVycmluZyB0byB0aGUgY3VycmVudCBmaWxlL21vZHVsZS5cbiAgICAvLyAyLiBBbiBpZGVudGlmaWVyIChlLmcuIGBmb29gKSB0aGF0IHJlZmVycyB0byBhbiBpbXBvcnRlZCBVTUQgbW9kdWxlLlxuICAgIC8vIDMuIEEgVU1EIHN0eWxlIGV4cG9ydCBpZGVudGlmaWVyIChlLmcuIHRoZSBgZm9vYCBvZiBgZXhwb3J0cy5mb29gKS5cbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHRoaXMuZ2V0RXhwb3J0c0RlY2xhcmF0aW9uKGlkKSB8fCB0aGlzLmdldFVtZE1vZHVsZURlY2xhcmF0aW9uKGlkKSB8fFxuICAgICAgICB0aGlzLmdldFVtZERlY2xhcmF0aW9uKGlkKTtcbiAgICBpZiAoZGVjbGFyYXRpb24gIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBkZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICAvLyBUcnkgdG8gZ2V0IHRoZSBkZWNsYXJhdGlvbiB1c2luZyB0aGUgc3VwZXIgY2xhc3MuXG4gICAgY29uc3Qgc3VwZXJEZWNsYXJhdGlvbiA9IHN1cGVyLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkKTtcbiAgICBpZiAoc3VwZXJEZWNsYXJhdGlvbiA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoZSBkZWNsYXJhdGlvbiBpcyB0aGUgaW5uZXIgbm9kZSBvZiBhIGRlY2xhcmF0aW9uIElJRkUuXG4gICAgY29uc3Qgb3V0ZXJOb2RlID0gZ2V0T3V0ZXJOb2RlRnJvbUlubmVyRGVjbGFyYXRpb24oc3VwZXJEZWNsYXJhdGlvbi5ub2RlKTtcbiAgICBpZiAob3V0ZXJOb2RlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gc3VwZXJEZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICAvLyBXZSBhcmUgb25seSBpbnRlcmVzdGVkIGlmIHRoZSBvdXRlciBkZWNsYXJhdGlvbiBpcyBvZiB0aGUgZm9ybVxuICAgIC8vIGBleHBvcnRzLjxuYW1lPiA9IDxpbml0aWFsaXplcj5gLlxuICAgIGlmICghaXNFeHBvcnRzQXNzaWdubWVudChvdXRlck5vZGUpKSB7XG4gICAgICByZXR1cm4gc3VwZXJEZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAga2luZDogRGVjbGFyYXRpb25LaW5kLklubGluZSxcbiAgICAgIG5vZGU6IG91dGVyTm9kZS5sZWZ0LFxuICAgICAgaW1wbGVtZW50YXRpb246IG91dGVyTm9kZS5yaWdodCxcbiAgICAgIGtub3duOiBudWxsLFxuICAgICAgdmlhTW9kdWxlOiBudWxsLFxuICAgIH07XG4gIH1cblxuICBnZXRFeHBvcnRzT2ZNb2R1bGUobW9kdWxlOiB0cy5Ob2RlKTogTWFwPHN0cmluZywgRGVjbGFyYXRpb24+fG51bGwge1xuICAgIHJldHVybiBzdXBlci5nZXRFeHBvcnRzT2ZNb2R1bGUobW9kdWxlKSB8fCB0aGlzLnVtZEV4cG9ydHMuZ2V0KG1vZHVsZS5nZXRTb3VyY2VGaWxlKCkpO1xuICB9XG5cbiAgZ2V0VW1kTW9kdWxlKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBVbWRNb2R1bGV8bnVsbCB7XG4gICAgaWYgKHNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVtZE1vZHVsZXMuZ2V0KHNvdXJjZUZpbGUpO1xuICB9XG5cbiAgZ2V0VW1kSW1wb3J0UGF0aChpbXBvcnRQYXJhbWV0ZXI6IHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uKTogc3RyaW5nfG51bGwge1xuICAgIHJldHVybiB0aGlzLnVtZEltcG9ydFBhdGhzLmdldChpbXBvcnRQYXJhbWV0ZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgdG9wIGxldmVsIHN0YXRlbWVudHMgZm9yIGEgbW9kdWxlLlxuICAgKlxuICAgKiBJbiBVTUQgbW9kdWxlcyB0aGVzZSBhcmUgdGhlIGJvZHkgb2YgdGhlIFVNRCBmYWN0b3J5IGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlRmlsZSBUaGUgbW9kdWxlIHdob3NlIHN0YXRlbWVudHMgd2Ugd2FudC5cbiAgICogQHJldHVybnMgQW4gYXJyYXkgb2YgdG9wIGxldmVsIHN0YXRlbWVudHMgZm9yIHRoZSBnaXZlbiBtb2R1bGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0TW9kdWxlU3RhdGVtZW50cyhzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogdHMuU3RhdGVtZW50W10ge1xuICAgIGNvbnN0IHVtZE1vZHVsZSA9IHRoaXMuZ2V0VW1kTW9kdWxlKHNvdXJjZUZpbGUpO1xuICAgIHJldHVybiB1bWRNb2R1bGUgIT09IG51bGwgPyBBcnJheS5mcm9tKHVtZE1vZHVsZS5mYWN0b3J5Rm4uYm9keS5zdGF0ZW1lbnRzKSA6IFtdO1xuICB9XG5cbiAgcHJvdGVjdGVkIGdldENsYXNzU3ltYm9sRnJvbU91dGVyRGVjbGFyYXRpb24oZGVjbGFyYXRpb246IHRzLk5vZGUpOiBOZ2NjQ2xhc3NTeW1ib2x8dW5kZWZpbmVkIHtcbiAgICBjb25zdCBzdXBlclN5bWJvbCA9IHN1cGVyLmdldENsYXNzU3ltYm9sRnJvbU91dGVyRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pO1xuICAgIGlmIChzdXBlclN5bWJvbCkge1xuICAgICAgcmV0dXJuIHN1cGVyU3ltYm9sO1xuICAgIH1cblxuICAgIGlmICghaXNFeHBvcnRzRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCBpbml0aWFsaXplciA9IHNraXBBbGlhc2VzKGRlY2xhcmF0aW9uLnBhcmVudC5yaWdodCk7XG5cbiAgICBpZiAodHMuaXNJZGVudGlmaWVyKGluaXRpYWxpemVyKSkge1xuICAgICAgY29uc3QgaW1wbGVtZW50YXRpb24gPSB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGluaXRpYWxpemVyKTtcbiAgICAgIGlmIChpbXBsZW1lbnRhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBpbXBsZW1lbnRhdGlvblN5bWJvbCA9IHRoaXMuZ2V0Q2xhc3NTeW1ib2woaW1wbGVtZW50YXRpb24ubm9kZSk7XG4gICAgICAgIGlmIChpbXBsZW1lbnRhdGlvblN5bWJvbCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBpbXBsZW1lbnRhdGlvblN5bWJvbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGlubmVyRGVjbGFyYXRpb24gPSBnZXRJbm5lckNsYXNzRGVjbGFyYXRpb24oaW5pdGlhbGl6ZXIpO1xuICAgIGlmIChpbm5lckRlY2xhcmF0aW9uICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzc1N5bWJvbChkZWNsYXJhdGlvbi5uYW1lLCBpbm5lckRlY2xhcmF0aW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cblxuICBwcm90ZWN0ZWQgZ2V0Q2xhc3NTeW1ib2xGcm9tSW5uZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbjogdHMuTm9kZSk6IE5nY2NDbGFzc1N5bWJvbHx1bmRlZmluZWQge1xuICAgIGNvbnN0IHN1cGVyQ2xhc3NTeW1ib2wgPSBzdXBlci5nZXRDbGFzc1N5bWJvbEZyb21Jbm5lckRlY2xhcmF0aW9uKGRlY2xhcmF0aW9uKTtcbiAgICBpZiAoc3VwZXJDbGFzc1N5bWJvbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gc3VwZXJDbGFzc1N5bWJvbDtcbiAgICB9XG5cbiAgICBpZiAoIWlzTmFtZWRGdW5jdGlvbkRlY2xhcmF0aW9uKGRlY2xhcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCBvdXRlck5vZGUgPSBnZXRPdXRlck5vZGVGcm9tSW5uZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbik7XG4gICAgaWYgKG91dGVyTm9kZSA9PT0gbnVsbCB8fCAhaXNFeHBvcnRzQXNzaWdubWVudChvdXRlck5vZGUpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzU3ltYm9sKG91dGVyTm9kZS5sZWZ0Lm5hbWUsIGRlY2xhcmF0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGFsbCBcImNsYXNzZXNcIiBmcm9tIHRoZSBgc3RhdGVtZW50YCBhbmQgYWRkIHRoZW0gdG8gdGhlIGBjbGFzc2VzYCBtYXAuXG4gICAqL1xuICBwcm90ZWN0ZWQgYWRkQ2xhc3NTeW1ib2xzRnJvbVN0YXRlbWVudChcbiAgICAgIGNsYXNzZXM6IE1hcDx0cy5TeW1ib2wsIE5nY2NDbGFzc1N5bWJvbD4sIHN0YXRlbWVudDogdHMuU3RhdGVtZW50KTogdm9pZCB7XG4gICAgc3VwZXIuYWRkQ2xhc3NTeW1ib2xzRnJvbVN0YXRlbWVudChjbGFzc2VzLCBzdGF0ZW1lbnQpO1xuXG4gICAgLy8gQWxzbyBjaGVjayBmb3IgZXhwb3J0cyBvZiB0aGUgZm9ybTogYGV4cG9ydHMuPG5hbWU+ID0gPGNsYXNzIGRlZj47YFxuICAgIGlmIChpc0V4cG9ydHNTdGF0ZW1lbnQoc3RhdGVtZW50KSkge1xuICAgICAgY29uc3QgY2xhc3NTeW1ib2wgPSB0aGlzLmdldENsYXNzU3ltYm9sKHN0YXRlbWVudC5leHByZXNzaW9uLmxlZnQpO1xuICAgICAgaWYgKGNsYXNzU3ltYm9sKSB7XG4gICAgICAgIGNsYXNzZXMuc2V0KGNsYXNzU3ltYm9sLmltcGxlbWVudGF0aW9uLCBjbGFzc1N5bWJvbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFuYWx5emUgdGhlIGdpdmVuIHN0YXRlbWVudCB0byBzZWUgaWYgaXQgY29ycmVzcG9uZHMgd2l0aCBhbiBleHBvcnRzIGRlY2xhcmF0aW9uIGxpa2VcbiAgICogYGV4cG9ydHMuTXlDbGFzcyA9IE15Q2xhc3NfMSA9IDxjbGFzcyBkZWY+O2AuIElmIHNvLCB0aGUgZGVjbGFyYXRpb24gb2YgYE15Q2xhc3NfMWBcbiAgICogaXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBgTXlDbGFzc2AgaWRlbnRpZmllci5cbiAgICpcbiAgICogQHBhcmFtIHN0YXRlbWVudCBUaGUgc3RhdGVtZW50IHRoYXQgbmVlZHMgdG8gYmUgcHJlcHJvY2Vzc2VkLlxuICAgKi9cbiAgcHJvdGVjdGVkIHByZXByb2Nlc3NTdGF0ZW1lbnQoc3RhdGVtZW50OiB0cy5TdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBzdXBlci5wcmVwcm9jZXNzU3RhdGVtZW50KHN0YXRlbWVudCk7XG5cbiAgICBpZiAoIWlzRXhwb3J0c1N0YXRlbWVudChzdGF0ZW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSBzdGF0ZW1lbnQuZXhwcmVzc2lvbi5sZWZ0O1xuICAgIGNvbnN0IGluaXRpYWxpemVyID0gc3RhdGVtZW50LmV4cHJlc3Npb24ucmlnaHQ7XG4gICAgaWYgKCFpc0Fzc2lnbm1lbnQoaW5pdGlhbGl6ZXIpIHx8ICF0cy5pc0lkZW50aWZpZXIoaW5pdGlhbGl6ZXIubGVmdCkgfHxcbiAgICAgICAgIXRoaXMuaXNDbGFzcyhkZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhbGlhc2VkSWRlbnRpZmllciA9IGluaXRpYWxpemVyLmxlZnQ7XG5cbiAgICBjb25zdCBhbGlhc2VkRGVjbGFyYXRpb24gPSB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGFsaWFzZWRJZGVudGlmaWVyKTtcbiAgICBpZiAoYWxpYXNlZERlY2xhcmF0aW9uID09PSBudWxsIHx8IGFsaWFzZWREZWNsYXJhdGlvbi5ub2RlID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFVuYWJsZSB0byBsb2NhdGUgZGVjbGFyYXRpb24gb2YgJHthbGlhc2VkSWRlbnRpZmllci50ZXh0fSBpbiBcIiR7c3RhdGVtZW50LmdldFRleHQoKX1cImApO1xuICAgIH1cbiAgICB0aGlzLmFsaWFzZWRDbGFzc0RlY2xhcmF0aW9ucy5zZXQoYWxpYXNlZERlY2xhcmF0aW9uLm5vZGUsIGRlY2xhcmF0aW9uLm5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21wdXRlVW1kTW9kdWxlKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBVbWRNb2R1bGV8bnVsbCB7XG4gICAgaWYgKHNvdXJjZUZpbGUuc3RhdGVtZW50cy5sZW5ndGggIT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgRXhwZWN0ZWQgVU1EIG1vZHVsZSBmaWxlICgke3NvdXJjZUZpbGUuZmlsZU5hbWV9KSB0byBjb250YWluIGV4YWN0bHkgb25lIHN0YXRlbWVudCwgYCArXG4gICAgICAgICAgYGJ1dCBmb3VuZCAke3NvdXJjZUZpbGUuc3RhdGVtZW50cy5sZW5ndGh9LmApO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZVN0YXRlbWVudEZvclVtZE1vZHVsZShzb3VyY2VGaWxlLnN0YXRlbWVudHNbMF0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21wdXRlRXhwb3J0c09mVW1kTW9kdWxlKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBNYXA8c3RyaW5nLCBEZWNsYXJhdGlvbj58bnVsbCB7XG4gICAgY29uc3QgbW9kdWxlTWFwID0gbmV3IE1hcDxzdHJpbmcsIERlY2xhcmF0aW9uPigpO1xuICAgIGZvciAoY29uc3Qgc3RhdGVtZW50IG9mIHRoaXMuZ2V0TW9kdWxlU3RhdGVtZW50cyhzb3VyY2VGaWxlKSkge1xuICAgICAgaWYgKGlzRXhwb3J0c1N0YXRlbWVudChzdGF0ZW1lbnQpKSB7XG4gICAgICAgIGNvbnN0IGV4cG9ydERlY2xhcmF0aW9uID0gdGhpcy5leHRyYWN0QmFzaWNVbWRFeHBvcnREZWNsYXJhdGlvbihzdGF0ZW1lbnQpO1xuICAgICAgICBpZiAoIW1vZHVsZU1hcC5oYXMoZXhwb3J0RGVjbGFyYXRpb24ubmFtZSkpIHtcbiAgICAgICAgICAvLyBXZSBhc3N1bWUgdGhhdCB0aGUgZmlyc3QgYGV4cG9ydHMuPG5hbWU+YCBpcyB0aGUgYWN0dWFsIGRlY2xhcmF0aW9uLCBhbmQgdGhhdCBhbnlcbiAgICAgICAgICAvLyBzdWJzZXF1ZW50IHN0YXRlbWVudHMgdGhhdCBtYXRjaCBhcmUgZGVjb3JhdGluZyB0aGUgb3JpZ2luYWwgZGVjbGFyYXRpb24uXG4gICAgICAgICAgLy8gRm9yIGV4YW1wbGU6XG4gICAgICAgICAgLy8gYGBgXG4gICAgICAgICAgLy8gZXhwb3J0cy5mb28gPSA8ZGVjbGFyYXRpb24+O1xuICAgICAgICAgIC8vIGV4cG9ydHMuZm9vID0gX19kZWNvcmF0ZSg8ZGVjb3JhdG9yPiwgZXhwb3J0cy5mb28pO1xuICAgICAgICAgIC8vIGBgYFxuICAgICAgICAgIC8vIFRoZSBkZWNsYXJhdGlvbiBpcyB0aGUgZmlyc3QgbGluZSBub3QgdGhlIHNlY29uZC5cbiAgICAgICAgICBtb2R1bGVNYXAuc2V0KGV4cG9ydERlY2xhcmF0aW9uLm5hbWUsIGV4cG9ydERlY2xhcmF0aW9uLmRlY2xhcmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc1dpbGRjYXJkUmVleHBvcnRTdGF0ZW1lbnQoc3RhdGVtZW50KSkge1xuICAgICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLmV4dHJhY3RVbWRXaWxkY2FyZFJlZXhwb3J0cyhzdGF0ZW1lbnQsIHNvdXJjZUZpbGUpO1xuICAgICAgICBmb3IgKGNvbnN0IHJlZXhwb3J0IG9mIHJlZXhwb3J0cykge1xuICAgICAgICAgIG1vZHVsZU1hcC5zZXQocmVleHBvcnQubmFtZSwgcmVleHBvcnQuZGVjbGFyYXRpb24pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmaW5lUHJvcGVydHlSZWV4cG9ydFN0YXRlbWVudChzdGF0ZW1lbnQpKSB7XG4gICAgICAgIGNvbnN0IGV4cG9ydERlY2xhcmF0aW9uID0gdGhpcy5leHRyYWN0VW1kRGVmaW5lUHJvcGVydHlFeHBvcnREZWNsYXJhdGlvbihzdGF0ZW1lbnQpO1xuICAgICAgICBpZiAoZXhwb3J0RGVjbGFyYXRpb24gIT09IG51bGwpIHtcbiAgICAgICAgICBtb2R1bGVNYXAuc2V0KGV4cG9ydERlY2xhcmF0aW9uLm5hbWUsIGV4cG9ydERlY2xhcmF0aW9uLmRlY2xhcmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbW9kdWxlTWFwO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21wdXRlSW1wb3J0UGF0aChwYXJhbTogdHMuUGFyYW1ldGVyRGVjbGFyYXRpb24pOiBzdHJpbmd8bnVsbCB7XG4gICAgY29uc3QgdW1kTW9kdWxlID0gdGhpcy5nZXRVbWRNb2R1bGUocGFyYW0uZ2V0U291cmNlRmlsZSgpKTtcbiAgICBpZiAodW1kTW9kdWxlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBvcnRzID0gZ2V0SW1wb3J0c09mVW1kTW9kdWxlKHVtZE1vZHVsZSk7XG4gICAgaWYgKGltcG9ydHMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBpbXBvcnRQYXRoOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IGkgb2YgaW1wb3J0cykge1xuICAgICAgLy8gQWRkIGFsbCBpbXBvcnRzIHRvIHRoZSBtYXAgdG8gc3BlZWQgdXAgZnV0dXJlIGxvb2sgdXBzLlxuICAgICAgdGhpcy51bWRJbXBvcnRQYXRocy5zZXQoaS5wYXJhbWV0ZXIsIGkucGF0aCk7XG4gICAgICBpZiAoaS5wYXJhbWV0ZXIgPT09IHBhcmFtKSB7XG4gICAgICAgIGltcG9ydFBhdGggPSBpLnBhdGg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGltcG9ydFBhdGg7XG4gIH1cblxuICBwcml2YXRlIGV4dHJhY3RCYXNpY1VtZEV4cG9ydERlY2xhcmF0aW9uKHN0YXRlbWVudDogRXhwb3J0c1N0YXRlbWVudCk6IEV4cG9ydERlY2xhcmF0aW9uIHtcbiAgICBjb25zdCBuYW1lID0gc3RhdGVtZW50LmV4cHJlc3Npb24ubGVmdC5uYW1lLnRleHQ7XG4gICAgY29uc3QgZXhwb3J0RXhwcmVzc2lvbiA9IHNraXBBbGlhc2VzKHN0YXRlbWVudC5leHByZXNzaW9uLnJpZ2h0KTtcbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZkV4cHJlc3Npb24oZXhwb3J0RXhwcmVzc2lvbikgPz8ge1xuICAgICAga2luZDogRGVjbGFyYXRpb25LaW5kLklubGluZSxcbiAgICAgIG5vZGU6IHN0YXRlbWVudC5leHByZXNzaW9uLmxlZnQsXG4gICAgICBpbXBsZW1lbnRhdGlvbjogc3RhdGVtZW50LmV4cHJlc3Npb24ucmlnaHQsXG4gICAgICBrbm93bjogbnVsbCxcbiAgICAgIHZpYU1vZHVsZTogbnVsbCxcbiAgICB9O1xuICAgIHJldHVybiB7bmFtZSwgZGVjbGFyYXRpb259O1xuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0VW1kV2lsZGNhcmRSZWV4cG9ydHMoXG4gICAgICBzdGF0ZW1lbnQ6IFdpbGRjYXJkUmVleHBvcnRTdGF0ZW1lbnQsIGNvbnRhaW5pbmdGaWxlOiB0cy5Tb3VyY2VGaWxlKTogRXhwb3J0RGVjbGFyYXRpb25bXSB7XG4gICAgY29uc3QgcmVleHBvcnRBcmcgPSBzdGF0ZW1lbnQuZXhwcmVzc2lvbi5hcmd1bWVudHNbMF07XG5cbiAgICBjb25zdCByZXF1aXJlQ2FsbCA9IGlzUmVxdWlyZUNhbGwocmVleHBvcnRBcmcpID9cbiAgICAgICAgcmVleHBvcnRBcmcgOlxuICAgICAgICB0cy5pc0lkZW50aWZpZXIocmVleHBvcnRBcmcpID8gZmluZFJlcXVpcmVDYWxsUmVmZXJlbmNlKHJlZXhwb3J0QXJnLCB0aGlzLmNoZWNrZXIpIDogbnVsbDtcblxuICAgIGxldCBpbXBvcnRQYXRoOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgICBpZiAocmVxdWlyZUNhbGwgIT09IG51bGwpIHtcbiAgICAgIGltcG9ydFBhdGggPSByZXF1aXJlQ2FsbC5hcmd1bWVudHNbMF0udGV4dDtcbiAgICB9IGVsc2UgaWYgKHRzLmlzSWRlbnRpZmllcihyZWV4cG9ydEFyZykpIHtcbiAgICAgIGNvbnN0IGltcG9ydFBhcmFtZXRlciA9IHRoaXMuZmluZFVtZEltcG9ydFBhcmFtZXRlcihyZWV4cG9ydEFyZyk7XG4gICAgICBpbXBvcnRQYXRoID0gaW1wb3J0UGFyYW1ldGVyICYmIHRoaXMuZ2V0VW1kSW1wb3J0UGF0aChpbXBvcnRQYXJhbWV0ZXIpO1xuICAgIH1cblxuICAgIGlmIChpbXBvcnRQYXRoID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgaW1wb3J0ZWRGaWxlID0gdGhpcy5yZXNvbHZlTW9kdWxlTmFtZShpbXBvcnRQYXRoLCBjb250YWluaW5nRmlsZSk7XG4gICAgaWYgKGltcG9ydGVkRmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgaW1wb3J0ZWRFeHBvcnRzID0gdGhpcy5nZXRFeHBvcnRzT2ZNb2R1bGUoaW1wb3J0ZWRGaWxlKTtcbiAgICBpZiAoaW1wb3J0ZWRFeHBvcnRzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgdmlhTW9kdWxlID0gc3RyaXBFeHRlbnNpb24oaW1wb3J0ZWRGaWxlLmZpbGVOYW1lKTtcbiAgICBjb25zdCByZWV4cG9ydHM6IEV4cG9ydERlY2xhcmF0aW9uW10gPSBbXTtcbiAgICBpbXBvcnRlZEV4cG9ydHMuZm9yRWFjaChcbiAgICAgICAgKGRlY2wsIG5hbWUpID0+IHJlZXhwb3J0cy5wdXNoKHtuYW1lLCBkZWNsYXJhdGlvbjogey4uLmRlY2wsIHZpYU1vZHVsZX19KSk7XG4gICAgcmV0dXJuIHJlZXhwb3J0cztcbiAgfVxuXG4gIHByaXZhdGUgZXh0cmFjdFVtZERlZmluZVByb3BlcnR5RXhwb3J0RGVjbGFyYXRpb24oc3RhdGVtZW50OiBEZWZpbmVQcm9wZXJ0eVJlZXhwb3J0U3RhdGVtZW50KTpcbiAgICAgIEV4cG9ydERlY2xhcmF0aW9ufG51bGwge1xuICAgIGNvbnN0IGFyZ3MgPSBzdGF0ZW1lbnQuZXhwcmVzc2lvbi5hcmd1bWVudHM7XG4gICAgY29uc3QgbmFtZSA9IGFyZ3NbMV0udGV4dDtcbiAgICBjb25zdCBnZXR0ZXJGbkV4cHJlc3Npb24gPSBleHRyYWN0R2V0dGVyRm5FeHByZXNzaW9uKHN0YXRlbWVudCk7XG4gICAgaWYgKGdldHRlckZuRXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSB0aGlzLmdldERlY2xhcmF0aW9uT2ZFeHByZXNzaW9uKGdldHRlckZuRXhwcmVzc2lvbik7XG4gICAgaWYgKGRlY2xhcmF0aW9uICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4ge25hbWUsIGRlY2xhcmF0aW9ufTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbmFtZSxcbiAgICAgIGRlY2xhcmF0aW9uOiB7XG4gICAgICAgIGtpbmQ6IERlY2xhcmF0aW9uS2luZC5JbmxpbmUsXG4gICAgICAgIG5vZGU6IGFyZ3NbMV0sXG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBnZXR0ZXJGbkV4cHJlc3Npb24sXG4gICAgICAgIGtub3duOiBudWxsLFxuICAgICAgICB2aWFNb2R1bGU6IG51bGwsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIGlkZW50aWZpZXIgYSBwYXJhbWV0ZXIgb24gYSBVTUQgZmFjdG9yeSBmdW5jdGlvbiwgZS5nLiBgZnVuY3Rpb24gZmFjdG9yeSh0aGlzLCBjb3JlKWA/XG4gICAqIElmIHNvIHRoZW4gcmV0dXJuIGl0cyBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgZmluZFVtZEltcG9ydFBhcmFtZXRlcihpZDogdHMuSWRlbnRpZmllcik6IHRzLlBhcmFtZXRlckRlY2xhcmF0aW9ufG51bGwge1xuICAgIGNvbnN0IHN5bWJvbCA9IGlkICYmIHRoaXMuY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGlkKSB8fCBudWxsO1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gc3ltYm9sICYmIHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uO1xuICAgIHJldHVybiBkZWNsYXJhdGlvbiAmJiB0cy5pc1BhcmFtZXRlcihkZWNsYXJhdGlvbikgPyBkZWNsYXJhdGlvbiA6IG51bGw7XG4gIH1cblxuICBwcml2YXRlIGdldFVtZERlY2xhcmF0aW9uKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgY29uc3QgbnNJZGVudGlmaWVyID0gZmluZE5hbWVzcGFjZU9mSWRlbnRpZmllcihpZCk7XG4gICAgaWYgKG5zSWRlbnRpZmllciA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKG5zSWRlbnRpZmllci5wYXJlbnQucGFyZW50ICYmIGlzRXhwb3J0c0Fzc2lnbm1lbnQobnNJZGVudGlmaWVyLnBhcmVudC5wYXJlbnQpKSB7XG4gICAgICBjb25zdCBpbml0aWFsaXplciA9IG5zSWRlbnRpZmllci5wYXJlbnQucGFyZW50LnJpZ2h0O1xuICAgICAgaWYgKHRzLmlzSWRlbnRpZmllcihpbml0aWFsaXplcikpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIoaW5pdGlhbGl6ZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZGV0ZWN0S25vd25EZWNsYXJhdGlvbih7XG4gICAgICAgIGtpbmQ6IERlY2xhcmF0aW9uS2luZC5JbmxpbmUsXG4gICAgICAgIG5vZGU6IG5zSWRlbnRpZmllci5wYXJlbnQucGFyZW50LmxlZnQsXG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBza2lwQWxpYXNlcyhuc0lkZW50aWZpZXIucGFyZW50LnBhcmVudC5yaWdodCksXG4gICAgICAgIHZpYU1vZHVsZTogbnVsbCxcbiAgICAgICAga25vd246IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBtb2R1bGVEZWNsYXJhdGlvbiA9IHRoaXMuZ2V0VW1kTW9kdWxlRGVjbGFyYXRpb24obnNJZGVudGlmaWVyKTtcbiAgICBpZiAobW9kdWxlRGVjbGFyYXRpb24gPT09IG51bGwgfHwgbW9kdWxlRGVjbGFyYXRpb24ubm9kZSA9PT0gbnVsbCB8fFxuICAgICAgICAhdHMuaXNTb3VyY2VGaWxlKG1vZHVsZURlY2xhcmF0aW9uLm5vZGUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBtb2R1bGVFeHBvcnRzID0gdGhpcy5nZXRFeHBvcnRzT2ZNb2R1bGUobW9kdWxlRGVjbGFyYXRpb24ubm9kZSk7XG4gICAgaWYgKG1vZHVsZUV4cG9ydHMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdlIG5lZWQgdG8gY29tcHV0ZSB0aGUgYHZpYU1vZHVsZWAgYmVjYXVzZSAgdGhlIGBnZXRFeHBvcnRzT2ZNb2R1bGUoKWAgY2FsbFxuICAgIC8vIGRpZCBub3Qga25vdyB0aGF0IHdlIHdlcmUgaW1wb3J0aW5nIHRoZSBkZWNsYXJhdGlvbi5cbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IG1vZHVsZUV4cG9ydHMuZ2V0KGlkLnRleHQpITtcblxuICAgIGlmICghbW9kdWxlRXhwb3J0cy5oYXMoaWQudGV4dCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdlIG5lZWQgdG8gY29tcHV0ZSB0aGUgYHZpYU1vZHVsZWAgYmVjYXVzZSAgdGhlIGBnZXRFeHBvcnRzT2ZNb2R1bGUoKWAgY2FsbFxuICAgIC8vIGRpZCBub3Qga25vdyB0aGF0IHdlIHdlcmUgaW1wb3J0aW5nIHRoZSBkZWNsYXJhdGlvbi5cbiAgICBjb25zdCB2aWFNb2R1bGUgPVxuICAgICAgICBkZWNsYXJhdGlvbi52aWFNb2R1bGUgPT09IG51bGwgPyBtb2R1bGVEZWNsYXJhdGlvbi52aWFNb2R1bGUgOiBkZWNsYXJhdGlvbi52aWFNb2R1bGU7XG5cbiAgICByZXR1cm4gey4uLmRlY2xhcmF0aW9uLCB2aWFNb2R1bGUsIGtub3duOiBnZXRUc0hlbHBlckZuRnJvbUlkZW50aWZpZXIoaWQpfTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RXhwb3J0c0RlY2xhcmF0aW9uKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgaWYgKCFpc0V4cG9ydHNJZGVudGlmaWVyKGlkKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gU2FkbHksIGluIHRoZSBjYXNlIG9mIGBleHBvcnRzLmZvbyA9IGJhcmAsIHdlIGNhbid0IHVzZSBgdGhpcy5maW5kVW1kSW1wb3J0UGFyYW1ldGVyKGlkKWBcbiAgICAvLyB0byBjaGVjayB3aGV0aGVyIHRoaXMgYGV4cG9ydHNgIGlzIGZyb20gdGhlIElJRkUgYm9keSBhcmd1bWVudHMsIGJlY2F1c2VcbiAgICAvLyBgdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oaWQpYCB3aWxsIHJldHVybiB0aGUgc3ltYm9sIGZvciB0aGUgYGZvb2AgaWRlbnRpZmllclxuICAgIC8vIHJhdGhlciB0aGFuIHRoZSBgZXhwb3J0c2AgaWRlbnRpZmllci5cbiAgICAvL1xuICAgIC8vIEluc3RlYWQgd2Ugc2VhcmNoIHRoZSBzeW1ib2xzIGluIHRoZSBjdXJyZW50IGxvY2FsIHNjb3BlLlxuICAgIGNvbnN0IGV4cG9ydHNTeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sc0luU2NvcGUoaWQsIHRzLlN5bWJvbEZsYWdzLlZhcmlhYmxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbmQoc3ltYm9sID0+IHN5bWJvbC5uYW1lID09PSAnZXhwb3J0cycpO1xuXG4gICAgY29uc3Qgbm9kZSA9IGV4cG9ydHNTeW1ib2w/LnZhbHVlRGVjbGFyYXRpb24gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGV4cG9ydHNTeW1ib2wudmFsdWVEZWNsYXJhdGlvbi5wYXJlbnQpID9cbiAgICAgICAgLy8gVGhlcmUgaXMgYSBsb2NhbGx5IGRlZmluZWQgYGV4cG9ydHNgIHZhcmlhYmxlIHRoYXQgaXMgbm90IGEgZnVuY3Rpb24gcGFyYW1ldGVyLlxuICAgICAgICAvLyBTbyB0aGlzIGBleHBvcnRzYCBpZGVudGlmaWVyIG11c3QgYmUgYSBsb2NhbCB2YXJpYWJsZSBhbmQgZG9lcyBub3QgcmVwcmVzZW50IHRoZSBtb2R1bGUuXG4gICAgICAgIGV4cG9ydHNTeW1ib2wudmFsdWVEZWNsYXJhdGlvbiA6XG4gICAgICAgIC8vIFRoZXJlIGlzIG5vIGxvY2FsIHN5bWJvbCBvciBpdCBpcyBhIHBhcmFtZXRlciBvZiBhbiBJSUZFLlxuICAgICAgICAvLyBTbyB0aGlzIGBleHBvcnRzYCByZXByZXNlbnRzIHRoZSBjdXJyZW50IFwibW9kdWxlXCIuXG4gICAgICAgIGlkLmdldFNvdXJjZUZpbGUoKTtcblxuICAgIHJldHVybiB7XG4gICAgICBraW5kOiBEZWNsYXJhdGlvbktpbmQuQ29uY3JldGUsXG4gICAgICBub2RlLFxuICAgICAgdmlhTW9kdWxlOiBudWxsLFxuICAgICAga25vd246IG51bGwsXG4gICAgICBpZGVudGl0eTogbnVsbCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRVbWRNb2R1bGVEZWNsYXJhdGlvbihpZDogdHMuSWRlbnRpZmllcik6IERlY2xhcmF0aW9ufG51bGwge1xuICAgIGNvbnN0IGltcG9ydFBhdGggPSB0aGlzLmdldEltcG9ydFBhdGhGcm9tUGFyYW1ldGVyKGlkKSB8fCB0aGlzLmdldEltcG9ydFBhdGhGcm9tUmVxdWlyZUNhbGwoaWQpO1xuICAgIGlmIChpbXBvcnRQYXRoID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBtb2R1bGUgPSB0aGlzLnJlc29sdmVNb2R1bGVOYW1lKGltcG9ydFBhdGgsIGlkLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgaWYgKG1vZHVsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB2aWFNb2R1bGUgPSBpc0V4dGVybmFsSW1wb3J0KGltcG9ydFBhdGgpID8gaW1wb3J0UGF0aCA6IG51bGw7XG4gICAgcmV0dXJuIHtraW5kOiBEZWNsYXJhdGlvbktpbmQuQ29uY3JldGUsIG5vZGU6IG1vZHVsZSwgdmlhTW9kdWxlLCBrbm93bjogbnVsbCwgaWRlbnRpdHk6IG51bGx9O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRJbXBvcnRQYXRoRnJvbVBhcmFtZXRlcihpZDogdHMuSWRlbnRpZmllcik6IHN0cmluZ3xudWxsIHtcbiAgICBjb25zdCBpbXBvcnRQYXJhbWV0ZXIgPSB0aGlzLmZpbmRVbWRJbXBvcnRQYXJhbWV0ZXIoaWQpO1xuICAgIGlmIChpbXBvcnRQYXJhbWV0ZXIgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5nZXRVbWRJbXBvcnRQYXRoKGltcG9ydFBhcmFtZXRlcik7XG4gIH1cblxuICBwcml2YXRlIGdldEltcG9ydFBhdGhGcm9tUmVxdWlyZUNhbGwoaWQ6IHRzLklkZW50aWZpZXIpOiBzdHJpbmd8bnVsbCB7XG4gICAgY29uc3QgcmVxdWlyZUNhbGwgPSBmaW5kUmVxdWlyZUNhbGxSZWZlcmVuY2UoaWQsIHRoaXMuY2hlY2tlcik7XG4gICAgaWYgKHJlcXVpcmVDYWxsID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHJlcXVpcmVDYWxsLmFyZ3VtZW50c1swXS50ZXh0O1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoaXMgaXMgYW4gSUlGRSB0aGVuIHRyeSB0byBncmFiIHRoZSBvdXRlciBhbmQgaW5uZXIgY2xhc3NlcyBvdGhlcndpc2UgZmFsbGJhY2sgb24gdGhlIHN1cGVyXG4gICAqIGNsYXNzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldERlY2xhcmF0aW9uT2ZFeHByZXNzaW9uKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiBEZWNsYXJhdGlvbnxudWxsIHtcbiAgICBjb25zdCBpbm5lciA9IGdldElubmVyQ2xhc3NEZWNsYXJhdGlvbihleHByZXNzaW9uKTtcbiAgICBpZiAoaW5uZXIgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IG91dGVyID0gZ2V0T3V0ZXJOb2RlRnJvbUlubmVyRGVjbGFyYXRpb24oaW5uZXIpO1xuICAgICAgaWYgKG91dGVyICE9PSBudWxsICYmIGlzRXhwb3J0c0Fzc2lnbm1lbnQob3V0ZXIpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAga2luZDogRGVjbGFyYXRpb25LaW5kLklubGluZSxcbiAgICAgICAgICBub2RlOiBvdXRlci5sZWZ0LFxuICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBpbm5lcixcbiAgICAgICAgICBrbm93bjogbnVsbCxcbiAgICAgICAgICB2aWFNb2R1bGU6IG51bGwsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdXBlci5nZXREZWNsYXJhdGlvbk9mRXhwcmVzc2lvbihleHByZXNzaW9uKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzb2x2ZU1vZHVsZU5hbWUobW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGVcbiAgICAgIHx1bmRlZmluZWQge1xuICAgIGlmICh0aGlzLmNvbXBpbGVySG9zdC5yZXNvbHZlTW9kdWxlTmFtZXMpIHtcbiAgICAgIGNvbnN0IG1vZHVsZUluZm8gPSB0aGlzLmNvbXBpbGVySG9zdC5yZXNvbHZlTW9kdWxlTmFtZXMoXG4gICAgICAgICAgW21vZHVsZU5hbWVdLCBjb250YWluaW5nRmlsZS5maWxlTmFtZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG4gICAgICAgICAgdGhpcy5wcm9ncmFtLmdldENvbXBpbGVyT3B0aW9ucygpKVswXTtcbiAgICAgIHJldHVybiBtb2R1bGVJbmZvICYmIHRoaXMucHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGFic29sdXRlRnJvbShtb2R1bGVJbmZvLnJlc29sdmVkRmlsZU5hbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbW9kdWxlSW5mbyA9IHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICAgIG1vZHVsZU5hbWUsIGNvbnRhaW5pbmdGaWxlLmZpbGVOYW1lLCB0aGlzLnByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCksXG4gICAgICAgICAgdGhpcy5jb21waWxlckhvc3QpO1xuICAgICAgcmV0dXJuIG1vZHVsZUluZm8ucmVzb2x2ZWRNb2R1bGUgJiZcbiAgICAgICAgICB0aGlzLnByb2dyYW0uZ2V0U291cmNlRmlsZShhYnNvbHV0ZUZyb20obW9kdWxlSW5mby5yZXNvbHZlZE1vZHVsZS5yZXNvbHZlZEZpbGVOYW1lKSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVN0YXRlbWVudEZvclVtZE1vZHVsZShzdGF0ZW1lbnQ6IHRzLlN0YXRlbWVudCk6IFVtZE1vZHVsZXxudWxsIHtcbiAgY29uc3Qgd3JhcHBlckNhbGwgPSBnZXRVbWRXcmFwcGVyQ2FsbChzdGF0ZW1lbnQpO1xuICBpZiAoIXdyYXBwZXJDYWxsKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCB3cmFwcGVyRm4gPSB3cmFwcGVyQ2FsbC5leHByZXNzaW9uO1xuICBpZiAoIXRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKHdyYXBwZXJGbikpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IGZhY3RvcnlGblBhcmFtSW5kZXggPSB3cmFwcGVyRm4ucGFyYW1ldGVycy5maW5kSW5kZXgoXG4gICAgICBwYXJhbWV0ZXIgPT4gdHMuaXNJZGVudGlmaWVyKHBhcmFtZXRlci5uYW1lKSAmJiBwYXJhbWV0ZXIubmFtZS50ZXh0ID09PSAnZmFjdG9yeScpO1xuICBpZiAoZmFjdG9yeUZuUGFyYW1JbmRleCA9PT0gLTEpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IGZhY3RvcnlGbiA9IHN0cmlwUGFyZW50aGVzZXMod3JhcHBlckNhbGwuYXJndW1lbnRzW2ZhY3RvcnlGblBhcmFtSW5kZXhdKTtcbiAgaWYgKCFmYWN0b3J5Rm4gfHwgIXRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGZhY3RvcnlGbikpIHJldHVybiBudWxsO1xuXG4gIHJldHVybiB7d3JhcHBlckZuLCBmYWN0b3J5Rm59O1xufVxuXG5mdW5jdGlvbiBnZXRVbWRXcmFwcGVyQ2FsbChzdGF0ZW1lbnQ6IHRzLlN0YXRlbWVudCk6IHRzLkNhbGxFeHByZXNzaW9uJlxuICAgIHtleHByZXNzaW9uOiB0cy5GdW5jdGlvbkV4cHJlc3Npb259fG51bGwge1xuICBpZiAoIXRzLmlzRXhwcmVzc2lvblN0YXRlbWVudChzdGF0ZW1lbnQpIHx8ICF0cy5pc1BhcmVudGhlc2l6ZWRFeHByZXNzaW9uKHN0YXRlbWVudC5leHByZXNzaW9uKSB8fFxuICAgICAgIXRzLmlzQ2FsbEV4cHJlc3Npb24oc3RhdGVtZW50LmV4cHJlc3Npb24uZXhwcmVzc2lvbikgfHxcbiAgICAgICF0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihzdGF0ZW1lbnQuZXhwcmVzc2lvbi5leHByZXNzaW9uLmV4cHJlc3Npb24pKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIHN0YXRlbWVudC5leHByZXNzaW9uLmV4cHJlc3Npb24gYXMgdHMuQ2FsbEV4cHJlc3Npb24gJiB7ZXhwcmVzc2lvbjogdHMuRnVuY3Rpb25FeHByZXNzaW9ufTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW1wb3J0c09mVW1kTW9kdWxlKHVtZE1vZHVsZTogVW1kTW9kdWxlKTpcbiAgICB7cGFyYW1ldGVyOiB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbiwgcGF0aDogc3RyaW5nfVtdIHtcbiAgY29uc3QgaW1wb3J0czoge3BhcmFtZXRlcjogdHMuUGFyYW1ldGVyRGVjbGFyYXRpb24sIHBhdGg6IHN0cmluZ31bXSA9IFtdO1xuICBmb3IgKGxldCBpID0gMTsgaSA8IHVtZE1vZHVsZS5mYWN0b3J5Rm4ucGFyYW1ldGVycy5sZW5ndGg7IGkrKykge1xuICAgIGltcG9ydHMucHVzaCh7XG4gICAgICBwYXJhbWV0ZXI6IHVtZE1vZHVsZS5mYWN0b3J5Rm4ucGFyYW1ldGVyc1tpXSxcbiAgICAgIHBhdGg6IGdldFJlcXVpcmVkTW9kdWxlUGF0aCh1bWRNb2R1bGUud3JhcHBlckZuLCBpKVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBpbXBvcnRzO1xufVxuXG5pbnRlcmZhY2UgVW1kTW9kdWxlIHtcbiAgd3JhcHBlckZuOiB0cy5GdW5jdGlvbkV4cHJlc3Npb247XG4gIGZhY3RvcnlGbjogdHMuRnVuY3Rpb25FeHByZXNzaW9uO1xufVxuXG5mdW5jdGlvbiBnZXRSZXF1aXJlZE1vZHVsZVBhdGgod3JhcHBlckZuOiB0cy5GdW5jdGlvbkV4cHJlc3Npb24sIHBhcmFtSW5kZXg6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHN0YXRlbWVudCA9IHdyYXBwZXJGbi5ib2R5LnN0YXRlbWVudHNbMF07XG4gIGlmICghdHMuaXNFeHByZXNzaW9uU3RhdGVtZW50KHN0YXRlbWVudCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdVTUQgd3JhcHBlciBib2R5IGlzIG5vdCBhbiBleHByZXNzaW9uIHN0YXRlbWVudDpcXG4nICsgd3JhcHBlckZuLmJvZHkuZ2V0VGV4dCgpKTtcbiAgfVxuICBjb25zdCBtb2R1bGVQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgZmluZE1vZHVsZVBhdGhzKHN0YXRlbWVudC5leHByZXNzaW9uKTtcblxuICAvLyBTaW5jZSB3ZSB3ZXJlIG9ubHkgaW50ZXJlc3RlZCBpbiB0aGUgYHJlcXVpcmUoKWAgY2FsbHMsIHdlIG1pc3MgdGhlIGBleHBvcnRzYCBhcmd1bWVudCwgc28gd2VcbiAgLy8gbmVlZCB0byBzdWJ0cmFjdCAxLlxuICAvLyBFLmcuIGBmdW5jdGlvbihleHBvcnRzLCBkZXAxLCBkZXAyKWAgbWFwcyB0byBgZnVuY3Rpb24oZXhwb3J0cywgcmVxdWlyZSgncGF0aC90by9kZXAxJyksXG4gIC8vIHJlcXVpcmUoJ3BhdGgvdG8vZGVwMicpKWBcbiAgcmV0dXJuIG1vZHVsZVBhdGhzW3BhcmFtSW5kZXggLSAxXTtcblxuICAvLyBTZWFyY2ggdGhlIHN0YXRlbWVudCBmb3IgY2FsbHMgdG8gYHJlcXVpcmUoJy4uLicpYCBhbmQgZXh0cmFjdCB0aGUgc3RyaW5nIHZhbHVlIG9mIHRoZSBmaXJzdFxuICAvLyBhcmd1bWVudFxuICBmdW5jdGlvbiBmaW5kTW9kdWxlUGF0aHMobm9kZTogdHMuTm9kZSkge1xuICAgIGlmIChpc1JlcXVpcmVDYWxsKG5vZGUpKSB7XG4gICAgICBjb25zdCBhcmd1bWVudCA9IG5vZGUuYXJndW1lbnRzWzBdO1xuICAgICAgaWYgKHRzLmlzU3RyaW5nTGl0ZXJhbChhcmd1bWVudCkpIHtcbiAgICAgICAgbW9kdWxlUGF0aHMucHVzaChhcmd1bWVudC50ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZS5mb3JFYWNoQ2hpbGQoZmluZE1vZHVsZVBhdGhzKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJcyB0aGUgYG5vZGVgIGFuIGlkZW50aWZpZXIgd2l0aCB0aGUgbmFtZSBcImV4cG9ydHNcIj9cbiAqL1xuZnVuY3Rpb24gaXNFeHBvcnRzSWRlbnRpZmllcihub2RlOiB0cy5Ob2RlKTogbm9kZSBpcyB0cy5JZGVudGlmaWVyIHtcbiAgcmV0dXJuIHRzLmlzSWRlbnRpZmllcihub2RlKSAmJiBub2RlLnRleHQgPT09ICdleHBvcnRzJztcbn1cbiJdfQ==