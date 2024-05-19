import {
    apply,
    chain, filter, MergeStrategy, mergeWith,
    move,
    Rule,
    SchematicContext,
    SchematicsException,
    TaskId, template,
    Tree,
    url
} from '@angular-devkit/schematics';
import {NodePackageInstallTask, RunSchematicTask,} from '@angular-devkit/schematics/tasks';
import {NodePackageTaskOptions} from "@angular-devkit/schematics/tasks/package-manager/options";
import {normalize, strings, workspaces} from "@angular-devkit/core";
import {ProjectDefinition} from "@angular-devkit/core/src/workspace";
import {Schema} from "./schema";
import * as ts from "typescript";

let taskId: TaskId;
let webpackTaskId: TaskId;

export function add(_options: Schema): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const workspace = getWorkspace(_options, tree);
        // @ts-ignore
        const project = workspace.projects[_options.project] as ProjectDefinition;
        const appRoot = `${project?.root}/${project?.sourceRoot}/${project?.prefix}`;
        const folderPath = normalize(strings.dasherize(appRoot + _options.path + '/' + _options.name));

        let files = url('./files');

        const newTree = apply(files, [
            move(folderPath),
            template({
                ...strings,
                ..._options
            }),
            specFilter(_options)
        ]);

        const templateRule = mergeWith(newTree, MergeStrategy.Default);
        const installNgTerminalRule = installDependencyPackage('ng-terminal');
        const installModuleFederatedRule = installModuleFederated();
        const addModuleFederatedRule = addModuleFederated(_options);
        let chainedRule: Rule;

        const updateRemoteWebpackConfigRule = updateWebpackConfig(_options);
        chainedRule = chain([
            templateRule,
            installNgTerminalRule,
            installModuleFederatedRule,
            addModuleFederatedRule,
            updateRemoteWebpackConfigRule
        ]);
        return chainedRule(tree, _context);
    };
}

function specFilter(_options: Schema): Rule {
    if (!_options.spec) {
        return filter(path => {
            return !path.match(/\.spec\.ts$/) && !path.match(/test\.ts$/);

        });
    }
    return filter(path => !path.match(/test\.ts$/));
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
        const mfPlusDepName = 'module-federated-extra-schematic';
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

function installDependencyPackage(depName: string): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const packageJsonPath = '/package.json';
        const packageJson = getAsSourceFile(tree, packageJsonPath);
        let depInstalled = false;

        packageJson.forEachChild(child => {
            if(child.kind === ts.SyntaxKind.ExpressionStatement){
                child.forEachChild(objectLiteral => {
                    objectLiteral.forEachChild(property => {
                        if(property.getFullText().includes('dependencies')){
                            property.forEachChild(dependency => {
                                if(dependency.getFullText().includes(depName)){
                                    _context.logger.info(`${depName} already installed`);
                                    depInstalled = true;
                                }
                            })
                        }
                    })
                })
            }
        })

        if (!depInstalled){
            const options = <NodePackageTaskOptions>{
                packageName: depName
            };
            _context.addTask(new NodePackageInstallTask(options));
            _context.logger.info(`Installing ${depName}`);
        }

        return tree;
    }
}

function getAsSourceFile(tree: Tree, path: string): ts.SourceFile {
    const file = tree.read(path);
    if(!file){
        throw new SchematicsException(`${path} file not found`);
    }
    return ts.createSourceFile(
        path,
        file.toString(),
        ts.ScriptTarget.Latest,
        true
    );
}
