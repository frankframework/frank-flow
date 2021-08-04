/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileStylesheetMetadata, ElementAst, EmbeddedTemplateAst } from '@angular/compiler';
import { createProgram, readConfiguration } from '@angular/compiler-cli';
import { resolve } from 'path';
import * as ts from 'typescript';
import { QueryTiming, QueryType } from '../../angular/query-definition';
const QUERY_NOT_DECLARED_IN_COMPONENT_MESSAGE = 'Timing could not be determined. This happens ' +
    'if the query is not declared in any component.';
export class QueryTemplateStrategy {
    constructor(projectPath, classMetadata, host) {
        this.projectPath = projectPath;
        this.classMetadata = classMetadata;
        this.host = host;
        this.compiler = null;
        this.metadataResolver = null;
        this.analyzedQueries = new Map();
    }
    /**
     * Sets up the template strategy by creating the AngularCompilerProgram. Returns false if
     * the AOT compiler program could not be created due to failure diagnostics.
     */
    setup() {
        const { rootNames, options } = readConfiguration(this.projectPath);
        // https://github.com/angular/angular/commit/ec4381dd401f03bded652665b047b6b90f2b425f made Ivy
        // the default. This breaks the assumption that "createProgram" from compiler-cli returns the
        // NGC program. In order to ensure that the migration runs properly, we set "enableIvy" to
        // false.
        options.enableIvy = false;
        const aotProgram = createProgram({ rootNames, options, host: this.host });
        // The "AngularCompilerProgram" does not expose the "AotCompiler" instance, nor does it
        // expose the logic that is necessary to analyze the determined modules. We work around
        // this by just accessing the necessary private properties using the bracket notation.
        this.compiler = aotProgram['compiler'];
        this.metadataResolver = this.compiler['_metadataResolver'];
        // Modify the "DirectiveNormalizer" to not normalize any referenced external stylesheets.
        // This is necessary because in CLI projects preprocessor files are commonly referenced
        // and we don't want to parse them in order to extract relative style references. This
        // breaks the analysis of the project because we instantiate a standalone AOT compiler
        // program which does not contain the custom logic by the Angular CLI Webpack compiler plugin.
        const directiveNormalizer = this.metadataResolver['_directiveNormalizer'];
        directiveNormalizer['_normalizeStylesheet'] = function (metadata) {
            return new CompileStylesheetMetadata({ styles: metadata.styles, styleUrls: [], moduleUrl: metadata.moduleUrl });
        };
        // Retrieves the analyzed modules of the current program. This data can be
        // used to determine the timing for registered queries.
        const analyzedModules = aotProgram['analyzedModules'];
        const ngStructuralDiagnostics = aotProgram.getNgStructuralDiagnostics();
        if (ngStructuralDiagnostics.length) {
            throw this._createDiagnosticsError(ngStructuralDiagnostics);
        }
        analyzedModules.files.forEach(file => {
            file.directives.forEach(directive => this._analyzeDirective(directive, analyzedModules));
        });
    }
    /** Analyzes a given directive by determining the timing of all matched view queries. */
    _analyzeDirective(symbol, analyzedModules) {
        const metadata = this.metadataResolver.getDirectiveMetadata(symbol);
        const ngModule = analyzedModules.ngModuleByPipeOrDirective.get(symbol);
        if (!metadata.isComponent || !ngModule) {
            return;
        }
        const parsedTemplate = this._parseTemplate(metadata, ngModule);
        const queryTimingMap = findStaticQueryIds(parsedTemplate);
        const { staticQueryIds } = staticViewQueryIds(queryTimingMap);
        metadata.viewQueries.forEach((query, index) => {
            // Query ids are computed by adding "one" to the index. This is done within
            // the "view_compiler.ts" in order to support using a bloom filter for queries.
            const queryId = index + 1;
            const queryKey = this._getViewQueryUniqueKey(symbol.filePath, symbol.name, query.propertyName);
            this.analyzedQueries.set(queryKey, staticQueryIds.has(queryId) ? QueryTiming.STATIC : QueryTiming.DYNAMIC);
        });
    }
    /** Detects the timing of the query definition. */
    detectTiming(query) {
        if (query.type === QueryType.ContentChild) {
            return { timing: null, message: 'Content queries cannot be migrated automatically.' };
        }
        else if (!query.name) {
            // In case the query property name is not statically analyzable, we mark this
            // query as unresolved. NGC currently skips these view queries as well.
            return { timing: null, message: 'Query is not statically analyzable.' };
        }
        const propertyName = query.name;
        const classMetadata = this.classMetadata.get(query.container);
        // In case there is no class metadata or there are no derived classes that
        // could access the current query, we just look for the query analysis of
        // the class that declares the query. e.g. only the template of the class
        // that declares the view query affects the query timing.
        if (!classMetadata || !classMetadata.derivedClasses.length) {
            const timing = this._getQueryTimingFromClass(query.container, propertyName);
            if (timing === null) {
                return { timing: null, message: QUERY_NOT_DECLARED_IN_COMPONENT_MESSAGE };
            }
            return { timing };
        }
        let resolvedTiming = null;
        let timingMismatch = false;
        // In case there are multiple components that use the same query (e.g. through inheritance),
        // we need to check if all components use the query with the same timing. If that is not
        // the case, the query timing is ambiguous and the developer needs to fix the query manually.
        [query.container, ...classMetadata.derivedClasses].forEach(classDecl => {
            const classTiming = this._getQueryTimingFromClass(classDecl, propertyName);
            if (classTiming === null) {
                return;
            }
            // In case there is no resolved timing yet, save the new timing. Timings from other
            // components that use the query with a different timing, cause the timing to be
            // mismatched. In that case we can't detect a working timing for all components.
            if (resolvedTiming === null) {
                resolvedTiming = classTiming;
            }
            else if (resolvedTiming !== classTiming) {
                timingMismatch = true;
            }
        });
        if (resolvedTiming === null) {
            return { timing: QueryTiming.DYNAMIC, message: QUERY_NOT_DECLARED_IN_COMPONENT_MESSAGE };
        }
        else if (timingMismatch) {
            return { timing: null, message: 'Multiple components use the query with different timings.' };
        }
        return { timing: resolvedTiming };
    }
    /**
     * Gets the timing that has been resolved for a given query when it's used within the
     * specified class declaration. e.g. queries from an inherited class can be used.
     */
    _getQueryTimingFromClass(classDecl, queryName) {
        if (!classDecl.name) {
            return null;
        }
        const filePath = classDecl.getSourceFile().fileName;
        const queryKey = this._getViewQueryUniqueKey(filePath, classDecl.name.text, queryName);
        if (this.analyzedQueries.has(queryKey)) {
            return this.analyzedQueries.get(queryKey);
        }
        return null;
    }
    _parseTemplate(component, ngModule) {
        return this
            .compiler['_parseTemplate'](component, ngModule, ngModule.transitiveModule.directives)
            .template;
    }
    _createDiagnosticsError(diagnostics) {
        return new Error(ts.formatDiagnostics(diagnostics, this.host));
    }
    _getViewQueryUniqueKey(filePath, className, propName) {
        return `${resolve(filePath)}#${className}-${propName}`;
    }
}
/** Figures out which queries are static and which ones are dynamic. */
function findStaticQueryIds(nodes, result = new Map()) {
    nodes.forEach((node) => {
        const staticQueryIds = new Set();
        const dynamicQueryIds = new Set();
        let queryMatches = undefined;
        if (node instanceof ElementAst) {
            findStaticQueryIds(node.children, result);
            node.children.forEach((child) => {
                const childData = result.get(child);
                childData.staticQueryIds.forEach(queryId => staticQueryIds.add(queryId));
                childData.dynamicQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
            });
            queryMatches = node.queryMatches;
        }
        else if (node instanceof EmbeddedTemplateAst) {
            findStaticQueryIds(node.children, result);
            node.children.forEach((child) => {
                const childData = result.get(child);
                childData.staticQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
                childData.dynamicQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
            });
            queryMatches = node.queryMatches;
        }
        if (queryMatches) {
            queryMatches.forEach((match) => staticQueryIds.add(match.queryId));
        }
        dynamicQueryIds.forEach(queryId => staticQueryIds.delete(queryId));
        result.set(node, { staticQueryIds, dynamicQueryIds });
    });
    return result;
}
/** Splits queries into static and dynamic. */
function staticViewQueryIds(nodeStaticQueryIds) {
    const staticQueryIds = new Set();
    const dynamicQueryIds = new Set();
    Array.from(nodeStaticQueryIds.values()).forEach((entry) => {
        entry.staticQueryIds.forEach(queryId => staticQueryIds.add(queryId));
        entry.dynamicQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
    });
    dynamicQueryIds.forEach(queryId => staticQueryIds.delete(queryId));
    return { staticQueryIds, dynamicQueryIds };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfc3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy9zdGF0aWMtcXVlcmllcy9zdHJhdGVnaWVzL3RlbXBsYXRlX3N0cmF0ZWd5L3RlbXBsYXRlX3N0cmF0ZWd5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBMEYseUJBQXlCLEVBQUUsVUFBVSxFQUFFLG1CQUFtQixFQUEyRCxNQUFNLG1CQUFtQixDQUFDO0FBQ2hQLE9BQU8sRUFBQyxhQUFhLEVBQWMsaUJBQWlCLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUNuRixPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBR2pDLE9BQU8sRUFBb0IsV0FBVyxFQUFFLFNBQVMsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBR3pGLE1BQU0sdUNBQXVDLEdBQUcsK0NBQStDO0lBQzNGLGdEQUFnRCxDQUFDO0FBRXJELE1BQU0sT0FBTyxxQkFBcUI7SUFLaEMsWUFDWSxXQUFtQixFQUFVLGFBQStCLEVBQzVELElBQXFCO1FBRHJCLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQVUsa0JBQWEsR0FBYixhQUFhLENBQWtCO1FBQzVELFNBQUksR0FBSixJQUFJLENBQWlCO1FBTnpCLGFBQVEsR0FBcUIsSUFBSSxDQUFDO1FBQ2xDLHFCQUFnQixHQUFpQyxJQUFJLENBQUM7UUFDdEQsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBdUIsQ0FBQztJQUlyQixDQUFDO0lBRXJDOzs7T0FHRztJQUNILEtBQUs7UUFDSCxNQUFNLEVBQUMsU0FBUyxFQUFFLE9BQU8sRUFBQyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUVqRSw4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QUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ3BFO1FBQ0QsZUFBZSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNuRSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFDLGNBQWMsRUFBRSxlQUFlLEVBQUMsQ0FBQyxDQUFDO0lBQ3RELENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVELDhDQUE4QztBQUM5QyxTQUFTLGtCQUFrQixDQUFDLGtCQUE4RDtJQUV4RixNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ3pDLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFDMUMsS0FBSyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1FBQ3hELEtBQUssQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLEtBQUssQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3pFLENBQUMsQ0FBQyxDQUFDO0lBQ0gsZUFBZSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNuRSxPQUFPLEVBQUMsY0FBYyxFQUFFLGVBQWUsRUFBQyxDQUFDO0FBQzNDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBb3RDb21waWxlciwgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlTWV0YWRhdGFSZXNvbHZlciwgQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsIENvbXBpbGVTdHlsZXNoZWV0TWV0YWRhdGEsIEVsZW1lbnRBc3QsIEVtYmVkZGVkVGVtcGxhdGVBc3QsIE5nQW5hbHl6ZWRNb2R1bGVzLCBRdWVyeU1hdGNoLCBTdGF0aWNTeW1ib2wsIFRlbXBsYXRlQXN0fSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQge2NyZWF0ZVByb2dyYW0sIERpYWdub3N0aWMsIHJlYWRDb25maWd1cmF0aW9ufSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtyZXNvbHZlfSBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0NsYXNzTWV0YWRhdGFNYXB9IGZyb20gJy4uLy4uL2FuZ3VsYXIvbmdfcXVlcnlfdmlzaXRvcic7XG5pbXBvcnQge05nUXVlcnlEZWZpbml0aW9uLCBRdWVyeVRpbWluZywgUXVlcnlUeXBlfSBmcm9tICcuLi8uLi9hbmd1bGFyL3F1ZXJ5LWRlZmluaXRpb24nO1xuaW1wb3J0IHtUaW1pbmdSZXN1bHQsIFRpbWluZ1N0cmF0ZWd5fSBmcm9tICcuLi90aW1pbmctc3RyYXRlZ3knO1xuXG5jb25zdCBRVUVSWV9OT1RfREVDTEFSRURfSU5fQ09NUE9ORU5UX01FU1NBR0UgPSAnVGltaW5nIGNvdWxkIG5vdCBiZSBkZXRlcm1pbmVkLiBUaGlzIGhhcHBlbnMgJyArXG4gICAgJ2lmIHRoZSBxdWVyeSBpcyBub3QgZGVjbGFyZWQgaW4gYW55IGNvbXBvbmVudC4nO1xuXG5leHBvcnQgY2xhc3MgUXVlcnlUZW1wbGF0ZVN0cmF0ZWd5IGltcGxlbWVudHMgVGltaW5nU3RyYXRlZ3kge1xuICBwcml2YXRlIGNvbXBpbGVyOiBBb3RDb21waWxlcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBtZXRhZGF0YVJlc29sdmVyOiBDb21waWxlTWV0YWRhdGFSZXNvbHZlcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBhbmFseXplZFF1ZXJpZXMgPSBuZXcgTWFwPHN0cmluZywgUXVlcnlUaW1pbmc+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHByb2plY3RQYXRoOiBzdHJpbmcsIHByaXZhdGUgY2xhc3NNZXRhZGF0YTogQ2xhc3NNZXRhZGF0YU1hcCxcbiAgICAgIHByaXZhdGUgaG9zdDogdHMuQ29tcGlsZXJIb3N0KSB7fVxuXG4gIC8qKlxuICAgKiBTZXRzIHVwIHRoZSB0ZW1wbGF0ZSBzdHJhdGVneSBieSBjcmVhdGluZyB0aGUgQW5ndWxhckNvbXBpbGVyUHJvZ3JhbS4gUmV0dXJucyBmYWxzZSBpZlxuICAgKiB0aGUgQU9UIGNvbXBpbGVyIHByb2dyYW0gY291bGQgbm90IGJlIGNyZWF0ZWQgZHVlIHRvIGZhaWx1cmUgZGlhZ25vc3RpY3MuXG4gICAqL1xuICBzZXR1cCgpIHtcbiAgICBjb25zdCB7cm9vdE5hbWVzLCBvcHRpb25zfSA9IHJlYWRDb25maWd1cmF0aW9uKHRoaXMucHJvamVjdFBhdGgpO1xuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9jb21taXQvZWM0MzgxZGQ0MDFmMDNiZGVkNjUyNjY1YjA0N2I2YjkwZjJiNDI1ZiBtYWRlIEl2eVxuICAgIC8vIHRoZSBkZWZhdWx0LiBUaGlzIGJyZWFrcyB0aGUgYXNzdW1wdGlvbiB0aGF0IFwiY3JlYXRlUHJvZ3JhbVwiIGZyb20gY29tcGlsZXItY2xpIHJldHVybnMgdGhlXG4gICAgLy8gTkdDIHByb2dyYW0uIEluIG9yZGVyIHRvIGVuc3VyZSB0aGF0IHRoZSBtaWdyYXRpb24gcnVucyBwcm9wZXJseSwgd2Ugc2V0IFwiZW5hYmxlSXZ5XCIgdG9cbiAgICAvLyBmYWxzZS5cbiAgICBvcHRpb25zLmVuYWJsZUl2eSA9IGZhbHNlO1xuXG4gICAgY29uc3QgYW90UHJvZ3JhbSA9IGNyZWF0ZVByb2dyYW0oe3Jvb3ROYW1lcywgb3B0aW9ucywgaG9zdDogdGhpcy5ob3N0fSk7XG5cbiAgICAvLyBUaGUgXCJBbmd1bGFyQ29tcGlsZXJQcm9ncmFtXCIgZG9lcyBub3QgZXhwb3NlIHRoZSBcIkFvdENvbXBpbGVyXCIgaW5zdGFuY2UsIG5vciBkb2VzIGl0XG4gICAgLy8gZXhwb3NlIHRoZSBsb2dpYyB0aGF0IGlzIG5lY2Vzc2FyeSB0byBhbmFseXplIHRoZSBkZXRlcm1pbmVkIG1vZHVsZXMuIFdlIHdvcmsgYXJvdW5kXG4gICAgLy8gdGhpcyBieSBqdXN0IGFjY2Vzc2luZyB0aGUgbmVjZXNzYXJ5IHByaXZhdGUgcHJvcGVydGllcyB1c2luZyB0aGUgYnJhY2tldCBub3RhdGlvbi5cbiAgICB0aGlzLmNvbXBpbGVyID0gKGFvdFByb2dyYW0gYXMgYW55KVsnY29tcGlsZXInXTtcbiAgICB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIgPSB0aGlzLmNvbXBpbGVyIVsnX21ldGFkYXRhUmVzb2x2ZXInXTtcblxuICAgIC8vIE1vZGlmeSB0aGUgXCJEaXJlY3RpdmVOb3JtYWxpemVyXCIgdG8gbm90IG5vcm1hbGl6ZSBhbnkgcmVmZXJlbmNlZCBleHRlcm5hbCBzdHlsZXNoZWV0cy5cbiAgICAvLyBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGluIENMSSBwcm9qZWN0cyBwcmVwcm9jZXNzb3IgZmlsZXMgYXJlIGNvbW1vbmx5IHJlZmVyZW5jZWRcbiAgICAvLyBhbmQgd2UgZG9uJ3Qgd2FudCB0byBwYXJzZSB0aGVtIGluIG9yZGVyIHRvIGV4dHJhY3QgcmVsYXRpdmUgc3R5bGUgcmVmZXJlbmNlcy4gVGhpc1xuICAgIC8vIGJyZWFrcyB0aGUgYW5hbHlzaXMgb2YgdGhlIHByb2plY3QgYmVjYXVzZSB3ZSBpbnN0YW50aWF0ZSBhIHN0YW5kYWxvbmUgQU9UIGNvbXBpbGVyXG4gICAgLy8gcHJvZ3JhbSB3aGljaCBkb2VzIG5vdCBjb250YWluIHRoZSBjdXN0b20gbG9naWMgYnkgdGhlIEFuZ3VsYXIgQ0xJIFdlYnBhY2sgY29tcGlsZXIgcGx1Z2luLlxuICAgIGNvbnN0IGRpcmVjdGl2ZU5vcm1hbGl6ZXIgPSB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIhWydfZGlyZWN0aXZlTm9ybWFsaXplciddO1xuICAgIGRpcmVjdGl2ZU5vcm1hbGl6ZXJbJ19ub3JtYWxpemVTdHlsZXNoZWV0J10gPSBmdW5jdGlvbihtZXRhZGF0YTogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YSkge1xuICAgICAgcmV0dXJuIG5ldyBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhKFxuICAgICAgICAgIHtzdHlsZXM6IG1ldGFkYXRhLnN0eWxlcywgc3R5bGVVcmxzOiBbXSwgbW9kdWxlVXJsOiBtZXRhZGF0YS5tb2R1bGVVcmwhfSk7XG4gICAgfTtcblxuICAgIC8vIFJldHJpZXZlcyB0aGUgYW5hbHl6ZWQgbW9kdWxlcyBvZiB0aGUgY3VycmVudCBwcm9ncmFtLiBUaGlzIGRhdGEgY2FuIGJlXG4gICAgLy8gdXNlZCB0byBkZXRlcm1pbmUgdGhlIHRpbWluZyBmb3IgcmVnaXN0ZXJlZCBxdWVyaWVzLlxuICAgIGNvbnN0IGFuYWx5emVkTW9kdWxlcyA9IChhb3RQcm9ncmFtIGFzIGFueSlbJ2FuYWx5emVkTW9kdWxlcyddIGFzIE5nQW5hbHl6ZWRNb2R1bGVzO1xuXG4gICAgY29uc3QgbmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MgPSBhb3RQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCk7XG4gICAgaWYgKG5nU3RydWN0dXJhbERpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRGlhZ25vc3RpY3NFcnJvcihuZ1N0cnVjdHVyYWxEaWFnbm9zdGljcyk7XG4gICAgfVxuXG4gICAgYW5hbHl6ZWRNb2R1bGVzLmZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICBmaWxlLmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmUgPT4gdGhpcy5fYW5hbHl6ZURpcmVjdGl2ZShkaXJlY3RpdmUsIGFuYWx5emVkTW9kdWxlcykpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqIEFuYWx5emVzIGEgZ2l2ZW4gZGlyZWN0aXZlIGJ5IGRldGVybWluaW5nIHRoZSB0aW1pbmcgb2YgYWxsIG1hdGNoZWQgdmlldyBxdWVyaWVzLiAqL1xuICBwcml2YXRlIF9hbmFseXplRGlyZWN0aXZlKHN5bWJvbDogU3RhdGljU3ltYm9sLCBhbmFseXplZE1vZHVsZXM6IE5nQW5hbHl6ZWRNb2R1bGVzKSB7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIhLmdldERpcmVjdGl2ZU1ldGFkYXRhKHN5bWJvbCk7XG4gICAgY29uc3QgbmdNb2R1bGUgPSBhbmFseXplZE1vZHVsZXMubmdNb2R1bGVCeVBpcGVPckRpcmVjdGl2ZS5nZXQoc3ltYm9sKTtcblxuICAgIGlmICghbWV0YWRhdGEuaXNDb21wb25lbnQgfHwgIW5nTW9kdWxlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGFyc2VkVGVtcGxhdGUgPSB0aGlzLl9wYXJzZVRlbXBsYXRlKG1ldGFkYXRhLCBuZ01vZHVsZSk7XG4gICAgY29uc3QgcXVlcnlUaW1pbmdNYXAgPSBmaW5kU3RhdGljUXVlcnlJZHMocGFyc2VkVGVtcGxhdGUpO1xuICAgIGNvbnN0IHtzdGF0aWNRdWVyeUlkc30gPSBzdGF0aWNWaWV3UXVlcnlJZHMocXVlcnlUaW1pbmdNYXApO1xuXG4gICAgbWV0YWRhdGEudmlld1F1ZXJpZXMuZm9yRWFjaCgocXVlcnksIGluZGV4KSA9PiB7XG4gICAgICAvLyBRdWVyeSBpZHMgYXJlIGNvbXB1dGVkIGJ5IGFkZGluZyBcIm9uZVwiIHRvIHRoZSBpbmRleC4gVGhpcyBpcyBkb25lIHdpdGhpblxuICAgICAgLy8gdGhlIFwidmlld19jb21waWxlci50c1wiIGluIG9yZGVyIHRvIHN1cHBvcnQgdXNpbmcgYSBibG9vbSBmaWx0ZXIgZm9yIHF1ZXJpZXMuXG4gICAgICBjb25zdCBxdWVyeUlkID0gaW5kZXggKyAxO1xuICAgICAgY29uc3QgcXVlcnlLZXkgPVxuICAgICAgICAgIHRoaXMuX2dldFZpZXdRdWVyeVVuaXF1ZUtleShzeW1ib2wuZmlsZVBhdGgsIHN5bWJvbC5uYW1lLCBxdWVyeS5wcm9wZXJ0eU5hbWUpO1xuICAgICAgdGhpcy5hbmFseXplZFF1ZXJpZXMuc2V0KFxuICAgICAgICAgIHF1ZXJ5S2V5LCBzdGF0aWNRdWVyeUlkcy5oYXMocXVlcnlJZCkgPyBRdWVyeVRpbWluZy5TVEFUSUMgOiBRdWVyeVRpbWluZy5EWU5BTUlDKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKiBEZXRlY3RzIHRoZSB0aW1pbmcgb2YgdGhlIHF1ZXJ5IGRlZmluaXRpb24uICovXG4gIGRldGVjdFRpbWluZyhxdWVyeTogTmdRdWVyeURlZmluaXRpb24pOiBUaW1pbmdSZXN1bHQge1xuICAgIGlmIChxdWVyeS50eXBlID09PSBRdWVyeVR5cGUuQ29udGVudENoaWxkKSB7XG4gICAgICByZXR1cm4ge3RpbWluZzogbnVsbCwgbWVzc2FnZTogJ0NvbnRlbnQgcXVlcmllcyBjYW5ub3QgYmUgbWlncmF0ZWQgYXV0b21hdGljYWxseS4nfTtcbiAgICB9IGVsc2UgaWYgKCFxdWVyeS5uYW1lKSB7XG4gICAgICAvLyBJbiBjYXNlIHRoZSBxdWVyeSBwcm9wZXJ0eSBuYW1lIGlzIG5vdCBzdGF0aWNhbGx5IGFuYWx5emFibGUsIHdlIG1hcmsgdGhpc1xuICAgICAgLy8gcXVlcnkgYXMgdW5yZXNvbHZlZC4gTkdDIGN1cnJlbnRseSBza2lwcyB0aGVzZSB2aWV3IHF1ZXJpZXMgYXMgd2VsbC5cbiAgICAgIHJldHVybiB7dGltaW5nOiBudWxsLCBtZXNzYWdlOiAnUXVlcnkgaXMgbm90IHN0YXRpY2FsbHkgYW5hbHl6YWJsZS4nfTtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBxdWVyeS5uYW1lO1xuICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmNsYXNzTWV0YWRhdGEuZ2V0KHF1ZXJ5LmNvbnRhaW5lcik7XG5cbiAgICAvLyBJbiBjYXNlIHRoZXJlIGlzIG5vIGNsYXNzIG1ldGFkYXRhIG9yIHRoZXJlIGFyZSBubyBkZXJpdmVkIGNsYXNzZXMgdGhhdFxuICAgIC8vIGNvdWxkIGFjY2VzcyB0aGUgY3VycmVudCBxdWVyeSwgd2UganVzdCBsb29rIGZvciB0aGUgcXVlcnkgYW5hbHlzaXMgb2ZcbiAgICAvLyB0aGUgY2xhc3MgdGhhdCBkZWNsYXJlcyB0aGUgcXVlcnkuIGUuZy4gb25seSB0aGUgdGVtcGxhdGUgb2YgdGhlIGNsYXNzXG4gICAgLy8gdGhhdCBkZWNsYXJlcyB0aGUgdmlldyBxdWVyeSBhZmZlY3RzIHRoZSBxdWVyeSB0aW1pbmcuXG4gICAgaWYgKCFjbGFzc01ldGFkYXRhIHx8ICFjbGFzc01ldGFkYXRhLmRlcml2ZWRDbGFzc2VzLmxlbmd0aCkge1xuICAgICAgY29uc3QgdGltaW5nID0gdGhpcy5fZ2V0UXVlcnlUaW1pbmdGcm9tQ2xhc3MocXVlcnkuY29udGFpbmVyLCBwcm9wZXJ0eU5hbWUpO1xuXG4gICAgICBpZiAodGltaW5nID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB7dGltaW5nOiBudWxsLCBtZXNzYWdlOiBRVUVSWV9OT1RfREVDTEFSRURfSU5fQ09NUE9ORU5UX01FU1NBR0V9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge3RpbWluZ307XG4gICAgfVxuXG4gICAgbGV0IHJlc29sdmVkVGltaW5nOiBRdWVyeVRpbWluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgdGltaW5nTWlzbWF0Y2ggPSBmYWxzZTtcblxuICAgIC8vIEluIGNhc2UgdGhlcmUgYXJlIG11bHRpcGxlIGNvbXBvbmVudHMgdGhhdCB1c2UgdGhlIHNhbWUgcXVlcnkgKGUuZy4gdGhyb3VnaCBpbmhlcml0YW5jZSksXG4gICAgLy8gd2UgbmVlZCB0byBjaGVjayBpZiBhbGwgY29tcG9uZW50cyB1c2UgdGhlIHF1ZXJ5IHdpdGggdGhlIHNhbWUgdGltaW5nLiBJZiB0aGF0IGlzIG5vdFxuICAgIC8vIHRoZSBjYXNlLCB0aGUgcXVlcnkgdGltaW5nIGlzIGFtYmlndW91cyBhbmQgdGhlIGRldmVsb3BlciBuZWVkcyB0byBmaXggdGhlIHF1ZXJ5IG1hbnVhbGx5LlxuICAgIFtxdWVyeS5jb250YWluZXIsIC4uLmNsYXNzTWV0YWRhdGEuZGVyaXZlZENsYXNzZXNdLmZvckVhY2goY2xhc3NEZWNsID0+IHtcbiAgICAgIGNvbnN0IGNsYXNzVGltaW5nID0gdGhpcy5fZ2V0UXVlcnlUaW1pbmdGcm9tQ2xhc3MoY2xhc3NEZWNsLCBwcm9wZXJ0eU5hbWUpO1xuXG4gICAgICBpZiAoY2xhc3NUaW1pbmcgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBJbiBjYXNlIHRoZXJlIGlzIG5vIHJlc29sdmVkIHRpbWluZyB5ZXQsIHNhdmUgdGhlIG5ldyB0aW1pbmcuIFRpbWluZ3MgZnJvbSBvdGhlclxuICAgICAgLy8gY29tcG9uZW50cyB0aGF0IHVzZSB0aGUgcXVlcnkgd2l0aCBhIGRpZmZlcmVudCB0aW1pbmcsIGNhdXNlIHRoZSB0aW1pbmcgdG8gYmVcbiAgICAgIC8vIG1pc21hdGNoZWQuIEluIHRoYXQgY2FzZSB3ZSBjYW4ndCBkZXRlY3QgYSB3b3JraW5nIHRpbWluZyBmb3IgYWxsIGNvbXBvbmVudHMuXG4gICAgICBpZiAocmVzb2x2ZWRUaW1pbmcgPT09IG51bGwpIHtcbiAgICAgICAgcmVzb2x2ZWRUaW1pbmcgPSBjbGFzc1RpbWluZztcbiAgICAgIH0gZWxzZSBpZiAocmVzb2x2ZWRUaW1pbmcgIT09IGNsYXNzVGltaW5nKSB7XG4gICAgICAgIHRpbWluZ01pc21hdGNoID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXNvbHZlZFRpbWluZyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHt0aW1pbmc6IFF1ZXJ5VGltaW5nLkRZTkFNSUMsIG1lc3NhZ2U6IFFVRVJZX05PVF9ERUNMQVJFRF9JTl9DT01QT05FTlRfTUVTU0FHRX07XG4gICAgfSBlbHNlIGlmICh0aW1pbmdNaXNtYXRjaCkge1xuICAgICAgcmV0dXJuIHt0aW1pbmc6IG51bGwsIG1lc3NhZ2U6ICdNdWx0aXBsZSBjb21wb25lbnRzIHVzZSB0aGUgcXVlcnkgd2l0aCBkaWZmZXJlbnQgdGltaW5ncy4nfTtcbiAgICB9XG4gICAgcmV0dXJuIHt0aW1pbmc6IHJlc29sdmVkVGltaW5nfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSB0aW1pbmcgdGhhdCBoYXMgYmVlbiByZXNvbHZlZCBmb3IgYSBnaXZlbiBxdWVyeSB3aGVuIGl0J3MgdXNlZCB3aXRoaW4gdGhlXG4gICAqIHNwZWNpZmllZCBjbGFzcyBkZWNsYXJhdGlvbi4gZS5nLiBxdWVyaWVzIGZyb20gYW4gaW5oZXJpdGVkIGNsYXNzIGNhbiBiZSB1c2VkLlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0UXVlcnlUaW1pbmdGcm9tQ2xhc3MoY2xhc3NEZWNsOiB0cy5DbGFzc0RlY2xhcmF0aW9uLCBxdWVyeU5hbWU6IHN0cmluZyk6IFF1ZXJ5VGltaW5nXG4gICAgICB8bnVsbCB7XG4gICAgaWYgKCFjbGFzc0RlY2wubmFtZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGZpbGVQYXRoID0gY2xhc3NEZWNsLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZTtcbiAgICBjb25zdCBxdWVyeUtleSA9IHRoaXMuX2dldFZpZXdRdWVyeVVuaXF1ZUtleShmaWxlUGF0aCwgY2xhc3NEZWNsLm5hbWUudGV4dCwgcXVlcnlOYW1lKTtcblxuICAgIGlmICh0aGlzLmFuYWx5emVkUXVlcmllcy5oYXMocXVlcnlLZXkpKSB7XG4gICAgICByZXR1cm4gdGhpcy5hbmFseXplZFF1ZXJpZXMuZ2V0KHF1ZXJ5S2V5KSE7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VUZW1wbGF0ZShjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgbmdNb2R1bGU6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhKTpcbiAgICAgIFRlbXBsYXRlQXN0W10ge1xuICAgIHJldHVybiB0aGlzXG4gICAgICAgIC5jb21waWxlciFbJ19wYXJzZVRlbXBsYXRlJ10oY29tcG9uZW50LCBuZ01vZHVsZSwgbmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5kaXJlY3RpdmVzKVxuICAgICAgICAudGVtcGxhdGU7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVEaWFnbm9zdGljc0Vycm9yKGRpYWdub3N0aWNzOiBSZWFkb25seUFycmF5PERpYWdub3N0aWM+KSB7XG4gICAgcmV0dXJuIG5ldyBFcnJvcih0cy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcyBhcyB0cy5EaWFnbm9zdGljW10sIHRoaXMuaG9zdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0Vmlld1F1ZXJ5VW5pcXVlS2V5KGZpbGVQYXRoOiBzdHJpbmcsIGNsYXNzTmFtZTogc3RyaW5nLCBwcm9wTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAke3Jlc29sdmUoZmlsZVBhdGgpfSMke2NsYXNzTmFtZX0tJHtwcm9wTmFtZX1gO1xuICB9XG59XG5cbmludGVyZmFjZSBTdGF0aWNBbmREeW5hbWljUXVlcnlJZHMge1xuICBzdGF0aWNRdWVyeUlkczogU2V0PG51bWJlcj47XG4gIGR5bmFtaWNRdWVyeUlkczogU2V0PG51bWJlcj47XG59XG5cbi8qKiBGaWd1cmVzIG91dCB3aGljaCBxdWVyaWVzIGFyZSBzdGF0aWMgYW5kIHdoaWNoIG9uZXMgYXJlIGR5bmFtaWMuICovXG5mdW5jdGlvbiBmaW5kU3RhdGljUXVlcnlJZHMoXG4gICAgbm9kZXM6IFRlbXBsYXRlQXN0W10sIHJlc3VsdCA9IG5ldyBNYXA8VGVtcGxhdGVBc3QsIFN0YXRpY0FuZER5bmFtaWNRdWVyeUlkcz4oKSk6XG4gICAgTWFwPFRlbXBsYXRlQXN0LCBTdGF0aWNBbmREeW5hbWljUXVlcnlJZHM+IHtcbiAgbm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgIGNvbnN0IHN0YXRpY1F1ZXJ5SWRzID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgY29uc3QgZHluYW1pY1F1ZXJ5SWRzID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgbGV0IHF1ZXJ5TWF0Y2hlczogUXVlcnlNYXRjaFtdID0gdW5kZWZpbmVkITtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEVsZW1lbnRBc3QpIHtcbiAgICAgIGZpbmRTdGF0aWNRdWVyeUlkcyhub2RlLmNoaWxkcmVuLCByZXN1bHQpO1xuICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgICAgICBjb25zdCBjaGlsZERhdGEgPSByZXN1bHQuZ2V0KGNoaWxkKSE7XG4gICAgICAgIGNoaWxkRGF0YS5zdGF0aWNRdWVyeUlkcy5mb3JFYWNoKHF1ZXJ5SWQgPT4gc3RhdGljUXVlcnlJZHMuYWRkKHF1ZXJ5SWQpKTtcbiAgICAgICAgY2hpbGREYXRhLmR5bmFtaWNRdWVyeUlkcy5mb3JFYWNoKHF1ZXJ5SWQgPT4gZHluYW1pY1F1ZXJ5SWRzLmFkZChxdWVyeUlkKSk7XG4gICAgICB9KTtcbiAgICAgIHF1ZXJ5TWF0Y2hlcyA9IG5vZGUucXVlcnlNYXRjaGVzO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIEVtYmVkZGVkVGVtcGxhdGVBc3QpIHtcbiAgICAgIGZpbmRTdGF0aWNRdWVyeUlkcyhub2RlLmNoaWxkcmVuLCByZXN1bHQpO1xuICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgICAgICBjb25zdCBjaGlsZERhdGEgPSByZXN1bHQuZ2V0KGNoaWxkKSE7XG4gICAgICAgIGNoaWxkRGF0YS5zdGF0aWNRdWVyeUlkcy5mb3JFYWNoKHF1ZXJ5SWQgPT4gZHluYW1pY1F1ZXJ5SWRzLmFkZChxdWVyeUlkKSk7XG4gICAgICAgIGNoaWxkRGF0YS5keW5hbWljUXVlcnlJZHMuZm9yRWFjaChxdWVyeUlkID0+IGR5bmFtaWNRdWVyeUlkcy5hZGQocXVlcnlJZCkpO1xuICAgICAgfSk7XG4gICAgICBxdWVyeU1hdGNoZXMgPSBub2RlLnF1ZXJ5TWF0Y2hlcztcbiAgICB9XG4gICAgaWYgKHF1ZXJ5TWF0Y2hlcykge1xuICAgICAgcXVlcnlNYXRjaGVzLmZvckVhY2goKG1hdGNoKSA9PiBzdGF0aWNRdWVyeUlkcy5hZGQobWF0Y2gucXVlcnlJZCkpO1xuICAgIH1cbiAgICBkeW5hbWljUXVlcnlJZHMuZm9yRWFjaChxdWVyeUlkID0+IHN0YXRpY1F1ZXJ5SWRzLmRlbGV0ZShxdWVyeUlkKSk7XG4gICAgcmVzdWx0LnNldChub2RlLCB7c3RhdGljUXVlcnlJZHMsIGR5bmFtaWNRdWVyeUlkc30pO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIFNwbGl0cyBxdWVyaWVzIGludG8gc3RhdGljIGFuZCBkeW5hbWljLiAqL1xuZnVuY3Rpb24gc3RhdGljVmlld1F1ZXJ5SWRzKG5vZGVTdGF0aWNRdWVyeUlkczogTWFwPFRlbXBsYXRlQXN0LCBTdGF0aWNBbmREeW5hbWljUXVlcnlJZHM+KTpcbiAgICBTdGF0aWNBbmREeW5hbWljUXVlcnlJZHMge1xuICBjb25zdCBzdGF0aWNRdWVyeUlkcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICBjb25zdCBkeW5hbWljUXVlcnlJZHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgQXJyYXkuZnJvbShub2RlU3RhdGljUXVlcnlJZHMudmFsdWVzKCkpLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgZW50cnkuc3RhdGljUXVlcnlJZHMuZm9yRWFjaChxdWVyeUlkID0+IHN0YXRpY1F1ZXJ5SWRzLmFkZChxdWVyeUlkKSk7XG4gICAgZW50cnkuZHluYW1pY1F1ZXJ5SWRzLmZvckVhY2gocXVlcnlJZCA9PiBkeW5hbWljUXVlcnlJZHMuYWRkKHF1ZXJ5SWQpKTtcbiAgfSk7XG4gIGR5bmFtaWNRdWVyeUlkcy5mb3JFYWNoKHF1ZXJ5SWQgPT4gc3RhdGljUXVlcnlJZHMuZGVsZXRlKHF1ZXJ5SWQpKTtcbiAgcmV0dXJuIHtzdGF0aWNRdWVyeUlkcywgZHluYW1pY1F1ZXJ5SWRzfTtcbn1cbiJdfQ==