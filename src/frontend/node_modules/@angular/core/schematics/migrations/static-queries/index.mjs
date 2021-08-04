/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SchematicsException } from '@angular-devkit/schematics';
import { relative } from 'path';
import * as ts from 'typescript';
import { NgComponentTemplateVisitor } from '../../utils/ng_component_template';
import { getProjectTsConfigPaths } from '../../utils/project_tsconfig_paths';
import { canMigrateFile, createMigrationProgram } from '../../utils/typescript/compiler_host';
import { NgQueryResolveVisitor } from './angular/ng_query_visitor';
import { QueryTemplateStrategy } from './strategies/template_strategy/template_strategy';
import { QueryTestStrategy } from './strategies/test_strategy/test_strategy';
import { QueryUsageStrategy } from './strategies/usage_strategy/usage_strategy';
import { getTransformedQueryCallExpr } from './transform';
var SELECTED_STRATEGY;
(function (SELECTED_STRATEGY) {
    SELECTED_STRATEGY[SELECTED_STRATEGY["TEMPLATE"] = 0] = "TEMPLATE";
    SELECTED_STRATEGY[SELECTED_STRATEGY["USAGE"] = 1] = "USAGE";
    SELECTED_STRATEGY[SELECTED_STRATEGY["TESTS"] = 2] = "TESTS";
})(SELECTED_STRATEGY || (SELECTED_STRATEGY = {}));
/** Entry point for the V8 static-query migration. */
export default function () {
    return runMigration;
}
/** Runs the V8 migration static-query migration for all determined TypeScript projects. */
function runMigration(tree, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const { buildPaths, testPaths } = getProjectTsConfigPaths(tree);
        const basePath = process.cwd();
        const logger = context.logger;
        if (!buildPaths.length && !testPaths.length) {
            throw new SchematicsException('Could not find any tsconfig file. Cannot migrate queries ' +
                'to add static flag.');
        }
        const analyzedFiles = new Set();
        const buildProjects = new Set();
        const failures = [];
        const strategy = process.env['NG_STATIC_QUERY_USAGE_STRATEGY'] === 'true' ?
            SELECTED_STRATEGY.USAGE :
            SELECTED_STRATEGY.TEMPLATE;
        for (const tsconfigPath of buildPaths) {
            const project = analyzeProject(tree, tsconfigPath, basePath, analyzedFiles, logger);
            if (project) {
                buildProjects.add(project);
            }
        }
        if (buildProjects.size) {
            for (let project of Array.from(buildProjects.values())) {
                failures.push(...yield runStaticQueryMigration(tree, project, strategy, logger));
            }
        }
        // For the "test" tsconfig projects we always want to use the test strategy as
        // we can't detect the proper timing within spec files.
        for (const tsconfigPath of testPaths) {
            const project = yield analyzeProject(tree, tsconfigPath, basePath, analyzedFiles, logger);
            if (project) {
                failures.push(...yield runStaticQueryMigration(tree, project, SELECTED_STRATEGY.TESTS, logger));
            }
        }
        if (failures.length) {
            logger.info('');
            logger.info('Some queries could not be migrated automatically. Please go');
            logger.info('through these manually and apply the appropriate timing.');
            logger.info('For more info on how to choose a flag, please see: ');
            logger.info('https://v8.angular.io/guide/static-query-migration');
            failures.forEach(failure => logger.warn(`⮑   ${failure}`));
        }
    });
}
/**
 * Analyzes the given TypeScript project by looking for queries that need to be
 * migrated. In case there are no queries that can be migrated, null is returned.
 */
function analyzeProject(tree, tsconfigPath, basePath, analyzedFiles, logger) {
    const { program, host } = createMigrationProgram(tree, tsconfigPath, basePath);
    const syntacticDiagnostics = program.getSyntacticDiagnostics();
    // Syntactic TypeScript errors can throw off the query analysis and therefore we want
    // to notify the developer that we couldn't analyze parts of the project. Developers
    // can just re-run the migration after fixing these failures.
    if (syntacticDiagnostics.length) {
        logger.warn(`\nTypeScript project "${tsconfigPath}" has syntactical errors which could cause ` +
            `an incomplete migration. Please fix the following failures and rerun the migration:`);
        logger.error(ts.formatDiagnostics(syntacticDiagnostics, host));
        logger.info('Migration can be rerun with: "ng update @angular/core --from 7 --to 8 --migrate-only"\n');
    }
    const typeChecker = program.getTypeChecker();
    const sourceFiles = program.getSourceFiles().filter(sourceFile => canMigrateFile(basePath, sourceFile, program));
    const queryVisitor = new NgQueryResolveVisitor(typeChecker);
    // Analyze all project source-files and collect all queries that
    // need to be migrated.
    sourceFiles.forEach(sourceFile => {
        const relativePath = relative(basePath, sourceFile.fileName);
        // Only look for queries within the current source files if the
        // file has not been analyzed before.
        if (!analyzedFiles.has(relativePath)) {
            analyzedFiles.add(relativePath);
            queryVisitor.visitNode(sourceFile);
        }
    });
    if (queryVisitor.resolvedQueries.size === 0) {
        return null;
    }
    return { program, host, tsconfigPath, typeChecker, basePath, queryVisitor, sourceFiles };
}
/**
 * Runs the static query migration for the given project. The schematic analyzes all
 * queries within the project and sets up the query timing based on the current usage
 * of the query property. e.g. a view query that is not used in any lifecycle hook does
 * not need to be static and can be set up with "static: false".
 */
