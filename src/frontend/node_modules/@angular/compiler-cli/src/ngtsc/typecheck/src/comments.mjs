/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AbsoluteSourceSpan } from '@angular/compiler';
import * as ts from 'typescript';
const parseSpanComment = /^(\d+),(\d+)$/;
/**
 * Reads the trailing comments and finds the first match which is a span comment (i.e. 4,10) on a
 * node and returns it as an `AbsoluteSourceSpan`.
 *
 * Will return `null` if no trailing comments on the node match the expected form of a source span.
 */
export function readSpanComment(node, sourceFile = node.getSourceFile()) {
    return ts.forEachTrailingCommentRange(sourceFile.text, node.getEnd(), (pos, end, kind) => {
        if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
            return null;
        }
        const commentText = sourceFile.text.substring(pos + 2, end - 2);
        const match = commentText.match(parseSpanComment);
        if (match === null) {
            return null;
        }
        return new AbsoluteSourceSpan(+match[1], +match[2]);
    }) || null;
}
/** Used to identify what type the comment is. */
export var CommentTriviaType;
(function (CommentTriviaType) {
    CommentTriviaType["DIAGNOSTIC"] = "D";
    CommentTriviaType["EXPRESSION_TYPE_IDENTIFIER"] = "T";
})(CommentTriviaType || (CommentTriviaType = {}));
/** Identifies what the TCB expression is for (for example, a directive declaration). */
export var ExpressionIdentifier;
(function (ExpressionIdentifier) {
    ExpressionIdentifier["DIRECTIVE"] = "DIR";
    ExpressionIdentifier["COMPONENT_COMPLETION"] = "COMPCOMP";
    ExpressionIdentifier["EVENT_PARAMETER"] = "EP";
})(ExpressionIdentifier || (ExpressionIdentifier = {}));
/** Tags the node with the given expression identifier. */
export function addExpressionIdentifier(node, identifier) {
    ts.addSyntheticTrailingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, `${CommentTriviaType.EXPRESSION_TYPE_IDENTIFIER}:${identifier}`, 
    /* hasTrailingNewLine */ false);
}
const IGNORE_FOR_DIAGNOSTICS_MARKER = `${CommentTriviaType.DIAGNOSTIC}:ignore`;
/**
 * Tag the `ts.Node` with an indication that any errors arising from the evaluation of the node
 * should be ignored.
 */
export function markIgnoreDiagnostics(node) {
    ts.addSyntheticTrailingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, IGNORE_FOR_DIAGNOSTICS_MARKER, 
    /* hasTrailingNewLine */ false);
}
/** Returns true if the node has a marker that indicates diagnostics errors should be ignored.  */
export function hasIgnoreForDiagnosticsMarker(node, sourceFile) {
    return ts.forEachTrailingCommentRange(sourceFile.text, node.getEnd(), (pos, end, kind) => {
        if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
            return null;
        }
        const commentText = sourceFile.text.substring(pos + 2, end - 2);
        return commentText === IGNORE_FOR_DIAGNOSTICS_MARKER;
    }) === true;
}
function makeRecursiveVisitor(visitor) {
    function recursiveVisitor(node) {
        const res = visitor(node);
        return res !== null ? res : node.forEachChild(recursiveVisitor);
    }
    return recursiveVisitor;
}
function getSpanFromOptions(opts) {
    let withSpan = null;
    if (opts.withSpan !== undefined) {
        if (opts.withSpan instanceof AbsoluteSourceSpan) {
            withSpan = opts.withSpan;
        }
        else {
            withSpan = { start: opts.withSpan.start.offset, end: opts.withSpan.end.offset };
        }
    }
    return withSpan;
}
/**
 * Given a `ts.Node` with finds the first node whose matching the criteria specified
 * by the `FindOptions`.
 *
 * Returns `null` when no `ts.Node` matches the given conditions.
 */
