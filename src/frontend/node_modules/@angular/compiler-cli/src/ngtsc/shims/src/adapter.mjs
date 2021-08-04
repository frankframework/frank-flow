/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { absoluteFrom, absoluteFromSourceFile } from '../../file_system';
import { isDtsPath } from '../../util/src/typescript';
import { isFileShimSourceFile, isShim, sfExtensionData } from './expando';
import { makeShimFileName } from './util';
/**
 * Generates and tracks shim files for each original `ts.SourceFile`.
 *
 * The `ShimAdapter` provides an API that's designed to be used by a `ts.CompilerHost`
 * implementation and allows it to include synthetic "shim" files in the program that's being
 * created. It works for both freshly created programs as well as with reuse of an older program
 * (which already may contain shim files and thus have a different creation flow).
 */
export class ShimAdapter {
    constructor(delegate, tsRootFiles, topLevelGenerators, perFileGenerators, oldProgram) {
        this.delegate = delegate;
        /**
         * A map of shim file names to the `ts.SourceFile` generated for those shims.
         */
        this.shims = new Map();
        /**
         * A map of shim file names to existing shims which were part of a previous iteration of this
         * program.
         *
         * Not all of these shims will be inherited into this program.
         */
        this.priorShims = new Map();
        /**
         * File names which are already known to not be shims.
         *
         * This allows for short-circuit returns without the expense of running regular expressions
         * against the filename repeatedly.
         */
        this.notShims = new Set();
        /**
         * The shim generators supported by this adapter as well as extra precalculated data facilitating
         * their use.
         */
        this.generators = [];
        /**
         * A `Set` of shim `ts.SourceFile`s which should not be emitted.
         */
        this.ignoreForEmit = new Set();
        /**
         * Extension prefixes of all installed per-file shims.
         */
        this.extensionPrefixes = [];
        // Initialize `this.generators` with a regex that matches each generator's paths.
        for (const gen of perFileGenerators) {
            // This regex matches paths for shims from this generator. The first (and only) capture group
            // extracts the filename prefix, which can be used to find the original file that was used to
            // generate this shim.
            const pattern = `^(.*)\\.${gen.extensionPrefix}\\.ts$`;
            const regexp = new RegExp(pattern, 'i');
            this.generators.push({
                generator: gen,
                test: regexp,
                suffix: `.${gen.extensionPrefix}.ts`,
            });
            this.extensionPrefixes.push(gen.extensionPrefix);
        }
        // Process top-level generators and pre-generate their shims. Accumulate the list of filenames
        // as extra input files.
        const extraInputFiles = [];
        for (const gen of topLevelGenerators) {
            const sf = gen.makeTopLevelShim();
            sfExtensionData(sf).isTopLevelShim = true;
            if (!gen.shouldEmit) {
                this.ignoreForEmit.add(sf);
            }
            const fileName = absoluteFromSourceFile(sf);
            this.shims.set(fileName, sf);
            extraInputFiles.push(fileName);
        }
        // Add to that list the per-file shims associated with each root file. This is needed because
        // reference tagging alone may not work in TS compilations that have `noResolve` set. Such
        // compilations rely on the list of input files completely describing the program.
        for (const rootFile of tsRootFiles) {
            for (const gen of this.generators) {
                extraInputFiles.push(makeShimFileName(rootFile, gen.suffix));
            }
        }
        this.extraInputFiles = extraInputFiles;
        // If an old program is present, extract all per-file shims into a map, which will be used to
        // generate new versions of those shims.
        if (oldProgram !== null) {
            for (const oldSf of oldProgram.getSourceFiles()) {
                if (oldSf.isDeclarationFile || !isFileShimSourceFile(oldSf)) {
                    continue;
                }
                this.priorShims.set(absoluteFromSourceFile(oldSf), oldSf);
            }
        }
    }
    /**
     * Produce a shim `ts.SourceFile` if `fileName` refers to a shim file which should exist in the
     * program.
     *
     * If `fileName` does not refer to a potential shim file, `null` is returned. If a corresponding
     * base file could not be determined, `undefined` is returned instead.
     */
    maybeGenerate(fileName) {
        // Fast path: either this filename has been proven not to be a shim before, or it is a known
        // shim and no generation is required.
        if (this.notShims.has(fileName)) {
            return null;
        }
        else if (this.shims.has(fileName)) {
            return this.shims.get(fileName);
        }
        // .d.ts files can't be shims.
        if (isDtsPath(fileName)) {
            this.notShims.add(fileName);
            return null;
        }
        // This is the first time seeing this path. Try to match it against a shim generator.
        for (const record of this.generators) {
            const match = record.test.exec(fileName);
            if (match === null) {
                continue;
            }
            // The path matched. Extract the filename prefix without the extension.
            const prefix = match[1];
            // This _might_ be a shim, if an underlying base file exists. The base file might be .ts or
            // .tsx.
            let baseFileName = absoluteFrom(prefix + '.ts');
            if (!this.delegate.fileExists(baseFileName)) {
                // No .ts file by that name - try .tsx.
                baseFileName = absoluteFrom(prefix + '.tsx');
                if (!this.delegate.fileExists(baseFileName)) {
                    // This isn't a shim after all since there is no original file which would have triggered
                    // its generation, even though the path is right. There are a few reasons why this could
                    // occur:
                    //
                    // * when resolving an import to an .ngfactory.d.ts file, the module resolution algorithm
                    //   will first look for an .ngfactory.ts file in its place, which will be requested here.
                    // * when the user writes a bad import.
                    // * when a file is present in one compilation and removed in the next incremental step.
                    //
                    // Note that this does not add the filename to `notShims`, so this path is not cached.
                    // That's okay as these cases above are edge cases and do not occur regularly in normal
                    // operations.
                    return undefined;
                }
            }
            // Retrieve the original file for which the shim will be generated.
            const inputFile = this.delegate.getSourceFile(baseFileName, ts.ScriptTarget.Latest);
            if (inputFile === undefined || isShim(inputFile)) {
                // Something strange happened here. This case is also not cached in `notShims`, but this
                // path is not expected to occur in reality so this shouldn't be a problem.
                return undefined;
            }
            // Actually generate and cache the shim.
            return this.generateSpecific(fileName, record.generator, inputFile);
        }
        // No generator matched.
        this.notShims.add(fileName);
        return null;
    }
    generateSpecific(fileName, generator, inputFile) {
        let priorShimSf = null;
        if (this.priorShims.has(fileName)) {
            // In the previous program a shim with this name already existed. It's passed to the shim
            // generator which may reuse it instead of generating a fresh shim.
            priorShimSf = this.priorShims.get(fileName);
            this.priorShims.delete(fileName);
        }
        const shimSf = generator.generateShimForFile(inputFile, fileName, priorShimSf);
        // Mark the new generated source file as a shim that originated from this generator.
        sfExtensionData(shimSf).fileShim = {
            extension: generator.extensionPrefix,
            generatedFrom: absoluteFromSourceFile(inputFile),
        };
        if (!generator.shouldEmit) {
            this.ignoreForEmit.add(shimSf);
        }
        this.shims.set(fileName, shimSf);
        return shimSf;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2Mvc2hpbXMvc3JjL2FkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLFlBQVksRUFBRSxzQkFBc0IsRUFBaUIsTUFBTSxtQkFBbUIsQ0FBQztBQUN2RixPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFHcEQsT0FBTyxFQUFDLG9CQUFvQixFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDeEUsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBUXhDOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLE9BQU8sV0FBVztJQThDdEIsWUFDWSxRQUE2RCxFQUNyRSxXQUE2QixFQUFFLGtCQUEyQyxFQUMxRSxpQkFBeUMsRUFBRSxVQUEyQjtRQUY5RCxhQUFRLEdBQVIsUUFBUSxDQUFxRDtRQTlDekU7O1dBRUc7UUFDSyxVQUFLLEdBQUcsSUFBSSxHQUFHLEVBQWlDLENBQUM7UUFFekQ7Ozs7O1dBS0c7UUFDSyxlQUFVLEdBQUcsSUFBSSxHQUFHLEVBQWlDLENBQUM7UUFFOUQ7Ozs7O1dBS0c7UUFDSyxhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFFN0M7OztXQUdHO1FBQ0ssZUFBVSxHQUF3QixFQUFFLENBQUM7UUFFN0M7O1dBRUc7UUFDTSxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO1FBVWxEOztXQUVHO1FBQ00sc0JBQWlCLEdBQWEsRUFBRSxDQUFDO1FBTXhDLGlGQUFpRjtRQUNqRixLQUFLLE1BQU0sR0FBRyxJQUFJLGlCQUFpQixFQUFFO1lBQ25DLDZGQUE2RjtZQUM3Riw2RkFBNkY7WUFDN0Ysc0JBQXNCO1lBQ3RCLE1BQU0sT0FBTyxHQUFHLFdBQVcsR0FBRyxDQUFDLGVBQWUsUUFBUSxDQUFDO1lBQ3ZELE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztnQkFDbkIsU0FBUyxFQUFFLEdBQUc7Z0JBQ2QsSUFBSSxFQUFFLE1BQU07Z0JBQ1osTUFBTSxFQUFFLElBQUksR0FBRyxDQUFDLGVBQWUsS0FBSzthQUNyQyxDQUFDLENBQUM7WUFDSCxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztTQUNsRDtRQUNELDhGQUE4RjtRQUM5Rix3QkFBd0I7UUFDeEIsTUFBTSxlQUFlLEdBQXFCLEVBQUUsQ0FBQztRQUU3QyxLQUFLLE1BQU0sR0FBRyxJQUFJLGtCQUFrQixFQUFFO1lBQ3BDLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2xDLGVBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1lBRTFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFO2dCQUNuQixJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUM1QjtZQUVELE1BQU0sUUFBUSxHQUFHLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3QixlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2hDO1FBRUQsNkZBQTZGO1FBQzdGLDBGQUEwRjtRQUMxRixrRkFBa0Y7UUFDbEYsS0FBSyxNQUFNLFFBQVEsSUFBSSxXQUFXLEVBQUU7WUFDbEMsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO2dCQUNqQyxlQUFlLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzthQUM5RDtTQUNGO1FBRUQsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFFdkMsNkZBQTZGO1FBQzdGLHdDQUF3QztRQUN4QyxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDdkIsS0FBSyxNQUFNLEtBQUssSUFBSSxVQUFVLENBQUMsY0FBYyxFQUFFLEVBQUU7Z0JBQy9DLElBQUksS0FBSyxDQUFDLGlCQUFpQixJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQzNELFNBQVM7aUJBQ1Y7Z0JBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDM0Q7U0FDRjtJQUNILENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxhQUFhLENBQUMsUUFBd0I7UUFDcEMsNEZBQTRGO1FBQzVGLHNDQUFzQztRQUN0QyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQy9CLE9BQU8sSUFBSSxDQUFDO1NBQ2I7YUFBTSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ25DLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFFLENBQUM7U0FDbEM7UUFFRCw4QkFBOEI7UUFDOUIsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDNUIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELHFGQUFxRjtRQUNyRixLQUFLLE1BQU0sTUFBTSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDcEMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDekMsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO2dCQUNsQixTQUFTO2FBQ1Y7WUFFRCx1RUFBdUU7WUFDdkUsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLDJGQUEyRjtZQUMzRixRQUFRO1lBQ1IsSUFBSSxZQUFZLEdBQUcsWUFBWSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQzNDLHVDQUF1QztnQkFDdkMsWUFBWSxHQUFHLFlBQVksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUM7Z0JBQzdDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDM0MseUZBQXlGO29CQUN6Rix3RkFBd0Y7b0JBQ3hGLFNBQVM7b0JBQ1QsRUFBRTtvQkFDRix5RkFBeUY7b0JBQ3pGLDBGQUEwRjtvQkFDMUYsdUNBQXVDO29CQUN2Qyx3RkFBd0Y7b0JBQ3hGLEVBQUU7b0JBQ0Ysc0ZBQXNGO29CQUN0Rix1RkFBdUY7b0JBQ3ZGLGNBQWM7b0JBQ2QsT0FBTyxTQUFTLENBQUM7aUJBQ2xCO2FBQ0Y7WUFFRCxtRUFBbUU7WUFDbkUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDcEYsSUFBSSxTQUFTLEtBQUssU0FBUyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDaEQsd0ZBQXdGO2dCQUN4RiwyRUFBMkU7Z0JBQzNFLE9BQU8sU0FBUyxDQUFDO2FBQ2xCO1lBRUQsd0NBQXdDO1lBQ3hDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1NBQ3JFO1FBRUQsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVPLGdCQUFnQixDQUNwQixRQUF3QixFQUFFLFNBQStCLEVBQ3pELFNBQXdCO1FBQzFCLElBQUksV0FBVyxHQUF1QixJQUFJLENBQUM7UUFDM0MsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNqQyx5RkFBeUY7WUFDekYsbUVBQW1FO1lBRW5FLFdBQVcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNsQztRQUVELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRS9FLG9GQUFvRjtRQUNwRixlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxHQUFHO1lBQ2pDLFNBQVMsRUFBRSxTQUFTLENBQUMsZUFBZTtZQUNwQyxhQUFhLEVBQUUsc0JBQXNCLENBQUMsU0FBUyxDQUFDO1NBQ2pELENBQUM7UUFFRixJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRTtZQUN6QixJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUNoQztRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNqQyxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7YWJzb2x1dGVGcm9tLCBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlLCBBYnNvbHV0ZUZzUGF0aH0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtpc0R0c1BhdGh9IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtQZXJGaWxlU2hpbUdlbmVyYXRvciwgVG9wTGV2ZWxTaGltR2VuZXJhdG9yfSBmcm9tICcuLi9hcGknO1xuXG5pbXBvcnQge2lzRmlsZVNoaW1Tb3VyY2VGaWxlLCBpc1NoaW0sIHNmRXh0ZW5zaW9uRGF0YX0gZnJvbSAnLi9leHBhbmRvJztcbmltcG9ydCB7bWFrZVNoaW1GaWxlTmFtZX0gZnJvbSAnLi91dGlsJztcblxuaW50ZXJmYWNlIFNoaW1HZW5lcmF0b3JEYXRhIHtcbiAgZ2VuZXJhdG9yOiBQZXJGaWxlU2hpbUdlbmVyYXRvcjtcbiAgdGVzdDogUmVnRXhwO1xuICBzdWZmaXg6IHN0cmluZztcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYW5kIHRyYWNrcyBzaGltIGZpbGVzIGZvciBlYWNoIG9yaWdpbmFsIGB0cy5Tb3VyY2VGaWxlYC5cbiAqXG4gKiBUaGUgYFNoaW1BZGFwdGVyYCBwcm92aWRlcyBhbiBBUEkgdGhhdCdzIGRlc2lnbmVkIHRvIGJlIHVzZWQgYnkgYSBgdHMuQ29tcGlsZXJIb3N0YFxuICogaW1wbGVtZW50YXRpb24gYW5kIGFsbG93cyBpdCB0byBpbmNsdWRlIHN5bnRoZXRpYyBcInNoaW1cIiBmaWxlcyBpbiB0aGUgcHJvZ3JhbSB0aGF0J3MgYmVpbmdcbiAqIGNyZWF0ZWQuIEl0IHdvcmtzIGZvciBib3RoIGZyZXNobHkgY3JlYXRlZCBwcm9ncmFtcyBhcyB3ZWxsIGFzIHdpdGggcmV1c2Ugb2YgYW4gb2xkZXIgcHJvZ3JhbVxuICogKHdoaWNoIGFscmVhZHkgbWF5IGNvbnRhaW4gc2hpbSBmaWxlcyBhbmQgdGh1cyBoYXZlIGEgZGlmZmVyZW50IGNyZWF0aW9uIGZsb3cpLlxuICovXG5leHBvcnQgY2xhc3MgU2hpbUFkYXB0ZXIge1xuICAvKipcbiAgICogQSBtYXAgb2Ygc2hpbSBmaWxlIG5hbWVzIHRvIHRoZSBgdHMuU291cmNlRmlsZWAgZ2VuZXJhdGVkIGZvciB0aG9zZSBzaGltcy5cbiAgICovXG4gIHByaXZhdGUgc2hpbXMgPSBuZXcgTWFwPEFic29sdXRlRnNQYXRoLCB0cy5Tb3VyY2VGaWxlPigpO1xuXG4gIC8qKlxuICAgKiBBIG1hcCBvZiBzaGltIGZpbGUgbmFtZXMgdG8gZXhpc3Rpbmcgc2hpbXMgd2hpY2ggd2VyZSBwYXJ0IG9mIGEgcHJldmlvdXMgaXRlcmF0aW9uIG9mIHRoaXNcbiAgICogcHJvZ3JhbS5cbiAgICpcbiAgICogTm90IGFsbCBvZiB0aGVzZSBzaGltcyB3aWxsIGJlIGluaGVyaXRlZCBpbnRvIHRoaXMgcHJvZ3JhbS5cbiAgICovXG4gIHByaXZhdGUgcHJpb3JTaGltcyA9IG5ldyBNYXA8QWJzb2x1dGVGc1BhdGgsIHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLyoqXG4gICAqIEZpbGUgbmFtZXMgd2hpY2ggYXJlIGFscmVhZHkga25vd24gdG8gbm90IGJlIHNoaW1zLlxuICAgKlxuICAgKiBUaGlzIGFsbG93cyBmb3Igc2hvcnQtY2lyY3VpdCByZXR1cm5zIHdpdGhvdXQgdGhlIGV4cGVuc2Ugb2YgcnVubmluZyByZWd1bGFyIGV4cHJlc3Npb25zXG4gICAqIGFnYWluc3QgdGhlIGZpbGVuYW1lIHJlcGVhdGVkbHkuXG4gICAqL1xuICBwcml2YXRlIG5vdFNoaW1zID0gbmV3IFNldDxBYnNvbHV0ZUZzUGF0aD4oKTtcblxuICAvKipcbiAgICogVGhlIHNoaW0gZ2VuZXJhdG9ycyBzdXBwb3J0ZWQgYnkgdGhpcyBhZGFwdGVyIGFzIHdlbGwgYXMgZXh0cmEgcHJlY2FsY3VsYXRlZCBkYXRhIGZhY2lsaXRhdGluZ1xuICAgKiB0aGVpciB1c2UuXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRvcnM6IFNoaW1HZW5lcmF0b3JEYXRhW10gPSBbXTtcblxuICAvKipcbiAgICogQSBgU2V0YCBvZiBzaGltIGB0cy5Tb3VyY2VGaWxlYHMgd2hpY2ggc2hvdWxkIG5vdCBiZSBlbWl0dGVkLlxuICAgKi9cbiAgcmVhZG9ubHkgaWdub3JlRm9yRW1pdCA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvKipcbiAgICogQSBsaXN0IG9mIGV4dHJhIGZpbGVuYW1lcyB3aGljaCBzaG91bGQgYmUgY29uc2lkZXJlZCBpbnB1dHMgdG8gcHJvZ3JhbSBjcmVhdGlvbi5cbiAgICpcbiAgICogVGhpcyBpbmNsdWRlcyBhbnkgdG9wLWxldmVsIHNoaW1zIGdlbmVyYXRlZCBmb3IgdGhlIHByb2dyYW0sIGFzIHdlbGwgYXMgcGVyLWZpbGUgc2hpbSBuYW1lcyBmb3JcbiAgICogdGhvc2UgZmlsZXMgd2hpY2ggYXJlIGluY2x1ZGVkIGluIHRoZSByb290IGZpbGVzIG9mIHRoZSBwcm9ncmFtLlxuICAgKi9cbiAgcmVhZG9ubHkgZXh0cmFJbnB1dEZpbGVzOiBSZWFkb25seUFycmF5PEFic29sdXRlRnNQYXRoPjtcblxuICAvKipcbiAgICogRXh0ZW5zaW9uIHByZWZpeGVzIG9mIGFsbCBpbnN0YWxsZWQgcGVyLWZpbGUgc2hpbXMuXG4gICAqL1xuICByZWFkb25seSBleHRlbnNpb25QcmVmaXhlczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgZGVsZWdhdGU6IFBpY2s8dHMuQ29tcGlsZXJIb3N0LCAnZ2V0U291cmNlRmlsZSd8J2ZpbGVFeGlzdHMnPixcbiAgICAgIHRzUm9vdEZpbGVzOiBBYnNvbHV0ZUZzUGF0aFtdLCB0b3BMZXZlbEdlbmVyYXRvcnM6IFRvcExldmVsU2hpbUdlbmVyYXRvcltdLFxuICAgICAgcGVyRmlsZUdlbmVyYXRvcnM6IFBlckZpbGVTaGltR2VuZXJhdG9yW10sIG9sZFByb2dyYW06IHRzLlByb2dyYW18bnVsbCkge1xuICAgIC8vIEluaXRpYWxpemUgYHRoaXMuZ2VuZXJhdG9yc2Agd2l0aCBhIHJlZ2V4IHRoYXQgbWF0Y2hlcyBlYWNoIGdlbmVyYXRvcidzIHBhdGhzLlxuICAgIGZvciAoY29uc3QgZ2VuIG9mIHBlckZpbGVHZW5lcmF0b3JzKSB7XG4gICAgICAvLyBUaGlzIHJlZ2V4IG1hdGNoZXMgcGF0aHMgZm9yIHNoaW1zIGZyb20gdGhpcyBnZW5lcmF0b3IuIFRoZSBmaXJzdCAoYW5kIG9ubHkpIGNhcHR1cmUgZ3JvdXBcbiAgICAgIC8vIGV4dHJhY3RzIHRoZSBmaWxlbmFtZSBwcmVmaXgsIHdoaWNoIGNhbiBiZSB1c2VkIHRvIGZpbmQgdGhlIG9yaWdpbmFsIGZpbGUgdGhhdCB3YXMgdXNlZCB0b1xuICAgICAgLy8gZ2VuZXJhdGUgdGhpcyBzaGltLlxuICAgICAgY29uc3QgcGF0dGVybiA9IGBeKC4qKVxcXFwuJHtnZW4uZXh0ZW5zaW9uUHJlZml4fVxcXFwudHMkYDtcbiAgICAgIGNvbnN0IHJlZ2V4cCA9IG5ldyBSZWdFeHAocGF0dGVybiwgJ2knKTtcbiAgICAgIHRoaXMuZ2VuZXJhdG9ycy5wdXNoKHtcbiAgICAgICAgZ2VuZXJhdG9yOiBnZW4sXG4gICAgICAgIHRlc3Q6IHJlZ2V4cCxcbiAgICAgICAgc3VmZml4OiBgLiR7Z2VuLmV4dGVuc2lvblByZWZpeH0udHNgLFxuICAgICAgfSk7XG4gICAgICB0aGlzLmV4dGVuc2lvblByZWZpeGVzLnB1c2goZ2VuLmV4dGVuc2lvblByZWZpeCk7XG4gICAgfVxuICAgIC8vIFByb2Nlc3MgdG9wLWxldmVsIGdlbmVyYXRvcnMgYW5kIHByZS1nZW5lcmF0ZSB0aGVpciBzaGltcy4gQWNjdW11bGF0ZSB0aGUgbGlzdCBvZiBmaWxlbmFtZXNcbiAgICAvLyBhcyBleHRyYSBpbnB1dCBmaWxlcy5cbiAgICBjb25zdCBleHRyYUlucHV0RmlsZXM6IEFic29sdXRlRnNQYXRoW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgZ2VuIG9mIHRvcExldmVsR2VuZXJhdG9ycykge1xuICAgICAgY29uc3Qgc2YgPSBnZW4ubWFrZVRvcExldmVsU2hpbSgpO1xuICAgICAgc2ZFeHRlbnNpb25EYXRhKHNmKS5pc1RvcExldmVsU2hpbSA9IHRydWU7XG5cbiAgICAgIGlmICghZ2VuLnNob3VsZEVtaXQpIHtcbiAgICAgICAgdGhpcy5pZ25vcmVGb3JFbWl0LmFkZChzZik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVOYW1lID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG4gICAgICB0aGlzLnNoaW1zLnNldChmaWxlTmFtZSwgc2YpO1xuICAgICAgZXh0cmFJbnB1dEZpbGVzLnB1c2goZmlsZU5hbWUpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0byB0aGF0IGxpc3QgdGhlIHBlci1maWxlIHNoaW1zIGFzc29jaWF0ZWQgd2l0aCBlYWNoIHJvb3QgZmlsZS4gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZVxuICAgIC8vIHJlZmVyZW5jZSB0YWdnaW5nIGFsb25lIG1heSBub3Qgd29yayBpbiBUUyBjb21waWxhdGlvbnMgdGhhdCBoYXZlIGBub1Jlc29sdmVgIHNldC4gU3VjaFxuICAgIC8vIGNvbXBpbGF0aW9ucyByZWx5IG9uIHRoZSBsaXN0IG9mIGlucHV0IGZpbGVzIGNvbXBsZXRlbHkgZGVzY3JpYmluZyB0aGUgcHJvZ3JhbS5cbiAgICBmb3IgKGNvbnN0IHJvb3RGaWxlIG9mIHRzUm9vdEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGdlbiBvZiB0aGlzLmdlbmVyYXRvcnMpIHtcbiAgICAgICAgZXh0cmFJbnB1dEZpbGVzLnB1c2gobWFrZVNoaW1GaWxlTmFtZShyb290RmlsZSwgZ2VuLnN1ZmZpeCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZXh0cmFJbnB1dEZpbGVzID0gZXh0cmFJbnB1dEZpbGVzO1xuXG4gICAgLy8gSWYgYW4gb2xkIHByb2dyYW0gaXMgcHJlc2VudCwgZXh0cmFjdCBhbGwgcGVyLWZpbGUgc2hpbXMgaW50byBhIG1hcCwgd2hpY2ggd2lsbCBiZSB1c2VkIHRvXG4gICAgLy8gZ2VuZXJhdGUgbmV3IHZlcnNpb25zIG9mIHRob3NlIHNoaW1zLlxuICAgIGlmIChvbGRQcm9ncmFtICE9PSBudWxsKSB7XG4gICAgICBmb3IgKGNvbnN0IG9sZFNmIG9mIG9sZFByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgICBpZiAob2xkU2YuaXNEZWNsYXJhdGlvbkZpbGUgfHwgIWlzRmlsZVNoaW1Tb3VyY2VGaWxlKG9sZFNmKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcmlvclNoaW1zLnNldChhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKG9sZFNmKSwgb2xkU2YpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlIGEgc2hpbSBgdHMuU291cmNlRmlsZWAgaWYgYGZpbGVOYW1lYCByZWZlcnMgdG8gYSBzaGltIGZpbGUgd2hpY2ggc2hvdWxkIGV4aXN0IGluIHRoZVxuICAgKiBwcm9ncmFtLlxuICAgKlxuICAgKiBJZiBgZmlsZU5hbWVgIGRvZXMgbm90IHJlZmVyIHRvIGEgcG90ZW50aWFsIHNoaW0gZmlsZSwgYG51bGxgIGlzIHJldHVybmVkLiBJZiBhIGNvcnJlc3BvbmRpbmdcbiAgICogYmFzZSBmaWxlIGNvdWxkIG5vdCBiZSBkZXRlcm1pbmVkLCBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZCBpbnN0ZWFkLlxuICAgKi9cbiAgbWF5YmVHZW5lcmF0ZShmaWxlTmFtZTogQWJzb2x1dGVGc1BhdGgpOiB0cy5Tb3VyY2VGaWxlfG51bGx8dW5kZWZpbmVkIHtcbiAgICAvLyBGYXN0IHBhdGg6IGVpdGhlciB0aGlzIGZpbGVuYW1lIGhhcyBiZWVuIHByb3ZlbiBub3QgdG8gYmUgYSBzaGltIGJlZm9yZSwgb3IgaXQgaXMgYSBrbm93blxuICAgIC8vIHNoaW0gYW5kIG5vIGdlbmVyYXRpb24gaXMgcmVxdWlyZWQuXG4gICAgaWYgKHRoaXMubm90U2hpbXMuaGFzKGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNoaW1zLmhhcyhmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNoaW1zLmdldChmaWxlTmFtZSkhO1xuICAgIH1cblxuICAgIC8vIC5kLnRzIGZpbGVzIGNhbid0IGJlIHNoaW1zLlxuICAgIGlmIChpc0R0c1BhdGgoZmlsZU5hbWUpKSB7XG4gICAgICB0aGlzLm5vdFNoaW1zLmFkZChmaWxlTmFtZSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBmaXJzdCB0aW1lIHNlZWluZyB0aGlzIHBhdGguIFRyeSB0byBtYXRjaCBpdCBhZ2FpbnN0IGEgc2hpbSBnZW5lcmF0b3IuXG4gICAgZm9yIChjb25zdCByZWNvcmQgb2YgdGhpcy5nZW5lcmF0b3JzKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IHJlY29yZC50ZXN0LmV4ZWMoZmlsZU5hbWUpO1xuICAgICAgaWYgKG1hdGNoID09PSBudWxsKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgcGF0aCBtYXRjaGVkLiBFeHRyYWN0IHRoZSBmaWxlbmFtZSBwcmVmaXggd2l0aG91dCB0aGUgZXh0ZW5zaW9uLlxuICAgICAgY29uc3QgcHJlZml4ID0gbWF0Y2hbMV07XG4gICAgICAvLyBUaGlzIF9taWdodF8gYmUgYSBzaGltLCBpZiBhbiB1bmRlcmx5aW5nIGJhc2UgZmlsZSBleGlzdHMuIFRoZSBiYXNlIGZpbGUgbWlnaHQgYmUgLnRzIG9yXG4gICAgICAvLyAudHN4LlxuICAgICAgbGV0IGJhc2VGaWxlTmFtZSA9IGFic29sdXRlRnJvbShwcmVmaXggKyAnLnRzJyk7XG4gICAgICBpZiAoIXRoaXMuZGVsZWdhdGUuZmlsZUV4aXN0cyhiYXNlRmlsZU5hbWUpKSB7XG4gICAgICAgIC8vIE5vIC50cyBmaWxlIGJ5IHRoYXQgbmFtZSAtIHRyeSAudHN4LlxuICAgICAgICBiYXNlRmlsZU5hbWUgPSBhYnNvbHV0ZUZyb20ocHJlZml4ICsgJy50c3gnKTtcbiAgICAgICAgaWYgKCF0aGlzLmRlbGVnYXRlLmZpbGVFeGlzdHMoYmFzZUZpbGVOYW1lKSkge1xuICAgICAgICAgIC8vIFRoaXMgaXNuJ3QgYSBzaGltIGFmdGVyIGFsbCBzaW5jZSB0aGVyZSBpcyBubyBvcmlnaW5hbCBmaWxlIHdoaWNoIHdvdWxkIGhhdmUgdHJpZ2dlcmVkXG4gICAgICAgICAgLy8gaXRzIGdlbmVyYXRpb24sIGV2ZW4gdGhvdWdoIHRoZSBwYXRoIGlzIHJpZ2h0LiBUaGVyZSBhcmUgYSBmZXcgcmVhc29ucyB3aHkgdGhpcyBjb3VsZFxuICAgICAgICAgIC8vIG9jY3VyOlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gKiB3aGVuIHJlc29sdmluZyBhbiBpbXBvcnQgdG8gYW4gLm5nZmFjdG9yeS5kLnRzIGZpbGUsIHRoZSBtb2R1bGUgcmVzb2x1dGlvbiBhbGdvcml0aG1cbiAgICAgICAgICAvLyAgIHdpbGwgZmlyc3QgbG9vayBmb3IgYW4gLm5nZmFjdG9yeS50cyBmaWxlIGluIGl0cyBwbGFjZSwgd2hpY2ggd2lsbCBiZSByZXF1ZXN0ZWQgaGVyZS5cbiAgICAgICAgICAvLyAqIHdoZW4gdGhlIHVzZXIgd3JpdGVzIGEgYmFkIGltcG9ydC5cbiAgICAgICAgICAvLyAqIHdoZW4gYSBmaWxlIGlzIHByZXNlbnQgaW4gb25lIGNvbXBpbGF0aW9uIGFuZCByZW1vdmVkIGluIHRoZSBuZXh0IGluY3JlbWVudGFsIHN0ZXAuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBOb3RlIHRoYXQgdGhpcyBkb2VzIG5vdCBhZGQgdGhlIGZpbGVuYW1lIHRvIGBub3RTaGltc2AsIHNvIHRoaXMgcGF0aCBpcyBub3QgY2FjaGVkLlxuICAgICAgICAgIC8vIFRoYXQncyBva2F5IGFzIHRoZXNlIGNhc2VzIGFib3ZlIGFyZSBlZGdlIGNhc2VzIGFuZCBkbyBub3Qgb2NjdXIgcmVndWxhcmx5IGluIG5vcm1hbFxuICAgICAgICAgIC8vIG9wZXJhdGlvbnMuXG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBSZXRyaWV2ZSB0aGUgb3JpZ2luYWwgZmlsZSBmb3Igd2hpY2ggdGhlIHNoaW0gd2lsbCBiZSBnZW5lcmF0ZWQuXG4gICAgICBjb25zdCBpbnB1dEZpbGUgPSB0aGlzLmRlbGVnYXRlLmdldFNvdXJjZUZpbGUoYmFzZUZpbGVOYW1lLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChpbnB1dEZpbGUgPT09IHVuZGVmaW5lZCB8fCBpc1NoaW0oaW5wdXRGaWxlKSkge1xuICAgICAgICAvLyBTb21ldGhpbmcgc3RyYW5nZSBoYXBwZW5lZCBoZXJlLiBUaGlzIGNhc2UgaXMgYWxzbyBub3QgY2FjaGVkIGluIGBub3RTaGltc2AsIGJ1dCB0aGlzXG4gICAgICAgIC8vIHBhdGggaXMgbm90IGV4cGVjdGVkIHRvIG9jY3VyIGluIHJlYWxpdHkgc28gdGhpcyBzaG91bGRuJ3QgYmUgYSBwcm9ibGVtLlxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICAvLyBBY3R1YWxseSBnZW5lcmF0ZSBhbmQgY2FjaGUgdGhlIHNoaW0uXG4gICAgICByZXR1cm4gdGhpcy5nZW5lcmF0ZVNwZWNpZmljKGZpbGVOYW1lLCByZWNvcmQuZ2VuZXJhdG9yLCBpbnB1dEZpbGUpO1xuICAgIH1cblxuICAgIC8vIE5vIGdlbmVyYXRvciBtYXRjaGVkLlxuICAgIHRoaXMubm90U2hpbXMuYWRkKGZpbGVOYW1lKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgZ2VuZXJhdGVTcGVjaWZpYyhcbiAgICAgIGZpbGVOYW1lOiBBYnNvbHV0ZUZzUGF0aCwgZ2VuZXJhdG9yOiBQZXJGaWxlU2hpbUdlbmVyYXRvcixcbiAgICAgIGlucHV0RmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGUge1xuICAgIGxldCBwcmlvclNoaW1TZjogdHMuU291cmNlRmlsZXxudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5wcmlvclNoaW1zLmhhcyhmaWxlTmFtZSkpIHtcbiAgICAgIC8vIEluIHRoZSBwcmV2aW91cyBwcm9ncmFtIGEgc2hpbSB3aXRoIHRoaXMgbmFtZSBhbHJlYWR5IGV4aXN0ZWQuIEl0J3MgcGFzc2VkIHRvIHRoZSBzaGltXG4gICAgICAvLyBnZW5lcmF0b3Igd2hpY2ggbWF5IHJldXNlIGl0IGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIGZyZXNoIHNoaW0uXG5cbiAgICAgIHByaW9yU2hpbVNmID0gdGhpcy5wcmlvclNoaW1zLmdldChmaWxlTmFtZSkhO1xuICAgICAgdGhpcy5wcmlvclNoaW1zLmRlbGV0ZShmaWxlTmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2hpbVNmID0gZ2VuZXJhdG9yLmdlbmVyYXRlU2hpbUZvckZpbGUoaW5wdXRGaWxlLCBmaWxlTmFtZSwgcHJpb3JTaGltU2YpO1xuXG4gICAgLy8gTWFyayB0aGUgbmV3IGdlbmVyYXRlZCBzb3VyY2UgZmlsZSBhcyBhIHNoaW0gdGhhdCBvcmlnaW5hdGVkIGZyb20gdGhpcyBnZW5lcmF0b3IuXG4gICAgc2ZFeHRlbnNpb25EYXRhKHNoaW1TZikuZmlsZVNoaW0gPSB7XG4gICAgICBleHRlbnNpb246IGdlbmVyYXRvci5leHRlbnNpb25QcmVmaXgsXG4gICAgICBnZW5lcmF0ZWRGcm9tOiBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKGlucHV0RmlsZSksXG4gICAgfTtcblxuICAgIGlmICghZ2VuZXJhdG9yLnNob3VsZEVtaXQpIHtcbiAgICAgIHRoaXMuaWdub3JlRm9yRW1pdC5hZGQoc2hpbVNmKTtcbiAgICB9XG5cbiAgICB0aGlzLnNoaW1zLnNldChmaWxlTmFtZSwgc2hpbVNmKTtcbiAgICByZXR1cm4gc2hpbVNmO1xuICB9XG59XG4iXX0=