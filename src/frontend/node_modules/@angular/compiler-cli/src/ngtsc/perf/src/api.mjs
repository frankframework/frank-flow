/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * A phase of compilation for which time is tracked in a distinct bucket.
 */
export var PerfPhase;
(function (PerfPhase) {
    /**
     * The "default" phase which tracks time not spent in any other phase.
     */
    PerfPhase[PerfPhase["Unaccounted"] = 0] = "Unaccounted";
    /**
     * Time spent setting up the compiler, before a TypeScript program is created.
     *
     * This includes operations like configuring the `ts.CompilerHost` and any wrappers.
     */
    PerfPhase[PerfPhase["Setup"] = 1] = "Setup";
    /**
     * Time spent in `ts.createProgram`, including reading and parsing `ts.SourceFile`s in the
     * `ts.CompilerHost`.
     *
     * This might be an incremental program creation operation.
     */
    PerfPhase[PerfPhase["TypeScriptProgramCreate"] = 2] = "TypeScriptProgramCreate";
    /**
     * Time spent reconciling the contents of an old `ts.Program` with the new incremental one.
     *
     * Only present in incremental compilations.
     */
    PerfPhase[PerfPhase["Reconciliation"] = 3] = "Reconciliation";
    /**
     * Time spent updating an `NgCompiler` instance with a resource-only change.
     *
     * Only present in incremental compilations where the change was resource-only.
     */
    PerfPhase[PerfPhase["ResourceUpdate"] = 4] = "ResourceUpdate";
    /**
     * Time spent calculating the plain TypeScript diagnostics (structural and semantic).
     */
    PerfPhase[PerfPhase["TypeScriptDiagnostics"] = 5] = "TypeScriptDiagnostics";
    /**
     * Time spent in Angular analysis of individual classes in the program.
     */
    PerfPhase[PerfPhase["Analysis"] = 6] = "Analysis";
    /**
     * Time spent in Angular global analysis (synthesis of analysis information into a complete
     * understanding of the program).
     */
    PerfPhase[PerfPhase["Resolve"] = 7] = "Resolve";
    /**
     * Time spent building the import graph of the program in order to perform cycle detection.
     */
    PerfPhase[PerfPhase["CycleDetection"] = 8] = "CycleDetection";
    /**
     * Time spent generating the text of Type Check Blocks in order to perform template type checking.
     */
    PerfPhase[PerfPhase["TcbGeneration"] = 9] = "TcbGeneration";
    /**
     * Time spent updating the `ts.Program` with new Type Check Block code.
     */
    PerfPhase[PerfPhase["TcbUpdateProgram"] = 10] = "TcbUpdateProgram";
    /**
     * Time spent by TypeScript performing its emit operations, including downleveling and writing
     * output files.
     */
    PerfPhase[PerfPhase["TypeScriptEmit"] = 11] = "TypeScriptEmit";
    /**
     * Time spent by Angular performing code transformations of ASTs as they're about to be emitted.
     *
     * This includes the actual code generation step for templates, and occurs during the emit phase
     * (but is tracked separately from `TypeScriptEmit` time).
     */
    PerfPhase[PerfPhase["Compile"] = 12] = "Compile";
    /**
     * Time spent performing a `TemplateTypeChecker` autocompletion operation.
     */
    PerfPhase[PerfPhase["TtcAutocompletion"] = 13] = "TtcAutocompletion";
    /**
     * Time spent computing template type-checking diagnostics.
     */
    PerfPhase[PerfPhase["TtcDiagnostics"] = 14] = "TtcDiagnostics";
    /**
     * Time spent getting a `Symbol` from the `TemplateTypeChecker`.
     */
    PerfPhase[PerfPhase["TtcSymbol"] = 15] = "TtcSymbol";
    /**
     * Time spent by the Angular Language Service calculating a "get references" or a renaming
     * operation.
     */
    PerfPhase[PerfPhase["LsReferencesAndRenames"] = 16] = "LsReferencesAndRenames";
    /**
     * Time spent by the Angular Language Service calculating a "quick info" operation.
     */
    PerfPhase[PerfPhase["LsQuickInfo"] = 17] = "LsQuickInfo";
    /**
     * Time spent by the Angular Language Service calculating a "get type definition" or "get
     * definition" operation.
     */
    PerfPhase[PerfPhase["LsDefinition"] = 18] = "LsDefinition";
    /**
     * Time spent by the Angular Language Service calculating a "get completions" (AKA autocomplete)
     * operation.
     */
    PerfPhase[PerfPhase["LsCompletions"] = 19] = "LsCompletions";
    /**
     * Time spent by the Angular Language Service calculating a "view template typecheck block"
     * operation.
     */
    PerfPhase[PerfPhase["LsTcb"] = 20] = "LsTcb";
    /**
     * Time spent by the Angular Language Service calculating diagnostics.
     */
    PerfPhase[PerfPhase["LsDiagnostics"] = 21] = "LsDiagnostics";
    /**
     * Time spent by the Angular Language Service calculating a "get component locations for template"
     * operation.
     */
    PerfPhase[PerfPhase["LsComponentLocations"] = 22] = "LsComponentLocations";
    /**
     * Time spent by the Angular Language Service calculating signature help.
     */
    PerfPhase[PerfPhase["LsSignatureHelp"] = 23] = "LsSignatureHelp";
    /**
     * Tracks the number of `PerfPhase`s, and must appear at the end of the list.
     */
    PerfPhase[PerfPhase["LAST"] = 24] = "LAST";
})(PerfPhase || (PerfPhase = {}));
/**
 * Represents some occurrence during compilation, and is tracked with a counter.
 */
