/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import * as ts from 'typescript';
import { ImportManager } from '../../utils/import_manager';
import { getAngularDecorators } from '../../utils/ng_decorators';
import { hasExplicitConstructor } from '../../utils/typescript/class_declaration';
import { findBaseClassDeclarations } from '../../utils/typescript/find_base_classes';
import { getImportOfIdentifier } from '../../utils/typescript/imports';
import { convertDirectiveMetadataToExpression, UnexpectedMetadataValueError } from './decorator_rewrite/convert_directive_metadata';
import { DecoratorRewriter } from './decorator_rewrite/decorator_rewriter';
import { hasDirectiveDecorator, hasInjectableDecorator } from './ng_declaration_collector';
export class UndecoratedClassesTransform {
    constructor(typeChecker, compiler, evaluator, getUpdateRecorder) {
        this.typeChecker = typeChecker;
        this.compiler = compiler;
        this.evaluator = evaluator;
        this.getUpdateRecorder = getUpdateRecorder;
        this.printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        this.importManager = new ImportManager(this.getUpdateRecorder, this.printer);
        this.decoratorRewriter = new DecoratorRewriter(this.importManager, this.typeChecker, this.evaluator, this.compiler);
        /** Set of class declarations which have been decorated with "@Directive". */
        this.decoratedDirectives = new Set();
        /** Set of class declarations which have been decorated with "@Injectable" */
        this.decoratedProviders = new Set();
        /**
         * Set of class declarations which have been analyzed and need to specify
         * an explicit constructor.
         */
        this.missingExplicitConstructorClasses = new Set();
        this.symbolResolver = compiler['_symbolResolver'];
        this.compilerHost = compiler['_host'];
        this.metadataResolver = compiler['_metadataResolver'];
        // Unset the default error recorder so that the reflector will throw an exception
        // if metadata cannot be resolved.
        this.compiler.reflector['errorRecorder'] = undefined;
        // Disables that static symbols are resolved through summaries from within the static
        // reflector. Summaries cannot be used for decorator serialization as decorators are
        // omitted in summaries and the decorator can't be reconstructed from the directive summary.
        this._disableSummaryResolution();
    }
    /**
     * Migrates decorated directives which can potentially inherit a constructor
     * from an undecorated base class. All base classes until the first one
     * with an explicit constructor will be decorated with the abstract "@Directive()"
     * decorator. See case 1 in the migration plan: https://hackmd.io/@alx/S1XKqMZeS
     */
    migrateDecoratedDirectives(directives) {
        return directives.reduce((failures, node) => failures.concat(this._migrateDirectiveBaseClass(node)), []);
    }
    /**
     * Migrates decorated providers which can potentially inherit a constructor
     * from an undecorated base class. All base classes until the first one
     * with an explicit constructor will be decorated with the "@Injectable()".
     */
    migrateDecoratedProviders(providers) {
        return providers.reduce((failures, node) => failures.concat(this._migrateProviderBaseClass(node)), []);
    }
    _migrateProviderBaseClass(node) {
        return this._migrateDecoratedClassWithInheritedCtor(node, symbol => this.metadataResolver.isInjectable(symbol), node => this._addInjectableDecorator(node));
    }
    _migrateDirectiveBaseClass(node) {
        return this._migrateDecoratedClassWithInheritedCtor(node, symbol => this.metadataResolver.isDirective(symbol), node => this._addAbstractDirectiveDecorator(node));
    }
    _migrateDecoratedClassWithInheritedCtor(node, isClassDecorated, addClassDecorator) {
        // In case the provider has an explicit constructor, we don't need to do anything
        // because the class is already decorated and does not inherit a constructor.
        if (hasExplicitConstructor(node)) {
            return [];
        }
        const orderedBaseClasses = findBaseClassDeclarations(node, this.typeChecker);
        const undecoratedBaseClasses = [];
        for (let { node: baseClass, identifier } of orderedBaseClasses) {
            const baseClassFile = baseClass.getSourceFile();
            if (hasExplicitConstructor(baseClass)) {
                // All classes in between the decorated class and the undecorated class
                // that defines the constructor need to be decorated as well.
                undecoratedBaseClasses.forEach(b => addClassDecorator(b));
                if (baseClassFile.isDeclarationFile) {
                    const staticSymbol = this._getStaticSymbolOfIdentifier(identifier);
                    // If the base class is decorated through metadata files, we don't
                    // need to add a comment to the derived class for the external base class.
                    if (staticSymbol && isClassDecorated(staticSymbol)) {
                        break;
                    }
                    // Find the last class in the inheritance chain that is decorated and will be
                    // used as anchor for a comment explaining that the class that defines the
                    // constructor cannot be decorated automatically.
                    const lastDecoratedClass = undecoratedBaseClasses[undecoratedBaseClasses.length - 1] || node;
                    return this._addMissingExplicitConstructorTodo(lastDecoratedClass);
                }
                // Decorate the class that defines the constructor that is inherited.
                addClassDecorator(baseClass);
                break;
            }
            // Add the class decorator for all base classes in the inheritance chain until
            // the base class with the explicit constructor. The decorator will be only
            // added for base classes which can be modified.
            if (!baseClassFile.isDeclarationFile) {
                undecoratedBaseClasses.push(baseClass);
            }
        }
        return [];
    }
    /**
     * Adds the abstract "@Directive()" decorator to the given class in case there
     * is no existing directive decorator.
     */
    _addAbstractDirectiveDecorator(baseClass) {
        if (hasDirectiveDecorator(baseClass, this.typeChecker) ||
            this.decoratedDirectives.has(baseClass)) {
            return;
        }
        const baseClassFile = baseClass.getSourceFile();
        const recorder = this.getUpdateRecorder(baseClassFile);
        const directiveExpr = this.importManager.addImportToSourceFile(baseClassFile, 'Directive', '@angular/core');
        const newDecorator = ts.createDecorator(ts.createCall(directiveExpr, undefined, []));
        const newDecoratorText = this.printer.printNode(ts.EmitHint.Unspecified, newDecorator, baseClassFile);
        recorder.addClassDecorator(baseClass, newDecoratorText);
        this.decoratedDirectives.add(baseClass);
    }
    /**
     * Adds the abstract "@Injectable()" decorator to the given class in case there
     * is no existing directive decorator.
     */
    _addInjectableDecorator(baseClass) {
        if (hasInjectableDecorator(baseClass, this.typeChecker) ||
            this.decoratedProviders.has(baseClass)) {
            return;
        }
        const baseClassFile = baseClass.getSourceFile();
        const recorder = this.getUpdateRecorder(baseClassFile);
        const injectableExpr = this.importManager.addImportToSourceFile(baseClassFile, 'Injectable', '@angular/core');
        const newDecorator = ts.createDecorator(ts.createCall(injectableExpr, undefined, []));
        const newDecoratorText = this.printer.printNode(ts.EmitHint.Unspecified, newDecorator, baseClassFile);
        recorder.addClassDecorator(baseClass, newDecoratorText);
        this.decoratedProviders.add(baseClass);
    }
    /** Adds a comment for adding an explicit constructor to the given class declaration. */
    _addMissingExplicitConstructorTodo(node) {
        // In case a todo comment has been already inserted to the given class, we don't
        // want to add a comment or transform failure multiple times.
        if (this.missingExplicitConstructorClasses.has(node)) {
            return [];
        }
        this.missingExplicitConstructorClasses.add(node);
        const recorder = this.getUpdateRecorder(node.getSourceFile());
        recorder.addClassComment(node, 'TODO: add explicit constructor');
        return [{ node: node, message: 'Class needs to declare an explicit constructor.' }];
    }
    /**
     * Migrates undecorated directives which were referenced in NgModule declarations.
     * These directives inherit the metadata from a parent base class, but with Ivy
     * these classes need to explicitly have a decorator for locality. The migration
     * determines the inherited decorator and copies it to the undecorated declaration.
     *
     * Note that the migration serializes the metadata for external declarations
     * where the decorator is not part of the source file AST.
     *
     * See case 2 in the migration plan: https://hackmd.io/@alx/S1XKqMZeS
     */
    migrateUndecoratedDeclarations(directives) {
        return directives.reduce((failures, node) => failures.concat(this._migrateDerivedDeclaration(node)), []);
    }
    _migrateDerivedDeclaration(node) {
        const targetSourceFile = node.getSourceFile();
        const orderedBaseClasses = findBaseClassDeclarations(node, this.typeChecker);
        let newDecoratorText = null;
        for (let { node: baseClass, identifier } of orderedBaseClasses) {
            // Before looking for decorators within the metadata or summary files, we
            // try to determine the directive decorator through the source file AST.
            if (baseClass.decorators) {
                const ngDecorator = getAngularDecorators(this.typeChecker, baseClass.decorators)
                    .find(({ name }) => name === 'Component' || name === 'Directive' || name === 'Pipe');
                if (ngDecorator) {
                    const newDecorator = this.decoratorRewriter.rewrite(ngDecorator, node.getSourceFile());
                    newDecoratorText = this.printer.printNode(ts.EmitHint.Unspecified, newDecorator, ngDecorator.node.getSourceFile());
                    break;
                }
            }
            // If no metadata could be found within the source-file AST, try to find
            // decorator data through Angular metadata and summary files.
            const staticSymbol = this._getStaticSymbolOfIdentifier(identifier);
            // Check if the static symbol resolves to a class declaration with
            // pipe or directive metadata.
            if (!staticSymbol ||
                !(this.metadataResolver.isPipe(staticSymbol) ||
                    this.metadataResolver.isDirective(staticSymbol))) {
                continue;
            }
            const metadata = this._resolveDeclarationMetadata(staticSymbol);
            // If no metadata could be resolved for the static symbol, print a failure message
            // and ask the developer to manually migrate the class. This case is rare because
            // usually decorator metadata is always present but just can't be read if a program
            // only has access to summaries (this is a special case in google3).
            if (!metadata) {
                return [{
                        node,
                        message: `Class cannot be migrated as the inherited metadata from ` +
                            `${identifier.getText()} cannot be converted into a decorator. Please manually
            decorate the class.`,
                    }];
            }
            const newDecorator = this._constructDecoratorFromMetadata(metadata, targetSourceFile);
            if (!newDecorator) {
                const annotationType = metadata.type;
                return [{
                        node,
                        message: `Class cannot be migrated as the inherited @${annotationType} decorator ` +
                            `cannot be copied. Please manually add a @${annotationType} decorator.`,
                    }];
            }
            // In case the decorator could be constructed from the resolved metadata, use
            // that decorator for the derived undecorated classes.
            newDecoratorText =
                this.printer.printNode(ts.EmitHint.Unspecified, newDecorator, targetSourceFile);
            break;
        }
        if (!newDecoratorText) {
            return [{
                    node,
                    message: 'Class cannot be migrated as no directive/component/pipe metadata could be found. ' +
                        'Please manually add a @Directive, @Component or @Pipe decorator.'
                }];
        }
        this.getUpdateRecorder(targetSourceFile).addClassDecorator(node, newDecoratorText);
        return [];
    }
    /** Records all changes that were made in the import manager. */
    recordChanges() {
        this.importManager.recordChanges();
    }
    /**
     * Constructs a TypeScript decorator node from the specified declaration metadata. Returns
     * null if the metadata could not be simplified/resolved.
     */
    _constructDecoratorFromMetadata(directiveMetadata, targetSourceFile) {
        try {
            const decoratorExpr = convertDirectiveMetadataToExpression(directiveMetadata.metadata, staticSymbol => this.compilerHost
                .fileNameToModuleName(staticSymbol.filePath, targetSourceFile.fileName)
                .replace(/\/index$/, ''), (moduleName, name) => this.importManager.addImportToSourceFile(targetSourceFile, name, moduleName), (propertyName, value) => {
                // Only normalize properties called "changeDetection" and "encapsulation"
                // for "@Directive" and "@Component" annotations.
                if (directiveMetadata.type === 'Pipe') {
                    return null;
                }
                // Instead of using the number as value for the "changeDetection" and
                // "encapsulation" properties, we want to use the actual enum symbols.
                if (propertyName === 'changeDetection' && typeof value === 'number') {
                    return ts.createPropertyAccess(this.importManager.addImportToSourceFile(targetSourceFile, 'ChangeDetectionStrategy', '@angular/core'), ChangeDetectionStrategy[value]);
                }
                else if (propertyName === 'encapsulation' && typeof value === 'number') {
                    return ts.createPropertyAccess(this.importManager.addImportToSourceFile(targetSourceFile, 'ViewEncapsulation', '@angular/core'), ViewEncapsulation[value]);
                }
                return null;
            });
            return ts.createDecorator(ts.createCall(this.importManager.addImportToSourceFile(targetSourceFile, directiveMetadata.type, '@angular/core'), undefined, [decoratorExpr]));
        }
        catch (e) {
            if (e instanceof UnexpectedMetadataValueError) {
                return null;
            }
            throw e;
        }
    }
    /**
     * Resolves the declaration metadata of a given static symbol. The metadata
     * is determined by resolving metadata for the static symbol.
     */
    _resolveDeclarationMetadata(symbol) {
        try {
            // Note that this call can throw if the metadata is not computable. In that
            // case we are not able to serialize the metadata into a decorator and we return
            // null.
            const annotations = this.compiler.reflector.annotations(symbol).find(s => s.ngMetadataName === 'Component' || s.ngMetadataName === 'Directive' ||
                s.ngMetadataName === 'Pipe');
            if (!annotations) {
                return null;
            }
            const { ngMetadataName } = annotations, metadata = __rest(annotations, ["ngMetadataName"]);
            // Delete the "ngMetadataName" property as we don't want to generate
            // a property assignment in the new decorator for that internal property.
            delete metadata['ngMetadataName'];
            return { type: ngMetadataName, metadata };
        }
        catch (e) {
            return null;
        }
    }
    _getStaticSymbolOfIdentifier(node) {
        const sourceFile = node.getSourceFile();
        const resolvedImport = getImportOfIdentifier(this.typeChecker, node);
        if (!resolvedImport) {
            return null;
        }
        const moduleName = this.compilerHost.moduleNameToFileName(resolvedImport.importModule, sourceFile.fileName);
        if (!moduleName) {
            return null;
        }
        // Find the declaration symbol as symbols could be aliased due to
        // metadata re-exports.
        return this.compiler.reflector.findSymbolDeclaration(this.symbolResolver.getStaticSymbol(moduleName, resolvedImport.name));
    }
    /**
     * Disables that static symbols are resolved through summaries. Summaries
     * cannot be used for decorator analysis as decorators are omitted in summaries.
     */
    _disableSummaryResolution() {
        // We never want to resolve symbols through summaries. Summaries never contain
        // decorators for class symbols and therefore summaries will cause every class
        // to be considered as undecorated. See reason for this in: "ToJsonSerializer".
        // In order to ensure that metadata is not retrieved through summaries, we
        // need to disable summary resolution, clear previous symbol caches. This way
        // future calls to "StaticReflector#annotations" are based on metadata files.
        this.symbolResolver['_resolveSymbolFromSummary'] = () => null;
        this.symbolResolver['resolvedSymbols'].clear();
        this.symbolResolver['symbolFromFile'].clear();
        this.compiler.reflector['annotationCache'].clear();
        // Original summary resolver used by the AOT compiler.
        const summaryResolver = this.symbolResolver['summaryResolver'];
        // Additionally we need to ensure that no files are treated as "library" files when
        // resolving metadata. This is necessary because by default the symbol resolver discards
        // class metadata for library files. See "StaticSymbolResolver#createResolvedSymbol".
        // Patching this function **only** for the static symbol resolver ensures that metadata
        // is not incorrectly omitted. Note that we only want to do this for the symbol resolver
        // because otherwise we could break the summary loading logic which is used to detect
        // if a static symbol is either a directive, component or pipe (see MetadataResolver).
        this.symbolResolver['summaryResolver'] = {
            fromSummaryFileName: summaryResolver.fromSummaryFileName.bind(summaryResolver),
            addSummary: summaryResolver.addSummary.bind(summaryResolver),
            getImportAs: summaryResolver.getImportAs.bind(summaryResolver),
            getKnownModuleName: summaryResolver.getKnownModuleName.bind(summaryResolver),
            resolveSummary: summaryResolver.resolveSummary.bind(summaryResolver),
            toSummaryFileName: summaryResolver.toSummaryFileName.bind(summaryResolver),
            getSymbolsOf: summaryResolver.getSymbolsOf.bind(summaryResolver),
            isLibraryFile: () => false,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zY2hlbWF0aWNzL21pZ3JhdGlvbnMvdW5kZWNvcmF0ZWQtY2xhc3Nlcy13aXRoLWRpL3RyYW5zZm9ybS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztBQUlILE9BQU8sRUFBQyx1QkFBdUIsRUFBRSxpQkFBaUIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUN6RSxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDekQsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDL0QsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sMENBQTBDLENBQUM7QUFDaEYsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sMENBQTBDLENBQUM7QUFDbkYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFDLG9DQUFvQyxFQUFFLDRCQUE0QixFQUFDLE1BQU0sZ0RBQWdELENBQUM7QUFDbEksT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sd0NBQXdDLENBQUM7QUFDekUsT0FBTyxFQUFDLHFCQUFxQixFQUFFLHNCQUFzQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFnQnpGLE1BQU0sT0FBTywyQkFBMkI7SUFvQnRDLFlBQ1ksV0FBMkIsRUFBVSxRQUFxQixFQUMxRCxTQUEyQixFQUMzQixpQkFBd0Q7UUFGeEQsZ0JBQVcsR0FBWCxXQUFXLENBQWdCO1FBQVUsYUFBUSxHQUFSLFFBQVEsQ0FBYTtRQUMxRCxjQUFTLEdBQVQsU0FBUyxDQUFrQjtRQUMzQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQXVDO1FBdEI1RCxZQUFPLEdBQUcsRUFBRSxD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RUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO1NBQzNCLENBQUM7SUFDSixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBb3RDb21waWxlciwgQW90Q29tcGlsZXJIb3N0LCBDb21waWxlTWV0YWRhdGFSZXNvbHZlciwgU3RhdGljU3ltYm9sLCBTdGF0aWNTeW1ib2xSZXNvbHZlciwgU3VtbWFyeVJlc29sdmVyfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQge1BhcnRpYWxFdmFsdWF0b3J9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcGFydGlhbF9ldmFsdWF0b3InO1xuaW1wb3J0IHtDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgVmlld0VuY2Fwc3VsYXRpb259IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7SW1wb3J0TWFuYWdlcn0gZnJvbSAnLi4vLi4vdXRpbHMvaW1wb3J0X21hbmFnZXInO1xuaW1wb3J0IHtnZXRBbmd1bGFyRGVjb3JhdG9yc30gZnJvbSAnLi4vLi4vdXRpbHMvbmdfZGVjb3JhdG9ycyc7XG5pbXBvcnQge2hhc0V4cGxpY2l0Q29uc3RydWN0b3J9IGZyb20gJy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvY2xhc3NfZGVjbGFyYXRpb24nO1xuaW1wb3J0IHtmaW5kQmFzZUNsYXNzRGVjbGFyYXRpb25zfSBmcm9tICcuLi8uLi91dGlscy90eXBlc2NyaXB0L2ZpbmRfYmFzZV9jbGFzc2VzJztcbmltcG9ydCB7Z2V0SW1wb3J0T2ZJZGVudGlmaWVyfSBmcm9tICcuLi8uLi91dGlscy90eXBlc2NyaXB0L2ltcG9ydHMnO1xuXG5pbXBvcnQge2NvbnZlcnREaXJlY3RpdmVNZXRhZGF0YVRvRXhwcmVzc2lvbiwgVW5leHBlY3RlZE1ldGFkYXRhVmFsdWVFcnJvcn0gZnJvbSAnLi9kZWNvcmF0b3JfcmV3cml0ZS9jb252ZXJ0X2RpcmVjdGl2ZV9tZXRhZGF0YSc7XG5pbXBvcnQge0RlY29yYXRvclJld3JpdGVyfSBmcm9tICcuL2RlY29yYXRvcl9yZXdyaXRlL2RlY29yYXRvcl9yZXdyaXRlcic7XG5pbXBvcnQge2hhc0RpcmVjdGl2ZURlY29yYXRvciwgaGFzSW5qZWN0YWJsZURlY29yYXRvcn0gZnJvbSAnLi9uZ19kZWNsYXJhdGlvbl9jb2xsZWN0b3InO1xuaW1wb3J0IHtVcGRhdGVSZWNvcmRlcn0gZnJvbSAnLi91cGRhdGVfcmVjb3JkZXInO1xuXG5cblxuLyoqIFJlc29sdmVkIG1ldGFkYXRhIG9mIGEgZGVjbGFyYXRpb24uICovXG5pbnRlcmZhY2UgRGVjbGFyYXRpb25NZXRhZGF0YSB7XG4gIG1ldGFkYXRhOiBhbnk7XG4gIHR5cGU6ICdDb21wb25lbnQnfCdEaXJlY3RpdmUnfCdQaXBlJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUcmFuc2Zvcm1GYWlsdXJlIHtcbiAgbm9kZTogdHMuTm9kZTtcbiAgbWVzc2FnZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVW5kZWNvcmF0ZWRDbGFzc2VzVHJhbnNmb3JtIHtcbiAgcHJpdmF0ZSBwcmludGVyID0gdHMuY3JlYXRlUHJpbnRlcih7bmV3TGluZTogdHMuTmV3TGluZUtpbmQuTGluZUZlZWR9KTtcbiAgcHJpdmF0ZSBpbXBvcnRNYW5hZ2VyID0gbmV3IEltcG9ydE1hbmFnZXIodGhpcy5nZXRVcGRhdGVSZWNvcmRlciwgdGhpcy5wcmludGVyKTtcbiAgcHJpdmF0ZSBkZWNvcmF0b3JSZXdyaXRlciA9XG4gICAgICBuZXcgRGVjb3JhdG9yUmV3cml0ZXIodGhpcy5pbXBvcnRNYW5hZ2VyLCB0aGlzLnR5cGVDaGVja2VyLCB0aGlzLmV2YWx1YXRvciwgdGhpcy5jb21waWxlcik7XG5cbiAgcHJpdmF0ZSBjb21waWxlckhvc3Q6IEFvdENvbXBpbGVySG9zdDtcbiAgcHJpdmF0ZSBzeW1ib2xSZXNvbHZlcjogU3RhdGljU3ltYm9sUmVzb2x2ZXI7XG4gIHByaXZhdGUgbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXI7XG5cbiAgLyoqIFNldCBvZiBjbGFzcyBkZWNsYXJhdGlvbnMgd2hpY2ggaGF2ZSBiZWVuIGRlY29yYXRlZCB3aXRoIFwiQERpcmVjdGl2ZVwiLiAqL1xuICBwcml2YXRlIGRlY29yYXRlZERpcmVjdGl2ZXMgPSBuZXcgU2V0PHRzLkNsYXNzRGVjbGFyYXRpb24+KCk7XG4gIC8qKiBTZXQgb2YgY2xhc3MgZGVjbGFyYXRpb25zIHdoaWNoIGhhdmUgYmVlbiBkZWNvcmF0ZWQgd2l0aCBcIkBJbmplY3RhYmxlXCIgKi9cbiAgcHJpdmF0ZSBkZWNvcmF0ZWRQcm92aWRlcnMgPSBuZXcgU2V0PHRzLkNsYXNzRGVjbGFyYXRpb24+KCk7XG4gIC8qKlxuICAgKiBTZXQgb2YgY2xhc3MgZGVjbGFyYXRpb25zIHdoaWNoIGhhdmUgYmVlbiBhbmFseXplZCBhbmQgbmVlZCB0byBzcGVjaWZ5XG4gICAqIGFuIGV4cGxpY2l0IGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgcHJpdmF0ZSBtaXNzaW5nRXhwbGljaXRDb25zdHJ1Y3RvckNsYXNzZXMgPSBuZXcgU2V0PHRzLkNsYXNzRGVjbGFyYXRpb24+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlciwgcHJpdmF0ZSBjb21waWxlcjogQW90Q29tcGlsZXIsXG4gICAgICBwcml2YXRlIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcixcbiAgICAgIHByaXZhdGUgZ2V0VXBkYXRlUmVjb3JkZXI6IChzZjogdHMuU291cmNlRmlsZSkgPT4gVXBkYXRlUmVjb3JkZXIpIHtcbiAgICB0aGlzLnN5bWJvbFJlc29sdmVyID0gY29tcGlsZXJbJ19zeW1ib2xSZXNvbHZlciddO1xuICAgIHRoaXMuY29tcGlsZXJIb3N0ID0gY29tcGlsZXJbJ19ob3N0J107XG4gICAgdGhpcy5tZXRhZGF0YVJlc29sdmVyID0gY29tcGlsZXJbJ19tZXRhZGF0YVJlc29sdmVyJ107XG5cbiAgICAvLyBVbnNldCB0aGUgZGVmYXVsdCBlcnJvciByZWNvcmRlciBzbyB0aGF0IHRoZSByZWZsZWN0b3Igd2lsbCB0aHJvdyBhbiBleGNlcHRpb25cbiAgICAvLyBpZiBtZXRhZGF0YSBjYW5ub3QgYmUgcmVzb2x2ZWQuXG4gICAgdGhpcy5jb21waWxlci5yZWZsZWN0b3JbJ2Vycm9yUmVjb3JkZXInXSA9IHVuZGVmaW5lZDtcblxuICAgIC8vIERpc2FibGVzIHRoYXQgc3RhdGljIHN5bWJvbHMgYXJlIHJlc29sdmVkIHRocm91Z2ggc3VtbWFyaWVzIGZyb20gd2l0aGluIHRoZSBzdGF0aWNcbiAgICAvLyByZWZsZWN0b3IuIFN1bW1hcmllcyBjYW5ub3QgYmUgdXNlZCBmb3IgZGVjb3JhdG9yIHNlcmlhbGl6YXRpb24gYXMgZGVjb3JhdG9ycyBhcmVcbiAgICAvLyBvbWl0dGVkIGluIHN1bW1hcmllcyBhbmQgdGhlIGRlY29yYXRvciBjYW4ndCBiZSByZWNvbnN0cnVjdGVkIGZyb20gdGhlIGRpcmVjdGl2ZSBzdW1tYXJ5LlxuICAgIHRoaXMuX2Rpc2FibGVTdW1tYXJ5UmVzb2x1dGlvbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1pZ3JhdGVzIGRlY29yYXRlZCBkaXJlY3RpdmVzIHdoaWNoIGNhbiBwb3RlbnRpYWxseSBpbmhlcml0IGEgY29uc3RydWN0b3JcbiAgICogZnJvbSBhbiB1bmRlY29yYXRlZCBiYXNlIGNsYXNzLiBBbGwgYmFzZSBjbGFzc2VzIHVudGlsIHRoZSBmaXJzdCBvbmVcbiAgICogd2l0aCBhbiBleHBsaWNpdCBjb25zdHJ1Y3RvciB3aWxsIGJlIGRlY29yYXRlZCB3aXRoIHRoZSBhYnN0cmFjdCBcIkBEaXJlY3RpdmUoKVwiXG4gICAqIGRlY29yYXRvci4gU2VlIGNhc2UgMSBpbiB0aGUgbWlncmF0aW9uIHBsYW46IGh0dHBzOi8vaGFja21kLmlvL0BhbHgvUzFYS3FNWmVTXG4gICAqL1xuICBtaWdyYXRlRGVjb3JhdGVkRGlyZWN0aXZlcyhkaXJlY3RpdmVzOiB0cy5DbGFzc0RlY2xhcmF0aW9uW10pOiBUcmFuc2Zvcm1GYWlsdXJlW10ge1xuICAgIHJldHVybiBkaXJlY3RpdmVzLnJlZHVjZShcbiAgICAgICAgKGZhaWx1cmVzLCBub2RlKSA9PiBmYWlsdXJlcy5jb25jYXQodGhpcy5fbWlncmF0ZURpcmVjdGl2ZUJhc2VDbGFzcyhub2RlKSksXG4gICAgICAgIFtdIGFzIFRyYW5zZm9ybUZhaWx1cmVbXSk7XG4gIH1cblxuICAvKipcbiAgICogTWlncmF0ZXMgZGVjb3JhdGVkIHByb3ZpZGVycyB3aGljaCBjYW4gcG90ZW50aWFsbHkgaW5oZXJpdCBhIGNvbnN0cnVjdG9yXG4gICAqIGZyb20gYW4gdW5kZWNvcmF0ZWQgYmFzZSBjbGFzcy4gQWxsIGJhc2UgY2xhc3NlcyB1bnRpbCB0aGUgZmlyc3Qgb25lXG4gICAqIHdpdGggYW4gZXhwbGljaXQgY29uc3RydWN0b3Igd2lsbCBiZSBkZWNvcmF0ZWQgd2l0aCB0aGUgXCJASW5qZWN0YWJsZSgpXCIuXG4gICAqL1xuICBtaWdyYXRlRGVjb3JhdGVkUHJvdmlkZXJzKHByb3ZpZGVyczogdHMuQ2xhc3NEZWNsYXJhdGlvbltdKTogVHJhbnNmb3JtRmFpbHVyZVtdIHtcbiAgICByZXR1cm4gcHJvdmlkZXJzLnJlZHVjZShcbiAgICAgICAgKGZhaWx1cmVzLCBub2RlKSA9PiBmYWlsdXJlcy5jb25jYXQodGhpcy5fbWlncmF0ZVByb3ZpZGVyQmFzZUNsYXNzKG5vZGUpKSxcbiAgICAgICAgW10gYXMgVHJhbnNmb3JtRmFpbHVyZVtdKTtcbiAgfVxuXG4gIHByaXZhdGUgX21pZ3JhdGVQcm92aWRlckJhc2VDbGFzcyhub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogVHJhbnNmb3JtRmFpbHVyZVtdIHtcbiAgICByZXR1cm4gdGhpcy5fbWlncmF0ZURlY29yYXRlZENsYXNzV2l0aEluaGVyaXRlZEN0b3IoXG4gICAgICAgIG5vZGUsIHN5bWJvbCA9PiB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIuaXNJbmplY3RhYmxlKHN5bWJvbCksXG4gICAgICAgIG5vZGUgPT4gdGhpcy5fYWRkSW5qZWN0YWJsZURlY29yYXRvcihub2RlKSk7XG4gIH1cblxuICBwcml2YXRlIF9taWdyYXRlRGlyZWN0aXZlQmFzZUNsYXNzKG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBUcmFuc2Zvcm1GYWlsdXJlW10ge1xuICAgIHJldHVybiB0aGlzLl9taWdyYXRlRGVjb3JhdGVkQ2xhc3NXaXRoSW5oZXJpdGVkQ3RvcihcbiAgICAgICAgbm9kZSwgc3ltYm9sID0+IHRoaXMubWV0YWRhdGFSZXNvbHZlci5pc0RpcmVjdGl2ZShzeW1ib2wpLFxuICAgICAgICBub2RlID0+IHRoaXMuX2FkZEFic3RyYWN0RGlyZWN0aXZlRGVjb3JhdG9yKG5vZGUpKTtcbiAgfVxuXG5cbiAgcHJpdmF0ZSBfbWlncmF0ZURlY29yYXRlZENsYXNzV2l0aEluaGVyaXRlZEN0b3IoXG4gICAgICBub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uLCBpc0NsYXNzRGVjb3JhdGVkOiAoc3ltYm9sOiBTdGF0aWNTeW1ib2wpID0+IGJvb2xlYW4sXG4gICAgICBhZGRDbGFzc0RlY29yYXRvcjogKG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pID0+IHZvaWQpOiBUcmFuc2Zvcm1GYWlsdXJlW10ge1xuICAgIC8vIEluIGNhc2UgdGhlIHByb3ZpZGVyIGhhcyBhbiBleHBsaWNpdCBjb25zdHJ1Y3Rvciwgd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZ1xuICAgIC8vIGJlY2F1c2UgdGhlIGNsYXNzIGlzIGFscmVhZHkgZGVjb3JhdGVkIGFuZCBkb2VzIG5vdCBpbmhlcml0IGEgY29uc3RydWN0b3IuXG4gICAgaWYgKGhhc0V4cGxpY2l0Q29uc3RydWN0b3Iobm9kZSkpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBvcmRlcmVkQmFzZUNsYXNzZXMgPSBmaW5kQmFzZUNsYXNzRGVjbGFyYXRpb25zKG5vZGUsIHRoaXMudHlwZUNoZWNrZXIpO1xuICAgIGNvbnN0IHVuZGVjb3JhdGVkQmFzZUNsYXNzZXM6IHRzLkNsYXNzRGVjbGFyYXRpb25bXSA9IFtdO1xuXG4gICAgZm9yIChsZXQge25vZGU6IGJhc2VDbGFzcywgaWRlbnRpZmllcn0gb2Ygb3JkZXJlZEJhc2VDbGFzc2VzKSB7XG4gICAgICBjb25zdCBiYXNlQ2xhc3NGaWxlID0gYmFzZUNsYXNzLmdldFNvdXJjZUZpbGUoKTtcblxuICAgICAgaWYgKGhhc0V4cGxpY2l0Q29uc3RydWN0b3IoYmFzZUNsYXNzKSkge1xuICAgICAgICAvLyBBbGwgY2xhc3NlcyBpbiBiZXR3ZWVuIHRoZSBkZWNvcmF0ZWQgY2xhc3MgYW5kIHRoZSB1bmRlY29yYXRlZCBjbGFzc1xuICAgICAgICAvLyB0aGF0IGRlZmluZXMgdGhlIGNvbnN0cnVjdG9yIG5lZWQgdG8gYmUgZGVjb3JhdGVkIGFzIHdlbGwuXG4gICAgICAgIHVuZGVjb3JhdGVkQmFzZUNsYXNzZXMuZm9yRWFjaChiID0+IGFkZENsYXNzRGVjb3JhdG9yKGIpKTtcblxuICAgICAgICBpZiAoYmFzZUNsYXNzRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICAgIGNvbnN0IHN0YXRpY1N5bWJvbCA9IHRoaXMuX2dldFN0YXRpY1N5bWJvbE9mSWRlbnRpZmllcihpZGVudGlmaWVyKTtcblxuICAgICAgICAgIC8vIElmIHRoZSBiYXNlIGNsYXNzIGlzIGRlY29yYXRlZCB0aHJvdWdoIG1ldGFkYXRhIGZpbGVzLCB3ZSBkb24ndFxuICAgICAgICAgIC8vIG5lZWQgdG8gYWRkIGEgY29tbWVudCB0byB0aGUgZGVyaXZlZCBjbGFzcyBmb3IgdGhlIGV4dGVybmFsIGJhc2UgY2xhc3MuXG4gICAgICAgICAgaWYgKHN0YXRpY1N5bWJvbCAmJiBpc0NsYXNzRGVjb3JhdGVkKHN0YXRpY1N5bWJvbCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEZpbmQgdGhlIGxhc3QgY2xhc3MgaW4gdGhlIGluaGVyaXRhbmNlIGNoYWluIHRoYXQgaXMgZGVjb3JhdGVkIGFuZCB3aWxsIGJlXG4gICAgICAgICAgLy8gdXNlZCBhcyBhbmNob3IgZm9yIGEgY29tbWVudCBleHBsYWluaW5nIHRoYXQgdGhlIGNsYXNzIHRoYXQgZGVmaW5lcyB0aGVcbiAgICAgICAgICAvLyBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgZGVjb3JhdGVkIGF1dG9tYXRpY2FsbHkuXG4gICAgICAgICAgY29uc3QgbGFzdERlY29yYXRlZENsYXNzID1cbiAgICAgICAgICAgICAgdW5kZWNvcmF0ZWRCYXNlQ2xhc3Nlc1t1bmRlY29yYXRlZEJhc2VDbGFzc2VzLmxlbmd0aCAtIDFdIHx8IG5vZGU7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX2FkZE1pc3NpbmdFeHBsaWNpdENvbnN0cnVjdG9yVG9kbyhsYXN0RGVjb3JhdGVkQ2xhc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGVjb3JhdGUgdGhlIGNsYXNzIHRoYXQgZGVmaW5lcyB0aGUgY29uc3RydWN0b3IgdGhhdCBpcyBpbmhlcml0ZWQuXG4gICAgICAgIGFkZENsYXNzRGVjb3JhdG9yKGJhc2VDbGFzcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGNsYXNzIGRlY29yYXRvciBmb3IgYWxsIGJhc2UgY2xhc3NlcyBpbiB0aGUgaW5oZXJpdGFuY2UgY2hhaW4gdW50aWxcbiAgICAgIC8vIHRoZSBiYXNlIGNsYXNzIHdpdGggdGhlIGV4cGxpY2l0IGNvbnN0cnVjdG9yLiBUaGUgZGVjb3JhdG9yIHdpbGwgYmUgb25seVxuICAgICAgLy8gYWRkZWQgZm9yIGJhc2UgY2xhc3NlcyB3aGljaCBjYW4gYmUgbW9kaWZpZWQuXG4gICAgICBpZiAoIWJhc2VDbGFzc0ZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgdW5kZWNvcmF0ZWRCYXNlQ2xhc3Nlcy5wdXNoKGJhc2VDbGFzcyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIHRoZSBhYnN0cmFjdCBcIkBEaXJlY3RpdmUoKVwiIGRlY29yYXRvciB0byB0aGUgZ2l2ZW4gY2xhc3MgaW4gY2FzZSB0aGVyZVxuICAgKiBpcyBubyBleGlzdGluZyBkaXJlY3RpdmUgZGVjb3JhdG9yLlxuICAgKi9cbiAgcHJpdmF0ZSBfYWRkQWJzdHJhY3REaXJlY3RpdmVEZWNvcmF0b3IoYmFzZUNsYXNzOiB0cy5DbGFzc0RlY2xhcmF0aW9uKSB7XG4gICAgaWYgKGhhc0RpcmVjdGl2ZURlY29yYXRvcihiYXNlQ2xhc3MsIHRoaXMudHlwZUNoZWNrZXIpIHx8XG4gICAgICAgIHRoaXMuZGVjb3JhdGVkRGlyZWN0aXZlcy5oYXMoYmFzZUNsYXNzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJhc2VDbGFzc0ZpbGUgPSBiYXNlQ2xhc3MuZ2V0U291cmNlRmlsZSgpO1xuICAgIGNvbnN0IHJlY29yZGVyID0gdGhpcy5nZXRVcGRhdGVSZWNvcmRlcihiYXNlQ2xhc3NGaWxlKTtcbiAgICBjb25zdCBkaXJlY3RpdmVFeHByID1cbiAgICAgICAgdGhpcy5pbXBvcnRNYW5hZ2VyLmFkZEltcG9ydFRvU291cmNlRmlsZShiYXNlQ2xhc3NGaWxlLCAnRGlyZWN0aXZlJywgJ0Bhbmd1bGFyL2NvcmUnKTtcblxuICAgIGNvbnN0IG5ld0RlY29yYXRvciA9IHRzLmNyZWF0ZURlY29yYXRvcih0cy5jcmVhdGVDYWxsKGRpcmVjdGl2ZUV4cHIsIHVuZGVmaW5lZCwgW10pKTtcbiAgICBjb25zdCBuZXdEZWNvcmF0b3JUZXh0ID1cbiAgICAgICAgdGhpcy5wcmludGVyLnByaW50Tm9kZSh0cy5FbWl0SGludC5VbnNwZWNpZmllZCwgbmV3RGVjb3JhdG9yLCBiYXNlQ2xhc3NGaWxlKTtcblxuICAgIHJlY29yZGVyLmFkZENsYXNzRGVjb3JhdG9yKGJhc2VDbGFzcywgbmV3RGVjb3JhdG9yVGV4dCk7XG4gICAgdGhpcy5kZWNvcmF0ZWREaXJlY3RpdmVzLmFkZChiYXNlQ2xhc3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgdGhlIGFic3RyYWN0IFwiQEluamVjdGFibGUoKVwiIGRlY29yYXRvciB0byB0aGUgZ2l2ZW4gY2xhc3MgaW4gY2FzZSB0aGVyZVxuICAgKiBpcyBubyBleGlzdGluZyBkaXJlY3RpdmUgZGVjb3JhdG9yLlxuICAgKi9cbiAgcHJpdmF0ZSBfYWRkSW5qZWN0YWJsZURlY29yYXRvcihiYXNlQ2xhc3M6IHRzLkNsYXNzRGVjbGFyYXRpb24pIHtcbiAgICBpZiAoaGFzSW5qZWN0YWJsZURlY29yYXRvcihiYXNlQ2xhc3MsIHRoaXMudHlwZUNoZWNrZXIpIHx8XG4gICAgICAgIHRoaXMuZGVjb3JhdGVkUHJvdmlkZXJzLmhhcyhiYXNlQ2xhc3MpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYmFzZUNsYXNzRmlsZSA9IGJhc2VDbGFzcy5nZXRTb3VyY2VGaWxlKCk7XG4gICAgY29uc3QgcmVjb3JkZXIgPSB0aGlzLmdldFVwZGF0ZVJlY29yZGVyKGJhc2VDbGFzc0ZpbGUpO1xuICAgIGNvbnN0IGluamVjdGFibGVFeHByID1cbiAgICAgICAgdGhpcy5pbXBvcnRNYW5hZ2VyLmFkZEltcG9ydFRvU291cmNlRmlsZShiYXNlQ2xhc3NGaWxlLCAnSW5qZWN0YWJsZScsICdAYW5ndWxhci9jb3JlJyk7XG5cbiAgICBjb25zdCBuZXdEZWNvcmF0b3IgPSB0cy5jcmVhdGVEZWNvcmF0b3IodHMuY3JlYXRlQ2FsbChpbmplY3RhYmxlRXhwciwgdW5kZWZpbmVkLCBbXSkpO1xuICAgIGNvbnN0IG5ld0RlY29yYXRvclRleHQgPVxuICAgICAgICB0aGlzLnByaW50ZXIucHJpbnROb2RlKHRzLkVtaXRIaW50LlVuc3BlY2lmaWVkLCBuZXdEZWNvcmF0b3IsIGJhc2VDbGFzc0ZpbGUpO1xuXG4gICAgcmVjb3JkZXIuYWRkQ2xhc3NEZWNvcmF0b3IoYmFzZUNsYXNzLCBuZXdEZWNvcmF0b3JUZXh0KTtcbiAgICB0aGlzLmRlY29yYXRlZFByb3ZpZGVycy5hZGQoYmFzZUNsYXNzKTtcbiAgfVxuXG4gIC8qKiBBZGRzIGEgY29tbWVudCBmb3IgYWRkaW5nIGFuIGV4cGxpY2l0IGNvbnN0cnVjdG9yIHRvIHRoZSBnaXZlbiBjbGFzcyBkZWNsYXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBfYWRkTWlzc2luZ0V4cGxpY2l0Q29uc3RydWN0b3JUb2RvKG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBUcmFuc2Zvcm1GYWlsdXJlW10ge1xuICAgIC8vIEluIGNhc2UgYSB0b2RvIGNvbW1lbnQgaGFzIGJlZW4gYWxyZWFkeSBpbnNlcnRlZCB0byB0aGUgZ2l2ZW4gY2xhc3MsIHdlIGRvbid0XG4gICAgLy8gd2FudCB0byBhZGQgYSBjb21tZW50IG9yIHRyYW5zZm9ybSBmYWlsdXJlIG11bHRpcGxlIHRpbWVzLlxuICAgIGlmICh0aGlzLm1pc3NpbmdFeHBsaWNpdENvbnN0cnVjdG9yQ2xhc3Nlcy5oYXMobm9kZSkpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdGhpcy5taXNzaW5nRXhwbGljaXRDb25zdHJ1Y3RvckNsYXNzZXMuYWRkKG5vZGUpO1xuICAgIGNvbnN0IHJlY29yZGVyID0gdGhpcy5nZXRVcGRhdGVSZWNvcmRlcihub2RlLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgcmVjb3JkZXIuYWRkQ2xhc3NDb21tZW50KG5vZGUsICdUT0RPOiBhZGQgZXhwbGljaXQgY29uc3RydWN0b3InKTtcbiAgICByZXR1cm4gW3tub2RlOiBub2RlLCBtZXNzYWdlOiAnQ2xhc3MgbmVlZHMgdG8gZGVjbGFyZSBhbiBleHBsaWNpdCBjb25zdHJ1Y3Rvci4nfV07XG4gIH1cblxuICAvKipcbiAgICogTWlncmF0ZXMgdW5kZWNvcmF0ZWQgZGlyZWN0aXZlcyB3aGljaCB3ZXJlIHJlZmVyZW5jZWQgaW4gTmdNb2R1bGUgZGVjbGFyYXRpb25zLlxuICAgKiBUaGVzZSBkaXJlY3RpdmVzIGluaGVyaXQgdGhlIG1ldGFkYXRhIGZyb20gYSBwYXJlbnQgYmFzZSBjbGFzcywgYnV0IHdpdGggSXZ5XG4gICAqIHRoZXNlIGNsYXNzZXMgbmVlZCB0byBleHBsaWNpdGx5IGhhdmUgYSBkZWNvcmF0b3IgZm9yIGxvY2FsaXR5LiBUaGUgbWlncmF0aW9uXG4gICAqIGRldGVybWluZXMgdGhlIGluaGVyaXRlZCBkZWNvcmF0b3IgYW5kIGNvcGllcyBpdCB0byB0aGUgdW5kZWNvcmF0ZWQgZGVjbGFyYXRpb24uXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGUgbWlncmF0aW9uIHNlcmlhbGl6ZXMgdGhlIG1ldGFkYXRhIGZvciBleHRlcm5hbCBkZWNsYXJhdGlvbnNcbiAgICogd2hlcmUgdGhlIGRlY29yYXRvciBpcyBub3QgcGFydCBvZiB0aGUgc291cmNlIGZpbGUgQVNULlxuICAgKlxuICAgKiBTZWUgY2FzZSAyIGluIHRoZSBtaWdyYXRpb24gcGxhbjogaHR0cHM6Ly9oYWNrbWQuaW8vQGFseC9TMVhLcU1aZVNcbiAgICovXG4gIG1pZ3JhdGVVbmRlY29yYXRlZERlY2xhcmF0aW9ucyhkaXJlY3RpdmVzOiB0cy5DbGFzc0RlY2xhcmF0aW9uW10pOiBUcmFuc2Zvcm1GYWlsdXJlW10ge1xuICAgIHJldHVybiBkaXJlY3RpdmVzLnJlZHVjZShcbiAgICAgICAgKGZhaWx1cmVzLCBub2RlKSA9PiBmYWlsdXJlcy5jb25jYXQodGhpcy5fbWlncmF0ZURlcml2ZWREZWNsYXJhdGlvbihub2RlKSksXG4gICAgICAgIFtdIGFzIFRyYW5zZm9ybUZhaWx1cmVbXSk7XG4gIH1cblxuICBwcml2YXRlIF9taWdyYXRlRGVyaXZlZERlY2xhcmF0aW9uKG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBUcmFuc2Zvcm1GYWlsdXJlW10ge1xuICAgIGNvbnN0IHRhcmdldFNvdXJjZUZpbGUgPSBub2RlLmdldFNvdXJjZUZpbGUoKTtcbiAgICBjb25zdCBvcmRlcmVkQmFzZUNsYXNzZXMgPSBmaW5kQmFzZUNsYXNzRGVjbGFyYXRpb25zKG5vZGUsIHRoaXMudHlwZUNoZWNrZXIpO1xuICAgIGxldCBuZXdEZWNvcmF0b3JUZXh0OiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGxldCB7bm9kZTogYmFzZUNsYXNzLCBpZGVudGlmaWVyfSBvZiBvcmRlcmVkQmFzZUNsYXNzZXMpIHtcbiAgICAgIC8vIEJlZm9yZSBsb29raW5nIGZvciBkZWNvcmF0b3JzIHdpdGhpbiB0aGUgbWV0YWRhdGEgb3Igc3VtbWFyeSBmaWxlcywgd2VcbiAgICAgIC8vIHRyeSB0byBkZXRlcm1pbmUgdGhlIGRpcmVjdGl2ZSBkZWNvcmF0b3IgdGhyb3VnaCB0aGUgc291cmNlIGZpbGUgQVNULlxuICAgICAgaWYgKGJhc2VDbGFzcy5kZWNvcmF0b3JzKSB7XG4gICAgICAgIGNvbnN0IG5nRGVjb3JhdG9yID1cbiAgICAgICAgICAgIGdldEFuZ3VsYXJEZWNvcmF0b3JzKHRoaXMudHlwZUNoZWNrZXIsIGJhc2VDbGFzcy5kZWNvcmF0b3JzKVxuICAgICAgICAgICAgICAgIC5maW5kKCh7bmFtZX0pID0+IG5hbWUgPT09ICdDb21wb25lbnQnIHx8IG5hbWUgPT09ICdEaXJlY3RpdmUnIHx8IG5hbWUgPT09ICdQaXBlJyk7XG5cbiAgICAgICAgaWYgKG5nRGVjb3JhdG9yKSB7XG4gICAgICAgICAgY29uc3QgbmV3RGVjb3JhdG9yID0gdGhpcy5kZWNvcmF0b3JSZXdyaXRlci5yZXdyaXRlKG5nRGVjb3JhdG9yLCBub2RlLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgICAgICAgbmV3RGVjb3JhdG9yVGV4dCA9IHRoaXMucHJpbnRlci5wcmludE5vZGUoXG4gICAgICAgICAgICAgIHRzLkVtaXRIaW50LlVuc3BlY2lmaWVkLCBuZXdEZWNvcmF0b3IsIG5nRGVjb3JhdG9yLm5vZGUuZ2V0U291cmNlRmlsZSgpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJZiBubyBtZXRhZGF0YSBjb3VsZCBiZSBmb3VuZCB3aXRoaW4gdGhlIHNvdXJjZS1maWxlIEFTVCwgdHJ5IHRvIGZpbmRcbiAgICAgIC8vIGRlY29yYXRvciBkYXRhIHRocm91Z2ggQW5ndWxhciBtZXRhZGF0YSBhbmQgc3VtbWFyeSBmaWxlcy5cbiAgICAgIGNvbnN0IHN0YXRpY1N5bWJvbCA9IHRoaXMuX2dldFN0YXRpY1N5bWJvbE9mSWRlbnRpZmllcihpZGVudGlmaWVyKTtcblxuICAgICAgLy8gQ2hlY2sgaWYgdGhlIHN0YXRpYyBzeW1ib2wgcmVzb2x2ZXMgdG8gYSBjbGFzcyBkZWNsYXJhdGlvbiB3aXRoXG4gICAgICAvLyBwaXBlIG9yIGRpcmVjdGl2ZSBtZXRhZGF0YS5cbiAgICAgIGlmICghc3RhdGljU3ltYm9sIHx8XG4gICAgICAgICAgISh0aGlzLm1ldGFkYXRhUmVzb2x2ZXIuaXNQaXBlKHN0YXRpY1N5bWJvbCkgfHxcbiAgICAgICAgICAgIHRoaXMubWV0YWRhdGFSZXNvbHZlci5pc0RpcmVjdGl2ZShzdGF0aWNTeW1ib2wpKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLl9yZXNvbHZlRGVjbGFyYXRpb25NZXRhZGF0YShzdGF0aWNTeW1ib2wpO1xuXG4gICAgICAvLyBJZiBubyBtZXRhZGF0YSBjb3VsZCBiZSByZXNvbHZlZCBmb3IgdGhlIHN0YXRpYyBzeW1ib2wsIHByaW50IGEgZmFpbHVyZSBtZXNzYWdlXG4gICAgICAvLyBhbmQgYXNrIHRoZSBkZXZlbG9wZXIgdG8gbWFudWFsbHkgbWlncmF0ZSB0aGUgY2xhc3MuIFRoaXMgY2FzZSBpcyByYXJlIGJlY2F1c2VcbiAgICAgIC8vIHVzdWFsbHkgZGVjb3JhdG9yIG1ldGFkYXRhIGlzIGFsd2F5cyBwcmVzZW50IGJ1dCBqdXN0IGNhbid0IGJlIHJlYWQgaWYgYSBwcm9ncmFtXG4gICAgICAvLyBvbmx5IGhhcyBhY2Nlc3MgdG8gc3VtbWFyaWVzICh0aGlzIGlzIGEgc3BlY2lhbCBjYXNlIGluIGdvb2dsZTMpLlxuICAgICAgaWYgKCFtZXRhZGF0YSkge1xuICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICBub2RlLFxuICAgICAgICAgIG1lc3NhZ2U6IGBDbGFzcyBjYW5ub3QgYmUgbWlncmF0ZWQgYXMgdGhlIGluaGVyaXRlZCBtZXRhZGF0YSBmcm9tIGAgK1xuICAgICAgICAgICAgICBgJHtpZGVudGlmaWVyLmdldFRleHQoKX0gY2Fubm90IGJlIGNvbnZlcnRlZCBpbnRvIGEgZGVjb3JhdG9yLiBQbGVhc2UgbWFudWFsbHlcbiAgICAgICAgICAgIGRlY29yYXRlIHRoZSBjbGFzcy5gLFxuICAgICAgICB9XTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3RGVjb3JhdG9yID0gdGhpcy5fY29uc3RydWN0RGVjb3JhdG9yRnJvbU1ldGFkYXRhKG1ldGFkYXRhLCB0YXJnZXRTb3VyY2VGaWxlKTtcbiAgICAgIGlmICghbmV3RGVjb3JhdG9yKSB7XG4gICAgICAgIGNvbnN0IGFubm90YXRpb25UeXBlID0gbWV0YWRhdGEudHlwZTtcbiAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgbm9kZSxcbiAgICAgICAgICBtZXNzYWdlOiBgQ2xhc3MgY2Fubm90IGJlIG1pZ3JhdGVkIGFzIHRoZSBpbmhlcml0ZWQgQCR7YW5ub3RhdGlvblR5cGV9IGRlY29yYXRvciBgICtcbiAgICAgICAgICAgICAgYGNhbm5vdCBiZSBjb3BpZWQuIFBsZWFzZSBtYW51YWxseSBhZGQgYSBAJHthbm5vdGF0aW9uVHlwZX0gZGVjb3JhdG9yLmAsXG4gICAgICAgIH1dO1xuICAgICAgfVxuXG4gICAgICAvLyBJbiBjYXNlIHRoZSBkZWNvcmF0b3IgY291bGQgYmUgY29uc3RydWN0ZWQgZnJvbSB0aGUgcmVzb2x2ZWQgbWV0YWRhdGEsIHVzZVxuICAgICAgLy8gdGhhdCBkZWNvcmF0b3IgZm9yIHRoZSBkZXJpdmVkIHVuZGVjb3JhdGVkIGNsYXNzZXMuXG4gICAgICBuZXdEZWNvcmF0b3JUZXh0ID1cbiAgICAgICAgICB0aGlzLnByaW50ZXIucHJpbnROb2RlKHRzLkVtaXRIaW50LlVuc3BlY2lmaWVkLCBuZXdEZWNvcmF0b3IsIHRhcmdldFNvdXJjZUZpbGUpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKCFuZXdEZWNvcmF0b3JUZXh0KSB7XG4gICAgICByZXR1cm4gW3tcbiAgICAgICAgbm9kZSxcbiAgICAgICAgbWVzc2FnZTpcbiAgICAgICAgICAgICdDbGFzcyBjYW5ub3QgYmUgbWlncmF0ZWQgYXMgbm8gZGlyZWN0aXZlL2NvbXBvbmVudC9waXBlIG1ldGFkYXRhIGNvdWxkIGJlIGZvdW5kLiAnICtcbiAgICAgICAgICAgICdQbGVhc2UgbWFudWFsbHkgYWRkIGEgQERpcmVjdGl2ZSwgQENvbXBvbmVudCBvciBAUGlwZSBkZWNvcmF0b3IuJ1xuICAgICAgfV07XG4gICAgfVxuXG4gICAgdGhpcy5nZXRVcGRhdGVSZWNvcmRlcih0YXJnZXRTb3VyY2VGaWxlKS5hZGRDbGFzc0RlY29yYXRvcihub2RlLCBuZXdEZWNvcmF0b3JUZXh0KTtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICAvKiogUmVjb3JkcyBhbGwgY2hhbmdlcyB0aGF0IHdlcmUgbWFkZSBpbiB0aGUgaW1wb3J0IG1hbmFnZXIuICovXG4gIHJlY29yZENoYW5nZXMoKSB7XG4gICAgdGhpcy5pbXBvcnRNYW5hZ2VyLnJlY29yZENoYW5nZXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGEgVHlwZVNjcmlwdCBkZWNvcmF0b3Igbm9kZSBmcm9tIHRoZSBzcGVjaWZpZWQgZGVjbGFyYXRpb24gbWV0YWRhdGEuIFJldHVybnNcbiAgICogbnVsbCBpZiB0aGUgbWV0YWRhdGEgY291bGQgbm90IGJlIHNpbXBsaWZpZWQvcmVzb2x2ZWQuXG4gICAqL1xuICBwcml2YXRlIF9jb25zdHJ1Y3REZWNvcmF0b3JGcm9tTWV0YWRhdGEoXG4gICAgICBkaXJlY3RpdmVNZXRhZGF0YTogRGVjbGFyYXRpb25NZXRhZGF0YSwgdGFyZ2V0U291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IHRzLkRlY29yYXRvcnxudWxsIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGVjb3JhdG9yRXhwciA9IGNvbnZlcnREaXJlY3RpdmVNZXRhZGF0YVRvRXhwcmVzc2lvbihcbiAgICAgICAgICBkaXJlY3RpdmVNZXRhZGF0YS5tZXRhZGF0YSxcbiAgICAgICAgICBzdGF0aWNTeW1ib2wgPT5cbiAgICAgICAgICAgICAgdGhpcy5jb21waWxlckhvc3RcbiAgICAgICAgICAgICAgICAgIC5maWxlTmFtZVRvTW9kdWxlTmFtZShzdGF0aWNTeW1ib2wuZmlsZVBhdGgsIHRhcmdldFNvdXJjZUZpbGUuZmlsZU5hbWUpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFwvaW5kZXgkLywgJycpLFxuICAgICAgICAgIChtb2R1bGVOYW1lOiBzdHJpbmcsIG5hbWU6IHN0cmluZykgPT5cbiAgICAgICAgICAgICAgdGhpcy5pbXBvcnRNYW5hZ2VyLmFkZEltcG9ydFRvU291cmNlRmlsZSh0YXJnZXRTb3VyY2VGaWxlLCBuYW1lLCBtb2R1bGVOYW1lKSxcbiAgICAgICAgICAocHJvcGVydHlOYW1lLCB2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgLy8gT25seSBub3JtYWxpemUgcHJvcGVydGllcyBjYWxsZWQgXCJjaGFuZ2VEZXRlY3Rpb25cIiBhbmQgXCJlbmNhcHN1bGF0aW9uXCJcbiAgICAgICAgICAgIC8vIGZvciBcIkBEaXJlY3RpdmVcIiBhbmQgXCJAQ29tcG9uZW50XCIgYW5ub3RhdGlvbnMuXG4gICAgICAgICAgICBpZiAoZGlyZWN0aXZlTWV0YWRhdGEudHlwZSA9PT0gJ1BpcGUnKSB7XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJbnN0ZWFkIG9mIHVzaW5nIHRoZSBudW1iZXIgYXMgdmFsdWUgZm9yIHRoZSBcImNoYW5nZURldGVjdGlvblwiIGFuZFxuICAgICAgICAgICAgLy8gXCJlbmNhcHN1bGF0aW9uXCIgcHJvcGVydGllcywgd2Ugd2FudCB0byB1c2UgdGhlIGFjdHVhbCBlbnVtIHN5bWJvbHMuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlOYW1lID09PSAnY2hhbmdlRGV0ZWN0aW9uJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhcbiAgICAgICAgICAgICAgICAgIHRoaXMuaW1wb3J0TWFuYWdlci5hZGRJbXBvcnRUb1NvdXJjZUZpbGUoXG4gICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0U291cmNlRmlsZSwgJ0NoYW5nZURldGVjdGlvblN0cmF0ZWd5JywgJ0Bhbmd1bGFyL2NvcmUnKSxcbiAgICAgICAgICAgICAgICAgIENoYW5nZURldGVjdGlvblN0cmF0ZWd5W3ZhbHVlXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZSA9PT0gJ2VuY2Fwc3VsYXRpb24nICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKFxuICAgICAgICAgICAgICAgICAgdGhpcy5pbXBvcnRNYW5hZ2VyLmFkZEltcG9ydFRvU291cmNlRmlsZShcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRTb3VyY2VGaWxlLCAnVmlld0VuY2Fwc3VsYXRpb24nLCAnQGFuZ3VsYXIvY29yZScpLFxuICAgICAgICAgICAgICAgICAgVmlld0VuY2Fwc3VsYXRpb25bdmFsdWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdHMuY3JlYXRlRGVjb3JhdG9yKHRzLmNyZWF0ZUNhbGwoXG4gICAgICAgICAgdGhpcy5pbXBvcnRNYW5hZ2VyLmFkZEltcG9ydFRvU291cmNlRmlsZShcbiAgICAgICAgICAgICAgdGFyZ2V0U291cmNlRmlsZSwgZGlyZWN0aXZlTWV0YWRhdGEudHlwZSwgJ0Bhbmd1bGFyL2NvcmUnKSxcbiAgICAgICAgICB1bmRlZmluZWQsIFtkZWNvcmF0b3JFeHByXSkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgVW5leHBlY3RlZE1ldGFkYXRhVmFsdWVFcnJvcikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc29sdmVzIHRoZSBkZWNsYXJhdGlvbiBtZXRhZGF0YSBvZiBhIGdpdmVuIHN0YXRpYyBzeW1ib2wuIFRoZSBtZXRhZGF0YVxuICAgKiBpcyBkZXRlcm1pbmVkIGJ5IHJlc29sdmluZyBtZXRhZGF0YSBmb3IgdGhlIHN0YXRpYyBzeW1ib2wuXG4gICAqL1xuICBwcml2YXRlIF9yZXNvbHZlRGVjbGFyYXRpb25NZXRhZGF0YShzeW1ib2w6IFN0YXRpY1N5bWJvbCk6IG51bGx8RGVjbGFyYXRpb25NZXRhZGF0YSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGUgdGhhdCB0aGlzIGNhbGwgY2FuIHRocm93IGlmIHRoZSBtZXRhZGF0YSBpcyBub3QgY29tcHV0YWJsZS4gSW4gdGhhdFxuICAgICAgLy8gY2FzZSB3ZSBhcmUgbm90IGFibGUgdG8gc2VyaWFsaXplIHRoZSBtZXRhZGF0YSBpbnRvIGEgZGVjb3JhdG9yIGFuZCB3ZSByZXR1cm5cbiAgICAgIC8vIG51bGwuXG4gICAgICBjb25zdCBhbm5vdGF0aW9ucyA9IHRoaXMuY29tcGlsZXIucmVmbGVjdG9yLmFubm90YXRpb25zKHN5bWJvbCkuZmluZChcbiAgICAgICAgICBzID0+IHMubmdNZXRhZGF0YU5hbWUgPT09ICdDb21wb25lbnQnIHx8IHMubmdNZXRhZGF0YU5hbWUgPT09ICdEaXJlY3RpdmUnIHx8XG4gICAgICAgICAgICAgIHMubmdNZXRhZGF0YU5hbWUgPT09ICdQaXBlJyk7XG5cbiAgICAgIGlmICghYW5ub3RhdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHtuZ01ldGFkYXRhTmFtZSwgLi4ubWV0YWRhdGF9ID0gYW5ub3RhdGlvbnM7XG5cbiAgICAgIC8vIERlbGV0ZSB0aGUgXCJuZ01ldGFkYXRhTmFtZVwiIHByb3BlcnR5IGFzIHdlIGRvbid0IHdhbnQgdG8gZ2VuZXJhdGVcbiAgICAgIC8vIGEgcHJvcGVydHkgYXNzaWdubWVudCBpbiB0aGUgbmV3IGRlY29yYXRvciBmb3IgdGhhdCBpbnRlcm5hbCBwcm9wZXJ0eS5cbiAgICAgIGRlbGV0ZSBtZXRhZGF0YVsnbmdNZXRhZGF0YU5hbWUnXTtcblxuICAgICAgcmV0dXJuIHt0eXBlOiBuZ01ldGFkYXRhTmFtZSwgbWV0YWRhdGF9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2dldFN0YXRpY1N5bWJvbE9mSWRlbnRpZmllcihub2RlOiB0cy5JZGVudGlmaWVyKTogU3RhdGljU3ltYm9sfG51bGwge1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBub2RlLmdldFNvdXJjZUZpbGUoKTtcbiAgICBjb25zdCByZXNvbHZlZEltcG9ydCA9IGdldEltcG9ydE9mSWRlbnRpZmllcih0aGlzLnR5cGVDaGVja2VyLCBub2RlKTtcblxuICAgIGlmICghcmVzb2x2ZWRJbXBvcnQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1vZHVsZU5hbWUgPVxuICAgICAgICB0aGlzLmNvbXBpbGVySG9zdC5tb2R1bGVOYW1lVG9GaWxlTmFtZShyZXNvbHZlZEltcG9ydC5pbXBvcnRNb2R1bGUsIHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuXG4gICAgaWYgKCFtb2R1bGVOYW1lKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBGaW5kIHRoZSBkZWNsYXJhdGlvbiBzeW1ib2wgYXMgc3ltYm9scyBjb3VsZCBiZSBhbGlhc2VkIGR1ZSB0b1xuICAgIC8vIG1ldGFkYXRhIHJlLWV4cG9ydHMuXG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZXIucmVmbGVjdG9yLmZpbmRTeW1ib2xEZWNsYXJhdGlvbihcbiAgICAgICAgdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRTdGF0aWNTeW1ib2wobW9kdWxlTmFtZSwgcmVzb2x2ZWRJbXBvcnQubmFtZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIERpc2FibGVzIHRoYXQgc3RhdGljIHN5bWJvbHMgYXJlIHJlc29sdmVkIHRocm91Z2ggc3VtbWFyaWVzLiBTdW1tYXJpZXNcbiAgICogY2Fubm90IGJlIHVzZWQgZm9yIGRlY29yYXRvciBhbmFseXNpcyBhcyBkZWNvcmF0b3JzIGFyZSBvbWl0dGVkIGluIHN1bW1hcmllcy5cbiAgICovXG4gIHByaXZhdGUgX2Rpc2FibGVTdW1tYXJ5UmVzb2x1dGlvbigpIHtcbiAgICAvLyBXZSBuZXZlciB3YW50IHRvIHJlc29sdmUgc3ltYm9scyB0aHJvdWdoIHN1bW1hcmllcy4gU3VtbWFyaWVzIG5ldmVyIGNvbnRhaW5cbiAgICAvLyBkZWNvcmF0b3JzIGZvciBjbGFzcyBzeW1ib2xzIGFuZCB0aGVyZWZvcmUgc3VtbWFyaWVzIHdpbGwgY2F1c2UgZXZlcnkgY2xhc3NcbiAgICAvLyB0byBiZSBjb25zaWRlcmVkIGFzIHVuZGVjb3JhdGVkLiBTZWUgcmVhc29uIGZvciB0aGlzIGluOiBcIlRvSnNvblNlcmlhbGl6ZXJcIi5cbiAgICAvLyBJbiBvcmRlciB0byBlbnN1cmUgdGhhdCBtZXRhZGF0YSBpcyBub3QgcmV0cmlldmVkIHRocm91Z2ggc3VtbWFyaWVzLCB3ZVxuICAgIC8vIG5lZWQgdG8gZGlzYWJsZSBzdW1tYXJ5IHJlc29sdXRpb24sIGNsZWFyIHByZXZpb3VzIHN5bWJvbCBjYWNoZXMuIFRoaXMgd2F5XG4gICAgLy8gZnV0dXJlIGNhbGxzIHRvIFwiU3RhdGljUmVmbGVjdG9yI2Fubm90YXRpb25zXCIgYXJlIGJhc2VkIG9uIG1ldGFkYXRhIGZpbGVzLlxuICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXJbJ19yZXNvbHZlU3ltYm9sRnJvbVN1bW1hcnknXSA9ICgpID0+IG51bGw7XG4gICAgdGhpcy5zeW1ib2xSZXNvbHZlclsncmVzb2x2ZWRTeW1ib2xzJ10uY2xlYXIoKTtcbiAgICB0aGlzLnN5bWJvbFJlc29sdmVyWydzeW1ib2xGcm9tRmlsZSddLmNsZWFyKCk7XG4gICAgdGhpcy5jb21waWxlci5yZWZsZWN0b3JbJ2Fubm90YXRpb25DYWNoZSddLmNsZWFyKCk7XG5cbiAgICAvLyBPcmlnaW5hbCBzdW1tYXJ5IHJlc29sdmVyIHVzZWQgYnkgdGhlIEFPVCBjb21waWxlci5cbiAgICBjb25zdCBzdW1tYXJ5UmVzb2x2ZXIgPSB0aGlzLnN5bWJvbFJlc29sdmVyWydzdW1tYXJ5UmVzb2x2ZXInXTtcblxuICAgIC8vIEFkZGl0aW9uYWxseSB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IG5vIGZpbGVzIGFyZSB0cmVhdGVkIGFzIFwibGlicmFyeVwiIGZpbGVzIHdoZW5cbiAgICAvLyByZXNvbHZpbmcgbWV0YWRhdGEuIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYnkgZGVmYXVsdCB0aGUgc3ltYm9sIHJlc29sdmVyIGRpc2NhcmRzXG4gICAgLy8gY2xhc3MgbWV0YWRhdGEgZm9yIGxpYnJhcnkgZmlsZXMuIFNlZSBcIlN0YXRpY1N5bWJvbFJlc29sdmVyI2NyZWF0ZVJlc29sdmVkU3ltYm9sXCIuXG4gICAgLy8gUGF0Y2hpbmcgdGhpcyBmdW5jdGlvbiAqKm9ubHkqKiBmb3IgdGhlIHN0YXRpYyBzeW1ib2wgcmVzb2x2ZXIgZW5zdXJlcyB0aGF0IG1ldGFkYXRhXG4gICAgLy8gaXMgbm90IGluY29ycmVjdGx5IG9taXR0ZWQuIE5vdGUgdGhhdCB3ZSBvbmx5IHdhbnQgdG8gZG8gdGhpcyBmb3IgdGhlIHN5bWJvbCByZXNvbHZlclxuICAgIC8vIGJlY2F1c2Ugb3RoZXJ3aXNlIHdlIGNvdWxkIGJyZWFrIHRoZSBzdW1tYXJ5IGxvYWRpbmcgbG9naWMgd2hpY2ggaXMgdXNlZCB0byBkZXRlY3RcbiAgICAvLyBpZiBhIHN0YXRpYyBzeW1ib2wgaXMgZWl0aGVyIGEgZGlyZWN0aXZlLCBjb21wb25lbnQgb3IgcGlwZSAoc2VlIE1ldGFkYXRhUmVzb2x2ZXIpLlxuICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXJbJ3N1bW1hcnlSZXNvbHZlciddID0gPFN1bW1hcnlSZXNvbHZlcjxTdGF0aWNTeW1ib2w+PntcbiAgICAgIGZyb21TdW1tYXJ5RmlsZU5hbWU6IHN1bW1hcnlSZXNvbHZlci5mcm9tU3VtbWFyeUZpbGVOYW1lLmJpbmQoc3VtbWFyeVJlc29sdmVyKSxcbiAgICAgIGFkZFN1bW1hcnk6IHN1bW1hcnlSZXNvbHZlci5hZGRTdW1tYXJ5LmJpbmQoc3VtbWFyeVJlc29sdmVyKSxcbiAgICAgIGdldEltcG9ydEFzOiBzdW1tYXJ5UmVzb2x2ZXIuZ2V0SW1wb3J0QXMuYmluZChzdW1tYXJ5UmVzb2x2ZXIpLFxuICAgICAgZ2V0S25vd25Nb2R1bGVOYW1lOiBzdW1tYXJ5UmVzb2x2ZXIuZ2V0S25vd25Nb2R1bGVOYW1lLmJpbmQoc3VtbWFyeVJlc29sdmVyKSxcbiAgICAgIHJlc29sdmVTdW1tYXJ5OiBzdW1tYXJ5UmVzb2x2ZXIucmVzb2x2ZVN1bW1hcnkuYmluZChzdW1tYXJ5UmVzb2x2ZXIpLFxuICAgICAgdG9TdW1tYXJ5RmlsZU5hbWU6IHN1bW1hcnlSZXNvbHZlci50b1N1bW1hcnlGaWxlTmFtZS5iaW5kKHN1bW1hcnlSZXNvbHZlciksXG4gICAgICBnZXRTeW1ib2xzT2Y6IHN1bW1hcnlSZXNvbHZlci5nZXRTeW1ib2xzT2YuYmluZChzdW1tYXJ5UmVzb2x2ZXIpLFxuICAgICAgaXNMaWJyYXJ5RmlsZTogKCkgPT4gZmFsc2UsXG4gICAgfTtcbiAgfVxufVxuIl19