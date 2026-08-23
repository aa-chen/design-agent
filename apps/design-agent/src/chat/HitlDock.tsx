import { Button } from '@da/ui';
import { useMemo, useState } from 'react';
import { validateQuestionAnswers } from '../sse/hitl';
import type { HitlRespondPayload } from '../sse/types';
import type { PendingHitl } from '../stores/chatStore';

export function HitlDock({
  pending,
  onRespond,
}: {
  pending: PendingHitl;
  onRespond: (payload: HitlRespondPayload) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const submit = async (payload: HitlRespondPayload) => {
    if (busy) return;
    setBusy(true);
    try {
      await onRespond(payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`mb-2 rounded-2xl border bg-white px-4 py-3 shadow-sm ${
        pending.kind === 'approval' ? 'border-amber-300' : 'border-blue-200'
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: pending.kind === 'approval' ? '#d97706' : '#2563eb',
      }}
    >
      {pending.kind === 'approval' ? (
        <ApprovalCard pending={pending} busy={busy} onSubmit={submit} />
      ) : (
        <QuestionCard pending={pending} busy={busy} onSubmit={submit} />
      )}
      {pending.error && <p className="mt-2 text-xs text-red-600">{pending.error}</p>}
    </div>
  );
}

function ApprovalCard({
  pending,
  busy,
  onSubmit,
}: {
  pending: Extract<PendingHitl, { kind: 'approval' }>;
  busy: boolean;
  onSubmit: (payload: HitlRespondPayload) => Promise<void>;
}) {
  const respond = (outcome: 'allowed-once' | 'rejected') => {
    void onSubmit({
      kind: 'approval',
      rpcId: pending.rpcId,
      sessionId: pending.sessionId,
      approvalId: pending.approvalId,
      outcome,
    });
  };

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">需要批准</p>
      <p className="mt-1 text-sm font-medium text-gray-800">{pending.toolName}</p>
      {pending.reason && (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700">
          {pending.reason}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="primary" size="small" disabled={busy} onClick={() => respond('allowed-once')}>
          允许一次
        </Button>
        <Button size="small" disabled={busy} onClick={() => respond('rejected')}>
          拒绝
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  pending,
  busy,
  onSubmit,
}: {
  pending: Extract<PendingHitl, { kind: 'question' }>;
  busy: boolean;
  onSubmit: (payload: HitlRespondPayload) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, { selected: string[]; custom: string }>>(() =>
    Object.fromEntries(pending.questions.map((q) => [q.id, { selected: [], custom: '' }])),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const answers = useMemo(
    () =>
      pending.questions.map((q) => {
        const row = draft[q.id] ?? { selected: [], custom: '' };
        const custom = row.custom.trim();
        return custom
          ? { id: q.id, selected: row.selected, custom }
          : { id: q.id, selected: row.selected };
      }),
    [draft, pending.questions],
  );

  const toggle = (questionId: string, label: string, multi: boolean) => {
    setDraft((prev) => {
      const row = prev[questionId] ?? { selected: [], custom: '' };
      let selected: string[];
      if (multi) {
        selected = row.selected.includes(label)
          ? row.selected.filter((x) => x !== label)
          : [...row.selected, label];
      } else {
        selected = row.selected[0] === label ? [] : [label];
      }
      return { ...prev, [questionId]: { ...row, selected } };
    });
    setLocalError(null);
  };

  const handleSubmit = () => {
    if (!validateQuestionAnswers(pending.questions, answers)) {
      setLocalError('请完成所有问题后再提交');
      return;
    }
    void onSubmit({
      kind: 'question',
      rpcId: pending.rpcId,
      sessionId: pending.sessionId,
      answer: { answers },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {pending.questions.map((q) => {
        const row = draft[q.id] ?? { selected: [], custom: '' };
        const multi = q.multiSelect === true;
        return (
          <div key={q.id}>
            {q.header && (
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700">
                {q.header}
              </p>
            )}
            <p className="text-sm font-medium text-gray-800">{q.question}</p>
            {q.detail && <p className="mt-1 text-xs text-gray-500">{q.detail}</p>}
            {q.options && q.options.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {q.options.map((opt) => (
                  <label key={opt.label} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name={q.id}
                      checked={row.selected.includes(opt.label)}
                      onChange={() => toggle(q.id, opt.label, multi)}
                      className="mt-0.5"
                    />
                    <span>
                      {opt.label}
                      {opt.description && (
                        <span className="block text-xs text-gray-500">{opt.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <input
              type="text"
              value={row.custom}
              placeholder="其他（可选）"
              onChange={(e) => {
                const value = e.target.value;
                setDraft((prev) => ({
                  ...prev,
                  [q.id]: { ...(prev[q.id] ?? { selected: [], custom: '' }), custom: value },
                }));
                setLocalError(null);
              }}
              className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800 outline-none focus:border-blue-400"
            />
          </div>
        );
      })}
      {localError && <p className="text-xs text-red-600">{localError}</p>}
      <div>
        <Button type="primary" size="small" disabled={busy} onClick={handleSubmit}>
          提交
        </Button>
      </div>
    </div>
  );
}
