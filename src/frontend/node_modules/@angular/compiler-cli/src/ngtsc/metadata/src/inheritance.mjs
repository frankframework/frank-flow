/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ClassPropertyMapping } from './property_mapping';
/**
 * Given a reference to a directive, return a flattened version of its `DirectiveMeta` metadata
 * which includes metadata from its entire inheritance chain.
 *
 * The returned `DirectiveMeta` will either have `baseClass: null` if the inheritance chain could be
 * fully resolved, or `baseClass: 'dynamic'` if the inheritance chain could not be completely
 * followed.
 */
export function flattenInheritedDirectiveMetadata(reader, dir) {
    const topMeta = reader.getDirectiveMetadata(dir);
    if (topMeta === null) {
        throw new Error(`Metadata not found for directive: ${dir.debugName}`);
    }
    if (topMeta.baseClass === null) {
        return topMeta;
    }
    const coercedInputFields = new Set();
    const undeclaredInputFields = new Set();
    const restrictedInputFields = new Set();
    const stringLiteralInputFields = new Set();
    let isDynamic = false;
    let inputs = ClassPropertyMapping.empty();
    let outputs = ClassPropertyMapping.empty();
    let isStructural = false;
    const addMetadata = (meta) => {
        if (meta.baseClass === 'dynamic') {
            isDynamic = true;
        }
        else if (meta.baseClass !== null) {
            const baseMeta = reader.getDirectiveMetadata(meta.baseClass);
            if (baseMeta !== null) {
                addMetadata(baseMeta);
            }
            else {
                // Missing metadata for the base class means it's effectively dynamic.
                isDynamic = true;
            }
        }
        isStructural = isStructural || meta.isStructural;
        inputs = ClassPropertyMapping.merge(inputs, meta.inputs);
        outputs = ClassPropertyMapping.merge(outputs, meta.outputs);
        for (const coercedInputField of meta.coercedInputFields) {
            coercedInputFields.add(coercedInputField);
        }
        for (const undeclaredInputField of meta.undeclaredInputFields) {
            undeclaredInputFields.add(undeclaredInputField);
        }
        for (const restrictedInputField of meta.restrictedInputFields) {
            restrictedInputFields.add(restrictedInputField);
        }
        for (const field of meta.stringLiteralInputFields) {
            stringLiteralInputFields.add(field);
        }
    };
    addMetadata(topMeta);
    return Object.assign(Object.assign({}, topMeta), { inputs,
        outputs,
        coercedInputFields,
        undeclaredInputFields,
        restrictedInputFields,
        stringLiteralInputFields, baseClass: isDynamic ? 'dynamic' : null, isStructural });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5oZXJpdGFuY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL21ldGFkYXRhL3NyYy9pbmhlcml0YW5jZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFNSCxPQUFPLEVBQUMsb0JBQW9CLEVBQW9CLE1BQU0sb0JBQW9CLENBQUM7QUFFM0U7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxpQ0FBaUMsQ0FDN0MsTUFBc0IsRUFBRSxHQUFnQztJQUMxRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakQsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1FBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsSUFBSSxPQUFPLENBQUMsU0FBUyxLQUFLLElBQUksRUFBRTtRQUM5QixPQUFPLE9BQU8sQ0FBQztLQUNoQjtJQUVELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFDeEQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUMzRCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBQzNELE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFDOUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO0lBQ3RCLElBQUksTUFBTSxHQUFHLG9CQUFvQixDQUFDLEtBQUssRUFBRSxDQUFDO0lBQzFDLElBQUksT0FBTyxHQUFHLG9CQUFvQixDQUFDLEtBQUssRUFBRSxDQUFDO0lBQzNDLElBQUksWUFBWSxHQUFZLEtBQUssQ0FBQztJQUVsQyxNQUFNLFdBQVcsR0FBRyxDQUFDLElBQW1CLEVBQVEsRUFBRTtRQUNoRCxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssU0FBUyxFQUFFO1lBQ2hDLFNBQVMsR0FBRyxJQUFJLENBQUM7U0FDbEI7YUFBTSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO1lBQ2xDLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0QsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFO2dCQUNyQixXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDdkI7aUJBQU07Z0JBQ0wsc0VBQXNFO2dCQUN0RSxTQUFTLEdBQUcsSUFBSSxDQUFDO2FBQ2xCO1NBQ0Y7UUFFRCxZQUFZLEdBQUcsWUFBWSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUM7UUFFakQsTUFBTSxHQUFHLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pELE9BQU8sR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1RCxLQUFLLE1BQU0saUJBQWlCLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO1lBQ3ZELGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1NBQzNDO1FBQ0QsS0FBSyxNQUFNLG9CQUFvQixJQUFJLElBQUksQ0FBQyxxQkFBcUIsRUFBRTtZQUM3RCxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUNqRDtRQUNELEtBQUssTUFBTSxvQkFBb0IsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUU7WUFDN0QscUJBQXFCLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7U0FDakQ7UUFDRCxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyx3QkFBd0IsRUFBRTtZQUNqRCx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDckM7SUFDSCxDQUFDLENBQUM7SUFFRixXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFckIsdUNBQ0ssT0FBTyxLQUNWLE1BQU07UUFDTixPQUFPO1FBQ1Asa0JBQWtCO1FBQ2xCLHFCQUFxQjtRQUNyQixxQkFBcUI7UUFDckIsd0JBQXdCLEVBQ3hCLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUN2QyxZQUFZLElBQ1o7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UmVmZXJlbmNlfSBmcm9tICcuLi8uLi9pbXBvcnRzJztcbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5cbmltcG9ydCB7RGlyZWN0aXZlTWV0YSwgTWV0YWRhdGFSZWFkZXJ9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Q2xhc3NQcm9wZXJ0eU1hcHBpbmcsIENsYXNzUHJvcGVydHlOYW1lfSBmcm9tICcuL3Byb3BlcnR5X21hcHBpbmcnO1xuXG4vKipcbiAqIEdpdmVuIGEgcmVmZXJlbmNlIHRvIGEgZGlyZWN0aXZlLCByZXR1cm4gYSBmbGF0dGVuZWQgdmVyc2lvbiBvZiBpdHMgYERpcmVjdGl2ZU1ldGFgIG1ldGFkYXRhXG4gKiB3aGljaCBpbmNsdWRlcyBtZXRhZGF0YSBmcm9tIGl0cyBlbnRpcmUgaW5oZXJpdGFuY2UgY2hhaW4uXG4gKlxuICogVGhlIHJldHVybmVkIGBEaXJlY3RpdmVNZXRhYCB3aWxsIGVpdGhlciBoYXZlIGBiYXNlQ2xhc3M6IG51bGxgIGlmIHRoZSBpbmhlcml0YW5jZSBjaGFpbiBjb3VsZCBiZVxuICogZnVsbHkgcmVzb2x2ZWQsIG9yIGBiYXNlQ2xhc3M6ICdkeW5hbWljJ2AgaWYgdGhlIGluaGVyaXRhbmNlIGNoYWluIGNvdWxkIG5vdCBiZSBjb21wbGV0ZWx5XG4gKiBmb2xsb3dlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW5Jbmhlcml0ZWREaXJlY3RpdmVNZXRhZGF0YShcbiAgICByZWFkZXI6IE1ldGFkYXRhUmVhZGVyLCBkaXI6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPik6IERpcmVjdGl2ZU1ldGEge1xuICBjb25zdCB0b3BNZXRhID0gcmVhZGVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcik7XG4gIGlmICh0b3BNZXRhID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBNZXRhZGF0YSBub3QgZm91bmQgZm9yIGRpcmVjdGl2ZTogJHtkaXIuZGVidWdOYW1lfWApO1xuICB9XG4gIGlmICh0b3BNZXRhLmJhc2VDbGFzcyA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0b3BNZXRhO1xuICB9XG5cbiAgY29uc3QgY29lcmNlZElucHV0RmllbGRzID0gbmV3IFNldDxDbGFzc1Byb3BlcnR5TmFtZT4oKTtcbiAgY29uc3QgdW5kZWNsYXJlZElucHV0RmllbGRzID0gbmV3IFNldDxDbGFzc1Byb3BlcnR5TmFtZT4oKTtcbiAgY29uc3QgcmVzdHJpY3RlZElucHV0RmllbGRzID0gbmV3IFNldDxDbGFzc1Byb3BlcnR5TmFtZT4oKTtcbiAgY29uc3Qgc3RyaW5nTGl0ZXJhbElucHV0RmllbGRzID0gbmV3IFNldDxDbGFzc1Byb3BlcnR5TmFtZT4oKTtcbiAgbGV0IGlzRHluYW1pYyA9IGZhbHNlO1xuICBsZXQgaW5wdXRzID0gQ2xhc3NQcm9wZXJ0eU1hcHBpbmcuZW1wdHkoKTtcbiAgbGV0IG91dHB1dHMgPSBDbGFzc1Byb3BlcnR5TWFwcGluZy5lbXB0eSgpO1xuICBsZXQgaXNTdHJ1Y3R1cmFsOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3QgYWRkTWV0YWRhdGEgPSAobWV0YTogRGlyZWN0aXZlTWV0YSk6IHZvaWQgPT4ge1xuICAgIGlmIChtZXRhLmJhc2VDbGFzcyA9PT0gJ2R5bmFtaWMnKSB7XG4gICAgICBpc0R5bmFtaWMgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobWV0YS5iYXNlQ2xhc3MgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGJhc2VNZXRhID0gcmVhZGVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKG1ldGEuYmFzZUNsYXNzKTtcbiAgICAgIGlmIChiYXNlTWV0YSAhPT0gbnVsbCkge1xuICAgICAgICBhZGRNZXRhZGF0YShiYXNlTWV0YSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBNaXNzaW5nIG1ldGFkYXRhIGZvciB0aGUgYmFzZSBjbGFzcyBtZWFucyBpdCdzIGVmZmVjdGl2ZWx5IGR5bmFtaWMuXG4gICAgICAgIGlzRHluYW1pYyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaXNTdHJ1Y3R1cmFsID0gaXNTdHJ1Y3R1cmFsIHx8IG1ldGEuaXNTdHJ1Y3R1cmFsO1xuXG4gICAgaW5wdXRzID0gQ2xhc3NQcm9wZXJ0eU1hcHBpbmcubWVyZ2UoaW5wdXRzLCBtZXRhLmlucHV0cyk7XG4gICAgb3V0cHV0cyA9IENsYXNzUHJvcGVydHlNYXBwaW5nLm1lcmdlKG91dHB1dHMsIG1ldGEub3V0cHV0cyk7XG5cbiAgICBmb3IgKGNvbnN0IGNvZXJjZWRJbnB1dEZpZWxkIG9mIG1ldGEuY29lcmNlZElucHV0RmllbGRzKSB7XG4gICAgICBjb2VyY2VkSW5wdXRGaWVsZHMuYWRkKGNvZXJjZWRJbnB1dEZpZWxkKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB1bmRlY2xhcmVkSW5wdXRGaWVsZCBvZiBtZXRhLnVuZGVjbGFyZWRJbnB1dEZpZWxkcykge1xuICAgICAgdW5kZWNsYXJlZElucHV0RmllbGRzLmFkZCh1bmRlY2xhcmVkSW5wdXRGaWVsZCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcmVzdHJpY3RlZElucHV0RmllbGQgb2YgbWV0YS5yZXN0cmljdGVkSW5wdXRGaWVsZHMpIHtcbiAgICAgIHJlc3RyaWN0ZWRJbnB1dEZpZWxkcy5hZGQocmVzdHJpY3RlZElucHV0RmllbGQpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIG1ldGEuc3RyaW5nTGl0ZXJhbElucHV0RmllbGRzKSB7XG4gICAgICBzdHJpbmdMaXRlcmFsSW5wdXRGaWVsZHMuYWRkKGZpZWxkKTtcbiAgICB9XG4gIH07XG5cbiAgYWRkTWV0YWRhdGEodG9wTWV0YSk7XG5cbiAgcmV0dXJuIHtcbiAgICAuLi50b3BNZXRhLFxuICAgIGlucHV0cyxcbiAgICBvdXRwdXRzLFxuICAgIGNvZXJjZWRJbnB1dEZpZWxkcyxcbiAgICB1bmRlY2xhcmVkSW5wdXRGaWVsZHMsXG4gICAgcmVzdHJpY3RlZElucHV0RmllbGRzLFxuICAgIHN0cmluZ0xpdGVyYWxJbnB1dEZpZWxkcyxcbiAgICBiYXNlQ2xhc3M6IGlzRHluYW1pYyA/ICdkeW5hbWljJyA6IG51bGwsXG4gICAgaXNTdHJ1Y3R1cmFsLFxuICB9O1xufVxuIl19