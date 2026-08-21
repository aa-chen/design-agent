import CadCanvas from '../canvas/CadCanvas';
import ChatPanel from '../chat/ChatPanel';
import SessionList from '../sidebar/SessionList';
import { useCadStore } from '../stores/cadStore';

/** 三栏布局：左-会话历史 | 中-AI 对话 | 右-CAD 画布（加载 CAD 或 GLB 模型后显示） */
export default function AppLayout() {
  const hasModel = useCadStore((s) => !!(s.model || s.gltfScene));
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <SessionList />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatPanel />
      </main>
      {hasModel && (
        <section className="flex w-[45%] shrink-0 flex-col border-l border-gray-200 bg-white">
          <CadCanvas />
        </section>
      )}
    </div>
  );
}
