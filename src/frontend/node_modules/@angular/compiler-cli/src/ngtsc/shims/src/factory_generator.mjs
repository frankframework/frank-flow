/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { absoluteFromSourceFile, basename } from '../../file_system';
import { generatedModuleName } from './util';
const TS_DTS_SUFFIX = /(\.d)?\.ts$/;
const STRIP_NG_FACTORY = /(.*)NgFactory$/;
/**
 * Generates ts.SourceFiles which contain variable declarations for NgFactories for every exported
 * class of an input ts.SourceFile.
 */
export class FactoryGenerator {
    constructor() {
        this.sourceInfo = new Map();
        this.sourceToFactorySymbols = new Map();
        this.shouldEmit = true;
        this.extensionPrefix = 'ngfactory';
    }
    generateShimForFile(sf, genFilePath) {
        const absoluteSfPath = absoluteFromSourceFile(sf);
        const relativePathToSource = './' + basename(sf.fileName).replace(TS_DTS_SUFFIX, '');
        // Collect a list of classes that need to have factory types emitted for them. This list is
        // overly broad as at this point the ts.TypeChecker hasn't been created, and can't be used to
        // semantically understand which decorated types are actually decorated with Angular decorators.
        //
        // The exports generated here are pruned in the factory transform during emit.
        const symbolNames = sf.statements
            // Pick out top level class declarations...
            .filter(ts.isClassDeclaration)
            // which are named, exported, and have decorators.
            .filter(decl => isExported(decl) && decl.decorators !== undefined &&
            decl.name !== undefined)
            // Grab the symbol name.
            .map(decl => decl.name.text);
        let sourceText = '';
        // If there is a top-level comment in the original file, copy it over at the top of the
        // generated factory file. This is important for preserving any load-bearing jsdoc comments.
        const leadingComment = getFileoverviewComment(sf);
        if (leadingComment !== null) {
            // Leading comments must be separated from the rest of the contents by a blank line.
            sourceText = leadingComment + '\n\n';
        }
        if (symbolNames.length > 0) {
            // For each symbol name, generate a constant export of the corresponding NgFactory.
            // This will encompass a lot of symbols which don't need factories, but that's okay
            // because it won't miss any that do.
            const varLines = symbolNames.map(name => `export const ${name}NgFactory: i0.ɵNgModuleFactory<any> = new i0.ɵNgModuleFactory(${name});`);
            sourceText += [
                // This might be incorrect if the current package being compiled is Angular core, but it's
                // okay to leave in at type checking time. TypeScript can handle this reference via its path
                // mapping, but downstream bundlers can't. If the current package is core itself, this will
                // be replaced in the factory transformer before emit.
                `import * as i0 from '@angular/core';`,
                `import {${symbolNames.join(', ')}} from '${relativePathToSource}';`,
                ...varLines,
            ].join('\n');
        }
        // Add an extra export to ensure this module has at least one. It'll be removed later in the
        // factory transformer if it ends up not being needed.
        sourceText += '\nexport const ɵNonEmptyModule = true;';
        const genFile = ts.createSourceFile(genFilePath, sourceText, sf.languageVersion, true, ts.ScriptKind.TS);
        if (sf.moduleName !== undefined) {
            genFile.moduleName = generatedModuleName(sf.moduleName, sf.fileName, '.ngfactory');
        }
        const moduleSymbols = new Map();
        this.sourceToFactorySymbols.set(absoluteSfPath, moduleSymbols);
        this.sourceInfo.set(genFilePath, {
            sourceFilePath: absoluteSfPath,
            moduleSymbols,
        });
        return genFile;
    }
    track(sf, moduleInfo) {
        if (this.sourceToFactorySymbols.has(sf.fileName)) {
            this.sourceToFactorySymbols.get(sf.fileName).set(moduleInfo.name, moduleInfo);
        }
    }
}
function isExported(decl) {
    return decl.modifiers !== undefined &&
        decl.modifiers.some(mod => mod.kind == ts.SyntaxKind.ExportKeyword);
}
export function generatedFactoryTransform(factoryMap, importRewriter) {
    return (context) => {
        return (file) => {
            return transformFactorySourceFile(factoryMap, context, importRewriter, file);
        };
    };
}
function transformFactorySourceFile(factoryMap, context, importRewriter, file) {
    // If this is not a generated file, it won't have factory info associated with it.
    if (!factoryMap.has(file.fileName)) {
        // Don't transform non-generated code.
        return file;
    }
    const { moduleSymbols, sourceFilePath } = factoryMap.get(file.fileName);
    // Not every exported factory statement is valid. They were generated before the program was
    // analyzed, and before ngtsc knew which symbols were actually NgModules. factoryMap contains
    // that knowledge now, so this transform filters the statement list and removes exported factories
    // that aren't actually factories.
    //
    // This could leave the generated factory file empty. To prevent this (it causes issues with
    // closure compiler) a 'ɵNonEmptyModule' export was added when the factory shim was created.
    // Preserve that export if needed, and remove it otherwise.
    //
    // Additionally, an import to @angular/core is generated, but the current compilation unit could
    // actually be @angular/core, in which case such an import is invalid and should be replaced with
    // the proper path to access Ivy symbols in core.
    // The filtered set of statements.
    const transformedStatements = [];
    // The statement identified as the ɵNonEmptyModule export.
    let nonEmptyExport = null;
    // Extracted identifiers which refer to import statements from @angular/core.
    const coreImportIdentifiers = new Set();
    // Consider all the statements.
    for (const stmt of file.statements) {
        // Look for imports to @angular/core.
        if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier) &&
            stmt.moduleSpecifier.text === '@angular/core') {
            // Update the import path to point to the correct file using the ImportRewriter.
            const rewrittenModuleSpecifier = importRewriter.rewriteSpecifier('@angular/core', sourceFilePath);
            if (rewrittenModuleSpecifier !== stmt.moduleSpecifier.text) {
                transformedStatements.push(ts.updateImportDeclaration(stmt, stmt.decorators, stmt.modifiers, stmt.importClause, ts.createStringLiteral(rewrittenModuleSpecifier)));
                // Record the identifier by which this imported module goes, so references to its symbols
                // can be discovered later.
                if (stmt.importClause !== undefined && stmt.importClause.namedBindings !== undefined &&
                    ts.isNamespaceImport(stmt.importClause.namedBindings)) {
                    coreImportIdentifiers.add(stmt.importClause.namedBindings.name.text);
                }
            }
            else {
                transformedStatements.push(stmt);
            }
        }
        else if (ts.isVariableStatement(stmt) && stmt.declarationList.declarations.length === 1) {
            const decl = stmt.declarationList.declarations[0];
            // If this is the ɵNonEmptyModule export, then save it for later.
            if (ts.isIdentifier(decl.name)) {
                if (decl.name.text === 'ɵNonEmptyModule') {
                    nonEmptyExport = stmt;
                    continue;
                }
                // Otherwise, check if this export is a factory for a known NgModule, and retain it if so.
                const match = STRIP_NG_FACTORY.exec(decl.name.text);
                const module = match ? moduleSymbols.get(match[1]) : null;
                if (module) {
                    // If the module can be tree shaken, then the factory should be wrapped in a
                    // `noSideEffects()` call which tells Closure to treat the expression as pure, allowing
                    // it to be removed if the result is not used.
                    //
                    // `NgModule`s with an `id` property will be lazy loaded. Google-internal lazy loading
                    // infra relies on a side effect from the `new NgModuleFactory()` call, which registers
                    // the module globally. Because of this, we **cannot** tree shake any module which has
                    // an `id` property. Doing so would cause lazy loaded modules to never be registered.
                    const moduleIsTreeShakable = !module.hasId;
                    const newStmt = !moduleIsTreeShakable ?
                        stmt :
                        updateInitializers(stmt, (init) => init ? wrapInNoSideEffects(init) : undefined);
                    transformedStatements.push(newStmt);
                }
            }
            else {
                // Leave the statement alone, as it can't be understood.
                transformedStatements.push(stmt);
            }
        }
        else {
            // Include non-variable statements (imports, etc).
            transformedStatements.push(stmt);
        }
    }
    // Check whether the empty module export is still needed.
    if (!transformedStatements.some(ts.isVariableStatement) && nonEmptyExport !== null) {
        // If the resulting file has no factories, include an empty export to
        // satisfy closure compiler.
        transformedStatements.push(nonEmptyExport);
    }
    file = ts.updateSourceFileNode(file, transformedStatements);
    // If any imports to @angular/core were detected and rewritten (which happens when compiling
    // @angular/core), go through the SourceFile and rewrite references to symbols imported from core.
    if (coreImportIdentifiers.size > 0) {
        const visit = (node) => {
            node = ts.visitEachChild(node, child => visit(child), context);
            // Look for expressions of the form "i.s" where 'i' is a detected name for an @angular/core
            // import that was changed above. Rewrite 's' using the ImportResolver.
            if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
                coreImportIdentifiers.has(node.expression.text)) {
                // This is an import of a symbol from @angular/core. Transform it with the importRewriter.
                const rewrittenSymbol = importRewriter.rewriteSymbol(node.name.text, '@angular/core');
                if (rewrittenSymbol !== node.name.text) {
                    const updated = ts.updatePropertyAccess(node, node.expression, ts.createIdentifier(rewrittenSymbol));
                    node = updated;
                }
            }
            return node;
        };
        file = visit(file);
    }
    return file;
}
/**
 * Parses and returns the comment text of a \@fileoverview comment in the given source file.
 */
