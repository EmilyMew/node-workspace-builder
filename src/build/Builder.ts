import * as fs from 'fs';
import * as npm from 'npm';
import * as path from 'path';
import * as vscode from 'vscode';

import PathConstants from '../constant/PathConstants';
import TerminalHelper from '../terminal/TerminalHelper';
import CopyTask from '../model/CopyTask';

const remove = (src: string) => {
  let paths = fs.readdirSync(src);
  paths.forEach(path => {
    const _src = src + '/' + path;
    const stats = fs.statSync(_src);
    if (stats.isFile()) {
      fs.unlinkSync(_src);
    } else if (stats.isDirectory()) {
      remove(_src);
    }
  });
  fs.rmdirSync(src);
};

const copy = (src: string, dst: string) => {
  let paths = fs.readdirSync(src);
  paths.forEach(path => {
    const _src = src + '/' + path;
    const _dst = dst + '/' + path;
    fs.stat(_src, (err, stats) => {
      if (err) {
        throw err;
      }
      if (stats.isFile()) {
        let readable = fs.createReadStream(_src);
        let writable = fs.createWriteStream(_dst);
        readable.pipe(writable);
      } else if (stats.isDirectory()) {
        fs.access(dst, fs.constants.F_OK, (err) => {
          if (err) {
            fs.mkdirSync(dst);
            copy(_src, _dst);
          } else {
            copy(_src, _dst);
          }
        });
      }
    });
  });
};

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
        npm.load({ prefix: npmPath }, err => err ? reject(err) : resolve());
      }).then(() => {
        // progress.report({ message: 'Installing project dependencies...' });
        let installed = 0;
        projects.forEach(projectPath => {
          let needInstall = false;
          try {
            needInstall = !fs.statSync(`${projectPath}${PathConstants.NODE_MODULES}`).isDirectory();
          } catch (e) {
            needInstall = true;
          }
          if (needInstall) {
            needInstallAll = true;
            npm.commands.install([projectPath], (err, data) => {
              if (err) {
                Promise.reject(err);
              } else {
                installed++;
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
        // progress.report({ message: 'Installing module dependencies...' });
        const promises = tasks.map((task: CopyTask) => {
          let needInstallDep = false;
          if (!configuration.get('buildModulesWithoutInstall')) {
            try {
              const moduleDepPath = `${task.modulePath}${PathConstants.NODE_MODULES}`;
              needInstallDep = !fs.existsSync(moduleDepPath) || !fs.statSync(moduleDepPath).isDirectory();
            } catch (e) {
              needInstallDep = true;
            }
          }
          return new Promise((resolve, reject) => {
            if (needInstallDep) {
              npm.commands.install([task.modulePath], (err, data) => {
                err ? reject(err) : resolve();
              });
            } else {
              resolve();
            }
          }).then(() => {
            return new Promise((resolve, reject) => {
              npm.commands.explore([task.modulePath, 'npm run build'], (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  if (fs.existsSync(`${task.modulePath}${PathConstants.PACK_LOCK_JSON}`)) {
                    fs.unlinkSync(`${task.modulePath}${PathConstants.PACK_LOCK_JSON}`);
                  }
                  if (fs.existsSync(`${task.modulePath}${PathConstants.NODE_MODULES}`)) {
                    remove(`${task.modulePath}${PathConstants.NODE_MODULES}`);
                  }
                  let files = 0;
                  task.files.forEach(file => {
                    if (!fs.existsSync(task.projectDepPath) && !needInstallAll) {
                      fs.mkdirSync(task.projectDepPath, { recursive: true });
                    }
                    let targetPath = `${task.projectDepPath}${file}`;
                    let srcPath = `${task.modulePath}${file}`;
                    try {
                      copy(srcPath, targetPath);
                      files++;
                      remove(srcPath);
                      if (files === task.files.length) {
                        resolve();
                      }
                    } catch (err) {
                      console.log(err);
                      reject(err);
                    }
                  });
                }
              });
            });
          });
        });
        return Promise.all(promises);
      }).catch(err => {
        console.log(err);
        Promise.reject(err);
      });
    });
  }

}