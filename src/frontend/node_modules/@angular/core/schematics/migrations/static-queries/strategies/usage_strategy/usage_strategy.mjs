/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { parseHtmlGracefully } from '../../../../utils/parse_html';
import { hasPropertyNameText } from '../../../../utils/typescript/property_name';
import { QueryTiming, QueryType } from '../../angular/query-definition';
import { DeclarationUsageVisitor, ResolvedUsage } from './declaration_usage_visitor';
import { updateSuperClassAbstractMembersContext } from './super_class_context';
import { TemplateUsageVisitor } from './template_usage_visitor';
/**
 * Object that maps a given type of query to a list of lifecycle hooks that
 * could be used to access such a query statically.
 */
const STATIC_QUERY_LIFECYCLE_HOOKS = {
    [QueryType.ViewChild]: ['ngOnChanges', 'ngOnInit', 'ngDoCheck', 'ngAfterContentInit', 'ngAfterContentChecked'],
    [QueryType.ContentChild]: ['ngOnChanges', 'ngOnInit', 'ngDoCheck'],
};
/**
 * Query timing strategy that determines the timing of a given query by inspecting how
 * the query is accessed within the project's TypeScript source files. Read more about
 * this strategy here: https://hackmd.io/s/Hymvc2OKE
 */
export class QueryUsageStrategy {
    constructor(classMetadata, typeChecker) {
        this.classMetadata = classMetadata;
        this.typeChecker = typeChecker;
    }
    setup() { }
    /**
     * Analyzes the usage of the given query and determines the query timing based
     * on the current usage of the query.
     */
    detectTiming(query) {
        if (query.property === null) {
            return { timing: null, message: 'Queries defined on accessors cannot be analyzed.' };
        }
        const usage = this.analyzeQueryUsage(query.container, query, []);
        if (usage === ResolvedUsage.AMBIGUOUS) {
            return {
                timing: QueryTiming.STATIC,
                message: 'Query timing is ambiguous. Please check if the query can be marked as dynamic.'
            };
        }
        else if (usage === ResolvedUsage.SYNCHRONOUS) {
            return { timing: QueryTiming.STATIC };
        }
        else {
            return { timing: QueryTiming.DYNAMIC };
        }
    }
    /**
     * Checks whether a given query is used statically within the given class, its super
     * class or derived classes.
     */
    analyzeQueryUsage(classDecl, query, knownInputNames, functionCtx = new Map(), visitInheritedClasses = true) {
        const usageVisitor = new DeclarationUsageVisitor(query.property, this.typeChecker, functionCtx);
        const classMetadata = this.classMetadata.get(classDecl);
        let usage = ResolvedUsage.ASYNCHRONOUS;
        // In case there is metadata for the current class, we collect all resolved Angular input
        // names and add them to the list of known inputs that need to be checked for usages of
        // the current query. e.g. queries used in an @Input() *setter* are always static.
        if (classMetadata) {
            knownInputNames.push(...classMetadata.ngInputNames);
        }
        // Array of TypeScript nodes which can contain usages of the given query in
        // order to access it statically.
        const possibleStaticQueryNodes = filterQueryClassMemberNodes(classDecl, query, knownInputNames);
        // In case nodes that can possibly access a query statically have been found, check
        // if the query declaration is synchronously used within any of these nodes.
        if (possibleStaticQueryNodes.length) {
            possibleStaticQueryNodes.forEach(n => usage = combineResolvedUsage(usage, usageVisitor.getResolvedNodeUsage(n)));
        }
        if (!classMetadata) {
            return usage;
        }
        // In case there is a component template for the current class, we check if the
        // template statically accesses the current query. In case that's true, the query
        // can be marked as static.
        if (classMetadata.template && hasPropertyNameText(query.property.name)) {
            const template = classMetadata.template;
            const parsedHtml = parseHtmlGracefully(template.content, template.filePath);
            const htmlVisitor = new TemplateUsageVisitor(query.property.name.text);
            if (parsedHtml && htmlVisitor.isQueryUsedStatically(parsedHtml)) {
                return ResolvedUsage.SYNCHRONOUS;
            }
        }
        // In case derived classes should also be analyzed, we determine the classes that derive
        // from the current class and check if these have input setters or lifecycle hooks that
        // use the query statically.
        if (visitInheritedClasses) {
            classMetadata.derivedClasses.forEach(derivedClass => {
                usage = combineResolvedUsage(usage, this.analyzeQueryUsage(derivedClass, query, knownInputNames));
            });
        }
        // In case the current class has a super class, we determine declared abstract function-like
        // declarations in the super-class that are implemented in the current class. The super class
        // will then be analyzed with the abstract declarations mapped to the implemented TypeScript
        // nodes. This allows us to handle queries which are used in super classes through derived
        // abstract method declarations.
        if (classMetadata.superClass) {
            const superClassDecl = classMetadata.superClass;
            // Update the function context to map abstract declaration nodes to their implementation
            // node in the base class. This ensures that the declaration usage visitor can analyze
            // abstract class member declarations.
            updateSuperClassAbstractMembersContext(classDecl, functionCtx, this.classMetadata);
            usage = combineResolvedUsage(usage, this.analyzeQueryUsage(superClassDecl, query, [], functionCtx, false));
        }
        return usage;
    }
}
/**
 * Combines two resolved usages based on a fixed priority. "Synchronous" takes
 * precedence over "Ambiguous" whereas ambiguous takes precedence over "Asynchronous".
 */
