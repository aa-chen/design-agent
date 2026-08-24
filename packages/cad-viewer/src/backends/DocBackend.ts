import { isCadBundle } from '@da/cad-core';
import {
  createApp,
  DocSaver,
  FileUtil,
  JsonUtil,
  type IApp,
  type IDocFile,
  type ISysWindow,
} from '@do-design/d-model';
import { EN_RENDER_TYPE } from '@do-design/d-render';
import { bundleFitExtents, bundleToIDocFile, type FitExtents } from '../converters/bundleToIDocFile';

export type DocBackendOptions = {
  container: HTMLElement;
  onSelect?: (id: string | null) => void;
};

/**
 * drawing-2d 同源只读打开：createApp → createView(DRAWING_2D) → loadDoc。
 */
export class DocBackend {
  private readonly container: HTMLElement;
  private readonly onSelect?: (id: string | null) => void;
  private app: IApp | null = null;
  private view: ISysWindow | null = null;
  private started = false;
  private fitExtents: FitExtents | null = null;

  constructor(options: DocBackendOptions) {
    this.container = options.container;
    this.onSelect = options.onSelect;
  }

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    const { registerCadKernel } = await import('../bootstrap/registerCadKernel');
    registerCadKernel();
    this.app = createApp({ id: 'da-cad-viewer', enableIndexedDB: false });
    await this.app.start();
    this.view = this.app.createView(
      'da-cad-view',
      this.container as HTMLDivElement,
      {
        quadtreeOption: { enablePrepickQuery: true },
        depthPick: true,
        maxPickLayers: 10,
        frustumCulling: true,
      },
      EN_RENDER_TYPE.DRAWING_2D,
    );
    this.started = true;
    void this.onSelect;
  }

  async loadJson(json: unknown): Promise<void> {
    await this.ensureStarted();
    if (!this.view) throw new Error('DocBackend view 未创建');

    this.fitExtents = isCadBundle(json) ? bundleFitExtents(json) : null;

    let docFile: IDocFile | undefined;
    if (typeof json === 'string') {
      docFile = FileUtil.parse(json);
    } else if (isCadBundle(json)) {
      docFile = bundleToIDocFile(json);
    } else {
      const packedOrObj = json as IDocFile;
      if (packedOrObj.fileExtension === 'pm' && Array.isArray(packedOrObj.doc)) {
        docFile = packedOrObj;
      } else {
        docFile = FileUtil.parse(JsonUtil.stringify(json as object));
      }
    }
    if (!docFile) {
      throw new Error('IDocFile 解析失败（需要 fileExtension: "pm"）');
    }

    const doc = this.view.getDocument();
    const saver = new DocSaver(doc);
    const ok = await saver.load(docFile);
    if (!ok) {
      throw new Error('图纸反序列化或重算失败（见浏览器控制台）');
    }
    doc.updateView();

    const renderView = this.view.getRenderView?.();
    if (renderView) {
      const w = this.container.clientWidth || 1;
      const h = this.container.clientHeight || 1;
      renderView.onResize(w, h);
      renderView.render();
    }
  }

  fitView(): void {
    if (!this.view) return;
    const renderView = this.view.getRenderView?.();
    if (!renderView || !this.fitExtents) return;

    const size = this.view.getSize?.();
    const viewW = size?.x ?? this.container.clientWidth ?? 1;
    const viewH = size?.y ?? this.container.clientHeight ?? 1;
    const { minX, minY, maxX, maxY } = this.fitExtents;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const extW = Math.max(maxX - minX, 1);
    const extH = Math.max(maxY - minY, 1);
    const zoom = Math.min(viewW / extW, viewH / extH) * 0.85;

    renderView.resetViewDirection(
      { x: cx, y: cy, z: 1 },
      { x: cx, y: cy, z: 0 },
      { x: 0, y: 1, z: 0 },
      zoom,
    );
    renderView.render();
  }

  setSelection(_id: string | null): void {}

  setBackground(_color: string): void {}

  dispose(): void {
    if (this.app && this.view) {
      try {
        this.app.destroyView('da-cad-view');
      } catch {
        // ignore
      }
    }
    this.view = null;
    this.app = null;
    this.started = false;
    this.fitExtents = null;
  }
}
