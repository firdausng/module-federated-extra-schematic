import {chain, Rule, SchematicContext, SchematicsException, Tree} from '@angular-devkit/schematics';
import {ProjectDefinition} from "@angular-devkit/core/src/workspace";
import {workspaces} from "@angular-devkit/core";

/**
 * `ngUpdateWebpack` is a function that returns a Rule. The function takes in `_options` of any type and defines a rule that
 * updates the Webpack configuration of an Angular project based on the provided options. The function uses Angular Devkit Schematics
 * for creating, modifying, or deleting files in the workspace.
 * 
 * @param _options Any type indicating the options to be used in the function. Options should contain 'project' property.
 * @returns Rule The created rule that updates the project's Webpack configuration.
 */
export function ngUpdateWebpack(_options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const workspace = getWorkspace(_options, tree);
    // @ts-ignore
    const project = workspace.projects[_options.project] as ProjectDefinition;
    const updateWebpackConfigRule = updateWebpackConfigFile(tree, _options, project);
    const chainedRule = chain([
      updateWebpackConfigRule
    ]);
    return chainedRule(tree, _context);
  };
}

/**
 * Function `getWorkspace` reads the workspace configuration of an Angular project.
 * 
 * It takes in two parameters: `_options` and `tree`.
 * - `_options` is an object of type Schema, defining project-specific properties.
 * - `tree` is an object of type Tree, defining the Angular workspace tree.
 * 
 * The function reads the './angular.json' file from the workspace tree.
 * 
 * If it doesn't find the angular.json,
 * it throws a `SchematicsException` with a message 'angular.json file not found'.
 * 
 * If the file is found, the function parses the JSON file into a JavaScript object and returns it.
 * 
 * @param _options Schema object representing project-specific properties.
 * @param tree Tree object representing the Angular workspace tree.
 * @returns workspaces.WorkspaceDefinition The parsed JavaScript object from the angular.json file.
 * @throws SchematicsException If the angular.json file is not found.
 */
function getWorkspace(_options: Schema, tree: Tree): workspaces.WorkspaceDefinition {
  const workspace = tree.read('./angular.json');
  if(!workspace) {
    throw new SchematicsException('angular.json file not found');
  }
  return JSON.parse(workspace.toString());
}

/**
 * The `updateWebpackConfigFile` function updates the Webpack configuration for a given project. This function takes in three parameters:
 * `tree`, `_options`, and `project`, and returns a `Rule` which can be applied to modify the project's Tree.
 *
 * @param tree - `Tree` object from @angular-devkit/schematics which represents the current state of the workspace.
 * @param _options - `Schema` object that includes project-specific properties.
 * @param project - `ProjectDefinition | undefined` which determines the project for which the webpack configuration file needs to be updated.
 *
 * If the `project` parameter is not provided, it throws a SchematicsException.
 * If the webpack configuration file is present, it reads the file, modifies its contents according to the type in `_options`, and overwrites the file.
 * In case the configuration file does not exist, an error message is logged.
 *
 * @returns `Rule` - A function that returns an updated `Tree` object.
 * @throws SchematicsException - Throws an exception if project is not found, or the type in _options is not supported.
 */
function updateWebpackConfigFile(tree: Tree, _options: Schema, project: undefined | ProjectDefinition): Rule{
  return (tree: Tree, _context: SchematicContext) => {
    if(!project){
      throw new SchematicsException(`${project} file not found`);
    }
    console.log(_options)
    _context.logger.info('found webpack config file');
    const webpackConfigPath = `${project.root}/webpack.config.js`;
    const content = tree.read(webpackConfigPath);
    if (content) {
      const fileContent = content.toString();
      let newContent = setCommonWebpackConfig(fileContent);
      switch (_options.type){
        case "remote": {
          newContent = setRemoteWebpackConfig(newContent);
          break;
        }
        case "host": {
          newContent = setHostWebpackConfig(newContent);
          break;
        }
        default:{
          throw new SchematicsException(`Option ${_options.type} is not supported`);
        }
      }

      if(newContent.length > 0){
        tree.overwrite(webpackConfigPath, newContent);
        _context.logger.info('Updated remotes property to an empty object');
      }

    } else {
      _context.logger.error('Error reading webpack config file');
    }
    return tree;
  }
}

/**
 * `setRemoteWebpackConfig` is a function that manipulates the remote Webpack configuration in the provided string (`fileContent`).
 *
 * This function currently does not perform any specific manipulations but returns the provided string as it is.
 * TODO: Implement logic for transforming Webpack configuration for remote set up.
 *
 * @param fileContent string representing the content of the webpack.config.js file.
 * @returns string The transformed webpack configuration content string.
 */

function setRemoteWebpackConfig(fileContent: string): string{
//TODO maybe any specific thing for remote
  return fileContent;
}

/**
 * `setHostWebpackConfig` is a function that modifies the host Webpack configuration according to specific requirements. 
 *
 * This function takes in a string, `fileContent`, which represents the content of the webpack.config.js file and 
 * manipulates some parts of it, primarily adjusting settings related to sharing modules. 
 *
 * The modifications done by this function involve the replacement of:
 * 1. Existing 'remotes' properties with an empty object (remotes: {}).
 * 2. 'shareAll' keyword (if any) with 'share'.
 * 3. Existing 'shared' properties with predefined share settings for certain @angular modules (@angular/core, 
 *    @angular/common, @angular/common/http, @angular/router). 
 *   The shared configurations include setting singleton, strict version, and required version to 'auto'.
 *
 * @param fileContent A string type parameter representing the content of the webpack.config.js file.
 * @returns string The transformed content of the webpack.config.js file.
 */

function setHostWebpackConfig(fileContent: string): string{
  let newContent =  fileContent.replace(/remotes\s*:\s*\{(?:[^{}]|\{[^{}]*\})*\}/, 'remotes: {}');
  return newContent;
}

/**
 * `setCommonWebpackConfig` is a utility function that modifies the received Webpack configuration content. It operates by replacing the use of 
 * 'shareAll' keyword with 'share' and setting predefined share settings for certain @angular modules.
 *
 * @param fileContent A string which represents the original content of the webpack.config.js file that needs to be updated.
 * @returns string The modified content of the webpack.config.js file with replaced module sharing settings.
 *
 * This function is designed to ensure compatibility with Microfrontend architecture by enforcing specific sharing of Angular modules across 
 * different frontend applications.
 *
 * The Angular modules that have their sharing settings manipulated include '@angular/core', '@angular/common', '@angular/common/http', 
 * and '@angular/router'. For these modules, the properties 'singleton', 'strictVersion', and 'requiredVersion' are set to 'true', 
 * 'true', and 'auto' respectively.
 * 
 * This optimizes the use of common Angular modules across different frontend applications reducing redundancy and improving performance.
*/
function setCommonWebpackConfig(fileContent: string): string{
  let newContent =  fileContent.replace(/shareAll/, 'share');
  newContent =  newContent.replace(/shared\s*:\s*\{(?:[^{}]|\{[^{}]*\})*\}/,
      `shared: share({
     '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    },
    '@angular/common': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    },
    '@angular/common/http': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    },
    '@angular/router': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    },
  })`);
  return newContent;
}

type Schema = {
  project: string
  type: string
  port: number
}