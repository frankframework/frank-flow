/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ExternalExpr } from '@angular/compiler';
import * as ts from 'typescript';
import { ErrorCode, makeDiagnostic, makeRelatedInformation } from '../../diagnostics';
import { identifierOfNode, nodeNameForError } from '../../util/src/typescript';
/**
 * A registry which collects information about NgModules, Directives, Components, and Pipes which
 * are local (declared in the ts.Program being compiled), and can produce `LocalModuleScope`s
 * which summarize the compilation scope of a component.
 *
 * This class implements the logic of NgModule declarations, imports, and exports and can produce,
 * for a given component, the set of directives and pipes which are "visible" in that component's
 * template.
 *
 * The `LocalModuleScopeRegistry` has two "modes" of operation. During analysis, data for each
 * individual NgModule, Directive, Component, and Pipe is added to the registry. No attempt is made
 * to traverse or validate the NgModule graph (imports, exports, etc). After analysis, one of
 * `getScopeOfModule` or `getScopeForComponent` can be called, which traverses the NgModule graph
 * and applies the NgModule logic to generate a `LocalModuleScope`, the full scope for the given
 * module or component.
 *
 * The `LocalModuleScopeRegistry` is also capable of producing `ts.Diagnostic` errors when Angular
 * semantics are violated.
 */
export class LocalModuleScopeRegistry {
    constructor(localReader, dependencyScopeReader, refEmitter, aliasingHost) {
        this.localReader = localReader;
        this.dependencyScopeReader = dependencyScopeReader;
        this.refEmitter = refEmitter;
        this.aliasingHost = aliasingHost;
        /**
         * Tracks whether the registry has been asked to produce scopes for a module or component. Once
         * this is true, the registry cannot accept registrations of new directives/pipes/modules as it
         * would invalidate the cached scope data.
         */
        this.sealed = false;
        /**
         * A map of components from the current compilation unit to the NgModule which declared them.
         *
         * As components and directives are not distinguished at the NgModule level, this map may also
         * contain directives. This doesn't cause any problems but isn't useful as there is no concept of
         * a directive's compilation scope.
         */
        this.declarationToModule = new Map();
        /**
         * This maps from the directive/pipe class to a map of data for each NgModule that declares the
         * directive/pipe. This data is needed to produce an error for the given class.
         */
        this.duplicateDeclarations = new Map();
        this.moduleToRef = new Map();
        /**
         * A cache of calculated `LocalModuleScope`s for each NgModule declared in the current program.
      
         */
        this.cache = new Map();
        /**
         * Tracks the `RemoteScope` for components requiring "remote scoping".
         *
         * Remote scoping is when the set of directives which apply to a given component is set in the
         * NgModule's file instead of directly on the component def (which is sometimes needed to get
         * around cyclic import issues). This is not used in calculation of `LocalModuleScope`s, but is
         * tracked here for convenience.
         */
        this.remoteScoping = new Map();
        /**
         * Tracks errors accumulated in the processing of scopes for each module declaration.
         */
        this.scopeErrors = new Map();
        /**
         * Tracks which NgModules have directives/pipes that are declared in more than one module.
         */
        this.modulesWithStructuralErrors = new Set();
    }
    /**
     * Add an NgModule's data to the registry.
     */
    registerNgModuleMetadata(data) {
        this.assertCollecting();
        const ngModule = data.ref.node;
        this.moduleToRef.set(data.ref.node, data.ref);
        // Iterate over the module's declarations, and add them to declarationToModule. If duplicates
        // are found, they're instead tracked in duplicateDeclarations.
        for (const decl of data.declarations) {
            this.registerDeclarationOfModule(ngModule, decl, data.rawDeclarations);
        }
    }
    registerDirectiveMetadata(directive) { }
    registerPipeMetadata(pipe) { }
    getScopeForComponent(clazz) {
        const scope = !this.declarationToModule.has(clazz) ?
            null :
            this.getScopeOfModule(this.declarationToModule.get(clazz).ngModule);
        return scope;
    }
    /**
     * If `node` is declared in more than one NgModule (duplicate declaration), then get the
     * `DeclarationData` for each offending declaration.
     *
     * Ordinarily a class is only declared in one NgModule, in which case this function returns
     * `null`.
     */
    getDuplicateDeclarations(node) {
        if (!this.duplicateDeclarations.has(node)) {
            return null;
        }
        return Array.from(this.duplicateDeclarations.get(node).values());
    }
    /**
     * Collects registered data for a module and its directives/pipes and convert it into a full
     * `LocalModuleScope`.
     *
     * This method implements the logic of NgModule imports and exports. It returns the
     * `LocalModuleScope` for the given NgModule if one can be produced, `null` if no scope was ever
     * defined, or the string `'error'` if the scope contained errors.
     */
    getScopeOfModule(clazz) {
        return this.moduleToRef.has(clazz) ?
            this.getScopeOfModuleReference(this.moduleToRef.get(clazz)) :
            null;
    }
    /**
     * Retrieves any `ts.Diagnostic`s produced during the calculation of the `LocalModuleScope` for
     * the given NgModule, or `null` if no errors were present.
     */
    getDiagnosticsOfModule(clazz) {
        // Required to ensure the errors are populated for the given class. If it has been processed
        // before, this will be a no-op due to the scope cache.
        this.getScopeOfModule(clazz);
        if (this.scopeErrors.has(clazz)) {
            return this.scopeErrors.get(clazz);
        }
        else {
            return null;
        }
    }
    registerDeclarationOfModule(ngModule, decl, rawDeclarations) {
        const declData = {
            ngModule,
            ref: decl,
            rawDeclarations,
        };
        // First, check for duplicate declarations of the same directive/pipe.
        if (this.duplicateDeclarations.has(decl.node)) {
            // This directive/pipe has already been identified as being duplicated. Add this module to the
            // map of modules for which a duplicate declaration exists.
            this.duplicateDeclarations.get(decl.node).set(ngModule, declData);
        }
        else if (this.declarationToModule.has(decl.node) &&
            this.declarationToModule.get(decl.node).ngModule !== ngModule) {
            // This directive/pipe is already registered as declared in another module. Mark it as a
            // duplicate instead.
            const duplicateDeclMap = new Map();
            const firstDeclData = this.declarationToModule.get(decl.node);
            // Mark both modules as having duplicate declarations.
            this.modulesWithStructuralErrors.add(firstDeclData.ngModule);
            this.modulesWithStructuralErrors.add(ngModule);
            // Being detected as a duplicate means there are two NgModules (for now) which declare this
            // directive/pipe. Add both of them to the duplicate tracking map.
            duplicateDeclMap.set(firstDeclData.ngModule, firstDeclData);
            duplicateDeclMap.set(ngModule, declData);
            this.duplicateDeclarations.set(decl.node, duplicateDeclMap);
            // Remove the directive/pipe from `declarationToModule` as it's a duplicate declaration, and
            // therefore not valid.
            this.declarationToModule.delete(decl.node);
        }
        else {
            // This is the first declaration of this directive/pipe, so map it.
            this.declarationToModule.set(decl.node, declData);
        }
    }
    /**
     * Implementation of `getScopeOfModule` which accepts a reference to a class.
     */
    getScopeOfModuleReference(ref) {
        if (this.cache.has(ref.node)) {
            return this.cache.get(ref.node);
        }
        // Seal the registry to protect the integrity of the `LocalModuleScope` cache.
        this.sealed = true;
        // `ref` should be an NgModule previously added to the registry. If not, a scope for it
        // cannot be produced.
        const ngModule = this.localReader.getNgModuleMetadata(ref);
        if (ngModule === null) {
            this.cache.set(ref.node, null);
            return null;
        }
        // Modules which contributed to the compilation scope of this module.
        const compilationModules = new Set([ngModule.ref.node]);
        // Modules which contributed to the export scope of this module.
        const exportedModules = new Set([ngModule.ref.node]);
        // Errors produced during computation of the scope are recorded here. At the end, if this array
        // isn't empty then `undefined` will be cached and returned to indicate this scope is invalid.
        const diagnostics = [];
        // At this point, the goal is to produce two distinct transitive sets:
        // - the directives and pipes which are visible to components declared in the NgModule.
        // - the directives and pipes which are exported to any NgModules which import this one.
        // Directives and pipes in the compilation scope.
        const compilationDirectives = new Map();
        const compilationPipes = new Map();
        const declared = new Set();
        // Directives and pipes exported to any importing NgModules.
        const exportDirectives = new Map();
        const exportPipes = new Map();
        // The algorithm is as follows:
        // 1) Add all of the directives/pipes from each NgModule imported into the current one to the
        //    compilation scope.
        // 2) Add directives/pipes declared in the NgModule to the compilation scope. At this point, the
        //    compilation scope is complete.
        // 3) For each entry in the NgModule's exports:
        //    a) Attempt to resolve it as an NgModule with its own exported directives/pipes. If it is
        //       one, add them to the export scope of this NgModule.
        //    b) Otherwise, it should be a class in the compilation scope of this NgModule. If it is,
        //       add it to the export scope.
        //    c) If it's neither an NgModule nor a directive/pipe in the compilation scope, then this
        //       is an error.
        //
        let isPoisoned = false;
        if (this.modulesWithStructuralErrors.has(ngModule.ref.node)) {
            // If the module contains declarations that are duplicates, then it's considered poisoned.
            isPoisoned = true;
        }
        // 1) process imports.
        for (const decl of ngModule.imports) {
            const importScope = this.getExportedScope(decl, diagnostics, ref.node, 'import');
            if (importScope === null) {
                // An import wasn't an NgModule, so record an error.
                diagnostics.push(invalidRef(ref.node, decl, 'import'));
                isPoisoned = true;
                continue;
            }
            else if (importScope === 'invalid' || importScope.exported.isPoisoned) {
                // An import was an NgModule but contained errors of its own. Record this as an error too,
                // because this scope is always going to be incorrect if one of its imports could not be
                // read.
                diagnostics.push(invalidTransitiveNgModuleRef(ref.node, decl, 'import'));
                isPoisoned = true;
                if (importScope === 'invalid') {
                    continue;
                }
            }
            for (const directive of importScope.exported.directives) {
                compilationDirectives.set(directive.ref.node, directive);
            }
            for (const pipe of importScope.exported.pipes) {
                compilationPipes.set(pipe.ref.node, pipe);
            }
            for (const importedModule of importScope.exported.ngModules) {
                compilationModules.add(importedModule);
            }
        }
        // 2) add declarations.
        for (const decl of ngModule.declarations) {
            const directive = this.localReader.getDirectiveMetadata(decl);
            const pipe = this.localReader.getPipeMetadata(decl);
            if (directive !== null) {
                compilationDirectives.set(decl.node, Object.assign(Object.assign({}, directive), { ref: decl }));
                if (directive.isPoisoned) {
                    isPoisoned = true;
                }
            }
            else if (pipe !== null) {
                compilationPipes.set(decl.node, Object.assign(Object.assign({}, pipe), { ref: decl }));
            }
            else {
                const errorNode = decl.getOriginForDiagnostics(ngModule.rawDeclarations);
                diagnostics.push(makeDiagnostic(ErrorCode.NGMODULE_INVALID_DECLARATION, errorNode, `The class '${decl.node.name.text}' is listed in the declarations ` +
                    `of the NgModule '${ngModule.ref.node.name
                        .text}', but is not a directive, a component, or a pipe. ` +
                    `Either remove it from the NgModule's declarations, or add an appropriate Angular decorator.`, [makeRelatedInformation(decl.node.name, `'${decl.node.name.text}' is declared here.`)]));
                isPoisoned = true;
                continue;
            }
            declared.add(decl.node);
        }
        // 3) process exports.
        // Exports can contain modules, components, or directives. They're processed differently.
        // Modules are straightforward. Directives and pipes from exported modules are added to the
        // export maps. Directives/pipes are different - they might be exports of declared types or
        // imported types.
        for (const decl of ngModule.exports) {
            // Attempt to resolve decl as an NgModule.
            const exportScope = this.getExportedScope(decl, diagnostics, ref.node, 'export');
            if (exportScope === 'invalid' || (exportScope !== null && exportScope.exported.isPoisoned)) {
                // An export was an NgModule but contained errors of its own. Record this as an error too,
                // because this scope is always going to be incorrect if one of its exports could not be
                // read.
                diagnostics.push(invalidTransitiveNgModuleRef(ref.node, decl, 'export'));
                isPoisoned = true;
                if (exportScope === 'invalid') {
                    continue;
                }
            }
            else if (exportScope !== null) {
                // decl is an NgModule.
                for (const directive of exportScope.exported.directives) {
                    exportDirectives.set(directive.ref.node, directive);
                }
                for (const pipe of exportScope.exported.pipes) {
                    exportPipes.set(pipe.ref.node, pipe);
                }
                for (const exportedModule of exportScope.exported.ngModules) {
                    exportedModules.add(exportedModule);
                }
            }
            else if (compilationDirectives.has(decl.node)) {
                // decl is a directive or component in the compilation scope of this NgModule.
                const directive = compilationDirectives.get(decl.node);
                exportDirectives.set(decl.node, directive);
            }
            else if (compilationPipes.has(decl.node)) {
                // decl is a pipe in the compilation scope of this NgModule.
                const pipe = compilationPipes.get(decl.node);
                exportPipes.set(decl.node, pipe);
            }
            else {
                // decl is an unknown export.
                if (this.localReader.getDirectiveMetadata(decl) !== null ||
                    this.localReader.getPipeMetadata(decl) !== null) {
                    diagnostics.push(invalidReexport(ref.node, decl));
                }
                else {
                    diagnostics.push(invalidRef(ref.node, decl, 'export'));
                }
                isPoisoned = true;
                continue;
            }
        }
        const exported = {
            directives: Array.from(exportDirectives.values()),
            pipes: Array.from(exportPipes.values()),
            ngModules: Array.from(exportedModules),
            isPoisoned,
        };
        const reexports = this.getReexports(ngModule, ref, declared, exported, diagnostics);
        // Finally, produce the `LocalModuleScope` with both the compilation and export scopes.
        const scope = {
            ngModule: ngModule.ref.node,
            compilation: {
                directives: Array.from(compilationDirectives.values()),
                pipes: Array.from(compilationPipes.values()),
                ngModules: Array.from(compilationModules),
                isPoisoned,
            },
            exported,
            reexports,
            schemas: ngModule.schemas,
        };
        // Check if this scope had any errors during production.
        if (diagnostics.length > 0) {
            // Save the errors for retrieval.
            this.scopeErrors.set(ref.node, diagnostics);
            // Mark this module as being tainted.
            this.modulesWithStructuralErrors.add(ref.node);
        }
        this.cache.set(ref.node, scope);
        return scope;
    }
    /**
     * Check whether a component requires remote scoping.
     */
    getRemoteScope(node) {
        return this.remoteScoping.has(node) ? this.remoteScoping.get(node) : null;
    }
    /**
     * Set a component as requiring remote scoping, with the given directives and pipes to be
     * registered remotely.
     */
    setComponentRemoteScope(node, directives, pipes) {
        this.remoteScoping.set(node, { directives, pipes });
    }
    /**
     * Look up the `ExportScope` of a given `Reference` to an NgModule.
     *
     * The NgModule in question may be declared locally in the current ts.Program, or it may be
     * declared in a .d.ts file.
     *
     * @returns `null` if no scope could be found, or `'invalid'` if the `Reference` is not a valid
     *     NgModule.
     *
     * May also contribute diagnostics of its own by adding to the given `diagnostics`
     * array parameter.
     */
    getExportedScope(ref, diagnostics, ownerForErrors, type) {
        if (ref.node.getSourceFile().isDeclarationFile) {
            // The NgModule is declared in a .d.ts file. Resolve it with the `DependencyScopeReader`.
            if (!ts.isClassDeclaration(ref.node)) {
                // The NgModule is in a .d.ts file but is not declared as a ts.ClassDeclaration. This is an
                // error in the .d.ts metadata.
                const code = type === 'import' ? ErrorCode.NGMODULE_INVALID_IMPORT :
                    ErrorCode.NGMODULE_INVALID_EXPORT;
                diagnostics.push(makeDiagnostic(code, identifierOfNode(ref.node) || ref.node, `Appears in the NgModule.${type}s of ${nodeNameForError(ownerForErrors)}, but could not be resolved to an NgModule`));
                return 'invalid';
            }
            return this.dependencyScopeReader.resolve(ref);
        }
        else {
            // The NgModule is declared locally in the current program. Resolve it from the registry.
            return this.getScopeOfModuleReference(ref);
        }
    }
    getReexports(ngModule, ref, declared, exported, diagnostics) {
        let reexports = null;
        const sourceFile = ref.node.getSourceFile();
        if (this.aliasingHost === null) {
            return null;
        }
        reexports = [];
        // Track re-exports by symbol name, to produce diagnostics if two alias re-exports would share
        // the same name.
        const reexportMap = new Map();
        // Alias ngModuleRef added for readability below.
        const ngModuleRef = ref;
        const addReexport = (exportRef) => {
            if (exportRef.node.getSourceFile() === sourceFile) {
                return;
            }
            const isReExport = !declared.has(exportRef.node);
            const exportName = this.aliasingHost.maybeAliasSymbolAs(exportRef, sourceFile, ngModule.ref.node.name.text, isReExport);
            if (exportName === null) {
                return;
            }
            if (!reexportMap.has(exportName)) {
                if (exportRef.alias && exportRef.alias instanceof ExternalExpr) {
                    reexports.push({
                        fromModule: exportRef.alias.value.moduleName,
                        symbolName: exportRef.alias.value.name,
                        asAlias: exportName,
                    });
                }
                else {
                    const expr = this.refEmitter.emit(exportRef.cloneWithNoIdentifiers(), sourceFile).expression;
                    if (!(expr instanceof ExternalExpr) || expr.value.moduleName === null ||
                        expr.value.name === null) {
                        throw new Error('Expected ExternalExpr');
                    }
                    reexports.push({
                        fromModule: expr.value.moduleName,
                        symbolName: expr.value.name,
                        asAlias: exportName,
                    });
                }
                reexportMap.set(exportName, exportRef);
            }
            else {
                // Another re-export already used this name. Produce a diagnostic.
                const prevRef = reexportMap.get(exportName);
                diagnostics.push(reexportCollision(ngModuleRef.node, prevRef, exportRef));
            }
        };
        for (const { ref } of exported.directives) {
            addReexport(ref);
        }
        for (const { ref } of exported.pipes) {
            addReexport(ref);
        }
        return reexports;
    }
    assertCollecting() {
        if (this.sealed) {
            throw new Error(`Assertion: LocalModuleScopeRegistry is not COLLECTING`);
        }
    }
}
/**
 * Produce a `ts.Diagnostic` for an invalid import or export from an NgModule.
 */
