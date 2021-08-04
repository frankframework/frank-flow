/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ConstantPool } from '@angular/compiler';
import * as ts from 'typescript';
import { getDefaultImportDeclaration } from '../../imports/src/default';
import { PerfPhase } from '../../perf';
import { ImportManager, translateExpression, translateStatement } from '../../translator';
import { visit, Visitor } from '../../util/src/visitor';
import { addImports } from './utils';
const NO_DECORATORS = new Set();
const CLOSURE_FILE_OVERVIEW_REGEXP = /\s+@fileoverview\s+/i;
export function ivyTransformFactory(compilation, reflector, importRewriter, defaultImportTracker, perf, isCore, isClosureCompilerEnabled) {
    const recordWrappedNode = createRecorderFn(defaultImportTracker);
    return (context) => {
        return (file) => {
            return perf.inPhase(PerfPhase.Compile, () => transformIvySourceFile(compilation, context, reflector, importRewriter, file, isCore, isClosureCompilerEnabled, recordWrappedNode));
        };
    };
}
/**
 * Visits all classes, performs Ivy compilation where Angular decorators are present and collects
 * result in a Map that associates a ts.ClassDeclaration with Ivy compilation results. This visitor
 * does NOT perform any TS transformations.
 */
class IvyCompilationVisitor extends Visitor {
    constructor(compilation, constantPool) {
        super();
        this.compilation = compilation;
        this.constantPool = constantPool;
        this.classCompilationMap = new Map();
    }
    visitClassDeclaration(node) {
        // Determine if this class has an Ivy field that needs to be added, and compile the field
        // to an expression if so.
        const result = this.compilation.compile(node, this.constantPool);
        if (result !== null) {
            this.classCompilationMap.set(node, result);
        }
        return { node };
    }
}
/**
 * Visits all classes and performs transformation of corresponding TS nodes based on the Ivy
 * compilation results (provided as an argument).
 */
class IvyTransformationVisitor extends Visitor {
    constructor(compilation, classCompilationMap, reflector, importManager, recordWrappedNodeExpr, isClosureCompilerEnabled, isCore) {
        super();
        this.compilation = compilation;
        this.classCompilationMap = classCompilationMap;
        this.reflector = reflector;
        this.importManager = importManager;
        this.recordWrappedNodeExpr = recordWrappedNodeExpr;
        this.isClosureCompilerEnabled = isClosureCompilerEnabled;
        this.isCore = isCore;
    }
    visitClassDeclaration(node) {
        // If this class is not registered in the map, it means that it doesn't have Angular decorators,
        // thus no further processing is required.
        if (!this.classCompilationMap.has(node)) {
            return { node };
        }
        const translateOptions = {
            recordWrappedNode: this.recordWrappedNodeExpr,
            annotateForClosureCompiler: this.isClosureCompilerEnabled,
        };
        // There is at least one field to add.
        const statements = [];
        const members = [...node.members];
        for (const field of this.classCompilationMap.get(node)) {
            // Translate the initializer for the field into TS nodes.
            const exprNode = translateExpression(field.initializer, this.importManager, translateOptions);
            // Create a static property declaration for the new field.
            const property = ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], field.name, undefined, undefined, exprNode);
            if (this.isClosureCompilerEnabled) {
                // Closure compiler transforms the form `Service.ɵprov = X` into `Service$ɵprov = X`. To
                // prevent this transformation, such assignments need to be annotated with @nocollapse.
                // Note that tsickle is typically responsible for adding such annotations, however it
                // doesn't yet handle synthetic fields added during other transformations.
                ts.addSyntheticLeadingComment(property, ts.SyntaxKind.MultiLineCommentTrivia, '* @nocollapse ', 
                /* hasTrailingNewLine */ false);
            }
            field.statements.map(stmt => translateStatement(stmt, this.importManager, translateOptions))
                .forEach(stmt => statements.push(stmt));
            members.push(property);
        }
        // Replace the class declaration with an updated version.
        node = ts.updateClassDeclaration(node, 
        // Remove the decorator which triggered this compilation, leaving the others alone.
        maybeFilterDecorator(node.decorators, this.compilation.decoratorsFor(node)), node.modifiers, node.name, node.typeParameters, node.heritageClauses || [], 
        // Map over the class members and remove any Angular decorators from them.
        members.map(member => this._stripAngularDecorators(member)));
        return { node, after: statements };
    }
    /**
     * Return all decorators on a `Declaration` which are from @angular/core, or an empty set if none
     * are.
     */
    _angularCoreDecorators(decl) {
        const decorators = this.reflector.getDecoratorsOfDeclaration(decl);
        if (decorators === null) {
            return NO_DECORATORS;
        }
        const coreDecorators = decorators.filter(dec => this.isCore || isFromAngularCore(dec))
            .map(dec => dec.node);
        if (coreDecorators.length > 0) {
            return new Set(coreDecorators);
        }
        else {
            return NO_DECORATORS;
        }
    }
    /**
     * Given a `ts.Node`, filter the decorators array and return a version containing only non-Angular
     * decorators.
     *
     * If all decorators are removed (or none existed in the first place), this method returns
     * `undefined`.
     */
    _nonCoreDecoratorsOnly(node) {
        // Shortcut if the node has no decorators.
        if (node.decorators === undefined) {
            return undefined;
        }
        // Build a Set of the decorators on this node from @angular/core.
        const coreDecorators = this._angularCoreDecorators(node);
        if (coreDecorators.size === node.decorators.length) {
            // If all decorators are to be removed, return `undefined`.
            return undefined;
        }
        else if (coreDecorators.size === 0) {
            // If no decorators need to be removed, return the original decorators array.
            return node.decorators;
        }
        // Filter out the core decorators.
        const filtered = node.decorators.filter(dec => !coreDecorators.has(dec));
        // If no decorators survive, return `undefined`. This can only happen if a core decorator is
        // repeated on the node.
        if (filtered.length === 0) {
            return undefined;
        }
        // Create a new `NodeArray` with the filtered decorators that sourcemaps back to the original.
        const array = ts.createNodeArray(filtered);
        array.pos = node.decorators.pos;
        array.end = node.decorators.end;
        return array;
    }
    /**
     * Remove Angular decorators from a `ts.Node` in a shallow manner.
     *
     * This will remove decorators from class elements (getters, setters, properties, methods) as well
     * as parameters of constructors.
     */
    _stripAngularDecorators(node) {
        if (ts.isParameter(node)) {
            // Strip decorators from parameters (probably of the constructor).
            node = ts.updateParameter(node, this._nonCoreDecoratorsOnly(node), node.modifiers, node.dotDotDotToken, node.name, node.questionToken, node.type, node.initializer);
        }
        else if (ts.isMethodDeclaration(node) && node.decorators !== undefined) {
            // Strip decorators of methods.
            node = ts.updateMethod(node, this._nonCoreDecoratorsOnly(node), node.modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, node.type, node.body);
        }
        else if (ts.isPropertyDeclaration(node) && node.decorators !== undefined) {
            // Strip decorators of properties.
            node = ts.updateProperty(node, this._nonCoreDecoratorsOnly(node), node.modifiers, node.name, node.questionToken, node.type, node.initializer);
        }
        else if (ts.isGetAccessor(node)) {
            // Strip decorators of getters.
            node = ts.updateGetAccessor(node, this._nonCoreDecoratorsOnly(node), node.modifiers, node.name, node.parameters, node.type, node.body);
        }
        else if (ts.isSetAccessor(node)) {
            // Strip decorators of setters.
            node = ts.updateSetAccessor(node, this._nonCoreDecoratorsOnly(node), node.modifiers, node.name, node.parameters, node.body);
        }
        else if (ts.isConstructorDeclaration(node)) {
            // For constructors, strip decorators of the parameters.
            const parameters = node.parameters.map(param => this._stripAngularDecorators(param));
            node =
                ts.updateConstructor(node, node.decorators, node.modifiers, parameters, node.body);
        }
        return node;
    }
}
/**
 * A transformer which operates on ts.SourceFiles and applies changes from an `IvyCompilation`.
 */
