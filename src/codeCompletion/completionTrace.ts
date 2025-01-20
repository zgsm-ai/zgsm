/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { Logger } from "../common/log-util";
import { envSetting } from "../common/env";
import { createAuthenticatedHeaders } from "../common/api";
import { CompletionPoint } from "./completionPoint";
import { getAcceptionString, getCorrectionString } from "./completionDataInterface";
import { CompletionCache } from "./completionCache";
import { writeLogsSync } from "../common/vscode-util";
import * as vscode from "vscode";

/**
 * 统计指标备忘本
 */
interface CompletionMemo {
    openapi_total: number;  //openapi调用总数
    openapi_error: number;  //openapi出错次数
    openapi_cancel: number; //openapi调用取消的次数
    memo_ok: number;        //远程备忘成功的记录数目
    memo_failed: number;    //远程备忘失败的记录数目
    upload_ok: number;      //调用upload的成功计数
    upload_failed: number;  //调用upload的失败计数

    status: Map<string, number>;
}
/**
 * 补全行为的运行痕迹记录上报
 */
export class CompletionTrace {
    private axios = require('axios');   //ajax通讯
    private static client: CompletionTrace | undefined = undefined; //痕迹数据上报客户端（单例）
    private context: vscode.ExtensionContext;
    private errors = new Map<string, number>(); //各个状态对应错误发生次数
    private openApiTotal: number = 0;   //调用openapi总请求数
    private openApiCancel: number = 0;  //调用openapi被取消次数
    private openApiError: number = 0;   //调用openapi出错的请求数
    private memoOk: number = 0;         //上报成功的补全点信息条数
    private memoFailed: number = 0;     //没上报成功的补全点信息条数
    private uploadOk: number = 0;       //upload API调用成功计数
    private uploadFailed: number = 0;   //upload API调用失败计数
    private lastUploadError: number = 0;    //上一次上传成功时的错误总计数(openApiError)

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static init(context: vscode.ExtensionContext) {
        let client = this.getInstance(context);
        const memo: CompletionMemo | undefined = client.context.globalState.get("trace");
        if (!memo) 
            return;
        client.openApiTotal = memo.openapi_total;
        client.openApiError = memo.openapi_error;
        client.openApiCancel = memo.openapi_cancel;
        client.uploadOk = memo.upload_ok;
        client.uploadFailed = memo.upload_failed;
        client.memoOk = memo.memo_ok;
        client.memoFailed = memo.memo_failed;
    }
    /**
     * 报告补全API执行OK
     */
    public static reportApiOk() {
        const client = this.getInstance();
        client.openApiTotal++;
    }
    /**
     * 报告补全API被取消
     */
    public static reportApiCancel() {
        const client = this.getInstance();
        client.openApiCancel++;
        client.openApiTotal++;
    }
    /**
     * 报告补全API发生错误
     */
    public static reportApiError(status: string): number {
        let client = this.getInstance();
        client.openApiError++;
        client.openApiTotal++;
        let cnt = client.errors.get(status);
        if (!cnt) {
            cnt = 1;
        } else {
            cnt++;
        }
        client.errors.set(status, cnt);
        return cnt;
    }
    /**
     * 上报并清除一批补全点数据
     */
    public static async uploadPoints(): Promise<number> {
        const url = `${envSetting.baseUrl}/api/feedbacks/completions`;
        let client = this.getInstance();
        const datas = this.constructDatas();
        if (datas.count === 0) {
            return 0;
        }
        if (datas.count > 1) {
            CompletionCache.erase(datas.count);
        }
        writeLogsSync("completions.log", JSON.stringify(datas));
        await client.postDatas(url, datas).then(result => {
            client.memoOk += datas.count;
            client.uploadOk++;
        }).catch(err => {
            client.memoFailed += datas.count;
            client.uploadFailed++;
        });
        return datas.count;
    }

    /**
     * 上报累积的错误
     */
    public static async uploadMemo() {
        let client = this.getInstance();
        const data: CompletionMemo = {
            "openapi_total": client.openApiTotal,
            "openapi_cancel": client.openApiCancel,
            "openapi_error": client.openApiError,
            "memo_ok": client.memoOk,
            "memo_failed": client.memoFailed,
            "upload_ok": client.uploadOk,
            "upload_failed": client.uploadFailed,
            "status": client.errors,
        };
        client.context.globalState.update("trace", data);
        if (client.openApiError == client.lastUploadError) {
            return;
        }
        const url = `${envSetting.baseUrl}/api/feedbacks/error`;
        await client.postDatas(url, data).then(result => {
            client.lastUploadError = client.openApiError;
            client.uploadOk++;
        }).catch(err => {
            client.uploadFailed++;
        });
    }
    /**
     * 设置CompletionTrace日志定时上传的定时器
     */
    private static getInstance(context: vscode.ExtensionContext | undefined = undefined): CompletionTrace {
        if (!this.client) {
            if (!context) {
                throw Error("必须先调用CompletionTrace.init初始化");
            }
            this.client = new CompletionTrace(context);
        }
        return this.client;
    }
    /**
     * 根据补全点信息，构建上报的数据
     */
    private static constructData(cp: CompletionPoint): any {
        return {
            "id": cp.id,
            "language": cp.doc.language,
            "acception": getAcceptionString(cp.getAcception()),
            "correction": getCorrectionString(cp.getCorrection()),
            "actual_code": cp.getActualCode(),
            "create_time": cp.createTime,
            "start_time": cp.getStartTime(),
            "end_time": cp.getEndTime(),
            "handle_time": cp.getHandleTime(),
            "expend_time": cp.getEndTime() - cp.createTime,
        };
    }
    /**
     * 把进入终态的补全点构建到上报数据中
     */
    private static constructDatas() {
        let datas = [];
        let all = CompletionCache.all();
        let n = 0;
        for (n = 0; n < all.length - 1; n++) {
            let cp = all[n];
            if (!cp.isFinished())
                break;
            datas.push(this.constructData(cp));
        }
        return {
            "count": datas.length,
            "data": datas
        }
    }
    /**
     * 代码补全日志上报
     */
    private async postDatas(url: string, data: any): Promise<string> {
        return this.axios.post(url, data, {
            headers: createAuthenticatedHeaders()
        }).then(function (response: { data: any; }) {
            response = response.data;
            Logger.debug(`补全：post(${url}) succeeded`, data);
            return Promise.resolve(response.data)
        }).catch(function (error: any) {
            Logger.debug(`补全：post(${url}) failed`, data);
            return Promise.reject(error);
        });
    }
}

