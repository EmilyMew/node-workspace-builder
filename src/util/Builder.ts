import { sep } from 'path';
import * as npm from 'npm';
import * as vscode from 'vscode';

import FsHelper from './FsHelper';
import TerminalHelper from './TerminalHelper';
import PathConstants from '../constant/PathConstants';
import CopyTask from '../model/CopyTask';

export default class Builder {

  private static output: vscode.OutputChannel;

  static setOutput(output: vscode.OutputChannel): void {
    Builder.output = output;
  }

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
        if (!FsHelper.isDirectory(`${projectPath}${PathConstants.NODE_MODULES}`)) {
          needInstallAll = true;
          TerminalHelper.execCdToDir(terminal, projectPath);
          TerminalHelper.execNpmInstall(terminal);
        }
      });
      tasks.forEach((task: CopyTask) => {
        const needInstallDep = configuration.get('buildModulesWithoutInstall')
          ? false
          : !FsHelper.isDirectory(`${task.modulePath}${PathConstants.NODE_MODULES}`);
        TerminalHelper.execCdToDir(terminal, task.modulePath);
        if (needInstallDep) {
          TerminalHelper.execNpmInstall(terminal);
        }
        TerminalHelper.execNpmRunScript(terminal, 'build');
        // clean up after build;
        TerminalHelper.execDelFile(terminal, `${task.modulePath}${PathConstants.PACK_LOCK_JSON}`);
        TerminalHelper.execRmDir(terminal, `${task.modulePath}${PathConstants.NODE_MODULES}`);
        task.files.forEach((file: string) => {
          if (!FsHelper.exists(task.projectDepPath) && !needInstallAll) {
            FsHelper.mkDir(task.projectDepPath, { recursive: true });
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
      const npmPath = `${process.env.APPDATA}${sep}npm`;
      let needInstallAll = false;
      return new Promise((resolve, reject) => {
        npm.load({ prefix: npmPath }, err => err ? reject(err) : resolve());
      }).then(() => {
        progress.report({ message: 'Installing project dependencies...' });
        const promises = projects.map(projectPath => {
          return new Promise((resolve, reject) => {
            if (!FsHelper.isDirectory(`${projectPath}${PathConstants.NODE_MODULES}`)) {
              needInstallAll = true;
              npm.commands.explore([projectPath, 'npm install'], (err, data) => {
                err ? reject(err) : resolve();
              });
            } else {
              resolve();
            }
          });
        });
        return Promise.all(promises);
      }).then(() => {
        progress.report({ message: 'Installing module dependencies...' });
        const promises = tasks.map((task: CopyTask) => {
          return new Promise((resolve, reject) => {
            const needInstallDep = configuration.get('buildModulesWithoutInstall')
              ? false
              : !FsHelper.isDirectory(`${task.modulePath}${PathConstants.NODE_MODULES}`);
            needInstallDep
              ? npm.commands.explore([task.modulePath, 'npm install'], (err, data) => err ? reject(err) : resolve())
              : resolve();
          }).then(() => {
            progress.report({ message: 'Building modules...' });
            return new Promise((resolve, reject) => {
              Builder.output.appendLine(`Start building: ${task.modulePath}`);
              npm.commands.explore([task.modulePath, 'npm run build'], (err, data) => {
                if (err) {
                  return reject(err);
                }
                if (FsHelper.exists(`${task.modulePath}${PathConstants.PACK_LOCK_JSON}`)) {
                  FsHelper.rm(`${task.modulePath}${PathConstants.PACK_LOCK_JSON}`);
                }
                if (FsHelper.exists(`${task.modulePath}${PathConstants.NODE_MODULES}`)) {
                  FsHelper.rmDir(`${task.modulePath}${PathConstants.NODE_MODULES}`);
                }
                const buildToProject = () => {
                  const promises = task.files.map(file => {
                    return new Promise((res, rej) => {
                      if (!FsHelper.exists(task.projectDepPath) && !needInstallAll) {
                        FsHelper.mkDir(task.projectDepPath, { recursive: true });
                      }
                      const targetPath = `${task.projectDepPath}${file}`;
                      const srcPath = `${task.modulePath}${file}`;
                      if (!FsHelper.exists(srcPath)) {
                        console.log('try again after 500ms.');
                        setTimeout(() => {
                          buildToProject().then(() => {
                            res();
                          }).catch(rej);
                        }, 500);
                        return;
                      }
                      FsHelper.copyDir(srcPath, targetPath).then(() => {
                        FsHelper.rmDir(srcPath);
                        res();
                      }).catch(err => {
                        console.log(err);
                        rej(err);
                      });
                    });
                  });
                  return Promise.all(promises);
                };
                setTimeout(() => {
                  buildToProject().then(() => {
                    Builder.output.appendLine(`Build succeed: ${task.modulePath}`);
                    resolve();
                  }).catch(reject);
                }, 3000);
              });
            });
          });
        });
        return Promise.all(promises);
      }).catch(err => {
        Builder.output.appendLine(err);
        Promise.reject(err);
      });
    });
  }

}