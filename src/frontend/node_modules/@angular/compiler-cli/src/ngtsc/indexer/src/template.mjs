/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ASTWithSource, ImplicitReceiver, RecursiveAstVisitor, TmplAstElement, TmplAstRecursiveVisitor, TmplAstReference, TmplAstTemplate } from '@angular/compiler';
import { AbsoluteSourceSpan, IdentifierKind } from './api';
/**
 * Visits the AST of an Angular template syntax expression, finding interesting
 * entities (variable references, etc.). Creates an array of Entities found in
 * the expression, with the location of the Entities being relative to the
 * expression.
 *
 * Visiting `text {{prop}}` will return
 * `[TopLevelIdentifier {name: 'prop', span: {start: 7, end: 11}}]`.
 */
class ExpressionVisitor extends RecursiveAstVisitor {
    constructor(expressionStr, absoluteOffset, boundTemplate, targetToIdentifier) {
        super();
        this.expressionStr = expressionStr;
        this.absoluteOffset = absoluteOffset;
        this.boundTemplate = boundTemplate;
        this.targetToIdentifier = targetToIdentifier;
        this.identifiers = [];
    }
    /**
     * Returns identifiers discovered in an expression.
     *
     * @param ast expression AST to visit
     * @param source expression AST source code
     * @param absoluteOffset absolute byte offset from start of the file to the start of the AST
     * source code.
     * @param boundTemplate bound target of the entire template, which can be used to query for the
     * entities expressions target.
     * @param targetToIdentifier closure converting a template target node to its identifier.
     */
    static getIdentifiers(ast, source, absoluteOffset, boundTemplate, targetToIdentifier) {
        const visitor = new ExpressionVisitor(source, absoluteOffset, boundTemplate, targetToIdentifier);
        visitor.visit(ast);
        return visitor.identifiers;
    }
    visit(ast) {
        ast.visit(this);
    }
    visitMethodCall(ast, context) {
        this.visitIdentifier(ast, IdentifierKind.Method);
        super.visitMethodCall(ast, context);
    }
    visitPropertyRead(ast, context) {
        this.visitIdentifier(ast, IdentifierKind.Property);
        super.visitPropertyRead(ast, context);
    }
    visitPropertyWrite(ast, context) {
        this.visitIdentifier(ast, IdentifierKind.Property);
        super.visitPropertyWrite(ast, context);
    }
    /**
     * Visits an identifier, adding it to the identifier store if it is useful for indexing.
     *
     * @param ast expression AST the identifier is in
     * @param kind identifier kind
     */
    visitIdentifier(ast, kind) {
        // The definition of a non-top-level property such as `bar` in `{{foo.bar}}` is currently
        // impossible to determine by an indexer and unsupported by the indexing module.
        // The indexing module also does not currently support references to identifiers declared in the
        // template itself, which have a non-null expression target.
        if (!(ast.receiver instanceof ImplicitReceiver)) {
            return;
        }
        // The source span of the requested AST starts at a location that is offset from the expression.
        const identifierStart = ast.sourceSpan.start - this.absoluteOffset;
        if (!this.expressionStr.substring(identifierStart).startsWith(ast.name)) {
            throw new Error(`Impossible state: "${ast.name}" not found in "${this.expressionStr}" at location ${identifierStart}`);
        }
        // Join the relative position of the expression within a node with the absolute position
        // of the node to get the absolute position of the expression in the source code.
        const absoluteStart = this.absoluteOffset + identifierStart;
        const span = new AbsoluteSourceSpan(absoluteStart, absoluteStart + ast.name.length);
        const targetAst = this.boundTemplate.getExpressionTarget(ast);
        const target = targetAst ? this.targetToIdentifier(targetAst) : null;
        const identifier = {
            name: ast.name,
            span,
            kind,
            target,
        };
        this.identifiers.push(identifier);
    }
}
/**
 * Visits the AST of a parsed Angular template. Discovers and stores
 * identifiers of interest, deferring to an `ExpressionVisitor` as needed.
 */
