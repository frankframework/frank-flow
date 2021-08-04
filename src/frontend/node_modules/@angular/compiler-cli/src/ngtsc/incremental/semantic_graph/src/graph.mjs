/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ExternalExpr } from '@angular/compiler';
import { SemanticSymbol } from './api';
/**
 * Represents a declaration for which no semantic symbol has been registered. For example,
 * declarations from external dependencies have not been explicitly registered and are represented
 * by this symbol. This allows the unresolved symbol to still be compared to a symbol from a prior
 * compilation.
 */
class OpaqueSymbol extends SemanticSymbol {
    isPublicApiAffected() {
        return false;
    }
    isTypeCheckApiAffected() {
        return false;
    }
}
/**
 * The semantic dependency graph of a single compilation.
 */
export class SemanticDepGraph {
    constructor() {
        this.files = new Map();
        this.symbolByDecl = new Map();
    }
    /**
     * Registers a symbol in the graph. The symbol is given a unique identifier if possible, such that
     * its equivalent symbol can be obtained from a prior graph even if its declaration node has
     * changed across rebuilds. Symbols without an identifier are only able to find themselves in a
     * prior graph if their declaration node is identical.
     */
    registerSymbol(symbol) {
        this.symbolByDecl.set(symbol.decl, symbol);
        if (symbol.identifier !== null) {
            // If the symbol has a unique identifier, record it in the file that declares it. This enables
            // the symbol to be requested by its unique name.
            if (!this.files.has(symbol.path)) {
                this.files.set(symbol.path, new Map());
            }
            this.files.get(symbol.path).set(symbol.identifier, symbol);
        }
    }
    /**
     * Attempts to resolve a symbol in this graph that represents the given symbol from another graph.
     * If no matching symbol could be found, null is returned.
     *
     * @param symbol The symbol from another graph for which its equivalent in this graph should be
     * found.
     */
    getEquivalentSymbol(symbol) {
        // First lookup the symbol by its declaration. It is typical for the declaration to not have
        // changed across rebuilds, so this is likely to find the symbol. Using the declaration also
        // allows to diff symbols for which no unique identifier could be determined.
        let previousSymbol = this.getSymbolByDecl(symbol.decl);
        if (previousSymbol === null && symbol.identifier !== null) {
            // The declaration could not be resolved to a symbol in a prior compilation, which may
            // happen because the file containing the declaration has changed. In that case we want to
            // lookup the symbol based on its unique identifier, as that allows us to still compare the
            // changed declaration to the prior compilation.
            previousSymbol = this.getSymbolByName(symbol.path, symbol.identifier);
        }
        return previousSymbol;
    }
    /**
     * Attempts to find the symbol by its identifier.
     */
    getSymbolByName(path, identifier) {
        if (!this.files.has(path)) {
            return null;
        }
        const file = this.files.get(path);
        if (!file.has(identifier)) {
            return null;
        }
        return file.get(identifier);
    }
    /**
     * Attempts to resolve the declaration to its semantic symbol.
     */
    getSymbolByDecl(decl) {
        if (!this.symbolByDecl.has(decl)) {
            return null;
        }
        return this.symbolByDecl.get(decl);
    }
}
/**
 * Implements the logic to go from a previous dependency graph to a new one, along with information
 * on which files have been affected.
 */
