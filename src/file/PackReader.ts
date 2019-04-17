import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

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
      const targetPath = projectPack.path.replace(PathConstants.PACK_JSON, `${PathConstants.NODE_MODULES}${path.sep}${dep.name}${path.sep}`);
      const srcPath = depPack.path.replace(PathConstants.PACK_JSON, '');
      const task = new CopyTask(targetPath, srcPath, depPack.files);
      taskQueue.push(task);
    }
    taskQueue.splice(0, 0, ...getAllPackDeps(depPack, packMap, projectPack));
  });
  return taskQueue;

};

export default class PackReader {
  async scan(root: string, matches: string, ignores: Array<string>): Promise<Array<string>> {
    let paths = new Array<string>();
    const files = fs.readdirSync(root);
    files.forEach((file: any) => {
      const filePath = `${root}${path.sep}${file}`;
      for (let i in ignores) {
        if (ignores[i] && new RegExp(ignores[i]).test(file)) {
          return;
        }
      }
      const isFile = fs.statSync(filePath).isFile();
      if (isFile && new RegExp(matches).test(filePath)) {
        paths.push(filePath);
      } else if (fs.statSync(filePath).isDirectory()) {
        this.scan(filePath, matches, ignores).then((subPaths: any) => {
          paths.splice(paths.length - 1, 0, ...subPaths);
        });
      }
    });
    return paths;
  }

  async prepareCopyTasks(placeholders: Array<string>, packFiles: Array<string>): Promise<Array<CopyTask>> {
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
      packMap.set(pack.name, new Pack(filePath, watch, pack.version, pack.files, dependencies));
    });
    const taskQueue = new Array<CopyTask>();
    packMap.forEach((value: Pack, key: string) => {
      if (!value.watch) {
        return;
      }
      taskQueue.splice(taskQueue.length, 0, ...getAllPackDeps(value, packMap, value));
    });
    console.log(taskQueue);
    return taskQueue;
  }

}