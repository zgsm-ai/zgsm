/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from 'vscode';
import { getLanguageClass } from "../langClass/factory";
import { ChatViewProvider } from "../chatView/chat-view-provider";
import { CODELENS_CONST, CODELENS_FUNC } from "../common/constant";
import { throttle } from "../common/util";
import { getLanguageByFilePath } from '../common/lang-util';

/**
 * commonCodeLensFunc的节流函数
 */
const throttleCommonCodeLensFunc = throttle(commonCodeLensFunc, 2000);

/**
 * 普通codelens指令的处理动作
 * @param editor codelens所在的文档编辑器
 * @param args: [documentSymbol, codelensItem]
 */
async function commonCodeLensFunc(editor: any, ...args: any) {
    // 先弹出webview页面，因为后面可能有耗时间的操作
    vscode.commands.executeCommand('vscode-zgsm.view.focus');
    const documentSymbol = args[1];
    const codelensItem = args[2];
    const language = getLanguageByFilePath(editor.document.uri.fsPath);
    const langClass = getLanguageClass(language);

    codelensItem.range = {
        startLine: documentSymbol.range.start.line,
        endLine: documentSymbol.range.end.line,
    };
    codelensItem.filePath = editor.document.uri.fsPath;
    codelensItem.callType = CODELENS_CONST.funcHead;
    codelensItem.language = language;
    const params = langClass.codelensGetExtraArgs(editor.document, codelensItem.range, codelensItem);
    // 发送消息令LLM完成响应动作
    ChatViewProvider.getInstance().codeLensButtonSend(params);
}

/**
 * codelens「更多」按钮的处理动作
 */
async function moreCodeLensFunc(editor: any, ...args: any) {
    const codeLens = args[2];
    const options: any[] = [];

    for (const [key, codelensItem] of Object.entries(CODELENS_FUNC)) {
        if (key === codeLens.key) {
            continue;
        }
        options.push({ label: codelensItem.actionName, data: codelensItem });
    }
    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: '选择快捷指令'
    });

    // 处理用户选择
    if (selection) {
        args[2] = selection.data;
        throttleCommonCodeLensFunc(editor, ...args);
    }
}

/**
 * 普通codelens的回调函数
 */
export const codeLensCallBackCommand = {
    command: "vscode-zgsm.codelens_button",
    callback: (event: any) => throttleCommonCodeLensFunc
};

/**
 * 「更多」按钮的codelens回调函数
 */
export const codeLensCallBackMoreCommand = {
    command: "vscode-zgsm.codelens_more_button",
    callback: (event: any) => moreCodeLensFunc
};
