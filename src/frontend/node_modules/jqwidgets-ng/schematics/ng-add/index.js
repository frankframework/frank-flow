"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const package_config_1 = require("./package-config");
const schematics_1 = require("@angular-devkit/schematics");
const schematics_2 = require("@angular/cdk/schematics");
const config_1 = require("@schematics/angular/utility/workspace");
const material_fonts_1 = require("../fonts/material-fonts");
const theming_1 = require("../theming/theming");
/** Name of the Angular module that enables Angular browser animations. */
const browserAnimationsModuleName = 'BrowserAnimationsModule';
/** Name of the module that switches Angular animations to a noop implementation. */
const noopAnimationsModuleName = 'NoopAnimationsModule';
/**
 * Version range that will be used for the Angular CDK and Angular Material if this
 * schematic has been run outside of the CLI `ng add` command. In those cases, there
 * can be no dependency on `@angular/material` in the `package.json` file, and we need
 * to manually insert the dependency based on the build version placeholder.
 *
 * Note that the fallback version range does not use caret, but tilde because that is
 * the default for Angular framework dependencies in CLI projects.
 */
const fallbackSmartVersionRange = `~0.0.0-PLACEHOLDER`;
/**
 * Adds custom Material styles to the project style file. The custom CSS sets up the Roboto font
 * and reset the default browser body margin.
 */

/**
 * Schematic factory entry-point for the `ng-add` schematic. The ng-add schematic will be
 * automatically executed if developers run `ng add @angular/material`.
 *
 * Since the Angular Material schematics depend on the schematic utility functions from the CDK,
 * we need to install the CDK before loading the schematic files that import from the CDK.
 */
function default_1(options) {
    return (host, context) => {
        // Version tag of the `@angular/core` dependency that has been loaded from the `package.json`
        // of the CLI project. This tag should be preferred because all Angular dependencies should
        // have the same version tag if possible.
        const ngCoreVersionTag = package_config_1.getPackageVersionFromPackageJson(host, '@angular/core');
        const smartVersionRange = package_config_1.getPackageVersionFromPackageJson(host, 'jqwidgets-ng');
        const angularDependencyVersion = ngCoreVersionTag || `0.0.0-NG`;
        // The CLI inserts `smart-webcomponents-angular` into the `package.json` before this schematic runs.
        // This means that we do not need to insert Angular Material into `package.json` files again.
        // In some cases though, it could happen that this schematic runs outside of the CLI `ng add`
        // command, or Material is only listed a dev dependency. If that is the case, we insert a
        // version based on the current build version (substituted version placeholder).
        if (smartVersionRange === null) {
            package_config_1.addPackageToPackageJson(host, 'jqwidgets-ng', fallbackSmartVersionRange);
        }
        package_config_1.addPackageToPackageJson(host, '@angular/cdk', smartVersionRange || fallbackSmartVersionRange);
        return schematics_1.chain([
            theming_1.addThemeToAppStyles(options),
            material_fonts_1.addFontsToIndex(options),
            theming_1.addTypographyClass(options)
        ]);
    };
}
exports.default = default_1;
//# sourceMappingURL=index.js.map