function combineResolvedUsage(base, target) {
    if (base === ResolvedUsage.SYNCHRONOUS) {
        return base;
    }
    else if (target !== ResolvedUsage.ASYNCHRONOUS) {
        return target;
    }
    else {
        return ResolvedUsage.ASYNCHRONOUS;
    }
}
/**
 * Filters all class members from the class declaration that can access the
 * given query statically (e.g. ngOnInit lifecycle hook or @Input setters)
 */
function filterQueryClassMemberNodes(classDecl, query, knownInputNames) {
    // Returns an array of TypeScript nodes which can contain usages of the given query
    // in order to access it statically. e.g.
    //  (1) queries used in the "ngOnInit" lifecycle hook are static.
    //  (2) inputs with setters can access queries statically.
    return classDecl.members
        .filter((m) => {
        if (ts.isMethodDeclaration(m) && m.body && hasPropertyNameText(m.name) &&
            STATIC_QUERY_LIFECYCLE_HOOKS[query.type].indexOf(m.name.text) !== -1) {
            return true;
        }
        else if (knownInputNames && ts.isSetAccessor(m) && m.body &&
            hasPropertyNameText(m.name) && knownInputNames.indexOf(m.name.text) !== -1) {
            return true;
        }
        return false;
    })
        .map(member => member.body);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNhZ2Vfc3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy9zdGF0aWMtcXVlcmllcy9zdHJhdGVnaWVzL3VzYWdlX3N0cmF0ZWd5L3VzYWdlX3N0cmF0ZWd5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ2pFLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLDRDQUE0QyxDQUFDO0FBRS9FLE9BQU8sRUFBb0IsV0FBVyxFQUFFLFNBQVMsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBR3pGLE9BQU8sRUFBQyx1QkFBdUIsRUFBbUIsYUFBYSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDcEcsT0FBTyxFQUFDLHNDQUFzQyxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0UsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFHOUQ7OztHQUdHO0FBQ0gsTUFBTSw0QkFBNEIsR0FBRztJQUNuQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFDakIsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSx1QkFBdUIsQ0FBQztJQUMzRixDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDO0NBQ25FLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLGtCQUFrQjtJQUM3QixZQUFvQixhQUErQixFQUFVLFdBQTJCO1FBQXBFLGtCQUFhLEdBQWIsYUFBYSxDQUFrQjtRQUFVLGdCQUFXLEdBQVgsV0FBVyxDQUFnQjtJQUFHLENBQUM7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LGlFQUFpRTtJQUNqRSwwREFBMEQ7SUFDMUQsT0FBTyxTQUFTLENBQUMsT0FBTztTQUNuQixNQUFNLENBQ0gsQ0FBQyxDQUFDLEVBQ3lELEVBQUU7UUFDdkQsSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2xFLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUN4RSxPQUFPLElBQUksQ0FBQztTQUNiO2FBQU0sSUFDSCxlQUFlLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSTtZQUNoRCxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQzlFLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsQ0FBQztTQUNULEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFLLENBQUMsQ0FBQztBQUNuQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge3BhcnNlSHRtbEdyYWNlZnVsbHl9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL3BhcnNlX2h0bWwnO1xuaW1wb3J0IHtoYXNQcm9wZXJ0eU5hbWVUZXh0fSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy90eXBlc2NyaXB0L3Byb3BlcnR5X25hbWUnO1xuaW1wb3J0IHtDbGFzc01ldGFkYXRhTWFwfSBmcm9tICcuLi8uLi9hbmd1bGFyL25nX3F1ZXJ5X3Zpc2l0b3InO1xuaW1wb3J0IHtOZ1F1ZXJ5RGVmaW5pdGlvbiwgUXVlcnlUaW1pbmcsIFF1ZXJ5VHlwZX0gZnJvbSAnLi4vLi4vYW5ndWxhci9xdWVyeS1kZWZpbml0aW9uJztcbmltcG9ydCB7VGltaW5nUmVzdWx0LCBUaW1pbmdTdHJhdGVneX0gZnJvbSAnLi4vdGltaW5nLXN0cmF0ZWd5JztcblxuaW1wb3J0IHtEZWNsYXJhdGlvblVzYWdlVmlzaXRvciwgRnVuY3Rpb25Db250ZXh0LCBSZXNvbHZlZFVzYWdlfSBmcm9tICcuL2RlY2xhcmF0aW9uX3VzYWdlX3Zpc2l0b3InO1xuaW1wb3J0IHt1cGRhdGVTdXBlckNsYXNzQWJzdHJhY3RNZW1iZXJzQ29udGV4dH0gZnJvbSAnLi9zdXBlcl9jbGFzc19jb250ZXh0JztcbmltcG9ydCB7VGVtcGxhdGVVc2FnZVZpc2l0b3J9IGZyb20gJy4vdGVtcGxhdGVfdXNhZ2VfdmlzaXRvcic7XG5cblxuLyoqXG4gKiBPYmplY3QgdGhhdCBtYXBzIGEgZ2l2ZW4gdHlwZSBvZiBxdWVyeSB0byBhIGxpc3Qgb2YgbGlmZWN5Y2xlIGhvb2tzIHRoYXRcbiAqIGNvdWxkIGJlIHVzZWQgdG8gYWNjZXNzIHN1Y2ggYSBxdWVyeSBzdGF0aWNhbGx5LlxuICovXG5jb25zdCBTVEFUSUNfUVVFUllfTElGRUNZQ0xFX0hPT0tTID0ge1xuICBbUXVlcnlUeXBlLlZpZXdDaGlsZF06XG4gICAgICBbJ25nT25DaGFuZ2VzJywgJ25nT25Jbml0JywgJ25nRG9DaGVjaycsICduZ0FmdGVyQ29udGVudEluaXQnLCAnbmdBZnRlckNvbnRlbnRDaGVja2VkJ10sXG4gIFtRdWVyeVR5cGUuQ29udGVudENoaWxkXTogWyduZ09uQ2hhbmdlcycsICduZ09uSW5pdCcsICduZ0RvQ2hlY2snXSxcbn07XG5cbi8qKlxuICogUXVlcnkgdGltaW5nIHN0cmF0ZWd5IHRoYXQgZGV0ZXJtaW5lcyB0aGUgdGltaW5nIG9mIGEgZ2l2ZW4gcXVlcnkgYnkgaW5zcGVjdGluZyBob3dcbiAqIHRoZSBxdWVyeSBpcyBhY2Nlc3NlZCB3aXRoaW4gdGhlIHByb2plY3QncyBUeXBlU2NyaXB0IHNvdXJjZSBmaWxlcy4gUmVhZCBtb3JlIGFib3V0XG4gKiB0aGlzIHN0cmF0ZWd5IGhlcmU6IGh0dHBzOi8vaGFja21kLmlvL3MvSHltdmMyT0tFXG4gKi9cbmV4cG9ydCBjbGFzcyBRdWVyeVVzYWdlU3RyYXRlZ3kgaW1wbGVtZW50cyBUaW1pbmdTdHJhdGVneSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xhc3NNZXRhZGF0YTogQ2xhc3NNZXRhZGF0YU1hcCwgcHJpdmF0ZSB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIpIHt9XG5cbiAgc2V0dXAoKSB7fVxuXG4gIC8qKlxuICAgKiBBbmFseXplcyB0aGUgdXNhZ2Ugb2YgdGhlIGdpdmVuIHF1ZXJ5IGFuZCBkZXRlcm1pbmVzIHRoZSBxdWVyeSB0aW1pbmcgYmFzZWRcbiAgICogb24gdGhlIGN1cnJlbnQgdXNhZ2Ugb2YgdGhlIHF1ZXJ5LlxuICAgKi9cbiAgZGV0ZWN0VGltaW5nKHF1ZXJ5OiBOZ1F1ZXJ5RGVmaW5pdGlvbik6IFRpbWluZ1Jlc3VsdCB7XG4gICAgaWYgKHF1ZXJ5LnByb3BlcnR5ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4ge3RpbWluZzogbnVsbCwgbWVzc2FnZTogJ1F1ZXJpZXMgZGVmaW5lZCBvbiBhY2Nlc3NvcnMgY2Fubm90IGJlIGFuYWx5emVkLid9O1xuICAgIH1cblxuICAgIGNvbnN0IHVzYWdlID0gdGhpcy5hbmFseXplUXVlcnlVc2FnZShxdWVyeS5jb250YWluZXIsIHF1ZXJ5LCBbXSk7XG5cbiAgICBpZiAodXNhZ2UgPT09IFJlc29sdmVkVXNhZ2UuQU1CSUdVT1VTKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0aW1pbmc6IFF1ZXJ5VGltaW5nLlNUQVRJQyxcbiAgICAgICAgbWVzc2FnZTogJ1F1ZXJ5IHRpbWluZyBpcyBhbWJpZ3VvdXMuIFBsZWFzZSBjaGVjayBpZiB0aGUgcXVlcnkgY2FuIGJlIG1hcmtlZCBhcyBkeW5hbWljLidcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh1c2FnZSA9PT0gUmVzb2x2ZWRVc2FnZS5TWU5DSFJPTk9VUykge1xuICAgICAgcmV0dXJuIHt0aW1pbmc6IFF1ZXJ5VGltaW5nLlNUQVRJQ307XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7dGltaW5nOiBRdWVyeVRpbWluZy5EWU5BTUlDfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBxdWVyeSBpcyB1c2VkIHN0YXRpY2FsbHkgd2l0aGluIHRoZSBnaXZlbiBjbGFzcywgaXRzIHN1cGVyXG4gICAqIGNsYXNzIG9yIGRlcml2ZWQgY2xhc3Nlcy5cbiAgICovXG4gIHByaXZhdGUgYW5hbHl6ZVF1ZXJ5VXNhZ2UoXG4gICAgICBjbGFzc0RlY2w6IHRzLkNsYXNzRGVjbGFyYXRpb24sIHF1ZXJ5OiBOZ1F1ZXJ5RGVmaW5pdGlvbiwga25vd25JbnB1dE5hbWVzOiBzdHJpbmdbXSxcbiAgICAgIGZ1bmN0aW9uQ3R4OiBGdW5jdGlvbkNvbnRleHQgPSBuZXcgTWFwKCksIHZpc2l0SW5oZXJpdGVkQ2xhc3NlcyA9IHRydWUpOiBSZXNvbHZlZFVzYWdlIHtcbiAgICBjb25zdCB1c2FnZVZpc2l0b3IgPVxuICAgICAgICBuZXcgRGVjbGFyYXRpb25Vc2FnZVZpc2l0b3IocXVlcnkucHJvcGVydHkhLCB0aGlzLnR5cGVDaGVja2VyLCBmdW5jdGlvbkN0eCk7XG4gICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuY2xhc3NNZXRhZGF0YS5nZXQoY2xhc3NEZWNsKTtcbiAgICBsZXQgdXNhZ2U6IFJlc29sdmVkVXNhZ2UgPSBSZXNvbHZlZFVzYWdlLkFTWU5DSFJPTk9VUztcblxuICAgIC8vIEluIGNhc2UgdGhlcmUgaXMgbWV0YWRhdGEgZm9yIHRoZSBjdXJyZW50IGNsYXNzLCB3ZSBjb2xsZWN0IGFsbCByZXNvbHZlZCBBbmd1bGFyIGlucHV0XG4gICAgLy8gbmFtZXMgYW5kIGFkZCB0aGVtIHRvIHRoZSBsaXN0IG9mIGtub3duIGlucHV0cyB0aGF0IG5lZWQgdG8gYmUgY2hlY2tlZCBmb3IgdXNhZ2VzIG9mXG4gICAgLy8gdGhlIGN1cnJlbnQgcXVlcnkuIGUuZy4gcXVlcmllcyB1c2VkIGluIGFuIEBJbnB1dCgpICpzZXR0ZXIqIGFyZSBhbHdheXMgc3RhdGljLlxuICAgIGlmIChjbGFzc01ldGFkYXRhKSB7XG4gICAgICBrbm93bklucHV0TmFtZXMucHVzaCguLi5jbGFzc01ldGFkYXRhLm5nSW5wdXROYW1lcyk7XG4gICAgfVxuXG4gICAgLy8gQXJyYXkgb2YgVHlwZVNjcmlwdCBub2RlcyB3aGljaCBjYW4gY29udGFpbiB1c2FnZXMgb2YgdGhlIGdpdmVuIHF1ZXJ5IGluXG4gICAgLy8gb3JkZXIgdG8gYWNjZXNzIGl0IHN0YXRpY2FsbHkuXG4gICAgY29uc3QgcG9zc2libGVTdGF0aWNRdWVyeU5vZGVzID0gZmlsdGVyUXVlcnlDbGFzc01lbWJlck5vZGVzKGNsYXNzRGVjbCwgcXVlcnksIGtub3duSW5wdXROYW1lcyk7XG5cbiAgICAvLyBJbiBjYXNlIG5vZGVzIHRoYXQgY2FuIHBvc3NpYmx5IGFjY2VzcyBhIHF1ZXJ5IHN0YXRpY2FsbHkgaGF2ZSBiZWVuIGZvdW5kLCBjaGVja1xuICAgIC8vIGlmIHRoZSBxdWVyeSBkZWNsYXJhdGlvbiBpcyBzeW5jaHJvbm91c2x5IHVzZWQgd2l0aGluIGFueSBvZiB0aGVzZSBub2Rlcy5cbiAgICBpZiAocG9zc2libGVTdGF0aWNRdWVyeU5vZGVzLmxlbmd0aCkge1xuICAgICAgcG9zc2libGVTdGF0aWNRdWVyeU5vZGVzLmZvckVhY2goXG4gICAgICAgICAgbiA9PiB1c2FnZSA9IGNvbWJpbmVSZXNvbHZlZFVzYWdlKHVzYWdlLCB1c2FnZVZpc2l0b3IuZ2V0UmVzb2x2ZWROb2RlVXNhZ2UobikpKTtcbiAgICB9XG5cbiAgICBpZiAoIWNsYXNzTWV0YWRhdGEpIHtcbiAgICAgIHJldHVybiB1c2FnZTtcbiAgICB9XG5cbiAgICAvLyBJbiBjYXNlIHRoZXJlIGlzIGEgY29tcG9uZW50IHRlbXBsYXRlIGZvciB0aGUgY3VycmVudCBjbGFzcywgd2UgY2hlY2sgaWYgdGhlXG4gICAgLy8gdGVtcGxhdGUgc3RhdGljYWxseSBhY2Nlc3NlcyB0aGUgY3VycmVudCBxdWVyeS4gSW4gY2FzZSB0aGF0J3MgdHJ1ZSwgdGhlIHF1ZXJ5XG4gICAgLy8gY2FuIGJlIG1hcmtlZCBhcyBzdGF0aWMuXG4gICAgaWYgKGNsYXNzTWV0YWRhdGEudGVtcGxhdGUgJiYgaGFzUHJvcGVydHlOYW1lVGV4dChxdWVyeS5wcm9wZXJ0eSEubmFtZSkpIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlID0gY2xhc3NNZXRhZGF0YS50ZW1wbGF0ZTtcbiAgICAgIGNvbnN0IHBhcnNlZEh0bWwgPSBwYXJzZUh0bWxHcmFjZWZ1bGx5KHRlbXBsYXRlLmNvbnRlbnQsIHRlbXBsYXRlLmZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGh0bWxWaXNpdG9yID0gbmV3IFRlbXBsYXRlVXNhZ2VWaXNpdG9yKHF1ZXJ5LnByb3BlcnR5IS5uYW1lLnRleHQpO1xuXG4gICAgICBpZiAocGFyc2VkSHRtbCAmJiBodG1sVmlzaXRvci5pc1F1ZXJ5VXNlZFN0YXRpY2FsbHkocGFyc2VkSHRtbCkpIHtcbiAgICAgICAgcmV0dXJuIFJlc29sdmVkVXNhZ2UuU1lOQ0hST05PVVM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSW4gY2FzZSBkZXJpdmVkIGNsYXNzZXMgc2hvdWxkIGFsc28gYmUgYW5hbHl6ZWQsIHdlIGRldGVybWluZSB0aGUgY2xhc3NlcyB0aGF0IGRlcml2ZVxuICAgIC8vIGZyb20gdGhlIGN1cnJlbnQgY2xhc3MgYW5kIGNoZWNrIGlmIHRoZXNlIGhhdmUgaW5wdXQgc2V0dGVycyBvciBsaWZlY3ljbGUgaG9va3MgdGhhdFxuICAgIC8vIHVzZSB0aGUgcXVlcnkgc3RhdGljYWxseS5cbiAgICBpZiAodmlzaXRJbmhlcml0ZWRDbGFzc2VzKSB7XG4gICAgICBjbGFzc01ldGFkYXRhLmRlcml2ZWRDbGFzc2VzLmZvckVhY2goZGVyaXZlZENsYXNzID0+IHtcbiAgICAgICAgdXNhZ2UgPSBjb21iaW5lUmVzb2x2ZWRVc2FnZShcbiAgICAgICAgICAgIHVzYWdlLCB0aGlzLmFuYWx5emVRdWVyeVVzYWdlKGRlcml2ZWRDbGFzcywgcXVlcnksIGtub3duSW5wdXROYW1lcykpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSW4gY2FzZSB0aGUgY3VycmVudCBjbGFzcyBoYXMgYSBzdXBlciBjbGFzcywgd2UgZGV0ZXJtaW5lIGRlY2xhcmVkIGFic3RyYWN0IGZ1bmN0aW9uLWxpa2VcbiAgICAvLyBkZWNsYXJhdGlvbnMgaW4gdGhlIHN1cGVyLWNsYXNzIHRoYXQgYXJlIGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IGNsYXNzLiBUaGUgc3VwZXIgY2xhc3NcbiAgICAvLyB3aWxsIHRoZW4gYmUgYW5hbHl6ZWQgd2l0aCB0aGUgYWJzdHJhY3QgZGVjbGFyYXRpb25zIG1hcHBlZCB0byB0aGUgaW1wbGVtZW50ZWQgVHlwZVNjcmlwdFxuICAgIC8vIG5vZGVzLiBUaGlzIGFsbG93cyB1cyB0byBoYW5kbGUgcXVlcmllcyB3aGljaCBhcmUgdXNlZCBpbiBzdXBlciBjbGFzc2VzIHRocm91Z2ggZGVyaXZlZFxuICAgIC8vIGFic3RyYWN0IG1ldGhvZCBkZWNsYXJhdGlvbnMuXG4gICAgaWYgKGNsYXNzTWV0YWRhdGEuc3VwZXJDbGFzcykge1xuICAgICAgY29uc3Qgc3VwZXJDbGFzc0RlY2wgPSBjbGFzc01ldGFkYXRhLnN1cGVyQ2xhc3M7XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgZnVuY3Rpb24gY29udGV4dCB0byBtYXAgYWJzdHJhY3QgZGVjbGFyYXRpb24gbm9kZXMgdG8gdGhlaXIgaW1wbGVtZW50YXRpb25cbiAgICAgIC8vIG5vZGUgaW4gdGhlIGJhc2UgY2xhc3MuIFRoaXMgZW5zdXJlcyB0aGF0IHRoZSBkZWNsYXJhdGlvbiB1c2FnZSB2aXNpdG9yIGNhbiBhbmFseXplXG4gICAgICAvLyBhYnN0cmFjdCBjbGFzcyBtZW1iZXIgZGVjbGFyYXRpb25zLlxuICAgICAgdXBkYXRlU3VwZXJDbGFzc0Fic3RyYWN0TWVtYmVyc0NvbnRleHQoY2xhc3NEZWNsLCBmdW5jdGlvbkN0eCwgdGhpcy5jbGFzc01ldGFkYXRhKTtcblxuICAgICAgdXNhZ2UgPSBjb21iaW5lUmVzb2x2ZWRVc2FnZShcbiAgICAgICAgICB1c2FnZSwgdGhpcy5hbmFseXplUXVlcnlVc2FnZShzdXBlckNsYXNzRGVjbCwgcXVlcnksIFtdLCBmdW5jdGlvbkN0eCwgZmFsc2UpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXNhZ2U7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21iaW5lcyB0d28gcmVzb2x2ZWQgdXNhZ2VzIGJhc2VkIG9uIGEgZml4ZWQgcHJpb3JpdHkuIFwiU3luY2hyb25vdXNcIiB0YWtlc1xuICogcHJlY2VkZW5jZSBvdmVyIFwiQW1iaWd1b3VzXCIgd2hlcmVhcyBhbWJpZ3VvdXMgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIFwiQXN5bmNocm9ub3VzXCIuXG4gKi9cbmZ1bmN0aW9uIGNvbWJpbmVSZXNvbHZlZFVzYWdlKGJhc2U6IFJlc29sdmVkVXNhZ2UsIHRhcmdldDogUmVzb2x2ZWRVc2FnZSk6IFJlc29sdmVkVXNhZ2Uge1xuICBpZiAoYmFzZSA9PT0gUmVzb2x2ZWRVc2FnZS5TWU5DSFJPTk9VUykge1xuICAgIHJldHVybiBiYXNlO1xuICB9IGVsc2UgaWYgKHRhcmdldCAhPT0gUmVzb2x2ZWRVc2FnZS5BU1lOQ0hST05PVVMpIHtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBSZXNvbHZlZFVzYWdlLkFTWU5DSFJPTk9VUztcbiAgfVxufVxuXG4vKipcbiAqIEZpbHRlcnMgYWxsIGNsYXNzIG1lbWJlcnMgZnJvbSB0aGUgY2xhc3MgZGVjbGFyYXRpb24gdGhhdCBjYW4gYWNjZXNzIHRoZVxuICogZ2l2ZW4gcXVlcnkgc3RhdGljYWxseSAoZS5nLiBuZ09uSW5pdCBsaWZlY3ljbGUgaG9vayBvciBASW5wdXQgc2V0dGVycylcbiAqL1xuZnVuY3Rpb24gZmlsdGVyUXVlcnlDbGFzc01lbWJlck5vZGVzKFxuICAgIGNsYXNzRGVjbDogdHMuQ2xhc3NEZWNsYXJhdGlvbiwgcXVlcnk6IE5nUXVlcnlEZWZpbml0aW9uLFxuICAgIGtub3duSW5wdXROYW1lczogc3RyaW5nW10pOiB0cy5CbG9ja1tdIHtcbiAgLy8gUmV0dXJucyBhbiBhcnJheSBvZiBUeXBlU2NyaXB0IG5vZGVzIHdoaWNoIGNhbiBjb250YWluIHVzYWdlcyBvZiB0aGUgZ2l2ZW4gcXVlcnlcbiAgLy8gaW4gb3JkZXIgdG8gYWNjZXNzIGl0IHN0YXRpY2FsbHkuIGUuZy5cbiAgLy8gICgxKSBxdWVyaWVzIHVzZWQgaW4gdGhlIFwibmdPbkluaXRcIiBsaWZlY3ljbGUgaG9vayBhcmUgc3RhdGljLlxuICAvLyAgKDIpIGlucHV0cyB3aXRoIHNldHRlcnMgY2FuIGFjY2VzcyBxdWVyaWVzIHN0YXRpY2FsbHkuXG4gIHJldHVybiBjbGFzc0RlY2wubWVtYmVyc1xuICAgICAgLmZpbHRlcihcbiAgICAgICAgICAobSk6XG4gICAgICAgICAgICAgIG0gaXModHMuU2V0QWNjZXNzb3JEZWNsYXJhdGlvbiB8IHRzLk1ldGhvZERlY2xhcmF0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRzLmlzTWV0aG9kRGVjbGFyYXRpb24obSkgJiYgbS5ib2R5ICYmIGhhc1Byb3BlcnR5TmFtZVRleHQobS5uYW1lKSAmJlxuICAgICAgICAgICAgICAgICAgICBTVEFUSUNfUVVFUllfTElGRUNZQ0xFX0hPT0tTW3F1ZXJ5LnR5cGVdLmluZGV4T2YobS5uYW1lLnRleHQpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgICAgICAga25vd25JbnB1dE5hbWVzICYmIHRzLmlzU2V0QWNjZXNzb3IobSkgJiYgbS5ib2R5ICYmXG4gICAgICAgICAgICAgICAgICAgIGhhc1Byb3BlcnR5TmFtZVRleHQobS5uYW1lKSAmJiBrbm93bklucHV0TmFtZXMuaW5kZXhPZihtLm5hbWUudGV4dCkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICB9KVxuICAgICAgLm1hcChtZW1iZXIgPT4gbWVtYmVyLmJvZHkhKTtcbn1cbiJdfQ==