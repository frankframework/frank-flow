/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';
import { ImportManager, translateType } from '../../translator';
import { addImports } from './utils';
/**
 * Keeps track of `DtsTransform`s per source file, so that it is known which source files need to
 * have their declaration file transformed.
 */
export class DtsTransformRegistry {
    constructor() {
        this.ivyDeclarationTransforms = new Map();
    }
    getIvyDeclarationTransform(sf) {
        if (!this.ivyDeclarationTransforms.has(sf)) {
            this.ivyDeclarationTransforms.set(sf, new IvyDeclarationDtsTransform());
        }
        return this.ivyDeclarationTransforms.get(sf);
    }
    /**
     * Gets the dts transforms to be applied for the given source file, or `null` if no transform is
     * necessary.
     */
    getAllTransforms(sf) {
        // No need to transform if it's not a declarations file, or if no changes have been requested
        // to the input file. Due to the way TypeScript afterDeclarations transformers work, the
        // `ts.SourceFile` path is the same as the original .ts. The only way we know it's actually a
        // declaration file is via the `isDeclarationFile` property.
        if (!sf.isDeclarationFile) {
            return null;
        }
        const originalSf = ts.getOriginalNode(sf);
        let transforms = null;
        if (this.ivyDeclarationTransforms.has(originalSf)) {
            transforms = [];
            transforms.push(this.ivyDeclarationTransforms.get(originalSf));
        }
        return transforms;
    }
}
export function declarationTransformFactory(transformRegistry, importRewriter, importPrefix) {
    return (context) => {
        const transformer = new DtsTransformer(context, importRewriter, importPrefix);
        return (fileOrBundle) => {
            if (ts.isBundle(fileOrBundle)) {
                // Only attempt to transform source files.
                return fileOrBundle;
            }
            const transforms = transformRegistry.getAllTransforms(fileOrBundle);
            if (transforms === null) {
                return fileOrBundle;
            }
            return transformer.transform(fileOrBundle, transforms);
        };
    };
}
/**
 * Processes .d.ts file text and adds static field declarations, with types.
 */
