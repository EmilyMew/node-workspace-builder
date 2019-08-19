/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import * as npm from 'npm';
import { sep } from 'path';

import * as promise from '../mixins/Promise';
import PathConstants from '../constant/PathConstants';
import FsHelper from './FsHelper';
/**
 * builder.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class NpmHelper {

  /**
   * load
   * 
   * @param prefix npm path
   */
  static load(prefix: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      npm.load({ prefix }, err => err ? reject(err) : resolve());
    });
  }

  /**
   * run npm install
   *
   * @param path package folder path
   * @param dependencies package dependencies
   */
  static install(path: string, dependencies?: string[]): Promise<unknown> {
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
   * get build executor
   * 
   * @param path module path to build
   */
  static getBuildExecutor(path: string): promise.PromiseExecutor<unknown> {
    const executor: promise.PromiseExecutor<undefined> = (resolve, reject) => {
      const prefix = Object.getOwnPropertyDescriptor(npm, 'prefix');
      if (prefix && prefix.set) {
        prefix.set(path);
      }
      npm.commands['run-script'](['build'], (err, result) => {
        if (err) {
          return reject && reject(new Error(`Error building module: ${path}, error: ${err}`));
        }
        const promises = [];
        if (FsHelper.exists(`${path}${PathConstants.PACK_LOCK_JSON}`)) {
          promises.push(FsHelper.rm(`${path}${PathConstants.PACK_LOCK_JSON}`));
        }
        if (FsHelper.exists(`${path}${PathConstants.NODE_MODULES}`)) {
          promises.push(FsHelper.rm(`${path}${PathConstants.NODE_MODULES}`));
        }
        Promise.all(promises).then(() => {
          resolve();
        });
      });
    };
    return executor;
  }
}