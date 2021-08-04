/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isSyntaxError } from '@angular/compiler';
import * as ts from 'typescript';
import { absoluteFrom, getFileSystem, relative, resolve } from '../src/ngtsc/file_system';
import { replaceTsWithNgInErrors } from './ngtsc/diagnostics';
import * as api from './transformers/api';
import * as ng from './transformers/entry_points';
import { createMessageDiagnostic } from './transformers/util';
export function filterErrorsAndWarnings(diagnostics) {
    return diagnostics.filter(d => d.category !== ts.DiagnosticCategory.Message);
}
const defaultFormatHost = {
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => ts.sys.newLine
};
function displayFileName(fileName, host) {
    return relative(resolve(host.getCurrentDirectory()), resolve(host.getCanonicalFileName(fileName)));
}
export function formatDiagnosticPosition(position, host = defaultFormatHost) {
    return `${displayFileName(position.fileName, host)}(${position.line + 1},${position.column + 1})`;
}
export function flattenDiagnosticMessageChain(chain, host = defaultFormatHost, indent = 0) {
    const newLine = host.getNewLine();
    let result = '';
    if (indent) {
        result += newLine;
        for (let i = 0; i < indent; i++) {
            result += '  ';
        }
    }
    result += chain.messageText;
    const position = chain.position;
    // add position if available, and we are not at the depest frame
    if (position && indent !== 0) {
        result += ` at ${formatDiagnosticPosition(position, host)}`;
    }
    indent++;
    if (chain.next) {
        for (const kid of chain.next) {
            result += flattenDiagnosticMessageChain(kid, host, indent);
        }
    }
    return result;
}
export function formatDiagnostic(diagnostic, host = defaultFormatHost) {
    let result = '';
    const newLine = host.getNewLine();
    const span = diagnostic.span;
    if (span) {
        result += `${formatDiagnosticPosition({ fileName: span.start.file.url, line: span.start.line, column: span.start.col }, host)}: `;
    }
    else if (diagnostic.position) {
        result += `${formatDiagnosticPosition(diagnostic.position, host)}: `;
    }
    if (diagnostic.span && diagnostic.span.details) {
        result += `${diagnostic.span.details}, ${diagnostic.messageText}${newLine}`;
    }
    else if (diagnostic.chain) {
        result += `${flattenDiagnosticMessageChain(diagnostic.chain, host)}.${newLine}`;
    }
    else {
        result += `${diagnostic.messageText}${newLine}`;
    }
    return result;
}
export function formatDiagnostics(diags, host = defaultFormatHost) {
    if (diags && diags.length) {
        return diags
            .map(diagnostic => {
            if (api.isTsDiagnostic(diagnostic)) {
                return replaceTsWithNgInErrors(ts.formatDiagnosticsWithColorAndContext([diagnostic], host));
            }
            else {
                return formatDiagnostic(diagnostic, host);
            }
        })
            .join('');
    }
    else {
        return '';
    }
}
export function calcProjectFileAndBasePath(project, host = getFileSystem()) {
    const absProject = host.resolve(project);
    const projectIsDir = host.lstat(absProject).isDirectory();
    const projectFile = projectIsDir ? host.join(absProject, 'tsconfig.json') : absProject;
    const projectDir = projectIsDir ? absProject : host.dirname(absProject);
    const basePath = host.resolve(projectDir);
    return { projectFile, basePath };
}
export function readConfiguration(project, existingOptions, host = getFileSystem()) {
    var _a;
    try {
        const fs = getFileSystem();
        const readConfigFile = (configFile) => ts.readConfigFile(configFile, file => host.readFile(host.resolve(file)));
        const readAngularCompilerOptions = (configFile, parentOptions = {}) => {
            const { config, error } = readConfigFile(configFile);
            if (error) {
                // Errors are handled later on by 'parseJsonConfigFileContent'
                return parentOptions;
            }
            // we are only interested into merging 'angularCompilerOptions' as
            // other options like 'compilerOptions' are merged by TS
            const existingNgCompilerOptions = Object.assign(Object.assign({}, config.angularCompilerOptions), parentOptions);
            if (config.extends && typeof config.extends === 'string') {
                const extendedConfigPath = getExtendedConfigPath(configFile, config.extends, host, fs);
                if (extendedConfigPath !== null) {
                    // Call readAngularCompilerOptions recursively to merge NG Compiler options
                    return readAngularCompilerOptions(extendedConfigPath, existingNgCompilerOptions);
                }
            }
            return existingNgCompilerOptions;
        };
        const { projectFile, basePath } = calcProjectFileAndBasePath(project, host);
        const configFileName = host.resolve(host.pwd(), projectFile);
        const { config, error } = readConfigFile(projectFile);
        if (error) {
            return {
                project,
                errors: [error],
                rootNames: [],
                options: {},
                emitFlags: api.EmitFlags.Default
            };
        }
        const existingCompilerOptions = Object.assign(Object.assign({ genDir: basePath, basePath }, readAngularCompilerOptions(configFileName)), existingOptions);
        const parseConfigHost = createParseConfigHost(host, fs);
        const { options, errors, fileNames: rootNames, projectReferences } = ts.parseJsonConfigFileContent(config, parseConfigHost, basePath, existingCompilerOptions, configFileName);
        // Coerce to boolean as `enableIvy` can be `ngtsc|true|false|undefined` here.
        options.enableIvy = !!((_a = options.enableIvy) !== null && _a !== void 0 ? _a : true);
        let emitFlags = api.EmitFlags.Default;
        if (!(options.skipMetadataEmit || options.flatModuleOutFile)) {
            emitFlags |= api.EmitFlags.Metadata;
        }
        if (options.skipTemplateCodegen) {
            emitFlags = emitFlags & ~api.EmitFlags.Codegen;
        }
        return { project: projectFile, rootNames, projectReferences, options, errors, emitFlags };
    }
    catch (e) {
        const errors = [{
                category: ts.DiagnosticCategory.Error,
                messageText: e.stack,
                file: undefined,
                start: undefined,
                length: undefined,
                source: 'angular',
                code: api.UNKNOWN_ERROR_CODE,
            }];
        return { project: '', errors, rootNames: [], options: {}, emitFlags: api.EmitFlags.Default };
    }
}
function createParseConfigHost(host, fs = getFileSystem()) {
    return {
        fileExists: host.exists.bind(host),
        readDirectory: ts.sys.readDirectory,
        readFile: host.readFile.bind(host),
        useCaseSensitiveFileNames: fs.isCaseSensitive(),
    };
}
function getExtendedConfigPath(configFile, extendsValue, host, fs) {
    const result = getExtendedConfigPathWorker(configFile, extendsValue, host, fs);
    if (result !== null) {
        return result;
    }
    // Try to resolve the paths with a json extension append a json extension to the file in case if
    // it is missing and the resolution failed. This is to replicate TypeScript behaviour, see:
    // https://github.com/microsoft/TypeScript/blob/294a5a7d784a5a95a8048ee990400979a6bc3a1c/src/compiler/commandLineParser.ts#L2806
    return getExtendedConfigPathWorker(configFile, `${extendsValue}.json`, host, fs);
}
function getExtendedConfigPathWorker(configFile, extendsValue, host, fs) {
    if (extendsValue.startsWith('.') || fs.isRooted(extendsValue)) {
        const extendedConfigPath = host.resolve(host.dirname(configFile), extendsValue);
        if (host.exists(extendedConfigPath)) {
            return extendedConfigPath;
        }
    }
    else {
        const parseConfigHost = createParseConfigHost(host, fs);
        // Path isn't a rooted or relative path, resolve like a module.
        const { resolvedModule, } = ts.nodeModuleNameResolver(extendsValue, configFile, { moduleResolution: ts.ModuleResolutionKind.NodeJs, resolveJsonModule: true }, parseConfigHost);
        if (resolvedModule) {
            return absoluteFrom(resolvedModule.resolvedFileName);
        }
    }
    return null;
}
export function exitCodeFromResult(diags) {
    if (!diags || filterErrorsAndWarnings(diags).length === 0) {
        // If we have a result and didn't get any errors, we succeeded.
        return 0;
    }
    // Return 2 if any of the errors were unknown.
    return diags.some(d => d.source === 'angular' && d.code === api.UNKNOWN_ERROR_CODE) ? 2 : 1;
}
export function performCompilation({ rootNames, options, host, oldProgram, emitCallback, mergeEmitResultsCallback, gatherDiagnostics = defaultGatherDiagnostics, customTransformers, emitFlags = api.EmitFlags.Default, modifiedResourceFiles = null }) {
    let program;
    let emitResult;
    let allDiagnostics = [];
    try {
        if (!host) {
            host = ng.createCompilerHost({ options });
        }
        if (modifiedResourceFiles) {
            host.getModifiedResourceFiles = () => modifiedResourceFiles;
        }
        program = ng.createProgram({ rootNames, host, options, oldProgram });
        const beforeDiags = Date.now();
        allDiagnostics.push(...gatherDiagnostics(program));
        if (options.diagnostics) {
            const afterDiags = Date.now();
            allDiagnostics.push(createMessageDiagnostic(`Time for diagnostics: ${afterDiags - beforeDiags}ms.`));
        }
        if (!hasErrors(allDiagnostics)) {
            emitResult =
                program.emit({ emitCallback, mergeEmitResultsCallback, customTransformers, emitFlags });
            allDiagnostics.push(...emitResult.diagnostics);
            return { diagnostics: allDiagnostics, program, emitResult };
        }
        return { diagnostics: allDiagnostics, program };
    }
    catch (e) {
        let errMsg;
        let code;
        if (isSyntaxError(e)) {
            // don't report the stack for syntax errors as they are well known errors.
            errMsg = e.message;
            code = api.DEFAULT_ERROR_CODE;
        }
        else {
            errMsg = e.stack;
            // It is not a syntax error we might have a program with unknown state, discard it.
            program = undefined;
            code = api.UNKNOWN_ERROR_CODE;
        }
        allDiagnostics.push({ category: ts.DiagnosticCategory.Error, messageText: errMsg, code, source: api.SOURCE });
        return { diagnostics: allDiagnostics, program };
    }
}
export function defaultGatherDiagnostics(program) {
    const allDiagnostics = [];
    function checkDiagnostics(diags) {
        if (diags) {
            allDiagnostics.push(...diags);
            return !hasErrors(diags);
        }
        return true;
    }
    let checkOtherDiagnostics = true;
    // Check parameter diagnostics
    checkOtherDiagnostics = checkOtherDiagnostics &&
        checkDiagnostics([...program.getTsOptionDiagnostics(), ...program.getNgOptionDiagnostics()]);
    // Check syntactic diagnostics
    checkOtherDiagnostics =
        checkOtherDiagnostics && checkDiagnostics(program.getTsSyntacticDiagnostics());
    // Check TypeScript semantic and Angular structure diagnostics
    checkOtherDiagnostics =
        checkOtherDiagnostics &&
            checkDiagnostics([...program.getTsSemanticDiagnostics(), ...program.getNgStructuralDiagnostics()]);
    // Check Angular semantic diagnostics
    checkOtherDiagnostics =
        checkOtherDiagnostics && checkDiagnostics(program.getNgSemanticDiagnostics());
    return allDiagnostics;
}
function hasErrors(diags) {
    return diags.some(d => d.category === ts.DiagnosticCategory.Error);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVyZm9ybV9jb21waWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9wZXJmb3JtX2NvbXBpbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGFBQWEsRUFBVyxNQUFNLG1CQUFtQixDQUFDO0FBQzFELE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxZQUFZLEVBQThCLGFBQWEsRUFBc0IsUUFBUSxFQUFFLE9BQU8sRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBR3hJLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQzVELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxLQUFLLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUk1RCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsV0FBd0I7SUFDOUQsT0FBTyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsS0FBSyxFQUFFLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDL0UsQ0FBQztBQUVELE1BQU0saUJBQWlCLEdBQTZCO0lBQ2xELG1CQUFtQixFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEVBQUU7SUFDdkQsb0JBQW9CLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRO0lBQzFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLE9BQU87Q0FDakMsQ0FBQztBQUVGLFNBQVMsZUFBZSxDQUFDLFFBQWdCLEVBQUUsSUFBOEI7SUFDdkUsT0FBTyxRQUFRLENBQ1gs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RCxxQkFBcUI7UUFDakIscUJBQXFCO1lBQ3JCLGdCQUFnQixDQUNaLENBQUMsR0FBRyxPQUFPLENBQUMsd0JBQXdCLEVBQUUsRUFBRSxHQUFHLE9BQU8sQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUUxRixxQ0FBcUM7SUFDckMscUJBQXFCO1FBQ2pCLHFCQUFxQixJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsRUFBaUIsQ0FBQyxDQUFDO0lBRWpHLE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxLQUFrQjtJQUNuQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7aXNTeW50YXhFcnJvciwgUG9zaXRpb259IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbSwgQWJzb2x1dGVGc1BhdGgsIEZpbGVTeXN0ZW0sIGdldEZpbGVTeXN0ZW0sIFJlYWRvbmx5RmlsZVN5c3RlbSwgcmVsYXRpdmUsIHJlc29sdmV9IGZyb20gJy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge05nQ29tcGlsZXJPcHRpb25zfSBmcm9tICcuL25ndHNjL2NvcmUvYXBpJztcblxuaW1wb3J0IHtyZXBsYWNlVHNXaXRoTmdJbkVycm9yc30gZnJvbSAnLi9uZ3RzYy9kaWFnbm9zdGljcyc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnLi90cmFuc2Zvcm1lcnMvYXBpJztcbmltcG9ydCAqIGFzIG5nIGZyb20gJy4vdHJhbnNmb3JtZXJzL2VudHJ5X3BvaW50cyc7XG5pbXBvcnQge2NyZWF0ZU1lc3NhZ2VEaWFnbm9zdGljfSBmcm9tICcuL3RyYW5zZm9ybWVycy91dGlsJztcblxuZXhwb3J0IHR5cGUgRGlhZ25vc3RpY3MgPSBSZWFkb25seUFycmF5PHRzLkRpYWdub3N0aWN8YXBpLkRpYWdub3N0aWM+O1xuXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyRXJyb3JzQW5kV2FybmluZ3MoZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzKTogRGlhZ25vc3RpY3Mge1xuICByZXR1cm4gZGlhZ25vc3RpY3MuZmlsdGVyKGQgPT4gZC5jYXRlZ29yeSAhPT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5Lk1lc3NhZ2UpO1xufVxuXG5jb25zdCBkZWZhdWx0Rm9ybWF0SG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0ID0ge1xuICBnZXRDdXJyZW50RGlyZWN0b3J5OiAoKSA9PiB0cy5zeXMuZ2V0Q3VycmVudERpcmVjdG9yeSgpLFxuICBnZXRDYW5vbmljYWxGaWxlTmFtZTogZmlsZU5hbWUgPT4gZmlsZU5hbWUsXG4gIGdldE5ld0xpbmU6ICgpID0+IHRzLnN5cy5uZXdMaW5lXG59O1xuXG5mdW5jdGlvbiBkaXNwbGF5RmlsZU5hbWUoZmlsZU5hbWU6IHN0cmluZywgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0KTogc3RyaW5nIHtcbiAgcmV0dXJuIHJlbGF0aXZlKFxuICAgICAgcmVzb2x2ZShob3N0LmdldEN1cnJlbnREaXJlY3RvcnkoKSksIHJlc29sdmUoaG9zdC5nZXRDYW5vbmljYWxGaWxlTmFtZShmaWxlTmFtZSkpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdERpYWdub3N0aWNQb3NpdGlvbihcbiAgICBwb3NpdGlvbjogUG9zaXRpb24sIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCA9IGRlZmF1bHRGb3JtYXRIb3N0KTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke2Rpc3BsYXlGaWxlTmFtZShwb3NpdGlvbi5maWxlTmFtZSwgaG9zdCl9KCR7cG9zaXRpb24ubGluZSArIDF9LCR7cG9zaXRpb24uY29sdW1uICsgMX0pYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZUNoYWluKFxuICAgIGNoYWluOiBhcGkuRGlhZ25vc3RpY01lc3NhZ2VDaGFpbiwgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0ID0gZGVmYXVsdEZvcm1hdEhvc3QsXG4gICAgaW5kZW50ID0gMCk6IHN0cmluZyB7XG4gIGNvbnN0IG5ld0xpbmUgPSBob3N0LmdldE5ld0xpbmUoKTtcbiAgbGV0IHJlc3VsdCA9ICcnO1xuICBpZiAoaW5kZW50KSB7XG4gICAgcmVzdWx0ICs9IG5ld0xpbmU7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGluZGVudDsgaSsrKSB7XG4gICAgICByZXN1bHQgKz0gJyAgJztcbiAgICB9XG4gIH1cbiAgcmVzdWx0ICs9IGNoYWluLm1lc3NhZ2VUZXh0O1xuXG4gIGNvbnN0IHBvc2l0aW9uID0gY2hhaW4ucG9zaXRpb247XG4gIC8vIGFkZCBwb3NpdGlvbiBpZiBhdmFpbGFibGUsIGFuZCB3ZSBhcmUgbm90IGF0IHRoZSBkZXBlc3QgZnJhbWVcbiAgaWYgKHBvc2l0aW9uICYmIGluZGVudCAhPT0gMCkge1xuICAgIHJlc3VsdCArPSBgIGF0ICR7Zm9ybWF0RGlhZ25vc3RpY1Bvc2l0aW9uKHBvc2l0aW9uLCBob3N0KX1gO1xuICB9XG5cbiAgaW5kZW50Kys7XG4gIGlmIChjaGFpbi5uZXh0KSB7XG4gICAgZm9yIChjb25zdCBraWQgb2YgY2hhaW4ubmV4dCkge1xuICAgICAgcmVzdWx0ICs9IGZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZUNoYWluKGtpZCwgaG9zdCwgaW5kZW50KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdERpYWdub3N0aWMoXG4gICAgZGlhZ25vc3RpYzogYXBpLkRpYWdub3N0aWMsIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCA9IGRlZmF1bHRGb3JtYXRIb3N0KSB7XG4gIGxldCByZXN1bHQgPSAnJztcbiAgY29uc3QgbmV3TGluZSA9IGhvc3QuZ2V0TmV3TGluZSgpO1xuICBjb25zdCBzcGFuID0gZGlhZ25vc3RpYy5zcGFuO1xuICBpZiAoc3Bhbikge1xuICAgIHJlc3VsdCArPSBgJHtcbiAgICAgICAgZm9ybWF0RGlhZ25vc3RpY1Bvc2l0aW9uKFxuICAgICAgICAgICAge2ZpbGVOYW1lOiBzcGFuLnN0YXJ0LmZpbGUudXJsLCBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUsIGNvbHVtbjogc3Bhbi5zdGFydC5jb2x9LFxuICAgICAgICAgICAgaG9zdCl9OiBgO1xuICB9IGVsc2UgaWYgKGRpYWdub3N0aWMucG9zaXRpb24pIHtcbiAgICByZXN1bHQgKz0gYCR7Zm9ybWF0RGlhZ25vc3RpY1Bvc2l0aW9uKGRpYWdub3N0aWMucG9zaXRpb24sIGhvc3QpfTogYDtcbiAgfVxuICBpZiAoZGlhZ25vc3RpYy5zcGFuICYmIGRpYWdub3N0aWMuc3Bhbi5kZXRhaWxzKSB7XG4gICAgcmVzdWx0ICs9IGAke2RpYWdub3N0aWMuc3Bhbi5kZXRhaWxzfSwgJHtkaWFnbm9zdGljLm1lc3NhZ2VUZXh0fSR7bmV3TGluZX1gO1xuICB9IGVsc2UgaWYgKGRpYWdub3N0aWMuY2hhaW4pIHtcbiAgICByZXN1bHQgKz0gYCR7ZmxhdHRlbkRpYWdub3N0aWNNZXNzYWdlQ2hhaW4oZGlhZ25vc3RpYy5jaGFpbiwgaG9zdCl9LiR7bmV3TGluZX1gO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCArPSBgJHtkaWFnbm9zdGljLm1lc3NhZ2VUZXh0fSR7bmV3TGluZX1gO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXREaWFnbm9zdGljcyhcbiAgICBkaWFnczogRGlhZ25vc3RpY3MsIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCA9IGRlZmF1bHRGb3JtYXRIb3N0KTogc3RyaW5nIHtcbiAgaWYgKGRpYWdzICYmIGRpYWdzLmxlbmd0aCkge1xuICAgIHJldHVybiBkaWFnc1xuICAgICAgICAubWFwKGRpYWdub3N0aWMgPT4ge1xuICAgICAgICAgIGlmIChhcGkuaXNUc0RpYWdub3N0aWMoZGlhZ25vc3RpYykpIHtcbiAgICAgICAgICAgIHJldHVybiByZXBsYWNlVHNXaXRoTmdJbkVycm9ycyhcbiAgICAgICAgICAgICAgICB0cy5mb3JtYXREaWFnbm9zdGljc1dpdGhDb2xvckFuZENvbnRleHQoW2RpYWdub3N0aWNdLCBob3N0KSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmb3JtYXREaWFnbm9zdGljKGRpYWdub3N0aWMsIGhvc3QpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJycpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAnJztcbiAgfVxufVxuXG4vKiogVXNlZCB0byByZWFkIGNvbmZpZ3VyYXRpb24gZmlsZXMuICovXG5leHBvcnQgdHlwZSBDb25maWd1cmF0aW9uSG9zdCA9IFBpY2s8XG4gICAgUmVhZG9ubHlGaWxlU3lzdGVtLCAncmVhZEZpbGUnfCdleGlzdHMnfCdsc3RhdCd8J3Jlc29sdmUnfCdqb2luJ3wnZGlybmFtZSd8J2V4dG5hbWUnfCdwd2QnPjtcblxuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRDb25maWd1cmF0aW9uIHtcbiAgcHJvamVjdDogc3RyaW5nO1xuICBvcHRpb25zOiBhcGkuQ29tcGlsZXJPcHRpb25zO1xuICByb290TmFtZXM6IHN0cmluZ1tdO1xuICBwcm9qZWN0UmVmZXJlbmNlcz86IHJlYWRvbmx5IHRzLlByb2plY3RSZWZlcmVuY2VbXXx1bmRlZmluZWQ7XG4gIGVtaXRGbGFnczogYXBpLkVtaXRGbGFncztcbiAgZXJyb3JzOiB0cy5EaWFnbm9zdGljW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjUHJvamVjdEZpbGVBbmRCYXNlUGF0aChcbiAgICBwcm9qZWN0OiBzdHJpbmcsIGhvc3Q6IENvbmZpZ3VyYXRpb25Ib3N0ID0gZ2V0RmlsZVN5c3RlbSgpKTpcbiAgICB7cHJvamVjdEZpbGU6IEFic29sdXRlRnNQYXRoLCBiYXNlUGF0aDogQWJzb2x1dGVGc1BhdGh9IHtcbiAgY29uc3QgYWJzUHJvamVjdCA9IGhvc3QucmVzb2x2ZShwcm9qZWN0KTtcbiAgY29uc3QgcHJvamVjdElzRGlyID0gaG9zdC5sc3RhdChhYnNQcm9qZWN0KS5pc0RpcmVjdG9yeSgpO1xuICBjb25zdCBwcm9qZWN0RmlsZSA9IHByb2plY3RJc0RpciA/IGhvc3Quam9pbihhYnNQcm9qZWN0LCAndHNjb25maWcuanNvbicpIDogYWJzUHJvamVjdDtcbiAgY29uc3QgcHJvamVjdERpciA9IHByb2plY3RJc0RpciA/IGFic1Byb2plY3QgOiBob3N0LmRpcm5hbWUoYWJzUHJvamVjdCk7XG4gIGNvbnN0IGJhc2VQYXRoID0gaG9zdC5yZXNvbHZlKHByb2plY3REaXIpO1xuICByZXR1cm4ge3Byb2plY3RGaWxlLCBiYXNlUGF0aH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkQ29uZmlndXJhdGlvbihcbiAgICBwcm9qZWN0OiBzdHJpbmcsIGV4aXN0aW5nT3B0aW9ucz86IGFwaS5Db21waWxlck9wdGlvbnMsXG4gICAgaG9zdDogQ29uZmlndXJhdGlvbkhvc3QgPSBnZXRGaWxlU3lzdGVtKCkpOiBQYXJzZWRDb25maWd1cmF0aW9uIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBmcyA9IGdldEZpbGVTeXN0ZW0oKTtcblxuICAgIGNvbnN0IHJlYWRDb25maWdGaWxlID0gKGNvbmZpZ0ZpbGU6IHN0cmluZykgPT5cbiAgICAgICAgdHMucmVhZENvbmZpZ0ZpbGUoY29uZmlnRmlsZSwgZmlsZSA9PiBob3N0LnJlYWRGaWxlKGhvc3QucmVzb2x2ZShmaWxlKSkpO1xuICAgIGNvbnN0IHJlYWRBbmd1bGFyQ29tcGlsZXJPcHRpb25zID1cbiAgICAgICAgKGNvbmZpZ0ZpbGU6IHN0cmluZywgcGFyZW50T3B0aW9uczogTmdDb21waWxlck9wdGlvbnMgPSB7fSk6IE5nQ29tcGlsZXJPcHRpb25zID0+IHtcbiAgICAgICAgICBjb25zdCB7Y29uZmlnLCBlcnJvcn0gPSByZWFkQ29uZmlnRmlsZShjb25maWdGaWxlKTtcblxuICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSBoYW5kbGVkIGxhdGVyIG9uIGJ5ICdwYXJzZUpzb25Db25maWdGaWxlQ29udGVudCdcbiAgICAgICAgICAgIHJldHVybiBwYXJlbnRPcHRpb25zO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHdlIGFyZSBvbmx5IGludGVyZXN0ZWQgaW50byBtZXJnaW5nICdhbmd1bGFyQ29tcGlsZXJPcHRpb25zJyBhc1xuICAgICAgICAgIC8vIG90aGVyIG9wdGlvbnMgbGlrZSAnY29tcGlsZXJPcHRpb25zJyBhcmUgbWVyZ2VkIGJ5IFRTXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmdOZ0NvbXBpbGVyT3B0aW9ucyA9IHsuLi5jb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucywgLi4ucGFyZW50T3B0aW9uc307XG5cbiAgICAgICAgICBpZiAoY29uZmlnLmV4dGVuZHMgJiYgdHlwZW9mIGNvbmZpZy5leHRlbmRzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5kZWRDb25maWdQYXRoID0gZ2V0RXh0ZW5kZWRDb25maWdQYXRoKFxuICAgICAgICAgICAgICAgIGNvbmZpZ0ZpbGUsIGNvbmZpZy5leHRlbmRzLCBob3N0LCBmcyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChleHRlbmRlZENvbmZpZ1BhdGggIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgLy8gQ2FsbCByZWFkQW5ndWxhckNvbXBpbGVyT3B0aW9ucyByZWN1cnNpdmVseSB0byBtZXJnZSBORyBDb21waWxlciBvcHRpb25zXG4gICAgICAgICAgICAgIHJldHVybiByZWFkQW5ndWxhckNvbXBpbGVyT3B0aW9ucyhleHRlbmRlZENvbmZpZ1BhdGgsIGV4aXN0aW5nTmdDb21waWxlck9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBleGlzdGluZ05nQ29tcGlsZXJPcHRpb25zO1xuICAgICAgICB9O1xuXG4gICAgY29uc3Qge3Byb2plY3RGaWxlLCBiYXNlUGF0aH0gPSBjYWxjUHJvamVjdEZpbGVBbmRCYXNlUGF0aChwcm9qZWN0LCBob3N0KTtcbiAgICBjb25zdCBjb25maWdGaWxlTmFtZSA9IGhvc3QucmVzb2x2ZShob3N0LnB3ZCgpLCBwcm9qZWN0RmlsZSk7XG4gICAgY29uc3Qge2NvbmZpZywgZXJyb3J9ID0gcmVhZENvbmZpZ0ZpbGUocHJvamVjdEZpbGUpO1xuICAgIGlmIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJvamVjdCxcbiAgICAgICAgZXJyb3JzOiBbZXJyb3JdLFxuICAgICAgICByb290TmFtZXM6IFtdLFxuICAgICAgICBvcHRpb25zOiB7fSxcbiAgICAgICAgZW1pdEZsYWdzOiBhcGkuRW1pdEZsYWdzLkRlZmF1bHRcbiAgICAgIH07XG4gICAgfVxuICAgIGNvbnN0IGV4aXN0aW5nQ29tcGlsZXJPcHRpb25zOiBhcGkuQ29tcGlsZXJPcHRpb25zID0ge1xuICAgICAgZ2VuRGlyOiBiYXNlUGF0aCxcbiAgICAgIGJhc2VQYXRoLFxuICAgICAgLi4ucmVhZEFuZ3VsYXJDb21waWxlck9wdGlvbnMoY29uZmlnRmlsZU5hbWUpLFxuICAgICAgLi4uZXhpc3RpbmdPcHRpb25zLFxuICAgIH07XG5cbiAgICBjb25zdCBwYXJzZUNvbmZpZ0hvc3QgPSBjcmVhdGVQYXJzZUNvbmZpZ0hvc3QoaG9zdCwgZnMpO1xuICAgIGNvbnN0IHtvcHRpb25zLCBlcnJvcnMsIGZpbGVOYW1lczogcm9vdE5hbWVzLCBwcm9qZWN0UmVmZXJlbmNlc30gPVxuICAgICAgICB0cy5wYXJzZUpzb25Db25maWdGaWxlQ29udGVudChcbiAgICAgICAgICAgIGNvbmZpZywgcGFyc2VDb25maWdIb3N0LCBiYXNlUGF0aCwgZXhpc3RpbmdDb21waWxlck9wdGlvbnMsIGNvbmZpZ0ZpbGVOYW1lKTtcblxuICAgIC8vIENvZXJjZSB0byBib29sZWFuIGFzIGBlbmFibGVJdnlgIGNhbiBiZSBgbmd0c2N8dHJ1ZXxmYWxzZXx1bmRlZmluZWRgIGhlcmUuXG4gICAgb3B0aW9ucy5lbmFibGVJdnkgPSAhIShvcHRpb25zLmVuYWJsZUl2eSA/PyB0cnVlKTtcblxuICAgIGxldCBlbWl0RmxhZ3MgPSBhcGkuRW1pdEZsYWdzLkRlZmF1bHQ7XG4gICAgaWYgKCEob3B0aW9ucy5za2lwTWV0YWRhdGFFbWl0IHx8IG9wdGlvbnMuZmxhdE1vZHVsZU91dEZpbGUpKSB7XG4gICAgICBlbWl0RmxhZ3MgfD0gYXBpLkVtaXRGbGFncy5NZXRhZGF0YTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMuc2tpcFRlbXBsYXRlQ29kZWdlbikge1xuICAgICAgZW1pdEZsYWdzID0gZW1pdEZsYWdzICYgfmFwaS5FbWl0RmxhZ3MuQ29kZWdlbjtcbiAgICB9XG4gICAgcmV0dXJuIHtwcm9qZWN0OiBwcm9qZWN0RmlsZSwgcm9vdE5hbWVzLCBwcm9qZWN0UmVmZXJlbmNlcywgb3B0aW9ucywgZXJyb3JzLCBlbWl0RmxhZ3N9O1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc3QgZXJyb3JzOiB0cy5EaWFnbm9zdGljW10gPSBbe1xuICAgICAgY2F0ZWdvcnk6IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcixcbiAgICAgIG1lc3NhZ2VUZXh0OiBlLnN0YWNrLFxuICAgICAgZmlsZTogdW5kZWZpbmVkLFxuICAgICAgc3RhcnQ6IHVuZGVmaW5lZCxcbiAgICAgIGxlbmd0aDogdW5kZWZpbmVkLFxuICAgICAgc291cmNlOiAnYW5ndWxhcicsXG4gICAgICBjb2RlOiBhcGkuVU5LTk9XTl9FUlJPUl9DT0RFLFxuICAgIH1dO1xuICAgIHJldHVybiB7cHJvamVjdDogJycsIGVycm9ycywgcm9vdE5hbWVzOiBbXSwgb3B0aW9uczoge30sIGVtaXRGbGFnczogYXBpLkVtaXRGbGFncy5EZWZhdWx0fTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVQYXJzZUNvbmZpZ0hvc3QoaG9zdDogQ29uZmlndXJhdGlvbkhvc3QsIGZzID0gZ2V0RmlsZVN5c3RlbSgpKTogdHMuUGFyc2VDb25maWdIb3N0IHtcbiAgcmV0dXJuIHtcbiAgICBmaWxlRXhpc3RzOiBob3N0LmV4aXN0cy5iaW5kKGhvc3QpLFxuICAgIHJlYWREaXJlY3Rvcnk6IHRzLnN5cy5yZWFkRGlyZWN0b3J5LFxuICAgIHJlYWRGaWxlOiBob3N0LnJlYWRGaWxlLmJpbmQoaG9zdCksXG4gICAgdXNlQ2FzZVNlbnNpdGl2ZUZpbGVOYW1lczogZnMuaXNDYXNlU2Vuc2l0aXZlKCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldEV4dGVuZGVkQ29uZmlnUGF0aChcbiAgICBjb25maWdGaWxlOiBzdHJpbmcsIGV4dGVuZHNWYWx1ZTogc3RyaW5nLCBob3N0OiBDb25maWd1cmF0aW9uSG9zdCxcbiAgICBmczogRmlsZVN5c3RlbSk6IEFic29sdXRlRnNQYXRofG51bGwge1xuICBjb25zdCByZXN1bHQgPSBnZXRFeHRlbmRlZENvbmZpZ1BhdGhXb3JrZXIoY29uZmlnRmlsZSwgZXh0ZW5kc1ZhbHVlLCBob3N0LCBmcyk7XG4gIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gVHJ5IHRvIHJlc29sdmUgdGhlIHBhdGhzIHdpdGggYSBqc29uIGV4dGVuc2lvbiBhcHBlbmQgYSBqc29uIGV4dGVuc2lvbiB0byB0aGUgZmlsZSBpbiBjYXNlIGlmXG4gIC8vIGl0IGlzIG1pc3NpbmcgYW5kIHRoZSByZXNvbHV0aW9uIGZhaWxlZC4gVGhpcyBpcyB0byByZXBsaWNhdGUgVHlwZVNjcmlwdCBiZWhhdmlvdXIsIHNlZTpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2Jsb2IvMjk0YTVhN2Q3ODRhNWE5NWE4MDQ4ZWU5OTA0MDA5NzlhNmJjM2ExYy9zcmMvY29tcGlsZXIvY29tbWFuZExpbmVQYXJzZXIudHMjTDI4MDZcbiAgcmV0dXJuIGdldEV4dGVuZGVkQ29uZmlnUGF0aFdvcmtlcihjb25maWdGaWxlLCBgJHtleHRlbmRzVmFsdWV9Lmpzb25gLCBob3N0LCBmcyk7XG59XG5cbmZ1bmN0aW9uIGdldEV4dGVuZGVkQ29uZmlnUGF0aFdvcmtlcihcbiAgICBjb25maWdGaWxlOiBzdHJpbmcsIGV4dGVuZHNWYWx1ZTogc3RyaW5nLCBob3N0OiBDb25maWd1cmF0aW9uSG9zdCxcbiAgICBmczogRmlsZVN5c3RlbSk6IEFic29sdXRlRnNQYXRofG51bGwge1xuICBpZiAoZXh0ZW5kc1ZhbHVlLnN0YXJ0c1dpdGgoJy4nKSB8fCBmcy5pc1Jvb3RlZChleHRlbmRzVmFsdWUpKSB7XG4gICAgY29uc3QgZXh0ZW5kZWRDb25maWdQYXRoID0gaG9zdC5yZXNvbHZlKGhvc3QuZGlybmFtZShjb25maWdGaWxlKSwgZXh0ZW5kc1ZhbHVlKTtcbiAgICBpZiAoaG9zdC5leGlzdHMoZXh0ZW5kZWRDb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuIGV4dGVuZGVkQ29uZmlnUGF0aDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgcGFyc2VDb25maWdIb3N0ID0gY3JlYXRlUGFyc2VDb25maWdIb3N0KGhvc3QsIGZzKTtcblxuICAgIC8vIFBhdGggaXNuJ3QgYSByb290ZWQgb3IgcmVsYXRpdmUgcGF0aCwgcmVzb2x2ZSBsaWtlIGEgbW9kdWxlLlxuICAgIGNvbnN0IHtcbiAgICAgIHJlc29sdmVkTW9kdWxlLFxuICAgIH0gPVxuICAgICAgICB0cy5ub2RlTW9kdWxlTmFtZVJlc29sdmVyKFxuICAgICAgICAgICAgZXh0ZW5kc1ZhbHVlLCBjb25maWdGaWxlLFxuICAgICAgICAgICAge21vZHVsZVJlc29sdXRpb246IHRzLk1vZHVsZVJlc29sdXRpb25LaW5kLk5vZGVKcywgcmVzb2x2ZUpzb25Nb2R1bGU6IHRydWV9LFxuICAgICAgICAgICAgcGFyc2VDb25maWdIb3N0KTtcbiAgICBpZiAocmVzb2x2ZWRNb2R1bGUpIHtcbiAgICAgIHJldHVybiBhYnNvbHV0ZUZyb20ocmVzb2x2ZWRNb2R1bGUucmVzb2x2ZWRGaWxlTmFtZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVyZm9ybUNvbXBpbGF0aW9uUmVzdWx0IHtcbiAgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzO1xuICBwcm9ncmFtPzogYXBpLlByb2dyYW07XG4gIGVtaXRSZXN1bHQ/OiB0cy5FbWl0UmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhpdENvZGVGcm9tUmVzdWx0KGRpYWdzOiBEaWFnbm9zdGljc3x1bmRlZmluZWQpOiBudW1iZXIge1xuICBpZiAoIWRpYWdzIHx8IGZpbHRlckVycm9yc0FuZFdhcm5pbmdzKGRpYWdzKS5sZW5ndGggPT09IDApIHtcbiAgICAvLyBJZiB3ZSBoYXZlIGEgcmVzdWx0IGFuZCBkaWRuJ3QgZ2V0IGFueSBlcnJvcnMsIHdlIHN1Y2NlZWRlZC5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8vIFJldHVybiAyIGlmIGFueSBvZiB0aGUgZXJyb3JzIHdlcmUgdW5rbm93bi5cbiAgcmV0dXJuIGRpYWdzLnNvbWUoZCA9PiBkLnNvdXJjZSA9PT0gJ2FuZ3VsYXInICYmIGQuY29kZSA9PT0gYXBpLlVOS05PV05fRVJST1JfQ09ERSkgPyAyIDogMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBlcmZvcm1Db21waWxhdGlvbih7XG4gIHJvb3ROYW1lcyxcbiAgb3B0aW9ucyxcbiAgaG9zdCxcbiAgb2xkUHJvZ3JhbSxcbiAgZW1pdENhbGxiYWNrLFxuICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2ssXG4gIGdhdGhlckRpYWdub3N0aWNzID0gZGVmYXVsdEdhdGhlckRpYWdub3N0aWNzLFxuICBjdXN0b21UcmFuc2Zvcm1lcnMsXG4gIGVtaXRGbGFncyA9IGFwaS5FbWl0RmxhZ3MuRGVmYXVsdCxcbiAgbW9kaWZpZWRSZXNvdXJjZUZpbGVzID0gbnVsbFxufToge1xuICByb290TmFtZXM6IHN0cmluZ1tdLFxuICBvcHRpb25zOiBhcGkuQ29tcGlsZXJPcHRpb25zLFxuICBob3N0PzogYXBpLkNvbXBpbGVySG9zdCxcbiAgb2xkUHJvZ3JhbT86IGFwaS5Qcm9ncmFtLFxuICBlbWl0Q2FsbGJhY2s/OiBhcGkuVHNFbWl0Q2FsbGJhY2ssXG4gIG1lcmdlRW1pdFJlc3VsdHNDYWxsYmFjaz86IGFwaS5Uc01lcmdlRW1pdFJlc3VsdHNDYWxsYmFjayxcbiAgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogYXBpLlByb2dyYW0pID0+IERpYWdub3N0aWNzLFxuICBjdXN0b21UcmFuc2Zvcm1lcnM/OiBhcGkuQ3VzdG9tVHJhbnNmb3JtZXJzLFxuICBlbWl0RmxhZ3M/OiBhcGkuRW1pdEZsYWdzLFxuICBtb2RpZmllZFJlc291cmNlRmlsZXM/OiBTZXQ8c3RyaW5nPnwgbnVsbCxcbn0pOiBQZXJmb3JtQ29tcGlsYXRpb25SZXN1bHQge1xuICBsZXQgcHJvZ3JhbTogYXBpLlByb2dyYW18dW5kZWZpbmVkO1xuICBsZXQgZW1pdFJlc3VsdDogdHMuRW1pdFJlc3VsdHx1bmRlZmluZWQ7XG4gIGxldCBhbGxEaWFnbm9zdGljczogQXJyYXk8dHMuRGlhZ25vc3RpY3xhcGkuRGlhZ25vc3RpYz4gPSBbXTtcbiAgdHJ5IHtcbiAgICBpZiAoIWhvc3QpIHtcbiAgICAgIGhvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnN9KTtcbiAgICB9XG4gICAgaWYgKG1vZGlmaWVkUmVzb3VyY2VGaWxlcykge1xuICAgICAgaG9zdC5nZXRNb2RpZmllZFJlc291cmNlRmlsZXMgPSAoKSA9PiBtb2RpZmllZFJlc291cmNlRmlsZXM7XG4gICAgfVxuXG4gICAgcHJvZ3JhbSA9IG5nLmNyZWF0ZVByb2dyYW0oe3Jvb3ROYW1lcywgaG9zdCwgb3B0aW9ucywgb2xkUHJvZ3JhbX0pO1xuXG4gICAgY29uc3QgYmVmb3JlRGlhZ3MgPSBEYXRlLm5vdygpO1xuICAgIGFsbERpYWdub3N0aWNzLnB1c2goLi4uZ2F0aGVyRGlhZ25vc3RpY3MocHJvZ3JhbSEpKTtcbiAgICBpZiAob3B0aW9ucy5kaWFnbm9zdGljcykge1xuICAgICAgY29uc3QgYWZ0ZXJEaWFncyA9IERhdGUubm93KCk7XG4gICAgICBhbGxEaWFnbm9zdGljcy5wdXNoKFxuICAgICAgICAgIGNyZWF0ZU1lc3NhZ2VEaWFnbm9zdGljKGBUaW1lIGZvciBkaWFnbm9zdGljczogJHthZnRlckRpYWdzIC0gYmVmb3JlRGlhZ3N9bXMuYCkpO1xuICAgIH1cblxuICAgIGlmICghaGFzRXJyb3JzKGFsbERpYWdub3N0aWNzKSkge1xuICAgICAgZW1pdFJlc3VsdCA9XG4gICAgICAgICAgcHJvZ3JhbSEuZW1pdCh7ZW1pdENhbGxiYWNrLCBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2ssIGN1c3RvbVRyYW5zZm9ybWVycywgZW1pdEZsYWdzfSk7XG4gICAgICBhbGxEaWFnbm9zdGljcy5wdXNoKC4uLmVtaXRSZXN1bHQuZGlhZ25vc3RpY3MpO1xuICAgICAgcmV0dXJuIHtkaWFnbm9zdGljczogYWxsRGlhZ25vc3RpY3MsIHByb2dyYW0sIGVtaXRSZXN1bHR9O1xuICAgIH1cbiAgICByZXR1cm4ge2RpYWdub3N0aWNzOiBhbGxEaWFnbm9zdGljcywgcHJvZ3JhbX07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsZXQgZXJyTXNnOiBzdHJpbmc7XG4gICAgbGV0IGNvZGU6IG51bWJlcjtcbiAgICBpZiAoaXNTeW50YXhFcnJvcihlKSkge1xuICAgICAgLy8gZG9uJ3QgcmVwb3J0IHRoZSBzdGFjayBmb3Igc3ludGF4IGVycm9ycyBhcyB0aGV5IGFyZSB3ZWxsIGtub3duIGVycm9ycy5cbiAgICAgIGVyck1zZyA9IGUubWVzc2FnZTtcbiAgICAgIGNvZGUgPSBhcGkuREVGQVVMVF9FUlJPUl9DT0RFO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJNc2cgPSBlLnN0YWNrO1xuICAgICAgLy8gSXQgaXMgbm90IGEgc3ludGF4IGVycm9yIHdlIG1pZ2h0IGhhdmUgYSBwcm9ncmFtIHdpdGggdW5rbm93biBzdGF0ZSwgZGlzY2FyZCBpdC5cbiAgICAgIHByb2dyYW0gPSB1bmRlZmluZWQ7XG4gICAgICBjb2RlID0gYXBpLlVOS05PV05fRVJST1JfQ09ERTtcbiAgICB9XG4gICAgYWxsRGlhZ25vc3RpY3MucHVzaChcbiAgICAgICAge2NhdGVnb3J5OiB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IsIG1lc3NhZ2VUZXh0OiBlcnJNc2csIGNvZGUsIHNvdXJjZTogYXBpLlNPVVJDRX0pO1xuICAgIHJldHVybiB7ZGlhZ25vc3RpY3M6IGFsbERpYWdub3N0aWNzLCBwcm9ncmFtfTtcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRHYXRoZXJEaWFnbm9zdGljcyhwcm9ncmFtOiBhcGkuUHJvZ3JhbSk6IERpYWdub3N0aWNzIHtcbiAgY29uc3QgYWxsRGlhZ25vc3RpY3M6IEFycmF5PHRzLkRpYWdub3N0aWN8YXBpLkRpYWdub3N0aWM+ID0gW107XG5cbiAgZnVuY3Rpb24gY2hlY2tEaWFnbm9zdGljcyhkaWFnczogRGlhZ25vc3RpY3N8dW5kZWZpbmVkKSB7XG4gICAgaWYgKGRpYWdzKSB7XG4gICAgICBhbGxEaWFnbm9zdGljcy5wdXNoKC4uLmRpYWdzKTtcbiAgICAgIHJldHVybiAhaGFzRXJyb3JzKGRpYWdzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBsZXQgY2hlY2tPdGhlckRpYWdub3N0aWNzID0gdHJ1ZTtcbiAgLy8gQ2hlY2sgcGFyYW1ldGVyIGRpYWdub3N0aWNzXG4gIGNoZWNrT3RoZXJEaWFnbm9zdGljcyA9IGNoZWNrT3RoZXJEaWFnbm9zdGljcyAmJlxuICAgICAgY2hlY2tEaWFnbm9zdGljcyhbLi4ucHJvZ3JhbS5nZXRUc09wdGlvbkRpYWdub3N0aWNzKCksIC4uLnByb2dyYW0uZ2V0TmdPcHRpb25EaWFnbm9zdGljcygpXSk7XG5cbiAgLy8gQ2hlY2sgc3ludGFjdGljIGRpYWdub3N0aWNzXG4gIGNoZWNrT3RoZXJEaWFnbm9zdGljcyA9XG4gICAgICBjaGVja090aGVyRGlhZ25vc3RpY3MgJiYgY2hlY2tEaWFnbm9zdGljcyhwcm9ncmFtLmdldFRzU3ludGFjdGljRGlhZ25vc3RpY3MoKSBhcyBEaWFnbm9zdGljcyk7XG5cbiAgLy8gQ2hlY2sgVHlwZVNjcmlwdCBzZW1hbnRpYyBhbmQgQW5ndWxhciBzdHJ1Y3R1cmUgZGlhZ25vc3RpY3NcbiAgY2hlY2tPdGhlckRpYWdub3N0aWNzID1cbiAgICAgIGNoZWNrT3RoZXJEaWFnbm9zdGljcyAmJlxuICAgICAgY2hlY2tEaWFnbm9zdGljcyhcbiAgICAgICAgICBbLi4ucHJvZ3JhbS5nZXRUc1NlbWFudGljRGlhZ25vc3RpY3MoKSwgLi4ucHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpXSk7XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciBzZW1hbnRpYyBkaWFnbm9zdGljc1xuICBjaGVja090aGVyRGlhZ25vc3RpY3MgPVxuICAgICAgY2hlY2tPdGhlckRpYWdub3N0aWNzICYmIGNoZWNrRGlhZ25vc3RpY3MocHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSBhcyBEaWFnbm9zdGljcyk7XG5cbiAgcmV0dXJuIGFsbERpYWdub3N0aWNzO1xufVxuXG5mdW5jdGlvbiBoYXNFcnJvcnMoZGlhZ3M6IERpYWdub3N0aWNzKSB7XG4gIHJldHVybiBkaWFncy5zb21lKGQgPT4gZC5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbn1cbiJdfQ==