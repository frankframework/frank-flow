/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ObjectAssignBuiltinFn } from './builtin';
import { DynamicValue } from './dynamic';
import { KnownFn } from './result';
// Use the same implementation we use for `Object.assign()`. Semantically these functions are the
// same, so they can also share the same evaluation code.
export class AssignHelperFn extends ObjectAssignBuiltinFn {
}
// Used for both `__spread()` and `__spreadArrays()` TypeScript helper functions.
export class SpreadHelperFn extends KnownFn {
    evaluate(node, args) {
        const result = [];
        for (const arg of args) {
            if (arg instanceof DynamicValue) {
                result.push(DynamicValue.fromDynamicInput(node, arg));
            }
            else if (Array.isArray(arg)) {
                result.push(...arg);
            }
            else {
                result.push(arg);
            }
        }
        return result;
    }
}
// Used for `__spreadArray` TypeScript helper function.
export class SpreadArrayHelperFn extends KnownFn {
    evaluate(node, args) {
        if (args.length !== 2) {
            return DynamicValue.fromUnknown(node);
        }
        const [to, from] = args;
        if (to instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, to);
        }
        else if (from instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, from);
        }
        if (!Array.isArray(to)) {
            return DynamicValue.fromInvalidExpressionType(node, to);
        }
        else if (!Array.isArray(from)) {
            return DynamicValue.fromInvalidExpressionType(node, from);
        }
        return to.concat(from);
    }
}
// Used for `__read` TypeScript helper function.
export class ReadHelperFn extends KnownFn {
    evaluate(node, args) {
        if (args.length !== 1) {
            // The `__read` helper accepts a second argument `n` but that case is not supported.
            return DynamicValue.fromUnknown(node);
        }
        const [value] = args;
        if (value instanceof DynamicValue) {
            return DynamicValue.fromDynamicInput(node, value);
        }
        if (!Array.isArray(value)) {
            return DynamicValue.fromInvalidExpressionType(node, value);
        }
        return value;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHNfaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcGFydGlhbF9ldmFsdWF0b3Ivc3JjL3RzX2hlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ2hELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDdkMsT0FBTyxFQUFDLE9BQU8sRUFBb0MsTUFBTSxVQUFVLENBQUM7QUFHcEUsaUdBQWlHO0FBQ2pHLHlEQUF5RDtBQUN6RCxNQUFNLE9BQU8sY0FBZSxTQUFRLHFCQUFxQjtDQUFHO0FBRTVELGlGQUFpRjtBQUNqRixNQUFNLE9BQU8sY0FBZSxTQUFRLE9BQU87SUFDekMsUUFBUSxDQUFDLElBQWEsRUFBRSxJQUF3QjtRQUM5QyxNQUFNLE1BQU0sR0FBdUIsRUFBRSxDQUFDO1FBRXRDLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1lBQ3RCLElBQUksR0FBRyxZQUFZLFlBQVksRUFBRTtnQkFDL0IsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7YUFDdkQ7aUJBQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUM3QixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7YUFDckI7aUJBQU07Z0JBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNsQjtTQUNGO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBRUQsdURBQXVEO0FBQ3ZELE1BQU0sT0FBTyxtQkFBb0IsU0FBUSxPQUFPO0lBQzlDLFFBQVEsQ0FBQyxJQUFhLEVBQUUsSUFBd0I7UUFDOUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNyQixPQUFPLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkM7UUFFRCxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFJLEVBQUUsWUFBWSxZQUFZLEVBQUU7WUFDOUIsT0FBTyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ2hEO2FBQU0sSUFBSSxJQUFJLFlBQVksWUFBWSxFQUFFO1lBQ3ZDLE9BQU8sWUFBWSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNsRDtRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ3RCLE9BQU8sWUFBWSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUN6RDthQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQy9CLE9BQU8sWUFBWSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUMzRDtRQUVELE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUFFRCxnREFBZ0Q7QUFDaEQsTUFBTSxPQUFPLFlBQWEsU0FBUSxPQUFPO0lBQ3ZDLFFBQVEsQ0FBQyxJQUFhLEVBQUUsSUFBd0I7UUFDOUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNyQixvRkFBb0Y7WUFDcEYsT0FBTyxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3ZDO1FBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLEtBQUssWUFBWSxZQUFZLEVBQUU7WUFDakMsT0FBTyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ25EO1FBRUQsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDekIsT0FBTyxZQUFZLENBQUMseUJBQXlCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQzVEO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7T2JqZWN0QXNzaWduQnVpbHRpbkZufSBmcm9tICcuL2J1aWx0aW4nO1xuaW1wb3J0IHtEeW5hbWljVmFsdWV9IGZyb20gJy4vZHluYW1pYyc7XG5pbXBvcnQge0tub3duRm4sIFJlc29sdmVkVmFsdWUsIFJlc29sdmVkVmFsdWVBcnJheX0gZnJvbSAnLi9yZXN1bHQnO1xuXG5cbi8vIFVzZSB0aGUgc2FtZSBpbXBsZW1lbnRhdGlvbiB3ZSB1c2UgZm9yIGBPYmplY3QuYXNzaWduKClgLiBTZW1hbnRpY2FsbHkgdGhlc2UgZnVuY3Rpb25zIGFyZSB0aGVcbi8vIHNhbWUsIHNvIHRoZXkgY2FuIGFsc28gc2hhcmUgdGhlIHNhbWUgZXZhbHVhdGlvbiBjb2RlLlxuZXhwb3J0IGNsYXNzIEFzc2lnbkhlbHBlckZuIGV4dGVuZHMgT2JqZWN0QXNzaWduQnVpbHRpbkZuIHt9XG5cbi8vIFVzZWQgZm9yIGJvdGggYF9fc3ByZWFkKClgIGFuZCBgX19zcHJlYWRBcnJheXMoKWAgVHlwZVNjcmlwdCBoZWxwZXIgZnVuY3Rpb25zLlxuZXhwb3J0IGNsYXNzIFNwcmVhZEhlbHBlckZuIGV4dGVuZHMgS25vd25GbiB7XG4gIGV2YWx1YXRlKG5vZGU6IHRzLk5vZGUsIGFyZ3M6IFJlc29sdmVkVmFsdWVBcnJheSk6IFJlc29sdmVkVmFsdWVBcnJheSB7XG4gICAgY29uc3QgcmVzdWx0OiBSZXNvbHZlZFZhbHVlQXJyYXkgPSBbXTtcblxuICAgIGZvciAoY29uc3QgYXJnIG9mIGFyZ3MpIHtcbiAgICAgIGlmIChhcmcgaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljSW5wdXQobm9kZSwgYXJnKSk7XG4gICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgICByZXN1bHQucHVzaCguLi5hcmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnB1c2goYXJnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbi8vIFVzZWQgZm9yIGBfX3NwcmVhZEFycmF5YCBUeXBlU2NyaXB0IGhlbHBlciBmdW5jdGlvbi5cbmV4cG9ydCBjbGFzcyBTcHJlYWRBcnJheUhlbHBlckZuIGV4dGVuZHMgS25vd25GbiB7XG4gIGV2YWx1YXRlKG5vZGU6IHRzLk5vZGUsIGFyZ3M6IFJlc29sdmVkVmFsdWVBcnJheSk6IFJlc29sdmVkVmFsdWUge1xuICAgIGlmIChhcmdzLmxlbmd0aCAhPT0gMikge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tVW5rbm93bihub2RlKTtcbiAgICB9XG5cbiAgICBjb25zdCBbdG8sIGZyb21dID0gYXJncztcbiAgICBpZiAodG8gaW5zdGFuY2VvZiBEeW5hbWljVmFsdWUpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUR5bmFtaWNJbnB1dChub2RlLCB0byk7XG4gICAgfSBlbHNlIGlmIChmcm9tIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljSW5wdXQobm9kZSwgZnJvbSk7XG4gICAgfVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHRvKSkge1xuICAgICAgcmV0dXJuIER5bmFtaWNWYWx1ZS5mcm9tSW52YWxpZEV4cHJlc3Npb25UeXBlKG5vZGUsIHRvKTtcbiAgICB9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KGZyb20pKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21JbnZhbGlkRXhwcmVzc2lvblR5cGUobm9kZSwgZnJvbSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvLmNvbmNhdChmcm9tKTtcbiAgfVxufVxuXG4vLyBVc2VkIGZvciBgX19yZWFkYCBUeXBlU2NyaXB0IGhlbHBlciBmdW5jdGlvbi5cbmV4cG9ydCBjbGFzcyBSZWFkSGVscGVyRm4gZXh0ZW5kcyBLbm93bkZuIHtcbiAgZXZhbHVhdGUobm9kZTogdHMuTm9kZSwgYXJnczogUmVzb2x2ZWRWYWx1ZUFycmF5KTogUmVzb2x2ZWRWYWx1ZSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSAxKSB7XG4gICAgICAvLyBUaGUgYF9fcmVhZGAgaGVscGVyIGFjY2VwdHMgYSBzZWNvbmQgYXJndW1lbnQgYG5gIGJ1dCB0aGF0IGNhc2UgaXMgbm90IHN1cHBvcnRlZC5cbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbVVua25vd24obm9kZSk7XG4gICAgfVxuXG4gICAgY29uc3QgW3ZhbHVlXSA9IGFyZ3M7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICByZXR1cm4gRHluYW1pY1ZhbHVlLmZyb21EeW5hbWljSW5wdXQobm9kZSwgdmFsdWUpO1xuICAgIH1cblxuICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBEeW5hbWljVmFsdWUuZnJvbUludmFsaWRFeHByZXNzaW9uVHlwZShub2RlLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG4iXX0=