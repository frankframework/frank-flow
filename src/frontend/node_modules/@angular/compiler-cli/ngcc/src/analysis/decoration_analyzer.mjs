/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ConstantPool } from '@angular/compiler';
import { NOOP_PERF_RECORDER } from '@angular/compiler-cli/src/ngtsc/perf';
import { ComponentDecoratorHandler, DirectiveDecoratorHandler, InjectableDecoratorHandler, NgModuleDecoratorHandler, PipeDecoratorHandler } from '../../../src/ngtsc/annotations';
import { CycleAnalyzer, ImportGraph } from '../../../src/ngtsc/cycles';
import { isFatalDiagnosticError } from '../../../src/ngtsc/diagnostics';
import { absoluteFromSourceFile, LogicalFileSystem } from '../../../src/ngtsc/file_system';
import { AbsoluteModuleStrategy, LocalIdentifierStrategy, LogicalProjectStrategy, ModuleResolver, PrivateExportAliasingHost, ReferenceEmitter } from '../../../src/ngtsc/imports';
import { CompoundMetadataReader, CompoundMetadataRegistry, DtsMetadataReader, InjectableClassRegistry, LocalMetadataRegistry, ResourceRegistry } from '../../../src/ngtsc/metadata';
import { PartialEvaluator } from '../../../src/ngtsc/partial_evaluator';
import { LocalModuleScopeRegistry, MetadataDtsModuleScopeResolver, TypeCheckScopeRegistry } from '../../../src/ngtsc/scope';
import { MissingInjectableMigration } from '../migrations/missing_injectable_migration';
import { UndecoratedChildMigration } from '../migrations/undecorated_child_migration';
import { UndecoratedParentMigration } from '../migrations/undecorated_parent_migration';
import { DefaultMigrationHost } from './migration_host';
import { NgccTraitCompiler } from './ngcc_trait_compiler';
import { DecorationAnalyses } from './types';
import { isWithinPackage, NOOP_DEPENDENCY_TRACKER } from './util';
/**
 * Simple class that resolves and loads files directly from the filesystem.
 */
class NgccResourceLoader {
    constructor(fs) {
        this.fs = fs;
        this.canPreload = false;
        this.canPreprocess = false;
    }
    preload() {
        throw new Error('Not implemented.');
    }
    preprocessInline() {
        throw new Error('Not implemented.');
    }
    load(url) {
        return this.fs.readFile(this.fs.resolve(url));
    }
    resolve(url, containingFile) {
        return this.fs.resolve(this.fs.dirname(containingFile), url);
    }
}
/**
 * This Analyzer will analyze the files that have decorated classes that need to be transformed.
 */
