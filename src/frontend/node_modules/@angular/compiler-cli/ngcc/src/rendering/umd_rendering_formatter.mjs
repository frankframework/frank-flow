import * as ts from 'typescript';
import { Esm5RenderingFormatter } from './esm5_rendering_formatter';
import { stripExtension } from './utils';
/**
 * A RenderingFormatter that works with UMD files, instead of `import` and `export` statements
 * the module is an IIFE with a factory function call with dependencies, which are defined in a
 * wrapper function for AMD, CommonJS and global module formats.
 */
export class UmdRenderingFormatter extends Esm5RenderingFormatter {
    constructor(fs, umdHost, isCore) {
        super(fs, umdHost, isCore);
        this.umdHost = umdHost;
    }
    /**
     * Add the imports to the UMD module IIFE.
     *
     * Note that imports at "prepended" to the start of the parameter list of the factory function,
     * and so also to the arguments passed to it when it is called.
     * This is because there are scenarios where the factory function does not accept as many
     * parameters as are passed as argument in the call. For example:
     *
     * ```
     * (function (global, factory) {
     *     typeof exports === 'object' && typeof module !== 'undefined' ?
     *         factory(exports,require('x'),require('z')) :
     *     typeof define === 'function' && define.amd ?
     *         define(['exports', 'x', 'z'], factory) :
     *     (global = global || self, factory(global.myBundle = {}, global.x));
     * }(this, (function (exports, x) { ... }
     * ```
     *
     * (See that the `z` import is not being used by the factory function.)
     */
    addImports(output, imports, file) {
        if (imports.length === 0) {
            return;
        }
        // Assume there is only one UMD module in the file
        const umdModule = this.umdHost.getUmdModule(file);
        if (!umdModule) {
            return;
        }
        const wrapperFunction = umdModule.wrapperFn;
        // We need to add new `require()` calls for each import in the CommonJS initializer
        renderCommonJsDependencies(output, wrapperFunction, imports);
        renderAmdDependencies(output, wrapperFunction, imports);
        renderGlobalDependencies(output, wrapperFunction, imports);
        renderFactoryParameters(output, wrapperFunction, imports);
    }
    /**
     * Add the exports to the bottom of the UMD module factory function.
     */
    addExports(output, entryPointBasePath, exports, importManager, file) {
        const umdModule = this.umdHost.getUmdModule(file);
        if (!umdModule) {
            return;
        }
        const factoryFunction = umdModule.factoryFn;
        const lastStatement = factoryFunction.body.statements[factoryFunction.body.statements.length - 1];
        const insertionPoint = lastStatement ? lastStatement.getEnd() : factoryFunction.body.getEnd() - 1;
        exports.forEach(e => {
            const basePath = stripExtension(e.from);
            const relativePath = './' + this.fs.relative(this.fs.dirname(entryPointBasePath), basePath);
            const namedImport = entryPointBasePath !== basePath ?
                importManager.generateNamedImport(relativePath, e.identifier) :
                { symbol: e.identifier, moduleImport: null };
            const importNamespace = namedImport.moduleImport ? `${namedImport.moduleImport.text}.` : '';
            const exportStr = `\nexports.${e.identifier} = ${importNamespace}${namedImport.symbol};`;
            output.appendRight(insertionPoint, exportStr);
        });
    }
    addDirectExports(output, exports, importManager, file) {
        const umdModule = this.umdHost.getUmdModule(file);
        if (!umdModule) {
            return;
        }
        const factoryFunction = umdModule.factoryFn;
        const lastStatement = factoryFunction.body.statements[factoryFunction.body.statements.length - 1];
        const insertionPoint = lastStatement ? lastStatement.getEnd() : factoryFunction.body.getEnd() - 1;
        for (const e of exports) {
            const namedImport = importManager.generateNamedImport(e.fromModule, e.symbolName);
            const importNamespace = namedImport.moduleImport ? `${namedImport.moduleImport.text}.` : '';
            const exportStr = `\nexports.${e.asAlias} = ${importNamespace}${namedImport.symbol};`;
            output.appendRight(insertionPoint, exportStr);
        }
    }
    /**
     * Add the constants to the top of the UMD factory function.
     */
    addConstants(output, constants, file) {
        if (constants === '') {
            return;
        }
        const umdModule = this.umdHost.getUmdModule(file);
        if (!umdModule) {
            return;
        }
        const factoryFunction = umdModule.factoryFn;
        const firstStatement = factoryFunction.body.statements[0];
        const insertionPoint = firstStatement ? firstStatement.getStart() : factoryFunction.body.getStart() + 1;
        output.appendLeft(insertionPoint, '\n' + constants + '\n');
    }
}
/**
 * Add dependencies to the CommonJS part of the UMD wrapper function.
 */
function renderCommonJsDependencies(output, wrapperFunction, imports) {
    const conditional = find(wrapperFunction.body.statements[0], isCommonJSConditional);
    if (!conditional) {
        return;
    }
    const factoryCall = conditional.whenTrue;
    const injectionPoint = factoryCall.arguments.length > 0 ?
        // Add extra dependencies before the first argument
        factoryCall.arguments[0].getFullStart() :
        // Backup one char to account for the closing parenthesis on the call
        factoryCall.getEnd() - 1;
    const importString = imports.map(i => `require('${i.specifier}')`).join(',');
    output.appendLeft(injectionPoint, importString + (factoryCall.arguments.length > 0 ? ',' : ''));
}
/**
 * Add dependencies to the AMD part of the UMD wrapper function.
 */
function renderAmdDependencies(output, wrapperFunction, imports) {
    const conditional = find(wrapperFunction.body.statements[0], isAmdConditional);
    if (!conditional) {
        return;
    }
    const amdDefineCall = conditional.whenTrue;
    const importString = imports.map(i => `'${i.specifier}'`).join(',');
    // The dependency array (if it exists) is the second to last argument
    // `define(id?, dependencies?, factory);`
    const factoryIndex = amdDefineCall.arguments.length - 1;
    const dependencyArray = amdDefineCall.arguments[factoryIndex - 1];
    if (dependencyArray === undefined || !ts.isArrayLiteralExpression(dependencyArray)) {
        // No array provided: `define(factory)` or `define(id, factory)`.
        // Insert a new array in front the `factory` call.
        const injectionPoint = amdDefineCall.arguments[factoryIndex].getFullStart();
        output.appendLeft(injectionPoint, `[${importString}],`);
    }
    else {
        // Already an array
        const injectionPoint = dependencyArray.elements.length > 0 ?
            // Add imports before the first item.
            dependencyArray.elements[0].getFullStart() :
            // Backup one char to account for the closing square bracket on the array
            dependencyArray.getEnd() - 1;
        output.appendLeft(injectionPoint, importString + (dependencyArray.elements.length > 0 ? ',' : ''));
    }
}
/**
 * Add dependencies to the global part of the UMD wrapper function.
 */
