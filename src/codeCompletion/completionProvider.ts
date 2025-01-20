/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { Mutex } from 'async-mutex';
import { CancellationToken, Disposable, ExtensionContext, InlineCompletionContext, InlineCompletionItem, InlineCompletionItemProvider, InlineCompletionList, Position, ProviderResult, Range, TextDocument, workspace } from 'vscode';
import { COMPLETION_CONST } from "../common/constant";
import { CompletionAcception, CompletionDocumentInformation, CompletionPrompt, CompletionMode, CompletionRequirement } from "./completionDataInterface";
import { CompletionClient } from './completionClient';
import { Logger } from "../common/log-util";
import { getLanguageByFilePath, LangSetting, LangSwitch } from '../common/lang-util';
import { CompletionCache } from './completionCache';
import { getHideScoreArgs } from "./completionScore";
import { CompletionStatusBar } from "./completionStatusBar";
import { CompletionPoint } from './completionPoint';
import { CompletionTrace } from './completionTrace';

export class AICompletionProvider implements InlineCompletionItemProvider, Disposable {
    private disposables: Disposable[] = [];
    private timer: NodeJS.Timeout | undefined;
    private mutex: Mutex;
    private extensionContext: ExtensionContext;

    constructor(context: ExtensionContext) {
        this.activate();
        this.mutex = new Mutex();
        this.timer = undefined;
        this.extensionContext = context;
        CompletionTrace.init(context);
    }

