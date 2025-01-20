/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
//  补全：模型设置
export const settings = {
    // 设置项中的fillmodel
    fillmodel: true,
    // 设置项中的openai_model
    openai_model: "fastertransformer",
    // 设置项中的temperature
    temperature: 0.1,
};
//  补全：预设常量
export const COMPLETION_CONST = {
    allowableLanguages: ['vue', 'typescript', 'javascript', 'python', 'go', 
        'c', 'c++', 'shell', 'bash', 'batch', 'lua', 'java', 'php', 'ruby'],    // 代码补全支持语言
    codeCompletionLogUploadOnce: false, // 代码补全代码上传是否只上传一次
    suggestionDelay: 300,               // 用户输入字符到执行触发请求的时间
    lineRejectedDelayIncrement: 1000,   // 同一行刚发生拒绝后的延时增量(发生拒绝后延长一点等待时间，减少干扰)
    lineRejectedDelayMax: 3000,         // 同一行刚发生拒绝后的延时最大值
    manualTriggerDelay: 50,             // 手动触发补全的延时
    feedbackInterval: 3000,             // 反馈定时器周期
    collectInterval: 3000,              // 收集代码片段的定时器周期
};

// 插件id对应package.json中的publisher.name
export const EXTENSION_ID = "zgsm-ai.zgsm";

// vscode相关
export const VSCODE_CONST = {
    checkSpin: '$(check~spin)',  // √号图标
    xSpin: '$(x~spin)',  // X号图标
    loadingSpin: '$(loading~spin)',  // 加载中转圈图标
};

// webview主题相关
export const WEBVIEW_THEME_CONST = {
    1: 'vs',
    2: 'vs-dark',
    3: 'vs-dark',
    4: 'vs'
};

export const SELECTION_BG_COLOR = {
    0: 'rgba(38, 79, 120, 1)',  // 默认
    1: 'rgba(173, 214, 255, 1)',
    2: 'rgba(38, 79, 120, 1)',
    3: 'rgba(38, 79, 120, 1)',
    4: 'rgba(173, 214, 255, 1)'
};

// codelens按钮相关常量
export const CODELENS_CONST = {
    rightMenu: "rightMenu",
    funcHead: "funcHead",
    // 可以支持的编程语言
    allowableLanguages: ['typescript', 'javascript', 'python', 'go', 
        'c', 'c++', 'lua', 'java', 'php', 'ruby']
    // codeLensLanguages: ["c", "c++", "go", "python"],    //支持codeLens的编程语言
};

/**
 * codelens菜单项
 */
export interface CodelensItem {
    key: string;
    actionName: string;
    tooltip: string;
    command: string;
}
/**
 * codelens按钮  
 * 这里的key、actionName和package.json中对应，务必统一修改
 */
export const CODELENS_FUNC: { [key: string]: CodelensItem } = {
    explain: {
        key: 'explain',
        actionName: '解释代码',
        tooltip: "解释代码实现",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    addComment: {
        key: 'addComment',
        actionName: '添加注释',
        tooltip: "添加该函数注释",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    addTests: {
        key: 'addTests',
        actionName: '生成单测',
        tooltip: "生成该函数单测",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    codeReview: {
        key: 'codeReview',
        actionName: '代码审查',
        tooltip: "检查代码是否有质量问题并给出修复建议",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    addDebugCode: {
        key: 'addDebugCode',
        actionName: '增加日志',
        tooltip: "提升排障能力，对关键逻辑步骤添加日志及调试代码",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    addStrongerCode: {
        key: 'addStrongerCode',
        actionName: '增加容错',
        tooltip: "提升健壮性，增加异常处理、参数校验等",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    simplifyCode: {
        key: 'simplifyCode',
        actionName: '精简代码',
        tooltip: "删减无效代码",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    performanceOptimization: {
        key: 'performanceOptimization',
        actionName: '性能优化',
        tooltip: "提升代码性能，给出修改建议，关注效率问题",
        command: "vscode-zgsm.codelens_button",
    } as CodelensItem,
    shenmaInstructSet: {
        key: 'shenmaInstructSet',
        actionName: `$(zhuge-shenma-icon)$(chevron-down)`,
        tooltip: "神码指令集",
        command: "vscode-zgsm.codelens_more_button",
    } as CodelensItem
};

export const codeLensDiffCodeTempFileDir = "codeLensDiffCodeTempFileDir";
export const noDirtyFile = "no dirty file";

export const configShenmaName = "诸葛神码";
export const configCompletion = "智能代码补全";
export const configCodeLens = "函数快捷指令";

// 用户认证
export const AUTH_TYPE = `zgsm-auth0`;
export const AUTH_NAME = `Auth0`;
export const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;
export const ACCESS_TOKEN_KEY = `${AUTH_TYPE}.accessToken`;