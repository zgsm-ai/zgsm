/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from 'vscode';
import { getExtensionsLatestVersion } from "./api";
import { EXTENSION_ID, configCompletion, configCodeLens } from "./constant";
import { envSetting, updateEnv } from "./env";
import { Logger } from "./log-util";
import { LangSetting, LangSwitch, LangDisables, getLanguageByFilePath, loadRemoteLanguageExtensions } from './lang-util';
import { DateFormat, formatTime, formatTimeDifference } from './util';
import { getCompleteConfig } from './vscode-util';

/**
 * 设置定时器，定时检查更新扩展&编程语言设置
 */
export function setupExtensionUpdater(context: vscode.ExtensionContext) {
    setTimeout(() => {
        loadRemoteLanguageExtensions();
        updateExtensions(context);
    }, 3000);
    setInterval(() => {
        loadRemoteLanguageExtensions();     // 加载语言扩展数据
        updateExtensions(context);          // 检查扩展更新
    }, 1000 * 60 * 60);
}

const ZGSM_IGNORE_VERSION = "zgsmIgnoreVersion";
const ZGSM_LASTTIME_CHECKED = "zgsmLastChecked";

/**
 * 更新扩展
 */
async function updateExtensions(context: vscode.ExtensionContext): Promise<void> {
    if (!isTimeToCheck(context)) {
        return;
    }
    // 获取插件信息
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (!extension) {
        return;
    }
    const extensionName = extension.packageJSON.name;
    if (extensionName !== "zgsm") {
        return;
    }
    const extensionVersion = extension.packageJSON.version as string;
    const zgsmLatestVersion = await getLatestVersion(extensionVersion);
    if (isIgnoreVersion(context, zgsmLatestVersion)) {
        return;
    }

    if (zgsmLatestVersion === extensionVersion) {
        Logger.log(`扩展 ${extensionName} (${extensionVersion}) 已是最新版本`);
        return;
    }
    Logger.log(`扩展 ${extensionName} 有可用更新(${extensionVersion})`);
    vscode.window.showInformationMessage(
        `诸葛神码插件有版本更新（${zgsmLatestVersion}）,快来升级体验新功能吧,\n更新完成后需要重启软件才生效。`, 
        { modal: false }, '确定', '忽略'
    ).then((result) => {
        if (result === '确定') {        // 用户点击了“确定”按钮
            Logger.log(`用户点击了“确定”按钮`);
            try {
                vscode.commands.executeCommand('workbench.extensions.search', EXTENSION_ID);
            } catch (err) {
                Logger.error(err);
            }
        } else if (result === '忽略') { // 用户点击了“忽略”按钮
            Logger.log(`忽略版本${zgsmLatestVersion}更新`);
            context.globalState.update(ZGSM_IGNORE_VERSION, zgsmLatestVersion);
        }
    });
}

/**
 * 是否需要再次检测版本更新
 */
function isTimeToCheck(context: vscode.ExtensionContext): boolean {
    const globalState = context.globalState;
    const zgsmLastChecked = globalState.get(ZGSM_LASTTIME_CHECKED);
    const currentTime = Date.now();
    if (!zgsmLastChecked) {
        globalState.update(ZGSM_LASTTIME_CHECKED, currentTime);
    } else {
        const lastChecked = formatTime(new Date(zgsmLastChecked as number), DateFormat.LITE);
        const timeDiff = currentTime - (zgsmLastChecked as number);
        const timeDiffStr = formatTimeDifference(timeDiff);
        const maxIntervalStr = formatTimeDifference(envSetting.updateExtensionsTimeInterval);
        if (timeDiff > envSetting.updateExtensionsTimeInterval) {
            Logger.info(`zgsm-ai.zgsm扩展上一次检查时间: ${lastChecked}, 等待时长${timeDiffStr}超过${maxIntervalStr}, 需再次检查`);
            // 每12小时检查一次更新
            globalState.update(ZGSM_LASTTIME_CHECKED, currentTime);
            return true;
        }
        Logger.info(`zgsm-ai.zgsm扩展上一次检查时间: ${lastChecked}, 等待时长${timeDiffStr}小于${maxIntervalStr}, 不用更新`);
    }
    return false;
}

/**
 * 确认是否忽略版本
 */
