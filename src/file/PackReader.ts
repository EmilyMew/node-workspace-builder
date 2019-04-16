import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

import Dep from '../model/Dep';
import Pack from '../model/Pack';
import Task from '../model/Task';
import PathConstants from '../constant/PathConstants';

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

  async prepareTasks(placeholders: Array<string>, packFiles: Array<string>): Promise<Array<Task>> {
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
    const taskQueue = new Array<Task>();
    packMap.forEach((value: Pack, key: string) => {
      if (!value.watch) {
        return;
      }
      let array = new Array<Dep>();
      value.dependencies.forEach((dep: Dep) => {
        const pack = packMap.get(dep.name);
        if (pack === undefined || pack === null) {
          return;
        }
        if (semver.satisfies(value.version, dep.version) && array !== null && array !== undefined) {
          array.push(dep);
          const targetPath = value.path.replace(PathConstants.PACK_JSON, `${PathConstants.NODE_MODULES}${path.sep}${dep.name}${path.sep}`);
          const srcPath = pack.path.replace(PathConstants.PACK_JSON, '');
          const task = new Task(targetPath, srcPath, pack.files);
          taskQueue.push(task);
        }
      });
    });
    console.log(taskQueue);
    return taskQueue;
  }

}