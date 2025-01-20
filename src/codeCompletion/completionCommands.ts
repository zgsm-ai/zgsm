/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode";
import { Logger } from "../common/log-util";
import { setupLangSwitchs } from "../common/services";

export type Command = { command: string, callback: (...args: any[]) => any, thisArg?: any; };

/**
 * 补全状态栏项添加一个命令
 */
export const statusBarCommand: Command = {
    command: "statusBar.showInformationMessage",
    callback: () => setupLangSwitchs()
};

/**
 * 设置补全扩展的启用状态
 */
function setExtensionStatus(enabled: boolean) {
    const config = vscode.workspace.getConfiguration();
    const target = vscode.ConfigurationTarget.Global;
    Logger.info("设置zgsm-completion.enabled状态为", enabled);
    config.update('zgsm-completion.enabled', enabled, target, false).then(console.error);
}

/**
 * 启用补全命令
 */
export const turnOnCompletion: Command = {
    command: "zgsm-completion.enable",
    callback: () => setExtensionStatus(true)
};

/**
 * 禁用补全命令
 */
export const turnOffCompletion: Command = {
    command: "zgsm-completion.disable",
    callback: () => setExtensionStatus(false)
};

/**
 * 补全快捷指令命令
 */
export const shortKeyCut: Command = {
    command: "zgsm-completion.shortKeyCut",
    callback: (context: vscode.ExtensionContext) => {
        context.workspaceState.update('shortCutKeys', true);
        vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }
};
