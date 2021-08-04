/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { hasNameIdentifier } from '../utils';
/**
 * This is a place for DecoratorHandlers to register references that they
 * find in their analysis of the code.
 *
 * This registry is used to ensure that these references are publicly exported
 * from libraries that are compiled by ngcc.
 */
export class NgccReferencesRegistry {
    constructor(host) {
        this.host = host;
        this.map = new Map();
    }
    /**
     * Register one or more references in the registry.
     * Only `ResolveReference` references are stored. Other types are ignored.
     * @param references A collection of references to register.
     */
    add(source, ...references) {
        references.forEach(ref => {
            // Only store relative references. We are not interested in literals.
            if (ref.bestGuessOwningModule === null && hasNameIdentifier(ref.node)) {
                const declaration = this.host.getDeclarationOfIdentifier(ref.node.name);
                if (declaration && hasNameIdentifier(declaration.node)) {
                    this.map.set(declaration.node.name, declaration);
                }
            }
        });
    }
    /**
     * Create and return a mapping for the registered resolved references.
     * @returns A map of reference identifiers to reference declarations.
     */
    getDeclarationMap() {
        return this.map;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdjY19yZWZlcmVuY2VzX3JlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL25nY2Mvc3JjL2FuYWx5c2lzL25nY2NfcmVmZXJlbmNlc19yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFNSCxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFFM0M7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLHNCQUFzQjtJQUdqQyxZQUFvQixJQUFvQjtRQUFwQixTQUFJLEdBQUosSUFBSSxDQUFnQjtRQUZoQyxRQUFHLEdBQUcsSUFBSSxHQUFHLEVBQThCLENBQUM7SUFFVCxDQUFDO0lBRTVDOzs7O09BSUc7SUFDSCxHQUFHLENBQUMsTUFBdUIsRUFBRSxHQUFHLFVBQXdDO1FBQ3RFLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDdkIscUVBQXFFO1lBQ3JFLElBQUksR0FBRyxDQUFDLHFCQUFxQixLQUFLLElBQUksSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3JFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDeEUsSUFBSSxXQUFXLElBQUksaUJBQWlCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN0RCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztpQkFDbEQ7YUFDRjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILGlCQUFpQjtRQUNmLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNsQixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge1JlZmVyZW5jZXNSZWdpc3RyeX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2Fubm90YXRpb25zJztcbmltcG9ydCB7UmVmZXJlbmNlfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvaW1wb3J0cyc7XG5pbXBvcnQge0RlY2xhcmF0aW9uLCBEZWNsYXJhdGlvbk5vZGUsIFJlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvcmVmbGVjdGlvbic7XG5pbXBvcnQge2hhc05hbWVJZGVudGlmaWVyfSBmcm9tICcuLi91dGlscyc7XG5cbi8qKlxuICogVGhpcyBpcyBhIHBsYWNlIGZvciBEZWNvcmF0b3JIYW5kbGVycyB0byByZWdpc3RlciByZWZlcmVuY2VzIHRoYXQgdGhleVxuICogZmluZCBpbiB0aGVpciBhbmFseXNpcyBvZiB0aGUgY29kZS5cbiAqXG4gKiBUaGlzIHJlZ2lzdHJ5IGlzIHVzZWQgdG8gZW5zdXJlIHRoYXQgdGhlc2UgcmVmZXJlbmNlcyBhcmUgcHVibGljbHkgZXhwb3J0ZWRcbiAqIGZyb20gbGlicmFyaWVzIHRoYXQgYXJlIGNvbXBpbGVkIGJ5IG5nY2MuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ2NjUmVmZXJlbmNlc1JlZ2lzdHJ5IGltcGxlbWVudHMgUmVmZXJlbmNlc1JlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHRzLklkZW50aWZpZXIsIERlY2xhcmF0aW9uPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaG9zdDogUmVmbGVjdGlvbkhvc3QpIHt9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIG9uZSBvciBtb3JlIHJlZmVyZW5jZXMgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgKiBPbmx5IGBSZXNvbHZlUmVmZXJlbmNlYCByZWZlcmVuY2VzIGFyZSBzdG9yZWQuIE90aGVyIHR5cGVzIGFyZSBpZ25vcmVkLlxuICAgKiBAcGFyYW0gcmVmZXJlbmNlcyBBIGNvbGxlY3Rpb24gb2YgcmVmZXJlbmNlcyB0byByZWdpc3Rlci5cbiAgICovXG4gIGFkZChzb3VyY2U6IERlY2xhcmF0aW9uTm9kZSwgLi4ucmVmZXJlbmNlczogUmVmZXJlbmNlPERlY2xhcmF0aW9uTm9kZT5bXSk6IHZvaWQge1xuICAgIHJlZmVyZW5jZXMuZm9yRWFjaChyZWYgPT4ge1xuICAgICAgLy8gT25seSBzdG9yZSByZWxhdGl2ZSByZWZlcmVuY2VzLiBXZSBhcmUgbm90IGludGVyZXN0ZWQgaW4gbGl0ZXJhbHMuXG4gICAgICBpZiAocmVmLmJlc3RHdWVzc093bmluZ01vZHVsZSA9PT0gbnVsbCAmJiBoYXNOYW1lSWRlbnRpZmllcihyZWYubm9kZSkpIHtcbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb24gPSB0aGlzLmhvc3QuZ2V0RGVjbGFyYXRpb25PZklkZW50aWZpZXIocmVmLm5vZGUubmFtZSk7XG4gICAgICAgIGlmIChkZWNsYXJhdGlvbiAmJiBoYXNOYW1lSWRlbnRpZmllcihkZWNsYXJhdGlvbi5ub2RlKSkge1xuICAgICAgICAgIHRoaXMubWFwLnNldChkZWNsYXJhdGlvbi5ub2RlLm5hbWUsIGRlY2xhcmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbmQgcmV0dXJuIGEgbWFwcGluZyBmb3IgdGhlIHJlZ2lzdGVyZWQgcmVzb2x2ZWQgcmVmZXJlbmNlcy5cbiAgICogQHJldHVybnMgQSBtYXAgb2YgcmVmZXJlbmNlIGlkZW50aWZpZXJzIHRvIHJlZmVyZW5jZSBkZWNsYXJhdGlvbnMuXG4gICAqL1xuICBnZXREZWNsYXJhdGlvbk1hcCgpOiBNYXA8dHMuSWRlbnRpZmllciwgRGVjbGFyYXRpb24+IHtcbiAgICByZXR1cm4gdGhpcy5tYXA7XG4gIH1cbn1cbiJdfQ==