function isIgnoreVersion(context: vscode.ExtensionContext, extensionVersion: string): boolean {
    const globalState = context.globalState;
    const zgsmIgnoreVersion = globalState.get(ZGSM_IGNORE_VERSION) as string;
    if (zgsmIgnoreVersion === extensionVersion) {
        Logger.info(`zgsm-ai.zgsm扩展更新忽略版本${ZGSM_IGNORE_VERSION}: ${zgsmIgnoreVersion} `);
        return true;
    }
    return false;
}

/**
 * 获取最后的版本号
 */
async function getLatestVersion(extensionVersion: string): Promise<string> {
    const zgsmLatestVersionData = await getExtensionsLatestVersion();
    let zgsmLatestVersion = "";
    if (zgsmLatestVersionData) {
        zgsmLatestVersion = zgsmLatestVersionData.version;
    } else {
        // 避免请求异常导致版本为空
        zgsmLatestVersion = extensionVersion;
    }
    Logger.log('request success zgsmLatestVersion:', zgsmLatestVersion);
    return zgsmLatestVersion;
}
/**
 * 保证诸葛神码扩展只会执行一次的动作
 */
export function doExtensionOnce(context: vscode.ExtensionContext) {
    const isFirstTime = context.globalState.get('isFirstTime');
    if (!isFirstTime) {
        // 第一次启动插件，记录标志位
        context.globalState.update('isFirstTime', true);
        vscode.workspace.getConfiguration(configCompletion).update('enabled', true, vscode.ConfigurationTarget.Global);
    }

    const shortCutKeySupport = context.globalState.get('shortCutKeySupport');
    if (!shortCutKeySupport) {
        // 代码自动补全 弹窗提醒
        vscode.window.showInformationMessage('诸葛神码 (代码自动补全) 支持手动触发了，使用快捷键 ALT+A 即可快速体验', "知道了");
        context.globalState.update("shortCutKeySupport", true);
    }
}

/**
 * 更新【函数快捷菜单】相关设置
 */
export function updateCodelensConfig() {
    const config = vscode.workspace.getConfiguration(configCodeLens);
    const disables: LangDisables = config.get("disableLanguages") || {};
    const enabled = config.get("enabled");

    if (enabled) {
        LangSetting.codelensEnabled = true;
    } else {
        LangSetting.codelensEnabled = false;
    }
    LangSetting.setCodelensDisables(disables);
}

/**
 * 更新【智能代码补全】相关设置
 */
export function updateCompletionConfig() {
    const config = vscode.workspace.getConfiguration(configCompletion);
    const disables: LangDisables = config.get("disableLanguages") || {};
    const enabled = config.get("enabled");

    if (enabled) {
        LangSetting.completionEnabled = true;
    } else {
        LangSetting.completionEnabled = false;
    }
    LangSetting.setCompletionDisables(disables);
}

/**
 * 初始化语言设置
 */
export function initLangSetting() {
    updateCodelensConfig();
    updateCompletionConfig();
    // 初始化的时候回存一次disables，可以把扩展支持的所有语言写到配置项中，方便后续用户设置。
    let config = vscode.workspace.getConfiguration(configCompletion);
    let disables = LangSetting.getCompletionDisables();
    config.update('disableLanguages', disables, vscode.ConfigurationTarget.Global);

    config = vscode.workspace.getConfiguration(configCodeLens);
    disables = LangSetting.getCodelensDisables();
    config.update('disableLanguages', disables, vscode.ConfigurationTarget.Global);
}

/**
 * showInformationMessage按钮命令
 */
type ButtonCommand = {
    funcName: string,
    setupGlobal: (button: any, value: boolean|LangSwitch) => void, 
    setupLanguage: (button: any, value: boolean|LangSwitch) => void
};

/**
 * showInformationMessage按钮定义
 */
interface ButtonDefined {
    text: string;
    lang: string;
    value: LangSwitch | boolean;
    command: (button: any, value: boolean|LangSwitch) => void;
}

/**
 * 创建针对某个功能(补全/函数快捷菜单)的按钮数组
 */