function invalidRef(clazz, decl, type) {
    const code = type === 'import' ? ErrorCode.NGMODULE_INVALID_IMPORT : ErrorCode.NGMODULE_INVALID_EXPORT;
    const resolveTarget = type === 'import' ? 'NgModule' : 'NgModule, Component, Directive, or Pipe';
    let message = `Appears in the NgModule.${type}s of ${nodeNameForError(clazz)}, but could not be resolved to an ${resolveTarget} class.` +
        '\n\n';
    const library = decl.ownedByModuleGuess !== null ? ` (${decl.ownedByModuleGuess})` : '';
    const sf = decl.node.getSourceFile();
    // Provide extra context to the error for the user.
    if (!sf.isDeclarationFile) {
        // This is a file in the user's program.
        const annotationType = type === 'import' ? '@NgModule' : 'Angular';
        message += `Is it missing an ${annotationType} annotation?`;
    }
    else if (sf.fileName.indexOf('node_modules') !== -1) {
        // This file comes from a third-party library in node_modules.
        message +=
            `This likely means that the library${library} which declares ${decl.debugName} has not ` +
                'been processed correctly by ngcc, or is not compatible with Angular Ivy. Check if a ' +
                'newer version of the library is available, and update if so. Also consider checking ' +
                'with the library\'s authors to see if the library is expected to be compatible with Ivy.';
    }
    else {
        // This is a monorepo style local dependency. Unfortunately these are too different to really
        // offer much more advice than this.
        message += `This likely means that the dependency${library} which declares ${decl.debugName} has not been processed correctly by ngcc.`;
    }
    return makeDiagnostic(code, identifierOfNode(decl.node) || decl.node, message);
}
/**
 * Produce a `ts.Diagnostic` for an import or export which itself has errors.
 */
function invalidTransitiveNgModuleRef(clazz, decl, type) {
    const code = type === 'import' ? ErrorCode.NGMODULE_INVALID_IMPORT : ErrorCode.NGMODULE_INVALID_EXPORT;
    return makeDiagnostic(code, identifierOfNode(decl.node) || decl.node, `Appears in the NgModule.${type}s of ${nodeNameForError(clazz)}, but itself has errors`);
}
/**
 * Produce a `ts.Diagnostic` for an exported directive or pipe which was not declared or imported
 * by the NgModule in question.
 */
function invalidReexport(clazz, decl) {
    return makeDiagnostic(ErrorCode.NGMODULE_INVALID_REEXPORT, identifierOfNode(decl.node) || decl.node, `Present in the NgModule.exports of ${nodeNameForError(clazz)} but neither declared nor imported`);
}
/**
 * Produce a `ts.Diagnostic` for a collision in re-export names between two directives/pipes.
 */
