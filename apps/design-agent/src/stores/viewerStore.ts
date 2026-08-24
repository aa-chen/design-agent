import { create } from 'zustand';
import type { Cad3DViewer } from '../canvas/Cad3DViewer';

interface ViewerState {
  /** 3D 渲染器实例（瞬态引用，不持久化） */
  viewer3d: Cad3DViewer | null;
  register3d: (viewer: Cad3DViewer) => void;
  unregister3d: (viewer: Cad3DViewer) => void;
}

/** 持有 3D 渲染器实例，供非画布组件（如上传按钮）触发命令式操作。 */
export const useViewerStore = create<ViewerState>((set) => ({
  viewer3d: null,
  register3d: (viewer) => set({ viewer3d: viewer }),
  unregister3d: (viewer) =>
    set((state) => (state.viewer3d === viewer ? { viewer3d: null } : state)),
}));
