import { Tree } from '@angular-devkit/schematics';
/** Adds a package to the package.json in the given host tree. */
export declare function addPackageToPackageJson(host: Tree, pkg: string, version: string): Tree;
/** Gets the version of the specified package by looking at the package.json in the given tree. */
export declare function getPackageVersionFromPackageJson(tree: Tree, name: string): string | null;
