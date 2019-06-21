# Change Log

All notable changes to the "Node Workspace Builder" extension will be documented in this file.

## 0.1.7
- `Added` Multi-task mode is supported now. When start a new build task while another build task is running, just push the new task to task queue.

## 0.1.6
- `Added` Multi-root workspace is supported now.

## 0.1.5
- `Fixed` Always getting an error showing `You currently have a build task running. Please wait until finished.` after a failed building.

## 0.1.4
- `Added` You can build a specified project via context menu now.
- `Added` Added keyboard shotcuts. Use `Ctrl` + `Alt` + `B` to build all project in the whole workspace, `Shift` + `Alt` + `W` to watch selected projects, and `Shift` + `Alt` + `B` to build selected projects (you must watch them first or projects not watched will not be built).

## 0.1.3
- `Fixed` Sometimes stacks on 'Building modules...'.

## 0.1.2
- `Added` Create output channel and display status on progress bar while building with integrated npm.

## 0.1.1
- `Changed` Modified README.md.

## 0.1.0
- `Added` Select NPM installation to build workspace.

## 0.0.7
- `Added` You can watch a node project with a context menu for now.
- `Changed` Hide terminal and show a progress bar while building.
- `Fixed` Build using command throws an exception on `v0.0.6`.

## 0.0.6
- `Changed` Build faster on saving documents: auto building on saving documents just build module which is modified for now.
- `Changed` You can build while project running for now. Notice that sometimes though it  was successfully built but does not affect immediatly if you are using webpack-dev-server.

## 0.0.5
- `Added` Added icon to extension pack.

## 0.0.4
- `Changed` Configuration `node-workspace-builder.autoBuildOnSave` is defaultly set to `true` for now.
- `Changed` Before starting a new build task firstly check if modified file is in watching path on saving text documents.
- `Fixed` Changing settings for this extension is with immediate effect for now.

## 0.0.3
- `Added` Added settings: `node-workspace-builder.buildModulesWithoutInstall`. For whose modules does not need install dependencies before building, specifying this to `true`, you can run build scripts directly.
- `Added` This extension is multi-platform supported now.
- `Changed` Stop running build task while there is still build task or node process running.

## 0.0.2
- `Added` Not just directly depended modules, you can build flatten dependencies for now.

## 0.0.1
- `Added` Basically implemented build functions.

## [Unreleased]
- Nothing.