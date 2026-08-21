import type { CadModel } from '@da/cad-core';

export type ChatRole = 'user' | 'assistant';

/** 随用户消息附带的 CAD / GLB 文件卡片 */
export interface ChatAttachment {
  id: string;
  name: string;
  kind: 'json' | 'glb';
  /** JSON 模型快照，点击卡片时可恢复到画布 */
  model?: CadModel;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** 用户消息附带的文件（发送时从输入区待发送附件写入） */
  attachments?: ChatAttachment[];
  /** 流式输出尚未结束时为 true */
  streaming?: boolean;
  /** 流式出错信息 */
  error?: string;
  createdAt: number;
}

/**
 * 流式事件协议。后续接入真实后端时按此协议实现传输层；
 * 未来如需「AI 输出 CAD 渲染」，可扩展事件类型 { type: 'cad'; payload: ... }。
 */
export type StreamEvent =
  | { type: 'start'; messageId: string }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface ChatRequest {
  sessionId: string;
  messages: ChatMessage[];
  /** 当前画布已加载的 CAD 模型（供 AI 上下文参考） */
  model: CadModel | null;
}

/** 流式客户端接口：切换真实后端时实现同一接口即可 */
export interface ChatStreamClient {
  stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamEvent>;
}
