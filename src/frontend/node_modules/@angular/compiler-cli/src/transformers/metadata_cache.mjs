/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { TS } from './util';
/**
 * Cache, and potentially transform, metadata as it is being collected.
 */
export class MetadataCache {
    constructor(collector, strict, transformers) {
        this.collector = collector;
        this.strict = strict;
        this.transformers = transformers;
        this.metadataCache = new Map();
        for (let transformer of transformers) {
            if (transformer.connect) {
                transformer.connect(this);
            }
        }
    }
    getMetadata(sourceFile) {
        if (this.metadataCache.has(sourceFile.fileName)) {
            return this.metadataCache.get(sourceFile.fileName);
        }
        let substitute = undefined;
        // Only process transformers on modules that are not declaration files.
        const declarationFile = sourceFile.isDeclarationFile;
        const moduleFile = ts.isExternalModule(sourceFile);
        if (!declarationFile && moduleFile) {
            for (let transform of this.transformers) {
                const transformSubstitute = transform.start(sourceFile);
                if (transformSubstitute) {
                    if (substitute) {
                        const previous = substitute;
                        substitute = (value, node) => transformSubstitute(previous(value, node), node);
                    }
                    else {
                        substitute = transformSubstitute;
                    }
                }
            }
        }
        const isTsFile = TS.test(sourceFile.fileName);
        const result = this.collector.getMetadata(sourceFile, this.strict && isTsFile, substitute);
        this.metadataCache.set(sourceFile.fileName, result);
        return result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWRhdGFfY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL3RyYW5zZm9ybWVycy9tZXRhZGF0YV9jYWNoZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUtqQyxPQUFPLEVBQUMsRUFBRSxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBUzFCOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFHeEIsWUFDWSxTQUE0QixFQUFtQixNQUFlLEVBQzlELFlBQW1DO1FBRG5DLGNBQVMsR0FBVCxTQUFTLENBQW1CO1FBQW1CLFdBQU0sR0FBTixNQUFNLENBQVM7UUFDOUQsaUJBQVksR0FBWixZQUFZLENBQXVCO1FBSnZDLGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQW9DLENBQUM7UUFLbEUsS0FBSyxJQUFJLFdBQVcsSUFBSSxZQUFZLEVBQUU7WUFDcEMsSUFBSSxXQUFXLENBQUMsT0FBTyxFQUFFO2dCQUN2QixXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzNCO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsV0FBVyxDQUFDLFVBQXlCO1FBQ25DLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQy9DLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3BEO1FBQ0QsSUFBSSxVQUFVLEdBQTZCLFNBQVMsQ0FBQztRQUVyRCx1RUFBdUU7UUFDdkUsTUFBTSxlQUFlLEdBQUcsVUFBVSxDQUFDLGlCQUFpQixDQUFDO1FBQ3JELE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsZUFBZSxJQUFJLFVBQVUsRUFBRTtZQUNsQyxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7Z0JBQ3ZDLE1BQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxtQkFBbUIsRUFBRTtvQkFDdkIsSUFBSSxVQUFVLEVBQUU7d0JBQ2QsTUFBTSxRQUFRLEdBQW1CLFVBQVUsQ0FBQzt3QkFDNUMsVUFBVSxHQUFHLENBQUMsS0FBb0IsRUFBRSxJQUFhLEVBQUUsRUFBRSxDQUNqRCxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO3FCQUN0RDt5QkFBTTt3QkFDTCxVQUFVLEdBQUcsbUJBQW1CLENBQUM7cUJBQ2xDO2lCQUNGO2FBQ0Y7U0FDRjtRQUVELE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMzRixJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtNZXRhZGF0YUNvbGxlY3RvciwgTWV0YWRhdGFWYWx1ZSwgTW9kdWxlTWV0YWRhdGF9IGZyb20gJy4uL21ldGFkYXRhL2luZGV4JztcblxuaW1wb3J0IHtNZXRhZGF0YVByb3ZpZGVyfSBmcm9tICcuL2NvbXBpbGVyX2hvc3QnO1xuaW1wb3J0IHtUU30gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IHR5cGUgVmFsdWVUcmFuc2Zvcm0gPSAodmFsdWU6IE1ldGFkYXRhVmFsdWUsIG5vZGU6IHRzLk5vZGUpID0+IE1ldGFkYXRhVmFsdWU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWV0YWRhdGFUcmFuc2Zvcm1lciB7XG4gIGNvbm5lY3Q/KGNhY2hlOiBNZXRhZGF0YUNhY2hlKTogdm9pZDtcbiAgc3RhcnQoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IFZhbHVlVHJhbnNmb3JtfHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBDYWNoZSwgYW5kIHBvdGVudGlhbGx5IHRyYW5zZm9ybSwgbWV0YWRhdGEgYXMgaXQgaXMgYmVpbmcgY29sbGVjdGVkLlxuICovXG5leHBvcnQgY2xhc3MgTWV0YWRhdGFDYWNoZSBpbXBsZW1lbnRzIE1ldGFkYXRhUHJvdmlkZXIge1xuICBwcml2YXRlIG1ldGFkYXRhQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgTW9kdWxlTWV0YWRhdGF8dW5kZWZpbmVkPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb2xsZWN0b3I6IE1ldGFkYXRhQ29sbGVjdG9yLCBwcml2YXRlIHJlYWRvbmx5IHN0cmljdDogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgdHJhbnNmb3JtZXJzOiBNZXRhZGF0YVRyYW5zZm9ybWVyW10pIHtcbiAgICBmb3IgKGxldCB0cmFuc2Zvcm1lciBvZiB0cmFuc2Zvcm1lcnMpIHtcbiAgICAgIGlmICh0cmFuc2Zvcm1lci5jb25uZWN0KSB7XG4gICAgICAgIHRyYW5zZm9ybWVyLmNvbm5lY3QodGhpcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0TWV0YWRhdGEoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IE1vZHVsZU1ldGFkYXRhfHVuZGVmaW5lZCB7XG4gICAgaWYgKHRoaXMubWV0YWRhdGFDYWNoZS5oYXMoc291cmNlRmlsZS5maWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLm1ldGFkYXRhQ2FjaGUuZ2V0KHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICAgIH1cbiAgICBsZXQgc3Vic3RpdHV0ZTogVmFsdWVUcmFuc2Zvcm18dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgLy8gT25seSBwcm9jZXNzIHRyYW5zZm9ybWVycyBvbiBtb2R1bGVzIHRoYXQgYXJlIG5vdCBkZWNsYXJhdGlvbiBmaWxlcy5cbiAgICBjb25zdCBkZWNsYXJhdGlvbkZpbGUgPSBzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlO1xuICAgIGNvbnN0IG1vZHVsZUZpbGUgPSB0cy5pc0V4dGVybmFsTW9kdWxlKHNvdXJjZUZpbGUpO1xuICAgIGlmICghZGVjbGFyYXRpb25GaWxlICYmIG1vZHVsZUZpbGUpIHtcbiAgICAgIGZvciAobGV0IHRyYW5zZm9ybSBvZiB0aGlzLnRyYW5zZm9ybWVycykge1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm1TdWJzdGl0dXRlID0gdHJhbnNmb3JtLnN0YXJ0KHNvdXJjZUZpbGUpO1xuICAgICAgICBpZiAodHJhbnNmb3JtU3Vic3RpdHV0ZSkge1xuICAgICAgICAgIGlmIChzdWJzdGl0dXRlKSB7XG4gICAgICAgICAgICBjb25zdCBwcmV2aW91czogVmFsdWVUcmFuc2Zvcm0gPSBzdWJzdGl0dXRlO1xuICAgICAgICAgICAgc3Vic3RpdHV0ZSA9ICh2YWx1ZTogTWV0YWRhdGFWYWx1ZSwgbm9kZTogdHMuTm9kZSkgPT5cbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1TdWJzdGl0dXRlKHByZXZpb3VzKHZhbHVlLCBub2RlKSwgbm9kZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN1YnN0aXR1dGUgPSB0cmFuc2Zvcm1TdWJzdGl0dXRlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGlzVHNGaWxlID0gVFMudGVzdChzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNvbGxlY3Rvci5nZXRNZXRhZGF0YShzb3VyY2VGaWxlLCB0aGlzLnN0cmljdCAmJiBpc1RzRmlsZSwgc3Vic3RpdHV0ZSk7XG4gICAgdGhpcy5tZXRhZGF0YUNhY2hlLnNldChzb3VyY2VGaWxlLmZpbGVOYW1lLCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbiJdfQ==