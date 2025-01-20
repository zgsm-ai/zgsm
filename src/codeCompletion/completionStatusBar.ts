/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode";
import { StatusBarItem } from "vscode";
import { configCompletion } from "../common/constant";
import { Logger } from "../common/log-util";
import { statusBarCommand, turnOffCompletion, turnOnCompletion } from "./completionCommands";

/**
 * vscode右下角的状态条
 */
export class CompletionStatusBar {
    // 单例，保证全局唯一的实例
    private static instance: StatusBarItem;

    // 私有构造函数，防止外部实例化
    /* eslint-disable @typescript-eslint/no-empty-function */
    private constructor() { }

    /**
     * 创建补全功能的状态条，需要再插件注册函数中调用
     */
    public static create(context?: vscode.ExtensionContext): StatusBarItem {
        if (this.instance) {
            return this.instance;
        }
        const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBar.command = statusBarCommand.command;
        if (!context) {
            Logger.log("插件异常,completionStatusBar实例异常丢失");
            throw new Error('插件异常,completionStatusBar实例异常丢失');
        }
        const statusUpdateCallback = (callback: any, showIcon: boolean) => async () => {
            await callback();
            if (showIcon) {
                statusBar.show();
            } else {
                statusBar.hide();
            }
        };
        // 定义命令
        context.subscriptions.push(
            vscode.commands.registerCommand(statusBar.command, statusBarCommand.callback),
            vscode.commands.registerCommand(turnOnCompletion.command, statusUpdateCallback(turnOnCompletion.callback, true)),
            vscode.commands.registerCommand(turnOffCompletion.command, statusUpdateCallback(turnOffCompletion.callback, false)),
        );

        this.instance = statusBar;
    
        return this.instance;
    }

    /**
     * 根据配置初始化状态条显示的初始状态
     */
    public static initByConfig(suggestion_switch?: boolean) {
        if (suggestion_switch === undefined) {
            suggestion_switch = vscode.workspace.getConfiguration(configCompletion).get("enabled");
        }
        this.instance.text = "$(check) 诸葛神码";
        if (suggestion_switch) {
            this.instance.tooltip = `诸葛神码-代码补全 - 已启用`;
        } else {
            this.instance.tooltip = `诸葛神码-代码补全 - 已禁用`;
        }
        this.instance.show();
    }

    /**
     * 正在等待请求结果
     */
    public static loading() {
        this.instance.tooltip = "诸葛神码-代码补全 - 等待请求结果";
        this.instance.text = "$(loading~spin) 诸葛神码-进行中";
    }

    /**
     * 补全完成
     */
    public static complete() {
        this.instance.tooltip = "诸葛神码-代码补全 - 补全完成";
        this.instance.text = "$(check) 诸葛神码";
    }

    /**
     * 补全失败
     */
    public static fail() {
        this.instance.tooltip = "诸葛神码-代码补全 - 补全失败";
        this.instance.text = "$(alert) 诸葛神码-异常";
    }

    /**
     * 补全成功，但没有建议
     */
    public static noSuggest() {
        this.instance.text = "$(check) 诸葛神码-无建议";
    }
}
