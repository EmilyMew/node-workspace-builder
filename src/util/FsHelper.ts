/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';


/**
 * fs helper.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class FsHelper {

  private static output: vscode.OutputChannel;

  static setOutput(output: vscode.OutputChannel): void {
    FsHelper.output = output;
  }

  static exists(src: string): boolean {
    return fs.existsSync(src);
  }

  static readDir(src: string): Array<string> {
    return fs.readdirSync(src);
  }

  static isFile(src: string): boolean {
    if (!FsHelper.exists(src)) {
      return false;
    }
    try {
      return fs.statSync(src).isFile();
    } catch (e) {
      return false;
    }
  }

  static isDirectory(src: string): boolean {
    if (!FsHelper.exists(src)) {
      return false;
    }
    try {
      return fs.statSync(src).isDirectory();
    } catch (e) {
      return false;
    }
  }

  static mkDir(src: string, options?: any): void {
    fs.mkdirSync(src, options);
  }

  static writeFile(dst: string, data: string) {
    fs.writeFileSync(dst, data);
  }

  static rm(src: string) {
    return new Promise<Array<string> | undefined>((resolve, reject) => {
      const stats = fs.statSync(src);
      if (stats.isFile() || stats.isSymbolicLink()) {
        FsHelper.output.appendLine(`Delete file: ${src}`);
        fs.unlink(src, err => {
          err ? reject(err) : resolve();
        });
      } else if (stats.isDirectory()) {
        resolve(fs.readdirSync(src));
      }
    }).then((paths: Array<string> | undefined) => {
      if (paths !== undefined && paths !== null) {
        const promises = paths.map(p => {
          const _src = src + path.sep + p;
          return new Promise((res, rej) => {
            FsHelper.rm(_src).then(() => {
              res();
            }).catch(rej);
          });
        });
        return new Promise((resolve, reject) => {
          return Promise.all(promises).then(() => {
            setTimeout(() => {
              fs.rmdir(src, (err => {
                err ? reject(err) : resolve();
              }));
            }, 200);
          }).catch(reject);
        });
      } else {
        return Promise.resolve({});
      }
    }).catch((err: any) => {
      FsHelper.output.appendLine(err);
    });
  }

  static copy(src: string, dst: string) {
    return new Promise<Array<string> | undefined>((resolve, reject) => {
      fs.stat(src, (err, stats) => {
        if (err) {
          return reject(err);
        }
        if (stats.isFile()) {
          FsHelper.output.appendLine(`Copy file: ${src} -> ${dst}`);
          let readable = fs.createReadStream(src);
          let writable = fs.createWriteStream(dst);
          readable.pipe(writable);
          return resolve();
        } else if (stats.isDirectory()) {
          const paths = fs.readdirSync(src);
          if (fs.existsSync(dst)) {
            resolve(paths);
          } else {
            fs.mkdir(dst, err => {
              err ? reject(err) : resolve(paths);
            });
          }
        }
      });
    }).then((paths: Array<string> | undefined) => {
      if (paths !== undefined && paths !== null) {
        const promises = paths.map(p => {
          const _src = src + path.sep + p;
          const _dst = dst + path.sep + p;
          return new Promise((resolve, reject) => {
            FsHelper.copy(_src, _dst).then(() => {
              resolve();
            }).catch(reject);
          });
        });
        return Promise.all(promises);
      }
      return Promise.resolve([]);
    }).catch((err: any) => {
      FsHelper.output.appendLine(err);
    });
  }
}
