#!/usr/bin/env node
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as yargs from 'yargs';
import { setFileSystem, NodeJSFileSystem } from '../../src/ngtsc/file_system';
import { ConsoleLogger, LogLevel } from '../../src/ngtsc/logging';
export function parseCommandLineOptions(args) {
    var _a;
    const options = yargs
        .option('s', {
        alias: 'source',
        describe: 'A path (relative to the working directory) of the `node_modules` folder to process.',
        default: './node_modules',
        type: 'string',
    })
        .option('f', { alias: 'formats', hidden: true, array: true, type: 'string' })
        .option('p', {
        alias: 'properties',
        array: true,
        describe: 'An array of names of properties in package.json to compile (e.g. `module` or `main`)\n' +
            'Each of these properties should hold the path to a bundle-format.\n' +
            'If provided, only the specified properties are considered for processing.\n' +
            'If not provided, all the supported format properties (e.g. fesm2015, fesm5, es2015, esm2015, esm5, main, module) in the package.json are considered.',
        type: 'string',
    })
        .option('t', {
        alias: 'target',
        describe: 'A relative path (from the `source` path) to a single entry-point to process (plus its dependencies).\n' +
            'If this property is provided then `error-on-failed-entry-point` is forced to true.\n' +
            'This option overrides the `--use-program-dependencies` option.',
        type: 'string',
    })
        .option('use-program-dependencies', {
        type: 'boolean',
        describe: 'If this property is provided then the entry-points to process are parsed from the program defined by the loaded tsconfig.json. See `--tsconfig`.\n' +
            'This option is overridden by the `--target` option.',
    })
        .option('first-only', {
        describe: 'If specified then only the first matching package.json property will be compiled.\n' +
            'This option is overridden by `--typings-only`.',
        type: 'boolean',
    })
        .option('typings-only', {
        describe: 'If specified then only the typings files are processed, and no JS source files will be modified.\n' +
            'Setting this option will force `--first-only` to be set, since only one format is needed to process the typings',
        type: 'boolean',
    })
        .option('create-ivy-entry-points', {
        describe: 'If specified then new `*_ivy_ngcc` entry-points will be added to package.json rather than modifying the ones in-place.\n' +
            'For this to work you need to have custom resolution set up (e.g. in webpack) to look for these new entry-points.\n' +
            'The Angular CLI does this already, so it is safe to use this option if the project is being built via the CLI.',
        type: 'boolean',
    })
        .option('legacy-message-ids', {
        describe: 'Render `$localize` messages with legacy format ids.\n' +
            'The default value is `true`. Only set this to `false` if you do not want legacy message ids to\n' +
            'be rendered. For example, if you are not using legacy message ids in your translation files\n' +
            'AND are not doing compile-time inlining of translations, in which case the extra message ids\n' +
            'would add unwanted size to the final source bundle.\n' +
            'It is safe to leave this set to true if you are doing compile-time inlining because the extra\n' +
            'legacy message ids will all be stripped during translation.',
        type: 'boolean',
        default: true,
    })
        .option('async', {
        describe: 'Whether to compile asynchronously. This is enabled by default as it allows compilations to be parallelized.\n' +
            'Disabling asynchronous compilation may be useful for debugging.',
        type: 'boolean',
        default: true,
    })
        .option('l', {
        alias: 'loglevel',
        describe: 'The lowest severity logging message that should be output.',
        choices: ['debug', 'info', 'warn', 'error'],
        type: 'string',
    })
        .option('invalidate-entry-point-manifest', {
        describe: 'If this is set then ngcc will not read an entry-point manifest file from disk.\n' +
            'Instead it will walk the directory tree as normal looking for entry-points, and then write a new manifest file.',
        type: 'boolean',
        default: false,
    })
        .option('error-on-failed-entry-point', {
        describe: 'Set this option in order to terminate immediately with an error code if an entry-point fails to be processed.\n' +
            'If `-t`/`--target` is provided then this property is always true and cannot be changed. Otherwise the default is false.\n' +
            'When set to false, ngcc will continue to process entry-points after a failure. In which case it will log an error and resume processing other entry-points.',
        type: 'boolean',
        default: false,
    })
        .option('tsconfig', {
        describe: 'A path to a tsconfig.json file that will be used to configure the Angular compiler and module resolution used by ngcc.\n' +
            'If not provided, ngcc will attempt to read a `tsconfig.json` file from the folder above that given by the `-s` option.\n' +
            'Set to false (via `--no-tsconfig`) if you do not want ngcc to use any `tsconfig.json` file.',
        type: 'string',
    })
        .strict()
        .help()
        .parse(args);
    if ((_a = options.f) === null || _a === void 0 ? void 0 : _a.length) {
        console.error('The formats option (-f/--formats) has been removed. Consider the properties option (-p/--properties) instead.');
        process.exit(1);
    }
    const fs = new NodeJSFileSystem();
    setFileSystem(fs);
    const baseSourcePath = fs.resolve(options.s || './node_modules');
    const propertiesToConsider = options.p;
    const targetEntryPointPath = options.t;
    const compileAllFormats = !options['first-only'];
    const typingsOnly = options['typings-only'];
    const createNewEntryPointFormats = options['create-ivy-entry-points'];
    const logLevel = options.l;
    const enableI18nLegacyMessageIdFormat = options['legacy-message-ids'];
    const invalidateEntryPointManifest = options['invalidate-entry-point-manifest'];
    const errorOnFailedEntryPoint = options['error-on-failed-entry-point'];
    const findEntryPointsFromTsConfigProgram = options['use-program-dependencies'];
    // yargs is not so great at mixed string+boolean types, so we have to test tsconfig against a
    // string "false" to capture the `tsconfig=false` option.
    // And we have to convert the option to a string to handle `no-tsconfig`, which will be `false`.
    const tsConfigPath = `${options.tsconfig}` === 'false' ? null : options.tsconfig;
    const logger = logLevel && new ConsoleLogger(LogLevel[logLevel]);
    return {
        basePath: baseSourcePath,
        propertiesToConsider,
        targetEntryPointPath,
        typingsOnly,
        compileAllFormats,
        createNewEntryPointFormats,
        logger,
        enableI18nLegacyMessageIdFormat,
        async: options.async,
        invalidateEntryPointManifest,
        errorOnFailedEntryPoint,
        tsConfigPath,
        findEntryPointsFromTsConfigProgram,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZF9saW5lX29wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvY29tbWFuZF9saW5lX29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBOzs7Ozs7R0FNRztBQUNILE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBRS9CLE9BQU8sRUFBQyxhQUFhLEVBQUUsZ0JBQWdCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUM1RSxPQUFPLEVBQUMsYUFBYSxFQUFFLFFBQVEsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBR2hFLE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxJQUFjOztJQUNwRCxNQUFNLE9BQU8sR0FDVCxLQUFLO1NBQ0EsTUFBTSxDQUFDLEdBQUcsRUFBRTtRQUNYLEtBQUssRUFBRSxRQUFRO1FBQ2YsUUFBUSxFQUNKLHFGQUFxRjtRQUN6RixPQUFPLEVBQUUsZ0JBQWdCO1FBQ3pCLElBQUksRUFBRSxRQUFRO0tBQ2YsQ0FBQztTQUNELE1BQU0sQ0FBQyxHQUFHLEVBQUUsRUFBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUM7U0FDMUUsTUFBTSxDQUFDLEdBQUcsRUFBRTtRQUNYLEtBQUssRUFBRSxZQUFZO1FBQ25CLEtBQUssRUFBRSxJQUFJO1FBQ1gsUUFBUSxFQUNKLHdGQUF3RjtZQUN4RixxRUFBcUU7WUFDckUsNkVBQTZFO1lBQzdFLHNKQUFzSjtRQUMxSixJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUM7U0FDRCxNQUFNLENBQUMsR0FBRyxFQUFFO1FBQ1gsS0FBSyxFQUFFLFFBQVE7UUFDZixRQUFRLEVBQ0osd0dBQXdHO1lBQ3hHLHNGQUFzRjtZQUN0RixnRUFBZ0U7UUFDcEUsSUFBSSxFQUFFLFFBQVE7S0FDZixDQUFDO1NBQ0QsTUFBTSxDQUFDLDBCQUEwQixFQUFFO1FBQ2xDLElBQUksRUFBRSxTQUFTO1FBQ2YsUUFBUSxFQUNKLG9KQUFvSjtZQUNwSixxREFBcUQ7S0FDMUQsQ0FBQztTQUNELE1BQU0sQ0FBQyxZQUFZLEVBQUU7UUFDcEIsUUFBUSxFQUNKLHFGQUFxRjtZQUNyRixnREFBZ0Q7UUFDcEQsSUFBSSxFQUFFLFNBQVM7S0FDaEIsQ0FBQztTQUNELE1BQU0sQ0FBQyxjQUFjLEVBQUU7UUFDdEIsUUFBUSxFQUNKLG9HQUFvRztZQUNwRyxpSEFBaUg7UUFDckgsSUFBSSxFQUFFLFNBQVM7S0FDaEIsQ0FBQztTQUNELE1BQU0sQ0FBQyx5QkFBeUIsRUFBRTtRQUNqQyxRQUFRLEVBQ0osMEhBQTBIO1lBQzFILG9IQUFvSDtZQUNwSCxnSEFBZ0g7UUFDcEgsSUFBSSxFQUFFLFNBQVM7S0FDaEIsQ0FBQztTQUNELE1BQU0sQ0FBQyxvQkFBb0IsRUFBRTtRQUM1QixRQUFRLEVBQUUsdURBQXVEO1lBQzdELGtHQUFrRztZQUNsRywrRkFBK0Y7WUFDL0YsZ0dBQWdHO1lBQ2hHLHVEQUF1RDtZQUN2RCxpR0FBaUc7WUFDakcsNkRBQTZEO1FBQ2pFLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLElBQUk7S0FDZCxDQUFDO1NBQ0QsTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUNmLFFBQVEsRUFDSiwrR0FBK0c7WUFDL0csaUVBQWlFO1FBQ3JFLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLElBQUk7S0FDZCxDQUFDO1NBQ0QsTUFBTSxDQUFDLEdBQUcsRUFBRTtRQUNYLEtBQUssRUFBRSxVQUFVO1FBQ2pCLFFBQVEsRUFBRSw0REFBNEQ7UUFDdEUsT0FBTyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDO1FBQzNDLElBQUksRUFBRSxRQUFRO0tBQ2YsQ0FBQztTQUNELE1BQU0sQ0FBQyxpQ0FBaUMsRUFBRTtRQUN6QyxRQUFRLEVBQ0osa0ZBQWtGO1lBQ2xGLGlIQUFpSDtRQUNySCxJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxLQUFLO0tBQ2YsQ0FBQztTQUNELE1BQU0sQ0FBQyw2QkFBNkIsRUFBRTtRQUNyQyxRQUFRLEVBQ0osaUhBQWlIO1lBQ2pILDJIQUEySDtZQUMzSCw2SkFBNko7UUFDakssSUFBSSxFQUFFLFNBQVM7UUFDZixPQUFPLEVBQUUsS0FBSztLQUNmLENBQUM7U0FDRCxNQUFNLENBQUMsVUFBVSxFQUFFO1FBQ2xCLFFBQVEsRUFDSiwwSEFBMEg7WUFDMUgsMEhBQTBIO1lBQzFILDZGQUE2RjtRQUNqRyxJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUM7U0FDRCxNQUFNLEVBQUU7U0FDUixJQUFJLEVBQUU7U0FDTixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFckIsSUFBSSxNQUFBLE9BQU8sQ0FBQyxDQUFDLDBDQUFFLE1BQU0sRUFBRTtRQUNyQixPQUFPLENBQUMsS0FBSyxDQUNULCtHQUErRyxDQUFDLENBQUM7UUFDckgsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNqQjtJQUVELE1BQU0sRUFBRSxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztJQUNsQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFbEIsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLENBQUM7SUFDakUsTUFBTSxvQkFBb0IsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUN2QyxNQUFNLGlCQUFpQixHQUFHLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2pELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUM1QyxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxDQUFzQyxDQUFDO0lBQ2hFLE1BQU0sK0JBQStCLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDdEUsTUFBTSw0QkFBNEIsR0FBRyxPQUFPLENBQUMsaUNBQWlDLENBQUMsQ0FBQztJQUNoRixNQUFNLHVCQUF1QixHQUFHLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sa0NBQWtDLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDL0UsNkZBQTZGO0lBQzdGLHlEQUF5RDtJQUN6RCxnR0FBZ0c7SUFDaEcsTUFBTSxZQUFZLEdBQUcsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFFakYsTUFBTSxNQUFNLEdBQUcsUUFBUSxJQUFJLElBQUksYUFBYSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRWpFLE9BQU87UUFDTCxRQUFRLEVBQUUsY0FBYztRQUN4QixvQkFBb0I7UUFDcEIsb0JBQW9CO1FBQ3BCLFdBQVc7UUFDWCxpQkFBaUI7UUFDakIsMEJBQTBCO1FBQzFCLE1BQU07UUFDTiwrQkFBK0I7UUFDL0IsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1FBQ3BCLDRCQUE0QjtRQUM1Qix1QkFBdUI7UUFDdkIsWUFBWTtRQUNaLGtDQUFrQztLQUNuQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgeWFyZ3MgZnJvbSAneWFyZ3MnO1xuXG5pbXBvcnQge3NldEZpbGVTeXN0ZW0sIE5vZGVKU0ZpbGVTeXN0ZW19IGZyb20gJy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0NvbnNvbGVMb2dnZXIsIExvZ0xldmVsfSBmcm9tICcuLi8uLi9zcmMvbmd0c2MvbG9nZ2luZyc7XG5pbXBvcnQge05nY2NPcHRpb25zfSBmcm9tICcuL25nY2Nfb3B0aW9ucyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvbW1hbmRMaW5lT3B0aW9ucyhhcmdzOiBzdHJpbmdbXSk6IE5nY2NPcHRpb25zIHtcbiAgY29uc3Qgb3B0aW9ucyA9XG4gICAgICB5YXJnc1xuICAgICAgICAgIC5vcHRpb24oJ3MnLCB7XG4gICAgICAgICAgICBhbGlhczogJ3NvdXJjZScsXG4gICAgICAgICAgICBkZXNjcmliZTpcbiAgICAgICAgICAgICAgICAnQSBwYXRoIChyZWxhdGl2ZSB0byB0aGUgd29ya2luZyBkaXJlY3RvcnkpIG9mIHRoZSBgbm9kZV9tb2R1bGVzYCBmb2xkZXIgdG8gcHJvY2Vzcy4nLFxuICAgICAgICAgICAgZGVmYXVsdDogJy4vbm9kZV9tb2R1bGVzJyxcbiAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9wdGlvbignZicsIHthbGlhczogJ2Zvcm1hdHMnLCBoaWRkZW46wqB0cnVlLCBhcnJheTogdHJ1ZSwgdHlwZTogJ3N0cmluZyd9KVxuICAgICAgICAgIC5vcHRpb24oJ3AnLCB7XG4gICAgICAgICAgICBhbGlhczogJ3Byb3BlcnRpZXMnLFxuICAgICAgICAgICAgYXJyYXk6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmliZTpcbiAgICAgICAgICAgICAgICAnQW4gYXJyYXkgb2YgbmFtZXMgb2YgcHJvcGVydGllcyBpbiBwYWNrYWdlLmpzb24gdG8gY29tcGlsZSAoZS5nLiBgbW9kdWxlYCBvciBgbWFpbmApXFxuJyArXG4gICAgICAgICAgICAgICAgJ0VhY2ggb2YgdGhlc2UgcHJvcGVydGllcyBzaG91bGQgaG9sZCB0aGUgcGF0aCB0byBhIGJ1bmRsZS1mb3JtYXQuXFxuJyArXG4gICAgICAgICAgICAgICAgJ0lmIHByb3ZpZGVkLCBvbmx5IHRoZSBzcGVjaWZpZWQgcHJvcGVydGllcyBhcmUgY29uc2lkZXJlZCBmb3IgcHJvY2Vzc2luZy5cXG4nICtcbiAgICAgICAgICAgICAgICAnSWYgbm90IHByb3ZpZGVkLCBhbGwgdGhlIHN1cHBvcnRlZCBmb3JtYXQgcHJvcGVydGllcyAoZS5nLiBmZXNtMjAxNSwgZmVzbTUsIGVzMjAxNSwgZXNtMjAxNSwgZXNtNSwgbWFpbiwgbW9kdWxlKSBpbiB0aGUgcGFja2FnZS5qc29uIGFyZSBjb25zaWRlcmVkLicsXG4gICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5vcHRpb24oJ3QnLCB7XG4gICAgICAgICAgICBhbGlhczogJ3RhcmdldCcsXG4gICAgICAgICAgICBkZXNjcmliZTpcbiAgICAgICAgICAgICAgICAnQSByZWxhdGl2ZSBwYXRoIChmcm9tIHRoZSBgc291cmNlYCBwYXRoKSB0byBhIHNpbmdsZSBlbnRyeS1wb2ludCB0byBwcm9jZXNzIChwbHVzIGl0cyBkZXBlbmRlbmNpZXMpLlxcbicgK1xuICAgICAgICAgICAgICAgICdJZiB0aGlzIHByb3BlcnR5IGlzIHByb3ZpZGVkIHRoZW4gYGVycm9yLW9uLWZhaWxlZC1lbnRyeS1wb2ludGAgaXMgZm9yY2VkIHRvIHRydWUuXFxuJyArXG4gICAgICAgICAgICAgICAgJ1RoaXMgb3B0aW9uIG92ZXJyaWRlcyB0aGUgYC0tdXNlLXByb2dyYW0tZGVwZW5kZW5jaWVzYCBvcHRpb24uJyxcbiAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9wdGlvbigndXNlLXByb2dyYW0tZGVwZW5kZW5jaWVzJywge1xuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgZGVzY3JpYmU6XG4gICAgICAgICAgICAgICAgJ0lmIHRoaXMgcHJvcGVydHkgaXMgcHJvdmlkZWQgdGhlbiB0aGUgZW50cnktcG9pbnRzIHRvIHByb2Nlc3MgYXJlIHBhcnNlZCBmcm9tIHRoZSBwcm9ncmFtIGRlZmluZWQgYnkgdGhlIGxvYWRlZCB0c2NvbmZpZy5qc29uLiBTZWUgYC0tdHNjb25maWdgLlxcbicgK1xuICAgICAgICAgICAgICAgICdUaGlzIG9wdGlvbiBpcyBvdmVycmlkZGVuIGJ5IHRoZSBgLS10YXJnZXRgIG9wdGlvbi4nLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9wdGlvbignZmlyc3Qtb25seScsIHtcbiAgICAgICAgICAgIGRlc2NyaWJlOlxuICAgICAgICAgICAgICAgICdJZiBzcGVjaWZpZWQgdGhlbiBvbmx5IHRoZSBmaXJzdCBtYXRjaGluZyBwYWNrYWdlLmpzb24gcHJvcGVydHkgd2lsbCBiZSBjb21waWxlZC5cXG4nICtcbiAgICAgICAgICAgICAgICAnVGhpcyBvcHRpb24gaXMgb3ZlcnJpZGRlbiBieSBgLS10eXBpbmdzLW9ubHlgLicsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAub3B0aW9uKCd0eXBpbmdzLW9ubHknLCB7XG4gICAgICAgICAgICBkZXNjcmliZTpcbiAgICAgICAgICAgICAgICAnSWYgc3BlY2lmaWVkIHRoZW4gb25seSB0aGUgdHlwaW5ncyBmaWxlcyBhcmUgcHJvY2Vzc2VkLCBhbmQgbm8gSlMgc291cmNlIGZpbGVzIHdpbGwgYmUgbW9kaWZpZWQuXFxuJyArXG4gICAgICAgICAgICAgICAgJ1NldHRpbmcgdGhpcyBvcHRpb24gd2lsbCBmb3JjZSBgLS1maXJzdC1vbmx5YCB0byBiZSBzZXQsIHNpbmNlIG9ubHkgb25lIGZvcm1hdCBpcyBuZWVkZWQgdG8gcHJvY2VzcyB0aGUgdHlwaW5ncycsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAub3B0aW9uKCdjcmVhdGUtaXZ5LWVudHJ5LXBvaW50cycsIHtcbiAgICAgICAgICAgIGRlc2NyaWJlOlxuICAgICAgICAgICAgICAgICdJZiBzcGVjaWZpZWQgdGhlbiBuZXcgYCpfaXZ5X25nY2NgIGVudHJ5LXBvaW50cyB3aWxsIGJlIGFkZGVkIHRvIHBhY2thZ2UuanNvbiByYXRoZXIgdGhhbiBtb2RpZnlpbmcgdGhlIG9uZXMgaW4tcGxhY2UuXFxuJyArXG4gICAgICAgICAgICAgICAgJ0ZvciB0aGlzIHRvIHdvcmsgeW91IG5lZWQgdG8gaGF2ZSBjdXN0b20gcmVzb2x1dGlvbiBzZXQgdXAgKGUuZy4gaW4gd2VicGFjaykgdG8gbG9vayBmb3IgdGhlc2UgbmV3IGVudHJ5LXBvaW50cy5cXG4nICtcbiAgICAgICAgICAgICAgICAnVGhlIEFuZ3VsYXIgQ0xJIGRvZXMgdGhpcyBhbHJlYWR5LCBzbyBpdCBpcyBzYWZlIHRvIHVzZSB0aGlzIG9wdGlvbiBpZiB0aGUgcHJvamVjdCBpcyBiZWluZyBidWlsdCB2aWEgdGhlIENMSS4nLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9wdGlvbignbGVnYWN5LW1lc3NhZ2UtaWRzJywge1xuICAgICAgICAgICAgZGVzY3JpYmU6ICdSZW5kZXIgYCRsb2NhbGl6ZWAgbWVzc2FnZXMgd2l0aCBsZWdhY3kgZm9ybWF0IGlkcy5cXG4nICtcbiAgICAgICAgICAgICAgICAnVGhlIGRlZmF1bHQgdmFsdWUgaXMgYHRydWVgLiBPbmx5IHNldCB0aGlzIHRvIGBmYWxzZWAgaWYgeW91IGRvIG5vdCB3YW50IGxlZ2FjeSBtZXNzYWdlIGlkcyB0b1xcbicgK1xuICAgICAgICAgICAgICAgICdiZSByZW5kZXJlZC4gRm9yIGV4YW1wbGUsIGlmIHlvdSBhcmUgbm90IHVzaW5nIGxlZ2FjeSBtZXNzYWdlIGlkcyBpbiB5b3VyIHRyYW5zbGF0aW9uIGZpbGVzXFxuJyArXG4gICAgICAgICAgICAgICAgJ0FORCBhcmUgbm90IGRvaW5nIGNvbXBpbGUtdGltZSBpbmxpbmluZyBvZiB0cmFuc2xhdGlvbnMsIGluIHdoaWNoIGNhc2UgdGhlIGV4dHJhIG1lc3NhZ2UgaWRzXFxuJyArXG4gICAgICAgICAgICAgICAgJ3dvdWxkIGFkZCB1bndhbnRlZCBzaXplIHRvIHRoZSBmaW5hbCBzb3VyY2UgYnVuZGxlLlxcbicgK1xuICAgICAgICAgICAgICAgICdJdCBpcyBzYWZlIHRvIGxlYXZlIHRoaXMgc2V0IHRvIHRydWUgaWYgeW91IGFyZSBkb2luZyBjb21waWxlLXRpbWUgaW5saW5pbmcgYmVjYXVzZSB0aGUgZXh0cmFcXG4nICtcbiAgICAgICAgICAgICAgICAnbGVnYWN5IG1lc3NhZ2UgaWRzIHdpbGwgYWxsIGJlIHN0cmlwcGVkIGR1cmluZyB0cmFuc2xhdGlvbi4nLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5vcHRpb24oJ2FzeW5jJywge1xuICAgICAgICAgICAgZGVzY3JpYmU6XG4gICAgICAgICAgICAgICAgJ1doZXRoZXIgdG8gY29tcGlsZSBhc3luY2hyb25vdXNseS4gVGhpcyBpcyBlbmFibGVkIGJ5IGRlZmF1bHQgYXMgaXQgYWxsb3dzIGNvbXBpbGF0aW9ucyB0byBiZSBwYXJhbGxlbGl6ZWQuXFxuJyArXG4gICAgICAgICAgICAgICAgJ0Rpc2FibGluZyBhc3luY2hyb25vdXMgY29tcGlsYXRpb24gbWF5IGJlIHVzZWZ1bCBmb3IgZGVidWdnaW5nLicsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9wdGlvbignbCcsIHtcbiAgICAgICAgICAgIGFsaWFzOiAnbG9nbGV2ZWwnLFxuICAgICAgICAgICAgZGVzY3JpYmU6ICdUaGUgbG93ZXN0IHNldmVyaXR5IGxvZ2dpbmcgbWVzc2FnZSB0aGF0IHNob3VsZCBiZSBvdXRwdXQuJyxcbiAgICAgICAgICAgIGNob2ljZXM6IFsnZGVidWcnLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ10sXG4gICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5vcHRpb24oJ2ludmFsaWRhdGUtZW50cnktcG9pbnQtbWFuaWZlc3QnLCB7XG4gICAgICAgICAgICBkZXNjcmliZTpcbiAgICAgICAgICAgICAgICAnSWYgdGhpcyBpcyBzZXQgdGhlbiBuZ2NjIHdpbGwgbm90IHJlYWQgYW4gZW50cnktcG9pbnQgbWFuaWZlc3QgZmlsZSBmcm9tIGRpc2suXFxuJyArXG4gICAgICAgICAgICAgICAgJ0luc3RlYWQgaXQgd2lsbCB3YWxrIHRoZSBkaXJlY3RvcnkgdHJlZSBhcyBub3JtYWwgbG9va2luZyBmb3IgZW50cnktcG9pbnRzLCBhbmQgdGhlbiB3cml0ZSBhIG5ldyBtYW5pZmVzdCBmaWxlLicsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5vcHRpb24oJ2Vycm9yLW9uLWZhaWxlZC1lbnRyeS1wb2ludCcsIHtcbiAgICAgICAgICAgIGRlc2NyaWJlOlxuICAgICAgICAgICAgICAgICdTZXQgdGhpcyBvcHRpb24gaW4gb3JkZXIgdG8gdGVybWluYXRlIGltbWVkaWF0ZWx5IHdpdGggYW4gZXJyb3IgY29kZSBpZiBhbiBlbnRyeS1wb2ludCBmYWlscyB0byBiZSBwcm9jZXNzZWQuXFxuJyArXG4gICAgICAgICAgICAgICAgJ0lmIGAtdGAvYC0tdGFyZ2V0YCBpcyBwcm92aWRlZCB0aGVuIHRoaXMgcHJvcGVydHkgaXMgYWx3YXlzIHRydWUgYW5kIGNhbm5vdCBiZSBjaGFuZ2VkLiBPdGhlcndpc2UgdGhlIGRlZmF1bHQgaXMgZmFsc2UuXFxuJyArXG4gICAgICAgICAgICAgICAgJ1doZW4gc2V0IHRvIGZhbHNlLCBuZ2NjIHdpbGwgY29udGludWUgdG8gcHJvY2VzcyBlbnRyeS1wb2ludHMgYWZ0ZXIgYSBmYWlsdXJlLiBJbiB3aGljaCBjYXNlIGl0IHdpbGwgbG9nIGFuIGVycm9yIGFuZCByZXN1bWUgcHJvY2Vzc2luZyBvdGhlciBlbnRyeS1wb2ludHMuJyxcbiAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9wdGlvbigndHNjb25maWcnLCB7XG4gICAgICAgICAgICBkZXNjcmliZTpcbiAgICAgICAgICAgICAgICAnQSBwYXRoIHRvIGEgdHNjb25maWcuanNvbiBmaWxlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGNvbmZpZ3VyZSB0aGUgQW5ndWxhciBjb21waWxlciBhbmQgbW9kdWxlIHJlc29sdXRpb24gdXNlZCBieSBuZ2NjLlxcbicgK1xuICAgICAgICAgICAgICAgICdJZiBub3QgcHJvdmlkZWQsIG5nY2Mgd2lsbCBhdHRlbXB0IHRvIHJlYWQgYSBgdHNjb25maWcuanNvbmAgZmlsZSBmcm9tIHRoZSBmb2xkZXIgYWJvdmUgdGhhdCBnaXZlbiBieSB0aGUgYC1zYCBvcHRpb24uXFxuJyArXG4gICAgICAgICAgICAgICAgJ1NldCB0byBmYWxzZSAodmlhIGAtLW5vLXRzY29uZmlnYCkgaWYgeW91IGRvIG5vdCB3YW50IG5nY2MgdG8gdXNlIGFueSBgdHNjb25maWcuanNvbmAgZmlsZS4nLFxuICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc3RyaWN0KClcbiAgICAgICAgICAuaGVscCgpXG4gICAgICAgICAgLnBhcnNlKGFyZ3MpO1xuXG4gIGlmIChvcHRpb25zLmY/Lmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICdUaGUgZm9ybWF0cyBvcHRpb24gKC1mLy0tZm9ybWF0cykgaGFzIGJlZW4gcmVtb3ZlZC4gQ29uc2lkZXIgdGhlIHByb3BlcnRpZXMgb3B0aW9uICgtcC8tLXByb3BlcnRpZXMpIGluc3RlYWQuJyk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG5cbiAgY29uc3QgZnMgPSBuZXcgTm9kZUpTRmlsZVN5c3RlbSgpO1xuICBzZXRGaWxlU3lzdGVtKGZzKTtcblxuICBjb25zdCBiYXNlU291cmNlUGF0aCA9IGZzLnJlc29sdmUob3B0aW9ucy5zIHx8ICcuL25vZGVfbW9kdWxlcycpO1xuICBjb25zdCBwcm9wZXJ0aWVzVG9Db25zaWRlciA9IG9wdGlvbnMucDtcbiAgY29uc3QgdGFyZ2V0RW50cnlQb2ludFBhdGggPSBvcHRpb25zLnQ7XG4gIGNvbnN0IGNvbXBpbGVBbGxGb3JtYXRzID0gIW9wdGlvbnNbJ2ZpcnN0LW9ubHknXTtcbiAgY29uc3QgdHlwaW5nc09ubHkgPSBvcHRpb25zWyd0eXBpbmdzLW9ubHknXTtcbiAgY29uc3QgY3JlYXRlTmV3RW50cnlQb2ludEZvcm1hdHMgPSBvcHRpb25zWydjcmVhdGUtaXZ5LWVudHJ5LXBvaW50cyddO1xuICBjb25zdCBsb2dMZXZlbCA9IG9wdGlvbnMubCBhcyBrZXlvZiB0eXBlb2YgTG9nTGV2ZWwgfCB1bmRlZmluZWQ7XG4gIGNvbnN0IGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPSBvcHRpb25zWydsZWdhY3ktbWVzc2FnZS1pZHMnXTtcbiAgY29uc3QgaW52YWxpZGF0ZUVudHJ5UG9pbnRNYW5pZmVzdCA9IG9wdGlvbnNbJ2ludmFsaWRhdGUtZW50cnktcG9pbnQtbWFuaWZlc3QnXTtcbiAgY29uc3QgZXJyb3JPbkZhaWxlZEVudHJ5UG9pbnQgPSBvcHRpb25zWydlcnJvci1vbi1mYWlsZWQtZW50cnktcG9pbnQnXTtcbiAgY29uc3QgZmluZEVudHJ5UG9pbnRzRnJvbVRzQ29uZmlnUHJvZ3JhbSA9IG9wdGlvbnNbJ3VzZS1wcm9ncmFtLWRlcGVuZGVuY2llcyddO1xuICAvLyB5YXJncyBpcyBub3Qgc28gZ3JlYXQgYXQgbWl4ZWQgc3RyaW5nK2Jvb2xlYW4gdHlwZXMsIHNvIHdlIGhhdmUgdG8gdGVzdCB0c2NvbmZpZyBhZ2FpbnN0IGFcbiAgLy8gc3RyaW5nIFwiZmFsc2VcIiB0byBjYXB0dXJlIHRoZSBgdHNjb25maWc9ZmFsc2VgIG9wdGlvbi5cbiAgLy8gQW5kIHdlIGhhdmUgdG8gY29udmVydCB0aGUgb3B0aW9uIHRvIGEgc3RyaW5nIHRvIGhhbmRsZSBgbm8tdHNjb25maWdgLCB3aGljaCB3aWxsIGJlIGBmYWxzZWAuXG4gIGNvbnN0IHRzQ29uZmlnUGF0aCA9IGAke29wdGlvbnMudHNjb25maWd9YCA9PT0gJ2ZhbHNlJyA/IG51bGwgOiBvcHRpb25zLnRzY29uZmlnO1xuXG4gIGNvbnN0IGxvZ2dlciA9IGxvZ0xldmVsICYmIG5ldyBDb25zb2xlTG9nZ2VyKExvZ0xldmVsW2xvZ0xldmVsXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBiYXNlUGF0aDogYmFzZVNvdXJjZVBhdGgsXG4gICAgcHJvcGVydGllc1RvQ29uc2lkZXIsXG4gICAgdGFyZ2V0RW50cnlQb2ludFBhdGgsXG4gICAgdHlwaW5nc09ubHksXG4gICAgY29tcGlsZUFsbEZvcm1hdHMsXG4gICAgY3JlYXRlTmV3RW50cnlQb2ludEZvcm1hdHMsXG4gICAgbG9nZ2VyLFxuICAgIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQsXG4gICAgYXN5bmM6IG9wdGlvbnMuYXN5bmMsXG4gICAgaW52YWxpZGF0ZUVudHJ5UG9pbnRNYW5pZmVzdCxcbiAgICBlcnJvck9uRmFpbGVkRW50cnlQb2ludCxcbiAgICB0c0NvbmZpZ1BhdGgsXG4gICAgZmluZEVudHJ5UG9pbnRzRnJvbVRzQ29uZmlnUHJvZ3JhbSxcbiAgfTtcbn1cbiJdfQ==