/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from 'vscode';
import { CodelensItem } from '../common/constant';

/**
 * 语言类接口，根据编程语言的不同，对codelens进行不同的处理
 */
export interface LangClass {
    //  检查该文档是否需要显示codelens按钮
    checkCodelensEnabled(): boolean;
    //  获取可以显示codelens按钮的符号列表(语言级别的粗过滤)
    getShowableSymbols(docSymbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[];
    //  确认某个符号是否允许显示codelens
    isShowableSymbol(docSymbol: vscode.DocumentSymbol): boolean;
    //  检查这个符号是否允许显示某个codelens菜单项(细过滤)
    checkItemShowable(item: CodelensItem, documentSymbol: vscode.DocumentSymbol): boolean;
    //  获取codelens菜单项消息的额外参数
    codelensGetExtraArgs(document: vscode.TextDocument, range: any, codelensArgs: any): any;
}
