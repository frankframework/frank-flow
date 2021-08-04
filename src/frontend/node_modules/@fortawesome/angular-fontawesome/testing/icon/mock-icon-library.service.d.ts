import { FaIconLibraryInterface } from '@fortawesome/angular-fontawesome';
import { IconDefinition, IconName, IconPrefix } from '@fortawesome/fontawesome-svg-core';
export declare const dummyIcon: IconDefinition;
export declare class MockFaIconLibrary implements FaIconLibraryInterface {
    addIcons(): void;
    addIconPacks(): void;
    getIconDefinition(prefix: IconPrefix, name: IconName): IconDefinition;
}
