/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
import { sep } from 'path';
import * as npm from 'npm';
import * as vscode from 'vscode';

import distinct from './distinct';
import FsHelper from './FsHelper';
import TerminalHelper from './TerminalHelper';
import PathConstants from '../constant/PathConstants';
import CopyTask from '../model/CopyTask';
import BuildTask from '../model/BuildTask';
import PackReader from './PackReader';
import OutputManager from './OutputManager';

/**
 * builder.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class Builder {

  private static building: boolean = false;

  private static queue: Array<BuildTask> = [];

  /**
   * Build via terminal commands.
   * 
   * @param projects - project paths
   * @param tasks - copy file tasks
   */
  private static terminalBuild(projects: Array<string>, tasks: Array<CopyTask>): Thenable<any> {
    const modules = distinct(tasks, 'modulePath');
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
      modules.forEach((modulePath: string) => {
        const needInstallDep = configuration.get('buildModulesWithoutInstall')
          ? false
          : !FsHelper.isDirectory(`${modulePath}${PathConstants.NODE_MODULES}`);
        TerminalHelper.execCdToDir(terminal, modulePath);
        if (needInstallDep) {
          TerminalHelper.execNpmInstall(terminal);
        }
        TerminalHelper.execNpmRunScript(terminal, 'build');
        // clean up after build;
        TerminalHelper.execDelFile(terminal, `${modulePath}${PathConstants.PACK_LOCK_JSON}`);
        TerminalHelper.execRmDir(terminal, `${modulePath}${PathConstants.NODE_MODULES}`);
      });
      tasks.forEach((task: CopyTask) => {
        task.files.forEach((file: string) => {
          if (!FsHelper.exists(task.projectDepPath) && !needInstallAll) {
            FsHelper.mkDir(task.projectDepPath, { recursive: true });
          }
          const targetPath = `${task.projectDepPath}${file}`;
          const srcPath = `${task.modulePath}${file}`;
          TerminalHelper.execRmDir(terminal, targetPath);
          TerminalHelper.execCopyDir(terminal, srcPath, targetPath);
        });
      });
      modules.forEach((modulePath: string) => {
        const task = tasks.find(f => f.modulePath === modulePath);
        if (task === undefined) {
          return;
        }
        task.files.forEach((file: string) => {
          const srcPath = `${task.modulePath}${file}`;
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

  /**
   * Build via npm integrated.
   * 
   * @param projects - project paths
   * @param tasks - copy file tasks
   */
  private static npmBuild(projects: Array<string>, tasks: Array<CopyTask>): Thenable<any> {
    const modules = distinct(tasks, 'modulePath');
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
            if (FsHelper.isDirectory(`${projectPath}${PathConstants.NODE_MODULES}`)) {
              resolve();
            } else {
              needInstallAll = true;
              OutputManager.log(`Start installing: ${projectPath}`);
              npm.commands.explore([projectPath, 'npm install'], (err, data) => {
                err ? reject(new Error('Install failed: ' + projectPath)) : resolve();
              });
            }
          });
        });
        return Promise.all(promises);
      }).then(() => {
        progress.report({ message: 'Installing module dependencies...' });
        const installModules = modules.map((modulePath: string) => {
          return new Promise((resolve, reject) => {
            const needInstallDep = configuration.get('buildModulesWithoutInstall')
              ? false
              : !FsHelper.isDirectory(`${modulePath}${PathConstants.NODE_MODULES}`);
            needInstallDep
              ? npm.commands.explore([modulePath, 'npm install'], (err, data) => {
                err ? reject(new Error(`Error installing module: ${modulePath}, error: ${err}`)) : resolve();
              })
              : resolve();
          });
        });
        return Promise.all(installModules).then(() => {
          const buildModules = modules.map((modulePath: string) => {
            progress.report({ message: 'Building modules...' });
            return new Promise((resolve, reject) => {
              OutputManager.log(`Start building: ${modulePath}`);
              npm.commands.explore([modulePath, 'npm run build'], (err, data) => {
                if (err) {
                  return reject(new Error(`Error building module: ${modulePath}, error: ${err}`));
                }
                if (FsHelper.exists(`${modulePath}${PathConstants.PACK_LOCK_JSON}`)) {
                  FsHelper.rm(`${modulePath}${PathConstants.PACK_LOCK_JSON}`);
                }
                if (FsHelper.exists(`${modulePath}${PathConstants.NODE_MODULES}`)) {
                  FsHelper.rm(`${modulePath}${PathConstants.NODE_MODULES}`);
                }
                resolve();
              });
            });
          });
          return Promise.all(buildModules);
        });
      }).then(() => {
        progress.report({ message: 'Building projects...' });
        const promises = tasks.map((task: CopyTask) => {
          return new Promise((resolve, reject) => {
            OutputManager.log(`Start building: ${task.modulePath} -> ${task.projectDepPath}`);
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
                  FsHelper.replace(srcPath, targetPath).then(() => {
                    res();
                  }).catch((err: any) => {
                    OutputManager.log(err);
                    rej(err);
                  });
                });
              });
              return Promise.all(promises);
            };
            setTimeout(() => {
              buildToProject().then(() => {
                OutputManager.log(`Build succeed: ${task.modulePath}`);
                resolve();
              }).catch(reject);
            }, 3000);
          });
        });
        return Promise.all(promises).then(() => {
          const removePromises = modules.map(modulePath => {
            const task = tasks.find(f => f.modulePath === modulePath);
            if (task === undefined) {
              return Promise.resolve([]);
            }
            const filePromises = task.files.map((file: string) => {
              const srcPath = `${task.modulePath}${file}`;
              return FsHelper.exists(srcPath) ? FsHelper.rm(srcPath) : Promise.resolve();
            });
            return Promise.all(filePromises);
          });
          return Promise.all(removePromises);
        });
      }).catch(err => {
        OutputManager.log(err);
        Promise.reject(err);
      });
    });
  }

  /**
   * valid path is included
   * 
   * @param task 
   */
  private static validPath(path: string) {
    const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
    let configuredIncluded: Array<string> = configuration.get('includedPatterns') || [];
    const modulePath = path.charAt(path.length - 1) === sep ? path.substring(0, path.lastIndexOf(sep)) : path;
    const moduleName = modulePath.substring(modulePath.lastIndexOf(sep) + 1);
    return (configuredIncluded.length === 0 || configuredIncluded.some((p: string) => new RegExp(p).test(moduleName)));
  }

  /**
   * valid task is included
   * 
   * @param task 
   */
  private static validTask(task: CopyTask) {
    return Builder.validPath(task.projectDepPath) && Builder.validPath(task.modulePath);
  }

  /**
   * Start build task.
   *
   * @param packReader - packreader
   */
  static build(packReader: PackReader): any;

  /**
   * Start build task.
   *
   * @param packReader - packreader
   * @param tasks - copy file tasks
   */
  static build(packReader: PackReader, tasks: Array<CopyTask>): any;

  /**
   * Start build task.
   *
   * @param projects - project paths
   * @param tasks - copy file tasks
   */
  static build(projects: Array<string>, tasks: Array<CopyTask>): any;

  /**
   * Start build task.
   */
  public static build(): any {
    const buildAll = (queue: Array<BuildTask>, index = 0) => {
      if (index < queue.length) {
        const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
        const task = queue[index];
        const buildFunction = configuration.get('npmInstallationSelect') === 'integrated' ? Builder.npmBuild : Builder.terminalBuild;
        buildFunction(task.projects, task.tasks).then(() => {
          buildAll(queue, index + 1);
        });
      } else {
        Builder.queue = [];
        Builder.building = false;
      }
    };
    const build = (projects: Array<string>, tasks: Array<CopyTask>) => {
      new Promise((resolve, reject) => {
        Builder.queue.push(new BuildTask(projects.filter(Builder.validPath), tasks.filter(Builder.validTask)));
        if (Builder.building) {
          return reject(new Error('You currently have a build task running. Please wait until finished.'));
        }
        OutputManager.show();
        Builder.building = true;
        return resolve();
      }).then(() => {
        buildAll(Builder.queue);
      }).catch(err => {
        OutputManager.log(err);
        Builder.building = false;
      });
    };
    if (arguments.length === 1 && arguments[0] instanceof PackReader) {
      build(arguments[0].projects, arguments[0].tasks);
    } else if (arguments.length === 2) {
      if (arguments[0] instanceof Array) {
        build(arguments[0], arguments[1]);
      } else if (arguments[0] instanceof PackReader) {
        build(arguments[0].projects, arguments[1]);
      }
    }
  }
}