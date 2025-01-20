/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { getRandomId } from "../common/util";
import { CompletionPoint, calcKey } from "./completionPoint";

/**
 * 补全点缓存
 */
export class CompletionCache {
    private static points = [] as CompletionPoint[];                //补全点列表
    private static keys = new Map<string, CompletionPoint>();       //根据Key查找
    private static ids = new Map<string, CompletionPoint>();        //根据ID查找
    private static latest: CompletionPoint | undefined = undefined; //最新一个补全点
    private static latestId = 0;                                    //自增的ID编号
    /**
     * 下一个补全请求ID
     */
    private static nextId() {
        return `${this.latestId++}-${getRandomId(16)}`;
    }
    /**
     * 根据位置查找补全点
     */
    static lookup(fpath: string, line: number, column: number): CompletionPoint | undefined {
        let key = calcKey(fpath, line, column);
        return this.keys.get(key);
    }
    /**
     *  缓存补全点
     */
    static cache(cp: CompletionPoint): CompletionPoint {
        let copy = new CompletionPoint(this.nextId(), 
            cp.doc, cp.pos, cp.getPrompt(), cp.triggerMode, cp.createTime);
        this.points.push(copy);
        this.ids.set(copy.id, copy);
        this.keys.set(copy.getKey(), copy);
        this.latest = copy;
        return copy;
    }
    /**
     * 获取最新补全点
     */
    static getLatest(): CompletionPoint | undefined {
        return this.latest;
    }
    /**
     * 获取所有补全点
     */
    static all(): CompletionPoint[] {
        return this.points;
    }
    /**
     * 从0开始清除cnt个补全点，最后一个不清除
     */
    static erase(cnt: number) {
        if (cnt >= this.points.length) {
            throw new RangeError("最后一个补全点不能删除");
        }
        for (let n = 0; n < cnt; n++) {
            const cp = this.points[n];
            this.keys.delete(cp.getKey());
            this.ids.delete(cp.id);
        }
        this.points = this.points.slice(cnt);
    }
}
