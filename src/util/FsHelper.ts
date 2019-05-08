import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

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

  static rm(src: string): void {
    fs.unlinkSync(src);
  }

  static writeFile(dst: string, data: string) {
    fs.writeFileSync(dst, data);
  }

  static rmDir(src: string) {
    const paths = fs.readdirSync(src);
    const promises = paths.map(p => {
      const _src = src + path.sep + p;
      return new Promise((resolve, reject) => {
        const stats = fs.statSync(_src);
        if (stats.isFile() || stats.isSymbolicLink()) {
          FsHelper.output.appendLine(`Delete file: ${_src}`);
          fs.unlink(_src, err => {
            err ? reject(err) : resolve();
          });
        } else if (stats.isDirectory()) {
          FsHelper.rmDir(_src).then(() => {
            resolve();
          }).catch(reject);
        }
      });
    });
    return new Promise((resolve, reject) => {
      Promise.all(promises).then(() => {
        setTimeout(() => {
          fs.rmdir(src, (err => {
            err ? reject(err) : resolve();
          }));
        }, 100);
      }).catch(reject);
    });
  }

  static copyDir(src: string, dst: string) {
    let paths = fs.readdirSync(src);
    return new Promise((resolve, reject) => {
      if (fs.existsSync(dst)) {
        resolve(paths);
      } else {
        fs.mkdir(dst, err => {
          err ? reject(err) : resolve(paths);
        });
      }
    }).then(() => {
      const promises = paths.map(p => {
        return new Promise((resolve, reject) => {
          const _src = src + path.sep + p;
          const _dst = dst + path.sep + p;
          fs.stat(_src, (err, stats) => {
            if (err) {
              reject(err);
            }
            if (stats.isFile()) {
              FsHelper.output.appendLine(`Copy file: ${_src}`);
              let readable = fs.createReadStream(_src);
              let writable = fs.createWriteStream(_dst);
              readable.pipe(writable);
              resolve();
            } else if (stats.isDirectory()) {
              FsHelper.copyDir(_src, _dst).then(() => {
                resolve();
              }).catch(reject);
            }
          });
        });
      });
      return Promise.all(promises);
    }).catch(err => {
      console.log(err);
    });
  }
}
