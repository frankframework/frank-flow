/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Reference } from '@angular/compiler-cli/src/ngtsc/imports';
import * as ts from 'typescript';
import { getAngularDecorators } from '../../utils/ng_decorators';
import { getPropertyNameText } from '../../utils/typescript/property_name';
/**
 * Visitor that walks through specified TypeScript nodes and collects all defined
 * directives and provider classes. Directives are separated by decorated and
 * undecorated directives.
 */
export class NgDeclarationCollector {
    constructor(typeChecker, evaluator) {
        this.typeChecker = typeChecker;
        this.evaluator = evaluator;
        /** List of resolved directives which are decorated. */
        this.decoratedDirectives = [];
        /** List of resolved providers which are decorated. */
        this.decoratedProviders = [];
        /** Set of resolved Angular declarations which are not decorated. */
        this.undecoratedDeclarations = new Set();
    }
    visitNode(node) {
        if (ts.isClassDeclaration(node)) {
            this._visitClassDeclaration(node);
        }
        ts.forEachChild(node, n => this.visitNode(n));
    }
    _visitClassDeclaration(node) {
        if (!node.decorators || !node.decorators.length) {
            return;
        }
        const ngDecorators = getAngularDecorators(this.typeChecker, node.decorators);
        const ngModuleDecorator = ngDecorators.find(({ name }) => name === 'NgModule');
        if (hasDirectiveDecorator(node, this.typeChecker, ngDecorators)) {
            this.decoratedDirectives.push(node);
        }
        else if (hasInjectableDecorator(node, this.typeChecker, ngDecorators)) {
            this.decoratedProviders.push(node);
        }
        else if (ngModuleDecorator) {
            this._visitNgModuleDecorator(ngModuleDecorator);
        }
    }
    _visitNgModuleDecorator(decorator) {
        const decoratorCall = decorator.node.expression;
        const metadata = decoratorCall.arguments[0];
        if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
            return;
        }
        let entryComponentsNode = null;
        let declarationsNode = null;
        metadata.properties.forEach(p => {
            if (!ts.isPropertyAssignment(p)) {
                return;
            }
            const name = getPropertyNameText(p.name);
            if (name === 'entryComponents') {
                entryComponentsNode = p.initializer;
            }
            else if (name === 'declarations') {
                declarationsNode = p.initializer;
            }
        });
        // In case the module specifies the "entryComponents" field, walk through all
        // resolved entry components and collect the referenced directives.
        if (entryComponentsNode) {
            flattenTypeList(this.evaluator.evaluate(entryComponentsNode)).forEach(ref => {
                if (ts.isClassDeclaration(ref.node) &&
                    !hasNgDeclarationDecorator(ref.node, this.typeChecker)) {
                    this.undecoratedDeclarations.add(ref.node);
                }
            });
        }
        // In case the module specifies the "declarations" field, walk through all
        // resolved declarations and collect the referenced directives.
        if (declarationsNode) {
            flattenTypeList(this.evaluator.evaluate(declarationsNode)).forEach(ref => {
                if (ts.isClassDeclaration(ref.node) &&
                    !hasNgDeclarationDecorator(ref.node, this.typeChecker)) {
                    this.undecoratedDeclarations.add(ref.node);
                }
            });
        }
    }
}
/** Flattens a list of type references. */
function flattenTypeList(value) {
    if (Array.isArray(value)) {
        return value.reduce((res, v) => res.concat(flattenTypeList(v)), []);
    }
    else if (value instanceof Reference) {
        return [value];
    }
    return [];
}
/** Checks whether the given node has the "@Directive" or "@Component" decorator set. */
export function hasDirectiveDecorator(node, typeChecker, ngDecorators) {
    return (ngDecorators || getNgClassDecorators(node, typeChecker))
        .some(({ name }) => name === 'Directive' || name === 'Component');
}
/** Checks whether the given node has the "@Injectable" decorator set. */
export function hasInjectableDecorator(node, typeChecker, ngDecorators) {
    return (ngDecorators || getNgClassDecorators(node, typeChecker))
        .some(({ name }) => name === 'Injectable');
}
/** Whether the given node has an explicit decorator that describes an Angular declaration. */
export function hasNgDeclarationDecorator(node, typeChecker) {
    return getNgClassDecorators(node, typeChecker)
        .some(({ name }) => name === 'Component' || name === 'Directive' || name === 'Pipe');
}
/** Gets all Angular decorators of a given class declaration. */
export function getNgClassDecorators(node, typeChecker) {
    if (!node.decorators) {
        return [];
    }
    return getAngularDecorators(typeChecker, node.decorators);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfZGVjbGFyYXRpb25fY29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zY2hlbWF0aWNzL21pZ3JhdGlvbnMvdW5kZWNvcmF0ZWQtY2xhc3Nlcy13aXRoLWRpL25nX2RlY2xhcmF0aW9uX2NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFFbEUsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsT0FBTyxFQUFDLG9CQUFvQixFQUFjLE1BQU0sMkJBQTJCLENBQUM7QUFDNUUsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFHekU7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxzQkFBc0I7SUFVakMsWUFBbUIsV0FBMkIsRUFBVSxTQUEyQjtRQUFoRSxnQkFBVyxHQUFYLFdBQVcsQ0FBZ0I7UUFBVSxjQUFTLEdBQVQsU0FBUyxDQUFrQjtRQVRuRix1REFBdUQ7UUFDdkQsd0JBQW1CLEdBQTBCLEVBQUUsQ0FBQztRQUVoRCxzREFBc0Q7UUFDdEQsdUJBQWtCLEdBQTBCLEVBQUUsQ0FBQztRQUUvQyxvRUFBb0U7UUFDcEUsNEJBQXVCLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7SUFFNkIsQ0FBQztJQUV2RixTQUFTLENBQUMsSUFBYTtRQUNyQixJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUMvQixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDbkM7UUFFRCxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU8sc0JB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LEVBQUMsSUFBSSxFQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBQ0QsOEZBQThGO0FBQzlGLE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxJQUF5QixFQUFFLFdBQTJCO0lBQzlGLE9BQU8sb0JBQW9CLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQztTQUN6QyxJQUFJLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDO0FBQ3pGLENBQUM7QUFFRCxnRUFBZ0U7QUFDaEUsTUFBTSxVQUFVLG9CQUFvQixDQUNoQyxJQUF5QixFQUFFLFdBQTJCO0lBQ3hELElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ3BCLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFDRCxPQUFPLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDNUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9pbXBvcnRzJztcbmltcG9ydCB7UGFydGlhbEV2YWx1YXRvciwgUmVzb2x2ZWRWYWx1ZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9wYXJ0aWFsX2V2YWx1YXRvcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtnZXRBbmd1bGFyRGVjb3JhdG9ycywgTmdEZWNvcmF0b3J9IGZyb20gJy4uLy4uL3V0aWxzL25nX2RlY29yYXRvcnMnO1xuaW1wb3J0IHtnZXRQcm9wZXJ0eU5hbWVUZXh0fSBmcm9tICcuLi8uLi91dGlscy90eXBlc2NyaXB0L3Byb3BlcnR5X25hbWUnO1xuXG5cbi8qKlxuICogVmlzaXRvciB0aGF0IHdhbGtzIHRocm91Z2ggc3BlY2lmaWVkIFR5cGVTY3JpcHQgbm9kZXMgYW5kIGNvbGxlY3RzIGFsbCBkZWZpbmVkXG4gKiBkaXJlY3RpdmVzIGFuZCBwcm92aWRlciBjbGFzc2VzLiBEaXJlY3RpdmVzIGFyZSBzZXBhcmF0ZWQgYnkgZGVjb3JhdGVkIGFuZFxuICogdW5kZWNvcmF0ZWQgZGlyZWN0aXZlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE5nRGVjbGFyYXRpb25Db2xsZWN0b3Ige1xuICAvKiogTGlzdCBvZiByZXNvbHZlZCBkaXJlY3RpdmVzIHdoaWNoIGFyZSBkZWNvcmF0ZWQuICovXG4gIGRlY29yYXRlZERpcmVjdGl2ZXM6IHRzLkNsYXNzRGVjbGFyYXRpb25bXSA9IFtdO1xuXG4gIC8qKiBMaXN0IG9mIHJlc29sdmVkIHByb3ZpZGVycyB3aGljaCBhcmUgZGVjb3JhdGVkLiAqL1xuICBkZWNvcmF0ZWRQcm92aWRlcnM6IHRzLkNsYXNzRGVjbGFyYXRpb25bXSA9IFtdO1xuXG4gIC8qKiBTZXQgb2YgcmVzb2x2ZWQgQW5ndWxhciBkZWNsYXJhdGlvbnMgd2hpY2ggYXJlIG5vdCBkZWNvcmF0ZWQuICovXG4gIHVuZGVjb3JhdGVkRGVjbGFyYXRpb25zID0gbmV3IFNldDx0cy5DbGFzc0RlY2xhcmF0aW9uPigpO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIHByaXZhdGUgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yKSB7fVxuXG4gIHZpc2l0Tm9kZShub2RlOiB0cy5Ob2RlKSB7XG4gICAgaWYgKHRzLmlzQ2xhc3NEZWNsYXJhdGlvbihub2RlKSkge1xuICAgICAgdGhpcy5fdmlzaXRDbGFzc0RlY2xhcmF0aW9uKG5vZGUpO1xuICAgIH1cblxuICAgIHRzLmZvckVhY2hDaGlsZChub2RlLCBuID0+IHRoaXMudmlzaXROb2RlKG4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0Q2xhc3NEZWNsYXJhdGlvbihub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKSB7XG4gICAgaWYgKCFub2RlLmRlY29yYXRvcnMgfHwgIW5vZGUuZGVjb3JhdG9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBuZ0RlY29yYXRvcnMgPSBnZXRBbmd1bGFyRGVjb3JhdG9ycyh0aGlzLnR5cGVDaGVja2VyLCBub2RlLmRlY29yYXRvcnMpO1xuICAgIGNvbnN0IG5nTW9kdWxlRGVjb3JhdG9yID0gbmdEZWNvcmF0b3JzLmZpbmQoKHtuYW1lfSkgPT4gbmFtZSA9PT0gJ05nTW9kdWxlJyk7XG5cbiAgICBpZiAoaGFzRGlyZWN0aXZlRGVjb3JhdG9yKG5vZGUsIHRoaXMudHlwZUNoZWNrZXIsIG5nRGVjb3JhdG9ycykpIHtcbiAgICAgIHRoaXMuZGVjb3JhdGVkRGlyZWN0aXZlcy5wdXNoKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoaGFzSW5qZWN0YWJsZURlY29yYXRvcihub2RlLCB0aGlzLnR5cGVDaGVja2VyLCBuZ0RlY29yYXRvcnMpKSB7XG4gICAgICB0aGlzLmRlY29yYXRlZFByb3ZpZGVycy5wdXNoKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobmdNb2R1bGVEZWNvcmF0b3IpIHtcbiAgICAgIHRoaXMuX3Zpc2l0TmdNb2R1bGVEZWNvcmF0b3IobmdNb2R1bGVEZWNvcmF0b3IpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0TmdNb2R1bGVEZWNvcmF0b3IoZGVjb3JhdG9yOiBOZ0RlY29yYXRvcikge1xuICAgIGNvbnN0IGRlY29yYXRvckNhbGwgPSBkZWNvcmF0b3Iubm9kZS5leHByZXNzaW9uO1xuICAgIGNvbnN0IG1ldGFkYXRhID0gZGVjb3JhdG9yQ2FsbC5hcmd1bWVudHNbMF07XG5cbiAgICBpZiAoIW1ldGFkYXRhIHx8ICF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKG1ldGFkYXRhKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBlbnRyeUNvbXBvbmVudHNOb2RlOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGxldCBkZWNsYXJhdGlvbnNOb2RlOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gICAgbWV0YWRhdGEucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgaWYgKCF0cy5pc1Byb3BlcnR5QXNzaWdubWVudChwKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5hbWUgPSBnZXRQcm9wZXJ0eU5hbWVUZXh0KHAubmFtZSk7XG5cbiAgICAgIGlmIChuYW1lID09PSAnZW50cnlDb21wb25lbnRzJykge1xuICAgICAgICBlbnRyeUNvbXBvbmVudHNOb2RlID0gcC5pbml0aWFsaXplcjtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2RlY2xhcmF0aW9ucycpIHtcbiAgICAgICAgZGVjbGFyYXRpb25zTm9kZSA9IHAuaW5pdGlhbGl6ZXI7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBJbiBjYXNlIHRoZSBtb2R1bGUgc3BlY2lmaWVzIHRoZSBcImVudHJ5Q29tcG9uZW50c1wiIGZpZWxkLCB3YWxrIHRocm91Z2ggYWxsXG4gICAgLy8gcmVzb2x2ZWQgZW50cnkgY29tcG9uZW50cyBhbmQgY29sbGVjdCB0aGUgcmVmZXJlbmNlZCBkaXJlY3RpdmVzLlxuICAgIGlmIChlbnRyeUNvbXBvbmVudHNOb2RlKSB7XG4gICAgICBmbGF0dGVuVHlwZUxpc3QodGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoZW50cnlDb21wb25lbnRzTm9kZSkpLmZvckVhY2gocmVmID0+IHtcbiAgICAgICAgaWYgKHRzLmlzQ2xhc3NEZWNsYXJhdGlvbihyZWYubm9kZSkgJiZcbiAgICAgICAgICAgICFoYXNOZ0RlY2xhcmF0aW9uRGVjb3JhdG9yKHJlZi5ub2RlLCB0aGlzLnR5cGVDaGVja2VyKSkge1xuICAgICAgICAgIHRoaXMudW5kZWNvcmF0ZWREZWNsYXJhdGlvbnMuYWRkKHJlZi5ub2RlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSW4gY2FzZSB0aGUgbW9kdWxlIHNwZWNpZmllcyB0aGUgXCJkZWNsYXJhdGlvbnNcIiBmaWVsZCwgd2FsayB0aHJvdWdoIGFsbFxuICAgIC8vIHJlc29sdmVkIGRlY2xhcmF0aW9ucyBhbmQgY29sbGVjdCB0aGUgcmVmZXJlbmNlZCBkaXJlY3RpdmVzLlxuICAgIGlmIChkZWNsYXJhdGlvbnNOb2RlKSB7XG4gICAgICBmbGF0dGVuVHlwZUxpc3QodGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoZGVjbGFyYXRpb25zTm9kZSkpLmZvckVhY2gocmVmID0+IHtcbiAgICAgICAgaWYgKHRzLmlzQ2xhc3NEZWNsYXJhdGlvbihyZWYubm9kZSkgJiZcbiAgICAgICAgICAgICFoYXNOZ0RlY2xhcmF0aW9uRGVjb3JhdG9yKHJlZi5ub2RlLCB0aGlzLnR5cGVDaGVja2VyKSkge1xuICAgICAgICAgIHRoaXMudW5kZWNvcmF0ZWREZWNsYXJhdGlvbnMuYWRkKHJlZi5ub2RlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbi8qKiBGbGF0dGVucyBhIGxpc3Qgb2YgdHlwZSByZWZlcmVuY2VzLiAqL1xuZnVuY3Rpb24gZmxhdHRlblR5cGVMaXN0KHZhbHVlOiBSZXNvbHZlZFZhbHVlKTogUmVmZXJlbmNlW10ge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gPFJlZmVyZW5jZVtdPnZhbHVlLnJlZHVjZShcbiAgICAgICAgKHJlczogUmVmZXJlbmNlW10sIHY6IFJlc29sdmVkVmFsdWUpID0+IHJlcy5jb25jYXQoZmxhdHRlblR5cGVMaXN0KHYpKSwgW10pO1xuICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVmZXJlbmNlKSB7XG4gICAgcmV0dXJuIFt2YWx1ZV07XG4gIH1cbiAgcmV0dXJuIFtdO1xufVxuXG4vKiogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIG5vZGUgaGFzIHRoZSBcIkBEaXJlY3RpdmVcIiBvciBcIkBDb21wb25lbnRcIiBkZWNvcmF0b3Igc2V0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0RpcmVjdGl2ZURlY29yYXRvcihcbiAgICBub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uLCB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIG5nRGVjb3JhdG9ycz86IE5nRGVjb3JhdG9yW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIChuZ0RlY29yYXRvcnMgfHwgZ2V0TmdDbGFzc0RlY29yYXRvcnMobm9kZSwgdHlwZUNoZWNrZXIpKVxuICAgICAgLnNvbWUoKHtuYW1lfSkgPT4gbmFtZSA9PT0gJ0RpcmVjdGl2ZScgfHwgbmFtZSA9PT0gJ0NvbXBvbmVudCcpO1xufVxuXG5cblxuLyoqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBub2RlIGhhcyB0aGUgXCJASW5qZWN0YWJsZVwiIGRlY29yYXRvciBzZXQuICovXG5leHBvcnQgZnVuY3Rpb24gaGFzSW5qZWN0YWJsZURlY29yYXRvcihcbiAgICBub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uLCB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIsIG5nRGVjb3JhdG9ycz86IE5nRGVjb3JhdG9yW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIChuZ0RlY29yYXRvcnMgfHwgZ2V0TmdDbGFzc0RlY29yYXRvcnMobm9kZSwgdHlwZUNoZWNrZXIpKVxuICAgICAgLnNvbWUoKHtuYW1lfSkgPT4gbmFtZSA9PT0gJ0luamVjdGFibGUnKTtcbn1cbi8qKiBXaGV0aGVyIHRoZSBnaXZlbiBub2RlIGhhcyBhbiBleHBsaWNpdCBkZWNvcmF0b3IgdGhhdCBkZXNjcmliZXMgYW4gQW5ndWxhciBkZWNsYXJhdGlvbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNOZ0RlY2xhcmF0aW9uRGVjb3JhdG9yKG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24sIHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlcikge1xuICByZXR1cm4gZ2V0TmdDbGFzc0RlY29yYXRvcnMobm9kZSwgdHlwZUNoZWNrZXIpXG4gICAgICAuc29tZSgoe25hbWV9KSA9PiBuYW1lID09PSAnQ29tcG9uZW50JyB8fCBuYW1lID09PSAnRGlyZWN0aXZlJyB8fCBuYW1lID09PSAnUGlwZScpO1xufVxuXG4vKiogR2V0cyBhbGwgQW5ndWxhciBkZWNvcmF0b3JzIG9mIGEgZ2l2ZW4gY2xhc3MgZGVjbGFyYXRpb24uICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmdDbGFzc0RlY29yYXRvcnMoXG4gICAgbm9kZTogdHMuQ2xhc3NEZWNsYXJhdGlvbiwgdHlwZUNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKTogTmdEZWNvcmF0b3JbXSB7XG4gIGlmICghbm9kZS5kZWNvcmF0b3JzKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIHJldHVybiBnZXRBbmd1bGFyRGVjb3JhdG9ycyh0eXBlQ2hlY2tlciwgbm9kZS5kZWNvcmF0b3JzKTtcbn1cbiJdfQ==