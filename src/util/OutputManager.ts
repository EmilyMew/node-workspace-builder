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

  private output: vscode.OutputChannel | undefined;

  /**
   * init output
   * 
   * @param output 
   */
  constructor(output: vscode.OutputChannel | null) {
    if (output !== null) {
      this.output = output;
    }
  }

  /**
   * is output enabled
   */
  public static enabled(): boolean {
    const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
    const value = configuration.get('showOutput');
    return configuration.get('showOutput') === null || configuration.get('showOutput') === undefined
      ? false : (value instanceof Boolean ? value : JSON.parse(String(value)));
  }

  /**
   * init output channel
   * 
   * @param output 
   */
  public init(output: vscode.OutputChannel): void {
    this.output = output;
  }

  /**
   * show output
   */
  public show(): void {
    if (OutputManager.enabled() && this.output) {
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
    if (OutputManager.enabled() && this.output) {
      this.output.appendLine(value);
    }
  }

  /**
   * destroy output channel
   */
  public destroy(): void {
    if (this.output) {
      this.output.dispose();
    }
  }
}
