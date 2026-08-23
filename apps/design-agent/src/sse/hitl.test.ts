import { describe, expect, it } from 'vitest';
import { buildRespondEnvelope, mapMuxEnvelopeToStreamEvent, validateQuestionAnswers } from './hitl';

describe('mapMuxEnvelopeToStreamEvent', () => {
  it('maps approval/requested to an approval StreamEvent and does not treat it as error', () => {
    const event = mapMuxEnvelopeToStreamEvent({
      type: 'server-request',
      rpcId: 'rpc-1',
      method: 'approval/requested',
      payload: {
        type: 'approval/requested',
        sessionId: 'sess-1',
        approvalId: 'appr-1',
        toolName: 'bash',
        reason: 'rm -rf /tmp/x',
      },
    });
    expect(event).toEqual({
      type: 'approval',
      rpcId: 'rpc-1',
      sessionId: 'sess-1',
      approvalId: 'appr-1',
      toolName: 'bash',
      reason: 'rm -rf /tmp/x',
    });
  });

  it('maps question/requested to a question StreamEvent', () => {
    const event = mapMuxEnvelopeToStreamEvent({
      type: 'server-request',
      rpcId: 'rpc-q',
      method: 'question/requested',
      payload: {
        type: 'question/requested',
        sessionId: 'sess-1',
        questions: [{ id: 'q1', question: '用哪种单位？', options: [{ label: 'mm' }] }],
      },
    });
    expect(event?.type).toBe('question');
    if (event?.type === 'question') {
      expect(event.rpcId).toBe('rpc-q');
      expect(event.questions[0]?.id).toBe('q1');
    }
  });

  it('maps approval/resolved by approvalId', () => {
    expect(
      mapMuxEnvelopeToStreamEvent({
        type: 'server-request',
        method: 'approval/resolved',
        payload: {
          type: 'approval/resolved',
          sessionId: 's',
          approvalId: 'appr-1',
          outcome: 'allowed-once',
        },
      }),
    ).toEqual({ type: 'hitl-resolved', kind: 'approval', approvalId: 'appr-1' });
  });

  it('maps question/resolved by questionRpcId', () => {
    expect(
      mapMuxEnvelopeToStreamEvent({
        type: 'server-request',
        method: 'question/resolved',
        payload: {
          type: 'question/resolved',
          sessionId: 's',
          questionRpcId: 'rpc-q',
          outcome: 'answered',
        },
      }),
    ).toEqual({ type: 'hitl-resolved', kind: 'question', rpcId: 'rpc-q' });
  });

  it('returns null for unrelated session/event frames', () => {
    expect(
      mapMuxEnvelopeToStreamEvent({
        type: 'server-request',
        method: 'session/event',
        payload: { type: 'session/event', sessionId: 's', event: { type: 'turn/end' } },
      }),
    ).toBeNull();
  });
});

describe('validateQuestionAnswers', () => {
  const questions = [
    { id: 'q1', question: '单位？', options: [{ label: 'mm' }, { label: 'inch' }] },
  ];

  it('accepts a single selected option', () => {
    expect(validateQuestionAnswers(questions, [{ id: 'q1', selected: ['mm'] }])).toBe(true);
  });

  it('rejects selected+custom on single-select', () => {
    expect(
      validateQuestionAnswers(questions, [{ id: 'q1', selected: ['mm'], custom: 'other' }]),
    ).toBe(false);
  });

  it('rejects empty custom', () => {
    expect(validateQuestionAnswers(questions, [{ id: 'q1', selected: [], custom: '  ' }])).toBe(
      false,
    );
  });

  it('rejects unknown option labels', () => {
    expect(validateQuestionAnswers(questions, [{ id: 'q1', selected: ['px'] }])).toBe(false);
  });

  it('rejects mismatched ids or length', () => {
    expect(validateQuestionAnswers(questions, [{ id: 'q2', selected: ['mm'] }])).toBe(false);
    expect(validateQuestionAnswers(questions, [])).toBe(false);
  });

  it('allows custom plus selected on multi-select', () => {
    const multi = [{ id: 'q1', question: '选', options: [{ label: 'a' }, { label: 'b' }], multiSelect: true }];
    expect(
      validateQuestionAnswers(multi, [{ id: 'q1', selected: ['a'], custom: 'c' }]),
    ).toBe(true);
  });
});

describe('buildRespondEnvelope', () => {
  it('builds approval respond echoing rpcId', () => {
    expect(
      buildRespondEnvelope({
        kind: 'approval',
        rpcId: 'rpc-1',
        sessionId: 'sess-1',
        approvalId: 'appr-1',
        outcome: 'allowed-once',
      }),
    ).toEqual({
      type: 'client-response',
      rpcId: 'rpc-1',
      result: {
        ok: true,
        value: { sessionId: 'sess-1', approvalId: 'appr-1', outcome: 'allowed-once' },
      },
    });
  });

  it('builds question-cancel as cancelled error', () => {
    expect(buildRespondEnvelope({ kind: 'question-cancel', rpcId: 'rpc-q' })).toEqual({
      type: 'client-response',
      rpcId: 'rpc-q',
      result: { ok: false, error: { code: 'cancelled' } },
    });
  });

  it('builds question answers in order', () => {
    expect(
      buildRespondEnvelope({
        kind: 'question',
        rpcId: 'rpc-q',
        sessionId: 'sess-1',
        answer: { answers: [{ id: 'q1', selected: ['mm'] }] },
      }),
    ).toMatchObject({
      type: 'client-response',
      rpcId: 'rpc-q',
      result: { ok: true, value: { sessionId: 'sess-1' } },
    });
  });
});
