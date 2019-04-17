# node-deps-helper README

This extension helps you to sync your source code to projects' dependencies folders which depends on it automatically. Only works when your source module and your projects are in the same workspace.

## Features

To watch project dependencies, put a `.nodedwswatcher` file in the project folder together with the `package.json` file.

## Requirements

Only Windows supported for now.

## Known issues

Only dependencies can be detected, not for peerDependencies and devDependencies.

## Extension Settings


This extension contributes the following settings:

* `node-workspace-builder.autoBuildOnSave`: Specify if build the whole workspace on saving text documents.
* `node-workspace-builder.autoBuildOnFoldersChanged`: Specify if build the whole workspace on workspace folders changed.
