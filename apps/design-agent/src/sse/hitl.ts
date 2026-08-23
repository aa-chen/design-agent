import type {
  AskUserQuestionItem,
  HitlRespondPayload,
  StreamEvent,
} from './types';

export type MuxEnvelope = {
  type?: string;
  rpcId?: string;
  method?: string;
  payload?: Record<string, unknown>;
};

function frameKind(env: MuxEnvelope): string {
  const fromPayload = env.payload?.type;
  if (typeof fromPayload === 'string' && fromPayload) return fromPayload;
  return env.method ?? '';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asQuestions(value: unknown): AskUserQuestionItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items: AskUserQuestionItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return undefined;
    const row = raw as Record<string, unknown>;
    const id = asString(row.id);
    const question = asString(row.question);
    if (!id || !question) return undefined;
    const item: AskUserQuestionItem = { id, question };
    if (typeof row.detail === 'string') item.detail = row.detail;
    if (typeof row.header === 'string') item.header = row.header;
    if (row.multiSelect === true) item.multiSelect = true;
    if (Array.isArray(row.options)) {
      item.options = row.options.flatMap((opt) => {
        if (!opt || typeof opt !== 'object') return [];
        const label = asString((opt as { label?: unknown }).label);
        if (!label) return [];
        const description = asString((opt as { description?: unknown }).description);
        return description ? [{ label, description }] : [{ label }];
      });
    }
    items.push(item);
  }
  return items;
}

export function mapMuxEnvelopeToStreamEvent(env: MuxEnvelope): StreamEvent | null {
  if (env.type && env.type !== 'server-request') return null;
  const kind = frameKind(env);
  const payload = env.payload ?? {};

  if (kind === 'approval/requested') {
    const rpcId = asString(env.rpcId);
    const sessionId = asString(payload.sessionId);
    const approvalId = asString(payload.approvalId);
    const toolName = asString(payload.toolName);
    if (!rpcId || !sessionId || !approvalId || !toolName) return null;
    const event: Extract<StreamEvent, { type: 'approval' }> = {
      type: 'approval',
      rpcId,
      sessionId,
      approvalId,
      toolName,
    };
    const callId = asString(payload.callId);
    const reason = asString(payload.reason);
    if (callId) event.callId = callId;
    if (reason) event.reason = reason;
    return event;
  }

  if (kind === 'question/requested') {
    const rpcId = asString(env.rpcId);
    const sessionId = asString(payload.sessionId);
    const questions = asQuestions(payload.questions);
    if (!rpcId || !sessionId || !questions) return null;
    return { type: 'question', rpcId, sessionId, questions };
  }

  if (kind === 'approval/resolved') {
    const approvalId = asString(payload.approvalId);
    if (!approvalId) return null;
    return { type: 'hitl-resolved', kind: 'approval', approvalId };
  }

  if (kind === 'question/resolved') {
    const rpcId = asString(payload.questionRpcId);
    if (!rpcId) return null;
    return { type: 'hitl-resolved', kind: 'question', rpcId };
  }

  return null;
}

export function validateQuestionAnswers(
  questions: AskUserQuestionItem[],
  answers: Array<{ id: string; selected: string[]; custom?: string }>,
): boolean {
  if (answers.length !== questions.length) return false;
  return answers.every((answer, index) => {
    const question = questions[index];
    if (!question || answer.id !== question.id) return false;
    if (new Set(answer.selected).size !== answer.selected.length) return false;
    const custom = answer.custom?.trim();
    if (answer.custom !== undefined && custom === '') return false;
    if (question.multiSelect !== true) {
      if (custom !== undefined && answer.selected.length > 0) return false;
      if (answer.selected.length > 1) return false;
    }
    const labels = new Set(question.options?.map((option) => option.label) ?? []);
    return answer.selected.every((label) => labels.has(label));
  });
}

export function buildRespondEnvelope(payload: HitlRespondPayload): Record<string, unknown> {
  if (payload.kind === 'question-cancel') {
    return {
      type: 'client-response',
      rpcId: payload.rpcId,
      result: { ok: false, error: { code: 'cancelled' } },
    };
  }
  if (payload.kind === 'approval') {
    return {
      type: 'client-response',
      rpcId: payload.rpcId,
      result: {
        ok: true,
        value: {
          sessionId: payload.sessionId,
          approvalId: payload.approvalId,
          outcome: payload.outcome,
        },
      },
    };
  }
  return {
    type: 'client-response',
    rpcId: payload.rpcId,
    result: {
      ok: true,
      value: {
        sessionId: payload.sessionId,
        answer: payload.answer,
      },
    },
  };
}
