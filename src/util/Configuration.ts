/*
 * $Id:$
 * Copyright 2019 Emily36107@outlook.com All rights reserved.
 */
import { workspace, ConfigurationChangeEvent } from 'vscode';
const DEFAULT_SECTION_NAME: string = 'node-workspace-builder';

/**
 * configuration.
 *
 * @author Emily Wang
 * @since 2019.04.30
 */
export default class Configuration {

    public static AUTO_BUILD_ON_START_UP: string = 'autoBuildOnStartUp';

    public static AUTO_BUILD_ON_SAVE: string = 'autoBuildOnSave';

    public static AUTO_BUILD_ON_FOLDERS_CHANGED: string = 'autoBuildOnFoldersChanged';

    public static BUILD_MODULES_WITHOUT_INSTALL: string = 'buildModulesWithoutInstall';

    public static INCLUDED_PATTERNS: string = 'includedPatterns';

    public static SHOW_OUTPUT: string = 'showOutput';
    /**
     * default constructor
     */
    constructor() {
        // empty
    }

    /**
     * get the auto build on save configuration
     */
    public static autoBuildOnStartUp(): boolean {
        const configuration = workspace.getConfiguration(DEFAULT_SECTION_NAME);
        return <boolean>configuration.get(Configuration.AUTO_BUILD_ON_START_UP);
    }

    /**
     * get the auto build on save configuration
     */
    public static autoBuildOnSave(): boolean {
        const configuration = workspace.getConfiguration(DEFAULT_SECTION_NAME);
        return <boolean>configuration.get(Configuration.AUTO_BUILD_ON_SAVE);
    }

    /**
     * get the auto build on folders changed configuration
     */
    public static autoBuildOnFoldersChanged(): boolean {
        const configuration = workspace.getConfiguration(DEFAULT_SECTION_NAME);
        return <boolean>configuration.get(Configuration.AUTO_BUILD_ON_FOLDERS_CHANGED);
    }

    /**
     * get the build moudles without install configuration
     */
    public static buildModulesWithoutInstall(): boolean {
        const configuration = workspace.getConfiguration(DEFAULT_SECTION_NAME);
        return <boolean>configuration.get(Configuration.BUILD_MODULES_WITHOUT_INSTALL);
    }

    /**
     * get the included patterns configuration
     */
    public static includedPatterns(): string[] {
        const configuration = workspace.getConfiguration(DEFAULT_SECTION_NAME);
        return <string[]>configuration.get(Configuration.INCLUDED_PATTERNS);
    }

    /**
     * get the auto build on save configuration
     */
    public static showOutput(): boolean {
        const configuration = workspace.getConfiguration(DEFAULT_SECTION_NAME);
        return <boolean>configuration.get(Configuration.SHOW_OUTPUT);
    }

    /**
     * get other configuration
     * 
     * @param name sub section name
     */
    public static get<T>(section: string = DEFAULT_SECTION_NAME, name: string): T {
        const configuration = workspace.getConfiguration(section);
        return <T>configuration.get(name);
    }

    /**
     * if a configuration change event effects spcified configuration
     * 
     * @param e - configuration event
     * @param config - config name
     */
    public static effected(e: ConfigurationChangeEvent, config: string): boolean {
        return e.affectsConfiguration(`${DEFAULT_SECTION_NAME}.${config}`);
    }
}
