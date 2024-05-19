import {chain, Rule, SchematicContext, SchematicsException, Tree} from '@angular-devkit/schematics';
import {ProjectDefinition} from "@angular-devkit/core/src/workspace";
import {workspaces} from "@angular-devkit/core";

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

function getWorkspace(_options: Schema, tree: Tree): workspaces.WorkspaceDefinition {
  const workspace = tree.read('./angular.json');
  if(!workspace) {
    throw new SchematicsException('angular.json file not found');
  }
  return JSON.parse(workspace.toString());
}

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

function setRemoteWebpackConfig(fileContent: string): string{
//TODO maybe any specific thing for remote
  return fileContent;
}

function setHostWebpackConfig(fileContent: string): string{
  let newContent =  fileContent.replace(/remotes\s*:\s*\{(?:[^{}]|\{[^{}]*\})*\}/, 'remotes: {}');
  newContent =  newContent.replace(/shareAll/, 'share');
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