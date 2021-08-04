import { forwardRefResolver } from '../../../src/ngtsc/annotations';
import { Reference } from '../../../src/ngtsc/imports';
import { createInjectableDecorator, isClassDeclaration } from './utils';
/**
 * Ensures that classes that are provided as an Angular service in either `NgModule.providers` or
 * `Directive.providers`/`Component.viewProviders` are decorated with one of the `@Injectable`,
 * `@Directive`, `@Component` or `@Pipe` decorators, adding an `@Injectable()` decorator when none
 * are present.
 *
 * At least one decorator is now mandatory, as otherwise the compiler would not compile an
 * injectable definition for the service. This is unlike View Engine, where having just an unrelated
 * decorator may have been sufficient for the service to become injectable.
 *
 * In essence, this migration operates on classes that are themselves an NgModule, Directive or
 * Component. Their metadata is statically evaluated so that their "providers"/"viewProviders"
 * properties can be analyzed. For any provider that refers to an undecorated class, the class will
 * be migrated to have an `@Injectable()` decorator.
 *
 * This implementation mirrors the "missing-injectable" schematic.
 */
export class MissingInjectableMigration {
    apply(clazz, host) {
        const decorators = host.reflectionHost.getDecoratorsOfDeclaration(clazz);
        if (decorators === null) {
            return null;
        }
        for (const decorator of decorators) {
            const name = getAngularCoreDecoratorName(decorator);
            if (name === 'NgModule') {
                migrateNgModuleProviders(decorator, host);
            }
            else if (name === 'Directive') {
                migrateDirectiveProviders(decorator, host, /* isComponent */ false);
            }
            else if (name === 'Component') {
                migrateDirectiveProviders(decorator, host, /* isComponent */ true);
            }
        }
        return null;
    }
}
/**
 * Iterates through all `NgModule.providers` and adds the `@Injectable()` decorator to any provider
 * that is not otherwise decorated.
 */
function migrateNgModuleProviders(decorator, host) {
    if (decorator.args === null || decorator.args.length !== 1) {
        return;
    }
    const metadata = host.evaluator.evaluate(decorator.args[0], forwardRefResolver);
    if (!(metadata instanceof Map)) {
        return;
    }
    migrateProviders(metadata, 'providers', host);
    // TODO(alxhub): we should probably also check for `ModuleWithProviders` here.
}
/**
 * Iterates through all `Directive.providers` and if `isComponent` is set to true also
 * `Component.viewProviders` and adds the `@Injectable()` decorator to any provider that is not
 * otherwise decorated.
 */
function migrateDirectiveProviders(decorator, host, isComponent) {
    if (decorator.args === null || decorator.args.length !== 1) {
        return;
    }
    const metadata = host.evaluator.evaluate(decorator.args[0], forwardRefResolver);
    if (!(metadata instanceof Map)) {
        return;
    }
    migrateProviders(metadata, 'providers', host);
    if (isComponent) {
        migrateProviders(metadata, 'viewProviders', host);
    }
}
/**
 * Given an object with decorator metadata, iterates through the list of providers to add
 * `@Injectable()` to any provider that is not otherwise decorated.
 */
function migrateProviders(metadata, field, host) {
    if (!metadata.has(field)) {
        return;
    }
    const providers = metadata.get(field);
    if (!Array.isArray(providers)) {
        return;
    }
    for (const provider of providers) {
        migrateProvider(provider, host);
    }
}
/**
 * Analyzes a single provider entry and determines the class that is required to have an
 * `@Injectable()` decorator.
 */
function migrateProvider(provider, host) {
    if (provider instanceof Map) {
        if (!provider.has('provide') || provider.has('useValue') || provider.has('useFactory') ||
            provider.has('useExisting')) {
            return;
        }
        if (provider.has('useClass')) {
            // {provide: ..., useClass: SomeClass, deps: [...]} does not require a decorator on SomeClass,
            // as the provider itself configures 'deps'. Only if 'deps' is missing will this require a
            // factory to exist on SomeClass.
            if (!provider.has('deps')) {
                migrateProviderClass(provider.get('useClass'), host);
            }
        }
        else {
            migrateProviderClass(provider.get('provide'), host);
        }
    }
    else if (Array.isArray(provider)) {
        for (const v of provider) {
            migrateProvider(v, host);
        }
    }
    else {
        migrateProviderClass(provider, host);
    }
}
/**
 * Given a provider class, adds the `@Injectable()` decorator if no other relevant Angular decorator
 * is present on the class.
 */
