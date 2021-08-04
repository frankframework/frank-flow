/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { isExtraOptions, isRouterModuleForRoot } from './util';
/**
 * Visitor that walks through specified TypeScript nodes and collects all
 * found ExtraOptions#RelativeLinkResolution assignments.
 */
export class RelativeLinkResolutionCollector {
    constructor(typeChecker) {
        this.typeChecker = typeChecker;
        this.forRootCalls = [];
        this.extraOptionsLiterals = [];
    }
    visitNode(node) {
        let forRootCall = null;
        let literal = null;
        if (isRouterModuleForRoot(this.typeChecker, node) && node.arguments.length > 0) {
            if (node.arguments.length === 1) {
                forRootCall = node;
            }
            else if (ts.isObjectLiteralExpression(node.arguments[1])) {
                literal = node.arguments[1];
            }
            else if (ts.isIdentifier(node.arguments[1])) {
                literal = this.getLiteralNeedingMigrationFromIdentifier(node.arguments[1]);
            }
        }
        else if (ts.isVariableDeclaration(node)) {
            literal = this.getLiteralNeedingMigration(node);
        }
        if (literal !== null) {
            this.extraOptionsLiterals.push(literal);
        }
        else if (forRootCall !== null) {
            this.forRootCalls.push(forRootCall);
        }
        else {
            // no match found, continue iteration
            ts.forEachChild(node, n => this.visitNode(n));
        }
    }
    getLiteralNeedingMigrationFromIdentifier(id) {
        const symbolForIdentifier = this.typeChecker.getSymbolAtLocation(id);
        if (symbolForIdentifier === undefined) {
            return null;
        }
        if (symbolForIdentifier.declarations === undefined ||
            symbolForIdentifier.declarations.length === 0) {
            return null;
        }
        const declarationNode = symbolForIdentifier.declarations[0];
        if (!ts.isVariableDeclaration(declarationNode) || declarationNode.initializer === undefined ||
            !ts.isObjectLiteralExpression(declarationNode.initializer)) {
            return null;
        }
        return declarationNode.initializer;
    }
    getLiteralNeedingMigration(node) {
        if (node.initializer === undefined) {
            return null;
        }
        // declaration could be `x: ExtraOptions = {}` or `x = {} as ExtraOptions`
        if (ts.isAsExpression(node.initializer) &&
            ts.isObjectLiteralExpression(node.initializer.expression) &&
            isExtraOptions(this.typeChecker, node.initializer.type)) {
            return node.initializer.expression;
        }
        else if (node.type !== undefined && ts.isObjectLiteralExpression(node.initializer) &&
            isExtraOptions(this.typeChecker, node.type)) {
            return node.initializer;
        }
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zY2hlbWF0aWNzL21pZ3JhdGlvbnMvcmVsYXRpdmUtbGluay1yZXNvbHV0aW9uL2NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVqQyxPQUFPLEVBQUMsY0FBYyxFQUFFLHFCQUFxQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRzdEOzs7R0FHRztBQUNILE1BQU0sT0FBTywrQkFBK0I7SUFJMUMsWUFBNkIsV0FBMkI7UUFBM0IsZ0JBQVcsR0FBWCxXQUFXLENBQWdCO1FBSC9DLGlCQUFZLEdBQXdCLEVBQUUsQ0FBQztRQUN2Qyx5QkFBb0IsR0FBaUMsRUFBRSxDQUFDO0lBRU4sQ0FBQztJQUU1RCxTQUFTLENBQUMsSUFBYTtRQUNyQixJQUFJLFdBQVcsR0FBMkIsSUFBSSxDQUFDO1FBQy9DLElBQUksT0FBTyxHQUFvQyxJQUFJLENBQUM7UUFDcEQsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM5RSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDL0IsV0FBVyxHQUFHLElBQUksQ0FBQzthQUNwQjtpQkFBTSxJQUFJLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQzFELE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBK0IsQ0FBQzthQUMzRDtpQkFBTSxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUM3QyxPQUFPLEdBQUcsSUFBSSxDQUFDLHdDQUF3QyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFrQixDQUFDLENBQUM7YUFDN0Y7U0FDRjthQUFNLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pDLE9BQU8sR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDakQ7UUFFRCxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7WUFDcEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUN6QzthQUFNLElBQUksV0FBVyxLQUFLLElBQUksRUFBRTtZQUMvQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUNyQzthQUFNO1lBQ0wscUNBQXFDO1lBQ3JDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQy9DO0lBQ0gsQ0FBQztJQUVPLHdDQUF3QyxDQUFDLEVBQWlCO1FBRWhFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyRSxJQUFJLG1CQUFtQixLQUFLLFNBQVMsRUFBRTtZQUNyQyxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQyxZQUFZLEtBQUssU0FBUztZQUM5QyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNqRCxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsTUFBTSxlQUFlLEdBQUcsbUJBQW1CLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVELElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsZUFBZSxDQUFDLElBQUksZUFBZSxDQUFDLFdBQVcsS0FBSyxTQUFTO1lBQ3ZGLENBQUMsRUFBRSxDQUFDLHlCQUF5QixDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUM5RCxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsT0FBTyxlQUFlLENBQUMsV0FBVyxDQUFDO0lBQ3JDLENBQUM7SUFFTywwQkFBMEIsQ0FBQyxJQUE0QjtRQUU3RCxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFFO1lBQ2xDLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCwwRUFBMEU7UUFDMUUsSUFBSSxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDbkMsRUFBRSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQ3pELGNBQWMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDM0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQztTQUNwQzthQUFNLElBQ0gsSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksRUFBRSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDekUsY0FBYyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQy9DLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztTQUN6QjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtpc0V4dHJhT3B0aW9ucywgaXNSb3V0ZXJNb2R1bGVGb3JSb290fSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogVmlzaXRvciB0aGF0IHdhbGtzIHRocm91Z2ggc3BlY2lmaWVkIFR5cGVTY3JpcHQgbm9kZXMgYW5kIGNvbGxlY3RzIGFsbFxuICogZm91bmQgRXh0cmFPcHRpb25zI1JlbGF0aXZlTGlua1Jlc29sdXRpb24gYXNzaWdubWVudHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWxhdGl2ZUxpbmtSZXNvbHV0aW9uQ29sbGVjdG9yIHtcbiAgcmVhZG9ubHkgZm9yUm9vdENhbGxzOiB0cy5DYWxsRXhwcmVzc2lvbltdID0gW107XG4gIHJlYWRvbmx5IGV4dHJhT3B0aW9uc0xpdGVyYWxzOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB0eXBlQ2hlY2tlcjogdHMuVHlwZUNoZWNrZXIpIHt9XG5cbiAgdmlzaXROb2RlKG5vZGU6IHRzLk5vZGUpIHtcbiAgICBsZXQgZm9yUm9vdENhbGw6IHRzLkNhbGxFeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGxldCBsaXRlcmFsOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAoaXNSb3V0ZXJNb2R1bGVGb3JSb290KHRoaXMudHlwZUNoZWNrZXIsIG5vZGUpICYmIG5vZGUuYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGlmIChub2RlLmFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgZm9yUm9vdENhbGwgPSBub2RlO1xuICAgICAgfSBlbHNlIGlmICh0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKG5vZGUuYXJndW1lbnRzWzFdKSkge1xuICAgICAgICBsaXRlcmFsID0gbm9kZS5hcmd1bWVudHNbMV0gYXMgdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb247XG4gICAgICB9IGVsc2UgaWYgKHRzLmlzSWRlbnRpZmllcihub2RlLmFyZ3VtZW50c1sxXSkpIHtcbiAgICAgICAgbGl0ZXJhbCA9IHRoaXMuZ2V0TGl0ZXJhbE5lZWRpbmdNaWdyYXRpb25Gcm9tSWRlbnRpZmllcihub2RlLmFyZ3VtZW50c1sxXSBhcyB0cy5JZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbihub2RlKSkge1xuICAgICAgbGl0ZXJhbCA9IHRoaXMuZ2V0TGl0ZXJhbE5lZWRpbmdNaWdyYXRpb24obm9kZSk7XG4gICAgfVxuXG4gICAgaWYgKGxpdGVyYWwgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZXh0cmFPcHRpb25zTGl0ZXJhbHMucHVzaChsaXRlcmFsKTtcbiAgICB9IGVsc2UgaWYgKGZvclJvb3RDYWxsICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmZvclJvb3RDYWxscy5wdXNoKGZvclJvb3RDYWxsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm8gbWF0Y2ggZm91bmQsIGNvbnRpbnVlIGl0ZXJhdGlvblxuICAgICAgdHMuZm9yRWFjaENoaWxkKG5vZGUsIG4gPT4gdGhpcy52aXNpdE5vZGUobikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TGl0ZXJhbE5lZWRpbmdNaWdyYXRpb25Gcm9tSWRlbnRpZmllcihpZDogdHMuSWRlbnRpZmllcik6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uXG4gICAgICB8bnVsbCB7XG4gICAgY29uc3Qgc3ltYm9sRm9ySWRlbnRpZmllciA9IHRoaXMudHlwZUNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihpZCk7XG4gICAgaWYgKHN5bWJvbEZvcklkZW50aWZpZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKHN5bWJvbEZvcklkZW50aWZpZXIuZGVjbGFyYXRpb25zID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgc3ltYm9sRm9ySWRlbnRpZmllci5kZWNsYXJhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNsYXJhdGlvbk5vZGUgPSBzeW1ib2xGb3JJZGVudGlmaWVyLmRlY2xhcmF0aW9uc1swXTtcbiAgICBpZiAoIXRzLmlzVmFyaWFibGVEZWNsYXJhdGlvbihkZWNsYXJhdGlvbk5vZGUpIHx8IGRlY2xhcmF0aW9uTm9kZS5pbml0aWFsaXplciA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKGRlY2xhcmF0aW9uTm9kZS5pbml0aWFsaXplcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNsYXJhdGlvbk5vZGUuaW5pdGlhbGl6ZXI7XG4gIH1cblxuICBwcml2YXRlIGdldExpdGVyYWxOZWVkaW5nTWlncmF0aW9uKG5vZGU6IHRzLlZhcmlhYmxlRGVjbGFyYXRpb24pOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvblxuICAgICAgfG51bGwge1xuICAgIGlmIChub2RlLmluaXRpYWxpemVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIGRlY2xhcmF0aW9uIGNvdWxkIGJlIGB4OiBFeHRyYU9wdGlvbnMgPSB7fWAgb3IgYHggPSB7fSBhcyBFeHRyYU9wdGlvbnNgXG4gICAgaWYgKHRzLmlzQXNFeHByZXNzaW9uKG5vZGUuaW5pdGlhbGl6ZXIpICYmXG4gICAgICAgIHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24obm9kZS5pbml0aWFsaXplci5leHByZXNzaW9uKSAmJlxuICAgICAgICBpc0V4dHJhT3B0aW9ucyh0aGlzLnR5cGVDaGVja2VyLCBub2RlLmluaXRpYWxpemVyLnR5cGUpKSB7XG4gICAgICByZXR1cm4gbm9kZS5pbml0aWFsaXplci5leHByZXNzaW9uO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIG5vZGUudHlwZSAhPT0gdW5kZWZpbmVkICYmIHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24obm9kZS5pbml0aWFsaXplcikgJiZcbiAgICAgICAgaXNFeHRyYU9wdGlvbnModGhpcy50eXBlQ2hlY2tlciwgbm9kZS50eXBlKSkge1xuICAgICAgcmV0dXJuIG5vZGUuaW5pdGlhbGl6ZXI7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdfQ==