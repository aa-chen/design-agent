import { create } from 'zustand';
import type { Cad2DViewer } from '../canvas/Cad2DViewer';
import type { Cad3DViewer } from '../canvas/Cad3DViewer';

interface ViewerState {
  /** 2D 渲染器实例（瞬态引用，不持久化） */
  viewer2d: Cad2DViewer | null;
  /** 3D 渲染器实例（瞬态引用，不持久化） */
  viewer3d: Cad3DViewer | null;
  register2d: (viewer: Cad2DViewer) => void;
  unregister2d: (viewer: Cad2DViewer) => void;
  register3d: (viewer: Cad3DViewer) => void;
  unregister3d: (viewer: Cad3DViewer) => void;
}

/** 持有 2D / 3D 两个渲染器实例，供非画布组件（如上传按钮）触发命令式操作。 */
export const useViewerStore = create<ViewerState>((set) => ({
  viewer2d: null,
  viewer3d: null,
  register2d: (viewer) => set({ viewer2d: viewer }),
  unregister2d: (viewer) =>
    set((state) => (state.viewer2d === viewer ? { viewer2d: null } : state)),
  register3d: (viewer) => set({ viewer3d: viewer }),
  unregister3d: (viewer) =>
    set((state) => (state.viewer3d === viewer ? { viewer3d: null } : state)),
}));
