/*
 * $Id:$
 * Copyright 2018 Emily36107@outlook.com All rights reserved.
 */
import * as vscode from 'vscode';

/**
 * output manager.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class OutputManager {

  private output: vscode.OutputChannel;

  /**
   * init output
   * 
   * @param output 
   */
  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  /**
   * is output enabled
   */
  public enabled(): boolean {
    const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
    const value = configuration.get('showOutput');
    return configuration.get('showOutput') === null || configuration.get('showOutput') === undefined
      ? false : (value instanceof Boolean ? value : JSON.parse(String(value)));
  }

  /**
   * show output
   */
  public show(): void {
    if (this.enabled()) {
      this.output.clear();
      this.output.show();
    }
  }

  /**
   * append line to output
   *
   * @param value string to log
   */
  public log(value: string): void {
    console.log(value);
    if (this.enabled()) {
      this.output.appendLine(value);
    }
  }
}
