// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from 'fs';
import * as vscode from 'vscode';

import PackReader from './file/PackReader';
import TerminalHelper from './terminal/TerminalHelper';
import PathConstants from './constant/PathConstants';
import CopyTask from './model/CopyTask';

const packReader = new PackReader();

const prepare = (): Promise<undefined> => {
	return new Promise((resolve) => {
		const root = vscode.workspace.rootPath;
		if (root !== undefined && root !== null) {
			packReader.scan(root, PathConstants.PLACEHOLDER, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(placeholders => {
				packReader.projects.splice(0, packReader.projects.length, ...placeholders.map(path => path.replace(PathConstants.PLACEHOLDER, '')));
				packReader.scan(root, PathConstants.PACK_JSON, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(packFiles => {
					packReader.prepareCopyTasks(placeholders, packFiles);
					resolve();
				});
			});
		}
	});
};

const buildFunction = (projects: Array<string>, tasks: Array<CopyTask>) => {
	const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
	new Promise((resolve, reject) => {
		for (let i = 0; i < vscode.window.terminals.length; i++) {
			const terminal = vscode.window.terminals[i];
			if (terminal.name === TerminalHelper.TERMINAL_NAME) {
				return reject(new Error('You currently have build task or node task running. Please wait until all tasks are finished.'));
			}
		}
		resolve();
	}).then(() => {
		const terminal = TerminalHelper.createTerminal();
		terminal.show();
		projects.forEach(projectPath => {
			let needInstall = false;
			try {
				needInstall = !fs.statSync(`${projectPath}${PathConstants.NODE_MODULES}`).isDirectory();
			} catch (e) {
				needInstall = true;
			}
			if (needInstall) {
				TerminalHelper.execCdToDir(terminal, projectPath);
				TerminalHelper.execNpmInstall(terminal);
			}
		});
		tasks.forEach((task: CopyTask) => {
			let needInstallDep = false;
			if (!configuration.get('buildModulesWithoutInstall')) {
				try {
					needInstallDep = !fs.statSync(`${task.modulePath}${PathConstants.NODE_MODULES}`).isDirectory();
				} catch (e) {
					needInstallDep = true;
				}
			}
			TerminalHelper.execCdToDir(terminal, task.modulePath);
			if (needInstallDep) {
				TerminalHelper.execNpmInstall(terminal);
			}
			TerminalHelper.execNpmRunScript(terminal, 'build');
			// clean up after build;
			TerminalHelper.execDelFile(terminal, `${task.modulePath}${PathConstants.PACK_LOCK_JSON}`);
			TerminalHelper.execRmDir(terminal, `${task.modulePath}${PathConstants.NODE_MODULES}`);
			task.files.forEach(file => {
				if (!fs.existsSync(task.projectDepPath)) {
					fs.mkdirSync(task.projectDepPath);
				}
				let targetPath = `${task.projectDepPath}${file}`;
				let srcPath = `${task.modulePath}${file}`;
				TerminalHelper.execRmDir(terminal, targetPath);
				TerminalHelper.execCopyDir(terminal, srcPath, targetPath);
				TerminalHelper.execRmDir(terminal, srcPath);
			});
		});
		TerminalHelper.execExit(terminal);
		// Display a message box to the user
		vscode.window.showInformationMessage('Node Dependencies Helper synchronized dependencies for current workspace!');
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

	let build = vscode.commands.registerCommand('extension.buildWorkspace', () => {
		buildFunction(packReader.projects, packReader.tasks);
	});
	context.subscriptions.push(build);

	vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
		const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
		const tasks = new Array<CopyTask>();
		if (configuration.get('autoBuildOnSave')) {
			let needRebuild = false;
			let needReprepare = false;
			const changedFilePath = e.fileName;
			for (let i = 0; i < packReader.watchPaths.length; i++) {
				let path = packReader.watchPaths[i];
				needReprepare = changedFilePath.indexOf(PathConstants.PACK_JSON) >= 0;
				if (needReprepare) {
					needRebuild = true;
					break;
				} else {
					needRebuild = changedFilePath.indexOf(path) >= 0;
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
