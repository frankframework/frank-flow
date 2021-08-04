/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isRequireCall, isWildcardReexportStatement } from '../host/commonjs_umd_utils';
import { DependencyHostBase } from './dependency_host';
/**
 * Helper functions for computing dependencies.
 */
export class CommonJsDependencyHost extends DependencyHostBase {
    canSkipFile(fileContents) {
        return !hasRequireCalls(fileContents);
    }
    extractImports(file, fileContents) {
        // Parse the source into a TypeScript AST and then walk it looking for imports and re-exports.
        const sf = ts.createSourceFile(file, fileContents, ts.ScriptTarget.ES2015, false, ts.ScriptKind.JS);
        const requireCalls = [];
        for (const stmt of sf.statements) {
            if (ts.isVariableStatement(stmt)) {
                // Regular import(s):
                // `var foo = require('...')` or `var foo = require('...'), bar = require('...')`
                const declarations = stmt.declarationList.declarations;
                for (const declaration of declarations) {
                    if ((declaration.initializer !== undefined) && isRequireCall(declaration.initializer)) {
                        requireCalls.push(declaration.initializer);
                    }
                }
            }
            else if (ts.isExpressionStatement(stmt)) {
                if (isRequireCall(stmt.expression)) {
                    // Import for the side-effects only:
                    // `require('...')`
                    requireCalls.push(stmt.expression);
                }
                else if (isWildcardReexportStatement(stmt)) {
                    // Re-export in one of the following formats:
                    // - `__export(require('...'))`
                    // - `__export(<identifier>)`
                    // - `tslib_1.__exportStar(require('...'), exports)`
                    // - `tslib_1.__exportStar(<identifier>, exports)`
                    const firstExportArg = stmt.expression.arguments[0];
                    if (isRequireCall(firstExportArg)) {
                        // Re-export with `require()` call:
                        // `__export(require('...'))` or `tslib_1.__exportStar(require('...'), exports)`
                        requireCalls.push(firstExportArg);
                    }
                }
                else if (ts.isBinaryExpression(stmt.expression) &&
                    (stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken)) {
                    if (isRequireCall(stmt.expression.right)) {
                        // Import with assignment. E.g.:
                        // `exports.foo = require('...')`
                        requireCalls.push(stmt.expression.right);
                    }
                    else if (ts.isObjectLiteralExpression(stmt.expression.right)) {
                        // Import in object literal. E.g.:
                        // `module.exports = {foo: require('...')}`
                        stmt.expression.right.properties.forEach(prop => {
                            if (ts.isPropertyAssignment(prop) && isRequireCall(prop.initializer)) {
                                requireCalls.push(prop.initializer);
                            }
                        });
                    }
                }
            }
        }
        return new Set(requireCalls.map(call => call.arguments[0].text));
    }
}
/**
 * Check whether a source file needs to be parsed for imports.
 * This is a performance short-circuit, which saves us from creating
 * a TypeScript AST unnecessarily.
 *
 * @param source The content of the source file to check.
 *
 * @returns false if there are definitely no require calls
 * in this file, true otherwise.
 */
