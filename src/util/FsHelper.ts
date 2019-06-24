/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import OutputManager from './OutPutManager';


/**
 * fs helper.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class FsHelper {

  /**
   * returns a file or directory is exists.
   * 
   * @param src file path
   */
  static exists(src: string): boolean {
    return fs.existsSync(src);
  }

  /**
   * read directory info
   * 
   * @param src directory path
   */
  static readDir(src: string): Array<string> {
    return fs.readdirSync(src);
  }

  /**
   * returns a path is a file
   * 
   * @param src path
   */
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

  /**
   * returns a path is a directory
   * 
   * @param src path
   */
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

  /**
   * Synchronous mkdir(2) - create a directory.
   * 
   * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
   * @param options Either the file mode, or an object optionally specifying the file mode and whether parent folders
   * should be created. If a string is passed, it is parsed as an octal integer. If not specified, defaults to `0o777`.
   */
  static mkDir(src: string, options?: any): void {
    fs.mkdirSync(src, options);
  }


  /**
   * Synchronously writes data to a file, replacing the file if it already exists.
   * 
   * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
   * URL support is _experimental_.
   * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
   * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
   * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
   * If `encoding` is not supplied, the default of `'utf8'` is used.
   * If `mode` is not supplied, the default of `0o666` is used.
   * If `mode` is a string, it is parsed as an octal integer.
   * If `flag` is not supplied, the default of `'w'` is used.
   */
  static writeFile(dst: string, data: string) {
    fs.writeFileSync(dst, data);
  }

  /**
   * remove a directory or a directory or a link, etc. recursively if is directory.
   * 
   * @param src path to remove
   */
  static rm(src: string) {
    return new Promise<Array<string> | undefined>((resolve, reject) => {
      const stats = fs.statSync(src);
      if (stats.isFile() || stats.isSymbolicLink()) {
        OutputManager.log(`Delete file: ${src}`);
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
      OutputManager.log(err);
    });
  }

  /**
   * copy a file or a directory. recursively if is directory.
   * 
   * @param src path of source file to copy
   * @param dst copy desitination path
   */
  static copy(src: string, dst: string) {
    return new Promise<Array<string> | undefined>((resolve, reject) => {
      fs.stat(src, (err, stats) => {
        if (err) {
          return reject(err);
        }
        if (stats.isFile()) {
          OutputManager.log(`Copy file: ${src} -> ${dst}`);
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
      OutputManager.log(err);
    });
  }
}