function renderGlobalDependencies(output, wrapperFunction, imports) {
    const globalFactoryCall = find(wrapperFunction.body.statements[0], isGlobalFactoryCall);
    if (!globalFactoryCall) {
        return;
    }
    const injectionPoint = globalFactoryCall.arguments.length > 0 ?
        // Add extra dependencies before the first argument
        globalFactoryCall.arguments[0].getFullStart() :
        // Backup one char to account for the closing parenthesis on the call
        globalFactoryCall.getEnd() - 1;
    const importString = imports.map(i => `global.${getGlobalIdentifier(i)}`).join(',');
    output.appendLeft(injectionPoint, importString + (globalFactoryCall.arguments.length > 0 ? ',' : ''));
}
/**
 * Add dependency parameters to the UMD factory function.
 */
function renderFactoryParameters(output, wrapperFunction, imports) {
    const wrapperCall = wrapperFunction.parent;
    const secondArgument = wrapperCall.arguments[1];
    if (!secondArgument) {
        return;
    }
    // Be resilient to the factory being inside parentheses
    const factoryFunction = ts.isParenthesizedExpression(secondArgument) ? secondArgument.expression : secondArgument;
    if (!ts.isFunctionExpression(factoryFunction)) {
        return;
    }
    const parameters = factoryFunction.parameters;
    const parameterString = imports.map(i => i.qualifier.text).join(',');
    if (parameters.length > 0) {
        const injectionPoint = parameters[0].getFullStart();
        output.appendLeft(injectionPoint, parameterString + ',');
    }
    else {
        // If there are no parameters then the factory function will look like:
        // function () { ... }
        // The AST does not give us a way to find the insertion point - between the two parentheses.
        // So we must use a regular expression on the text of the function.
        const injectionPoint = factoryFunction.getStart() + factoryFunction.getText().indexOf('()') + 1;
        output.appendLeft(injectionPoint, parameterString);
    }
}
/**
 * Is this node the CommonJS conditional expression in the UMD wrapper?
 */
function isCommonJSConditional(value) {
    if (!ts.isConditionalExpression(value)) {
        return false;
    }
    if (!ts.isBinaryExpression(value.condition) ||
        value.condition.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) {
        return false;
    }
    if (!oneOfBinaryConditions(value.condition, (exp) => isTypeOf(exp, 'exports', 'module'))) {
        return false;
    }
    if (!ts.isCallExpression(value.whenTrue) || !ts.isIdentifier(value.whenTrue.expression)) {
        return false;
    }
    return value.whenTrue.expression.text === 'factory';
}
/**
 * Is this node the AMD conditional expression in the UMD wrapper?
 */
function isAmdConditional(value) {
    if (!ts.isConditionalExpression(value)) {
        return false;
    }
    if (!ts.isBinaryExpression(value.condition) ||
        value.condition.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) {
        return false;
    }
    if (!oneOfBinaryConditions(value.condition, (exp) => isTypeOf(exp, 'define'))) {
        return false;
    }
    if (!ts.isCallExpression(value.whenTrue) || !ts.isIdentifier(value.whenTrue.expression)) {
        return false;
    }
    return value.whenTrue.expression.text === 'define';
}
/**
 * Is this node the call to setup the global dependencies in the UMD wrapper?
 */
function isGlobalFactoryCall(value) {
    if (ts.isCallExpression(value) && !!value.parent) {
        // Be resilient to the value being part of a comma list
        value = isCommaExpression(value.parent) ? value.parent : value;
        // Be resilient to the value being inside parentheses
        value = ts.isParenthesizedExpression(value.parent) ? value.parent : value;
        return !!value.parent && ts.isConditionalExpression(value.parent) &&
            value.parent.whenFalse === value;
    }
    else {
        return false;
    }
}
function isCommaExpression(value) {
    return ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.CommaToken;
}
/**
 * Compute a global identifier for the given import (`i`).
 *
 * The identifier used to access a package when using the "global" form of a UMD bundle usually
 * follows a special format where snake-case is conveted to camelCase and path separators are
 * converted to dots. In addition there are special cases such as `@angular` is mapped to `ng`.
 *
 * For example
 *
 * * `@ns/package/entry-point` => `ns.package.entryPoint`
 * * `@angular/common/testing` => `ng.common.testing`
 * * `@angular/platform-browser-dynamic` => `ng.platformBrowserDynamic`
 *
 * It is possible for packages to specify completely different identifiers for attaching the package
 * to the global, and so there is no guaranteed way to compute this.
 * Currently, this approach appears to work for the known scenarios; also it is not known how common
 * it is to use globals for importing packages.
 *
 * If it turns out that there are packages that are being used via globals, where this approach
 * fails, we should consider implementing a configuration based solution, similar to what would go
 * in a rollup configuration for mapping import paths to global indentifiers.
 */
