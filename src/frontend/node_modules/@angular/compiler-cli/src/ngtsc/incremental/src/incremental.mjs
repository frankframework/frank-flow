/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { absoluteFromSourceFile, resolve } from '../../file_system';
import { PerfPhase } from '../../perf';
import { toUnredirectedSourceFile } from '../../util/src/typescript';
import { SemanticDepGraphUpdater } from '../semantic_graph';
import { FileDependencyGraph } from './dependency_tracking';
import { IncrementalStateKind } from './state';
/**
 * Discriminant of the `Phase` type union.
 */
var PhaseKind;
(function (PhaseKind) {
    PhaseKind[PhaseKind["Analysis"] = 0] = "Analysis";
    PhaseKind[PhaseKind["TypeCheckAndEmit"] = 1] = "TypeCheckAndEmit";
})(PhaseKind || (PhaseKind = {}));
/**
 * Manages the incremental portion of an Angular compilation, allowing for reuse of a prior
 * compilation if available, and producing an output state for reuse of the current compilation in a
 * future one.
 */
export class IncrementalCompilation {
    constructor(state, depGraph, versions, step) {
        this.depGraph = depGraph;
        this.versions = versions;
        this.step = step;
        this._state = state;
        // The compilation begins in analysis phase.
        this.phase = {
            kind: PhaseKind.Analysis,
            semanticDepGraphUpdater: new SemanticDepGraphUpdater(step !== null ? step.priorState.semanticDepGraph : null),
        };
    }
    /**
     * Begin a fresh `IncrementalCompilation`.
     */
    static fresh(program, versions) {
        const state = {
            kind: IncrementalStateKind.Fresh,
        };
        return new IncrementalCompilation(state, new FileDependencyGraph(), versions, /* reuse */ null);
    }
    static incremental(program, newVersions, oldProgram, oldState, modifiedResourceFiles, perf) {
        return perf.inPhase(PerfPhase.Reconciliation, () => {
            const physicallyChangedTsFiles = new Set();
            const changedResourceFiles = new Set(modifiedResourceFiles !== null && modifiedResourceFiles !== void 0 ? modifiedResourceFiles : []);
            let priorAnalysis;
            switch (oldState.kind) {
                case IncrementalStateKind.Fresh:
                    // Since this line of program has never been successfully analyzed to begin with, treat
                    // this as a fresh compilation.
                    return IncrementalCompilation.fresh(program, newVersions);
                case IncrementalStateKind.Analyzed:
                    // The most recent program was analyzed successfully, so we can use that as our prior
                    // state and don't need to consider any other deltas except changes in the most recent
                    // program.
                    priorAnalysis = oldState;
                    break;
                case IncrementalStateKind.Delta:
                    // There is an ancestor program which was analyzed successfully and can be used as a
                    // starting point, but we need to determine what's changed since that program.
                    priorAnalysis = oldState.lastAnalyzedState;
                    for (const sfPath of oldState.physicallyChangedTsFiles) {
                        physicallyChangedTsFiles.add(sfPath);
                    }
                    for (const resourcePath of oldState.changedResourceFiles) {
                        changedResourceFiles.add(resourcePath);
                    }
                    break;
            }
            const oldVersions = priorAnalysis.versions;
            const oldFilesArray = oldProgram.getSourceFiles().map(sf => toUnredirectedSourceFile(sf));
            const oldFiles = new Set(oldFilesArray);
            const deletedTsFiles = new Set(oldFilesArray.map(sf => absoluteFromSourceFile(sf)));
            for (const possiblyRedirectedNewFile of program.getSourceFiles()) {
                const sf = toUnredirectedSourceFile(possiblyRedirectedNewFile);
                const sfPath = absoluteFromSourceFile(sf);
                // Since we're seeing a file in the incoming program with this name, it can't have been
                // deleted.
                deletedTsFiles.delete(sfPath);
                if (oldFiles.has(sf)) {
                    // This source file has the same object identity as in the previous program. We need to
                    // determine if it's really the same file, or if it might have changed versions since the
                    // last program without changing its identity.
                    // If there's no version information available, then this is the same file, and we can
                    // skip it.
                    if (oldVersions === null || newVersions === null) {
                        continue;
                    }
                    // If a version is available for the file from both the prior and the current program, and
                    // that version is the same, then this is the same file, and we can skip it.
                    if (oldVersions.has(sfPath) && newVersions.has(sfPath) &&
                        oldVersions.get(sfPath) === newVersions.get(sfPath)) {
                        continue;
                    }
                    // Otherwise, assume that the file has changed. Either its versions didn't match, or we
                    // were missing version information about it on one side for some reason.
                }
                // Bail out if a .d.ts file changes - the semantic dep graph is not able to process such
                // changes correctly yet.
                if (sf.isDeclarationFile) {
                    return IncrementalCompilation.fresh(program, newVersions);
                }
                // The file has changed physically, so record it.
                physicallyChangedTsFiles.add(sfPath);
            }
            // Remove any files that have been deleted from the list of physical changes.
            for (const deletedFileName of deletedTsFiles) {
                physicallyChangedTsFiles.delete(resolve(deletedFileName));
            }
            // Use the prior dependency graph to project physical changes into a set of logically changed
            // files.
            const depGraph = new FileDependencyGraph();
            const logicallyChangedTsFiles = depGraph.updateWithPhysicalChanges(priorAnalysis.depGraph, physicallyChangedTsFiles, deletedTsFiles, changedResourceFiles);
            // Physically changed files aren't necessarily counted as logically changed by the dependency
            // graph (files do not have edges to themselves), so add them to the logical changes
            // explicitly.
            for (const sfPath of physicallyChangedTsFiles) {
                logicallyChangedTsFiles.add(sfPath);
            }
            // Start off in a `DeltaIncrementalState` as a delta against the previous successful analysis,
            // until this compilation completes its own analysis.
            const state = {
                kind: IncrementalStateKind.Delta,
                physicallyChangedTsFiles,
                changedResourceFiles,
                lastAnalyzedState: priorAnalysis,
            };
            return new IncrementalCompilation(state, depGraph, newVersions, {
                priorState: priorAnalysis,
                logicallyChangedTsFiles,
            });
        });
    }
    get state() {
        return this._state;
    }
    get semanticDepGraphUpdater() {
        if (this.phase.kind !== PhaseKind.Analysis) {
            throw new Error(`AssertionError: Cannot update the SemanticDepGraph after analysis completes`);
        }
        return this.phase.semanticDepGraphUpdater;
    }
    recordSuccessfulAnalysis(traitCompiler) {
        if (this.phase.kind !== PhaseKind.Analysis) {
            throw new Error(`AssertionError: Incremental compilation in phase ${PhaseKind[this.phase.kind]}, expected Analysis`);
        }
        const { needsEmit, needsTypeCheckEmit, newGraph } = this.phase.semanticDepGraphUpdater.finalize();
        // Determine the set of files which have already been emitted.
        let emitted;
        if (this.step === null) {
            // Since there is no prior compilation, no files have yet been emitted.
            emitted = new Set();
        }
        else {
            // Begin with the files emitted by the prior successful compilation, but remove those which we
            // know need to bee re-emitted.
            emitted = new Set(this.step.priorState.emitted);
            // Files need re-emitted if they've logically changed.
            for (const sfPath of this.step.logicallyChangedTsFiles) {
                emitted.delete(sfPath);
            }
            // Files need re-emitted if they've semantically changed.
            for (const sfPath of needsEmit) {
                emitted.delete(sfPath);
            }
        }
        // Transition to a successfully analyzed compilation. At this point, a subsequent compilation
        // could use this state as a starting point.
        this._state = {
            kind: IncrementalStateKind.Analyzed,
            versions: this.versions,
            depGraph: this.depGraph,
            semanticDepGraph: newGraph,
            priorAnalysis: traitCompiler.getAnalyzedRecords(),
            typeCheckResults: null,
            emitted,
        };
        // We now enter the type-check and emit phase of compilation.
        this.phase = {
            kind: PhaseKind.TypeCheckAndEmit,
            needsEmit,
            needsTypeCheckEmit,
        };
    }
    recordSuccessfulTypeCheck(results) {
        if (this._state.kind !== IncrementalStateKind.Analyzed) {
            throw new Error(`AssertionError: Expected successfully analyzed compilation.`);
        }
        else if (this.phase.kind !== PhaseKind.TypeCheckAndEmit) {
            throw new Error(`AssertionError: Incremental compilation in phase ${PhaseKind[this.phase.kind]}, expected TypeCheck`);
        }
        this._state.typeCheckResults = results;
    }
    recordSuccessfulEmit(sf) {
        if (this._state.kind !== IncrementalStateKind.Analyzed) {
            throw new Error(`AssertionError: Expected successfully analyzed compilation.`);
        }
        this._state.emitted.add(absoluteFromSourceFile(sf));
    }
    priorAnalysisFor(sf) {
        if (this.step === null) {
            return null;
        }
        const sfPath = absoluteFromSourceFile(sf);
        // If the file has logically changed, its previous analysis cannot be reused.
        if (this.step.logicallyChangedTsFiles.has(sfPath)) {
            return null;
        }
        const priorAnalysis = this.step.priorState.priorAnalysis;
        if (!priorAnalysis.has(sf)) {
            return null;
        }
        return priorAnalysis.get(sf);
    }
    priorTypeCheckingResultsFor(sf) {
        if (this.phase.kind !== PhaseKind.TypeCheckAndEmit) {
            throw new Error(`AssertionError: Expected successfully analyzed compilation.`);
        }
        if (this.step === null) {
            return null;
        }
        const sfPath = absoluteFromSourceFile(sf);
        // If the file has logically changed, or its template type-checking results have semantically
        // changed, then past type-checking results cannot be reused.
        if (this.step.logicallyChangedTsFiles.has(sfPath) ||
            this.phase.needsTypeCheckEmit.has(sfPath)) {
            return null;
        }
        // Past results also cannot be reused if they're not available.
        if (this.step.priorState.typeCheckResults === null ||
            !this.step.priorState.typeCheckResults.has(sfPath)) {
            return null;
        }
        const priorResults = this.step.priorState.typeCheckResults.get(sfPath);
        // If the past results relied on inlining, they're not safe for reuse.
        if (priorResults.hasInlines) {
            return null;
        }
        return priorResults;
    }
    safeToSkipEmit(sf) {
        // If this is a fresh compilation, it's never safe to skip an emit.
        if (this.step === null) {
            return false;
        }
        const sfPath = absoluteFromSourceFile(sf);
        // If the file has itself logically changed, it must be emitted.
        if (this.step.logicallyChangedTsFiles.has(sfPath)) {
            return false;
        }
        if (this.phase.kind !== PhaseKind.TypeCheckAndEmit) {
            throw new Error(`AssertionError: Expected successful analysis before attempting to emit files`);
        }
        // If during analysis it was determined that this file has semantically changed, it must be
        // emitted.
        if (this.phase.needsEmit.has(sfPath)) {
            return false;
        }
        // Generally it should be safe to assume here that the file was previously emitted by the last
        // successful compilation. However, as a defense-in-depth against incorrectness, we explicitly
        // check that the last emit included this file, and re-emit it otherwise.
        return this.step.priorState.emitted.has(sfPath);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jcmVtZW50YWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2luY3JlbWVudGFsL3NyYy9pbmNyZW1lbnRhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsc0JBQXNCLEVBQWtCLE9BQU8sRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ2xGLE9BQU8sRUFBQyxTQUFTLEVBQWUsTUFBTSxZQUFZLENBQUM7QUFHbkQsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFbkUsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDMUQsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDMUQsT0FBTyxFQUFvRSxvQkFBb0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVdoSDs7R0FFRztBQUNILElBQUssU0FHSjtBQUhELFdBQUssU0FBUztJQUNaLGlEQUFRLENBQUE7SUFDUixpRUFBZ0IsQ0FBQTtBQUNsQixDQUFDLEVBSEksU0FBUyxLQUFULFNBQVMsUUFHYjtBQXlCRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLHNCQUFzQjtJQVdqQyxZQUNJLEtBQXVCLEVBQVcsUUFBNkIsRUFDdkQsUUFBMEMsRUFBVSxJQUEwQjtRQURwRCxhQUFRLEdBQVIsUUFBUSxDQUFxQjtRQUN2RCxhQUFRLEdBQVIsUUFBUSxDQUFrQztRQUFVLFNBQUksR0FBSixJQUFJLENBQXNCO1FBQ3hGLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBRXBCLDRDQUE0QztRQUM1QyxJQUFJLENBQUMsS0FBSyxHQUFHO1lBQ1gsSUFBSSxFQUFFLFNBQVMsQ0FBQyxRQUFRO1lBQ3hCLHVCQUF1QixFQUNuQixJQUFJLHVCQUF1QixDQUFDLElBQUksS0FBSyxJ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RTFDLGdFQUFnRTtRQUNoRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ2pELE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNsRCxNQUFNLElBQUksS0FBSyxDQUNYLDhFQUE4RSxDQUFDLENBQUM7U0FDckY7UUFFRCwyRkFBMkY7UUFDM0YsV0FBVztRQUNYLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3BDLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCw4RkFBOEY7UUFDOUYsOEZBQThGO1FBQzlGLHlFQUF5RTtRQUN6RSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGUsIEFic29sdXRlRnNQYXRoLCByZXNvbHZlfSBmcm9tICcuLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge1BlcmZQaGFzZSwgUGVyZlJlY29yZGVyfSBmcm9tICcuLi8uLi9wZXJmJztcbmltcG9ydCB7Q2xhc3NSZWNvcmQsIFRyYWl0Q29tcGlsZXJ9IGZyb20gJy4uLy4uL3RyYW5zZm9ybSc7XG5pbXBvcnQge0ZpbGVUeXBlQ2hlY2tpbmdEYXRhfSBmcm9tICcuLi8uLi90eXBlY2hlY2snO1xuaW1wb3J0IHt0b1VucmVkaXJlY3RlZFNvdXJjZUZpbGV9IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtJbmNyZW1lbnRhbEJ1aWxkfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHtTZW1hbnRpY0RlcEdyYXBoVXBkYXRlcn0gZnJvbSAnLi4vc2VtYW50aWNfZ3JhcGgnO1xuaW1wb3J0IHtGaWxlRGVwZW5kZW5jeUdyYXBofSBmcm9tICcuL2RlcGVuZGVuY3lfdHJhY2tpbmcnO1xuaW1wb3J0IHtBbmFseXplZEluY3JlbWVudGFsU3RhdGUsIERlbHRhSW5jcmVtZW50YWxTdGF0ZSwgSW5jcmVtZW50YWxTdGF0ZSwgSW5jcmVtZW50YWxTdGF0ZUtpbmR9IGZyb20gJy4vc3RhdGUnO1xuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSBwcmV2aW91cyBjb21waWxhdGlvbiBiZWluZyB1c2VkIGFzIGEgc3RhcnRpbmcgcG9pbnQgZm9yIHRoZSBjdXJyZW50IG9uZSxcbiAqIGluY2x1ZGluZyB0aGUgZGVsdGEgb2YgZmlsZXMgd2hpY2ggaGF2ZSBsb2dpY2FsbHkgY2hhbmdlZCBhbmQgbmVlZCB0byBiZSByZWFuYWx5emVkLlxuICovXG5pbnRlcmZhY2UgSW5jcmVtZW50YWxTdGVwIHtcbiAgcHJpb3JTdGF0ZTogQW5hbHl6ZWRJbmNyZW1lbnRhbFN0YXRlO1xuICBsb2dpY2FsbHlDaGFuZ2VkVHNGaWxlczogU2V0PEFic29sdXRlRnNQYXRoPjtcbn1cblxuLyoqXG4gKiBEaXNjcmltaW5hbnQgb2YgdGhlIGBQaGFzZWAgdHlwZSB1bmlvbi5cbiAqL1xuZW51bSBQaGFzZUtpbmQge1xuICBBbmFseXNpcyxcbiAgVHlwZUNoZWNrQW5kRW1pdCxcbn1cblxuLyoqXG4gKiBBbiBpbmNyZW1lbnRhbCBjb21waWxhdGlvbiB1bmRlcmdvaW5nIGFuYWx5c2lzLCBhbmQgYnVpbGRpbmcgYSBzZW1hbnRpYyBkZXBlbmRlbmN5IGdyYXBoLlxuICovXG5pbnRlcmZhY2UgQW5hbHlzaXNQaGFzZSB7XG4gIGtpbmQ6IFBoYXNlS2luZC5BbmFseXNpcztcbiAgc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXI6IFNlbWFudGljRGVwR3JhcGhVcGRhdGVyO1xufVxuXG4vKipcbiAqIEFuIGluY3JlbWVudGFsIGNvbXBpbGF0aW9uIHRoYXQgY29tcGxldGVkIGFuYWx5c2lzIGFuZCBpcyB1bmRlcmdvaW5nIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgYW5kXG4gKiBlbWl0LlxuICovXG5pbnRlcmZhY2UgVHlwZUNoZWNrQW5kRW1pdFBoYXNlIHtcbiAga2luZDogUGhhc2VLaW5kLlR5cGVDaGVja0FuZEVtaXQ7XG4gIG5lZWRzRW1pdDogU2V0PEFic29sdXRlRnNQYXRoPjtcbiAgbmVlZHNUeXBlQ2hlY2tFbWl0OiBTZXQ8QWJzb2x1dGVGc1BhdGg+O1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIGN1cnJlbnQgcGhhc2Ugb2YgYSBjb21waWxhdGlvbi5cbiAqL1xudHlwZSBQaGFzZSA9IEFuYWx5c2lzUGhhc2V8VHlwZUNoZWNrQW5kRW1pdFBoYXNlO1xuXG4vKipcbiAqIE1hbmFnZXMgdGhlIGluY3JlbWVudGFsIHBvcnRpb24gb2YgYW4gQW5ndWxhciBjb21waWxhdGlvbiwgYWxsb3dpbmcgZm9yIHJldXNlIG9mIGEgcHJpb3JcbiAqIGNvbXBpbGF0aW9uIGlmIGF2YWlsYWJsZSwgYW5kIHByb2R1Y2luZyBhbiBvdXRwdXQgc3RhdGUgZm9yIHJldXNlIG9mIHRoZSBjdXJyZW50IGNvbXBpbGF0aW9uIGluIGFcbiAqIGZ1dHVyZSBvbmUuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbmNyZW1lbnRhbENvbXBpbGF0aW9uIGltcGxlbWVudHMgSW5jcmVtZW50YWxCdWlsZDxDbGFzc1JlY29yZCwgRmlsZVR5cGVDaGVja2luZ0RhdGE+IHtcbiAgcHJpdmF0ZSBwaGFzZTogUGhhc2U7XG5cbiAgLyoqXG4gICAqIGBJbmNyZW1lbnRhbFN0YXRlYCBvZiB0aGlzIGNvbXBpbGF0aW9uIGlmIGl0IHdlcmUgdG8gYmUgcmV1c2VkIGluIGEgc3Vic2VxdWVudCBpbmNyZW1lbnRhbFxuICAgKiBjb21waWxhdGlvbiBhdCB0aGUgY3VycmVudCBtb21lbnQuXG4gICAqXG4gICAqIEV4cG9zZWQgdmlhIHRoZSBgc3RhdGVgIHJlYWQtb25seSBnZXR0ZXIuXG4gICAqL1xuICBwcml2YXRlIF9zdGF0ZTogSW5jcmVtZW50YWxTdGF0ZTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgc3RhdGU6IEluY3JlbWVudGFsU3RhdGUsIHJlYWRvbmx5IGRlcEdyYXBoOiBGaWxlRGVwZW5kZW5jeUdyYXBoLFxuICAgICAgcHJpdmF0ZSB2ZXJzaW9uczogTWFwPEFic29sdXRlRnNQYXRoLCBzdHJpbmc+fG51bGwsIHByaXZhdGUgc3RlcDogSW5jcmVtZW50YWxTdGVwfG51bGwpIHtcbiAgICB0aGlzLl9zdGF0ZSA9IHN0YXRlO1xuXG4gICAgLy8gVGhlIGNvbXBpbGF0aW9uIGJlZ2lucyBpbiBhbmFseXNpcyBwaGFzZS5cbiAgICB0aGlzLnBoYXNlID0ge1xuICAgICAga2luZDogUGhhc2VLaW5kLkFuYWx5c2lzLFxuICAgICAgc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXI6XG4gICAgICAgICAgbmV3IFNlbWFudGljRGVwR3JhcGhVcGRhdGVyKHN0ZXAgIT09IG51bGwgPyBzdGVwLnByaW9yU3RhdGUuc2VtYW50aWNEZXBHcmFwaCA6IG51bGwpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQmVnaW4gYSBmcmVzaCBgSW5jcmVtZW50YWxDb21waWxhdGlvbmAuXG4gICAqL1xuICBzdGF0aWMgZnJlc2gocHJvZ3JhbTogdHMuUHJvZ3JhbSwgdmVyc2lvbnM6IE1hcDxBYnNvbHV0ZUZzUGF0aCwgc3RyaW5nPnxudWxsKTpcbiAgICAgIEluY3JlbWVudGFsQ29tcGlsYXRpb24ge1xuICAgIGNvbnN0IHN0YXRlOiBJbmNyZW1lbnRhbFN0YXRlID0ge1xuICAgICAga2luZDogSW5jcmVtZW50YWxTdGF0ZUtpbmQuRnJlc2gsXG4gICAgfTtcbiAgICByZXR1cm4gbmV3IEluY3JlbWVudGFsQ29tcGlsYXRpb24oc3RhdGUsIG5ldyBGaWxlRGVwZW5kZW5jeUdyYXBoKCksIHZlcnNpb25zLCAvKiByZXVzZSAqLyBudWxsKTtcbiAgfVxuXG4gIHN0YXRpYyBpbmNyZW1lbnRhbChcbiAgICAgIHByb2dyYW06IHRzLlByb2dyYW0sIG5ld1ZlcnNpb25zOiBNYXA8QWJzb2x1dGVGc1BhdGgsIHN0cmluZz58bnVsbCwgb2xkUHJvZ3JhbTogdHMuUHJvZ3JhbSxcbiAgICAgIG9sZFN0YXRlOiBJbmNyZW1lbnRhbFN0YXRlLCBtb2RpZmllZFJlc291cmNlRmlsZXM6IFNldDxBYnNvbHV0ZUZzUGF0aD58bnVsbCxcbiAgICAgIHBlcmY6IFBlcmZSZWNvcmRlcik6IEluY3JlbWVudGFsQ29tcGlsYXRpb24ge1xuICAgIHJldHVybiBwZXJmLmluUGhhc2UoUGVyZlBoYXNlLlJlY29uY2lsaWF0aW9uLCAoKSA9PiB7XG4gICAgICBjb25zdCBwaHlzaWNhbGx5Q2hhbmdlZFRzRmlsZXMgPSBuZXcgU2V0PEFic29sdXRlRnNQYXRoPigpO1xuICAgICAgY29uc3QgY2hhbmdlZFJlc291cmNlRmlsZXMgPSBuZXcgU2V0PEFic29sdXRlRnNQYXRoPihtb2RpZmllZFJlc291cmNlRmlsZXMgPz8gW10pO1xuXG5cbiAgICAgIGxldCBwcmlvckFuYWx5c2lzOiBBbmFseXplZEluY3JlbWVudGFsU3RhdGU7XG4gICAgICBzd2l0Y2ggKG9sZFN0YXRlLmtpbmQpIHtcbiAgICAgICAgY2FzZSBJbmNyZW1lbnRhbFN0YXRlS2luZC5GcmVzaDpcbiAgICAgICAgICAvLyBTaW5jZSB0aGlzIGxpbmUgb2YgcHJvZ3JhbSBoYXMgbmV2ZXIgYmVlbiBzdWNjZXNzZnVsbHkgYW5hbHl6ZWQgdG8gYmVnaW4gd2l0aCwgdHJlYXRcbiAgICAgICAgICAvLyB0aGlzIGFzIGEgZnJlc2ggY29tcGlsYXRpb24uXG4gICAgICAgICAgcmV0dXJuIEluY3JlbWVudGFsQ29tcGlsYXRpb24uZnJlc2gocHJvZ3JhbSwgbmV3VmVyc2lvbnMpO1xuICAgICAgICBjYXNlIEluY3JlbWVudGFsU3RhdGVLaW5kLkFuYWx5emVkOlxuICAgICAgICAgIC8vIFRoZSBtb3N0IHJlY2VudCBwcm9ncmFtIHdhcyBhbmFseXplZCBzdWNjZXNzZnVsbHksIHNvIHdlIGNhbiB1c2UgdGhhdCBhcyBvdXIgcHJpb3JcbiAgICAgICAgICAvLyBzdGF0ZSBhbmQgZG9uJ3QgbmVlZCB0byBjb25zaWRlciBhbnkgb3RoZXIgZGVsdGFzIGV4Y2VwdCBjaGFuZ2VzIGluIHRoZSBtb3N0IHJlY2VudFxuICAgICAgICAgIC8vIHByb2dyYW0uXG4gICAgICAgICAgcHJpb3JBbmFseXNpcyA9IG9sZFN0YXRlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEluY3JlbWVudGFsU3RhdGVLaW5kLkRlbHRhOlxuICAgICAgICAgIC8vIFRoZXJlIGlzIGFuIGFuY2VzdG9yIHByb2dyYW0gd2hpY2ggd2FzIGFuYWx5emVkIHN1Y2Nlc3NmdWxseSBhbmQgY2FuIGJlIHVzZWQgYXMgYVxuICAgICAgICAgIC8vIHN0YXJ0aW5nIHBvaW50LCBidXQgd2UgbmVlZCB0byBkZXRlcm1pbmUgd2hhdCdzIGNoYW5nZWQgc2luY2UgdGhhdCBwcm9ncmFtLlxuICAgICAgICAgIHByaW9yQW5hbHlzaXMgPSBvbGRTdGF0ZS5sYXN0QW5hbHl6ZWRTdGF0ZTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHNmUGF0aCBvZiBvbGRTdGF0ZS5waHlzaWNhbGx5Q2hhbmdlZFRzRmlsZXMpIHtcbiAgICAgICAgICAgIHBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcy5hZGQoc2ZQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIChjb25zdCByZXNvdXJjZVBhdGggb2Ygb2xkU3RhdGUuY2hhbmdlZFJlc291cmNlRmlsZXMpIHtcbiAgICAgICAgICAgIGNoYW5nZWRSZXNvdXJjZUZpbGVzLmFkZChyZXNvdXJjZVBhdGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb2xkVmVyc2lvbnMgPSBwcmlvckFuYWx5c2lzLnZlcnNpb25zO1xuXG4gICAgICBjb25zdCBvbGRGaWxlc0FycmF5ID0gb2xkUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLm1hcChzZiA9PiB0b1VucmVkaXJlY3RlZFNvdXJjZUZpbGUoc2YpKTtcbiAgICAgIGNvbnN0IG9sZEZpbGVzID0gbmV3IFNldChvbGRGaWxlc0FycmF5KTtcbiAgICAgIGNvbnN0IGRlbGV0ZWRUc0ZpbGVzID0gbmV3IFNldChvbGRGaWxlc0FycmF5Lm1hcChzZiA9PiBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKSkpO1xuXG4gICAgICBmb3IgKGNvbnN0IHBvc3NpYmx5UmVkaXJlY3RlZE5ld0ZpbGUgb2YgcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICAgIGNvbnN0IHNmID0gdG9VbnJlZGlyZWN0ZWRTb3VyY2VGaWxlKHBvc3NpYmx5UmVkaXJlY3RlZE5ld0ZpbGUpO1xuICAgICAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcbiAgICAgICAgLy8gU2luY2Ugd2UncmUgc2VlaW5nIGEgZmlsZSBpbiB0aGUgaW5jb21pbmcgcHJvZ3JhbSB3aXRoIHRoaXMgbmFtZSwgaXQgY2FuJ3QgaGF2ZSBiZWVuXG4gICAgICAgIC8vIGRlbGV0ZWQuXG4gICAgICAgIGRlbGV0ZWRUc0ZpbGVzLmRlbGV0ZShzZlBhdGgpO1xuXG4gICAgICAgIGlmIChvbGRGaWxlcy5oYXMoc2YpKSB7XG4gICAgICAgICAgLy8gVGhpcyBzb3VyY2UgZmlsZSBoYXMgdGhlIHNhbWUgb2JqZWN0IGlkZW50aXR5IGFzIGluIHRoZSBwcmV2aW91cyBwcm9ncmFtLiBXZSBuZWVkIHRvXG4gICAgICAgICAgLy8gZGV0ZXJtaW5lIGlmIGl0J3MgcmVhbGx5IHRoZSBzYW1lIGZpbGUsIG9yIGlmIGl0IG1pZ2h0IGhhdmUgY2hhbmdlZCB2ZXJzaW9ucyBzaW5jZSB0aGVcbiAgICAgICAgICAvLyBsYXN0IHByb2dyYW0gd2l0aG91dCBjaGFuZ2luZyBpdHMgaWRlbnRpdHkuXG5cbiAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIHZlcnNpb24gaW5mb3JtYXRpb24gYXZhaWxhYmxlLCB0aGVuIHRoaXMgaXMgdGhlIHNhbWUgZmlsZSwgYW5kIHdlIGNhblxuICAgICAgICAgIC8vIHNraXAgaXQuXG4gICAgICAgICAgaWYgKG9sZFZlcnNpb25zID09PSBudWxsIHx8IG5ld1ZlcnNpb25zID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBJZiBhIHZlcnNpb24gaXMgYXZhaWxhYmxlIGZvciB0aGUgZmlsZSBmcm9tIGJvdGggdGhlIHByaW9yIGFuZCB0aGUgY3VycmVudCBwcm9ncmFtLCBhbmRcbiAgICAgICAgICAvLyB0aGF0IHZlcnNpb24gaXMgdGhlIHNhbWUsIHRoZW4gdGhpcyBpcyB0aGUgc2FtZSBmaWxlLCBhbmQgd2UgY2FuIHNraXAgaXQuXG4gICAgICAgICAgaWYgKG9sZFZlcnNpb25zLmhhcyhzZlBhdGgpICYmIG5ld1ZlcnNpb25zLmhhcyhzZlBhdGgpICYmXG4gICAgICAgICAgICAgIG9sZFZlcnNpb25zLmdldChzZlBhdGgpISA9PT0gbmV3VmVyc2lvbnMuZ2V0KHNmUGF0aCkhKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPdGhlcndpc2UsIGFzc3VtZSB0aGF0IHRoZSBmaWxlIGhhcyBjaGFuZ2VkLiBFaXRoZXIgaXRzIHZlcnNpb25zIGRpZG4ndCBtYXRjaCwgb3Igd2VcbiAgICAgICAgICAvLyB3ZXJlIG1pc3NpbmcgdmVyc2lvbiBpbmZvcm1hdGlvbiBhYm91dCBpdCBvbiBvbmUgc2lkZSBmb3Igc29tZSByZWFzb24uXG4gICAgICAgIH1cblxuICAgICAgICAvLyBCYWlsIG91dCBpZiBhIC5kLnRzIGZpbGUgY2hhbmdlcyAtIHRoZSBzZW1hbnRpYyBkZXAgZ3JhcGggaXMgbm90IGFibGUgdG8gcHJvY2VzcyBzdWNoXG4gICAgICAgIC8vIGNoYW5nZXMgY29ycmVjdGx5IHlldC5cbiAgICAgICAgaWYgKHNmLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgICAgcmV0dXJuIEluY3JlbWVudGFsQ29tcGlsYXRpb24uZnJlc2gocHJvZ3JhbSwgbmV3VmVyc2lvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGZpbGUgaGFzIGNoYW5nZWQgcGh5c2ljYWxseSwgc28gcmVjb3JkIGl0LlxuICAgICAgICBwaHlzaWNhbGx5Q2hhbmdlZFRzRmlsZXMuYWRkKHNmUGF0aCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW92ZSBhbnkgZmlsZXMgdGhhdCBoYXZlIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBsaXN0IG9mIHBoeXNpY2FsIGNoYW5nZXMuXG4gICAgICBmb3IgKGNvbnN0IGRlbGV0ZWRGaWxlTmFtZSBvZiBkZWxldGVkVHNGaWxlcykge1xuICAgICAgICBwaHlzaWNhbGx5Q2hhbmdlZFRzRmlsZXMuZGVsZXRlKHJlc29sdmUoZGVsZXRlZEZpbGVOYW1lKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVzZSB0aGUgcHJpb3IgZGVwZW5kZW5jeSBncmFwaCB0byBwcm9qZWN0IHBoeXNpY2FsIGNoYW5nZXMgaW50byBhIHNldCBvZiBsb2dpY2FsbHkgY2hhbmdlZFxuICAgICAgLy8gZmlsZXMuXG4gICAgICBjb25zdCBkZXBHcmFwaCA9IG5ldyBGaWxlRGVwZW5kZW5jeUdyYXBoKCk7XG4gICAgICBjb25zdCBsb2dpY2FsbHlDaGFuZ2VkVHNGaWxlcyA9IGRlcEdyYXBoLnVwZGF0ZVdpdGhQaHlzaWNhbENoYW5nZXMoXG4gICAgICAgICAgcHJpb3JBbmFseXNpcy5kZXBHcmFwaCwgcGh5c2ljYWxseUNoYW5nZWRUc0ZpbGVzLCBkZWxldGVkVHNGaWxlcywgY2hhbmdlZFJlc291cmNlRmlsZXMpO1xuXG4gICAgICAvLyBQaHlzaWNhbGx5IGNoYW5nZWQgZmlsZXMgYXJlbid0IG5lY2Vzc2FyaWx5IGNvdW50ZWQgYXMgbG9naWNhbGx5IGNoYW5nZWQgYnkgdGhlIGRlcGVuZGVuY3lcbiAgICAgIC8vIGdyYXBoIChmaWxlcyBkbyBub3QgaGF2ZSBlZGdlcyB0byB0aGVtc2VsdmVzKSwgc28gYWRkIHRoZW0gdG8gdGhlIGxvZ2ljYWwgY2hhbmdlc1xuICAgICAgLy8gZXhwbGljaXRseS5cbiAgICAgIGZvciAoY29uc3Qgc2ZQYXRoIG9mIHBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcykge1xuICAgICAgICBsb2dpY2FsbHlDaGFuZ2VkVHNGaWxlcy5hZGQoc2ZQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gU3RhcnQgb2ZmIGluIGEgYERlbHRhSW5jcmVtZW50YWxTdGF0ZWAgYXMgYSBkZWx0YSBhZ2FpbnN0IHRoZSBwcmV2aW91cyBzdWNjZXNzZnVsIGFuYWx5c2lzLFxuICAgICAgLy8gdW50aWwgdGhpcyBjb21waWxhdGlvbiBjb21wbGV0ZXMgaXRzIG93biBhbmFseXNpcy5cbiAgICAgIGNvbnN0IHN0YXRlOiBEZWx0YUluY3JlbWVudGFsU3RhdGUgPSB7XG4gICAgICAgIGtpbmQ6IEluY3JlbWVudGFsU3RhdGVLaW5kLkRlbHRhLFxuICAgICAgICBwaHlzaWNhbGx5Q2hhbmdlZFRzRmlsZXMsXG4gICAgICAgIGNoYW5nZWRSZXNvdXJjZUZpbGVzLFxuICAgICAgICBsYXN0QW5hbHl6ZWRTdGF0ZTogcHJpb3JBbmFseXNpcyxcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBuZXcgSW5jcmVtZW50YWxDb21waWxhdGlvbihzdGF0ZSwgZGVwR3JhcGgsIG5ld1ZlcnNpb25zLCB7XG4gICAgICAgIHByaW9yU3RhdGU6IHByaW9yQW5hbHlzaXMsXG4gICAgICAgIGxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc3RhdGUoKTogSW5jcmVtZW50YWxTdGF0ZSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0YXRlO1xuICB9XG5cbiAgZ2V0IHNlbWFudGljRGVwR3JhcGhVcGRhdGVyKCk6IFNlbWFudGljRGVwR3JhcGhVcGRhdGVyIHtcbiAgICBpZiAodGhpcy5waGFzZS5raW5kICE9PSBQaGFzZUtpbmQuQW5hbHlzaXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IENhbm5vdCB1cGRhdGUgdGhlIFNlbWFudGljRGVwR3JhcGggYWZ0ZXIgYW5hbHlzaXMgY29tcGxldGVzYCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBoYXNlLnNlbWFudGljRGVwR3JhcGhVcGRhdGVyO1xuICB9XG5cbiAgcmVjb3JkU3VjY2Vzc2Z1bEFuYWx5c2lzKHRyYWl0Q29tcGlsZXI6IFRyYWl0Q29tcGlsZXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5waGFzZS5raW5kICE9PSBQaGFzZUtpbmQuQW5hbHlzaXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IEluY3JlbWVudGFsIGNvbXBpbGF0aW9uIGluIHBoYXNlICR7XG4gICAgICAgICAgUGhhc2VLaW5kW3RoaXMucGhhc2Uua2luZF19LCBleHBlY3RlZCBBbmFseXNpc2ApO1xuICAgIH1cblxuICAgIGNvbnN0IHtuZWVkc0VtaXQsIG5lZWRzVHlwZUNoZWNrRW1pdCwgbmV3R3JhcGh9ID0gdGhpcy5waGFzZS5zZW1hbnRpY0RlcEdyYXBoVXBkYXRlci5maW5hbGl6ZSgpO1xuXG4gICAgLy8gRGV0ZXJtaW5lIHRoZSBzZXQgb2YgZmlsZXMgd2hpY2ggaGF2ZSBhbHJlYWR5IGJlZW4gZW1pdHRlZC5cbiAgICBsZXQgZW1pdHRlZDogU2V0PEFic29sdXRlRnNQYXRoPjtcbiAgICBpZiAodGhpcy5zdGVwID09PSBudWxsKSB7XG4gICAgICAvLyBTaW5jZSB0aGVyZSBpcyBubyBwcmlvciBjb21waWxhdGlvbiwgbm8gZmlsZXMgaGF2ZSB5ZXQgYmVlbiBlbWl0dGVkLlxuICAgICAgZW1pdHRlZCA9IG5ldyBTZXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQmVnaW4gd2l0aCB0aGUgZmlsZXMgZW1pdHRlZCBieSB0aGUgcHJpb3Igc3VjY2Vzc2Z1bCBjb21waWxhdGlvbiwgYnV0IHJlbW92ZSB0aG9zZSB3aGljaCB3ZVxuICAgICAgLy8ga25vdyBuZWVkIHRvIGJlZSByZS1lbWl0dGVkLlxuICAgICAgZW1pdHRlZCA9IG5ldyBTZXQodGhpcy5zdGVwLnByaW9yU3RhdGUuZW1pdHRlZCk7XG5cbiAgICAgIC8vIEZpbGVzIG5lZWQgcmUtZW1pdHRlZCBpZiB0aGV5J3ZlIGxvZ2ljYWxseSBjaGFuZ2VkLlxuICAgICAgZm9yIChjb25zdCBzZlBhdGggb2YgdGhpcy5zdGVwLmxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzKSB7XG4gICAgICAgIGVtaXR0ZWQuZGVsZXRlKHNmUGF0aCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEZpbGVzIG5lZWQgcmUtZW1pdHRlZCBpZiB0aGV5J3ZlIHNlbWFudGljYWxseSBjaGFuZ2VkLlxuICAgICAgZm9yIChjb25zdCBzZlBhdGggb2YgbmVlZHNFbWl0KSB7XG4gICAgICAgIGVtaXR0ZWQuZGVsZXRlKHNmUGF0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVHJhbnNpdGlvbiB0byBhIHN1Y2Nlc3NmdWxseSBhbmFseXplZCBjb21waWxhdGlvbi4gQXQgdGhpcyBwb2ludCwgYSBzdWJzZXF1ZW50IGNvbXBpbGF0aW9uXG4gICAgLy8gY291bGQgdXNlIHRoaXMgc3RhdGUgYXMgYSBzdGFydGluZyBwb2ludC5cbiAgICB0aGlzLl9zdGF0ZSA9IHtcbiAgICAgIGtpbmQ6IEluY3JlbWVudGFsU3RhdGVLaW5kLkFuYWx5emVkLFxuICAgICAgdmVyc2lvbnM6IHRoaXMudmVyc2lvbnMsXG4gICAgICBkZXBHcmFwaDogdGhpcy5kZXBHcmFwaCxcbiAgICAgIHNlbWFudGljRGVwR3JhcGg6IG5ld0dyYXBoLFxuICAgICAgcHJpb3JBbmFseXNpczogdHJhaXRDb21waWxlci5nZXRBbmFseXplZFJlY29yZHMoKSxcbiAgICAgIHR5cGVDaGVja1Jlc3VsdHM6IG51bGwsXG4gICAgICBlbWl0dGVkLFxuICAgIH07XG5cbiAgICAvLyBXZSBub3cgZW50ZXIgdGhlIHR5cGUtY2hlY2sgYW5kIGVtaXQgcGhhc2Ugb2YgY29tcGlsYXRpb24uXG4gICAgdGhpcy5waGFzZSA9IHtcbiAgICAgIGtpbmQ6IFBoYXNlS2luZC5UeXBlQ2hlY2tBbmRFbWl0LFxuICAgICAgbmVlZHNFbWl0LFxuICAgICAgbmVlZHNUeXBlQ2hlY2tFbWl0LFxuICAgIH07XG4gIH1cblxuICByZWNvcmRTdWNjZXNzZnVsVHlwZUNoZWNrKHJlc3VsdHM6IE1hcDxBYnNvbHV0ZUZzUGF0aCwgRmlsZVR5cGVDaGVja2luZ0RhdGE+KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX3N0YXRlLmtpbmQgIT09IEluY3JlbWVudGFsU3RhdGVLaW5kLkFuYWx5emVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBFeHBlY3RlZCBzdWNjZXNzZnVsbHkgYW5hbHl6ZWQgY29tcGlsYXRpb24uYCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnBoYXNlLmtpbmQgIT09IFBoYXNlS2luZC5UeXBlQ2hlY2tBbmRFbWl0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBJbmNyZW1lbnRhbCBjb21waWxhdGlvbiBpbiBwaGFzZSAke1xuICAgICAgICAgIFBoYXNlS2luZFt0aGlzLnBoYXNlLmtpbmRdfSwgZXhwZWN0ZWQgVHlwZUNoZWNrYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3RhdGUudHlwZUNoZWNrUmVzdWx0cyA9IHJlc3VsdHM7XG4gIH1cblxuXG4gIHJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNmOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX3N0YXRlLmtpbmQgIT09IEluY3JlbWVudGFsU3RhdGVLaW5kLkFuYWx5emVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBFeHBlY3RlZCBzdWNjZXNzZnVsbHkgYW5hbHl6ZWQgY29tcGlsYXRpb24uYCk7XG4gICAgfVxuICAgIHRoaXMuX3N0YXRlLmVtaXR0ZWQuYWRkKGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpKTtcbiAgfVxuXG4gIHByaW9yQW5hbHlzaXNGb3Ioc2Y6IHRzLlNvdXJjZUZpbGUpOiBDbGFzc1JlY29yZFtdfG51bGwge1xuICAgIGlmICh0aGlzLnN0ZXAgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuXG4gICAgLy8gSWYgdGhlIGZpbGUgaGFzIGxvZ2ljYWxseSBjaGFuZ2VkLCBpdHMgcHJldmlvdXMgYW5hbHlzaXMgY2Fubm90IGJlIHJldXNlZC5cbiAgICBpZiAodGhpcy5zdGVwLmxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzLmhhcyhzZlBhdGgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBwcmlvckFuYWx5c2lzID0gdGhpcy5zdGVwLnByaW9yU3RhdGUucHJpb3JBbmFseXNpcztcbiAgICBpZiAoIXByaW9yQW5hbHlzaXMuaGFzKHNmKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBwcmlvckFuYWx5c2lzLmdldChzZikhO1xuICB9XG5cbiAgcHJpb3JUeXBlQ2hlY2tpbmdSZXN1bHRzRm9yKHNmOiB0cy5Tb3VyY2VGaWxlKTogRmlsZVR5cGVDaGVja2luZ0RhdGF8bnVsbCB7XG4gICAgaWYgKHRoaXMucGhhc2Uua2luZCAhPT0gUGhhc2VLaW5kLlR5cGVDaGVja0FuZEVtaXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkIHN1Y2Nlc3NmdWxseSBhbmFseXplZCBjb21waWxhdGlvbi5gKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zdGVwID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcblxuICAgIC8vIElmIHRoZSBmaWxlIGhhcyBsb2dpY2FsbHkgY2hhbmdlZCwgb3IgaXRzIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgcmVzdWx0cyBoYXZlIHNlbWFudGljYWxseVxuICAgIC8vIGNoYW5nZWQsIHRoZW4gcGFzdCB0eXBlLWNoZWNraW5nIHJlc3VsdHMgY2Fubm90IGJlIHJldXNlZC5cbiAgICBpZiAodGhpcy5zdGVwLmxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzLmhhcyhzZlBhdGgpIHx8XG4gICAgICAgIHRoaXMucGhhc2UubmVlZHNUeXBlQ2hlY2tFbWl0LmhhcyhzZlBhdGgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBQYXN0IHJlc3VsdHMgYWxzbyBjYW5ub3QgYmUgcmV1c2VkIGlmIHRoZXkncmUgbm90IGF2YWlsYWJsZS5cbiAgICBpZiAodGhpcy5zdGVwLnByaW9yU3RhdGUudHlwZUNoZWNrUmVzdWx0cyA9PT0gbnVsbCB8fFxuICAgICAgICAhdGhpcy5zdGVwLnByaW9yU3RhdGUudHlwZUNoZWNrUmVzdWx0cy5oYXMoc2ZQYXRoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcHJpb3JSZXN1bHRzID0gdGhpcy5zdGVwLnByaW9yU3RhdGUudHlwZUNoZWNrUmVzdWx0cy5nZXQoc2ZQYXRoKSE7XG4gICAgLy8gSWYgdGhlIHBhc3QgcmVzdWx0cyByZWxpZWQgb24gaW5saW5pbmcsIHRoZXkncmUgbm90IHNhZmUgZm9yIHJldXNlLlxuICAgIGlmIChwcmlvclJlc3VsdHMuaGFzSW5saW5lcykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByaW9yUmVzdWx0cztcbiAgfVxuXG4gIHNhZmVUb1NraXBFbWl0KHNmOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gICAgLy8gSWYgdGhpcyBpcyBhIGZyZXNoIGNvbXBpbGF0aW9uLCBpdCdzIG5ldmVyIHNhZmUgdG8gc2tpcCBhbiBlbWl0LlxuICAgIGlmICh0aGlzLnN0ZXAgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcblxuICAgIC8vIElmIHRoZSBmaWxlIGhhcyBpdHNlbGYgbG9naWNhbGx5IGNoYW5nZWQsIGl0IG11c3QgYmUgZW1pdHRlZC5cbiAgICBpZiAodGhpcy5zdGVwLmxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzLmhhcyhzZlBhdGgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucGhhc2Uua2luZCAhPT0gUGhhc2VLaW5kLlR5cGVDaGVja0FuZEVtaXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkIHN1Y2Nlc3NmdWwgYW5hbHlzaXMgYmVmb3JlIGF0dGVtcHRpbmcgdG8gZW1pdCBmaWxlc2ApO1xuICAgIH1cblxuICAgIC8vIElmIGR1cmluZyBhbmFseXNpcyBpdCB3YXMgZGV0ZXJtaW5lZCB0aGF0IHRoaXMgZmlsZSBoYXMgc2VtYW50aWNhbGx5IGNoYW5nZWQsIGl0IG11c3QgYmVcbiAgICAvLyBlbWl0dGVkLlxuICAgIGlmICh0aGlzLnBoYXNlLm5lZWRzRW1pdC5oYXMoc2ZQYXRoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYWxseSBpdCBzaG91bGQgYmUgc2FmZSB0byBhc3N1bWUgaGVyZSB0aGF0IHRoZSBmaWxlIHdhcyBwcmV2aW91c2x5IGVtaXR0ZWQgYnkgdGhlIGxhc3RcbiAgICAvLyBzdWNjZXNzZnVsIGNvbXBpbGF0aW9uLiBIb3dldmVyLCBhcyBhIGRlZmVuc2UtaW4tZGVwdGggYWdhaW5zdCBpbmNvcnJlY3RuZXNzLCB3ZSBleHBsaWNpdGx5XG4gICAgLy8gY2hlY2sgdGhhdCB0aGUgbGFzdCBlbWl0IGluY2x1ZGVkIHRoaXMgZmlsZSwgYW5kIHJlLWVtaXQgaXQgb3RoZXJ3aXNlLlxuICAgIHJldHVybiB0aGlzLnN0ZXAucHJpb3JTdGF0ZS5lbWl0dGVkLmhhcyhzZlBhdGgpO1xuICB9XG59XG4iXX0=