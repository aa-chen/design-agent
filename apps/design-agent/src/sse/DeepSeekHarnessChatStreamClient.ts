import type { CadModel } from '@da/cad-core';
import { buildRespondEnvelope, mapMuxEnvelopeToStreamEvent } from './hitl';
import type { ChatMessage, ChatRequest, ChatStreamClient, HitlRespondPayload, StreamEvent } from './types';

type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code?: string; message?: string } };

type ServerEnvelope = {
  type: string;
  rpcId?: string;
  method?: string;
  payload?: Record<string, unknown>;
  result?: RpcResult<unknown>;
};

type SessionEvent = {
  type: string;
  data?: Record<string, unknown>;
};

const SESSION_MAP_KEY = 'da-dsh-session-map';

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function dshHttpBase() {
  // Dev: Vite proxies /dsh → http://127.0.0.1:3080
  return (import.meta.env.VITE_DSH_HTTP_BASE as string | undefined)?.replace(/\/$/, '') || '/dsh';
}

function dshWsUrl() {
  const override = import.meta.env.VITE_DSH_WS_URL as string | undefined;
  if (override) return override;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${dshHttpBase()}/api/events.mux`;
}

function loadSessionMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SESSION_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveSessionMap(map: Record<string, string>) {
  localStorage.setItem(SESSION_MAP_KEY, JSON.stringify(map));
}

function latestUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i].content;
  }
  return '';
}

function cadContextText(model: CadModel | null): string | null {
  if (!model) return null;
  return [
    '[CAD 画布上下文]',
    `模型名称：${model.name}`,
    `单位：${model.unit ?? 'mm'}`,
    `几何元素：${model.elements.length}`,
    `标注：${model.annotations.length}`,
    `零件分组：${model.parts.length}`,
    '请结合上述 CAD 上下文回答用户问题；若信息不足请明确说明。',
  ].join('\n');
}

function buildPromptParts(req: ChatRequest): Array<{ type: 'text'; text: string }> {
  const parts: Array<{ type: 'text'; text: string }> = [];
  const ctx = cadContextText(req.model);
  if (ctx) parts.push({ type: 'text', text: ctx });
  const text = latestUserText(req.messages).trim();
  if (text) parts.push({ type: 'text', text });
  return parts;
}

const DSH_DOWN_HINT =
  'DeepSeek Harness 未在运行（3080）。请在独立终端启动并保持开着：npx @deepseek-ai/dsh web --port 3080';

/** 先打 HTTP，比 WebSocket 错误更易定位（代理未生效 / dsh 未启动） */
async function assertDshReachable(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${dshHttpBase()}/api/session.list`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: uuid(),
        method: 'session.list',
        payload: {},
      }),
    });
  } catch {
    throw new Error(DSH_DOWN_HINT);
  }
  // Vite 在上游挂掉时常见 500；Origin/Host 不一致时 Harness 返回 403
  if (!res.ok) {
    throw new Error(`${DSH_DOWN_HINT}（HTTP ${res.status}）`);
  }
}

/** 共享 mux WebSocket：Harness 向所有订阅者广播 session 事件 */
class MuxBus {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(env: ServerEnvelope) => void>();
  private connectPromise: Promise<void> | null = null;

  async ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;

