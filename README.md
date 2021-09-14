# Node Workspace Builder README
<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=EmilyWang.node-workspace-builder">
    <img src="https://vsmarketplacebadge.apphb.com/version-short/EmilyWang.node-workspace-builder.svg?style=flat-square">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=EmilyWang.node-workspace-builder">
    <img src="https://vsmarketplacebadge.apphb.com/installs-short/EmilyWang.node-workspace-builder.svg?style=flat-square">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=EmilyWang.node-workspace-builder">
    <img src="https://vsmarketplacebadge.apphb.com/rating-short/EmilyWang.node-workspace-builder.svg?style=flat-square">
  </a>
</p>

Work by '996', sick in ICU. Keep your work-life balance, be a developer with happiness!
<p>
  <a href="https://996.icu">
    <img src="https://img.shields.io/badge/link-996.icu-red.svg" alt="996.icu" />
  </a>
  <a href="https://github.com/996icu/996.ICU/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/license-Anti%20996-blue.svg" alt="996.icu" />
  </a>
</p>

This extension helps you to sync your source code to projects' dependencies folders which depends on it automatically. Only works when your source module and your projects are in the same workspace.

If you think this extension is useful and would like to buy me a juice:
<p>
  <a href="https://paypal.me/emily36107">
    <img src="https://img.shields.io/badge/donate-paypal-brightgreen.svg">
  </a>
</p>

## Requirements

Windows, MacOS, Linux are all supported for now. Needs VS Code 1.32 or newer.
* Notice: This extension is not well tested under MacOS and Linux because of author of this extension have only one PC running Windows 10.

## Known Issues

None.

## Extension Settings

This extension contributes the following settings:

| Settings                                            | Description                                                                                           |
|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `node-workspace-builder.autoBuildOnStartUp`         | Specify if build the whole workspace on start up.                                                     |
| `node-workspace-builder.autoBuildOnSave`            | Specify if build the whole workspace on saving text documents.                                        |
| `node-workspace-builder.autoBuildOnFoldersChanged`  | Specify if build the whole workspace on workspace folders changed.                                    |
| `node-workspace-builder.buildModulesWithoutInstall` | For whose modules does not need install dependencies before building, specifying this to `true`, you can run build scripts directly.|
| `node-workspace-builder.includedPatterns`           | Specify modules to build using regExp patterns. If leave it as an empty array, this extension will build all modules in workspace.|
| `node-workspace-builder.showOutput`                 | Specify if show logs in output pannel.                                                                |
| `node-workspace-builder.npmPath`                    | Specify the prefix to load npm pannel.                                                                |

## Keyboard Shortcuts

This extension contributes the following keyboard shortcuts:

| Settings                | Description                                                                                           |
|-------------------------|-------------------------------------------------------------------------------------------------------|
| `Ctrl` + `Alt` + `B`    | Build all project in the whole workspace.                                                             |
| `Ctrl` + `Alt` + `C`    | Clean all project in the whole workspace.                                                             |
| `Shift` + `Alt` + `W`   | Watch selected projects.                                                                              |
| `Shift` + `Alt` + `B`   | Build selected projects (you must watch them first or projects not watched will not be built).        |
| `Shift` + `Alt` + `C`   | Clean selected projects (you must watch them first or projects not watched will not be built).        |