function getGlobalIdentifier(i) {
    return i.specifier.replace(/^@angular\//, 'ng.')
        .replace(/^@/, '')
        .replace(/\//g, '.')
        .replace(/[-_]+(.?)/g, (_, c) => c.toUpperCase())
        .replace(/^./, c => c.toLowerCase());
}
function find(node, test) {
    return test(node) ? node : node.forEachChild(child => find(child, test));
}
function oneOfBinaryConditions(node, test) {
    return test(node.left) || test(node.right);
}
function isTypeOf(node, ...types) {
    return ts.isBinaryExpression(node) && ts.isTypeOfExpression(node.left) &&
        ts.isIdentifier(node.left.expression) && types.indexOf(node.left.expression.text) !== -1;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW1kX3JlbmRlcmluZ19mb3JtYXR0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvcmVuZGVyaW5nL3VtZF9yZW5kZXJpbmdfZm9ybWF0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBUWpDLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2xFLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFLdkM7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxxQkFBc0IsU0FBUSxzQkFBc0I7SUFDL0QsWUFBWSxFQUFvQixFQUFZLE9BQTBCLEVBQUUsTUFBZTtRQUNyRixLQUFLLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQURlLFlBQU8sR0FBUCxPQUFPLENBQW1CO0lBRXRFLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQW1CRztJQUNILFVBQVUsQ0FBQyxNQUFtQixFQUFFLE9BQWlCLEVBQUUsSUFBbUI7UUFDcEUsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN4QixPQUFPO1NBQ1I7UUFFRCxrREFBa0Q7UUFDbEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNkLE9BQU87U0FDUjtRQUVELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7UUFFNUMsbUZBQW1GO1FBQ25GLDBCQUEwQixDQUFDLE1BQU0sRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0QscUJBQXFCLENBQUMsTUFBTSxFQUFFLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN4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ZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgTWFnaWNTdHJpbmcgZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge1BhdGhNYW5pcHVsYXRpb259IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge1JlZXhwb3J0fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvaW1wb3J0cyc7XG5pbXBvcnQge0ltcG9ydCwgSW1wb3J0TWFuYWdlcn0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL3RyYW5zbGF0b3InO1xuaW1wb3J0IHtFeHBvcnRJbmZvfSBmcm9tICcuLi9hbmFseXNpcy9wcml2YXRlX2RlY2xhcmF0aW9uc19hbmFseXplcic7XG5pbXBvcnQge1VtZFJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi9ob3N0L3VtZF9ob3N0JztcblxuaW1wb3J0IHtFc201UmVuZGVyaW5nRm9ybWF0dGVyfSBmcm9tICcuL2VzbTVfcmVuZGVyaW5nX2Zvcm1hdHRlcic7XG5pbXBvcnQge3N0cmlwRXh0ZW5zaW9ufSBmcm9tICcuL3V0aWxzJztcblxudHlwZSBDb21tb25Kc0NvbmRpdGlvbmFsID0gdHMuQ29uZGl0aW9uYWxFeHByZXNzaW9uJnt3aGVuVHJ1ZTogdHMuQ2FsbEV4cHJlc3Npb259O1xudHlwZSBBbWRDb25kaXRpb25hbCA9IHRzLkNvbmRpdGlvbmFsRXhwcmVzc2lvbiZ7d2hlblRydWU6IHRzLkNhbGxFeHByZXNzaW9ufTtcblxuLyoqXG4gKiBBIFJlbmRlcmluZ0Zvcm1hdHRlciB0aGF0IHdvcmtzIHdpdGggVU1EIGZpbGVzLCBpbnN0ZWFkIG9mIGBpbXBvcnRgIGFuZCBgZXhwb3J0YCBzdGF0ZW1lbnRzXG4gKiB0aGUgbW9kdWxlIGlzIGFuIElJRkUgd2l0aCBhIGZhY3RvcnkgZnVuY3Rpb24gY2FsbCB3aXRoIGRlcGVuZGVuY2llcywgd2hpY2ggYXJlIGRlZmluZWQgaW4gYVxuICogd3JhcHBlciBmdW5jdGlvbiBmb3IgQU1ELCBDb21tb25KUyBhbmQgZ2xvYmFsIG1vZHVsZSBmb3JtYXRzLlxuICovXG5leHBvcnQgY2xhc3MgVW1kUmVuZGVyaW5nRm9ybWF0dGVyIGV4dGVuZHMgRXNtNVJlbmRlcmluZ0Zvcm1hdHRlciB7XG4gIGNvbnN0cnVjdG9yKGZzOiBQYXRoTWFuaXB1bGF0aW9uLCBwcm90ZWN0ZWQgdW1kSG9zdDogVW1kUmVmbGVjdGlvbkhvc3QsIGlzQ29yZTogYm9vbGVhbikge1xuICAgIHN1cGVyKGZzLCB1bWRIb3N0LCBpc0NvcmUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgaW1wb3J0cyB0byB0aGUgVU1EIG1vZHVsZSBJSUZFLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgaW1wb3J0cyBhdCBcInByZXBlbmRlZFwiIHRvIHRoZSBzdGFydCBvZiB0aGUgcGFyYW1ldGVyIGxpc3Qgb2YgdGhlIGZhY3RvcnkgZnVuY3Rpb24sXG4gICAqIGFuZCBzbyBhbHNvIHRvIHRoZSBhcmd1bWVudHMgcGFzc2VkIHRvIGl0IHdoZW4gaXQgaXMgY2FsbGVkLlxuICAgKiBUaGlzIGlzIGJlY2F1c2UgdGhlcmUgYXJlIHNjZW5hcmlvcyB3aGVyZSB0aGUgZmFjdG9yeSBmdW5jdGlvbiBkb2VzIG5vdCBhY2NlcHQgYXMgbWFueVxuICAgKiBwYXJhbWV0ZXJzIGFzIGFyZSBwYXNzZWQgYXMgYXJndW1lbnQgaW4gdGhlIGNhbGwuIEZvciBleGFtcGxlOlxuICAgKlxuICAgKiBgYGBcbiAgICogKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgICogICAgIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/XG4gICAqICAgICAgICAgZmFjdG9yeShleHBvcnRzLHJlcXVpcmUoJ3gnKSxyZXF1aXJlKCd6JykpIDpcbiAgICogICAgIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/XG4gICAqICAgICAgICAgZGVmaW5lKFsnZXhwb3J0cycsICd4JywgJ3onXSwgZmFjdG9yeSkgOlxuICAgKiAgICAgKGdsb2JhbCA9IGdsb2JhbCB8fCBzZWxmLCBmYWN0b3J5KGdsb2JhbC5teUJ1bmRsZSA9IHt9LCBnbG9iYWwueCkpO1xuICAgKiB9KHRoaXMsIChmdW5jdGlvbiAoZXhwb3J0cywgeCkgeyAuLi4gfVxuICAgKiBgYGBcbiAgICpcbiAgICogKFNlZSB0aGF0IHRoZSBgemAgaW1wb3J0IGlzIG5vdCBiZWluZyB1c2VkIGJ5IHRoZSBmYWN0b3J5IGZ1bmN0aW9uLilcbiAgICovXG4gIGFkZEltcG9ydHMob3V0cHV0OiBNYWdpY1N0cmluZywgaW1wb3J0czogSW1wb3J0W10sIGZpbGU6IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICBpZiAoaW1wb3J0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBBc3N1bWUgdGhlcmUgaXMgb25seSBvbmUgVU1EIG1vZHVsZSBpbiB0aGUgZmlsZVxuICAgIGNvbnN0IHVtZE1vZHVsZSA9IHRoaXMudW1kSG9zdC5nZXRVbWRNb2R1bGUoZmlsZSk7XG4gICAgaWYgKCF1bWRNb2R1bGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB3cmFwcGVyRnVuY3Rpb24gPSB1bWRNb2R1bGUud3JhcHBlckZuO1xuXG4gICAgLy8gV2UgbmVlZCB0byBhZGQgbmV3IGByZXF1aXJlKClgIGNhbGxzIGZvciBlYWNoIGltcG9ydCBpbiB0aGUgQ29tbW9uSlMgaW5pdGlhbGl6ZXJcbiAgICByZW5kZXJDb21tb25Kc0RlcGVuZGVuY2llcyhvdXRwdXQsIHdyYXBwZXJGdW5jdGlvbiwgaW1wb3J0cyk7XG4gICAgcmVuZGVyQW1kRGVwZW5kZW5jaWVzKG91dHB1dCwgd3JhcHBlckZ1bmN0aW9uLCBpbXBvcnRzKTtcbiAgICByZW5kZXJHbG9iYWxEZXBlbmRlbmNpZXMob3V0cHV0LCB3cmFwcGVyRnVuY3Rpb24sIGltcG9ydHMpO1xuICAgIHJlbmRlckZhY3RvcnlQYXJhbWV0ZXJzKG91dHB1dCwgd3JhcHBlckZ1bmN0aW9uLCBpbXBvcnRzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgdGhlIGV4cG9ydHMgdG8gdGhlIGJvdHRvbSBvZiB0aGUgVU1EIG1vZHVsZSBmYWN0b3J5IGZ1bmN0aW9uLlxuICAgKi9cbiAgYWRkRXhwb3J0cyhcbiAgICAgIG91dHB1dDogTWFnaWNTdHJpbmcsIGVudHJ5UG9pbnRCYXNlUGF0aDogc3RyaW5nLCBleHBvcnRzOiBFeHBvcnRJbmZvW10sXG4gICAgICBpbXBvcnRNYW5hZ2VyOiBJbXBvcnRNYW5hZ2VyLCBmaWxlOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgY29uc3QgdW1kTW9kdWxlID0gdGhpcy51bWRIb3N0LmdldFVtZE1vZHVsZShmaWxlKTtcbiAgICBpZiAoIXVtZE1vZHVsZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBmYWN0b3J5RnVuY3Rpb24gPSB1bWRNb2R1bGUuZmFjdG9yeUZuO1xuICAgIGNvbnN0IGxhc3RTdGF0ZW1lbnQgPVxuICAgICAgICBmYWN0b3J5RnVuY3Rpb24uYm9keS5zdGF0ZW1lbnRzW2ZhY3RvcnlGdW5jdGlvbi5ib2R5LnN0YXRlbWVudHMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgaW5zZXJ0aW9uUG9pbnQgPVxuICAgICAgICBsYXN0U3RhdGVtZW50ID8gbGFzdFN0YXRlbWVudC5nZXRFbmQoKSA6IGZhY3RvcnlGdW5jdGlvbi5ib2R5LmdldEVuZCgpIC0gMTtcbiAgICBleHBvcnRzLmZvckVhY2goZSA9PiB7XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IHN0cmlwRXh0ZW5zaW9uKGUuZnJvbSk7XG4gICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSAnLi8nICsgdGhpcy5mcy5yZWxhdGl2ZSh0aGlzLmZzLmRpcm5hbWUoZW50cnlQb2ludEJhc2VQYXRoKSwgYmFzZVBhdGgpO1xuICAgICAgY29uc3QgbmFtZWRJbXBvcnQgPSBlbnRyeVBvaW50QmFzZVBhdGggIT09IGJhc2VQYXRoID9cbiAgICAgICAgICBpbXBvcnRNYW5hZ2VyLmdlbmVyYXRlTmFtZWRJbXBvcnQocmVsYXRpdmVQYXRoLCBlLmlkZW50aWZpZXIpIDpcbiAgICAgICAgICB7c3ltYm9sOiBlLmlkZW50aWZpZXIsIG1vZHVsZUltcG9ydDogbnVsbH07XG4gICAgICBjb25zdCBpbXBvcnROYW1lc3BhY2UgPSBuYW1lZEltcG9ydC5tb2R1bGVJbXBvcnQgPyBgJHtuYW1lZEltcG9ydC5tb2R1bGVJbXBvcnQudGV4dH0uYCA6ICcnO1xuICAgICAgY29uc3QgZXhwb3J0U3RyID0gYFxcbmV4cG9ydHMuJHtlLmlkZW50aWZpZXJ9ID0gJHtpbXBvcnROYW1lc3BhY2V9JHtuYW1lZEltcG9ydC5zeW1ib2x9O2A7XG4gICAgICBvdXRwdXQuYXBwZW5kUmlnaHQoaW5zZXJ0aW9uUG9pbnQsIGV4cG9ydFN0cik7XG4gICAgfSk7XG4gIH1cblxuICBhZGREaXJlY3RFeHBvcnRzKFxuICAgICAgb3V0cHV0OiBNYWdpY1N0cmluZywgZXhwb3J0czogUmVleHBvcnRbXSwgaW1wb3J0TWFuYWdlcjogSW1wb3J0TWFuYWdlcixcbiAgICAgIGZpbGU6IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICBjb25zdCB1bWRNb2R1bGUgPSB0aGlzLnVtZEhvc3QuZ2V0VW1kTW9kdWxlKGZpbGUpO1xuICAgIGlmICghdW1kTW9kdWxlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGZhY3RvcnlGdW5jdGlvbiA9IHVtZE1vZHVsZS5mYWN0b3J5Rm47XG4gICAgY29uc3QgbGFzdFN0YXRlbWVudCA9XG4gICAgICAgIGZhY3RvcnlGdW5jdGlvbi5ib2R5LnN0YXRlbWVudHNbZmFjdG9yeUZ1bmN0aW9uLmJvZHkuc3RhdGVtZW50cy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCBpbnNlcnRpb25Qb2ludCA9XG4gICAgICAgIGxhc3RTdGF0ZW1lbnQgPyBsYXN0U3RhdGVtZW50LmdldEVuZCgpIDogZmFjdG9yeUZ1bmN0aW9uLmJvZHkuZ2V0RW5kKCkgLSAxO1xuICAgIGZvciAoY29uc3QgZSBvZiBleHBvcnRzKSB7XG4gICAgICBjb25zdCBuYW1lZEltcG9ydCA9IGltcG9ydE1hbmFnZXIuZ2VuZXJhdGVOYW1lZEltcG9ydChlLmZyb21Nb2R1bGUsIGUuc3ltYm9sTmFtZSk7XG4gICAgICBjb25zdCBpbXBvcnROYW1lc3BhY2UgPSBuYW1lZEltcG9ydC5tb2R1bGVJbXBvcnQgPyBgJHtuYW1lZEltcG9ydC5tb2R1bGVJbXBvcnQudGV4dH0uYCA6ICcnO1xuICAgICAgY29uc3QgZXhwb3J0U3RyID0gYFxcbmV4cG9ydHMuJHtlLmFzQWxpYXN9ID0gJHtpbXBvcnROYW1lc3BhY2V9JHtuYW1lZEltcG9ydC5zeW1ib2x9O2A7XG4gICAgICBvdXRwdXQuYXBwZW5kUmlnaHQoaW5zZXJ0aW9uUG9pbnQsIGV4cG9ydFN0cik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgY29uc3RhbnRzIHRvIHRoZSB0b3Agb2YgdGhlIFVNRCBmYWN0b3J5IGZ1bmN0aW9uLlxuICAgKi9cbiAgYWRkQ29uc3RhbnRzKG91dHB1dDogTWFnaWNTdHJpbmcsIGNvbnN0YW50czogc3RyaW5nLCBmaWxlOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgaWYgKGNvbnN0YW50cyA9PT0gJycpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdW1kTW9kdWxlID0gdGhpcy51bWRIb3N0LmdldFVtZE1vZHVsZShmaWxlKTtcbiAgICBpZiAoIXVtZE1vZHVsZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBmYWN0b3J5RnVuY3Rpb24gPSB1bWRNb2R1bGUuZmFjdG9yeUZuO1xuICAgIGNvbnN0IGZpcnN0U3RhdGVtZW50ID0gZmFjdG9yeUZ1bmN0aW9uLmJvZHkuc3RhdGVtZW50c1swXTtcbiAgICBjb25zdCBpbnNlcnRpb25Qb2ludCA9XG4gICAgICAgIGZpcnN0U3RhdGVtZW50ID8gZmlyc3RTdGF0ZW1lbnQuZ2V0U3RhcnQoKSA6IGZhY3RvcnlGdW5jdGlvbi5ib2R5LmdldFN0YXJ0KCkgKyAxO1xuICAgIG91dHB1dC5hcHBlbmRMZWZ0KGluc2VydGlvblBvaW50LCAnXFxuJyArIGNvbnN0YW50cyArICdcXG4nKTtcbiAgfVxufVxuXG4vKipcbiAqIEFkZCBkZXBlbmRlbmNpZXMgdG8gdGhlIENvbW1vbkpTIHBhcnQgb2YgdGhlIFVNRCB3cmFwcGVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiByZW5kZXJDb21tb25Kc0RlcGVuZGVuY2llcyhcbiAgICBvdXRwdXQ6IE1hZ2ljU3RyaW5nLCB3cmFwcGVyRnVuY3Rpb246IHRzLkZ1bmN0aW9uRXhwcmVzc2lvbiwgaW1wb3J0czogSW1wb3J0W10pIHtcbiAgY29uc3QgY29uZGl0aW9uYWwgPSBmaW5kKHdyYXBwZXJGdW5jdGlvbi5ib2R5LnN0YXRlbWVudHNbMF0sIGlzQ29tbW9uSlNDb25kaXRpb25hbCk7XG4gIGlmICghY29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgZmFjdG9yeUNhbGwgPSBjb25kaXRpb25hbC53aGVuVHJ1ZTtcbiAgY29uc3QgaW5qZWN0aW9uUG9pbnQgPSBmYWN0b3J5Q2FsbC5hcmd1bWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAvLyBBZGQgZXh0cmEgZGVwZW5kZW5jaWVzIGJlZm9yZSB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgIGZhY3RvcnlDYWxsLmFyZ3VtZW50c1swXS5nZXRGdWxsU3RhcnQoKSA6XG4gICAgICAvLyBCYWNrdXAgb25lIGNoYXIgdG8gYWNjb3VudCBmb3IgdGhlIGNsb3NpbmcgcGFyZW50aGVzaXMgb24gdGhlIGNhbGxcbiAgICAgIGZhY3RvcnlDYWxsLmdldEVuZCgpIC0gMTtcbiAgY29uc3QgaW1wb3J0U3RyaW5nID0gaW1wb3J0cy5tYXAoaSA9PiBgcmVxdWlyZSgnJHtpLnNwZWNpZmllcn0nKWApLmpvaW4oJywnKTtcbiAgb3V0cHV0LmFwcGVuZExlZnQoaW5qZWN0aW9uUG9pbnQsIGltcG9ydFN0cmluZyArIChmYWN0b3J5Q2FsbC5hcmd1bWVudHMubGVuZ3RoID4gMCA/ICcsJyA6ICcnKSk7XG59XG5cbi8qKlxuICogQWRkIGRlcGVuZGVuY2llcyB0byB0aGUgQU1EIHBhcnQgb2YgdGhlIFVNRCB3cmFwcGVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiByZW5kZXJBbWREZXBlbmRlbmNpZXMoXG4gICAgb3V0cHV0OiBNYWdpY1N0cmluZywgd3JhcHBlckZ1bmN0aW9uOiB0cy5GdW5jdGlvbkV4cHJlc3Npb24sIGltcG9ydHM6IEltcG9ydFtdKSB7XG4gIGNvbnN0IGNvbmRpdGlvbmFsID0gZmluZCh3cmFwcGVyRnVuY3Rpb24uYm9keS5zdGF0ZW1lbnRzWzBdLCBpc0FtZENvbmRpdGlvbmFsKTtcbiAgaWYgKCFjb25kaXRpb25hbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBhbWREZWZpbmVDYWxsID0gY29uZGl0aW9uYWwud2hlblRydWU7XG4gIGNvbnN0IGltcG9ydFN0cmluZyA9IGltcG9ydHMubWFwKGkgPT4gYCcke2kuc3BlY2lmaWVyfSdgKS5qb2luKCcsJyk7XG4gIC8vIFRoZSBkZXBlbmRlbmN5IGFycmF5IChpZiBpdCBleGlzdHMpIGlzIHRoZSBzZWNvbmQgdG8gbGFzdCBhcmd1bWVudFxuICAvLyBgZGVmaW5lKGlkPywgZGVwZW5kZW5jaWVzPywgZmFjdG9yeSk7YFxuICBjb25zdCBmYWN0b3J5SW5kZXggPSBhbWREZWZpbmVDYWxsLmFyZ3VtZW50cy5sZW5ndGggLSAxO1xuICBjb25zdCBkZXBlbmRlbmN5QXJyYXkgPSBhbWREZWZpbmVDYWxsLmFyZ3VtZW50c1tmYWN0b3J5SW5kZXggLSAxXTtcbiAgaWYgKGRlcGVuZGVuY3lBcnJheSA9PT0gdW5kZWZpbmVkIHx8ICF0cy5pc0FycmF5TGl0ZXJhbEV4cHJlc3Npb24oZGVwZW5kZW5jeUFycmF5KSkge1xuICAgIC8vIE5vIGFycmF5IHByb3ZpZGVkOiBgZGVmaW5lKGZhY3RvcnkpYCBvciBgZGVmaW5lKGlkLCBmYWN0b3J5KWAuXG4gICAgLy8gSW5zZXJ0IGEgbmV3IGFycmF5IGluIGZyb250IHRoZSBgZmFjdG9yeWAgY2FsbC5cbiAgICBjb25zdCBpbmplY3Rpb25Qb2ludCA9IGFtZERlZmluZUNhbGwuYXJndW1lbnRzW2ZhY3RvcnlJbmRleF0uZ2V0RnVsbFN0YXJ0KCk7XG4gICAgb3V0cHV0LmFwcGVuZExlZnQoaW5qZWN0aW9uUG9pbnQsIGBbJHtpbXBvcnRTdHJpbmd9XSxgKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBBbHJlYWR5IGFuIGFycmF5XG4gICAgY29uc3QgaW5qZWN0aW9uUG9pbnQgPSBkZXBlbmRlbmN5QXJyYXkuZWxlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIC8vIEFkZCBpbXBvcnRzIGJlZm9yZSB0aGUgZmlyc3QgaXRlbS5cbiAgICAgICAgZGVwZW5kZW5jeUFycmF5LmVsZW1lbnRzWzBdLmdldEZ1bGxTdGFydCgpIDpcbiAgICAgICAgLy8gQmFja3VwIG9uZSBjaGFyIHRvIGFjY291bnQgZm9yIHRoZSBjbG9zaW5nIHNxdWFyZSBicmFja2V0IG9uIHRoZSBhcnJheVxuICAgICAgICBkZXBlbmRlbmN5QXJyYXkuZ2V0RW5kKCkgLSAxO1xuICAgIG91dHB1dC5hcHBlbmRMZWZ0KFxuICAgICAgICBpbmplY3Rpb25Qb2ludCwgaW1wb3J0U3RyaW5nICsgKGRlcGVuZGVuY3lBcnJheS5lbGVtZW50cy5sZW5ndGggPiAwID8gJywnIDogJycpKTtcbiAgfVxufVxuXG4vKipcbiAqIEFkZCBkZXBlbmRlbmNpZXMgdG8gdGhlIGdsb2JhbCBwYXJ0IG9mIHRoZSBVTUQgd3JhcHBlciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gcmVuZGVyR2xvYmFsRGVwZW5kZW5jaWVzKFxuICAgIG91dHB1dDogTWFnaWNTdHJpbmcsIHdyYXBwZXJGdW5jdGlvbjogdHMuRnVuY3Rpb25FeHByZXNzaW9uLCBpbXBvcnRzOiBJbXBvcnRbXSkge1xuICBjb25zdCBnbG9iYWxGYWN0b3J5Q2FsbCA9IGZpbmQod3JhcHBlckZ1bmN0aW9uLmJvZHkuc3RhdGVtZW50c1swXSwgaXNHbG9iYWxGYWN0b3J5Q2FsbCk7XG4gIGlmICghZ2xvYmFsRmFjdG9yeUNhbGwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgaW5qZWN0aW9uUG9pbnQgPSBnbG9iYWxGYWN0b3J5Q2FsbC5hcmd1bWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAvLyBBZGQgZXh0cmEgZGVwZW5kZW5jaWVzIGJlZm9yZSB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgIGdsb2JhbEZhY3RvcnlDYWxsLmFyZ3VtZW50c1swXS5nZXRGdWxsU3RhcnQoKSA6XG4gICAgICAvLyBCYWNrdXAgb25lIGNoYXIgdG8gYWNjb3VudCBmb3IgdGhlIGNsb3NpbmcgcGFyZW50aGVzaXMgb24gdGhlIGNhbGxcbiAgICAgIGdsb2JhbEZhY3RvcnlDYWxsLmdldEVuZCgpIC0gMTtcbiAgY29uc3QgaW1wb3J0U3RyaW5nID0gaW1wb3J0cy5tYXAoaSA9PiBgZ2xvYmFsLiR7Z2V0R2xvYmFsSWRlbnRpZmllcihpKX1gKS5qb2luKCcsJyk7XG4gIG91dHB1dC5hcHBlbmRMZWZ0KFxuICAgICAgaW5qZWN0aW9uUG9pbnQsIGltcG9ydFN0cmluZyArIChnbG9iYWxGYWN0b3J5Q2FsbC5hcmd1bWVudHMubGVuZ3RoID4gMCA/ICcsJyA6ICcnKSk7XG59XG5cbi8qKlxuICogQWRkIGRlcGVuZGVuY3kgcGFyYW1ldGVycyB0byB0aGUgVU1EIGZhY3RvcnkgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIHJlbmRlckZhY3RvcnlQYXJhbWV0ZXJzKFxuICAgIG91dHB1dDogTWFnaWNTdHJpbmcsIHdyYXBwZXJGdW5jdGlvbjogdHMuRnVuY3Rpb25FeHByZXNzaW9uLCBpbXBvcnRzOiBJbXBvcnRbXSkge1xuICBjb25zdCB3cmFwcGVyQ2FsbCA9IHdyYXBwZXJGdW5jdGlvbi5wYXJlbnQgYXMgdHMuQ2FsbEV4cHJlc3Npb247XG4gIGNvbnN0IHNlY29uZEFyZ3VtZW50ID0gd3JhcHBlckNhbGwuYXJndW1lbnRzWzFdO1xuICBpZiAoIXNlY29uZEFyZ3VtZW50KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQmUgcmVzaWxpZW50IHRvIHRoZSBmYWN0b3J5IGJlaW5nIGluc2lkZSBwYXJlbnRoZXNlc1xuICBjb25zdCBmYWN0b3J5RnVuY3Rpb24gPVxuICAgICAgdHMuaXNQYXJlbnRoZXNpemVkRXhwcmVzc2lvbihzZWNvbmRBcmd1bWVudCkgPyBzZWNvbmRBcmd1bWVudC5leHByZXNzaW9uIDogc2Vjb25kQXJndW1lbnQ7XG4gIGlmICghdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24oZmFjdG9yeUZ1bmN0aW9uKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBmYWN0b3J5RnVuY3Rpb24ucGFyYW1ldGVycztcbiAgY29uc3QgcGFyYW1ldGVyU3RyaW5nID0gaW1wb3J0cy5tYXAoaSA9PiBpLnF1YWxpZmllci50ZXh0KS5qb2luKCcsJyk7XG4gIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBpbmplY3Rpb25Qb2ludCA9IHBhcmFtZXRlcnNbMF0uZ2V0RnVsbFN0YXJ0KCk7XG4gICAgb3V0cHV0LmFwcGVuZExlZnQoaW5qZWN0aW9uUG9pbnQsIHBhcmFtZXRlclN0cmluZyArICcsJyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gSWYgdGhlcmUgYXJlIG5vIHBhcmFtZXRlcnMgdGhlbiB0aGUgZmFjdG9yeSBmdW5jdGlvbiB3aWxsIGxvb2sgbGlrZTpcbiAgICAvLyBmdW5jdGlvbiAoKSB7IC4uLiB9XG4gICAgLy8gVGhlIEFTVCBkb2VzIG5vdCBnaXZlIHVzIGEgd2F5IHRvIGZpbmQgdGhlIGluc2VydGlvbiBwb2ludCAtIGJldHdlZW4gdGhlIHR3byBwYXJlbnRoZXNlcy5cbiAgICAvLyBTbyB3ZSBtdXN0IHVzZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBvbiB0aGUgdGV4dCBvZiB0aGUgZnVuY3Rpb24uXG4gICAgY29uc3QgaW5qZWN0aW9uUG9pbnQgPSBmYWN0b3J5RnVuY3Rpb24uZ2V0U3RhcnQoKSArIGZhY3RvcnlGdW5jdGlvbi5nZXRUZXh0KCkuaW5kZXhPZignKCknKSArIDE7XG4gICAgb3V0cHV0LmFwcGVuZExlZnQoaW5qZWN0aW9uUG9pbnQsIHBhcmFtZXRlclN0cmluZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBJcyB0aGlzIG5vZGUgdGhlIENvbW1vbkpTIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gaW4gdGhlIFVNRCB3cmFwcGVyP1xuICovXG5mdW5jdGlvbiBpc0NvbW1vbkpTQ29uZGl0aW9uYWwodmFsdWU6IHRzLk5vZGUpOiB2YWx1ZSBpcyBDb21tb25Kc0NvbmRpdGlvbmFsIHtcbiAgaWYgKCF0cy5pc0NvbmRpdGlvbmFsRXhwcmVzc2lvbih2YWx1ZSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCF0cy5pc0JpbmFyeUV4cHJlc3Npb24odmFsdWUuY29uZGl0aW9uKSB8fFxuICAgICAgdmFsdWUuY29uZGl0aW9uLm9wZXJhdG9yVG9rZW4ua2luZCAhPT0gdHMuU3ludGF4S2luZC5BbXBlcnNhbmRBbXBlcnNhbmRUb2tlbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoIW9uZU9mQmluYXJ5Q29uZGl0aW9ucyh2YWx1ZS5jb25kaXRpb24sIChleHApID0+IGlzVHlwZU9mKGV4cCwgJ2V4cG9ydHMnLCAnbW9kdWxlJykpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICghdHMuaXNDYWxsRXhwcmVzc2lvbih2YWx1ZS53aGVuVHJ1ZSkgfHwgIXRzLmlzSWRlbnRpZmllcih2YWx1ZS53aGVuVHJ1ZS5leHByZXNzaW9uKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdmFsdWUud2hlblRydWUuZXhwcmVzc2lvbi50ZXh0ID09PSAnZmFjdG9yeSc7XG59XG5cbi8qKlxuICogSXMgdGhpcyBub2RlIHRoZSBBTUQgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiBpbiB0aGUgVU1EIHdyYXBwZXI/XG4gKi9cbmZ1bmN0aW9uIGlzQW1kQ29uZGl0aW9uYWwodmFsdWU6IHRzLk5vZGUpOiB2YWx1ZSBpcyBBbWRDb25kaXRpb25hbCB7XG4gIGlmICghdHMuaXNDb25kaXRpb25hbEV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICghdHMuaXNCaW5hcnlFeHByZXNzaW9uKHZhbHVlLmNvbmRpdGlvbikgfHxcbiAgICAgIHZhbHVlLmNvbmRpdGlvbi5vcGVyYXRvclRva2VuLmtpbmQgIT09IHRzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW4pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCFvbmVPZkJpbmFyeUNvbmRpdGlvbnModmFsdWUuY29uZGl0aW9uLCAoZXhwKSA9PiBpc1R5cGVPZihleHAsICdkZWZpbmUnKSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCF0cy5pc0NhbGxFeHByZXNzaW9uKHZhbHVlLndoZW5UcnVlKSB8fCAhdHMuaXNJZGVudGlmaWVyKHZhbHVlLndoZW5UcnVlLmV4cHJlc3Npb24pKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB2YWx1ZS53aGVuVHJ1ZS5leHByZXNzaW9uLnRleHQgPT09ICdkZWZpbmUnO1xufVxuXG4vKipcbiAqIElzIHRoaXMgbm9kZSB0aGUgY2FsbCB0byBzZXR1cCB0aGUgZ2xvYmFsIGRlcGVuZGVuY2llcyBpbiB0aGUgVU1EIHdyYXBwZXI/XG4gKi9cbmZ1bmN0aW9uIGlzR2xvYmFsRmFjdG9yeUNhbGwodmFsdWU6IHRzLk5vZGUpOiB2YWx1ZSBpcyB0cy5DYWxsRXhwcmVzc2lvbiB7XG4gIGlmICh0cy5pc0NhbGxFeHByZXNzaW9uKHZhbHVlKSAmJiAhIXZhbHVlLnBhcmVudCkge1xuICAgIC8vIEJlIHJlc2lsaWVudCB0byB0aGUgdmFsdWUgYmVpbmcgcGFydCBvZiBhIGNvbW1hIGxpc3RcbiAgICB2YWx1ZSA9IGlzQ29tbWFFeHByZXNzaW9uKHZhbHVlLnBhcmVudCkgPyB2YWx1ZS5wYXJlbnQgOiB2YWx1ZTtcbiAgICAvLyBCZSByZXNpbGllbnQgdG8gdGhlIHZhbHVlIGJlaW5nIGluc2lkZSBwYXJlbnRoZXNlc1xuICAgIHZhbHVlID0gdHMuaXNQYXJlbnRoZXNpemVkRXhwcmVzc2lvbih2YWx1ZS5wYXJlbnQpID8gdmFsdWUucGFyZW50IDogdmFsdWU7XG4gICAgcmV0dXJuICEhdmFsdWUucGFyZW50ICYmIHRzLmlzQ29uZGl0aW9uYWxFeHByZXNzaW9uKHZhbHVlLnBhcmVudCkgJiZcbiAgICAgICAgdmFsdWUucGFyZW50LndoZW5GYWxzZSA9PT0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzQ29tbWFFeHByZXNzaW9uKHZhbHVlOiB0cy5Ob2RlKTogdmFsdWUgaXMgdHMuQmluYXJ5RXhwcmVzc2lvbiB7XG4gIHJldHVybiB0cy5pc0JpbmFyeUV4cHJlc3Npb24odmFsdWUpICYmIHZhbHVlLm9wZXJhdG9yVG9rZW4ua2luZCA9PT0gdHMuU3ludGF4S2luZC5Db21tYVRva2VuO1xufVxuXG4vKipcbiAqIENvbXB1dGUgYSBnbG9iYWwgaWRlbnRpZmllciBmb3IgdGhlIGdpdmVuIGltcG9ydCAoYGlgKS5cbiAqXG4gKiBUaGUgaWRlbnRpZmllciB1c2VkIHRvIGFjY2VzcyBhIHBhY2thZ2Ugd2hlbiB1c2luZyB0aGUgXCJnbG9iYWxcIiBmb3JtIG9mIGEgVU1EIGJ1bmRsZSB1c3VhbGx5XG4gKiBmb2xsb3dzIGEgc3BlY2lhbCBmb3JtYXQgd2hlcmUgc25ha2UtY2FzZSBpcyBjb252ZXRlZCB0byBjYW1lbENhc2UgYW5kIHBhdGggc2VwYXJhdG9ycyBhcmVcbiAqIGNvbnZlcnRlZCB0byBkb3RzLiBJbiBhZGRpdGlvbiB0aGVyZSBhcmUgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIGBAYW5ndWxhcmAgaXMgbWFwcGVkIHRvIGBuZ2AuXG4gKlxuICogRm9yIGV4YW1wbGVcbiAqXG4gKiAqIGBAbnMvcGFja2FnZS9lbnRyeS1wb2ludGAgPT4gYG5zLnBhY2thZ2UuZW50cnlQb2ludGBcbiAqICogYEBhbmd1bGFyL2NvbW1vbi90ZXN0aW5nYCA9PiBgbmcuY29tbW9uLnRlc3RpbmdgXG4gKiAqIGBAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyLWR5bmFtaWNgID0+IGBuZy5wbGF0Zm9ybUJyb3dzZXJEeW5hbWljYFxuICpcbiAqIEl0IGlzIHBvc3NpYmxlIGZvciBwYWNrYWdlcyB0byBzcGVjaWZ5IGNvbXBsZXRlbHkgZGlmZmVyZW50IGlkZW50aWZpZXJzIGZvciBhdHRhY2hpbmcgdGhlIHBhY2thZ2VcbiAqIHRvIHRoZSBnbG9iYWwsIGFuZCBzbyB0aGVyZSBpcyBubyBndWFyYW50ZWVkIHdheSB0byBjb21wdXRlIHRoaXMuXG4gKiBDdXJyZW50bHksIHRoaXMgYXBwcm9hY2ggYXBwZWFycyB0byB3b3JrIGZvciB0aGUga25vd24gc2NlbmFyaW9zOyBhbHNvIGl0IGlzIG5vdCBrbm93biBob3cgY29tbW9uXG4gKiBpdCBpcyB0byB1c2UgZ2xvYmFscyBmb3IgaW1wb3J0aW5nIHBhY2thZ2VzLlxuICpcbiAqIElmIGl0IHR1cm5zIG91dCB0aGF0IHRoZXJlIGFyZSBwYWNrYWdlcyB0aGF0IGFyZSBiZWluZyB1c2VkIHZpYSBnbG9iYWxzLCB3aGVyZSB0aGlzIGFwcHJvYWNoXG4gKiBmYWlscywgd2Ugc2hvdWxkIGNvbnNpZGVyIGltcGxlbWVudGluZyBhIGNvbmZpZ3VyYXRpb24gYmFzZWQgc29sdXRpb24sIHNpbWlsYXIgdG8gd2hhdCB3b3VsZCBnb1xuICogaW4gYSByb2xsdXAgY29uZmlndXJhdGlvbiBmb3IgbWFwcGluZyBpbXBvcnQgcGF0aHMgdG8gZ2xvYmFsIGluZGVudGlmaWVycy5cbiAqL1xuZnVuY3Rpb24gZ2V0R2xvYmFsSWRlbnRpZmllcihpOiBJbXBvcnQpOiBzdHJpbmcge1xuICByZXR1cm4gaS5zcGVjaWZpZXIucmVwbGFjZSgvXkBhbmd1bGFyXFwvLywgJ25nLicpXG4gICAgICAucmVwbGFjZSgvXkAvLCAnJylcbiAgICAgIC5yZXBsYWNlKC9cXC8vZywgJy4nKVxuICAgICAgLnJlcGxhY2UoL1stX10rKC4/KS9nLCAoXywgYykgPT4gYy50b1VwcGVyQ2FzZSgpKVxuICAgICAgLnJlcGxhY2UoL14uLywgYyA9PiBjLnRvTG93ZXJDYXNlKCkpO1xufVxuXG5mdW5jdGlvbiBmaW5kPFQ+KG5vZGU6IHRzLk5vZGUsIHRlc3Q6IChub2RlOiB0cy5Ob2RlKSA9PiBub2RlIGlzIHRzLk5vZGUgJiBUKTogVHx1bmRlZmluZWQge1xuICByZXR1cm4gdGVzdChub2RlKSA/IG5vZGUgOiBub2RlLmZvckVhY2hDaGlsZChjaGlsZCA9PiBmaW5kPFQ+KGNoaWxkLCB0ZXN0KSk7XG59XG5cbmZ1bmN0aW9uIG9uZU9mQmluYXJ5Q29uZGl0aW9ucyhcbiAgICBub2RlOiB0cy5CaW5hcnlFeHByZXNzaW9uLCB0ZXN0OiAoZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbikgPT4gYm9vbGVhbikge1xuICByZXR1cm4gdGVzdChub2RlLmxlZnQpIHx8IHRlc3Qobm9kZS5yaWdodCk7XG59XG5cbmZ1bmN0aW9uIGlzVHlwZU9mKG5vZGU6IHRzLkV4cHJlc3Npb24sIC4uLnR5cGVzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHMuaXNCaW5hcnlFeHByZXNzaW9uKG5vZGUpICYmIHRzLmlzVHlwZU9mRXhwcmVzc2lvbihub2RlLmxlZnQpICYmXG4gICAgICB0cy5pc0lkZW50aWZpZXIobm9kZS5sZWZ0LmV4cHJlc3Npb24pICYmIHR5cGVzLmluZGV4T2Yobm9kZS5sZWZ0LmV4cHJlc3Npb24udGV4dCkgIT09IC0xO1xufVxuIl19