function getFileoverviewComment(sourceFile) {
    const text = sourceFile.getFullText();
    const trivia = text.substring(0, sourceFile.getStart());
    const leadingComments = ts.getLeadingCommentRanges(trivia, 0);
    if (!leadingComments || leadingComments.length === 0) {
        return null;
    }
    const comment = leadingComments[0];
    if (comment.kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
        return null;
    }
    // Only comments separated with a \n\n from the file contents are considered file-level comments
    // in TypeScript.
    if (text.substring(comment.end, comment.end + 2) !== '\n\n') {
        return null;
    }
    const commentText = text.substring(comment.pos, comment.end);
    // Closure Compiler ignores @suppress and similar if the comment contains @license.
    if (commentText.indexOf('@license') !== -1) {
        return null;
    }
    return commentText;
}
/**
 * Wraps the given expression in a call to `ɵnoSideEffects()`, which tells
 * Closure we don't care about the side effects of this expression and it should
 * be treated as "pure". Closure is free to tree shake this expression if its
 * result is not used.
 *
 * Example: Takes `1 + 2` and returns `i0.ɵnoSideEffects(() => 1 + 2)`.
 */
function wrapInNoSideEffects(expr) {
    const noSideEffects = ts.createPropertyAccess(ts.createIdentifier('i0'), 'ɵnoSideEffects');
    return ts.createCall(noSideEffects, 
    /* typeArguments */ [], 
    /* arguments */
    [
        ts.createFunctionExpression(
        /* modifiers */ [], 
        /* asteriskToken */ undefined, 
        /* name */ undefined, 
        /* typeParameters */ [], 
        /* parameters */ [], 
        /* type */ undefined, 
        /* body */ ts.createBlock([
            ts.createReturn(expr),
        ])),
    ]);
}
/**
 * Clones and updates the initializers for a given statement to use the new
 * expression provided. Does not mutate the input statement.
 */
