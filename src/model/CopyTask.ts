/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */

/**
 * copy task model.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class CopyTask {
  public projectDepPath: string;
  public modulePath: string;
  public files: string[];

  constructor(projectDepPath: string, modulePath: string, files: string[]) {
    this.projectDepPath = projectDepPath;
    this.modulePath = modulePath;
    this.files = files;
  }
}