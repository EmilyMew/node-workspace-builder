/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
import CopyTask from './CopyTask';

/**
 * build task model.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class BuildTask {
  public projects: Array<string>;
  public tasks: Array<CopyTask>;

  constructor(projects: Array<string>, tasks: Array<CopyTask>) {
    this.projects = projects;
    this.tasks = tasks;
  }
}