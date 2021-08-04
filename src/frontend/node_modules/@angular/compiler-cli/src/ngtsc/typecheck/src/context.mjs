/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ErrorCode, ngErrorCode } from '@angular/compiler-cli/src/ngtsc/diagnostics';
import * as ts from 'typescript';
import { absoluteFromSourceFile } from '../../file_system';
import { NoopImportRewriter } from '../../imports';
import { PerfEvent } from '../../perf';
import { ImportManager } from '../../translator';
import { makeTemplateDiagnostic } from '../diagnostics';
import { RegistryDomSchemaChecker } from './dom';
import { Environment } from './environment';
import { OutOfBandDiagnosticRecorderImpl } from './oob';
import { TypeCheckShimGenerator } from './shim';
import { requiresInlineTypeCheckBlock, TcbInliningRequirement } from './tcb_util';
import { generateTypeCheckBlock, TcbGenericContextBehavior } from './type_check_block';
import { TypeCheckFile } from './type_check_file';
import { generateInlineTypeCtor, requiresInlineTypeCtor } from './type_constructor';
/**
 * How a type-checking context should handle operations which would require inlining.
 */
export var InliningMode;
(function (InliningMode) {
    /**
     * Use inlining operations when required.
     */
    InliningMode[InliningMode["InlineOps"] = 0] = "InlineOps";
    /**
     * Produce diagnostics if an operation would require inlining.
     */
    InliningMode[InliningMode["Error"] = 1] = "Error";
})(InliningMode || (InliningMode = {}));
/**
 * A template type checking context for a program.
 *
 * The `TypeCheckContext` allows registration of components and their templates which need to be
 * type checked.
 */
export class TypeCheckContextImpl {
    constructor(config, compilerHost, refEmitter, reflector, host, inlining, perf) {
        this.config = config;
        this.compilerHost = compilerHost;
        this.refEmitter = refEmitter;
        this.reflector = reflector;
        this.host = host;
        this.inlining = inlining;
        this.perf = perf;
        this.fileMap = new Map();
        /**
         * A `Map` of `ts.SourceFile`s that the context has seen to the operations (additions of methods
         * or type-check blocks) that need to be eventually performed on that file.
         */
        this.opMap = new Map();
        /**
         * Tracks when an a particular class has a pending type constructor patching operation already
         * queued.
         */
        this.typeCtorPending = new Set();
        if (inlining === InliningMode.Error && config.useInlineTypeConstructors) {
            // We cannot use inlining for type checking since this environment does not support it.
            throw new Error(`AssertionError: invalid inlining configuration.`);
        }
    }
    /**
     * Register a template to potentially be type-checked.
     *
     * Implements `TypeCheckContext.addTemplate`.
     */
    addTemplate(ref, binder, template, pipes, schemas, sourceMapping, file, parseErrors) {
        if (!this.host.shouldCheckComponent(ref.node)) {
            return;
        }
        const fileData = this.dataForFile(ref.node.getSourceFile());
        const shimData = this.pendingShimForComponent(ref.node);
        const templateId = fileData.sourceManager.getTemplateId(ref.node);
        const templateDiagnostics = [];
        if (parseErrors !== null) {
            templateDiagnostics.push(...this.getTemplateDiagnostics(parseErrors, templateId, sourceMapping));
        }
        const boundTarget = binder.bind({ template });
        if (this.inlining === InliningMode.InlineOps) {
            // Get all of the directives used in the template and record inline type constructors when
            // required.
            for (const dir of boundTarget.getUsedDirectives()) {
                const dirRef = dir.ref;
                const dirNode = dirRef.node;
                if (!dir.isGeneric || !requiresInlineTypeCtor(dirNode, this.reflector)) {
                    // inlining not required
                    continue;
                }
                // Add an inline type constructor operation for the directive.
                this.addInlineTypeCtor(fileData, dirNode.getSourceFile(), dirRef, {
                    fnName: 'ngTypeCtor',
                    // The constructor should have a body if the directive comes from a .ts file, but not if
                    // it comes from a .d.ts file. .d.ts declarations don't have bodies.
                    body: !dirNode.getSourceFile().isDeclarationFile,
                    fields: {
                        inputs: dir.inputs.classPropertyNames,
                        outputs: dir.outputs.classPropertyNames,
                        // TODO(alxhub): support queries
                        queries: dir.queries,
                    },
                    coercedInputFields: dir.coercedInputFields,
                });
            }
        }
        shimData.templates.set(templateId, {
            template,
            boundTarget,
            templateDiagnostics,
        });
        const inliningRequirement = requiresInlineTypeCheckBlock(ref.node, pipes, this.reflector);
        // If inlining is not supported, but is required for either the TCB or one of its directive
        // dependencies, then exit here with an error.
        if (this.inlining === InliningMode.Error &&
            inliningRequirement === TcbInliningRequirement.MustInline) {
            // This template cannot be supported because the underlying strategy does not support inlining
            // and inlining would be required.
            // Record diagnostics to indicate the issues with this template.
            shimData.oobRecorder.requiresInlineTcb(templateId, ref.node);
            // Checking this template would be unsupported, so don't try.
            this.perf.eventCount(PerfEvent.SkipGenerateTcbNoInline);
            return;
        }
        const meta = {
            id: fileData.sourceManager.captureSource(ref.node, sourceMapping, file),
            boundTarget,
            pipes,
            schemas,
        };
        this.perf.eventCount(PerfEvent.GenerateTcb);
        if (inliningRequirement !== TcbInliningRequirement.None &&
            this.inlining === InliningMode.InlineOps) {
            // This class didn't meet the requirements for external type checking, so generate an inline
            // TCB for the class.
            this.addInlineTypeCheckBlock(fileData, shimData, ref, meta);
        }
        else if (inliningRequirement === TcbInliningRequirement.ShouldInlineForGenericBounds &&
            this.inlining === InliningMode.Error) {
            // It's suggested that this TCB should be generated inline due to the component's generic
            // bounds, but inlining is not supported by the current environment. Use a non-inline type
            // check block, but fall back to `any` generic parameters since the generic bounds can't be
            // referenced in that context. This will infer a less useful type for the component, but allow
            // for type-checking it in an environment where that would not be possible otherwise.
            shimData.file.addTypeCheckBlock(ref, meta, shimData.domSchemaChecker, shimData.oobRecorder, TcbGenericContextBehavior.FallbackToAny);
        }
        else {
            shimData.file.addTypeCheckBlock(ref, meta, shimData.domSchemaChecker, shimData.oobRecorder, TcbGenericContextBehavior.UseEmitter);
        }
    }
    /**
     * Record a type constructor for the given `node` with the given `ctorMetadata`.
     */
    addInlineTypeCtor(fileData, sf, ref, ctorMeta) {
        if (this.typeCtorPending.has(ref.node)) {
            return;
        }
        this.typeCtorPending.add(ref.node);
        // Lazily construct the operation map.
        if (!this.opMap.has(sf)) {
            this.opMap.set(sf, []);
        }
        const ops = this.opMap.get(sf);
        // Push a `TypeCtorOp` into the operation queue for the source file.
        ops.push(new TypeCtorOp(ref, ctorMeta));
        fileData.hasInlines = true;
    }
    /**
     * Transform a `ts.SourceFile` into a version that includes type checking code.
     *
     * If this particular `ts.SourceFile` requires changes, the text representing its new contents
     * will be returned. Otherwise, a `null` return indicates no changes were necessary.
     */
    transform(sf) {
        // If there are no operations pending for this particular file, return `null` to indicate no
        // changes.
        if (!this.opMap.has(sf)) {
            return null;
        }
        // Imports may need to be added to the file to support type-checking of directives used in the
        // template within it.
        const importManager = new ImportManager(new NoopImportRewriter(), '_i');
        // Each Op has a splitPoint index into the text where it needs to be inserted. Split the
        // original source text into chunks at these split points, where code will be inserted between
        // the chunks.
        const ops = this.opMap.get(sf).sort(orderOps);
        const textParts = splitStringAtPoints(sf.text, ops.map(op => op.splitPoint));
        // Use a `ts.Printer` to generate source code.
        const printer = ts.createPrinter({ omitTrailingSemicolon: true });
        // Begin with the intial section of the code text.
        let code = textParts[0];
        // Process each operation and use the printer to generate source code for it, inserting it into
        // the source code in between the original chunks.
        ops.forEach((op, idx) => {
            const text = op.execute(importManager, sf, this.refEmitter, printer);
            code += '\n\n' + text + textParts[idx + 1];
        });
        // Write out the imports that need to be added to the beginning of the file.
        let imports = importManager.getAllImports(sf.fileName)
            .map(i => `import * as ${i.qualifier.text} from '${i.specifier}';`)
            .join('\n');
        code = imports + '\n' + code;
        return code;
    }
    finalize() {
        // First, build the map of updates to source files.
        const updates = new Map();
        for (const originalSf of this.opMap.keys()) {
            const newText = this.transform(originalSf);
            if (newText !== null) {
                updates.set(absoluteFromSourceFile(originalSf), newText);
            }
        }
        // Then go through each input file that has pending code generation operations.
        for (const [sfPath, pendingFileData] of this.fileMap) {
            // For each input file, consider generation operations for each of its shims.
            for (const pendingShimData of pendingFileData.shimData.values()) {
                this.host.recordShimData(sfPath, {
                    genesisDiagnostics: [
                        ...pendingShimData.domSchemaChecker.diagnostics,
                        ...pendingShimData.oobRecorder.diagnostics,
                    ],
                    hasInlines: pendingFileData.hasInlines,
                    path: pendingShimData.file.fileName,
                    templates: pendingShimData.templates,
                });
                updates.set(pendingShimData.file.fileName, pendingShimData.file.render(false /* removeComments */));
            }
        }
        return updates;
    }
    addInlineTypeCheckBlock(fileData, shimData, ref, tcbMeta) {
        const sf = ref.node.getSourceFile();
        if (!this.opMap.has(sf)) {
            this.opMap.set(sf, []);
        }
        const ops = this.opMap.get(sf);
        ops.push(new InlineTcbOp(ref, tcbMeta, this.config, this.reflector, shimData.domSchemaChecker, shimData.oobRecorder));
        fileData.hasInlines = true;
    }
    pendingShimForComponent(node) {
        const fileData = this.dataForFile(node.getSourceFile());
        const shimPath = TypeCheckShimGenerator.shimFor(absoluteFromSourceFile(node.getSourceFile()));
        if (!fileData.shimData.has(shimPath)) {
            fileData.shimData.set(shimPath, {
                domSchemaChecker: new RegistryDomSchemaChecker(fileData.sourceManager),
                oobRecorder: new OutOfBandDiagnosticRecorderImpl(fileData.sourceManager),
                file: new TypeCheckFile(shimPath, this.config, this.refEmitter, this.reflector, this.compilerHost),
                templates: new Map(),
            });
        }
        return fileData.shimData.get(shimPath);
    }
    dataForFile(sf) {
        const sfPath = absoluteFromSourceFile(sf);
        if (!this.fileMap.has(sfPath)) {
            const data = {
                hasInlines: false,
                sourceManager: this.host.getSourceManager(sfPath),
                shimData: new Map(),
            };
            this.fileMap.set(sfPath, data);
        }
        return this.fileMap.get(sfPath);
    }
    getTemplateDiagnostics(parseErrors, templateId, sourceMapping) {
        return parseErrors.map(error => {
            const span = error.span;
            if (span.start.offset === span.end.offset) {
                // Template errors can contain zero-length spans, if the error occurs at a single point.
                // However, TypeScript does not handle displaying a zero-length diagnostic very well, so
                // increase the ending offset by 1 for such errors, to ensure the position is shown in the
                // diagnostic.
                span.end.offset++;
            }
            return makeTemplateDiagnostic(templateId, sourceMapping, span, ts.DiagnosticCategory.Error, ngErrorCode(ErrorCode.TEMPLATE_PARSE_ERROR), error.msg);
        });
    }
}
/**
 * A type check block operation which produces inline type check code for a particular component.
 */