export var PerfEvent;
(function (PerfEvent) {
    /**
     * Counts the number of `.d.ts` files in the program.
     */
    PerfEvent[PerfEvent["InputDtsFile"] = 0] = "InputDtsFile";
    /**
     * Counts the number of non-`.d.ts` files in the program.
     */
    PerfEvent[PerfEvent["InputTsFile"] = 1] = "InputTsFile";
    /**
     * An `@Component` class was analyzed.
     */
    PerfEvent[PerfEvent["AnalyzeComponent"] = 2] = "AnalyzeComponent";
    /**
     * An `@Directive` class was analyzed.
     */
    PerfEvent[PerfEvent["AnalyzeDirective"] = 3] = "AnalyzeDirective";
    /**
     * An `@Injectable` class was analyzed.
     */
    PerfEvent[PerfEvent["AnalyzeInjectable"] = 4] = "AnalyzeInjectable";
    /**
     * An `@NgModule` class was analyzed.
     */
    PerfEvent[PerfEvent["AnalyzeNgModule"] = 5] = "AnalyzeNgModule";
    /**
     * An `@Pipe` class was analyzed.
     */
    PerfEvent[PerfEvent["AnalyzePipe"] = 6] = "AnalyzePipe";
    /**
     * A trait was analyzed.
     *
     * In theory, this should be the sum of the `Analyze` counters for each decorator type.
     */
    PerfEvent[PerfEvent["TraitAnalyze"] = 7] = "TraitAnalyze";
    /**
     * A trait had a prior analysis available from an incremental program, and did not need to be
     * re-analyzed.
     */
    PerfEvent[PerfEvent["TraitReuseAnalysis"] = 8] = "TraitReuseAnalysis";
    /**
     * A `ts.SourceFile` directly changed between the prior program and a new incremental compilation.
     */
    PerfEvent[PerfEvent["SourceFilePhysicalChange"] = 9] = "SourceFilePhysicalChange";
    /**
     * A `ts.SourceFile` did not physically changed, but according to the file dependency graph, has
     * logically changed between the prior program and a new incremental compilation.
     */
    PerfEvent[PerfEvent["SourceFileLogicalChange"] = 10] = "SourceFileLogicalChange";
    /**
     * A `ts.SourceFile` has not logically changed and all of its analysis results were thus available
     * for reuse.
     */
    PerfEvent[PerfEvent["SourceFileReuseAnalysis"] = 11] = "SourceFileReuseAnalysis";
    /**
     * A Type Check Block (TCB) was generated.
     */
    PerfEvent[PerfEvent["GenerateTcb"] = 12] = "GenerateTcb";
    /**
     * A Type Check Block (TCB) could not be generated because inlining was disabled, and the block
     * would've required inlining.
     */
    PerfEvent[PerfEvent["SkipGenerateTcbNoInline"] = 13] = "SkipGenerateTcbNoInline";
    /**
     * A `.ngtypecheck.ts` file could be reused from the previous program and did not need to be
     * regenerated.
     */
    PerfEvent[PerfEvent["ReuseTypeCheckFile"] = 14] = "ReuseTypeCheckFile";
    /**
     * The template type-checking program required changes and had to be updated in an incremental
     * step.
     */
    PerfEvent[PerfEvent["UpdateTypeCheckProgram"] = 15] = "UpdateTypeCheckProgram";
    /**
     * The compiler was able to prove that a `ts.SourceFile` did not need to be re-emitted.
     */
    PerfEvent[PerfEvent["EmitSkipSourceFile"] = 16] = "EmitSkipSourceFile";
    /**
     * A `ts.SourceFile` was emitted.
     */
    PerfEvent[PerfEvent["EmitSourceFile"] = 17] = "EmitSourceFile";
    /**
     * Tracks the number of `PrefEvent`s, and must appear at the end of the list.
     */
    PerfEvent[PerfEvent["LAST"] = 18] = "LAST";
})(PerfEvent || (PerfEvent = {}));
/**
 * Represents a checkpoint during compilation at which the memory usage of the compiler should be
 * recorded.
 */
