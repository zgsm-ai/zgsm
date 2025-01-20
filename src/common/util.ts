/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as fs from 'fs';
import os from 'os';

import { createHash } from "crypto";
import { Logger } from "./log-util";

/**
 * 获取本地IP信息
 */
export function getLocalIP() {
    const interfaces = os.networkInterfaces();
    let ipAddress = '';

    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            // 过滤掉内部环回地址和未分配的地址
            if (iface.family === 'IPv4' && !iface.internal) {
                ipAddress = iface.address;
                break;
            }
        }
        if (ipAddress) break; // 找到第一个有效的 IP 地址后退出
    }

    return ipAddress || 'No IP found';
}

/**
 * 日期格式
 */
export enum DateFormat {
    LITE = 1,       // 示例：2023-07-04 15:30:15
    DETAIL = 2,     // 示例：2023-07-04 15:30:15.274
    ISO = 3,        // 示例: 2025-01-14T08:00:00.000Z
}
/**
 * 格式化时间信息，支持三种格式(见DateFormat)
 */
export function formatTime(dt: Date, format: DateFormat = DateFormat.ISO): string {
    if (!dt) {
        return "";
    }
    if (typeof dt === 'string') {
        dt = new Date(dt);
    }
    if (format == DateFormat.ISO) {
        const date = new Date(dt); // 创建 Date 对象
        return date.toISOString(); // 转换为 ISO 8601 格式
    }
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hour = String(dt.getHours()).padStart(2, '0');
    const minute = String(dt.getMinutes()).padStart(2, '0');
    const second = String(dt.getSeconds()).padStart(2, '0');
    const millisecond = String(dt.getMilliseconds()).padStart(3, '0');
    if (format === DateFormat.LITE) {
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    } else {
        return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
    }
}

/**
 * 格式化时间差，如: 1d9h3m3s 
 * param differenceInMilliseconds: 时间差（毫秒）
 */
export function formatTimeDifference(differenceInMilliseconds: number): string {
    // 将毫秒转换为秒
    const totalSeconds = Math.floor(differenceInMilliseconds / 1000);
    
    // 计算天、小时、分钟和秒
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // 构建可读格式的字符串
    let result = '';
    if (days > 0) {
        result += `${days}d`;
    }
    if (hours > 0) {
        result += `${hours}h`;
    }
    if (minutes > 0) {
        result += `${minutes}m`;
    }
    if (seconds > 0) {
        result += `${seconds}s`;
    }

    // 如果没有时间差，返回“0s”
    return result.trim() || '0s';
}

/**
 * 生成一个UUID
 */
export function getUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 返回一个指定长度的随机字符串
 */
export function getRandomId(len = 12) {
    const pattern = 'x'.repeat(len);
    return pattern.replace(/[x]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 计算字符串content的HASH
 */
export function computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * 拷贝文件内容：把文件source中的内容拷贝到文件target中
 */
export function copyFile(source: string, target: string) {
    try {
        const fileData = fs.readFileSync(source);
        fs.writeFileSync(target, fileData);
    } catch (error) {
        Logger.log('File copied fail!', source, target);
    }
}

/** 
 * 防抖函数
 */
export function debounce(fn: Function, delay = 500) { // eslint-disable-line @typescript-eslint/ban-types
    let timer: string | number | NodeJS.Timeout | null | undefined;
    return function (this: any, ...args: any[]) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}

/**
 * 节流函数
 */
export function throttle(fn: Function, delay = 300) { // eslint-disable-line @typescript-eslint/ban-types
    let lastCall = 0;
    return function (this: any, ...args: any[]) {
        const now = new Date().getTime();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        }
    };
}

/**
 * 对电话号码进行遮掩处理
 */
export function maskPhoneNumber(phone: string): string {
    // 使用正则表达式替换中间四位数字为星号
    return phone.replace(/(\+86)(\d{3})\d{4}(\d{4})/, '$2****$3');
}