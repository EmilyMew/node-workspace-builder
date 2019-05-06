// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as npm from 'npm';

import PackReader from './file/PackReader';
import PathConstants from './constant/PathConstants';
import CopyTask from './model/CopyTask';
import Builder from './build/Builder';
import { resolve } from 'dns';

const packReader = new PackReader();

const prepare = (): Promise<undefined> => {
	return new Promise((resolve) => {
		const root = vscode.workspace.rootPath;
		if (root !== undefined && root !== null) {
			packReader.scan(root, PathConstants.PLACEHOLDER, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(placeholders => {
				packReader.projects.splice(0, packReader.projects.length, ...placeholders.map(filePath => filePath.replace(PathConstants.PLACEHOLDER, '')));
				packReader.scan(root, PathConstants.PACK_JSON, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(packFiles => {
					packReader.prepareCopyTasks(placeholders, packFiles);
					resolve();
				});
			});
		}
	});
};

let building = false;

const buildFunction = (projects: Array<string>, tasks: Array<CopyTask>) => {
	const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
	new Promise((resolve, reject) => {
		if (building) {
			return reject(new Error('You currently have a build task running. Please wait until finished.'));
		}
		building = true;
		resolve();
	}).then(() => {
		if (configuration.get('npmInstallationSelect') === 'integrated') {
			return Builder.npmBuild(projects, tasks).then(() => {
				building = false;
				return Promise.resolve();
			});
		} else {
			return Builder.terminalBuild(projects, tasks).then(() => {
				building = false;
				return Promise.resolve();
			});
		}
	}).catch(err => {
		console.error(err);
		vscode.window.showErrorMessage(err.message);
	});
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	prepare();

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "node-workspace-builder" is now active!');

	let build = vscode.commands.registerCommand('node-workspace-builder.buildWorkspace', () => {
		buildFunction(packReader.projects, packReader.tasks);
	});

	let watch = vscode.commands.registerCommand('node-workspace-builder.watchProject', (e) => {
		if (/node_modules/.test(e.fsPath)) {
			vscode.window.showWarningMessage('This is a dependency installation folder. Workspace builder will not watch this.');
			return;
		}
		if (e.fsPath.indexOf(PathConstants.PACK_JSON) >= 0) {
			fs.writeFileSync(e.fsPath.replace(PathConstants.PACK_JSON, PathConstants.PLACEHOLDER), '');
			prepare().then(() => {
				buildFunction(packReader.projects, packReader.tasks);
			});
		} else {
			if (fs.existsSync(e.fsPath + path.sep + PathConstants.PACK_JSON)) {
				fs.writeFileSync(e.fsPath + path.sep + PathConstants.PLACEHOLDER, '');
				prepare().then(() => {
					buildFunction(packReader.projects, packReader.tasks);
				});
			} else {
				vscode.window.showWarningMessage('There is no package.json file found. This folder is not a node project folder.');
			}
		}
	});

	context.subscriptions.push(build);
	context.subscriptions.push(watch);

	vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
		const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
		const tasks = new Array<CopyTask>();
		if (configuration.get('autoBuildOnSave')) {
			let needRebuild = false;
			let needReprepare = false;
			const changedFilePath = e.fileName;
			for (let i = 0; i < packReader.watchPaths.length; i++) {
				let watchPath = packReader.watchPaths[i];
				needReprepare = changedFilePath.indexOf(PathConstants.PACK_JSON) >= 0;
				if (needReprepare) {
					needRebuild = true;
					break;
				} else {
					needRebuild = changedFilePath.indexOf(watchPath) >= 0;
					if (needRebuild) {
						tasks.splice(0, tasks.length, ...packReader.tasks.filter(f => changedFilePath.indexOf(f.modulePath) >= 0));
						break;
					}
				}
			}
			if (needRebuild) {
				needReprepare ? prepare().then(() => {
					buildFunction(packReader.projects, packReader.tasks);
				}) : buildFunction(packReader.projects, tasks);
			}
		}
	});
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
		if (configuration.get('autoBuildOnFoldersChanged')) {
			prepare().then(() => {
				buildFunction(packReader.projects, packReader.tasks);
			});
		}
	});

}

// this method is called when your extension is deactivated
export function deactivate() { }
