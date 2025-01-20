/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as path from 'path';
import * as vscode from "vscode";
import { getLanguageExtensions } from "./api";
import { CODELENS_CONST, COMPLETION_CONST } from './constant';

/**
 * 编程语言的扩展定义，
 * 通过重定义该数据结构，可以低成本支持自定义的编程后缀名
 */
export interface LanguageExtension {
    language: string;
    file_extensions: string[];
}

export var languageExtensions: LanguageExtension[];

/**
 * 加载服务端的语言扩展数据
 */
export async function loadRemoteLanguageExtensions() {
    const response = await getLanguageExtensions();
    if (response && response?.data.length > 0) {
        languageExtensions = response?.data;
    }
}

/**
 * 加载本地的语言扩展，以JSON文件的方式定义的数据结构
 */
export function loadLocalLanguageExtensions() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const languageExtensionData = require('../data/language-extension-data.json');
    languageExtensions = languageExtensionData;
}
/** 
 * 根据文件名获取文件后缀
 */
function getExtensionByFilename(filename: string): string {
    if (!filename.includes('.')) {
        return '';
    } else if (/^\.[0-9a-zA-Z_]+$/.test(filename)) {
        return filename;
    }
    return filename.split('.').pop() || '';
}

/**
 * 根据文件名获取语言，
 */
export function getLanguageByFilename(filename: string) {
    const fileExtension = getExtensionByFilename(filename).toLowerCase();
    const language = languageExtensions.find(
        item => item.file_extensions.includes(fileExtension))?.language || '';
    if (language) {
        return language.toLowerCase();
    } else {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return "plaintext";
        } else {
            return fileExtension || editor.document.languageId;
        }
    }
}

/**
 * 根据文件路径获取语言
 */
export function getLanguageByFilePath(filePath: string) {
    const filename = path.basename(filePath);
    return getLanguageByFilename(filename);
}

/**
 * 各语言对某项功能的禁用状态表
 */
export type LangDisables = {
    [key: string]: string;
}
/**
 * 语言功能开关
 */
export enum LangSwitch {
    Enabled = 0,            //开启
    Disabled = 1,           //禁用
    Unsupported = 2,        //该语言不支持此项能力
}
/**
 * 语言功能开启设置
 */
export class LangSetting {
    public static completionEnabled = true;
    public static codelensEnabled = true;

    private completionSwitchs = new Map<string, LangSwitch>();
    private codelensSwitchs = new Map<string, LangSwitch>();
    private static readonly completionDefault = LangSwitch.Enabled;
    private static readonly codelensDefault = LangSwitch.Unsupported;
    private static instance: LangSetting | undefined = undefined;

    /**
     * 获取补全禁用项
     */
    public static getCompletionDisables(): LangDisables {
        return this.getDisables(this.getInstance().completionSwitchs);
    }
    /**
     * 获取快捷菜单禁用项
     */
    public static getCodelensDisables(): LangDisables {
        return this.getDisables(this.getInstance().codelensSwitchs);
    }
    /**
     * 设置补全禁用项
     */
    public static setCompletionDisables(disables: LangDisables) {
        this.setDisables(this.getInstance().completionSwitchs, disables, this.completionDefault);
    }
    /**
     * 设置快捷菜单禁用项
     */
    public static setCodelensDisables(disables: LangDisables) {
        this.setDisables(this.getInstance().codelensSwitchs, disables, this.codelensDefault);
    }
    /**
     * 编程语言lang，有没有开启补全支持
     */
    public static getCompletionDisable(lang: string): LangSwitch {
        return this.getInstance().completionSwitchs.get(lang) ?? this.completionDefault;
    }
    /**
     *  编程语言lang，有没有开启codelens支持
     */
    public static getCodelensDisable(lang: string): LangSwitch {
        return this.getInstance().codelensSwitchs.get(lang) ?? this.codelensDefault;
    }

    /**
     * 使用单例模式
     */
    private static getInstance(): LangSetting {
        if (!this.instance) {
            this.instance = new LangSetting();
            this.setSupports(this.instance.codelensSwitchs, CODELENS_CONST.allowableLanguages);
            this.setSupports(this.instance.completionSwitchs, COMPLETION_CONST.allowableLanguages);
        }
        return this.instance;
    }
    /**
     * 设置某项功能(代码补全/函数快捷菜单)所支持的语言列表
     */
    private static setSupports(switchs: Map<string, LangSwitch>, langs: string[]) {
        for(let i = 0; i < langs.length; i++) {
            const lang = langs[i];
            switchs.set(lang, LangSwitch.Enabled);
        }
    }
    /**
     * 令语言禁用设置生效
     */
    private static setDisables(
        switchs: Map<string, LangSwitch>, disables: LangDisables, def: LangSwitch
    ) {
        Object.entries(disables).forEach(([key, value]) => {
            let sw_value = LangSwitch.Enabled;
            if (value.toLowerCase() === "true") {
                sw_value = LangSwitch.Disabled;
            }
            const sw = switchs.get(key);
            if (sw === LangSwitch.Enabled || sw === LangSwitch.Disabled) {
                switchs.set(key, sw_value);
            } else if (sw === undefined) {
                if (def !== LangSwitch.Unsupported) {
                    switchs.set(key, sw_value);
                }
            }
        })
    }
    private static getDisables(switchs: Map<string, LangSwitch>): LangDisables {
        let disables: LangDisables = {};
        switchs.forEach((value, key) => {
            if (value === LangSwitch.Disabled) {
                disables[key] = "true";
            } else if (value === LangSwitch.Enabled) {
                disables[key] = "false";
            }
        })
        return disables;
    }
}
