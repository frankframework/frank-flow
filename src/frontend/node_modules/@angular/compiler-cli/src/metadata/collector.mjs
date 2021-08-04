/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { errorSymbol, Evaluator, recordMapEntry } from './evaluator';
import { isClassMetadata, isConstructorMetadata, isFunctionMetadata, isMetadataError, isMetadataGlobalReferenceExpression, isMetadataSymbolicExpression, isMetadataSymbolicReferenceExpression, isMetadataSymbolicSelectExpression, isMethodMetadata, METADATA_VERSION } from './schema';
import { Symbols } from './symbols';
const isStatic = (node) => ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static;
/**
 * Collect decorator metadata from a TypeScript module.
 */
export class MetadataCollector {
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Returns a JSON.stringify friendly form describing the decorators of the exported classes from
     * the source file that is expected to correspond to a module.
     */
    getMetadata(sourceFile, strict = false, substituteExpression) {
        const locals = new Symbols(sourceFile);
        const nodeMap = new Map();
        const composedSubstituter = substituteExpression && this.options.substituteExpression ?
            (value, node) => this.options.substituteExpression(substituteExpression(value, node), node) :
            substituteExpression;
        const evaluatorOptions = substituteExpression ? Object.assign(Object.assign({}, this.options), { substituteExpression: composedSubstituter }) :
            this.options;
        let metadata;
        const evaluator = new Evaluator(locals, nodeMap, evaluatorOptions, (name, value) => {
            if (!metadata)
                metadata = {};
            metadata[name] = value;
        });
        let exports = undefined;
        function objFromDecorator(decoratorNode) {
            return evaluator.evaluateNode(decoratorNode.expression);
        }
        function recordEntry(entry, node) {
            if (composedSubstituter) {
                entry = composedSubstituter(entry, node);
            }
            return recordMapEntry(entry, node, nodeMap, sourceFile);
        }
        function errorSym(message, node, context) {
            return errorSymbol(message, node, context, sourceFile);
        }
        function maybeGetSimpleFunction(functionDeclaration) {
            if (functionDeclaration.name && functionDeclaration.name.kind == ts.SyntaxKind.Identifier) {
                const nameNode = functionDeclaration.name;
                const functionName = nameNode.text;
                const functionBody = functionDeclaration.body;
                if (functionBody && functionBody.statements.length == 1) {
                    const statement = functionBody.statements[0];
                    if (statement.kind === ts.SyntaxKind.ReturnStatement) {
                        const returnStatement = statement;
                        if (returnStatement.expression) {
                            const func = {
                                __symbolic: 'function',
                                parameters: namesOf(functionDeclaration.parameters),
                                value: evaluator.evaluateNode(returnStatement.expression)
                            };
                            if (functionDeclaration.parameters.some(p => p.initializer != null)) {
                                func.defaults = functionDeclaration.parameters.map(p => p.initializer && evaluator.evaluateNode(p.initializer));
                            }
                            return recordEntry({ func, name: functionName }, functionDeclaration);
                        }
                    }
                }
            }
        }
        function classMetadataOf(classDeclaration) {
            const result = { __symbolic: 'class' };
            function getDecorators(decorators) {
                if (decorators && decorators.length)
                    return decorators.map(decorator => objFromDecorator(decorator));
                return undefined;
            }
            function referenceFrom(node) {
                const result = evaluator.evaluateNode(node);
                if (isMetadataError(result) || isMetadataSymbolicReferenceExpression(result) ||
                    isMetadataSymbolicSelectExpression(result)) {
                    return result;
                }
                else {
                    return errorSym('Symbol reference expected', node);
                }
            }
            // Add class parents
            if (classDeclaration.heritageClauses) {
                classDeclaration.heritageClauses.forEach((hc) => {
                    if (hc.token === ts.SyntaxKind.ExtendsKeyword && hc.types) {
                        hc.types.forEach(type => result.extends = referenceFrom(type.expression));
                    }
                });
            }
            // Add arity if the type is generic
            const typeParameters = classDeclaration.typeParameters;
            if (typeParameters && typeParameters.length) {
                result.arity = typeParameters.length;
            }
            // Add class decorators
            if (classDeclaration.decorators) {
                result.decorators = getDecorators(classDeclaration.decorators);
            }
            // member decorators
            let members = null;
            function recordMember(name, metadata) {
                if (!members)
                    members = {};
                const data = members.hasOwnProperty(name) ? members[name] : [];
                data.push(metadata);
                members[name] = data;
            }
            // static member
            let statics = null;
            function recordStaticMember(name, value) {
                if (!statics)
                    statics = {};
                statics[name] = value;
            }
            for (const member of classDeclaration.members) {
                let isConstructor = false;
                switch (member.kind) {
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.MethodDeclaration:
                        isConstructor = member.kind === ts.SyntaxKind.Constructor;
                        const method = member;
                        if (isStatic(method)) {
                            const maybeFunc = maybeGetSimpleFunction(method);
                            if (maybeFunc) {
                                recordStaticMember(maybeFunc.name, maybeFunc.func);
                            }
                            continue;
                        }
                        const methodDecorators = getDecorators(method.decorators);
                        const parameters = method.parameters;
                        const parameterDecoratorData = [];
                        const parametersData = [];
                        let hasDecoratorData = false;
                        let hasParameterData = false;
                        for (const parameter of parameters) {
                            const parameterData = getDecorators(parameter.decorators);
                            parameterDecoratorData.push(parameterData);
                            hasDecoratorData = hasDecoratorData || !!parameterData;
                            if (isConstructor) {
                                if (parameter.type) {
                                    parametersData.push(referenceFrom(parameter.type));
                                }
                                else {
                                    parametersData.push(null);
                                }
                                hasParameterData = true;
                            }
                        }
                        const data = { __symbolic: isConstructor ? 'constructor' : 'method' };
                        const name = isConstructor ? '__ctor__' : evaluator.nameOf(member.name);
                        if (methodDecorators) {
                            data.decorators = methodDecorators;
                        }
                        if (hasDecoratorData) {
                            data.parameterDecorators = parameterDecoratorData;
                        }
                        if (hasParameterData) {
                            data.parameters = parametersData;
                        }
                        if (!isMetadataError(name)) {
                            recordMember(name, data);
                        }
                        break;
                    case ts.SyntaxKind.PropertyDeclaration:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        const property = member;
                        if (isStatic(property)) {
                            const name = evaluator.nameOf(property.name);
                            if (!isMetadataError(name) && !shouldIgnoreStaticMember(name)) {
                                if (property.initializer) {
                                    const value = evaluator.evaluateNode(property.initializer);
                                    recordStaticMember(name, value);
                                }
                                else {
                                    recordStaticMember(name, errorSym('Variable not initialized', property.name));
                                }
                            }
                        }
                        const propertyDecorators = getDecorators(property.decorators);
                        if (propertyDecorators) {
                            const name = evaluator.nameOf(property.name);
                            if (!isMetadataError(name)) {
                                recordMember(name, { __symbolic: 'property', decorators: propertyDecorators });
                            }
                        }
                        break;
                }
            }
            if (members) {
                result.members = members;
            }
            if (statics) {
                result.statics = statics;
            }
            return recordEntry(result, classDeclaration);
        }
        // Collect all exported symbols from an exports clause.
        const exportMap = new Map();
        ts.forEachChild(sourceFile, node => {
            switch (node.kind) {
                case ts.SyntaxKind.ExportDeclaration:
                    const exportDeclaration = node;
                    const { moduleSpecifier, exportClause } = exportDeclaration;
                    if (!moduleSpecifier && exportClause && ts.isNamedExports(exportClause)) {
                        // If there is a module specifier there is also an exportClause
                        exportClause.elements.forEach(spec => {
                            const exportedAs = spec.name.text;
                            const name = (spec.propertyName || spec.name).text;
                            exportMap.set(name, exportedAs);
                        });
                    }
            }
        });
        const isExport = (node) => sourceFile.isDeclarationFile ||
            ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
        const isExportedIdentifier = (identifier) => identifier && exportMap.has(identifier.text);
        const isExported = (node) => isExport(node) || isExportedIdentifier(node.name);
        const exportedIdentifierName = (identifier) => identifier && (exportMap.get(identifier.text) || identifier.text);
        const exportedName = (node) => exportedIdentifierName(node.name);
        // Pre-declare classes and functions
        ts.forEachChild(sourceFile, node => {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                    const classDeclaration = node;
                    if (classDeclaration.name) {
                        const className = classDeclaration.name.text;
                        if (isExported(classDeclaration)) {
                            locals.define(className, { __symbolic: 'reference', name: exportedName(classDeclaration) });
                        }
                        else {
                            locals.define(className, errorSym('Reference to non-exported class', node, { className }));
                        }
                    }
                    break;
                case ts.SyntaxKind.InterfaceDeclaration:
                    const interfaceDeclaration = node;
                    if (interfaceDeclaration.name) {
                        const interfaceName = interfaceDeclaration.name.text;
                        // All references to interfaces should be converted to references to `any`.
                        locals.define(interfaceName, { __symbolic: 'reference', name: 'any' });
                    }
                    break;
                case ts.SyntaxKind.FunctionDeclaration:
                    const functionDeclaration = node;
                    if (!isExported(functionDeclaration)) {
                        // Report references to this function as an error.
                        const nameNode = functionDeclaration.name;
                        if (nameNode && nameNode.text) {
                            locals.define(nameNode.text, errorSym('Reference to a non-exported function', nameNode, { name: nameNode.text }));
                        }
                    }
                    break;
            }
        });
        ts.forEachChild(sourceFile, node => {
            switch (node.kind) {
                case ts.SyntaxKind.ExportDeclaration:
                    // Record export declarations
                    const exportDeclaration = node;
                    const { moduleSpecifier, exportClause } = exportDeclaration;
                    if (!moduleSpecifier) {
                        // no module specifier -> export {propName as name};
                        if (exportClause && ts.isNamedExports(exportClause)) {
                            exportClause.elements.forEach(spec => {
                                const name = spec.name.text;
                                // If the symbol was not already exported, export a reference since it is a
                                // reference to an import
                                if (!metadata || !metadata[name]) {
                                    const propNode = spec.propertyName || spec.name;
                                    const value = evaluator.evaluateNode(propNode);
                                    if (!metadata)
                                        metadata = {};
                                    metadata[name] = recordEntry(value, node);
                                }
                            });
                        }
                    }
                    if (moduleSpecifier && moduleSpecifier.kind == ts.SyntaxKind.StringLiteral) {
                        // Ignore exports that don't have string literals as exports.
                        // This is allowed by the syntax but will be flagged as an error by the type checker.
                        const from = moduleSpecifier.text;
                        const moduleExport = { from };
                        if (exportClause && ts.isNamedExports(exportClause)) {
                            moduleExport.export = exportClause.elements.map(spec => spec.propertyName ? { name: spec.propertyName.text, as: spec.name.text } :
                                spec.name.text);
                        }
                        if (!exports)
                            exports = [];
                        exports.push(moduleExport);
                    }
                    break;
                case ts.SyntaxKind.ClassDeclaration:
                    const classDeclaration = node;
                    if (classDeclaration.name) {
                        if (isExported(classDeclaration)) {
                            const name = exportedName(classDeclaration);
                            if (name) {
                                if (!metadata)
                                    metadata = {};
                                metadata[name] = classMetadataOf(classDeclaration);
                            }
                        }
                    }
                    // Otherwise don't record metadata for the class.
                    break;
                case ts.SyntaxKind.TypeAliasDeclaration:
                    const typeDeclaration = node;
                    if (typeDeclaration.name && isExported(typeDeclaration)) {
                        const name = exportedName(typeDeclaration);
                        if (name) {
                            if (!metadata)
                                metadata = {};
                            metadata[name] = { __symbolic: 'interface' };
                        }
                    }
                    break;
                case ts.SyntaxKind.InterfaceDeclaration:
                    const interfaceDeclaration = node;
                    if (interfaceDeclaration.name && isExported(interfaceDeclaration)) {
                        const name = exportedName(interfaceDeclaration);
                        if (name) {
                            if (!metadata)
                                metadata = {};
                            metadata[name] = { __symbolic: 'interface' };
                        }
                    }
                    break;
                case ts.SyntaxKind.FunctionDeclaration:
                    // Record functions that return a single value. Record the parameter
                    // names substitution will be performed by the StaticReflector.
                    const functionDeclaration = node;
                    if (isExported(functionDeclaration) && functionDeclaration.name) {
                        const name = exportedName(functionDeclaration);
                        const maybeFunc = maybeGetSimpleFunction(functionDeclaration);
                        if (name) {
                            if (!metadata)
                                metadata = {};
                            // TODO(alxhub): The literal here is not valid FunctionMetadata.
                            metadata[name] =
                                maybeFunc ? recordEntry(maybeFunc.func, node) : { __symbolic: 'function' };
                        }
                    }
                    break;
                case ts.SyntaxKind.EnumDeclaration:
                    const enumDeclaration = node;
                    if (isExported(enumDeclaration)) {
                        const enumValueHolder = {};
                        const enumName = exportedName(enumDeclaration);
                        let nextDefaultValue = 0;
                        let writtenMembers = 0;
                        for (const member of enumDeclaration.members) {
                            let enumValue;
                            if (!member.initializer) {
                                enumValue = nextDefaultValue;
                            }
                            else {
                                enumValue = evaluator.evaluateNode(member.initializer);
                            }
                            let name = undefined;
                            if (member.name.kind == ts.SyntaxKind.Identifier) {
                                const identifier = member.name;
                                name = identifier.text;
                                enumValueHolder[name] = enumValue;
                                writtenMembers++;
                            }
                            if (typeof enumValue === 'number') {
                                nextDefaultValue = enumValue + 1;
                            }
                            else if (name) {
                                // TODO(alxhub): 'left' here has a name propery which is not valid for
                                // MetadataSymbolicSelectExpression.
                                nextDefaultValue = {
                                    __symbolic: 'binary',
                                    operator: '+',
                                    left: {
                                        __symbolic: 'select',
                                        expression: recordEntry({ __symbolic: 'reference', name: enumName }, node),
                                        name
                                    },
                                };
                            }
                            else {
                                nextDefaultValue =
                                    recordEntry(errorSym('Unsupported enum member name', member.name), node);
                            }
                        }
                        if (writtenMembers) {
                            if (enumName) {
                                if (!metadata)
                                    metadata = {};
                                metadata[enumName] = recordEntry(enumValueHolder, node);
                            }
                        }
                    }
                    break;
                case ts.SyntaxKind.VariableStatement:
                    const variableStatement = node;
                    for (const variableDeclaration of variableStatement.declarationList.declarations) {
                        if (variableDeclaration.name.kind == ts.SyntaxKind.Identifier) {
                            const nameNode = variableDeclaration.name;
                            let varValue;
                            if (variableDeclaration.initializer) {
                                varValue = evaluator.evaluateNode(variableDeclaration.initializer);
                            }
                            else {
                                varValue = recordEntry(errorSym('Variable not initialized', nameNode), nameNode);
                            }
                            let exported = false;
                            if (isExport(variableStatement) || isExport(variableDeclaration) ||
                                isExportedIdentifier(nameNode)) {
                                const name = exportedIdentifierName(nameNode);
                                if (name) {
                                    if (!metadata)
                                        metadata = {};
                                    metadata[name] = recordEntry(varValue, node);
                                }
                                exported = true;
                            }
                            if (typeof varValue == 'string' || typeof varValue == 'number' ||
                                typeof varValue == 'boolean') {
                                locals.define(nameNode.text, varValue);
                                if (exported) {
                                    locals.defineReference(nameNode.text, { __symbolic: 'reference', name: nameNode.text });
                                }
                            }
                            else if (!exported) {
                                if (varValue && !isMetadataError(varValue)) {
                                    locals.define(nameNode.text, recordEntry(varValue, node));
                                }
                                else {
                                    locals.define(nameNode.text, recordEntry(errorSym('Reference to a local symbol', nameNode, { name: nameNode.text }), node));
                                }
                            }
                        }
                        else {
                            // Destructuring (or binding) declarations are not supported,
                            // var {<identifier>[, <identifier>]+} = <expression>;
                            //   or
                            // var [<identifier>[, <identifier}+] = <expression>;
                            // are not supported.
                            const report = (nameNode) => {
                                switch (nameNode.kind) {
                                    case ts.SyntaxKind.Identifier:
                                        const name = nameNode;
                                        const varValue = errorSym('Destructuring not supported', name);
                                        locals.define(name.text, varValue);
                                        if (isExport(node)) {
                                            if (!metadata)
                                                metadata = {};
                                            metadata[name.text] = varValue;
                                        }
                                        break;
                                    case ts.SyntaxKind.BindingElement:
                                        const bindingElement = nameNode;
                                        report(bindingElement.name);
                                        break;
                                    case ts.SyntaxKind.ObjectBindingPattern:
                                    case ts.SyntaxKind.ArrayBindingPattern:
                                        const bindings = nameNode;
                                        bindings.elements.forEach(report);
                                        break;
                                }
                            };
                            report(variableDeclaration.name);
                        }
                    }
                    break;
            }
        });
        if (metadata || exports) {
            if (!metadata)
                metadata = {};
            else if (strict) {
                validateMetadata(sourceFile, nodeMap, metadata);
            }
            const result = {
                __symbolic: 'module',
                version: this.options.version || METADATA_VERSION,
                metadata
            };
            if (sourceFile.moduleName)
                result.importAs = sourceFile.moduleName;
            if (exports)
                result.exports = exports;
            return result;
        }
    }
}
// This will throw if the metadata entry given contains an error node.
function validateMetadata(sourceFile, nodeMap, metadata) {
    let locals = new Set(['Array', 'Object', 'Set', 'Map', 'string', 'number', 'any']);
    function validateExpression(expression) {
        if (!expression) {
            return;
        }
        else if (Array.isArray(expression)) {
            expression.forEach(validateExpression);
        }
        else if (typeof expression === 'object' && !expression.hasOwnProperty('__symbolic')) {
            Object.getOwnPropertyNames(expression).forEach(v => validateExpression(expression[v]));
        }
        else if (isMetadataError(expression)) {
            reportError(expression);
        }
        else if (isMetadataGlobalReferenceExpression(expression)) {
            if (!locals.has(expression.name)) {
                const reference = metadata[expression.name];
                if (reference) {
                    validateExpression(reference);
                }
            }
        }
        else if (isFunctionMetadata(expression)) {
            validateFunction(expression);
        }
        else if (isMetadataSymbolicExpression(expression)) {
            switch (expression.__symbolic) {
                case 'binary':
                    const binaryExpression = expression;
                    validateExpression(binaryExpression.left);
                    validateExpression(binaryExpression.right);
                    break;
                case 'call':
                case 'new':
                    const callExpression = expression;
                    validateExpression(callExpression.expression);
                    if (callExpression.arguments)
                        callExpression.arguments.forEach(validateExpression);
                    break;
                case 'index':
                    const indexExpression = expression;
                    validateExpression(indexExpression.expression);
                    validateExpression(indexExpression.index);
                    break;
                case 'pre':
                    const prefixExpression = expression;
                    validateExpression(prefixExpression.operand);
                    break;
                case 'select':
                    const selectExpression = expression;
                    validateExpression(selectExpression.expression);
                    break;
                case 'spread':
                    const spreadExpression = expression;
                    validateExpression(spreadExpression.expression);
                    break;
                case 'if':
                    const ifExpression = expression;
                    validateExpression(ifExpression.condition);
                    validateExpression(ifExpression.elseExpression);
                    validateExpression(ifExpression.thenExpression);
                    break;
            }
        }
    }
    function validateMember(classData, member) {
        if (member.decorators) {
            member.decorators.forEach(validateExpression);
        }
        if (isMethodMetadata(member) && member.parameterDecorators) {
            member.parameterDecorators.forEach(validateExpression);
        }
        // Only validate parameters of classes for which we know that are used with our DI
        if (classData.decorators && isConstructorMetadata(member) && member.parameters) {
            member.parameters.forEach(validateExpression);
        }
    }
    function validateClass(classData) {
        if (classData.decorators) {
            classData.decorators.forEach(validateExpression);
        }
        if (classData.members) {
            Object.getOwnPropertyNames(classData.members)
                .forEach(name => classData.members[name].forEach((m) => validateMember(classData, m)));
        }
        if (classData.statics) {
            Object.getOwnPropertyNames(classData.statics).forEach(name => {
                const staticMember = classData.statics[name];
                if (isFunctionMetadata(staticMember)) {
                    validateExpression(staticMember.value);
                }
                else {
                    validateExpression(staticMember);
                }
            });
        }
    }
    function validateFunction(functionDeclaration) {
        if (functionDeclaration.value) {
            const oldLocals = locals;
            if (functionDeclaration.parameters) {
                locals = new Set(oldLocals.values());
                if (functionDeclaration.parameters)
                    functionDeclaration.parameters.forEach(n => locals.add(n));
            }
            validateExpression(functionDeclaration.value);
            locals = oldLocals;
        }
    }
    function shouldReportNode(node) {
        if (node) {
            const nodeStart = node.getStart();
            return !(node.pos != nodeStart &&
                sourceFile.text.substring(node.pos, nodeStart).indexOf('@dynamic') >= 0);
        }
        return true;
    }
    function reportError(error) {
        const node = nodeMap.get(error);
        if (shouldReportNode(node)) {
            const lineInfo = error.line != undefined ? error.character != undefined ?
                `:${error.line + 1}:${error.character + 1}` :
                `:${error.line + 1}` :
                '';
            throw new Error(`${sourceFile.fileName}${lineInfo}: Metadata collected contains an error that will be reported at runtime: ${expandedMessage(error)}.\n  ${JSON.stringify(error)}`);
        }
    }
    Object.getOwnPropertyNames(metadata).forEach(name => {
        const entry = metadata[name];
        try {
            if (isClassMetadata(entry)) {
                validateClass(entry);
            }
        }
        catch (e) {
            const node = nodeMap.get(entry);
            if (shouldReportNode(node)) {
                if (node) {
                    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    throw new Error(`${sourceFile.fileName}:${line + 1}:${character + 1}: Error encountered in metadata generated for exported symbol '${name}': \n ${e.message}`);
                }
                throw new Error(`Error encountered in metadata generated for exported symbol ${name}: \n ${e.message}`);
            }
        }
    });
}
// Collect parameter names from a function.
function namesOf(parameters) {
    const result = [];
    function addNamesOf(name) {
        if (name.kind == ts.SyntaxKind.Identifier) {
            const identifier = name;
            result.push(identifier.text);
        }
        else {
            const bindingPattern = name;
            for (const element of bindingPattern.elements) {
                const name = element.name;
                if (name) {
                    addNamesOf(name);
                }
            }
        }
    }
    for (const parameter of parameters) {
        addNamesOf(parameter.name);
    }
    return result;
}
function shouldIgnoreStaticMember(memberName) {
    return memberName.startsWith('ngAcceptInputType_') || memberName.startsWith('ngTemplateGuard_');
}
function expandedMessage(error) {
    switch (error.message) {
        case 'Reference to non-exported class':
            if (error.context && error.context.className) {
                return `Reference to a non-exported class ${error.context.className}. Consider exporting the class`;
            }
            break;
        case 'Variable not initialized':
            return 'Only initialized variables and constants can be referenced because the value of this variable is needed by the template compiler';
        case 'Destructuring not supported':
            return 'Referencing an exported destructured variable or constant is not supported by the template compiler. Consider simplifying this to avoid destructuring';
        case 'Could not resolve type':
            if (error.context && error.context.typeName) {
                return `Could not resolve type ${error.context.typeName}`;
            }
            break;
        case 'Function call not supported':
            let prefix = error.context && error.context.name ? `Calling function '${error.context.name}', f` : 'F';
            return prefix +
                'unction calls are not supported. Consider replacing the function or lambda with a reference to an exported function';
        case 'Reference to a local symbol':
            if (error.context && error.context.name) {
                return `Reference to a local (non-exported) symbol '${error.context.name}'. Consider exporting the symbol`;
            }
    }
    return error.message;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9tZXRhZGF0YS9jb2xsZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ25FLE9BQU8sRUFBMEUsZUFBZSxFQUFFLHFCQUFxQixFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBRSxtQ0FBbUMsRUFBaUYsNEJBQTRCLEVBQUUscUNBQXFDLEVBQUUsa0NBQWtDLEVBQUUsZ0JBQWdCLEVBQWtCLGdCQUFnQixFQUF5WixNQUFNLFVBQVUsQ0FBQztBQUN2MUIsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUVsQyxNQUFNLFFBQVEsR0FBRyxDQUFDLElBQW9CLEVBQUUsRUFBRSxDQUN0QyxFQUFFLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7QUE0QmhFOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGlCQUFpQjtJQUM1QixZQUFvQixVQUE0QixFQUFFO1FBQTlCLFlBQU8sR0FBUCxPQUFPLENBQXVCO0lBQUcsQ0FBQztJQUV0RDs7O09BR0c7SUFDSSxXQUFXLENBQ2QsVUFBeUIsRUFBRSxTQUFrQixLQUFLLEVBQ2xELG9CQUE2RTtRQUUvRSxNQUFNLE1BQU0sR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN2QyxNQUFNLE9BQU8sR0FDVCxJQUFJLEdBQUcsRUFBMkUsQ0FBQztRQUN2RixNQUFNLG1CQUFtQixHQUFHLG9CQUFvQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZ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Z2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7ZXJyb3JTeW1ib2wsIEV2YWx1YXRvciwgcmVjb3JkTWFwRW50cnl9IGZyb20gJy4vZXZhbHVhdG9yJztcbmltcG9ydCB7Q2xhc3NNZXRhZGF0YSwgQ29uc3RydWN0b3JNZXRhZGF0YSwgRnVuY3Rpb25NZXRhZGF0YSwgSW50ZXJmYWNlTWV0YWRhdGEsIGlzQ2xhc3NNZXRhZGF0YSwgaXNDb25zdHJ1Y3Rvck1ldGFkYXRhLCBpc0Z1bmN0aW9uTWV0YWRhdGEsIGlzTWV0YWRhdGFFcnJvciwgaXNNZXRhZGF0YUdsb2JhbFJlZmVyZW5jZUV4cHJlc3Npb24sIGlzTWV0YWRhdGFJbXBvcnREZWZhdWx0UmVmZXJlbmNlLCBpc01ldGFkYXRhSW1wb3J0ZWRTeW1ib2xSZWZlcmVuY2VFeHByZXNzaW9uLCBpc01ldGFkYXRhU3ltYm9saWNFeHByZXNzaW9uLCBpc01ldGFkYXRhU3ltYm9saWNSZWZlcmVuY2VFeHByZXNzaW9uLCBpc01ldGFkYXRhU3ltYm9saWNTZWxlY3RFeHByZXNzaW9uLCBpc01ldGhvZE1ldGFkYXRhLCBNZW1iZXJNZXRhZGF0YSwgTUVUQURBVEFfVkVSU0lPTiwgTWV0YWRhdGFFbnRyeSwgTWV0YWRhdGFFcnJvciwgTWV0YWRhdGFNYXAsIE1ldGFkYXRhU3ltYm9saWNCaW5hcnlFeHByZXNzaW9uLCBNZXRhZGF0YVN5bWJvbGljQ2FsbEV4cHJlc3Npb24sIE1ldGFkYXRhU3ltYm9saWNFeHByZXNzaW9uLCBNZXRhZGF0YVN5bWJvbGljSWZFeHByZXNzaW9uLCBNZXRhZGF0YVN5bWJvbGljSW5kZXhFeHByZXNzaW9uLCBNZXRhZGF0YVN5bWJvbGljUHJlZml4RXhwcmVzc2lvbiwgTWV0YWRhdGFTeW1ib2xpY1JlZmVyZW5jZUV4cHJlc3Npb24sIE1ldGFkYXRhU3ltYm9saWNTZWxlY3RFeHByZXNzaW9uLCBNZXRhZGF0YVN5bWJvbGljU3ByZWFkRXhwcmVzc2lvbiwgTWV0YWRhdGFWYWx1ZSwgTWV0aG9kTWV0YWRhdGEsIE1vZHVsZUV4cG9ydE1ldGFkYXRhLCBNb2R1bGVNZXRhZGF0YX0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHtTeW1ib2xzfSBmcm9tICcuL3N5bWJvbHMnO1xuXG5jb25zdCBpc1N0YXRpYyA9IChub2RlOiB0cy5EZWNsYXJhdGlvbikgPT5cbiAgICB0cy5nZXRDb21iaW5lZE1vZGlmaWVyRmxhZ3Mobm9kZSkgJiB0cy5Nb2RpZmllckZsYWdzLlN0YXRpYztcblxuLyoqXG4gKiBBIHNldCBvZiBjb2xsZWN0b3Igb3B0aW9ucyB0byB1c2Ugd2hlbiBjb2xsZWN0aW5nIG1ldGFkYXRhLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbGxlY3Rvck9wdGlvbnMge1xuICAvKipcbiAgICogVmVyc2lvbiBvZiB0aGUgbWV0YWRhdGEgdG8gY29sbGVjdC5cbiAgICovXG4gIHZlcnNpb24/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIENvbGxlY3QgYSBoaWRkZW4gZmllbGQgXCIkcXVvdGVkJFwiIGluIG9iamVjdHMgbGl0ZXJhbHMgdGhhdCByZWNvcmQgd2hlbiB0aGUga2V5IHdhcyBxdW90ZWQgaW5cbiAgICogdGhlIHNvdXJjZS5cbiAgICovXG4gIHF1b3RlZE5hbWVzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRG8gbm90IHNpbXBsaWZ5IGludmFsaWQgZXhwcmVzc2lvbnMuXG4gICAqL1xuICB2ZXJib3NlSW52YWxpZEV4cHJlc3Npb24/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHN1YnN0aXR1dGlvbiBjYWxsYmFjay5cbiAgICovXG4gIHN1YnN0aXR1dGVFeHByZXNzaW9uPzogKHZhbHVlOiBNZXRhZGF0YVZhbHVlLCBub2RlOiB0cy5Ob2RlKSA9PiBNZXRhZGF0YVZhbHVlO1xufVxuXG4vKipcbiAqIENvbGxlY3QgZGVjb3JhdG9yIG1ldGFkYXRhIGZyb20gYSBUeXBlU2NyaXB0IG1vZHVsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1ldGFkYXRhQ29sbGVjdG9yIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBDb2xsZWN0b3JPcHRpb25zID0ge30pIHt9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBKU09OLnN0cmluZ2lmeSBmcmllbmRseSBmb3JtIGRlc2NyaWJpbmcgdGhlIGRlY29yYXRvcnMgb2YgdGhlIGV4cG9ydGVkIGNsYXNzZXMgZnJvbVxuICAgKiB0aGUgc291cmNlIGZpbGUgdGhhdCBpcyBleHBlY3RlZCB0byBjb3JyZXNwb25kIHRvIGEgbW9kdWxlLlxuICAgKi9cbiAgcHVibGljIGdldE1ldGFkYXRhKFxuICAgICAgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgc3RyaWN0OiBib29sZWFuID0gZmFsc2UsXG4gICAgICBzdWJzdGl0dXRlRXhwcmVzc2lvbj86ICh2YWx1ZTogTWV0YWRhdGFWYWx1ZSwgbm9kZTogdHMuTm9kZSkgPT4gTWV0YWRhdGFWYWx1ZSk6IE1vZHVsZU1ldGFkYXRhXG4gICAgICB8dW5kZWZpbmVkIHtcbiAgICBjb25zdCBsb2NhbHMgPSBuZXcgU3ltYm9scyhzb3VyY2VGaWxlKTtcbiAgICBjb25zdCBub2RlTWFwID1cbiAgICAgICAgbmV3IE1hcDxNZXRhZGF0YVZhbHVlfENsYXNzTWV0YWRhdGF8SW50ZXJmYWNlTWV0YWRhdGF8RnVuY3Rpb25NZXRhZGF0YSwgdHMuTm9kZT4oKTtcbiAgICBjb25zdCBjb21wb3NlZFN1YnN0aXR1dGVyID0gc3Vic3RpdHV0ZUV4cHJlc3Npb24gJiYgdGhpcy5vcHRpb25zLnN1YnN0aXR1dGVFeHByZXNzaW9uID9cbiAgICAgICAgKHZhbHVlOiBNZXRhZGF0YVZhbHVlLCBub2RlOiB0cy5Ob2RlKSA9PlxuICAgICAgICAgICAgdGhpcy5vcHRpb25zLnN1YnN0aXR1dGVFeHByZXNzaW9uIShzdWJzdGl0dXRlRXhwcmVzc2lvbih2YWx1ZSwgbm9kZSksIG5vZGUpIDpcbiAgICAgICAgc3Vic3RpdHV0ZUV4cHJlc3Npb247XG4gICAgY29uc3QgZXZhbHVhdG9yT3B0aW9ucyA9IHN1YnN0aXR1dGVFeHByZXNzaW9uID9cbiAgICAgICAgey4uLnRoaXMub3B0aW9ucywgc3Vic3RpdHV0ZUV4cHJlc3Npb246IGNvbXBvc2VkU3Vic3RpdHV0ZXJ9IDpcbiAgICAgICAgdGhpcy5vcHRpb25zO1xuICAgIGxldCBtZXRhZGF0YToge1tuYW1lOiBzdHJpbmddOiBNZXRhZGF0YVZhbHVlfENsYXNzTWV0YWRhdGF8RnVuY3Rpb25NZXRhZGF0YX18dW5kZWZpbmVkO1xuICAgIGNvbnN0IGV2YWx1YXRvciA9IG5ldyBFdmFsdWF0b3IobG9jYWxzLCBub2RlTWFwLCBldmFsdWF0b3JPcHRpb25zLCAobmFtZSwgdmFsdWUpID0+IHtcbiAgICAgIGlmICghbWV0YWRhdGEpIG1ldGFkYXRhID0ge307XG4gICAgICBtZXRhZGF0YVtuYW1lXSA9IHZhbHVlO1xuICAgIH0pO1xuICAgIGxldCBleHBvcnRzOiBNb2R1bGVFeHBvcnRNZXRhZGF0YVtdfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAgIGZ1bmN0aW9uIG9iakZyb21EZWNvcmF0b3IoZGVjb3JhdG9yTm9kZTogdHMuRGVjb3JhdG9yKTogTWV0YWRhdGFTeW1ib2xpY0V4cHJlc3Npb24ge1xuICAgICAgcmV0dXJuIDxNZXRhZGF0YVN5bWJvbGljRXhwcmVzc2lvbj5ldmFsdWF0b3IuZXZhbHVhdGVOb2RlKGRlY29yYXRvck5vZGUuZXhwcmVzc2lvbik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVjb3JkRW50cnk8VCBleHRlbmRzIE1ldGFkYXRhRW50cnk+KGVudHJ5OiBULCBub2RlOiB0cy5Ob2RlKTogVCB7XG4gICAgICBpZiAoY29tcG9zZWRTdWJzdGl0dXRlcikge1xuICAgICAgICBlbnRyeSA9IGNvbXBvc2VkU3Vic3RpdHV0ZXIoZW50cnkgYXMgTWV0YWRhdGFWYWx1ZSwgbm9kZSkgYXMgVDtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZWNvcmRNYXBFbnRyeShlbnRyeSwgbm9kZSwgbm9kZU1hcCwgc291cmNlRmlsZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXJyb3JTeW0oXG4gICAgICAgIG1lc3NhZ2U6IHN0cmluZywgbm9kZT86IHRzLk5vZGUsIGNvbnRleHQ/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBNZXRhZGF0YUVycm9yIHtcbiAgICAgIHJldHVybiBlcnJvclN5bWJvbChtZXNzYWdlLCBub2RlLCBjb250ZXh0LCBzb3VyY2VGaWxlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXliZUdldFNpbXBsZUZ1bmN0aW9uKGZ1bmN0aW9uRGVjbGFyYXRpb246IHRzLkZ1bmN0aW9uRGVjbGFyYXRpb258XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5NZXRob2REZWNsYXJhdGlvbik6IHtmdW5jOiBGdW5jdGlvbk1ldGFkYXRhLCBuYW1lOiBzdHJpbmd9fFxuICAgICAgICB1bmRlZmluZWQge1xuICAgICAgaWYgKGZ1bmN0aW9uRGVjbGFyYXRpb24ubmFtZSAmJiBmdW5jdGlvbkRlY2xhcmF0aW9uLm5hbWUua2luZCA9PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgICAgY29uc3QgbmFtZU5vZGUgPSA8dHMuSWRlbnRpZmllcj5mdW5jdGlvbkRlY2xhcmF0aW9uLm5hbWU7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IG5hbWVOb2RlLnRleHQ7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uQm9keSA9IGZ1bmN0aW9uRGVjbGFyYXRpb24uYm9keTtcbiAgICAgICAgaWYgKGZ1bmN0aW9uQm9keSAmJiBmdW5jdGlvbkJvZHkuc3RhdGVtZW50cy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgIGNvbnN0IHN0YXRlbWVudCA9IGZ1bmN0aW9uQm9keS5zdGF0ZW1lbnRzWzBdO1xuICAgICAgICAgIGlmIChzdGF0ZW1lbnQua2luZCA9PT0gdHMuU3ludGF4S2luZC5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJldHVyblN0YXRlbWVudCA9IDx0cy5SZXR1cm5TdGF0ZW1lbnQ+c3RhdGVtZW50O1xuICAgICAgICAgICAgaWYgKHJldHVyblN0YXRlbWVudC5leHByZXNzaW9uKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZ1bmM6IEZ1bmN0aW9uTWV0YWRhdGEgPSB7XG4gICAgICAgICAgICAgICAgX19zeW1ib2xpYzogJ2Z1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiBuYW1lc09mKGZ1bmN0aW9uRGVjbGFyYXRpb24ucGFyYW1ldGVycyksXG4gICAgICAgICAgICAgICAgdmFsdWU6IGV2YWx1YXRvci5ldmFsdWF0ZU5vZGUocmV0dXJuU3RhdGVtZW50LmV4cHJlc3Npb24pXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIGlmIChmdW5jdGlvbkRlY2xhcmF0aW9uLnBhcmFtZXRlcnMuc29tZShwID0+IHAuaW5pdGlhbGl6ZXIgIT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBmdW5jLmRlZmF1bHRzID0gZnVuY3Rpb25EZWNsYXJhdGlvbi5wYXJhbWV0ZXJzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgcCA9PiBwLmluaXRpYWxpemVyICYmIGV2YWx1YXRvci5ldmFsdWF0ZU5vZGUocC5pbml0aWFsaXplcikpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiByZWNvcmRFbnRyeSh7ZnVuYywgbmFtZTogZnVuY3Rpb25OYW1lfSwgZnVuY3Rpb25EZWNsYXJhdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xhc3NNZXRhZGF0YU9mKGNsYXNzRGVjbGFyYXRpb246IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBDbGFzc01ldGFkYXRhIHtcbiAgICAgIGNvbnN0IHJlc3VsdDogQ2xhc3NNZXRhZGF0YSA9IHtfX3N5bWJvbGljOiAnY2xhc3MnfTtcblxuICAgICAgZnVuY3Rpb24gZ2V0RGVjb3JhdG9ycyhkZWNvcmF0b3JzOiBSZWFkb25seUFycmF5PHRzLkRlY29yYXRvcj58XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZCk6IE1ldGFkYXRhU3ltYm9saWNFeHByZXNzaW9uW118dW5kZWZpbmVkIHtcbiAgICAgICAgaWYgKGRlY29yYXRvcnMgJiYgZGVjb3JhdG9ycy5sZW5ndGgpXG4gICAgICAgICAgcmV0dXJuIGRlY29yYXRvcnMubWFwKGRlY29yYXRvciA9PiBvYmpGcm9tRGVjb3JhdG9yKGRlY29yYXRvcikpO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiByZWZlcmVuY2VGcm9tKG5vZGU6IHRzLk5vZGUpOiBNZXRhZGF0YVN5bWJvbGljUmVmZXJlbmNlRXhwcmVzc2lvbnxNZXRhZGF0YUVycm9yfFxuICAgICAgICAgIE1ldGFkYXRhU3ltYm9saWNTZWxlY3RFeHByZXNzaW9uIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdG9yLmV2YWx1YXRlTm9kZShub2RlKTtcbiAgICAgICAgaWYgKGlzTWV0YWRhdGFFcnJvcihyZXN1bHQpIHx8IGlzTWV0YWRhdGFTeW1ib2xpY1JlZmVyZW5jZUV4cHJlc3Npb24ocmVzdWx0KSB8fFxuICAgICAgICAgICAgaXNNZXRhZGF0YVN5bWJvbGljU2VsZWN0RXhwcmVzc2lvbihyZXN1bHQpKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZXJyb3JTeW0oJ1N5bWJvbCByZWZlcmVuY2UgZXhwZWN0ZWQnLCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBZGQgY2xhc3MgcGFyZW50c1xuICAgICAgaWYgKGNsYXNzRGVjbGFyYXRpb24uaGVyaXRhZ2VDbGF1c2VzKSB7XG4gICAgICAgIGNsYXNzRGVjbGFyYXRpb24uaGVyaXRhZ2VDbGF1c2VzLmZvckVhY2goKGhjKSA9PiB7XG4gICAgICAgICAgaWYgKGhjLnRva2VuID09PSB0cy5TeW50YXhLaW5kLkV4dGVuZHNLZXl3b3JkICYmIGhjLnR5cGVzKSB7XG4gICAgICAgICAgICBoYy50eXBlcy5mb3JFYWNoKHR5cGUgPT4gcmVzdWx0LmV4dGVuZHMgPSByZWZlcmVuY2VGcm9tKHR5cGUuZXhwcmVzc2lvbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBhcml0eSBpZiB0aGUgdHlwZSBpcyBnZW5lcmljXG4gICAgICBjb25zdCB0eXBlUGFyYW1ldGVycyA9IGNsYXNzRGVjbGFyYXRpb24udHlwZVBhcmFtZXRlcnM7XG4gICAgICBpZiAodHlwZVBhcmFtZXRlcnMgJiYgdHlwZVBhcmFtZXRlcnMubGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdC5hcml0eSA9IHR5cGVQYXJhbWV0ZXJzLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGNsYXNzIGRlY29yYXRvcnNcbiAgICAgIGlmIChjbGFzc0RlY2xhcmF0aW9uLmRlY29yYXRvcnMpIHtcbiAgICAgICAgcmVzdWx0LmRlY29yYXRvcnMgPSBnZXREZWNvcmF0b3JzKGNsYXNzRGVjbGFyYXRpb24uZGVjb3JhdG9ycyk7XG4gICAgICB9XG5cbiAgICAgIC8vIG1lbWJlciBkZWNvcmF0b3JzXG4gICAgICBsZXQgbWVtYmVyczogTWV0YWRhdGFNYXB8bnVsbCA9IG51bGw7XG4gICAgICBmdW5jdGlvbiByZWNvcmRNZW1iZXIobmFtZTogc3RyaW5nLCBtZXRhZGF0YTogTWVtYmVyTWV0YWRhdGEpIHtcbiAgICAgICAgaWYgKCFtZW1iZXJzKSBtZW1iZXJzID0ge307XG4gICAgICAgIGNvbnN0IGRhdGEgPSBtZW1iZXJzLmhhc093blByb3BlcnR5KG5hbWUpID8gbWVtYmVyc1tuYW1lXSA6IFtdO1xuICAgICAgICBkYXRhLnB1c2gobWV0YWRhdGEpO1xuICAgICAgICBtZW1iZXJzW25hbWVdID0gZGF0YTtcbiAgICAgIH1cblxuICAgICAgLy8gc3RhdGljIG1lbWJlclxuICAgICAgbGV0IHN0YXRpY3M6IHtbbmFtZTogc3RyaW5nXTogTWV0YWRhdGFWYWx1ZXxGdW5jdGlvbk1ldGFkYXRhfXxudWxsID0gbnVsbDtcbiAgICAgIGZ1bmN0aW9uIHJlY29yZFN0YXRpY01lbWJlcihuYW1lOiBzdHJpbmcsIHZhbHVlOiBNZXRhZGF0YVZhbHVlfEZ1bmN0aW9uTWV0YWRhdGEpIHtcbiAgICAgICAgaWYgKCFzdGF0aWNzKSBzdGF0aWNzID0ge307XG4gICAgICAgIHN0YXRpY3NbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBtZW1iZXIgb2YgY2xhc3NEZWNsYXJhdGlvbi5tZW1iZXJzKSB7XG4gICAgICAgIGxldCBpc0NvbnN0cnVjdG9yID0gZmFsc2U7XG4gICAgICAgIHN3aXRjaCAobWVtYmVyLmtpbmQpIHtcbiAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQ29uc3RydWN0b3I6XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLk1ldGhvZERlY2xhcmF0aW9uOlxuICAgICAgICAgICAgaXNDb25zdHJ1Y3RvciA9IG1lbWJlci5raW5kID09PSB0cy5TeW50YXhLaW5kLkNvbnN0cnVjdG9yO1xuICAgICAgICAgICAgY29uc3QgbWV0aG9kID0gPHRzLk1ldGhvZERlY2xhcmF0aW9ufHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb24+bWVtYmVyO1xuICAgICAgICAgICAgaWYgKGlzU3RhdGljKG1ldGhvZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgbWF5YmVGdW5jID0gbWF5YmVHZXRTaW1wbGVGdW5jdGlvbig8dHMuTWV0aG9kRGVjbGFyYXRpb24+bWV0aG9kKTtcbiAgICAgICAgICAgICAgaWYgKG1heWJlRnVuYykge1xuICAgICAgICAgICAgICAgIHJlY29yZFN0YXRpY01lbWJlcihtYXliZUZ1bmMubmFtZSwgbWF5YmVGdW5jLmZ1bmMpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbWV0aG9kRGVjb3JhdG9ycyA9IGdldERlY29yYXRvcnMobWV0aG9kLmRlY29yYXRvcnMpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IG1ldGhvZC5wYXJhbWV0ZXJzO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyRGVjb3JhdG9yRGF0YTogKChNZXRhZGF0YVN5bWJvbGljRXhwcmVzc2lvbiB8IE1ldGFkYXRhRXJyb3IpW118XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkKVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJzRGF0YTogKE1ldGFkYXRhU3ltYm9saWNSZWZlcmVuY2VFeHByZXNzaW9ufE1ldGFkYXRhRXJyb3J8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1ldGFkYXRhU3ltYm9saWNTZWxlY3RFeHByZXNzaW9ufG51bGwpW10gPSBbXTtcbiAgICAgICAgICAgIGxldCBoYXNEZWNvcmF0b3JEYXRhOiBib29sZWFuID0gZmFsc2U7XG4gICAgICAgICAgICBsZXQgaGFzUGFyYW1ldGVyRGF0YTogYm9vbGVhbiA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwYXJhbWV0ZXIgb2YgcGFyYW1ldGVycykge1xuICAgICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJEYXRhID0gZ2V0RGVjb3JhdG9ycyhwYXJhbWV0ZXIuZGVjb3JhdG9ycyk7XG4gICAgICAgICAgICAgIHBhcmFtZXRlckRlY29yYXRvckRhdGEucHVzaChwYXJhbWV0ZXJEYXRhKTtcbiAgICAgICAgICAgICAgaGFzRGVjb3JhdG9yRGF0YSA9IGhhc0RlY29yYXRvckRhdGEgfHwgISFwYXJhbWV0ZXJEYXRhO1xuICAgICAgICAgICAgICBpZiAoaXNDb25zdHJ1Y3Rvcikge1xuICAgICAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIudHlwZSkge1xuICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyc0RhdGEucHVzaChyZWZlcmVuY2VGcm9tKHBhcmFtZXRlci50eXBlKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnNEYXRhLnB1c2gobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGhhc1BhcmFtZXRlckRhdGEgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBkYXRhOiBNZXRob2RNZXRhZGF0YSA9IHtfX3N5bWJvbGljOiBpc0NvbnN0cnVjdG9yID8gJ2NvbnN0cnVjdG9yJyA6ICdtZXRob2QnfTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBpc0NvbnN0cnVjdG9yID8gJ19fY3Rvcl9fJyA6IGV2YWx1YXRvci5uYW1lT2YobWVtYmVyLm5hbWUpO1xuICAgICAgICAgICAgaWYgKG1ldGhvZERlY29yYXRvcnMpIHtcbiAgICAgICAgICAgICAgZGF0YS5kZWNvcmF0b3JzID0gbWV0aG9kRGVjb3JhdG9ycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChoYXNEZWNvcmF0b3JEYXRhKSB7XG4gICAgICAgICAgICAgIGRhdGEucGFyYW1ldGVyRGVjb3JhdG9ycyA9IHBhcmFtZXRlckRlY29yYXRvckRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaGFzUGFyYW1ldGVyRGF0YSkge1xuICAgICAgICAgICAgICAoPENvbnN0cnVjdG9yTWV0YWRhdGE+ZGF0YSkucGFyYW1ldGVycyA9IHBhcmFtZXRlcnNEYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFpc01ldGFkYXRhRXJyb3IobmFtZSkpIHtcbiAgICAgICAgICAgICAgcmVjb3JkTWVtYmVyKG5hbWUsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlByb3BlcnR5RGVjbGFyYXRpb246XG4gICAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkdldEFjY2Vzc29yOlxuICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5TZXRBY2Nlc3NvcjpcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5ID0gPHRzLlByb3BlcnR5RGVjbGFyYXRpb24+bWVtYmVyO1xuICAgICAgICAgICAgaWYgKGlzU3RhdGljKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICBjb25zdCBuYW1lID0gZXZhbHVhdG9yLm5hbWVPZihwcm9wZXJ0eS5uYW1lKTtcbiAgICAgICAgICAgICAgaWYgKCFpc01ldGFkYXRhRXJyb3IobmFtZSkgJiYgIXNob3VsZElnbm9yZVN0YXRpY01lbWJlcihuYW1lKSkge1xuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eS5pbml0aWFsaXplcikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBldmFsdWF0b3IuZXZhbHVhdGVOb2RlKHByb3BlcnR5LmluaXRpYWxpemVyKTtcbiAgICAgICAgICAgICAgICAgIHJlY29yZFN0YXRpY01lbWJlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJlY29yZFN0YXRpY01lbWJlcihuYW1lLCBlcnJvclN5bSgnVmFyaWFibGUgbm90IGluaXRpYWxpemVkJywgcHJvcGVydHkubmFtZSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlEZWNvcmF0b3JzID0gZ2V0RGVjb3JhdG9ycyhwcm9wZXJ0eS5kZWNvcmF0b3JzKTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eURlY29yYXRvcnMpIHtcbiAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IGV2YWx1YXRvci5uYW1lT2YocHJvcGVydHkubmFtZSk7XG4gICAgICAgICAgICAgIGlmICghaXNNZXRhZGF0YUVycm9yKG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmVjb3JkTWVtYmVyKG5hbWUsIHtfX3N5bWJvbGljOiAncHJvcGVydHknLCBkZWNvcmF0b3JzOiBwcm9wZXJ0eURlY29yYXRvcnN9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChtZW1iZXJzKSB7XG4gICAgICAgIHJlc3VsdC5tZW1iZXJzID0gbWVtYmVycztcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0aWNzKSB7XG4gICAgICAgIHJlc3VsdC5zdGF0aWNzID0gc3RhdGljcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlY29yZEVudHJ5KHJlc3VsdCwgY2xhc3NEZWNsYXJhdGlvbik7XG4gICAgfVxuXG4gICAgLy8gQ29sbGVjdCBhbGwgZXhwb3J0ZWQgc3ltYm9scyBmcm9tIGFuIGV4cG9ydHMgY2xhdXNlLlxuICAgIGNvbnN0IGV4cG9ydE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgdHMuZm9yRWFjaENoaWxkKHNvdXJjZUZpbGUsIG5vZGUgPT4ge1xuICAgICAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkV4cG9ydERlY2xhcmF0aW9uOlxuICAgICAgICAgIGNvbnN0IGV4cG9ydERlY2xhcmF0aW9uID0gPHRzLkV4cG9ydERlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgY29uc3Qge21vZHVsZVNwZWNpZmllciwgZXhwb3J0Q2xhdXNlfSA9IGV4cG9ydERlY2xhcmF0aW9uO1xuXG4gICAgICAgICAgaWYgKCFtb2R1bGVTcGVjaWZpZXIgJiYgZXhwb3J0Q2xhdXNlICYmIHRzLmlzTmFtZWRFeHBvcnRzKGV4cG9ydENsYXVzZSkpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIGEgbW9kdWxlIHNwZWNpZmllciB0aGVyZSBpcyBhbHNvIGFuIGV4cG9ydENsYXVzZVxuICAgICAgICAgICAgZXhwb3J0Q2xhdXNlLmVsZW1lbnRzLmZvckVhY2goc3BlYyA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGV4cG9ydGVkQXMgPSBzcGVjLm5hbWUudGV4dDtcbiAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChzcGVjLnByb3BlcnR5TmFtZSB8fCBzcGVjLm5hbWUpLnRleHQ7XG4gICAgICAgICAgICAgIGV4cG9ydE1hcC5zZXQobmFtZSwgZXhwb3J0ZWRBcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCBpc0V4cG9ydCA9IChub2RlOiB0cy5Ob2RlKSA9PiBzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlIHx8XG4gICAgICAgIHRzLmdldENvbWJpbmVkTW9kaWZpZXJGbGFncyhub2RlIGFzIHRzLkRlY2xhcmF0aW9uKSAmIHRzLk1vZGlmaWVyRmxhZ3MuRXhwb3J0O1xuICAgIGNvbnN0IGlzRXhwb3J0ZWRJZGVudGlmaWVyID0gKGlkZW50aWZpZXI/OiB0cy5JZGVudGlmaWVyKSA9PlxuICAgICAgICBpZGVudGlmaWVyICYmIGV4cG9ydE1hcC5oYXMoaWRlbnRpZmllci50ZXh0KTtcbiAgICBjb25zdCBpc0V4cG9ydGVkID0gKG5vZGU6IHRzLkZ1bmN0aW9uRGVjbGFyYXRpb258dHMuQ2xhc3NEZWNsYXJhdGlvbnx0cy5UeXBlQWxpYXNEZWNsYXJhdGlvbnxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRzLkludGVyZmFjZURlY2xhcmF0aW9ufHRzLkVudW1EZWNsYXJhdGlvbikgPT5cbiAgICAgICAgaXNFeHBvcnQobm9kZSkgfHwgaXNFeHBvcnRlZElkZW50aWZpZXIobm9kZS5uYW1lKTtcbiAgICBjb25zdCBleHBvcnRlZElkZW50aWZpZXJOYW1lID0gKGlkZW50aWZpZXI/OiB0cy5JZGVudGlmaWVyKSA9PlxuICAgICAgICBpZGVudGlmaWVyICYmIChleHBvcnRNYXAuZ2V0KGlkZW50aWZpZXIudGV4dCkgfHwgaWRlbnRpZmllci50ZXh0KTtcbiAgICBjb25zdCBleHBvcnRlZE5hbWUgPSAobm9kZTogdHMuRnVuY3Rpb25EZWNsYXJhdGlvbnx0cy5DbGFzc0RlY2xhcmF0aW9ufFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5JbnRlcmZhY2VEZWNsYXJhdGlvbnx0cy5UeXBlQWxpYXNEZWNsYXJhdGlvbnx0cy5FbnVtRGVjbGFyYXRpb24pID0+XG4gICAgICAgIGV4cG9ydGVkSWRlbnRpZmllck5hbWUobm9kZS5uYW1lKTtcblxuXG4gICAgLy8gUHJlLWRlY2xhcmUgY2xhc3NlcyBhbmQgZnVuY3Rpb25zXG4gICAgdHMuZm9yRWFjaENoaWxkKHNvdXJjZUZpbGUsIG5vZGUgPT4ge1xuICAgICAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkNsYXNzRGVjbGFyYXRpb246XG4gICAgICAgICAgY29uc3QgY2xhc3NEZWNsYXJhdGlvbiA9IDx0cy5DbGFzc0RlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgaWYgKGNsYXNzRGVjbGFyYXRpb24ubmFtZSkge1xuICAgICAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gY2xhc3NEZWNsYXJhdGlvbi5uYW1lLnRleHQ7XG4gICAgICAgICAgICBpZiAoaXNFeHBvcnRlZChjbGFzc0RlY2xhcmF0aW9uKSkge1xuICAgICAgICAgICAgICBsb2NhbHMuZGVmaW5lKFxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLCB7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG5hbWU6IGV4cG9ydGVkTmFtZShjbGFzc0RlY2xhcmF0aW9uKX0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9jYWxzLmRlZmluZShcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSwgZXJyb3JTeW0oJ1JlZmVyZW5jZSB0byBub24tZXhwb3J0ZWQgY2xhc3MnLCBub2RlLCB7Y2xhc3NOYW1lfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuSW50ZXJmYWNlRGVjbGFyYXRpb246XG4gICAgICAgICAgY29uc3QgaW50ZXJmYWNlRGVjbGFyYXRpb24gPSA8dHMuSW50ZXJmYWNlRGVjbGFyYXRpb24+bm9kZTtcbiAgICAgICAgICBpZiAoaW50ZXJmYWNlRGVjbGFyYXRpb24ubmFtZSkge1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlTmFtZSA9IGludGVyZmFjZURlY2xhcmF0aW9uLm5hbWUudGV4dDtcbiAgICAgICAgICAgIC8vIEFsbCByZWZlcmVuY2VzIHRvIGludGVyZmFjZXMgc2hvdWxkIGJlIGNvbnZlcnRlZCB0byByZWZlcmVuY2VzIHRvIGBhbnlgLlxuICAgICAgICAgICAgbG9jYWxzLmRlZmluZShpbnRlcmZhY2VOYW1lLCB7X19zeW1ib2xpYzogJ3JlZmVyZW5jZScsIG5hbWU6ICdhbnknfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvbkRlY2xhcmF0aW9uOlxuICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uRGVjbGFyYXRpb24gPSA8dHMuRnVuY3Rpb25EZWNsYXJhdGlvbj5ub2RlO1xuICAgICAgICAgIGlmICghaXNFeHBvcnRlZChmdW5jdGlvbkRlY2xhcmF0aW9uKSkge1xuICAgICAgICAgICAgLy8gUmVwb3J0IHJlZmVyZW5jZXMgdG8gdGhpcyBmdW5jdGlvbiBhcyBhbiBlcnJvci5cbiAgICAgICAgICAgIGNvbnN0IG5hbWVOb2RlID0gZnVuY3Rpb25EZWNsYXJhdGlvbi5uYW1lO1xuICAgICAgICAgICAgaWYgKG5hbWVOb2RlICYmIG5hbWVOb2RlLnRleHQpIHtcbiAgICAgICAgICAgICAgbG9jYWxzLmRlZmluZShcbiAgICAgICAgICAgICAgICAgIG5hbWVOb2RlLnRleHQsXG4gICAgICAgICAgICAgICAgICBlcnJvclN5bShcbiAgICAgICAgICAgICAgICAgICAgICAnUmVmZXJlbmNlIHRvIGEgbm9uLWV4cG9ydGVkIGZ1bmN0aW9uJywgbmFtZU5vZGUsIHtuYW1lOiBuYW1lTm9kZS50ZXh0fSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRzLmZvckVhY2hDaGlsZChzb3VyY2VGaWxlLCBub2RlID0+IHtcbiAgICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5FeHBvcnREZWNsYXJhdGlvbjpcbiAgICAgICAgICAvLyBSZWNvcmQgZXhwb3J0IGRlY2xhcmF0aW9uc1xuICAgICAgICAgIGNvbnN0IGV4cG9ydERlY2xhcmF0aW9uID0gPHRzLkV4cG9ydERlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgY29uc3Qge21vZHVsZVNwZWNpZmllciwgZXhwb3J0Q2xhdXNlfSA9IGV4cG9ydERlY2xhcmF0aW9uO1xuXG4gICAgICAgICAgaWYgKCFtb2R1bGVTcGVjaWZpZXIpIHtcbiAgICAgICAgICAgIC8vIG5vIG1vZHVsZSBzcGVjaWZpZXIgLT4gZXhwb3J0IHtwcm9wTmFtZSBhcyBuYW1lfTtcbiAgICAgICAgICAgIGlmIChleHBvcnRDbGF1c2UgJiYgdHMuaXNOYW1lZEV4cG9ydHMoZXhwb3J0Q2xhdXNlKSkge1xuICAgICAgICAgICAgICBleHBvcnRDbGF1c2UuZWxlbWVudHMuZm9yRWFjaChzcGVjID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gc3BlYy5uYW1lLnRleHQ7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHN5bWJvbCB3YXMgbm90IGFscmVhZHkgZXhwb3J0ZWQsIGV4cG9ydCBhIHJlZmVyZW5jZSBzaW5jZSBpdCBpcyBhXG4gICAgICAgICAgICAgICAgLy8gcmVmZXJlbmNlIHRvIGFuIGltcG9ydFxuICAgICAgICAgICAgICAgIGlmICghbWV0YWRhdGEgfHwgIW1ldGFkYXRhW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwcm9wTm9kZSA9IHNwZWMucHJvcGVydHlOYW1lIHx8IHNwZWMubmFtZTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlOiBNZXRhZGF0YVZhbHVlID0gZXZhbHVhdG9yLmV2YWx1YXRlTm9kZShwcm9wTm9kZSk7XG4gICAgICAgICAgICAgICAgICBpZiAoIW1ldGFkYXRhKSBtZXRhZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgICAgbWV0YWRhdGFbbmFtZV0gPSByZWNvcmRFbnRyeSh2YWx1ZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobW9kdWxlU3BlY2lmaWVyICYmIG1vZHVsZVNwZWNpZmllci5raW5kID09IHRzLlN5bnRheEtpbmQuU3RyaW5nTGl0ZXJhbCkge1xuICAgICAgICAgICAgLy8gSWdub3JlIGV4cG9ydHMgdGhhdCBkb24ndCBoYXZlIHN0cmluZyBsaXRlcmFscyBhcyBleHBvcnRzLlxuICAgICAgICAgICAgLy8gVGhpcyBpcyBhbGxvd2VkIGJ5IHRoZSBzeW50YXggYnV0IHdpbGwgYmUgZmxhZ2dlZCBhcyBhbiBlcnJvciBieSB0aGUgdHlwZSBjaGVja2VyLlxuICAgICAgICAgICAgY29uc3QgZnJvbSA9ICg8dHMuU3RyaW5nTGl0ZXJhbD5tb2R1bGVTcGVjaWZpZXIpLnRleHQ7XG4gICAgICAgICAgICBjb25zdCBtb2R1bGVFeHBvcnQ6IE1vZHVsZUV4cG9ydE1ldGFkYXRhID0ge2Zyb219O1xuICAgICAgICAgICAgaWYgKGV4cG9ydENsYXVzZSAmJiB0cy5pc05hbWVkRXhwb3J0cyhleHBvcnRDbGF1c2UpKSB7XG4gICAgICAgICAgICAgIG1vZHVsZUV4cG9ydC5leHBvcnQgPSBleHBvcnRDbGF1c2UuZWxlbWVudHMubWFwKFxuICAgICAgICAgICAgICAgICAgc3BlYyA9PiBzcGVjLnByb3BlcnR5TmFtZSA/IHtuYW1lOiBzcGVjLnByb3BlcnR5TmFtZS50ZXh0LCBhczogc3BlYy5uYW1lLnRleHR9IDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGVjLm5hbWUudGV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWV4cG9ydHMpIGV4cG9ydHMgPSBbXTtcbiAgICAgICAgICAgIGV4cG9ydHMucHVzaChtb2R1bGVFeHBvcnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkNsYXNzRGVjbGFyYXRpb246XG4gICAgICAgICAgY29uc3QgY2xhc3NEZWNsYXJhdGlvbiA9IDx0cy5DbGFzc0RlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgaWYgKGNsYXNzRGVjbGFyYXRpb24ubmFtZSkge1xuICAgICAgICAgICAgaWYgKGlzRXhwb3J0ZWQoY2xhc3NEZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IGV4cG9ydGVkTmFtZShjbGFzc0RlY2xhcmF0aW9uKTtcbiAgICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1ldGFkYXRhKSBtZXRhZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgIG1ldGFkYXRhW25hbWVdID0gY2xhc3NNZXRhZGF0YU9mKGNsYXNzRGVjbGFyYXRpb24pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIE90aGVyd2lzZSBkb24ndCByZWNvcmQgbWV0YWRhdGEgZm9yIHRoZSBjbGFzcy5cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuVHlwZUFsaWFzRGVjbGFyYXRpb246XG4gICAgICAgICAgY29uc3QgdHlwZURlY2xhcmF0aW9uID0gPHRzLlR5cGVBbGlhc0RlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgaWYgKHR5cGVEZWNsYXJhdGlvbi5uYW1lICYmIGlzRXhwb3J0ZWQodHlwZURlY2xhcmF0aW9uKSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGV4cG9ydGVkTmFtZSh0eXBlRGVjbGFyYXRpb24pO1xuICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKCFtZXRhZGF0YSkgbWV0YWRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgbWV0YWRhdGFbbmFtZV0gPSB7X19zeW1ib2xpYzogJ2ludGVyZmFjZSd9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuSW50ZXJmYWNlRGVjbGFyYXRpb246XG4gICAgICAgICAgY29uc3QgaW50ZXJmYWNlRGVjbGFyYXRpb24gPSA8dHMuSW50ZXJmYWNlRGVjbGFyYXRpb24+bm9kZTtcbiAgICAgICAgICBpZiAoaW50ZXJmYWNlRGVjbGFyYXRpb24ubmFtZSAmJiBpc0V4cG9ydGVkKGludGVyZmFjZURlY2xhcmF0aW9uKSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGV4cG9ydGVkTmFtZShpbnRlcmZhY2VEZWNsYXJhdGlvbik7XG4gICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICBpZiAoIW1ldGFkYXRhKSBtZXRhZGF0YSA9IHt9O1xuICAgICAgICAgICAgICBtZXRhZGF0YVtuYW1lXSA9IHtfX3N5bWJvbGljOiAnaW50ZXJmYWNlJ307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5GdW5jdGlvbkRlY2xhcmF0aW9uOlxuICAgICAgICAgIC8vIFJlY29yZCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gYSBzaW5nbGUgdmFsdWUuIFJlY29yZCB0aGUgcGFyYW1ldGVyXG4gICAgICAgICAgLy8gbmFtZXMgc3Vic3RpdHV0aW9uIHdpbGwgYmUgcGVyZm9ybWVkIGJ5IHRoZSBTdGF0aWNSZWZsZWN0b3IuXG4gICAgICAgICAgY29uc3QgZnVuY3Rpb25EZWNsYXJhdGlvbiA9IDx0cy5GdW5jdGlvbkRlY2xhcmF0aW9uPm5vZGU7XG4gICAgICAgICAgaWYgKGlzRXhwb3J0ZWQoZnVuY3Rpb25EZWNsYXJhdGlvbikgJiYgZnVuY3Rpb25EZWNsYXJhdGlvbi5uYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gZXhwb3J0ZWROYW1lKGZ1bmN0aW9uRGVjbGFyYXRpb24pO1xuICAgICAgICAgICAgY29uc3QgbWF5YmVGdW5jID0gbWF5YmVHZXRTaW1wbGVGdW5jdGlvbihmdW5jdGlvbkRlY2xhcmF0aW9uKTtcbiAgICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICAgIGlmICghbWV0YWRhdGEpIG1ldGFkYXRhID0ge307XG4gICAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogVGhlIGxpdGVyYWwgaGVyZSBpcyBub3QgdmFsaWQgRnVuY3Rpb25NZXRhZGF0YS5cbiAgICAgICAgICAgICAgbWV0YWRhdGFbbmFtZV0gPVxuICAgICAgICAgICAgICAgICAgbWF5YmVGdW5jID8gcmVjb3JkRW50cnkobWF5YmVGdW5jLmZ1bmMsIG5vZGUpIDogKHtfX3N5bWJvbGljOiAnZnVuY3Rpb24nfSBhcyBhbnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuRW51bURlY2xhcmF0aW9uOlxuICAgICAgICAgIGNvbnN0IGVudW1EZWNsYXJhdGlvbiA9IDx0cy5FbnVtRGVjbGFyYXRpb24+bm9kZTtcbiAgICAgICAgICBpZiAoaXNFeHBvcnRlZChlbnVtRGVjbGFyYXRpb24pKSB7XG4gICAgICAgICAgICBjb25zdCBlbnVtVmFsdWVIb2xkZXI6IHtbbmFtZTogc3RyaW5nXTogTWV0YWRhdGFWYWx1ZX0gPSB7fTtcbiAgICAgICAgICAgIGNvbnN0IGVudW1OYW1lID0gZXhwb3J0ZWROYW1lKGVudW1EZWNsYXJhdGlvbik7XG4gICAgICAgICAgICBsZXQgbmV4dERlZmF1bHRWYWx1ZTogTWV0YWRhdGFWYWx1ZSA9IDA7XG4gICAgICAgICAgICBsZXQgd3JpdHRlbk1lbWJlcnMgPSAwO1xuICAgICAgICAgICAgZm9yIChjb25zdCBtZW1iZXIgb2YgZW51bURlY2xhcmF0aW9uLm1lbWJlcnMpIHtcbiAgICAgICAgICAgICAgbGV0IGVudW1WYWx1ZTogTWV0YWRhdGFWYWx1ZTtcbiAgICAgICAgICAgICAgaWYgKCFtZW1iZXIuaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgICAgICAgICBlbnVtVmFsdWUgPSBuZXh0RGVmYXVsdFZhbHVlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVudW1WYWx1ZSA9IGV2YWx1YXRvci5ldmFsdWF0ZU5vZGUobWVtYmVyLmluaXRpYWxpemVyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBsZXQgbmFtZTogc3RyaW5nfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgaWYgKG1lbWJlci5uYW1lLmtpbmQgPT0gdHMuU3ludGF4S2luZC5JZGVudGlmaWVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IDx0cy5JZGVudGlmaWVyPm1lbWJlci5uYW1lO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBpZGVudGlmaWVyLnRleHQ7XG4gICAgICAgICAgICAgICAgZW51bVZhbHVlSG9sZGVyW25hbWVdID0gZW51bVZhbHVlO1xuICAgICAgICAgICAgICAgIHdyaXR0ZW5NZW1iZXJzKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBlbnVtVmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgbmV4dERlZmF1bHRWYWx1ZSA9IGVudW1WYWx1ZSArIDE7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogJ2xlZnQnIGhlcmUgaGFzIGEgbmFtZSBwcm9wZXJ5IHdoaWNoIGlzIG5vdCB2YWxpZCBmb3JcbiAgICAgICAgICAgICAgICAvLyBNZXRhZGF0YVN5bWJvbGljU2VsZWN0RXhwcmVzc2lvbi5cbiAgICAgICAgICAgICAgICBuZXh0RGVmYXVsdFZhbHVlID0ge1xuICAgICAgICAgICAgICAgICAgX19zeW1ib2xpYzogJ2JpbmFyeScsXG4gICAgICAgICAgICAgICAgICBvcGVyYXRvcjogJysnLFxuICAgICAgICAgICAgICAgICAgbGVmdDoge1xuICAgICAgICAgICAgICAgICAgICBfX3N5bWJvbGljOiAnc2VsZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbjogcmVjb3JkRW50cnkoe19fc3ltYm9saWM6ICdyZWZlcmVuY2UnLCBuYW1lOiBlbnVtTmFtZX0sIG5vZGUpLFxuICAgICAgICAgICAgICAgICAgICBuYW1lXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0gYXMgYW55O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5leHREZWZhdWx0VmFsdWUgPVxuICAgICAgICAgICAgICAgICAgICByZWNvcmRFbnRyeShlcnJvclN5bSgnVW5zdXBwb3J0ZWQgZW51bSBtZW1iZXIgbmFtZScsIG1lbWJlci5uYW1lKSwgbm9kZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3cml0dGVuTWVtYmVycykge1xuICAgICAgICAgICAgICBpZiAoZW51bU5hbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1ldGFkYXRhKSBtZXRhZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgIG1ldGFkYXRhW2VudW1OYW1lXSA9IHJlY29yZEVudHJ5KGVudW1WYWx1ZUhvbGRlciwgbm9kZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLlZhcmlhYmxlU3RhdGVtZW50OlxuICAgICAgICAgIGNvbnN0IHZhcmlhYmxlU3RhdGVtZW50ID0gPHRzLlZhcmlhYmxlU3RhdGVtZW50Pm5vZGU7XG4gICAgICAgICAgZm9yIChjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9uIG9mIHZhcmlhYmxlU3RhdGVtZW50LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh2YXJpYWJsZURlY2xhcmF0aW9uLm5hbWUua2luZCA9PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXIpIHtcbiAgICAgICAgICAgICAgY29uc3QgbmFtZU5vZGUgPSA8dHMuSWRlbnRpZmllcj52YXJpYWJsZURlY2xhcmF0aW9uLm5hbWU7XG4gICAgICAgICAgICAgIGxldCB2YXJWYWx1ZTogTWV0YWRhdGFWYWx1ZTtcbiAgICAgICAgICAgICAgaWYgKHZhcmlhYmxlRGVjbGFyYXRpb24uaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgICAgICAgICB2YXJWYWx1ZSA9IGV2YWx1YXRvci5ldmFsdWF0ZU5vZGUodmFyaWFibGVEZWNsYXJhdGlvbi5pbml0aWFsaXplcik7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyVmFsdWUgPSByZWNvcmRFbnRyeShlcnJvclN5bSgnVmFyaWFibGUgbm90IGluaXRpYWxpemVkJywgbmFtZU5vZGUpLCBuYW1lTm9kZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgbGV0IGV4cG9ydGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgIGlmIChpc0V4cG9ydCh2YXJpYWJsZVN0YXRlbWVudCkgfHwgaXNFeHBvcnQodmFyaWFibGVEZWNsYXJhdGlvbikgfHxcbiAgICAgICAgICAgICAgICAgIGlzRXhwb3J0ZWRJZGVudGlmaWVyKG5hbWVOb2RlKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBleHBvcnRlZElkZW50aWZpZXJOYW1lKG5hbWVOb2RlKTtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgaWYgKCFtZXRhZGF0YSkgbWV0YWRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICAgIG1ldGFkYXRhW25hbWVdID0gcmVjb3JkRW50cnkodmFyVmFsdWUsIG5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBleHBvcnRlZCA9IHRydWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YXJWYWx1ZSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFyVmFsdWUgPT0gJ251bWJlcicgfHxcbiAgICAgICAgICAgICAgICAgIHR5cGVvZiB2YXJWYWx1ZSA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICBsb2NhbHMuZGVmaW5lKG5hbWVOb2RlLnRleHQsIHZhclZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoZXhwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICAgIGxvY2Fscy5kZWZpbmVSZWZlcmVuY2UoXG4gICAgICAgICAgICAgICAgICAgICAgbmFtZU5vZGUudGV4dCwge19fc3ltYm9saWM6ICdyZWZlcmVuY2UnLCBuYW1lOiBuYW1lTm9kZS50ZXh0fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFleHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIGlmICh2YXJWYWx1ZSAmJiAhaXNNZXRhZGF0YUVycm9yKHZhclZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgbG9jYWxzLmRlZmluZShuYW1lTm9kZS50ZXh0LCByZWNvcmRFbnRyeSh2YXJWYWx1ZSwgbm9kZSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBsb2NhbHMuZGVmaW5lKFxuICAgICAgICAgICAgICAgICAgICAgIG5hbWVOb2RlLnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgcmVjb3JkRW50cnkoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yU3ltKCdSZWZlcmVuY2UgdG8gYSBsb2NhbCBzeW1ib2wnLCBuYW1lTm9kZSwge25hbWU6IG5hbWVOb2RlLnRleHR9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gRGVzdHJ1Y3R1cmluZyAob3IgYmluZGluZykgZGVjbGFyYXRpb25zIGFyZSBub3Qgc3VwcG9ydGVkLFxuICAgICAgICAgICAgICAvLyB2YXIgezxpZGVudGlmaWVyPlssIDxpZGVudGlmaWVyPl0rfSA9IDxleHByZXNzaW9uPjtcbiAgICAgICAgICAgICAgLy8gICBvclxuICAgICAgICAgICAgICAvLyB2YXIgWzxpZGVudGlmaWVyPlssIDxpZGVudGlmaWVyfStdID0gPGV4cHJlc3Npb24+O1xuICAgICAgICAgICAgICAvLyBhcmUgbm90IHN1cHBvcnRlZC5cbiAgICAgICAgICAgICAgY29uc3QgcmVwb3J0OiAobmFtZU5vZGU6IHRzLk5vZGUpID0+IHZvaWQgPSAobmFtZU5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKG5hbWVOb2RlLmtpbmQpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5JZGVudGlmaWVyOlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gPHRzLklkZW50aWZpZXI+bmFtZU5vZGU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhclZhbHVlID0gZXJyb3JTeW0oJ0Rlc3RydWN0dXJpbmcgbm90IHN1cHBvcnRlZCcsIG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbHMuZGVmaW5lKG5hbWUudGV4dCwgdmFyVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNFeHBvcnQobm9kZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIW1ldGFkYXRhKSBtZXRhZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhW25hbWUudGV4dF0gPSB2YXJWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5CaW5kaW5nRWxlbWVudDpcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmluZGluZ0VsZW1lbnQgPSA8dHMuQmluZGluZ0VsZW1lbnQ+bmFtZU5vZGU7XG4gICAgICAgICAgICAgICAgICAgIHJlcG9ydChiaW5kaW5nRWxlbWVudC5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuT2JqZWN0QmluZGluZ1BhdHRlcm46XG4gICAgICAgICAgICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuQXJyYXlCaW5kaW5nUGF0dGVybjpcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmluZGluZ3MgPSA8dHMuQmluZGluZ1BhdHRlcm4+bmFtZU5vZGU7XG4gICAgICAgICAgICAgICAgICAgIChiaW5kaW5ncyBhcyBhbnkpLmVsZW1lbnRzLmZvckVhY2gocmVwb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICByZXBvcnQodmFyaWFibGVEZWNsYXJhdGlvbi5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobWV0YWRhdGEgfHwgZXhwb3J0cykge1xuICAgICAgaWYgKCFtZXRhZGF0YSlcbiAgICAgICAgbWV0YWRhdGEgPSB7fTtcbiAgICAgIGVsc2UgaWYgKHN0cmljdCkge1xuICAgICAgICB2YWxpZGF0ZU1ldGFkYXRhKHNvdXJjZUZpbGUsIG5vZGVNYXAsIG1ldGFkYXRhKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdDogTW9kdWxlTWV0YWRhdGEgPSB7XG4gICAgICAgIF9fc3ltYm9saWM6ICdtb2R1bGUnLFxuICAgICAgICB2ZXJzaW9uOiB0aGlzLm9wdGlvbnMudmVyc2lvbiB8fCBNRVRBREFUQV9WRVJTSU9OLFxuICAgICAgICBtZXRhZGF0YVxuICAgICAgfTtcbiAgICAgIGlmIChzb3VyY2VGaWxlLm1vZHVsZU5hbWUpIHJlc3VsdC5pbXBvcnRBcyA9IHNvdXJjZUZpbGUubW9kdWxlTmFtZTtcbiAgICAgIGlmIChleHBvcnRzKSByZXN1bHQuZXhwb3J0cyA9IGV4cG9ydHM7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfVxufVxuXG4vLyBUaGlzIHdpbGwgdGhyb3cgaWYgdGhlIG1ldGFkYXRhIGVudHJ5IGdpdmVuIGNvbnRhaW5zIGFuIGVycm9yIG5vZGUuXG5mdW5jdGlvbiB2YWxpZGF0ZU1ldGFkYXRhKFxuICAgIHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsIG5vZGVNYXA6IE1hcDxNZXRhZGF0YUVudHJ5LCB0cy5Ob2RlPixcbiAgICBtZXRhZGF0YToge1tuYW1lOiBzdHJpbmddOiBNZXRhZGF0YUVudHJ5fSkge1xuICBsZXQgbG9jYWxzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoWydBcnJheScsICdPYmplY3QnLCAnU2V0JywgJ01hcCcsICdzdHJpbmcnLCAnbnVtYmVyJywgJ2FueSddKTtcblxuICBmdW5jdGlvbiB2YWxpZGF0ZUV4cHJlc3Npb24oZXhwcmVzc2lvbjogTWV0YWRhdGFWYWx1ZXxNZXRhZGF0YVN5bWJvbGljRXhwcmVzc2lvbnxNZXRhZGF0YUVycm9yKSB7XG4gICAgaWYgKCFleHByZXNzaW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGV4cHJlc3Npb24pKSB7XG4gICAgICBleHByZXNzaW9uLmZvckVhY2godmFsaWRhdGVFeHByZXNzaW9uKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHByZXNzaW9uID09PSAnb2JqZWN0JyAmJiAhZXhwcmVzc2lvbi5oYXNPd25Qcm9wZXJ0eSgnX19zeW1ib2xpYycpKSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhleHByZXNzaW9uKS5mb3JFYWNoKHYgPT4gdmFsaWRhdGVFeHByZXNzaW9uKCg8YW55PmV4cHJlc3Npb24pW3ZdKSk7XG4gICAgfSBlbHNlIGlmIChpc01ldGFkYXRhRXJyb3IoZXhwcmVzc2lvbikpIHtcbiAgICAgIHJlcG9ydEVycm9yKGV4cHJlc3Npb24pO1xuICAgIH0gZWxzZSBpZiAoaXNNZXRhZGF0YUdsb2JhbFJlZmVyZW5jZUV4cHJlc3Npb24oZXhwcmVzc2lvbikpIHtcbiAgICAgIGlmICghbG9jYWxzLmhhcyhleHByZXNzaW9uLm5hbWUpKSB7XG4gICAgICAgIGNvbnN0IHJlZmVyZW5jZSA9IDxNZXRhZGF0YVZhbHVlPm1ldGFkYXRhW2V4cHJlc3Npb24ubmFtZV07XG4gICAgICAgIGlmIChyZWZlcmVuY2UpIHtcbiAgICAgICAgICB2YWxpZGF0ZUV4cHJlc3Npb24ocmVmZXJlbmNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbk1ldGFkYXRhKGV4cHJlc3Npb24pKSB7XG4gICAgICB2YWxpZGF0ZUZ1bmN0aW9uKDxhbnk+ZXhwcmVzc2lvbik7XG4gICAgfSBlbHNlIGlmIChpc01ldGFkYXRhU3ltYm9saWNFeHByZXNzaW9uKGV4cHJlc3Npb24pKSB7XG4gICAgICBzd2l0Y2ggKGV4cHJlc3Npb24uX19zeW1ib2xpYykge1xuICAgICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICAgIGNvbnN0IGJpbmFyeUV4cHJlc3Npb24gPSA8TWV0YWRhdGFTeW1ib2xpY0JpbmFyeUV4cHJlc3Npb24+ZXhwcmVzc2lvbjtcbiAgICAgICAgICB2YWxpZGF0ZUV4cHJlc3Npb24oYmluYXJ5RXhwcmVzc2lvbi5sZWZ0KTtcbiAgICAgICAgICB2YWxpZGF0ZUV4cHJlc3Npb24oYmluYXJ5RXhwcmVzc2lvbi5yaWdodCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2NhbGwnOlxuICAgICAgICBjYXNlICduZXcnOlxuICAgICAgICAgIGNvbnN0IGNhbGxFeHByZXNzaW9uID0gPE1ldGFkYXRhU3ltYm9saWNDYWxsRXhwcmVzc2lvbj5leHByZXNzaW9uO1xuICAgICAgICAgIHZhbGlkYXRlRXhwcmVzc2lvbihjYWxsRXhwcmVzc2lvbi5leHByZXNzaW9uKTtcbiAgICAgICAgICBpZiAoY2FsbEV4cHJlc3Npb24uYXJndW1lbnRzKSBjYWxsRXhwcmVzc2lvbi5hcmd1bWVudHMuZm9yRWFjaCh2YWxpZGF0ZUV4cHJlc3Npb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdpbmRleCc6XG4gICAgICAgICAgY29uc3QgaW5kZXhFeHByZXNzaW9uID0gPE1ldGFkYXRhU3ltYm9saWNJbmRleEV4cHJlc3Npb24+ZXhwcmVzc2lvbjtcbiAgICAgICAgICB2YWxpZGF0ZUV4cHJlc3Npb24oaW5kZXhFeHByZXNzaW9uLmV4cHJlc3Npb24pO1xuICAgICAgICAgIHZhbGlkYXRlRXhwcmVzc2lvbihpbmRleEV4cHJlc3Npb24uaW5kZXgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdwcmUnOlxuICAgICAgICAgIGNvbnN0IHByZWZpeEV4cHJlc3Npb24gPSA8TWV0YWRhdGFTeW1ib2xpY1ByZWZpeEV4cHJlc3Npb24+ZXhwcmVzc2lvbjtcbiAgICAgICAgICB2YWxpZGF0ZUV4cHJlc3Npb24ocHJlZml4RXhwcmVzc2lvbi5vcGVyYW5kKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2VsZWN0JzpcbiAgICAgICAgICBjb25zdCBzZWxlY3RFeHByZXNzaW9uID0gPE1ldGFkYXRhU3ltYm9saWNTZWxlY3RFeHByZXNzaW9uPmV4cHJlc3Npb247XG4gICAgICAgICAgdmFsaWRhdGVFeHByZXNzaW9uKHNlbGVjdEV4cHJlc3Npb24uZXhwcmVzc2lvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3NwcmVhZCc6XG4gICAgICAgICAgY29uc3Qgc3ByZWFkRXhwcmVzc2lvbiA9IDxNZXRhZGF0YVN5bWJvbGljU3ByZWFkRXhwcmVzc2lvbj5leHByZXNzaW9uO1xuICAgICAgICAgIHZhbGlkYXRlRXhwcmVzc2lvbihzcHJlYWRFeHByZXNzaW9uLmV4cHJlc3Npb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdpZic6XG4gICAgICAgICAgY29uc3QgaWZFeHByZXNzaW9uID0gPE1ldGFkYXRhU3ltYm9saWNJZkV4cHJlc3Npb24+ZXhwcmVzc2lvbjtcbiAgICAgICAgICB2YWxpZGF0ZUV4cHJlc3Npb24oaWZFeHByZXNzaW9uLmNvbmRpdGlvbik7XG4gICAgICAgICAgdmFsaWRhdGVFeHByZXNzaW9uKGlmRXhwcmVzc2lvbi5lbHNlRXhwcmVzc2lvbik7XG4gICAgICAgICAgdmFsaWRhdGVFeHByZXNzaW9uKGlmRXhwcmVzc2lvbi50aGVuRXhwcmVzc2lvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVNZW1iZXIoY2xhc3NEYXRhOiBDbGFzc01ldGFkYXRhLCBtZW1iZXI6IE1lbWJlck1ldGFkYXRhKSB7XG4gICAgaWYgKG1lbWJlci5kZWNvcmF0b3JzKSB7XG4gICAgICBtZW1iZXIuZGVjb3JhdG9ycy5mb3JFYWNoKHZhbGlkYXRlRXhwcmVzc2lvbik7XG4gICAgfVxuICAgIGlmIChpc01ldGhvZE1ldGFkYXRhKG1lbWJlcikgJiYgbWVtYmVyLnBhcmFtZXRlckRlY29yYXRvcnMpIHtcbiAgICAgIG1lbWJlci5wYXJhbWV0ZXJEZWNvcmF0b3JzLmZvckVhY2godmFsaWRhdGVFeHByZXNzaW9uKTtcbiAgICB9XG4gICAgLy8gT25seSB2YWxpZGF0ZSBwYXJhbWV0ZXJzIG9mIGNsYXNzZXMgZm9yIHdoaWNoIHdlIGtub3cgdGhhdCBhcmUgdXNlZCB3aXRoIG91ciBESVxuICAgIGlmIChjbGFzc0RhdGEuZGVjb3JhdG9ycyAmJiBpc0NvbnN0cnVjdG9yTWV0YWRhdGEobWVtYmVyKSAmJiBtZW1iZXIucGFyYW1ldGVycykge1xuICAgICAgbWVtYmVyLnBhcmFtZXRlcnMuZm9yRWFjaCh2YWxpZGF0ZUV4cHJlc3Npb24pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlQ2xhc3MoY2xhc3NEYXRhOiBDbGFzc01ldGFkYXRhKSB7XG4gICAgaWYgKGNsYXNzRGF0YS5kZWNvcmF0b3JzKSB7XG4gICAgICBjbGFzc0RhdGEuZGVjb3JhdG9ycy5mb3JFYWNoKHZhbGlkYXRlRXhwcmVzc2lvbik7XG4gICAgfVxuICAgIGlmIChjbGFzc0RhdGEubWVtYmVycykge1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoY2xhc3NEYXRhLm1lbWJlcnMpXG4gICAgICAgICAgLmZvckVhY2gobmFtZSA9PiBjbGFzc0RhdGEubWVtYmVycyFbbmFtZV0uZm9yRWFjaCgobSkgPT4gdmFsaWRhdGVNZW1iZXIoY2xhc3NEYXRhLCBtKSkpO1xuICAgIH1cbiAgICBpZiAoY2xhc3NEYXRhLnN0YXRpY3MpIHtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGNsYXNzRGF0YS5zdGF0aWNzKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgICBjb25zdCBzdGF0aWNNZW1iZXIgPSBjbGFzc0RhdGEuc3RhdGljcyFbbmFtZV07XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uTWV0YWRhdGEoc3RhdGljTWVtYmVyKSkge1xuICAgICAgICAgIHZhbGlkYXRlRXhwcmVzc2lvbihzdGF0aWNNZW1iZXIudmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbGlkYXRlRXhwcmVzc2lvbihzdGF0aWNNZW1iZXIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZUZ1bmN0aW9uKGZ1bmN0aW9uRGVjbGFyYXRpb246IEZ1bmN0aW9uTWV0YWRhdGEpIHtcbiAgICBpZiAoZnVuY3Rpb25EZWNsYXJhdGlvbi52YWx1ZSkge1xuICAgICAgY29uc3Qgb2xkTG9jYWxzID0gbG9jYWxzO1xuICAgICAgaWYgKGZ1bmN0aW9uRGVjbGFyYXRpb24ucGFyYW1ldGVycykge1xuICAgICAgICBsb2NhbHMgPSBuZXcgU2V0KG9sZExvY2Fscy52YWx1ZXMoKSk7XG4gICAgICAgIGlmIChmdW5jdGlvbkRlY2xhcmF0aW9uLnBhcmFtZXRlcnMpXG4gICAgICAgICAgZnVuY3Rpb25EZWNsYXJhdGlvbi5wYXJhbWV0ZXJzLmZvckVhY2gobiA9PiBsb2NhbHMuYWRkKG4pKTtcbiAgICAgIH1cbiAgICAgIHZhbGlkYXRlRXhwcmVzc2lvbihmdW5jdGlvbkRlY2xhcmF0aW9uLnZhbHVlKTtcbiAgICAgIGxvY2FscyA9IG9sZExvY2FscztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzaG91bGRSZXBvcnROb2RlKG5vZGU6IHRzLk5vZGV8dW5kZWZpbmVkKSB7XG4gICAgaWYgKG5vZGUpIHtcbiAgICAgIGNvbnN0IG5vZGVTdGFydCA9IG5vZGUuZ2V0U3RhcnQoKTtcbiAgICAgIHJldHVybiAhKFxuICAgICAgICAgIG5vZGUucG9zICE9IG5vZGVTdGFydCAmJlxuICAgICAgICAgIHNvdXJjZUZpbGUudGV4dC5zdWJzdHJpbmcobm9kZS5wb3MsIG5vZGVTdGFydCkuaW5kZXhPZignQGR5bmFtaWMnKSA+PSAwKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiByZXBvcnRFcnJvcihlcnJvcjogTWV0YWRhdGFFcnJvcikge1xuICAgIGNvbnN0IG5vZGUgPSBub2RlTWFwLmdldChlcnJvcik7XG4gICAgaWYgKHNob3VsZFJlcG9ydE5vZGUobm9kZSkpIHtcbiAgICAgIGNvbnN0IGxpbmVJbmZvID0gZXJyb3IubGluZSAhPSB1bmRlZmluZWQgPyBlcnJvci5jaGFyYWN0ZXIgIT0gdW5kZWZpbmVkID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgOiR7ZXJyb3IubGluZSArIDF9OiR7ZXJyb3IuY2hhcmFjdGVyICsgMX1gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgOiR7ZXJyb3IubGluZSArIDF9YCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyc7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c291cmNlRmlsZS5maWxlTmFtZX0ke1xuICAgICAgICAgIGxpbmVJbmZvfTogTWV0YWRhdGEgY29sbGVjdGVkIGNvbnRhaW5zIGFuIGVycm9yIHRoYXQgd2lsbCBiZSByZXBvcnRlZCBhdCBydW50aW1lOiAke1xuICAgICAgICAgIGV4cGFuZGVkTWVzc2FnZShlcnJvcil9LlxcbiAgJHtKU09OLnN0cmluZ2lmeShlcnJvcil9YCk7XG4gICAgfVxuICB9XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWV0YWRhdGEpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgY29uc3QgZW50cnkgPSBtZXRhZGF0YVtuYW1lXTtcbiAgICB0cnkge1xuICAgICAgaWYgKGlzQ2xhc3NNZXRhZGF0YShlbnRyeSkpIHtcbiAgICAgICAgdmFsaWRhdGVDbGFzcyhlbnRyeSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc3Qgbm9kZSA9IG5vZGVNYXAuZ2V0KGVudHJ5KTtcbiAgICAgIGlmIChzaG91bGRSZXBvcnROb2RlKG5vZGUpKSB7XG4gICAgICAgIGlmIChub2RlKSB7XG4gICAgICAgICAgY29uc3Qge2xpbmUsIGNoYXJhY3Rlcn0gPSBzb3VyY2VGaWxlLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKG5vZGUuZ2V0U3RhcnQoKSk7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3NvdXJjZUZpbGUuZmlsZU5hbWV9OiR7bGluZSArIDF9OiR7XG4gICAgICAgICAgICAgIGNoYXJhY3RlciArIDF9OiBFcnJvciBlbmNvdW50ZXJlZCBpbiBtZXRhZGF0YSBnZW5lcmF0ZWQgZm9yIGV4cG9ydGVkIHN5bWJvbCAnJHtcbiAgICAgICAgICAgICAgbmFtZX0nOiBcXG4gJHtlLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEVycm9yIGVuY291bnRlcmVkIGluIG1ldGFkYXRhIGdlbmVyYXRlZCBmb3IgZXhwb3J0ZWQgc3ltYm9sICR7bmFtZX06IFxcbiAke2UubWVzc2FnZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG4vLyBDb2xsZWN0IHBhcmFtZXRlciBuYW1lcyBmcm9tIGEgZnVuY3Rpb24uXG5mdW5jdGlvbiBuYW1lc09mKHBhcmFtZXRlcnM6IHRzLk5vZGVBcnJheTx0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbj4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblxuICBmdW5jdGlvbiBhZGROYW1lc09mKG5hbWU6IHRzLklkZW50aWZpZXJ8dHMuQmluZGluZ1BhdHRlcm4pIHtcbiAgICBpZiAobmFtZS5raW5kID09IHRzLlN5bnRheEtpbmQuSWRlbnRpZmllcikge1xuICAgICAgY29uc3QgaWRlbnRpZmllciA9IDx0cy5JZGVudGlmaWVyPm5hbWU7XG4gICAgICByZXN1bHQucHVzaChpZGVudGlmaWVyLnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBiaW5kaW5nUGF0dGVybiA9IDx0cy5CaW5kaW5nUGF0dGVybj5uYW1lO1xuICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGJpbmRpbmdQYXR0ZXJuLmVsZW1lbnRzKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSAoZWxlbWVudCBhcyBhbnkpLm5hbWU7XG4gICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgYWRkTmFtZXNPZihuYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgcGFyYW1ldGVyIG9mIHBhcmFtZXRlcnMpIHtcbiAgICBhZGROYW1lc09mKHBhcmFtZXRlci5uYW1lKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHNob3VsZElnbm9yZVN0YXRpY01lbWJlcihtZW1iZXJOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG1lbWJlck5hbWUuc3RhcnRzV2l0aCgnbmdBY2NlcHRJbnB1dFR5cGVfJykgfHwgbWVtYmVyTmFtZS5zdGFydHNXaXRoKCduZ1RlbXBsYXRlR3VhcmRfJyk7XG59XG5cbmZ1bmN0aW9uIGV4cGFuZGVkTWVzc2FnZShlcnJvcjogYW55KTogc3RyaW5nIHtcbiAgc3dpdGNoIChlcnJvci5tZXNzYWdlKSB7XG4gICAgY2FzZSAnUmVmZXJlbmNlIHRvIG5vbi1leHBvcnRlZCBjbGFzcyc6XG4gICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0LmNsYXNzTmFtZSkge1xuICAgICAgICByZXR1cm4gYFJlZmVyZW5jZSB0byBhIG5vbi1leHBvcnRlZCBjbGFzcyAke1xuICAgICAgICAgICAgZXJyb3IuY29udGV4dC5jbGFzc05hbWV9LiBDb25zaWRlciBleHBvcnRpbmcgdGhlIGNsYXNzYDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1ZhcmlhYmxlIG5vdCBpbml0aWFsaXplZCc6XG4gICAgICByZXR1cm4gJ09ubHkgaW5pdGlhbGl6ZWQgdmFyaWFibGVzIGFuZCBjb25zdGFudHMgY2FuIGJlIHJlZmVyZW5jZWQgYmVjYXVzZSB0aGUgdmFsdWUgb2YgdGhpcyB2YXJpYWJsZSBpcyBuZWVkZWQgYnkgdGhlIHRlbXBsYXRlIGNvbXBpbGVyJztcbiAgICBjYXNlICdEZXN0cnVjdHVyaW5nIG5vdCBzdXBwb3J0ZWQnOlxuICAgICAgcmV0dXJuICdSZWZlcmVuY2luZyBhbiBleHBvcnRlZCBkZXN0cnVjdHVyZWQgdmFyaWFibGUgb3IgY29uc3RhbnQgaXMgbm90IHN1cHBvcnRlZCBieSB0aGUgdGVtcGxhdGUgY29tcGlsZXIuIENvbnNpZGVyIHNpbXBsaWZ5aW5nIHRoaXMgdG8gYXZvaWQgZGVzdHJ1Y3R1cmluZyc7XG4gICAgY2FzZSAnQ291bGQgbm90IHJlc29sdmUgdHlwZSc6XG4gICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0LnR5cGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBgQ291bGQgbm90IHJlc29sdmUgdHlwZSAke2Vycm9yLmNvbnRleHQudHlwZU5hbWV9YDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0Z1bmN0aW9uIGNhbGwgbm90IHN1cHBvcnRlZCc6XG4gICAgICBsZXQgcHJlZml4ID1cbiAgICAgICAgICBlcnJvci5jb250ZXh0ICYmIGVycm9yLmNvbnRleHQubmFtZSA/IGBDYWxsaW5nIGZ1bmN0aW9uICcke2Vycm9yLmNvbnRleHQubmFtZX0nLCBmYCA6ICdGJztcbiAgICAgIHJldHVybiBwcmVmaXggK1xuICAgICAgICAgICd1bmN0aW9uIGNhbGxzIGFyZSBub3Qgc3VwcG9ydGVkLiBDb25zaWRlciByZXBsYWNpbmcgdGhlIGZ1bmN0aW9uIG9yIGxhbWJkYSB3aXRoIGEgcmVmZXJlbmNlIHRvIGFuIGV4cG9ydGVkIGZ1bmN0aW9uJztcbiAgICBjYXNlICdSZWZlcmVuY2UgdG8gYSBsb2NhbCBzeW1ib2wnOlxuICAgICAgaWYgKGVycm9yLmNvbnRleHQgJiYgZXJyb3IuY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgUmVmZXJlbmNlIHRvIGEgbG9jYWwgKG5vbi1leHBvcnRlZCkgc3ltYm9sICcke1xuICAgICAgICAgICAgZXJyb3IuY29udGV4dC5uYW1lfScuIENvbnNpZGVyIGV4cG9ydGluZyB0aGUgc3ltYm9sYDtcbiAgICAgIH1cbiAgfVxuICByZXR1cm4gZXJyb3IubWVzc2FnZTtcbn1cbiJdfQ==