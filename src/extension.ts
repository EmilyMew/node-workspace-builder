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
import OutputManager from './util/OutPutManager';

let placeholder = PathConstants.PLACEHOLDER;

const packReader = new PackReader();


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const folders = vscode.workspace.workspaceFolders === undefined ? [] : vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "node-workspace-builder" is now active!');

	vscode.workspace.findFiles(`**/${PathConstants.PLACEHOLDER_OLD}`).then(value => {
		placeholder = value.length > 0 ? PathConstants.PLACEHOLDER_OLD : PathConstants.PLACEHOLDER;
	}).then(() => {
		packReader.prepare(folders, placeholder);
	});

	let build = vscode.commands.registerCommand('node-workspace-builder.buildWorkspace', () => {
		Builder.build(packReader);
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
			const pattern = /node_modules/g;
			const promises = realUris.filter(f => {
				const isNodeModules = pattern.test(f.fsPath);
				if (isNodeModules) {
					OutputManager.log('This is a dependency installation folder. Workspace builder will not watch this: ' + f.fsPath);
				}
				const isPackJson = f.fsPath.includes(PathConstants.PACK_JSON);
				const includesPackJson = FsHelper.exists(`${f.fsPath}${sep}${PathConstants.PACK_JSON}`);
				if (!isPackJson && !includesPackJson) {
					OutputManager.log('There is no package.json file found. This folder is not a node project folder: ' + f.fsPath);
				}
				return !isNodeModules && (isPackJson || includesPackJson);
			}).map(realUri => {
				const isPackJson = realUri.fsPath.includes(PathConstants.PACK_JSON);
				const file = isPackJson
					? realUri.fsPath.replace(PathConstants.PACK_JSON, placeholder)
					: `${realUri.fsPath}${sep}${placeholder}`;

				FsHelper.writeFile(file, '');
				return Promise.resolve();
			});
			return Promise.all(promises).then(() => {
				return packReader.prepare(folders);
			});
		}).then(() => {
			Builder.build(packReader);
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
			const pattern = /node_modules/g;
			const promises = realUris.filter(f => {
				let result = true;
				const isNodeModules = pattern.test(f.fsPath);
				if (isNodeModules) {
					OutputManager.log('This is a dependency installation folder. Workspace builder will not watch this: ' + f.fsPath);
					result = false;
					return result;
				}
				const isPackJson = f.fsPath.includes(PathConstants.PACK_JSON);
				const includesPackJson = FsHelper.exists(`${f.fsPath}${sep}${PathConstants.PACK_JSON}`);
				if (!isPackJson && !includesPackJson) {
					OutputManager.log('There is no package.json file found. This folder is not a node project folder: ' + f.fsPath);
					result = false;
					return result;
				}
				result = isPackJson ? FsHelper.exists(f.fsPath.replace(PathConstants.PACK_JSON, placeholder)) : FsHelper.exists(`${f.fsPath}${sep}${placeholder}`);
				if (!result) {
					OutputManager.log('This is not a watched project: ' + f.fsPath);
				}
				return result;
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
			Builder.build(files, tasks);
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
				needReprepare ? packReader.prepare(folders).then(() => {
					Builder.build(packReader);
				}) : Builder.build(packReader, tasks);
			}
		}
	});
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		const changedFolders = vscode.workspace.workspaceFolders === undefined ? [] : vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
		const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
		if (configuration.get('autoBuildOnFoldersChanged')) {
			packReader.prepare(changedFolders).then(() => {
				Builder.build(packReader);
			});
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
