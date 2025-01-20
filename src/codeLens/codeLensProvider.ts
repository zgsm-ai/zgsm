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
import { CODELENS_FUNC } from "../common/constant";
import { Logger } from "../common/log-util";
import { LangSetting, LangSwitch, getLanguageByFilePath } from "../common/lang-util";

/**
 * codelens(符号定义的头部菜单组)的服务提供者
 */
export class MyCodeLensProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }
        if (!LangSetting.codelensEnabled) {
            return [];
        }
        const language = getLanguageByFilePath(editor.document.uri.fsPath);
        const sw = LangSetting.getCodelensDisable(language);
        if (sw === LangSwitch.Disabled || sw === LangSwitch.Unsupported) {
            return [];
        }
        // 校验这个view是否需要展示codelens按钮
        const langClass = getLanguageClass(language);
        const checkResult = langClass.checkCodelensEnabled();
        if (!checkResult) {
            return [];
        }

        const results: any[] = [];
        const config = vscode.workspace.getConfiguration(`函数快捷指令.函数上方展示的快捷指令按钮`);

        //  获取配置中需要显示的codeLens按钮
        const configCodelensDicts = Object.entries(CODELENS_FUNC)
            .filter(([key, value]) => config.get<boolean>(key))
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {} as Record<string, typeof CODELENS_FUNC[keyof typeof CODELENS_FUNC]>);

        if (Object.keys(configCodelensDicts).length === 0) {
            Logger.log("未配置任何快捷指令");
            return results;
        }

        const docSymbols: any = await (async function (editor) {
            const docSymbols = await vscode.commands.executeCommand(
                "vscode.executeDocumentSymbolProvider",
                editor.document.uri
            );
            return docSymbols;
        })(editor);
        if (!docSymbols || 0 === docSymbols.length) {
            Logger.log("未解析出任何DocumentSymbol,无codelens");
            return [];
        }

        const showableSymbols = langClass.getShowableSymbols(docSymbols);
        for (const documentSymbol of showableSymbols) {
            for (const [key, codelensItem] of Object.entries(configCodelensDicts)) {
                // 判断可以展示的按钮，这里又根据语言区分又根据场景区分
                if (!langClass.checkItemShowable(codelensItem, documentSymbol))
                    continue;
                const range = new vscode.Range(documentSymbol.range.start.line, 0, 
                    documentSymbol.range.start.line, 0);
                results.push(new vscode.CodeLens(range, {
                    title: codelensItem.actionName,
                    tooltip: codelensItem.tooltip,
                    command: codelensItem.command,
                    arguments: [documentSymbol, codelensItem],
                }));
            }
        }
        return results;
    }
}