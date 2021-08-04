/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ImplicitReceiver, RecursiveAstVisitor } from '@angular/compiler';
import { NullVisitor, visitAll } from '@angular/compiler/src/render3/r3_ast';
/**
 * HTML AST visitor that traverses the Render3 HTML AST in order to find all
 * expressions that write to local template variables within bound events.
 */
export class HtmlVariableAssignmentVisitor extends NullVisitor {
    constructor() {
        super(...arguments);
        this.variableAssignments = [];
        this.currentVariables = [];
        this.expressionAstVisitor = new ExpressionAstVisitor(this.variableAssignments, this.currentVariables);
    }
    visitElement(element) {
        visitAll(this, element.outputs);
        visitAll(this, element.children);
    }
    visitTemplate(template) {
        // Keep track of the template variables which can be accessed by the template
        // child nodes through the implicit receiver.
        this.currentVariables.push(...template.variables);
        // Visit all children of the template. The template proxies the outputs of the
        // immediate child elements, so we just ignore outputs on the "Template" in order
        // to not visit similar bound events twice.
        visitAll(this, template.children);
        // Remove all previously added variables since all children that could access
        // these have been visited already.
        template.variables.forEach(v => {
            const variableIdx = this.currentVariables.indexOf(v);
            if (variableIdx !== -1) {
                this.currentVariables.splice(variableIdx, 1);
            }
        });
    }
    visitBoundEvent(node) {
        node.handler.visit(this.expressionAstVisitor, node.handlerSpan);
    }
}
/** AST visitor that resolves all variable assignments within a given expression AST. */
class ExpressionAstVisitor extends RecursiveAstVisitor {
    constructor(variableAssignments, currentVariables) {
        super();
        this.variableAssignments = variableAssignments;
        this.currentVariables = currentVariables;
    }
    visitPropertyWrite(node, span) {
        if (node.receiver instanceof ImplicitReceiver &&
            this.currentVariables.some(v => v.name === node.name)) {
            this.variableAssignments.push({
                node: node,
                start: span.start.offset,
                end: span.end.offset,
            });
        }
        super.visitPropertyWrite(node, span);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbF92YXJpYWJsZV9hc3NpZ25tZW50X3Zpc2l0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NjaGVtYXRpY3MvbWlncmF0aW9ucy90ZW1wbGF0ZS12YXItYXNzaWdubWVudC9hbmd1bGFyL2h0bWxfdmFyaWFibGVfYXNzaWdubWVudF92aXNpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxnQkFBZ0IsRUFBa0MsbUJBQW1CLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUN4RyxPQUFPLEVBQXNCLFdBQVcsRUFBc0IsUUFBUSxFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFRcEg7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLDZCQUE4QixTQUFRLFdBQVc7SUFBOUQ7O1FBQ0Usd0JBQW1CLEdBQWlDLEVBQUUsQ0FBQztRQUUvQyxxQkFBZ0IsR0FBZSxFQUFFLENBQUM7UUFDbEMseUJBQW9CLEdBQ3hCLElBQUksb0JBQW9CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBK0JoRixDQUFDO0lBN0JDLFlBQVksQ0FBQyxPQUFnQjtRQUMzQixRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNoQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsYUFBYSxDQUFDLFFBQWtCO1FBQzlCLDZFQUE2RTtRQUM3RSw2Q0FBNkM7UUFDN0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVsRCw4RUFBOEU7UUFDOUUsaUZBQWlGO1FBQ2pGLDJDQUEyQztRQUMzQyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVsQyw2RUFBNkU7UUFDN0UsbUNBQW1DO1FBQ25DLFFBQVEsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzdCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFckQsSUFBSSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ3RCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQzlDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsZUFBZSxDQUFDLElBQWdCO1FBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbEUsQ0FBQztDQUNGO0FBRUQsd0ZBQXdGO0FBQ3hGLE1BQU0sb0JBQXFCLFNBQVEsbUJBQW1CO0lBQ3BELFlBQ1ksbUJBQWlELEVBQ2pELGdCQUE0QjtRQUN0QyxLQUFLLEVBQUUsQ0FBQztRQUZFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBOEI7UUFDakQscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFZO0lBRXhDLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxJQUFtQixFQUFFLElBQXFCO1FBQzNELElBQUksSUFBSSxDQUFDLFFBQVEsWUFBWSxnQkFBZ0I7WUFDekMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUM7Z0JBQzVCLElBQUksRUFBRSxJQUFJO2dCQUNWLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07Z0JBQ3hCLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU07YUFDckIsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxLQUFLLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0ltcGxpY2l0UmVjZWl2ZXIsIFBhcnNlU291cmNlU3BhbiwgUHJvcGVydHlXcml0ZSwgUmVjdXJzaXZlQXN0VmlzaXRvcn0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtCb3VuZEV2ZW50LCBFbGVtZW50LCBOdWxsVmlzaXRvciwgVGVtcGxhdGUsIFZhcmlhYmxlLCB2aXNpdEFsbH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfYXN0JztcblxuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZVZhcmlhYmxlQXNzaWdubWVudCB7XG4gIHN0YXJ0OiBudW1iZXI7XG4gIGVuZDogbnVtYmVyO1xuICBub2RlOiBQcm9wZXJ0eVdyaXRlO1xufVxuXG4vKipcbiAqIEhUTUwgQVNUIHZpc2l0b3IgdGhhdCB0cmF2ZXJzZXMgdGhlIFJlbmRlcjMgSFRNTCBBU1QgaW4gb3JkZXIgdG8gZmluZCBhbGxcbiAqIGV4cHJlc3Npb25zIHRoYXQgd3JpdGUgdG8gbG9jYWwgdGVtcGxhdGUgdmFyaWFibGVzIHdpdGhpbiBib3VuZCBldmVudHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBIdG1sVmFyaWFibGVBc3NpZ25tZW50VmlzaXRvciBleHRlbmRzIE51bGxWaXNpdG9yIHtcbiAgdmFyaWFibGVBc3NpZ25tZW50czogVGVtcGxhdGVWYXJpYWJsZUFzc2lnbm1lbnRbXSA9IFtdO1xuXG4gIHByaXZhdGUgY3VycmVudFZhcmlhYmxlczogVmFyaWFibGVbXSA9IFtdO1xuICBwcml2YXRlIGV4cHJlc3Npb25Bc3RWaXNpdG9yID1cbiAgICAgIG5ldyBFeHByZXNzaW9uQXN0VmlzaXRvcih0aGlzLnZhcmlhYmxlQXNzaWdubWVudHMsIHRoaXMuY3VycmVudFZhcmlhYmxlcyk7XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcbiAgICB2aXNpdEFsbCh0aGlzLCBlbGVtZW50Lm91dHB1dHMpO1xuICAgIHZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvLyBLZWVwIHRyYWNrIG9mIHRoZSB0ZW1wbGF0ZSB2YXJpYWJsZXMgd2hpY2ggY2FuIGJlIGFjY2Vzc2VkIGJ5IHRoZSB0ZW1wbGF0ZVxuICAgIC8vIGNoaWxkIG5vZGVzIHRocm91Z2ggdGhlIGltcGxpY2l0IHJlY2VpdmVyLlxuICAgIHRoaXMuY3VycmVudFZhcmlhYmxlcy5wdXNoKC4uLnRlbXBsYXRlLnZhcmlhYmxlcyk7XG5cbiAgICAvLyBWaXNpdCBhbGwgY2hpbGRyZW4gb2YgdGhlIHRlbXBsYXRlLiBUaGUgdGVtcGxhdGUgcHJveGllcyB0aGUgb3V0cHV0cyBvZiB0aGVcbiAgICAvLyBpbW1lZGlhdGUgY2hpbGQgZWxlbWVudHMsIHNvIHdlIGp1c3QgaWdub3JlIG91dHB1dHMgb24gdGhlIFwiVGVtcGxhdGVcIiBpbiBvcmRlclxuICAgIC8vIHRvIG5vdCB2aXNpdCBzaW1pbGFyIGJvdW5kIGV2ZW50cyB0d2ljZS5cbiAgICB2aXNpdEFsbCh0aGlzLCB0ZW1wbGF0ZS5jaGlsZHJlbik7XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByZXZpb3VzbHkgYWRkZWQgdmFyaWFibGVzIHNpbmNlIGFsbCBjaGlsZHJlbiB0aGF0IGNvdWxkIGFjY2Vzc1xuICAgIC8vIHRoZXNlIGhhdmUgYmVlbiB2aXNpdGVkIGFscmVhZHkuXG4gICAgdGVtcGxhdGUudmFyaWFibGVzLmZvckVhY2godiA9PiB7XG4gICAgICBjb25zdCB2YXJpYWJsZUlkeCA9IHRoaXMuY3VycmVudFZhcmlhYmxlcy5pbmRleE9mKHYpO1xuXG4gICAgICBpZiAodmFyaWFibGVJZHggIT09IC0xKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFZhcmlhYmxlcy5zcGxpY2UodmFyaWFibGVJZHgsIDEpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRCb3VuZEV2ZW50KG5vZGU6IEJvdW5kRXZlbnQpIHtcbiAgICBub2RlLmhhbmRsZXIudmlzaXQodGhpcy5leHByZXNzaW9uQXN0VmlzaXRvciwgbm9kZS5oYW5kbGVyU3Bhbik7XG4gIH1cbn1cblxuLyoqIEFTVCB2aXNpdG9yIHRoYXQgcmVzb2x2ZXMgYWxsIHZhcmlhYmxlIGFzc2lnbm1lbnRzIHdpdGhpbiBhIGdpdmVuIGV4cHJlc3Npb24gQVNULiAqL1xuY2xhc3MgRXhwcmVzc2lvbkFzdFZpc2l0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHZhcmlhYmxlQXNzaWdubWVudHM6IFRlbXBsYXRlVmFyaWFibGVBc3NpZ25tZW50W10sXG4gICAgICBwcml2YXRlIGN1cnJlbnRWYXJpYWJsZXM6IFZhcmlhYmxlW10pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKG5vZGU6IFByb3BlcnR5V3JpdGUsIHNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGlmIChub2RlLnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlciAmJlxuICAgICAgICB0aGlzLmN1cnJlbnRWYXJpYWJsZXMuc29tZSh2ID0+IHYubmFtZSA9PT0gbm9kZS5uYW1lKSkge1xuICAgICAgdGhpcy52YXJpYWJsZUFzc2lnbm1lbnRzLnB1c2goe1xuICAgICAgICBub2RlOiBub2RlLFxuICAgICAgICBzdGFydDogc3Bhbi5zdGFydC5vZmZzZXQsXG4gICAgICAgIGVuZDogc3Bhbi5lbmQub2Zmc2V0LFxuICAgICAgfSk7XG4gICAgfVxuICAgIHN1cGVyLnZpc2l0UHJvcGVydHlXcml0ZShub2RlLCBzcGFuKTtcbiAgfVxufVxuIl19