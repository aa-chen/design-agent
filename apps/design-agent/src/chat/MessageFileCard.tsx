import { FileOutlined } from '@ant-design/icons';
import type { ChatAttachment } from '../sse/types';
import { useCadStore } from '../stores/cadStore';

/** 消息下方的文件卡片：点击打开 / 恢复画布 */
export function MessageFileCard({ attachment }: { attachment: ChatAttachment }) {
  const open = () => {
    const cad = useCadStore.getState();
    if (attachment.kind === 'json' && attachment.model) {
      cad.setModel(attachment.model, attachment.name, { pending: false });
      return;
    }
    cad.openCanvas();
  };

  return (
    <button
      type="button"
      onClick={open}
      className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-xs text-[var(--text-primary)] shadow-sm transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
    >
      <FileOutlined className="text-[var(--text-secondary)]" />
      <span className="min-w-0 truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 text-[var(--text-muted)]">
        {attachment.kind === 'json' ? 'JSON' : 'GLB · 打开画布'}
      </span>
    </button>
  );
}
