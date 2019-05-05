import * as fs from 'fs';
import * as npm from 'npm';
import * as path from 'path';
import * as vscode from 'vscode';

import PathConstants from '../constant/PathConstants';
import TerminalHelper from '../terminal/TerminalHelper';
import CopyTask from '../model/CopyTask';

export default class Builder {

  static terminalBuild(projects: Array<string>, tasks: Array<CopyTask>): Thenable<any> {
    const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building workspace',
      cancellable: false
    }, (progress, token) => {
      const terminal = TerminalHelper.createTerminal();
      let needInstallAll = false;
      projects.forEach(projectPath => {
        let needInstall = false;
        try {
          needInstall = !fs.statSync(`${projectPath}${PathConstants.NODE_MODULES}`).isDirectory();
        } catch (e) {
          needInstall = true;
        }
        if (needInstall) {
          needInstallAll = true;
          TerminalHelper.execCdToDir(terminal, projectPath);
          TerminalHelper.execNpmInstall(terminal);
        }
      });
      tasks.forEach((task: CopyTask) => {
        let needInstallDep = false;
        if (!configuration.get('buildModulesWithoutInstall')) {
          try {
            const moduleDepPath = `${task.modulePath}${PathConstants.NODE_MODULES}`;
            needInstallDep = !fs.existsSync(moduleDepPath) || !fs.statSync(moduleDepPath).isDirectory();
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
        task.files.forEach((file: string) => {
          if (!fs.existsSync(task.projectDepPath) && !needInstallAll) {
            fs.mkdirSync(task.projectDepPath, { recursive: true });
          }
          let targetPath = `${task.projectDepPath}${file}`;
          let srcPath = `${task.modulePath}${file}`;
          TerminalHelper.execRmDir(terminal, targetPath);
          TerminalHelper.execCopyDir(terminal, srcPath, targetPath);
          TerminalHelper.execRmDir(terminal, srcPath);
        });
      });
      TerminalHelper.execExit(terminal);
      return new Promise(resolve => {
        let event = vscode.window.onDidCloseTerminal(e => {
          if (e.name === TerminalHelper.TERMINAL_NAME) {
            progress.report({ message: 'Almost there...' });
            event.dispose();
            resolve();
          }
        });
      });
    });
  }

  static npmBuild(projects: Array<string>, tasks: Array<CopyTask>): Thenable<any> {
    const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building workspace',
      cancellable: false
    }, (progress, token) => {
      const npmPath = `${process.env.APPDATA}${path.sep}npm`;
      let needInstallAll = false;
      return new Promise((resolve, reject) => {
        console.log('before npm load: ', npmPath);
        npm.load({ prefix: npmPath }, err => {
          console.log('loaded');
          err ? reject(err) : resolve();
        });
      }).then(() => {
        let installed = 0;
        console.log('installed', installed);
        projects.forEach(projectPath => {
          let needInstall = false;
          try {
            needInstall = !fs.statSync(`${projectPath}${PathConstants.NODE_MODULES}`).isDirectory();
          } catch (e) {
            needInstall = true;
          }
          if (needInstall) {
            needInstallAll = true;
            console.log('before npm install project:', projectPath);
            npm.commands.install([projectPath], (err, data) => {
              if (err) {
                console.log('npm install error!', err);
                Promise.reject(err);
              } else {
                installed++;
                console.log('npm installed!', data);
                if (installed === projects.length) {
                  Promise.resolve();
                }
              }
            });
          } else {
            Promise.resolve();
          }
        });
      }).then(() => {
        // progress.report({ message: 'Installing project dependencies...' });
        let buildProgress = 0;
        console.log('buildProcess', buildProgress);
        tasks.forEach((task: CopyTask) => {
          let needInstallDep = false;
          if (!configuration.get('buildModulesWithoutInstall')) {
            try {
              const moduleDepPath = `${task.modulePath}${PathConstants.NODE_MODULES}`;
              needInstallDep = !fs.existsSync(moduleDepPath) || !fs.statSync(moduleDepPath).isDirectory();
            } catch (e) {
              needInstallDep = true;
            }
          }
          console.log('before npm install module:', task.modulePath);
          new Promise((resolve, reject) => {
            if (needInstallDep) {
              npm.commands.install([task.modulePath], (err, data) => {
                if (err) {
                  console.log('npm install error!', err);
                  Promise.reject(err);
                } else {
                  console.log('npm installed!', data);
                }
                console.log('before npm build module:', task.modulePath);
                resolve();
              });
            } else {
              resolve();
            }
          }).then(() => {
            npm.commands['run-script'](['build'], (err, data) => {
              if (err) {
                console.log('npm build error!', err);
                Promise.reject(err);
              } else {
                console.log('npm build success!', data);
                if (fs.existsSync(`${task.modulePath}${PathConstants.PACK_LOCK_JSON}`)) {
                  fs.unlinkSync(`${task.modulePath}${PathConstants.PACK_LOCK_JSON}`);
                }
                if (fs.existsSync(`${task.modulePath}${PathConstants.NODE_MODULES}`)) {
                  fs.rmdirSync(`${task.modulePath}${PathConstants.NODE_MODULES}`);
                }
                task.files.forEach(file => {
                  if (!fs.existsSync(task.projectDepPath) && !needInstallAll) {
                    fs.mkdirSync(task.projectDepPath, { recursive: true });
                  }
                  let targetPath = `${task.projectDepPath}${file}`;
                  let srcPath = `${task.modulePath}${file}`;
                  if (fs.existsSync(srcPath)) {
                    fs.copyFileSync(srcPath, targetPath);
                  }
                });
                buildProgress++;
                if (buildProgress === projects.length) {
                  Promise.resolve();
                }
              }
            });
          });
        });
        Promise.resolve();
      }).catch(err => {
        console.log(err);
        Promise.reject(err);
      });
    });
  }

}