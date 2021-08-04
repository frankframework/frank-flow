/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler-cli/src/ngtsc/incremental/src/incremental", ["require", "exports", "tslib", "@angular/compiler-cli/src/ngtsc/file_system", "@angular/compiler-cli/src/ngtsc/perf", "@angular/compiler-cli/src/ngtsc/util/src/typescript", "@angular/compiler-cli/src/ngtsc/incremental/semantic_graph", "@angular/compiler-cli/src/ngtsc/incremental/src/dependency_tracking", "@angular/compiler-cli/src/ngtsc/incremental/src/state"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.IncrementalCompilation = void 0;
    var tslib_1 = require("tslib");
    var file_system_1 = require("@angular/compiler-cli/src/ngtsc/file_system");
    var perf_1 = require("@angular/compiler-cli/src/ngtsc/perf");
    var typescript_1 = require("@angular/compiler-cli/src/ngtsc/util/src/typescript");
    var semantic_graph_1 = require("@angular/compiler-cli/src/ngtsc/incremental/semantic_graph");
    var dependency_tracking_1 = require("@angular/compiler-cli/src/ngtsc/incremental/src/dependency_tracking");
    var state_1 = require("@angular/compiler-cli/src/ngtsc/incremental/src/state");
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
    var IncrementalCompilation = /** @class */ (function () {
        function IncrementalCompilation(state, depGraph, versions, step) {
            this.depGraph = depGraph;
            this.versions = versions;
            this.step = step;
            this._state = state;
            // The compilation begins in analysis phase.
            this.phase = {
                kind: PhaseKind.Analysis,
                semanticDepGraphUpdater: new semantic_graph_1.SemanticDepGraphUpdater(step !== null ? step.priorState.semanticDepGraph : null),
            };
        }
        /**
         * Begin a fresh `IncrementalCompilation`.
         */
        IncrementalCompilation.fresh = function (program, versions) {
            var state = {
                kind: state_1.IncrementalStateKind.Fresh,
            };
            return new IncrementalCompilation(state, new dependency_tracking_1.FileDependencyGraph(), versions, /* reuse */ null);
        };
        IncrementalCompilation.incremental = function (program, newVersions, oldProgram, oldState, modifiedResourceFiles, perf) {
            return perf.inPhase(perf_1.PerfPhase.Reconciliation, function () {
                var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e;
                var physicallyChangedTsFiles = new Set();
                var changedResourceFiles = new Set(modifiedResourceFiles !== null && modifiedResourceFiles !== void 0 ? modifiedResourceFiles : []);
                var priorAnalysis;
                switch (oldState.kind) {
                    case state_1.IncrementalStateKind.Fresh:
                        // Since this line of program has never been successfully analyzed to begin with, treat
                        // this as a fresh compilation.
                        return IncrementalCompilation.fresh(program, newVersions);
                    case state_1.IncrementalStateKind.Analyzed:
                        // The most recent program was analyzed successfully, so we can use that as our prior
                        // state and don't need to consider any other deltas except changes in the most recent
                        // program.
                        priorAnalysis = oldState;
                        break;
                    case state_1.IncrementalStateKind.Delta:
                        // There is an ancestor program which was analyzed successfully and can be used as a
                        // starting point, but we need to determine what's changed since that program.
                        priorAnalysis = oldState.lastAnalyzedState;
                        try {
                            for (var _f = tslib_1.__values(oldState.physicallyChangedTsFiles), _g = _f.next(); !_g.done; _g = _f.next()) {
                                var sfPath = _g.value;
                                physicallyChangedTsFiles.add(sfPath);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                        try {
                            for (var _h = tslib_1.__values(oldState.changedResourceFiles), _j = _h.next(); !_j.done; _j = _h.next()) {
                                var resourcePath = _j.value;
                                changedResourceFiles.add(resourcePath);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_j && !_j.done && (_b = _h.return)) _b.call(_h);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                        break;
                }
                var oldVersions = priorAnalysis.versions;
                var oldFilesArray = oldProgram.getSourceFiles().map(function (sf) { return typescript_1.toUnredirectedSourceFile(sf); });
                var oldFiles = new Set(oldFilesArray);
                var deletedTsFiles = new Set(oldFilesArray.map(function (sf) { return file_system_1.absoluteFromSourceFile(sf); }));
                try {
                    for (var _k = tslib_1.__values(program.getSourceFiles()), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var possiblyRedirectedNewFile = _l.value;
                        var sf = typescript_1.toUnredirectedSourceFile(possiblyRedirectedNewFile);
                        var sfPath = file_system_1.absoluteFromSourceFile(sf);
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
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                try {
                    // Remove any files that have been deleted from the list of physical changes.
                    for (var deletedTsFiles_1 = tslib_1.__values(deletedTsFiles), deletedTsFiles_1_1 = deletedTsFiles_1.next(); !deletedTsFiles_1_1.done; deletedTsFiles_1_1 = deletedTsFiles_1.next()) {
                        var deletedFileName = deletedTsFiles_1_1.value;
                        physicallyChangedTsFiles.delete(file_system_1.resolve(deletedFileName));
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (deletedTsFiles_1_1 && !deletedTsFiles_1_1.done && (_d = deletedTsFiles_1.return)) _d.call(deletedTsFiles_1);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
                // Use the prior dependency graph to project physical changes into a set of logically changed
                // files.
                var depGraph = new dependency_tracking_1.FileDependencyGraph();
                var logicallyChangedTsFiles = depGraph.updateWithPhysicalChanges(priorAnalysis.depGraph, physicallyChangedTsFiles, deletedTsFiles, changedResourceFiles);
                try {
                    // Physically changed files aren't necessarily counted as logically changed by the dependency
                    // graph (files do not have edges to themselves), so add them to the logical changes
                    // explicitly.
                    for (var physicallyChangedTsFiles_1 = tslib_1.__values(physicallyChangedTsFiles), physicallyChangedTsFiles_1_1 = physicallyChangedTsFiles_1.next(); !physicallyChangedTsFiles_1_1.done; physicallyChangedTsFiles_1_1 = physicallyChangedTsFiles_1.next()) {
                        var sfPath = physicallyChangedTsFiles_1_1.value;
                        logicallyChangedTsFiles.add(sfPath);
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (physicallyChangedTsFiles_1_1 && !physicallyChangedTsFiles_1_1.done && (_e = physicallyChangedTsFiles_1.return)) _e.call(physicallyChangedTsFiles_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                // Start off in a `DeltaIncrementalState` as a delta against the previous successful analysis,
                // until this compilation completes its own analysis.
                var state = {
                    kind: state_1.IncrementalStateKind.Delta,
                    physicallyChangedTsFiles: physicallyChangedTsFiles,
                    changedResourceFiles: changedResourceFiles,
                    lastAnalyzedState: priorAnalysis,
                };
                return new IncrementalCompilation(state, depGraph, newVersions, {
                    priorState: priorAnalysis,
                    logicallyChangedTsFiles: logicallyChangedTsFiles,
                });
            });
        };
        Object.defineProperty(IncrementalCompilation.prototype, "state", {
            get: function () {
                return this._state;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(IncrementalCompilation.prototype, "semanticDepGraphUpdater", {
            get: function () {
                if (this.phase.kind !== PhaseKind.Analysis) {
                    throw new Error("AssertionError: Cannot update the SemanticDepGraph after analysis completes");
                }
                return this.phase.semanticDepGraphUpdater;
            },
            enumerable: false,
            configurable: true
        });
        IncrementalCompilation.prototype.recordSuccessfulAnalysis = function (traitCompiler) {
            var e_6, _a, e_7, _b;
            if (this.phase.kind !== PhaseKind.Analysis) {
                throw new Error("AssertionError: Incremental compilation in phase " + PhaseKind[this.phase.kind] + ", expected Analysis");
            }
            var _c = this.phase.semanticDepGraphUpdater.finalize(), needsEmit = _c.needsEmit, needsTypeCheckEmit = _c.needsTypeCheckEmit, newGraph = _c.newGraph;
            // Determine the set of files which have already been emitted.
            var emitted;
            if (this.step === null) {
                // Since there is no prior compilation, no files have yet been emitted.
                emitted = new Set();
            }
            else {
                // Begin with the files emitted by the prior successful compilation, but remove those which we
                // know need to bee re-emitted.
                emitted = new Set(this.step.priorState.emitted);
                try {
                    // Files need re-emitted if they've logically changed.
                    for (var _d = tslib_1.__values(this.step.logicallyChangedTsFiles), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var sfPath = _e.value;
                        emitted.delete(sfPath);
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
                try {
                    // Files need re-emitted if they've semantically changed.
                    for (var needsEmit_1 = tslib_1.__values(needsEmit), needsEmit_1_1 = needsEmit_1.next(); !needsEmit_1_1.done; needsEmit_1_1 = needsEmit_1.next()) {
                        var sfPath = needsEmit_1_1.value;
                        emitted.delete(sfPath);
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (needsEmit_1_1 && !needsEmit_1_1.done && (_b = needsEmit_1.return)) _b.call(needsEmit_1);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
            }
            // Transition to a successfully analyzed compilation. At this point, a subsequent compilation
            // could use this state as a starting point.
            this._state = {
                kind: state_1.IncrementalStateKind.Analyzed,
                versions: this.versions,
                depGraph: this.depGraph,
                semanticDepGraph: newGraph,
                priorAnalysis: traitCompiler.getAnalyzedRecords(),
                typeCheckResults: null,
                emitted: emitted,
            };
            // We now enter the type-check and emit phase of compilation.
            this.phase = {
                kind: PhaseKind.TypeCheckAndEmit,
                needsEmit: needsEmit,
                needsTypeCheckEmit: needsTypeCheckEmit,
            };
        };
        IncrementalCompilation.prototype.recordSuccessfulTypeCheck = function (results) {
            if (this._state.kind !== state_1.IncrementalStateKind.Analyzed) {
                throw new Error("AssertionError: Expected successfully analyzed compilation.");
            }
            else if (this.phase.kind !== PhaseKind.TypeCheckAndEmit) {
                throw new Error("AssertionError: Incremental compilation in phase " + PhaseKind[this.phase.kind] + ", expected TypeCheck");
            }
            this._state.typeCheckResults = results;
        };
        IncrementalCompilation.prototype.recordSuccessfulEmit = function (sf) {
            if (this._state.kind !== state_1.IncrementalStateKind.Analyzed) {
                throw new Error("AssertionError: Expected successfully analyzed compilation.");
            }
            this._state.emitted.add(file_system_1.absoluteFromSourceFile(sf));
        };
        IncrementalCompilation.prototype.priorAnalysisFor = function (sf) {
            if (this.step === null) {
                return null;
            }
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            // If the file has logically changed, its previous analysis cannot be reused.
            if (this.step.logicallyChangedTsFiles.has(sfPath)) {
                return null;
            }
            var priorAnalysis = this.step.priorState.priorAnalysis;
            if (!priorAnalysis.has(sf)) {
                return null;
            }
            return priorAnalysis.get(sf);
        };
        IncrementalCompilation.prototype.priorTypeCheckingResultsFor = function (sf) {
            if (this.phase.kind !== PhaseKind.TypeCheckAndEmit) {
                throw new Error("AssertionError: Expected successfully analyzed compilation.");
            }
            if (this.step === null) {
                return null;
            }
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
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
            var priorResults = this.step.priorState.typeCheckResults.get(sfPath);
            // If the past results relied on inlining, they're not safe for reuse.
            if (priorResults.hasInlines) {
                return null;
            }
            return priorResults;
        };
        IncrementalCompilation.prototype.safeToSkipEmit = function (sf) {
            // If this is a fresh compilation, it's never safe to skip an emit.
            if (this.step === null) {
                return false;
            }
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            // If the file has itself logically changed, it must be emitted.
            if (this.step.logicallyChangedTsFiles.has(sfPath)) {
                return false;
            }
            if (this.phase.kind !== PhaseKind.TypeCheckAndEmit) {
                throw new Error("AssertionError: Expected successful analysis before attempting to emit files");
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
        };
        return IncrementalCompilation;
    }());
    exports.IncrementalCompilation = IncrementalCompilation;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jcmVtZW50YWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2luY3JlbWVudGFsL3NyYy9pbmNyZW1lbnRhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBSUgsMkVBQWtGO0lBQ2xGLDZEQUFtRDtJQUduRCxrRkFBbUU7SUFFbkUsNkZBQTBEO0lBQzFELDJHQUEwRDtJQUMxRCwrRUFBZ0g7SUFXaEg7O09BRUc7SUFDSCxJQUFLLFNBR0o7SUFIRCxXQUFLLFNBQVM7UUFDWixpREFBUSxDQUFBO1FBQ1IsaUVBQWdCLENBQUE7SUFDbEIsQ0FBQyxFQUhJLFNBQVMsS0FBVCxTQUFTLFFBR2I7SUF5QkQ7Ozs7T0FJRztJQUNIO1FBV0UsZ0NBQ0ksS0FBdUIsRUFBVyxRQUE2QixFQUN2RCxRQUEwQyxFQUFVLElBQTBCO1lBRHBELGFBQVEsR0FBUixRQUFRLENBQXFCO1lBQ3ZELGFBQVEsR0FBUixRQUFRLENBQWtDO1lBQVUsU0FBSSxHQUFKLElBQUksQ0FBc0I7WUFDeEYsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7WUFFcEIsNENBQTRDO1lBQzVDLElBQUksQ0FBQyxLQUFLLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLFNBQVMsQ0FBQyxRQUFRO2dCQUN4Qix1QkFBdUIsRUFDbkIsSUFBSSx3Q0FBdUIsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7YUFDekYsQ0FBQztRQUNKLENBQUM7UUFFRDs7V0FFRztRQUNJLDRCQUFLLEdBQVosVUFBYSxPQUFtQixFQUFFLFFBQTBDO1lBRTFFLElBQU0sS0FBSyxHQUFxQjtnQkFDOUIsSUFBSSxFQUFFLDRCQUFvQixDQUFDLEtBQUs7YUFD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QyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUUsQ0FBQztZQUN4RSxzRUFBc0U7WUFDdEUsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFO2dCQUMzQixPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTyxZQUFZLENBQUM7UUFDdEIsQ0FBQztRQUVELCtDQUFjLEdBQWQsVUFBZSxFQUFpQjtZQUM5QixtRUFBbUU7WUFDbkUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtnQkFDdEIsT0FBTyxLQUFLLENBQUM7YUFDZDtZQUVELElBQU0sTUFBTSxHQUFHLG9DQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRTFDLGdFQUFnRTtZQUNoRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUNqRCxPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQ2xELE1BQU0sSUFBSSxLQUFLLENBQ1gsOEVBQThFLENBQUMsQ0FBQzthQUNyRjtZQUVELDJGQUEyRjtZQUMzRixXQUFXO1lBQ1gsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3BDLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFFRCw4RkFBOEY7WUFDOUYsOEZBQThGO1lBQzlGLHlFQUF5RTtZQUN6RSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUNILDZCQUFDO0lBQUQsQ0FBQyxBQXJURCxJQXFUQztJQXJUWSx3REFBc0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7YWJzb2x1dGVGcm9tU291cmNlRmlsZSwgQWJzb2x1dGVGc1BhdGgsIHJlc29sdmV9IGZyb20gJy4uLy4uL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7UGVyZlBoYXNlLCBQZXJmUmVjb3JkZXJ9IGZyb20gJy4uLy4uL3BlcmYnO1xuaW1wb3J0IHtDbGFzc1JlY29yZCwgVHJhaXRDb21waWxlcn0gZnJvbSAnLi4vLi4vdHJhbnNmb3JtJztcbmltcG9ydCB7RmlsZVR5cGVDaGVja2luZ0RhdGF9IGZyb20gJy4uLy4uL3R5cGVjaGVjayc7XG5pbXBvcnQge3RvVW5yZWRpcmVjdGVkU291cmNlRmlsZX0gZnJvbSAnLi4vLi4vdXRpbC9zcmMvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0luY3JlbWVudGFsQnVpbGR9IGZyb20gJy4uL2FwaSc7XG5pbXBvcnQge1NlbWFudGljRGVwR3JhcGhVcGRhdGVyfSBmcm9tICcuLi9zZW1hbnRpY19ncmFwaCc7XG5pbXBvcnQge0ZpbGVEZXBlbmRlbmN5R3JhcGh9IGZyb20gJy4vZGVwZW5kZW5jeV90cmFja2luZyc7XG5pbXBvcnQge0FuYWx5emVkSW5jcmVtZW50YWxTdGF0ZSwgRGVsdGFJbmNyZW1lbnRhbFN0YXRlLCBJbmNyZW1lbnRhbFN0YXRlLCBJbmNyZW1lbnRhbFN0YXRlS2luZH0gZnJvbSAnLi9zdGF0ZSc7XG5cbi8qKlxuICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIHByZXZpb3VzIGNvbXBpbGF0aW9uIGJlaW5nIHVzZWQgYXMgYSBzdGFydGluZyBwb2ludCBmb3IgdGhlIGN1cnJlbnQgb25lLFxuICogaW5jbHVkaW5nIHRoZSBkZWx0YSBvZiBmaWxlcyB3aGljaCBoYXZlIGxvZ2ljYWxseSBjaGFuZ2VkIGFuZCBuZWVkIHRvIGJlIHJlYW5hbHl6ZWQuXG4gKi9cbmludGVyZmFjZSBJbmNyZW1lbnRhbFN0ZXAge1xuICBwcmlvclN0YXRlOiBBbmFseXplZEluY3JlbWVudGFsU3RhdGU7XG4gIGxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzOiBTZXQ8QWJzb2x1dGVGc1BhdGg+O1xufVxuXG4vKipcbiAqIERpc2NyaW1pbmFudCBvZiB0aGUgYFBoYXNlYCB0eXBlIHVuaW9uLlxuICovXG5lbnVtIFBoYXNlS2luZCB7XG4gIEFuYWx5c2lzLFxuICBUeXBlQ2hlY2tBbmRFbWl0LFxufVxuXG4vKipcbiAqIEFuIGluY3JlbWVudGFsIGNvbXBpbGF0aW9uIHVuZGVyZ29pbmcgYW5hbHlzaXMsIGFuZCBidWlsZGluZyBhIHNlbWFudGljIGRlcGVuZGVuY3kgZ3JhcGguXG4gKi9cbmludGVyZmFjZSBBbmFseXNpc1BoYXNlIHtcbiAga2luZDogUGhhc2VLaW5kLkFuYWx5c2lzO1xuICBzZW1hbnRpY0RlcEdyYXBoVXBkYXRlcjogU2VtYW50aWNEZXBHcmFwaFVwZGF0ZXI7XG59XG5cbi8qKlxuICogQW4gaW5jcmVtZW50YWwgY29tcGlsYXRpb24gdGhhdCBjb21wbGV0ZWQgYW5hbHlzaXMgYW5kIGlzIHVuZGVyZ29pbmcgdGVtcGxhdGUgdHlwZS1jaGVja2luZyBhbmRcbiAqIGVtaXQuXG4gKi9cbmludGVyZmFjZSBUeXBlQ2hlY2tBbmRFbWl0UGhhc2Uge1xuICBraW5kOiBQaGFzZUtpbmQuVHlwZUNoZWNrQW5kRW1pdDtcbiAgbmVlZHNFbWl0OiBTZXQ8QWJzb2x1dGVGc1BhdGg+O1xuICBuZWVkc1R5cGVDaGVja0VtaXQ6IFNldDxBYnNvbHV0ZUZzUGF0aD47XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgY3VycmVudCBwaGFzZSBvZiBhIGNvbXBpbGF0aW9uLlxuICovXG50eXBlIFBoYXNlID0gQW5hbHlzaXNQaGFzZXxUeXBlQ2hlY2tBbmRFbWl0UGhhc2U7XG5cbi8qKlxuICogTWFuYWdlcyB0aGUgaW5jcmVtZW50YWwgcG9ydGlvbiBvZiBhbiBBbmd1bGFyIGNvbXBpbGF0aW9uLCBhbGxvd2luZyBmb3IgcmV1c2Ugb2YgYSBwcmlvclxuICogY29tcGlsYXRpb24gaWYgYXZhaWxhYmxlLCBhbmQgcHJvZHVjaW5nIGFuIG91dHB1dCBzdGF0ZSBmb3IgcmV1c2Ugb2YgdGhlIGN1cnJlbnQgY29tcGlsYXRpb24gaW4gYVxuICogZnV0dXJlIG9uZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEluY3JlbWVudGFsQ29tcGlsYXRpb24gaW1wbGVtZW50cyBJbmNyZW1lbnRhbEJ1aWxkPENsYXNzUmVjb3JkLCBGaWxlVHlwZUNoZWNraW5nRGF0YT4ge1xuICBwcml2YXRlIHBoYXNlOiBQaGFzZTtcblxuICAvKipcbiAgICogYEluY3JlbWVudGFsU3RhdGVgIG9mIHRoaXMgY29tcGlsYXRpb24gaWYgaXQgd2VyZSB0byBiZSByZXVzZWQgaW4gYSBzdWJzZXF1ZW50IGluY3JlbWVudGFsXG4gICAqIGNvbXBpbGF0aW9uIGF0IHRoZSBjdXJyZW50IG1vbWVudC5cbiAgICpcbiAgICogRXhwb3NlZCB2aWEgdGhlIGBzdGF0ZWAgcmVhZC1vbmx5IGdldHRlci5cbiAgICovXG4gIHByaXZhdGUgX3N0YXRlOiBJbmNyZW1lbnRhbFN0YXRlO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgICBzdGF0ZTogSW5jcmVtZW50YWxTdGF0ZSwgcmVhZG9ubHkgZGVwR3JhcGg6IEZpbGVEZXBlbmRlbmN5R3JhcGgsXG4gICAgICBwcml2YXRlIHZlcnNpb25zOiBNYXA8QWJzb2x1dGVGc1BhdGgsIHN0cmluZz58bnVsbCwgcHJpdmF0ZSBzdGVwOiBJbmNyZW1lbnRhbFN0ZXB8bnVsbCkge1xuICAgIHRoaXMuX3N0YXRlID0gc3RhdGU7XG5cbiAgICAvLyBUaGUgY29tcGlsYXRpb24gYmVnaW5zIGluIGFuYWx5c2lzIHBoYXNlLlxuICAgIHRoaXMucGhhc2UgPSB7XG4gICAgICBraW5kOiBQaGFzZUtpbmQuQW5hbHlzaXMsXG4gICAgICBzZW1hbnRpY0RlcEdyYXBoVXBkYXRlcjpcbiAgICAgICAgICBuZXcgU2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIoc3RlcCAhPT0gbnVsbCA/IHN0ZXAucHJpb3JTdGF0ZS5zZW1hbnRpY0RlcEdyYXBoIDogbnVsbCksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWdpbiBhIGZyZXNoIGBJbmNyZW1lbnRhbENvbXBpbGF0aW9uYC5cbiAgICovXG4gIHN0YXRpYyBmcmVzaChwcm9ncmFtOiB0cy5Qcm9ncmFtLCB2ZXJzaW9uczogTWFwPEFic29sdXRlRnNQYXRoLCBzdHJpbmc+fG51bGwpOlxuICAgICAgSW5jcmVtZW50YWxDb21waWxhdGlvbiB7XG4gICAgY29uc3Qgc3RhdGU6IEluY3JlbWVudGFsU3RhdGUgPSB7XG4gICAgICBraW5kOiBJbmNyZW1lbnRhbFN0YXRlS2luZC5GcmVzaCxcbiAgICB9O1xuICAgIHJldHVybiBuZXcgSW5jcmVtZW50YWxDb21waWxhdGlvbihzdGF0ZSwgbmV3IEZpbGVEZXBlbmRlbmN5R3JhcGgoKSwgdmVyc2lvbnMsIC8qIHJldXNlICovIG51bGwpO1xuICB9XG5cbiAgc3RhdGljIGluY3JlbWVudGFsKFxuICAgICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgbmV3VmVyc2lvbnM6IE1hcDxBYnNvbHV0ZUZzUGF0aCwgc3RyaW5nPnxudWxsLCBvbGRQcm9ncmFtOiB0cy5Qcm9ncmFtLFxuICAgICAgb2xkU3RhdGU6IEluY3JlbWVudGFsU3RhdGUsIG1vZGlmaWVkUmVzb3VyY2VGaWxlczogU2V0PEFic29sdXRlRnNQYXRoPnxudWxsLFxuICAgICAgcGVyZjogUGVyZlJlY29yZGVyKTogSW5jcmVtZW50YWxDb21waWxhdGlvbiB7XG4gICAgcmV0dXJuIHBlcmYuaW5QaGFzZShQZXJmUGhhc2UuUmVjb25jaWxpYXRpb24sICgpID0+IHtcbiAgICAgIGNvbnN0IHBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcyA9IG5ldyBTZXQ8QWJzb2x1dGVGc1BhdGg+KCk7XG4gICAgICBjb25zdCBjaGFuZ2VkUmVzb3VyY2VGaWxlcyA9IG5ldyBTZXQ8QWJzb2x1dGVGc1BhdGg+KG1vZGlmaWVkUmVzb3VyY2VGaWxlcyA/PyBbXSk7XG5cblxuICAgICAgbGV0IHByaW9yQW5hbHlzaXM6IEFuYWx5emVkSW5jcmVtZW50YWxTdGF0ZTtcbiAgICAgIHN3aXRjaCAob2xkU3RhdGUua2luZCkge1xuICAgICAgICBjYXNlIEluY3JlbWVudGFsU3RhdGVLaW5kLkZyZXNoOlxuICAgICAgICAgIC8vIFNpbmNlIHRoaXMgbGluZSBvZiBwcm9ncmFtIGhhcyBuZXZlciBiZWVuIHN1Y2Nlc3NmdWxseSBhbmFseXplZCB0byBiZWdpbiB3aXRoLCB0cmVhdFxuICAgICAgICAgIC8vIHRoaXMgYXMgYSBmcmVzaCBjb21waWxhdGlvbi5cbiAgICAgICAgICByZXR1cm4gSW5jcmVtZW50YWxDb21waWxhdGlvbi5mcmVzaChwcm9ncmFtLCBuZXdWZXJzaW9ucyk7XG4gICAgICAgIGNhc2UgSW5jcmVtZW50YWxTdGF0ZUtpbmQuQW5hbHl6ZWQ6XG4gICAgICAgICAgLy8gVGhlIG1vc3QgcmVjZW50IHByb2dyYW0gd2FzIGFuYWx5emVkIHN1Y2Nlc3NmdWxseSwgc28gd2UgY2FuIHVzZSB0aGF0IGFzIG91ciBwcmlvclxuICAgICAgICAgIC8vIHN0YXRlIGFuZCBkb24ndCBuZWVkIHRvIGNvbnNpZGVyIGFueSBvdGhlciBkZWx0YXMgZXhjZXB0IGNoYW5nZXMgaW4gdGhlIG1vc3QgcmVjZW50XG4gICAgICAgICAgLy8gcHJvZ3JhbS5cbiAgICAgICAgICBwcmlvckFuYWx5c2lzID0gb2xkU3RhdGU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgSW5jcmVtZW50YWxTdGF0ZUtpbmQuRGVsdGE6XG4gICAgICAgICAgLy8gVGhlcmUgaXMgYW4gYW5jZXN0b3IgcHJvZ3JhbSB3aGljaCB3YXMgYW5hbHl6ZWQgc3VjY2Vzc2Z1bGx5IGFuZCBjYW4gYmUgdXNlZCBhcyBhXG4gICAgICAgICAgLy8gc3RhcnRpbmcgcG9pbnQsIGJ1dCB3ZSBuZWVkIHRvIGRldGVybWluZSB3aGF0J3MgY2hhbmdlZCBzaW5jZSB0aGF0IHByb2dyYW0uXG4gICAgICAgICAgcHJpb3JBbmFseXNpcyA9IG9sZFN0YXRlLmxhc3RBbmFseXplZFN0YXRlO1xuICAgICAgICAgIGZvciAoY29uc3Qgc2ZQYXRoIG9mIG9sZFN0YXRlLnBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcykge1xuICAgICAgICAgICAgcGh5c2ljYWxseUNoYW5nZWRUc0ZpbGVzLmFkZChzZlBhdGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGNvbnN0IHJlc291cmNlUGF0aCBvZiBvbGRTdGF0ZS5jaGFuZ2VkUmVzb3VyY2VGaWxlcykge1xuICAgICAgICAgICAgY2hhbmdlZFJlc291cmNlRmlsZXMuYWRkKHJlc291cmNlUGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRWZXJzaW9ucyA9IHByaW9yQW5hbHlzaXMudmVyc2lvbnM7XG5cbiAgICAgIGNvbnN0IG9sZEZpbGVzQXJyYXkgPSBvbGRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkubWFwKHNmID0+IHRvVW5yZWRpcmVjdGVkU291cmNlRmlsZShzZikpO1xuICAgICAgY29uc3Qgb2xkRmlsZXMgPSBuZXcgU2V0KG9sZEZpbGVzQXJyYXkpO1xuICAgICAgY29uc3QgZGVsZXRlZFRzRmlsZXMgPSBuZXcgU2V0KG9sZEZpbGVzQXJyYXkubWFwKHNmID0+IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpKSk7XG5cbiAgICAgIGZvciAoY29uc3QgcG9zc2libHlSZWRpcmVjdGVkTmV3RmlsZSBvZiBwcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgY29uc3Qgc2YgPSB0b1VucmVkaXJlY3RlZFNvdXJjZUZpbGUocG9zc2libHlSZWRpcmVjdGVkTmV3RmlsZSk7XG4gICAgICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuICAgICAgICAvLyBTaW5jZSB3ZSdyZSBzZWVpbmcgYSBmaWxlIGluIHRoZSBpbmNvbWluZyBwcm9ncmFtIHdpdGggdGhpcyBuYW1lLCBpdCBjYW4ndCBoYXZlIGJlZW5cbiAgICAgICAgLy8gZGVsZXRlZC5cbiAgICAgICAgZGVsZXRlZFRzRmlsZXMuZGVsZXRlKHNmUGF0aCk7XG5cbiAgICAgICAgaWYgKG9sZEZpbGVzLmhhcyhzZikpIHtcbiAgICAgICAgICAvLyBUaGlzIHNvdXJjZSBmaWxlIGhhcyB0aGUgc2FtZSBvYmplY3QgaWRlbnRpdHkgYXMgaW4gdGhlIHByZXZpb3VzIHByb2dyYW0uIFdlIG5lZWQgdG9cbiAgICAgICAgICAvLyBkZXRlcm1pbmUgaWYgaXQncyByZWFsbHkgdGhlIHNhbWUgZmlsZSwgb3IgaWYgaXQgbWlnaHQgaGF2ZSBjaGFuZ2VkIHZlcnNpb25zIHNpbmNlIHRoZVxuICAgICAgICAgIC8vIGxhc3QgcHJvZ3JhbSB3aXRob3V0IGNoYW5naW5nIGl0cyBpZGVudGl0eS5cblxuICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gdmVyc2lvbiBpbmZvcm1hdGlvbiBhdmFpbGFibGUsIHRoZW4gdGhpcyBpcyB0aGUgc2FtZSBmaWxlLCBhbmQgd2UgY2FuXG4gICAgICAgICAgLy8gc2tpcCBpdC5cbiAgICAgICAgICBpZiAob2xkVmVyc2lvbnMgPT09IG51bGwgfHwgbmV3VmVyc2lvbnMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIElmIGEgdmVyc2lvbiBpcyBhdmFpbGFibGUgZm9yIHRoZSBmaWxlIGZyb20gYm90aCB0aGUgcHJpb3IgYW5kIHRoZSBjdXJyZW50IHByb2dyYW0sIGFuZFxuICAgICAgICAgIC8vIHRoYXQgdmVyc2lvbiBpcyB0aGUgc2FtZSwgdGhlbiB0aGlzIGlzIHRoZSBzYW1lIGZpbGUsIGFuZCB3ZSBjYW4gc2tpcCBpdC5cbiAgICAgICAgICBpZiAob2xkVmVyc2lvbnMuaGFzKHNmUGF0aCkgJiYgbmV3VmVyc2lvbnMuaGFzKHNmUGF0aCkgJiZcbiAgICAgICAgICAgICAgb2xkVmVyc2lvbnMuZ2V0KHNmUGF0aCkhID09PSBuZXdWZXJzaW9ucy5nZXQoc2ZQYXRoKSEpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSwgYXNzdW1lIHRoYXQgdGhlIGZpbGUgaGFzIGNoYW5nZWQuIEVpdGhlciBpdHMgdmVyc2lvbnMgZGlkbid0IG1hdGNoLCBvciB3ZVxuICAgICAgICAgIC8vIHdlcmUgbWlzc2luZyB2ZXJzaW9uIGluZm9ybWF0aW9uIGFib3V0IGl0IG9uIG9uZSBzaWRlIGZvciBzb21lIHJlYXNvbi5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJhaWwgb3V0IGlmIGEgLmQudHMgZmlsZSBjaGFuZ2VzIC0gdGhlIHNlbWFudGljIGRlcCBncmFwaCBpcyBub3QgYWJsZSB0byBwcm9jZXNzIHN1Y2hcbiAgICAgICAgLy8gY2hhbmdlcyBjb3JyZWN0bHkgeWV0LlxuICAgICAgICBpZiAoc2YuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgICByZXR1cm4gSW5jcmVtZW50YWxDb21waWxhdGlvbi5mcmVzaChwcm9ncmFtLCBuZXdWZXJzaW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgZmlsZSBoYXMgY2hhbmdlZCBwaHlzaWNhbGx5LCBzbyByZWNvcmQgaXQuXG4gICAgICAgIHBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcy5hZGQoc2ZQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVtb3ZlIGFueSBmaWxlcyB0aGF0IGhhdmUgYmVlbiBkZWxldGVkIGZyb20gdGhlIGxpc3Qgb2YgcGh5c2ljYWwgY2hhbmdlcy5cbiAgICAgIGZvciAoY29uc3QgZGVsZXRlZEZpbGVOYW1lIG9mIGRlbGV0ZWRUc0ZpbGVzKSB7XG4gICAgICAgIHBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcy5kZWxldGUocmVzb2x2ZShkZWxldGVkRmlsZU5hbWUpKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXNlIHRoZSBwcmlvciBkZXBlbmRlbmN5IGdyYXBoIHRvIHByb2plY3QgcGh5c2ljYWwgY2hhbmdlcyBpbnRvIGEgc2V0IG9mIGxvZ2ljYWxseSBjaGFuZ2VkXG4gICAgICAvLyBmaWxlcy5cbiAgICAgIGNvbnN0IGRlcEdyYXBoID0gbmV3IEZpbGVEZXBlbmRlbmN5R3JhcGgoKTtcbiAgICAgIGNvbnN0IGxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzID0gZGVwR3JhcGgudXBkYXRlV2l0aFBoeXNpY2FsQ2hhbmdlcyhcbiAgICAgICAgICBwcmlvckFuYWx5c2lzLmRlcEdyYXBoLCBwaHlzaWNhbGx5Q2hhbmdlZFRzRmlsZXMsIGRlbGV0ZWRUc0ZpbGVzLCBjaGFuZ2VkUmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgIC8vIFBoeXNpY2FsbHkgY2hhbmdlZCBmaWxlcyBhcmVuJ3QgbmVjZXNzYXJpbHkgY291bnRlZCBhcyBsb2dpY2FsbHkgY2hhbmdlZCBieSB0aGUgZGVwZW5kZW5jeVxuICAgICAgLy8gZ3JhcGggKGZpbGVzIGRvIG5vdCBoYXZlIGVkZ2VzIHRvIHRoZW1zZWx2ZXMpLCBzbyBhZGQgdGhlbSB0byB0aGUgbG9naWNhbCBjaGFuZ2VzXG4gICAgICAvLyBleHBsaWNpdGx5LlxuICAgICAgZm9yIChjb25zdCBzZlBhdGggb2YgcGh5c2ljYWxseUNoYW5nZWRUc0ZpbGVzKSB7XG4gICAgICAgIGxvZ2ljYWxseUNoYW5nZWRUc0ZpbGVzLmFkZChzZlBhdGgpO1xuICAgICAgfVxuXG4gICAgICAvLyBTdGFydCBvZmYgaW4gYSBgRGVsdGFJbmNyZW1lbnRhbFN0YXRlYCBhcyBhIGRlbHRhIGFnYWluc3QgdGhlIHByZXZpb3VzIHN1Y2Nlc3NmdWwgYW5hbHlzaXMsXG4gICAgICAvLyB1bnRpbCB0aGlzIGNvbXBpbGF0aW9uIGNvbXBsZXRlcyBpdHMgb3duIGFuYWx5c2lzLlxuICAgICAgY29uc3Qgc3RhdGU6IERlbHRhSW5jcmVtZW50YWxTdGF0ZSA9IHtcbiAgICAgICAga2luZDogSW5jcmVtZW50YWxTdGF0ZUtpbmQuRGVsdGEsXG4gICAgICAgIHBoeXNpY2FsbHlDaGFuZ2VkVHNGaWxlcyxcbiAgICAgICAgY2hhbmdlZFJlc291cmNlRmlsZXMsXG4gICAgICAgIGxhc3RBbmFseXplZFN0YXRlOiBwcmlvckFuYWx5c2lzLFxuICAgICAgfTtcblxuICAgICAgcmV0dXJuIG5ldyBJbmNyZW1lbnRhbENvbXBpbGF0aW9uKHN0YXRlLCBkZXBHcmFwaCwgbmV3VmVyc2lvbnMsIHtcbiAgICAgICAgcHJpb3JTdGF0ZTogcHJpb3JBbmFseXNpcyxcbiAgICAgICAgbG9naWNhbGx5Q2hhbmdlZFRzRmlsZXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzdGF0ZSgpOiBJbmNyZW1lbnRhbFN0YXRlIHtcbiAgICByZXR1cm4gdGhpcy5fc3RhdGU7XG4gIH1cblxuICBnZXQgc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIoKTogU2VtYW50aWNEZXBHcmFwaFVwZGF0ZXIge1xuICAgIGlmICh0aGlzLnBoYXNlLmtpbmQgIT09IFBoYXNlS2luZC5BbmFseXNpcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogQ2Fubm90IHVwZGF0ZSB0aGUgU2VtYW50aWNEZXBHcmFwaCBhZnRlciBhbmFseXNpcyBjb21wbGV0ZXNgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGhhc2Uuc2VtYW50aWNEZXBHcmFwaFVwZGF0ZXI7XG4gIH1cblxuICByZWNvcmRTdWNjZXNzZnVsQW5hbHlzaXModHJhaXRDb21waWxlcjogVHJhaXRDb21waWxlcik6IHZvaWQge1xuICAgIGlmICh0aGlzLnBoYXNlLmtpbmQgIT09IFBoYXNlS2luZC5BbmFseXNpcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogSW5jcmVtZW50YWwgY29tcGlsYXRpb24gaW4gcGhhc2UgJHtcbiAgICAgICAgICBQaGFzZUtpbmRbdGhpcy5waGFzZS5raW5kXX0sIGV4cGVjdGVkIEFuYWx5c2lzYCk7XG4gICAgfVxuXG4gICAgY29uc3Qge25lZWRzRW1pdCwgbmVlZHNUeXBlQ2hlY2tFbWl0LCBuZXdHcmFwaH0gPSB0aGlzLnBoYXNlLnNlbWFudGljRGVwR3JhcGhVcGRhdGVyLmZpbmFsaXplKCk7XG5cbiAgICAvLyBEZXRlcm1pbmUgdGhlIHNldCBvZiBmaWxlcyB3aGljaCBoYXZlIGFscmVhZHkgYmVlbiBlbWl0dGVkLlxuICAgIGxldCBlbWl0dGVkOiBTZXQ8QWJzb2x1dGVGc1BhdGg+O1xuICAgIGlmICh0aGlzLnN0ZXAgPT09IG51bGwpIHtcbiAgICAgIC8vIFNpbmNlIHRoZXJlIGlzIG5vIHByaW9yIGNvbXBpbGF0aW9uLCBubyBmaWxlcyBoYXZlIHlldCBiZWVuIGVtaXR0ZWQuXG4gICAgICBlbWl0dGVkID0gbmV3IFNldCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBCZWdpbiB3aXRoIHRoZSBmaWxlcyBlbWl0dGVkIGJ5IHRoZSBwcmlvciBzdWNjZXNzZnVsIGNvbXBpbGF0aW9uLCBidXQgcmVtb3ZlIHRob3NlIHdoaWNoIHdlXG4gICAgICAvLyBrbm93IG5lZWQgdG8gYmVlIHJlLWVtaXR0ZWQuXG4gICAgICBlbWl0dGVkID0gbmV3IFNldCh0aGlzLnN0ZXAucHJpb3JTdGF0ZS5lbWl0dGVkKTtcblxuICAgICAgLy8gRmlsZXMgbmVlZCByZS1lbWl0dGVkIGlmIHRoZXkndmUgbG9naWNhbGx5IGNoYW5nZWQuXG4gICAgICBmb3IgKGNvbnN0IHNmUGF0aCBvZiB0aGlzLnN0ZXAubG9naWNhbGx5Q2hhbmdlZFRzRmlsZXMpIHtcbiAgICAgICAgZW1pdHRlZC5kZWxldGUoc2ZQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gRmlsZXMgbmVlZCByZS1lbWl0dGVkIGlmIHRoZXkndmUgc2VtYW50aWNhbGx5IGNoYW5nZWQuXG4gICAgICBmb3IgKGNvbnN0IHNmUGF0aCBvZiBuZWVkc0VtaXQpIHtcbiAgICAgICAgZW1pdHRlZC5kZWxldGUoc2ZQYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUcmFuc2l0aW9uIHRvIGEgc3VjY2Vzc2Z1bGx5IGFuYWx5emVkIGNvbXBpbGF0aW9uLiBBdCB0aGlzIHBvaW50LCBhIHN1YnNlcXVlbnQgY29tcGlsYXRpb25cbiAgICAvLyBjb3VsZCB1c2UgdGhpcyBzdGF0ZSBhcyBhIHN0YXJ0aW5nIHBvaW50LlxuICAgIHRoaXMuX3N0YXRlID0ge1xuICAgICAga2luZDogSW5jcmVtZW50YWxTdGF0ZUtpbmQuQW5hbHl6ZWQsXG4gICAgICB2ZXJzaW9uczogdGhpcy52ZXJzaW9ucyxcbiAgICAgIGRlcEdyYXBoOiB0aGlzLmRlcEdyYXBoLFxuICAgICAgc2VtYW50aWNEZXBHcmFwaDogbmV3R3JhcGgsXG4gICAgICBwcmlvckFuYWx5c2lzOiB0cmFpdENvbXBpbGVyLmdldEFuYWx5emVkUmVjb3JkcygpLFxuICAgICAgdHlwZUNoZWNrUmVzdWx0czogbnVsbCxcbiAgICAgIGVtaXR0ZWQsXG4gICAgfTtcblxuICAgIC8vIFdlIG5vdyBlbnRlciB0aGUgdHlwZS1jaGVjayBhbmQgZW1pdCBwaGFzZSBvZiBjb21waWxhdGlvbi5cbiAgICB0aGlzLnBoYXNlID0ge1xuICAgICAga2luZDogUGhhc2VLaW5kLlR5cGVDaGVja0FuZEVtaXQsXG4gICAgICBuZWVkc0VtaXQsXG4gICAgICBuZWVkc1R5cGVDaGVja0VtaXQsXG4gICAgfTtcbiAgfVxuXG4gIHJlY29yZFN1Y2Nlc3NmdWxUeXBlQ2hlY2socmVzdWx0czogTWFwPEFic29sdXRlRnNQYXRoLCBGaWxlVHlwZUNoZWNraW5nRGF0YT4pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5fc3RhdGUua2luZCAhPT0gSW5jcmVtZW50YWxTdGF0ZUtpbmQuQW5hbHl6ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkIHN1Y2Nlc3NmdWxseSBhbmFseXplZCBjb21waWxhdGlvbi5gKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGhhc2Uua2luZCAhPT0gUGhhc2VLaW5kLlR5cGVDaGVja0FuZEVtaXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IEluY3JlbWVudGFsIGNvbXBpbGF0aW9uIGluIHBoYXNlICR7XG4gICAgICAgICAgUGhhc2VLaW5kW3RoaXMucGhhc2Uua2luZF19LCBleHBlY3RlZCBUeXBlQ2hlY2tgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdGF0ZS50eXBlQ2hlY2tSZXN1bHRzID0gcmVzdWx0cztcbiAgfVxuXG5cbiAgcmVjb3JkU3VjY2Vzc2Z1bEVtaXQoc2Y6IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5fc3RhdGUua2luZCAhPT0gSW5jcmVtZW50YWxTdGF0ZUtpbmQuQW5hbHl6ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkIHN1Y2Nlc3NmdWxseSBhbmFseXplZCBjb21waWxhdGlvbi5gKTtcbiAgICB9XG4gICAgdGhpcy5fc3RhdGUuZW1pdHRlZC5hZGQoYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZikpO1xuICB9XG5cbiAgcHJpb3JBbmFseXNpc0ZvcihzZjogdHMuU291cmNlRmlsZSk6IENsYXNzUmVjb3JkW118bnVsbCB7XG4gICAgaWYgKHRoaXMuc3RlcCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG5cbiAgICAvLyBJZiB0aGUgZmlsZSBoYXMgbG9naWNhbGx5IGNoYW5nZWQsIGl0cyBwcmV2aW91cyBhbmFseXNpcyBjYW5ub3QgYmUgcmV1c2VkLlxuICAgIGlmICh0aGlzLnN0ZXAubG9naWNhbGx5Q2hhbmdlZFRzRmlsZXMuaGFzKHNmUGF0aCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHByaW9yQW5hbHlzaXMgPSB0aGlzLnN0ZXAucHJpb3JTdGF0ZS5wcmlvckFuYWx5c2lzO1xuICAgIGlmICghcHJpb3JBbmFseXNpcy5oYXMoc2YpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHByaW9yQW5hbHlzaXMuZ2V0KHNmKSE7XG4gIH1cblxuICBwcmlvclR5cGVDaGVja2luZ1Jlc3VsdHNGb3Ioc2Y6IHRzLlNvdXJjZUZpbGUpOiBGaWxlVHlwZUNoZWNraW5nRGF0YXxudWxsIHtcbiAgICBpZiAodGhpcy5waGFzZS5raW5kICE9PSBQaGFzZUtpbmQuVHlwZUNoZWNrQW5kRW1pdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogRXhwZWN0ZWQgc3VjY2Vzc2Z1bGx5IGFuYWx5emVkIGNvbXBpbGF0aW9uLmApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnN0ZXAgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuXG4gICAgLy8gSWYgdGhlIGZpbGUgaGFzIGxvZ2ljYWxseSBjaGFuZ2VkLCBvciBpdHMgdGVtcGxhdGUgdHlwZS1jaGVja2luZyByZXN1bHRzIGhhdmUgc2VtYW50aWNhbGx5XG4gICAgLy8gY2hhbmdlZCwgdGhlbiBwYXN0IHR5cGUtY2hlY2tpbmcgcmVzdWx0cyBjYW5ub3QgYmUgcmV1c2VkLlxuICAgIGlmICh0aGlzLnN0ZXAubG9naWNhbGx5Q2hhbmdlZFRzRmlsZXMuaGFzKHNmUGF0aCkgfHxcbiAgICAgICAgdGhpcy5waGFzZS5uZWVkc1R5cGVDaGVja0VtaXQuaGFzKHNmUGF0aCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFBhc3QgcmVzdWx0cyBhbHNvIGNhbm5vdCBiZSByZXVzZWQgaWYgdGhleSdyZSBub3QgYXZhaWxhYmxlLlxuICAgIGlmICh0aGlzLnN0ZXAucHJpb3JTdGF0ZS50eXBlQ2hlY2tSZXN1bHRzID09PSBudWxsIHx8XG4gICAgICAgICF0aGlzLnN0ZXAucHJpb3JTdGF0ZS50eXBlQ2hlY2tSZXN1bHRzLmhhcyhzZlBhdGgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBwcmlvclJlc3VsdHMgPSB0aGlzLnN0ZXAucHJpb3JTdGF0ZS50eXBlQ2hlY2tSZXN1bHRzLmdldChzZlBhdGgpITtcbiAgICAvLyBJZiB0aGUgcGFzdCByZXN1bHRzIHJlbGllZCBvbiBpbmxpbmluZywgdGhleSdyZSBub3Qgc2FmZSBmb3IgcmV1c2UuXG4gICAgaWYgKHByaW9yUmVzdWx0cy5oYXNJbmxpbmVzKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJpb3JSZXN1bHRzO1xuICB9XG5cbiAgc2FmZVRvU2tpcEVtaXQoc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgICAvLyBJZiB0aGlzIGlzIGEgZnJlc2ggY29tcGlsYXRpb24sIGl0J3MgbmV2ZXIgc2FmZSB0byBza2lwIGFuIGVtaXQuXG4gICAgaWYgKHRoaXMuc3RlcCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuXG4gICAgLy8gSWYgdGhlIGZpbGUgaGFzIGl0c2VsZiBsb2dpY2FsbHkgY2hhbmdlZCwgaXQgbXVzdCBiZSBlbWl0dGVkLlxuICAgIGlmICh0aGlzLnN0ZXAubG9naWNhbGx5Q2hhbmdlZFRzRmlsZXMuaGFzKHNmUGF0aCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5waGFzZS5raW5kICE9PSBQaGFzZUtpbmQuVHlwZUNoZWNrQW5kRW1pdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogRXhwZWN0ZWQgc3VjY2Vzc2Z1bCBhbmFseXNpcyBiZWZvcmUgYXR0ZW1wdGluZyB0byBlbWl0IGZpbGVzYCk7XG4gICAgfVxuXG4gICAgLy8gSWYgZHVyaW5nIGFuYWx5c2lzIGl0IHdhcyBkZXRlcm1pbmVkIHRoYXQgdGhpcyBmaWxlIGhhcyBzZW1hbnRpY2FsbHkgY2hhbmdlZCwgaXQgbXVzdCBiZVxuICAgIC8vIGVtaXR0ZWQuXG4gICAgaWYgKHRoaXMucGhhc2UubmVlZHNFbWl0LmhhcyhzZlBhdGgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhbGx5IGl0IHNob3VsZCBiZSBzYWZlIHRvIGFzc3VtZSBoZXJlIHRoYXQgdGhlIGZpbGUgd2FzIHByZXZpb3VzbHkgZW1pdHRlZCBieSB0aGUgbGFzdFxuICAgIC8vIHN1Y2Nlc3NmdWwgY29tcGlsYXRpb24uIEhvd2V2ZXIsIGFzIGEgZGVmZW5zZS1pbi1kZXB0aCBhZ2FpbnN0IGluY29ycmVjdG5lc3MsIHdlIGV4cGxpY2l0bHlcbiAgICAvLyBjaGVjayB0aGF0IHRoZSBsYXN0IGVtaXQgaW5jbHVkZWQgdGhpcyBmaWxlLCBhbmQgcmUtZW1pdCBpdCBvdGhlcndpc2UuXG4gICAgcmV0dXJuIHRoaXMuc3RlcC5wcmlvclN0YXRlLmVtaXR0ZWQuaGFzKHNmUGF0aCk7XG4gIH1cbn1cbiJdfQ==