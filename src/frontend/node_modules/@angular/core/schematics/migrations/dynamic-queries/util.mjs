/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { getAngularDecorators } from '../../utils/ng_decorators';
/**
 * Identifies the nodes that should be migrated by the dynamic
 * queries schematic. Splits the nodes into the following categories:
 * - `removeProperty` - queries from which we should only remove the `static` property of the
 *  `options` parameter (e.g. `@ViewChild('child', {static: false, read: ElementRef})`).
 * - `removeParameter` - queries from which we should drop the entire `options` parameter.
 *  (e.g. `@ViewChild('child', {static: false})`).
 */
export function identifyDynamicQueryNodes(typeChecker, sourceFile) {
    const removeProperty = [];
    const removeParameter = [];
    sourceFile.forEachChild(function walk(node) {
        if (ts.isClassDeclaration(node)) {
            node.members.forEach(member => {
                const angularDecorators = member.decorators && getAngularDecorators(typeChecker, member.decorators);
                if (angularDecorators) {
                    angularDecorators
                        // Filter out the queries that can have the `static` flag.
                        .filter(decorator => {
                        return decorator.name === 'ViewChild' || decorator.name === 'ContentChild';
                    })
                        // Filter out the queries where the `static` flag is explicitly set to `false`.
                        .filter(decorator => {
                        const options = decorator.node.expression.arguments[1];
                        return options && ts.isObjectLiteralExpression(options) &&
                            options.properties.some(property => ts.isPropertyAssignment(property) &&
                                property.initializer.kind === ts.SyntaxKind.FalseKeyword);
                    })
                        .forEach(decorator => {
                        const options = decorator.node.expression.arguments[1];
                        // At this point we know that at least one property is the `static` flag. If this is
                        // the only property we can drop the entire object literal, otherwise we have to
                        // drop only the property.
                        if (options.properties.length === 1) {
                            removeParameter.push(decorator.node.expression);
                        }
                        else {
                            removeProperty.push(options);
                        }
                    });
                }
            });
        }
        node.forEachChild(walk);
    });
    return { removeProperty, removeParameter };
}
/** Removes the `options` parameter from the call expression of a query decorator. */
export function removeOptionsParameter(node) {
    return ts.updateCall(node, node.expression, node.typeArguments, [node.arguments[0]]);
}
/** Removes the `static` property from an object literal expression. */
export function removeStaticFlag(node) {
    return ts.updateObjectLiteral(node, node.properties.filter(property => property.name && property.name.getText() !== 'static'));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy9taWdyYXRpb25zL2R5bmFtaWMtcXVlcmllcy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2pDLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRS9EOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsV0FBMkIsRUFBRSxVQUF5QjtJQUM5RixNQUFNLGNBQWMsR0FBaUMsRUFBRSxDQUFDO0lBQ3hELE1BQU0sZUFBZSxHQUF3QixFQUFFLENBQUM7SUFFaEQsVUFBVSxDQUFDLFlBQVksQ0FBQyxTQUFTLElBQUksQ0FBQyxJQUFhO1FBQ2pELElBQUksRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQy9CLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUM1QixNQUFNLGlCQUFpQixHQUNuQixNQUFNLENBQUMsVUFBVSxJQUFJLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBRTlFLElBQUksaUJBQWlCLEVBQUU7b0JBQ3JCLGlCQUFpQjt3QkFDYiwwREFBMEQ7eUJBQ3pELE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTt3QkFDbEIsT0FBTyxTQUFTLENBQUMsSUFBSSxLQUFLLFdBQVcsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLGNBQWMsQ0FBQztvQkFDN0UsQ0FBQyxDQUFDO3dCQUNGLCtFQUErRTt5QkFDOUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO3dCQUNsQixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3ZELE9BQU8sT0FBTyxJQUFJLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUM7NEJBQ25ELE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUNuQixRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUM7Z0NBQ3pDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUM7b0JBQ3hFLENBQUMsQ0FBQzt5QkFDRCxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUU7d0JBQ25CLE1BQU0sT0FBTyxHQUNULFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQStCLENBQUM7d0JBRXpFLG9GQUFvRjt3QkFDcEYsZ0ZBQWdGO3dCQUNoRiwwQkFBMEI7d0JBQzFCLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFOzRCQUNuQyxlQUFlLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7eUJBQ2pEOzZCQUFNOzRCQUNMLGNBQWMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7eUJBQzlCO29CQUNILENBQUMsQ0FBQyxDQUFDO2lCQUNSO1lBQ0gsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUIsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLEVBQUMsY0FBYyxFQUFFLGVBQWUsRUFBQyxDQUFDO0FBQzNDLENBQUM7QUFFRCxxRkFBcUY7QUFDckYsTUFBTSxVQUFVLHNCQUFzQixDQUFDLElBQXVCO0lBQzVELE9BQU8sRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkYsQ0FBQztBQUVELHVFQUF1RTtBQUN2RSxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsSUFBZ0M7SUFDL0QsT0FBTyxFQUFFLENBQUMsbUJBQW1CLENBQ3pCLElBQUksRUFDSixJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2pHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge2dldEFuZ3VsYXJEZWNvcmF0b3JzfSBmcm9tICcuLi8uLi91dGlscy9uZ19kZWNvcmF0b3JzJztcblxuLyoqXG4gKiBJZGVudGlmaWVzIHRoZSBub2RlcyB0aGF0IHNob3VsZCBiZSBtaWdyYXRlZCBieSB0aGUgZHluYW1pY1xuICogcXVlcmllcyBzY2hlbWF0aWMuIFNwbGl0cyB0aGUgbm9kZXMgaW50byB0aGUgZm9sbG93aW5nIGNhdGVnb3JpZXM6XG4gKiAtIGByZW1vdmVQcm9wZXJ0eWAgLSBxdWVyaWVzIGZyb20gd2hpY2ggd2Ugc2hvdWxkIG9ubHkgcmVtb3ZlIHRoZSBgc3RhdGljYCBwcm9wZXJ0eSBvZiB0aGVcbiAqICBgb3B0aW9uc2AgcGFyYW1ldGVyIChlLmcuIGBAVmlld0NoaWxkKCdjaGlsZCcsIHtzdGF0aWM6IGZhbHNlLCByZWFkOiBFbGVtZW50UmVmfSlgKS5cbiAqIC0gYHJlbW92ZVBhcmFtZXRlcmAgLSBxdWVyaWVzIGZyb20gd2hpY2ggd2Ugc2hvdWxkIGRyb3AgdGhlIGVudGlyZSBgb3B0aW9uc2AgcGFyYW1ldGVyLlxuICogIChlLmcuIGBAVmlld0NoaWxkKCdjaGlsZCcsIHtzdGF0aWM6IGZhbHNlfSlgKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlkZW50aWZ5RHluYW1pY1F1ZXJ5Tm9kZXModHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyLCBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSB7XG4gIGNvbnN0IHJlbW92ZVByb3BlcnR5OiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbltdID0gW107XG4gIGNvbnN0IHJlbW92ZVBhcmFtZXRlcjogdHMuQ2FsbEV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIHNvdXJjZUZpbGUuZm9yRWFjaENoaWxkKGZ1bmN0aW9uIHdhbGsobm9kZTogdHMuTm9kZSkge1xuICAgIGlmICh0cy5pc0NsYXNzRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIG5vZGUubWVtYmVycy5mb3JFYWNoKG1lbWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJEZWNvcmF0b3JzID1cbiAgICAgICAgICAgIG1lbWJlci5kZWNvcmF0b3JzICYmIGdldEFuZ3VsYXJEZWNvcmF0b3JzKHR5cGVDaGVja2VyLCBtZW1iZXIuZGVjb3JhdG9ycyk7XG5cbiAgICAgICAgaWYgKGFuZ3VsYXJEZWNvcmF0b3JzKSB7XG4gICAgICAgICAgYW5ndWxhckRlY29yYXRvcnNcbiAgICAgICAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgcXVlcmllcyB0aGF0IGNhbiBoYXZlIHRoZSBgc3RhdGljYCBmbGFnLlxuICAgICAgICAgICAgICAuZmlsdGVyKGRlY29yYXRvciA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlY29yYXRvci5uYW1lID09PSAnVmlld0NoaWxkJyB8fCBkZWNvcmF0b3IubmFtZSA9PT0gJ0NvbnRlbnRDaGlsZCc7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHF1ZXJpZXMgd2hlcmUgdGhlIGBzdGF0aWNgIGZsYWcgaXMgZXhwbGljaXRseSBzZXQgdG8gYGZhbHNlYC5cbiAgICAgICAgICAgICAgLmZpbHRlcihkZWNvcmF0b3IgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBkZWNvcmF0b3Iubm9kZS5leHByZXNzaW9uLmFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucyAmJiB0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKG9wdGlvbnMpICYmXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucHJvcGVydGllcy5zb21lKFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkgPT4gdHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcGVydHkpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkuaW5pdGlhbGl6ZXIua2luZCA9PT0gdHMuU3ludGF4S2luZC5GYWxzZUtleXdvcmQpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuZm9yRWFjaChkZWNvcmF0b3IgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPVxuICAgICAgICAgICAgICAgICAgICBkZWNvcmF0b3Iubm9kZS5leHByZXNzaW9uLmFyZ3VtZW50c1sxXSBhcyB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbjtcblxuICAgICAgICAgICAgICAgIC8vIEF0IHRoaXMgcG9pbnQgd2Uga25vdyB0aGF0IGF0IGxlYXN0IG9uZSBwcm9wZXJ0eSBpcyB0aGUgYHN0YXRpY2AgZmxhZy4gSWYgdGhpcyBpc1xuICAgICAgICAgICAgICAgIC8vIHRoZSBvbmx5IHByb3BlcnR5IHdlIGNhbiBkcm9wIHRoZSBlbnRpcmUgb2JqZWN0IGxpdGVyYWwsIG90aGVyd2lzZSB3ZSBoYXZlIHRvXG4gICAgICAgICAgICAgICAgLy8gZHJvcCBvbmx5IHRoZSBwcm9wZXJ0eS5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5wcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgcmVtb3ZlUGFyYW1ldGVyLnB1c2goZGVjb3JhdG9yLm5vZGUuZXhwcmVzc2lvbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJlbW92ZVByb3BlcnR5LnB1c2gob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbm9kZS5mb3JFYWNoQ2hpbGQod2Fsayk7XG4gIH0pO1xuXG4gIHJldHVybiB7cmVtb3ZlUHJvcGVydHksIHJlbW92ZVBhcmFtZXRlcn07XG59XG5cbi8qKiBSZW1vdmVzIHRoZSBgb3B0aW9uc2AgcGFyYW1ldGVyIGZyb20gdGhlIGNhbGwgZXhwcmVzc2lvbiBvZiBhIHF1ZXJ5IGRlY29yYXRvci4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVPcHRpb25zUGFyYW1ldGVyKG5vZGU6IHRzLkNhbGxFeHByZXNzaW9uKTogdHMuQ2FsbEV4cHJlc3Npb24ge1xuICByZXR1cm4gdHMudXBkYXRlQ2FsbChub2RlLCBub2RlLmV4cHJlc3Npb24sIG5vZGUudHlwZUFyZ3VtZW50cywgW25vZGUuYXJndW1lbnRzWzBdXSk7XG59XG5cbi8qKiBSZW1vdmVzIHRoZSBgc3RhdGljYCBwcm9wZXJ0eSBmcm9tIGFuIG9iamVjdCBsaXRlcmFsIGV4cHJlc3Npb24uICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU3RhdGljRmxhZyhub2RlOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbik6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uIHtcbiAgcmV0dXJuIHRzLnVwZGF0ZU9iamVjdExpdGVyYWwoXG4gICAgICBub2RlLFxuICAgICAgbm9kZS5wcm9wZXJ0aWVzLmZpbHRlcihwcm9wZXJ0eSA9PiBwcm9wZXJ0eS5uYW1lICYmIHByb3BlcnR5Lm5hbWUuZ2V0VGV4dCgpICE9PSAnc3RhdGljJykpO1xufVxuIl19