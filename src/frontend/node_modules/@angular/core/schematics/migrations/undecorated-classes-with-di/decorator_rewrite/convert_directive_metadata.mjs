/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { StaticSymbol } from '@angular/compiler';
import * as ts from 'typescript';
/** Error that will be thrown if an unexpected value needs to be converted. */
export class UnexpectedMetadataValueError extends Error {
}
/**
 * Converts a directive metadata object into a TypeScript expression. Throws
 * if metadata cannot be cleanly converted.
 */
export function convertDirectiveMetadataToExpression(metadata, resolveSymbolImport, createImport, convertProperty) {
    if (typeof metadata === 'string') {
        return ts.createStringLiteral(metadata);
    }
    else if (Array.isArray(metadata)) {
        return ts.createArrayLiteral(metadata.map(el => convertDirectiveMetadataToExpression(el, resolveSymbolImport, createImport, convertProperty)));
    }
    else if (typeof metadata === 'number') {
        return ts.createNumericLiteral(metadata.toString());
    }
    else if (typeof metadata === 'boolean') {
        return metadata ? ts.createTrue() : ts.createFalse();
    }
    else if (typeof metadata === 'undefined') {
        return ts.createIdentifier('undefined');
    }
    else if (typeof metadata === 'bigint') {
        return ts.createBigIntLiteral(metadata.toString());
    }
    else if (typeof metadata === 'object') {
        // In case there is a static symbol object part of the metadata, try to resolve
        // the import expression of the symbol. If no import path could be resolved, an
        // error will be thrown as the symbol cannot be converted into TypeScript AST.
        if (metadata instanceof StaticSymbol) {
            const resolvedImport = resolveSymbolImport(metadata);
            if (resolvedImport === null) {
                throw new UnexpectedMetadataValueError();
            }
            return createImport(resolvedImport, metadata.name);
        }
        const literalProperties = [];
        for (const key of Object.keys(metadata)) {
            const metadataValue = metadata[key];
            let propertyValue = null;
            // Allows custom conversion of properties in an object. This is useful for special
            // cases where we don't want to store the enum values as integers, but rather use the
            // real enum symbol. e.g. instead of `2` we want to use `ViewEncapsulation.None`.
            if (convertProperty) {
                propertyValue = convertProperty(key, metadataValue);
            }
            // In case the property value has not been assigned to an expression, we convert
            // the resolved metadata value into a TypeScript expression.
            if (propertyValue === null) {
                propertyValue = convertDirectiveMetadataToExpression(metadataValue, resolveSymbolImport, createImport, convertProperty);
            }
            literalProperties.push(ts.createPropertyAssignment(getPropertyName(key), propertyValue));
        }
        return ts.createObjectLiteral(literalProperties, true);
    }
    throw new UnexpectedMetadataValueError();
}
/**
 * Gets a valid property name from the given text. If the text cannot be used
 * as unquoted identifier, the name will be wrapped in a string literal.
 */
