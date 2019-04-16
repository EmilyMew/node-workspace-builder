// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from 'fs';
import * as vscode from 'vscode';

import PackReader from './file/PackReader';
import PathConstants from './constant/PathConstants';
import Task from './model/Task';


const packReader = new PackReader();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "node-deps-helper" is now active!');

	const buildFunction = () => {
		// The code you place here will be executed every time your command is executed
		const root = vscode.workspace.rootPath;
		const projects = new Array<string>();
		if (root !== undefined && root !== null) {
			packReader.scan(root, PathConstants.PLACEHOLDER, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(placeholders => {
				projects.splice(0, projects.length, ...placeholders.map(path => path.replace(PathConstants.PLACEHOLDER, '')));
				packReader.scan(root, PathConstants.PACK_JSON, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(packFiles => {
					packReader.prepareTasks(placeholders, packFiles).then(tasks => {
						const terminalCfg = vscode.workspace.getConfiguration('terminal.external');
						const terminal = vscode.window.createTerminal('cmd', terminalCfg.get('windowsExec'));
						terminal.show();
						projects.forEach(projectPath => {
							const needInstall = !fs.statSync(`${projectPath}${PathConstants.NODE_MODULES}`).isDirectory();
							if (needInstall) {
								terminal.sendText(`cd ${projectPath}`);
								terminal.sendText('call npm install');
							}
						});
						tasks.forEach((task: Task) => {
							const needInstallDep = !fs.statSync(`${task.modulePath}${PathConstants.NODE_MODULES}`).isDirectory();
							terminal.sendText(`cd ${task.modulePath}`);
							if (needInstallDep) {
								terminal.sendText('call npm install');
							}
							terminal.sendText('npm run build');
							task.files.forEach(file => {
								terminal.sendText(`rmdir /s /q ${task.projectDepPath}${file}`);
								terminal.sendText(`echo d|xcopy ${task.modulePath}${file} ${task.projectDepPath}${file} /d /e`);
							});
							terminal.sendText('exit');
						});
					});
				});
			});
			// Display a message box to the user
			vscode.window.showInformationMessage('Node Dependencies Helper synchronized dependencies for current workspace!');
		}
	};

	let build = vscode.commands.registerCommand('extension.buildWorkspace', buildFunction);
	context.subscriptions.push(build);

	const configuration = vscode.workspace.getConfiguration('node-workspace-builder');

	if (configuration.get('autoBuildOnSave')) {
		vscode.workspace.onDidSaveTextDocument(buildFunction);
	}
	if (configuration.get('autoBuildOnFoldersChanged')) {
		vscode.workspace.onDidChangeWorkspaceFolders(buildFunction);
	}

}

// this method is called when your extension is deactivated
export function deactivate() { }
