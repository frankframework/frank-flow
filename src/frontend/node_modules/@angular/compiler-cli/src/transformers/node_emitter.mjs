/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BinaryOperator, BuiltinMethod, BuiltinVar, ClassStmt, ExternalExpr, Statement, StmtModifier, UnaryOperator } from '@angular/compiler';
import * as ts from 'typescript';
import { attachComments } from '../ngtsc/translator';
import { error } from './util';
const METHOD_THIS_NAME = 'this';
const CATCH_ERROR_NAME = 'error';
const CATCH_STACK_NAME = 'stack';
const _VALID_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
export class TypeScriptNodeEmitter {
    constructor(annotateForClosureCompiler) {
        this.annotateForClosureCompiler = annotateForClosureCompiler;
    }
    updateSourceFile(sourceFile, stmts, preamble) {
        const converter = new NodeEmitterVisitor(this.annotateForClosureCompiler);
        // [].concat flattens the result so that each `visit...` method can also return an array of
        // stmts.
        const statements = [].concat(...stmts.map(stmt => stmt.visitStatement(converter, null)).filter(stmt => stmt != null));
        const sourceStatements = [...converter.getReexports(), ...converter.getImports(), ...statements];
        if (preamble) {
            // We always attach the preamble comment to a `NotEmittedStatement` node, because tsickle uses
            // this node type as a marker of the preamble to ensure that it adds its own new nodes after
            // the preamble.
            const preambleCommentHolder = ts.createNotEmittedStatement(sourceFile);
            // Preamble comments are passed through as-is, which means that they must already contain a
            // leading `*` if they should be a JSDOC comment.
            ts.addSyntheticLeadingComment(preambleCommentHolder, ts.SyntaxKind.MultiLineCommentTrivia, preamble, 
            /* hasTrailingNewline */ true);
            sourceStatements.unshift(preambleCommentHolder);
        }
        converter.updateSourceMap(sourceStatements);
        const newSourceFile = ts.updateSourceFileNode(sourceFile, sourceStatements);
        return [newSourceFile, converter.getNodeMap()];
    }
}
/**
 * Update the given source file to include the changes specified in module.
 *
 * The module parameter is treated as a partial module meaning that the statements are added to
 * the module instead of replacing the module. Also, any classes are treated as partial classes
 * and the included members are added to the class with the same name instead of a new class
 * being created.
 */
export function updateSourceFile(sourceFile, module, annotateForClosureCompiler) {
    const converter = new NodeEmitterVisitor(annotateForClosureCompiler);
    converter.loadExportedVariableIdentifiers(sourceFile);
    const prefixStatements = module.statements.filter(statement => !(statement instanceof ClassStmt));
    const classes = module.statements.filter(statement => statement instanceof ClassStmt);
    const classMap = new Map(classes.map(classStatement => [classStatement.name, classStatement]));
    const classNames = new Set(classes.map(classStatement => classStatement.name));
    const prefix = prefixStatements.map(statement => statement.visitStatement(converter, sourceFile));
    // Add static methods to all the classes referenced in module.
    let newStatements = sourceFile.statements.map(node => {
        if (node.kind == ts.SyntaxKind.ClassDeclaration) {
            const classDeclaration = node;
            const name = classDeclaration.name;
            if (name) {
                const classStatement = classMap.get(name.text);
                if (classStatement) {
                    classNames.delete(name.text);
                    const classMemberHolder = converter.visitDeclareClassStmt(classStatement);
                    const newMethods = classMemberHolder.members.filter(member => member.kind !== ts.SyntaxKind.Constructor);
                    const newMembers = [...classDeclaration.members, ...newMethods];
                    return ts.updateClassDeclaration(classDeclaration, 
                    /* decorators */ classDeclaration.decorators, 
                    /* modifiers */ classDeclaration.modifiers, 
                    /* name */ classDeclaration.name, 
                    /* typeParameters */ classDeclaration.typeParameters, 
                    /* heritageClauses */ classDeclaration.heritageClauses || [], 
                    /* members */ newMembers);
                }
            }
        }
        return node;
    });
    // Validate that all the classes have been generated
    classNames.size == 0 ||
        error(`${classNames.size == 1 ? 'Class' : 'Classes'} "${Array.from(classNames.keys()).join(', ')}" not generated`);
    // Add imports to the module required by the new methods
    const imports = converter.getImports();
    if (imports && imports.length) {
        // Find where the new imports should go
        const index = firstAfter(newStatements, statement => statement.kind === ts.SyntaxKind.ImportDeclaration ||
            statement.kind === ts.SyntaxKind.ImportEqualsDeclaration);
        newStatements =
            [...newStatements.slice(0, index), ...imports, ...prefix, ...newStatements.slice(index)];
    }
    else {
        newStatements = [...prefix, ...newStatements];
    }
    converter.updateSourceMap(newStatements);
    const newSourceFile = ts.updateSourceFileNode(sourceFile, newStatements);
    return [newSourceFile, converter.getNodeMap()];
}
// Return the index after the first value in `a` that doesn't match the predicate after a value that
// does or 0 if no values match.
function firstAfter(a, predicate) {
    let index = 0;
    const len = a.length;
    for (; index < len; index++) {
        const value = a[index];
        if (predicate(value))
            break;
    }
    if (index >= len)
        return 0;
    for (; index < len; index++) {
        const value = a[index];
        if (!predicate(value))
            break;
    }
    return index;
}
function escapeLiteral(value) {
    return value.replace(/(\"|\\)/g, '\\$1').replace(/(\n)|(\r)/g, function (v, n, r) {
        return n ? '\\n' : '\\r';
    });
}
function createLiteral(value) {
    if (value === null) {
        return ts.createNull();
    }
    else if (value === undefined) {
        return ts.createIdentifier('undefined');
    }
    else {
        const result = ts.createLiteral(value);
        if (ts.isStringLiteral(result) && result.text.indexOf('\\') >= 0) {
            // Hack to avoid problems cause indirectly by:
            //    https://github.com/Microsoft/TypeScript/issues/20192
            // This avoids the string escaping normally performed for a string relying on that
            // TypeScript just emits the text raw for a numeric literal.
            result.kind = ts.SyntaxKind.NumericLiteral;
            result.text = `"${escapeLiteral(result.text)}"`;
        }
        return result;
    }
}
function isExportTypeStatement(statement) {
    return !!statement.modifiers &&
        statement.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
}
/**
 * Visits an output ast and produces the corresponding TypeScript synthetic nodes.
 */
