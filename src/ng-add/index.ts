import {chain, Rule, SchematicContext, SchematicsException, TaskId, Tree} from '@angular-devkit/schematics';
import {NodePackageInstallTask, RunSchematicTask,} from '@angular-devkit/schematics/tasks';
import {NodePackageTaskOptions} from "@angular-devkit/schematics/tasks/package-manager/options";
import {workspaces} from "@angular-devkit/core";
import {ProjectDefinition} from "@angular-devkit/core/src/workspace";
import {Schema} from "./schema";

let taskId: TaskId;
let webpackTaskId: TaskId;

export function add(_options: Schema): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const workspace = getWorkspace(_options, tree);
        // @ts-ignore
        const project = workspace.projects[_options.project] as ProjectDefinition;
        const appRoot = `${project?.root}/${project?.sourceRoot}/${project?.prefix}`;
        const installModuleFederatedRule = installModuleFederated();
        const addModuleFederatedRule = addModuleFederated(_options);
        let chainedRule: Rule;

        const updateRemoteWebpackConfigRule = updateWebpackConfig(_options);
        chainedRule = chain([
            installModuleFederatedRule,
            addModuleFederatedRule,
            updateRemoteWebpackConfigRule
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

function installModuleFederated(): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const mfDepName = '@angular-architects/module-federation';
        const options = <NodePackageTaskOptions>{
            packageName: mfDepName
        };
        taskId = _context.addTask(new NodePackageInstallTask(options));
        _context.logger.info(`Installing ${mfDepName}`);

        return tree;
    }
}

function addModuleFederated(_options: Schema): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const mfDepName = '@angular-architects/module-federation';
        const mfDepNameSchematicName = 'ng-add';
        const options = {
            type: _options.type,
            project: _options.project,
            port: Number(_options.port)
        }
        if (!taskId) {
            webpackTaskId = _context.addTask(new RunSchematicTask(mfDepName, mfDepNameSchematicName, options));
        } else {
            webpackTaskId = _context.addTask(new RunSchematicTask(mfDepName, mfDepNameSchematicName, options), [taskId]);
        }
        _context.logger.info(`Configuring ${mfDepName} with schematic ${mfDepNameSchematicName}`);
        return tree;
    }
}

function updateWebpackConfig(_options: Schema): Rule{
    return (tree: Tree, _context: SchematicContext) => {
        const mfPlusDepName = 'module-federated-plus-schematic';
        const mfDepPlusNameSchematicName = 'ng-update-webpack';
        const options = {
            type: _options.type,
            project: _options.project,
            port: Number(_options.port)
        }
        if (!webpackTaskId) {
            _context.addTask(new RunSchematicTask(mfPlusDepName, mfDepPlusNameSchematicName, options));
        } else {
            _context.addTask(new RunSchematicTask(mfPlusDepName, mfDepPlusNameSchematicName, options), [webpackTaskId]);
        }
        _context.logger.info(`Configuring ${mfPlusDepName} with schematic ${mfDepPlusNameSchematicName}`);
        return tree;
    }
}