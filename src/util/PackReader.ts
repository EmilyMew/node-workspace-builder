/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import { sep } from 'path';
import * as semver from 'semver';

import distinct from './Distinct';
import * as promise from '../mixins/Promise';
import FsHelper from './FsHelper';
import Dep from '../model/Dep';
import Pack from '../model/Pack';
import CopyTask from '../model/CopyTask';
import PathConstants from '../constant/PathConstants';

const distinctDeps = (deps: Dep[], packMap: Map<string, Pack>): Array<Dep> => {
  return distinct(new Array<Dep>().concat(...deps).filter(f => {
    const result = packMap.has(f.name);
    const pack = packMap.get(f.name);
    return result && pack !== null && pack !== undefined && semver.satisfies(pack.version, f.version);
  }), 'name').map(m => {
    const pack = packMap.get(m);
    return pack ? new Dep(m, pack.version) : new Dep('', '');
  }).filter(f => f.name !== '' && f.version !== '');
};

const getAllPackDeps = (deps: Dep[], packMap: Map<string, Pack>, projectPack: Pack): Array<CopyTask> => {
  const nextPackNames = new Array<string>();

  const taskQueue: Array<CopyTask> = distinctDeps(deps, packMap).map((dep: Dep) => {
    const depPack = packMap.get(dep.name);
    if (depPack === null || depPack === undefined || !semver.satisfies(depPack.version, dep.version)) {
      return new CopyTask('', '', []);
    }
    const targetPath = projectPack.path.replace(PathConstants.PACK_JSON, `${PathConstants.NODE_MODULES}${sep}${dep.name}${sep}`);
    const srcPath = depPack.path.replace(PathConstants.PACK_JSON, '');
    nextPackNames.push(dep.name);
    return new CopyTask(targetPath, srcPath, depPack.files);
  }).filter(f => f.projectDepPath !== '' && f.modulePath !== '');
  const deepDeps = nextPackNames.map((name) => {
    const pack = packMap.get(name);
    return pack ? pack.dependencies : [];
  });

  const isNewTask = (packName: string) => {
    return !taskQueue.map(m => m.modulePath).some(f1 => f1.includes(packName));
  };
  const nextLevelDeps = distinctDeps(new Array<Dep>().concat(...deepDeps), packMap).filter(f => isNewTask(f.name));

  if (nextLevelDeps.length > 0) {
    const nextLevelQueue = getAllPackDeps(nextLevelDeps, packMap, projectPack);
    taskQueue.splice(taskQueue.length, 0, ...nextLevelQueue);
  }
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
    const promises: promise.PromiseExecutor<unknown[]>[] = roots.map(root => {
      const executor: promise.PromiseExecutor<unknown[]> = (resolve: () => void) => {
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
              this.packMap.forEach((pack: Pack, key: string) => {
                if (!pack.watch) {
                  return;
                }
                taskQueue.splice(taskQueue.length, 0, ...getAllPackDeps(pack.dependencies, this.packMap, pack));
              });
              this.watchPaths.splice(0, this.watchPaths.length, PathConstants.PACK_JSON, ...taskQueue.map((task: CopyTask) => {
                return task.modulePath;
              }));
              this.tasks = taskQueue;
              resolve();
            });
          });
        }
      };
      return executor;
    });
    return promise.queue(...promises);
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
