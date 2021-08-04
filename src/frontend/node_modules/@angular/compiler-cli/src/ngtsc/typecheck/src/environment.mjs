/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ExpressionType, ExternalExpr } from '@angular/compiler';
import * as ts from 'typescript';
import { ImportFlags } from '../../imports';
import { translateExpression, translateType } from '../../translator';
import { tsDeclareVariable } from './ts_util';
import { generateTypeCtorDeclarationFn, requiresInlineTypeCtor } from './type_constructor';
import { TypeParameterEmitter } from './type_parameter_emitter';
/**
 * A context which hosts one or more Type Check Blocks (TCBs).
 *
 * An `Environment` supports the generation of TCBs by tracking necessary imports, declarations of
 * type constructors, and other statements beyond the type-checking code within the TCB itself.
 * Through method calls on `Environment`, the TCB generator can request `ts.Expression`s which
 * reference declarations in the `Environment` for these artifacts`.
 *
 * `Environment` can be used in a standalone fashion, or can be extended to support more specialized
 * usage.
 */
export class Environment {
    constructor(config, importManager, refEmitter, reflector, contextFile) {
        this.config = config;
        this.importManager = importManager;
        this.refEmitter = refEmitter;
        this.reflector = reflector;
        this.contextFile = contextFile;
        this.nextIds = {
            pipeInst: 1,
            typeCtor: 1,
        };
        this.typeCtors = new Map();
        this.typeCtorStatements = [];
        this.pipeInsts = new Map();
        this.pipeInstStatements = [];
    }
    /**
     * Get an expression referring to a type constructor for the given directive.
     *
     * Depending on the shape of the directive itself, this could be either a reference to a declared
     * type constructor, or to an inline type constructor.
     */
    typeCtorFor(dir) {
        const dirRef = dir.ref;
        const node = dirRef.node;
        if (this.typeCtors.has(node)) {
            return this.typeCtors.get(node);
        }
        if (requiresInlineTypeCtor(node, this.reflector)) {
            // The constructor has already been created inline, we just need to construct a reference to
            // it.
            const ref = this.reference(dirRef);
            const typeCtorExpr = ts.createPropertyAccess(ref, 'ngTypeCtor');
            this.typeCtors.set(node, typeCtorExpr);
            return typeCtorExpr;
        }
        else {
            const fnName = `_ctor${this.nextIds.typeCtor++}`;
            const nodeTypeRef = this.referenceType(dirRef);
            if (!ts.isTypeReferenceNode(nodeTypeRef)) {
                throw new Error(`Expected TypeReferenceNode from reference to ${dirRef.debugName}`);
            }
            const meta = {
                fnName,
                body: true,
                fields: {
                    inputs: dir.inputs.classPropertyNames,
                    outputs: dir.outputs.classPropertyNames,
                    // TODO: support queries
                    queries: dir.queries,
                },
                coercedInputFields: dir.coercedInputFields,
            };
            const typeParams = this.emitTypeParameters(node);
            const typeCtor = generateTypeCtorDeclarationFn(node, meta, nodeTypeRef.typeName, typeParams, this.reflector);
            this.typeCtorStatements.push(typeCtor);
            const fnId = ts.createIdentifier(fnName);
            this.typeCtors.set(node, fnId);
            return fnId;
        }
    }
    /*
     * Get an expression referring to an instance of the given pipe.
     */
    pipeInst(ref) {
        if (this.pipeInsts.has(ref.node)) {
            return this.pipeInsts.get(ref.node);
        }
        const pipeType = this.referenceType(ref);
        const pipeInstId = ts.createIdentifier(`_pipe${this.nextIds.pipeInst++}`);
        this.pipeInstStatements.push(tsDeclareVariable(pipeInstId, pipeType));
        this.pipeInsts.set(ref.node, pipeInstId);
        return pipeInstId;
    }
    /**
     * Generate a `ts.Expression` that references the given node.
     *
     * This may involve importing the node into the file if it's not declared there already.
     */
    reference(ref) {
        // Disable aliasing for imports generated in a template type-checking context, as there is no
        // guarantee that any alias re-exports exist in the .d.ts files. It's safe to use direct imports
        // in these cases as there is no strict dependency checking during the template type-checking
        // pass.
        const ngExpr = this.refEmitter.emit(ref, this.contextFile, ImportFlags.NoAliasing);
        // Use `translateExpression` to convert the `Expression` into a `ts.Expression`.
        return translateExpression(ngExpr.expression, this.importManager);
    }
    /**
     * Generate a `ts.TypeNode` that references the given node as a type.
     *
     * This may involve importing the node into the file if it's not declared there already.
     */
    referenceType(ref) {
        const ngExpr = this.refEmitter.emit(ref, this.contextFile, ImportFlags.NoAliasing | ImportFlags.AllowTypeImports);
        // Create an `ExpressionType` from the `Expression` and translate it via `translateType`.
        // TODO(alxhub): support references to types with generic arguments in a clean way.
        return translateType(new ExpressionType(ngExpr.expression), this.importManager);
    }
    emitTypeParameters(declaration) {
        const emitter = new TypeParameterEmitter(declaration.typeParameters, this.reflector);
        return emitter.emit(ref => this.referenceType(ref));
    }
    /**
     * Generate a `ts.TypeNode` that references a given type from the provided module.
     *
     * This will involve importing the type into the file, and will also add type parameters if
     * provided.
     */
    referenceExternalType(moduleName, name, typeParams) {
        const external = new ExternalExpr({ moduleName, name });
        return translateType(new ExpressionType(external, [ /* modifiers */], typeParams), this.importManager);
    }
    getPreludeStatements() {
        return [
            ...this.pipeInstStatements,
            ...this.typeCtorStatements,
        ];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3R5cGVjaGVjay9zcmMvZW52aXJvbm1lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGNBQWMsRUFBRSxZQUFZLEVBQXdCLE1BQU0sbUJBQW1CLENBQUM7QUFDdEYsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLFdBQVcsRUFBOEIsTUFBTSxlQUFlLENBQUM7QUFFdkUsT0FBTyxFQUFnQixtQkFBbUIsRUFBRSxhQUFhLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUduRixPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDNUMsT0FBTyxFQUFDLDZCQUE2QixFQUFFLHNCQUFzQixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDekYsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFOUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQU0sT0FBTyxXQUFXO0lBWXRCLFlBQ2EsTUFBMEIsRUFBWSxhQUE0QixFQUNuRSxVQUE0QixFQUFXLFNBQXlCLEVBQzlELFdBQTBCO1FBRjNCLFdBQU0sR0FBTixNQUFNLENBQW9CO1FBQVksa0JBQWEsR0FBYixhQUFhLENBQWU7UUFDbkUsZUFBVSxHQUFWLFVBQVUsQ0FBa0I7UUFBVyxjQUFTLEdBQVQsU0FBUyxDQUFnQjtRQUM5RCxnQkFBVyxHQUFYLFdBQVcsQ0FBZTtRQWRoQyxZQUFPLEdBQUc7WUFDaEIsUUFBUSxFQUFFLENBQUM7WUFDWCxRQUFRLEVBQUUsQ0FBQztTQUNaLENBQUM7UUFFTSxjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQW1DLENBQUM7UUFDckQsdUJBQWtCLEdBQW1CLEVBQUUsQ0FBQztRQUUxQyxj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LElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxxQkFBcUIsQ0FBQyxVQUFrQixFQUFFLElBQVksRUFBRSxVQUFtQjtRQUN6RSxNQUFNLFFBQVEsR0FBRyxJQUFJLFlBQVksQ0FBQyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO1FBQ3RELE9BQU8sYUFBYSxDQUNoQixJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxlQUFlLENBQUMsRUFBRSxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUVELG9CQUFvQjtRQUNsQixPQUFPO1lBQ0wsR0FBRyxJQUFJLENBQUMsa0JBQWtCO1lBQzFCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQjtTQUMzQixDQUFDO0lBQ0osQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7RXhwcmVzc2lvblR5cGUsIEV4dGVybmFsRXhwciwgVHlwZSwgV3JhcHBlZE5vZGVFeHByfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtJbXBvcnRGbGFncywgUmVmZXJlbmNlLCBSZWZlcmVuY2VFbWl0dGVyfSBmcm9tICcuLi8uLi9pbXBvcnRzJztcbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbiwgUmVmbGVjdGlvbkhvc3R9IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtJbXBvcnRNYW5hZ2VyLCB0cmFuc2xhdGVFeHByZXNzaW9uLCB0cmFuc2xhdGVUeXBlfSBmcm9tICcuLi8uLi90cmFuc2xhdG9yJztcbmltcG9ydCB7VHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEsIFR5cGVDaGVja2luZ0NvbmZpZywgVHlwZUN0b3JNZXRhZGF0YX0gZnJvbSAnLi4vYXBpJztcblxuaW1wb3J0IHt0c0RlY2xhcmVWYXJpYWJsZX0gZnJvbSAnLi90c191dGlsJztcbmltcG9ydCB7Z2VuZXJhdGVUeXBlQ3RvckRlY2xhcmF0aW9uRm4sIHJlcXVpcmVzSW5saW5lVHlwZUN0b3J9IGZyb20gJy4vdHlwZV9jb25zdHJ1Y3Rvcic7XG5pbXBvcnQge1R5cGVQYXJhbWV0ZXJFbWl0dGVyfSBmcm9tICcuL3R5cGVfcGFyYW1ldGVyX2VtaXR0ZXInO1xuXG4vKipcbiAqIEEgY29udGV4dCB3aGljaCBob3N0cyBvbmUgb3IgbW9yZSBUeXBlIENoZWNrIEJsb2NrcyAoVENCcykuXG4gKlxuICogQW4gYEVudmlyb25tZW50YCBzdXBwb3J0cyB0aGUgZ2VuZXJhdGlvbiBvZiBUQ0JzIGJ5IHRyYWNraW5nIG5lY2Vzc2FyeSBpbXBvcnRzLCBkZWNsYXJhdGlvbnMgb2ZcbiAqIHR5cGUgY29uc3RydWN0b3JzLCBhbmQgb3RoZXIgc3RhdGVtZW50cyBiZXlvbmQgdGhlIHR5cGUtY2hlY2tpbmcgY29kZSB3aXRoaW4gdGhlIFRDQiBpdHNlbGYuXG4gKiBUaHJvdWdoIG1ldGhvZCBjYWxscyBvbiBgRW52aXJvbm1lbnRgLCB0aGUgVENCIGdlbmVyYXRvciBjYW4gcmVxdWVzdCBgdHMuRXhwcmVzc2lvbmBzIHdoaWNoXG4gKiByZWZlcmVuY2UgZGVjbGFyYXRpb25zIGluIHRoZSBgRW52aXJvbm1lbnRgIGZvciB0aGVzZSBhcnRpZmFjdHNgLlxuICpcbiAqIGBFbnZpcm9ubWVudGAgY2FuIGJlIHVzZWQgaW4gYSBzdGFuZGFsb25lIGZhc2hpb24sIG9yIGNhbiBiZSBleHRlbmRlZCB0byBzdXBwb3J0IG1vcmUgc3BlY2lhbGl6ZWRcbiAqIHVzYWdlLlxuICovXG5leHBvcnQgY2xhc3MgRW52aXJvbm1lbnQge1xuICBwcml2YXRlIG5leHRJZHMgPSB7XG4gICAgcGlwZUluc3Q6IDEsXG4gICAgdHlwZUN0b3I6IDEsXG4gIH07XG5cbiAgcHJpdmF0ZSB0eXBlQ3RvcnMgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIHRzLkV4cHJlc3Npb24+KCk7XG4gIHByb3RlY3RlZCB0eXBlQ3RvclN0YXRlbWVudHM6IHRzLlN0YXRlbWVudFtdID0gW107XG5cbiAgcHJpdmF0ZSBwaXBlSW5zdHMgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIHRzLkV4cHJlc3Npb24+KCk7XG4gIHByb3RlY3RlZCBwaXBlSW5zdFN0YXRlbWVudHM6IHRzLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBjb25maWc6IFR5cGVDaGVja2luZ0NvbmZpZywgcHJvdGVjdGVkIGltcG9ydE1hbmFnZXI6IEltcG9ydE1hbmFnZXIsXG4gICAgICBwcml2YXRlIHJlZkVtaXR0ZXI6IFJlZmVyZW5jZUVtaXR0ZXIsIHJlYWRvbmx5IHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsXG4gICAgICBwcm90ZWN0ZWQgY29udGV4dEZpbGU6IHRzLlNvdXJjZUZpbGUpIHt9XG5cbiAgLyoqXG4gICAqIEdldCBhbiBleHByZXNzaW9uIHJlZmVycmluZyB0byBhIHR5cGUgY29uc3RydWN0b3IgZm9yIHRoZSBnaXZlbiBkaXJlY3RpdmUuXG4gICAqXG4gICAqIERlcGVuZGluZyBvbiB0aGUgc2hhcGUgb2YgdGhlIGRpcmVjdGl2ZSBpdHNlbGYsIHRoaXMgY291bGQgYmUgZWl0aGVyIGEgcmVmZXJlbmNlIHRvIGEgZGVjbGFyZWRcbiAgICogdHlwZSBjb25zdHJ1Y3Rvciwgb3IgdG8gYW4gaW5saW5lIHR5cGUgY29uc3RydWN0b3IuXG4gICAqL1xuICB0eXBlQ3RvckZvcihkaXI6IFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZGlyUmVmID0gZGlyLnJlZiBhcyBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj47XG4gICAgY29uc3Qgbm9kZSA9IGRpclJlZi5ub2RlO1xuICAgIGlmICh0aGlzLnR5cGVDdG9ycy5oYXMobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnR5cGVDdG9ycy5nZXQobm9kZSkhO1xuICAgIH1cblxuICAgIGlmIChyZXF1aXJlc0lubGluZVR5cGVDdG9yKG5vZGUsIHRoaXMucmVmbGVjdG9yKSkge1xuICAgICAgLy8gVGhlIGNvbnN0cnVjdG9yIGhhcyBhbHJlYWR5IGJlZW4gY3JlYXRlZCBpbmxpbmUsIHdlIGp1c3QgbmVlZCB0byBjb25zdHJ1Y3QgYSByZWZlcmVuY2UgdG9cbiAgICAgIC8vIGl0LlxuICAgICAgY29uc3QgcmVmID0gdGhpcy5yZWZlcmVuY2UoZGlyUmVmKTtcbiAgICAgIGNvbnN0IHR5cGVDdG9yRXhwciA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHJlZiwgJ25nVHlwZUN0b3InKTtcbiAgICAgIHRoaXMudHlwZUN0b3JzLnNldChub2RlLCB0eXBlQ3RvckV4cHIpO1xuICAgICAgcmV0dXJuIHR5cGVDdG9yRXhwcjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZm5OYW1lID0gYF9jdG9yJHt0aGlzLm5leHRJZHMudHlwZUN0b3IrK31gO1xuICAgICAgY29uc3Qgbm9kZVR5cGVSZWYgPSB0aGlzLnJlZmVyZW5jZVR5cGUoZGlyUmVmKTtcbiAgICAgIGlmICghdHMuaXNUeXBlUmVmZXJlbmNlTm9kZShub2RlVHlwZVJlZikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBUeXBlUmVmZXJlbmNlTm9kZSBmcm9tIHJlZmVyZW5jZSB0byAke2RpclJlZi5kZWJ1Z05hbWV9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCBtZXRhOiBUeXBlQ3Rvck1ldGFkYXRhID0ge1xuICAgICAgICBmbk5hbWUsXG4gICAgICAgIGJvZHk6IHRydWUsXG4gICAgICAgIGZpZWxkczoge1xuICAgICAgICAgIGlucHV0czogZGlyLmlucHV0cy5jbGFzc1Byb3BlcnR5TmFtZXMsXG4gICAgICAgICAgb3V0cHV0czogZGlyLm91dHB1dHMuY2xhc3NQcm9wZXJ0eU5hbWVzLFxuICAgICAgICAgIC8vIFRPRE86IHN1cHBvcnQgcXVlcmllc1xuICAgICAgICAgIHF1ZXJpZXM6IGRpci5xdWVyaWVzLFxuICAgICAgICB9LFxuICAgICAgICBjb2VyY2VkSW5wdXRGaWVsZHM6IGRpci5jb2VyY2VkSW5wdXRGaWVsZHMsXG4gICAgICB9O1xuICAgICAgY29uc3QgdHlwZVBhcmFtcyA9IHRoaXMuZW1pdFR5cGVQYXJhbWV0ZXJzKG5vZGUpO1xuICAgICAgY29uc3QgdHlwZUN0b3IgPSBnZW5lcmF0ZVR5cGVDdG9yRGVjbGFyYXRpb25GbihcbiAgICAgICAgICBub2RlLCBtZXRhLCBub2RlVHlwZVJlZi50eXBlTmFtZSwgdHlwZVBhcmFtcywgdGhpcy5yZWZsZWN0b3IpO1xuICAgICAgdGhpcy50eXBlQ3RvclN0YXRlbWVudHMucHVzaCh0eXBlQ3Rvcik7XG4gICAgICBjb25zdCBmbklkID0gdHMuY3JlYXRlSWRlbnRpZmllcihmbk5hbWUpO1xuICAgICAgdGhpcy50eXBlQ3RvcnMuc2V0KG5vZGUsIGZuSWQpO1xuICAgICAgcmV0dXJuIGZuSWQ7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogR2V0IGFuIGV4cHJlc3Npb24gcmVmZXJyaW5nIHRvIGFuIGluc3RhbmNlIG9mIHRoZSBnaXZlbiBwaXBlLlxuICAgKi9cbiAgcGlwZUluc3QocmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4pOiB0cy5FeHByZXNzaW9uIHtcbiAgICBpZiAodGhpcy5waXBlSW5zdHMuaGFzKHJlZi5ub2RlKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGlwZUluc3RzLmdldChyZWYubm9kZSkhO1xuICAgIH1cblxuICAgIGNvbnN0IHBpcGVUeXBlID0gdGhpcy5yZWZlcmVuY2VUeXBlKHJlZik7XG4gICAgY29uc3QgcGlwZUluc3RJZCA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoYF9waXBlJHt0aGlzLm5leHRJZHMucGlwZUluc3QrK31gKTtcblxuICAgIHRoaXMucGlwZUluc3RTdGF0ZW1lbnRzLnB1c2godHNEZWNsYXJlVmFyaWFibGUocGlwZUluc3RJZCwgcGlwZVR5cGUpKTtcbiAgICB0aGlzLnBpcGVJbnN0cy5zZXQocmVmLm5vZGUsIHBpcGVJbnN0SWQpO1xuXG4gICAgcmV0dXJuIHBpcGVJbnN0SWQ7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSBgdHMuRXhwcmVzc2lvbmAgdGhhdCByZWZlcmVuY2VzIHRoZSBnaXZlbiBub2RlLlxuICAgKlxuICAgKiBUaGlzIG1heSBpbnZvbHZlIGltcG9ydGluZyB0aGUgbm9kZSBpbnRvIHRoZSBmaWxlIGlmIGl0J3Mgbm90IGRlY2xhcmVkIHRoZXJlIGFscmVhZHkuXG4gICAqL1xuICByZWZlcmVuY2UocmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPj4pOiB0cy5FeHByZXNzaW9uIHtcbiAgICAvLyBEaXNhYmxlIGFsaWFzaW5nIGZvciBpbXBvcnRzIGdlbmVyYXRlZCBpbiBhIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgY29udGV4dCwgYXMgdGhlcmUgaXMgbm9cbiAgICAvLyBndWFyYW50ZWUgdGhhdCBhbnkgYWxpYXMgcmUtZXhwb3J0cyBleGlzdCBpbiB0aGUgLmQudHMgZmlsZXMuIEl0J3Mgc2FmZSB0byB1c2UgZGlyZWN0IGltcG9ydHNcbiAgICAvLyBpbiB0aGVzZSBjYXNlcyBhcyB0aGVyZSBpcyBubyBzdHJpY3QgZGVwZW5kZW5jeSBjaGVja2luZyBkdXJpbmcgdGhlIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmdcbiAgICAvLyBwYXNzLlxuICAgIGNvbnN0IG5nRXhwciA9IHRoaXMucmVmRW1pdHRlci5lbWl0KHJlZiwgdGhpcy5jb250ZXh0RmlsZSwgSW1wb3J0RmxhZ3MuTm9BbGlhc2luZyk7XG5cbiAgICAvLyBVc2UgYHRyYW5zbGF0ZUV4cHJlc3Npb25gIHRvIGNvbnZlcnQgdGhlIGBFeHByZXNzaW9uYCBpbnRvIGEgYHRzLkV4cHJlc3Npb25gLlxuICAgIHJldHVybiB0cmFuc2xhdGVFeHByZXNzaW9uKG5nRXhwci5leHByZXNzaW9uLCB0aGlzLmltcG9ydE1hbmFnZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgYHRzLlR5cGVOb2RlYCB0aGF0IHJlZmVyZW5jZXMgdGhlIGdpdmVuIG5vZGUgYXMgYSB0eXBlLlxuICAgKlxuICAgKiBUaGlzIG1heSBpbnZvbHZlIGltcG9ydGluZyB0aGUgbm9kZSBpbnRvIHRoZSBmaWxlIGlmIGl0J3Mgbm90IGRlY2xhcmVkIHRoZXJlIGFscmVhZHkuXG4gICAqL1xuICByZWZlcmVuY2VUeXBlKHJlZjogUmVmZXJlbmNlKTogdHMuVHlwZU5vZGUge1xuICAgIGNvbnN0IG5nRXhwciA9IHRoaXMucmVmRW1pdHRlci5lbWl0KFxuICAgICAgICByZWYsIHRoaXMuY29udGV4dEZpbGUsIEltcG9ydEZsYWdzLk5vQWxpYXNpbmcgfCBJbXBvcnRGbGFncy5BbGxvd1R5cGVJbXBvcnRzKTtcblxuICAgIC8vIENyZWF0ZSBhbiBgRXhwcmVzc2lvblR5cGVgIGZyb20gdGhlIGBFeHByZXNzaW9uYCBhbmQgdHJhbnNsYXRlIGl0IHZpYSBgdHJhbnNsYXRlVHlwZWAuXG4gICAgLy8gVE9ETyhhbHhodWIpOiBzdXBwb3J0IHJlZmVyZW5jZXMgdG8gdHlwZXMgd2l0aCBnZW5lcmljIGFyZ3VtZW50cyBpbiBhIGNsZWFuIHdheS5cbiAgICByZXR1cm4gdHJhbnNsYXRlVHlwZShuZXcgRXhwcmVzc2lvblR5cGUobmdFeHByLmV4cHJlc3Npb24pLCB0aGlzLmltcG9ydE1hbmFnZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBlbWl0VHlwZVBhcmFtZXRlcnMoZGVjbGFyYXRpb246IENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4pOlxuICAgICAgdHMuVHlwZVBhcmFtZXRlckRlY2xhcmF0aW9uW118dW5kZWZpbmVkIHtcbiAgICBjb25zdCBlbWl0dGVyID0gbmV3IFR5cGVQYXJhbWV0ZXJFbWl0dGVyKGRlY2xhcmF0aW9uLnR5cGVQYXJhbWV0ZXJzLCB0aGlzLnJlZmxlY3Rvcik7XG4gICAgcmV0dXJuIGVtaXR0ZXIuZW1pdChyZWYgPT4gdGhpcy5yZWZlcmVuY2VUeXBlKHJlZikpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgYHRzLlR5cGVOb2RlYCB0aGF0IHJlZmVyZW5jZXMgYSBnaXZlbiB0eXBlIGZyb20gdGhlIHByb3ZpZGVkIG1vZHVsZS5cbiAgICpcbiAgICogVGhpcyB3aWxsIGludm9sdmUgaW1wb3J0aW5nIHRoZSB0eXBlIGludG8gdGhlIGZpbGUsIGFuZCB3aWxsIGFsc28gYWRkIHR5cGUgcGFyYW1ldGVycyBpZlxuICAgKiBwcm92aWRlZC5cbiAgICovXG4gIHJlZmVyZW5jZUV4dGVybmFsVHlwZShtb2R1bGVOYW1lOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdHlwZVBhcmFtcz86IFR5cGVbXSk6IHRzLlR5cGVOb2RlIHtcbiAgICBjb25zdCBleHRlcm5hbCA9IG5ldyBFeHRlcm5hbEV4cHIoe21vZHVsZU5hbWUsIG5hbWV9KTtcbiAgICByZXR1cm4gdHJhbnNsYXRlVHlwZShcbiAgICAgICAgbmV3IEV4cHJlc3Npb25UeXBlKGV4dGVybmFsLCBbLyogbW9kaWZpZXJzICovXSwgdHlwZVBhcmFtcyksIHRoaXMuaW1wb3J0TWFuYWdlcik7XG4gIH1cblxuICBnZXRQcmVsdWRlU3RhdGVtZW50cygpOiB0cy5TdGF0ZW1lbnRbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIC4uLnRoaXMucGlwZUluc3RTdGF0ZW1lbnRzLFxuICAgICAgLi4udGhpcy50eXBlQ3RvclN0YXRlbWVudHMsXG4gICAgXTtcbiAgfVxufVxuIl19