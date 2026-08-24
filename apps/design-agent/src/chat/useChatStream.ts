import { useEffect, useRef } from 'react';
import { DeepSeekHarnessChatStreamClient } from '../sse/DeepSeekHarnessChatStreamClient';
import { MockChatStreamClient } from '../sse/MockChatStreamClient';
import type { ChatAttachment, ChatStreamClient, HitlRespondPayload } from '../sse/types';
import { useCadStore } from '../stores/cadStore';
import { useChatStore } from '../stores/chatStore';

/**
 * 流式客户端单例。
 * - 默认接入本地 DeepSeek Harness（dsh web，经 Vite `/dsh` 代理）
 * - VITE_CHAT_CLIENT=mock 时回退到 Mock，便于无 Harness 时调试 UI
 */
const client: ChatStreamClient =
  import.meta.env.VITE_CHAT_CLIENT === 'mock'
    ? new MockChatStreamClient()
    : new DeepSeekHarnessChatStreamClient();

function createAttachmentId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 从 cadStore 收集当前输入区待发送附件，写入消息卡片 */
function collectPendingAttachments(): ChatAttachment[] {
  const cad = useCadStore.getState();
  const list: ChatAttachment[] = [];
  if (cad.pendingJson && cad.model) {
    list.push({
      id: createAttachmentId(),
      name: cad.pendingJson,
      kind: 'json',
      model: cad.model,
    });
  }
  if (cad.pendingGltf) {
    list.push({
      id: createAttachmentId(),
      name: cad.pendingGltf,
      kind: 'glb',
    });
  }
  return list;
}

/**
 * 发送消息并驱动流式输出：
 * 追加消息 → 遍历 stream() 事件 → 增量写入占位消息。
 */
export function useSendMessage() {
  const abortRef = useRef<AbortController | null>(null);

  // 组件卸载时中止未完成的流
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const attachments = collectPendingAttachments();
    const result = useChatStore.getState().sendMessage(trimmed, attachments);
    if (!result) return;
    const { sessionId, assistantMessageId } = result;

    const cad = useCadStore.getState();
    cad.consumePendingAttachments();

    // 首次发消息且已有 3D 模型时再打开右侧画布（上传本身不弹出）
    if (!cad.canvasOpen && cad.gltfScene) {
      useCadStore.getState().openCanvas();
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const request = {
      sessionId,
      messages: useChatStore.getState().messagesBySession[sessionId] ?? [],
      model: useCadStore.getState().model,
    };

    try {
      for await (const event of client.stream(request, controller.signal)) {
        switch (event.type) {
          case 'delta':
            useChatStore.getState().appendDelta(sessionId, assistantMessageId, event.text);
            break;
          case 'approval':
            useChatStore.getState().setPendingHitl(sessionId, {
              kind: 'approval',
              rpcId: event.rpcId,
              sessionId: event.sessionId,
              approvalId: event.approvalId,
              toolName: event.toolName,
              callId: event.callId,
              reason: event.reason,
            });
            break;
          case 'question':
            useChatStore.getState().setPendingHitl(sessionId, {
              kind: 'question',
              rpcId: event.rpcId,
              sessionId: event.sessionId,
              questions: event.questions,
            });
            break;
          case 'hitl-resolved': {
            const pending = useChatStore.getState().pendingHitlBySession[sessionId];
            const match =
              event.kind === 'approval'
                ? pending?.kind === 'approval' && pending.approvalId === event.approvalId
                : pending?.kind === 'question' && pending.rpcId === event.rpcId;
            if (match) useChatStore.getState().clearPendingHitl(sessionId);
            break;
          }
          case 'error':
            useChatStore
              .getState()
              .markMessageError(sessionId, assistantMessageId, event.message);
            return;
          case 'done':
          case 'start':
            break;
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('chat stream failed', err);
        useChatStore
          .getState()
          .markMessageError(sessionId, assistantMessageId, '流式响应出错，请重试');
      }
    } finally {
      // 无论正常结束、异常或手动中止，都收尾（幂等）
      useChatStore.getState().finishMessage(sessionId, assistantMessageId);
    }
  };

  const stop = () => {
    const sid = useChatStore.getState().activeSessionId;
    const pending = sid ? useChatStore.getState().pendingHitlBySession[sid] : null;
    if (pending?.kind === 'question') {
      void client.respond?.({ kind: 'question-cancel', rpcId: pending.rpcId }).catch(() => undefined);
    }
    abortRef.current?.abort();
  };

  const respondHitl = async (payload: HitlRespondPayload) => {
    if (!client.respond) {
      const sid = useChatStore.getState().activeSessionId;
      if (sid) useChatStore.getState().setPendingHitlError(sid, '当前客户端不支持人工处理');
      return;
    }
    const result = await client.respond(payload);
    const sid = useChatStore.getState().activeSessionId;
    if (!sid) return;
    if (result.accepted || result.reason === 'not-pending') {
      useChatStore.getState().clearPendingHitl(sid);
      return;
    }
    useChatStore.getState().setPendingHitlError(sid, result.reason ?? '提交失败');
  };

  return { send, stop, respondHitl };
}
