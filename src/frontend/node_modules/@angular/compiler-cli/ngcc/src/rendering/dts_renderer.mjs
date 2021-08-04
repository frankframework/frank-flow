/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import MagicString from 'magic-string';
import * as ts from 'typescript';
import { ImportManager, translateType } from '../../../src/ngtsc/translator';
import { IMPORT_PREFIX } from '../constants';
import { renderSourceAndMap } from './source_maps';
import { getImportRewriter } from './utils';
/**
 * A structure that captures information about what needs to be rendered
 * in a typings file.
 *
 * It is created as a result of processing the analysis passed to the renderer.
 *
 * The `renderDtsFile()` method consumes it when rendering a typings file.
 */
class DtsRenderInfo {
    constructor() {
        this.classInfo = [];
        this.moduleWithProviders = [];
        this.privateExports = [];
        this.reexports = [];
    }
}
/**
 * A base-class for rendering an `AnalyzedFile`.
 *
 * Package formats have output files that must be rendered differently. Concrete sub-classes must
 * implement the `addImports`, `addDefinitions` and `removeDecorators` abstract methods.
 */
export class DtsRenderer {
    constructor(dtsFormatter, fs, logger, host, bundle) {
        this.dtsFormatter = dtsFormatter;
        this.fs = fs;
        this.logger = logger;
        this.host = host;
        this.bundle = bundle;
    }
    renderProgram(decorationAnalyses, privateDeclarationsAnalyses, moduleWithProvidersAnalyses) {
        const renderedFiles = [];
        // Transform the .d.ts files
        if (this.bundle.dts) {
            const dtsFiles = this.getTypingsFilesToRender(decorationAnalyses, privateDeclarationsAnalyses, moduleWithProvidersAnalyses);
            // If the dts entry-point is not already there (it did not have compiled classes)
            // then add it now, to ensure it gets its extra exports rendered.
            if (!dtsFiles.has(this.bundle.dts.file)) {
                dtsFiles.set(this.bundle.dts.file, new DtsRenderInfo());
            }
            dtsFiles.forEach((renderInfo, file) => renderedFiles.push(...this.renderDtsFile(file, renderInfo)));
        }
        return renderedFiles;
    }
    renderDtsFile(dtsFile, renderInfo) {
        const outputText = new MagicString(dtsFile.text);
        const printer = ts.createPrinter();
        const importManager = new ImportManager(getImportRewriter(this.bundle.dts.r3SymbolsFile, this.bundle.isCore, false), IMPORT_PREFIX);
        renderInfo.classInfo.forEach(dtsClass => {
            const endOfClass = dtsClass.dtsDeclaration.getEnd();
            dtsClass.compilation.forEach(declaration => {
                const type = translateType(declaration.type, importManager);
                markForEmitAsSingleLine(type);
                const typeStr = printer.printNode(ts.EmitHint.Unspecified, type, dtsFile);
                const newStatement = `    static ${declaration.name}: ${typeStr};\n`;
                outputText.appendRight(endOfClass - 1, newStatement);
            });
        });
        if (renderInfo.reexports.length > 0) {
            for (const e of renderInfo.reexports) {
                const newStatement = `\nexport {${e.symbolName} as ${e.asAlias}} from '${e.fromModule}';`;
                outputText.append(newStatement);
            }
        }
        this.dtsFormatter.addModuleWithProvidersParams(outputText, renderInfo.moduleWithProviders, importManager);
        this.dtsFormatter.addExports(outputText, dtsFile.fileName, renderInfo.privateExports, importManager, dtsFile);
        this.dtsFormatter.addImports(outputText, importManager.getAllImports(dtsFile.fileName), dtsFile);
        return renderSourceAndMap(this.logger, this.fs, dtsFile, outputText);
    }
    getTypingsFilesToRender(decorationAnalyses, privateDeclarationsAnalyses, moduleWithProvidersAnalyses) {
        const dtsMap = new Map();
        // Capture the rendering info from the decoration analyses
        decorationAnalyses.forEach(compiledFile => {
            let appliedReexports = false;
            compiledFile.compiledClasses.forEach(compiledClass => {
                const dtsDeclaration = this.host.getDtsDeclaration(compiledClass.declaration);
                if (dtsDeclaration) {
                    const dtsFile = dtsDeclaration.getSourceFile();
                    const renderInfo = dtsMap.has(dtsFile) ? dtsMap.get(dtsFile) : new DtsRenderInfo();
                    renderInfo.classInfo.push({ dtsDeclaration, compilation: compiledClass.compilation });
                    // Only add re-exports if the .d.ts tree is overlayed with the .js tree, as re-exports in
                    // ngcc are only used to support deep imports into e.g. commonjs code. For a deep import
                    // to work, the typing file and JS file must be in parallel trees. This logic will detect
                    // the simplest version of this case, which is sufficient to handle most commonjs
                    // libraries.
                    if (!appliedReexports &&
                        compiledClass.declaration.getSourceFile().fileName ===
                            dtsFile.fileName.replace(/\.d\.ts$/, '.js')) {
                        renderInfo.reexports.push(...compiledFile.reexports);
                        appliedReexports = true;
                    }
                    dtsMap.set(dtsFile, renderInfo);
                }
            });
        });
        // Capture the ModuleWithProviders functions/methods that need updating
        if (moduleWithProvidersAnalyses !== null) {
            moduleWithProvidersAnalyses.forEach((moduleWithProvidersToFix, dtsFile) => {
                const renderInfo = dtsMap.has(dtsFile) ? dtsMap.get(dtsFile) : new DtsRenderInfo();
                renderInfo.moduleWithProviders = moduleWithProvidersToFix;
                dtsMap.set(dtsFile, renderInfo);
            });
        }
        // Capture the private declarations that need to be re-exported
        if (privateDeclarationsAnalyses.length) {
            privateDeclarationsAnalyses.forEach(e => {
                if (!e.dtsFrom) {
                    throw new Error(`There is no typings path for ${e.identifier} in ${e.from}.\n` +
                        `We need to add an export for this class to a .d.ts typings file because ` +
                        `Angular compiler needs to be able to reference this class in compiled code, such as templates.\n` +
                        `The simplest fix for this is to ensure that this class is exported from the package's entry-point.`);
                }
            });
            const dtsEntryPoint = this.bundle.dts.file;
            const renderInfo = dtsMap.has(dtsEntryPoint) ? dtsMap.get(dtsEntryPoint) : new DtsRenderInfo();
            renderInfo.privateExports = privateDeclarationsAnalyses;
            dtsMap.set(dtsEntryPoint, renderInfo);
        }
        return dtsMap;
    }
}
function markForEmitAsSingleLine(node) {
    ts.setEmitFlags(node, ts.EmitFlags.SingleLine);
    ts.forEachChild(node, markForEmitAsSingleLine);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHRzX3JlbmRlcmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL3JlbmRlcmluZy9kdHNfcmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxXQUFXLE1BQU0sY0FBYyxDQUFDO0FBQ3ZDLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBTWpDLE9BQU8sRUFBQyxhQUFhLEVBQUUsYUFBYSxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFJM0UsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUszQyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDakQsT0FBTyxFQUFjLGlCQUFpQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRXZEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGFBQWE7SUFBbkI7UUFDRSxjQUFTLEdBQW1CLEVBQUUsQ0FBQztRQUMvQix3QkFBbUIsR0FBOEIsRUFBRSxDQUFDO1FBQ3BELG1CQUFjLEdBQWlCLEVBQUUsQ0FBQztRQUNsQyxjQUFTLEdBQWUsRUFBRSxDQUFDO0lBQzdCLENBQUM7Q0FBQTtBQVdEOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLFdBQVc7SUFDdEIsWUFDWSxZQUFnQyxFQUFVLEVBQXNCLEVBQ2hFLE1BQWMsRUFBVSxJQUF3QixFQUFVLE1BQXdCO1FBRGxGLGlCQUFZLEdBQVosWUFBWSxDQUFvQjtRQUFVLE9BQUUsR0FBRixFQUFFLENBQW9CO1FBQ2hFLFdBQU0sR0FBTixNQUFNLENBQVE7UUFBVSxTQUFJLEdBQUosSUFBSSxDQUFvQjtRQUFVLFdBQU0sR0FBTixNQUFNLENBQWtCO0lBQUcsQ0FBQztJQUVsRyxhQUFhLENBQ1Qsa0JBQXNDLEVBQ3RDLDJCQUF3RCxFQUN4RCwyQkFBNkQ7UUFDL0QsTUFBTSxhQUFhLEdB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QkFDM0c7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUNILE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBSSxDQUFDLElBQUksQ0FBQztZQUM1QyxNQUFNLFVBQVUsR0FDWixNQUFNLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ2pGLFVBQVUsQ0FBQyxjQUFjLEdBQUcsMkJBQTJCLENBQUM7WUFDeEQsTUFBTSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7U0FDdkM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUFFRCxTQUFTLHVCQUF1QixDQUFDLElBQWE7SUFDNUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCBNYWdpY1N0cmluZyBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7UmVhZG9ubHlGaWxlU3lzdGVtfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtSZWV4cG9ydH0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ltcG9ydHMnO1xuaW1wb3J0IHtMb2dnZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9sb2dnaW5nJztcbmltcG9ydCB7Q29tcGlsZVJlc3VsdH0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL3RyYW5zZm9ybSc7XG5pbXBvcnQge0ltcG9ydE1hbmFnZXIsIHRyYW5zbGF0ZVR5cGV9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy90cmFuc2xhdG9yJztcbmltcG9ydCB7TW9kdWxlV2l0aFByb3ZpZGVyc0FuYWx5c2VzLCBNb2R1bGVXaXRoUHJvdmlkZXJzSW5mb30gZnJvbSAnLi4vYW5hbHlzaXMvbW9kdWxlX3dpdGhfcHJvdmlkZXJzX2FuYWx5emVyJztcbmltcG9ydCB7RXhwb3J0SW5mbywgUHJpdmF0ZURlY2xhcmF0aW9uc0FuYWx5c2VzfSBmcm9tICcuLi9hbmFseXNpcy9wcml2YXRlX2RlY2xhcmF0aW9uc19hbmFseXplcic7XG5pbXBvcnQge0RlY29yYXRpb25BbmFseXNlc30gZnJvbSAnLi4vYW5hbHlzaXMvdHlwZXMnO1xuaW1wb3J0IHtJTVBPUlRfUFJFRklYfSBmcm9tICcuLi9jb25zdGFudHMnO1xuaW1wb3J0IHtOZ2NjUmVmbGVjdGlvbkhvc3R9IGZyb20gJy4uL2hvc3QvbmdjY19ob3N0JztcbmltcG9ydCB7RW50cnlQb2ludEJ1bmRsZX0gZnJvbSAnLi4vcGFja2FnZXMvZW50cnlfcG9pbnRfYnVuZGxlJztcblxuaW1wb3J0IHtSZW5kZXJpbmdGb3JtYXR0ZXJ9IGZyb20gJy4vcmVuZGVyaW5nX2Zvcm1hdHRlcic7XG5pbXBvcnQge3JlbmRlclNvdXJjZUFuZE1hcH0gZnJvbSAnLi9zb3VyY2VfbWFwcyc7XG5pbXBvcnQge0ZpbGVUb1dyaXRlLCBnZXRJbXBvcnRSZXdyaXRlcn0gZnJvbSAnLi91dGlscyc7XG5cbi8qKlxuICogQSBzdHJ1Y3R1cmUgdGhhdCBjYXB0dXJlcyBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IG5lZWRzIHRvIGJlIHJlbmRlcmVkXG4gKiBpbiBhIHR5cGluZ3MgZmlsZS5cbiAqXG4gKiBJdCBpcyBjcmVhdGVkIGFzIGEgcmVzdWx0IG9mIHByb2Nlc3NpbmcgdGhlIGFuYWx5c2lzIHBhc3NlZCB0byB0aGUgcmVuZGVyZXIuXG4gKlxuICogVGhlIGByZW5kZXJEdHNGaWxlKClgIG1ldGhvZCBjb25zdW1lcyBpdCB3aGVuIHJlbmRlcmluZyBhIHR5cGluZ3MgZmlsZS5cbiAqL1xuY2xhc3MgRHRzUmVuZGVySW5mbyB7XG4gIGNsYXNzSW5mbzogRHRzQ2xhc3NJbmZvW10gPSBbXTtcbiAgbW9kdWxlV2l0aFByb3ZpZGVyczogTW9kdWxlV2l0aFByb3ZpZGVyc0luZm9bXSA9IFtdO1xuICBwcml2YXRlRXhwb3J0czogRXhwb3J0SW5mb1tdID0gW107XG4gIHJlZXhwb3J0czogUmVleHBvcnRbXSA9IFtdO1xufVxuXG5cbi8qKlxuICogSW5mb3JtYXRpb24gYWJvdXQgYSBjbGFzcyBpbiBhIHR5cGluZ3MgZmlsZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBEdHNDbGFzc0luZm8ge1xuICBkdHNEZWNsYXJhdGlvbjogdHMuRGVjbGFyYXRpb247XG4gIGNvbXBpbGF0aW9uOiBDb21waWxlUmVzdWx0W107XG59XG5cbi8qKlxuICogQSBiYXNlLWNsYXNzIGZvciByZW5kZXJpbmcgYW4gYEFuYWx5emVkRmlsZWAuXG4gKlxuICogUGFja2FnZSBmb3JtYXRzIGhhdmUgb3V0cHV0IGZpbGVzIHRoYXQgbXVzdCBiZSByZW5kZXJlZCBkaWZmZXJlbnRseS4gQ29uY3JldGUgc3ViLWNsYXNzZXMgbXVzdFxuICogaW1wbGVtZW50IHRoZSBgYWRkSW1wb3J0c2AsIGBhZGREZWZpbml0aW9uc2AgYW5kIGByZW1vdmVEZWNvcmF0b3JzYCBhYnN0cmFjdCBtZXRob2RzLlxuICovXG5leHBvcnQgY2xhc3MgRHRzUmVuZGVyZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgZHRzRm9ybWF0dGVyOiBSZW5kZXJpbmdGb3JtYXR0ZXIsIHByaXZhdGUgZnM6IFJlYWRvbmx5RmlsZVN5c3RlbSxcbiAgICAgIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXIsIHByaXZhdGUgaG9zdDogTmdjY1JlZmxlY3Rpb25Ib3N0LCBwcml2YXRlIGJ1bmRsZTogRW50cnlQb2ludEJ1bmRsZSkge31cblxuICByZW5kZXJQcm9ncmFtKFxuICAgICAgZGVjb3JhdGlvbkFuYWx5c2VzOiBEZWNvcmF0aW9uQW5hbHlzZXMsXG4gICAgICBwcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXM6IFByaXZhdGVEZWNsYXJhdGlvbnNBbmFseXNlcyxcbiAgICAgIG1vZHVsZVdpdGhQcm92aWRlcnNBbmFseXNlczogTW9kdWxlV2l0aFByb3ZpZGVyc0FuYWx5c2VzfG51bGwpOiBGaWxlVG9Xcml0ZVtdIHtcbiAgICBjb25zdCByZW5kZXJlZEZpbGVzOiBGaWxlVG9Xcml0ZVtdID0gW107XG5cbiAgICAvLyBUcmFuc2Zvcm0gdGhlIC5kLnRzIGZpbGVzXG4gICAgaWYgKHRoaXMuYnVuZGxlLmR0cykge1xuICAgICAgY29uc3QgZHRzRmlsZXMgPSB0aGlzLmdldFR5cGluZ3NGaWxlc1RvUmVuZGVyKFxuICAgICAgICAgIGRlY29yYXRpb25BbmFseXNlcywgcHJpdmF0ZURlY2xhcmF0aW9uc0FuYWx5c2VzLCBtb2R1bGVXaXRoUHJvdmlkZXJzQW5hbHlzZXMpO1xuXG4gICAgICAvLyBJZiB0aGUgZHRzIGVudHJ5LXBvaW50IGlzIG5vdCBhbHJlYWR5IHRoZXJlIChpdCBkaWQgbm90IGhhdmUgY29tcGlsZWQgY2xhc3NlcylcbiAgICAgIC8vIHRoZW4gYWRkIGl0IG5vdywgdG8gZW5zdXJlIGl0IGdldHMgaXRzIGV4dHJhIGV4cG9ydHMgcmVuZGVyZWQuXG4gICAgICBpZiAoIWR0c0ZpbGVzLmhhcyh0aGlzLmJ1bmRsZS5kdHMuZmlsZSkpIHtcbiAgICAgICAgZHRzRmlsZXMuc2V0KHRoaXMuYnVuZGxlLmR0cy5maWxlLCBuZXcgRHRzUmVuZGVySW5mbygpKTtcbiAgICAgIH1cbiAgICAgIGR0c0ZpbGVzLmZvckVhY2goXG4gICAgICAgICAgKHJlbmRlckluZm8sIGZpbGUpID0+IHJlbmRlcmVkRmlsZXMucHVzaCguLi50aGlzLnJlbmRlckR0c0ZpbGUoZmlsZSwgcmVuZGVySW5mbykpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVuZGVyZWRGaWxlcztcbiAgfVxuXG4gIHJlbmRlckR0c0ZpbGUoZHRzRmlsZTogdHMuU291cmNlRmlsZSwgcmVuZGVySW5mbzogRHRzUmVuZGVySW5mbyk6IEZpbGVUb1dyaXRlW10ge1xuICAgIGNvbnN0IG91dHB1dFRleHQgPSBuZXcgTWFnaWNTdHJpbmcoZHRzRmlsZS50ZXh0KTtcbiAgICBjb25zdCBwcmludGVyID0gdHMuY3JlYXRlUHJpbnRlcigpO1xuICAgIGNvbnN0IGltcG9ydE1hbmFnZXIgPSBuZXcgSW1wb3J0TWFuYWdlcihcbiAgICAgICAgZ2V0SW1wb3J0UmV3cml0ZXIodGhpcy5idW5kbGUuZHRzIS5yM1N5bWJvbHNGaWxlLCB0aGlzLmJ1bmRsZS5pc0NvcmUsIGZhbHNlKSxcbiAgICAgICAgSU1QT1JUX1BSRUZJWCk7XG5cbiAgICByZW5kZXJJbmZvLmNsYXNzSW5mby5mb3JFYWNoKGR0c0NsYXNzID0+IHtcbiAgICAgIGNvbnN0IGVuZE9mQ2xhc3MgPSBkdHNDbGFzcy5kdHNEZWNsYXJhdGlvbi5nZXRFbmQoKTtcbiAgICAgIGR0c0NsYXNzLmNvbXBpbGF0aW9uLmZvckVhY2goZGVjbGFyYXRpb24gPT4ge1xuICAgICAgICBjb25zdCB0eXBlID0gdHJhbnNsYXRlVHlwZShkZWNsYXJhdGlvbi50eXBlLCBpbXBvcnRNYW5hZ2VyKTtcbiAgICAgICAgbWFya0ZvckVtaXRBc1NpbmdsZUxpbmUodHlwZSk7XG4gICAgICAgIGNvbnN0IHR5cGVTdHIgPSBwcmludGVyLnByaW50Tm9kZSh0cy5FbWl0SGludC5VbnNwZWNpZmllZCwgdHlwZSwgZHRzRmlsZSk7XG4gICAgICAgIGNvbnN0IG5ld1N0YXRlbWVudCA9IGAgICAgc3RhdGljICR7ZGVjbGFyYXRpb24ubmFtZX06ICR7dHlwZVN0cn07XFxuYDtcbiAgICAgICAgb3V0cHV0VGV4dC5hcHBlbmRSaWdodChlbmRPZkNsYXNzIC0gMSwgbmV3U3RhdGVtZW50KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaWYgKHJlbmRlckluZm8ucmVleHBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3QgZSBvZiByZW5kZXJJbmZvLnJlZXhwb3J0cykge1xuICAgICAgICBjb25zdCBuZXdTdGF0ZW1lbnQgPSBgXFxuZXhwb3J0IHske2Uuc3ltYm9sTmFtZX0gYXMgJHtlLmFzQWxpYXN9fSBmcm9tICcke2UuZnJvbU1vZHVsZX0nO2A7XG4gICAgICAgIG91dHB1dFRleHQuYXBwZW5kKG5ld1N0YXRlbWVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5kdHNGb3JtYXR0ZXIuYWRkTW9kdWxlV2l0aFByb3ZpZGVyc1BhcmFtcyhcbiAgICAgICAgb3V0cHV0VGV4dCwgcmVuZGVySW5mby5tb2R1bGVXaXRoUHJvdmlkZXJzLCBpbXBvcnRNYW5hZ2VyKTtcbiAgICB0aGlzLmR0c0Zvcm1hdHRlci5hZGRFeHBvcnRzKFxuICAgICAgICBvdXRwdXRUZXh0LCBkdHNGaWxlLmZpbGVOYW1lLCByZW5kZXJJbmZvLnByaXZhdGVFeHBvcnRzLCBpbXBvcnRNYW5hZ2VyLCBkdHNGaWxlKTtcbiAgICB0aGlzLmR0c0Zvcm1hdHRlci5hZGRJbXBvcnRzKFxuICAgICAgICBvdXRwdXRUZXh0LCBpbXBvcnRNYW5hZ2VyLmdldEFsbEltcG9ydHMoZHRzRmlsZS5maWxlTmFtZSksIGR0c0ZpbGUpO1xuXG4gICAgcmV0dXJuIHJlbmRlclNvdXJjZUFuZE1hcCh0aGlzLmxvZ2dlciwgdGhpcy5mcywgZHRzRmlsZSwgb3V0cHV0VGV4dCk7XG4gIH1cblxuICBwcml2YXRlIGdldFR5cGluZ3NGaWxlc1RvUmVuZGVyKFxuICAgICAgZGVjb3JhdGlvbkFuYWx5c2VzOiBEZWNvcmF0aW9uQW5hbHlzZXMsXG4gICAgICBwcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXM6IFByaXZhdGVEZWNsYXJhdGlvbnNBbmFseXNlcyxcbiAgICAgIG1vZHVsZVdpdGhQcm92aWRlcnNBbmFseXNlczogTW9kdWxlV2l0aFByb3ZpZGVyc0FuYWx5c2VzfFxuICAgICAgbnVsbCk6IE1hcDx0cy5Tb3VyY2VGaWxlLCBEdHNSZW5kZXJJbmZvPiB7XG4gICAgY29uc3QgZHRzTWFwID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBEdHNSZW5kZXJJbmZvPigpO1xuXG4gICAgLy8gQ2FwdHVyZSB0aGUgcmVuZGVyaW5nIGluZm8gZnJvbSB0aGUgZGVjb3JhdGlvbiBhbmFseXNlc1xuICAgIGRlY29yYXRpb25BbmFseXNlcy5mb3JFYWNoKGNvbXBpbGVkRmlsZSA9PiB7XG4gICAgICBsZXQgYXBwbGllZFJlZXhwb3J0cyA9IGZhbHNlO1xuICAgICAgY29tcGlsZWRGaWxlLmNvbXBpbGVkQ2xhc3Nlcy5mb3JFYWNoKGNvbXBpbGVkQ2xhc3MgPT4ge1xuICAgICAgICBjb25zdCBkdHNEZWNsYXJhdGlvbiA9IHRoaXMuaG9zdC5nZXREdHNEZWNsYXJhdGlvbihjb21waWxlZENsYXNzLmRlY2xhcmF0aW9uKTtcbiAgICAgICAgaWYgKGR0c0RlY2xhcmF0aW9uKSB7XG4gICAgICAgICAgY29uc3QgZHRzRmlsZSA9IGR0c0RlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKTtcbiAgICAgICAgICBjb25zdCByZW5kZXJJbmZvID0gZHRzTWFwLmhhcyhkdHNGaWxlKSA/IGR0c01hcC5nZXQoZHRzRmlsZSkhIDogbmV3IER0c1JlbmRlckluZm8oKTtcbiAgICAgICAgICByZW5kZXJJbmZvLmNsYXNzSW5mby5wdXNoKHtkdHNEZWNsYXJhdGlvbiwgY29tcGlsYXRpb246IGNvbXBpbGVkQ2xhc3MuY29tcGlsYXRpb259KTtcbiAgICAgICAgICAvLyBPbmx5IGFkZCByZS1leHBvcnRzIGlmIHRoZSAuZC50cyB0cmVlIGlzIG92ZXJsYXllZCB3aXRoIHRoZSAuanMgdHJlZSwgYXMgcmUtZXhwb3J0cyBpblxuICAgICAgICAgIC8vIG5nY2MgYXJlIG9ubHkgdXNlZCB0byBzdXBwb3J0IGRlZXAgaW1wb3J0cyBpbnRvIGUuZy4gY29tbW9uanMgY29kZS4gRm9yIGEgZGVlcCBpbXBvcnRcbiAgICAgICAgICAvLyB0byB3b3JrLCB0aGUgdHlwaW5nIGZpbGUgYW5kIEpTIGZpbGUgbXVzdCBiZSBpbiBwYXJhbGxlbCB0cmVlcy4gVGhpcyBsb2dpYyB3aWxsIGRldGVjdFxuICAgICAgICAgIC8vIHRoZSBzaW1wbGVzdCB2ZXJzaW9uIG9mIHRoaXMgY2FzZSwgd2hpY2ggaXMgc3VmZmljaWVudCB0byBoYW5kbGUgbW9zdCBjb21tb25qc1xuICAgICAgICAgIC8vIGxpYnJhcmllcy5cbiAgICAgICAgICBpZiAoIWFwcGxpZWRSZWV4cG9ydHMgJiZcbiAgICAgICAgICAgICAgY29tcGlsZWRDbGFzcy5kZWNsYXJhdGlvbi5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWUgPT09XG4gICAgICAgICAgICAgICAgICBkdHNGaWxlLmZpbGVOYW1lLnJlcGxhY2UoL1xcLmRcXC50cyQvLCAnLmpzJykpIHtcbiAgICAgICAgICAgIHJlbmRlckluZm8ucmVleHBvcnRzLnB1c2goLi4uY29tcGlsZWRGaWxlLnJlZXhwb3J0cyk7XG4gICAgICAgICAgICBhcHBsaWVkUmVleHBvcnRzID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZHRzTWFwLnNldChkdHNGaWxlLCByZW5kZXJJbmZvKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBDYXB0dXJlIHRoZSBNb2R1bGVXaXRoUHJvdmlkZXJzIGZ1bmN0aW9ucy9tZXRob2RzIHRoYXQgbmVlZCB1cGRhdGluZ1xuICAgIGlmIChtb2R1bGVXaXRoUHJvdmlkZXJzQW5hbHlzZXMgIT09IG51bGwpIHtcbiAgICAgIG1vZHVsZVdpdGhQcm92aWRlcnNBbmFseXNlcy5mb3JFYWNoKChtb2R1bGVXaXRoUHJvdmlkZXJzVG9GaXgsIGR0c0ZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgcmVuZGVySW5mbyA9IGR0c01hcC5oYXMoZHRzRmlsZSkgPyBkdHNNYXAuZ2V0KGR0c0ZpbGUpISA6IG5ldyBEdHNSZW5kZXJJbmZvKCk7XG4gICAgICAgIHJlbmRlckluZm8ubW9kdWxlV2l0aFByb3ZpZGVycyA9IG1vZHVsZVdpdGhQcm92aWRlcnNUb0ZpeDtcbiAgICAgICAgZHRzTWFwLnNldChkdHNGaWxlLCByZW5kZXJJbmZvKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENhcHR1cmUgdGhlIHByaXZhdGUgZGVjbGFyYXRpb25zIHRoYXQgbmVlZCB0byBiZSByZS1leHBvcnRlZFxuICAgIGlmIChwcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXMubGVuZ3RoKSB7XG4gICAgICBwcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgaWYgKCFlLmR0c0Zyb20pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBUaGVyZSBpcyBubyB0eXBpbmdzIHBhdGggZm9yICR7ZS5pZGVudGlmaWVyfSBpbiAke2UuZnJvbX0uXFxuYCArXG4gICAgICAgICAgICAgIGBXZSBuZWVkIHRvIGFkZCBhbiBleHBvcnQgZm9yIHRoaXMgY2xhc3MgdG8gYSAuZC50cyB0eXBpbmdzIGZpbGUgYmVjYXVzZSBgICtcbiAgICAgICAgICAgICAgYEFuZ3VsYXIgY29tcGlsZXIgbmVlZHMgdG8gYmUgYWJsZSB0byByZWZlcmVuY2UgdGhpcyBjbGFzcyBpbiBjb21waWxlZCBjb2RlLCBzdWNoIGFzIHRlbXBsYXRlcy5cXG5gICtcbiAgICAgICAgICAgICAgYFRoZSBzaW1wbGVzdCBmaXggZm9yIHRoaXMgaXMgdG8gZW5zdXJlIHRoYXQgdGhpcyBjbGFzcyBpcyBleHBvcnRlZCBmcm9tIHRoZSBwYWNrYWdlJ3MgZW50cnktcG9pbnQuYCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgZHRzRW50cnlQb2ludCA9IHRoaXMuYnVuZGxlLmR0cyEuZmlsZTtcbiAgICAgIGNvbnN0IHJlbmRlckluZm8gPVxuICAgICAgICAgIGR0c01hcC5oYXMoZHRzRW50cnlQb2ludCkgPyBkdHNNYXAuZ2V0KGR0c0VudHJ5UG9pbnQpISA6IG5ldyBEdHNSZW5kZXJJbmZvKCk7XG4gICAgICByZW5kZXJJbmZvLnByaXZhdGVFeHBvcnRzID0gcHJpdmF0ZURlY2xhcmF0aW9uc0FuYWx5c2VzO1xuICAgICAgZHRzTWFwLnNldChkdHNFbnRyeVBvaW50LCByZW5kZXJJbmZvKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZHRzTWFwO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcmtGb3JFbWl0QXNTaW5nbGVMaW5lKG5vZGU6IHRzLk5vZGUpIHtcbiAgdHMuc2V0RW1pdEZsYWdzKG5vZGUsIHRzLkVtaXRGbGFncy5TaW5nbGVMaW5lKTtcbiAgdHMuZm9yRWFjaENoaWxkKG5vZGUsIG1hcmtGb3JFbWl0QXNTaW5nbGVMaW5lKTtcbn1cbiJdfQ==