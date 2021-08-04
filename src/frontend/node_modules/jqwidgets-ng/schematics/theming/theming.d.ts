import { Rule, Tree } from '@angular-devkit/schematics';
import { Schema } from '../schema';
/** Add pre-built styles to the main project style file. */
export declare function addThemeToAppStyles(options: Schema): Rule;
/** Adds the global typography class to the body element. */
export declare function addTypographyClass(options: Schema): (host: Tree) => Tree;
