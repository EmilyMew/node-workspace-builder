/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */

/**
 * dep model.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class Dep {
  public name: string;
  public version: string;

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }
}