/*
 * @Author: czc
 * @Date: 2024-05-24 16:21:30
 * @LastEditors: czc
 * @LastEditTime: 2024-08-13 10:45:26
 * @Descripttion: 与IDE通信
 */

// 回调函数
export const callbacks: any = {};
export function callBackIde(action: string, params: object | null, cb?: Function) {
    console.log("[ZGSM] callBackIde start: " + action, params);
    const data: any = {
        action,
        params: params || {}
    };
    if (cb) {
        // 时间戳加上5位随机数
        const cbid = Date.now() + '' + Math.round(Math.random() * 100000);
        callbacks[cbid] = cb;
        data.cbid = cbid;
    }
    (window as any).postMessageToIde(data);
}

/**
 * 注册接收 IDE 主动推送的 action 消息,统一用 ideMessageHandler 接收并处理
 * 需要在业务代码侧调用
 * @param {function} ideMessageHandler 
 */
export function registerIdeMessageListener(ideMessageHandler: Function) {
    window.addEventListener('message', event => {
        console.log("[ZGSM] receiveMessageFromIde: ", event);
        const message = event.data;
        if (message) {
            switch (message.action) {
            //  使用 postMessageToIde 主动触发 IDE 对应的 action ，IDE 处理完成后的 结果响应事件
            case 'ideCallback':
                (callbacks[message.cbid] || function () { })(message.data);
                delete callbacks[message.cbid];
                break;
            default:
                //  (除了 ideCallback 事件外) 接收 IDE 主动推送的 action 消息 
                //  统一用 receiveMessageFromIde  接收并处理
                ideMessageHandler(message);
                break;
            }
        }
    });
}

// 初始化配置
export function initConfig(getConfig: Function) {    
    getConfig();
}

// vscodeApi不为null，表示在vscode，否则在jetbrain
(window as any).vscodeApi = null;
if ((window as any).acquireVsCodeApi) {
    (window as any).vscodeApi = (window as any).acquireVsCodeApi();
}
// jetbrain的兼容性处理
if (!(window as any).vscodeApi) {
    (window as any).HTML_BASE_URL = '.';
}

// 发送消息给IDE
(window as any).postMessageToIde = (data: any) => {
    // 固定格式 {"action": "", "params": {}}
    // 该函数用来给ide发送消息，不同ide注入不同的方法,jetbrains会修改此函数
    (window as any).vscodeApi.postMessage(data);
};