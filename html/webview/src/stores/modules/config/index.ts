import { callBackIde } from "@/utils/ide";
import { maskPhoneNumber } from "@/utils/common";
import { defineStore } from 'pinia';

/**
 * 从IDE获取的配置信息
 */
interface IdeConfig {
    chatUrl: string;
    ide: string;
    extVersion: string;
    ideVersion: string;
    hostIp?: string;
    model?: string;
}
/**
 * 用户信息接口
 */ 
export interface UserInfo {
    avatar: string;         // 用户头像
    avatar_color: string;   // 头像颜色
    name: string;           // 用户姓名
    username: string;       // 用户名
    display_name: string;   // 显示名称(默认是username，允许修改)
    description: string;    // 用户描述
    is_admin: boolean;      // 是否为管理员
    token: string;          // 令牌（access_token)
}

// 应用配置接口
interface AppConfig {
    chatUrl: string;        // 诸葛神码对话服务 URL
    model: string;          // 模型名称
}

//  客户端设置
interface ClientConfig {
    ide: string;            // IDE 名称
    extVersion: string;     // 诸葛神码插件版本号
    ideVersion: string;     // IDE版本号
    hostIp: string;         // 客户端所在主机的IP地址
}

// 配置状态接口
export interface ConfigState {
    userInfo: UserInfo;     // 用户信息
    appConfig: AppConfig;   // 应用配置
    clientConfig: ClientConfig; // 客户端配置
    spinning: boolean;      // 加载状态
}

// 定义 Pinia 存储
export const useConfigStore = defineStore('auth-store', {
    // 状态初始化
    state: (): ConfigState => ({
        userInfo: {} as UserInfo, // 初始化用户信息
        appConfig: {} as AppConfig, // 初始化应用配置
        clientConfig: {} as ClientConfig, // 初始化客户端配置
        spinning: true // 初始化加载状态
    }),

    actions: {
        // 获取配置
        getConfig() {
            // 从 IDE 回调获取配置
            callBackIde('ide.getConfig', {}, (data: IdeConfig) => {
                // 合并新配置到当前配置
                this.appConfig.chatUrl = data.chatUrl;
                this.appConfig.model = data.model ?? "";
                this.clientConfig.ide = data.ide;
                this.clientConfig.ideVersion = data.ideVersion;
                this.clientConfig.extVersion = data.extVersion;
                this.clientConfig.hostIp = data.hostIp ?? "";
                console.log("getConfig data", data, 
                    "app:", this.appConfig, "client:", this.clientConfig, "user:", this.userInfo);
            });
        },
        // 更新服务器地址配置
        updateConfig(config: Partial<AppConfig>) {
            if (config.chatUrl) {
                this.appConfig.chatUrl = config.chatUrl;
            }
            console.log("updateConfig", config)
        },
        // 获取主题颜色配置
        getThemeColor() {
            callBackIde('ide.getThemeColor', null, (data: any) => {
                this.changeTheme(data);
            });
        },
        // 更新主题颜色
        changeTheme(data: any) {
            // jetbrains light主题 返回的配色有问题，这里特殊处理
            if (data.currentThemeName && data.currentThemeName.toLowerCase() === 'light') {
                data = {
                    currentThemeName: 'light',
                    textColor: 'rgb(0, 0, 0)',
                    editorBgColor: 'rgb(255, 255, 255)',
                    buttonColor: 'rgb(0, 0, 0)',
                    buttonBgColor: 'rgb(242, 242, 242)',
                    inputColor: 'rgb(0, 0, 0)',
                    inputBgColor: 'rgb(242, 242, 242)',
                    dropdownColor: 'rgb(0, 0, 0)',
                    dropdownBgColor: 'rgb(242, 242, 242)',
                    scrollColor: 'rgb(163, 184, 204)',
                    scrollBgColor: 'rgb(242, 242, 242)',
                    borderColor: 'rgb(196, 196, 196)'
                };
            }
            document.documentElement.style.setProperty('--text-color', this.formatColor(data['textColor']));
            document.documentElement.style.setProperty('--bg-color', this.formatColor(data['editorBgColor']));
            document.documentElement.style.setProperty('--btn-color', this.formatColor(data['buttonColor']));
            document.documentElement.style.setProperty('--btn-bg-color', this.formatColor(data['buttonBgColor'], 'buttonBgColor'));
            document.documentElement.style.setProperty('--input-color', this.formatColor(data['inputColor']));
            document.documentElement.style.setProperty('--input-bg-color', this.formatColor(data['inputBgColor'], 'inputBgColor'));
            document.documentElement.style.setProperty('--dropdown-color', this.formatColor(data['dropdownColor']));
            document.documentElement.style.setProperty('--dropdown-bg-color', this.formatColor(data['dropdownBgColor']));
            document.documentElement.style.setProperty('--scroll-color', this.formatColor(data['scrollColor']));
            document.documentElement.style.setProperty('--scroll-bg-color', this.formatColor(data['scrollBgColor']));
            document.documentElement.style.setProperty('--border-color', this.formatColor(data['borderColor']));
        },
        // 提取颜色
        formatColor(colorStr: string, key?: string) {
            const rgbValues = colorStr ? colorStr.match(/\d+/g) || [] : [];
            // 将RGB值转换为整数
            const r = parseInt(rgbValues[0]);
            const g = parseInt(rgbValues[1]);
            const b = parseInt(rgbValues[2]);
            if (['buttonBgColor', 'inputBgColor', 'borderColor'].includes(key || '')) {
                if (r === 255 && g === 255 && b === 255) {
                    return `rgb(${242}, ${242}, ${242})`;
                } else if (r === 0 && g === 0 && b === 0) {
                    return `rgb(${48}, ${48}, ${48})`;
                }
            }
            // 组装成rgb格式
            const rgbStr = `rgb(${r}, ${g}, ${b})`;
            return rgbStr;
        },
        // 更新用户信息
        setUser(data: Partial<UserInfo>) {
            this.userInfo.username = data.username || '';
            this.userInfo.token = data.token || '';
            if (!this.userInfo.display_name) {
                this.userInfo.display_name = maskPhoneNumber(this.userInfo.username);
            }
            console.log("setUser: ", data, "=>", this.userInfo)
        },

        // 关闭加载状态
        closeSpinning() {
            this.spinning = false;
        }
    },
});