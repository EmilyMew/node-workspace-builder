import Dep from './Dep';

export default class Pack {
  public path: string;
  public watch: boolean;
  public version: string;
  public files: Array<string>;
  public dependencies: Array<Dep>;

  constructor(path: string, watch: boolean, version: string, files: Array<string>, dependencies: Array<Dep>) {
    this.path = path;
    this.watch = watch;
    this.version = version;
    this.files = files;
    this.dependencies = dependencies;
  }
}