export class NodeEmitterVisitor {
    constructor(annotateForClosureCompiler) {
        this.annotateForClosureCompiler = annotateForClosureCompiler;
        this._nodeMap = new Map();
        this._importsWithPrefixes = new Map();
        this._reexports = new Map();
        this._templateSources = new Map();
        this._exportedVariableIdentifiers = new Map();
    }
    /**
     * Process the source file and collect exported identifiers that refer to variables.
     *
     * Only variables are collected because exported classes still exist in the module scope in
     * CommonJS, whereas variables have their declarations moved onto the `exports` object, and all
     * references are updated accordingly.
     */
    loadExportedVariableIdentifiers(sourceFile) {
        sourceFile.statements.forEach(statement => {
            if (ts.isVariableStatement(statement) && isExportTypeStatement(statement)) {
                statement.declarationList.declarations.forEach(declaration => {
                    if (ts.isIdentifier(declaration.name)) {
                        this._exportedVariableIdentifiers.set(declaration.name.text, declaration.name);
                    }
                });
            }
        });
    }
    getReexports() {
        return Array.from(this._reexports.entries())
            .map(([exportedFilePath, reexports]) => ts.createExportDeclaration(
        /* decorators */ undefined, 
        /* modifiers */ undefined, ts.createNamedExports(reexports.map(({ name, as }) => ts.createExportSpecifier(name, as))), 
        /* moduleSpecifier */ createLiteral(exportedFilePath)));
    }
    getImports() {
        return Array.from(this._importsWithPrefixes.entries())
            .map(([namespace, prefix]) => ts.createImportDeclaration(
        /* decorators */ undefined, 
        /* modifiers */ undefined, 
        /* importClause */
        ts.createImportClause(
        /* name */ undefined, ts.createNamespaceImport(ts.createIdentifier(prefix))), 
        /* moduleSpecifier */ createLiteral(namespace)));
    }
    getNodeMap() {
        return this._nodeMap;
    }
    updateSourceMap(statements) {
        let lastRangeStartNode = undefined;
        let lastRangeEndNode = undefined;
        let lastRange = undefined;
        const recordLastSourceRange = () => {
            if (lastRange && lastRangeStartNode && lastRangeEndNode) {
                if (lastRangeStartNode == lastRangeEndNode) {
                    ts.setSourceMapRange(lastRangeEndNode, lastRange);
                }
                else {
                    ts.setSourceMapRange(lastRangeStartNode, lastRange);
                    // Only emit the pos for the first node emitted in the range.
                    ts.setEmitFlags(lastRangeStartNode, ts.EmitFlags.NoTrailingSourceMap);
                    ts.setSourceMapRange(lastRangeEndNode, lastRange);
                    // Only emit emit end for the last node emitted in the range.
                    ts.setEmitFlags(lastRangeEndNode, ts.EmitFlags.NoLeadingSourceMap);
                }
            }
        };
        const visitNode = (tsNode) => {
            const ngNode = this._nodeMap.get(tsNode);
            if (ngNode) {
                const range = this.sourceRangeOf(ngNode);
                if (range) {
                    if (!lastRange || range.source != lastRange.source || range.pos != lastRange.pos ||
                        range.end != lastRange.end) {
                        recordLastSourceRange();
                        lastRangeStartNode = tsNode;
                        lastRange = range;
                    }
                    lastRangeEndNode = tsNode;
                }
            }
            ts.forEachChild(tsNode, visitNode);
        };
        statements.forEach(visitNode);
        recordLastSourceRange();
    }
    postProcess(ngNode, tsNode) {
        if (tsNode && !this._nodeMap.has(tsNode)) {
            this._nodeMap.set(tsNode, ngNode);
        }
        if (tsNode !== null && ngNode instanceof Statement && ngNode.leadingComments !== undefined) {
            attachComments(tsNode, ngNode.leadingComments);
        }
        return tsNode;
    }
    sourceRangeOf(node) {
        if (node.sourceSpan) {
            const span = node.sourceSpan;
            if (span.start.file == span.end.file) {
                const file = span.start.file;
                if (file.url) {
                    let source = this._templateSources.get(file);
                    if (!source) {
                        source = ts.createSourceMapSource(file.url, file.content, pos => pos);
                        this._templateSources.set(file, source);
                    }
                    return { pos: span.start.offset, end: span.end.offset, source };
                }
            }
        }
        return null;
    }
    getModifiers(stmt) {
        let modifiers = [];
        if (stmt.hasModifier(StmtModifier.Exported)) {
            modifiers.push(ts.createToken(ts.SyntaxKind.ExportKeyword));
        }
        return modifiers;
    }
    // StatementVisitor
    visitDeclareVarStmt(stmt) {
        if (stmt.hasModifier(StmtModifier.Exported) && stmt.value instanceof ExternalExpr &&
            !stmt.type) {
            // check for a reexport
            const { name, moduleName } = stmt.value.value;
            if (moduleName) {
                let reexports = this._reexports.get(moduleName);
                if (!reexports) {
                    reexports = [];
                    this._reexports.set(moduleName, reexports);
                }
                reexports.push({ name: name, as: stmt.name });
                return null;
            }
        }
        const varDeclList = ts.createVariableDeclarationList([ts.createVariableDeclaration(ts.createIdentifier(stmt.name), 
            /* type */ undefined, (stmt.value && stmt.value.visitExpression(this, null)) || undefined)]);
        if (stmt.hasModifier(StmtModifier.Exported)) {
            // Note: We need to add an explicit variable and export declaration so that
            // the variable can be referred in the same file as well.
            const tsVarStmt = this.postProcess(stmt, ts.createVariableStatement(/* modifiers */ [], varDeclList));
            const exportStmt = this.postProcess(stmt, ts.createExportDeclaration(
            /*decorators*/ undefined, /*modifiers*/ undefined, ts.createNamedExports([ts.createExportSpecifier(stmt.name, stmt.name)])));
            return [tsVarStmt, exportStmt];
        }
        return this.postProcess(stmt, ts.createVariableStatement(this.getModifiers(stmt), varDeclList));
    }
    visitDeclareFunctionStmt(stmt) {
        return this.postProcess(stmt, ts.createFunctionDeclaration(
        /* decorators */ undefined, this.getModifiers(stmt), 
        /* asteriskToken */ undefined, stmt.name, /* typeParameters */ undefined, stmt.params.map(p => ts.createParameter(
        /* decorators */ undefined, /* modifiers */ undefined, 
        /* dotDotDotToken */ undefined, p.name)), 
        /* type */ undefined, this._visitStatements(stmt.statements)));
    }
    visitExpressionStmt(stmt) {
        return this.postProcess(stmt, ts.createStatement(stmt.expr.visitExpression(this, null)));
    }
    visitReturnStmt(stmt) {
        return this.postProcess(stmt, ts.createReturn(stmt.value ? stmt.value.visitExpression(this, null) : undefined));
    }
    visitDeclareClassStmt(stmt) {
        const modifiers = this.getModifiers(stmt);
        const fields = stmt.fields.map(field => {
            const property = ts.createProperty(
            /* decorators */ undefined, /* modifiers */ translateModifiers(field.modifiers), field.name, 
            /* questionToken */ undefined, 
            /* type */ undefined, field.initializer == null ? ts.createNull() :
                field.initializer.visitExpression(this, null));
            if (this.annotateForClosureCompiler) {
                // Closure compiler transforms the form `Service.ɵprov = X` into `Service$ɵprov = X`. To
                // prevent this transformation, such assignments need to be annotated with @nocollapse.
                // Note that tsickle is typically responsible for adding such annotations, however it
                // doesn't yet handle synthetic fields added during other transformations.
                ts.addSyntheticLeadingComment(property, ts.SyntaxKind.MultiLineCommentTrivia, '* @nocollapse ', 
                /* hasTrailingNewLine */ false);
            }
            return property;
        });
        const getters = stmt.getters.map(getter => ts.createGetAccessor(
        /* decorators */ undefined, /* modifiers */ undefined, getter.name, /* parameters */ [], 
        /* type */ undefined, this._visitStatements(getter.body)));
        const constructor = (stmt.constructorMethod && [ts.createConstructor(
            /* decorators */ undefined, 
            /* modifiers */ undefined, 
            /* parameters */
            stmt.constructorMethod.params.map(p => ts.createParameter(
            /* decorators */ undefined, 
            /* modifiers */ undefined, 
            /* dotDotDotToken */ undefined, p.name)), this._visitStatements(stmt.constructorMethod.body))]) ||
            [];
        // TODO {chuckj}: Determine what should be done for a method with a null name.
        const methods = stmt.methods.filter(method => method.name)
            .map(method => ts.createMethod(
        /* decorators */ undefined, 
        /* modifiers */ translateModifiers(method.modifiers), 
        /* astriskToken */ undefined, method.name /* guarded by filter */, 
        /* questionToken */ undefined, /* typeParameters */ undefined, method.params.map(p => ts.createParameter(
        /* decorators */ undefined, /* modifiers */ undefined, 
        /* dotDotDotToken */ undefined, p.name)), 
        /* type */ undefined, this._visitStatements(method.body)));
        return this.postProcess(stmt, ts.createClassDeclaration(
        /* decorators */ undefined, modifiers, stmt.name, /* typeParameters*/ undefined, stmt.parent &&
            [ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [stmt.parent.visitExpression(this, null)])] ||
            [], [...fields, ...getters, ...constructor, ...methods]));
    }
    visitIfStmt(stmt) {
        return this.postProcess(stmt, ts.createIf(stmt.condition.visitExpression(this, null), this._visitStatements(stmt.trueCase), stmt.falseCase && stmt.falseCase.length && this._visitStatements(stmt.falseCase) ||
            undefined));
    }
    visitTryCatchStmt(stmt) {
        return this.postProcess(stmt, ts.createTry(this._visitStatements(stmt.bodyStmts), ts.createCatchClause(CATCH_ERROR_NAME, this._visitStatementsPrefix([ts.createVariableStatement(
            /* modifiers */ undefined, [ts.createVariableDeclaration(CATCH_STACK_NAME, /* type */ undefined, ts.createPropertyAccess(ts.createIdentifier(CATCH_ERROR_NAME), ts.createIdentifier(CATCH_STACK_NAME)))])], stmt.catchStmts)), 
        /* finallyBlock */ undefined));
    }
    visitThrowStmt(stmt) {
        return this.postProcess(stmt, ts.createThrow(stmt.error.visitExpression(this, null)));
    }
    // ExpressionVisitor
    visitWrappedNodeExpr(expr) {
        return this.postProcess(expr, expr.node);
    }
    visitTypeofExpr(expr) {
        const typeOf = ts.createTypeOf(expr.expr.visitExpression(this, null));
        return this.postProcess(expr, typeOf);
    }
    // ExpressionVisitor
    visitReadVarExpr(expr) {
        switch (expr.builtin) {
            case BuiltinVar.This:
                return this.postProcess(expr, ts.createIdentifier(METHOD_THIS_NAME));
            case BuiltinVar.CatchError:
                return this.postProcess(expr, ts.createIdentifier(CATCH_ERROR_NAME));
            case BuiltinVar.CatchStack:
                return this.postProcess(expr, ts.createIdentifier(CATCH_STACK_NAME));
            case BuiltinVar.Super:
                return this.postProcess(expr, ts.createSuper());
        }
        if (expr.name) {
            return this.postProcess(expr, ts.createIdentifier(expr.name));
        }
        throw Error(`Unexpected ReadVarExpr form`);
    }
    visitWriteVarExpr(expr) {
        return this.postProcess(expr, ts.createAssignment(ts.createIdentifier(expr.name), expr.value.visitExpression(this, null)));
    }
    visitWriteKeyExpr(expr) {
        return this.postProcess(expr, ts.createAssignment(ts.createElementAccess(expr.receiver.visitExpression(this, null), expr.index.visitExpression(this, null)), expr.value.visitExpression(this, null)));
    }
    visitWritePropExpr(expr) {
        return this.postProcess(expr, ts.createAssignment(ts.createPropertyAccess(expr.receiver.visitExpression(this, null), expr.name), expr.value.visitExpression(this, null)));
    }
    visitInvokeMethodExpr(expr) {
        const methodName = getMethodName(expr);
        return this.postProcess(expr, ts.createCall(ts.createPropertyAccess(expr.receiver.visitExpression(this, null), methodName), 
        /* typeArguments */ undefined, expr.args.map(arg => arg.visitExpression(this, null))));
    }
    visitInvokeFunctionExpr(expr) {
        return this.postProcess(expr, ts.createCall(expr.fn.visitExpression(this, null), /* typeArguments */ undefined, expr.args.map(arg => arg.visitExpression(this, null))));
    }
    visitTaggedTemplateExpr(expr) {
        throw new Error('tagged templates are not supported in pre-ivy mode.');
    }
    visitInstantiateExpr(expr) {
        return this.postProcess(expr, ts.createNew(expr.classExpr.visitExpression(this, null), /* typeArguments */ undefined, expr.args.map(arg => arg.visitExpression(this, null))));
    }
    visitLiteralExpr(expr) {
        return this.postProcess(expr, createLiteral(expr.value));
    }
    visitLocalizedString(expr, context) {
        throw new Error('localized strings are not supported in pre-ivy mode.');
    }
    visitExternalExpr(expr) {
        return this.postProcess(expr, this._visitIdentifier(expr.value));
    }
    visitConditionalExpr(expr) {
        // TODO {chuckj}: Review use of ! on falseCase. Should it be non-nullable?
        return this.postProcess(expr, ts.createParen(ts.createConditional(expr.condition.visitExpression(this, null), expr.trueCase.visitExpression(this, null), expr.falseCase.visitExpression(this, null))));
    }
    visitNotExpr(expr) {
        return this.postProcess(expr, ts.createPrefix(ts.SyntaxKind.ExclamationToken, expr.condition.visitExpression(this, null)));
    }
    visitAssertNotNullExpr(expr) {
        return expr.condition.visitExpression(this, null);
    }
    visitCastExpr(expr) {
        return expr.value.visitExpression(this, null);
    }
    visitFunctionExpr(expr) {
        return this.postProcess(expr, ts.createFunctionExpression(
        /* modifiers */ undefined, /* astriskToken */ undefined, 
        /* name */ expr.name || undefined, 
        /* typeParameters */ undefined, expr.params.map(p => ts.createParameter(
        /* decorators */ undefined, /* modifiers */ undefined, 
        /* dotDotDotToken */ undefined, p.name)), 
        /* type */ undefined, this._visitStatements(expr.statements)));
    }
    visitUnaryOperatorExpr(expr) {
        let unaryOperator;
        switch (expr.operator) {
            case UnaryOperator.Minus:
                unaryOperator = ts.SyntaxKind.MinusToken;
                break;
            case UnaryOperator.Plus:
                unaryOperator = ts.SyntaxKind.PlusToken;
                break;
            default:
                throw new Error(`Unknown operator: ${expr.operator}`);
        }
        const binary = ts.createPrefix(unaryOperator, expr.expr.visitExpression(this, null));
        return this.postProcess(expr, expr.parens ? ts.createParen(binary) : binary);
    }
    visitBinaryOperatorExpr(expr) {
        let binaryOperator;
        switch (expr.operator) {
            case BinaryOperator.And:
                binaryOperator = ts.SyntaxKind.AmpersandAmpersandToken;
                break;
            case BinaryOperator.BitwiseAnd:
                binaryOperator = ts.SyntaxKind.AmpersandToken;
                break;
            case BinaryOperator.Bigger:
                binaryOperator = ts.SyntaxKind.GreaterThanToken;
                break;
            case BinaryOperator.BiggerEquals:
                binaryOperator = ts.SyntaxKind.GreaterThanEqualsToken;
                break;
            case BinaryOperator.Divide:
                binaryOperator = ts.SyntaxKind.SlashToken;
                break;
            case BinaryOperator.Equals:
                binaryOperator = ts.SyntaxKind.EqualsEqualsToken;
                break;
            case BinaryOperator.Identical:
                binaryOperator = ts.SyntaxKind.EqualsEqualsEqualsToken;
                break;
            case BinaryOperator.Lower:
                binaryOperator = ts.SyntaxKind.LessThanToken;
                break;
            case BinaryOperator.LowerEquals:
                binaryOperator = ts.SyntaxKind.LessThanEqualsToken;
                break;
            case BinaryOperator.Minus:
                binaryOperator = ts.SyntaxKind.MinusToken;
                break;
            case BinaryOperator.Modulo:
                binaryOperator = ts.SyntaxKind.PercentToken;
                break;
            case BinaryOperator.Multiply:
                binaryOperator = ts.SyntaxKind.AsteriskToken;
                break;
            case BinaryOperator.NotEquals:
                binaryOperator = ts.SyntaxKind.ExclamationEqualsToken;
                break;
            case BinaryOperator.NotIdentical:
                binaryOperator = ts.SyntaxKind.ExclamationEqualsEqualsToken;
                break;
            case BinaryOperator.Or:
                binaryOperator = ts.SyntaxKind.BarBarToken;
                break;
            case BinaryOperator.NullishCoalesce:
                binaryOperator = ts.SyntaxKind.QuestionQuestionToken;
                break;
            case BinaryOperator.Plus:
                binaryOperator = ts.SyntaxKind.PlusToken;
                break;
            default:
                throw new Error(`Unknown operator: ${expr.operator}`);
        }
        const binary = ts.createBinary(expr.lhs.visitExpression(this, null), binaryOperator, expr.rhs.visitExpression(this, null));
        return this.postProcess(expr, expr.parens ? ts.createParen(binary) : binary);
    }
    visitReadPropExpr(expr) {
        return this.postProcess(expr, ts.createPropertyAccess(expr.receiver.visitExpression(this, null), expr.name));
    }
    visitReadKeyExpr(expr) {
        return this.postProcess(expr, ts.createElementAccess(expr.receiver.visitExpression(this, null), expr.index.visitExpression(this, null)));
    }
    visitLiteralArrayExpr(expr) {
        return this.postProcess(expr, ts.createArrayLiteral(expr.entries.map(entry => entry.visitExpression(this, null))));
    }
    visitLiteralMapExpr(expr) {
        return this.postProcess(expr, ts.createObjectLiteral(expr.entries.map(entry => ts.createPropertyAssignment(entry.quoted || !_VALID_IDENTIFIER_RE.test(entry.key) ?
            ts.createLiteral(entry.key) :
            entry.key, entry.value.visitExpression(this, null)))));
    }
    visitCommaExpr(expr) {
        return this.postProcess(expr, expr.parts.map(e => e.visitExpression(this, null))
            .reduce((left, right) => left ? ts.createBinary(left, ts.SyntaxKind.CommaToken, right) : right, null));
    }
    _visitStatements(statements) {
        return this._visitStatementsPrefix([], statements);
    }
    _visitStatementsPrefix(prefix, statements) {
        return ts.createBlock([
            ...prefix, ...statements.map(stmt => stmt.visitStatement(this, null)).filter(f => f != null)
        ]);
    }
    _visitIdentifier(value) {
        // name can only be null during JIT which never executes this code.
        const moduleName = value.moduleName, name = value.name;
        let prefixIdent = null;
        if (moduleName) {
            let prefix = this._importsWithPrefixes.get(moduleName);
            if (prefix == null) {
                prefix = `i${this._importsWithPrefixes.size}`;
                this._importsWithPrefixes.set(moduleName, prefix);
            }
            prefixIdent = ts.createIdentifier(prefix);
        }
        if (prefixIdent) {
            return ts.createPropertyAccess(prefixIdent, name);
        }
        else {
            const id = ts.createIdentifier(name);
            if (this._exportedVariableIdentifiers.has(name)) {
                // In order for this new identifier node to be properly rewritten in CommonJS output,
                // it must have its original node set to a parsed instance of the same identifier.
                ts.setOriginalNode(id, this._exportedVariableIdentifiers.get(name));
            }
            return id;
        }
    }
}
function getMethodName(methodRef) {
    if (methodRef.name) {
        return methodRef.name;
    }
    else {
        switch (methodRef.builtin) {
            case BuiltinMethod.Bind:
                return 'bind';
            case BuiltinMethod.ConcatArray:
                return 'concat';
            case BuiltinMethod.SubscribeObservable:
                return 'subscribe';
        }
    }
    throw new Error('Unexpected method reference form');
}
function modifierFromModifier(modifier) {
    switch (modifier) {
        case StmtModifier.Exported:
            return ts.createToken(ts.SyntaxKind.ExportKeyword);
        case StmtModifier.Final:
            return ts.createToken(ts.SyntaxKind.ConstKeyword);
        case StmtModifier.Private:
            return ts.createToken(ts.SyntaxKind.PrivateKeyword);
        case StmtModifier.Static:
            return ts.createToken(ts.SyntaxKind.StaticKeyword);
    }
}
function translateModifiers(modifiers) {
    return modifiers == null ? undefined : modifiers.map(modifierFromModifier);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9lbWl0dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy90cmFuc2Zvcm1lcnMvbm9kZV9lbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBZ0IsY0FBYyxFQUFzQixhQUFhLEVBQUUsVUFBVSxFQUFZLFNBQVMsRUFBMkcsWUFBWSxFQUFxVCxTQUFTLEVBQW9CLFlBQVksRUFBMkQsYUFBYSxFQUFnRixNQUFNLG1CQUFtQixDQUFDO0FBQ2h2QixPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDbkQsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFFBQVEsQ0FBQztBQU03QixNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztBQUNoQyxNQUFNLGdCQUFnQixHQUFHLE9BQU8sQ0FBQztBQUNqQyxNQUFNLGdCQUFnQixHQUFHLE9BQU8sQ0FBQztBQUNqQyxNQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDO0FBRXJELE1BQU0sT0FBTyxxQkFBcUI7SUFDaEMsWUFBb0IsMEJBQW1DO1FBQW5DLCtCQUEwQixHQUExQiwwQkFBMEIsQ0FBUztJQUFHLENBQUM7SUFFM0QsZ0JBQWdCLENBQUMsVUFBeUIsRUFBRSxLQUFrQixFQUFFLFFBQWlCO1FBRS9FLE1BQU0sU0FBUyxHQUFHLElBQUksa0JBQWtCLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDMUUsMkZBQTJGO1FBQzNGLFNBQVM7UUFDVCxNQUFNLFVBQVUsR0FBVSxFQUFFLENBQUMsTUFBTSxDQUMvQixHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMs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QU07WUFDdEIsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUM7S0FDdEQ7QUFDSCxDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxTQUE4QjtJQUN4RCxPQUFPLFNBQVMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBVSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQzlFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBc3NlcnROb3ROdWxsLCBCaW5hcnlPcGVyYXRvciwgQmluYXJ5T3BlcmF0b3JFeHByLCBCdWlsdGluTWV0aG9kLCBCdWlsdGluVmFyLCBDYXN0RXhwciwgQ2xhc3NTdG10LCBDb21tYUV4cHIsIENvbmRpdGlvbmFsRXhwciwgRGVjbGFyZUZ1bmN0aW9uU3RtdCwgRGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb25TdGF0ZW1lbnQsIEV4cHJlc3Npb25WaXNpdG9yLCBFeHRlcm5hbEV4cHIsIEV4dGVybmFsUmVmZXJlbmNlLCBGdW5jdGlvbkV4cHIsIElmU3RtdCwgSW5zdGFudGlhdGVFeHByLCBJbnZva2VGdW5jdGlvbkV4cHIsIEludm9rZU1ldGhvZEV4cHIsIExlYWRpbmdDb21tZW50LCBsZWFkaW5nQ29tbWVudCwgTGl0ZXJhbEFycmF5RXhwciwgTGl0ZXJhbEV4cHIsIExpdGVyYWxNYXBFeHByLCBMb2NhbGl6ZWRTdHJpbmcsIE5vdEV4cHIsIFBhcnNlU291cmNlRmlsZSwgUGFyc2VTb3VyY2VTcGFuLCBQYXJ0aWFsTW9kdWxlLCBSZWFkS2V5RXhwciwgUmVhZFByb3BFeHByLCBSZWFkVmFyRXhwciwgUmV0dXJuU3RhdGVtZW50LCBTdGF0ZW1lbnQsIFN0YXRlbWVudFZpc2l0b3IsIFN0bXRNb2RpZmllciwgVGFnZ2VkVGVtcGxhdGVFeHByLCBUaHJvd1N0bXQsIFRyeUNhdGNoU3RtdCwgVHlwZW9mRXhwciwgVW5hcnlPcGVyYXRvciwgVW5hcnlPcGVyYXRvckV4cHIsIFdyYXBwZWROb2RlRXhwciwgV3JpdGVLZXlFeHByLCBXcml0ZVByb3BFeHByLCBXcml0ZVZhckV4cHJ9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2F0dGFjaENvbW1lbnRzfSBmcm9tICcuLi9uZ3RzYy90cmFuc2xhdG9yJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xufVxuXG5jb25zdCBNRVRIT0RfVEhJU19OQU1FID0gJ3RoaXMnO1xuY29uc3QgQ0FUQ0hfRVJST1JfTkFNRSA9ICdlcnJvcic7XG5jb25zdCBDQVRDSF9TVEFDS19OQU1FID0gJ3N0YWNrJztcbmNvbnN0IF9WQUxJRF9JREVOVElGSUVSX1JFID0gL15bJEEtWl9dWzAtOUEtWl8kXSokL2k7XG5cbmV4cG9ydCBjbGFzcyBUeXBlU2NyaXB0Tm9kZUVtaXR0ZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyOiBib29sZWFuKSB7fVxuXG4gIHVwZGF0ZVNvdXJjZUZpbGUoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgc3RtdHM6IFN0YXRlbWVudFtdLCBwcmVhbWJsZT86IHN0cmluZyk6XG4gICAgICBbdHMuU291cmNlRmlsZSwgTWFwPHRzLk5vZGUsIE5vZGU+XSB7XG4gICAgY29uc3QgY29udmVydGVyID0gbmV3IE5vZGVFbWl0dGVyVmlzaXRvcih0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKTtcbiAgICAvLyBbXS5jb25jYXQgZmxhdHRlbnMgdGhlIHJlc3VsdCBzbyB0aGF0IGVhY2ggYHZpc2l0Li4uYCBtZXRob2QgY2FuIGFsc28gcmV0dXJuIGFuIGFycmF5IG9mXG4gICAgLy8gc3RtdHMuXG4gICAgY29uc3Qgc3RhdGVtZW50czogYW55W10gPSBbXS5jb25jYXQoXG4gICAgICAgIC4uLnN0bXRzLm1hcChzdG10ID0+IHN0bXQudmlzaXRTdGF0ZW1lbnQoY29udmVydGVyLCBudWxsKSkuZmlsdGVyKHN0bXQgPT4gc3RtdCAhPSBudWxsKSk7XG4gICAgY29uc3Qgc291cmNlU3RhdGVtZW50cyA9XG4gICAgICAgIFsuLi5jb252ZXJ0ZXIuZ2V0UmVleHBvcnRzKCksIC4uLmNvbnZlcnRlci5nZXRJbXBvcnRzKCksIC4uLnN0YXRlbWVudHNdO1xuICAgIGlmIChwcmVhbWJsZSkge1xuICAgICAgLy8gV2UgYWx3YXlzIGF0dGFjaCB0aGUgcHJlYW1ibGUgY29tbWVudCB0byBhIGBOb3RFbWl0dGVkU3RhdGVtZW50YCBub2RlLCBiZWNhdXNlIHRzaWNrbGUgdXNlc1xuICAgICAgLy8gdGhpcyBub2RlIHR5cGUgYXMgYSBtYXJrZXIgb2YgdGhlIHByZWFtYmxlIHRvIGVuc3VyZSB0aGF0IGl0IGFkZHMgaXRzIG93biBuZXcgbm9kZXMgYWZ0ZXJcbiAgICAgIC8vIHRoZSBwcmVhbWJsZS5cbiAgICAgIGNvbnN0IHByZWFtYmxlQ29tbWVudEhvbGRlciA9IHRzLmNyZWF0ZU5vdEVtaXR0ZWRTdGF0ZW1lbnQoc291cmNlRmlsZSk7XG4gICAgICAvLyBQcmVhbWJsZSBjb21tZW50cyBhcmUgcGFzc2VkIHRocm91Z2ggYXMtaXMsIHdoaWNoIG1lYW5zIHRoYXQgdGhleSBtdXN0IGFscmVhZHkgY29udGFpbiBhXG4gICAgICAvLyBsZWFkaW5nIGAqYCBpZiB0aGV5IHNob3VsZCBiZSBhIEpTRE9DIGNvbW1lbnQuXG4gICAgICB0cy5hZGRTeW50aGV0aWNMZWFkaW5nQ29tbWVudChcbiAgICAgICAgICBwcmVhbWJsZUNvbW1lbnRIb2xkZXIsIHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSwgcHJlYW1ibGUsXG4gICAgICAgICAgLyogaGFzVHJhaWxpbmdOZXdsaW5lICovIHRydWUpO1xuICAgICAgc291cmNlU3RhdGVtZW50cy51bnNoaWZ0KHByZWFtYmxlQ29tbWVudEhvbGRlcik7XG4gICAgfVxuXG4gICAgY29udmVydGVyLnVwZGF0ZVNvdXJjZU1hcChzb3VyY2VTdGF0ZW1lbnRzKTtcbiAgICBjb25zdCBuZXdTb3VyY2VGaWxlID0gdHMudXBkYXRlU291cmNlRmlsZU5vZGUoc291cmNlRmlsZSwgc291cmNlU3RhdGVtZW50cyk7XG4gICAgcmV0dXJuIFtuZXdTb3VyY2VGaWxlLCBjb252ZXJ0ZXIuZ2V0Tm9kZU1hcCgpXTtcbiAgfVxufVxuXG4vKipcbiAqIFVwZGF0ZSB0aGUgZ2l2ZW4gc291cmNlIGZpbGUgdG8gaW5jbHVkZSB0aGUgY2hhbmdlcyBzcGVjaWZpZWQgaW4gbW9kdWxlLlxuICpcbiAqIFRoZSBtb2R1bGUgcGFyYW1ldGVyIGlzIHRyZWF0ZWQgYXMgYSBwYXJ0aWFsIG1vZHVsZSBtZWFuaW5nIHRoYXQgdGhlIHN0YXRlbWVudHMgYXJlIGFkZGVkIHRvXG4gKiB0aGUgbW9kdWxlIGluc3RlYWQgb2YgcmVwbGFjaW5nIHRoZSBtb2R1bGUuIEFsc28sIGFueSBjbGFzc2VzIGFyZSB0cmVhdGVkIGFzIHBhcnRpYWwgY2xhc3Nlc1xuICogYW5kIHRoZSBpbmNsdWRlZCBtZW1iZXJzIGFyZSBhZGRlZCB0byB0aGUgY2xhc3Mgd2l0aCB0aGUgc2FtZSBuYW1lIGluc3RlYWQgb2YgYSBuZXcgY2xhc3NcbiAqIGJlaW5nIGNyZWF0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVTb3VyY2VGaWxlKFxuICAgIHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsIG1vZHVsZTogUGFydGlhbE1vZHVsZSxcbiAgICBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcjogYm9vbGVhbik6IFt0cy5Tb3VyY2VGaWxlLCBNYXA8dHMuTm9kZSwgTm9kZT5dIHtcbiAgY29uc3QgY29udmVydGVyID0gbmV3IE5vZGVFbWl0dGVyVmlzaXRvcihhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcik7XG4gIGNvbnZlcnRlci5sb2FkRXhwb3J0ZWRWYXJpYWJsZUlkZW50aWZpZXJzKHNvdXJjZUZpbGUpO1xuXG4gIGNvbnN0IHByZWZpeFN0YXRlbWVudHMgPSBtb2R1bGUuc3RhdGVtZW50cy5maWx0ZXIoc3RhdGVtZW50ID0+ICEoc3RhdGVtZW50IGluc3RhbmNlb2YgQ2xhc3NTdG10KSk7XG4gIGNvbnN0IGNsYXNzZXMgPVxuICAgICAgbW9kdWxlLnN0YXRlbWVudHMuZmlsdGVyKHN0YXRlbWVudCA9PiBzdGF0ZW1lbnQgaW5zdGFuY2VvZiBDbGFzc1N0bXQpIGFzIENsYXNzU3RtdFtdO1xuICBjb25zdCBjbGFzc01hcCA9IG5ldyBNYXAoXG4gICAgICBjbGFzc2VzLm1hcDxbc3RyaW5nLCBDbGFzc1N0bXRdPihjbGFzc1N0YXRlbWVudCA9PiBbY2xhc3NTdGF0ZW1lbnQubmFtZSwgY2xhc3NTdGF0ZW1lbnRdKSk7XG4gIGNvbnN0IGNsYXNzTmFtZXMgPSBuZXcgU2V0KGNsYXNzZXMubWFwKGNsYXNzU3RhdGVtZW50ID0+IGNsYXNzU3RhdGVtZW50Lm5hbWUpKTtcblxuICBjb25zdCBwcmVmaXg6IHRzLlN0YXRlbWVudFtdID1cbiAgICAgIHByZWZpeFN0YXRlbWVudHMubWFwKHN0YXRlbWVudCA9PiBzdGF0ZW1lbnQudmlzaXRTdGF0ZW1lbnQoY29udmVydGVyLCBzb3VyY2VGaWxlKSk7XG5cbiAgLy8gQWRkIHN0YXRpYyBtZXRob2RzIHRvIGFsbCB0aGUgY2xhc3NlcyByZWZlcmVuY2VkIGluIG1vZHVsZS5cbiAgbGV0IG5ld1N0YXRlbWVudHMgPSBzb3VyY2VGaWxlLnN0YXRlbWVudHMubWFwKG5vZGUgPT4ge1xuICAgIGlmIChub2RlLmtpbmQgPT0gdHMuU3ludGF4S2luZC5DbGFzc0RlY2xhcmF0aW9uKSB7XG4gICAgICBjb25zdCBjbGFzc0RlY2xhcmF0aW9uID0gbm9kZSBhcyB0cy5DbGFzc0RlY2xhcmF0aW9uO1xuICAgICAgY29uc3QgbmFtZSA9IGNsYXNzRGVjbGFyYXRpb24ubmFtZTtcbiAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgIGNvbnN0IGNsYXNzU3RhdGVtZW50ID0gY2xhc3NNYXAuZ2V0KG5hbWUudGV4dCk7XG4gICAgICAgIGlmIChjbGFzc1N0YXRlbWVudCkge1xuICAgICAgICAgIGNsYXNzTmFtZXMuZGVsZXRlKG5hbWUudGV4dCk7XG4gICAgICAgICAgY29uc3QgY2xhc3NNZW1iZXJIb2xkZXIgPVxuICAgICAgICAgICAgICBjb252ZXJ0ZXIudmlzaXREZWNsYXJlQ2xhc3NTdG10KGNsYXNzU3RhdGVtZW50KSBhcyB0cy5DbGFzc0RlY2xhcmF0aW9uO1xuICAgICAgICAgIGNvbnN0IG5ld01ldGhvZHMgPVxuICAgICAgICAgICAgICBjbGFzc01lbWJlckhvbGRlci5tZW1iZXJzLmZpbHRlcihtZW1iZXIgPT4gbWVtYmVyLmtpbmQgIT09IHRzLlN5bnRheEtpbmQuQ29uc3RydWN0b3IpO1xuICAgICAgICAgIGNvbnN0IG5ld01lbWJlcnMgPSBbLi4uY2xhc3NEZWNsYXJhdGlvbi5tZW1iZXJzLCAuLi5uZXdNZXRob2RzXTtcblxuICAgICAgICAgIHJldHVybiB0cy51cGRhdGVDbGFzc0RlY2xhcmF0aW9uKFxuICAgICAgICAgICAgICBjbGFzc0RlY2xhcmF0aW9uLFxuICAgICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIGNsYXNzRGVjbGFyYXRpb24uZGVjb3JhdG9ycyxcbiAgICAgICAgICAgICAgLyogbW9kaWZpZXJzICovIGNsYXNzRGVjbGFyYXRpb24ubW9kaWZpZXJzLFxuICAgICAgICAgICAgICAvKiBuYW1lICovIGNsYXNzRGVjbGFyYXRpb24ubmFtZSxcbiAgICAgICAgICAgICAgLyogdHlwZVBhcmFtZXRlcnMgKi8gY2xhc3NEZWNsYXJhdGlvbi50eXBlUGFyYW1ldGVycyxcbiAgICAgICAgICAgICAgLyogaGVyaXRhZ2VDbGF1c2VzICovIGNsYXNzRGVjbGFyYXRpb24uaGVyaXRhZ2VDbGF1c2VzIHx8IFtdLFxuICAgICAgICAgICAgICAvKiBtZW1iZXJzICovIG5ld01lbWJlcnMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9KTtcblxuICAvLyBWYWxpZGF0ZSB0aGF0IGFsbCB0aGUgY2xhc3NlcyBoYXZlIGJlZW4gZ2VuZXJhdGVkXG4gIGNsYXNzTmFtZXMuc2l6ZSA9PSAwIHx8XG4gICAgICBlcnJvcihgJHtjbGFzc05hbWVzLnNpemUgPT0gMSA/ICdDbGFzcycgOiAnQ2xhc3Nlcyd9IFwiJHtcbiAgICAgICAgICBBcnJheS5mcm9tKGNsYXNzTmFtZXMua2V5cygpKS5qb2luKCcsICcpfVwiIG5vdCBnZW5lcmF0ZWRgKTtcblxuICAvLyBBZGQgaW1wb3J0cyB0byB0aGUgbW9kdWxlIHJlcXVpcmVkIGJ5IHRoZSBuZXcgbWV0aG9kc1xuICBjb25zdCBpbXBvcnRzID0gY29udmVydGVyLmdldEltcG9ydHMoKTtcbiAgaWYgKGltcG9ydHMgJiYgaW1wb3J0cy5sZW5ndGgpIHtcbiAgICAvLyBGaW5kIHdoZXJlIHRoZSBuZXcgaW1wb3J0cyBzaG91bGQgZ29cbiAgICBjb25zdCBpbmRleCA9IGZpcnN0QWZ0ZXIoXG4gICAgICAgIG5ld1N0YXRlbWVudHMsXG4gICAgICAgIHN0YXRlbWVudCA9PiBzdGF0ZW1lbnQua2luZCA9PT0gdHMuU3ludGF4S2luZC5JbXBvcnREZWNsYXJhdGlvbiB8fFxuICAgICAgICAgICAgc3RhdGVtZW50LmtpbmQgPT09IHRzLlN5bnRheEtpbmQuSW1wb3J0RXF1YWxzRGVjbGFyYXRpb24pO1xuICAgIG5ld1N0YXRlbWVudHMgPVxuICAgICAgICBbLi4ubmV3U3RhdGVtZW50cy5zbGljZSgwLCBpbmRleCksIC4uLmltcG9ydHMsIC4uLnByZWZpeCwgLi4ubmV3U3RhdGVtZW50cy5zbGljZShpbmRleCldO1xuICB9IGVsc2Uge1xuICAgIG5ld1N0YXRlbWVudHMgPSBbLi4ucHJlZml4LCAuLi5uZXdTdGF0ZW1lbnRzXTtcbiAgfVxuXG4gIGNvbnZlcnRlci51cGRhdGVTb3VyY2VNYXAobmV3U3RhdGVtZW50cyk7XG4gIGNvbnN0IG5ld1NvdXJjZUZpbGUgPSB0cy51cGRhdGVTb3VyY2VGaWxlTm9kZShzb3VyY2VGaWxlLCBuZXdTdGF0ZW1lbnRzKTtcblxuICByZXR1cm4gW25ld1NvdXJjZUZpbGUsIGNvbnZlcnRlci5nZXROb2RlTWFwKCldO1xufVxuXG4vLyBSZXR1cm4gdGhlIGluZGV4IGFmdGVyIHRoZSBmaXJzdCB2YWx1ZSBpbiBgYWAgdGhhdCBkb2Vzbid0IG1hdGNoIHRoZSBwcmVkaWNhdGUgYWZ0ZXIgYSB2YWx1ZSB0aGF0XG4vLyBkb2VzIG9yIDAgaWYgbm8gdmFsdWVzIG1hdGNoLlxuZnVuY3Rpb24gZmlyc3RBZnRlcjxUPihhOiBUW10sIHByZWRpY2F0ZTogKHZhbHVlOiBUKSA9PiBib29sZWFuKSB7XG4gIGxldCBpbmRleCA9IDA7XG4gIGNvbnN0IGxlbiA9IGEubGVuZ3RoO1xuICBmb3IgKDsgaW5kZXggPCBsZW47IGluZGV4KyspIHtcbiAgICBjb25zdCB2YWx1ZSA9IGFbaW5kZXhdO1xuICAgIGlmIChwcmVkaWNhdGUodmFsdWUpKSBicmVhaztcbiAgfVxuICBpZiAoaW5kZXggPj0gbGVuKSByZXR1cm4gMDtcbiAgZm9yICg7IGluZGV4IDwgbGVuOyBpbmRleCsrKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhW2luZGV4XTtcbiAgICBpZiAoIXByZWRpY2F0ZSh2YWx1ZSkpIGJyZWFrO1xuICB9XG4gIHJldHVybiBpbmRleDtcbn1cblxuLy8gQSByZWNvcmRlZCBub2RlIGlzIGEgc3VidHlwZSBvZiB0aGUgbm9kZSB0aGF0IGlzIG1hcmtlZCBhcyBiZWluZyByZWNvcmRlZC4gVGhpcyBpcyB1c2VkXG4vLyB0byBlbnN1cmUgdGhhdCBOb2RlRW1pdHRlclZpc2l0b3IucmVjb3JkIGhhcyBiZWVuIGNhbGxlZCBvbiBhbGwgbm9kZXMgcmV0dXJuZWQgYnkgdGhlXG4vLyBOb2RlRW1pdHRlclZpc2l0b3JcbmV4cG9ydCB0eXBlIFJlY29yZGVkTm9kZTxUIGV4dGVuZHMgdHMuTm9kZSA9IHRzLk5vZGU+ID0gKFQme1xuICBfX3JlY29yZGVkOiBhbnk7XG59KXxudWxsO1xuXG5mdW5jdGlvbiBlc2NhcGVMaXRlcmFsKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWUucmVwbGFjZSgvKFxcXCJ8XFxcXCkvZywgJ1xcXFwkMScpLnJlcGxhY2UoLyhcXG4pfChcXHIpL2csIGZ1bmN0aW9uKHYsIG4sIHIpIHtcbiAgICByZXR1cm4gbiA/ICdcXFxcbicgOiAnXFxcXHInO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTGl0ZXJhbCh2YWx1ZTogYW55KSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cy5jcmVhdGVOdWxsKCk7XG4gIH0gZWxzZSBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKCd1bmRlZmluZWQnKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCByZXN1bHQgPSB0cy5jcmVhdGVMaXRlcmFsKHZhbHVlKTtcbiAgICBpZiAodHMuaXNTdHJpbmdMaXRlcmFsKHJlc3VsdCkgJiYgcmVzdWx0LnRleHQuaW5kZXhPZignXFxcXCcpID49IDApIHtcbiAgICAgIC8vIEhhY2sgdG8gYXZvaWQgcHJvYmxlbXMgY2F1c2UgaW5kaXJlY3RseSBieTpcbiAgICAgIC8vICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMjAxOTJcbiAgICAgIC8vIFRoaXMgYXZvaWRzIHRoZSBzdHJpbmcgZXNjYXBpbmcgbm9ybWFsbHkgcGVyZm9ybWVkIGZvciBhIHN0cmluZyByZWx5aW5nIG9uIHRoYXRcbiAgICAgIC8vIFR5cGVTY3JpcHQganVzdCBlbWl0cyB0aGUgdGV4dCByYXcgZm9yIGEgbnVtZXJpYyBsaXRlcmFsLlxuICAgICAgKHJlc3VsdCBhcyBhbnkpLmtpbmQgPSB0cy5TeW50YXhLaW5kLk51bWVyaWNMaXRlcmFsO1xuICAgICAgcmVzdWx0LnRleHQgPSBgXCIke2VzY2FwZUxpdGVyYWwocmVzdWx0LnRleHQpfVwiYDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0V4cG9ydFR5cGVTdGF0ZW1lbnQoc3RhdGVtZW50OiB0cy5TdGF0ZW1lbnQpOiBib29sZWFuIHtcbiAgcmV0dXJuICEhc3RhdGVtZW50Lm1vZGlmaWVycyAmJlxuICAgICAgc3RhdGVtZW50Lm1vZGlmaWVycy5zb21lKG1vZCA9PiBtb2Qua2luZCA9PT0gdHMuU3ludGF4S2luZC5FeHBvcnRLZXl3b3JkKTtcbn1cblxuLyoqXG4gKiBWaXNpdHMgYW4gb3V0cHV0IGFzdCBhbmQgcHJvZHVjZXMgdGhlIGNvcnJlc3BvbmRpbmcgVHlwZVNjcmlwdCBzeW50aGV0aWMgbm9kZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBOb2RlRW1pdHRlclZpc2l0b3IgaW1wbGVtZW50cyBTdGF0ZW1lbnRWaXNpdG9yLCBFeHByZXNzaW9uVmlzaXRvciB7XG4gIHByaXZhdGUgX25vZGVNYXAgPSBuZXcgTWFwPHRzLk5vZGUsIE5vZGU+KCk7XG4gIHByaXZhdGUgX2ltcG9ydHNXaXRoUHJlZml4ZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBwcml2YXRlIF9yZWV4cG9ydHMgPSBuZXcgTWFwPHN0cmluZywge25hbWU6IHN0cmluZywgYXM6IHN0cmluZ31bXT4oKTtcbiAgcHJpdmF0ZSBfdGVtcGxhdGVTb3VyY2VzID0gbmV3IE1hcDxQYXJzZVNvdXJjZUZpbGUsIHRzLlNvdXJjZU1hcFNvdXJjZT4oKTtcbiAgcHJpdmF0ZSBfZXhwb3J0ZWRWYXJpYWJsZUlkZW50aWZpZXJzID0gbmV3IE1hcDxzdHJpbmcsIHRzLklkZW50aWZpZXI+KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcjogYm9vbGVhbikge31cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgc291cmNlIGZpbGUgYW5kIGNvbGxlY3QgZXhwb3J0ZWQgaWRlbnRpZmllcnMgdGhhdCByZWZlciB0byB2YXJpYWJsZXMuXG4gICAqXG4gICAqIE9ubHkgdmFyaWFibGVzIGFyZSBjb2xsZWN0ZWQgYmVjYXVzZSBleHBvcnRlZCBjbGFzc2VzIHN0aWxsIGV4aXN0IGluIHRoZSBtb2R1bGUgc2NvcGUgaW5cbiAgICogQ29tbW9uSlMsIHdoZXJlYXMgdmFyaWFibGVzIGhhdmUgdGhlaXIgZGVjbGFyYXRpb25zIG1vdmVkIG9udG8gdGhlIGBleHBvcnRzYCBvYmplY3QsIGFuZCBhbGxcbiAgICogcmVmZXJlbmNlcyBhcmUgdXBkYXRlZCBhY2NvcmRpbmdseS5cbiAgICovXG4gIGxvYWRFeHBvcnRlZFZhcmlhYmxlSWRlbnRpZmllcnMoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IHZvaWQge1xuICAgIHNvdXJjZUZpbGUuc3RhdGVtZW50cy5mb3JFYWNoKHN0YXRlbWVudCA9PiB7XG4gICAgICBpZiAodHMuaXNWYXJpYWJsZVN0YXRlbWVudChzdGF0ZW1lbnQpICYmIGlzRXhwb3J0VHlwZVN0YXRlbWVudChzdGF0ZW1lbnQpKSB7XG4gICAgICAgIHN0YXRlbWVudC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zLmZvckVhY2goZGVjbGFyYXRpb24gPT4ge1xuICAgICAgICAgIGlmICh0cy5pc0lkZW50aWZpZXIoZGVjbGFyYXRpb24ubmFtZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2V4cG9ydGVkVmFyaWFibGVJZGVudGlmaWVycy5zZXQoZGVjbGFyYXRpb24ubmFtZS50ZXh0LCBkZWNsYXJhdGlvbi5uYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0UmVleHBvcnRzKCk6IHRzLlN0YXRlbWVudFtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9yZWV4cG9ydHMuZW50cmllcygpKVxuICAgICAgICAubWFwKFxuICAgICAgICAgICAgKFtleHBvcnRlZEZpbGVQYXRoLCByZWV4cG9ydHNdKSA9PiB0cy5jcmVhdGVFeHBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHRzLmNyZWF0ZU5hbWVkRXhwb3J0cyhcbiAgICAgICAgICAgICAgICAgICAgcmVleHBvcnRzLm1hcCgoe25hbWUsIGFzfSkgPT4gdHMuY3JlYXRlRXhwb3J0U3BlY2lmaWVyKG5hbWUsIGFzKSkpLFxuICAgICAgICAgICAgICAgIC8qIG1vZHVsZVNwZWNpZmllciAqLyBjcmVhdGVMaXRlcmFsKGV4cG9ydGVkRmlsZVBhdGgpKSk7XG4gIH1cblxuICBnZXRJbXBvcnRzKCk6IHRzLlN0YXRlbWVudFtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9pbXBvcnRzV2l0aFByZWZpeGVzLmVudHJpZXMoKSlcbiAgICAgICAgLm1hcChcbiAgICAgICAgICAgIChbbmFtZXNwYWNlLCBwcmVmaXhdKSA9PiB0cy5jcmVhdGVJbXBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIC8qIGltcG9ydENsYXVzZSAqL1xuICAgICAgICAgICAgICAgIHRzLmNyZWF0ZUltcG9ydENsYXVzZShcbiAgICAgICAgICAgICAgICAgICAgLyogbmFtZSAqLzx0cy5JZGVudGlmaWVyPih1bmRlZmluZWQgYXMgYW55KSxcbiAgICAgICAgICAgICAgICAgICAgdHMuY3JlYXRlTmFtZXNwYWNlSW1wb3J0KHRzLmNyZWF0ZUlkZW50aWZpZXIocHJlZml4KSkpLFxuICAgICAgICAgICAgICAgIC8qIG1vZHVsZVNwZWNpZmllciAqLyBjcmVhdGVMaXRlcmFsKG5hbWVzcGFjZSkpKTtcbiAgfVxuXG4gIGdldE5vZGVNYXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25vZGVNYXA7XG4gIH1cblxuICB1cGRhdGVTb3VyY2VNYXAoc3RhdGVtZW50czogdHMuU3RhdGVtZW50W10pIHtcbiAgICBsZXQgbGFzdFJhbmdlU3RhcnROb2RlOiB0cy5Ob2RlfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgbGFzdFJhbmdlRW5kTm9kZTogdHMuTm9kZXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgbGV0IGxhc3RSYW5nZTogdHMuU291cmNlTWFwUmFuZ2V8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgcmVjb3JkTGFzdFNvdXJjZVJhbmdlID0gKCkgPT4ge1xuICAgICAgaWYgKGxhc3RSYW5nZSAmJiBsYXN0UmFuZ2VTdGFydE5vZGUgJiYgbGFzdFJhbmdlRW5kTm9kZSkge1xuICAgICAgICBpZiAobGFzdFJhbmdlU3RhcnROb2RlID09IGxhc3RSYW5nZUVuZE5vZGUpIHtcbiAgICAgICAgICB0cy5zZXRTb3VyY2VNYXBSYW5nZShsYXN0UmFuZ2VFbmROb2RlLCBsYXN0UmFuZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRzLnNldFNvdXJjZU1hcFJhbmdlKGxhc3RSYW5nZVN0YXJ0Tm9kZSwgbGFzdFJhbmdlKTtcbiAgICAgICAgICAvLyBPbmx5IGVtaXQgdGhlIHBvcyBmb3IgdGhlIGZpcnN0IG5vZGUgZW1pdHRlZCBpbiB0aGUgcmFuZ2UuXG4gICAgICAgICAgdHMuc2V0RW1pdEZsYWdzKGxhc3RSYW5nZVN0YXJ0Tm9kZSwgdHMuRW1pdEZsYWdzLk5vVHJhaWxpbmdTb3VyY2VNYXApO1xuICAgICAgICAgIHRzLnNldFNvdXJjZU1hcFJhbmdlKGxhc3RSYW5nZUVuZE5vZGUsIGxhc3RSYW5nZSk7XG4gICAgICAgICAgLy8gT25seSBlbWl0IGVtaXQgZW5kIGZvciB0aGUgbGFzdCBub2RlIGVtaXR0ZWQgaW4gdGhlIHJhbmdlLlxuICAgICAgICAgIHRzLnNldEVtaXRGbGFncyhsYXN0UmFuZ2VFbmROb2RlLCB0cy5FbWl0RmxhZ3MuTm9MZWFkaW5nU291cmNlTWFwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCB2aXNpdE5vZGUgPSAodHNOb2RlOiB0cy5Ob2RlKSA9PiB7XG4gICAgICBjb25zdCBuZ05vZGUgPSB0aGlzLl9ub2RlTWFwLmdldCh0c05vZGUpO1xuICAgICAgaWYgKG5nTm9kZSkge1xuICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMuc291cmNlUmFuZ2VPZihuZ05vZGUpO1xuICAgICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgICBpZiAoIWxhc3RSYW5nZSB8fCByYW5nZS5zb3VyY2UgIT0gbGFzdFJhbmdlLnNvdXJjZSB8fCByYW5nZS5wb3MgIT0gbGFzdFJhbmdlLnBvcyB8fFxuICAgICAgICAgICAgICByYW5nZS5lbmQgIT0gbGFzdFJhbmdlLmVuZCkge1xuICAgICAgICAgICAgcmVjb3JkTGFzdFNvdXJjZVJhbmdlKCk7XG4gICAgICAgICAgICBsYXN0UmFuZ2VTdGFydE5vZGUgPSB0c05vZGU7XG4gICAgICAgICAgICBsYXN0UmFuZ2UgPSByYW5nZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGFzdFJhbmdlRW5kTm9kZSA9IHRzTm9kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdHMuZm9yRWFjaENoaWxkKHRzTm9kZSwgdmlzaXROb2RlKTtcbiAgICB9O1xuICAgIHN0YXRlbWVudHMuZm9yRWFjaCh2aXNpdE5vZGUpO1xuICAgIHJlY29yZExhc3RTb3VyY2VSYW5nZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBwb3N0UHJvY2VzczxUIGV4dGVuZHMgdHMuTm9kZT4obmdOb2RlOiBOb2RlLCB0c05vZGU6IFR8bnVsbCk6IFJlY29yZGVkTm9kZTxUPiB7XG4gICAgaWYgKHRzTm9kZSAmJiAhdGhpcy5fbm9kZU1hcC5oYXModHNOb2RlKSkge1xuICAgICAgdGhpcy5fbm9kZU1hcC5zZXQodHNOb2RlLCBuZ05vZGUpO1xuICAgIH1cbiAgICBpZiAodHNOb2RlICE9PSBudWxsICYmIG5nTm9kZSBpbnN0YW5jZW9mIFN0YXRlbWVudCAmJiBuZ05vZGUubGVhZGluZ0NvbW1lbnRzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGF0dGFjaENvbW1lbnRzKHRzTm9kZSBhcyB1bmtub3duIGFzIHRzLlN0YXRlbWVudCwgbmdOb2RlLmxlYWRpbmdDb21tZW50cyk7XG4gICAgfVxuICAgIHJldHVybiB0c05vZGUgYXMgUmVjb3JkZWROb2RlPFQ+O1xuICB9XG5cbiAgcHJpdmF0ZSBzb3VyY2VSYW5nZU9mKG5vZGU6IE5vZGUpOiB0cy5Tb3VyY2VNYXBSYW5nZXxudWxsIHtcbiAgICBpZiAobm9kZS5zb3VyY2VTcGFuKSB7XG4gICAgICBjb25zdCBzcGFuID0gbm9kZS5zb3VyY2VTcGFuO1xuICAgICAgaWYgKHNwYW4uc3RhcnQuZmlsZSA9PSBzcGFuLmVuZC5maWxlKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBzcGFuLnN0YXJ0LmZpbGU7XG4gICAgICAgIGlmIChmaWxlLnVybCkge1xuICAgICAgICAgIGxldCBzb3VyY2UgPSB0aGlzLl90ZW1wbGF0ZVNvdXJjZXMuZ2V0KGZpbGUpO1xuICAgICAgICAgIGlmICghc291cmNlKSB7XG4gICAgICAgICAgICBzb3VyY2UgPSB0cy5jcmVhdGVTb3VyY2VNYXBTb3VyY2UoZmlsZS51cmwsIGZpbGUuY29udGVudCwgcG9zID0+IHBvcyk7XG4gICAgICAgICAgICB0aGlzLl90ZW1wbGF0ZVNvdXJjZXMuc2V0KGZpbGUsIHNvdXJjZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7cG9zOiBzcGFuLnN0YXJ0Lm9mZnNldCwgZW5kOiBzcGFuLmVuZC5vZmZzZXQsIHNvdXJjZX07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGdldE1vZGlmaWVycyhzdG10OiBTdGF0ZW1lbnQpIHtcbiAgICBsZXQgbW9kaWZpZXJzOiB0cy5Nb2RpZmllcltdID0gW107XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgbW9kaWZpZXJzLnB1c2godHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5FeHBvcnRLZXl3b3JkKSk7XG4gICAgfVxuICAgIHJldHVybiBtb2RpZmllcnM7XG4gIH1cblxuICAvLyBTdGF0ZW1lbnRWaXNpdG9yXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogRGVjbGFyZVZhclN0bXQpIHtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihTdG10TW9kaWZpZXIuRXhwb3J0ZWQpICYmIHN0bXQudmFsdWUgaW5zdGFuY2VvZiBFeHRlcm5hbEV4cHIgJiZcbiAgICAgICAgIXN0bXQudHlwZSkge1xuICAgICAgLy8gY2hlY2sgZm9yIGEgcmVleHBvcnRcbiAgICAgIGNvbnN0IHtuYW1lLCBtb2R1bGVOYW1lfSA9IHN0bXQudmFsdWUudmFsdWU7XG4gICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICBsZXQgcmVleHBvcnRzID0gdGhpcy5fcmVleHBvcnRzLmdldChtb2R1bGVOYW1lKTtcbiAgICAgICAgaWYgKCFyZWV4cG9ydHMpIHtcbiAgICAgICAgICByZWV4cG9ydHMgPSBbXTtcbiAgICAgICAgICB0aGlzLl9yZWV4cG9ydHMuc2V0KG1vZHVsZU5hbWUsIHJlZXhwb3J0cyk7XG4gICAgICAgIH1cbiAgICAgICAgcmVleHBvcnRzLnB1c2goe25hbWU6IG5hbWUhLCBhczogc3RtdC5uYW1lfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHZhckRlY2xMaXN0ID0gdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbkxpc3QoW3RzLmNyZWF0ZVZhcmlhYmxlRGVjbGFyYXRpb24oXG4gICAgICAgIHRzLmNyZWF0ZUlkZW50aWZpZXIoc3RtdC5uYW1lKSxcbiAgICAgICAgLyogdHlwZSAqLyB1bmRlZmluZWQsXG4gICAgICAgIChzdG10LnZhbHVlICYmIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSB8fCB1bmRlZmluZWQpXSk7XG5cbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihTdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIGFkZCBhbiBleHBsaWNpdCB2YXJpYWJsZSBhbmQgZXhwb3J0IGRlY2xhcmF0aW9uIHNvIHRoYXRcbiAgICAgIC8vIHRoZSB2YXJpYWJsZSBjYW4gYmUgcmVmZXJyZWQgaW4gdGhlIHNhbWUgZmlsZSBhcyB3ZWxsLlxuICAgICAgY29uc3QgdHNWYXJTdG10ID1cbiAgICAgICAgICB0aGlzLnBvc3RQcm9jZXNzKHN0bXQsIHRzLmNyZWF0ZVZhcmlhYmxlU3RhdGVtZW50KC8qIG1vZGlmaWVycyAqL1tdLCB2YXJEZWNsTGlzdCkpO1xuICAgICAgY29uc3QgZXhwb3J0U3RtdCA9IHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgICAgc3RtdCxcbiAgICAgICAgICB0cy5jcmVhdGVFeHBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgLypkZWNvcmF0b3JzKi8gdW5kZWZpbmVkLCAvKm1vZGlmaWVycyovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgdHMuY3JlYXRlTmFtZWRFeHBvcnRzKFt0cy5jcmVhdGVFeHBvcnRTcGVjaWZpZXIoc3RtdC5uYW1lLCBzdG10Lm5hbWUpXSkpKTtcbiAgICAgIHJldHVybiBbdHNWYXJTdG10LCBleHBvcnRTdG10XTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3Moc3RtdCwgdHMuY3JlYXRlVmFyaWFibGVTdGF0ZW1lbnQodGhpcy5nZXRNb2RpZmllcnMoc3RtdCksIHZhckRlY2xMaXN0KSk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogRGVjbGFyZUZ1bmN0aW9uU3RtdCkge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBzdG10LFxuICAgICAgICB0cy5jcmVhdGVGdW5jdGlvbkRlY2xhcmF0aW9uKFxuICAgICAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsIHRoaXMuZ2V0TW9kaWZpZXJzKHN0bXQpLFxuICAgICAgICAgICAgLyogYXN0ZXJpc2tUb2tlbiAqLyB1bmRlZmluZWQsIHN0bXQubmFtZSwgLyogdHlwZVBhcmFtZXRlcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgc3RtdC5wYXJhbXMubWFwKFxuICAgICAgICAgICAgICAgIHAgPT4gdHMuY3JlYXRlUGFyYW1ldGVyKFxuICAgICAgICAgICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCwgLyogbW9kaWZpZXJzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgLyogZG90RG90RG90VG9rZW4gKi8gdW5kZWZpbmVkLCBwLm5hbWUpKSxcbiAgICAgICAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLCB0aGlzLl92aXNpdFN0YXRlbWVudHMoc3RtdC5zdGF0ZW1lbnRzKSkpO1xuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBFeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3Moc3RtdCwgdHMuY3JlYXRlU3RhdGVtZW50KHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCkpKTtcbiAgfVxuXG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBSZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhcbiAgICAgICAgc3RtdCwgdHMuY3JlYXRlUmV0dXJuKHN0bXQudmFsdWUgPyBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSA6IHVuZGVmaW5lZCkpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IENsYXNzU3RtdCkge1xuICAgIGNvbnN0IG1vZGlmaWVycyA9IHRoaXMuZ2V0TW9kaWZpZXJzKHN0bXQpO1xuICAgIGNvbnN0IGZpZWxkcyA9IHN0bXQuZmllbGRzLm1hcChmaWVsZCA9PiB7XG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IHRzLmNyZWF0ZVByb3BlcnR5KFxuICAgICAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLCAvKiBtb2RpZmllcnMgKi8gdHJhbnNsYXRlTW9kaWZpZXJzKGZpZWxkLm1vZGlmaWVycyksXG4gICAgICAgICAgZmllbGQubmFtZSxcbiAgICAgICAgICAvKiBxdWVzdGlvblRva2VuICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAvKiB0eXBlICovIHVuZGVmaW5lZCxcbiAgICAgICAgICBmaWVsZC5pbml0aWFsaXplciA9PSBudWxsID8gdHMuY3JlYXRlTnVsbCgpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQuaW5pdGlhbGl6ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKTtcblxuICAgICAgaWYgKHRoaXMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIpIHtcbiAgICAgICAgLy8gQ2xvc3VyZSBjb21waWxlciB0cmFuc2Zvcm1zIHRoZSBmb3JtIGBTZXJ2aWNlLsm1cHJvdiA9IFhgIGludG8gYFNlcnZpY2UkybVwcm92ID0gWGAuIFRvXG4gICAgICAgIC8vIHByZXZlbnQgdGhpcyB0cmFuc2Zvcm1hdGlvbiwgc3VjaCBhc3NpZ25tZW50cyBuZWVkIHRvIGJlIGFubm90YXRlZCB3aXRoIEBub2NvbGxhcHNlLlxuICAgICAgICAvLyBOb3RlIHRoYXQgdHNpY2tsZSBpcyB0eXBpY2FsbHkgcmVzcG9uc2libGUgZm9yIGFkZGluZyBzdWNoIGFubm90YXRpb25zLCBob3dldmVyIGl0XG4gICAgICAgIC8vIGRvZXNuJ3QgeWV0IGhhbmRsZSBzeW50aGV0aWMgZmllbGRzIGFkZGVkIGR1cmluZyBvdGhlciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICAgIHRzLmFkZFN5bnRoZXRpY0xlYWRpbmdDb21tZW50KFxuICAgICAgICAgICAgcHJvcGVydHksIHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSwgJyogQG5vY29sbGFwc2UgJyxcbiAgICAgICAgICAgIC8qIGhhc1RyYWlsaW5nTmV3TGluZSAqLyBmYWxzZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcm9wZXJ0eTtcbiAgICB9KTtcbiAgICBjb25zdCBnZXR0ZXJzID0gc3RtdC5nZXR0ZXJzLm1hcChcbiAgICAgICAgZ2V0dGVyID0+IHRzLmNyZWF0ZUdldEFjY2Vzc29yKFxuICAgICAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsIGdldHRlci5uYW1lLCAvKiBwYXJhbWV0ZXJzICovW10sXG4gICAgICAgICAgICAvKiB0eXBlICovIHVuZGVmaW5lZCwgdGhpcy5fdmlzaXRTdGF0ZW1lbnRzKGdldHRlci5ib2R5KSkpO1xuXG4gICAgY29uc3QgY29uc3RydWN0b3IgPVxuICAgICAgICAoc3RtdC5jb25zdHJ1Y3Rvck1ldGhvZCAmJiBbdHMuY3JlYXRlQ29uc3RydWN0b3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBwYXJhbWV0ZXJzICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG10LmNvbnN0cnVjdG9yTWV0aG9kLnBhcmFtcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcCA9PiB0cy5jcmVhdGVQYXJhbWV0ZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBkb3REb3REb3RUb2tlbiAqLyB1bmRlZmluZWQsIHAubmFtZSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fdmlzaXRTdGF0ZW1lbnRzKHN0bXQuY29uc3RydWN0b3JNZXRob2QuYm9keSkpXSkgfHxcbiAgICAgICAgW107XG5cbiAgICAvLyBUT0RPIHtjaHVja2p9OiBEZXRlcm1pbmUgd2hhdCBzaG91bGQgYmUgZG9uZSBmb3IgYSBtZXRob2Qgd2l0aCBhIG51bGwgbmFtZS5cbiAgICBjb25zdCBtZXRob2RzID0gc3RtdC5tZXRob2RzLmZpbHRlcihtZXRob2QgPT4gbWV0aG9kLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZCA9PiB0cy5jcmVhdGVNZXRob2QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGRlY29yYXRvcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdHJhbnNsYXRlTW9kaWZpZXJzKG1ldGhvZC5tb2RpZmllcnMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBhc3RyaXNrVG9rZW4gKi8gdW5kZWZpbmVkLCBtZXRob2QubmFtZSEvKiBndWFyZGVkIGJ5IGZpbHRlciAqLyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogcXVlc3Rpb25Ub2tlbiAqLyB1bmRlZmluZWQsIC8qIHR5cGVQYXJhbWV0ZXJzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kLnBhcmFtcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwID0+IHRzLmNyZWF0ZVBhcmFtZXRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCwgLyogbW9kaWZpZXJzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBkb3REb3REb3RUb2tlbiAqLyB1bmRlZmluZWQsIHAubmFtZSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiB0eXBlICovIHVuZGVmaW5lZCwgdGhpcy5fdmlzaXRTdGF0ZW1lbnRzKG1ldGhvZC5ib2R5KSkpO1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBzdG10LFxuICAgICAgICB0cy5jcmVhdGVDbGFzc0RlY2xhcmF0aW9uKFxuICAgICAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsIG1vZGlmaWVycywgc3RtdC5uYW1lLCAvKiB0eXBlUGFyYW1ldGVycyovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHN0bXQucGFyZW50ICYmXG4gICAgICAgICAgICAgICAgICAgIFt0cy5jcmVhdGVIZXJpdGFnZUNsYXVzZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHRzLlN5bnRheEtpbmQuRXh0ZW5kc0tleXdvcmQsIFtzdG10LnBhcmVudC52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCldKV0gfHxcbiAgICAgICAgICAgICAgICBbXSxcbiAgICAgICAgICAgIFsuLi5maWVsZHMsIC4uLmdldHRlcnMsIC4uLmNvbnN0cnVjdG9yLCAuLi5tZXRob2RzXSkpO1xuICB9XG5cbiAgdmlzaXRJZlN0bXQoc3RtdDogSWZTdG10KSB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgIHN0bXQsXG4gICAgICAgIHRzLmNyZWF0ZUlmKFxuICAgICAgICAgICAgc3RtdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpLCB0aGlzLl92aXNpdFN0YXRlbWVudHMoc3RtdC50cnVlQ2FzZSksXG4gICAgICAgICAgICBzdG10LmZhbHNlQ2FzZSAmJiBzdG10LmZhbHNlQ2FzZS5sZW5ndGggJiYgdGhpcy5fdmlzaXRTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlKSB8fFxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZCkpO1xuICB9XG5cbiAgdmlzaXRUcnlDYXRjaFN0bXQoc3RtdDogVHJ5Q2F0Y2hTdG10KTogUmVjb3JkZWROb2RlPHRzLlRyeVN0YXRlbWVudD4ge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBzdG10LFxuICAgICAgICB0cy5jcmVhdGVUcnkoXG4gICAgICAgICAgICB0aGlzLl92aXNpdFN0YXRlbWVudHMoc3RtdC5ib2R5U3RtdHMpLFxuICAgICAgICAgICAgdHMuY3JlYXRlQ2F0Y2hDbGF1c2UoXG4gICAgICAgICAgICAgICAgQ0FUQ0hfRVJST1JfTkFNRSxcbiAgICAgICAgICAgICAgICB0aGlzLl92aXNpdFN0YXRlbWVudHNQcmVmaXgoXG4gICAgICAgICAgICAgICAgICAgIFt0cy5jcmVhdGVWYXJpYWJsZVN0YXRlbWVudChcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBbdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBDQVRDSF9TVEFDS19OQU1FLCAvKiB0eXBlICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuY3JlYXRlSWRlbnRpZmllcihDQVRDSF9FUlJPUl9OQU1FKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuY3JlYXRlSWRlbnRpZmllcihDQVRDSF9TVEFDS19OQU1FKSkpXSldLFxuICAgICAgICAgICAgICAgICAgICBzdG10LmNhdGNoU3RtdHMpKSxcbiAgICAgICAgICAgIC8qIGZpbmFsbHlCbG9jayAqLyB1bmRlZmluZWQpKTtcbiAgfVxuXG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IFRocm93U3RtdCkge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKHN0bXQsIHRzLmNyZWF0ZVRocm93KHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSk7XG4gIH1cblxuICAvLyBFeHByZXNzaW9uVmlzaXRvclxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihleHByOiBXcmFwcGVkTm9kZUV4cHI8YW55Pikge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKGV4cHIsIGV4cHIubm9kZSk7XG4gIH1cblxuICB2aXNpdFR5cGVvZkV4cHIoZXhwcjogVHlwZW9mRXhwcikge1xuICAgIGNvbnN0IHR5cGVPZiA9IHRzLmNyZWF0ZVR5cGVPZihleHByLmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKTtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhleHByLCB0eXBlT2YpO1xuICB9XG5cbiAgLy8gRXhwcmVzc2lvblZpc2l0b3JcbiAgdmlzaXRSZWFkVmFyRXhwcihleHByOiBSZWFkVmFyRXhwcikge1xuICAgIHN3aXRjaCAoZXhwci5idWlsdGluKSB7XG4gICAgICBjYXNlIEJ1aWx0aW5WYXIuVGhpczpcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoZXhwciwgdHMuY3JlYXRlSWRlbnRpZmllcihNRVRIT0RfVEhJU19OQU1FKSk7XG4gICAgICBjYXNlIEJ1aWx0aW5WYXIuQ2F0Y2hFcnJvcjpcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoZXhwciwgdHMuY3JlYXRlSWRlbnRpZmllcihDQVRDSF9FUlJPUl9OQU1FKSk7XG4gICAgICBjYXNlIEJ1aWx0aW5WYXIuQ2F0Y2hTdGFjazpcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoZXhwciwgdHMuY3JlYXRlSWRlbnRpZmllcihDQVRDSF9TVEFDS19OQU1FKSk7XG4gICAgICBjYXNlIEJ1aWx0aW5WYXIuU3VwZXI6XG4gICAgICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKGV4cHIsIHRzLmNyZWF0ZVN1cGVyKCkpO1xuICAgIH1cbiAgICBpZiAoZXhwci5uYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhleHByLCB0cy5jcmVhdGVJZGVudGlmaWVyKGV4cHIubmFtZSkpO1xuICAgIH1cbiAgICB0aHJvdyBFcnJvcihgVW5leHBlY3RlZCBSZWFkVmFyRXhwciBmb3JtYCk7XG4gIH1cblxuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBXcml0ZVZhckV4cHIpOiBSZWNvcmRlZE5vZGU8dHMuQmluYXJ5RXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBleHByLFxuICAgICAgICB0cy5jcmVhdGVBc3NpZ25tZW50KFxuICAgICAgICAgICAgdHMuY3JlYXRlSWRlbnRpZmllcihleHByLm5hbWUpLCBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSkpO1xuICB9XG5cbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogV3JpdGVLZXlFeHByKTogUmVjb3JkZWROb2RlPHRzLkJpbmFyeUV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhcbiAgICAgICAgZXhwcixcbiAgICAgICAgdHMuY3JlYXRlQXNzaWdubWVudChcbiAgICAgICAgICAgIHRzLmNyZWF0ZUVsZW1lbnRBY2Nlc3MoXG4gICAgICAgICAgICAgICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCksIGV4cHIuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSxcbiAgICAgICAgICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSk7XG4gIH1cblxuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogV3JpdGVQcm9wRXhwcik6IFJlY29yZGVkTm9kZTx0cy5CaW5hcnlFeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgIGV4cHIsXG4gICAgICAgIHRzLmNyZWF0ZUFzc2lnbm1lbnQoXG4gICAgICAgICAgICB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSwgZXhwci5uYW1lKSxcbiAgICAgICAgICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSk7XG4gIH1cblxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoZXhwcjogSW52b2tlTWV0aG9kRXhwcik6IFJlY29yZGVkTm9kZTx0cy5DYWxsRXhwcmVzc2lvbj4ge1xuICAgIGNvbnN0IG1ldGhvZE5hbWUgPSBnZXRNZXRob2ROYW1lKGV4cHIpO1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBleHByLFxuICAgICAgICB0cy5jcmVhdGVDYWxsKFxuICAgICAgICAgICAgdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCksIG1ldGhvZE5hbWUpLFxuICAgICAgICAgICAgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsIGV4cHIuYXJncy5tYXAoYXJnID0+IGFyZy52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCkpKSk7XG4gIH1cblxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihleHByOiBJbnZva2VGdW5jdGlvbkV4cHIpOiBSZWNvcmRlZE5vZGU8dHMuQ2FsbEV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhcbiAgICAgICAgZXhwcixcbiAgICAgICAgdHMuY3JlYXRlQ2FsbChcbiAgICAgICAgICAgIGV4cHIuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpLCAvKiB0eXBlQXJndW1lbnRzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGV4cHIuYXJncy5tYXAoYXJnID0+IGFyZy52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCkpKSk7XG4gIH1cblxuICB2aXNpdFRhZ2dlZFRlbXBsYXRlRXhwcihleHByOiBUYWdnZWRUZW1wbGF0ZUV4cHIpOiBSZWNvcmRlZE5vZGU8dHMuVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uPiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YWdnZWQgdGVtcGxhdGVzIGFyZSBub3Qgc3VwcG9ydGVkIGluIHByZS1pdnkgbW9kZS4nKTtcbiAgfVxuXG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGV4cHI6IEluc3RhbnRpYXRlRXhwcik6IFJlY29yZGVkTm9kZTx0cy5OZXdFeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgIGV4cHIsXG4gICAgICAgIHRzLmNyZWF0ZU5ldyhcbiAgICAgICAgICAgIGV4cHIuY2xhc3NFeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSwgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICBleHByLmFyZ3MubWFwKGFyZyA9PiBhcmcudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsRXhwcihleHByOiBMaXRlcmFsRXhwcikge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKGV4cHIsIGNyZWF0ZUxpdGVyYWwoZXhwci52YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoZXhwcjogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2xvY2FsaXplZCBzdHJpbmdzIGFyZSBub3Qgc3VwcG9ydGVkIGluIHByZS1pdnkgbW9kZS4nKTtcbiAgfVxuXG4gIHZpc2l0RXh0ZXJuYWxFeHByKGV4cHI6IEV4dGVybmFsRXhwcikge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKGV4cHIsIHRoaXMuX3Zpc2l0SWRlbnRpZmllcihleHByLnZhbHVlKSk7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsRXhwcihleHByOiBDb25kaXRpb25hbEV4cHIpOiBSZWNvcmRlZE5vZGU8dHMuUGFyZW50aGVzaXplZEV4cHJlc3Npb24+IHtcbiAgICAvLyBUT0RPIHtjaHVja2p9OiBSZXZpZXcgdXNlIG9mICEgb24gZmFsc2VDYXNlLiBTaG91bGQgaXQgYmUgbm9uLW51bGxhYmxlP1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBleHByLFxuICAgICAgICB0cy5jcmVhdGVQYXJlbih0cy5jcmVhdGVDb25kaXRpb25hbChcbiAgICAgICAgICAgIGV4cHIuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSwgZXhwci50cnVlQ2FzZS52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCksXG4gICAgICAgICAgICBleHByLmZhbHNlQ2FzZSEudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSkpO1xuICB9XG5cbiAgdmlzaXROb3RFeHByKGV4cHI6IE5vdEV4cHIpOiBSZWNvcmRlZE5vZGU8dHMuUHJlZml4VW5hcnlFeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgIGV4cHIsXG4gICAgICAgIHRzLmNyZWF0ZVByZWZpeChcbiAgICAgICAgICAgIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25Ub2tlbiwgZXhwci5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSk7XG4gIH1cblxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGV4cHI6IEFzc2VydE5vdE51bGwpOiBSZWNvcmRlZE5vZGU8dHMuRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiBleHByLmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCk7XG4gIH1cblxuICB2aXNpdENhc3RFeHByKGV4cHI6IENhc3RFeHByKTogUmVjb3JkZWROb2RlPHRzLkV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCk7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uRXhwcihleHByOiBGdW5jdGlvbkV4cHIpIHtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhcbiAgICAgICAgZXhwcixcbiAgICAgICAgdHMuY3JlYXRlRnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgICAgLyogbW9kaWZpZXJzICovIHVuZGVmaW5lZCwgLyogYXN0cmlza1Rva2VuICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIG5hbWUgKi8gZXhwci5uYW1lIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGV4cHIucGFyYW1zLm1hcChcbiAgICAgICAgICAgICAgICBwID0+IHRzLmNyZWF0ZVBhcmFtZXRlcihcbiAgICAgICAgICAgICAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIC8qIGRvdERvdERvdFRva2VuICovIHVuZGVmaW5lZCwgcC5uYW1lKSksXG4gICAgICAgICAgICAvKiB0eXBlICovIHVuZGVmaW5lZCwgdGhpcy5fdmlzaXRTdGF0ZW1lbnRzKGV4cHIuc3RhdGVtZW50cykpKTtcbiAgfVxuXG4gIHZpc2l0VW5hcnlPcGVyYXRvckV4cHIoZXhwcjogVW5hcnlPcGVyYXRvckV4cHIpOlxuICAgICAgUmVjb3JkZWROb2RlPHRzLlVuYXJ5RXhwcmVzc2lvbnx0cy5QYXJlbnRoZXNpemVkRXhwcmVzc2lvbj4ge1xuICAgIGxldCB1bmFyeU9wZXJhdG9yOiB0cy5CaW5hcnlPcGVyYXRvcjtcbiAgICBzd2l0Y2ggKGV4cHIub3BlcmF0b3IpIHtcbiAgICAgIGNhc2UgVW5hcnlPcGVyYXRvci5NaW51czpcbiAgICAgICAgdW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuTWludXNUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFVuYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgdW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuUGx1c1Rva2VuO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRvcjogJHtleHByLm9wZXJhdG9yfWApO1xuICAgIH1cbiAgICBjb25zdCBiaW5hcnkgPSB0cy5jcmVhdGVQcmVmaXgodW5hcnlPcGVyYXRvciwgZXhwci5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSk7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoZXhwciwgZXhwci5wYXJlbnMgPyB0cy5jcmVhdGVQYXJlbihiaW5hcnkpIDogYmluYXJ5KTtcbiAgfVxuXG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGV4cHI6IEJpbmFyeU9wZXJhdG9yRXhwcik6XG4gICAgICBSZWNvcmRlZE5vZGU8dHMuQmluYXJ5RXhwcmVzc2lvbnx0cy5QYXJlbnRoZXNpemVkRXhwcmVzc2lvbj4ge1xuICAgIGxldCBiaW5hcnlPcGVyYXRvcjogdHMuQmluYXJ5T3BlcmF0b3I7XG4gICAgc3dpdGNoIChleHByLm9wZXJhdG9yKSB7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLkFuZDpcbiAgICAgICAgYmluYXJ5T3BlcmF0b3IgPSB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZEFtcGVyc2FuZFRva2VuO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZDpcbiAgICAgICAgYmluYXJ5T3BlcmF0b3IgPSB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZFRva2VuO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluYXJ5T3BlcmF0b3IuQmlnZ2VyOlxuICAgICAgICBiaW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuR3JlYXRlclRoYW5Ub2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFsczpcbiAgICAgICAgYmluYXJ5T3BlcmF0b3IgPSB0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuRXF1YWxzVG9rZW47XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5hcnlPcGVyYXRvci5EaXZpZGU6XG4gICAgICAgIGJpbmFyeU9wZXJhdG9yID0gdHMuU3ludGF4S2luZC5TbGFzaFRva2VuO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluYXJ5T3BlcmF0b3IuRXF1YWxzOlxuICAgICAgICBiaW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzVG9rZW47XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5hcnlPcGVyYXRvci5JZGVudGljYWw6XG4gICAgICAgIGJpbmFyeU9wZXJhdG9yID0gdHMuU3ludGF4S2luZC5FcXVhbHNFcXVhbHNFcXVhbHNUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLkxvd2VyOlxuICAgICAgICBiaW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuTGVzc1RoYW5Ub2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzOlxuICAgICAgICBiaW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuTGVzc1RoYW5FcXVhbHNUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLk1pbnVzOlxuICAgICAgICBiaW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuTWludXNUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLk1vZHVsbzpcbiAgICAgICAgYmluYXJ5T3BlcmF0b3IgPSB0cy5TeW50YXhLaW5kLlBlcmNlbnRUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLk11bHRpcGx5OlxuICAgICAgICBiaW5hcnlPcGVyYXRvciA9IHRzLlN5bnRheEtpbmQuQXN0ZXJpc2tUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLk5vdEVxdWFsczpcbiAgICAgICAgYmluYXJ5T3BlcmF0b3IgPSB0cy5TeW50YXhLaW5kLkV4Y2xhbWF0aW9uRXF1YWxzVG9rZW47XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw6XG4gICAgICAgIGJpbmFyeU9wZXJhdG9yID0gdHMuU3ludGF4S2luZC5FeGNsYW1hdGlvbkVxdWFsc0VxdWFsc1Rva2VuO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQmluYXJ5T3BlcmF0b3IuT3I6XG4gICAgICAgIGJpbmFyeU9wZXJhdG9yID0gdHMuU3ludGF4S2luZC5CYXJCYXJUb2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLk51bGxpc2hDb2FsZXNjZTpcbiAgICAgICAgYmluYXJ5T3BlcmF0b3IgPSB0cy5TeW50YXhLaW5kLlF1ZXN0aW9uUXVlc3Rpb25Ub2tlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJpbmFyeU9wZXJhdG9yLlBsdXM6XG4gICAgICAgIGJpbmFyeU9wZXJhdG9yID0gdHMuU3ludGF4S2luZC5QbHVzVG9rZW47XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdG9yOiAke2V4cHIub3BlcmF0b3J9YCk7XG4gICAgfVxuICAgIGNvbnN0IGJpbmFyeSA9IHRzLmNyZWF0ZUJpbmFyeShcbiAgICAgICAgZXhwci5saHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpLCBiaW5hcnlPcGVyYXRvciwgZXhwci5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKTtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhleHByLCBleHByLnBhcmVucyA/IHRzLmNyZWF0ZVBhcmVuKGJpbmFyeSkgOiBiaW5hcnkpO1xuICB9XG5cbiAgdmlzaXRSZWFkUHJvcEV4cHIoZXhwcjogUmVhZFByb3BFeHByKTogUmVjb3JkZWROb2RlPHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBleHByLCB0cy5jcmVhdGVQcm9wZXJ0eUFjY2VzcyhleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSwgZXhwci5uYW1lKSk7XG4gIH1cblxuICB2aXNpdFJlYWRLZXlFeHByKGV4cHI6IFJlYWRLZXlFeHByKTogUmVjb3JkZWROb2RlPHRzLkVsZW1lbnRBY2Nlc3NFeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgIGV4cHIsXG4gICAgICAgIHRzLmNyZWF0ZUVsZW1lbnRBY2Nlc3MoXG4gICAgICAgICAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBudWxsKSwgZXhwci5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCkpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihleHByOiBMaXRlcmFsQXJyYXlFeHByKTogUmVjb3JkZWROb2RlPHRzLkFycmF5TGl0ZXJhbEV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gdGhpcy5wb3N0UHJvY2VzcyhcbiAgICAgICAgZXhwciwgdHMuY3JlYXRlQXJyYXlMaXRlcmFsKGV4cHIuZW50cmllcy5tYXAoZW50cnkgPT4gZW50cnkudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihleHByOiBMaXRlcmFsTWFwRXhwcik6IFJlY29yZGVkTm9kZTx0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiB0aGlzLnBvc3RQcm9jZXNzKFxuICAgICAgICBleHByLFxuICAgICAgICB0cy5jcmVhdGVPYmplY3RMaXRlcmFsKGV4cHIuZW50cmllcy5tYXAoXG4gICAgICAgICAgICBlbnRyeSA9PiB0cy5jcmVhdGVQcm9wZXJ0eUFzc2lnbm1lbnQoXG4gICAgICAgICAgICAgICAgZW50cnkucXVvdGVkIHx8ICFfVkFMSURfSURFTlRJRklFUl9SRS50ZXN0KGVudHJ5LmtleSkgP1xuICAgICAgICAgICAgICAgICAgICB0cy5jcmVhdGVMaXRlcmFsKGVudHJ5LmtleSkgOlxuICAgICAgICAgICAgICAgICAgICBlbnRyeS5rZXksXG4gICAgICAgICAgICAgICAgZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIG51bGwpKSkpKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWFFeHByKGV4cHI6IENvbW1hRXhwcik6IFJlY29yZGVkTm9kZTx0cy5FeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMucG9zdFByb2Nlc3MoXG4gICAgICAgIGV4cHIsXG4gICAgICAgIGV4cHIucGFydHMubWFwKGUgPT4gZS52aXNpdEV4cHJlc3Npb24odGhpcywgbnVsbCkpXG4gICAgICAgICAgICAucmVkdWNlPHRzLkV4cHJlc3Npb258bnVsbD4oXG4gICAgICAgICAgICAgICAgKGxlZnQsIHJpZ2h0KSA9PlxuICAgICAgICAgICAgICAgICAgICBsZWZ0ID8gdHMuY3JlYXRlQmluYXJ5KGxlZnQsIHRzLlN5bnRheEtpbmQuQ29tbWFUb2tlbiwgcmlnaHQpIDogcmlnaHQsXG4gICAgICAgICAgICAgICAgbnVsbCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRTdGF0ZW1lbnRzKHN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogdHMuQmxvY2sge1xuICAgIHJldHVybiB0aGlzLl92aXNpdFN0YXRlbWVudHNQcmVmaXgoW10sIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRTdGF0ZW1lbnRzUHJlZml4KHByZWZpeDogdHMuU3RhdGVtZW50W10sIHN0YXRlbWVudHM6IFN0YXRlbWVudFtdKSB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZUJsb2NrKFtcbiAgICAgIC4uLnByZWZpeCwgLi4uc3RhdGVtZW50cy5tYXAoc3RtdCA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIG51bGwpKS5maWx0ZXIoZiA9PiBmICE9IG51bGwpXG4gICAgXSk7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdElkZW50aWZpZXIodmFsdWU6IEV4dGVybmFsUmVmZXJlbmNlKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgLy8gbmFtZSBjYW4gb25seSBiZSBudWxsIGR1cmluZyBKSVQgd2hpY2ggbmV2ZXIgZXhlY3V0ZXMgdGhpcyBjb2RlLlxuICAgIGNvbnN0IG1vZHVsZU5hbWUgPSB2YWx1ZS5tb2R1bGVOYW1lLCBuYW1lID0gdmFsdWUubmFtZSE7XG4gICAgbGV0IHByZWZpeElkZW50OiB0cy5JZGVudGlmaWVyfG51bGwgPSBudWxsO1xuICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICBsZXQgcHJlZml4ID0gdGhpcy5faW1wb3J0c1dpdGhQcmVmaXhlcy5nZXQobW9kdWxlTmFtZSk7XG4gICAgICBpZiAocHJlZml4ID09IG51bGwpIHtcbiAgICAgICAgcHJlZml4ID0gYGkke3RoaXMuX2ltcG9ydHNXaXRoUHJlZml4ZXMuc2l6ZX1gO1xuICAgICAgICB0aGlzLl9pbXBvcnRzV2l0aFByZWZpeGVzLnNldChtb2R1bGVOYW1lLCBwcmVmaXgpO1xuICAgICAgfVxuICAgICAgcHJlZml4SWRlbnQgPSB0cy5jcmVhdGVJZGVudGlmaWVyKHByZWZpeCk7XG4gICAgfVxuICAgIGlmIChwcmVmaXhJZGVudCkge1xuICAgICAgcmV0dXJuIHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHByZWZpeElkZW50LCBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaWQgPSB0cy5jcmVhdGVJZGVudGlmaWVyKG5hbWUpO1xuICAgICAgaWYgKHRoaXMuX2V4cG9ydGVkVmFyaWFibGVJZGVudGlmaWVycy5oYXMobmFtZSkpIHtcbiAgICAgICAgLy8gSW4gb3JkZXIgZm9yIHRoaXMgbmV3IGlkZW50aWZpZXIgbm9kZSB0byBiZSBwcm9wZXJseSByZXdyaXR0ZW4gaW4gQ29tbW9uSlMgb3V0cHV0LFxuICAgICAgICAvLyBpdCBtdXN0IGhhdmUgaXRzIG9yaWdpbmFsIG5vZGUgc2V0IHRvIGEgcGFyc2VkIGluc3RhbmNlIG9mIHRoZSBzYW1lIGlkZW50aWZpZXIuXG4gICAgICAgIHRzLnNldE9yaWdpbmFsTm9kZShpZCwgdGhpcy5fZXhwb3J0ZWRWYXJpYWJsZUlkZW50aWZpZXJzLmdldChuYW1lKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaWQ7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldE1ldGhvZE5hbWUobWV0aG9kUmVmOiB7bmFtZTogc3RyaW5nfG51bGw7IGJ1aWx0aW46IEJ1aWx0aW5NZXRob2QgfCBudWxsfSk6IHN0cmluZyB7XG4gIGlmIChtZXRob2RSZWYubmFtZSkge1xuICAgIHJldHVybiBtZXRob2RSZWYubmFtZTtcbiAgfSBlbHNlIHtcbiAgICBzd2l0Y2ggKG1ldGhvZFJlZi5idWlsdGluKSB7XG4gICAgICBjYXNlIEJ1aWx0aW5NZXRob2QuQmluZDpcbiAgICAgICAgcmV0dXJuICdiaW5kJztcbiAgICAgIGNhc2UgQnVpbHRpbk1ldGhvZC5Db25jYXRBcnJheTpcbiAgICAgICAgcmV0dXJuICdjb25jYXQnO1xuICAgICAgY2FzZSBCdWlsdGluTWV0aG9kLlN1YnNjcmliZU9ic2VydmFibGU6XG4gICAgICAgIHJldHVybiAnc3Vic2NyaWJlJztcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG1ldGhvZCByZWZlcmVuY2UgZm9ybScpO1xufVxuXG5mdW5jdGlvbiBtb2RpZmllckZyb21Nb2RpZmllcihtb2RpZmllcjogU3RtdE1vZGlmaWVyKTogdHMuTW9kaWZpZXIge1xuICBzd2l0Y2ggKG1vZGlmaWVyKSB7XG4gICAgY2FzZSBTdG10TW9kaWZpZXIuRXhwb3J0ZWQ6XG4gICAgICByZXR1cm4gdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5FeHBvcnRLZXl3b3JkKTtcbiAgICBjYXNlIFN0bXRNb2RpZmllci5GaW5hbDpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVUb2tlbih0cy5TeW50YXhLaW5kLkNvbnN0S2V5d29yZCk7XG4gICAgY2FzZSBTdG10TW9kaWZpZXIuUHJpdmF0ZTpcbiAgICAgIHJldHVybiB0cy5jcmVhdGVUb2tlbih0cy5TeW50YXhLaW5kLlByaXZhdGVLZXl3b3JkKTtcbiAgICBjYXNlIFN0bXRNb2RpZmllci5TdGF0aWM6XG4gICAgICByZXR1cm4gdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2xhdGVNb2RpZmllcnMobW9kaWZpZXJzOiBTdG10TW9kaWZpZXJbXXxudWxsKTogdHMuTW9kaWZpZXJbXXx1bmRlZmluZWQge1xuICByZXR1cm4gbW9kaWZpZXJzID09IG51bGwgPyB1bmRlZmluZWQgOiBtb2RpZmllcnMhLm1hcChtb2RpZmllckZyb21Nb2RpZmllcik7XG59XG4iXX0=