function migrateProviderClass(provider, host) {
    // Providers that do not refer to a class cannot be migrated.
    if (!(provider instanceof Reference)) {
        return;
    }
    const clazz = provider.node;
    if (isClassDeclaration(clazz) && host.isInScope(clazz) && needsInjectableDecorator(clazz, host)) {
        host.injectSyntheticDecorator(clazz, createInjectableDecorator(clazz));
    }
}
const NO_MIGRATE_DECORATORS = new Set(['Injectable', 'Directive', 'Component', 'Pipe']);
/**
 * Determines if the given class needs to be decorated with `@Injectable()` based on whether it
 * already has an Angular decorator applied.
 */
function needsInjectableDecorator(clazz, host) {
    const decorators = host.getAllDecorators(clazz);
    if (decorators === null) {
        return true;
    }
    for (const decorator of decorators) {
        const name = getAngularCoreDecoratorName(decorator);
        if (name !== null && NO_MIGRATE_DECORATORS.has(name)) {
            return false;
        }
    }
    return true;
}
/**
 * Determines the original name of a decorator if it is from '@angular/core'. For other decorators,
 * null is returned.
 */
export function getAngularCoreDecoratorName(decorator) {
    if (decorator.import === null || decorator.import.from !== '@angular/core') {
        return null;
    }
    return decorator.import.name;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlzc2luZ19pbmplY3RhYmxlX21pZ3JhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9uZ2NjL3NyYy9taWdyYXRpb25zL21pc3NpbmdfaW5qZWN0YWJsZV9taWdyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBU0EsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDbEUsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBS3JELE9BQU8sRUFBQyx5QkFBeUIsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV0RTs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILE1BQU0sT0FBTywwQkFBMEI7SUFDckMsS0FBSyxDQUFDLEtBQXVCLEVBQUUsSUFBbUI7UUFDaEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6RSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDdkIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELEtBQUssTUFBTSxTQUFTLElBQUksVUFBVSxFQUFFO1lBQ2xDLE1BQU0sSUFBSSxHQUFHLDJCQUEyQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3BELElBQUksSUFBSSxLQUFLLFVBQVUsRUFBRTtnQkFDdkIsd0JBQXdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQzNDO2lCQUFNLElBQUksSUFBSSxLQUFLLFdBQVcsRUFBRTtnQkFDL0IseUJBQXlCLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNyRTtpQkFBTSxJQUFJLElBQUksS0FBSyxXQUFXLEVBQUU7Z0JBQy9CLHlCQUF5QixDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDcEU7U0FDRjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyx3QkFBd0IsQ0FBQyxTQUFvQixFQUFFLElBQW1CO0lBQ3pFLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzFELE9BQU87S0FDUjtJQUVELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNoRixJQUFJLENBQUMsQ0FBQyxRQUFRLFlBQVksR0FBRyxDQUFDLEVBQUU7UUFDOUIsT0FBTztLQUNSO0lBRUQsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5Qyw4RUFBOEU7QUFDaEYsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLHlCQUF5QixDQUM5QixTQUFvQixFQUFFLElBQW1CLEVBQUUsV0FBb0I7SUFDakUsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDMUQsT0FBTztLQUNSO0lBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQ2hGLElBQUksQ0FBQyxDQUFDLFFBQVEsWUFBWSxHQUFHLENBQUMsRUFBRTtRQUM5QixPQUFPO0tBQ1I7SUFFRCxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzlDLElBQUksV0FBVyxFQUFFO1FBQ2YsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUNuRDtBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLGdCQUFnQixDQUFDLFFBQTBCLEVBQUUsS0FBYSxFQUFFLElBQW1CO0lBQ3RGLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3hCLE9BQU87S0FDUjtJQUNELE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFFLENBQUM7SUFDdkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDN0IsT0FBTztLQUNSO0lBRUQsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUU7UUFDaEMsZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxRQUF1QixFQUFFLElBQW1CO0lBQ25FLElBQUksUUFBUSxZQUFZLEdBQUcsRUFBRTtRQUMzQixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1lBQ2xGLFFBQVEsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDL0IsT0FBTztTQUNSO1FBQ0QsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQzVCLDhGQUE4RjtZQUM5RiwwRkFBMEY7WUFDMUYsaUNBQWlDO1lBQ2pDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN6QixvQkFBb0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBRSxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ3ZEO1NBQ0Y7YUFBTTtZQUNMLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDdEQ7S0FDRjtTQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNsQyxLQUFLLE1BQU0sQ0FBQyxJQUFJLFFBQVEsRUFBRTtZQUN4QixlQUFlLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzFCO0tBQ0Y7U0FBTTtRQUNMLG9CQUFvQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUN0QztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLG9CQUFvQixDQUFDLFFBQXVCLEVBQUUsSUFBbUI7SUFDeEUsNkRBQTZEO0lBQzdELElBQUksQ0FBQyxDQUFDLFFBQVEsWUFBWSxTQUFTLENBQUMsRUFBRTtRQUNwQyxPQUFPO0tBQ1I7SUFFRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBQzVCLElBQUksa0JBQWtCLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSx3QkFBd0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUU7UUFDL0YsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSx5QkFBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3hFO0FBQ0gsQ0FBQztBQUVELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBRXhGOzs7R0FHRztBQUNILFNBQVMsd0JBQXdCLENBQUMsS0FBdUIsRUFBRSxJQUFtQjtJQUM1RSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEQsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtRQUNsQyxNQUFNLElBQUksR0FBRywyQkFBMkIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRCxJQUFJLElBQUksS0FBSyxJQUFJLElBQUkscUJBQXFCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3BELE9BQU8sS0FBSyxDQUFDO1NBQ2Q7S0FDRjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxTQUFvQjtJQUM5RCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssSUFBSSxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLGVBQWUsRUFBRTtRQUMxRSxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUMvQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtmb3J3YXJkUmVmUmVzb2x2ZXJ9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucyc7XG5pbXBvcnQge1JlZmVyZW5jZX0gZnJvbSAnLi4vLi4vLi4vc3JjL25ndHNjL2ltcG9ydHMnO1xuaW1wb3J0IHtSZXNvbHZlZFZhbHVlLCBSZXNvbHZlZFZhbHVlTWFwfSBmcm9tICcuLi8uLi8uLi9zcmMvbmd0c2MvcGFydGlhbF9ldmFsdWF0b3InO1xuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBEZWNvcmF0b3J9IGZyb20gJy4uLy4uLy4uL3NyYy9uZ3RzYy9yZWZsZWN0aW9uJztcblxuaW1wb3J0IHtNaWdyYXRpb24sIE1pZ3JhdGlvbkhvc3R9IGZyb20gJy4vbWlncmF0aW9uJztcbmltcG9ydCB7Y3JlYXRlSW5qZWN0YWJsZURlY29yYXRvciwgaXNDbGFzc0RlY2xhcmF0aW9ufSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBFbnN1cmVzIHRoYXQgY2xhc3NlcyB0aGF0IGFyZSBwcm92aWRlZCBhcyBhbiBBbmd1bGFyIHNlcnZpY2UgaW4gZWl0aGVyIGBOZ01vZHVsZS5wcm92aWRlcnNgIG9yXG4gKiBgRGlyZWN0aXZlLnByb3ZpZGVyc2AvYENvbXBvbmVudC52aWV3UHJvdmlkZXJzYCBhcmUgZGVjb3JhdGVkIHdpdGggb25lIG9mIHRoZSBgQEluamVjdGFibGVgLFxuICogYEBEaXJlY3RpdmVgLCBgQENvbXBvbmVudGAgb3IgYEBQaXBlYCBkZWNvcmF0b3JzLCBhZGRpbmcgYW4gYEBJbmplY3RhYmxlKClgIGRlY29yYXRvciB3aGVuIG5vbmVcbiAqIGFyZSBwcmVzZW50LlxuICpcbiAqIEF0IGxlYXN0IG9uZSBkZWNvcmF0b3IgaXMgbm93IG1hbmRhdG9yeSwgYXMgb3RoZXJ3aXNlIHRoZSBjb21waWxlciB3b3VsZCBub3QgY29tcGlsZSBhblxuICogaW5qZWN0YWJsZSBkZWZpbml0aW9uIGZvciB0aGUgc2VydmljZS4gVGhpcyBpcyB1bmxpa2UgVmlldyBFbmdpbmUsIHdoZXJlIGhhdmluZyBqdXN0IGFuIHVucmVsYXRlZFxuICogZGVjb3JhdG9yIG1heSBoYXZlIGJlZW4gc3VmZmljaWVudCBmb3IgdGhlIHNlcnZpY2UgdG8gYmVjb21lIGluamVjdGFibGUuXG4gKlxuICogSW4gZXNzZW5jZSwgdGhpcyBtaWdyYXRpb24gb3BlcmF0ZXMgb24gY2xhc3NlcyB0aGF0IGFyZSB0aGVtc2VsdmVzIGFuIE5nTW9kdWxlLCBEaXJlY3RpdmUgb3JcbiAqIENvbXBvbmVudC4gVGhlaXIgbWV0YWRhdGEgaXMgc3RhdGljYWxseSBldmFsdWF0ZWQgc28gdGhhdCB0aGVpciBcInByb3ZpZGVyc1wiL1widmlld1Byb3ZpZGVyc1wiXG4gKiBwcm9wZXJ0aWVzIGNhbiBiZSBhbmFseXplZC4gRm9yIGFueSBwcm92aWRlciB0aGF0IHJlZmVycyB0byBhbiB1bmRlY29yYXRlZCBjbGFzcywgdGhlIGNsYXNzIHdpbGxcbiAqIGJlIG1pZ3JhdGVkIHRvIGhhdmUgYW4gYEBJbmplY3RhYmxlKClgIGRlY29yYXRvci5cbiAqXG4gKiBUaGlzIGltcGxlbWVudGF0aW9uIG1pcnJvcnMgdGhlIFwibWlzc2luZy1pbmplY3RhYmxlXCIgc2NoZW1hdGljLlxuICovXG5leHBvcnQgY2xhc3MgTWlzc2luZ0luamVjdGFibGVNaWdyYXRpb24gaW1wbGVtZW50cyBNaWdyYXRpb24ge1xuICBhcHBseShjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbiwgaG9zdDogTWlncmF0aW9uSG9zdCk6IHRzLkRpYWdub3N0aWN8bnVsbCB7XG4gICAgY29uc3QgZGVjb3JhdG9ycyA9IGhvc3QucmVmbGVjdGlvbkhvc3QuZ2V0RGVjb3JhdG9yc09mRGVjbGFyYXRpb24oY2xhenopO1xuICAgIGlmIChkZWNvcmF0b3JzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGRlY29yYXRvciBvZiBkZWNvcmF0b3JzKSB7XG4gICAgICBjb25zdCBuYW1lID0gZ2V0QW5ndWxhckNvcmVEZWNvcmF0b3JOYW1lKGRlY29yYXRvcik7XG4gICAgICBpZiAobmFtZSA9PT0gJ05nTW9kdWxlJykge1xuICAgICAgICBtaWdyYXRlTmdNb2R1bGVQcm92aWRlcnMoZGVjb3JhdG9yLCBob3N0KTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ0RpcmVjdGl2ZScpIHtcbiAgICAgICAgbWlncmF0ZURpcmVjdGl2ZVByb3ZpZGVycyhkZWNvcmF0b3IsIGhvc3QsIC8qIGlzQ29tcG9uZW50ICovIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NvbXBvbmVudCcpIHtcbiAgICAgICAgbWlncmF0ZURpcmVjdGl2ZVByb3ZpZGVycyhkZWNvcmF0b3IsIGhvc3QsIC8qIGlzQ29tcG9uZW50ICovIHRydWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogSXRlcmF0ZXMgdGhyb3VnaCBhbGwgYE5nTW9kdWxlLnByb3ZpZGVyc2AgYW5kIGFkZHMgdGhlIGBASW5qZWN0YWJsZSgpYCBkZWNvcmF0b3IgdG8gYW55IHByb3ZpZGVyXG4gKiB0aGF0IGlzIG5vdCBvdGhlcndpc2UgZGVjb3JhdGVkLlxuICovXG5mdW5jdGlvbiBtaWdyYXRlTmdNb2R1bGVQcm92aWRlcnMoZGVjb3JhdG9yOiBEZWNvcmF0b3IsIGhvc3Q6IE1pZ3JhdGlvbkhvc3QpOiB2b2lkIHtcbiAgaWYgKGRlY29yYXRvci5hcmdzID09PSBudWxsIHx8IGRlY29yYXRvci5hcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG1ldGFkYXRhID0gaG9zdC5ldmFsdWF0b3IuZXZhbHVhdGUoZGVjb3JhdG9yLmFyZ3NbMF0sIGZvcndhcmRSZWZSZXNvbHZlcik7XG4gIGlmICghKG1ldGFkYXRhIGluc3RhbmNlb2YgTWFwKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIG1pZ3JhdGVQcm92aWRlcnMobWV0YWRhdGEsICdwcm92aWRlcnMnLCBob3N0KTtcbiAgLy8gVE9ETyhhbHhodWIpOiB3ZSBzaG91bGQgcHJvYmFibHkgYWxzbyBjaGVjayBmb3IgYE1vZHVsZVdpdGhQcm92aWRlcnNgIGhlcmUuXG59XG5cbi8qKlxuICogSXRlcmF0ZXMgdGhyb3VnaCBhbGwgYERpcmVjdGl2ZS5wcm92aWRlcnNgIGFuZCBpZiBgaXNDb21wb25lbnRgIGlzIHNldCB0byB0cnVlIGFsc29cbiAqIGBDb21wb25lbnQudmlld1Byb3ZpZGVyc2AgYW5kIGFkZHMgdGhlIGBASW5qZWN0YWJsZSgpYCBkZWNvcmF0b3IgdG8gYW55IHByb3ZpZGVyIHRoYXQgaXMgbm90XG4gKiBvdGhlcndpc2UgZGVjb3JhdGVkLlxuICovXG5mdW5jdGlvbiBtaWdyYXRlRGlyZWN0aXZlUHJvdmlkZXJzKFxuICAgIGRlY29yYXRvcjogRGVjb3JhdG9yLCBob3N0OiBNaWdyYXRpb25Ib3N0LCBpc0NvbXBvbmVudDogYm9vbGVhbik6IHZvaWQge1xuICBpZiAoZGVjb3JhdG9yLmFyZ3MgPT09IG51bGwgfHwgZGVjb3JhdG9yLmFyZ3MubGVuZ3RoICE9PSAxKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbWV0YWRhdGEgPSBob3N0LmV2YWx1YXRvci5ldmFsdWF0ZShkZWNvcmF0b3IuYXJnc1swXSwgZm9yd2FyZFJlZlJlc29sdmVyKTtcbiAgaWYgKCEobWV0YWRhdGEgaW5zdGFuY2VvZiBNYXApKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbWlncmF0ZVByb3ZpZGVycyhtZXRhZGF0YSwgJ3Byb3ZpZGVycycsIGhvc3QpO1xuICBpZiAoaXNDb21wb25lbnQpIHtcbiAgICBtaWdyYXRlUHJvdmlkZXJzKG1ldGFkYXRhLCAndmlld1Byb3ZpZGVycycsIGhvc3QpO1xuICB9XG59XG5cbi8qKlxuICogR2l2ZW4gYW4gb2JqZWN0IHdpdGggZGVjb3JhdG9yIG1ldGFkYXRhLCBpdGVyYXRlcyB0aHJvdWdoIHRoZSBsaXN0IG9mIHByb3ZpZGVycyB0byBhZGRcbiAqIGBASW5qZWN0YWJsZSgpYCB0byBhbnkgcHJvdmlkZXIgdGhhdCBpcyBub3Qgb3RoZXJ3aXNlIGRlY29yYXRlZC5cbiAqL1xuZnVuY3Rpb24gbWlncmF0ZVByb3ZpZGVycyhtZXRhZGF0YTogUmVzb2x2ZWRWYWx1ZU1hcCwgZmllbGQ6IHN0cmluZywgaG9zdDogTWlncmF0aW9uSG9zdCk6IHZvaWQge1xuICBpZiAoIW1ldGFkYXRhLmhhcyhmaWVsZCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgcHJvdmlkZXJzID0gbWV0YWRhdGEuZ2V0KGZpZWxkKSE7XG4gIGlmICghQXJyYXkuaXNBcnJheShwcm92aWRlcnMpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZm9yIChjb25zdCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcbiAgICBtaWdyYXRlUHJvdmlkZXIocHJvdmlkZXIsIGhvc3QpO1xuICB9XG59XG5cbi8qKlxuICogQW5hbHl6ZXMgYSBzaW5nbGUgcHJvdmlkZXIgZW50cnkgYW5kIGRldGVybWluZXMgdGhlIGNsYXNzIHRoYXQgaXMgcmVxdWlyZWQgdG8gaGF2ZSBhblxuICogYEBJbmplY3RhYmxlKClgIGRlY29yYXRvci5cbiAqL1xuZnVuY3Rpb24gbWlncmF0ZVByb3ZpZGVyKHByb3ZpZGVyOiBSZXNvbHZlZFZhbHVlLCBob3N0OiBNaWdyYXRpb25Ib3N0KTogdm9pZCB7XG4gIGlmIChwcm92aWRlciBpbnN0YW5jZW9mIE1hcCkge1xuICAgIGlmICghcHJvdmlkZXIuaGFzKCdwcm92aWRlJykgfHwgcHJvdmlkZXIuaGFzKCd1c2VWYWx1ZScpIHx8IHByb3ZpZGVyLmhhcygndXNlRmFjdG9yeScpIHx8XG4gICAgICAgIHByb3ZpZGVyLmhhcygndXNlRXhpc3RpbmcnKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAocHJvdmlkZXIuaGFzKCd1c2VDbGFzcycpKSB7XG4gICAgICAvLyB7cHJvdmlkZTogLi4uLCB1c2VDbGFzczogU29tZUNsYXNzLCBkZXBzOiBbLi4uXX0gZG9lcyBub3QgcmVxdWlyZSBhIGRlY29yYXRvciBvbiBTb21lQ2xhc3MsXG4gICAgICAvLyBhcyB0aGUgcHJvdmlkZXIgaXRzZWxmIGNvbmZpZ3VyZXMgJ2RlcHMnLiBPbmx5IGlmICdkZXBzJyBpcyBtaXNzaW5nIHdpbGwgdGhpcyByZXF1aXJlIGFcbiAgICAgIC8vIGZhY3RvcnkgdG8gZXhpc3Qgb24gU29tZUNsYXNzLlxuICAgICAgaWYgKCFwcm92aWRlci5oYXMoJ2RlcHMnKSkge1xuICAgICAgICBtaWdyYXRlUHJvdmlkZXJDbGFzcyhwcm92aWRlci5nZXQoJ3VzZUNsYXNzJykhLCBob3N0KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbWlncmF0ZVByb3ZpZGVyQ2xhc3MocHJvdmlkZXIuZ2V0KCdwcm92aWRlJykhLCBob3N0KTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwcm92aWRlcikpIHtcbiAgICBmb3IgKGNvbnN0IHYgb2YgcHJvdmlkZXIpIHtcbiAgICAgIG1pZ3JhdGVQcm92aWRlcih2LCBob3N0KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbWlncmF0ZVByb3ZpZGVyQ2xhc3MocHJvdmlkZXIsIGhvc3QpO1xuICB9XG59XG5cbi8qKlxuICogR2l2ZW4gYSBwcm92aWRlciBjbGFzcywgYWRkcyB0aGUgYEBJbmplY3RhYmxlKClgIGRlY29yYXRvciBpZiBubyBvdGhlciByZWxldmFudCBBbmd1bGFyIGRlY29yYXRvclxuICogaXMgcHJlc2VudCBvbiB0aGUgY2xhc3MuXG4gKi9cbmZ1bmN0aW9uIG1pZ3JhdGVQcm92aWRlckNsYXNzKHByb3ZpZGVyOiBSZXNvbHZlZFZhbHVlLCBob3N0OiBNaWdyYXRpb25Ib3N0KTogdm9pZCB7XG4gIC8vIFByb3ZpZGVycyB0aGF0IGRvIG5vdCByZWZlciB0byBhIGNsYXNzIGNhbm5vdCBiZSBtaWdyYXRlZC5cbiAgaWYgKCEocHJvdmlkZXIgaW5zdGFuY2VvZiBSZWZlcmVuY2UpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY2xhenogPSBwcm92aWRlci5ub2RlO1xuICBpZiAoaXNDbGFzc0RlY2xhcmF0aW9uKGNsYXp6KSAmJiBob3N0LmlzSW5TY29wZShjbGF6eikgJiYgbmVlZHNJbmplY3RhYmxlRGVjb3JhdG9yKGNsYXp6LCBob3N0KSkge1xuICAgIGhvc3QuaW5qZWN0U3ludGhldGljRGVjb3JhdG9yKGNsYXp6LCBjcmVhdGVJbmplY3RhYmxlRGVjb3JhdG9yKGNsYXp6KSk7XG4gIH1cbn1cblxuY29uc3QgTk9fTUlHUkFURV9ERUNPUkFUT1JTID0gbmV3IFNldChbJ0luamVjdGFibGUnLCAnRGlyZWN0aXZlJywgJ0NvbXBvbmVudCcsICdQaXBlJ10pO1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgdGhlIGdpdmVuIGNsYXNzIG5lZWRzIHRvIGJlIGRlY29yYXRlZCB3aXRoIGBASW5qZWN0YWJsZSgpYCBiYXNlZCBvbiB3aGV0aGVyIGl0XG4gKiBhbHJlYWR5IGhhcyBhbiBBbmd1bGFyIGRlY29yYXRvciBhcHBsaWVkLlxuICovXG5mdW5jdGlvbiBuZWVkc0luamVjdGFibGVEZWNvcmF0b3IoY2xheno6IENsYXNzRGVjbGFyYXRpb24sIGhvc3Q6IE1pZ3JhdGlvbkhvc3QpOiBib29sZWFuIHtcbiAgY29uc3QgZGVjb3JhdG9ycyA9IGhvc3QuZ2V0QWxsRGVjb3JhdG9ycyhjbGF6eik7XG4gIGlmIChkZWNvcmF0b3JzID09PSBudWxsKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmb3IgKGNvbnN0IGRlY29yYXRvciBvZiBkZWNvcmF0b3JzKSB7XG4gICAgY29uc3QgbmFtZSA9IGdldEFuZ3VsYXJDb3JlRGVjb3JhdG9yTmFtZShkZWNvcmF0b3IpO1xuICAgIGlmIChuYW1lICE9PSBudWxsICYmIE5PX01JR1JBVEVfREVDT1JBVE9SUy5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIHRoZSBvcmlnaW5hbCBuYW1lIG9mIGEgZGVjb3JhdG9yIGlmIGl0IGlzIGZyb20gJ0Bhbmd1bGFyL2NvcmUnLiBGb3Igb3RoZXIgZGVjb3JhdG9ycyxcbiAqIG51bGwgaXMgcmV0dXJuZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbmd1bGFyQ29yZURlY29yYXRvck5hbWUoZGVjb3JhdG9yOiBEZWNvcmF0b3IpOiBzdHJpbmd8bnVsbCB7XG4gIGlmIChkZWNvcmF0b3IuaW1wb3J0ID09PSBudWxsIHx8IGRlY29yYXRvci5pbXBvcnQuZnJvbSAhPT0gJ0Bhbmd1bGFyL2NvcmUnKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gZGVjb3JhdG9yLmltcG9ydC5uYW1lO1xufVxuIl19