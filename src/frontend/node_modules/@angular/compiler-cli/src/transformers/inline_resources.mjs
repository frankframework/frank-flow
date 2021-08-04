/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isClassMetadata, isMetadataImportedSymbolReferenceExpression, isMetadataSymbolicCallExpression } from '../metadata/index';
const PRECONDITIONS_TEXT = 'angularCompilerOptions.enableResourceInlining requires all resources to be statically resolvable.';
function getResourceLoader(host, containingFileName) {
    return {
        get(url) {
            if (typeof url !== 'string') {
                throw new Error('templateUrl and stylesUrl must be string literals. ' + PRECONDITIONS_TEXT);
            }
            const fileName = host.resourceNameToFileName(url, containingFileName);
            if (fileName) {
                const content = host.loadResource(fileName);
                if (typeof content !== 'string') {
                    throw new Error('Cannot handle async resource. ' + PRECONDITIONS_TEXT);
                }
                return content;
            }
            throw new Error(`Failed to resolve ${url} from ${containingFileName}. ${PRECONDITIONS_TEXT}`);
        }
    };
}
export class InlineResourcesMetadataTransformer {
    constructor(host) {
        this.host = host;
    }
    start(sourceFile) {
        const loader = getResourceLoader(this.host, sourceFile.fileName);
        return (value, node) => {
            if (isClassMetadata(value) && ts.isClassDeclaration(node) && value.decorators) {
                value.decorators.forEach(d => {
                    if (isMetadataSymbolicCallExpression(d) &&
                        isMetadataImportedSymbolReferenceExpression(d.expression) &&
                        d.expression.module === '@angular/core' && d.expression.name === 'Component' &&
                        d.arguments) {
                        // Arguments to an @Component that was compiled successfully are always
                        // MetadataObject(s).
                        d.arguments = d.arguments
                            .map(this.updateDecoratorMetadata.bind(this, loader));
                    }
                });
            }
            return value;
        };
    }
    updateDecoratorMetadata(loader, arg) {
        if (arg['templateUrl']) {
            arg['template'] = loader.get(arg['templateUrl']);
            delete arg['templateUrl'];
        }
        const styles = arg['styles'] || [];
        const styleUrls = arg['styleUrls'] || [];
        if (!Array.isArray(styles))
            throw new Error('styles should be an array');
        if (!Array.isArray(styleUrls))
            throw new Error('styleUrls should be an array');
        styles.push(...styleUrls.map(styleUrl => loader.get(styleUrl)));
        if (styles.length > 0) {
            arg['styles'] = styles;
            delete arg['styleUrls'];
        }
        return arg;
    }
}
export function getInlineResourcesTransformFactory(program, host) {
    return (context) => (sourceFile) => {
        const loader = getResourceLoader(host, sourceFile.fileName);
        const visitor = node => {
            // Components are always classes; skip any other node
            if (!ts.isClassDeclaration(node)) {
                return node;
            }
            // Decorator case - before or without decorator downleveling
            // @Component()
            const newDecorators = ts.visitNodes(node.decorators, (node) => {
                if (ts.isDecorator(node) && isComponentDecorator(node, program.getTypeChecker())) {
                    return updateDecorator(node, loader);
                }
                return node;
            });
            // Annotation case - after decorator downleveling
            // static decorators: {type: Function, args?: any[]}[]
            const newMembers = ts.visitNodes(node.members, (node) => {
                if (ts.isClassElement(node)) {
                    return updateAnnotations(node, loader, program.getTypeChecker());
                }
                else {
                    return node;
                }
            });
            // Create a new AST subtree with our modifications
            return ts.updateClassDeclaration(node, newDecorators, node.modifiers, node.name, node.typeParameters, node.heritageClauses || [], newMembers);
        };
        return ts.visitEachChild(sourceFile, visitor, context);
    };
}
/**
 * Update a Decorator AST node to inline the resources
 * @param node the @Component decorator
 * @param loader provides access to load resources
 */
function updateDecorator(node, loader) {
    if (!ts.isCallExpression(node.expression)) {
        // User will get an error somewhere else with bare @Component
        return node;
    }
    const expr = node.expression;
    const newArguments = updateComponentProperties(expr.arguments, loader);
    return ts.updateDecorator(node, ts.updateCall(expr, expr.expression, expr.typeArguments, newArguments));
}
/**
 * Update an Annotations AST node to inline the resources
 * @param node the static decorators property
 * @param loader provides access to load resources
 * @param typeChecker provides access to symbol table
 */
