import * as ts from 'typescript';
import { findImportSpecifier } from '../../utils/typescript/imports';
function* visit(directory) {
    for (const path of directory.subfiles) {
        if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
            const entry = directory.file(path);
            if (entry) {
                const content = entry.content;
                if (content.includes('XhrFactory')) {
                    const source = ts.createSourceFile(entry.path, content.toString().replace(/^\uFEFF/, ''), ts.ScriptTarget.Latest, true);
                    yield source;
                }
            }
        }
    }
    for (const path of directory.subdirs) {
        if (path === 'node_modules' || path.startsWith('.')) {
            continue;
        }
        yield* visit(directory.dir(path));
    }
}
export default function () {
    return tree => {
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        for (const sourceFile of visit(tree.root)) {
            let recorder;
            const allImportDeclarations = sourceFile.statements.filter(n => ts.isImportDeclaration(n));
            if (allImportDeclarations.length === 0) {
                continue;
            }
            const httpCommonImport = findImportDeclaration('@angular/common/http', allImportDeclarations);
            if (!httpCommonImport) {
                continue;
            }
            const commonHttpNamedBinding = getNamedImports(httpCommonImport);
            if (commonHttpNamedBinding) {
                const commonHttpNamedImports = commonHttpNamedBinding.elements;
                const xhrFactorySpecifier = findImportSpecifier(commonHttpNamedImports, 'XhrFactory');
                if (!xhrFactorySpecifier) {
                    continue;
                }
                recorder = tree.beginUpdate(sourceFile.fileName);
                // Remove 'XhrFactory' from '@angular/common/http'
                if (commonHttpNamedImports.length > 1) {
                    // Remove 'XhrFactory' named import
                    const index = commonHttpNamedBinding.getStart();
                    const length = commonHttpNamedBinding.getWidth();
                    const newImports = printer.printNode(ts.EmitHint.Unspecified, ts.factory.updateNamedImports(commonHttpNamedBinding, commonHttpNamedBinding.elements.filter(e => e !== xhrFactorySpecifier)), sourceFile);
                    recorder.remove(index, length).insertLeft(index, newImports);
                }
                else {
                    // Remove '@angular/common/http' import
                    const index = httpCommonImport.getFullStart();
                    const length = httpCommonImport.getFullWidth();
                    recorder.remove(index, length);
                }
                // Import XhrFactory from @angular/common
                const commonImport = findImportDeclaration('@angular/common', allImportDeclarations);
                const commonNamedBinding = getNamedImports(commonImport);
                if (commonNamedBinding) {
                    // Already has an import for '@angular/common', just add the named import.
                    const index = commonNamedBinding.getStart();
                    const length = commonNamedBinding.getWidth();
                    const newImports = printer.printNode(ts.EmitHint.Unspecified, ts.factory.updateNamedImports(commonNamedBinding, [...commonNamedBinding.elements, xhrFactorySpecifier]), sourceFile);
                    recorder.remove(index, length).insertLeft(index, newImports);
                }
                else {
                    // Add import to '@angular/common'
                    const index = httpCommonImport.getFullStart();
                    recorder.insertLeft(index, `\nimport { XhrFactory } from '@angular/common';`);
                }
            }
            if (recorder) {
                tree.commitUpdate(recorder);
            }
        }
    };
}
function findImportDeclaration(moduleSpecifier, importDeclarations) {
    return importDeclarations.find(n => ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === moduleSpecifier);
}
function getNamedImports(importDeclaration) {
    var _a;
    const namedBindings = (_a = importDeclaration === null || importDeclaration === void 0 ? void 0 : importDeclaration.importClause) === null || _a === void 0 ? void 0 : _a.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
        return namedBindings;
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy94aHItZmFjdG9yeS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFRQSxPQUFPLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVuRSxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBbUI7SUFDakMsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFO1FBQ3JDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDbkQsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxJQUFJLEtBQUssRUFBRTtnQkFDVCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO2dCQUM5QixJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQ2xDLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDOUIsS0FBSyxDQUFDLElBQUksRUFDVixPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFDekMsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQ3RCLElBQUksQ0FDUCxDQUFDO29CQUVGLE1BQU0sTUFBTSxDQUFDO2lCQUNkO2FBQ0Y7U0FDRjtLQUNGO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFO1FBQ3BDLElBQUksSUFBSSxLQUFLLGNBQWMsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxF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QUU7UUFDckQsT0FBTyxhQUFhLENBQUM7S0FDdEI7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0RpckVudHJ5LCBSdWxlLCBVcGRhdGVSZWNvcmRlcn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge2ZpbmRJbXBvcnRTcGVjaWZpZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3R5cGVzY3JpcHQvaW1wb3J0cyc7XG5cbmZ1bmN0aW9uKiB2aXNpdChkaXJlY3Rvcnk6IERpckVudHJ5KTogSXRlcmFibGVJdGVyYXRvcjx0cy5Tb3VyY2VGaWxlPiB7XG4gIGZvciAoY29uc3QgcGF0aCBvZiBkaXJlY3Rvcnkuc3ViZmlsZXMpIHtcbiAgICBpZiAocGF0aC5lbmRzV2l0aCgnLnRzJykgJiYgIXBhdGguZW5kc1dpdGgoJy5kLnRzJykpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gZGlyZWN0b3J5LmZpbGUocGF0aCk7XG4gICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGVudHJ5LmNvbnRlbnQ7XG4gICAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdYaHJGYWN0b3J5JykpIHtcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0cy5jcmVhdGVTb3VyY2VGaWxlKFxuICAgICAgICAgICAgICBlbnRyeS5wYXRoLFxuICAgICAgICAgICAgICBjb250ZW50LnRvU3RyaW5nKCkucmVwbGFjZSgvXlxcdUZFRkYvLCAnJyksXG4gICAgICAgICAgICAgIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QsXG4gICAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIHlpZWxkIHNvdXJjZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgcGF0aCBvZiBkaXJlY3Rvcnkuc3ViZGlycykge1xuICAgIGlmIChwYXRoID09PSAnbm9kZV9tb2R1bGVzJyB8fCBwYXRoLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgeWllbGQqIHZpc2l0KGRpcmVjdG9yeS5kaXIocGF0aCkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKCk6IFJ1bGUge1xuICByZXR1cm4gdHJlZSA9PiB7XG4gICAgY29uc3QgcHJpbnRlciA9IHRzLmNyZWF0ZVByaW50ZXIoe25ld0xpbmU6IHRzLk5ld0xpbmVLaW5kLkxpbmVGZWVkfSk7XG5cbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgdmlzaXQodHJlZS5yb290KSkge1xuICAgICAgbGV0IHJlY29yZGVyOiBVcGRhdGVSZWNvcmRlcnx1bmRlZmluZWQ7XG5cbiAgICAgIGNvbnN0IGFsbEltcG9ydERlY2xhcmF0aW9ucyA9XG4gICAgICAgICAgc291cmNlRmlsZS5zdGF0ZW1lbnRzLmZpbHRlcihuID0+IHRzLmlzSW1wb3J0RGVjbGFyYXRpb24obikpIGFzIHRzLkltcG9ydERlY2xhcmF0aW9uW107XG4gICAgICBpZiAoYWxsSW1wb3J0RGVjbGFyYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaHR0cENvbW1vbkltcG9ydCA9IGZpbmRJbXBvcnREZWNsYXJhdGlvbignQGFuZ3VsYXIvY29tbW9uL2h0dHAnLCBhbGxJbXBvcnREZWNsYXJhdGlvbnMpO1xuICAgICAgaWYgKCFodHRwQ29tbW9uSW1wb3J0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb21tb25IdHRwTmFtZWRCaW5kaW5nID0gZ2V0TmFtZWRJbXBvcnRzKGh0dHBDb21tb25JbXBvcnQpO1xuICAgICAgaWYgKGNvbW1vbkh0dHBOYW1lZEJpbmRpbmcpIHtcbiAgICAgICAgY29uc3QgY29tbW9uSHR0cE5hbWVkSW1wb3J0cyA9IGNvbW1vbkh0dHBOYW1lZEJpbmRpbmcuZWxlbWVudHM7XG4gICAgICAgIGNvbnN0IHhockZhY3RvcnlTcGVjaWZpZXIgPSBmaW5kSW1wb3J0U3BlY2lmaWVyKGNvbW1vbkh0dHBOYW1lZEltcG9ydHMsICdYaHJGYWN0b3J5Jyk7XG5cbiAgICAgICAgaWYgKCF4aHJGYWN0b3J5U3BlY2lmaWVyKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICByZWNvcmRlciA9IHRyZWUuYmVnaW5VcGRhdGUoc291cmNlRmlsZS5maWxlTmFtZSk7XG5cbiAgICAgICAgLy8gUmVtb3ZlICdYaHJGYWN0b3J5JyBmcm9tICdAYW5ndWxhci9jb21tb24vaHR0cCdcbiAgICAgICAgaWYgKGNvbW1vbkh0dHBOYW1lZEltcG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIC8vIFJlbW92ZSAnWGhyRmFjdG9yeScgbmFtZWQgaW1wb3J0XG4gICAgICAgICAgY29uc3QgaW5kZXggPSBjb21tb25IdHRwTmFtZWRCaW5kaW5nLmdldFN0YXJ0KCk7XG4gICAgICAgICAgY29uc3QgbGVuZ3RoID0gY29tbW9uSHR0cE5hbWVkQmluZGluZy5nZXRXaWR0aCgpO1xuXG4gICAgICAgICAgY29uc3QgbmV3SW1wb3J0cyA9IHByaW50ZXIucHJpbnROb2RlKFxuICAgICAgICAgICAgICB0cy5FbWl0SGludC5VbnNwZWNpZmllZCxcbiAgICAgICAgICAgICAgdHMuZmFjdG9yeS51cGRhdGVOYW1lZEltcG9ydHMoXG4gICAgICAgICAgICAgICAgICBjb21tb25IdHRwTmFtZWRCaW5kaW5nLFxuICAgICAgICAgICAgICAgICAgY29tbW9uSHR0cE5hbWVkQmluZGluZy5lbGVtZW50cy5maWx0ZXIoZSA9PiBlICE9PSB4aHJGYWN0b3J5U3BlY2lmaWVyKSksXG4gICAgICAgICAgICAgIHNvdXJjZUZpbGUpO1xuICAgICAgICAgIHJlY29yZGVyLnJlbW92ZShpbmRleCwgbGVuZ3RoKS5pbnNlcnRMZWZ0KGluZGV4LCBuZXdJbXBvcnRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZW1vdmUgJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJyBpbXBvcnRcbiAgICAgICAgICBjb25zdCBpbmRleCA9IGh0dHBDb21tb25JbXBvcnQuZ2V0RnVsbFN0YXJ0KCk7XG4gICAgICAgICAgY29uc3QgbGVuZ3RoID0gaHR0cENvbW1vbkltcG9ydC5nZXRGdWxsV2lkdGgoKTtcbiAgICAgICAgICByZWNvcmRlci5yZW1vdmUoaW5kZXgsIGxlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbXBvcnQgWGhyRmFjdG9yeSBmcm9tIEBhbmd1bGFyL2NvbW1vblxuICAgICAgICBjb25zdCBjb21tb25JbXBvcnQgPSBmaW5kSW1wb3J0RGVjbGFyYXRpb24oJ0Bhbmd1bGFyL2NvbW1vbicsIGFsbEltcG9ydERlY2xhcmF0aW9ucyk7XG4gICAgICAgIGNvbnN0IGNvbW1vbk5hbWVkQmluZGluZyA9IGdldE5hbWVkSW1wb3J0cyhjb21tb25JbXBvcnQpO1xuICAgICAgICBpZiAoY29tbW9uTmFtZWRCaW5kaW5nKSB7XG4gICAgICAgICAgLy8gQWxyZWFkeSBoYXMgYW4gaW1wb3J0IGZvciAnQGFuZ3VsYXIvY29tbW9uJywganVzdCBhZGQgdGhlIG5hbWVkIGltcG9ydC5cbiAgICAgICAgICBjb25zdCBpbmRleCA9IGNvbW1vbk5hbWVkQmluZGluZy5nZXRTdGFydCgpO1xuICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IGNvbW1vbk5hbWVkQmluZGluZy5nZXRXaWR0aCgpO1xuICAgICAgICAgIGNvbnN0IG5ld0ltcG9ydHMgPSBwcmludGVyLnByaW50Tm9kZShcbiAgICAgICAgICAgICAgdHMuRW1pdEhpbnQuVW5zcGVjaWZpZWQsXG4gICAgICAgICAgICAgIHRzLmZhY3RvcnkudXBkYXRlTmFtZWRJbXBvcnRzKFxuICAgICAgICAgICAgICAgICAgY29tbW9uTmFtZWRCaW5kaW5nLCBbLi4uY29tbW9uTmFtZWRCaW5kaW5nLmVsZW1lbnRzLCB4aHJGYWN0b3J5U3BlY2lmaWVyXSksXG4gICAgICAgICAgICAgIHNvdXJjZUZpbGUpO1xuXG4gICAgICAgICAgcmVjb3JkZXIucmVtb3ZlKGluZGV4LCBsZW5ndGgpLmluc2VydExlZnQoaW5kZXgsIG5ld0ltcG9ydHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEFkZCBpbXBvcnQgdG8gJ0Bhbmd1bGFyL2NvbW1vbidcbiAgICAgICAgICBjb25zdCBpbmRleCA9IGh0dHBDb21tb25JbXBvcnQuZ2V0RnVsbFN0YXJ0KCk7XG4gICAgICAgICAgcmVjb3JkZXIuaW5zZXJ0TGVmdChpbmRleCwgYFxcbmltcG9ydCB7IFhockZhY3RvcnkgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO2ApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyZWNvcmRlcikge1xuICAgICAgICB0cmVlLmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kSW1wb3J0RGVjbGFyYXRpb24obW9kdWxlU3BlY2lmaWVyOiBzdHJpbmcsIGltcG9ydERlY2xhcmF0aW9uczogdHMuSW1wb3J0RGVjbGFyYXRpb25bXSk6XG4gICAgdHMuSW1wb3J0RGVjbGFyYXRpb258dW5kZWZpbmVkIHtcbiAgcmV0dXJuIGltcG9ydERlY2xhcmF0aW9ucy5maW5kKFxuICAgICAgbiA9PiB0cy5pc1N0cmluZ0xpdGVyYWwobi5tb2R1bGVTcGVjaWZpZXIpICYmIG4ubW9kdWxlU3BlY2lmaWVyLnRleHQgPT09IG1vZHVsZVNwZWNpZmllcik7XG59XG5cbmZ1bmN0aW9uIGdldE5hbWVkSW1wb3J0cyhpbXBvcnREZWNsYXJhdGlvbjogdHMuSW1wb3J0RGVjbGFyYXRpb258dW5kZWZpbmVkKTogdHMuTmFtZWRJbXBvcnRzfFxuICAgIHVuZGVmaW5lZCB7XG4gIGNvbnN0IG5hbWVkQmluZGluZ3MgPSBpbXBvcnREZWNsYXJhdGlvbj8uaW1wb3J0Q2xhdXNlPy5uYW1lZEJpbmRpbmdzO1xuICBpZiAobmFtZWRCaW5kaW5ncyAmJiB0cy5pc05hbWVkSW1wb3J0cyhuYW1lZEJpbmRpbmdzKSkge1xuICAgIHJldHVybiBuYW1lZEJpbmRpbmdzO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbiJdfQ==