/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import { sep } from 'path';
import * as semver from 'semver';

import FsHelper from './FsHelper';
import Dep from '../model/Dep';
import Pack from '../model/Pack';
import CopyTask from '../model/CopyTask';
import PathConstants from '../constant/PathConstants';

const getAllPackDeps = (pack: Pack, packMap: Map<string, Pack>, projectPack: Pack): Array<CopyTask> => {
  const taskQueue = new Array<CopyTask>();
  pack.dependencies.forEach((dep: Dep) => {
    const depPack = packMap.get(dep.name);
    if (depPack === undefined || depPack === null) {
      return taskQueue;
    }
    if (semver.satisfies(depPack.version, dep.version)) {
      const targetPath = projectPack.path.replace(PathConstants.PACK_JSON, `${PathConstants.NODE_MODULES}${sep}${dep.name}${sep}`);
      const srcPath = depPack.path.replace(PathConstants.PACK_JSON, '');
      const task = new CopyTask(targetPath, srcPath, depPack.files);
      taskQueue.push(task);
    }
    taskQueue.splice(0, 0, ...getAllPackDeps(depPack, packMap, projectPack).filter(f => taskQueue.find(f1 => f.modulePath === f1.modulePath) === undefined || taskQueue.find(f1 => f.modulePath === f1.modulePath) === null));
  });
  return taskQueue;

};

const scan = async (root: string, matches: string, ignores: string[] = []): Promise<string[]> => {
  let paths: string[] = [];
  const files = FsHelper.readDir(root);
  files.forEach((file: any) => {
    const filePath = `${root}${sep}${file}`;
    for (let i in ignores) {
      if (ignores[i] && new RegExp(ignores[i]).test(file)) {
        return;
      }
    }
    const isFile = FsHelper.isFile(filePath);
    if (isFile && new RegExp(matches).test(filePath)) {
      paths.push(filePath);
    } else if (FsHelper.isDirectory(filePath)) {
      scan(filePath, matches, ignores).then((subPaths: any) => {
        paths.splice(paths.length - 1, 0, ...subPaths);
      });
    }
  });
  return paths;
};


/**
 * pacakge reader.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class PackReader {

  public packMap: Map<string, Pack> = new Map<string, Pack>();

  public projects: string[] = [];

  public tasks: Array<CopyTask> = new Array<CopyTask>();

  public watchPaths: string[] = [];

  /**
   * prepare tasks
   * 
   * @param roots vscode workspace root paths
   */
  prepare(roots: string[], placeholder: string = PathConstants.PLACEHOLDER): Promise<unknown[]> {
    this.watchPaths = [];
    this.projects = [];
    const promises = roots.map(root => {
      return new Promise((resolve) => {
        if (root === undefined || root === null) {
          resolve();
        } else {
          scan(root, placeholder, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(placeholders => {
            this.projects.splice(this.projects.length, 0, ...placeholders.map(filePath => filePath.replace(placeholder, '')));
            scan(root, PathConstants.PACK_JSON, [PathConstants.NODE_MODULES, PathConstants.GIT]).then(packFiles => {
              packFiles.forEach(filePath => {
                let pack = require(filePath);
                let dependencies = PackReader.readDeps(pack.dependencies);
                if (pack.dependencies !== null && pack.dependencies !== undefined) {
                  dependencies = PackReader.readDeps(pack.dependencies);
                }
                const watch = placeholders.includes(filePath.replace(PathConstants.PACK_JSON, placeholder));
                if (watch) {
                  this.watchPaths.push(filePath);
                }
                this.packMap.set(pack.name, new Pack(filePath, watch, pack.version, pack.files, dependencies));
              });
              const taskQueue = new Array<CopyTask>();
              this.packMap.forEach((value: Pack, key: string) => {
                if (!value.watch) {
                  return;
                }
                taskQueue.splice(taskQueue.length, 0, ...getAllPackDeps(value, this.packMap, value));
              });
              this.watchPaths.splice(0, this.watchPaths.length, PathConstants.PACK_JSON, ...taskQueue.map((task: CopyTask) => {
                return task.modulePath;
              }));
              this.tasks = taskQueue;
              resolve();
            });
          });
        }
      });
    });
    return Promise.all(promises);
  }

  /**
   * serialize dependencies
   * 
   * @param deps 
   */
  public static readDeps(deps: Object | undefined | null): Array<Dep> {
    if (deps === null || deps === undefined) {
      return [];
    }
    return Object.entries(deps).map((value: [string, any], index: number) => {
      const name = value[0];
      const version: string = value[1];
      return new Dep(name, version);
    });
  }
}