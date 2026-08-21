import type { CadModel } from '@da/cad-core';
import type { Group } from 'three';
import { Cad2DViewer } from './Cad2DViewer';
import { Cad3DViewer } from './Cad3DViewer';

export interface CadViewerOptions {
  container: HTMLElement;
  /** 拾取结果回调：返回命中的元素 id 或 null（仅 2D 模式触发） */
  onSelect: (id: string | null) => void;
}

/**
 * 画布门面：按模型类型在 2D 渲染器（CAD 图纸）与 3D 渲染器（GLB 模型）之间切换，
 * 任一时刻只挂载一个渲染器（2D / 3D 互斥），对外保持统一的命令式 API。
 * 2D 与 3D 的渲染逻辑分别见 Cad2DViewer / Cad3DViewer。
 */
export class CadViewer {
  private readonly container: HTMLElement;
  private readonly onSelect: (id: string | null) => void;

  private mode: 'cad' | 'gltf' = 'cad';
  private viewer2d: Cad2DViewer | null = null;
  private viewer3d: Cad3DViewer | null = null;

  constructor({ container, onSelect }: CadViewerOptions) {
    this.container = container;
    this.onSelect = onSelect;
    this.viewer2d = new Cad2DViewer({ container, onSelect });
  }

  /** 进入/复用 2D 渲染器（销毁 3D 渲染器及其 DOM） */
  private ensure2D() {
    if (this.viewer2d) return;
    this.viewer3d?.dispose();
    this.viewer3d = null;
    this.mode = 'cad';
    this.viewer2d = new Cad2DViewer({ container: this.container, onSelect: this.onSelect });
  }

  /** 进入/复用 3D 渲染器（销毁 2D 渲染器及其 DOM） */
  private ensure3D() {
    if (this.viewer3d) return;
    this.viewer2d?.dispose();
    this.viewer2d = null;
    this.mode = 'gltf';
    this.viewer3d = new Cad3DViewer(this.container);
  }

  /** 加载 2D CAD 图纸并切到 2D 视角 */
  setModel(model: CadModel) {
    this.ensure2D();
    this.viewer2d!.setModel(model);
  }

  /** 加载 GLTF/GLB 3D 模型并切到 3D 视角 */
  setGltf(scene: Group) {
    this.ensure3D();
    this.viewer3d!.setGltf(scene);
  }

  /** 清空画布（保留 2D 网格底图，与旧行为一致） */
  clearModel() {
    this.viewer3d?.dispose();
    this.viewer3d = null;
    this.ensure2D();
    this.viewer2d!.clearModel();
  }

  /** 按当前模型的包围盒/包围球适配视图 */
  fitView() {
    if (this.mode === 'gltf') this.viewer3d?.fitView();
    else this.viewer2d?.fitView();
  }

  /** 切换选中高亮（仅 2D 图纸元素可拾取） */
  setSelected(id: string | null) {
    this.viewer2d?.setSelected(id);
  }

  dispose() {
    this.viewer2d?.dispose();
    this.viewer2d = null;
    this.viewer3d?.dispose();
    this.viewer3d = null;
  }
}