function updateInitializers(stmt, update) {
    return ts.updateVariableStatement(stmt, stmt.modifiers, ts.updateVariableDeclarationList(stmt.declarationList, stmt.declarationList.declarations.map((decl) => ts.updateVariableDeclaration(decl, decl.name, decl.type, update(decl.initializer)))));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeV9nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3NoaW1zL3NyYy9mYWN0b3J5X2dlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsc0JBQXNCLEVBQWtCLFFBQVEsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBSW5GLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUUzQyxNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUM7QUFDcEMsTUFBTSxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztBQUUxQzs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sZ0JBQWdCO0lBQTdCO1FBQ1csZUFBVSxHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO1FBQzdDLDJCQUFzQixHQUFHLElBQUksR0FBRyxFQUFtQyxDQUFDO1FBRW5FLGVBQVUsR0FBRyxJQUFJLENBQUM7UUFDbEIsb0JBQWUsR0FBRyxXQUFXLENBQUM7SUEyRXpDLENBQUM7SUF6RUMsbUJBQW1CLENBQUMsRUFBaUIsRUFBRSxXQUEyQjtRQUNoRSxNQUFNLGNBQWMsR0FBRyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVsRCxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDckYsMkZBQTJGO1FBQzNGLDZGQUE2RjtRQUM3RixnR0FBZ0c7UUFDaEcsRUFBRTtRQUNGLDhFQUE4RTtRQUM5RSxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsVUFBVTtZQUNULDJDQUEyQzthQUMxQyxNQUFNLENBQUMsRUFBRSxD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QUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGUsIEFic29sdXRlRnNQYXRoLCBiYXNlbmFtZX0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtJbXBvcnRSZXdyaXRlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0ZhY3RvcnlJbmZvLCBGYWN0b3J5VHJhY2tlciwgTW9kdWxlSW5mbywgUGVyRmlsZVNoaW1HZW5lcmF0b3J9IGZyb20gJy4uL2FwaSc7XG5cbmltcG9ydCB7Z2VuZXJhdGVkTW9kdWxlTmFtZX0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgVFNfRFRTX1NVRkZJWCA9IC8oXFwuZCk/XFwudHMkLztcbmNvbnN0IFNUUklQX05HX0ZBQ1RPUlkgPSAvKC4qKU5nRmFjdG9yeSQvO1xuXG4vKipcbiAqIEdlbmVyYXRlcyB0cy5Tb3VyY2VGaWxlcyB3aGljaCBjb250YWluIHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgTmdGYWN0b3JpZXMgZm9yIGV2ZXJ5IGV4cG9ydGVkXG4gKiBjbGFzcyBvZiBhbiBpbnB1dCB0cy5Tb3VyY2VGaWxlLlxuICovXG5leHBvcnQgY2xhc3MgRmFjdG9yeUdlbmVyYXRvciBpbXBsZW1lbnRzIFBlckZpbGVTaGltR2VuZXJhdG9yLCBGYWN0b3J5VHJhY2tlciB7XG4gIHJlYWRvbmx5IHNvdXJjZUluZm8gPSBuZXcgTWFwPHN0cmluZywgRmFjdG9yeUluZm8+KCk7XG4gIHByaXZhdGUgc291cmNlVG9GYWN0b3J5U3ltYm9scyA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBNb2R1bGVJbmZvPj4oKTtcblxuICByZWFkb25seSBzaG91bGRFbWl0ID0gdHJ1ZTtcbiAgcmVhZG9ubHkgZXh0ZW5zaW9uUHJlZml4ID0gJ25nZmFjdG9yeSc7XG5cbiAgZ2VuZXJhdGVTaGltRm9yRmlsZShzZjogdHMuU291cmNlRmlsZSwgZ2VuRmlsZVBhdGg6IEFic29sdXRlRnNQYXRoKTogdHMuU291cmNlRmlsZSB7XG4gICAgY29uc3QgYWJzb2x1dGVTZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcblxuICAgIGNvbnN0IHJlbGF0aXZlUGF0aFRvU291cmNlID0gJy4vJyArIGJhc2VuYW1lKHNmLmZpbGVOYW1lKS5yZXBsYWNlKFRTX0RUU19TVUZGSVgsICcnKTtcbiAgICAvLyBDb2xsZWN0IGEgbGlzdCBvZiBjbGFzc2VzIHRoYXQgbmVlZCB0byBoYXZlIGZhY3RvcnkgdHlwZXMgZW1pdHRlZCBmb3IgdGhlbS4gVGhpcyBsaXN0IGlzXG4gICAgLy8gb3Zlcmx5IGJyb2FkIGFzIGF0IHRoaXMgcG9pbnQgdGhlIHRzLlR5cGVDaGVja2VyIGhhc24ndCBiZWVuIGNyZWF0ZWQsIGFuZCBjYW4ndCBiZSB1c2VkIHRvXG4gICAgLy8gc2VtYW50aWNhbGx5IHVuZGVyc3RhbmQgd2hpY2ggZGVjb3JhdGVkIHR5cGVzIGFyZSBhY3R1YWxseSBkZWNvcmF0ZWQgd2l0aCBBbmd1bGFyIGRlY29yYXRvcnMuXG4gICAgLy9cbiAgICAvLyBUaGUgZXhwb3J0cyBnZW5lcmF0ZWQgaGVyZSBhcmUgcHJ1bmVkIGluIHRoZSBmYWN0b3J5IHRyYW5zZm9ybSBkdXJpbmcgZW1pdC5cbiAgICBjb25zdCBzeW1ib2xOYW1lcyA9IHNmLnN0YXRlbWVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQaWNrIG91dCB0b3AgbGV2ZWwgY2xhc3MgZGVjbGFyYXRpb25zLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcih0cy5pc0NsYXNzRGVjbGFyYXRpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hpY2ggYXJlIG5hbWVkLCBleHBvcnRlZCwgYW5kIGhhdmUgZGVjb3JhdG9ycy5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNsID0+IGlzRXhwb3J0ZWQoZGVjbCkgJiYgZGVjbC5kZWNvcmF0b3JzICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY2wubmFtZSAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdyYWIgdGhlIHN5bWJvbCBuYW1lLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGVjbCA9PiBkZWNsLm5hbWUhLnRleHQpO1xuXG5cbiAgICBsZXQgc291cmNlVGV4dCA9ICcnO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSB0b3AtbGV2ZWwgY29tbWVudCBpbiB0aGUgb3JpZ2luYWwgZmlsZSwgY29weSBpdCBvdmVyIGF0IHRoZSB0b3Agb2YgdGhlXG4gICAgLy8gZ2VuZXJhdGVkIGZhY3RvcnkgZmlsZS4gVGhpcyBpcyBpbXBvcnRhbnQgZm9yIHByZXNlcnZpbmcgYW55IGxvYWQtYmVhcmluZyBqc2RvYyBjb21tZW50cy5cbiAgICBjb25zdCBsZWFkaW5nQ29tbWVudCA9IGdldEZpbGVvdmVydmlld0NvbW1lbnQoc2YpO1xuICAgIGlmIChsZWFkaW5nQ29tbWVudCAhPT0gbnVsbCkge1xuICAgICAgLy8gTGVhZGluZyBjb21tZW50cyBtdXN0IGJlIHNlcGFyYXRlZCBmcm9tIHRoZSByZXN0IG9mIHRoZSBjb250ZW50cyBieSBhIGJsYW5rIGxpbmUuXG4gICAgICBzb3VyY2VUZXh0ID0gbGVhZGluZ0NvbW1lbnQgKyAnXFxuXFxuJztcbiAgICB9XG5cbiAgICBpZiAoc3ltYm9sTmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gRm9yIGVhY2ggc3ltYm9sIG5hbWUsIGdlbmVyYXRlIGEgY29uc3RhbnQgZXhwb3J0IG9mIHRoZSBjb3JyZXNwb25kaW5nIE5nRmFjdG9yeS5cbiAgICAgIC8vIFRoaXMgd2lsbCBlbmNvbXBhc3MgYSBsb3Qgb2Ygc3ltYm9scyB3aGljaCBkb24ndCBuZWVkIGZhY3RvcmllcywgYnV0IHRoYXQncyBva2F5XG4gICAgICAvLyBiZWNhdXNlIGl0IHdvbid0IG1pc3MgYW55IHRoYXQgZG8uXG4gICAgICBjb25zdCB2YXJMaW5lcyA9IHN5bWJvbE5hbWVzLm1hcChcbiAgICAgICAgICBuYW1lID0+IGBleHBvcnQgY29uc3QgJHtcbiAgICAgICAgICAgICAgbmFtZX1OZ0ZhY3Rvcnk6IGkwLsm1TmdNb2R1bGVGYWN0b3J5PGFueT4gPSBuZXcgaTAuybVOZ01vZHVsZUZhY3RvcnkoJHtuYW1lfSk7YCk7XG4gICAgICBzb3VyY2VUZXh0ICs9IFtcbiAgICAgICAgLy8gVGhpcyBtaWdodCBiZSBpbmNvcnJlY3QgaWYgdGhlIGN1cnJlbnQgcGFja2FnZSBiZWluZyBjb21waWxlZCBpcyBBbmd1bGFyIGNvcmUsIGJ1dCBpdCdzXG4gICAgICAgIC8vIG9rYXkgdG8gbGVhdmUgaW4gYXQgdHlwZSBjaGVja2luZyB0aW1lLiBUeXBlU2NyaXB0IGNhbiBoYW5kbGUgdGhpcyByZWZlcmVuY2UgdmlhIGl0cyBwYXRoXG4gICAgICAgIC8vIG1hcHBpbmcsIGJ1dCBkb3duc3RyZWFtIGJ1bmRsZXJzIGNhbid0LiBJZiB0aGUgY3VycmVudCBwYWNrYWdlIGlzIGNvcmUgaXRzZWxmLCB0aGlzIHdpbGxcbiAgICAgICAgLy8gYmUgcmVwbGFjZWQgaW4gdGhlIGZhY3RvcnkgdHJhbnNmb3JtZXIgYmVmb3JlIGVtaXQuXG4gICAgICAgIGBpbXBvcnQgKiBhcyBpMCBmcm9tICdAYW5ndWxhci9jb3JlJztgLFxuICAgICAgICBgaW1wb3J0IHske3N5bWJvbE5hbWVzLmpvaW4oJywgJyl9fSBmcm9tICcke3JlbGF0aXZlUGF0aFRvU291cmNlfSc7YCxcbiAgICAgICAgLi4udmFyTGluZXMsXG4gICAgICBdLmpvaW4oJ1xcbicpO1xuICAgIH1cblxuICAgIC8vIEFkZCBhbiBleHRyYSBleHBvcnQgdG8gZW5zdXJlIHRoaXMgbW9kdWxlIGhhcyBhdCBsZWFzdCBvbmUuIEl0J2xsIGJlIHJlbW92ZWQgbGF0ZXIgaW4gdGhlXG4gICAgLy8gZmFjdG9yeSB0cmFuc2Zvcm1lciBpZiBpdCBlbmRzIHVwIG5vdCBiZWluZyBuZWVkZWQuXG4gICAgc291cmNlVGV4dCArPSAnXFxuZXhwb3J0IGNvbnN0IMm1Tm9uRW1wdHlNb2R1bGUgPSB0cnVlOyc7XG5cbiAgICBjb25zdCBnZW5GaWxlID1cbiAgICAgICAgdHMuY3JlYXRlU291cmNlRmlsZShnZW5GaWxlUGF0aCwgc291cmNlVGV4dCwgc2YubGFuZ3VhZ2VWZXJzaW9uLCB0cnVlLCB0cy5TY3JpcHRLaW5kLlRTKTtcbiAgICBpZiAoc2YubW9kdWxlTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBnZW5GaWxlLm1vZHVsZU5hbWUgPSBnZW5lcmF0ZWRNb2R1bGVOYW1lKHNmLm1vZHVsZU5hbWUsIHNmLmZpbGVOYW1lLCAnLm5nZmFjdG9yeScpO1xuICAgIH1cblxuICAgIGNvbnN0IG1vZHVsZVN5bWJvbHMgPSBuZXcgTWFwPHN0cmluZywgTW9kdWxlSW5mbz4oKTtcbiAgICB0aGlzLnNvdXJjZVRvRmFjdG9yeVN5bWJvbHMuc2V0KGFic29sdXRlU2ZQYXRoLCBtb2R1bGVTeW1ib2xzKTtcbiAgICB0aGlzLnNvdXJjZUluZm8uc2V0KGdlbkZpbGVQYXRoLCB7XG4gICAgICBzb3VyY2VGaWxlUGF0aDogYWJzb2x1dGVTZlBhdGgsXG4gICAgICBtb2R1bGVTeW1ib2xzLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGdlbkZpbGU7XG4gIH1cblxuICB0cmFjayhzZjogdHMuU291cmNlRmlsZSwgbW9kdWxlSW5mbzogTW9kdWxlSW5mbyk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNvdXJjZVRvRmFjdG9yeVN5bWJvbHMuaGFzKHNmLmZpbGVOYW1lKSkge1xuICAgICAgdGhpcy5zb3VyY2VUb0ZhY3RvcnlTeW1ib2xzLmdldChzZi5maWxlTmFtZSkhLnNldChtb2R1bGVJbmZvLm5hbWUsIG1vZHVsZUluZm8pO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0V4cG9ydGVkKGRlY2w6IHRzLkRlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiBkZWNsLm1vZGlmaWVycyAhPT0gdW5kZWZpbmVkICYmXG4gICAgICBkZWNsLm1vZGlmaWVycy5zb21lKG1vZCA9PiBtb2Qua2luZCA9PSB0cy5TeW50YXhLaW5kLkV4cG9ydEtleXdvcmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVkRmFjdG9yeVRyYW5zZm9ybShcbiAgICBmYWN0b3J5TWFwOiBNYXA8c3RyaW5nLCBGYWN0b3J5SW5mbz4sXG4gICAgaW1wb3J0UmV3cml0ZXI6IEltcG9ydFJld3JpdGVyKTogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+IHtcbiAgcmV0dXJuIChjb250ZXh0OiB0cy5UcmFuc2Zvcm1hdGlvbkNvbnRleHQpOiB0cy5UcmFuc2Zvcm1lcjx0cy5Tb3VyY2VGaWxlPiA9PiB7XG4gICAgcmV0dXJuIChmaWxlOiB0cy5Tb3VyY2VGaWxlKTogdHMuU291cmNlRmlsZSA9PiB7XG4gICAgICByZXR1cm4gdHJhbnNmb3JtRmFjdG9yeVNvdXJjZUZpbGUoZmFjdG9yeU1hcCwgY29udGV4dCwgaW1wb3J0UmV3cml0ZXIsIGZpbGUpO1xuICAgIH07XG4gIH07XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUZhY3RvcnlTb3VyY2VGaWxlKFxuICAgIGZhY3RvcnlNYXA6IE1hcDxzdHJpbmcsIEZhY3RvcnlJbmZvPiwgY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0LFxuICAgIGltcG9ydFJld3JpdGVyOiBJbXBvcnRSZXdyaXRlciwgZmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGUge1xuICAvLyBJZiB0aGlzIGlzIG5vdCBhIGdlbmVyYXRlZCBmaWxlLCBpdCB3b24ndCBoYXZlIGZhY3RvcnkgaW5mbyBhc3NvY2lhdGVkIHdpdGggaXQuXG4gIGlmICghZmFjdG9yeU1hcC5oYXMoZmlsZS5maWxlTmFtZSkpIHtcbiAgICAvLyBEb24ndCB0cmFuc2Zvcm0gbm9uLWdlbmVyYXRlZCBjb2RlLlxuICAgIHJldHVybiBmaWxlO1xuICB9XG5cbiAgY29uc3Qge21vZHVsZVN5bWJvbHMsIHNvdXJjZUZpbGVQYXRofSA9IGZhY3RvcnlNYXAuZ2V0KGZpbGUuZmlsZU5hbWUpITtcblxuICAvLyBOb3QgZXZlcnkgZXhwb3J0ZWQgZmFjdG9yeSBzdGF0ZW1lbnQgaXMgdmFsaWQuIFRoZXkgd2VyZSBnZW5lcmF0ZWQgYmVmb3JlIHRoZSBwcm9ncmFtIHdhc1xuICAvLyBhbmFseXplZCwgYW5kIGJlZm9yZSBuZ3RzYyBrbmV3IHdoaWNoIHN5bWJvbHMgd2VyZSBhY3R1YWxseSBOZ01vZHVsZXMuIGZhY3RvcnlNYXAgY29udGFpbnNcbiAgLy8gdGhhdCBrbm93bGVkZ2Ugbm93LCBzbyB0aGlzIHRyYW5zZm9ybSBmaWx0ZXJzIHRoZSBzdGF0ZW1lbnQgbGlzdCBhbmQgcmVtb3ZlcyBleHBvcnRlZCBmYWN0b3JpZXNcbiAgLy8gdGhhdCBhcmVuJ3QgYWN0dWFsbHkgZmFjdG9yaWVzLlxuICAvL1xuICAvLyBUaGlzIGNvdWxkIGxlYXZlIHRoZSBnZW5lcmF0ZWQgZmFjdG9yeSBmaWxlIGVtcHR5LiBUbyBwcmV2ZW50IHRoaXMgKGl0IGNhdXNlcyBpc3N1ZXMgd2l0aFxuICAvLyBjbG9zdXJlIGNvbXBpbGVyKSBhICfJtU5vbkVtcHR5TW9kdWxlJyBleHBvcnQgd2FzIGFkZGVkIHdoZW4gdGhlIGZhY3Rvcnkgc2hpbSB3YXMgY3JlYXRlZC5cbiAgLy8gUHJlc2VydmUgdGhhdCBleHBvcnQgaWYgbmVlZGVkLCBhbmQgcmVtb3ZlIGl0IG90aGVyd2lzZS5cbiAgLy9cbiAgLy8gQWRkaXRpb25hbGx5LCBhbiBpbXBvcnQgdG8gQGFuZ3VsYXIvY29yZSBpcyBnZW5lcmF0ZWQsIGJ1dCB0aGUgY3VycmVudCBjb21waWxhdGlvbiB1bml0IGNvdWxkXG4gIC8vIGFjdHVhbGx5IGJlIEBhbmd1bGFyL2NvcmUsIGluIHdoaWNoIGNhc2Ugc3VjaCBhbiBpbXBvcnQgaXMgaW52YWxpZCBhbmQgc2hvdWxkIGJlIHJlcGxhY2VkIHdpdGhcbiAgLy8gdGhlIHByb3BlciBwYXRoIHRvIGFjY2VzcyBJdnkgc3ltYm9scyBpbiBjb3JlLlxuXG4gIC8vIFRoZSBmaWx0ZXJlZCBzZXQgb2Ygc3RhdGVtZW50cy5cbiAgY29uc3QgdHJhbnNmb3JtZWRTdGF0ZW1lbnRzOiB0cy5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIC8vIFRoZSBzdGF0ZW1lbnQgaWRlbnRpZmllZCBhcyB0aGUgybVOb25FbXB0eU1vZHVsZSBleHBvcnQuXG4gIGxldCBub25FbXB0eUV4cG9ydDogdHMuU3RhdGVtZW50fG51bGwgPSBudWxsO1xuXG4gIC8vIEV4dHJhY3RlZCBpZGVudGlmaWVycyB3aGljaCByZWZlciB0byBpbXBvcnQgc3RhdGVtZW50cyBmcm9tIEBhbmd1bGFyL2NvcmUuXG4gIGNvbnN0IGNvcmVJbXBvcnRJZGVudGlmaWVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIC8vIENvbnNpZGVyIGFsbCB0aGUgc3RhdGVtZW50cy5cbiAgZm9yIChjb25zdCBzdG10IG9mIGZpbGUuc3RhdGVtZW50cykge1xuICAgIC8vIExvb2sgZm9yIGltcG9ydHMgdG8gQGFuZ3VsYXIvY29yZS5cbiAgICBpZiAodHMuaXNJbXBvcnREZWNsYXJhdGlvbihzdG10KSAmJiB0cy5pc1N0cmluZ0xpdGVyYWwoc3RtdC5tb2R1bGVTcGVjaWZpZXIpICYmXG4gICAgICAgIHN0bXQubW9kdWxlU3BlY2lmaWVyLnRleHQgPT09ICdAYW5ndWxhci9jb3JlJykge1xuICAgICAgLy8gVXBkYXRlIHRoZSBpbXBvcnQgcGF0aCB0byBwb2ludCB0byB0aGUgY29ycmVjdCBmaWxlIHVzaW5nIHRoZSBJbXBvcnRSZXdyaXRlci5cbiAgICAgIGNvbnN0IHJld3JpdHRlbk1vZHVsZVNwZWNpZmllciA9XG4gICAgICAgICAgaW1wb3J0UmV3cml0ZXIucmV3cml0ZVNwZWNpZmllcignQGFuZ3VsYXIvY29yZScsIHNvdXJjZUZpbGVQYXRoKTtcbiAgICAgIGlmIChyZXdyaXR0ZW5Nb2R1bGVTcGVjaWZpZXIgIT09IHN0bXQubW9kdWxlU3BlY2lmaWVyLnRleHQpIHtcbiAgICAgICAgdHJhbnNmb3JtZWRTdGF0ZW1lbnRzLnB1c2godHMudXBkYXRlSW1wb3J0RGVjbGFyYXRpb24oXG4gICAgICAgICAgICBzdG10LCBzdG10LmRlY29yYXRvcnMsIHN0bXQubW9kaWZpZXJzLCBzdG10LmltcG9ydENsYXVzZSxcbiAgICAgICAgICAgIHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwocmV3cml0dGVuTW9kdWxlU3BlY2lmaWVyKSkpO1xuXG4gICAgICAgIC8vIFJlY29yZCB0aGUgaWRlbnRpZmllciBieSB3aGljaCB0aGlzIGltcG9ydGVkIG1vZHVsZSBnb2VzLCBzbyByZWZlcmVuY2VzIHRvIGl0cyBzeW1ib2xzXG4gICAgICAgIC8vIGNhbiBiZSBkaXNjb3ZlcmVkIGxhdGVyLlxuICAgICAgICBpZiAoc3RtdC5pbXBvcnRDbGF1c2UgIT09IHVuZGVmaW5lZCAmJiBzdG10LmltcG9ydENsYXVzZS5uYW1lZEJpbmRpbmdzICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHRzLmlzTmFtZXNwYWNlSW1wb3J0KHN0bXQuaW1wb3J0Q2xhdXNlLm5hbWVkQmluZGluZ3MpKSB7XG4gICAgICAgICAgY29yZUltcG9ydElkZW50aWZpZXJzLmFkZChzdG10LmltcG9ydENsYXVzZS5uYW1lZEJpbmRpbmdzLm5hbWUudGV4dCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyYW5zZm9ybWVkU3RhdGVtZW50cy5wdXNoKHN0bXQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHMuaXNWYXJpYWJsZVN0YXRlbWVudChzdG10KSAmJiBzdG10LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICBjb25zdCBkZWNsID0gc3RtdC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zWzBdO1xuXG4gICAgICAvLyBJZiB0aGlzIGlzIHRoZSDJtU5vbkVtcHR5TW9kdWxlIGV4cG9ydCwgdGhlbiBzYXZlIGl0IGZvciBsYXRlci5cbiAgICAgIGlmICh0cy5pc0lkZW50aWZpZXIoZGVjbC5uYW1lKSkge1xuICAgICAgICBpZiAoZGVjbC5uYW1lLnRleHQgPT09ICfJtU5vbkVtcHR5TW9kdWxlJykge1xuICAgICAgICAgIG5vbkVtcHR5RXhwb3J0ID0gc3RtdDtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE90aGVyd2lzZSwgY2hlY2sgaWYgdGhpcyBleHBvcnQgaXMgYSBmYWN0b3J5IGZvciBhIGtub3duIE5nTW9kdWxlLCBhbmQgcmV0YWluIGl0IGlmIHNvLlxuICAgICAgICBjb25zdCBtYXRjaCA9IFNUUklQX05HX0ZBQ1RPUlkuZXhlYyhkZWNsLm5hbWUudGV4dCk7XG4gICAgICAgIGNvbnN0IG1vZHVsZSA9IG1hdGNoID8gbW9kdWxlU3ltYm9scy5nZXQobWF0Y2hbMV0pIDogbnVsbDtcbiAgICAgICAgaWYgKG1vZHVsZSkge1xuICAgICAgICAgIC8vIElmIHRoZSBtb2R1bGUgY2FuIGJlIHRyZWUgc2hha2VuLCB0aGVuIHRoZSBmYWN0b3J5IHNob3VsZCBiZSB3cmFwcGVkIGluIGFcbiAgICAgICAgICAvLyBgbm9TaWRlRWZmZWN0cygpYCBjYWxsIHdoaWNoIHRlbGxzIENsb3N1cmUgdG8gdHJlYXQgdGhlIGV4cHJlc3Npb24gYXMgcHVyZSwgYWxsb3dpbmdcbiAgICAgICAgICAvLyBpdCB0byBiZSByZW1vdmVkIGlmIHRoZSByZXN1bHQgaXMgbm90IHVzZWQuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBgTmdNb2R1bGVgcyB3aXRoIGFuIGBpZGAgcHJvcGVydHkgd2lsbCBiZSBsYXp5IGxvYWRlZC4gR29vZ2xlLWludGVybmFsIGxhenkgbG9hZGluZ1xuICAgICAgICAgIC8vIGluZnJhIHJlbGllcyBvbiBhIHNpZGUgZWZmZWN0IGZyb20gdGhlIGBuZXcgTmdNb2R1bGVGYWN0b3J5KClgIGNhbGwsIHdoaWNoIHJlZ2lzdGVyc1xuICAgICAgICAgIC8vIHRoZSBtb2R1bGUgZ2xvYmFsbHkuIEJlY2F1c2Ugb2YgdGhpcywgd2UgKipjYW5ub3QqKiB0cmVlIHNoYWtlIGFueSBtb2R1bGUgd2hpY2ggaGFzXG4gICAgICAgICAgLy8gYW4gYGlkYCBwcm9wZXJ0eS4gRG9pbmcgc28gd291bGQgY2F1c2UgbGF6eSBsb2FkZWQgbW9kdWxlcyB0byBuZXZlciBiZSByZWdpc3RlcmVkLlxuICAgICAgICAgIGNvbnN0IG1vZHVsZUlzVHJlZVNoYWthYmxlID0gIW1vZHVsZS5oYXNJZDtcbiAgICAgICAgICBjb25zdCBuZXdTdG10ID0gIW1vZHVsZUlzVHJlZVNoYWthYmxlID9cbiAgICAgICAgICAgICAgc3RtdCA6XG4gICAgICAgICAgICAgIHVwZGF0ZUluaXRpYWxpemVycyhcbiAgICAgICAgICAgICAgICAgIHN0bXQsXG4gICAgICAgICAgICAgICAgICAoaW5pdCkgPT4gaW5pdCA/IHdyYXBJbk5vU2lkZUVmZmVjdHMoaW5pdCkgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgdHJhbnNmb3JtZWRTdGF0ZW1lbnRzLnB1c2gobmV3U3RtdCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIExlYXZlIHRoZSBzdGF0ZW1lbnQgYWxvbmUsIGFzIGl0IGNhbid0IGJlIHVuZGVyc3Rvb2QuXG4gICAgICAgIHRyYW5zZm9ybWVkU3RhdGVtZW50cy5wdXNoKHN0bXQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJbmNsdWRlIG5vbi12YXJpYWJsZSBzdGF0ZW1lbnRzIChpbXBvcnRzLCBldGMpLlxuICAgICAgdHJhbnNmb3JtZWRTdGF0ZW1lbnRzLnB1c2goc3RtdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hlY2sgd2hldGhlciB0aGUgZW1wdHkgbW9kdWxlIGV4cG9ydCBpcyBzdGlsbCBuZWVkZWQuXG4gIGlmICghdHJhbnNmb3JtZWRTdGF0ZW1lbnRzLnNvbWUodHMuaXNWYXJpYWJsZVN0YXRlbWVudCkgJiYgbm9uRW1wdHlFeHBvcnQgIT09IG51bGwpIHtcbiAgICAvLyBJZiB0aGUgcmVzdWx0aW5nIGZpbGUgaGFzIG5vIGZhY3RvcmllcywgaW5jbHVkZSBhbiBlbXB0eSBleHBvcnQgdG9cbiAgICAvLyBzYXRpc2Z5IGNsb3N1cmUgY29tcGlsZXIuXG4gICAgdHJhbnNmb3JtZWRTdGF0ZW1lbnRzLnB1c2gobm9uRW1wdHlFeHBvcnQpO1xuICB9XG5cbiAgZmlsZSA9IHRzLnVwZGF0ZVNvdXJjZUZpbGVOb2RlKGZpbGUsIHRyYW5zZm9ybWVkU3RhdGVtZW50cyk7XG5cbiAgLy8gSWYgYW55IGltcG9ydHMgdG8gQGFuZ3VsYXIvY29yZSB3ZXJlIGRldGVjdGVkIGFuZCByZXdyaXR0ZW4gKHdoaWNoIGhhcHBlbnMgd2hlbiBjb21waWxpbmdcbiAgLy8gQGFuZ3VsYXIvY29yZSksIGdvIHRocm91Z2ggdGhlIFNvdXJjZUZpbGUgYW5kIHJld3JpdGUgcmVmZXJlbmNlcyB0byBzeW1ib2xzIGltcG9ydGVkIGZyb20gY29yZS5cbiAgaWYgKGNvcmVJbXBvcnRJZGVudGlmaWVycy5zaXplID4gMCkge1xuICAgIGNvbnN0IHZpc2l0ID0gPFQgZXh0ZW5kcyB0cy5Ob2RlPihub2RlOiBUKTogVCA9PiB7XG4gICAgICBub2RlID0gdHMudmlzaXRFYWNoQ2hpbGQobm9kZSwgY2hpbGQgPT4gdmlzaXQoY2hpbGQpLCBjb250ZXh0KTtcblxuICAgICAgLy8gTG9vayBmb3IgZXhwcmVzc2lvbnMgb2YgdGhlIGZvcm0gXCJpLnNcIiB3aGVyZSAnaScgaXMgYSBkZXRlY3RlZCBuYW1lIGZvciBhbiBAYW5ndWxhci9jb3JlXG4gICAgICAvLyBpbXBvcnQgdGhhdCB3YXMgY2hhbmdlZCBhYm92ZS4gUmV3cml0ZSAncycgdXNpbmcgdGhlIEltcG9ydFJlc29sdmVyLlxuICAgICAgaWYgKHRzLmlzUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uKG5vZGUpICYmIHRzLmlzSWRlbnRpZmllcihub2RlLmV4cHJlc3Npb24pICYmXG4gICAgICAgICAgY29yZUltcG9ydElkZW50aWZpZXJzLmhhcyhub2RlLmV4cHJlc3Npb24udGV4dCkpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBhbiBpbXBvcnQgb2YgYSBzeW1ib2wgZnJvbSBAYW5ndWxhci9jb3JlLiBUcmFuc2Zvcm0gaXQgd2l0aCB0aGUgaW1wb3J0UmV3cml0ZXIuXG4gICAgICAgIGNvbnN0IHJld3JpdHRlblN5bWJvbCA9IGltcG9ydFJld3JpdGVyLnJld3JpdGVTeW1ib2wobm9kZS5uYW1lLnRleHQsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgICAgIGlmIChyZXdyaXR0ZW5TeW1ib2wgIT09IG5vZGUubmFtZS50ZXh0KSB7XG4gICAgICAgICAgY29uc3QgdXBkYXRlZCA9XG4gICAgICAgICAgICAgIHRzLnVwZGF0ZVByb3BlcnR5QWNjZXNzKG5vZGUsIG5vZGUuZXhwcmVzc2lvbiwgdHMuY3JlYXRlSWRlbnRpZmllcihyZXdyaXR0ZW5TeW1ib2wpKTtcbiAgICAgICAgICBub2RlID0gdXBkYXRlZCBhcyBUICYgdHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9O1xuXG4gICAgZmlsZSA9IHZpc2l0KGZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGZpbGU7XG59XG5cblxuLyoqXG4gKiBQYXJzZXMgYW5kIHJldHVybnMgdGhlIGNvbW1lbnQgdGV4dCBvZiBhIFxcQGZpbGVvdmVydmlldyBjb21tZW50IGluIHRoZSBnaXZlbiBzb3VyY2UgZmlsZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RmlsZW92ZXJ2aWV3Q29tbWVudChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogc3RyaW5nfG51bGwge1xuICBjb25zdCB0ZXh0ID0gc291cmNlRmlsZS5nZXRGdWxsVGV4dCgpO1xuICBjb25zdCB0cml2aWEgPSB0ZXh0LnN1YnN0cmluZygwLCBzb3VyY2VGaWxlLmdldFN0YXJ0KCkpO1xuXG4gIGNvbnN0IGxlYWRpbmdDb21tZW50cyA9IHRzLmdldExlYWRpbmdDb21tZW50UmFuZ2VzKHRyaXZpYSwgMCk7XG4gIGlmICghbGVhZGluZ0NvbW1lbnRzIHx8IGxlYWRpbmdDb21tZW50cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGNvbW1lbnQgPSBsZWFkaW5nQ29tbWVudHNbMF07XG4gIGlmIChjb21tZW50LmtpbmQgIT09IHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gT25seSBjb21tZW50cyBzZXBhcmF0ZWQgd2l0aCBhIFxcblxcbiBmcm9tIHRoZSBmaWxlIGNvbnRlbnRzIGFyZSBjb25zaWRlcmVkIGZpbGUtbGV2ZWwgY29tbWVudHNcbiAgLy8gaW4gVHlwZVNjcmlwdC5cbiAgaWYgKHRleHQuc3Vic3RyaW5nKGNvbW1lbnQuZW5kLCBjb21tZW50LmVuZCArIDIpICE9PSAnXFxuXFxuJykge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgY29tbWVudFRleHQgPSB0ZXh0LnN1YnN0cmluZyhjb21tZW50LnBvcywgY29tbWVudC5lbmQpO1xuICAvLyBDbG9zdXJlIENvbXBpbGVyIGlnbm9yZXMgQHN1cHByZXNzIGFuZCBzaW1pbGFyIGlmIHRoZSBjb21tZW50IGNvbnRhaW5zIEBsaWNlbnNlLlxuICBpZiAoY29tbWVudFRleHQuaW5kZXhPZignQGxpY2Vuc2UnKSAhPT0gLTEpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBjb21tZW50VGV4dDtcbn1cblxuLyoqXG4gKiBXcmFwcyB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBpbiBhIGNhbGwgdG8gYMm1bm9TaWRlRWZmZWN0cygpYCwgd2hpY2ggdGVsbHNcbiAqIENsb3N1cmUgd2UgZG9uJ3QgY2FyZSBhYm91dCB0aGUgc2lkZSBlZmZlY3RzIG9mIHRoaXMgZXhwcmVzc2lvbiBhbmQgaXQgc2hvdWxkXG4gKiBiZSB0cmVhdGVkIGFzIFwicHVyZVwiLiBDbG9zdXJlIGlzIGZyZWUgdG8gdHJlZSBzaGFrZSB0aGlzIGV4cHJlc3Npb24gaWYgaXRzXG4gKiByZXN1bHQgaXMgbm90IHVzZWQuXG4gKlxuICogRXhhbXBsZTogVGFrZXMgYDEgKyAyYCBhbmQgcmV0dXJucyBgaTAuybVub1NpZGVFZmZlY3RzKCgpID0+IDEgKyAyKWAuXG4gKi9cbmZ1bmN0aW9uIHdyYXBJbk5vU2lkZUVmZmVjdHMoZXhwcjogdHMuRXhwcmVzc2lvbik6IHRzLkV4cHJlc3Npb24ge1xuICBjb25zdCBub1NpZGVFZmZlY3RzID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoXG4gICAgICB0cy5jcmVhdGVJZGVudGlmaWVyKCdpMCcpLFxuICAgICAgJ8m1bm9TaWRlRWZmZWN0cycsXG4gICk7XG5cbiAgcmV0dXJuIHRzLmNyZWF0ZUNhbGwoXG4gICAgICBub1NpZGVFZmZlY3RzLFxuICAgICAgLyogdHlwZUFyZ3VtZW50cyAqL1tdLFxuICAgICAgLyogYXJndW1lbnRzICovXG4gICAgICBbXG4gICAgICAgIHRzLmNyZWF0ZUZ1bmN0aW9uRXhwcmVzc2lvbihcbiAgICAgICAgICAgIC8qIG1vZGlmaWVycyAqL1tdLFxuICAgICAgICAgICAgLyogYXN0ZXJpc2tUb2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAvKiBuYW1lICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovW10sXG4gICAgICAgICAgICAvKiBwYXJhbWV0ZXJzICovW10sXG4gICAgICAgICAgICAvKiB0eXBlICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIGJvZHkgKi8gdHMuY3JlYXRlQmxvY2soW1xuICAgICAgICAgICAgICB0cy5jcmVhdGVSZXR1cm4oZXhwciksXG4gICAgICAgICAgICBdKSxcbiAgICAgICAgICAgICksXG4gICAgICBdLFxuICApO1xufVxuXG4vKipcbiAqIENsb25lcyBhbmQgdXBkYXRlcyB0aGUgaW5pdGlhbGl6ZXJzIGZvciBhIGdpdmVuIHN0YXRlbWVudCB0byB1c2UgdGhlIG5ld1xuICogZXhwcmVzc2lvbiBwcm92aWRlZC4gRG9lcyBub3QgbXV0YXRlIHRoZSBpbnB1dCBzdGF0ZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUluaXRpYWxpemVycyhcbiAgICBzdG10OiB0cy5WYXJpYWJsZVN0YXRlbWVudCxcbiAgICB1cGRhdGU6IChpbml0aWFsaXplcj86IHRzLkV4cHJlc3Npb24pID0+IHRzLkV4cHJlc3Npb24gfCB1bmRlZmluZWQsXG4gICAgKTogdHMuVmFyaWFibGVTdGF0ZW1lbnQge1xuICByZXR1cm4gdHMudXBkYXRlVmFyaWFibGVTdGF0ZW1lbnQoXG4gICAgICBzdG10LFxuICAgICAgc3RtdC5tb2RpZmllcnMsXG4gICAgICB0cy51cGRhdGVWYXJpYWJsZURlY2xhcmF0aW9uTGlzdChcbiAgICAgICAgICBzdG10LmRlY2xhcmF0aW9uTGlzdCxcbiAgICAgICAgICBzdG10LmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMubWFwKFxuICAgICAgICAgICAgICAoZGVjbCkgPT4gdHMudXBkYXRlVmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgICAgICAgICAgIGRlY2wsXG4gICAgICAgICAgICAgICAgICBkZWNsLm5hbWUsXG4gICAgICAgICAgICAgICAgICBkZWNsLnR5cGUsXG4gICAgICAgICAgICAgICAgICB1cGRhdGUoZGVjbC5pbml0aWFsaXplciksXG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICksXG4gICk7XG59XG4iXX0=