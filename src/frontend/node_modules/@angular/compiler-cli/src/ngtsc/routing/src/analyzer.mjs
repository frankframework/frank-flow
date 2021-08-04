/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { scanForCandidateTransitiveModules, scanForRouteEntryPoints } from './lazy';
import { entryPointKeyFor, RouterEntryPointManager } from './route';
export class NgModuleRouteAnalyzer {
    constructor(moduleResolver, evaluator) {
        this.evaluator = evaluator;
        this.modules = new Map();
        this.entryPointManager = new RouterEntryPointManager(moduleResolver);
    }
    add(sourceFile, moduleName, imports, exports, providers) {
        const key = entryPointKeyFor(sourceFile.fileName, moduleName);
        if (this.modules.has(key)) {
            throw new Error(`Double route analyzing for '${key}'.`);
        }
        this.modules.set(key, {
            sourceFile,
            moduleName,
            imports,
            exports,
            providers,
        });
    }
    listLazyRoutes(entryModuleKey) {
        if ((entryModuleKey !== undefined) && !this.modules.has(entryModuleKey)) {
            throw new Error(`Failed to list lazy routes: Unknown module '${entryModuleKey}'.`);
        }
        const routes = [];
        const scannedModuleKeys = new Set();
        const pendingModuleKeys = entryModuleKey ? [entryModuleKey] : Array.from(this.modules.keys());
        // When listing lazy routes for a specific entry module, we need to recursively extract
        // "transitive" routes from imported/exported modules. This is not necessary when listing all
        // lazy routes, because all analyzed modules will be scanned anyway.
        const scanRecursively = entryModuleKey !== undefined;
        while (pendingModuleKeys.length > 0) {
            const key = pendingModuleKeys.pop();
            if (scannedModuleKeys.has(key)) {
                continue;
            }
            else {
                scannedModuleKeys.add(key);
            }
            const data = this.modules.get(key);
            const entryPoints = scanForRouteEntryPoints(data.sourceFile, data.moduleName, data, this.entryPointManager, this.evaluator);
            routes.push(...entryPoints.map(entryPoint => ({
                route: entryPoint.loadChildren,
                module: entryPoint.from,
                referencedModule: entryPoint.resolvedTo,
            })));
            if (scanRecursively) {
                pendingModuleKeys.push(...[
                    // Scan the retrieved lazy route entry points.
                    ...entryPoints.map(({ resolvedTo }) => entryPointKeyFor(resolvedTo.filePath, resolvedTo.moduleName)),
                    // Scan the current module's imported modules.
                    ...scanForCandidateTransitiveModules(data.imports, this.evaluator),
                    // Scan the current module's exported modules.
                    ...scanForCandidateTransitiveModules(data.exports, this.evaluator),
                ].filter(key => this.modules.has(key)));
            }
        }
        return routes;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3JvdXRpbmcvc3JjL2FuYWx5emVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQU9ILE9BQU8sRUFBQyxpQ0FBaUMsRUFBRSx1QkFBdUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUNsRixPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsdUJBQXVCLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFnQmxFLE1BQU0sT0FBTyxxQkFBcUI7SUFJaEMsWUFBWSxjQUE4QixFQUFVLFNBQTJCO1FBQTNCLGNBQVMsR0FBVCxTQUFTLENBQWtCO1FBSHZFLFlBQU8sR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztRQUl4RCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSx1QkFBdUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQsR0FBRyxDQUFDLFVBQXlCLEVBQUUsVUFBa0IsRUFBRSxPQUEyQixFQUMxRSxPQUEyQixFQUFFLFNBQTZCO1FBQzVELE1BQU0sR0FBRyxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDOUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixHQUFHLElBQUksQ0FBQyxDQUFDO1NBQ3pEO1FBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFO1lBQ3BCLFVBQVU7WUFDVixVQUFVO1lBQ1YsT0FBTztZQUNQLE9BQU87WUFDUCxTQUFTO1NBQ1YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELGNBQWMsQ0FBQyxjQUFpQztRQUM5QyxJQUFJLENBQUMsY0FBYyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDdkUsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsY0FBYyxJQUFJLENBQUMsQ0FBQztTQUNwRjtRQUVELE1BQU0sTUFBTSxHQUFnQixFQUFFLENBQUM7UUFDL0IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQzVDLE1BQU0saUJBQWlCLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUU5Rix1RkFBdUY7UUFDdkYsNkZBQTZGO1FBQzdGLG9FQUFvRTtRQUNwRSxNQUFNLGVBQWUsR0FBRyxjQUFjLEtBQUssU0FBUyxDQUFDO1FBRXJELE9BQU8saUJBQWlCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNuQyxNQUFNLEdBQUcsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUcsQ0FBQztZQUVyQyxJQUFJLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDOUIsU0FBUzthQUNWO2lCQUFNO2dCQUNMLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM1QjtZQUVELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO1lBQ3BDLE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUN2QyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFcEYsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNiLEtBQUssRUFBRSxVQUFVLENBQUMsWUFBWTtnQkFDOUIsTUFBTSxFQUFFLFVBQVUsQ0FBQyxJQUFJO2dCQUN2QixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsVUFBVTthQUN4QyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXBDLElBQUksZUFBZSxFQUFFO2dCQUNuQixpQkFBaUIsQ0FBQyxJQUFJLENBQ2xCLEdBQUc7b0JBQ0MsOENBQThDO29CQUM5QyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQ2QsQ0FBQyxFQUFDLFVBQVUsRUFBQyxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDbkYsOENBQThDO29CQUM5QyxHQUFHLGlDQUFpQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztvQkFDbEUsOENBQThDO29CQUM5QyxHQUFHLGlDQUFpQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztpQkFDekUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDekM7U0FDRjtRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtNb2R1bGVSZXNvbHZlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge1BhcnRpYWxFdmFsdWF0b3J9IGZyb20gJy4uLy4uL3BhcnRpYWxfZXZhbHVhdG9yJztcblxuaW1wb3J0IHtzY2FuRm9yQ2FuZGlkYXRlVHJhbnNpdGl2ZU1vZHVsZXMsIHNjYW5Gb3JSb3V0ZUVudHJ5UG9pbnRzfSBmcm9tICcuL2xhenknO1xuaW1wb3J0IHtlbnRyeVBvaW50S2V5Rm9yLCBSb3V0ZXJFbnRyeVBvaW50TWFuYWdlcn0gZnJvbSAnLi9yb3V0ZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmdNb2R1bGVSYXdSb3V0ZURhdGEge1xuICBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlO1xuICBtb2R1bGVOYW1lOiBzdHJpbmc7XG4gIGltcG9ydHM6IHRzLkV4cHJlc3Npb258bnVsbDtcbiAgZXhwb3J0czogdHMuRXhwcmVzc2lvbnxudWxsO1xuICBwcm92aWRlcnM6IHRzLkV4cHJlc3Npb258bnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMYXp5Um91dGUge1xuICByb3V0ZTogc3RyaW5nO1xuICBtb2R1bGU6IHtuYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmd9O1xuICByZWZlcmVuY2VkTW9kdWxlOiB7bmFtZTogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nfTtcbn1cblxuZXhwb3J0IGNsYXNzIE5nTW9kdWxlUm91dGVBbmFseXplciB7XG4gIHByaXZhdGUgbW9kdWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBOZ01vZHVsZVJhd1JvdXRlRGF0YT4oKTtcbiAgcHJpdmF0ZSBlbnRyeVBvaW50TWFuYWdlcjogUm91dGVyRW50cnlQb2ludE1hbmFnZXI7XG5cbiAgY29uc3RydWN0b3IobW9kdWxlUmVzb2x2ZXI6IE1vZHVsZVJlc29sdmVyLCBwcml2YXRlIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcikge1xuICAgIHRoaXMuZW50cnlQb2ludE1hbmFnZXIgPSBuZXcgUm91dGVyRW50cnlQb2ludE1hbmFnZXIobW9kdWxlUmVzb2x2ZXIpO1xuICB9XG5cbiAgYWRkKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsIG1vZHVsZU5hbWU6IHN0cmluZywgaW1wb3J0czogdHMuRXhwcmVzc2lvbnxudWxsLFxuICAgICAgZXhwb3J0czogdHMuRXhwcmVzc2lvbnxudWxsLCBwcm92aWRlcnM6IHRzLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IGtleSA9IGVudHJ5UG9pbnRLZXlGb3Ioc291cmNlRmlsZS5maWxlTmFtZSwgbW9kdWxlTmFtZSk7XG4gICAgaWYgKHRoaXMubW9kdWxlcy5oYXMoa2V5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBEb3VibGUgcm91dGUgYW5hbHl6aW5nIGZvciAnJHtrZXl9Jy5gKTtcbiAgICB9XG4gICAgdGhpcy5tb2R1bGVzLnNldChrZXksIHtcbiAgICAgIHNvdXJjZUZpbGUsXG4gICAgICBtb2R1bGVOYW1lLFxuICAgICAgaW1wb3J0cyxcbiAgICAgIGV4cG9ydHMsXG4gICAgICBwcm92aWRlcnMsXG4gICAgfSk7XG4gIH1cblxuICBsaXN0TGF6eVJvdXRlcyhlbnRyeU1vZHVsZUtleT86IHN0cmluZ3x1bmRlZmluZWQpOiBMYXp5Um91dGVbXSB7XG4gICAgaWYgKChlbnRyeU1vZHVsZUtleSAhPT0gdW5kZWZpbmVkKSAmJiAhdGhpcy5tb2R1bGVzLmhhcyhlbnRyeU1vZHVsZUtleSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGxpc3QgbGF6eSByb3V0ZXM6IFVua25vd24gbW9kdWxlICcke2VudHJ5TW9kdWxlS2V5fScuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgcm91dGVzOiBMYXp5Um91dGVbXSA9IFtdO1xuICAgIGNvbnN0IHNjYW5uZWRNb2R1bGVLZXlzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgcGVuZGluZ01vZHVsZUtleXMgPSBlbnRyeU1vZHVsZUtleSA/IFtlbnRyeU1vZHVsZUtleV0gOiBBcnJheS5mcm9tKHRoaXMubW9kdWxlcy5rZXlzKCkpO1xuXG4gICAgLy8gV2hlbiBsaXN0aW5nIGxhenkgcm91dGVzIGZvciBhIHNwZWNpZmljIGVudHJ5IG1vZHVsZSwgd2UgbmVlZCB0byByZWN1cnNpdmVseSBleHRyYWN0XG4gICAgLy8gXCJ0cmFuc2l0aXZlXCIgcm91dGVzIGZyb20gaW1wb3J0ZWQvZXhwb3J0ZWQgbW9kdWxlcy4gVGhpcyBpcyBub3QgbmVjZXNzYXJ5IHdoZW4gbGlzdGluZyBhbGxcbiAgICAvLyBsYXp5IHJvdXRlcywgYmVjYXVzZSBhbGwgYW5hbHl6ZWQgbW9kdWxlcyB3aWxsIGJlIHNjYW5uZWQgYW55d2F5LlxuICAgIGNvbnN0IHNjYW5SZWN1cnNpdmVseSA9IGVudHJ5TW9kdWxlS2V5ICE9PSB1bmRlZmluZWQ7XG5cbiAgICB3aGlsZSAocGVuZGluZ01vZHVsZUtleXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3Qga2V5ID0gcGVuZGluZ01vZHVsZUtleXMucG9wKCkhO1xuXG4gICAgICBpZiAoc2Nhbm5lZE1vZHVsZUtleXMuaGFzKGtleSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzY2FubmVkTW9kdWxlS2V5cy5hZGQoa2V5KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IHRoaXMubW9kdWxlcy5nZXQoa2V5KSE7XG4gICAgICBjb25zdCBlbnRyeVBvaW50cyA9IHNjYW5Gb3JSb3V0ZUVudHJ5UG9pbnRzKFxuICAgICAgICAgIGRhdGEuc291cmNlRmlsZSwgZGF0YS5tb2R1bGVOYW1lLCBkYXRhLCB0aGlzLmVudHJ5UG9pbnRNYW5hZ2VyLCB0aGlzLmV2YWx1YXRvcik7XG5cbiAgICAgIHJvdXRlcy5wdXNoKC4uLmVudHJ5UG9pbnRzLm1hcChlbnRyeVBvaW50ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3V0ZTogZW50cnlQb2ludC5sb2FkQ2hpbGRyZW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGU6IGVudHJ5UG9pbnQuZnJvbSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRNb2R1bGU6IGVudHJ5UG9pbnQucmVzb2x2ZWRUbyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSkpO1xuXG4gICAgICBpZiAoc2NhblJlY3Vyc2l2ZWx5KSB7XG4gICAgICAgIHBlbmRpbmdNb2R1bGVLZXlzLnB1c2goXG4gICAgICAgICAgICAuLi5bXG4gICAgICAgICAgICAgICAgLy8gU2NhbiB0aGUgcmV0cmlldmVkIGxhenkgcm91dGUgZW50cnkgcG9pbnRzLlxuICAgICAgICAgICAgICAgIC4uLmVudHJ5UG9pbnRzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgKHtyZXNvbHZlZFRvfSkgPT4gZW50cnlQb2ludEtleUZvcihyZXNvbHZlZFRvLmZpbGVQYXRoLCByZXNvbHZlZFRvLm1vZHVsZU5hbWUpKSxcbiAgICAgICAgICAgICAgICAvLyBTY2FuIHRoZSBjdXJyZW50IG1vZHVsZSdzIGltcG9ydGVkIG1vZHVsZXMuXG4gICAgICAgICAgICAgICAgLi4uc2NhbkZvckNhbmRpZGF0ZVRyYW5zaXRpdmVNb2R1bGVzKGRhdGEuaW1wb3J0cywgdGhpcy5ldmFsdWF0b3IpLFxuICAgICAgICAgICAgICAgIC8vIFNjYW4gdGhlIGN1cnJlbnQgbW9kdWxlJ3MgZXhwb3J0ZWQgbW9kdWxlcy5cbiAgICAgICAgICAgICAgICAuLi5zY2FuRm9yQ2FuZGlkYXRlVHJhbnNpdGl2ZU1vZHVsZXMoZGF0YS5leHBvcnRzLCB0aGlzLmV2YWx1YXRvciksXG4gICAgICAgIF0uZmlsdGVyKGtleSA9PiB0aGlzLm1vZHVsZXMuaGFzKGtleSkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcm91dGVzO1xuICB9XG59XG4iXX0=