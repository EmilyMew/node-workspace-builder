/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */

/**
 * install or update dependency task model.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class InstallDepTask {
  public project: string;
  public deps: string[];

  constructor(project: string, deps: string[]) {
    this.project = project;
    this.deps = deps;
  }
}