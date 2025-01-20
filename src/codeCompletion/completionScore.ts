/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { TextDocument } from "vscode";
import { CompletionAcception } from "./completionDataInterface";
import { CompletionPoint } from "./completionPoint";

/**
 * 快速预判的计分数据
 */
export interface CompletionScores {
    is_whitespace_after_cursor: boolean;    //光标后是否全部为空白符
    prefix: string;                         //前缀代码
    document_length: number;                //文档长度
    prompt_end_pos: number;                 //光标在文档中的偏移量
    previous_label: number;                 //上一次补全是否接受,1:接受,0:拒绝
    previous_label_timestamp: number;       //上一次补全的时间戳
}

/**
 * 用于补全服务计算得分(用于快速过滤低质量请求,减少大模型推理工作量)
 */
export function getHideScoreArgs(document: TextDocument, 
    latest: CompletionPoint|undefined, 
    cur: CompletionPoint
): CompletionScores {
    let previousLabel = 0;
    let previousLabelTimestamp = Date.now() - 3600;
    if (latest && latest.getAcception() == CompletionAcception.Accepted) {
        previousLabel = 1;
        previousLabelTimestamp = latest.getHandleTime();
    }

    const lineSuffix = cur.lineSuffix;
    let iswhitespaceAfterCursorTrue = false;
    if ("" === lineSuffix.trim()) {
        iswhitespaceAfterCursorTrue = true;
    }
    const promptEndPos = document.offsetAt(cur.pos);
    const editorArgs = {
        "is_whitespace_after_cursor": iswhitespaceAfterCursorTrue,
        "prefix": cur.prefix,
        "document_length": document.getText().length,
        "prompt_end_pos": promptEndPos,
        "previous_label": previousLabel,
        "previous_label_timestamp": previousLabelTimestamp
    };
    return editorArgs;
}
