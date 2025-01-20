/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import axios from "axios";
import { envSetting, envClient } from "./env";
import { Logger } from "./log-util";

/**
 * 构建RESTAPI请求头，带上客户端的标志信息以及认证API-KEY
 */
export function createAuthenticatedHeaders(dict: Record<string, any> = {}): Record<string, any> {
    const headers = {
        "ide": envClient.ide,
        "ide-version": envClient.extVersion,
        "ide-real-version": envClient.ideVersion,
        "host-ip": envClient.hostIp,
        "api-key": envClient.apiKey,
        ...dict
    };
    return headers;
}

/**
 * 查询语言后缀列表
 */
export async function getLanguageExtensions() {
    const url = `${envSetting.baseUrl}/api/configuration?belong_type=language&attribute_key=language_map`;
    Logger.log('request start getLanguageExtensions()', url);
    return axios.get(url, {
        headers: createAuthenticatedHeaders({
            'Content-Type': 'application/json'
        })
    })
    .then((res) => {
        if (res.status === 200 && Array.isArray(res.data?.data)) {
            Logger.log('request success getLanguageExtensions()', res.data);
            return res.data;
        }
        Logger.error(`request error: getLanguageExtensions() status code:${res.status} data.code:${res.data?.code}`);
        return undefined;
    })
    .catch((err) => {
        Logger.error('getLanguageExtensions request error:', err);
        return undefined;
    });
}

/**
 * 查询扩展插件是否有新版本
 */
export async function getExtensionsLatestVersion() {
    Logger.log('request start getExtensionsLatestVersion()');
    const url = `${envSetting.baseUrl}/vscode/ex-server-api/zgsm-ai/zgsm/latest`;

    return axios.get(url, {
        headers: createAuthenticatedHeaders({
            'Content-Type': 'application/json'
        })
    })
    .then((res) => {
        if (res.status === 200 && res.data?.version) {
            Logger.log('request success getExtensionsLatestVersion()', res.data.version);
            return res.data;
        }
        Logger.error(`request error: getExtensionsLatestVersion() status code:${res.status} data.code:${res.data?.version}`);
        return undefined;
    })
    .catch((err) => {
        Logger.error('getExtensionsLatestVersion request error:' + err);
        return undefined;
    });
}
