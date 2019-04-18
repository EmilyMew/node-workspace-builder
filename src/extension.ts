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


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const configuration = vscode.workspace.getConfiguration('node-workspace-builder');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "node-deps-helper" is now active!');

	const buildFunction = () => {
		// The code you place here will be executed every time your command is executed
		const root = vscode.workspace.rootPath;
		const projects = new Array<string>();
		if (root !== undefined && root !== null) {
			new Promise((resolve, reject) => {
				for (let i = 0; i < vscode.window.terminals.length; i++) {
					const terminal = vscode.window.terminals[i];
					if (terminal.name === TerminalHelper.TERMINAL_NAME || terminal.name === TerminalHelper.TERMINAL_NAME_NODE) {
						return reject(new Error('You currently have build task or node task running. Please wait until all tasks are finished.'));
					}
				}
				resolve();
			}).then(() => {
				packReader.scan(root, PathConstants.PLACEHOLDER, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(placeholders => {
					projects.splice(0, projects.length, ...placeholders.map(path => path.replace(PathConstants.PLACEHOLDER, '')));
					packReader.scan(root, PathConstants.PACK_JSON, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(packFiles => {
						packReader.prepareCopyTasks(placeholders, packFiles).then(tasks => {
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
									let targetPath = `${task.projectDepPath}${file}`;
									let srcPath = `${task.modulePath}${file}`;
									TerminalHelper.execRmDir(terminal, targetPath);
									TerminalHelper.execCopyDir(terminal, srcPath, targetPath);
									TerminalHelper.execRmDir(terminal, srcPath);
								});
								TerminalHelper.execExit(terminal);
							});
						});
					});
				});
				// Display a message box to the user
				vscode.window.showInformationMessage('Node Dependencies Helper synchronized dependencies for current workspace!');
			}).catch(err => {
				vscode.window.showErrorMessage(err.message);
			});
		}
	};

	let build = vscode.commands.registerCommand('extension.buildWorkspace', buildFunction);
	context.subscriptions.push(build);

	if (configuration.get('autoBuildOnSave')) {
		vscode.workspace.onDidSaveTextDocument(buildFunction);
	}
	if (configuration.get('autoBuildOnFoldersChanged')) {
		vscode.workspace.onDidChangeWorkspaceFolders(buildFunction);
	}

}

// this method is called when your extension is deactivated
export function deactivate() { }
