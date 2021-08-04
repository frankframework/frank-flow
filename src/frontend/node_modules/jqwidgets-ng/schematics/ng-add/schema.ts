export interface Schema {
  /** Name of the project. */
  project: string;

  /** Name of pre-built theme to install. */
  theme:  'base' | 'material' | 'material-green' | 'material-purple' | 'light' | 'dark';
   
  /** Whether to set up global typography styles. */
  typography: boolean;
}