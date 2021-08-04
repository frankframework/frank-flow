/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { ErrorCode, FatalDiagnosticError } from '../../diagnostics';
import { PerfEvent } from '../../perf';
import { getSourceFile } from '../../util/src/typescript';
import { CompilationMode, HandlerPrecedence } from './api';
import { Trait, TraitState } from './trait';
/**
 * The heart of Angular compilation.
 *
 * The `TraitCompiler` is responsible for processing all classes in the program. Any time a
 * `DecoratorHandler` matches a class, a "trait" is created to represent that Angular aspect of the
 * class (such as the class having a component definition).
 *
 * The `TraitCompiler` transitions each trait through the various phases of compilation, culminating
 * in the production of `CompileResult`s instructing the compiler to apply various mutations to the
 * class (like adding fields or type declarations).
 */
export class TraitCompiler {
    constructor(handlers, reflector, perf, incrementalBuild, compileNonExportedClasses, compilationMode, dtsTransforms, semanticDepGraphUpdater) {
        this.handlers = handlers;
        this.reflector = reflector;
        this.perf = perf;
        this.incrementalBuild = incrementalBuild;
        this.compileNonExportedClasses = compileNonExportedClasses;
        this.compilationMode = compilationMode;
        this.dtsTransforms = dtsTransforms;
        this.semanticDepGraphUpdater = semanticDepGraphUpdater;
        /**
         * Maps class declarations to their `ClassRecord`, which tracks the Ivy traits being applied to
         * those classes.
         */
        this.classes = new Map();
        /**
         * Maps source files to any class declaration(s) within them which have been discovered to contain
         * Ivy traits.
         */
        this.fileToClasses = new Map();
        this.reexportMap = new Map();
        this.handlersByName = new Map();
        for (const handler of handlers) {
            this.handlersByName.set(handler.name, handler);
        }
    }
    analyzeSync(sf) {
        this.analyze(sf, false);
    }
    analyzeAsync(sf) {
        return this.analyze(sf, true);
    }
    analyze(sf, preanalyze) {
        // We shouldn't analyze declaration files.
        if (sf.isDeclarationFile) {
            return undefined;
        }
        // analyze() really wants to return `Promise<void>|void`, but TypeScript cannot narrow a return
        // type of 'void', so `undefined` is used instead.
        const promises = [];
        const priorWork = this.incrementalBuild.priorAnalysisFor(sf);
        if (priorWork !== null) {
            for (const priorRecord of priorWork) {
                this.adopt(priorRecord);
            }
            this.perf.eventCount(PerfEvent.SourceFileReuseAnalysis);
            this.perf.eventCount(PerfEvent.TraitReuseAnalysis, priorWork.length);
            // Skip the rest of analysis, as this file's prior traits are being reused.
            return;
        }
        const visit = (node) => {
            if (this.reflector.isClass(node)) {
                this.analyzeClass(node, preanalyze ? promises : null);
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
        if (preanalyze && promises.length > 0) {
            return Promise.all(promises).then(() => undefined);
        }
        else {
            return undefined;
        }
    }
    recordFor(clazz) {
        if (this.classes.has(clazz)) {
            return this.classes.get(clazz);
        }
        else {
            return null;
        }
    }
    recordsFor(sf) {
        if (!this.fileToClasses.has(sf)) {
            return null;
        }
        const records = [];
        for (const clazz of this.fileToClasses.get(sf)) {
            records.push(this.classes.get(clazz));
        }
        return records;
    }
    getAnalyzedRecords() {
        const result = new Map();
        for (const [sf, classes] of this.fileToClasses) {
            const records = [];
            for (const clazz of classes) {
                records.push(this.classes.get(clazz));
            }
            result.set(sf, records);
        }
        return result;
    }
    /**
     * Import a `ClassRecord` from a previous compilation.
     *
     * Traits from the `ClassRecord` have accurate metadata, but the `handler` is from the old program
     * and needs to be updated (matching is done by name). A new pending trait is created and then
     * transitioned to analyzed using the previous analysis. If the trait is in the errored state,
     * instead the errors are copied over.
     */
    adopt(priorRecord) {
        const record = {
            hasPrimaryHandler: priorRecord.hasPrimaryHandler,
            hasWeakHandlers: priorRecord.hasWeakHandlers,
            metaDiagnostics: priorRecord.metaDiagnostics,
            node: priorRecord.node,
            traits: [],
        };
        for (const priorTrait of priorRecord.traits) {
            const handler = this.handlersByName.get(priorTrait.handler.name);
            let trait = Trait.pending(handler, priorTrait.detected);
            if (priorTrait.state === TraitState.Analyzed || priorTrait.state === TraitState.Resolved) {
                const symbol = this.makeSymbolForTrait(handler, record.node, priorTrait.analysis);
                trait = trait.toAnalyzed(priorTrait.analysis, priorTrait.analysisDiagnostics, symbol);
                if (trait.analysis !== null && trait.handler.register !== undefined) {
                    trait.handler.register(record.node, trait.analysis);
                }
            }
            else if (priorTrait.state === TraitState.Skipped) {
                trait = trait.toSkipped();
            }
            record.traits.push(trait);
        }
        this.classes.set(record.node, record);
        const sf = record.node.getSourceFile();
        if (!this.fileToClasses.has(sf)) {
            this.fileToClasses.set(sf, new Set());
        }
        this.fileToClasses.get(sf).add(record.node);
    }
    scanClassForTraits(clazz) {
        if (!this.compileNonExportedClasses && !this.reflector.isStaticallyExported(clazz)) {
            return null;
        }
        const decorators = this.reflector.getDecoratorsOfDeclaration(clazz);
        return this.detectTraits(clazz, decorators);
    }
    detectTraits(clazz, decorators) {
        let record = this.recordFor(clazz);
        let foundTraits = [];
        for (const handler of this.handlers) {
            const result = handler.detect(clazz, decorators);
            if (result === undefined) {
                continue;
            }
            const isPrimaryHandler = handler.precedence === HandlerPrecedence.PRIMARY;
            const isWeakHandler = handler.precedence === HandlerPrecedence.WEAK;
            const trait = Trait.pending(handler, result);
            foundTraits.push(trait);
            if (record === null) {
                // This is the first handler to match this class. This path is a fast path through which
                // most classes will flow.
                record = {
                    node: clazz,
                    traits: [trait],
                    metaDiagnostics: null,
                    hasPrimaryHandler: isPrimaryHandler,
                    hasWeakHandlers: isWeakHandler,
                };
                this.classes.set(clazz, record);
                const sf = clazz.getSourceFile();
                if (!this.fileToClasses.has(sf)) {
                    this.fileToClasses.set(sf, new Set());
                }
                this.fileToClasses.get(sf).add(clazz);
            }
            else {
                // This is at least the second handler to match this class. This is a slower path that some
                // classes will go through, which validates that the set of decorators applied to the class
                // is valid.
                // Validate according to rules as follows:
                //
                // * WEAK handlers are removed if a non-WEAK handler matches.
                // * Only one PRIMARY handler can match at a time. Any other PRIMARY handler matching a
                //   class with an existing PRIMARY handler is an error.
                if (!isWeakHandler && record.hasWeakHandlers) {
                    // The current handler is not a WEAK handler, but the class has other WEAK handlers.
                    // Remove them.
                    record.traits =
                        record.traits.filter(field => field.handler.precedence !== HandlerPrecedence.WEAK);
                    record.hasWeakHandlers = false;
                }
                else if (isWeakHandler && !record.hasWeakHandlers) {
                    // The current handler is a WEAK handler, but the class has non-WEAK handlers already.
                    // Drop the current one.
                    continue;
                }
                if (isPrimaryHandler && record.hasPrimaryHandler) {
                    // The class already has a PRIMARY handler, and another one just matched.
                    record.metaDiagnostics = [{
                            category: ts.DiagnosticCategory.Error,
                            code: Number('-99' + ErrorCode.DECORATOR_COLLISION),
                            file: getSourceFile(clazz),
                            start: clazz.getStart(undefined, false),
                            length: clazz.getWidth(),
                            messageText: 'Two incompatible decorators on class',
                        }];
                    record.traits = foundTraits = [];
                    break;
                }
                // Otherwise, it's safe to accept the multiple decorators here. Update some of the metadata
                // regarding this class.
                record.traits.push(trait);
                record.hasPrimaryHandler = record.hasPrimaryHandler || isPrimaryHandler;
            }
        }
        return foundTraits.length > 0 ? foundTraits : null;
    }
    makeSymbolForTrait(handler, decl, analysis) {
        if (analysis === null) {
            return null;
        }
        const symbol = handler.symbol(decl, analysis);
        if (symbol !== null && this.semanticDepGraphUpdater !== null) {
            const isPrimary = handler.precedence === HandlerPrecedence.PRIMARY;
            if (!isPrimary) {
                throw new Error(`AssertionError: ${handler.name} returned a symbol but is not a primary handler.`);
            }
            this.semanticDepGraphUpdater.registerSymbol(symbol);
        }
        return symbol;
    }
    analyzeClass(clazz, preanalyzeQueue) {
        const traits = this.scanClassForTraits(clazz);
        if (traits === null) {
            // There are no Ivy traits on the class, so it can safely be skipped.
            return;
        }
        for (const trait of traits) {
            const analyze = () => this.analyzeTrait(clazz, trait);
            let preanalysis = null;
            if (preanalyzeQueue !== null && trait.handler.preanalyze !== undefined) {
                // Attempt to run preanalysis. This could fail with a `FatalDiagnosticError`; catch it if it
                // does.
                try {
                    preanalysis = trait.handler.preanalyze(clazz, trait.detected.metadata) || null;
                }
                catch (err) {
                    if (err instanceof FatalDiagnosticError) {
                        trait.toAnalyzed(null, [err.toDiagnostic()], null);
                        return;
                    }
                    else {
                        throw err;
                    }
                }
            }
            if (preanalysis !== null) {
                preanalyzeQueue.push(preanalysis.then(analyze));
            }
            else {
                analyze();
            }
        }
    }
    analyzeTrait(clazz, trait, flags) {
        var _a, _b, _c;
        if (trait.state !== TraitState.Pending) {
            throw new Error(`Attempt to analyze trait of ${clazz.name.text} in state ${TraitState[trait.state]} (expected DETECTED)`);
        }
        this.perf.eventCount(PerfEvent.TraitAnalyze);
        // Attempt analysis. This could fail with a `FatalDiagnosticError`; catch it if it does.
        let result;
        try {
            result = trait.handler.analyze(clazz, trait.detected.metadata, flags);
        }
        catch (err) {
            if (err instanceof FatalDiagnosticError) {
                trait.toAnalyzed(null, [err.toDiagnostic()], null);
                return;
            }
            else {
                throw err;
            }
        }
        const symbol = this.makeSymbolForTrait(trait.handler, clazz, (_a = result.analysis) !== null && _a !== void 0 ? _a : null);
        if (result.analysis !== undefined && trait.handler.register !== undefined) {
            trait.handler.register(clazz, result.analysis);
        }
        trait = trait.toAnalyzed((_b = result.analysis) !== null && _b !== void 0 ? _b : null, (_c = result.diagnostics) !== null && _c !== void 0 ? _c : null, symbol);
    }
    resolve() {
        var _a, _b;
        const classes = Array.from(this.classes.keys());
        for (const clazz of classes) {
            const record = this.classes.get(clazz);
            for (let trait of record.traits) {
                const handler = trait.handler;
                switch (trait.state) {
                    case TraitState.Skipped:
                        continue;
                    case TraitState.Pending:
                        throw new Error(`Resolving a trait that hasn't been analyzed: ${clazz.name.text} / ${Object.getPrototypeOf(trait.handler).constructor.name}`);
                    case TraitState.Resolved:
                        throw new Error(`Resolving an already resolved trait`);
                }
                if (trait.analysis === null) {
                    // No analysis results, cannot further process this trait.
                    continue;
                }
                if (handler.resolve === undefined) {
                    // No resolution of this trait needed - it's considered successful by default.
                    trait = trait.toResolved(null, null);
                    continue;
                }
                let result;
                try {
                    result = handler.resolve(clazz, trait.analysis, trait.symbol);
                }
                catch (err) {
                    if (err instanceof FatalDiagnosticError) {
                        trait = trait.toResolved(null, [err.toDiagnostic()]);
                        continue;
                    }
                    else {
                        throw err;
                    }
                }
                trait = trait.toResolved((_a = result.data) !== null && _a !== void 0 ? _a : null, (_b = result.diagnostics) !== null && _b !== void 0 ? _b : null);
                if (result.reexports !== undefined) {
                    const fileName = clazz.getSourceFile().fileName;
                    if (!this.reexportMap.has(fileName)) {
                        this.reexportMap.set(fileName, new Map());
                    }
                    const fileReexports = this.reexportMap.get(fileName);
                    for (const reexport of result.reexports) {
                        fileReexports.set(reexport.asAlias, [reexport.fromModule, reexport.symbolName]);
                    }
                }
            }
        }
    }
    /**
     * Generate type-checking code into the `TypeCheckContext` for any components within the given
     * `ts.SourceFile`.
     */
    typeCheck(sf, ctx) {
        if (!this.fileToClasses.has(sf)) {
            return;
        }
        for (const clazz of this.fileToClasses.get(sf)) {
            const record = this.classes.get(clazz);
            for (const trait of record.traits) {
                if (trait.state !== TraitState.Resolved) {
                    continue;
                }
                else if (trait.handler.typeCheck === undefined) {
                    continue;
                }
                if (trait.resolution !== null) {
                    trait.handler.typeCheck(ctx, clazz, trait.analysis, trait.resolution);
                }
            }
        }
    }
    index(ctx) {
        for (const clazz of this.classes.keys()) {
            const record = this.classes.get(clazz);
            for (const trait of record.traits) {
                if (trait.state !== TraitState.Resolved) {
                    // Skip traits that haven't been resolved successfully.
                    continue;
                }
                else if (trait.handler.index === undefined) {
                    // Skip traits that don't affect indexing.
                    continue;
                }
                if (trait.resolution !== null) {
                    trait.handler.index(ctx, clazz, trait.analysis, trait.resolution);
                }
            }
        }
    }
    xi18n(bundle) {
        for (const clazz of this.classes.keys()) {
            const record = this.classes.get(clazz);
            for (const trait of record.traits) {
                if (trait.state !== TraitState.Analyzed && trait.state !== TraitState.Resolved) {
                    // Skip traits that haven't been analyzed successfully.
                    continue;
                }
                else if (trait.handler.xi18n === undefined) {
                    // Skip traits that don't support xi18n.
                    continue;
                }
                if (trait.analysis !== null) {
                    trait.handler.xi18n(bundle, clazz, trait.analysis);
                }
            }
        }
    }
    updateResources(clazz) {
        if (!this.reflector.isClass(clazz) || !this.classes.has(clazz)) {
            return;
        }
        const record = this.classes.get(clazz);
        for (const trait of record.traits) {
            if (trait.state !== TraitState.Resolved || trait.handler.updateResources === undefined) {
                continue;
            }
            trait.handler.updateResources(clazz, trait.analysis, trait.resolution);
        }
    }
    compile(clazz, constantPool) {
        const original = ts.getOriginalNode(clazz);
        if (!this.reflector.isClass(clazz) || !this.reflector.isClass(original) ||
            !this.classes.has(original)) {
            return null;
        }
        const record = this.classes.get(original);
        let res = [];
        for (const trait of record.traits) {
            if (trait.state !== TraitState.Resolved || trait.analysisDiagnostics !== null ||
                trait.resolveDiagnostics !== null) {
                // Cannot compile a trait that is not resolved, or had any errors in its declaration.
                continue;
            }
            // `trait.resolution` is non-null asserted here because TypeScript does not recognize that
            // `Readonly<unknown>` is nullable (as `unknown` itself is nullable) due to the way that
            // `Readonly` works.
            let compileRes;
            if (this.compilationMode === CompilationMode.PARTIAL &&
                trait.handler.compilePartial !== undefined) {
                compileRes = trait.handler.compilePartial(clazz, trait.analysis, trait.resolution);
            }
            else {
                compileRes =
                    trait.handler.compileFull(clazz, trait.analysis, trait.resolution, constantPool);
            }
            const compileMatchRes = compileRes;
            if (Array.isArray(compileMatchRes)) {
                for (const result of compileMatchRes) {
                    if (!res.some(r => r.name === result.name)) {
                        res.push(result);
                    }
                }
            }
            else if (!res.some(result => result.name === compileMatchRes.name)) {
                res.push(compileMatchRes);
            }
        }
        // Look up the .d.ts transformer for the input file and record that at least one field was
        // generated, which will allow the .d.ts to be transformed later.
        this.dtsTransforms.getIvyDeclarationTransform(original.getSourceFile())
            .addFields(original, res);
        // Return the instruction to the transformer so the fields will be added.
        return res.length > 0 ? res : null;
    }
    decoratorsFor(node) {
        const original = ts.getOriginalNode(node);
        if (!this.reflector.isClass(original) || !this.classes.has(original)) {
            return [];
        }
        const record = this.classes.get(original);
        const decorators = [];
        for (const trait of record.traits) {
            if (trait.state !== TraitState.Resolved) {
                continue;
            }
            if (trait.detected.trigger !== null && ts.isDecorator(trait.detected.trigger)) {
                decorators.push(trait.detected.trigger);
            }
        }
        return decorators;
    }
    get diagnostics() {
        const diagnostics = [];
        for (const clazz of this.classes.keys()) {
            const record = this.classes.get(clazz);
            if (record.metaDiagnostics !== null) {
                diagnostics.push(...record.metaDiagnostics);
            }
            for (const trait of record.traits) {
                if ((trait.state === TraitState.Analyzed || trait.state === TraitState.Resolved) &&
                    trait.analysisDiagnostics !== null) {
                    diagnostics.push(...trait.analysisDiagnostics);
                }
                if (trait.state === TraitState.Resolved && trait.resolveDiagnostics !== null) {
                    diagnostics.push(...trait.resolveDiagnostics);
                }
            }
        }
        return diagnostics;
    }
    get exportStatements() {
        return this.reexportMap;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3RyYW5zZm9ybS9zcmMvY29tcGlsYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLFNBQVMsRUFBRSxvQkFBb0IsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBSWxFLE9BQU8sRUFBQyxTQUFTLEVBQWUsTUFBTSxZQUFZLENBQUM7QUFHbkQsT0FBTyxFQUFDLGFBQWEsRUFBYSxNQUFNLDJCQUEyQixDQUFDO0FBR3BFLE9BQU8sRUFBaUIsZUFBZSxFQUFpRCxpQkFBaUIsRUFBZ0IsTUFBTSxPQUFPLENBQUM7QUFFdkksT0FBTyxFQUFlLEtBQUssRUFBRSxVQUFVLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFxQ3hEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLE9BQU8sYUFBYTtJQWtCeEIsWUFDWSxRQUE0RSxFQUM1RSxTQUF5QixFQUFVLElBQWtCLEVBQ3JELGdCQUF3RCxFQUN4RCx5QkFBa0MsRUFBVSxlQUFnQyxFQUM1RSxhQUFtQyxFQUNuQyx1QkFBcUQ7UUFMckQsYUFBUSxHQUFSLFFBQVEsQ0FBb0U7UUFDNUUsY0FBUyxHQUFULFNBQVMsQ0FBZ0I7UUFBVSxTQUFJLEdBQUosSUFBSSxDQUFjO1FBQ3JELHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBd0M7UUFDeEQsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFTO1FBQVUsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQzVFLGtCQUFhLEdBQWIsYUFBYSxDQUFzQjtRQUNuQyw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQThCO1FBdkJqRTs7O1dBR0c7UUFDSyxZQUFPLEdBQUcsSUFBSSxHQUFHLEVBQWlDLENBQUM7UUFF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SyxDQUFDLGtCQUFrQixDQUFDLENBQUM7aUJBQy9DO2FBQ0Y7U0FDRjtRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxJQUFJLGdCQUFnQjtRQUNsQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFcnJvckNvZGUsIEZhdGFsRGlhZ25vc3RpY0Vycm9yfSBmcm9tICcuLi8uLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge0luY3JlbWVudGFsQnVpbGR9IGZyb20gJy4uLy4uL2luY3JlbWVudGFsL2FwaSc7XG5pbXBvcnQge1NlbWFudGljRGVwR3JhcGhVcGRhdGVyLCBTZW1hbnRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vaW5jcmVtZW50YWwvc2VtYW50aWNfZ3JhcGgnO1xuaW1wb3J0IHtJbmRleGluZ0NvbnRleHR9IGZyb20gJy4uLy4uL2luZGV4ZXInO1xuaW1wb3J0IHtQZXJmRXZlbnQsIFBlcmZSZWNvcmRlcn0gZnJvbSAnLi4vLi4vcGVyZic7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIERlY2xhcmF0aW9uTm9kZSwgRGVjb3JhdG9yLCBSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge1Byb2dyYW1UeXBlQ2hlY2tBZGFwdGVyLCBUeXBlQ2hlY2tDb250ZXh0fSBmcm9tICcuLi8uLi90eXBlY2hlY2svYXBpJztcbmltcG9ydCB7Z2V0U291cmNlRmlsZSwgaXNFeHBvcnRlZH0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5pbXBvcnQge1hpMThuQ29udGV4dH0gZnJvbSAnLi4vLi4veGkxOG4nO1xuXG5pbXBvcnQge0FuYWx5c2lzT3V0cHV0LCBDb21waWxhdGlvbk1vZGUsIENvbXBpbGVSZXN1bHQsIERlY29yYXRvckhhbmRsZXIsIEhhbmRsZXJGbGFncywgSGFuZGxlclByZWNlZGVuY2UsIFJlc29sdmVSZXN1bHR9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7RHRzVHJhbnNmb3JtUmVnaXN0cnl9IGZyb20gJy4vZGVjbGFyYXRpb24nO1xuaW1wb3J0IHtQZW5kaW5nVHJhaXQsIFRyYWl0LCBUcmFpdFN0YXRlfSBmcm9tICcuL3RyYWl0JztcblxuXG4vKipcbiAqIFJlY29yZHMgaW5mb3JtYXRpb24gYWJvdXQgYSBzcGVjaWZpYyBjbGFzcyB0aGF0IGhhcyBtYXRjaGVkIHRyYWl0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDbGFzc1JlY29yZCB7XG4gIC8qKlxuICAgKiBUaGUgYENsYXNzRGVjbGFyYXRpb25gIG9mIHRoZSBjbGFzcyB3aGljaCBoYXMgQW5ndWxhciB0cmFpdHMgYXBwbGllZC5cbiAgICovXG4gIG5vZGU6IENsYXNzRGVjbGFyYXRpb247XG5cbiAgLyoqXG4gICAqIEFsbCB0cmFpdHMgd2hpY2ggbWF0Y2hlZCBvbiB0aGUgY2xhc3MuXG4gICAqL1xuICB0cmFpdHM6IFRyYWl0PHVua25vd24sIHVua25vd24sIFNlbWFudGljU3ltYm9sfG51bGwsIHVua25vd24+W107XG5cbiAgLyoqXG4gICAqIE1ldGEtZGlhZ25vc3RpY3MgYWJvdXQgdGhlIGNsYXNzLCB3aGljaCBhcmUgdXN1YWxseSByZWxhdGVkIHRvIHdoZXRoZXIgY2VydGFpbiBjb21iaW5hdGlvbnMgb2ZcbiAgICogQW5ndWxhciBkZWNvcmF0b3JzIGFyZSBub3QgcGVybWl0dGVkLlxuICAgKi9cbiAgbWV0YURpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW118bnVsbDtcblxuICAvLyBTdWJzZXF1ZW50IGZpZWxkcyBhcmUgXCJpbnRlcm5hbFwiIGFuZCB1c2VkIGR1cmluZyB0aGUgbWF0Y2hpbmcgb2YgYERlY29yYXRvckhhbmRsZXJgcy4gVGhpcyBpc1xuICAvLyBtdXRhYmxlIHN0YXRlIGR1cmluZyB0aGUgYGRldGVjdGAvYGFuYWx5emVgIHBoYXNlcyBvZiBjb21waWxhdGlvbi5cblxuICAvKipcbiAgICogV2hldGhlciBgdHJhaXRzYCBjb250YWlucyB0cmFpdHMgbWF0Y2hlZCBmcm9tIGBEZWNvcmF0b3JIYW5kbGVyYHMgbWFya2VkIGFzIGBXRUFLYC5cbiAgICovXG4gIGhhc1dlYWtIYW5kbGVyczogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciBgdHJhaXRzYCBjb250YWlucyBhIHRyYWl0IGZyb20gYSBgRGVjb3JhdG9ySGFuZGxlcmAgbWF0Y2hlZCBhcyBgUFJJTUFSWWAuXG4gICAqL1xuICBoYXNQcmltYXJ5SGFuZGxlcjogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBUaGUgaGVhcnQgb2YgQW5ndWxhciBjb21waWxhdGlvbi5cbiAqXG4gKiBUaGUgYFRyYWl0Q29tcGlsZXJgIGlzIHJlc3BvbnNpYmxlIGZvciBwcm9jZXNzaW5nIGFsbCBjbGFzc2VzIGluIHRoZSBwcm9ncmFtLiBBbnkgdGltZSBhXG4gKiBgRGVjb3JhdG9ySGFuZGxlcmAgbWF0Y2hlcyBhIGNsYXNzLCBhIFwidHJhaXRcIiBpcyBjcmVhdGVkIHRvIHJlcHJlc2VudCB0aGF0IEFuZ3VsYXIgYXNwZWN0IG9mIHRoZVxuICogY2xhc3MgKHN1Y2ggYXMgdGhlIGNsYXNzIGhhdmluZyBhIGNvbXBvbmVudCBkZWZpbml0aW9uKS5cbiAqXG4gKiBUaGUgYFRyYWl0Q29tcGlsZXJgIHRyYW5zaXRpb25zIGVhY2ggdHJhaXQgdGhyb3VnaCB0aGUgdmFyaW91cyBwaGFzZXMgb2YgY29tcGlsYXRpb24sIGN1bG1pbmF0aW5nXG4gKiBpbiB0aGUgcHJvZHVjdGlvbiBvZiBgQ29tcGlsZVJlc3VsdGBzIGluc3RydWN0aW5nIHRoZSBjb21waWxlciB0byBhcHBseSB2YXJpb3VzIG11dGF0aW9ucyB0byB0aGVcbiAqIGNsYXNzIChsaWtlIGFkZGluZyBmaWVsZHMgb3IgdHlwZSBkZWNsYXJhdGlvbnMpLlxuICovXG5leHBvcnQgY2xhc3MgVHJhaXRDb21waWxlciBpbXBsZW1lbnRzIFByb2dyYW1UeXBlQ2hlY2tBZGFwdGVyIHtcbiAgLyoqXG4gICAqIE1hcHMgY2xhc3MgZGVjbGFyYXRpb25zIHRvIHRoZWlyIGBDbGFzc1JlY29yZGAsIHdoaWNoIHRyYWNrcyB0aGUgSXZ5IHRyYWl0cyBiZWluZyBhcHBsaWVkIHRvXG4gICAqIHRob3NlIGNsYXNzZXMuXG4gICAqL1xuICBwcml2YXRlIGNsYXNzZXMgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIENsYXNzUmVjb3JkPigpO1xuXG4gIC8qKlxuICAgKiBNYXBzIHNvdXJjZSBmaWxlcyB0byBhbnkgY2xhc3MgZGVjbGFyYXRpb24ocykgd2l0aGluIHRoZW0gd2hpY2ggaGF2ZSBiZWVuIGRpc2NvdmVyZWQgdG8gY29udGFpblxuICAgKiBJdnkgdHJhaXRzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGZpbGVUb0NsYXNzZXMgPSBuZXcgTWFwPHRzLlNvdXJjZUZpbGUsIFNldDxDbGFzc0RlY2xhcmF0aW9uPj4oKTtcblxuICBwcml2YXRlIHJlZXhwb3J0TWFwID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIFtzdHJpbmcsIHN0cmluZ10+PigpO1xuXG4gIHByaXZhdGUgaGFuZGxlcnNCeU5hbWUgPVxuICAgICAgbmV3IE1hcDxzdHJpbmcsIERlY29yYXRvckhhbmRsZXI8dW5rbm93biwgdW5rbm93biwgU2VtYW50aWNTeW1ib2x8bnVsbCwgdW5rbm93bj4+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGhhbmRsZXJzOiBEZWNvcmF0b3JIYW5kbGVyPHVua25vd24sIHVua25vd24sIFNlbWFudGljU3ltYm9sfG51bGwsIHVua25vd24+W10sXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIHByaXZhdGUgcGVyZjogUGVyZlJlY29yZGVyLFxuICAgICAgcHJpdmF0ZSBpbmNyZW1lbnRhbEJ1aWxkOiBJbmNyZW1lbnRhbEJ1aWxkPENsYXNzUmVjb3JkLCB1bmtub3duPixcbiAgICAgIHByaXZhdGUgY29tcGlsZU5vbkV4cG9ydGVkQ2xhc3NlczogYm9vbGVhbiwgcHJpdmF0ZSBjb21waWxhdGlvbk1vZGU6IENvbXBpbGF0aW9uTW9kZSxcbiAgICAgIHByaXZhdGUgZHRzVHJhbnNmb3JtczogRHRzVHJhbnNmb3JtUmVnaXN0cnksXG4gICAgICBwcml2YXRlIHNlbWFudGljRGVwR3JhcGhVcGRhdGVyOiBTZW1hbnRpY0RlcEdyYXBoVXBkYXRlcnxudWxsKSB7XG4gICAgZm9yIChjb25zdCBoYW5kbGVyIG9mIGhhbmRsZXJzKSB7XG4gICAgICB0aGlzLmhhbmRsZXJzQnlOYW1lLnNldChoYW5kbGVyLm5hbWUsIGhhbmRsZXIpO1xuICAgIH1cbiAgfVxuXG4gIGFuYWx5emVTeW5jKHNmOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgdGhpcy5hbmFseXplKHNmLCBmYWxzZSk7XG4gIH1cblxuICBhbmFseXplQXN5bmMoc2Y6IHRzLlNvdXJjZUZpbGUpOiBQcm9taXNlPHZvaWQ+fHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuYW5hbHl6ZShzZiwgdHJ1ZSk7XG4gIH1cblxuICBwcml2YXRlIGFuYWx5emUoc2Y6IHRzLlNvdXJjZUZpbGUsIHByZWFuYWx5emU6IGZhbHNlKTogdm9pZDtcbiAgcHJpdmF0ZSBhbmFseXplKHNmOiB0cy5Tb3VyY2VGaWxlLCBwcmVhbmFseXplOiB0cnVlKTogUHJvbWlzZTx2b2lkPnx1bmRlZmluZWQ7XG4gIHByaXZhdGUgYW5hbHl6ZShzZjogdHMuU291cmNlRmlsZSwgcHJlYW5hbHl6ZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD58dW5kZWZpbmVkIHtcbiAgICAvLyBXZSBzaG91bGRuJ3QgYW5hbHl6ZSBkZWNsYXJhdGlvbiBmaWxlcy5cbiAgICBpZiAoc2YuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gYW5hbHl6ZSgpIHJlYWxseSB3YW50cyB0byByZXR1cm4gYFByb21pc2U8dm9pZD58dm9pZGAsIGJ1dCBUeXBlU2NyaXB0IGNhbm5vdCBuYXJyb3cgYSByZXR1cm5cbiAgICAvLyB0eXBlIG9mICd2b2lkJywgc28gYHVuZGVmaW5lZGAgaXMgdXNlZCBpbnN0ZWFkLlxuICAgIGNvbnN0IHByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblxuICAgIGNvbnN0IHByaW9yV29yayA9IHRoaXMuaW5jcmVtZW50YWxCdWlsZC5wcmlvckFuYWx5c2lzRm9yKHNmKTtcbiAgICBpZiAocHJpb3JXb3JrICE9PSBudWxsKSB7XG4gICAgICBmb3IgKGNvbnN0IHByaW9yUmVjb3JkIG9mIHByaW9yV29yaykge1xuICAgICAgICB0aGlzLmFkb3B0KHByaW9yUmVjb3JkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wZXJmLmV2ZW50Q291bnQoUGVyZkV2ZW50LlNvdXJjZUZpbGVSZXVzZUFuYWx5c2lzKTtcbiAgICAgIHRoaXMucGVyZi5ldmVudENvdW50KFBlcmZFdmVudC5UcmFpdFJldXNlQW5hbHlzaXMsIHByaW9yV29yay5sZW5ndGgpO1xuXG4gICAgICAvLyBTa2lwIHRoZSByZXN0IG9mIGFuYWx5c2lzLCBhcyB0aGlzIGZpbGUncyBwcmlvciB0cmFpdHMgYXJlIGJlaW5nIHJldXNlZC5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB2aXNpdCA9IChub2RlOiB0cy5Ob2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAodGhpcy5yZWZsZWN0b3IuaXNDbGFzcyhub2RlKSkge1xuICAgICAgICB0aGlzLmFuYWx5emVDbGFzcyhub2RlLCBwcmVhbmFseXplID8gcHJvbWlzZXMgOiBudWxsKTtcbiAgICAgIH1cbiAgICAgIHRzLmZvckVhY2hDaGlsZChub2RlLCB2aXNpdCk7XG4gICAgfTtcblxuICAgIHZpc2l0KHNmKTtcblxuICAgIGlmIChwcmVhbmFseXplICYmIHByb21pc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB1bmRlZmluZWQgYXMgdm9pZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgcmVjb3JkRm9yKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogQ2xhc3NSZWNvcmR8bnVsbCB7XG4gICAgaWYgKHRoaXMuY2xhc3Nlcy5oYXMoY2xhenopKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc2VzLmdldChjbGF6eikhO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICByZWNvcmRzRm9yKHNmOiB0cy5Tb3VyY2VGaWxlKTogQ2xhc3NSZWNvcmRbXXxudWxsIHtcbiAgICBpZiAoIXRoaXMuZmlsZVRvQ2xhc3Nlcy5oYXMoc2YpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkczogQ2xhc3NSZWNvcmRbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgY2xhenogb2YgdGhpcy5maWxlVG9DbGFzc2VzLmdldChzZikhKSB7XG4gICAgICByZWNvcmRzLnB1c2godGhpcy5jbGFzc2VzLmdldChjbGF6eikhKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlY29yZHM7XG4gIH1cblxuICBnZXRBbmFseXplZFJlY29yZHMoKTogTWFwPHRzLlNvdXJjZUZpbGUsIENsYXNzUmVjb3JkW10+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHRzLlNvdXJjZUZpbGUsIENsYXNzUmVjb3JkW10+KCk7XG4gICAgZm9yIChjb25zdCBbc2YsIGNsYXNzZXNdIG9mIHRoaXMuZmlsZVRvQ2xhc3Nlcykge1xuICAgICAgY29uc3QgcmVjb3JkczogQ2xhc3NSZWNvcmRbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGF6eiBvZiBjbGFzc2VzKSB7XG4gICAgICAgIHJlY29yZHMucHVzaCh0aGlzLmNsYXNzZXMuZ2V0KGNsYXp6KSEpO1xuICAgICAgfVxuICAgICAgcmVzdWx0LnNldChzZiwgcmVjb3Jkcyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogSW1wb3J0IGEgYENsYXNzUmVjb3JkYCBmcm9tIGEgcHJldmlvdXMgY29tcGlsYXRpb24uXG4gICAqXG4gICAqIFRyYWl0cyBmcm9tIHRoZSBgQ2xhc3NSZWNvcmRgIGhhdmUgYWNjdXJhdGUgbWV0YWRhdGEsIGJ1dCB0aGUgYGhhbmRsZXJgIGlzIGZyb20gdGhlIG9sZCBwcm9ncmFtXG4gICAqIGFuZCBuZWVkcyB0byBiZSB1cGRhdGVkIChtYXRjaGluZyBpcyBkb25lIGJ5IG5hbWUpLiBBIG5ldyBwZW5kaW5nIHRyYWl0IGlzIGNyZWF0ZWQgYW5kIHRoZW5cbiAgICogdHJhbnNpdGlvbmVkIHRvIGFuYWx5emVkIHVzaW5nIHRoZSBwcmV2aW91cyBhbmFseXNpcy4gSWYgdGhlIHRyYWl0IGlzIGluIHRoZSBlcnJvcmVkIHN0YXRlLFxuICAgKiBpbnN0ZWFkIHRoZSBlcnJvcnMgYXJlIGNvcGllZCBvdmVyLlxuICAgKi9cbiAgcHJpdmF0ZSBhZG9wdChwcmlvclJlY29yZDogQ2xhc3NSZWNvcmQpOiB2b2lkIHtcbiAgICBjb25zdCByZWNvcmQ6IENsYXNzUmVjb3JkID0ge1xuICAgICAgaGFzUHJpbWFyeUhhbmRsZXI6IHByaW9yUmVjb3JkLmhhc1ByaW1hcnlIYW5kbGVyLFxuICAgICAgaGFzV2Vha0hhbmRsZXJzOiBwcmlvclJlY29yZC5oYXNXZWFrSGFuZGxlcnMsXG4gICAgICBtZXRhRGlhZ25vc3RpY3M6IHByaW9yUmVjb3JkLm1ldGFEaWFnbm9zdGljcyxcbiAgICAgIG5vZGU6IHByaW9yUmVjb3JkLm5vZGUsXG4gICAgICB0cmFpdHM6IFtdLFxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IHByaW9yVHJhaXQgb2YgcHJpb3JSZWNvcmQudHJhaXRzKSB7XG4gICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5oYW5kbGVyc0J5TmFtZS5nZXQocHJpb3JUcmFpdC5oYW5kbGVyLm5hbWUpITtcbiAgICAgIGxldCB0cmFpdDogVHJhaXQ8dW5rbm93biwgdW5rbm93biwgU2VtYW50aWNTeW1ib2x8bnVsbCwgdW5rbm93bj4gPVxuICAgICAgICAgIFRyYWl0LnBlbmRpbmcoaGFuZGxlciwgcHJpb3JUcmFpdC5kZXRlY3RlZCk7XG5cbiAgICAgIGlmIChwcmlvclRyYWl0LnN0YXRlID09PSBUcmFpdFN0YXRlLkFuYWx5emVkIHx8IHByaW9yVHJhaXQuc3RhdGUgPT09IFRyYWl0U3RhdGUuUmVzb2x2ZWQpIHtcbiAgICAgICAgY29uc3Qgc3ltYm9sID0gdGhpcy5tYWtlU3ltYm9sRm9yVHJhaXQoaGFuZGxlciwgcmVjb3JkLm5vZGUsIHByaW9yVHJhaXQuYW5hbHlzaXMpO1xuICAgICAgICB0cmFpdCA9IHRyYWl0LnRvQW5hbHl6ZWQocHJpb3JUcmFpdC5hbmFseXNpcywgcHJpb3JUcmFpdC5hbmFseXNpc0RpYWdub3N0aWNzLCBzeW1ib2wpO1xuICAgICAgICBpZiAodHJhaXQuYW5hbHlzaXMgIT09IG51bGwgJiYgdHJhaXQuaGFuZGxlci5yZWdpc3RlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdHJhaXQuaGFuZGxlci5yZWdpc3RlcihyZWNvcmQubm9kZSwgdHJhaXQuYW5hbHlzaXMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHByaW9yVHJhaXQuc3RhdGUgPT09IFRyYWl0U3RhdGUuU2tpcHBlZCkge1xuICAgICAgICB0cmFpdCA9IHRyYWl0LnRvU2tpcHBlZCgpO1xuICAgICAgfVxuXG4gICAgICByZWNvcmQudHJhaXRzLnB1c2godHJhaXQpO1xuICAgIH1cblxuICAgIHRoaXMuY2xhc3Nlcy5zZXQocmVjb3JkLm5vZGUsIHJlY29yZCk7XG4gICAgY29uc3Qgc2YgPSByZWNvcmQubm9kZS5nZXRTb3VyY2VGaWxlKCk7XG4gICAgaWYgKCF0aGlzLmZpbGVUb0NsYXNzZXMuaGFzKHNmKSkge1xuICAgICAgdGhpcy5maWxlVG9DbGFzc2VzLnNldChzZiwgbmV3IFNldDxDbGFzc0RlY2xhcmF0aW9uPigpKTtcbiAgICB9XG4gICAgdGhpcy5maWxlVG9DbGFzc2VzLmdldChzZikhLmFkZChyZWNvcmQubm9kZSk7XG4gIH1cblxuICBwcml2YXRlIHNjYW5DbGFzc0ZvclRyYWl0cyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6XG4gICAgICBQZW5kaW5nVHJhaXQ8dW5rbm93biwgdW5rbm93biwgU2VtYW50aWNTeW1ib2x8bnVsbCwgdW5rbm93bj5bXXxudWxsIHtcbiAgICBpZiAoIXRoaXMuY29tcGlsZU5vbkV4cG9ydGVkQ2xhc3NlcyAmJiAhdGhpcy5yZWZsZWN0b3IuaXNTdGF0aWNhbGx5RXhwb3J0ZWQoY2xhenopKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNvcmF0b3JzID0gdGhpcy5yZWZsZWN0b3IuZ2V0RGVjb3JhdG9yc09mRGVjbGFyYXRpb24oY2xhenopO1xuXG4gICAgcmV0dXJuIHRoaXMuZGV0ZWN0VHJhaXRzKGNsYXp6LCBkZWNvcmF0b3JzKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBkZXRlY3RUcmFpdHMoY2xheno6IENsYXNzRGVjbGFyYXRpb24sIGRlY29yYXRvcnM6IERlY29yYXRvcltdfG51bGwpOlxuICAgICAgUGVuZGluZ1RyYWl0PHVua25vd24sIHVua25vd24sIFNlbWFudGljU3ltYm9sfG51bGwsIHVua25vd24+W118bnVsbCB7XG4gICAgbGV0IHJlY29yZDogQ2xhc3NSZWNvcmR8bnVsbCA9IHRoaXMucmVjb3JkRm9yKGNsYXp6KTtcbiAgICBsZXQgZm91bmRUcmFpdHM6IFBlbmRpbmdUcmFpdDx1bmtub3duLCB1bmtub3duLCBTZW1hbnRpY1N5bWJvbHxudWxsLCB1bmtub3duPltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgdGhpcy5oYW5kbGVycykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gaGFuZGxlci5kZXRlY3QoY2xhenosIGRlY29yYXRvcnMpO1xuICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpc1ByaW1hcnlIYW5kbGVyID0gaGFuZGxlci5wcmVjZWRlbmNlID09PSBIYW5kbGVyUHJlY2VkZW5jZS5QUklNQVJZO1xuICAgICAgY29uc3QgaXNXZWFrSGFuZGxlciA9IGhhbmRsZXIucHJlY2VkZW5jZSA9PT0gSGFuZGxlclByZWNlZGVuY2UuV0VBSztcbiAgICAgIGNvbnN0IHRyYWl0ID0gVHJhaXQucGVuZGluZyhoYW5kbGVyLCByZXN1bHQpO1xuXG4gICAgICBmb3VuZFRyYWl0cy5wdXNoKHRyYWl0KTtcblxuICAgICAgaWYgKHJlY29yZCA9PT0gbnVsbCkge1xuICAgICAgICAvLyBUaGlzIGlzIHRoZSBmaXJzdCBoYW5kbGVyIHRvIG1hdGNoIHRoaXMgY2xhc3MuIFRoaXMgcGF0aCBpcyBhIGZhc3QgcGF0aCB0aHJvdWdoIHdoaWNoXG4gICAgICAgIC8vIG1vc3QgY2xhc3NlcyB3aWxsIGZsb3cuXG4gICAgICAgIHJlY29yZCA9IHtcbiAgICAgICAgICBub2RlOiBjbGF6eixcbiAgICAgICAgICB0cmFpdHM6IFt0cmFpdF0sXG4gICAgICAgICAgbWV0YURpYWdub3N0aWNzOiBudWxsLFxuICAgICAgICAgIGhhc1ByaW1hcnlIYW5kbGVyOiBpc1ByaW1hcnlIYW5kbGVyLFxuICAgICAgICAgIGhhc1dlYWtIYW5kbGVyczogaXNXZWFrSGFuZGxlcixcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmNsYXNzZXMuc2V0KGNsYXp6LCByZWNvcmQpO1xuICAgICAgICBjb25zdCBzZiA9IGNsYXp6LmdldFNvdXJjZUZpbGUoKTtcbiAgICAgICAgaWYgKCF0aGlzLmZpbGVUb0NsYXNzZXMuaGFzKHNmKSkge1xuICAgICAgICAgIHRoaXMuZmlsZVRvQ2xhc3Nlcy5zZXQoc2YsIG5ldyBTZXQ8Q2xhc3NEZWNsYXJhdGlvbj4oKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5maWxlVG9DbGFzc2VzLmdldChzZikhLmFkZChjbGF6eik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIGlzIGF0IGxlYXN0IHRoZSBzZWNvbmQgaGFuZGxlciB0byBtYXRjaCB0aGlzIGNsYXNzLiBUaGlzIGlzIGEgc2xvd2VyIHBhdGggdGhhdCBzb21lXG4gICAgICAgIC8vIGNsYXNzZXMgd2lsbCBnbyB0aHJvdWdoLCB3aGljaCB2YWxpZGF0ZXMgdGhhdCB0aGUgc2V0IG9mIGRlY29yYXRvcnMgYXBwbGllZCB0byB0aGUgY2xhc3NcbiAgICAgICAgLy8gaXMgdmFsaWQuXG5cbiAgICAgICAgLy8gVmFsaWRhdGUgYWNjb3JkaW5nIHRvIHJ1bGVzIGFzIGZvbGxvd3M6XG4gICAgICAgIC8vXG4gICAgICAgIC8vICogV0VBSyBoYW5kbGVycyBhcmUgcmVtb3ZlZCBpZiBhIG5vbi1XRUFLIGhhbmRsZXIgbWF0Y2hlcy5cbiAgICAgICAgLy8gKiBPbmx5IG9uZSBQUklNQVJZIGhhbmRsZXIgY2FuIG1hdGNoIGF0IGEgdGltZS4gQW55IG90aGVyIFBSSU1BUlkgaGFuZGxlciBtYXRjaGluZyBhXG4gICAgICAgIC8vICAgY2xhc3Mgd2l0aCBhbiBleGlzdGluZyBQUklNQVJZIGhhbmRsZXIgaXMgYW4gZXJyb3IuXG5cbiAgICAgICAgaWYgKCFpc1dlYWtIYW5kbGVyICYmIHJlY29yZC5oYXNXZWFrSGFuZGxlcnMpIHtcbiAgICAgICAgICAvLyBUaGUgY3VycmVudCBoYW5kbGVyIGlzIG5vdCBhIFdFQUsgaGFuZGxlciwgYnV0IHRoZSBjbGFzcyBoYXMgb3RoZXIgV0VBSyBoYW5kbGVycy5cbiAgICAgICAgICAvLyBSZW1vdmUgdGhlbS5cbiAgICAgICAgICByZWNvcmQudHJhaXRzID1cbiAgICAgICAgICAgICAgcmVjb3JkLnRyYWl0cy5maWx0ZXIoZmllbGQgPT4gZmllbGQuaGFuZGxlci5wcmVjZWRlbmNlICE9PSBIYW5kbGVyUHJlY2VkZW5jZS5XRUFLKTtcbiAgICAgICAgICByZWNvcmQuaGFzV2Vha0hhbmRsZXJzID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNXZWFrSGFuZGxlciAmJiAhcmVjb3JkLmhhc1dlYWtIYW5kbGVycykge1xuICAgICAgICAgIC8vIFRoZSBjdXJyZW50IGhhbmRsZXIgaXMgYSBXRUFLIGhhbmRsZXIsIGJ1dCB0aGUgY2xhc3MgaGFzIG5vbi1XRUFLIGhhbmRsZXJzIGFscmVhZHkuXG4gICAgICAgICAgLy8gRHJvcCB0aGUgY3VycmVudCBvbmUuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNQcmltYXJ5SGFuZGxlciAmJiByZWNvcmQuaGFzUHJpbWFyeUhhbmRsZXIpIHtcbiAgICAgICAgICAvLyBUaGUgY2xhc3MgYWxyZWFkeSBoYXMgYSBQUklNQVJZIGhhbmRsZXIsIGFuZCBhbm90aGVyIG9uZSBqdXN0IG1hdGNoZWQuXG4gICAgICAgICAgcmVjb3JkLm1ldGFEaWFnbm9zdGljcyA9IFt7XG4gICAgICAgICAgICBjYXRlZ29yeTogdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgICAgICAgICAgY29kZTogTnVtYmVyKCctOTknICsgRXJyb3JDb2RlLkRFQ09SQVRPUl9DT0xMSVNJT04pLFxuICAgICAgICAgICAgZmlsZTogZ2V0U291cmNlRmlsZShjbGF6eiksXG4gICAgICAgICAgICBzdGFydDogY2xhenouZ2V0U3RhcnQodW5kZWZpbmVkLCBmYWxzZSksXG4gICAgICAgICAgICBsZW5ndGg6IGNsYXp6LmdldFdpZHRoKCksXG4gICAgICAgICAgICBtZXNzYWdlVGV4dDogJ1R3byBpbmNvbXBhdGlibGUgZGVjb3JhdG9ycyBvbiBjbGFzcycsXG4gICAgICAgICAgfV07XG4gICAgICAgICAgcmVjb3JkLnRyYWl0cyA9IGZvdW5kVHJhaXRzID0gW107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPdGhlcndpc2UsIGl0J3Mgc2FmZSB0byBhY2NlcHQgdGhlIG11bHRpcGxlIGRlY29yYXRvcnMgaGVyZS4gVXBkYXRlIHNvbWUgb2YgdGhlIG1ldGFkYXRhXG4gICAgICAgIC8vIHJlZ2FyZGluZyB0aGlzIGNsYXNzLlxuICAgICAgICByZWNvcmQudHJhaXRzLnB1c2godHJhaXQpO1xuICAgICAgICByZWNvcmQuaGFzUHJpbWFyeUhhbmRsZXIgPSByZWNvcmQuaGFzUHJpbWFyeUhhbmRsZXIgfHwgaXNQcmltYXJ5SGFuZGxlcjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZm91bmRUcmFpdHMubGVuZ3RoID4gMCA/IGZvdW5kVHJhaXRzIDogbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgbWFrZVN5bWJvbEZvclRyYWl0KFxuICAgICAgaGFuZGxlcjogRGVjb3JhdG9ySGFuZGxlcjx1bmtub3duLCB1bmtub3duLCBTZW1hbnRpY1N5bWJvbHxudWxsLCB1bmtub3duPixcbiAgICAgIGRlY2w6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBSZWFkb25seTx1bmtub3duPnxudWxsKTogU2VtYW50aWNTeW1ib2x8bnVsbCB7XG4gICAgaWYgKGFuYWx5c2lzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3ltYm9sID0gaGFuZGxlci5zeW1ib2woZGVjbCwgYW5hbHlzaXMpO1xuICAgIGlmIChzeW1ib2wgIT09IG51bGwgJiYgdGhpcy5zZW1hbnRpY0RlcEdyYXBoVXBkYXRlciAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgaXNQcmltYXJ5ID0gaGFuZGxlci5wcmVjZWRlbmNlID09PSBIYW5kbGVyUHJlY2VkZW5jZS5QUklNQVJZO1xuICAgICAgaWYgKCFpc1ByaW1hcnkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiAke2hhbmRsZXIubmFtZX0gcmV0dXJuZWQgYSBzeW1ib2wgYnV0IGlzIG5vdCBhIHByaW1hcnkgaGFuZGxlci5gKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIucmVnaXN0ZXJTeW1ib2woc3ltYm9sKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFuYWx5emVDbGFzcyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbiwgcHJlYW5hbHl6ZVF1ZXVlOiBQcm9taXNlPHZvaWQ+W118bnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IHRyYWl0cyA9IHRoaXMuc2NhbkNsYXNzRm9yVHJhaXRzKGNsYXp6KTtcblxuICAgIGlmICh0cmFpdHMgPT09IG51bGwpIHtcbiAgICAgIC8vIFRoZXJlIGFyZSBubyBJdnkgdHJhaXRzIG9uIHRoZSBjbGFzcywgc28gaXQgY2FuIHNhZmVseSBiZSBza2lwcGVkLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgdHJhaXQgb2YgdHJhaXRzKSB7XG4gICAgICBjb25zdCBhbmFseXplID0gKCkgPT4gdGhpcy5hbmFseXplVHJhaXQoY2xhenosIHRyYWl0KTtcblxuICAgICAgbGV0IHByZWFuYWx5c2lzOiBQcm9taXNlPHZvaWQ+fG51bGwgPSBudWxsO1xuICAgICAgaWYgKHByZWFuYWx5emVRdWV1ZSAhPT0gbnVsbCAmJiB0cmFpdC5oYW5kbGVyLnByZWFuYWx5emUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBBdHRlbXB0IHRvIHJ1biBwcmVhbmFseXNpcy4gVGhpcyBjb3VsZCBmYWlsIHdpdGggYSBgRmF0YWxEaWFnbm9zdGljRXJyb3JgOyBjYXRjaCBpdCBpZiBpdFxuICAgICAgICAvLyBkb2VzLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHByZWFuYWx5c2lzID0gdHJhaXQuaGFuZGxlci5wcmVhbmFseXplKGNsYXp6LCB0cmFpdC5kZXRlY3RlZC5tZXRhZGF0YSkgfHwgbnVsbDtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIEZhdGFsRGlhZ25vc3RpY0Vycm9yKSB7XG4gICAgICAgICAgICB0cmFpdC50b0FuYWx5emVkKG51bGwsIFtlcnIudG9EaWFnbm9zdGljKCldLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHByZWFuYWx5c2lzICE9PSBudWxsKSB7XG4gICAgICAgIHByZWFuYWx5emVRdWV1ZSEucHVzaChwcmVhbmFseXNpcy50aGVuKGFuYWx5emUpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFuYWx5emUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYW5hbHl6ZVRyYWl0KFxuICAgICAgY2xheno6IENsYXNzRGVjbGFyYXRpb24sIHRyYWl0OiBUcmFpdDx1bmtub3duLCB1bmtub3duLCBTZW1hbnRpY1N5bWJvbHxudWxsLCB1bmtub3duPixcbiAgICAgIGZsYWdzPzogSGFuZGxlckZsYWdzKTogdm9pZCB7XG4gICAgaWYgKHRyYWl0LnN0YXRlICE9PSBUcmFpdFN0YXRlLlBlbmRpbmcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXR0ZW1wdCB0byBhbmFseXplIHRyYWl0IG9mICR7Y2xhenoubmFtZS50ZXh0fSBpbiBzdGF0ZSAke1xuICAgICAgICAgIFRyYWl0U3RhdGVbdHJhaXQuc3RhdGVdfSAoZXhwZWN0ZWQgREVURUNURUQpYCk7XG4gICAgfVxuXG4gICAgdGhpcy5wZXJmLmV2ZW50Q291bnQoUGVyZkV2ZW50LlRyYWl0QW5hbHl6ZSk7XG5cbiAgICAvLyBBdHRlbXB0IGFuYWx5c2lzLiBUaGlzIGNvdWxkIGZhaWwgd2l0aCBhIGBGYXRhbERpYWdub3N0aWNFcnJvcmA7IGNhdGNoIGl0IGlmIGl0IGRvZXMuXG4gICAgbGV0IHJlc3VsdDogQW5hbHlzaXNPdXRwdXQ8dW5rbm93bj47XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IHRyYWl0LmhhbmRsZXIuYW5hbHl6ZShjbGF6eiwgdHJhaXQuZGV0ZWN0ZWQubWV0YWRhdGEsIGZsYWdzKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBGYXRhbERpYWdub3N0aWNFcnJvcikge1xuICAgICAgICB0cmFpdC50b0FuYWx5emVkKG51bGwsIFtlcnIudG9EaWFnbm9zdGljKCldLCBudWxsKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMubWFrZVN5bWJvbEZvclRyYWl0KHRyYWl0LmhhbmRsZXIsIGNsYXp6LCByZXN1bHQuYW5hbHlzaXMgPz8gbnVsbCk7XG4gICAgaWYgKHJlc3VsdC5hbmFseXNpcyAhPT0gdW5kZWZpbmVkICYmIHRyYWl0LmhhbmRsZXIucmVnaXN0ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdHJhaXQuaGFuZGxlci5yZWdpc3RlcihjbGF6eiwgcmVzdWx0LmFuYWx5c2lzKTtcbiAgICB9XG4gICAgdHJhaXQgPSB0cmFpdC50b0FuYWx5emVkKHJlc3VsdC5hbmFseXNpcyA/PyBudWxsLCByZXN1bHQuZGlhZ25vc3RpY3MgPz8gbnVsbCwgc3ltYm9sKTtcbiAgfVxuXG4gIHJlc29sdmUoKTogdm9pZCB7XG4gICAgY29uc3QgY2xhc3NlcyA9IEFycmF5LmZyb20odGhpcy5jbGFzc2VzLmtleXMoKSk7XG4gICAgZm9yIChjb25zdCBjbGF6eiBvZiBjbGFzc2VzKSB7XG4gICAgICBjb25zdCByZWNvcmQgPSB0aGlzLmNsYXNzZXMuZ2V0KGNsYXp6KSE7XG4gICAgICBmb3IgKGxldCB0cmFpdCBvZiByZWNvcmQudHJhaXRzKSB7XG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0cmFpdC5oYW5kbGVyO1xuICAgICAgICBzd2l0Y2ggKHRyYWl0LnN0YXRlKSB7XG4gICAgICAgICAgY2FzZSBUcmFpdFN0YXRlLlNraXBwZWQ6XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBjYXNlIFRyYWl0U3RhdGUuUGVuZGluZzpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVzb2x2aW5nIGEgdHJhaXQgdGhhdCBoYXNuJ3QgYmVlbiBhbmFseXplZDogJHtjbGF6ei5uYW1lLnRleHR9IC8gJHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YodHJhaXQuaGFuZGxlcikuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICAgICAgICBjYXNlIFRyYWl0U3RhdGUuUmVzb2x2ZWQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlc29sdmluZyBhbiBhbHJlYWR5IHJlc29sdmVkIHRyYWl0YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHJhaXQuYW5hbHlzaXMgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBObyBhbmFseXNpcyByZXN1bHRzLCBjYW5ub3QgZnVydGhlciBwcm9jZXNzIHRoaXMgdHJhaXQuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFuZGxlci5yZXNvbHZlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBObyByZXNvbHV0aW9uIG9mIHRoaXMgdHJhaXQgbmVlZGVkIC0gaXQncyBjb25zaWRlcmVkIHN1Y2Nlc3NmdWwgYnkgZGVmYXVsdC5cbiAgICAgICAgICB0cmFpdCA9IHRyYWl0LnRvUmVzb2x2ZWQobnVsbCwgbnVsbCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmVzdWx0OiBSZXNvbHZlUmVzdWx0PHVua25vd24+O1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3VsdCA9IGhhbmRsZXIucmVzb2x2ZShjbGF6eiwgdHJhaXQuYW5hbHlzaXMgYXMgUmVhZG9ubHk8dW5rbm93bj4sIHRyYWl0LnN5bWJvbCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBGYXRhbERpYWdub3N0aWNFcnJvcikge1xuICAgICAgICAgICAgdHJhaXQgPSB0cmFpdC50b1Jlc29sdmVkKG51bGwsIFtlcnIudG9EaWFnbm9zdGljKCldKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdHJhaXQgPSB0cmFpdC50b1Jlc29sdmVkKHJlc3VsdC5kYXRhID8/IG51bGwsIHJlc3VsdC5kaWFnbm9zdGljcyA/PyBudWxsKTtcblxuICAgICAgICBpZiAocmVzdWx0LnJlZXhwb3J0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBjbGF6ei5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWU7XG4gICAgICAgICAgaWYgKCF0aGlzLnJlZXhwb3J0TWFwLmhhcyhmaWxlTmFtZSkpIHtcbiAgICAgICAgICAgIHRoaXMucmVleHBvcnRNYXAuc2V0KGZpbGVOYW1lLCBuZXcgTWFwPHN0cmluZywgW3N0cmluZywgc3RyaW5nXT4oKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGZpbGVSZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0TWFwLmdldChmaWxlTmFtZSkhO1xuICAgICAgICAgIGZvciAoY29uc3QgcmVleHBvcnQgb2YgcmVzdWx0LnJlZXhwb3J0cykge1xuICAgICAgICAgICAgZmlsZVJlZXhwb3J0cy5zZXQocmVleHBvcnQuYXNBbGlhcywgW3JlZXhwb3J0LmZyb21Nb2R1bGUsIHJlZXhwb3J0LnN5bWJvbE5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgdHlwZS1jaGVja2luZyBjb2RlIGludG8gdGhlIGBUeXBlQ2hlY2tDb250ZXh0YCBmb3IgYW55IGNvbXBvbmVudHMgd2l0aGluIHRoZSBnaXZlblxuICAgKiBgdHMuU291cmNlRmlsZWAuXG4gICAqL1xuICB0eXBlQ2hlY2soc2Y6IHRzLlNvdXJjZUZpbGUsIGN0eDogVHlwZUNoZWNrQ29udGV4dCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5maWxlVG9DbGFzc2VzLmhhcyhzZikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNsYXp6IG9mIHRoaXMuZmlsZVRvQ2xhc3Nlcy5nZXQoc2YpISkge1xuICAgICAgY29uc3QgcmVjb3JkID0gdGhpcy5jbGFzc2VzLmdldChjbGF6eikhO1xuICAgICAgZm9yIChjb25zdCB0cmFpdCBvZiByZWNvcmQudHJhaXRzKSB7XG4gICAgICAgIGlmICh0cmFpdC5zdGF0ZSAhPT0gVHJhaXRTdGF0ZS5SZXNvbHZlZCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYWl0LmhhbmRsZXIudHlwZUNoZWNrID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHJhaXQucmVzb2x1dGlvbiAhPT0gbnVsbCkge1xuICAgICAgICAgIHRyYWl0LmhhbmRsZXIudHlwZUNoZWNrKGN0eCwgY2xhenosIHRyYWl0LmFuYWx5c2lzLCB0cmFpdC5yZXNvbHV0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGluZGV4KGN0eDogSW5kZXhpbmdDb250ZXh0KTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBjbGF6eiBvZiB0aGlzLmNsYXNzZXMua2V5cygpKSB7XG4gICAgICBjb25zdCByZWNvcmQgPSB0aGlzLmNsYXNzZXMuZ2V0KGNsYXp6KSE7XG4gICAgICBmb3IgKGNvbnN0IHRyYWl0IG9mIHJlY29yZC50cmFpdHMpIHtcbiAgICAgICAgaWYgKHRyYWl0LnN0YXRlICE9PSBUcmFpdFN0YXRlLlJlc29sdmVkKSB7XG4gICAgICAgICAgLy8gU2tpcCB0cmFpdHMgdGhhdCBoYXZlbid0IGJlZW4gcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYWl0LmhhbmRsZXIuaW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFNraXAgdHJhaXRzIHRoYXQgZG9uJ3QgYWZmZWN0IGluZGV4aW5nLlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRyYWl0LnJlc29sdXRpb24gIT09IG51bGwpIHtcbiAgICAgICAgICB0cmFpdC5oYW5kbGVyLmluZGV4KGN0eCwgY2xhenosIHRyYWl0LmFuYWx5c2lzLCB0cmFpdC5yZXNvbHV0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHhpMThuKGJ1bmRsZTogWGkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBjbGF6eiBvZiB0aGlzLmNsYXNzZXMua2V5cygpKSB7XG4gICAgICBjb25zdCByZWNvcmQgPSB0aGlzLmNsYXNzZXMuZ2V0KGNsYXp6KSE7XG4gICAgICBmb3IgKGNvbnN0IHRyYWl0IG9mIHJlY29yZC50cmFpdHMpIHtcbiAgICAgICAgaWYgKHRyYWl0LnN0YXRlICE9PSBUcmFpdFN0YXRlLkFuYWx5emVkICYmIHRyYWl0LnN0YXRlICE9PSBUcmFpdFN0YXRlLlJlc29sdmVkKSB7XG4gICAgICAgICAgLy8gU2tpcCB0cmFpdHMgdGhhdCBoYXZlbid0IGJlZW4gYW5hbHl6ZWQgc3VjY2Vzc2Z1bGx5LlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYWl0LmhhbmRsZXIueGkxOG4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFNraXAgdHJhaXRzIHRoYXQgZG9uJ3Qgc3VwcG9ydCB4aTE4bi5cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0cmFpdC5hbmFseXNpcyAhPT0gbnVsbCkge1xuICAgICAgICAgIHRyYWl0LmhhbmRsZXIueGkxOG4oYnVuZGxlLCBjbGF6eiwgdHJhaXQuYW5hbHlzaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdXBkYXRlUmVzb3VyY2VzKGNsYXp6OiBEZWNsYXJhdGlvbk5vZGUpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVmbGVjdG9yLmlzQ2xhc3MoY2xhenopIHx8ICF0aGlzLmNsYXNzZXMuaGFzKGNsYXp6KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmQgPSB0aGlzLmNsYXNzZXMuZ2V0KGNsYXp6KSE7XG4gICAgZm9yIChjb25zdCB0cmFpdCBvZiByZWNvcmQudHJhaXRzKSB7XG4gICAgICBpZiAodHJhaXQuc3RhdGUgIT09IFRyYWl0U3RhdGUuUmVzb2x2ZWQgfHwgdHJhaXQuaGFuZGxlci51cGRhdGVSZXNvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdHJhaXQuaGFuZGxlci51cGRhdGVSZXNvdXJjZXMoY2xhenosIHRyYWl0LmFuYWx5c2lzLCB0cmFpdC5yZXNvbHV0aW9uKTtcbiAgICB9XG4gIH1cblxuICBjb21waWxlKGNsYXp6OiBEZWNsYXJhdGlvbk5vZGUsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogQ29tcGlsZVJlc3VsdFtdfG51bGwge1xuICAgIGNvbnN0IG9yaWdpbmFsID0gdHMuZ2V0T3JpZ2luYWxOb2RlKGNsYXp6KSBhcyB0eXBlb2YgY2xheno7XG4gICAgaWYgKCF0aGlzLnJlZmxlY3Rvci5pc0NsYXNzKGNsYXp6KSB8fCAhdGhpcy5yZWZsZWN0b3IuaXNDbGFzcyhvcmlnaW5hbCkgfHxcbiAgICAgICAgIXRoaXMuY2xhc3Nlcy5oYXMob3JpZ2luYWwpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCByZWNvcmQgPSB0aGlzLmNsYXNzZXMuZ2V0KG9yaWdpbmFsKSE7XG5cbiAgICBsZXQgcmVzOiBDb21waWxlUmVzdWx0W10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgdHJhaXQgb2YgcmVjb3JkLnRyYWl0cykge1xuICAgICAgaWYgKHRyYWl0LnN0YXRlICE9PSBUcmFpdFN0YXRlLlJlc29sdmVkIHx8IHRyYWl0LmFuYWx5c2lzRGlhZ25vc3RpY3MgIT09IG51bGwgfHxcbiAgICAgICAgICB0cmFpdC5yZXNvbHZlRGlhZ25vc3RpY3MgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ2Fubm90IGNvbXBpbGUgYSB0cmFpdCB0aGF0IGlzIG5vdCByZXNvbHZlZCwgb3IgaGFkIGFueSBlcnJvcnMgaW4gaXRzIGRlY2xhcmF0aW9uLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gYHRyYWl0LnJlc29sdXRpb25gIGlzIG5vbi1udWxsIGFzc2VydGVkIGhlcmUgYmVjYXVzZSBUeXBlU2NyaXB0IGRvZXMgbm90IHJlY29nbml6ZSB0aGF0XG4gICAgICAvLyBgUmVhZG9ubHk8dW5rbm93bj5gIGlzIG51bGxhYmxlIChhcyBgdW5rbm93bmAgaXRzZWxmIGlzIG51bGxhYmxlKSBkdWUgdG8gdGhlIHdheSB0aGF0XG4gICAgICAvLyBgUmVhZG9ubHlgIHdvcmtzLlxuXG4gICAgICBsZXQgY29tcGlsZVJlczogQ29tcGlsZVJlc3VsdHxDb21waWxlUmVzdWx0W107XG4gICAgICBpZiAodGhpcy5jb21waWxhdGlvbk1vZGUgPT09IENvbXBpbGF0aW9uTW9kZS5QQVJUSUFMICYmXG4gICAgICAgICAgdHJhaXQuaGFuZGxlci5jb21waWxlUGFydGlhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbXBpbGVSZXMgPSB0cmFpdC5oYW5kbGVyLmNvbXBpbGVQYXJ0aWFsKGNsYXp6LCB0cmFpdC5hbmFseXNpcywgdHJhaXQucmVzb2x1dGlvbiEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGlsZVJlcyA9XG4gICAgICAgICAgICB0cmFpdC5oYW5kbGVyLmNvbXBpbGVGdWxsKGNsYXp6LCB0cmFpdC5hbmFseXNpcywgdHJhaXQucmVzb2x1dGlvbiEsIGNvbnN0YW50UG9vbCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbXBpbGVNYXRjaFJlcyA9IGNvbXBpbGVSZXM7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShjb21waWxlTWF0Y2hSZXMpKSB7XG4gICAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIGNvbXBpbGVNYXRjaFJlcykge1xuICAgICAgICAgIGlmICghcmVzLnNvbWUociA9PiByLm5hbWUgPT09IHJlc3VsdC5uYW1lKSkge1xuICAgICAgICAgICAgcmVzLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIXJlcy5zb21lKHJlc3VsdCA9PiByZXN1bHQubmFtZSA9PT0gY29tcGlsZU1hdGNoUmVzLm5hbWUpKSB7XG4gICAgICAgIHJlcy5wdXNoKGNvbXBpbGVNYXRjaFJlcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTG9vayB1cCB0aGUgLmQudHMgdHJhbnNmb3JtZXIgZm9yIHRoZSBpbnB1dCBmaWxlIGFuZCByZWNvcmQgdGhhdCBhdCBsZWFzdCBvbmUgZmllbGQgd2FzXG4gICAgLy8gZ2VuZXJhdGVkLCB3aGljaCB3aWxsIGFsbG93IHRoZSAuZC50cyB0byBiZSB0cmFuc2Zvcm1lZCBsYXRlci5cbiAgICB0aGlzLmR0c1RyYW5zZm9ybXMuZ2V0SXZ5RGVjbGFyYXRpb25UcmFuc2Zvcm0ob3JpZ2luYWwuZ2V0U291cmNlRmlsZSgpKVxuICAgICAgICAuYWRkRmllbGRzKG9yaWdpbmFsLCByZXMpO1xuXG4gICAgLy8gUmV0dXJuIHRoZSBpbnN0cnVjdGlvbiB0byB0aGUgdHJhbnNmb3JtZXIgc28gdGhlIGZpZWxkcyB3aWxsIGJlIGFkZGVkLlxuICAgIHJldHVybiByZXMubGVuZ3RoID4gMCA/IHJlcyA6IG51bGw7XG4gIH1cblxuICBkZWNvcmF0b3JzRm9yKG5vZGU6IHRzLkRlY2xhcmF0aW9uKTogdHMuRGVjb3JhdG9yW10ge1xuICAgIGNvbnN0IG9yaWdpbmFsID0gdHMuZ2V0T3JpZ2luYWxOb2RlKG5vZGUpIGFzIHR5cGVvZiBub2RlO1xuICAgIGlmICghdGhpcy5yZWZsZWN0b3IuaXNDbGFzcyhvcmlnaW5hbCkgfHwgIXRoaXMuY2xhc3Nlcy5oYXMob3JpZ2luYWwpKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcmVjb3JkID0gdGhpcy5jbGFzc2VzLmdldChvcmlnaW5hbCkhO1xuICAgIGNvbnN0IGRlY29yYXRvcnM6IHRzLkRlY29yYXRvcltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHRyYWl0IG9mIHJlY29yZC50cmFpdHMpIHtcbiAgICAgIGlmICh0cmFpdC5zdGF0ZSAhPT0gVHJhaXRTdGF0ZS5SZXNvbHZlZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRyYWl0LmRldGVjdGVkLnRyaWdnZXIgIT09IG51bGwgJiYgdHMuaXNEZWNvcmF0b3IodHJhaXQuZGV0ZWN0ZWQudHJpZ2dlcikpIHtcbiAgICAgICAgZGVjb3JhdG9ycy5wdXNoKHRyYWl0LmRldGVjdGVkLnRyaWdnZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkZWNvcmF0b3JzO1xuICB9XG5cbiAgZ2V0IGRpYWdub3N0aWNzKCk6IFJlYWRvbmx5QXJyYXk8dHMuRGlhZ25vc3RpYz4ge1xuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNsYXp6IG9mIHRoaXMuY2xhc3Nlcy5rZXlzKCkpIHtcbiAgICAgIGNvbnN0IHJlY29yZCA9IHRoaXMuY2xhc3Nlcy5nZXQoY2xhenopITtcbiAgICAgIGlmIChyZWNvcmQubWV0YURpYWdub3N0aWNzICE9PSBudWxsKSB7XG4gICAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4ucmVjb3JkLm1ldGFEaWFnbm9zdGljcyk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHRyYWl0IG9mIHJlY29yZC50cmFpdHMpIHtcbiAgICAgICAgaWYgKCh0cmFpdC5zdGF0ZSA9PT0gVHJhaXRTdGF0ZS5BbmFseXplZCB8fCB0cmFpdC5zdGF0ZSA9PT0gVHJhaXRTdGF0ZS5SZXNvbHZlZCkgJiZcbiAgICAgICAgICAgIHRyYWl0LmFuYWx5c2lzRGlhZ25vc3RpY3MgIT09IG51bGwpIHtcbiAgICAgICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRyYWl0LmFuYWx5c2lzRGlhZ25vc3RpY3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0cmFpdC5zdGF0ZSA9PT0gVHJhaXRTdGF0ZS5SZXNvbHZlZCAmJiB0cmFpdC5yZXNvbHZlRGlhZ25vc3RpY3MgIT09IG51bGwpIHtcbiAgICAgICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRyYWl0LnJlc29sdmVEaWFnbm9zdGljcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRpYWdub3N0aWNzO1xuICB9XG5cbiAgZ2V0IGV4cG9ydFN0YXRlbWVudHMoKTogTWFwPHN0cmluZywgTWFwPHN0cmluZywgW3N0cmluZywgc3RyaW5nXT4+IHtcbiAgICByZXR1cm4gdGhpcy5yZWV4cG9ydE1hcDtcbiAgfVxufVxuIl19