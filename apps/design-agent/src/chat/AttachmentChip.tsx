import { CloseOutlined, FileOutlined } from '@ant-design/icons';

/** 输入框内待发送文件芯片（可删除，删除时连带清除模型） */
export function AttachmentChip({
  name,
  kind,
  onRemove,
}: {
  name: string;
  kind: 'json' | 'glb';
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]">
      <FileOutlined className="text-[var(--text-secondary)]" />
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className="shrink-0 text-[var(--text-muted)]">{kind === 'json' ? 'JSON' : 'GLB'}</span>
      <button
        type="button"
        aria-label={`移除 ${name}`}
        className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        onClick={onRemove}
      >
        <CloseOutlined className="text-[10px]" />
      </button>
    </div>
  );
}
