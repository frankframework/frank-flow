/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler-cli/ngcc/src/host/esm5_host", ["require", "exports", "tslib", "typescript", "@angular/compiler-cli/src/ngtsc/reflection", "@angular/compiler-cli/ngcc/src/utils", "@angular/compiler-cli/ngcc/src/host/esm2015_host"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Esm5ReflectionHost = void 0;
    var tslib_1 = require("tslib");
    var ts = require("typescript");
    var reflection_1 = require("@angular/compiler-cli/src/ngtsc/reflection");
    var utils_1 = require("@angular/compiler-cli/ngcc/src/utils");
    var esm2015_host_1 = require("@angular/compiler-cli/ngcc/src/host/esm2015_host");
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
    var Esm5ReflectionHost = /** @class */ (function (_super) {
        tslib_1.__extends(Esm5ReflectionHost, _super);
        function Esm5ReflectionHost() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Esm5ReflectionHost.prototype.getBaseClassExpression = function (clazz) {
            var superBaseClassExpression = _super.prototype.getBaseClassExpression.call(this, clazz);
            if (superBaseClassExpression !== null) {
                return superBaseClassExpression;
            }
            var iife = getIifeFn(this.getClassSymbol(clazz));
            if (iife === null)
                return null;
            if (iife.parameters.length !== 1 || !isSuperIdentifier(iife.parameters[0].name)) {
                return null;
            }
            if (!ts.isCallExpression(iife.parent)) {
                return null;
            }
            return iife.parent.arguments[0];
        };
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
        Esm5ReflectionHost.prototype.getDeclarationOfIdentifier = function (id) {
            var declaration = _super.prototype.getDeclarationOfIdentifier.call(this, id);
            if (declaration === null) {
                var nonEmittedNorImportedTsHelperDeclaration = utils_1.getTsHelperFnFromIdentifier(id);
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
            var block = declaration.node.parent.parent.parent;
            var aliasSymbol = this.checker.getSymbolAtLocation(declaration.node.name);
            for (var i = 0; i < block.statements.length; i++) {
                var statement = block.statements[i];
                // Looking for statement that looks like: `AliasedVariable = OriginalVariable;`
                if (esm2015_host_1.isAssignmentStatement(statement) && ts.isIdentifier(statement.expression.left) &&
                    ts.isIdentifier(statement.expression.right) &&
                    this.checker.getSymbolAtLocation(statement.expression.left) === aliasSymbol) {
                    return this.getDeclarationOfIdentifier(statement.expression.right);
                }
            }
            return declaration;
        };
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
        Esm5ReflectionHost.prototype.getDefinitionOfFunction = function (node) {
            var definition = _super.prototype.getDefinitionOfFunction.call(this, node);
            if (definition === null) {
                return null;
            }
            // Filter out and capture parameter initializers
            if (definition.body !== null) {
                var lookingForInitializers_1 = true;
                var statements = definition.body.filter(function (s) {
                    lookingForInitializers_1 =
                        lookingForInitializers_1 && captureParamInitializer(s, definition.parameters);
                    // If we are no longer looking for parameter initializers then we include this statement
                    return !lookingForInitializers_1;
                });
                definition.body = statements;
            }
            return definition;
        };
        /**
         * Check whether a `Declaration` corresponds with a known declaration, such as a TypeScript helper
         * function, and set its `known` property to the appropriate `KnownDeclaration`.
         *
         * @param decl The `Declaration` to check.
         * @return The passed in `Declaration` (potentially enhanced with a `KnownDeclaration`).
         */
        Esm5ReflectionHost.prototype.detectKnownDeclaration = function (decl) {
            decl = _super.prototype.detectKnownDeclaration.call(this, decl);
            // Also check for TS helpers
            if (decl.known === null && decl.node !== null) {
                decl.known = utils_1.getTsHelperFnFromDeclaration(decl.node);
            }
            return decl;
        };
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
        Esm5ReflectionHost.prototype.getClassSymbolFromInnerDeclaration = function (declaration) {
            var classSymbol = _super.prototype.getClassSymbolFromInnerDeclaration.call(this, declaration);
            if (classSymbol !== undefined) {
                return classSymbol;
            }
            if (!reflection_1.isNamedFunctionDeclaration(declaration)) {
                return undefined;
            }
            var outerNode = esm2015_host_1.getOuterNodeFromInnerDeclaration(declaration);
            if (outerNode === null || !utils_1.hasNameIdentifier(outerNode)) {
                return undefined;
            }
            return this.createClassSymbol(outerNode.name, declaration);
        };
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
        Esm5ReflectionHost.prototype.getConstructorParameterDeclarations = function (classSymbol) {
            var constructor = classSymbol.implementation.valueDeclaration;
            if (!ts.isFunctionDeclaration(constructor))
                return null;
            if (constructor.parameters.length > 0) {
                return Array.from(constructor.parameters);
            }
            if (this.isSynthesizedConstructor(constructor)) {
                return null;
            }
            return [];
        };
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
        Esm5ReflectionHost.prototype.getParamInfoFromStaticProperty = function (paramDecoratorsProperty) {
            var _this = this;
            var paramDecorators = esm2015_host_1.getPropertyValueFromSymbol(paramDecoratorsProperty);
            // The decorators array may be wrapped in a function. If so unwrap it.
            var returnStatement = getReturnStatement(paramDecorators);
            var expression = returnStatement ? returnStatement.expression : paramDecorators;
            if (expression && ts.isArrayLiteralExpression(expression)) {
                var elements = expression.elements;
                return elements.map(reflectArrayElement).map(function (paramInfo) {
                    var typeExpression = paramInfo && paramInfo.has('type') ? paramInfo.get('type') : null;
                    var decoratorInfo = paramInfo && paramInfo.has('decorators') ? paramInfo.get('decorators') : null;
                    var decorators = decoratorInfo && _this.reflectDecorators(decoratorInfo);
                    return { typeExpression: typeExpression, decorators: decorators };
                });
            }
            else if (paramDecorators !== undefined) {
                this.logger.warn('Invalid constructor parameter decorator in ' + paramDecorators.getSourceFile().fileName +
                    ':\n', paramDecorators.getText());
            }
            return null;
        };
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
        Esm5ReflectionHost.prototype.reflectMembers = function (symbol, decorators, isStatic) {
            var node = symbol.valueDeclaration || symbol.declarations && symbol.declarations[0];
            var propertyDefinition = node && getPropertyDefinition(node);
            if (propertyDefinition) {
                var members_1 = [];
                if (propertyDefinition.setter) {
                    members_1.push({
                        node: node,
                        implementation: propertyDefinition.setter,
                        kind: reflection_1.ClassMemberKind.Setter,
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
                    members_1.push({
                        node: node,
                        implementation: propertyDefinition.getter,
                        kind: reflection_1.ClassMemberKind.Getter,
                        type: null,
                        name: symbol.name,
                        nameNode: null,
                        value: null,
                        isStatic: isStatic || false,
                        decorators: decorators || [],
                    });
                }
                return members_1;
            }
            var members = _super.prototype.reflectMembers.call(this, symbol, decorators, isStatic);
            members && members.forEach(function (member) {
                if (member && member.kind === reflection_1.ClassMemberKind.Method && member.isStatic && member.node &&
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
        };
        /**
         * Find statements related to the given class that may contain calls to a helper.
         *
         * In ESM5 code the helper calls are hidden inside the class's IIFE.
         *
         * @param classSymbol the class whose helper calls we are interested in. We expect this symbol
         * to reference the inner identifier inside the IIFE.
         * @returns an array of statements that may contain helper calls.
         */
        Esm5ReflectionHost.prototype.getStatementsForClass = function (classSymbol) {
            var classDeclarationParent = classSymbol.implementation.valueDeclaration.parent;
            return ts.isBlock(classDeclarationParent) ? Array.from(classDeclarationParent.statements) : [];
        };
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
        Esm5ReflectionHost.prototype.isSynthesizedConstructor = function (constructor) {
            if (!constructor.body)
                return false;
            var firstStatement = constructor.body.statements[0];
            if (!firstStatement)
                return false;
            return this.isSynthesizedSuperThisAssignment(firstStatement) ||
                this.isSynthesizedSuperReturnStatement(firstStatement);
        };
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
        Esm5ReflectionHost.prototype.isSynthesizedSuperThisAssignment = function (statement) {
            if (!ts.isVariableStatement(statement))
                return false;
            var variableDeclarations = statement.declarationList.declarations;
            if (variableDeclarations.length !== 1)
                return false;
            var variableDeclaration = variableDeclarations[0];
            if (!ts.isIdentifier(variableDeclaration.name) ||
                !variableDeclaration.name.text.startsWith('_this'))
                return false;
            var initializer = variableDeclaration.initializer;
            if (!initializer)
                return false;
            return this.isSynthesizedDefaultSuperCall(initializer);
        };
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
        Esm5ReflectionHost.prototype.isSynthesizedSuperReturnStatement = function (statement) {
            if (!ts.isReturnStatement(statement))
                return false;
            var expression = statement.expression;
            if (!expression)
                return false;
            return this.isSynthesizedDefaultSuperCall(expression);
        };
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
        Esm5ReflectionHost.prototype.isSynthesizedDefaultSuperCall = function (expression) {
            if (!isBinaryExpr(expression, ts.SyntaxKind.BarBarToken))
                return false;
            if (expression.right.kind !== ts.SyntaxKind.ThisKeyword)
                return false;
            var left = expression.left;
            if (isBinaryExpr(left, ts.SyntaxKind.AmpersandAmpersandToken)) {
                return isSuperNotNull(left.left) && this.isSuperApplyCall(left.right);
            }
            else {
                return this.isSuperApplyCall(left);
            }
        };
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
        Esm5ReflectionHost.prototype.isSuperApplyCall = function (expression) {
            if (!ts.isCallExpression(expression) || expression.arguments.length !== 2)
                return false;
            var targetFn = expression.expression;
            if (!ts.isPropertyAccessExpression(targetFn))
                return false;
            if (!isSuperIdentifier(targetFn.expression))
                return false;
            if (targetFn.name.text !== 'apply')
                return false;
            var thisArgument = expression.arguments[0];
            if (thisArgument.kind !== ts.SyntaxKind.ThisKeyword)
                return false;
            var argumentsExpr = expression.arguments[1];
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
        };
        /**
         * Determines if the provided expression is one of the following call expressions:
         *
         * 1. `__spread(arguments)`
         * 2. `__spreadArray([], __read(arguments))`
         *
         * The tslib helpers may have been emitted inline as in the above example, or they may be read
         * from a namespace import.
         */
        Esm5ReflectionHost.prototype.isSpreadArgumentsExpression = function (expression) {
            var call = this.extractKnownHelperCall(expression);
            if (call === null) {
                return false;
            }
            if (call.helper === reflection_1.KnownDeclaration.TsHelperSpread) {
                // `__spread(arguments)`
                return call.args.length === 1 && isArgumentsIdentifier(call.args[0]);
            }
            else if (call.helper === reflection_1.KnownDeclaration.TsHelperSpreadArray) {
                // `__spreadArray([], __read(arguments))`
                if (call.args.length !== 2) {
                    return false;
                }
                var firstArg = call.args[0];
                if (!ts.isArrayLiteralExpression(firstArg) || firstArg.elements.length !== 0) {
                    return false;
                }
                var secondArg = this.extractKnownHelperCall(call.args[1]);
                if (secondArg === null || secondArg.helper !== reflection_1.KnownDeclaration.TsHelperRead) {
                    return false;
                }
                return secondArg.args.length === 1 && isArgumentsIdentifier(secondArg.args[0]);
            }
            else {
                return false;
            }
        };
        /**
         * Inspects the provided expression and determines if it corresponds with a known helper function
         * as receiver expression.
         */
        Esm5ReflectionHost.prototype.extractKnownHelperCall = function (expression) {
            if (!ts.isCallExpression(expression)) {
                return null;
            }
            var receiverExpr = expression.expression;
            // The helper could be globally available, or accessed through a namespaced import. Hence we
            // support a property access here as long as it resolves to the actual known TypeScript helper.
            var receiver = null;
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
        };
        return Esm5ReflectionHost;
    }(esm2015_host_1.Esm2015ReflectionHost));
    exports.Esm5ReflectionHost = Esm5ReflectionHost;
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
        var fn = node.expression;
        if (!ts.isPropertyAccessExpression(fn) || !ts.isIdentifier(fn.expression) ||
            fn.expression.text !== 'Object' || fn.name.text !== 'defineProperty')
            return null;
        var descriptor = node.arguments[2];
        if (!descriptor || !ts.isObjectLiteralExpression(descriptor))
            return null;
        return {
            setter: readPropertyFunctionExpression(descriptor, 'set'),
            getter: readPropertyFunctionExpression(descriptor, 'get'),
        };
    }
    function readPropertyFunctionExpression(object, name) {
        var property = object.properties.find(function (p) {
            return ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name;
        });
        return property && ts.isFunctionExpression(property.initializer) && property.initializer || null;
    }
    function getReturnStatement(declaration) {
        return declaration && ts.isFunctionExpression(declaration) ?
            declaration.body.statements.find(ts.isReturnStatement) :
            undefined;
    }
    function reflectArrayElement(element) {
        return ts.isObjectLiteralExpression(element) ? reflection_1.reflectObjectLiteral(element) : null;
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
            var ifStatementComparison = statement.expression; // (arg === void 0)
            var thenStatement = statement.thenStatement.statements[0]; // arg = initializer;
            if (esm2015_host_1.isAssignmentStatement(thenStatement)) {
                var comparisonName_1 = ifStatementComparison.left.text;
                var assignmentName = thenStatement.expression.left.text;
                if (comparisonName_1 === assignmentName) {
                    var parameter = parameters.find(function (p) { return p.name === comparisonName_1; });
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
        var innerDeclaration = classSymbol.implementation.valueDeclaration;
        var iifeBody = innerDeclaration.parent;
        if (!ts.isBlock(iifeBody)) {
            return null;
        }
        var iifeWrapper = iifeBody.parent;
        return iifeWrapper && ts.isFunctionExpression(iifeWrapper) ? iifeWrapper : null;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtNV9ob3N0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2hvc3QvZXNtNV9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCwrQkFBaUM7SUFFakMseUVBQXlPO0lBQ3pPLDhEQUFzRztJQUV0RyxpRkFBcUo7SUFJcko7Ozs7Ozs7Ozs7Ozs7Ozs7O09BaUJHO0lBQ0g7UUFBd0MsOENBQXFCO1FBQTdEOztRQTJsQkEsQ0FBQztRQTFsQkMsbURBQXNCLEdBQXRCLFVBQXVCLEtBQXVCO1lBQzVDLElBQU0sd0JBQXdCLEdBQUcsaUJBQU0sc0JBQXNCLFlBQUMsS0FBSyxDQUFDLENBQUM7WUFDckUsSUFBSSx3QkFBd0IsS0FBSyxJQUFJLEVBQUU7Z0JBQ3JDLE9BQU8sd0JBQXdCLENBQUM7YUFDakM7WUFFRCxJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ25ELElBQUksSUFBSSxLQUFLLElBQUk7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFFL0IsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUMvRSxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3JDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFFRDs7Ozs7Ozs7Ozs7Ozs7OztXQWdCRztRQUNILHVEQUEwQixHQUExQixVQUEyQixFQUFpQjtZQUMxQyxJQUFNLFdBQVcsR0FBRyxpQkFBTSwwQkFBMEIsWUFBQyxFQUFFLENBQUMsQ0FBQztZQUV6RCxJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUU7Z0JBQ3hCLElBQU0sd0NBQXdDLEdBQUcsbUNBQTJCLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2pGLElBQUksd0NBQXdDLEtBQUssSUFBSSxFQUFFO29CQUNyRCwyRkFBMkY7b0JBQzNGLG9GQUFvRjtvQkFDcEYsNEVBQTRFO29CQUM1RSwyREFBMkQ7b0JBQzNELE9BQU87d0JBQ0wsSUFBSSxnQkFBd0I7d0JBQzVCLElBQUksRUFBRSxFQUFFO3dCQUNSLEtBQUssRUFBRSx3Q0FBd0M7d0JBQy9DLFNBQVMsRUFBRSxJQUFJO3FCQUNoQixDQUFDO2lCQUNIO2FBQ0Y7WUFFRCxJQUFJLFdBQVcsS0FBSyxJQUFJLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksV0FBVyxDQUFDLEtBQUssS0FBSyxJQUFJLEVBQUU7Z0JBQ25GLE9BQU8sV0FBVyxDQUFDO2FBQ3BCO1lBRUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLEtBQUssU0FBUztnQkFDekYsb0ZBQW9GO2dCQUNwRixDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN0RCxPQUFPLFdBQVcsQ0FBQzthQUNwQjtZQUVELDBEQUEwRDtZQUMxRCwwQ0FBMEM7WUFDMUMsSUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztZQUNwRCxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDNUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUNoRCxJQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0QywrRUFBK0U7Z0JBQy9FLElBQUksb0NBQXFCLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztvQkFDOUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztvQkFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLFdBQVcsRUFBRTtvQkFDL0UsT0FBTyxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDcEU7YUFDRjtZQUVELE9BQU8sV0FBVyxDQUFDO1FBQ3JCLENBQUM7UUFFRDs7Ozs7Ozs7O1dBU0c7UUFDSCxvREFBdUIsR0FBdkIsVUFBd0IsSUFBYTtZQUNuQyxJQUFNLFVBQVUsR0FBRyxpQkFBTSx1QkFBdUIsWUFBQyxJQUFJLENBQUMsQ0FBQztZQUN2RCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7Z0JBQ3ZCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxnREFBZ0Q7WUFDaEQsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtnQkFDNUIsSUFBSSx3QkFBc0IsR0FBRyxJQUFJLENBQUM7Z0JBQ2xDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQUEsQ0FBQztvQkFDekMsd0JBQXNCO3dCQUNsQix3QkFBc0IsSUFBSSx1QkFBdUIsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUNoRix3RkFBd0Y7b0JBQ3hGLE9BQU8sQ0FBQyx3QkFBc0IsQ0FBQztnQkFDakMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsVUFBVSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7YUFDOUI7WUFFRCxPQUFPLFVBQVUsQ0FBQztRQUNwQixDQUFDO1FBRUQ7Ozs7OztXQU1HO1FBQ0gsbURBQXNCLEdBQXRCLFVBQThDLElBQU87WUFDbkQsSUFBSSxHQUFHLGlCQUFNLHNCQUFzQixZQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFDLDRCQUE0QjtZQUM1QixJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO2dCQUM3QyxJQUFJLENBQUMsS0FBSyxHQUFHLG9DQUE0QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUN0RDtZQUVELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUdELDZDQUE2QztRQUU3Qzs7Ozs7Ozs7OztXQVVHO1FBQ08sK0RBQWtDLEdBQTVDLFVBQTZDLFdBQW9CO1lBQy9ELElBQU0sV0FBVyxHQUFHLGlCQUFNLGtDQUFrQyxZQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzFFLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtnQkFDN0IsT0FBTyxXQUFXLENBQUM7YUFDcEI7WUFFRCxJQUFJLENBQUMsdUNBQTBCLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzVDLE9BQU8sU0FBUyxDQUFDO2FBQ2xCO1lBRUQsSUFBTSxTQUFTLEdBQUcsK0NBQWdDLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDaEUsSUFBSSxTQUFTLEtBQUssSUFBSSxJQUFJLENBQUMseUJBQWlCLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ3ZELE9BQU8sU0FBUyxDQUFDO2FBQ2xCO1lBRUQsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQ7Ozs7Ozs7Ozs7O1dBV0c7UUFDTyxnRUFBbUMsR0FBN0MsVUFBOEMsV0FBNEI7WUFFeEUsSUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUNoRSxJQUFJLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQztnQkFBRSxPQUFPLElBQUksQ0FBQztZQUV4RCxJQUFJLFdBQVcsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDckMsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUMzQztZQUVELElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM5QyxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDO1FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztXQXFCRztRQUNPLDJEQUE4QixHQUF4QyxVQUF5Qyx1QkFBa0M7WUFBM0UsaUJBcUJDO1lBcEJDLElBQU0sZUFBZSxHQUFHLHlDQUEwQixDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDNUUsc0VBQXNFO1lBQ3RFLElBQU0sZUFBZSxHQUFHLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzVELElBQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDO1lBQ2xGLElBQUksVUFBVSxJQUFJLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDekQsSUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQztnQkFDckMsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsU0FBUztvQkFDcEQsSUFBTSxjQUFjLEdBQUcsU0FBUyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztvQkFDMUYsSUFBTSxhQUFhLEdBQ2YsU0FBUyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztvQkFDbkYsSUFBTSxVQUFVLEdBQUcsYUFBYSxJQUFJLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDMUUsT0FBTyxFQUFDLGNBQWMsZ0JBQUEsRUFBRSxVQUFVLFlBQUEsRUFBQyxDQUFDO2dCQUN0QyxDQUFDLENBQUMsQ0FBQzthQUNKO2lCQUFNLElBQUksZUFBZSxLQUFLLFNBQVMsRUFBRTtnQkFDeEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ1osNkNBQTZDLEdBQUcsZUFBZSxDQUFDLGFBQWEsRUFBRSxDQUFDLFFBQVE7b0JBQ3BGLEtBQUssRUFDVCxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUNoQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVEOzs7Ozs7Ozs7Ozs7V0FZRztRQUNPLDJDQUFjLEdBQXhCLFVBQXlCLE1BQWlCLEVBQUUsVUFBd0IsRUFBRSxRQUFrQjtZQUV0RixJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsZ0JBQWdCLElBQUksTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RGLElBQU0sa0JBQWtCLEdBQUcsSUFBSSxJQUFJLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9ELElBQUksa0JBQWtCLEVBQUU7Z0JBQ3RCLElBQU0sU0FBTyxHQUFrQixFQUFFLENBQUM7Z0JBQ2xDLElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFO29CQUM3QixTQUFPLENBQUMsSUFBSSxDQUFDO3dCQUNYLElBQUksRUFBRSxJQUFLO3dCQUNYLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxNQUFNO3dCQUN6QyxJQUFJLEVBQUUsNEJBQWUsQ0FBQyxNQUFNO3dCQUM1QixJQUFJLEVBQUUsSUFBSTt3QkFDVixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7d0JBQ2pCLFFBQVEsRUFBRSxJQUFJO3dCQUNkLEtBQUssRUFBRSxJQUFJO3dCQUNYLFFBQVEsRUFBRSxRQUFRLElBQUksS0FBSzt3QkFDM0IsVUFBVSxFQUFFLFVBQVUsSUFBSSxFQUFFO3FCQUM3QixDQUFDLENBQUM7b0JBRUgsMEZBQTBGO29CQUMxRiwwRkFBMEY7b0JBQzFGLDJFQUEyRTtvQkFDM0UsVUFBVSxHQUFHLFNBQVMsQ0FBQztpQkFDeEI7Z0JBQ0QsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUU7b0JBQzdCLFNBQU8sQ0FBQyxJQUFJLENBQUM7d0JBQ1gsSUFBSSxFQUFFLElBQUs7d0JBQ1gsY0FBYyxFQUFFLGtCQUFrQixDQUFDLE1BQU07d0JBQ3pDLElBQUksRUFBRSw0QkFBZSxDQUFDLE1BQU07d0JBQzVCLElBQUksRUFBRSxJQUFJO3dCQUNWLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTt3QkFDakIsUUFBUSxFQUFFLElBQUk7d0JBQ2QsS0FBSyxFQUFFLElBQUk7d0JBQ1gsUUFBUSxFQUFFLFFBQVEsSUFBSSxLQUFLO3dCQUMzQixVQUFVLEVBQUUsVUFBVSxJQUFJLEVBQUU7cUJBQzdCLENBQUMsQ0FBQztpQkFDSjtnQkFDRCxPQUFPLFNBQU8sQ0FBQzthQUNoQjtZQUVELElBQU0sT0FBTyxHQUFHLGlCQUFNLGNBQWMsWUFBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ25FLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUEsTUFBTTtnQkFDL0IsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyw0QkFBZSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJO29CQUNsRixFQUFFLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTTtvQkFDaEUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO29CQUN6QyxFQUFFLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQ3JELGdEQUFnRDtvQkFDaEQsa0ZBQWtGO29CQUNsRix5Q0FBeUM7b0JBQ3pDLE1BQU0sQ0FBQyxjQUFjLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO2lCQUNsRDtZQUNILENBQUMsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztRQUVEOzs7Ozs7OztXQVFHO1FBQ08sa0RBQXFCLEdBQS9CLFVBQWdDLFdBQTRCO1lBQzFELElBQU0sc0JBQXNCLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7WUFDbEYsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNqRyxDQUFDO1FBRUQsZ0RBQWdEO1FBRWhEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1dBd0NHO1FBQ0sscURBQXdCLEdBQWhDLFVBQWlDLFdBQW1DO1lBQ2xFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSTtnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUVwQyxJQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxJQUFJLENBQUMsY0FBYztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUVsQyxPQUFPLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxjQUFjLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1dBb0JHO1FBQ0ssNkRBQWdDLEdBQXhDLFVBQXlDLFNBQXVCO1lBQzlELElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBRXJELElBQU0sb0JBQW9CLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUM7WUFDcEUsSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLEtBQUssQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUVwRCxJQUFNLG1CQUFtQixHQUFHLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQztnQkFDMUMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7Z0JBQ3BELE9BQU8sS0FBSyxDQUFDO1lBRWYsSUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxDQUFDO1lBQ3BELElBQUksQ0FBQyxXQUFXO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBRS9CLE9BQU8sSUFBSSxDQUFDLDZCQUE2QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFDRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7V0FvQkc7UUFDSyw4REFBaUMsR0FBekMsVUFBMEMsU0FBdUI7WUFDL0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUM7WUFFbkQsSUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQztZQUN4QyxJQUFJLENBQUMsVUFBVTtnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUU5QixPQUFPLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN4RCxDQUFDO1FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1dBb0JHO1FBQ0ssMERBQTZCLEdBQXJDLFVBQXNDLFVBQXlCO1lBQzdELElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQ3ZFLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBRXRFLElBQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7WUFDN0IsSUFBSSxZQUFZLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsdUJBQXVCLENBQUMsRUFBRTtnQkFDN0QsT0FBTyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDdkU7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDcEM7UUFDSCxDQUFDO1FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1dBZ0NHO1FBQ0ssNkNBQWdCLEdBQXhCLFVBQXlCLFVBQXlCO1lBQ2hELElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUV4RixJQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQTBCLENBQUMsUUFBUSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQzNELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQzFELElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssT0FBTztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUVqRCxJQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdDLElBQUksWUFBWSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVc7Z0JBQUUsT0FBTyxLQUFLLENBQUM7WUFFbEUsSUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUU5Qyx3RkFBd0Y7WUFDeEYsMkZBQTJGO1lBQzNGLDJDQUEyQztZQUMzQyxJQUFJLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUN4QyxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsNkZBQTZGO1lBQzdGLDZGQUE2RjtZQUM3Riw0RkFBNEY7WUFDNUYsMEJBQTBCO1lBQzFCLE9BQU8sSUFBSSxDQUFDLDJCQUEyQixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRDs7Ozs7Ozs7V0FRRztRQUNLLHdEQUEyQixHQUFuQyxVQUFvQyxVQUF5QjtZQUMzRCxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDckQsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO2dCQUNqQixPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLDZCQUFnQixDQUFDLGNBQWMsRUFBRTtnQkFDbkQsd0JBQXdCO2dCQUN4QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDdEU7aUJBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLDZCQUFnQixDQUFDLG1CQUFtQixFQUFFO2dCQUMvRCx5Q0FBeUM7Z0JBQ3pDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUMxQixPQUFPLEtBQUssQ0FBQztpQkFDZDtnQkFFRCxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5QixJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDNUUsT0FBTyxLQUFLLENBQUM7aUJBQ2Q7Z0JBRUQsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDNUQsSUFBSSxTQUFTLEtBQUssSUFBSSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssNkJBQWdCLENBQUMsWUFBWSxFQUFFO29CQUM1RSxPQUFPLEtBQUssQ0FBQztpQkFDZDtnQkFFRCxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDaEY7aUJBQU07Z0JBQ0wsT0FBTyxLQUFLLENBQUM7YUFDZDtRQUNILENBQUM7UUFFRDs7O1dBR0c7UUFDSyxtREFBc0IsR0FBOUIsVUFBK0IsVUFBeUI7WUFFdEQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDcEMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELElBQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFFM0MsNEZBQTRGO1lBQzVGLCtGQUErRjtZQUMvRixJQUFJLFFBQVEsR0FBcUIsSUFBSSxDQUFDO1lBQ3RDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDakMsUUFBUSxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUMxRDtpQkFBTSxJQUFJLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDNUYsUUFBUSxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDL0Q7WUFFRCxJQUFJLFFBQVEsS0FBSyxJQUFJLElBQUksUUFBUSxDQUFDLEtBQUssS0FBSyxJQUFJLEVBQUU7Z0JBQ2hELE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxPQUFPO2dCQUNMLE1BQU0sRUFBRSxRQUFRLENBQUMsS0FBSztnQkFDdEIsSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUFTO2FBQzNCLENBQUM7UUFDSixDQUFDO1FBQ0gseUJBQUM7SUFBRCxDQUFDLEFBM2xCRCxDQUF3QyxvQ0FBcUIsR0EybEI1RDtJQTNsQlksZ0RBQWtCO0lBdW1CL0I7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FzQkc7SUFDSCxTQUFTLHFCQUFxQixDQUFDLElBQWE7UUFDMUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUU1QyxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQzNCLElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUM7WUFDckUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQjtZQUN0RSxPQUFPLElBQUksQ0FBQztRQUVkLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUUxRSxPQUFPO1lBQ0wsTUFBTSxFQUFFLDhCQUE4QixDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUM7WUFDekQsTUFBTSxFQUFFLDhCQUE4QixDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUM7U0FDMUQsQ0FBQztJQUNKLENBQUM7SUFFRCxTQUFTLDhCQUE4QixDQUFDLE1BQWtDLEVBQUUsSUFBWTtRQUN0RixJQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FDbkMsVUFBQyxDQUFDO1lBQ0UsT0FBQSxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSTtRQUE3RSxDQUE2RSxDQUFDLENBQUM7UUFFdkYsT0FBTyxRQUFRLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxRQUFRLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQztJQUNuRyxDQUFDO0lBRUQsU0FBUyxrQkFBa0IsQ0FBQyxXQUFvQztRQUM5RCxPQUFPLFdBQVcsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUN4RCxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztZQUN4RCxTQUFTLENBQUM7SUFDaEIsQ0FBQztJQUVELFNBQVMsbUJBQW1CLENBQUMsT0FBc0I7UUFDakQsT0FBTyxFQUFFLENBQUMseUJBQXlCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlDQUFvQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDdEYsQ0FBQztJQUVELFNBQVMscUJBQXFCLENBQUMsVUFBeUI7UUFDdEQsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDO0lBQ3hFLENBQUM7SUFFRCxTQUFTLGNBQWMsQ0FBQyxVQUF5QjtRQUMvQyxPQUFPLFlBQVksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyw0QkFBNEIsQ0FBQztZQUN2RSxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVELFNBQVMsWUFBWSxDQUNqQixVQUF5QixFQUFFLFFBQTJCO1FBQ3hELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQztJQUN6RixDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFhO1FBQ3RDLHNGQUFzRjtRQUN0RixxRkFBcUY7UUFDckYsMkRBQTJEO1FBQzNELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNILFNBQVMsdUJBQXVCLENBQUMsU0FBdUIsRUFBRSxVQUF1QjtRQUMvRSxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUkscUJBQXFCLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztZQUMxRSxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsSUFBSSxTQUFTLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzFGLElBQU0scUJBQXFCLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFXLG1CQUFtQjtZQUNqRixJQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFLHFCQUFxQjtZQUNuRixJQUFJLG9DQUFxQixDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUN4QyxJQUFNLGdCQUFjLEdBQUcscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDdkQsSUFBTSxjQUFjLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUMxRCxJQUFJLGdCQUFjLEtBQUssY0FBYyxFQUFFO29CQUNyQyxJQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLElBQUksS0FBSyxnQkFBYyxFQUF6QixDQUF5QixDQUFDLENBQUM7b0JBQ2xFLElBQUksU0FBUyxFQUFFO3dCQUNiLFNBQVMsQ0FBQyxXQUFXLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7d0JBQ3ZELE9BQU8sSUFBSSxDQUFDO3FCQUNiO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELFNBQVMscUJBQXFCLENBQUMsVUFBeUI7UUFFdEQsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDO1lBQ3BDLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsdUJBQXVCO1lBQ3ZFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEYsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7T0FlRztJQUNILFNBQVMsU0FBUyxDQUFDLFdBQXNDO1FBQ3ZELElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtZQUM3QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDO1FBQ3JFLElBQU0sUUFBUSxHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBQztRQUN6QyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUN6QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUNwQyxPQUFPLFdBQVcsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ2xGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbiwgQ2xhc3NNZW1iZXIsIENsYXNzTWVtYmVyS2luZCwgRGVjbGFyYXRpb24sIERlY2xhcmF0aW9uS2luZCwgRGVjb3JhdG9yLCBGdW5jdGlvbkRlZmluaXRpb24sIGlzTmFtZWRGdW5jdGlvbkRlY2xhcmF0aW9uLCBLbm93bkRlY2xhcmF0aW9uLCBQYXJhbWV0ZXIsIHJlZmxlY3RPYmplY3RMaXRlcmFsfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvcmVmbGVjdGlvbic7XG5pbXBvcnQge2dldFRzSGVscGVyRm5Gcm9tRGVjbGFyYXRpb24sIGdldFRzSGVscGVyRm5Gcm9tSWRlbnRpZmllciwgaGFzTmFtZUlkZW50aWZpZXJ9IGZyb20gJy4uL3V0aWxzJztcblxuaW1wb3J0IHtFc20yMDE1UmVmbGVjdGlvbkhvc3QsIGdldE91dGVyTm9kZUZyb21Jbm5lckRlY2xhcmF0aW9uLCBnZXRQcm9wZXJ0eVZhbHVlRnJvbVN5bWJvbCwgaXNBc3NpZ25tZW50U3RhdGVtZW50LCBQYXJhbUluZm99IGZyb20gJy4vZXNtMjAxNV9ob3N0JztcbmltcG9ydCB7TmdjY0NsYXNzU3ltYm9sfSBmcm9tICcuL25nY2NfaG9zdCc7XG5cblxuLyoqXG4gKiBFU001IHBhY2thZ2VzIGNvbnRhaW4gRUNNQVNjcmlwdCBJSUZFIGZ1bmN0aW9ucyB0aGF0IGFjdCBsaWtlIGNsYXNzZXMuIEZvciBleGFtcGxlOlxuICpcbiAqIGBgYFxuICogdmFyIENvbW1vbk1vZHVsZSA9IChmdW5jdGlvbiAoKSB7XG4gKiAgZnVuY3Rpb24gQ29tbW9uTW9kdWxlKCkge1xuICogIH1cbiAqICBDb21tb25Nb2R1bGUuZGVjb3JhdG9ycyA9IFsgLi4uIF07XG4gKiAgcmV0dXJuIENvbW1vbk1vZHVsZTtcbiAqIGBgYFxuICpcbiAqICogXCJDbGFzc2VzXCIgYXJlIGRlY29yYXRlZCBpZiB0aGV5IGhhdmUgYSBzdGF0aWMgcHJvcGVydHkgY2FsbGVkIGBkZWNvcmF0b3JzYC5cbiAqICogTWVtYmVycyBhcmUgZGVjb3JhdGVkIGlmIHRoZXJlIGlzIGEgbWF0Y2hpbmcga2V5IG9uIGEgc3RhdGljIHByb3BlcnR5XG4gKiAgIGNhbGxlZCBgcHJvcERlY29yYXRvcnNgLlxuICogKiBDb25zdHJ1Y3RvciBwYXJhbWV0ZXJzIGRlY29yYXRvcnMgYXJlIGZvdW5kIG9uIGFuIG9iamVjdCByZXR1cm5lZCBmcm9tXG4gKiAgIGEgc3RhdGljIG1ldGhvZCBjYWxsZWQgYGN0b3JQYXJhbWV0ZXJzYC5cbiAqXG4gKi9cbmV4cG9ydCBjbGFzcyBFc201UmVmbGVjdGlvbkhvc3QgZXh0ZW5kcyBFc20yMDE1UmVmbGVjdGlvbkhvc3Qge1xuICBnZXRCYXNlQ2xhc3NFeHByZXNzaW9uKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBjb25zdCBzdXBlckJhc2VDbGFzc0V4cHJlc3Npb24gPSBzdXBlci5nZXRCYXNlQ2xhc3NFeHByZXNzaW9uKGNsYXp6KTtcbiAgICBpZiAoc3VwZXJCYXNlQ2xhc3NFeHByZXNzaW9uICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gc3VwZXJCYXNlQ2xhc3NFeHByZXNzaW9uO1xuICAgIH1cblxuICAgIGNvbnN0IGlpZmUgPSBnZXRJaWZlRm4odGhpcy5nZXRDbGFzc1N5bWJvbChjbGF6eikpO1xuICAgIGlmIChpaWZlID09PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChpaWZlLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxIHx8ICFpc1N1cGVySWRlbnRpZmllcihpaWZlLnBhcmFtZXRlcnNbMF0ubmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICghdHMuaXNDYWxsRXhwcmVzc2lvbihpaWZlLnBhcmVudCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBpaWZlLnBhcmVudC5hcmd1bWVudHNbMF07XG4gIH1cblxuICAvKipcbiAgICogVHJhY2UgYW4gaWRlbnRpZmllciB0byBpdHMgZGVjbGFyYXRpb24sIGlmIHBvc3NpYmxlLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhdHRlbXB0cyB0byByZXNvbHZlIHRoZSBkZWNsYXJhdGlvbiBvZiB0aGUgZ2l2ZW4gaWRlbnRpZmllciwgdHJhY2luZyBiYWNrIHRocm91Z2hcbiAgICogaW1wb3J0cyBhbmQgcmUtZXhwb3J0cyB1bnRpbCB0aGUgb3JpZ2luYWwgZGVjbGFyYXRpb24gc3RhdGVtZW50IGlzIGZvdW5kLiBBIGBEZWNsYXJhdGlvbmBcbiAgICogb2JqZWN0IGlzIHJldHVybmVkIGlmIHRoZSBvcmlnaW5hbCBkZWNsYXJhdGlvbiBpcyBmb3VuZCwgb3IgYG51bGxgIGlzIHJldHVybmVkIG90aGVyd2lzZS5cbiAgICpcbiAgICogSW4gRVM1LCB0aGUgaW1wbGVtZW50YXRpb24gb2YgYSBjbGFzcyBpcyBhIGZ1bmN0aW9uIGV4cHJlc3Npb24gdGhhdCBpcyBoaWRkZW4gaW5zaWRlIGFuIElJRkUuXG4gICAqIElmIHdlIGFyZSBsb29raW5nIGZvciB0aGUgZGVjbGFyYXRpb24gb2YgdGhlIGlkZW50aWZpZXIgb2YgdGhlIGlubmVyIGZ1bmN0aW9uIGV4cHJlc3Npb24sIHdlXG4gICAqIHdpbGwgZ2V0IGhvbGQgb2YgdGhlIG91dGVyIFwiY2xhc3NcIiB2YXJpYWJsZSBkZWNsYXJhdGlvbiBhbmQgcmV0dXJuIGl0cyBpZGVudGlmaWVyIGluc3RlYWQuIFNlZVxuICAgKiBgZ2V0Q2xhc3NEZWNsYXJhdGlvbkZyb21Jbm5lckZ1bmN0aW9uRGVjbGFyYXRpb24oKWAgZm9yIG1vcmUgaW5mby5cbiAgICpcbiAgICogQHBhcmFtIGlkIGEgVHlwZVNjcmlwdCBgdHMuSWRlbnRpZmllcmAgdG8gdHJhY2UgYmFjayB0byBhIGRlY2xhcmF0aW9uLlxuICAgKlxuICAgKiBAcmV0dXJucyBtZXRhZGF0YSBhYm91dCB0aGUgYERlY2xhcmF0aW9uYCBpZiB0aGUgb3JpZ2luYWwgZGVjbGFyYXRpb24gaXMgZm91bmQsIG9yIGBudWxsYFxuICAgKiBvdGhlcndpc2UuXG4gICAqL1xuICBnZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihpZDogdHMuSWRlbnRpZmllcik6IERlY2xhcmF0aW9ufG51bGwge1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gc3VwZXIuZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIoaWQpO1xuXG4gICAgaWYgKGRlY2xhcmF0aW9uID09PSBudWxsKSB7XG4gICAgICBjb25zdCBub25FbWl0dGVkTm9ySW1wb3J0ZWRUc0hlbHBlckRlY2xhcmF0aW9uID0gZ2V0VHNIZWxwZXJGbkZyb21JZGVudGlmaWVyKGlkKTtcbiAgICAgIGlmIChub25FbWl0dGVkTm9ySW1wb3J0ZWRUc0hlbHBlckRlY2xhcmF0aW9uICE9PSBudWxsKSB7XG4gICAgICAgIC8vIE5vIGRlY2xhcmF0aW9uIGNvdWxkIGJlIGZvdW5kIGZvciB0aGlzIGlkZW50aWZpZXIgYW5kIGl0cyBuYW1lIG1hdGNoZXMgYSBrbm93biBUUyBoZWxwZXJcbiAgICAgICAgLy8gZnVuY3Rpb24uIFRoaXMgY2FuIGhhcHBlbiBpZiBhIHBhY2thZ2UgaXMgY29tcGlsZWQgd2l0aCBgbm9FbWl0SGVscGVyczogdHJ1ZWAgYW5kXG4gICAgICAgIC8vIGBpbXBvcnRIZWxwZXJzOiBmYWxzZWAgKHRoZSBkZWZhdWx0KS4gVGhpcyBpcywgZm9yIGV4YW1wbGUsIHRoZSBjYXNlIHdpdGhcbiAgICAgICAgLy8gYEBuYXRpdmVzY3JpcHQvYW5ndWxhckA5LjAuMC1uZXh0LTIwMTktMTEtMTItMTU1NTAwLTAxYC5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBraW5kOiBEZWNsYXJhdGlvbktpbmQuSW5saW5lLFxuICAgICAgICAgIG5vZGU6IGlkLFxuICAgICAgICAgIGtub3duOiBub25FbWl0dGVkTm9ySW1wb3J0ZWRUc0hlbHBlckRlY2xhcmF0aW9uLFxuICAgICAgICAgIHZpYU1vZHVsZTogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZGVjbGFyYXRpb24gPT09IG51bGwgfHwgZGVjbGFyYXRpb24ubm9kZSA9PT0gbnVsbCB8fCBkZWNsYXJhdGlvbi5rbm93biAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGRlY2xhcmF0aW9uO1xuICAgIH1cblxuICAgIGlmICghdHMuaXNWYXJpYWJsZURlY2xhcmF0aW9uKGRlY2xhcmF0aW9uLm5vZGUpIHx8IGRlY2xhcmF0aW9uLm5vZGUuaW5pdGlhbGl6ZXIgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAvLyBWYXJpYWJsZURlY2xhcmF0aW9uID0+IFZhcmlhYmxlRGVjbGFyYXRpb25MaXN0ID0+IFZhcmlhYmxlU3RhdGVtZW50ID0+IElJRkUgQmxvY2tcbiAgICAgICAgIXRzLmlzQmxvY2soZGVjbGFyYXRpb24ubm9kZS5wYXJlbnQucGFyZW50LnBhcmVudCkpIHtcbiAgICAgIHJldHVybiBkZWNsYXJhdGlvbjtcbiAgICB9XG5cbiAgICAvLyBXZSBtaWdodCBoYXZlIGFuIGFsaWFzIHRvIGFub3RoZXIgdmFyaWFibGUgZGVjbGFyYXRpb24uXG4gICAgLy8gU2VhcmNoIHRoZSBjb250YWluaW5nIGlpZmUgYm9keSBmb3IgaXQuXG4gICAgY29uc3QgYmxvY2sgPSBkZWNsYXJhdGlvbi5ub2RlLnBhcmVudC5wYXJlbnQucGFyZW50O1xuICAgIGNvbnN0IGFsaWFzU3ltYm9sID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oZGVjbGFyYXRpb24ubm9kZS5uYW1lKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJsb2NrLnN0YXRlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHN0YXRlbWVudCA9IGJsb2NrLnN0YXRlbWVudHNbaV07XG4gICAgICAvLyBMb29raW5nIGZvciBzdGF0ZW1lbnQgdGhhdCBsb29rcyBsaWtlOiBgQWxpYXNlZFZhcmlhYmxlID0gT3JpZ2luYWxWYXJpYWJsZTtgXG4gICAgICBpZiAoaXNBc3NpZ25tZW50U3RhdGVtZW50KHN0YXRlbWVudCkgJiYgdHMuaXNJZGVudGlmaWVyKHN0YXRlbWVudC5leHByZXNzaW9uLmxlZnQpICYmXG4gICAgICAgICAgdHMuaXNJZGVudGlmaWVyKHN0YXRlbWVudC5leHByZXNzaW9uLnJpZ2h0KSAmJlxuICAgICAgICAgIHRoaXMuY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHN0YXRlbWVudC5leHByZXNzaW9uLmxlZnQpID09PSBhbGlhc1N5bWJvbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihzdGF0ZW1lbnQuZXhwcmVzc2lvbi5yaWdodCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGEgZnVuY3Rpb24gZGVjbGFyYXRpb24gdG8gZmluZCB0aGUgcmVsZXZhbnQgbWV0YWRhdGEgYWJvdXQgaXQuXG4gICAqXG4gICAqIEluIEVTTTUgd2UgbmVlZCB0byBkbyBzcGVjaWFsIHdvcmsgd2l0aCBvcHRpb25hbCBhcmd1bWVudHMgdG8gdGhlIGZ1bmN0aW9uLCBzaW5jZSB0aGV5IGdldFxuICAgKiB0aGVpciBvd24gaW5pdGlhbGl6ZXIgc3RhdGVtZW50IHRoYXQgbmVlZHMgdG8gYmUgcGFyc2VkIGFuZCB0aGVuIG5vdCBpbmNsdWRlZCBpbiB0aGUgXCJib2R5XCJcbiAgICogc3RhdGVtZW50cyBvZiB0aGUgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBub2RlIHRoZSBmdW5jdGlvbiBkZWNsYXJhdGlvbiB0byBwYXJzZS5cbiAgICogQHJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG5vZGUsIHN0YXRlbWVudHMgYW5kIHBhcmFtZXRlcnMgb2YgdGhlIGZ1bmN0aW9uLlxuICAgKi9cbiAgZ2V0RGVmaW5pdGlvbk9mRnVuY3Rpb24obm9kZTogdHMuTm9kZSk6IEZ1bmN0aW9uRGVmaW5pdGlvbnxudWxsIHtcbiAgICBjb25zdCBkZWZpbml0aW9uID0gc3VwZXIuZ2V0RGVmaW5pdGlvbk9mRnVuY3Rpb24obm9kZSk7XG4gICAgaWYgKGRlZmluaXRpb24gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEZpbHRlciBvdXQgYW5kIGNhcHR1cmUgcGFyYW1ldGVyIGluaXRpYWxpemVyc1xuICAgIGlmIChkZWZpbml0aW9uLmJvZHkgIT09IG51bGwpIHtcbiAgICAgIGxldCBsb29raW5nRm9ySW5pdGlhbGl6ZXJzID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHN0YXRlbWVudHMgPSBkZWZpbml0aW9uLmJvZHkuZmlsdGVyKHMgPT4ge1xuICAgICAgICBsb29raW5nRm9ySW5pdGlhbGl6ZXJzID1cbiAgICAgICAgICAgIGxvb2tpbmdGb3JJbml0aWFsaXplcnMgJiYgY2FwdHVyZVBhcmFtSW5pdGlhbGl6ZXIocywgZGVmaW5pdGlvbi5wYXJhbWV0ZXJzKTtcbiAgICAgICAgLy8gSWYgd2UgYXJlIG5vIGxvbmdlciBsb29raW5nIGZvciBwYXJhbWV0ZXIgaW5pdGlhbGl6ZXJzIHRoZW4gd2UgaW5jbHVkZSB0aGlzIHN0YXRlbWVudFxuICAgICAgICByZXR1cm4gIWxvb2tpbmdGb3JJbml0aWFsaXplcnM7XG4gICAgICB9KTtcbiAgICAgIGRlZmluaXRpb24uYm9keSA9IHN0YXRlbWVudHM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmluaXRpb247XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgd2hldGhlciBhIGBEZWNsYXJhdGlvbmAgY29ycmVzcG9uZHMgd2l0aCBhIGtub3duIGRlY2xhcmF0aW9uLCBzdWNoIGFzIGEgVHlwZVNjcmlwdCBoZWxwZXJcbiAgICogZnVuY3Rpb24sIGFuZCBzZXQgaXRzIGBrbm93bmAgcHJvcGVydHkgdG8gdGhlIGFwcHJvcHJpYXRlIGBLbm93bkRlY2xhcmF0aW9uYC5cbiAgICpcbiAgICogQHBhcmFtIGRlY2wgVGhlIGBEZWNsYXJhdGlvbmAgdG8gY2hlY2suXG4gICAqIEByZXR1cm4gVGhlIHBhc3NlZCBpbiBgRGVjbGFyYXRpb25gIChwb3RlbnRpYWxseSBlbmhhbmNlZCB3aXRoIGEgYEtub3duRGVjbGFyYXRpb25gKS5cbiAgICovXG4gIGRldGVjdEtub3duRGVjbGFyYXRpb248VCBleHRlbmRzIERlY2xhcmF0aW9uPihkZWNsOiBUKTogVCB7XG4gICAgZGVjbCA9IHN1cGVyLmRldGVjdEtub3duRGVjbGFyYXRpb24oZGVjbCk7XG5cbiAgICAvLyBBbHNvIGNoZWNrIGZvciBUUyBoZWxwZXJzXG4gICAgaWYgKGRlY2wua25vd24gPT09IG51bGwgJiYgZGVjbC5ub2RlICE9PSBudWxsKSB7XG4gICAgICBkZWNsLmtub3duID0gZ2V0VHNIZWxwZXJGbkZyb21EZWNsYXJhdGlvbihkZWNsLm5vZGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNsO1xuICB9XG5cblxuICAvLy8vLy8vLy8vLy8vIFByb3RlY3RlZCBIZWxwZXJzIC8vLy8vLy8vLy8vLy9cblxuICAvKipcbiAgICogSW4gRVM1LCB0aGUgaW1wbGVtZW50YXRpb24gb2YgYSBjbGFzcyBpcyBhIGZ1bmN0aW9uIGV4cHJlc3Npb24gdGhhdCBpcyBoaWRkZW4gaW5zaWRlIGFuIElJRkUsXG4gICAqIHdob3NlIHZhbHVlIGlzIGFzc2lnbmVkIHRvIGEgdmFyaWFibGUgKHdoaWNoIHJlcHJlc2VudHMgdGhlIGNsYXNzIHRvIHRoZSByZXN0IG9mIHRoZSBwcm9ncmFtKS5cbiAgICogU28gd2UgbWlnaHQgbmVlZCB0byBkaWcgYXJvdW5kIHRvIGdldCBob2xkIG9mIHRoZSBcImNsYXNzXCIgZGVjbGFyYXRpb24uXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGV4dHJhY3RzIGEgYE5nY2NDbGFzc1N5bWJvbGAgaWYgYGRlY2xhcmF0aW9uYCBpcyB0aGUgZnVuY3Rpb24gZGVjbGFyYXRpb24gaW5zaWRlXG4gICAqIHRoZSBJSUZFLiBPdGhlcndpc2UsIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAgICpcbiAgICogQHBhcmFtIGRlY2xhcmF0aW9uIHRoZSBkZWNsYXJhdGlvbiB3aG9zZSBzeW1ib2wgd2UgYXJlIGZpbmRpbmcuXG4gICAqIEByZXR1cm5zIHRoZSBzeW1ib2wgZm9yIHRoZSBub2RlIG9yIGB1bmRlZmluZWRgIGlmIGl0IGlzIG5vdCBhIFwiY2xhc3NcIiBvciBoYXMgbm8gc3ltYm9sLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldENsYXNzU3ltYm9sRnJvbUlubmVyRGVjbGFyYXRpb24oZGVjbGFyYXRpb246IHRzLk5vZGUpOiBOZ2NjQ2xhc3NTeW1ib2x8dW5kZWZpbmVkIHtcbiAgICBjb25zdCBjbGFzc1N5bWJvbCA9IHN1cGVyLmdldENsYXNzU3ltYm9sRnJvbUlubmVyRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pO1xuICAgIGlmIChjbGFzc1N5bWJvbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gY2xhc3NTeW1ib2w7XG4gICAgfVxuXG4gICAgaWYgKCFpc05hbWVkRnVuY3Rpb25EZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0ZXJOb2RlID0gZ2V0T3V0ZXJOb2RlRnJvbUlubmVyRGVjbGFyYXRpb24oZGVjbGFyYXRpb24pO1xuICAgIGlmIChvdXRlck5vZGUgPT09IG51bGwgfHwgIWhhc05hbWVJZGVudGlmaWVyKG91dGVyTm9kZSkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3NTeW1ib2wob3V0ZXJOb2RlLm5hbWUsIGRlY2xhcmF0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBkZWNsYXJhdGlvbnMgb2YgdGhlIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMgb2YgYSBjbGFzcyBpZGVudGlmaWVkIGJ5IGl0cyBzeW1ib2wuXG4gICAqXG4gICAqIEluIEVTTTUsIHRoZXJlIGlzIG5vIFwiY2xhc3NcIiBzbyB0aGUgY29uc3RydWN0b3IgdGhhdCB3ZSB3YW50IGlzIGFjdHVhbGx5IHRoZSBpbm5lciBmdW5jdGlvblxuICAgKiBkZWNsYXJhdGlvbiBpbnNpZGUgdGhlIElJRkUsIHdob3NlIHJldHVybiB2YWx1ZSBpcyBhc3NpZ25lZCB0byB0aGUgb3V0ZXIgdmFyaWFibGUgZGVjbGFyYXRpb25cbiAgICogKHRoYXQgcmVwcmVzZW50cyB0aGUgY2xhc3MgdG8gdGhlIHJlc3Qgb2YgdGhlIHByb2dyYW0pLlxuICAgKlxuICAgKiBAcGFyYW0gY2xhc3NTeW1ib2wgdGhlIHN5bWJvbCBvZiB0aGUgY2xhc3MgKGkuZS4gdGhlIG91dGVyIHZhcmlhYmxlIGRlY2xhcmF0aW9uKSB3aG9zZVxuICAgKiBwYXJhbWV0ZXJzIHdlIHdhbnQgdG8gZmluZC5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2YgYHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uYCBvYmplY3RzIHJlcHJlc2VudGluZyBlYWNoIG9mIHRoZSBwYXJhbWV0ZXJzIGluXG4gICAqIHRoZSBjbGFzcydzIGNvbnN0cnVjdG9yIG9yIGBudWxsYCBpZiB0aGVyZSBpcyBubyBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRDb25zdHJ1Y3RvclBhcmFtZXRlckRlY2xhcmF0aW9ucyhjbGFzc1N5bWJvbDogTmdjY0NsYXNzU3ltYm9sKTpcbiAgICAgIHRzLlBhcmFtZXRlckRlY2xhcmF0aW9uW118bnVsbCB7XG4gICAgY29uc3QgY29uc3RydWN0b3IgPSBjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICAgIGlmICghdHMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKGNvbnN0cnVjdG9yKSkgcmV0dXJuIG51bGw7XG5cbiAgICBpZiAoY29uc3RydWN0b3IucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gQXJyYXkuZnJvbShjb25zdHJ1Y3Rvci5wYXJhbWV0ZXJzKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1N5bnRoZXNpemVkQ29uc3RydWN0b3IoY29uc3RydWN0b3IpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBwYXJhbWV0ZXIgdHlwZSBhbmQgZGVjb3JhdG9ycyBmb3IgdGhlIGNvbnN0cnVjdG9yIG9mIGEgY2xhc3MsXG4gICAqIHdoZXJlIHRoZSBpbmZvcm1hdGlvbiBpcyBzdG9yZWQgb24gYSBzdGF0aWMgbWV0aG9kIG9mIHRoZSBjbGFzcy5cbiAgICpcbiAgICogSW4gdGhpcyBjYXNlIHRoZSBkZWNvcmF0b3JzIGFyZSBzdG9yZWQgaW4gdGhlIGJvZHkgb2YgYSBtZXRob2RcbiAgICogKGBjdG9yUGFyYXRlbWVyc2ApIGF0dGFjaGVkIHRvIHRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cbiAgICpcbiAgICogTm90ZSB0aGF0IHVubGlrZSBFU00yMDE1IHRoaXMgaXMgYSBmdW5jdGlvbiBleHByZXNzaW9uIHJhdGhlciB0aGFuIGFuIGFycm93XG4gICAqIGZ1bmN0aW9uOlxuICAgKlxuICAgKiBgYGBcbiAgICogU29tZURpcmVjdGl2ZS5jdG9yUGFyYW1ldGVycyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gW1xuICAgKiAgIHsgdHlwZTogVmlld0NvbnRhaW5lclJlZiwgfSxcbiAgICogICB7IHR5cGU6IFRlbXBsYXRlUmVmLCB9LFxuICAgKiAgIHsgdHlwZTogSXRlcmFibGVEaWZmZXJzLCB9LFxuICAgKiAgIHsgdHlwZTogdW5kZWZpbmVkLCBkZWNvcmF0b3JzOiBbeyB0eXBlOiBJbmplY3QsIGFyZ3M6IFtJTkpFQ1RFRF9UT0tFTixdIH0sXSB9LFxuICAgKiBdOyB9O1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHBhcmFtRGVjb3JhdG9yc1Byb3BlcnR5IHRoZSBwcm9wZXJ0eSB0aGF0IGhvbGRzIHRoZSBwYXJhbWV0ZXIgaW5mbyB3ZSB3YW50IHRvIGdldC5cbiAgICogQHJldHVybnMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBjb250YWluaW5nIHRoZSB0eXBlIGFuZCBkZWNvcmF0b3JzIGZvciBlYWNoIHBhcmFtZXRlci5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRQYXJhbUluZm9Gcm9tU3RhdGljUHJvcGVydHkocGFyYW1EZWNvcmF0b3JzUHJvcGVydHk6IHRzLlN5bWJvbCk6IFBhcmFtSW5mb1tdfG51bGwge1xuICAgIGNvbnN0IHBhcmFtRGVjb3JhdG9ycyA9IGdldFByb3BlcnR5VmFsdWVGcm9tU3ltYm9sKHBhcmFtRGVjb3JhdG9yc1Byb3BlcnR5KTtcbiAgICAvLyBUaGUgZGVjb3JhdG9ycyBhcnJheSBtYXkgYmUgd3JhcHBlZCBpbiBhIGZ1bmN0aW9uLiBJZiBzbyB1bndyYXAgaXQuXG4gICAgY29uc3QgcmV0dXJuU3RhdGVtZW50ID0gZ2V0UmV0dXJuU3RhdGVtZW50KHBhcmFtRGVjb3JhdG9ycyk7XG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IHJldHVyblN0YXRlbWVudCA/IHJldHVyblN0YXRlbWVudC5leHByZXNzaW9uIDogcGFyYW1EZWNvcmF0b3JzO1xuICAgIGlmIChleHByZXNzaW9uICYmIHRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbihleHByZXNzaW9uKSkge1xuICAgICAgY29uc3QgZWxlbWVudHMgPSBleHByZXNzaW9uLmVsZW1lbnRzO1xuICAgICAgcmV0dXJuIGVsZW1lbnRzLm1hcChyZWZsZWN0QXJyYXlFbGVtZW50KS5tYXAocGFyYW1JbmZvID0+IHtcbiAgICAgICAgY29uc3QgdHlwZUV4cHJlc3Npb24gPSBwYXJhbUluZm8gJiYgcGFyYW1JbmZvLmhhcygndHlwZScpID8gcGFyYW1JbmZvLmdldCgndHlwZScpISA6IG51bGw7XG4gICAgICAgIGNvbnN0IGRlY29yYXRvckluZm8gPVxuICAgICAgICAgICAgcGFyYW1JbmZvICYmIHBhcmFtSW5mby5oYXMoJ2RlY29yYXRvcnMnKSA/IHBhcmFtSW5mby5nZXQoJ2RlY29yYXRvcnMnKSEgOiBudWxsO1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JzID0gZGVjb3JhdG9ySW5mbyAmJiB0aGlzLnJlZmxlY3REZWNvcmF0b3JzKGRlY29yYXRvckluZm8pO1xuICAgICAgICByZXR1cm4ge3R5cGVFeHByZXNzaW9uLCBkZWNvcmF0b3JzfTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAocGFyYW1EZWNvcmF0b3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oXG4gICAgICAgICAgJ0ludmFsaWQgY29uc3RydWN0b3IgcGFyYW1ldGVyIGRlY29yYXRvciBpbiAnICsgcGFyYW1EZWNvcmF0b3JzLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZSArXG4gICAgICAgICAgICAgICc6XFxuJyxcbiAgICAgICAgICBwYXJhbURlY29yYXRvcnMuZ2V0VGV4dCgpKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmVmbGVjdCBvdmVyIGEgc3ltYm9sIGFuZCBleHRyYWN0IHRoZSBtZW1iZXIgaW5mb3JtYXRpb24sIGNvbWJpbmluZyBpdCB3aXRoIHRoZVxuICAgKiBwcm92aWRlZCBkZWNvcmF0b3IgaW5mb3JtYXRpb24sIGFuZCB3aGV0aGVyIGl0IGlzIGEgc3RhdGljIG1lbWJlci5cbiAgICpcbiAgICogSWYgYSBjbGFzcyBtZW1iZXIgdXNlcyBhY2Nlc3NvcnMgKGUuZyBnZXR0ZXJzIGFuZC9vciBzZXR0ZXJzKSB0aGVuIGl0IGdldHMgZG93bmxldmVsZWRcbiAgICogaW4gRVM1IHRvIGEgc2luZ2xlIGBPYmplY3QuZGVmaW5lUHJvcGVydHkoKWAgY2FsbC4gSW4gdGhhdCBjYXNlIHdlIG11c3QgcGFyc2UgdGhpc1xuICAgKiBjYWxsIHRvIGV4dHJhY3QgdGhlIG9uZSBvciB0d28gQ2xhc3NNZW1iZXIgb2JqZWN0cyB0aGF0IHJlcHJlc2VudCB0aGUgYWNjZXNzb3JzLlxuICAgKlxuICAgKiBAcGFyYW0gc3ltYm9sIHRoZSBzeW1ib2wgZm9yIHRoZSBtZW1iZXIgdG8gcmVmbGVjdCBvdmVyLlxuICAgKiBAcGFyYW0gZGVjb3JhdG9ycyBhbiBhcnJheSBvZiBkZWNvcmF0b3JzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVtYmVyLlxuICAgKiBAcGFyYW0gaXNTdGF0aWMgdHJ1ZSBpZiB0aGlzIG1lbWJlciBpcyBzdGF0aWMsIGZhbHNlIGlmIGl0IGlzIGFuIGluc3RhbmNlIHByb3BlcnR5LlxuICAgKiBAcmV0dXJucyB0aGUgcmVmbGVjdGVkIG1lbWJlciBpbmZvcm1hdGlvbiwgb3IgbnVsbCBpZiB0aGUgc3ltYm9sIGlzIG5vdCBhIG1lbWJlci5cbiAgICovXG4gIHByb3RlY3RlZCByZWZsZWN0TWVtYmVycyhzeW1ib2w6IHRzLlN5bWJvbCwgZGVjb3JhdG9ycz86IERlY29yYXRvcltdLCBpc1N0YXRpYz86IGJvb2xlYW4pOlxuICAgICAgQ2xhc3NNZW1iZXJbXXxudWxsIHtcbiAgICBjb25zdCBub2RlID0gc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24gfHwgc3ltYm9sLmRlY2xhcmF0aW9ucyAmJiBzeW1ib2wuZGVjbGFyYXRpb25zWzBdO1xuICAgIGNvbnN0IHByb3BlcnR5RGVmaW5pdGlvbiA9IG5vZGUgJiYgZ2V0UHJvcGVydHlEZWZpbml0aW9uKG5vZGUpO1xuICAgIGlmIChwcm9wZXJ0eURlZmluaXRpb24pIHtcbiAgICAgIGNvbnN0IG1lbWJlcnM6IENsYXNzTWVtYmVyW10gPSBbXTtcbiAgICAgIGlmIChwcm9wZXJ0eURlZmluaXRpb24uc2V0dGVyKSB7XG4gICAgICAgIG1lbWJlcnMucHVzaCh7XG4gICAgICAgICAgbm9kZTogbm9kZSEsXG4gICAgICAgICAgaW1wbGVtZW50YXRpb246IHByb3BlcnR5RGVmaW5pdGlvbi5zZXR0ZXIsXG4gICAgICAgICAga2luZDogQ2xhc3NNZW1iZXJLaW5kLlNldHRlcixcbiAgICAgICAgICB0eXBlOiBudWxsLFxuICAgICAgICAgIG5hbWU6IHN5bWJvbC5uYW1lLFxuICAgICAgICAgIG5hbWVOb2RlOiBudWxsLFxuICAgICAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgICAgIGlzU3RhdGljOiBpc1N0YXRpYyB8fCBmYWxzZSxcbiAgICAgICAgICBkZWNvcmF0b3JzOiBkZWNvcmF0b3JzIHx8IFtdLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQcmV2ZW50IGF0dGFjaGluZyB0aGUgZGVjb3JhdG9ycyB0byBhIHBvdGVudGlhbCBnZXR0ZXIuIEluIEVTNSwgd2UgY2FuJ3QgdGVsbCB3aGVyZSB0aGVcbiAgICAgICAgLy8gZGVjb3JhdG9ycyB3ZXJlIG9yaWdpbmFsbHkgYXR0YWNoZWQgdG8sIGhvd2V2ZXIgd2Ugb25seSB3YW50IHRvIGF0dGFjaCB0aGVtIHRvIGEgc2luZ2xlXG4gICAgICAgIC8vIGBDbGFzc01lbWJlcmAgYXMgb3RoZXJ3aXNlIG5ndHNjIHdvdWxkIGhhbmRsZSB0aGUgc2FtZSBkZWNvcmF0b3JzIHR3aWNlLlxuICAgICAgICBkZWNvcmF0b3JzID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgaWYgKHByb3BlcnR5RGVmaW5pdGlvbi5nZXR0ZXIpIHtcbiAgICAgICAgbWVtYmVycy5wdXNoKHtcbiAgICAgICAgICBub2RlOiBub2RlISxcbiAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcHJvcGVydHlEZWZpbml0aW9uLmdldHRlcixcbiAgICAgICAgICBraW5kOiBDbGFzc01lbWJlcktpbmQuR2V0dGVyLFxuICAgICAgICAgIHR5cGU6IG51bGwsXG4gICAgICAgICAgbmFtZTogc3ltYm9sLm5hbWUsXG4gICAgICAgICAgbmFtZU5vZGU6IG51bGwsXG4gICAgICAgICAgdmFsdWU6IG51bGwsXG4gICAgICAgICAgaXNTdGF0aWM6IGlzU3RhdGljIHx8IGZhbHNlLFxuICAgICAgICAgIGRlY29yYXRvcnM6IGRlY29yYXRvcnMgfHwgW10sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbWJlcnM7XG4gICAgfVxuXG4gICAgY29uc3QgbWVtYmVycyA9IHN1cGVyLnJlZmxlY3RNZW1iZXJzKHN5bWJvbCwgZGVjb3JhdG9ycywgaXNTdGF0aWMpO1xuICAgIG1lbWJlcnMgJiYgbWVtYmVycy5mb3JFYWNoKG1lbWJlciA9PiB7XG4gICAgICBpZiAobWVtYmVyICYmIG1lbWJlci5raW5kID09PSBDbGFzc01lbWJlcktpbmQuTWV0aG9kICYmIG1lbWJlci5pc1N0YXRpYyAmJiBtZW1iZXIubm9kZSAmJlxuICAgICAgICAgIHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG1lbWJlci5ub2RlKSAmJiBtZW1iZXIubm9kZS5wYXJlbnQgJiZcbiAgICAgICAgICB0cy5pc0JpbmFyeUV4cHJlc3Npb24obWVtYmVyLm5vZGUucGFyZW50KSAmJlxuICAgICAgICAgIHRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKG1lbWJlci5ub2RlLnBhcmVudC5yaWdodCkpIHtcbiAgICAgICAgLy8gUmVjb21wdXRlIHRoZSBpbXBsZW1lbnRhdGlvbiBmb3IgdGhpcyBtZW1iZXI6XG4gICAgICAgIC8vIEVTNSBzdGF0aWMgbWV0aG9kcyBhcmUgdmFyaWFibGUgZGVjbGFyYXRpb25zIHNvIHRoZSBkZWNsYXJhdGlvbiBpcyBhY3R1YWxseSB0aGVcbiAgICAgICAgLy8gaW5pdGlhbGl6ZXIgb2YgdGhlIHZhcmlhYmxlIGFzc2lnbm1lbnRcbiAgICAgICAgbWVtYmVyLmltcGxlbWVudGF0aW9uID0gbWVtYmVyLm5vZGUucGFyZW50LnJpZ2h0O1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBtZW1iZXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgc3RhdGVtZW50cyByZWxhdGVkIHRvIHRoZSBnaXZlbiBjbGFzcyB0aGF0IG1heSBjb250YWluIGNhbGxzIHRvIGEgaGVscGVyLlxuICAgKlxuICAgKiBJbiBFU001IGNvZGUgdGhlIGhlbHBlciBjYWxscyBhcmUgaGlkZGVuIGluc2lkZSB0aGUgY2xhc3MncyBJSUZFLlxuICAgKlxuICAgKiBAcGFyYW0gY2xhc3NTeW1ib2wgdGhlIGNsYXNzIHdob3NlIGhlbHBlciBjYWxscyB3ZSBhcmUgaW50ZXJlc3RlZCBpbi4gV2UgZXhwZWN0IHRoaXMgc3ltYm9sXG4gICAqIHRvIHJlZmVyZW5jZSB0aGUgaW5uZXIgaWRlbnRpZmllciBpbnNpZGUgdGhlIElJRkUuXG4gICAqIEByZXR1cm5zIGFuIGFycmF5IG9mIHN0YXRlbWVudHMgdGhhdCBtYXkgY29udGFpbiBoZWxwZXIgY2FsbHMuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0U3RhdGVtZW50c0ZvckNsYXNzKGNsYXNzU3ltYm9sOiBOZ2NjQ2xhc3NTeW1ib2wpOiB0cy5TdGF0ZW1lbnRbXSB7XG4gICAgY29uc3QgY2xhc3NEZWNsYXJhdGlvblBhcmVudCA9IGNsYXNzU3ltYm9sLmltcGxlbWVudGF0aW9uLnZhbHVlRGVjbGFyYXRpb24ucGFyZW50O1xuICAgIHJldHVybiB0cy5pc0Jsb2NrKGNsYXNzRGVjbGFyYXRpb25QYXJlbnQpID8gQXJyYXkuZnJvbShjbGFzc0RlY2xhcmF0aW9uUGFyZW50LnN0YXRlbWVudHMpIDogW107XG4gIH1cblxuICAvLy8vLy8vLy8vLy8vIEhvc3QgUHJpdmF0ZSBIZWxwZXJzIC8vLy8vLy8vLy8vLy9cblxuICAvKipcbiAgICogQSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBtYXkgaGF2ZSBiZWVuIFwic3ludGhlc2l6ZWRcIiBieSBUeXBlU2NyaXB0IGR1cmluZyBKYXZhU2NyaXB0IGVtaXQsXG4gICAqIGluIHRoZSBjYXNlIG5vIHVzZXItZGVmaW5lZCBjb25zdHJ1Y3RvciBleGlzdHMgYW5kIGUuZy4gcHJvcGVydHkgaW5pdGlhbGl6ZXJzIGFyZSB1c2VkLlxuICAgKiBUaG9zZSBpbml0aWFsaXplcnMgbmVlZCB0byBiZSBlbWl0dGVkIGludG8gYSBjb25zdHJ1Y3RvciBpbiBKYXZhU2NyaXB0LCBzbyB0aGUgVHlwZVNjcmlwdFxuICAgKiBjb21waWxlciBnZW5lcmF0ZXMgYSBzeW50aGV0aWMgY29uc3RydWN0b3IuXG4gICAqXG4gICAqIFdlIG5lZWQgdG8gaWRlbnRpZnkgc3VjaCBjb25zdHJ1Y3RvcnMgYXMgbmdjYyBuZWVkcyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgYSBjbGFzcyBkaWRcbiAgICogb3JpZ2luYWxseSBoYXZlIGEgY29uc3RydWN0b3IgaW4gdGhlIFR5cGVTY3JpcHQgc291cmNlLiBGb3IgRVM1LCB3ZSBjYW4gbm90IHRlbGwgYW5cbiAgICogZW1wdHkgY29uc3RydWN0b3IgYXBhcnQgZnJvbSBhIHN5bnRoZXNpemVkIGNvbnN0cnVjdG9yLCBidXQgZm9ydHVuYXRlbHkgdGhhdCBkb2VzIG5vdFxuICAgKiBtYXR0ZXIgZm9yIHRoZSBjb2RlIGdlbmVyYXRlZCBieSBuZ3RzYy5cbiAgICpcbiAgICogV2hlbiBhIGNsYXNzIGhhcyBhIHN1cGVyY2xhc3MgaG93ZXZlciwgYSBzeW50aGVzaXplZCBjb25zdHJ1Y3RvciBtdXN0IG5vdCBiZSBjb25zaWRlcmVkXG4gICAqIGFzIGEgdXNlci1kZWZpbmVkIGNvbnN0cnVjdG9yIGFzIHRoYXQgcHJldmVudHMgYSBiYXNlIGZhY3RvcnkgY2FsbCBmcm9tIGJlaW5nIGNyZWF0ZWQgYnlcbiAgICogbmd0c2MsIHJlc3VsdGluZyBpbiBhIGZhY3RvcnkgZnVuY3Rpb24gdGhhdCBkb2VzIG5vdCBpbmplY3QgdGhlIGRlcGVuZGVuY2llcyBvZiB0aGVcbiAgICogc3VwZXJjbGFzcy4gSGVuY2UsIHdlIGlkZW50aWZ5IGEgZGVmYXVsdCBzeW50aGVzaXplZCBzdXBlciBjYWxsIGluIHRoZSBjb25zdHJ1Y3RvciBib2R5LFxuICAgKiBhY2NvcmRpbmcgdG8gdGhlIHN0cnVjdHVyZSB0aGF0IFR5cGVTY3JpcHQncyBFUzIwMTUgdG8gRVM1IHRyYW5zZm9ybWVyIGdlbmVyYXRlcyBpblxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L1R5cGVTY3JpcHQvYmxvYi92My4yLjIvc3JjL2NvbXBpbGVyL3RyYW5zZm9ybWVycy9lczIwMTUudHMjTDEwODItTDEwOThcbiAgICpcbiAgICogQWRkaXRpb25hbGx5LCB3ZSBoYW5kbGUgc3ludGhldGljIGRlbGVnYXRlIGNvbnN0cnVjdG9ycyB0aGF0IGFyZSBlbWl0dGVkIHdoZW4gVHlwZVNjcmlwdFxuICAgKiBkb3dubGV2ZWwncyBFUzIwMTUgc3ludGhldGljYWxseSBnZW5lcmF0ZWQgdG8gRVM1LiBUaGVzZSB2YXJ5IHNsaWdodGx5IGZyb20gdGhlIGRlZmF1bHRcbiAgICogc3RydWN0dXJlIG1lbnRpb25lZCBhYm92ZSBiZWNhdXNlIHRoZSBFUzIwMTUgb3V0cHV0IHVzZXMgYSBzcHJlYWQgb3BlcmF0b3IsIGZvciBkZWxlZ2F0aW5nXG4gICAqIHRvIHRoZSBwYXJlbnQgY29uc3RydWN0b3IsIHRoYXQgaXMgcHJlc2VydmVkIHRocm91Z2ggYSBUeXBlU2NyaXB0IGhlbHBlciBpbiBFUzUuIGUuZy5cbiAgICpcbiAgICogYGBgXG4gICAqIHJldHVybiBfc3VwZXIuYXBwbHkodGhpcywgdHNsaWIuX19zcHJlYWQoYXJndW1lbnRzKSkgfHwgdGhpcztcbiAgICogYGBgXG4gICAqXG4gICAqIG9yLCBzaW5jZSBUeXBlU2NyaXB0IDQuMiBpdCB3b3VsZCBiZVxuICAgKlxuICAgKiBgYGBcbiAgICogcmV0dXJuIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZEFycmF5KFtdLCB0c2xpYi5fX3JlYWQoYXJndW1lbnRzKSkpIHx8IHRoaXM7XG4gICAqIGBgYFxuICAgKlxuICAgKiBTdWNoIGNvbnN0cnVjdHMgY2FuIGJlIHN0aWxsIGNvbnNpZGVyZWQgYXMgc3ludGhldGljIGRlbGVnYXRlIGNvbnN0cnVjdG9ycyBhcyB0aGV5IGFyZVxuICAgKiB0aGUgcHJvZHVjdCBvZiBhIGNvbW1vbiBUeXBlU2NyaXB0IHRvIEVTNSBzeW50aGV0aWMgY29uc3RydWN0b3IsIGp1c3QgYmVpbmcgZG93bmxldmVsZWRcbiAgICogdG8gRVM1IHVzaW5nIGB0c2NgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzM4NDUzLlxuICAgKlxuICAgKlxuICAgKiBAcGFyYW0gY29uc3RydWN0b3IgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbiB0byB0ZXN0XG4gICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIGNvbnN0cnVjdG9yIGFwcGVhcnMgdG8gaGF2ZSBiZWVuIHN5bnRoZXNpemVkXG4gICAqL1xuICBwcml2YXRlIGlzU3ludGhlc2l6ZWRDb25zdHJ1Y3Rvcihjb25zdHJ1Y3RvcjogdHMuRnVuY3Rpb25EZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIGlmICghY29uc3RydWN0b3IuYm9keSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgZmlyc3RTdGF0ZW1lbnQgPSBjb25zdHJ1Y3Rvci5ib2R5LnN0YXRlbWVudHNbMF07XG4gICAgaWYgKCFmaXJzdFN0YXRlbWVudCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXMuaXNTeW50aGVzaXplZFN1cGVyVGhpc0Fzc2lnbm1lbnQoZmlyc3RTdGF0ZW1lbnQpIHx8XG4gICAgICAgIHRoaXMuaXNTeW50aGVzaXplZFN1cGVyUmV0dXJuU3RhdGVtZW50KGZpcnN0U3RhdGVtZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHN5bnRoZXNpemVkIHN1cGVyIGNhbGxzIHdoaWNoIHBhc3MtdGhyb3VnaCBmdW5jdGlvbiBhcmd1bWVudHMgZGlyZWN0bHkgYW5kIGFyZVxuICAgKiBiZWluZyBhc3NpZ25lZCB0byBhIGNvbW1vbiBgX3RoaXNgIHZhcmlhYmxlLiBUaGUgZm9sbG93aW5nIHBhdHRlcm5zIHdlIGludGVuZCB0byBtYXRjaDpcbiAgICpcbiAgICogMS4gRGVsZWdhdGUgY2FsbCBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQgd2hlbiBpdCBlbWl0cyBFUzUgZGlyZWN0bHkuXG4gICAqICAgYGBgXG4gICAqICAgdmFyIF90aGlzID0gX3N1cGVyICE9PSBudWxsICYmIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqXG4gICAqIDIuIERlbGVnYXRlIGNhbGwgZW1pdHRlZCBieSBUeXBlU2NyaXB0IHdoZW4gaXQgZG93bmxldmVsJ3MgRVMyMDE1IHRvIEVTNS5cbiAgICogICBgYGBcbiAgICogICB2YXIgX3RoaXMgPSBfc3VwZXIuYXBwbHkodGhpcywgdHNsaWIuX19zcHJlYWQoYXJndW1lbnRzKSkgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICogICBvciB1c2luZyB0aGUgc3ludGF4IGVtaXR0ZWQgc2luY2UgVHlwZVNjcmlwdCA0LjI6XG4gICAqICAgYGBgXG4gICAqICAgcmV0dXJuIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZEFycmF5KFtdLCB0c2xpYi5fX3JlYWQoYXJndW1lbnRzKSkpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqXG4gICAqIEBwYXJhbSBzdGF0ZW1lbnQgYSBzdGF0ZW1lbnQgdGhhdCBtYXkgYmUgYSBzeW50aGVzaXplZCBzdXBlciBjYWxsXG4gICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHN0YXRlbWVudCBsb29rcyBsaWtlIGEgc3ludGhlc2l6ZWQgc3VwZXIgY2FsbFxuICAgKi9cbiAgcHJpdmF0ZSBpc1N5bnRoZXNpemVkU3VwZXJUaGlzQXNzaWdubWVudChzdGF0ZW1lbnQ6IHRzLlN0YXRlbWVudCk6IGJvb2xlYW4ge1xuICAgIGlmICghdHMuaXNWYXJpYWJsZVN0YXRlbWVudChzdGF0ZW1lbnQpKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9ucyA9IHN0YXRlbWVudC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zO1xuICAgIGlmICh2YXJpYWJsZURlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHZhcmlhYmxlRGVjbGFyYXRpb24gPSB2YXJpYWJsZURlY2xhcmF0aW9uc1swXTtcbiAgICBpZiAoIXRzLmlzSWRlbnRpZmllcih2YXJpYWJsZURlY2xhcmF0aW9uLm5hbWUpIHx8XG4gICAgICAgICF2YXJpYWJsZURlY2xhcmF0aW9uLm5hbWUudGV4dC5zdGFydHNXaXRoKCdfdGhpcycpKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5pdGlhbGl6ZXIgPSB2YXJpYWJsZURlY2xhcmF0aW9uLmluaXRpYWxpemVyO1xuICAgIGlmICghaW5pdGlhbGl6ZXIpIHJldHVybiBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzLmlzU3ludGhlc2l6ZWREZWZhdWx0U3VwZXJDYWxsKGluaXRpYWxpemVyKTtcbiAgfVxuICAvKipcbiAgICogSWRlbnRpZmllcyBzeW50aGVzaXplZCBzdXBlciBjYWxscyB3aGljaCBwYXNzLXRocm91Z2ggZnVuY3Rpb24gYXJndW1lbnRzIGRpcmVjdGx5IGFuZFxuICAgKiBhcmUgYmVpbmcgcmV0dXJuZWQuIFRoZSBmb2xsb3dpbmcgcGF0dGVybnMgY29ycmVzcG9uZCB0byBzeW50aGV0aWMgc3VwZXIgcmV0dXJuIGNhbGxzOlxuICAgKlxuICAgKiAxLiBEZWxlZ2F0ZSBjYWxsIGVtaXR0ZWQgYnkgVHlwZVNjcmlwdCB3aGVuIGl0IGVtaXRzIEVTNSBkaXJlY3RseS5cbiAgICogICBgYGBcbiAgICogICByZXR1cm4gX3N1cGVyICE9PSBudWxsICYmIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqXG4gICAqIDIuIERlbGVnYXRlIGNhbGwgZW1pdHRlZCBieSBUeXBlU2NyaXB0IHdoZW4gaXQgZG93bmxldmVsJ3MgRVMyMDE1IHRvIEVTNS5cbiAgICogICBgYGBcbiAgICogICByZXR1cm4gX3N1cGVyLmFwcGx5KHRoaXMsIHRzbGliLl9fc3ByZWFkKGFyZ3VtZW50cykpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqICAgb3IgdXNpbmcgdGhlIHN5bnRheCBlbWl0dGVkIHNpbmNlIFR5cGVTY3JpcHQgNC4yOlxuICAgKiAgIGBgYFxuICAgKiAgIHJldHVybiBfc3VwZXIuYXBwbHkodGhpcywgdHNsaWIuX19zcHJlYWRBcnJheShbXSwgdHNsaWIuX19yZWFkKGFyZ3VtZW50cykpKSB8fCB0aGlzO1xuICAgKiAgIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gc3RhdGVtZW50IGEgc3RhdGVtZW50IHRoYXQgbWF5IGJlIGEgc3ludGhlc2l6ZWQgc3VwZXIgY2FsbFxuICAgKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBzdGF0ZW1lbnQgbG9va3MgbGlrZSBhIHN5bnRoZXNpemVkIHN1cGVyIGNhbGxcbiAgICovXG4gIHByaXZhdGUgaXNTeW50aGVzaXplZFN1cGVyUmV0dXJuU3RhdGVtZW50KHN0YXRlbWVudDogdHMuU3RhdGVtZW50KTogYm9vbGVhbiB7XG4gICAgaWYgKCF0cy5pc1JldHVyblN0YXRlbWVudChzdGF0ZW1lbnQpKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBleHByZXNzaW9uID0gc3RhdGVtZW50LmV4cHJlc3Npb247XG4gICAgaWYgKCFleHByZXNzaW9uKSByZXR1cm4gZmFsc2U7XG5cbiAgICByZXR1cm4gdGhpcy5pc1N5bnRoZXNpemVkRGVmYXVsdFN1cGVyQ2FsbChleHByZXNzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHN5bnRoZXNpemVkIHN1cGVyIGNhbGxzIHdoaWNoIHBhc3MtdGhyb3VnaCBmdW5jdGlvbiBhcmd1bWVudHMgZGlyZWN0bHkuIFRoZVxuICAgKiBzeW50aGV0aWMgZGVsZWdhdGUgc3VwZXIgY2FsbCBtYXRjaCB0aGUgZm9sbG93aW5nIHBhdHRlcm5zIHdlIGludGVuZCB0byBtYXRjaDpcbiAgICpcbiAgICogMS4gRGVsZWdhdGUgY2FsbCBlbWl0dGVkIGJ5IFR5cGVTY3JpcHQgd2hlbiBpdCBlbWl0cyBFUzUgZGlyZWN0bHkuXG4gICAqICAgYGBgXG4gICAqICAgX3N1cGVyICE9PSBudWxsICYmIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqXG4gICAqIDIuIERlbGVnYXRlIGNhbGwgZW1pdHRlZCBieSBUeXBlU2NyaXB0IHdoZW4gaXQgZG93bmxldmVsJ3MgRVMyMDE1IHRvIEVTNS5cbiAgICogICBgYGBcbiAgICogICBfc3VwZXIuYXBwbHkodGhpcywgdHNsaWIuX19zcHJlYWQoYXJndW1lbnRzKSkgfHwgdGhpcztcbiAgICogICBgYGBcbiAgICogICBvciB1c2luZyB0aGUgc3ludGF4IGVtaXR0ZWQgc2luY2UgVHlwZVNjcmlwdCA0LjI6XG4gICAqICAgYGBgXG4gICAqICAgcmV0dXJuIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZEFycmF5KFtdLCB0c2xpYi5fX3JlYWQoYXJndW1lbnRzKSkpIHx8IHRoaXM7XG4gICAqICAgYGBgXG4gICAqXG4gICAqIEBwYXJhbSBleHByZXNzaW9uIGFuIGV4cHJlc3Npb24gdGhhdCBtYXkgcmVwcmVzZW50IGEgZGVmYXVsdCBzdXBlciBjYWxsXG4gICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIGV4cHJlc3Npb24gY29ycmVzcG9uZHMgd2l0aCB0aGUgYWJvdmUgZm9ybVxuICAgKi9cbiAgcHJpdmF0ZSBpc1N5bnRoZXNpemVkRGVmYXVsdFN1cGVyQ2FsbChleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCFpc0JpbmFyeUV4cHIoZXhwcmVzc2lvbiwgdHMuU3ludGF4S2luZC5CYXJCYXJUb2tlbikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoZXhwcmVzc2lvbi5yaWdodC5raW5kICE9PSB0cy5TeW50YXhLaW5kLlRoaXNLZXl3b3JkKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBsZWZ0ID0gZXhwcmVzc2lvbi5sZWZ0O1xuICAgIGlmIChpc0JpbmFyeUV4cHIobGVmdCwgdHMuU3ludGF4S2luZC5BbXBlcnNhbmRBbXBlcnNhbmRUb2tlbikpIHtcbiAgICAgIHJldHVybiBpc1N1cGVyTm90TnVsbChsZWZ0LmxlZnQpICYmIHRoaXMuaXNTdXBlckFwcGx5Q2FsbChsZWZ0LnJpZ2h0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuaXNTdXBlckFwcGx5Q2FsbChsZWZ0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdHMgd2hldGhlciB0aGUgZXhwcmVzc2lvbiBjb3JyZXNwb25kcyB0byBhIGBzdXBlcmAgY2FsbCBwYXNzaW5nIHRocm91Z2hcbiAgICogZnVuY3Rpb24gYXJndW1lbnRzIHdpdGhvdXQgYW55IG1vZGlmaWNhdGlvbi4gZS5nLlxuICAgKlxuICAgKiBgYGBcbiAgICogX3N1cGVyICE9PSBudWxsICYmIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIHx8IHRoaXM7XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGlzIHN0cnVjdHVyZSBpcyBnZW5lcmF0ZWQgYnkgVHlwZVNjcmlwdCB3aGVuIHRyYW5zZm9ybWluZyBFUzIwMTUgdG8gRVM1LCBzZWVcbiAgICogaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2Jsb2IvdjMuMi4yL3NyYy9jb21waWxlci90cmFuc2Zvcm1lcnMvZXMyMDE1LnRzI0wxMTQ4LUwxMTYzXG4gICAqXG4gICAqIEFkZGl0aW9uYWxseSwgd2UgYWxzbyBoYW5kbGUgY2FzZXMgd2hlcmUgYGFyZ3VtZW50c2AgYXJlIHdyYXBwZWQgYnkgYSBUeXBlU2NyaXB0IHNwcmVhZFxuICAgKiBoZWxwZXIuXG4gICAqIFRoaXMgY2FuIGhhcHBlbiBpZiBFUzIwMTUgY2xhc3Mgb3V0cHV0IGNvbnRhaW4gYXV0by1nZW5lcmF0ZWQgY29uc3RydWN0b3JzIGR1ZSB0byBjbGFzc1xuICAgKiBtZW1iZXJzLiBUaGUgRVMyMDE1IG91dHB1dCB3aWxsIGJlIHVzaW5nIGBzdXBlciguLi5hcmd1bWVudHMpYCB0byBkZWxlZ2F0ZSB0byB0aGUgc3VwZXJjbGFzcyxcbiAgICogYnV0IG9uY2UgZG93bmxldmVsZWQgdG8gRVM1LCB0aGUgc3ByZWFkIG9wZXJhdG9yIHdpbGwgYmUgcGVyc2lzdGVkIHRocm91Z2ggYSBUeXBlU2NyaXB0IHNwcmVhZFxuICAgKiBoZWxwZXIuIEZvciBleGFtcGxlOlxuICAgKlxuICAgKiBgYGBcbiAgICogX3N1cGVyLmFwcGx5KHRoaXMsIF9fc3ByZWFkKGFyZ3VtZW50cykpIHx8IHRoaXM7XG4gICAqIGBgYFxuICAgKlxuICAgKiBvciwgc2luY2UgVHlwZVNjcmlwdCA0LjIgaXQgd291bGQgYmVcbiAgICpcbiAgICogYGBgXG4gICAqIF9zdXBlci5hcHBseSh0aGlzLCB0c2xpYi5fX3NwcmVhZEFycmF5KFtdLCB0c2xpYi5fX3JlYWQoYXJndW1lbnRzKSkpIHx8IHRoaXM7XG4gICAqIGBgYFxuICAgKlxuICAgKiBNb3JlIGRldGFpbHMgY2FuIGJlIGZvdW5kIGluOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy8zODQ1My5cbiAgICpcbiAgICogQHBhcmFtIGV4cHJlc3Npb24gYW4gZXhwcmVzc2lvbiB0aGF0IG1heSByZXByZXNlbnQgYSBkZWZhdWx0IHN1cGVyIGNhbGxcbiAgICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgZXhwcmVzc2lvbiBjb3JyZXNwb25kcyB3aXRoIHRoZSBhYm92ZSBmb3JtXG4gICAqL1xuICBwcml2YXRlIGlzU3VwZXJBcHBseUNhbGwoZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghdHMuaXNDYWxsRXhwcmVzc2lvbihleHByZXNzaW9uKSB8fCBleHByZXNzaW9uLmFyZ3VtZW50cy5sZW5ndGggIT09IDIpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHRhcmdldEZuID0gZXhwcmVzc2lvbi5leHByZXNzaW9uO1xuICAgIGlmICghdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24odGFyZ2V0Rm4pKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFpc1N1cGVySWRlbnRpZmllcih0YXJnZXRGbi5leHByZXNzaW9uKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0YXJnZXRGbi5uYW1lLnRleHQgIT09ICdhcHBseScpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHRoaXNBcmd1bWVudCA9IGV4cHJlc3Npb24uYXJndW1lbnRzWzBdO1xuICAgIGlmICh0aGlzQXJndW1lbnQua2luZCAhPT0gdHMuU3ludGF4S2luZC5UaGlzS2V5d29yZCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgYXJndW1lbnRzRXhwciA9IGV4cHJlc3Npb24uYXJndW1lbnRzWzFdO1xuXG4gICAgLy8gSWYgdGhlIHN1cGVyIGlzIGRpcmVjdGx5IGludm9rZWQgd2l0aCBgYXJndW1lbnRzYCwgcmV0dXJuIGB0cnVlYC4gVGhpcyByZXByZXNlbnRzIHRoZVxuICAgIC8vIGNvbW1vbiBUeXBlU2NyaXB0IG91dHB1dCB3aGVyZSB0aGUgZGVsZWdhdGUgY29uc3RydWN0b3Igc3VwZXIgY2FsbCBtYXRjaGVzIHRoZSBmb2xsb3dpbmdcbiAgICAvLyBwYXR0ZXJuOiBgc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKWAuXG4gICAgaWYgKGlzQXJndW1lbnRzSWRlbnRpZmllcihhcmd1bWVudHNFeHByKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gVGhlIG90aGVyIHNjZW5hcmlvIHdlIGludGVuZCB0byBkZXRlY3Q6IFRoZSBgYXJndW1lbnRzYCB2YXJpYWJsZSBtaWdodCBiZSB3cmFwcGVkIHdpdGggdGhlXG4gICAgLy8gVHlwZVNjcmlwdCBzcHJlYWQgaGVscGVyIChlaXRoZXIgdGhyb3VnaCB0c2xpYiBvciBpbmxpbmVkKS4gVGhpcyBjYW4gaGFwcGVuIGlmIGFuIGV4cGxpY2l0XG4gICAgLy8gZGVsZWdhdGUgY29uc3RydWN0b3IgdXNlcyBgc3VwZXIoLi4uYXJndW1lbnRzKWAgaW4gRVMyMDE1IGFuZCBpcyBkb3dubGV2ZWxlZCB0byBFUzUgdXNpbmdcbiAgICAvLyBgLS1kb3dubGV2ZWxJdGVyYXRpb25gLlxuICAgIHJldHVybiB0aGlzLmlzU3ByZWFkQXJndW1lbnRzRXhwcmVzc2lvbihhcmd1bWVudHNFeHByKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIGlmIHRoZSBwcm92aWRlZCBleHByZXNzaW9uIGlzIG9uZSBvZiB0aGUgZm9sbG93aW5nIGNhbGwgZXhwcmVzc2lvbnM6XG4gICAqXG4gICAqIDEuIGBfX3NwcmVhZChhcmd1bWVudHMpYFxuICAgKiAyLiBgX19zcHJlYWRBcnJheShbXSwgX19yZWFkKGFyZ3VtZW50cykpYFxuICAgKlxuICAgKiBUaGUgdHNsaWIgaGVscGVycyBtYXkgaGF2ZSBiZWVuIGVtaXR0ZWQgaW5saW5lIGFzIGluIHRoZSBhYm92ZSBleGFtcGxlLCBvciB0aGV5IG1heSBiZSByZWFkXG4gICAqIGZyb20gYSBuYW1lc3BhY2UgaW1wb3J0LlxuICAgKi9cbiAgcHJpdmF0ZSBpc1NwcmVhZEFyZ3VtZW50c0V4cHJlc3Npb24oZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGNhbGwgPSB0aGlzLmV4dHJhY3RLbm93bkhlbHBlckNhbGwoZXhwcmVzc2lvbik7XG4gICAgaWYgKGNhbGwgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoY2FsbC5oZWxwZXIgPT09IEtub3duRGVjbGFyYXRpb24uVHNIZWxwZXJTcHJlYWQpIHtcbiAgICAgIC8vIGBfX3NwcmVhZChhcmd1bWVudHMpYFxuICAgICAgcmV0dXJuIGNhbGwuYXJncy5sZW5ndGggPT09IDEgJiYgaXNBcmd1bWVudHNJZGVudGlmaWVyKGNhbGwuYXJnc1swXSk7XG4gICAgfSBlbHNlIGlmIChjYWxsLmhlbHBlciA9PT0gS25vd25EZWNsYXJhdGlvbi5Uc0hlbHBlclNwcmVhZEFycmF5KSB7XG4gICAgICAvLyBgX19zcHJlYWRBcnJheShbXSwgX19yZWFkKGFyZ3VtZW50cykpYFxuICAgICAgaWYgKGNhbGwuYXJncy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmaXJzdEFyZyA9IGNhbGwuYXJnc1swXTtcbiAgICAgIGlmICghdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKGZpcnN0QXJnKSB8fCBmaXJzdEFyZy5lbGVtZW50cy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzZWNvbmRBcmcgPSB0aGlzLmV4dHJhY3RLbm93bkhlbHBlckNhbGwoY2FsbC5hcmdzWzFdKTtcbiAgICAgIGlmIChzZWNvbmRBcmcgPT09IG51bGwgfHwgc2Vjb25kQXJnLmhlbHBlciAhPT0gS25vd25EZWNsYXJhdGlvbi5Uc0hlbHBlclJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2Vjb25kQXJnLmFyZ3MubGVuZ3RoID09PSAxICYmIGlzQXJndW1lbnRzSWRlbnRpZmllcihzZWNvbmRBcmcuYXJnc1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5zcGVjdHMgdGhlIHByb3ZpZGVkIGV4cHJlc3Npb24gYW5kIGRldGVybWluZXMgaWYgaXQgY29ycmVzcG9uZHMgd2l0aCBhIGtub3duIGhlbHBlciBmdW5jdGlvblxuICAgKiBhcyByZWNlaXZlciBleHByZXNzaW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0S25vd25IZWxwZXJDYWxsKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOlxuICAgICAge2hlbHBlcjogS25vd25EZWNsYXJhdGlvbiwgYXJnczogdHMuTm9kZUFycmF5PHRzLkV4cHJlc3Npb24+fXxudWxsIHtcbiAgICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24oZXhwcmVzc2lvbikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHJlY2VpdmVyRXhwciA9IGV4cHJlc3Npb24uZXhwcmVzc2lvbjtcblxuICAgIC8vIFRoZSBoZWxwZXIgY291bGQgYmUgZ2xvYmFsbHkgYXZhaWxhYmxlLCBvciBhY2Nlc3NlZCB0aHJvdWdoIGEgbmFtZXNwYWNlZCBpbXBvcnQuIEhlbmNlIHdlXG4gICAgLy8gc3VwcG9ydCBhIHByb3BlcnR5IGFjY2VzcyBoZXJlIGFzIGxvbmcgYXMgaXQgcmVzb2x2ZXMgdG8gdGhlIGFjdHVhbCBrbm93biBUeXBlU2NyaXB0IGhlbHBlci5cbiAgICBsZXQgcmVjZWl2ZXI6IERlY2xhcmF0aW9ufG51bGwgPSBudWxsO1xuICAgIGlmICh0cy5pc0lkZW50aWZpZXIocmVjZWl2ZXJFeHByKSkge1xuICAgICAgcmVjZWl2ZXIgPSB0aGlzLmdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKHJlY2VpdmVyRXhwcik7XG4gICAgfSBlbHNlIGlmICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihyZWNlaXZlckV4cHIpICYmIHRzLmlzSWRlbnRpZmllcihyZWNlaXZlckV4cHIubmFtZSkpIHtcbiAgICAgIHJlY2VpdmVyID0gdGhpcy5nZXREZWNsYXJhdGlvbk9mSWRlbnRpZmllcihyZWNlaXZlckV4cHIubmFtZSk7XG4gICAgfVxuXG4gICAgaWYgKHJlY2VpdmVyID09PSBudWxsIHx8IHJlY2VpdmVyLmtub3duID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaGVscGVyOiByZWNlaXZlci5rbm93bixcbiAgICAgIGFyZ3M6IGV4cHJlc3Npb24uYXJndW1lbnRzLFxuICAgIH07XG4gIH1cbn1cblxuLy8vLy8vLy8vLy8vLyBJbnRlcm5hbCBIZWxwZXJzIC8vLy8vLy8vLy8vLy9cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBkZXRhaWxzIGFib3V0IHByb3BlcnR5IGRlZmluaXRpb25zIHRoYXQgd2VyZSBzZXQgdXNpbmcgYE9iamVjdC5kZWZpbmVQcm9wZXJ0eWAuXG4gKi9cbmludGVyZmFjZSBQcm9wZXJ0eURlZmluaXRpb24ge1xuICBzZXR0ZXI6IHRzLkZ1bmN0aW9uRXhwcmVzc2lvbnxudWxsO1xuICBnZXR0ZXI6IHRzLkZ1bmN0aW9uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIEluIEVTNSwgZ2V0dGVycyBhbmQgc2V0dGVycyBoYXZlIGJlZW4gZG93bmxldmVsZWQgaW50byBjYWxsIGV4cHJlc3Npb25zIG9mXG4gKiBgT2JqZWN0LmRlZmluZVByb3BlcnR5YCwgc3VjaCBhc1xuICpcbiAqIGBgYFxuICogT2JqZWN0LmRlZmluZVByb3BlcnR5KENsYXp6LnByb3RvdHlwZSwgXCJwcm9wZXJ0eVwiLCB7XG4gKiAgIGdldDogZnVuY3Rpb24gKCkge1xuICogICAgICAgcmV0dXJuICd2YWx1ZSc7XG4gKiAgIH0sXG4gKiAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gKiAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gKiAgIH0sXG4gKiAgIGVudW1lcmFibGU6IHRydWUsXG4gKiAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGluc3BlY3RzIHRoZSBnaXZlbiBub2RlIHRvIGRldGVybWluZSBpZiBpdCBjb3JyZXNwb25kcyB3aXRoIHN1Y2ggYSBjYWxsLCBhbmQgaWYgc29cbiAqIGV4dHJhY3RzIHRoZSBgc2V0YCBhbmQgYGdldGAgZnVuY3Rpb24gZXhwcmVzc2lvbnMgZnJvbSB0aGUgZGVzY3JpcHRvciBvYmplY3QsIGlmIHRoZXkgZXhpc3QuXG4gKlxuICogQHBhcmFtIG5vZGUgVGhlIG5vZGUgdG8gb2J0YWluIHRoZSBwcm9wZXJ0eSBkZWZpbml0aW9uIGZyb20uXG4gKiBAcmV0dXJucyBUaGUgcHJvcGVydHkgZGVmaW5pdGlvbiBpZiB0aGUgbm9kZSBjb3JyZXNwb25kcyB3aXRoIGFjY2Vzc29yLCBudWxsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlEZWZpbml0aW9uKG5vZGU6IHRzLk5vZGUpOiBQcm9wZXJ0eURlZmluaXRpb258bnVsbCB7XG4gIGlmICghdHMuaXNDYWxsRXhwcmVzc2lvbihub2RlKSkgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgZm4gPSBub2RlLmV4cHJlc3Npb247XG4gIGlmICghdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24oZm4pIHx8ICF0cy5pc0lkZW50aWZpZXIoZm4uZXhwcmVzc2lvbikgfHxcbiAgICAgIGZuLmV4cHJlc3Npb24udGV4dCAhPT0gJ09iamVjdCcgfHwgZm4ubmFtZS50ZXh0ICE9PSAnZGVmaW5lUHJvcGVydHknKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IGRlc2NyaXB0b3IgPSBub2RlLmFyZ3VtZW50c1syXTtcbiAgaWYgKCFkZXNjcmlwdG9yIHx8ICF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKGRlc2NyaXB0b3IpKSByZXR1cm4gbnVsbDtcblxuICByZXR1cm4ge1xuICAgIHNldHRlcjogcmVhZFByb3BlcnR5RnVuY3Rpb25FeHByZXNzaW9uKGRlc2NyaXB0b3IsICdzZXQnKSxcbiAgICBnZXR0ZXI6IHJlYWRQcm9wZXJ0eUZ1bmN0aW9uRXhwcmVzc2lvbihkZXNjcmlwdG9yLCAnZ2V0JyksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlYWRQcm9wZXJ0eUZ1bmN0aW9uRXhwcmVzc2lvbihvYmplY3Q6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uLCBuYW1lOiBzdHJpbmcpIHtcbiAgY29uc3QgcHJvcGVydHkgPSBvYmplY3QucHJvcGVydGllcy5maW5kKFxuICAgICAgKHApOiBwIGlzIHRzLlByb3BlcnR5QXNzaWdubWVudCA9PlxuICAgICAgICAgIHRzLmlzUHJvcGVydHlBc3NpZ25tZW50KHApICYmIHRzLmlzSWRlbnRpZmllcihwLm5hbWUpICYmIHAubmFtZS50ZXh0ID09PSBuYW1lKTtcblxuICByZXR1cm4gcHJvcGVydHkgJiYgdHMuaXNGdW5jdGlvbkV4cHJlc3Npb24ocHJvcGVydHkuaW5pdGlhbGl6ZXIpICYmIHByb3BlcnR5LmluaXRpYWxpemVyIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldFJldHVyblN0YXRlbWVudChkZWNsYXJhdGlvbjogdHMuRXhwcmVzc2lvbnx1bmRlZmluZWQpOiB0cy5SZXR1cm5TdGF0ZW1lbnR8dW5kZWZpbmVkIHtcbiAgcmV0dXJuIGRlY2xhcmF0aW9uICYmIHRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGRlY2xhcmF0aW9uKSA/XG4gICAgICBkZWNsYXJhdGlvbi5ib2R5LnN0YXRlbWVudHMuZmluZCh0cy5pc1JldHVyblN0YXRlbWVudCkgOlxuICAgICAgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiByZWZsZWN0QXJyYXlFbGVtZW50KGVsZW1lbnQ6IHRzLkV4cHJlc3Npb24pIHtcbiAgcmV0dXJuIHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24oZWxlbWVudCkgPyByZWZsZWN0T2JqZWN0TGl0ZXJhbChlbGVtZW50KSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzQXJndW1lbnRzSWRlbnRpZmllcihleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiB0cy5pc0lkZW50aWZpZXIoZXhwcmVzc2lvbikgJiYgZXhwcmVzc2lvbi50ZXh0ID09PSAnYXJndW1lbnRzJztcbn1cblxuZnVuY3Rpb24gaXNTdXBlck5vdE51bGwoZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNCaW5hcnlFeHByKGV4cHJlc3Npb24sIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNFcXVhbHNUb2tlbikgJiZcbiAgICAgIGlzU3VwZXJJZGVudGlmaWVyKGV4cHJlc3Npb24ubGVmdCk7XG59XG5cbmZ1bmN0aW9uIGlzQmluYXJ5RXhwcihcbiAgICBleHByZXNzaW9uOiB0cy5FeHByZXNzaW9uLCBvcGVyYXRvcjogdHMuQmluYXJ5T3BlcmF0b3IpOiBleHByZXNzaW9uIGlzIHRzLkJpbmFyeUV4cHJlc3Npb24ge1xuICByZXR1cm4gdHMuaXNCaW5hcnlFeHByZXNzaW9uKGV4cHJlc3Npb24pICYmIGV4cHJlc3Npb24ub3BlcmF0b3JUb2tlbi5raW5kID09PSBvcGVyYXRvcjtcbn1cblxuZnVuY3Rpb24gaXNTdXBlcklkZW50aWZpZXIobm9kZTogdHMuTm9kZSk6IGJvb2xlYW4ge1xuICAvLyBWZXJpZnkgdGhhdCB0aGUgaWRlbnRpZmllciBpcyBwcmVmaXhlZCB3aXRoIGBfc3VwZXJgLiBXZSBkb24ndCB0ZXN0IGZvciBlcXVpdmFsZW5jZVxuICAvLyBhcyBUeXBlU2NyaXB0IG1heSBoYXZlIHN1ZmZpeGVkIHRoZSBuYW1lLCBlLmcuIGBfc3VwZXJfMWAgdG8gYXZvaWQgbmFtZSBjb25mbGljdHMuXG4gIC8vIFJlcXVpcmluZyBvbmx5IGEgcHJlZml4IHNob3VsZCBiZSBzdWZmaWNpZW50bHkgYWNjdXJhdGUuXG4gIHJldHVybiB0cy5pc0lkZW50aWZpZXIobm9kZSkgJiYgbm9kZS50ZXh0LnN0YXJ0c1dpdGgoJ19zdXBlcicpO1xufVxuXG4vKipcbiAqIFBhcnNlIHRoZSBzdGF0ZW1lbnQgdG8gZXh0cmFjdCB0aGUgRVNNNSBwYXJhbWV0ZXIgaW5pdGlhbGl6ZXIgaWYgdGhlcmUgaXMgb25lLlxuICogSWYgb25lIGlzIGZvdW5kLCBhZGQgaXQgdG8gdGhlIGFwcHJvcHJpYXRlIHBhcmFtZXRlciBpbiB0aGUgYHBhcmFtZXRlcnNgIGNvbGxlY3Rpb24uXG4gKlxuICogVGhlIGZvcm0gd2UgYXJlIGxvb2tpbmcgZm9yIGlzOlxuICpcbiAqIGBgYFxuICogaWYgKGFyZyA9PT0gdm9pZCAwKSB7IGFyZyA9IGluaXRpYWxpemVyOyB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gc3RhdGVtZW50IGEgc3RhdGVtZW50IHRoYXQgbWF5IGJlIGluaXRpYWxpemluZyBhbiBvcHRpb25hbCBwYXJhbWV0ZXJcbiAqIEBwYXJhbSBwYXJhbWV0ZXJzIHRoZSBjb2xsZWN0aW9uIG9mIHBhcmFtZXRlcnMgdGhhdCB3ZXJlIGZvdW5kIGluIHRoZSBmdW5jdGlvbiBkZWZpbml0aW9uXG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBzdGF0ZW1lbnQgd2FzIGEgcGFyYW1ldGVyIGluaXRpYWxpemVyXG4gKi9cbmZ1bmN0aW9uIGNhcHR1cmVQYXJhbUluaXRpYWxpemVyKHN0YXRlbWVudDogdHMuU3RhdGVtZW50LCBwYXJhbWV0ZXJzOiBQYXJhbWV0ZXJbXSkge1xuICBpZiAodHMuaXNJZlN0YXRlbWVudChzdGF0ZW1lbnQpICYmIGlzVW5kZWZpbmVkQ29tcGFyaXNvbihzdGF0ZW1lbnQuZXhwcmVzc2lvbikgJiZcbiAgICAgIHRzLmlzQmxvY2soc3RhdGVtZW50LnRoZW5TdGF0ZW1lbnQpICYmIHN0YXRlbWVudC50aGVuU3RhdGVtZW50LnN0YXRlbWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgY29uc3QgaWZTdGF0ZW1lbnRDb21wYXJpc29uID0gc3RhdGVtZW50LmV4cHJlc3Npb247ICAgICAgICAgICAvLyAoYXJnID09PSB2b2lkIDApXG4gICAgY29uc3QgdGhlblN0YXRlbWVudCA9IHN0YXRlbWVudC50aGVuU3RhdGVtZW50LnN0YXRlbWVudHNbMF07ICAvLyBhcmcgPSBpbml0aWFsaXplcjtcbiAgICBpZiAoaXNBc3NpZ25tZW50U3RhdGVtZW50KHRoZW5TdGF0ZW1lbnQpKSB7XG4gICAgICBjb25zdCBjb21wYXJpc29uTmFtZSA9IGlmU3RhdGVtZW50Q29tcGFyaXNvbi5sZWZ0LnRleHQ7XG4gICAgICBjb25zdCBhc3NpZ25tZW50TmFtZSA9IHRoZW5TdGF0ZW1lbnQuZXhwcmVzc2lvbi5sZWZ0LnRleHQ7XG4gICAgICBpZiAoY29tcGFyaXNvbk5hbWUgPT09IGFzc2lnbm1lbnROYW1lKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtZXRlciA9IHBhcmFtZXRlcnMuZmluZChwID0+IHAubmFtZSA9PT0gY29tcGFyaXNvbk5hbWUpO1xuICAgICAgICBpZiAocGFyYW1ldGVyKSB7XG4gICAgICAgICAgcGFyYW1ldGVyLmluaXRpYWxpemVyID0gdGhlblN0YXRlbWVudC5leHByZXNzaW9uLnJpZ2h0O1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWRDb21wYXJpc29uKGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb24pOiBleHByZXNzaW9uIGlzIHRzLkV4cHJlc3Npb24mXG4gICAge2xlZnQ6IHRzLklkZW50aWZpZXIsIHJpZ2h0OiB0cy5FeHByZXNzaW9ufSB7XG4gIHJldHVybiB0cy5pc0JpbmFyeUV4cHJlc3Npb24oZXhwcmVzc2lvbikgJiZcbiAgICAgIGV4cHJlc3Npb24ub3BlcmF0b3JUb2tlbi5raW5kID09PSB0cy5TeW50YXhLaW5kLkVxdWFsc0VxdWFsc0VxdWFsc1Rva2VuICYmXG4gICAgICB0cy5pc1ZvaWRFeHByZXNzaW9uKGV4cHJlc3Npb24ucmlnaHQpICYmIHRzLmlzSWRlbnRpZmllcihleHByZXNzaW9uLmxlZnQpO1xufVxuXG4vKipcbiAqIFBhcnNlIHRoZSBkZWNsYXJhdGlvbiBvZiB0aGUgZ2l2ZW4gYGNsYXNzU3ltYm9sYCB0byBmaW5kIHRoZSBJSUZFIHdyYXBwZXIgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiBtYXkgYWNjZXB0IGEgYF9zdXBlcmAgYXJndW1lbnQgaWYgdGhlcmUgaXMgYSBiYXNlIGNsYXNzLlxuICpcbiAqIGBgYFxuICogdmFyIFRlc3RDbGFzcyA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XG4gKiAgIF9fZXh0ZW5kcyhUZXN0Q2xhc3MsIF9zdXBlcik7XG4gKiAgIGZ1bmN0aW9uIFRlc3RDbGFzcygpIHt9XG4gKiAgIHJldHVybiBUZXN0Q2xhc3M7XG4gKiB9KEJhc2VDbGFzcykpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIGNsYXNzU3ltYm9sIHRoZSBjbGFzcyB3aG9zZSBpaWZlIHdyYXBwZXIgZnVuY3Rpb24gd2Ugd2FudCB0byBnZXQuXG4gKiBAcmV0dXJucyB0aGUgSUlGRSBmdW5jdGlvbiBvciBudWxsIGlmIGl0IGNvdWxkIG5vdCBiZSBwYXJzZWQuXG4gKi9cbmZ1bmN0aW9uIGdldElpZmVGbihjbGFzc1N5bWJvbDogTmdjY0NsYXNzU3ltYm9sfHVuZGVmaW5lZCk6IHRzLkZ1bmN0aW9uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKGNsYXNzU3ltYm9sID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGlubmVyRGVjbGFyYXRpb24gPSBjbGFzc1N5bWJvbC5pbXBsZW1lbnRhdGlvbi52YWx1ZURlY2xhcmF0aW9uO1xuICBjb25zdCBpaWZlQm9keSA9IGlubmVyRGVjbGFyYXRpb24ucGFyZW50O1xuICBpZiAoIXRzLmlzQmxvY2soaWlmZUJvZHkpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBpaWZlV3JhcHBlciA9IGlpZmVCb2R5LnBhcmVudDtcbiAgcmV0dXJuIGlpZmVXcmFwcGVyICYmIHRzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGlpZmVXcmFwcGVyKSA/IGlpZmVXcmFwcGVyIDogbnVsbDtcbn1cbiJdfQ==