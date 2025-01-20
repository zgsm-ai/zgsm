/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import axios from "axios";
import { authentication, AuthenticationProvider, AuthenticationProviderAuthenticationSessionsChangeEvent, AuthenticationSession, Disposable, env, Event, EventEmitter, ExtensionContext, ProgressLocation, Uri, UriHandler, window } from "vscode";
import { ACCESS_TOKEN_KEY, AUTH_NAME, AUTH_TYPE, SESSIONS_SECRET_KEY } from './constant';
import { Logger } from "./log-util";
import { getRandomId, maskPhoneNumber } from "./util";
import { ChatViewProvider } from "../chatView/chat-view-provider";
import { envSetting, envClient, updateApiKey } from "./env";

/**
 * 构建请求头部(无认证信息)
 */
function createHeaders(dict: Record<string, any> = {}): Record<string, any> {
    const headers = {
        "ide": envClient.ide,
        "ide-version": envClient.extVersion,
        "ide-real-version": envClient.ideVersion,
        "host-ip": envClient.hostIp,
        ...dict
    };
    return headers;
}

interface PromiseAdapter<T, U> {
    (
        value: T,
        resolve: (value: U | PromiseLike<U>) => void,
        reject: (reason: any) => void
    ): any;
}

const passthrough = (value: any, resolve: (value?: any) => void) => resolve(value);

/**
 * Return a promise that resolves with the next emitted event, or with some future
 * event as decided by an adapter.
 *
 * If specified, the adapter is a function that will be called with
 * `(event, resolve, reject)`. It will be called once per event until it resolves or
 * rejects.
 *
 * The default adapter is the passthrough function `(value, resolve) => resolve(value)`.
 *
 * @param event the event
 * @param adapter controls resolution of the returned promise
 * @returns a promise that resolves or rejects as specified by the adapter
 */
