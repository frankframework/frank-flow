/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { absoluteFrom } from '../../../src/ngtsc/file_system';
import { FactoryMap, isDefined } from '../utils';
import { extractGetterFnExpression, findNamespaceOfIdentifier, findRequireCallReference, isDefinePropertyReexportStatement, isExportsAssignment, isExportsStatement, isExternalImport, isRequireCall, isWildcardReexportStatement, skipAliases } from './commonjs_umd_utils';
import { getInnerClassDeclaration, getOuterNodeFromInnerDeclaration } from './esm2015_host';
import { Esm5ReflectionHost } from './esm5_host';
export class CommonJsReflectionHost extends Esm5ReflectionHost {
    constructor(logger, isCore, src, dts = null) {
        super(logger, isCore, src, dts);
        this.commonJsExports = new FactoryMap(sf => this.computeExportsOfCommonJsModule(sf));
        this.topLevelHelperCalls = new FactoryMap(helperName => new FactoryMap(sf => sf.statements.map(stmt => this.getHelperCall(stmt, [helperName]))
            .filter(isDefined)));
        this.program = src.program;
        this.compilerHost = src.host;
    }
    getImportOfIdentifier(id) {
        const requireCall = this.findCommonJsImport(id);
        if (requireCall === null) {
            return null;
        }
        return { from: requireCall.arguments[0].text, name: id.text };
    }
    getDeclarationOfIdentifier(id) {
        return this.getCommonJsModuleDeclaration(id) || super.getDeclarationOfIdentifier(id);
    }
    getExportsOfModule(module) {
        return super.getExportsOfModule(module) || this.commonJsExports.get(module.getSourceFile());
    }
    /**
     * Search statements related to the given class for calls to the specified helper.
     *
     * In CommonJS these helper calls can be outside the class's IIFE at the top level of the
     * source file. Searching the top level statements for helpers can be expensive, so we
     * try to get helpers from the IIFE first and only fall back on searching the top level if
     * no helpers are found.
     *
     * @param classSymbol the class whose helper calls we are interested in.
     * @param helperNames the names of the helpers (e.g. `__decorate`) whose calls we are interested
     * in.
     * @returns an array of nodes of calls to the helper with the given name.
     */
    getHelperCallsForClass(classSymbol, helperNames) {
        const esm5HelperCalls = super.getHelperCallsForClass(classSymbol, helperNames);
        if (esm5HelperCalls.length > 0) {
            return esm5HelperCalls;
        }
        else {
            const sourceFile = classSymbol.declaration.valueDeclaration.getSourceFile();
            return this.getTopLevelHelperCalls(sourceFile, helperNames);
        }
    }
    /**
     * Find all the helper calls at the top level of a source file.
     *
     * We cache the helper calls per source file so that we don't have to keep parsing the code for
     * each class in a file.
     *
     * @param sourceFile the source who may contain helper calls.
     * @param helperNames the names of the helpers (e.g. `__decorate`) whose calls we are interested
     * in.
     * @returns an array of nodes of calls to the helper with the given name.
     */
    getTopLevelHelperCalls(sourceFile, helperNames) {
        const calls = [];
        helperNames.forEach(helperName => {
            const helperCallsMap = this.topLevelHelperCalls.get(helperName);
            calls.push(...helperCallsMap.get(sourceFile));
        });
        return calls;
    }
    computeExportsOfCommonJsModule(sourceFile) {
        const moduleMap = new Map();
        for (const statement of this.getModuleStatements(sourceFile)) {
            if (isExportsStatement(statement)) {
                const exportDeclaration = this.extractBasicCommonJsExportDeclaration(statement);
                moduleMap.set(exportDeclaration.name, exportDeclaration.declaration);
            }
            else if (isWildcardReexportStatement(statement)) {
                const reexports = this.extractCommonJsWildcardReexports(statement, sourceFile);
                for (const reexport of reexports) {
                    moduleMap.set(reexport.name, reexport.declaration);
                }
            }
            else if (isDefinePropertyReexportStatement(statement)) {
                const exportDeclaration = this.extractCommonJsDefinePropertyExportDeclaration(statement);
                if (exportDeclaration !== null) {
                    moduleMap.set(exportDeclaration.name, exportDeclaration.declaration);
                }
            }
        }
        return moduleMap;
    }
    extractBasicCommonJsExportDeclaration(statement) {
        var _a;
        const exportExpression = skipAliases(statement.expression.right);
        const node = statement.expression.left;
        const declaration = (_a = this.getDeclarationOfExpression(exportExpression)) !== null && _a !== void 0 ? _a : {
            kind: 1 /* Inline */,
            node,
            implementation: exportExpression,
            known: null,
            viaModule: null,
        };
        return { name: node.name.text, declaration };
    }
    extractCommonJsWildcardReexports(statement, containingFile) {
        const reexportArg = statement.expression.arguments[0];
        const requireCall = isRequireCall(reexportArg) ?
            reexportArg :
            ts.isIdentifier(reexportArg) ? findRequireCallReference(reexportArg, this.checker) : null;
        if (requireCall === null) {
            return [];
        }
        const importPath = requireCall.arguments[0].text;
        const importedFile = this.resolveModuleName(importPath, containingFile);
        if (importedFile === undefined) {
            return [];
        }
        const importedExports = this.getExportsOfModule(importedFile);
        if (importedExports === null) {
            return [];
        }
        const viaModule = isExternalImport(importPath) ? importPath : null;
        const reexports = [];
        importedExports.forEach((declaration, name) => {
            if (viaModule !== null && declaration.viaModule === null) {
                declaration = Object.assign(Object.assign({}, declaration), { viaModule });
            }
            reexports.push({ name, declaration });
        });
        return reexports;
    }
    extractCommonJsDefinePropertyExportDeclaration(statement) {
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
    findCommonJsImport(id) {
        // Is `id` a namespaced property access, e.g. `Directive` in `core.Directive`?
        // If so capture the symbol of the namespace, e.g. `core`.
        const nsIdentifier = findNamespaceOfIdentifier(id);
        return nsIdentifier && findRequireCallReference(nsIdentifier, this.checker);
    }
    /**
     * Handle the case where the identifier represents a reference to a whole CommonJS
     * module, i.e. the result of a call to `require(...)`.
     *
     * @param id the identifier whose declaration we are looking for.
     * @returns a declaration if `id` refers to a CommonJS module, or `null` otherwise.
     */
    getCommonJsModuleDeclaration(id) {
        const requireCall = findRequireCallReference(id, this.checker);
        if (requireCall === null) {
            return null;
        }
        const importPath = requireCall.arguments[0].text;
        const module = this.resolveModuleName(importPath, id.getSourceFile());
        if (module === undefined) {
            return null;
        }
        const viaModule = isExternalImport(importPath) ? importPath : null;
        return { node: module, known: null, viaModule, identity: null, kind: 0 /* Concrete */ };
    }
    /**
     * If this is an IFE then try to grab the outer and inner classes otherwise fallback on the super
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uanNfaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9ob3N0L2NvbW1vbmpzX2hvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBSTVELE9BQU8sRUFBQyxVQUFVLEVBQUUsU0FBUyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRS9DLE9BQU8sRUFBdUUseUJBQXlCLEVBQUUseUJBQXlCLEVBQUUsd0JBQXdCLEVBQUUsaUNBQWlDLEVBQUUsbUJBQW1CLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLDJCQUEyQixFQUFlLFdBQVcsRUFBNEIsTUFBTSxzQkFBc0IsQ0FBQztBQUN6WCxPQUFPLEVBQUMsd0JBQXdCLEVBQUUsZ0NBQWdDLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxRixPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFHL0MsTUFBTSxPQUFPLHNCQUF1QixTQUFRLGtCQUFrQjtJQVU1RCxZQUFZLE1BQWMsRUFBRSxNQUFlLEVBQUUsR0FBa0IsRUFBRSxNQUEwQixJQUFJO1FBQzdGLEtBQUssQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQVZ4QixvQkFBZSxHQUFHLElBQUksVUFBVSxDQUN0QyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLHdCQUFtQixHQUN6QixJQUFJLFVBQVUsQ0FDVixVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksVUFBVSxDQUN4QixFQUFFLENBQUMsRUFBRSxDQUFDLEVB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QyxVQUFrQixFQUFFLGNBQTZCO1FBRXpFLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRTtZQUN4QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUNuRCxDQUFDLFVBQVUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFDM0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUMsT0FBTyxVQUFVLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDNUY7YUFBTTtZQUNMLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FDbkMsVUFBVSxFQUFFLGNBQWMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxFQUN0RSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdkIsT0FBTyxVQUFVLENBQUMsY0FBYztnQkFDNUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1NBQzFGO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7TG9nZ2VyfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge0RlY2xhcmF0aW9uLCBEZWNsYXJhdGlvbktpbmQsIEltcG9ydH0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtCdW5kbGVQcm9ncmFtfSBmcm9tICcuLi9wYWNrYWdlcy9idW5kbGVfcHJvZ3JhbSc7XG5pbXBvcnQge0ZhY3RvcnlNYXAsIGlzRGVmaW5lZH0gZnJvbSAnLi4vdXRpbHMnO1xuXG5pbXBvcnQge0RlZmluZVByb3BlcnR5UmVleHBvcnRTdGF0ZW1lbnQsIEV4cG9ydERlY2xhcmF0aW9uLCBFeHBvcnRzU3RhdGVtZW50LCBleHRyYWN0R2V0dGVyRm5FeHByZXNzaW9uLCBmaW5kTmFtZXNwYWNlT2ZJZGVudGlmaWVyLCBmaW5kUmVxdWlyZUNhbGxSZWZlcmVuY2UsIGlzRGVmaW5lUHJvcGVydHlSZWV4cG9ydFN0YXRlbWVudCwgaXNFeHBvcnRzQXNzaWdubWVudCwgaXNFeHBvcnRzU3RhdGVtZW50LCBpc0V4dGVybmFsSW1wb3J0LCBpc1JlcXVpcmVDYWxsLCBpc1dpbGRjYXJkUmVleHBvcnRTdGF0ZW1lbnQsIFJlcXVpcmVDYWxsLCBza2lwQWxpYXNlcywgV2lsZGNhcmRSZWV4cG9ydFN0YXRlbWVudH0gZnJvbSAnLi9jb21tb25qc191bWRfdXRpbHMnO1xuaW1wb3J0IHtnZXRJbm5lckNsYXNzRGVjbGFyYXRpb24sIGdldE91dGVyTm9kZUZyb21Jbm5lckRlY2xhcmF0aW9ufSBmcm9tICcuL2VzbTIwMTVfaG9zdCc7XG5pbXBvcnQge0VzbTVSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi9lc201X2hvc3QnO1xuaW1wb3J0IHtOZ2NjQ2xhc3NTeW1ib2x9IGZyb20gJy4vbmdjY19ob3N0JztcblxuZXhwb3J0IGNsYXNzIENvbW1vbkpzUmVmbGVjdGlvbkhvc3QgZXh0ZW5kcyBFc201UmVmbGVjdGlvbkhvc3Qge1xuICBwcm90ZWN0ZWQgY29tbW9uSnNFeHBvcnRzID0gbmV3IEZhY3RvcnlNYXA8dHMuU291cmNlRmlsZSwgTWFwPHN0cmluZywgRGVjbGFyYXRpb24+fG51bGw+KFxuICAgICAgc2YgPT4gdGhpcy5jb21wdXRlRXhwb3J0c09mQ29tbW9uSnNNb2R1bGUoc2YpKTtcbiAgcHJvdGVjdGVkIHRvcExldmVsSGVscGVyQ2FsbHMgPVxuICAgICAgbmV3IEZhY3RvcnlNYXA8c3RyaW5nLCBGYWN0b3J5TWFwPHRzLlNvdXJjZUZpbGUsIHRzLkNhbGxFeHByZXNzaW9uW10+PihcbiAgICAgICAgICBoZWxwZXJOYW1lID0+IG5ldyBGYWN0b3J5TWFwPHRzLlNvdXJjZUZpbGUsIHRzLkNhbGxFeHByZXNzaW9uW10+KFxuICAgICAgICAgICAgICBzZiA9PiBzZi5zdGF0ZW1lbnRzLm1hcChzdG10ID0+IHRoaXMuZ2V0SGVscGVyQ2FsbChzdG10LCBbaGVscGVyTmFtZV0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihpc0RlZmluZWQpKSk7XG4gIHByb3RlY3RlZCBwcm9ncmFtOiB0cy5Qcm9ncmFtO1xuICBwcm90ZWN0ZWQgY29tcGlsZXJIb3N0OiB0cy5Db21waWxlckhvc3Q7XG4gIGNvbnN0cnVjdG9yKGxvZ2dlcjogTG9nZ2VyLCBpc0NvcmU6IGJvb2xlYW4sIHNyYzogQnVuZGxlUHJvZ3JhbSwgZHRzOiBCdW5kbGVQcm9ncmFtfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobG9nZ2VyLCBpc0NvcmUsIHNyYywgZHRzKTtcbiAgICB0aGlzLnByb2dyYW0gPSBzcmMucHJvZ3JhbTtcbiAgICB0aGlzLmNvbXBpbGVySG9zdCA9IHNyYy5ob3N0O1xuICB9XG5cbiAgZ2V0SW1wb3J0T2ZJZGVudGlmaWVyKGlkOiB0cy5JZGVudGlmaWVyKTogSW1wb3J0fG51bGwge1xuICAgIGNvbnN0IHJlcXVpcmVDYWxsID0gdGhpcy5maW5kQ29tbW9uSnNJbXBvcnQoaWQpO1xuICAgIGlmIChyZXF1aXJlQ2FsbCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7ZnJvbTogcmVxdWlyZUNhbGwuYXJndW1lbnRzWzBdLnRleHQsIG5hbWU6IGlkLnRleHR9O1xuICB9XG5cbiAgZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIoaWQ6IHRzLklkZW50aWZpZXIpOiBEZWNsYXJhdGlvbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb21tb25Kc01vZHVsZURlY2xhcmF0aW9uKGlkKSB8fCBzdXBlci5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihpZCk7XG4gIH1cblxuICBnZXRFeHBvcnRzT2ZNb2R1bGUobW9kdWxlOiB0cy5Ob2RlKTogTWFwPHN0cmluZywgRGVjbGFyYXRpb24+fG51bGwge1xuICAgIHJldHVybiBzdXBlci5nZXRFeHBvcnRzT2ZNb2R1bGUobW9kdWxlKSB8fCB0aGlzLmNvbW1vbkpzRXhwb3J0cy5nZXQobW9kdWxlLmdldFNvdXJjZUZpbGUoKSk7XG4gIH1cblxuICAvKipcbiAgICogU2VhcmNoIHN0YXRlbWVudHMgcmVsYXRlZCB0byB0aGUgZ2l2ZW4gY2xhc3MgZm9yIGNhbGxzIHRvIHRoZSBzcGVjaWZpZWQgaGVscGVyLlxuICAgKlxuICAgKiBJbiBDb21tb25KUyB0aGVzZSBoZWxwZXIgY2FsbHMgY2FuIGJlIG91dHNpZGUgdGhlIGNsYXNzJ3MgSUlGRSBhdCB0aGUgdG9wIGxldmVsIG9mIHRoZVxuICAgKiBzb3VyY2UgZmlsZS4gU2VhcmNoaW5nIHRoZSB0b3AgbGV2ZWwgc3RhdGVtZW50cyBmb3IgaGVscGVycyBjYW4gYmUgZXhwZW5zaXZlLCBzbyB3ZVxuICAgKiB0cnkgdG8gZ2V0IGhlbHBlcnMgZnJvbSB0aGUgSUlGRSBmaXJzdCBhbmQgb25seSBmYWxsIGJhY2sgb24gc2VhcmNoaW5nIHRoZSB0b3AgbGV2ZWwgaWZcbiAgICogbm8gaGVscGVycyBhcmUgZm91bmQuXG4gICAqXG4gICAqIEBwYXJhbSBjbGFzc1N5bWJvbCB0aGUgY2xhc3Mgd2hvc2UgaGVscGVyIGNhbGxzIHdlIGFyZSBpbnRlcmVzdGVkIGluLlxuICAgKiBAcGFyYW0gaGVscGVyTmFtZXMgdGhlIG5hbWVzIG9mIHRoZSBoZWxwZXJzIChlLmcuIGBfX2RlY29yYXRlYCkgd2hvc2UgY2FsbHMgd2UgYXJlIGludGVyZXN0ZWRcbiAgICogaW4uXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIG5vZGVzIG9mIGNhbGxzIHRvIHRoZSBoZWxwZXIgd2l0aCB0aGUgZ2l2ZW4gbmFtZS5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRIZWxwZXJDYWxsc0ZvckNsYXNzKGNsYXNzU3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2wsIGhlbHBlck5hbWVzOiBzdHJpbmdbXSk6XG4gICAgICB0cy5DYWxsRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCBlc201SGVscGVyQ2FsbHMgPSBzdXBlci5nZXRIZWxwZXJDYWxsc0ZvckNsYXNzKGNsYXNzU3ltYm9sLCBoZWxwZXJOYW1lcyk7XG4gICAgaWYgKGVzbTVIZWxwZXJDYWxscy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gZXNtNUhlbHBlckNhbGxzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gY2xhc3NTeW1ib2wuZGVjbGFyYXRpb24udmFsdWVEZWNsYXJhdGlvbi5nZXRTb3VyY2VGaWxlKCk7XG4gICAgICByZXR1cm4gdGhpcy5nZXRUb3BMZXZlbEhlbHBlckNhbGxzKHNvdXJjZUZpbGUsIGhlbHBlck5hbWVzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRmluZCBhbGwgdGhlIGhlbHBlciBjYWxscyBhdCB0aGUgdG9wIGxldmVsIG9mIGEgc291cmNlIGZpbGUuXG4gICAqXG4gICAqIFdlIGNhY2hlIHRoZSBoZWxwZXIgY2FsbHMgcGVyIHNvdXJjZSBmaWxlIHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSB0byBrZWVwIHBhcnNpbmcgdGhlIGNvZGUgZm9yXG4gICAqIGVhY2ggY2xhc3MgaW4gYSBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlRmlsZSB0aGUgc291cmNlIHdobyBtYXkgY29udGFpbiBoZWxwZXIgY2FsbHMuXG4gICAqIEBwYXJhbSBoZWxwZXJOYW1lcyB0aGUgbmFtZXMgb2YgdGhlIGhlbHBlcnMgKGUuZy4gYF9fZGVjb3JhdGVgKSB3aG9zZSBjYWxscyB3ZSBhcmUgaW50ZXJlc3RlZFxuICAgKiBpbi5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2Ygbm9kZXMgb2YgY2FsbHMgdG8gdGhlIGhlbHBlciB3aXRoIHRoZSBnaXZlbiBuYW1lLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRUb3BMZXZlbEhlbHBlckNhbGxzKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsIGhlbHBlck5hbWVzOiBzdHJpbmdbXSk6XG4gICAgICB0cy5DYWxsRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCBjYWxsczogdHMuQ2FsbEV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGhlbHBlck5hbWVzLmZvckVhY2goaGVscGVyTmFtZSA9PiB7XG4gICAgICBjb25zdCBoZWxwZXJDYWxsc01hcCA9IHRoaXMudG9wTGV2ZWxIZWxwZXJDYWxscy5nZXQoaGVscGVyTmFtZSk7XG4gICAgICBjYWxscy5wdXNoKC4uLmhlbHBlckNhbGxzTWFwLmdldChzb3VyY2VGaWxlKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNhbGxzO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21wdXRlRXhwb3J0c09mQ29tbW9uSnNNb2R1bGUoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IE1hcDxzdHJpbmcsIERlY2xhcmF0aW9uPiB7XG4gICAgY29uc3QgbW9kdWxlTWFwID0gbmV3IE1hcDxzdHJpbmcsIERlY2xhcmF0aW9uPigpO1xuICAgIGZvciAoY29uc3Qgc3RhdGVtZW50IG9mIHRoaXMuZ2V0TW9kdWxlU3RhdGVtZW50cyhzb3VyY2VGaWxlKSkge1xuICAgICAgaWYgKGlzRXhwb3J0c1N0YXRlbWVudChzdGF0ZW1lbnQpKSB7XG4gICAgICAgIGNvbnN0IGV4cG9ydERlY2xhcmF0aW9uID0gdGhpcy5leHRyYWN0QmFzaWNDb21tb25Kc0V4cG9ydERlY2xhcmF0aW9uKHN0YXRlbWVudCk7XG4gICAgICAgIG1vZHVsZU1hcC5zZXQoZXhwb3J0RGVjbGFyYXRpb24ubmFtZSwgZXhwb3J0RGVjbGFyYXRpb24uZGVjbGFyYXRpb24pO1xuICAgICAgfSBlbHNlIGlmIChpc1dpbGRjYXJkUmVleHBvcnRTdGF0ZW1lbnQoc3RhdGVtZW50KSkge1xuICAgICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLmV4dHJhY3RDb21tb25Kc1dpbGRjYXJkUmVleHBvcnRzKHN0YXRlbWVudCwgc291cmNlRmlsZSk7XG4gICAgICAgIGZvciAoY29uc3QgcmVleHBvcnQgb2YgcmVleHBvcnRzKSB7XG4gICAgICAgICAgbW9kdWxlTWFwLnNldChyZWV4cG9ydC5uYW1lLCByZWV4cG9ydC5kZWNsYXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaXNEZWZpbmVQcm9wZXJ0eVJlZXhwb3J0U3RhdGVtZW50KHN0YXRlbWVudCkpIHtcbiAgICAgICAgY29uc3QgZXhwb3J0RGVjbGFyYXRpb24gPSB0aGlzLmV4dHJhY3RDb21tb25Kc0RlZmluZVByb3BlcnR5RXhwb3J0RGVjbGFyYXRpb24oc3RhdGVtZW50KTtcbiAgICAgICAgaWYgKGV4cG9ydERlY2xhcmF0aW9uICE9PSBudWxsKSB7XG4gICAgICAgICAgbW9kdWxlTWFwLnNldChleHBvcnREZWNsYXJhdGlvbi5uYW1lLCBleHBvcnREZWNsYXJhdGlvbi5kZWNsYXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1vZHVsZU1hcDtcbiAgfVxuXG4gIHByaXZhdGUgZXh0cmFjdEJhc2ljQ29tbW9uSnNFeHBvcnREZWNsYXJhdGlvbihzdGF0ZW1lbnQ6IEV4cG9ydHNTdGF0ZW1lbnQpOiBFeHBvcnREZWNsYXJhdGlvbiB7XG4gICAgY29uc3QgZXhwb3J0RXhwcmVzc2lvbiA9IHNraXBBbGlhc2VzKHN0YXRlbWVudC5leHByZXNzaW9uLnJpZ2h0KTtcbiAgICBjb25zdCBub2RlID0gc3RhdGVtZW50LmV4cHJlc3Npb24ubGVmdDtcbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZkV4cHJlc3Npb24oZXhwb3J0RXhwcmVzc2lvbikgPz8ge1xuICAgICAga2luZDogRGVjbGFyYXRpb25LaW5kLklubGluZSxcbiAgICAgIG5vZGUsXG4gICAgICBpbXBsZW1lbnRhdGlvbjogZXhwb3J0RXhwcmVzc2lvbixcbiAgICAgIGtub3duOiBudWxsLFxuICAgICAgdmlhTW9kdWxlOiBudWxsLFxuICAgIH07XG4gICAgcmV0dXJuIHtuYW1lOiBub2RlLm5hbWUudGV4dCwgZGVjbGFyYXRpb259O1xuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0Q29tbW9uSnNXaWxkY2FyZFJlZXhwb3J0cyhcbiAgICAgIHN0YXRlbWVudDogV2lsZGNhcmRSZWV4cG9ydFN0YXRlbWVudCwgY29udGFpbmluZ0ZpbGU6IHRzLlNvdXJjZUZpbGUpOiBFeHBvcnREZWNsYXJhdGlvbltdIHtcbiAgICBjb25zdCByZWV4cG9ydEFyZyA9IHN0YXRlbWVudC5leHByZXNzaW9uLmFyZ3VtZW50c1swXTtcblxuICAgIGNvbnN0IHJlcXVpcmVDYWxsID0gaXNSZXF1aXJlQ2FsbChyZWV4cG9ydEFyZykgP1xuICAgICAgICByZWV4cG9ydEFyZyA6XG4gICAgICAgIHRzLmlzSWRlbnRpZmllcihyZWV4cG9ydEFyZykgPyBmaW5kUmVxdWlyZUNhbGxSZWZlcmVuY2UocmVleHBvcnRBcmcsIHRoaXMuY2hlY2tlcikgOiBudWxsO1xuICAgIGlmIChyZXF1aXJlQ2FsbCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IGltcG9ydFBhdGggPSByZXF1aXJlQ2FsbC5hcmd1bWVudHNbMF0udGV4dDtcbiAgICBjb25zdCBpbXBvcnRlZEZpbGUgPSB0aGlzLnJlc29sdmVNb2R1bGVOYW1lKGltcG9ydFBhdGgsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICBpZiAoaW1wb3J0ZWRGaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBvcnRlZEV4cG9ydHMgPSB0aGlzLmdldEV4cG9ydHNPZk1vZHVsZShpbXBvcnRlZEZpbGUpO1xuICAgIGlmIChpbXBvcnRlZEV4cG9ydHMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCB2aWFNb2R1bGUgPSBpc0V4dGVybmFsSW1wb3J0KGltcG9ydFBhdGgpID8gaW1wb3J0UGF0aCA6IG51bGw7XG4gICAgY29uc3QgcmVleHBvcnRzOiBFeHBvcnREZWNsYXJhdGlvbltdID0gW107XG4gICAgaW1wb3J0ZWRFeHBvcnRzLmZvckVhY2goKGRlY2xhcmF0aW9uLCBuYW1lKSA9PiB7XG4gICAgICBpZiAodmlhTW9kdWxlICE9PSBudWxsICYmIGRlY2xhcmF0aW9uLnZpYU1vZHVsZSA9PT0gbnVsbCkge1xuICAgICAgICBkZWNsYXJhdGlvbiA9IHsuLi5kZWNsYXJhdGlvbiwgdmlhTW9kdWxlfTtcbiAgICAgIH1cbiAgICAgIHJlZXhwb3J0cy5wdXNoKHtuYW1lLCBkZWNsYXJhdGlvbn0pO1xuICAgIH0pO1xuICAgIHJldHVybiByZWV4cG9ydHM7XG4gIH1cblxuICBwcml2YXRlIGV4dHJhY3RDb21tb25Kc0RlZmluZVByb3BlcnR5RXhwb3J0RGVjbGFyYXRpb24oXG4gICAgICBzdGF0ZW1lbnQ6IERlZmluZVByb3BlcnR5UmVleHBvcnRTdGF0ZW1lbnQpOiBFeHBvcnREZWNsYXJhdGlvbnxudWxsIHtcbiAgICBjb25zdCBhcmdzID0gc3RhdGVtZW50LmV4cHJlc3Npb24uYXJndW1lbnRzO1xuICAgIGNvbnN0IG5hbWUgPSBhcmdzWzFdLnRleHQ7XG4gICAgY29uc3QgZ2V0dGVyRm5FeHByZXNzaW9uID0gZXh0cmFjdEdldHRlckZuRXhwcmVzc2lvbihzdGF0ZW1lbnQpO1xuICAgIGlmIChnZXR0ZXJGbkV4cHJlc3Npb24gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdGhpcy5nZXREZWNsYXJhdGlvbk9mRXhwcmVzc2lvbihnZXR0ZXJGbkV4cHJlc3Npb24pO1xuICAgIGlmIChkZWNsYXJhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHtuYW1lLCBkZWNsYXJhdGlvbn07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWUsXG4gICAgICBkZWNsYXJhdGlvbjoge1xuICAgICAgICBraW5kOiBEZWNsYXJhdGlvbktpbmQuSW5saW5lLFxuICAgICAgICBub2RlOiBhcmdzWzFdLFxuICAgICAgICBpbXBsZW1lbnRhdGlvbjogZ2V0dGVyRm5FeHByZXNzaW9uLFxuICAgICAgICBrbm93bjogbnVsbCxcbiAgICAgICAgdmlhTW9kdWxlOiBudWxsLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kQ29tbW9uSnNJbXBvcnQoaWQ6IHRzLklkZW50aWZpZXIpOiBSZXF1aXJlQ2FsbHxudWxsIHtcbiAgICAvLyBJcyBgaWRgIGEgbmFtZXNwYWNlZCBwcm9wZXJ0eSBhY2Nlc3MsIGUuZy4gYERpcmVjdGl2ZWAgaW4gYGNvcmUuRGlyZWN0aXZlYD9cbiAgICAvLyBJZiBzbyBjYXB0dXJlIHRoZSBzeW1ib2wgb2YgdGhlIG5hbWVzcGFjZSwgZS5nLiBgY29yZWAuXG4gICAgY29uc3QgbnNJZGVudGlmaWVyID0gZmluZE5hbWVzcGFjZU9mSWRlbnRpZmllcihpZCk7XG4gICAgcmV0dXJuIG5zSWRlbnRpZmllciAmJiBmaW5kUmVxdWlyZUNhbGxSZWZlcmVuY2UobnNJZGVudGlmaWVyLCB0aGlzLmNoZWNrZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSB0aGUgY2FzZSB3aGVyZSB0aGUgaWRlbnRpZmllciByZXByZXNlbnRzIGEgcmVmZXJlbmNlIHRvIGEgd2hvbGUgQ29tbW9uSlNcbiAgICogbW9kdWxlLCBpLmUuIHRoZSByZXN1bHQgb2YgYSBjYWxsIHRvIGByZXF1aXJlKC4uLilgLlxuICAgKlxuICAgKiBAcGFyYW0gaWQgdGhlIGlkZW50aWZpZXIgd2hvc2UgZGVjbGFyYXRpb24gd2UgYXJlIGxvb2tpbmcgZm9yLlxuICAgKiBAcmV0dXJucyBhIGRlY2xhcmF0aW9uIGlmIGBpZGAgcmVmZXJzIHRvIGEgQ29tbW9uSlMgbW9kdWxlLCBvciBgbnVsbGAgb3RoZXJ3aXNlLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRDb21tb25Kc01vZHVsZURlY2xhcmF0aW9uKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgY29uc3QgcmVxdWlyZUNhbGwgPSBmaW5kUmVxdWlyZUNhbGxSZWZlcmVuY2UoaWQsIHRoaXMuY2hlY2tlcik7XG4gICAgaWYgKHJlcXVpcmVDYWxsID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgaW1wb3J0UGF0aCA9IHJlcXVpcmVDYWxsLmFyZ3VtZW50c1swXS50ZXh0O1xuICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMucmVzb2x2ZU1vZHVsZU5hbWUoaW1wb3J0UGF0aCwgaWQuZ2V0U291cmNlRmlsZSgpKTtcbiAgICBpZiAobW9kdWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB2aWFNb2R1bGUgPSBpc0V4dGVybmFsSW1wb3J0KGltcG9ydFBhdGgpID8gaW1wb3J0UGF0aCA6IG51bGw7XG4gICAgcmV0dXJuIHtub2RlOiBtb2R1bGUsIGtub3duOiBudWxsLCB2aWFNb2R1bGUsIGlkZW50aXR5OiBudWxsLCBraW5kOiBEZWNsYXJhdGlvbktpbmQuQ29uY3JldGV9O1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoaXMgaXMgYW4gSUZFIHRoZW4gdHJ5IHRvIGdyYWIgdGhlIG91dGVyIGFuZCBpbm5lciBjbGFzc2VzIG90aGVyd2lzZSBmYWxsYmFjayBvbiB0aGUgc3VwZXJcbiAgICogY2xhc3MuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0RGVjbGFyYXRpb25PZkV4cHJlc3Npb24oZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IERlY2xhcmF0aW9ufG51bGwge1xuICAgIGNvbnN0IGlubmVyID0gZ2V0SW5uZXJDbGFzc0RlY2xhcmF0aW9uKGV4cHJlc3Npb24pO1xuICAgIGlmIChpbm5lciAhPT0gbnVsbCkge1xuICAgICAgY29uc3Qgb3V0ZXIgPSBnZXRPdXRlck5vZGVGcm9tSW5uZXJEZWNsYXJhdGlvbihpbm5lcik7XG4gICAgICBpZiAob3V0ZXIgIT09IG51bGwgJiYgaXNFeHBvcnRzQXNzaWdubWVudChvdXRlcikpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBraW5kOiBEZWNsYXJhdGlvbktpbmQuSW5saW5lLFxuICAgICAgICAgIG5vZGU6IG91dGVyLmxlZnQsXG4gICAgICAgICAgaW1wbGVtZW50YXRpb246IGlubmVyLFxuICAgICAgICAgIGtub3duOiBudWxsLFxuICAgICAgICAgIHZpYU1vZHVsZTogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLmdldERlY2xhcmF0aW9uT2ZFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNvbHZlTW9kdWxlTmFtZShtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlOiB0cy5Tb3VyY2VGaWxlKTogdHMuU291cmNlRmlsZVxuICAgICAgfHVuZGVmaW5lZCB7XG4gICAgaWYgKHRoaXMuY29tcGlsZXJIb3N0LnJlc29sdmVNb2R1bGVOYW1lcykge1xuICAgICAgY29uc3QgbW9kdWxlSW5mbyA9IHRoaXMuY29tcGlsZXJIb3N0LnJlc29sdmVNb2R1bGVOYW1lcyhcbiAgICAgICAgICBbbW9kdWxlTmFtZV0sIGNvbnRhaW5pbmdGaWxlLmZpbGVOYW1lLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcbiAgICAgICAgICB0aGlzLnByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkpWzBdO1xuICAgICAgcmV0dXJuIG1vZHVsZUluZm8gJiYgdGhpcy5wcm9ncmFtLmdldFNvdXJjZUZpbGUoYWJzb2x1dGVGcm9tKG1vZHVsZUluZm8ucmVzb2x2ZWRGaWxlTmFtZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBtb2R1bGVJbmZvID0gdHMucmVzb2x2ZU1vZHVsZU5hbWUoXG4gICAgICAgICAgbW9kdWxlTmFtZSwgY29udGFpbmluZ0ZpbGUuZmlsZU5hbWUsIHRoaXMucHJvZ3JhbS5nZXRDb21waWxlck9wdGlvbnMoKSxcbiAgICAgICAgICB0aGlzLmNvbXBpbGVySG9zdCk7XG4gICAgICByZXR1cm4gbW9kdWxlSW5mby5yZXNvbHZlZE1vZHVsZSAmJlxuICAgICAgICAgIHRoaXMucHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGFic29sdXRlRnJvbShtb2R1bGVJbmZvLnJlc29sdmVkTW9kdWxlLnJlc29sdmVkRmlsZU5hbWUpKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==