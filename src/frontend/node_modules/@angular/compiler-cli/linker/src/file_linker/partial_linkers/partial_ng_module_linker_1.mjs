/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { compileNgModule } from '@angular/compiler';
import { wrapReference } from './util';
/**
 * A `PartialLinker` that is designed to process `ɵɵngDeclareNgModule()` call expressions.
 */
export class PartialNgModuleLinkerVersion1 {
    constructor(
    /**
     * If true then emit the additional declarations, imports, exports, etc in the NgModule
     * definition. These are only used by JIT compilation.
     */
    emitInline) {
        this.emitInline = emitInline;
    }
    linkPartialDeclaration(constantPool, metaObj) {
        const meta = toR3NgModuleMeta(metaObj, this.emitInline);
        const def = compileNgModule(meta);
        return def.expression;
    }
}
/**
 * Derives the `R3NgModuleMetadata` structure from the AST object.
 */
export function toR3NgModuleMeta(metaObj, emitInline) {
    const wrappedType = metaObj.getOpaque('type');
    const meta = {
        type: wrapReference(wrappedType),
        internalType: wrappedType,
        adjacentType: wrappedType,
        bootstrap: [],
        declarations: [],
        imports: [],
        exports: [],
        emitInline,
        containsForwardDecls: false,
        schemas: [],
        id: metaObj.has('id') ? metaObj.getOpaque('id') : null,
    };
    // Each of `bootstrap`, `declarations`, `imports` and `exports` are normally an array. But if any
    // of the references are not yet declared, then the arrays must be wrapped in a function to
    // prevent errors at runtime when accessing the values.
    // The following blocks of code will unwrap the arrays from such functions, because
    // `R3NgModuleMetadata` expects arrays of `R3Reference` objects.
    // Further, since the `ɵɵdefineNgModule()` will also suffer from the forward declaration problem,
    // we must update the `containsForwardDecls` property if a function wrapper was found.
    if (metaObj.has('bootstrap')) {
        const bootstrap = metaObj.getValue('bootstrap');
        if (bootstrap.isFunction()) {
            meta.containsForwardDecls = true;
            meta.bootstrap = wrapReferences(unwrapForwardRefs(bootstrap));
        }
        else
            meta.bootstrap = wrapReferences(bootstrap);
    }
    if (metaObj.has('declarations')) {
        const declarations = metaObj.getValue('declarations');
        if (declarations.isFunction()) {
            meta.containsForwardDecls = true;
            meta.declarations = wrapReferences(unwrapForwardRefs(declarations));
        }
        else
            meta.declarations = wrapReferences(declarations);
    }
    if (metaObj.has('imports')) {
        const imports = metaObj.getValue('imports');
        if (imports.isFunction()) {
            meta.containsForwardDecls = true;
            meta.imports = wrapReferences(unwrapForwardRefs(imports));
        }
        else
            meta.imports = wrapReferences(imports);
    }
    if (metaObj.has('exports')) {
        const exports = metaObj.getValue('exports');
        if (exports.isFunction()) {
            meta.containsForwardDecls = true;
            meta.exports = wrapReferences(unwrapForwardRefs(exports));
        }
        else
            meta.exports = wrapReferences(exports);
    }
    if (metaObj.has('schemas')) {
        const schemas = metaObj.getValue('schemas');
        meta.schemas = wrapReferences(schemas);
    }
    return meta;
}
/**
 * Extract an array from the body of the function.
 *
 * If `field` is `function() { return [exp1, exp2, exp3]; }` then we return `[exp1, exp2, exp3]`.
 *
 */
function unwrapForwardRefs(field) {
    return field.getFunctionReturnValue();
}
/**
 * Wrap the array of expressions into an array of R3 references.
 */
