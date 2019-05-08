import * as os from 'os';
import * as vscode from 'vscode';

export default class TerminalHelper {
  public static TERMINAL_NAME_NODE = 'node';
  public static TERMINAL_NAME = 'node-workspace-builder';
  private static TERMINAL_MAP = new Map<string, string>([['win32', 'windowsExec'], ['darwin', 'osxExec']]);

  public static createTerminal(): vscode.Terminal {
    const terminalCfg = vscode.workspace.getConfiguration('terminal.external');
    const terminalType = TerminalHelper.TERMINAL_MAP.get(os.platform()) || 'linuxExec';
    return vscode.window.createTerminal(TerminalHelper.TERMINAL_NAME, terminalCfg.get(terminalType));
  }

  public static execCdToDir(terminal: vscode.Terminal, path: string) {
    terminal.sendText(`cd ${path}`);
  }

  public static execRmDir(terminal: vscode.Terminal, path: string) {
    terminal.sendText(os.platform() === 'win32' ? `rmdir /s /q ${path}` : `rm -rf ${path}`);
  }

  public static execDelFile(terminal: vscode.Terminal, path: string) {
    terminal.sendText(os.platform() === 'win32' ? `del ${path}` : `rm ${path}`);
  }

  public static execCopyDir(terminal: vscode.Terminal, srcPath: string, targetPath: string) {
    terminal.sendText(os.platform() === 'win32' ? `echo d|xcopy ${srcPath} ${targetPath} /d /e` : `cp -rf ${srcPath} ${targetPath}`);
  }

  public static execNpmInstall(terminal: vscode.Terminal) {
    terminal.sendText(os.platform() === 'win32' ? 'call npm install' : 'npm install');
  }

  public static execNpmRunScript(terminal: vscode.Terminal, script: string) {
    terminal.sendText(os.platform() === 'win32' ? `call npm run ${script}` : `npm run ${script}`);
  }

  public static execExit(terminal: vscode.Terminal) {
    terminal.sendText('exit');
  }
}
