/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
export interface PromiseExecutor<T> {
  (resolve: (value?: T | PromiseLike<T>) => void, reject?: (reason?: any) => void): void;
}

export function queue<T>(...executors: PromiseExecutor<T>[]): Promise<T | T[]> {
  const result: T[] = [];
  const execute = (executorArr: PromiseExecutor<T>[], index: number = 0): Promise<T | T[]> => {
    if (index < executorArr.length) {
      const promise = new Promise(executorArr[index]);
      return promise.then(res => {
        result.push(res);
        return execute(executorArr, index + 1);
      });
    } else {
      return Promise.resolve(result);
    }
  };
  return execute(executors);
}

export function batch(promises: PromiseExecutor<any>[], maxListeners: number): Promise<any> {
  if (promises.length > maxListeners) {
    const promiseQueue = [];
    for (let i = 0; i < promises.length / maxListeners; i++) {
      const array = promises.slice(maxListeners * i, maxListeners * (i + 1));
      promiseQueue.push(array);
    }
    const executors: PromiseExecutor<unknown>[] = promiseQueue.map(array => {
      const executor: PromiseExecutor<unknown> = (resolve: (value?: any | PromiseLike<any>) => void, reject?: (reason?: any) => void) => {
        Promise.all(array.map(p => new Promise(p))).then(() => {
          process.nextTick(resolve);
        }).catch(reject);
      };
      return executor;
    });
    return queue(...executors);
  } else {
    return Promise.all(promises.map(p => new Promise(p)));
  }
}