function reexportCollision(module, refA, refB) {
    const childMessageText = `This directive/pipe is part of the exports of '${module.name.text}' and shares the same name as another exported directive/pipe.`;
    return makeDiagnostic(ErrorCode.NGMODULE_REEXPORT_NAME_COLLISION, module.name, `
    There was a name collision between two classes named '${refA.node.name.text}', which are both part of the exports of '${module.name.text}'.

    Angular generates re-exports of an NgModule's exported directives/pipes from the module's source file in certain cases, using the declared name of the class. If two classes of the same name are exported, this automatic naming does not work.

    To fix this problem please re-export one or both classes directly from this file.
  `.trim(), [
        makeRelatedInformation(refA.node.name, childMessageText),
        makeRelatedInformation(refB.node.name, childMessageText),
    ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3Njb3BlL3NyYy9sb2NhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsWUFBWSxFQUFpQixNQUFNLG1CQUFtQixDQUFDO0FBQy9ELE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxTQUFTLEVBQUUsY0FBYyxFQUFFLHNCQUFzQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFJcEYsT0FBTyxFQUFDLGdCQUFnQixFQUFFLGdCQUFnQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFtQjdFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxNQUFNLE9BQU8sd0JBQXdCO0lBb0RuQyxZQUNZLFdBQTJCLEVBQVUscUJBQTZDLEVBQ2xGLFVBQTRCLEVBQVUsWUFBK0I7UUFEckUsZ0JBQVcsR0FBWCxXQUFXLENBQWdCO1FBQVUsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF3QjtRQUNsRixlQUFVLEdBQVYsVUFBVSxDQUFrQjtRQUFVLGlCQUFZLEdBQVosWUFBWSxDQUFtQjtRQXJEakY7Ozs7V0FJRztRQUNLLFdBQU0sR0FBRyxLQUFLLENBQUM7UUFFdkI7Ozs7OztXQU1HO1FBQ0ssd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQXFDLENBQUM7UUFFM0U7OztXQUdHO1FBQ0ssMEJBQXFCLEdBQ3pCLElBQUksR0FBRyxFQUE0RCxDQUFDO1FBRWhFLGdCQUFXLEdBQUcsSUFBSSxHQUFHLEVBQWlELENBQUM7UUFFL0U7OztXQUdHO1FBQ0ssVUFBSyxHQUFHLElBQUksR0FBRyxFQUEyQyxDQUFDO1FBRW5FOzs7Ozs7O1dBT0c7UUFDSyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFpQyxDQUFDO1FBRWpFOztXQUVHO1FBQ0ss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QUFJLEVBQ3ZEOzREQUVJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksNkNBQTZDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSTs7Ozs7R0FLdkYsQ0FBQyxJQUFJLEVBQUUsRUFDSjtRQUNFLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDO1FBQ3hELHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDO0tBQ3pELENBQUMsQ0FBQztBQUNULENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtFeHRlcm5hbEV4cHIsIFNjaGVtYU1ldGFkYXRhfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFcnJvckNvZGUsIG1ha2VEaWFnbm9zdGljLCBtYWtlUmVsYXRlZEluZm9ybWF0aW9ufSBmcm9tICcuLi8uLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge0FsaWFzaW5nSG9zdCwgUmVleHBvcnQsIFJlZmVyZW5jZSwgUmVmZXJlbmNlRW1pdHRlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0RpcmVjdGl2ZU1ldGEsIE1ldGFkYXRhUmVhZGVyLCBNZXRhZGF0YVJlZ2lzdHJ5LCBOZ01vZHVsZU1ldGEsIFBpcGVNZXRhfSBmcm9tICcuLi8uLi9tZXRhZGF0YSc7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIERlY2xhcmF0aW9uTm9kZX0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge2lkZW50aWZpZXJPZk5vZGUsIG5vZGVOYW1lRm9yRXJyb3J9IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0V4cG9ydFNjb3BlLCBSZW1vdGVTY29wZSwgU2NvcGVEYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0NvbXBvbmVudFNjb3BlUmVhZGVyfSBmcm9tICcuL2NvbXBvbmVudF9zY29wZSc7XG5pbXBvcnQge0R0c01vZHVsZVNjb3BlUmVzb2x2ZXJ9IGZyb20gJy4vZGVwZW5kZW5jeSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9jYWxOZ01vZHVsZURhdGEge1xuICBkZWNsYXJhdGlvbnM6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPltdO1xuICBpbXBvcnRzOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj5bXTtcbiAgZXhwb3J0czogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9jYWxNb2R1bGVTY29wZSBleHRlbmRzIEV4cG9ydFNjb3BlIHtcbiAgbmdNb2R1bGU6IENsYXNzRGVjbGFyYXRpb247XG4gIGNvbXBpbGF0aW9uOiBTY29wZURhdGE7XG4gIHJlZXhwb3J0czogUmVleHBvcnRbXXxudWxsO1xuICBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdO1xufVxuXG4vKipcbiAqIEEgcmVnaXN0cnkgd2hpY2ggY29sbGVjdHMgaW5mb3JtYXRpb24gYWJvdXQgTmdNb2R1bGVzLCBEaXJlY3RpdmVzLCBDb21wb25lbnRzLCBhbmQgUGlwZXMgd2hpY2hcbiAqIGFyZSBsb2NhbCAoZGVjbGFyZWQgaW4gdGhlIHRzLlByb2dyYW0gYmVpbmcgY29tcGlsZWQpLCBhbmQgY2FuIHByb2R1Y2UgYExvY2FsTW9kdWxlU2NvcGVgc1xuICogd2hpY2ggc3VtbWFyaXplIHRoZSBjb21waWxhdGlvbiBzY29wZSBvZiBhIGNvbXBvbmVudC5cbiAqXG4gKiBUaGlzIGNsYXNzIGltcGxlbWVudHMgdGhlIGxvZ2ljIG9mIE5nTW9kdWxlIGRlY2xhcmF0aW9ucywgaW1wb3J0cywgYW5kIGV4cG9ydHMgYW5kIGNhbiBwcm9kdWNlLFxuICogZm9yIGEgZ2l2ZW4gY29tcG9uZW50LCB0aGUgc2V0IG9mIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIHdoaWNoIGFyZSBcInZpc2libGVcIiBpbiB0aGF0IGNvbXBvbmVudCdzXG4gKiB0ZW1wbGF0ZS5cbiAqXG4gKiBUaGUgYExvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeWAgaGFzIHR3byBcIm1vZGVzXCIgb2Ygb3BlcmF0aW9uLiBEdXJpbmcgYW5hbHlzaXMsIGRhdGEgZm9yIGVhY2hcbiAqIGluZGl2aWR1YWwgTmdNb2R1bGUsIERpcmVjdGl2ZSwgQ29tcG9uZW50LCBhbmQgUGlwZSBpcyBhZGRlZCB0byB0aGUgcmVnaXN0cnkuIE5vIGF0dGVtcHQgaXMgbWFkZVxuICogdG8gdHJhdmVyc2Ugb3IgdmFsaWRhdGUgdGhlIE5nTW9kdWxlIGdyYXBoIChpbXBvcnRzLCBleHBvcnRzLCBldGMpLiBBZnRlciBhbmFseXNpcywgb25lIG9mXG4gKiBgZ2V0U2NvcGVPZk1vZHVsZWAgb3IgYGdldFNjb3BlRm9yQ29tcG9uZW50YCBjYW4gYmUgY2FsbGVkLCB3aGljaCB0cmF2ZXJzZXMgdGhlIE5nTW9kdWxlIGdyYXBoXG4gKiBhbmQgYXBwbGllcyB0aGUgTmdNb2R1bGUgbG9naWMgdG8gZ2VuZXJhdGUgYSBgTG9jYWxNb2R1bGVTY29wZWAsIHRoZSBmdWxsIHNjb3BlIGZvciB0aGUgZ2l2ZW5cbiAqIG1vZHVsZSBvciBjb21wb25lbnQuXG4gKlxuICogVGhlIGBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnlgIGlzIGFsc28gY2FwYWJsZSBvZiBwcm9kdWNpbmcgYHRzLkRpYWdub3N0aWNgIGVycm9ycyB3aGVuIEFuZ3VsYXJcbiAqIHNlbWFudGljcyBhcmUgdmlvbGF0ZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnkgaW1wbGVtZW50cyBNZXRhZGF0YVJlZ2lzdHJ5LCBDb21wb25lbnRTY29wZVJlYWRlciB7XG4gIC8qKlxuICAgKiBUcmFja3Mgd2hldGhlciB0aGUgcmVnaXN0cnkgaGFzIGJlZW4gYXNrZWQgdG8gcHJvZHVjZSBzY29wZXMgZm9yIGEgbW9kdWxlIG9yIGNvbXBvbmVudC4gT25jZVxuICAgKiB0aGlzIGlzIHRydWUsIHRoZSByZWdpc3RyeSBjYW5ub3QgYWNjZXB0IHJlZ2lzdHJhdGlvbnMgb2YgbmV3IGRpcmVjdGl2ZXMvcGlwZXMvbW9kdWxlcyBhcyBpdFxuICAgKiB3b3VsZCBpbnZhbGlkYXRlIHRoZSBjYWNoZWQgc2NvcGUgZGF0YS5cbiAgICovXG4gIHByaXZhdGUgc2VhbGVkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIEEgbWFwIG9mIGNvbXBvbmVudHMgZnJvbSB0aGUgY3VycmVudCBjb21waWxhdGlvbiB1bml0IHRvIHRoZSBOZ01vZHVsZSB3aGljaCBkZWNsYXJlZCB0aGVtLlxuICAgKlxuICAgKiBBcyBjb21wb25lbnRzIGFuZCBkaXJlY3RpdmVzIGFyZSBub3QgZGlzdGluZ3Vpc2hlZCBhdCB0aGUgTmdNb2R1bGUgbGV2ZWwsIHRoaXMgbWFwIG1heSBhbHNvXG4gICAqIGNvbnRhaW4gZGlyZWN0aXZlcy4gVGhpcyBkb2Vzbid0IGNhdXNlIGFueSBwcm9ibGVtcyBidXQgaXNuJ3QgdXNlZnVsIGFzIHRoZXJlIGlzIG5vIGNvbmNlcHQgb2ZcbiAgICogYSBkaXJlY3RpdmUncyBjb21waWxhdGlvbiBzY29wZS5cbiAgICovXG4gIHByaXZhdGUgZGVjbGFyYXRpb25Ub01vZHVsZSA9IG5ldyBNYXA8Q2xhc3NEZWNsYXJhdGlvbiwgRGVjbGFyYXRpb25EYXRhPigpO1xuXG4gIC8qKlxuICAgKiBUaGlzIG1hcHMgZnJvbSB0aGUgZGlyZWN0aXZlL3BpcGUgY2xhc3MgdG8gYSBtYXAgb2YgZGF0YSBmb3IgZWFjaCBOZ01vZHVsZSB0aGF0IGRlY2xhcmVzIHRoZVxuICAgKiBkaXJlY3RpdmUvcGlwZS4gVGhpcyBkYXRhIGlzIG5lZWRlZCB0byBwcm9kdWNlIGFuIGVycm9yIGZvciB0aGUgZ2l2ZW4gY2xhc3MuXG4gICAqL1xuICBwcml2YXRlIGR1cGxpY2F0ZURlY2xhcmF0aW9ucyA9XG4gICAgICBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIE1hcDxDbGFzc0RlY2xhcmF0aW9uLCBEZWNsYXJhdGlvbkRhdGE+PigpO1xuXG4gIHByaXZhdGUgbW9kdWxlVG9SZWYgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj4oKTtcblxuICAvKipcbiAgICogQSBjYWNoZSBvZiBjYWxjdWxhdGVkIGBMb2NhbE1vZHVsZVNjb3BlYHMgZm9yIGVhY2ggTmdNb2R1bGUgZGVjbGFyZWQgaW4gdGhlIGN1cnJlbnQgcHJvZ3JhbS5cblxuICAgKi9cbiAgcHJpdmF0ZSBjYWNoZSA9IG5ldyBNYXA8Q2xhc3NEZWNsYXJhdGlvbiwgTG9jYWxNb2R1bGVTY29wZXxudWxsPigpO1xuXG4gIC8qKlxuICAgKiBUcmFja3MgdGhlIGBSZW1vdGVTY29wZWAgZm9yIGNvbXBvbmVudHMgcmVxdWlyaW5nIFwicmVtb3RlIHNjb3BpbmdcIi5cbiAgICpcbiAgICogUmVtb3RlIHNjb3BpbmcgaXMgd2hlbiB0aGUgc2V0IG9mIGRpcmVjdGl2ZXMgd2hpY2ggYXBwbHkgdG8gYSBnaXZlbiBjb21wb25lbnQgaXMgc2V0IGluIHRoZVxuICAgKiBOZ01vZHVsZSdzIGZpbGUgaW5zdGVhZCBvZiBkaXJlY3RseSBvbiB0aGUgY29tcG9uZW50IGRlZiAod2hpY2ggaXMgc29tZXRpbWVzIG5lZWRlZCB0byBnZXRcbiAgICogYXJvdW5kIGN5Y2xpYyBpbXBvcnQgaXNzdWVzKS4gVGhpcyBpcyBub3QgdXNlZCBpbiBjYWxjdWxhdGlvbiBvZiBgTG9jYWxNb2R1bGVTY29wZWBzLCBidXQgaXNcbiAgICogdHJhY2tlZCBoZXJlIGZvciBjb252ZW5pZW5jZS5cbiAgICovXG4gIHByaXZhdGUgcmVtb3RlU2NvcGluZyA9IG5ldyBNYXA8Q2xhc3NEZWNsYXJhdGlvbiwgUmVtb3RlU2NvcGU+KCk7XG5cbiAgLyoqXG4gICAqIFRyYWNrcyBlcnJvcnMgYWNjdW11bGF0ZWQgaW4gdGhlIHByb2Nlc3Npbmcgb2Ygc2NvcGVzIGZvciBlYWNoIG1vZHVsZSBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgc2NvcGVFcnJvcnMgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIHRzLkRpYWdub3N0aWNbXT4oKTtcblxuICAvKipcbiAgICogVHJhY2tzIHdoaWNoIE5nTW9kdWxlcyBoYXZlIGRpcmVjdGl2ZXMvcGlwZXMgdGhhdCBhcmUgZGVjbGFyZWQgaW4gbW9yZSB0aGFuIG9uZSBtb2R1bGUuXG4gICAqL1xuICBwcml2YXRlIG1vZHVsZXNXaXRoU3RydWN0dXJhbEVycm9ycyA9IG5ldyBTZXQ8Q2xhc3NEZWNsYXJhdGlvbj4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgbG9jYWxSZWFkZXI6IE1ldGFkYXRhUmVhZGVyLCBwcml2YXRlIGRlcGVuZGVuY3lTY29wZVJlYWRlcjogRHRzTW9kdWxlU2NvcGVSZXNvbHZlcixcbiAgICAgIHByaXZhdGUgcmVmRW1pdHRlcjogUmVmZXJlbmNlRW1pdHRlciwgcHJpdmF0ZSBhbGlhc2luZ0hvc3Q6IEFsaWFzaW5nSG9zdHxudWxsKSB7fVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gTmdNb2R1bGUncyBkYXRhIHRvIHRoZSByZWdpc3RyeS5cbiAgICovXG4gIHJlZ2lzdGVyTmdNb2R1bGVNZXRhZGF0YShkYXRhOiBOZ01vZHVsZU1ldGEpOiB2b2lkIHtcbiAgICB0aGlzLmFzc2VydENvbGxlY3RpbmcoKTtcbiAgICBjb25zdCBuZ01vZHVsZSA9IGRhdGEucmVmLm5vZGU7XG4gICAgdGhpcy5tb2R1bGVUb1JlZi5zZXQoZGF0YS5yZWYubm9kZSwgZGF0YS5yZWYpO1xuICAgIC8vIEl0ZXJhdGUgb3ZlciB0aGUgbW9kdWxlJ3MgZGVjbGFyYXRpb25zLCBhbmQgYWRkIHRoZW0gdG8gZGVjbGFyYXRpb25Ub01vZHVsZS4gSWYgZHVwbGljYXRlc1xuICAgIC8vIGFyZSBmb3VuZCwgdGhleSdyZSBpbnN0ZWFkIHRyYWNrZWQgaW4gZHVwbGljYXRlRGVjbGFyYXRpb25zLlxuICAgIGZvciAoY29uc3QgZGVjbCBvZiBkYXRhLmRlY2xhcmF0aW9ucykge1xuICAgICAgdGhpcy5yZWdpc3RlckRlY2xhcmF0aW9uT2ZNb2R1bGUobmdNb2R1bGUsIGRlY2wsIGRhdGEucmF3RGVjbGFyYXRpb25zKTtcbiAgICB9XG4gIH1cblxuICByZWdpc3RlckRpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZTogRGlyZWN0aXZlTWV0YSk6IHZvaWQge31cblxuICByZWdpc3RlclBpcGVNZXRhZGF0YShwaXBlOiBQaXBlTWV0YSk6IHZvaWQge31cblxuICBnZXRTY29wZUZvckNvbXBvbmVudChjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IExvY2FsTW9kdWxlU2NvcGV8bnVsbCB7XG4gICAgY29uc3Qgc2NvcGUgPSAhdGhpcy5kZWNsYXJhdGlvblRvTW9kdWxlLmhhcyhjbGF6eikgP1xuICAgICAgICBudWxsIDpcbiAgICAgICAgdGhpcy5nZXRTY29wZU9mTW9kdWxlKHRoaXMuZGVjbGFyYXRpb25Ub01vZHVsZS5nZXQoY2xhenopIS5uZ01vZHVsZSk7XG4gICAgcmV0dXJuIHNjb3BlO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIGBub2RlYCBpcyBkZWNsYXJlZCBpbiBtb3JlIHRoYW4gb25lIE5nTW9kdWxlIChkdXBsaWNhdGUgZGVjbGFyYXRpb24pLCB0aGVuIGdldCB0aGVcbiAgICogYERlY2xhcmF0aW9uRGF0YWAgZm9yIGVhY2ggb2ZmZW5kaW5nIGRlY2xhcmF0aW9uLlxuICAgKlxuICAgKiBPcmRpbmFyaWx5IGEgY2xhc3MgaXMgb25seSBkZWNsYXJlZCBpbiBvbmUgTmdNb2R1bGUsIGluIHdoaWNoIGNhc2UgdGhpcyBmdW5jdGlvbiByZXR1cm5zXG4gICAqIGBudWxsYC5cbiAgICovXG4gIGdldER1cGxpY2F0ZURlY2xhcmF0aW9ucyhub2RlOiBDbGFzc0RlY2xhcmF0aW9uKTogRGVjbGFyYXRpb25EYXRhW118bnVsbCB7XG4gICAgaWYgKCF0aGlzLmR1cGxpY2F0ZURlY2xhcmF0aW9ucy5oYXMobm9kZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZHVwbGljYXRlRGVjbGFyYXRpb25zLmdldChub2RlKSEudmFsdWVzKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbGxlY3RzIHJlZ2lzdGVyZWQgZGF0YSBmb3IgYSBtb2R1bGUgYW5kIGl0cyBkaXJlY3RpdmVzL3BpcGVzIGFuZCBjb252ZXJ0IGl0IGludG8gYSBmdWxsXG4gICAqIGBMb2NhbE1vZHVsZVNjb3BlYC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaW1wbGVtZW50cyB0aGUgbG9naWMgb2YgTmdNb2R1bGUgaW1wb3J0cyBhbmQgZXhwb3J0cy4gSXQgcmV0dXJucyB0aGVcbiAgICogYExvY2FsTW9kdWxlU2NvcGVgIGZvciB0aGUgZ2l2ZW4gTmdNb2R1bGUgaWYgb25lIGNhbiBiZSBwcm9kdWNlZCwgYG51bGxgIGlmIG5vIHNjb3BlIHdhcyBldmVyXG4gICAqIGRlZmluZWQsIG9yIHRoZSBzdHJpbmcgYCdlcnJvcidgIGlmIHRoZSBzY29wZSBjb250YWluZWQgZXJyb3JzLlxuICAgKi9cbiAgZ2V0U2NvcGVPZk1vZHVsZShjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IExvY2FsTW9kdWxlU2NvcGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubW9kdWxlVG9SZWYuaGFzKGNsYXp6KSA/XG4gICAgICAgIHRoaXMuZ2V0U2NvcGVPZk1vZHVsZVJlZmVyZW5jZSh0aGlzLm1vZHVsZVRvUmVmLmdldChjbGF6eikhKSA6XG4gICAgICAgIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIGFueSBgdHMuRGlhZ25vc3RpY2BzIHByb2R1Y2VkIGR1cmluZyB0aGUgY2FsY3VsYXRpb24gb2YgdGhlIGBMb2NhbE1vZHVsZVNjb3BlYCBmb3JcbiAgICogdGhlIGdpdmVuIE5nTW9kdWxlLCBvciBgbnVsbGAgaWYgbm8gZXJyb3JzIHdlcmUgcHJlc2VudC5cbiAgICovXG4gIGdldERpYWdub3N0aWNzT2ZNb2R1bGUoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiB0cy5EaWFnbm9zdGljW118bnVsbCB7XG4gICAgLy8gUmVxdWlyZWQgdG8gZW5zdXJlIHRoZSBlcnJvcnMgYXJlIHBvcHVsYXRlZCBmb3IgdGhlIGdpdmVuIGNsYXNzLiBJZiBpdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICAvLyBiZWZvcmUsIHRoaXMgd2lsbCBiZSBhIG5vLW9wIGR1ZSB0byB0aGUgc2NvcGUgY2FjaGUuXG4gICAgdGhpcy5nZXRTY29wZU9mTW9kdWxlKGNsYXp6KTtcblxuICAgIGlmICh0aGlzLnNjb3BlRXJyb3JzLmhhcyhjbGF6eikpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjb3BlRXJyb3JzLmdldChjbGF6eikhO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyRGVjbGFyYXRpb25PZk1vZHVsZShcbiAgICAgIG5nTW9kdWxlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNsOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4sXG4gICAgICByYXdEZWNsYXJhdGlvbnM6IHRzLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IGRlY2xEYXRhOiBEZWNsYXJhdGlvbkRhdGEgPSB7XG4gICAgICBuZ01vZHVsZSxcbiAgICAgIHJlZjogZGVjbCxcbiAgICAgIHJhd0RlY2xhcmF0aW9ucyxcbiAgICB9O1xuXG4gICAgLy8gRmlyc3QsIGNoZWNrIGZvciBkdXBsaWNhdGUgZGVjbGFyYXRpb25zIG9mIHRoZSBzYW1lIGRpcmVjdGl2ZS9waXBlLlxuICAgIGlmICh0aGlzLmR1cGxpY2F0ZURlY2xhcmF0aW9ucy5oYXMoZGVjbC5ub2RlKSkge1xuICAgICAgLy8gVGhpcyBkaXJlY3RpdmUvcGlwZSBoYXMgYWxyZWFkeSBiZWVuIGlkZW50aWZpZWQgYXMgYmVpbmcgZHVwbGljYXRlZC4gQWRkIHRoaXMgbW9kdWxlIHRvIHRoZVxuICAgICAgLy8gbWFwIG9mIG1vZHVsZXMgZm9yIHdoaWNoIGEgZHVwbGljYXRlIGRlY2xhcmF0aW9uIGV4aXN0cy5cbiAgICAgIHRoaXMuZHVwbGljYXRlRGVjbGFyYXRpb25zLmdldChkZWNsLm5vZGUpIS5zZXQobmdNb2R1bGUsIGRlY2xEYXRhKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0aGlzLmRlY2xhcmF0aW9uVG9Nb2R1bGUuaGFzKGRlY2wubm9kZSkgJiZcbiAgICAgICAgdGhpcy5kZWNsYXJhdGlvblRvTW9kdWxlLmdldChkZWNsLm5vZGUpIS5uZ01vZHVsZSAhPT0gbmdNb2R1bGUpIHtcbiAgICAgIC8vIFRoaXMgZGlyZWN0aXZlL3BpcGUgaXMgYWxyZWFkeSByZWdpc3RlcmVkIGFzIGRlY2xhcmVkIGluIGFub3RoZXIgbW9kdWxlLiBNYXJrIGl0IGFzIGFcbiAgICAgIC8vIGR1cGxpY2F0ZSBpbnN0ZWFkLlxuICAgICAgY29uc3QgZHVwbGljYXRlRGVjbE1hcCA9IG5ldyBNYXA8Q2xhc3NEZWNsYXJhdGlvbiwgRGVjbGFyYXRpb25EYXRhPigpO1xuICAgICAgY29uc3QgZmlyc3REZWNsRGF0YSA9IHRoaXMuZGVjbGFyYXRpb25Ub01vZHVsZS5nZXQoZGVjbC5ub2RlKSE7XG5cbiAgICAgIC8vIE1hcmsgYm90aCBtb2R1bGVzIGFzIGhhdmluZyBkdXBsaWNhdGUgZGVjbGFyYXRpb25zLlxuICAgICAgdGhpcy5tb2R1bGVzV2l0aFN0cnVjdHVyYWxFcnJvcnMuYWRkKGZpcnN0RGVjbERhdGEubmdNb2R1bGUpO1xuICAgICAgdGhpcy5tb2R1bGVzV2l0aFN0cnVjdHVyYWxFcnJvcnMuYWRkKG5nTW9kdWxlKTtcblxuICAgICAgLy8gQmVpbmcgZGV0ZWN0ZWQgYXMgYSBkdXBsaWNhdGUgbWVhbnMgdGhlcmUgYXJlIHR3byBOZ01vZHVsZXMgKGZvciBub3cpIHdoaWNoIGRlY2xhcmUgdGhpc1xuICAgICAgLy8gZGlyZWN0aXZlL3BpcGUuIEFkZCBib3RoIG9mIHRoZW0gdG8gdGhlIGR1cGxpY2F0ZSB0cmFja2luZyBtYXAuXG4gICAgICBkdXBsaWNhdGVEZWNsTWFwLnNldChmaXJzdERlY2xEYXRhLm5nTW9kdWxlLCBmaXJzdERlY2xEYXRhKTtcbiAgICAgIGR1cGxpY2F0ZURlY2xNYXAuc2V0KG5nTW9kdWxlLCBkZWNsRGF0YSk7XG4gICAgICB0aGlzLmR1cGxpY2F0ZURlY2xhcmF0aW9ucy5zZXQoZGVjbC5ub2RlLCBkdXBsaWNhdGVEZWNsTWFwKTtcblxuICAgICAgLy8gUmVtb3ZlIHRoZSBkaXJlY3RpdmUvcGlwZSBmcm9tIGBkZWNsYXJhdGlvblRvTW9kdWxlYCBhcyBpdCdzIGEgZHVwbGljYXRlIGRlY2xhcmF0aW9uLCBhbmRcbiAgICAgIC8vIHRoZXJlZm9yZSBub3QgdmFsaWQuXG4gICAgICB0aGlzLmRlY2xhcmF0aW9uVG9Nb2R1bGUuZGVsZXRlKGRlY2wubm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoaXMgaXMgdGhlIGZpcnN0IGRlY2xhcmF0aW9uIG9mIHRoaXMgZGlyZWN0aXZlL3BpcGUsIHNvIG1hcCBpdC5cbiAgICAgIHRoaXMuZGVjbGFyYXRpb25Ub01vZHVsZS5zZXQoZGVjbC5ub2RlLCBkZWNsRGF0YSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEltcGxlbWVudGF0aW9uIG9mIGBnZXRTY29wZU9mTW9kdWxlYCB3aGljaCBhY2NlcHRzIGEgcmVmZXJlbmNlIHRvIGEgY2xhc3MuXG4gICAqL1xuICBwcml2YXRlIGdldFNjb3BlT2ZNb2R1bGVSZWZlcmVuY2UocmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4pOiBMb2NhbE1vZHVsZVNjb3BlfG51bGwge1xuICAgIGlmICh0aGlzLmNhY2hlLmhhcyhyZWYubm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhY2hlLmdldChyZWYubm9kZSkhO1xuICAgIH1cblxuICAgIC8vIFNlYWwgdGhlIHJlZ2lzdHJ5IHRvIHByb3RlY3QgdGhlIGludGVncml0eSBvZiB0aGUgYExvY2FsTW9kdWxlU2NvcGVgIGNhY2hlLlxuICAgIHRoaXMuc2VhbGVkID0gdHJ1ZTtcblxuICAgIC8vIGByZWZgIHNob3VsZCBiZSBhbiBOZ01vZHVsZSBwcmV2aW91c2x5IGFkZGVkIHRvIHRoZSByZWdpc3RyeS4gSWYgbm90LCBhIHNjb3BlIGZvciBpdFxuICAgIC8vIGNhbm5vdCBiZSBwcm9kdWNlZC5cbiAgICBjb25zdCBuZ01vZHVsZSA9IHRoaXMubG9jYWxSZWFkZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShyZWYpO1xuICAgIGlmIChuZ01vZHVsZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5jYWNoZS5zZXQocmVmLm5vZGUsIG51bGwpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gTW9kdWxlcyB3aGljaCBjb250cmlidXRlZCB0byB0aGUgY29tcGlsYXRpb24gc2NvcGUgb2YgdGhpcyBtb2R1bGUuXG4gICAgY29uc3QgY29tcGlsYXRpb25Nb2R1bGVzID0gbmV3IFNldDxDbGFzc0RlY2xhcmF0aW9uPihbbmdNb2R1bGUucmVmLm5vZGVdKTtcbiAgICAvLyBNb2R1bGVzIHdoaWNoIGNvbnRyaWJ1dGVkIHRvIHRoZSBleHBvcnQgc2NvcGUgb2YgdGhpcyBtb2R1bGUuXG4gICAgY29uc3QgZXhwb3J0ZWRNb2R1bGVzID0gbmV3IFNldDxDbGFzc0RlY2xhcmF0aW9uPihbbmdNb2R1bGUucmVmLm5vZGVdKTtcblxuICAgIC8vIEVycm9ycyBwcm9kdWNlZCBkdXJpbmcgY29tcHV0YXRpb24gb2YgdGhlIHNjb3BlIGFyZSByZWNvcmRlZCBoZXJlLiBBdCB0aGUgZW5kLCBpZiB0aGlzIGFycmF5XG4gICAgLy8gaXNuJ3QgZW1wdHkgdGhlbiBgdW5kZWZpbmVkYCB3aWxsIGJlIGNhY2hlZCBhbmQgcmV0dXJuZWQgdG8gaW5kaWNhdGUgdGhpcyBzY29wZSBpcyBpbnZhbGlkLlxuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAgIC8vIEF0IHRoaXMgcG9pbnQsIHRoZSBnb2FsIGlzIHRvIHByb2R1Y2UgdHdvIGRpc3RpbmN0IHRyYW5zaXRpdmUgc2V0czpcbiAgICAvLyAtIHRoZSBkaXJlY3RpdmVzIGFuZCBwaXBlcyB3aGljaCBhcmUgdmlzaWJsZSB0byBjb21wb25lbnRzIGRlY2xhcmVkIGluIHRoZSBOZ01vZHVsZS5cbiAgICAvLyAtIHRoZSBkaXJlY3RpdmVzIGFuZCBwaXBlcyB3aGljaCBhcmUgZXhwb3J0ZWQgdG8gYW55IE5nTW9kdWxlcyB3aGljaCBpbXBvcnQgdGhpcyBvbmUuXG5cbiAgICAvLyBEaXJlY3RpdmVzIGFuZCBwaXBlcyBpbiB0aGUgY29tcGlsYXRpb24gc2NvcGUuXG4gICAgY29uc3QgY29tcGlsYXRpb25EaXJlY3RpdmVzID0gbmV3IE1hcDxEZWNsYXJhdGlvbk5vZGUsIERpcmVjdGl2ZU1ldGE+KCk7XG4gICAgY29uc3QgY29tcGlsYXRpb25QaXBlcyA9IG5ldyBNYXA8RGVjbGFyYXRpb25Ob2RlLCBQaXBlTWV0YT4oKTtcblxuICAgIGNvbnN0IGRlY2xhcmVkID0gbmV3IFNldDxEZWNsYXJhdGlvbk5vZGU+KCk7XG5cbiAgICAvLyBEaXJlY3RpdmVzIGFuZCBwaXBlcyBleHBvcnRlZCB0byBhbnkgaW1wb3J0aW5nIE5nTW9kdWxlcy5cbiAgICBjb25zdCBleHBvcnREaXJlY3RpdmVzID0gbmV3IE1hcDxEZWNsYXJhdGlvbk5vZGUsIERpcmVjdGl2ZU1ldGE+KCk7XG4gICAgY29uc3QgZXhwb3J0UGlwZXMgPSBuZXcgTWFwPERlY2xhcmF0aW9uTm9kZSwgUGlwZU1ldGE+KCk7XG5cbiAgICAvLyBUaGUgYWxnb3JpdGhtIGlzIGFzIGZvbGxvd3M6XG4gICAgLy8gMSkgQWRkIGFsbCBvZiB0aGUgZGlyZWN0aXZlcy9waXBlcyBmcm9tIGVhY2ggTmdNb2R1bGUgaW1wb3J0ZWQgaW50byB0aGUgY3VycmVudCBvbmUgdG8gdGhlXG4gICAgLy8gICAgY29tcGlsYXRpb24gc2NvcGUuXG4gICAgLy8gMikgQWRkIGRpcmVjdGl2ZXMvcGlwZXMgZGVjbGFyZWQgaW4gdGhlIE5nTW9kdWxlIHRvIHRoZSBjb21waWxhdGlvbiBzY29wZS4gQXQgdGhpcyBwb2ludCwgdGhlXG4gICAgLy8gICAgY29tcGlsYXRpb24gc2NvcGUgaXMgY29tcGxldGUuXG4gICAgLy8gMykgRm9yIGVhY2ggZW50cnkgaW4gdGhlIE5nTW9kdWxlJ3MgZXhwb3J0czpcbiAgICAvLyAgICBhKSBBdHRlbXB0IHRvIHJlc29sdmUgaXQgYXMgYW4gTmdNb2R1bGUgd2l0aCBpdHMgb3duIGV4cG9ydGVkIGRpcmVjdGl2ZXMvcGlwZXMuIElmIGl0IGlzXG4gICAgLy8gICAgICAgb25lLCBhZGQgdGhlbSB0byB0aGUgZXhwb3J0IHNjb3BlIG9mIHRoaXMgTmdNb2R1bGUuXG4gICAgLy8gICAgYikgT3RoZXJ3aXNlLCBpdCBzaG91bGQgYmUgYSBjbGFzcyBpbiB0aGUgY29tcGlsYXRpb24gc2NvcGUgb2YgdGhpcyBOZ01vZHVsZS4gSWYgaXQgaXMsXG4gICAgLy8gICAgICAgYWRkIGl0IHRvIHRoZSBleHBvcnQgc2NvcGUuXG4gICAgLy8gICAgYykgSWYgaXQncyBuZWl0aGVyIGFuIE5nTW9kdWxlIG5vciBhIGRpcmVjdGl2ZS9waXBlIGluIHRoZSBjb21waWxhdGlvbiBzY29wZSwgdGhlbiB0aGlzXG4gICAgLy8gICAgICAgaXMgYW4gZXJyb3IuXG5cbiAgICAvL1xuICAgIGxldCBpc1BvaXNvbmVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMubW9kdWxlc1dpdGhTdHJ1Y3R1cmFsRXJyb3JzLmhhcyhuZ01vZHVsZS5yZWYubm9kZSkpIHtcbiAgICAgIC8vIElmIHRoZSBtb2R1bGUgY29udGFpbnMgZGVjbGFyYXRpb25zIHRoYXQgYXJlIGR1cGxpY2F0ZXMsIHRoZW4gaXQncyBjb25zaWRlcmVkIHBvaXNvbmVkLlxuICAgICAgaXNQb2lzb25lZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gMSkgcHJvY2VzcyBpbXBvcnRzLlxuICAgIGZvciAoY29uc3QgZGVjbCBvZiBuZ01vZHVsZS5pbXBvcnRzKSB7XG4gICAgICBjb25zdCBpbXBvcnRTY29wZSA9IHRoaXMuZ2V0RXhwb3J0ZWRTY29wZShkZWNsLCBkaWFnbm9zdGljcywgcmVmLm5vZGUsICdpbXBvcnQnKTtcbiAgICAgIGlmIChpbXBvcnRTY29wZSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBBbiBpbXBvcnQgd2Fzbid0IGFuIE5nTW9kdWxlLCBzbyByZWNvcmQgYW4gZXJyb3IuXG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goaW52YWxpZFJlZihyZWYubm9kZSwgZGVjbCwgJ2ltcG9ydCcpKTtcbiAgICAgICAgaXNQb2lzb25lZCA9IHRydWU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIGlmIChpbXBvcnRTY29wZSA9PT0gJ2ludmFsaWQnIHx8IGltcG9ydFNjb3BlLmV4cG9ydGVkLmlzUG9pc29uZWQpIHtcbiAgICAgICAgLy8gQW4gaW1wb3J0IHdhcyBhbiBOZ01vZHVsZSBidXQgY29udGFpbmVkIGVycm9ycyBvZiBpdHMgb3duLiBSZWNvcmQgdGhpcyBhcyBhbiBlcnJvciB0b28sXG4gICAgICAgIC8vIGJlY2F1c2UgdGhpcyBzY29wZSBpcyBhbHdheXMgZ29pbmcgdG8gYmUgaW5jb3JyZWN0IGlmIG9uZSBvZiBpdHMgaW1wb3J0cyBjb3VsZCBub3QgYmVcbiAgICAgICAgLy8gcmVhZC5cbiAgICAgICAgZGlhZ25vc3RpY3MucHVzaChpbnZhbGlkVHJhbnNpdGl2ZU5nTW9kdWxlUmVmKHJlZi5ub2RlLCBkZWNsLCAnaW1wb3J0JykpO1xuICAgICAgICBpc1BvaXNvbmVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAoaW1wb3J0U2NvcGUgPT09ICdpbnZhbGlkJykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgZGlyZWN0aXZlIG9mIGltcG9ydFNjb3BlLmV4cG9ydGVkLmRpcmVjdGl2ZXMpIHtcbiAgICAgICAgY29tcGlsYXRpb25EaXJlY3RpdmVzLnNldChkaXJlY3RpdmUucmVmLm5vZGUsIGRpcmVjdGl2ZSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHBpcGUgb2YgaW1wb3J0U2NvcGUuZXhwb3J0ZWQucGlwZXMpIHtcbiAgICAgICAgY29tcGlsYXRpb25QaXBlcy5zZXQocGlwZS5yZWYubm9kZSwgcGlwZSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGltcG9ydGVkTW9kdWxlIG9mIGltcG9ydFNjb3BlLmV4cG9ydGVkLm5nTW9kdWxlcykge1xuICAgICAgICBjb21waWxhdGlvbk1vZHVsZXMuYWRkKGltcG9ydGVkTW9kdWxlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAyKSBhZGQgZGVjbGFyYXRpb25zLlxuICAgIGZvciAoY29uc3QgZGVjbCBvZiBuZ01vZHVsZS5kZWNsYXJhdGlvbnMpIHtcbiAgICAgIGNvbnN0IGRpcmVjdGl2ZSA9IHRoaXMubG9jYWxSZWFkZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGVjbCk7XG4gICAgICBjb25zdCBwaXBlID0gdGhpcy5sb2NhbFJlYWRlci5nZXRQaXBlTWV0YWRhdGEoZGVjbCk7XG4gICAgICBpZiAoZGlyZWN0aXZlICE9PSBudWxsKSB7XG4gICAgICAgIGNvbXBpbGF0aW9uRGlyZWN0aXZlcy5zZXQoZGVjbC5ub2RlLCB7Li4uZGlyZWN0aXZlLCByZWY6IGRlY2x9KTtcbiAgICAgICAgaWYgKGRpcmVjdGl2ZS5pc1BvaXNvbmVkKSB7XG4gICAgICAgICAgaXNQb2lzb25lZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocGlwZSAhPT0gbnVsbCkge1xuICAgICAgICBjb21waWxhdGlvblBpcGVzLnNldChkZWNsLm5vZGUsIHsuLi5waXBlLCByZWY6IGRlY2x9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yTm9kZSA9IGRlY2wuZ2V0T3JpZ2luRm9yRGlhZ25vc3RpY3MobmdNb2R1bGUucmF3RGVjbGFyYXRpb25zISk7XG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2gobWFrZURpYWdub3N0aWMoXG4gICAgICAgICAgICBFcnJvckNvZGUuTkdNT0RVTEVfSU5WQUxJRF9ERUNMQVJBVElPTiwgZXJyb3JOb2RlLFxuICAgICAgICAgICAgYFRoZSBjbGFzcyAnJHtkZWNsLm5vZGUubmFtZS50ZXh0fScgaXMgbGlzdGVkIGluIHRoZSBkZWNsYXJhdGlvbnMgYCArXG4gICAgICAgICAgICAgICAgYG9mIHRoZSBOZ01vZHVsZSAnJHtcbiAgICAgICAgICAgICAgICAgICAgbmdNb2R1bGUucmVmLm5vZGUubmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRleHR9JywgYnV0IGlzIG5vdCBhIGRpcmVjdGl2ZSwgYSBjb21wb25lbnQsIG9yIGEgcGlwZS4gYCArXG4gICAgICAgICAgICAgICAgYEVpdGhlciByZW1vdmUgaXQgZnJvbSB0aGUgTmdNb2R1bGUncyBkZWNsYXJhdGlvbnMsIG9yIGFkZCBhbiBhcHByb3ByaWF0ZSBBbmd1bGFyIGRlY29yYXRvci5gLFxuICAgICAgICAgICAgW21ha2VSZWxhdGVkSW5mb3JtYXRpb24oXG4gICAgICAgICAgICAgICAgZGVjbC5ub2RlLm5hbWUsIGAnJHtkZWNsLm5vZGUubmFtZS50ZXh0fScgaXMgZGVjbGFyZWQgaGVyZS5gKV0pKTtcbiAgICAgICAgaXNQb2lzb25lZCA9IHRydWU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBkZWNsYXJlZC5hZGQoZGVjbC5ub2RlKTtcbiAgICB9XG5cbiAgICAvLyAzKSBwcm9jZXNzIGV4cG9ydHMuXG4gICAgLy8gRXhwb3J0cyBjYW4gY29udGFpbiBtb2R1bGVzLCBjb21wb25lbnRzLCBvciBkaXJlY3RpdmVzLiBUaGV5J3JlIHByb2Nlc3NlZCBkaWZmZXJlbnRseS5cbiAgICAvLyBNb2R1bGVzIGFyZSBzdHJhaWdodGZvcndhcmQuIERpcmVjdGl2ZXMgYW5kIHBpcGVzIGZyb20gZXhwb3J0ZWQgbW9kdWxlcyBhcmUgYWRkZWQgdG8gdGhlXG4gICAgLy8gZXhwb3J0IG1hcHMuIERpcmVjdGl2ZXMvcGlwZXMgYXJlIGRpZmZlcmVudCAtIHRoZXkgbWlnaHQgYmUgZXhwb3J0cyBvZiBkZWNsYXJlZCB0eXBlcyBvclxuICAgIC8vIGltcG9ydGVkIHR5cGVzLlxuICAgIGZvciAoY29uc3QgZGVjbCBvZiBuZ01vZHVsZS5leHBvcnRzKSB7XG4gICAgICAvLyBBdHRlbXB0IHRvIHJlc29sdmUgZGVjbCBhcyBhbiBOZ01vZHVsZS5cbiAgICAgIGNvbnN0IGV4cG9ydFNjb3BlID0gdGhpcy5nZXRFeHBvcnRlZFNjb3BlKGRlY2wsIGRpYWdub3N0aWNzLCByZWYubm9kZSwgJ2V4cG9ydCcpO1xuICAgICAgaWYgKGV4cG9ydFNjb3BlID09PSAnaW52YWxpZCcgfHwgKGV4cG9ydFNjb3BlICE9PSBudWxsICYmIGV4cG9ydFNjb3BlLmV4cG9ydGVkLmlzUG9pc29uZWQpKSB7XG4gICAgICAgIC8vIEFuIGV4cG9ydCB3YXMgYW4gTmdNb2R1bGUgYnV0IGNvbnRhaW5lZCBlcnJvcnMgb2YgaXRzIG93bi4gUmVjb3JkIHRoaXMgYXMgYW4gZXJyb3IgdG9vLFxuICAgICAgICAvLyBiZWNhdXNlIHRoaXMgc2NvcGUgaXMgYWx3YXlzIGdvaW5nIHRvIGJlIGluY29ycmVjdCBpZiBvbmUgb2YgaXRzIGV4cG9ydHMgY291bGQgbm90IGJlXG4gICAgICAgIC8vIHJlYWQuXG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goaW52YWxpZFRyYW5zaXRpdmVOZ01vZHVsZVJlZihyZWYubm9kZSwgZGVjbCwgJ2V4cG9ydCcpKTtcbiAgICAgICAgaXNQb2lzb25lZCA9IHRydWU7XG5cbiAgICAgICAgaWYgKGV4cG9ydFNjb3BlID09PSAnaW52YWxpZCcpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChleHBvcnRTY29wZSAhPT0gbnVsbCkge1xuICAgICAgICAvLyBkZWNsIGlzIGFuIE5nTW9kdWxlLlxuICAgICAgICBmb3IgKGNvbnN0IGRpcmVjdGl2ZSBvZiBleHBvcnRTY29wZS5leHBvcnRlZC5kaXJlY3RpdmVzKSB7XG4gICAgICAgICAgZXhwb3J0RGlyZWN0aXZlcy5zZXQoZGlyZWN0aXZlLnJlZi5ub2RlLCBkaXJlY3RpdmUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGlwZSBvZiBleHBvcnRTY29wZS5leHBvcnRlZC5waXBlcykge1xuICAgICAgICAgIGV4cG9ydFBpcGVzLnNldChwaXBlLnJlZi5ub2RlLCBwaXBlKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGV4cG9ydGVkTW9kdWxlIG9mIGV4cG9ydFNjb3BlLmV4cG9ydGVkLm5nTW9kdWxlcykge1xuICAgICAgICAgIGV4cG9ydGVkTW9kdWxlcy5hZGQoZXhwb3J0ZWRNb2R1bGUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNvbXBpbGF0aW9uRGlyZWN0aXZlcy5oYXMoZGVjbC5ub2RlKSkge1xuICAgICAgICAvLyBkZWNsIGlzIGEgZGlyZWN0aXZlIG9yIGNvbXBvbmVudCBpbiB0aGUgY29tcGlsYXRpb24gc2NvcGUgb2YgdGhpcyBOZ01vZHVsZS5cbiAgICAgICAgY29uc3QgZGlyZWN0aXZlID0gY29tcGlsYXRpb25EaXJlY3RpdmVzLmdldChkZWNsLm5vZGUpITtcbiAgICAgICAgZXhwb3J0RGlyZWN0aXZlcy5zZXQoZGVjbC5ub2RlLCBkaXJlY3RpdmUpO1xuICAgICAgfSBlbHNlIGlmIChjb21waWxhdGlvblBpcGVzLmhhcyhkZWNsLm5vZGUpKSB7XG4gICAgICAgIC8vIGRlY2wgaXMgYSBwaXBlIGluIHRoZSBjb21waWxhdGlvbiBzY29wZSBvZiB0aGlzIE5nTW9kdWxlLlxuICAgICAgICBjb25zdCBwaXBlID0gY29tcGlsYXRpb25QaXBlcy5nZXQoZGVjbC5ub2RlKSE7XG4gICAgICAgIGV4cG9ydFBpcGVzLnNldChkZWNsLm5vZGUsIHBpcGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZGVjbCBpcyBhbiB1bmtub3duIGV4cG9ydC5cbiAgICAgICAgaWYgKHRoaXMubG9jYWxSZWFkZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGVjbCkgIT09IG51bGwgfHxcbiAgICAgICAgICAgIHRoaXMubG9jYWxSZWFkZXIuZ2V0UGlwZU1ldGFkYXRhKGRlY2wpICE9PSBudWxsKSB7XG4gICAgICAgICAgZGlhZ25vc3RpY3MucHVzaChpbnZhbGlkUmVleHBvcnQocmVmLm5vZGUsIGRlY2wpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkaWFnbm9zdGljcy5wdXNoKGludmFsaWRSZWYocmVmLm5vZGUsIGRlY2wsICdleHBvcnQnKSk7XG4gICAgICAgIH1cbiAgICAgICAgaXNQb2lzb25lZCA9IHRydWU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGV4cG9ydGVkOiBTY29wZURhdGEgPSB7XG4gICAgICBkaXJlY3RpdmVzOiBBcnJheS5mcm9tKGV4cG9ydERpcmVjdGl2ZXMudmFsdWVzKCkpLFxuICAgICAgcGlwZXM6IEFycmF5LmZyb20oZXhwb3J0UGlwZXMudmFsdWVzKCkpLFxuICAgICAgbmdNb2R1bGVzOiBBcnJheS5mcm9tKGV4cG9ydGVkTW9kdWxlcyksXG4gICAgICBpc1BvaXNvbmVkLFxuICAgIH07XG5cbiAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLmdldFJlZXhwb3J0cyhuZ01vZHVsZSwgcmVmLCBkZWNsYXJlZCwgZXhwb3J0ZWQsIGRpYWdub3N0aWNzKTtcblxuXG4gICAgLy8gRmluYWxseSwgcHJvZHVjZSB0aGUgYExvY2FsTW9kdWxlU2NvcGVgIHdpdGggYm90aCB0aGUgY29tcGlsYXRpb24gYW5kIGV4cG9ydCBzY29wZXMuXG4gICAgY29uc3Qgc2NvcGU6IExvY2FsTW9kdWxlU2NvcGUgPSB7XG4gICAgICBuZ01vZHVsZTogbmdNb2R1bGUucmVmLm5vZGUsXG4gICAgICBjb21waWxhdGlvbjoge1xuICAgICAgICBkaXJlY3RpdmVzOiBBcnJheS5mcm9tKGNvbXBpbGF0aW9uRGlyZWN0aXZlcy52YWx1ZXMoKSksXG4gICAgICAgIHBpcGVzOiBBcnJheS5mcm9tKGNvbXBpbGF0aW9uUGlwZXMudmFsdWVzKCkpLFxuICAgICAgICBuZ01vZHVsZXM6IEFycmF5LmZyb20oY29tcGlsYXRpb25Nb2R1bGVzKSxcbiAgICAgICAgaXNQb2lzb25lZCxcbiAgICAgIH0sXG4gICAgICBleHBvcnRlZCxcbiAgICAgIHJlZXhwb3J0cyxcbiAgICAgIHNjaGVtYXM6IG5nTW9kdWxlLnNjaGVtYXMsXG4gICAgfTtcblxuICAgIC8vIENoZWNrIGlmIHRoaXMgc2NvcGUgaGFkIGFueSBlcnJvcnMgZHVyaW5nIHByb2R1Y3Rpb24uXG4gICAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIFNhdmUgdGhlIGVycm9ycyBmb3IgcmV0cmlldmFsLlxuICAgICAgdGhpcy5zY29wZUVycm9ycy5zZXQocmVmLm5vZGUsIGRpYWdub3N0aWNzKTtcblxuICAgICAgLy8gTWFyayB0aGlzIG1vZHVsZSBhcyBiZWluZyB0YWludGVkLlxuICAgICAgdGhpcy5tb2R1bGVzV2l0aFN0cnVjdHVyYWxFcnJvcnMuYWRkKHJlZi5ub2RlKTtcbiAgICB9XG5cbiAgICB0aGlzLmNhY2hlLnNldChyZWYubm9kZSwgc2NvcGUpO1xuICAgIHJldHVybiBzY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIGEgY29tcG9uZW50IHJlcXVpcmVzIHJlbW90ZSBzY29waW5nLlxuICAgKi9cbiAgZ2V0UmVtb3RlU2NvcGUobm9kZTogQ2xhc3NEZWNsYXJhdGlvbik6IFJlbW90ZVNjb3BlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlbW90ZVNjb3BpbmcuaGFzKG5vZGUpID8gdGhpcy5yZW1vdGVTY29waW5nLmdldChub2RlKSEgOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIGNvbXBvbmVudCBhcyByZXF1aXJpbmcgcmVtb3RlIHNjb3BpbmcsIHdpdGggdGhlIGdpdmVuIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIHRvIGJlXG4gICAqIHJlZ2lzdGVyZWQgcmVtb3RlbHkuXG4gICAqL1xuICBzZXRDb21wb25lbnRSZW1vdGVTY29wZShub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkaXJlY3RpdmVzOiBSZWZlcmVuY2VbXSwgcGlwZXM6IFJlZmVyZW5jZVtdKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMucmVtb3RlU2NvcGluZy5zZXQobm9kZSwge2RpcmVjdGl2ZXMsIHBpcGVzfSk7XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCB0aGUgYEV4cG9ydFNjb3BlYCBvZiBhIGdpdmVuIGBSZWZlcmVuY2VgIHRvIGFuIE5nTW9kdWxlLlxuICAgKlxuICAgKiBUaGUgTmdNb2R1bGUgaW4gcXVlc3Rpb24gbWF5IGJlIGRlY2xhcmVkIGxvY2FsbHkgaW4gdGhlIGN1cnJlbnQgdHMuUHJvZ3JhbSwgb3IgaXQgbWF5IGJlXG4gICAqIGRlY2xhcmVkIGluIGEgLmQudHMgZmlsZS5cbiAgICpcbiAgICogQHJldHVybnMgYG51bGxgIGlmIG5vIHNjb3BlIGNvdWxkIGJlIGZvdW5kLCBvciBgJ2ludmFsaWQnYCBpZiB0aGUgYFJlZmVyZW5jZWAgaXMgbm90IGEgdmFsaWRcbiAgICogICAgIE5nTW9kdWxlLlxuICAgKlxuICAgKiBNYXkgYWxzbyBjb250cmlidXRlIGRpYWdub3N0aWNzIG9mIGl0cyBvd24gYnkgYWRkaW5nIHRvIHRoZSBnaXZlbiBgZGlhZ25vc3RpY3NgXG4gICAqIGFycmF5IHBhcmFtZXRlci5cbiAgICovXG4gIHByaXZhdGUgZ2V0RXhwb3J0ZWRTY29wZShcbiAgICAgIHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+LCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdLFxuICAgICAgb3duZXJGb3JFcnJvcnM6IERlY2xhcmF0aW9uTm9kZSwgdHlwZTogJ2ltcG9ydCd8J2V4cG9ydCcpOiBFeHBvcnRTY29wZXxudWxsfCdpbnZhbGlkJyB7XG4gICAgaWYgKHJlZi5ub2RlLmdldFNvdXJjZUZpbGUoKS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgLy8gVGhlIE5nTW9kdWxlIGlzIGRlY2xhcmVkIGluIGEgLmQudHMgZmlsZS4gUmVzb2x2ZSBpdCB3aXRoIHRoZSBgRGVwZW5kZW5jeVNjb3BlUmVhZGVyYC5cbiAgICAgIGlmICghdHMuaXNDbGFzc0RlY2xhcmF0aW9uKHJlZi5ub2RlKSkge1xuICAgICAgICAvLyBUaGUgTmdNb2R1bGUgaXMgaW4gYSAuZC50cyBmaWxlIGJ1dCBpcyBub3QgZGVjbGFyZWQgYXMgYSB0cy5DbGFzc0RlY2xhcmF0aW9uLiBUaGlzIGlzIGFuXG4gICAgICAgIC8vIGVycm9yIGluIHRoZSAuZC50cyBtZXRhZGF0YS5cbiAgICAgICAgY29uc3QgY29kZSA9IHR5cGUgPT09ICdpbXBvcnQnID8gRXJyb3JDb2RlLk5HTU9EVUxFX0lOVkFMSURfSU1QT1JUIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRXJyb3JDb2RlLk5HTU9EVUxFX0lOVkFMSURfRVhQT1JUO1xuICAgICAgICBkaWFnbm9zdGljcy5wdXNoKG1ha2VEaWFnbm9zdGljKFxuICAgICAgICAgICAgY29kZSwgaWRlbnRpZmllck9mTm9kZShyZWYubm9kZSkgfHwgcmVmLm5vZGUsXG4gICAgICAgICAgICBgQXBwZWFycyBpbiB0aGUgTmdNb2R1bGUuJHt0eXBlfXMgb2YgJHtcbiAgICAgICAgICAgICAgICBub2RlTmFtZUZvckVycm9yKG93bmVyRm9yRXJyb3JzKX0sIGJ1dCBjb3VsZCBub3QgYmUgcmVzb2x2ZWQgdG8gYW4gTmdNb2R1bGVgKSk7XG4gICAgICAgIHJldHVybiAnaW52YWxpZCc7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5kZXBlbmRlbmN5U2NvcGVSZWFkZXIucmVzb2x2ZShyZWYpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgTmdNb2R1bGUgaXMgZGVjbGFyZWQgbG9jYWxseSBpbiB0aGUgY3VycmVudCBwcm9ncmFtLiBSZXNvbHZlIGl0IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAgcmV0dXJuIHRoaXMuZ2V0U2NvcGVPZk1vZHVsZVJlZmVyZW5jZShyZWYpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0UmVleHBvcnRzKFxuICAgICAgbmdNb2R1bGU6IE5nTW9kdWxlTWV0YSwgcmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4sIGRlY2xhcmVkOiBTZXQ8RGVjbGFyYXRpb25Ob2RlPixcbiAgICAgIGV4cG9ydGVkOiB7ZGlyZWN0aXZlczogRGlyZWN0aXZlTWV0YVtdLCBwaXBlczogUGlwZU1ldGFbXX0sXG4gICAgICBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdKTogUmVleHBvcnRbXXxudWxsIHtcbiAgICBsZXQgcmVleHBvcnRzOiBSZWV4cG9ydFtdfG51bGwgPSBudWxsO1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSByZWYubm9kZS5nZXRTb3VyY2VGaWxlKCk7XG4gICAgaWYgKHRoaXMuYWxpYXNpbmdIb3N0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmVleHBvcnRzID0gW107XG4gICAgLy8gVHJhY2sgcmUtZXhwb3J0cyBieSBzeW1ib2wgbmFtZSwgdG8gcHJvZHVjZSBkaWFnbm9zdGljcyBpZiB0d28gYWxpYXMgcmUtZXhwb3J0cyB3b3VsZCBzaGFyZVxuICAgIC8vIHRoZSBzYW1lIG5hbWUuXG4gICAgY29uc3QgcmVleHBvcnRNYXAgPSBuZXcgTWFwPHN0cmluZywgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+PigpO1xuICAgIC8vIEFsaWFzIG5nTW9kdWxlUmVmIGFkZGVkIGZvciByZWFkYWJpbGl0eSBiZWxvdy5cbiAgICBjb25zdCBuZ01vZHVsZVJlZiA9IHJlZjtcbiAgICBjb25zdCBhZGRSZWV4cG9ydCA9IChleHBvcnRSZWY6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgaWYgKGV4cG9ydFJlZi5ub2RlLmdldFNvdXJjZUZpbGUoKSA9PT0gc291cmNlRmlsZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBpc1JlRXhwb3J0ID0gIWRlY2xhcmVkLmhhcyhleHBvcnRSZWYubm9kZSk7XG4gICAgICBjb25zdCBleHBvcnROYW1lID0gdGhpcy5hbGlhc2luZ0hvc3QhLm1heWJlQWxpYXNTeW1ib2xBcyhcbiAgICAgICAgICBleHBvcnRSZWYsIHNvdXJjZUZpbGUsIG5nTW9kdWxlLnJlZi5ub2RlLm5hbWUudGV4dCwgaXNSZUV4cG9ydCk7XG4gICAgICBpZiAoZXhwb3J0TmFtZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXJlZXhwb3J0TWFwLmhhcyhleHBvcnROYW1lKSkge1xuICAgICAgICBpZiAoZXhwb3J0UmVmLmFsaWFzICYmIGV4cG9ydFJlZi5hbGlhcyBpbnN0YW5jZW9mIEV4dGVybmFsRXhwcikge1xuICAgICAgICAgIHJlZXhwb3J0cyEucHVzaCh7XG4gICAgICAgICAgICBmcm9tTW9kdWxlOiBleHBvcnRSZWYuYWxpYXMudmFsdWUubW9kdWxlTmFtZSEsXG4gICAgICAgICAgICBzeW1ib2xOYW1lOiBleHBvcnRSZWYuYWxpYXMudmFsdWUubmFtZSEsXG4gICAgICAgICAgICBhc0FsaWFzOiBleHBvcnROYW1lLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGV4cHIgPVxuICAgICAgICAgICAgICB0aGlzLnJlZkVtaXR0ZXIuZW1pdChleHBvcnRSZWYuY2xvbmVXaXRoTm9JZGVudGlmaWVycygpLCBzb3VyY2VGaWxlKS5leHByZXNzaW9uO1xuICAgICAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBFeHRlcm5hbEV4cHIpIHx8IGV4cHIudmFsdWUubW9kdWxlTmFtZSA9PT0gbnVsbCB8fFxuICAgICAgICAgICAgICBleHByLnZhbHVlLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgRXh0ZXJuYWxFeHByJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlZXhwb3J0cyEucHVzaCh7XG4gICAgICAgICAgICBmcm9tTW9kdWxlOiBleHByLnZhbHVlLm1vZHVsZU5hbWUsXG4gICAgICAgICAgICBzeW1ib2xOYW1lOiBleHByLnZhbHVlLm5hbWUsXG4gICAgICAgICAgICBhc0FsaWFzOiBleHBvcnROYW1lLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJlZXhwb3J0TWFwLnNldChleHBvcnROYW1lLCBleHBvcnRSZWYpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQW5vdGhlciByZS1leHBvcnQgYWxyZWFkeSB1c2VkIHRoaXMgbmFtZS4gUHJvZHVjZSBhIGRpYWdub3N0aWMuXG4gICAgICAgIGNvbnN0IHByZXZSZWYgPSByZWV4cG9ydE1hcC5nZXQoZXhwb3J0TmFtZSkhO1xuICAgICAgICBkaWFnbm9zdGljcy5wdXNoKHJlZXhwb3J0Q29sbGlzaW9uKG5nTW9kdWxlUmVmLm5vZGUsIHByZXZSZWYsIGV4cG9ydFJlZikpO1xuICAgICAgfVxuICAgIH07XG4gICAgZm9yIChjb25zdCB7cmVmfSBvZiBleHBvcnRlZC5kaXJlY3RpdmVzKSB7XG4gICAgICBhZGRSZWV4cG9ydChyZWYpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHtyZWZ9IG9mIGV4cG9ydGVkLnBpcGVzKSB7XG4gICAgICBhZGRSZWV4cG9ydChyZWYpO1xuICAgIH1cbiAgICByZXR1cm4gcmVleHBvcnRzO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3NlcnRDb2xsZWN0aW5nKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNlYWxlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb246IExvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeSBpcyBub3QgQ09MTEVDVElOR2ApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFByb2R1Y2UgYSBgdHMuRGlhZ25vc3RpY2AgZm9yIGFuIGludmFsaWQgaW1wb3J0IG9yIGV4cG9ydCBmcm9tIGFuIE5nTW9kdWxlLlxuICovXG5mdW5jdGlvbiBpbnZhbGlkUmVmKFxuICAgIGNsYXp6OiBEZWNsYXJhdGlvbk5vZGUsIGRlY2w6IFJlZmVyZW5jZTxEZWNsYXJhdGlvbk5vZGU+LFxuICAgIHR5cGU6ICdpbXBvcnQnfCdleHBvcnQnKTogdHMuRGlhZ25vc3RpYyB7XG4gIGNvbnN0IGNvZGUgPVxuICAgICAgdHlwZSA9PT0gJ2ltcG9ydCcgPyBFcnJvckNvZGUuTkdNT0RVTEVfSU5WQUxJRF9JTVBPUlQgOiBFcnJvckNvZGUuTkdNT0RVTEVfSU5WQUxJRF9FWFBPUlQ7XG4gIGNvbnN0IHJlc29sdmVUYXJnZXQgPSB0eXBlID09PSAnaW1wb3J0JyA/ICdOZ01vZHVsZScgOiAnTmdNb2R1bGUsIENvbXBvbmVudCwgRGlyZWN0aXZlLCBvciBQaXBlJztcbiAgbGV0IG1lc3NhZ2UgPVxuICAgICAgYEFwcGVhcnMgaW4gdGhlIE5nTW9kdWxlLiR7dHlwZX1zIG9mICR7XG4gICAgICAgICAgbm9kZU5hbWVGb3JFcnJvcihjbGF6eil9LCBidXQgY291bGQgbm90IGJlIHJlc29sdmVkIHRvIGFuICR7cmVzb2x2ZVRhcmdldH0gY2xhc3MuYCArXG4gICAgICAnXFxuXFxuJztcbiAgY29uc3QgbGlicmFyeSA9IGRlY2wub3duZWRCeU1vZHVsZUd1ZXNzICE9PSBudWxsID8gYCAoJHtkZWNsLm93bmVkQnlNb2R1bGVHdWVzc30pYCA6ICcnO1xuICBjb25zdCBzZiA9IGRlY2wubm9kZS5nZXRTb3VyY2VGaWxlKCk7XG5cbiAgLy8gUHJvdmlkZSBleHRyYSBjb250ZXh0IHRvIHRoZSBlcnJvciBmb3IgdGhlIHVzZXIuXG4gIGlmICghc2YuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAvLyBUaGlzIGlzIGEgZmlsZSBpbiB0aGUgdXNlcidzIHByb2dyYW0uXG4gICAgY29uc3QgYW5ub3RhdGlvblR5cGUgPSB0eXBlID09PSAnaW1wb3J0JyA/ICdATmdNb2R1bGUnIDogJ0FuZ3VsYXInO1xuICAgIG1lc3NhZ2UgKz0gYElzIGl0IG1pc3NpbmcgYW4gJHthbm5vdGF0aW9uVHlwZX0gYW5ub3RhdGlvbj9gO1xuICB9IGVsc2UgaWYgKHNmLmZpbGVOYW1lLmluZGV4T2YoJ25vZGVfbW9kdWxlcycpICE9PSAtMSkge1xuICAgIC8vIFRoaXMgZmlsZSBjb21lcyBmcm9tIGEgdGhpcmQtcGFydHkgbGlicmFyeSBpbiBub2RlX21vZHVsZXMuXG4gICAgbWVzc2FnZSArPVxuICAgICAgICBgVGhpcyBsaWtlbHkgbWVhbnMgdGhhdCB0aGUgbGlicmFyeSR7bGlicmFyeX0gd2hpY2ggZGVjbGFyZXMgJHtkZWNsLmRlYnVnTmFtZX0gaGFzIG5vdCBgICtcbiAgICAgICAgJ2JlZW4gcHJvY2Vzc2VkIGNvcnJlY3RseSBieSBuZ2NjLCBvciBpcyBub3QgY29tcGF0aWJsZSB3aXRoIEFuZ3VsYXIgSXZ5LiBDaGVjayBpZiBhICcgK1xuICAgICAgICAnbmV3ZXIgdmVyc2lvbiBvZiB0aGUgbGlicmFyeSBpcyBhdmFpbGFibGUsIGFuZCB1cGRhdGUgaWYgc28uIEFsc28gY29uc2lkZXIgY2hlY2tpbmcgJyArXG4gICAgICAgICd3aXRoIHRoZSBsaWJyYXJ5XFwncyBhdXRob3JzIHRvIHNlZSBpZiB0aGUgbGlicmFyeSBpcyBleHBlY3RlZCB0byBiZSBjb21wYXRpYmxlIHdpdGggSXZ5Lic7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhpcyBpcyBhIG1vbm9yZXBvIHN0eWxlIGxvY2FsIGRlcGVuZGVuY3kuIFVuZm9ydHVuYXRlbHkgdGhlc2UgYXJlIHRvbyBkaWZmZXJlbnQgdG8gcmVhbGx5XG4gICAgLy8gb2ZmZXIgbXVjaCBtb3JlwqBhZHZpY2UgdGhhbiB0aGlzLlxuICAgIG1lc3NhZ2UgKz0gYFRoaXMgbGlrZWx5IG1lYW5zIHRoYXQgdGhlIGRlcGVuZGVuY3kke2xpYnJhcnl9IHdoaWNoIGRlY2xhcmVzICR7XG4gICAgICAgIGRlY2wuZGVidWdOYW1lfSBoYXMgbm90IGJlZW4gcHJvY2Vzc2VkIGNvcnJlY3RseSBieSBuZ2NjLmA7XG4gIH1cblxuICByZXR1cm4gbWFrZURpYWdub3N0aWMoY29kZSwgaWRlbnRpZmllck9mTm9kZShkZWNsLm5vZGUpIHx8IGRlY2wubm9kZSwgbWVzc2FnZSk7XG59XG5cbi8qKlxuICogUHJvZHVjZSBhIGB0cy5EaWFnbm9zdGljYCBmb3IgYW4gaW1wb3J0IG9yIGV4cG9ydCB3aGljaCBpdHNlbGYgaGFzIGVycm9ycy5cbiAqL1xuZnVuY3Rpb24gaW52YWxpZFRyYW5zaXRpdmVOZ01vZHVsZVJlZihcbiAgICBjbGF6ejogRGVjbGFyYXRpb25Ob2RlLCBkZWNsOiBSZWZlcmVuY2U8RGVjbGFyYXRpb25Ob2RlPixcbiAgICB0eXBlOiAnaW1wb3J0J3wnZXhwb3J0Jyk6IHRzLkRpYWdub3N0aWMge1xuICBjb25zdCBjb2RlID1cbiAgICAgIHR5cGUgPT09ICdpbXBvcnQnID8gRXJyb3JDb2RlLk5HTU9EVUxFX0lOVkFMSURfSU1QT1JUIDogRXJyb3JDb2RlLk5HTU9EVUxFX0lOVkFMSURfRVhQT1JUO1xuICByZXR1cm4gbWFrZURpYWdub3N0aWMoXG4gICAgICBjb2RlLCBpZGVudGlmaWVyT2ZOb2RlKGRlY2wubm9kZSkgfHwgZGVjbC5ub2RlLFxuICAgICAgYEFwcGVhcnMgaW4gdGhlIE5nTW9kdWxlLiR7dHlwZX1zIG9mICR7bm9kZU5hbWVGb3JFcnJvcihjbGF6eil9LCBidXQgaXRzZWxmIGhhcyBlcnJvcnNgKTtcbn1cblxuLyoqXG4gKiBQcm9kdWNlIGEgYHRzLkRpYWdub3N0aWNgIGZvciBhbiBleHBvcnRlZCBkaXJlY3RpdmUgb3IgcGlwZSB3aGljaCB3YXMgbm90IGRlY2xhcmVkIG9yIGltcG9ydGVkXG4gKiBieSB0aGUgTmdNb2R1bGUgaW4gcXVlc3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGludmFsaWRSZWV4cG9ydChjbGF6ejogRGVjbGFyYXRpb25Ob2RlLCBkZWNsOiBSZWZlcmVuY2U8RGVjbGFyYXRpb25Ob2RlPik6IHRzLkRpYWdub3N0aWMge1xuICByZXR1cm4gbWFrZURpYWdub3N0aWMoXG4gICAgICBFcnJvckNvZGUuTkdNT0RVTEVfSU5WQUxJRF9SRUVYUE9SVCwgaWRlbnRpZmllck9mTm9kZShkZWNsLm5vZGUpIHx8IGRlY2wubm9kZSxcbiAgICAgIGBQcmVzZW50IGluIHRoZSBOZ01vZHVsZS5leHBvcnRzIG9mICR7XG4gICAgICAgICAgbm9kZU5hbWVGb3JFcnJvcihjbGF6eil9IGJ1dCBuZWl0aGVyIGRlY2xhcmVkIG5vciBpbXBvcnRlZGApO1xufVxuXG4vKipcbiAqIFByb2R1Y2UgYSBgdHMuRGlhZ25vc3RpY2AgZm9yIGEgY29sbGlzaW9uIGluIHJlLWV4cG9ydCBuYW1lcyBiZXR3ZWVuIHR3byBkaXJlY3RpdmVzL3BpcGVzLlxuICovXG5mdW5jdGlvbiByZWV4cG9ydENvbGxpc2lvbihcbiAgICBtb2R1bGU6IENsYXNzRGVjbGFyYXRpb24sIHJlZkE6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPixcbiAgICByZWZCOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4pOiB0cy5EaWFnbm9zdGljIHtcbiAgY29uc3QgY2hpbGRNZXNzYWdlVGV4dCA9IGBUaGlzIGRpcmVjdGl2ZS9waXBlIGlzIHBhcnQgb2YgdGhlIGV4cG9ydHMgb2YgJyR7XG4gICAgICBtb2R1bGUubmFtZS50ZXh0fScgYW5kIHNoYXJlcyB0aGUgc2FtZSBuYW1lIGFzIGFub3RoZXIgZXhwb3J0ZWQgZGlyZWN0aXZlL3BpcGUuYDtcbiAgcmV0dXJuIG1ha2VEaWFnbm9zdGljKFxuICAgICAgRXJyb3JDb2RlLk5HTU9EVUxFX1JFRVhQT1JUX05BTUVfQ09MTElTSU9OLCBtb2R1bGUubmFtZSxcbiAgICAgIGBcbiAgICBUaGVyZSB3YXMgYSBuYW1lIGNvbGxpc2lvbiBiZXR3ZWVuIHR3byBjbGFzc2VzIG5hbWVkICcke1xuICAgICAgICAgIHJlZkEubm9kZS5uYW1lLnRleHR9Jywgd2hpY2ggYXJlIGJvdGggcGFydCBvZiB0aGUgZXhwb3J0cyBvZiAnJHttb2R1bGUubmFtZS50ZXh0fScuXG5cbiAgICBBbmd1bGFyIGdlbmVyYXRlcyByZS1leHBvcnRzIG9mIGFuIE5nTW9kdWxlJ3MgZXhwb3J0ZWQgZGlyZWN0aXZlcy9waXBlcyBmcm9tIHRoZSBtb2R1bGUncyBzb3VyY2UgZmlsZSBpbiBjZXJ0YWluIGNhc2VzLCB1c2luZyB0aGUgZGVjbGFyZWQgbmFtZSBvZiB0aGUgY2xhc3MuIElmIHR3byBjbGFzc2VzIG9mIHRoZSBzYW1lIG5hbWUgYXJlIGV4cG9ydGVkLCB0aGlzIGF1dG9tYXRpYyBuYW1pbmcgZG9lcyBub3Qgd29yay5cblxuICAgIFRvIGZpeCB0aGlzIHByb2JsZW0gcGxlYXNlIHJlLWV4cG9ydCBvbmUgb3IgYm90aCBjbGFzc2VzIGRpcmVjdGx5IGZyb20gdGhpcyBmaWxlLlxuICBgLnRyaW0oKSxcbiAgICAgIFtcbiAgICAgICAgbWFrZVJlbGF0ZWRJbmZvcm1hdGlvbihyZWZBLm5vZGUubmFtZSwgY2hpbGRNZXNzYWdlVGV4dCksXG4gICAgICAgIG1ha2VSZWxhdGVkSW5mb3JtYXRpb24ocmVmQi5ub2RlLm5hbWUsIGNoaWxkTWVzc2FnZVRleHQpLFxuICAgICAgXSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVjbGFyYXRpb25EYXRhIHtcbiAgbmdNb2R1bGU6IENsYXNzRGVjbGFyYXRpb247XG4gIHJlZjogUmVmZXJlbmNlO1xuICByYXdEZWNsYXJhdGlvbnM6IHRzLkV4cHJlc3Npb258bnVsbDtcbn1cbiJdfQ==