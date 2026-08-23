import CadCanvas from '../canvas/CadCanvas';
import ChatPanel from '../chat/ChatPanel';
import SessionList from '../sidebar/SessionList';
import { useCadStore } from '../stores/cadStore';

/** 三栏布局：左-会话历史 | 中-AI 对话 | 右-CAD 画布（首次发消息后从右向左滑入） */
export default function AppLayout() {
  const canvasOpen = useCadStore((s) => s.canvasOpen);

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[var(--bg-base)]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)]">
        <SessionList />
      </aside>
      <main
        className={`flex min-w-0 flex-1 flex-col bg-[var(--bg-base)] transition-[padding] duration-300 ease-out ${
          canvasOpen ? 'border-r border-[var(--border)] pr-2' : ''
        }`}
      >
        <ChatPanel canvasOpen={canvasOpen} />
      </main>
      {/* 占位：打开时把对话区挤窄，与面板滑入同步 */}
      <div
        className={`shrink-0 transition-[width] duration-300 ease-out ${
          canvasOpen ? 'w-[45%]' : 'w-0'
        }`}
        aria-hidden
      />
      <section
        aria-hidden={!canvasOpen}
        className={`absolute right-0 top-0 flex h-full w-[45%] flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] transition-transform duration-300 ease-out ${
          canvasOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full border-transparent'
        }`}
      >
        {canvasOpen && <CadCanvas />}
      </section>
    </div>
  );
}