function transformIvySourceFile(compilation, context, reflector, importRewriter, file, isCore, isClosureCompilerEnabled, recordWrappedNode) {
    const constantPool = new ConstantPool(isClosureCompilerEnabled);
    const importManager = new ImportManager(importRewriter);
    // The transformation process consists of 2 steps:
    //
    //  1. Visit all classes, perform compilation and collect the results.
    //  2. Perform actual transformation of required TS nodes using compilation results from the first
    //     step.
    //
    // This is needed to have all `o.Expression`s generated before any TS transforms happen. This
    // allows `ConstantPool` to properly identify expressions that can be shared across multiple
    // components declared in the same file.
    // Step 1. Go though all classes in AST, perform compilation and collect the results.
    const compilationVisitor = new IvyCompilationVisitor(compilation, constantPool);
    visit(file, compilationVisitor, context);
    // Step 2. Scan through the AST again and perform transformations based on Ivy compilation
    // results obtained at Step 1.
    const transformationVisitor = new IvyTransformationVisitor(compilation, compilationVisitor.classCompilationMap, reflector, importManager, recordWrappedNode, isClosureCompilerEnabled, isCore);
    let sf = visit(file, transformationVisitor, context);
    // Generate the constant statements first, as they may involve adding additional imports
    // to the ImportManager.
    const downlevelTranslatedCode = getLocalizeCompileTarget(context) < ts.ScriptTarget.ES2015;
    const constants = constantPool.statements.map(stmt => translateStatement(stmt, importManager, {
        recordWrappedNode,
        downlevelTaggedTemplates: downlevelTranslatedCode,
        downlevelVariableDeclarations: downlevelTranslatedCode,
        annotateForClosureCompiler: isClosureCompilerEnabled,
    }));
    // Preserve @fileoverview comments required by Closure, since the location might change as a
    // result of adding extra imports and constant pool statements.
    const fileOverviewMeta = isClosureCompilerEnabled ? getFileOverviewComment(sf.statements) : null;
    // Add new imports for this file.
    sf = addImports(importManager, sf, constants);
    if (fileOverviewMeta !== null) {
        setFileOverviewComment(sf, fileOverviewMeta);
    }
    return sf;
}
/**
 * Compute the correct target output for `$localize` messages generated by Angular
 *
 * In some versions of TypeScript, the transformation of synthetic `$localize` tagged template
 * literals is broken. See https://github.com/microsoft/TypeScript/issues/38485
 *
 * Here we compute what the expected final output target of the compilation will
 * be so that we can generate ES5 compliant `$localize` calls instead of relying upon TS to do the
 * downleveling for us.
 */