export class DecorationAnalyzer {
    constructor(fs, bundle, reflectionHost, referencesRegistry, diagnosticHandler = () => { }, tsConfig = null) {
        this.fs = fs;
        this.bundle = bundle;
        this.reflectionHost = reflectionHost;
        this.referencesRegistry = referencesRegistry;
        this.diagnosticHandler = diagnosticHandler;
        this.tsConfig = tsConfig;
        this.program = this.bundle.src.program;
        this.options = this.bundle.src.options;
        this.host = this.bundle.src.host;
        this.typeChecker = this.bundle.src.program.getTypeChecker();
        this.rootDirs = this.bundle.rootDirs;
        this.packagePath = this.bundle.entryPoint.packagePath;
        this.isCore = this.bundle.isCore;
        this.compilerOptions = this.tsConfig !== null ? this.tsConfig.options : {};
        this.moduleResolver = new ModuleResolver(this.program, this.options, this.host, /* moduleResolutionCache */ null);
        this.resourceManager = new NgccResourceLoader(this.fs);
        this.metaRegistry = new LocalMetadataRegistry();
        this.dtsMetaReader = new DtsMetadataReader(this.typeChecker, this.reflectionHost);
        this.fullMetaReader = new CompoundMetadataReader([this.metaRegistry, this.dtsMetaReader]);
        this.refEmitter = new ReferenceEmitter([
            new LocalIdentifierStrategy(),
            new AbsoluteModuleStrategy(this.program, this.typeChecker, this.moduleResolver, this.reflectionHost),
            // TODO(alxhub): there's no reason why ngcc needs the "logical file system" logic here, as ngcc
            // projects only ever have one rootDir. Instead, ngcc should just switch its emitted import
            // based on whether a bestGuessOwningModule is present in the Reference.
            new LogicalProjectStrategy(this.reflectionHost, new LogicalFileSystem(this.rootDirs, this.host)),
        ]);
        this.aliasingHost = this.bundle.entryPoint.generateDeepReexports ?
            new PrivateExportAliasingHost(this.reflectionHost) :
            null;
        this.dtsModuleScopeResolver = new MetadataDtsModuleScopeResolver(this.dtsMetaReader, this.aliasingHost);
        this.scopeRegistry = new LocalModuleScopeRegistry(this.metaRegistry, this.dtsModuleScopeResolver, this.refEmitter, this.aliasingHost);
        this.fullRegistry = new CompoundMetadataRegistry([this.metaRegistry, this.scopeRegistry]);
        this.evaluator = new PartialEvaluator(this.reflectionHost, this.typeChecker, /* dependencyTracker */ null);
        this.importGraph = new ImportGraph(this.typeChecker, NOOP_PERF_RECORDER);
        this.cycleAnalyzer = new CycleAnalyzer(this.importGraph);
        this.injectableRegistry = new InjectableClassRegistry(this.reflectionHost);
        this.typeCheckScopeRegistry = new TypeCheckScopeRegistry(this.scopeRegistry, this.fullMetaReader);
        this.handlers = [
            new ComponentDecoratorHandler(this.reflectionHost, this.evaluator, this.fullRegistry, this.fullMetaReader, this.scopeRegistry, this.scopeRegistry, this.typeCheckScopeRegistry, new ResourceRegistry(), this.isCore, this.resourceManager, this.rootDirs, !!this.compilerOptions.preserveWhitespaces, 
            /* i18nUseExternalIds */ true, this.bundle.enableI18nLegacyMessageIdFormat, 
            /* usePoisonedData */ false, 
            /* i18nNormalizeLineEndingsInICUs */ false, this.moduleResolver, this.cycleAnalyzer, 0 /* UseRemoteScoping */, this.refEmitter, NOOP_DEPENDENCY_TRACKER, this.injectableRegistry, 
            /* semanticDepGraphUpdater */ null, !!this.compilerOptions.annotateForClosureCompiler, NOOP_PERF_RECORDER),
            // See the note in ngtsc about why this cast is needed.
            // clang-format off
            new DirectiveDecoratorHandler(this.reflectionHost, this.evaluator, this.fullRegistry, this.scopeRegistry, this.fullMetaReader, this.injectableRegistry, this.isCore, 
            /* semanticDepGraphUpdater */ null, !!this.compilerOptions.annotateForClosureCompiler, 
            // In ngcc we want to compile undecorated classes with Angular features. As of
            // version 10, undecorated classes that use Angular features are no longer handled
            // in ngtsc, but we want to ensure compatibility in ngcc for outdated libraries that
            // have not migrated to explicit decorators. See: https://hackmd.io/@alx/ryfYYuvzH.
            /* compileUndecoratedClassesWithAngularFeatures */ true, NOOP_PERF_RECORDER),
            // clang-format on
            // Pipe handler must be before injectable handler in list so pipe factories are printed
            // before injectable factories (so injectable factories can delegate to them)
            new PipeDecoratorHandler(this.reflectionHost, this.evaluator, this.metaRegistry, this.scopeRegistry, this.injectableRegistry, this.isCore, NOOP_PERF_RECORDER),
            new InjectableDecoratorHandler(this.reflectionHost, this.isCore, 
            /* strictCtorDeps */ false, this.injectableRegistry, NOOP_PERF_RECORDER, 
            /* errorOnDuplicateProv */ false),
            new NgModuleDecoratorHandler(this.reflectionHost, this.evaluator, this.fullMetaReader, this.fullRegistry, this.scopeRegistry, this.referencesRegistry, this.isCore, /* routeAnalyzer */ null, this.refEmitter, 
            /* factoryTracker */ null, !!this.compilerOptions.annotateForClosureCompiler, this.injectableRegistry, NOOP_PERF_RECORDER),
        ];
        this.compiler = new NgccTraitCompiler(this.handlers, this.reflectionHost);
        this.migrations = [
            new UndecoratedParentMigration(),
            new UndecoratedChildMigration(),
            new MissingInjectableMigration(),
        ];
    }
    /**
     * Analyze a program to find all the decorated files should be transformed.
     *
     * @returns a map of the source files to the analysis for those files.
     */
    analyzeProgram() {
        for (const sourceFile of this.program.getSourceFiles()) {
            if (!sourceFile.isDeclarationFile &&
                isWithinPackage(this.packagePath, absoluteFromSourceFile(sourceFile))) {
                this.compiler.analyzeFile(sourceFile);
            }
        }
        this.applyMigrations();
        this.compiler.resolve();
        this.reportDiagnostics();
        const decorationAnalyses = new DecorationAnalyses();
        for (const analyzedFile of this.compiler.analyzedFiles) {
            const compiledFile = this.compileFile(analyzedFile);
            decorationAnalyses.set(compiledFile.sourceFile, compiledFile);
        }
        return decorationAnalyses;
    }
    applyMigrations() {
        const migrationHost = new DefaultMigrationHost(this.reflectionHost, this.fullMetaReader, this.evaluator, this.compiler, this.bundle.entryPoint.path);
        this.migrations.forEach(migration => {
            this.compiler.analyzedFiles.forEach(analyzedFile => {
                const records = this.compiler.recordsFor(analyzedFile);
                if (records === null) {
                    throw new Error('Assertion error: file to migrate must have records.');
                }
                records.forEach(record => {
                    const addDiagnostic = (diagnostic) => {
                        if (record.metaDiagnostics === null) {
                            record.metaDiagnostics = [];
                        }
                        record.metaDiagnostics.push(diagnostic);
                    };
                    try {
                        const result = migration.apply(record.node, migrationHost);
                        if (result !== null) {
                            addDiagnostic(result);
                        }
                    }
                    catch (e) {
                        if (isFatalDiagnosticError(e)) {
                            addDiagnostic(e.toDiagnostic());
                        }
                        else {
                            throw e;
                        }
                    }
                });
            });
        });
    }
    reportDiagnostics() {
        this.compiler.diagnostics.forEach(this.diagnosticHandler);
    }
    compileFile(sourceFile) {
        const constantPool = new ConstantPool();
        const records = this.compiler.recordsFor(sourceFile);
        if (records === null) {
            throw new Error('Assertion error: file to compile must have records.');
        }
        const compiledClasses = [];
        for (const record of records) {
            const compilation = this.compiler.compile(record.node, constantPool);
            if (compilation === null) {
                continue;
            }
            compiledClasses.push({
                name: record.node.name.text,
                decorators: this.compiler.getAllDecorators(record.node),
                declaration: record.node,
                compilation
            });
        }
        const reexports = this.getReexportsForSourceFile(sourceFile);
        return { constantPool, sourceFile: sourceFile, compiledClasses, reexports };
    }
    getReexportsForSourceFile(sf) {
        const exportStatements = this.compiler.exportStatements;
        if (!exportStatements.has(sf.fileName)) {
            return [];
        }
        const exports = exportStatements.get(sf.fileName);
        const reexports = [];
        exports.forEach(([fromModule, symbolName], asAlias) => {
            reexports.push({ asAlias, fromModule, symbolName });
        });
        return reexports;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdGlvbl9hbmFseXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9hbmFseXNpcy9kZWNvcmF0aW9uX2FuYWx5emVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUl4RSxPQUFPLEVBQUMseUJBQXlCLEVBQUUseUJBQXlCLEVBQUUsMEJBQTBCLEVBQUUsd0JBQXdCLEVBQUUsb0JBQW9CLEVBQXFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDcE4sT0FBTyxFQUFDLGFBQWEsRUFBeUIsV0FBVyxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDNUYsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDdEUsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGlCQUFpQixFQUFxQixNQUFNLGdDQUFnQyxDQUFDO0FBQzdHLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSx1QkFBdUIsRUFBRSxzQkFBc0IsRUFBRSxjQUFjLEVBQUUseUJBQXlCLEVBQVksZ0JBQWdCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUUxTCxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsd0JBQXdCLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUscUJBQXFCLEVBQUUsZ0JBQWdCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNsTCxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUMsd0JBQXdCLEVBQUUsOEJBQThCLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUkxSCxPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSw0Q0FBNEMs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QUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDdkQsV0FBVyxFQUFFLE1BQU0sQ0FBQyxJQUFJO2dCQUN4QixXQUFXO2FBQ1osQ0FBQyxDQUFDO1NBQ0o7UUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0QsT0FBTyxFQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxTQUFTLEVBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRU8seUJBQXlCLENBQUMsRUFBaUI7UUFDakQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO1FBQ3hELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3RDLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFDRCxNQUFNLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBRSxDQUFDO1FBRW5ELE1BQU0sU0FBUyxHQUFlLEVBQUUsQ0FBQztRQUNqQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUU7WUFDcEQsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFDLENBQUMsQ0FBQztRQUNwRCxDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCB7Tk9PUF9QRVJGX1JFQ09SREVSfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGkvc3JjL25ndHNjL3BlcmYnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7UGFyc2VkQ29uZmlndXJhdGlvbn0gZnJvbSAnLi4vLi4vLi4nO1xuaW1wb3J0IHtDb21wb25lbnREZWNvcmF0b3JIYW5kbGVyLCBEaXJlY3RpdmVEZWNvcmF0b3JIYW5kbGVyLCBJbmplY3RhYmxlRGVjb3JhdG9ySGFuZGxlciwgTmdNb2R1bGVEZWNvcmF0b3JIYW5kbGVyLCBQaXBlRGVjb3JhdG9ySGFuZGxlciwgUmVmZXJlbmNlc1JlZ2lzdHJ5LCBSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2Fubm90YXRpb25zJztcbmltcG9ydCB7Q3ljbGVBbmFseXplciwgQ3ljbGVIYW5kbGluZ1N0cmF0ZWd5LCBJbXBvcnRHcmFwaH0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2N5Y2xlcyc7XG5pbXBvcnQge2lzRmF0YWxEaWFnbm9zdGljRXJyb3J9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9kaWFnbm9zdGljcyc7XG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGUsIExvZ2ljYWxGaWxlU3lzdGVtLCBSZWFkb25seUZpbGVTeXN0ZW19IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0Fic29sdXRlTW9kdWxlU3RyYXRlZ3ksIExvY2FsSWRlbnRpZmllclN0cmF0ZWd5LCBMb2dpY2FsUHJvamVjdFN0cmF0ZWd5LCBNb2R1bGVSZXNvbHZlciwgUHJpdmF0ZUV4cG9ydEFsaWFzaW5nSG9zdCwgUmVleHBvcnQsIFJlZmVyZW5jZUVtaXR0ZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9pbXBvcnRzJztcbmltcG9ydCB7U2VtYW50aWNTeW1ib2x9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9pbmNyZW1lbnRhbC9zZW1hbnRpY19ncmFwaCc7XG5pbXBvcnQge0NvbXBvdW5kTWV0YWRhdGFSZWFkZXIsIENvbXBvdW5kTWV0YWRhdGFSZWdpc3RyeSwgRHRzTWV0YWRhdGFSZWFkZXIsIEluamVjdGFibGVDbGFzc1JlZ2lzdHJ5LCBMb2NhbE1ldGFkYXRhUmVnaXN0cnksIFJlc291cmNlUmVnaXN0cnl9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9tZXRhZGF0YSc7XG5pbXBvcnQge1BhcnRpYWxFdmFsdWF0b3J9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9wYXJ0aWFsX2V2YWx1YXRvcic7XG5pbXBvcnQge0xvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeSwgTWV0YWRhdGFEdHNNb2R1bGVTY29wZVJlc29sdmVyLCBUeXBlQ2hlY2tTY29wZVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2Mvc2NvcGUnO1xuaW1wb3J0IHtEZWNvcmF0b3JIYW5kbGVyfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvdHJhbnNmb3JtJztcbmltcG9ydCB7TmdjY1JlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi9ob3N0L25nY2NfaG9zdCc7XG5pbXBvcnQge01pZ3JhdGlvbn0gZnJvbSAnLi4vbWlncmF0aW9ucy9taWdyYXRpb24nO1xuaW1wb3J0IHtNaXNzaW5nSW5qZWN0YWJsZU1pZ3JhdGlvbn0gZnJvbSAnLi4vbWlncmF0aW9ucy9taXNzaW5nX2luamVjdGFibGVfbWlncmF0aW9uJztcbmltcG9ydCB7VW5kZWNvcmF0ZWRDaGlsZE1pZ3JhdGlvbn0gZnJvbSAnLi4vbWlncmF0aW9ucy91bmRlY29yYXRlZF9jaGlsZF9taWdyYXRpb24nO1xuaW1wb3J0IHtVbmRlY29yYXRlZFBhcmVudE1pZ3JhdGlvbn0gZnJvbSAnLi4vbWlncmF0aW9ucy91bmRlY29yYXRlZF9wYXJlbnRfbWlncmF0aW9uJztcbmltcG9ydCB7RW50cnlQb2ludEJ1bmRsZX0gZnJvbSAnLi4vcGFja2FnZXMvZW50cnlfcG9pbnRfYnVuZGxlJztcblxuaW1wb3J0IHtEZWZhdWx0TWlncmF0aW9uSG9zdH0gZnJvbSAnLi9taWdyYXRpb25faG9zdCc7XG5pbXBvcnQge05nY2NUcmFpdENvbXBpbGVyfSBmcm9tICcuL25nY2NfdHJhaXRfY29tcGlsZXInO1xuaW1wb3J0IHtDb21waWxlZENsYXNzLCBDb21waWxlZEZpbGUsIERlY29yYXRpb25BbmFseXNlc30gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQge2lzV2l0aGluUGFja2FnZSwgTk9PUF9ERVBFTkRFTkNZX1RSQUNLRVJ9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vKipcbiAqIFNpbXBsZSBjbGFzcyB0aGF0IHJlc29sdmVzIGFuZCBsb2FkcyBmaWxlcyBkaXJlY3RseSBmcm9tIHRoZSBmaWxlc3lzdGVtLlxuICovXG5jbGFzcyBOZ2NjUmVzb3VyY2VMb2FkZXIgaW1wbGVtZW50cyBSZXNvdXJjZUxvYWRlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZnM6IFJlYWRvbmx5RmlsZVN5c3RlbSkge31cbiAgY2FuUHJlbG9hZCA9IGZhbHNlO1xuICBjYW5QcmVwcm9jZXNzID0gZmFsc2U7XG4gIHByZWxvYWQoKTogdW5kZWZpbmVkfFByb21pc2U8dm9pZD4ge1xuICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkLicpO1xuICB9XG4gIHByZXByb2Nlc3NJbmxpbmUoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuICBsb2FkKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5mcy5yZWFkRmlsZSh0aGlzLmZzLnJlc29sdmUodXJsKSk7XG4gIH1cbiAgcmVzb2x2ZSh1cmw6IHN0cmluZywgY29udGFpbmluZ0ZpbGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZnMucmVzb2x2ZSh0aGlzLmZzLmRpcm5hbWUoY29udGFpbmluZ0ZpbGUpLCB1cmwpO1xuICB9XG59XG5cbi8qKlxuICogVGhpcyBBbmFseXplciB3aWxsIGFuYWx5emUgdGhlIGZpbGVzIHRoYXQgaGF2ZSBkZWNvcmF0ZWQgY2xhc3NlcyB0aGF0IG5lZWQgdG8gYmUgdHJhbnNmb3JtZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWNvcmF0aW9uQW5hbHl6ZXIge1xuICBwcml2YXRlIHByb2dyYW0gPSB0aGlzLmJ1bmRsZS5zcmMucHJvZ3JhbTtcbiAgcHJpdmF0ZSBvcHRpb25zID0gdGhpcy5idW5kbGUuc3JjLm9wdGlvbnM7XG4gIHByaXZhdGUgaG9zdCA9IHRoaXMuYnVuZGxlLnNyYy5ob3N0O1xuICBwcml2YXRlIHR5cGVDaGVja2VyID0gdGhpcy5idW5kbGUuc3JjLnByb2dyYW0uZ2V0VHlwZUNoZWNrZXIoKTtcbiAgcHJpdmF0ZSByb290RGlycyA9IHRoaXMuYnVuZGxlLnJvb3REaXJzO1xuICBwcml2YXRlIHBhY2thZ2VQYXRoID0gdGhpcy5idW5kbGUuZW50cnlQb2ludC5wYWNrYWdlUGF0aDtcbiAgcHJpdmF0ZSBpc0NvcmUgPSB0aGlzLmJ1bmRsZS5pc0NvcmU7XG4gIHByaXZhdGUgY29tcGlsZXJPcHRpb25zID0gdGhpcy50c0NvbmZpZyAhPT0gbnVsbCA/IHRoaXMudHNDb25maWcub3B0aW9ucyA6IHt9O1xuXG4gIG1vZHVsZVJlc29sdmVyID1cbiAgICAgIG5ldyBNb2R1bGVSZXNvbHZlcih0aGlzLnByb2dyYW0sIHRoaXMub3B0aW9ucywgdGhpcy5ob3N0LCAvKiBtb2R1bGVSZXNvbHV0aW9uQ2FjaGUgKi8gbnVsbCk7XG4gIHJlc291cmNlTWFuYWdlciA9IG5ldyBOZ2NjUmVzb3VyY2VMb2FkZXIodGhpcy5mcyk7XG4gIG1ldGFSZWdpc3RyeSA9IG5ldyBMb2NhbE1ldGFkYXRhUmVnaXN0cnkoKTtcbiAgZHRzTWV0YVJlYWRlciA9IG5ldyBEdHNNZXRhZGF0YVJlYWRlcih0aGlzLnR5cGVDaGVja2VyLCB0aGlzLnJlZmxlY3Rpb25Ib3N0KTtcbiAgZnVsbE1ldGFSZWFkZXIgPSBuZXcgQ29tcG91bmRNZXRhZGF0YVJlYWRlcihbdGhpcy5tZXRhUmVnaXN0cnksIHRoaXMuZHRzTWV0YVJlYWRlcl0pO1xuICByZWZFbWl0dGVyID0gbmV3IFJlZmVyZW5jZUVtaXR0ZXIoW1xuICAgIG5ldyBMb2NhbElkZW50aWZpZXJTdHJhdGVneSgpLFxuICAgIG5ldyBBYnNvbHV0ZU1vZHVsZVN0cmF0ZWd5KFxuICAgICAgICB0aGlzLnByb2dyYW0sIHRoaXMudHlwZUNoZWNrZXIsIHRoaXMubW9kdWxlUmVzb2x2ZXIsIHRoaXMucmVmbGVjdGlvbkhvc3QpLFxuICAgIC8vIFRPRE8oYWx4aHViKTogdGhlcmUncyBubyByZWFzb24gd2h5IG5nY2MgbmVlZHMgdGhlIFwibG9naWNhbCBmaWxlIHN5c3RlbVwiIGxvZ2ljIGhlcmUsIGFzIG5nY2NcbiAgICAvLyBwcm9qZWN0cyBvbmx5IGV2ZXIgaGF2ZSBvbmUgcm9vdERpci4gSW5zdGVhZCwgbmdjYyBzaG91bGQganVzdCBzd2l0Y2ggaXRzIGVtaXR0ZWQgaW1wb3J0XG4gICAgLy8gYmFzZWQgb24gd2hldGhlciBhIGJlc3RHdWVzc093bmluZ01vZHVsZSBpcyBwcmVzZW50IGluIHRoZSBSZWZlcmVuY2UuXG4gICAgbmV3IExvZ2ljYWxQcm9qZWN0U3RyYXRlZ3koXG4gICAgICAgIHRoaXMucmVmbGVjdGlvbkhvc3QsIG5ldyBMb2dpY2FsRmlsZVN5c3RlbSh0aGlzLnJvb3REaXJzLCB0aGlzLmhvc3QpKSxcbiAgXSk7XG4gIGFsaWFzaW5nSG9zdCA9IHRoaXMuYnVuZGxlLmVudHJ5UG9pbnQuZ2VuZXJhdGVEZWVwUmVleHBvcnRzID9cbiAgICAgIG5ldyBQcml2YXRlRXhwb3J0QWxpYXNpbmdIb3N0KHRoaXMucmVmbGVjdGlvbkhvc3QpIDpcbiAgICAgIG51bGw7XG4gIGR0c01vZHVsZVNjb3BlUmVzb2x2ZXIgPVxuICAgICAgbmV3IE1ldGFkYXRhRHRzTW9kdWxlU2NvcGVSZXNvbHZlcih0aGlzLmR0c01ldGFSZWFkZXIsIHRoaXMuYWxpYXNpbmdIb3N0KTtcbiAgc2NvcGVSZWdpc3RyeSA9IG5ldyBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnkoXG4gICAgICB0aGlzLm1ldGFSZWdpc3RyeSwgdGhpcy5kdHNNb2R1bGVTY29wZVJlc29sdmVyLCB0aGlzLnJlZkVtaXR0ZXIsIHRoaXMuYWxpYXNpbmdIb3N0KTtcbiAgZnVsbFJlZ2lzdHJ5ID0gbmV3IENvbXBvdW5kTWV0YWRhdGFSZWdpc3RyeShbdGhpcy5tZXRhUmVnaXN0cnksIHRoaXMuc2NvcGVSZWdpc3RyeV0pO1xuICBldmFsdWF0b3IgPVxuICAgICAgbmV3IFBhcnRpYWxFdmFsdWF0b3IodGhpcy5yZWZsZWN0aW9uSG9zdCwgdGhpcy50eXBlQ2hlY2tlciwgLyogZGVwZW5kZW5jeVRyYWNrZXIgKi8gbnVsbCk7XG4gIGltcG9ydEdyYXBoID0gbmV3IEltcG9ydEdyYXBoKHRoaXMudHlwZUNoZWNrZXIsIE5PT1BfUEVSRl9SRUNPUkRFUik7XG4gIGN5Y2xlQW5hbHl6ZXIgPSBuZXcgQ3ljbGVBbmFseXplcih0aGlzLmltcG9ydEdyYXBoKTtcbiAgaW5qZWN0YWJsZVJlZ2lzdHJ5ID0gbmV3IEluamVjdGFibGVDbGFzc1JlZ2lzdHJ5KHRoaXMucmVmbGVjdGlvbkhvc3QpO1xuICB0eXBlQ2hlY2tTY29wZVJlZ2lzdHJ5ID0gbmV3IFR5cGVDaGVja1Njb3BlUmVnaXN0cnkodGhpcy5zY29wZVJlZ2lzdHJ5LCB0aGlzLmZ1bGxNZXRhUmVhZGVyKTtcbiAgaGFuZGxlcnM6IERlY29yYXRvckhhbmRsZXI8dW5rbm93biwgdW5rbm93biwgU2VtYW50aWNTeW1ib2x8bnVsbCwgdW5rbm93bj5bXSA9IFtcbiAgICBuZXcgQ29tcG9uZW50RGVjb3JhdG9ySGFuZGxlcihcbiAgICAgICAgdGhpcy5yZWZsZWN0aW9uSG9zdCwgdGhpcy5ldmFsdWF0b3IsIHRoaXMuZnVsbFJlZ2lzdHJ5LCB0aGlzLmZ1bGxNZXRhUmVhZGVyLFxuICAgICAgICB0aGlzLnNjb3BlUmVnaXN0cnksIHRoaXMuc2NvcGVSZWdpc3RyeSwgdGhpcy50eXBlQ2hlY2tTY29wZVJlZ2lzdHJ5LCBuZXcgUmVzb3VyY2VSZWdpc3RyeSgpLFxuICAgICAgICB0aGlzLmlzQ29yZSwgdGhpcy5yZXNvdXJjZU1hbmFnZXIsIHRoaXMucm9vdERpcnMsXG4gICAgICAgICEhdGhpcy5jb21waWxlck9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgICAgLyogaTE4blVzZUV4dGVybmFsSWRzICovIHRydWUsIHRoaXMuYnVuZGxlLmVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQsXG4gICAgICAgIC8qIHVzZVBvaXNvbmVkRGF0YSAqLyBmYWxzZSxcbiAgICAgICAgLyogaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzICovIGZhbHNlLCB0aGlzLm1vZHVsZVJlc29sdmVyLCB0aGlzLmN5Y2xlQW5hbHl6ZXIsXG4gICAgICAgIEN5Y2xlSGFuZGxpbmdTdHJhdGVneS5Vc2VSZW1vdGVTY29waW5nLCB0aGlzLnJlZkVtaXR0ZXIsIE5PT1BfREVQRU5ERU5DWV9UUkFDS0VSLFxuICAgICAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeSxcbiAgICAgICAgLyogc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIgKi8gbnVsbCwgISF0aGlzLmNvbXBpbGVyT3B0aW9ucy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcixcbiAgICAgICAgTk9PUF9QRVJGX1JFQ09SREVSKSxcblxuICAgIC8vIFNlZSB0aGUgbm90ZSBpbiBuZ3RzYyBhYm91dCB3aHkgdGhpcyBjYXN0IGlzIG5lZWRlZC5cbiAgICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gICAgbmV3IERpcmVjdGl2ZURlY29yYXRvckhhbmRsZXIoXG4gICAgICAgIHRoaXMucmVmbGVjdGlvbkhvc3QsIHRoaXMuZXZhbHVhdG9yLCB0aGlzLmZ1bGxSZWdpc3RyeSwgdGhpcy5zY29wZVJlZ2lzdHJ5LFxuICAgICAgICB0aGlzLmZ1bGxNZXRhUmVhZGVyLCB0aGlzLmluamVjdGFibGVSZWdpc3RyeSwgdGhpcy5pc0NvcmUsXG4gICAgICAgIC8qIHNlbWFudGljRGVwR3JhcGhVcGRhdGVyICovIG51bGwsXG4gICAgICAgICEhdGhpcy5jb21waWxlck9wdGlvbnMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIsXG4gICAgICAgIC8vIEluIG5nY2Mgd2Ugd2FudCB0byBjb21waWxlIHVuZGVjb3JhdGVkIGNsYXNzZXMgd2l0aCBBbmd1bGFyIGZlYXR1cmVzLiBBcyBvZlxuICAgICAgICAvLyB2ZXJzaW9uIDEwLCB1bmRlY29yYXRlZCBjbGFzc2VzIHRoYXQgdXNlIEFuZ3VsYXIgZmVhdHVyZXMgYXJlIG5vIGxvbmdlciBoYW5kbGVkXG4gICAgICAgIC8vIGluIG5ndHNjLCBidXQgd2Ugd2FudCB0byBlbnN1cmUgY29tcGF0aWJpbGl0eSBpbiBuZ2NjIGZvciBvdXRkYXRlZCBsaWJyYXJpZXMgdGhhdFxuICAgICAgICAvLyBoYXZlIG5vdCBtaWdyYXRlZCB0byBleHBsaWNpdCBkZWNvcmF0b3JzLiBTZWU6IGh0dHBzOi8vaGFja21kLmlvL0BhbHgvcnlmWVl1dnpILlxuICAgICAgICAvKiBjb21waWxlVW5kZWNvcmF0ZWRDbGFzc2VzV2l0aEFuZ3VsYXJGZWF0dXJlcyAqLyB0cnVlLFxuICAgICAgICBOT09QX1BFUkZfUkVDT1JERVJcbiAgICApIGFzIERlY29yYXRvckhhbmRsZXI8dW5rbm93biwgdW5rbm93biwgU2VtYW50aWNTeW1ib2x8bnVsbCx1bmtub3duPixcbiAgICAvLyBjbGFuZy1mb3JtYXQgb25cbiAgICAvLyBQaXBlIGhhbmRsZXIgbXVzdCBiZSBiZWZvcmUgaW5qZWN0YWJsZSBoYW5kbGVyIGluIGxpc3Qgc28gcGlwZSBmYWN0b3JpZXMgYXJlIHByaW50ZWRcbiAgICAvLyBiZWZvcmUgaW5qZWN0YWJsZSBmYWN0b3JpZXMgKHNvIGluamVjdGFibGUgZmFjdG9yaWVzIGNhbiBkZWxlZ2F0ZSB0byB0aGVtKVxuICAgIG5ldyBQaXBlRGVjb3JhdG9ySGFuZGxlcihcbiAgICAgICAgdGhpcy5yZWZsZWN0aW9uSG9zdCwgdGhpcy5ldmFsdWF0b3IsIHRoaXMubWV0YVJlZ2lzdHJ5LCB0aGlzLnNjb3BlUmVnaXN0cnksXG4gICAgICAgIHRoaXMuaW5qZWN0YWJsZVJlZ2lzdHJ5LCB0aGlzLmlzQ29yZSwgTk9PUF9QRVJGX1JFQ09SREVSKSxcbiAgICBuZXcgSW5qZWN0YWJsZURlY29yYXRvckhhbmRsZXIoXG4gICAgICAgIHRoaXMucmVmbGVjdGlvbkhvc3QsIHRoaXMuaXNDb3JlLFxuICAgICAgICAvKiBzdHJpY3RDdG9yRGVwcyAqLyBmYWxzZSwgdGhpcy5pbmplY3RhYmxlUmVnaXN0cnksIE5PT1BfUEVSRl9SRUNPUkRFUixcbiAgICAgICAgLyogZXJyb3JPbkR1cGxpY2F0ZVByb3YgKi8gZmFsc2UpLFxuICAgIG5ldyBOZ01vZHVsZURlY29yYXRvckhhbmRsZXIoXG4gICAgICAgIHRoaXMucmVmbGVjdGlvbkhvc3QsIHRoaXMuZXZhbHVhdG9yLCB0aGlzLmZ1bGxNZXRhUmVhZGVyLCB0aGlzLmZ1bGxSZWdpc3RyeSxcbiAgICAgICAgdGhpcy5zY29wZVJlZ2lzdHJ5LCB0aGlzLnJlZmVyZW5jZXNSZWdpc3RyeSwgdGhpcy5pc0NvcmUsIC8qIHJvdXRlQW5hbHl6ZXIgKi8gbnVsbCxcbiAgICAgICAgdGhpcy5yZWZFbWl0dGVyLFxuICAgICAgICAvKiBmYWN0b3J5VHJhY2tlciAqLyBudWxsLCAhIXRoaXMuY29tcGlsZXJPcHRpb25zLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyLFxuICAgICAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeSwgTk9PUF9QRVJGX1JFQ09SREVSKSxcbiAgXTtcbiAgY29tcGlsZXIgPSBuZXcgTmdjY1RyYWl0Q29tcGlsZXIodGhpcy5oYW5kbGVycywgdGhpcy5yZWZsZWN0aW9uSG9zdCk7XG4gIG1pZ3JhdGlvbnM6IE1pZ3JhdGlvbltdID0gW1xuICAgIG5ldyBVbmRlY29yYXRlZFBhcmVudE1pZ3JhdGlvbigpLFxuICAgIG5ldyBVbmRlY29yYXRlZENoaWxkTWlncmF0aW9uKCksXG4gICAgbmV3IE1pc3NpbmdJbmplY3RhYmxlTWlncmF0aW9uKCksXG4gIF07XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0sIHByaXZhdGUgYnVuZGxlOiBFbnRyeVBvaW50QnVuZGxlLFxuICAgICAgcHJpdmF0ZSByZWZsZWN0aW9uSG9zdDogTmdjY1JlZmxlY3Rpb25Ib3N0LCBwcml2YXRlIHJlZmVyZW5jZXNSZWdpc3RyeTogUmVmZXJlbmNlc1JlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBkaWFnbm9zdGljSGFuZGxlcjogKGVycm9yOiB0cy5EaWFnbm9zdGljKSA9PiB2b2lkID0gKCkgPT4ge30sXG4gICAgICBwcml2YXRlIHRzQ29uZmlnOiBQYXJzZWRDb25maWd1cmF0aW9ufG51bGwgPSBudWxsKSB7fVxuXG4gIC8qKlxuICAgKiBBbmFseXplIGEgcHJvZ3JhbSB0byBmaW5kIGFsbCB0aGUgZGVjb3JhdGVkIGZpbGVzIHNob3VsZCBiZSB0cmFuc2Zvcm1lZC5cbiAgICpcbiAgICogQHJldHVybnMgYSBtYXAgb2YgdGhlIHNvdXJjZSBmaWxlcyB0byB0aGUgYW5hbHlzaXMgZm9yIHRob3NlIGZpbGVzLlxuICAgKi9cbiAgYW5hbHl6ZVByb2dyYW0oKTogRGVjb3JhdGlvbkFuYWx5c2VzIHtcbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgdGhpcy5wcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmICghc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSAmJlxuICAgICAgICAgIGlzV2l0aGluUGFja2FnZSh0aGlzLnBhY2thZ2VQYXRoLCBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNvdXJjZUZpbGUpKSkge1xuICAgICAgICB0aGlzLmNvbXBpbGVyLmFuYWx5emVGaWxlKHNvdXJjZUZpbGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuYXBwbHlNaWdyYXRpb25zKCk7XG5cbiAgICB0aGlzLmNvbXBpbGVyLnJlc29sdmUoKTtcblxuICAgIHRoaXMucmVwb3J0RGlhZ25vc3RpY3MoKTtcblxuICAgIGNvbnN0IGRlY29yYXRpb25BbmFseXNlcyA9IG5ldyBEZWNvcmF0aW9uQW5hbHlzZXMoKTtcbiAgICBmb3IgKGNvbnN0IGFuYWx5emVkRmlsZSBvZiB0aGlzLmNvbXBpbGVyLmFuYWx5emVkRmlsZXMpIHtcbiAgICAgIGNvbnN0IGNvbXBpbGVkRmlsZSA9IHRoaXMuY29tcGlsZUZpbGUoYW5hbHl6ZWRGaWxlKTtcbiAgICAgIGRlY29yYXRpb25BbmFseXNlcy5zZXQoY29tcGlsZWRGaWxlLnNvdXJjZUZpbGUsIGNvbXBpbGVkRmlsZSk7XG4gICAgfVxuICAgIHJldHVybiBkZWNvcmF0aW9uQW5hbHlzZXM7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXBwbHlNaWdyYXRpb25zKCk6IHZvaWQge1xuICAgIGNvbnN0IG1pZ3JhdGlvbkhvc3QgPSBuZXcgRGVmYXVsdE1pZ3JhdGlvbkhvc3QoXG4gICAgICAgIHRoaXMucmVmbGVjdGlvbkhvc3QsIHRoaXMuZnVsbE1ldGFSZWFkZXIsIHRoaXMuZXZhbHVhdG9yLCB0aGlzLmNvbXBpbGVyLFxuICAgICAgICB0aGlzLmJ1bmRsZS5lbnRyeVBvaW50LnBhdGgpO1xuXG4gICAgdGhpcy5taWdyYXRpb25zLmZvckVhY2gobWlncmF0aW9uID0+IHtcbiAgICAgIHRoaXMuY29tcGlsZXIuYW5hbHl6ZWRGaWxlcy5mb3JFYWNoKGFuYWx5emVkRmlsZSA9PiB7XG4gICAgICAgIGNvbnN0IHJlY29yZHMgPSB0aGlzLmNvbXBpbGVyLnJlY29yZHNGb3IoYW5hbHl6ZWRGaWxlKTtcbiAgICAgICAgaWYgKHJlY29yZHMgPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fzc2VydGlvbiBlcnJvcjogZmlsZSB0byBtaWdyYXRlIG11c3QgaGF2ZSByZWNvcmRzLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVjb3Jkcy5mb3JFYWNoKHJlY29yZCA9PiB7XG4gICAgICAgICAgY29uc3QgYWRkRGlhZ25vc3RpYyA9IChkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVjb3JkLm1ldGFEaWFnbm9zdGljcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICByZWNvcmQubWV0YURpYWdub3N0aWNzID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWNvcmQubWV0YURpYWdub3N0aWNzLnB1c2goZGlhZ25vc3RpYyk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBtaWdyYXRpb24uYXBwbHkocmVjb3JkLm5vZGUsIG1pZ3JhdGlvbkhvc3QpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBhZGREaWFnbm9zdGljKHJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKGlzRmF0YWxEaWFnbm9zdGljRXJyb3IoZSkpIHtcbiAgICAgICAgICAgICAgYWRkRGlhZ25vc3RpYyhlLnRvRGlhZ25vc3RpYygpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIHJlcG9ydERpYWdub3N0aWNzKCkge1xuICAgIHRoaXMuY29tcGlsZXIuZGlhZ25vc3RpY3MuZm9yRWFjaCh0aGlzLmRpYWdub3N0aWNIYW5kbGVyKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBjb21waWxlRmlsZShzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogQ29tcGlsZWRGaWxlIHtcbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG4gICAgY29uc3QgcmVjb3JkcyA9IHRoaXMuY29tcGlsZXIucmVjb3Jkc0Zvcihzb3VyY2VGaWxlKTtcbiAgICBpZiAocmVjb3JkcyA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBc3NlcnRpb24gZXJyb3I6IGZpbGUgdG8gY29tcGlsZSBtdXN0IGhhdmUgcmVjb3Jkcy4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb21waWxlZENsYXNzZXM6IENvbXBpbGVkQ2xhc3NbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCByZWNvcmQgb2YgcmVjb3Jkcykge1xuICAgICAgY29uc3QgY29tcGlsYXRpb24gPSB0aGlzLmNvbXBpbGVyLmNvbXBpbGUocmVjb3JkLm5vZGUsIGNvbnN0YW50UG9vbCk7XG4gICAgICBpZiAoY29tcGlsYXRpb24gPT09IG51bGwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbXBpbGVkQ2xhc3Nlcy5wdXNoKHtcbiAgICAgICAgbmFtZTogcmVjb3JkLm5vZGUubmFtZS50ZXh0LFxuICAgICAgICBkZWNvcmF0b3JzOiB0aGlzLmNvbXBpbGVyLmdldEFsbERlY29yYXRvcnMocmVjb3JkLm5vZGUpLFxuICAgICAgICBkZWNsYXJhdGlvbjogcmVjb3JkLm5vZGUsXG4gICAgICAgIGNvbXBpbGF0aW9uXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLmdldFJlZXhwb3J0c0ZvclNvdXJjZUZpbGUoc291cmNlRmlsZSk7XG4gICAgcmV0dXJuIHtjb25zdGFudFBvb2wsIHNvdXJjZUZpbGU6IHNvdXJjZUZpbGUsIGNvbXBpbGVkQ2xhc3NlcywgcmVleHBvcnRzfTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UmVleHBvcnRzRm9yU291cmNlRmlsZShzZjogdHMuU291cmNlRmlsZSk6IFJlZXhwb3J0W10ge1xuICAgIGNvbnN0IGV4cG9ydFN0YXRlbWVudHMgPSB0aGlzLmNvbXBpbGVyLmV4cG9ydFN0YXRlbWVudHM7XG4gICAgaWYgKCFleHBvcnRTdGF0ZW1lbnRzLmhhcyhzZi5maWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgY29uc3QgZXhwb3J0cyA9IGV4cG9ydFN0YXRlbWVudHMuZ2V0KHNmLmZpbGVOYW1lKSE7XG5cbiAgICBjb25zdCByZWV4cG9ydHM6IFJlZXhwb3J0W10gPSBbXTtcbiAgICBleHBvcnRzLmZvckVhY2goKFtmcm9tTW9kdWxlLCBzeW1ib2xOYW1lXSwgYXNBbGlhcykgPT4ge1xuICAgICAgcmVleHBvcnRzLnB1c2goe2FzQWxpYXMsIGZyb21Nb2R1bGUsIHN5bWJvbE5hbWV9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVleHBvcnRzO1xuICB9XG59XG4iXX0=