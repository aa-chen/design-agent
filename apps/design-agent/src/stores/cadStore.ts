import type { CadModel } from '@da/cad-core';
import type { Group } from 'three';
import { create } from 'zustand';

interface CadState {
  /** 当前已加载并校验通过的 CAD 模型（2D 图纸） */
  model: CadModel | null;
  fileName: string | null;
  /** GLTF/GLB 解析后的 3D 场景（瞬态引用，不持久化） */
  gltfScene: Group | null;
  gltfFileName: string | null;
  /** 画布中当前选中的元素 id（来自 elements 或 annotations） */
  selectedId: string | null;
  setModel: (model: CadModel, fileName: string) => void;
  setGltf: (scene: Group, fileName: string) => void;
  clearModel: () => void;
  select: (id: string | null) => void;
}

/** CAD 模型（2D 图纸）与 GLB 模型（3D 场景）互斥；均来自用户上传，不持久化。 */
export const useCadStore = create<CadState>((set) => ({
  model: null,
  fileName: null,
  gltfScene: null,
  gltfFileName: null,
  selectedId: null,
  setModel: (model, fileName) =>
    set({ model, fileName, gltfScene: null, gltfFileName: null, selectedId: null }),
  setGltf: (gltfScene, gltfFileName) =>
    set({ gltfScene, gltfFileName, model: null, fileName: null, selectedId: null }),
  clearModel: () =>
    set({ model: null, fileName: null, gltfScene: null, gltfFileName: null, selectedId: null }),
  select: (id) => set({ selectedId: id }),
}));