export var PerfCheckpoint;
(function (PerfCheckpoint) {
    /**
     * The point at which the `PerfRecorder` was created, and ideally tracks memory used before any
     * compilation structures are created.
     */
    PerfCheckpoint[PerfCheckpoint["Initial"] = 0] = "Initial";
    /**
     * The point just after the `ts.Program` has been created.
     */
    PerfCheckpoint[PerfCheckpoint["TypeScriptProgramCreate"] = 1] = "TypeScriptProgramCreate";
    /**
     * The point just before Angular analysis starts.
     *
     * In the main usage pattern for the compiler, TypeScript diagnostics have been calculated at this
     * point, so the `ts.TypeChecker` has fully ingested the current program, all `ts.Type` structures
     * and `ts.Symbol`s have been created.
     */
    PerfCheckpoint[PerfCheckpoint["PreAnalysis"] = 2] = "PreAnalysis";
    /**
     * The point just after Angular analysis completes.
     */
    PerfCheckpoint[PerfCheckpoint["Analysis"] = 3] = "Analysis";
    /**
     * The point just after Angular resolution is complete.
     */
    PerfCheckpoint[PerfCheckpoint["Resolve"] = 4] = "Resolve";
    /**
     * The point just after Type Check Blocks (TCBs) have been generated.
     */
    PerfCheckpoint[PerfCheckpoint["TtcGeneration"] = 5] = "TtcGeneration";
    /**
     * The point just after the template type-checking program has been updated with any new TCBs.
     */
    PerfCheckpoint[PerfCheckpoint["TtcUpdateProgram"] = 6] = "TtcUpdateProgram";
    /**
     * The point just before emit begins.
     *
     * In the main usage pattern for the compiler, all template type-checking diagnostics have been
     * requested at this point.
     */
    PerfCheckpoint[PerfCheckpoint["PreEmit"] = 7] = "PreEmit";
    /**
     * The point just after the program has been fully emitted.
     */
    PerfCheckpoint[PerfCheckpoint["Emit"] = 8] = "Emit";
    /**
     * Tracks the number of `PerfCheckpoint`s, and must appear at the end of the list.
     */
    PerfCheckpoint[PerfCheckpoint["LAST"] = 9] = "LAST";
})(PerfCheckpoint || (PerfCheckpoint = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9wZXJmL3NyYy9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUg7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxTQWdKWDtBQWhKRCxXQUFZLFNBQVM7SUFDbkI7O09BRUc7SUFDSCx1REFBVyxDQUFBO0lBRVg7Ozs7T0FJRztJQUNILDJDQUFLLENBQUE7SUFFTDs7Ozs7T0FLRztJQUNILCtFQUF1QixDQUFBO0lBRXZCOzs7O09BSUc7SUFDSCw2REFBYyxDQUFBO0lBRWQ7Ozs7T0FJRztJQUNILDZEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILDJFQUFxQixDQUFBO0lBRXJCOztPQUVHO0lBQ0gsaURBQVEsQ0FBQTtJQUVSOzs7T0FHRztJQUNILCtDQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILDZEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILDJEQUFhLENBQUE7SUFFYjs7T0FFRztJQUNILGtFQUFnQixDQUFBO0lBRWhCOzs7T0FHRztJQUNILDhEQUFjLENBQUE7SUFFZDs7Ozs7T0FLRztJQUNILGdEQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILG9FQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsOERBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsb0RBQVMsQ0FBQTtJQUVUOzs7T0FHRztJQUNILDhFQUFzQixDQUFBO0lBRXRCOztPQUVHO0lBQ0gsd0RBQVcsQ0FBQTtJQUVYOzs7T0FHRztJQUNILDBEQUFZLENBQUE7SUFFWjs7O09BR0c7SUFDSCw0REFBYSxDQUFBO0lBRWI7OztPQUdHO0lBQ0gsNENBQUssQ0FBQTtJQUVMOztPQUVHO0lBQ0gsNERBQWEsQ0FBQTtJQUViOzs7T0FHRztJQUNILDBFQUFvQixDQUFBO0lBRXBCOztPQUVHO0lBQ0gsZ0VBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsMENBQUksQ0FBQTtBQUNOLENBQUMsRUFoSlcsU0FBUyxLQUFULFNBQVMsUUFnSnBCO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxTQXVHWDtBQXZHRCxXQUFZLFNBQVM7SUFDbkI7O09BRUc7SUFDSCx5REFBWSxDQUFBO0lBRVo7O09BRUc7SUFDSCx1REFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCxpRUFBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILGlFQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsbUVBQWlCLENBQUE7SUFFakI7O09BRUc7SUFDSCwrREFBZSxDQUFBO0lBRWY7O09BRUc7SUFDSCx1REFBVyxDQUFBO0lBRVg7Ozs7T0FJRztJQUNILHlEQUFZLENBQUE7SUFFWjs7O09BR0c7SUFDSCxxRUFBa0IsQ0FBQTtJQUVsQjs7T0FFRztJQUNILGlGQUF3QixDQUFBO0lBRXhCOzs7T0FHRztJQUNILGdGQUF1QixDQUFBO0lBRXZCOzs7T0FHRztJQUNILGdGQUF1QixDQUFBO0lBRXZCOztPQUVHO0lBQ0gsd0RBQVcsQ0FBQTtJQUVYOzs7T0FHRztJQUNILGdGQUF1QixDQUFBO0lBRXZCOzs7T0FHRztJQUNILHNFQUFrQixDQUFBO0lBRWxCOzs7T0FHRztJQUNILDhFQUFzQixDQUFBO0lBRXRCOztPQUVHO0lBQ0gsc0VBQWtCLENBQUE7SUFFbEI7O09BRUc7SUFDSCw4REFBYyxDQUFBO0lBRWQ7O09BRUc7SUFDSCwwQ0FBSSxDQUFBO0FBQ04sQ0FBQyxFQXZHVyxTQUFTLEtBQVQsU0FBUyxRQXVHcEI7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLENBQU4sSUFBWSxjQTBEWDtBQTFERCxXQUFZLGNBQWM7SUFDeEI7OztPQUdHO0lBQ0gseURBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gseUZBQXVCLENBQUE7SUFFdkI7Ozs7OztPQU1HO0lBQ0gsaUVBQVcsQ0FBQTtJQUVYOztPQUVHO0lBQ0gsMkRBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gseURBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gscUVBQWEsQ0FBQTtJQUViOztPQUVHO0lBQ0gsMkVBQWdCLENBQUE7SUFFaEI7Ozs7O09BS0c7SUFDSCx5REFBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxtREFBSSxDQUFBO0lBRUo7O09BRUc7SUFDSCxtREFBSSxDQUFBO0FBQ04sQ0FBQyxFQTFEVyxjQUFjLEtBQWQsY0FBYyxRQTBEekIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBBIHBoYXNlIG9mIGNvbXBpbGF0aW9uIGZvciB3aGljaCB0aW1lIGlzIHRyYWNrZWQgaW4gYSBkaXN0aW5jdCBidWNrZXQuXG4gKi9cbmV4cG9ydCBlbnVtIFBlcmZQaGFzZSB7XG4gIC8qKlxuICAgKiBUaGUgXCJkZWZhdWx0XCIgcGhhc2Ugd2hpY2ggdHJhY2tzIHRpbWUgbm90IHNwZW50IGluIGFueSBvdGhlciBwaGFzZS5cbiAgICovXG4gIFVuYWNjb3VudGVkLFxuXG4gIC8qKlxuICAgKiBUaW1lIHNwZW50IHNldHRpbmcgdXAgdGhlIGNvbXBpbGVyLCBiZWZvcmUgYSBUeXBlU2NyaXB0IHByb2dyYW0gaXMgY3JlYXRlZC5cbiAgICpcbiAgICogVGhpcyBpbmNsdWRlcyBvcGVyYXRpb25zIGxpa2UgY29uZmlndXJpbmcgdGhlIGB0cy5Db21waWxlckhvc3RgIGFuZCBhbnkgd3JhcHBlcnMuXG4gICAqL1xuICBTZXR1cCxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBpbiBgdHMuY3JlYXRlUHJvZ3JhbWAsIGluY2x1ZGluZyByZWFkaW5nIGFuZCBwYXJzaW5nIGB0cy5Tb3VyY2VGaWxlYHMgaW4gdGhlXG4gICAqIGB0cy5Db21waWxlckhvc3RgLlxuICAgKlxuICAgKiBUaGlzIG1pZ2h0IGJlIGFuIGluY3JlbWVudGFsIHByb2dyYW0gY3JlYXRpb24gb3BlcmF0aW9uLlxuICAgKi9cbiAgVHlwZVNjcmlwdFByb2dyYW1DcmVhdGUsXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgcmVjb25jaWxpbmcgdGhlIGNvbnRlbnRzIG9mIGFuIG9sZCBgdHMuUHJvZ3JhbWAgd2l0aCB0aGUgbmV3IGluY3JlbWVudGFsIG9uZS5cbiAgICpcbiAgICogT25seSBwcmVzZW50IGluIGluY3JlbWVudGFsIGNvbXBpbGF0aW9ucy5cbiAgICovXG4gIFJlY29uY2lsaWF0aW9uLFxuXG4gIC8qKlxuICAgKiBUaW1lIHNwZW50IHVwZGF0aW5nIGFuIGBOZ0NvbXBpbGVyYCBpbnN0YW5jZSB3aXRoIGEgcmVzb3VyY2Utb25seSBjaGFuZ2UuXG4gICAqXG4gICAqIE9ubHkgcHJlc2VudCBpbiBpbmNyZW1lbnRhbCBjb21waWxhdGlvbnMgd2hlcmUgdGhlIGNoYW5nZSB3YXMgcmVzb3VyY2Utb25seS5cbiAgICovXG4gIFJlc291cmNlVXBkYXRlLFxuXG4gIC8qKlxuICAgKiBUaW1lIHNwZW50IGNhbGN1bGF0aW5nIHRoZSBwbGFpbiBUeXBlU2NyaXB0IGRpYWdub3N0aWNzIChzdHJ1Y3R1cmFsIGFuZCBzZW1hbnRpYykuXG4gICAqL1xuICBUeXBlU2NyaXB0RGlhZ25vc3RpY3MsXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgaW4gQW5ndWxhciBhbmFseXNpcyBvZiBpbmRpdmlkdWFsIGNsYXNzZXMgaW4gdGhlIHByb2dyYW0uXG4gICAqL1xuICBBbmFseXNpcyxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBpbiBBbmd1bGFyIGdsb2JhbCBhbmFseXNpcyAoc3ludGhlc2lzIG9mIGFuYWx5c2lzIGluZm9ybWF0aW9uIGludG8gYSBjb21wbGV0ZVxuICAgKiB1bmRlcnN0YW5kaW5nIG9mIHRoZSBwcm9ncmFtKS5cbiAgICovXG4gIFJlc29sdmUsXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgYnVpbGRpbmcgdGhlIGltcG9ydCBncmFwaCBvZiB0aGUgcHJvZ3JhbSBpbiBvcmRlciB0byBwZXJmb3JtIGN5Y2xlIGRldGVjdGlvbi5cbiAgICovXG4gIEN5Y2xlRGV0ZWN0aW9uLFxuXG4gIC8qKlxuICAgKiBUaW1lIHNwZW50IGdlbmVyYXRpbmcgdGhlIHRleHQgb2YgVHlwZSBDaGVjayBCbG9ja3MgaW4gb3JkZXIgdG8gcGVyZm9ybSB0ZW1wbGF0ZSB0eXBlIGNoZWNraW5nLlxuICAgKi9cbiAgVGNiR2VuZXJhdGlvbixcblxuICAvKipcbiAgICogVGltZSBzcGVudCB1cGRhdGluZyB0aGUgYHRzLlByb2dyYW1gIHdpdGggbmV3IFR5cGUgQ2hlY2sgQmxvY2sgY29kZS5cbiAgICovXG4gIFRjYlVwZGF0ZVByb2dyYW0sXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgYnkgVHlwZVNjcmlwdCBwZXJmb3JtaW5nIGl0cyBlbWl0IG9wZXJhdGlvbnMsIGluY2x1ZGluZyBkb3dubGV2ZWxpbmcgYW5kIHdyaXRpbmdcbiAgICogb3V0cHV0IGZpbGVzLlxuICAgKi9cbiAgVHlwZVNjcmlwdEVtaXQsXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgYnkgQW5ndWxhciBwZXJmb3JtaW5nIGNvZGUgdHJhbnNmb3JtYXRpb25zIG9mIEFTVHMgYXMgdGhleSdyZSBhYm91dCB0byBiZSBlbWl0dGVkLlxuICAgKlxuICAgKiBUaGlzIGluY2x1ZGVzIHRoZSBhY3R1YWwgY29kZSBnZW5lcmF0aW9uIHN0ZXAgZm9yIHRlbXBsYXRlcywgYW5kIG9jY3VycyBkdXJpbmcgdGhlIGVtaXQgcGhhc2VcbiAgICogKGJ1dCBpcyB0cmFja2VkIHNlcGFyYXRlbHkgZnJvbSBgVHlwZVNjcmlwdEVtaXRgIHRpbWUpLlxuICAgKi9cbiAgQ29tcGlsZSxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBwZXJmb3JtaW5nIGEgYFRlbXBsYXRlVHlwZUNoZWNrZXJgIGF1dG9jb21wbGV0aW9uIG9wZXJhdGlvbi5cbiAgICovXG4gIFR0Y0F1dG9jb21wbGV0aW9uLFxuXG4gIC8qKlxuICAgKiBUaW1lIHNwZW50IGNvbXB1dGluZyB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIGRpYWdub3N0aWNzLlxuICAgKi9cbiAgVHRjRGlhZ25vc3RpY3MsXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgZ2V0dGluZyBhIGBTeW1ib2xgIGZyb20gdGhlIGBUZW1wbGF0ZVR5cGVDaGVja2VyYC5cbiAgICovXG4gIFR0Y1N5bWJvbCxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBieSB0aGUgQW5ndWxhciBMYW5ndWFnZSBTZXJ2aWNlIGNhbGN1bGF0aW5nIGEgXCJnZXQgcmVmZXJlbmNlc1wiIG9yIGEgcmVuYW1pbmdcbiAgICogb3BlcmF0aW9uLlxuICAgKi9cbiAgTHNSZWZlcmVuY2VzQW5kUmVuYW1lcyxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBieSB0aGUgQW5ndWxhciBMYW5ndWFnZSBTZXJ2aWNlIGNhbGN1bGF0aW5nIGEgXCJxdWljayBpbmZvXCIgb3BlcmF0aW9uLlxuICAgKi9cbiAgTHNRdWlja0luZm8sXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgYnkgdGhlIEFuZ3VsYXIgTGFuZ3VhZ2UgU2VydmljZSBjYWxjdWxhdGluZyBhIFwiZ2V0IHR5cGUgZGVmaW5pdGlvblwiIG9yIFwiZ2V0XG4gICAqIGRlZmluaXRpb25cIiBvcGVyYXRpb24uXG4gICAqL1xuICBMc0RlZmluaXRpb24sXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgYnkgdGhlIEFuZ3VsYXIgTGFuZ3VhZ2UgU2VydmljZSBjYWxjdWxhdGluZyBhIFwiZ2V0IGNvbXBsZXRpb25zXCIgKEFLQSBhdXRvY29tcGxldGUpXG4gICAqIG9wZXJhdGlvbi5cbiAgICovXG4gIExzQ29tcGxldGlvbnMsXG5cbiAgLyoqXG4gICAqIFRpbWUgc3BlbnQgYnkgdGhlIEFuZ3VsYXIgTGFuZ3VhZ2UgU2VydmljZSBjYWxjdWxhdGluZyBhIFwidmlldyB0ZW1wbGF0ZSB0eXBlY2hlY2sgYmxvY2tcIlxuICAgKiBvcGVyYXRpb24uXG4gICAqL1xuICBMc1RjYixcblxuICAvKipcbiAgICogVGltZSBzcGVudCBieSB0aGUgQW5ndWxhciBMYW5ndWFnZSBTZXJ2aWNlIGNhbGN1bGF0aW5nIGRpYWdub3N0aWNzLlxuICAgKi9cbiAgTHNEaWFnbm9zdGljcyxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBieSB0aGUgQW5ndWxhciBMYW5ndWFnZSBTZXJ2aWNlIGNhbGN1bGF0aW5nIGEgXCJnZXQgY29tcG9uZW50IGxvY2F0aW9ucyBmb3IgdGVtcGxhdGVcIlxuICAgKiBvcGVyYXRpb24uXG4gICAqL1xuICBMc0NvbXBvbmVudExvY2F0aW9ucyxcblxuICAvKipcbiAgICogVGltZSBzcGVudCBieSB0aGUgQW5ndWxhciBMYW5ndWFnZSBTZXJ2aWNlIGNhbGN1bGF0aW5nIHNpZ25hdHVyZSBoZWxwLlxuICAgKi9cbiAgTHNTaWduYXR1cmVIZWxwLFxuXG4gIC8qKlxuICAgKiBUcmFja3MgdGhlIG51bWJlciBvZiBgUGVyZlBoYXNlYHMsIGFuZCBtdXN0IGFwcGVhciBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0LlxuICAgKi9cbiAgTEFTVCxcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHNvbWUgb2NjdXJyZW5jZSBkdXJpbmcgY29tcGlsYXRpb24sIGFuZCBpcyB0cmFja2VkIHdpdGggYSBjb3VudGVyLlxuICovXG5leHBvcnQgZW51bSBQZXJmRXZlbnQge1xuICAvKipcbiAgICogQ291bnRzIHRoZSBudW1iZXIgb2YgYC5kLnRzYCBmaWxlcyBpbiB0aGUgcHJvZ3JhbS5cbiAgICovXG4gIElucHV0RHRzRmlsZSxcblxuICAvKipcbiAgICogQ291bnRzIHRoZSBudW1iZXIgb2Ygbm9uLWAuZC50c2AgZmlsZXMgaW4gdGhlIHByb2dyYW0uXG4gICAqL1xuICBJbnB1dFRzRmlsZSxcblxuICAvKipcbiAgICogQW4gYEBDb21wb25lbnRgIGNsYXNzIHdhcyBhbmFseXplZC5cbiAgICovXG4gIEFuYWx5emVDb21wb25lbnQsXG5cbiAgLyoqXG4gICAqIEFuIGBARGlyZWN0aXZlYCBjbGFzcyB3YXMgYW5hbHl6ZWQuXG4gICAqL1xuICBBbmFseXplRGlyZWN0aXZlLFxuXG4gIC8qKlxuICAgKiBBbiBgQEluamVjdGFibGVgIGNsYXNzIHdhcyBhbmFseXplZC5cbiAgICovXG4gIEFuYWx5emVJbmplY3RhYmxlLFxuXG4gIC8qKlxuICAgKiBBbiBgQE5nTW9kdWxlYCBjbGFzcyB3YXMgYW5hbHl6ZWQuXG4gICAqL1xuICBBbmFseXplTmdNb2R1bGUsXG5cbiAgLyoqXG4gICAqIEFuIGBAUGlwZWAgY2xhc3Mgd2FzIGFuYWx5emVkLlxuICAgKi9cbiAgQW5hbHl6ZVBpcGUsXG5cbiAgLyoqXG4gICAqIEEgdHJhaXQgd2FzIGFuYWx5emVkLlxuICAgKlxuICAgKiBJbiB0aGVvcnksIHRoaXMgc2hvdWxkIGJlIHRoZSBzdW0gb2YgdGhlIGBBbmFseXplYCBjb3VudGVycyBmb3IgZWFjaCBkZWNvcmF0b3IgdHlwZS5cbiAgICovXG4gIFRyYWl0QW5hbHl6ZSxcblxuICAvKipcbiAgICogQSB0cmFpdCBoYWQgYSBwcmlvciBhbmFseXNpcyBhdmFpbGFibGUgZnJvbSBhbiBpbmNyZW1lbnRhbCBwcm9ncmFtLCBhbmQgZGlkIG5vdCBuZWVkIHRvIGJlXG4gICAqIHJlLWFuYWx5emVkLlxuICAgKi9cbiAgVHJhaXRSZXVzZUFuYWx5c2lzLFxuXG4gIC8qKlxuICAgKiBBIGB0cy5Tb3VyY2VGaWxlYCBkaXJlY3RseSBjaGFuZ2VkIGJldHdlZW4gdGhlIHByaW9yIHByb2dyYW0gYW5kIGEgbmV3IGluY3JlbWVudGFsIGNvbXBpbGF0aW9uLlxuICAgKi9cbiAgU291cmNlRmlsZVBoeXNpY2FsQ2hhbmdlLFxuXG4gIC8qKlxuICAgKiBBIGB0cy5Tb3VyY2VGaWxlYCBkaWQgbm90IHBoeXNpY2FsbHkgY2hhbmdlZCwgYnV0IGFjY29yZGluZyB0byB0aGUgZmlsZSBkZXBlbmRlbmN5IGdyYXBoLCBoYXNcbiAgICogbG9naWNhbGx5IGNoYW5nZWQgYmV0d2VlbiB0aGUgcHJpb3IgcHJvZ3JhbSBhbmQgYSBuZXcgaW5jcmVtZW50YWwgY29tcGlsYXRpb24uXG4gICAqL1xuICBTb3VyY2VGaWxlTG9naWNhbENoYW5nZSxcblxuICAvKipcbiAgICogQSBgdHMuU291cmNlRmlsZWAgaGFzIG5vdCBsb2dpY2FsbHkgY2hhbmdlZCBhbmQgYWxsIG9mIGl0cyBhbmFseXNpcyByZXN1bHRzIHdlcmUgdGh1cyBhdmFpbGFibGVcbiAgICogZm9yIHJldXNlLlxuICAgKi9cbiAgU291cmNlRmlsZVJldXNlQW5hbHlzaXMsXG5cbiAgLyoqXG4gICAqIEEgVHlwZSBDaGVjayBCbG9jayAoVENCKSB3YXMgZ2VuZXJhdGVkLlxuICAgKi9cbiAgR2VuZXJhdGVUY2IsXG5cbiAgLyoqXG4gICAqIEEgVHlwZSBDaGVjayBCbG9jayAoVENCKSBjb3VsZCBub3QgYmUgZ2VuZXJhdGVkIGJlY2F1c2UgaW5saW5pbmcgd2FzIGRpc2FibGVkLCBhbmQgdGhlIGJsb2NrXG4gICAqIHdvdWxkJ3ZlIHJlcXVpcmVkIGlubGluaW5nLlxuICAgKi9cbiAgU2tpcEdlbmVyYXRlVGNiTm9JbmxpbmUsXG5cbiAgLyoqXG4gICAqIEEgYC5uZ3R5cGVjaGVjay50c2AgZmlsZSBjb3VsZCBiZSByZXVzZWQgZnJvbSB0aGUgcHJldmlvdXMgcHJvZ3JhbSBhbmQgZGlkIG5vdCBuZWVkIHRvIGJlXG4gICAqIHJlZ2VuZXJhdGVkLlxuICAgKi9cbiAgUmV1c2VUeXBlQ2hlY2tGaWxlLFxuXG4gIC8qKlxuICAgKiBUaGUgdGVtcGxhdGUgdHlwZS1jaGVja2luZyBwcm9ncmFtIHJlcXVpcmVkIGNoYW5nZXMgYW5kIGhhZCB0byBiZSB1cGRhdGVkIGluIGFuIGluY3JlbWVudGFsXG4gICAqIHN0ZXAuXG4gICAqL1xuICBVcGRhdGVUeXBlQ2hlY2tQcm9ncmFtLFxuXG4gIC8qKlxuICAgKiBUaGUgY29tcGlsZXIgd2FzIGFibGUgdG8gcHJvdmUgdGhhdCBhIGB0cy5Tb3VyY2VGaWxlYCBkaWQgbm90IG5lZWQgdG8gYmUgcmUtZW1pdHRlZC5cbiAgICovXG4gIEVtaXRTa2lwU291cmNlRmlsZSxcblxuICAvKipcbiAgICogQSBgdHMuU291cmNlRmlsZWAgd2FzIGVtaXR0ZWQuXG4gICAqL1xuICBFbWl0U291cmNlRmlsZSxcblxuICAvKipcbiAgICogVHJhY2tzIHRoZSBudW1iZXIgb2YgYFByZWZFdmVudGBzLCBhbmQgbXVzdCBhcHBlYXIgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdC5cbiAgICovXG4gIExBU1QsXG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNoZWNrcG9pbnQgZHVyaW5nIGNvbXBpbGF0aW9uIGF0IHdoaWNoIHRoZSBtZW1vcnkgdXNhZ2Ugb2YgdGhlIGNvbXBpbGVyIHNob3VsZCBiZVxuICogcmVjb3JkZWQuXG4gKi9cbmV4cG9ydCBlbnVtIFBlcmZDaGVja3BvaW50IHtcbiAgLyoqXG4gICAqIFRoZSBwb2ludCBhdCB3aGljaCB0aGUgYFBlcmZSZWNvcmRlcmAgd2FzIGNyZWF0ZWQsIGFuZCBpZGVhbGx5IHRyYWNrcyBtZW1vcnkgdXNlZCBiZWZvcmUgYW55XG4gICAqIGNvbXBpbGF0aW9uIHN0cnVjdHVyZXMgYXJlIGNyZWF0ZWQuXG4gICAqL1xuICBJbml0aWFsLFxuXG4gIC8qKlxuICAgKiBUaGUgcG9pbnQganVzdCBhZnRlciB0aGUgYHRzLlByb2dyYW1gIGhhcyBiZWVuIGNyZWF0ZWQuXG4gICAqL1xuICBUeXBlU2NyaXB0UHJvZ3JhbUNyZWF0ZSxcblxuICAvKipcbiAgICogVGhlIHBvaW50IGp1c3QgYmVmb3JlIEFuZ3VsYXIgYW5hbHlzaXMgc3RhcnRzLlxuICAgKlxuICAgKiBJbiB0aGUgbWFpbiB1c2FnZSBwYXR0ZXJuIGZvciB0aGUgY29tcGlsZXIsIFR5cGVTY3JpcHQgZGlhZ25vc3RpY3MgaGF2ZSBiZWVuIGNhbGN1bGF0ZWQgYXQgdGhpc1xuICAgKiBwb2ludCwgc28gdGhlIGB0cy5UeXBlQ2hlY2tlcmAgaGFzIGZ1bGx5IGluZ2VzdGVkIHRoZSBjdXJyZW50IHByb2dyYW0sIGFsbCBgdHMuVHlwZWAgc3RydWN0dXJlc1xuICAgKiBhbmQgYHRzLlN5bWJvbGBzIGhhdmUgYmVlbiBjcmVhdGVkLlxuICAgKi9cbiAgUHJlQW5hbHlzaXMsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludCBqdXN0IGFmdGVyIEFuZ3VsYXIgYW5hbHlzaXMgY29tcGxldGVzLlxuICAgKi9cbiAgQW5hbHlzaXMsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludCBqdXN0IGFmdGVyIEFuZ3VsYXIgcmVzb2x1dGlvbiBpcyBjb21wbGV0ZS5cbiAgICovXG4gIFJlc29sdmUsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludCBqdXN0IGFmdGVyIFR5cGUgQ2hlY2sgQmxvY2tzIChUQ0JzKSBoYXZlIGJlZW4gZ2VuZXJhdGVkLlxuICAgKi9cbiAgVHRjR2VuZXJhdGlvbixcblxuICAvKipcbiAgICogVGhlIHBvaW50IGp1c3QgYWZ0ZXIgdGhlIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgcHJvZ3JhbSBoYXMgYmVlbiB1cGRhdGVkIHdpdGggYW55IG5ldyBUQ0JzLlxuICAgKi9cbiAgVHRjVXBkYXRlUHJvZ3JhbSxcblxuICAvKipcbiAgICogVGhlIHBvaW50IGp1c3QgYmVmb3JlIGVtaXQgYmVnaW5zLlxuICAgKlxuICAgKiBJbiB0aGUgbWFpbiB1c2FnZSBwYXR0ZXJuIGZvciB0aGUgY29tcGlsZXIsIGFsbCB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIGRpYWdub3N0aWNzIGhhdmUgYmVlblxuICAgKiByZXF1ZXN0ZWQgYXQgdGhpcyBwb2ludC5cbiAgICovXG4gIFByZUVtaXQsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludCBqdXN0IGFmdGVyIHRoZSBwcm9ncmFtIGhhcyBiZWVuIGZ1bGx5IGVtaXR0ZWQuXG4gICAqL1xuICBFbWl0LFxuXG4gIC8qKlxuICAgKiBUcmFja3MgdGhlIG51bWJlciBvZiBgUGVyZkNoZWNrcG9pbnRgcywgYW5kIG11c3QgYXBwZWFyIGF0IHRoZSBlbmQgb2YgdGhlIGxpc3QuXG4gICAqL1xuICBMQVNULFxufVxuXG4vKipcbiAqIFJlY29yZHMgdGltaW5nLCBtZW1vcnksIG9yIGNvdW50cyBhdCBzcGVjaWZpYyBwb2ludHMgaW4gdGhlIGNvbXBpbGVyJ3Mgb3BlcmF0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBlcmZSZWNvcmRlciB7XG4gIC8qKlxuICAgKiBTZXQgdGhlIGN1cnJlbnQgcGhhc2Ugb2YgY29tcGlsYXRpb24uXG4gICAqXG4gICAqIFRpbWUgc3BlbnQgaW4gdGhlIHByZXZpb3VzIHBoYXNlIHdpbGwgYmUgYWNjb3VudGVkIHRvIHRoYXQgcGhhc2UuIFRoZSBjYWxsZXIgaXMgcmVzcG9uc2libGUgZm9yXG4gICAqIGV4aXRpbmcgdGhlIHBoYXNlIHdoZW4gd29yayB0aGF0IHNob3VsZCBiZSB0cmFja2VkIHdpdGhpbiBpdCBpcyBjb21wbGV0ZWQsIGFuZCBlaXRoZXIgcmV0dXJuaW5nXG4gICAqIHRvIHRoZSBwcmV2aW91cyBwaGFzZSBvciB0cmFuc2l0aW9uaW5nIHRvIHRoZSBuZXh0IG9uZSBkaXJlY3RseS5cbiAgICpcbiAgICogSW4gZ2VuZXJhbCwgcHJlZmVyIHVzaW5nIGBpblBoYXNlKClgIHRvIGluc3RydW1lbnQgYSBzZWN0aW9uIG9mIGNvZGUsIGFzIGl0IGF1dG9tYXRpY2FsbHlcbiAgICogaGFuZGxlcyBlbnRlcmluZyBhbmQgZXhpdGluZyB0aGUgcGhhc2UuIGBwaGFzZSgpYCBzaG91bGQgb25seSBiZSB1c2VkIHdoZW4gdGhlIGZvcm1lciBBUElcbiAgICogY2Fubm90IGJlIGNsZWFubHkgYXBwbGllZCB0byBhIHBhcnRpY3VsYXIgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgcHJldmlvdXMgcGhhc2VcbiAgICovXG4gIHBoYXNlKHBoYXNlOiBQZXJmUGhhc2UpOiBQZXJmUGhhc2U7XG5cbiAgLyoqXG4gICAqIFJ1biBgZm5gIGluIHRoZSBnaXZlbiBgUGVyZlBoYXNlYCBhbmQgcmV0dXJuIHRoZSByZXN1bHQuXG4gICAqXG4gICAqIEVudGVycyBgcGhhc2VgIGJlZm9yZSBleGVjdXRpbmcgdGhlIGdpdmVuIGBmbmAsIHRoZW4gZXhpdHMgdGhlIHBoYXNlIGFuZCByZXR1cm5zIHRoZSByZXN1bHQuXG4gICAqIFByZWZlciB0aGlzIEFQSSB0byBgcGhhc2UoKWAgd2hlcmUgcG9zc2libGUuXG4gICAqL1xuICBpblBoYXNlPFQ+KHBoYXNlOiBQZXJmUGhhc2UsIGZuOiAoKSA9PiBUKTogVDtcblxuICAvKipcbiAgICogUmVjb3JkIHRoZSBtZW1vcnkgdXNhZ2Ugb2YgdGhlIGNvbXBpbGVyIGF0IHRoZSBnaXZlbiBjaGVja3BvaW50LlxuICAgKi9cbiAgbWVtb3J5KGFmdGVyOiBQZXJmQ2hlY2twb2ludCk6IHZvaWQ7XG5cbiAgLyoqXG4gICAqIFJlY29yZCB0aGF0IGEgc3BlY2lmaWMgZXZlbnQgaGFzIG9jY3VycmVkLCBwb3NzaWJseSBtb3JlIHRoYW4gb25jZS5cbiAgICovXG4gIGV2ZW50Q291bnQoZXZlbnQ6IFBlcmZFdmVudCwgaW5jcmVtZW50Qnk/OiBudW1iZXIpOiB2b2lkO1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGBQZXJmUmVjb3JkZXJgIHRvIGFuIGVtcHR5IHN0YXRlIChjbGVhciBhbGwgdHJhY2tlZCBzdGF0aXN0aWNzKSBhbmQgcmVzZXQgdGhlIHplcm9cbiAgICogcG9pbnQgdG8gdGhlIGN1cnJlbnQgdGltZS5cbiAgICovXG4gIHJlc2V0KCk6IHZvaWQ7XG59XG4iXX0=