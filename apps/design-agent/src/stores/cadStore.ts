import type { CadModel } from '@da/cad-core';
import type { Group } from 'three';
import { create } from 'zustand';

interface CadState {
  /** 当前已加载并校验通过的 CAD 模型（2D 图纸） */
  model: CadModel | null;
  fileName: string | null;
  /** 当前 2D 图纸格式；无图纸时为 null */
  format: 'idoc' | 'cad-model' | null;
  /** IDoc 元素数量（仅 format === 'idoc' 时有意义） */
  docElementCount: number | null;
  /** GLTF/GLB 解析后的 3D 场景（瞬态引用，不持久化） */
  gltfScene: Group | null;
  gltfFileName: string | null;
  /** IDoc / bundle 原始 JSON，画布打开后交给 CadViewer.load */
  idocPayload: unknown | null;
  /** 输入框内待发送的 JSON 附件名（发送后清空，模型仍保留） */
  pendingJson: string | null;
  /** 输入框内待发送的 GLB 附件名 */
  pendingGltf: string | null;
  /** 画布中当前选中的元素 id（来自 elements 或 annotations） */
  selectedId: string | null;
  /** 右侧画布面板是否展开（上传不打开，首次发消息才打开） */
  canvasOpen: boolean;
  setModel: (model: CadModel, fileName: string, opts?: { pending?: boolean }) => void;
  setDocMeta: (
    fileName: string,
    opts?: { pending?: boolean; elementCount?: number },
    payload?: unknown,
  ) => void;
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
  remaining: {
    model: CadModel | null;
    gltfScene: Group | null;
    format?: 'idoc' | 'cad-model' | null;
  },
) {
  if (remaining.model || remaining.gltfScene || remaining.format === 'idoc') return canvasOpen;
  return false;
}

/** CAD 模型（2D 图纸）与 GLB 模型（3D 场景）可同时存在、互不影响；均来自用户上传，不持久化。 */
export const useCadStore = create<CadState>((set, get) => ({
  model: null,
  fileName: null,
  format: null,
  docElementCount: null,
  gltfScene: null,
  gltfFileName: null,
  idocPayload: null,
  pendingJson: null,
  pendingGltf: null,
  selectedId: null,
  canvasOpen: false,
  setModel: (model, fileName, opts) =>
    set({
      model,
      fileName,
      format: 'cad-model',
      docElementCount: null,
      idocPayload: null,
      selectedId: null,
      ...(opts?.pending ? { pendingJson: fileName } : {}),
    }),
  setDocMeta: (fileName, opts, payload) =>
    set({
      model: null,
      fileName,
      format: 'idoc',
      docElementCount: opts?.elementCount ?? null,
      idocPayload: payload ?? null,
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
      format: null,
      docElementCount: null,
      idocPayload: null,
      pendingJson: null,
      selectedId: null,
      canvasOpen: canvasOpenAfterClear(canvasOpen, { model: null, gltfScene }),
    });
  },
  clearPendingGltf: () => {
    const { model, canvasOpen, format } = get();
    set({
      gltfScene: null,
      gltfFileName: null,
      pendingGltf: null,
      selectedId: null,
      canvasOpen: canvasOpenAfterClear(canvasOpen, { model, gltfScene: null, format }),
    });
  },
  consumePendingAttachments: () => set({ pendingJson: null, pendingGltf: null }),
  clearModel: () =>
    set({
      model: null,
      fileName: null,
      format: null,
      docElementCount: null,
      idocPayload: null,
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
