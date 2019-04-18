# Node Workspace Builder README

This extension helps you to sync your source code to projects' dependencies folders which depends on it automatically. Only works when your source module and your projects are in the same workspace.

## Features

To watch project dependencies, put a `.nodedwswatcher` file in the project folder together with the `package.json` file.

## Requirements

Windows, MacOS, Linux are all supported for now. Needs VS Code 1.32 or newer.
* Notice: This extension is not well tested under MacOS and Linux because of author of this extension have only one PC running Windows 10.

## Known issues

Only dependencies can be detected, not for peerDependencies and devDependencies.

## Extension Settings


This extension contributes the following settings:

* `node-workspace-builder.autoBuildOnSave`: Specify if build the whole workspace on saving text documents.
* `node-workspace-builder.autoBuildOnFoldersChanged`: Specify if build the whole workspace on workspace folders changed.
* `node-workspace-builder.buildModulesWithoutInstall`: For whose modules does not need install dependencies before building, specifying this to `true`, you can run build scripts directly.
