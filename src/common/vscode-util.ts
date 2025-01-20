/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode";
import * as fs from 'fs';
import path = require("path");
import { SELECTION_BG_COLOR, configCompletion } from "./constant";
import { Logger } from "./log-util";

/**
 * 打印启动提示
 */
export function printLogo(): void {
    const extension = vscode.extensions.getExtension('zgsm-ai.zgsm');
    const version = extension?.packageJSON.version;
    Logger.log(`
    ███████╗██╗  ██╗██╗   ██╗ ██████╗ ███████╗       █████╗ ██╗
    ╚══███╔╝██║  ██║██║   ██║██╔════╝ ██╔════╝      ██╔══██╗██║
      ███╔╝ ███████║██║   ██║██║  ███╗█████╗  █████╗███████║██║
     ███╔╝  ██╔══██║██║   ██║██║   ██║██╔══╝  ╚════╝██╔══██║██║
    ███████╗██║  ██║╚██████╔╝╚██████╔╝███████╗      ██║  ██║██║
    ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝      ╚═╝  ╚═╝╚═╝
                                 by:诸葛神码团队
    vscode:       ${vscode.version}
    zgsm-ai.zgsm: ${version} 
    `);
}

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
export async function getWebviewContent(
    context: vscode.ExtensionContext, 
    webview: vscode.Webview, 
    templatePath: string
) {
    const resourcePath = path.join(context.extensionPath, templatePath);
    const dirPath = path.dirname(resourcePath);
    let html = await fs.readFileSync(resourcePath, 'utf-8');

    // vscode不支持直接加载本地资源，需要替换成其专有路径格式
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        const resource = webview.asWebviewUri(vscode.Uri.file(path.resolve(dirPath, $2)));
        return $1 + resource + '"';
    });

    return html;
}

export let editorSelectionDecoration: vscode.TextEditorDecorationType | undefined;
/**
 * 渲染背景颜色函数
 * @param selection 选中的文本范围，可选参数，默认为当前编辑器的选中范围
 * @param show 是否显示背景颜色，默认为false
 * @returns 无返回值
 * @example
 * renderBgColor(); // 清除旧的渲染
 * renderBgColor(selection, true); // 渲染选中文本的背景颜色为rgba(38, 79, 120)
 */
export function renderBgColor(selection: vscode.Selection | undefined, show = false) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        if (editorSelectionDecoration) {
            editor.setDecorations(editorSelectionDecoration, []);
            editorSelectionDecoration = undefined;
        }
        if (show) {
            if (!selection) { selection = editor.selection; }
            if (selection) {
                const activeColorThemeKind = vscode.window.activeColorTheme.kind;
                const backgroundColor = activeColorThemeKind in SELECTION_BG_COLOR ? SELECTION_BG_COLOR[activeColorThemeKind] : SELECTION_BG_COLOR[0];
                editorSelectionDecoration = vscode.window.createTextEditorDecorationType({
                    backgroundColor: backgroundColor,
                    isWholeLine: true
                });
                editor.setDecorations(editorSelectionDecoration, [selection]);
            }
        }
        return selection;
    }
}

/**
 * 获取从startLine到endLine间的所有代码
 */
export function getFullLineCode(editor: vscode.TextEditor, startLine: number, endLine: number): string {
    // 按行选择代码
    const rangeToSelecteLine = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, Number.MAX_VALUE)
    );

    const sourceCode = editor.document.getText(rangeToSelecteLine);
    return sourceCode;
}

/**
 * 获取工作区根路径
 */
export function getRootPath() {
    return vscode.workspace?.workspaceFolders?.[0].uri.fsPath || path.dirname(vscode.window.activeTextEditor?.document.fileName || "");
}

/**
 * 获取vscode临时目录/文件路径
 */
export function getVscodeTempFileDir(fileName: string) {
    const rootPath = getRootPath();
    return path.join(rootPath, '.vscode', fileName);
}

/**
 * 把日志数据写入日志文件
 */
export function writeLogsSync(fileName: string, content: string) {
    const tempDir = path.join(getRootPath(), ".vscode", "logs");
    const tempFilePath = path.join(tempDir, fileName);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(tempFilePath, content);
}

/**
 * 获取【代码补全】的配置
 */
export function getCompleteConfig(): vscode.WorkspaceConfiguration {
    const config = vscode.workspace.getConfiguration(configCompletion);
    return config;
}
