/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
export class Symbols {
    constructor(sourceFile) {
        this.sourceFile = sourceFile;
        this.references = new Map();
    }
    resolve(name, preferReference) {
        return (preferReference && this.references.get(name)) || this.symbols.get(name);
    }
    define(name, value) {
        this.symbols.set(name, value);
    }
    defineReference(name, value) {
        this.references.set(name, value);
    }
    has(name) {
        return this.symbols.has(name);
    }
    get symbols() {
        let result = this._symbols;
        if (!result) {
            result = this._symbols = new Map();
            populateBuiltins(result);
            this.buildImports();
        }
        return result;
    }
    buildImports() {
        const symbols = this._symbols;
        // Collect the imported symbols into this.symbols
        const stripQuotes = (s) => s.replace(/^['"]|['"]$/g, '');
        const visit = (node) => {
            switch (node.kind) {
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    const importEqualsDeclaration = node;
                    if (importEqualsDeclaration.moduleReference.kind ===
                        ts.SyntaxKind.ExternalModuleReference) {
                        const externalReference = importEqualsDeclaration.moduleReference;
                        if (externalReference.expression) {
                            // An `import <identifier> = require(<module-specifier>);
                            if (!externalReference.expression.parent) {
                                // The `parent` field of a node is set by the TypeScript binder (run as
                                // part of the type checker). Setting it here allows us to call `getText()`
                                // even if the `SourceFile` was not type checked (which looks for `SourceFile`
                                // in the parent chain). This doesn't damage the node as the binder unconditionally
                                // sets the parent.
                                externalReference.expression.parent = externalReference;
                                externalReference.parent = this.sourceFile;
                            }
                            const from = stripQuotes(externalReference.expression.getText());
                            symbols.set(importEqualsDeclaration.name.text, { __symbolic: 'reference', module: from });
                            break;
                        }
                    }
                    symbols.set(importEqualsDeclaration.name.text, { __symbolic: 'error', message: `Unsupported import syntax` });
                    break;
                case ts.SyntaxKind.ImportDeclaration:
                    const importDecl = node;
                    if (!importDecl.importClause) {
                        // An `import <module-specifier>` clause which does not bring symbols into scope.
                        break;
                    }
                    if (!importDecl.moduleSpecifier.parent) {
                        // See note above in the `ImportEqualDeclaration` case.
                        importDecl.moduleSpecifier.parent = importDecl;
                        importDecl.parent = this.sourceFile;
                    }
                    const from = stripQuotes(importDecl.moduleSpecifier.getText());
                    if (importDecl.importClause.name) {
                        // An `import <identifier> form <module-specifier>` clause. Record the default symbol.
                        symbols.set(importDecl.importClause.name.text, { __symbolic: 'reference', module: from, default: true });
                    }
                    const bindings = importDecl.importClause.namedBindings;
                    if (bindings) {
                        switch (bindings.kind) {
                            case ts.SyntaxKind.NamedImports:
                                // An `import { [<identifier> [, <identifier>] } from <module-specifier>` clause
                                for (const binding of bindings.elements) {
                                    symbols.set(binding.name.text, {
                                        __symbolic: 'reference',
                                        module: from,
                                        name: binding.propertyName ? binding.propertyName.text : binding.name.text
                                    });
                                }
                                break;
                            case ts.SyntaxKind.NamespaceImport:
                                // An `input * as <identifier> from <module-specifier>` clause.
                                symbols.set(bindings.name.text, { __symbolic: 'reference', module: from });
                                break;
                        }
                    }
                    break;
            }
            ts.forEachChild(node, visit);
        };
        if (this.sourceFile) {
            ts.forEachChild(this.sourceFile, visit);
        }
    }
}
function populateBuiltins(symbols) {
    // From lib.core.d.ts (all "define const")
    ['Object', 'Function', 'String', 'Number', 'Array', 'Boolean', 'Map', 'NaN', 'Infinity', 'Math',
        'Date', 'RegExp', 'Error', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError',
        'TypeError', 'URIError', 'JSON', 'ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array',
        'Uint8ClampedArray', 'Uint16Array', 'Int16Array', 'Int32Array', 'Uint32Array', 'Float32Array',
        'Float64Array']
        .forEach(name => symbols.set(name, { __symbolic: 'reference', name }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbWV0YWRhdGEvc3ltYm9scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUlqQyxNQUFNLE9BQU8sT0FBTztJQUtsQixZQUFvQixVQUF5QjtRQUF6QixlQUFVLEdBQVYsVUFBVSxDQUFlO1FBRnJDLGVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBK0MsQ0FBQztJQUU1QixDQUFDO0lBRWpELE9BQU8sQ0FBQyxJQUFZLEVBQUUsZUFBeUI7UUFDN0MsT0FBTyxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFRCxNQUFNLENBQUMsSUFBWSxFQUFFLEtBQW9CO1FBQ3ZDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQ0QsZUFBZSxDQUFDLElBQVksRUFBRSxLQUEwQztRQUN0RSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVELEdBQUcsQ0FBQyxJQUFZO1FBQ2QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsSUFBWSxPQUFPO1FBQ2pCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDM0IsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNYLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksR0FBRyxF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QUUsTUFBTTtRQUM5RixNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhO1FBQzlGLFdBQVcsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLFlBQVk7UUFDckYsbUJBQW1CLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGNBQWM7UUFDN0YsY0FBYyxDQUFDO1NBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQztBQUMzRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge01ldGFkYXRhU3ltYm9saWNSZWZlcmVuY2VFeHByZXNzaW9uLCBNZXRhZGF0YVZhbHVlfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCBjbGFzcyBTeW1ib2xzIHtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgX3N5bWJvbHMhOiBNYXA8c3RyaW5nLCBNZXRhZGF0YVZhbHVlPjtcbiAgcHJpdmF0ZSByZWZlcmVuY2VzID0gbmV3IE1hcDxzdHJpbmcsIE1ldGFkYXRhU3ltYm9saWNSZWZlcmVuY2VFeHByZXNzaW9uPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkge31cblxuICByZXNvbHZlKG5hbWU6IHN0cmluZywgcHJlZmVyUmVmZXJlbmNlPzogYm9vbGVhbik6IE1ldGFkYXRhVmFsdWV8dW5kZWZpbmVkIHtcbiAgICByZXR1cm4gKHByZWZlclJlZmVyZW5jZSAmJiB0aGlzLnJlZmVyZW5jZXMuZ2V0KG5hbWUpKSB8fCB0aGlzLnN5bWJvbHMuZ2V0KG5hbWUpO1xuICB9XG5cbiAgZGVmaW5lKG5hbWU6IHN0cmluZywgdmFsdWU6IE1ldGFkYXRhVmFsdWUpIHtcbiAgICB0aGlzLnN5bWJvbHMuc2V0KG5hbWUsIHZhbHVlKTtcbiAgfVxuICBkZWZpbmVSZWZlcmVuY2UobmFtZTogc3RyaW5nLCB2YWx1ZTogTWV0YWRhdGFTeW1ib2xpY1JlZmVyZW5jZUV4cHJlc3Npb24pIHtcbiAgICB0aGlzLnJlZmVyZW5jZXMuc2V0KG5hbWUsIHZhbHVlKTtcbiAgfVxuXG4gIGhhcyhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xzLmhhcyhuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IHN5bWJvbHMoKTogTWFwPHN0cmluZywgTWV0YWRhdGFWYWx1ZT4ge1xuICAgIGxldCByZXN1bHQgPSB0aGlzLl9zeW1ib2xzO1xuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICByZXN1bHQgPSB0aGlzLl9zeW1ib2xzID0gbmV3IE1hcDxzdHJpbmcsIE1ldGFkYXRhVmFsdWU+KCk7XG4gICAgICBwb3B1bGF0ZUJ1aWx0aW5zKHJlc3VsdCk7XG4gICAgICB0aGlzLmJ1aWxkSW1wb3J0cygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZEltcG9ydHMoKTogdm9pZCB7XG4gICAgY29uc3Qgc3ltYm9scyA9IHRoaXMuX3N5bWJvbHM7XG4gICAgLy8gQ29sbGVjdCB0aGUgaW1wb3J0ZWQgc3ltYm9scyBpbnRvIHRoaXMuc3ltYm9sc1xuICAgIGNvbnN0IHN0cmlwUXVvdGVzID0gKHM6IHN0cmluZykgPT4gcy5yZXBsYWNlKC9eWydcIl18WydcIl0kL2csICcnKTtcbiAgICBjb25zdCB2aXNpdCA9IChub2RlOiB0cy5Ob2RlKSA9PiB7XG4gICAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuSW1wb3J0RXF1YWxzRGVjbGFyYXRpb246XG4gICAgICAgICAgY29uc3QgaW1wb3J0RXF1YWxzRGVjbGFyYXRpb24gPSA8dHMuSW1wb3J0RXF1YWxzRGVjbGFyYXRpb24+bm9kZTtcbiAgICAgICAgICBpZiAoaW1wb3J0RXF1YWxzRGVjbGFyYXRpb24ubW9kdWxlUmVmZXJlbmNlLmtpbmQgPT09XG4gICAgICAgICAgICAgIHRzLlN5bnRheEtpbmQuRXh0ZXJuYWxNb2R1bGVSZWZlcmVuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVybmFsUmVmZXJlbmNlID1cbiAgICAgICAgICAgICAgICA8dHMuRXh0ZXJuYWxNb2R1bGVSZWZlcmVuY2U+aW1wb3J0RXF1YWxzRGVjbGFyYXRpb24ubW9kdWxlUmVmZXJlbmNlO1xuICAgICAgICAgICAgaWYgKGV4dGVybmFsUmVmZXJlbmNlLmV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgLy8gQW4gYGltcG9ydCA8aWRlbnRpZmllcj4gPSByZXF1aXJlKDxtb2R1bGUtc3BlY2lmaWVyPik7XG4gICAgICAgICAgICAgIGlmICghZXh0ZXJuYWxSZWZlcmVuY2UuZXhwcmVzc2lvbi5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgYHBhcmVudGAgZmllbGQgb2YgYSBub2RlIGlzIHNldCBieSB0aGUgVHlwZVNjcmlwdCBiaW5kZXIgKHJ1biBhc1xuICAgICAgICAgICAgICAgIC8vIHBhcnQgb2YgdGhlIHR5cGUgY2hlY2tlcikuIFNldHRpbmcgaXQgaGVyZSBhbGxvd3MgdXMgdG8gY2FsbCBgZ2V0VGV4dCgpYFxuICAgICAgICAgICAgICAgIC8vIGV2ZW4gaWYgdGhlIGBTb3VyY2VGaWxlYCB3YXMgbm90IHR5cGUgY2hlY2tlZCAod2hpY2ggbG9va3MgZm9yIGBTb3VyY2VGaWxlYFxuICAgICAgICAgICAgICAgIC8vIGluIHRoZSBwYXJlbnQgY2hhaW4pLiBUaGlzIGRvZXNuJ3QgZGFtYWdlIHRoZSBub2RlIGFzIHRoZSBiaW5kZXIgdW5jb25kaXRpb25hbGx5XG4gICAgICAgICAgICAgICAgLy8gc2V0cyB0aGUgcGFyZW50LlxuICAgICAgICAgICAgICAgIChleHRlcm5hbFJlZmVyZW5jZS5leHByZXNzaW9uLnBhcmVudCBhcyB0cy5Ob2RlKSA9IGV4dGVybmFsUmVmZXJlbmNlO1xuICAgICAgICAgICAgICAgIChleHRlcm5hbFJlZmVyZW5jZS5wYXJlbnQgYXMgdHMuTm9kZSkgPSB0aGlzLnNvdXJjZUZpbGU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3QgZnJvbSA9IHN0cmlwUXVvdGVzKGV4dGVybmFsUmVmZXJlbmNlLmV4cHJlc3Npb24uZ2V0VGV4dCgpKTtcbiAgICAgICAgICAgICAgc3ltYm9scy5zZXQoXG4gICAgICAgICAgICAgICAgICBpbXBvcnRFcXVhbHNEZWNsYXJhdGlvbi5uYW1lLnRleHQsIHtfX3N5bWJvbGljOiAncmVmZXJlbmNlJywgbW9kdWxlOiBmcm9tfSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBzeW1ib2xzLnNldChcbiAgICAgICAgICAgICAgaW1wb3J0RXF1YWxzRGVjbGFyYXRpb24ubmFtZS50ZXh0LFxuICAgICAgICAgICAgICB7X19zeW1ib2xpYzogJ2Vycm9yJywgbWVzc2FnZTogYFVuc3VwcG9ydGVkIGltcG9ydCBzeW50YXhgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5JbXBvcnREZWNsYXJhdGlvbjpcbiAgICAgICAgICBjb25zdCBpbXBvcnREZWNsID0gPHRzLkltcG9ydERlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgaWYgKCFpbXBvcnREZWNsLmltcG9ydENsYXVzZSkge1xuICAgICAgICAgICAgLy8gQW4gYGltcG9ydCA8bW9kdWxlLXNwZWNpZmllcj5gIGNsYXVzZSB3aGljaCBkb2VzIG5vdCBicmluZyBzeW1ib2xzIGludG8gc2NvcGUuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFpbXBvcnREZWNsLm1vZHVsZVNwZWNpZmllci5wYXJlbnQpIHtcbiAgICAgICAgICAgIC8vIFNlZSBub3RlIGFib3ZlIGluIHRoZSBgSW1wb3J0RXF1YWxEZWNsYXJhdGlvbmAgY2FzZS5cbiAgICAgICAgICAgIChpbXBvcnREZWNsLm1vZHVsZVNwZWNpZmllci5wYXJlbnQgYXMgdHMuTm9kZSkgPSBpbXBvcnREZWNsO1xuICAgICAgICAgICAgKGltcG9ydERlY2wucGFyZW50IGFzIHRzLk5vZGUpID0gdGhpcy5zb3VyY2VGaWxlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBmcm9tID0gc3RyaXBRdW90ZXMoaW1wb3J0RGVjbC5tb2R1bGVTcGVjaWZpZXIuZ2V0VGV4dCgpKTtcbiAgICAgICAgICBpZiAoaW1wb3J0RGVjbC5pbXBvcnRDbGF1c2UubmFtZSkge1xuICAgICAgICAgICAgLy8gQW4gYGltcG9ydCA8aWRlbnRpZmllcj4gZm9ybSA8bW9kdWxlLXNwZWNpZmllcj5gIGNsYXVzZS4gUmVjb3JkIHRoZSBkZWZhdWx0IHN5bWJvbC5cbiAgICAgICAgICAgIHN5bWJvbHMuc2V0KFxuICAgICAgICAgICAgICAgIGltcG9ydERlY2wuaW1wb3J0Q2xhdXNlLm5hbWUudGV4dCxcbiAgICAgICAgICAgICAgICB7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG1vZHVsZTogZnJvbSwgZGVmYXVsdDogdHJ1ZX0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBiaW5kaW5ncyA9IGltcG9ydERlY2wuaW1wb3J0Q2xhdXNlLm5hbWVkQmluZGluZ3M7XG4gICAgICAgICAgaWYgKGJpbmRpbmdzKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGJpbmRpbmdzLmtpbmQpIHtcbiAgICAgICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk5hbWVkSW1wb3J0czpcbiAgICAgICAgICAgICAgICAvLyBBbiBgaW1wb3J0IHsgWzxpZGVudGlmaWVyPiBbLCA8aWRlbnRpZmllcj5dIH0gZnJvbSA8bW9kdWxlLXNwZWNpZmllcj5gIGNsYXVzZVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYmluZGluZyBvZiAoPHRzLk5hbWVkSW1wb3J0cz5iaW5kaW5ncykuZWxlbWVudHMpIHtcbiAgICAgICAgICAgICAgICAgIHN5bWJvbHMuc2V0KGJpbmRpbmcubmFtZS50ZXh0LCB7XG4gICAgICAgICAgICAgICAgICAgIF9fc3ltYm9saWM6ICdyZWZlcmVuY2UnLFxuICAgICAgICAgICAgICAgICAgICBtb2R1bGU6IGZyb20sXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGJpbmRpbmcucHJvcGVydHlOYW1lID8gYmluZGluZy5wcm9wZXJ0eU5hbWUudGV4dCA6IGJpbmRpbmcubmFtZS50ZXh0XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5OYW1lc3BhY2VJbXBvcnQ6XG4gICAgICAgICAgICAgICAgLy8gQW4gYGlucHV0ICogYXMgPGlkZW50aWZpZXI+IGZyb20gPG1vZHVsZS1zcGVjaWZpZXI+YCBjbGF1c2UuXG4gICAgICAgICAgICAgICAgc3ltYm9scy5zZXQoXG4gICAgICAgICAgICAgICAgICAgICg8dHMuTmFtZXNwYWNlSW1wb3J0PmJpbmRpbmdzKS5uYW1lLnRleHQsXG4gICAgICAgICAgICAgICAgICAgIHtfX3N5bWJvbGljOiAncmVmZXJlbmNlJywgbW9kdWxlOiBmcm9tfSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdHMuZm9yRWFjaENoaWxkKG5vZGUsIHZpc2l0KTtcbiAgICB9O1xuICAgIGlmICh0aGlzLnNvdXJjZUZpbGUpIHtcbiAgICAgIHRzLmZvckVhY2hDaGlsZCh0aGlzLnNvdXJjZUZpbGUsIHZpc2l0KTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcG9wdWxhdGVCdWlsdGlucyhzeW1ib2xzOiBNYXA8c3RyaW5nLCBNZXRhZGF0YVZhbHVlPikge1xuICAvLyBGcm9tIGxpYi5jb3JlLmQudHMgKGFsbCBcImRlZmluZSBjb25zdFwiKVxuICBbJ09iamVjdCcsICdGdW5jdGlvbicsICdTdHJpbmcnLCAnTnVtYmVyJywgJ0FycmF5JywgJ0Jvb2xlYW4nLCAnTWFwJywgJ05hTicsICdJbmZpbml0eScsICdNYXRoJyxcbiAgICdEYXRlJywgJ1JlZ0V4cCcsICdFcnJvcicsICdFcnJvcicsICdFdmFsRXJyb3InLCAnUmFuZ2VFcnJvcicsICdSZWZlcmVuY2VFcnJvcicsICdTeW50YXhFcnJvcicsXG4gICAnVHlwZUVycm9yJywgJ1VSSUVycm9yJywgJ0pTT04nLCAnQXJyYXlCdWZmZXInLCAnRGF0YVZpZXcnLCAnSW50OEFycmF5JywgJ1VpbnQ4QXJyYXknLFxuICAgJ1VpbnQ4Q2xhbXBlZEFycmF5JywgJ1VpbnQxNkFycmF5JywgJ0ludDE2QXJyYXknLCAnSW50MzJBcnJheScsICdVaW50MzJBcnJheScsICdGbG9hdDMyQXJyYXknLFxuICAgJ0Zsb2F0NjRBcnJheSddXG4gICAgICAuZm9yRWFjaChuYW1lID0+IHN5bWJvbHMuc2V0KG5hbWUsIHtfX3N5bWJvbGljOiAncmVmZXJlbmNlJywgbmFtZX0pKTtcbn1cbiJdfQ==