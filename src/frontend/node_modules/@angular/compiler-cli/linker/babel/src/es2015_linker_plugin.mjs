import { __rest } from "tslib";
import * as t from '@babel/types';
import { FileLinker, isFatalLinkerError, LinkerEnvironment } from '../../../linker';
import { BabelAstFactory } from './ast/babel_ast_factory';
import { BabelAstHost } from './ast/babel_ast_host';
import { BabelDeclarationScope } from './babel_declaration_scope';
/**
 * Create a Babel plugin that visits the program, identifying and linking partial declarations.
 *
 * The plugin delegates most of its work to a generic `FileLinker` for each file (`t.Program` in
 * Babel) that is visited.
 */
export function createEs2015LinkerPlugin(_a) {
    var { fileSystem, logger } = _a, options = __rest(_a, ["fileSystem", "logger"]);
    let fileLinker = null;
    return {
        visitor: {
            Program: {
                /**
                 * Create a new `FileLinker` as we enter each file (`t.Program` in Babel).
                 */
                enter(path) {
                    var _a, _b;
                    assertNull(fileLinker);
                    // Babel can be configured with a `filename` or `relativeFilename` (or both, or neither) -
                    // possibly relative to the optional `cwd` path.
                    const file = path.hub.file;
                    const filename = (_a = file.opts.filename) !== null && _a !== void 0 ? _a : file.opts.filenameRelative;
                    if (!filename) {
                        throw new Error('No filename (nor filenameRelative) provided by Babel. This is required for the linking of partially compiled directives and components.');
                    }
                    const sourceUrl = fileSystem.resolve((_b = file.opts.cwd) !== null && _b !== void 0 ? _b : '.', filename);
                    const linkerEnvironment = LinkerEnvironment.create(fileSystem, logger, new BabelAstHost(), new BabelAstFactory(sourceUrl), options);
                    fileLinker = new FileLinker(linkerEnvironment, sourceUrl, file.code);
                },
                /**
                 * On exiting the file, insert any shared constant statements that were generated during
                 * linking of the partial declarations.
                 */
                exit() {
                    assertNotNull(fileLinker);
                    for (const { constantScope, statements } of fileLinker.getConstantStatements()) {
                        insertStatements(constantScope, statements);
                    }
                    fileLinker = null;
                }
            },
            /**
             * Test each call expression to see if it is a partial declaration; it if is then replace it
             * with the results of linking the declaration.
             */
            CallExpression(call) {
                if (fileLinker === null) {
                    // Any statements that are inserted upon program exit will be visited outside of an active
                    // linker context. These call expressions are known not to contain partial declarations,
                    // so it's safe to skip visiting those call expressions.
                    return;
                }
                try {
                    const calleeName = getCalleeName(call);
                    if (calleeName === null) {
                        return;
                    }
                    const args = call.node.arguments;
                    if (!fileLinker.isPartialDeclaration(calleeName) || !isExpressionArray(args)) {
                        return;
                    }
                    const declarationScope = new BabelDeclarationScope(call.scope);
                    const replacement = fileLinker.linkPartialDeclaration(calleeName, args, declarationScope);
                    call.replaceWith(replacement);
                }
                catch (e) {
                    const node = isFatalLinkerError(e) ? e.node : call.node;
                    throw buildCodeFrameError(call.hub.file, e.message, node);
                }
            }
        }
    };
}
/**
 * Insert the `statements` at the location defined by `path`.
 *
 * The actual insertion strategy depends upon the type of the `path`.
 */
function insertStatements(path, statements) {
    if (path.isFunction()) {
        insertIntoFunction(path, statements);
    }
    else if (path.isProgram()) {
        insertIntoProgram(path, statements);
    }
}
/**
 * Insert the `statements` at the top of the body of the `fn` function.
 */
function insertIntoFunction(fn, statements) {
    const body = fn.get('body');
    body.unshiftContainer('body', statements);
}
/**
 * Insert the `statements` at the top of the `program`, below any import statements.
 */