function runStaticQueryMigration(tree, project, selectedStrategy, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceFiles, typeChecker, host, queryVisitor, tsconfigPath, basePath } = project;
        const printer = ts.createPrinter();
        const failureMessages = [];
        const templateVisitor = new NgComponentTemplateVisitor(typeChecker);
        // If the "usage" strategy is selected, we also need to add the query visitor
        // to the analysis visitors so that query usage in templates can be also checked.
        if (selectedStrategy === SELECTED_STRATEGY.USAGE) {
            sourceFiles.forEach(s => templateVisitor.visitNode(s));
        }
        const { resolvedQueries, classMetadata } = queryVisitor;
        const { resolvedTemplates } = templateVisitor;
        if (selectedStrategy === SELECTED_STRATEGY.USAGE) {
            // Add all resolved templates to the class metadata if the usage strategy is used. This
            // is necessary in order to be able to check component templates for static query usage.
            resolvedTemplates.forEach(template => {
                if (classMetadata.has(template.container)) {
                    classMetadata.get(template.container).template = template;
                }
            });
        }
        let strategy;
        if (selectedStrategy === SELECTED_STRATEGY.USAGE) {
            strategy = new QueryUsageStrategy(classMetadata, typeChecker);
        }
        else if (selectedStrategy === SELECTED_STRATEGY.TESTS) {
            strategy = new QueryTestStrategy();
        }
        else {
            strategy = new QueryTemplateStrategy(tsconfigPath, classMetadata, host);
        }
        try {
            strategy.setup();
        }
        catch (e) {
            if (selectedStrategy === SELECTED_STRATEGY.TEMPLATE) {
                logger.warn(`\nThe template migration strategy uses the Angular compiler ` +
                    `internally and therefore projects that no longer build successfully after ` +
                    `the update cannot use the template migration strategy. Please ensure ` +
                    `there are no AOT compilation errors.\n`);
            }
            // In case the strategy could not be set up properly, we just exit the
            // migration. We don't want to throw an exception as this could mean
            // that other migrations are interrupted.
            logger.warn(`Could not setup migration strategy for "${project.tsconfigPath}". The ` +
                `following error has been reported:\n`);
            logger.error(`${e.toString()}\n`);
            logger.info('Migration can be rerun with: "ng update @angular/core --from 7 --to 8 --migrate-only"\n');
            return [];
        }
        // Walk through all source files that contain resolved queries and update
        // the source files if needed. Note that we need to update multiple queries
        // within a source file within the same recorder in order to not throw off
        // the TypeScript node offsets.
        resolvedQueries.forEach((queries, sourceFile) => {
            const relativePath = relative(basePath, sourceFile.fileName);
            const update = tree.beginUpdate(relativePath);
            // Compute the query timing for all resolved queries and update the
            // query definitions to explicitly set the determined query timing.
            queries.forEach(q => {
                const queryExpr = q.decorator.node.expression;
                const { timing, message } = strategy.detectTiming(q);
                const result = getTransformedQueryCallExpr(q, timing, !!message);
                if (!result) {
                    return;
                }
                const newText = printer.printNode(ts.EmitHint.Unspecified, result.node, sourceFile);
                // Replace the existing query decorator call expression with the updated
                // call expression node.
                update.remove(queryExpr.getStart(), queryExpr.getWidth());
                update.insertRight(queryExpr.getStart(), newText);
                if (result.failureMessage || message) {
                    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, q.decorator.node.getStart());
                    failureMessages.push(`${relativePath}@${line + 1}:${character + 1}: ${result.failureMessage || message}`);
                }
            });
            tree.commitUpdate(update);
        });
        return failureMessages;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy9zdGF0aWMtcXVlcmllcy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7QUFHSCxPQUFPLEVBQXlCLG1CQUFtQixFQUFPLE1BQU0sNEJBQTRCLENBQUM7QUFDN0YsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUM5QixPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RSxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRSxPQUFPLEVBQUMsY0FBYyxFQUFFLHNCQUFzQixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFFNUYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDakUsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sa0RBQWtELENBQUM7QUFDdkYsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sMENBQTBDLENBQUM7QUFFM0UsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyxFQUFDLDJCQUEyQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBRXhELElBQUssaUJBSUo7QUFKRCxXQUFLLGlCQUFpQjtJQUNwQixpRUFBUSxDQUFBO0lBQ1IsMkRBQUssQ0FBQTtJQUNMLDJEQUFLLENBQUE7QUFDUCxDQUFDLEVBSkksaUJBQWlCLEtBQWpCLGlCQUFpQixRQUlyQjtBQVlELHFEQUFxRDtBQUNyRCxNQUFNLENBQUMsT0FBTztJQUNaLE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUFFRCwyRkFBMkY7QUFDM0YsU0FBZSxZQUFZLENB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QUFDLENBQUM7b0JBQzlFLGVBQWUsQ0FBQyxJQUFJLENBQ2hCLEdBQUcsWUFBWSxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksU0FBUyxHQUFHLENBQUMsS0FBSyxNQUFNLENBQUMsY0FBYyxJQUFJLE9BQU8sRUFBRSxDQUFDLENBQUM7aUJBQzFGO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVCLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxlQUFlLENBQUM7SUFDekIsQ0FBQztDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7bG9nZ2luZ30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge3JlbGF0aXZlfSBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge05nQ29tcG9uZW50VGVtcGxhdGVWaXNpdG9yfSBmcm9tICcuLi8uLi91dGlscy9uZ19jb21wb25lbnRfdGVtcGxhdGUnO1xuaW1wb3J0IHtnZXRQcm9qZWN0VHNDb25maWdQYXRoc30gZnJvbSAnLi4vLi4vdXRpbHMvcHJvamVjdF90c2NvbmZpZ19wYXRocyc7XG5pbXBvcnQge2Nhbk1pZ3JhdGVGaWxlLCBjcmVhdGVNaWdyYXRpb25Qcm9ncmFtfSBmcm9tICcuLi8uLi91dGlscy90eXBlc2NyaXB0L2NvbXBpbGVyX2hvc3QnO1xuXG5pbXBvcnQge05nUXVlcnlSZXNvbHZlVmlzaXRvcn0gZnJvbSAnLi9hbmd1bGFyL25nX3F1ZXJ5X3Zpc2l0b3InO1xuaW1wb3J0IHtRdWVyeVRlbXBsYXRlU3RyYXRlZ3l9IGZyb20gJy4vc3RyYXRlZ2llcy90ZW1wbGF0ZV9zdHJhdGVneS90ZW1wbGF0ZV9zdHJhdGVneSc7XG5pbXBvcnQge1F1ZXJ5VGVzdFN0cmF0ZWd5fSBmcm9tICcuL3N0cmF0ZWdpZXMvdGVzdF9zdHJhdGVneS90ZXN0X3N0cmF0ZWd5JztcbmltcG9ydCB7VGltaW5nU3RyYXRlZ3l9IGZyb20gJy4vc3RyYXRlZ2llcy90aW1pbmctc3RyYXRlZ3knO1xuaW1wb3J0IHtRdWVyeVVzYWdlU3RyYXRlZ3l9IGZyb20gJy4vc3RyYXRlZ2llcy91c2FnZV9zdHJhdGVneS91c2FnZV9zdHJhdGVneSc7XG5pbXBvcnQge2dldFRyYW5zZm9ybWVkUXVlcnlDYWxsRXhwcn0gZnJvbSAnLi90cmFuc2Zvcm0nO1xuXG5lbnVtIFNFTEVDVEVEX1NUUkFURUdZIHtcbiAgVEVNUExBVEUsXG4gIFVTQUdFLFxuICBURVNUUyxcbn1cblxuaW50ZXJmYWNlIEFuYWx5emVkUHJvamVjdCB7XG4gIHByb2dyYW06IHRzLlByb2dyYW07XG4gIGhvc3Q6IHRzLkNvbXBpbGVySG9zdDtcbiAgcXVlcnlWaXNpdG9yOiBOZ1F1ZXJ5UmVzb2x2ZVZpc2l0b3I7XG4gIHNvdXJjZUZpbGVzOiB0cy5Tb3VyY2VGaWxlW107XG4gIGJhc2VQYXRoOiBzdHJpbmc7XG4gIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcjtcbiAgdHNjb25maWdQYXRoOiBzdHJpbmc7XG59XG5cbi8qKiBFbnRyeSBwb2ludCBmb3IgdGhlIFY4IHN0YXRpYy1xdWVyeSBtaWdyYXRpb24uICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbigpOiBSdWxlIHtcbiAgcmV0dXJuIHJ1bk1pZ3JhdGlvbjtcbn1cblxuLyoqIFJ1bnMgdGhlIFY4IG1pZ3JhdGlvbiBzdGF0aWMtcXVlcnkgbWlncmF0aW9uIGZvciBhbGwgZGV0ZXJtaW5lZCBUeXBlU2NyaXB0IHByb2plY3RzLiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuTWlncmF0aW9uKHRyZWU6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpIHtcbiAgY29uc3Qge2J1aWxkUGF0aHMsIHRlc3RQYXRoc30gPSBnZXRQcm9qZWN0VHNDb25maWdQYXRocyh0cmVlKTtcbiAgY29uc3QgYmFzZVBhdGggPSBwcm9jZXNzLmN3ZCgpO1xuICBjb25zdCBsb2dnZXIgPSBjb250ZXh0LmxvZ2dlcjtcblxuICBpZiAoIWJ1aWxkUGF0aHMubGVuZ3RoICYmICF0ZXN0UGF0aHMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oXG4gICAgICAgICdDb3VsZCBub3QgZmluZCBhbnkgdHNjb25maWcgZmlsZS4gQ2Fubm90IG1pZ3JhdGUgcXVlcmllcyAnICtcbiAgICAgICAgJ3RvIGFkZCBzdGF0aWMgZmxhZy4nKTtcbiAgfVxuXG4gIGNvbnN0IGFuYWx5emVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgYnVpbGRQcm9qZWN0cyA9IG5ldyBTZXQ8QW5hbHl6ZWRQcm9qZWN0PigpO1xuICBjb25zdCBmYWlsdXJlcyA9IFtdO1xuICBjb25zdCBzdHJhdGVneSA9IHByb2Nlc3MuZW52WydOR19TVEFUSUNfUVVFUllfVVNBR0VfU1RSQVRFR1knXSA9PT0gJ3RydWUnID9cbiAgICAgIFNFTEVDVEVEX1NUUkFURUdZLlVTQUdFIDpcbiAgICAgIFNFTEVDVEVEX1NUUkFURUdZLlRFTVBMQVRFO1xuXG4gIGZvciAoY29uc3QgdHNjb25maWdQYXRoIG9mIGJ1aWxkUGF0aHMpIHtcbiAgICBjb25zdCBwcm9qZWN0ID0gYW5hbHl6ZVByb2plY3QodHJlZSwgdHNjb25maWdQYXRoLCBiYXNlUGF0aCwgYW5hbHl6ZWRGaWxlcywgbG9nZ2VyKTtcbiAgICBpZiAocHJvamVjdCkge1xuICAgICAgYnVpbGRQcm9qZWN0cy5hZGQocHJvamVjdCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGJ1aWxkUHJvamVjdHMuc2l6ZSkge1xuICAgIGZvciAobGV0IHByb2plY3Qgb2YgQXJyYXkuZnJvbShidWlsZFByb2plY3RzLnZhbHVlcygpKSkge1xuICAgICAgZmFpbHVyZXMucHVzaCguLi5hd2FpdCBydW5TdGF0aWNRdWVyeU1pZ3JhdGlvbih0cmVlLCBwcm9qZWN0LCBzdHJhdGVneSwgbG9nZ2VyKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gRm9yIHRoZSBcInRlc3RcIiB0c2NvbmZpZyBwcm9qZWN0cyB3ZSBhbHdheXMgd2FudCB0byB1c2UgdGhlIHRlc3Qgc3RyYXRlZ3kgYXNcbiAgLy8gd2UgY2FuJ3QgZGV0ZWN0IHRoZSBwcm9wZXIgdGltaW5nIHdpdGhpbiBzcGVjIGZpbGVzLlxuICBmb3IgKGNvbnN0IHRzY29uZmlnUGF0aCBvZiB0ZXN0UGF0aHMpIHtcbiAgICBjb25zdCBwcm9qZWN0ID0gYXdhaXQgYW5hbHl6ZVByb2plY3QodHJlZSwgdHNjb25maWdQYXRoLCBiYXNlUGF0aCwgYW5hbHl6ZWRGaWxlcywgbG9nZ2VyKTtcbiAgICBpZiAocHJvamVjdCkge1xuICAgICAgZmFpbHVyZXMucHVzaChcbiAgICAgICAgICAuLi5hd2FpdCBydW5TdGF0aWNRdWVyeU1pZ3JhdGlvbih0cmVlLCBwcm9qZWN0LCBTRUxFQ1RFRF9TVFJBVEVHWS5URVNUUywgbG9nZ2VyKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGZhaWx1cmVzLmxlbmd0aCkge1xuICAgIGxvZ2dlci5pbmZvKCcnKTtcbiAgICBsb2dnZXIuaW5mbygnU29tZSBxdWVyaWVzIGNvdWxkIG5vdCBiZSBtaWdyYXRlZCBhdXRvbWF0aWNhbGx5LiBQbGVhc2UgZ28nKTtcbiAgICBsb2dnZXIuaW5mbygndGhyb3VnaCB0aGVzZSBtYW51YWxseSBhbmQgYXBwbHkgdGhlIGFwcHJvcHJpYXRlIHRpbWluZy4nKTtcbiAgICBsb2dnZXIuaW5mbygnRm9yIG1vcmUgaW5mbyBvbiBob3cgdG8gY2hvb3NlIGEgZmxhZywgcGxlYXNlIHNlZTogJyk7XG4gICAgbG9nZ2VyLmluZm8oJ2h0dHBzOi8vdjguYW5ndWxhci5pby9ndWlkZS9zdGF0aWMtcXVlcnktbWlncmF0aW9uJyk7XG4gICAgZmFpbHVyZXMuZm9yRWFjaChmYWlsdXJlID0+IGxvZ2dlci53YXJuKGDirpEgICAke2ZhaWx1cmV9YCkpO1xuICB9XG59XG5cbi8qKlxuICogQW5hbHl6ZXMgdGhlIGdpdmVuIFR5cGVTY3JpcHQgcHJvamVjdCBieSBsb29raW5nIGZvciBxdWVyaWVzIHRoYXQgbmVlZCB0byBiZVxuICogbWlncmF0ZWQuIEluIGNhc2UgdGhlcmUgYXJlIG5vIHF1ZXJpZXMgdGhhdCBjYW4gYmUgbWlncmF0ZWQsIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmZ1bmN0aW9uIGFuYWx5emVQcm9qZWN0KFxuICAgIHRyZWU6IFRyZWUsIHRzY29uZmlnUGF0aDogc3RyaW5nLCBiYXNlUGF0aDogc3RyaW5nLCBhbmFseXplZEZpbGVzOiBTZXQ8c3RyaW5nPixcbiAgICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpKTogQW5hbHl6ZWRQcm9qZWN0fG51bGwge1xuICBjb25zdCB7cHJvZ3JhbSwgaG9zdH0gPSBjcmVhdGVNaWdyYXRpb25Qcm9ncmFtKHRyZWUsIHRzY29uZmlnUGF0aCwgYmFzZVBhdGgpO1xuICBjb25zdCBzeW50YWN0aWNEaWFnbm9zdGljcyA9IHByb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3MoKTtcblxuICAvLyBTeW50YWN0aWMgVHlwZVNjcmlwdCBlcnJvcnMgY2FuIHRocm93IG9mZiB0aGUgcXVlcnkgYW5hbHlzaXMgYW5kIHRoZXJlZm9yZSB3ZSB3YW50XG4gIC8vIHRvIG5vdGlmeSB0aGUgZGV2ZWxvcGVyIHRoYXQgd2UgY291bGRuJ3QgYW5hbHl6ZSBwYXJ0cyBvZiB0aGUgcHJvamVjdC4gRGV2ZWxvcGVyc1xuICAvLyBjYW4ganVzdCByZS1ydW4gdGhlIG1pZ3JhdGlvbiBhZnRlciBmaXhpbmcgdGhlc2UgZmFpbHVyZXMuXG4gIGlmIChzeW50YWN0aWNEaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgICAgYFxcblR5cGVTY3JpcHQgcHJvamVjdCBcIiR7dHNjb25maWdQYXRofVwiIGhhcyBzeW50YWN0aWNhbCBlcnJvcnMgd2hpY2ggY291bGQgY2F1c2UgYCArXG4gICAgICAgIGBhbiBpbmNvbXBsZXRlIG1pZ3JhdGlvbi4gUGxlYXNlIGZpeCB0aGUgZm9sbG93aW5nIGZhaWx1cmVzIGFuZCByZXJ1biB0aGUgbWlncmF0aW9uOmApO1xuICAgIGxvZ2dlci5lcnJvcih0cy5mb3JtYXREaWFnbm9zdGljcyhzeW50YWN0aWNEaWFnbm9zdGljcywgaG9zdCkpO1xuICAgIGxvZ2dlci5pbmZvKFxuICAgICAgICAnTWlncmF0aW9uIGNhbiBiZSByZXJ1biB3aXRoOiBcIm5nIHVwZGF0ZSBAYW5ndWxhci9jb3JlIC0tZnJvbSA3IC0tdG8gOCAtLW1pZ3JhdGUtb25seVwiXFxuJyk7XG4gIH1cblxuICBjb25zdCB0eXBlQ2hlY2tlciA9IHByb2dyYW0uZ2V0VHlwZUNoZWNrZXIoKTtcbiAgY29uc3Qgc291cmNlRmlsZXMgPVxuICAgICAgcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihzb3VyY2VGaWxlID0+IGNhbk1pZ3JhdGVGaWxlKGJhc2VQYXRoLCBzb3VyY2VGaWxlLCBwcm9ncmFtKSk7XG4gIGNvbnN0IHF1ZXJ5VmlzaXRvciA9IG5ldyBOZ1F1ZXJ5UmVzb2x2ZVZpc2l0b3IodHlwZUNoZWNrZXIpO1xuXG4gIC8vIEFuYWx5emUgYWxsIHByb2plY3Qgc291cmNlLWZpbGVzIGFuZCBjb2xsZWN0IGFsbCBxdWVyaWVzIHRoYXRcbiAgLy8gbmVlZCB0byBiZSBtaWdyYXRlZC5cbiAgc291cmNlRmlsZXMuZm9yRWFjaChzb3VyY2VGaWxlID0+IHtcbiAgICBjb25zdCByZWxhdGl2ZVBhdGggPSByZWxhdGl2ZShiYXNlUGF0aCwgc291cmNlRmlsZS5maWxlTmFtZSk7XG5cbiAgICAvLyBPbmx5IGxvb2sgZm9yIHF1ZXJpZXMgd2l0aGluIHRoZSBjdXJyZW50IHNvdXJjZSBmaWxlcyBpZiB0aGVcbiAgICAvLyBmaWxlIGhhcyBub3QgYmVlbiBhbmFseXplZCBiZWZvcmUuXG4gICAgaWYgKCFhbmFseXplZEZpbGVzLmhhcyhyZWxhdGl2ZVBhdGgpKSB7XG4gICAgICBhbmFseXplZEZpbGVzLmFkZChyZWxhdGl2ZVBhdGgpO1xuICAgICAgcXVlcnlWaXNpdG9yLnZpc2l0Tm9kZShzb3VyY2VGaWxlKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChxdWVyeVZpc2l0b3IucmVzb2x2ZWRRdWVyaWVzLnNpemUgPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgaG9zdCwgdHNjb25maWdQYXRoLCB0eXBlQ2hlY2tlciwgYmFzZVBhdGgsIHF1ZXJ5VmlzaXRvciwgc291cmNlRmlsZXN9O1xufVxuXG4vKipcbiAqIFJ1bnMgdGhlIHN0YXRpYyBxdWVyeSBtaWdyYXRpb24gZm9yIHRoZSBnaXZlbiBwcm9qZWN0LiBUaGUgc2NoZW1hdGljIGFuYWx5emVzIGFsbFxuICogcXVlcmllcyB3aXRoaW4gdGhlIHByb2plY3QgYW5kIHNldHMgdXAgdGhlIHF1ZXJ5IHRpbWluZyBiYXNlZCBvbiB0aGUgY3VycmVudCB1c2FnZVxuICogb2YgdGhlIHF1ZXJ5IHByb3BlcnR5LiBlLmcuIGEgdmlldyBxdWVyeSB0aGF0IGlzIG5vdCB1c2VkIGluIGFueSBsaWZlY3ljbGUgaG9vayBkb2VzXG4gKiBub3QgbmVlZCB0byBiZSBzdGF0aWMgYW5kIGNhbiBiZSBzZXQgdXAgd2l0aCBcInN0YXRpYzogZmFsc2VcIi5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuU3RhdGljUXVlcnlNaWdyYXRpb24oXG4gICAgdHJlZTogVHJlZSwgcHJvamVjdDogQW5hbHl6ZWRQcm9qZWN0LCBzZWxlY3RlZFN0cmF0ZWd5OiBTRUxFQ1RFRF9TVFJBVEVHWSxcbiAgICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCB7c291cmNlRmlsZXMsIHR5cGVDaGVja2VyLCBob3N0LCBxdWVyeVZpc2l0b3IsIHRzY29uZmlnUGF0aCwgYmFzZVBhdGh9ID0gcHJvamVjdDtcbiAgY29uc3QgcHJpbnRlciA9IHRzLmNyZWF0ZVByaW50ZXIoKTtcbiAgY29uc3QgZmFpbHVyZU1lc3NhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgTmdDb21wb25lbnRUZW1wbGF0ZVZpc2l0b3IodHlwZUNoZWNrZXIpO1xuXG4gIC8vIElmIHRoZSBcInVzYWdlXCIgc3RyYXRlZ3kgaXMgc2VsZWN0ZWQsIHdlIGFsc28gbmVlZCB0byBhZGQgdGhlIHF1ZXJ5IHZpc2l0b3JcbiAgLy8gdG8gdGhlIGFuYWx5c2lzIHZpc2l0b3JzIHNvIHRoYXQgcXVlcnkgdXNhZ2UgaW4gdGVtcGxhdGVzIGNhbiBiZSBhbHNvIGNoZWNrZWQuXG4gIGlmIChzZWxlY3RlZFN0cmF0ZWd5ID09PSBTRUxFQ1RFRF9TVFJBVEVHWS5VU0FHRSkge1xuICAgIHNvdXJjZUZpbGVzLmZvckVhY2gocyA9PiB0ZW1wbGF0ZVZpc2l0b3IudmlzaXROb2RlKHMpKTtcbiAgfVxuXG4gIGNvbnN0IHtyZXNvbHZlZFF1ZXJpZXMsIGNsYXNzTWV0YWRhdGF9ID0gcXVlcnlWaXNpdG9yO1xuICBjb25zdCB7cmVzb2x2ZWRUZW1wbGF0ZXN9ID0gdGVtcGxhdGVWaXNpdG9yO1xuXG4gIGlmIChzZWxlY3RlZFN0cmF0ZWd5ID09PSBTRUxFQ1RFRF9TVFJBVEVHWS5VU0FHRSkge1xuICAgIC8vIEFkZCBhbGwgcmVzb2x2ZWQgdGVtcGxhdGVzIHRvIHRoZSBjbGFzcyBtZXRhZGF0YSBpZiB0aGUgdXNhZ2Ugc3RyYXRlZ3kgaXMgdXNlZC4gVGhpc1xuICAgIC8vIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBiZSBhYmxlIHRvIGNoZWNrIGNvbXBvbmVudCB0ZW1wbGF0ZXMgZm9yIHN0YXRpYyBxdWVyeSB1c2FnZS5cbiAgICByZXNvbHZlZFRlbXBsYXRlcy5mb3JFYWNoKHRlbXBsYXRlID0+IHtcbiAgICAgIGlmIChjbGFzc01ldGFkYXRhLmhhcyh0ZW1wbGF0ZS5jb250YWluZXIpKSB7XG4gICAgICAgIGNsYXNzTWV0YWRhdGEuZ2V0KHRlbXBsYXRlLmNvbnRhaW5lcikhLnRlbXBsYXRlID0gdGVtcGxhdGU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBsZXQgc3RyYXRlZ3k6IFRpbWluZ1N0cmF0ZWd5O1xuICBpZiAoc2VsZWN0ZWRTdHJhdGVneSA9PT0gU0VMRUNURURfU1RSQVRFR1kuVVNBR0UpIHtcbiAgICBzdHJhdGVneSA9IG5ldyBRdWVyeVVzYWdlU3RyYXRlZ3koY2xhc3NNZXRhZGF0YSwgdHlwZUNoZWNrZXIpO1xuICB9IGVsc2UgaWYgKHNlbGVjdGVkU3RyYXRlZ3kgPT09IFNFTEVDVEVEX1NUUkFURUdZLlRFU1RTKSB7XG4gICAgc3RyYXRlZ3kgPSBuZXcgUXVlcnlUZXN0U3RyYXRlZ3koKTtcbiAgfSBlbHNlIHtcbiAgICBzdHJhdGVneSA9IG5ldyBRdWVyeVRlbXBsYXRlU3RyYXRlZ3kodHNjb25maWdQYXRoLCBjbGFzc01ldGFkYXRhLCBob3N0KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgc3RyYXRlZ3kuc2V0dXAoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChzZWxlY3RlZFN0cmF0ZWd5ID09PSBTRUxFQ1RFRF9TVFJBVEVHWS5URU1QTEFURSkge1xuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICAgYFxcblRoZSB0ZW1wbGF0ZSBtaWdyYXRpb24gc3RyYXRlZ3kgdXNlcyB0aGUgQW5ndWxhciBjb21waWxlciBgICtcbiAgICAgICAgICBgaW50ZXJuYWxseSBhbmQgdGhlcmVmb3JlIHByb2plY3RzIHRoYXQgbm8gbG9uZ2VyIGJ1aWxkIHN1Y2Nlc3NmdWxseSBhZnRlciBgICtcbiAgICAgICAgICBgdGhlIHVwZGF0ZSBjYW5ub3QgdXNlIHRoZSB0ZW1wbGF0ZSBtaWdyYXRpb24gc3RyYXRlZ3kuIFBsZWFzZSBlbnN1cmUgYCArXG4gICAgICAgICAgYHRoZXJlIGFyZSBubyBBT1QgY29tcGlsYXRpb24gZXJyb3JzLlxcbmApO1xuICAgIH1cbiAgICAvLyBJbiBjYXNlIHRoZSBzdHJhdGVneSBjb3VsZCBub3QgYmUgc2V0IHVwIHByb3Blcmx5LCB3ZSBqdXN0IGV4aXQgdGhlXG4gICAgLy8gbWlncmF0aW9uLiBXZSBkb24ndCB3YW50IHRvIHRocm93IGFuIGV4Y2VwdGlvbiBhcyB0aGlzIGNvdWxkIG1lYW5cbiAgICAvLyB0aGF0IG90aGVyIG1pZ3JhdGlvbnMgYXJlIGludGVycnVwdGVkLlxuICAgIGxvZ2dlci53YXJuKFxuICAgICAgICBgQ291bGQgbm90IHNldHVwIG1pZ3JhdGlvbiBzdHJhdGVneSBmb3IgXCIke3Byb2plY3QudHNjb25maWdQYXRofVwiLiBUaGUgYCArXG4gICAgICAgIGBmb2xsb3dpbmcgZXJyb3IgaGFzIGJlZW4gcmVwb3J0ZWQ6XFxuYCk7XG4gICAgbG9nZ2VyLmVycm9yKGAke2UudG9TdHJpbmcoKX1cXG5gKTtcbiAgICBsb2dnZXIuaW5mbyhcbiAgICAgICAgJ01pZ3JhdGlvbiBjYW4gYmUgcmVydW4gd2l0aDogXCJuZyB1cGRhdGUgQGFuZ3VsYXIvY29yZSAtLWZyb20gNyAtLXRvIDggLS1taWdyYXRlLW9ubHlcIlxcbicpO1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8vIFdhbGsgdGhyb3VnaCBhbGwgc291cmNlIGZpbGVzIHRoYXQgY29udGFpbiByZXNvbHZlZCBxdWVyaWVzIGFuZCB1cGRhdGVcbiAgLy8gdGhlIHNvdXJjZSBmaWxlcyBpZiBuZWVkZWQuIE5vdGUgdGhhdCB3ZSBuZWVkIHRvIHVwZGF0ZSBtdWx0aXBsZSBxdWVyaWVzXG4gIC8vIHdpdGhpbiBhIHNvdXJjZSBmaWxlIHdpdGhpbiB0aGUgc2FtZSByZWNvcmRlciBpbiBvcmRlciB0byBub3QgdGhyb3cgb2ZmXG4gIC8vIHRoZSBUeXBlU2NyaXB0IG5vZGUgb2Zmc2V0cy5cbiAgcmVzb2x2ZWRRdWVyaWVzLmZvckVhY2goKHF1ZXJpZXMsIHNvdXJjZUZpbGUpID0+IHtcbiAgICBjb25zdCByZWxhdGl2ZVBhdGggPSByZWxhdGl2ZShiYXNlUGF0aCwgc291cmNlRmlsZS5maWxlTmFtZSk7XG4gICAgY29uc3QgdXBkYXRlID0gdHJlZS5iZWdpblVwZGF0ZShyZWxhdGl2ZVBhdGgpO1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgcXVlcnkgdGltaW5nIGZvciBhbGwgcmVzb2x2ZWQgcXVlcmllcyBhbmQgdXBkYXRlIHRoZVxuICAgIC8vIHF1ZXJ5IGRlZmluaXRpb25zIHRvIGV4cGxpY2l0bHkgc2V0IHRoZSBkZXRlcm1pbmVkIHF1ZXJ5IHRpbWluZy5cbiAgICBxdWVyaWVzLmZvckVhY2gocSA9PiB7XG4gICAgICBjb25zdCBxdWVyeUV4cHIgPSBxLmRlY29yYXRvci5ub2RlLmV4cHJlc3Npb247XG4gICAgICBjb25zdCB7dGltaW5nLCBtZXNzYWdlfSA9IHN0cmF0ZWd5LmRldGVjdFRpbWluZyhxKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGdldFRyYW5zZm9ybWVkUXVlcnlDYWxsRXhwcihxLCB0aW1pbmcsICEhbWVzc2FnZSk7XG5cbiAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3VGV4dCA9IHByaW50ZXIucHJpbnROb2RlKHRzLkVtaXRIaW50LlVuc3BlY2lmaWVkLCByZXN1bHQubm9kZSwgc291cmNlRmlsZSk7XG5cbiAgICAgIC8vIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHF1ZXJ5IGRlY29yYXRvciBjYWxsIGV4cHJlc3Npb24gd2l0aCB0aGUgdXBkYXRlZFxuICAgICAgLy8gY2FsbCBleHByZXNzaW9uIG5vZGUuXG4gICAgICB1cGRhdGUucmVtb3ZlKHF1ZXJ5RXhwci5nZXRTdGFydCgpLCBxdWVyeUV4cHIuZ2V0V2lkdGgoKSk7XG4gICAgICB1cGRhdGUuaW5zZXJ0UmlnaHQocXVlcnlFeHByLmdldFN0YXJ0KCksIG5ld1RleHQpO1xuXG4gICAgICBpZiAocmVzdWx0LmZhaWx1cmVNZXNzYWdlIHx8IG1lc3NhZ2UpIHtcbiAgICAgICAgY29uc3Qge2xpbmUsIGNoYXJhY3Rlcn0gPVxuICAgICAgICAgICAgdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oc291cmNlRmlsZSwgcS5kZWNvcmF0b3Iubm9kZS5nZXRTdGFydCgpKTtcbiAgICAgICAgZmFpbHVyZU1lc3NhZ2VzLnB1c2goXG4gICAgICAgICAgICBgJHtyZWxhdGl2ZVBhdGh9QCR7bGluZSArIDF9OiR7Y2hhcmFjdGVyICsgMX06ICR7cmVzdWx0LmZhaWx1cmVNZXNzYWdlIHx8IG1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0cmVlLmNvbW1pdFVwZGF0ZSh1cGRhdGUpO1xuICB9KTtcblxuICByZXR1cm4gZmFpbHVyZU1lc3NhZ2VzO1xufVxuIl19