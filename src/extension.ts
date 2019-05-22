/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
import { sep } from 'path';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as clipboard from 'copy-paste';

import PackReader from './util/PackReader';
import PathConstants from './constant/PathConstants';
import CopyTask from './model/CopyTask';
import Builder from './util/Builder';
import FsHelper from './util/FsHelper';
import { rejects } from 'assert';

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
	const output = vscode.window.createOutputChannel('Node Workspace Builder');
	FsHelper.setOutput(output);
	Builder.setOutput(output);

	let build = vscode.commands.registerCommand('node-workspace-builder.buildWorkspace', () => {
		buildFunction(packReader.projects, packReader.tasks);
	});

	let watch = vscode.commands.registerCommand('node-workspace-builder.watchProject', (uri: vscode.Uri) => {
		new Promise<Array<vscode.Uri>>((resolve, reject) => {
			if (uri === undefined) {
				vscode.commands.executeCommand('copyFilePath').then(value => {
					const paths = clipboard.paste().split('\n');
					const uris = paths.map(m => vscode.Uri.file(m)).filter(f => FsHelper.exists(f.fsPath) && !f.fsPath.includes('vs_code_welcome_page'));
					uris && uris.length ? resolve(uris) : reject(new Error('No file or folder selected while running command directly.'));
				});
			} else {
				resolve([uri]);
			}
		}).then((realUris: Array<vscode.Uri>) => {
			const promises = realUris.filter(f => {
				if (/node_modules/.test(f.fsPath)) {
					output.appendLine('This is a dependency installation folder. Workspace builder will not watch this: ' + f.fsPath);
				}
				const isPackJson = f.fsPath.includes(PathConstants.PACK_JSON);
				const includesPackJson = FsHelper.exists(`${f.fsPath}${sep}${PathConstants.PACK_JSON}`);
				if (!isPackJson && !includesPackJson) {
					output.appendLine('There is no package.json file found. This folder is not a node project folder: ' + f.fsPath);
				}
				return !/node_modules/.test(f.fsPath) && (isPackJson || includesPackJson);
			}).map(realUri => {
				const isPackJson = realUri.fsPath.includes(PathConstants.PACK_JSON);
				const file = isPackJson
					? realUri.fsPath.replace(PathConstants.PACK_JSON, PathConstants.PLACEHOLDER)
					: `${realUri.fsPath}${sep}${PathConstants.PLACEHOLDER}`;

				FsHelper.writeFile(file, '');
				return Promise.resolve();
			});
			return Promise.all(promises).then(prepare);
		}).then(() => {
			buildFunction(packReader.projects, packReader.tasks);
		}).catch(err => {
			vscode.window.showWarningMessage(err.message);
		});
	});

	let buildProject = vscode.commands.registerCommand('node-workspace-builder.buildProject', (uri) => {
		new Promise<Array<vscode.Uri>>((resolve, reject) => {
			if (uri === undefined) {
				vscode.commands.executeCommand('copyFilePath').then(value => {
					const paths = clipboard.paste().split('\n');
					const uris = paths.map(m => vscode.Uri.file(m)).filter(f => FsHelper.exists(f.fsPath) && !f.fsPath.includes('vs_code_welcome_page'));
					uris && uris.length ? resolve(uris) : reject(new Error('No file or folder selected while running command directly.'));
				});
			} else {
				resolve([uri]);
			}
		}).then((realUris: Array<vscode.Uri>) => {
			const promises = realUris.filter(f => {
				if (/node_modules/.test(f.fsPath)) {
					output.appendLine('This is a dependency installation folder. Workspace builder will not watch this: ' + f.fsPath);
				}
				const isPackJson = f.fsPath.includes(PathConstants.PACK_JSON);
				const includesPackJson = FsHelper.exists(`${f.fsPath}${sep}${PathConstants.PACK_JSON}`);
				if (!isPackJson && !includesPackJson) {
					output.appendLine('There is no package.json file found. This folder is not a node project folder: ' + f.fsPath);
				}
				return !/node_modules/.test(f.fsPath) && (isPackJson || includesPackJson);
			}).map(realUri => {
				const isPackJson = realUri.fsPath.includes(PathConstants.PACK_JSON);
				const file = isPackJson ? realUri.fsPath.replace(PathConstants.PACK_JSON, '') : `${realUri.fsPath}${sep}`;
				return Promise.resolve(file);
			});
			return Promise.all(promises);
		}).then((files: Array<string>) => {
			const tasks = new Array<CopyTask>();
			files.forEach(file => {
				tasks.splice(tasks.length, 0, ...packReader.tasks.filter(f => f.projectDepPath.includes(file)));
			});
			buildFunction(files, tasks);
		}).catch(err => {
			vscode.window.showErrorMessage(err.message);
		});
	});

	context.subscriptions.push(build);
	context.subscriptions.push(watch);
	context.subscriptions.push(buildProject);

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
