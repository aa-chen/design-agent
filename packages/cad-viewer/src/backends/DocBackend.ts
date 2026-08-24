import {
  createApp,
  DocumentManager,
  FileUtil,
  JsonUtil,
  type IApp,
  type IDocFile,
  type ISysWindow,
} from '@do-design/d-model';
import { EN_RENDER_TYPE } from '@do-design/d-render';

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

    let docFile: IDocFile | undefined;
    if (typeof json === 'string') {
      docFile = FileUtil.parse(json);
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
    await DocumentManager.getInstance().loadDoc(doc, docFile);
    doc.updateView();
  }

  fitView(): void {
    const renderView = this.view?.getRenderView?.();
    void renderView;
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
  }
}
