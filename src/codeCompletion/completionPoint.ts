/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { CompletionAcception, CompletionCorrection, CompletionDocumentInformation, CompletionPrompt } from "./completionDataInterface";
import { Position, TextDocument } from 'vscode';


/**
 * 根据编辑位置，计算主键(该主键作为补全点的唯一标识)
 */
export function calcKey(fpath: string, line: number, column: number): string {
    //  test.py@12:1
    return fpath + "@" + line + ":" + column;
}

//
//代码补全生命周期主要时间点：
//内容生成阶段：【代码补全点创建】--定时-->【代码补全RPC开始】-->请求-->获取结果-->【代码补全RPC结束】
//处理结果阶段：【代码补全RPC结束】--用户处理结果-->【接受/拒绝】
//修正内容阶段：【接受/拒绝】-->修正代码-->【获取用户修正内容】-->上报结果-->【代码补全点销毁】
//
/**
 * 代码补全点
 * 记录一个代码位置发生的补全逻辑，及相关信息
 */
export class CompletionPoint {
    // 补全点的唯一ID
    public readonly id: string = "";
    // 触发补全的方式：auto, manual
    public readonly triggerMode: string = "";
    // 补全点所在文档的信息
    public readonly doc: CompletionDocumentInformation;
    // 光标所在位置
    public readonly pos: Position;
    // 光标所在行前代码
    public readonly linePrefix: string = "";
    // 光标所在行后代码
    public readonly lineSuffix: string = "";
    // 光标前所有代码
    public readonly prefix: string = "";
    // 光标后所有代码
    public readonly suffix: string = "";
    // 代码补全点创建时间
    public readonly createTime: number = 0;
    // 代码补全开始时间
    private startTime: number = 0;
    // 代码补全结束时间
    private endTime: number = 0;
    // 用户处理补全结果的时间
    private handleTime: number = 0;
    // 补全结果接受状态
    private acception: CompletionAcception = CompletionAcception.None;
    // 获取到的代码补全内容
    private content: string = "";
    // 用户修正后的实际代码
    private actualCode: string = "";
    // 用户修正代码的行为类型: none, changed, unchanged
    private correction: CompletionCorrection = CompletionCorrection.None;

    constructor(id: string, docInfo: CompletionDocumentInformation, pos: Position, 
        prompt: CompletionPrompt, triggerMode: string, createTime: number) {
        this.id = id;
        this.doc = docInfo;
        this.pos = pos;
        this.linePrefix = prompt.cursor_line_prefix;
        this.lineSuffix = prompt.cursor_line_suffix;
        this.prefix = prompt.prefix;
        this.suffix = prompt.suffix;
        this.triggerMode = triggerMode;
        this.createTime = createTime;
    }

    /**
     * 获取补全点的主键
     */
    public getKey(): string {
        return calcKey(this.doc.fpath, this.pos.line, this.pos.character);
    }
    /**
     * 获取补全提示
     */
    public getPrompt(): CompletionPrompt {
        return {
            prefix: this.prefix,
            suffix: this.suffix,
            cursor_line_prefix: this.linePrefix,
            cursor_line_suffix: this.lineSuffix,
        }
    }

    public getContent(): string {
        return this.content;
    }
    public getActualCode(): string {
        return this.actualCode;
    }
    public getStartTime(): number {
        return this.startTime;
    }
    public getEndTime(): number {
        return this.endTime;
    }
    public getHandleTime(): number {
        return this.handleTime;
    }
    public getAcception(): CompletionAcception {
        return this.acception;
    }
    public getCorrection(): CompletionCorrection {
        return this.correction;
    }
    /**
     * 判断两个补全点是否严格一致，位置没变，前导代码也没有发生变化
     */
    public isStrictSamePosition(other: CompletionPoint): boolean {
        return this.isSamePosition(other) && 
            this.linePrefix === other.linePrefix && 
            this.lineSuffix === other.lineSuffix;
    }
    /**
     * 判断是否同一位置
     */
    public isSamePosition(other: CompletionPoint): boolean {
        return this.doc.fpath === other.doc.fpath && 
            this.pos.line === other.pos.line && 
            this.pos.character === other.pos.character;
    }
    /**
     * 判断是否同一行
     */
    public isSameLine(other: CompletionPoint): boolean {
        return this.doc.fpath === other.doc.fpath && this.pos.line === other.pos.line;
    }
    /**
     * 判断是否同一文档,同一位置
     */
    public isSameAsDoc(document: TextDocument, pos: Position): boolean {
        return this.doc.fpath === document.uri.fsPath && this.pos.isEqual(pos);
    }
    /**
     * 该补全点已经进入终结态，可以做临终陈述了
     */
    public isFinished(): boolean {
        if (this.acception === CompletionAcception.None)
            return false;
        if (this.acception === CompletionAcception.Canceled)
            return true;
        return this.correction !== CompletionCorrection.None;
    }
    /**
     * 提交补全点
     */
    public submit() {
        this.startTime = Date.now();
    }
    /**
     * 取消补全点
     */
    public cancel() {
        this.acception = CompletionAcception.Canceled;
        this.endTime = Date.now();
    }
    /**
     * 设置获取到的补全结果，该补全结果来自LLM生成或其它途径
     */
    public fetched(content: string) {
        this.content = content;
        this.endTime = Date.now();
    }
    /**
     * 接受补全内容
     */
    public accept() {
        this.handleTime = Date.now();
        this.acception = CompletionAcception.Accepted;
    }
    /**
     * 拒绝补全内容
     */
    public reject() {
        this.handleTime = Date.now();
        this.acception = CompletionAcception.Rejected;
    }
    /**
     * 用户改变了补全内容
     */
    public changed(actualCode: string) {
        this.actualCode = actualCode;
        this.correction = CompletionCorrection.Changed;
    }
    /**
     * 后期核对，用户完全接受补全内容
     */
    public unchanged() {
        this.correction = CompletionCorrection.Unchanged;
    }
}
