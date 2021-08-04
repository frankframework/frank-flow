/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '@angular/compiler';
import { FatalLinkerError } from '../fatal_linker_error';
/**
 * This helper class wraps an object expression along with an `AstHost` object, exposing helper
 * methods that make it easier to extract the properties of the object.
 *
 * The generic `T` is used as reference type of the expected structure that is represented by this
 * object. It does not achieve full type-safety for the provided operations in correspondence with
 * `T`; its main goal is to provide references to a documented type and ensure that the properties
 * that are read from the object are present.
 *
 * Unfortunately, the generic types are unable to prevent reading an optional property from the
 * object without first having called `has` to ensure that the property exists. This is one example
 * of where full type-safety is not achieved.
 */
export class AstObject {
    constructor(expression, obj, host) {
        this.expression = expression;
        this.obj = obj;
        this.host = host;
    }
    /**
     * Create a new `AstObject` from the given `expression` and `host`.
     */
    static parse(expression, host) {
        const obj = host.parseObjectLiteral(expression);
        return new AstObject(expression, obj, host);
    }
    /**
     * Returns true if the object has a property called `propertyName`.
     */
    has(propertyName) {
        return this.obj.has(propertyName);
    }
    /**
     * Returns the number value of the property called `propertyName`.
     *
     * Throws an error if there is no such property or the property is not a number.
     */
    getNumber(propertyName) {
        return this.host.parseNumericLiteral(this.getRequiredProperty(propertyName));
    }
    /**
     * Returns the string value of the property called `propertyName`.
     *
     * Throws an error if there is no such property or the property is not a string.
     */
    getString(propertyName) {
        return this.host.parseStringLiteral(this.getRequiredProperty(propertyName));
    }
    /**
     * Returns the boolean value of the property called `propertyName`.
     *
     * Throws an error if there is no such property or the property is not a boolean.
     */
    getBoolean(propertyName) {
        return this.host.parseBooleanLiteral(this.getRequiredProperty(propertyName));
    }
    /**
     * Returns the nested `AstObject` parsed from the property called `propertyName`.
     *
     * Throws an error if there is no such property or the property is not an object.
     */
    getObject(propertyName) {
        const expr = this.getRequiredProperty(propertyName);
        const obj = this.host.parseObjectLiteral(expr);
        return new AstObject(expr, obj, this.host);
    }
    /**
     * Returns an array of `AstValue` objects parsed from the property called `propertyName`.
     *
     * Throws an error if there is no such property or the property is not an array.
     */
    getArray(propertyName) {
        const arr = this.host.parseArrayLiteral(this.getRequiredProperty(propertyName));
        return arr.map(entry => new AstValue(entry, this.host));
    }
    /**
     * Returns a `WrappedNodeExpr` object that wraps the expression at the property called
     * `propertyName`.
     *
     * Throws an error if there is no such property.
     */
    getOpaque(propertyName) {
        return new o.WrappedNodeExpr(this.getRequiredProperty(propertyName));
    }
    /**
     * Returns the raw `TExpression` value of the property called `propertyName`.
     *
     * Throws an error if there is no such property.
     */
    getNode(propertyName) {
        return this.getRequiredProperty(propertyName);
    }
    /**
     * Returns an `AstValue` that wraps the value of the property called `propertyName`.
     *
     * Throws an error if there is no such property.
     */
    getValue(propertyName) {
        return new AstValue(this.getRequiredProperty(propertyName), this.host);
    }
    /**
     * Converts the AstObject to a raw JavaScript object, mapping each property value (as an
     * `AstValue`) to the generic type (`T`) via the `mapper` function.
     */
    toLiteral(mapper) {
        const result = {};
        for (const [key, expression] of this.obj) {
            result[key] = mapper(new AstValue(expression, this.host));
        }
        return result;
    }
    /**
     * Converts the AstObject to a JavaScript Map, mapping each property value (as an
     * `AstValue`) to the generic type (`T`) via the `mapper` function.
     */
    toMap(mapper) {
        const result = new Map();
        for (const [key, expression] of this.obj) {
            result.set(key, mapper(new AstValue(expression, this.host)));
        }
        return result;
    }
    getRequiredProperty(propertyName) {
        if (!this.obj.has(propertyName)) {
            throw new FatalLinkerError(this.expression, `Expected property '${propertyName}' to be present.`);
        }
        return this.obj.get(propertyName);
    }
}
/**
 * This helper class wraps an `expression`, exposing methods that use the `host` to give
 * access to the underlying value of the wrapped expression.
 *
 * The generic `T` is used as reference type of the expected type that is represented by this value.
 * It does not achieve full type-safety for the provided operations in correspondence with `T`; its
 * main goal is to provide references to a documented type.
 */
