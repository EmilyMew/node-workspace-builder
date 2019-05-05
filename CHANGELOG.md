# Change Log

All notable changes to the "Node Workspace Builder" extension will be documented in this file.

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
- `Added` Select NPM installation to build workspace.