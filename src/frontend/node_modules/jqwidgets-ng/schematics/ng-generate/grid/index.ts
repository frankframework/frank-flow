import {chain, noop, Rule, SchematicContext, Tree} from '@angular-devkit/schematics';
import {
  addModuleImportToModule,
  buildComponent,
  findModuleFromOptions,
  getProjectFromWorkspace,
  getProjectMainFile,  
  getProjectStyleFile
} from '@angular/cdk/schematics';
import {Schema} from './schema';
import {getWorkspace} from '@schematics/angular/utility/workspace';
import {addFontsToIndex} from '../../fonts/material-fonts';
import {addThemeToAppStyles, addTypographyClass} from '../../theming/theming';

/**
 * Scaffolds a new table component.
 * Internally it bootstraps the base component schematic
 */
export default function(options: Schema): Rule {
  return chain([
    buildComponent({...options}, {
      template: './__path__/__name@dasherize@if-flat__/__name@dasherize__.component.html.template',
      stylesheet:
          './__path__/__name@dasherize@if-flat__/__name@dasherize__.component.__style__.template'
    }),
	addThemeToAppStyles(options),
    addFontsToIndex(options),
    addMaterialAppStyles(options),
    addTypographyClass(options),	
    options.skipImport ? noop() : addTableModulesToModule(options)
  ]);
}

/**
 * Adds custom Material styles to the project style file. The custom CSS sets up the Roboto font
 * and reset the default browser body margin.
 */
function addMaterialAppStyles(options: Schema) {
  return (host: Tree, context: SchematicContext) => {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);
    const styleFilePath = getProjectStyleFile(project);
    const logger = context.logger;

    if (!styleFilePath) {
      logger.error(`Could not find the default style file for this project.`);
      logger.info(`Please consider manually setting up the Roboto font in your CSS.`);
      return;
    }

    const buffer = host.read(styleFilePath);

    if (!buffer) {
      logger.error(`Could not read the default style file within the project ` +
        `(${styleFilePath})`);
      logger.info(`Please consider manually setting up the Robot font.`);
      return;
    }

    const htmlContent = buffer.toString();
    const insertion = '\n' +
      `html, body { height: 100%; }\n` +
      `body { margin: 0; font-family: Roboto, "Helvetica Neue", sans-serif; }\n`;

    if (htmlContent.includes(insertion)) {
      return;
    }

    const recorder = host.beginUpdate(styleFilePath);

    recorder.insertLeft(htmlContent.length, insertion);
    host.commitUpdate(recorder);
  };
}
/**
 * Adds the required modules to the relative module.
 */
function addTableModulesToModule(options: Schema) {
  return (host: Tree) => {
    const modulePath = findModuleFromOptions(host, options)!;
    addModuleImportToModule(host, modulePath, 'jqxGridModule', 'jqwidgets-ng/jqxgrid');
    return host;
  };
}