export class SemanticDepGraphUpdater {
    constructor(
    /**
     * The semantic dependency graph of the most recently succeeded compilation, or null if this
     * is the initial build.
     */
    priorGraph) {
        this.priorGraph = priorGraph;
        this.newGraph = new SemanticDepGraph();
        /**
         * Contains opaque symbols that were created for declarations for which there was no symbol
         * registered, which happens for e.g. external declarations.
         */
        this.opaqueSymbols = new Map();
    }
    /**
     * Registers the symbol in the new graph that is being created.
     */
    registerSymbol(symbol) {
        this.newGraph.registerSymbol(symbol);
    }
    /**
     * Takes all facts that have been gathered to create a new semantic dependency graph. In this
     * process, the semantic impact of the changes is determined which results in a set of files that
     * need to be emitted and/or type-checked.
     */
    finalize() {
        if (this.priorGraph === null) {
            // If no prior dependency graph is available then this was the initial build, in which case
            // we don't need to determine the semantic impact as everything is already considered
            // logically changed.
            return {
                needsEmit: new Set(),
                needsTypeCheckEmit: new Set(),
                newGraph: this.newGraph,
            };
        }
        const needsEmit = this.determineInvalidatedFiles(this.priorGraph);
        const needsTypeCheckEmit = this.determineInvalidatedTypeCheckFiles(this.priorGraph);
        return {
            needsEmit,
            needsTypeCheckEmit,
            newGraph: this.newGraph,
        };
    }
    determineInvalidatedFiles(priorGraph) {
        const isPublicApiAffected = new Set();
        // The first phase is to collect all symbols which have their public API affected. Any symbols
        // that cannot be matched up with a symbol from the prior graph are considered affected.
        for (const symbol of this.newGraph.symbolByDecl.values()) {
            const previousSymbol = priorGraph.getEquivalentSymbol(symbol);
            if (previousSymbol === null || symbol.isPublicApiAffected(previousSymbol)) {
                isPublicApiAffected.add(symbol);
            }
        }
        // The second phase is to find all symbols for which the emit result is affected, either because
        // their used declarations have changed or any of those used declarations has had its public API
        // affected as determined in the first phase.
        const needsEmit = new Set();
        for (const symbol of this.newGraph.symbolByDecl.values()) {
            if (symbol.isEmitAffected === undefined) {
                continue;
            }
            const previousSymbol = priorGraph.getEquivalentSymbol(symbol);
            if (previousSymbol === null || symbol.isEmitAffected(previousSymbol, isPublicApiAffected)) {
                needsEmit.add(symbol.path);
            }
        }
        return needsEmit;
    }
    determineInvalidatedTypeCheckFiles(priorGraph) {
        const isTypeCheckApiAffected = new Set();
        // The first phase is to collect all symbols which have their public API affected. Any symbols
        // that cannot be matched up with a symbol from the prior graph are considered affected.
        for (const symbol of this.newGraph.symbolByDecl.values()) {
            const previousSymbol = priorGraph.getEquivalentSymbol(symbol);
            if (previousSymbol === null || symbol.isTypeCheckApiAffected(previousSymbol)) {
                isTypeCheckApiAffected.add(symbol);
            }
        }
        // The second phase is to find all symbols for which the emit result is affected, either because
        // their used declarations have changed or any of those used declarations has had its public API
        // affected as determined in the first phase.
        const needsTypeCheckEmit = new Set();
        for (const symbol of this.newGraph.symbolByDecl.values()) {
            if (symbol.isTypeCheckBlockAffected === undefined) {
                continue;
            }
            const previousSymbol = priorGraph.getEquivalentSymbol(symbol);
            if (previousSymbol === null ||
                symbol.isTypeCheckBlockAffected(previousSymbol, isTypeCheckApiAffected)) {
                needsTypeCheckEmit.add(symbol.path);
            }
        }
        return needsTypeCheckEmit;
    }
    /**
     * Creates a `SemanticReference` for the reference to `decl` using the expression `expr`. See
     * the documentation of `SemanticReference` for details.
     */
    getSemanticReference(decl, expr) {
        return {
            symbol: this.getSymbol(decl),
            importPath: getImportPath(expr),
        };
    }
    /**
     * Gets the `SemanticSymbol` that was registered for `decl` during the current compilation, or
     * returns an opaque symbol that represents `decl`.
     */
    getSymbol(decl) {
        const symbol = this.newGraph.getSymbolByDecl(decl);
        if (symbol === null) {
            // No symbol has been recorded for the provided declaration, which would be the case if the
            // declaration is external. Return an opaque symbol in that case, to allow the external
            // declaration to be compared to a prior compilation.
            return this.getOpaqueSymbol(decl);
        }
        return symbol;
    }
    /**
     * Gets or creates an `OpaqueSymbol` for the provided class declaration.
     */
    getOpaqueSymbol(decl) {
        if (this.opaqueSymbols.has(decl)) {
            return this.opaqueSymbols.get(decl);
        }
        const symbol = new OpaqueSymbol(decl);
        this.opaqueSymbols.set(decl, symbol);
        return symbol;
    }
}
function getImportPath(expr) {
    if (expr instanceof ExternalExpr) {
        return `${expr.value.moduleName}\$${expr.value.name}`;
    }
    else {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2luY3JlbWVudGFsL3NlbWFudGljX2dyYXBoL3NyYy9ncmFwaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQWEsWUFBWSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFHM0QsT0FBTyxFQUFvQixjQUFjLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFtQnhEOzs7OztHQUtHO0FBQ0gsTUFBTSxZQUFhLFNBQVEsY0FBYztJQUN2QyxtQkFBbUI7UUFDakIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsc0JBQXNCO1FBQ3BCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sZ0JBQWdCO0lBQTdCO1FBQ1csVUFBSyxHQUFHLElBQUksR0FBRyxFQUErQyxDQUFDO1FBQy9ELGlCQUFZLEdBQUcsSUFBSSxHQUFHLEVBQW9DLENBQUM7SUFtRXRFLENBQUM7SUFqRUM7Ozs7O09BS0c7SUFDSCxjQUFjLENBQUMsTUFBc0I7UUFDbkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUzQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO1lBQzlCLDhGQUE4RjtZQUM5RixpREFBaUQ7WUFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBMEIsQ0FBQyxDQUFDO2FBQ2hFO1lBQ0QsSUFBSSxDQUFDLEtBQUssQ0FB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QTJGO1lBQzNGLHVGQUF1RjtZQUN2RixxREFBcUQ7WUFDckQsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ25DO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZUFBZSxDQUFDLElBQXNCO1FBQzVDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUUsQ0FBQztTQUN0QztRQUVELE1BQU0sTUFBTSxHQUFHLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNyQyxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUFFRCxTQUFTLGFBQWEsQ0FBQyxJQUFnQjtJQUNyQyxJQUFJLElBQUksWUFBWSxZQUFZLEVBQUU7UUFDaEMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDdkQ7U0FBTTtRQUNMLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7RXhwcmVzc2lvbiwgRXh0ZXJuYWxFeHByfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQge0Fic29sdXRlRnNQYXRofSBmcm9tICcuLi8uLi8uLi9maWxlX3N5c3RlbSc7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb259IGZyb20gJy4uLy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtTZW1hbnRpY1JlZmVyZW5jZSwgU2VtYW50aWNTeW1ib2x9IGZyb20gJy4vYXBpJztcblxuZXhwb3J0IGludGVyZmFjZSBTZW1hbnRpY0RlcGVuZGVuY3lSZXN1bHQge1xuICAvKipcbiAgICogVGhlIGZpbGVzIHRoYXQgbmVlZCB0byBiZSByZS1lbWl0dGVkLlxuICAgKi9cbiAgbmVlZHNFbWl0OiBTZXQ8QWJzb2x1dGVGc1BhdGg+O1xuXG4gIC8qKlxuICAgKiBUaGUgZmlsZXMgZm9yIHdoaWNoIHRoZSB0eXBlLWNoZWNrIGJsb2NrIHNob3VsZCBiZSByZWdlbmVyYXRlZC5cbiAgICovXG4gIG5lZWRzVHlwZUNoZWNrRW1pdDogU2V0PEFic29sdXRlRnNQYXRoPjtcblxuICAvKipcbiAgICogVGhlIG5ld2x5IGJ1aWx0IGdyYXBoIHRoYXQgcmVwcmVzZW50cyB0aGUgY3VycmVudCBjb21waWxhdGlvbi5cbiAgICovXG4gIG5ld0dyYXBoOiBTZW1hbnRpY0RlcEdyYXBoO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBkZWNsYXJhdGlvbiBmb3Igd2hpY2ggbm8gc2VtYW50aWMgc3ltYm9sIGhhcyBiZWVuIHJlZ2lzdGVyZWQuIEZvciBleGFtcGxlLFxuICogZGVjbGFyYXRpb25zIGZyb20gZXh0ZXJuYWwgZGVwZW5kZW5jaWVzIGhhdmUgbm90IGJlZW4gZXhwbGljaXRseSByZWdpc3RlcmVkIGFuZCBhcmUgcmVwcmVzZW50ZWRcbiAqIGJ5IHRoaXMgc3ltYm9sLiBUaGlzIGFsbG93cyB0aGUgdW5yZXNvbHZlZCBzeW1ib2wgdG8gc3RpbGwgYmUgY29tcGFyZWQgdG8gYSBzeW1ib2wgZnJvbSBhIHByaW9yXG4gKiBjb21waWxhdGlvbi5cbiAqL1xuY2xhc3MgT3BhcXVlU3ltYm9sIGV4dGVuZHMgU2VtYW50aWNTeW1ib2wge1xuICBpc1B1YmxpY0FwaUFmZmVjdGVkKCk6IGZhbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpc1R5cGVDaGVja0FwaUFmZmVjdGVkKCk6IGZhbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgc2VtYW50aWMgZGVwZW5kZW5jeSBncmFwaCBvZiBhIHNpbmdsZSBjb21waWxhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIFNlbWFudGljRGVwR3JhcGgge1xuICByZWFkb25seSBmaWxlcyA9IG5ldyBNYXA8QWJzb2x1dGVGc1BhdGgsIE1hcDxzdHJpbmcsIFNlbWFudGljU3ltYm9sPj4oKTtcbiAgcmVhZG9ubHkgc3ltYm9sQnlEZWNsID0gbmV3IE1hcDxDbGFzc0RlY2xhcmF0aW9uLCBTZW1hbnRpY1N5bWJvbD4oKTtcblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgc3ltYm9sIGluIHRoZSBncmFwaC4gVGhlIHN5bWJvbCBpcyBnaXZlbiBhIHVuaXF1ZSBpZGVudGlmaWVyIGlmIHBvc3NpYmxlLCBzdWNoIHRoYXRcbiAgICogaXRzIGVxdWl2YWxlbnQgc3ltYm9sIGNhbiBiZSBvYnRhaW5lZCBmcm9tIGEgcHJpb3IgZ3JhcGggZXZlbiBpZiBpdHMgZGVjbGFyYXRpb24gbm9kZSBoYXNcbiAgICogY2hhbmdlZCBhY3Jvc3MgcmVidWlsZHMuIFN5bWJvbHMgd2l0aG91dCBhbiBpZGVudGlmaWVyIGFyZSBvbmx5IGFibGUgdG8gZmluZCB0aGVtc2VsdmVzIGluIGFcbiAgICogcHJpb3IgZ3JhcGggaWYgdGhlaXIgZGVjbGFyYXRpb24gbm9kZSBpcyBpZGVudGljYWwuXG4gICAqL1xuICByZWdpc3RlclN5bWJvbChzeW1ib2w6IFNlbWFudGljU3ltYm9sKTogdm9pZCB7XG4gICAgdGhpcy5zeW1ib2xCeURlY2wuc2V0KHN5bWJvbC5kZWNsLCBzeW1ib2wpO1xuXG4gICAgaWYgKHN5bWJvbC5pZGVudGlmaWVyICE9PSBudWxsKSB7XG4gICAgICAvLyBJZiB0aGUgc3ltYm9sIGhhcyBhIHVuaXF1ZSBpZGVudGlmaWVyLCByZWNvcmQgaXQgaW4gdGhlIGZpbGUgdGhhdCBkZWNsYXJlcyBpdC4gVGhpcyBlbmFibGVzXG4gICAgICAvLyB0aGUgc3ltYm9sIHRvIGJlIHJlcXVlc3RlZCBieSBpdHMgdW5pcXVlIG5hbWUuXG4gICAgICBpZiAoIXRoaXMuZmlsZXMuaGFzKHN5bWJvbC5wYXRoKSkge1xuICAgICAgICB0aGlzLmZpbGVzLnNldChzeW1ib2wucGF0aCwgbmV3IE1hcDxzdHJpbmcsIFNlbWFudGljU3ltYm9sPigpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZmlsZXMuZ2V0KHN5bWJvbC5wYXRoKSEuc2V0KHN5bWJvbC5pZGVudGlmaWVyLCBzeW1ib2wpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRlbXB0cyB0byByZXNvbHZlIGEgc3ltYm9sIGluIHRoaXMgZ3JhcGggdGhhdCByZXByZXNlbnRzIHRoZSBnaXZlbiBzeW1ib2wgZnJvbSBhbm90aGVyIGdyYXBoLlxuICAgKiBJZiBubyBtYXRjaGluZyBzeW1ib2wgY291bGQgYmUgZm91bmQsIG51bGwgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIEBwYXJhbSBzeW1ib2wgVGhlIHN5bWJvbCBmcm9tIGFub3RoZXIgZ3JhcGggZm9yIHdoaWNoIGl0cyBlcXVpdmFsZW50IGluIHRoaXMgZ3JhcGggc2hvdWxkIGJlXG4gICAqIGZvdW5kLlxuICAgKi9cbiAgZ2V0RXF1aXZhbGVudFN5bWJvbChzeW1ib2w6IFNlbWFudGljU3ltYm9sKTogU2VtYW50aWNTeW1ib2x8bnVsbCB7XG4gICAgLy8gRmlyc3QgbG9va3VwIHRoZSBzeW1ib2wgYnkgaXRzIGRlY2xhcmF0aW9uLiBJdCBpcyB0eXBpY2FsIGZvciB0aGUgZGVjbGFyYXRpb24gdG8gbm90IGhhdmVcbiAgICAvLyBjaGFuZ2VkIGFjcm9zcyByZWJ1aWxkcywgc28gdGhpcyBpcyBsaWtlbHkgdG8gZmluZCB0aGUgc3ltYm9sLiBVc2luZyB0aGUgZGVjbGFyYXRpb24gYWxzb1xuICAgIC8vIGFsbG93cyB0byBkaWZmIHN5bWJvbHMgZm9yIHdoaWNoIG5vIHVuaXF1ZSBpZGVudGlmaWVyIGNvdWxkIGJlIGRldGVybWluZWQuXG4gICAgbGV0IHByZXZpb3VzU3ltYm9sID0gdGhpcy5nZXRTeW1ib2xCeURlY2woc3ltYm9sLmRlY2wpO1xuICAgIGlmIChwcmV2aW91c1N5bWJvbCA9PT0gbnVsbCAmJiBzeW1ib2wuaWRlbnRpZmllciAhPT0gbnVsbCkge1xuICAgICAgLy8gVGhlIGRlY2xhcmF0aW9uIGNvdWxkIG5vdCBiZSByZXNvbHZlZCB0byBhIHN5bWJvbCBpbiBhIHByaW9yIGNvbXBpbGF0aW9uLCB3aGljaCBtYXlcbiAgICAgIC8vIGhhcHBlbiBiZWNhdXNlIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGRlY2xhcmF0aW9uIGhhcyBjaGFuZ2VkLiBJbiB0aGF0IGNhc2Ugd2Ugd2FudCB0b1xuICAgICAgLy8gbG9va3VwIHRoZSBzeW1ib2wgYmFzZWQgb24gaXRzIHVuaXF1ZSBpZGVudGlmaWVyLCBhcyB0aGF0IGFsbG93cyB1cyB0byBzdGlsbCBjb21wYXJlIHRoZVxuICAgICAgLy8gY2hhbmdlZCBkZWNsYXJhdGlvbiB0byB0aGUgcHJpb3IgY29tcGlsYXRpb24uXG4gICAgICBwcmV2aW91c1N5bWJvbCA9IHRoaXMuZ2V0U3ltYm9sQnlOYW1lKHN5bWJvbC5wYXRoLCBzeW1ib2wuaWRlbnRpZmllcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByZXZpb3VzU3ltYm9sO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGZpbmQgdGhlIHN5bWJvbCBieSBpdHMgaWRlbnRpZmllci5cbiAgICovXG4gIHByaXZhdGUgZ2V0U3ltYm9sQnlOYW1lKHBhdGg6IEFic29sdXRlRnNQYXRoLCBpZGVudGlmaWVyOiBzdHJpbmcpOiBTZW1hbnRpY1N5bWJvbHxudWxsIHtcbiAgICBpZiAoIXRoaXMuZmlsZXMuaGFzKHBhdGgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuZmlsZXMuZ2V0KHBhdGgpITtcbiAgICBpZiAoIWZpbGUuaGFzKGlkZW50aWZpZXIpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGZpbGUuZ2V0KGlkZW50aWZpZXIpITtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRlbXB0cyB0byByZXNvbHZlIHRoZSBkZWNsYXJhdGlvbiB0byBpdHMgc2VtYW50aWMgc3ltYm9sLlxuICAgKi9cbiAgZ2V0U3ltYm9sQnlEZWNsKGRlY2w6IENsYXNzRGVjbGFyYXRpb24pOiBTZW1hbnRpY1N5bWJvbHxudWxsIHtcbiAgICBpZiAoIXRoaXMuc3ltYm9sQnlEZWNsLmhhcyhkZWNsKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnN5bWJvbEJ5RGVjbC5nZXQoZGVjbCkhO1xuICB9XG59XG5cbi8qKlxuICogSW1wbGVtZW50cyB0aGUgbG9naWMgdG8gZ28gZnJvbSBhIHByZXZpb3VzIGRlcGVuZGVuY3kgZ3JhcGggdG8gYSBuZXcgb25lLCBhbG9uZyB3aXRoIGluZm9ybWF0aW9uXG4gKiBvbiB3aGljaCBmaWxlcyBoYXZlIGJlZW4gYWZmZWN0ZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBTZW1hbnRpY0RlcEdyYXBoVXBkYXRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgbmV3R3JhcGggPSBuZXcgU2VtYW50aWNEZXBHcmFwaCgpO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBvcGFxdWUgc3ltYm9scyB0aGF0IHdlcmUgY3JlYXRlZCBmb3IgZGVjbGFyYXRpb25zIGZvciB3aGljaCB0aGVyZSB3YXMgbm8gc3ltYm9sXG4gICAqIHJlZ2lzdGVyZWQsIHdoaWNoIGhhcHBlbnMgZm9yIGUuZy4gZXh0ZXJuYWwgZGVjbGFyYXRpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBvcGFxdWVTeW1ib2xzID0gbmV3IE1hcDxDbGFzc0RlY2xhcmF0aW9uLCBPcGFxdWVTeW1ib2w+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICAvKipcbiAgICAgICAqIFRoZSBzZW1hbnRpYyBkZXBlbmRlbmN5IGdyYXBoIG9mIHRoZSBtb3N0IHJlY2VudGx5IHN1Y2NlZWRlZCBjb21waWxhdGlvbiwgb3IgbnVsbCBpZiB0aGlzXG4gICAgICAgKiBpcyB0aGUgaW5pdGlhbCBidWlsZC5cbiAgICAgICAqL1xuICAgICAgcHJpdmF0ZSBwcmlvckdyYXBoOiBTZW1hbnRpY0RlcEdyYXBofG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgc3ltYm9sIGluIHRoZSBuZXcgZ3JhcGggdGhhdCBpcyBiZWluZyBjcmVhdGVkLlxuICAgKi9cbiAgcmVnaXN0ZXJTeW1ib2woc3ltYm9sOiBTZW1hbnRpY1N5bWJvbCk6IHZvaWQge1xuICAgIHRoaXMubmV3R3JhcGgucmVnaXN0ZXJTeW1ib2woc3ltYm9sKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUYWtlcyBhbGwgZmFjdHMgdGhhdCBoYXZlIGJlZW4gZ2F0aGVyZWQgdG8gY3JlYXRlIGEgbmV3IHNlbWFudGljIGRlcGVuZGVuY3kgZ3JhcGguIEluIHRoaXNcbiAgICogcHJvY2VzcywgdGhlIHNlbWFudGljIGltcGFjdCBvZiB0aGUgY2hhbmdlcyBpcyBkZXRlcm1pbmVkIHdoaWNoIHJlc3VsdHMgaW4gYSBzZXQgb2YgZmlsZXMgdGhhdFxuICAgKiBuZWVkIHRvIGJlIGVtaXR0ZWQgYW5kL29yIHR5cGUtY2hlY2tlZC5cbiAgICovXG4gIGZpbmFsaXplKCk6IFNlbWFudGljRGVwZW5kZW5jeVJlc3VsdCB7XG4gICAgaWYgKHRoaXMucHJpb3JHcmFwaCA9PT0gbnVsbCkge1xuICAgICAgLy8gSWYgbm8gcHJpb3IgZGVwZW5kZW5jeSBncmFwaCBpcyBhdmFpbGFibGUgdGhlbiB0aGlzIHdhcyB0aGUgaW5pdGlhbCBidWlsZCwgaW4gd2hpY2ggY2FzZVxuICAgICAgLy8gd2UgZG9uJ3QgbmVlZCB0byBkZXRlcm1pbmUgdGhlIHNlbWFudGljIGltcGFjdCBhcyBldmVyeXRoaW5nIGlzIGFscmVhZHkgY29uc2lkZXJlZFxuICAgICAgLy8gbG9naWNhbGx5IGNoYW5nZWQuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuZWVkc0VtaXQ6IG5ldyBTZXQ8QWJzb2x1dGVGc1BhdGg+KCksXG4gICAgICAgIG5lZWRzVHlwZUNoZWNrRW1pdDogbmV3IFNldDxBYnNvbHV0ZUZzUGF0aD4oKSxcbiAgICAgICAgbmV3R3JhcGg6IHRoaXMubmV3R3JhcGgsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IG5lZWRzRW1pdCA9IHRoaXMuZGV0ZXJtaW5lSW52YWxpZGF0ZWRGaWxlcyh0aGlzLnByaW9yR3JhcGgpO1xuICAgIGNvbnN0IG5lZWRzVHlwZUNoZWNrRW1pdCA9IHRoaXMuZGV0ZXJtaW5lSW52YWxpZGF0ZWRUeXBlQ2hlY2tGaWxlcyh0aGlzLnByaW9yR3JhcGgpO1xuICAgIHJldHVybiB7XG4gICAgICBuZWVkc0VtaXQsXG4gICAgICBuZWVkc1R5cGVDaGVja0VtaXQsXG4gICAgICBuZXdHcmFwaDogdGhpcy5uZXdHcmFwaCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBkZXRlcm1pbmVJbnZhbGlkYXRlZEZpbGVzKHByaW9yR3JhcGg6IFNlbWFudGljRGVwR3JhcGgpOiBTZXQ8QWJzb2x1dGVGc1BhdGg+IHtcbiAgICBjb25zdCBpc1B1YmxpY0FwaUFmZmVjdGVkID0gbmV3IFNldDxTZW1hbnRpY1N5bWJvbD4oKTtcblxuICAgIC8vIFRoZSBmaXJzdCBwaGFzZSBpcyB0byBjb2xsZWN0IGFsbCBzeW1ib2xzIHdoaWNoIGhhdmUgdGhlaXIgcHVibGljIEFQSSBhZmZlY3RlZC4gQW55IHN5bWJvbHNcbiAgICAvLyB0aGF0IGNhbm5vdCBiZSBtYXRjaGVkIHVwIHdpdGggYSBzeW1ib2wgZnJvbSB0aGUgcHJpb3IgZ3JhcGggYXJlIGNvbnNpZGVyZWQgYWZmZWN0ZWQuXG4gICAgZm9yIChjb25zdCBzeW1ib2wgb2YgdGhpcy5uZXdHcmFwaC5zeW1ib2xCeURlY2wudmFsdWVzKCkpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzU3ltYm9sID0gcHJpb3JHcmFwaC5nZXRFcXVpdmFsZW50U3ltYm9sKHN5bWJvbCk7XG4gICAgICBpZiAocHJldmlvdXNTeW1ib2wgPT09IG51bGwgfHwgc3ltYm9sLmlzUHVibGljQXBpQWZmZWN0ZWQocHJldmlvdXNTeW1ib2wpKSB7XG4gICAgICAgIGlzUHVibGljQXBpQWZmZWN0ZWQuYWRkKHN5bWJvbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVGhlIHNlY29uZCBwaGFzZSBpcyB0byBmaW5kIGFsbCBzeW1ib2xzIGZvciB3aGljaCB0aGUgZW1pdCByZXN1bHQgaXMgYWZmZWN0ZWQsIGVpdGhlciBiZWNhdXNlXG4gICAgLy8gdGhlaXIgdXNlZCBkZWNsYXJhdGlvbnMgaGF2ZSBjaGFuZ2VkIG9yIGFueSBvZiB0aG9zZSB1c2VkIGRlY2xhcmF0aW9ucyBoYXMgaGFkIGl0cyBwdWJsaWMgQVBJXG4gICAgLy8gYWZmZWN0ZWQgYXMgZGV0ZXJtaW5lZCBpbiB0aGUgZmlyc3QgcGhhc2UuXG4gICAgY29uc3QgbmVlZHNFbWl0ID0gbmV3IFNldDxBYnNvbHV0ZUZzUGF0aD4oKTtcbiAgICBmb3IgKGNvbnN0IHN5bWJvbCBvZiB0aGlzLm5ld0dyYXBoLnN5bWJvbEJ5RGVjbC52YWx1ZXMoKSkge1xuICAgICAgaWYgKHN5bWJvbC5pc0VtaXRBZmZlY3RlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwcmV2aW91c1N5bWJvbCA9IHByaW9yR3JhcGguZ2V0RXF1aXZhbGVudFN5bWJvbChzeW1ib2wpO1xuICAgICAgaWYgKHByZXZpb3VzU3ltYm9sID09PSBudWxsIHx8IHN5bWJvbC5pc0VtaXRBZmZlY3RlZChwcmV2aW91c1N5bWJvbCwgaXNQdWJsaWNBcGlBZmZlY3RlZCkpIHtcbiAgICAgICAgbmVlZHNFbWl0LmFkZChzeW1ib2wucGF0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lZWRzRW1pdDtcbiAgfVxuXG4gIHByaXZhdGUgZGV0ZXJtaW5lSW52YWxpZGF0ZWRUeXBlQ2hlY2tGaWxlcyhwcmlvckdyYXBoOiBTZW1hbnRpY0RlcEdyYXBoKTogU2V0PEFic29sdXRlRnNQYXRoPiB7XG4gICAgY29uc3QgaXNUeXBlQ2hlY2tBcGlBZmZlY3RlZCA9IG5ldyBTZXQ8U2VtYW50aWNTeW1ib2w+KCk7XG5cbiAgICAvLyBUaGUgZmlyc3QgcGhhc2UgaXMgdG8gY29sbGVjdCBhbGwgc3ltYm9scyB3aGljaCBoYXZlIHRoZWlyIHB1YmxpYyBBUEkgYWZmZWN0ZWQuIEFueSBzeW1ib2xzXG4gICAgLy8gdGhhdCBjYW5ub3QgYmUgbWF0Y2hlZCB1cCB3aXRoIGEgc3ltYm9sIGZyb20gdGhlIHByaW9yIGdyYXBoIGFyZSBjb25zaWRlcmVkIGFmZmVjdGVkLlxuICAgIGZvciAoY29uc3Qgc3ltYm9sIG9mIHRoaXMubmV3R3JhcGguc3ltYm9sQnlEZWNsLnZhbHVlcygpKSB7XG4gICAgICBjb25zdCBwcmV2aW91c1N5bWJvbCA9IHByaW9yR3JhcGguZ2V0RXF1aXZhbGVudFN5bWJvbChzeW1ib2wpO1xuICAgICAgaWYgKHByZXZpb3VzU3ltYm9sID09PSBudWxsIHx8IHN5bWJvbC5pc1R5cGVDaGVja0FwaUFmZmVjdGVkKHByZXZpb3VzU3ltYm9sKSkge1xuICAgICAgICBpc1R5cGVDaGVja0FwaUFmZmVjdGVkLmFkZChzeW1ib2wpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRoZSBzZWNvbmQgcGhhc2UgaXMgdG8gZmluZCBhbGwgc3ltYm9scyBmb3Igd2hpY2ggdGhlIGVtaXQgcmVzdWx0IGlzIGFmZmVjdGVkLCBlaXRoZXIgYmVjYXVzZVxuICAgIC8vIHRoZWlyIHVzZWQgZGVjbGFyYXRpb25zIGhhdmUgY2hhbmdlZCBvciBhbnkgb2YgdGhvc2UgdXNlZCBkZWNsYXJhdGlvbnMgaGFzIGhhZCBpdHMgcHVibGljIEFQSVxuICAgIC8vIGFmZmVjdGVkIGFzIGRldGVybWluZWQgaW4gdGhlIGZpcnN0IHBoYXNlLlxuICAgIGNvbnN0IG5lZWRzVHlwZUNoZWNrRW1pdCA9IG5ldyBTZXQ8QWJzb2x1dGVGc1BhdGg+KCk7XG4gICAgZm9yIChjb25zdCBzeW1ib2wgb2YgdGhpcy5uZXdHcmFwaC5zeW1ib2xCeURlY2wudmFsdWVzKCkpIHtcbiAgICAgIGlmIChzeW1ib2wuaXNUeXBlQ2hlY2tCbG9ja0FmZmVjdGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByZXZpb3VzU3ltYm9sID0gcHJpb3JHcmFwaC5nZXRFcXVpdmFsZW50U3ltYm9sKHN5bWJvbCk7XG4gICAgICBpZiAocHJldmlvdXNTeW1ib2wgPT09IG51bGwgfHxcbiAgICAgICAgICBzeW1ib2wuaXNUeXBlQ2hlY2tCbG9ja0FmZmVjdGVkKHByZXZpb3VzU3ltYm9sLCBpc1R5cGVDaGVja0FwaUFmZmVjdGVkKSkge1xuICAgICAgICBuZWVkc1R5cGVDaGVja0VtaXQuYWRkKHN5bWJvbC5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmVlZHNUeXBlQ2hlY2tFbWl0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBgU2VtYW50aWNSZWZlcmVuY2VgIGZvciB0aGUgcmVmZXJlbmNlIHRvIGBkZWNsYCB1c2luZyB0aGUgZXhwcmVzc2lvbiBgZXhwcmAuIFNlZVxuICAgKiB0aGUgZG9jdW1lbnRhdGlvbiBvZiBgU2VtYW50aWNSZWZlcmVuY2VgIGZvciBkZXRhaWxzLlxuICAgKi9cbiAgZ2V0U2VtYW50aWNSZWZlcmVuY2UoZGVjbDogQ2xhc3NEZWNsYXJhdGlvbiwgZXhwcjogRXhwcmVzc2lvbik6IFNlbWFudGljUmVmZXJlbmNlIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3ltYm9sOiB0aGlzLmdldFN5bWJvbChkZWNsKSxcbiAgICAgIGltcG9ydFBhdGg6IGdldEltcG9ydFBhdGgoZXhwciksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBgU2VtYW50aWNTeW1ib2xgIHRoYXQgd2FzIHJlZ2lzdGVyZWQgZm9yIGBkZWNsYCBkdXJpbmcgdGhlIGN1cnJlbnQgY29tcGlsYXRpb24sIG9yXG4gICAqIHJldHVybnMgYW4gb3BhcXVlIHN5bWJvbCB0aGF0IHJlcHJlc2VudHMgYGRlY2xgLlxuICAgKi9cbiAgZ2V0U3ltYm9sKGRlY2w6IENsYXNzRGVjbGFyYXRpb24pOiBTZW1hbnRpY1N5bWJvbCB7XG4gICAgY29uc3Qgc3ltYm9sID0gdGhpcy5uZXdHcmFwaC5nZXRTeW1ib2xCeURlY2woZGVjbCk7XG4gICAgaWYgKHN5bWJvbCA9PT0gbnVsbCkge1xuICAgICAgLy8gTm8gc3ltYm9sIGhhcyBiZWVuIHJlY29yZGVkIGZvciB0aGUgcHJvdmlkZWQgZGVjbGFyYXRpb24sIHdoaWNoIHdvdWxkIGJlIHRoZSBjYXNlIGlmIHRoZVxuICAgICAgLy8gZGVjbGFyYXRpb24gaXMgZXh0ZXJuYWwuIFJldHVybiBhbiBvcGFxdWUgc3ltYm9sIGluIHRoYXQgY2FzZSwgdG8gYWxsb3cgdGhlIGV4dGVybmFsXG4gICAgICAvLyBkZWNsYXJhdGlvbiB0byBiZSBjb21wYXJlZCB0byBhIHByaW9yIGNvbXBpbGF0aW9uLlxuICAgICAgcmV0dXJuIHRoaXMuZ2V0T3BhcXVlU3ltYm9sKGRlY2wpO1xuICAgIH1cbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgb3IgY3JlYXRlcyBhbiBgT3BhcXVlU3ltYm9sYCBmb3IgdGhlIHByb3ZpZGVkIGNsYXNzIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRPcGFxdWVTeW1ib2woZGVjbDogQ2xhc3NEZWNsYXJhdGlvbik6IE9wYXF1ZVN5bWJvbCB7XG4gICAgaWYgKHRoaXMub3BhcXVlU3ltYm9scy5oYXMoZGVjbCkpIHtcbiAgICAgIHJldHVybiB0aGlzLm9wYXF1ZVN5bWJvbHMuZ2V0KGRlY2wpITtcbiAgICB9XG5cbiAgICBjb25zdCBzeW1ib2wgPSBuZXcgT3BhcXVlU3ltYm9sKGRlY2wpO1xuICAgIHRoaXMub3BhcXVlU3ltYm9scy5zZXQoZGVjbCwgc3ltYm9sKTtcbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEltcG9ydFBhdGgoZXhwcjogRXhwcmVzc2lvbik6IHN0cmluZ3xudWxsIHtcbiAgaWYgKGV4cHIgaW5zdGFuY2VvZiBFeHRlcm5hbEV4cHIpIHtcbiAgICByZXR1cm4gYCR7ZXhwci52YWx1ZS5tb2R1bGVOYW1lfVxcJCR7ZXhwci52YWx1ZS5uYW1lfWA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdfQ==