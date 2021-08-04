(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/elements/schematics/ng-add", ["require", "exports", "tslib", "@angular-devkit/schematics", "@angular-devkit/schematics/tasks", "@schematics/angular/utility/dependencies", "@schematics/angular/utility/workspace"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var schematics_1 = require("@angular-devkit/schematics");
    var tasks_1 = require("@angular-devkit/schematics/tasks");
    var dependencies_1 = require("@schematics/angular/utility/dependencies");
    var workspace_1 = require("@schematics/angular/utility/workspace");
    function default_1(options) {
        return schematics_1.chain([
            options && options.skipPackageJson ? schematics_1.noop() : addPolyfillDependency(),
            addPolyfill(options),
        ]);
    }
    exports.default = default_1;
    /** Adds a package.json dependency for document-register-element */
    function addPolyfillDependency() {
        return function (host, context) {
            dependencies_1.addPackageJsonDependency(host, {
                type: dependencies_1.NodeDependencyType.Default,
                name: 'document-register-element',
                version: '^1.7.2',
            });
            context.logger.info('Added "document-register-element" as a dependency.');
            // Install the dependency
            context.addTask(new tasks_1.NodePackageInstallTask());
        };
    }
    /** Adds the document-register-element.js to the polyfills file. */
    function addPolyfill(options) {
        var _this = this;
        return function (host, context) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var projectName, workspace, project, buildTarget, polyfills, content, recorder;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        projectName = options.project;
                        if (!projectName) {
                            throw new schematics_1.SchematicsException('Option "project" is required.');
                        }
                        return [4 /*yield*/, workspace_1.getWorkspace(host)];
                    case 1:
                        workspace = _a.sent();
                        project = workspace.projects.get(projectName);
                        if (!project) {
                            throw new schematics_1.SchematicsException("Project " + projectName + " is not defined in this workspace.");
                        }
                        if (project.extensions['projectType'] !== 'application') {
                            throw new schematics_1.SchematicsException("@angular/elements requires a project type of \"application\" but " + projectName + " isn't.");
                        }
                        buildTarget = project.targets.get('build');
                        if (!buildTarget || !buildTarget.options) {
                            throw new schematics_1.SchematicsException("Cannot find 'options' for " + projectName + " build target.");
                        }
                        polyfills = buildTarget.options.polyfills;
                        if (typeof polyfills !== 'string') {
                            throw new schematics_1.SchematicsException("polyfills for " + projectName + " build target is not a string.");
                        }
                        content = host.read(polyfills).toString();
                        if (!content.includes('document-register-element')) {
                            recorder = host.beginUpdate(polyfills);
                            recorder.insertRight(content.length, "import 'document-register-element';\n");
                            host.commitUpdate(recorder);
                        }
                        context.logger.info('Added "document-register-element" to polyfills.');
                        return [2 /*return*/];
                }
            });
        }); };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9lbGVtZW50cy9zY2hlbWF0aWNzL25nLWFkZC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCx5REFBMEc7SUFDMUcsMERBQXdFO0lBQ3hFLHlFQUFzRztJQUN0RyxtRUFBbUU7SUFJbkUsbUJBQXdCLE9BQWU7UUFDckMsT0FBTyxrQkFBSyxDQUFDO1lBQ1gsT0FBTyxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLGlCQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMscUJBQXFCLEVBQUU7WUFDckUsV0FBVyxDQUFDLE9BQU8sQ0FBQztTQUNyQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBTEQsNEJBS0M7SUFFRCxtRUFBbUU7SUFDbkUsU0FBUyxxQkFBcUI7UUFDNUIsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUMzQyx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUU7Z0JBQzdCLElBQUksRUFBRSxpQ0FBa0IsQ0FBQyxPQUFPO2dCQUNoQyxJQUFJLEVBQUUsMkJBQTJCO2dCQUNqQyxPQUFPLEVBQUUsUUFBUTthQUNsQixDQUFDLENBQUM7WUFDSCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1lBRTFFLHlCQUF5QjtZQUN6QixPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksOEJBQXNCLEVBQUUsQ0FBQyxDQUFDO1FBQ2hELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxtRUFBbUU7SUFDbkUsU0FBUyxXQUFXLENBQUMsT0FBZTtRQUFwQyxpQkF3Q0M7UUF2Q0MsT0FBTyxVQUFPLElBQVUsRUFBRSxPQUF5Qjs7Ozs7d0JBQzNDLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDO3dCQUVwQyxJQUFJLENBQUMsV0FBVyxFQUFFOzRCQUNoQixNQUFNLElBQUksZ0NBQW1CLENBQUMsK0JBQStCLENBQUMsQ0FBQzt5QkFDaEU7d0JBRWlCLHFCQUFNLHdCQUFZLENBQUMsSUFBSSxDQUFDLEVBQUE7O3dCQUFwQyxTQUFTLEdBQUcsU0FBd0I7d0JBQ3BDLE9BQU8sR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQzt3QkFFcEQsSUFBSSxDQUFDLE9BQU8sRUFBRTs0QkFDWixNQUFNLElBQUksZ0NBQW1CLENBQUMsYUFBVyxXQUFXLHVDQUFvQyxDQUFDLENBQUM7eUJBQzNGO3dCQUVELElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsS0FBSyxhQUFhLEVBQUU7NEJBQ3ZELE1BQU0sSUFBSSxnQ0FBbUIsQ0FDekIsc0VBQWtFLFdBQVcsWUFBUyxDQUFDLENBQUM7eUJBQzdGO3dCQUVLLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDakQsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7NEJBQ3hDLE1BQU0sSUFBSSxnQ0FBbUIsQ0FBQywrQkFBNkIsV0FBVyxtQkFBZ0IsQ0FBQyxDQUFDO3lCQUN6Rjt3QkFFTSxTQUFTLEdBQUksV0FBVyxDQUFDLE9BQU8sVUFBdkIsQ0FBd0I7d0JBQ3hDLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxFQUFFOzRCQUNqQyxNQUFNLElBQUksZ0NBQW1CLENBQUMsbUJBQWlCLFdBQVcsbUNBQWdDLENBQUMsQ0FBQzt5QkFDN0Y7d0JBRUssT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBQ2hELElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLDJCQUEyQixDQUFDLEVBQUU7NEJBRTVDLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDOzRCQUM3QyxRQUFRLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsdUNBQXVDLENBQUMsQ0FBQzs0QkFDOUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQzt5QkFDN0I7d0JBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaURBQWlELENBQUMsQ0FBQzs7OzthQUN4RSxDQUFDO0lBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtjaGFpbiwgbm9vcCwgUnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZX0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtOb2RlUGFja2FnZUluc3RhbGxUYXNrfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90YXNrcyc7XG5pbXBvcnQge2FkZFBhY2thZ2VKc29uRGVwZW5kZW5jeSwgTm9kZURlcGVuZGVuY3lUeXBlfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvZGVwZW5kZW5jaWVzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvd29ya3NwYWNlJztcblxuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiBjaGFpbihbXG4gICAgb3B0aW9ucyAmJiBvcHRpb25zLnNraXBQYWNrYWdlSnNvbiA/IG5vb3AoKSA6IGFkZFBvbHlmaWxsRGVwZW5kZW5jeSgpLFxuICAgIGFkZFBvbHlmaWxsKG9wdGlvbnMpLFxuICBdKTtcbn1cblxuLyoqIEFkZHMgYSBwYWNrYWdlLmpzb24gZGVwZW5kZW5jeSBmb3IgZG9jdW1lbnQtcmVnaXN0ZXItZWxlbWVudCAqL1xuZnVuY3Rpb24gYWRkUG9seWZpbGxEZXBlbmRlbmN5KCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwge1xuICAgICAgdHlwZTogTm9kZURlcGVuZGVuY3lUeXBlLkRlZmF1bHQsXG4gICAgICBuYW1lOiAnZG9jdW1lbnQtcmVnaXN0ZXItZWxlbWVudCcsXG4gICAgICB2ZXJzaW9uOiAnXjEuNy4yJyxcbiAgICB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKCdBZGRlZCBcImRvY3VtZW50LXJlZ2lzdGVyLWVsZW1lbnRcIiBhcyBhIGRlcGVuZGVuY3kuJyk7XG5cbiAgICAvLyBJbnN0YWxsIHRoZSBkZXBlbmRlbmN5XG4gICAgY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpO1xuICB9O1xufVxuXG4vKiogQWRkcyB0aGUgZG9jdW1lbnQtcmVnaXN0ZXItZWxlbWVudC5qcyB0byB0aGUgcG9seWZpbGxzIGZpbGUuICovXG5mdW5jdGlvbiBhZGRQb2x5ZmlsbChvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIGFzeW5jIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBvcHRpb25zLnByb2plY3Q7XG5cbiAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignT3B0aW9uIFwicHJvamVjdFwiIGlzIHJlcXVpcmVkLicpO1xuICAgIH1cblxuICAgIGNvbnN0IHdvcmtzcGFjZSA9IGF3YWl0IGdldFdvcmtzcGFjZShob3N0KTtcbiAgICBjb25zdCBwcm9qZWN0ID0gd29ya3NwYWNlLnByb2plY3RzLmdldChwcm9qZWN0TmFtZSk7XG5cbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBQcm9qZWN0ICR7cHJvamVjdE5hbWV9IGlzIG5vdCBkZWZpbmVkIGluIHRoaXMgd29ya3NwYWNlLmApO1xuICAgIH1cblxuICAgIGlmIChwcm9qZWN0LmV4dGVuc2lvbnNbJ3Byb2plY3RUeXBlJ10gIT09ICdhcHBsaWNhdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKFxuICAgICAgICAgIGBAYW5ndWxhci9lbGVtZW50cyByZXF1aXJlcyBhIHByb2plY3QgdHlwZSBvZiBcImFwcGxpY2F0aW9uXCIgYnV0ICR7cHJvamVjdE5hbWV9IGlzbid0LmApO1xuICAgIH1cblxuICAgIGNvbnN0IGJ1aWxkVGFyZ2V0ID0gcHJvamVjdC50YXJnZXRzLmdldCgnYnVpbGQnKTtcbiAgICBpZiAoIWJ1aWxkVGFyZ2V0IHx8ICFidWlsZFRhcmdldC5vcHRpb25zKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgQ2Fubm90IGZpbmQgJ29wdGlvbnMnIGZvciAke3Byb2plY3ROYW1lfSBidWlsZCB0YXJnZXQuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qge3BvbHlmaWxsc30gPSBidWlsZFRhcmdldC5vcHRpb25zO1xuICAgIGlmICh0eXBlb2YgcG9seWZpbGxzICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYHBvbHlmaWxscyBmb3IgJHtwcm9qZWN0TmFtZX0gYnVpbGQgdGFyZ2V0IGlzIG5vdCBhIHN0cmluZy5gKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50ID0gaG9zdC5yZWFkKHBvbHlmaWxscykudG9TdHJpbmcoKTtcbiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ2RvY3VtZW50LXJlZ2lzdGVyLWVsZW1lbnQnKSkge1xuICAgICAgLy8gQWRkIHN0cmluZyBhdCB0aGUgZW5kIG9mIHRoZSBmaWxlLlxuICAgICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBvbHlmaWxscyk7XG4gICAgICByZWNvcmRlci5pbnNlcnRSaWdodChjb250ZW50Lmxlbmd0aCwgYGltcG9ydCAnZG9jdW1lbnQtcmVnaXN0ZXItZWxlbWVudCc7XFxuYCk7XG4gICAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgfVxuXG4gICAgY29udGV4dC5sb2dnZXIuaW5mbygnQWRkZWQgXCJkb2N1bWVudC1yZWdpc3Rlci1lbGVtZW50XCIgdG8gcG9seWZpbGxzLicpO1xuICB9O1xufVxuIl19