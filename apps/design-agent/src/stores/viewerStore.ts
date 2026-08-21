import { create } from 'zustand';
import type { CadViewer } from '../canvas/CadViewer';

interface ViewerState {
  /** 当前挂载的 CadViewer 实例（瞬态引用，不持久化） */
  viewer: CadViewer | null;
  register: (viewer: CadViewer) => void;
  unregister: (viewer: CadViewer) => void;
}

/** 持有画布渲染器实例，供非画布组件（如上传按钮）触发命令式操作。 */
export const useViewerStore = create<ViewerState>((set) => ({
  viewer: null,
  register: (viewer) => set({ viewer }),
  unregister: (viewer) =>
    set((state) => (state.viewer === viewer ? { viewer: null } : state)),
}));
