# Change Log

All notable changes to the "Node Workspace Builder" extension will be documented in this file.

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