import { parseCadModel, type CadModel } from '@da/cad-core';
import { CadModelBackend } from './backends/CadModelBackend';
import type { DocBackend } from './backends/DocBackend';
import { detectFormat } from './detectFormat';
import { parseInput } from './parseInput';
import type { LoadResult, ViewerMeta } from './types';

export type CadViewerOptions = {
  container: HTMLElement;
  onSelect?: (id: string | null) => void;
};

type ActiveKind = 'cad-model' | 'idoc' | null;

/**
 * 统一只读 Viewer Facade。
 * CadModel 走 Three 后端（静态依赖）；IDocFile 动态加载 DocBackend，避免首屏拉全量 d-model。
 */
export class CadViewer {
  private readonly container: HTMLElement;
  private readonly onSelect?: (id: string | null) => void;
  private cadBackend: CadModelBackend | null = null;
  private docBackend: DocBackend | null = null;
  private active: ActiveKind = null;
  private lastModel: CadModel | null = null;

  constructor(options: CadViewerOptions) {
    this.container = options.container;
    this.onSelect = options.onSelect;
  }

  async load(input: string | object | File): Promise<LoadResult> {
    const parsed = await parseInput(input);
    if (!parsed.ok) return parsed;

    const format = detectFormat(parsed.json);
    if (format === 'unknown') {
      return { ok: false, error: '无法识别的 JSON 格式（既非 IDocFile 也非 CadModel）' };
    }

    if (format === 'idoc') {
      this.cadBackend?.dispose();
      this.cadBackend = null;
      this.lastModel = null;
      try {
        if (!this.docBackend) {
          const { DocBackend: DocBackendCtor } = await import('./backends/DocBackend');
          this.docBackend = new DocBackendCtor({
            container: this.container,
            onSelect: (id) => this.onSelect?.(id),
          });
        }
        await this.docBackend.loadJson(parsed.json);
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'IDocFile 加载失败',
        };
      }
      this.active = 'idoc';
      const docArr = (parsed.json as { doc?: unknown[] }).doc;
      return {
        ok: true,
        format: 'idoc',
        meta: {
          format: 'idoc',
          fileName: parsed.fileName,
          elementCount: Array.isArray(docArr) ? docArr.length : undefined,
        },
      };
    }

    const modelResult = parseCadModel(parsed.json);
    if (!modelResult.ok) {
      return { ok: false, error: `CadModel 校验失败：${modelResult.errors.slice(0, 3).join('；')}` };
    }

    this.disposeDocBackend();
    if (!this.cadBackend) {
      this.cadBackend = new CadModelBackend({
        container: this.container,
        onSelect: (id) => this.onSelect?.(id),
      });
    }
    this.cadBackend.setModel(modelResult.data);
    this.cadBackend.fitView();
    this.active = 'cad-model';
    this.lastModel = modelResult.data;

    const meta: ViewerMeta = {
      format: 'cad-model',
      fileName: parsed.fileName,
      elementCount: modelResult.data.elements.length,
    };
    return { ok: true, format: 'cad-model', meta };
  }

  fitView(): void {
    if (this.active === 'cad-model') this.cadBackend?.fitView();
    if (this.active === 'idoc') this.docBackend?.fitView();
  }

  setSelection(id: string | null): void {
    if (this.active === 'cad-model') this.cadBackend?.setSelected(id);
    if (this.active === 'idoc') this.docBackend?.setSelection(id);
  }

  setBackground(color: string): void {
    if (this.active === 'idoc') {
      this.docBackend?.setBackground(color);
      return;
    }
    this.cadBackend?.setBackground(color);
  }

  /** App 在 CadModel 路径下可取结构化模型写 store */
  getCadModel(): CadModel | null {
    return this.active === 'cad-model' ? this.lastModel : null;
  }

  clear(): void {
    this.cadBackend?.clearModel();
    this.disposeDocBackend();
    this.active = null;
    this.lastModel = null;
  }

  dispose(): void {
    this.cadBackend?.dispose();
    this.cadBackend = null;
    this.disposeDocBackend();
    this.active = null;
    this.lastModel = null;
  }

  private disposeDocBackend(): void {
    this.docBackend?.dispose();
    this.docBackend = null;
  }
}
