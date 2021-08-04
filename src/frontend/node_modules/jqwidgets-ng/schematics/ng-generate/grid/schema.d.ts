import { Schema as ComponentSchema } from '@schematics/angular/component/schema';
export interface Schema extends ComponentSchema {
    /** Name of the project. */
    project: string;
    /** Name of pre-built theme to install. */
    theme:  'default' | 'material' | 'material-green' | 'material-purple' | 'light' | 'dark';
    /** Whether to set up global typography styles. */
    typography: boolean;
}
