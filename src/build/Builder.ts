import * as fs from 'fs';
import * as npm from 'npm';
import * as path from 'path';
import * as vscode from 'vscode';

import PathConstants from '../constant/PathConstants';
import TerminalHelper from '../terminal/TerminalHelper';
import CopyTask from '../model/CopyTask';

const rmDir = (src: string) => {
  const paths = fs.readdirSync(src);
  const promises = paths.map(p => {
    const _src = src + path.sep + p;
    return new Promise((resolve, reject) => {
      const stats = fs.statSync(_src);
      if (stats.isFile() || stats.isSymbolicLink()) {
        console.log('delete file: ', _src);
        fs.unlink(_src, err => {
          err ? reject(err) : resolve();
        });
      } else if (stats.isDirectory()) {
        rmDir(_src).then(() => {
          resolve();
        }).catch(reject);
      }
    });
  });
  return new Promise((resolve, reject) => {
    Promise.all(promises).then(() => {
      const pathsa = fs.readdirSync(src);
      setTimeout(() => {
        fs.rmdir(src, (err => {
          err ? reject(err) : resolve();
        }));
      }, 100);
    }).catch(reject);
  });
};

const copyDir = (src: string, dst: string) => {
  let paths = fs.readdirSync(src);
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dst)) {
      resolve(paths);
    } else {
      fs.mkdir(dst, err => {
        err ? reject(err) : resolve(paths);
      });
    }
  }).then(() => {
    const promises = paths.map(p => {
      return new Promise((resolve, reject) => {
        const _src = src + path.sep + p;
        const _dst = dst + path.sep + p;
        fs.stat(_src, (err, stats) => {
          if (err) {
            reject(err);
          }
          if (stats.isFile()) {
            console.log('copy file: ', _src);
            let readable = fs.createReadStream(_src);
            let writable = fs.createWriteStream(_dst);
            readable.pipe(writable);
            resolve();
          } else if (stats.isDirectory()) {
            copyDir(_src, _dst).then(() => {
              resolve();
            }).catch(reject);
          }
        });
      });
    });
    return Promise.all(promises);
  }).catch(err => {
    console.log(err);
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
                    rmDir(`${task.modulePath}${PathConstants.NODE_MODULES}`);
                  }
                  const buildToProject = () => {
                    const promises = task.files.map(file => {
                      return new Promise((res, rej) => {
                        if (!fs.existsSync(task.projectDepPath) && !needInstallAll) {
                          fs.mkdirSync(task.projectDepPath, { recursive: true });
                        }
                        const targetPath = `${task.projectDepPath}${file}`;
                        const srcPath = `${task.modulePath}${file}`;
                        if (!fs.existsSync(srcPath)) {
                          console.log('try again after 500ms.');
                          setTimeout(() => {
                            buildToProject().then(() => {
                              res();
                            }).catch(rej);
                          }, 500);
                          return;
                        }
                        copyDir(srcPath, targetPath).then(() => {
                          rmDir(srcPath);
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
                      resolve();
                    }).catch(reject);
                  }, 3000);
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