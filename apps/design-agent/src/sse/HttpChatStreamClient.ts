import type { ChatRequest, ChatStreamClient, StreamEvent } from './types';

/**
 * 真实后端流式客户端（占位）。
 *
 * 后续接入时使用 fetch + ReadableStream 读取 text/event-stream：
 *   const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(req), signal });
 *   const reader = res.body.getReader();
 *   // 按行解析 "data: {json}" 事件，映射为 StreamEvent 后 yield。
 *
 * 注意：浏览器原生 EventSource 不支持 POST 与自定义 Header，
 * 因此推荐 fetch + ReadableStream + SSE 解析器方案。
 */
export class HttpChatStreamClient implements ChatStreamClient {
  // eslint-disable-next-line require-yield
  async *stream(_req: ChatRequest, _signal: AbortSignal): AsyncGenerator<StreamEvent> {
    throw new Error('HttpChatStreamClient 尚未实现，请使用 MockChatStreamClient 开发调试');
  }
}
