export default class Task {
  public projectDepPath: string;
  public modulePath: string;
  public files: Array<string>;

  constructor(projectDepPath: string, modulePath: string, files: Array<string>) {
    this.projectDepPath = projectDepPath;
    this.modulePath = modulePath;
    this.files = files;
  }
}