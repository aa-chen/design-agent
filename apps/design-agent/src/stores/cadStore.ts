import type { CadModel } from '@da/cad-core';
import type { Group } from 'three';
import { create } from 'zustand';

interface CadState {
  /** 当前已解析的 CAD 模型（供聊天上下文；不在画布渲染） */
  model: CadModel | null;
  fileName: string | null;
  /** GLTF/GLB 解析后的 3D 场景（瞬态引用，不持久化） */
  gltfScene: Group | null;
  gltfFileName: string | null;
  /** 输入框内待发送的 JSON 附件名（发送后清空，模型仍保留） */
  pendingJson: string | null;
  /** 输入框内待发送的 GLB 附件名 */
  pendingGltf: string | null;
  /** 右侧画布面板是否展开（上传不打开，首次发消息且有 3D 模型才打开） */
  canvasOpen: boolean;
  setModel: (model: CadModel, fileName: string, opts?: { pending?: boolean }) => void;
  setGltf: (scene: Group, fileName: string, opts?: { pending?: boolean }) => void;
  /** 删除输入区 JSON 芯片：连带清除已加载的 CAD 模型 */
  clearPendingJson: () => void;
  /** 删除输入区 GLB 芯片：连带清除已加载的 3D 场景 */
  clearPendingGltf: () => void;
  /** 发送成功后清空输入区芯片（模型保留供画布/上下文使用） */
  consumePendingAttachments: () => void;
  clearGltf: () => void;
  clearModel: () => void;
  openCanvas: () => void;
  closeCanvas: () => void;
}

/** CAD 模型（聊天附件）与 GLB 模型（3D 场景）可同时存在；均来自用户上传，不持久化。 */
export const useCadStore = create<CadState>((set) => ({
  model: null,
  fileName: null,
  gltfScene: null,
  gltfFileName: null,
  pendingJson: null,
  pendingGltf: null,
  canvasOpen: false,
  setModel: (model, fileName, opts) =>
    set({
      model,
      fileName,
      ...(opts?.pending ? { pendingJson: fileName } : {}),
    }),
  setGltf: (gltfScene, gltfFileName, opts) =>
    set({
      gltfScene,
      gltfFileName,
      ...(opts?.pending ? { pendingGltf: gltfFileName } : {}),
    }),
  clearPendingJson: () =>
    set({
      model: null,
      fileName: null,
      pendingJson: null,
    }),
  clearPendingGltf: () =>
    set({
      gltfScene: null,
      gltfFileName: null,
      pendingGltf: null,
      canvasOpen: false,
    }),
  consumePendingAttachments: () => set({ pendingJson: null, pendingGltf: null }),
  clearGltf: () =>
    set({
      gltfScene: null,
      gltfFileName: null,
      pendingGltf: null,
      canvasOpen: false,
    }),
  clearModel: () =>
    set({
      model: null,
      fileName: null,
      gltfScene: null,
      gltfFileName: null,
      pendingJson: null,
      pendingGltf: null,
      canvasOpen: false,
    }),
  openCanvas: () => set({ canvasOpen: true }),
  closeCanvas: () => set({ canvasOpen: false }),
}));
