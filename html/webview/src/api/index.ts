import type { ConfigState } from '@/stores';
import { post } from '@/utils/request';

/**
 * 评价内容
 */
interface EvaluateArgs {
    agent_name: string;
    conversation_id: string;
    rating: 'like' | 'dislike';
    message_id?: string;
}

/**
 * 向后台反馈对某次对话内容的评价
 */
export function feedbackChatEvaluate<T>(config: ConfigState, args: EvaluateArgs) {
    return post<T>({
        url: `${config.appConfig.chatUrl}/api/feedbacks/evaluate`,
        headers: createHeaders(config),
        data: args,
    });
}

/**
 * 用户使用了LLM给出的代码，上报给服务器记录下来，有几种使用方式:copy,diff,ctrlc,accept
 */
export async function useCode<T>(config: ConfigState, data: any) {
    return post<T>({
        url: `${config.appConfig.chatUrl}/api/feedbacks/use_code`,
        headers: createHeaders(config),
        data,
    });
}

/**
 * 统一构建API请求的头部
 */
export function createHeaders(config: ConfigState, dict: Record<string, any> = {}): Record<string, any> {
    const headers = {
        "api-key": config.userInfo.token,
        "ide": config.clientConfig.ide,
        "ide-version": config.clientConfig.extVersion,
        "ide-real-version": config.clientConfig.ideVersion,
        "host-ip": config.clientConfig.hostIp,
        ...dict
    };
    return headers;
}