class DtsTransformer {
    constructor(ctx, importRewriter, importPrefix) {
        this.ctx = ctx;
        this.importRewriter = importRewriter;
        this.importPrefix = importPrefix;
    }
    /**
     * Transform the declaration file and add any declarations which were recorded.
     */
    transform(sf, transforms) {
        const imports = new ImportManager(this.importRewriter, this.importPrefix);
        const visitor = (node) => {
            if (ts.isClassDeclaration(node)) {
                return this.transformClassDeclaration(node, transforms, imports);
            }
            else if (ts.isFunctionDeclaration(node)) {
                return this.transformFunctionDeclaration(node, transforms, imports);
            }
            else {
                // Otherwise return node as is.
                return ts.visitEachChild(node, visitor, this.ctx);
            }
        };
        // Recursively scan through the AST and process all nodes as desired.
        sf = ts.visitNode(sf, visitor);
        // Add new imports for this file.
        return addImports(imports, sf);
    }
    transformClassDeclaration(clazz, transforms, imports) {
        let elements = clazz.members;
        let elementsChanged = false;
        for (const transform of transforms) {
            if (transform.transformClassElement !== undefined) {
                for (let i = 0; i < elements.length; i++) {
                    const res = transform.transformClassElement(elements[i], imports);
                    if (res !== elements[i]) {
                        if (!elementsChanged) {
                            elements = [...elements];
                            elementsChanged = true;
                        }
                        elements[i] = res;
                    }
                }
            }
        }
        let newClazz = clazz;
        for (const transform of transforms) {
            if (transform.transformClass !== undefined) {
                // If no DtsTransform has changed the class yet, then the (possibly mutated) elements have
                // not yet been incorporated. Otherwise, `newClazz.members` holds the latest class members.
                const inputMembers = (clazz === newClazz ? elements : newClazz.members);
                newClazz = transform.transformClass(newClazz, inputMembers, imports);
            }
        }
        // If some elements have been transformed but the class itself has not been transformed, create
        // an updated class declaration with the updated elements.
        if (elementsChanged && clazz === newClazz) {
            newClazz = ts.updateClassDeclaration(
            /* node */ clazz, 
            /* decorators */ clazz.decorators, 
            /* modifiers */ clazz.modifiers, 
            /* name */ clazz.name, 
            /* typeParameters */ clazz.typeParameters, 
            /* heritageClauses */ clazz.heritageClauses, 
            /* members */ elements);
        }
        return newClazz;
    }
    transformFunctionDeclaration(declaration, transforms, imports) {
        let newDecl = declaration;
        for (const transform of transforms) {
            if (transform.transformFunctionDeclaration !== undefined) {
                newDecl = transform.transformFunctionDeclaration(newDecl, imports);
            }
        }
        return newDecl;
    }
}
export class IvyDeclarationDtsTransform {
    constructor() {
        this.declarationFields = new Map();
    }
    addFields(decl, fields) {
        this.declarationFields.set(decl, fields);
    }
    transformClass(clazz, members, imports) {
        const original = ts.getOriginalNode(clazz);
        if (!this.declarationFields.has(original)) {
            return clazz;
        }
        const fields = this.declarationFields.get(original);
        const newMembers = fields.map(decl => {
            const modifiers = [ts.createModifier(ts.SyntaxKind.StaticKeyword)];
            const typeRef = translateType(decl.type, imports);
            markForEmitAsSingleLine(typeRef);
            return ts.createProperty(
            /* decorators */ undefined, 
            /* modifiers */ modifiers, 
            /* name */ decl.name, 
            /* questionOrExclamationToken */ undefined, 
            /* type */ typeRef, 
            /* initializer */ undefined);
        });
        return ts.updateClassDeclaration(
        /* node */ clazz, 
        /* decorators */ clazz.decorators, 
        /* modifiers */ clazz.modifiers, 
        /* name */ clazz.name, 
        /* typeParameters */ clazz.typeParameters, 
        /* heritageClauses */ clazz.heritageClauses, 
        /* members */ [...members, ...newMembers]);
    }
}
function markForEmitAsSingleLine(node) {
    ts.setEmitFlags(node, ts.EmitFlags.SingleLine);
    ts.forEachChild(node, markForEmitAsSingleLine);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjbGFyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3RyYW5zZm9ybS9zcmMvZGVjbGFyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFJakMsT0FBTyxFQUFDLGFBQWEsRUFBRSxhQUFhLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUc5RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRW5DOzs7R0FHRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7SUFBakM7UUFDVSw2QkFBd0IsR0FBRyxJQUFJLEdBQUcsRUFBNkMsQ0FBQztJQThCMUYsQ0FBQztJQTVCQywwQkFBMEIsQ0FBQyxFQUFpQjtRQUMxQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUMxQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLDBCQUEwQixFQUFFLENBQUMsQ0FBQztTQUN6RTtRQUNELE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUUsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsZ0JBQWdCLENBQUMsRUFBaUI7UUFDaEMsNkZBQTZGO1FBQzdGLHdGQUF3RjtRQUN4Riw2RkFBNkY7UUFDN0YsNERBQTREO1FBQzVELElBQUksQ0FBQyxFQUFFLENBQUMsaUJBQWlCLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFrQixDQUFDO1FBRTNELElBQUksVUFBVSxHQUF3QixJQUFJLENBQUM7UUFDM0MsSUFBSSxJ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QWEsQ0FBQyxDQUFDLENBQUM7WUFDbkUsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbEQsdUJBQXVCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakMsT0FBTyxFQUFFLENBQUMsY0FBYztZQUNwQixnQkFBZ0IsQ0FBQyxTQUFTO1lBQzFCLGVBQWUsQ0FBQyxTQUFTO1lBQ3pCLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUNwQixnQ0FBZ0MsQ0FBQyxTQUFTO1lBQzFDLFVBQVUsQ0FBQyxPQUFPO1lBQ2xCLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxFQUFFLENBQUMsc0JBQXNCO1FBQzVCLFVBQVUsQ0FBQyxLQUFLO1FBQ2hCLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVO1FBQ2pDLGVBQWUsQ0FBQyxLQUFLLENBQUMsU0FBUztRQUMvQixVQUFVLENBQUMsS0FBSyxDQUFDLElBQUk7UUFDckIsb0JBQW9CLENBQUMsS0FBSyxDQUFDLGNBQWM7UUFDekMscUJBQXFCLENBQUMsS0FBSyxDQUFDLGVBQWU7UUFDM0MsYUFBYSxDQUFBLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDRjtBQUVELFNBQVMsdUJBQXVCLENBQUMsSUFBYTtJQUM1QyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQy9DLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHVCQUF1QixDQUFDLENBQUM7QUFDakQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1R5cGV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0ltcG9ydFJld3JpdGVyfSBmcm9tICcuLi8uLi9pbXBvcnRzJztcbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge0ltcG9ydE1hbmFnZXIsIHRyYW5zbGF0ZVR5cGV9IGZyb20gJy4uLy4uL3RyYW5zbGF0b3InO1xuXG5pbXBvcnQge0R0c1RyYW5zZm9ybX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHthZGRJbXBvcnRzfSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBLZWVwcyB0cmFjayBvZiBgRHRzVHJhbnNmb3JtYHMgcGVyIHNvdXJjZSBmaWxlLCBzbyB0aGF0IGl0IGlzIGtub3duIHdoaWNoIHNvdXJjZSBmaWxlcyBuZWVkIHRvXG4gKiBoYXZlIHRoZWlyIGRlY2xhcmF0aW9uIGZpbGUgdHJhbnNmb3JtZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBEdHNUcmFuc2Zvcm1SZWdpc3RyeSB7XG4gIHByaXZhdGUgaXZ5RGVjbGFyYXRpb25UcmFuc2Zvcm1zID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBJdnlEZWNsYXJhdGlvbkR0c1RyYW5zZm9ybT4oKTtcblxuICBnZXRJdnlEZWNsYXJhdGlvblRyYW5zZm9ybShzZjogdHMuU291cmNlRmlsZSk6IEl2eURlY2xhcmF0aW9uRHRzVHJhbnNmb3JtIHtcbiAgICBpZiAoIXRoaXMuaXZ5RGVjbGFyYXRpb25UcmFuc2Zvcm1zLmhhcyhzZikpIHtcbiAgICAgIHRoaXMuaXZ5RGVjbGFyYXRpb25UcmFuc2Zvcm1zLnNldChzZiwgbmV3IEl2eURlY2xhcmF0aW9uRHRzVHJhbnNmb3JtKCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pdnlEZWNsYXJhdGlvblRyYW5zZm9ybXMuZ2V0KHNmKSE7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgZHRzIHRyYW5zZm9ybXMgdG8gYmUgYXBwbGllZCBmb3IgdGhlIGdpdmVuIHNvdXJjZSBmaWxlLCBvciBgbnVsbGAgaWYgbm8gdHJhbnNmb3JtIGlzXG4gICAqIG5lY2Vzc2FyeS5cbiAgICovXG4gIGdldEFsbFRyYW5zZm9ybXMoc2Y6IHRzLlNvdXJjZUZpbGUpOiBEdHNUcmFuc2Zvcm1bXXxudWxsIHtcbiAgICAvLyBObyBuZWVkIHRvIHRyYW5zZm9ybSBpZiBpdCdzIG5vdCBhIGRlY2xhcmF0aW9ucyBmaWxlLCBvciBpZiBubyBjaGFuZ2VzIGhhdmUgYmVlbiByZXF1ZXN0ZWRcbiAgICAvLyB0byB0aGUgaW5wdXQgZmlsZS4gRHVlIHRvIHRoZSB3YXkgVHlwZVNjcmlwdCBhZnRlckRlY2xhcmF0aW9ucyB0cmFuc2Zvcm1lcnMgd29yaywgdGhlXG4gICAgLy8gYHRzLlNvdXJjZUZpbGVgIHBhdGggaXMgdGhlIHNhbWUgYXMgdGhlIG9yaWdpbmFsIC50cy4gVGhlIG9ubHkgd2F5IHdlIGtub3cgaXQncyBhY3R1YWxseSBhXG4gICAgLy8gZGVjbGFyYXRpb24gZmlsZSBpcyB2aWEgdGhlIGBpc0RlY2xhcmF0aW9uRmlsZWAgcHJvcGVydHkuXG4gICAgaWYgKCFzZi5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG9yaWdpbmFsU2YgPSB0cy5nZXRPcmlnaW5hbE5vZGUoc2YpIGFzIHRzLlNvdXJjZUZpbGU7XG5cbiAgICBsZXQgdHJhbnNmb3JtczogRHRzVHJhbnNmb3JtW118bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuaXZ5RGVjbGFyYXRpb25UcmFuc2Zvcm1zLmhhcyhvcmlnaW5hbFNmKSkge1xuICAgICAgdHJhbnNmb3JtcyA9IFtdO1xuICAgICAgdHJhbnNmb3Jtcy5wdXNoKHRoaXMuaXZ5RGVjbGFyYXRpb25UcmFuc2Zvcm1zLmdldChvcmlnaW5hbFNmKSEpO1xuICAgIH1cbiAgICByZXR1cm4gdHJhbnNmb3JtcztcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjbGFyYXRpb25UcmFuc2Zvcm1GYWN0b3J5KFxuICAgIHRyYW5zZm9ybVJlZ2lzdHJ5OiBEdHNUcmFuc2Zvcm1SZWdpc3RyeSwgaW1wb3J0UmV3cml0ZXI6IEltcG9ydFJld3JpdGVyLFxuICAgIGltcG9ydFByZWZpeD86IHN0cmluZyk6IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPiB7XG4gIHJldHVybiAoY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgRHRzVHJhbnNmb3JtZXIoY29udGV4dCwgaW1wb3J0UmV3cml0ZXIsIGltcG9ydFByZWZpeCk7XG4gICAgcmV0dXJuIChmaWxlT3JCdW5kbGUpID0+IHtcbiAgICAgIGlmICh0cy5pc0J1bmRsZShmaWxlT3JCdW5kbGUpKSB7XG4gICAgICAgIC8vIE9ubHkgYXR0ZW1wdCB0byB0cmFuc2Zvcm0gc291cmNlIGZpbGVzLlxuICAgICAgICByZXR1cm4gZmlsZU9yQnVuZGxlO1xuICAgICAgfVxuICAgICAgY29uc3QgdHJhbnNmb3JtcyA9IHRyYW5zZm9ybVJlZ2lzdHJ5LmdldEFsbFRyYW5zZm9ybXMoZmlsZU9yQnVuZGxlKTtcbiAgICAgIGlmICh0cmFuc2Zvcm1zID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBmaWxlT3JCdW5kbGU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJhbnNmb3JtZXIudHJhbnNmb3JtKGZpbGVPckJ1bmRsZSwgdHJhbnNmb3Jtcyk7XG4gICAgfTtcbiAgfTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgLmQudHMgZmlsZSB0ZXh0IGFuZCBhZGRzIHN0YXRpYyBmaWVsZCBkZWNsYXJhdGlvbnMsIHdpdGggdHlwZXMuXG4gKi9cbmNsYXNzIER0c1RyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGN0eDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0LCBwcml2YXRlIGltcG9ydFJld3JpdGVyOiBJbXBvcnRSZXdyaXRlcixcbiAgICAgIHByaXZhdGUgaW1wb3J0UHJlZml4Pzogc3RyaW5nKSB7fVxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gdGhlIGRlY2xhcmF0aW9uIGZpbGUgYW5kIGFkZCBhbnkgZGVjbGFyYXRpb25zIHdoaWNoIHdlcmUgcmVjb3JkZWQuXG4gICAqL1xuICB0cmFuc2Zvcm0oc2Y6IHRzLlNvdXJjZUZpbGUsIHRyYW5zZm9ybXM6IER0c1RyYW5zZm9ybVtdKTogdHMuU291cmNlRmlsZSB7XG4gICAgY29uc3QgaW1wb3J0cyA9IG5ldyBJbXBvcnRNYW5hZ2VyKHRoaXMuaW1wb3J0UmV3cml0ZXIsIHRoaXMuaW1wb3J0UHJlZml4KTtcblxuICAgIGNvbnN0IHZpc2l0b3I6IHRzLlZpc2l0b3IgPSAobm9kZTogdHMuTm9kZSk6IHRzLlZpc2l0UmVzdWx0PHRzLk5vZGU+ID0+IHtcbiAgICAgIGlmICh0cy5pc0NsYXNzRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtQ2xhc3NEZWNsYXJhdGlvbihub2RlLCB0cmFuc2Zvcm1zLCBpbXBvcnRzKTtcbiAgICAgIH0gZWxzZSBpZiAodHMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUZ1bmN0aW9uRGVjbGFyYXRpb24obm9kZSwgdHJhbnNmb3JtcywgaW1wb3J0cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBPdGhlcndpc2UgcmV0dXJuIG5vZGUgYXMgaXMuXG4gICAgICAgIHJldHVybiB0cy52aXNpdEVhY2hDaGlsZChub2RlLCB2aXNpdG9yLCB0aGlzLmN0eCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFJlY3Vyc2l2ZWx5IHNjYW4gdGhyb3VnaCB0aGUgQVNUIGFuZCBwcm9jZXNzIGFsbCBub2RlcyBhcyBkZXNpcmVkLlxuICAgIHNmID0gdHMudmlzaXROb2RlKHNmLCB2aXNpdG9yKTtcblxuICAgIC8vIEFkZCBuZXcgaW1wb3J0cyBmb3IgdGhpcyBmaWxlLlxuICAgIHJldHVybiBhZGRJbXBvcnRzKGltcG9ydHMsIHNmKTtcbiAgfVxuXG4gIHByaXZhdGUgdHJhbnNmb3JtQ2xhc3NEZWNsYXJhdGlvbihcbiAgICAgIGNsYXp6OiB0cy5DbGFzc0RlY2xhcmF0aW9uLCB0cmFuc2Zvcm1zOiBEdHNUcmFuc2Zvcm1bXSxcbiAgICAgIGltcG9ydHM6IEltcG9ydE1hbmFnZXIpOiB0cy5DbGFzc0RlY2xhcmF0aW9uIHtcbiAgICBsZXQgZWxlbWVudHM6IHRzLkNsYXNzRWxlbWVudFtdfFJlYWRvbmx5QXJyYXk8dHMuQ2xhc3NFbGVtZW50PiA9IGNsYXp6Lm1lbWJlcnM7XG4gICAgbGV0IGVsZW1lbnRzQ2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCB0cmFuc2Zvcm0gb2YgdHJhbnNmb3Jtcykge1xuICAgICAgaWYgKHRyYW5zZm9ybS50cmFuc2Zvcm1DbGFzc0VsZW1lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgcmVzID0gdHJhbnNmb3JtLnRyYW5zZm9ybUNsYXNzRWxlbWVudChlbGVtZW50c1tpXSwgaW1wb3J0cyk7XG4gICAgICAgICAgaWYgKHJlcyAhPT0gZWxlbWVudHNbaV0pIHtcbiAgICAgICAgICAgIGlmICghZWxlbWVudHNDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgIGVsZW1lbnRzID0gWy4uLmVsZW1lbnRzXTtcbiAgICAgICAgICAgICAgZWxlbWVudHNDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChlbGVtZW50cyBhcyB0cy5DbGFzc0VsZW1lbnRbXSlbaV0gPSByZXM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IG5ld0NsYXp6OiB0cy5DbGFzc0RlY2xhcmF0aW9uID0gY2xheno7XG5cbiAgICBmb3IgKGNvbnN0IHRyYW5zZm9ybSBvZiB0cmFuc2Zvcm1zKSB7XG4gICAgICBpZiAodHJhbnNmb3JtLnRyYW5zZm9ybUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gSWYgbm8gRHRzVHJhbnNmb3JtIGhhcyBjaGFuZ2VkIHRoZSBjbGFzcyB5ZXQsIHRoZW4gdGhlIChwb3NzaWJseSBtdXRhdGVkKSBlbGVtZW50cyBoYXZlXG4gICAgICAgIC8vIG5vdCB5ZXQgYmVlbiBpbmNvcnBvcmF0ZWQuIE90aGVyd2lzZSwgYG5ld0NsYXp6Lm1lbWJlcnNgIGhvbGRzIHRoZSBsYXRlc3QgY2xhc3MgbWVtYmVycy5cbiAgICAgICAgY29uc3QgaW5wdXRNZW1iZXJzID0gKGNsYXp6ID09PSBuZXdDbGF6eiA/IGVsZW1lbnRzIDogbmV3Q2xhenoubWVtYmVycyk7XG5cbiAgICAgICAgbmV3Q2xhenogPSB0cmFuc2Zvcm0udHJhbnNmb3JtQ2xhc3MobmV3Q2xhenosIGlucHV0TWVtYmVycywgaW1wb3J0cyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgc29tZSBlbGVtZW50cyBoYXZlIGJlZW4gdHJhbnNmb3JtZWQgYnV0IHRoZSBjbGFzcyBpdHNlbGYgaGFzIG5vdCBiZWVuIHRyYW5zZm9ybWVkLCBjcmVhdGVcbiAgICAvLyBhbiB1cGRhdGVkIGNsYXNzIGRlY2xhcmF0aW9uIHdpdGggdGhlIHVwZGF0ZWQgZWxlbWVudHMuXG4gICAgaWYgKGVsZW1lbnRzQ2hhbmdlZCAmJiBjbGF6eiA9PT0gbmV3Q2xhenopIHtcbiAgICAgIG5ld0NsYXp6ID0gdHMudXBkYXRlQ2xhc3NEZWNsYXJhdGlvbihcbiAgICAgICAgICAvKiBub2RlICovIGNsYXp6LFxuICAgICAgICAgIC8qIGRlY29yYXRvcnMgKi8gY2xhenouZGVjb3JhdG9ycyxcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gY2xhenoubW9kaWZpZXJzLFxuICAgICAgICAgIC8qIG5hbWUgKi8gY2xhenoubmFtZSxcbiAgICAgICAgICAvKiB0eXBlUGFyYW1ldGVycyAqLyBjbGF6ei50eXBlUGFyYW1ldGVycyxcbiAgICAgICAgICAvKiBoZXJpdGFnZUNsYXVzZXMgKi8gY2xhenouaGVyaXRhZ2VDbGF1c2VzLFxuICAgICAgICAgIC8qIG1lbWJlcnMgKi8gZWxlbWVudHMpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXdDbGF6ejtcbiAgfVxuXG4gIHByaXZhdGUgdHJhbnNmb3JtRnVuY3Rpb25EZWNsYXJhdGlvbihcbiAgICAgIGRlY2xhcmF0aW9uOiB0cy5GdW5jdGlvbkRlY2xhcmF0aW9uLCB0cmFuc2Zvcm1zOiBEdHNUcmFuc2Zvcm1bXSxcbiAgICAgIGltcG9ydHM6IEltcG9ydE1hbmFnZXIpOiB0cy5GdW5jdGlvbkRlY2xhcmF0aW9uIHtcbiAgICBsZXQgbmV3RGVjbCA9IGRlY2xhcmF0aW9uO1xuXG4gICAgZm9yIChjb25zdCB0cmFuc2Zvcm0gb2YgdHJhbnNmb3Jtcykge1xuICAgICAgaWYgKHRyYW5zZm9ybS50cmFuc2Zvcm1GdW5jdGlvbkRlY2xhcmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbmV3RGVjbCA9IHRyYW5zZm9ybS50cmFuc2Zvcm1GdW5jdGlvbkRlY2xhcmF0aW9uKG5ld0RlY2wsIGltcG9ydHMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXdEZWNsO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSXZ5RGVjbGFyYXRpb25GaWVsZCB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogVHlwZTtcbn1cblxuZXhwb3J0IGNsYXNzIEl2eURlY2xhcmF0aW9uRHRzVHJhbnNmb3JtIGltcGxlbWVudHMgRHRzVHJhbnNmb3JtIHtcbiAgcHJpdmF0ZSBkZWNsYXJhdGlvbkZpZWxkcyA9IG5ldyBNYXA8Q2xhc3NEZWNsYXJhdGlvbiwgSXZ5RGVjbGFyYXRpb25GaWVsZFtdPigpO1xuXG4gIGFkZEZpZWxkcyhkZWNsOiBDbGFzc0RlY2xhcmF0aW9uLCBmaWVsZHM6IEl2eURlY2xhcmF0aW9uRmllbGRbXSk6IHZvaWQge1xuICAgIHRoaXMuZGVjbGFyYXRpb25GaWVsZHMuc2V0KGRlY2wsIGZpZWxkcyk7XG4gIH1cblxuICB0cmFuc2Zvcm1DbGFzcyhcbiAgICAgIGNsYXp6OiB0cy5DbGFzc0RlY2xhcmF0aW9uLCBtZW1iZXJzOiBSZWFkb25seUFycmF5PHRzLkNsYXNzRWxlbWVudD4sXG4gICAgICBpbXBvcnRzOiBJbXBvcnRNYW5hZ2VyKTogdHMuQ2xhc3NEZWNsYXJhdGlvbiB7XG4gICAgY29uc3Qgb3JpZ2luYWwgPSB0cy5nZXRPcmlnaW5hbE5vZGUoY2xhenopIGFzIENsYXNzRGVjbGFyYXRpb247XG5cbiAgICBpZiAoIXRoaXMuZGVjbGFyYXRpb25GaWVsZHMuaGFzKG9yaWdpbmFsKSkge1xuICAgICAgcmV0dXJuIGNsYXp6O1xuICAgIH1cbiAgICBjb25zdCBmaWVsZHMgPSB0aGlzLmRlY2xhcmF0aW9uRmllbGRzLmdldChvcmlnaW5hbCkhO1xuXG4gICAgY29uc3QgbmV3TWVtYmVycyA9IGZpZWxkcy5tYXAoZGVjbCA9PiB7XG4gICAgICBjb25zdCBtb2RpZmllcnMgPSBbdHMuY3JlYXRlTW9kaWZpZXIodHMuU3ludGF4S2luZC5TdGF0aWNLZXl3b3JkKV07XG4gICAgICBjb25zdCB0eXBlUmVmID0gdHJhbnNsYXRlVHlwZShkZWNsLnR5cGUsIGltcG9ydHMpO1xuICAgICAgbWFya0ZvckVtaXRBc1NpbmdsZUxpbmUodHlwZVJlZik7XG4gICAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHkoXG4gICAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgLyogbW9kaWZpZXJzICovIG1vZGlmaWVycyxcbiAgICAgICAgICAvKiBuYW1lICovIGRlY2wubmFtZSxcbiAgICAgICAgICAvKiBxdWVzdGlvbk9yRXhjbGFtYXRpb25Ub2tlbiAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgLyogdHlwZSAqLyB0eXBlUmVmLFxuICAgICAgICAgIC8qIGluaXRpYWxpemVyICovIHVuZGVmaW5lZCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHMudXBkYXRlQ2xhc3NEZWNsYXJhdGlvbihcbiAgICAgICAgLyogbm9kZSAqLyBjbGF6eixcbiAgICAgICAgLyogZGVjb3JhdG9ycyAqLyBjbGF6ei5kZWNvcmF0b3JzLFxuICAgICAgICAvKiBtb2RpZmllcnMgKi8gY2xhenoubW9kaWZpZXJzLFxuICAgICAgICAvKiBuYW1lICovIGNsYXp6Lm5hbWUsXG4gICAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIGNsYXp6LnR5cGVQYXJhbWV0ZXJzLFxuICAgICAgICAvKiBoZXJpdGFnZUNsYXVzZXMgKi8gY2xhenouaGVyaXRhZ2VDbGF1c2VzLFxuICAgICAgICAvKiBtZW1iZXJzICovWy4uLm1lbWJlcnMsIC4uLm5ld01lbWJlcnNdKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXJrRm9yRW1pdEFzU2luZ2xlTGluZShub2RlOiB0cy5Ob2RlKSB7XG4gIHRzLnNldEVtaXRGbGFncyhub2RlLCB0cy5FbWl0RmxhZ3MuU2luZ2xlTGluZSk7XG4gIHRzLmZvckVhY2hDaGlsZChub2RlLCBtYXJrRm9yRW1pdEFzU2luZ2xlTGluZSk7XG59XG4iXX0=