class InlineTcbOp {
    constructor(ref, meta, config, reflector, domSchemaChecker, oobRecorder) {
        this.ref = ref;
        this.meta = meta;
        this.config = config;
        this.reflector = reflector;
        this.domSchemaChecker = domSchemaChecker;
        this.oobRecorder = oobRecorder;
    }
    /**
     * Type check blocks are inserted immediately after the end of the component class.
     */
    get splitPoint() {
        return this.ref.node.end + 1;
    }
    execute(im, sf, refEmitter, printer) {
        const env = new Environment(this.config, im, refEmitter, this.reflector, sf);
        const fnName = ts.createIdentifier(`_tcb_${this.ref.node.pos}`);
        // Inline TCBs should copy any generic type parameter nodes directly, as the TCB code is inlined
        // into the class in a context where that will always be legal.
        const fn = generateTypeCheckBlock(env, this.ref, fnName, this.meta, this.domSchemaChecker, this.oobRecorder, TcbGenericContextBehavior.CopyClassNodes);
        return printer.printNode(ts.EmitHint.Unspecified, fn, sf);
    }
}
/**
 * A type constructor operation which produces type constructor code for a particular directive.
 */
class TypeCtorOp {
    constructor(ref, meta) {
        this.ref = ref;
        this.meta = meta;
    }
    /**
     * Type constructor operations are inserted immediately before the end of the directive class.
     */
    get splitPoint() {
        return this.ref.node.end - 1;
    }
    execute(im, sf, refEmitter, printer) {
        const tcb = generateInlineTypeCtor(this.ref.node, this.meta);
        return printer.printNode(ts.EmitHint.Unspecified, tcb, sf);
    }
}
/**
 * Compare two operations and return their split point ordering.
 */
function orderOps(op1, op2) {
    return op1.splitPoint - op2.splitPoint;
}
/**
 * Split a string into chunks at any number of split points.
 */
function splitStringAtPoints(str, points) {
    const splits = [];
    let start = 0;
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        splits.push(str.substring(start, point));
        start = point;
    }
    splits.push(str.substring(start));
    return splits;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxTQUFTLEVBQUUsV0FBVyxFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLHNCQUFzQixFQUFpQixNQUFNLG1CQUFtQixDQUFDO0FBQ3pFLE9BQU8sRUFBQyxrQkFBa0IsRUFBOEIsTUFBTSxlQUFlLENBQUM7QUFDOUUsT0FBTyxFQUFDLFNBQVMsRUFBZSxNQUFNLFlBQVksQ0FBQztBQUVuRCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFL0MsT0FBTyxFQUFDLHNCQUFzQixFQUFxQixNQUFNLGdCQUFnQixDQUFDO0FBRTFFLE9BQU8sRUFBbUIsd0JBQXdCLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDakUsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEVBQThCLCtCQUErQixFQUFDLE1BQU0sT0FBTyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUU5QyxPQUFPLEVBQUMsNEJBQTRCLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDaEYsT0FBTyxFQUFDLHNCQUFzQixFQUFFLHlCQUF5QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDckYsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ2hELE9BQU8sRUFBQyxzQkFBc0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBOEhsRjs7R0FFRztBQUNILE1BQU0s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LENBQUMsQ0FBQztRQUN6QyxLQUFLLEdBQUcsS0FBSyxDQUFDO0tBQ2Y7SUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNsQyxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Qm91bmRUYXJnZXQsIFBhcnNlRXJyb3IsIFBhcnNlU291cmNlRmlsZSwgUjNUYXJnZXRCaW5kZXIsIFNjaGVtYU1ldGFkYXRhLCBUZW1wbGF0ZVBhcnNlRXJyb3IsIFRtcGxBc3ROb2RlfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQge0Vycm9yQ29kZSwgbmdFcnJvckNvZGV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvZGlhZ25vc3RpY3MnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7YWJzb2x1dGVGcm9tU291cmNlRmlsZSwgQWJzb2x1dGVGc1BhdGh9IGZyb20gJy4uLy4uL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7Tm9vcEltcG9ydFJld3JpdGVyLCBSZWZlcmVuY2UsIFJlZmVyZW5jZUVtaXR0ZXJ9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtQZXJmRXZlbnQsIFBlcmZSZWNvcmRlcn0gZnJvbSAnLi4vLi4vcGVyZic7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIFJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7SW1wb3J0TWFuYWdlcn0gZnJvbSAnLi4vLi4vdHJhbnNsYXRvcic7XG5pbXBvcnQge1RlbXBsYXRlSWQsIFRlbXBsYXRlU291cmNlTWFwcGluZywgVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEsIFR5cGVDaGVja0Jsb2NrTWV0YWRhdGEsIFR5cGVDaGVja0NvbnRleHQsIFR5cGVDaGVja2luZ0NvbmZpZywgVHlwZUN0b3JNZXRhZGF0YX0gZnJvbSAnLi4vYXBpJztcbmltcG9ydCB7bWFrZVRlbXBsYXRlRGlhZ25vc3RpYywgVGVtcGxhdGVEaWFnbm9zdGljfSBmcm9tICcuLi9kaWFnbm9zdGljcyc7XG5cbmltcG9ydCB7RG9tU2NoZW1hQ2hlY2tlciwgUmVnaXN0cnlEb21TY2hlbWFDaGVja2VyfSBmcm9tICcuL2RvbSc7XG5pbXBvcnQge0Vudmlyb25tZW50fSBmcm9tICcuL2Vudmlyb25tZW50JztcbmltcG9ydCB7T3V0T2ZCYW5kRGlhZ25vc3RpY1JlY29yZGVyLCBPdXRPZkJhbmREaWFnbm9zdGljUmVjb3JkZXJJbXBsfSBmcm9tICcuL29vYic7XG5pbXBvcnQge1R5cGVDaGVja1NoaW1HZW5lcmF0b3J9IGZyb20gJy4vc2hpbSc7XG5pbXBvcnQge1RlbXBsYXRlU291cmNlTWFuYWdlcn0gZnJvbSAnLi9zb3VyY2UnO1xuaW1wb3J0IHtyZXF1aXJlc0lubGluZVR5cGVDaGVja0Jsb2NrLCBUY2JJbmxpbmluZ1JlcXVpcmVtZW50fSBmcm9tICcuL3RjYl91dGlsJztcbmltcG9ydCB7Z2VuZXJhdGVUeXBlQ2hlY2tCbG9jaywgVGNiR2VuZXJpY0NvbnRleHRCZWhhdmlvcn0gZnJvbSAnLi90eXBlX2NoZWNrX2Jsb2NrJztcbmltcG9ydCB7VHlwZUNoZWNrRmlsZX0gZnJvbSAnLi90eXBlX2NoZWNrX2ZpbGUnO1xuaW1wb3J0IHtnZW5lcmF0ZUlubGluZVR5cGVDdG9yLCByZXF1aXJlc0lubGluZVR5cGVDdG9yfSBmcm9tICcuL3R5cGVfY29uc3RydWN0b3InO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNoaW1UeXBlQ2hlY2tpbmdEYXRhIHtcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIHNoaW0gZmlsZS5cbiAgICovXG4gIHBhdGg6IEFic29sdXRlRnNQYXRoO1xuXG4gIC8qKlxuICAgKiBBbnkgYHRzLkRpYWdub3N0aWNgcyB3aGljaCB3ZXJlIHByb2R1Y2VkIGR1cmluZyB0aGUgZ2VuZXJhdGlvbiBvZiB0aGlzIHNoaW0uXG4gICAqXG4gICAqIFNvbWUgZGlhZ25vc3RpY3MgYXJlIHByb2R1Y2VkIGR1cmluZyBjcmVhdGlvbiB0aW1lIGFuZCBhcmUgdHJhY2tlZCBoZXJlLlxuICAgKi9cbiAgZ2VuZXNpc0RpYWdub3N0aWNzOiBUZW1wbGF0ZURpYWdub3N0aWNbXTtcblxuICAvKipcbiAgICogV2hldGhlciBhbnkgaW5saW5lIG9wZXJhdGlvbnMgZm9yIHRoZSBpbnB1dCBmaWxlIHdlcmUgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgdGhpcyBzaGltLlxuICAgKi9cbiAgaGFzSW5saW5lczogYm9vbGVhbjtcblxuICAvKipcbiAgICogTWFwIG9mIGBUZW1wbGF0ZUlkYCB0byBpbmZvcm1hdGlvbiBjb2xsZWN0ZWQgYWJvdXQgdGhlIHRlbXBsYXRlIGR1cmluZyB0aGUgdGVtcGxhdGVcbiAgICogdHlwZS1jaGVja2luZyBwcm9jZXNzLlxuICAgKi9cbiAgdGVtcGxhdGVzOiBNYXA8VGVtcGxhdGVJZCwgVGVtcGxhdGVEYXRhPjtcbn1cblxuLyoqXG4gKiBEYXRhIHRyYWNrZWQgZm9yIGVhY2ggdGVtcGxhdGUgcHJvY2Vzc2VkIGJ5IHRoZSB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIHN5c3RlbS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZURhdGEge1xuICAvKipcbiAgICogVGVtcGxhdGUgbm9kZXMgZm9yIHdoaWNoIHRoZSBUQ0Igd2FzIGdlbmVyYXRlZC5cbiAgICovXG4gIHRlbXBsYXRlOiBUbXBsQXN0Tm9kZVtdO1xuXG4gIC8qKlxuICAgKiBgQm91bmRUYXJnZXRgIHdoaWNoIHdhcyB1c2VkIHRvIGdlbmVyYXRlIHRoZSBUQ0IsIGFuZCBjb250YWlucyBiaW5kaW5ncyBmb3IgdGhlIGFzc29jaWF0ZWRcbiAgICogdGVtcGxhdGUgbm9kZXMuXG4gICAqL1xuICBib3VuZFRhcmdldDogQm91bmRUYXJnZXQ8VHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGE+O1xuXG4gIC8qKlxuICAgKiBFcnJvcnMgZm91bmQgd2hpbGUgcGFyc2luZyB0aGVtIHRlbXBsYXRlLCB3aGljaCBoYXZlIGJlZW4gY29udmVydGVkIHRvIGRpYWdub3N0aWNzLlxuICAgKi9cbiAgdGVtcGxhdGVEaWFnbm9zdGljczogVGVtcGxhdGVEaWFnbm9zdGljW107XG59XG5cbi8qKlxuICogRGF0YSBmb3IgYW4gaW5wdXQgZmlsZSB3aGljaCBpcyBzdGlsbCBpbiB0aGUgcHJvY2VzcyBvZiB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIGNvZGUgZ2VuZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQZW5kaW5nRmlsZVR5cGVDaGVja2luZ0RhdGEge1xuICAvKipcbiAgICogV2hldGhlciBhbnkgaW5saW5lIGNvZGUgaGFzIGJlZW4gcmVxdWlyZWQgYnkgdGhlIHNoaW0geWV0LlxuICAgKi9cbiAgaGFzSW5saW5lczogYm9vbGVhbjtcblxuICAvKipcbiAgICogU291cmNlIG1hcHBpbmcgaW5mb3JtYXRpb24gZm9yIG1hcHBpbmcgZGlhZ25vc3RpY3MgZnJvbSBpbmxpbmVkIHR5cGUgY2hlY2sgYmxvY2tzIGJhY2sgdG8gdGhlXG4gICAqIG9yaWdpbmFsIHRlbXBsYXRlLlxuICAgKi9cbiAgc291cmNlTWFuYWdlcjogVGVtcGxhdGVTb3VyY2VNYW5hZ2VyO1xuXG4gIC8qKlxuICAgKiBNYXAgb2YgaW4tcHJvZ3Jlc3Mgc2hpbSBkYXRhIGZvciBzaGltcyBnZW5lcmF0ZWQgZnJvbSB0aGlzIGlucHV0IGZpbGUuXG4gICAqL1xuICBzaGltRGF0YTogTWFwPEFic29sdXRlRnNQYXRoLCBQZW5kaW5nU2hpbURhdGE+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBlbmRpbmdTaGltRGF0YSB7XG4gIC8qKlxuICAgKiBSZWNvcmRlciBmb3Igb3V0LW9mLWJhbmQgZGlhZ25vc3RpY3Mgd2hpY2ggYXJlIHJhaXNlZCBkdXJpbmcgZ2VuZXJhdGlvbi5cbiAgICovXG4gIG9vYlJlY29yZGVyOiBPdXRPZkJhbmREaWFnbm9zdGljUmVjb3JkZXI7XG5cbiAgLyoqXG4gICAqIFRoZSBgRG9tU2NoZW1hQ2hlY2tlcmAgaW4gdXNlIGZvciB0aGlzIHRlbXBsYXRlLCB3aGljaCByZWNvcmRzIGFueSBzY2hlbWEtcmVsYXRlZCBkaWFnbm9zdGljcy5cbiAgICovXG4gIGRvbVNjaGVtYUNoZWNrZXI6IERvbVNjaGVtYUNoZWNrZXI7XG5cbiAgLyoqXG4gICAqIFNoaW0gZmlsZSBpbiB0aGUgcHJvY2VzcyBvZiBiZWluZyBnZW5lcmF0ZWQuXG4gICAqL1xuICBmaWxlOiBUeXBlQ2hlY2tGaWxlO1xuXG5cbiAgLyoqXG4gICAqIE1hcCBvZiBgVGVtcGxhdGVJZGAgdG8gaW5mb3JtYXRpb24gY29sbGVjdGVkIGFib3V0IHRoZSB0ZW1wbGF0ZSBhcyBpdCdzIGluZ2VzdGVkLlxuICAgKi9cbiAgdGVtcGxhdGVzOiBNYXA8VGVtcGxhdGVJZCwgVGVtcGxhdGVEYXRhPjtcbn1cblxuLyoqXG4gKiBBZGFwdHMgdGhlIGBUeXBlQ2hlY2tDb250ZXh0SW1wbGAgdG8gdGhlIGxhcmdlciB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIHN5c3RlbS5cbiAqXG4gKiBUaHJvdWdoIHRoaXMgaW50ZXJmYWNlLCBhIHNpbmdsZSBgVHlwZUNoZWNrQ29udGV4dEltcGxgICh3aGljaCByZXByZXNlbnRzIG9uZSBcInBhc3NcIiBvZiB0ZW1wbGF0ZVxuICogdHlwZS1jaGVja2luZykgcmVxdWVzdHMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGxhcmdlciBzdGF0ZSBvZiB0eXBlLWNoZWNraW5nLCBhcyB3ZWxsIGFzIHJlcG9ydHNcbiAqIGJhY2sgaXRzIHJlc3VsdHMgb25jZSBmaW5hbGl6ZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZUNoZWNraW5nSG9zdCB7XG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgYFRlbXBsYXRlU291cmNlTWFuYWdlcmAgcmVzcG9uc2libGUgZm9yIGNvbXBvbmVudHMgaW4gdGhlIGdpdmVuIGlucHV0IGZpbGUgcGF0aC5cbiAgICovXG4gIGdldFNvdXJjZU1hbmFnZXIoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IFRlbXBsYXRlU291cmNlTWFuYWdlcjtcblxuICAvKipcbiAgICogV2hldGhlciBhIHBhcnRpY3VsYXIgY29tcG9uZW50IGNsYXNzIHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGUgY3VycmVudCB0eXBlLWNoZWNraW5nIHBhc3MuXG4gICAqXG4gICAqIE5vdCBhbGwgY29tcG9uZW50cyBvZmZlcmVkIHRvIHRoZSBgVHlwZUNoZWNrQ29udGV4dGAgZm9yIGNoZWNraW5nIG1heSByZXF1aXJlIHByb2Nlc3NpbmcuIEZvclxuICAgKiBleGFtcGxlLCB0aGUgY29tcG9uZW50IG1heSBoYXZlIHJlc3VsdHMgYWxyZWFkeSBhdmFpbGFibGUgZnJvbSBhIHByaW9yIHBhc3Mgb3IgZnJvbSBhIHByZXZpb3VzXG4gICAqIHByb2dyYW0uXG4gICAqL1xuICBzaG91bGRDaGVja0NvbXBvbmVudChub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogYm9vbGVhbjtcblxuICAvKipcbiAgICogUmVwb3J0IGRhdGEgZnJvbSBhIHNoaW0gZ2VuZXJhdGVkIGZyb20gdGhlIGdpdmVuIGlucHV0IGZpbGUgcGF0aC5cbiAgICovXG4gIHJlY29yZFNoaW1EYXRhKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgsIGRhdGE6IFNoaW1UeXBlQ2hlY2tpbmdEYXRhKTogdm9pZDtcblxuICAvKipcbiAgICogUmVjb3JkIHRoYXQgYWxsIG9mIHRoZSBjb21wb25lbnRzIHdpdGhpbiB0aGUgZ2l2ZW4gaW5wdXQgZmlsZSBwYXRoIGhhZCBjb2RlIGdlbmVyYXRlZCAtIHRoYXRcbiAgICogaXMsIGNvdmVyYWdlIGZvciB0aGUgZmlsZSBjYW4gYmUgY29uc2lkZXJlZCBjb21wbGV0ZS5cbiAgICovXG4gIHJlY29yZENvbXBsZXRlKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgpOiB2b2lkO1xufVxuXG4vKipcbiAqIEhvdyBhIHR5cGUtY2hlY2tpbmcgY29udGV4dCBzaG91bGQgaGFuZGxlIG9wZXJhdGlvbnMgd2hpY2ggd291bGQgcmVxdWlyZSBpbmxpbmluZy5cbiAqL1xuZXhwb3J0IGVudW0gSW5saW5pbmdNb2RlIHtcbiAgLyoqXG4gICAqIFVzZSBpbmxpbmluZyBvcGVyYXRpb25zIHdoZW4gcmVxdWlyZWQuXG4gICAqL1xuICBJbmxpbmVPcHMsXG5cbiAgLyoqXG4gICAqIFByb2R1Y2UgZGlhZ25vc3RpY3MgaWYgYW4gb3BlcmF0aW9uIHdvdWxkIHJlcXVpcmUgaW5saW5pbmcuXG4gICAqL1xuICBFcnJvcixcbn1cblxuLyoqXG4gKiBBIHRlbXBsYXRlIHR5cGUgY2hlY2tpbmcgY29udGV4dCBmb3IgYSBwcm9ncmFtLlxuICpcbiAqIFRoZSBgVHlwZUNoZWNrQ29udGV4dGAgYWxsb3dzIHJlZ2lzdHJhdGlvbiBvZiBjb21wb25lbnRzIGFuZCB0aGVpciB0ZW1wbGF0ZXMgd2hpY2ggbmVlZCB0byBiZVxuICogdHlwZSBjaGVja2VkLlxuICovXG5leHBvcnQgY2xhc3MgVHlwZUNoZWNrQ29udGV4dEltcGwgaW1wbGVtZW50cyBUeXBlQ2hlY2tDb250ZXh0IHtcbiAgcHJpdmF0ZSBmaWxlTWFwID0gbmV3IE1hcDxBYnNvbHV0ZUZzUGF0aCwgUGVuZGluZ0ZpbGVUeXBlQ2hlY2tpbmdEYXRhPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25maWc6IFR5cGVDaGVja2luZ0NvbmZpZyxcbiAgICAgIHByaXZhdGUgY29tcGlsZXJIb3N0OiBQaWNrPHRzLkNvbXBpbGVySG9zdCwgJ2dldENhbm9uaWNhbEZpbGVOYW1lJz4sXG4gICAgICBwcml2YXRlIHJlZkVtaXR0ZXI6IFJlZmVyZW5jZUVtaXR0ZXIsIHByaXZhdGUgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCxcbiAgICAgIHByaXZhdGUgaG9zdDogVHlwZUNoZWNraW5nSG9zdCwgcHJpdmF0ZSBpbmxpbmluZzogSW5saW5pbmdNb2RlLCBwcml2YXRlIHBlcmY6IFBlcmZSZWNvcmRlcikge1xuICAgIGlmIChpbmxpbmluZyA9PT0gSW5saW5pbmdNb2RlLkVycm9yICYmIGNvbmZpZy51c2VJbmxpbmVUeXBlQ29uc3RydWN0b3JzKSB7XG4gICAgICAvLyBXZSBjYW5ub3QgdXNlIGlubGluaW5nIGZvciB0eXBlIGNoZWNraW5nIHNpbmNlIHRoaXMgZW52aXJvbm1lbnQgZG9lcyBub3Qgc3VwcG9ydCBpdC5cbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGludmFsaWQgaW5saW5pbmcgY29uZmlndXJhdGlvbi5gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQSBgTWFwYCBvZiBgdHMuU291cmNlRmlsZWBzIHRoYXQgdGhlIGNvbnRleHQgaGFzIHNlZW4gdG8gdGhlIG9wZXJhdGlvbnMgKGFkZGl0aW9ucyBvZiBtZXRob2RzXG4gICAqIG9yIHR5cGUtY2hlY2sgYmxvY2tzKSB0aGF0IG5lZWQgdG8gYmUgZXZlbnR1YWxseSBwZXJmb3JtZWQgb24gdGhhdCBmaWxlLlxuICAgKi9cbiAgcHJpdmF0ZSBvcE1hcCA9IG5ldyBNYXA8dHMuU291cmNlRmlsZSwgT3BbXT4oKTtcblxuICAvKipcbiAgICogVHJhY2tzIHdoZW4gYW4gYSBwYXJ0aWN1bGFyIGNsYXNzIGhhcyBhIHBlbmRpbmcgdHlwZSBjb25zdHJ1Y3RvciBwYXRjaGluZyBvcGVyYXRpb24gYWxyZWFkeVxuICAgKiBxdWV1ZWQuXG4gICAqL1xuICBwcml2YXRlIHR5cGVDdG9yUGVuZGluZyA9IG5ldyBTZXQ8dHMuQ2xhc3NEZWNsYXJhdGlvbj4oKTtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSB0ZW1wbGF0ZSB0byBwb3RlbnRpYWxseSBiZSB0eXBlLWNoZWNrZWQuXG4gICAqXG4gICAqIEltcGxlbWVudHMgYFR5cGVDaGVja0NvbnRleHQuYWRkVGVtcGxhdGVgLlxuICAgKi9cbiAgYWRkVGVtcGxhdGUoXG4gICAgICByZWY6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+PixcbiAgICAgIGJpbmRlcjogUjNUYXJnZXRCaW5kZXI8VHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGE+LCB0ZW1wbGF0ZTogVG1wbEFzdE5vZGVbXSxcbiAgICAgIHBpcGVzOiBNYXA8c3RyaW5nLCBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4+LFxuICAgICAgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSwgc291cmNlTWFwcGluZzogVGVtcGxhdGVTb3VyY2VNYXBwaW5nLCBmaWxlOiBQYXJzZVNvdXJjZUZpbGUsXG4gICAgICBwYXJzZUVycm9yczogUGFyc2VFcnJvcltdfG51bGwpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaG9zdC5zaG91bGRDaGVja0NvbXBvbmVudChyZWYubm9kZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlRGF0YSA9IHRoaXMuZGF0YUZvckZpbGUocmVmLm5vZGUuZ2V0U291cmNlRmlsZSgpKTtcbiAgICBjb25zdCBzaGltRGF0YSA9IHRoaXMucGVuZGluZ1NoaW1Gb3JDb21wb25lbnQocmVmLm5vZGUpO1xuICAgIGNvbnN0IHRlbXBsYXRlSWQgPSBmaWxlRGF0YS5zb3VyY2VNYW5hZ2VyLmdldFRlbXBsYXRlSWQocmVmLm5vZGUpO1xuXG4gICAgY29uc3QgdGVtcGxhdGVEaWFnbm9zdGljczogVGVtcGxhdGVEaWFnbm9zdGljW10gPSBbXTtcblxuICAgIGlmIChwYXJzZUVycm9ycyAhPT0gbnVsbCkge1xuICAgICAgdGVtcGxhdGVEaWFnbm9zdGljcy5wdXNoKFxuICAgICAgICAgIC4uLnRoaXMuZ2V0VGVtcGxhdGVEaWFnbm9zdGljcyhwYXJzZUVycm9ycywgdGVtcGxhdGVJZCwgc291cmNlTWFwcGluZykpO1xuICAgIH1cblxuICAgIGNvbnN0IGJvdW5kVGFyZ2V0ID0gYmluZGVyLmJpbmQoe3RlbXBsYXRlfSk7XG5cbiAgICBpZiAodGhpcy5pbmxpbmluZyA9PT0gSW5saW5pbmdNb2RlLklubGluZU9wcykge1xuICAgICAgLy8gR2V0IGFsbCBvZiB0aGUgZGlyZWN0aXZlcyB1c2VkIGluIHRoZSB0ZW1wbGF0ZSBhbmQgcmVjb3JkIGlubGluZSB0eXBlIGNvbnN0cnVjdG9ycyB3aGVuXG4gICAgICAvLyByZXF1aXJlZC5cbiAgICAgIGZvciAoY29uc3QgZGlyIG9mIGJvdW5kVGFyZ2V0LmdldFVzZWREaXJlY3RpdmVzKCkpIHtcbiAgICAgICAgY29uc3QgZGlyUmVmID0gZGlyLnJlZiBhcyBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj47XG4gICAgICAgIGNvbnN0IGRpck5vZGUgPSBkaXJSZWYubm9kZTtcblxuICAgICAgICBpZiAoIWRpci5pc0dlbmVyaWMgfHwgIXJlcXVpcmVzSW5saW5lVHlwZUN0b3IoZGlyTm9kZSwgdGhpcy5yZWZsZWN0b3IpKSB7XG4gICAgICAgICAgLy8gaW5saW5pbmcgbm90IHJlcXVpcmVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYW4gaW5saW5lIHR5cGUgY29uc3RydWN0b3Igb3BlcmF0aW9uIGZvciB0aGUgZGlyZWN0aXZlLlxuICAgICAgICB0aGlzLmFkZElubGluZVR5cGVDdG9yKGZpbGVEYXRhLCBkaXJOb2RlLmdldFNvdXJjZUZpbGUoKSwgZGlyUmVmLCB7XG4gICAgICAgICAgZm5OYW1lOiAnbmdUeXBlQ3RvcicsXG4gICAgICAgICAgLy8gVGhlIGNvbnN0cnVjdG9yIHNob3VsZCBoYXZlIGEgYm9keSBpZiB0aGUgZGlyZWN0aXZlIGNvbWVzIGZyb20gYSAudHMgZmlsZSwgYnV0IG5vdCBpZlxuICAgICAgICAgIC8vIGl0IGNvbWVzIGZyb20gYSAuZC50cyBmaWxlLiAuZC50cyBkZWNsYXJhdGlvbnMgZG9uJ3QgaGF2ZSBib2RpZXMuXG4gICAgICAgICAgYm9keTogIWRpck5vZGUuZ2V0U291cmNlRmlsZSgpLmlzRGVjbGFyYXRpb25GaWxlLFxuICAgICAgICAgIGZpZWxkczoge1xuICAgICAgICAgICAgaW5wdXRzOiBkaXIuaW5wdXRzLmNsYXNzUHJvcGVydHlOYW1lcyxcbiAgICAgICAgICAgIG91dHB1dHM6IGRpci5vdXRwdXRzLmNsYXNzUHJvcGVydHlOYW1lcyxcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogc3VwcG9ydCBxdWVyaWVzXG4gICAgICAgICAgICBxdWVyaWVzOiBkaXIucXVlcmllcyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvZXJjZWRJbnB1dEZpZWxkczogZGlyLmNvZXJjZWRJbnB1dEZpZWxkcyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2hpbURhdGEudGVtcGxhdGVzLnNldCh0ZW1wbGF0ZUlkLCB7XG4gICAgICB0ZW1wbGF0ZSxcbiAgICAgIGJvdW5kVGFyZ2V0LFxuICAgICAgdGVtcGxhdGVEaWFnbm9zdGljcyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGlubGluaW5nUmVxdWlyZW1lbnQgPSByZXF1aXJlc0lubGluZVR5cGVDaGVja0Jsb2NrKHJlZi5ub2RlLCBwaXBlcywgdGhpcy5yZWZsZWN0b3IpO1xuXG4gICAgLy8gSWYgaW5saW5pbmcgaXMgbm90IHN1cHBvcnRlZCwgYnV0IGlzIHJlcXVpcmVkIGZvciBlaXRoZXIgdGhlIFRDQiBvciBvbmUgb2YgaXRzIGRpcmVjdGl2ZVxuICAgIC8vIGRlcGVuZGVuY2llcywgdGhlbiBleGl0IGhlcmUgd2l0aCBhbiBlcnJvci5cbiAgICBpZiAodGhpcy5pbmxpbmluZyA9PT0gSW5saW5pbmdNb2RlLkVycm9yICYmXG4gICAgICAgIGlubGluaW5nUmVxdWlyZW1lbnQgPT09IFRjYklubGluaW5nUmVxdWlyZW1lbnQuTXVzdElubGluZSkge1xuICAgICAgLy8gVGhpcyB0ZW1wbGF0ZSBjYW5ub3QgYmUgc3VwcG9ydGVkIGJlY2F1c2UgdGhlIHVuZGVybHlpbmcgc3RyYXRlZ3kgZG9lcyBub3Qgc3VwcG9ydCBpbmxpbmluZ1xuICAgICAgLy8gYW5kIGlubGluaW5nIHdvdWxkIGJlIHJlcXVpcmVkLlxuXG4gICAgICAvLyBSZWNvcmQgZGlhZ25vc3RpY3MgdG8gaW5kaWNhdGUgdGhlIGlzc3VlcyB3aXRoIHRoaXMgdGVtcGxhdGUuXG4gICAgICBzaGltRGF0YS5vb2JSZWNvcmRlci5yZXF1aXJlc0lubGluZVRjYih0ZW1wbGF0ZUlkLCByZWYubm9kZSk7XG5cbiAgICAgIC8vIENoZWNraW5nIHRoaXMgdGVtcGxhdGUgd291bGQgYmUgdW5zdXBwb3J0ZWQsIHNvIGRvbid0IHRyeS5cbiAgICAgIHRoaXMucGVyZi5ldmVudENvdW50KFBlcmZFdmVudC5Ta2lwR2VuZXJhdGVUY2JOb0lubGluZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YSA9IHtcbiAgICAgIGlkOiBmaWxlRGF0YS5zb3VyY2VNYW5hZ2VyLmNhcHR1cmVTb3VyY2UocmVmLm5vZGUsIHNvdXJjZU1hcHBpbmcsIGZpbGUpLFxuICAgICAgYm91bmRUYXJnZXQsXG4gICAgICBwaXBlcyxcbiAgICAgIHNjaGVtYXMsXG4gICAgfTtcbiAgICB0aGlzLnBlcmYuZXZlbnRDb3VudChQZXJmRXZlbnQuR2VuZXJhdGVUY2IpO1xuICAgIGlmIChpbmxpbmluZ1JlcXVpcmVtZW50ICE9PSBUY2JJbmxpbmluZ1JlcXVpcmVtZW50Lk5vbmUgJiZcbiAgICAgICAgdGhpcy5pbmxpbmluZyA9PT0gSW5saW5pbmdNb2RlLklubGluZU9wcykge1xuICAgICAgLy8gVGhpcyBjbGFzcyBkaWRuJ3QgbWVldCB0aGUgcmVxdWlyZW1lbnRzIGZvciBleHRlcm5hbCB0eXBlIGNoZWNraW5nLCBzbyBnZW5lcmF0ZSBhbiBpbmxpbmVcbiAgICAgIC8vIFRDQiBmb3IgdGhlIGNsYXNzLlxuICAgICAgdGhpcy5hZGRJbmxpbmVUeXBlQ2hlY2tCbG9jayhmaWxlRGF0YSwgc2hpbURhdGEsIHJlZiwgbWV0YSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgaW5saW5pbmdSZXF1aXJlbWVudCA9PT0gVGNiSW5saW5pbmdSZXF1aXJlbWVudC5TaG91bGRJbmxpbmVGb3JHZW5lcmljQm91bmRzICYmXG4gICAgICAgIHRoaXMuaW5saW5pbmcgPT09IElubGluaW5nTW9kZS5FcnJvcikge1xuICAgICAgLy8gSXQncyBzdWdnZXN0ZWQgdGhhdCB0aGlzIFRDQiBzaG91bGQgYmUgZ2VuZXJhdGVkIGlubGluZSBkdWUgdG8gdGhlIGNvbXBvbmVudCdzIGdlbmVyaWNcbiAgICAgIC8vIGJvdW5kcywgYnV0IGlubGluaW5nIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhlIGN1cnJlbnQgZW52aXJvbm1lbnQuIFVzZSBhIG5vbi1pbmxpbmUgdHlwZVxuICAgICAgLy8gY2hlY2sgYmxvY2ssIGJ1dCBmYWxsIGJhY2sgdG8gYGFueWAgZ2VuZXJpYyBwYXJhbWV0ZXJzIHNpbmNlIHRoZSBnZW5lcmljIGJvdW5kcyBjYW4ndCBiZVxuICAgICAgLy8gcmVmZXJlbmNlZCBpbiB0aGF0IGNvbnRleHQuIFRoaXMgd2lsbCBpbmZlciBhIGxlc3MgdXNlZnVsIHR5cGUgZm9yIHRoZSBjb21wb25lbnQsIGJ1dCBhbGxvd1xuICAgICAgLy8gZm9yIHR5cGUtY2hlY2tpbmcgaXQgaW4gYW4gZW52aXJvbm1lbnQgd2hlcmUgdGhhdCB3b3VsZCBub3QgYmUgcG9zc2libGUgb3RoZXJ3aXNlLlxuICAgICAgc2hpbURhdGEuZmlsZS5hZGRUeXBlQ2hlY2tCbG9jayhcbiAgICAgICAgICByZWYsIG1ldGEsIHNoaW1EYXRhLmRvbVNjaGVtYUNoZWNrZXIsIHNoaW1EYXRhLm9vYlJlY29yZGVyLFxuICAgICAgICAgIFRjYkdlbmVyaWNDb250ZXh0QmVoYXZpb3IuRmFsbGJhY2tUb0FueSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNoaW1EYXRhLmZpbGUuYWRkVHlwZUNoZWNrQmxvY2soXG4gICAgICAgICAgcmVmLCBtZXRhLCBzaGltRGF0YS5kb21TY2hlbWFDaGVja2VyLCBzaGltRGF0YS5vb2JSZWNvcmRlcixcbiAgICAgICAgICBUY2JHZW5lcmljQ29udGV4dEJlaGF2aW9yLlVzZUVtaXR0ZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmQgYSB0eXBlIGNvbnN0cnVjdG9yIGZvciB0aGUgZ2l2ZW4gYG5vZGVgIHdpdGggdGhlIGdpdmVuIGBjdG9yTWV0YWRhdGFgLlxuICAgKi9cbiAgYWRkSW5saW5lVHlwZUN0b3IoXG4gICAgICBmaWxlRGF0YTogUGVuZGluZ0ZpbGVUeXBlQ2hlY2tpbmdEYXRhLCBzZjogdHMuU291cmNlRmlsZSxcbiAgICAgIHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+LCBjdG9yTWV0YTogVHlwZUN0b3JNZXRhZGF0YSk6IHZvaWQge1xuICAgIGlmICh0aGlzLnR5cGVDdG9yUGVuZGluZy5oYXMocmVmLm5vZGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMudHlwZUN0b3JQZW5kaW5nLmFkZChyZWYubm9kZSk7XG5cbiAgICAvLyBMYXppbHkgY29uc3RydWN0IHRoZSBvcGVyYXRpb24gbWFwLlxuICAgIGlmICghdGhpcy5vcE1hcC5oYXMoc2YpKSB7XG4gICAgICB0aGlzLm9wTWFwLnNldChzZiwgW10pO1xuICAgIH1cbiAgICBjb25zdCBvcHMgPSB0aGlzLm9wTWFwLmdldChzZikhO1xuXG4gICAgLy8gUHVzaCBhIGBUeXBlQ3Rvck9wYCBpbnRvIHRoZSBvcGVyYXRpb24gcXVldWUgZm9yIHRoZSBzb3VyY2UgZmlsZS5cbiAgICBvcHMucHVzaChuZXcgVHlwZUN0b3JPcChyZWYsIGN0b3JNZXRhKSk7XG4gICAgZmlsZURhdGEuaGFzSW5saW5lcyA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogVHJhbnNmb3JtIGEgYHRzLlNvdXJjZUZpbGVgIGludG8gYSB2ZXJzaW9uIHRoYXQgaW5jbHVkZXMgdHlwZSBjaGVja2luZyBjb2RlLlxuICAgKlxuICAgKiBJZiB0aGlzIHBhcnRpY3VsYXIgYHRzLlNvdXJjZUZpbGVgIHJlcXVpcmVzIGNoYW5nZXMsIHRoZSB0ZXh0IHJlcHJlc2VudGluZyBpdHMgbmV3IGNvbnRlbnRzXG4gICAqIHdpbGwgYmUgcmV0dXJuZWQuIE90aGVyd2lzZSwgYSBgbnVsbGAgcmV0dXJuIGluZGljYXRlcyBubyBjaGFuZ2VzIHdlcmUgbmVjZXNzYXJ5LlxuICAgKi9cbiAgdHJhbnNmb3JtKHNmOiB0cy5Tb3VyY2VGaWxlKTogc3RyaW5nfG51bGwge1xuICAgIC8vIElmIHRoZXJlIGFyZSBubyBvcGVyYXRpb25zIHBlbmRpbmcgZm9yIHRoaXMgcGFydGljdWxhciBmaWxlLCByZXR1cm4gYG51bGxgIHRvIGluZGljYXRlIG5vXG4gICAgLy8gY2hhbmdlcy5cbiAgICBpZiAoIXRoaXMub3BNYXAuaGFzKHNmKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gSW1wb3J0cyBtYXkgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUgZmlsZSB0byBzdXBwb3J0IHR5cGUtY2hlY2tpbmcgb2YgZGlyZWN0aXZlcyB1c2VkIGluIHRoZVxuICAgIC8vIHRlbXBsYXRlIHdpdGhpbiBpdC5cbiAgICBjb25zdCBpbXBvcnRNYW5hZ2VyID0gbmV3IEltcG9ydE1hbmFnZXIobmV3IE5vb3BJbXBvcnRSZXdyaXRlcigpLCAnX2knKTtcblxuICAgIC8vIEVhY2ggT3AgaGFzIGEgc3BsaXRQb2ludCBpbmRleCBpbnRvIHRoZSB0ZXh0IHdoZXJlIGl0IG5lZWRzIHRvIGJlIGluc2VydGVkLiBTcGxpdCB0aGVcbiAgICAvLyBvcmlnaW5hbCBzb3VyY2UgdGV4dCBpbnRvIGNodW5rcyBhdCB0aGVzZSBzcGxpdCBwb2ludHMsIHdoZXJlIGNvZGUgd2lsbCBiZSBpbnNlcnRlZCBiZXR3ZWVuXG4gICAgLy8gdGhlIGNodW5rcy5cbiAgICBjb25zdCBvcHMgPSB0aGlzLm9wTWFwLmdldChzZikhLnNvcnQob3JkZXJPcHMpO1xuICAgIGNvbnN0IHRleHRQYXJ0cyA9IHNwbGl0U3RyaW5nQXRQb2ludHMoc2YudGV4dCwgb3BzLm1hcChvcCA9PiBvcC5zcGxpdFBvaW50KSk7XG5cbiAgICAvLyBVc2UgYSBgdHMuUHJpbnRlcmAgdG8gZ2VuZXJhdGUgc291cmNlIGNvZGUuXG4gICAgY29uc3QgcHJpbnRlciA9IHRzLmNyZWF0ZVByaW50ZXIoe29taXRUcmFpbGluZ1NlbWljb2xvbjogdHJ1ZX0pO1xuXG4gICAgLy8gQmVnaW4gd2l0aCB0aGUgaW50aWFsIHNlY3Rpb24gb2YgdGhlIGNvZGUgdGV4dC5cbiAgICBsZXQgY29kZSA9IHRleHRQYXJ0c1swXTtcblxuICAgIC8vIFByb2Nlc3MgZWFjaCBvcGVyYXRpb24gYW5kIHVzZSB0aGUgcHJpbnRlciB0byBnZW5lcmF0ZSBzb3VyY2UgY29kZSBmb3IgaXQsIGluc2VydGluZyBpdCBpbnRvXG4gICAgLy8gdGhlIHNvdXJjZSBjb2RlIGluIGJldHdlZW4gdGhlIG9yaWdpbmFsIGNodW5rcy5cbiAgICBvcHMuZm9yRWFjaCgob3AsIGlkeCkgPT4ge1xuICAgICAgY29uc3QgdGV4dCA9IG9wLmV4ZWN1dGUoaW1wb3J0TWFuYWdlciwgc2YsIHRoaXMucmVmRW1pdHRlciwgcHJpbnRlcik7XG4gICAgICBjb2RlICs9ICdcXG5cXG4nICsgdGV4dCArIHRleHRQYXJ0c1tpZHggKyAxXTtcbiAgICB9KTtcblxuICAgIC8vIFdyaXRlIG91dCB0aGUgaW1wb3J0cyB0aGF0IG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGJlZ2lubmluZyBvZiB0aGUgZmlsZS5cbiAgICBsZXQgaW1wb3J0cyA9IGltcG9ydE1hbmFnZXIuZ2V0QWxsSW1wb3J0cyhzZi5maWxlTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAubWFwKGkgPT4gYGltcG9ydCAqIGFzICR7aS5xdWFsaWZpZXIudGV4dH0gZnJvbSAnJHtpLnNwZWNpZmllcn0nO2ApXG4gICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgIGNvZGUgPSBpbXBvcnRzICsgJ1xcbicgKyBjb2RlO1xuXG4gICAgcmV0dXJuIGNvZGU7XG4gIH1cblxuICBmaW5hbGl6ZSgpOiBNYXA8QWJzb2x1dGVGc1BhdGgsIHN0cmluZz4ge1xuICAgIC8vIEZpcnN0LCBidWlsZCB0aGUgbWFwIG9mIHVwZGF0ZXMgdG8gc291cmNlIGZpbGVzLlxuICAgIGNvbnN0IHVwZGF0ZXMgPSBuZXcgTWFwPEFic29sdXRlRnNQYXRoLCBzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBvcmlnaW5hbFNmIG9mIHRoaXMub3BNYXAua2V5cygpKSB7XG4gICAgICBjb25zdCBuZXdUZXh0ID0gdGhpcy50cmFuc2Zvcm0ob3JpZ2luYWxTZik7XG4gICAgICBpZiAobmV3VGV4dCAhPT0gbnVsbCkge1xuICAgICAgICB1cGRhdGVzLnNldChhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKG9yaWdpbmFsU2YpLCBuZXdUZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUaGVuIGdvIHRocm91Z2ggZWFjaCBpbnB1dCBmaWxlIHRoYXQgaGFzIHBlbmRpbmcgY29kZSBnZW5lcmF0aW9uIG9wZXJhdGlvbnMuXG4gICAgZm9yIChjb25zdCBbc2ZQYXRoLCBwZW5kaW5nRmlsZURhdGFdIG9mIHRoaXMuZmlsZU1hcCkge1xuICAgICAgLy8gRm9yIGVhY2ggaW5wdXQgZmlsZSwgY29uc2lkZXIgZ2VuZXJhdGlvbiBvcGVyYXRpb25zIGZvciBlYWNoIG9mIGl0cyBzaGltcy5cbiAgICAgIGZvciAoY29uc3QgcGVuZGluZ1NoaW1EYXRhIG9mIHBlbmRpbmdGaWxlRGF0YS5zaGltRGF0YS52YWx1ZXMoKSkge1xuICAgICAgICB0aGlzLmhvc3QucmVjb3JkU2hpbURhdGEoc2ZQYXRoLCB7XG4gICAgICAgICAgZ2VuZXNpc0RpYWdub3N0aWNzOiBbXG4gICAgICAgICAgICAuLi5wZW5kaW5nU2hpbURhdGEuZG9tU2NoZW1hQ2hlY2tlci5kaWFnbm9zdGljcyxcbiAgICAgICAgICAgIC4uLnBlbmRpbmdTaGltRGF0YS5vb2JSZWNvcmRlci5kaWFnbm9zdGljcyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGhhc0lubGluZXM6IHBlbmRpbmdGaWxlRGF0YS5oYXNJbmxpbmVzLFxuICAgICAgICAgIHBhdGg6IHBlbmRpbmdTaGltRGF0YS5maWxlLmZpbGVOYW1lLFxuICAgICAgICAgIHRlbXBsYXRlczogcGVuZGluZ1NoaW1EYXRhLnRlbXBsYXRlcyxcbiAgICAgICAgfSk7XG4gICAgICAgIHVwZGF0ZXMuc2V0KFxuICAgICAgICAgICAgcGVuZGluZ1NoaW1EYXRhLmZpbGUuZmlsZU5hbWUsIHBlbmRpbmdTaGltRGF0YS5maWxlLnJlbmRlcihmYWxzZSAvKiByZW1vdmVDb21tZW50cyAqLykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB1cGRhdGVzO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRJbmxpbmVUeXBlQ2hlY2tCbG9jayhcbiAgICAgIGZpbGVEYXRhOiBQZW5kaW5nRmlsZVR5cGVDaGVja2luZ0RhdGEsIHNoaW1EYXRhOiBQZW5kaW5nU2hpbURhdGEsXG4gICAgICByZWY6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+PixcbiAgICAgIHRjYk1ldGE6IFR5cGVDaGVja0Jsb2NrTWV0YWRhdGEpOiB2b2lkIHtcbiAgICBjb25zdCBzZiA9IHJlZi5ub2RlLmdldFNvdXJjZUZpbGUoKTtcbiAgICBpZiAoIXRoaXMub3BNYXAuaGFzKHNmKSkge1xuICAgICAgdGhpcy5vcE1hcC5zZXQoc2YsIFtdKTtcbiAgICB9XG4gICAgY29uc3Qgb3BzID0gdGhpcy5vcE1hcC5nZXQoc2YpITtcbiAgICBvcHMucHVzaChuZXcgSW5saW5lVGNiT3AoXG4gICAgICAgIHJlZiwgdGNiTWV0YSwgdGhpcy5jb25maWcsIHRoaXMucmVmbGVjdG9yLCBzaGltRGF0YS5kb21TY2hlbWFDaGVja2VyLFxuICAgICAgICBzaGltRGF0YS5vb2JSZWNvcmRlcikpO1xuICAgIGZpbGVEYXRhLmhhc0lubGluZXMgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBwZW5kaW5nU2hpbUZvckNvbXBvbmVudChub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogUGVuZGluZ1NoaW1EYXRhIHtcbiAgICBjb25zdCBmaWxlRGF0YSA9IHRoaXMuZGF0YUZvckZpbGUobm9kZS5nZXRTb3VyY2VGaWxlKCkpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gVHlwZUNoZWNrU2hpbUdlbmVyYXRvci5zaGltRm9yKGFic29sdXRlRnJvbVNvdXJjZUZpbGUobm9kZS5nZXRTb3VyY2VGaWxlKCkpKTtcbiAgICBpZiAoIWZpbGVEYXRhLnNoaW1EYXRhLmhhcyhzaGltUGF0aCkpIHtcbiAgICAgIGZpbGVEYXRhLnNoaW1EYXRhLnNldChzaGltUGF0aCwge1xuICAgICAgICBkb21TY2hlbWFDaGVja2VyOiBuZXcgUmVnaXN0cnlEb21TY2hlbWFDaGVja2VyKGZpbGVEYXRhLnNvdXJjZU1hbmFnZXIpLFxuICAgICAgICBvb2JSZWNvcmRlcjogbmV3IE91dE9mQmFuZERpYWdub3N0aWNSZWNvcmRlckltcGwoZmlsZURhdGEuc291cmNlTWFuYWdlciksXG4gICAgICAgIGZpbGU6IG5ldyBUeXBlQ2hlY2tGaWxlKFxuICAgICAgICAgICAgc2hpbVBhdGgsIHRoaXMuY29uZmlnLCB0aGlzLnJlZkVtaXR0ZXIsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmNvbXBpbGVySG9zdCksXG4gICAgICAgIHRlbXBsYXRlczogbmV3IE1hcDxUZW1wbGF0ZUlkLCBUZW1wbGF0ZURhdGE+KCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZpbGVEYXRhLnNoaW1EYXRhLmdldChzaGltUGF0aCkhO1xuICB9XG5cbiAgcHJpdmF0ZSBkYXRhRm9yRmlsZShzZjogdHMuU291cmNlRmlsZSk6IFBlbmRpbmdGaWxlVHlwZUNoZWNraW5nRGF0YSB7XG4gICAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG5cbiAgICBpZiAoIXRoaXMuZmlsZU1hcC5oYXMoc2ZQYXRoKSkge1xuICAgICAgY29uc3QgZGF0YTogUGVuZGluZ0ZpbGVUeXBlQ2hlY2tpbmdEYXRhID0ge1xuICAgICAgICBoYXNJbmxpbmVzOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFuYWdlcjogdGhpcy5ob3N0LmdldFNvdXJjZU1hbmFnZXIoc2ZQYXRoKSxcbiAgICAgICAgc2hpbURhdGE6IG5ldyBNYXAoKSxcbiAgICAgIH07XG4gICAgICB0aGlzLmZpbGVNYXAuc2V0KHNmUGF0aCwgZGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZmlsZU1hcC5nZXQoc2ZQYXRoKSE7XG4gIH1cblxuICBwcml2YXRlIGdldFRlbXBsYXRlRGlhZ25vc3RpY3MoXG4gICAgICBwYXJzZUVycm9yczogUGFyc2VFcnJvcltdLCB0ZW1wbGF0ZUlkOiBUZW1wbGF0ZUlkLFxuICAgICAgc291cmNlTWFwcGluZzogVGVtcGxhdGVTb3VyY2VNYXBwaW5nKTogVGVtcGxhdGVEaWFnbm9zdGljW10ge1xuICAgIHJldHVybiBwYXJzZUVycm9ycy5tYXAoZXJyb3IgPT4ge1xuICAgICAgY29uc3Qgc3BhbiA9IGVycm9yLnNwYW47XG5cbiAgICAgIGlmIChzcGFuLnN0YXJ0Lm9mZnNldCA9PT0gc3Bhbi5lbmQub2Zmc2V0KSB7XG4gICAgICAgIC8vIFRlbXBsYXRlIGVycm9ycyBjYW4gY29udGFpbiB6ZXJvLWxlbmd0aCBzcGFucywgaWYgdGhlIGVycm9yIG9jY3VycyBhdCBhIHNpbmdsZSBwb2ludC5cbiAgICAgICAgLy8gSG93ZXZlciwgVHlwZVNjcmlwdCBkb2VzIG5vdCBoYW5kbGUgZGlzcGxheWluZyBhIHplcm8tbGVuZ3RoIGRpYWdub3N0aWMgdmVyeSB3ZWxsLCBzb1xuICAgICAgICAvLyBpbmNyZWFzZSB0aGUgZW5kaW5nIG9mZnNldCBieSAxIGZvciBzdWNoIGVycm9ycywgdG8gZW5zdXJlIHRoZSBwb3NpdGlvbiBpcyBzaG93biBpbiB0aGVcbiAgICAgICAgLy8gZGlhZ25vc3RpYy5cbiAgICAgICAgc3Bhbi5lbmQub2Zmc2V0Kys7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtYWtlVGVtcGxhdGVEaWFnbm9zdGljKFxuICAgICAgICAgIHRlbXBsYXRlSWQsIHNvdXJjZU1hcHBpbmcsIHNwYW4sIHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcixcbiAgICAgICAgICBuZ0Vycm9yQ29kZShFcnJvckNvZGUuVEVNUExBVEVfUEFSU0VfRVJST1IpLCBlcnJvci5tc2cpO1xuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogQSBjb2RlIGdlbmVyYXRpb24gb3BlcmF0aW9uIHRoYXQgbmVlZHMgdG8gaGFwcGVuIHdpdGhpbiBhIGdpdmVuIHNvdXJjZSBmaWxlLlxuICovXG5pbnRlcmZhY2UgT3Age1xuICAvKipcbiAgICogVGhlIG5vZGUgaW4gdGhlIGZpbGUgd2hpY2ggd2lsbCBoYXZlIGNvZGUgZ2VuZXJhdGVkIGZvciBpdC5cbiAgICovXG4gIHJlYWRvbmx5IHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+O1xuXG4gIC8qKlxuICAgKiBJbmRleCBpbnRvIHRoZSBzb3VyY2UgdGV4dCB3aGVyZSB0aGUgY29kZSBnZW5lcmF0ZWQgYnkgdGhlIG9wZXJhdGlvbiBzaG91bGQgYmUgaW5zZXJ0ZWQuXG4gICAqL1xuICByZWFkb25seSBzcGxpdFBvaW50OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIG9wZXJhdGlvbiBhbmQgcmV0dXJuIHRoZSBnZW5lcmF0ZWQgY29kZSBhcyB0ZXh0LlxuICAgKi9cbiAgZXhlY3V0ZShpbTogSW1wb3J0TWFuYWdlciwgc2Y6IHRzLlNvdXJjZUZpbGUsIHJlZkVtaXR0ZXI6IFJlZmVyZW5jZUVtaXR0ZXIsIHByaW50ZXI6IHRzLlByaW50ZXIpOlxuICAgICAgc3RyaW5nO1xufVxuXG4vKipcbiAqIEEgdHlwZSBjaGVjayBibG9jayBvcGVyYXRpb24gd2hpY2ggcHJvZHVjZXMgaW5saW5lIHR5cGUgY2hlY2sgY29kZSBmb3IgYSBwYXJ0aWN1bGFyIGNvbXBvbmVudC5cbiAqL1xuY2xhc3MgSW5saW5lVGNiT3AgaW1wbGVtZW50cyBPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgcmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4sXG4gICAgICByZWFkb25seSBtZXRhOiBUeXBlQ2hlY2tCbG9ja01ldGFkYXRhLCByZWFkb25seSBjb25maWc6IFR5cGVDaGVja2luZ0NvbmZpZyxcbiAgICAgIHJlYWRvbmx5IHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIHJlYWRvbmx5IGRvbVNjaGVtYUNoZWNrZXI6IERvbVNjaGVtYUNoZWNrZXIsXG4gICAgICByZWFkb25seSBvb2JSZWNvcmRlcjogT3V0T2ZCYW5kRGlhZ25vc3RpY1JlY29yZGVyKSB7fVxuXG4gIC8qKlxuICAgKiBUeXBlIGNoZWNrIGJsb2NrcyBhcmUgaW5zZXJ0ZWQgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIGVuZCBvZiB0aGUgY29tcG9uZW50IGNsYXNzLlxuICAgKi9cbiAgZ2V0IHNwbGl0UG9pbnQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5yZWYubm9kZS5lbmQgKyAxO1xuICB9XG5cbiAgZXhlY3V0ZShpbTogSW1wb3J0TWFuYWdlciwgc2Y6IHRzLlNvdXJjZUZpbGUsIHJlZkVtaXR0ZXI6IFJlZmVyZW5jZUVtaXR0ZXIsIHByaW50ZXI6IHRzLlByaW50ZXIpOlxuICAgICAgc3RyaW5nIHtcbiAgICBjb25zdCBlbnYgPSBuZXcgRW52aXJvbm1lbnQodGhpcy5jb25maWcsIGltLCByZWZFbWl0dGVyLCB0aGlzLnJlZmxlY3Rvciwgc2YpO1xuICAgIGNvbnN0IGZuTmFtZSA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoYF90Y2JfJHt0aGlzLnJlZi5ub2RlLnBvc31gKTtcblxuICAgIC8vIElubGluZSBUQ0JzIHNob3VsZCBjb3B5IGFueSBnZW5lcmljIHR5cGUgcGFyYW1ldGVyIG5vZGVzIGRpcmVjdGx5LCBhcyB0aGUgVENCIGNvZGUgaXMgaW5saW5lZFxuICAgIC8vIGludG8gdGhlIGNsYXNzIGluIGEgY29udGV4dCB3aGVyZSB0aGF0IHdpbGwgYWx3YXlzIGJlIGxlZ2FsLlxuICAgIGNvbnN0IGZuID0gZ2VuZXJhdGVUeXBlQ2hlY2tCbG9jayhcbiAgICAgICAgZW52LCB0aGlzLnJlZiwgZm5OYW1lLCB0aGlzLm1ldGEsIHRoaXMuZG9tU2NoZW1hQ2hlY2tlciwgdGhpcy5vb2JSZWNvcmRlcixcbiAgICAgICAgVGNiR2VuZXJpY0NvbnRleHRCZWhhdmlvci5Db3B5Q2xhc3NOb2Rlcyk7XG4gICAgcmV0dXJuIHByaW50ZXIucHJpbnROb2RlKHRzLkVtaXRIaW50LlVuc3BlY2lmaWVkLCBmbiwgc2YpO1xuICB9XG59XG5cbi8qKlxuICogQSB0eXBlIGNvbnN0cnVjdG9yIG9wZXJhdGlvbiB3aGljaCBwcm9kdWNlcyB0eXBlIGNvbnN0cnVjdG9yIGNvZGUgZm9yIGEgcGFydGljdWxhciBkaXJlY3RpdmUuXG4gKi9cbmNsYXNzIFR5cGVDdG9yT3AgaW1wbGVtZW50cyBPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgcmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4sXG4gICAgICByZWFkb25seSBtZXRhOiBUeXBlQ3Rvck1ldGFkYXRhKSB7fVxuXG4gIC8qKlxuICAgKiBUeXBlIGNvbnN0cnVjdG9yIG9wZXJhdGlvbnMgYXJlIGluc2VydGVkIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZW5kIG9mIHRoZSBkaXJlY3RpdmUgY2xhc3MuXG4gICAqL1xuICBnZXQgc3BsaXRQb2ludCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnJlZi5ub2RlLmVuZCAtIDE7XG4gIH1cblxuICBleGVjdXRlKGltOiBJbXBvcnRNYW5hZ2VyLCBzZjogdHMuU291cmNlRmlsZSwgcmVmRW1pdHRlcjogUmVmZXJlbmNlRW1pdHRlciwgcHJpbnRlcjogdHMuUHJpbnRlcik6XG4gICAgICBzdHJpbmcge1xuICAgIGNvbnN0IHRjYiA9IGdlbmVyYXRlSW5saW5lVHlwZUN0b3IodGhpcy5yZWYubm9kZSwgdGhpcy5tZXRhKTtcbiAgICByZXR1cm4gcHJpbnRlci5wcmludE5vZGUodHMuRW1pdEhpbnQuVW5zcGVjaWZpZWQsIHRjYiwgc2YpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGFyZSB0d28gb3BlcmF0aW9ucyBhbmQgcmV0dXJuIHRoZWlyIHNwbGl0IHBvaW50IG9yZGVyaW5nLlxuICovXG5mdW5jdGlvbiBvcmRlck9wcyhvcDE6IE9wLCBvcDI6IE9wKTogbnVtYmVyIHtcbiAgcmV0dXJuIG9wMS5zcGxpdFBvaW50IC0gb3AyLnNwbGl0UG9pbnQ7XG59XG5cbi8qKlxuICogU3BsaXQgYSBzdHJpbmcgaW50byBjaHVua3MgYXQgYW55IG51bWJlciBvZiBzcGxpdCBwb2ludHMuXG4gKi9cbmZ1bmN0aW9uIHNwbGl0U3RyaW5nQXRQb2ludHMoc3RyOiBzdHJpbmcsIHBvaW50czogbnVtYmVyW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHNwbGl0czogc3RyaW5nW10gPSBbXTtcbiAgbGV0IHN0YXJ0ID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBwb2ludCA9IHBvaW50c1tpXTtcbiAgICBzcGxpdHMucHVzaChzdHIuc3Vic3RyaW5nKHN0YXJ0LCBwb2ludCkpO1xuICAgIHN0YXJ0ID0gcG9pbnQ7XG4gIH1cbiAgc3BsaXRzLnB1c2goc3RyLnN1YnN0cmluZyhzdGFydCkpO1xuICByZXR1cm4gc3BsaXRzO1xufVxuIl19