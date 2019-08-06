/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import { OutputChannel } from 'vscode';
import Configuration from './Configuration';

/**
 * output manager.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class OutputManager {

  private output: OutputChannel | undefined;

  /**
   * init output
   * 
   * @param output 
   */
  constructor(output: OutputChannel | null) {
    if (output !== null) {
      this.output = output;
    }
  }

  /**
   * is output enabled
   */
  public static enabled(): boolean {
    return  Configuration.showOutput();
  }

  /**
   * init output channel
   * 
   * @param output 
   */
  public init(output: OutputChannel): void {
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
