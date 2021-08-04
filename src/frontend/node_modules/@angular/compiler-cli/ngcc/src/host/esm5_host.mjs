/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { ClassMemberKind, isNamedFunctionDeclaration, KnownDeclaration, reflectObjectLiteral } from '../../../src/ngtsc/reflection';
import { getTsHelperFnFromDeclaration, getTsHelperFnFromIdentifier, hasNameIdentifier } from '../utils';
import { Esm2015ReflectionHost, getOuterNodeFromInnerDeclaration, getPropertyValueFromSymbol, isAssignmentStatement } from './esm2015_host';
/**
 * ESM5 packages contain ECMAScript IIFE functions that act like classes. For example:
 *
 * ```
 * var CommonModule = (function () {
 *  function CommonModule() {
 *  }
 *  CommonModule.decorators = [ ... ];
 *  return CommonModule;
 * ```
 *
 * * "Classes" are decorated if they have a static property called `decorators`.
 * * Members are decorated if there is a matching key on a static property
 *   called `propDecorators`.
 * * Constructor parameters decorators are found on an object returned from
 *   a static method called `ctorParameters`.
 *
 */
export class Esm5ReflectionHost extends Esm2015ReflectionHost {
    getBaseClassExpression(clazz) {
        const superBaseClassExpression = super.getBaseClassExpression(clazz);
        if (superBaseClassExpression !== null) {
            return superBaseClassExpression;
        }
        const iife = getIifeFn(this.getClassSymbol(clazz));
        if (iife === null)
            return null;
        if (iife.parameters.length !== 1 || !isSuperIdentifier(iife.parameters[0].name)) {
            return null;
        }
        if (!ts.isCallExpression(iife.parent)) {
            return null;
        }
        return iife.parent.arguments[0];
    }
    /**
     * Trace an identifier to its declaration, if possible.
     *
     * This method attempts to resolve the declaration of the given identifier, tracing back through
     * imports and re-exports until the original declaration statement is found. A `Declaration`
     * object is returned if the original declaration is found, or `null` is returned otherwise.
     *
     * In ES5, the implementation of a class is a function expression that is hidden inside an IIFE.
     * If we are looking for the declaration of the identifier of the inner function expression, we
     * will get hold of the outer "class" variable declaration and return its identifier instead. See
     * `getClassDeclarationFromInnerFunctionDeclaration()` for more info.
     *
     * @param id a TypeScript `ts.Identifier` to trace back to a declaration.
     *
     * @returns metadata about the `Declaration` if the original declaration is found, or `null`
     * otherwise.
     */
    getDeclarationOfIdentifier(id) {
        const declaration = super.getDeclarationOfIdentifier(id);
        if (declaration === null) {
            const nonEmittedNorImportedTsHelperDeclaration = getTsHelperFnFromIdentifier(id);
            if (nonEmittedNorImportedTsHelperDeclaration !== null) {
                // No declaration could be found for this identifier and its name matches a known TS helper
                // function. This can happen if a package is compiled with `noEmitHelpers: true` and
                // `importHelpers: false` (the default). This is, for example, the case with
                // `@nativescript/angular@9.0.0-next-2019-11-12-155500-01`.
                return {
                    kind: 1 /* Inline */,
                    node: id,
                    known: nonEmittedNorImportedTsHelperDeclaration,
                    viaModule: null,
                };
            }
        }
        if (declaration === null || declaration.node === null || declaration.known !== null) {
            return declaration;
        }
        if (!ts.isVariableDeclaration(declaration.node) || declaration.node.initializer !== undefined ||
            // VariableDeclaration => VariableDeclarationList => VariableStatement => IIFE Block
            !ts.isBlock(declaration.node.parent.parent.parent)) {
            return declaration;
        }
        // We might have an alias to another variable declaration.
        // Search the containing iife body for it.
        const block = declaration.node.parent.parent.parent;
        const aliasSymbol = this.checker.getSymbolAtLocation(declaration.node.name);
        for (let i = 0; i < block.statements.length; i++) {
            const statement = block.statements[i];
            // Looking for statement that looks like: `AliasedVariable = OriginalVariable;`
            if (isAssignmentStatement(statement) && ts.isIdentifier(statement.expression.left) &&
                ts.isIdentifier(statement.expression.right) &&
                this.checker.getSymbolAtLocation(statement.expression.left) === aliasSymbol) {
                return this.getDeclarationOfIdentifier(statement.expression.right);
            }
        }
        return declaration;
    }
    /**
     * Parse a function declaration to find the relevant metadata about it.
     *
     * In ESM5 we need to do special work with optional arguments to the function, since they get
     * their own initializer statement that needs to be parsed and then not included in the "body"
     * statements of the function.
     *
     * @param node the function declaration to parse.
     * @returns an object containing the node, statements and parameters of the function.
     */
    getDefinitionOfFunction(node) {
        const definition = super.getDefinitionOfFunction(node);
        if (definition === null) {
            return null;
        }
        // Filter out and capture parameter initializers
        if (definition.body !== null) {
            let lookingForInitializers = true;
            const statements = definition.body.filter(s => {
                lookingForInitializers =
                    lookingForInitializers && captureParamInitializer(s, definition.parameters);
                // If we are no longer looking for parameter initializers then we include this statement
                return !lookingForInitializers;
            });
            definition.body = statements;
        }
        return definition;
    }
    /**
     * Check whether a `Declaration` corresponds with a known declaration, such as a TypeScript helper
     * function, and set its `known` property to the appropriate `KnownDeclaration`.
     *
     * @param decl The `Declaration` to check.
     * @return The passed in `Declaration` (potentially enhanced with a `KnownDeclaration`).
     */
    detectKnownDeclaration(decl) {
        decl = super.detectKnownDeclaration(decl);
        // Also check for TS helpers
        if (decl.known === null && decl.node !== null) {
            decl.known = getTsHelperFnFromDeclaration(decl.node);
        }
        return decl;
    }
    ///////////// Protected Helpers /////////////
    /**
     * In ES5, the implementation of a class is a function expression that is hidden inside an IIFE,
     * whose value is assigned to a variable (which represents the class to the rest of the program).
     * So we might need to dig around to get hold of the "class" declaration.
     *
     * This method extracts a `NgccClassSymbol` if `declaration` is the function declaration inside
     * the IIFE. Otherwise, undefined is returned.
     *
     * @param declaration the declaration whose symbol we are finding.
     * @returns the symbol for the node or `undefined` if it is not a "class" or has no symbol.
     */
    getClassSymbolFromInnerDeclaration(declaration) {
        const classSymbol = super.getClassSymbolFromInnerDeclaration(declaration);
        if (classSymbol !== undefined) {
            return classSymbol;
        }
        if (!isNamedFunctionDeclaration(declaration)) {
            return undefined;
        }
        const outerNode = getOuterNodeFromInnerDeclaration(declaration);
        if (outerNode === null || !hasNameIdentifier(outerNode)) {
            return undefined;
        }
        return this.createClassSymbol(outerNode.name, declaration);
    }
    /**
     * Find the declarations of the constructor parameters of a class identified by its symbol.
     *
     * In ESM5, there is no "class" so the constructor that we want is actually the inner function
     * declaration inside the IIFE, whose return value is assigned to the outer variable declaration
     * (that represents the class to the rest of the program).
     *
     * @param classSymbol the symbol of the class (i.e. the outer variable declaration) whose
     * parameters we want to find.
     * @returns an array of `ts.ParameterDeclaration` objects representing each of the parameters in
     * the class's constructor or `null` if there is no constructor.
     */
    getConstructorParameterDeclarations(classSymbol) {
        const constructor = classSymbol.implementation.valueDeclaration;
        if (!ts.isFunctionDeclaration(constructor))
            return null;
        if (constructor.parameters.length > 0) {
            return Array.from(constructor.parameters);
        }
        if (this.isSynthesizedConstructor(constructor)) {
            return null;
        }
        return [];
    }
    /**
     * Get the parameter type and decorators for the constructor of a class,
     * where the information is stored on a static method of the class.
     *
     * In this case the decorators are stored in the body of a method
     * (`ctorParatemers`) attached to the constructor function.
     *
     * Note that unlike ESM2015 this is a function expression rather than an arrow
     * function:
     *
     * ```
     * SomeDirective.ctorParameters = function() { return [
     *   { type: ViewContainerRef, },
     *   { type: TemplateRef, },
     *   { type: IterableDiffers, },
     *   { type: undefined, decorators: [{ type: Inject, args: [INJECTED_TOKEN,] },] },
     * ]; };
     * ```
     *
     * @param paramDecoratorsProperty the property that holds the parameter info we want to get.
     * @returns an array of objects containing the type and decorators for each parameter.
     */
    getParamInfoFromStaticProperty(paramDecoratorsProperty) {
        const paramDecorators = getPropertyValueFromSymbol(paramDecoratorsProperty);
        // The decorators array may be wrapped in a function. If so unwrap it.
        const returnStatement = getReturnStatement(paramDecorators);
        const expression = returnStatement ? returnStatement.expression : paramDecorators;
        if (expression && ts.isArrayLiteralExpression(expression)) {
            const elements = expression.elements;
            return elements.map(reflectArrayElement).map(paramInfo => {
                const typeExpression = paramInfo && paramInfo.has('type') ? paramInfo.get('type') : null;
                const decoratorInfo = paramInfo && paramInfo.has('decorators') ? paramInfo.get('decorators') : null;
                const decorators = decoratorInfo && this.reflectDecorators(decoratorInfo);
                return { typeExpression, decorators };
            });
        }
        else if (paramDecorators !== undefined) {
            this.logger.warn('Invalid constructor parameter decorator in ' + paramDecorators.getSourceFile().fileName +
                ':\n', paramDecorators.getText());
        }
        return null;
    }
    /**
     * Reflect over a symbol and extract the member information, combining it with the
     * provided decorator information, and whether it is a static member.
     *
     * If a class member uses accessors (e.g getters and/or setters) then it gets downleveled
     * in ES5 to a single `Object.defineProperty()` call. In that case we must parse this
     * call to extract the one or two ClassMember objects that represent the accessors.
     *
     * @param symbol the symbol for the member to reflect over.
     * @param decorators an array of decorators associated with the member.
     * @param isStatic true if this member is static, false if it is an instance property.
     * @returns the reflected member information, or null if the symbol is not a member.
     */
    reflectMembers(symbol, decorators, isStatic) {
        const node = symbol.valueDeclaration || symbol.declarations && symbol.declarations[0];
        const propertyDefinition = node && getPropertyDefinition(node);
        if (propertyDefinition) {
            const members = [];
            if (propertyDefinition.setter) {
                members.push({
                    node: node,
                    implementation: propertyDefinition.setter,
                    kind: ClassMemberKind.Setter,
                    type: null,
                    name: symbol.name,
                    nameNode: null,
                    value: null,
                    isStatic: isStatic || false,
                    decorators: decorators || [],
                });
                // Prevent attaching the decorators to a potential getter. In ES5, we can't tell where the
                // decorators were originally attached to, however we only want to attach them to a single
                // `ClassMember` as otherwise ngtsc would handle the same decorators twice.
                decorators = undefined;
            }
            if (propertyDefinition.getter) {
                members.push({
                    node: node,
                    implementation: propertyDefinition.getter,
                    kind: ClassMemberKind.Getter,
                    type: null,
                    name: symbol.name,
                    nameNode: null,
                    value: null,
                    isStatic: isStatic || false,
                    decorators: decorators || [],
                });
            }
            return members;
        }
        const members = super.reflectMembers(symbol, decorators, isStatic);
        members && members.forEach(member => {
            if (member && member.kind === ClassMemberKind.Method && member.isStatic && member.node &&
                ts.isPropertyAccessExpression(member.node) && member.node.parent &&
                ts.isBinaryExpression(member.node.parent) &&
                ts.isFunctionExpression(member.node.parent.right)) {
                // Recompute the implementation for this member:
                // ES5 static methods are variable declarations so the declaration is actually the
                // initializer of the variable assignment
                member.implementation = member.node.parent.right;
            }
        });
        return members;
    }
    /**
     * Find statements related to the given class that may contain calls to a helper.
     *
     * In ESM5 code the helper calls are hidden inside the class's IIFE.
     *
     * @param classSymbol the class whose helper calls we are interested in. We expect this symbol
     * to reference the inner identifier inside the IIFE.
     * @returns an array of statements that may contain helper calls.
     */
    getStatementsForClass(classSymbol) {
        const classDeclarationParent = classSymbol.implementation.valueDeclaration.parent;
        return ts.isBlock(classDeclarationParent) ? Array.from(classDeclarationParent.statements) : [];
    }
    ///////////// Host Private Helpers /////////////
    /**
     * A constructor function may have been "synthesized" by TypeScript during JavaScript emit,
     * in the case no user-defined constructor exists and e.g. property initializers are used.
     * Those initializers need to be emitted into a constructor in JavaScript, so the TypeScript
     * compiler generates a synthetic constructor.
     *
     * We need to identify such constructors as ngcc needs to be able to tell if a class did
     * originally have a constructor in the TypeScript source. For ES5, we can not tell an
     * empty constructor apart from a synthesized constructor, but fortunately that does not
     * matter for the code generated by ngtsc.
     *
     * When a class has a superclass however, a synthesized constructor must not be considered
     * as a user-defined constructor as that prevents a base factory call from being created by
     * ngtsc, resulting in a factory function that does not inject the dependencies of the
     * superclass. Hence, we identify a default synthesized super call in the constructor body,
     * according to the structure that TypeScript's ES2015 to ES5 transformer generates in
     * https://github.com/Microsoft/TypeScript/blob/v3.2.2/src/compiler/transformers/es2015.ts#L1082-L1098
     *
     * Additionally, we handle synthetic delegate constructors that are emitted when TypeScript
     * downlevel's ES2015 synthetically generated to ES5. These vary slightly from the default
     * structure mentioned above because the ES2015 output uses a spread operator, for delegating
     * to the parent constructor, that is preserved through a TypeScript helper in ES5. e.g.
     *
     * ```
     * return _super.apply(this, tslib.__spread(arguments)) || this;
     * ```
     *
     * or, since TypeScript 4.2 it would be
     *
     * ```
     * return _super.apply(this, tslib.__spreadArray([], tslib.__read(arguments))) || this;
     * ```
     *
     * Such constructs can be still considered as synthetic delegate constructors as they are
     * the product of a common TypeScript to ES5 synthetic constructor, just being downleveled
     * to ES5 using `tsc`. See: https://github.com/angular/angular/issues/38453.
     *
     *
     * @param constructor a constructor function to test
     * @returns true if the constructor appears to have been synthesized
     */
    isSynthesizedConstructor(constructor) {
        if (!constructor.body)
            return false;
        const firstStatement = constructor.body.statements[0];
        if (!firstStatement)
            return false;
        return this.isSynthesizedSuperThisAssignment(firstStatement) ||
            this.isSynthesizedSuperReturnStatement(firstStatement);
    }
    /**
     * Identifies synthesized super calls which pass-through function arguments directly and are
     * being assigned to a common `_this` variable. The following patterns we intend to match:
     *
     * 1. Delegate call emitted by TypeScript when it emits ES5 directly.
     *   ```
     *   var _this = _super !== null && _super.apply(this, arguments) || this;
     *   ```
     *
     * 2. Delegate call emitted by TypeScript when it downlevel's ES2015 to ES5.
     *   ```
     *   var _this = _super.apply(this, tslib.__spread(arguments)) || this;
     *   ```
     *   or using the syntax emitted since TypeScript 4.2:
     *   ```
     *   return _super.apply(this, tslib.__spreadArray([], tslib.__read(arguments))) || this;
     *   ```
     *
     * @param statement a statement that may be a synthesized super call
     * @returns true if the statement looks like a synthesized super call
     */
    isSynthesizedSuperThisAssignment(statement) {
        if (!ts.isVariableStatement(statement))
            return false;
        const variableDeclarations = statement.declarationList.declarations;
        if (variableDeclarations.length !== 1)
            return false;
        const variableDeclaration = variableDeclarations[0];
        if (!ts.isIdentifier(variableDeclaration.name) ||
            !variableDeclaration.name.text.startsWith('_this'))
            return false;
        const initializer = variableDeclaration.initializer;
        if (!initializer)
            return false;
        return this.isSynthesizedDefaultSuperCall(initializer);
    }
    /**
     * Identifies synthesized super calls which pass-through function arguments directly and
     * are being returned. The following patterns correspond to synthetic super return calls:
     *
     * 1. Delegate call emitted by TypeScript when it emits ES5 directly.
     *   ```
     *   return _super !== null && _super.apply(this, arguments) || this;
     *   ```
     *
     * 2. Delegate call emitted by TypeScript when it downlevel's ES2015 to ES5.
     *   ```
     *   return _super.apply(this, tslib.__spread(arguments)) || this;
     *   ```
     *   or using the syntax emitted since TypeScript 4.2:
     *   ```
     *   return _super.apply(this, tslib.__spreadArray([], tslib.__read(arguments))) || this;
     *   ```
     *
     * @param statement a statement that may be a synthesized super call
     * @returns true if the statement looks like a synthesized super call
     */
    isSynthesizedSuperReturnStatement(statement) {
        if (!ts.isReturnStatement(statement))
            return false;
        const expression = statement.expression;
        if (!expression)
            return false;
        return this.isSynthesizedDefaultSuperCall(expression);
    }
    /**
     * Identifies synthesized super calls which pass-through function arguments directly. The
     * synthetic delegate super call match the following patterns we intend to match:
     *
     * 1. Delegate call emitted by TypeScript when it emits ES5 directly.
     *   ```
     *   _super !== null && _super.apply(this, arguments) || this;
     *   ```
     *
     * 2. Delegate call emitted by TypeScript when it downlevel's ES2015 to ES5.
     *   ```
     *   _super.apply(this, tslib.__spread(arguments)) || this;
     *   ```
     *   or using the syntax emitted since TypeScript 4.2:
     *   ```
     *   return _super.apply(this, tslib.__spreadArray([], tslib.__read(arguments))) || this;
     *   ```
     *
     * @param expression an expression that may represent a default super call
     * @returns true if the expression corresponds with the above form
     */
    isSynthesizedDefaultSuperCall(expression) {
        if (!isBinaryExpr(expression, ts.SyntaxKind.BarBarToken))
            return false;
        if (expression.right.kind !== ts.SyntaxKind.ThisKeyword)
            return false;
        const left = expression.left;
        if (isBinaryExpr(left, ts.SyntaxKind.AmpersandAmpersandToken)) {
            return isSuperNotNull(left.left) && this.isSuperApplyCall(left.right);
        }
        else {
            return this.isSuperApplyCall(left);
        }
    }
    /**
     * Tests whether the expression corresponds to a `super` call passing through
     * function arguments without any modification. e.g.
     *
     * ```
     * _super !== null && _super.apply(this, arguments) || this;
     * ```
     *
     * This structure is generated by TypeScript when transforming ES2015 to ES5, see
     * https://github.com/Microsoft/TypeScript/blob/v3.2.2/src/compiler/transformers/es2015.ts#L1148-L1163
     *
     * Additionally, we also handle cases where `arguments` are wrapped by a TypeScript spread
     * helper.
     * This can happen if ES2015 class output contain auto-generated constructors due to class
     * members. The ES2015 output will be using `super(...arguments)` to delegate to the superclass,
     * but once downleveled to ES5, the spread operator will be persisted through a TypeScript spread
     * helper. For example:
     *
     * ```
     * _super.apply(this, __spread(arguments)) || this;
     * ```
     *
     * or, since TypeScript 4.2 it would be
     *
     * ```
     * _super.apply(this, tslib.__spreadArray([], tslib.__read(arguments))) || this;
     * ```
     *
     * More details can be found in: https://github.com/angular/angular/issues/38453.
     *
     * @param expression an expression that may represent a default super call
     * @returns true if the expression corresponds with the above form
     */
    isSuperApplyCall(expression) {
        if (!ts.isCallExpression(expression) || expression.arguments.length !== 2)
            return false;
        const targetFn = expression.expression;
        if (!ts.isPropertyAccessExpression(targetFn))
            return false;
        if (!isSuperIdentifier(targetFn.expression))
            return false;
        if (targetFn.name.text !== 'apply')
            return false;
        const thisArgument = expression.arguments[0];
        if (thisArgument.kind !== ts.SyntaxKind.ThisKeyword)
            return false;
        const argumentsExpr = expression.arguments[1];
        // If the super is directly invoked with `arguments`, return `true`. This represents the
        // common TypeScript output where the delegate constructor super call matches the following
        // pattern: `super.apply(this, arguments)`.
        if (isArgumentsIdentifier(argumentsExpr)) {
            return true;
        }
        // The other scenario we intend to detect: The `arguments` variable might be wrapped with the
        // TypeScript spread helper (either through tslib or inlined). This can happen if an explicit
        // delegate constructor uses `super(...arguments)` in ES2015 and is downleveled to ES5 using
        // `--downlevelIteration`.
        return this.isSpreadArgumentsExpression(argumentsExpr);
    }
    /**
     * Determines if the provided expression is one of the following call expressions:
     *
     * 1. `__spread(arguments)`
     * 2. `__spreadArray([], __read(arguments))`
     *
     * The tslib helpers may have been emitted inline as in the above example, or they may be read
     * from a namespace import.
     */
    isSpreadArgumentsExpression(expression) {
        const call = this.extractKnownHelperCall(expression);
        if (call === null) {
            return false;
        }
        if (call.helper === KnownDeclaration.TsHelperSpread) {
            // `__spread(arguments)`
            return call.args.length === 1 && isArgumentsIdentifier(call.args[0]);
        }
        else if (call.helper === KnownDeclaration.TsHelperSpreadArray) {
            // `__spreadArray([], __read(arguments))`
            if (call.args.length !== 2) {
                return false;
            }
            const firstArg = call.args[0];
            if (!ts.isArrayLiteralExpression(firstArg) || firstArg.elements.length !== 0) {
                return false;
            }
            const secondArg = this.extractKnownHelperCall(call.args[1]);
            if (secondArg === null || secondArg.helper !== KnownDeclaration.TsHelperRead) {
                return false;
            }
            return secondArg.args.length === 1 && isArgumentsIdentifier(secondArg.args[0]);
        }
        else {
            return false;
        }
    }
    /**
     * Inspects the provided expression and determines if it corresponds with a known helper function
     * as receiver expression.
     */
    extractKnownHelperCall(expression) {
        if (!ts.isCallExpression(expression)) {
            return null;
        }
        const receiverExpr = expression.expression;
        // The helper could be globally available, or accessed through a namespaced import. Hence we
        // support a property access here as long as it resolves to the actual known TypeScript helper.
        let receiver = null;
        if (ts.isIdentifier(receiverExpr)) {
            receiver = this.getDeclarationOfIdentifier(receiverExpr);
        }
        else if (ts.isPropertyAccessExpression(receiverExpr) && ts.isIdentifier(receiverExpr.name)) {
            receiver = this.getDeclarationOfIdentifier(receiverExpr.name);
        }
        if (receiver === null || receiver.known === null) {
            return null;
        }
        return {
            helper: receiver.known,
            args: expression.arguments,
        };
    }
}
/**
 * In ES5, getters and setters have been downleveled into call expressions of
 * `Object.defineProperty`, such as
 *
 * ```
 * Object.defineProperty(Clazz.prototype, "property", {
 *   get: function () {
 *       return 'value';
 *   },
 *   set: function (value) {
 *       this.value = value;
 *   },
 *   enumerable: true,
 *   configurable: true
 * });
 * ```
 *
 * This function inspects the given node to determine if it corresponds with such a call, and if so
 * extracts the `set` and `get` function expressions from the descriptor object, if they exist.
 *
 * @param node The node to obtain the property definition from.
 * @returns The property definition if the node corresponds with accessor, null otherwise.
 */
