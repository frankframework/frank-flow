/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { Reference } from '../../imports';
import { isNamedClassDeclaration } from '../../reflection';
import { MetaType } from './api';
import { ClassPropertyMapping } from './property_mapping';
import { extractDirectiveTypeCheckMeta, extractReferencesFromType, readStringArrayType, readStringMapType, readStringType } from './util';
/**
 * A `MetadataReader` that can read metadata from `.d.ts` files, which have static Ivy properties
 * from an upstream compilation already.
 */
export class DtsMetadataReader {
    constructor(checker, reflector) {
        this.checker = checker;
        this.reflector = reflector;
    }
    /**
     * Read the metadata from a class that has already been compiled somehow (either it's in a .d.ts
     * file, or in a .ts file with a handwritten definition).
     *
     * @param ref `Reference` to the class of interest, with the context of how it was obtained.
     */
    getNgModuleMetadata(ref) {
        const clazz = ref.node;
        const resolutionContext = clazz.getSourceFile().fileName;
        // This operation is explicitly not memoized, as it depends on `ref.ownedByModuleGuess`.
        // TODO(alxhub): investigate caching of .d.ts module metadata.
        const ngModuleDef = this.reflector.getMembersOfClass(clazz).find(member => member.name === 'ɵmod' && member.isStatic);
        if (ngModuleDef === undefined) {
            return null;
        }
        else if (
        // Validate that the shape of the ngModuleDef type is correct.
        ngModuleDef.type === null || !ts.isTypeReferenceNode(ngModuleDef.type) ||
            ngModuleDef.type.typeArguments === undefined ||
            ngModuleDef.type.typeArguments.length !== 4) {
            return null;
        }
        // Read the ModuleData out of the type arguments.
        const [_, declarationMetadata, importMetadata, exportMetadata] = ngModuleDef.type.typeArguments;
        return {
            ref,
            declarations: extractReferencesFromType(this.checker, declarationMetadata, ref.ownedByModuleGuess, resolutionContext),
            exports: extractReferencesFromType(this.checker, exportMetadata, ref.ownedByModuleGuess, resolutionContext),
            imports: extractReferencesFromType(this.checker, importMetadata, ref.ownedByModuleGuess, resolutionContext),
            schemas: [],
            rawDeclarations: null,
        };
    }
    /**
     * Read directive (or component) metadata from a referenced class in a .d.ts file.
     */
    getDirectiveMetadata(ref) {
        const clazz = ref.node;
        const def = this.reflector.getMembersOfClass(clazz).find(field => field.isStatic && (field.name === 'ɵcmp' || field.name === 'ɵdir'));
        if (def === undefined) {
            // No definition could be found.
            return null;
        }
        else if (def.type === null || !ts.isTypeReferenceNode(def.type) ||
            def.type.typeArguments === undefined || def.type.typeArguments.length < 2) {
            // The type metadata was the wrong shape.
            return null;
        }
        const isComponent = def.name === 'ɵcmp';
        const ctorParams = this.reflector.getConstructorParameters(clazz);
        // A directive is considered to be structural if:
        // 1) it's a directive, not a component, and
        // 2) it injects `TemplateRef`
        const isStructural = !isComponent && ctorParams !== null && ctorParams.some(param => {
            return param.typeValueReference.kind === 1 /* IMPORTED */ &&
                param.typeValueReference.moduleName === '@angular/core' &&
                param.typeValueReference.importedName === 'TemplateRef';
        });
        const inputs = ClassPropertyMapping.fromMappedObject(readStringMapType(def.type.typeArguments[3]));
        const outputs = ClassPropertyMapping.fromMappedObject(readStringMapType(def.type.typeArguments[4]));
        return Object.assign(Object.assign({ type: MetaType.Directive, ref, name: clazz.name.text, isComponent, selector: readStringType(def.type.typeArguments[1]), exportAs: readStringArrayType(def.type.typeArguments[2]), inputs,
            outputs, queries: readStringArrayType(def.type.typeArguments[5]) }, extractDirectiveTypeCheckMeta(clazz, inputs, this.reflector)), { baseClass: readBaseClass(clazz, this.checker, this.reflector), isPoisoned: false, isStructural });
    }
    /**
     * Read pipe metadata from a referenced class in a .d.ts file.
     */
    getPipeMetadata(ref) {
        const def = this.reflector.getMembersOfClass(ref.node).find(field => field.isStatic && field.name === 'ɵpipe');
        if (def === undefined) {
            // No definition could be found.
            return null;
        }
        else if (def.type === null || !ts.isTypeReferenceNode(def.type) ||
            def.type.typeArguments === undefined || def.type.typeArguments.length < 2) {
            // The type metadata was the wrong shape.
            return null;
        }
        const type = def.type.typeArguments[1];
        if (!ts.isLiteralTypeNode(type) || !ts.isStringLiteral(type.literal)) {
            // The type metadata was the wrong type.
            return null;
        }
        const name = type.literal.text;
        return {
            type: MetaType.Pipe,
            ref,
            name,
            nameExpr: null,
        };
    }
}
function readBaseClass(clazz, checker, reflector) {
    if (!isNamedClassDeclaration(clazz)) {
        // Technically this is an error in a .d.ts file, but for the purposes of finding the base class
        // it's ignored.
        return reflector.hasBaseClass(clazz) ? 'dynamic' : null;
    }
    if (clazz.heritageClauses !== undefined) {
        for (const clause of clazz.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                const baseExpr = clause.types[0].expression;
                let symbol = checker.getSymbolAtLocation(baseExpr);
                if (symbol === undefined) {
                    return 'dynamic';
                }
                else if (symbol.flags & ts.SymbolFlags.Alias) {
                    symbol = checker.getAliasedSymbol(symbol);
                }
                if (symbol.valueDeclaration !== undefined &&
                    isNamedClassDeclaration(symbol.valueDeclaration)) {
                    return new Reference(symbol.valueDeclaration);
                }
                else {
                    return 'dynamic';
                }
            }
        }
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9tZXRhZGF0YS9zcmMvZHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDeEMsT0FBTyxFQUFtQix1QkFBdUIsRUFBeUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVuSCxPQUFPLEVBQWdDLFFBQVEsRUFBeUIsTUFBTSxPQUFPLENBQUM7QUFDdEYsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDeEQsT0FBTyxFQUFDLDZCQUE2QixFQUFFLHlCQUF5QixFQUFFLG1CQUFtQixFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUV4STs7O0dBR0c7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBQzVCLFlBQW9CLE9BQXVCLEVBQVUsU0FBeUI7UUFBMUQsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7UUFBVSxjQUFTLEdBQVQsU0FBUyxDQUFnQjtJQUFHLENBQUM7SUFFbEY7Ozs7O09BS0c7SUFDSCxtQkFBbUIsQ0FBQyxHQUFnQztRQUNsRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO1FBQ3ZCLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUN6RCx3RkFBd0Y7UUFDeEYsOERBQThEO1FBQzlELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUM1RCxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssTUFBTSxJQUFJLE1BQU0s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SSxLQUFLLENBQUMsZUFBZSxFQUFFO1lBQzFDLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRTtnQkFDakQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7Z0JBQzVDLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbkQsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO29CQUN4QixPQUFPLFNBQVMsQ0FBQztpQkFDbEI7cUJBQU0sSUFBSSxNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO29CQUM5QyxNQUFNLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUMzQztnQkFDRCxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTO29CQUNyQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtvQkFDcEQsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztpQkFDL0M7cUJBQU07b0JBQ0wsT0FBTyxTQUFTLENBQUM7aUJBQ2xCO2FBQ0Y7U0FDRjtLQUNGO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uLCBSZWZsZWN0aW9uSG9zdCwgVHlwZVZhbHVlUmVmZXJlbmNlS2luZH0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5cbmltcG9ydCB7RGlyZWN0aXZlTWV0YSwgTWV0YWRhdGFSZWFkZXIsIE1ldGFUeXBlLCBOZ01vZHVsZU1ldGEsIFBpcGVNZXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0NsYXNzUHJvcGVydHlNYXBwaW5nfSBmcm9tICcuL3Byb3BlcnR5X21hcHBpbmcnO1xuaW1wb3J0IHtleHRyYWN0RGlyZWN0aXZlVHlwZUNoZWNrTWV0YSwgZXh0cmFjdFJlZmVyZW5jZXNGcm9tVHlwZSwgcmVhZFN0cmluZ0FycmF5VHlwZSwgcmVhZFN0cmluZ01hcFR5cGUsIHJlYWRTdHJpbmdUeXBlfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEEgYE1ldGFkYXRhUmVhZGVyYCB0aGF0IGNhbiByZWFkIG1ldGFkYXRhIGZyb20gYC5kLnRzYCBmaWxlcywgd2hpY2ggaGF2ZSBzdGF0aWMgSXZ5IHByb3BlcnRpZXNcbiAqIGZyb20gYW4gdXBzdHJlYW0gY29tcGlsYXRpb24gYWxyZWFkeS5cbiAqL1xuZXhwb3J0IGNsYXNzIER0c01ldGFkYXRhUmVhZGVyIGltcGxlbWVudHMgTWV0YWRhdGFSZWFkZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLCBwcml2YXRlIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QpIHt9XG5cbiAgLyoqXG4gICAqIFJlYWQgdGhlIG1ldGFkYXRhIGZyb20gYSBjbGFzcyB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gY29tcGlsZWQgc29tZWhvdyAoZWl0aGVyIGl0J3MgaW4gYSAuZC50c1xuICAgKiBmaWxlLCBvciBpbiBhIC50cyBmaWxlIHdpdGggYSBoYW5kd3JpdHRlbiBkZWZpbml0aW9uKS5cbiAgICpcbiAgICogQHBhcmFtIHJlZiBgUmVmZXJlbmNlYCB0byB0aGUgY2xhc3Mgb2YgaW50ZXJlc3QsIHdpdGggdGhlIGNvbnRleHQgb2YgaG93IGl0IHdhcyBvYnRhaW5lZC5cbiAgICovXG4gIGdldE5nTW9kdWxlTWV0YWRhdGEocmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4pOiBOZ01vZHVsZU1ldGF8bnVsbCB7XG4gICAgY29uc3QgY2xhenogPSByZWYubm9kZTtcbiAgICBjb25zdCByZXNvbHV0aW9uQ29udGV4dCA9IGNsYXp6LmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZTtcbiAgICAvLyBUaGlzIG9wZXJhdGlvbiBpcyBleHBsaWNpdGx5IG5vdCBtZW1vaXplZCwgYXMgaXQgZGVwZW5kcyBvbiBgcmVmLm93bmVkQnlNb2R1bGVHdWVzc2AuXG4gICAgLy8gVE9ETyhhbHhodWIpOiBpbnZlc3RpZ2F0ZSBjYWNoaW5nIG9mIC5kLnRzIG1vZHVsZSBtZXRhZGF0YS5cbiAgICBjb25zdCBuZ01vZHVsZURlZiA9IHRoaXMucmVmbGVjdG9yLmdldE1lbWJlcnNPZkNsYXNzKGNsYXp6KS5maW5kKFxuICAgICAgICBtZW1iZXIgPT4gbWVtYmVyLm5hbWUgPT09ICfJtW1vZCcgJiYgbWVtYmVyLmlzU3RhdGljKTtcbiAgICBpZiAobmdNb2R1bGVEZWYgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgLy8gVmFsaWRhdGUgdGhhdCB0aGUgc2hhcGUgb2YgdGhlIG5nTW9kdWxlRGVmIHR5cGUgaXMgY29ycmVjdC5cbiAgICAgICAgbmdNb2R1bGVEZWYudHlwZSA9PT0gbnVsbCB8fCAhdHMuaXNUeXBlUmVmZXJlbmNlTm9kZShuZ01vZHVsZURlZi50eXBlKSB8fFxuICAgICAgICBuZ01vZHVsZURlZi50eXBlLnR5cGVBcmd1bWVudHMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBuZ01vZHVsZURlZi50eXBlLnR5cGVBcmd1bWVudHMubGVuZ3RoICE9PSA0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBSZWFkIHRoZSBNb2R1bGVEYXRhIG91dCBvZiB0aGUgdHlwZSBhcmd1bWVudHMuXG4gICAgY29uc3QgW18sIGRlY2xhcmF0aW9uTWV0YWRhdGEsIGltcG9ydE1ldGFkYXRhLCBleHBvcnRNZXRhZGF0YV0gPSBuZ01vZHVsZURlZi50eXBlLnR5cGVBcmd1bWVudHM7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlZixcbiAgICAgIGRlY2xhcmF0aW9uczogZXh0cmFjdFJlZmVyZW5jZXNGcm9tVHlwZShcbiAgICAgICAgICB0aGlzLmNoZWNrZXIsIGRlY2xhcmF0aW9uTWV0YWRhdGEsIHJlZi5vd25lZEJ5TW9kdWxlR3Vlc3MsIHJlc29sdXRpb25Db250ZXh0KSxcbiAgICAgIGV4cG9ydHM6IGV4dHJhY3RSZWZlcmVuY2VzRnJvbVR5cGUoXG4gICAgICAgICAgdGhpcy5jaGVja2VyLCBleHBvcnRNZXRhZGF0YSwgcmVmLm93bmVkQnlNb2R1bGVHdWVzcywgcmVzb2x1dGlvbkNvbnRleHQpLFxuICAgICAgaW1wb3J0czogZXh0cmFjdFJlZmVyZW5jZXNGcm9tVHlwZShcbiAgICAgICAgICB0aGlzLmNoZWNrZXIsIGltcG9ydE1ldGFkYXRhLCByZWYub3duZWRCeU1vZHVsZUd1ZXNzLCByZXNvbHV0aW9uQ29udGV4dCksXG4gICAgICBzY2hlbWFzOiBbXSxcbiAgICAgIHJhd0RlY2xhcmF0aW9uczogbnVsbCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgZGlyZWN0aXZlIChvciBjb21wb25lbnQpIG1ldGFkYXRhIGZyb20gYSByZWZlcmVuY2VkIGNsYXNzIGluIGEgLmQudHMgZmlsZS5cbiAgICovXG4gIGdldERpcmVjdGl2ZU1ldGFkYXRhKHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+KTogRGlyZWN0aXZlTWV0YXxudWxsIHtcbiAgICBjb25zdCBjbGF6eiA9IHJlZi5ub2RlO1xuICAgIGNvbnN0IGRlZiA9IHRoaXMucmVmbGVjdG9yLmdldE1lbWJlcnNPZkNsYXNzKGNsYXp6KS5maW5kKFxuICAgICAgICBmaWVsZCA9PiBmaWVsZC5pc1N0YXRpYyAmJiAoZmllbGQubmFtZSA9PT0gJ8m1Y21wJyB8fCBmaWVsZC5uYW1lID09PSAnybVkaXInKSk7XG4gICAgaWYgKGRlZiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBObyBkZWZpbml0aW9uIGNvdWxkIGJlIGZvdW5kLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgZGVmLnR5cGUgPT09IG51bGwgfHwgIXRzLmlzVHlwZVJlZmVyZW5jZU5vZGUoZGVmLnR5cGUpIHx8XG4gICAgICAgIGRlZi50eXBlLnR5cGVBcmd1bWVudHMgPT09IHVuZGVmaW5lZCB8fCBkZWYudHlwZS50eXBlQXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgIC8vIFRoZSB0eXBlIG1ldGFkYXRhIHdhcyB0aGUgd3Jvbmcgc2hhcGUuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBpc0NvbXBvbmVudCA9IGRlZi5uYW1lID09PSAnybVjbXAnO1xuXG4gICAgY29uc3QgY3RvclBhcmFtcyA9IHRoaXMucmVmbGVjdG9yLmdldENvbnN0cnVjdG9yUGFyYW1ldGVycyhjbGF6eik7XG5cbiAgICAvLyBBIGRpcmVjdGl2ZSBpcyBjb25zaWRlcmVkIHRvIGJlIHN0cnVjdHVyYWwgaWY6XG4gICAgLy8gMSkgaXQncyBhIGRpcmVjdGl2ZSwgbm90IGEgY29tcG9uZW50LCBhbmRcbiAgICAvLyAyKSBpdCBpbmplY3RzIGBUZW1wbGF0ZVJlZmBcbiAgICBjb25zdCBpc1N0cnVjdHVyYWwgPSAhaXNDb21wb25lbnQgJiYgY3RvclBhcmFtcyAhPT0gbnVsbCAmJiBjdG9yUGFyYW1zLnNvbWUocGFyYW0gPT4ge1xuICAgICAgcmV0dXJuIHBhcmFtLnR5cGVWYWx1ZVJlZmVyZW5jZS5raW5kID09PSBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLklNUE9SVEVEICYmXG4gICAgICAgICAgcGFyYW0udHlwZVZhbHVlUmVmZXJlbmNlLm1vZHVsZU5hbWUgPT09ICdAYW5ndWxhci9jb3JlJyAmJlxuICAgICAgICAgIHBhcmFtLnR5cGVWYWx1ZVJlZmVyZW5jZS5pbXBvcnRlZE5hbWUgPT09ICdUZW1wbGF0ZVJlZic7XG4gICAgfSk7XG5cbiAgICBjb25zdCBpbnB1dHMgPVxuICAgICAgICBDbGFzc1Byb3BlcnR5TWFwcGluZy5mcm9tTWFwcGVkT2JqZWN0KHJlYWRTdHJpbmdNYXBUeXBlKGRlZi50eXBlLnR5cGVBcmd1bWVudHNbM10pKTtcbiAgICBjb25zdCBvdXRwdXRzID1cbiAgICAgICAgQ2xhc3NQcm9wZXJ0eU1hcHBpbmcuZnJvbU1hcHBlZE9iamVjdChyZWFkU3RyaW5nTWFwVHlwZShkZWYudHlwZS50eXBlQXJndW1lbnRzWzRdKSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6IE1ldGFUeXBlLkRpcmVjdGl2ZSxcbiAgICAgIHJlZixcbiAgICAgIG5hbWU6IGNsYXp6Lm5hbWUudGV4dCxcbiAgICAgIGlzQ29tcG9uZW50LFxuICAgICAgc2VsZWN0b3I6IHJlYWRTdHJpbmdUeXBlKGRlZi50eXBlLnR5cGVBcmd1bWVudHNbMV0pLFxuICAgICAgZXhwb3J0QXM6IHJlYWRTdHJpbmdBcnJheVR5cGUoZGVmLnR5cGUudHlwZUFyZ3VtZW50c1syXSksXG4gICAgICBpbnB1dHMsXG4gICAgICBvdXRwdXRzLFxuICAgICAgcXVlcmllczogcmVhZFN0cmluZ0FycmF5VHlwZShkZWYudHlwZS50eXBlQXJndW1lbnRzWzVdKSxcbiAgICAgIC4uLmV4dHJhY3REaXJlY3RpdmVUeXBlQ2hlY2tNZXRhKGNsYXp6LCBpbnB1dHMsIHRoaXMucmVmbGVjdG9yKSxcbiAgICAgIGJhc2VDbGFzczogcmVhZEJhc2VDbGFzcyhjbGF6eiwgdGhpcy5jaGVja2VyLCB0aGlzLnJlZmxlY3RvciksXG4gICAgICBpc1BvaXNvbmVkOiBmYWxzZSxcbiAgICAgIGlzU3RydWN0dXJhbCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgcGlwZSBtZXRhZGF0YSBmcm9tIGEgcmVmZXJlbmNlZCBjbGFzcyBpbiBhIC5kLnRzIGZpbGUuXG4gICAqL1xuICBnZXRQaXBlTWV0YWRhdGEocmVmOiBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4pOiBQaXBlTWV0YXxudWxsIHtcbiAgICBjb25zdCBkZWYgPSB0aGlzLnJlZmxlY3Rvci5nZXRNZW1iZXJzT2ZDbGFzcyhyZWYubm9kZSkuZmluZChcbiAgICAgICAgZmllbGQgPT4gZmllbGQuaXNTdGF0aWMgJiYgZmllbGQubmFtZSA9PT0gJ8m1cGlwZScpO1xuICAgIGlmIChkZWYgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gTm8gZGVmaW5pdGlvbiBjb3VsZCBiZSBmb3VuZC5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGRlZi50eXBlID09PSBudWxsIHx8ICF0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKGRlZi50eXBlKSB8fFxuICAgICAgICBkZWYudHlwZS50eXBlQXJndW1lbnRzID09PSB1bmRlZmluZWQgfHwgZGVmLnR5cGUudHlwZUFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgICAvLyBUaGUgdHlwZSBtZXRhZGF0YSB3YXMgdGhlIHdyb25nIHNoYXBlLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHR5cGUgPSBkZWYudHlwZS50eXBlQXJndW1lbnRzWzFdO1xuICAgIGlmICghdHMuaXNMaXRlcmFsVHlwZU5vZGUodHlwZSkgfHwgIXRzLmlzU3RyaW5nTGl0ZXJhbCh0eXBlLmxpdGVyYWwpKSB7XG4gICAgICAvLyBUaGUgdHlwZSBtZXRhZGF0YSB3YXMgdGhlIHdyb25nIHR5cGUuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbmFtZSA9IHR5cGUubGl0ZXJhbC50ZXh0O1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiBNZXRhVHlwZS5QaXBlLFxuICAgICAgcmVmLFxuICAgICAgbmFtZSxcbiAgICAgIG5hbWVFeHByOiBudWxsLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZEJhc2VDbGFzcyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbiwgY2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QpOlxuICAgIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPnwnZHluYW1pYyd8bnVsbCB7XG4gIGlmICghaXNOYW1lZENsYXNzRGVjbGFyYXRpb24oY2xhenopKSB7XG4gICAgLy8gVGVjaG5pY2FsbHkgdGhpcyBpcyBhbiBlcnJvciBpbiBhIC5kLnRzIGZpbGUsIGJ1dCBmb3IgdGhlIHB1cnBvc2VzIG9mIGZpbmRpbmcgdGhlIGJhc2UgY2xhc3NcbiAgICAvLyBpdCdzIGlnbm9yZWQuXG4gICAgcmV0dXJuIHJlZmxlY3Rvci5oYXNCYXNlQ2xhc3MoY2xhenopID8gJ2R5bmFtaWMnIDogbnVsbDtcbiAgfVxuXG4gIGlmIChjbGF6ei5oZXJpdGFnZUNsYXVzZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAoY29uc3QgY2xhdXNlIG9mIGNsYXp6Lmhlcml0YWdlQ2xhdXNlcykge1xuICAgICAgaWYgKGNsYXVzZS50b2tlbiA9PT0gdHMuU3ludGF4S2luZC5FeHRlbmRzS2V5d29yZCkge1xuICAgICAgICBjb25zdCBiYXNlRXhwciA9IGNsYXVzZS50eXBlc1swXS5leHByZXNzaW9uO1xuICAgICAgICBsZXQgc3ltYm9sID0gY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGJhc2VFeHByKTtcbiAgICAgICAgaWYgKHN5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuICdkeW5hbWljJztcbiAgICAgICAgfSBlbHNlIGlmIChzeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgICAgICAgIHN5bWJvbCA9IGNoZWNrZXIuZ2V0QWxpYXNlZFN5bWJvbChzeW1ib2wpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzeW1ib2wudmFsdWVEZWNsYXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbihzeW1ib2wudmFsdWVEZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlZmVyZW5jZShzeW1ib2wudmFsdWVEZWNsYXJhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICdkeW5hbWljJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==