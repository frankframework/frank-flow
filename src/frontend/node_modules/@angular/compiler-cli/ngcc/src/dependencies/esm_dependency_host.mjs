/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { DependencyHostBase } from './dependency_host';
/**
 * Helper functions for computing dependencies.
 */
export class EsmDependencyHost extends DependencyHostBase {
    constructor(fs, moduleResolver, scanImportExpressions = true) {
        super(fs, moduleResolver);
        this.scanImportExpressions = scanImportExpressions;
        // By skipping trivia here we don't have to account for it in the processing below
        // It has no relevance to capturing imports.
        this.scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ true);
    }
    canSkipFile(fileContents) {
        return !hasImportOrReexportStatements(fileContents);
    }
    /**
     * Extract any import paths from imports found in the contents of this file.
     *
     * This implementation uses the TypeScript scanner, which tokenizes source code,
     * to process the string. This is halfway between working with the string directly,
     * which is too difficult due to corner cases, and parsing the string into a full
     * TypeScript Abstract Syntax Tree (AST), which ends up doing more processing than
     * is needed.
     *
     * The scanning is not trivial because we must hold state between each token since
     * the context of the token affects how it should be scanned, and the scanner does
     * not manage this for us.
     *
     * Specifically, backticked strings are particularly challenging since it is possible
     * to recursively nest backticks and TypeScript expressions within each other.
     */
    extractImports(file, fileContents) {
        const imports = new Set();
        const templateStack = [];
        let lastToken = ts.SyntaxKind.Unknown;
        let currentToken = ts.SyntaxKind.Unknown;
        const stopAtIndex = findLastPossibleImportOrReexport(fileContents);
        this.scanner.setText(fileContents);
        while ((currentToken = this.scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
            if (this.scanner.getTokenPos() > stopAtIndex) {
                break;
            }
            switch (currentToken) {
                case ts.SyntaxKind.TemplateHead:
                    // TemplateHead indicates the beginning of a backticked string
                    // Capture this in the `templateStack` to indicate we are currently processing
                    // within the static text part of a backticked string.
                    templateStack.push(currentToken);
                    break;
                case ts.SyntaxKind.OpenBraceToken:
                    if (templateStack.length > 0) {
                        // We are processing a backticked string. This indicates that we are either
                        // entering an interpolation expression or entering an object literal expression.
                        // We add it to the `templateStack` so we can track when we leave the interpolation or
                        // object literal.
                        templateStack.push(currentToken);
                    }
                    break;
                case ts.SyntaxKind.CloseBraceToken:
                    if (templateStack.length > 0) {
                        // We are processing a backticked string then this indicates that we are either
                        // leaving an interpolation expression or leaving an object literal expression.
                        const templateToken = templateStack[templateStack.length - 1];
                        if (templateToken === ts.SyntaxKind.TemplateHead) {
                            // We have hit a nested backticked string so we need to rescan it in that context
                            currentToken = this.scanner.reScanTemplateToken(/* isTaggedTemplate */ false);
                            if (currentToken === ts.SyntaxKind.TemplateTail) {
                                // We got to the end of the backticked string so pop the token that started it off
                                // the stack.
                                templateStack.pop();
                            }
                        }
                        else {
                            // We hit the end of an object-literal expression so pop the open-brace that started
                            // it off the stack.
                            templateStack.pop();
                        }
                    }
                    break;
                case ts.SyntaxKind.SlashToken:
                case ts.SyntaxKind.SlashEqualsToken:
                    if (canPrecedeARegex(lastToken)) {
                        // We have hit a slash (`/`) in a context where it could be the start of a regular
                        // expression so rescan it in that context
                        currentToken = this.scanner.reScanSlashToken();
                    }
                    break;
                case ts.SyntaxKind.ImportKeyword:
                    const importPath = this.extractImportPath();
                    if (importPath !== null) {
                        imports.add(importPath);
                    }
                    break;
                case ts.SyntaxKind.ExportKeyword:
                    const reexportPath = this.extractReexportPath();
                    if (reexportPath !== null) {
                        imports.add(reexportPath);
                    }
                    break;
            }
            lastToken = currentToken;
        }
        // Clear the text from the scanner to avoid holding on to potentially large strings of source
        // content after the scanning has completed.
        this.scanner.setText('');
        return imports;
    }
    /**
     * We have found an `import` token so now try to identify the import path.
     *
     * This method will use the current state of `this.scanner` to extract a string literal module
     * specifier. It expects that the current state of the scanner is that an `import` token has just
     * been scanned.
     *
     * The following forms of import are matched:
     *
     * * `import "module-specifier";`
     * * `import("module-specifier")`
     * * `import defaultBinding from "module-specifier";`
     * * `import defaultBinding, * as identifier from "module-specifier";`
     * * `import defaultBinding, {...} from "module-specifier";`
     * * `import * as identifier from "module-specifier";`
     * * `import {...} from "module-specifier";`
     *
     * @returns the import path or null if there is no import or it is not a string literal.
     */
    extractImportPath() {
        // Check for side-effect import
        let sideEffectImportPath = this.tryStringLiteral();
        if (sideEffectImportPath !== null) {
            return sideEffectImportPath;
        }
        let kind = this.scanner.getToken();
        // Check for dynamic import expression
        if (kind === ts.SyntaxKind.OpenParenToken) {
            return this.scanImportExpressions ? this.tryStringLiteral() : null;
        }
        // Check for defaultBinding
        if (kind === ts.SyntaxKind.Identifier) {
            // Skip default binding
            kind = this.scanner.scan();
            if (kind === ts.SyntaxKind.CommaToken) {
                // Skip comma that indicates additional import bindings
                kind = this.scanner.scan();
            }
        }
        // Check for namespace import clause
        if (kind === ts.SyntaxKind.AsteriskToken) {
            kind = this.skipNamespacedClause();
            if (kind === null) {
                return null;
            }
        }
        // Check for named imports clause
        else if (kind === ts.SyntaxKind.OpenBraceToken) {
            kind = this.skipNamedClause();
        }
        // Expect a `from` clause, if not bail out
        if (kind !== ts.SyntaxKind.FromKeyword) {
            return null;
        }
        return this.tryStringLiteral();
    }
    /**
     * We have found an `export` token so now try to identify a re-export path.
     *
     * This method will use the current state of `this.scanner` to extract a string literal module
     * specifier. It expects that the current state of the scanner is that an `export` token has
     * just been scanned.
     *
     * There are three forms of re-export that are matched:
     *
     * * `export * from '...';
     * * `export * as alias from '...';
     * * `export {...} from '...';
     */
    extractReexportPath() {
        // Skip the `export` keyword
        let token = this.scanner.scan();
        if (token === ts.SyntaxKind.AsteriskToken) {
            token = this.skipNamespacedClause();
            if (token === null) {
                return null;
            }
        }
        else if (token === ts.SyntaxKind.OpenBraceToken) {
            token = this.skipNamedClause();
        }
        // Expect a `from` clause, if not bail out
        if (token !== ts.SyntaxKind.FromKeyword) {
            return null;
        }
        return this.tryStringLiteral();
    }
    skipNamespacedClause() {
        // Skip past the `*`
        let token = this.scanner.scan();
        // Check for a `* as identifier` alias clause
        if (token === ts.SyntaxKind.AsKeyword) {
            // Skip past the `as` keyword
            token = this.scanner.scan();
            // Expect an identifier, if not bail out
            if (token !== ts.SyntaxKind.Identifier) {
                return null;
            }
            // Skip past the identifier
            token = this.scanner.scan();
        }
        return token;
    }
    skipNamedClause() {
        let braceCount = 1;
        // Skip past the initial opening brace `{`
        let token = this.scanner.scan();
        // Search for the matching closing brace `}`
        while (braceCount > 0 && token !== ts.SyntaxKind.EndOfFileToken) {
            if (token === ts.SyntaxKind.OpenBraceToken) {
                braceCount++;
            }
            else if (token === ts.SyntaxKind.CloseBraceToken) {
                braceCount--;
            }
            token = this.scanner.scan();
        }
        return token;
    }
    tryStringLiteral() {
        return this.scanner.scan() === ts.SyntaxKind.StringLiteral ? this.scanner.getTokenValue() :
            null;
    }
}
/**
 * Check whether a source file needs to be parsed for imports.
 * This is a performance short-circuit, which saves us from creating
 * a TypeScript AST unnecessarily.
 *
 * @param source The content of the source file to check.
 *
 * @returns false if there are definitely no import or re-export statements
 * in this file, true otherwise.
 */
