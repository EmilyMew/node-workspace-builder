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

  private static output: vscode.OutputChannel;

  private static enabled: boolean;

  /**
   * init output.
   */
  public static init(): void {
    const configuration = vscode.workspace.getConfiguration('node-workspace-builder');
    const value = configuration.get("showOutput");
    OutputManager.enabled = configuration.get("showOutput") === null || configuration.get("showOutput") === undefined
      ? false : (value instanceof Boolean ? value : JSON.parse(String(value)));
    if (OutputManager.enabled && OutputManager.output === undefined) {
      OutputManager.output = vscode.window.createOutputChannel('Node Workspace Builder');
    }
  }

  /**
   * show output
   */
  public static show(): void {
    if (OutputManager.enabled) {
      OutputManager.output.clear();
      OutputManager.output.show();
    }
  }

  /**
   * append line to output
   * 
   * @param value string to log
   */
  public static log(value: string): void {
    console.log(value);
    OutputManager.enabled && OutputManager.output.appendLine(value);
  }
}
