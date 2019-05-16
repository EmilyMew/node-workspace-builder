/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
function distict<T>(arr: Array<T>, property: string): Array<any> {
  return Array.from(new Set(arr.map((item: any) => item[property])));
}
export default distict;