function updateAnnotations(node, loader, typeChecker) {
    // Looking for a member of this shape:
    // PropertyDeclaration called decorators, with static modifier
    // Initializer is ArrayLiteralExpression
    // One element is the Component type, its initializer is the @angular/core Component symbol
    // One element is the component args, its initializer is the Component arguments to change
    // e.g.
    //   static decorators: {type: Function, args?: any[]}[] =
    //   [{
    //     type: Component,
    //     args: [{
    //       templateUrl: './my.component.html',
    //       styleUrls: ['./my.component.css'],
    //     }],
    //   }];
    if (!ts.isPropertyDeclaration(node) || // ts.ModifierFlags.Static &&
        !ts.isIdentifier(node.name) || node.name.text !== 'decorators' || !node.initializer ||
        !ts.isArrayLiteralExpression(node.initializer)) {
        return node;
    }
    const newAnnotations = node.initializer.elements.map(annotation => {
        // No-op if there's a non-object-literal mixed in the decorators values
        if (!ts.isObjectLiteralExpression(annotation))
            return annotation;
        const decoratorType = annotation.properties.find(p => isIdentifierNamed(p, 'type'));
        // No-op if there's no 'type' property, or if it's not initialized to the Component symbol
        if (!decoratorType || !ts.isPropertyAssignment(decoratorType) ||
            !ts.isIdentifier(decoratorType.initializer) ||
            !isComponentSymbol(decoratorType.initializer, typeChecker)) {
            return annotation;
        }
        const newAnnotation = annotation.properties.map(prop => {
            // No-op if this isn't the 'args' property or if it's not initialized to an array
            if (!isIdentifierNamed(prop, 'args') || !ts.isPropertyAssignment(prop) ||
                !ts.isArrayLiteralExpression(prop.initializer))
                return prop;
            const newDecoratorArgs = ts.updatePropertyAssignment(prop, prop.name, ts.createArrayLiteral(updateComponentProperties(prop.initializer.elements, loader)));
            return newDecoratorArgs;
        });
        return ts.updateObjectLiteral(annotation, newAnnotation);
    });
    return ts.updateProperty(node, node.decorators, node.modifiers, node.name, node.questionToken, node.type, ts.updateArrayLiteral(node.initializer, newAnnotations));
}
function isIdentifierNamed(p, name) {
    return !!p.name && ts.isIdentifier(p.name) && p.name.text === name;
}
/**
 * Check that the node we are visiting is the actual Component decorator defined in @angular/core.
 */
function isComponentDecorator(node, typeChecker) {
    if (!ts.isCallExpression(node.expression)) {
        return false;
    }
    const callExpr = node.expression;
    let identifier;
    if (ts.isIdentifier(callExpr.expression)) {
        identifier = callExpr.expression;
    }
    else {
        return false;
    }
    return isComponentSymbol(identifier, typeChecker);
}
function isComponentSymbol(identifier, typeChecker) {
    // Only handle identifiers, not expressions
    if (!ts.isIdentifier(identifier))
        return false;
    // NOTE: resolver.getReferencedImportDeclaration would work as well but is internal
    const symbol = typeChecker.getSymbolAtLocation(identifier);
    if (!symbol || !symbol.declarations || !symbol.declarations.length) {
        console.error(`Unable to resolve symbol '${identifier.text}' in the program, does it type-check?`);
        return false;
    }
    const declaration = symbol.declarations[0];
    if (!declaration || !ts.isImportSpecifier(declaration)) {
        return false;
    }
    const name = (declaration.propertyName || declaration.name).text;
    // We know that parent pointers are set because we created the SourceFile ourselves.
    // The number of parent references here match the recursion depth at this point.
    const moduleId = declaration.parent.parent.parent.moduleSpecifier.text;
    return moduleId === '@angular/core' && name === 'Component';
}
/**
 * For each property in the object literal, if it's templateUrl or styleUrls, replace it
 * with content.
 * @param node the arguments to @Component() or args property of decorators: [{type:Component}]
 * @param loader provides access to the loadResource method of the host
 * @returns updated arguments
 */
function updateComponentProperties(args, loader) {
    if (args.length !== 1) {
        // User should have gotten a type-check error because @Component takes one argument
        return args;
    }
    const componentArg = args[0];
    if (!ts.isObjectLiteralExpression(componentArg)) {
        // User should have gotten a type-check error because @Component takes an object literal
        // argument
        return args;
    }
    const newProperties = [];
    const newStyleExprs = [];
    componentArg.properties.forEach(prop => {
        if (!ts.isPropertyAssignment(prop) || ts.isComputedPropertyName(prop.name)) {
            newProperties.push(prop);
            return;
        }
        switch (prop.name.text) {
            case 'styles':
                if (!ts.isArrayLiteralExpression(prop.initializer)) {
                    throw new Error('styles takes an array argument');
                }
                newStyleExprs.push(...prop.initializer.elements);
                break;
            case 'styleUrls':
                if (!ts.isArrayLiteralExpression(prop.initializer)) {
                    throw new Error('styleUrls takes an array argument');
                }
                newStyleExprs.push(...prop.initializer.elements.map((expr) => {
                    if (!ts.isStringLiteral(expr) && !ts.isNoSubstitutionTemplateLiteral(expr)) {
                        throw new Error('Can only accept string literal arguments to styleUrls. ' + PRECONDITIONS_TEXT);
                    }
                    const styles = loader.get(expr.text);
                    return ts.createLiteral(styles);
                }));
                break;
            case 'templateUrl':
                if (!ts.isStringLiteral(prop.initializer) &&
                    !ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
                    throw new Error('Can only accept a string literal argument to templateUrl. ' + PRECONDITIONS_TEXT);
                }
                const template = loader.get(prop.initializer.text);
                newProperties.push(ts.updatePropertyAssignment(prop, ts.createIdentifier('template'), ts.createLiteral(template)));
                break;
            default:
                newProperties.push(prop);
        }
    });
    // Add the non-inline styles
    if (newStyleExprs.length > 0) {
        const newStyles = ts.createPropertyAssignment(ts.createIdentifier('styles'), ts.createArrayLiteral(newStyleExprs));
        newProperties.push(newStyles);
    }
    return ts.createNodeArray([ts.updateObjectLiteral(componentArg, newProperties)]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lX3Jlc291cmNlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvdHJhbnNmb3JtZXJzL2lubGluZV9yZXNvdXJjZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLGVBQWUsRUFBRSwyQ0FBMkMsRUFBRSxnQ0FBZ0MsRUFBZ0MsTUFBTSxtQkFBbUIsQ0FBQztBQUloSyxNQUFNLGtCQUFrQixHQUNwQixtR0FBbUcsQ0FBQztBQVl4RyxTQUFTLGlCQUFpQixDQUFDLElBQW1CLEVBQUUsa0JBQTBCO0lBQ3hFLE9BQU87UUFDTCxHQUFHLENBQUMsR0FBeUI7WUFDM0IsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7Z0JBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELEdBQUcsa0JBQWtCLENBQUMsQ0FBQzthQUM3RjtZQUNELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUN0RSxJQUFJLFFBQVEsRUFBRTtnQkFDWixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM1QyxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTtvQkFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN4RTtnQkFDRCxPQUFPLE9BQU8sQ0FBQzthQUNoQjtZQUNELE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLEdBQUcsU0FBUyxrQkFBa0IsS0FBSyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDaEcsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxPQUFPLGtDQUFr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QyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDL0I7SUFFRCxPQUFPLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2lzQ2xhc3NNZXRhZGF0YSwgaXNNZXRhZGF0YUltcG9ydGVkU3ltYm9sUmVmZXJlbmNlRXhwcmVzc2lvbiwgaXNNZXRhZGF0YVN5bWJvbGljQ2FsbEV4cHJlc3Npb24sIE1ldGFkYXRhT2JqZWN0LCBNZXRhZGF0YVZhbHVlfSBmcm9tICcuLi9tZXRhZGF0YS9pbmRleCc7XG5cbmltcG9ydCB7TWV0YWRhdGFUcmFuc2Zvcm1lciwgVmFsdWVUcmFuc2Zvcm19IGZyb20gJy4vbWV0YWRhdGFfY2FjaGUnO1xuXG5jb25zdCBQUkVDT05ESVRJT05TX1RFWFQgPVxuICAgICdhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmVuYWJsZVJlc291cmNlSW5saW5pbmcgcmVxdWlyZXMgYWxsIHJlc291cmNlcyB0byBiZSBzdGF0aWNhbGx5IHJlc29sdmFibGUuJztcblxuLyoqIEEgc3Vic2V0IG9mIG1lbWJlcnMgZnJvbSBBb3RDb21waWxlckhvc3QgKi9cbmV4cG9ydCB0eXBlIFJlc291cmNlc0hvc3QgPSB7XG4gIHJlc291cmNlTmFtZVRvRmlsZU5hbWUocmVzb3VyY2VOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nfG51bGw7XG4gIGxvYWRSZXNvdXJjZShwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz58IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFN0YXRpY1Jlc291cmNlTG9hZGVyID0ge1xuICBnZXQodXJsOiBzdHJpbmd8TWV0YWRhdGFWYWx1ZSk6IHN0cmluZztcbn07XG5cbmZ1bmN0aW9uIGdldFJlc291cmNlTG9hZGVyKGhvc3Q6IFJlc291cmNlc0hvc3QsIGNvbnRhaW5pbmdGaWxlTmFtZTogc3RyaW5nKTogU3RhdGljUmVzb3VyY2VMb2FkZXIge1xuICByZXR1cm4ge1xuICAgIGdldCh1cmw6IHN0cmluZ3xNZXRhZGF0YVZhbHVlKTogc3RyaW5nIHtcbiAgICAgIGlmICh0eXBlb2YgdXJsICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RlbXBsYXRlVXJsIGFuZCBzdHlsZXNVcmwgbXVzdCBiZSBzdHJpbmcgbGl0ZXJhbHMuICcgKyBQUkVDT05ESVRJT05TX1RFWFQpO1xuICAgICAgfVxuICAgICAgY29uc3QgZmlsZU5hbWUgPSBob3N0LnJlc291cmNlTmFtZVRvRmlsZU5hbWUodXJsLCBjb250YWluaW5nRmlsZU5hbWUpO1xuICAgICAgaWYgKGZpbGVOYW1lKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LmxvYWRSZXNvdXJjZShmaWxlTmFtZSk7XG4gICAgICAgIGlmICh0eXBlb2YgY29udGVudCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBoYW5kbGUgYXN5bmMgcmVzb3VyY2UuICcgKyBQUkVDT05ESVRJT05TX1RFWFQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZW50O1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcmVzb2x2ZSAke3VybH0gZnJvbSAke2NvbnRhaW5pbmdGaWxlTmFtZX0uICR7UFJFQ09ORElUSU9OU19URVhUfWApO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIElubGluZVJlc291cmNlc01ldGFkYXRhVHJhbnNmb3JtZXIgaW1wbGVtZW50cyBNZXRhZGF0YVRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBob3N0OiBSZXNvdXJjZXNIb3N0KSB7fVxuXG4gIHN0YXJ0KHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBWYWx1ZVRyYW5zZm9ybXx1bmRlZmluZWQge1xuICAgIGNvbnN0IGxvYWRlciA9IGdldFJlc291cmNlTG9hZGVyKHRoaXMuaG9zdCwgc291cmNlRmlsZS5maWxlTmFtZSk7XG4gICAgcmV0dXJuICh2YWx1ZTogTWV0YWRhdGFWYWx1ZSwgbm9kZTogdHMuTm9kZSk6IE1ldGFkYXRhVmFsdWUgPT4ge1xuICAgICAgaWYgKGlzQ2xhc3NNZXRhZGF0YSh2YWx1ZSkgJiYgdHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUpICYmIHZhbHVlLmRlY29yYXRvcnMpIHtcbiAgICAgICAgdmFsdWUuZGVjb3JhdG9ycy5mb3JFYWNoKGQgPT4ge1xuICAgICAgICAgIGlmIChpc01ldGFkYXRhU3ltYm9saWNDYWxsRXhwcmVzc2lvbihkKSAmJlxuICAgICAgICAgICAgICBpc01ldGFkYXRhSW1wb3J0ZWRTeW1ib2xSZWZlcmVuY2VFeHByZXNzaW9uKGQuZXhwcmVzc2lvbikgJiZcbiAgICAgICAgICAgICAgZC5leHByZXNzaW9uLm1vZHVsZSA9PT0gJ0Bhbmd1bGFyL2NvcmUnICYmIGQuZXhwcmVzc2lvbi5uYW1lID09PSAnQ29tcG9uZW50JyAmJlxuICAgICAgICAgICAgICBkLmFyZ3VtZW50cykge1xuICAgICAgICAgICAgLy8gQXJndW1lbnRzIHRvIGFuIEBDb21wb25lbnQgdGhhdCB3YXMgY29tcGlsZWQgc3VjY2Vzc2Z1bGx5IGFyZSBhbHdheXNcbiAgICAgICAgICAgIC8vIE1ldGFkYXRhT2JqZWN0KHMpLlxuICAgICAgICAgICAgZC5hcmd1bWVudHMgPSAoZC5hcmd1bWVudHMgYXMgTWV0YWRhdGFPYmplY3RbXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAodGhpcy51cGRhdGVEZWNvcmF0b3JNZXRhZGF0YS5iaW5kKHRoaXMsIGxvYWRlcikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbiAgfVxuXG4gIHVwZGF0ZURlY29yYXRvck1ldGFkYXRhKGxvYWRlcjogU3RhdGljUmVzb3VyY2VMb2FkZXIsIGFyZzogTWV0YWRhdGFPYmplY3QpOiBNZXRhZGF0YU9iamVjdCB7XG4gICAgaWYgKGFyZ1sndGVtcGxhdGVVcmwnXSkge1xuICAgICAgYXJnWyd0ZW1wbGF0ZSddID0gbG9hZGVyLmdldChhcmdbJ3RlbXBsYXRlVXJsJ10pO1xuICAgICAgZGVsZXRlIGFyZ1sndGVtcGxhdGVVcmwnXTtcbiAgICB9XG5cbiAgICBjb25zdCBzdHlsZXMgPSBhcmdbJ3N0eWxlcyddIHx8IFtdO1xuICAgIGNvbnN0IHN0eWxlVXJscyA9IGFyZ1snc3R5bGVVcmxzJ10gfHwgW107XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHN0eWxlcykpIHRocm93IG5ldyBFcnJvcignc3R5bGVzIHNob3VsZCBiZSBhbiBhcnJheScpO1xuICAgIGlmICghQXJyYXkuaXNBcnJheShzdHlsZVVybHMpKSB0aHJvdyBuZXcgRXJyb3IoJ3N0eWxlVXJscyBzaG91bGQgYmUgYW4gYXJyYXknKTtcblxuICAgIHN0eWxlcy5wdXNoKC4uLnN0eWxlVXJscy5tYXAoc3R5bGVVcmwgPT4gbG9hZGVyLmdldChzdHlsZVVybCkpKTtcbiAgICBpZiAoc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGFyZ1snc3R5bGVzJ10gPSBzdHlsZXM7XG4gICAgICBkZWxldGUgYXJnWydzdHlsZVVybHMnXTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXJnO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmxpbmVSZXNvdXJjZXNUcmFuc2Zvcm1GYWN0b3J5KFxuICAgIHByb2dyYW06IHRzLlByb2dyYW0sIGhvc3Q6IFJlc291cmNlc0hvc3QpOiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuU291cmNlRmlsZT4ge1xuICByZXR1cm4gKGNvbnRleHQ6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCkgPT4gKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHtcbiAgICBjb25zdCBsb2FkZXIgPSBnZXRSZXNvdXJjZUxvYWRlcihob3N0LCBzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgICBjb25zdCB2aXNpdG9yOiB0cy5WaXNpdG9yID0gbm9kZSA9PiB7XG4gICAgICAvLyBDb21wb25lbnRzIGFyZSBhbHdheXMgY2xhc3Nlczsgc2tpcCBhbnkgb3RoZXIgbm9kZVxuICAgICAgaWYgKCF0cy5pc0NsYXNzRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9XG5cbiAgICAgIC8vIERlY29yYXRvciBjYXNlIC0gYmVmb3JlIG9yIHdpdGhvdXQgZGVjb3JhdG9yIGRvd25sZXZlbGluZ1xuICAgICAgLy8gQENvbXBvbmVudCgpXG4gICAgICBjb25zdCBuZXdEZWNvcmF0b3JzID0gdHMudmlzaXROb2Rlcyhub2RlLmRlY29yYXRvcnMsIChub2RlOiB0cy5Ob2RlKSA9PiB7XG4gICAgICAgIGlmICh0cy5pc0RlY29yYXRvcihub2RlKSAmJiBpc0NvbXBvbmVudERlY29yYXRvcihub2RlLCBwcm9ncmFtLmdldFR5cGVDaGVja2VyKCkpKSB7XG4gICAgICAgICAgcmV0dXJuIHVwZGF0ZURlY29yYXRvcihub2RlLCBsb2FkZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFubm90YXRpb24gY2FzZSAtIGFmdGVyIGRlY29yYXRvciBkb3dubGV2ZWxpbmdcbiAgICAgIC8vIHN0YXRpYyBkZWNvcmF0b3JzOiB7dHlwZTogRnVuY3Rpb24sIGFyZ3M/OiBhbnlbXX1bXVxuICAgICAgY29uc3QgbmV3TWVtYmVycyA9IHRzLnZpc2l0Tm9kZXMobm9kZS5tZW1iZXJzLCAobm9kZTogdHMuTm9kZSkgPT4ge1xuICAgICAgICBpZiAodHMuaXNDbGFzc0VsZW1lbnQobm9kZSkpIHtcbiAgICAgICAgICByZXR1cm4gdXBkYXRlQW5ub3RhdGlvbnMobm9kZSwgbG9hZGVyLCBwcm9ncmFtLmdldFR5cGVDaGVja2VyKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBub2RlO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIGEgbmV3IEFTVCBzdWJ0cmVlIHdpdGggb3VyIG1vZGlmaWNhdGlvbnNcbiAgICAgIHJldHVybiB0cy51cGRhdGVDbGFzc0RlY2xhcmF0aW9uKFxuICAgICAgICAgIG5vZGUsIG5ld0RlY29yYXRvcnMsIG5vZGUubW9kaWZpZXJzLCBub2RlLm5hbWUsIG5vZGUudHlwZVBhcmFtZXRlcnMsXG4gICAgICAgICAgbm9kZS5oZXJpdGFnZUNsYXVzZXMgfHwgW10sIG5ld01lbWJlcnMpO1xuICAgIH07XG5cbiAgICByZXR1cm4gdHMudmlzaXRFYWNoQ2hpbGQoc291cmNlRmlsZSwgdmlzaXRvciwgY29udGV4dCk7XG4gIH07XG59XG5cbi8qKlxuICogVXBkYXRlIGEgRGVjb3JhdG9yIEFTVCBub2RlIHRvIGlubGluZSB0aGUgcmVzb3VyY2VzXG4gKiBAcGFyYW0gbm9kZSB0aGUgQENvbXBvbmVudCBkZWNvcmF0b3JcbiAqIEBwYXJhbSBsb2FkZXIgcHJvdmlkZXMgYWNjZXNzIHRvIGxvYWQgcmVzb3VyY2VzXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZURlY29yYXRvcihub2RlOiB0cy5EZWNvcmF0b3IsIGxvYWRlcjogU3RhdGljUmVzb3VyY2VMb2FkZXIpOiB0cy5EZWNvcmF0b3Ige1xuICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uKSkge1xuICAgIC8vIFVzZXIgd2lsbCBnZXQgYW4gZXJyb3Igc29tZXdoZXJlIGVsc2Ugd2l0aCBiYXJlIEBDb21wb25lbnRcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuICBjb25zdCBleHByID0gbm9kZS5leHByZXNzaW9uO1xuICBjb25zdCBuZXdBcmd1bWVudHMgPSB1cGRhdGVDb21wb25lbnRQcm9wZXJ0aWVzKGV4cHIuYXJndW1lbnRzLCBsb2FkZXIpO1xuICByZXR1cm4gdHMudXBkYXRlRGVjb3JhdG9yKFxuICAgICAgbm9kZSwgdHMudXBkYXRlQ2FsbChleHByLCBleHByLmV4cHJlc3Npb24sIGV4cHIudHlwZUFyZ3VtZW50cywgbmV3QXJndW1lbnRzKSk7XG59XG5cbi8qKlxuICogVXBkYXRlIGFuIEFubm90YXRpb25zIEFTVCBub2RlIHRvIGlubGluZSB0aGUgcmVzb3VyY2VzXG4gKiBAcGFyYW0gbm9kZSB0aGUgc3RhdGljIGRlY29yYXRvcnMgcHJvcGVydHlcbiAqIEBwYXJhbSBsb2FkZXIgcHJvdmlkZXMgYWNjZXNzIHRvIGxvYWQgcmVzb3VyY2VzXG4gKiBAcGFyYW0gdHlwZUNoZWNrZXIgcHJvdmlkZXMgYWNjZXNzIHRvIHN5bWJvbCB0YWJsZVxuICovXG5mdW5jdGlvbiB1cGRhdGVBbm5vdGF0aW9ucyhcbiAgICBub2RlOiB0cy5DbGFzc0VsZW1lbnQsIGxvYWRlcjogU3RhdGljUmVzb3VyY2VMb2FkZXIsXG4gICAgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKTogdHMuQ2xhc3NFbGVtZW50IHtcbiAgLy8gTG9va2luZyBmb3IgYSBtZW1iZXIgb2YgdGhpcyBzaGFwZTpcbiAgLy8gUHJvcGVydHlEZWNsYXJhdGlvbiBjYWxsZWQgZGVjb3JhdG9ycywgd2l0aCBzdGF0aWMgbW9kaWZpZXJcbiAgLy8gSW5pdGlhbGl6ZXIgaXMgQXJyYXlMaXRlcmFsRXhwcmVzc2lvblxuICAvLyBPbmUgZWxlbWVudCBpcyB0aGUgQ29tcG9uZW50IHR5cGUsIGl0cyBpbml0aWFsaXplciBpcyB0aGUgQGFuZ3VsYXIvY29yZSBDb21wb25lbnQgc3ltYm9sXG4gIC8vIE9uZSBlbGVtZW50IGlzIHRoZSBjb21wb25lbnQgYXJncywgaXRzIGluaXRpYWxpemVyIGlzIHRoZSBDb21wb25lbnQgYXJndW1lbnRzIHRvIGNoYW5nZVxuICAvLyBlLmcuXG4gIC8vICAgc3RhdGljIGRlY29yYXRvcnM6IHt0eXBlOiBGdW5jdGlvbiwgYXJncz86IGFueVtdfVtdID1cbiAgLy8gICBbe1xuICAvLyAgICAgdHlwZTogQ29tcG9uZW50LFxuICAvLyAgICAgYXJnczogW3tcbiAgLy8gICAgICAgdGVtcGxhdGVVcmw6ICcuL215LmNvbXBvbmVudC5odG1sJyxcbiAgLy8gICAgICAgc3R5bGVVcmxzOiBbJy4vbXkuY29tcG9uZW50LmNzcyddLFxuICAvLyAgICAgfV0sXG4gIC8vICAgfV07XG4gIGlmICghdHMuaXNQcm9wZXJ0eURlY2xhcmF0aW9uKG5vZGUpIHx8ICAvLyB0cy5Nb2RpZmllckZsYWdzLlN0YXRpYyAmJlxuICAgICAgIXRzLmlzSWRlbnRpZmllcihub2RlLm5hbWUpIHx8IG5vZGUubmFtZS50ZXh0ICE9PSAnZGVjb3JhdG9ycycgfHwgIW5vZGUuaW5pdGlhbGl6ZXIgfHxcbiAgICAgICF0cy5pc0FycmF5TGl0ZXJhbEV4cHJlc3Npb24obm9kZS5pbml0aWFsaXplcikpIHtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIGNvbnN0IG5ld0Fubm90YXRpb25zID0gbm9kZS5pbml0aWFsaXplci5lbGVtZW50cy5tYXAoYW5ub3RhdGlvbiA9PiB7XG4gICAgLy8gTm8tb3AgaWYgdGhlcmUncyBhIG5vbi1vYmplY3QtbGl0ZXJhbCBtaXhlZCBpbiB0aGUgZGVjb3JhdG9ycyB2YWx1ZXNcbiAgICBpZiAoIXRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24oYW5ub3RhdGlvbikpIHJldHVybiBhbm5vdGF0aW9uO1xuXG4gICAgY29uc3QgZGVjb3JhdG9yVHlwZSA9IGFubm90YXRpb24ucHJvcGVydGllcy5maW5kKHAgPT4gaXNJZGVudGlmaWVyTmFtZWQocCwgJ3R5cGUnKSk7XG5cbiAgICAvLyBOby1vcCBpZiB0aGVyZSdzIG5vICd0eXBlJyBwcm9wZXJ0eSwgb3IgaWYgaXQncyBub3QgaW5pdGlhbGl6ZWQgdG8gdGhlIENvbXBvbmVudCBzeW1ib2xcbiAgICBpZiAoIWRlY29yYXRvclR5cGUgfHwgIXRzLmlzUHJvcGVydHlBc3NpZ25tZW50KGRlY29yYXRvclR5cGUpIHx8XG4gICAgICAgICF0cy5pc0lkZW50aWZpZXIoZGVjb3JhdG9yVHlwZS5pbml0aWFsaXplcikgfHxcbiAgICAgICAgIWlzQ29tcG9uZW50U3ltYm9sKGRlY29yYXRvclR5cGUuaW5pdGlhbGl6ZXIsIHR5cGVDaGVja2VyKSkge1xuICAgICAgcmV0dXJuIGFubm90YXRpb247XG4gICAgfVxuXG4gICAgY29uc3QgbmV3QW5ub3RhdGlvbiA9IGFubm90YXRpb24ucHJvcGVydGllcy5tYXAocHJvcCA9PiB7XG4gICAgICAvLyBOby1vcCBpZiB0aGlzIGlzbid0IHRoZSAnYXJncycgcHJvcGVydHkgb3IgaWYgaXQncyBub3QgaW5pdGlhbGl6ZWQgdG8gYW4gYXJyYXlcbiAgICAgIGlmICghaXNJZGVudGlmaWVyTmFtZWQocHJvcCwgJ2FyZ3MnKSB8fCAhdHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcCkgfHxcbiAgICAgICAgICAhdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKHByb3AuaW5pdGlhbGl6ZXIpKVxuICAgICAgICByZXR1cm4gcHJvcDtcblxuICAgICAgY29uc3QgbmV3RGVjb3JhdG9yQXJncyA9IHRzLnVwZGF0ZVByb3BlcnR5QXNzaWdubWVudChcbiAgICAgICAgICBwcm9wLCBwcm9wLm5hbWUsXG4gICAgICAgICAgdHMuY3JlYXRlQXJyYXlMaXRlcmFsKHVwZGF0ZUNvbXBvbmVudFByb3BlcnRpZXMocHJvcC5pbml0aWFsaXplci5lbGVtZW50cywgbG9hZGVyKSkpO1xuXG4gICAgICByZXR1cm4gbmV3RGVjb3JhdG9yQXJncztcbiAgICB9KTtcblxuICAgIHJldHVybiB0cy51cGRhdGVPYmplY3RMaXRlcmFsKGFubm90YXRpb24sIG5ld0Fubm90YXRpb24pO1xuICB9KTtcblxuICByZXR1cm4gdHMudXBkYXRlUHJvcGVydHkoXG4gICAgICBub2RlLCBub2RlLmRlY29yYXRvcnMsIG5vZGUubW9kaWZpZXJzLCBub2RlLm5hbWUsIG5vZGUucXVlc3Rpb25Ub2tlbiwgbm9kZS50eXBlLFxuICAgICAgdHMudXBkYXRlQXJyYXlMaXRlcmFsKG5vZGUuaW5pdGlhbGl6ZXIsIG5ld0Fubm90YXRpb25zKSk7XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllck5hbWVkKHA6IHRzLk9iamVjdExpdGVyYWxFbGVtZW50TGlrZSwgbmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiAhIXAubmFtZSAmJiB0cy5pc0lkZW50aWZpZXIocC5uYW1lKSAmJiBwLm5hbWUudGV4dCA9PT0gbmFtZTtcbn1cblxuLyoqXG4gKiBDaGVjayB0aGF0IHRoZSBub2RlIHdlIGFyZSB2aXNpdGluZyBpcyB0aGUgYWN0dWFsIENvbXBvbmVudCBkZWNvcmF0b3IgZGVmaW5lZCBpbiBAYW5ndWxhci9jb3JlLlxuICovXG5mdW5jdGlvbiBpc0NvbXBvbmVudERlY29yYXRvcihub2RlOiB0cy5EZWNvcmF0b3IsIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcik6IGJvb2xlYW4ge1xuICBpZiAoIXRzLmlzQ2FsbEV4cHJlc3Npb24obm9kZS5leHByZXNzaW9uKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBjYWxsRXhwciA9IG5vZGUuZXhwcmVzc2lvbjtcblxuICBsZXQgaWRlbnRpZmllcjogdHMuTm9kZTtcblxuICBpZiAodHMuaXNJZGVudGlmaWVyKGNhbGxFeHByLmV4cHJlc3Npb24pKSB7XG4gICAgaWRlbnRpZmllciA9IGNhbGxFeHByLmV4cHJlc3Npb247XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiBpc0NvbXBvbmVudFN5bWJvbChpZGVudGlmaWVyLCB0eXBlQ2hlY2tlcik7XG59XG5cbmZ1bmN0aW9uIGlzQ29tcG9uZW50U3ltYm9sKGlkZW50aWZpZXI6IHRzLk5vZGUsIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcikge1xuICAvLyBPbmx5IGhhbmRsZSBpZGVudGlmaWVycywgbm90IGV4cHJlc3Npb25zXG4gIGlmICghdHMuaXNJZGVudGlmaWVyKGlkZW50aWZpZXIpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTk9URTogcmVzb2x2ZXIuZ2V0UmVmZXJlbmNlZEltcG9ydERlY2xhcmF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCBidXQgaXMgaW50ZXJuYWxcbiAgY29uc3Qgc3ltYm9sID0gdHlwZUNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihpZGVudGlmaWVyKTtcblxuICBpZiAoIXN5bWJvbCB8fCAhc3ltYm9sLmRlY2xhcmF0aW9ucyB8fCAhc3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgVW5hYmxlIHRvIHJlc29sdmUgc3ltYm9sICcke2lkZW50aWZpZXIudGV4dH0nIGluIHRoZSBwcm9ncmFtLCBkb2VzIGl0IHR5cGUtY2hlY2s/YCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgZGVjbGFyYXRpb24gPSBzeW1ib2wuZGVjbGFyYXRpb25zWzBdO1xuXG4gIGlmICghZGVjbGFyYXRpb24gfHwgIXRzLmlzSW1wb3J0U3BlY2lmaWVyKGRlY2xhcmF0aW9uKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IG5hbWUgPSAoZGVjbGFyYXRpb24ucHJvcGVydHlOYW1lIHx8IGRlY2xhcmF0aW9uLm5hbWUpLnRleHQ7XG4gIC8vIFdlIGtub3cgdGhhdCBwYXJlbnQgcG9pbnRlcnMgYXJlIHNldCBiZWNhdXNlIHdlIGNyZWF0ZWQgdGhlIFNvdXJjZUZpbGUgb3Vyc2VsdmVzLlxuICAvLyBUaGUgbnVtYmVyIG9mIHBhcmVudCByZWZlcmVuY2VzIGhlcmUgbWF0Y2ggdGhlIHJlY3Vyc2lvbiBkZXB0aCBhdCB0aGlzIHBvaW50LlxuICBjb25zdCBtb2R1bGVJZCA9IChkZWNsYXJhdGlvbi5wYXJlbnQhLnBhcmVudCEucGFyZW50IS5tb2R1bGVTcGVjaWZpZXIgYXMgdHMuU3RyaW5nTGl0ZXJhbCkudGV4dDtcbiAgcmV0dXJuIG1vZHVsZUlkID09PSAnQGFuZ3VsYXIvY29yZScgJiYgbmFtZSA9PT0gJ0NvbXBvbmVudCc7XG59XG5cbi8qKlxuICogRm9yIGVhY2ggcHJvcGVydHkgaW4gdGhlIG9iamVjdCBsaXRlcmFsLCBpZiBpdCdzIHRlbXBsYXRlVXJsIG9yIHN0eWxlVXJscywgcmVwbGFjZSBpdFxuICogd2l0aCBjb250ZW50LlxuICogQHBhcmFtIG5vZGUgdGhlIGFyZ3VtZW50cyB0byBAQ29tcG9uZW50KCkgb3IgYXJncyBwcm9wZXJ0eSBvZiBkZWNvcmF0b3JzOiBbe3R5cGU6Q29tcG9uZW50fV1cbiAqIEBwYXJhbSBsb2FkZXIgcHJvdmlkZXMgYWNjZXNzIHRvIHRoZSBsb2FkUmVzb3VyY2UgbWV0aG9kIG9mIHRoZSBob3N0XG4gKiBAcmV0dXJucyB1cGRhdGVkIGFyZ3VtZW50c1xuICovXG5mdW5jdGlvbiB1cGRhdGVDb21wb25lbnRQcm9wZXJ0aWVzKFxuICAgIGFyZ3M6IHRzLk5vZGVBcnJheTx0cy5FeHByZXNzaW9uPiwgbG9hZGVyOiBTdGF0aWNSZXNvdXJjZUxvYWRlcik6IHRzLk5vZGVBcnJheTx0cy5FeHByZXNzaW9uPiB7XG4gIGlmIChhcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgIC8vIFVzZXIgc2hvdWxkIGhhdmUgZ290dGVuIGEgdHlwZS1jaGVjayBlcnJvciBiZWNhdXNlIEBDb21wb25lbnQgdGFrZXMgb25lIGFyZ3VtZW50XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cbiAgY29uc3QgY29tcG9uZW50QXJnID0gYXJnc1swXTtcbiAgaWYgKCF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKGNvbXBvbmVudEFyZykpIHtcbiAgICAvLyBVc2VyIHNob3VsZCBoYXZlIGdvdHRlbiBhIHR5cGUtY2hlY2sgZXJyb3IgYmVjYXVzZSBAQ29tcG9uZW50IHRha2VzIGFuIG9iamVjdCBsaXRlcmFsXG4gICAgLy8gYXJndW1lbnRcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGNvbnN0IG5ld1Byb3BlcnRpZXM6IHRzLk9iamVjdExpdGVyYWxFbGVtZW50TGlrZVtdID0gW107XG4gIGNvbnN0IG5ld1N0eWxlRXhwcnM6IHRzLkV4cHJlc3Npb25bXSA9IFtdO1xuICBjb21wb25lbnRBcmcucHJvcGVydGllcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgIGlmICghdHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcCkgfHwgdHMuaXNDb21wdXRlZFByb3BlcnR5TmFtZShwcm9wLm5hbWUpKSB7XG4gICAgICBuZXdQcm9wZXJ0aWVzLnB1c2gocHJvcCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc3dpdGNoIChwcm9wLm5hbWUudGV4dCkge1xuICAgICAgY2FzZSAnc3R5bGVzJzpcbiAgICAgICAgaWYgKCF0cy5pc0FycmF5TGl0ZXJhbEV4cHJlc3Npb24ocHJvcC5pbml0aWFsaXplcikpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0eWxlcyB0YWtlcyBhbiBhcnJheSBhcmd1bWVudCcpO1xuICAgICAgICB9XG4gICAgICAgIG5ld1N0eWxlRXhwcnMucHVzaCguLi5wcm9wLmluaXRpYWxpemVyLmVsZW1lbnRzKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ3N0eWxlVXJscyc6XG4gICAgICAgIGlmICghdHMuaXNBcnJheUxpdGVyYWxFeHByZXNzaW9uKHByb3AuaW5pdGlhbGl6ZXIpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzdHlsZVVybHMgdGFrZXMgYW4gYXJyYXkgYXJndW1lbnQnKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdTdHlsZUV4cHJzLnB1c2goLi4ucHJvcC5pbml0aWFsaXplci5lbGVtZW50cy5tYXAoKGV4cHI6IHRzLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICBpZiAoIXRzLmlzU3RyaW5nTGl0ZXJhbChleHByKSAmJiAhdHMuaXNOb1N1YnN0aXR1dGlvblRlbXBsYXRlTGl0ZXJhbChleHByKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICdDYW4gb25seSBhY2NlcHQgc3RyaW5nIGxpdGVyYWwgYXJndW1lbnRzIHRvIHN0eWxlVXJscy4gJyArIFBSRUNPTkRJVElPTlNfVEVYVCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHN0eWxlcyA9IGxvYWRlci5nZXQoZXhwci50ZXh0KTtcbiAgICAgICAgICByZXR1cm4gdHMuY3JlYXRlTGl0ZXJhbChzdHlsZXMpO1xuICAgICAgICB9KSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICd0ZW1wbGF0ZVVybCc6XG4gICAgICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKHByb3AuaW5pdGlhbGl6ZXIpICYmXG4gICAgICAgICAgICAhdHMuaXNOb1N1YnN0aXR1dGlvblRlbXBsYXRlTGl0ZXJhbChwcm9wLmluaXRpYWxpemVyKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0NhbiBvbmx5IGFjY2VwdCBhIHN0cmluZyBsaXRlcmFsIGFyZ3VtZW50IHRvIHRlbXBsYXRlVXJsLiAnICsgUFJFQ09ORElUSU9OU19URVhUKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IGxvYWRlci5nZXQocHJvcC5pbml0aWFsaXplci50ZXh0KTtcbiAgICAgICAgbmV3UHJvcGVydGllcy5wdXNoKHRzLnVwZGF0ZVByb3BlcnR5QXNzaWdubWVudChcbiAgICAgICAgICAgIHByb3AsIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ3RlbXBsYXRlJyksIHRzLmNyZWF0ZUxpdGVyYWwodGVtcGxhdGUpKSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBuZXdQcm9wZXJ0aWVzLnB1c2gocHJvcCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBBZGQgdGhlIG5vbi1pbmxpbmUgc3R5bGVzXG4gIGlmIChuZXdTdHlsZUV4cHJzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBuZXdTdHlsZXMgPSB0cy5jcmVhdGVQcm9wZXJ0eUFzc2lnbm1lbnQoXG4gICAgICAgIHRzLmNyZWF0ZUlkZW50aWZpZXIoJ3N0eWxlcycpLCB0cy5jcmVhdGVBcnJheUxpdGVyYWwobmV3U3R5bGVFeHBycykpO1xuICAgIG5ld1Byb3BlcnRpZXMucHVzaChuZXdTdHlsZXMpO1xuICB9XG5cbiAgcmV0dXJuIHRzLmNyZWF0ZU5vZGVBcnJheShbdHMudXBkYXRlT2JqZWN0TGl0ZXJhbChjb21wb25lbnRBcmcsIG5ld1Byb3BlcnRpZXMpXSk7XG59XG4iXX0=