class TemplateVisitor extends TmplAstRecursiveVisitor {
    /**
     * Creates a template visitor for a bound template target. The bound target can be used when
     * deferred to the expression visitor to get information about the target of an expression.
     *
     * @param boundTemplate bound template target
     */
    constructor(boundTemplate) {
        super();
        this.boundTemplate = boundTemplate;
        // Identifiers of interest found in the template.
        this.identifiers = new Set();
        // Map of targets in a template to their identifiers.
        this.targetIdentifierCache = new Map();
        // Map of elements and templates to their identifiers.
        this.elementAndTemplateIdentifierCache = new Map();
    }
    /**
     * Visits a node in the template.
     *
     * @param node node to visit
     */
    visit(node) {
        node.visit(this);
    }
    visitAll(nodes) {
        nodes.forEach(node => this.visit(node));
    }
    /**
     * Add an identifier for an HTML element and visit its children recursively.
     *
     * @param element
     */
    visitElement(element) {
        const elementIdentifier = this.elementOrTemplateToIdentifier(element);
        this.identifiers.add(elementIdentifier);
        this.visitAll(element.references);
        this.visitAll(element.inputs);
        this.visitAll(element.attributes);
        this.visitAll(element.children);
        this.visitAll(element.outputs);
    }
    visitTemplate(template) {
        const templateIdentifier = this.elementOrTemplateToIdentifier(template);
        this.identifiers.add(templateIdentifier);
        this.visitAll(template.variables);
        this.visitAll(template.attributes);
        this.visitAll(template.templateAttrs);
        this.visitAll(template.children);
        this.visitAll(template.references);
    }
    visitBoundAttribute(attribute) {
        // If the bound attribute has no value, it cannot have any identifiers in the value expression.
        if (attribute.valueSpan === undefined) {
            return;
        }
        const identifiers = ExpressionVisitor.getIdentifiers(attribute.value, attribute.valueSpan.toString(), attribute.valueSpan.start.offset, this.boundTemplate, this.targetToIdentifier.bind(this));
        identifiers.forEach(id => this.identifiers.add(id));
    }
    visitBoundEvent(attribute) {
        this.visitExpression(attribute.handler);
    }
    visitBoundText(text) {
        this.visitExpression(text.value);
    }
    visitReference(reference) {
        const referenceIdentifer = this.targetToIdentifier(reference);
        this.identifiers.add(referenceIdentifer);
    }
    visitVariable(variable) {
        const variableIdentifier = this.targetToIdentifier(variable);
        this.identifiers.add(variableIdentifier);
    }
    /** Creates an identifier for a template element or template node. */
    elementOrTemplateToIdentifier(node) {
        // If this node has already been seen, return the cached result.
        if (this.elementAndTemplateIdentifierCache.has(node)) {
            return this.elementAndTemplateIdentifierCache.get(node);
        }
        let name;
        let kind;
        if (node instanceof TmplAstTemplate) {
            name = node.tagName;
            kind = IdentifierKind.Template;
        }
        else {
            name = node.name;
            kind = IdentifierKind.Element;
        }
        const sourceSpan = node.startSourceSpan;
        // An element's or template's source span can be of the form `<element>`, `<element />`, or
        // `<element></element>`. Only the selector is interesting to the indexer, so the source is
        // searched for the first occurrence of the element (selector) name.
        const start = this.getStartLocation(name, sourceSpan);
        const absoluteSpan = new AbsoluteSourceSpan(start, start + name.length);
        // Record the nodes's attributes, which an indexer can later traverse to see if any of them
        // specify a used directive on the node.
        const attributes = node.attributes.map(({ name, sourceSpan }) => {
            return {
                name,
                span: new AbsoluteSourceSpan(sourceSpan.start.offset, sourceSpan.end.offset),
                kind: IdentifierKind.Attribute,
            };
        });
        const usedDirectives = this.boundTemplate.getDirectivesOfNode(node) || [];
        const identifier = {
            name,
            span: absoluteSpan,
            kind,
            attributes: new Set(attributes),
            usedDirectives: new Set(usedDirectives.map(dir => {
                return {
                    node: dir.ref.node,
                    selector: dir.selector,
                };
            })),
            // cast b/c pre-TypeScript 3.5 unions aren't well discriminated
        };
        this.elementAndTemplateIdentifierCache.set(node, identifier);
        return identifier;
    }
    /** Creates an identifier for a template reference or template variable target. */
    targetToIdentifier(node) {
        // If this node has already been seen, return the cached result.
        if (this.targetIdentifierCache.has(node)) {
            return this.targetIdentifierCache.get(node);
        }
        const { name, sourceSpan } = node;
        const start = this.getStartLocation(name, sourceSpan);
        const span = new AbsoluteSourceSpan(start, start + name.length);
        let identifier;
        if (node instanceof TmplAstReference) {
            // If the node is a reference, we care about its target. The target can be an element, a
            // template, a directive applied on a template or element (in which case the directive field
            // is non-null), or nothing at all.
            const refTarget = this.boundTemplate.getReferenceTarget(node);
            let target = null;
            if (refTarget) {
                if (refTarget instanceof TmplAstElement || refTarget instanceof TmplAstTemplate) {
                    target = {
                        node: this.elementOrTemplateToIdentifier(refTarget),
                        directive: null,
                    };
                }
                else {
                    target = {
                        node: this.elementOrTemplateToIdentifier(refTarget.node),
                        directive: refTarget.directive.ref.node,
                    };
                }
            }
            identifier = {
                name,
                span,
                kind: IdentifierKind.Reference,
                target,
            };
        }
        else {
            identifier = {
                name,
                span,
                kind: IdentifierKind.Variable,
            };
        }
        this.targetIdentifierCache.set(node, identifier);
        return identifier;
    }
    /** Gets the start location of a string in a SourceSpan */
    getStartLocation(name, context) {
        const localStr = context.toString();
        if (!localStr.includes(name)) {
            throw new Error(`Impossible state: "${name}" not found in "${localStr}"`);
        }
        return context.start.offset + localStr.indexOf(name);
    }
    /**
     * Visits a node's expression and adds its identifiers, if any, to the visitor's state.
     * Only ASTs with information about the expression source and its location are visited.
     *
     * @param node node whose expression to visit
     */
    visitExpression(ast) {
        // Only include ASTs that have information about their source and absolute source spans.
        if (ast instanceof ASTWithSource && ast.source !== null) {
            // Make target to identifier mapping closure stateful to this visitor instance.
            const targetToIdentifier = this.targetToIdentifier.bind(this);
            const absoluteOffset = ast.sourceSpan.start;
            const identifiers = ExpressionVisitor.getIdentifiers(ast, ast.source, absoluteOffset, this.boundTemplate, targetToIdentifier);
            identifiers.forEach(id => this.identifiers.add(id));
        }
    }
}
/**
 * Traverses a template AST and builds identifiers discovered in it.
 *
 * @param boundTemplate bound template target, which can be used for querying expression targets.
 * @return identifiers in template
 */