export function findFirstMatchingNode(tcb, opts) {
    var _a;
    const withSpan = getSpanFromOptions(opts);
    const withExpressionIdentifier = opts.withExpressionIdentifier;
    const sf = tcb.getSourceFile();
    const visitor = makeRecursiveVisitor(node => {
        if (!opts.filter(node)) {
            return null;
        }
        if (withSpan !== null) {
            const comment = readSpanComment(node, sf);
            if (comment === null || withSpan.start !== comment.start || withSpan.end !== comment.end) {
                return null;
            }
        }
        if (withExpressionIdentifier !== undefined &&
            !hasExpressionIdentifier(sf, node, withExpressionIdentifier)) {
            return null;
        }
        return node;
    });
    return (_a = tcb.forEachChild(visitor)) !== null && _a !== void 0 ? _a : null;
}
/**
 * Given a `ts.Node` with source span comments, finds the first node whose source span comment
 * matches the given `sourceSpan`. Additionally, the `filter` function allows matching only
 * `ts.Nodes` of a given type, which provides the ability to select only matches of a given type
 * when there may be more than one.
 *
 * Returns `null` when no `ts.Node` matches the given conditions.
 */
export function findAllMatchingNodes(tcb, opts) {
    const withSpan = getSpanFromOptions(opts);
    const withExpressionIdentifier = opts.withExpressionIdentifier;
    const results = [];
    const stack = [tcb];
    const sf = tcb.getSourceFile();
    while (stack.length > 0) {
        const node = stack.pop();
        if (!opts.filter(node)) {
            stack.push(...node.getChildren());
            continue;
        }
        if (withSpan !== null) {
            const comment = readSpanComment(node, sf);
            if (comment === null || withSpan.start !== comment.start || withSpan.end !== comment.end) {
                stack.push(...node.getChildren());
                continue;
            }
        }
        if (withExpressionIdentifier !== undefined &&
            !hasExpressionIdentifier(sf, node, withExpressionIdentifier)) {
            continue;
        }
        results.push(node);
    }
    return results;
}
export function hasExpressionIdentifier(sourceFile, node, identifier) {
    return ts.forEachTrailingCommentRange(sourceFile.text, node.getEnd(), (pos, end, kind) => {
        if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
            return false;
        }
        const commentText = sourceFile.text.substring(pos + 2, end - 2);
        return commentText === `${CommentTriviaType.EXPRESSION_TYPE_IDENTIFIER}:${identifier}`;
    }) || false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3R5cGVjaGVjay9zcmMvY29tbWVudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGtCQUFrQixFQUFrQixNQUFNLG1CQUFtQixDQUFDO0FBQ3RFLE9BQU8sS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWpDLE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxDQUFDO0FBRXpDOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FDM0IsSUFBYSxFQUFFLGFBQTRCLElBQUksQ0FBQyxhQUFhLEVBQUU7SUFDakUsT0FBTyxFQUFFLENBQUMsMkJBQTJCLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFO1FBQ3ZGLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLEVBQUU7WUFDakQsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNsRCxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFDbEIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RELENBQUMsQ0FBQyxJQUFJLElB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QUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFO1FBQ3ZGLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLEVBQUU7WUFDakQsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUNELE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE9BQU8sV0FBVyxLQUFLLEdBQUcsaUJBQWlCLENBQUMsMEJBQTBCLElBQUksVUFBVSxFQUFFLENBQUM7SUFDekYsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0Fic29sdXRlU291cmNlU3BhbiwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuY29uc3QgcGFyc2VTcGFuQ29tbWVudCA9IC9eKFxcZCspLChcXGQrKSQvO1xuXG4vKipcbiAqIFJlYWRzIHRoZSB0cmFpbGluZyBjb21tZW50cyBhbmQgZmluZHMgdGhlIGZpcnN0IG1hdGNoIHdoaWNoIGlzIGEgc3BhbiBjb21tZW50IChpLmUuIDQsMTApIG9uIGFcbiAqIG5vZGUgYW5kIHJldHVybnMgaXQgYXMgYW4gYEFic29sdXRlU291cmNlU3BhbmAuXG4gKlxuICogV2lsbCByZXR1cm4gYG51bGxgIGlmIG5vIHRyYWlsaW5nIGNvbW1lbnRzIG9uIHRoZSBub2RlIG1hdGNoIHRoZSBleHBlY3RlZCBmb3JtIG9mIGEgc291cmNlIHNwYW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkU3BhbkNvbW1lbnQoXG4gICAgbm9kZTogdHMuTm9kZSwgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSA9IG5vZGUuZ2V0U291cmNlRmlsZSgpKTogQWJzb2x1dGVTb3VyY2VTcGFufG51bGwge1xuICByZXR1cm4gdHMuZm9yRWFjaFRyYWlsaW5nQ29tbWVudFJhbmdlKHNvdXJjZUZpbGUudGV4dCwgbm9kZS5nZXRFbmQoKSwgKHBvcywgZW5kLCBraW5kKSA9PiB7XG4gICAgaWYgKGtpbmQgIT09IHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNvbW1lbnRUZXh0ID0gc291cmNlRmlsZS50ZXh0LnN1YnN0cmluZyhwb3MgKyAyLCBlbmQgLSAyKTtcbiAgICBjb25zdCBtYXRjaCA9IGNvbW1lbnRUZXh0Lm1hdGNoKHBhcnNlU3BhbkNvbW1lbnQpO1xuICAgIGlmIChtYXRjaCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oK21hdGNoWzFdLCArbWF0Y2hbMl0pO1xuICB9KSB8fCBudWxsO1xufVxuXG4vKiogVXNlZCB0byBpZGVudGlmeSB3aGF0IHR5cGUgdGhlIGNvbW1lbnQgaXMuICovXG5leHBvcnQgZW51bSBDb21tZW50VHJpdmlhVHlwZSB7XG4gIERJQUdOT1NUSUMgPSAnRCcsXG4gIEVYUFJFU1NJT05fVFlQRV9JREVOVElGSUVSID0gJ1QnLFxufVxuXG4vKiogSWRlbnRpZmllcyB3aGF0IHRoZSBUQ0IgZXhwcmVzc2lvbiBpcyBmb3IgKGZvciBleGFtcGxlLCBhIGRpcmVjdGl2ZSBkZWNsYXJhdGlvbikuICovXG5leHBvcnQgZW51bSBFeHByZXNzaW9uSWRlbnRpZmllciB7XG4gIERJUkVDVElWRSA9ICdESVInLFxuICBDT01QT05FTlRfQ09NUExFVElPTiA9ICdDT01QQ09NUCcsXG4gIEVWRU5UX1BBUkFNRVRFUiA9ICdFUCcsXG59XG5cbi8qKiBUYWdzIHRoZSBub2RlIHdpdGggdGhlIGdpdmVuIGV4cHJlc3Npb24gaWRlbnRpZmllci4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRFeHByZXNzaW9uSWRlbnRpZmllcihub2RlOiB0cy5Ob2RlLCBpZGVudGlmaWVyOiBFeHByZXNzaW9uSWRlbnRpZmllcikge1xuICB0cy5hZGRTeW50aGV0aWNUcmFpbGluZ0NvbW1lbnQoXG4gICAgICBub2RlLCB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsXG4gICAgICBgJHtDb21tZW50VHJpdmlhVHlwZS5FWFBSRVNTSU9OX1RZUEVfSURFTlRJRklFUn06JHtpZGVudGlmaWVyfWAsXG4gICAgICAvKiBoYXNUcmFpbGluZ05ld0xpbmUgKi8gZmFsc2UpO1xufVxuXG5jb25zdCBJR05PUkVfRk9SX0RJQUdOT1NUSUNTX01BUktFUiA9IGAke0NvbW1lbnRUcml2aWFUeXBlLkRJQUdOT1NUSUN9Omlnbm9yZWA7XG5cbi8qKlxuICogVGFnIHRoZSBgdHMuTm9kZWAgd2l0aCBhbiBpbmRpY2F0aW9uIHRoYXQgYW55IGVycm9ycyBhcmlzaW5nIGZyb20gdGhlIGV2YWx1YXRpb24gb2YgdGhlIG5vZGVcbiAqIHNob3VsZCBiZSBpZ25vcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFya0lnbm9yZURpYWdub3N0aWNzKG5vZGU6IHRzLk5vZGUpOiB2b2lkIHtcbiAgdHMuYWRkU3ludGhldGljVHJhaWxpbmdDb21tZW50KFxuICAgICAgbm9kZSwgdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhLCBJR05PUkVfRk9SX0RJQUdOT1NUSUNTX01BUktFUixcbiAgICAgIC8qIGhhc1RyYWlsaW5nTmV3TGluZSAqLyBmYWxzZSk7XG59XG5cbi8qKiBSZXR1cm5zIHRydWUgaWYgdGhlIG5vZGUgaGFzIGEgbWFya2VyIHRoYXQgaW5kaWNhdGVzIGRpYWdub3N0aWNzIGVycm9ycyBzaG91bGQgYmUgaWdub3JlZC4gICovXG5leHBvcnQgZnVuY3Rpb24gaGFzSWdub3JlRm9yRGlhZ25vc3RpY3NNYXJrZXIobm9kZTogdHMuTm9kZSwgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHMuZm9yRWFjaFRyYWlsaW5nQ29tbWVudFJhbmdlKHNvdXJjZUZpbGUudGV4dCwgbm9kZS5nZXRFbmQoKSwgKHBvcywgZW5kLCBraW5kKSA9PiB7XG4gICAgaWYgKGtpbmQgIT09IHRzLlN5bnRheEtpbmQuTXVsdGlMaW5lQ29tbWVudFRyaXZpYSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNvbW1lbnRUZXh0ID0gc291cmNlRmlsZS50ZXh0LnN1YnN0cmluZyhwb3MgKyAyLCBlbmQgLSAyKTtcbiAgICByZXR1cm4gY29tbWVudFRleHQgPT09IElHTk9SRV9GT1JfRElBR05PU1RJQ1NfTUFSS0VSO1xuICB9KSA9PT0gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gbWFrZVJlY3Vyc2l2ZVZpc2l0b3I8VCBleHRlbmRzIHRzLk5vZGU+KHZpc2l0b3I6IChub2RlOiB0cy5Ob2RlKSA9PiBUIHwgbnVsbCk6XG4gICAgKG5vZGU6IHRzLk5vZGUpID0+IFQgfCB1bmRlZmluZWQge1xuICBmdW5jdGlvbiByZWN1cnNpdmVWaXNpdG9yKG5vZGU6IHRzLk5vZGUpOiBUfHVuZGVmaW5lZCB7XG4gICAgY29uc3QgcmVzID0gdmlzaXRvcihub2RlKTtcbiAgICByZXR1cm4gcmVzICE9PSBudWxsID8gcmVzIDogbm9kZS5mb3JFYWNoQ2hpbGQocmVjdXJzaXZlVmlzaXRvcik7XG4gIH1cbiAgcmV0dXJuIHJlY3Vyc2l2ZVZpc2l0b3I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmluZE9wdGlvbnM8VCBleHRlbmRzIHRzLk5vZGU+IHtcbiAgZmlsdGVyOiAobm9kZTogdHMuTm9kZSkgPT4gbm9kZSBpcyBUO1xuICB3aXRoRXhwcmVzc2lvbklkZW50aWZpZXI/OiBFeHByZXNzaW9uSWRlbnRpZmllcjtcbiAgd2l0aFNwYW4/OiBBYnNvbHV0ZVNvdXJjZVNwYW58UGFyc2VTb3VyY2VTcGFuO1xufVxuXG5mdW5jdGlvbiBnZXRTcGFuRnJvbU9wdGlvbnMob3B0czogRmluZE9wdGlvbnM8dHMuTm9kZT4pIHtcbiAgbGV0IHdpdGhTcGFuOiB7c3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXJ9fG51bGwgPSBudWxsO1xuICBpZiAob3B0cy53aXRoU3BhbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKG9wdHMud2l0aFNwYW4gaW5zdGFuY2VvZiBBYnNvbHV0ZVNvdXJjZVNwYW4pIHtcbiAgICAgIHdpdGhTcGFuID0gb3B0cy53aXRoU3BhbjtcbiAgICB9IGVsc2Uge1xuICAgICAgd2l0aFNwYW4gPSB7c3RhcnQ6IG9wdHMud2l0aFNwYW4uc3RhcnQub2Zmc2V0LCBlbmQ6IG9wdHMud2l0aFNwYW4uZW5kLm9mZnNldH07XG4gICAgfVxuICB9XG4gIHJldHVybiB3aXRoU3Bhbjtcbn1cblxuLyoqXG4gKiBHaXZlbiBhIGB0cy5Ob2RlYCB3aXRoIGZpbmRzIHRoZSBmaXJzdCBub2RlIHdob3NlIG1hdGNoaW5nIHRoZSBjcml0ZXJpYSBzcGVjaWZpZWRcbiAqIGJ5IHRoZSBgRmluZE9wdGlvbnNgLlxuICpcbiAqIFJldHVybnMgYG51bGxgIHdoZW4gbm8gYHRzLk5vZGVgIG1hdGNoZXMgdGhlIGdpdmVuIGNvbmRpdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5kRmlyc3RNYXRjaGluZ05vZGU8VCBleHRlbmRzIHRzLk5vZGU+KHRjYjogdHMuTm9kZSwgb3B0czogRmluZE9wdGlvbnM8VD4pOiBUfFxuICAgIG51bGwge1xuICBjb25zdCB3aXRoU3BhbiA9IGdldFNwYW5Gcm9tT3B0aW9ucyhvcHRzKTtcbiAgY29uc3Qgd2l0aEV4cHJlc3Npb25JZGVudGlmaWVyID0gb3B0cy53aXRoRXhwcmVzc2lvbklkZW50aWZpZXI7XG4gIGNvbnN0IHNmID0gdGNiLmdldFNvdXJjZUZpbGUoKTtcbiAgY29uc3QgdmlzaXRvciA9IG1ha2VSZWN1cnNpdmVWaXNpdG9yPFQ+KG5vZGUgPT4ge1xuICAgIGlmICghb3B0cy5maWx0ZXIobm9kZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAod2l0aFNwYW4gIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGNvbW1lbnQgPSByZWFkU3BhbkNvbW1lbnQobm9kZSwgc2YpO1xuICAgICAgaWYgKGNvbW1lbnQgPT09IG51bGwgfHwgd2l0aFNwYW4uc3RhcnQgIT09IGNvbW1lbnQuc3RhcnQgfHwgd2l0aFNwYW4uZW5kICE9PSBjb21tZW50LmVuZCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHdpdGhFeHByZXNzaW9uSWRlbnRpZmllciAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICFoYXNFeHByZXNzaW9uSWRlbnRpZmllcihzZiwgbm9kZSwgd2l0aEV4cHJlc3Npb25JZGVudGlmaWVyKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9KTtcbiAgcmV0dXJuIHRjYi5mb3JFYWNoQ2hpbGQodmlzaXRvcikgPz8gbnVsbDtcbn1cblxuLyoqXG4gKiBHaXZlbiBhIGB0cy5Ob2RlYCB3aXRoIHNvdXJjZSBzcGFuIGNvbW1lbnRzLCBmaW5kcyB0aGUgZmlyc3Qgbm9kZSB3aG9zZSBzb3VyY2Ugc3BhbiBjb21tZW50XG4gKiBtYXRjaGVzIHRoZSBnaXZlbiBgc291cmNlU3BhbmAuIEFkZGl0aW9uYWxseSwgdGhlIGBmaWx0ZXJgIGZ1bmN0aW9uIGFsbG93cyBtYXRjaGluZyBvbmx5XG4gKiBgdHMuTm9kZXNgIG9mIGEgZ2l2ZW4gdHlwZSwgd2hpY2ggcHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gc2VsZWN0IG9ubHkgbWF0Y2hlcyBvZiBhIGdpdmVuIHR5cGVcbiAqIHdoZW4gdGhlcmUgbWF5IGJlIG1vcmUgdGhhbiBvbmUuXG4gKlxuICogUmV0dXJucyBgbnVsbGAgd2hlbiBubyBgdHMuTm9kZWAgbWF0Y2hlcyB0aGUgZ2l2ZW4gY29uZGl0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRBbGxNYXRjaGluZ05vZGVzPFQgZXh0ZW5kcyB0cy5Ob2RlPih0Y2I6IHRzLk5vZGUsIG9wdHM6IEZpbmRPcHRpb25zPFQ+KTogVFtdIHtcbiAgY29uc3Qgd2l0aFNwYW4gPSBnZXRTcGFuRnJvbU9wdGlvbnMob3B0cyk7XG4gIGNvbnN0IHdpdGhFeHByZXNzaW9uSWRlbnRpZmllciA9IG9wdHMud2l0aEV4cHJlc3Npb25JZGVudGlmaWVyO1xuICBjb25zdCByZXN1bHRzOiBUW10gPSBbXTtcbiAgY29uc3Qgc3RhY2s6IHRzLk5vZGVbXSA9IFt0Y2JdO1xuICBjb25zdCBzZiA9IHRjYi5nZXRTb3VyY2VGaWxlKCk7XG5cbiAgd2hpbGUgKHN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBub2RlID0gc3RhY2sucG9wKCkhO1xuXG4gICAgaWYgKCFvcHRzLmZpbHRlcihub2RlKSkge1xuICAgICAgc3RhY2sucHVzaCguLi5ub2RlLmdldENoaWxkcmVuKCkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICh3aXRoU3BhbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgY29tbWVudCA9IHJlYWRTcGFuQ29tbWVudChub2RlLCBzZik7XG4gICAgICBpZiAoY29tbWVudCA9PT0gbnVsbCB8fCB3aXRoU3Bhbi5zdGFydCAhPT0gY29tbWVudC5zdGFydCB8fCB3aXRoU3Bhbi5lbmQgIT09IGNvbW1lbnQuZW5kKSB7XG4gICAgICAgIHN0YWNrLnB1c2goLi4ubm9kZS5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh3aXRoRXhwcmVzc2lvbklkZW50aWZpZXIgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhaGFzRXhwcmVzc2lvbklkZW50aWZpZXIoc2YsIG5vZGUsIHdpdGhFeHByZXNzaW9uSWRlbnRpZmllcikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHJlc3VsdHMucHVzaChub2RlKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHRzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzRXhwcmVzc2lvbklkZW50aWZpZXIoXG4gICAgc291cmNlRmlsZTogdHMuU291cmNlRmlsZSwgbm9kZTogdHMuTm9kZSwgaWRlbnRpZmllcjogRXhwcmVzc2lvbklkZW50aWZpZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHRzLmZvckVhY2hUcmFpbGluZ0NvbW1lbnRSYW5nZShzb3VyY2VGaWxlLnRleHQsIG5vZGUuZ2V0RW5kKCksIChwb3MsIGVuZCwga2luZCkgPT4ge1xuICAgIGlmIChraW5kICE9PSB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgY29tbWVudFRleHQgPSBzb3VyY2VGaWxlLnRleHQuc3Vic3RyaW5nKHBvcyArIDIsIGVuZCAtIDIpO1xuICAgIHJldHVybiBjb21tZW50VGV4dCA9PT0gYCR7Q29tbWVudFRyaXZpYVR5cGUuRVhQUkVTU0lPTl9UWVBFX0lERU5USUZJRVJ9OiR7aWRlbnRpZmllcn1gO1xuICB9KSB8fCBmYWxzZTtcbn1cbiJdfQ==