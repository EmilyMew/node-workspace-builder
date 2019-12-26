/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import { sep } from 'path';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as clipboard from 'copy-paste';

import PackReader from './util/PackReader';
import PathConstants from './constant/PathConstants';
import CopyTask from './model/CopyTask';
import OutputManager from './util/OutPutManager';
import Builder from './util/Builder';
import FsHelper from './util/FsHelper';
import Configuration from './util/Configuration';
import Pack from './model/Pack';

let placeholder = PathConstants.PLACEHOLDER;

const packReader = new PackReader();
let output: vscode.OutputChannel | null = null;
if (OutputManager.enabled()) {
	output = vscode.window.createOutputChannel('Node Workspace Builder');
}
const outputMgr = new OutputManager(output);
Builder.init(outputMgr);
FsHelper.init(outputMgr);


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
		return packReader.prepare(folders, placeholder);
	}).then(() => {
		if (Configuration.autoBuildOnStartUp()) {
			console.log('Initial build at start up.');
			Builder.build(packReader);
		}
	});

	const build = vscode.commands.registerCommand('node-workspace-builder.buildWorkspace', () => {
		packReader.prepare(folders, placeholder).then(() => {
			Builder.build(packReader);
		});
	});

	const clean = vscode.commands.registerCommand('node-workspace-builder.cleanWorkspace', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Cleaning workspace',
			cancellable: false
		}, (progress, token) => {
			return Promise.all(packReader.projects.map(projectPath => {
				progress.report({ message: 'Cleaning project dependencies...' });
				return Promise.all([FsHelper.rm(`${projectPath}${PathConstants.NODE_MODULES}`),
				FsHelper.rm(`${projectPath}${PathConstants.PACK_LOCK_JSON}`)]);
			}));
		});
	});

	const watch = vscode.commands.registerCommand('node-workspace-builder.watchProject', (uri: vscode.Uri) => {
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
					outputMgr.log('This is a dependency installation folder. Workspace builder will not watch this: ' + f.fsPath);
				}
				const isPackJson = f.fsPath.includes(PathConstants.PACK_JSON);
				const includesPackJson = FsHelper.exists(`${f.fsPath}${sep}${PathConstants.PACK_JSON}`);
				if (!isPackJson && !includesPackJson) {
					outputMgr.log('There is no package.json file found. This folder is not a node project folder: ' + f.fsPath);
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

	const getWatchedProjects = (uri: vscode.Uri | undefined) => {
		return new Promise<Array<vscode.Uri>>((resolve, reject) => {
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
					outputMgr.log('This is a dependency installation folder. Workspace builder will not build this: ' + f.fsPath);
					result = false;
					return result;
				}
				const isPackJson = f.fsPath.includes(PathConstants.PACK_JSON);
				const includesPackJson = FsHelper.exists(`${f.fsPath}${sep}${PathConstants.PACK_JSON}`);
				if (!isPackJson && !includesPackJson) {
					outputMgr.log('There is no package.json file found. This folder is not a node project folder: ' + f.fsPath);
					result = false;
					return result;
				}
				result = isPackJson ? FsHelper.exists(f.fsPath.replace(PathConstants.PACK_JSON, placeholder)) : FsHelper.exists(`${f.fsPath}${sep}${placeholder}`);
				if (!result) {
					outputMgr.log('This is not a watched project: ' + f.fsPath);
				}
				return result;
			}).map(realUri => {
				const isPackJson = realUri.fsPath.includes(PathConstants.PACK_JSON);
				const file = isPackJson ? realUri.fsPath.replace(PathConstants.PACK_JSON, '') : `${realUri.fsPath}${sep}`;
				return Promise.resolve(file);
			});
			return Promise.all(promises);
		});
	};

	const buildProject = vscode.commands.registerCommand('node-workspace-builder.buildProject', (uri) => {
		getWatchedProjects(uri).then((files: string[]) => {
			const tasks = new Array<CopyTask>();
			files.forEach(file => {
				tasks.splice(tasks.length, 0, ...packReader.tasks.filter(f => f.projectDepPath.includes(file)));
			});
			Builder.build(files, tasks);
		}).catch(err => {
			vscode.window.showErrorMessage(err.message);
		});
	});

	const cleanProject = vscode.commands.registerCommand('node-workspace-builder.cleanProject', (uri) => {
		getWatchedProjects(uri).then((files: string[]) => {
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Cleaning project',
				cancellable: false
			}, (progress, token) => {
				return Promise.all(files.map(projectPath => {
					progress.report({ message: 'Cleaning project dependencies...' });
					return Promise.all([FsHelper.rm(`${projectPath}${PathConstants.NODE_MODULES}`),
					FsHelper.rm(`${projectPath}${PathConstants.PACK_LOCK_JSON}`)]);
				}));
			});
		}).catch(err => {
			vscode.window.showErrorMessage(err.message);
		});
	});

	context.subscriptions.push(build);
	context.subscriptions.push(clean);
	context.subscriptions.push(watch);
	context.subscriptions.push(buildProject);
	context.subscriptions.push(cleanProject);

	const fileEventHandler = (fileName: string) => {
		const tasks = new Array<CopyTask>();
		let ignored = fileName.includes(PathConstants.PACK_LOCK_JSON)
			|| fileName.includes(PathConstants.NODE_MODULES)
			|| fileName.includes(PathConstants.PLACEHOLDER)
			|| fileName.includes(PathConstants.PLACEHOLDER_OLD);
		let isBuildResultChange = false;
		packReader.packMap.forEach((pack: Pack, key: string) => {
			if (fileName.includes(pack.path.replace(PathConstants.PACK_JSON, ''))) {
				isBuildResultChange = pack.files.some(f => fileName.includes(`${sep}${f}`));
			}
		});
		ignored = ignored || isBuildResultChange;
		if (Configuration.autoBuildOnSave() && !ignored) {
			let needRebuild = false;
			let needReprepare = false;
			for (let i = 0; i < packReader.watchPaths.length; i++) {
				let watchPath = packReader.watchPaths[i];
				needReprepare = fileName.includes(PathConstants.PACK_JSON);
				if (needReprepare) {
					needRebuild = true;
					break;
				} else {
					needRebuild = fileName.includes(watchPath);
					if (needRebuild) {
						tasks.splice(0, tasks.length, ...packReader.tasks.filter(f => fileName.includes(f.modulePath)));
						break;
					}
				}
			}
			if (needRebuild) {
				needReprepare ? packReader.prepare(folders, placeholder).then(() => {
					Builder.build(packReader);
				}) : Builder.build(packReader, tasks);
			}
		}
	};
	const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*.*');

	fileSystemWatcher.onDidChange(e => {
		console.log('File changed on disk: ' + e.fsPath);
		fileEventHandler(e.fsPath);
	});
	fileSystemWatcher.onDidCreate(e => {
		console.log('File created on disk: ' + e.fsPath);
		fileEventHandler(e.fsPath);
	});
	fileSystemWatcher.onDidDelete(e => {
		console.log('File deleted on disk: ' + e.fsPath);
		fileEventHandler(e.fsPath);
	});

	vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
		fileEventHandler(e.fileName);
	});

	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		const changedFolders = vscode.workspace.workspaceFolders === undefined ? [] : vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
		if (Configuration.autoBuildOnFoldersChanged()) {
			packReader.prepare(changedFolders, placeholder).then(() => {
				Builder.build(packReader);
			});
		}
	});

	vscode.workspace.onDidChangeConfiguration((e) => {
		if (Configuration.effected(e, Configuration.SHOW_OUTPUT)) {
			if (OutputManager.enabled()) {
				output = vscode.window.createOutputChannel('Node Workspace Builder');
				outputMgr.init(output);
				outputMgr.show();
			} else if (!OutputManager.enabled()) {
				outputMgr.destroy();
			}
		}
		if (Configuration.effected(e, Configuration.INCLUDED_PATTERNS)) {
			const folders = vscode.workspace.workspaceFolders === undefined ? [] : vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
			packReader.prepare(folders, placeholder).then(() => {
				Builder.build(packReader);
			});
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
