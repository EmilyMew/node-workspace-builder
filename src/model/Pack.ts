/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import Dep from './Dep';

/**
 * pacakge model.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class Pack {
  public path: string;
  public watch: boolean;
  public version: string;
  public files: string[];
  public dependencies: Array<Dep>;

  constructor(path: string, watch: boolean, version: string, files: string[], dependencies: Array<Dep>) {
    this.path = path;
    this.watch = watch;
    this.version = version;
    this.files = files;
    this.dependencies = dependencies;
  }
}