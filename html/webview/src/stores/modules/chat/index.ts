import { getRandomId, getUuid } from '@/utils/common';
import { callBackIde } from '@/utils/ide';
import { mdi } from '@/utils/markdown';
import { scrollToBottom } from "@/utils/scroll";
import { defineStore } from 'pinia';
import { nextTick } from 'vue';
import { useConfigStore } from '../config/index';
// import { json } from 'stream/consumers';

const successSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns: xlink = "http://www.w3.org/1999/xlink" fill = "none" version = "1.1" width = "16" height = "16.000001907348633" viewBox = "0 0 16 16.000001907348633" > <defs><clipPath id="master_svg0_59_60993" > <rect x="0" y = "0" width = "16" height = "16.000001907348633" rx = "0" /> </clipPath><clipPath id="master_svg1_59_60993/43_01565"><rect x="2" y="2" width="12.000001907348633" height="12.000001907348633" rx="0"/></clipPath></defs><g clip-path="url(#master_svg0_59_60993)"><g clip-path="url(#master_svg1_59_60993 / 43_01565)"><g><g><g><path d="M8, 2C4.68629, 2, 2, 4.6863, 2, 8C2, 11.3137, 4.68629, 14, 8, 14C11.31371, 14, 14, 11.3137, 14, 8C14, 4.6863, 11.31371, 2, 8, 2ZM6.55974, 10.26654L5.00197, 8.68005C4.668620000000001, 8.34056, 4.6711100000000005, 7.79588, 5.0075400000000005, 7.45945C5.34307, 7.12391, 5.88708, 7.12391, 6.22262, 7.45945L7.22641, 8.463239999999999L10.04876, 5.640890000000001C10.40271, 5.28695, 10.97656, 5.28695, 11.3305, 5.640890000000001C11.68448, 5.99489, 11.68447, 6.56877, 11.33052, 6.92274L7.9804, 10.27301C7.58989, 10.66354, 6.95672, 10.66356, 6.56619, 10.27304C6.56403, 10.27089, 6.56188, 10.26872, 6.55974, 10.26654Z" fill-rule="evenodd" fill="#50B371" fill-opacity="1"/></g></g></g></g></g></svg>`;
const loadingSvg = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="none" version="1.1" width="16" height="16.000001907348633" viewBox="0 0 16 16.000001907348633"><defs><clipPath id="master_svg0_59_61002"><rect x="0" y="0" width="16" height="16.000001907348633" rx="0"/></clipPath></defs><g clip-path="url(#master_svg0_59_61002)"><g><g><g><path d="M8.00002,14Q8.147310000000001,14,8.29443,13.9928Q8.44154,13.9855,8.58813,13.9711Q8.73471,13.9567,8.880410000000001,13.9351Q9.0261,13.9134,9.17057,13.8847Q9.31503,13.856,9.45791,13.8202Q9.60078,13.7844,9.74173,13.7416Q9.88268,13.6989,10.02137,13.6493Q10.16005,13.5996,10.29613,13.5433Q10.43221,13.4869,10.56536,13.4239Q10.69851,13.361,10.82841,13.2915Q10.95831,13.2221,11.08465,13.1464Q11.21098,13.0706,11.33345,12.9888Q11.45592,12.907,11.57423,12.8192Q11.69254,12.7315,11.80639,12.6381Q11.92025,12.5446,12.0294,12.4457Q12.1385,12.3468,12.2427,12.2426Q12.3468,12.1385,12.4457,12.0294Q12.5447,11.92022,12.6381,11.80636Q12.7315,11.6925,12.8193,11.57419Q12.907,11.45589,12.9889,11.33342Q13.0707,11.21095,13.1464,11.08462Q13.2221,10.95828,13.2916,10.82838Q13.361,10.69848,13.424,10.56533Q13.4869,10.43218,13.5433,10.2961Q13.5997,10.16002,13.6493,10.02134Q13.6989,9.88266,13.7417,9.741710000000001Q13.7844,9.600760000000001,13.8202,9.45788Q13.856,9.315000000000001,13.8848,9.170539999999999Q13.9135,9.02608,13.9351,8.880379999999999Q13.9567,8.73469,13.9711,8.5881Q13.9856,8.44152,13.9928,8.29441Q14,8.14729,14,8Q14,7.85271,13.9928,7.70559Q13.9856,7.55848,13.9711,7.4119Q13.9567,7.26531,13.9351,7.11962Q13.9135,6.97392,13.8848,6.82946Q13.856,6.685,13.8202,6.54212Q13.7844,6.39924,13.7417,6.25829Q13.6989,6.11734,13.6493,5.97866Q13.5997,5.839980000000001,13.5433,5.7039Q13.4869,5.56782,13.424,5.434670000000001Q13.361,5.30152,13.2916,5.17162Q13.2221,5.04172,13.1464,4.91538Q13.0707,4.78905,12.9889,4.66658Q12.907,4.54411,12.8193,4.425800000000001Q12.7315,4.3075,12.6381,4.19364Q12.5447,4.0797799999999995,12.4457,3.97065Q12.3468,3.86151,12.2427,3.7573600000000003Q12.1385,3.65321,12.0294,3.55429Q11.92025,3.45538,11.80639,3.3619399999999997Q11.69253,3.2685,11.57423,3.1807499999999997Q11.45592,3.09301,11.33345,3.01118Q11.21098,2.929351,11.08465,2.853628Q10.95831,2.777905,10.82841,2.708472Q10.69851,2.63904,10.56536,2.576064Q10.43221,2.513089,10.29613,2.456723Q10.16005,2.400357,10.02136,2.350736Q9.88268,2.301114,9.74173,2.258358Q9.60078,2.215601,9.45791,2.179812Q9.31503,2.144023,9.17057,2.115288Q9.0261,2.0865531,8.880410000000001,2.0649409Q8.73471,2.0433288,8.58813,2.0288916Q8.44154,2.0144545,8.29443,2.00722726Q8.147310000000001,2,8.00002,2Q7.85273,2,7.70561,2.00722726Q7.5585,2.0144545,7.41192,2.0288916Q7.26533,2.0433288,7.11963,2.0649409Q6.97394,2.0865531,6.82947,2.115288Q6.68501,2.144023,6.54213,2.179812Q6.39926,2.215601,6.25831,2.258358Q6.11736,2.301114,5.97867,2.350736Q5.83999,2.400357,5.7039100000000005,2.456723Q5.56783,2.513089,5.43468,2.576064Q5.30153,2.63904,5.17163,2.708472Q5.041729999999999,2.777905,4.91539,2.853628Q4.78906,2.929351,4.666589999999999,3.01118Q4.5441199999999995,3.09301,4.42581,3.1807499999999997Q4.307510000000001,3.2685,4.19365,3.3619399999999997Q4.07979,3.45538,3.97065,3.55429Q3.86152,3.65321,3.75737,3.7573600000000003Q3.65321,3.86151,3.5543,3.97065Q3.45538,4.0797799999999995,3.3619399999999997,4.19364Q3.2685,4.3075,3.1807600000000003,4.425800000000001Q3.09302,4.54411,3.01119,4.66658Q2.929354,4.78905,2.853631,4.91538Q2.777908,5.04172,2.708475,5.17162Q2.639042,5.30152,2.576066,5.434670000000001Q2.513091,5.56782,2.456724,5.7039Q2.4003579999999998,5.839980000000001,2.350737,5.97866Q2.301116,6.11734,2.258359,6.25829Q2.215602,6.39924,2.1798130000000002,6.54212Q2.144024,6.685,2.115289,6.82946Q2.0865534,6.97392,2.0649412,7.11962Q2.0433289,7.26532,2.0288917,7.4119Q2.0144546,7.55848,2.00722729,7.70559Q2,7.85271,2,8Q2,8.14729,2.00722729,8.29441Q2.0144546,8.44152,2.0288917,8.5881Q2.0433289,8.73469,2.0649412,8.880379999999999Q2.0865534,9.02608,2.115289,9.170539999999999Q2.144024,9.315000000000001,2.1798130000000002,9.45788Q2.215602,9.600760000000001,2.258359,9.741710000000001Q2.301116,9.88266,2.350737,10.02134Q2.4003579999999998,10.16002,2.456724,10.2961Q2.513091,10.43218,2.576066,10.56533Q2.639042,10.69848,2.708475,10.82838Q2.777908,10.95828,2.853631,11.08462Q2.929354,11.21095,3.01119,11.33342Q3.09302,11.45589,3.1807600000000003,11.5742Q3.2685,11.6925,3.3619399999999997,11.80636Q3.45538,11.92022,3.5543,12.0294Q3.65321,12.1385,3.75737,12.2426Q3.86152,12.3468,3.97065,12.4457Q4.07979,12.5446,4.19365,12.6381Q4.307510000000001,12.7315,4.42581,12.8192Q4.5441199999999995,12.907,4.666589999999999,12.9888Q4.78906,13.0706,4.91539,13.1464Q5.041729999999999,13.2221,5.17163,13.2915Q5.30153,13.361,5.43468,13.4239Q5.56783,13.4869,5.7039100000000005,13.5433Q5.83999,13.5996,5.97867,13.6493Q6.11736,13.6989,6.25831,13.7416Q6.39926,13.7844,6.54213,13.8202Q6.68501,13.856,6.82947,13.8847Q6.97394,13.9134,7.11963,13.9351Q7.26533,13.9567,7.41192,13.9711Q7.5585,13.9855,7.70561,13.9928Q7.85273,14,8.00002,14ZM11.75002,8C11.75002,5.928929999999999,10.07108,4.25,8,4.25C7.58579,4.25,7.25,4.585789999999999,7.25,5C7.25,5.414210000000001,7.58579,5.75,8,5.75C9.242650000000001,5.75,10.25001,6.75736,10.25001,8C10.25001,9.24264,9.242650000000001,10.25,8,10.25L7.89823,10.25685C7.53216,10.30651,7.25,10.6203,7.25,11C7.25,11.41421,7.58579,11.75,8,11.75C10.07108,11.75,11.75002,10.07107,11.75002,8Z" fill-rule="evenodd" fill="#91BBF2" fill-opacity="1"/></g></g></g></g></svg>`;

