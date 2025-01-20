/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from 'vscode';
import { LangClass } from './LangClass';
import { envSetting } from '../common/env';
import { CodelensItem } from '../common/constant';

/**
 * 编程语言名称
 */
export class LangName {
    public static OTHER = 'other';
    public static CPP = 'c++';
    public static C = 'c';
    public static GO = 'go';
    public static PYTHON = 'python';
}

/**
 * 语言类的基础
 */
export class BaseLangClass implements LangClass {
    public name = LangName.OTHER;
    public showableKinds = [vscode.SymbolKind.Class, vscode.SymbolKind.Function];

    constructor(langName: string) {
        this.name = langName;
    }
    // 校验是否需要展示函数快捷菜单
    public checkCodelensEnabled(): boolean {
        return true;
    }
    //  检查某个符号是否允许显示codelens
    public isShowableSymbol(docSymbol: vscode.DocumentSymbol): boolean {
        return this.showableKinds.includes(docSymbol.kind);
    }
    //  检查某个符号是否允许显示某个codelens菜单项
    public checkItemShowable(item: CodelensItem, docSymbol: vscode.DocumentSymbol): boolean {
        return true;
    }
    // 基础获取允许展示codelens的符号
    public getShowableSymbols(docSymbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
        const showableSymbols: vscode.DocumentSymbol[] = [];
        for (const docSymbol of docSymbols) {
            if (docSymbol.kind !== vscode.SymbolKind.Module && docSymbol.kind !== vscode.SymbolKind.Class)
                continue;
            if (!docSymbol.children)
                continue;
            docSymbol.children.forEach((docSymbol: any) =>
                (this.isShowableSymbol(docSymbol) ? showableSymbols.push(docSymbol) : null));
        }
        docSymbols.forEach((docSymbol: any) =>
            (this.isShowableSymbol(docSymbol) ? showableSymbols.push(docSymbol) : null));
        return showableSymbols;
    }
    /**
     * 获取codelens菜单项消息的额外参数
     */
    public codelensGetExtraArgs(document: vscode.TextDocument, range: any, codelensArgs: any) {
        const rangeFull = new vscode.Range(
            range.startLine, 0,
            range.endLine, Number.MAX_VALUE
        );
        // 根据范围提取文档中的文本
        codelensArgs.code = document.getText(rangeFull);
        return codelensArgs;
    }
}
