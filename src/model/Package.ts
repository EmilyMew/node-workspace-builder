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
export default interface Package {
  name: string;
  version: string;
  description: string;
  author: string;
  private: boolean;
  scripts: Object;
  files: string[];
  dependencies: Object;
  devDependencies: Object;
  browserslist: string[];
}