    // 丢弃半开/已关连接，避免复用失败的 socket
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(dshWsUrl());
      this.socket = ws;
      let settled = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.connectPromise = null;
        this.socket = null;
        reject(new Error(message));
      };

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        this.connectPromise = null;
        resolve();
      };

      ws.onerror = () => {
        if (ws.readyState !== WebSocket.OPEN) {
          fail(DSH_DOWN_HINT);
        }
      };

      ws.onclose = () => {
        if (!settled) fail(DSH_DOWN_HINT);
        if (this.socket === ws) this.socket = null;
        this.connectPromise = null;
      };

      ws.onmessage = (ev) => {
        let env: ServerEnvelope;
        try {
          env = JSON.parse(String(ev.data)) as ServerEnvelope;
        } catch {
          return;
        }
        for (const listener of this.listeners) listener(env);
      };
    });

    return this.connectPromise;
  }

  subscribe(listener: (env: ServerEnvelope) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const muxBus = new MuxBus();

/**
 * DeepSeek Harness（本地 dsh web）流式客户端。
 *
 * 协议：
 * - POST /api/session.create | session.prompt | session.cancel（client-request 信封）
 * - WS  /api/events.mux（server-request 帧，method=session/event 等）
 */
export class DeepSeekHarnessChatStreamClient implements ChatStreamClient {
  private sessionMap = loadSessionMap();

  async *stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const messageId = `dsh-${uuid()}`;
    yield { type: 'start', messageId };

    const parts = buildPromptParts(req);
    if (parts.length === 0) {
      yield { type: 'error', message: '没有可发送的用户消息' };
      return;
    }

    let dshSessionId: string;
    try {
      await assertDshReachable();
      await muxBus.ensureConnected();
      dshSessionId = await this.ensureDshSession(req.sessionId);
    } catch (err) {
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : '创建 DeepSeek Harness 会话失败',
      };
      return;
    }

    const queue: StreamEvent[] = [];
    let wake: (() => void) | null = null;
    let finished = false;

    const push = (event: StreamEvent) => {
      queue.push(event);
      wake?.();
    };

    const onFrame = (env: ServerEnvelope) => {
      if (finished || env.type !== 'server-request' || !env.payload) return;
      const method = env.method ?? '';
      const payload = env.payload;
      const sessionId = payload.sessionId as string | undefined;
      if (sessionId && sessionId !== dshSessionId) return;

      const hitl = mapMuxEnvelopeToStreamEvent(env);
      if (hitl) {
        push(hitl);
        return;
      }

      if (method === 'stream/error') {
        const error = payload.error as { message?: string } | undefined;
        finished = true;
        push({ type: 'error', message: error?.message ?? 'Harness 流式错误' });
        return;
      }

      if (method !== 'session/event') return;
      const event = payload.event as SessionEvent | undefined;
      if (!event) return;

      if (event.type === 'assistant/chunk') {
        const chunk = event.data?.chunk as { type?: string; text?: string } | undefined;
        if (chunk?.type === 'text-delta' && chunk.text) {
          push({ type: 'delta', text: chunk.text });
        }
        return;
      }

      if (event.type === 'text-chunks') {
        const texts = event.data?.texts;
        if (Array.isArray(texts) && texts.length > 0) {
          push({ type: 'delta', text: texts.map(String).join('') });
        }
        return;
      }

      if (event.type === 'turn/end') {
        finished = true;
        push({ type: 'done' });
      }
    };

    const unsubscribe = muxBus.subscribe(onFrame);

    const onAbort = () => {
      void this.rpc('session.cancel', { sessionId: dshSessionId }).catch(() => undefined);
      finished = true;
      push({ type: 'error', message: '已取消' });
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      const promptRes = await this.rpc<{ accepted: true }>('session.prompt', {
        sessionId: dshSessionId,
        mode: 'queue',
        content: parts,
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (!promptRes.ok) {
        // 缓存会话可能已失效（Harness 重启），清掉后提示重试
        if (promptRes.error.code === 'not-found' || /session/i.test(promptRes.error.message ?? '')) {
          delete this.sessionMap[req.sessionId];
          saveSessionMap(this.sessionMap);
        }
        yield {
          type: 'error',
          message: promptRes.error.message ?? `session.prompt 失败（${promptRes.error.code}）`,
        };
        return;
      }

      while (true) {
        while (queue.length > 0) {
          const next = queue.shift()!;
          yield next;
          if (next.type === 'error' || next.type === 'done') return;
        }
        if (finished) {
          yield { type: 'done' };
          return;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = null;
      }
    } catch (err) {
      if (!signal.aborted) {
        yield {
          type: 'error',
          message: err instanceof Error ? err.message : 'DeepSeek Harness 请求失败',
        };
      }
    } finally {
      signal.removeEventListener('abort', onAbort);
      unsubscribe();
    }
  }

  private async ensureDshSession(localSessionId: string): Promise<string> {
    const cached = this.sessionMap[localSessionId];
    if (cached) return cached;

    const cwd = (import.meta.env.VITE_DSH_CWD as string | undefined)?.trim();
    const payload: Record<string, string> = {};
    if (cwd) payload.cwd = cwd;

    const res = await this.rpc<{ sessionId: string }>('session.create', payload);
    if (!res.ok || !res.value?.sessionId) {
      throw new Error(
        !res.ok ? (res.error.message ?? 'session.create 失败') : 'session.create 无 sessionId',
      );
    }

    this.sessionMap[localSessionId] = res.value.sessionId;
    saveSessionMap(this.sessionMap);
    return res.value.sessionId;
  }

  private async rpc<T>(method: string, payload: unknown): Promise<RpcResult<T>> {
    const res = await fetch(`${dshHttpBase()}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: uuid(),
        method,
        payload,
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: { code: String(res.status), message: `HTTP ${res.status} ${res.statusText}` },
      };
    }

    const body = (await res.json()) as ServerEnvelope;
    const result = body.result as RpcResult<T> | undefined;
    if (!result) {
      return { ok: false, error: { message: '无效的 Harness 响应' } };
    }
    return result;
  }

  async respond(payload: HitlRespondPayload): Promise<{ accepted: boolean; reason?: string }> {
    try {
      const res = await fetch(`${dshHttpBase()}/api/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRespondEnvelope(payload)),
      });
      if (!res.ok) {
        return { accepted: false, reason: `HTTP ${res.status}` };
      }
      const body = (await res.json()) as { accepted?: boolean; reason?: string };
      if (body.accepted === true) return { accepted: true };
      return { accepted: false, reason: body.reason ?? 'bad-response' };
    } catch (err) {
      return {
        accepted: false,
        reason: err instanceof Error ? err.message : '提交失败',
      };
    }
  }
}
