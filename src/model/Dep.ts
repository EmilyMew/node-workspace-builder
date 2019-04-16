export default class Dep {
  public name: string;
  public version: string;

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }
}