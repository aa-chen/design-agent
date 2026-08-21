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
  /** 输入框内待发送的 JSON 附件名（发送后清空，模型仍保留） */
  pendingJson: string | null;
  /** 输入框内待发送的 GLB 附件名 */
  pendingGltf: string | null;
  /** 画布中当前选中的元素 id（来自 elements 或 annotations） */
  selectedId: string | null;
  /** 右侧画布面板是否展开（上传不打开，首次发消息才打开） */
  canvasOpen: boolean;
  setModel: (model: CadModel, fileName: string, opts?: { pending?: boolean }) => void;
  setGltf: (scene: Group, fileName: string, opts?: { pending?: boolean }) => void;
  /** 删除输入区 JSON 芯片：连带清除已加载的 2D 模型 */
  clearPendingJson: () => void;
  /** 删除输入区 GLB 芯片：连带清除已加载的 3D 场景 */
  clearPendingGltf: () => void;
  /** 发送成功后清空输入区芯片（模型保留供画布使用） */
  consumePendingAttachments: () => void;
  clearModel: () => void;
  openCanvas: () => void;
  closeCanvas: () => void;
  select: (id: string | null) => void;
}

function canvasOpenAfterClear(
  canvasOpen: boolean,
  remaining: { model: CadModel | null; gltfScene: Group | null },
) {
  if (remaining.model || remaining.gltfScene) return canvasOpen;
  return false;
}

/** CAD 模型（2D 图纸）与 GLB 模型（3D 场景）可同时存在、互不影响；均来自用户上传，不持久化。 */
export const useCadStore = create<CadState>((set, get) => ({
  model: null,
  fileName: null,
  gltfScene: null,
  gltfFileName: null,
  pendingJson: null,
  pendingGltf: null,
  selectedId: null,
  canvasOpen: false,
  setModel: (model, fileName, opts) =>
    set({
      model,
      fileName,
      selectedId: null,
      ...(opts?.pending ? { pendingJson: fileName } : {}),
    }),
  setGltf: (gltfScene, gltfFileName, opts) =>
    set({
      gltfScene,
      gltfFileName,
      selectedId: null,
      ...(opts?.pending ? { pendingGltf: gltfFileName } : {}),
    }),
  clearPendingJson: () => {
    const { gltfScene, canvasOpen } = get();
    set({
      model: null,
      fileName: null,
      pendingJson: null,
      selectedId: null,
      canvasOpen: canvasOpenAfterClear(canvasOpen, { model: null, gltfScene }),
    });
  },
  clearPendingGltf: () => {
    const { model, canvasOpen } = get();
    set({
      gltfScene: null,
      gltfFileName: null,
      pendingGltf: null,
      selectedId: null,
      canvasOpen: canvasOpenAfterClear(canvasOpen, { model, gltfScene: null }),
    });
  },
  consumePendingAttachments: () => set({ pendingJson: null, pendingGltf: null }),
  clearModel: () =>
    set({
      model: null,
      fileName: null,
      gltfScene: null,
      gltfFileName: null,
      pendingJson: null,
      pendingGltf: null,
      selectedId: null,
      canvasOpen: false,
    }),
  openCanvas: () => set({ canvasOpen: true }),
  closeCanvas: () => set({ canvasOpen: false }),
  select: (id) => set({ selectedId: id }),
}));