    /**
     * 获取补全提示
     * 有若干情况，不进行补全，原因大致分两大类：
     * 1. 不允许：语言不支持,配置不补全,服务不正常
     * 2. 不需要：该位置已有补全点，用户不采信，编辑位置发生变化，先导串发生变化
     */
    // @ts-expect-error: because ASYNC and PROMISE
    public async provideInlineCompletionItems(
        document: TextDocument, 
        pos: Position, 
        context: InlineCompletionContext, 
        token: CancellationToken
    ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
        /* eslint-disable no-async-promise-executor */
        let triggerMode = 'auto';
        if (this.extensionContext.workspaceState.get('shortCutKeys') == true) {
            triggerMode = 'manual';
            this.extensionContext.workspaceState.update('shortCutKeys', false);
        }
        const docInfo = this.getDocumentInformation(document);
        if (!this.enableCompletion(triggerMode, docInfo)) {
            return [];
        }
        if (!this.needCompletion(pos)) {
            return [];
        }
        this.cancelBrokens();
        let cp = this.createCompletionPoint(document, pos, triggerMode);
        const latest = CompletionCache.getLatest();
        const required = this.completionDecision(triggerMode, latest, cp);
        switch (required.mode) {
        case CompletionMode.DontNeed:
            return [];
        case CompletionMode.Cached:
            if (!latest)
                return [];
            return this.toInlineCompletions(document, latest);
        case CompletionMode.Partial:
            if (!latest)
                return [];
            cp = CompletionCache.cache(cp);
            cp.fetched(required.remain ?? "")
            return this.toInlineCompletions(document, cp);
        default:
            break;
        }
        cp = CompletionCache.cache(cp);
        let delayTimeval = this.calcDelayTimeval(triggerMode, cp);
        Logger.info(`补全[${cp.id}]：准备补全, 触发模式：${triggerMode}, 位置: ${cp.pos.line}:${cp.pos.character}, 延迟时间：${delayTimeval}ms`);
        return new Promise(async (resolve, reject) => {     // 防抖
            await this.mutex.runExclusive(async () => {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = undefined;
                }
                // 创建一个新的定时器
                this.timer = setTimeout(async () => {
                    Logger.info(`补全[${cp.id}]：补全进入定时器执行, 位置: ${pos.line}:${pos.character}`);
                    try {
                        // 在这里执行计算和渲染逻辑
                        const result = await this.doProvideInlineCompletionItems(document, cp);
                        resolve(result);
                    } catch (error) {
                        // 处理Promise被拒绝的情况
                        Logger.info(`补全[${cp.id}]：Promise rejected error: `, error);
                        reject(error);
                    }
                }, delayTimeval as number);
            });
        });
    }

    public activate() {
        this.setFeedbackTimer();
        this.setDidChangeTextDocument();
    }

    public dispose() {
        Disposable.from(...this.disposables).dispose();
    }

    /**
     * 是否允许代码补全
     */
    private enableCompletion(triggerMode: string, docInfo: CompletionDocumentInformation): boolean {
        if (!LangSetting.completionEnabled) { //全局禁用会忽略触发模式
            Logger.info("补全：补全扩展为禁用状态，不补全");
            return false;
        }
        const sw = LangSetting.getCompletionDisable(docInfo.language);
        if (sw === LangSwitch.Unsupported) {
            Logger.info(`补全：${docInfo.language} 语言暂不支持代码补全`);
            return false;
        }
        if (triggerMode == 'auto') {
            if (sw === LangSwitch.Disabled) {
                Logger.info(`补全：当前语言 ${docInfo.language} 补全功能已被禁用`);
                return false;
            }
        }
        //手动模式会强行补全
        return true;
    }

    /**
     * 是否需要代码补全
     */
    private needCompletion(pos: Position): boolean {
        // 判断光标前是否没有任何内容
        if (pos.isEqual(new Position(0,0))) {
            Logger.info("补全：Prompt为空，无需补全");
            return false;
        }
        return true;
    }

    /**
     * 取消已经失效的补全点
     */
    private cancelBrokens() {
        let all = CompletionCache.all();
        for (let n = 0; n < all.length - 1; n++) {
            let cp = all[n];
            if (cp.getAcception() === CompletionAcception.None) {
                cp.cancel();
            }
        }
    }
    /**
     * 和前一个补全点对比，判断后续补全模式
     * 根据当前位置的信息对之前若干补全点进行标注，并确定之后的补全模式
     */
    private completionDecision(triggerMode: string, 
        latest: CompletionPoint | undefined, 
        cp: CompletionPoint
    ): CompletionRequirement {
        if (!latest) {
            return {
                mode: CompletionMode.Newest
            }
        }
        if (cp.isSamePosition(latest)) {    //  相同位置
            if (latest.getContent().length === 0) {
                return {
                    mode: CompletionMode.DontNeed
                }
            }
            return {
                mode: CompletionMode.Cached
            }
        }
        // 比较两个补全点的内容之间的关系
        let res = this.matchCompletion(latest, cp);
        if ((res.mode === CompletionMode.Partial || res.mode === CompletionMode.Cached) 
            && triggerMode == "manual") {
            res.mode = CompletionMode.Newest;
        }
        return res;
    }

    /**
     * 判断补全点cur新输入字符是否是上一个补全点的补全内容
     */
    private matchCompletion(last: CompletionPoint, cur: CompletionPoint): CompletionRequirement {
        // 获取上次的光标前面部分代码
        const lastPrefix = last.linePrefix;
        // 获取上次补全的内容
        const lastCompletion = last.getContent();
        // 本次的光标前内容
        const curPrefix = cur.linePrefix;
        if (!lastPrefix || !curPrefix || !lastCompletion || curPrefix.length < lastPrefix.length) {
            return {
                mode: CompletionMode.Newest
            };
        }
        // 部分匹配（两个向上的箭头如果重合，则是完全匹配）：
        // head ... lastPrefix.length> | <lastCompletion ... lastCompletion.length> | <lastSuffix ...
        //                                                                    ^     ^
        // head ... curPrefix[...]     | <inputString ... inputString.length> | ... | < curSuffix ...
        const inputString = curPrefix.substring(lastPrefix.length);
        if (!inputString) {  //没有输入
            return {
                mode: CompletionMode.Cached
            }
        }
        if (inputString.length > lastCompletion.length) {
            return {
                mode: CompletionMode.Newest
            }
        }
        // 如果对比上次触发补全时新加的内容 是 上次补全开头重叠的内容，直接缓存上次的内容
        if (!lastCompletion.startsWith(inputString)) {
            return {
                mode: CompletionMode.Newest
            }
        }
        if (lastCompletion.length === inputString.length) {
            return {
                mode: CompletionMode.Newest
            }
        }
        return {
            mode: CompletionMode.Partial,
            matchLen: inputString.length,
            remain: lastCompletion.substring(inputString.length)
        }
    }
    /**
     * 计算同一行的拒绝次数
     */
    private calcLineRejection(cur: CompletionPoint): number {
        let rejected = 0;
        const all = CompletionCache.all();
        for (let n = all.length - 1; n >= 0; n--) {
            const cp = all[n];
            if (!cp.isSameLine(cur))
                break;
            const acception = cp.getAcception();
            if (acception === CompletionAcception.Accepted)
                break;
            else if (acception === CompletionAcception.Rejected)
                rejected++;
        }
        return rejected;
    }
    /**
     * 更新延迟时间
     * 补全延迟时间默认为300ms, 只有用户在该位置停留该时间后才会触发，避免过度触发干扰用户输入
     */
    private calcDelayTimeval(triggerMode: string, cp: CompletionPoint): number {
        if (triggerMode == 'manual') {
            return COMPLETION_CONST.manualTriggerDelay;
        }
        let latest = CompletionCache.getLatest();
        if (!latest) {
            return COMPLETION_CONST.suggestionDelay;
        }
        let rejectCount = this.calcLineRejection(cp);
        let delayTimeval = rejectCount * COMPLETION_CONST.lineRejectedDelayIncrement;
        delayTimeval = delayTimeval + COMPLETION_CONST.suggestionDelay;
        if (delayTimeval > COMPLETION_CONST.lineRejectedDelayMax) {
            delayTimeval = COMPLETION_CONST.lineRejectedDelayMax;
        }
        return delayTimeval;
    }
    /**
     * 把LLM返回的补全结果转成内联补全项
     */
    private toInlineCompletions(document: TextDocument, cp: CompletionPoint): InlineCompletionItem[] {
        let content = cp.getContent();
        if (!content) {
            CompletionStatusBar.noSuggest();
            return [];
        }
        CompletionStatusBar.complete();
        const completion = new InlineCompletionItem(content, new Range(cp.pos, cp.pos));
        return [completion];
    }

    /**
     * 当前编辑位置的文档相关信息，比如：文档名，文档路径，编程语言
     */
    private getDocumentInformation(document: TextDocument): CompletionDocumentInformation {
        return {
            fpath: document.uri.fsPath,
            language: getLanguageByFilePath(document.uri.fsPath),
        }
    }
    /**
     * 发起请求获取补全提示
     */
    private async doProvideInlineCompletionItems(
        document: TextDocument, 
        cp: CompletionPoint
    ): Promise<InlineCompletionItem[] | InlineCompletionList> {
        //  超时时间过后，有了新的输入，当前补全点cp被最后一个补全点覆盖
        let latest = CompletionCache.getLatest();
        if (latest && !latest.isStrictSamePosition(cp)) {
            cp.cancel();
            return [];
        }
        CompletionStatusBar.loading();
        cp.submit();
        return CompletionClient.callApi(cp, 
            getHideScoreArgs(document, latest, cp)
        ).then((response) => {
            latest = CompletionCache.getLatest();
            if (latest && cp.id != latest.id) {
                // 避免多个请求同时响应回来的时候 回显旧的请求补全内容
                Logger.info(`补全[${cp.id}]：忽略补全结果，新补全[${latest.id}]位于[${latest.getKey()}]`);
                return Promise.resolve(([] as InlineCompletionItem[]));
            }
            if (!response) {
                CompletionStatusBar.noSuggest();
                return Promise.resolve(([] as InlineCompletionItem[]));
            }
            this.setCollectTimer(document, cp, COMPLETION_CONST.collectInterval);
            return Promise.resolve(this.toInlineCompletions(document, cp));
        }).catch((error) => {
            if (cp.getAcception() == CompletionAcception.Canceled) {
                Logger.info(`补全[${cp.id}]：请求被取消`);
            } else {
                Logger.error(`补全[${cp.id}]：获取补全内容失败`, error);
                CompletionStatusBar.fail();
            }
            return Promise.reject(error);
        });
    }

    /**
     * 设置定时反馈信息的定时器，需要反馈几类信息：
     * 1. 效果数据：用户是否接受补全内容；
     * 2. 性能数据：补全请求端到端花费的时间，请求正常与否；
     * 3. 改进数据：用户拒绝补全后实际输入的内容；
     */
    private setFeedbackTimer() {
        setInterval(() => {
            CompletionTrace.uploadPoints();
            CompletionTrace.uploadMemo();
        }, COMPLETION_CONST.feedbackInterval);
    }

    /**
     * 设置文档变更时的执行逻辑
     */
    private setDidChangeTextDocument() {
        this.disposables.push(workspace.onDidChangeTextDocument(event => {
            const document = event.document;
            const changes = event.contentChanges;
            const lastChange = changes?.[changes.length - 1];
            if (!lastChange) {
                return;
            }
            const cur = CompletionCache.getLatest();
            if (!cur) {
                return;
            }
            const pos = lastChange.range.start;
            if (!cur.isSameAsDoc(document, pos)) {
                return;
            }
            // 本次变更的文本
            let changeText = lastChange.text;
            if (lastChange.text) {
                changeText = lastChange.text.trim();
            }
            // 上次补全的文本
            let completionText = cur.getContent();
            if (!changeText || !completionText) {
                return;
            }
            // 变更文本正好和补全文本相同，则说明用户接受了补全
            if (completionText.replace(/\r\n/g, '\n') == changeText.replace(/\r\n/g, '\n')) {
                Logger.info(`补全[${cur.id}]：补全内容已被接受: ${changeText}`);
                cur.accept();
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = undefined;
                }
            }
        }));
    }
    /* 
     * 设置代码采集定时器，用于采集用户拒绝补全后的实际输入代码
     * 补全请求完成之后，延迟 timerDelay 秒上报用户实际编写代码
     * 用户实际编写代码: 获取在光标之后与补全代码相同行数的代码，并排除文件原来已经存在的代码
     * 如果用户没有进行修改或者没有补全就不上报
    */
    private setCollectTimer(
        document: TextDocument, 
        cp: CompletionPoint, 
        timerDelay: number
    ) {
        Logger.info(`补全[${cp.id}]：启动一个 ${timerDelay}ms 后开始执行的 collectTimer`);

        const completionText = cp.getContent();
        const pos = cp.pos;
        // 获取补全行数
        const completionsLineLength = completionText.split("\n").length - 1;
        // 获取文档中光标之后的与补全行数相同行数的代码
        const originTotalLines = document.lineCount;
        const originText = document.getText(new Range(pos, document.lineAt(Math.min(originTotalLines - 1, pos.line + completionsLineLength)).range.end));

        setTimeout(() => {
            Logger.info(`补全[${cp.id}]：collectTimer 开始执行`);
            // 上报 接受补全 在光标之后 与补全代码相同行数的实际编写代码
            const actualTotalLines = document.lineCount;
            const actualText = document.getText(new Range(pos, document.lineAt(Math.min(actualTotalLines - 1, pos.line + completionsLineLength)).range.end));

            // 如果实际代码与补全代码相同，说明接受了补全，不上报代码
            if (completionText && actualText && completionText.replace(/\r\n/g, '\n') == actualText.replace(/\r\n/g, '\n')) {
                Logger.info('补全：实际代码与补全代码相同', actualText);
                cp.unchanged();
                return;
            }

            // 如果实际代码与源文件中的代码相同 说明没有进行修改，不上报代码
            if (originText.replace(/\r\n/g, '\n') == actualText.replace(/\r\n/g, '\n')) {
                Logger.info('补全：实际代码与源文件中的代码相同', actualText);
                cp.reject();
                cp.unchanged();
                return;
            }

            // 判断获取的实际代码是否存在源文件中的内容，如果存在，则去除
            const actualRows = actualText.split("\n");
            const originRows = originText.split("\n");

            let uploadRows = [];
            // 判断实际代码的最后一行不存在源文件，即，用户新输入的内容或补全的内容
            const actualLastRow = actualRows[actualRows.length - 1];
            if (!originRows.includes(actualLastRow)) {
                uploadRows = actualRows;
            } else {
                // 逐行比较实际代码是否存在源文件中
                for (let i = actualRows.length - 1; i >= 0; i--) {
                    const actualRow = actualRows[i];
                    if (!originRows.includes(actualRow)) {
                        uploadRows.unshift(actualRow);
                    }
                }
            }
            // 数据上报
            if (uploadRows.length) {
                const actualCode = uploadRows.join("\n");
                cp.changed(actualCode);
                Logger.info(`补全[${cp.id}]：补全内容被改变为: ${actualCode}`);
            }
        }, timerDelay);
    }

    /**
     * 创建代码补全点
     */
    private createCompletionPoint(document: TextDocument, pos: Position, triggerMode: string): CompletionPoint {
        const docInfo = this.getDocumentInformation(document);
        const prompt = this.getPrompt(document, pos);

        return new CompletionPoint("", docInfo, pos, prompt, triggerMode, Date.now());
    }

    /**
     * 获取光标所在处的关联代码，用于后续补全
     */
    private getPrompt(document: TextDocument, pos: Position): CompletionPrompt {
        const prefix = document.getText(new Range(new Position(0, 0), pos));
        const suffix = document.getText(new Range(pos, document.lineAt(document.lineCount - 1).range.end));
        const lineText = document.lineAt(pos.line).text;
        const linePrefix = lineText.substring(0, pos.character);
        const lineSuffix = lineText.substring(pos.character);

        return {
            prefix,
            suffix,
            cursor_line_prefix: linePrefix,
            cursor_line_suffix: lineSuffix,
        };
    }

}
