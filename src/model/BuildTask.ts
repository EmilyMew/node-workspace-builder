/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import CopyTask from './CopyTask';

/**
 * build task model.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class BuildTask {
  public succeed?: boolean;
  public projects: string[];
  public tasks: Array<CopyTask>;

  constructor(projects: string[], tasks: Array<CopyTask>) {
    this.projects = projects;
    this.tasks = tasks;
  }
}