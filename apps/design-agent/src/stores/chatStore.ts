import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AskUserQuestionItem, ChatMessage } from '../sse/types';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type AssistantStatus = 'idle' | 'streaming' | 'awaiting-hitl' | 'error';

export type PendingHitl =
  | {
      kind: 'approval';
      rpcId: string;
      sessionId: string;
      approvalId: string;
      toolName: string;
      callId?: string;
      reason?: string;
      error?: string;
    }
  | {
      kind: 'question';
      rpcId: string;
      sessionId: string;
      questions: AskUserQuestionItem[];
      error?: string;
    };

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  /** 每个会话中 assistant 消息的状态（瞬态，不持久化） */
  assistantStatus: Record<string, AssistantStatus>;
  /** 当前待处理的批准/提问（瞬态，不持久化） */
  pendingHitlBySession: Record<string, PendingHitl | null>;
  createSession: () => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  /**
   * 追加用户消息与空 assistant 占位消息，返回占位消息 id 供流式写入。
   * 若当前会话正在流式输出则返回 null。
   */
  sendMessage: (
    text: string,
    attachments?: ChatMessage['attachments'],
  ) => { sessionId: string; assistantMessageId: string } | null;
  appendDelta: (sessionId: string, messageId: string, delta: string) => void;
  finishMessage: (sessionId: string, messageId: string) => void;
  markMessageError: (sessionId: string, messageId: string, error: string) => void;
  setPendingHitl: (sessionId: string, pending: PendingHitl) => void;
  clearPendingHitl: (sessionId: string) => void;
  setPendingHitlError: (sessionId: string, error: string) => void;
}

/** 会话状态。sessions / messages 持久化到 localStorage；流式瞬态字段不持久化。 */
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      messagesBySession: {},
      assistantStatus: {},
      pendingHitlBySession: {},

      createSession: () => {
        const id = createId();
        const now = Date.now();
        set((s) => ({
          sessions: [{ id, title: '新会话', createdAt: now, updatedAt: now }, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      switchSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((s) => {
          const sessions = s.sessions.filter((x) => x.id !== id);
          const { [id]: _msg, ...messagesBySession } = s.messagesBySession;
          const { [id]: _st, ...assistantStatus } = s.assistantStatus;
          const { [id]: _hitl, ...pendingHitlBySession } = s.pendingHitlBySession;
          return {
            sessions,
            messagesBySession,
            assistantStatus,
            pendingHitlBySession,
            activeSessionId:
              s.activeSessionId === id ? (sessions[0]?.id ?? null) : s.activeSessionId,
          };
        }),

      sendMessage: (text, attachments) => {
        const state = get();
        let sessionId = state.activeSessionId;
        if (!sessionId) {
          sessionId = createId();
          const now = Date.now();
          set({
            sessions: [{ id: sessionId, title: '新会话', createdAt: now, updatedAt: now }, ...state.sessions],
            activeSessionId: sessionId,
          });
        }
        if (
          state.assistantStatus[sessionId] === 'streaming' ||
          state.assistantStatus[sessionId] === 'awaiting-hitl'
        ) {
          return null;
        }

        const now = Date.now();
        const userMsg: ChatMessage = {
          id: createId(),
          role: 'user',
          content: text,
          createdAt: now,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        };
        const assistantMessageId = createId();
        const assistantMsg: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          streaming: true,
          createdAt: now + 1,
        };

        const title = text.trim().slice(0, 20) || '新会话';
        set((s) => {
          const prev = s.messagesBySession[sessionId] ?? [];
          return {
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: [...prev, userMsg, assistantMsg],
            },
            sessions: s.sessions.map((x) =>
              x.id === sessionId
                ? { ...x, title: x.title === '新会话' ? title : x.title, updatedAt: now }
                : x,
            ),
            assistantStatus: { ...s.assistantStatus, [sessionId]: 'streaming' },
          };
        });
        return { sessionId, assistantMessageId };
      },

      appendDelta: (sessionId, messageId, delta) =>
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] ?? []).map((m) =>
              m.id === messageId ? { ...m, content: m.content + delta } : m,
            ),
          },
        })),

      finishMessage: (sessionId, messageId) =>
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] ?? []).map((m) =>
              m.id === messageId ? { ...m, streaming: false } : m,
            ),
          },
          assistantStatus: { ...s.assistantStatus, [sessionId]: 'idle' },
          pendingHitlBySession: { ...s.pendingHitlBySession, [sessionId]: null },
        })),

      markMessageError: (sessionId, messageId, error) =>
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] ?? []).map((m) =>
              m.id === messageId ? { ...m, streaming: false, error } : m,
            ),
          },
          assistantStatus: { ...s.assistantStatus, [sessionId]: 'error' },
          pendingHitlBySession: { ...s.pendingHitlBySession, [sessionId]: null },
        })),

      setPendingHitl: (sessionId, pending) =>
        set((s) => ({
          pendingHitlBySession: { ...s.pendingHitlBySession, [sessionId]: pending },
          assistantStatus: { ...s.assistantStatus, [sessionId]: 'awaiting-hitl' },
        })),

      clearPendingHitl: (sessionId) =>
        set((s) => ({
          pendingHitlBySession: { ...s.pendingHitlBySession, [sessionId]: null },
          assistantStatus: {
            ...s.assistantStatus,
            [sessionId]: s.assistantStatus[sessionId] === 'awaiting-hitl' ? 'streaming' : s.assistantStatus[sessionId],
          },
        })),

      setPendingHitlError: (sessionId, error) =>
        set((s) => {
          const current = s.pendingHitlBySession[sessionId];
          if (!current) return s;
          return {
            pendingHitlBySession: {
              ...s.pendingHitlBySession,
              [sessionId]: { ...current, error },
            },
          };
        }),
    }),
    {
      name: 'da-chat',
      storage: createJSONStorage(() => localStorage),
      // 只持久化会话数据；流式瞬态（assistantStatus、streaming 标记）不落盘，
      // 页面刷新后占位消息自动退化为普通消息。
      partialize: (s) => ({
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        messagesBySession: Object.fromEntries(
          Object.entries(s.messagesBySession).map(([k, msgs]) => [
            k,
            msgs.map((m) => ({ ...m, streaming: false, error: undefined })),
          ]),
        ),
      }),
    },
  ),
);