export function hasImportOrReexportStatements(source) {
    return /(?:import|export)[\s\S]+?(["'])(?:\\\1|.)+?\1/.test(source);
}
function findLastPossibleImportOrReexport(source) {
    return Math.max(source.lastIndexOf('import'), source.lastIndexOf(' from '));
}
/**
 * Check whether the given statement is an import with a string literal module specifier.
 * @param stmt the statement node to check.
 * @returns true if the statement is an import with a string literal module specifier.
 */
export function isStringImportOrReexport(stmt) {
    return ts.isImportDeclaration(stmt) ||
        ts.isExportDeclaration(stmt) && !!stmt.moduleSpecifier &&
            ts.isStringLiteral(stmt.moduleSpecifier);
}
function canPrecedeARegex(kind) {
    switch (kind) {
        case ts.SyntaxKind.Identifier:
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.BigIntLiteral:
        case ts.SyntaxKind.RegularExpressionLiteral:
        case ts.SyntaxKind.ThisKeyword:
        case ts.SyntaxKind.PlusPlusToken:
        case ts.SyntaxKind.MinusMinusToken:
        case ts.SyntaxKind.CloseParenToken:
        case ts.SyntaxKind.CloseBracketToken:
        case ts.SyntaxKind.CloseBraceToken:
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
            return false;
        default:
            return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtX2RlcGVuZGVuY3lfaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9kZXBlbmRlbmNpZXMvZXNtX2RlcGVuZGVuY3lfaG9zdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUdyRDs7R0FFRztBQUNILE1BQU0sT0FBTyxpQkFBa0IsU0FBUSxrQkFBa0I7SUFDdkQsWUFDSSxFQUFzQixFQUFFLGNBQThCLEVBQzlDLHdCQUF3QixJQUFJO1FBQ3RDLEtBQUssQ0FBQyxFQUFFLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFEaEIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUFPO1FBR3hDLGtGQUFrRjtRQUNsRiw0Q0FBNEM7UUFDcEMsWUFBTyxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFIbEYsQ0FBQztJQUtTLFdBQVcsQ0FBQyxZQUFvQjtRQUN4QyxPQUFPLENBQUMsNkJBQTZCLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7T0FlRztJQUNPLGNBQWMsQ0FBQyxJQUFvQixFQUFFLFlBQW9CO1FBQ2pFLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDbEMsTUFBTSxhQUFhLEdBQW9CLEVBQUUsQ0FBQztRQUMxQyxJQUFJLFNBQVMsR0FBa0IsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFDckQsSUFBSSxZQUFZLEdBQWtCLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO1FBQ3hELE1BQU0sV0FB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LFdBQVcsQ0FBQztRQUMvQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWTtZQUM3QixPQUFPLEtBQUssQ0FBQztRQUNmO1lBQ0UsT0FBTyxJQUFJLENBQUM7S0FDZjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtBYnNvbHV0ZUZzUGF0aCwgUmVhZG9ubHlGaWxlU3lzdGVtfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtEZXBlbmRlbmN5SG9zdEJhc2V9IGZyb20gJy4vZGVwZW5kZW5jeV9ob3N0JztcbmltcG9ydCB7TW9kdWxlUmVzb2x2ZXJ9IGZyb20gJy4vbW9kdWxlX3Jlc29sdmVyJztcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgZGVwZW5kZW5jaWVzLlxuICovXG5leHBvcnQgY2xhc3MgRXNtRGVwZW5kZW5jeUhvc3QgZXh0ZW5kcyBEZXBlbmRlbmN5SG9zdEJhc2Uge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIGZzOiBSZWFkb25seUZpbGVTeXN0ZW0sIG1vZHVsZVJlc29sdmVyOiBNb2R1bGVSZXNvbHZlcixcbiAgICAgIHByaXZhdGUgc2NhbkltcG9ydEV4cHJlc3Npb25zID0gdHJ1ZSkge1xuICAgIHN1cGVyKGZzLCBtb2R1bGVSZXNvbHZlcik7XG4gIH1cbiAgLy8gQnkgc2tpcHBpbmcgdHJpdmlhIGhlcmUgd2UgZG9uJ3QgaGF2ZSB0byBhY2NvdW50IGZvciBpdCBpbiB0aGUgcHJvY2Vzc2luZyBiZWxvd1xuICAvLyBJdCBoYXMgbm8gcmVsZXZhbmNlIHRvIGNhcHR1cmluZyBpbXBvcnRzLlxuICBwcml2YXRlIHNjYW5uZXIgPSB0cy5jcmVhdGVTY2FubmVyKHRzLlNjcmlwdFRhcmdldC5MYXRlc3QsIC8qIHNraXBUcml2aWEgKi8gdHJ1ZSk7XG5cbiAgcHJvdGVjdGVkIGNhblNraXBGaWxlKGZpbGVDb250ZW50czogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICFoYXNJbXBvcnRPclJlZXhwb3J0U3RhdGVtZW50cyhmaWxlQ29udGVudHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgYW55IGltcG9ydCBwYXRocyBmcm9tIGltcG9ydHMgZm91bmQgaW4gdGhlIGNvbnRlbnRzIG9mIHRoaXMgZmlsZS5cbiAgICpcbiAgICogVGhpcyBpbXBsZW1lbnRhdGlvbiB1c2VzIHRoZSBUeXBlU2NyaXB0IHNjYW5uZXIsIHdoaWNoIHRva2VuaXplcyBzb3VyY2UgY29kZSxcbiAgICogdG8gcHJvY2VzcyB0aGUgc3RyaW5nLiBUaGlzIGlzIGhhbGZ3YXkgYmV0d2VlbiB3b3JraW5nIHdpdGggdGhlIHN0cmluZyBkaXJlY3RseSxcbiAgICogd2hpY2ggaXMgdG9vIGRpZmZpY3VsdCBkdWUgdG8gY29ybmVyIGNhc2VzLCBhbmQgcGFyc2luZyB0aGUgc3RyaW5nIGludG8gYSBmdWxsXG4gICAqIFR5cGVTY3JpcHQgQWJzdHJhY3QgU3ludGF4IFRyZWUgKEFTVCksIHdoaWNoIGVuZHMgdXAgZG9pbmcgbW9yZSBwcm9jZXNzaW5nIHRoYW5cbiAgICogaXMgbmVlZGVkLlxuICAgKlxuICAgKiBUaGUgc2Nhbm5pbmcgaXMgbm90IHRyaXZpYWwgYmVjYXVzZSB3ZSBtdXN0IGhvbGQgc3RhdGUgYmV0d2VlbiBlYWNoIHRva2VuIHNpbmNlXG4gICAqIHRoZSBjb250ZXh0IG9mIHRoZSB0b2tlbiBhZmZlY3RzIGhvdyBpdCBzaG91bGQgYmUgc2Nhbm5lZCwgYW5kIHRoZSBzY2FubmVyIGRvZXNcbiAgICogbm90IG1hbmFnZSB0aGlzIGZvciB1cy5cbiAgICpcbiAgICogU3BlY2lmaWNhbGx5LCBiYWNrdGlja2VkIHN0cmluZ3MgYXJlIHBhcnRpY3VsYXJseSBjaGFsbGVuZ2luZyBzaW5jZSBpdCBpcyBwb3NzaWJsZVxuICAgKiB0byByZWN1cnNpdmVseSBuZXN0IGJhY2t0aWNrcyBhbmQgVHlwZVNjcmlwdCBleHByZXNzaW9ucyB3aXRoaW4gZWFjaCBvdGhlci5cbiAgICovXG4gIHByb3RlY3RlZCBleHRyYWN0SW1wb3J0cyhmaWxlOiBBYnNvbHV0ZUZzUGF0aCwgZmlsZUNvbnRlbnRzOiBzdHJpbmcpOiBTZXQ8c3RyaW5nPiB7XG4gICAgY29uc3QgaW1wb3J0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IHRlbXBsYXRlU3RhY2s6IHRzLlN5bnRheEtpbmRbXSA9IFtdO1xuICAgIGxldCBsYXN0VG9rZW46IHRzLlN5bnRheEtpbmQgPSB0cy5TeW50YXhLaW5kLlVua25vd247XG4gICAgbGV0IGN1cnJlbnRUb2tlbjogdHMuU3ludGF4S2luZCA9IHRzLlN5bnRheEtpbmQuVW5rbm93bjtcbiAgICBjb25zdCBzdG9wQXRJbmRleCA9IGZpbmRMYXN0UG9zc2libGVJbXBvcnRPclJlZXhwb3J0KGZpbGVDb250ZW50cyk7XG5cbiAgICB0aGlzLnNjYW5uZXIuc2V0VGV4dChmaWxlQ29udGVudHMpO1xuXG4gICAgd2hpbGUgKChjdXJyZW50VG9rZW4gPSB0aGlzLnNjYW5uZXIuc2NhbigpKSAhPT0gdHMuU3ludGF4S2luZC5FbmRPZkZpbGVUb2tlbikge1xuICAgICAgaWYgKHRoaXMuc2Nhbm5lci5nZXRUb2tlblBvcygpID4gc3RvcEF0SW5kZXgpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBzd2l0Y2ggKGN1cnJlbnRUb2tlbikge1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVGVtcGxhdGVIZWFkOlxuICAgICAgICAgIC8vIFRlbXBsYXRlSGVhZCBpbmRpY2F0ZXMgdGhlIGJlZ2lubmluZyBvZiBhIGJhY2t0aWNrZWQgc3RyaW5nXG4gICAgICAgICAgLy8gQ2FwdHVyZSB0aGlzIGluIHRoZSBgdGVtcGxhdGVTdGFja2AgdG8gaW5kaWNhdGUgd2UgYXJlIGN1cnJlbnRseSBwcm9jZXNzaW5nXG4gICAgICAgICAgLy8gd2l0aGluIHRoZSBzdGF0aWMgdGV4dCBwYXJ0IG9mIGEgYmFja3RpY2tlZCBzdHJpbmcuXG4gICAgICAgICAgdGVtcGxhdGVTdGFjay5wdXNoKGN1cnJlbnRUb2tlbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5PcGVuQnJhY2VUb2tlbjpcbiAgICAgICAgICBpZiAodGVtcGxhdGVTdGFjay5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBXZSBhcmUgcHJvY2Vzc2luZyBhIGJhY2t0aWNrZWQgc3RyaW5nLiBUaGlzIGluZGljYXRlcyB0aGF0IHdlIGFyZSBlaXRoZXJcbiAgICAgICAgICAgIC8vIGVudGVyaW5nIGFuIGludGVycG9sYXRpb24gZXhwcmVzc2lvbiBvciBlbnRlcmluZyBhbiBvYmplY3QgbGl0ZXJhbCBleHByZXNzaW9uLlxuICAgICAgICAgICAgLy8gV2UgYWRkIGl0IHRvIHRoZSBgdGVtcGxhdGVTdGFja2Agc28gd2UgY2FuIHRyYWNrIHdoZW4gd2UgbGVhdmUgdGhlIGludGVycG9sYXRpb24gb3JcbiAgICAgICAgICAgIC8vIG9iamVjdCBsaXRlcmFsLlxuICAgICAgICAgICAgdGVtcGxhdGVTdGFjay5wdXNoKGN1cnJlbnRUb2tlbik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ2xvc2VCcmFjZVRva2VuOlxuICAgICAgICAgIGlmICh0ZW1wbGF0ZVN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIFdlIGFyZSBwcm9jZXNzaW5nIGEgYmFja3RpY2tlZCBzdHJpbmcgdGhlbiB0aGlzIGluZGljYXRlcyB0aGF0IHdlIGFyZSBlaXRoZXJcbiAgICAgICAgICAgIC8vIGxlYXZpbmcgYW4gaW50ZXJwb2xhdGlvbiBleHByZXNzaW9uIG9yIGxlYXZpbmcgYW4gb2JqZWN0IGxpdGVyYWwgZXhwcmVzc2lvbi5cbiAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlVG9rZW4gPSB0ZW1wbGF0ZVN0YWNrW3RlbXBsYXRlU3RhY2subGVuZ3RoIC0gMV07XG4gICAgICAgICAgICBpZiAodGVtcGxhdGVUb2tlbiA9PT0gdHMuU3ludGF4S2luZC5UZW1wbGF0ZUhlYWQpIHtcbiAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBoaXQgYSBuZXN0ZWQgYmFja3RpY2tlZCBzdHJpbmcgc28gd2UgbmVlZCB0byByZXNjYW4gaXQgaW4gdGhhdCBjb250ZXh0XG4gICAgICAgICAgICAgIGN1cnJlbnRUb2tlbiA9IHRoaXMuc2Nhbm5lci5yZVNjYW5UZW1wbGF0ZVRva2VuKC8qIGlzVGFnZ2VkVGVtcGxhdGUgKi8gZmFsc2UpO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFRva2VuID09PSB0cy5TeW50YXhLaW5kLlRlbXBsYXRlVGFpbCkge1xuICAgICAgICAgICAgICAgIC8vIFdlIGdvdCB0byB0aGUgZW5kIG9mIHRoZSBiYWNrdGlja2VkIHN0cmluZyBzbyBwb3AgdGhlIHRva2VuIHRoYXQgc3RhcnRlZCBpdCBvZmZcbiAgICAgICAgICAgICAgICAvLyB0aGUgc3RhY2suXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVTdGFjay5wb3AoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gV2UgaGl0IHRoZSBlbmQgb2YgYW4gb2JqZWN0LWxpdGVyYWwgZXhwcmVzc2lvbiBzbyBwb3AgdGhlIG9wZW4tYnJhY2UgdGhhdCBzdGFydGVkXG4gICAgICAgICAgICAgIC8vIGl0IG9mZiB0aGUgc3RhY2suXG4gICAgICAgICAgICAgIHRlbXBsYXRlU3RhY2sucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuU2xhc2hUb2tlbjpcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlNsYXNoRXF1YWxzVG9rZW46XG4gICAgICAgICAgaWYgKGNhblByZWNlZGVBUmVnZXgobGFzdFRva2VuKSkge1xuICAgICAgICAgICAgLy8gV2UgaGF2ZSBoaXQgYSBzbGFzaCAoYC9gKSBpbiBhIGNvbnRleHQgd2hlcmUgaXQgY291bGQgYmUgdGhlIHN0YXJ0IG9mIGEgcmVndWxhclxuICAgICAgICAgICAgLy8gZXhwcmVzc2lvbiBzbyByZXNjYW4gaXQgaW4gdGhhdCBjb250ZXh0XG4gICAgICAgICAgICBjdXJyZW50VG9rZW4gPSB0aGlzLnNjYW5uZXIucmVTY2FuU2xhc2hUb2tlbigpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkltcG9ydEtleXdvcmQ6XG4gICAgICAgICAgY29uc3QgaW1wb3J0UGF0aCA9IHRoaXMuZXh0cmFjdEltcG9ydFBhdGgoKTtcbiAgICAgICAgICBpZiAoaW1wb3J0UGF0aCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaW1wb3J0cy5hZGQoaW1wb3J0UGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRXhwb3J0S2V5d29yZDpcbiAgICAgICAgICBjb25zdCByZWV4cG9ydFBhdGggPSB0aGlzLmV4dHJhY3RSZWV4cG9ydFBhdGgoKTtcbiAgICAgICAgICBpZiAocmVleHBvcnRQYXRoICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpbXBvcnRzLmFkZChyZWV4cG9ydFBhdGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGxhc3RUb2tlbiA9IGN1cnJlbnRUb2tlbjtcbiAgICB9XG5cbiAgICAvLyBDbGVhciB0aGUgdGV4dCBmcm9tIHRoZSBzY2FubmVyIHRvIGF2b2lkIGhvbGRpbmcgb24gdG8gcG90ZW50aWFsbHkgbGFyZ2Ugc3RyaW5ncyBvZiBzb3VyY2VcbiAgICAvLyBjb250ZW50IGFmdGVyIHRoZSBzY2FubmluZyBoYXMgY29tcGxldGVkLlxuICAgIHRoaXMuc2Nhbm5lci5zZXRUZXh0KCcnKTtcblxuICAgIHJldHVybiBpbXBvcnRzO1xuICB9XG5cblxuICAvKipcbiAgICogV2UgaGF2ZSBmb3VuZCBhbiBgaW1wb3J0YCB0b2tlbiBzbyBub3cgdHJ5IHRvIGlkZW50aWZ5IHRoZSBpbXBvcnQgcGF0aC5cbiAgICpcbiAgICogVGhpcyBtZXRob2Qgd2lsbCB1c2UgdGhlIGN1cnJlbnQgc3RhdGUgb2YgYHRoaXMuc2Nhbm5lcmAgdG8gZXh0cmFjdCBhIHN0cmluZyBsaXRlcmFsIG1vZHVsZVxuICAgKiBzcGVjaWZpZXIuIEl0IGV4cGVjdHMgdGhhdCB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgc2Nhbm5lciBpcyB0aGF0IGFuIGBpbXBvcnRgIHRva2VuIGhhcyBqdXN0XG4gICAqIGJlZW4gc2Nhbm5lZC5cbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBmb3JtcyBvZiBpbXBvcnQgYXJlIG1hdGNoZWQ6XG4gICAqXG4gICAqICogYGltcG9ydCBcIm1vZHVsZS1zcGVjaWZpZXJcIjtgXG4gICAqICogYGltcG9ydChcIm1vZHVsZS1zcGVjaWZpZXJcIilgXG4gICAqICogYGltcG9ydCBkZWZhdWx0QmluZGluZyBmcm9tIFwibW9kdWxlLXNwZWNpZmllclwiO2BcbiAgICogKiBgaW1wb3J0IGRlZmF1bHRCaW5kaW5nLCAqIGFzIGlkZW50aWZpZXIgZnJvbSBcIm1vZHVsZS1zcGVjaWZpZXJcIjtgXG4gICAqICogYGltcG9ydCBkZWZhdWx0QmluZGluZywgey4uLn0gZnJvbSBcIm1vZHVsZS1zcGVjaWZpZXJcIjtgXG4gICAqICogYGltcG9ydCAqIGFzIGlkZW50aWZpZXIgZnJvbSBcIm1vZHVsZS1zcGVjaWZpZXJcIjtgXG4gICAqICogYGltcG9ydCB7Li4ufSBmcm9tIFwibW9kdWxlLXNwZWNpZmllclwiO2BcbiAgICpcbiAgICogQHJldHVybnMgdGhlIGltcG9ydCBwYXRoIG9yIG51bGwgaWYgdGhlcmUgaXMgbm8gaW1wb3J0IG9yIGl0IGlzIG5vdCBhIHN0cmluZyBsaXRlcmFsLlxuICAgKi9cbiAgcHJvdGVjdGVkIGV4dHJhY3RJbXBvcnRQYXRoKCk6IHN0cmluZ3xudWxsIHtcbiAgICAvLyBDaGVjayBmb3Igc2lkZS1lZmZlY3QgaW1wb3J0XG4gICAgbGV0IHNpZGVFZmZlY3RJbXBvcnRQYXRoID0gdGhpcy50cnlTdHJpbmdMaXRlcmFsKCk7XG4gICAgaWYgKHNpZGVFZmZlY3RJbXBvcnRQYXRoICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gc2lkZUVmZmVjdEltcG9ydFBhdGg7XG4gICAgfVxuXG4gICAgbGV0IGtpbmQ6IHRzLlN5bnRheEtpbmR8bnVsbCA9IHRoaXMuc2Nhbm5lci5nZXRUb2tlbigpO1xuXG4gICAgLy8gQ2hlY2sgZm9yIGR5bmFtaWMgaW1wb3J0IGV4cHJlc3Npb25cbiAgICBpZiAoa2luZCA9PT0gdHMuU3ludGF4S2luZC5PcGVuUGFyZW5Ub2tlbikge1xuICAgICAgcmV0dXJuIHRoaXMuc2NhbkltcG9ydEV4cHJlc3Npb25zID8gdGhpcy50cnlTdHJpbmdMaXRlcmFsKCkgOiBudWxsO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGZvciBkZWZhdWx0QmluZGluZ1xuICAgIGlmIChraW5kID09PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgIC8vIFNraXAgZGVmYXVsdCBiaW5kaW5nXG4gICAgICBraW5kID0gdGhpcy5zY2FubmVyLnNjYW4oKTtcbiAgICAgIGlmIChraW5kID09PSB0cy5TeW50YXhLaW5kLkNvbW1hVG9rZW4pIHtcbiAgICAgICAgLy8gU2tpcCBjb21tYSB0aGF0IGluZGljYXRlcyBhZGRpdGlvbmFsIGltcG9ydCBiaW5kaW5nc1xuICAgICAgICBraW5kID0gdGhpcy5zY2FubmVyLnNjYW4oKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDaGVjayBmb3IgbmFtZXNwYWNlIGltcG9ydCBjbGF1c2VcbiAgICBpZiAoa2luZCA9PT0gdHMuU3ludGF4S2luZC5Bc3Rlcmlza1Rva2VuKSB7XG4gICAgICBraW5kID0gdGhpcy5za2lwTmFtZXNwYWNlZENsYXVzZSgpO1xuICAgICAgaWYgKGtpbmQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIENoZWNrIGZvciBuYW1lZCBpbXBvcnRzIGNsYXVzZVxuICAgIGVsc2UgaWYgKGtpbmQgPT09IHRzLlN5bnRheEtpbmQuT3BlbkJyYWNlVG9rZW4pIHtcbiAgICAgIGtpbmQgPSB0aGlzLnNraXBOYW1lZENsYXVzZSgpO1xuICAgIH1cblxuICAgIC8vIEV4cGVjdCBhIGBmcm9tYCBjbGF1c2UsIGlmIG5vdCBiYWlsIG91dFxuICAgIGlmIChraW5kICE9PSB0cy5TeW50YXhLaW5kLkZyb21LZXl3b3JkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy50cnlTdHJpbmdMaXRlcmFsKCk7XG4gIH1cblxuICAvKipcbiAgICogV2UgaGF2ZSBmb3VuZCBhbiBgZXhwb3J0YCB0b2tlbiBzbyBub3cgdHJ5IHRvIGlkZW50aWZ5IGEgcmUtZXhwb3J0IHBhdGguXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHdpbGwgdXNlIHRoZSBjdXJyZW50IHN0YXRlIG9mIGB0aGlzLnNjYW5uZXJgIHRvIGV4dHJhY3QgYSBzdHJpbmcgbGl0ZXJhbCBtb2R1bGVcbiAgICogc3BlY2lmaWVyLiBJdCBleHBlY3RzIHRoYXQgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIHNjYW5uZXIgaXMgdGhhdCBhbiBgZXhwb3J0YCB0b2tlbiBoYXNcbiAgICoganVzdCBiZWVuIHNjYW5uZWQuXG4gICAqXG4gICAqIFRoZXJlIGFyZSB0aHJlZSBmb3JtcyBvZiByZS1leHBvcnQgdGhhdCBhcmUgbWF0Y2hlZDpcbiAgICpcbiAgICogKiBgZXhwb3J0ICogZnJvbSAnLi4uJztcbiAgICogKiBgZXhwb3J0ICogYXMgYWxpYXMgZnJvbSAnLi4uJztcbiAgICogKiBgZXhwb3J0IHsuLi59IGZyb20gJy4uLic7XG4gICAqL1xuICBwcm90ZWN0ZWQgZXh0cmFjdFJlZXhwb3J0UGF0aCgpOiBzdHJpbmd8bnVsbCB7XG4gICAgLy8gU2tpcCB0aGUgYGV4cG9ydGAga2V5d29yZFxuICAgIGxldCB0b2tlbjogdHMuU3ludGF4S2luZHxudWxsID0gdGhpcy5zY2FubmVyLnNjYW4oKTtcbiAgICBpZiAodG9rZW4gPT09IHRzLlN5bnRheEtpbmQuQXN0ZXJpc2tUb2tlbikge1xuICAgICAgdG9rZW4gPSB0aGlzLnNraXBOYW1lc3BhY2VkQ2xhdXNlKCk7XG4gICAgICBpZiAodG9rZW4gPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gdHMuU3ludGF4S2luZC5PcGVuQnJhY2VUb2tlbikge1xuICAgICAgdG9rZW4gPSB0aGlzLnNraXBOYW1lZENsYXVzZSgpO1xuICAgIH1cbiAgICAvLyBFeHBlY3QgYSBgZnJvbWAgY2xhdXNlLCBpZiBub3QgYmFpbCBvdXRcbiAgICBpZiAodG9rZW4gIT09IHRzLlN5bnRheEtpbmQuRnJvbUtleXdvcmQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy50cnlTdHJpbmdMaXRlcmFsKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgc2tpcE5hbWVzcGFjZWRDbGF1c2UoKTogdHMuU3ludGF4S2luZHxudWxsIHtcbiAgICAvLyBTa2lwIHBhc3QgdGhlIGAqYFxuICAgIGxldCB0b2tlbiA9IHRoaXMuc2Nhbm5lci5zY2FuKCk7XG4gICAgLy8gQ2hlY2sgZm9yIGEgYCogYXMgaWRlbnRpZmllcmAgYWxpYXMgY2xhdXNlXG4gICAgaWYgKHRva2VuID09PSB0cy5TeW50YXhLaW5kLkFzS2V5d29yZCkge1xuICAgICAgLy8gU2tpcCBwYXN0IHRoZSBgYXNgIGtleXdvcmRcbiAgICAgIHRva2VuID0gdGhpcy5zY2FubmVyLnNjYW4oKTtcbiAgICAgIC8vIEV4cGVjdCBhbiBpZGVudGlmaWVyLCBpZiBub3QgYmFpbCBvdXRcbiAgICAgIGlmICh0b2tlbiAhPT0gdHMuU3ludGF4S2luZC5JZGVudGlmaWVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgLy8gU2tpcCBwYXN0IHRoZSBpZGVudGlmaWVyXG4gICAgICB0b2tlbiA9IHRoaXMuc2Nhbm5lci5zY2FuKCk7XG4gICAgfVxuICAgIHJldHVybiB0b2tlbjtcbiAgfVxuXG4gIHByb3RlY3RlZCBza2lwTmFtZWRDbGF1c2UoKTogdHMuU3ludGF4S2luZCB7XG4gICAgbGV0IGJyYWNlQ291bnQgPSAxO1xuICAgIC8vIFNraXAgcGFzdCB0aGUgaW5pdGlhbCBvcGVuaW5nIGJyYWNlIGB7YFxuICAgIGxldCB0b2tlbiA9IHRoaXMuc2Nhbm5lci5zY2FuKCk7XG4gICAgLy8gU2VhcmNoIGZvciB0aGUgbWF0Y2hpbmcgY2xvc2luZyBicmFjZSBgfWBcbiAgICB3aGlsZSAoYnJhY2VDb3VudCA+IDAgJiYgdG9rZW4gIT09IHRzLlN5bnRheEtpbmQuRW5kT2ZGaWxlVG9rZW4pIHtcbiAgICAgIGlmICh0b2tlbiA9PT0gdHMuU3ludGF4S2luZC5PcGVuQnJhY2VUb2tlbikge1xuICAgICAgICBicmFjZUNvdW50Kys7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuID09PSB0cy5TeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbikge1xuICAgICAgICBicmFjZUNvdW50LS07XG4gICAgICB9XG4gICAgICB0b2tlbiA9IHRoaXMuc2Nhbm5lci5zY2FuKCk7XG4gICAgfVxuICAgIHJldHVybiB0b2tlbjtcbiAgfVxuXG4gIHByb3RlY3RlZCB0cnlTdHJpbmdMaXRlcmFsKCk6IHN0cmluZ3xudWxsIHtcbiAgICByZXR1cm4gdGhpcy5zY2FubmVyLnNjYW4oKSA9PT0gdHMuU3ludGF4S2luZC5TdHJpbmdMaXRlcmFsID8gdGhpcy5zY2FubmVyLmdldFRva2VuVmFsdWUoKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIGEgc291cmNlIGZpbGUgbmVlZHMgdG8gYmUgcGFyc2VkIGZvciBpbXBvcnRzLlxuICogVGhpcyBpcyBhIHBlcmZvcm1hbmNlIHNob3J0LWNpcmN1aXQsIHdoaWNoIHNhdmVzIHVzIGZyb20gY3JlYXRpbmdcbiAqIGEgVHlwZVNjcmlwdCBBU1QgdW5uZWNlc3NhcmlseS5cbiAqXG4gKiBAcGFyYW0gc291cmNlIFRoZSBjb250ZW50IG9mIHRoZSBzb3VyY2UgZmlsZSB0byBjaGVjay5cbiAqXG4gKiBAcmV0dXJucyBmYWxzZSBpZiB0aGVyZSBhcmUgZGVmaW5pdGVseSBubyBpbXBvcnQgb3IgcmUtZXhwb3J0IHN0YXRlbWVudHNcbiAqIGluIHRoaXMgZmlsZSwgdHJ1ZSBvdGhlcndpc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNJbXBvcnRPclJlZXhwb3J0U3RhdGVtZW50cyhzb3VyY2U6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gLyg/OmltcG9ydHxleHBvcnQpW1xcc1xcU10rPyhbXCInXSkoPzpcXFxcXFwxfC4pKz9cXDEvLnRlc3Qoc291cmNlKTtcbn1cblxuZnVuY3Rpb24gZmluZExhc3RQb3NzaWJsZUltcG9ydE9yUmVleHBvcnQoc291cmNlOiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoc291cmNlLmxhc3RJbmRleE9mKCdpbXBvcnQnKSwgc291cmNlLmxhc3RJbmRleE9mKCcgZnJvbSAnKSk7XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgZ2l2ZW4gc3RhdGVtZW50IGlzIGFuIGltcG9ydCB3aXRoIGEgc3RyaW5nIGxpdGVyYWwgbW9kdWxlIHNwZWNpZmllci5cbiAqIEBwYXJhbSBzdG10IHRoZSBzdGF0ZW1lbnQgbm9kZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHN0YXRlbWVudCBpcyBhbiBpbXBvcnQgd2l0aCBhIHN0cmluZyBsaXRlcmFsIG1vZHVsZSBzcGVjaWZpZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZ0ltcG9ydE9yUmVleHBvcnQoc3RtdDogdHMuU3RhdGVtZW50KTogc3RtdCBpcyB0cy5JbXBvcnREZWNsYXJhdGlvbiZcbiAgICB7bW9kdWxlU3BlY2lmaWVyOiB0cy5TdHJpbmdMaXRlcmFsfSB7XG4gIHJldHVybiB0cy5pc0ltcG9ydERlY2xhcmF0aW9uKHN0bXQpIHx8XG4gICAgICB0cy5pc0V4cG9ydERlY2xhcmF0aW9uKHN0bXQpICYmICEhc3RtdC5tb2R1bGVTcGVjaWZpZXIgJiZcbiAgICAgIHRzLmlzU3RyaW5nTGl0ZXJhbChzdG10Lm1vZHVsZVNwZWNpZmllcik7XG59XG5cblxuZnVuY3Rpb24gY2FuUHJlY2VkZUFSZWdleChraW5kOiB0cy5TeW50YXhLaW5kKTogYm9vbGVhbiB7XG4gIHN3aXRjaCAoa2luZCkge1xuICAgIGNhc2UgdHMuU3ludGF4S2luZC5JZGVudGlmaWVyOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5TdHJpbmdMaXRlcmFsOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5OdW1lcmljTGl0ZXJhbDpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuQmlnSW50TGl0ZXJhbDpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuUmVndWxhckV4cHJlc3Npb25MaXRlcmFsOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5UaGlzS2V5d29yZDpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuUGx1c1BsdXNUb2tlbjpcbiAgICBjYXNlIHRzLlN5bnRheEtpbmQuTWludXNNaW51c1Rva2VuOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbG9zZVBhcmVuVG9rZW46XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLkNsb3NlQnJhY2tldFRva2VuOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5DbG9zZUJyYWNlVG9rZW46XG4gICAgY2FzZSB0cy5TeW50YXhLaW5kLlRydWVLZXl3b3JkOlxuICAgIGNhc2UgdHMuU3ludGF4S2luZC5GYWxzZUtleXdvcmQ6XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB0cnVlO1xuICB9XG59XG4iXX0=