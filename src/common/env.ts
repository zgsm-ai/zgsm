/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode";
import { configShenmaName } from "./constant";
import { Logger } from "./log-util";
import { getLocalIP } from "./util";

const baseEnvSetting = {
    baseUrl: 'https://zgsm.sangfor.com',    //诸葛神码后端基地址
    zgsmSite: 'https://zgsm.ai',            //诸葛神码的门户站点
    realmName: 'gw',                                    //认证: keycloak租户名
    clientId: 'vscode',                                 //认证: 客户端ID
    clientSecret: 'jFWyVy9wUKKSkX55TDBt2SuQWl7fDM1l',   //认证: 客户端密钥

    loginUrl: '{baseUrl}/realms/{realmName}/protocol/openid-connect/auth',
    logoutUrl: '{baseUrl}/realms/{realmName}/protocol/openid-connect/logout',
    tokenUrl: '{baseUrl}/realms/{realmName}/protocol/openid-connect/token',
    redirectUri: '{baseUrl}/login/ok',      //认证: 登录成功回调

    chatUrl: '{baseUrl}',                   //对话服务地址
    completionUrl: '{baseUrl}/v2',          //补全服务地址
    downloadUrl: '{baseUrl}/downloads',     //下载地址

    updateExtensionsTimeInterval: 1000 * 60 * 60 * 12,
};

const baseEnvClient = {
    ide: 'vscode',      //IDE名字
    ideVersion: '',     //IDE版本
    extVersion: '',     //扩展的版本
    hostIp: '',         //主机IP
    apiKey: '',         //API-KEY
}

// 用于定义生产环境的配置
let envSetting = baseEnvSetting;
// 定义客户端的环境变量，默认是自动获取的，允许在测试等场景下修改
let envClient = baseEnvClient;

/**
 * 解析模板串template中的变量占位符{baseUrl},{realmName}
 */
function replaceVars(template: string): string {
    let result = template.replace(/{baseUrl}/g, envSetting.baseUrl);
    result = result.replace(/{realmName}/g, envSetting.realmName);
    return result;
}
/**
 * 解析配置中的变量占位符{baseUrl}
 */
function resolveEnvs() {
    envSetting.chatUrl = replaceVars(envSetting.chatUrl)
    envSetting.completionUrl = replaceVars(envSetting.completionUrl)
    envSetting.downloadUrl = replaceVars(envSetting.downloadUrl)
    envSetting.loginUrl = replaceVars(envSetting.loginUrl);
    envSetting.logoutUrl = replaceVars(envSetting.logoutUrl);
    envSetting.tokenUrl = replaceVars(envSetting.tokenUrl);
    envSetting.redirectUri = replaceVars(envSetting.redirectUri)
}
/**
 * 自动获取客户端的标志信息
 */
function fetchEnvClient() {
    const extension = vscode.extensions.getExtension('zgsm-ai.zgsm');
    if (!envClient.extVersion) {
        envClient.extVersion = extension?.packageJSON.version || '';
    }
    if (!envClient.ideVersion) {
        envClient.ideVersion = vscode.version || '';
    }
    if (!envClient.hostIp) {
        envClient.hostIp = getLocalIP();
    }
    Logger.log("envClient: ", envClient);
}
/**
 * 更新本地配置，利用本地配置中的同名变量替换内置变量
 * 使用本地环境变量（env-local.ts）覆盖
 */
function updateEnvByLocal() {
    try {
        // 本地开发可选用 env-local.ts，参考 env-dev.ts 自行更改
        const localEnv = require('./env-local'); // 配置文件存在则使用 env-local
        envSetting = { ...envSetting, ...localEnv.envSetting };
        envClient = {...envClient, ...localEnv.envClient };
    } catch { console.log(); }
}

/**
 * 初始化系统环境变量
 */
export function initEnv() {
    //配置优先级：用户设置(user)>本地设置(local)>保底设置(base)
    // 1. 加载保底设置
    envSetting = baseEnvSetting;
    // 2. 加载本地设置
    updateEnvByLocal();
    // 3. 如果local-env.ts没有设置envClient相关变量，自动获取
    fetchEnvClient();
    // 4. 加载用户设置
    updateEnv();
}
/**
 * 更新用户设置：更新baseUrl, completionUrl并解析变量{baseUrl}
 * 根据用户配置内容更新baseUrl，如果用户没有配置过，则采用默认数据
 */
export function updateEnv() {
    const config = vscode.workspace.getConfiguration(configShenmaName);
    let baseUrl: string | undefined = config.get("baseUrl");
    if (!baseUrl) {
        baseUrl = config.get("chatServer");
    }
    if (baseUrl) {
        Logger.log(`用户配置更新 baseUrl: ${baseUrl}`);
        envSetting.baseUrl = baseUrl;
    }
    const loginUrl: string | undefined = config.get("loginUrl");
    if (loginUrl) {
        Logger.log(`用户设置更新 loginUrl: ${loginUrl}`);
        envSetting.loginUrl = loginUrl;
    }
    const logoutUrl: string | undefined = config.get("logoutUrl");
    if (logoutUrl) {
        Logger.log(`用户设置更新 logoutUrl: ${logoutUrl}`);
        envSetting.logoutUrl = logoutUrl;
    }
    const tokenUrl: string | undefined = config.get("tokenUrl");
    if (tokenUrl) {
        Logger.log(`用户设置更新 tokenUrl: ${tokenUrl}`);
        envSetting.tokenUrl = tokenUrl;
    }
    resolveEnvs();
    Logger.log("envSetting: ", envSetting);
}
/**
 * 更新各软件的api-key，采用OAUTH2的access-token作为认证手段
 */
export function updateApiKey(apikey: string) {
    envClient.apiKey = apikey;
}

export {
    envSetting,
    envClient,
};