function promiseFromEvent<T, U>(event: Event<T>, adapter: PromiseAdapter<T, U> = passthrough): { promise: Promise<U>; cancel: EventEmitter<void>; } {
    let subscription: Disposable;
    const cancel = new EventEmitter<void>();
    const promise = new Promise<U>((resolve, reject) => {
        cancel.event(_ => reject('Cancelled'));
        subscription = event((value: T) => {
            try {
                Promise.resolve(adapter(value, resolve, reject))
                    .catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }).then(
        (result: U) => {
            subscription.dispose();
            return result;
        },
        error => {
            subscription.dispose();
            throw error;
        }
    );
    return {
        promise,
        cancel
    };
}

class UriEventHandler extends EventEmitter<Uri> implements UriHandler {
    public handleUri(uri: Uri) {
        this.fire(uri);
    }
}

/**
 * 使用OAUTH协议和后台进行用户认证
 */
export default class Auth0AuthenticationProvider implements AuthenticationProvider, Disposable {
    private static instance: Auth0AuthenticationProvider;
    private _sessionChangeEmitter = new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
    private _disposable: Disposable;
    private _pendingStates: string[] = [];
    private _codeExchangePromises = new Map<string, { promise: Promise<string>; cancel: EventEmitter<void>; }>();
    private _uriHandler = new UriEventHandler();

    constructor(private readonly context: ExtensionContext) {
        this._disposable = Disposable.from(
            authentication.registerAuthenticationProvider(AUTH_TYPE, AUTH_NAME, this, { supportsMultipleAccounts: false }),
            window.registerUriHandler(this._uriHandler)
        );
    }

    // 单例，保证全局唯一的实例，其他地方使用调用该函数获取实例
    public static getInstance(context?: ExtensionContext): Auth0AuthenticationProvider {
        if (!Auth0AuthenticationProvider.instance) {
            if (!context) {
                Logger.log("插件异常,Auth0AuthenticationProvider实例异常丢失");
                throw new Error('插件异常,Auth0AuthenticationProvider实例异常丢失');
            }
            Auth0AuthenticationProvider.instance = new Auth0AuthenticationProvider(context);
        }
        return Auth0AuthenticationProvider.instance;
    }

    get onDidChangeSessions() {
        return this._sessionChangeEmitter.event;
    }

    /**
     * Get the existing sessions
     * @param scopes 
     * @returns 
     */
    public async getSessions(): Promise<readonly AuthenticationSession[]> {
        const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

        if (allSessions) {
            return JSON.parse(allSessions) as AuthenticationSession[];
        }

        return [];
    }

    /**
     * Create a new auth session
     * @param scopes 
     * @returns 
     */
    public async createSession(): Promise<AuthenticationSession> {
        try {
            const token = await this.login();
            if (!token) {
                throw new Error(`Auth0 login failure`);
            }
            const session: AuthenticationSession = {
                id: getRandomId(12),
                accessToken: token,
                account: {
                    label: '',
                    id: ''
                },
                scopes: []
            };

            await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify([session]));
            this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
            return session;
        } catch (e) {
            window.showErrorMessage(`Sign in failed: ${e}`);
            throw e;
        }
    }

    /**
     * Remove an existing session
     * @param sessionId 
     */
    public async removeSession(sessionId: string): Promise<void> {
        const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
        if (!allSessions) {
            return;
        }
        const sessions = JSON.parse(allSessions) as AuthenticationSession[];
        const sessionIdx = sessions.findIndex(s => s.id === sessionId);
        const session = sessions[sessionIdx];
        sessions.splice(sessionIdx, 1);
        await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify(sessions));
        if (session) {
            this._sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] });
        }
    }

    /**
     * Dispose the registered services
     */
    public async dispose() {
        this._disposable.dispose();
    }

	/**
	 *  保存access_token相关信息
	 */
    private async storeToken(token: any) {
        if (token.access_token !== undefined) {
            updateApiKey(token.access_token);
        } else {
            updateApiKey("");
        }
        await this.context.secrets.store(ACCESS_TOKEN_KEY, JSON.stringify(token));
    }
    
    /**
     * Log in to Auth0
     */
    public async login() {
        return await window.withProgress<string>({
            location: ProgressLocation.Notification,
            title: "请登录后使用诸葛神码",
            cancellable: true
        }, async (_, token) => {
            const stateId = getRandomId(12);

            this._pendingStates.push(stateId);
            const scopes: string[] = [];
            const scopeString = scopes.join(' ');

            if (!scopes.includes('openid')) {
                scopes.push('openid');
            }
            if (!scopes.includes('profile')) {
                scopes.push('profile');
            }
            if (!scopes.includes('email')) {
                scopes.push('email');
            }

            const searchParams = new URLSearchParams([
                ['response_type', "code"],
                ['client_id', envSetting.clientId],
                ['redirect_uri', envSetting.redirectUri],
                ['state', stateId],
                ['scope', scopes.join(' ')]
            ]);
            const uri = Uri.parse(`${envSetting.loginUrl}?${searchParams.toString()}`);
            await env.openExternal(uri);

            let codeExchangePromise = this._codeExchangePromises.get(scopeString);
            if (!codeExchangePromise) {
                codeExchangePromise = promiseFromEvent(this._uriHandler.event, this.handleUri(scopes));
                this._codeExchangePromises.set(scopeString, codeExchangePromise);
            }

            try {
                return await Promise.race([
                    codeExchangePromise.promise,
                    new Promise<string>((_, reject) => setTimeout(() => reject('Cancelled'), 300000)),
                    promiseFromEvent<any, any>(token.onCancellationRequested, (_, __, reject) => { reject('User Cancelled'); }).promise
                ]);
            } finally {
                this._pendingStates = this._pendingStates.filter(n => n !== stateId);
                codeExchangePromise?.cancel.fire();
                this._codeExchangePromises.delete(scopeString);
            }
        });
    }

    /**
     * 注销登录
     */
    public async logout() {
        try {
            const session = await this.context.secrets.get(ACCESS_TOKEN_KEY);
            if (!session) {
                window.showInformationMessage('请先登录');
                return;
            }
            const tokenData = JSON.parse(session);
            if (!tokenData || !tokenData.refresh_token) {
                window.showInformationMessage('请先登录');
                return;
            }
            const res = await axios.post(envSetting.logoutUrl,
                {
                    refresh_token: tokenData.refresh_token,
                    'client_id': envSetting.clientId,
                    'client_secret': envSetting.clientSecret,
                },
                {
                    headers: createHeaders({
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }),
                }
            );
            Logger.log('logout', res.headers, res.data);
            await this.context.secrets.store(ACCESS_TOKEN_KEY, '{}');
        } catch (err) {
            Logger.log('注销失败：', err);
        }
    }

    /**
     * 获取access_token
     */
    public async fetchToken(params: any) {
        try {
            const res = await axios.post(envSetting.tokenUrl,
                params,
                {
                    headers: createHeaders({
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }),
                }
            );
            Logger.log('fetchToken ok:', params, res);
            return {
                'status': 200,
                'data': res.data
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                Logger.error('fetchToken: Axios error:', err.message);
                if (err.response) {
                    // 请求已发出，服务器响应了状态码
                    Logger.error('Response headers:', err.response.headers);
                    switch (err.response?.status) {
                    case 400:
                        Logger.error('Bad Request(400):', err.response.data);
                        break;
                    case 401:
                        Logger.error('Unauthorized(401):', err.response.data);
                        break;
                    case 404:
                        Logger.error('Not Found(404):', err.response.data);
                        break;
                    case 500:
                        Logger.error('Server Error(500):', err.response.data);
                        break;
                    default:
                        Logger.error('Unexpected error, status:', err.response.status, err.response.data);
                        break;
                    }
                    return {
                        'status': err.response.status
                    }
                } else if (err.request) {
                    // 请求已发出，但没有收到响应
                    Logger.error('Request data:', err.request);
                    return {
                        'status': 504
                    }
                } else {
                    // 其他错误
                    Logger.error('Error message:', err.message);
                    return {
                        'status': 408
                    }
                }
            } else {
                // 处理其他类型的错误
                Logger.error('fetchToken: Unexpected error:', err);
                return {
                    'status': 408
                }
            }
        }
    }

    /**
     * Handle the redirect to VS Code (after sign in from Auth0)
     * @param scopes 
     * @returns 
     */
    private handleUri: (scopes: readonly string[]) => PromiseAdapter<Uri, string> =
        (scopes) => async (uri, resolve, reject) => {
            const query = new URLSearchParams(uri.query);
            const state = query.get('state');
            if (!state) {
                reject(new Error('No state'));
                return;
            }

            // Check if it is a valid auth request started by the extension
            if (!this._pendingStates.some(n => n === state)) {
                reject(new Error('State not found'));
                return;
            } else {
                const code = query.get('code');
                if (!code) {
                    reject(new Error('No token'));
                    return;
                } else {
                    const params = {
                        'client_id': envSetting.clientId,
                        'client_secret': envSetting.clientSecret,
                        'code': code,
                        'grant_type': 'authorization_code',
                        'redirect_uri': envSetting.redirectUri
                    };
                    const res = await this.fetchToken(params);
                    if (res.status == 200 && res.data && res.data.access_token) {
                        this.storeToken(res.data);
                        resolve(res.data.access_token);
                        this.createRefreshTokenListener(res.data);
                    } else {
                        this.storeToken({});
                        resolve('');
                        window.showErrorMessage('登录出错，请重新登录！');
                    }
                }
            }
        };

    // 每次获取新 access_token 后，根据 expires_in 设置过期时间 5min 前，添加定时器刷新 token
    private async createRefreshTokenListener(tokenData: any) {
        const expires_time = tokenData.expires_in * 1000 - 5 * 60 * 1000;
        setTimeout(async () => {
            this.refreshToken(tokenData);
        }, expires_time);
    }

    /**
     * 更新secrets中保存的access_token数据，成功返回刷新后的access_token，失败返回null
     */
    private async refreshToken(tokenData: any) {
        const params = {
            'client_id': envSetting.clientId,
            'client_secret': envSetting.clientSecret,
            'grant_type': 'refresh_token',
            'refresh_token': tokenData.refresh_token,
        };
        const res = await this.fetchToken(params);
        if (res.status == 400 || res.status == 401) {
            this.storeToken({});
            ChatViewProvider.getInstance().sendMessage({
                action: 'ide.logout'
            });
            window.showErrorMessage('登录已失效，请重新登录！');
            return null;
        } else if (res.status == 200) {
            const data = res.data;
            const access_token = data.access_token;
            if (access_token) {
                const newAccessToken = Object.assign(tokenData, data);
                this.storeToken(tokenData);
                this.createRefreshTokenListener(newAccessToken);
                return access_token;
            }
        }
        // 登录临时性失败，30秒后重试一遍
        setTimeout(async () => {
            this.refreshToken(tokenData);
        }, 30000);
        return null;
    }

    /**
     * 检查access_token是否依然有效
     * 如果已经失效，则发起请求，利用refresh_token更新access_token
     */
    public async checkToken() {
        const session = await this.context.secrets.get(ACCESS_TOKEN_KEY);
        if (session) {
            const tokenData = JSON.parse(session);
            if (tokenData && tokenData.refresh_token) {
                return this.refreshToken(tokenData);
            }
        }
        return null;
    }

    /**
     * 获取已保存在安全存储上的access_token
     */
    public async getAccessToken() {
        const session = await this.context.secrets.get(ACCESS_TOKEN_KEY);
        if (session) {
            const tokenData = JSON.parse(session);
            if (tokenData && tokenData.access_token) {
                return tokenData.access_token;
            }
        }
        return null;
    }

    /**
     * 根据token，获取保存在token中的用户名
     */
    public static getUsername(token: string) {
        const userInfoBase64 = token.split(".")[1];
        const userInfoStr = Buffer.from(userInfoBase64, 'base64').toString('utf-8');
        const userInfo = JSON.parse(userInfoStr || '{}');
        return userInfo.preferred_username || '';
    }
}