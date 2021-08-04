/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { absoluteFromSourceFile } from '../../../src/ngtsc/file_system';
import { ClassMemberKind, isConcreteDeclaration, isDecoratorIdentifier, isNamedClassDeclaration, isNamedFunctionDeclaration, isNamedVariableDeclaration, KnownDeclaration, reflectObjectLiteral, TypeScriptReflectionHost } from '../../../src/ngtsc/reflection';
import { isSymbolWithValueDeclaration } from '../../../src/ngtsc/util/src/typescript';
import { isWithinPackage } from '../analysis/util';
import { findAll, getNameText, hasNameIdentifier, isDefined, stripDollarSuffix } from '../utils';
import { isSwitchableVariableDeclaration, PRE_R3_MARKER } from './ngcc_host';
import { stripParentheses } from './utils';
export const DECORATORS = 'decorators';
export const PROP_DECORATORS = 'propDecorators';
export const CONSTRUCTOR = '__constructor';
export const CONSTRUCTOR_PARAMS = 'ctorParameters';
/**
 * Esm2015 packages contain ECMAScript 2015 classes, etc.
 * Decorators are defined via static properties on the class. For example:
 *
 * ```
 * class SomeDirective {
 * }
 * SomeDirective.decorators = [
 *   { type: Directive, args: [{ selector: '[someDirective]' },] }
 * ];
 * SomeDirective.ctorParameters = () => [
 *   { type: ViewContainerRef, },
 *   { type: TemplateRef, },
 *   { type: undefined, decorators: [{ type: Inject, args: [INJECTED_TOKEN,] },] },
 * ];
 * SomeDirective.propDecorators = {
 *   "input1": [{ type: Input },],
 *   "input2": [{ type: Input },],
 * };
 * ```
 *
 * * Classes are decorated if they have a static property called `decorators`.
 * * Members are decorated if there is a matching key on a static property
 *   called `propDecorators`.
 * * Constructor parameters decorators are found on an object returned from
 *   a static method called `ctorParameters`.
 */
export class Esm2015ReflectionHost extends TypeScriptReflectionHost {
    constructor(logger, isCore, src, dts = null) {
        super(src.program.getTypeChecker());
        this.logger = logger;
        this.isCore = isCore;
        this.src = src;
        this.dts = dts;
        /**
         * A mapping from source declarations to typings declarations, which are both publicly exported.
         *
         * There should be one entry for every public export visible from the root file of the source
         * tree. Note that by definition the key and value declarations will not be in the same TS
         * program.
         */
        this.publicDtsDeclarationMap = null;
        /**
         * A mapping from source declarations to typings declarations, which are not publicly exported.
         *
         * This mapping is a best guess between declarations that happen to be exported from their file by
         * the same name in both the source and the dts file. Note that by definition the key and value
         * declarations will not be in the same TS program.
         */
        this.privateDtsDeclarationMap = null;
        /**
         * The set of source files that have already been preprocessed.
         */
        this.preprocessedSourceFiles = new Set();
        /**
         * In ES2015, class declarations may have been down-leveled into variable declarations,
         * initialized using a class expression. In certain scenarios, an additional variable
         * is introduced that represents the class so that results in code such as:
         *
         * ```
         * let MyClass_1; let MyClass = MyClass_1 = class MyClass {};
         * ```
         *
         * This map tracks those aliased variables to their original identifier, i.e. the key
         * corresponds with the declaration of `MyClass_1` and its value becomes the `MyClass` identifier
         * of the variable declaration.
         *
         * This map is populated during the preprocessing of each source file.
         */
        this.aliasedClassDeclarations = new Map();
        /**
         * Caches the information of the decorators on a class, as the work involved with extracting
         * decorators is complex and frequently used.
         *
         * This map is lazily populated during the first call to `acquireDecoratorInfo` for a given class.
         */
        this.decoratorCache = new Map();
    }
    /**
     * Find a symbol for a node that we think is a class.
     * Classes should have a `name` identifier, because they may need to be referenced in other parts
     * of the program.
     *
     * In ES2015, a class may be declared using a variable declaration of the following structures:
     *
     * ```
     * var MyClass = MyClass_1 = class MyClass {};
     * ```
     *
     * or
     *
     * ```
     * var MyClass = MyClass_1 = (() => { class MyClass {} ... return MyClass; })()
     * ```
     *
     * Here, the intermediate `MyClass_1` assignment is optional. In the above example, the
     * `class MyClass {}` node is returned as declaration of `MyClass`.
     *
     * @param declaration the declaration node whose symbol we are finding.
     * @returns the symbol for the node or `undefined` if it is not a "class" or has no symbol.
     */
    getClassSymbol(declaration) {
        const symbol = this.getClassSymbolFromOuterDeclaration(declaration);
        if (symbol !== undefined) {
            return symbol;
        }
        const innerDeclaration = this.getInnerDeclarationFromAliasOrInner(declaration);
        return this.getClassSymbolFromInnerDeclaration(innerDeclaration);
    }
    /**
     * Examine a declaration (for example, of a class or function) and return metadata about any
     * decorators present on the declaration.
     *
     * @param declaration a TypeScript node representing the class or function over which to reflect.
     *     For example, if the intent is to reflect the decorators of a class and the source is in ES6
     *     format, this will be a `ts.ClassDeclaration` node. If the source is in ES5 format, this
     *     might be a `ts.VariableDeclaration` as classes in ES5 are represented as the result of an
     *     IIFE execution.
     *
     * @returns an array of `Decorator` metadata if decorators are present on the declaration, or
     *     `null` if either no decorators were present or if the declaration is not of a decoratable
     *     type.
     */
    getDecoratorsOfDeclaration(declaration) {
        const symbol = this.getClassSymbol(declaration);
        if (!symbol) {
            return null;
        }
        return this.getDecoratorsOfSymbol(symbol);
    }
    /**
     * Examine a declaration which should be of a class, and return metadata about the members of the
     * class.
     *
     * @param clazz a `ClassDeclaration` representing the class over which to reflect.
     *
     * @returns an array of `ClassMember` metadata representing the members of the class.
     *
     * @throws if `declaration` does not resolve to a class declaration.
     */
    getMembersOfClass(clazz) {
        const classSymbol = this.getClassSymbol(clazz);
        if (!classSymbol) {
            throw new Error(`Attempted to get members of a non-class: "${clazz.getText()}"`);
        }
        return this.getMembersOfSymbol(classSymbol);
    }
    /**
     * Reflect over the constructor of a class and return metadata about its parameters.
     *
     * This method only looks at the constructor of a class directly and not at any inherited
     * constructors.
     *
     * @param clazz a `ClassDeclaration` representing the class over which to reflect.
     *
     * @returns an array of `Parameter` metadata representing the parameters of the constructor, if
     * a constructor exists. If the constructor exists and has 0 parameters, this array will be empty.
     * If the class has no constructor, this method returns `null`.
     *
     * @throws if `declaration` does not resolve to a class declaration.
     */
    getConstructorParameters(clazz) {
        const classSymbol = this.getClassSymbol(clazz);
        if (!classSymbol) {
            throw new Error(`Attempted to get constructor parameters of a non-class: "${clazz.getText()}"`);
        }
        const parameterNodes = this.getConstructorParameterDeclarations(classSymbol);
        if (parameterNodes) {
            return this.getConstructorParamInfo(classSymbol, parameterNodes);
        }
        return null;
    }
    getBaseClassExpression(clazz) {
        // First try getting the base class from an ES2015 class declaration
        const superBaseClassIdentifier = super.getBaseClassExpression(clazz);
        if (superBaseClassIdentifier) {
            return superBaseClassIdentifier;
        }
        // That didn't work so now try getting it from the "inner" declaration.
        const classSymbol = this.getClassSymbol(clazz);
        if ((classSymbol === null || classSymbol === void 0 ? void 0 : classSymbol.implementation.valueDeclaration) === undefined ||
            !isNamedDeclaration(classSymbol.implementation.valueDeclaration)) {
            return null;
        }
        return super.getBaseClassExpression(classSymbol.implementation.valueDeclaration);
    }
    getInternalNameOfClass(clazz) {
        const classSymbol = this.getClassSymbol(clazz);
        if (classSymbol === undefined) {
            throw new Error(`getInternalNameOfClass() called on a non-class: expected ${clazz.name.text} to be a class declaration.`);
        }
        return this.getNameFromClassSymbolDeclaration(classSymbol, classSymbol.implementation.valueDeclaration);
    }
    getAdjacentNameOfClass(clazz) {
        const classSymbol = this.getClassSymbol(clazz);
        if (classSymbol === undefined) {
            throw new Error(`getAdjacentNameOfClass() called on a non-class: expected ${clazz.name.text} to be a class declaration.`);
        }
        return this.getAdjacentNameOfClassSymbol(classSymbol);
    }
    getNameFromClassSymbolDeclaration(classSymbol, declaration) {
        if (declaration === undefined) {
            throw new Error(`getInternalNameOfClass() called on a class with an undefined internal declaration. External class name: ${classSymbol.name}; internal class name: ${classSymbol.implementation.name}.`);
        }
        if (!isNamedDeclaration(declaration)) {
            throw new Error(`getInternalNameOfClass() called on a class with an anonymous inner declaration: expected a name on:\n${declaration.getText()}`);
        }
        return declaration.name;
    }
    /**
     * Check whether the given node actually represents a class.
     */
    isClass(node) {
        return super.isClass(node) || this.getClassSymbol(node) !== undefined;
    }
    /**
     * Trace an identifier to its declaration, if possible.
     *
     * This method attempts to resolve the declaration of the given identifier, tracing back through
     * imports and re-exports until the original declaration statement is found. A `Declaration`
     * object is returned if the original declaration is found, or `null` is returned otherwise.
     *
     * In ES2015, we need to account for identifiers that refer to aliased class declarations such as
     * `MyClass_1`. Since such declarations are only available within the module itself, we need to
     * find the original class declaration, e.g. `MyClass`, that is associated with the aliased one.
     *
     * @param id a TypeScript `ts.Identifier` to trace back to a declaration.
     *
     * @returns metadata about the `Declaration` if the original declaration is found, or `null`
     * otherwise.
     */
    getDeclarationOfIdentifier(id) {
        const superDeclaration = super.getDeclarationOfIdentifier(id);
        // If no declaration was found, return.
        if (superDeclaration === null) {
            return superDeclaration;
        }
        // If the declaration already has traits assigned to it, return as is.
        if (superDeclaration.known !== null ||
            isConcreteDeclaration(superDeclaration) && superDeclaration.identity !== null) {
            return superDeclaration;
        }
        let declarationNode = superDeclaration.node;
        if (isNamedVariableDeclaration(superDeclaration.node) && !isTopLevel(superDeclaration.node)) {
            const variableValue = this.getVariableValue(superDeclaration.node);
            if (variableValue !== null && ts.isClassExpression(variableValue)) {
                declarationNode = getContainingStatement(variableValue);
            }
        }
        const outerNode = getOuterNodeFromInnerDeclaration(declarationNode);
        const declaration = outerNode !== null && isNamedVariableDeclaration(outerNode) ?
            this.getDeclarationOfIdentifier(outerNode.name) :
            superDeclaration;
        if (declaration === null || declaration.known !== null ||
            isConcreteDeclaration(declaration) && declaration.identity !== null) {
            return declaration;
        }
        // The identifier may have been of an additional class assignment such as `MyClass_1` that was
        // present as alias for `MyClass`. If so, resolve such aliases to their original declaration.
        const aliasedIdentifier = this.resolveAliasedClassIdentifier(declaration.node);
        if (aliasedIdentifier !== null) {
            return this.getDeclarationOfIdentifier(aliasedIdentifier);
        }
        // Variable declarations may represent an enum declaration, so attempt to resolve its members.
        if (isConcreteDeclaration(declaration) && ts.isVariableDeclaration(declaration.node)) {
            const enumMembers = this.resolveEnumMembers(declaration.node);
            if (enumMembers !== null) {
                declaration.identity = { kind: 0 /* DownleveledEnum */, enumMembers };
            }
        }
        return declaration;
    }
    /**
     * Gets all decorators of the given class symbol. Any decorator that have been synthetically
     * injected by a migration will not be present in the returned collection.
     */
    getDecoratorsOfSymbol(symbol) {
        const { classDecorators } = this.acquireDecoratorInfo(symbol);
        if (classDecorators === null) {
            return null;
        }
        // Return a clone of the array to prevent consumers from mutating the cache.
        return Array.from(classDecorators);
    }
    /**
     * Search the given module for variable declarations in which the initializer
     * is an identifier marked with the `PRE_R3_MARKER`.
     * @param module the module in which to search for switchable declarations.
     * @returns an array of variable declarations that match.
     */
    getSwitchableDeclarations(module) {
        // Don't bother to walk the AST if the marker is not found in the text
        return module.getText().indexOf(PRE_R3_MARKER) >= 0 ?
            findAll(module, isSwitchableVariableDeclaration) :
            [];
    }
    getVariableValue(declaration) {
        const value = super.getVariableValue(declaration);
        if (value) {
            return value;
        }
        // We have a variable declaration that has no initializer. For example:
        //
        // ```
        // var HttpClientXsrfModule_1;
        // ```
        //
        // So look for the special scenario where the variable is being assigned in
        // a nearby statement to the return value of a call to `__decorate`.
        // Then find the 2nd argument of that call, the "target", which will be the
        // actual class identifier. For example:
        //
        // ```
        // HttpClientXsrfModule = HttpClientXsrfModule_1 = tslib_1.__decorate([
        //   NgModule({
        //     providers: [],
        //   })
        // ], HttpClientXsrfModule);
        // ```
        //
        // And finally, find the declaration of the identifier in that argument.
        // Note also that the assignment can occur within another assignment.
        //
        const block = declaration.parent.parent.parent;
        const symbol = this.checker.getSymbolAtLocation(declaration.name);
        if (symbol && (ts.isBlock(block) || ts.isSourceFile(block))) {
            const decorateCall = this.findDecoratedVariableValue(block, symbol);
            const target = decorateCall && decorateCall.arguments[1];
            if (target && ts.isIdentifier(target)) {
                const targetSymbol = this.checker.getSymbolAtLocation(target);
                const targetDeclaration = targetSymbol && targetSymbol.valueDeclaration;
                if (targetDeclaration) {
                    if (ts.isClassDeclaration(targetDeclaration) ||
                        ts.isFunctionDeclaration(targetDeclaration)) {
                        // The target is just a function or class declaration
                        // so return its identifier as the variable value.
                        return targetDeclaration.name || null;
                    }
                    else if (ts.isVariableDeclaration(targetDeclaration)) {
                        // The target is a variable declaration, so find the far right expression,
                        // in the case of multiple assignments (e.g. `var1 = var2 = value`).
                        let targetValue = targetDeclaration.initializer;
                        while (targetValue && isAssignment(targetValue)) {
                            targetValue = targetValue.right;
                        }
                        if (targetValue) {
                            return targetValue;
                        }
                    }
                }
            }
        }
        return null;
    }
    /**
     * Find all top-level class symbols in the given file.
     * @param sourceFile The source file to search for classes.
     * @returns An array of class symbols.
     */
    findClassSymbols(sourceFile) {
        const classes = new Map();
        this.getModuleStatements(sourceFile)
            .forEach(statement => this.addClassSymbolsFromStatement(classes, statement));
        return Array.from(classes.values());
    }
    /**
     * Get the number of generic type parameters of a given class.
     *
     * @param clazz a `ClassDeclaration` representing the class over which to reflect.
     *
     * @returns the number of type parameters of the class, if known, or `null` if the declaration
     * is not a class or has an unknown number of type parameters.
     */
    getGenericArityOfClass(clazz) {
        const dtsDeclaration = this.getDtsDeclaration(clazz);
        if (dtsDeclaration && ts.isClassDeclaration(dtsDeclaration)) {
            return dtsDeclaration.typeParameters ? dtsDeclaration.typeParameters.length : 0;
        }
        return null;
    }
    /**
     * Take an exported declaration of a class (maybe down-leveled to a variable) and look up the
     * declaration of its type in a separate .d.ts tree.
     *
     * This function is allowed to return `null` if the current compilation unit does not have a
     * separate .d.ts tree. When compiling TypeScript code this is always the case, since .d.ts files
     * are produced only during the emit of such a compilation. When compiling .js code, however,
     * there is frequently a parallel .d.ts tree which this method exposes.
     *
     * Note that the `ts.ClassDeclaration` returned from this function may not be from the same
     * `ts.Program` as the input declaration.
     */
    getDtsDeclaration(declaration) {
        if (this.dts === null) {
            return null;
        }
        if (!isNamedDeclaration(declaration)) {
            throw new Error(`Cannot get the dts file for a declaration that has no name: ${declaration.getText()} in ${declaration.getSourceFile().fileName}`);
        }
        const decl = this.getDeclarationOfIdentifier(declaration.name);
        if (decl === null) {
            throw new Error(`Cannot get the dts file for a node that cannot be associated with a declaration ${declaration.getText()} in ${declaration.getSourceFile().fileName}`);
        }
        // Try to retrieve the dts declaration from the public map
        if (this.publicDtsDeclarationMap === null) {
            this.publicDtsDeclarationMap = this.computePublicDtsDeclarationMap(this.src, this.dts);
        }
        if (this.publicDtsDeclarationMap.has(decl.node)) {
            return this.publicDtsDeclarationMap.get(decl.node);
        }
        // No public export, try the private map
        if (this.privateDtsDeclarationMap === null) {
            this.privateDtsDeclarationMap = this.computePrivateDtsDeclarationMap(this.src, this.dts);
        }
        if (this.privateDtsDeclarationMap.has(decl.node)) {
            return this.privateDtsDeclarationMap.get(decl.node);
        }
        // No declaration found at all
        return null;
    }
    getEndOfClass(classSymbol) {
        const implementation = classSymbol.implementation;
        let last = implementation.valueDeclaration;
        const implementationStatement = getContainingStatement(last);
        if (implementationStatement === null)
            return last;
        const container = implementationStatement.parent;
        if (ts.isBlock(container)) {
            // Assume that the implementation is inside an IIFE
            const returnStatementIndex = container.statements.findIndex(ts.isReturnStatement);
            if (returnStatementIndex === -1) {
                throw new Error(`Compiled class wrapper IIFE does not have a return statement: ${classSymbol.name} in ${classSymbol.declaration.valueDeclaration.getSourceFile().fileName}`);
            }
            // Return the statement before the IIFE return statement
            last = container.statements[returnStatementIndex - 1];
        }
        else if (ts.isSourceFile(container)) {
            // If there are static members on this class then find the last one
            if (implementation.exports !== undefined) {
                implementation.exports.forEach(exportSymbol => {
                    if (exportSymbol.valueDeclaration === undefined) {
                        return;
                    }
                    const exportStatement = getContainingStatement(exportSymbol.valueDeclaration);
                    if (exportStatement !== null && last.getEnd() < exportStatement.getEnd()) {
                        last = exportStatement;
                    }
                });
            }
            // If there are helper calls for this class then find the last one
            const helpers = this.getHelperCallsForClass(classSymbol, ['__decorate', '__extends', '__param', '__metadata']);
            helpers.forEach(helper => {
                const helperStatement = getContainingStatement(helper);
                if (helperStatement !== null && last.getEnd() < helperStatement.getEnd()) {
                    last = helperStatement;
                }
            });
        }
        return last;
    }
    /**
     * Check whether a `Declaration` corresponds with a known declaration, such as `Object`, and set
     * its `known` property to the appropriate `KnownDeclaration`.
     *
     * @param decl The `Declaration` to check.
     * @return The passed in `Declaration` (potentially enhanced with a `KnownDeclaration`).
     */
    detectKnownDeclaration(decl) {
        if (decl.known === null && this.isJavaScriptObjectDeclaration(decl)) {
            // If the identifier resolves to the global JavaScript `Object`, update the declaration to
            // denote it as the known `JsGlobalObject` declaration.
            decl.known = KnownDeclaration.JsGlobalObject;
        }
        return decl;
    }
    ///////////// Protected Helpers /////////////
    /**
     * Extract all the "classes" from the `statement` and add them to the `classes` map.
     */
    addClassSymbolsFromStatement(classes, statement) {
        if (ts.isVariableStatement(statement)) {
            statement.declarationList.declarations.forEach(declaration => {
                const classSymbol = this.getClassSymbol(declaration);
                if (classSymbol) {
                    classes.set(classSymbol.implementation, classSymbol);
                }
            });
        }
        else if (ts.isClassDeclaration(statement)) {
            const classSymbol = this.getClassSymbol(statement);
            if (classSymbol) {
                classes.set(classSymbol.implementation, classSymbol);
            }
        }
    }
    /**
     * Compute the inner declaration node of a "class" from the given `declaration` node.
     *
     * @param declaration a node that is either an inner declaration or an alias of a class.
     */
    getInnerDeclarationFromAliasOrInner(declaration) {
        if (declaration.parent !== undefined && isNamedVariableDeclaration(declaration.parent)) {
            const variableValue = this.getVariableValue(declaration.parent);
            if (variableValue !== null) {
                declaration = variableValue;
            }
        }
        return declaration;
    }
    /**
     * A class may be declared as a top level class declaration:
     *
     * ```
     * class OuterClass { ... }
     * ```
     *
     * or in a variable declaration to a class expression:
     *
     * ```
     * var OuterClass = ClassAlias = class InnerClass {};
     * ```
     *
     * or in a variable declaration to an IIFE containing a class declaration
     *
     * ```
     * var OuterClass = ClassAlias = (() => {
     *   class InnerClass {}
     *   ...
     *   return InnerClass;
     * })()
     * ```
     *
     * or in a variable declaration to an IIFE containing a function declaration
     *
     * ```
     * var OuterClass = ClassAlias = (() => {
     *   function InnerClass() {}
     *   ...
     *   return InnerClass;
     * })()
     * ```
     *
     * This method returns an `NgccClassSymbol` when provided with one of these cases.
     *
     * @param declaration the declaration whose symbol we are finding.
     * @returns the symbol for the class or `undefined` if `declaration` does not represent an outer
     *     declaration of a class.
     */
    getClassSymbolFromOuterDeclaration(declaration) {
        // Return a class symbol without an inner declaration if it is a regular "top level" class
        if (isNamedClassDeclaration(declaration) && isTopLevel(declaration)) {
            return this.createClassSymbol(declaration.name, null);
        }
        // Otherwise, an outer class declaration must be an initialized variable declaration:
        if (!isInitializedVariableClassDeclaration(declaration)) {
            return undefined;
        }
        const innerDeclaration = getInnerClassDeclaration(skipClassAliases(declaration));
        if (innerDeclaration === null) {
            return undefined;
        }
        return this.createClassSymbol(declaration.name, innerDeclaration);
    }
    /**
     * In ES2015, a class may be declared using a variable declaration of the following structures:
     *
     * ```
     * let MyClass = MyClass_1 = class MyClass {};
     * ```
     *
     * or
     *
     * ```
     * let MyClass = MyClass_1 = (() => { class MyClass {} ... return MyClass; })()
     * ```
     *
     * or
     *
     * ```
     * let MyClass = MyClass_1 = (() => { let MyClass = class MyClass {}; ... return MyClass; })()
     * ```
     *
     * This method extracts the `NgccClassSymbol` for `MyClass` when provided with the
     * `class MyClass {}` declaration node. When the `var MyClass` node or any other node is given,
     * this method will return undefined instead.
     *
     * @param declaration the declaration whose symbol we are finding.
     * @returns the symbol for the node or `undefined` if it does not represent an inner declaration
     * of a class.
     */
    getClassSymbolFromInnerDeclaration(declaration) {
        let outerDeclaration = undefined;
        if (ts.isClassExpression(declaration) && hasNameIdentifier(declaration)) {
            // Handle `let MyClass = MyClass_1 = class MyClass {};`
            outerDeclaration = getFarLeftHandSideOfAssignment(declaration);
            // Handle this being in an IIFE
            if (outerDeclaration !== undefined && !isTopLevel(outerDeclaration)) {
                outerDeclaration = getContainingVariableDeclaration(outerDeclaration);
            }
        }
        else if (isNamedClassDeclaration(declaration)) {
            // Handle `class MyClass {}` statement
            if (isTopLevel(declaration)) {
                // At the top level
                outerDeclaration = declaration;
            }
            else {
                // Or inside an IIFE
                outerDeclaration = getContainingVariableDeclaration(declaration);
            }
        }
        if (outerDeclaration === undefined || !hasNameIdentifier(outerDeclaration)) {
            return undefined;
        }
        return this.createClassSymbol(outerDeclaration.name, declaration);
    }
    /**
     * Creates an `NgccClassSymbol` from an outer and inner declaration. If a class only has an outer
     * declaration, the "implementation" symbol of the created `NgccClassSymbol` will be set equal to
     * the "declaration" symbol.
     *
     * @param outerDeclaration The outer declaration node of the class.
     * @param innerDeclaration The inner declaration node of the class, or undefined if no inner
     * declaration is present.
     * @returns the `NgccClassSymbol` representing the class, or undefined if a `ts.Symbol` for any of
     * the declarations could not be resolved.
     */
    createClassSymbol(outerDeclaration, innerDeclaration) {
        const declarationSymbol = this.checker.getSymbolAtLocation(outerDeclaration);
        if (declarationSymbol === undefined) {
            return undefined;
        }
        let implementationSymbol = declarationSymbol;
        if (innerDeclaration !== null && isNamedDeclaration(innerDeclaration)) {
            implementationSymbol = this.checker.getSymbolAtLocation(innerDeclaration.name);
        }
        if (!isSymbolWithValueDeclaration(implementationSymbol)) {
            return undefined;
        }
        const classSymbol = {
            name: declarationSymbol.name,
            declaration: declarationSymbol,
            implementation: implementationSymbol,
            adjacent: this.getAdjacentSymbol(declarationSymbol, implementationSymbol),
        };
        return classSymbol;
    }
    getAdjacentSymbol(declarationSymbol, implementationSymbol) {
        if (declarationSymbol === implementationSymbol) {
            return undefined;
        }
        const innerDeclaration = implementationSymbol.valueDeclaration;
        if (!ts.isClassExpression(innerDeclaration) && !ts.isFunctionExpression(innerDeclaration)) {
            return undefined;
        }
        // Deal with the inner class looking like this inside an IIFE:
        // `let MyClass = class MyClass {};` or `var MyClass = function MyClass() {};`
        const adjacentDeclaration = getFarLeftHandSideOfAssignment(innerDeclaration);
        if (adjacentDeclaration === undefined || !isNamedVariableDeclaration(adjacentDeclaration)) {
            return undefined;
        }
        const adjacentSymbol = this.checker.getSymbolAtLocation(adjacentDeclaration.name);
        if (adjacentSymbol === declarationSymbol || adjacentSymbol === implementationSymbol ||
            !isSymbolWithValueDeclaration(adjacentSymbol)) {
            return undefined;
        }
        return adjacentSymbol;
    }
    /**
     * Resolve a `ts.Symbol` to its declaration and detect whether it corresponds with a known
     * declaration.
     */
    getDeclarationOfSymbol(symbol, originalId) {
        const declaration = super.getDeclarationOfSymbol(symbol, originalId);
        if (declaration === null) {
            return null;
        }
        return this.detectKnownDeclaration(declaration);
    }
    /**
     * Finds the identifier of the actual class declaration for a potentially aliased declaration of a
     * class.
     *
     * If the given declaration is for an alias of a class, this function will determine an identifier
     * to the original declaration that represents this class.
     *
     * @param declaration The declaration to resolve.
     * @returns The original identifier that the given class declaration resolves to, or `undefined`
     * if the declaration does not represent an aliased class.
     */
    resolveAliasedClassIdentifier(declaration) {
        this.ensurePreprocessed(declaration.getSourceFile());
        return this.aliasedClassDeclarations.has(declaration) ?
            this.aliasedClassDeclarations.get(declaration) :
            null;
    }
    /**
     * Ensures that the source file that `node` is part of has been preprocessed.
     *
     * During preprocessing, all statements in the source file will be visited such that certain
     * processing steps can be done up-front and cached for subsequent usages.
     *
     * @param sourceFile The source file that needs to have gone through preprocessing.
     */
    ensurePreprocessed(sourceFile) {
        if (!this.preprocessedSourceFiles.has(sourceFile)) {
            this.preprocessedSourceFiles.add(sourceFile);
            for (const statement of this.getModuleStatements(sourceFile)) {
                this.preprocessStatement(statement);
            }
        }
    }
    /**
     * Analyzes the given statement to see if it corresponds with a variable declaration like
     * `let MyClass = MyClass_1 = class MyClass {};`. If so, the declaration of `MyClass_1`
     * is associated with the `MyClass` identifier.
     *
     * @param statement The statement that needs to be preprocessed.
     */
    preprocessStatement(statement) {
        if (!ts.isVariableStatement(statement)) {
            return;
        }
        const declarations = statement.declarationList.declarations;
        if (declarations.length !== 1) {
            return;
        }
        const declaration = declarations[0];
        const initializer = declaration.initializer;
        if (!ts.isIdentifier(declaration.name) || !initializer || !isAssignment(initializer) ||
            !ts.isIdentifier(initializer.left) || !this.isClass(declaration)) {
            return;
        }
        const aliasedIdentifier = initializer.left;
        const aliasedDeclaration = this.getDeclarationOfIdentifier(aliasedIdentifier);
        if (aliasedDeclaration === null) {
            throw new Error(`Unable to locate declaration of ${aliasedIdentifier.text} in "${statement.getText()}"`);
        }
        this.aliasedClassDeclarations.set(aliasedDeclaration.node, declaration.name);
    }
    /**
     * Get the top level statements for a module.
     *
     * In ES5 and ES2015 this is just the top level statements of the file.
     * @param sourceFile The module whose statements we want.
     * @returns An array of top level statements for the given module.
     */
    getModuleStatements(sourceFile) {
        return Array.from(sourceFile.statements);
    }
    /**
     * Walk the AST looking for an assignment to the specified symbol.
     * @param node The current node we are searching.
     * @returns an expression that represents the value of the variable, or undefined if none can be
     * found.
     */
    findDecoratedVariableValue(node, symbol) {
        if (!node) {
            return null;
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = node.left;
            const right = node.right;
            if (ts.isIdentifier(left) && this.checker.getSymbolAtLocation(left) === symbol) {
                return (ts.isCallExpression(right) && getCalleeName(right) === '__decorate') ? right : null;
            }
            return this.findDecoratedVariableValue(right, symbol);
        }
        return node.forEachChild(node => this.findDecoratedVariableValue(node, symbol)) || null;
    }
    /**
     * Try to retrieve the symbol of a static property on a class.
     *
     * In some cases, a static property can either be set on the inner (implementation or adjacent)
     * declaration inside the class' IIFE, or it can be set on the outer variable declaration.
     * Therefore, the host checks all places, first looking up the property on the inner symbols, and
     * if the property is not found it will fall back to looking up the property on the outer symbol.
     *
     * @param symbol the class whose property we are interested in.
     * @param propertyName the name of static property.
     * @returns the symbol if it is found or `undefined` if not.
     */
    getStaticProperty(symbol, propertyName) {
        var _a, _b, _c, _d;
        return ((_a = symbol.implementation.exports) === null || _a === void 0 ? void 0 : _a.get(propertyName)) ||
            ((_c = (_b = symbol.adjacent) === null || _b === void 0 ? void 0 : _b.exports) === null || _c === void 0 ? void 0 : _c.get(propertyName)) ||
            ((_d = symbol.declaration.exports) === null || _d === void 0 ? void 0 : _d.get(propertyName));
    }
    /**
     * This is the main entry-point for obtaining information on the decorators of a given class. This
     * information is computed either from static properties if present, or using `tslib.__decorate`
     * helper calls otherwise. The computed result is cached per class.
     *
     * @param classSymbol the class for which decorators should be acquired.
     * @returns all information of the decorators on the class.
     */
    acquireDecoratorInfo(classSymbol) {
        const decl = classSymbol.declaration.valueDeclaration;
        if (this.decoratorCache.has(decl)) {
            return this.decoratorCache.get(decl);
        }
        // Extract decorators from static properties and `__decorate` helper calls, then merge them
        // together where the information from the static properties is preferred.
        const staticProps = this.computeDecoratorInfoFromStaticProperties(classSymbol);
        const helperCalls = this.computeDecoratorInfoFromHelperCalls(classSymbol);
        const decoratorInfo = {
            classDecorators: staticProps.classDecorators || helperCalls.classDecorators,
            memberDecorators: staticProps.memberDecorators || helperCalls.memberDecorators,
            constructorParamInfo: staticProps.constructorParamInfo || helperCalls.constructorParamInfo,
        };
        this.decoratorCache.set(decl, decoratorInfo);
        return decoratorInfo;
    }
    /**
     * Attempts to compute decorator information from static properties "decorators", "propDecorators"
     * and "ctorParameters" on the class. If neither of these static properties is present the
     * library is likely not compiled using tsickle for usage with Closure compiler, in which case
     * `null` is returned.
     *
     * @param classSymbol The class symbol to compute the decorators information for.
     * @returns All information on the decorators as extracted from static properties, or `null` if
     * none of the static properties exist.
     */
    computeDecoratorInfoFromStaticProperties(classSymbol) {
        let classDecorators = null;
        let memberDecorators = null;
        let constructorParamInfo = null;
        const decoratorsProperty = this.getStaticProperty(classSymbol, DECORATORS);
        if (decoratorsProperty !== undefined) {
            classDecorators = this.getClassDecoratorsFromStaticProperty(decoratorsProperty);
        }
        const propDecoratorsProperty = this.getStaticProperty(classSymbol, PROP_DECORATORS);
        if (propDecoratorsProperty !== undefined) {
            memberDecorators = this.getMemberDecoratorsFromStaticProperty(propDecoratorsProperty);
        }
        const constructorParamsProperty = this.getStaticProperty(classSymbol, CONSTRUCTOR_PARAMS);
        if (constructorParamsProperty !== undefined) {
            constructorParamInfo = this.getParamInfoFromStaticProperty(constructorParamsProperty);
        }
        return { classDecorators, memberDecorators, constructorParamInfo };
    }
    /**
     * Get all class decorators for the given class, where the decorators are declared
     * via a static property. For example:
     *
     * ```
     * class SomeDirective {}
     * SomeDirective.decorators = [
     *   { type: Directive, args: [{ selector: '[someDirective]' },] }
     * ];
     * ```
     *
     * @param decoratorsSymbol the property containing the decorators we want to get.
     * @returns an array of decorators or null if none where found.
     */
    getClassDecoratorsFromStaticProperty(decoratorsSymbol) {
        const decoratorsIdentifier = decoratorsSymbol.valueDeclaration;
        if (decoratorsIdentifier && decoratorsIdentifier.parent) {
            if (ts.isBinaryExpression(decoratorsIdentifier.parent) &&
                decoratorsIdentifier.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                // AST of the array of decorator values
                const decoratorsArray = decoratorsIdentifier.parent.right;
                return this.reflectDecorators(decoratorsArray)
                    .filter(decorator => this.isFromCore(decorator));
            }
        }
        return null;
    }
    /**
     * Examine a symbol which should be of a class, and return metadata about its members.
     *
     * @param symbol the `ClassSymbol` representing the class over which to reflect.
     * @returns an array of `ClassMember` metadata representing the members of the class.
     */
    getMembersOfSymbol(symbol) {
        const members = [];
        // The decorators map contains all the properties that are decorated
        const { memberDecorators } = this.acquireDecoratorInfo(symbol);
        // Make a copy of the decorators as successfully reflected members delete themselves from the
        // map, so that any leftovers can be easily dealt with.
        const decoratorsMap = new Map(memberDecorators);
        // The member map contains all the method (instance and static); and any instance properties
        // that are initialized in the class.
        if (symbol.implementation.members) {
            symbol.implementation.members.forEach((value, key) => {
                const decorators = decoratorsMap.get(key);
                const reflectedMembers = this.reflectMembers(value, decorators);
                if (reflectedMembers) {
                    decoratorsMap.delete(key);
                    members.push(...reflectedMembers);
                }
            });
        }
        // The static property map contains all the static properties
        if (symbol.implementation.exports) {
            symbol.implementation.exports.forEach((value, key) => {
                const decorators = decoratorsMap.get(key);
                const reflectedMembers = this.reflectMembers(value, decorators, true);
                if (reflectedMembers) {
                    decoratorsMap.delete(key);
                    members.push(...reflectedMembers);
                }
            });
        }
        // If this class was declared as a VariableDeclaration then it may have static properties
        // attached to the variable rather than the class itself
        // For example:
        // ```
        // let MyClass = class MyClass {
        //   // no static properties here!
        // }
        // MyClass.staticProperty = ...;
        // ```
        if (ts.isVariableDeclaration(symbol.declaration.valueDeclaration)) {
            if (symbol.declaration.exports) {
                symbol.declaration.exports.forEach((value, key) => {
                    const decorators = decoratorsMap.get(key);
                    const reflectedMembers = this.reflectMembers(value, decorators, true);
                    if (reflectedMembers) {
                        decoratorsMap.delete(key);
                        members.push(...reflectedMembers);
                    }
                });
            }
        }
        // If this class was declared as a VariableDeclaration inside an IIFE, then it may have static
        // properties attached to the variable rather than the class itself.
        //
        // For example:
        // ```
        // let OuterClass = (() => {
        //   let AdjacentClass = class InternalClass {
        //     // no static properties here!
        //   }
        //   AdjacentClass.staticProperty = ...;
        // })();
        // ```
        if (symbol.adjacent !== undefined) {
            if (ts.isVariableDeclaration(symbol.adjacent.valueDeclaration)) {
                if (symbol.adjacent.exports !== undefined) {
                    symbol.adjacent.exports.forEach((value, key) => {
                        const decorators = decoratorsMap.get(key);
                        const reflectedMembers = this.reflectMembers(value, decorators, true);
                        if (reflectedMembers) {
                            decoratorsMap.delete(key);
                            members.push(...reflectedMembers);
                        }
                    });
                }
            }
        }
        // Deal with any decorated properties that were not initialized in the class
        decoratorsMap.forEach((value, key) => {
            members.push({
                implementation: null,
                decorators: value,
                isStatic: false,
                kind: ClassMemberKind.Property,
                name: key,
                nameNode: null,
                node: null,
                type: null,
                value: null
            });
        });
        return members;
    }
    /**
     * Member decorators may be declared as static properties of the class:
     *
     * ```
     * SomeDirective.propDecorators = {
     *   "ngForOf": [{ type: Input },],
     *   "ngForTrackBy": [{ type: Input },],
     *   "ngForTemplate": [{ type: Input },],
     * };
     * ```
     *
     * @param decoratorsProperty the class whose member decorators we are interested in.
     * @returns a map whose keys are the name of the members and whose values are collections of
     * decorators for the given member.
     */
    getMemberDecoratorsFromStaticProperty(decoratorsProperty) {
        const memberDecorators = new Map();
        // Symbol of the identifier for `SomeDirective.propDecorators`.
        const propDecoratorsMap = getPropertyValueFromSymbol(decoratorsProperty);
        if (propDecoratorsMap && ts.isObjectLiteralExpression(propDecoratorsMap)) {
            const propertiesMap = reflectObjectLiteral(propDecoratorsMap);
            propertiesMap.forEach((value, name) => {
                const decorators = this.reflectDecorators(value).filter(decorator => this.isFromCore(decorator));
                if (decorators.length) {
                    memberDecorators.set(name, decorators);
                }
            });
        }
        return memberDecorators;
    }
    /**
     * For a given class symbol, collects all decorator information from tslib helper methods, as
     * generated by TypeScript into emitted JavaScript files.
     *
     * Class decorators are extracted from calls to `tslib.__decorate` that look as follows:
     *
     * ```
     * let SomeDirective = class SomeDirective {}
     * SomeDirective = __decorate([
     *   Directive({ selector: '[someDirective]' }),
     * ], SomeDirective);
     * ```
     *
     * The extraction of member decorators is similar, with the distinction that its 2nd and 3rd
     * argument correspond with a "prototype" target and the name of the member to which the
     * decorators apply.
     *
     * ```
     * __decorate([
     *     Input(),
     *     __metadata("design:type", String)
     * ], SomeDirective.prototype, "input1", void 0);
     * ```
     *
     * @param classSymbol The class symbol for which decorators should be extracted.
     * @returns All information on the decorators of the class.
     */
    computeDecoratorInfoFromHelperCalls(classSymbol) {
        let classDecorators = null;
        const memberDecorators = new Map();
        const constructorParamInfo = [];
        const getConstructorParamInfo = (index) => {
            let param = constructorParamInfo[index];
            if (param === undefined) {
                param = constructorParamInfo[index] = { decorators: null, typeExpression: null };
            }
            return param;
        };
        // All relevant information can be extracted from calls to `__decorate`, obtain these first.
        // Note that although the helper calls are retrieved using the class symbol, the result may
        // contain helper calls corresponding with unrelated classes. Therefore, each helper call still
        // has to be checked to actually correspond with the class symbol.
        const helperCalls = this.getHelperCallsForClass(classSymbol, ['__decorate']);
        const outerDeclaration = classSymbol.declaration.valueDeclaration;
        const innerDeclaration = classSymbol.implementation.valueDeclaration;
        const adjacentDeclaration = this.getAdjacentNameOfClassSymbol(classSymbol).parent;
        const matchesClass = (identifier) => {
            const decl = this.getDeclarationOfIdentifier(identifier);
            return decl !== null &&
                (decl.node === adjacentDeclaration || decl.node === outerDeclaration ||
                    decl.node === innerDeclaration);
        };
        for (const helperCall of helperCalls) {
            if (isClassDecorateCall(helperCall, matchesClass)) {
                // This `__decorate` call is targeting the class itself.
                const helperArgs = helperCall.arguments[0];
                for (const element of helperArgs.elements) {
                    const entry = this.reflectDecorateHelperEntry(element);
                    if (entry === null) {
                        continue;
                    }
                    if (entry.type === 'decorator') {
                        // The helper arg was reflected to represent an actual decorator
                        if (this.isFromCore(entry.decorator)) {
                            (classDecorators || (classDecorators = [])).push(entry.decorator);
                        }
                    }
                    else if (entry.type === 'param:decorators') {
                        // The helper arg represents a decorator for a parameter. Since it's applied to the
                        // class, it corresponds with a constructor parameter of the class.
                        const param = getConstructorParamInfo(entry.index);
                        (param.decorators || (param.decorators = [])).push(entry.decorator);
                    }
                    else if (entry.type === 'params') {
                        // The helper arg represents the types of the parameters. Since it's applied to the
                        // class, it corresponds with the constructor parameters of the class.
                        entry.types.forEach((type, index) => getConstructorParamInfo(index).typeExpression = type);
                    }
                }
            }
            else if (isMemberDecorateCall(helperCall, matchesClass)) {
                // The `__decorate` call is targeting a member of the class
                const helperArgs = helperCall.arguments[0];
                const memberName = helperCall.arguments[2].text;
                for (const element of helperArgs.elements) {
                    const entry = this.reflectDecorateHelperEntry(element);
                    if (entry === null) {
                        continue;
                    }
                    if (entry.type === 'decorator') {
                        // The helper arg was reflected to represent an actual decorator.
                        if (this.isFromCore(entry.decorator)) {
                            const decorators = memberDecorators.has(memberName) ? memberDecorators.get(memberName) : [];
                            decorators.push(entry.decorator);
                            memberDecorators.set(memberName, decorators);
                        }
                    }
                    else {
                        // Information on decorated parameters is not interesting for ngcc, so it's ignored.
                    }
                }
            }
        }
        return { classDecorators, memberDecorators, constructorParamInfo };
    }
    /**
     * Extract the details of an entry within a `__decorate` helper call. For example, given the
     * following code:
     *
     * ```
     * __decorate([
     *   Directive({ selector: '[someDirective]' }),
     *   tslib_1.__param(2, Inject(INJECTED_TOKEN)),
     *   tslib_1.__metadata("design:paramtypes", [ViewContainerRef, TemplateRef, String])
     * ], SomeDirective);
     * ```
     *
     * it can be seen that there are calls to regular decorators (the `Directive`) and calls into
     * `tslib` functions which have been inserted by TypeScript. Therefore, this function classifies
     * a call to correspond with
     *   1. a real decorator like `Directive` above, or
     *   2. a decorated parameter, corresponding with `__param` calls from `tslib`, or
     *   3. the type information of parameters, corresponding with `__metadata` call from `tslib`
     *
     * @param expression the expression that needs to be reflected into a `DecorateHelperEntry`
     * @returns an object that indicates which of the three categories the call represents, together
     * with the reflected information of the call, or null if the call is not a valid decorate call.
     */
    reflectDecorateHelperEntry(expression) {
        // We only care about those elements that are actual calls
        if (!ts.isCallExpression(expression)) {
            return null;
        }
        const call = expression;
        const helperName = getCalleeName(call);
        if (helperName === '__metadata') {
            // This is a `tslib.__metadata` call, reflect to arguments into a `ParameterTypes` object
            // if the metadata key is "design:paramtypes".
            const key = call.arguments[0];
            if (key === undefined || !ts.isStringLiteral(key) || key.text !== 'design:paramtypes') {
                return null;
            }
            const value = call.arguments[1];
            if (value === undefined || !ts.isArrayLiteralExpression(value)) {
                return null;
            }
            return {
                type: 'params',
                types: Array.from(value.elements),
            };
        }
        if (helperName === '__param') {
            // This is a `tslib.__param` call that is reflected into a `ParameterDecorators` object.
            const indexArg = call.arguments[0];
            const index = indexArg && ts.isNumericLiteral(indexArg) ? parseInt(indexArg.text, 10) : NaN;
            if (isNaN(index)) {
                return null;
            }
            const decoratorCall = call.arguments[1];
            if (decoratorCall === undefined || !ts.isCallExpression(decoratorCall)) {
                return null;
            }
            const decorator = this.reflectDecoratorCall(decoratorCall);
            if (decorator === null) {
                return null;
            }
            return {
                type: 'param:decorators',
                index,
                decorator,
            };
        }
        // Otherwise attempt to reflect it as a regular decorator.
        const decorator = this.reflectDecoratorCall(call);
        if (decorator === null) {
            return null;
        }
        return {
            type: 'decorator',
            decorator,
        };
    }
    reflectDecoratorCall(call) {
        const decoratorExpression = call.expression;
        if (!isDecoratorIdentifier(decoratorExpression)) {
            return null;
        }
        // We found a decorator!
        const decoratorIdentifier = ts.isIdentifier(decoratorExpression) ? decoratorExpression : decoratorExpression.name;
        return {
            name: decoratorIdentifier.text,
            identifier: decoratorExpression,
            import: this.getImportOfIdentifier(decoratorIdentifier),
            node: call,
            args: Array.from(call.arguments),
        };
    }
    /**
     * Check the given statement to see if it is a call to any of the specified helper functions or
     * null if not found.
     *
     * Matching statements will look like:  `tslib_1.__decorate(...);`.
     * @param statement the statement that may contain the call.
     * @param helperNames the names of the helper we are looking for.
     * @returns the node that corresponds to the `__decorate(...)` call or null if the statement
     * does not match.
     */
    getHelperCall(statement, helperNames) {
        if ((ts.isExpressionStatement(statement) || ts.isReturnStatement(statement)) &&
            statement.expression) {
            let expression = statement.expression;
            while (isAssignment(expression)) {
                expression = expression.right;
            }
            if (ts.isCallExpression(expression)) {
                const calleeName = getCalleeName(expression);
                if (calleeName !== null && helperNames.includes(calleeName)) {
                    return expression;
                }
            }
        }
        return null;
    }
    /**
     * Reflect over the given array node and extract decorator information from each element.
     *
     * This is used for decorators that are defined in static properties. For example:
     *
     * ```
     * SomeDirective.decorators = [
     *   { type: Directive, args: [{ selector: '[someDirective]' },] }
     * ];
     * ```
     *
     * @param decoratorsArray an expression that contains decorator information.
     * @returns an array of decorator info that was reflected from the array node.
     */
    reflectDecorators(decoratorsArray) {
        const decorators = [];
        if (ts.isArrayLiteralExpression(decoratorsArray)) {
            // Add each decorator that is imported from `@angular/core` into the `decorators` array
            decoratorsArray.elements.forEach(node => {
                // If the decorator is not an object literal expression then we are not interested
                if (ts.isObjectLiteralExpression(node)) {
                    // We are only interested in objects of the form: `{ type: DecoratorType, args: [...] }`
                    const decorator = reflectObjectLiteral(node);
                    // Is the value of the `type` property an identifier?
                    if (decorator.has('type')) {
                        let decoratorType = decorator.get('type');
                        if (isDecoratorIdentifier(decoratorType)) {
                            const decoratorIdentifier = ts.isIdentifier(decoratorType) ? decoratorType : decoratorType.name;
                            decorators.push({
                                name: decoratorIdentifier.text,
                                identifier: decoratorType,
                                import: this.getImportOfIdentifier(decoratorIdentifier),
                                node,
                                args: getDecoratorArgs(node),
                            });
                        }
                    }
                }
            });
        }
        return decorators;
    }
    /**
     * Reflect over a symbol and extract the member information, combining it with the
     * provided decorator information, and whether it is a static member.
     *
     * A single symbol may represent multiple class members in the case of accessors;
     * an equally named getter/setter accessor pair is combined into a single symbol.
     * When the symbol is recognized as representing an accessor, its declarations are
     * analyzed such that both the setter and getter accessor are returned as separate
     * class members.
     *
     * One difference wrt the TypeScript host is that in ES2015, we cannot see which
     * accessor originally had any decorators applied to them, as decorators are applied
     * to the property descriptor in general, not a specific accessor. If an accessor
     * has both a setter and getter, any decorators are only attached to the setter member.
     *
     * @param symbol the symbol for the member to reflect over.
     * @param decorators an array of decorators associated with the member.
     * @param isStatic true if this member is static, false if it is an instance property.
     * @returns the reflected member information, or null if the symbol is not a member.
     */
    reflectMembers(symbol, decorators, isStatic) {
        if (symbol.flags & ts.SymbolFlags.Accessor) {
            const members = [];
            const setter = symbol.declarations && symbol.declarations.find(ts.isSetAccessor);
            const getter = symbol.declarations && symbol.declarations.find(ts.isGetAccessor);
            const setterMember = setter && this.reflectMember(setter, ClassMemberKind.Setter, decorators, isStatic);
            if (setterMember) {
                members.push(setterMember);
                // Prevent attaching the decorators to a potential getter. In ES2015, we can't tell where
                // the decorators were originally attached to, however we only want to attach them to a
                // single `ClassMember` as otherwise ngtsc would handle the same decorators twice.
                decorators = undefined;
            }
            const getterMember = getter && this.reflectMember(getter, ClassMemberKind.Getter, decorators, isStatic);
            if (getterMember) {
                members.push(getterMember);
            }
            return members;
        }
        let kind = null;
        if (symbol.flags & ts.SymbolFlags.Method) {
            kind = ClassMemberKind.Method;
        }
        else if (symbol.flags & ts.SymbolFlags.Property) {
            kind = ClassMemberKind.Property;
        }
        const node = symbol.valueDeclaration || symbol.declarations && symbol.declarations[0];
        if (!node) {
            // If the symbol has been imported from a TypeScript typings file then the compiler
            // may pass the `prototype` symbol as an export of the class.
            // But this has no declaration. In this case we just quietly ignore it.
            return null;
        }
        const member = this.reflectMember(node, kind, decorators, isStatic);
        if (!member) {
            return null;
        }
        return [member];
    }
    /**
     * Reflect over a symbol and extract the member information, combining it with the
     * provided decorator information, and whether it is a static member.
     * @param node the declaration node for the member to reflect over.
     * @param kind the assumed kind of the member, may become more accurate during reflection.
     * @param decorators an array of decorators associated with the member.
     * @param isStatic true if this member is static, false if it is an instance property.
     * @returns the reflected member information, or null if the symbol is not a member.
     */
    reflectMember(node, kind, decorators, isStatic) {
        let value = null;
        let name = null;
        let nameNode = null;
        if (!isClassMemberType(node)) {
            return null;
        }
        if (isStatic && isPropertyAccess(node)) {
            name = node.name.text;
            value = kind === ClassMemberKind.Property ? node.parent.right : null;
        }
        else if (isThisAssignment(node)) {
            kind = ClassMemberKind.Property;
            name = node.left.name.text;
            value = node.right;
            isStatic = false;
        }
        else if (ts.isConstructorDeclaration(node)) {
            kind = ClassMemberKind.Constructor;
            name = 'constructor';
            isStatic = false;
        }
        if (kind === null) {
            this.logger.warn(`Unknown member type: "${node.getText()}`);
            return null;
        }
        if (!name) {
            if (isNamedDeclaration(node)) {
                name = node.name.text;
                nameNode = node.name;
            }
            else {
                return null;
            }
        }
        // If we have still not determined if this is a static or instance member then
        // look for the `static` keyword on the declaration
        if (isStatic === undefined) {
            isStatic = node.modifiers !== undefined &&
                node.modifiers.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
        }
        const type = node.type || null;
        return {
            node,
            implementation: node,
            kind,
            type,
            name,
            nameNode,
            value,
            isStatic,
            decorators: decorators || []
        };
    }
    /**
     * Find the declarations of the constructor parameters of a class identified by its symbol.
     * @param classSymbol the class whose parameters we want to find.
     * @returns an array of `ts.ParameterDeclaration` objects representing each of the parameters in
     * the class's constructor or null if there is no constructor.
     */
    getConstructorParameterDeclarations(classSymbol) {
        const members = classSymbol.implementation.members;
        if (members && members.has(CONSTRUCTOR)) {
            const constructorSymbol = members.get(CONSTRUCTOR);
            // For some reason the constructor does not have a `valueDeclaration` ?!?
            const constructor = constructorSymbol.declarations &&
                constructorSymbol.declarations[0];
            if (!constructor) {
                return [];
            }
            if (constructor.parameters.length > 0) {
                return Array.from(constructor.parameters);
            }
            if (isSynthesizedConstructor(constructor)) {
                return null;
            }
            return [];
        }
        return null;
    }
    /**
     * Get the parameter decorators of a class constructor.
     *
     * @param classSymbol the class whose parameter info we want to get.
     * @param parameterNodes the array of TypeScript parameter nodes for this class's constructor.
     * @returns an array of constructor parameter info objects.
     */
    getConstructorParamInfo(classSymbol, parameterNodes) {
        const { constructorParamInfo } = this.acquireDecoratorInfo(classSymbol);
        return parameterNodes.map((node, index) => {
            const { decorators, typeExpression } = constructorParamInfo[index] ?
                constructorParamInfo[index] :
                { decorators: null, typeExpression: null };
            const nameNode = node.name;
            const typeValueReference = this.typeToValue(typeExpression);
            return {
                name: getNameText(nameNode),
                nameNode,
                typeValueReference,
                typeNode: null,
                decorators
            };
        });
    }
    /**
     * Compute the `TypeValueReference` for the given `typeExpression`.
     *
     * Although `typeExpression` is a valid `ts.Expression` that could be emitted directly into the
     * generated code, ngcc still needs to resolve the declaration and create an `IMPORTED` type
     * value reference as the compiler has specialized handling for some symbols, for example
     * `ChangeDetectorRef` from `@angular/core`. Such an `IMPORTED` type value reference will result
     * in a newly generated namespace import, instead of emitting the original `typeExpression` as is.
     */
    typeToValue(typeExpression) {
        if (typeExpression === null) {
            return {
                kind: 2 /* UNAVAILABLE */,
                reason: { kind: 0 /* MISSING_TYPE */ },
            };
        }
        const imp = this.getImportOfExpression(typeExpression);
        const decl = this.getDeclarationOfExpression(typeExpression);
        if (imp === null || decl === null) {
            return {
                kind: 0 /* LOCAL */,
                expression: typeExpression,
                defaultImportStatement: null,
            };
        }
        return {
            kind: 1 /* IMPORTED */,
            valueDeclaration: decl.node,
            moduleName: imp.from,
            importedName: imp.name,
            nestedPath: null,
        };
    }
    /**
     * Determines where the `expression` is imported from.
     *
     * @param expression the expression to determine the import details for.
     * @returns the `Import` for the expression, or `null` if the expression is not imported or the
     * expression syntax is not supported.
     */
    getImportOfExpression(expression) {
        if (ts.isIdentifier(expression)) {
            return this.getImportOfIdentifier(expression);
        }
        else if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name)) {
            return this.getImportOfIdentifier(expression.name);
        }
        else {
            return null;
        }
    }
    /**
     * Get the parameter type and decorators for the constructor of a class,
     * where the information is stored on a static property of the class.
     *
     * Note that in ESM2015, the property is defined an array, or by an arrow function that returns
     * an array, of decorator and type information.
     *
     * For example,
     *
     * ```
     * SomeDirective.ctorParameters = () => [
     *   {type: ViewContainerRef},
     *   {type: TemplateRef},
     *   {type: undefined, decorators: [{ type: Inject, args: [INJECTED_TOKEN]}]},
     * ];
     * ```
     *
     * or
     *
     * ```
     * SomeDirective.ctorParameters = [
     *   {type: ViewContainerRef},
     *   {type: TemplateRef},
     *   {type: undefined, decorators: [{type: Inject, args: [INJECTED_TOKEN]}]},
     * ];
     * ```
     *
     * @param paramDecoratorsProperty the property that holds the parameter info we want to get.
     * @returns an array of objects containing the type and decorators for each parameter.
     */
    getParamInfoFromStaticProperty(paramDecoratorsProperty) {
        const paramDecorators = getPropertyValueFromSymbol(paramDecoratorsProperty);
        if (paramDecorators) {
            // The decorators array may be wrapped in an arrow function. If so unwrap it.
            const container = ts.isArrowFunction(paramDecorators) ? paramDecorators.body : paramDecorators;
            if (ts.isArrayLiteralExpression(container)) {
                const elements = container.elements;
                return elements
                    .map(element => ts.isObjectLiteralExpression(element) ? reflectObjectLiteral(element) : null)
                    .map(paramInfo => {
                    const typeExpression = paramInfo && paramInfo.has('type') ? paramInfo.get('type') : null;
                    const decoratorInfo = paramInfo && paramInfo.has('decorators') ? paramInfo.get('decorators') : null;
                    const decorators = decoratorInfo &&
                        this.reflectDecorators(decoratorInfo)
                            .filter(decorator => this.isFromCore(decorator));
                    return { typeExpression, decorators };
                });
            }
            else if (paramDecorators !== undefined) {
                this.logger.warn('Invalid constructor parameter decorator in ' +
                    paramDecorators.getSourceFile().fileName + ':\n', paramDecorators.getText());
            }
        }
        return null;
    }
    /**
     * Search statements related to the given class for calls to the specified helper.
     * @param classSymbol the class whose helper calls we are interested in.
     * @param helperNames the names of the helpers (e.g. `__decorate`) whose calls we are interested
     * in.
     * @returns an array of CallExpression nodes for each matching helper call.
     */
    getHelperCallsForClass(classSymbol, helperNames) {
        return this.getStatementsForClass(classSymbol)
            .map(statement => this.getHelperCall(statement, helperNames))
            .filter(isDefined);
    }
    /**
     * Find statements related to the given class that may contain calls to a helper.
     *
     * In ESM2015 code the helper calls are in the top level module, so we have to consider
     * all the statements in the module.
     *
     * @param classSymbol the class whose helper calls we are interested in.
     * @returns an array of statements that may contain helper calls.
     */
    getStatementsForClass(classSymbol) {
        const classNode = classSymbol.implementation.valueDeclaration;
        if (isTopLevel(classNode)) {
            return this.getModuleStatements(classNode.getSourceFile());
        }
        const statement = getContainingStatement(classNode);
        if (ts.isBlock(statement.parent)) {
            return Array.from(statement.parent.statements);
        }
        // We should never arrive here
        throw new Error(`Unable to find adjacent statements for ${classSymbol.name}`);
    }
    /**
     * Test whether a decorator was imported from `@angular/core`.
     *
     * Is the decorator:
     * * externally imported from `@angular/core`?
     * * the current hosted program is actually `@angular/core` and
     *   - relatively internally imported; or
     *   - not imported, from the current file.
     *
     * @param decorator the decorator to test.
     */
    isFromCore(decorator) {
        if (this.isCore) {
            return !decorator.import || /^\./.test(decorator.import.from);
        }
        else {
            return !!decorator.import && decorator.import.from === '@angular/core';
        }
    }
    /**
     * Create a mapping between the public exports in a src program and the public exports of a dts
     * program.
     *
     * @param src the program bundle containing the source files.
     * @param dts the program bundle containing the typings files.
     * @returns a map of source declarations to typings declarations.
     */
    computePublicDtsDeclarationMap(src, dts) {
        const declarationMap = new Map();
        const dtsDeclarationMap = new Map();
        const rootDts = getRootFileOrFail(dts);
        this.collectDtsExportedDeclarations(dtsDeclarationMap, rootDts, dts.program.getTypeChecker());
        const rootSrc = getRootFileOrFail(src);
        this.collectSrcExportedDeclarations(declarationMap, dtsDeclarationMap, rootSrc);
        return declarationMap;
    }
    /**
     * Create a mapping between the "private" exports in a src program and the "private" exports of a
     * dts program. These exports may be exported from individual files in the src or dts programs,
     * but not exported from the root file (i.e publicly from the entry-point).
     *
     * This mapping is a "best guess" since we cannot guarantee that two declarations that happen to
     * be exported from a file with the same name are actually equivalent. But this is a reasonable
     * estimate for the purposes of ngcc.
     *
     * @param src the program bundle containing the source files.
     * @param dts the program bundle containing the typings files.
     * @returns a map of source declarations to typings declarations.
     */
    computePrivateDtsDeclarationMap(src, dts) {
        const declarationMap = new Map();
        const dtsDeclarationMap = new Map();
        const typeChecker = dts.program.getTypeChecker();
        const dtsFiles = getNonRootPackageFiles(dts);
        for (const dtsFile of dtsFiles) {
            this.collectDtsExportedDeclarations(dtsDeclarationMap, dtsFile, typeChecker);
        }
        const srcFiles = getNonRootPackageFiles(src);
        for (const srcFile of srcFiles) {
            this.collectSrcExportedDeclarations(declarationMap, dtsDeclarationMap, srcFile);
        }
        return declarationMap;
    }
    /**
     * Collect mappings between names of exported declarations in a file and its actual declaration.
     *
     * Any new mappings are added to the `dtsDeclarationMap`.
     */
    collectDtsExportedDeclarations(dtsDeclarationMap, srcFile, checker) {
        const srcModule = srcFile && checker.getSymbolAtLocation(srcFile);
        const moduleExports = srcModule && checker.getExportsOfModule(srcModule);
        if (moduleExports) {
            moduleExports.forEach(exportedSymbol => {
                const name = exportedSymbol.name;
                if (exportedSymbol.flags & ts.SymbolFlags.Alias) {
                    exportedSymbol = checker.getAliasedSymbol(exportedSymbol);
                }
                const declaration = exportedSymbol.valueDeclaration;
                if (declaration && !dtsDeclarationMap.has(name)) {
                    dtsDeclarationMap.set(name, declaration);
                }
            });
        }
    }
    collectSrcExportedDeclarations(declarationMap, dtsDeclarationMap, srcFile) {
        const fileExports = this.getExportsOfModule(srcFile);
        if (fileExports !== null) {
            for (const [exportName, { node: declarationNode }] of fileExports) {
                if (dtsDeclarationMap.has(exportName)) {
                    declarationMap.set(declarationNode, dtsDeclarationMap.get(exportName));
                }
            }
        }
    }
    getDeclarationOfExpression(expression) {
        if (ts.isIdentifier(expression)) {
            return this.getDeclarationOfIdentifier(expression);
        }
        if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
            return null;
        }
        const namespaceDecl = this.getDeclarationOfIdentifier(expression.expression);
        if (!namespaceDecl || !ts.isSourceFile(namespaceDecl.node)) {
            return null;
        }
        const namespaceExports = this.getExportsOfModule(namespaceDecl.node);
        if (namespaceExports === null) {
            return null;
        }
        if (!namespaceExports.has(expression.name.text)) {
            return null;
        }
        const exportDecl = namespaceExports.get(expression.name.text);
        return Object.assign(Object.assign({}, exportDecl), { viaModule: namespaceDecl.viaModule });
    }
    /** Checks if the specified declaration resolves to the known JavaScript global `Object`. */
    isJavaScriptObjectDeclaration(decl) {
        const node = decl.node;
        // The default TypeScript library types the global `Object` variable through
        // a variable declaration with a type reference resolving to `ObjectConstructor`.
        if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) ||
            node.name.text !== 'Object' || node.type === undefined) {
            return false;
        }
        const typeNode = node.type;
        // If the variable declaration does not have a type resolving to `ObjectConstructor`,
        // we cannot guarantee that the declaration resolves to the global `Object` variable.
        if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName) ||
            typeNode.typeName.text !== 'ObjectConstructor') {
            return false;
        }
        // Finally, check if the type definition for `Object` originates from a default library
        // definition file. This requires default types to be enabled for the host program.
        return this.src.program.isSourceFileDefaultLibrary(node.getSourceFile());
    }
    /**
     * In JavaScript, enum declarations are emitted as a regular variable declaration followed by an
     * IIFE in which the enum members are assigned.
     *
     *   export var Enum;
     *   (function (Enum) {
     *     Enum["a"] = "A";
     *     Enum["b"] = "B";
     *   })(Enum || (Enum = {}));
     *
     * @param declaration A variable declaration that may represent an enum
     * @returns An array of enum members if the variable declaration is followed by an IIFE that
     * declares the enum members, or null otherwise.
     */
    resolveEnumMembers(declaration) {
        // Initialized variables don't represent enum declarations.
        if (declaration.initializer !== undefined)
            return null;
        const variableStmt = declaration.parent.parent;
        if (!ts.isVariableStatement(variableStmt))
            return null;
        const block = variableStmt.parent;
        if (!ts.isBlock(block) && !ts.isSourceFile(block))
            return null;
        const declarationIndex = block.statements.findIndex(statement => statement === variableStmt);
        if (declarationIndex === -1 || declarationIndex === block.statements.length - 1)
            return null;
        const subsequentStmt = block.statements[declarationIndex + 1];
        if (!ts.isExpressionStatement(subsequentStmt))
            return null;
        const iife = stripParentheses(subsequentStmt.expression);
        if (!ts.isCallExpression(iife) || !isEnumDeclarationIife(iife))
            return null;
        const fn = stripParentheses(iife.expression);
        if (!ts.isFunctionExpression(fn))
            return null;
        return this.reflectEnumMembers(fn);
    }
    /**
     * Attempts to extract all `EnumMember`s from a function that is according to the JavaScript emit
     * format for enums:
     *
     *   function (Enum) {
     *     Enum["MemberA"] = "a";
     *     Enum["MemberB"] = "b";
     *   }
     *
     * @param fn The function expression that is assumed to contain enum members.
     * @returns All enum members if the function is according to the correct syntax, null otherwise.
     */
    reflectEnumMembers(fn) {
        if (fn.parameters.length !== 1)
            return null;
        const enumName = fn.parameters[0].name;
        if (!ts.isIdentifier(enumName))
            return null;
        const enumMembers = [];
        for (const statement of fn.body.statements) {
            const enumMember = this.reflectEnumMember(enumName, statement);
            if (enumMember === null) {
                return null;
            }
            enumMembers.push(enumMember);
        }
        return enumMembers;
    }
    /**
     * Attempts to extract a single `EnumMember` from a statement in the following syntax:
     *
     *   Enum["MemberA"] = "a";
     *
     * or, for enum member with numeric values:
     *
     *   Enum[Enum["MemberA"] = 0] = "MemberA";
     *
     * @param enumName The identifier of the enum that the members should be set on.
     * @param statement The statement to inspect.
     * @returns An `EnumMember` if the statement is according to the expected syntax, null otherwise.
     */
    reflectEnumMember(enumName, statement) {
        if (!ts.isExpressionStatement(statement))
            return null;
        const expression = statement.expression;
        // Check for the `Enum[X] = Y;` case.
        if (!isEnumAssignment(enumName, expression)) {
            return null;
        }
        const assignment = reflectEnumAssignment(expression);
        if (assignment != null) {
            return assignment;
        }
        // Check for the `Enum[Enum[X] = Y] = ...;` case.
        const innerExpression = expression.left.argumentExpression;
        if (!isEnumAssignment(enumName, innerExpression)) {
            return null;
        }
        return reflectEnumAssignment(innerExpression);
    }
    getAdjacentNameOfClassSymbol(classSymbol) {
        if (classSymbol.adjacent !== undefined) {
            return this.getNameFromClassSymbolDeclaration(classSymbol, classSymbol.adjacent.valueDeclaration);
        }
        else {
            return this.getNameFromClassSymbolDeclaration(classSymbol, classSymbol.implementation.valueDeclaration);
        }
    }
}
///////////// Exported Helpers /////////////
/**
 * Checks whether the iife has the following call signature:
 *
 *   (Enum || (Enum = {})
 *
 * Note that the `Enum` identifier is not checked, as it could also be something
 * like `exports.Enum`. Instead, only the structure of binary operators is checked.
 *
 * @param iife The call expression to check.
 * @returns true if the iife has a call signature that corresponds with a potential
 * enum declaration.
 */
function isEnumDeclarationIife(iife) {
    if (iife.arguments.length !== 1)
        return false;
    const arg = iife.arguments[0];
    if (!ts.isBinaryExpression(arg) || arg.operatorToken.kind !== ts.SyntaxKind.BarBarToken ||
        !ts.isParenthesizedExpression(arg.right)) {
        return false;
    }
    const right = arg.right.expression;
    if (!ts.isBinaryExpression(right) || right.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
        return false;
    }
    if (!ts.isObjectLiteralExpression(right.right) || right.right.properties.length !== 0) {
        return false;
    }
    return true;
}
/**
 * Checks whether the expression looks like an enum member assignment targeting `Enum`:
 *
 *   Enum[X] = Y;
 *
 * Here, X and Y can be any expression.
 *
 * @param enumName The identifier of the enum that the members should be set on.
 * @param expression The expression that should be checked to conform to the above form.
 * @returns true if the expression is of the correct form, false otherwise.
 */
function isEnumAssignment(enumName, expression) {
    if (!ts.isBinaryExpression(expression) ||
        expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        !ts.isElementAccessExpression(expression.left)) {
        return false;
    }
    // Verify that the outer assignment corresponds with the enum declaration.
    const enumIdentifier = expression.left.expression;
    return ts.isIdentifier(enumIdentifier) && enumIdentifier.text === enumName.text;
}
/**
 * Attempts to create an `EnumMember` from an expression that is believed to represent an enum
 * assignment.
 *
 * @param expression The expression that is believed to be an enum assignment.
 * @returns An `EnumMember` or null if the expression did not represent an enum member after all.
 */
function reflectEnumAssignment(expression) {
    const memberName = expression.left.argumentExpression;
    if (!ts.isPropertyName(memberName))
        return null;
    return { name: memberName, initializer: expression.right };
}
/**
 * Test whether a statement node is an assignment statement.
 * @param statement the statement to test.
 */
export function isAssignmentStatement(statement) {
    return ts.isExpressionStatement(statement) && isAssignment(statement.expression) &&
        ts.isIdentifier(statement.expression.left);
}
/**
 * Parse the `expression` that is believed to be an IIFE and return the AST node that corresponds to
 * the body of the IIFE.
 *
 * The expression may be wrapped in parentheses, which are stripped off.
 *
 * If the IIFE is an arrow function then its body could be a `ts.Expression` rather than a
 * `ts.FunctionBody`.
 *
 * @param expression the expression to parse.
 * @returns the `ts.Expression` or `ts.FunctionBody` that holds the body of the IIFE or `undefined`
 *     if the `expression` did not have the correct shape.
 */
export function getIifeBody(expression) {
    const call = stripParentheses(expression);
    if (!ts.isCallExpression(call)) {
        return undefined;
    }
    const fn = stripParentheses(call.expression);
    if (!ts.isFunctionExpression(fn) && !ts.isArrowFunction(fn)) {
        return undefined;
    }
    return fn.body;
}
/**
 * Returns true if the `node` is an assignment of the form `a = b`.
 *
 * @param node The AST node to check.
 */
export function isAssignment(node) {
    return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}
/**
 * Tests whether the provided call expression targets a class, by verifying its arguments are
 * according to the following form:
 *
 * ```
 * __decorate([], SomeDirective);
 * ```
 *
 * @param call the call expression that is tested to represent a class decorator call.
 * @param matches predicate function to test whether the call is associated with the desired class.
 */
export function isClassDecorateCall(call, matches) {
    const helperArgs = call.arguments[0];
    if (helperArgs === undefined || !ts.isArrayLiteralExpression(helperArgs)) {
        return false;
    }
    const target = call.arguments[1];
    return target !== undefined && ts.isIdentifier(target) && matches(target);
}
/**
 * Tests whether the provided call expression targets a member of the class, by verifying its
 * arguments are according to the following form:
 *
 * ```
 * __decorate([], SomeDirective.prototype, "member", void 0);
 * ```
 *
 * @param call the call expression that is tested to represent a member decorator call.
 * @param matches predicate function to test whether the call is associated with the desired class.
 */
export function isMemberDecorateCall(call, matches) {
    const helperArgs = call.arguments[0];
    if (helperArgs === undefined || !ts.isArrayLiteralExpression(helperArgs)) {
        return false;
    }
    const target = call.arguments[1];
    if (target === undefined || !ts.isPropertyAccessExpression(target) ||
        !ts.isIdentifier(target.expression) || !matches(target.expression) ||
        target.name.text !== 'prototype') {
        return false;
    }
    const memberName = call.arguments[2];
    return memberName !== undefined && ts.isStringLiteral(memberName);
}
/**
 * Helper method to extract the value of a property given the property's "symbol",
 * which is actually the symbol of the identifier of the property.
 */
export function getPropertyValueFromSymbol(propSymbol) {
    const propIdentifier = propSymbol.valueDeclaration;
    const parent = propIdentifier && propIdentifier.parent;
    return parent && ts.isBinaryExpression(parent) ? parent.right : undefined;
}
/**
 * A callee could be one of: `__decorate(...)` or `tslib_1.__decorate`.
 */
function getCalleeName(call) {
    if (ts.isIdentifier(call.expression)) {
        return stripDollarSuffix(call.expression.text);
    }
    if (ts.isPropertyAccessExpression(call.expression)) {
        return stripDollarSuffix(call.expression.name.text);
    }
    return null;
}
function isInitializedVariableClassDeclaration(node) {
    return isNamedVariableDeclaration(node) && node.initializer !== undefined;
}
/**
 * Handle a variable declaration of the form
 *
 * ```
 * var MyClass = alias1 = alias2 = <<declaration>>
 * ```
 *
 * @param node the LHS of a variable declaration.
 * @returns the original AST node or the RHS of a series of assignments in a variable
 *     declaration.
 */
export function skipClassAliases(node) {
    let expression = node.initializer;
    while (isAssignment(expression)) {
        expression = expression.right;
    }
    return expression;
}
/**
 * This expression could either be a class expression
 *
 * ```
 * class MyClass {};
 * ```
 *
 * or an IIFE wrapped class expression
 *
 * ```
 * (() => {
 *   class MyClass {}
 *   ...
 *   return MyClass;
 * })()
 * ```
 *
 * or an IIFE wrapped aliased class expression
 *
 * ```
 * (() => {
 *   let MyClass = class MyClass {}
 *   ...
 *   return MyClass;
 * })()
 * ```
 *
 * or an IFFE wrapped ES5 class function
 *
 * ```
 * (function () {
 *  function MyClass() {}
 *  ...
 *  return MyClass
 * })()
 * ```
 *
 * @param expression the node that represents the class whose declaration we are finding.
 * @returns the declaration of the class or `null` if it is not a "class".
 */
export function getInnerClassDeclaration(expression) {
    if (ts.isClassExpression(expression) && hasNameIdentifier(expression)) {
        return expression;
    }
    const iifeBody = getIifeBody(expression);
    if (iifeBody === undefined) {
        return null;
    }
    if (!ts.isBlock(iifeBody)) {
        // Handle the fat arrow expression case: `() => ClassExpression`
        return ts.isClassExpression(iifeBody) && isNamedDeclaration(iifeBody) ? iifeBody : null;
    }
    else {
        // Handle the case of a normal or fat-arrow function with a body.
        // Return the first ClassDeclaration/VariableDeclaration inside the body
        for (const statement of iifeBody.statements) {
            if (isNamedClassDeclaration(statement) || isNamedFunctionDeclaration(statement)) {
                return statement;
            }
            if (ts.isVariableStatement(statement)) {
                for (const declaration of statement.declarationList.declarations) {
                    if (isInitializedVariableClassDeclaration(declaration)) {
                        const expression = skipClassAliases(declaration);
                        if (ts.isClassExpression(expression) && hasNameIdentifier(expression)) {
                            return expression;
                        }
                    }
                }
            }
        }
    }
    return null;
}
function getDecoratorArgs(node) {
    // The arguments of a decorator are held in the `args` property of its declaration object.
    const argsProperty = node.properties.filter(ts.isPropertyAssignment)
        .find(property => getNameText(property.name) === 'args');
    const argsExpression = argsProperty && argsProperty.initializer;
    return argsExpression && ts.isArrayLiteralExpression(argsExpression) ?
        Array.from(argsExpression.elements) :
        [];
}
function isPropertyAccess(node) {
    return !!node.parent && ts.isBinaryExpression(node.parent) && ts.isPropertyAccessExpression(node);
}
function isThisAssignment(node) {
    return ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.kind === ts.SyntaxKind.ThisKeyword;
}
function isNamedDeclaration(node) {
    const anyNode = node;
    return !!anyNode.name && ts.isIdentifier(anyNode.name);
}
function isClassMemberType(node) {
    return (ts.isClassElement(node) || isPropertyAccess(node) || ts.isBinaryExpression(node)) &&
        // Additionally, ensure `node` is not an index signature, for example on an abstract class:
        // `abstract class Foo { [key: string]: any; }`
        !ts.isIndexSignatureDeclaration(node);
}
/**
 * Attempt to resolve the variable declaration that the given declaration is assigned to.
 * For example, for the following code:
 *
 * ```
 * var MyClass = MyClass_1 = class MyClass {};
 * ```
 *
 * or
 *
 * ```
 * var MyClass = MyClass_1 = (() => {
 *   class MyClass {}
 *   ...
 *   return MyClass;
 * })()
  ```
 *
 * and the provided declaration being `class MyClass {}`, this will return the `var MyClass`
 * declaration.
 *
 * @param declaration The declaration for which any variable declaration should be obtained.
 * @returns the outer variable declaration if found, undefined otherwise.
 */
function getFarLeftHandSideOfAssignment(declaration) {
    let node = declaration.parent;
    // Detect an intermediary variable assignment and skip over it.
    if (isAssignment(node) && ts.isIdentifier(node.left)) {
        node = node.parent;
    }
    return ts.isVariableDeclaration(node) ? node : undefined;
}
function getContainingVariableDeclaration(node) {
    node = node.parent;
    while (node !== undefined) {
        if (isNamedVariableDeclaration(node)) {
            return node;
        }
        node = node.parent;
    }
    return undefined;
}
/**
 * A constructor function may have been "synthesized" by TypeScript during JavaScript emit,
 * in the case no user-defined constructor exists and e.g. property initializers are used.
 * Those initializers need to be emitted into a constructor in JavaScript, so the TypeScript
 * compiler generates a synthetic constructor.
 *
 * We need to identify such constructors as ngcc needs to be able to tell if a class did
 * originally have a constructor in the TypeScript source. When a class has a superclass,
 * a synthesized constructor must not be considered as a user-defined constructor as that
 * prevents a base factory call from being created by ngtsc, resulting in a factory function
 * that does not inject the dependencies of the superclass. Hence, we identify a default
 * synthesized super call in the constructor body, according to the structure that TypeScript
 * emits during JavaScript emit:
 * https://github.com/Microsoft/TypeScript/blob/v3.2.2/src/compiler/transformers/ts.ts#L1068-L1082
 *
 * @param constructor a constructor function to test
 * @returns true if the constructor appears to have been synthesized
 */
function isSynthesizedConstructor(constructor) {
    if (!constructor.body)
        return false;
    const firstStatement = constructor.body.statements[0];
    if (!firstStatement || !ts.isExpressionStatement(firstStatement))
        return false;
    return isSynthesizedSuperCall(firstStatement.expression);
}
/**
 * Tests whether the expression appears to have been synthesized by TypeScript, i.e. whether
 * it is of the following form:
 *
 * ```
 * super(...arguments);
 * ```
 *
 * @param expression the expression that is to be tested
 * @returns true if the expression appears to be a synthesized super call
 */
function isSynthesizedSuperCall(expression) {
    if (!ts.isCallExpression(expression))
        return false;
    if (expression.expression.kind !== ts.SyntaxKind.SuperKeyword)
        return false;
    if (expression.arguments.length !== 1)
        return false;
    const argument = expression.arguments[0];
    return ts.isSpreadElement(argument) && ts.isIdentifier(argument.expression) &&
        argument.expression.text === 'arguments';
}
/**
 * Find the statement that contains the given node
 * @param node a node whose containing statement we wish to find
 */
export function getContainingStatement(node) {
    while (node.parent) {
        if (ts.isBlock(node.parent) || ts.isSourceFile(node.parent)) {
            break;
        }
        node = node.parent;
    }
    return node;
}
function getRootFileOrFail(bundle) {
    const rootFile = bundle.program.getSourceFile(bundle.path);
    if (rootFile === undefined) {
        throw new Error(`The given rootPath ${rootFile} is not a file of the program.`);
    }
    return rootFile;
}
function getNonRootPackageFiles(bundle) {
    const rootFile = bundle.program.getSourceFile(bundle.path);
    return bundle.program.getSourceFiles().filter(f => (f !== rootFile) && isWithinPackage(bundle.package, absoluteFromSourceFile(f)));
}
function isTopLevel(node) {
    while (node = node.parent) {
        if (ts.isBlock(node)) {
            return false;
        }
    }
    return true;
}
/**
 * Get a node that represents the actual (outer) declaration of a class from its implementation.
 *
 * Sometimes, the implementation of a class is an expression that is hidden inside an IIFE and
 * assigned to a variable outside the IIFE, which is what the rest of the program interacts with.
 * For example,
 *
 * ```
 * OuterNode = Alias = (function() { function InnerNode() {} return InnerNode; })();
 * ```
 *
 * @param node a node that could be the implementation inside an IIFE.
 * @returns a node that represents the outer declaration, or `null` if it is does not match the IIFE
 *     format shown above.
 */
export function getOuterNodeFromInnerDeclaration(node) {
    if (!ts.isFunctionDeclaration(node) && !ts.isClassDeclaration(node) &&
        !ts.isVariableStatement(node)) {
        return null;
    }
    // It might be the function expression inside the IIFE. We need to go 5 levels up...
    // - IIFE body.
    let outerNode = node.parent;
    if (!outerNode || !ts.isBlock(outerNode))
        return null;
    // - IIFE function expression.
    outerNode = outerNode.parent;
    if (!outerNode || (!ts.isFunctionExpression(outerNode) && !ts.isArrowFunction(outerNode))) {
        return null;
    }
    outerNode = outerNode.parent;
    // - Parenthesis inside IIFE.
    if (outerNode && ts.isParenthesizedExpression(outerNode))
        outerNode = outerNode.parent;
    // - IIFE call expression.
    if (!outerNode || !ts.isCallExpression(outerNode))
        return null;
    outerNode = outerNode.parent;
    // - Parenthesis around IIFE.
    if (outerNode && ts.isParenthesizedExpression(outerNode))
        outerNode = outerNode.parent;
    // - Skip any aliases between the IIFE and the far left hand side of any assignments.
    while (isAssignment(outerNode.parent)) {
        outerNode = outerNode.parent;
    }
    return outerNode;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtMjAxNV9ob3N0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2hvc3QvZXNtMjAxNV9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBRXRFLE9BQU8sRUFBZ0MsZUFBZSxFQUE4RSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSx1QkFBdUIsRUFBRSwwQkFBMEIsRUFBRSwwQkFBMEIsRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBMEIsd0JBQXdCLEVBQW1FLE1BQU0sK0JBQStCLENBQUM7QUFDcGMsT0FBTyxFQUFDLDRCQUE0QixFQUE2QixNQUFNLHdDQUF3QyxDQUFDO0FBQ2hILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRCxPQUFPLEVBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFFL0YsT0FBTyxFQUFjLCtCQUErQixFQUF1QyxhQUFhLEVBQWdDLE1BQU0sYUFBYSxDQUFDO0FBQzVKLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV6QyxNQUFNLENBQUMsTUFBTSxVQUFVLEdBQUcsWUFBMkIsQ0FBQztBQUN0RCxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsZ0JBQStCLENBQUM7QUFDL0QsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLGVBQThCLENBQUM7QUFDMUQsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsZ0JBQStCLENBQUM7QUFFbEU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMEJHO0FBQ0gsTUFBTSxPQUFPLHFCQUFzQixTQUFRLHdCQUF3QjtJQWdEakUsWUFDYyxNQUFjLEVBQVksTUFBZSxFQUFZLEdBQWtCLEVBQ3ZFLE1BQTBCLElBQUk7UUFDMUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUZ4QixXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQVksV0FBTSxHQUFOLE1BQU0sQ0FBUztRQUFZLFFBQUcsR0FBSCxHQUFHLENBQWU7UUFDdkUsUUFBRyxHQUFILEdBQUcsQ0FBMkI7UUFqRDVDOzs7Ozs7V0FNRztRQUNPLDRCQUF1QixHQUE4QyxJQUFJLENBQUM7UUFDcEY7Ozs7OztXQU1HO1FBQ08sNkJBQXdCLEdBQThDLElBQUksQ0FBQztRQUVyRjs7V0FFRztRQUNPLDRCQUF1QixHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO1FBRTdEOzs7Ozs7Ozs7Ozs7OztXQWNHO1FBQ08sNkJBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQWtDLENBQUM7UUFFL0U7Ozs7O1dBS0c7UUFDTyxtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFtQyxDQUFDO0lBTXRFLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQXNCRztJQUNILGNBQWMsQ0FBQyxXQUFvQjtRQUNqQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsa0NBQWtDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDcEUsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO1lBQ3hCLE9BQU8sTUFBTSxDQUFDO1NBQ2Y7UUFDRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRSxPQUFPLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ0gsMEJBQTBCLENBQUMsV0FBNEI7UUFDckQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7Ozs7Ozs7O09BU0c7SUFDSCxpQkFBaUIsQ0FBQyxLQUF1QjtRQUN2QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2Q0FBNkMsS0FBSyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztTQUNsRjtRQUVELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ0gsd0JBQXdCLENBQUMsS0FBdUI7UUFDOUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQ1gsNERBQTRELEtBQUssQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDckY7UUFDRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsbUNBQW1DLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDN0UsSUFBSSxjQUFjLEVBQUU7WUFDbEIsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1NBQ2xFO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsc0JBQXNCLENBQUMsS0FBdUI7UUFDNUMsb0VBQW9FO1FBQ3BFLE1BQU0sd0JBQXdCLEdBQUcsS0FBSyxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JFLElBQUksd0JBQXdCLEVBQUU7WUFDNUIsT0FBTyx3QkFBd0IsQ0FBQztTQUNqQztRQUVELHVFQUF1RTtRQUN2RSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQSxXQUFXLGFBQVgsV0FBVyx1QkFBWCxXQUFXLENBQUUsY0FBYyxDQUFDLGdCQUFnQixNQUFLLFNBQVM7WUFDMUQsQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7WUFDcEUsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELE9BQU8sS0FBSyxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRUQsc0JBQXNCLENBQUMsS0FBdUI7UUFDNUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUU7WUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyw0REFDWixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksNkJBQTZCLENBQUMsQ0FBQztTQUNuRDtRQUNELE9BQU8sSUFBSSxDQUFDLGlDQUFpQyxDQUN6QyxXQUFXLEVBQUUsV0FBVyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxLQUF1QjtRQUM1QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9DLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtZQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLDREQUNaLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxDQUFDO1NBQ25EO1FBRUQsT0FBTyxJQUFJLENBQUMsNEJBQTRCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVPLGlDQUFpQyxDQUNyQyxXQUE0QixFQUFFLFdBQXFDO1FBQ3JFLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtZQUM3QixNQUFNLElBQUksS0FBSyxDQUNYLDJHQUNJLFdBQVcsQ0FBQyxJQUFJLDBCQUEwQixXQUFXLENBQUMsY0FBYyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7U0FDdkY7UUFDRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FDWCx3R0FDSSxXQUFXLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ2xDO1FBQ0QsT0FBTyxXQUFXLENBQUMsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFFRDs7T0FFRztJQUNILE9BQU8sQ0FBQyxJQUFhO1FBQ25CLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztJQUN4RSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7OztPQWVHO0lBQ0gsMEJBQTBCLENBQUMsRUFBaUI7UUFDMUMsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsdUNBQXVDO1FBQ3ZDLElBQUksZ0JBQWdCLEtBQUssSUFBSSxFQUFFO1lBQzdCLE9BQU8sZ0JBQWdCLENBQUM7U0FDekI7UUFFRCxzRUFBc0U7UUFDdEUsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEtBQUssSUFBSTtZQUMvQixxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7WUFDakYsT0FBTyxnQkFBZ0IsQ0FBQztTQUN6QjtRQUVELElBQUksZUFBZSxHQUFZLGdCQUFnQixDQUFDLElBQUksQ0FBQztRQUNyRCxJQUFJLDBCQUEwQixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzNGLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuRSxJQUFJLGFBQWEsS0FBSyxJQUFJLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUNqRSxlQUFlLEdBQUcsc0JBQXNCLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDekQ7U0FDRjtRQUVELE1BQU0sU0FBUyxHQUFHLGdDQUFnQyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sV0FBVyxHQUFHLFNBQVMsS0FBSyxJQUFJLElBQUksMEJBQTBCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUM3RSxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDakQsZ0JBQWdCLENBQUM7UUFDckIsSUFBSSxXQUFXLEtBQUssSUFBSSxJQUFJLFdBQVcsQ0FBQyxLQUFLLEtBQUssSUFBSTtZQUNsRCxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxXQUFXLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUN2RSxPQUFPLFdBQVcsQ0FBQztTQUNwQjtRQUVELDhGQUE4RjtRQUM5Riw2RkFBNkY7UUFDN0YsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9FLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFO1lBQzlCLE9BQU8sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDM0Q7UUFFRCw4RkFBOEY7UUFDOUYsSUFBSSxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3BGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUQsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO2dCQUN4QixXQUFXLENBQUMsUUFBUSxHQUFHLEVBQUMsSUFBSSx5QkFBd0MsRUFBRSxXQUFXLEVBQUMsQ0FBQzthQUNwRjtTQUNGO1FBRUQsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7T0FHRztJQUNILHFCQUFxQixDQUFDLE1BQXVCO1FBQzNDLE1BQU0sRUFBQyxlQUFlLEVBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUQsSUFBSSxlQUFlLEtBQUssSUFBSSxFQUFFO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCw0RUFBNEU7UUFDNUUsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILHlCQUF5QixDQUFDLE1BQWU7UUFDdkMsc0VBQXNFO1FBQ3RFLE9BQU8sTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNqRCxPQUFPLENBQUMsTUFBTSxFQUFFLCtCQUErQixDQUFDLENBQUMsQ0FBQztZQUNsRCxFQUFFLENBQUM7SUFDVCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsV0FBbUM7UUFDbEQsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2xELElBQUksS0FBSyxFQUFFO1lBQ1QsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUVELHVFQUF1RTtRQUN2RSxFQUFFO1FBQ0YsTUFBTTtRQUNOLDhCQUE4QjtRQUM5QixNQUFNO1FBQ04sRUFBRTtRQUNGLDJFQUEyRTtRQUMzRSxvRUFBb0U7UUFDcEUsMkVBQTJFO1FBQzNFLHdDQUF3QztRQUN4QyxFQUFFO1FBQ0YsTUFBTTtRQUNOLHVFQUF1RTtRQUN2RSxlQUFlO1FBQ2YscUJBQXFCO1FBQ3JCLE9BQU87UUFDUCw0QkFBNEI7UUFDNUIsTUFBTTtRQUNOLEVBQUU7UUFDRix3RUFBd0U7UUFDeEUscUVBQXFFO1FBQ3JFLEVBQUU7UUFDRixNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDL0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEUsSUFBSSxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUMzRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sTUFBTSxHQUFHLFlBQVksSUFBSSxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pELElBQUksTUFBTSxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3JDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzlELE1BQU0saUJBQWlCLEdBQUcsWUFBWSxJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDeEUsSUFBSSxpQkFBaUIsRUFBRTtvQkFDckIsSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLENBQUM7d0JBQ3hDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO3dCQUMvQyxxREFBcUQ7d0JBQ3JELGtEQUFrRDt3QkFDbEQsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDO3FCQUN2Qzt5QkFBTSxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO3dCQUN0RCwwRUFBMEU7d0JBQzFFLG9FQUFvRTt3QkFDcEUsSUFBSSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsV0FBVyxDQUFDO3dCQUNoRCxPQUFPLFdBQVcsSUFBSSxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUU7NEJBQy9DLFdBQVcsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDO3lCQUNqQzt3QkFDRCxJQUFJLFdBQVcsRUFBRTs0QkFDZixPQUFPLFdBQVcsQ0FBQzt5QkFDcEI7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILGdCQUFnQixDQUFDLFVBQXlCO1FBQ3hDLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUE4QixDQUFDO1FBQ3RELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUM7YUFDL0IsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ2pGLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILHNCQUFzQixDQUFDLEtBQXVCO1FBQzVDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyRCxJQUFJLGNBQWMsSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDM0QsT0FBTyxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2pGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7O09BV0c7SUFDSCxpQkFBaUIsQ0FBQyxXQUE0QjtRQUM1QyxJQUFJLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxFQUFFO1lBQ3JCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQywrREFDWixXQUFXLENBQUMsT0FBTyxFQUFFLE9BQU8sV0FBVyxDQUFDLGFBQWEsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7U0FDekU7UUFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9ELElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtZQUNqQixNQUFNLElBQUksS0FBSyxDQUNYLG1GQUNJLFdBQVcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxXQUFXLENBQUMsYUFBYSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztTQUM3RTtRQUVELDBEQUEwRDtRQUMxRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsS0FBSyxJQUFJLEVBQUU7WUFDekMsSUFBSSxDQUFDLHVCQUF1QixHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUN4RjtRQUNELElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDL0MsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUUsQ0FBQztTQUNyRDtRQUVELHdDQUF3QztRQUN4QyxJQUFJLElBQUksQ0FBQyx3QkFBd0IsS0FBSyxJQUFJLEVBQUU7WUFDMUMsSUFBSSxDQUFDLHdCQUF3QixHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUMxRjtRQUNELElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEQsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUUsQ0FBQztTQUN0RDtRQUVELDhCQUE4QjtRQUM5QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxhQUFhLENBQUMsV0FBNEI7UUFDeEMsTUFBTSxjQUFjLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQztRQUNsRCxJQUFJLElBQUksR0FBWSxjQUFjLENBQUMsZ0JBQWdCLENBQUM7UUFDcEQsTUFBTSx1QkFBdUIsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3RCxJQUFJLHVCQUF1QixLQUFLLElBQUk7WUFBRSxPQUFPLElBQUksQ0FBQztRQUVsRCxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLENBQUM7UUFDakQsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ3pCLG1EQUFtRDtZQUNuRCxNQUFNLG9CQUFvQixHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ2xGLElBQUksb0JBQW9CLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQy9CLE1BQU0sSUFBSSxLQUFLLENBQ1gsaUVBQWlFLFdBQVcsQ0FBQyxJQUFJLE9BQzdFLFdBQVcsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzthQUM5RTtZQUVELHdEQUF3RDtZQUN4RCxJQUFJLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLENBQUMsQ0FBQztTQUN2RDthQUFNLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNyQyxtRUFBbUU7WUFDbkUsSUFBSSxjQUFjLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRTtnQkFDeEMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQzVDLElBQUksWUFBWSxDQUFDLGdCQUFnQixLQUFLLFNBQVMsRUFBRTt3QkFDL0MsT0FBTztxQkFDUjtvQkFDRCxNQUFNLGVBQWUsR0FBRyxzQkFBc0IsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFDOUUsSUFBSSxlQUFlLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxlQUFlLENBQUMsTUFBTSxFQUFFLEVBQUU7d0JBQ3hFLElBQUksR0FBRyxlQUFlLENBQUM7cUJBQ3hCO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7WUFFRCxrRUFBa0U7WUFDbEUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUN2QyxXQUFXLEVBQUUsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3ZCLE1BQU0sZUFBZSxHQUFHLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN2RCxJQUFJLGVBQWUsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtvQkFDeEUsSUFBSSxHQUFHLGVBQWUsQ0FBQztpQkFDeEI7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNKO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsc0JBQXNCLENBQXdCLElBQU87UUFDbkQsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbkUsMEZBQTBGO1lBQzFGLHVEQUF1RDtZQUN2RCxJQUFJLENBQUMsS0FBSyxHQUFHLGdCQUFnQixDQUFDLGNBQWMsQ0FBQztTQUM5QztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUdELDZDQUE2QztJQUU3Qzs7T0FFRztJQUNPLDRCQUE0QixDQUNsQyxPQUF3QyxFQUFFLFNBQXVCO1FBQ25FLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ3JDLFNBQVMsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDM0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDckQsSUFBSSxXQUFXLEVBQUU7b0JBQ2YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2lCQUN0RDtZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7YUFBTSxJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMzQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ25ELElBQUksV0FBVyxFQUFFO2dCQUNmLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQzthQUN0RDtTQUNGO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDTyxtQ0FBbUMsQ0FBQyxXQUFvQjtRQUNoRSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssU0FBUyxJQUFJLDBCQUEwQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN0RixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2hFLElBQUksYUFBYSxLQUFLLElBQUksRUFBRTtnQkFDMUIsV0FBVyxHQUFHLGFBQWEsQ0FBQzthQUM3QjtTQUNGO1FBQ0QsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQXNDRztJQUNPLGtDQUFrQyxDQUFDLFdBQW9CO1FBQy9ELDBGQUEwRjtRQUMxRixJQUFJLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUNuRSxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3ZEO1FBRUQscUZBQXFGO1FBQ3JGLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUN2RCxPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELE1BQU0sZ0JBQWdCLEdBQUcsd0JBQXdCLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNqRixJQUFJLGdCQUFnQixLQUFLLElBQUksRUFBRTtZQUM3QixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09BMEJHO0lBQ08sa0NBQWtDLENBQUMsV0FBb0I7UUFDL0QsSUFBSSxnQkFBZ0IsR0FBeUQsU0FBUyxDQUFDO1FBRXZGLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3ZFLHVEQUF1RDtZQUN2RCxnQkFBZ0IsR0FBRyw4QkFBOEIsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUUvRCwrQkFBK0I7WUFDL0IsSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtnQkFDbkUsZ0JBQWdCLEdBQUcsZ0NBQWdDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzthQUN2RTtTQUNGO2FBQU0sSUFBSSx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUMvQyxzQ0FBc0M7WUFDdEMsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzNCLG1CQUFtQjtnQkFDbkIsZ0JBQWdCLEdBQUcsV0FBVyxDQUFDO2FBQ2hDO2lCQUFNO2dCQUNMLG9CQUFvQjtnQkFDcEIsZ0JBQWdCLEdBQUcsZ0NBQWdDLENBQUMsV0FBVyxDQUFDLENBQUM7YUFDbEU7U0FDRjtRQUVELElBQUksZ0JBQWdCLEtBQUssU0FBUyxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUMxRSxPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7T0FVRztJQUNPLGlCQUFpQixDQUFDLGdCQUErQixFQUFFLGdCQUE4QjtRQUV6RixNQUFNLGlCQUFpQixHQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUE0QixDQUFDO1FBQ2xGLElBQUksaUJBQWlCLEtBQUssU0FBUyxFQUFFO1lBQ25DLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBRUQsSUFBSSxvQkFBb0IsR0FBd0IsaUJBQWlCLENBQUM7UUFDbEUsSUFBSSxnQkFBZ0IsS0FBSyxJQUFJLElBQUksa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUNyRSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2hGO1FBRUQsSUFBSSxDQUFDLDRCQUE0QixDQUFDLG9CQUFvQixDQUFDLEVBQUU7WUFDdkQsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFFRCxNQUFNLFdBQVcsR0FBb0I7WUFDbkMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLElBQUk7WUFDNUIsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixjQUFjLEVBQUUsb0JBQW9CO1lBQ3BDLFFBQVEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsaUJBQWlCLEVBQUUsb0JBQW9CLENBQUM7U0FDMUUsQ0FBQztRQUVGLE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFTyxpQkFBaUIsQ0FDckIsaUJBQThCLEVBQzlCLG9CQUFnRDtRQUNsRCxJQUFJLGlCQUFpQixLQUFLLG9CQUFvQixFQUFFO1lBQzlDLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBQ0QsTUFBTSxnQkFBZ0IsR0FBRyxvQkFBb0IsQ0FBQyxnQkFBZ0IsQ0FBQztRQUMvRCxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUN6RixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUNELDhEQUE4RDtRQUM5RCw4RUFBOEU7UUFDOUUsTUFBTSxtQkFBbUIsR0FBRyw4QkFBOEIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzdFLElBQUksbUJBQW1CLEtBQUssU0FBUyxJQUFJLENBQUMsMEJBQTBCLENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUN6RixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUNELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEYsSUFBSSxjQUFjLEtBQUssaUJBQWlCLElBQUksY0FBYyxLQUFLLG9CQUFvQjtZQUMvRSxDQUFDLDRCQUE0QixDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQ2pELE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBQ0QsT0FBTyxjQUFjLENBQUM7SUFDeEIsQ0FBQztJQUVEOzs7T0FHRztJQUNPLHNCQUFzQixDQUFDLE1BQWlCLEVBQUUsVUFBOEI7UUFFaEYsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLHNCQUFzQixDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNyRSxJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUU7WUFDeEIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRDs7Ozs7Ozs7OztPQVVHO0lBQ08sNkJBQTZCLENBQUMsV0FBNEI7UUFDbEUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFFLENBQUMsQ0FBQztZQUNqRCxJQUFJLENBQUM7SUFDWCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNPLGtCQUFrQixDQUFDLFVBQXlCO1FBQ3BELElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ2pELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFN0MsS0FBSyxNQUFNLFNBQVMsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQzVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNyQztTQUNGO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNPLG1CQUFtQixDQUFDLFNBQXVCO1FBQ25ELElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDdEMsT0FBTztTQUNSO1FBRUQsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUM7UUFDNUQsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUM3QixPQUFPO1NBQ1I7UUFFRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEMsTUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQztRQUM1QyxJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDO1lBQ2hGLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3BFLE9BQU87U0FDUjtRQUVELE1BQU0saUJBQWlCLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztRQUUzQyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzlFLElBQUksa0JBQWtCLEtBQUssSUFBSSxFQUFFO1lBQy9CLE1BQU0sSUFBSSxLQUFLLENBQ1gsbUNBQW1DLGlCQUFpQixDQUFDLElBQUksUUFBUSxTQUFTLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQzlGO1FBQ0QsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQy9FLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDTyxtQkFBbUIsQ0FBQyxVQUF5QjtRQUNyRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNPLDBCQUEwQixDQUFDLElBQXVCLEVBQUUsTUFBaUI7UUFFN0UsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNULE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTtZQUN4RixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDekIsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEtBQUssTUFBTSxFQUFFO2dCQUM5RSxPQUFPLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7YUFDN0Y7WUFDRCxPQUFPLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDdkQ7UUFDRCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzFGLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7T0FXRztJQUNPLGlCQUFpQixDQUFDLE1BQXVCLEVBQUUsWUFBeUI7O1FBRTVFLE9BQU8sQ0FBQSxNQUFBLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTywwQ0FBRSxHQUFHLENBQUMsWUFBWSxDQUFDO2FBQ25ELE1BQUEsTUFBQSxNQUFNLENBQUMsUUFBUSwwQ0FBRSxPQUFPLDBDQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQTthQUMzQyxNQUFBLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTywwQ0FBRSxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUEsQ0FBQztJQUNwRCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNPLG9CQUFvQixDQUFDLFdBQTRCO1FBQ3pELE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUM7UUFDdEQsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNqQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDO1NBQ3ZDO1FBRUQsMkZBQTJGO1FBQzNGLDBFQUEwRTtRQUMxRSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsd0NBQXdDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0UsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTFFLE1BQU0sYUFBYSxHQUFrQjtZQUNuQyxlQUFlLEVBQUUsV0FBVyxDQUFDLGVBQWUsSUFBSSxXQUFXLENBQUMsZUFBZTtZQUMzRSxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsZ0JBQWdCLElBQUksV0FBVyxDQUFDLGdCQUFnQjtZQUM5RSxvQkFBb0IsRUFBRSxXQUFXLENBQUMsb0JBQW9CLElBQUksV0FBVyxDQUFDLG9CQUFvQjtTQUMzRixDQUFDO1FBRUYsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzdDLE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7Ozs7Ozs7O09BU0c7SUFDTyx3Q0FBd0MsQ0FBQyxXQUE0QjtRQUk3RSxJQUFJLGVBQWUsR0FBcUIsSUFBSSxDQUFDO1FBQzdDLElBQUksZ0JBQWdCLEdBQWtDLElBQUksQ0FBQztRQUMzRCxJQUFJLG9CQUFvQixHQUFxQixJQUFJLENBQUM7UUFFbEQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzNFLElBQUksa0JBQWtCLEtBQUssU0FBUyxFQUFFO1lBQ3BDLGVBQWUsR0FBRyxJQUFJLENBQUMsb0NBQW9DLENBQUMsa0JBQWtCLENBQUMsQ0FBQztTQUNqRjtRQUVELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUNwRixJQUFJLHNCQUFzQixLQUFLLFNBQVMsRUFBRTtZQUN4QyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMscUNBQXFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQztTQUN2RjtRQUVELE1BQU0seUJBQXlCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQzFGLElBQUkseUJBQXlCLEtBQUssU0FBUyxFQUFFO1lBQzNDLG9CQUFvQixHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1NBQ3ZGO1FBRUQsT0FBTyxFQUFDLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBQyxDQUFDO0lBQ25FLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ08sb0NBQW9DLENBQUMsZ0JBQTJCO1FBQ3hFLE1BQU0sb0JBQW9CLEdBQUcsZ0JBQWdCLENBQUMsZ0JBQWdCLENBQUM7UUFDL0QsSUFBSSxvQkFBb0IsSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLEVBQUU7WUFDdkQsSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDO2dCQUNsRCxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTtnQkFDaEYsdUNBQXVDO2dCQUN2QyxNQUFNLGVBQWUsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO2dCQUMxRCxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7cUJBQ3pDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzthQUN0RDtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDTyxrQkFBa0IsQ0FBQyxNQUF1QjtRQUNsRCxNQUFNLE9BQU8sR0FBa0IsRUFBRSxDQUFDO1FBRWxDLG9FQUFvRTtRQUNwRSxNQUFNLEVBQUMsZ0JBQWdCLEVBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0QsNkZBQTZGO1FBQzdGLHVEQUF1RDtRQUN2RCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRWhELDRGQUE0RjtRQUM1RixxQ0FBcUM7UUFDckMsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRTtZQUNqQyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUU7Z0JBQ25ELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsR0FBYSxDQUFDLENBQUM7Z0JBQ3BELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ2hFLElBQUksZ0JBQWdCLEVBQUU7b0JBQ3BCLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBYSxDQUFDLENBQUM7b0JBQ3BDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDO2lCQUNuQztZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCw2REFBNkQ7UUFDN0QsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRTtZQUNqQyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUU7Z0JBQ25ELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsR0FBYSxDQUFDLENBQUM7Z0JBQ3BELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN0RSxJQUFJLGdCQUFnQixFQUFFO29CQUNwQixhQUFhLENBQUMsTUFBTSxDQUFDLEdBQWEsQ0FBQyxDQUFDO29CQUNwQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQztpQkFDbkM7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQseUZBQXlGO1FBQ3pGLHdEQUF3RDtRQUN4RCxlQUFlO1FBQ2YsTUFBTTtRQUNOLGdDQUFnQztRQUNoQyxrQ0FBa0M7UUFDbEMsSUFBSTtRQUNKLGdDQUFnQztRQUNoQyxNQUFNO1FBQ04sSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBQ2pFLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7Z0JBQzlCLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRTtvQkFDaEQsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFhLENBQUMsQ0FBQztvQkFDcEQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ3RFLElBQUksZ0JBQWdCLEVBQUU7d0JBQ3BCLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBYSxDQUFDLENBQUM7d0JBQ3BDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDO3FCQUNuQztnQkFDSCxDQUFDLENBQUMsQ0FBQzthQUNKO1NBQ0Y7UUFFRCw4RkFBOEY7UUFDOUYsb0VBQW9FO1FBQ3BFLEVBQUU7UUFDRixlQUFlO1FBQ2YsTUFBTTtRQUNOLDRCQUE0QjtRQUM1Qiw4Q0FBOEM7UUFDOUMsb0NBQW9DO1FBQ3BDLE1BQU07UUFDTix3Q0FBd0M7UUFDeEMsUUFBUTtRQUNSLE1BQU07UUFDTixJQUFJLE1BQU0sQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQ2pDLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtnQkFDOUQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQUU7b0JBQ3pDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRTt3QkFDN0MsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFhLENBQUMsQ0FBQzt3QkFDcEQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7d0JBQ3RFLElBQUksZ0JBQWdCLEVBQUU7NEJBQ3BCLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBYSxDQUFDLENBQUM7NEJBQ3BDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDO3lCQUNuQztvQkFDSCxDQUFDLENBQUMsQ0FBQztpQkFDSjthQUNGO1NBQ0Y7UUFFRCw0RUFBNEU7UUFDNUUsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUNuQyxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUNYLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixVQUFVLEVBQUUsS0FBSztnQkFDakIsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsSUFBSSxFQUFFLGVBQWUsQ0FBQyxRQUFRO2dCQUM5QixJQUFJLEVBQUUsR0FBRztnQkFDVCxRQUFRLEVBQUUsSUFBSTtnQkFDZCxJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsSUFBSTtnQkFDVixLQUFLLEVBQUUsSUFBSTthQUNaLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7OztPQWNHO0lBQ08scUNBQXFDLENBQUMsa0JBQTZCO1FBRTNFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7UUFDeEQsK0RBQStEO1FBQy9ELE1BQU0saUJBQWlCLEdBQUcsMEJBQTBCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN6RSxJQUFJLGlCQUFpQixJQUFJLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO1lBQ3hFLE1BQU0sYUFBYSxHQUFHLG9CQUFvQixDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDOUQsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDcEMsTUFBTSxVQUFVLEdBQ1osSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDbEYsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFO29CQUNyQixnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2lCQUN4QztZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxPQUFPLGdCQUFnQixDQUFDO0lBQzFCLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0EwQkc7SUFDTyxtQ0FBbUMsQ0FBQyxXQUE0QjtRQUN4RSxJQUFJLGVBQWUsR0FBcUIsSUFBSSxDQUFDO1FBQzdDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7UUFDeEQsTUFBTSxvQkFBb0IsR0FBZ0IsRUFBRSxDQUFDO1FBRTdDLE1BQU0sdUJBQXVCLEdBQUcsQ0FBQyxLQUFhLEVBQUUsRUFBRTtZQUNoRCxJQUFJLEtBQUssR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4QyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7Z0JBQ3ZCLEtBQUssR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBQyxDQUFDO2FBQ2hGO1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUM7UUFFRiw0RkFBNEY7UUFDNUYsMkZBQTJGO1FBQzNGLCtGQUErRjtRQUMvRixrRUFBa0U7UUFDbEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFFN0UsTUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDO1FBQ2xFLE1BQU0sZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNyRSxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDbEYsTUFBTSxZQUFZLEdBQUcsQ0FBQyxVQUF5QixFQUFFLEVBQUU7WUFDakQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3pELE9BQU8sSUFBSSxLQUFLLElBQUk7Z0JBQ2hCLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxtQkFBbUIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQjtvQkFDbkUsSUFBSSxDQUFDLElBQUksS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3ZDLENBQUMsQ0FBQztRQUVGLEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFO1lBQ3BDLElBQUksbUJBQW1CLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQyxFQUFFO2dCQUNqRCx3REFBd0Q7Z0JBQ3hELE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTNDLEtBQUssTUFBTSxPQUFPLElBQUksVUFBVSxDQUFDLFFBQVEsRUFBRTtvQkFDekMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN2RCxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7d0JBQ2xCLFNBQVM7cUJBQ1Y7b0JBRUQsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRTt3QkFDOUIsZ0VBQWdFO3dCQUNoRSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFOzRCQUNwQyxDQUFDLGVBQWUsSUFBSSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7eUJBQ25FO3FCQUNGO3lCQUFNLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxrQkFBa0IsRUFBRTt3QkFDNUMsbUZBQW1GO3dCQUNuRixtRUFBbUU7d0JBQ25FLE1BQU0sS0FBSyxHQUFHLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDbkQsQ0FBQyxLQUFLLENBQUMsVUFBVSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7cUJBQ3JFO3lCQUFNLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7d0JBQ2xDLG1GQUFtRjt3QkFDbkYsc0VBQXNFO3dCQUN0RSxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDZixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsQ0FBQztxQkFDNUU7aUJBQ0Y7YUFDRjtpQkFBTSxJQUFJLG9CQUFvQixDQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsRUFBRTtnQkFDekQsMkRBQTJEO2dCQUMzRCxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFFaEQsS0FBSyxNQUFNLE9BQU8sSUFBSSxVQUFVLENBQUMsUUFBUSxFQUFFO29CQUN6QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3ZELElBQUksS0FBSyxLQUFLLElBQUksRUFBRTt3QkFDbEIsU0FBUztxQkFDVjtvQkFFRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUFFO3dCQUM5QixpRUFBaUU7d0JBQ2pFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUU7NEJBQ3BDLE1BQU0sVUFBVSxHQUNaLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7NEJBQzlFLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDOzRCQUNqQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO3lCQUM5QztxQkFDRjt5QkFBTTt3QkFDTCxvRkFBb0Y7cUJBQ3JGO2lCQUNGO2FBQ0Y7U0FDRjtRQUVELE9BQU8sRUFBQyxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FzQkc7SUFDTywwQkFBMEIsQ0FBQyxVQUF5QjtRQUM1RCwwREFBMEQ7UUFDMUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUNwQyxPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDO1FBRXhCLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLFVBQVUsS0FBSyxZQUFZLEVBQUU7WUFDL0IseUZBQXlGO1lBQ3pGLDhDQUE4QztZQUM5QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlCLElBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxtQkFBbUIsRUFBRTtnQkFDckYsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUM5RCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTztnQkFDTCxJQUFJLEVBQUUsUUFBUTtnQkFDZCxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO2FBQ2xDLENBQUM7U0FDSDtRQUVELElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRTtZQUM1Qix3RkFBd0Y7WUFDeEYsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQyxNQUFNLEtBQUssR0FBRyxRQUFRLElBQUksRUFBRSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQzVGLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNoQixPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4QyxJQUFJLGFBQWEsS0FBSyxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLEVBQUU7Z0JBQ3RFLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDM0QsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO2dCQUN0QixPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTztnQkFDTCxJQUFJLEVBQUUsa0JBQWtCO2dCQUN4QixLQUFLO2dCQUNMLFNBQVM7YUFDVixDQUFDO1NBQ0g7UUFFRCwwREFBMEQ7UUFDMUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xELElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtZQUN0QixPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsT0FBTztZQUNMLElBQUksRUFBRSxXQUFXO1lBQ2pCLFNBQVM7U0FDVixDQUFDO0lBQ0osQ0FBQztJQUVTLG9CQUFvQixDQUFDLElBQXVCO1FBQ3BELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUM1QyxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUMvQyxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsd0JBQXdCO1FBQ3hCLE1BQU0sbUJBQW1CLEdBQ3JCLEVBQUUsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQztRQUUxRixPQUFPO1lBQ0wsSUFBSSxFQUFFLG1CQUFtQixDQUFDLElBQUk7WUFDOUIsVUFBVSxFQUFFLG1CQUFtQjtZQUMvQixNQUFNLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDO1lBQ3ZELElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztTQUNqQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNPLGFBQWEsQ0FBQyxTQUF1QixFQUFFLFdBQXFCO1FBQ3BFLElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3hFLFNBQVMsQ0FBQyxVQUFVLEVBQUU7WUFDeEIsSUFBSSxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQztZQUN0QyxPQUFPLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDL0IsVUFBVSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUM7YUFDL0I7WUFDRCxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDbkMsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM3QyxJQUFJLFVBQVUsS0FBSyxJQUFJLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRTtvQkFDM0QsT0FBTyxVQUFVLENBQUM7aUJBQ25CO2FBQ0Y7U0FDRjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUdEOzs7Ozs7Ozs7Ozs7O09BYUc7SUFDTyxpQkFBaUIsQ0FBQyxlQUE4QjtRQUN4RCxNQUFNLFVBQVUsR0FBZ0IsRUFBRSxDQUFDO1FBRW5DLElBQUksRUFBRSxDQUFDLHdCQUF3QixDQUFDLGVBQWUsQ0FBQyxFQUFFO1lBQ2hELHVGQUF1RjtZQUN2RixlQUFlLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdEMsa0ZBQWtGO2dCQUNsRixJQUFJLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDdEMsd0ZBQXdGO29CQUN4RixNQUFNLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFFN0MscURBQXFEO29CQUNyRCxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQ3pCLElBQUksYUFBYSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUM7d0JBQzNDLElBQUkscUJBQXFCLENBQUMsYUFBYSxDQUFDLEVBQUU7NEJBQ3hDLE1BQU0sbUJBQW1CLEdBQ3JCLEVBQUUsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQzs0QkFDeEUsVUFBVSxDQUFDLElBQUksQ0FBQztnQ0FDZCxJQUFJLEVBQUUsbUJBQW1CLENBQUMsSUFBSTtnQ0FDOUIsVUFBVSxFQUFFLGFBQWE7Z0NBQ3pCLE1BQU0sRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUM7Z0NBQ3ZELElBQUk7Z0NBQ0osSUFBSSxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQzs2QkFDN0IsQ0FBQyxDQUFDO3lCQUNKO3FCQUNGO2lCQUNGO1lBQ0gsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUNELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQW1CRztJQUNPLGNBQWMsQ0FBQyxNQUFpQixFQUFFLFVBQXdCLEVBQUUsUUFBa0I7UUFFdEYsSUFBSSxNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFO1lBQzFDLE1BQU0sT0FBTyxHQUFrQixFQUFFLENBQUM7WUFDbEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakYsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFakYsTUFBTSxZQUFZLEdBQ2QsTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZGLElBQUksWUFBWSxFQUFFO2dCQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUUzQix5RkFBeUY7Z0JBQ3pGLHVGQUF1RjtnQkFDdkYsa0ZBQWtGO2dCQUNsRixVQUFVLEdBQUcsU0FBUyxDQUFDO2FBQ3hCO1lBRUQsTUFBTSxZQUFZLEdBQ2QsTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZGLElBQUksWUFBWSxFQUFFO2dCQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzVCO1lBRUQsT0FBTyxPQUFPLENBQUM7U0FDaEI7UUFFRCxJQUFJLElBQUksR0FBeUIsSUFBSSxDQUFDO1FBQ3RDLElBQUksTUFBTSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtZQUN4QyxJQUFJLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQztTQUMvQjthQUFNLElBQUksTUFBTSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRTtZQUNqRCxJQUFJLEdBQUcsZUFBZSxDQUFDLFFBQVEsQ0FBQztTQUNqQztRQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsSUFBSSxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEYsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNULG1GQUFtRjtZQUNuRiw2REFBNkQ7WUFDN0QsdUVBQXVFO1lBQ3ZFLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xCLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNPLGFBQWEsQ0FDbkIsSUFBb0IsRUFBRSxJQUEwQixFQUFFLFVBQXdCLEVBQzFFLFFBQWtCO1FBQ3BCLElBQUksS0FBSyxHQUF1QixJQUFJLENBQUM7UUFDckMsSUFBSSxJQUFJLEdBQWdCLElBQUksQ0FBQztRQUM3QixJQUFJLFFBQVEsR0FBdUIsSUFBSSxDQUFDO1FBRXhDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM1QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBSSxRQUFRLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdEMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3RCLEtBQUssR0FBRyxJQUFJLEtBQUssZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztTQUN0RTthQUFNLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxRQUFRLENBQUM7WUFDaEMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUMzQixLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUNuQixRQUFRLEdBQUcsS0FBSyxDQUFDO1NBQ2xCO2FBQU0sSUFBSSxFQUFFLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDNUMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUM7WUFDbkMsSUFBSSxHQUFHLGFBQWEsQ0FBQztZQUNyQixRQUFRLEdBQUcsS0FBSyxDQUFDO1NBQ2xCO1FBRUQsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1lBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzVELE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ1QsSUFBSSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDNUIsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUN0QixRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQzthQUN0QjtpQkFBTTtnQkFDTCxPQUFPLElBQUksQ0FBQzthQUNiO1NBQ0Y7UUFFRCw4RUFBOEU7UUFDOUUsbURBQW1EO1FBQ25ELElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUMxQixRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsS0FBSyxTQUFTO2dCQUNuQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUMxRTtRQUVELE1BQU0sSUFBSSxHQUFpQixJQUFZLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztRQUNyRCxPQUFPO1lBQ0wsSUFBSTtZQUNKLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLElBQUk7WUFDSixJQUFJO1lBQ0osSUFBSTtZQUNKLFFBQVE7WUFDUixLQUFLO1lBQ0wsUUFBUTtZQUNSLFVBQVUsRUFBRSxVQUFVLElBQUksRUFBRTtTQUM3QixDQUFDO0lBQ0osQ0FBQztJQUVEOzs7OztPQUtHO0lBQ08sbUNBQW1DLENBQUMsV0FBNEI7UUFFeEUsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUM7UUFDbkQsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUN2QyxNQUFNLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFFLENBQUM7WUFDcEQseUVBQXlFO1lBQ3pFLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLFlBQVk7Z0JBQzlDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQTBDLENBQUM7WUFDL0UsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsT0FBTyxFQUFFLENBQUM7YUFDWDtZQUNELElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNyQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsSUFBSSx3QkFBd0IsQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDekMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDTyx1QkFBdUIsQ0FDN0IsV0FBNEIsRUFBRSxjQUF5QztRQUN6RSxNQUFNLEVBQUMsb0JBQW9CLEVBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFdEUsT0FBTyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ3hDLE1BQU0sRUFBQyxVQUFVLEVBQUUsY0FBYyxFQUFDLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDOUQsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUMsQ0FBQztZQUM3QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQzNCLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUU1RCxPQUFPO2dCQUNMLElBQUksRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDO2dCQUMzQixRQUFRO2dCQUNSLGtCQUFrQjtnQkFDbEIsUUFBUSxFQUFFLElBQUk7Z0JBQ2QsVUFBVTthQUNYLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNLLFdBQVcsQ0FBQyxjQUFrQztRQUNwRCxJQUFJLGNBQWMsS0FBSyxJQUFJLEVBQUU7WUFDM0IsT0FBTztnQkFDTCxJQUFJLHFCQUFvQztnQkFDeEMsTUFBTSxFQUFFLEVBQUMsSUFBSSxzQkFBbUMsRUFBQzthQUNsRCxDQUFDO1NBQ0g7UUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdkQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzdELElBQUksR0FBRyxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1lBQ2pDLE9BQU87Z0JBQ0wsSUFBSSxlQUE4QjtnQkFDbEMsVUFBVSxFQUFFLGNBQWM7Z0JBQzFCLHNCQUFzQixFQUFFLElBQUk7YUFDN0IsQ0FBQztTQUNIO1FBRUQsT0FBTztZQUNMLElBQUksa0JBQWlDO1lBQ3JDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxJQUFJO1lBQzNCLFVBQVUsRUFBRSxHQUFHLENBQUMsSUFBSTtZQUNwQixZQUFZLEVBQUUsR0FBRyxDQUFDLElBQUk7WUFDdEIsVUFBVSxFQUFFLElBQUk7U0FDakIsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSyxxQkFBcUIsQ0FBQyxVQUF5QjtRQUNyRCxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDL0IsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDL0M7YUFBTSxJQUFJLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN4RixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDcEQ7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFDSCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09BNkJHO0lBQ08sOEJBQThCLENBQUMsdUJBQWtDO1FBQ3pFLE1BQU0sZUFBZSxHQUFHLDBCQUEwQixDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDNUUsSUFBSSxlQUFlLEVBQUU7WUFDbkIsNkVBQTZFO1lBQzdFLE1BQU0sU0FBUyxHQUNYLEVBQUUsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztZQUNqRixJQUFJLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDMUMsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDcEMsT0FBTyxRQUFRO3FCQUNWLEdBQUcsQ0FDQSxPQUFPLENBQUMsRUFBRSxDQUNOLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztxQkFDcEYsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUNmLE1BQU0sY0FBYyxHQUNoQixTQUFTLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUN2RSxNQUFNLGFBQWEsR0FDZixTQUFTLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUNuRixNQUFNLFVBQVUsR0FBRyxhQUFhO3dCQUM1QixJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDOzZCQUNoQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7b0JBQ3pELE9BQU8sRUFBQyxjQUFjLEVBQUUsVUFBVSxFQUFDLENBQUM7Z0JBQ3RDLENBQUMsQ0FBQyxDQUFDO2FBQ1I7aUJBQU0sSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFO2dCQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDWiw2Q0FBNkM7b0JBQ3pDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxRQUFRLEdBQUcsS0FBSyxFQUNwRCxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUNoQztTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ08sc0JBQXNCLENBQUMsV0FBNEIsRUFBRSxXQUFxQjtRQUVsRixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUM7YUFDekMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7YUFDNUQsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNPLHFCQUFxQixDQUFDLFdBQTRCO1FBQzFELE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUM7UUFDOUQsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7U0FDNUQ7UUFDRCxNQUFNLFNBQVMsR0FBRyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRCxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ2hDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ2hEO1FBQ0QsOEJBQThCO1FBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQTBDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFRDs7Ozs7Ozs7OztPQVVHO0lBQ08sVUFBVSxDQUFDLFNBQW9CO1FBQ3ZDLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNmLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMvRDthQUFNO1lBQ0wsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxlQUFlLENBQUM7U0FDeEU7SUFDSCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNPLDhCQUE4QixDQUFDLEdBQWtCLEVBQUUsR0FBa0I7UUFFN0UsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQW1DLENBQUM7UUFDbEUsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBMEIsQ0FBQztRQUM1RCxNQUFNLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsOEJBQThCLENBQUMsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUM5RixNQUFNLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsOEJBQThCLENBQUMsY0FBYyxFQUFFLGlCQUFpQixFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7O09BWUc7SUFDTywrQkFBK0IsQ0FBQyxHQUFrQixFQUFFLEdBQWtCO1FBRTlFLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFtQyxDQUFDO1FBQ2xFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7UUFDNUQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUVqRCxNQUFNLFFBQVEsR0FBRyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM3QyxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRTtZQUM5QixJQUFJLENBQUMsOEJBQThCLENBQUMsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1NBQzlFO1FBRUQsTUFBTSxRQUFRLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0MsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUU7WUFDOUIsSUFBSSxDQUFDLDhCQUE4QixDQUFDLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNqRjtRQUNELE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7OztPQUlHO0lBQ08sOEJBQThCLENBQ3BDLGlCQUE4QyxFQUFFLE9BQXNCLEVBQ3RFLE9BQXVCO1FBQ3pCLE1BQU0sU0FBUyxHQUFHLE9BQU8sSUFBSSxPQUFPLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbEUsTUFBTSxhQUFhLEdBQUcsU0FBUyxJQUFJLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN6RSxJQUFJLGFBQWEsRUFBRTtZQUNqQixhQUFhLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFO2dCQUNyQyxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDO2dCQUNqQyxJQUFJLGNBQWMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7b0JBQy9DLGNBQWMsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLENBQUM7aUJBQzNEO2dCQUNELE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDcEQsSUFBSSxXQUFXLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQy9DLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7aUJBQzFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7U0FDSjtJQUNILENBQUM7SUFHUyw4QkFBOEIsQ0FDcEMsY0FBb0QsRUFDcEQsaUJBQThDLEVBQUUsT0FBc0I7UUFDeEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELElBQUksV0FBVyxLQUFLLElBQUksRUFBRTtZQUN4QixLQUFLLE1BQU0sQ0FBQyxVQUFVLEVBQUUsRUFBQyxJQUFJLEVBQUUsZUFBZSxFQUFDLENBQUMsSUFBSSxXQUFXLEVBQUU7Z0JBQy9ELElBQUksaUJBQWlCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO29CQUNyQyxjQUFjLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFFLENBQUMsQ0FBQztpQkFDekU7YUFDRjtTQUNGO0lBQ0gsQ0FBQztJQUVTLDBCQUEwQixDQUFDLFVBQXlCO1FBQzVELElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUMvQixPQUFPLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNwRDtRQUVELElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQTBCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN6RixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM3RSxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDMUQsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRSxJQUFJLGdCQUFnQixLQUFLLElBQUksRUFBRTtZQUM3QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQy9DLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCxNQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUUsQ0FBQztRQUMvRCx1Q0FBVyxVQUFVLEtBQUUsU0FBUyxFQUFFLGFBQWEsQ0FBQyxTQUFTLElBQUU7SUFDN0QsQ0FBQztJQUVELDRGQUE0RjtJQUNsRiw2QkFBNkIsQ0FBQyxJQUFpQjtRQUN2RCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3ZCLDRFQUE0RTtRQUM1RSxpRkFBaUY7UUFDakYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUM5RCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDMUQsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUNELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDM0IscUZBQXFGO1FBQ3JGLHFGQUFxRjtRQUNyRixJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ3hFLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLG1CQUFtQixFQUFFO1lBQ2xELE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFDRCx1RkFBdUY7UUFDdkYsbUZBQW1GO1FBQ25GLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7O09BYUc7SUFDTyxrQkFBa0IsQ0FBQyxXQUFtQztRQUM5RCwyREFBMkQ7UUFDM0QsSUFBSSxXQUFXLENBQUMsV0FBVyxLQUFLLFNBQVM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUV2RCxNQUFNLFlBQVksR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUMvQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRXZELE1BQU0sS0FBSyxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUM7UUFDbEMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRS9ELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEtBQUssWUFBWSxDQUFDLENBQUM7UUFDN0YsSUFBSSxnQkFBZ0IsS0FBSyxDQUFDLENBQUMsSUFBSSxnQkFBZ0IsS0FBSyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFN0YsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM5RCxJQUFJLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRTNELE1BQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFNUUsTUFBTSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFOUMsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVEOzs7Ozs7Ozs7OztPQVdHO0lBQ0ssa0JBQWtCLENBQUMsRUFBeUI7UUFDbEQsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFNUMsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDdkMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFNUMsTUFBTSxXQUFXLEdBQWlCLEVBQUUsQ0FBQztRQUNyQyxLQUFLLE1BQU0sU0FBUyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQzFDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDL0QsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUN2QixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUM5QjtRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7O09BWUc7SUFDTyxpQkFBaUIsQ0FBQyxRQUF1QixFQUFFLFNBQXVCO1FBQzFFLElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFdEQsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQztRQUV4QyxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsRUFBRTtZQUMzQyxPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDckQsSUFBSSxVQUFVLElBQUksSUFBSSxFQUFFO1lBQ3RCLE9BQU8sVUFBVSxDQUFDO1NBQ25CO1FBRUQsaURBQWlEO1FBQ2pELE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDM0QsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxlQUFlLENBQUMsRUFBRTtZQUNoRCxPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsT0FBTyxxQkFBcUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU8sNEJBQTRCLENBQUMsV0FBNEI7UUFDL0QsSUFBSSxXQUFXLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUN0QyxPQUFPLElBQUksQ0FBQyxpQ0FBaUMsQ0FDekMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztTQUN6RDthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUMsaUNBQWlDLENBQ3pDLFdBQVcsRUFBRSxXQUFXLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLENBQUM7U0FDL0Q7SUFDSCxDQUFDO0NBQ0Y7QUFFRCw0Q0FBNEM7QUFFNUM7Ozs7Ozs7Ozs7O0dBV0c7QUFDSCxTQUFTLHFCQUFxQixDQUFDLElBQXVCO0lBQ3BELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBRTlDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVc7UUFDbkYsQ0FBQyxFQUFFLENBQUMseUJBQXlCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQzVDLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUNuQyxJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFO1FBQzNGLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxJQUFJLENBQUMsRUFBRSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3JGLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFPRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FDckIsUUFBdUIsRUFBRSxVQUF5QjtJQUNwRCxJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQztRQUNsQyxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVc7UUFDM0QsQ0FBQyxFQUFFLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2xELE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCwwRUFBMEU7SUFDMUUsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDbEQsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLElBQUksQ0FBQztBQUNsRixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsU0FBUyxxQkFBcUIsQ0FBQyxVQUFnQztJQUM3RCxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0lBQ3RELElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRWhELE9BQU8sRUFBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFDLENBQUM7QUFDM0QsQ0FBQztBQStFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUscUJBQXFCLENBQUMsU0FBdUI7SUFDM0QsT0FBTyxFQUFFLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDLElBQUksWUFBWSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUM7UUFDNUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFFRDs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUFDLFVBQXlCO0lBQ25ELE1BQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzFDLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDOUIsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFFRCxNQUFNLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDN0MsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFDM0QsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFFRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUM7QUFDakIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsWUFBWSxDQUFDLElBQWE7SUFDeEMsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7QUFDOUYsQ0FBQztBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQy9CLElBQXVCLEVBQUUsT0FBK0M7SUFFMUUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyQyxJQUFJLFVBQVUsS0FBSyxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUMsd0JBQXdCLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDeEUsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsT0FBTyxNQUFNLEtBQUssU0FBUyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVFLENBQUM7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUNoQyxJQUF1QixFQUFFLE9BQStDO0lBRzFFLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckMsSUFBSSxVQUFVLEtBQUssU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3hFLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLElBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxDQUFDLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxNQUFNLENBQUM7UUFDOUQsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1FBQ2xFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRTtRQUNwQyxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyQyxPQUFPLFVBQVUsS0FBSyxTQUFTLElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLDBCQUEwQixDQUFDLFVBQXFCO0lBQzlELE1BQU0sY0FBYyxHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQztJQUNuRCxNQUFNLE1BQU0sR0FBRyxjQUFjLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQztJQUN2RCxPQUFPLE1BQU0sSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1RSxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGFBQWEsQ0FBQyxJQUF1QjtJQUM1QyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3BDLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNoRDtJQUNELElBQUksRUFBRSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUNsRCxPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3JEO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBT0QsU0FBUyxxQ0FBcUMsQ0FBQyxJQUFhO0lBRTFELE9BQU8sMEJBQTBCLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxTQUFTLENBQUM7QUFDNUUsQ0FBQztBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsSUFBeUM7SUFDeEUsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUNsQyxPQUFPLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUMvQixVQUFVLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQztLQUMvQjtJQUNELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBdUNHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLFVBQXlCO0lBRWhFLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3JFLE9BQU8sVUFBVSxDQUFDO0tBQ25CO0lBRUQsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3pDLElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRTtRQUMxQixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDekIsZ0VBQWdFO1FBQ2hFLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztLQUN6RjtTQUFNO1FBQ0wsaUVBQWlFO1FBQ2pFLHdFQUF3RTtRQUN4RSxLQUFLLE1BQU0sU0FBUyxJQUFJLFFBQVEsQ0FBQyxVQUFVLEVBQUU7WUFDM0MsSUFBSSx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsSUFBSSwwQkFBMEIsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDL0UsT0FBTyxTQUFTLENBQUM7YUFDbEI7WUFDRCxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsS0FBSyxNQUFNLFdBQVcsSUFBSSxTQUFTLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRTtvQkFDaEUsSUFBSSxxQ0FBcUMsQ0FBQyxXQUFXLENBQUMsRUFBRTt3QkFDdEQsTUFBTSxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBQ2pELElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxFQUFFOzRCQUNyRSxPQUFPLFVBQVUsQ0FBQzt5QkFDbkI7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLElBQWdDO0lBQ3hELDBGQUEwRjtJQUMxRixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUM7U0FDMUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxNQUFNLENBQUMsQ0FBQztJQUNsRixNQUFNLGNBQWMsR0FBRyxZQUFZLElBQUksWUFBWSxDQUFDLFdBQVcsQ0FBQztJQUNoRSxPQUFPLGNBQWMsSUFBSSxFQUFFLENBQUMsd0JBQXdCLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUNsRSxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLEVBQUUsQ0FBQztBQUNULENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLElBQWE7SUFFckMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNwRyxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFvQjtJQUU1QyxPQUFPLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUMxRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7QUFDOUQsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsSUFBYTtJQUN2QyxNQUFNLE9BQU8sR0FBUSxJQUFJLENBQUM7SUFDMUIsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN6RCxDQUFDO0FBR0QsU0FBUyxpQkFBaUIsQ0FBQyxJQUFvQjtJQUU3QyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckYsMkZBQTJGO1FBQzNGLCtDQUErQztRQUMvQyxDQUFDLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBdUJHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FBQyxXQUEyQjtJQUVqRSxJQUFJLElBQUksR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBRTlCLCtEQUErRDtJQUMvRCxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNwRCxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztLQUNwQjtJQUVELE9BQU8sRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUMzRCxDQUFDO0FBRUQsU0FBUyxnQ0FBZ0MsQ0FBQyxJQUFhO0lBRXJELElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ25CLE9BQU8sSUFBSSxLQUFLLFNBQVMsRUFBRTtRQUN6QixJQUFJLDBCQUEwQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3BDLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztLQUNwQjtJQUNELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7QUFDSCxTQUFTLHdCQUF3QixDQUFDLFdBQXNDO0lBQ3RFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBRXBDLE1BQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFL0UsT0FBTyxzQkFBc0IsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDM0QsQ0FBQztBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLFVBQXlCO0lBQ3ZELElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDbkQsSUFBSSxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFlBQVk7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM1RSxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUM7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUVwRCxNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDdkUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDO0FBQy9DLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsSUFBYTtJQUNsRCxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDbEIsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMzRCxNQUFNO1NBQ1A7UUFDRCxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztLQUNwQjtJQUNELE9BQU8sSUFBb0IsQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxNQUFxQjtJQUM5QyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0QsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO1FBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLFFBQVEsZ0NBQWdDLENBQUMsQ0FBQztLQUNqRjtJQUNELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLE1BQXFCO0lBQ25ELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzRCxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsTUFBTSxDQUN6QyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzRixDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsSUFBYTtJQUMvQixPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ3pCLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNwQixPQUFPLEtBQUssQ0FBQztTQUNkO0tBQ0Y7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNILE1BQU0sVUFBVSxnQ0FBZ0MsQ0FBQyxJQUFhO0lBQzVELElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDO1FBQy9ELENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxvRkFBb0Y7SUFFcEYsZUFBZTtJQUNmLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDNUIsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFFdEQsOEJBQThCO0lBQzlCLFNBQVMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBQzdCLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRTtRQUN6RixPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0QsU0FBUyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFFN0IsNkJBQTZCO0lBQzdCLElBQUksU0FBUyxJQUFJLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxTQUFTLENBQUM7UUFBRSxTQUFTLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUV2RiwwQkFBMEI7SUFDMUIsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7UUFBRSxPQUFPLElBQUksQ0FBQztJQUMvRCxTQUFTLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUU3Qiw2QkFBNkI7SUFDN0IsSUFBSSxTQUFTLElBQUksRUFBRSxDQUFDLHlCQUF5QixDQUFDLFNBQVMsQ0FBQztRQUFFLFNBQVMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBRXZGLHFGQUFxRjtJQUNyRixPQUFPLFlBQVksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDckMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUM7S0FDOUI7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGV9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0xvZ2dlcn0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2xvZ2dpbmcnO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBDbGFzc01lbWJlciwgQ2xhc3NNZW1iZXJLaW5kLCBDdG9yUGFyYW1ldGVyLCBEZWNsYXJhdGlvbiwgRGVjbGFyYXRpb25Ob2RlLCBEZWNvcmF0b3IsIEVudW1NZW1iZXIsIEltcG9ydCwgaXNDb25jcmV0ZURlY2xhcmF0aW9uLCBpc0RlY29yYXRvcklkZW50aWZpZXIsIGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uLCBpc05hbWVkRnVuY3Rpb25EZWNsYXJhdGlvbiwgaXNOYW1lZFZhcmlhYmxlRGVjbGFyYXRpb24sIEtub3duRGVjbGFyYXRpb24sIHJlZmxlY3RPYmplY3RMaXRlcmFsLCBTcGVjaWFsRGVjbGFyYXRpb25LaW5kLCBUeXBlU2NyaXB0UmVmbGVjdGlvbkhvc3QsIFR5cGVWYWx1ZVJlZmVyZW5jZSwgVHlwZVZhbHVlUmVmZXJlbmNlS2luZCwgVmFsdWVVbmF2YWlsYWJsZUtpbmR9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9yZWZsZWN0aW9uJztcbmltcG9ydCB7aXNTeW1ib2xXaXRoVmFsdWVEZWNsYXJhdGlvbiwgU3ltYm9sV2l0aFZhbHVlRGVjbGFyYXRpb259IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy91dGlsL3NyYy90eXBlc2NyaXB0JztcbmltcG9ydCB7aXNXaXRoaW5QYWNrYWdlfSBmcm9tICcuLi9hbmFseXNpcy91dGlsJztcbmltcG9ydCB7QnVuZGxlUHJvZ3JhbX0gZnJvbSAnLi4vcGFja2FnZXMvYnVuZGxlX3Byb2dyYW0nO1xuaW1wb3J0IHtmaW5kQWxsLCBnZXROYW1lVGV4dCwgaGFzTmFtZUlkZW50aWZpZXIsIGlzRGVmaW5lZCwgc3RyaXBEb2xsYXJTdWZmaXh9IGZyb20gJy4uL3V0aWxzJztcblxuaW1wb3J0IHtDbGFzc1N5bWJvbCwgaXNTd2l0Y2hhYmxlVmFyaWFibGVEZWNsYXJhdGlvbiwgTmdjY0NsYXNzU3ltYm9sLCBOZ2NjUmVmbGVjdGlvbkhvc3QsIFBSRV9SM19NQVJLRVIsIFN3aXRjaGFibGVWYXJpYWJsZURlY2xhcmF0aW9ufSBmcm9tICcuL25nY2NfaG9zdCc7XG5pbXBvcnQge3N0cmlwUGFyZW50aGVzZXN9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgY29uc3QgREVDT1JBVE9SUyA9ICdkZWNvcmF0b3JzJyBhcyB0cy5fX1N0cmluZztcbmV4cG9ydCBjb25zdCBQUk9QX0RFQ09SQVRPUlMgPSAncHJvcERlY29yYXRvcnMnIGFzIHRzLl9fU3RyaW5nO1xuZXhwb3J0IGNvbnN0IENPTlNUUlVDVE9SID0gJ19fY29uc3RydWN0b3InIGFzIHRzLl9fU3RyaW5nO1xuZXhwb3J0IGNvbnN0IENPTlNUUlVDVE9SX1BBUkFNUyA9ICdjdG9yUGFyYW1ldGVycycgYXMgdHMuX19TdHJpbmc7XG5cbi8qKlxuICogRXNtMjAxNSBwYWNrYWdlcyBjb250YWluIEVDTUFTY3JpcHQgMjAxNSBjbGFzc2VzLCBldGMuXG4gKiBEZWNvcmF0b3JzIGFyZSBkZWZpbmVkIHZpYSBzdGF0aWMgcHJvcGVydGllcyBvbiB0aGUgY2xhc3MuIEZvciBleGFtcGxlOlxuICpcbiAqIGBgYFxuICogY2xhc3MgU29tZURpcmVjdGl2ZSB7XG4gKiB9XG4gKiBTb21lRGlyZWN0aXZlLmRlY29yYXRvcnMgPSBbXG4gKiAgIHsgdHlwZTogRGlyZWN0aXZlLCBhcmdzOiBbeyBzZWxlY3RvcjogJ1tzb21lRGlyZWN0aXZlXScgfSxdIH1cbiAqIF07XG4gKiBTb21lRGlyZWN0aXZlLmN0b3JQYXJhbWV0ZXJzID0gKCkgPT4gW1xuICogICB7IHR5cGU6IFZpZXdDb250YWluZXJSZWYsIH0sXG4gKiAgIHsgdHlwZTogVGVtcGxhdGVSZWYsIH0sXG4gKiAgIHsgdHlwZTogdW5kZWZpbmVkLCBkZWNvcmF0b3JzOiBbeyB0eXBlOiBJbmplY3QsIGFyZ3M6IFtJTkpFQ1RFRF9UT0tFTixdIH0sXSB9LFxuICogXTtcbiAqIFNvbWVEaXJlY3RpdmUucHJvcERlY29yYXRvcnMgPSB7XG4gKiAgIFwiaW5wdXQxXCI6IFt7IHR5cGU6IElucHV0IH0sXSxcbiAqICAgXCJpbnB1dDJcIjogW3sgdHlwZTogSW5wdXQgfSxdLFxuICogfTtcbiAqIGBgYFxuICpcbiAqICogQ2xhc3NlcyBhcmUgZGVjb3JhdGVkIGlmIHRoZXkgaGF2ZSBhIHN0YXRpYyBwcm9wZXJ0eSBjYWxsZWQgYGRlY29yYXRvcnNgLlxuICogKiBNZW1iZXJzIGFyZSBkZWNvcmF0ZWQgaWYgdGhlcmUgaXMgYSBtYXRjaGluZyBrZXkgb24gYSBzdGF0aWMgcHJvcGVydHlcbiAqICAgY2FsbGVkIGBwcm9wRGVjb3JhdG9yc2AuXG4gKiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnMgZGVjb3JhdG9ycyBhcmUgZm91bmQgb24gYW4gb2JqZWN0IHJldHVybmVkIGZyb21cbiAqICAgYSBzdGF0aWMgbWV0aG9kIGNhbGxlZCBgY3RvclBhcmFtZXRlcnNgLlxuICovXG5leHBvcnQgY2xhc3MgRXNtMjAxNVJlZmxlY3Rpb25Ib3N0IGV4dGVuZHMgVHlwZVNjcmlwdFJlZmxlY3Rpb25Ib3N0IGltcGxlbWVudHMgTmdjY1JlZmxlY3Rpb25Ib3N0IHtcbiAgLyoqXG4gICAqIEEgbWFwcGluZyBmcm9tIHNvdXJjZSBkZWNsYXJhdGlvbnMgdG8gdHlwaW5ncyBkZWNsYXJhdGlvbnMsIHdoaWNoIGFyZSBib3RoIHB1YmxpY2x5IGV4cG9ydGVkLlxuICAgKlxuICAgKiBUaGVyZSBzaG91bGQgYmUgb25lIGVudHJ5IGZvciBldmVyeSBwdWJsaWMgZXhwb3J0IHZpc2libGUgZnJvbSB0aGUgcm9vdCBmaWxlIG9mIHRoZSBzb3VyY2VcbiAgICogdHJlZS4gTm90ZSB0aGF0IGJ5IGRlZmluaXRpb24gdGhlIGtleSBhbmQgdmFsdWUgZGVjbGFyYXRpb25zIHdpbGwgbm90IGJlIGluIHRoZSBzYW1lIFRTXG4gICAqIHByb2dyYW0uXG4gICAqL1xuICBwcm90ZWN0ZWQgcHVibGljRHRzRGVjbGFyYXRpb25NYXA6IE1hcDxEZWNsYXJhdGlvbk5vZGUsIHRzLkRlY2xhcmF0aW9uPnxudWxsID0gbnVsbDtcbiAgLyoqXG4gICAqIEEgbWFwcGluZyBmcm9tIHNvdXJjZSBkZWNsYXJhdGlvbnMgdG8gdHlwaW5ncyBkZWNsYXJhdGlvbnMsIHdoaWNoIGFyZSBub3QgcHVibGljbHkgZXhwb3J0ZWQuXG4gICAqXG4gICAqIFRoaXMgbWFwcGluZyBpcyBhIGJlc3QgZ3Vlc3MgYmV0d2VlbiBkZWNsYXJhdGlvbnMgdGhhdCBoYXBwZW4gdG8gYmUgZXhwb3J0ZWQgZnJvbSB0aGVpciBmaWxlIGJ5XG4gICAqIHRoZSBzYW1lIG5hbWUgaW4gYm90aCB0aGUgc291cmNlIGFuZCB0aGUgZHRzIGZpbGUuIE5vdGUgdGhhdCBieSBkZWZpbml0aW9uIHRoZSBrZXkgYW5kIHZhbHVlXG4gICAqIGRlY2xhcmF0aW9ucyB3aWxsIG5vdCBiZSBpbiB0aGUgc2FtZSBUUyBwcm9ncmFtLlxuICAgKi9cbiAgcHJvdGVjdGVkIHByaXZhdGVEdHNEZWNsYXJhdGlvbk1hcDogTWFwPERlY2xhcmF0aW9uTm9kZSwgdHMuRGVjbGFyYXRpb24+fG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgc2V0IG9mIHNvdXJjZSBmaWxlcyB0aGF0IGhhdmUgYWxyZWFkeSBiZWVuIHByZXByb2Nlc3NlZC5cbiAgICovXG4gIHByb3RlY3RlZCBwcmVwcm9jZXNzZWRTb3VyY2VGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvKipcbiAgICogSW4gRVMyMDE1LCBjbGFzcyBkZWNsYXJhdGlvbnMgbWF5IGhhdmUgYmVlbiBkb3duLWxldmVsZWQgaW50byB2YXJpYWJsZSBkZWNsYXJhdGlvbnMsXG4gICAqIGluaXRpYWxpemVkIHVzaW5nIGEgY2xhc3MgZXhwcmVzc2lvbi4gSW4gY2VydGFpbiBzY2VuYXJpb3MsIGFuIGFkZGl0aW9uYWwgdmFyaWFibGVcbiAgICogaXMgaW50cm9kdWNlZCB0aGF0IHJlcHJlc2VudHMgdGhlIGNsYXNzIHNvIHRoYXQgcmVzdWx0cyBpbiBjb2RlIHN1Y2ggYXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBsZXQgTXlDbGFzc18xOyBsZXQgTXlDbGFzcyA9IE15Q2xhc3NfMSA9IGNsYXNzIE15Q2xhc3Mge307XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGlzIG1hcCB0cmFja3MgdGhvc2UgYWxpYXNlZCB2YXJpYWJsZXMgdG8gdGhlaXIgb3JpZ2luYWwgaWRlbnRpZmllciwgaS5lLiB0aGUga2V5XG4gICAqIGNvcnJlc3BvbmRzIHdpdGggdGhlIGRlY2xhcmF0aW9uIG9mIGBNeUNsYXNzXzFgIGFuZCBpdHMgdmFsdWUgYmVjb21lcyB0aGUgYE15Q2xhc3NgIGlkZW50aWZpZXJcbiAgICogb2YgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgKlxuICAgKiBUaGlzIG1hcCBpcyBwb3B1bGF0ZWQgZHVyaW5nIHRoZSBwcmVwcm9jZXNzaW5nIG9mIGVhY2ggc291cmNlIGZpbGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgYWxpYXNlZENsYXNzRGVjbGFyYXRpb25zID0gbmV3IE1hcDxEZWNsYXJhdGlvbk5vZGUsIHRzLklkZW50aWZpZXI+KCk7XG5cbiAgLyoqXG4gICAqIENhY2hlcyB0aGUgaW5mb3JtYXRpb24gb2YgdGhlIGRlY29yYXRvcnMgb24gYSBjbGFzcywgYXMgdGhlIHdvcmsgaW52b2x2ZWQgd2l0aCBleHRyYWN0aW5nXG4gICAqIGRlY29yYXRvcnMgaXMgY29tcGxleCBhbmQgZnJlcXVlbnRseSB1c2VkLlxuICAgKlxuICAgKiBUaGlzIG1hcCBpcyBsYXppbHkgcG9wdWxhdGVkIGR1cmluZyB0aGUgZmlyc3QgY2FsbCB0byBgYWNxdWlyZURlY29yYXRvckluZm9gIGZvciBhIGdpdmVuIGNsYXNzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGRlY29yYXRvckNhY2hlID0gbmV3IE1hcDxDbGFzc0RlY2xhcmF0aW9uLCBEZWNvcmF0b3JJbmZvPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJvdGVjdGVkIGxvZ2dlcjogTG9nZ2VyLCBwcm90ZWN0ZWQgaXNDb3JlOiBib29sZWFuLCBwcm90ZWN0ZWQgc3JjOiBCdW5kbGVQcm9ncmFtLFxuICAgICAgcHJvdGVjdGVkIGR0czogQnVuZGxlUHJvZ3JhbXxudWxsID0gbnVsbCkge1xuICAgIHN1cGVyKHNyYy5wcm9ncmFtLmdldFR5cGVDaGVja2VyKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgYSBzeW1ib2wgZm9yIGEgbm9kZSB0aGF0IHdlIHRoaW5rIGlzIGEgY2xhc3MuXG4gICAqIENsYXNzZXMgc2hvdWxkIGhhdmUgYSBgbmFtZWAgaWRlbnRpZmllciwgYmVjYXVzZSB0aGV5IG1heSBuZWVkIHRvIGJlIHJlZmVyZW5jZWQgaW4gb3RoZXIgcGFydHNcbiAgICogb2YgdGhlIHByb2dyYW0uXG4gICAqXG4gICAqIEluIEVTMjAxNSwgYSBjbGFzcyBtYXkgYmUgZGVjbGFyZWQgdXNpbmcgYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBvZiB0aGUgZm9sbG93aW5nIHN0cnVjdHVyZXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgTXlDbGFzcyA9IE15Q2xhc3NfMSA9IGNsYXNzIE15Q2xhc3Mge307XG4gICAqIGBgYFxuICAgKlxuICAgKiBvclxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIE15Q2xhc3MgPSBNeUNsYXNzXzEgPSAoKCkgPT4geyBjbGFzcyBNeUNsYXNzIHt9IC4uLiByZXR1cm4gTXlDbGFzczsgfSkoKVxuICAgKiBgYGBcbiAgICpcbiAgICogSGVyZSwgdGhlIGludGVybWVkaWF0ZSBgTXlDbGFzc18xYCBhc3NpZ25tZW50IGlzIG9wdGlvbmFsLiBJbiB0aGUgYWJvdmUgZXhhbXBsZSwgdGhlXG4gICAqIGBjbGFzcyBNeUNsYXNzIHt9YCBub2RlIGlzIHJldHVybmVkIGFzIGRlY2xhcmF0aW9uIG9mIGBNeUNsYXNzYC5cbiAgICpcbiAgICogQHBhcmFtIGRlY2xhcmF0aW9uIHRoZSBkZWNsYXJhdGlvbiBub2RlIHdob3NlIHN5bWJvbCB3ZSBhcmUgZmluZGluZy5cbiAgICogQHJldHVybnMgdGhlIHN5bWJvbCBmb3IgdGhlIG5vZGUgb3IgYHVuZGVmaW5lZGAgaWYgaXQgaXMgbm90IGEgXCJjbGFzc1wiIG9yIGhhcyBubyBzeW1ib2wuXG4gICAqL1xuICBnZXRDbGFzc1N5bWJvbChkZWNsYXJhdGlvbjogdHMuTm9kZSk6IE5nY2NDbGFzc1N5bWJvbHx1bmRlZmluZWQge1xuICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuZ2V0Q2xhc3NTeW1ib2xGcm9tT3V0ZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbik7XG4gICAgaWYgKHN5bWJvbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gc3ltYm9sO1xuICAgIH1cbiAgICBjb25zdCBpbm5lckRlY2xhcmF0aW9uID0gdGhpcy5nZXRJbm5lckRlY2xhcmF0aW9uRnJvbUFsaWFzT3JJbm5lcihkZWNsYXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q2xhc3NTeW1ib2xGcm9tSW5uZXJEZWNsYXJhdGlvbihpbm5lckRlY2xhcmF0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGFtaW5lIGEgZGVjbGFyYXRpb24gKGZvciBleGFtcGxlLCBvZiBhIGNsYXNzIG9yIGZ1bmN0aW9uKSBhbmQgcmV0dXJuIG1ldGFkYXRhIGFib3V0IGFueVxuICAgKiBkZWNvcmF0b3JzIHByZXNlbnQgb24gdGhlIGRlY2xhcmF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbGFyYXRpb24gYSBUeXBlU2NyaXB0IG5vZGUgcmVwcmVzZW50aW5nIHRoZSBjbGFzcyBvciBmdW5jdGlvbiBvdmVyIHdoaWNoIHRvIHJlZmxlY3QuXG4gICAqICAgICBGb3IgZXhhbXBsZSwgaWYgdGhlIGludGVudCBpcyB0byByZWZsZWN0IHRoZSBkZWNvcmF0b3JzIG9mIGEgY2xhc3MgYW5kIHRoZSBzb3VyY2UgaXMgaW4gRVM2XG4gICAqICAgICBmb3JtYXQsIHRoaXMgd2lsbCBiZSBhIGB0cy5DbGFzc0RlY2xhcmF0aW9uYCBub2RlLiBJZiB0aGUgc291cmNlIGlzIGluIEVTNSBmb3JtYXQsIHRoaXNcbiAgICogICAgIG1pZ2h0IGJlIGEgYHRzLlZhcmlhYmxlRGVjbGFyYXRpb25gIGFzIGNsYXNzZXMgaW4gRVM1IGFyZSByZXByZXNlbnRlZCBhcyB0aGUgcmVzdWx0IG9mIGFuXG4gICAqICAgICBJSUZFIGV4ZWN1dGlvbi5cbiAgICpcbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2YgYERlY29yYXRvcmAgbWV0YWRhdGEgaWYgZGVjb3JhdG9ycyBhcmUgcHJlc2VudCBvbiB0aGUgZGVjbGFyYXRpb24sIG9yXG4gICAqICAgICBgbnVsbGAgaWYgZWl0aGVyIG5vIGRlY29yYXRvcnMgd2VyZSBwcmVzZW50IG9yIGlmIHRoZSBkZWNsYXJhdGlvbiBpcyBub3Qgb2YgYSBkZWNvcmF0YWJsZVxuICAgKiAgICAgdHlwZS5cbiAgICovXG4gIGdldERlY29yYXRvcnNPZkRlY2xhcmF0aW9uKGRlY2xhcmF0aW9uOiBEZWNsYXJhdGlvbk5vZGUpOiBEZWNvcmF0b3JbXXxudWxsIHtcbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmdldENsYXNzU3ltYm9sKGRlY2xhcmF0aW9uKTtcbiAgICBpZiAoIXN5bWJvbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldERlY29yYXRvcnNPZlN5bWJvbChzeW1ib2wpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4YW1pbmUgYSBkZWNsYXJhdGlvbiB3aGljaCBzaG91bGQgYmUgb2YgYSBjbGFzcywgYW5kIHJldHVybiBtZXRhZGF0YSBhYm91dCB0aGUgbWVtYmVycyBvZiB0aGVcbiAgICogY2xhc3MuXG4gICAqXG4gICAqIEBwYXJhbSBjbGF6eiBhIGBDbGFzc0RlY2xhcmF0aW9uYCByZXByZXNlbnRpbmcgdGhlIGNsYXNzIG92ZXIgd2hpY2ggdG8gcmVmbGVjdC5cbiAgICpcbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2YgYENsYXNzTWVtYmVyYCBtZXRhZGF0YSByZXByZXNlbnRpbmcgdGhlIG1lbWJlcnMgb2YgdGhlIGNsYXNzLlxuICAgKlxuICAgKiBAdGhyb3dzIGlmIGBkZWNsYXJhdGlvbmAgZG9lcyBub3QgcmVzb2x2ZSB0byBhIGNsYXNzIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgZ2V0TWVtYmVyc09mQ2xhc3MoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiBDbGFzc01lbWJlcltdIHtcbiAgICBjb25zdCBjbGFzc1N5bWJvbCA9IHRoaXMuZ2V0Q2xhc3NTeW1ib2woY2xhenopO1xuICAgIGlmICghY2xhc3NTeW1ib2wpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXR0ZW1wdGVkIHRvIGdldCBtZW1iZXJzIG9mIGEgbm9uLWNsYXNzOiBcIiR7Y2xhenouZ2V0VGV4dCgpfVwiYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZ2V0TWVtYmVyc09mU3ltYm9sKGNsYXNzU3ltYm9sKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWZsZWN0IG92ZXIgdGhlIGNvbnN0cnVjdG9yIG9mIGEgY2xhc3MgYW5kIHJldHVybiBtZXRhZGF0YSBhYm91dCBpdHMgcGFyYW1ldGVycy5cbiAgICpcbiAgICogVGhpcyBtZXRob2Qgb25seSBsb29rcyBhdCB0aGUgY29uc3RydWN0b3Igb2YgYSBjbGFzcyBkaXJlY3RseSBhbmQgbm90IGF0IGFueSBpbmhlcml0ZWRcbiAgICogY29uc3RydWN0b3JzLlxuICAgKlxuICAgKiBAcGFyYW0gY2xhenogYSBgQ2xhc3NEZWNsYXJhdGlvbmAgcmVwcmVzZW50aW5nIHRoZSBjbGFzcyBvdmVyIHdoaWNoIHRvIHJlZmxlY3QuXG4gICAqXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIGBQYXJhbWV0ZXJgIG1ldGFkYXRhIHJlcHJlc2VudGluZyB0aGUgcGFyYW1ldGVycyBvZiB0aGUgY29uc3RydWN0b3IsIGlmXG4gICAqIGEgY29uc3RydWN0b3IgZXhpc3RzLiBJZiB0aGUgY29uc3RydWN0b3IgZXhpc3RzIGFuZCBoYXMgMCBwYXJhbWV0ZXJzLCB0aGlzIGFycmF5IHdpbGwgYmUgZW1wdHkuXG4gICAqIElmIHRoZSBjbGFzcyBoYXMgbm8gY29uc3RydWN0b3IsIHRoaXMgbWV0aG9kIHJldHVybnMgYG51bGxgLlxuICAgKlxuICAgKiBAdGhyb3dzIGlmIGBkZWNsYXJhdGlvbmAgZG9lcyBub3QgcmVzb2x2ZSB0byBhIGNsYXNzIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgZ2V0Q29uc3RydWN0b3JQYXJhbWV0ZXJzKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogQ3RvclBhcmFtZXRlcltdfG51bGwge1xuICAgIGNvbnN0IGNsYXNzU3ltYm9sID0gdGhpcy5nZXRDbGFzc1N5bWJvbChjbGF6eik7XG4gICAgaWYgKCFjbGFzc1N5bWJvbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBdHRlbXB0ZWQgdG8gZ2V0IGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMgb2YgYSBub24tY2xhc3M6IFwiJHtjbGF6ei5nZXRUZXh0KCl9XCJgKTtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1ldGVyTm9kZXMgPSB0aGlzLmdldENvbnN0cnVjdG9yUGFyYW1ldGVyRGVjbGFyYXRpb25zKGNsYXNzU3ltYm9sKTtcbiAgICBpZiAocGFyYW1ldGVyTm9kZXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldENvbnN0cnVjdG9yUGFyYW1JbmZvKGNsYXNzU3ltYm9sLCBwYXJhbWV0ZXJOb2Rlcyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0QmFzZUNsYXNzRXhwcmVzc2lvbihjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgLy8gRmlyc3QgdHJ5IGdldHRpbmcgdGhlIGJhc2UgY2xhc3MgZnJvbSBhbiBFUzIwMTUgY2xhc3MgZGVjbGFyYXRpb25cbiAgICBjb25zdCBzdXBlckJhc2VDbGFzc0lkZW50aWZpZXIgPSBzdXBlci5nZXRCYXNlQ2xhc3NFeHByZXNzaW9uKGNsYXp6KTtcbiAgICBpZiAoc3VwZXJCYXNlQ2xhc3NJZGVudGlmaWVyKSB7XG4gICAgICByZXR1cm4gc3VwZXJCYXNlQ2xhc3NJZGVudGlmaWVyO1xuICAgIH1cblxuICAgIC8vIFRoYXQgZGlkbid0IHdvcmsgc28gbm93IHRyeSBnZXR0aW5nIGl0IGZyb20gdGhlIFwiaW5uZXJcIiBkZWNsYXJhdGlvbi5cbiAgICBjb25zdCBjbGFzc1N5bWJvbCA9IHRoaXMuZ2V0Q2xhc3NTeW1ib2woY2xhenopO1xuICAgIGlmIChjbGFzc1N5bWJvbD8uaW1wbGVtZW50YXRpb24udmFsdWVEZWNsYXJhdGlvbiA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICFpc05hbWVkRGVjbGFyYXRpb24oY2xhc3NTeW1ib2wuaW1wbGVtZW50YXRpb24udmFsdWVEZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gc3VwZXIuZ2V0QmFzZUNsYXNzRXhwcmVzc2lvbihjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uKTtcbiAgfVxuXG4gIGdldEludGVybmFsTmFtZU9mQ2xhc3MoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiB0cy5JZGVudGlmaWVyIHtcbiAgICBjb25zdCBjbGFzc1N5bWJvbCA9IHRoaXMuZ2V0Q2xhc3NTeW1ib2woY2xhenopO1xuICAgIGlmIChjbGFzc1N5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGdldEludGVybmFsTmFtZU9mQ2xhc3MoKSBjYWxsZWQgb24gYSBub24tY2xhc3M6IGV4cGVjdGVkICR7XG4gICAgICAgICAgY2xhenoubmFtZS50ZXh0fSB0byBiZSBhIGNsYXNzIGRlY2xhcmF0aW9uLmApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5nZXROYW1lRnJvbUNsYXNzU3ltYm9sRGVjbGFyYXRpb24oXG4gICAgICAgIGNsYXNzU3ltYm9sLCBjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uKTtcbiAgfVxuXG4gIGdldEFkamFjZW50TmFtZU9mQ2xhc3MoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiB0cy5JZGVudGlmaWVyIHtcbiAgICBjb25zdCBjbGFzc1N5bWJvbCA9IHRoaXMuZ2V0Q2xhc3NTeW1ib2woY2xhenopO1xuICAgIGlmIChjbGFzc1N5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGdldEFkamFjZW50TmFtZU9mQ2xhc3MoKSBjYWxsZWQgb24gYSBub24tY2xhc3M6IGV4cGVjdGVkICR7XG4gICAgICAgICAgY2xhenoubmFtZS50ZXh0fSB0byBiZSBhIGNsYXNzIGRlY2xhcmF0aW9uLmApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmdldEFkamFjZW50TmFtZU9mQ2xhc3NTeW1ib2woY2xhc3NTeW1ib2wpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXROYW1lRnJvbUNsYXNzU3ltYm9sRGVjbGFyYXRpb24oXG4gICAgICBjbGFzc1N5bWJvbDogTmdjY0NsYXNzU3ltYm9sLCBkZWNsYXJhdGlvbjogdHMuRGVjbGFyYXRpb258dW5kZWZpbmVkKTogdHMuSWRlbnRpZmllciB7XG4gICAgaWYgKGRlY2xhcmF0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgZ2V0SW50ZXJuYWxOYW1lT2ZDbGFzcygpIGNhbGxlZCBvbiBhIGNsYXNzIHdpdGggYW4gdW5kZWZpbmVkIGludGVybmFsIGRlY2xhcmF0aW9uLiBFeHRlcm5hbCBjbGFzcyBuYW1lOiAke1xuICAgICAgICAgICAgICBjbGFzc1N5bWJvbC5uYW1lfTsgaW50ZXJuYWwgY2xhc3MgbmFtZTogJHtjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi5uYW1lfS5gKTtcbiAgICB9XG4gICAgaWYgKCFpc05hbWVkRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYGdldEludGVybmFsTmFtZU9mQ2xhc3MoKSBjYWxsZWQgb24gYSBjbGFzcyB3aXRoIGFuIGFub255bW91cyBpbm5lciBkZWNsYXJhdGlvbjogZXhwZWN0ZWQgYSBuYW1lIG9uOlxcbiR7XG4gICAgICAgICAgICAgIGRlY2xhcmF0aW9uLmdldFRleHQoKX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uLm5hbWU7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgd2hldGhlciB0aGUgZ2l2ZW4gbm9kZSBhY3R1YWxseSByZXByZXNlbnRzIGEgY2xhc3MuXG4gICAqL1xuICBpc0NsYXNzKG5vZGU6IHRzLk5vZGUpOiBub2RlIGlzIENsYXNzRGVjbGFyYXRpb24ge1xuICAgIHJldHVybiBzdXBlci5pc0NsYXNzKG5vZGUpIHx8IHRoaXMuZ2V0Q2xhc3NTeW1ib2wobm9kZSkgIT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFjZSBhbiBpZGVudGlmaWVyIHRvIGl0cyBkZWNsYXJhdGlvbiwgaWYgcG9zc2libGUuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGF0dGVtcHRzIHRvIHJlc29sdmUgdGhlIGRlY2xhcmF0aW9uIG9mIHRoZSBnaXZlbiBpZGVudGlmaWVyLCB0cmFjaW5nIGJhY2sgdGhyb3VnaFxuICAgKiBpbXBvcnRzIGFuZCByZS1leHBvcnRzIHVudGlsIHRoZSBvcmlnaW5hbCBkZWNsYXJhdGlvbiBzdGF0ZW1lbnQgaXMgZm91bmQuIEEgYERlY2xhcmF0aW9uYFxuICAgKiBvYmplY3QgaXMgcmV0dXJuZWQgaWYgdGhlIG9yaWdpbmFsIGRlY2xhcmF0aW9uIGlzIGZvdW5kLCBvciBgbnVsbGAgaXMgcmV0dXJuZWQgb3RoZXJ3aXNlLlxuICAgKlxuICAgKiBJbiBFUzIwMTUsIHdlIG5lZWQgdG8gYWNjb3VudCBmb3IgaWRlbnRpZmllcnMgdGhhdCByZWZlciB0byBhbGlhc2VkIGNsYXNzIGRlY2xhcmF0aW9ucyBzdWNoIGFzXG4gICAqIGBNeUNsYXNzXzFgLiBTaW5jZSBzdWNoIGRlY2xhcmF0aW9ucyBhcmUgb25seSBhdmFpbGFibGUgd2l0aGluIHRoZSBtb2R1bGUgaXRzZWxmLCB3ZSBuZWVkIHRvXG4gICAqIGZpbmQgdGhlIG9yaWdpbmFsIGNsYXNzIGRlY2xhcmF0aW9uLCBlLmcuIGBNeUNsYXNzYCwgdGhhdCBpcyBhc3NvY2lhdGVkIHdpdGggdGhlIGFsaWFzZWQgb25lLlxuICAgKlxuICAgKiBAcGFyYW0gaWQgYSBUeXBlU2NyaXB0IGB0cy5JZGVudGlmaWVyYCB0byB0cmFjZSBiYWNrIHRvIGEgZGVjbGFyYXRpb24uXG4gICAqXG4gICAqIEByZXR1cm5zIG1ldGFkYXRhIGFib3V0IHRoZSBgRGVjbGFyYXRpb25gIGlmIHRoZSBvcmlnaW5hbCBkZWNsYXJhdGlvbiBpcyBmb3VuZCwgb3IgYG51bGxgXG4gICAqIG90aGVyd2lzZS5cbiAgICovXG4gIGdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgY29uc3Qgc3VwZXJEZWNsYXJhdGlvbiA9IHN1cGVyLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkKTtcblxuICAgIC8vIElmIG5vIGRlY2xhcmF0aW9uIHdhcyBmb3VuZCwgcmV0dXJuLlxuICAgIGlmIChzdXBlckRlY2xhcmF0aW9uID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gc3VwZXJEZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgZGVjbGFyYXRpb24gYWxyZWFkeSBoYXMgdHJhaXRzIGFzc2lnbmVkIHRvIGl0LCByZXR1cm4gYXMgaXMuXG4gICAgaWYgKHN1cGVyRGVjbGFyYXRpb24ua25vd24gIT09IG51bGwgfHxcbiAgICAgICAgaXNDb25jcmV0ZURlY2xhcmF0aW9uKHN1cGVyRGVjbGFyYXRpb24pICYmIHN1cGVyRGVjbGFyYXRpb24uaWRlbnRpdHkgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBzdXBlckRlY2xhcmF0aW9uO1xuICAgIH1cblxuICAgIGxldCBkZWNsYXJhdGlvbk5vZGU6IHRzLk5vZGUgPSBzdXBlckRlY2xhcmF0aW9uLm5vZGU7XG4gICAgaWYgKGlzTmFtZWRWYXJpYWJsZURlY2xhcmF0aW9uKHN1cGVyRGVjbGFyYXRpb24ubm9kZSkgJiYgIWlzVG9wTGV2ZWwoc3VwZXJEZWNsYXJhdGlvbi5ub2RlKSkge1xuICAgICAgY29uc3QgdmFyaWFibGVWYWx1ZSA9IHRoaXMuZ2V0VmFyaWFibGVWYWx1ZShzdXBlckRlY2xhcmF0aW9uLm5vZGUpO1xuICAgICAgaWYgKHZhcmlhYmxlVmFsdWUgIT09IG51bGwgJiYgdHMuaXNDbGFzc0V4cHJlc3Npb24odmFyaWFibGVWYWx1ZSkpIHtcbiAgICAgICAgZGVjbGFyYXRpb25Ob2RlID0gZ2V0Q29udGFpbmluZ1N0YXRlbWVudCh2YXJpYWJsZVZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvdXRlck5vZGUgPSBnZXRPdXRlck5vZGVGcm9tSW5uZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbk5vZGUpO1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gb3V0ZXJOb2RlICE9PSBudWxsICYmIGlzTmFtZWRWYXJpYWJsZURlY2xhcmF0aW9uKG91dGVyTm9kZSkgP1xuICAgICAgICB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKG91dGVyTm9kZS5uYW1lKSA6XG4gICAgICAgIHN1cGVyRGVjbGFyYXRpb247XG4gICAgaWYgKGRlY2xhcmF0aW9uID09PSBudWxsIHx8IGRlY2xhcmF0aW9uLmtub3duICE9PSBudWxsIHx8XG4gICAgICAgIGlzQ29uY3JldGVEZWNsYXJhdGlvbihkZWNsYXJhdGlvbikgJiYgZGVjbGFyYXRpb24uaWRlbnRpdHkgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBkZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICAvLyBUaGUgaWRlbnRpZmllciBtYXkgaGF2ZSBiZWVuIG9mIGFuIGFkZGl0aW9uYWwgY2xhc3MgYXNzaWdubWVudCBzdWNoIGFzIGBNeUNsYXNzXzFgIHRoYXQgd2FzXG4gICAgLy8gcHJlc2VudCBhcyBhbGlhcyBmb3IgYE15Q2xhc3NgLiBJZiBzbywgcmVzb2x2ZSBzdWNoIGFsaWFzZXMgdG8gdGhlaXIgb3JpZ2luYWwgZGVjbGFyYXRpb24uXG4gICAgY29uc3QgYWxpYXNlZElkZW50aWZpZXIgPSB0aGlzLnJlc29sdmVBbGlhc2VkQ2xhc3NJZGVudGlmaWVyKGRlY2xhcmF0aW9uLm5vZGUpO1xuICAgIGlmIChhbGlhc2VkSWRlbnRpZmllciAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIoYWxpYXNlZElkZW50aWZpZXIpO1xuICAgIH1cblxuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9ucyBtYXkgcmVwcmVzZW50IGFuIGVudW0gZGVjbGFyYXRpb24sIHNvIGF0dGVtcHQgdG8gcmVzb2x2ZSBpdHMgbWVtYmVycy5cbiAgICBpZiAoaXNDb25jcmV0ZURlY2xhcmF0aW9uKGRlY2xhcmF0aW9uKSAmJiB0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbGFyYXRpb24ubm9kZSkpIHtcbiAgICAgIGNvbnN0IGVudW1NZW1iZXJzID0gdGhpcy5yZXNvbHZlRW51bU1lbWJlcnMoZGVjbGFyYXRpb24ubm9kZSk7XG4gICAgICBpZiAoZW51bU1lbWJlcnMgIT09IG51bGwpIHtcbiAgICAgICAgZGVjbGFyYXRpb24uaWRlbnRpdHkgPSB7a2luZDogU3BlY2lhbERlY2xhcmF0aW9uS2luZC5Eb3dubGV2ZWxlZEVudW0sIGVudW1NZW1iZXJzfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVjbGFyYXRpb247XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhbGwgZGVjb3JhdG9ycyBvZiB0aGUgZ2l2ZW4gY2xhc3Mgc3ltYm9sLiBBbnkgZGVjb3JhdG9yIHRoYXQgaGF2ZSBiZWVuIHN5bnRoZXRpY2FsbHlcbiAgICogaW5qZWN0ZWQgYnkgYSBtaWdyYXRpb24gd2lsbCBub3QgYmUgcHJlc2VudCBpbiB0aGUgcmV0dXJuZWQgY29sbGVjdGlvbi5cbiAgICovXG4gIGdldERlY29yYXRvcnNPZlN5bWJvbChzeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IERlY29yYXRvcltdfG51bGwge1xuICAgIGNvbnN0IHtjbGFzc0RlY29yYXRvcnN9ID0gdGhpcy5hY3F1aXJlRGVjb3JhdG9ySW5mbyhzeW1ib2wpO1xuICAgIGlmIChjbGFzc0RlY29yYXRvcnMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFJldHVybiBhIGNsb25lIG9mIHRoZSBhcnJheSB0byBwcmV2ZW50IGNvbnN1bWVycyBmcm9tIG11dGF0aW5nIHRoZSBjYWNoZS5cbiAgICByZXR1cm4gQXJyYXkuZnJvbShjbGFzc0RlY29yYXRvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlYXJjaCB0aGUgZ2l2ZW4gbW9kdWxlIGZvciB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgaW4gd2hpY2ggdGhlIGluaXRpYWxpemVyXG4gICAqIGlzIGFuIGlkZW50aWZpZXIgbWFya2VkIHdpdGggdGhlIGBQUkVfUjNfTUFSS0VSYC5cbiAgICogQHBhcmFtIG1vZHVsZSB0aGUgbW9kdWxlIGluIHdoaWNoIHRvIHNlYXJjaCBmb3Igc3dpdGNoYWJsZSBkZWNsYXJhdGlvbnMuXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIHZhcmlhYmxlIGRlY2xhcmF0aW9ucyB0aGF0IG1hdGNoLlxuICAgKi9cbiAgZ2V0U3dpdGNoYWJsZURlY2xhcmF0aW9ucyhtb2R1bGU6IHRzLk5vZGUpOiBTd2l0Y2hhYmxlVmFyaWFibGVEZWNsYXJhdGlvbltdIHtcbiAgICAvLyBEb24ndCBib3RoZXIgdG8gd2FsayB0aGUgQVNUIGlmIHRoZSBtYXJrZXIgaXMgbm90IGZvdW5kIGluIHRoZSB0ZXh0XG4gICAgcmV0dXJuIG1vZHVsZS5nZXRUZXh0KCkuaW5kZXhPZihQUkVfUjNfTUFSS0VSKSA+PSAwID9cbiAgICAgICAgZmluZEFsbChtb2R1bGUsIGlzU3dpdGNoYWJsZVZhcmlhYmxlRGVjbGFyYXRpb24pIDpcbiAgICAgICAgW107XG4gIH1cblxuICBnZXRWYXJpYWJsZVZhbHVlKGRlY2xhcmF0aW9uOiB0cy5WYXJpYWJsZURlY2xhcmF0aW9uKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBjb25zdCB2YWx1ZSA9IHN1cGVyLmdldFZhcmlhYmxlVmFsdWUoZGVjbGFyYXRpb24pO1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8vIFdlIGhhdmUgYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiB0aGF0IGhhcyBubyBpbml0aWFsaXplci4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyBgYGBcbiAgICAvLyB2YXIgSHR0cENsaWVudFhzcmZNb2R1bGVfMTtcbiAgICAvLyBgYGBcbiAgICAvL1xuICAgIC8vIFNvIGxvb2sgZm9yIHRoZSBzcGVjaWFsIHNjZW5hcmlvIHdoZXJlIHRoZSB2YXJpYWJsZSBpcyBiZWluZyBhc3NpZ25lZCBpblxuICAgIC8vIGEgbmVhcmJ5IHN0YXRlbWVudCB0byB0aGUgcmV0dXJuIHZhbHVlIG9mIGEgY2FsbCB0byBgX19kZWNvcmF0ZWAuXG4gICAgLy8gVGhlbiBmaW5kIHRoZSAybmQgYXJndW1lbnQgb2YgdGhhdCBjYWxsLCB0aGUgXCJ0YXJnZXRcIiwgd2hpY2ggd2lsbCBiZSB0aGVcbiAgICAvLyBhY3R1YWwgY2xhc3MgaWRlbnRpZmllci4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyBgYGBcbiAgICAvLyBIdHRwQ2xpZW50WHNyZk1vZHVsZSA9IEh0dHBDbGllbnRYc3JmTW9kdWxlXzEgPSB0c2xpYl8xLl9fZGVjb3JhdGUoW1xuICAgIC8vICAgTmdNb2R1bGUoe1xuICAgIC8vICAgICBwcm92aWRlcnM6IFtdLFxuICAgIC8vICAgfSlcbiAgICAvLyBdLCBIdHRwQ2xpZW50WHNyZk1vZHVsZSk7XG4gICAgLy8gYGBgXG4gICAgLy9cbiAgICAvLyBBbmQgZmluYWxseSwgZmluZCB0aGUgZGVjbGFyYXRpb24gb2YgdGhlIGlkZW50aWZpZXIgaW4gdGhhdCBhcmd1bWVudC5cbiAgICAvLyBOb3RlIGFsc28gdGhhdCB0aGUgYXNzaWdubWVudCBjYW4gb2NjdXIgd2l0aGluIGFub3RoZXIgYXNzaWdubWVudC5cbiAgICAvL1xuICAgIGNvbnN0IGJsb2NrID0gZGVjbGFyYXRpb24ucGFyZW50LnBhcmVudC5wYXJlbnQ7XG4gICAgY29uc3Qgc3ltYm9sID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oZGVjbGFyYXRpb24ubmFtZSk7XG4gICAgaWYgKHN5bWJvbCAmJiAodHMuaXNCbG9jayhibG9jaykgfHwgdHMuaXNTb3VyY2VGaWxlKGJsb2NrKSkpIHtcbiAgICAgIGNvbnN0IGRlY29yYXRlQ2FsbCA9IHRoaXMuZmluZERlY29yYXRlZFZhcmlhYmxlVmFsdWUoYmxvY2ssIHN5bWJvbCk7XG4gICAgICBjb25zdCB0YXJnZXQgPSBkZWNvcmF0ZUNhbGwgJiYgZGVjb3JhdGVDYWxsLmFyZ3VtZW50c1sxXTtcbiAgICAgIGlmICh0YXJnZXQgJiYgdHMuaXNJZGVudGlmaWVyKHRhcmdldCkpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0U3ltYm9sID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24odGFyZ2V0KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0RGVjbGFyYXRpb24gPSB0YXJnZXRTeW1ib2wgJiYgdGFyZ2V0U3ltYm9sLnZhbHVlRGVjbGFyYXRpb247XG4gICAgICAgIGlmICh0YXJnZXREZWNsYXJhdGlvbikge1xuICAgICAgICAgIGlmICh0cy5pc0NsYXNzRGVjbGFyYXRpb24odGFyZ2V0RGVjbGFyYXRpb24pIHx8XG4gICAgICAgICAgICAgIHRzLmlzRnVuY3Rpb25EZWNsYXJhdGlvbih0YXJnZXREZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICAgIC8vIFRoZSB0YXJnZXQgaXMganVzdCBhIGZ1bmN0aW9uIG9yIGNsYXNzIGRlY2xhcmF0aW9uXG4gICAgICAgICAgICAvLyBzbyByZXR1cm4gaXRzIGlkZW50aWZpZXIgYXMgdGhlIHZhcmlhYmxlIHZhbHVlLlxuICAgICAgICAgICAgcmV0dXJuIHRhcmdldERlY2xhcmF0aW9uLm5hbWUgfHwgbnVsbDtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbih0YXJnZXREZWNsYXJhdGlvbikpIHtcbiAgICAgICAgICAgIC8vIFRoZSB0YXJnZXQgaXMgYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiwgc28gZmluZCB0aGUgZmFyIHJpZ2h0IGV4cHJlc3Npb24sXG4gICAgICAgICAgICAvLyBpbiB0aGUgY2FzZSBvZiBtdWx0aXBsZSBhc3NpZ25tZW50cyAoZS5nLiBgdmFyMSA9IHZhcjIgPSB2YWx1ZWApLlxuICAgICAgICAgICAgbGV0IHRhcmdldFZhbHVlID0gdGFyZ2V0RGVjbGFyYXRpb24uaW5pdGlhbGl6ZXI7XG4gICAgICAgICAgICB3aGlsZSAodGFyZ2V0VmFsdWUgJiYgaXNBc3NpZ25tZW50KHRhcmdldFZhbHVlKSkge1xuICAgICAgICAgICAgICB0YXJnZXRWYWx1ZSA9IHRhcmdldFZhbHVlLnJpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRhcmdldFZhbHVlKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0YXJnZXRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBhbGwgdG9wLWxldmVsIGNsYXNzIHN5bWJvbHMgaW4gdGhlIGdpdmVuIGZpbGUuXG4gICAqIEBwYXJhbSBzb3VyY2VGaWxlIFRoZSBzb3VyY2UgZmlsZSB0byBzZWFyY2ggZm9yIGNsYXNzZXMuXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIGNsYXNzIHN5bWJvbHMuXG4gICAqL1xuICBmaW5kQ2xhc3NTeW1ib2xzKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBOZ2NjQ2xhc3NTeW1ib2xbXSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IG5ldyBNYXA8dHMuU3ltYm9sLCBOZ2NjQ2xhc3NTeW1ib2w+KCk7XG4gICAgdGhpcy5nZXRNb2R1bGVTdGF0ZW1lbnRzKHNvdXJjZUZpbGUpXG4gICAgICAgIC5mb3JFYWNoKHN0YXRlbWVudCA9PiB0aGlzLmFkZENsYXNzU3ltYm9sc0Zyb21TdGF0ZW1lbnQoY2xhc3Nlcywgc3RhdGVtZW50KSk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oY2xhc3Nlcy52YWx1ZXMoKSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBudW1iZXIgb2YgZ2VuZXJpYyB0eXBlIHBhcmFtZXRlcnMgb2YgYSBnaXZlbiBjbGFzcy5cbiAgICpcbiAgICogQHBhcmFtIGNsYXp6IGEgYENsYXNzRGVjbGFyYXRpb25gIHJlcHJlc2VudGluZyB0aGUgY2xhc3Mgb3ZlciB3aGljaCB0byByZWZsZWN0LlxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgbnVtYmVyIG9mIHR5cGUgcGFyYW1ldGVycyBvZiB0aGUgY2xhc3MsIGlmIGtub3duLCBvciBgbnVsbGAgaWYgdGhlIGRlY2xhcmF0aW9uXG4gICAqIGlzIG5vdCBhIGNsYXNzIG9yIGhhcyBhbiB1bmtub3duIG51bWJlciBvZiB0eXBlIHBhcmFtZXRlcnMuXG4gICAqL1xuICBnZXRHZW5lcmljQXJpdHlPZkNsYXNzKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogbnVtYmVyfG51bGwge1xuICAgIGNvbnN0IGR0c0RlY2xhcmF0aW9uID0gdGhpcy5nZXREdHNEZWNsYXJhdGlvbihjbGF6eik7XG4gICAgaWYgKGR0c0RlY2xhcmF0aW9uICYmIHRzLmlzQ2xhc3NEZWNsYXJhdGlvbihkdHNEZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybiBkdHNEZWNsYXJhdGlvbi50eXBlUGFyYW1ldGVycyA/IGR0c0RlY2xhcmF0aW9uLnR5cGVQYXJhbWV0ZXJzLmxlbmd0aCA6IDA7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFRha2UgYW4gZXhwb3J0ZWQgZGVjbGFyYXRpb24gb2YgYSBjbGFzcyAobWF5YmUgZG93bi1sZXZlbGVkIHRvIGEgdmFyaWFibGUpIGFuZCBsb29rIHVwIHRoZVxuICAgKiBkZWNsYXJhdGlvbiBvZiBpdHMgdHlwZSBpbiBhIHNlcGFyYXRlIC5kLnRzIHRyZWUuXG4gICAqXG4gICAqIFRoaXMgZnVuY3Rpb24gaXMgYWxsb3dlZCB0byByZXR1cm4gYG51bGxgIGlmIHRoZSBjdXJyZW50IGNvbXBpbGF0aW9uIHVuaXQgZG9lcyBub3QgaGF2ZSBhXG4gICAqIHNlcGFyYXRlIC5kLnRzIHRyZWUuIFdoZW4gY29tcGlsaW5nIFR5cGVTY3JpcHQgY29kZSB0aGlzIGlzIGFsd2F5cyB0aGUgY2FzZSwgc2luY2UgLmQudHMgZmlsZXNcbiAgICogYXJlIHByb2R1Y2VkIG9ubHkgZHVyaW5nIHRoZSBlbWl0IG9mIHN1Y2ggYSBjb21waWxhdGlvbi4gV2hlbiBjb21waWxpbmcgLmpzIGNvZGUsIGhvd2V2ZXIsXG4gICAqIHRoZXJlIGlzIGZyZXF1ZW50bHkgYSBwYXJhbGxlbCAuZC50cyB0cmVlIHdoaWNoIHRoaXMgbWV0aG9kIGV4cG9zZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGUgYHRzLkNsYXNzRGVjbGFyYXRpb25gIHJldHVybmVkIGZyb20gdGhpcyBmdW5jdGlvbiBtYXkgbm90IGJlIGZyb20gdGhlIHNhbWVcbiAgICogYHRzLlByb2dyYW1gIGFzIHRoZSBpbnB1dCBkZWNsYXJhdGlvbi5cbiAgICovXG4gIGdldER0c0RlY2xhcmF0aW9uKGRlY2xhcmF0aW9uOiBEZWNsYXJhdGlvbk5vZGUpOiB0cy5EZWNsYXJhdGlvbnxudWxsIHtcbiAgICBpZiAodGhpcy5kdHMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAoIWlzTmFtZWREZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGdldCB0aGUgZHRzIGZpbGUgZm9yIGEgZGVjbGFyYXRpb24gdGhhdCBoYXMgbm8gbmFtZTogJHtcbiAgICAgICAgICBkZWNsYXJhdGlvbi5nZXRUZXh0KCl9IGluICR7ZGVjbGFyYXRpb24uZ2V0U291cmNlRmlsZSgpLmZpbGVOYW1lfWApO1xuICAgIH1cblxuICAgIGNvbnN0IGRlY2wgPSB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGRlY2xhcmF0aW9uLm5hbWUpO1xuICAgIGlmIChkZWNsID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENhbm5vdCBnZXQgdGhlIGR0cyBmaWxlIGZvciBhIG5vZGUgdGhhdCBjYW5ub3QgYmUgYXNzb2NpYXRlZCB3aXRoIGEgZGVjbGFyYXRpb24gJHtcbiAgICAgICAgICAgICAgZGVjbGFyYXRpb24uZ2V0VGV4dCgpfSBpbiAke2RlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZX1gKTtcbiAgICB9XG5cbiAgICAvLyBUcnkgdG8gcmV0cmlldmUgdGhlIGR0cyBkZWNsYXJhdGlvbiBmcm9tIHRoZSBwdWJsaWMgbWFwXG4gICAgaWYgKHRoaXMucHVibGljRHRzRGVjbGFyYXRpb25NYXAgPT09IG51bGwpIHtcbiAgICAgIHRoaXMucHVibGljRHRzRGVjbGFyYXRpb25NYXAgPSB0aGlzLmNvbXB1dGVQdWJsaWNEdHNEZWNsYXJhdGlvbk1hcCh0aGlzLnNyYywgdGhpcy5kdHMpO1xuICAgIH1cbiAgICBpZiAodGhpcy5wdWJsaWNEdHNEZWNsYXJhdGlvbk1hcC5oYXMoZGVjbC5ub2RlKSkge1xuICAgICAgcmV0dXJuIHRoaXMucHVibGljRHRzRGVjbGFyYXRpb25NYXAuZ2V0KGRlY2wubm9kZSkhO1xuICAgIH1cblxuICAgIC8vIE5vIHB1YmxpYyBleHBvcnQsIHRyeSB0aGUgcHJpdmF0ZSBtYXBcbiAgICBpZiAodGhpcy5wcml2YXRlRHRzRGVjbGFyYXRpb25NYXAgPT09IG51bGwpIHtcbiAgICAgIHRoaXMucHJpdmF0ZUR0c0RlY2xhcmF0aW9uTWFwID0gdGhpcy5jb21wdXRlUHJpdmF0ZUR0c0RlY2xhcmF0aW9uTWFwKHRoaXMuc3JjLCB0aGlzLmR0cyk7XG4gICAgfVxuICAgIGlmICh0aGlzLnByaXZhdGVEdHNEZWNsYXJhdGlvbk1hcC5oYXMoZGVjbC5ub2RlKSkge1xuICAgICAgcmV0dXJuIHRoaXMucHJpdmF0ZUR0c0RlY2xhcmF0aW9uTWFwLmdldChkZWNsLm5vZGUpITtcbiAgICB9XG5cbiAgICAvLyBObyBkZWNsYXJhdGlvbiBmb3VuZCBhdCBhbGxcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldEVuZE9mQ2xhc3MoY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IHRzLk5vZGUge1xuICAgIGNvbnN0IGltcGxlbWVudGF0aW9uID0gY2xhc3NTeW1ib2wuaW1wbGVtZW50YXRpb247XG4gICAgbGV0IGxhc3Q6IHRzLk5vZGUgPSBpbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICAgIGNvbnN0IGltcGxlbWVudGF0aW9uU3RhdGVtZW50ID0gZ2V0Q29udGFpbmluZ1N0YXRlbWVudChsYXN0KTtcbiAgICBpZiAoaW1wbGVtZW50YXRpb25TdGF0ZW1lbnQgPT09IG51bGwpIHJldHVybiBsYXN0O1xuXG4gICAgY29uc3QgY29udGFpbmVyID0gaW1wbGVtZW50YXRpb25TdGF0ZW1lbnQucGFyZW50O1xuICAgIGlmICh0cy5pc0Jsb2NrKGNvbnRhaW5lcikpIHtcbiAgICAgIC8vIEFzc3VtZSB0aGF0IHRoZSBpbXBsZW1lbnRhdGlvbiBpcyBpbnNpZGUgYW4gSUlGRVxuICAgICAgY29uc3QgcmV0dXJuU3RhdGVtZW50SW5kZXggPSBjb250YWluZXIuc3RhdGVtZW50cy5maW5kSW5kZXgodHMuaXNSZXR1cm5TdGF0ZW1lbnQpO1xuICAgICAgaWYgKHJldHVyblN0YXRlbWVudEluZGV4ID09PSAtMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQ29tcGlsZWQgY2xhc3Mgd3JhcHBlciBJSUZFIGRvZXMgbm90IGhhdmUgYSByZXR1cm4gc3RhdGVtZW50OiAke2NsYXNzU3ltYm9sLm5hbWV9IGluICR7XG4gICAgICAgICAgICAgICAgY2xhc3NTeW1ib2wuZGVjbGFyYXRpb24udmFsdWVEZWNsYXJhdGlvbi5nZXRTb3VyY2VGaWxlKCkuZmlsZU5hbWV9YCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJldHVybiB0aGUgc3RhdGVtZW50IGJlZm9yZSB0aGUgSUlGRSByZXR1cm4gc3RhdGVtZW50XG4gICAgICBsYXN0ID0gY29udGFpbmVyLnN0YXRlbWVudHNbcmV0dXJuU3RhdGVtZW50SW5kZXggLSAxXTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzU291cmNlRmlsZShjb250YWluZXIpKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgc3RhdGljIG1lbWJlcnMgb24gdGhpcyBjbGFzcyB0aGVuIGZpbmQgdGhlIGxhc3Qgb25lXG4gICAgICBpZiAoaW1wbGVtZW50YXRpb24uZXhwb3J0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uLmV4cG9ydHMuZm9yRWFjaChleHBvcnRTeW1ib2wgPT4ge1xuICAgICAgICAgIGlmIChleHBvcnRTeW1ib2wudmFsdWVEZWNsYXJhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGV4cG9ydFN0YXRlbWVudCA9IGdldENvbnRhaW5pbmdTdGF0ZW1lbnQoZXhwb3J0U3ltYm9sLnZhbHVlRGVjbGFyYXRpb24pO1xuICAgICAgICAgIGlmIChleHBvcnRTdGF0ZW1lbnQgIT09IG51bGwgJiYgbGFzdC5nZXRFbmQoKSA8IGV4cG9ydFN0YXRlbWVudC5nZXRFbmQoKSkge1xuICAgICAgICAgICAgbGFzdCA9IGV4cG9ydFN0YXRlbWVudDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSBhcmUgaGVscGVyIGNhbGxzIGZvciB0aGlzIGNsYXNzIHRoZW4gZmluZCB0aGUgbGFzdCBvbmVcbiAgICAgIGNvbnN0IGhlbHBlcnMgPSB0aGlzLmdldEhlbHBlckNhbGxzRm9yQ2xhc3MoXG4gICAgICAgICAgY2xhc3NTeW1ib2wsIFsnX19kZWNvcmF0ZScsICdfX2V4dGVuZHMnLCAnX19wYXJhbScsICdfX21ldGFkYXRhJ10pO1xuICAgICAgaGVscGVycy5mb3JFYWNoKGhlbHBlciA9PiB7XG4gICAgICAgIGNvbnN0IGhlbHBlclN0YXRlbWVudCA9IGdldENvbnRhaW5pbmdTdGF0ZW1lbnQoaGVscGVyKTtcbiAgICAgICAgaWYgKGhlbHBlclN0YXRlbWVudCAhPT0gbnVsbCAmJiBsYXN0LmdldEVuZCgpIDwgaGVscGVyU3RhdGVtZW50LmdldEVuZCgpKSB7XG4gICAgICAgICAgbGFzdCA9IGhlbHBlclN0YXRlbWVudDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBsYXN0O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHdoZXRoZXIgYSBgRGVjbGFyYXRpb25gIGNvcnJlc3BvbmRzIHdpdGggYSBrbm93biBkZWNsYXJhdGlvbiwgc3VjaCBhcyBgT2JqZWN0YCwgYW5kIHNldFxuICAgKiBpdHMgYGtub3duYCBwcm9wZXJ0eSB0byB0aGUgYXBwcm9wcmlhdGUgYEtub3duRGVjbGFyYXRpb25gLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbCBUaGUgYERlY2xhcmF0aW9uYCB0byBjaGVjay5cbiAgICogQHJldHVybiBUaGUgcGFzc2VkIGluIGBEZWNsYXJhdGlvbmAgKHBvdGVudGlhbGx5IGVuaGFuY2VkIHdpdGggYSBgS25vd25EZWNsYXJhdGlvbmApLlxuICAgKi9cbiAgZGV0ZWN0S25vd25EZWNsYXJhdGlvbjxUIGV4dGVuZHMgRGVjbGFyYXRpb24+KGRlY2w6IFQpOiBUIHtcbiAgICBpZiAoZGVjbC5rbm93biA9PT0gbnVsbCAmJiB0aGlzLmlzSmF2YVNjcmlwdE9iamVjdERlY2xhcmF0aW9uKGRlY2wpKSB7XG4gICAgICAvLyBJZiB0aGUgaWRlbnRpZmllciByZXNvbHZlcyB0byB0aGUgZ2xvYmFsIEphdmFTY3JpcHQgYE9iamVjdGAsIHVwZGF0ZSB0aGUgZGVjbGFyYXRpb24gdG9cbiAgICAgIC8vIGRlbm90ZSBpdCBhcyB0aGUga25vd24gYEpzR2xvYmFsT2JqZWN0YCBkZWNsYXJhdGlvbi5cbiAgICAgIGRlY2wua25vd24gPSBLbm93bkRlY2xhcmF0aW9uLkpzR2xvYmFsT2JqZWN0O1xuICAgIH1cbiAgICByZXR1cm4gZGVjbDtcbiAgfVxuXG5cbiAgLy8vLy8vLy8vLy8vLyBQcm90ZWN0ZWQgSGVscGVycyAvLy8vLy8vLy8vLy8vXG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgYWxsIHRoZSBcImNsYXNzZXNcIiBmcm9tIHRoZSBgc3RhdGVtZW50YCBhbmQgYWRkIHRoZW0gdG8gdGhlIGBjbGFzc2VzYCBtYXAuXG4gICAqL1xuICBwcm90ZWN0ZWQgYWRkQ2xhc3NTeW1ib2xzRnJvbVN0YXRlbWVudChcbiAgICAgIGNsYXNzZXM6IE1hcDx0cy5TeW1ib2wsIE5nY2NDbGFzc1N5bWJvbD4sIHN0YXRlbWVudDogdHMuU3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRzLmlzVmFyaWFibGVTdGF0ZW1lbnQoc3RhdGVtZW50KSkge1xuICAgICAgc3RhdGVtZW50LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMuZm9yRWFjaChkZWNsYXJhdGlvbiA9PiB7XG4gICAgICAgIGNvbnN0IGNsYXNzU3ltYm9sID0gdGhpcy5nZXRDbGFzc1N5bWJvbChkZWNsYXJhdGlvbik7XG4gICAgICAgIGlmIChjbGFzc1N5bWJvbCkge1xuICAgICAgICAgIGNsYXNzZXMuc2V0KGNsYXNzU3ltYm9sLmltcGxlbWVudGF0aW9uLCBjbGFzc1N5bWJvbCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodHMuaXNDbGFzc0RlY2xhcmF0aW9uKHN0YXRlbWVudCkpIHtcbiAgICAgIGNvbnN0IGNsYXNzU3ltYm9sID0gdGhpcy5nZXRDbGFzc1N5bWJvbChzdGF0ZW1lbnQpO1xuICAgICAgaWYgKGNsYXNzU3ltYm9sKSB7XG4gICAgICAgIGNsYXNzZXMuc2V0KGNsYXNzU3ltYm9sLmltcGxlbWVudGF0aW9uLCBjbGFzc1N5bWJvbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENvbXB1dGUgdGhlIGlubmVyIGRlY2xhcmF0aW9uIG5vZGUgb2YgYSBcImNsYXNzXCIgZnJvbSB0aGUgZ2l2ZW4gYGRlY2xhcmF0aW9uYCBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbGFyYXRpb24gYSBub2RlIHRoYXQgaXMgZWl0aGVyIGFuIGlubmVyIGRlY2xhcmF0aW9uIG9yIGFuIGFsaWFzIG9mIGEgY2xhc3MuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0SW5uZXJEZWNsYXJhdGlvbkZyb21BbGlhc09ySW5uZXIoZGVjbGFyYXRpb246IHRzLk5vZGUpOiB0cy5Ob2RlIHtcbiAgICBpZiAoZGVjbGFyYXRpb24ucGFyZW50ICE9PSB1bmRlZmluZWQgJiYgaXNOYW1lZFZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbGFyYXRpb24ucGFyZW50KSkge1xuICAgICAgY29uc3QgdmFyaWFibGVWYWx1ZSA9IHRoaXMuZ2V0VmFyaWFibGVWYWx1ZShkZWNsYXJhdGlvbi5wYXJlbnQpO1xuICAgICAgaWYgKHZhcmlhYmxlVmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgZGVjbGFyYXRpb24gPSB2YXJpYWJsZVZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVjbGFyYXRpb247XG4gIH1cblxuICAvKipcbiAgICogQSBjbGFzcyBtYXkgYmUgZGVjbGFyZWQgYXMgYSB0b3AgbGV2ZWwgY2xhc3MgZGVjbGFyYXRpb246XG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGFzcyBPdXRlckNsYXNzIHsgLi4uIH1cbiAgICogYGBgXG4gICAqXG4gICAqIG9yIGluIGEgdmFyaWFibGUgZGVjbGFyYXRpb24gdG8gYSBjbGFzcyBleHByZXNzaW9uOlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIE91dGVyQ2xhc3MgPSBDbGFzc0FsaWFzID0gY2xhc3MgSW5uZXJDbGFzcyB7fTtcbiAgICogYGBgXG4gICAqXG4gICAqIG9yIGluIGEgdmFyaWFibGUgZGVjbGFyYXRpb24gdG8gYW4gSUlGRSBjb250YWluaW5nIGEgY2xhc3MgZGVjbGFyYXRpb25cbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBPdXRlckNsYXNzID0gQ2xhc3NBbGlhcyA9ICgoKSA9PiB7XG4gICAqICAgY2xhc3MgSW5uZXJDbGFzcyB7fVxuICAgKiAgIC4uLlxuICAgKiAgIHJldHVybiBJbm5lckNsYXNzO1xuICAgKiB9KSgpXG4gICAqIGBgYFxuICAgKlxuICAgKiBvciBpbiBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uIHRvIGFuIElJRkUgY29udGFpbmluZyBhIGZ1bmN0aW9uIGRlY2xhcmF0aW9uXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgT3V0ZXJDbGFzcyA9IENsYXNzQWxpYXMgPSAoKCkgPT4ge1xuICAgKiAgIGZ1bmN0aW9uIElubmVyQ2xhc3MoKSB7fVxuICAgKiAgIC4uLlxuICAgKiAgIHJldHVybiBJbm5lckNsYXNzO1xuICAgKiB9KSgpXG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIGFuIGBOZ2NjQ2xhc3NTeW1ib2xgIHdoZW4gcHJvdmlkZWQgd2l0aCBvbmUgb2YgdGhlc2UgY2FzZXMuXG4gICAqXG4gICAqIEBwYXJhbSBkZWNsYXJhdGlvbiB0aGUgZGVjbGFyYXRpb24gd2hvc2Ugc3ltYm9sIHdlIGFyZSBmaW5kaW5nLlxuICAgKiBAcmV0dXJucyB0aGUgc3ltYm9sIGZvciB0aGUgY2xhc3Mgb3IgYHVuZGVmaW5lZGAgaWYgYGRlY2xhcmF0aW9uYCBkb2VzIG5vdCByZXByZXNlbnQgYW4gb3V0ZXJcbiAgICogICAgIGRlY2xhcmF0aW9uIG9mIGEgY2xhc3MuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0Q2xhc3NTeW1ib2xGcm9tT3V0ZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbjogdHMuTm9kZSk6IE5nY2NDbGFzc1N5bWJvbHx1bmRlZmluZWQge1xuICAgIC8vIFJldHVybiBhIGNsYXNzIHN5bWJvbCB3aXRob3V0IGFuIGlubmVyIGRlY2xhcmF0aW9uIGlmIGl0IGlzIGEgcmVndWxhciBcInRvcCBsZXZlbFwiIGNsYXNzXG4gICAgaWYgKGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKGRlY2xhcmF0aW9uKSAmJiBpc1RvcExldmVsKGRlY2xhcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3NTeW1ib2woZGVjbGFyYXRpb24ubmFtZSwgbnVsbCk7XG4gICAgfVxuXG4gICAgLy8gT3RoZXJ3aXNlLCBhbiBvdXRlciBjbGFzcyBkZWNsYXJhdGlvbiBtdXN0IGJlIGFuIGluaXRpYWxpemVkIHZhcmlhYmxlIGRlY2xhcmF0aW9uOlxuICAgIGlmICghaXNJbml0aWFsaXplZFZhcmlhYmxlQ2xhc3NEZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgaW5uZXJEZWNsYXJhdGlvbiA9IGdldElubmVyQ2xhc3NEZWNsYXJhdGlvbihza2lwQ2xhc3NBbGlhc2VzKGRlY2xhcmF0aW9uKSk7XG4gICAgaWYgKGlubmVyRGVjbGFyYXRpb24gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3NTeW1ib2woZGVjbGFyYXRpb24ubmFtZSwgaW5uZXJEZWNsYXJhdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogSW4gRVMyMDE1LCBhIGNsYXNzIG1heSBiZSBkZWNsYXJlZCB1c2luZyBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uIG9mIHRoZSBmb2xsb3dpbmcgc3RydWN0dXJlczpcbiAgICpcbiAgICogYGBgXG4gICAqIGxldCBNeUNsYXNzID0gTXlDbGFzc18xID0gY2xhc3MgTXlDbGFzcyB7fTtcbiAgICogYGBgXG4gICAqXG4gICAqIG9yXG4gICAqXG4gICAqIGBgYFxuICAgKiBsZXQgTXlDbGFzcyA9IE15Q2xhc3NfMSA9ICgoKSA9PiB7IGNsYXNzIE15Q2xhc3Mge30gLi4uIHJldHVybiBNeUNsYXNzOyB9KSgpXG4gICAqIGBgYFxuICAgKlxuICAgKiBvclxuICAgKlxuICAgKiBgYGBcbiAgICogbGV0IE15Q2xhc3MgPSBNeUNsYXNzXzEgPSAoKCkgPT4geyBsZXQgTXlDbGFzcyA9IGNsYXNzIE15Q2xhc3Mge307IC4uLiByZXR1cm4gTXlDbGFzczsgfSkoKVxuICAgKiBgYGBcbiAgICpcbiAgICogVGhpcyBtZXRob2QgZXh0cmFjdHMgdGhlIGBOZ2NjQ2xhc3NTeW1ib2xgIGZvciBgTXlDbGFzc2Agd2hlbiBwcm92aWRlZCB3aXRoIHRoZVxuICAgKiBgY2xhc3MgTXlDbGFzcyB7fWAgZGVjbGFyYXRpb24gbm9kZS4gV2hlbiB0aGUgYHZhciBNeUNsYXNzYCBub2RlIG9yIGFueSBvdGhlciBub2RlIGlzIGdpdmVuLFxuICAgKiB0aGlzIG1ldGhvZCB3aWxsIHJldHVybiB1bmRlZmluZWQgaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIGRlY2xhcmF0aW9uIHRoZSBkZWNsYXJhdGlvbiB3aG9zZSBzeW1ib2wgd2UgYXJlIGZpbmRpbmcuXG4gICAqIEByZXR1cm5zIHRoZSBzeW1ib2wgZm9yIHRoZSBub2RlIG9yIGB1bmRlZmluZWRgIGlmIGl0IGRvZXMgbm90IHJlcHJlc2VudCBhbiBpbm5lciBkZWNsYXJhdGlvblxuICAgKiBvZiBhIGNsYXNzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldENsYXNzU3ltYm9sRnJvbUlubmVyRGVjbGFyYXRpb24oZGVjbGFyYXRpb246IHRzLk5vZGUpOiBOZ2NjQ2xhc3NTeW1ib2x8dW5kZWZpbmVkIHtcbiAgICBsZXQgb3V0ZXJEZWNsYXJhdGlvbjogdHMuQ2xhc3NEZWNsYXJhdGlvbnx0cy5WYXJpYWJsZURlY2xhcmF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAgIGlmICh0cy5pc0NsYXNzRXhwcmVzc2lvbihkZWNsYXJhdGlvbikgJiYgaGFzTmFtZUlkZW50aWZpZXIoZGVjbGFyYXRpb24pKSB7XG4gICAgICAvLyBIYW5kbGUgYGxldCBNeUNsYXNzID0gTXlDbGFzc18xID0gY2xhc3MgTXlDbGFzcyB7fTtgXG4gICAgICBvdXRlckRlY2xhcmF0aW9uID0gZ2V0RmFyTGVmdEhhbmRTaWRlT2ZBc3NpZ25tZW50KGRlY2xhcmF0aW9uKTtcblxuICAgICAgLy8gSGFuZGxlIHRoaXMgYmVpbmcgaW4gYW4gSUlGRVxuICAgICAgaWYgKG91dGVyRGVjbGFyYXRpb24gIT09IHVuZGVmaW5lZCAmJiAhaXNUb3BMZXZlbChvdXRlckRlY2xhcmF0aW9uKSkge1xuICAgICAgICBvdXRlckRlY2xhcmF0aW9uID0gZ2V0Q29udGFpbmluZ1ZhcmlhYmxlRGVjbGFyYXRpb24ob3V0ZXJEZWNsYXJhdGlvbik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICAgIC8vIEhhbmRsZSBgY2xhc3MgTXlDbGFzcyB7fWAgc3RhdGVtZW50XG4gICAgICBpZiAoaXNUb3BMZXZlbChkZWNsYXJhdGlvbikpIHtcbiAgICAgICAgLy8gQXQgdGhlIHRvcCBsZXZlbFxuICAgICAgICBvdXRlckRlY2xhcmF0aW9uID0gZGVjbGFyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBPciBpbnNpZGUgYW4gSUlGRVxuICAgICAgICBvdXRlckRlY2xhcmF0aW9uID0gZ2V0Q29udGFpbmluZ1ZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvdXRlckRlY2xhcmF0aW9uID09PSB1bmRlZmluZWQgfHwgIWhhc05hbWVJZGVudGlmaWVyKG91dGVyRGVjbGFyYXRpb24pKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzU3ltYm9sKG91dGVyRGVjbGFyYXRpb24ubmFtZSwgZGVjbGFyYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYE5nY2NDbGFzc1N5bWJvbGAgZnJvbSBhbiBvdXRlciBhbmQgaW5uZXIgZGVjbGFyYXRpb24uIElmIGEgY2xhc3Mgb25seSBoYXMgYW4gb3V0ZXJcbiAgICogZGVjbGFyYXRpb24sIHRoZSBcImltcGxlbWVudGF0aW9uXCIgc3ltYm9sIG9mIHRoZSBjcmVhdGVkIGBOZ2NjQ2xhc3NTeW1ib2xgIHdpbGwgYmUgc2V0IGVxdWFsIHRvXG4gICAqIHRoZSBcImRlY2xhcmF0aW9uXCIgc3ltYm9sLlxuICAgKlxuICAgKiBAcGFyYW0gb3V0ZXJEZWNsYXJhdGlvbiBUaGUgb3V0ZXIgZGVjbGFyYXRpb24gbm9kZSBvZiB0aGUgY2xhc3MuXG4gICAqIEBwYXJhbSBpbm5lckRlY2xhcmF0aW9uIFRoZSBpbm5lciBkZWNsYXJhdGlvbiBub2RlIG9mIHRoZSBjbGFzcywgb3IgdW5kZWZpbmVkIGlmIG5vIGlubmVyXG4gICAqIGRlY2xhcmF0aW9uIGlzIHByZXNlbnQuXG4gICAqIEByZXR1cm5zIHRoZSBgTmdjY0NsYXNzU3ltYm9sYCByZXByZXNlbnRpbmcgdGhlIGNsYXNzLCBvciB1bmRlZmluZWQgaWYgYSBgdHMuU3ltYm9sYCBmb3IgYW55IG9mXG4gICAqIHRoZSBkZWNsYXJhdGlvbnMgY291bGQgbm90IGJlIHJlc29sdmVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUNsYXNzU3ltYm9sKG91dGVyRGVjbGFyYXRpb246IHRzLklkZW50aWZpZXIsIGlubmVyRGVjbGFyYXRpb246IHRzLk5vZGV8bnVsbCk6XG4gICAgICBOZ2NjQ2xhc3NTeW1ib2x8dW5kZWZpbmVkIHtcbiAgICBjb25zdCBkZWNsYXJhdGlvblN5bWJvbCA9XG4gICAgICAgIHRoaXMuY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKG91dGVyRGVjbGFyYXRpb24pIGFzIENsYXNzU3ltYm9sIHwgdW5kZWZpbmVkO1xuICAgIGlmIChkZWNsYXJhdGlvblN5bWJvbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCBpbXBsZW1lbnRhdGlvblN5bWJvbDogdHMuU3ltYm9sfHVuZGVmaW5lZCA9IGRlY2xhcmF0aW9uU3ltYm9sO1xuICAgIGlmIChpbm5lckRlY2xhcmF0aW9uICE9PSBudWxsICYmIGlzTmFtZWREZWNsYXJhdGlvbihpbm5lckRlY2xhcmF0aW9uKSkge1xuICAgICAgaW1wbGVtZW50YXRpb25TeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihpbm5lckRlY2xhcmF0aW9uLm5hbWUpO1xuICAgIH1cblxuICAgIGlmICghaXNTeW1ib2xXaXRoVmFsdWVEZWNsYXJhdGlvbihpbXBsZW1lbnRhdGlvblN5bWJvbCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCA9IHtcbiAgICAgIG5hbWU6IGRlY2xhcmF0aW9uU3ltYm9sLm5hbWUsXG4gICAgICBkZWNsYXJhdGlvbjogZGVjbGFyYXRpb25TeW1ib2wsXG4gICAgICBpbXBsZW1lbnRhdGlvbjogaW1wbGVtZW50YXRpb25TeW1ib2wsXG4gICAgICBhZGphY2VudDogdGhpcy5nZXRBZGphY2VudFN5bWJvbChkZWNsYXJhdGlvblN5bWJvbCwgaW1wbGVtZW50YXRpb25TeW1ib2wpLFxuICAgIH07XG5cbiAgICByZXR1cm4gY2xhc3NTeW1ib2w7XG4gIH1cblxuICBwcml2YXRlIGdldEFkamFjZW50U3ltYm9sKFxuICAgICAgZGVjbGFyYXRpb25TeW1ib2w6IENsYXNzU3ltYm9sLFxuICAgICAgaW1wbGVtZW50YXRpb25TeW1ib2w6IFN5bWJvbFdpdGhWYWx1ZURlY2xhcmF0aW9uKTogU3ltYm9sV2l0aFZhbHVlRGVjbGFyYXRpb258dW5kZWZpbmVkIHtcbiAgICBpZiAoZGVjbGFyYXRpb25TeW1ib2wgPT09IGltcGxlbWVudGF0aW9uU3ltYm9sKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBpbm5lckRlY2xhcmF0aW9uID0gaW1wbGVtZW50YXRpb25TeW1ib2wudmFsdWVEZWNsYXJhdGlvbjtcbiAgICBpZiAoIXRzLmlzQ2xhc3NFeHByZXNzaW9uKGlubmVyRGVjbGFyYXRpb24pICYmICF0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihpbm5lckRlY2xhcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgLy8gRGVhbCB3aXRoIHRoZSBpbm5lciBjbGFzcyBsb29raW5nIGxpa2UgdGhpcyBpbnNpZGUgYW4gSUlGRTpcbiAgICAvLyBgbGV0IE15Q2xhc3MgPSBjbGFzcyBNeUNsYXNzIHt9O2Agb3IgYHZhciBNeUNsYXNzID0gZnVuY3Rpb24gTXlDbGFzcygpIHt9O2BcbiAgICBjb25zdCBhZGphY2VudERlY2xhcmF0aW9uID0gZ2V0RmFyTGVmdEhhbmRTaWRlT2ZBc3NpZ25tZW50KGlubmVyRGVjbGFyYXRpb24pO1xuICAgIGlmIChhZGphY2VudERlY2xhcmF0aW9uID09PSB1bmRlZmluZWQgfHwgIWlzTmFtZWRWYXJpYWJsZURlY2xhcmF0aW9uKGFkamFjZW50RGVjbGFyYXRpb24pKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBhZGphY2VudFN5bWJvbCA9IHRoaXMuY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKGFkamFjZW50RGVjbGFyYXRpb24ubmFtZSk7XG4gICAgaWYgKGFkamFjZW50U3ltYm9sID09PSBkZWNsYXJhdGlvblN5bWJvbCB8fCBhZGphY2VudFN5bWJvbCA9PT0gaW1wbGVtZW50YXRpb25TeW1ib2wgfHxcbiAgICAgICAgIWlzU3ltYm9sV2l0aFZhbHVlRGVjbGFyYXRpb24oYWRqYWNlbnRTeW1ib2wpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gYWRqYWNlbnRTeW1ib2w7XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZSBhIGB0cy5TeW1ib2xgIHRvIGl0cyBkZWNsYXJhdGlvbiBhbmQgZGV0ZWN0IHdoZXRoZXIgaXQgY29ycmVzcG9uZHMgd2l0aCBhIGtub3duXG4gICAqIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldERlY2xhcmF0aW9uT2ZTeW1ib2woc3ltYm9sOiB0cy5TeW1ib2wsIG9yaWdpbmFsSWQ6IHRzLklkZW50aWZpZXJ8bnVsbCk6IERlY2xhcmF0aW9uXG4gICAgICB8bnVsbCB7XG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSBzdXBlci5nZXREZWNsYXJhdGlvbk9mU3ltYm9sKHN5bWJvbCwgb3JpZ2luYWxJZCk7XG4gICAgaWYgKGRlY2xhcmF0aW9uID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZGV0ZWN0S25vd25EZWNsYXJhdGlvbihkZWNsYXJhdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogRmluZHMgdGhlIGlkZW50aWZpZXIgb2YgdGhlIGFjdHVhbCBjbGFzcyBkZWNsYXJhdGlvbiBmb3IgYSBwb3RlbnRpYWxseSBhbGlhc2VkIGRlY2xhcmF0aW9uIG9mIGFcbiAgICogY2xhc3MuXG4gICAqXG4gICAqIElmIHRoZSBnaXZlbiBkZWNsYXJhdGlvbiBpcyBmb3IgYW4gYWxpYXMgb2YgYSBjbGFzcywgdGhpcyBmdW5jdGlvbiB3aWxsIGRldGVybWluZSBhbiBpZGVudGlmaWVyXG4gICAqIHRvIHRoZSBvcmlnaW5hbCBkZWNsYXJhdGlvbiB0aGF0IHJlcHJlc2VudHMgdGhpcyBjbGFzcy5cbiAgICpcbiAgICogQHBhcmFtIGRlY2xhcmF0aW9uIFRoZSBkZWNsYXJhdGlvbiB0byByZXNvbHZlLlxuICAgKiBAcmV0dXJucyBUaGUgb3JpZ2luYWwgaWRlbnRpZmllciB0aGF0IHRoZSBnaXZlbiBjbGFzcyBkZWNsYXJhdGlvbiByZXNvbHZlcyB0bywgb3IgYHVuZGVmaW5lZGBcbiAgICogaWYgdGhlIGRlY2xhcmF0aW9uIGRvZXMgbm90IHJlcHJlc2VudCBhbiBhbGlhc2VkIGNsYXNzLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlc29sdmVBbGlhc2VkQ2xhc3NJZGVudGlmaWVyKGRlY2xhcmF0aW9uOiBEZWNsYXJhdGlvbk5vZGUpOiB0cy5JZGVudGlmaWVyfG51bGwge1xuICAgIHRoaXMuZW5zdXJlUHJlcHJvY2Vzc2VkKGRlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgcmV0dXJuIHRoaXMuYWxpYXNlZENsYXNzRGVjbGFyYXRpb25zLmhhcyhkZWNsYXJhdGlvbikgP1xuICAgICAgICB0aGlzLmFsaWFzZWRDbGFzc0RlY2xhcmF0aW9ucy5nZXQoZGVjbGFyYXRpb24pISA6XG4gICAgICAgIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogRW5zdXJlcyB0aGF0IHRoZSBzb3VyY2UgZmlsZSB0aGF0IGBub2RlYCBpcyBwYXJ0IG9mIGhhcyBiZWVuIHByZXByb2Nlc3NlZC5cbiAgICpcbiAgICogRHVyaW5nIHByZXByb2Nlc3NpbmcsIGFsbCBzdGF0ZW1lbnRzIGluIHRoZSBzb3VyY2UgZmlsZSB3aWxsIGJlIHZpc2l0ZWQgc3VjaCB0aGF0IGNlcnRhaW5cbiAgICogcHJvY2Vzc2luZyBzdGVwcyBjYW4gYmUgZG9uZSB1cC1mcm9udCBhbmQgY2FjaGVkIGZvciBzdWJzZXF1ZW50IHVzYWdlcy5cbiAgICpcbiAgICogQHBhcmFtIHNvdXJjZUZpbGUgVGhlIHNvdXJjZSBmaWxlIHRoYXQgbmVlZHMgdG8gaGF2ZSBnb25lIHRocm91Z2ggcHJlcHJvY2Vzc2luZy5cbiAgICovXG4gIHByb3RlY3RlZCBlbnN1cmVQcmVwcm9jZXNzZWQoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IHZvaWQge1xuICAgIGlmICghdGhpcy5wcmVwcm9jZXNzZWRTb3VyY2VGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgIHRoaXMucHJlcHJvY2Vzc2VkU291cmNlRmlsZXMuYWRkKHNvdXJjZUZpbGUpO1xuXG4gICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudCBvZiB0aGlzLmdldE1vZHVsZVN0YXRlbWVudHMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgdGhpcy5wcmVwcm9jZXNzU3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFuYWx5emVzIHRoZSBnaXZlbiBzdGF0ZW1lbnQgdG8gc2VlIGlmIGl0IGNvcnJlc3BvbmRzIHdpdGggYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBsaWtlXG4gICAqIGBsZXQgTXlDbGFzcyA9IE15Q2xhc3NfMSA9IGNsYXNzIE15Q2xhc3Mge307YC4gSWYgc28sIHRoZSBkZWNsYXJhdGlvbiBvZiBgTXlDbGFzc18xYFxuICAgKiBpcyBhc3NvY2lhdGVkIHdpdGggdGhlIGBNeUNsYXNzYCBpZGVudGlmaWVyLlxuICAgKlxuICAgKiBAcGFyYW0gc3RhdGVtZW50IFRoZSBzdGF0ZW1lbnQgdGhhdCBuZWVkcyB0byBiZSBwcmVwcm9jZXNzZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgcHJlcHJvY2Vzc1N0YXRlbWVudChzdGF0ZW1lbnQ6IHRzLlN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICghdHMuaXNWYXJpYWJsZVN0YXRlbWVudChzdGF0ZW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZGVjbGFyYXRpb25zID0gc3RhdGVtZW50LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnM7XG4gICAgaWYgKGRlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IGRlY2xhcmF0aW9uc1swXTtcbiAgICBjb25zdCBpbml0aWFsaXplciA9IGRlY2xhcmF0aW9uLmluaXRpYWxpemVyO1xuICAgIGlmICghdHMuaXNJZGVudGlmaWVyKGRlY2xhcmF0aW9uLm5hbWUpIHx8ICFpbml0aWFsaXplciB8fCAhaXNBc3NpZ25tZW50KGluaXRpYWxpemVyKSB8fFxuICAgICAgICAhdHMuaXNJZGVudGlmaWVyKGluaXRpYWxpemVyLmxlZnQpIHx8ICF0aGlzLmlzQ2xhc3MoZGVjbGFyYXRpb24pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWxpYXNlZElkZW50aWZpZXIgPSBpbml0aWFsaXplci5sZWZ0O1xuXG4gICAgY29uc3QgYWxpYXNlZERlY2xhcmF0aW9uID0gdGhpcy5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihhbGlhc2VkSWRlbnRpZmllcik7XG4gICAgaWYgKGFsaWFzZWREZWNsYXJhdGlvbiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBVbmFibGUgdG8gbG9jYXRlIGRlY2xhcmF0aW9uIG9mICR7YWxpYXNlZElkZW50aWZpZXIudGV4dH0gaW4gXCIke3N0YXRlbWVudC5nZXRUZXh0KCl9XCJgKTtcbiAgICB9XG4gICAgdGhpcy5hbGlhc2VkQ2xhc3NEZWNsYXJhdGlvbnMuc2V0KGFsaWFzZWREZWNsYXJhdGlvbi5ub2RlLCBkZWNsYXJhdGlvbi5uYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHRvcCBsZXZlbCBzdGF0ZW1lbnRzIGZvciBhIG1vZHVsZS5cbiAgICpcbiAgICogSW4gRVM1IGFuZCBFUzIwMTUgdGhpcyBpcyBqdXN0IHRoZSB0b3AgbGV2ZWwgc3RhdGVtZW50cyBvZiB0aGUgZmlsZS5cbiAgICogQHBhcmFtIHNvdXJjZUZpbGUgVGhlIG1vZHVsZSB3aG9zZSBzdGF0ZW1lbnRzIHdlIHdhbnQuXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHRvcCBsZXZlbCBzdGF0ZW1lbnRzIGZvciB0aGUgZ2l2ZW4gbW9kdWxlLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldE1vZHVsZVN0YXRlbWVudHMoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlN0YXRlbWVudFtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShzb3VyY2VGaWxlLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFdhbGsgdGhlIEFTVCBsb29raW5nIGZvciBhbiBhc3NpZ25tZW50IHRvIHRoZSBzcGVjaWZpZWQgc3ltYm9sLlxuICAgKiBAcGFyYW0gbm9kZSBUaGUgY3VycmVudCBub2RlIHdlIGFyZSBzZWFyY2hpbmcuXG4gICAqIEByZXR1cm5zIGFuIGV4cHJlc3Npb24gdGhhdCByZXByZXNlbnRzIHRoZSB2YWx1ZSBvZiB0aGUgdmFyaWFibGUsIG9yIHVuZGVmaW5lZCBpZiBub25lIGNhbiBiZVxuICAgKiBmb3VuZC5cbiAgICovXG4gIHByb3RlY3RlZCBmaW5kRGVjb3JhdGVkVmFyaWFibGVWYWx1ZShub2RlOiB0cy5Ob2RlfHVuZGVmaW5lZCwgc3ltYm9sOiB0cy5TeW1ib2wpOlxuICAgICAgdHMuQ2FsbEV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKCFub2RlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRzLmlzQmluYXJ5RXhwcmVzc2lvbihub2RlKSAmJiBub2RlLm9wZXJhdG9yVG9rZW4ua2luZCA9PT0gdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbikge1xuICAgICAgY29uc3QgbGVmdCA9IG5vZGUubGVmdDtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gbm9kZS5yaWdodDtcbiAgICAgIGlmICh0cy5pc0lkZW50aWZpZXIobGVmdCkgJiYgdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obGVmdCkgPT09IHN5bWJvbCkge1xuICAgICAgICByZXR1cm4gKHRzLmlzQ2FsbEV4cHJlc3Npb24ocmlnaHQpICYmIGdldENhbGxlZU5hbWUocmlnaHQpID09PSAnX19kZWNvcmF0ZScpID8gcmlnaHQgOiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZmluZERlY29yYXRlZFZhcmlhYmxlVmFsdWUocmlnaHQsIHN5bWJvbCk7XG4gICAgfVxuICAgIHJldHVybiBub2RlLmZvckVhY2hDaGlsZChub2RlID0+IHRoaXMuZmluZERlY29yYXRlZFZhcmlhYmxlVmFsdWUobm9kZSwgc3ltYm9sKSkgfHwgbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcnkgdG8gcmV0cmlldmUgdGhlIHN5bWJvbCBvZiBhIHN0YXRpYyBwcm9wZXJ0eSBvbiBhIGNsYXNzLlxuICAgKlxuICAgKiBJbiBzb21lIGNhc2VzLCBhIHN0YXRpYyBwcm9wZXJ0eSBjYW4gZWl0aGVyIGJlIHNldCBvbiB0aGUgaW5uZXIgKGltcGxlbWVudGF0aW9uIG9yIGFkamFjZW50KVxuICAgKiBkZWNsYXJhdGlvbiBpbnNpZGUgdGhlIGNsYXNzJyBJSUZFLCBvciBpdCBjYW4gYmUgc2V0IG9uIHRoZSBvdXRlciB2YXJpYWJsZSBkZWNsYXJhdGlvbi5cbiAgICogVGhlcmVmb3JlLCB0aGUgaG9zdCBjaGVja3MgYWxsIHBsYWNlcywgZmlyc3QgbG9va2luZyB1cCB0aGUgcHJvcGVydHkgb24gdGhlIGlubmVyIHN5bWJvbHMsIGFuZFxuICAgKiBpZiB0aGUgcHJvcGVydHkgaXMgbm90IGZvdW5kIGl0IHdpbGwgZmFsbCBiYWNrIHRvIGxvb2tpbmcgdXAgdGhlIHByb3BlcnR5IG9uIHRoZSBvdXRlciBzeW1ib2wuXG4gICAqXG4gICAqIEBwYXJhbSBzeW1ib2wgdGhlIGNsYXNzIHdob3NlIHByb3BlcnR5IHdlIGFyZSBpbnRlcmVzdGVkIGluLlxuICAgKiBAcGFyYW0gcHJvcGVydHlOYW1lIHRoZSBuYW1lIG9mIHN0YXRpYyBwcm9wZXJ0eS5cbiAgICogQHJldHVybnMgdGhlIHN5bWJvbCBpZiBpdCBpcyBmb3VuZCBvciBgdW5kZWZpbmVkYCBpZiBub3QuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0U3RhdGljUHJvcGVydHkoc3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2wsIHByb3BlcnR5TmFtZTogdHMuX19TdHJpbmcpOiB0cy5TeW1ib2xcbiAgICAgIHx1bmRlZmluZWQge1xuICAgIHJldHVybiBzeW1ib2wuaW1wbGVtZW50YXRpb24uZXhwb3J0cz8uZ2V0KHByb3BlcnR5TmFtZSkgfHxcbiAgICAgICAgc3ltYm9sLmFkamFjZW50Py5leHBvcnRzPy5nZXQocHJvcGVydHlOYW1lKSB8fFxuICAgICAgICBzeW1ib2wuZGVjbGFyYXRpb24uZXhwb3J0cz8uZ2V0KHByb3BlcnR5TmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBpcyB0aGUgbWFpbiBlbnRyeS1wb2ludCBmb3Igb2J0YWluaW5nIGluZm9ybWF0aW9uIG9uIHRoZSBkZWNvcmF0b3JzIG9mIGEgZ2l2ZW4gY2xhc3MuIFRoaXNcbiAgICogaW5mb3JtYXRpb24gaXMgY29tcHV0ZWQgZWl0aGVyIGZyb20gc3RhdGljIHByb3BlcnRpZXMgaWYgcHJlc2VudCwgb3IgdXNpbmcgYHRzbGliLl9fZGVjb3JhdGVgXG4gICAqIGhlbHBlciBjYWxscyBvdGhlcndpc2UuIFRoZSBjb21wdXRlZCByZXN1bHQgaXMgY2FjaGVkIHBlciBjbGFzcy5cbiAgICpcbiAgICogQHBhcmFtIGNsYXNzU3ltYm9sIHRoZSBjbGFzcyBmb3Igd2hpY2ggZGVjb3JhdG9ycyBzaG91bGQgYmUgYWNxdWlyZWQuXG4gICAqIEByZXR1cm5zIGFsbCBpbmZvcm1hdGlvbiBvZiB0aGUgZGVjb3JhdG9ycyBvbiB0aGUgY2xhc3MuXG4gICAqL1xuICBwcm90ZWN0ZWQgYWNxdWlyZURlY29yYXRvckluZm8oY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IERlY29yYXRvckluZm8ge1xuICAgIGNvbnN0IGRlY2wgPSBjbGFzc1N5bWJvbC5kZWNsYXJhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICAgIGlmICh0aGlzLmRlY29yYXRvckNhY2hlLmhhcyhkZWNsKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZGVjb3JhdG9yQ2FjaGUuZ2V0KGRlY2wpITtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IGRlY29yYXRvcnMgZnJvbSBzdGF0aWMgcHJvcGVydGllcyBhbmQgYF9fZGVjb3JhdGVgIGhlbHBlciBjYWxscywgdGhlbiBtZXJnZSB0aGVtXG4gICAgLy8gdG9nZXRoZXIgd2hlcmUgdGhlIGluZm9ybWF0aW9uIGZyb20gdGhlIHN0YXRpYyBwcm9wZXJ0aWVzIGlzIHByZWZlcnJlZC5cbiAgICBjb25zdCBzdGF0aWNQcm9wcyA9IHRoaXMuY29tcHV0ZURlY29yYXRvckluZm9Gcm9tU3RhdGljUHJvcGVydGllcyhjbGFzc1N5bWJvbCk7XG4gICAgY29uc3QgaGVscGVyQ2FsbHMgPSB0aGlzLmNvbXB1dGVEZWNvcmF0b3JJbmZvRnJvbUhlbHBlckNhbGxzKGNsYXNzU3ltYm9sKTtcblxuICAgIGNvbnN0IGRlY29yYXRvckluZm86IERlY29yYXRvckluZm8gPSB7XG4gICAgICBjbGFzc0RlY29yYXRvcnM6IHN0YXRpY1Byb3BzLmNsYXNzRGVjb3JhdG9ycyB8fCBoZWxwZXJDYWxscy5jbGFzc0RlY29yYXRvcnMsXG4gICAgICBtZW1iZXJEZWNvcmF0b3JzOiBzdGF0aWNQcm9wcy5tZW1iZXJEZWNvcmF0b3JzIHx8IGhlbHBlckNhbGxzLm1lbWJlckRlY29yYXRvcnMsXG4gICAgICBjb25zdHJ1Y3RvclBhcmFtSW5mbzogc3RhdGljUHJvcHMuY29uc3RydWN0b3JQYXJhbUluZm8gfHwgaGVscGVyQ2FsbHMuY29uc3RydWN0b3JQYXJhbUluZm8sXG4gICAgfTtcblxuICAgIHRoaXMuZGVjb3JhdG9yQ2FjaGUuc2V0KGRlY2wsIGRlY29yYXRvckluZm8pO1xuICAgIHJldHVybiBkZWNvcmF0b3JJbmZvO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGNvbXB1dGUgZGVjb3JhdG9yIGluZm9ybWF0aW9uIGZyb20gc3RhdGljIHByb3BlcnRpZXMgXCJkZWNvcmF0b3JzXCIsIFwicHJvcERlY29yYXRvcnNcIlxuICAgKiBhbmQgXCJjdG9yUGFyYW1ldGVyc1wiIG9uIHRoZSBjbGFzcy4gSWYgbmVpdGhlciBvZiB0aGVzZSBzdGF0aWMgcHJvcGVydGllcyBpcyBwcmVzZW50IHRoZVxuICAgKiBsaWJyYXJ5IGlzIGxpa2VseSBub3QgY29tcGlsZWQgdXNpbmcgdHNpY2tsZSBmb3IgdXNhZ2Ugd2l0aCBDbG9zdXJlIGNvbXBpbGVyLCBpbiB3aGljaCBjYXNlXG4gICAqIGBudWxsYCBpcyByZXR1cm5lZC5cbiAgICpcbiAgICogQHBhcmFtIGNsYXNzU3ltYm9sIFRoZSBjbGFzcyBzeW1ib2wgdG8gY29tcHV0ZSB0aGUgZGVjb3JhdG9ycyBpbmZvcm1hdGlvbiBmb3IuXG4gICAqIEByZXR1cm5zIEFsbCBpbmZvcm1hdGlvbiBvbiB0aGUgZGVjb3JhdG9ycyBhcyBleHRyYWN0ZWQgZnJvbSBzdGF0aWMgcHJvcGVydGllcywgb3IgYG51bGxgIGlmXG4gICAqIG5vbmUgb2YgdGhlIHN0YXRpYyBwcm9wZXJ0aWVzIGV4aXN0LlxuICAgKi9cbiAgcHJvdGVjdGVkIGNvbXB1dGVEZWNvcmF0b3JJbmZvRnJvbVN0YXRpY1Byb3BlcnRpZXMoY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IHtcbiAgICBjbGFzc0RlY29yYXRvcnM6IERlY29yYXRvcltdfG51bGw7IG1lbWJlckRlY29yYXRvcnM6IE1hcDxzdHJpbmcsIERlY29yYXRvcltdPnwgbnVsbDtcbiAgICBjb25zdHJ1Y3RvclBhcmFtSW5mbzogUGFyYW1JbmZvW10gfCBudWxsO1xuICB9IHtcbiAgICBsZXQgY2xhc3NEZWNvcmF0b3JzOiBEZWNvcmF0b3JbXXxudWxsID0gbnVsbDtcbiAgICBsZXQgbWVtYmVyRGVjb3JhdG9yczogTWFwPHN0cmluZywgRGVjb3JhdG9yW10+fG51bGwgPSBudWxsO1xuICAgIGxldCBjb25zdHJ1Y3RvclBhcmFtSW5mbzogUGFyYW1JbmZvW118bnVsbCA9IG51bGw7XG5cbiAgICBjb25zdCBkZWNvcmF0b3JzUHJvcGVydHkgPSB0aGlzLmdldFN0YXRpY1Byb3BlcnR5KGNsYXNzU3ltYm9sLCBERUNPUkFUT1JTKTtcbiAgICBpZiAoZGVjb3JhdG9yc1Byb3BlcnR5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNsYXNzRGVjb3JhdG9ycyA9IHRoaXMuZ2V0Q2xhc3NEZWNvcmF0b3JzRnJvbVN0YXRpY1Byb3BlcnR5KGRlY29yYXRvcnNQcm9wZXJ0eSk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvcERlY29yYXRvcnNQcm9wZXJ0eSA9IHRoaXMuZ2V0U3RhdGljUHJvcGVydHkoY2xhc3NTeW1ib2wsIFBST1BfREVDT1JBVE9SUyk7XG4gICAgaWYgKHByb3BEZWNvcmF0b3JzUHJvcGVydHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWVtYmVyRGVjb3JhdG9ycyA9IHRoaXMuZ2V0TWVtYmVyRGVjb3JhdG9yc0Zyb21TdGF0aWNQcm9wZXJ0eShwcm9wRGVjb3JhdG9yc1Byb3BlcnR5KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25zdHJ1Y3RvclBhcmFtc1Byb3BlcnR5ID0gdGhpcy5nZXRTdGF0aWNQcm9wZXJ0eShjbGFzc1N5bWJvbCwgQ09OU1RSVUNUT1JfUEFSQU1TKTtcbiAgICBpZiAoY29uc3RydWN0b3JQYXJhbXNQcm9wZXJ0eSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdHJ1Y3RvclBhcmFtSW5mbyA9IHRoaXMuZ2V0UGFyYW1JbmZvRnJvbVN0YXRpY1Byb3BlcnR5KGNvbnN0cnVjdG9yUGFyYW1zUHJvcGVydHkpO1xuICAgIH1cblxuICAgIHJldHVybiB7Y2xhc3NEZWNvcmF0b3JzLCBtZW1iZXJEZWNvcmF0b3JzLCBjb25zdHJ1Y3RvclBhcmFtSW5mb307XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBjbGFzcyBkZWNvcmF0b3JzIGZvciB0aGUgZ2l2ZW4gY2xhc3MsIHdoZXJlIHRoZSBkZWNvcmF0b3JzIGFyZSBkZWNsYXJlZFxuICAgKiB2aWEgYSBzdGF0aWMgcHJvcGVydHkuIEZvciBleGFtcGxlOlxuICAgKlxuICAgKiBgYGBcbiAgICogY2xhc3MgU29tZURpcmVjdGl2ZSB7fVxuICAgKiBTb21lRGlyZWN0aXZlLmRlY29yYXRvcnMgPSBbXG4gICAqICAgeyB0eXBlOiBEaXJlY3RpdmUsIGFyZ3M6IFt7IHNlbGVjdG9yOiAnW3NvbWVEaXJlY3RpdmVdJyB9LF0gfVxuICAgKiBdO1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGRlY29yYXRvcnNTeW1ib2wgdGhlIHByb3BlcnR5IGNvbnRhaW5pbmcgdGhlIGRlY29yYXRvcnMgd2Ugd2FudCB0byBnZXQuXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIGRlY29yYXRvcnMgb3IgbnVsbCBpZiBub25lIHdoZXJlIGZvdW5kLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldENsYXNzRGVjb3JhdG9yc0Zyb21TdGF0aWNQcm9wZXJ0eShkZWNvcmF0b3JzU3ltYm9sOiB0cy5TeW1ib2wpOiBEZWNvcmF0b3JbXXxudWxsIHtcbiAgICBjb25zdCBkZWNvcmF0b3JzSWRlbnRpZmllciA9IGRlY29yYXRvcnNTeW1ib2wudmFsdWVEZWNsYXJhdGlvbjtcbiAgICBpZiAoZGVjb3JhdG9yc0lkZW50aWZpZXIgJiYgZGVjb3JhdG9yc0lkZW50aWZpZXIucGFyZW50KSB7XG4gICAgICBpZiAodHMuaXNCaW5hcnlFeHByZXNzaW9uKGRlY29yYXRvcnNJZGVudGlmaWVyLnBhcmVudCkgJiZcbiAgICAgICAgICBkZWNvcmF0b3JzSWRlbnRpZmllci5wYXJlbnQub3BlcmF0b3JUb2tlbi5raW5kID09PSB0cy5TeW50YXhLaW5kLkVxdWFsc1Rva2VuKSB7XG4gICAgICAgIC8vIEFTVCBvZiB0aGUgYXJyYXkgb2YgZGVjb3JhdG9yIHZhbHVlc1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JzQXJyYXkgPSBkZWNvcmF0b3JzSWRlbnRpZmllci5wYXJlbnQucmlnaHQ7XG4gICAgICAgIHJldHVybiB0aGlzLnJlZmxlY3REZWNvcmF0b3JzKGRlY29yYXRvcnNBcnJheSlcbiAgICAgICAgICAgIC5maWx0ZXIoZGVjb3JhdG9yID0+IHRoaXMuaXNGcm9tQ29yZShkZWNvcmF0b3IpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogRXhhbWluZSBhIHN5bWJvbCB3aGljaCBzaG91bGQgYmUgb2YgYSBjbGFzcywgYW5kIHJldHVybiBtZXRhZGF0YSBhYm91dCBpdHMgbWVtYmVycy5cbiAgICpcbiAgICogQHBhcmFtIHN5bWJvbCB0aGUgYENsYXNzU3ltYm9sYCByZXByZXNlbnRpbmcgdGhlIGNsYXNzIG92ZXIgd2hpY2ggdG8gcmVmbGVjdC5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2YgYENsYXNzTWVtYmVyYCBtZXRhZGF0YSByZXByZXNlbnRpbmcgdGhlIG1lbWJlcnMgb2YgdGhlIGNsYXNzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldE1lbWJlcnNPZlN5bWJvbChzeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IENsYXNzTWVtYmVyW10ge1xuICAgIGNvbnN0IG1lbWJlcnM6IENsYXNzTWVtYmVyW10gPSBbXTtcblxuICAgIC8vIFRoZSBkZWNvcmF0b3JzIG1hcCBjb250YWlucyBhbGwgdGhlIHByb3BlcnRpZXMgdGhhdCBhcmUgZGVjb3JhdGVkXG4gICAgY29uc3Qge21lbWJlckRlY29yYXRvcnN9ID0gdGhpcy5hY3F1aXJlRGVjb3JhdG9ySW5mbyhzeW1ib2wpO1xuXG4gICAgLy8gTWFrZSBhIGNvcHkgb2YgdGhlIGRlY29yYXRvcnMgYXMgc3VjY2Vzc2Z1bGx5IHJlZmxlY3RlZCBtZW1iZXJzIGRlbGV0ZSB0aGVtc2VsdmVzIGZyb20gdGhlXG4gICAgLy8gbWFwLCBzbyB0aGF0IGFueSBsZWZ0b3ZlcnMgY2FuIGJlIGVhc2lseSBkZWFsdCB3aXRoLlxuICAgIGNvbnN0IGRlY29yYXRvcnNNYXAgPSBuZXcgTWFwKG1lbWJlckRlY29yYXRvcnMpO1xuXG4gICAgLy8gVGhlIG1lbWJlciBtYXAgY29udGFpbnMgYWxsIHRoZSBtZXRob2QgKGluc3RhbmNlIGFuZCBzdGF0aWMpOyBhbmQgYW55IGluc3RhbmNlIHByb3BlcnRpZXNcbiAgICAvLyB0aGF0IGFyZSBpbml0aWFsaXplZCBpbiB0aGUgY2xhc3MuXG4gICAgaWYgKHN5bWJvbC5pbXBsZW1lbnRhdGlvbi5tZW1iZXJzKSB7XG4gICAgICBzeW1ib2wuaW1wbGVtZW50YXRpb24ubWVtYmVycy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIGNvbnN0IGRlY29yYXRvcnMgPSBkZWNvcmF0b3JzTWFwLmdldChrZXkgYXMgc3RyaW5nKTtcbiAgICAgICAgY29uc3QgcmVmbGVjdGVkTWVtYmVycyA9IHRoaXMucmVmbGVjdE1lbWJlcnModmFsdWUsIGRlY29yYXRvcnMpO1xuICAgICAgICBpZiAocmVmbGVjdGVkTWVtYmVycykge1xuICAgICAgICAgIGRlY29yYXRvcnNNYXAuZGVsZXRlKGtleSBhcyBzdHJpbmcpO1xuICAgICAgICAgIG1lbWJlcnMucHVzaCguLi5yZWZsZWN0ZWRNZW1iZXJzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVGhlIHN0YXRpYyBwcm9wZXJ0eSBtYXAgY29udGFpbnMgYWxsIHRoZSBzdGF0aWMgcHJvcGVydGllc1xuICAgIGlmIChzeW1ib2wuaW1wbGVtZW50YXRpb24uZXhwb3J0cykge1xuICAgICAgc3ltYm9sLmltcGxlbWVudGF0aW9uLmV4cG9ydHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JzID0gZGVjb3JhdG9yc01hcC5nZXQoa2V5IGFzIHN0cmluZyk7XG4gICAgICAgIGNvbnN0IHJlZmxlY3RlZE1lbWJlcnMgPSB0aGlzLnJlZmxlY3RNZW1iZXJzKHZhbHVlLCBkZWNvcmF0b3JzLCB0cnVlKTtcbiAgICAgICAgaWYgKHJlZmxlY3RlZE1lbWJlcnMpIHtcbiAgICAgICAgICBkZWNvcmF0b3JzTWFwLmRlbGV0ZShrZXkgYXMgc3RyaW5nKTtcbiAgICAgICAgICBtZW1iZXJzLnB1c2goLi4ucmVmbGVjdGVkTWVtYmVycyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIElmIHRoaXMgY2xhc3Mgd2FzIGRlY2xhcmVkIGFzIGEgVmFyaWFibGVEZWNsYXJhdGlvbiB0aGVuIGl0IG1heSBoYXZlIHN0YXRpYyBwcm9wZXJ0aWVzXG4gICAgLy8gYXR0YWNoZWQgdG8gdGhlIHZhcmlhYmxlIHJhdGhlciB0aGFuIHRoZSBjbGFzcyBpdHNlbGZcbiAgICAvLyBGb3IgZXhhbXBsZTpcbiAgICAvLyBgYGBcbiAgICAvLyBsZXQgTXlDbGFzcyA9IGNsYXNzIE15Q2xhc3Mge1xuICAgIC8vICAgLy8gbm8gc3RhdGljIHByb3BlcnRpZXMgaGVyZSFcbiAgICAvLyB9XG4gICAgLy8gTXlDbGFzcy5zdGF0aWNQcm9wZXJ0eSA9IC4uLjtcbiAgICAvLyBgYGBcbiAgICBpZiAodHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKHN5bWJvbC5kZWNsYXJhdGlvbi52YWx1ZURlY2xhcmF0aW9uKSkge1xuICAgICAgaWYgKHN5bWJvbC5kZWNsYXJhdGlvbi5leHBvcnRzKSB7XG4gICAgICAgIHN5bWJvbC5kZWNsYXJhdGlvbi5leHBvcnRzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICBjb25zdCBkZWNvcmF0b3JzID0gZGVjb3JhdG9yc01hcC5nZXQoa2V5IGFzIHN0cmluZyk7XG4gICAgICAgICAgY29uc3QgcmVmbGVjdGVkTWVtYmVycyA9IHRoaXMucmVmbGVjdE1lbWJlcnModmFsdWUsIGRlY29yYXRvcnMsIHRydWUpO1xuICAgICAgICAgIGlmIChyZWZsZWN0ZWRNZW1iZXJzKSB7XG4gICAgICAgICAgICBkZWNvcmF0b3JzTWFwLmRlbGV0ZShrZXkgYXMgc3RyaW5nKTtcbiAgICAgICAgICAgIG1lbWJlcnMucHVzaCguLi5yZWZsZWN0ZWRNZW1iZXJzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHRoaXMgY2xhc3Mgd2FzIGRlY2xhcmVkIGFzIGEgVmFyaWFibGVEZWNsYXJhdGlvbiBpbnNpZGUgYW4gSUlGRSwgdGhlbiBpdCBtYXkgaGF2ZSBzdGF0aWNcbiAgICAvLyBwcm9wZXJ0aWVzIGF0dGFjaGVkIHRvIHRoZSB2YXJpYWJsZSByYXRoZXIgdGhhbiB0aGUgY2xhc3MgaXRzZWxmLlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGU6XG4gICAgLy8gYGBgXG4gICAgLy8gbGV0IE91dGVyQ2xhc3MgPSAoKCkgPT4ge1xuICAgIC8vICAgbGV0IEFkamFjZW50Q2xhc3MgPSBjbGFzcyBJbnRlcm5hbENsYXNzIHtcbiAgICAvLyAgICAgLy8gbm8gc3RhdGljIHByb3BlcnRpZXMgaGVyZSFcbiAgICAvLyAgIH1cbiAgICAvLyAgIEFkamFjZW50Q2xhc3Muc3RhdGljUHJvcGVydHkgPSAuLi47XG4gICAgLy8gfSkoKTtcbiAgICAvLyBgYGBcbiAgICBpZiAoc3ltYm9sLmFkamFjZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICh0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oc3ltYm9sLmFkamFjZW50LnZhbHVlRGVjbGFyYXRpb24pKSB7XG4gICAgICAgIGlmIChzeW1ib2wuYWRqYWNlbnQuZXhwb3J0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc3ltYm9sLmFkamFjZW50LmV4cG9ydHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9ycyA9IGRlY29yYXRvcnNNYXAuZ2V0KGtleSBhcyBzdHJpbmcpO1xuICAgICAgICAgICAgY29uc3QgcmVmbGVjdGVkTWVtYmVycyA9IHRoaXMucmVmbGVjdE1lbWJlcnModmFsdWUsIGRlY29yYXRvcnMsIHRydWUpO1xuICAgICAgICAgICAgaWYgKHJlZmxlY3RlZE1lbWJlcnMpIHtcbiAgICAgICAgICAgICAgZGVjb3JhdG9yc01hcC5kZWxldGUoa2V5IGFzIHN0cmluZyk7XG4gICAgICAgICAgICAgIG1lbWJlcnMucHVzaCguLi5yZWZsZWN0ZWRNZW1iZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIERlYWwgd2l0aCBhbnkgZGVjb3JhdGVkIHByb3BlcnRpZXMgdGhhdCB3ZXJlIG5vdCBpbml0aWFsaXplZCBpbiB0aGUgY2xhc3NcbiAgICBkZWNvcmF0b3JzTWFwLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgIG1lbWJlcnMucHVzaCh7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBudWxsLFxuICAgICAgICBkZWNvcmF0b3JzOiB2YWx1ZSxcbiAgICAgICAgaXNTdGF0aWM6IGZhbHNlLFxuICAgICAgICBraW5kOiBDbGFzc01lbWJlcktpbmQuUHJvcGVydHksXG4gICAgICAgIG5hbWU6IGtleSxcbiAgICAgICAgbmFtZU5vZGU6IG51bGwsXG4gICAgICAgIG5vZGU6IG51bGwsXG4gICAgICAgIHR5cGU6IG51bGwsXG4gICAgICAgIHZhbHVlOiBudWxsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBtZW1iZXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIE1lbWJlciBkZWNvcmF0b3JzIG1heSBiZSBkZWNsYXJlZCBhcyBzdGF0aWMgcHJvcGVydGllcyBvZiB0aGUgY2xhc3M6XG4gICAqXG4gICAqIGBgYFxuICAgKiBTb21lRGlyZWN0aXZlLnByb3BEZWNvcmF0b3JzID0ge1xuICAgKiAgIFwibmdGb3JPZlwiOiBbeyB0eXBlOiBJbnB1dCB9LF0sXG4gICAqICAgXCJuZ0ZvclRyYWNrQnlcIjogW3sgdHlwZTogSW5wdXQgfSxdLFxuICAgKiAgIFwibmdGb3JUZW1wbGF0ZVwiOiBbeyB0eXBlOiBJbnB1dCB9LF0sXG4gICAqIH07XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gZGVjb3JhdG9yc1Byb3BlcnR5IHRoZSBjbGFzcyB3aG9zZSBtZW1iZXIgZGVjb3JhdG9ycyB3ZSBhcmUgaW50ZXJlc3RlZCBpbi5cbiAgICogQHJldHVybnMgYSBtYXAgd2hvc2Uga2V5cyBhcmUgdGhlIG5hbWUgb2YgdGhlIG1lbWJlcnMgYW5kIHdob3NlIHZhbHVlcyBhcmUgY29sbGVjdGlvbnMgb2ZcbiAgICogZGVjb3JhdG9ycyBmb3IgdGhlIGdpdmVuIG1lbWJlci5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRNZW1iZXJEZWNvcmF0b3JzRnJvbVN0YXRpY1Byb3BlcnR5KGRlY29yYXRvcnNQcm9wZXJ0eTogdHMuU3ltYm9sKTpcbiAgICAgIE1hcDxzdHJpbmcsIERlY29yYXRvcltdPiB7XG4gICAgY29uc3QgbWVtYmVyRGVjb3JhdG9ycyA9IG5ldyBNYXA8c3RyaW5nLCBEZWNvcmF0b3JbXT4oKTtcbiAgICAvLyBTeW1ib2wgb2YgdGhlIGlkZW50aWZpZXIgZm9yIGBTb21lRGlyZWN0aXZlLnByb3BEZWNvcmF0b3JzYC5cbiAgICBjb25zdCBwcm9wRGVjb3JhdG9yc01hcCA9IGdldFByb3BlcnR5VmFsdWVGcm9tU3ltYm9sKGRlY29yYXRvcnNQcm9wZXJ0eSk7XG4gICAgaWYgKHByb3BEZWNvcmF0b3JzTWFwICYmIHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24ocHJvcERlY29yYXRvcnNNYXApKSB7XG4gICAgICBjb25zdCBwcm9wZXJ0aWVzTWFwID0gcmVmbGVjdE9iamVjdExpdGVyYWwocHJvcERlY29yYXRvcnNNYXApO1xuICAgICAgcHJvcGVydGllc01hcC5mb3JFYWNoKCh2YWx1ZSwgbmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JzID1cbiAgICAgICAgICAgIHRoaXMucmVmbGVjdERlY29yYXRvcnModmFsdWUpLmZpbHRlcihkZWNvcmF0b3IgPT4gdGhpcy5pc0Zyb21Db3JlKGRlY29yYXRvcikpO1xuICAgICAgICBpZiAoZGVjb3JhdG9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBtZW1iZXJEZWNvcmF0b3JzLnNldChuYW1lLCBkZWNvcmF0b3JzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBtZW1iZXJEZWNvcmF0b3JzO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciBhIGdpdmVuIGNsYXNzIHN5bWJvbCwgY29sbGVjdHMgYWxsIGRlY29yYXRvciBpbmZvcm1hdGlvbiBmcm9tIHRzbGliIGhlbHBlciBtZXRob2RzLCBhc1xuICAgKiBnZW5lcmF0ZWQgYnkgVHlwZVNjcmlwdCBpbnRvIGVtaXR0ZWQgSmF2YVNjcmlwdCBmaWxlcy5cbiAgICpcbiAgICogQ2xhc3MgZGVjb3JhdG9ycyBhcmUgZXh0cmFjdGVkIGZyb20gY2FsbHMgdG8gYHRzbGliLl9fZGVjb3JhdGVgIHRoYXQgbG9vayBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiBgYGBcbiAgICogbGV0IFNvbWVEaXJlY3RpdmUgPSBjbGFzcyBTb21lRGlyZWN0aXZlIHt9XG4gICAqIFNvbWVEaXJlY3RpdmUgPSBfX2RlY29yYXRlKFtcbiAgICogICBEaXJlY3RpdmUoeyBzZWxlY3RvcjogJ1tzb21lRGlyZWN0aXZlXScgfSksXG4gICAqIF0sIFNvbWVEaXJlY3RpdmUpO1xuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGV4dHJhY3Rpb24gb2YgbWVtYmVyIGRlY29yYXRvcnMgaXMgc2ltaWxhciwgd2l0aCB0aGUgZGlzdGluY3Rpb24gdGhhdCBpdHMgMm5kIGFuZCAzcmRcbiAgICogYXJndW1lbnQgY29ycmVzcG9uZCB3aXRoIGEgXCJwcm90b3R5cGVcIiB0YXJnZXQgYW5kIHRoZSBuYW1lIG9mIHRoZSBtZW1iZXIgdG8gd2hpY2ggdGhlXG4gICAqIGRlY29yYXRvcnMgYXBwbHkuXG4gICAqXG4gICAqIGBgYFxuICAgKiBfX2RlY29yYXRlKFtcbiAgICogICAgIElucHV0KCksXG4gICAqICAgICBfX21ldGFkYXRhKFwiZGVzaWduOnR5cGVcIiwgU3RyaW5nKVxuICAgKiBdLCBTb21lRGlyZWN0aXZlLnByb3RvdHlwZSwgXCJpbnB1dDFcIiwgdm9pZCAwKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBjbGFzc1N5bWJvbCBUaGUgY2xhc3Mgc3ltYm9sIGZvciB3aGljaCBkZWNvcmF0b3JzIHNob3VsZCBiZSBleHRyYWN0ZWQuXG4gICAqIEByZXR1cm5zIEFsbCBpbmZvcm1hdGlvbiBvbiB0aGUgZGVjb3JhdG9ycyBvZiB0aGUgY2xhc3MuXG4gICAqL1xuICBwcm90ZWN0ZWQgY29tcHV0ZURlY29yYXRvckluZm9Gcm9tSGVscGVyQ2FsbHMoY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IERlY29yYXRvckluZm8ge1xuICAgIGxldCBjbGFzc0RlY29yYXRvcnM6IERlY29yYXRvcltdfG51bGwgPSBudWxsO1xuICAgIGNvbnN0IG1lbWJlckRlY29yYXRvcnMgPSBuZXcgTWFwPHN0cmluZywgRGVjb3JhdG9yW10+KCk7XG4gICAgY29uc3QgY29uc3RydWN0b3JQYXJhbUluZm86IFBhcmFtSW5mb1tdID0gW107XG5cbiAgICBjb25zdCBnZXRDb25zdHJ1Y3RvclBhcmFtSW5mbyA9IChpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICBsZXQgcGFyYW0gPSBjb25zdHJ1Y3RvclBhcmFtSW5mb1tpbmRleF07XG4gICAgICBpZiAocGFyYW0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwYXJhbSA9IGNvbnN0cnVjdG9yUGFyYW1JbmZvW2luZGV4XSA9IHtkZWNvcmF0b3JzOiBudWxsLCB0eXBlRXhwcmVzc2lvbjogbnVsbH07XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyYW07XG4gICAgfTtcblxuICAgIC8vIEFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBjYW4gYmUgZXh0cmFjdGVkIGZyb20gY2FsbHMgdG8gYF9fZGVjb3JhdGVgLCBvYnRhaW4gdGhlc2UgZmlyc3QuXG4gICAgLy8gTm90ZSB0aGF0IGFsdGhvdWdoIHRoZSBoZWxwZXIgY2FsbHMgYXJlIHJldHJpZXZlZCB1c2luZyB0aGUgY2xhc3Mgc3ltYm9sLCB0aGUgcmVzdWx0IG1heVxuICAgIC8vIGNvbnRhaW4gaGVscGVyIGNhbGxzIGNvcnJlc3BvbmRpbmcgd2l0aCB1bnJlbGF0ZWQgY2xhc3Nlcy4gVGhlcmVmb3JlLCBlYWNoIGhlbHBlciBjYWxsIHN0aWxsXG4gICAgLy8gaGFzIHRvIGJlIGNoZWNrZWQgdG8gYWN0dWFsbHkgY29ycmVzcG9uZCB3aXRoIHRoZSBjbGFzcyBzeW1ib2wuXG4gICAgY29uc3QgaGVscGVyQ2FsbHMgPSB0aGlzLmdldEhlbHBlckNhbGxzRm9yQ2xhc3MoY2xhc3NTeW1ib2wsIFsnX19kZWNvcmF0ZSddKTtcblxuICAgIGNvbnN0IG91dGVyRGVjbGFyYXRpb24gPSBjbGFzc1N5bWJvbC5kZWNsYXJhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICAgIGNvbnN0IGlubmVyRGVjbGFyYXRpb24gPSBjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICAgIGNvbnN0IGFkamFjZW50RGVjbGFyYXRpb24gPSB0aGlzLmdldEFkamFjZW50TmFtZU9mQ2xhc3NTeW1ib2woY2xhc3NTeW1ib2wpLnBhcmVudDtcbiAgICBjb25zdCBtYXRjaGVzQ2xhc3MgPSAoaWRlbnRpZmllcjogdHMuSWRlbnRpZmllcikgPT4ge1xuICAgICAgY29uc3QgZGVjbCA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIoaWRlbnRpZmllcik7XG4gICAgICByZXR1cm4gZGVjbCAhPT0gbnVsbCAmJlxuICAgICAgICAgIChkZWNsLm5vZGUgPT09IGFkamFjZW50RGVjbGFyYXRpb24gfHwgZGVjbC5ub2RlID09PSBvdXRlckRlY2xhcmF0aW9uIHx8XG4gICAgICAgICAgIGRlY2wubm9kZSA9PT0gaW5uZXJEZWNsYXJhdGlvbik7XG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgaGVscGVyQ2FsbCBvZiBoZWxwZXJDYWxscykge1xuICAgICAgaWYgKGlzQ2xhc3NEZWNvcmF0ZUNhbGwoaGVscGVyQ2FsbCwgbWF0Y2hlc0NsYXNzKSkge1xuICAgICAgICAvLyBUaGlzIGBfX2RlY29yYXRlYCBjYWxsIGlzIHRhcmdldGluZyB0aGUgY2xhc3MgaXRzZWxmLlxuICAgICAgICBjb25zdCBoZWxwZXJBcmdzID0gaGVscGVyQ2FsbC5hcmd1bWVudHNbMF07XG5cbiAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGhlbHBlckFyZ3MuZWxlbWVudHMpIHtcbiAgICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMucmVmbGVjdERlY29yYXRlSGVscGVyRW50cnkoZWxlbWVudCk7XG4gICAgICAgICAgaWYgKGVudHJ5ID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZW50cnkudHlwZSA9PT0gJ2RlY29yYXRvcicpIHtcbiAgICAgICAgICAgIC8vIFRoZSBoZWxwZXIgYXJnIHdhcyByZWZsZWN0ZWQgdG8gcmVwcmVzZW50IGFuIGFjdHVhbCBkZWNvcmF0b3JcbiAgICAgICAgICAgIGlmICh0aGlzLmlzRnJvbUNvcmUoZW50cnkuZGVjb3JhdG9yKSkge1xuICAgICAgICAgICAgICAoY2xhc3NEZWNvcmF0b3JzIHx8IChjbGFzc0RlY29yYXRvcnMgPSBbXSkpLnB1c2goZW50cnkuZGVjb3JhdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LnR5cGUgPT09ICdwYXJhbTpkZWNvcmF0b3JzJykge1xuICAgICAgICAgICAgLy8gVGhlIGhlbHBlciBhcmcgcmVwcmVzZW50cyBhIGRlY29yYXRvciBmb3IgYSBwYXJhbWV0ZXIuIFNpbmNlIGl0J3MgYXBwbGllZCB0byB0aGVcbiAgICAgICAgICAgIC8vIGNsYXNzLCBpdCBjb3JyZXNwb25kcyB3aXRoIGEgY29uc3RydWN0b3IgcGFyYW1ldGVyIG9mIHRoZSBjbGFzcy5cbiAgICAgICAgICAgIGNvbnN0IHBhcmFtID0gZ2V0Q29uc3RydWN0b3JQYXJhbUluZm8oZW50cnkuaW5kZXgpO1xuICAgICAgICAgICAgKHBhcmFtLmRlY29yYXRvcnMgfHwgKHBhcmFtLmRlY29yYXRvcnMgPSBbXSkpLnB1c2goZW50cnkuZGVjb3JhdG9yKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LnR5cGUgPT09ICdwYXJhbXMnKSB7XG4gICAgICAgICAgICAvLyBUaGUgaGVscGVyIGFyZyByZXByZXNlbnRzIHRoZSB0eXBlcyBvZiB0aGUgcGFyYW1ldGVycy4gU2luY2UgaXQncyBhcHBsaWVkIHRvIHRoZVxuICAgICAgICAgICAgLy8gY2xhc3MsIGl0IGNvcnJlc3BvbmRzIHdpdGggdGhlIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMgb2YgdGhlIGNsYXNzLlxuICAgICAgICAgICAgZW50cnkudHlwZXMuZm9yRWFjaChcbiAgICAgICAgICAgICAgICAodHlwZSwgaW5kZXgpID0+IGdldENvbnN0cnVjdG9yUGFyYW1JbmZvKGluZGV4KS50eXBlRXhwcmVzc2lvbiA9IHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc01lbWJlckRlY29yYXRlQ2FsbChoZWxwZXJDYWxsLCBtYXRjaGVzQ2xhc3MpKSB7XG4gICAgICAgIC8vIFRoZSBgX19kZWNvcmF0ZWAgY2FsbCBpcyB0YXJnZXRpbmcgYSBtZW1iZXIgb2YgdGhlIGNsYXNzXG4gICAgICAgIGNvbnN0IGhlbHBlckFyZ3MgPSBoZWxwZXJDYWxsLmFyZ3VtZW50c1swXTtcbiAgICAgICAgY29uc3QgbWVtYmVyTmFtZSA9IGhlbHBlckNhbGwuYXJndW1lbnRzWzJdLnRleHQ7XG5cbiAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGhlbHBlckFyZ3MuZWxlbWVudHMpIHtcbiAgICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMucmVmbGVjdERlY29yYXRlSGVscGVyRW50cnkoZWxlbWVudCk7XG4gICAgICAgICAgaWYgKGVudHJ5ID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZW50cnkudHlwZSA9PT0gJ2RlY29yYXRvcicpIHtcbiAgICAgICAgICAgIC8vIFRoZSBoZWxwZXIgYXJnIHdhcyByZWZsZWN0ZWQgdG8gcmVwcmVzZW50IGFuIGFjdHVhbCBkZWNvcmF0b3IuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0Zyb21Db3JlKGVudHJ5LmRlY29yYXRvcikpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9ycyA9XG4gICAgICAgICAgICAgICAgICBtZW1iZXJEZWNvcmF0b3JzLmhhcyhtZW1iZXJOYW1lKSA/IG1lbWJlckRlY29yYXRvcnMuZ2V0KG1lbWJlck5hbWUpISA6IFtdO1xuICAgICAgICAgICAgICBkZWNvcmF0b3JzLnB1c2goZW50cnkuZGVjb3JhdG9yKTtcbiAgICAgICAgICAgICAgbWVtYmVyRGVjb3JhdG9ycy5zZXQobWVtYmVyTmFtZSwgZGVjb3JhdG9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEluZm9ybWF0aW9uIG9uIGRlY29yYXRlZCBwYXJhbWV0ZXJzIGlzIG5vdCBpbnRlcmVzdGluZyBmb3IgbmdjYywgc28gaXQncyBpZ25vcmVkLlxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7Y2xhc3NEZWNvcmF0b3JzLCBtZW1iZXJEZWNvcmF0b3JzLCBjb25zdHJ1Y3RvclBhcmFtSW5mb307XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZGV0YWlscyBvZiBhbiBlbnRyeSB3aXRoaW4gYSBgX19kZWNvcmF0ZWAgaGVscGVyIGNhbGwuIEZvciBleGFtcGxlLCBnaXZlbiB0aGVcbiAgICogZm9sbG93aW5nIGNvZGU6XG4gICAqXG4gICAqIGBgYFxuICAgKiBfX2RlY29yYXRlKFtcbiAgICogICBEaXJlY3RpdmUoeyBzZWxlY3RvcjogJ1tzb21lRGlyZWN0aXZlXScgfSksXG4gICAqICAgdHNsaWJfMS5fX3BhcmFtKDIsIEluamVjdChJTkpFQ1RFRF9UT0tFTikpLFxuICAgKiAgIHRzbGliXzEuX19tZXRhZGF0YShcImRlc2lnbjpwYXJhbXR5cGVzXCIsIFtWaWV3Q29udGFpbmVyUmVmLCBUZW1wbGF0ZVJlZiwgU3RyaW5nXSlcbiAgICogXSwgU29tZURpcmVjdGl2ZSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBpdCBjYW4gYmUgc2VlbiB0aGF0IHRoZXJlIGFyZSBjYWxscyB0byByZWd1bGFyIGRlY29yYXRvcnMgKHRoZSBgRGlyZWN0aXZlYCkgYW5kIGNhbGxzIGludG9cbiAgICogYHRzbGliYCBmdW5jdGlvbnMgd2hpY2ggaGF2ZSBiZWVuIGluc2VydGVkIGJ5IFR5cGVTY3JpcHQuIFRoZXJlZm9yZSwgdGhpcyBmdW5jdGlvbiBjbGFzc2lmaWVzXG4gICAqIGEgY2FsbCB0byBjb3JyZXNwb25kIHdpdGhcbiAgICogICAxLiBhIHJlYWwgZGVjb3JhdG9yIGxpa2UgYERpcmVjdGl2ZWAgYWJvdmUsIG9yXG4gICAqICAgMi4gYSBkZWNvcmF0ZWQgcGFyYW1ldGVyLCBjb3JyZXNwb25kaW5nIHdpdGggYF9fcGFyYW1gIGNhbGxzIGZyb20gYHRzbGliYCwgb3JcbiAgICogICAzLiB0aGUgdHlwZSBpbmZvcm1hdGlvbiBvZiBwYXJhbWV0ZXJzLCBjb3JyZXNwb25kaW5nIHdpdGggYF9fbWV0YWRhdGFgIGNhbGwgZnJvbSBgdHNsaWJgXG4gICAqXG4gICAqIEBwYXJhbSBleHByZXNzaW9uIHRoZSBleHByZXNzaW9uIHRoYXQgbmVlZHMgdG8gYmUgcmVmbGVjdGVkIGludG8gYSBgRGVjb3JhdGVIZWxwZXJFbnRyeWBcbiAgICogQHJldHVybnMgYW4gb2JqZWN0IHRoYXQgaW5kaWNhdGVzIHdoaWNoIG9mIHRoZSB0aHJlZSBjYXRlZ29yaWVzIHRoZSBjYWxsIHJlcHJlc2VudHMsIHRvZ2V0aGVyXG4gICAqIHdpdGggdGhlIHJlZmxlY3RlZCBpbmZvcm1hdGlvbiBvZiB0aGUgY2FsbCwgb3IgbnVsbCBpZiB0aGUgY2FsbCBpcyBub3QgYSB2YWxpZCBkZWNvcmF0ZSBjYWxsLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlZmxlY3REZWNvcmF0ZUhlbHBlckVudHJ5KGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiBEZWNvcmF0ZUhlbHBlckVudHJ5fG51bGwge1xuICAgIC8vIFdlIG9ubHkgY2FyZSBhYm91dCB0aG9zZSBlbGVtZW50cyB0aGF0IGFyZSBhY3R1YWwgY2FsbHNcbiAgICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24oZXhwcmVzc2lvbikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjYWxsID0gZXhwcmVzc2lvbjtcblxuICAgIGNvbnN0IGhlbHBlck5hbWUgPSBnZXRDYWxsZWVOYW1lKGNhbGwpO1xuICAgIGlmIChoZWxwZXJOYW1lID09PSAnX19tZXRhZGF0YScpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBgdHNsaWIuX19tZXRhZGF0YWAgY2FsbCwgcmVmbGVjdCB0byBhcmd1bWVudHMgaW50byBhIGBQYXJhbWV0ZXJUeXBlc2Agb2JqZWN0XG4gICAgICAvLyBpZiB0aGUgbWV0YWRhdGEga2V5IGlzIFwiZGVzaWduOnBhcmFtdHlwZXNcIi5cbiAgICAgIGNvbnN0IGtleSA9IGNhbGwuYXJndW1lbnRzWzBdO1xuICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkIHx8ICF0cy5pc1N0cmluZ0xpdGVyYWwoa2V5KSB8fCBrZXkudGV4dCAhPT0gJ2Rlc2lnbjpwYXJhbXR5cGVzJykge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSBjYWxsLmFyZ3VtZW50c1sxXTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8ICF0cy5pc0FycmF5TGl0ZXJhbEV4cHJlc3Npb24odmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAncGFyYW1zJyxcbiAgICAgICAgdHlwZXM6IEFycmF5LmZyb20odmFsdWUuZWxlbWVudHMpLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoaGVscGVyTmFtZSA9PT0gJ19fcGFyYW0nKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgYHRzbGliLl9fcGFyYW1gIGNhbGwgdGhhdCBpcyByZWZsZWN0ZWQgaW50byBhIGBQYXJhbWV0ZXJEZWNvcmF0b3JzYCBvYmplY3QuXG4gICAgICBjb25zdCBpbmRleEFyZyA9IGNhbGwuYXJndW1lbnRzWzBdO1xuICAgICAgY29uc3QgaW5kZXggPSBpbmRleEFyZyAmJiB0cy5pc051bWVyaWNMaXRlcmFsKGluZGV4QXJnKSA/IHBhcnNlSW50KGluZGV4QXJnLnRleHQsIDEwKSA6IE5hTjtcbiAgICAgIGlmIChpc05hTihpbmRleCkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRlY29yYXRvckNhbGwgPSBjYWxsLmFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChkZWNvcmF0b3JDYWxsID09PSB1bmRlZmluZWQgfHwgIXRzLmlzQ2FsbEV4cHJlc3Npb24oZGVjb3JhdG9yQ2FsbCkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRlY29yYXRvciA9IHRoaXMucmVmbGVjdERlY29yYXRvckNhbGwoZGVjb3JhdG9yQ2FsbCk7XG4gICAgICBpZiAoZGVjb3JhdG9yID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAncGFyYW06ZGVjb3JhdG9ycycsXG4gICAgICAgIGluZGV4LFxuICAgICAgICBkZWNvcmF0b3IsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSBhdHRlbXB0IHRvIHJlZmxlY3QgaXQgYXMgYSByZWd1bGFyIGRlY29yYXRvci5cbiAgICBjb25zdCBkZWNvcmF0b3IgPSB0aGlzLnJlZmxlY3REZWNvcmF0b3JDYWxsKGNhbGwpO1xuICAgIGlmIChkZWNvcmF0b3IgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2RlY29yYXRvcicsXG4gICAgICBkZWNvcmF0b3IsXG4gICAgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZWZsZWN0RGVjb3JhdG9yQ2FsbChjYWxsOiB0cy5DYWxsRXhwcmVzc2lvbik6IERlY29yYXRvcnxudWxsIHtcbiAgICBjb25zdCBkZWNvcmF0b3JFeHByZXNzaW9uID0gY2FsbC5leHByZXNzaW9uO1xuICAgIGlmICghaXNEZWNvcmF0b3JJZGVudGlmaWVyKGRlY29yYXRvckV4cHJlc3Npb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBXZSBmb3VuZCBhIGRlY29yYXRvciFcbiAgICBjb25zdCBkZWNvcmF0b3JJZGVudGlmaWVyID1cbiAgICAgICAgdHMuaXNJZGVudGlmaWVyKGRlY29yYXRvckV4cHJlc3Npb24pID8gZGVjb3JhdG9yRXhwcmVzc2lvbiA6IGRlY29yYXRvckV4cHJlc3Npb24ubmFtZTtcblxuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiBkZWNvcmF0b3JJZGVudGlmaWVyLnRleHQsXG4gICAgICBpZGVudGlmaWVyOiBkZWNvcmF0b3JFeHByZXNzaW9uLFxuICAgICAgaW1wb3J0OiB0aGlzLmdldEltcG9ydE9mSWRlbnRpZmllcihkZWNvcmF0b3JJZGVudGlmaWVyKSxcbiAgICAgIG5vZGU6IGNhbGwsXG4gICAgICBhcmdzOiBBcnJheS5mcm9tKGNhbGwuYXJndW1lbnRzKSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRoZSBnaXZlbiBzdGF0ZW1lbnQgdG8gc2VlIGlmIGl0IGlzIGEgY2FsbCB0byBhbnkgb2YgdGhlIHNwZWNpZmllZCBoZWxwZXIgZnVuY3Rpb25zIG9yXG4gICAqIG51bGwgaWYgbm90IGZvdW5kLlxuICAgKlxuICAgKiBNYXRjaGluZyBzdGF0ZW1lbnRzIHdpbGwgbG9vayBsaWtlOiAgYHRzbGliXzEuX19kZWNvcmF0ZSguLi4pO2AuXG4gICAqIEBwYXJhbSBzdGF0ZW1lbnQgdGhlIHN0YXRlbWVudCB0aGF0IG1heSBjb250YWluIHRoZSBjYWxsLlxuICAgKiBAcGFyYW0gaGVscGVyTmFtZXMgdGhlIG5hbWVzIG9mIHRoZSBoZWxwZXIgd2UgYXJlIGxvb2tpbmcgZm9yLlxuICAgKiBAcmV0dXJucyB0aGUgbm9kZSB0aGF0IGNvcnJlc3BvbmRzIHRvIHRoZSBgX19kZWNvcmF0ZSguLi4pYCBjYWxsIG9yIG51bGwgaWYgdGhlIHN0YXRlbWVudFxuICAgKiBkb2VzIG5vdCBtYXRjaC5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRIZWxwZXJDYWxsKHN0YXRlbWVudDogdHMuU3RhdGVtZW50LCBoZWxwZXJOYW1lczogc3RyaW5nW10pOiB0cy5DYWxsRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAoKHRzLmlzRXhwcmVzc2lvblN0YXRlbWVudChzdGF0ZW1lbnQpIHx8IHRzLmlzUmV0dXJuU3RhdGVtZW50KHN0YXRlbWVudCkpICYmXG4gICAgICAgIHN0YXRlbWVudC5leHByZXNzaW9uKSB7XG4gICAgICBsZXQgZXhwcmVzc2lvbiA9IHN0YXRlbWVudC5leHByZXNzaW9uO1xuICAgICAgd2hpbGUgKGlzQXNzaWdubWVudChleHByZXNzaW9uKSkge1xuICAgICAgICBleHByZXNzaW9uID0gZXhwcmVzc2lvbi5yaWdodDtcbiAgICAgIH1cbiAgICAgIGlmICh0cy5pc0NhbGxFeHByZXNzaW9uKGV4cHJlc3Npb24pKSB7XG4gICAgICAgIGNvbnN0IGNhbGxlZU5hbWUgPSBnZXRDYWxsZWVOYW1lKGV4cHJlc3Npb24pO1xuICAgICAgICBpZiAoY2FsbGVlTmFtZSAhPT0gbnVsbCAmJiBoZWxwZXJOYW1lcy5pbmNsdWRlcyhjYWxsZWVOYW1lKSkge1xuICAgICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICAvKipcbiAgICogUmVmbGVjdCBvdmVyIHRoZSBnaXZlbiBhcnJheSBub2RlIGFuZCBleHRyYWN0IGRlY29yYXRvciBpbmZvcm1hdGlvbiBmcm9tIGVhY2ggZWxlbWVudC5cbiAgICpcbiAgICogVGhpcyBpcyB1c2VkIGZvciBkZWNvcmF0b3JzIHRoYXQgYXJlIGRlZmluZWQgaW4gc3RhdGljIHByb3BlcnRpZXMuIEZvciBleGFtcGxlOlxuICAgKlxuICAgKiBgYGBcbiAgICogU29tZURpcmVjdGl2ZS5kZWNvcmF0b3JzID0gW1xuICAgKiAgIHsgdHlwZTogRGlyZWN0aXZlLCBhcmdzOiBbeyBzZWxlY3RvcjogJ1tzb21lRGlyZWN0aXZlXScgfSxdIH1cbiAgICogXTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBkZWNvcmF0b3JzQXJyYXkgYW4gZXhwcmVzc2lvbiB0aGF0IGNvbnRhaW5zIGRlY29yYXRvciBpbmZvcm1hdGlvbi5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2YgZGVjb3JhdG9yIGluZm8gdGhhdCB3YXMgcmVmbGVjdGVkIGZyb20gdGhlIGFycmF5IG5vZGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgcmVmbGVjdERlY29yYXRvcnMoZGVjb3JhdG9yc0FycmF5OiB0cy5FeHByZXNzaW9uKTogRGVjb3JhdG9yW10ge1xuICAgIGNvbnN0IGRlY29yYXRvcnM6IERlY29yYXRvcltdID0gW107XG5cbiAgICBpZiAodHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKGRlY29yYXRvcnNBcnJheSkpIHtcbiAgICAgIC8vIEFkZCBlYWNoIGRlY29yYXRvciB0aGF0IGlzIGltcG9ydGVkIGZyb20gYEBhbmd1bGFyL2NvcmVgIGludG8gdGhlIGBkZWNvcmF0b3JzYCBhcnJheVxuICAgICAgZGVjb3JhdG9yc0FycmF5LmVsZW1lbnRzLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICAgIC8vIElmIHRoZSBkZWNvcmF0b3IgaXMgbm90IGFuIG9iamVjdCBsaXRlcmFsIGV4cHJlc3Npb24gdGhlbiB3ZSBhcmUgbm90IGludGVyZXN0ZWRcbiAgICAgICAgaWYgKHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgICAgICAvLyBXZSBhcmUgb25seSBpbnRlcmVzdGVkIGluIG9iamVjdHMgb2YgdGhlIGZvcm06IGB7IHR5cGU6IERlY29yYXRvclR5cGUsIGFyZ3M6IFsuLi5dIH1gXG4gICAgICAgICAgY29uc3QgZGVjb3JhdG9yID0gcmVmbGVjdE9iamVjdExpdGVyYWwobm9kZSk7XG5cbiAgICAgICAgICAvLyBJcyB0aGUgdmFsdWUgb2YgdGhlIGB0eXBlYCBwcm9wZXJ0eSBhbiBpZGVudGlmaWVyP1xuICAgICAgICAgIGlmIChkZWNvcmF0b3IuaGFzKCd0eXBlJykpIHtcbiAgICAgICAgICAgIGxldCBkZWNvcmF0b3JUeXBlID0gZGVjb3JhdG9yLmdldCgndHlwZScpITtcbiAgICAgICAgICAgIGlmIChpc0RlY29yYXRvcklkZW50aWZpZXIoZGVjb3JhdG9yVHlwZSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9ySWRlbnRpZmllciA9XG4gICAgICAgICAgICAgICAgICB0cy5pc0lkZW50aWZpZXIoZGVjb3JhdG9yVHlwZSkgPyBkZWNvcmF0b3JUeXBlIDogZGVjb3JhdG9yVHlwZS5uYW1lO1xuICAgICAgICAgICAgICBkZWNvcmF0b3JzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IGRlY29yYXRvcklkZW50aWZpZXIudGV4dCxcbiAgICAgICAgICAgICAgICBpZGVudGlmaWVyOiBkZWNvcmF0b3JUeXBlLFxuICAgICAgICAgICAgICAgIGltcG9ydDogdGhpcy5nZXRJbXBvcnRPZklkZW50aWZpZXIoZGVjb3JhdG9ySWRlbnRpZmllciksXG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgICBhcmdzOiBnZXREZWNvcmF0b3JBcmdzKG5vZGUpLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZGVjb3JhdG9ycztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWZsZWN0IG92ZXIgYSBzeW1ib2wgYW5kIGV4dHJhY3QgdGhlIG1lbWJlciBpbmZvcm1hdGlvbiwgY29tYmluaW5nIGl0IHdpdGggdGhlXG4gICAqIHByb3ZpZGVkIGRlY29yYXRvciBpbmZvcm1hdGlvbiwgYW5kIHdoZXRoZXIgaXQgaXMgYSBzdGF0aWMgbWVtYmVyLlxuICAgKlxuICAgKiBBIHNpbmdsZSBzeW1ib2wgbWF5IHJlcHJlc2VudCBtdWx0aXBsZSBjbGFzcyBtZW1iZXJzIGluIHRoZSBjYXNlIG9mIGFjY2Vzc29ycztcbiAgICogYW4gZXF1YWxseSBuYW1lZCBnZXR0ZXIvc2V0dGVyIGFjY2Vzc29yIHBhaXIgaXMgY29tYmluZWQgaW50byBhIHNpbmdsZSBzeW1ib2wuXG4gICAqIFdoZW4gdGhlIHN5bWJvbCBpcyByZWNvZ25pemVkIGFzIHJlcHJlc2VudGluZyBhbiBhY2Nlc3NvciwgaXRzIGRlY2xhcmF0aW9ucyBhcmVcbiAgICogYW5hbHl6ZWQgc3VjaCB0aGF0IGJvdGggdGhlIHNldHRlciBhbmQgZ2V0dGVyIGFjY2Vzc29yIGFyZSByZXR1cm5lZCBhcyBzZXBhcmF0ZVxuICAgKiBjbGFzcyBtZW1iZXJzLlxuICAgKlxuICAgKiBPbmUgZGlmZmVyZW5jZSB3cnQgdGhlIFR5cGVTY3JpcHQgaG9zdCBpcyB0aGF0IGluIEVTMjAxNSwgd2UgY2Fubm90IHNlZSB3aGljaFxuICAgKiBhY2Nlc3NvciBvcmlnaW5hbGx5IGhhZCBhbnkgZGVjb3JhdG9ycyBhcHBsaWVkIHRvIHRoZW0sIGFzIGRlY29yYXRvcnMgYXJlIGFwcGxpZWRcbiAgICogdG8gdGhlIHByb3BlcnR5IGRlc2NyaXB0b3IgaW4gZ2VuZXJhbCwgbm90IGEgc3BlY2lmaWMgYWNjZXNzb3IuIElmIGFuIGFjY2Vzc29yXG4gICAqIGhhcyBib3RoIGEgc2V0dGVyIGFuZCBnZXR0ZXIsIGFueSBkZWNvcmF0b3JzIGFyZSBvbmx5IGF0dGFjaGVkIHRvIHRoZSBzZXR0ZXIgbWVtYmVyLlxuICAgKlxuICAgKiBAcGFyYW0gc3ltYm9sIHRoZSBzeW1ib2wgZm9yIHRoZSBtZW1iZXIgdG8gcmVmbGVjdCBvdmVyLlxuICAgKiBAcGFyYW0gZGVjb3JhdG9ycyBhbiBhcnJheSBvZiBkZWNvcmF0b3JzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVtYmVyLlxuICAgKiBAcGFyYW0gaXNTdGF0aWMgdHJ1ZSBpZiB0aGlzIG1lbWJlciBpcyBzdGF0aWMsIGZhbHNlIGlmIGl0IGlzIGFuIGluc3RhbmNlIHByb3BlcnR5LlxuICAgKiBAcmV0dXJucyB0aGUgcmVmbGVjdGVkIG1lbWJlciBpbmZvcm1hdGlvbiwgb3IgbnVsbCBpZiB0aGUgc3ltYm9sIGlzIG5vdCBhIG1lbWJlci5cbiAgICovXG4gIHByb3RlY3RlZCByZWZsZWN0TWVtYmVycyhzeW1ib2w6IHRzLlN5bWJvbCwgZGVjb3JhdG9ycz86IERlY29yYXRvcltdLCBpc1N0YXRpYz86IGJvb2xlYW4pOlxuICAgICAgQ2xhc3NNZW1iZXJbXXxudWxsIHtcbiAgICBpZiAoc3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWNjZXNzb3IpIHtcbiAgICAgIGNvbnN0IG1lbWJlcnM6IENsYXNzTWVtYmVyW10gPSBbXTtcbiAgICAgIGNvbnN0IHNldHRlciA9IHN5bWJvbC5kZWNsYXJhdGlvbnMgJiYgc3ltYm9sLmRlY2xhcmF0aW9ucy5maW5kKHRzLmlzU2V0QWNjZXNzb3IpO1xuICAgICAgY29uc3QgZ2V0dGVyID0gc3ltYm9sLmRlY2xhcmF0aW9ucyAmJiBzeW1ib2wuZGVjbGFyYXRpb25zLmZpbmQodHMuaXNHZXRBY2Nlc3Nvcik7XG5cbiAgICAgIGNvbnN0IHNldHRlck1lbWJlciA9XG4gICAgICAgICAgc2V0dGVyICYmIHRoaXMucmVmbGVjdE1lbWJlcihzZXR0ZXIsIENsYXNzTWVtYmVyS2luZC5TZXR0ZXIsIGRlY29yYXRvcnMsIGlzU3RhdGljKTtcbiAgICAgIGlmIChzZXR0ZXJNZW1iZXIpIHtcbiAgICAgICAgbWVtYmVycy5wdXNoKHNldHRlck1lbWJlcik7XG5cbiAgICAgICAgLy8gUHJldmVudCBhdHRhY2hpbmcgdGhlIGRlY29yYXRvcnMgdG8gYSBwb3RlbnRpYWwgZ2V0dGVyLiBJbiBFUzIwMTUsIHdlIGNhbid0IHRlbGwgd2hlcmVcbiAgICAgICAgLy8gdGhlIGRlY29yYXRvcnMgd2VyZSBvcmlnaW5hbGx5IGF0dGFjaGVkIHRvLCBob3dldmVyIHdlIG9ubHkgd2FudCB0byBhdHRhY2ggdGhlbSB0byBhXG4gICAgICAgIC8vIHNpbmdsZSBgQ2xhc3NNZW1iZXJgIGFzIG90aGVyd2lzZSBuZ3RzYyB3b3VsZCBoYW5kbGUgdGhlIHNhbWUgZGVjb3JhdG9ycyB0d2ljZS5cbiAgICAgICAgZGVjb3JhdG9ycyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZ2V0dGVyTWVtYmVyID1cbiAgICAgICAgICBnZXR0ZXIgJiYgdGhpcy5yZWZsZWN0TWVtYmVyKGdldHRlciwgQ2xhc3NNZW1iZXJLaW5kLkdldHRlciwgZGVjb3JhdG9ycywgaXNTdGF0aWMpO1xuICAgICAgaWYgKGdldHRlck1lbWJlcikge1xuICAgICAgICBtZW1iZXJzLnB1c2goZ2V0dGVyTWVtYmVyKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1lbWJlcnM7XG4gICAgfVxuXG4gICAgbGV0IGtpbmQ6IENsYXNzTWVtYmVyS2luZHxudWxsID0gbnVsbDtcbiAgICBpZiAoc3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuTWV0aG9kKSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLk1ldGhvZDtcbiAgICB9IGVsc2UgaWYgKHN5bWJvbC5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLlByb3BlcnR5KSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLlByb3BlcnR5O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGUgPSBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbiB8fCBzeW1ib2wuZGVjbGFyYXRpb25zICYmIHN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gICAgaWYgKCFub2RlKSB7XG4gICAgICAvLyBJZiB0aGUgc3ltYm9sIGhhcyBiZWVuIGltcG9ydGVkIGZyb20gYSBUeXBlU2NyaXB0IHR5cGluZ3MgZmlsZSB0aGVuIHRoZSBjb21waWxlclxuICAgICAgLy8gbWF5IHBhc3MgdGhlIGBwcm90b3R5cGVgIHN5bWJvbCBhcyBhbiBleHBvcnQgb2YgdGhlIGNsYXNzLlxuICAgICAgLy8gQnV0IHRoaXMgaGFzIG5vIGRlY2xhcmF0aW9uLiBJbiB0aGlzIGNhc2Ugd2UganVzdCBxdWlldGx5IGlnbm9yZSBpdC5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlciA9IHRoaXMucmVmbGVjdE1lbWJlcihub2RlLCBraW5kLCBkZWNvcmF0b3JzLCBpc1N0YXRpYyk7XG4gICAgaWYgKCFtZW1iZXIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBbbWVtYmVyXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWZsZWN0IG92ZXIgYSBzeW1ib2wgYW5kIGV4dHJhY3QgdGhlIG1lbWJlciBpbmZvcm1hdGlvbiwgY29tYmluaW5nIGl0IHdpdGggdGhlXG4gICAqIHByb3ZpZGVkIGRlY29yYXRvciBpbmZvcm1hdGlvbiwgYW5kIHdoZXRoZXIgaXQgaXMgYSBzdGF0aWMgbWVtYmVyLlxuICAgKiBAcGFyYW0gbm9kZSB0aGUgZGVjbGFyYXRpb24gbm9kZSBmb3IgdGhlIG1lbWJlciB0byByZWZsZWN0IG92ZXIuXG4gICAqIEBwYXJhbSBraW5kIHRoZSBhc3N1bWVkIGtpbmQgb2YgdGhlIG1lbWJlciwgbWF5IGJlY29tZSBtb3JlIGFjY3VyYXRlIGR1cmluZyByZWZsZWN0aW9uLlxuICAgKiBAcGFyYW0gZGVjb3JhdG9ycyBhbiBhcnJheSBvZiBkZWNvcmF0b3JzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVtYmVyLlxuICAgKiBAcGFyYW0gaXNTdGF0aWMgdHJ1ZSBpZiB0aGlzIG1lbWJlciBpcyBzdGF0aWMsIGZhbHNlIGlmIGl0IGlzIGFuIGluc3RhbmNlIHByb3BlcnR5LlxuICAgKiBAcmV0dXJucyB0aGUgcmVmbGVjdGVkIG1lbWJlciBpbmZvcm1hdGlvbiwgb3IgbnVsbCBpZiB0aGUgc3ltYm9sIGlzIG5vdCBhIG1lbWJlci5cbiAgICovXG4gIHByb3RlY3RlZCByZWZsZWN0TWVtYmVyKFxuICAgICAgbm9kZTogdHMuRGVjbGFyYXRpb24sIGtpbmQ6IENsYXNzTWVtYmVyS2luZHxudWxsLCBkZWNvcmF0b3JzPzogRGVjb3JhdG9yW10sXG4gICAgICBpc1N0YXRpYz86IGJvb2xlYW4pOiBDbGFzc01lbWJlcnxudWxsIHtcbiAgICBsZXQgdmFsdWU6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgbmFtZU5vZGU6IHRzLklkZW50aWZpZXJ8bnVsbCA9IG51bGw7XG5cbiAgICBpZiAoIWlzQ2xhc3NNZW1iZXJUeXBlKG5vZGUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoaXNTdGF0aWMgJiYgaXNQcm9wZXJ0eUFjY2Vzcyhub2RlKSkge1xuICAgICAgbmFtZSA9IG5vZGUubmFtZS50ZXh0O1xuICAgICAgdmFsdWUgPSBraW5kID09PSBDbGFzc01lbWJlcktpbmQuUHJvcGVydHkgPyBub2RlLnBhcmVudC5yaWdodCA6IG51bGw7XG4gICAgfSBlbHNlIGlmIChpc1RoaXNBc3NpZ25tZW50KG5vZGUpKSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLlByb3BlcnR5O1xuICAgICAgbmFtZSA9IG5vZGUubGVmdC5uYW1lLnRleHQ7XG4gICAgICB2YWx1ZSA9IG5vZGUucmlnaHQ7XG4gICAgICBpc1N0YXRpYyA9IGZhbHNlO1xuICAgIH0gZWxzZSBpZiAodHMuaXNDb25zdHJ1Y3RvckRlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLkNvbnN0cnVjdG9yO1xuICAgICAgbmFtZSA9ICdjb25zdHJ1Y3Rvcic7XG4gICAgICBpc1N0YXRpYyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChraW5kID09PSBudWxsKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKGBVbmtub3duIG1lbWJlciB0eXBlOiBcIiR7bm9kZS5nZXRUZXh0KCl9YCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIW5hbWUpIHtcbiAgICAgIGlmIChpc05hbWVkRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgICAgbmFtZSA9IG5vZGUubmFtZS50ZXh0O1xuICAgICAgICBuYW1lTm9kZSA9IG5vZGUubmFtZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlIGhhdmUgc3RpbGwgbm90IGRldGVybWluZWQgaWYgdGhpcyBpcyBhIHN0YXRpYyBvciBpbnN0YW5jZSBtZW1iZXIgdGhlblxuICAgIC8vIGxvb2sgZm9yIHRoZSBgc3RhdGljYCBrZXl3b3JkIG9uIHRoZSBkZWNsYXJhdGlvblxuICAgIGlmIChpc1N0YXRpYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpc1N0YXRpYyA9IG5vZGUubW9kaWZpZXJzICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICBub2RlLm1vZGlmaWVycy5zb21lKG1vZCA9PiBtb2Qua2luZCA9PT0gdHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlOiB0cy5UeXBlTm9kZSA9IChub2RlIGFzIGFueSkudHlwZSB8fCBudWxsO1xuICAgIHJldHVybiB7XG4gICAgICBub2RlLFxuICAgICAgaW1wbGVtZW50YXRpb246IG5vZGUsXG4gICAgICBraW5kLFxuICAgICAgdHlwZSxcbiAgICAgIG5hbWUsXG4gICAgICBuYW1lTm9kZSxcbiAgICAgIHZhbHVlLFxuICAgICAgaXNTdGF0aWMsXG4gICAgICBkZWNvcmF0b3JzOiBkZWNvcmF0b3JzIHx8IFtdXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBkZWNsYXJhdGlvbnMgb2YgdGhlIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMgb2YgYSBjbGFzcyBpZGVudGlmaWVkIGJ5IGl0cyBzeW1ib2wuXG4gICAqIEBwYXJhbSBjbGFzc1N5bWJvbCB0aGUgY2xhc3Mgd2hvc2UgcGFyYW1ldGVycyB3ZSB3YW50IHRvIGZpbmQuXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIGB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbmAgb2JqZWN0cyByZXByZXNlbnRpbmcgZWFjaCBvZiB0aGUgcGFyYW1ldGVycyBpblxuICAgKiB0aGUgY2xhc3MncyBjb25zdHJ1Y3RvciBvciBudWxsIGlmIHRoZXJlIGlzIG5vIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldENvbnN0cnVjdG9yUGFyYW1ldGVyRGVjbGFyYXRpb25zKGNsYXNzU3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2wpOlxuICAgICAgdHMuUGFyYW1ldGVyRGVjbGFyYXRpb25bXXxudWxsIHtcbiAgICBjb25zdCBtZW1iZXJzID0gY2xhc3NTeW1ib2wuaW1wbGVtZW50YXRpb24ubWVtYmVycztcbiAgICBpZiAobWVtYmVycyAmJiBtZW1iZXJzLmhhcyhDT05TVFJVQ1RPUikpIHtcbiAgICAgIGNvbnN0IGNvbnN0cnVjdG9yU3ltYm9sID0gbWVtYmVycy5nZXQoQ09OU1RSVUNUT1IpITtcbiAgICAgIC8vIEZvciBzb21lIHJlYXNvbiB0aGUgY29uc3RydWN0b3IgZG9lcyBub3QgaGF2ZSBhIGB2YWx1ZURlY2xhcmF0aW9uYCA/IT9cbiAgICAgIGNvbnN0IGNvbnN0cnVjdG9yID0gY29uc3RydWN0b3JTeW1ib2wuZGVjbGFyYXRpb25zICYmXG4gICAgICAgICAgY29uc3RydWN0b3JTeW1ib2wuZGVjbGFyYXRpb25zWzBdIGFzIHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb24gfCB1bmRlZmluZWQ7XG4gICAgICBpZiAoIWNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25zdHJ1Y3Rvci5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20oY29uc3RydWN0b3IucGFyYW1ldGVycyk7XG4gICAgICB9XG4gICAgICBpZiAoaXNTeW50aGVzaXplZENvbnN0cnVjdG9yKGNvbnN0cnVjdG9yKSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBwYXJhbWV0ZXIgZGVjb3JhdG9ycyBvZiBhIGNsYXNzIGNvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBAcGFyYW0gY2xhc3NTeW1ib2wgdGhlIGNsYXNzIHdob3NlIHBhcmFtZXRlciBpbmZvIHdlIHdhbnQgdG8gZ2V0LlxuICAgKiBAcGFyYW0gcGFyYW1ldGVyTm9kZXMgdGhlIGFycmF5IG9mIFR5cGVTY3JpcHQgcGFyYW1ldGVyIG5vZGVzIGZvciB0aGlzIGNsYXNzJ3MgY29uc3RydWN0b3IuXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIGNvbnN0cnVjdG9yIHBhcmFtZXRlciBpbmZvIG9iamVjdHMuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0Q29uc3RydWN0b3JQYXJhbUluZm8oXG4gICAgICBjbGFzc1N5bWJvbDogTmdjY0NsYXNzU3ltYm9sLCBwYXJhbWV0ZXJOb2RlczogdHMuUGFyYW1ldGVyRGVjbGFyYXRpb25bXSk6IEN0b3JQYXJhbWV0ZXJbXSB7XG4gICAgY29uc3Qge2NvbnN0cnVjdG9yUGFyYW1JbmZvfSA9IHRoaXMuYWNxdWlyZURlY29yYXRvckluZm8oY2xhc3NTeW1ib2wpO1xuXG4gICAgcmV0dXJuIHBhcmFtZXRlck5vZGVzLm1hcCgobm9kZSwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHtkZWNvcmF0b3JzLCB0eXBlRXhwcmVzc2lvbn0gPSBjb25zdHJ1Y3RvclBhcmFtSW5mb1tpbmRleF0gP1xuICAgICAgICAgIGNvbnN0cnVjdG9yUGFyYW1JbmZvW2luZGV4XSA6XG4gICAgICAgICAge2RlY29yYXRvcnM6IG51bGwsIHR5cGVFeHByZXNzaW9uOiBudWxsfTtcbiAgICAgIGNvbnN0IG5hbWVOb2RlID0gbm9kZS5uYW1lO1xuICAgICAgY29uc3QgdHlwZVZhbHVlUmVmZXJlbmNlID0gdGhpcy50eXBlVG9WYWx1ZSh0eXBlRXhwcmVzc2lvbik7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IGdldE5hbWVUZXh0KG5hbWVOb2RlKSxcbiAgICAgICAgbmFtZU5vZGUsXG4gICAgICAgIHR5cGVWYWx1ZVJlZmVyZW5jZSxcbiAgICAgICAgdHlwZU5vZGU6IG51bGwsXG4gICAgICAgIGRlY29yYXRvcnNcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcHV0ZSB0aGUgYFR5cGVWYWx1ZVJlZmVyZW5jZWAgZm9yIHRoZSBnaXZlbiBgdHlwZUV4cHJlc3Npb25gLlxuICAgKlxuICAgKiBBbHRob3VnaCBgdHlwZUV4cHJlc3Npb25gIGlzIGEgdmFsaWQgYHRzLkV4cHJlc3Npb25gIHRoYXQgY291bGQgYmUgZW1pdHRlZCBkaXJlY3RseSBpbnRvIHRoZVxuICAgKiBnZW5lcmF0ZWQgY29kZSwgbmdjYyBzdGlsbCBuZWVkcyB0byByZXNvbHZlIHRoZSBkZWNsYXJhdGlvbiBhbmQgY3JlYXRlIGFuIGBJTVBPUlRFRGAgdHlwZVxuICAgKiB2YWx1ZSByZWZlcmVuY2UgYXMgdGhlIGNvbXBpbGVyIGhhcyBzcGVjaWFsaXplZCBoYW5kbGluZyBmb3Igc29tZSBzeW1ib2xzLCBmb3IgZXhhbXBsZVxuICAgKiBgQ2hhbmdlRGV0ZWN0b3JSZWZgIGZyb20gYEBhbmd1bGFyL2NvcmVgLiBTdWNoIGFuIGBJTVBPUlRFRGAgdHlwZSB2YWx1ZSByZWZlcmVuY2Ugd2lsbCByZXN1bHRcbiAgICogaW4gYSBuZXdseSBnZW5lcmF0ZWQgbmFtZXNwYWNlIGltcG9ydCwgaW5zdGVhZCBvZiBlbWl0dGluZyB0aGUgb3JpZ2luYWwgYHR5cGVFeHByZXNzaW9uYCBhcyBpcy5cbiAgICovXG4gIHByaXZhdGUgdHlwZVRvVmFsdWUodHlwZUV4cHJlc3Npb246IHRzLkV4cHJlc3Npb258bnVsbCk6IFR5cGVWYWx1ZVJlZmVyZW5jZSB7XG4gICAgaWYgKHR5cGVFeHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLlVOQVZBSUxBQkxFLFxuICAgICAgICByZWFzb246IHtraW5kOiBWYWx1ZVVuYXZhaWxhYmxlS2luZC5NSVNTSU5HX1RZUEV9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXAgPSB0aGlzLmdldEltcG9ydE9mRXhwcmVzc2lvbih0eXBlRXhwcmVzc2lvbik7XG4gICAgY29uc3QgZGVjbCA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZkV4cHJlc3Npb24odHlwZUV4cHJlc3Npb24pO1xuICAgIGlmIChpbXAgPT09IG51bGwgfHwgZGVjbCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogVHlwZVZhbHVlUmVmZXJlbmNlS2luZC5MT0NBTCxcbiAgICAgICAgZXhwcmVzc2lvbjogdHlwZUV4cHJlc3Npb24sXG4gICAgICAgIGRlZmF1bHRJbXBvcnRTdGF0ZW1lbnQ6IG51bGwsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBraW5kOiBUeXBlVmFsdWVSZWZlcmVuY2VLaW5kLklNUE9SVEVELFxuICAgICAgdmFsdWVEZWNsYXJhdGlvbjogZGVjbC5ub2RlLFxuICAgICAgbW9kdWxlTmFtZTogaW1wLmZyb20sXG4gICAgICBpbXBvcnRlZE5hbWU6IGltcC5uYW1lLFxuICAgICAgbmVzdGVkUGF0aDogbnVsbCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgd2hlcmUgdGhlIGBleHByZXNzaW9uYCBpcyBpbXBvcnRlZCBmcm9tLlxuICAgKlxuICAgKiBAcGFyYW0gZXhwcmVzc2lvbiB0aGUgZXhwcmVzc2lvbiB0byBkZXRlcm1pbmUgdGhlIGltcG9ydCBkZXRhaWxzIGZvci5cbiAgICogQHJldHVybnMgdGhlIGBJbXBvcnRgIGZvciB0aGUgZXhwcmVzc2lvbiwgb3IgYG51bGxgIGlmIHRoZSBleHByZXNzaW9uIGlzIG5vdCBpbXBvcnRlZCBvciB0aGVcbiAgICogZXhwcmVzc2lvbiBzeW50YXggaXMgbm90IHN1cHBvcnRlZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SW1wb3J0T2ZFeHByZXNzaW9uKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiBJbXBvcnR8bnVsbCB7XG4gICAgaWYgKHRzLmlzSWRlbnRpZmllcihleHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0SW1wb3J0T2ZJZGVudGlmaWVyKGV4cHJlc3Npb24pO1xuICAgIH0gZWxzZSBpZiAodHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24oZXhwcmVzc2lvbikgJiYgdHMuaXNJZGVudGlmaWVyKGV4cHJlc3Npb24ubmFtZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldEltcG9ydE9mSWRlbnRpZmllcihleHByZXNzaW9uLm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBwYXJhbWV0ZXIgdHlwZSBhbmQgZGVjb3JhdG9ycyBmb3IgdGhlIGNvbnN0cnVjdG9yIG9mIGEgY2xhc3MsXG4gICAqIHdoZXJlIHRoZSBpbmZvcm1hdGlvbiBpcyBzdG9yZWQgb24gYSBzdGF0aWMgcHJvcGVydHkgb2YgdGhlIGNsYXNzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgaW4gRVNNMjAxNSwgdGhlIHByb3BlcnR5IGlzIGRlZmluZWQgYW4gYXJyYXksIG9yIGJ5IGFuIGFycm93IGZ1bmN0aW9uIHRoYXQgcmV0dXJuc1xuICAgKiBhbiBhcnJheSwgb2YgZGVjb3JhdG9yIGFuZCB0eXBlIGluZm9ybWF0aW9uLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICpcbiAgICogYGBgXG4gICAqIFNvbWVEaXJlY3RpdmUuY3RvclBhcmFtZXRlcnMgPSAoKSA9PiBbXG4gICAqICAge3R5cGU6IFZpZXdDb250YWluZXJSZWZ9LFxuICAgKiAgIHt0eXBlOiBUZW1wbGF0ZVJlZn0sXG4gICAqICAge3R5cGU6IHVuZGVmaW5lZCwgZGVjb3JhdG9yczogW3sgdHlwZTogSW5qZWN0LCBhcmdzOiBbSU5KRUNURURfVE9LRU5dfV19LFxuICAgKiBdO1xuICAgKiBgYGBcbiAgICpcbiAgICogb3JcbiAgICpcbiAgICogYGBgXG4gICAqIFNvbWVEaXJlY3RpdmUuY3RvclBhcmFtZXRlcnMgPSBbXG4gICAqICAge3R5cGU6IFZpZXdDb250YWluZXJSZWZ9LFxuICAgKiAgIHt0eXBlOiBUZW1wbGF0ZVJlZn0sXG4gICAqICAge3R5cGU6IHVuZGVmaW5lZCwgZGVjb3JhdG9yczogW3t0eXBlOiBJbmplY3QsIGFyZ3M6IFtJTkpFQ1RFRF9UT0tFTl19XX0sXG4gICAqIF07XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gcGFyYW1EZWNvcmF0b3JzUHJvcGVydHkgdGhlIHByb3BlcnR5IHRoYXQgaG9sZHMgdGhlIHBhcmFtZXRlciBpbmZvIHdlIHdhbnQgdG8gZ2V0LlxuICAgKiBAcmV0dXJucyBhbiBhcnJheSBvZiBvYmplY3RzIGNvbnRhaW5pbmcgdGhlIHR5cGUgYW5kIGRlY29yYXRvcnMgZm9yIGVhY2ggcGFyYW1ldGVyLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldFBhcmFtSW5mb0Zyb21TdGF0aWNQcm9wZXJ0eShwYXJhbURlY29yYXRvcnNQcm9wZXJ0eTogdHMuU3ltYm9sKTogUGFyYW1JbmZvW118bnVsbCB7XG4gICAgY29uc3QgcGFyYW1EZWNvcmF0b3JzID0gZ2V0UHJvcGVydHlWYWx1ZUZyb21TeW1ib2wocGFyYW1EZWNvcmF0b3JzUHJvcGVydHkpO1xuICAgIGlmIChwYXJhbURlY29yYXRvcnMpIHtcbiAgICAgIC8vIFRoZSBkZWNvcmF0b3JzIGFycmF5IG1heSBiZSB3cmFwcGVkIGluIGFuIGFycm93IGZ1bmN0aW9uLiBJZiBzbyB1bndyYXAgaXQuXG4gICAgICBjb25zdCBjb250YWluZXIgPVxuICAgICAgICAgIHRzLmlzQXJyb3dGdW5jdGlvbihwYXJhbURlY29yYXRvcnMpID8gcGFyYW1EZWNvcmF0b3JzLmJvZHkgOiBwYXJhbURlY29yYXRvcnM7XG4gICAgICBpZiAodHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKGNvbnRhaW5lcikpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudHMgPSBjb250YWluZXIuZWxlbWVudHM7XG4gICAgICAgIHJldHVybiBlbGVtZW50c1xuICAgICAgICAgICAgLm1hcChcbiAgICAgICAgICAgICAgICBlbGVtZW50ID0+XG4gICAgICAgICAgICAgICAgICAgIHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24oZWxlbWVudCkgPyByZWZsZWN0T2JqZWN0TGl0ZXJhbChlbGVtZW50KSA6IG51bGwpXG4gICAgICAgICAgICAubWFwKHBhcmFtSW5mbyA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHR5cGVFeHByZXNzaW9uID1cbiAgICAgICAgICAgICAgICAgIHBhcmFtSW5mbyAmJiBwYXJhbUluZm8uaGFzKCd0eXBlJykgPyBwYXJhbUluZm8uZ2V0KCd0eXBlJykhIDogbnVsbDtcbiAgICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9ySW5mbyA9XG4gICAgICAgICAgICAgICAgICBwYXJhbUluZm8gJiYgcGFyYW1JbmZvLmhhcygnZGVjb3JhdG9ycycpID8gcGFyYW1JbmZvLmdldCgnZGVjb3JhdG9ycycpISA6IG51bGw7XG4gICAgICAgICAgICAgIGNvbnN0IGRlY29yYXRvcnMgPSBkZWNvcmF0b3JJbmZvICYmXG4gICAgICAgICAgICAgICAgICB0aGlzLnJlZmxlY3REZWNvcmF0b3JzKGRlY29yYXRvckluZm8pXG4gICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkZWNvcmF0b3IgPT4gdGhpcy5pc0Zyb21Db3JlKGRlY29yYXRvcikpO1xuICAgICAgICAgICAgICByZXR1cm4ge3R5cGVFeHByZXNzaW9uLCBkZWNvcmF0b3JzfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChwYXJhbURlY29yYXRvcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmxvZ2dlci53YXJuKFxuICAgICAgICAgICAgJ0ludmFsaWQgY29uc3RydWN0b3IgcGFyYW1ldGVyIGRlY29yYXRvciBpbiAnICtcbiAgICAgICAgICAgICAgICBwYXJhbURlY29yYXRvcnMuZ2V0U291cmNlRmlsZSgpLmZpbGVOYW1lICsgJzpcXG4nLFxuICAgICAgICAgICAgcGFyYW1EZWNvcmF0b3JzLmdldFRleHQoKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlYXJjaCBzdGF0ZW1lbnRzIHJlbGF0ZWQgdG8gdGhlIGdpdmVuIGNsYXNzIGZvciBjYWxscyB0byB0aGUgc3BlY2lmaWVkIGhlbHBlci5cbiAgICogQHBhcmFtIGNsYXNzU3ltYm9sIHRoZSBjbGFzcyB3aG9zZSBoZWxwZXIgY2FsbHMgd2UgYXJlIGludGVyZXN0ZWQgaW4uXG4gICAqIEBwYXJhbSBoZWxwZXJOYW1lcyB0aGUgbmFtZXMgb2YgdGhlIGhlbHBlcnMgKGUuZy4gYF9fZGVjb3JhdGVgKSB3aG9zZSBjYWxscyB3ZSBhcmUgaW50ZXJlc3RlZFxuICAgKiBpbi5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2YgQ2FsbEV4cHJlc3Npb24gbm9kZXMgZm9yIGVhY2ggbWF0Y2hpbmcgaGVscGVyIGNhbGwuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0SGVscGVyQ2FsbHNGb3JDbGFzcyhjbGFzc1N5bWJvbDogTmdjY0NsYXNzU3ltYm9sLCBoZWxwZXJOYW1lczogc3RyaW5nW10pOlxuICAgICAgdHMuQ2FsbEV4cHJlc3Npb25bXSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0U3RhdGVtZW50c0ZvckNsYXNzKGNsYXNzU3ltYm9sKVxuICAgICAgICAubWFwKHN0YXRlbWVudCA9PiB0aGlzLmdldEhlbHBlckNhbGwoc3RhdGVtZW50LCBoZWxwZXJOYW1lcykpXG4gICAgICAgIC5maWx0ZXIoaXNEZWZpbmVkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIHN0YXRlbWVudHMgcmVsYXRlZCB0byB0aGUgZ2l2ZW4gY2xhc3MgdGhhdCBtYXkgY29udGFpbiBjYWxscyB0byBhIGhlbHBlci5cbiAgICpcbiAgICogSW4gRVNNMjAxNSBjb2RlIHRoZSBoZWxwZXIgY2FsbHMgYXJlIGluIHRoZSB0b3AgbGV2ZWwgbW9kdWxlLCBzbyB3ZSBoYXZlIHRvIGNvbnNpZGVyXG4gICAqIGFsbCB0aGUgc3RhdGVtZW50cyBpbiB0aGUgbW9kdWxlLlxuICAgKlxuICAgKiBAcGFyYW0gY2xhc3NTeW1ib2wgdGhlIGNsYXNzIHdob3NlIGhlbHBlciBjYWxscyB3ZSBhcmUgaW50ZXJlc3RlZCBpbi5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IG1heSBjb250YWluIGhlbHBlciBjYWxscy5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRTdGF0ZW1lbnRzRm9yQ2xhc3MoY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IHRzLlN0YXRlbWVudFtdIHtcbiAgICBjb25zdCBjbGFzc05vZGUgPSBjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICAgIGlmIChpc1RvcExldmVsKGNsYXNzTm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldE1vZHVsZVN0YXRlbWVudHMoY2xhc3NOb2RlLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgfVxuICAgIGNvbnN0IHN0YXRlbWVudCA9IGdldENvbnRhaW5pbmdTdGF0ZW1lbnQoY2xhc3NOb2RlKTtcbiAgICBpZiAodHMuaXNCbG9jayhzdGF0ZW1lbnQucGFyZW50KSkge1xuICAgICAgcmV0dXJuIEFycmF5LmZyb20oc3RhdGVtZW50LnBhcmVudC5zdGF0ZW1lbnRzKTtcbiAgICB9XG4gICAgLy8gV2Ugc2hvdWxkIG5ldmVyIGFycml2ZSBoZXJlXG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZmluZCBhZGphY2VudCBzdGF0ZW1lbnRzIGZvciAke2NsYXNzU3ltYm9sLm5hbWV9YCk7XG4gIH1cblxuICAvKipcbiAgICogVGVzdCB3aGV0aGVyIGEgZGVjb3JhdG9yIHdhcyBpbXBvcnRlZCBmcm9tIGBAYW5ndWxhci9jb3JlYC5cbiAgICpcbiAgICogSXMgdGhlIGRlY29yYXRvcjpcbiAgICogKiBleHRlcm5hbGx5IGltcG9ydGVkIGZyb20gYEBhbmd1bGFyL2NvcmVgP1xuICAgKiAqIHRoZSBjdXJyZW50IGhvc3RlZCBwcm9ncmFtIGlzIGFjdHVhbGx5IGBAYW5ndWxhci9jb3JlYCBhbmRcbiAgICogICAtIHJlbGF0aXZlbHkgaW50ZXJuYWxseSBpbXBvcnRlZDsgb3JcbiAgICogICAtIG5vdCBpbXBvcnRlZCwgZnJvbSB0aGUgY3VycmVudCBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjb3JhdG9yIHRoZSBkZWNvcmF0b3IgdG8gdGVzdC5cbiAgICovXG4gIHByb3RlY3RlZCBpc0Zyb21Db3JlKGRlY29yYXRvcjogRGVjb3JhdG9yKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaXNDb3JlKSB7XG4gICAgICByZXR1cm4gIWRlY29yYXRvci5pbXBvcnQgfHwgL15cXC4vLnRlc3QoZGVjb3JhdG9yLmltcG9ydC5mcm9tKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICEhZGVjb3JhdG9yLmltcG9ydCAmJiBkZWNvcmF0b3IuaW1wb3J0LmZyb20gPT09ICdAYW5ndWxhci9jb3JlJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbWFwcGluZyBiZXR3ZWVuIHRoZSBwdWJsaWMgZXhwb3J0cyBpbiBhIHNyYyBwcm9ncmFtIGFuZCB0aGUgcHVibGljIGV4cG9ydHMgb2YgYSBkdHNcbiAgICogcHJvZ3JhbS5cbiAgICpcbiAgICogQHBhcmFtIHNyYyB0aGUgcHJvZ3JhbSBidW5kbGUgY29udGFpbmluZyB0aGUgc291cmNlIGZpbGVzLlxuICAgKiBAcGFyYW0gZHRzIHRoZSBwcm9ncmFtIGJ1bmRsZSBjb250YWluaW5nIHRoZSB0eXBpbmdzIGZpbGVzLlxuICAgKiBAcmV0dXJucyBhIG1hcCBvZiBzb3VyY2UgZGVjbGFyYXRpb25zIHRvIHR5cGluZ3MgZGVjbGFyYXRpb25zLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNvbXB1dGVQdWJsaWNEdHNEZWNsYXJhdGlvbk1hcChzcmM6IEJ1bmRsZVByb2dyYW0sIGR0czogQnVuZGxlUHJvZ3JhbSk6XG4gICAgICBNYXA8RGVjbGFyYXRpb25Ob2RlLCB0cy5EZWNsYXJhdGlvbj4ge1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uTWFwID0gbmV3IE1hcDxEZWNsYXJhdGlvbk5vZGUsIHRzLkRlY2xhcmF0aW9uPigpO1xuICAgIGNvbnN0IGR0c0RlY2xhcmF0aW9uTWFwID0gbmV3IE1hcDxzdHJpbmcsIHRzLkRlY2xhcmF0aW9uPigpO1xuICAgIGNvbnN0IHJvb3REdHMgPSBnZXRSb290RmlsZU9yRmFpbChkdHMpO1xuICAgIHRoaXMuY29sbGVjdER0c0V4cG9ydGVkRGVjbGFyYXRpb25zKGR0c0RlY2xhcmF0aW9uTWFwLCByb290RHRzLCBkdHMucHJvZ3JhbS5nZXRUeXBlQ2hlY2tlcigpKTtcbiAgICBjb25zdCByb290U3JjID0gZ2V0Um9vdEZpbGVPckZhaWwoc3JjKTtcbiAgICB0aGlzLmNvbGxlY3RTcmNFeHBvcnRlZERlY2xhcmF0aW9ucyhkZWNsYXJhdGlvbk1hcCwgZHRzRGVjbGFyYXRpb25NYXAsIHJvb3RTcmMpO1xuICAgIHJldHVybiBkZWNsYXJhdGlvbk1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBtYXBwaW5nIGJldHdlZW4gdGhlIFwicHJpdmF0ZVwiIGV4cG9ydHMgaW4gYSBzcmMgcHJvZ3JhbSBhbmQgdGhlIFwicHJpdmF0ZVwiIGV4cG9ydHMgb2YgYVxuICAgKiBkdHMgcHJvZ3JhbS4gVGhlc2UgZXhwb3J0cyBtYXkgYmUgZXhwb3J0ZWQgZnJvbSBpbmRpdmlkdWFsIGZpbGVzIGluIHRoZSBzcmMgb3IgZHRzIHByb2dyYW1zLFxuICAgKiBidXQgbm90IGV4cG9ydGVkIGZyb20gdGhlIHJvb3QgZmlsZSAoaS5lIHB1YmxpY2x5IGZyb20gdGhlIGVudHJ5LXBvaW50KS5cbiAgICpcbiAgICogVGhpcyBtYXBwaW5nIGlzIGEgXCJiZXN0IGd1ZXNzXCIgc2luY2Ugd2UgY2Fubm90IGd1YXJhbnRlZSB0aGF0IHR3byBkZWNsYXJhdGlvbnMgdGhhdCBoYXBwZW4gdG9cbiAgICogYmUgZXhwb3J0ZWQgZnJvbSBhIGZpbGUgd2l0aCB0aGUgc2FtZSBuYW1lIGFyZSBhY3R1YWxseSBlcXVpdmFsZW50LiBCdXQgdGhpcyBpcyBhIHJlYXNvbmFibGVcbiAgICogZXN0aW1hdGUgZm9yIHRoZSBwdXJwb3NlcyBvZiBuZ2NjLlxuICAgKlxuICAgKiBAcGFyYW0gc3JjIHRoZSBwcm9ncmFtIGJ1bmRsZSBjb250YWluaW5nIHRoZSBzb3VyY2UgZmlsZXMuXG4gICAqIEBwYXJhbSBkdHMgdGhlIHByb2dyYW0gYnVuZGxlIGNvbnRhaW5pbmcgdGhlIHR5cGluZ3MgZmlsZXMuXG4gICAqIEByZXR1cm5zIGEgbWFwIG9mIHNvdXJjZSBkZWNsYXJhdGlvbnMgdG8gdHlwaW5ncyBkZWNsYXJhdGlvbnMuXG4gICAqL1xuICBwcm90ZWN0ZWQgY29tcHV0ZVByaXZhdGVEdHNEZWNsYXJhdGlvbk1hcChzcmM6IEJ1bmRsZVByb2dyYW0sIGR0czogQnVuZGxlUHJvZ3JhbSk6XG4gICAgICBNYXA8RGVjbGFyYXRpb25Ob2RlLCB0cy5EZWNsYXJhdGlvbj4ge1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uTWFwID0gbmV3IE1hcDxEZWNsYXJhdGlvbk5vZGUsIHRzLkRlY2xhcmF0aW9uPigpO1xuICAgIGNvbnN0IGR0c0RlY2xhcmF0aW9uTWFwID0gbmV3IE1hcDxzdHJpbmcsIHRzLkRlY2xhcmF0aW9uPigpO1xuICAgIGNvbnN0IHR5cGVDaGVja2VyID0gZHRzLnByb2dyYW0uZ2V0VHlwZUNoZWNrZXIoKTtcblxuICAgIGNvbnN0IGR0c0ZpbGVzID0gZ2V0Tm9uUm9vdFBhY2thZ2VGaWxlcyhkdHMpO1xuICAgIGZvciAoY29uc3QgZHRzRmlsZSBvZiBkdHNGaWxlcykge1xuICAgICAgdGhpcy5jb2xsZWN0RHRzRXhwb3J0ZWREZWNsYXJhdGlvbnMoZHRzRGVjbGFyYXRpb25NYXAsIGR0c0ZpbGUsIHR5cGVDaGVja2VyKTtcbiAgICB9XG5cbiAgICBjb25zdCBzcmNGaWxlcyA9IGdldE5vblJvb3RQYWNrYWdlRmlsZXMoc3JjKTtcbiAgICBmb3IgKGNvbnN0IHNyY0ZpbGUgb2Ygc3JjRmlsZXMpIHtcbiAgICAgIHRoaXMuY29sbGVjdFNyY0V4cG9ydGVkRGVjbGFyYXRpb25zKGRlY2xhcmF0aW9uTWFwLCBkdHNEZWNsYXJhdGlvbk1hcCwgc3JjRmlsZSk7XG4gICAgfVxuICAgIHJldHVybiBkZWNsYXJhdGlvbk1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb2xsZWN0IG1hcHBpbmdzIGJldHdlZW4gbmFtZXMgb2YgZXhwb3J0ZWQgZGVjbGFyYXRpb25zIGluIGEgZmlsZSBhbmQgaXRzIGFjdHVhbCBkZWNsYXJhdGlvbi5cbiAgICpcbiAgICogQW55IG5ldyBtYXBwaW5ncyBhcmUgYWRkZWQgdG8gdGhlIGBkdHNEZWNsYXJhdGlvbk1hcGAuXG4gICAqL1xuICBwcm90ZWN0ZWQgY29sbGVjdER0c0V4cG9ydGVkRGVjbGFyYXRpb25zKFxuICAgICAgZHRzRGVjbGFyYXRpb25NYXA6IE1hcDxzdHJpbmcsIHRzLkRlY2xhcmF0aW9uPiwgc3JjRmlsZTogdHMuU291cmNlRmlsZSxcbiAgICAgIGNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKTogdm9pZCB7XG4gICAgY29uc3Qgc3JjTW9kdWxlID0gc3JjRmlsZSAmJiBjaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oc3JjRmlsZSk7XG4gICAgY29uc3QgbW9kdWxlRXhwb3J0cyA9IHNyY01vZHVsZSAmJiBjaGVja2VyLmdldEV4cG9ydHNPZk1vZHVsZShzcmNNb2R1bGUpO1xuICAgIGlmIChtb2R1bGVFeHBvcnRzKSB7XG4gICAgICBtb2R1bGVFeHBvcnRzLmZvckVhY2goZXhwb3J0ZWRTeW1ib2wgPT4ge1xuICAgICAgICBjb25zdCBuYW1lID0gZXhwb3J0ZWRTeW1ib2wubmFtZTtcbiAgICAgICAgaWYgKGV4cG9ydGVkU3ltYm9sLmZsYWdzICYgdHMuU3ltYm9sRmxhZ3MuQWxpYXMpIHtcbiAgICAgICAgICBleHBvcnRlZFN5bWJvbCA9IGNoZWNrZXIuZ2V0QWxpYXNlZFN5bWJvbChleHBvcnRlZFN5bWJvbCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb24gPSBleHBvcnRlZFN5bWJvbC52YWx1ZURlY2xhcmF0aW9uO1xuICAgICAgICBpZiAoZGVjbGFyYXRpb24gJiYgIWR0c0RlY2xhcmF0aW9uTWFwLmhhcyhuYW1lKSkge1xuICAgICAgICAgIGR0c0RlY2xhcmF0aW9uTWFwLnNldChuYW1lLCBkZWNsYXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG5cbiAgcHJvdGVjdGVkIGNvbGxlY3RTcmNFeHBvcnRlZERlY2xhcmF0aW9ucyhcbiAgICAgIGRlY2xhcmF0aW9uTWFwOiBNYXA8RGVjbGFyYXRpb25Ob2RlLCB0cy5EZWNsYXJhdGlvbj4sXG4gICAgICBkdHNEZWNsYXJhdGlvbk1hcDogTWFwPHN0cmluZywgdHMuRGVjbGFyYXRpb24+LCBzcmNGaWxlOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgY29uc3QgZmlsZUV4cG9ydHMgPSB0aGlzLmdldEV4cG9ydHNPZk1vZHVsZShzcmNGaWxlKTtcbiAgICBpZiAoZmlsZUV4cG9ydHMgIT09IG51bGwpIHtcbiAgICAgIGZvciAoY29uc3QgW2V4cG9ydE5hbWUsIHtub2RlOiBkZWNsYXJhdGlvbk5vZGV9XSBvZiBmaWxlRXhwb3J0cykge1xuICAgICAgICBpZiAoZHRzRGVjbGFyYXRpb25NYXAuaGFzKGV4cG9ydE5hbWUpKSB7XG4gICAgICAgICAgZGVjbGFyYXRpb25NYXAuc2V0KGRlY2xhcmF0aW9uTm9kZSwgZHRzRGVjbGFyYXRpb25NYXAuZ2V0KGV4cG9ydE5hbWUpISk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0RGVjbGFyYXRpb25PZkV4cHJlc3Npb24oZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IERlY2xhcmF0aW9ufG51bGwge1xuICAgIGlmICh0cy5pc0lkZW50aWZpZXIoZXhwcmVzc2lvbikpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGV4cHJlc3Npb24pO1xuICAgIH1cblxuICAgIGlmICghdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24oZXhwcmVzc2lvbikgfHwgIXRzLmlzSWRlbnRpZmllcihleHByZXNzaW9uLmV4cHJlc3Npb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBuYW1lc3BhY2VEZWNsID0gdGhpcy5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihleHByZXNzaW9uLmV4cHJlc3Npb24pO1xuICAgIGlmICghbmFtZXNwYWNlRGVjbCB8fCAhdHMuaXNTb3VyY2VGaWxlKG5hbWVzcGFjZURlY2wubm9kZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG5hbWVzcGFjZUV4cG9ydHMgPSB0aGlzLmdldEV4cG9ydHNPZk1vZHVsZShuYW1lc3BhY2VEZWNsLm5vZGUpO1xuICAgIGlmIChuYW1lc3BhY2VFeHBvcnRzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIW5hbWVzcGFjZUV4cG9ydHMuaGFzKGV4cHJlc3Npb24ubmFtZS50ZXh0KSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwb3J0RGVjbCA9IG5hbWVzcGFjZUV4cG9ydHMuZ2V0KGV4cHJlc3Npb24ubmFtZS50ZXh0KSE7XG4gICAgcmV0dXJuIHsuLi5leHBvcnREZWNsLCB2aWFNb2R1bGU6IG5hbWVzcGFjZURlY2wudmlhTW9kdWxlfTtcbiAgfVxuXG4gIC8qKiBDaGVja3MgaWYgdGhlIHNwZWNpZmllZCBkZWNsYXJhdGlvbiByZXNvbHZlcyB0byB0aGUga25vd24gSmF2YVNjcmlwdCBnbG9iYWwgYE9iamVjdGAuICovXG4gIHByb3RlY3RlZCBpc0phdmFTY3JpcHRPYmplY3REZWNsYXJhdGlvbihkZWNsOiBEZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5vZGUgPSBkZWNsLm5vZGU7XG4gICAgLy8gVGhlIGRlZmF1bHQgVHlwZVNjcmlwdCBsaWJyYXJ5IHR5cGVzIHRoZSBnbG9iYWwgYE9iamVjdGAgdmFyaWFibGUgdGhyb3VnaFxuICAgIC8vIGEgdmFyaWFibGUgZGVjbGFyYXRpb24gd2l0aCBhIHR5cGUgcmVmZXJlbmNlIHJlc29sdmluZyB0byBgT2JqZWN0Q29uc3RydWN0b3JgLlxuICAgIGlmICghdHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGUpIHx8ICF0cy5pc0lkZW50aWZpZXIobm9kZS5uYW1lKSB8fFxuICAgICAgICBub2RlLm5hbWUudGV4dCAhPT0gJ09iamVjdCcgfHwgbm9kZS50eXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgdHlwZU5vZGUgPSBub2RlLnR5cGU7XG4gICAgLy8gSWYgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGRvZXMgbm90IGhhdmUgYSB0eXBlIHJlc29sdmluZyB0byBgT2JqZWN0Q29uc3RydWN0b3JgLFxuICAgIC8vIHdlIGNhbm5vdCBndWFyYW50ZWUgdGhhdCB0aGUgZGVjbGFyYXRpb24gcmVzb2x2ZXMgdG8gdGhlIGdsb2JhbCBgT2JqZWN0YCB2YXJpYWJsZS5cbiAgICBpZiAoIXRzLmlzVHlwZVJlZmVyZW5jZU5vZGUodHlwZU5vZGUpIHx8ICF0cy5pc0lkZW50aWZpZXIodHlwZU5vZGUudHlwZU5hbWUpIHx8XG4gICAgICAgIHR5cGVOb2RlLnR5cGVOYW1lLnRleHQgIT09ICdPYmplY3RDb25zdHJ1Y3RvcicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gRmluYWxseSwgY2hlY2sgaWYgdGhlIHR5cGUgZGVmaW5pdGlvbiBmb3IgYE9iamVjdGAgb3JpZ2luYXRlcyBmcm9tIGEgZGVmYXVsdCBsaWJyYXJ5XG4gICAgLy8gZGVmaW5pdGlvbiBmaWxlLiBUaGlzIHJlcXVpcmVzIGRlZmF1bHQgdHlwZXMgdG8gYmUgZW5hYmxlZCBmb3IgdGhlIGhvc3QgcHJvZ3JhbS5cbiAgICByZXR1cm4gdGhpcy5zcmMucHJvZ3JhbS5pc1NvdXJjZUZpbGVEZWZhdWx0TGlicmFyeShub2RlLmdldFNvdXJjZUZpbGUoKSk7XG4gIH1cblxuICAvKipcbiAgICogSW4gSmF2YVNjcmlwdCwgZW51bSBkZWNsYXJhdGlvbnMgYXJlIGVtaXR0ZWQgYXMgYSByZWd1bGFyIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGZvbGxvd2VkIGJ5IGFuXG4gICAqIElJRkUgaW4gd2hpY2ggdGhlIGVudW0gbWVtYmVycyBhcmUgYXNzaWduZWQuXG4gICAqXG4gICAqICAgZXhwb3J0IHZhciBFbnVtO1xuICAgKiAgIChmdW5jdGlvbiAoRW51bSkge1xuICAgKiAgICAgRW51bVtcImFcIl0gPSBcIkFcIjtcbiAgICogICAgIEVudW1bXCJiXCJdID0gXCJCXCI7XG4gICAqICAgfSkoRW51bSB8fCAoRW51bSA9IHt9KSk7XG4gICAqXG4gICAqIEBwYXJhbSBkZWNsYXJhdGlvbiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIHRoYXQgbWF5IHJlcHJlc2VudCBhbiBlbnVtXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIGVudW0gbWVtYmVycyBpZiB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gaXMgZm9sbG93ZWQgYnkgYW4gSUlGRSB0aGF0XG4gICAqIGRlY2xhcmVzIHRoZSBlbnVtIG1lbWJlcnMsIG9yIG51bGwgb3RoZXJ3aXNlLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlc29sdmVFbnVtTWVtYmVycyhkZWNsYXJhdGlvbjogdHMuVmFyaWFibGVEZWNsYXJhdGlvbik6IEVudW1NZW1iZXJbXXxudWxsIHtcbiAgICAvLyBJbml0aWFsaXplZCB2YXJpYWJsZXMgZG9uJ3QgcmVwcmVzZW50IGVudW0gZGVjbGFyYXRpb25zLlxuICAgIGlmIChkZWNsYXJhdGlvbi5pbml0aWFsaXplciAhPT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHZhcmlhYmxlU3RtdCA9IGRlY2xhcmF0aW9uLnBhcmVudC5wYXJlbnQ7XG4gICAgaWYgKCF0cy5pc1ZhcmlhYmxlU3RhdGVtZW50KHZhcmlhYmxlU3RtdCkpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgYmxvY2sgPSB2YXJpYWJsZVN0bXQucGFyZW50O1xuICAgIGlmICghdHMuaXNCbG9jayhibG9jaykgJiYgIXRzLmlzU291cmNlRmlsZShibG9jaykpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZGVjbGFyYXRpb25JbmRleCA9IGJsb2NrLnN0YXRlbWVudHMuZmluZEluZGV4KHN0YXRlbWVudCA9PiBzdGF0ZW1lbnQgPT09IHZhcmlhYmxlU3RtdCk7XG4gICAgaWYgKGRlY2xhcmF0aW9uSW5kZXggPT09IC0xIHx8IGRlY2xhcmF0aW9uSW5kZXggPT09IGJsb2NrLnN0YXRlbWVudHMubGVuZ3RoIC0gMSkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBzdWJzZXF1ZW50U3RtdCA9IGJsb2NrLnN0YXRlbWVudHNbZGVjbGFyYXRpb25JbmRleCArIDFdO1xuICAgIGlmICghdHMuaXNFeHByZXNzaW9uU3RhdGVtZW50KHN1YnNlcXVlbnRTdG10KSkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBpaWZlID0gc3RyaXBQYXJlbnRoZXNlcyhzdWJzZXF1ZW50U3RtdC5leHByZXNzaW9uKTtcbiAgICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24oaWlmZSkgfHwgIWlzRW51bURlY2xhcmF0aW9uSWlmZShpaWZlKSkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBmbiA9IHN0cmlwUGFyZW50aGVzZXMoaWlmZS5leHByZXNzaW9uKTtcbiAgICBpZiAoIXRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGZuKSkgcmV0dXJuIG51bGw7XG5cbiAgICByZXR1cm4gdGhpcy5yZWZsZWN0RW51bU1lbWJlcnMoZm4pO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGV4dHJhY3QgYWxsIGBFbnVtTWVtYmVyYHMgZnJvbSBhIGZ1bmN0aW9uIHRoYXQgaXMgYWNjb3JkaW5nIHRvIHRoZSBKYXZhU2NyaXB0IGVtaXRcbiAgICogZm9ybWF0IGZvciBlbnVtczpcbiAgICpcbiAgICogICBmdW5jdGlvbiAoRW51bSkge1xuICAgKiAgICAgRW51bVtcIk1lbWJlckFcIl0gPSBcImFcIjtcbiAgICogICAgIEVudW1bXCJNZW1iZXJCXCJdID0gXCJiXCI7XG4gICAqICAgfVxuICAgKlxuICAgKiBAcGFyYW0gZm4gVGhlIGZ1bmN0aW9uIGV4cHJlc3Npb24gdGhhdCBpcyBhc3N1bWVkIHRvIGNvbnRhaW4gZW51bSBtZW1iZXJzLlxuICAgKiBAcmV0dXJucyBBbGwgZW51bSBtZW1iZXJzIGlmIHRoZSBmdW5jdGlvbiBpcyBhY2NvcmRpbmcgdG8gdGhlIGNvcnJlY3Qgc3ludGF4LCBudWxsIG90aGVyd2lzZS5cbiAgICovXG4gIHByaXZhdGUgcmVmbGVjdEVudW1NZW1iZXJzKGZuOiB0cy5GdW5jdGlvbkV4cHJlc3Npb24pOiBFbnVtTWVtYmVyW118bnVsbCB7XG4gICAgaWYgKGZuLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGVudW1OYW1lID0gZm4ucGFyYW1ldGVyc1swXS5uYW1lO1xuICAgIGlmICghdHMuaXNJZGVudGlmaWVyKGVudW1OYW1lKSkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBlbnVtTWVtYmVyczogRW51bU1lbWJlcltdID0gW107XG4gICAgZm9yIChjb25zdCBzdGF0ZW1lbnQgb2YgZm4uYm9keS5zdGF0ZW1lbnRzKSB7XG4gICAgICBjb25zdCBlbnVtTWVtYmVyID0gdGhpcy5yZWZsZWN0RW51bU1lbWJlcihlbnVtTmFtZSwgc3RhdGVtZW50KTtcbiAgICAgIGlmIChlbnVtTWVtYmVyID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgZW51bU1lbWJlcnMucHVzaChlbnVtTWVtYmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIGVudW1NZW1iZXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGV4dHJhY3QgYSBzaW5nbGUgYEVudW1NZW1iZXJgIGZyb20gYSBzdGF0ZW1lbnQgaW4gdGhlIGZvbGxvd2luZyBzeW50YXg6XG4gICAqXG4gICAqICAgRW51bVtcIk1lbWJlckFcIl0gPSBcImFcIjtcbiAgICpcbiAgICogb3IsIGZvciBlbnVtIG1lbWJlciB3aXRoIG51bWVyaWMgdmFsdWVzOlxuICAgKlxuICAgKiAgIEVudW1bRW51bVtcIk1lbWJlckFcIl0gPSAwXSA9IFwiTWVtYmVyQVwiO1xuICAgKlxuICAgKiBAcGFyYW0gZW51bU5hbWUgVGhlIGlkZW50aWZpZXIgb2YgdGhlIGVudW0gdGhhdCB0aGUgbWVtYmVycyBzaG91bGQgYmUgc2V0IG9uLlxuICAgKiBAcGFyYW0gc3RhdGVtZW50IFRoZSBzdGF0ZW1lbnQgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMgQW4gYEVudW1NZW1iZXJgIGlmIHRoZSBzdGF0ZW1lbnQgaXMgYWNjb3JkaW5nIHRvIHRoZSBleHBlY3RlZCBzeW50YXgsIG51bGwgb3RoZXJ3aXNlLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlZmxlY3RFbnVtTWVtYmVyKGVudW1OYW1lOiB0cy5JZGVudGlmaWVyLCBzdGF0ZW1lbnQ6IHRzLlN0YXRlbWVudCk6IEVudW1NZW1iZXJ8bnVsbCB7XG4gICAgaWYgKCF0cy5pc0V4cHJlc3Npb25TdGF0ZW1lbnQoc3RhdGVtZW50KSkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBleHByZXNzaW9uID0gc3RhdGVtZW50LmV4cHJlc3Npb247XG5cbiAgICAvLyBDaGVjayBmb3IgdGhlIGBFbnVtW1hdID0gWTtgIGNhc2UuXG4gICAgaWYgKCFpc0VudW1Bc3NpZ25tZW50KGVudW1OYW1lLCBleHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGFzc2lnbm1lbnQgPSByZWZsZWN0RW51bUFzc2lnbm1lbnQoZXhwcmVzc2lvbik7XG4gICAgaWYgKGFzc2lnbm1lbnQgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGFzc2lnbm1lbnQ7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIHRoZSBgRW51bVtFbnVtW1hdID0gWV0gPSAuLi47YCBjYXNlLlxuICAgIGNvbnN0IGlubmVyRXhwcmVzc2lvbiA9IGV4cHJlc3Npb24ubGVmdC5hcmd1bWVudEV4cHJlc3Npb247XG4gICAgaWYgKCFpc0VudW1Bc3NpZ25tZW50KGVudW1OYW1lLCBpbm5lckV4cHJlc3Npb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHJlZmxlY3RFbnVtQXNzaWdubWVudChpbm5lckV4cHJlc3Npb24pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBZGphY2VudE5hbWVPZkNsYXNzU3ltYm9sKGNsYXNzU3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2wpOiB0cy5JZGVudGlmaWVyIHtcbiAgICBpZiAoY2xhc3NTeW1ib2wuYWRqYWNlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0TmFtZUZyb21DbGFzc1N5bWJvbERlY2xhcmF0aW9uKFxuICAgICAgICAgIGNsYXNzU3ltYm9sLCBjbGFzc1N5bWJvbC5hZGphY2VudC52YWx1ZURlY2xhcmF0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0TmFtZUZyb21DbGFzc1N5bWJvbERlY2xhcmF0aW9uKFxuICAgICAgICAgIGNsYXNzU3ltYm9sLCBjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uKTtcbiAgICB9XG4gIH1cbn1cblxuLy8vLy8vLy8vLy8vLyBFeHBvcnRlZCBIZWxwZXJzIC8vLy8vLy8vLy8vLy9cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgaWlmZSBoYXMgdGhlIGZvbGxvd2luZyBjYWxsIHNpZ25hdHVyZTpcbiAqXG4gKiAgIChFbnVtIHx8IChFbnVtID0ge30pXG4gKlxuICogTm90ZSB0aGF0IHRoZSBgRW51bWAgaWRlbnRpZmllciBpcyBub3QgY2hlY2tlZCwgYXMgaXQgY291bGQgYWxzbyBiZSBzb21ldGhpbmdcbiAqIGxpa2UgYGV4cG9ydHMuRW51bWAuIEluc3RlYWQsIG9ubHkgdGhlIHN0cnVjdHVyZSBvZiBiaW5hcnkgb3BlcmF0b3JzIGlzIGNoZWNrZWQuXG4gKlxuICogQHBhcmFtIGlpZmUgVGhlIGNhbGwgZXhwcmVzc2lvbiB0byBjaGVjay5cbiAqIEByZXR1cm5zIHRydWUgaWYgdGhlIGlpZmUgaGFzIGEgY2FsbCBzaWduYXR1cmUgdGhhdCBjb3JyZXNwb25kcyB3aXRoIGEgcG90ZW50aWFsXG4gKiBlbnVtIGRlY2xhcmF0aW9uLlxuICovXG5mdW5jdGlvbiBpc0VudW1EZWNsYXJhdGlvbklpZmUoaWlmZTogdHMuQ2FsbEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgaWYgKGlpZmUuYXJndW1lbnRzLmxlbmd0aCAhPT0gMSkgcmV0dXJuIGZhbHNlO1xuXG4gIGNvbnN0IGFyZyA9IGlpZmUuYXJndW1lbnRzWzBdO1xuICBpZiAoIXRzLmlzQmluYXJ5RXhwcmVzc2lvbihhcmcpIHx8IGFyZy5vcGVyYXRvclRva2VuLmtpbmQgIT09IHRzLlN5bnRheEtpbmQuQmFyQmFyVG9rZW4gfHxcbiAgICAgICF0cy5pc1BhcmVudGhlc2l6ZWRFeHByZXNzaW9uKGFyZy5yaWdodCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCByaWdodCA9IGFyZy5yaWdodC5leHByZXNzaW9uO1xuICBpZiAoIXRzLmlzQmluYXJ5RXhwcmVzc2lvbihyaWdodCkgfHwgcmlnaHQub3BlcmF0b3JUb2tlbi5raW5kICE9PSB0cy5TeW50YXhLaW5kLkVxdWFsc1Rva2VuKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKHJpZ2h0LnJpZ2h0KSB8fCByaWdodC5yaWdodC5wcm9wZXJ0aWVzLmxlbmd0aCAhPT0gMCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIEFuIGVudW0gbWVtYmVyIGFzc2lnbm1lbnQgdGhhdCBsb29rcyBsaWtlIGBFbnVtW1hdID0gWTtgLlxuICovXG5leHBvcnQgdHlwZSBFbnVtTWVtYmVyQXNzaWdubWVudCA9IHRzLkJpbmFyeUV4cHJlc3Npb24me2xlZnQ6IHRzLkVsZW1lbnRBY2Nlc3NFeHByZXNzaW9ufTtcblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZXhwcmVzc2lvbiBsb29rcyBsaWtlIGFuIGVudW0gbWVtYmVyIGFzc2lnbm1lbnQgdGFyZ2V0aW5nIGBFbnVtYDpcbiAqXG4gKiAgIEVudW1bWF0gPSBZO1xuICpcbiAqIEhlcmUsIFggYW5kIFkgY2FuIGJlIGFueSBleHByZXNzaW9uLlxuICpcbiAqIEBwYXJhbSBlbnVtTmFtZSBUaGUgaWRlbnRpZmllciBvZiB0aGUgZW51bSB0aGF0IHRoZSBtZW1iZXJzIHNob3VsZCBiZSBzZXQgb24uXG4gKiBAcGFyYW0gZXhwcmVzc2lvbiBUaGUgZXhwcmVzc2lvbiB0aGF0IHNob3VsZCBiZSBjaGVja2VkIHRvIGNvbmZvcm0gdG8gdGhlIGFib3ZlIGZvcm0uXG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGlzIG9mIHRoZSBjb3JyZWN0IGZvcm0sIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaXNFbnVtQXNzaWdubWVudChcbiAgICBlbnVtTmFtZTogdHMuSWRlbnRpZmllciwgZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IGV4cHJlc3Npb24gaXMgRW51bU1lbWJlckFzc2lnbm1lbnQge1xuICBpZiAoIXRzLmlzQmluYXJ5RXhwcmVzc2lvbihleHByZXNzaW9uKSB8fFxuICAgICAgZXhwcmVzc2lvbi5vcGVyYXRvclRva2VuLmtpbmQgIT09IHRzLlN5bnRheEtpbmQuRXF1YWxzVG9rZW4gfHxcbiAgICAgICF0cy5pc0VsZW1lbnRBY2Nlc3NFeHByZXNzaW9uKGV4cHJlc3Npb24ubGVmdCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBWZXJpZnkgdGhhdCB0aGUgb3V0ZXIgYXNzaWdubWVudCBjb3JyZXNwb25kcyB3aXRoIHRoZSBlbnVtIGRlY2xhcmF0aW9uLlxuICBjb25zdCBlbnVtSWRlbnRpZmllciA9IGV4cHJlc3Npb24ubGVmdC5leHByZXNzaW9uO1xuICByZXR1cm4gdHMuaXNJZGVudGlmaWVyKGVudW1JZGVudGlmaWVyKSAmJiBlbnVtSWRlbnRpZmllci50ZXh0ID09PSBlbnVtTmFtZS50ZXh0O1xufVxuXG4vKipcbiAqIEF0dGVtcHRzIHRvIGNyZWF0ZSBhbiBgRW51bU1lbWJlcmAgZnJvbSBhbiBleHByZXNzaW9uIHRoYXQgaXMgYmVsaWV2ZWQgdG8gcmVwcmVzZW50IGFuIGVudW1cbiAqIGFzc2lnbm1lbnQuXG4gKlxuICogQHBhcmFtIGV4cHJlc3Npb24gVGhlIGV4cHJlc3Npb24gdGhhdCBpcyBiZWxpZXZlZCB0byBiZSBhbiBlbnVtIGFzc2lnbm1lbnQuXG4gKiBAcmV0dXJucyBBbiBgRW51bU1lbWJlcmAgb3IgbnVsbCBpZiB0aGUgZXhwcmVzc2lvbiBkaWQgbm90IHJlcHJlc2VudCBhbiBlbnVtIG1lbWJlciBhZnRlciBhbGwuXG4gKi9cbmZ1bmN0aW9uIHJlZmxlY3RFbnVtQXNzaWdubWVudChleHByZXNzaW9uOiBFbnVtTWVtYmVyQXNzaWdubWVudCk6IEVudW1NZW1iZXJ8bnVsbCB7XG4gIGNvbnN0IG1lbWJlck5hbWUgPSBleHByZXNzaW9uLmxlZnQuYXJndW1lbnRFeHByZXNzaW9uO1xuICBpZiAoIXRzLmlzUHJvcGVydHlOYW1lKG1lbWJlck5hbWUpKSByZXR1cm4gbnVsbDtcblxuICByZXR1cm4ge25hbWU6IG1lbWJlck5hbWUsIGluaXRpYWxpemVyOiBleHByZXNzaW9uLnJpZ2h0fTtcbn1cblxuZXhwb3J0IHR5cGUgUGFyYW1JbmZvID0ge1xuICBkZWNvcmF0b3JzOiBEZWNvcmF0b3JbXXxudWxsLFxuICB0eXBlRXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbnxudWxsXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBjYWxsIHRvIGB0c2xpYi5fX21ldGFkYXRhYCBhcyBwcmVzZW50IGluIGB0c2xpYi5fX2RlY29yYXRlYCBjYWxscy4gVGhpcyBpcyBhXG4gKiBzeW50aGV0aWMgZGVjb3JhdG9yIGluc2VydGVkIGJ5IFR5cGVTY3JpcHQgdGhhdCBjb250YWlucyByZWZsZWN0aW9uIGluZm9ybWF0aW9uIGFib3V0IHRoZVxuICogdGFyZ2V0IG9mIHRoZSBkZWNvcmF0b3IsIGkuZS4gdGhlIGNsYXNzIG9yIHByb3BlcnR5LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcmFtZXRlclR5cGVzIHtcbiAgdHlwZTogJ3BhcmFtcyc7XG4gIHR5cGVzOiB0cy5FeHByZXNzaW9uW107XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNhbGwgdG8gYHRzbGliLl9fcGFyYW1gIGFzIHByZXNlbnQgaW4gYHRzbGliLl9fZGVjb3JhdGVgIGNhbGxzLiBUaGlzIGNvbnRhaW5zXG4gKiBpbmZvcm1hdGlvbiBvbiBhbnkgZGVjb3JhdG9ycyB3ZXJlIGFwcGxpZWQgdG8gYSBjZXJ0YWluIHBhcmFtZXRlci5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJhbWV0ZXJEZWNvcmF0b3JzIHtcbiAgdHlwZTogJ3BhcmFtOmRlY29yYXRvcnMnO1xuICBpbmRleDogbnVtYmVyO1xuICBkZWNvcmF0b3I6IERlY29yYXRvcjtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgY2FsbCB0byBhIGRlY29yYXRvciBhcyBpdCB3YXMgcHJlc2VudCBpbiB0aGUgb3JpZ2luYWwgc291cmNlIGNvZGUsIGFzIHByZXNlbnQgaW5cbiAqIGB0c2xpYi5fX2RlY29yYXRlYCBjYWxscy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBEZWNvcmF0b3JDYWxsIHtcbiAgdHlwZTogJ2RlY29yYXRvcic7XG4gIGRlY29yYXRvcjogRGVjb3JhdG9yO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIGRpZmZlcmVudCBraW5kcyBvZiBkZWNvcmF0ZSBoZWxwZXJzIHRoYXQgbWF5IGJlIHByZXNlbnQgYXMgZmlyc3QgYXJndW1lbnQgdG9cbiAqIGB0c2xpYi5fX2RlY29yYXRlYCwgYXMgZm9sbG93czpcbiAqXG4gKiBgYGBcbiAqIF9fZGVjb3JhdGUoW1xuICogICBEaXJlY3RpdmUoeyBzZWxlY3RvcjogJ1tzb21lRGlyZWN0aXZlXScgfSksXG4gKiAgIHRzbGliXzEuX19wYXJhbSgyLCBJbmplY3QoSU5KRUNURURfVE9LRU4pKSxcbiAqICAgdHNsaWJfMS5fX21ldGFkYXRhKFwiZGVzaWduOnBhcmFtdHlwZXNcIiwgW1ZpZXdDb250YWluZXJSZWYsIFRlbXBsYXRlUmVmLCBTdHJpbmddKVxuICogXSwgU29tZURpcmVjdGl2ZSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IHR5cGUgRGVjb3JhdGVIZWxwZXJFbnRyeSA9IFBhcmFtZXRlclR5cGVzfFBhcmFtZXRlckRlY29yYXRvcnN8RGVjb3JhdG9yQ2FsbDtcblxuLyoqXG4gKiBUaGUgcmVjb3JkZWQgZGVjb3JhdG9yIGluZm9ybWF0aW9uIG9mIGEgc2luZ2xlIGNsYXNzLiBUaGlzIGluZm9ybWF0aW9uIGlzIGNhY2hlZCBpbiB0aGUgaG9zdC5cbiAqL1xuaW50ZXJmYWNlIERlY29yYXRvckluZm8ge1xuICAvKipcbiAgICogQWxsIGRlY29yYXRvcnMgdGhhdCB3ZXJlIHByZXNlbnQgb24gdGhlIGNsYXNzLiBJZiBubyBkZWNvcmF0b3JzIHdlcmUgcHJlc2VudCwgdGhpcyBpcyBgbnVsbGBcbiAgICovXG4gIGNsYXNzRGVjb3JhdG9yczogRGVjb3JhdG9yW118bnVsbDtcblxuICAvKipcbiAgICogQWxsIGRlY29yYXRvcnMgcGVyIG1lbWJlciBvZiB0aGUgY2xhc3MgdGhleSB3ZXJlIHByZXNlbnQgb24uXG4gICAqL1xuICBtZW1iZXJEZWNvcmF0b3JzOiBNYXA8c3RyaW5nLCBEZWNvcmF0b3JbXT47XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGNvbnN0cnVjdG9yIHBhcmFtZXRlciBpbmZvcm1hdGlvbiwgc3VjaCBhcyB0aGUgdHlwZSBvZiBhIHBhcmFtZXRlciBhbmQgYWxsXG4gICAqIGRlY29yYXRvcnMgZm9yIGEgY2VydGFpbiBwYXJhbWV0ZXIuIEluZGljZXMgaW4gdGhpcyBhcnJheSBjb3JyZXNwb25kIHdpdGggdGhlIHBhcmFtZXRlcidzXG4gICAqIGluZGV4IGluIHRoZSBjb25zdHJ1Y3Rvci4gTm90ZSB0aGF0IHRoaXMgYXJyYXkgbWF5IGJlIHNwYXJzZSwgaS5lLiBjZXJ0YWluIGNvbnN0cnVjdG9yXG4gICAqIHBhcmFtZXRlcnMgbWF5IG5vdCBoYXZlIGFueSBpbmZvIHJlY29yZGVkLlxuICAgKi9cbiAgY29uc3RydWN0b3JQYXJhbUluZm86IFBhcmFtSW5mb1tdO1xufVxuXG4vKipcbiAqIEEgc3RhdGVtZW50IG5vZGUgdGhhdCByZXByZXNlbnRzIGFuIGFzc2lnbm1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIEFzc2lnbm1lbnRTdGF0ZW1lbnQgPVxuICAgIHRzLkV4cHJlc3Npb25TdGF0ZW1lbnQme2V4cHJlc3Npb246IHtsZWZ0OiB0cy5JZGVudGlmaWVyLCByaWdodDogdHMuRXhwcmVzc2lvbn19O1xuXG4vKipcbiAqIFRlc3Qgd2hldGhlciBhIHN0YXRlbWVudCBub2RlIGlzIGFuIGFzc2lnbm1lbnQgc3RhdGVtZW50LlxuICogQHBhcmFtIHN0YXRlbWVudCB0aGUgc3RhdGVtZW50IHRvIHRlc3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Fzc2lnbm1lbnRTdGF0ZW1lbnQoc3RhdGVtZW50OiB0cy5TdGF0ZW1lbnQpOiBzdGF0ZW1lbnQgaXMgQXNzaWdubWVudFN0YXRlbWVudCB7XG4gIHJldHVybiB0cy5pc0V4cHJlc3Npb25TdGF0ZW1lbnQoc3RhdGVtZW50KSAmJiBpc0Fzc2lnbm1lbnQoc3RhdGVtZW50LmV4cHJlc3Npb24pICYmXG4gICAgICB0cy5pc0lkZW50aWZpZXIoc3RhdGVtZW50LmV4cHJlc3Npb24ubGVmdCk7XG59XG5cbi8qKlxuICogUGFyc2UgdGhlIGBleHByZXNzaW9uYCB0aGF0IGlzIGJlbGlldmVkIHRvIGJlIGFuIElJRkUgYW5kIHJldHVybiB0aGUgQVNUIG5vZGUgdGhhdCBjb3JyZXNwb25kcyB0b1xuICogdGhlIGJvZHkgb2YgdGhlIElJRkUuXG4gKlxuICogVGhlIGV4cHJlc3Npb24gbWF5IGJlIHdyYXBwZWQgaW4gcGFyZW50aGVzZXMsIHdoaWNoIGFyZSBzdHJpcHBlZCBvZmYuXG4gKlxuICogSWYgdGhlIElJRkUgaXMgYW4gYXJyb3cgZnVuY3Rpb24gdGhlbiBpdHMgYm9keSBjb3VsZCBiZSBhIGB0cy5FeHByZXNzaW9uYCByYXRoZXIgdGhhbiBhXG4gKiBgdHMuRnVuY3Rpb25Cb2R5YC5cbiAqXG4gKiBAcGFyYW0gZXhwcmVzc2lvbiB0aGUgZXhwcmVzc2lvbiB0byBwYXJzZS5cbiAqIEByZXR1cm5zIHRoZSBgdHMuRXhwcmVzc2lvbmAgb3IgYHRzLkZ1bmN0aW9uQm9keWAgdGhhdCBob2xkcyB0aGUgYm9keSBvZiB0aGUgSUlGRSBvciBgdW5kZWZpbmVkYFxuICogICAgIGlmIHRoZSBgZXhwcmVzc2lvbmAgZGlkIG5vdCBoYXZlIHRoZSBjb3JyZWN0IHNoYXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SWlmZUJvZHkoZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IHRzLkNvbmNpc2VCb2R5fHVuZGVmaW5lZCB7XG4gIGNvbnN0IGNhbGwgPSBzdHJpcFBhcmVudGhlc2VzKGV4cHJlc3Npb24pO1xuICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24oY2FsbCkpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgZm4gPSBzdHJpcFBhcmVudGhlc2VzKGNhbGwuZXhwcmVzc2lvbik7XG4gIGlmICghdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24oZm4pICYmICF0cy5pc0Fycm93RnVuY3Rpb24oZm4pKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHJldHVybiBmbi5ib2R5O1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYG5vZGVgIGlzIGFuIGFzc2lnbm1lbnQgb2YgdGhlIGZvcm0gYGEgPSBiYC5cbiAqXG4gKiBAcGFyYW0gbm9kZSBUaGUgQVNUIG5vZGUgdG8gY2hlY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Fzc2lnbm1lbnQobm9kZTogdHMuTm9kZSk6IG5vZGUgaXMgdHMuQXNzaWdubWVudEV4cHJlc3Npb248dHMuRXF1YWxzVG9rZW4+IHtcbiAgcmV0dXJuIHRzLmlzQmluYXJ5RXhwcmVzc2lvbihub2RlKSAmJiBub2RlLm9wZXJhdG9yVG9rZW4ua2luZCA9PT0gdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbjtcbn1cblxuLyoqXG4gKiBUZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCBjYWxsIGV4cHJlc3Npb24gdGFyZ2V0cyBhIGNsYXNzLCBieSB2ZXJpZnlpbmcgaXRzIGFyZ3VtZW50cyBhcmVcbiAqIGFjY29yZGluZyB0byB0aGUgZm9sbG93aW5nIGZvcm06XG4gKlxuICogYGBgXG4gKiBfX2RlY29yYXRlKFtdLCBTb21lRGlyZWN0aXZlKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBjYWxsIHRoZSBjYWxsIGV4cHJlc3Npb24gdGhhdCBpcyB0ZXN0ZWQgdG8gcmVwcmVzZW50IGEgY2xhc3MgZGVjb3JhdG9yIGNhbGwuXG4gKiBAcGFyYW0gbWF0Y2hlcyBwcmVkaWNhdGUgZnVuY3Rpb24gdG8gdGVzdCB3aGV0aGVyIHRoZSBjYWxsIGlzIGFzc29jaWF0ZWQgd2l0aCB0aGUgZGVzaXJlZCBjbGFzcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQ2xhc3NEZWNvcmF0ZUNhbGwoXG4gICAgY2FsbDogdHMuQ2FsbEV4cHJlc3Npb24sIG1hdGNoZXM6IChpZGVudGlmaWVyOiB0cy5JZGVudGlmaWVyKSA9PiBib29sZWFuKTpcbiAgICBjYWxsIGlzIHRzLkNhbGxFeHByZXNzaW9uJnthcmd1bWVudHM6IFt0cy5BcnJheUxpdGVyYWxFeHByZXNzaW9uLCB0cy5FeHByZXNzaW9uXX0ge1xuICBjb25zdCBoZWxwZXJBcmdzID0gY2FsbC5hcmd1bWVudHNbMF07XG4gIGlmIChoZWxwZXJBcmdzID09PSB1bmRlZmluZWQgfHwgIXRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbihoZWxwZXJBcmdzKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHRhcmdldCA9IGNhbGwuYXJndW1lbnRzWzFdO1xuICByZXR1cm4gdGFyZ2V0ICE9PSB1bmRlZmluZWQgJiYgdHMuaXNJZGVudGlmaWVyKHRhcmdldCkgJiYgbWF0Y2hlcyh0YXJnZXQpO1xufVxuXG4vKipcbiAqIFRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIGNhbGwgZXhwcmVzc2lvbiB0YXJnZXRzIGEgbWVtYmVyIG9mIHRoZSBjbGFzcywgYnkgdmVyaWZ5aW5nIGl0c1xuICogYXJndW1lbnRzIGFyZSBhY2NvcmRpbmcgdG8gdGhlIGZvbGxvd2luZyBmb3JtOlxuICpcbiAqIGBgYFxuICogX19kZWNvcmF0ZShbXSwgU29tZURpcmVjdGl2ZS5wcm90b3R5cGUsIFwibWVtYmVyXCIsIHZvaWQgMCk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gY2FsbCB0aGUgY2FsbCBleHByZXNzaW9uIHRoYXQgaXMgdGVzdGVkIHRvIHJlcHJlc2VudCBhIG1lbWJlciBkZWNvcmF0b3IgY2FsbC5cbiAqIEBwYXJhbSBtYXRjaGVzIHByZWRpY2F0ZSBmdW5jdGlvbiB0byB0ZXN0IHdoZXRoZXIgdGhlIGNhbGwgaXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBkZXNpcmVkIGNsYXNzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNNZW1iZXJEZWNvcmF0ZUNhbGwoXG4gICAgY2FsbDogdHMuQ2FsbEV4cHJlc3Npb24sIG1hdGNoZXM6IChpZGVudGlmaWVyOiB0cy5JZGVudGlmaWVyKSA9PiBib29sZWFuKTpcbiAgICBjYWxsIGlzIHRzLkNhbGxFeHByZXNzaW9uJlxuICAgIHthcmd1bWVudHM6IFt0cy5BcnJheUxpdGVyYWxFeHByZXNzaW9uLCB0cy5TdHJpbmdMaXRlcmFsLCB0cy5TdHJpbmdMaXRlcmFsXX0ge1xuICBjb25zdCBoZWxwZXJBcmdzID0gY2FsbC5hcmd1bWVudHNbMF07XG4gIGlmIChoZWxwZXJBcmdzID09PSB1bmRlZmluZWQgfHwgIXRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbihoZWxwZXJBcmdzKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHRhcmdldCA9IGNhbGwuYXJndW1lbnRzWzFdO1xuICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgIXRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKHRhcmdldCkgfHxcbiAgICAgICF0cy5pc0lkZW50aWZpZXIodGFyZ2V0LmV4cHJlc3Npb24pIHx8ICFtYXRjaGVzKHRhcmdldC5leHByZXNzaW9uKSB8fFxuICAgICAgdGFyZ2V0Lm5hbWUudGV4dCAhPT0gJ3Byb3RvdHlwZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBtZW1iZXJOYW1lID0gY2FsbC5hcmd1bWVudHNbMl07XG4gIHJldHVybiBtZW1iZXJOYW1lICE9PSB1bmRlZmluZWQgJiYgdHMuaXNTdHJpbmdMaXRlcmFsKG1lbWJlck5hbWUpO1xufVxuXG4vKipcbiAqIEhlbHBlciBtZXRob2QgdG8gZXh0cmFjdCB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBnaXZlbiB0aGUgcHJvcGVydHkncyBcInN5bWJvbFwiLFxuICogd2hpY2ggaXMgYWN0dWFsbHkgdGhlIHN5bWJvbCBvZiB0aGUgaWRlbnRpZmllciBvZiB0aGUgcHJvcGVydHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9wZXJ0eVZhbHVlRnJvbVN5bWJvbChwcm9wU3ltYm9sOiB0cy5TeW1ib2wpOiB0cy5FeHByZXNzaW9ufHVuZGVmaW5lZCB7XG4gIGNvbnN0IHByb3BJZGVudGlmaWVyID0gcHJvcFN5bWJvbC52YWx1ZURlY2xhcmF0aW9uO1xuICBjb25zdCBwYXJlbnQgPSBwcm9wSWRlbnRpZmllciAmJiBwcm9wSWRlbnRpZmllci5wYXJlbnQ7XG4gIHJldHVybiBwYXJlbnQgJiYgdHMuaXNCaW5hcnlFeHByZXNzaW9uKHBhcmVudCkgPyBwYXJlbnQucmlnaHQgOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQSBjYWxsZWUgY291bGQgYmUgb25lIG9mOiBgX19kZWNvcmF0ZSguLi4pYCBvciBgdHNsaWJfMS5fX2RlY29yYXRlYC5cbiAqL1xuZnVuY3Rpb24gZ2V0Q2FsbGVlTmFtZShjYWxsOiB0cy5DYWxsRXhwcmVzc2lvbik6IHN0cmluZ3xudWxsIHtcbiAgaWYgKHRzLmlzSWRlbnRpZmllcihjYWxsLmV4cHJlc3Npb24pKSB7XG4gICAgcmV0dXJuIHN0cmlwRG9sbGFyU3VmZml4KGNhbGwuZXhwcmVzc2lvbi50ZXh0KTtcbiAgfVxuICBpZiAodHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24oY2FsbC5leHByZXNzaW9uKSkge1xuICAgIHJldHVybiBzdHJpcERvbGxhclN1ZmZpeChjYWxsLmV4cHJlc3Npb24ubmFtZS50ZXh0KTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLy8vLy8vLy8vLy8vLyBJbnRlcm5hbCBIZWxwZXJzIC8vLy8vLy8vLy8vLy9cblxudHlwZSBJbml0aWFsaXplZFZhcmlhYmxlQ2xhc3NEZWNsYXJhdGlvbiA9XG4gICAgQ2xhc3NEZWNsYXJhdGlvbjx0cy5WYXJpYWJsZURlY2xhcmF0aW9uPiZ7aW5pdGlhbGl6ZXI6IHRzLkV4cHJlc3Npb259O1xuXG5mdW5jdGlvbiBpc0luaXRpYWxpemVkVmFyaWFibGVDbGFzc0RlY2xhcmF0aW9uKG5vZGU6IHRzLk5vZGUpOlxuICAgIG5vZGUgaXMgSW5pdGlhbGl6ZWRWYXJpYWJsZUNsYXNzRGVjbGFyYXRpb24ge1xuICByZXR1cm4gaXNOYW1lZFZhcmlhYmxlRGVjbGFyYXRpb24obm9kZSkgJiYgbm9kZS5pbml0aWFsaXplciAhPT0gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEhhbmRsZSBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uIG9mIHRoZSBmb3JtXG4gKlxuICogYGBgXG4gKiB2YXIgTXlDbGFzcyA9IGFsaWFzMSA9IGFsaWFzMiA9IDw8ZGVjbGFyYXRpb24+PlxuICogYGBgXG4gKlxuICogQHBhcmFtIG5vZGUgdGhlIExIUyBvZiBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICogQHJldHVybnMgdGhlIG9yaWdpbmFsIEFTVCBub2RlIG9yIHRoZSBSSFMgb2YgYSBzZXJpZXMgb2YgYXNzaWdubWVudHMgaW4gYSB2YXJpYWJsZVxuICogICAgIGRlY2xhcmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2tpcENsYXNzQWxpYXNlcyhub2RlOiBJbml0aWFsaXplZFZhcmlhYmxlQ2xhc3NEZWNsYXJhdGlvbik6IHRzLkV4cHJlc3Npb24ge1xuICBsZXQgZXhwcmVzc2lvbiA9IG5vZGUuaW5pdGlhbGl6ZXI7XG4gIHdoaWxlIChpc0Fzc2lnbm1lbnQoZXhwcmVzc2lvbikpIHtcbiAgICBleHByZXNzaW9uID0gZXhwcmVzc2lvbi5yaWdodDtcbiAgfVxuICByZXR1cm4gZXhwcmVzc2lvbjtcbn1cblxuLyoqXG4gKiBUaGlzIGV4cHJlc3Npb24gY291bGQgZWl0aGVyIGJlIGEgY2xhc3MgZXhwcmVzc2lvblxuICpcbiAqIGBgYFxuICogY2xhc3MgTXlDbGFzcyB7fTtcbiAqIGBgYFxuICpcbiAqIG9yIGFuIElJRkUgd3JhcHBlZCBjbGFzcyBleHByZXNzaW9uXG4gKlxuICogYGBgXG4gKiAoKCkgPT4ge1xuICogICBjbGFzcyBNeUNsYXNzIHt9XG4gKiAgIC4uLlxuICogICByZXR1cm4gTXlDbGFzcztcbiAqIH0pKClcbiAqIGBgYFxuICpcbiAqIG9yIGFuIElJRkUgd3JhcHBlZCBhbGlhc2VkIGNsYXNzIGV4cHJlc3Npb25cbiAqXG4gKiBgYGBcbiAqICgoKSA9PiB7XG4gKiAgIGxldCBNeUNsYXNzID0gY2xhc3MgTXlDbGFzcyB7fVxuICogICAuLi5cbiAqICAgcmV0dXJuIE15Q2xhc3M7XG4gKiB9KSgpXG4gKiBgYGBcbiAqXG4gKiBvciBhbiBJRkZFIHdyYXBwZWQgRVM1IGNsYXNzIGZ1bmN0aW9uXG4gKlxuICogYGBgXG4gKiAoZnVuY3Rpb24gKCkge1xuICogIGZ1bmN0aW9uIE15Q2xhc3MoKSB7fVxuICogIC4uLlxuICogIHJldHVybiBNeUNsYXNzXG4gKiB9KSgpXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gZXhwcmVzc2lvbiB0aGUgbm9kZSB0aGF0IHJlcHJlc2VudHMgdGhlIGNsYXNzIHdob3NlIGRlY2xhcmF0aW9uIHdlIGFyZSBmaW5kaW5nLlxuICogQHJldHVybnMgdGhlIGRlY2xhcmF0aW9uIG9mIHRoZSBjbGFzcyBvciBgbnVsbGAgaWYgaXQgaXMgbm90IGEgXCJjbGFzc1wiLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5uZXJDbGFzc0RlY2xhcmF0aW9uKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOlxuICAgIENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NFeHByZXNzaW9ufHRzLkNsYXNzRGVjbGFyYXRpb258dHMuRnVuY3Rpb25EZWNsYXJhdGlvbj58bnVsbCB7XG4gIGlmICh0cy5pc0NsYXNzRXhwcmVzc2lvbihleHByZXNzaW9uKSAmJiBoYXNOYW1lSWRlbnRpZmllcihleHByZXNzaW9uKSkge1xuICAgIHJldHVybiBleHByZXNzaW9uO1xuICB9XG5cbiAgY29uc3QgaWlmZUJvZHkgPSBnZXRJaWZlQm9keShleHByZXNzaW9uKTtcbiAgaWYgKGlpZmVCb2R5ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGlmICghdHMuaXNCbG9jayhpaWZlQm9keSkpIHtcbiAgICAvLyBIYW5kbGUgdGhlIGZhdCBhcnJvdyBleHByZXNzaW9uIGNhc2U6IGAoKSA9PiBDbGFzc0V4cHJlc3Npb25gXG4gICAgcmV0dXJuIHRzLmlzQ2xhc3NFeHByZXNzaW9uKGlpZmVCb2R5KSAmJiBpc05hbWVkRGVjbGFyYXRpb24oaWlmZUJvZHkpID8gaWlmZUJvZHkgOiBudWxsO1xuICB9IGVsc2Uge1xuICAgIC8vIEhhbmRsZSB0aGUgY2FzZSBvZiBhIG5vcm1hbCBvciBmYXQtYXJyb3cgZnVuY3Rpb24gd2l0aCBhIGJvZHkuXG4gICAgLy8gUmV0dXJuIHRoZSBmaXJzdCBDbGFzc0RlY2xhcmF0aW9uL1ZhcmlhYmxlRGVjbGFyYXRpb24gaW5zaWRlIHRoZSBib2R5XG4gICAgZm9yIChjb25zdCBzdGF0ZW1lbnQgb2YgaWlmZUJvZHkuc3RhdGVtZW50cykge1xuICAgICAgaWYgKGlzTmFtZWRDbGFzc0RlY2xhcmF0aW9uKHN0YXRlbWVudCkgfHwgaXNOYW1lZEZ1bmN0aW9uRGVjbGFyYXRpb24oc3RhdGVtZW50KSkge1xuICAgICAgICByZXR1cm4gc3RhdGVtZW50O1xuICAgICAgfVxuICAgICAgaWYgKHRzLmlzVmFyaWFibGVTdGF0ZW1lbnQoc3RhdGVtZW50KSkge1xuICAgICAgICBmb3IgKGNvbnN0IGRlY2xhcmF0aW9uIG9mIHN0YXRlbWVudC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zKSB7XG4gICAgICAgICAgaWYgKGlzSW5pdGlhbGl6ZWRWYXJpYWJsZUNsYXNzRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pKSB7XG4gICAgICAgICAgICBjb25zdCBleHByZXNzaW9uID0gc2tpcENsYXNzQWxpYXNlcyhkZWNsYXJhdGlvbik7XG4gICAgICAgICAgICBpZiAodHMuaXNDbGFzc0V4cHJlc3Npb24oZXhwcmVzc2lvbikgJiYgaGFzTmFtZUlkZW50aWZpZXIoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldERlY29yYXRvckFyZ3Mobm9kZTogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24pOiB0cy5FeHByZXNzaW9uW10ge1xuICAvLyBUaGUgYXJndW1lbnRzIG9mIGEgZGVjb3JhdG9yIGFyZSBoZWxkIGluIHRoZSBgYXJnc2AgcHJvcGVydHkgb2YgaXRzIGRlY2xhcmF0aW9uIG9iamVjdC5cbiAgY29uc3QgYXJnc1Byb3BlcnR5ID0gbm9kZS5wcm9wZXJ0aWVzLmZpbHRlcih0cy5pc1Byb3BlcnR5QXNzaWdubWVudClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maW5kKHByb3BlcnR5ID0+IGdldE5hbWVUZXh0KHByb3BlcnR5Lm5hbWUpID09PSAnYXJncycpO1xuICBjb25zdCBhcmdzRXhwcmVzc2lvbiA9IGFyZ3NQcm9wZXJ0eSAmJiBhcmdzUHJvcGVydHkuaW5pdGlhbGl6ZXI7XG4gIHJldHVybiBhcmdzRXhwcmVzc2lvbiAmJiB0cy5pc0FycmF5TGl0ZXJhbEV4cHJlc3Npb24oYXJnc0V4cHJlc3Npb24pID9cbiAgICAgIEFycmF5LmZyb20oYXJnc0V4cHJlc3Npb24uZWxlbWVudHMpIDpcbiAgICAgIFtdO1xufVxuXG5mdW5jdGlvbiBpc1Byb3BlcnR5QWNjZXNzKG5vZGU6IHRzLk5vZGUpOiBub2RlIGlzIHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbiZcbiAgICB7cGFyZW50OiB0cy5CaW5hcnlFeHByZXNzaW9ufSB7XG4gIHJldHVybiAhIW5vZGUucGFyZW50ICYmIHRzLmlzQmluYXJ5RXhwcmVzc2lvbihub2RlLnBhcmVudCkgJiYgdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24obm9kZSk7XG59XG5cbmZ1bmN0aW9uIGlzVGhpc0Fzc2lnbm1lbnQobm9kZTogdHMuRGVjbGFyYXRpb24pOiBub2RlIGlzIHRzLkJpbmFyeUV4cHJlc3Npb24mXG4gICAge2xlZnQ6IHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbn0ge1xuICByZXR1cm4gdHMuaXNCaW5hcnlFeHByZXNzaW9uKG5vZGUpICYmIHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG5vZGUubGVmdCkgJiZcbiAgICAgIG5vZGUubGVmdC5leHByZXNzaW9uLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuVGhpc0tleXdvcmQ7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZWREZWNsYXJhdGlvbihub2RlOiB0cy5Ob2RlKTogbm9kZSBpcyB0cy5OYW1lZERlY2xhcmF0aW9uJntuYW1lOiB0cy5JZGVudGlmaWVyfSB7XG4gIGNvbnN0IGFueU5vZGU6IGFueSA9IG5vZGU7XG4gIHJldHVybiAhIWFueU5vZGUubmFtZSAmJiB0cy5pc0lkZW50aWZpZXIoYW55Tm9kZS5uYW1lKTtcbn1cblxuXG5mdW5jdGlvbiBpc0NsYXNzTWVtYmVyVHlwZShub2RlOiB0cy5EZWNsYXJhdGlvbik6IG5vZGUgaXMgdHMuQ2xhc3NFbGVtZW50fFxuICAgIHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbnx0cy5CaW5hcnlFeHByZXNzaW9uIHtcbiAgcmV0dXJuICh0cy5pc0NsYXNzRWxlbWVudChub2RlKSB8fCBpc1Byb3BlcnR5QWNjZXNzKG5vZGUpIHx8IHRzLmlzQmluYXJ5RXhwcmVzc2lvbihub2RlKSkgJiZcbiAgICAgIC8vIEFkZGl0aW9uYWxseSwgZW5zdXJlIGBub2RlYCBpcyBub3QgYW4gaW5kZXggc2lnbmF0dXJlLCBmb3IgZXhhbXBsZSBvbiBhbiBhYnN0cmFjdCBjbGFzczpcbiAgICAgIC8vIGBhYnN0cmFjdCBjbGFzcyBGb28geyBba2V5OiBzdHJpbmddOiBhbnk7IH1gXG4gICAgICAhdHMuaXNJbmRleFNpZ25hdHVyZURlY2xhcmF0aW9uKG5vZGUpO1xufVxuXG4vKipcbiAqIEF0dGVtcHQgdG8gcmVzb2x2ZSB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gdGhhdCB0aGUgZ2l2ZW4gZGVjbGFyYXRpb24gaXMgYXNzaWduZWQgdG8uXG4gKiBGb3IgZXhhbXBsZSwgZm9yIHRoZSBmb2xsb3dpbmcgY29kZTpcbiAqXG4gKiBgYGBcbiAqIHZhciBNeUNsYXNzID0gTXlDbGFzc18xID0gY2xhc3MgTXlDbGFzcyB7fTtcbiAqIGBgYFxuICpcbiAqIG9yXG4gKlxuICogYGBgXG4gKiB2YXIgTXlDbGFzcyA9IE15Q2xhc3NfMSA9ICgoKSA9PiB7XG4gKiAgIGNsYXNzIE15Q2xhc3Mge31cbiAqICAgLi4uXG4gKiAgIHJldHVybiBNeUNsYXNzO1xuICogfSkoKVxuICBgYGBcbiAqXG4gKiBhbmQgdGhlIHByb3ZpZGVkIGRlY2xhcmF0aW9uIGJlaW5nIGBjbGFzcyBNeUNsYXNzIHt9YCwgdGhpcyB3aWxsIHJldHVybiB0aGUgYHZhciBNeUNsYXNzYFxuICogZGVjbGFyYXRpb24uXG4gKlxuICogQHBhcmFtIGRlY2xhcmF0aW9uIFRoZSBkZWNsYXJhdGlvbiBmb3Igd2hpY2ggYW55IHZhcmlhYmxlIGRlY2xhcmF0aW9uIHNob3VsZCBiZSBvYnRhaW5lZC5cbiAqIEByZXR1cm5zIHRoZSBvdXRlciB2YXJpYWJsZSBkZWNsYXJhdGlvbiBpZiBmb3VuZCwgdW5kZWZpbmVkIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RmFyTGVmdEhhbmRTaWRlT2ZBc3NpZ25tZW50KGRlY2xhcmF0aW9uOiB0cy5EZWNsYXJhdGlvbik6IHRzLlZhcmlhYmxlRGVjbGFyYXRpb258XG4gICAgdW5kZWZpbmVkIHtcbiAgbGV0IG5vZGUgPSBkZWNsYXJhdGlvbi5wYXJlbnQ7XG5cbiAgLy8gRGV0ZWN0IGFuIGludGVybWVkaWFyeSB2YXJpYWJsZSBhc3NpZ25tZW50IGFuZCBza2lwIG92ZXIgaXQuXG4gIGlmIChpc0Fzc2lnbm1lbnQobm9kZSkgJiYgdHMuaXNJZGVudGlmaWVyKG5vZGUubGVmdCkpIHtcbiAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gIH1cblxuICByZXR1cm4gdHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGUpID8gbm9kZSA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0Q29udGFpbmluZ1ZhcmlhYmxlRGVjbGFyYXRpb24obm9kZTogdHMuTm9kZSk6IENsYXNzRGVjbGFyYXRpb248dHMuVmFyaWFibGVEZWNsYXJhdGlvbj58XG4gICAgdW5kZWZpbmVkIHtcbiAgbm9kZSA9IG5vZGUucGFyZW50O1xuICB3aGlsZSAobm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGlzTmFtZWRWYXJpYWJsZURlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG4gICAgbm9kZSA9IG5vZGUucGFyZW50O1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBtYXkgaGF2ZSBiZWVuIFwic3ludGhlc2l6ZWRcIiBieSBUeXBlU2NyaXB0IGR1cmluZyBKYXZhU2NyaXB0IGVtaXQsXG4gKiBpbiB0aGUgY2FzZSBubyB1c2VyLWRlZmluZWQgY29uc3RydWN0b3IgZXhpc3RzIGFuZCBlLmcuIHByb3BlcnR5IGluaXRpYWxpemVycyBhcmUgdXNlZC5cbiAqIFRob3NlIGluaXRpYWxpemVycyBuZWVkIHRvIGJlIGVtaXR0ZWQgaW50byBhIGNvbnN0cnVjdG9yIGluIEphdmFTY3JpcHQsIHNvIHRoZSBUeXBlU2NyaXB0XG4gKiBjb21waWxlciBnZW5lcmF0ZXMgYSBzeW50aGV0aWMgY29uc3RydWN0b3IuXG4gKlxuICogV2UgbmVlZCB0byBpZGVudGlmeSBzdWNoIGNvbnN0cnVjdG9ycyBhcyBuZ2NjIG5lZWRzIHRvIGJlIGFibGUgdG8gdGVsbCBpZiBhIGNsYXNzIGRpZFxuICogb3JpZ2luYWxseSBoYXZlIGEgY29uc3RydWN0b3IgaW4gdGhlIFR5cGVTY3JpcHQgc291cmNlLiBXaGVuIGEgY2xhc3MgaGFzIGEgc3VwZXJjbGFzcyxcbiAqIGEgc3ludGhlc2l6ZWQgY29uc3RydWN0b3IgbXVzdCBub3QgYmUgY29uc2lkZXJlZCBhcyBhIHVzZXItZGVmaW5lZCBjb25zdHJ1Y3RvciBhcyB0aGF0XG4gKiBwcmV2ZW50cyBhIGJhc2UgZmFjdG9yeSBjYWxsIGZyb20gYmVpbmcgY3JlYXRlZCBieSBuZ3RzYywgcmVzdWx0aW5nIGluIGEgZmFjdG9yeSBmdW5jdGlvblxuICogdGhhdCBkb2VzIG5vdCBpbmplY3QgdGhlIGRlcGVuZGVuY2llcyBvZiB0aGUgc3VwZXJjbGFzcy4gSGVuY2UsIHdlIGlkZW50aWZ5IGEgZGVmYXVsdFxuICogc3ludGhlc2l6ZWQgc3VwZXIgY2FsbCBpbiB0aGUgY29uc3RydWN0b3IgYm9keSwgYWNjb3JkaW5nIHRvIHRoZSBzdHJ1Y3R1cmUgdGhhdCBUeXBlU2NyaXB0XG4gKiBlbWl0cyBkdXJpbmcgSmF2YVNjcmlwdCBlbWl0OlxuICogaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2Jsb2IvdjMuMi4yL3NyYy9jb21waWxlci90cmFuc2Zvcm1lcnMvdHMudHMjTDEwNjgtTDEwODJcbiAqXG4gKiBAcGFyYW0gY29uc3RydWN0b3IgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbiB0byB0ZXN0XG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBjb25zdHJ1Y3RvciBhcHBlYXJzIHRvIGhhdmUgYmVlbiBzeW50aGVzaXplZFxuICovXG5mdW5jdGlvbiBpc1N5bnRoZXNpemVkQ29uc3RydWN0b3IoY29uc3RydWN0b3I6IHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb24pOiBib29sZWFuIHtcbiAgaWYgKCFjb25zdHJ1Y3Rvci5ib2R5KSByZXR1cm4gZmFsc2U7XG5cbiAgY29uc3QgZmlyc3RTdGF0ZW1lbnQgPSBjb25zdHJ1Y3Rvci5ib2R5LnN0YXRlbWVudHNbMF07XG4gIGlmICghZmlyc3RTdGF0ZW1lbnQgfHwgIXRzLmlzRXhwcmVzc2lvblN0YXRlbWVudChmaXJzdFN0YXRlbWVudCkpIHJldHVybiBmYWxzZTtcblxuICByZXR1cm4gaXNTeW50aGVzaXplZFN1cGVyQ2FsbChmaXJzdFN0YXRlbWVudC5leHByZXNzaW9uKTtcbn1cblxuLyoqXG4gKiBUZXN0cyB3aGV0aGVyIHRoZSBleHByZXNzaW9uIGFwcGVhcnMgdG8gaGF2ZSBiZWVuIHN5bnRoZXNpemVkIGJ5IFR5cGVTY3JpcHQsIGkuZS4gd2hldGhlclxuICogaXQgaXMgb2YgdGhlIGZvbGxvd2luZyBmb3JtOlxuICpcbiAqIGBgYFxuICogc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBleHByZXNzaW9uIHRoZSBleHByZXNzaW9uIHRoYXQgaXMgdG8gYmUgdGVzdGVkXG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGFwcGVhcnMgdG8gYmUgYSBzeW50aGVzaXplZCBzdXBlciBjYWxsXG4gKi9cbmZ1bmN0aW9uIGlzU3ludGhlc2l6ZWRTdXBlckNhbGwoZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24oZXhwcmVzc2lvbikpIHJldHVybiBmYWxzZTtcbiAgaWYgKGV4cHJlc3Npb24uZXhwcmVzc2lvbi5raW5kICE9PSB0cy5TeW50YXhLaW5kLlN1cGVyS2V5d29yZCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoZXhwcmVzc2lvbi5hcmd1bWVudHMubGVuZ3RoICE9PSAxKSByZXR1cm4gZmFsc2U7XG5cbiAgY29uc3QgYXJndW1lbnQgPSBleHByZXNzaW9uLmFyZ3VtZW50c1swXTtcbiAgcmV0dXJuIHRzLmlzU3ByZWFkRWxlbWVudChhcmd1bWVudCkgJiYgdHMuaXNJZGVudGlmaWVyKGFyZ3VtZW50LmV4cHJlc3Npb24pICYmXG4gICAgICBhcmd1bWVudC5leHByZXNzaW9uLnRleHQgPT09ICdhcmd1bWVudHMnO1xufVxuXG4vKipcbiAqIEZpbmQgdGhlIHN0YXRlbWVudCB0aGF0IGNvbnRhaW5zIHRoZSBnaXZlbiBub2RlXG4gKiBAcGFyYW0gbm9kZSBhIG5vZGUgd2hvc2UgY29udGFpbmluZyBzdGF0ZW1lbnQgd2Ugd2lzaCB0byBmaW5kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb250YWluaW5nU3RhdGVtZW50KG5vZGU6IHRzLk5vZGUpOiB0cy5TdGF0ZW1lbnQge1xuICB3aGlsZSAobm9kZS5wYXJlbnQpIHtcbiAgICBpZiAodHMuaXNCbG9jayhub2RlLnBhcmVudCkgfHwgdHMuaXNTb3VyY2VGaWxlKG5vZGUucGFyZW50KSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgfVxuICByZXR1cm4gbm9kZSBhcyB0cy5TdGF0ZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGdldFJvb3RGaWxlT3JGYWlsKGJ1bmRsZTogQnVuZGxlUHJvZ3JhbSk6IHRzLlNvdXJjZUZpbGUge1xuICBjb25zdCByb290RmlsZSA9IGJ1bmRsZS5wcm9ncmFtLmdldFNvdXJjZUZpbGUoYnVuZGxlLnBhdGgpO1xuICBpZiAocm9vdEZpbGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlIGdpdmVuIHJvb3RQYXRoICR7cm9vdEZpbGV9IGlzIG5vdCBhIGZpbGUgb2YgdGhlIHByb2dyYW0uYCk7XG4gIH1cbiAgcmV0dXJuIHJvb3RGaWxlO1xufVxuXG5mdW5jdGlvbiBnZXROb25Sb290UGFja2FnZUZpbGVzKGJ1bmRsZTogQnVuZGxlUHJvZ3JhbSk6IHRzLlNvdXJjZUZpbGVbXSB7XG4gIGNvbnN0IHJvb3RGaWxlID0gYnVuZGxlLnByb2dyYW0uZ2V0U291cmNlRmlsZShidW5kbGUucGF0aCk7XG4gIHJldHVybiBidW5kbGUucHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihcbiAgICAgIGYgPT4gKGYgIT09IHJvb3RGaWxlKSAmJiBpc1dpdGhpblBhY2thZ2UoYnVuZGxlLnBhY2thZ2UsIGFic29sdXRlRnJvbVNvdXJjZUZpbGUoZikpKTtcbn1cblxuZnVuY3Rpb24gaXNUb3BMZXZlbChub2RlOiB0cy5Ob2RlKTogYm9vbGVhbiB7XG4gIHdoaWxlIChub2RlID0gbm9kZS5wYXJlbnQpIHtcbiAgICBpZiAodHMuaXNCbG9jayhub2RlKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBHZXQgYSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgYWN0dWFsIChvdXRlcikgZGVjbGFyYXRpb24gb2YgYSBjbGFzcyBmcm9tIGl0cyBpbXBsZW1lbnRhdGlvbi5cbiAqXG4gKiBTb21ldGltZXMsIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiBhIGNsYXNzIGlzIGFuIGV4cHJlc3Npb24gdGhhdCBpcyBoaWRkZW4gaW5zaWRlIGFuIElJRkUgYW5kXG4gKiBhc3NpZ25lZCB0byBhIHZhcmlhYmxlIG91dHNpZGUgdGhlIElJRkUsIHdoaWNoIGlzIHdoYXQgdGhlIHJlc3Qgb2YgdGhlIHByb2dyYW0gaW50ZXJhY3RzIHdpdGguXG4gKiBGb3IgZXhhbXBsZSxcbiAqXG4gKiBgYGBcbiAqIE91dGVyTm9kZSA9IEFsaWFzID0gKGZ1bmN0aW9uKCkgeyBmdW5jdGlvbiBJbm5lck5vZGUoKSB7fSByZXR1cm4gSW5uZXJOb2RlOyB9KSgpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIG5vZGUgYSBub2RlIHRoYXQgY291bGQgYmUgdGhlIGltcGxlbWVudGF0aW9uIGluc2lkZSBhbiBJSUZFLlxuICogQHJldHVybnMgYSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgb3V0ZXIgZGVjbGFyYXRpb24sIG9yIGBudWxsYCBpZiBpdCBpcyBkb2VzIG5vdCBtYXRjaCB0aGUgSUlGRVxuICogICAgIGZvcm1hdCBzaG93biBhYm92ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE91dGVyTm9kZUZyb21Jbm5lckRlY2xhcmF0aW9uKG5vZGU6IHRzLk5vZGUpOiB0cy5Ob2RlfG51bGwge1xuICBpZiAoIXRzLmlzRnVuY3Rpb25EZWNsYXJhdGlvbihub2RlKSAmJiAhdHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUpICYmXG4gICAgICAhdHMuaXNWYXJpYWJsZVN0YXRlbWVudChub2RlKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gSXQgbWlnaHQgYmUgdGhlIGZ1bmN0aW9uIGV4cHJlc3Npb24gaW5zaWRlIHRoZSBJSUZFLiBXZSBuZWVkIHRvIGdvIDUgbGV2ZWxzIHVwLi4uXG5cbiAgLy8gLSBJSUZFIGJvZHkuXG4gIGxldCBvdXRlck5vZGUgPSBub2RlLnBhcmVudDtcbiAgaWYgKCFvdXRlck5vZGUgfHwgIXRzLmlzQmxvY2sob3V0ZXJOb2RlKSkgcmV0dXJuIG51bGw7XG5cbiAgLy8gLSBJSUZFIGZ1bmN0aW9uIGV4cHJlc3Npb24uXG4gIG91dGVyTm9kZSA9IG91dGVyTm9kZS5wYXJlbnQ7XG4gIGlmICghb3V0ZXJOb2RlIHx8ICghdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24ob3V0ZXJOb2RlKSAmJiAhdHMuaXNBcnJvd0Z1bmN0aW9uKG91dGVyTm9kZSkpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgb3V0ZXJOb2RlID0gb3V0ZXJOb2RlLnBhcmVudDtcblxuICAvLyAtIFBhcmVudGhlc2lzIGluc2lkZSBJSUZFLlxuICBpZiAob3V0ZXJOb2RlICYmIHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24ob3V0ZXJOb2RlKSkgb3V0ZXJOb2RlID0gb3V0ZXJOb2RlLnBhcmVudDtcblxuICAvLyAtIElJRkUgY2FsbCBleHByZXNzaW9uLlxuICBpZiAoIW91dGVyTm9kZSB8fCAhdHMuaXNDYWxsRXhwcmVzc2lvbihvdXRlck5vZGUpKSByZXR1cm4gbnVsbDtcbiAgb3V0ZXJOb2RlID0gb3V0ZXJOb2RlLnBhcmVudDtcblxuICAvLyAtIFBhcmVudGhlc2lzIGFyb3VuZCBJSUZFLlxuICBpZiAob3V0ZXJOb2RlICYmIHRzLmlzUGFyZW50aGVzaXplZEV4cHJlc3Npb24ob3V0ZXJOb2RlKSkgb3V0ZXJOb2RlID0gb3V0ZXJOb2RlLnBhcmVudDtcblxuICAvLyAtIFNraXAgYW55IGFsaWFzZXMgYmV0d2VlbiB0aGUgSUlGRSBhbmQgdGhlIGZhciBsZWZ0IGhhbmQgc2lkZSBvZiBhbnkgYXNzaWdubWVudHMuXG4gIHdoaWxlIChpc0Fzc2lnbm1lbnQob3V0ZXJOb2RlLnBhcmVudCkpIHtcbiAgICBvdXRlck5vZGUgPSBvdXRlck5vZGUucGFyZW50O1xuICB9XG5cbiAgcmV0dXJuIG91dGVyTm9kZTtcbn1cbiJdfQ==