function getPropertyDefinition(node) {
    if (!ts.isCallExpression(node))
        return null;
    const fn = node.expression;
    if (!ts.isPropertyAccessExpression(fn) || !ts.isIdentifier(fn.expression) ||
        fn.expression.text !== 'Object' || fn.name.text !== 'defineProperty')
        return null;
    const descriptor = node.arguments[2];
    if (!descriptor || !ts.isObjectLiteralExpression(descriptor))
        return null;
    return {
        setter: readPropertyFunctionExpression(descriptor, 'set'),
        getter: readPropertyFunctionExpression(descriptor, 'get'),
    };
}
function readPropertyFunctionExpression(object, name) {
    const property = object.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name);
    return property && ts.isFunctionExpression(property.initializer) && property.initializer || null;
}
function getReturnStatement(declaration) {
    return declaration && ts.isFunctionExpression(declaration) ?
        declaration.body.statements.find(ts.isReturnStatement) :
        undefined;
}
function reflectArrayElement(element) {
    return ts.isObjectLiteralExpression(element) ? reflectObjectLiteral(element) : null;
}
function isArgumentsIdentifier(expression) {
    return ts.isIdentifier(expression) && expression.text === 'arguments';
}
function isSuperNotNull(expression) {
    return isBinaryExpr(expression, ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
        isSuperIdentifier(expression.left);
}
function isBinaryExpr(expression, operator) {
    return ts.isBinaryExpression(expression) && expression.operatorToken.kind === operator;
}
function isSuperIdentifier(node) {
    // Verify that the identifier is prefixed with `_super`. We don't test for equivalence
    // as TypeScript may have suffixed the name, e.g. `_super_1` to avoid name conflicts.
    // Requiring only a prefix should be sufficiently accurate.
    return ts.isIdentifier(node) && node.text.startsWith('_super');
}
/**
 * Parse the statement to extract the ESM5 parameter initializer if there is one.
 * If one is found, add it to the appropriate parameter in the `parameters` collection.
 *
 * The form we are looking for is:
 *
 * ```
 * if (arg === void 0) { arg = initializer; }
 * ```
 *
 * @param statement a statement that may be initializing an optional parameter
 * @param parameters the collection of parameters that were found in the function definition
 * @returns true if the statement was a parameter initializer
 */
function captureParamInitializer(statement, parameters) {
    if (ts.isIfStatement(statement) && isUndefinedComparison(statement.expression) &&
        ts.isBlock(statement.thenStatement) && statement.thenStatement.statements.length === 1) {
        const ifStatementComparison = statement.expression; // (arg === void 0)
        const thenStatement = statement.thenStatement.statements[0]; // arg = initializer;
        if (isAssignmentStatement(thenStatement)) {
            const comparisonName = ifStatementComparison.left.text;
            const assignmentName = thenStatement.expression.left.text;
            if (comparisonName === assignmentName) {
                const parameter = parameters.find(p => p.name === comparisonName);
                if (parameter) {
                    parameter.initializer = thenStatement.expression.right;
                    return true;
                }
            }
        }
    }
    return false;
}
function isUndefinedComparison(expression) {
    return ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isVoidExpression(expression.right) && ts.isIdentifier(expression.left);
}
/**
 * Parse the declaration of the given `classSymbol` to find the IIFE wrapper function.
 *
 * This function may accept a `_super` argument if there is a base class.
 *
 * ```
 * var TestClass = (function (_super) {
 *   __extends(TestClass, _super);
 *   function TestClass() {}
 *   return TestClass;
 * }(BaseClass));
 * ```
 *
 * @param classSymbol the class whose iife wrapper function we want to get.
 * @returns the IIFE function or null if it could not be parsed.
 */
function getIifeFn(classSymbol) {
    if (classSymbol === undefined) {
        return null;
    }
    const innerDeclaration = classSymbol.implementation.valueDeclaration;
    const iifeBody = innerDeclaration.parent;
    if (!ts.isBlock(iifeBody)) {
        return null;
    }
    const iifeWrapper = iifeBody.parent;
    return iifeWrapper && ts.isFunctionExpression(iifeWrapper) ? iifeWrapper : null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtNV9ob3N0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2hvc3QvZXNtNV9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE9BQU8sRUFBZ0MsZUFBZSxFQUErRCwwQkFBMEIsRUFBRSxnQkFBZ0IsRUFBYSxvQkFBb0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3pPLE9BQU8sRUFBQyw0QkFBNEIsRUFBRSwyQkFBMkIsRUFBRSxpQkFBaUIsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUV0RyxPQUFPLEVBQUMscUJBQXFCLEVBQUUsZ0NBQWdDLEVBQUUsMEJBQTBCLEVBQUUscUJBQXFCLEVBQVksTUFBTSxnQkFBZ0IsQ0FBQztBQUlySjs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7QUFDSCxNQUFNLE9BQU8sa0JBQW1CLFNBQVEscUJBQXFCO0lBQzNELHNCQUFzQixDQUFDLEtBQXVCO1FBQzVDLE1BQU0sd0JBQXdCLEdBQUcsS0FBSyxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JFLElBQUksd0JBQXdCLEtBQUssSUFBSSxFQUFFO1lBQ3JDLE9BQU8sd0JBQXdCLENBQUM7U0FDakM7UUFFRCxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ25ELElBQUksSUFBSSxLQUFLLElBQUk7WUFBRSxPQUFPLElBQUksQ0FBQztRQUUvQixJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDL0UsT0FBTyxJQUFJLENB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QUUsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBDbGFzc01lbWJlciwgQ2xhc3NNZW1iZXJLaW5kLCBEZWNsYXJhdGlvbiwgRGVjbGFyYXRpb25LaW5kLCBEZWNvcmF0b3IsIEZ1bmN0aW9uRGVmaW5pdGlvbiwgaXNOYW1lZEZ1bmN0aW9uRGVjbGFyYXRpb24sIEtub3duRGVjbGFyYXRpb24sIFBhcmFtZXRlciwgcmVmbGVjdE9iamVjdExpdGVyYWx9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9yZWZsZWN0aW9uJztcbmltcG9ydCB7Z2V0VHNIZWxwZXJGbkZyb21EZWNsYXJhdGlvbiwgZ2V0VHNIZWxwZXJGbkZyb21JZGVudGlmaWVyLCBoYXNOYW1lSWRlbnRpZmllcn0gZnJvbSAnLi4vdXRpbHMnO1xuXG5pbXBvcnQge0VzbTIwMTVSZWZsZWN0aW9uSG9zdCwgZ2V0T3V0ZXJOb2RlRnJvbUlubmVyRGVjbGFyYXRpb24sIGdldFByb3BlcnR5VmFsdWVGcm9tU3ltYm9sLCBpc0Fzc2lnbm1lbnRTdGF0ZW1lbnQsIFBhcmFtSW5mb30gZnJvbSAnLi9lc20yMDE1X2hvc3QnO1xuaW1wb3J0IHtOZ2NjQ2xhc3NTeW1ib2x9IGZyb20gJy4vbmdjY19ob3N0JztcblxuXG4vKipcbiAqIEVTTTUgcGFja2FnZXMgY29udGFpbiBFQ01BU2NyaXB0IElJRkUgZnVuY3Rpb25zIHRoYXQgYWN0IGxpa2UgY2xhc3Nlcy4gRm9yIGV4YW1wbGU6XG4gKlxuICogYGBgXG4gKiB2YXIgQ29tbW9uTW9kdWxlID0gKGZ1bmN0aW9uICgpIHtcbiAqICBmdW5jdGlvbiBDb21tb25Nb2R1bGUoKSB7XG4gKiAgfVxuICogIENvbW1vbk1vZHVsZS5kZWNvcmF0b3JzID0gWyAuLi4gXTtcbiAqICByZXR1cm4gQ29tbW9uTW9kdWxlO1xuICogYGBgXG4gKlxuICogKiBcIkNsYXNzZXNcIiBhcmUgZGVjb3JhdGVkIGlmIHRoZXkgaGF2ZSBhIHN0YXRpYyBwcm9wZXJ0eSBjYWxsZWQgYGRlY29yYXRvcnNgLlxuICogKiBNZW1iZXJzIGFyZSBkZWNvcmF0ZWQgaWYgdGhlcmUgaXMgYSBtYXRjaGluZyBrZXkgb24gYSBzdGF0aWMgcHJvcGVydHlcbiAqICAgY2FsbGVkIGBwcm9wRGVjb3JhdG9yc2AuXG4gKiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnMgZGVjb3JhdG9ycyBhcmUgZm91bmQgb24gYW4gb2JqZWN0IHJldHVybmVkIGZyb21cbiAqICAgYSBzdGF0aWMgbWV0aG9kIGNhbGxlZCBgY3RvclBhcmFtZXRlcnNgLlxuICpcbiAqL1xuZXhwb3J0IGNsYXNzIEVzbTVSZWZsZWN0aW9uSG9zdCBleHRlbmRzIEVzbTIwMTVSZWZsZWN0aW9uSG9zdCB7XG4gIGdldEJhc2VDbGFzc0V4cHJlc3Npb24oY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGNvbnN0IHN1cGVyQmFzZUNsYXNzRXhwcmVzc2lvbiA9IHN1cGVyLmdldEJhc2VDbGFzc0V4cHJlc3Npb24oY2xhenopO1xuICAgIGlmIChzdXBlckJhc2VDbGFzc0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBzdXBlckJhc2VDbGFzc0V4cHJlc3Npb247XG4gICAgfVxuXG4gICAgY29uc3QgaWlmZSA9IGdldElpZmVGbih0aGlzLmdldENsYXNzU3ltYm9sKGNsYXp6KSk7XG4gICAgaWYgKGlpZmUgPT09IG51bGwpIHJldHVybiBudWxsO1xuXG4gICAgaWYgKGlpZmUucGFyYW1ldGVycy5sZW5ndGggIT09IDEgfHwgIWlzU3VwZXJJZGVudGlmaWVyKGlpZmUucGFyYW1ldGVyc1swXS5uYW1lKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCF0cy5pc0NhbGxFeHByZXNzaW9uKGlpZmUucGFyZW50KSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGlpZmUucGFyZW50LmFyZ3VtZW50c1swXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFjZSBhbiBpZGVudGlmaWVyIHRvIGl0cyBkZWNsYXJhdGlvbiwgaWYgcG9zc2libGUuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGF0dGVtcHRzIHRvIHJlc29sdmUgdGhlIGRlY2xhcmF0aW9uIG9mIHRoZSBnaXZlbiBpZGVudGlmaWVyLCB0cmFjaW5nIGJhY2sgdGhyb3VnaFxuICAgKiBpbXBvcnRzIGFuZCByZS1leHBvcnRzIHVudGlsIHRoZSBvcmlnaW5hbCBkZWNsYXJhdGlvbiBzdGF0ZW1lbnQgaXMgZm91bmQuIEEgYERlY2xhcmF0aW9uYFxuICAgKiBvYmplY3QgaXMgcmV0dXJuZWQgaWYgdGhlIG9yaWdpbmFsIGRlY2xhcmF0aW9uIGlzIGZvdW5kLCBvciBgbnVsbGAgaXMgcmV0dXJuZWQgb3RoZXJ3aXNlLlxuICAgKlxuICAgKiBJbiBFUzUsIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiBhIGNsYXNzIGlzIGEgZnVuY3Rpb24gZXhwcmVzc2lvbiB0aGF0IGlzIGhpZGRlbiBpbnNpZGUgYW4gSUlGRS5cbiAgICogSWYgd2UgYXJlIGxvb2tpbmcgZm9yIHRoZSBkZWNsYXJhdGlvbiBvZiB0aGUgaWRlbnRpZmllciBvZiB0aGUgaW5uZXIgZnVuY3Rpb24gZXhwcmVzc2lvbiwgd2VcbiAgICogd2lsbCBnZXQgaG9sZCBvZiB0aGUgb3V0ZXIgXCJjbGFzc1wiIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGFuZCByZXR1cm4gaXRzIGlkZW50aWZpZXIgaW5zdGVhZC4gU2VlXG4gICAqIGBnZXRDbGFzc0RlY2xhcmF0aW9uRnJvbUlubmVyRnVuY3Rpb25EZWNsYXJhdGlvbigpYCBmb3IgbW9yZSBpbmZvLlxuICAgKlxuICAgKiBAcGFyYW0gaWQgYSBUeXBlU2NyaXB0IGB0cy5JZGVudGlmaWVyYCB0byB0cmFjZSBiYWNrIHRvIGEgZGVjbGFyYXRpb24uXG4gICAqXG4gICAqIEByZXR1cm5zIG1ldGFkYXRhIGFib3V0IHRoZSBgRGVjbGFyYXRpb25gIGlmIHRoZSBvcmlnaW5hbCBkZWNsYXJhdGlvbiBpcyBmb3VuZCwgb3IgYG51bGxgXG4gICAqIG90aGVyd2lzZS5cbiAgICovXG4gIGdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSBzdXBlci5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihpZCk7XG5cbiAgICBpZiAoZGVjbGFyYXRpb24gPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IG5vbkVtaXR0ZWROb3JJbXBvcnRlZFRzSGVscGVyRGVjbGFyYXRpb24gPSBnZXRUc0hlbHBlckZuRnJvbUlkZW50aWZpZXIoaWQpO1xuICAgICAgaWYgKG5vbkVtaXR0ZWROb3JJbXBvcnRlZFRzSGVscGVyRGVjbGFyYXRpb24gIT09IG51bGwpIHtcbiAgICAgICAgLy8gTm8gZGVjbGFyYXRpb24gY291bGQgYmUgZm91bmQgZm9yIHRoaXMgaWRlbnRpZmllciBhbmQgaXRzIG5hbWUgbWF0Y2hlcyBhIGtub3duIFRTIGhlbHBlclxuICAgICAgICAvLyBmdW5jdGlvbi4gVGhpcyBjYW4gaGFwcGVuIGlmIGEgcGFja2FnZSBpcyBjb21waWxlZCB3aXRoIGBub0VtaXRIZWxwZXJzOiB0cnVlYCBhbmRcbiAgICAgICAgLy8gYGltcG9ydEhlbHBlcnM6IGZhbHNlYCAodGhlIGRlZmF1bHQpLiBUaGlzIGlzLCBmb3IgZXhhbXBsZSwgdGhlIGNhc2Ugd2l0aFxuICAgICAgICAvLyBgQG5hdGl2ZXNjcmlwdC9hbmd1bGFyQDkuMC4wLW5leHQtMjAxOS0xMS0xMi0xNTU1MDAtMDFgLlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGtpbmQ6IERlY2xhcmF0aW9uS2luZC5JbmxpbmUsXG4gICAgICAgICAgbm9kZTogaWQsXG4gICAgICAgICAga25vd246IG5vbkVtaXR0ZWROb3JJbXBvcnRlZFRzSGVscGVyRGVjbGFyYXRpb24sXG4gICAgICAgICAgdmlhTW9kdWxlOiBudWxsLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkZWNsYXJhdGlvbiA9PT0gbnVsbCB8fCBkZWNsYXJhdGlvbi5ub2RlID09PSBudWxsIHx8IGRlY2xhcmF0aW9uLmtub3duICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gZGVjbGFyYXRpb247XG4gICAgfVxuXG4gICAgaWYgKCF0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbGFyYXRpb24ubm9kZSkgfHwgZGVjbGFyYXRpb24ubm9kZS5pbml0aWFsaXplciAhPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIC8vIFZhcmlhYmxlRGVjbGFyYXRpb24gPT4gVmFyaWFibGVEZWNsYXJhdGlvbkxpc3QgPT4gVmFyaWFibGVTdGF0ZW1lbnQgPT4gSUlGRSBCbG9ja1xuICAgICAgICAhdHMuaXNCbG9jayhkZWNsYXJhdGlvbi5ub2RlLnBhcmVudC5wYXJlbnQucGFyZW50KSkge1xuICAgICAgcmV0dXJuIGRlY2xhcmF0aW9uO1xuICAgIH1cblxuICAgIC8vIFdlIG1pZ2h0IGhhdmUgYW4gYWxpYXMgdG8gYW5vdGhlciB2YXJpYWJsZSBkZWNsYXJhdGlvbi5cbiAgICAvLyBTZWFyY2ggdGhlIGNvbnRhaW5pbmcgaWlmZSBib2R5IGZvciBpdC5cbiAgICBjb25zdCBibG9jayA9IGRlY2xhcmF0aW9uLm5vZGUucGFyZW50LnBhcmVudC5wYXJlbnQ7XG4gICAgY29uc3QgYWxpYXNTeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihkZWNsYXJhdGlvbi5ub2RlLm5hbWUpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmxvY2suc3RhdGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc3RhdGVtZW50ID0gYmxvY2suc3RhdGVtZW50c1tpXTtcbiAgICAgIC8vIExvb2tpbmcgZm9yIHN0YXRlbWVudCB0aGF0IGxvb2tzIGxpa2U6IGBBbGlhc2VkVmFyaWFibGUgPSBPcmlnaW5hbFZhcmlhYmxlO2BcbiAgICAgIGlmIChpc0Fzc2lnbm1lbnRTdGF0ZW1lbnQoc3RhdGVtZW50KSAmJiB0cy5pc0lkZW50aWZpZXIoc3RhdGVtZW50LmV4cHJlc3Npb24ubGVmdCkgJiZcbiAgICAgICAgICB0cy5pc0lkZW50aWZpZXIoc3RhdGVtZW50LmV4cHJlc3Npb24ucmlnaHQpICYmXG4gICAgICAgICAgdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oc3RhdGVtZW50LmV4cHJlc3Npb24ubGVmdCkgPT09IGFsaWFzU3ltYm9sKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKHN0YXRlbWVudC5leHByZXNzaW9uLnJpZ2h0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVjbGFyYXRpb247XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgYSBmdW5jdGlvbiBkZWNsYXJhdGlvbiB0byBmaW5kIHRoZSByZWxldmFudCBtZXRhZGF0YSBhYm91dCBpdC5cbiAgICpcbiAgICogSW4gRVNNNSB3ZSBuZWVkIHRvIGRvIHNwZWNpYWwgd29yayB3aXRoIG9wdGlvbmFsIGFyZ3VtZW50cyB0byB0aGUgZnVuY3Rpb24sIHNpbmNlIHRoZXkgZ2V0XG4gICAqIHRoZWlyIG93biBpbml0aWFsaXplciBzdGF0ZW1lbnQgdGhhdCBuZWVkcyB0byBiZSBwYXJzZWQgYW5kIHRoZW4gbm90IGluY2x1ZGVkIGluIHRoZSBcImJvZHlcIlxuICAgKiBzdGF0ZW1lbnRzIG9mIHRoZSBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIG5vZGUgdGhlIGZ1bmN0aW9uIGRlY2xhcmF0aW9uIHRvIHBhcnNlLlxuICAgKiBAcmV0dXJucyBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgbm9kZSwgc3RhdGVtZW50cyBhbmQgcGFyYW1ldGVycyBvZiB0aGUgZnVuY3Rpb24uXG4gICAqL1xuICBnZXREZWZpbml0aW9uT2ZGdW5jdGlvbihub2RlOiB0cy5Ob2RlKTogRnVuY3Rpb25EZWZpbml0aW9ufG51bGwge1xuICAgIGNvbnN0IGRlZmluaXRpb24gPSBzdXBlci5nZXREZWZpbml0aW9uT2ZGdW5jdGlvbihub2RlKTtcbiAgICBpZiAoZGVmaW5pdGlvbiA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gRmlsdGVyIG91dCBhbmQgY2FwdHVyZSBwYXJhbWV0ZXIgaW5pdGlhbGl6ZXJzXG4gICAgaWYgKGRlZmluaXRpb24uYm9keSAhPT0gbnVsbCkge1xuICAgICAgbGV0IGxvb2tpbmdGb3JJbml0aWFsaXplcnMgPSB0cnVlO1xuICAgICAgY29uc3Qgc3RhdGVtZW50cyA9IGRlZmluaXRpb24uYm9keS5maWx0ZXIocyA9PiB7XG4gICAgICAgIGxvb2tpbmdGb3JJbml0aWFsaXplcnMgPVxuICAgICAgICAgICAgbG9va2luZ0ZvckluaXRpYWxpemVycyAmJiBjYXB0dXJlUGFyYW1Jbml0aWFsaXplcihzLCBkZWZpbml0aW9uLnBhcmFtZXRlcnMpO1xuICAgICAgICAvLyBJZiB3ZSBhcmUgbm8gbG9uZ2VyIGxvb2tpbmcgZm9yIHBhcmFtZXRlciBpbml0aWFsaXplcnMgdGhlbiB3ZSBpbmNsdWRlIHRoaXMgc3RhdGVtZW50XG4gICAgICAgIHJldHVybiAhbG9va2luZ0ZvckluaXRpYWxpemVycztcbiAgICAgIH0pO1xuICAgICAgZGVmaW5pdGlvbi5ib2R5ID0gc3RhdGVtZW50cztcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmaW5pdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIGEgYERlY2xhcmF0aW9uYCBjb3JyZXNwb25kcyB3aXRoIGEga25vd24gZGVjbGFyYXRpb24sIHN1Y2ggYXMgYSBUeXBlU2NyaXB0IGhlbHBlclxuICAgKiBmdW5jdGlvbiwgYW5kIHNldCBpdHMgYGtub3duYCBwcm9wZXJ0eSB0byB0aGUgYXBwcm9wcmlhdGUgYEtub3duRGVjbGFyYXRpb25gLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbCBUaGUgYERlY2xhcmF0aW9uYCB0byBjaGVjay5cbiAgICogQHJldHVybiBUaGUgcGFzc2VkIGluIGBEZWNsYXJhdGlvbmAgKHBvdGVudGlhbGx5IGVuaGFuY2VkIHdpdGggYSBgS25vd25EZWNsYXJhdGlvbmApLlxuICAgKi9cbiAgZGV0ZWN0S25vd25EZWNsYXJhdGlvbjxUIGV4dGVuZHMgRGVjbGFyYXRpb24+KGRlY2w6IFQpOiBUIHtcbiAgICBkZWNsID0gc3VwZXIuZGV0ZWN0S25vd25EZWNsYXJhdGlvbihkZWNsKTtcblxuICAgIC8vIEFsc28gY2hlY2sgZm9yIFRTIGhlbHBlcnNcbiAgICBpZiAoZGVjbC5rbm93biA9PT0gbnVsbCAmJiBkZWNsLm5vZGUgIT09IG51bGwpIHtcbiAgICAgIGRlY2wua25vd24gPSBnZXRUc0hlbHBlckZuRnJvbURlY2xhcmF0aW9uKGRlY2wubm9kZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY2w7XG4gIH1cblxuXG4gIC8vLy8vLy8vLy8vLy8gUHJvdGVjdGVkIEhlbHBlcnMgLy8vLy8vLy8vLy8vL1xuXG4gIC8qKlxuICAgKiBJbiBFUzUsIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiBhIGNsYXNzIGlzIGEgZnVuY3Rpb24gZXhwcmVzc2lvbiB0aGF0IGlzIGhpZGRlbiBpbnNpZGUgYW4gSUlGRSxcbiAgICogd2hvc2UgdmFsdWUgaXMgYXNzaWduZWQgdG8gYSB2YXJpYWJsZSAod2hpY2ggcmVwcmVzZW50cyB0aGUgY2xhc3MgdG8gdGhlIHJlc3Qgb2YgdGhlIHByb2dyYW0pLlxuICAgKiBTbyB3ZSBtaWdodCBuZWVkIHRvIGRpZyBhcm91bmQgdG8gZ2V0IGhvbGQgb2YgdGhlIFwiY2xhc3NcIiBkZWNsYXJhdGlvbi5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgZXh0cmFjdHMgYSBgTmdjY0NsYXNzU3ltYm9sYCBpZiBgZGVjbGFyYXRpb25gIGlzIHRoZSBmdW5jdGlvbiBkZWNsYXJhdGlvbiBpbnNpZGVcbiAgICogdGhlIElJRkUuIE90aGVyd2lzZSwgdW5kZWZpbmVkIGlzIHJldHVybmVkLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbGFyYXRpb24gdGhlIGRlY2xhcmF0aW9uIHdob3NlIHN5bWJvbCB3ZSBhcmUgZmluZGluZy5cbiAgICogQHJldHVybnMgdGhlIHN5bWJvbCBmb3IgdGhlIG5vZGUgb3IgYHVuZGVmaW5lZGAgaWYgaXQgaXMgbm90IGEgXCJjbGFzc1wiIG9yIGhhcyBubyBzeW1ib2wuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0Q2xhc3NTeW1ib2xGcm9tSW5uZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbjogdHMuTm9kZSk6IE5nY2NDbGFzc1N5bWJvbHx1bmRlZmluZWQge1xuICAgIGNvbnN0IGNsYXNzU3ltYm9sID0gc3VwZXIuZ2V0Q2xhc3NTeW1ib2xGcm9tSW5uZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbik7XG4gICAgaWYgKGNsYXNzU3ltYm9sICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBjbGFzc1N5bWJvbDtcbiAgICB9XG5cbiAgICBpZiAoIWlzTmFtZWRGdW5jdGlvbkRlY2xhcmF0aW9uKGRlY2xhcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCBvdXRlck5vZGUgPSBnZXRPdXRlck5vZGVGcm9tSW5uZXJEZWNsYXJhdGlvbihkZWNsYXJhdGlvbik7XG4gICAgaWYgKG91dGVyTm9kZSA9PT0gbnVsbCB8fCAhaGFzTmFtZUlkZW50aWZpZXIob3V0ZXJOb2RlKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzc1N5bWJvbChvdXRlck5vZGUubmFtZSwgZGVjbGFyYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgdGhlIGRlY2xhcmF0aW9ucyBvZiB0aGUgY29uc3RydWN0b3IgcGFyYW1ldGVycyBvZiBhIGNsYXNzIGlkZW50aWZpZWQgYnkgaXRzIHN5bWJvbC5cbiAgICpcbiAgICogSW4gRVNNNSwgdGhlcmUgaXMgbm8gXCJjbGFzc1wiIHNvIHRoZSBjb25zdHJ1Y3RvciB0aGF0IHdlIHdhbnQgaXMgYWN0dWFsbHkgdGhlIGlubmVyIGZ1bmN0aW9uXG4gICAqIGRlY2xhcmF0aW9uIGluc2lkZSB0aGUgSUlGRSwgd2hvc2UgcmV0dXJuIHZhbHVlIGlzIGFzc2lnbmVkIHRvIHRoZSBvdXRlciB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgKiAodGhhdCByZXByZXNlbnRzIHRoZSBjbGFzcyB0byB0aGUgcmVzdCBvZiB0aGUgcHJvZ3JhbSkuXG4gICAqXG4gICAqIEBwYXJhbSBjbGFzc1N5bWJvbCB0aGUgc3ltYm9sIG9mIHRoZSBjbGFzcyAoaS5lLiB0aGUgb3V0ZXIgdmFyaWFibGUgZGVjbGFyYXRpb24pIHdob3NlXG4gICAqIHBhcmFtZXRlcnMgd2Ugd2FudCB0byBmaW5kLlxuICAgKiBAcmV0dXJucyBhbiBhcnJheSBvZiBgdHMuUGFyYW1ldGVyRGVjbGFyYXRpb25gIG9iamVjdHMgcmVwcmVzZW50aW5nIGVhY2ggb2YgdGhlIHBhcmFtZXRlcnMgaW5cbiAgICogdGhlIGNsYXNzJ3MgY29uc3RydWN0b3Igb3IgYG51bGxgIGlmIHRoZXJlIGlzIG5vIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldENvbnN0cnVjdG9yUGFyYW1ldGVyRGVjbGFyYXRpb25zKGNsYXNzU3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2wpOlxuICAgICAgdHMuUGFyYW1ldGVyRGVjbGFyYXRpb25bXXxudWxsIHtcbiAgICBjb25zdCBjb25zdHJ1Y3RvciA9IGNsYXNzU3ltYm9sLmltcGxlbWVudGF0aW9uLnZhbHVlRGVjbGFyYXRpb247XG4gICAgaWYgKCF0cy5pc0Z1bmN0aW9uRGVjbGFyYXRpb24oY29uc3RydWN0b3IpKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChjb25zdHJ1Y3Rvci5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBBcnJheS5mcm9tKGNvbnN0cnVjdG9yLnBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmlzU3ludGhlc2l6ZWRDb25zdHJ1Y3Rvcihjb25zdHJ1Y3RvcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHBhcmFtZXRlciB0eXBlIGFuZCBkZWNvcmF0b3JzIGZvciB0aGUgY29uc3RydWN0b3Igb2YgYSBjbGFzcyxcbiAgICogd2hlcmUgdGhlIGluZm9ybWF0aW9uIGlzIHN0b3JlZCBvbiBhIHN0YXRpYyBtZXRob2Qgb2YgdGhlIGNsYXNzLlxuICAgKlxuICAgKiBJbiB0aGlzIGNhc2UgdGhlIGRlY29yYXRvcnMgYXJlIHN0b3JlZCBpbiB0aGUgYm9keSBvZiBhIG1ldGhvZFxuICAgKiAoYGN0b3JQYXJhdGVtZXJzYCkgYXR0YWNoZWQgdG8gdGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdW5saWtlIEVTTTIwMTUgdGhpcyBpcyBhIGZ1bmN0aW9uIGV4cHJlc3Npb24gcmF0aGVyIHRoYW4gYW4gYXJyb3dcbiAgICogZnVuY3Rpb246XG4gICAqXG4gICAqIGBgYFxuICAgKiBTb21lRGlyZWN0aXZlLmN0b3JQYXJhbWV0ZXJzID0gZnVuY3Rpb24oKSB7IHJldHVybiBbXG4gICAqICAgeyB0eXBlOiBWaWV3Q29udGFpbmVyUmVmLCB9LFxuICAgKiAgIHsgdHlwZTogVGVtcGxhdGVSZWYsIH0sXG4gICAqICAgeyB0eXBlOiBJdGVyYWJsZURpZmZlcnMsIH0sXG4gICAqICAgeyB0eXBlOiB1bmRlZmluZWQsIGRlY29yYXRvcnM6IFt7IHR5cGU6IEluamVjdCwgYXJnczogW0lOSkVDVEVEX1RPS0VOLF0gfSxdIH0sXG4gICAqIF07IH07XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gcGFyYW1EZWNvcmF0b3JzUHJvcGVydHkgdGhlIHByb3BlcnR5IHRoYXQgaG9sZHMgdGhlIHBhcmFtZXRlciBpbmZvIHdlIHdhbnQgdG8gZ2V0LlxuICAgKiBAcmV0dXJucyBhbiBhcnJheSBvZiBvYmplY3RzIGNvbnRhaW5pbmcgdGhlIHR5cGUgYW5kIGRlY29yYXRvcnMgZm9yIGVhY2ggcGFyYW1ldGVyLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldFBhcmFtSW5mb0Zyb21TdGF0aWNQcm9wZXJ0eShwYXJhbURlY29yYXRvcnNQcm9wZXJ0eTogdHMuU3ltYm9sKTogUGFyYW1JbmZvW118bnVsbCB7XG4gICAgY29uc3QgcGFyYW1EZWNvcmF0b3JzID0gZ2V0UHJvcGVydHlWYWx1ZUZyb21TeW1ib2wocGFyYW1EZWNvcmF0b3JzUHJvcGVydHkpO1xuICAgIC8vIFRoZSBkZWNvcmF0b3JzIGFycmF5IG1heSBiZSB3cmFwcGVkIGluIGEgZnVuY3Rpb24uIElmIHNvIHVud3JhcCBpdC5cbiAgICBjb25zdCByZXR1cm5TdGF0ZW1lbnQgPSBnZXRSZXR1cm5TdGF0ZW1lbnQocGFyYW1EZWNvcmF0b3JzKTtcbiAgICBjb25zdCBleHByZXNzaW9uID0gcmV0dXJuU3RhdGVtZW50ID8gcmV0dXJuU3RhdGVtZW50LmV4cHJlc3Npb24gOiBwYXJhbURlY29yYXRvcnM7XG4gICAgaWYgKGV4cHJlc3Npb24gJiYgdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKGV4cHJlc3Npb24pKSB7XG4gICAgICBjb25zdCBlbGVtZW50cyA9IGV4cHJlc3Npb24uZWxlbWVudHM7XG4gICAgICByZXR1cm4gZWxlbWVudHMubWFwKHJlZmxlY3RBcnJheUVsZW1lbnQpLm1hcChwYXJhbUluZm8gPT4ge1xuICAgICAgICBjb25zdCB0eXBlRXhwcmVzc2lvbiA9IHBhcmFtSW5mbyAmJiBwYXJhbUluZm8uaGFzKCd0eXBlJykgPyBwYXJhbUluZm8uZ2V0KCd0eXBlJykhIDogbnVsbDtcbiAgICAgICAgY29uc3QgZGVjb3JhdG9ySW5mbyA9XG4gICAgICAgICAgICBwYXJhbUluZm8gJiYgcGFyYW1JbmZvLmhhcygnZGVjb3JhdG9ycycpID8gcGFyYW1JbmZvLmdldCgnZGVjb3JhdG9ycycpISA6IG51bGw7XG4gICAgICAgIGNvbnN0IGRlY29yYXRvcnMgPSBkZWNvcmF0b3JJbmZvICYmIHRoaXMucmVmbGVjdERlY29yYXRvcnMoZGVjb3JhdG9ySW5mbyk7XG4gICAgICAgIHJldHVybiB7dHlwZUV4cHJlc3Npb24sIGRlY29yYXRvcnN9O1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChwYXJhbURlY29yYXRvcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5sb2dnZXIud2FybihcbiAgICAgICAgICAnSW52YWxpZCBjb25zdHJ1Y3RvciBwYXJhbWV0ZXIgZGVjb3JhdG9yIGluICcgKyBwYXJhbURlY29yYXRvcnMuZ2V0U291cmNlRmlsZSgpLmZpbGVOYW1lICtcbiAgICAgICAgICAgICAgJzpcXG4nLFxuICAgICAgICAgIHBhcmFtRGVjb3JhdG9ycy5nZXRUZXh0KCkpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWZsZWN0IG92ZXIgYSBzeW1ib2wgYW5kIGV4dHJhY3QgdGhlIG1lbWJlciBpbmZvcm1hdGlvbiwgY29tYmluaW5nIGl0IHdpdGggdGhlXG4gICAqIHByb3ZpZGVkIGRlY29yYXRvciBpbmZvcm1hdGlvbiwgYW5kIHdoZXRoZXIgaXQgaXMgYSBzdGF0aWMgbWVtYmVyLlxuICAgKlxuICAgKiBJZiBhIGNsYXNzIG1lbWJlciB1c2VzIGFjY2Vzc29ycyAoZS5nIGdldHRlcnMgYW5kL29yIHNldHRlcnMpIHRoZW4gaXQgZ2V0cyBkb3dubGV2ZWxlZFxuICAgKiBpbiBFUzUgdG8gYSBzaW5nbGUgYE9iamVjdC5kZWZpbmVQcm9wZXJ0eSgpYCBjYWxsLiBJbiB0aGF0IGNhc2Ugd2UgbXVzdCBwYXJzZSB0aGlzXG4gICAqIGNhbGwgdG8gZXh0cmFjdCB0aGUgb25lIG9yIHR3byBDbGFzc01lbWJlciBvYmplY3RzIHRoYXQgcmVwcmVzZW50IHRoZSBhY2Nlc3NvcnMuXG4gICAqXG4gICAqIEBwYXJhbSBzeW1ib2wgdGhlIHN5bWJvbCBmb3IgdGhlIG1lbWJlciB0byByZWZsZWN0IG92ZXIuXG4gICAqIEBwYXJhbSBkZWNvcmF0b3JzIGFuIGFycmF5IG9mIGRlY29yYXRvcnMgYXNzb2NpYXRlZCB3aXRoIHRoZSBtZW1iZXIuXG4gICAqIEBwYXJhbSBpc1N0YXRpYyB0cnVlIGlmIHRoaXMgbWVtYmVyIGlzIHN0YXRpYywgZmFsc2UgaWYgaXQgaXMgYW4gaW5zdGFuY2UgcHJvcGVydHkuXG4gICAqIEByZXR1cm5zIHRoZSByZWZsZWN0ZWQgbWVtYmVyIGluZm9ybWF0aW9uLCBvciBudWxsIGlmIHRoZSBzeW1ib2wgaXMgbm90IGEgbWVtYmVyLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlZmxlY3RNZW1iZXJzKHN5bWJvbDogdHMuU3ltYm9sLCBkZWNvcmF0b3JzPzogRGVjb3JhdG9yW10sIGlzU3RhdGljPzogYm9vbGVhbik6XG4gICAgICBDbGFzc01lbWJlcltdfG51bGwge1xuICAgIGNvbnN0IG5vZGUgPSBzeW1ib2wudmFsdWVEZWNsYXJhdGlvbiB8fCBzeW1ib2wuZGVjbGFyYXRpb25zICYmIHN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gICAgY29uc3QgcHJvcGVydHlEZWZpbml0aW9uID0gbm9kZSAmJiBnZXRQcm9wZXJ0eURlZmluaXRpb24obm9kZSk7XG4gICAgaWYgKHByb3BlcnR5RGVmaW5pdGlvbikge1xuICAgICAgY29uc3QgbWVtYmVyczogQ2xhc3NNZW1iZXJbXSA9IFtdO1xuICAgICAgaWYgKHByb3BlcnR5RGVmaW5pdGlvbi5zZXR0ZXIpIHtcbiAgICAgICAgbWVtYmVycy5wdXNoKHtcbiAgICAgICAgICBub2RlOiBub2RlISxcbiAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcHJvcGVydHlEZWZpbml0aW9uLnNldHRlcixcbiAgICAgICAgICBraW5kOiBDbGFzc01lbWJlcktpbmQuU2V0dGVyLFxuICAgICAgICAgIHR5cGU6IG51bGwsXG4gICAgICAgICAgbmFtZTogc3ltYm9sLm5hbWUsXG4gICAgICAgICAgbmFtZU5vZGU6IG51bGwsXG4gICAgICAgICAgdmFsdWU6IG51bGwsXG4gICAgICAgICAgaXNTdGF0aWM6IGlzU3RhdGljIHx8IGZhbHNlLFxuICAgICAgICAgIGRlY29yYXRvcnM6IGRlY29yYXRvcnMgfHwgW10sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFByZXZlbnQgYXR0YWNoaW5nIHRoZSBkZWNvcmF0b3JzIHRvIGEgcG90ZW50aWFsIGdldHRlci4gSW4gRVM1LCB3ZSBjYW4ndCB0ZWxsIHdoZXJlIHRoZVxuICAgICAgICAvLyBkZWNvcmF0b3JzIHdlcmUgb3JpZ2luYWxseSBhdHRhY2hlZCB0bywgaG93ZXZlciB3ZSBvbmx5IHdhbnQgdG8gYXR0YWNoIHRoZW0gdG8gYSBzaW5nbGVcbiAgICAgICAgLy8gYENsYXNzTWVtYmVyYCBhcyBvdGhlcndpc2Ugbmd0c2Mgd291bGQgaGFuZGxlIHRoZSBzYW1lIGRlY29yYXRvcnMgdHdpY2UuXG4gICAgICAgIGRlY29yYXRvcnMgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBpZiAocHJvcGVydHlEZWZpbml0aW9uLmdldHRlcikge1xuICAgICAgICBtZW1iZXJzLnB1c2goe1xuICAgICAgICAgIG5vZGU6IG5vZGUhLFxuICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBwcm9wZXJ0eURlZmluaXRpb24uZ2V0dGVyLFxuICAgICAgICAgIGtpbmQ6IENsYXNzTWVtYmVyS2luZC5HZXR0ZXIsXG4gICAgICAgICAgdHlwZTogbnVsbCxcbiAgICAgICAgICBuYW1lOiBzeW1ib2wubmFtZSxcbiAgICAgICAgICBuYW1lTm9kZTogbnVsbCxcbiAgICAgICAgICB2YWx1ZTogbnVsbCxcbiAgICAgICAgICBpc1N0YXRpYzogaXNTdGF0aWMgfHwgZmFsc2UsXG4gICAgICAgICAgZGVjb3JhdG9yczogZGVjb3JhdG9ycyB8fCBbXSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtYmVycztcbiAgICB9XG5cbiAgICBjb25zdCBtZW1iZXJzID0gc3VwZXIucmVmbGVjdE1lbWJlcnMoc3ltYm9sLCBkZWNvcmF0b3JzLCBpc1N0YXRpYyk7XG4gICAgbWVtYmVycyAmJiBtZW1iZXJzLmZvckVhY2gobWVtYmVyID0+IHtcbiAgICAgIGlmIChtZW1iZXIgJiYgbWVtYmVyLmtpbmQgPT09IENsYXNzTWVtYmVyS2luZC5NZXRob2QgJiYgbWVtYmVyLmlzU3RhdGljICYmIG1lbWJlci5ub2RlICYmXG4gICAgICAgICAgdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24obWVtYmVyLm5vZGUpICYmIG1lbWJlci5ub2RlLnBhcmVudCAmJlxuICAgICAgICAgIHRzLmlzQmluYXJ5RXhwcmVzc2lvbihtZW1iZXIubm9kZS5wYXJlbnQpICYmXG4gICAgICAgICAgdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24obWVtYmVyLm5vZGUucGFyZW50LnJpZ2h0KSkge1xuICAgICAgICAvLyBSZWNvbXB1dGUgdGhlIGltcGxlbWVudGF0aW9uIGZvciB0aGlzIG1lbWJlcjpcbiAgICAgICAgLy8gRVM1IHN0YXRpYyBtZXRob2RzIGFyZSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgc28gdGhlIGRlY2xhcmF0aW9uIGlzIGFjdHVhbGx5IHRoZVxuICAgICAgICAvLyBpbml0aWFsaXplciBvZiB0aGUgdmFyaWFibGUgYXNzaWdubWVudFxuICAgICAgICBtZW1iZXIuaW1wbGVtZW50YXRpb24gPSBtZW1iZXIubm9kZS5wYXJlbnQucmlnaHQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG1lbWJlcnM7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBzdGF0ZW1lbnRzIHJlbGF0ZWQgdG8gdGhlIGdpdmVuIGNsYXNzIHRoYXQgbWF5IGNvbnRhaW4gY2FsbHMgdG8gYSBoZWxwZXIuXG4gICAqXG4gICAqIEluIEVTTTUgY29kZSB0aGUgaGVscGVyIGNhbGxzIGFyZSBoaWRkZW4gaW5zaWRlIHRoZSBjbGFzcydzIElJRkUuXG4gICAqXG4gICAqIEBwYXJhbSBjbGFzc1N5bWJvbCB0aGUgY2xhc3Mgd2hvc2UgaGVscGVyIGNhbGxzIHdlIGFyZSBpbnRlcmVzdGVkIGluLiBXZSBleHBlY3QgdGhpcyBzeW1ib2xcbiAgICogdG8gcmVmZXJlbmNlIHRoZSBpbm5lciBpZGVudGlmaWVyIGluc2lkZSB0aGUgSUlGRS5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IG1heSBjb250YWluIGhlbHBlciBjYWxscy5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRTdGF0ZW1lbnRzRm9yQ2xhc3MoY2xhc3NTeW1ib2w6IE5nY2NDbGFzc1N5bWJvbCk6IHRzLlN0YXRlbWVudFtdIHtcbiAgICBjb25zdCBjbGFzc0RlY2xhcmF0aW9uUGFyZW50ID0gY2xhc3NTeW1ib2wuaW1wbGVtZW50YXRpb24udmFsdWVEZWNsYXJhdGlvbi5wYXJlbnQ7XG4gICAgcmV0dXJuIHRzLmlzQmxvY2soY2xhc3NEZWNsYXJhdGlvblBhcmVudCkgPyBBcnJheS5mcm9tKGNsYXNzRGVjbGFyYXRpb25QYXJlbnQuc3RhdGVtZW50cykgOiBbXTtcbiAgfVxuXG4gIC8vLy8vLy8vLy8vLy8gSG9zdCBQcml2YXRlIEhlbHBlcnMgLy8vLy8vLy8vLy8vL1xuXG4gIC8qKlxuICAgKiBBIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIG1heSBoYXZlIGJlZW4gXCJzeW50aGVzaXplZFwiIGJ5IFR5cGVTY3JpcHQgZHVyaW5nIEphdmFTY3JpcHQgZW1pdCxcbiAgICogaW4gdGhlIGNhc2Ugbm8gdXNlci1kZWZpbmVkIGNvbnN0cnVjdG9yIGV4aXN0cyBhbmQgZS5nLiBwcm9wZXJ0eSBpbml0aWFsaXplcnMgYXJlIHVzZWQuXG4gICAqIFRob3NlIGluaXRpYWxpemVycyBuZWVkIHRvIGJlIGVtaXR0ZWQgaW50byBhIGNvbnN0cnVjdG9yIGluIEphdmFTY3JpcHQsIHNvIHRoZSBUeXBlU2NyaXB0XG4gICAqIGNvbXBpbGVyIGdlbmVyYXRlcyBhIHN5bnRoZXRpYyBjb25zdHJ1Y3Rvci5cbiAgICpcbiAgICogV2UgbmVlZCB0byBpZGVudGlmeSBzdWNoIGNvbnN0cnVjdG9ycyBhcyBuZ2NjIG5lZWRzIHRvIGJlIGFibGUgdG8gdGVsbCBpZiBhIGNsYXNzIGRpZFxuICAgKiBvcmlnaW5hbGx5IGhhdmUgYSBjb25zdHJ1Y3RvciBpbiB0aGUgVHlwZVNjcmlwdCBzb3VyY2UuIEZvciBFUzUsIHdlIGNhbiBub3QgdGVsbCBhblxuICAgKiBlbXB0eSBjb25zdHJ1Y3RvciBhcGFydCBmcm9tIGEgc3ludGhlc2l6ZWQgY29uc3RydWN0b3IsIGJ1dCBmb3J0dW5hdGVseSB0aGF0IGRvZXMgbm90XG4gICAqIG1hdHRlciBmb3IgdGhlIGNvZGUgZ2VuZXJhdGVkIGJ5IG5ndHNjLlxuICAgKlxuICAgKiBXaGVuIGEgY2xhc3MgaGFzIGEgc3VwZXJjbGFzcyBob3dldmVyLCBhIHN5bnRoZXNpemVkIGNvbnN0cnVjdG9yIG11c3Qgbm90IGJlIGNvbnNpZGVyZWRcbiAgICogYXMgYSB1c2VyLWRlZmluZWQgY29uc3RydWN0b3IgYXMgdGhhdCBwcmV2ZW50cyBhIGJhc2UgZmFjdG9yeSBjYWxsIGZyb20gYmVpbmcgY3JlYXRlZCBieVxuICAgKiBuZ3RzYywgcmVzdWx0aW5nIGluIGEgZmFjdG9yeSBmdW5jdGlvbiB0aGF0IGRvZXMgbm90IGluamVjdCB0aGUgZGVwZW5kZW5jaWVzIG9mIHRoZVxuICAgKiBzdXBlcmNsYXNzLiBIZW5jZSwgd2UgaWRlbnRpZnkgYSBkZWZhdWx0IHN5bnRoZXNpemVkIHN1cGVyIGNhbGwgaW4gdGhlIGNvbnN0cnVjdG9yIGJvZHksXG4gICAqIGFjY29yZGluZyB0byB0aGUgc3RydWN0dXJlIHRoYXQgVHlwZVNjcmlwdCdzIEVTMjAxNSB0byBFUzUgdHJhbnNmb3JtZXIgZ2VuZXJhdGVzIGluXG4gICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9ibG9iL3YzLjIuMi9zcmMvY29tcGlsZXIvdHJhbnNmb3JtZXJzL2VzMjAxNS50cyNMMTA4Mi1MMTA5OFxuICAgKlxuICAgKiBBZGRpdGlvbmFsbHksIHdlIGhhbmRsZSBzeW50aGV0aWMgZGVsZWdhdGUgY29uc3RydWN0b3JzIHRoYXQgYXJlIGVtaXR0ZWQgd2hlbiBUeXBlU2NyaXB0XG4gICAqIGRvd25sZXZlbCdzIEVTMjAxNSBzeW50aGV0aWNhbGx5IGdlbmVyYXRlZCB0byBFUzUuIFRoZXNlIHZhcnkgc2xpZ2h0bHkgZnJvbSB0aGUgZGVmYXVsdFxuICAgKiBzdHJ1Y3R1cmUgbWVudGlvbmVkIGFib3ZlIGJlY2F1c2UgdGhlIEVTMjAxNSBvdXRwdXQgdXNlcyBhIHNwcmVhZCBvcGVyYXRvciwgZm9yIGRlbGVnYXRpbmdcbiAgICogdG8gdGhlIHBhcmVudCBjb25zdHJ1Y3RvciwgdGhhdCBpcyBwcmVzZXJ2ZWQgdGhyb3VnaCBhIFR5cGVTY3JpcHQgaGVscGVyIGluIEVTNS4gZS5nLlxuICAgKlxuICAgKiBgYGBcbiAgICogcmV0dXJuIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZChhcmd1bWVudHMpKSB8fCB0aGlzO1xuICAgKiBgYGBcbiAgICpcbiAgICogb3IsIHNpbmNlIFR5cGVTY3JpcHQgNC4yIGl0IHdvdWxkIGJlXG4gICAqXG4gICAqIGBgYFxuICAgKiByZXR1cm4gX3N1cGVyLmFwcGx5KHRoaXMsIHRzbGliLl9fc3ByZWFkQXJyYXkoW10sIHRzbGliLl9fcmVhZChhcmd1bWVudHMpKSkgfHwgdGhpcztcbiAgICogYGBgXG4gICAqXG4gICAqIFN1Y2ggY29uc3RydWN0cyBjYW4gYmUgc3RpbGwgY29uc2lkZXJlZCBhcyBzeW50aGV0aWMgZGVsZWdhdGUgY29uc3RydWN0b3JzIGFzIHRoZXkgYXJlXG4gICAqIHRoZSBwcm9kdWN0IG9mIGEgY29tbW9uIFR5cGVTY3JpcHQgdG8gRVM1IHN5bnRoZXRpYyBjb25zdHJ1Y3RvciwganVzdCBiZWluZyBkb3dubGV2ZWxlZFxuICAgKiB0byBFUzUgdXNpbmcgYHRzY2AuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMzg0NTMuXG4gICAqXG4gICAqXG4gICAqIEBwYXJhbSBjb25zdHJ1Y3RvciBhIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIHRlc3RcbiAgICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgY29uc3RydWN0b3IgYXBwZWFycyB0byBoYXZlIGJlZW4gc3ludGhlc2l6ZWRcbiAgICovXG4gIHByaXZhdGUgaXNTeW50aGVzaXplZENvbnN0cnVjdG9yKGNvbnN0cnVjdG9yOiB0cy5GdW5jdGlvbkRlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCFjb25zdHJ1Y3Rvci5ib2R5KSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBmaXJzdFN0YXRlbWVudCA9IGNvbnN0cnVjdG9yLmJvZHkuc3RhdGVtZW50c1swXTtcbiAgICBpZiAoIWZpcnN0U3RhdGVtZW50KSByZXR1cm4gZmFsc2U7XG5cbiAgICByZXR1cm4gdGhpcy5pc1N5bnRoZXNpemVkU3VwZXJUaGlzQXNzaWdubWVudChmaXJzdFN0YXRlbWVudCkgfHxcbiAgICAgICAgdGhpcy5pc1N5bnRoZXNpemVkU3VwZXJSZXR1cm5TdGF0ZW1lbnQoZmlyc3RTdGF0ZW1lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIElkZW50aWZpZXMgc3ludGhlc2l6ZWQgc3VwZXIgY2FsbHMgd2hpY2ggcGFzcy10aHJvdWdoIGZ1bmN0aW9uIGFyZ3VtZW50cyBkaXJlY3RseSBhbmQgYXJlXG4gICAqIGJlaW5nIGFzc2lnbmVkIHRvIGEgY29tbW9uIGBfdGhpc2AgdmFyaWFibGUuIFRoZSBmb2xsb3dpbmcgcGF0dGVybnMgd2UgaW50ZW5kIHRvIG1hdGNoOlxuICAgKlxuICAgKiAxLiBEZWxlZ2F0ZSBjYWxsIGVtaXR0ZWQgYnkgVHlwZVNjcmlwdCB3aGVuIGl0IGVtaXRzIEVTNSBkaXJlY3RseS5cbiAgICogICBgYGBcbiAgICogICB2YXIgX3RoaXMgPSBfc3VwZXIgIT09IG51bGwgJiYgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICpcbiAgICogMi4gRGVsZWdhdGUgY2FsbCBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQgd2hlbiBpdCBkb3dubGV2ZWwncyBFUzIwMTUgdG8gRVM1LlxuICAgKiAgIGBgYFxuICAgKiAgIHZhciBfdGhpcyA9IF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZChhcmd1bWVudHMpKSB8fCB0aGlzO1xuICAgKiAgIGBgYFxuICAgKiAgIG9yIHVzaW5nIHRoZSBzeW50YXggZW1pdHRlZCBzaW5jZSBUeXBlU2NyaXB0IDQuMjpcbiAgICogICBgYGBcbiAgICogICByZXR1cm4gX3N1cGVyLmFwcGx5KHRoaXMsIHRzbGliLl9fc3ByZWFkQXJyYXkoW10sIHRzbGliLl9fcmVhZChhcmd1bWVudHMpKSkgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICpcbiAgICogQHBhcmFtIHN0YXRlbWVudCBhIHN0YXRlbWVudCB0aGF0IG1heSBiZSBhIHN5bnRoZXNpemVkIHN1cGVyIGNhbGxcbiAgICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgc3RhdGVtZW50IGxvb2tzIGxpa2UgYSBzeW50aGVzaXplZCBzdXBlciBjYWxsXG4gICAqL1xuICBwcml2YXRlIGlzU3ludGhlc2l6ZWRTdXBlclRoaXNBc3NpZ25tZW50KHN0YXRlbWVudDogdHMuU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgaWYgKCF0cy5pc1ZhcmlhYmxlU3RhdGVtZW50KHN0YXRlbWVudCkpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHZhcmlhYmxlRGVjbGFyYXRpb25zID0gc3RhdGVtZW50LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnM7XG4gICAgaWYgKHZhcmlhYmxlRGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgdmFyaWFibGVEZWNsYXJhdGlvbiA9IHZhcmlhYmxlRGVjbGFyYXRpb25zWzBdO1xuICAgIGlmICghdHMuaXNJZGVudGlmaWVyKHZhcmlhYmxlRGVjbGFyYXRpb24ubmFtZSkgfHxcbiAgICAgICAgIXZhcmlhYmxlRGVjbGFyYXRpb24ubmFtZS50ZXh0LnN0YXJ0c1dpdGgoJ190aGlzJykpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBpbml0aWFsaXplciA9IHZhcmlhYmxlRGVjbGFyYXRpb24uaW5pdGlhbGl6ZXI7XG4gICAgaWYgKCFpbml0aWFsaXplcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXMuaXNTeW50aGVzaXplZERlZmF1bHRTdXBlckNhbGwoaW5pdGlhbGl6ZXIpO1xuICB9XG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHN5bnRoZXNpemVkIHN1cGVyIGNhbGxzIHdoaWNoIHBhc3MtdGhyb3VnaCBmdW5jdGlvbiBhcmd1bWVudHMgZGlyZWN0bHkgYW5kXG4gICAqIGFyZSBiZWluZyByZXR1cm5lZC4gVGhlIGZvbGxvd2luZyBwYXR0ZXJucyBjb3JyZXNwb25kIHRvIHN5bnRoZXRpYyBzdXBlciByZXR1cm4gY2FsbHM6XG4gICAqXG4gICAqIDEuIERlbGVnYXRlIGNhbGwgZW1pdHRlZCBieSBUeXBlU2NyaXB0IHdoZW4gaXQgZW1pdHMgRVM1IGRpcmVjdGx5LlxuICAgKiAgIGBgYFxuICAgKiAgIHJldHVybiBfc3VwZXIgIT09IG51bGwgJiYgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICpcbiAgICogMi4gRGVsZWdhdGUgY2FsbCBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQgd2hlbiBpdCBkb3dubGV2ZWwncyBFUzIwMTUgdG8gRVM1LlxuICAgKiAgIGBgYFxuICAgKiAgIHJldHVybiBfc3VwZXIuYXBwbHkodGhpcywgdHNsaWIuX19zcHJlYWQoYXJndW1lbnRzKSkgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICogICBvciB1c2luZyB0aGUgc3ludGF4IGVtaXR0ZWQgc2luY2UgVHlwZVNjcmlwdCA0LjI6XG4gICAqICAgYGBgXG4gICAqICAgcmV0dXJuIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZEFycmF5KFtdLCB0c2xpYi5fX3JlYWQoYXJndW1lbnRzKSkpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqXG4gICAqIEBwYXJhbSBzdGF0ZW1lbnQgYSBzdGF0ZW1lbnQgdGhhdCBtYXkgYmUgYSBzeW50aGVzaXplZCBzdXBlciBjYWxsXG4gICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHN0YXRlbWVudCBsb29rcyBsaWtlIGEgc3ludGhlc2l6ZWQgc3VwZXIgY2FsbFxuICAgKi9cbiAgcHJpdmF0ZSBpc1N5bnRoZXNpemVkU3VwZXJSZXR1cm5TdGF0ZW1lbnQoc3RhdGVtZW50OiB0cy5TdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgICBpZiAoIXRzLmlzUmV0dXJuU3RhdGVtZW50KHN0YXRlbWVudCkpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBzdGF0ZW1lbnQuZXhwcmVzc2lvbjtcbiAgICBpZiAoIWV4cHJlc3Npb24pIHJldHVybiBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzLmlzU3ludGhlc2l6ZWREZWZhdWx0U3VwZXJDYWxsKGV4cHJlc3Npb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIElkZW50aWZpZXMgc3ludGhlc2l6ZWQgc3VwZXIgY2FsbHMgd2hpY2ggcGFzcy10aHJvdWdoIGZ1bmN0aW9uIGFyZ3VtZW50cyBkaXJlY3RseS4gVGhlXG4gICAqIHN5bnRoZXRpYyBkZWxlZ2F0ZSBzdXBlciBjYWxsIG1hdGNoIHRoZSBmb2xsb3dpbmcgcGF0dGVybnMgd2UgaW50ZW5kIHRvIG1hdGNoOlxuICAgKlxuICAgKiAxLiBEZWxlZ2F0ZSBjYWxsIGVtaXR0ZWQgYnkgVHlwZVNjcmlwdCB3aGVuIGl0IGVtaXRzIEVTNSBkaXJlY3RseS5cbiAgICogICBgYGBcbiAgICogICBfc3VwZXIgIT09IG51bGwgJiYgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICpcbiAgICogMi4gRGVsZWdhdGUgY2FsbCBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQgd2hlbiBpdCBkb3dubGV2ZWwncyBFUzIwMTUgdG8gRVM1LlxuICAgKiAgIGBgYFxuICAgKiAgIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZChhcmd1bWVudHMpKSB8fCB0aGlzO1xuICAgKiAgIGBgYFxuICAgKiAgIG9yIHVzaW5nIHRoZSBzeW50YXggZW1pdHRlZCBzaW5jZSBUeXBlU2NyaXB0IDQuMjpcbiAgICogICBgYGBcbiAgICogICByZXR1cm4gX3N1cGVyLmFwcGx5KHRoaXMsIHRzbGliLl9fc3ByZWFkQXJyYXkoW10sIHRzbGliLl9fcmVhZChhcmd1bWVudHMpKSkgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICpcbiAgICogQHBhcmFtIGV4cHJlc3Npb24gYW4gZXhwcmVzc2lvbiB0aGF0IG1heSByZXByZXNlbnQgYSBkZWZhdWx0IHN1cGVyIGNhbGxcbiAgICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgZXhwcmVzc2lvbiBjb3JyZXNwb25kcyB3aXRoIHRoZSBhYm92ZSBmb3JtXG4gICAqL1xuICBwcml2YXRlIGlzU3ludGhlc2l6ZWREZWZhdWx0U3VwZXJDYWxsKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICBpZiAoIWlzQmluYXJ5RXhwcihleHByZXNzaW9uLCB0cy5TeW50YXhLaW5kLkJhckJhclRva2VuKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChleHByZXNzaW9uLnJpZ2h0LmtpbmQgIT09IHRzLlN5bnRheEtpbmQuVGhpc0tleXdvcmQpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGxlZnQgPSBleHByZXNzaW9uLmxlZnQ7XG4gICAgaWYgKGlzQmluYXJ5RXhwcihsZWZ0LCB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZEFtcGVyc2FuZFRva2VuKSkge1xuICAgICAgcmV0dXJuIGlzU3VwZXJOb3ROdWxsKGxlZnQubGVmdCkgJiYgdGhpcy5pc1N1cGVyQXBwbHlDYWxsKGxlZnQucmlnaHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5pc1N1cGVyQXBwbHlDYWxsKGxlZnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0cyB3aGV0aGVyIHRoZSBleHByZXNzaW9uIGNvcnJlc3BvbmRzIHRvIGEgYHN1cGVyYCBjYWxsIHBhc3NpbmcgdGhyb3VnaFxuICAgKiBmdW5jdGlvbiBhcmd1bWVudHMgd2l0aG91dCBhbnkgbW9kaWZpY2F0aW9uLiBlLmcuXG4gICAqXG4gICAqIGBgYFxuICAgKiBfc3VwZXIgIT09IG51bGwgJiYgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgfHwgdGhpcztcbiAgICogYGBgXG4gICAqXG4gICAqIFRoaXMgc3RydWN0dXJlIGlzIGdlbmVyYXRlZCBieSBUeXBlU2NyaXB0IHdoZW4gdHJhbnNmb3JtaW5nIEVTMjAxNSB0byBFUzUsIHNlZVxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvYmxvYi92My4yLjIvc3JjL2NvbXBpbGVyL3RyYW5zZm9ybWVycy9lczIwMTUudHMjTDExNDgtTDExNjNcbiAgICpcbiAgICogQWRkaXRpb25hbGx5LCB3ZSBhbHNvIGhhbmRsZSBjYXNlcyB3aGVyZSBgYXJndW1lbnRzYCBhcmUgd3JhcHBlZCBieSBhIFR5cGVTY3JpcHQgc3ByZWFkXG4gICAqIGhlbHBlci5cbiAgICogVGhpcyBjYW4gaGFwcGVuIGlmIEVTMjAxNSBjbGFzcyBvdXRwdXQgY29udGFpbiBhdXRvLWdlbmVyYXRlZCBjb25zdHJ1Y3RvcnMgZHVlIHRvIGNsYXNzXG4gICAqIG1lbWJlcnMuIFRoZSBFUzIwMTUgb3V0cHV0IHdpbGwgYmUgdXNpbmcgYHN1cGVyKC4uLmFyZ3VtZW50cylgIHRvIGRlbGVnYXRlIHRvIHRoZSBzdXBlcmNsYXNzLFxuICAgKiBidXQgb25jZSBkb3dubGV2ZWxlZCB0byBFUzUsIHRoZSBzcHJlYWQgb3BlcmF0b3Igd2lsbCBiZSBwZXJzaXN0ZWQgdGhyb3VnaCBhIFR5cGVTY3JpcHQgc3ByZWFkXG4gICAqIGhlbHBlci4gRm9yIGV4YW1wbGU6XG4gICAqXG4gICAqIGBgYFxuICAgKiBfc3VwZXIuYXBwbHkodGhpcywgX19zcHJlYWQoYXJndW1lbnRzKSkgfHwgdGhpcztcbiAgICogYGBgXG4gICAqXG4gICAqIG9yLCBzaW5jZSBUeXBlU2NyaXB0IDQuMiBpdCB3b3VsZCBiZVxuICAgKlxuICAgKiBgYGBcbiAgICogX3N1cGVyLmFwcGx5KHRoaXMsIHRzbGliLl9fc3ByZWFkQXJyYXkoW10sIHRzbGliLl9fcmVhZChhcmd1bWVudHMpKSkgfHwgdGhpcztcbiAgICogYGBgXG4gICAqXG4gICAqIE1vcmUgZGV0YWlscyBjYW4gYmUgZm91bmQgaW46IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzM4NDUzLlxuICAgKlxuICAgKiBAcGFyYW0gZXhwcmVzc2lvbiBhbiBleHByZXNzaW9uIHRoYXQgbWF5IHJlcHJlc2VudCBhIGRlZmF1bHQgc3VwZXIgY2FsbFxuICAgKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBleHByZXNzaW9uIGNvcnJlc3BvbmRzIHdpdGggdGhlIGFib3ZlIGZvcm1cbiAgICovXG4gIHByaXZhdGUgaXNTdXBlckFwcGx5Q2FsbChleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCF0cy5pc0NhbGxFeHByZXNzaW9uKGV4cHJlc3Npb24pIHx8IGV4cHJlc3Npb24uYXJndW1lbnRzLmxlbmd0aCAhPT0gMikgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgdGFyZ2V0Rm4gPSBleHByZXNzaW9uLmV4cHJlc3Npb247XG4gICAgaWYgKCF0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbih0YXJnZXRGbikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIWlzU3VwZXJJZGVudGlmaWVyKHRhcmdldEZuLmV4cHJlc3Npb24pKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHRhcmdldEZuLm5hbWUudGV4dCAhPT0gJ2FwcGx5JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgdGhpc0FyZ3VtZW50ID0gZXhwcmVzc2lvbi5hcmd1bWVudHNbMF07XG4gICAgaWYgKHRoaXNBcmd1bWVudC5raW5kICE9PSB0cy5TeW50YXhLaW5kLlRoaXNLZXl3b3JkKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBhcmd1bWVudHNFeHByID0gZXhwcmVzc2lvbi5hcmd1bWVudHNbMV07XG5cbiAgICAvLyBJZiB0aGUgc3VwZXIgaXMgZGlyZWN0bHkgaW52b2tlZCB3aXRoIGBhcmd1bWVudHNgLCByZXR1cm4gYHRydWVgLiBUaGlzIHJlcHJlc2VudHMgdGhlXG4gICAgLy8gY29tbW9uIFR5cGVTY3JpcHQgb3V0cHV0IHdoZXJlIHRoZSBkZWxlZ2F0ZSBjb25zdHJ1Y3RvciBzdXBlciBjYWxsIG1hdGNoZXMgdGhlIGZvbGxvd2luZ1xuICAgIC8vIHBhdHRlcm46IGBzdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpYC5cbiAgICBpZiAoaXNBcmd1bWVudHNJZGVudGlmaWVyKGFyZ3VtZW50c0V4cHIpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBUaGUgb3RoZXIgc2NlbmFyaW8gd2UgaW50ZW5kIHRvIGRldGVjdDogVGhlIGBhcmd1bWVudHNgIHZhcmlhYmxlIG1pZ2h0IGJlIHdyYXBwZWQgd2l0aCB0aGVcbiAgICAvLyBUeXBlU2NyaXB0IHNwcmVhZCBoZWxwZXIgKGVpdGhlciB0aHJvdWdoIHRzbGliIG9yIGlubGluZWQpLiBUaGlzIGNhbiBoYXBwZW4gaWYgYW4gZXhwbGljaXRcbiAgICAvLyBkZWxlZ2F0ZSBjb25zdHJ1Y3RvciB1c2VzIGBzdXBlciguLi5hcmd1bWVudHMpYCBpbiBFUzIwMTUgYW5kIGlzIGRvd25sZXZlbGVkIHRvIEVTNSB1c2luZ1xuICAgIC8vIGAtLWRvd25sZXZlbEl0ZXJhdGlvbmAuXG4gICAgcmV0dXJuIHRoaXMuaXNTcHJlYWRBcmd1bWVudHNFeHByZXNzaW9uKGFyZ3VtZW50c0V4cHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgaWYgdGhlIHByb3ZpZGVkIGV4cHJlc3Npb24gaXMgb25lIG9mIHRoZSBmb2xsb3dpbmcgY2FsbCBleHByZXNzaW9uczpcbiAgICpcbiAgICogMS4gYF9fc3ByZWFkKGFyZ3VtZW50cylgXG4gICAqIDIuIGBfX3NwcmVhZEFycmF5KFtdLCBfX3JlYWQoYXJndW1lbnRzKSlgXG4gICAqXG4gICAqIFRoZSB0c2xpYiBoZWxwZXJzIG1heSBoYXZlIGJlZW4gZW1pdHRlZCBpbmxpbmUgYXMgaW4gdGhlIGFib3ZlIGV4YW1wbGUsIG9yIHRoZXkgbWF5IGJlIHJlYWRcbiAgICogZnJvbSBhIG5hbWVzcGFjZSBpbXBvcnQuXG4gICAqL1xuICBwcml2YXRlIGlzU3ByZWFkQXJndW1lbnRzRXhwcmVzc2lvbihleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgY29uc3QgY2FsbCA9IHRoaXMuZXh0cmFjdEtub3duSGVscGVyQ2FsbChleHByZXNzaW9uKTtcbiAgICBpZiAoY2FsbCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChjYWxsLmhlbHBlciA9PT0gS25vd25EZWNsYXJhdGlvbi5Uc0hlbHBlclNwcmVhZCkge1xuICAgICAgLy8gYF9fc3ByZWFkKGFyZ3VtZW50cylgXG4gICAgICByZXR1cm4gY2FsbC5hcmdzLmxlbmd0aCA9PT0gMSAmJiBpc0FyZ3VtZW50c0lkZW50aWZpZXIoY2FsbC5hcmdzWzBdKTtcbiAgICB9IGVsc2UgaWYgKGNhbGwuaGVscGVyID09PSBLbm93bkRlY2xhcmF0aW9uLlRzSGVscGVyU3ByZWFkQXJyYXkpIHtcbiAgICAgIC8vIGBfX3NwcmVhZEFycmF5KFtdLCBfX3JlYWQoYXJndW1lbnRzKSlgXG4gICAgICBpZiAoY2FsbC5hcmdzLmxlbmd0aCAhPT0gMikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpcnN0QXJnID0gY2FsbC5hcmdzWzBdO1xuICAgICAgaWYgKCF0cy5pc0FycmF5TGl0ZXJhbEV4cHJlc3Npb24oZmlyc3RBcmcpIHx8IGZpcnN0QXJnLmVsZW1lbnRzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNlY29uZEFyZyA9IHRoaXMuZXh0cmFjdEtub3duSGVscGVyQ2FsbChjYWxsLmFyZ3NbMV0pO1xuICAgICAgaWYgKHNlY29uZEFyZyA9PT0gbnVsbCB8fCBzZWNvbmRBcmcuaGVscGVyICE9PSBLbm93bkRlY2xhcmF0aW9uLlRzSGVscGVyUmVhZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzZWNvbmRBcmcuYXJncy5sZW5ndGggPT09IDEgJiYgaXNBcmd1bWVudHNJZGVudGlmaWVyKHNlY29uZEFyZy5hcmdzWzBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNwZWN0cyB0aGUgcHJvdmlkZWQgZXhwcmVzc2lvbiBhbmQgZGV0ZXJtaW5lcyBpZiBpdCBjb3JyZXNwb25kcyB3aXRoIGEga25vd24gaGVscGVyIGZ1bmN0aW9uXG4gICAqIGFzIHJlY2VpdmVyIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RLbm93bkhlbHBlckNhbGwoZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6XG4gICAgICB7aGVscGVyOiBLbm93bkRlY2xhcmF0aW9uLCBhcmdzOiB0cy5Ob2RlQXJyYXk8dHMuRXhwcmVzc2lvbj59fG51bGwge1xuICAgIGlmICghdHMuaXNDYWxsRXhwcmVzc2lvbihleHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcmVjZWl2ZXJFeHByID0gZXhwcmVzc2lvbi5leHByZXNzaW9uO1xuXG4gICAgLy8gVGhlIGhlbHBlciBjb3VsZCBiZSBnbG9iYWxseSBhdmFpbGFibGUsIG9yIGFjY2Vzc2VkIHRocm91Z2ggYSBuYW1lc3BhY2VkIGltcG9ydC4gSGVuY2Ugd2VcbiAgICAvLyBzdXBwb3J0IGEgcHJvcGVydHkgYWNjZXNzIGhlcmUgYXMgbG9uZyBhcyBpdCByZXNvbHZlcyB0byB0aGUgYWN0dWFsIGtub3duIFR5cGVTY3JpcHQgaGVscGVyLlxuICAgIGxldCByZWNlaXZlcjogRGVjbGFyYXRpb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHRzLmlzSWRlbnRpZmllcihyZWNlaXZlckV4cHIpKSB7XG4gICAgICByZWNlaXZlciA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIocmVjZWl2ZXJFeHByKTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKHJlY2VpdmVyRXhwcikgJiYgdHMuaXNJZGVudGlmaWVyKHJlY2VpdmVyRXhwci5uYW1lKSkge1xuICAgICAgcmVjZWl2ZXIgPSB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKHJlY2VpdmVyRXhwci5uYW1lKTtcbiAgICB9XG5cbiAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwgfHwgcmVjZWl2ZXIua25vd24gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBoZWxwZXI6IHJlY2VpdmVyLmtub3duLFxuICAgICAgYXJnczogZXhwcmVzc2lvbi5hcmd1bWVudHMsXG4gICAgfTtcbiAgfVxufVxuXG4vLy8vLy8vLy8vLy8vIEludGVybmFsIEhlbHBlcnMgLy8vLy8vLy8vLy8vL1xuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIGRldGFpbHMgYWJvdXQgcHJvcGVydHkgZGVmaW5pdGlvbnMgdGhhdCB3ZXJlIHNldCB1c2luZyBgT2JqZWN0LmRlZmluZVByb3BlcnR5YC5cbiAqL1xuaW50ZXJmYWNlIFByb3BlcnR5RGVmaW5pdGlvbiB7XG4gIHNldHRlcjogdHMuRnVuY3Rpb25FeHByZXNzaW9ufG51bGw7XG4gIGdldHRlcjogdHMuRnVuY3Rpb25FeHByZXNzaW9ufG51bGw7XG59XG5cbi8qKlxuICogSW4gRVM1LCBnZXR0ZXJzIGFuZCBzZXR0ZXJzIGhhdmUgYmVlbiBkb3dubGV2ZWxlZCBpbnRvIGNhbGwgZXhwcmVzc2lvbnMgb2ZcbiAqIGBPYmplY3QuZGVmaW5lUHJvcGVydHlgLCBzdWNoIGFzXG4gKlxuICogYGBgXG4gKiBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2xhenoucHJvdG90eXBlLCBcInByb3BlcnR5XCIsIHtcbiAqICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICByZXR1cm4gJ3ZhbHVlJztcbiAqICAgfSxcbiAqICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAqICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAqICAgfSxcbiAqICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAqICAgY29uZmlndXJhYmxlOiB0cnVlXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIFRoaXMgZnVuY3Rpb24gaW5zcGVjdHMgdGhlIGdpdmVuIG5vZGUgdG8gZGV0ZXJtaW5lIGlmIGl0IGNvcnJlc3BvbmRzIHdpdGggc3VjaCBhIGNhbGwsIGFuZCBpZiBzb1xuICogZXh0cmFjdHMgdGhlIGBzZXRgIGFuZCBgZ2V0YCBmdW5jdGlvbiBleHByZXNzaW9ucyBmcm9tIHRoZSBkZXNjcmlwdG9yIG9iamVjdCwgaWYgdGhleSBleGlzdC5cbiAqXG4gKiBAcGFyYW0gbm9kZSBUaGUgbm9kZSB0byBvYnRhaW4gdGhlIHByb3BlcnR5IGRlZmluaXRpb24gZnJvbS5cbiAqIEByZXR1cm5zIFRoZSBwcm9wZXJ0eSBkZWZpbml0aW9uIGlmIHRoZSBub2RlIGNvcnJlc3BvbmRzIHdpdGggYWNjZXNzb3IsIG51bGwgb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eURlZmluaXRpb24obm9kZTogdHMuTm9kZSk6IFByb3BlcnR5RGVmaW5pdGlvbnxudWxsIHtcbiAgaWYgKCF0cy5pc0NhbGxFeHByZXNzaW9uKG5vZGUpKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBmbiA9IG5vZGUuZXhwcmVzc2lvbjtcbiAgaWYgKCF0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihmbikgfHwgIXRzLmlzSWRlbnRpZmllcihmbi5leHByZXNzaW9uKSB8fFxuICAgICAgZm4uZXhwcmVzc2lvbi50ZXh0ICE9PSAnT2JqZWN0JyB8fCBmbi5uYW1lLnRleHQgIT09ICdkZWZpbmVQcm9wZXJ0eScpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgZGVzY3JpcHRvciA9IG5vZGUuYXJndW1lbnRzWzJdO1xuICBpZiAoIWRlc2NyaXB0b3IgfHwgIXRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24oZGVzY3JpcHRvcikpIHJldHVybiBudWxsO1xuXG4gIHJldHVybiB7XG4gICAgc2V0dGVyOiByZWFkUHJvcGVydHlGdW5jdGlvbkV4cHJlc3Npb24oZGVzY3JpcHRvciwgJ3NldCcpLFxuICAgIGdldHRlcjogcmVhZFByb3BlcnR5RnVuY3Rpb25FeHByZXNzaW9uKGRlc2NyaXB0b3IsICdnZXQnKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVhZFByb3BlcnR5RnVuY3Rpb25FeHByZXNzaW9uKG9iamVjdDogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24sIG5hbWU6IHN0cmluZykge1xuICBjb25zdCBwcm9wZXJ0eSA9IG9iamVjdC5wcm9wZXJ0aWVzLmZpbmQoXG4gICAgICAocCk6IHAgaXMgdHMuUHJvcGVydHlBc3NpZ25tZW50ID0+XG4gICAgICAgICAgdHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQocCkgJiYgdHMuaXNJZGVudGlmaWVyKHAubmFtZSkgJiYgcC5uYW1lLnRleHQgPT09IG5hbWUpO1xuXG4gIHJldHVybiBwcm9wZXJ0eSAmJiB0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihwcm9wZXJ0eS5pbml0aWFsaXplcikgJiYgcHJvcGVydHkuaW5pdGlhbGl6ZXIgfHwgbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0UmV0dXJuU3RhdGVtZW50KGRlY2xhcmF0aW9uOiB0cy5FeHByZXNzaW9ufHVuZGVmaW5lZCk6IHRzLlJldHVyblN0YXRlbWVudHx1bmRlZmluZWQge1xuICByZXR1cm4gZGVjbGFyYXRpb24gJiYgdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24oZGVjbGFyYXRpb24pID9cbiAgICAgIGRlY2xhcmF0aW9uLmJvZHkuc3RhdGVtZW50cy5maW5kKHRzLmlzUmV0dXJuU3RhdGVtZW50KSA6XG4gICAgICB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3RBcnJheUVsZW1lbnQoZWxlbWVudDogdHMuRXhwcmVzc2lvbikge1xuICByZXR1cm4gdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihlbGVtZW50KSA/IHJlZmxlY3RPYmplY3RMaXRlcmFsKGVsZW1lbnQpIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNBcmd1bWVudHNJZGVudGlmaWVyKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgcmV0dXJuIHRzLmlzSWRlbnRpZmllcihleHByZXNzaW9uKSAmJiBleHByZXNzaW9uLnRleHQgPT09ICdhcmd1bWVudHMnO1xufVxuXG5mdW5jdGlvbiBpc1N1cGVyTm90TnVsbChleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiBpc0JpbmFyeUV4cHIoZXhwcmVzc2lvbiwgdHMuU3ludGF4S2luZC5FeGNsYW1hdGlvbkVxdWFsc0VxdWFsc1Rva2VuKSAmJlxuICAgICAgaXNTdXBlcklkZW50aWZpZXIoZXhwcmVzc2lvbi5sZWZ0KTtcbn1cblxuZnVuY3Rpb24gaXNCaW5hcnlFeHByKFxuICAgIGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24sIG9wZXJhdG9yOiB0cy5CaW5hcnlPcGVyYXRvcik6IGV4cHJlc3Npb24gaXMgdHMuQmluYXJ5RXhwcmVzc2lvbiB7XG4gIHJldHVybiB0cy5pc0JpbmFyeUV4cHJlc3Npb24oZXhwcmVzc2lvbikgJiYgZXhwcmVzc2lvbi5vcGVyYXRvclRva2VuLmtpbmQgPT09IG9wZXJhdG9yO1xufVxuXG5mdW5jdGlvbiBpc1N1cGVySWRlbnRpZmllcihub2RlOiB0cy5Ob2RlKTogYm9vbGVhbiB7XG4gIC8vIFZlcmlmeSB0aGF0IHRoZSBpZGVudGlmaWVyIGlzIHByZWZpeGVkIHdpdGggYF9zdXBlcmAuIFdlIGRvbid0IHRlc3QgZm9yIGVxdWl2YWxlbmNlXG4gIC8vIGFzIFR5cGVTY3JpcHQgbWF5IGhhdmUgc3VmZml4ZWQgdGhlIG5hbWUsIGUuZy4gYF9zdXBlcl8xYCB0byBhdm9pZCBuYW1lIGNvbmZsaWN0cy5cbiAgLy8gUmVxdWlyaW5nIG9ubHkgYSBwcmVmaXggc2hvdWxkIGJlIHN1ZmZpY2llbnRseSBhY2N1cmF0ZS5cbiAgcmV0dXJuIHRzLmlzSWRlbnRpZmllcihub2RlKSAmJiBub2RlLnRleHQuc3RhcnRzV2l0aCgnX3N1cGVyJyk7XG59XG5cbi8qKlxuICogUGFyc2UgdGhlIHN0YXRlbWVudCB0byBleHRyYWN0IHRoZSBFU001IHBhcmFtZXRlciBpbml0aWFsaXplciBpZiB0aGVyZSBpcyBvbmUuXG4gKiBJZiBvbmUgaXMgZm91bmQsIGFkZCBpdCB0byB0aGUgYXBwcm9wcmlhdGUgcGFyYW1ldGVyIGluIHRoZSBgcGFyYW1ldGVyc2AgY29sbGVjdGlvbi5cbiAqXG4gKiBUaGUgZm9ybSB3ZSBhcmUgbG9va2luZyBmb3IgaXM6XG4gKlxuICogYGBgXG4gKiBpZiAoYXJnID09PSB2b2lkIDApIHsgYXJnID0gaW5pdGlhbGl6ZXI7IH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBzdGF0ZW1lbnQgYSBzdGF0ZW1lbnQgdGhhdCBtYXkgYmUgaW5pdGlhbGl6aW5nIGFuIG9wdGlvbmFsIHBhcmFtZXRlclxuICogQHBhcmFtIHBhcmFtZXRlcnMgdGhlIGNvbGxlY3Rpb24gb2YgcGFyYW1ldGVycyB0aGF0IHdlcmUgZm91bmQgaW4gdGhlIGZ1bmN0aW9uIGRlZmluaXRpb25cbiAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHN0YXRlbWVudCB3YXMgYSBwYXJhbWV0ZXIgaW5pdGlhbGl6ZXJcbiAqL1xuZnVuY3Rpb24gY2FwdHVyZVBhcmFtSW5pdGlhbGl6ZXIoc3RhdGVtZW50OiB0cy5TdGF0ZW1lbnQsIHBhcmFtZXRlcnM6IFBhcmFtZXRlcltdKSB7XG4gIGlmICh0cy5pc0lmU3RhdGVtZW50KHN0YXRlbWVudCkgJiYgaXNVbmRlZmluZWRDb21wYXJpc29uKHN0YXRlbWVudC5leHByZXNzaW9uKSAmJlxuICAgICAgdHMuaXNCbG9jayhzdGF0ZW1lbnQudGhlblN0YXRlbWVudCkgJiYgc3RhdGVtZW50LnRoZW5TdGF0ZW1lbnQuc3RhdGVtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICBjb25zdCBpZlN0YXRlbWVudENvbXBhcmlzb24gPSBzdGF0ZW1lbnQuZXhwcmVzc2lvbjsgICAgICAgICAgIC8vIChhcmcgPT09IHZvaWQgMClcbiAgICBjb25zdCB0aGVuU3RhdGVtZW50ID0gc3RhdGVtZW50LnRoZW5TdGF0ZW1lbnQuc3RhdGVtZW50c1swXTsgIC8vIGFyZyA9IGluaXRpYWxpemVyO1xuICAgIGlmIChpc0Fzc2lnbm1lbnRTdGF0ZW1lbnQodGhlblN0YXRlbWVudCkpIHtcbiAgICAgIGNvbnN0IGNvbXBhcmlzb25OYW1lID0gaWZTdGF0ZW1lbnRDb21wYXJpc29uLmxlZnQudGV4dDtcbiAgICAgIGNvbnN0IGFzc2lnbm1lbnROYW1lID0gdGhlblN0YXRlbWVudC5leHByZXNzaW9uLmxlZnQudGV4dDtcbiAgICAgIGlmIChjb21wYXJpc29uTmFtZSA9PT0gYXNzaWdubWVudE5hbWUpIHtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gcGFyYW1ldGVycy5maW5kKHAgPT4gcC5uYW1lID09PSBjb21wYXJpc29uTmFtZSk7XG4gICAgICAgIGlmIChwYXJhbWV0ZXIpIHtcbiAgICAgICAgICBwYXJhbWV0ZXIuaW5pdGlhbGl6ZXIgPSB0aGVuU3RhdGVtZW50LmV4cHJlc3Npb24ucmlnaHQ7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZENvbXBhcmlzb24oZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IGV4cHJlc3Npb24gaXMgdHMuRXhwcmVzc2lvbiZcbiAgICB7bGVmdDogdHMuSWRlbnRpZmllciwgcmlnaHQ6IHRzLkV4cHJlc3Npb259IHtcbiAgcmV0dXJuIHRzLmlzQmluYXJ5RXhwcmVzc2lvbihleHByZXNzaW9uKSAmJlxuICAgICAgZXhwcmVzc2lvbi5vcGVyYXRvclRva2VuLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzRXF1YWxzVG9rZW4gJiZcbiAgICAgIHRzLmlzVm9pZEV4cHJlc3Npb24oZXhwcmVzc2lvbi5yaWdodCkgJiYgdHMuaXNJZGVudGlmaWVyKGV4cHJlc3Npb24ubGVmdCk7XG59XG5cbi8qKlxuICogUGFyc2UgdGhlIGRlY2xhcmF0aW9uIG9mIHRoZSBnaXZlbiBgY2xhc3NTeW1ib2xgIHRvIGZpbmQgdGhlIElJRkUgd3JhcHBlciBmdW5jdGlvbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIG1heSBhY2NlcHQgYSBgX3N1cGVyYCBhcmd1bWVudCBpZiB0aGVyZSBpcyBhIGJhc2UgY2xhc3MuXG4gKlxuICogYGBgXG4gKiB2YXIgVGVzdENsYXNzID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgX19leHRlbmRzKFRlc3RDbGFzcywgX3N1cGVyKTtcbiAqICAgZnVuY3Rpb24gVGVzdENsYXNzKCkge31cbiAqICAgcmV0dXJuIFRlc3RDbGFzcztcbiAqIH0oQmFzZUNsYXNzKSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gY2xhc3NTeW1ib2wgdGhlIGNsYXNzIHdob3NlIGlpZmUgd3JhcHBlciBmdW5jdGlvbiB3ZSB3YW50IHRvIGdldC5cbiAqIEByZXR1cm5zIHRoZSBJSUZFIGZ1bmN0aW9uIG9yIG51bGwgaWYgaXQgY291bGQgbm90IGJlIHBhcnNlZC5cbiAqL1xuZnVuY3Rpb24gZ2V0SWlmZUZuKGNsYXNzU3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2x8dW5kZWZpbmVkKTogdHMuRnVuY3Rpb25FeHByZXNzaW9ufG51bGwge1xuICBpZiAoY2xhc3NTeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgaW5uZXJEZWNsYXJhdGlvbiA9IGNsYXNzU3ltYm9sLmltcGxlbWVudGF0aW9uLnZhbHVlRGVjbGFyYXRpb247XG4gIGNvbnN0IGlpZmVCb2R5ID0gaW5uZXJEZWNsYXJhdGlvbi5wYXJlbnQ7XG4gIGlmICghdHMuaXNCbG9jayhpaWZlQm9keSkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGlpZmVXcmFwcGVyID0gaWlmZUJvZHkucGFyZW50O1xuICByZXR1cm4gaWlmZVdyYXBwZXIgJiYgdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24oaWlmZVdyYXBwZXIpID8gaWlmZVdyYXBwZXIgOiBudWxsO1xufVxuIl19