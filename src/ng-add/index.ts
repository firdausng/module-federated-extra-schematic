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

/**
 * The `add` function is an exported helper function in TypeScript that creates a new rule.
 * 
 * @param {Schema} _options - A schema object that contains the specifications for the rule.
 * 
 * @return {Rule} The function returns a newly created rule that performs a series of operations, 
 * including preparing the workspace, creating a new folder path, moving and transforming a set of files, 
 * and applying a chain of other rules like installing dependencies, adding module federated and 
 * updating the Webpack configuration. The combination of these operations forms a chained rule, 
 * which is returned by the `add` function.
 */
export function add(_options: Schema): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const workspace = getWorkspace(_options, tree);
        // @ts-ignore
        const project = workspace.projects[_options.project] as ProjectDefinition;
        const appRoot = `${project?.sourceRoot}/${project?.prefix}`;
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

/**
 * `specFilter` is a function that returns a rule to filter test related files in the project,
 * based on the `spec` option.
 * 
 * It takes an object of the type `Schema` as a parameter, which includes the property `spec`.
 * When `spec` is falsy, the function filters out both `.spec.ts` files and `test.ts` files. 
 * If `spec` is truthy, only `test.ts` files are filtered.
 * The function uses regex to match the file paths and filter the required files.
 * 
 * This function makes use of the `filter` function from the '@angular-devkit/schematics' package
 * to create a rule which can be used in a chain of schematic rules.
 * 
 * @param _options - The options to configure how the filtering will be done.
 * @returns - A rule for filtering the `.spec.ts` and `test.ts` files based on the `_options.spec` value.
 */
function specFilter(_options: Schema): Rule {
    if (!_options.spec) {
        return filter(path => {
            return !path.match(/\.spec\.ts$/) && !path.match(/test\.ts$/);

        });
    }
    return filter(path => !path.match(/test\.ts$/));
}

/**
 * getWorkspace is a function that reads the 'angular.json' file from the tree and returns its content as a JavaScript
 * object parsed from the original JSON format.
 * 
 * @param {_options} - An object of the Schema type. Not used inside this function but potentially relevant for function calls.
 * @param {tree} - An object of the Tree type from the '@angular-devkit/schematics' package. Represents the current file 
 * system tree, which is modified by the schematics.
 *
 * @throws {SchematicsException} - If the 'angular.json' file does not exist in the current tree, the function will throw 
 * a SchematicsException with the message 'angular.json file not found'.
 *
 * @returns {workspaces.WorkspaceDefinition} - This function returns an object containing workspace definitions read
 * from the 'angular.json' file. The return type is WorkspaceDefinition from the '@angular-devkit/core' package.
 */
function getWorkspace(_options: Schema, tree: Tree): workspaces.WorkspaceDefinition {
    const workspace = tree.read('./angular.json');
    if (!workspace) {
        throw new SchematicsException('angular.json file not found');
    }
    return JSON.parse(workspace.toString());
}

/**
 * The `installModuleFederated` function creates a rule that installs the '@angular-architects/module-federation' package.
 * The installation is achieved by creating and adding a new task to the context. The task specifically installs 
 * a package with the name '@angular-architects/module-federation'.
 * 
 * This function does not expect any parameters and returns a Rule from the '@angular-devkit/schematics' package.
 * The returned rule is a function that takes a Tree and a SchematicContext as parameters and installs the required 
 * package, then returns the modified tree.
 */
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

/**
 * The `addModuleFederated` function constructs and applies a rule to augment the configuration of a current Angular project
 * based on the given schema `options`. 
 *
 * @param {Schema} _options - The object containing the specifications for the rule from the `addModuleFederated` function. 
 * The `options` parameter should contain three properties: `type`, `project`, and `port`.
 *
 * @returns {Rule} - Returns an Angular Schematics `Rule` function that takes a `Tree` and a `SchematicContext` as parameters,
 * and modifies the context by adding a new task `RunSchematicTask` based on the extracted `_options` provided,
 * finally returning the modified tree.
 *
 * Specifically, the `RunSchematicTask` will run the `ng-add` schematic from the '@angular-architects/module-federation' package
 * with the given options.
 *
 * Depending on whether the `taskId` is defined or not, the task may be dependent on the completion of another task, this
 * behavior is determined by the `taskId` parameter in the `addTask` method.
 * If `taskId` is not defined, it invokes `addTask` without dependencies. If it is defined, the newly created task
 * is dependent on the task with id `taskId`.
 *
 * After the task is added, it logs a message through the `SchematicContext` logger stating that the '@angular-architects/module-federation'
 * package is being configured with the 'ng-add' schematic.
 */
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

