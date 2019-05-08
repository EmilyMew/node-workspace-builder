
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

export default class PackReader {

  public projects: Array<string> = new Array<string>();

  public tasks: Array<CopyTask> = new Array<CopyTask>();

  public watchPaths: Array<string> = new Array<string>();

  async scan(root: string, matches: string, ignores: Array<string>): Promise<Array<string>> {
    let paths = new Array<string>();
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
        this.scan(filePath, matches, ignores).then((subPaths: any) => {
          paths.splice(paths.length - 1, 0, ...subPaths);
        });
      }
    });
    return paths;
  }

  prepareCopyTasks(placeholders: Array<string>, packFiles: Array<string>) {
    this.watchPaths = new Array<string>();
    const packMap = new Map<string, Pack>();
    packFiles.forEach(filePath => {
      let pack = require(filePath);
      let dependencies = new Array<Dep>();
      if (pack.dependencies !== null && pack.dependencies !== undefined) {
        Object.keys(pack.dependencies).forEach((key: string) => {
          const dep = new Dep(key, pack.dependencies[key]);
          dependencies.push(dep);
        });
      }
      const watch = placeholders.includes(filePath.replace(PathConstants.PACK_JSON, PathConstants.PLACEHOLDER));
      if (watch) {
        this.watchPaths.push(filePath);
      }
      packMap.set(pack.name, new Pack(filePath, watch, pack.version, pack.files, dependencies));
    });
    const taskQueue = new Array<CopyTask>();
    packMap.forEach((value: Pack, key: string) => {
      if (!value.watch) {
        return;
      }
      taskQueue.splice(taskQueue.length, 0, ...getAllPackDeps(value, packMap, value));
    });
    this.watchPaths.splice(0, this.watchPaths.length, PathConstants.PACK_JSON, ...taskQueue.map((task: CopyTask) => {
      return task.modulePath;
    }));
    this.tasks = taskQueue;
  }

}