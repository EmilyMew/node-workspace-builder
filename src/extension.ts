// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';

import PackReader from './file/PackReader';
import TerminalHelper from './terminal/TerminalHelper';
import PathConstants from './constant/PathConstants';
import CopyTask from './model/CopyTask';

const packReader = new PackReader();

const prepare = (): Promise<undefined> => {
	return new Promise((resolve, reject) => {
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

const buildFunction = () => {
	const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
	new Promise((resolve, reject) => {
		for (let i = 0; i < vscode.window.terminals.length; i++) {
			const terminal = vscode.window.terminals[i];
			if (terminal.name === TerminalHelper.TERMINAL_NAME || terminal.name === TerminalHelper.TERMINAL_NAME_NODE) {
				return reject(new Error('You currently have build task or node task running. Please wait until all tasks are finished.'));
			}
		}
		resolve();
	}).then(() => {
		const terminal = TerminalHelper.createTerminal();
		terminal.show();
		packReader.projects.forEach(projectPath => {
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
		packReader.tasks.forEach((task: CopyTask) => {
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
		vscode.window.showErrorMessage(err.message);
	});
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	prepare();

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "node-deps-helper" is now active!');

	let build = vscode.commands.registerCommand('extension.buildWorkspace', buildFunction);
	context.subscriptions.push(build);

	vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
		const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
		if (configuration.get('autoBuildOnSave')) {
			let needRebuild = false;
			let needReprepare = false;
			const changedFilePath = e.fileName;
			for (let i = 0; i < packReader.watchPaths.length; i++) {
				let path = packReader.watchPaths[i];
				if (changedFilePath.indexOf(path) >= 0) {
					needRebuild = true;
					needReprepare = path === PathConstants.PACK_JSON;
					break;
				}
			}
			if (needRebuild) {
				needReprepare ? prepare().then(buildFunction) : buildFunction();
			}
		}
	});
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
		if (configuration.get('autoBuildOnFoldersChanged')) {
			prepare().then(buildFunction);
		}
	});

}

// this method is called when your extension is deactivated
export function deactivate() { }
