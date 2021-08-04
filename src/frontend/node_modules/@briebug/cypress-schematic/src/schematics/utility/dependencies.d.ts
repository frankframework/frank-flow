/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 * https://github.com/angular/angular-cli/blob/master/packages/schematics/angular/utility/dependencies.ts
 */
import { Tree } from '@angular-devkit/schematics';
export declare enum pkgJson {
    Path = "/package.json"
}
export declare enum NodeDependencyType {
    Default = "dependencies",
    Dev = "devDependencies",
    Peer = "peerDependencies",
    Optional = "optionalDependencies"
}
export interface NodeDependency {
    type: NodeDependencyType;
    name: string;
    version: string;
    overwrite?: boolean;
}
export interface DeleteNodeDependency {
    type: NodeDependencyType;
    name: string;
}
export declare function addPackageJsonDependency(tree: Tree, dependency: NodeDependency): void;
export declare function getPackageJsonDependency(tree: Tree, name: string): NodeDependency | null;