// 自定义 TimeoutError 类
class TimeoutError extends Error {
  constructor(message: any) {
    super(message);
    this.name = 'TimeoutError';
  }
}


// 对话数据
export interface Chat {
  id: string;             // 聊天的唯一标识符
  dateTime: string;       // 聊天的日期和时间
  text: string;           // 聊天的文本内容
  messageId?: string;     // 可选，消息的唯一标识符
  username?: string;      // 可选，用户的名称
  usericon?: string;      // 可选，用户的头像
  language?: string;      // 可选，聊天使用的语言
  isQuestion?: boolean;   // 可选，是否是一个问题
  isFinished?: boolean;   // 可选，聊天是否已经完成
  showAll?: boolean;      // 可选，是否显示全部内容
  showToggle?: boolean;   // 可选，是否显示展开收起按钮
  hideAnswer?: boolean;   // 可选，是否收起答案
  isFromIde?: boolean;    // 可选，是否来自IDE
  isLike?: boolean;       // 可选，是否是点赞
  isDislike?: boolean;    // 可选，是否是点踩
  isUseAgent?: boolean;   // 可选，是否使用智能团
  inputInfo?: InputInfo;  // 可选，输入信息的对象
  selectCode?: string;    // 可选，选择的代码
}

// 输入信息
interface InputInfo {
  key: string;            // 对话指令
  action: string;         // 对话指令
  actionName: string;     // 指令名称
  tooltip: string;        // 指令提示
  range: {
    endLine: number;      // ide传递的初始结束行
    startLine: number;    // ide传递的初始开始行
  } | null;
  filePath: string;       // 文件路径
  prompt: string;         // 输入内容
  code: string;           // 选中内容
  language: string;       // 文件语言
  context: string;        // 上下文信息
  conversation_id: string; // 对话的唯一标识符
  stream: boolean;        // 是否流式传输
  mode?: string;          // 可选，模型
  context_association?: boolean; // 可选，是否有上下文关联
  callType?: string;      // 可选，调用类型
  acceptRange?: {
    endLine: number;      // 采纳功能的结束行
    startLine: number;    // 采纳功能的开始行
  } | null;
  startLine?: number;     // 可选，开始行
  endLine?: number;       // 可选，结束行
  acceptAction?: string;  // 可选，采纳的类型 替换或者插入
}