function insertIntoProgram(program, statements) {
    const body = program.get('body');
    const importStatements = body.filter(statement => statement.isImportDeclaration());
    if (importStatements.length === 0) {
        program.unshiftContainer('body', statements);
    }
    else {
        importStatements[importStatements.length - 1].insertAfter(statements);
    }
}
function getCalleeName(call) {
    const callee = call.node.callee;
    if (t.isIdentifier(callee)) {
        return callee.name;
    }
    else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
        return callee.property.name;
    }
    else if (t.isMemberExpression(callee) && t.isStringLiteral(callee.property)) {
        return callee.property.value;
    }
    else {
        return null;
    }
}
/**
 * Return true if all the `nodes` are Babel expressions.
 */
function isExpressionArray(nodes) {
    return nodes.every(node => t.isExpression(node));
}
/**
 * Assert that the given `obj` is `null`.
 */
function assertNull(obj) {
    if (obj !== null) {
        throw new Error('BUG - expected `obj` to be null');
    }
}
/**
 * Assert that the given `obj` is not `null`.
 */
function assertNotNull(obj) {
    if (obj === null) {
        throw new Error('BUG - expected `obj` not to be null');
    }
}
/**
 * Create a string representation of an error that includes the code frame of the `node`.
 */
function buildCodeFrameError(file, message, node) {
    const filename = file.opts.filename || '(unknown file)';
    const error = file.buildCodeFrameError(node, message);
    return `${filename}: ${error.message}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXMyMDE1X2xpbmtlcl9wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsL3NyYy9lczIwMTVfbGlua2VyX3BsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBU0EsT0FBTyxLQUFLLENBQUMsTUFBTSxjQUFjLENBQUM7QUFFbEMsT0FBTyxFQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBRWxGLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDbEQsT0FBTyxFQUFDLHFCQUFxQixFQUFvQixNQUFNLDJCQUEyQixDQUFDO0FBSW5GOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEVBQXFEO1FBQXJELEVBQUMsVUFBVSxFQUFFLE1BQU0sT0FBa0MsRUFBN0IsT0FBTyxjQUEvQix3QkFBZ0MsQ0FBRDtJQUV0RSxJQUFJLFVBQVUsR0FBa0UsSUFBSSxDQUFDO0lBRXJGLE9BQU87UUFDTCxPQUFPLEVBQUU7WUFDUCxPQUFPLEVBQUU7Z0JBRVA7O21CQUVHO2dCQUNILEtBQUssQ0FBQyxJQUF5Qjs7b0JBQzdCLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDdkIsMEZBQTBGO29CQUMxRixnREFBZ0Q7b0JBQ2hELE1BQU0sSUFBSSxHQUFjLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO29CQUN0QyxNQUFNLFFBQVEsR0FBRyxNQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxtQ0FBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDO29CQUNsRSxJQUFJLENBQUMsUUFBUSxFQUFFO3dCQUNiLE1BQU0sSUFBSSxLQUFLLENBQ1gseUlBQXlJ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RztBQUNILFNBQVMsaUJBQWlCLENBQUMsS0FBZTtJQUN4QyxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxVQUFVLENBQUksR0FBVztJQUNoQyxJQUFJLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0tBQ3BEO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxhQUFhLENBQUksR0FBVztJQUNuQyxJQUFJLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0tBQ3hEO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxtQkFBbUIsQ0FBQyxJQUFlLEVBQUUsT0FBZSxFQUFFLElBQVk7SUFDekUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksZ0JBQWdCLENBQUM7SUFDeEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN0RCxPQUFPLEdBQUcsUUFBUSxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1BsdWdpbk9ian0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IHtOb2RlUGF0aH0gZnJvbSAnQGJhYmVsL3RyYXZlcnNlJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnQGJhYmVsL3R5cGVzJztcblxuaW1wb3J0IHtGaWxlTGlua2VyLCBpc0ZhdGFsTGlua2VyRXJyb3IsIExpbmtlckVudmlyb25tZW50fSBmcm9tICcuLi8uLi8uLi9saW5rZXInO1xuXG5pbXBvcnQge0JhYmVsQXN0RmFjdG9yeX0gZnJvbSAnLi9hc3QvYmFiZWxfYXN0X2ZhY3RvcnknO1xuaW1wb3J0IHtCYWJlbEFzdEhvc3R9IGZyb20gJy4vYXN0L2JhYmVsX2FzdF9ob3N0JztcbmltcG9ydCB7QmFiZWxEZWNsYXJhdGlvblNjb3BlLCBDb25zdGFudFNjb3BlUGF0aH0gZnJvbSAnLi9iYWJlbF9kZWNsYXJhdGlvbl9zY29wZSc7XG5pbXBvcnQge0xpbmtlclBsdWdpbk9wdGlvbnN9IGZyb20gJy4vbGlua2VyX3BsdWdpbl9vcHRpb25zJztcblxuXG4vKipcbiAqIENyZWF0ZSBhIEJhYmVsIHBsdWdpbiB0aGF0IHZpc2l0cyB0aGUgcHJvZ3JhbSwgaWRlbnRpZnlpbmcgYW5kIGxpbmtpbmcgcGFydGlhbCBkZWNsYXJhdGlvbnMuXG4gKlxuICogVGhlIHBsdWdpbiBkZWxlZ2F0ZXMgbW9zdCBvZiBpdHMgd29yayB0byBhIGdlbmVyaWMgYEZpbGVMaW5rZXJgIGZvciBlYWNoIGZpbGUgKGB0LlByb2dyYW1gIGluXG4gKiBCYWJlbCkgdGhhdCBpcyB2aXNpdGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luKHtmaWxlU3lzdGVtLCBsb2dnZXIsIC4uLm9wdGlvbnN9OiBMaW5rZXJQbHVnaW5PcHRpb25zKTpcbiAgICBQbHVnaW5PYmoge1xuICBsZXQgZmlsZUxpbmtlcjogRmlsZUxpbmtlcjxDb25zdGFudFNjb3BlUGF0aCwgdC5TdGF0ZW1lbnQsIHQuRXhwcmVzc2lvbj58bnVsbCA9IG51bGw7XG5cbiAgcmV0dXJuIHtcbiAgICB2aXNpdG9yOiB7XG4gICAgICBQcm9ncmFtOiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBgRmlsZUxpbmtlcmAgYXMgd2UgZW50ZXIgZWFjaCBmaWxlIChgdC5Qcm9ncmFtYCBpbiBCYWJlbCkuXG4gICAgICAgICAqL1xuICAgICAgICBlbnRlcihwYXRoOiBOb2RlUGF0aDx0LlByb2dyYW0+KTogdm9pZCB7XG4gICAgICAgICAgYXNzZXJ0TnVsbChmaWxlTGlua2VyKTtcbiAgICAgICAgICAvLyBCYWJlbCBjYW4gYmUgY29uZmlndXJlZCB3aXRoIGEgYGZpbGVuYW1lYCBvciBgcmVsYXRpdmVGaWxlbmFtZWAgKG9yIGJvdGgsIG9yIG5laXRoZXIpIC1cbiAgICAgICAgICAvLyBwb3NzaWJseSByZWxhdGl2ZSB0byB0aGUgb3B0aW9uYWwgYGN3ZGAgcGF0aC5cbiAgICAgICAgICBjb25zdCBmaWxlOiBCYWJlbEZpbGUgPSBwYXRoLmh1Yi5maWxlO1xuICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gZmlsZS5vcHRzLmZpbGVuYW1lID8/IGZpbGUub3B0cy5maWxlbmFtZVJlbGF0aXZlO1xuICAgICAgICAgIGlmICghZmlsZW5hbWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAnTm8gZmlsZW5hbWUgKG5vciBmaWxlbmFtZVJlbGF0aXZlKSBwcm92aWRlZCBieSBCYWJlbC4gVGhpcyBpcyByZXF1aXJlZCBmb3IgdGhlIGxpbmtpbmcgb2YgcGFydGlhbGx5IGNvbXBpbGVkIGRpcmVjdGl2ZXMgYW5kIGNvbXBvbmVudHMuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHNvdXJjZVVybCA9IGZpbGVTeXN0ZW0ucmVzb2x2ZShmaWxlLm9wdHMuY3dkID8/ICcuJywgZmlsZW5hbWUpO1xuXG4gICAgICAgICAgY29uc3QgbGlua2VyRW52aXJvbm1lbnQgPSBMaW5rZXJFbnZpcm9ubWVudC5jcmVhdGU8dC5TdGF0ZW1lbnQsIHQuRXhwcmVzc2lvbj4oXG4gICAgICAgICAgICAgIGZpbGVTeXN0ZW0sIGxvZ2dlciwgbmV3IEJhYmVsQXN0SG9zdCgpLCBuZXcgQmFiZWxBc3RGYWN0b3J5KHNvdXJjZVVybCksIG9wdGlvbnMpO1xuICAgICAgICAgIGZpbGVMaW5rZXIgPSBuZXcgRmlsZUxpbmtlcihsaW5rZXJFbnZpcm9ubWVudCwgc291cmNlVXJsLCBmaWxlLmNvZGUpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBPbiBleGl0aW5nIHRoZSBmaWxlLCBpbnNlcnQgYW55IHNoYXJlZCBjb25zdGFudCBzdGF0ZW1lbnRzIHRoYXQgd2VyZSBnZW5lcmF0ZWQgZHVyaW5nXG4gICAgICAgICAqIGxpbmtpbmcgb2YgdGhlIHBhcnRpYWwgZGVjbGFyYXRpb25zLlxuICAgICAgICAgKi9cbiAgICAgICAgZXhpdCgpOiB2b2lkIHtcbiAgICAgICAgICBhc3NlcnROb3ROdWxsKGZpbGVMaW5rZXIpO1xuICAgICAgICAgIGZvciAoY29uc3Qge2NvbnN0YW50U2NvcGUsIHN0YXRlbWVudHN9IG9mIGZpbGVMaW5rZXIuZ2V0Q29uc3RhbnRTdGF0ZW1lbnRzKCkpIHtcbiAgICAgICAgICAgIGluc2VydFN0YXRlbWVudHMoY29uc3RhbnRTY29wZSwgc3RhdGVtZW50cyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZpbGVMaW5rZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFRlc3QgZWFjaCBjYWxsIGV4cHJlc3Npb24gdG8gc2VlIGlmIGl0IGlzIGEgcGFydGlhbCBkZWNsYXJhdGlvbjsgaXQgaWYgaXMgdGhlbiByZXBsYWNlIGl0XG4gICAgICAgKiB3aXRoIHRoZSByZXN1bHRzIG9mIGxpbmtpbmcgdGhlIGRlY2xhcmF0aW9uLlxuICAgICAgICovXG4gICAgICBDYWxsRXhwcmVzc2lvbihjYWxsOiBOb2RlUGF0aDx0LkNhbGxFeHByZXNzaW9uPik6IHZvaWQge1xuICAgICAgICBpZiAoZmlsZUxpbmtlciA9PT0gbnVsbCkge1xuICAgICAgICAgIC8vIEFueSBzdGF0ZW1lbnRzIHRoYXQgYXJlIGluc2VydGVkIHVwb24gcHJvZ3JhbSBleGl0IHdpbGwgYmUgdmlzaXRlZCBvdXRzaWRlIG9mIGFuIGFjdGl2ZVxuICAgICAgICAgIC8vIGxpbmtlciBjb250ZXh0LiBUaGVzZSBjYWxsIGV4cHJlc3Npb25zIGFyZSBrbm93biBub3QgdG8gY29udGFpbiBwYXJ0aWFsIGRlY2xhcmF0aW9ucyxcbiAgICAgICAgICAvLyBzbyBpdCdzIHNhZmUgdG8gc2tpcCB2aXNpdGluZyB0aG9zZSBjYWxsIGV4cHJlc3Npb25zLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgY2FsbGVlTmFtZSA9IGdldENhbGxlZU5hbWUoY2FsbCk7XG4gICAgICAgICAgaWYgKGNhbGxlZU5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgYXJncyA9IGNhbGwubm9kZS5hcmd1bWVudHM7XG4gICAgICAgICAgaWYgKCFmaWxlTGlua2VyLmlzUGFydGlhbERlY2xhcmF0aW9uKGNhbGxlZU5hbWUpIHx8ICFpc0V4cHJlc3Npb25BcnJheShhcmdzKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uU2NvcGUgPSBuZXcgQmFiZWxEZWNsYXJhdGlvblNjb3BlKGNhbGwuc2NvcGUpO1xuICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gZmlsZUxpbmtlci5saW5rUGFydGlhbERlY2xhcmF0aW9uKGNhbGxlZU5hbWUsIGFyZ3MsIGRlY2xhcmF0aW9uU2NvcGUpO1xuXG4gICAgICAgICAgY2FsbC5yZXBsYWNlV2l0aChyZXBsYWNlbWVudCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjb25zdCBub2RlID0gaXNGYXRhbExpbmtlckVycm9yKGUpID8gZS5ub2RlIGFzIHQuTm9kZSA6IGNhbGwubm9kZTtcbiAgICAgICAgICB0aHJvdyBidWlsZENvZGVGcmFtZUVycm9yKGNhbGwuaHViLmZpbGUsIGUubWVzc2FnZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogSW5zZXJ0IHRoZSBgc3RhdGVtZW50c2AgYXQgdGhlIGxvY2F0aW9uIGRlZmluZWQgYnkgYHBhdGhgLlxuICpcbiAqIFRoZSBhY3R1YWwgaW5zZXJ0aW9uIHN0cmF0ZWd5IGRlcGVuZHMgdXBvbiB0aGUgdHlwZSBvZiB0aGUgYHBhdGhgLlxuICovXG5mdW5jdGlvbiBpbnNlcnRTdGF0ZW1lbnRzKHBhdGg6IENvbnN0YW50U2NvcGVQYXRoLCBzdGF0ZW1lbnRzOiB0LlN0YXRlbWVudFtdKTogdm9pZCB7XG4gIGlmIChwYXRoLmlzRnVuY3Rpb24oKSkge1xuICAgIGluc2VydEludG9GdW5jdGlvbihwYXRoLCBzdGF0ZW1lbnRzKTtcbiAgfSBlbHNlIGlmIChwYXRoLmlzUHJvZ3JhbSgpKSB7XG4gICAgaW5zZXJ0SW50b1Byb2dyYW0ocGF0aCwgc3RhdGVtZW50cyk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbnNlcnQgdGhlIGBzdGF0ZW1lbnRzYCBhdCB0aGUgdG9wIG9mIHRoZSBib2R5IG9mIHRoZSBgZm5gIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBpbnNlcnRJbnRvRnVuY3Rpb24oZm46IE5vZGVQYXRoPHQuRnVuY3Rpb24+LCBzdGF0ZW1lbnRzOiB0LlN0YXRlbWVudFtdKTogdm9pZCB7XG4gIGNvbnN0IGJvZHkgPSBmbi5nZXQoJ2JvZHknKTtcbiAgYm9keS51bnNoaWZ0Q29udGFpbmVyKCdib2R5Jywgc3RhdGVtZW50cyk7XG59XG5cbi8qKlxuICogSW5zZXJ0IHRoZSBgc3RhdGVtZW50c2AgYXQgdGhlIHRvcCBvZiB0aGUgYHByb2dyYW1gLCBiZWxvdyBhbnkgaW1wb3J0IHN0YXRlbWVudHMuXG4gKi9cbmZ1bmN0aW9uIGluc2VydEludG9Qcm9ncmFtKHByb2dyYW06IE5vZGVQYXRoPHQuUHJvZ3JhbT4sIHN0YXRlbWVudHM6IHQuU3RhdGVtZW50W10pOiB2b2lkIHtcbiAgY29uc3QgYm9keSA9IHByb2dyYW0uZ2V0KCdib2R5Jyk7XG4gIGNvbnN0IGltcG9ydFN0YXRlbWVudHMgPSBib2R5LmZpbHRlcihzdGF0ZW1lbnQgPT4gc3RhdGVtZW50LmlzSW1wb3J0RGVjbGFyYXRpb24oKSk7XG4gIGlmIChpbXBvcnRTdGF0ZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHByb2dyYW0udW5zaGlmdENvbnRhaW5lcignYm9keScsIHN0YXRlbWVudHMpO1xuICB9IGVsc2Uge1xuICAgIGltcG9ydFN0YXRlbWVudHNbaW1wb3J0U3RhdGVtZW50cy5sZW5ndGggLSAxXS5pbnNlcnRBZnRlcihzdGF0ZW1lbnRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRDYWxsZWVOYW1lKGNhbGw6IE5vZGVQYXRoPHQuQ2FsbEV4cHJlc3Npb24+KTogc3RyaW5nfG51bGwge1xuICBjb25zdCBjYWxsZWUgPSBjYWxsLm5vZGUuY2FsbGVlO1xuICBpZiAodC5pc0lkZW50aWZpZXIoY2FsbGVlKSkge1xuICAgIHJldHVybiBjYWxsZWUubmFtZTtcbiAgfSBlbHNlIGlmICh0LmlzTWVtYmVyRXhwcmVzc2lvbihjYWxsZWUpICYmIHQuaXNJZGVudGlmaWVyKGNhbGxlZS5wcm9wZXJ0eSkpIHtcbiAgICByZXR1cm4gY2FsbGVlLnByb3BlcnR5Lm5hbWU7XG4gIH0gZWxzZSBpZiAodC5pc01lbWJlckV4cHJlc3Npb24oY2FsbGVlKSAmJiB0LmlzU3RyaW5nTGl0ZXJhbChjYWxsZWUucHJvcGVydHkpKSB7XG4gICAgcmV0dXJuIGNhbGxlZS5wcm9wZXJ0eS52YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIGFsbCB0aGUgYG5vZGVzYCBhcmUgQmFiZWwgZXhwcmVzc2lvbnMuXG4gKi9cbmZ1bmN0aW9uIGlzRXhwcmVzc2lvbkFycmF5KG5vZGVzOiB0Lk5vZGVbXSk6IG5vZGVzIGlzIHQuRXhwcmVzc2lvbltdIHtcbiAgcmV0dXJuIG5vZGVzLmV2ZXJ5KG5vZGUgPT4gdC5pc0V4cHJlc3Npb24obm9kZSkpO1xufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSBnaXZlbiBgb2JqYCBpcyBgbnVsbGAuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydE51bGw8VD4ob2JqOiBUfG51bGwpOiBhc3NlcnRzIG9iaiBpcyBudWxsIHtcbiAgaWYgKG9iaiAhPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQlVHIC0gZXhwZWN0ZWQgYG9iamAgdG8gYmUgbnVsbCcpO1xuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgdGhlIGdpdmVuIGBvYmpgIGlzIG5vdCBgbnVsbGAuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydE5vdE51bGw8VD4ob2JqOiBUfG51bGwpOiBhc3NlcnRzIG9iaiBpcyBUIHtcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQlVHIC0gZXhwZWN0ZWQgYG9iamAgbm90IHRvIGJlIG51bGwnKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBlcnJvciB0aGF0IGluY2x1ZGVzIHRoZSBjb2RlIGZyYW1lIG9mIHRoZSBgbm9kZWAuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkQ29kZUZyYW1lRXJyb3IoZmlsZTogQmFiZWxGaWxlLCBtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IHQuTm9kZSk6IHN0cmluZyB7XG4gIGNvbnN0IGZpbGVuYW1lID0gZmlsZS5vcHRzLmZpbGVuYW1lIHx8ICcodW5rbm93biBmaWxlKSc7XG4gIGNvbnN0IGVycm9yID0gZmlsZS5idWlsZENvZGVGcmFtZUVycm9yKG5vZGUsIG1lc3NhZ2UpO1xuICByZXR1cm4gYCR7ZmlsZW5hbWV9OiAke2Vycm9yLm1lc3NhZ2V9YDtcbn1cblxuLyoqXG4gKiBUaGlzIGludGVyZmFjZSBpcyBtYWtpbmcgdXAgZm9yIHRoZSBmYWN0IHRoYXQgdGhlIEJhYmVsIHR5cGluZ3MgZm9yIGBOb2RlUGF0aC5odWIuZmlsZWAgYXJlXG4gKiBsYWNraW5nLlxuICovXG5pbnRlcmZhY2UgQmFiZWxGaWxlIHtcbiAgY29kZTogc3RyaW5nO1xuICBvcHRzOiB7XG4gICAgZmlsZW5hbWU/OiBzdHJpbmcsXG4gICAgZmlsZW5hbWVSZWxhdGl2ZT86IHN0cmluZyxcbiAgICBjd2Q/OiBzdHJpbmcsXG4gIH07XG5cbiAgYnVpbGRDb2RlRnJhbWVFcnJvcihub2RlOiB0Lk5vZGUsIG1lc3NhZ2U6IHN0cmluZyk6IEVycm9yO1xufVxuIl19