/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
/**
 * 代码补全提示信息(简单的上下文)
 */
export interface CompletionPrompt {
    prefix: string;             // 光标前所有代码
    suffix: string;             // 光标后所有代码
    cursor_line_prefix: string; // 光标所在行前缀代码
    cursor_line_suffix: string; // 光标所在行后缀代码
}
/**
 * 文档信息
 */
export interface CompletionDocumentInformation {
    fpath: string;      // 文档路径
    language: string;   // 语言
}
/**
 * 补全反馈
 */
export interface CompletionFeedback {
    acception: string;      //接受状态
    correction: string;     //修正状态
    actual_code: string;    //用户输入的实际代码
    tab_enter: boolean;     //用户是否输入过TAB
    expend_time: number;    //从系统开始获取补全内容到显示补全结果的整体耗时
}

/**
 * 补全是否接受的结果
 */
export enum CompletionAcception {
    None = 0,       //还没有结果，用户还没有针对该补全内容进行操作
    Canceled = 1,   //补全请求被取消了，包括：用户编辑前置内容，用户输入了新的内容，或者切换了编辑位置，导致该补全点失效
    Accepted = 2,   //接受：用户按TAB键接受了补全内容
    Rejected = 3,   //拒绝: 用户拒绝该补全，包括新输入内容与补全内容不相同
}
/**
 * 用户接受状态
 */
export function getAcceptionString(acception: CompletionAcception): string {
    switch (acception) {
    case CompletionAcception.None:
        return "none";
    case CompletionAcception.Canceled:
        return "canceled";
    case CompletionAcception.Accepted:
        return "accepted";
    case CompletionAcception.Rejected:
        return "rejected";
    default:
        return "";
    }
}

/**
 * 用户对补全结果的修正状态
 */
export enum CompletionCorrection {
    None = 0,               //未知
    Unchanged = 1,          //没改变
    Changed = 2,            //有改变
}

/**
 * 用户修正状态
 */
export function getCorrectionString(state: CompletionCorrection): string {
    switch (state) {
    case CompletionCorrection.None:
        return "none";
    case CompletionCorrection.Unchanged:
        return "unchanged";
    case CompletionCorrection.Changed:
        return "changed";
    default:
        return "";
    }
}
/**
 * 请求补全模式
 */
export enum CompletionMode {
    DontNeed = 0,   //不需要补全
    Cached = 1,     //已缓存：沿用上一个位置遗留的所有结果
    Partial = 2,    //缓存后半部分(因为前半部分用户已经输入，只能沿用后半部内容)
    Newest = 3,     //获取最新内容: 没有可以沿用的内容
}

/**
 * 补全结果的匹配情况
 */
export interface CompletionRequirement {
    mode: CompletionMode;
    matchLen?: number;
    remain?: string;
}