// IDE传递过来的数据
export interface IdeData {
  key: string;        // 键
  actionName: string; // 动作名称
  range: {
    startLine: number; // 开始行
    endLine: number;  // 结束行
  } | null;           // 行范围，可以为空
  code: string;       // 代码内容
  context: string;    // 上下文
  language: string;   // 编程语言
  callType: string;   // 调用类型
}

//  LLM推荐的下一步操作
export interface Advise {
  title: string;
  prompt: string;
}

interface StreamTempText {
  text: string;
  remainText: string;
}

// 对话存储数据
export interface ChatState {
  socket: any;            // socket对象
  currentChatId: string;  // 当前会话ID
  messageOffset?: number; // 消息偏移
  socketTimer: any;       // socket定时器
  chatList: Chat[];       // 聊天列表
  advises: Advise[];      // 下一步操作推荐
  inputInfo: InputInfo;   // 输入信息
  isLoading: boolean;     // 是否正在加载
  isFinished: boolean;    // 是否已完成
  controller: any;        // 控制器对象
  chatMap: Record<string, StreamTempText>; // 聊天映射
  lastStreamId: string;   // 最后一个流的ID
  errorPart: string;      // 流式输出上一次解析失败的内容
}

export const useChatStore = defineStore('chat-store', {
  state: (): ChatState => ({
    socket: null,
    currentChatId: '',
    messageOffset: undefined,
    socketTimer: null,
    chatList: [],
    advises: [],
    inputInfo: {} as InputInfo,
    isLoading: false,
    isFinished: false,
    controller: null,
    chatMap: {},
    lastStreamId: '',
    errorPart: ''
  }),

  actions: {
    // 设置加载状态
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },

    // 使用提供的数据更新输入信息
    setInputInfo(data: Partial<InputInfo>) {
      this.inputInfo = Object.assign(this.inputInfo, data);
      console.log("[ZGSM] setInputInfo", this.inputInfo);
    },

    // 生成新的会话UUID
    resetConversation() {
      this.inputInfo.conversation_id = "conv-" + getUuid();
    },

    // 将新聊天添加到聊天列表中
    addChat(chat: Chat) {
      this.chatList.push(chat);
    },

    // 清除对话内容
    clearChat() {
      this.clearSocket();
      if (this.controller) {
        this.controller.abort();
        this.controller = undefined;
      }
      this.resetConversation();
      this.chatList.length = 0;
      this.chatMap = {};
    },

    // 停止对话
    async stopChat() {
      // 每次发起新请求先终止现有请求,清除已有输出内容
      console.log('[ZGSM]: stopChat', this.chatList, this.advises);
      this.handleFinished();
      this.clearSocket();
      if (this.controller) {
        this.controller.abort();
        this.controller = undefined;
      }
      this.handleEndStep();
    },

    //  更新“下一步操作推荐”的列表
    updateAdvises(arr: Advise[]) {
      if (arr.length == 0) 
        return;
      this.advises = arr;
    },

    // 清除socket连接
    clearSocket() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      if (this.socketTimer) {
        clearInterval(this.socketTimer);
        this.socketTimer = null;
      }
    },

    // 获取answer数据
    async runChat(obj?: IdeData) {
      console.log("[ZGSM] runChat: ", obj);
      
      this.stopChat();

      this.isFinished = false;
      this.isLoading = true;

      const data: Partial<InputInfo> = {
        language: this.inputInfo.language,
        filePath: this.inputInfo.filePath,
        code: this.inputInfo.code,
        stream: true
      };

      // 判断用户信息是否有效
      const configStore = useConfigStore();
      const { display_name } = configStore.userInfo;
      if (!display_name) {
        this.addErrorMessage('请重新登录');
        return;
      }

      if (obj && obj.key) {
        // 格式刷
        this.resetConversation();
        data.conversation_id = this.inputInfo.conversation_id;
        data.action = obj.key;
        data.code = obj.code;
        data.prompt = this.inputInfo.tooltip;
        data.context = obj.context;
        data.language = obj.language;
        data.context_association = true;
        data.callType = obj.callType;
        data.range = obj.range;
        data.startLine = obj.range?.startLine || 0;
        data.endLine = obj.range?.endLine || 0;

        console.log('[ZGSM] chat-inputInfo:', this.inputInfo);

        this.addChat({
          id: String(new Date().getTime() + Math.floor(Math.random() * 1000)),
          dateTime: new Date().toLocaleString(),
          text: obj.code,
          isFromIde: true,
          username: display_name,
          isQuestion: true,
          language: obj.language,
          inputInfo: JSON.parse(JSON.stringify(this.inputInfo))
        });
        await nextTick;
        scrollToBottom();

        if (obj.key === 'addComment' && obj.language === 'python') {
          const info = JSON.parse(data.context || '{}');
          if (info?.func_sign_range) {
            data.acceptRange = {
              startLine: info.func_sign_range.start_line,
              endLine: info.func_sign_range.end_line,
            };
          } else {
            data.acceptRange = {
              startLine: obj.range?.startLine || 0,
              endLine: obj.range?.startLine || 0,
            };
          }
          this.inputInfo.acceptRange = data.acceptRange;
          this.chatList[this.chatList.length - 1].inputInfo = JSON.parse(JSON.stringify(this.inputInfo));
        }
        this.startSocketChat(data);
      } else {
        // 对话
        if (!this.inputInfo.conversation_id) {
          this.resetConversation();
        }
        data.conversation_id = this.inputInfo.conversation_id;
        data.action = 'chat';
        data.prompt = this.inputInfo.prompt;
        data.range = this.inputInfo.range;

        this.startSocketChat(data);
      }
    },

    // 动画渲染
    async animateChatText(streamId: string) {
      const streamTempText: StreamTempText = this.chatMap[streamId];

      if (!streamTempText) return;
      if (streamTempText.remainText && streamTempText.remainText.length > 0) {
        const fetchCount = Math.max(1, Math.round(streamTempText.remainText.length / 60));
        const fetchText = streamTempText.remainText.slice(0, fetchCount);
        streamTempText.text += fetchText;
        streamTempText.remainText = streamTempText.remainText.slice(fetchCount);
        this.updatePartChat(this.makeMarkedResponse(streamTempText.text), streamId);
      }

      if (this.isFinished || this.lastStreamId !== streamId) {
        streamTempText.text += streamTempText.remainText;
        this.updatePartChat(this.makeMarkedResponse(streamTempText.text), streamId);
        await this.handleLink();
        delete this.chatMap[streamId];
        return;
      }

      requestAnimationFrame(() => this.animateChatText(streamId));
    },

    // 开始连接 socket
    async startSocketChat(data: any): Promise<void> {
      // 使用配置存储获取应用配置
      const configStore = useConfigStore();
      const { appConfig, clientConfig } = configStore;
      // 构建 socket 连接的 URL
      const url: string = `${appConfig.chatUrl}/chat`;
      // 如果 socket 未初始化，则进行连接
      if (!this.socket) {
        console.log('[ZGSM] websocket connect: ', url);
        // 连接 socket 服务器
        this.socket = await (window as any).io.connect(url, {
          // 设置认证信息
          auth: {
            "username": configStore.userInfo.username,
            "display_name": configStore.userInfo.display_name,
            "token": configStore.userInfo.token,
            "ide": clientConfig.ide || "default_ide",
            "ide-version": clientConfig.extVersion,
            "ide-real-version": clientConfig.ideVersion,
            "host-ip": clientConfig.hostIp
          },
          transports: ['websocket']
        });

        // 监听 connect 事件
        this.socket?.on('connect', () => {
          if (this.currentChatId) {
            setTimeout(() => {
              // 重连场景
              this.socket.emit("rechat", {
                chat_id: this.currentChatId,
                offset: this.messageOffset,
              });
            }, 1000);
          }
        });

        // 监听 message 事件
        this.socket?.on('message', async (msg: string) => {
          // 如果收到 [DONE] 消息，则停止加载并断开连接
          console.log('[ZGSM] on("message"): ', msg);
          if (msg === "[DONE]") {
            this.stopChat();
          }
        });
        // 监听 json 事件
        this.socket.on('json', (json_data: any) => {
          // console.log('[ZGSM] on("json"): ', json_data);
          if (this.isFinished) return;
          // 开始加载并处理代理发来的消息
          this.isLoading = true;
          this.isFinished = false;
          /* 记录当前接受的消息偏移量，用于给重连场景下续传
             这里只考虑了 json 类数据, 这样做的前提是过程中只有 json 数据而不能穿插 message 数据
             目前 message 数据不会传递 offset */
          this.messageOffset = json_data.offset;
          this.handleAgentMessage(json_data);
        });
        // 监听 chat-id 更新事件
        this.socket.on('updateChatId', (chat_id: string) => {
          this.currentChatId = chat_id;
        });
        // 监听 disconnect 事件
        this.socket.on('disconnect', (error: any) => {
          console.log('[ZGSM] on("disconnect"): ', error);
          // 不能在 disconnect 时清理，会导致重连时丢失 offset
          // this.handleFinished();
        });

        // 监听 socket 错误事件
        this.socket.on('error', (error: any) => {
          console.error('[ZGSM] on("error"): ', error);
          this.clearSocket();
          this.addErrorMessage('服务异常，请点击‘问题反馈’向诸葛神码开源社区反馈问题，谢谢！');
        });

        // 发送 chat 事件和数据
        this.socket.emit("chat", data);

        this.socketTimer = setInterval(() => {
          this.socket.emit("ping", 1);
        }, 5000);
      }
    },

    // 处理 WebSocket 数据
    async handleAgentMessage(json_data: any) {
      // 定义事件类型
      const event: string = json_data.event;
      // 如果事件是 agent_start
      if (event === 'agent_start') {
        console.log('[ZGSM] agent_start: ', json_data);
        await this.handleLink();
        // 生成临时流ID
        this.lastStreamId = 'stream-temp-' + getRandomId();
        // 如果 chatMap 不存在，则初始化为空对象
        if (!this.chatMap) {
          this.chatMap = {};
        }
        // 初始化当前流的聊天内容为空
        this.chatMap[this.lastStreamId] = { text: "", remainText: "" };
        // 添加聊天信息到聊天列表
        this.addChat({
          id: this.lastStreamId,
          dateTime: new Date().toLocaleString(),
          text: '',
          isQuestion: false,
          username: json_data.agent_name,
          usericon: json_data.agent_icon,
          inputInfo: JSON.parse(JSON.stringify(this.inputInfo))
        });
        // 开始动画渲染
        this.animateChatText(this.lastStreamId);
      } else if (event === 'agent_advise') {  //LLM建议的下一步操作
        if (!json_data.advises) return;
        this.updateAdvises(json_data.advises as Advise[]);
        console.log("[ZGSM] agent_advise: ", json_data, this.advises);
      } else if (event === 'dify_agent_thought') {
        // 如果事件是 dify_agent_thought
        if (!json_data.dify_chunk) return;
        if (!this.chatList[this.chatList.length - 1].messageId) {
          this.chatList[this.chatList.length - 1].messageId = json_data.dify_chunk.message_id || '';
        }
        // 如果 dify_chunk 事件是 message 或 agent_message
        if (['message', 'agent_message'].includes(json_data.dify_chunk.event)) {
          // 追加 dify_chunk 的回答到当前流的聊天内容
          this.chatMap[this.lastStreamId].remainText += json_data.dify_chunk.answer;
        } else if (['node_started'].includes(json_data.dify_chunk.event)) {
          // 渲染步骤信息
          if (json_data.dify_chunk.data?.title?.charAt(0) === '*') {
            this.chatMap[this.lastStreamId].remainText += `\n~~步骤start：${json_data.dify_chunk.data.title.slice(1)}~~\n`;
          }
        } else if (['node_finished'].includes(json_data.dify_chunk.event)) {
          // 更新步骤状态
          this.handleEndStep();
          if (json_data.dify_chunk.data?.title?.charAt(0) === '&' && json_data.dify_chunk.data?.outputs?.result) {
            this.chatMap[this.lastStreamId].remainText += `\n~~步骤start：${json_data.dify_chunk.data.outputs.result}~~\n`;
            this.handleEndStep();
          }
          // 如果 dify_chunk 事件是 error
        } else if (['error'].includes(json_data.dify_chunk.event)) {
          // 设置聊天列表中最后一条消息的文本为错误信息    
          this.updatePartChat('请清空对话重试，如仍有异常，请点击‘问题反馈’向诸葛神码开源社区反馈问题', this.lastStreamId);
          // 停止会话
          this.stopChat();
        }
      } else if (event === 'agent_end') {
        console.log('[ZGSM] agent_end: ', json_data);
        this.chatList[this.chatList.length - 1].isFinished = true;
        // socket错误时更新步骤状态
        setTimeout(() => {
          this.handleEndStep();
        });
      }
    },

    // 回调IDE处理链接信息
    async handleLink() {
      return new Promise((resolve) => {
        if (!this.lastStreamId || !this.chatMap[this.lastStreamId]?.text) {
          resolve(true);
          return;
        }
        if (this.chatList[this.chatList.length - 1]?.isQuestion) {
          resolve(true);
          return;
        }
        callBackIde('ide.dealJumpFilePath', {
          mdString: this.chatMap[this.lastStreamId].text
        }, (data: any) => {
          this.updatePartChat(this.makeMarkedResponse(data.data || ''), this.lastStreamId);
          resolve(data);
        });
      });
    },

    // 响应结束处理
    async handleFinished() {
      this.isLoading = false;
      this.isFinished = true;
      this.errorPart = '';
      this.currentChatId = "";
      this.messageOffset = undefined;
    },

    // 报错处理
    async addErrorMessage(message: string) {
      this.handleFinished();
      this.addChat({
        id: this.lastStreamId,
        dateTime: new Date().toLocaleString(),
        text: message,
        username: '诸葛神码',
      });
      await nextTick;
      scrollToBottom();
    },

    // 渲染页面数据
    async updatePartChat(code: string, streamId: string = '') {
      if (streamId) {
        // 找到 id 为 streamId 的聊天信息
        const chat = this.chatList.find(item => item.id === streamId);
        if (chat) {
          chat.text = code;
        }
      } else {
        this.chatList[this.chatList.length - 1].text = code;
      }
      await nextTick;
      scrollToBottom();
    },

    // markdown渲染
    makeMarkedResponse(value: string, isInput: boolean = false, language: string = '') {
      if (!value) {
        return '';
      }

      if (isInput) {
        value = `\`\`\`${language}\n${value}\n\`\`\``;
      }

      const markedResponse = new DOMParser().parseFromString(mdi.render(value), "text/html");
      // new DOMParser().parseFromString(marked.parse(value), "text/html");

      if (!isInput) {
        const preCodeList = markedResponse.querySelectorAll("pre > code");

        preCodeList.forEach((preCode, index) => {
          preCode.parentElement?.classList.add("pre-code-element", "relative");

          if (index != preCodeList.length - 1) {
            preCode.parentElement?.classList.add("mb-8");
          }

          preCode.classList.add("block", "whitespace-pre", "overflow-x-auto");
        });

        // 处理开始步骤
        const answerEl = document.getElementById('chatIndex-' + (this.chatList.length - 1)) as HTMLElement;
        const stepList = markedResponse.querySelectorAll("s");

        Array.from(stepList)
          .filter(step => step.textContent?.includes("步骤start："))
          .forEach((step, index) => {
            const stepName: string = step.textContent?.replace('步骤start：', '') || '';
            const allStep = answerEl ? answerEl.querySelectorAll('.start-step') : [];

            if (allStep.length > 0) {
              if (allStep[index] && allStep[index].classList.contains('isFinished')) {
                step.outerHTML = this.stepHtml(stepName, true);
              } else {
                step.outerHTML = this.stepHtml(stepName);
              }
            } else {
              step.outerHTML = this.stepHtml(stepName);
            }
          });
      }

      return markedResponse.documentElement.innerHTML;
    },

    // 渲染步骤HTML
    stepHtml(stepName: string, isFinished = false) {
      let stepStyle = 'flex items-center w-full h-[32px] leading-[32px] px-4 mb-2.5 rounded-md';
      const stepNameStyle = 'ml-2 flex-1 truncate';
      let stepIcon = loadingSvg;
      if (isFinished) {
        stepStyle += ' isFinished';
        stepIcon = successSvg;
      }
      return `<div class="start-step ${stepStyle}">${stepIcon}<span class="${stepNameStyle}" title="${stepName}">${stepName}</span></div>`;

    },

    // 更新步骤状态到完成状态
    async handleEndStep() {
      const allStep = document.querySelectorAll('.start-step');
      if (allStep.length > 0) {
        allStep.forEach(item => {
          if (!item.classList.contains("isFinished")) {
            item.innerHTML = `${successSvg}<span class="ml-2">${item.textContent}</span>`;
            item.classList.add("isFinished");
          }
        });
      }
    },
  }
});
