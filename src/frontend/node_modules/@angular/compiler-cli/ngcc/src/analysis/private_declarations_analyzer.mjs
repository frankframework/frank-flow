import { absoluteFromSourceFile } from '../../../src/ngtsc/file_system';
import { hasNameIdentifier, isDefined } from '../utils';
/**
 * This class will analyze a program to find all the declared classes
 * (i.e. on an NgModule) that are not publicly exported via an entry-point.
 */
export class PrivateDeclarationsAnalyzer {
    constructor(host, referencesRegistry) {
        this.host = host;
        this.referencesRegistry = referencesRegistry;
    }
    analyzeProgram(program) {
        const rootFiles = this.getRootFiles(program);
        return this.getPrivateDeclarations(rootFiles, this.referencesRegistry.getDeclarationMap());
    }
    getRootFiles(program) {
        return program.getRootFileNames().map(f => program.getSourceFile(f)).filter(isDefined);
    }
    getPrivateDeclarations(rootFiles, declarations) {
        const privateDeclarations = new Map(declarations);
        rootFiles.forEach(f => {
            const exports = this.host.getExportsOfModule(f);
            if (exports) {
                exports.forEach((declaration, exportedName) => {
                    if (declaration.node !== null && hasNameIdentifier(declaration.node)) {
                        if (privateDeclarations.has(declaration.node.name)) {
                            const privateDeclaration = privateDeclarations.get(declaration.node.name);
                            if (privateDeclaration.node !== declaration.node) {
                                throw new Error(`${declaration.node.name.text} is declared multiple times.`);
                            }
                            // This declaration is public so we can remove it from the list
                            privateDeclarations.delete(declaration.node.name);
                        }
                    }
                });
            }
        });
        return Array.from(privateDeclarations.keys()).map(id => {
            const from = absoluteFromSourceFile(id.getSourceFile());
            const declaration = privateDeclarations.get(id);
            const dtsDeclaration = this.host.getDtsDeclaration(declaration.node);
            const dtsFrom = dtsDeclaration && absoluteFromSourceFile(dtsDeclaration.getSourceFile());
            return { identifier: id.text, from, dtsFrom };
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJpdmF0ZV9kZWNsYXJhdGlvbnNfYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbmdjYy9zcmMvYW5hbHlzaXMvcHJpdmF0ZV9kZWNsYXJhdGlvbnNfYW5hbHl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFDLHNCQUFzQixFQUFpQixNQUFNLGdDQUFnQyxDQUFDO0FBR3RGLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxTQUFTLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFXdEQ7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLDJCQUEyQjtJQUN0QyxZQUNZLElBQXdCLEVBQVUsa0JBQTBDO1FBQTVFLFNBQUksR0FBSixJQUFJLENBQW9CO1FBQVUsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUF3QjtJQUFHLENBQUM7SUFFNUYsY0FBYyxDQUFDLE9BQW1CO1FBQ2hDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0MsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVPLFlBQVksQ0FBQyxPQUFtQjtRQUN0QyxPQUFPLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDekYsQ0FBQztJQUVPLHNCQUFzQixDQUMxQixTQUEwQixFQUMxQixZQUE2QztRQUMvQyxNQUFNLG1CQUFtQixHQUFvQyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVuRixTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3BCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEQsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUsRUFBRTtvQkFDNUMsSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ3BFLElBQUksbUJBQW1CLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7NEJBQ2xELE1BQU0sa0JBQWtCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUM7NEJBQzNFLElBQUksa0JBQWtCLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxJQUFJLEVBQUU7Z0NBQ2hELE1BQU0sSUFBSSxLQUFLLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLDhCQUE4QixDQUFDLENBQUM7NkJBQzlFOzRCQUNELCtEQUErRDs0QkFDL0QsbUJBQW1CLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7eUJBQ25EO3FCQUNGO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNyRCxNQUFNLElBQUksR0FBRyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztZQUN4RCxNQUFNLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFFLENBQUM7WUFDakQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckUsTUFBTSxPQUFPLEdBQUcsY0FBYyxJQUFJLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO1lBRXpGLE9BQU8sRUFBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7UUFDOUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2Fic29sdXRlRnJvbVNvdXJjZUZpbGUsIEFic29sdXRlRnNQYXRofSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtEZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtOZ2NjUmVmbGVjdGlvbkhvc3R9IGZyb20gJy4uL2hvc3QvbmdjY19ob3N0JztcbmltcG9ydCB7aGFzTmFtZUlkZW50aWZpZXIsIGlzRGVmaW5lZH0gZnJvbSAnLi4vdXRpbHMnO1xuXG5pbXBvcnQge05nY2NSZWZlcmVuY2VzUmVnaXN0cnl9IGZyb20gJy4vbmdjY19yZWZlcmVuY2VzX3JlZ2lzdHJ5JztcblxuZXhwb3J0IGludGVyZmFjZSBFeHBvcnRJbmZvIHtcbiAgaWRlbnRpZmllcjogc3RyaW5nO1xuICBmcm9tOiBBYnNvbHV0ZUZzUGF0aDtcbiAgZHRzRnJvbT86IEFic29sdXRlRnNQYXRofG51bGw7XG59XG5leHBvcnQgdHlwZSBQcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXMgPSBFeHBvcnRJbmZvW107XG5cbi8qKlxuICogVGhpcyBjbGFzcyB3aWxsIGFuYWx5emUgYSBwcm9ncmFtIHRvIGZpbmQgYWxsIHRoZSBkZWNsYXJlZCBjbGFzc2VzXG4gKiAoaS5lLiBvbiBhbiBOZ01vZHVsZSkgdGhhdCBhcmUgbm90IHB1YmxpY2x5IGV4cG9ydGVkIHZpYSBhbiBlbnRyeS1wb2ludC5cbiAqL1xuZXhwb3J0IGNsYXNzIFByaXZhdGVEZWNsYXJhdGlvbnNBbmFseXplciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBob3N0OiBOZ2NjUmVmbGVjdGlvbkhvc3QsIHByaXZhdGUgcmVmZXJlbmNlc1JlZ2lzdHJ5OiBOZ2NjUmVmZXJlbmNlc1JlZ2lzdHJ5KSB7fVxuXG4gIGFuYWx5emVQcm9ncmFtKHByb2dyYW06IHRzLlByb2dyYW0pOiBQcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXMge1xuICAgIGNvbnN0IHJvb3RGaWxlcyA9IHRoaXMuZ2V0Um9vdEZpbGVzKHByb2dyYW0pO1xuICAgIHJldHVybiB0aGlzLmdldFByaXZhdGVEZWNsYXJhdGlvbnMocm9vdEZpbGVzLCB0aGlzLnJlZmVyZW5jZXNSZWdpc3RyeS5nZXREZWNsYXJhdGlvbk1hcCgpKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Um9vdEZpbGVzKHByb2dyYW06IHRzLlByb2dyYW0pOiB0cy5Tb3VyY2VGaWxlW10ge1xuICAgIHJldHVybiBwcm9ncmFtLmdldFJvb3RGaWxlTmFtZXMoKS5tYXAoZiA9PiBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZikpLmZpbHRlcihpc0RlZmluZWQpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRQcml2YXRlRGVjbGFyYXRpb25zKFxuICAgICAgcm9vdEZpbGVzOiB0cy5Tb3VyY2VGaWxlW10sXG4gICAgICBkZWNsYXJhdGlvbnM6IE1hcDx0cy5JZGVudGlmaWVyLCBEZWNsYXJhdGlvbj4pOiBQcml2YXRlRGVjbGFyYXRpb25zQW5hbHlzZXMge1xuICAgIGNvbnN0IHByaXZhdGVEZWNsYXJhdGlvbnM6IE1hcDx0cy5JZGVudGlmaWVyLCBEZWNsYXJhdGlvbj4gPSBuZXcgTWFwKGRlY2xhcmF0aW9ucyk7XG5cbiAgICByb290RmlsZXMuZm9yRWFjaChmID0+IHtcbiAgICAgIGNvbnN0IGV4cG9ydHMgPSB0aGlzLmhvc3QuZ2V0RXhwb3J0c09mTW9kdWxlKGYpO1xuICAgICAgaWYgKGV4cG9ydHMpIHtcbiAgICAgICAgZXhwb3J0cy5mb3JFYWNoKChkZWNsYXJhdGlvbiwgZXhwb3J0ZWROYW1lKSA9PiB7XG4gICAgICAgICAgaWYgKGRlY2xhcmF0aW9uLm5vZGUgIT09IG51bGwgJiYgaGFzTmFtZUlkZW50aWZpZXIoZGVjbGFyYXRpb24ubm9kZSkpIHtcbiAgICAgICAgICAgIGlmIChwcml2YXRlRGVjbGFyYXRpb25zLmhhcyhkZWNsYXJhdGlvbi5ub2RlLm5hbWUpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByaXZhdGVEZWNsYXJhdGlvbiA9IHByaXZhdGVEZWNsYXJhdGlvbnMuZ2V0KGRlY2xhcmF0aW9uLm5vZGUubmFtZSkhO1xuICAgICAgICAgICAgICBpZiAocHJpdmF0ZURlY2xhcmF0aW9uLm5vZGUgIT09IGRlY2xhcmF0aW9uLm5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZGVjbGFyYXRpb24ubm9kZS5uYW1lLnRleHR9IGlzIGRlY2xhcmVkIG11bHRpcGxlIHRpbWVzLmApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIFRoaXMgZGVjbGFyYXRpb24gaXMgcHVibGljIHNvIHdlIGNhbiByZW1vdmUgaXQgZnJvbSB0aGUgbGlzdFxuICAgICAgICAgICAgICBwcml2YXRlRGVjbGFyYXRpb25zLmRlbGV0ZShkZWNsYXJhdGlvbi5ub2RlLm5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gQXJyYXkuZnJvbShwcml2YXRlRGVjbGFyYXRpb25zLmtleXMoKSkubWFwKGlkID0+IHtcbiAgICAgIGNvbnN0IGZyb20gPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKGlkLmdldFNvdXJjZUZpbGUoKSk7XG4gICAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHByaXZhdGVEZWNsYXJhdGlvbnMuZ2V0KGlkKSE7XG4gICAgICBjb25zdCBkdHNEZWNsYXJhdGlvbiA9IHRoaXMuaG9zdC5nZXREdHNEZWNsYXJhdGlvbihkZWNsYXJhdGlvbi5ub2RlKTtcbiAgICAgIGNvbnN0IGR0c0Zyb20gPSBkdHNEZWNsYXJhdGlvbiAmJiBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKGR0c0RlY2xhcmF0aW9uLmdldFNvdXJjZUZpbGUoKSk7XG5cbiAgICAgIHJldHVybiB7aWRlbnRpZmllcjogaWQudGV4dCwgZnJvbSwgZHRzRnJvbX07XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==