export class AstValue {
    constructor(expression, host) {
        this.expression = expression;
        this.host = host;
    }
    /**
     * Get the name of the symbol represented by the given expression node, or `null` if it is not a
     * symbol.
     */
    getSymbolName() {
        return this.host.getSymbolName(this.expression);
    }
    /**
     * Is this value a number?
     */
    isNumber() {
        return this.host.isNumericLiteral(this.expression);
    }
    /**
     * Parse the number from this value, or error if it is not a number.
     */
    getNumber() {
        return this.host.parseNumericLiteral(this.expression);
    }
    /**
     * Is this value a string?
     */
    isString() {
        return this.host.isStringLiteral(this.expression);
    }
    /**
     * Parse the string from this value, or error if it is not a string.
     */
    getString() {
        return this.host.parseStringLiteral(this.expression);
    }
    /**
     * Is this value a boolean?
     */
    isBoolean() {
        return this.host.isBooleanLiteral(this.expression);
    }
    /**
     * Parse the boolean from this value, or error if it is not a boolean.
     */
    getBoolean() {
        return this.host.parseBooleanLiteral(this.expression);
    }
    /**
     * Is this value an object literal?
     */
    isObject() {
        return this.host.isObjectLiteral(this.expression);
    }
    /**
     * Parse this value into an `AstObject`, or error if it is not an object literal.
     */
    getObject() {
        return AstObject.parse(this.expression, this.host);
    }
    /**
     * Is this value an array literal?
     */
    isArray() {
        return this.host.isArrayLiteral(this.expression);
    }
    /**
     * Parse this value into an array of `AstValue` objects, or error if it is not an array literal.
     */
    getArray() {
        const arr = this.host.parseArrayLiteral(this.expression);
        return arr.map(entry => new AstValue(entry, this.host));
    }
    /**
     * Is this value a function expression?
     */
    isFunction() {
        return this.host.isFunctionExpression(this.expression);
    }
    /**
     * Extract the return value as an `AstValue` from this value as a function expression, or error if
     * it is not a function expression.
     */
    getFunctionReturnValue() {
        return new AstValue(this.host.parseReturnValue(this.expression), this.host);
    }
    isCallExpression() {
        return this.host.isCallExpression(this.expression);
    }
    getCallee() {
        return new AstValue(this.host.parseCallee(this.expression), this.host);
    }
    getArguments() {
        const args = this.host.parseArguments(this.expression);
        return args.map(arg => new AstValue(arg, this.host));
    }
    /**
     * Return the `TExpression` of this value wrapped in a `WrappedNodeExpr`.
     */
    getOpaque() {
        return new o.WrappedNodeExpr(this.expression);
    }
    /**
     * Get the range of the location of this value in the original source.
     */
    getRange() {
        return this.host.getRange(this.expression);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN0X3ZhbHVlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL2xpbmtlci9zcmMvYXN0L2FzdF92YWx1ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBb0N2RDs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxNQUFNLE9BQU8sU0FBUztJQVVwQixZQUNhLFVBQXVCLEVBQVUsR0FBNkIsRUFDL0QsSUFBMEI7UUFEekIsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUFVLFFBQUcsR0FBSCxHQUFHLENBQTBCO1FBQy9ELFNBQUksR0FBSixJQUFJLENBQXNCO0lBQUcsQ0FBQztJQVgxQzs7T0FFRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQWdDLFVBQXVCLEVBQUUsSUFBMEI7UUFFN0YsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2hELE9BQU8sSUFBSSxTQUFTLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBTUQ7O09BRUc7SUFDSCxHQUFHLENBQUMsWUFBNEI7UUFDOUIsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFNBQVMsQ0FBaUUsWUFBZTtRQUV2RixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxTQUFTLENBQWlFLFlBQWU7UUFFdkYsT0FBTyxJQUFJLENBQUMs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Q0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRCxZQUFZO1FBQ1YsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTO1FBQ1AsT0FBTyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtGYXRhbExpbmtlckVycm9yfSBmcm9tICcuLi9mYXRhbF9saW5rZXJfZXJyb3InO1xuaW1wb3J0IHtBc3RIb3N0LCBSYW5nZX0gZnJvbSAnLi9hc3RfaG9zdCc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBvbmx5IHRob3NlIHR5cGVzIGluIGBUYCB0aGF0IGFyZSBvYmplY3QgdHlwZXMuXG4gKi9cbnR5cGUgT2JqZWN0VHlwZTxUPiA9IEV4dHJhY3Q8VCwgb2JqZWN0PjtcblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSB2YWx1ZSB0eXBlIG9mIGFuIG9iamVjdCBsaXRlcmFsLlxuICovXG50eXBlIE9iamVjdFZhbHVlVHlwZTxUPiA9IFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCBpbmZlciBSPj8gUiA6IG5ldmVyO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHZhbHVlIHR5cGUgb2YgYW4gYXJyYXkgbGl0ZXJhbC5cbiAqL1xudHlwZSBBcnJheVZhbHVlVHlwZTxUPiA9IFQgZXh0ZW5kcyBBcnJheTxpbmZlciBSPj8gUiA6IG5ldmVyO1xuXG4vKipcbiAqIEVuc3VyZXMgdGhhdCBgVGhpc2AgaGFzIGl0cyBnZW5lcmljIHR5cGUgYEFjdHVhbGAgY29uZm9ybSB0byB0aGUgZXhwZWN0ZWQgZ2VuZXJpYyB0eXBlIGluXG4gKiBgRXhwZWN0ZWRgLCB0byBkaXNhbGxvdyBjYWxsaW5nIGEgbWV0aG9kIGlmIHRoZSBnZW5lcmljIHR5cGUgZG9lcyBub3QgY29uZm9ybS5cbiAqL1xudHlwZSBDb25mb3Jtc1RvPFRoaXMsIEFjdHVhbCwgRXhwZWN0ZWQ+ID0gQWN0dWFsIGV4dGVuZHMgRXhwZWN0ZWQgPyBUaGlzIDogbmV2ZXI7XG5cbi8qKlxuICogRW5zdXJlcyB0aGF0IGBUaGlzYCBpcyBhbiBgQXN0VmFsdWVgIHdob3NlIGdlbmVyaWMgdHlwZSBjb25mb3JtcyB0byBgRXhwZWN0ZWRgLCB0byBkaXNhbGxvd1xuICogY2FsbGluZyBhIG1ldGhvZCBpZiB0aGUgdmFsdWUncyB0eXBlIGRvZXMgbm90IGNvbmZvcm0uXG4gKi9cbnR5cGUgSGFzVmFsdWVUeXBlPFRoaXMsIEV4cGVjdGVkPiA9XG4gICAgVGhpcyBleHRlbmRzIEFzdFZhbHVlPGluZmVyIEFjdHVhbCwgYW55Pj8gQ29uZm9ybXNUbzxUaGlzLCBBY3R1YWwsIEV4cGVjdGVkPjogbmV2ZXI7XG5cbi8qKlxuICogUmVwcmVzZW50cyBvbmx5IHRoZSBzdHJpbmcga2V5cyBvZiB0eXBlIGBUYC5cbiAqL1xudHlwZSBQcm9wZXJ0eUtleTxUPiA9IGtleW9mIFQmc3RyaW5nO1xuXG4vKipcbiAqIFRoaXMgaGVscGVyIGNsYXNzIHdyYXBzIGFuIG9iamVjdCBleHByZXNzaW9uIGFsb25nIHdpdGggYW4gYEFzdEhvc3RgIG9iamVjdCwgZXhwb3NpbmcgaGVscGVyXG4gKiBtZXRob2RzIHRoYXQgbWFrZSBpdCBlYXNpZXIgdG8gZXh0cmFjdCB0aGUgcHJvcGVydGllcyBvZiB0aGUgb2JqZWN0LlxuICpcbiAqIFRoZSBnZW5lcmljIGBUYCBpcyB1c2VkIGFzIHJlZmVyZW5jZSB0eXBlIG9mIHRoZSBleHBlY3RlZCBzdHJ1Y3R1cmUgdGhhdCBpcyByZXByZXNlbnRlZCBieSB0aGlzXG4gKiBvYmplY3QuIEl0IGRvZXMgbm90IGFjaGlldmUgZnVsbCB0eXBlLXNhZmV0eSBmb3IgdGhlIHByb3ZpZGVkIG9wZXJhdGlvbnMgaW4gY29ycmVzcG9uZGVuY2Ugd2l0aFxuICogYFRgOyBpdHMgbWFpbiBnb2FsIGlzIHRvIHByb3ZpZGUgcmVmZXJlbmNlcyB0byBhIGRvY3VtZW50ZWQgdHlwZSBhbmQgZW5zdXJlIHRoYXQgdGhlIHByb3BlcnRpZXNcbiAqIHRoYXQgYXJlIHJlYWQgZnJvbSB0aGUgb2JqZWN0IGFyZSBwcmVzZW50LlxuICpcbiAqIFVuZm9ydHVuYXRlbHksIHRoZSBnZW5lcmljIHR5cGVzIGFyZSB1bmFibGUgdG8gcHJldmVudCByZWFkaW5nIGFuIG9wdGlvbmFsIHByb3BlcnR5IGZyb20gdGhlXG4gKiBvYmplY3Qgd2l0aG91dCBmaXJzdCBoYXZpbmcgY2FsbGVkIGBoYXNgIHRvIGVuc3VyZSB0aGF0IHRoZSBwcm9wZXJ0eSBleGlzdHMuIFRoaXMgaXMgb25lIGV4YW1wbGVcbiAqIG9mIHdoZXJlIGZ1bGwgdHlwZS1zYWZldHkgaXMgbm90IGFjaGlldmVkLlxuICovXG5leHBvcnQgY2xhc3MgQXN0T2JqZWN0PFQgZXh0ZW5kcyBvYmplY3QsIFRFeHByZXNzaW9uPiB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgYEFzdE9iamVjdGAgZnJvbSB0aGUgZ2l2ZW4gYGV4cHJlc3Npb25gIGFuZCBgaG9zdGAuXG4gICAqL1xuICBzdGF0aWMgcGFyc2U8VCBleHRlbmRzIG9iamVjdCwgVEV4cHJlc3Npb24+KGV4cHJlc3Npb246IFRFeHByZXNzaW9uLCBob3N0OiBBc3RIb3N0PFRFeHByZXNzaW9uPik6XG4gICAgICBBc3RPYmplY3Q8VCwgVEV4cHJlc3Npb24+IHtcbiAgICBjb25zdCBvYmogPSBob3N0LnBhcnNlT2JqZWN0TGl0ZXJhbChleHByZXNzaW9uKTtcbiAgICByZXR1cm4gbmV3IEFzdE9iamVjdChleHByZXNzaW9uLCBvYmosIGhvc3QpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IGV4cHJlc3Npb246IFRFeHByZXNzaW9uLCBwcml2YXRlIG9iajogTWFwPHN0cmluZywgVEV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBob3N0OiBBc3RIb3N0PFRFeHByZXNzaW9uPikge31cblxuICAvKipcbiAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBvYmplY3QgaGFzIGEgcHJvcGVydHkgY2FsbGVkIGBwcm9wZXJ0eU5hbWVgLlxuICAgKi9cbiAgaGFzKHByb3BlcnR5TmFtZTogUHJvcGVydHlLZXk8VD4pOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5vYmouaGFzKHByb3BlcnR5TmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbnVtYmVyIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eSBjYWxsZWQgYHByb3BlcnR5TmFtZWAuXG4gICAqXG4gICAqIFRocm93cyBhbiBlcnJvciBpZiB0aGVyZSBpcyBubyBzdWNoIHByb3BlcnR5IG9yIHRoZSBwcm9wZXJ0eSBpcyBub3QgYSBudW1iZXIuXG4gICAqL1xuICBnZXROdW1iZXI8SyBleHRlbmRzIFByb3BlcnR5S2V5PFQ+Pih0aGlzOiBDb25mb3Jtc1RvPHRoaXMsIFRbS10sIG51bWJlcj4sIHByb3BlcnR5TmFtZTogSyk6XG4gICAgICBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmhvc3QucGFyc2VOdW1lcmljTGl0ZXJhbCh0aGlzLmdldFJlcXVpcmVkUHJvcGVydHkocHJvcGVydHlOYW1lKSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgc3RyaW5nIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eSBjYWxsZWQgYHByb3BlcnR5TmFtZWAuXG4gICAqXG4gICAqIFRocm93cyBhbiBlcnJvciBpZiB0aGVyZSBpcyBubyBzdWNoIHByb3BlcnR5IG9yIHRoZSBwcm9wZXJ0eSBpcyBub3QgYSBzdHJpbmcuXG4gICAqL1xuICBnZXRTdHJpbmc8SyBleHRlbmRzIFByb3BlcnR5S2V5PFQ+Pih0aGlzOiBDb25mb3Jtc1RvPHRoaXMsIFRbS10sIHN0cmluZz4sIHByb3BlcnR5TmFtZTogSyk6XG4gICAgICBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmhvc3QucGFyc2VTdHJpbmdMaXRlcmFsKHRoaXMuZ2V0UmVxdWlyZWRQcm9wZXJ0eShwcm9wZXJ0eU5hbWUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBib29sZWFuIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eSBjYWxsZWQgYHByb3BlcnR5TmFtZWAuXG4gICAqXG4gICAqIFRocm93cyBhbiBlcnJvciBpZiB0aGVyZSBpcyBubyBzdWNoIHByb3BlcnR5IG9yIHRoZSBwcm9wZXJ0eSBpcyBub3QgYSBib29sZWFuLlxuICAgKi9cbiAgZ2V0Qm9vbGVhbjxLIGV4dGVuZHMgUHJvcGVydHlLZXk8VD4+KHRoaXM6IENvbmZvcm1zVG88dGhpcywgVFtLXSwgYm9vbGVhbj4sIHByb3BlcnR5TmFtZTogSyk6XG4gICAgICBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LnBhcnNlQm9vbGVhbkxpdGVyYWwodGhpcy5nZXRSZXF1aXJlZFByb3BlcnR5KHByb3BlcnR5TmFtZSkpIGFzIGFueTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBuZXN0ZWQgYEFzdE9iamVjdGAgcGFyc2VkIGZyb20gdGhlIHByb3BlcnR5IGNhbGxlZCBgcHJvcGVydHlOYW1lYC5cbiAgICpcbiAgICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZXJlIGlzIG5vIHN1Y2ggcHJvcGVydHkgb3IgdGhlIHByb3BlcnR5IGlzIG5vdCBhbiBvYmplY3QuXG4gICAqL1xuICBnZXRPYmplY3Q8SyBleHRlbmRzIFByb3BlcnR5S2V5PFQ+Pih0aGlzOiBDb25mb3Jtc1RvPHRoaXMsIFRbS10sIG9iamVjdD4sIHByb3BlcnR5TmFtZTogSyk6XG4gICAgICBBc3RPYmplY3Q8T2JqZWN0VHlwZTxUW0tdPiwgVEV4cHJlc3Npb24+IHtcbiAgICBjb25zdCBleHByID0gdGhpcy5nZXRSZXF1aXJlZFByb3BlcnR5KHByb3BlcnR5TmFtZSk7XG4gICAgY29uc3Qgb2JqID0gdGhpcy5ob3N0LnBhcnNlT2JqZWN0TGl0ZXJhbChleHByKTtcbiAgICByZXR1cm4gbmV3IEFzdE9iamVjdChleHByLCBvYmosIHRoaXMuaG9zdCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBhcnJheSBvZiBgQXN0VmFsdWVgIG9iamVjdHMgcGFyc2VkIGZyb20gdGhlIHByb3BlcnR5IGNhbGxlZCBgcHJvcGVydHlOYW1lYC5cbiAgICpcbiAgICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZXJlIGlzIG5vIHN1Y2ggcHJvcGVydHkgb3IgdGhlIHByb3BlcnR5IGlzIG5vdCBhbiBhcnJheS5cbiAgICovXG4gIGdldEFycmF5PEsgZXh0ZW5kcyBQcm9wZXJ0eUtleTxUPj4odGhpczogQ29uZm9ybXNUbzx0aGlzLCBUW0tdLCB1bmtub3duW10+LCBwcm9wZXJ0eU5hbWU6IEspOlxuICAgICAgQXN0VmFsdWU8QXJyYXlWYWx1ZVR5cGU8VFtLXT4sIFRFeHByZXNzaW9uPltdIHtcbiAgICBjb25zdCBhcnIgPSB0aGlzLmhvc3QucGFyc2VBcnJheUxpdGVyYWwodGhpcy5nZXRSZXF1aXJlZFByb3BlcnR5KHByb3BlcnR5TmFtZSkpO1xuICAgIHJldHVybiBhcnIubWFwKGVudHJ5ID0+IG5ldyBBc3RWYWx1ZShlbnRyeSwgdGhpcy5ob3N0KSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIGBXcmFwcGVkTm9kZUV4cHJgIG9iamVjdCB0aGF0IHdyYXBzIHRoZSBleHByZXNzaW9uIGF0IHRoZSBwcm9wZXJ0eSBjYWxsZWRcbiAgICogYHByb3BlcnR5TmFtZWAuXG4gICAqXG4gICAqIFRocm93cyBhbiBlcnJvciBpZiB0aGVyZSBpcyBubyBzdWNoIHByb3BlcnR5LlxuICAgKi9cbiAgZ2V0T3BhcXVlKHByb3BlcnR5TmFtZTogUHJvcGVydHlLZXk8VD4pOiBvLldyYXBwZWROb2RlRXhwcjxURXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiBuZXcgby5XcmFwcGVkTm9kZUV4cHIodGhpcy5nZXRSZXF1aXJlZFByb3BlcnR5KHByb3BlcnR5TmFtZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHJhdyBgVEV4cHJlc3Npb25gIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eSBjYWxsZWQgYHByb3BlcnR5TmFtZWAuXG4gICAqXG4gICAqIFRocm93cyBhbiBlcnJvciBpZiB0aGVyZSBpcyBubyBzdWNoIHByb3BlcnR5LlxuICAgKi9cbiAgZ2V0Tm9kZShwcm9wZXJ0eU5hbWU6IFByb3BlcnR5S2V5PFQ+KTogVEV4cHJlc3Npb24ge1xuICAgIHJldHVybiB0aGlzLmdldFJlcXVpcmVkUHJvcGVydHkocHJvcGVydHlOYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGBBc3RWYWx1ZWAgdGhhdCB3cmFwcyB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5IGNhbGxlZCBgcHJvcGVydHlOYW1lYC5cbiAgICpcbiAgICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZXJlIGlzIG5vIHN1Y2ggcHJvcGVydHkuXG4gICAqL1xuICBnZXRWYWx1ZTxLIGV4dGVuZHMgUHJvcGVydHlLZXk8VD4+KHByb3BlcnR5TmFtZTogSyk6IEFzdFZhbHVlPFRbS10sIFRFeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIG5ldyBBc3RWYWx1ZSh0aGlzLmdldFJlcXVpcmVkUHJvcGVydHkocHJvcGVydHlOYW1lKSwgdGhpcy5ob3N0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgQXN0T2JqZWN0IHRvIGEgcmF3IEphdmFTY3JpcHQgb2JqZWN0LCBtYXBwaW5nIGVhY2ggcHJvcGVydHkgdmFsdWUgKGFzIGFuXG4gICAqIGBBc3RWYWx1ZWApIHRvIHRoZSBnZW5lcmljIHR5cGUgKGBUYCkgdmlhIHRoZSBgbWFwcGVyYCBmdW5jdGlvbi5cbiAgICovXG4gIHRvTGl0ZXJhbDxWPihtYXBwZXI6ICh2YWx1ZTogQXN0VmFsdWU8T2JqZWN0VmFsdWVUeXBlPFQ+LCBURXhwcmVzc2lvbj4pID0+IFYpOiBSZWNvcmQ8c3RyaW5nLCBWPiB7XG4gICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBWPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgZXhwcmVzc2lvbl0gb2YgdGhpcy5vYmopIHtcbiAgICAgIHJlc3VsdFtrZXldID0gbWFwcGVyKG5ldyBBc3RWYWx1ZShleHByZXNzaW9uLCB0aGlzLmhvc3QpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgQXN0T2JqZWN0IHRvIGEgSmF2YVNjcmlwdCBNYXAsIG1hcHBpbmcgZWFjaCBwcm9wZXJ0eSB2YWx1ZSAoYXMgYW5cbiAgICogYEFzdFZhbHVlYCkgdG8gdGhlIGdlbmVyaWMgdHlwZSAoYFRgKSB2aWEgdGhlIGBtYXBwZXJgIGZ1bmN0aW9uLlxuICAgKi9cbiAgdG9NYXA8Vj4obWFwcGVyOiAodmFsdWU6IEFzdFZhbHVlPE9iamVjdFZhbHVlVHlwZTxUPiwgVEV4cHJlc3Npb24+KSA9PiBWKTogTWFwPHN0cmluZywgVj4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBNYXA8c3RyaW5nLCBWPigpO1xuICAgIGZvciAoY29uc3QgW2tleSwgZXhwcmVzc2lvbl0gb2YgdGhpcy5vYmopIHtcbiAgICAgIHJlc3VsdC5zZXQoa2V5LCBtYXBwZXIobmV3IEFzdFZhbHVlKGV4cHJlc3Npb24sIHRoaXMuaG9zdCkpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UmVxdWlyZWRQcm9wZXJ0eShwcm9wZXJ0eU5hbWU6IFByb3BlcnR5S2V5PFQ+KTogVEV4cHJlc3Npb24ge1xuICAgIGlmICghdGhpcy5vYmouaGFzKHByb3BlcnR5TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbExpbmtlckVycm9yKFxuICAgICAgICAgIHRoaXMuZXhwcmVzc2lvbiwgYEV4cGVjdGVkIHByb3BlcnR5ICcke3Byb3BlcnR5TmFtZX0nIHRvIGJlIHByZXNlbnQuYCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm9iai5nZXQocHJvcGVydHlOYW1lKSE7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGlzIGhlbHBlciBjbGFzcyB3cmFwcyBhbiBgZXhwcmVzc2lvbmAsIGV4cG9zaW5nIG1ldGhvZHMgdGhhdCB1c2UgdGhlIGBob3N0YCB0byBnaXZlXG4gKiBhY2Nlc3MgdG8gdGhlIHVuZGVybHlpbmcgdmFsdWUgb2YgdGhlIHdyYXBwZWQgZXhwcmVzc2lvbi5cbiAqXG4gKiBUaGUgZ2VuZXJpYyBgVGAgaXMgdXNlZCBhcyByZWZlcmVuY2UgdHlwZSBvZiB0aGUgZXhwZWN0ZWQgdHlwZSB0aGF0IGlzIHJlcHJlc2VudGVkIGJ5IHRoaXMgdmFsdWUuXG4gKiBJdCBkb2VzIG5vdCBhY2hpZXZlIGZ1bGwgdHlwZS1zYWZldHkgZm9yIHRoZSBwcm92aWRlZCBvcGVyYXRpb25zIGluIGNvcnJlc3BvbmRlbmNlIHdpdGggYFRgOyBpdHNcbiAqIG1haW4gZ29hbCBpcyB0byBwcm92aWRlIHJlZmVyZW5jZXMgdG8gYSBkb2N1bWVudGVkIHR5cGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBBc3RWYWx1ZTxULCBURXhwcmVzc2lvbj4ge1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSBleHByZXNzaW9uOiBURXhwcmVzc2lvbiwgcHJpdmF0ZSBob3N0OiBBc3RIb3N0PFRFeHByZXNzaW9uPikge31cblxuICAvKipcbiAgICogR2V0IHRoZSBuYW1lIG9mIHRoZSBzeW1ib2wgcmVwcmVzZW50ZWQgYnkgdGhlIGdpdmVuIGV4cHJlc3Npb24gbm9kZSwgb3IgYG51bGxgIGlmIGl0IGlzIG5vdCBhXG4gICAqIHN5bWJvbC5cbiAgICovXG4gIGdldFN5bWJvbE5hbWUoKTogc3RyaW5nfG51bGwge1xuICAgIHJldHVybiB0aGlzLmhvc3QuZ2V0U3ltYm9sTmFtZSh0aGlzLmV4cHJlc3Npb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIElzIHRoaXMgdmFsdWUgYSBudW1iZXI/XG4gICAqL1xuICBpc051bWJlcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LmlzTnVtZXJpY0xpdGVyYWwodGhpcy5leHByZXNzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSB0aGUgbnVtYmVyIGZyb20gdGhpcyB2YWx1ZSwgb3IgZXJyb3IgaWYgaXQgaXMgbm90IGEgbnVtYmVyLlxuICAgKi9cbiAgZ2V0TnVtYmVyKHRoaXM6IEhhc1ZhbHVlVHlwZTx0aGlzLCBudW1iZXI+KTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LnBhcnNlTnVtZXJpY0xpdGVyYWwodGhpcy5leHByZXNzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGlzIHZhbHVlIGEgc3RyaW5nP1xuICAgKi9cbiAgaXNTdHJpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaG9zdC5pc1N0cmluZ0xpdGVyYWwodGhpcy5leHByZXNzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSB0aGUgc3RyaW5nIGZyb20gdGhpcyB2YWx1ZSwgb3IgZXJyb3IgaWYgaXQgaXMgbm90IGEgc3RyaW5nLlxuICAgKi9cbiAgZ2V0U3RyaW5nKHRoaXM6IEhhc1ZhbHVlVHlwZTx0aGlzLCBzdHJpbmc+KTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LnBhcnNlU3RyaW5nTGl0ZXJhbCh0aGlzLmV4cHJlc3Npb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIElzIHRoaXMgdmFsdWUgYSBib29sZWFuP1xuICAgKi9cbiAgaXNCb29sZWFuKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmhvc3QuaXNCb29sZWFuTGl0ZXJhbCh0aGlzLmV4cHJlc3Npb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRoZSBib29sZWFuIGZyb20gdGhpcyB2YWx1ZSwgb3IgZXJyb3IgaWYgaXQgaXMgbm90IGEgYm9vbGVhbi5cbiAgICovXG4gIGdldEJvb2xlYW4odGhpczogSGFzVmFsdWVUeXBlPHRoaXMsIGJvb2xlYW4+KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaG9zdC5wYXJzZUJvb2xlYW5MaXRlcmFsKHRoaXMuZXhwcmVzc2lvbik7XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhpcyB2YWx1ZSBhbiBvYmplY3QgbGl0ZXJhbD9cbiAgICovXG4gIGlzT2JqZWN0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmhvc3QuaXNPYmplY3RMaXRlcmFsKHRoaXMuZXhwcmVzc2lvbik7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgdGhpcyB2YWx1ZSBpbnRvIGFuIGBBc3RPYmplY3RgLCBvciBlcnJvciBpZiBpdCBpcyBub3QgYW4gb2JqZWN0IGxpdGVyYWwuXG4gICAqL1xuICBnZXRPYmplY3QodGhpczogSGFzVmFsdWVUeXBlPHRoaXMsIG9iamVjdD4pOiBBc3RPYmplY3Q8T2JqZWN0VHlwZTxUPiwgVEV4cHJlc3Npb24+IHtcbiAgICByZXR1cm4gQXN0T2JqZWN0LnBhcnNlKHRoaXMuZXhwcmVzc2lvbiwgdGhpcy5ob3N0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGlzIHZhbHVlIGFuIGFycmF5IGxpdGVyYWw/XG4gICAqL1xuICBpc0FycmF5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmhvc3QuaXNBcnJheUxpdGVyYWwodGhpcy5leHByZXNzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSB0aGlzIHZhbHVlIGludG8gYW4gYXJyYXkgb2YgYEFzdFZhbHVlYCBvYmplY3RzLCBvciBlcnJvciBpZiBpdCBpcyBub3QgYW4gYXJyYXkgbGl0ZXJhbC5cbiAgICovXG4gIGdldEFycmF5KHRoaXM6IEhhc1ZhbHVlVHlwZTx0aGlzLCB1bmtub3duW10+KTogQXN0VmFsdWU8QXJyYXlWYWx1ZVR5cGU8VD4sIFRFeHByZXNzaW9uPltdIHtcbiAgICBjb25zdCBhcnIgPSB0aGlzLmhvc3QucGFyc2VBcnJheUxpdGVyYWwodGhpcy5leHByZXNzaW9uKTtcbiAgICByZXR1cm4gYXJyLm1hcChlbnRyeSA9PiBuZXcgQXN0VmFsdWUoZW50cnksIHRoaXMuaG9zdCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIElzIHRoaXMgdmFsdWUgYSBmdW5jdGlvbiBleHByZXNzaW9uP1xuICAgKi9cbiAgaXNGdW5jdGlvbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LmlzRnVuY3Rpb25FeHByZXNzaW9uKHRoaXMuZXhwcmVzc2lvbik7XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgcmV0dXJuIHZhbHVlIGFzIGFuIGBBc3RWYWx1ZWAgZnJvbSB0aGlzIHZhbHVlIGFzIGEgZnVuY3Rpb24gZXhwcmVzc2lvbiwgb3IgZXJyb3IgaWZcbiAgICogaXQgaXMgbm90IGEgZnVuY3Rpb24gZXhwcmVzc2lvbi5cbiAgICovXG4gIGdldEZ1bmN0aW9uUmV0dXJuVmFsdWU8Uj4odGhpczogSGFzVmFsdWVUeXBlPHRoaXMsIEZ1bmN0aW9uPik6IEFzdFZhbHVlPFIsIFRFeHByZXNzaW9uPiB7XG4gICAgcmV0dXJuIG5ldyBBc3RWYWx1ZSh0aGlzLmhvc3QucGFyc2VSZXR1cm5WYWx1ZSh0aGlzLmV4cHJlc3Npb24pLCB0aGlzLmhvc3QpO1xuICB9XG5cbiAgaXNDYWxsRXhwcmVzc2lvbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5ob3N0LmlzQ2FsbEV4cHJlc3Npb24odGhpcy5leHByZXNzaW9uKTtcbiAgfVxuXG4gIGdldENhbGxlZSgpOiBBc3RWYWx1ZTx1bmtub3duLCBURXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiBuZXcgQXN0VmFsdWUodGhpcy5ob3N0LnBhcnNlQ2FsbGVlKHRoaXMuZXhwcmVzc2lvbiksIHRoaXMuaG9zdCk7XG4gIH1cblxuICBnZXRBcmd1bWVudHMoKTogQXN0VmFsdWU8dW5rbm93biwgVEV4cHJlc3Npb24+W10ge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLmhvc3QucGFyc2VBcmd1bWVudHModGhpcy5leHByZXNzaW9uKTtcbiAgICByZXR1cm4gYXJncy5tYXAoYXJnID0+IG5ldyBBc3RWYWx1ZShhcmcsIHRoaXMuaG9zdCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYFRFeHByZXNzaW9uYCBvZiB0aGlzIHZhbHVlIHdyYXBwZWQgaW4gYSBgV3JhcHBlZE5vZGVFeHByYC5cbiAgICovXG4gIGdldE9wYXF1ZSgpOiBvLldyYXBwZWROb2RlRXhwcjxURXhwcmVzc2lvbj4ge1xuICAgIHJldHVybiBuZXcgby5XcmFwcGVkTm9kZUV4cHIodGhpcy5leHByZXNzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHJhbmdlIG9mIHRoZSBsb2NhdGlvbiBvZiB0aGlzIHZhbHVlIGluIHRoZSBvcmlnaW5hbCBzb3VyY2UuXG4gICAqL1xuICBnZXRSYW5nZSgpOiBSYW5nZSB7XG4gICAgcmV0dXJuIHRoaXMuaG9zdC5nZXRSYW5nZSh0aGlzLmV4cHJlc3Npb24pO1xuICB9XG59XG4iXX0=