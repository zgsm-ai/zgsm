/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode";
import Auth0AuthenticationProvider from './common/authProvider';
import { rightMenus } from "./chatView/chat-view-menu";
import { ChatViewProvider } from "./chatView/chat-view-provider";
import { shortKeyCut } from "./codeCompletion/completionCommands";
import { CompletionStatusBar } from "./codeCompletion/completionStatusBar";
import { AICompletionProvider } from './codeCompletion/completionProvider';
import { codeLensCallBackCommand, codeLensCallBackMoreCommand } from "./codeLens/codeLensCallBackFunc";
import { MyCodeLensProvider } from "./codeLens/codeLensProvider";
import { CODELENS_CONST, CODELENS_FUNC, configCompletion, configCodeLens, configShenmaName } from "./common/constant";
import { initEnv, updateEnv } from "./common/env";
import { Logger } from "./common/log-util";
import { setupExtensionUpdater, doExtensionOnce, updateCodelensConfig, updateCompletionConfig, initLangSetting } from "./common/services";
import { getFullLineCode, printLogo } from "./common/vscode-util";
import { getLanguageByFilePath, loadLocalLanguageExtensions } from "./common/lang-util";
import { getLanguageClass } from "./langClass/factory";

/**
 * 初始化操作
 */
async function initialize() {
    printLogo();
    initEnv();
    initLangSetting();

    loadLocalLanguageExtensions();
}


/**
 * 为各菜单项注册命令
 */
function registerMenuCommands(context: vscode.ExtensionContext, cvProvider: ChatViewProvider) {
    for (const rightMenu of rightMenus) {
        const myCommand = vscode.commands.registerCommand(rightMenu.command, async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const selectedCode = editor.document.getText(editor.selection);
            if (!selectedCode) {
                return;
            }
            Logger.log('右键点击了', rightMenu);
            vscode.commands.executeCommand('vscode-zgsm.view.focus');

            let params: any = CODELENS_FUNC[rightMenu.key];
            const filePath = editor.document.uri.fsPath;
            const language = getLanguageByFilePath(filePath);
            const langClass = getLanguageClass(language);
            const startLine = editor.selection.start.line;
            const endLine = editor.selection.end.line;
            params.category = rightMenu.category;
            params.filePath = filePath;
            params.language = language;
            params.code = getFullLineCode(editor, startLine, endLine);
            params.callType = CODELENS_CONST.rightMenu;
            params.range = {
                startLine: startLine,
                endLine: endLine,
            };
            params = langClass.codelensGetExtraArgs(editor.document, params.range, params);
            setTimeout(() => {
                cvProvider?.codeLensButtonSend(params);
            }, cvProvider?.webView ? 0 : 1000);
        });
        context.subscriptions.push(myCommand);
    }
}
/**
 * 插件激活时的入口函数
 */
export async function activate(context: vscode.ExtensionContext) {
    initialize();

    const authProvider = Auth0AuthenticationProvider.getInstance(context);
    authProvider.checkToken();
    
    setupExtensionUpdater(context);
    doExtensionOnce(context);
    CompletionStatusBar.create(context);
    const cvProvider = ChatViewProvider.getInstance(context);

    //  注册webview
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        "vscode-zgsm.view",
        cvProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    ));

    context.subscriptions.push(
        // 注册codelens相关命令
        vscode.commands.registerTextEditorCommand(
            codeLensCallBackCommand.command,
            codeLensCallBackCommand.callback(context)
        ),
        // 神码指令集
        vscode.commands.registerTextEditorCommand(
            codeLensCallBackMoreCommand.command,
            codeLensCallBackMoreCommand.callback(context)
        ),
        //  注册函数头菜单
        vscode.languages.registerCodeLensProvider('*', new MyCodeLensProvider())
    );

    // 监听配置变化
    const configChanged = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(configShenmaName)) { //【诸葛神码】设置变更，主要是各服务的URL设置
            updateEnv();
            cvProvider.updateConfig();
        }
        if (e.affectsConfiguration(configCompletion)) { //代码补全设置变更
            updateCompletionConfig();
        }
        if (e.affectsConfiguration(configCodeLens)) {   //函数快捷指令配置变更
            updateCodelensConfig();
        }
        CompletionStatusBar.initByConfig();
    });
    context.subscriptions.push(configChanged);

    context.subscriptions.push(
        //  代码补全服务
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: "**" }, new AICompletionProvider(context)
        ),
        // 快捷键命令 主动触发自动补全
        vscode.commands.registerCommand(shortKeyCut.command, () => { shortKeyCut.callback(context); }),
    );
    //  注册右键菜单对应的命令项
    registerMenuCommands(context, cvProvider);
    // 注册‘开始对话’命令
    context.subscriptions.push(vscode.commands.registerCommand('vscode-zgsm.chat', () => {
        vscode.commands.executeCommand('vscode-zgsm.view.focus'); 
    }));
    // 注册‘退出登录’命令
    context.subscriptions.push(vscode.commands.registerCommand('vscode-zgsm.view.logout', () => {
        cvProvider.logout();
    }));
    //  注册用于清理session的命令
    context.subscriptions.push(vscode.commands.registerCommand("vscode-zgsm.clearSession", () => {
        context.globalState.update("chatgpt-session-token", null);
    }));
    // 注册‘使用手册’命令
    context.subscriptions.push(vscode.commands.registerCommand('vscode-zgsm.view.userHelperDoc', () => {
        cvProvider.userHelperDocPanel();
    }));
    //  注册‘问题反馈’命令
    context.subscriptions.push(vscode.commands.registerCommand('vscode-zgsm.view.issue', () => {
        cvProvider.userFeedbackIssue();
    }));
    CompletionStatusBar.initByConfig();
}


// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() { }

