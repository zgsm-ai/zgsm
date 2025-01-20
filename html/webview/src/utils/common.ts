// 构建一个固定结构的随机字符串作为对话唯一ID
export function getUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 返回一个随机字符串
export function getRandomId() {
    return 'xxxxxxxx'.replace(/[x]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
//  对电话号码进行遮掩，用于显示
export function maskPhoneNumber(phone: string): string {
    // 使用正则表达式替换中间四位数字为星号
    return phone.replace(/(\+86)(\d{3})\d{4}(\d{4})/, '$2****$3');
}
// 防抖函数
export function debounce(fn: Function, delay = 300) {
    let timer: any = null;
    return function (...args: any[]) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}

// 节流函数
export function throttle(fn: Function, delay = 300) {
    let timeout: any = null;
    let lastArgs: any = null;

    return function (...args: any[]) {
        if (timeout === null) {
            fn(...args);
            timeout = setTimeout(() => {
                timeout = null;
                if (lastArgs) {
                    fn(...lastArgs);
                    lastArgs = null;
                }
            }, delay);
        } else {
            lastArgs = args;
        }
    };
}
