/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ClassStmt, StmtModifier } from '@angular/compiler';
import * as ts from 'typescript';
import { isClassMetadata } from '../metadata/index';
export class PartialModuleMetadataTransformer {
    constructor(modules) {
        this.moduleMap = new Map(modules.map(m => [m.fileName, m]));
    }
    start(sourceFile) {
        const partialModule = this.moduleMap.get(sourceFile.fileName);
        if (partialModule) {
            const classMap = new Map(partialModule.statements.filter(isClassStmt).map(s => [s.name, s]));
            if (classMap.size > 0) {
                return (value, node) => {
                    // For class metadata that is going to be transformed to have a static method ensure the
                    // metadata contains a static declaration the new static method.
                    if (isClassMetadata(value) && node.kind === ts.SyntaxKind.ClassDeclaration) {
                        const classDeclaration = node;
                        if (classDeclaration.name) {
                            const partialClass = classMap.get(classDeclaration.name.text);
                            if (partialClass) {
                                for (const field of partialClass.fields) {
                                    if (field.name && field.modifiers &&
                                        field.modifiers.some(modifier => modifier === StmtModifier.Static)) {
                                        value.statics = Object.assign(Object.assign({}, (value.statics || {})), { [field.name]: {} });
                                    }
                                }
                            }
                        }
                    }
                    return value;
                };
            }
        }
    }
}
function isClassStmt(v) {
    return v instanceof ClassStmt;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfbWV0YWRhdGFfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy90cmFuc2Zvcm1lcnMvcjNfbWV0YWRhdGFfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxTQUFTLEVBQTRCLFlBQVksRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BGLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxlQUFlLEVBQW1ELE1BQU0sbUJBQW1CLENBQUM7QUFJcEcsTUFBTSxPQUFPLGdDQUFnQztJQUczQyxZQUFZLE9BQXdCO1FBQ2xDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBMEIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFFRCxLQUFLLENBQUMsVUFBeUI7UUFDN0IsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlELElBQUksYUFBYSxFQUFFO1lBQ2pCLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUNwQixhQUFhLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQXNCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3RixJQUFJLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO2dCQUNyQixPQUFPLENBQUMsS0FBb0IsRUFBRSxJQUFhLEVBQWlCLEVBQUU7b0JBQzVELHdGQUF3RjtvQkFDeEYsZ0VBQWdFO29CQUNoRSxJQUFJLGVBQWUsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUU7d0JBQzFFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBMkIsQ0FBQzt3QkFDckQsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7NEJBQ3pCLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUM5RCxJQUFJLFlBQVksRUFBRTtnQ0FDaEIsS0FBSyxNQUFNLEtBQUssSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFO29DQUN2QyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLFNBQVM7d0NBQzdCLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxLQUFLLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRTt3Q0FDdEUsS0FBSyxDQUFDLE9BQU8sbUNBQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxLQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBQyxDQUFDO3FDQUM5RDtpQ0FDRjs2QkFDRjt5QkFDRjtxQkFDRjtvQkFDRCxPQUFPLEtBQUssQ0FBQztnQkFDZixDQUFDLENBQUM7YUFDSDtTQUNGO0lBQ0gsQ0FBQztDQUNGO0FBRUQsU0FBUyxXQUFXLENBQUMsQ0FBWTtJQUMvQixPQUFPLENBQUMsWUFBWSxTQUFTLENBQUM7QUFDaEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NsYXNzU3RtdCwgUGFydGlhbE1vZHVsZSwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXJ9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2lzQ2xhc3NNZXRhZGF0YSwgTWV0YWRhdGFDb2xsZWN0b3IsIE1ldGFkYXRhVmFsdWUsIE1vZHVsZU1ldGFkYXRhfSBmcm9tICcuLi9tZXRhZGF0YS9pbmRleCc7XG5cbmltcG9ydCB7TWV0YWRhdGFUcmFuc2Zvcm1lciwgVmFsdWVUcmFuc2Zvcm19IGZyb20gJy4vbWV0YWRhdGFfY2FjaGUnO1xuXG5leHBvcnQgY2xhc3MgUGFydGlhbE1vZHVsZU1ldGFkYXRhVHJhbnNmb3JtZXIgaW1wbGVtZW50cyBNZXRhZGF0YVRyYW5zZm9ybWVyIHtcbiAgcHJpdmF0ZSBtb2R1bGVNYXA6IE1hcDxzdHJpbmcsIFBhcnRpYWxNb2R1bGU+O1xuXG4gIGNvbnN0cnVjdG9yKG1vZHVsZXM6IFBhcnRpYWxNb2R1bGVbXSkge1xuICAgIHRoaXMubW9kdWxlTWFwID0gbmV3IE1hcChtb2R1bGVzLm1hcDxbc3RyaW5nLCBQYXJ0aWFsTW9kdWxlXT4obSA9PiBbbS5maWxlTmFtZSwgbV0pKTtcbiAgfVxuXG4gIHN0YXJ0KHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBWYWx1ZVRyYW5zZm9ybXx1bmRlZmluZWQge1xuICAgIGNvbnN0IHBhcnRpYWxNb2R1bGUgPSB0aGlzLm1vZHVsZU1hcC5nZXQoc291cmNlRmlsZS5maWxlTmFtZSk7XG4gICAgaWYgKHBhcnRpYWxNb2R1bGUpIHtcbiAgICAgIGNvbnN0IGNsYXNzTWFwID0gbmV3IE1hcDxzdHJpbmcsIENsYXNzU3RtdD4oXG4gICAgICAgICAgcGFydGlhbE1vZHVsZS5zdGF0ZW1lbnRzLmZpbHRlcihpc0NsYXNzU3RtdCkubWFwPFtzdHJpbmcsIENsYXNzU3RtdF0+KHMgPT4gW3MubmFtZSwgc10pKTtcbiAgICAgIGlmIChjbGFzc01hcC5zaXplID4gMCkge1xuICAgICAgICByZXR1cm4gKHZhbHVlOiBNZXRhZGF0YVZhbHVlLCBub2RlOiB0cy5Ob2RlKTogTWV0YWRhdGFWYWx1ZSA9PiB7XG4gICAgICAgICAgLy8gRm9yIGNsYXNzIG1ldGFkYXRhIHRoYXQgaXMgZ29pbmcgdG8gYmUgdHJhbnNmb3JtZWQgdG8gaGF2ZSBhIHN0YXRpYyBtZXRob2QgZW5zdXJlIHRoZVxuICAgICAgICAgIC8vIG1ldGFkYXRhIGNvbnRhaW5zIGEgc3RhdGljIGRlY2xhcmF0aW9uIHRoZSBuZXcgc3RhdGljIG1ldGhvZC5cbiAgICAgICAgICBpZiAoaXNDbGFzc01ldGFkYXRhKHZhbHVlKSAmJiBub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuQ2xhc3NEZWNsYXJhdGlvbikge1xuICAgICAgICAgICAgY29uc3QgY2xhc3NEZWNsYXJhdGlvbiA9IG5vZGUgYXMgdHMuQ2xhc3NEZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIGlmIChjbGFzc0RlY2xhcmF0aW9uLm5hbWUpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFydGlhbENsYXNzID0gY2xhc3NNYXAuZ2V0KGNsYXNzRGVjbGFyYXRpb24ubmFtZS50ZXh0KTtcbiAgICAgICAgICAgICAgaWYgKHBhcnRpYWxDbGFzcykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmllbGQgb2YgcGFydGlhbENsYXNzLmZpZWxkcykge1xuICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkLm5hbWUgJiYgZmllbGQubW9kaWZpZXJzICYmXG4gICAgICAgICAgICAgICAgICAgICAgZmllbGQubW9kaWZpZXJzLnNvbWUobW9kaWZpZXIgPT4gbW9kaWZpZXIgPT09IFN0bXRNb2RpZmllci5TdGF0aWMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLnN0YXRpY3MgPSB7Li4uKHZhbHVlLnN0YXRpY3MgfHwge30pLCBbZmllbGQubmFtZV06IHt9fTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NsYXNzU3RtdCh2OiBTdGF0ZW1lbnQpOiB2IGlzIENsYXNzU3RtdCB7XG4gIHJldHVybiB2IGluc3RhbmNlb2YgQ2xhc3NTdG10O1xufVxuIl19