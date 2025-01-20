/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { Configuration, CreateCompletionResponse, OpenAIApi } from 'openai';
import { envClient, envSetting } from "../common/env"
import { Logger } from "../common/log-util";
import { window, workspace } from 'vscode';
import { AxiosResponse } from "axios";
import { createAuthenticatedHeaders } from "../common/api";
import { configCompletion, settings } from "../common/constant";
import { CompletionPoint } from './completionPoint';
import { CompletionScores } from './completionScore';
import { CompletionTrace } from './completionTrace';

/**
 * 补全客户端，处理和大模型API通讯的细节，向调用方屏蔽通讯细节。
 * 调用方可以和调用本地函数一样方便处理网络通讯。
 */
export class CompletionClient {
    private static client: CompletionClient|undefined = undefined;
    private openai: OpenAIApi | undefined;
    private stopWords: string[] = [];
    private reqs: Map<string, any> = new Map<string, any>();
    private betaMode: any = undefined;

    /**
     * 向LLM发起请求，获得补全点cp上的代码补全结果
     */
    public static async callApi(cp: CompletionPoint, scores: CompletionScores): Promise<string> {
        const client = this.getInstance();
        if (!client) {
            return Promise.reject(new Error('配置异常'));
        }
        return client.doCallApi(cp, scores).then(response => {
            Logger.log(`补全[${cp.id}]：请求成功`, response);
            cp.fetched(client.acquireCompletionText(response.data))
            CompletionTrace.reportApiOk();
            return Promise.resolve(cp.getContent());
        }).catch(err => {
            if (client.openai.axios.isCancel(err)) {
                Logger.log(`补全[${cp.id}]：请求已取消`, err)
                cp.cancel();
                CompletionTrace.reportApiCancel();
            } else {
                Logger.error(`补全[${cp.id}]：请求失败`, err);
                this.client = undefined;
                CompletionTrace.reportApiError(err.status);
            }
            return Promise.reject(err);
        }).finally(() => {
            client.reqs.delete(cp.id);
        });
    }
    /**
     * 取消补全点cp发起的，但还没完成的请求
     */
    public static cancelApi(cp: CompletionPoint) {
        const client = this.getInstance();
        if (!client) {
            return;
        }
        let value = client.reqs.get(cp.id);
        if (value) {
            Logger.log(`请求[id=${cp.id}]被取消`);
            value.cancel(`请求[id=${cp.id}]被取消`);
            client.reqs.delete(cp.id);
        }
    }
    /**
     * 创建openai客户端，用于调用LLM的API
     */
    private createClient(force: boolean): boolean {
        if (this.openai && !force)
            return true;
        if (!envClient.apiKey) {
            Logger.error('获取登录信息失败，请重新登录后使用补全服务', envClient);
            window.showErrorMessage('获取登录信息失败，请重新登录后再使用补全服务');
            return false;
        }
        // 配置实时生效
        let configuration = new Configuration({
            apiKey: envClient.apiKey
        });
        this.openai = new OpenAIApi(configuration, envSetting.completionUrl);
        if (!this.openai) {
            Logger.error("补全：配置异常: configuration:", configuration, "openai: ", this.openai);
            return false;
        }
        this.stopWords = workspace.getConfiguration(configCompletion).get("inlineCompletion") ? ["\n", "\r"] : [];
        this.betaMode = workspace.getConfiguration(configCompletion).get("betaMode");
        Logger.info(`补全: 创建OpenAIApi客户端，URL: ${envSetting.completionUrl}, betaMode: ${this.betaMode}, stopWords: ${this.stopWords}`)
        return true;
    }
    /**
     * 客户端采用单实例
     */
    private static getInstance(): CompletionClient|undefined {
        if (!this.client) {
            this.client = new CompletionClient();
            if (!this.client.createClient(true)) {
                this.client = undefined;
            }
        }
        return this.client;
    }
    /**
     * 从LLM返回结果中获取补全内容
     */
    private acquireCompletionText(resp: CreateCompletionResponse): string {
        if (!resp || !resp.choices || resp.choices.length === 0) {
            return "";
        }

        let text = "";
        for (const choice of resp.choices) {
            if (choice.text) {
                text = choice.text.trim();
                if (text.length > 0) {
                    break;
                }
            }
        }
        if (!text) {
            return "";
        }
        //  因为中文占用3个字节，所以插件可能会受Max Tokens影响，在结果返回时最后一个中文只返回了一半，导致出现乱码，
        //  需要将乱码替换为''
        if (text.includes('�')) {
            text = text.replace(/�/g, '');
        }
        return text;
    }
    /**
     * 代码补全发起请求
     */
    private async doCallApi(cp: CompletionPoint, 
        scores: CompletionScores
    ): Promise<AxiosResponse<CreateCompletionResponse, any>> {
        // 遍历所有的请求，有新的话则取消旧的请求
        for (const [key, value] of this.reqs) {
            Logger.log(`补全：请求被取消 id: ${key}`);
            value.cancel(`请求被取消 id: ${key}`);
        }
        Logger.log(`补全[${cp.id}]：发送API请求`);
        // 获取当前axios的请求的取消对象
        const cancelTokenSource = this.openai.axios.CancelToken.source();
        this.reqs.set(cp.id, cancelTokenSource);
        const headers = createAuthenticatedHeaders();
        const repo = workspace?.name?.split(' ')[0] ?? '';
        return this.openai.createCompletion({
            headers: headers,
            model: settings.openai_model,
            /* eslint-disable-next-line @typescript-eslint/naming-convention */
            temperature: settings.temperature,
            stop: this.stopWords,
            completion_id: cp.id,
            // prompt: promptOptions.prefix + FIM_INDICATOR + promptOptions.suffix,
            prompt_options: cp.getPrompt(),
            language_id: cp.doc.language,
            beta_mode: this.betaMode,
            calculate_hide_score: scores,
            file_project_path: "",
            project_path: "",
            code_path: "",
            user_id: '',
            repo: repo,
            git_path: ''
        }, { cancelToken: cancelTokenSource.token });
    }
}