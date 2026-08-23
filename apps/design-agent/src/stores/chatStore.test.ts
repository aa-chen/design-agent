import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chatStore';

beforeEach(() => {
  useChatStore.setState({
    sessions: [],
    activeSessionId: null,
    messagesBySession: {},
    assistantStatus: {},
    pendingHitlBySession: {},
  });
  localStorage.clear();
});

describe('chatStore HITL', () => {
  it('returns null from sendMessage while awaiting-hitl', () => {
    const sent = useChatStore.getState().sendMessage('hi');
    expect(sent).not.toBeNull();
    const { sessionId } = sent!;
    useChatStore.getState().setPendingHitl(sessionId, {
      kind: 'approval',
      rpcId: 'r',
      sessionId: 'dsh',
      approvalId: 'a',
      toolName: 'bash',
    });
    expect(useChatStore.getState().assistantStatus[sessionId]).toBe('awaiting-hitl');
    expect(useChatStore.getState().sendMessage('again')).toBeNull();
  });

  it('clearPendingHitl returns status to streaming', () => {
    const { sessionId } = useChatStore.getState().sendMessage('hi')!;
    useChatStore.getState().setPendingHitl(sessionId, {
      kind: 'approval',
      rpcId: 'r',
      sessionId: 'dsh',
      approvalId: 'a',
      toolName: 'bash',
    });
    useChatStore.getState().clearPendingHitl(sessionId);
    expect(useChatStore.getState().pendingHitlBySession[sessionId]).toBeNull();
    expect(useChatStore.getState().assistantStatus[sessionId]).toBe('streaming');
  });

  it('finishMessage clears pendingHitl', () => {
    const { sessionId, assistantMessageId } = useChatStore.getState().sendMessage('hi')!;
    useChatStore.getState().setPendingHitl(sessionId, {
      kind: 'approval',
      rpcId: 'r',
      sessionId: 'dsh',
      approvalId: 'a',
      toolName: 'bash',
    });
    useChatStore.getState().finishMessage(sessionId, assistantMessageId);
    expect(useChatStore.getState().pendingHitlBySession[sessionId]).toBeNull();
    expect(useChatStore.getState().assistantStatus[sessionId]).toBe('idle');
  });
});