/**
 * The `updateWebpackConfig` function accepts a parameter `_options` of `Schema` type and returns a rule of the `Rule` type. 
 * It defines the schematic context and the task to update the Webpack configuration of the Angular
 * project within the schematic workflow.
 *
 * It configures the RunSchematicTask using constant string parameters `mfPlusDepName` and `mfDepPlusNameSchematicName`, as well
 * as `options`, which is derived from `_options`. Specifically, `options` would contain properties `type`, `project`, and `port`
 * inset by `_options.type`, `_options.project`, and `Number(_options.port)` respectively.
 *
 * Depending on whether the `webpackTaskId` is defined, the method `addTask` of the `_context` either includes or excludes
 * a dependency on `webpackTaskId`. If `webpackTaskId` is undefined, the function executes `addTask` simply with task parameters, 
 * but if `webpackTaskId` is defined, it executes `addTask` with task parameters and an array consisting `[webpackTaskId]`.
 *
 * After adding the task, it logs a string using `_context.logger.info` informing of the configuration status involving 
 * named constants `mfPlusDepName`and `mfDepPlusNameSchematicName`.
 *
 * Finally, this method returns `tree`, which shows the current project's file system tree after the schematic modification.
 */
function updateWebpackConfig(_options: Schema): Rule {
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

/**
 * The `installDependencyPackage` function creates a rule to install a given npm dependency if it's not already installed.
 * 
 * @param {string} depName - The name of the npm dependency to be installed.
 * 
 * @returns {Rule} - This function returns a rule from the '@angular-devkit/schematics' package. This rule is a function 
 * that takes a Tree and a SchematicContext as parameters, checks if the dependency is already installed by examining the 
 * package.json file of the project, installs the dependency if it is not installed already, and finally returns the modified tree.
 *
 * The function uses TypeScript AST to parse and traverse the 'package.json' source file and search for the specified dependency.
 * In the case the dependency is not found, a new NodePackageInstallTask is added to the SchematicContext using the options 
 * created from the name of the dependency package (depName), thereby installing the package as a new task.
 */
function installDependencyPackage(depName: string): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        const packageJsonPath = '/package.json';
        const packageJson = getAsSourceFile(tree, packageJsonPath);
        let depInstalled = false;

        packageJson.forEachChild(child => {
            if (child.kind === ts.SyntaxKind.ExpressionStatement) {
                child.forEachChild(objectLiteral => {
                    objectLiteral.forEachChild(property => {
                        if (property.getFullText().includes('dependencies')) {
                            property.forEachChild(dependency => {
                                if (dependency.getFullText().includes(depName)) {
                                    _context.logger.info(`${depName} already installed`);
                                    depInstalled = true;
                                }
                            })
                        }
                    })
                })
            }
        })

        if (!depInstalled) {
            const options = <NodePackageTaskOptions>{
                packageName: depName
            };
            _context.addTask(new NodePackageInstallTask(options));
            _context.logger.info(`Installing ${depName}`);
        }

        return tree;
    }
}

/**
 * `getAsSourceFile` is a utility function which reads the file at the given path from the given Tree object,
 * and returns it as a TypeScript Source File.
 * 
 * This function takes two parameters, `tree` and `path`. `tree` is the Tree object representing the current state of the
 * filesystem, and `path` is the relative path to the file from the workspace.
 * 
 * This function first reads the file from the tree using the `tree.read(path)` method. If no such file exists, an instance of
 * SchematicsException is thrown. If the file does exist, its content is converted into a string format and supplied to the
 * `ts.createSourceFile` method from the TypeScript API along with the original path, the ScriptTarget.Latest enumeration value
 * specifying the latest ECMAScript version as target, and a `true` value indicating the creation of a SourceFile object with
 * setParentNodes to be true.
 * 
 * @param {Tree} tree - The tree from which the file is to be read.
 * @param {string} path - The path to the file that is to be read from the tree.
 * 
 * @throws {SchematicsException} If the `path` does not exist in the given `tree`, then a `SchematicsException` is thrown.
 *
 * @returns {SourceFile} - Returns a SourceFile object from the TypeScript API, representing the file read from the tree.
 */
function getAsSourceFile(tree: Tree, path: string): ts.SourceFile {
    const file = tree.read(path);
    if (!file) {
        throw new SchematicsException(`${path} file not found`);
    }
    return ts.createSourceFile(
        path,
        file.toString(),
        ts.ScriptTarget.Latest,
        true
    );
}