function getPropertyName(name) {
    // Matches the most common identifiers that do not need quotes. Constructing a
    // regular expression that matches the ECMAScript specification in order to determine
    // whether quotes are needed is out of scope for this migration. For those more complex
    // property names, we just always use quotes (when constructing AST from metadata).
    if (/^[a-zA-Z_$]+$/.test(name)) {
        return name;
    }
    return ts.createStringLiteral(name);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udmVydF9kaXJlY3RpdmVfbWV0YWRhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy91bmRlY29yYXRlZC1jbGFzc2VzLXdpdGgtZGkvZGVjb3JhdG9yX3Jld3JpdGUvY29udmVydF9kaXJlY3RpdmVfbWV0YWRhdGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQy9DLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLDhFQUE4RTtBQUM5RSxNQUFNLE9BQU8sNEJBQTZCLFNBQVEsS0FBSztDQUFHO0FBRTFEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQ0FBb0MsQ0FDaEQsUUFBYSxFQUFFLG1CQUE0RCxFQUMzRSxZQUFpRSxFQUNqRSxlQUFtRTtJQUNyRSxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTtRQUNoQyxPQUFPLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUN6QztTQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNsQyxPQUFPLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUNyQyxFQUFFLENBQUMsRUFBRSxDQUFDLG9DQUFvQyxDQUN0QyxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsWUFBWSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuRTtTQUFNLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFO1FBQ3ZDLE9BQU8sRUFBRSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0tBQ3JEO1NBQU0sSUFBSSxPQUFPLFFBQVEsS0FBSyxTQUFTLEVBQUU7UUFDeEMsT0FBTyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQ3REO1NBQU0sSUFBSSxPQUFPLFFBQVEsS0FBSyxXQUFXLEVBQUU7UUFDMUMsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDekM7U0FBTSxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTtRQUN2QyxPQUFPLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztLQUNwRDtTQUFNLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFO1FBQ3ZDLCtFQUErRTtRQUMvRSwrRUFBK0U7UUFDL0UsOEVBQThFO1FBQzlFLElBQUksUUFBUSxZQUFZLFlBQVksRUFBRTtZQUNwQyxNQUFNLGNBQWMsR0FBRyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNyRCxJQUFJLGNBQWMsS0FBSyxJQUFJLEVBQUU7Z0JBQzNCLE1BQU0sSUFBSSw0QkFBNEIsRUFBRSxDQUFDO2FBQzFDO1lBQ0QsT0FBTyxZQUFZLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNwRDtRQUVELE1BQU0saUJBQWlCLEdBQTRCLEVBQUUsQ0FBQztRQUV0RCxLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdkMsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3BDLElBQUksYUFBYSxHQUF1QixJQUFJLENBQUM7WUFFN0Msa0ZBQWtGO1lBQ2xGLHFGQUFxRjtZQUNyRixpRkFBaUY7WUFDakYsSUFBSSxlQUFlLEVBQUU7Z0JBQ25CLGFBQWEsR0FBRyxlQUFlLENBQUMsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDO2FBQ3JEO1lBRUQsZ0ZBQWdGO1lBQ2hGLDREQUE0RDtZQUM1RCxJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUU7Z0JBQzFCLGFBQWEsR0FBRyxvQ0FBb0MsQ0FDaEQsYUFBYSxFQUFFLG1CQUFtQixFQUFFLFlBQVksRUFBRSxlQUFlLENBQUMsQ0FBQzthQUN4RTtZQUVELGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsd0JBQXdCLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7U0FDMUY7UUFFRCxPQUFPLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUN4RDtJQUVELE1BQU0sSUFBSSw0QkFBNEIsRUFBRSxDQUFDO0FBQzNDLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxJQUFZO0lBQ25DLDhFQUE4RTtJQUM5RSxxRkFBcUY7SUFDckYsdUZBQXVGO0lBQ3ZGLG1GQUFtRjtJQUNuRixJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDOUIsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUNELE9BQU8sRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG4vKiogRXJyb3IgdGhhdCB3aWxsIGJlIHRocm93biBpZiBhbiB1bmV4cGVjdGVkIHZhbHVlIG5lZWRzIHRvIGJlIGNvbnZlcnRlZC4gKi9cbmV4cG9ydCBjbGFzcyBVbmV4cGVjdGVkTWV0YWRhdGFWYWx1ZUVycm9yIGV4dGVuZHMgRXJyb3Ige31cblxuLyoqXG4gKiBDb252ZXJ0cyBhIGRpcmVjdGl2ZSBtZXRhZGF0YSBvYmplY3QgaW50byBhIFR5cGVTY3JpcHQgZXhwcmVzc2lvbi4gVGhyb3dzXG4gKiBpZiBtZXRhZGF0YSBjYW5ub3QgYmUgY2xlYW5seSBjb252ZXJ0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlTWV0YWRhdGFUb0V4cHJlc3Npb24oXG4gICAgbWV0YWRhdGE6IGFueSwgcmVzb2x2ZVN5bWJvbEltcG9ydDogKHN5bWJvbDogU3RhdGljU3ltYm9sKSA9PiBzdHJpbmcgfCBudWxsLFxuICAgIGNyZWF0ZUltcG9ydDogKG1vZHVsZU5hbWU6IHN0cmluZywgbmFtZTogc3RyaW5nKSA9PiB0cy5FeHByZXNzaW9uLFxuICAgIGNvbnZlcnRQcm9wZXJ0eT86IChrZXk6IHN0cmluZywgdmFsdWU6IGFueSkgPT4gdHMuRXhwcmVzc2lvbiB8IG51bGwpOiB0cy5FeHByZXNzaW9uIHtcbiAgaWYgKHR5cGVvZiBtZXRhZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChtZXRhZGF0YSk7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShtZXRhZGF0YSkpIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlQXJyYXlMaXRlcmFsKG1ldGFkYXRhLm1hcChcbiAgICAgICAgZWwgPT4gY29udmVydERpcmVjdGl2ZU1ldGFkYXRhVG9FeHByZXNzaW9uKFxuICAgICAgICAgICAgZWwsIHJlc29sdmVTeW1ib2xJbXBvcnQsIGNyZWF0ZUltcG9ydCwgY29udmVydFByb3BlcnR5KSkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhZGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlTnVtZXJpY0xpdGVyYWwobWV0YWRhdGEudG9TdHJpbmcoKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1ldGFkYXRhID09PSAnYm9vbGVhbicpIHtcbiAgICByZXR1cm4gbWV0YWRhdGEgPyB0cy5jcmVhdGVUcnVlKCkgOiB0cy5jcmVhdGVGYWxzZSgpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhZGF0YSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcigndW5kZWZpbmVkJyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1ldGFkYXRhID09PSAnYmlnaW50Jykge1xuICAgIHJldHVybiB0cy5jcmVhdGVCaWdJbnRMaXRlcmFsKG1ldGFkYXRhLnRvU3RyaW5nKCkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhZGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBJbiBjYXNlIHRoZXJlIGlzIGEgc3RhdGljIHN5bWJvbCBvYmplY3QgcGFydCBvZiB0aGUgbWV0YWRhdGEsIHRyeSB0byByZXNvbHZlXG4gICAgLy8gdGhlIGltcG9ydCBleHByZXNzaW9uIG9mIHRoZSBzeW1ib2wuIElmIG5vIGltcG9ydCBwYXRoIGNvdWxkIGJlIHJlc29sdmVkLCBhblxuICAgIC8vIGVycm9yIHdpbGwgYmUgdGhyb3duIGFzIHRoZSBzeW1ib2wgY2Fubm90IGJlIGNvbnZlcnRlZCBpbnRvIFR5cGVTY3JpcHQgQVNULlxuICAgIGlmIChtZXRhZGF0YSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgY29uc3QgcmVzb2x2ZWRJbXBvcnQgPSByZXNvbHZlU3ltYm9sSW1wb3J0KG1ldGFkYXRhKTtcbiAgICAgIGlmIChyZXNvbHZlZEltcG9ydCA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZE1ldGFkYXRhVmFsdWVFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNyZWF0ZUltcG9ydChyZXNvbHZlZEltcG9ydCwgbWV0YWRhdGEubmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgbGl0ZXJhbFByb3BlcnRpZXM6IHRzLlByb3BlcnR5QXNzaWdubWVudFtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhtZXRhZGF0YSkpIHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhVmFsdWUgPSBtZXRhZGF0YVtrZXldO1xuICAgICAgbGV0IHByb3BlcnR5VmFsdWU6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgICAgIC8vIEFsbG93cyBjdXN0b20gY29udmVyc2lvbiBvZiBwcm9wZXJ0aWVzIGluIGFuIG9iamVjdC4gVGhpcyBpcyB1c2VmdWwgZm9yIHNwZWNpYWxcbiAgICAgIC8vIGNhc2VzIHdoZXJlIHdlIGRvbid0IHdhbnQgdG8gc3RvcmUgdGhlIGVudW0gdmFsdWVzIGFzIGludGVnZXJzLCBidXQgcmF0aGVyIHVzZSB0aGVcbiAgICAgIC8vIHJlYWwgZW51bSBzeW1ib2wuIGUuZy4gaW5zdGVhZCBvZiBgMmAgd2Ugd2FudCB0byB1c2UgYFZpZXdFbmNhcHN1bGF0aW9uLk5vbmVgLlxuICAgICAgaWYgKGNvbnZlcnRQcm9wZXJ0eSkge1xuICAgICAgICBwcm9wZXJ0eVZhbHVlID0gY29udmVydFByb3BlcnR5KGtleSwgbWV0YWRhdGFWYWx1ZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluIGNhc2UgdGhlIHByb3BlcnR5IHZhbHVlIGhhcyBub3QgYmVlbiBhc3NpZ25lZCB0byBhbiBleHByZXNzaW9uLCB3ZSBjb252ZXJ0XG4gICAgICAvLyB0aGUgcmVzb2x2ZWQgbWV0YWRhdGEgdmFsdWUgaW50byBhIFR5cGVTY3JpcHQgZXhwcmVzc2lvbi5cbiAgICAgIGlmIChwcm9wZXJ0eVZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHByb3BlcnR5VmFsdWUgPSBjb252ZXJ0RGlyZWN0aXZlTWV0YWRhdGFUb0V4cHJlc3Npb24oXG4gICAgICAgICAgICBtZXRhZGF0YVZhbHVlLCByZXNvbHZlU3ltYm9sSW1wb3J0LCBjcmVhdGVJbXBvcnQsIGNvbnZlcnRQcm9wZXJ0eSk7XG4gICAgICB9XG5cbiAgICAgIGxpdGVyYWxQcm9wZXJ0aWVzLnB1c2godHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KGdldFByb3BlcnR5TmFtZShrZXkpLCBwcm9wZXJ0eVZhbHVlKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRzLmNyZWF0ZU9iamVjdExpdGVyYWwobGl0ZXJhbFByb3BlcnRpZXMsIHRydWUpO1xuICB9XG5cbiAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRNZXRhZGF0YVZhbHVlRXJyb3IoKTtcbn1cblxuLyoqXG4gKiBHZXRzIGEgdmFsaWQgcHJvcGVydHkgbmFtZSBmcm9tIHRoZSBnaXZlbiB0ZXh0LiBJZiB0aGUgdGV4dCBjYW5ub3QgYmUgdXNlZFxuICogYXMgdW5xdW90ZWQgaWRlbnRpZmllciwgdGhlIG5hbWUgd2lsbCBiZSB3cmFwcGVkIGluIGEgc3RyaW5nIGxpdGVyYWwuXG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZShuYW1lOiBzdHJpbmcpOiBzdHJpbmd8dHMuU3RyaW5nTGl0ZXJhbCB7XG4gIC8vIE1hdGNoZXMgdGhlIG1vc3QgY29tbW9uIGlkZW50aWZpZXJzIHRoYXQgZG8gbm90IG5lZWQgcXVvdGVzLiBDb25zdHJ1Y3RpbmcgYVxuICAvLyByZWd1bGFyIGV4cHJlc3Npb24gdGhhdCBtYXRjaGVzIHRoZSBFQ01BU2NyaXB0IHNwZWNpZmljYXRpb24gaW4gb3JkZXIgdG8gZGV0ZXJtaW5lXG4gIC8vIHdoZXRoZXIgcXVvdGVzIGFyZSBuZWVkZWQgaXMgb3V0IG9mIHNjb3BlIGZvciB0aGlzIG1pZ3JhdGlvbi4gRm9yIHRob3NlIG1vcmUgY29tcGxleFxuICAvLyBwcm9wZXJ0eSBuYW1lcywgd2UganVzdCBhbHdheXMgdXNlIHF1b3RlcyAod2hlbiBjb25zdHJ1Y3RpbmcgQVNUIGZyb20gbWV0YWRhdGEpLlxuICBpZiAoL15bYS16QS1aXyRdKyQvLnRlc3QobmFtZSkpIHtcbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuICByZXR1cm4gdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChuYW1lKTtcbn1cbiJdfQ==