function wrapReferences(values) {
    return values.getArray().map(i => wrapReference(i.getOpaque()));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGlhbF9uZ19tb2R1bGVfbGlua2VyXzEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbGlua2VyL3NyYy9maWxlX2xpbmtlci9wYXJ0aWFsX2xpbmtlcnMvcGFydGlhbF9uZ19tb2R1bGVfbGlua2VyXzEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLGVBQWUsRUFBaUcsTUFBTSxtQkFBbUIsQ0FBQztBQU1sSixPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXJDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLDZCQUE2QjtJQUN4QztJQUNJOzs7T0FHRztJQUNLLFVBQW1CO1FBQW5CLGVBQVUsR0FBVixVQUFVLENBQVM7SUFBRyxDQUFDO0lBRW5DLHNCQUFzQixDQUNsQixZQUEwQixFQUMxQixPQUFxRDtRQUN2RCxNQUFNLElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3hELE1BQU0sR0FBRyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxPQUFPLEdBQUcsQ0FBQyxVQUFVLENBQUM7SUFDeEIsQ0FBQztDQUNGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQzVCLE9BQTBELEVBQzFELFVBQW1CO0lBQ3JCLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFOUMsTUFBTSxJQUFJLEdBQXVCO1FBQy9CLElBQUksRUFBRSxhQUFhLENBQUMsV0FBVyxDQUFDO1FBQ2hDLFlBQVksRUFBRSxXQUFXO1FBQ3pCLFlBQVksRUFBRSxXQUFXO1FBQ3pCLFNBQVMsRUFBRSxFQUFFO1FBQ2IsWUFBWSxFQUFFLEVBQUU7UUFDaEIsT0FBTyxFQUFFLEVBQUU7UUFDWCxP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QUNILFNBQVMsY0FBYyxDQUFjLE1BQTRDO0lBQy9FLE9BQU8sTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2xFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Y29tcGlsZU5nTW9kdWxlLCBDb25zdGFudFBvb2wsIFIzRGVjbGFyZU5nTW9kdWxlTWV0YWRhdGEsIFIzTmdNb2R1bGVNZXRhZGF0YSwgUjNQYXJ0aWFsRGVjbGFyYXRpb24sIFIzUmVmZXJlbmNlfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7QXN0T2JqZWN0LCBBc3RWYWx1ZX0gZnJvbSAnLi4vLi4vYXN0L2FzdF92YWx1ZSc7XG5cbmltcG9ydCB7UGFydGlhbExpbmtlcn0gZnJvbSAnLi9wYXJ0aWFsX2xpbmtlcic7XG5pbXBvcnQge3dyYXBSZWZlcmVuY2V9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQSBgUGFydGlhbExpbmtlcmAgdGhhdCBpcyBkZXNpZ25lZCB0byBwcm9jZXNzIGDJtcm1bmdEZWNsYXJlTmdNb2R1bGUoKWAgY2FsbCBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhcnRpYWxOZ01vZHVsZUxpbmtlclZlcnNpb24xPFRFeHByZXNzaW9uPiBpbXBsZW1lbnRzIFBhcnRpYWxMaW5rZXI8VEV4cHJlc3Npb24+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICAvKipcbiAgICAgICAqIElmIHRydWUgdGhlbiBlbWl0IHRoZSBhZGRpdGlvbmFsIGRlY2xhcmF0aW9ucywgaW1wb3J0cywgZXhwb3J0cywgZXRjIGluIHRoZSBOZ01vZHVsZVxuICAgICAgICogZGVmaW5pdGlvbi4gVGhlc2UgYXJlIG9ubHkgdXNlZCBieSBKSVQgY29tcGlsYXRpb24uXG4gICAgICAgKi9cbiAgICAgIHByaXZhdGUgZW1pdElubGluZTogYm9vbGVhbikge31cblxuICBsaW5rUGFydGlhbERlY2xhcmF0aW9uKFxuICAgICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgICBtZXRhT2JqOiBBc3RPYmplY3Q8UjNQYXJ0aWFsRGVjbGFyYXRpb24sIFRFeHByZXNzaW9uPik6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgbWV0YSA9IHRvUjNOZ01vZHVsZU1ldGEobWV0YU9iaiwgdGhpcy5lbWl0SW5saW5lKTtcbiAgICBjb25zdCBkZWYgPSBjb21waWxlTmdNb2R1bGUobWV0YSk7XG4gICAgcmV0dXJuIGRlZi5leHByZXNzaW9uO1xuICB9XG59XG5cbi8qKlxuICogRGVyaXZlcyB0aGUgYFIzTmdNb2R1bGVNZXRhZGF0YWAgc3RydWN0dXJlIGZyb20gdGhlIEFTVCBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b1IzTmdNb2R1bGVNZXRhPFRFeHByZXNzaW9uPihcbiAgICBtZXRhT2JqOiBBc3RPYmplY3Q8UjNEZWNsYXJlTmdNb2R1bGVNZXRhZGF0YSwgVEV4cHJlc3Npb24+LFxuICAgIGVtaXRJbmxpbmU6IGJvb2xlYW4pOiBSM05nTW9kdWxlTWV0YWRhdGEge1xuICBjb25zdCB3cmFwcGVkVHlwZSA9IG1ldGFPYmouZ2V0T3BhcXVlKCd0eXBlJyk7XG5cbiAgY29uc3QgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhID0ge1xuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2Uod3JhcHBlZFR5cGUpLFxuICAgIGludGVybmFsVHlwZTogd3JhcHBlZFR5cGUsXG4gICAgYWRqYWNlbnRUeXBlOiB3cmFwcGVkVHlwZSxcbiAgICBib290c3RyYXA6IFtdLFxuICAgIGRlY2xhcmF0aW9uczogW10sXG4gICAgaW1wb3J0czogW10sXG4gICAgZXhwb3J0czogW10sXG4gICAgZW1pdElubGluZSxcbiAgICBjb250YWluc0ZvcndhcmREZWNsczogZmFsc2UsXG4gICAgc2NoZW1hczogW10sXG4gICAgaWQ6IG1ldGFPYmouaGFzKCdpZCcpID8gbWV0YU9iai5nZXRPcGFxdWUoJ2lkJykgOiBudWxsLFxuICB9O1xuXG4gIC8vIEVhY2ggb2YgYGJvb3RzdHJhcGAsIGBkZWNsYXJhdGlvbnNgLCBgaW1wb3J0c2AgYW5kIGBleHBvcnRzYCBhcmUgbm9ybWFsbHkgYW4gYXJyYXkuIEJ1dCBpZiBhbnlcbiAgLy8gb2YgdGhlIHJlZmVyZW5jZXMgYXJlIG5vdCB5ZXQgZGVjbGFyZWQsIHRoZW4gdGhlIGFycmF5cyBtdXN0IGJlIHdyYXBwZWQgaW4gYSBmdW5jdGlvbiB0b1xuICAvLyBwcmV2ZW50IGVycm9ycyBhdCBydW50aW1lIHdoZW4gYWNjZXNzaW5nIHRoZSB2YWx1ZXMuXG5cbiAgLy8gVGhlIGZvbGxvd2luZyBibG9ja3Mgb2YgY29kZSB3aWxsIHVud3JhcCB0aGUgYXJyYXlzIGZyb20gc3VjaCBmdW5jdGlvbnMsIGJlY2F1c2VcbiAgLy8gYFIzTmdNb2R1bGVNZXRhZGF0YWAgZXhwZWN0cyBhcnJheXMgb2YgYFIzUmVmZXJlbmNlYCBvYmplY3RzLlxuXG4gIC8vIEZ1cnRoZXIsIHNpbmNlIHRoZSBgybXJtWRlZmluZU5nTW9kdWxlKClgIHdpbGwgYWxzbyBzdWZmZXIgZnJvbSB0aGUgZm9yd2FyZCBkZWNsYXJhdGlvbiBwcm9ibGVtLFxuICAvLyB3ZSBtdXN0IHVwZGF0ZSB0aGUgYGNvbnRhaW5zRm9yd2FyZERlY2xzYCBwcm9wZXJ0eSBpZiBhIGZ1bmN0aW9uIHdyYXBwZXIgd2FzIGZvdW5kLlxuXG4gIGlmIChtZXRhT2JqLmhhcygnYm9vdHN0cmFwJykpIHtcbiAgICBjb25zdCBib290c3RyYXA6IEFzdFZhbHVlPHVua25vd24sIFRFeHByZXNzaW9uPiA9IG1ldGFPYmouZ2V0VmFsdWUoJ2Jvb3RzdHJhcCcpO1xuICAgIGlmIChib290c3RyYXAuaXNGdW5jdGlvbigpKSB7XG4gICAgICBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzID0gdHJ1ZTtcbiAgICAgIG1ldGEuYm9vdHN0cmFwID0gd3JhcFJlZmVyZW5jZXModW53cmFwRm9yd2FyZFJlZnMoYm9vdHN0cmFwKSk7XG4gICAgfSBlbHNlXG4gICAgICBtZXRhLmJvb3RzdHJhcCA9IHdyYXBSZWZlcmVuY2VzKGJvb3RzdHJhcCk7XG4gIH1cblxuICBpZiAobWV0YU9iai5oYXMoJ2RlY2xhcmF0aW9ucycpKSB7XG4gICAgY29uc3QgZGVjbGFyYXRpb25zOiBBc3RWYWx1ZTx1bmtub3duLCBURXhwcmVzc2lvbj4gPSBtZXRhT2JqLmdldFZhbHVlKCdkZWNsYXJhdGlvbnMnKTtcbiAgICBpZiAoZGVjbGFyYXRpb25zLmlzRnVuY3Rpb24oKSkge1xuICAgICAgbWV0YS5jb250YWluc0ZvcndhcmREZWNscyA9IHRydWU7XG4gICAgICBtZXRhLmRlY2xhcmF0aW9ucyA9IHdyYXBSZWZlcmVuY2VzKHVud3JhcEZvcndhcmRSZWZzKGRlY2xhcmF0aW9ucykpO1xuICAgIH0gZWxzZVxuICAgICAgbWV0YS5kZWNsYXJhdGlvbnMgPSB3cmFwUmVmZXJlbmNlcyhkZWNsYXJhdGlvbnMpO1xuICB9XG5cbiAgaWYgKG1ldGFPYmouaGFzKCdpbXBvcnRzJykpIHtcbiAgICBjb25zdCBpbXBvcnRzOiBBc3RWYWx1ZTx1bmtub3duLCBURXhwcmVzc2lvbj4gPSBtZXRhT2JqLmdldFZhbHVlKCdpbXBvcnRzJyk7XG4gICAgaWYgKGltcG9ydHMuaXNGdW5jdGlvbigpKSB7XG4gICAgICBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzID0gdHJ1ZTtcbiAgICAgIG1ldGEuaW1wb3J0cyA9IHdyYXBSZWZlcmVuY2VzKHVud3JhcEZvcndhcmRSZWZzKGltcG9ydHMpKTtcbiAgICB9IGVsc2VcbiAgICAgIG1ldGEuaW1wb3J0cyA9IHdyYXBSZWZlcmVuY2VzKGltcG9ydHMpO1xuICB9XG5cbiAgaWYgKG1ldGFPYmouaGFzKCdleHBvcnRzJykpIHtcbiAgICBjb25zdCBleHBvcnRzOiBBc3RWYWx1ZTx1bmtub3duLCBURXhwcmVzc2lvbj4gPSBtZXRhT2JqLmdldFZhbHVlKCdleHBvcnRzJyk7XG4gICAgaWYgKGV4cG9ydHMuaXNGdW5jdGlvbigpKSB7XG4gICAgICBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzID0gdHJ1ZTtcbiAgICAgIG1ldGEuZXhwb3J0cyA9IHdyYXBSZWZlcmVuY2VzKHVud3JhcEZvcndhcmRSZWZzKGV4cG9ydHMpKTtcbiAgICB9IGVsc2VcbiAgICAgIG1ldGEuZXhwb3J0cyA9IHdyYXBSZWZlcmVuY2VzKGV4cG9ydHMpO1xuICB9XG5cbiAgaWYgKG1ldGFPYmouaGFzKCdzY2hlbWFzJykpIHtcbiAgICBjb25zdCBzY2hlbWFzOiBBc3RWYWx1ZTx1bmtub3duLCBURXhwcmVzc2lvbj4gPSBtZXRhT2JqLmdldFZhbHVlKCdzY2hlbWFzJyk7XG4gICAgbWV0YS5zY2hlbWFzID0gd3JhcFJlZmVyZW5jZXMoc2NoZW1hcyk7XG4gIH1cblxuICByZXR1cm4gbWV0YTtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IGFuIGFycmF5IGZyb20gdGhlIGJvZHkgb2YgdGhlIGZ1bmN0aW9uLlxuICpcbiAqIElmIGBmaWVsZGAgaXMgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW2V4cDEsIGV4cDIsIGV4cDNdOyB9YCB0aGVuIHdlIHJldHVybiBgW2V4cDEsIGV4cDIsIGV4cDNdYC5cbiAqXG4gKi9cbmZ1bmN0aW9uIHVud3JhcEZvcndhcmRSZWZzPFRFeHByZXNzaW9uPihmaWVsZDogQXN0VmFsdWU8dW5rbm93biwgVEV4cHJlc3Npb24+KTpcbiAgICBBc3RWYWx1ZTxURXhwcmVzc2lvbltdLCBURXhwcmVzc2lvbj4ge1xuICByZXR1cm4gKGZpZWxkIGFzIEFzdFZhbHVlPEZ1bmN0aW9uLCBURXhwcmVzc2lvbj4pLmdldEZ1bmN0aW9uUmV0dXJuVmFsdWUoKTtcbn1cblxuLyoqXG4gKiBXcmFwIHRoZSBhcnJheSBvZiBleHByZXNzaW9ucyBpbnRvIGFuIGFycmF5IG9mIFIzIHJlZmVyZW5jZXMuXG4gKi9cbmZ1bmN0aW9uIHdyYXBSZWZlcmVuY2VzPFRFeHByZXNzaW9uPih2YWx1ZXM6IEFzdFZhbHVlPFRFeHByZXNzaW9uW10sIFRFeHByZXNzaW9uPik6IFIzUmVmZXJlbmNlW10ge1xuICByZXR1cm4gdmFsdWVzLmdldEFycmF5KCkubWFwKGkgPT4gd3JhcFJlZmVyZW5jZShpLmdldE9wYXF1ZSgpKSk7XG59XG4iXX0=