export function getTemplateIdentifiers(boundTemplate) {
    const visitor = new TemplateVisitor(boundTemplate);
    if (boundTemplate.target.template !== undefined) {
        visitor.visitAll(boundTemplate.target.template);
    }
    return visitor.identifiers;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2luZGV4ZXIvc3JjL3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBTSxhQUFhLEVBQWUsZ0JBQWdCLEVBQTRELG1CQUFtQixFQUE4RCxjQUFjLEVBQWUsdUJBQXVCLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFrQixNQUFNLG1CQUFtQixDQUFDO0FBQ3pVLE9BQU8sRUFBQyxrQkFBa0IsRUFBMEMsY0FBYyxFQUE0SCxNQUFNLE9BQU8sQ0FBQztBQWlCNU47Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLGlCQUFrQixTQUFRLG1CQUFtQjtJQUdqRCxZQUNxQixhQUFxQixFQUFtQixjQUFzQixFQUM5RCxhQUF5QyxFQUN6QyxrQkFBNEQ7UUFDL0UsS0FBSyxFQUFFLENBQUM7UUFIVyxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUFtQixtQkFBYyxHQUFkLGNBQWMsQ0FBUTtRQUM5RCxrQkFBYSxHQUFiLGFBQWEsQ0FBNEI7UUFDekMsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUEwQztRQUx4RSxnQkFBVyxHQUEyQixFQUFFLENBQUM7SUFPbEQsQ0FBQztJQUVEOzs7Ozs7Ozs7O09BVUc7SUFDSCxNQUFNLENBQUMsY0FBYyxDQUNqQixHQUFRLEVBQUUsTUFBYyxFQUFFLGNBQXNCLEVBQUUsYUFBeUMsRUFDM0Ysa0JBQTREO1FBQzlELE1BQU0sT0FBTyxHQUNULElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFLGNBQWMsRUFBRSxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNyRixPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLE9BQU8sT0FBTyxDQUFDLFdBQVcsQ0FBQztJQUM3QixDQUFDO0lBRUQsS0FB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QUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNqRDtJQUNELE9BQU8sT0FBTyxDQUFDLFdBQVcsQ0FBQztBQUM3QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgQm91bmRUYXJnZXQsIEltcGxpY2l0UmVjZWl2ZXIsIE1ldGhvZENhbGwsIFBhcnNlU291cmNlU3BhbiwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUsIFRtcGxBc3RCb3VuZEV2ZW50LCBUbXBsQXN0Qm91bmRUZXh0LCBUbXBsQXN0RWxlbWVudCwgVG1wbEFzdE5vZGUsIFRtcGxBc3RSZWN1cnNpdmVWaXNpdG9yLCBUbXBsQXN0UmVmZXJlbmNlLCBUbXBsQXN0VGVtcGxhdGUsIFRtcGxBc3RWYXJpYWJsZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtBYnNvbHV0ZVNvdXJjZVNwYW4sIEF0dHJpYnV0ZUlkZW50aWZpZXIsIEVsZW1lbnRJZGVudGlmaWVyLCBJZGVudGlmaWVyS2luZCwgTWV0aG9kSWRlbnRpZmllciwgUHJvcGVydHlJZGVudGlmaWVyLCBSZWZlcmVuY2VJZGVudGlmaWVyLCBUZW1wbGF0ZU5vZGVJZGVudGlmaWVyLCBUb3BMZXZlbElkZW50aWZpZXIsIFZhcmlhYmxlSWRlbnRpZmllcn0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtDb21wb25lbnRNZXRhfSBmcm9tICcuL2NvbnRleHQnO1xuXG4vKipcbiAqIEEgcGFyc2VkIG5vZGUgaW4gYSB0ZW1wbGF0ZSwgd2hpY2ggbWF5IGhhdmUgYSBuYW1lIChpZiBpdCBpcyBhIHNlbGVjdG9yKSBvclxuICogYmUgYW5vbnltb3VzIChsaWtlIGEgdGV4dCBzcGFuKS5cbiAqL1xuaW50ZXJmYWNlIEhUTUxOb2RlIGV4dGVuZHMgVG1wbEFzdE5vZGUge1xuICB0YWdOYW1lPzogc3RyaW5nO1xuICBuYW1lPzogc3RyaW5nO1xufVxuXG50eXBlIEV4cHJlc3Npb25JZGVudGlmaWVyID0gUHJvcGVydHlJZGVudGlmaWVyfE1ldGhvZElkZW50aWZpZXI7XG50eXBlIFRtcGxUYXJnZXQgPSBUbXBsQXN0UmVmZXJlbmNlfFRtcGxBc3RWYXJpYWJsZTtcbnR5cGUgVGFyZ2V0SWRlbnRpZmllciA9IFJlZmVyZW5jZUlkZW50aWZpZXJ8VmFyaWFibGVJZGVudGlmaWVyO1xudHlwZSBUYXJnZXRJZGVudGlmaWVyTWFwID0gTWFwPFRtcGxUYXJnZXQsIFRhcmdldElkZW50aWZpZXI+O1xuXG4vKipcbiAqIFZpc2l0cyB0aGUgQVNUIG9mIGFuIEFuZ3VsYXIgdGVtcGxhdGUgc3ludGF4IGV4cHJlc3Npb24sIGZpbmRpbmcgaW50ZXJlc3RpbmdcbiAqIGVudGl0aWVzICh2YXJpYWJsZSByZWZlcmVuY2VzLCBldGMuKS4gQ3JlYXRlcyBhbiBhcnJheSBvZiBFbnRpdGllcyBmb3VuZCBpblxuICogdGhlIGV4cHJlc3Npb24sIHdpdGggdGhlIGxvY2F0aW9uIG9mIHRoZSBFbnRpdGllcyBiZWluZyByZWxhdGl2ZSB0byB0aGVcbiAqIGV4cHJlc3Npb24uXG4gKlxuICogVmlzaXRpbmcgYHRleHQge3twcm9wfX1gIHdpbGwgcmV0dXJuXG4gKiBgW1RvcExldmVsSWRlbnRpZmllciB7bmFtZTogJ3Byb3AnLCBzcGFuOiB7c3RhcnQ6IDcsIGVuZDogMTF9fV1gLlxuICovXG5jbGFzcyBFeHByZXNzaW9uVmlzaXRvciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3Ige1xuICByZWFkb25seSBpZGVudGlmaWVyczogRXhwcmVzc2lvbklkZW50aWZpZXJbXSA9IFtdO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlYWRvbmx5IGV4cHJlc3Npb25TdHI6IHN0cmluZywgcHJpdmF0ZSByZWFkb25seSBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgcHJpdmF0ZSByZWFkb25seSBib3VuZFRlbXBsYXRlOiBCb3VuZFRhcmdldDxDb21wb25lbnRNZXRhPixcbiAgICAgIHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0VG9JZGVudGlmaWVyOiAodGFyZ2V0OiBUbXBsVGFyZ2V0KSA9PiBUYXJnZXRJZGVudGlmaWVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGlkZW50aWZpZXJzIGRpc2NvdmVyZWQgaW4gYW4gZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGFzdCBleHByZXNzaW9uIEFTVCB0byB2aXNpdFxuICAgKiBAcGFyYW0gc291cmNlIGV4cHJlc3Npb24gQVNUIHNvdXJjZSBjb2RlXG4gICAqIEBwYXJhbSBhYnNvbHV0ZU9mZnNldCBhYnNvbHV0ZSBieXRlIG9mZnNldCBmcm9tIHN0YXJ0IG9mIHRoZSBmaWxlIHRvIHRoZSBzdGFydCBvZiB0aGUgQVNUXG4gICAqIHNvdXJjZSBjb2RlLlxuICAgKiBAcGFyYW0gYm91bmRUZW1wbGF0ZSBib3VuZCB0YXJnZXQgb2YgdGhlIGVudGlyZSB0ZW1wbGF0ZSwgd2hpY2ggY2FuIGJlIHVzZWQgdG8gcXVlcnkgZm9yIHRoZVxuICAgKiBlbnRpdGllcyBleHByZXNzaW9ucyB0YXJnZXQuXG4gICAqIEBwYXJhbSB0YXJnZXRUb0lkZW50aWZpZXIgY2xvc3VyZSBjb252ZXJ0aW5nIGEgdGVtcGxhdGUgdGFyZ2V0IG5vZGUgdG8gaXRzIGlkZW50aWZpZXIuXG4gICAqL1xuICBzdGF0aWMgZ2V0SWRlbnRpZmllcnMoXG4gICAgICBhc3Q6IEFTVCwgc291cmNlOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsIGJvdW5kVGVtcGxhdGU6IEJvdW5kVGFyZ2V0PENvbXBvbmVudE1ldGE+LFxuICAgICAgdGFyZ2V0VG9JZGVudGlmaWVyOiAodGFyZ2V0OiBUbXBsVGFyZ2V0KSA9PiBUYXJnZXRJZGVudGlmaWVyKTogVG9wTGV2ZWxJZGVudGlmaWVyW10ge1xuICAgIGNvbnN0IHZpc2l0b3IgPVxuICAgICAgICBuZXcgRXhwcmVzc2lvblZpc2l0b3Ioc291cmNlLCBhYnNvbHV0ZU9mZnNldCwgYm91bmRUZW1wbGF0ZSwgdGFyZ2V0VG9JZGVudGlmaWVyKTtcbiAgICB2aXNpdG9yLnZpc2l0KGFzdCk7XG4gICAgcmV0dXJuIHZpc2l0b3IuaWRlbnRpZmllcnM7XG4gIH1cblxuICB2aXNpdChhc3Q6IEFTVCkge1xuICAgIGFzdC52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IHt9KSB7XG4gICAgdGhpcy52aXNpdElkZW50aWZpZXIoYXN0LCBJZGVudGlmaWVyS2luZC5NZXRob2QpO1xuICAgIHN1cGVyLnZpc2l0TWV0aG9kQ2FsbChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IHt9KSB7XG4gICAgdGhpcy52aXNpdElkZW50aWZpZXIoYXN0LCBJZGVudGlmaWVyS2luZC5Qcm9wZXJ0eSk7XG4gICAgc3VwZXIudmlzaXRQcm9wZXJ0eVJlYWQoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IHt9KSB7XG4gICAgdGhpcy52aXNpdElkZW50aWZpZXIoYXN0LCBJZGVudGlmaWVyS2luZC5Qcm9wZXJ0eSk7XG4gICAgc3VwZXIudmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICAvKipcbiAgICogVmlzaXRzIGFuIGlkZW50aWZpZXIsIGFkZGluZyBpdCB0byB0aGUgaWRlbnRpZmllciBzdG9yZSBpZiBpdCBpcyB1c2VmdWwgZm9yIGluZGV4aW5nLlxuICAgKlxuICAgKiBAcGFyYW0gYXN0IGV4cHJlc3Npb24gQVNUIHRoZSBpZGVudGlmaWVyIGlzIGluXG4gICAqIEBwYXJhbSBraW5kIGlkZW50aWZpZXIga2luZFxuICAgKi9cbiAgcHJpdmF0ZSB2aXNpdElkZW50aWZpZXIoXG4gICAgICBhc3Q6IEFTVCZ7bmFtZTogc3RyaW5nLCByZWNlaXZlcjogQVNUfSwga2luZDogRXhwcmVzc2lvbklkZW50aWZpZXJbJ2tpbmQnXSkge1xuICAgIC8vIFRoZSBkZWZpbml0aW9uIG9mIGEgbm9uLXRvcC1sZXZlbCBwcm9wZXJ0eSBzdWNoIGFzIGBiYXJgIGluIGB7e2Zvby5iYXJ9fWAgaXMgY3VycmVudGx5XG4gICAgLy8gaW1wb3NzaWJsZSB0byBkZXRlcm1pbmUgYnkgYW4gaW5kZXhlciBhbmQgdW5zdXBwb3J0ZWQgYnkgdGhlIGluZGV4aW5nIG1vZHVsZS5cbiAgICAvLyBUaGUgaW5kZXhpbmcgbW9kdWxlIGFsc28gZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgcmVmZXJlbmNlcyB0byBpZGVudGlmaWVycyBkZWNsYXJlZCBpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBpdHNlbGYsIHdoaWNoIGhhdmUgYSBub24tbnVsbCBleHByZXNzaW9uIHRhcmdldC5cbiAgICBpZiAoIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRoZSBzb3VyY2Ugc3BhbiBvZiB0aGUgcmVxdWVzdGVkIEFTVCBzdGFydHMgYXQgYSBsb2NhdGlvbiB0aGF0IGlzIG9mZnNldCBmcm9tIHRoZSBleHByZXNzaW9uLlxuICAgIGNvbnN0IGlkZW50aWZpZXJTdGFydCA9IGFzdC5zb3VyY2VTcGFuLnN0YXJ0IC0gdGhpcy5hYnNvbHV0ZU9mZnNldDtcbiAgICBpZiAoIXRoaXMuZXhwcmVzc2lvblN0ci5zdWJzdHJpbmcoaWRlbnRpZmllclN0YXJ0KS5zdGFydHNXaXRoKGFzdC5uYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbXBvc3NpYmxlIHN0YXRlOiBcIiR7YXN0Lm5hbWV9XCIgbm90IGZvdW5kIGluIFwiJHtcbiAgICAgICAgICB0aGlzLmV4cHJlc3Npb25TdHJ9XCIgYXQgbG9jYXRpb24gJHtpZGVudGlmaWVyU3RhcnR9YCk7XG4gICAgfVxuXG4gICAgLy8gSm9pbiB0aGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIGV4cHJlc3Npb24gd2l0aGluIGEgbm9kZSB3aXRoIHRoZSBhYnNvbHV0ZSBwb3NpdGlvblxuICAgIC8vIG9mIHRoZSBub2RlIHRvIGdldCB0aGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGV4cHJlc3Npb24gaW4gdGhlIHNvdXJjZSBjb2RlLlxuICAgIGNvbnN0IGFic29sdXRlU3RhcnQgPSB0aGlzLmFic29sdXRlT2Zmc2V0ICsgaWRlbnRpZmllclN0YXJ0O1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKGFic29sdXRlU3RhcnQsIGFic29sdXRlU3RhcnQgKyBhc3QubmFtZS5sZW5ndGgpO1xuXG4gICAgY29uc3QgdGFyZ2V0QXN0ID0gdGhpcy5ib3VuZFRlbXBsYXRlLmdldEV4cHJlc3Npb25UYXJnZXQoYXN0KTtcbiAgICBjb25zdCB0YXJnZXQgPSB0YXJnZXRBc3QgPyB0aGlzLnRhcmdldFRvSWRlbnRpZmllcih0YXJnZXRBc3QpIDogbnVsbDtcbiAgICBjb25zdCBpZGVudGlmaWVyID0ge1xuICAgICAgbmFtZTogYXN0Lm5hbWUsXG4gICAgICBzcGFuLFxuICAgICAga2luZCxcbiAgICAgIHRhcmdldCxcbiAgICB9IGFzIEV4cHJlc3Npb25JZGVudGlmaWVyO1xuXG4gICAgdGhpcy5pZGVudGlmaWVycy5wdXNoKGlkZW50aWZpZXIpO1xuICB9XG59XG5cbi8qKlxuICogVmlzaXRzIHRoZSBBU1Qgb2YgYSBwYXJzZWQgQW5ndWxhciB0ZW1wbGF0ZS4gRGlzY292ZXJzIGFuZCBzdG9yZXNcbiAqIGlkZW50aWZpZXJzIG9mIGludGVyZXN0LCBkZWZlcnJpbmcgdG8gYW4gYEV4cHJlc3Npb25WaXNpdG9yYCBhcyBuZWVkZWQuXG4gKi9cbmNsYXNzIFRlbXBsYXRlVmlzaXRvciBleHRlbmRzIFRtcGxBc3RSZWN1cnNpdmVWaXNpdG9yIHtcbiAgLy8gSWRlbnRpZmllcnMgb2YgaW50ZXJlc3QgZm91bmQgaW4gdGhlIHRlbXBsYXRlLlxuICByZWFkb25seSBpZGVudGlmaWVycyA9IG5ldyBTZXQ8VG9wTGV2ZWxJZGVudGlmaWVyPigpO1xuXG4gIC8vIE1hcCBvZiB0YXJnZXRzIGluIGEgdGVtcGxhdGUgdG8gdGhlaXIgaWRlbnRpZmllcnMuXG4gIHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0SWRlbnRpZmllckNhY2hlOiBUYXJnZXRJZGVudGlmaWVyTWFwID0gbmV3IE1hcCgpO1xuXG4gIC8vIE1hcCBvZiBlbGVtZW50cyBhbmQgdGVtcGxhdGVzIHRvIHRoZWlyIGlkZW50aWZpZXJzLlxuICBwcml2YXRlIHJlYWRvbmx5IGVsZW1lbnRBbmRUZW1wbGF0ZUlkZW50aWZpZXJDYWNoZSA9XG4gICAgICBuZXcgTWFwPFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSwgRWxlbWVudElkZW50aWZpZXJ8VGVtcGxhdGVOb2RlSWRlbnRpZmllcj4oKTtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHRlbXBsYXRlIHZpc2l0b3IgZm9yIGEgYm91bmQgdGVtcGxhdGUgdGFyZ2V0LiBUaGUgYm91bmQgdGFyZ2V0IGNhbiBiZSB1c2VkIHdoZW5cbiAgICogZGVmZXJyZWQgdG8gdGhlIGV4cHJlc3Npb24gdmlzaXRvciB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHRhcmdldCBvZiBhbiBleHByZXNzaW9uLlxuICAgKlxuICAgKiBAcGFyYW0gYm91bmRUZW1wbGF0ZSBib3VuZCB0ZW1wbGF0ZSB0YXJnZXRcbiAgICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYm91bmRUZW1wbGF0ZTogQm91bmRUYXJnZXQ8Q29tcG9uZW50TWV0YT4pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIFZpc2l0cyBhIG5vZGUgaW4gdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZSBub2RlIHRvIHZpc2l0XG4gICAqL1xuICB2aXNpdChub2RlOiBIVE1MTm9kZSkge1xuICAgIG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEFsbChub2RlczogVG1wbEFzdE5vZGVbXSkge1xuICAgIG5vZGVzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0KG5vZGUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gaWRlbnRpZmllciBmb3IgYW4gSFRNTCBlbGVtZW50IGFuZCB2aXNpdCBpdHMgY2hpbGRyZW4gcmVjdXJzaXZlbHkuXG4gICAqXG4gICAqIEBwYXJhbSBlbGVtZW50XG4gICAqL1xuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogVG1wbEFzdEVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SWRlbnRpZmllciA9IHRoaXMuZWxlbWVudE9yVGVtcGxhdGVUb0lkZW50aWZpZXIoZWxlbWVudCk7XG5cbiAgICB0aGlzLmlkZW50aWZpZXJzLmFkZChlbGVtZW50SWRlbnRpZmllcik7XG5cbiAgICB0aGlzLnZpc2l0QWxsKGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gICAgdGhpcy52aXNpdEFsbChlbGVtZW50LmlucHV0cyk7XG4gICAgdGhpcy52aXNpdEFsbChlbGVtZW50LmF0dHJpYnV0ZXMpO1xuICAgIHRoaXMudmlzaXRBbGwoZWxlbWVudC5jaGlsZHJlbik7XG4gICAgdGhpcy52aXNpdEFsbChlbGVtZW50Lm91dHB1dHMpO1xuICB9XG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRtcGxBc3RUZW1wbGF0ZSkge1xuICAgIGNvbnN0IHRlbXBsYXRlSWRlbnRpZmllciA9IHRoaXMuZWxlbWVudE9yVGVtcGxhdGVUb0lkZW50aWZpZXIodGVtcGxhdGUpO1xuXG4gICAgdGhpcy5pZGVudGlmaWVycy5hZGQodGVtcGxhdGVJZGVudGlmaWVyKTtcblxuICAgIHRoaXMudmlzaXRBbGwodGVtcGxhdGUudmFyaWFibGVzKTtcbiAgICB0aGlzLnZpc2l0QWxsKHRlbXBsYXRlLmF0dHJpYnV0ZXMpO1xuICAgIHRoaXMudmlzaXRBbGwodGVtcGxhdGUudGVtcGxhdGVBdHRycyk7XG4gICAgdGhpcy52aXNpdEFsbCh0ZW1wbGF0ZS5jaGlsZHJlbik7XG4gICAgdGhpcy52aXNpdEFsbCh0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgfVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogVG1wbEFzdEJvdW5kQXR0cmlidXRlKSB7XG4gICAgLy8gSWYgdGhlIGJvdW5kIGF0dHJpYnV0ZSBoYXMgbm8gdmFsdWUsIGl0IGNhbm5vdCBoYXZlIGFueSBpZGVudGlmaWVycyBpbiB0aGUgdmFsdWUgZXhwcmVzc2lvbi5cbiAgICBpZiAoYXR0cmlidXRlLnZhbHVlU3BhbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaWRlbnRpZmllcnMgPSBFeHByZXNzaW9uVmlzaXRvci5nZXRJZGVudGlmaWVycyhcbiAgICAgICAgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUudmFsdWVTcGFuLnRvU3RyaW5nKCksIGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0LFxuICAgICAgICB0aGlzLmJvdW5kVGVtcGxhdGUsIHRoaXMudGFyZ2V0VG9JZGVudGlmaWVyLmJpbmQodGhpcykpO1xuICAgIGlkZW50aWZpZXJzLmZvckVhY2goaWQgPT4gdGhpcy5pZGVudGlmaWVycy5hZGQoaWQpKTtcbiAgfVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBUbXBsQXN0Qm91bmRFdmVudCkge1xuICAgIHRoaXMudmlzaXRFeHByZXNzaW9uKGF0dHJpYnV0ZS5oYW5kbGVyKTtcbiAgfVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBUbXBsQXN0Qm91bmRUZXh0KSB7XG4gICAgdGhpcy52aXNpdEV4cHJlc3Npb24odGV4dC52YWx1ZSk7XG4gIH1cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBUbXBsQXN0UmVmZXJlbmNlKSB7XG4gICAgY29uc3QgcmVmZXJlbmNlSWRlbnRpZmVyID0gdGhpcy50YXJnZXRUb0lkZW50aWZpZXIocmVmZXJlbmNlKTtcblxuICAgIHRoaXMuaWRlbnRpZmllcnMuYWRkKHJlZmVyZW5jZUlkZW50aWZlcik7XG4gIH1cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVG1wbEFzdFZhcmlhYmxlKSB7XG4gICAgY29uc3QgdmFyaWFibGVJZGVudGlmaWVyID0gdGhpcy50YXJnZXRUb0lkZW50aWZpZXIodmFyaWFibGUpO1xuXG4gICAgdGhpcy5pZGVudGlmaWVycy5hZGQodmFyaWFibGVJZGVudGlmaWVyKTtcbiAgfVxuXG4gIC8qKiBDcmVhdGVzIGFuIGlkZW50aWZpZXIgZm9yIGEgdGVtcGxhdGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLiAqL1xuICBwcml2YXRlIGVsZW1lbnRPclRlbXBsYXRlVG9JZGVudGlmaWVyKG5vZGU6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSk6IEVsZW1lbnRJZGVudGlmaWVyXG4gICAgICB8VGVtcGxhdGVOb2RlSWRlbnRpZmllciB7XG4gICAgLy8gSWYgdGhpcyBub2RlIGhhcyBhbHJlYWR5IGJlZW4gc2VlbiwgcmV0dXJuIHRoZSBjYWNoZWQgcmVzdWx0LlxuICAgIGlmICh0aGlzLmVsZW1lbnRBbmRUZW1wbGF0ZUlkZW50aWZpZXJDYWNoZS5oYXMobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmVsZW1lbnRBbmRUZW1wbGF0ZUlkZW50aWZpZXJDYWNoZS5nZXQobm9kZSkhO1xuICAgIH1cblxuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgbGV0IGtpbmQ6IElkZW50aWZpZXJLaW5kLkVsZW1lbnR8SWRlbnRpZmllcktpbmQuVGVtcGxhdGU7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUpIHtcbiAgICAgIG5hbWUgPSBub2RlLnRhZ05hbWU7XG4gICAgICBraW5kID0gSWRlbnRpZmllcktpbmQuVGVtcGxhdGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBub2RlLm5hbWU7XG4gICAgICBraW5kID0gSWRlbnRpZmllcktpbmQuRWxlbWVudDtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5vZGUuc3RhcnRTb3VyY2VTcGFuO1xuICAgIC8vIEFuIGVsZW1lbnQncyBvciB0ZW1wbGF0ZSdzIHNvdXJjZSBzcGFuIGNhbiBiZSBvZiB0aGUgZm9ybSBgPGVsZW1lbnQ+YCwgYDxlbGVtZW50IC8+YCwgb3JcbiAgICAvLyBgPGVsZW1lbnQ+PC9lbGVtZW50PmAuIE9ubHkgdGhlIHNlbGVjdG9yIGlzIGludGVyZXN0aW5nIHRvIHRoZSBpbmRleGVyLCBzbyB0aGUgc291cmNlIGlzXG4gICAgLy8gc2VhcmNoZWQgZm9yIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIHRoZSBlbGVtZW50IChzZWxlY3RvcikgbmFtZS5cbiAgICBjb25zdCBzdGFydCA9IHRoaXMuZ2V0U3RhcnRMb2NhdGlvbihuYW1lLCBzb3VyY2VTcGFuKTtcbiAgICBjb25zdCBhYnNvbHV0ZVNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHN0YXJ0LCBzdGFydCArIG5hbWUubGVuZ3RoKTtcblxuICAgIC8vIFJlY29yZCB0aGUgbm9kZXMncyBhdHRyaWJ1dGVzLCB3aGljaCBhbiBpbmRleGVyIGNhbiBsYXRlciB0cmF2ZXJzZSB0byBzZWUgaWYgYW55IG9mIHRoZW1cbiAgICAvLyBzcGVjaWZ5IGEgdXNlZCBkaXJlY3RpdmUgb24gdGhlIG5vZGUuXG4gICAgY29uc3QgYXR0cmlidXRlcyA9IG5vZGUuYXR0cmlidXRlcy5tYXAoKHtuYW1lLCBzb3VyY2VTcGFufSk6IEF0dHJpYnV0ZUlkZW50aWZpZXIgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgc3BhbjogbmV3IEFic29sdXRlU291cmNlU3Bhbihzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCwgc291cmNlU3Bhbi5lbmQub2Zmc2V0KSxcbiAgICAgICAga2luZDogSWRlbnRpZmllcktpbmQuQXR0cmlidXRlLFxuICAgICAgfTtcbiAgICB9KTtcbiAgICBjb25zdCB1c2VkRGlyZWN0aXZlcyA9IHRoaXMuYm91bmRUZW1wbGF0ZS5nZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGUpIHx8IFtdO1xuXG4gICAgY29uc3QgaWRlbnRpZmllciA9IHtcbiAgICAgIG5hbWUsXG4gICAgICBzcGFuOiBhYnNvbHV0ZVNwYW4sXG4gICAgICBraW5kLFxuICAgICAgYXR0cmlidXRlczogbmV3IFNldChhdHRyaWJ1dGVzKSxcbiAgICAgIHVzZWREaXJlY3RpdmVzOiBuZXcgU2V0KHVzZWREaXJlY3RpdmVzLm1hcChkaXIgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG5vZGU6IGRpci5yZWYubm9kZSxcbiAgICAgICAgICBzZWxlY3RvcjogZGlyLnNlbGVjdG9yLFxuICAgICAgICB9O1xuICAgICAgfSkpLFxuICAgICAgLy8gY2FzdCBiL2MgcHJlLVR5cGVTY3JpcHQgMy41IHVuaW9ucyBhcmVuJ3Qgd2VsbCBkaXNjcmltaW5hdGVkXG4gICAgfSBhcyBFbGVtZW50SWRlbnRpZmllciB8XG4gICAgICAgIFRlbXBsYXRlTm9kZUlkZW50aWZpZXI7XG5cbiAgICB0aGlzLmVsZW1lbnRBbmRUZW1wbGF0ZUlkZW50aWZpZXJDYWNoZS5zZXQobm9kZSwgaWRlbnRpZmllcik7XG4gICAgcmV0dXJuIGlkZW50aWZpZXI7XG4gIH1cblxuICAvKiogQ3JlYXRlcyBhbiBpZGVudGlmaWVyIGZvciBhIHRlbXBsYXRlIHJlZmVyZW5jZSBvciB0ZW1wbGF0ZSB2YXJpYWJsZSB0YXJnZXQuICovXG4gIHByaXZhdGUgdGFyZ2V0VG9JZGVudGlmaWVyKG5vZGU6IFRtcGxBc3RSZWZlcmVuY2V8VG1wbEFzdFZhcmlhYmxlKTogVGFyZ2V0SWRlbnRpZmllciB7XG4gICAgLy8gSWYgdGhpcyBub2RlIGhhcyBhbHJlYWR5IGJlZW4gc2VlbiwgcmV0dXJuIHRoZSBjYWNoZWQgcmVzdWx0LlxuICAgIGlmICh0aGlzLnRhcmdldElkZW50aWZpZXJDYWNoZS5oYXMobm9kZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnRhcmdldElkZW50aWZpZXJDYWNoZS5nZXQobm9kZSkhO1xuICAgIH1cblxuICAgIGNvbnN0IHtuYW1lLCBzb3VyY2VTcGFufSA9IG5vZGU7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmdldFN0YXJ0TG9jYXRpb24obmFtZSwgc291cmNlU3Bhbik7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3RhcnQsIHN0YXJ0ICsgbmFtZS5sZW5ndGgpO1xuICAgIGxldCBpZGVudGlmaWVyOiBSZWZlcmVuY2VJZGVudGlmaWVyfFZhcmlhYmxlSWRlbnRpZmllcjtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RSZWZlcmVuY2UpIHtcbiAgICAgIC8vIElmIHRoZSBub2RlIGlzIGEgcmVmZXJlbmNlLCB3ZSBjYXJlIGFib3V0IGl0cyB0YXJnZXQuIFRoZSB0YXJnZXQgY2FuIGJlIGFuIGVsZW1lbnQsIGFcbiAgICAgIC8vIHRlbXBsYXRlLCBhIGRpcmVjdGl2ZSBhcHBsaWVkIG9uIGEgdGVtcGxhdGUgb3IgZWxlbWVudCAoaW4gd2hpY2ggY2FzZSB0aGUgZGlyZWN0aXZlIGZpZWxkXG4gICAgICAvLyBpcyBub24tbnVsbCksIG9yIG5vdGhpbmcgYXQgYWxsLlxuICAgICAgY29uc3QgcmVmVGFyZ2V0ID0gdGhpcy5ib3VuZFRlbXBsYXRlLmdldFJlZmVyZW5jZVRhcmdldChub2RlKTtcbiAgICAgIGxldCB0YXJnZXQgPSBudWxsO1xuICAgICAgaWYgKHJlZlRhcmdldCkge1xuICAgICAgICBpZiAocmVmVGFyZ2V0IGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQgfHwgcmVmVGFyZ2V0IGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlKSB7XG4gICAgICAgICAgdGFyZ2V0ID0ge1xuICAgICAgICAgICAgbm9kZTogdGhpcy5lbGVtZW50T3JUZW1wbGF0ZVRvSWRlbnRpZmllcihyZWZUYXJnZXQpLFxuICAgICAgICAgICAgZGlyZWN0aXZlOiBudWxsLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGFyZ2V0ID0ge1xuICAgICAgICAgICAgbm9kZTogdGhpcy5lbGVtZW50T3JUZW1wbGF0ZVRvSWRlbnRpZmllcihyZWZUYXJnZXQubm9kZSksXG4gICAgICAgICAgICBkaXJlY3RpdmU6IHJlZlRhcmdldC5kaXJlY3RpdmUucmVmLm5vZGUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZGVudGlmaWVyID0ge1xuICAgICAgICBuYW1lLFxuICAgICAgICBzcGFuLFxuICAgICAgICBraW5kOiBJZGVudGlmaWVyS2luZC5SZWZlcmVuY2UsXG4gICAgICAgIHRhcmdldCxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlkZW50aWZpZXIgPSB7XG4gICAgICAgIG5hbWUsXG4gICAgICAgIHNwYW4sXG4gICAgICAgIGtpbmQ6IElkZW50aWZpZXJLaW5kLlZhcmlhYmxlLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldElkZW50aWZpZXJDYWNoZS5zZXQobm9kZSwgaWRlbnRpZmllcik7XG4gICAgcmV0dXJuIGlkZW50aWZpZXI7XG4gIH1cblxuICAvKiogR2V0cyB0aGUgc3RhcnQgbG9jYXRpb24gb2YgYSBzdHJpbmcgaW4gYSBTb3VyY2VTcGFuICovXG4gIHByaXZhdGUgZ2V0U3RhcnRMb2NhdGlvbihuYW1lOiBzdHJpbmcsIGNvbnRleHQ6IFBhcnNlU291cmNlU3Bhbik6IG51bWJlciB7XG4gICAgY29uc3QgbG9jYWxTdHIgPSBjb250ZXh0LnRvU3RyaW5nKCk7XG4gICAgaWYgKCFsb2NhbFN0ci5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbXBvc3NpYmxlIHN0YXRlOiBcIiR7bmFtZX1cIiBub3QgZm91bmQgaW4gXCIke2xvY2FsU3RyfVwiYCk7XG4gICAgfVxuICAgIHJldHVybiBjb250ZXh0LnN0YXJ0Lm9mZnNldCArIGxvY2FsU3RyLmluZGV4T2YobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogVmlzaXRzIGEgbm9kZSdzIGV4cHJlc3Npb24gYW5kIGFkZHMgaXRzIGlkZW50aWZpZXJzLCBpZiBhbnksIHRvIHRoZSB2aXNpdG9yJ3Mgc3RhdGUuXG4gICAqIE9ubHkgQVNUcyB3aXRoIGluZm9ybWF0aW9uIGFib3V0IHRoZSBleHByZXNzaW9uIHNvdXJjZSBhbmQgaXRzIGxvY2F0aW9uIGFyZSB2aXNpdGVkLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZSBub2RlIHdob3NlIGV4cHJlc3Npb24gdG8gdmlzaXRcbiAgICovXG4gIHByaXZhdGUgdmlzaXRFeHByZXNzaW9uKGFzdDogQVNUKSB7XG4gICAgLy8gT25seSBpbmNsdWRlIEFTVHMgdGhhdCBoYXZlIGluZm9ybWF0aW9uIGFib3V0IHRoZWlyIHNvdXJjZSBhbmQgYWJzb2x1dGUgc291cmNlIHNwYW5zLlxuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlICYmIGFzdC5zb3VyY2UgIT09IG51bGwpIHtcbiAgICAgIC8vIE1ha2UgdGFyZ2V0IHRvIGlkZW50aWZpZXIgbWFwcGluZyBjbG9zdXJlIHN0YXRlZnVsIHRvIHRoaXMgdmlzaXRvciBpbnN0YW5jZS5cbiAgICAgIGNvbnN0IHRhcmdldFRvSWRlbnRpZmllciA9IHRoaXMudGFyZ2V0VG9JZGVudGlmaWVyLmJpbmQodGhpcyk7XG4gICAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IGFzdC5zb3VyY2VTcGFuLnN0YXJ0O1xuICAgICAgY29uc3QgaWRlbnRpZmllcnMgPSBFeHByZXNzaW9uVmlzaXRvci5nZXRJZGVudGlmaWVycyhcbiAgICAgICAgICBhc3QsIGFzdC5zb3VyY2UsIGFic29sdXRlT2Zmc2V0LCB0aGlzLmJvdW5kVGVtcGxhdGUsIHRhcmdldFRvSWRlbnRpZmllcik7XG4gICAgICBpZGVudGlmaWVycy5mb3JFYWNoKGlkID0+IHRoaXMuaWRlbnRpZmllcnMuYWRkKGlkKSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVHJhdmVyc2VzIGEgdGVtcGxhdGUgQVNUIGFuZCBidWlsZHMgaWRlbnRpZmllcnMgZGlzY292ZXJlZCBpbiBpdC5cbiAqXG4gKiBAcGFyYW0gYm91bmRUZW1wbGF0ZSBib3VuZCB0ZW1wbGF0ZSB0YXJnZXQsIHdoaWNoIGNhbiBiZSB1c2VkIGZvciBxdWVyeWluZyBleHByZXNzaW9uIHRhcmdldHMuXG4gKiBAcmV0dXJuIGlkZW50aWZpZXJzIGluIHRlbXBsYXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUZW1wbGF0ZUlkZW50aWZpZXJzKGJvdW5kVGVtcGxhdGU6IEJvdW5kVGFyZ2V0PENvbXBvbmVudE1ldGE+KTpcbiAgICBTZXQ8VG9wTGV2ZWxJZGVudGlmaWVyPiB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgVGVtcGxhdGVWaXNpdG9yKGJvdW5kVGVtcGxhdGUpO1xuICBpZiAoYm91bmRUZW1wbGF0ZS50YXJnZXQudGVtcGxhdGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHZpc2l0b3IudmlzaXRBbGwoYm91bmRUZW1wbGF0ZS50YXJnZXQudGVtcGxhdGUpO1xuICB9XG4gIHJldHVybiB2aXNpdG9yLmlkZW50aWZpZXJzO1xufVxuIl19