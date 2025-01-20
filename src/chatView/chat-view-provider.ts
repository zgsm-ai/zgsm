/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

import Auth0AuthenticationProvider from "../common/authProvider";
import { CODELENS_FUNC, WEBVIEW_THEME_CONST, codeLensDiffCodeTempFileDir, configShenmaName } from "../common/constant";
import { envSetting, envClient } from "../common/env";
import { Logger } from "../common/log-util";
import { getUuid } from "../common/util";
import { getFullLineCode, getVscodeTempFileDir, getWebviewContent } from "../common/vscode-util";
import { getLanguageByFilePath } from "../common/lang-util";

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private static instance: ChatViewProvider;          // 单例，保证全局唯一的实例
    public webView: vscode.WebviewView | null = null;   // 网页视图，用于IDE与对话页面(网页)交互
    private callBackMap: Map<string, any> = new Map();  // 回调函数map: 收到了来自webview的消息，需要通过回调反馈结果
    private leftOverMessage?: any;

    constructor(public context: vscode.ExtensionContext) {
        vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(context.asAbsolutePath('images/ai-rotate.svg')),
            gutterIconSize: 'contain',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.changeActiveColorTheme();
    }

    // 单例，保证全局唯一的实例，其他地方使用调用该函数获取实例
    public static getInstance(context?: vscode.ExtensionContext): ChatViewProvider {
        if (!ChatViewProvider.instance) {
            if (!context) {
                Logger.log("插件异常,ChatViewProvider实例异常丢失");
                throw new Error('插件异常,ChatViewProvider实例异常丢失');
            }
            ChatViewProvider.instance = new ChatViewProvider(context);
        }
        return ChatViewProvider.instance;
    }

    public async resolveWebviewView(webviewView: vscode.WebviewView) {
        this.webView = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };

        webviewView.webview.html = await getWebviewContent(this.context, 
            webviewView.webview, 'html/webview/dist/index.html');

        webviewView.webview.onDidReceiveMessage(async message => {
            /* eslint-disable */
            switch (message.action) {
            // 获取配置信息
            case 'ide.getConfig':
                this.invokeCallback(message, {
                    chatUrl: envSetting.chatUrl,
                    ide: "vscode",
                    extVersion: envClient.extVersion,
                    ideVersion: envClient.ideVersion,
                    hostIp: envClient.hostIp,
                    model: this.context.globalState.get("model") ?? ''
                });
                break;
            // 右下角通知
            case 'ide.notification':
                this.doNotification(message);
                break;
            // 把ai代码插入到编辑器中
            case 'ide.insertCode':
                this.insertCode(message.params);
                break;
            // 把ai代码用新文件打开
            case 'ide.openNew':
                const document = await vscode.workspace.openTextDocument({
                    content: message.value,
                    language: message.language
                });
                vscode.window.showTextDocument(document);
                break;
            // 获取选中代码
            case 'ide.getSelectCode':
                this.doGetSelectCode(message);
                break;
            // 获取主题色系
            case 'ide.getThemeKind':
                // 主题色系分为两种：vs、vs-dark，自定义的色系默认返回vs-dark
                let activeColorThemeKind = WEBVIEW_THEME_CONST[2];
                try {
                    activeColorThemeKind = WEBVIEW_THEME_CONST[vscode.window.activeColorTheme.kind];
                } catch (err) {
                    Logger.log(`侧边：获取当前主题kind失败，默认给暗色系2${WEBVIEW_THEME_CONST[2]}`);
                    activeColorThemeKind = WEBVIEW_THEME_CONST[2];
                }
                this.invokeCallback(message, {
                    themeKind: activeColorThemeKind,
                });
                break;
            // 监听回调事件
            case 'ide.callBack':
                Logger.log('ide.callBack__', message);
                this.callBackDeal(message.params);
                break;
            // 打开一个代码对比页面
            case 'ide.ideDiffCode':
                this.ideDiffCode(message.params);
                break;
            // 跳转到指定文件
            case 'ide.jumpByPath':
                this.doJumpByPath(message.params);
                break;
            // 将传过来的markdown字符串中的文件路径做特殊处理
            case 'ide.dealJumpFilePath':
                this.doDealJumpPath(message);
                break;
            // 打开帮助文档
            case 'ide.openHelperDoc':
                this.userHelperDocPanel();
                break;
            // 登录功能
            case 'ide.login':
                this.doLogin(message);
                break;
            //检查当前access_token在服务端是否已经失效
            case 'ide.checkToken':
                this.doCheckToken(message);
                break;
            default:
                break;
            }
            /* eslint-disable */
        });

        if (this.leftOverMessage != null) {
            // If there were any messages that wasn't delivered, render after resolveWebView is called.
            this.sendMessage(this.leftOverMessage);
            this.leftOverMessage = null;
        }
    }

    /**
     * 执行回调函数,回调给webview
     */
    private invokeCallback(message: any, data: any) {
        this.webView?.webview.postMessage({ action: 'ideCallback', cbid: message.cbid, data: data });
    }

    /**
     * 处理webview回调回ide的事件
     */
    private callBackDeal(data: any) {
        const cbid = data.cbid;
        if (cbid) {
            this.callBackMap.get(cbid)?.(data);
            this.callBackMap.delete(cbid);
        }
    }

    /**
     * 发送消息给webview
     */
    public sendMessage(message: any, callBackFunc?: Function) {
        if (this.webView) {
            if (callBackFunc) {
                const cbid = "cb-" + getUuid();
                message = message ? message : { data: {} };
                message.data = message.data ? message.data : {};
                message.data.cbid = cbid;

                this.callBackMap.set(cbid, callBackFunc);
            }
            this.webView?.webview.postMessage(message);
        } else {
            this.leftOverMessage = message;
        }
    }

    /**
     * 通知视图，配置有更新
     */
    public updateConfig() {
        this.sendMessage({
            action: 'ide.updateConfig',
            data: {
                chatUrl: envSetting.chatUrl,
            }
        });
    }

    /**
     * 登录，获取服务的access_token和refresh_token
     */
    private async doLogin(message: any) {
        const accessToken = await Auth0AuthenticationProvider.getInstance().login();
        if (!accessToken) {
            vscode.window.showInformationMessage('登录失败，请重新登录');
            return;
        }
        const username = Auth0AuthenticationProvider.getUsername(accessToken);
        this.invokeCallback(message, {
            username,
            token: accessToken
        });
    }

    /**
     * 检查当前的access_token，必要的时候通过refresh_token进行更新
     */
    private async doCheckToken(message: any) {
        const accessToken = await Auth0AuthenticationProvider.getInstance().checkToken();
        if (!accessToken) {
            vscode.window.showInformationMessage('登录已失效，请重新登录');
            return;
        }
        const username = Auth0AuthenticationProvider.getUsername(accessToken);
        this.invokeCallback(message, {
            username,
            token: accessToken
        });
    }

    /**
     * 处理webview需要显示的状态通知
     */
    private doNotification(message: any) {
        if (message.params.isError) {
            vscode.window.showErrorMessage(message.params.content);
        } else if (message.params.isReviewSuccess) {
            vscode.window.showInformationMessage(message.params.content,
                { title: '查看详情', isCloseAffordance: false },
                { title: '知道了', isCloseAffordance: true }
            ).then(async selection => {
                if (selection && selection.title === '查看详情') {
                    await vscode.commands.executeCommand('vscode-zgsm.view.focus');
                    setTimeout(() => {
                        this.invokeCallback(message, message.params.data);
                    }, 500);
                }
            });
        } else if (message.params.isOpenView) {
            vscode.window.showInformationMessage(message.params.content,
                { title: "打开会话窗口", isCloseAffordance: false }
            ).then(selection => {
                if (selection && selection.title === '打开会话窗口') {
                    vscode.commands.executeCommand('vscode-zgsm.view.focus');
                    setTimeout(() => {
                        this.invokeCallback(message, message.params.data);
                    }, 500);
                }
            });
        } else {
            vscode.window.showInformationMessage(message.params.content);
        }
    }

    /**
     * 把选中代码返回给webview
     */
    private doGetSelectCode(message: any) {
        let data = {
            code: '',
            language: '',
            filePath: '',
            startLine: 0,
            endLine: 0,
        };
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            this.invokeCallback(message, data);
            return;
        }

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;

        if (startLine == endLine) {
            // 获取选中的文本并去除前后的空格
            const selectedText = editor.document.getText(editor.selection).trim();
            // 获取完整的起始和结束行的文本并去除前后的空格
            const startLineText = editor.document.lineAt(startLine).text.trim();
            // 检查选中的文本是否是完整的一行
            if (selectedText != startLineText) {
                Logger.log("ide.getSelectCode获取的代码不是完整的一行，直接返回");
                this.invokeCallback(message, data);
                return;
            }
        }

        const code = getFullLineCode(editor, startLine, endLine);
        const filePath = editor.document.uri.fsPath;
        const language = getLanguageByFilePath(filePath);
        data = {
            code,
            language: language,
            filePath: filePath,
            startLine: startLine,
            endLine: endLine,
        };

        this.invokeCallback(message, data);
    }
    /**
     * 创建一个新文件，新文件的内容为字符串text
     */
    public createNewFile(text: string, language: string) {
        // 获取当前的工作区
        const workspace = vscode.workspace;
        // 如果当前没有打开的工作区，则返回
        if (!workspace) {
            return;
        }
        // 创建一个新的未保存的文件
        const newFile = workspace.createFileSystemWatcher('untitled:*');
        // 打开新创建的文件
        workspace.openTextDocument({ content: text }).then((document) => {
            if (language) {
                Logger.log("info language:", language);
                vscode.languages.setTextDocumentLanguage(document, language);
            }
            vscode.window.showTextDocument(document);
        });
    }

    /**
     * 主题更改事件webView
     */
    private seedChangeActiveColorTheme(postData: any) {
        this.sendMessage({ action: 'editor.changeTheme', data: postData });
    }

    /**
     * 注册 主题更改事件监听器
     */
    private changeActiveColorTheme() {
        vscode.window.onDidChangeActiveColorTheme((theme) => {
            let themeColor = WEBVIEW_THEME_CONST[2];
            try {
                themeColor = WEBVIEW_THEME_CONST[theme.kind];
                Logger.log(`侧边：当前主题kind变为：${theme.kind}，${themeColor}`);
            } catch (err) {
                Logger.log(`侧边：获取当前主题kind失败，默认给暗色系2${WEBVIEW_THEME_CONST[2]}`);
            }
            this.seedChangeActiveColorTheme({ "themeKind": themeColor });
        });
    }

    /**
     * codelens 按钮事件触发后，给webview发送请求，和LLM对话
     */
    public codeLensButtonSend(codelensParams: any) {
        vscode.commands.executeCommand('vscode-zgsm.view.focus');
        setTimeout(() => {
            try {
                this.sendMessage({
                    action: 'editor.codeLensButtonSend',
                    data: codelensParams
                });
            } catch (error) {
                Logger.log("启动webview失败,等待2秒重试", error);
                setTimeout(() => {
                    this.sendMessage({
                        action: 'editor.codeLensButtonSend',
                        data: codelensParams
                    });
                }, 2000);
            }
        }, this.webView ? 0 : 1000);
    }

    /**
     * 使用手册面板事件
     */
    public userHelperDocPanel() {
        vscode.env.openExternal(vscode.Uri.parse(`${envSetting.zgsmSite}`));
    }

    /**
     * 打开用户问题反馈入口
     */
    public userFeedbackIssue() {
        vscode.env.openExternal(vscode.Uri.parse(`${envSetting.baseUrl}/issue/`));
    }

    /**
     * 登出，会导致无法使用补全
     */
    public async logout() {
        await Auth0AuthenticationProvider.getInstance().logout();
        this.sendMessage({
            action: 'ide.logout'
        });
    }

    /**
     * 打开一个代码对比diff页面
     */
    public async ideDiffCode(data: any) {
        Logger.log("ideDiffCode", data);
        try {
            let fileUri: vscode.Uri | undefined;
            let editor: vscode.TextEditor | undefined;
            let newContent: string;
            const { code, range, key, filePath } = data;

            // 如果没有传文件、起始行号，或者是单测类型，直接插入到光标处
            if (!filePath || range?.startLine === undefined || range?.endLine === undefined || (key === CODELENS_FUNC.addTests.key)) {
                editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("当前无打开的文件，无法对比或者采纳");
                    return;
                }
                fileUri = editor.document.uri;
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const originalContent = doc.getText();
                // 将代码插入到光标处（或替换选中块）
                const selection = editor.selection;
                const start = doc.offsetAt(selection.start);
                const end = doc.offsetAt(selection.end);
                newContent = originalContent.slice(0, start) + data.code + originalContent.slice(end);
            } else {
                fileUri = vscode.Uri.file(filePath);
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const originalContent = doc.getText();

                if (data.range.startLine < 0 || data.range.endLine <= 0) {
                    data.range.startLine = data.range.endLine = 0;
                } else if (data.key === CODELENS_FUNC.addComment.key && data.acceptAction !== "replace") {
                    // 如果是添加注释，是将代码插入 而不是替换，所以特殊处理一下行号问题
                    // 区分函数头和函数行注释，这里web传参accept_action区分是插入还是替换  insert / replace
                    data.range.startLine = data.range.endLine;
                } else {
                    data.range.endLine = data.range.endLine + 1;
                }
                // 将代码片段覆盖到指定行号范围
                const lines = originalContent.split('\n');
                const before = lines.slice(0, data.range.startLine).join('\n');
                const after = lines.slice(data.range.endLine).join('\n');
                newContent = `${before}\n${code}${after}`;
            }
            // 写入临时文件
            const tempDir = getVscodeTempFileDir(codeLensDiffCodeTempFileDir);
            const tempFilePath = path.join(tempDir, "untitled");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            Logger.log("写入临时文件", tempFilePath);
            fs.writeFileSync(tempFilePath, newContent);

            // 显示 diff
            await vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(tempFilePath), fileUri, '神码 查看变更');
        } catch (err) {
            Logger.error(`ideDiffCode. fail` + err);
            vscode.window.showInformationMessage('展示diff失败，请检查源文件是否被删除，如仍存在错误请联系神码客服');
        }
    }

    /**
     * 在光标处或者指定的range范围处插入代码
     */
    public async insertCode(data: any) {
        Logger.log("insertCode", data);
        try {
            let editor: vscode.TextEditor | undefined;
            const { code, range, key, filePath } = data;

            // 如果没有传文件、起始行号，或者是单测类型，直接插入到光标处
            if (!filePath || range?.startLine === undefined || range?.endLine === undefined || (key === CODELENS_FUNC.addTests.key)) {
                editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("当前无打开的文件，无法对比或者采纳");
                    return;
                }
                // 将代码插入到光标处（或替换选中块）
                const snippet = new vscode.SnippetString();
                snippet.appendText(code);
                await editor?.insertSnippet(snippet);
            } else {
                const fileUri = vscode.Uri.file(filePath);
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc);
                editor = vscode.window.activeTextEditor;
                // 将代码片段覆盖到指定行号范围
                if (range.startLine < 0 || range.endLine <= 0) {
                    const startPosition = new vscode.Position(0, 0);
                    await editor?.edit(editBuilder => {
                        editBuilder.insert(startPosition, code);
                    });
                } else {
                    let resultRange: vscode.Range;
                    if (key === CODELENS_FUNC.addComment.key && data.acceptAction !== "replace") {
                        range.startLine = range.endLine;
                        resultRange = new vscode.Range(
                            new vscode.Position(range.startLine, 0),
                            new vscode.Position(range.endLine, 0)
                        );
                    } else {
                        resultRange = new vscode.Range(
                            new vscode.Position(range.startLine, 0),
                            new vscode.Position(range.endLine, Number.MAX_VALUE)
                        );
                    }
                    await editor?.edit(editBuilder => {
                        editBuilder.replace(resultRange, code);
                    });
                }
            }
        } catch (err) {
            Logger.error(`insertCode. file open fail` + err);
            vscode.window.showInformationMessage('源文件打开失败，请检查源文件是否被删除');
        }
    }

    /**
     * 跳转到指定文件
     */
    public async doJumpByPath(data: any) {
        Logger.log("doJumpByPath", data);
        try {
            let { filePath, lineNumber } = data;
            if (filePath.includes('sendQuestion')) {
                return;
            }
            if (!filePath) {
                vscode.window.showInformationMessage('跳转失败，文件路径为空');
                return;
            }

            // 中文会被转义，先解码文件路径
            filePath = decodeURIComponent(filePath);

            if (filePath.includes("http://") || filePath.includes("https://") || filePath.startsWith("ftp://") || filePath.includes("www.")) {
                vscode.env.openExternal(vscode.Uri.parse(filePath));
                return;
            }
            if (fs.existsSync(filePath)) {
                // 判断是否是文件夹
                if (fs.statSync(filePath).isDirectory()) {
                    // 如果是文件夹，则定位到目录位置
                    const uri = vscode.Uri.file(filePath);
                    vscode.commands.executeCommand('revealInExplorer', uri);
                    return;
                }
                // 打开文件
                const document = await vscode.workspace.openTextDocument(filePath);
                const editor = await vscode.window.showTextDocument(document);

                if (lineNumber) {
                    // 定位到指定行号
                    const position = new vscode.Position(lineNumber, 0);
                    const range = new vscode.Range(position, position);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                }
            } else {
                Logger.info(`文件路径不存在：${filePath}`);
                vscode.window.showInformationMessage(`跳转失败：文件路径${filePath}不存在`);
            }
        } catch (err) {
            Logger.error("doJumpByPath failed:" + err);
            vscode.window.showInformationMessage('跳转失败');
        }
    }
    
    /**
     * 处理LLM返回内容中的本地路径
     */
    private doDealJumpPath(message: any) {
        const mdString: any = this.dealJumpFilePath(message.params);
        this.invokeCallback(message, { data: mdString });
    }

    /**
     * 传过来的markdown字符串中的文件路径做特殊处理
     */
    private dealJumpFilePath(data: any) {
        Logger.log("dealJumpFilePath", data);
        const { mdString } = data;
        try {
            let cleanText = mdString;
            if (!mdString) {
                return mdString;
            }

            // 定义正则，匹配md中的超链接
            const pattern = /\[(.*?)\]\((.*?)\)/g;

            let match: RegExpExecArray | null;

            // 处理违规的字符串，替换成md支持的
            function replaceSymbols(text: String) {
                // 需要替换的字符串
                const replaceMap: { [key: string]: string; } = {
                    " ": "%20",
                    "_": "\\_"
                };
                for (const source in replaceMap) {
                    const target = replaceMap[source];
                    text = text.split(source).join(target);
                }
                return text;
            }

            while ((match = pattern.exec(mdString)) !== null) {
                const [hyperlink, fileName, filePath] = match;
                if (filePath.includes('sendQuestion')) {
                    continue;
                }
                // 剔除web超链接
                if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("ftp://") || filePath.includes("www.")) {
                    continue;
                }

                // 判断文件是否存在
                if (!fs.existsSync(filePath)) {
                    // 如果文件不存在，取消掉超链接
                    cleanText = cleanText.replace(hyperlink, fileName);
                } else {
                    // 链接中的文件名
                    // const name = path.basename(filePath);

                    // const validName = replaceSymbols(name);
                    const validFilepath = replaceSymbols(filePath);

                    const replaceHyperlink = `[${fileName}](${validFilepath} "${filePath}")`;
                    cleanText = cleanText.replace(hyperlink, replaceHyperlink);
                }
            }
            Logger.log("dealJumpFilePath close", { data: cleanText });
            return cleanText;
        } catch (err) {
            Logger.error(`dealJumpFilePath. fail` + err);
            return mdString;
        }
    }
}