export function hasRequireCalls(source) {
    return /require\(['"]/.test(source);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uanNfZGVwZW5kZW5jeV9ob3N0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2RlcGVuZGVuY2llcy9jb21tb25qc19kZXBlbmRlbmN5X2hvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFHakMsT0FBTyxFQUFDLGFBQWEsRUFBRSwyQkFBMkIsRUFBYyxNQUFNLDRCQUE0QixDQUFDO0FBRW5HLE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXJEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLHNCQUF1QixTQUFRLGtCQUFrQjtJQUNsRCxXQUFXLENBQUMsWUFBb0I7UUFDeEMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRVMsY0FBYyxDQUFDLElBQW9CLEVBQUUsWUFBb0I7UUFDakUsOEZBQThGO1FBQzlGLE1BQU0sRUFBRSxHQUNKLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzdGLE1BQU0sWUFBWSxHQUFrQixFQUFFLENBQUM7UUFFdkMsS0FBSyxNQUFNLElBQUksSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFO1lBQ2hDLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNoQyxxQkFBcUI7Z0JBQ3JCLGlGQUFpRjtnQkFDakYsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUM7Z0JBQ3ZELEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxFQUFFO29CQUN0QyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsS0FBSyxTQUFTLENBQUMsSUFBSSxhQUFhLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxFQUFFO3dCQUNyRixZQUFZLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztxQkFDNUM7aUJBQ0Y7YUFDRjtpQkFBTSxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDekMsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFO29CQUNsQyxvQ0FBb0M7b0JBQ3BDLG1CQUFtQjtvQkFDbkIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7aUJBQ3BDO3FCQUFNLElBQUksMkJBQTJCLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzVDLDZDQUE2QztvQkFDN0MsK0JBQStCO29CQUMvQiw2QkFBNkI7b0JBQzdCLG9EQUFvRDtvQkFDcEQsa0RBQWtEO29CQUNsRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFcEQsSUFBSSxhQUFhLENBQUMsY0FBYyxDQUFDLEVBQUU7d0JBQ2pDLG1DQUFtQzt3QkFDbkMsZ0ZBQWdGO3dCQUNoRixZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO3FCQUNuQztpQkFDRjtxQkFBTSxJQUNILEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO29CQUN0QyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFO29CQUN0RSxJQUFJLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFO3dCQUN4QyxnQ0FBZ0M7d0JBQ2hDLGlDQUFpQzt3QkFDakMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO3FCQUMxQzt5QkFBTSxJQUFJLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFO3dCQUM5RCxrQ0FBa0M7d0JBQ2xDLDJDQUEyQzt3QkFDM0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTs0QkFDOUMsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRTtnQ0FDcEUsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7NkJBQ3JDO3dCQUNILENBQUMsQ0FBQyxDQUFDO3FCQUNKO2lCQUNGO2FBQ0Y7U0FDRjtRQUVELE9BQU8sSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNuRSxDQUFDO0NBQ0Y7QUFFRDs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUFDLE1BQWM7SUFDNUMsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0Fic29sdXRlRnNQYXRofSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtpc1JlcXVpcmVDYWxsLCBpc1dpbGRjYXJkUmVleHBvcnRTdGF0ZW1lbnQsIFJlcXVpcmVDYWxsfSBmcm9tICcuLi9ob3N0L2NvbW1vbmpzX3VtZF91dGlscyc7XG5cbmltcG9ydCB7RGVwZW5kZW5jeUhvc3RCYXNlfSBmcm9tICcuL2RlcGVuZGVuY3lfaG9zdCc7XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGRlcGVuZGVuY2llcy5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbW1vbkpzRGVwZW5kZW5jeUhvc3QgZXh0ZW5kcyBEZXBlbmRlbmN5SG9zdEJhc2Uge1xuICBwcm90ZWN0ZWQgY2FuU2tpcEZpbGUoZmlsZUNvbnRlbnRzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gIWhhc1JlcXVpcmVDYWxscyhmaWxlQ29udGVudHMpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGV4dHJhY3RJbXBvcnRzKGZpbGU6IEFic29sdXRlRnNQYXRoLCBmaWxlQ29udGVudHM6IHN0cmluZyk6IFNldDxzdHJpbmc+IHtcbiAgICAvLyBQYXJzZSB0aGUgc291cmNlIGludG8gYSBUeXBlU2NyaXB0IEFTVCBhbmQgdGhlbiB3YWxrIGl0IGxvb2tpbmcgZm9yIGltcG9ydHMgYW5kIHJlLWV4cG9ydHMuXG4gICAgY29uc3Qgc2YgPVxuICAgICAgICB0cy5jcmVhdGVTb3VyY2VGaWxlKGZpbGUsIGZpbGVDb250ZW50cywgdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNSwgZmFsc2UsIHRzLlNjcmlwdEtpbmQuSlMpO1xuICAgIGNvbnN0IHJlcXVpcmVDYWxsczogUmVxdWlyZUNhbGxbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzdG10IG9mIHNmLnN0YXRlbWVudHMpIHtcbiAgICAgIGlmICh0cy5pc1ZhcmlhYmxlU3RhdGVtZW50KHN0bXQpKSB7XG4gICAgICAgIC8vIFJlZ3VsYXIgaW1wb3J0KHMpOlxuICAgICAgICAvLyBgdmFyIGZvbyA9IHJlcXVpcmUoJy4uLicpYCBvciBgdmFyIGZvbyA9IHJlcXVpcmUoJy4uLicpLCBiYXIgPSByZXF1aXJlKCcuLi4nKWBcbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb25zID0gc3RtdC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zO1xuICAgICAgICBmb3IgKGNvbnN0IGRlY2xhcmF0aW9uIG9mIGRlY2xhcmF0aW9ucykge1xuICAgICAgICAgIGlmICgoZGVjbGFyYXRpb24uaW5pdGlhbGl6ZXIgIT09IHVuZGVmaW5lZCkgJiYgaXNSZXF1aXJlQ2FsbChkZWNsYXJhdGlvbi5pbml0aWFsaXplcikpIHtcbiAgICAgICAgICAgIHJlcXVpcmVDYWxscy5wdXNoKGRlY2xhcmF0aW9uLmluaXRpYWxpemVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHMuaXNFeHByZXNzaW9uU3RhdGVtZW50KHN0bXQpKSB7XG4gICAgICAgIGlmIChpc1JlcXVpcmVDYWxsKHN0bXQuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAvLyBJbXBvcnQgZm9yIHRoZSBzaWRlLWVmZmVjdHMgb25seTpcbiAgICAgICAgICAvLyBgcmVxdWlyZSgnLi4uJylgXG4gICAgICAgICAgcmVxdWlyZUNhbGxzLnB1c2goc3RtdC5leHByZXNzaW9uKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1dpbGRjYXJkUmVleHBvcnRTdGF0ZW1lbnQoc3RtdCkpIHtcbiAgICAgICAgICAvLyBSZS1leHBvcnQgaW4gb25lIG9mIHRoZSBmb2xsb3dpbmcgZm9ybWF0czpcbiAgICAgICAgICAvLyAtIGBfX2V4cG9ydChyZXF1aXJlKCcuLi4nKSlgXG4gICAgICAgICAgLy8gLSBgX19leHBvcnQoPGlkZW50aWZpZXI+KWBcbiAgICAgICAgICAvLyAtIGB0c2xpYl8xLl9fZXhwb3J0U3RhcihyZXF1aXJlKCcuLi4nKSwgZXhwb3J0cylgXG4gICAgICAgICAgLy8gLSBgdHNsaWJfMS5fX2V4cG9ydFN0YXIoPGlkZW50aWZpZXI+LCBleHBvcnRzKWBcbiAgICAgICAgICBjb25zdCBmaXJzdEV4cG9ydEFyZyA9IHN0bXQuZXhwcmVzc2lvbi5hcmd1bWVudHNbMF07XG5cbiAgICAgICAgICBpZiAoaXNSZXF1aXJlQ2FsbChmaXJzdEV4cG9ydEFyZykpIHtcbiAgICAgICAgICAgIC8vIFJlLWV4cG9ydCB3aXRoIGByZXF1aXJlKClgIGNhbGw6XG4gICAgICAgICAgICAvLyBgX19leHBvcnQocmVxdWlyZSgnLi4uJykpYCBvciBgdHNsaWJfMS5fX2V4cG9ydFN0YXIocmVxdWlyZSgnLi4uJyksIGV4cG9ydHMpYFxuICAgICAgICAgICAgcmVxdWlyZUNhbGxzLnB1c2goZmlyc3RFeHBvcnRBcmcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgIHRzLmlzQmluYXJ5RXhwcmVzc2lvbihzdG10LmV4cHJlc3Npb24pICYmXG4gICAgICAgICAgICAoc3RtdC5leHByZXNzaW9uLm9wZXJhdG9yVG9rZW4ua2luZCA9PT0gdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbikpIHtcbiAgICAgICAgICBpZiAoaXNSZXF1aXJlQ2FsbChzdG10LmV4cHJlc3Npb24ucmlnaHQpKSB7XG4gICAgICAgICAgICAvLyBJbXBvcnQgd2l0aCBhc3NpZ25tZW50LiBFLmcuOlxuICAgICAgICAgICAgLy8gYGV4cG9ydHMuZm9vID0gcmVxdWlyZSgnLi4uJylgXG4gICAgICAgICAgICByZXF1aXJlQ2FsbHMucHVzaChzdG10LmV4cHJlc3Npb24ucmlnaHQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihzdG10LmV4cHJlc3Npb24ucmlnaHQpKSB7XG4gICAgICAgICAgICAvLyBJbXBvcnQgaW4gb2JqZWN0IGxpdGVyYWwuIEUuZy46XG4gICAgICAgICAgICAvLyBgbW9kdWxlLmV4cG9ydHMgPSB7Zm9vOiByZXF1aXJlKCcuLi4nKX1gXG4gICAgICAgICAgICBzdG10LmV4cHJlc3Npb24ucmlnaHQucHJvcGVydGllcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgICAgICAgICBpZiAodHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcCkgJiYgaXNSZXF1aXJlQ2FsbChwcm9wLmluaXRpYWxpemVyKSkge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVDYWxscy5wdXNoKHByb3AuaW5pdGlhbGl6ZXIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFNldChyZXF1aXJlQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5hcmd1bWVudHNbMF0udGV4dCkpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciBhIHNvdXJjZSBmaWxlIG5lZWRzIHRvIGJlIHBhcnNlZCBmb3IgaW1wb3J0cy5cbiAqIFRoaXMgaXMgYSBwZXJmb3JtYW5jZSBzaG9ydC1jaXJjdWl0LCB3aGljaCBzYXZlcyB1cyBmcm9tIGNyZWF0aW5nXG4gKiBhIFR5cGVTY3JpcHQgQVNUIHVubmVjZXNzYXJpbHkuXG4gKlxuICogQHBhcmFtIHNvdXJjZSBUaGUgY29udGVudCBvZiB0aGUgc291cmNlIGZpbGUgdG8gY2hlY2suXG4gKlxuICogQHJldHVybnMgZmFsc2UgaWYgdGhlcmUgYXJlIGRlZmluaXRlbHkgbm8gcmVxdWlyZSBjYWxsc1xuICogaW4gdGhpcyBmaWxlLCB0cnVlIG90aGVyd2lzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc1JlcXVpcmVDYWxscyhzb3VyY2U6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL3JlcXVpcmVcXChbJ1wiXS8udGVzdChzb3VyY2UpO1xufVxuIl19