function getLocalizeCompileTarget(context) {
    const target = context.getCompilerOptions().target || ts.ScriptTarget.ES2015;
    return target !== ts.ScriptTarget.JSON ? target : ts.ScriptTarget.ES2015;
}
function getFileOverviewComment(statements) {
    if (statements.length > 0) {
        const host = statements[0];
        let trailing = false;
        let comments = ts.getSyntheticLeadingComments(host);
        // If @fileoverview tag is not found in source file, tsickle produces fake node with trailing
        // comment and inject it at the very beginning of the generated file. So we need to check for
        // leading as well as trailing comments.
        if (!comments || comments.length === 0) {
            trailing = true;
            comments = ts.getSyntheticTrailingComments(host);
        }
        if (comments && comments.length > 0 && CLOSURE_FILE_OVERVIEW_REGEXP.test(comments[0].text)) {
            return { comments, host, trailing };
        }
    }
    return null;
}
function setFileOverviewComment(sf, fileoverview) {
    const { comments, host, trailing } = fileoverview;
    // If host statement is no longer the first one, it means that extra statements were added at the
    // very beginning, so we need to relocate @fileoverview comment and cleanup the original statement
    // that hosted it.
    if (sf.statements.length > 0 && host !== sf.statements[0]) {
        if (trailing) {
            ts.setSyntheticTrailingComments(host, undefined);
        }
        else {
            ts.setSyntheticLeadingComments(host, undefined);
        }
        ts.setSyntheticLeadingComments(sf.statements[0], comments);
    }
}
function maybeFilterDecorator(decorators, toRemove) {
    if (decorators === undefined) {
        return undefined;
    }
    const filtered = decorators.filter(dec => toRemove.find(decToRemove => ts.getOriginalNode(dec) === decToRemove) === undefined);
    if (filtered.length === 0) {
        return undefined;
    }
    return ts.createNodeArray(filtered);
}
function isFromAngularCore(decorator) {
    return decorator.import !== null && decorator.import.from === '@angular/core';
}
function createRecorderFn(defaultImportTracker) {
    return node => {
        const importDecl = getDefaultImportDeclaration(node);
        if (importDecl !== null) {
            defaultImportTracker.recordUsedImport(importDecl);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy90cmFuc2Zvcm0vc3JjL3RyYW5zZm9ybS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDL0MsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFHakMsT0FBTyxFQUFDLDJCQUEyQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDdEUsT0FBTyxFQUFDLFNBQVMsRUFBZSxNQUFNLFlBQVksQ0FBQztBQUVuRCxPQUFPLEVBQUMsYUFBYSxFQUF1QixtQkFBbUIsRUFBRSxrQkFBa0IsRUFBb0IsTUFBTSxrQkFBa0IsQ0FBQztBQUNoSSxPQUFPLEVBQUMsS0FBSyxFQUF3QixPQUFPLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUk1RSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRW5DLE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO0FBRTlDLE1BQU0sNEJBQTRCLEdBQUcsc0JBQXNCLENBQUM7QUFXNUQsTUFBTSxVQUFVLG1CQUFtQixDQUMvQixXQUEwQixFQUFFLFNBQXlCLEVBQUUsY0FBOEIsRUFDckYsb0JBQTBDLEVBQUUsSUFBa0IsRUFBRSxNQUFlLEVBQy9FLHdCQUFpQztJQUNuQyxNQUFNLGlCQUFpQixHQUFHLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDakUsT0FBTyxDQUFDLE9BQWlDLEVBQWlDLEVBQUU7UUFDMUUsT0FBTyxDQUFDLElBQW1CLEVBQWlCLEVBQUU7WUFDNUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUNmLFNBQVMsQ0FBQyxPQUFPLEVBQ2pCLEdBQUcsRUFBRSxDQUFDLHNCQUFzQixDQUN4QixXQUFXLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFDN0Qsd0JBQXdCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3hELENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxxQkFBc0IsU0FBUSxPQUFPO0lBR3pDLFlBQW9CLFdBQTBCLEVBQVUsWUFBMEI7UUFDaEYsS0FBSyxFQUFFLENBQUM7UUFEVSxnQkFBVyxHQUFYLFdBQVcsQ0FBZTtRQUFVLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBRjNFLHdCQUFtQixHQUFHLElBQUksR0FBRyxFQUF3QyxDQUFDO0lBSTdFLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxJQUF5QjtRQUU3Qyx5RkFBeUY7UUFDekYsMEJBQTBCO1FBQzFCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDakUsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO1lBQ25CLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQzVDO1FBQ0QsT0FBTyxFQUFDLElBQUksRUFBQyxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQUVEOzs7R0FHRztBQUNILE1BQU0sd0JBQXlCLFNBQVEsT0FBTztJQUM1QyxZQUNZLFdBQTBCLEVBQzFCLG1CQUE4RCxFQUM5RCxTQUF5QixFQUFVLGFBQTRCLEVBQy9ELHFCQUF5RCxFQUN6RCx3QkFBaUMsRUFBVSxNQUFlO1FBQ3BFLEtBQUssRUFBRSxDQUFDO1FBTEUsZ0JBQVcsR0FBWCxXQUFXLENBQWU7UUFDMUIsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUEyQztRQUM5RCxjQUFTLEdBQVQsU0FBUyxDQUFnQjtRQUFVLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQy9ELDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBb0M7UUFDekQsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUFTO1FBQVUsV0FBTSxHQUFOLE1BQU0sQ0FBUztJQUV0RSxDQUFDO0lBRUQscUJBQXFCLENBQUMsSUFBeUI7UUFFN0MsZ0dBQWdHO1FBQ2hHLDBDQUEwQztRQUMxQyxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN2QyxPQUFPLEVBQUMsSUFBSSxFQUFDLENBQUM7U0FDZjtRQUVELE1BQU0sZ0JBQWdCLEdBQXFDO1lBQ3pELGlCQUFpQixFQUFFLElBQUksQ0FBQyxxQkFBcUI7WUFDN0MsMEJBQTBCLEVBQUUsSUFBSSxDQUFDLHdCQUF3QjtTQUMxRCxDQUFDO1FBRUYsc0NBQXNDO1FBQ3RDLE1BQU0sVUFBVSxHQUFtQixFQUFFLENBQUM7UUFDdEMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVsQyxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLEVBQUU7WUFDdkQseURBQXlEO1lBQ3pELE1BQU0sUUFBUSxHQUFHLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTlGLDBEQUEwRDtZQUMxRCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsY0FBYyxDQUM5QixTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFDL0UsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRXpCLElBQUksSUFBSSxDQUFDLHdCQUF3QixFQUFFO2dCQUNqQyx3RkFBd0Y7Z0JBQ3hGLHVGQUF1RjtnQkFDdkYscUZBQXFGO2dCQUNyRiwwRUFBMEU7Z0JBQzFFLEVBQUUsQ0FBQywwQkFBMEIsQ0FDekIsUUFBUSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLEVBQUUsZ0JBQWdCO2dCQUNoRSx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNyQztZQUVELEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztpQkFDdkYsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRTVDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDeEI7UUFFRCx5REFBeUQ7UUFDekQsSUFBSSxHQUFHLEVBQUUsQ0FBQyxzQkFBc0IsQ0FDNUIsSUFBSTtRQUNKLG1GQUFtRjtRQUNuRixvQkFBb0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFDM0YsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxlQUFlLElBQUksRUFBRTtRQUMxRCwwRUFBMEU7UUFDMUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakUsT0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVEOzs7T0FHRztJQUNLLHNCQUFzQixDQUFDLElBQW9CO1FBQ2pELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkUsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO1lBQ3ZCLE9BQU8sYUFBYSxDQUFDO1NBQ3RCO1FBQ0QsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDMUQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQW9CLENBQUMsQ0FBQztRQUNqRSxJQUFJLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQzdCLE9BQU8sSUFBSSxHQUFHLENBQWUsY0FBYyxDQUFDLENBQUM7U0FDOUM7YUFBTTtZQUNMLE9BQU8sYUFBYSxDQUFDO1NBQ3RCO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNLLHNCQUFzQixDQUFDLElBQW9CO1FBQ2pELDBDQUEwQztRQUMxQyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQ2pDLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBQ0QsaUVBQWlFO1FBQ2pFLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV6RCxJQUFJLGNBQWMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUU7WUFDbEQsMkRBQTJEO1lBQzNELE9BQU8sU0FBUyxDQUFDO1NBQ2xCO2FBQU0sSUFBSSxjQUFjLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtZQUNwQyw2RUFBNkU7WUFDN0UsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO1NBQ3hCO1FBRUQsa0NBQWtDO1FBQ2xDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFekUsNEZBQTRGO1FBQzVGLHdCQUF3QjtRQUN4QixJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3pCLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBRUQsOEZBQThGO1FBQzlGLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDMUMsS0FBSyxDQUFDLEdBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztRQUMzQyxLQUFLLENBQUMsR0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQzVDLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ssdUJBQXVCLENBQW9CLElBQU87UUFDeEQsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3hCLGtFQUFrRTtZQUNsRSxJQUFJLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFDNUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FDMUMsQ0FBQztTQUM3QjthQUFNLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQ3hFLCtCQUErQjtZQUMvQixJQUFJLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFDM0UsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUM5RSxJQUFJLENBQUMsSUFBSSxDQUNJLENBQUM7U0FDMUI7YUFBTSxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRTtZQUMxRSxrQ0FBa0M7WUFDbEMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQ2IsSUFBSSxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQ2xFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUNoQyxDQUFDO1NBQzVCO2FBQU0sSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2pDLCtCQUErQjtZQUMvQixJQUFJLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUNoQixJQUFJLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksRUFDbEUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQ25CLENBQUM7U0FDL0I7YUFBTSxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakMsK0JBQStCO1lBQy9CLElBQUksR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQ2hCLElBQUksRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUNsRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQ1IsQ0FBQztTQUMvQjthQUFNLElBQUksRUFBRSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzVDLHdEQUF3RDtZQUN4RCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3JGLElBQUk7Z0JBQ0EsRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQ3hELENBQUM7U0FDL0I7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQUVEOztHQUVHO0FBQ0gsU0FBUyxzQkFBc0IsQ0FDM0IsV0FBMEIsRUFBRSxPQUFpQyxFQUFFLFNBQXlCLEVBQ3hGLGNBQThCLEVBQUUsSUFBbUIsRUFBRSxNQUFlLEVBQ3BFLHdCQUFpQyxFQUNqQyxpQkFBcUQ7SUFDdkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsd0JBQXdCLENBQUMsQ0FBQztJQUNoRSxNQUFNLGFBQWEsR0FBRyxJQUFJLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUV4RCxrREFBa0Q7SUFDbEQsRUFBRTtJQUNGLHNFQUFzRTtJQUN0RSxrR0FBa0c7SUFDbEcsWUFBWTtJQUNaLEVBQUU7SUFDRiw2RkFBNkY7SUFDN0YsNEZBQTRGO0lBQzVGLHdDQUF3QztJQUV4QyxxRkFBcUY7SUFDckYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLHFCQUFxQixDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNoRixLQUFLLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRXpDLDBGQUEwRjtJQUMxRiw4QkFBOEI7SUFDOUIsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLHdCQUF3QixDQUN0RCxXQUFXLEVBQUUsa0JBQWtCLENBQUMsbUJBQW1CLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFDN0UsaUJBQWlCLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDekQsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVyRCx3RkFBd0Y7SUFDeEYsd0JBQXdCO0lBQ3hCLE1BQU0sdUJBQXVCLEdBQUcsd0JBQXdCLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7SUFDM0YsTUFBTSxTQUFTLEdBQ1gsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1FBQzlDLGlCQUFpQjtRQUNqQix3QkFBd0IsRUFBRSx1QkFBdUI7UUFDakQsNkJBQTZCLEVBQUUsdUJBQXVCO1FBQ3RELDBCQUEwQixFQUFFLHdCQUF3QjtLQUNyRCxDQUFDLENBQUMsQ0FBQztJQUVwQyw0RkFBNEY7SUFDNUYsK0RBQStEO0lBQy9ELE1BQU0sZ0JBQWdCLEdBQUcsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRWpHLGlDQUFpQztJQUNqQyxFQUFFLEdBQUcsVUFBVSxDQUFDLGFBQWEsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFFOUMsSUFBSSxnQkFBZ0IsS0FBSyxJQUFJLEVBQUU7UUFDN0Isc0JBQXNCLENBQUMsRUFBRSxFQUFFLGdCQUFnQixDQUFDLENBQUM7S0FDOUM7SUFFRCxPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUM7QUFFRDs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFTLHdCQUF3QixDQUFDLE9BQWlDO0lBRWpFLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztJQUM3RSxPQUFPLE1BQU0sS0FBSyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztBQUMzRSxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxVQUFzQztJQUNwRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDckIsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BELDZGQUE2RjtRQUM3Riw2RkFBNkY7UUFDN0Ysd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDdEMsUUFBUSxHQUFHLElBQUksQ0FBQztZQUNoQixRQUFRLEdBQUcsRUFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2xEO1FBQ0QsSUFBSSxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksNEJBQTRCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUMxRixPQUFPLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQztTQUNuQztLQUNGO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxFQUFpQixFQUFFLFlBQThCO0lBQy9FLE1BQU0sRUFBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBQyxHQUFHLFlBQVksQ0FBQztJQUNoRCxpR0FBaUc7SUFDakcsa0dBQWtHO0lBQ2xHLGtCQUFrQjtJQUNsQixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUN6RCxJQUFJLFFBQVEsRUFBRTtZQUNaLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDbEQ7YUFBTTtZQUNMLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDakQ7UUFDRCxFQUFFLENBQUMsMkJBQTJCLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztLQUM1RDtBQUNILENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUN6QixVQUFnRCxFQUNoRCxRQUF3QjtJQUMxQixJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUU7UUFDNUIsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFDRCxNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUM5QixHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLFdBQVcsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDO0lBQ2hHLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDekIsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFDRCxPQUFPLEVBQUUsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsU0FBb0I7SUFDN0MsT0FBTyxTQUFTLENBQUMsTUFBTSxLQUFLLElBQUksSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxlQUFlLENBQUM7QUFDaEYsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsb0JBQTBDO0lBRWxFLE9BQU8sSUFBSSxDQUFDLEVBQUU7UUFDWixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDdkIsb0JBQW9CLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDbkQ7SUFDSCxDQUFDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtEZWZhdWx0SW1wb3J0VHJhY2tlciwgSW1wb3J0UmV3cml0ZXJ9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtnZXREZWZhdWx0SW1wb3J0RGVjbGFyYXRpb259IGZyb20gJy4uLy4uL2ltcG9ydHMvc3JjL2RlZmF1bHQnO1xuaW1wb3J0IHtQZXJmUGhhc2UsIFBlcmZSZWNvcmRlcn0gZnJvbSAnLi4vLi4vcGVyZic7XG5pbXBvcnQge0RlY29yYXRvciwgUmVmbGVjdGlvbkhvc3R9IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtJbXBvcnRNYW5hZ2VyLCBSZWNvcmRXcmFwcGVkTm9kZUZuLCB0cmFuc2xhdGVFeHByZXNzaW9uLCB0cmFuc2xhdGVTdGF0ZW1lbnQsIFRyYW5zbGF0b3JPcHRpb25zfSBmcm9tICcuLi8uLi90cmFuc2xhdG9yJztcbmltcG9ydCB7dmlzaXQsIFZpc2l0TGlzdEVudHJ5UmVzdWx0LCBWaXNpdG9yfSBmcm9tICcuLi8uLi91dGlsL3NyYy92aXNpdG9yJztcblxuaW1wb3J0IHtDb21waWxlUmVzdWx0fSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge1RyYWl0Q29tcGlsZXJ9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHthZGRJbXBvcnRzfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgTk9fREVDT1JBVE9SUyA9IG5ldyBTZXQ8dHMuRGVjb3JhdG9yPigpO1xuXG5jb25zdCBDTE9TVVJFX0ZJTEVfT1ZFUlZJRVdfUkVHRVhQID0gL1xccytAZmlsZW92ZXJ2aWV3XFxzKy9pO1xuXG4vKipcbiAqIE1ldGFkYXRhIHRvIHN1cHBvcnQgQGZpbGVvdmVydmlldyBibG9ja3MgKENsb3N1cmUgYW5ub3RhdGlvbnMpIGV4dHJhY3RpbmcvcmVzdG9yaW5nLlxuICovXG5pbnRlcmZhY2UgRmlsZU92ZXJ2aWV3TWV0YSB7XG4gIGNvbW1lbnRzOiB0cy5TeW50aGVzaXplZENvbW1lbnRbXTtcbiAgaG9zdDogdHMuU3RhdGVtZW50O1xuICB0cmFpbGluZzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGl2eVRyYW5zZm9ybUZhY3RvcnkoXG4gICAgY29tcGlsYXRpb246IFRyYWl0Q29tcGlsZXIsIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIGltcG9ydFJld3JpdGVyOiBJbXBvcnRSZXdyaXRlcixcbiAgICBkZWZhdWx0SW1wb3J0VHJhY2tlcjogRGVmYXVsdEltcG9ydFRyYWNrZXIsIHBlcmY6IFBlcmZSZWNvcmRlciwgaXNDb3JlOiBib29sZWFuLFxuICAgIGlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZDogYm9vbGVhbik6IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IHJlY29yZFdyYXBwZWROb2RlID0gY3JlYXRlUmVjb3JkZXJGbihkZWZhdWx0SW1wb3J0VHJhY2tlcik7XG4gIHJldHVybiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KTogdHMuVHJhbnNmb3JtZXI8dHMuU291cmNlRmlsZT4gPT4ge1xuICAgIHJldHVybiAoZmlsZTogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGUgPT4ge1xuICAgICAgcmV0dXJuIHBlcmYuaW5QaGFzZShcbiAgICAgICAgICBQZXJmUGhhc2UuQ29tcGlsZSxcbiAgICAgICAgICAoKSA9PiB0cmFuc2Zvcm1JdnlTb3VyY2VGaWxlKFxuICAgICAgICAgICAgICBjb21waWxhdGlvbiwgY29udGV4dCwgcmVmbGVjdG9yLCBpbXBvcnRSZXdyaXRlciwgZmlsZSwgaXNDb3JlLFxuICAgICAgICAgICAgICBpc0Nsb3N1cmVDb21waWxlckVuYWJsZWQsIHJlY29yZFdyYXBwZWROb2RlKSk7XG4gICAgfTtcbiAgfTtcbn1cblxuLyoqXG4gKiBWaXNpdHMgYWxsIGNsYXNzZXMsIHBlcmZvcm1zIEl2eSBjb21waWxhdGlvbiB3aGVyZSBBbmd1bGFyIGRlY29yYXRvcnMgYXJlIHByZXNlbnQgYW5kIGNvbGxlY3RzXG4gKiByZXN1bHQgaW4gYSBNYXAgdGhhdCBhc3NvY2lhdGVzIGEgdHMuQ2xhc3NEZWNsYXJhdGlvbiB3aXRoIEl2eSBjb21waWxhdGlvbiByZXN1bHRzLiBUaGlzIHZpc2l0b3JcbiAqIGRvZXMgTk9UIHBlcmZvcm0gYW55IFRTIHRyYW5zZm9ybWF0aW9ucy5cbiAqL1xuY2xhc3MgSXZ5Q29tcGlsYXRpb25WaXNpdG9yIGV4dGVuZHMgVmlzaXRvciB7XG4gIHB1YmxpYyBjbGFzc0NvbXBpbGF0aW9uTWFwID0gbmV3IE1hcDx0cy5DbGFzc0RlY2xhcmF0aW9uLCBDb21waWxlUmVzdWx0W10+KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjb21waWxhdGlvbjogVHJhaXRDb21waWxlciwgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICB2aXNpdENsYXNzRGVjbGFyYXRpb24obm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbik6XG4gICAgICBWaXNpdExpc3RFbnRyeVJlc3VsdDx0cy5TdGF0ZW1lbnQsIHRzLkNsYXNzRGVjbGFyYXRpb24+IHtcbiAgICAvLyBEZXRlcm1pbmUgaWYgdGhpcyBjbGFzcyBoYXMgYW4gSXZ5IGZpZWxkIHRoYXQgbmVlZHMgdG8gYmUgYWRkZWQsIGFuZCBjb21waWxlIHRoZSBmaWVsZFxuICAgIC8vIHRvIGFuIGV4cHJlc3Npb24gaWYgc28uXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jb21waWxhdGlvbi5jb21waWxlKG5vZGUsIHRoaXMuY29uc3RhbnRQb29sKTtcbiAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmNsYXNzQ29tcGlsYXRpb25NYXAuc2V0KG5vZGUsIHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiB7bm9kZX07XG4gIH1cbn1cblxuLyoqXG4gKiBWaXNpdHMgYWxsIGNsYXNzZXMgYW5kIHBlcmZvcm1zIHRyYW5zZm9ybWF0aW9uIG9mIGNvcnJlc3BvbmRpbmcgVFMgbm9kZXMgYmFzZWQgb24gdGhlIEl2eVxuICogY29tcGlsYXRpb24gcmVzdWx0cyAocHJvdmlkZWQgYXMgYW4gYXJndW1lbnQpLlxuICovXG5jbGFzcyBJdnlUcmFuc2Zvcm1hdGlvblZpc2l0b3IgZXh0ZW5kcyBWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbXBpbGF0aW9uOiBUcmFpdENvbXBpbGVyLFxuICAgICAgcHJpdmF0ZSBjbGFzc0NvbXBpbGF0aW9uTWFwOiBNYXA8dHMuQ2xhc3NEZWNsYXJhdGlvbiwgQ29tcGlsZVJlc3VsdFtdPixcbiAgICAgIHByaXZhdGUgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCwgcHJpdmF0ZSBpbXBvcnRNYW5hZ2VyOiBJbXBvcnRNYW5hZ2VyLFxuICAgICAgcHJpdmF0ZSByZWNvcmRXcmFwcGVkTm9kZUV4cHI6IFJlY29yZFdyYXBwZWROb2RlRm48dHMuRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIGlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZDogYm9vbGVhbiwgcHJpdmF0ZSBpc0NvcmU6IGJvb2xlYW4pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgdmlzaXRDbGFzc0RlY2xhcmF0aW9uKG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOlxuICAgICAgVmlzaXRMaXN0RW50cnlSZXN1bHQ8dHMuU3RhdGVtZW50LCB0cy5DbGFzc0RlY2xhcmF0aW9uPiB7XG4gICAgLy8gSWYgdGhpcyBjbGFzcyBpcyBub3QgcmVnaXN0ZXJlZCBpbiB0aGUgbWFwLCBpdCBtZWFucyB0aGF0IGl0IGRvZXNuJ3QgaGF2ZSBBbmd1bGFyIGRlY29yYXRvcnMsXG4gICAgLy8gdGh1cyBubyBmdXJ0aGVyIHByb2Nlc3NpbmcgaXMgcmVxdWlyZWQuXG4gICAgaWYgKCF0aGlzLmNsYXNzQ29tcGlsYXRpb25NYXAuaGFzKG5vZGUpKSB7XG4gICAgICByZXR1cm4ge25vZGV9O1xuICAgIH1cblxuICAgIGNvbnN0IHRyYW5zbGF0ZU9wdGlvbnM6IFRyYW5zbGF0b3JPcHRpb25zPHRzLkV4cHJlc3Npb24+ID0ge1xuICAgICAgcmVjb3JkV3JhcHBlZE5vZGU6IHRoaXMucmVjb3JkV3JhcHBlZE5vZGVFeHByLFxuICAgICAgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXI6IHRoaXMuaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkLFxuICAgIH07XG5cbiAgICAvLyBUaGVyZSBpcyBhdCBsZWFzdCBvbmUgZmllbGQgdG8gYWRkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IHRzLlN0YXRlbWVudFtdID0gW107XG4gICAgY29uc3QgbWVtYmVycyA9IFsuLi5ub2RlLm1lbWJlcnNdO1xuXG4gICAgZm9yIChjb25zdCBmaWVsZCBvZiB0aGlzLmNsYXNzQ29tcGlsYXRpb25NYXAuZ2V0KG5vZGUpISkge1xuICAgICAgLy8gVHJhbnNsYXRlIHRoZSBpbml0aWFsaXplciBmb3IgdGhlIGZpZWxkIGludG8gVFMgbm9kZXMuXG4gICAgICBjb25zdCBleHByTm9kZSA9IHRyYW5zbGF0ZUV4cHJlc3Npb24oZmllbGQuaW5pdGlhbGl6ZXIsIHRoaXMuaW1wb3J0TWFuYWdlciwgdHJhbnNsYXRlT3B0aW9ucyk7XG5cbiAgICAgIC8vIENyZWF0ZSBhIHN0YXRpYyBwcm9wZXJ0eSBkZWNsYXJhdGlvbiBmb3IgdGhlIG5ldyBmaWVsZC5cbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gdHMuY3JlYXRlUHJvcGVydHkoXG4gICAgICAgICAgdW5kZWZpbmVkLCBbdHMuY3JlYXRlVG9rZW4odHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKV0sIGZpZWxkLm5hbWUsIHVuZGVmaW5lZCxcbiAgICAgICAgICB1bmRlZmluZWQsIGV4cHJOb2RlKTtcblxuICAgICAgaWYgKHRoaXMuaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkKSB7XG4gICAgICAgIC8vIENsb3N1cmUgY29tcGlsZXIgdHJhbnNmb3JtcyB0aGUgZm9ybSBgU2VydmljZS7JtXByb3YgPSBYYCBpbnRvIGBTZXJ2aWNlJMm1cHJvdiA9IFhgLiBUb1xuICAgICAgICAvLyBwcmV2ZW50IHRoaXMgdHJhbnNmb3JtYXRpb24sIHN1Y2ggYXNzaWdubWVudHMgbmVlZCB0byBiZSBhbm5vdGF0ZWQgd2l0aCBAbm9jb2xsYXBzZS5cbiAgICAgICAgLy8gTm90ZSB0aGF0IHRzaWNrbGUgaXMgdHlwaWNhbGx5IHJlc3BvbnNpYmxlIGZvciBhZGRpbmcgc3VjaCBhbm5vdGF0aW9ucywgaG93ZXZlciBpdFxuICAgICAgICAvLyBkb2Vzbid0IHlldCBoYW5kbGUgc3ludGhldGljIGZpZWxkcyBhZGRlZCBkdXJpbmcgb3RoZXIgdHJhbnNmb3JtYXRpb25zLlxuICAgICAgICB0cy5hZGRTeW50aGV0aWNMZWFkaW5nQ29tbWVudChcbiAgICAgICAgICAgIHByb3BlcnR5LCB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsICcqIEBub2NvbGxhcHNlICcsXG4gICAgICAgICAgICAvKiBoYXNUcmFpbGluZ05ld0xpbmUgKi8gZmFsc2UpO1xuICAgICAgfVxuXG4gICAgICBmaWVsZC5zdGF0ZW1lbnRzLm1hcChzdG10ID0+IHRyYW5zbGF0ZVN0YXRlbWVudChzdG10LCB0aGlzLmltcG9ydE1hbmFnZXIsIHRyYW5zbGF0ZU9wdGlvbnMpKVxuICAgICAgICAgIC5mb3JFYWNoKHN0bXQgPT4gc3RhdGVtZW50cy5wdXNoKHN0bXQpKTtcblxuICAgICAgbWVtYmVycy5wdXNoKHByb3BlcnR5KTtcbiAgICB9XG5cbiAgICAvLyBSZXBsYWNlIHRoZSBjbGFzcyBkZWNsYXJhdGlvbiB3aXRoIGFuIHVwZGF0ZWQgdmVyc2lvbi5cbiAgICBub2RlID0gdHMudXBkYXRlQ2xhc3NEZWNsYXJhdGlvbihcbiAgICAgICAgbm9kZSxcbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBkZWNvcmF0b3Igd2hpY2ggdHJpZ2dlcmVkIHRoaXMgY29tcGlsYXRpb24sIGxlYXZpbmcgdGhlIG90aGVycyBhbG9uZS5cbiAgICAgICAgbWF5YmVGaWx0ZXJEZWNvcmF0b3Iobm9kZS5kZWNvcmF0b3JzLCB0aGlzLmNvbXBpbGF0aW9uLmRlY29yYXRvcnNGb3Iobm9kZSkpLCBub2RlLm1vZGlmaWVycyxcbiAgICAgICAgbm9kZS5uYW1lLCBub2RlLnR5cGVQYXJhbWV0ZXJzLCBub2RlLmhlcml0YWdlQ2xhdXNlcyB8fCBbXSxcbiAgICAgICAgLy8gTWFwIG92ZXIgdGhlIGNsYXNzIG1lbWJlcnMgYW5kIHJlbW92ZSBhbnkgQW5ndWxhciBkZWNvcmF0b3JzIGZyb20gdGhlbS5cbiAgICAgICAgbWVtYmVycy5tYXAobWVtYmVyID0+IHRoaXMuX3N0cmlwQW5ndWxhckRlY29yYXRvcnMobWVtYmVyKSkpO1xuICAgIHJldHVybiB7bm9kZSwgYWZ0ZXI6IHN0YXRlbWVudHN9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhbGwgZGVjb3JhdG9ycyBvbiBhIGBEZWNsYXJhdGlvbmAgd2hpY2ggYXJlIGZyb20gQGFuZ3VsYXIvY29yZSwgb3IgYW4gZW1wdHkgc2V0IGlmIG5vbmVcbiAgICogYXJlLlxuICAgKi9cbiAgcHJpdmF0ZSBfYW5ndWxhckNvcmVEZWNvcmF0b3JzKGRlY2w6IHRzLkRlY2xhcmF0aW9uKTogU2V0PHRzLkRlY29yYXRvcj4ge1xuICAgIGNvbnN0IGRlY29yYXRvcnMgPSB0aGlzLnJlZmxlY3Rvci5nZXREZWNvcmF0b3JzT2ZEZWNsYXJhdGlvbihkZWNsKTtcbiAgICBpZiAoZGVjb3JhdG9ycyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIE5PX0RFQ09SQVRPUlM7XG4gICAgfVxuICAgIGNvbnN0IGNvcmVEZWNvcmF0b3JzID0gZGVjb3JhdG9ycy5maWx0ZXIoZGVjID0+IHRoaXMuaXNDb3JlIHx8IGlzRnJvbUFuZ3VsYXJDb3JlKGRlYykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkZWMgPT4gZGVjLm5vZGUgYXMgdHMuRGVjb3JhdG9yKTtcbiAgICBpZiAoY29yZURlY29yYXRvcnMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIG5ldyBTZXQ8dHMuRGVjb3JhdG9yPihjb3JlRGVjb3JhdG9ycyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBOT19ERUNPUkFUT1JTO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIGB0cy5Ob2RlYCwgZmlsdGVyIHRoZSBkZWNvcmF0b3JzIGFycmF5IGFuZCByZXR1cm4gYSB2ZXJzaW9uIGNvbnRhaW5pbmcgb25seSBub24tQW5ndWxhclxuICAgKiBkZWNvcmF0b3JzLlxuICAgKlxuICAgKiBJZiBhbGwgZGVjb3JhdG9ycyBhcmUgcmVtb3ZlZCAob3Igbm9uZSBleGlzdGVkIGluIHRoZSBmaXJzdCBwbGFjZSksIHRoaXMgbWV0aG9kIHJldHVybnNcbiAgICogYHVuZGVmaW5lZGAuXG4gICAqL1xuICBwcml2YXRlIF9ub25Db3JlRGVjb3JhdG9yc09ubHkobm9kZTogdHMuRGVjbGFyYXRpb24pOiB0cy5Ob2RlQXJyYXk8dHMuRGVjb3JhdG9yPnx1bmRlZmluZWQge1xuICAgIC8vIFNob3J0Y3V0IGlmIHRoZSBub2RlIGhhcyBubyBkZWNvcmF0b3JzLlxuICAgIGlmIChub2RlLmRlY29yYXRvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgLy8gQnVpbGQgYSBTZXQgb2YgdGhlIGRlY29yYXRvcnMgb24gdGhpcyBub2RlIGZyb20gQGFuZ3VsYXIvY29yZS5cbiAgICBjb25zdCBjb3JlRGVjb3JhdG9ycyA9IHRoaXMuX2FuZ3VsYXJDb3JlRGVjb3JhdG9ycyhub2RlKTtcblxuICAgIGlmIChjb3JlRGVjb3JhdG9ycy5zaXplID09PSBub2RlLmRlY29yYXRvcnMubGVuZ3RoKSB7XG4gICAgICAvLyBJZiBhbGwgZGVjb3JhdG9ycyBhcmUgdG8gYmUgcmVtb3ZlZCwgcmV0dXJuIGB1bmRlZmluZWRgLlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2UgaWYgKGNvcmVEZWNvcmF0b3JzLnNpemUgPT09IDApIHtcbiAgICAgIC8vIElmIG5vIGRlY29yYXRvcnMgbmVlZCB0byBiZSByZW1vdmVkLCByZXR1cm4gdGhlIG9yaWdpbmFsIGRlY29yYXRvcnMgYXJyYXkuXG4gICAgICByZXR1cm4gbm9kZS5kZWNvcmF0b3JzO1xuICAgIH1cblxuICAgIC8vIEZpbHRlciBvdXQgdGhlIGNvcmUgZGVjb3JhdG9ycy5cbiAgICBjb25zdCBmaWx0ZXJlZCA9IG5vZGUuZGVjb3JhdG9ycy5maWx0ZXIoZGVjID0+ICFjb3JlRGVjb3JhdG9ycy5oYXMoZGVjKSk7XG5cbiAgICAvLyBJZiBubyBkZWNvcmF0b3JzIHN1cnZpdmUsIHJldHVybiBgdW5kZWZpbmVkYC4gVGhpcyBjYW4gb25seSBoYXBwZW4gaWYgYSBjb3JlIGRlY29yYXRvciBpc1xuICAgIC8vIHJlcGVhdGVkIG9uIHRoZSBub2RlLlxuICAgIGlmIChmaWx0ZXJlZC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGEgbmV3IGBOb2RlQXJyYXlgIHdpdGggdGhlIGZpbHRlcmVkIGRlY29yYXRvcnMgdGhhdCBzb3VyY2VtYXBzIGJhY2sgdG8gdGhlIG9yaWdpbmFsLlxuICAgIGNvbnN0IGFycmF5ID0gdHMuY3JlYXRlTm9kZUFycmF5KGZpbHRlcmVkKTtcbiAgICAoYXJyYXkucG9zIGFzIG51bWJlcikgPSBub2RlLmRlY29yYXRvcnMucG9zO1xuICAgIChhcnJheS5lbmQgYXMgbnVtYmVyKSA9IG5vZGUuZGVjb3JhdG9ycy5lbmQ7XG4gICAgcmV0dXJuIGFycmF5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBBbmd1bGFyIGRlY29yYXRvcnMgZnJvbSBhIGB0cy5Ob2RlYCBpbiBhIHNoYWxsb3cgbWFubmVyLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgcmVtb3ZlIGRlY29yYXRvcnMgZnJvbSBjbGFzcyBlbGVtZW50cyAoZ2V0dGVycywgc2V0dGVycywgcHJvcGVydGllcywgbWV0aG9kcykgYXMgd2VsbFxuICAgKiBhcyBwYXJhbWV0ZXJzIG9mIGNvbnN0cnVjdG9ycy5cbiAgICovXG4gIHByaXZhdGUgX3N0cmlwQW5ndWxhckRlY29yYXRvcnM8VCBleHRlbmRzIHRzLk5vZGU+KG5vZGU6IFQpOiBUIHtcbiAgICBpZiAodHMuaXNQYXJhbWV0ZXIobm9kZSkpIHtcbiAgICAgIC8vIFN0cmlwIGRlY29yYXRvcnMgZnJvbSBwYXJhbWV0ZXJzIChwcm9iYWJseSBvZiB0aGUgY29uc3RydWN0b3IpLlxuICAgICAgbm9kZSA9IHRzLnVwZGF0ZVBhcmFtZXRlcihcbiAgICAgICAgICAgICAgICAgbm9kZSwgdGhpcy5fbm9uQ29yZURlY29yYXRvcnNPbmx5KG5vZGUpLCBub2RlLm1vZGlmaWVycywgbm9kZS5kb3REb3REb3RUb2tlbixcbiAgICAgICAgICAgICAgICAgbm9kZS5uYW1lLCBub2RlLnF1ZXN0aW9uVG9rZW4sIG5vZGUudHlwZSwgbm9kZS5pbml0aWFsaXplcikgYXMgVCAmXG4gICAgICAgICAgdHMuUGFyYW1ldGVyRGVjbGFyYXRpb247XG4gICAgfSBlbHNlIGlmICh0cy5pc01ldGhvZERlY2xhcmF0aW9uKG5vZGUpICYmIG5vZGUuZGVjb3JhdG9ycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBTdHJpcCBkZWNvcmF0b3JzIG9mIG1ldGhvZHMuXG4gICAgICBub2RlID0gdHMudXBkYXRlTWV0aG9kKFxuICAgICAgICAgICAgICAgICBub2RlLCB0aGlzLl9ub25Db3JlRGVjb3JhdG9yc09ubHkobm9kZSksIG5vZGUubW9kaWZpZXJzLCBub2RlLmFzdGVyaXNrVG9rZW4sXG4gICAgICAgICAgICAgICAgIG5vZGUubmFtZSwgbm9kZS5xdWVzdGlvblRva2VuLCBub2RlLnR5cGVQYXJhbWV0ZXJzLCBub2RlLnBhcmFtZXRlcnMsIG5vZGUudHlwZSxcbiAgICAgICAgICAgICAgICAgbm9kZS5ib2R5KSBhcyBUICZcbiAgICAgICAgICB0cy5NZXRob2REZWNsYXJhdGlvbjtcbiAgICB9IGVsc2UgaWYgKHRzLmlzUHJvcGVydHlEZWNsYXJhdGlvbihub2RlKSAmJiBub2RlLmRlY29yYXRvcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gU3RyaXAgZGVjb3JhdG9ycyBvZiBwcm9wZXJ0aWVzLlxuICAgICAgbm9kZSA9IHRzLnVwZGF0ZVByb3BlcnR5KFxuICAgICAgICAgICAgICAgICBub2RlLCB0aGlzLl9ub25Db3JlRGVjb3JhdG9yc09ubHkobm9kZSksIG5vZGUubW9kaWZpZXJzLCBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgIG5vZGUucXVlc3Rpb25Ub2tlbiwgbm9kZS50eXBlLCBub2RlLmluaXRpYWxpemVyKSBhcyBUICZcbiAgICAgICAgICB0cy5Qcm9wZXJ0eURlY2xhcmF0aW9uO1xuICAgIH0gZWxzZSBpZiAodHMuaXNHZXRBY2Nlc3Nvcihub2RlKSkge1xuICAgICAgLy8gU3RyaXAgZGVjb3JhdG9ycyBvZiBnZXR0ZXJzLlxuICAgICAgbm9kZSA9IHRzLnVwZGF0ZUdldEFjY2Vzc29yKFxuICAgICAgICAgICAgICAgICBub2RlLCB0aGlzLl9ub25Db3JlRGVjb3JhdG9yc09ubHkobm9kZSksIG5vZGUubW9kaWZpZXJzLCBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgIG5vZGUucGFyYW1ldGVycywgbm9kZS50eXBlLCBub2RlLmJvZHkpIGFzIFQgJlxuICAgICAgICAgIHRzLkdldEFjY2Vzc29yRGVjbGFyYXRpb247XG4gICAgfSBlbHNlIGlmICh0cy5pc1NldEFjY2Vzc29yKG5vZGUpKSB7XG4gICAgICAvLyBTdHJpcCBkZWNvcmF0b3JzIG9mIHNldHRlcnMuXG4gICAgICBub2RlID0gdHMudXBkYXRlU2V0QWNjZXNzb3IoXG4gICAgICAgICAgICAgICAgIG5vZGUsIHRoaXMuX25vbkNvcmVEZWNvcmF0b3JzT25seShub2RlKSwgbm9kZS5tb2RpZmllcnMsIG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgbm9kZS5wYXJhbWV0ZXJzLCBub2RlLmJvZHkpIGFzIFQgJlxuICAgICAgICAgIHRzLlNldEFjY2Vzc29yRGVjbGFyYXRpb247XG4gICAgfSBlbHNlIGlmICh0cy5pc0NvbnN0cnVjdG9yRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIC8vIEZvciBjb25zdHJ1Y3RvcnMsIHN0cmlwIGRlY29yYXRvcnMgb2YgdGhlIHBhcmFtZXRlcnMuXG4gICAgICBjb25zdCBwYXJhbWV0ZXJzID0gbm9kZS5wYXJhbWV0ZXJzLm1hcChwYXJhbSA9PiB0aGlzLl9zdHJpcEFuZ3VsYXJEZWNvcmF0b3JzKHBhcmFtKSk7XG4gICAgICBub2RlID1cbiAgICAgICAgICB0cy51cGRhdGVDb25zdHJ1Y3Rvcihub2RlLCBub2RlLmRlY29yYXRvcnMsIG5vZGUubW9kaWZpZXJzLCBwYXJhbWV0ZXJzLCBub2RlLmJvZHkpIGFzIFQgJlxuICAgICAgICAgIHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb247XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9XG59XG5cbi8qKlxuICogQSB0cmFuc2Zvcm1lciB3aGljaCBvcGVyYXRlcyBvbiB0cy5Tb3VyY2VGaWxlcyBhbmQgYXBwbGllcyBjaGFuZ2VzIGZyb20gYW4gYEl2eUNvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gdHJhbnNmb3JtSXZ5U291cmNlRmlsZShcbiAgICBjb21waWxhdGlvbjogVHJhaXRDb21waWxlciwgY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0LCByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgIGltcG9ydFJld3JpdGVyOiBJbXBvcnRSZXdyaXRlciwgZmlsZTogdHMuU291cmNlRmlsZSwgaXNDb3JlOiBib29sZWFuLFxuICAgIGlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZDogYm9vbGVhbixcbiAgICByZWNvcmRXcmFwcGVkTm9kZTogUmVjb3JkV3JhcHBlZE5vZGVGbjx0cy5FeHByZXNzaW9uPik6IHRzLlNvdXJjZUZpbGUge1xuICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKGlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZCk7XG4gIGNvbnN0IGltcG9ydE1hbmFnZXIgPSBuZXcgSW1wb3J0TWFuYWdlcihpbXBvcnRSZXdyaXRlcik7XG5cbiAgLy8gVGhlIHRyYW5zZm9ybWF0aW9uIHByb2Nlc3MgY29uc2lzdHMgb2YgMiBzdGVwczpcbiAgLy9cbiAgLy8gIDEuIFZpc2l0IGFsbCBjbGFzc2VzLCBwZXJmb3JtIGNvbXBpbGF0aW9uIGFuZCBjb2xsZWN0IHRoZSByZXN1bHRzLlxuICAvLyAgMi4gUGVyZm9ybSBhY3R1YWwgdHJhbnNmb3JtYXRpb24gb2YgcmVxdWlyZWQgVFMgbm9kZXMgdXNpbmcgY29tcGlsYXRpb24gcmVzdWx0cyBmcm9tIHRoZSBmaXJzdFxuICAvLyAgICAgc3RlcC5cbiAgLy9cbiAgLy8gVGhpcyBpcyBuZWVkZWQgdG8gaGF2ZSBhbGwgYG8uRXhwcmVzc2lvbmBzIGdlbmVyYXRlZCBiZWZvcmUgYW55IFRTIHRyYW5zZm9ybXMgaGFwcGVuLiBUaGlzXG4gIC8vIGFsbG93cyBgQ29uc3RhbnRQb29sYCB0byBwcm9wZXJseSBpZGVudGlmeSBleHByZXNzaW9ucyB0aGF0IGNhbiBiZSBzaGFyZWQgYWNyb3NzIG11bHRpcGxlXG4gIC8vIGNvbXBvbmVudHMgZGVjbGFyZWQgaW4gdGhlIHNhbWUgZmlsZS5cblxuICAvLyBTdGVwIDEuIEdvIHRob3VnaCBhbGwgY2xhc3NlcyBpbiBBU1QsIHBlcmZvcm0gY29tcGlsYXRpb24gYW5kIGNvbGxlY3QgdGhlIHJlc3VsdHMuXG4gIGNvbnN0IGNvbXBpbGF0aW9uVmlzaXRvciA9IG5ldyBJdnlDb21waWxhdGlvblZpc2l0b3IoY29tcGlsYXRpb24sIGNvbnN0YW50UG9vbCk7XG4gIHZpc2l0KGZpbGUsIGNvbXBpbGF0aW9uVmlzaXRvciwgY29udGV4dCk7XG5cbiAgLy8gU3RlcCAyLiBTY2FuIHRocm91Z2ggdGhlIEFTVCBhZ2FpbiBhbmQgcGVyZm9ybSB0cmFuc2Zvcm1hdGlvbnMgYmFzZWQgb24gSXZ5IGNvbXBpbGF0aW9uXG4gIC8vIHJlc3VsdHMgb2J0YWluZWQgYXQgU3RlcCAxLlxuICBjb25zdCB0cmFuc2Zvcm1hdGlvblZpc2l0b3IgPSBuZXcgSXZ5VHJhbnNmb3JtYXRpb25WaXNpdG9yKFxuICAgICAgY29tcGlsYXRpb24sIGNvbXBpbGF0aW9uVmlzaXRvci5jbGFzc0NvbXBpbGF0aW9uTWFwLCByZWZsZWN0b3IsIGltcG9ydE1hbmFnZXIsXG4gICAgICByZWNvcmRXcmFwcGVkTm9kZSwgaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkLCBpc0NvcmUpO1xuICBsZXQgc2YgPSB2aXNpdChmaWxlLCB0cmFuc2Zvcm1hdGlvblZpc2l0b3IsIGNvbnRleHQpO1xuXG4gIC8vIEdlbmVyYXRlIHRoZSBjb25zdGFudCBzdGF0ZW1lbnRzIGZpcnN0LCBhcyB0aGV5IG1heSBpbnZvbHZlIGFkZGluZyBhZGRpdGlvbmFsIGltcG9ydHNcbiAgLy8gdG8gdGhlIEltcG9ydE1hbmFnZXIuXG4gIGNvbnN0IGRvd25sZXZlbFRyYW5zbGF0ZWRDb2RlID0gZ2V0TG9jYWxpemVDb21waWxlVGFyZ2V0KGNvbnRleHQpIDwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNTtcbiAgY29uc3QgY29uc3RhbnRzID1cbiAgICAgIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLm1hcChzdG10ID0+IHRyYW5zbGF0ZVN0YXRlbWVudChzdG10LCBpbXBvcnRNYW5hZ2VyLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWNvcmRXcmFwcGVkTm9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvd25sZXZlbFRhZ2dlZFRlbXBsYXRlczogZG93bmxldmVsVHJhbnNsYXRlZENvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb3dubGV2ZWxWYXJpYWJsZURlY2xhcmF0aW9uczogZG93bmxldmVsVHJhbnNsYXRlZENvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcjogaXNDbG9zdXJlQ29tcGlsZXJFbmFibGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcblxuICAvLyBQcmVzZXJ2ZSBAZmlsZW92ZXJ2aWV3IGNvbW1lbnRzIHJlcXVpcmVkIGJ5IENsb3N1cmUsIHNpbmNlIHRoZSBsb2NhdGlvbiBtaWdodCBjaGFuZ2UgYXMgYVxuICAvLyByZXN1bHQgb2YgYWRkaW5nIGV4dHJhIGltcG9ydHMgYW5kIGNvbnN0YW50IHBvb2wgc3RhdGVtZW50cy5cbiAgY29uc3QgZmlsZU92ZXJ2aWV3TWV0YSA9IGlzQ2xvc3VyZUNvbXBpbGVyRW5hYmxlZCA/IGdldEZpbGVPdmVydmlld0NvbW1lbnQoc2Yuc3RhdGVtZW50cykgOiBudWxsO1xuXG4gIC8vIEFkZCBuZXcgaW1wb3J0cyBmb3IgdGhpcyBmaWxlLlxuICBzZiA9IGFkZEltcG9ydHMoaW1wb3J0TWFuYWdlciwgc2YsIGNvbnN0YW50cyk7XG5cbiAgaWYgKGZpbGVPdmVydmlld01ldGEgIT09IG51bGwpIHtcbiAgICBzZXRGaWxlT3ZlcnZpZXdDb21tZW50KHNmLCBmaWxlT3ZlcnZpZXdNZXRhKTtcbiAgfVxuXG4gIHJldHVybiBzZjtcbn1cblxuLyoqXG4gKiBDb21wdXRlIHRoZSBjb3JyZWN0IHRhcmdldCBvdXRwdXQgZm9yIGAkbG9jYWxpemVgIG1lc3NhZ2VzIGdlbmVyYXRlZCBieSBBbmd1bGFyXG4gKlxuICogSW4gc29tZSB2ZXJzaW9ucyBvZiBUeXBlU2NyaXB0LCB0aGUgdHJhbnNmb3JtYXRpb24gb2Ygc3ludGhldGljIGAkbG9jYWxpemVgIHRhZ2dlZCB0ZW1wbGF0ZVxuICogbGl0ZXJhbHMgaXMgYnJva2VuLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zODQ4NVxuICpcbiAqIEhlcmUgd2UgY29tcHV0ZSB3aGF0IHRoZSBleHBlY3RlZCBmaW5hbCBvdXRwdXQgdGFyZ2V0IG9mIHRoZSBjb21waWxhdGlvbiB3aWxsXG4gKiBiZSBzbyB0aGF0IHdlIGNhbiBnZW5lcmF0ZSBFUzUgY29tcGxpYW50IGAkbG9jYWxpemVgIGNhbGxzIGluc3RlYWQgb2YgcmVseWluZyB1cG9uIFRTIHRvIGRvIHRoZVxuICogZG93bmxldmVsaW5nIGZvciB1cy5cbiAqL1xuZnVuY3Rpb24gZ2V0TG9jYWxpemVDb21waWxlVGFyZ2V0KGNvbnRleHQ6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCk6XG4gICAgRXhjbHVkZTx0cy5TY3JpcHRUYXJnZXQsIHRzLlNjcmlwdFRhcmdldC5KU09OPiB7XG4gIGNvbnN0IHRhcmdldCA9IGNvbnRleHQuZ2V0Q29tcGlsZXJPcHRpb25zKCkudGFyZ2V0IHx8IHRzLlNjcmlwdFRhcmdldC5FUzIwMTU7XG4gIHJldHVybiB0YXJnZXQgIT09IHRzLlNjcmlwdFRhcmdldC5KU09OID8gdGFyZ2V0IDogdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNTtcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZU92ZXJ2aWV3Q29tbWVudChzdGF0ZW1lbnRzOiB0cy5Ob2RlQXJyYXk8dHMuU3RhdGVtZW50Pik6IEZpbGVPdmVydmlld01ldGF8bnVsbCB7XG4gIGlmIChzdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0ID0gc3RhdGVtZW50c1swXTtcbiAgICBsZXQgdHJhaWxpbmcgPSBmYWxzZTtcbiAgICBsZXQgY29tbWVudHMgPSB0cy5nZXRTeW50aGV0aWNMZWFkaW5nQ29tbWVudHMoaG9zdCk7XG4gICAgLy8gSWYgQGZpbGVvdmVydmlldyB0YWcgaXMgbm90IGZvdW5kIGluIHNvdXJjZSBmaWxlLCB0c2lja2xlIHByb2R1Y2VzIGZha2Ugbm9kZSB3aXRoIHRyYWlsaW5nXG4gICAgLy8gY29tbWVudCBhbmQgaW5qZWN0IGl0IGF0IHRoZSB2ZXJ5IGJlZ2lubmluZyBvZiB0aGUgZ2VuZXJhdGVkIGZpbGUuIFNvIHdlIG5lZWQgdG8gY2hlY2sgZm9yXG4gICAgLy8gbGVhZGluZyBhcyB3ZWxsIGFzIHRyYWlsaW5nIGNvbW1lbnRzLlxuICAgIGlmICghY29tbWVudHMgfHwgY29tbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0cmFpbGluZyA9IHRydWU7XG4gICAgICBjb21tZW50cyA9IHRzLmdldFN5bnRoZXRpY1RyYWlsaW5nQ29tbWVudHMoaG9zdCk7XG4gICAgfVxuICAgIGlmIChjb21tZW50cyAmJiBjb21tZW50cy5sZW5ndGggPiAwICYmIENMT1NVUkVfRklMRV9PVkVSVklFV19SRUdFWFAudGVzdChjb21tZW50c1swXS50ZXh0KSkge1xuICAgICAgcmV0dXJuIHtjb21tZW50cywgaG9zdCwgdHJhaWxpbmd9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gc2V0RmlsZU92ZXJ2aWV3Q29tbWVudChzZjogdHMuU291cmNlRmlsZSwgZmlsZW92ZXJ2aWV3OiBGaWxlT3ZlcnZpZXdNZXRhKTogdm9pZCB7XG4gIGNvbnN0IHtjb21tZW50cywgaG9zdCwgdHJhaWxpbmd9ID0gZmlsZW92ZXJ2aWV3O1xuICAvLyBJZiBob3N0IHN0YXRlbWVudCBpcyBubyBsb25nZXIgdGhlIGZpcnN0IG9uZSwgaXQgbWVhbnMgdGhhdCBleHRyYSBzdGF0ZW1lbnRzIHdlcmUgYWRkZWQgYXQgdGhlXG4gIC8vIHZlcnkgYmVnaW5uaW5nLCBzbyB3ZSBuZWVkIHRvIHJlbG9jYXRlIEBmaWxlb3ZlcnZpZXcgY29tbWVudCBhbmQgY2xlYW51cCB0aGUgb3JpZ2luYWwgc3RhdGVtZW50XG4gIC8vIHRoYXQgaG9zdGVkIGl0LlxuICBpZiAoc2Yuc3RhdGVtZW50cy5sZW5ndGggPiAwICYmIGhvc3QgIT09IHNmLnN0YXRlbWVudHNbMF0pIHtcbiAgICBpZiAodHJhaWxpbmcpIHtcbiAgICAgIHRzLnNldFN5bnRoZXRpY1RyYWlsaW5nQ29tbWVudHMoaG9zdCwgdW5kZWZpbmVkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHMuc2V0U3ludGhldGljTGVhZGluZ0NvbW1lbnRzKGhvc3QsIHVuZGVmaW5lZCk7XG4gICAgfVxuICAgIHRzLnNldFN5bnRoZXRpY0xlYWRpbmdDb21tZW50cyhzZi5zdGF0ZW1lbnRzWzBdLCBjb21tZW50cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWF5YmVGaWx0ZXJEZWNvcmF0b3IoXG4gICAgZGVjb3JhdG9yczogdHMuTm9kZUFycmF5PHRzLkRlY29yYXRvcj58dW5kZWZpbmVkLFxuICAgIHRvUmVtb3ZlOiB0cy5EZWNvcmF0b3JbXSk6IHRzLk5vZGVBcnJheTx0cy5EZWNvcmF0b3I+fHVuZGVmaW5lZCB7XG4gIGlmIChkZWNvcmF0b3JzID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIGNvbnN0IGZpbHRlcmVkID0gZGVjb3JhdG9ycy5maWx0ZXIoXG4gICAgICBkZWMgPT4gdG9SZW1vdmUuZmluZChkZWNUb1JlbW92ZSA9PiB0cy5nZXRPcmlnaW5hbE5vZGUoZGVjKSA9PT0gZGVjVG9SZW1vdmUpID09PSB1bmRlZmluZWQpO1xuICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdHMuY3JlYXRlTm9kZUFycmF5KGZpbHRlcmVkKTtcbn1cblxuZnVuY3Rpb24gaXNGcm9tQW5ndWxhckNvcmUoZGVjb3JhdG9yOiBEZWNvcmF0b3IpOiBib29sZWFuIHtcbiAgcmV0dXJuIGRlY29yYXRvci5pbXBvcnQgIT09IG51bGwgJiYgZGVjb3JhdG9yLmltcG9ydC5mcm9tID09PSAnQGFuZ3VsYXIvY29yZSc7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVJlY29yZGVyRm4oZGVmYXVsdEltcG9ydFRyYWNrZXI6IERlZmF1bHRJbXBvcnRUcmFja2VyKTpcbiAgICBSZWNvcmRXcmFwcGVkTm9kZUZuPHRzLkV4cHJlc3Npb24+IHtcbiAgcmV0dXJuIG5vZGUgPT4ge1xuICAgIGNvbnN0IGltcG9ydERlY2wgPSBnZXREZWZhdWx0SW1wb3J0RGVjbGFyYXRpb24obm9kZSk7XG4gICAgaWYgKGltcG9ydERlY2wgIT09IG51bGwpIHtcbiAgICAgIGRlZmF1bHRJbXBvcnRUcmFja2VyLnJlY29yZFVzZWRJbXBvcnQoaW1wb3J0RGVjbCk7XG4gICAgfVxuICB9O1xufVxuIl19