function createButtons(
    lang: string, cmd: ButtonCommand, enabled: boolean, sw: LangSwitch
): ButtonDefined[] {
    let buttons: ButtonDefined[] = [];
    if (enabled) {
        buttons.push({
            text: "禁用" + cmd.funcName,
            lang: lang,
            value: false,
            command: cmd.setupGlobal,
        });
        if (sw === LangSwitch.Disabled) {
            buttons.push({
                text: "启用" + lang + cmd.funcName,
                lang: lang,
                value: LangSwitch.Enabled,
                command: cmd.setupLanguage,
            });
        } else {
            buttons.push({
                text: "禁用" + lang + cmd.funcName,
                lang: lang,
                value: LangSwitch.Disabled,
                command: cmd.setupLanguage,
            });
        }
    } else {
        buttons.push({
            text: "启用快捷菜单",
            lang: lang,
            value: true,
            command: cmd.setupGlobal,
        });
    }
    return buttons;
}
/**
 * 获取已经被禁用补全的语言集合map
 */
function getDisableLanguages(
    config: vscode.WorkspaceConfiguration, 
    name: string = "disableLanguages"
): LangDisables {
    let disables: LangDisables = config.get(name) || {};
    // 将所有键和值转换为小写
    disables = Object.entries(disables).reduce((acc: any, [key, value]) => {
        acc[key.toLowerCase()] = value.toLowerCase();
        return acc;
    }, {});
    return disables;
}

/**
 * 设置用户配置中的语言功能开关
 */
function setupLangSwitch(
    button: any, value: boolean|LangSwitch, config: vscode.WorkspaceConfiguration
) {
    const language = (button as ButtonDefined).lang;
    if (value === LangSwitch.Unsupported) {
        Logger.info(`当前语言 ${language} 暂不支持代码补全`);
        return;
    }
    const disables = getDisableLanguages(config, "disableLanguages");
    if (value === LangSwitch.Disabled) {
        disables[language] = "true";
    } else {
        disables[language] = "false";
    }
    config.update('disableLanguages', disables, vscode.ConfigurationTarget.Global);
}

/**
 * 函数快捷菜单按钮设置
 */
const codelensCommand: ButtonCommand = {
    funcName: "菜单",
    setupGlobal: (button: any, value: boolean|LangSwitch) => {
        const config = vscode.workspace.getConfiguration(configCodeLens);
        config.update("enabled", value as boolean, vscode.ConfigurationTarget.Global);
        LangSetting.codelensEnabled = value as boolean;
    },
    setupLanguage: (button: any, value: boolean|LangSwitch) => {
        const config = vscode.workspace.getConfiguration(configCodeLens);
        setupLangSwitch(button, value, config);
        // const disables = getDisableLanguages(config, "disableLanguages");
        // LangSetting.setCodelensDisables(disables);
    }
};

/**
 * 补全按钮设置
 */
const completionCommand: ButtonCommand = {
    funcName: "补全",
    setupGlobal: (button: any, value: boolean|LangSwitch) => {
        const config = vscode.workspace.getConfiguration(configCompletion);
        config.update("enabled", value as boolean, vscode.ConfigurationTarget.Global);
        LangSetting.completionEnabled = value as boolean;
    },
    setupLanguage: (button: any, value: boolean|LangSwitch) => {
        const config = vscode.workspace.getConfiguration(configCompletion);
        setupLangSwitch(button, value, config);
        // const disables = getDisableLanguages(config, "disableLanguages");
        // LangSetting.setCompletionDisables(disables);
    }
};

/**
 * 状态栏点击事件函数
 */
export function setupLangSwitchs() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const language = getLanguageByFilePath(editor.document.uri.fsPath);
    const completionSwitch = LangSetting.getCompletionDisable(language);
    const codelensSwitch = LangSetting.getCodelensDisable(language);

    let buttons = createButtons(language, codelensCommand, 
        LangSetting.codelensEnabled, codelensSwitch);
    buttons = buttons.concat(...createButtons(language, completionCommand, 
        LangSetting.completionEnabled, completionSwitch));

    let buttonTexts: string[] = [];
    buttons.forEach((button) => {
        buttonTexts.push(button.text);
    });

    vscode.window.showInformationMessage('启用/禁用‘函数快捷菜单’与‘智能代码补全’', 
        { modal: false }, 
        ...buttonTexts
    ).then((button) => {
        for (let i = 0; i < buttons.length; i++) {
            if (button === buttons[i].text) {
                buttons[i].command(buttons[i], buttons[i].value);
            }
        }
    });
}
