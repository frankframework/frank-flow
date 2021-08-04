/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { getImportSpecifier } from '../../utils/typescript/imports';
import { isReferenceToImport } from '../../utils/typescript/symbol';
/**
 * Configures the methods that the migration should be looking for
 * and the properties from `NavigationExtras` that should be preserved.
 */
const methodConfig = new Map([
    ['navigateByUrl', new Set(['skipLocationChange', 'replaceUrl', 'state'])],
    [
        'createUrlTree', new Set([
            'relativeTo', 'queryParams', 'fragment', 'preserveQueryParams', 'queryParamsHandling',
            'preserveFragment'
        ])
    ]
]);
export function migrateLiteral(methodName, node) {
    const allowedProperties = methodConfig.get(methodName);
    if (!allowedProperties) {
        throw Error(`Attempting to migrate unconfigured method called ${methodName}.`);
    }
    const propertiesToKeep = [];
    const removedPropertyNames = [];
    node.properties.forEach(property => {
        // Only look for regular and shorthand property assignments since resolving things
        // like spread operators becomes too complicated for this migration.
        if ((ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
            (ts.isStringLiteralLike(property.name) || ts.isNumericLiteral(property.name) ||
                ts.isIdentifier(property.name))) {
            if (allowedProperties.has(property.name.text)) {
                propertiesToKeep.push(property);
            }
            else {
                removedPropertyNames.push(property.name.text);
            }
        }
        else {
            propertiesToKeep.push(property);
        }
    });
    // Don't modify the node if there's nothing to remove.
    if (removedPropertyNames.length === 0) {
        return node;
    }
    // Note that the trailing/leading spaces are necessary so the comment looks good.
    const removalComment = ` Removed unsupported properties by Angular migration: ${removedPropertyNames.join(', ')}. `;
    if (propertiesToKeep.length > 0) {
        propertiesToKeep[0] = addUniqueLeadingComment(propertiesToKeep[0], removalComment);
        return ts.createObjectLiteral(propertiesToKeep);
    }
    else {
        return addUniqueLeadingComment(ts.createObjectLiteral(propertiesToKeep), removalComment);
    }
}
export function findLiteralsToMigrate(sourceFile, typeChecker) {
    const results = new Map(Array.from(methodConfig.keys(), key => [key, new Set()]));
    const routerImport = getImportSpecifier(sourceFile, '@angular/router', 'Router');
    const seenLiterals = new Map();
    if (routerImport) {
        sourceFile.forEachChild(function visitNode(node) {
            var _a;
            // Look for calls that look like `foo.<method to migrate>` with more than one parameter.
            if (ts.isCallExpression(node) && node.arguments.length > 1 &&
                ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name) &&
                methodConfig.has(node.expression.name.text)) {
                // Check whether the type of the object on which the
                // function is called refers to the Router import.
                if (isReferenceToImport(typeChecker, node.expression.expression, routerImport)) {
                    const methodName = node.expression.name.text;
                    const parameterDeclaration = (_a = typeChecker.getTypeAtLocation(node.arguments[1]).getSymbol()) === null || _a === void 0 ? void 0 : _a.valueDeclaration;
                    // Find the source of the object literal.
                    if (parameterDeclaration && ts.isObjectLiteralExpression(parameterDeclaration)) {
                        if (!seenLiterals.has(parameterDeclaration)) {
                            results.get(methodName).add(parameterDeclaration);
                            seenLiterals.set(parameterDeclaration, methodName);
                            // If the same literal has been passed into multiple different methods, we can't
                            // migrate it, because the supported properties are different. When we detect such
                            // a case, we drop it from the results so that it gets ignored. If it's used multiple
                            // times for the same method, it can still be migrated.
                        }
                        else if (seenLiterals.get(parameterDeclaration) !== methodName) {
                            results.forEach(literals => literals.delete(parameterDeclaration));
                        }
                    }
                }
            }
            else {
                node.forEachChild(visitNode);
            }
        });
    }
    return results;
}
/** Adds a leading comment to a node, if the node doesn't have such a comment already. */
function addUniqueLeadingComment(node, comment) {
    const existingComments = ts.getSyntheticLeadingComments(node);
    // This logic is primarily to ensure that we don't add the same comment multiple
    // times when tslint runs over the same file again with outdated information.
    if (!existingComments || existingComments.every(c => c.text !== comment)) {
        return ts.addSyntheticLeadingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, comment);
    }
    return node;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy9taWdyYXRpb25zL25hdmlnYXRpb24tZXh0cmFzLW9taXNzaW9ucy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ2xFLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBRWxFOzs7R0FHRztBQUNILE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFzQjtJQUNoRCxDQUFDLGVBQWUsRUFBRSxJQUFJLEdBQUcsQ0FBUyxDQUFDLG9CQUFvQixFQUFFLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pGO1FBQ0UsZUFBZSxFQUFFLElBQUksR0FBRyxDQUFTO1lBQy9CLFlBQVksRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLHFCQUFxQixFQUFFLHFCQUFxQjtZQUNyRixrQkFBa0I7U0FDbkIsQ0FBQztLQUNIO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsTUFBTSxVQUFVLGNBQWMsQ0FDMUIsVUFBa0IsRUFBRSxJQUFnQztJQUN0RCxNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7SUFFdkQsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1FBQ3RCLE1BQU0sS0FBSyxDQUFDLG9EQUFvRCxVQUFVLEdBQUcsQ0FBQyxDQUFDO0tBQ2hGO0lBRUQsTUFBTSxnQkFBZ0IsR0FBa0MsRUFBRSxDQUFDO0lBQzNELE1BQU0sb0JBQW9CLEdBQWEsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ2pDLGtGQUFrRjtR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QUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxPQUFPLENBQUMsRUFBRTtRQUN4RSxPQUFPLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsRUFBRSxPQUFPLENBQUMsQ0FBQztLQUMzRjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtnZXRJbXBvcnRTcGVjaWZpZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvaW1wb3J0cyc7XG5pbXBvcnQge2lzUmVmZXJlbmNlVG9JbXBvcnR9IGZyb20gJy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvc3ltYm9sJztcblxuLyoqXG4gKiBDb25maWd1cmVzIHRoZSBtZXRob2RzIHRoYXQgdGhlIG1pZ3JhdGlvbiBzaG91bGQgYmUgbG9va2luZyBmb3JcbiAqIGFuZCB0aGUgcHJvcGVydGllcyBmcm9tIGBOYXZpZ2F0aW9uRXh0cmFzYCB0aGF0IHNob3VsZCBiZSBwcmVzZXJ2ZWQuXG4gKi9cbmNvbnN0IG1ldGhvZENvbmZpZyA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oW1xuICBbJ25hdmlnYXRlQnlVcmwnLCBuZXcgU2V0PHN0cmluZz4oWydza2lwTG9jYXRpb25DaGFuZ2UnLCAncmVwbGFjZVVybCcsICdzdGF0ZSddKV0sXG4gIFtcbiAgICAnY3JlYXRlVXJsVHJlZScsIG5ldyBTZXQ8c3RyaW5nPihbXG4gICAgICAncmVsYXRpdmVUbycsICdxdWVyeVBhcmFtcycsICdmcmFnbWVudCcsICdwcmVzZXJ2ZVF1ZXJ5UGFyYW1zJywgJ3F1ZXJ5UGFyYW1zSGFuZGxpbmcnLFxuICAgICAgJ3ByZXNlcnZlRnJhZ21lbnQnXG4gICAgXSlcbiAgXVxuXSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlTGl0ZXJhbChcbiAgICBtZXRob2ROYW1lOiBzdHJpbmcsIG5vZGU6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uKTogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24ge1xuICBjb25zdCBhbGxvd2VkUHJvcGVydGllcyA9IG1ldGhvZENvbmZpZy5nZXQobWV0aG9kTmFtZSk7XG5cbiAgaWYgKCFhbGxvd2VkUHJvcGVydGllcykge1xuICAgIHRocm93IEVycm9yKGBBdHRlbXB0aW5nIHRvIG1pZ3JhdGUgdW5jb25maWd1cmVkIG1ldGhvZCBjYWxsZWQgJHttZXRob2ROYW1lfS5gKTtcbiAgfVxuXG4gIGNvbnN0IHByb3BlcnRpZXNUb0tlZXA6IHRzLk9iamVjdExpdGVyYWxFbGVtZW50TGlrZVtdID0gW107XG4gIGNvbnN0IHJlbW92ZWRQcm9wZXJ0eU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHByb3BlcnR5ID0+IHtcbiAgICAvLyBPbmx5IGxvb2sgZm9yIHJlZ3VsYXIgYW5kIHNob3J0aGFuZCBwcm9wZXJ0eSBhc3NpZ25tZW50cyBzaW5jZSByZXNvbHZpbmcgdGhpbmdzXG4gICAgLy8gbGlrZSBzcHJlYWQgb3BlcmF0b3JzIGJlY29tZXMgdG9vIGNvbXBsaWNhdGVkIGZvciB0aGlzIG1pZ3JhdGlvbi5cbiAgICBpZiAoKHRzLmlzUHJvcGVydHlBc3NpZ25tZW50KHByb3BlcnR5KSB8fCB0cy5pc1Nob3J0aGFuZFByb3BlcnR5QXNzaWdubWVudChwcm9wZXJ0eSkpICYmXG4gICAgICAgICh0cy5pc1N0cmluZ0xpdGVyYWxMaWtlKHByb3BlcnR5Lm5hbWUpIHx8IHRzLmlzTnVtZXJpY0xpdGVyYWwocHJvcGVydHkubmFtZSkgfHxcbiAgICAgICAgIHRzLmlzSWRlbnRpZmllcihwcm9wZXJ0eS5uYW1lKSkpIHtcbiAgICAgIGlmIChhbGxvd2VkUHJvcGVydGllcy5oYXMocHJvcGVydHkubmFtZS50ZXh0KSkge1xuICAgICAgICBwcm9wZXJ0aWVzVG9LZWVwLnB1c2gocHJvcGVydHkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlZFByb3BlcnR5TmFtZXMucHVzaChwcm9wZXJ0eS5uYW1lLnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBwcm9wZXJ0aWVzVG9LZWVwLnB1c2gocHJvcGVydHkpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gRG9uJ3QgbW9kaWZ5IHRoZSBub2RlIGlmIHRoZXJlJ3Mgbm90aGluZyB0byByZW1vdmUuXG4gIGlmIChyZW1vdmVkUHJvcGVydHlOYW1lcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIC8vIE5vdGUgdGhhdCB0aGUgdHJhaWxpbmcvbGVhZGluZyBzcGFjZXMgYXJlIG5lY2Vzc2FyeSBzbyB0aGUgY29tbWVudCBsb29rcyBnb29kLlxuICBjb25zdCByZW1vdmFsQ29tbWVudCA9XG4gICAgICBgIFJlbW92ZWQgdW5zdXBwb3J0ZWQgcHJvcGVydGllcyBieSBBbmd1bGFyIG1pZ3JhdGlvbjogJHtyZW1vdmVkUHJvcGVydHlOYW1lcy5qb2luKCcsICcpfS4gYDtcblxuICBpZiAocHJvcGVydGllc1RvS2VlcC5sZW5ndGggPiAwKSB7XG4gICAgcHJvcGVydGllc1RvS2VlcFswXSA9IGFkZFVuaXF1ZUxlYWRpbmdDb21tZW50KHByb3BlcnRpZXNUb0tlZXBbMF0sIHJlbW92YWxDb21tZW50KTtcbiAgICByZXR1cm4gdHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChwcm9wZXJ0aWVzVG9LZWVwKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYWRkVW5pcXVlTGVhZGluZ0NvbW1lbnQodHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChwcm9wZXJ0aWVzVG9LZWVwKSwgcmVtb3ZhbENvbW1lbnQpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaW5kTGl0ZXJhbHNUb01pZ3JhdGUoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKSB7XG4gIGNvbnN0IHJlc3VsdHMgPSBuZXcgTWFwPHN0cmluZywgU2V0PHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uPj4oXG4gICAgICBBcnJheS5mcm9tKG1ldGhvZENvbmZpZy5rZXlzKCksIGtleSA9PiBba2V5LCBuZXcgU2V0KCldKSk7XG4gIGNvbnN0IHJvdXRlckltcG9ydCA9IGdldEltcG9ydFNwZWNpZmllcihzb3VyY2VGaWxlLCAnQGFuZ3VsYXIvcm91dGVyJywgJ1JvdXRlcicpO1xuICBjb25zdCBzZWVuTGl0ZXJhbHMgPSBuZXcgTWFwPHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uLCBzdHJpbmc+KCk7XG5cbiAgaWYgKHJvdXRlckltcG9ydCkge1xuICAgIHNvdXJjZUZpbGUuZm9yRWFjaENoaWxkKGZ1bmN0aW9uIHZpc2l0Tm9kZShub2RlOiB0cy5Ob2RlKSB7XG4gICAgICAvLyBMb29rIGZvciBjYWxscyB0aGF0IGxvb2sgbGlrZSBgZm9vLjxtZXRob2QgdG8gbWlncmF0ZT5gIHdpdGggbW9yZSB0aGFuIG9uZSBwYXJhbWV0ZXIuXG4gICAgICBpZiAodHMuaXNDYWxsRXhwcmVzc2lvbihub2RlKSAmJiBub2RlLmFyZ3VtZW50cy5sZW5ndGggPiAxICYmXG4gICAgICAgICAgdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24obm9kZS5leHByZXNzaW9uKSAmJiB0cy5pc0lkZW50aWZpZXIobm9kZS5leHByZXNzaW9uLm5hbWUpICYmXG4gICAgICAgICAgbWV0aG9kQ29uZmlnLmhhcyhub2RlLmV4cHJlc3Npb24ubmFtZS50ZXh0KSkge1xuICAgICAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSB0eXBlIG9mIHRoZSBvYmplY3Qgb24gd2hpY2ggdGhlXG4gICAgICAgIC8vIGZ1bmN0aW9uIGlzIGNhbGxlZCByZWZlcnMgdG8gdGhlIFJvdXRlciBpbXBvcnQuXG4gICAgICAgIGlmIChpc1JlZmVyZW5jZVRvSW1wb3J0KHR5cGVDaGVja2VyLCBub2RlLmV4cHJlc3Npb24uZXhwcmVzc2lvbiwgcm91dGVySW1wb3J0KSkge1xuICAgICAgICAgIGNvbnN0IG1ldGhvZE5hbWUgPSBub2RlLmV4cHJlc3Npb24ubmFtZS50ZXh0O1xuICAgICAgICAgIGNvbnN0IHBhcmFtZXRlckRlY2xhcmF0aW9uID1cbiAgICAgICAgICAgICAgdHlwZUNoZWNrZXIuZ2V0VHlwZUF0TG9jYXRpb24obm9kZS5hcmd1bWVudHNbMV0pLmdldFN5bWJvbCgpPy52YWx1ZURlY2xhcmF0aW9uO1xuXG4gICAgICAgICAgLy8gRmluZCB0aGUgc291cmNlIG9mIHRoZSBvYmplY3QgbGl0ZXJhbC5cbiAgICAgICAgICBpZiAocGFyYW1ldGVyRGVjbGFyYXRpb24gJiYgdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihwYXJhbWV0ZXJEZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICAgIGlmICghc2VlbkxpdGVyYWxzLmhhcyhwYXJhbWV0ZXJEZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5nZXQobWV0aG9kTmFtZSkhLmFkZChwYXJhbWV0ZXJEZWNsYXJhdGlvbik7XG4gICAgICAgICAgICAgIHNlZW5MaXRlcmFscy5zZXQocGFyYW1ldGVyRGVjbGFyYXRpb24sIG1ldGhvZE5hbWUpO1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgc2FtZSBsaXRlcmFsIGhhcyBiZWVuIHBhc3NlZCBpbnRvIG11bHRpcGxlIGRpZmZlcmVudCBtZXRob2RzLCB3ZSBjYW4ndFxuICAgICAgICAgICAgICAvLyBtaWdyYXRlIGl0LCBiZWNhdXNlIHRoZSBzdXBwb3J0ZWQgcHJvcGVydGllcyBhcmUgZGlmZmVyZW50LiBXaGVuIHdlIGRldGVjdCBzdWNoXG4gICAgICAgICAgICAgIC8vIGEgY2FzZSwgd2UgZHJvcCBpdCBmcm9tIHRoZSByZXN1bHRzIHNvIHRoYXQgaXQgZ2V0cyBpZ25vcmVkLiBJZiBpdCdzIHVzZWQgbXVsdGlwbGVcbiAgICAgICAgICAgICAgLy8gdGltZXMgZm9yIHRoZSBzYW1lIG1ldGhvZCwgaXQgY2FuIHN0aWxsIGJlIG1pZ3JhdGVkLlxuICAgICAgICAgICAgfSBlbHNlIGlmIChzZWVuTGl0ZXJhbHMuZ2V0KHBhcmFtZXRlckRlY2xhcmF0aW9uKSAhPT0gbWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICByZXN1bHRzLmZvckVhY2gobGl0ZXJhbHMgPT4gbGl0ZXJhbHMuZGVsZXRlKHBhcmFtZXRlckRlY2xhcmF0aW9uKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLmZvckVhY2hDaGlsZCh2aXNpdE5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbi8qKiBBZGRzIGEgbGVhZGluZyBjb21tZW50IHRvIGEgbm9kZSwgaWYgdGhlIG5vZGUgZG9lc24ndCBoYXZlIHN1Y2ggYSBjb21tZW50IGFscmVhZHkuICovXG5mdW5jdGlvbiBhZGRVbmlxdWVMZWFkaW5nQ29tbWVudDxUIGV4dGVuZHMgdHMuTm9kZT4obm9kZTogVCwgY29tbWVudDogc3RyaW5nKTogVCB7XG4gIGNvbnN0IGV4aXN0aW5nQ29tbWVudHMgPSB0cy5nZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHMobm9kZSk7XG5cbiAgLy8gVGhpcyBsb2dpYyBpcyBwcmltYXJpbHkgdG8gZW5zdXJlIHRoYXQgd2UgZG9uJ3QgYWRkIHRoZSBzYW1lIGNvbW1lbnQgbXVsdGlwbGVcbiAgLy8gdGltZXMgd2hlbiB0c2xpbnQgcnVucyBvdmVyIHRoZSBzYW1lIGZpbGUgYWdhaW4gd2l0aCBvdXRkYXRlZCBpbmZvcm1hdGlvbi5cbiAgaWYgKCFleGlzdGluZ0NvbW1lbnRzIHx8IGV4aXN0aW5nQ29tbWVudHMuZXZlcnkoYyA9PiBjLnRleHQgIT09IGNvbW1lbnQpKSB7XG4gICAgcmV0dXJuIHRzLmFkZFN5bnRoZXRpY0xlYWRpbmdDb21tZW50KG5vZGUsIHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSwgY29tbWVudCk7XG4gIH1cblxuICByZXR1cm4gbm9kZTtcbn1cbiJdfQ==