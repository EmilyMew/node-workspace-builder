/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import { sep } from 'path';
import * as npm from 'npm';
import * as vscode from 'vscode';
import * as semver from 'semver';

import distinct from './Distinct';
import * as promise from '../mixins/Promise';
import FsHelper from './FsHelper';
import PathConstants from '../constant/PathConstants';
import CopyTask from '../model/CopyTask';
import BuildTask from '../model/BuildTask';
import PackReader from './PackReader';
import OutputManager from './OutputManager';
import Configuration from './Configuration';
import Package from 'src/model/Package';
import { once } from 'events';

/**
 * builder.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class Builder {

  private static building: boolean = false;

  private static queue: Array<BuildTask> = [];

  private static output: OutputManager;

  /**
   * Initialize
   * 
   * @param output 
   */
  static init(output: OutputManager) {
    Builder.output = output;
  }

  /**
   * Build via npm integrated.
   * 
   * @param projects - project paths
   * @param tasks - copy file tasks
   */
  private static npmBuild(projects: string[], tasks: Array<CopyTask>): Thenable<any> {
    const modules = distinct(tasks, 'modulePath');
    const maxListeners = npm.getMaxListeners();
    npm.setMaxListeners(0);
    process.setMaxListeners(0);
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building workspace',
      cancellable: false
    }, (progress, token) => {
      const npmPath = `${process.env.APPDATA}${sep}npm`;
      let needInstallAll = false;
      const task = new Promise((resolve, reject) => {
        npm.load({ prefix: npmPath }, err => err ? reject(err) : resolve());
      }).then(() => {
        let timeout: NodeJS.Timeout | null = null;
        progress.report({ message: 'Installing project dependencies...' });
        const promises = projects.map(projectPath => {
          const executor: promise.PromiseExecutor<undefined> = (resolve, reject) => {
            if (FsHelper.isDirectory(`${projectPath}${PathConstants.NODE_MODULES}`)) {
              const pkg: Package = require(`${projectPath}${PathConstants.PACK_JSON}`);
              const dependencies = [
                ...PackReader.readDeps(pkg.dependencies),
                ...PackReader.readDeps(pkg.devDependencies)
              ];
              const depsToUpdateOrInstall = dependencies.filter(dep => {
                const depPath = `${projectPath}${PathConstants.NODE_MODULES}${sep}${dep.name}${sep}`;
                if (tasks.map(task => task.projectDepPath).includes(depPath)) {
                  // modules to build locally
                  return false;
                }
                if (!FsHelper.exists(depPath) || !FsHelper.isDirectory(depPath)) {
                  // modules not found
                  return true;
                }
                const depPkg: Package = require(`${depPath}${PathConstants.PACK_JSON}`);
                console.log(`${dep.name}.version: ${dep.version}, existing ${dep.name}.version: ${depPkg.version}, semver.satisfies: ${semver.satisfies(depPkg.version, dep.version)}`);
                return !semver.satisfies(depPkg.version, dep.version);
              }).map(dep => {
                return `${dep.name}@${dep.version}`;
              });
              depsToUpdateOrInstall.length > 0
                ? Builder.npmInstall(projectPath, depsToUpdateOrInstall).then(() => {
                  resolve();
                }) : resolve();
            } else {
              needInstallAll = true;
              Builder.output.log(`Start installing: ${projectPath}`);
              Builder.npmInstall(projectPath).then(() => {
                const pathArr = projectPath.split(sep);
                const projectName = pathArr[pathArr.length - 2];
                progress.report({ message: `Installing success: ${projectName}` });
                if (timeout !== null) {
                  clearTimeout(timeout);
                  timeout = null;
                  resolve();
                }
                timeout = setTimeout(() => {
                  progress.report({ message: 'Installing project dependencies...' });
                }, 5 * 1000);
              });
            }
          };
          return executor;
        });
        return promise.batch(promises, maxListeners).then(() => {
          if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
          }
        });
      }).then(() => {
        let timeout: NodeJS.Timeout | null = null;
        progress.report({ message: 'Installing module dependencies...' });
        const installModules = modules.map((modulePath: string) => {
          const executor: promise.PromiseExecutor<undefined> = (resolve, reject) => {
            const needInstallDep = Configuration.buildModulesWithoutInstall() ? false
              : !FsHelper.isDirectory(`${modulePath}${PathConstants.NODE_MODULES}`);
            if (!needInstallDep) {
              return resolve();
            }
            Builder.npmInstall(modulePath).then(() => {
              const pathArr = modulePath.split(sep);
              const projectName = pathArr[pathArr.length - 2];
              progress.report({ message: `Installing success: ${projectName}` });
              if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
                resolve();
              }
              timeout = setTimeout(() => {
                progress.report({ message: 'Installing module dependencies...' });
              }, 5 * 1000);
            });
          };
          return executor;
        });
        return promise.batch(installModules, maxListeners).then(() => {
          if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
          }
          const buildModules = modules.map((modulePath: string) => {
            progress.report({ message: 'Building modules...' });
            const executor: promise.PromiseExecutor<undefined> = (resolve, reject) => {
              Builder.output.log(`Start building: ${modulePath}`);
              const prefix = Object.getOwnPropertyDescriptor(npm, 'prefix');
              if (prefix && prefix.set) {
                prefix.set(modulePath);
              }
              npm.commands['run-script'](['build'], (err, result) => {
                if (err) {
                  return reject && reject(new Error(`Error building module: ${modulePath}, error: ${err}`));
                }
                const promises = [];
                if (FsHelper.exists(`${modulePath}${PathConstants.PACK_LOCK_JSON}`)) {
                  promises.push(FsHelper.rm(`${modulePath}${PathConstants.PACK_LOCK_JSON}`));
                }
                if (FsHelper.exists(`${modulePath}${PathConstants.NODE_MODULES}`)) {
                  promises.push(FsHelper.rm(`${modulePath}${PathConstants.NODE_MODULES}`));
                }
                Promise.all(promises).then(() => {
                  resolve();
                });
              });
            };
            return executor;
          });
          return promise.batch(buildModules, maxListeners);
        });
      }).then(() => {
        progress.report({ message: 'Building projects...' });
        const promises = tasks.map((task: CopyTask) => {
          const executor: promise.PromiseExecutor<undefined> = (resolve, reject) => {
            Builder.output.log(`Start synchronizing: ${task.modulePath} -> ${task.projectDepPath}`);
            const buildToProject = () => {
              const pros = task.files.map(file => {
                const executor: promise.PromiseExecutor<undefined> = (res, rej) => {
                  if (!FsHelper.exists(task.projectDepPath) && !needInstallAll) {
                    FsHelper.mkDir(task.projectDepPath, { recursive: true });
                  }
                  const targetPath = `${task.projectDepPath}${file}`;
                  const srcPath = `${task.modulePath}${file}`;
                  if (!FsHelper.exists(srcPath)) {
                    console.log(`path: ${srcPath} is not built, try again after 500ms.`);
                    setTimeout(() => {
                      buildToProject().then(() => {
                        res();
                      }).catch((err: any) => {
                        Builder.output.log(err);
                        if (rej !== undefined) {
                          rej(err);
                        }
                      });
                    }, 500);
                    return;
                  }
                  FsHelper.replace(srcPath, targetPath).then(() => {
                    res();
                  }).catch((err: any) => {
                    Builder.output.log(err);
                    if (rej !== undefined) {
                      rej(err);
                    }
                  });
                };
                return executor;
              });
              return promise.batch(pros, maxListeners);
            };
            buildToProject().then(() => {
              Builder.output.log(`Synchronize succeed: ${task.modulePath}`);
              resolve();
            }).catch(reject);
          };
          return executor;
        });
        return promise.batch(promises, maxListeners).then(() => {
          const removePromises = modules.reduce((result, modulePath) => {
            progress.report({ message: 'Cleaning modules...' });
            const task = tasks.find(f => f.modulePath === modulePath);
            if (task === undefined) {
              return result;
            }
            const files = task.files.map((file: string) => {
              const executor: promise.PromiseExecutor<undefined> = (resolve, reject) => {
                const srcPath = `${task.modulePath}${file}`;
                if (FsHelper.exists(srcPath)) {
                  FsHelper.rm(srcPath).then(() => {
                    resolve();
                  }).catch(reject);
                } else {
                  resolve();
                }
              };
              return executor;
            });
            return [...result, ...files];
          }, []);
          return promise.batch(removePromises, maxListeners);
        });
      }).then(() => {
        Builder.output.log('All build tasks had been finished.');
      }).catch(err => {
        Builder.output.log(err);
        Promise.reject(err);
      });
      return task;
    });
  }

  /**
   * valid path is included
   * 
   * @param task 
   */
  private static validPath(path: string) {
    let configuredIncluded: string[] = Configuration.includedPatterns();
    const modulePath = path.charAt(path.length - 1) === sep ? path.substring(0, path.lastIndexOf(sep)) : path;
    const moduleName = modulePath.substring(modulePath.lastIndexOf(sep) + 1);
    return (configuredIncluded.length === 0 || configuredIncluded.some((p: string) => new RegExp(p).test(moduleName)));
  }

  /**
   * run npm install
   * 
   * @param path package folder path
   */
  private static npmInstall(path: string, dependencies?: string[]): Promise<unknown> {
    const deps = dependencies || [];
    console.log(`> npm intall ${deps.join(' ')}`);
    return new Promise((resolve, reject) => {
      npm.commands.install(path, deps, (err: any, data: any) => {
        const pathArr = path.split(sep);
        const projectName = pathArr[pathArr.length - 2];
        if (err) {
          console.log(err);
          reject(new Error(`Install failed: ${projectName}`));
        } else {
          resolve();
        }
      });
    });
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
  static build(projects: string[], tasks: Array<CopyTask>): any;

  /**
   * Start build task.
   */
  public static build(): any {
    const buildAll = (queue: Array<BuildTask>, index = 0) => {
      if (index < queue.length) {
        const task = queue[index];
        Builder.npmBuild(task.projects, task.tasks).then(() => {
          buildAll(queue, index + 1);
        });
      } else {
        Builder.queue = [];
        Builder.building = false;
      }
    };
    const build = (projects: string[], tasks: Array<CopyTask>) => {
      new Promise((resolve, reject) => {
        Builder.queue.push(new BuildTask(projects.filter(Builder.validPath), tasks.filter(Builder.validTask)));
        if (Builder.building) {
          return reject(new Error('You currently have a build task running. Please wait until finished.'));
        }
        Builder.output.show();
        Builder.building = true;
        return resolve();
      }).then(() => {
        buildAll(Builder.queue);
      }).catch(err => {
        Builder.output.log(err);
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