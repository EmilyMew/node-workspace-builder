# Change Log

All notable changes to the "Node Workspace Builder" extension will be documented in this file.

## 0.2.1
- `Fixed` Stacks on install tasks.

## 0.2.0
- `Changed` When you run a build task, this extension will update your project dependencies which are not satisfied with version in your `package.json` for now.
- `Fixed` When you removed some files from your modules, the build task ran into a problem.

## 0.1.14
- `Added` Added configuration `node-workspace-builder.autoBuildOnStartUp` to specify if build immediately on start up.

## 0.1.13
- `Fixed` Setting `node-workspace-builder.showOutput` is not working.
- `Added` Added 996.ICU badge to README.md.

## 0.1.12
- `Added` Added `clean workspace` command. You can clean all `node_module` directories of your watched web projects with this command.
- `Added` Added `clean project` command. You can clean `node_module` directory of specified watched web project with this command.
- `Removed` Removed configuration `npmInstallationSelect`. Building with npm is stable now, removed methods to build with terminal commands.

## 0.1.11
- `Fixed` Webpack dev server ran into an exception cause of building while project is running.

## 0.1.10
- `Changed` Run a initial build at start up.
- `Fixed` Configuration error.

## 0.1.9
- `Changed` Logging on output pannel is disabled by default. If you need it, change the settings.

## 0.1.8
- `Added` Added settings `node-workspace-builder.includedPatterns` that specified modules to build using regExp patterns. If leave it as an empty array, this extension will build all modules in workspace.
- `Changed` Modified  file name of project placeholder.

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