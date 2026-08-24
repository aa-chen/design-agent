import type { IDocFile } from '@do-design/d-model';
import { isCadBundle, parseCadBundle } from '@da/cad-core';

type ElementFile = { _ctor_: string; [key: string]: unknown };

type BundleChunk = { raw?: ElementFile };

const IDENTITY_M4 = {
  type: 'm4',
  data: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
};

export type FitExtents = { minX: number; minY: number; maxX: number; maxY: number };

function hasElementId(doc: ElementFile[], id: number): boolean {
  return doc.some((e) => (e as { id?: { id?: number } }).id?.id === id);
}

/** 云看图 bundle 缺 CadDrawing / CadViewGroup，补最小父链供 d-model 建树与 regenerate。 */
function synthesizeBundleParents(bundle: Record<string, unknown>, doc: ElementFile[]): ElementFile[] {
  const stubs: ElementFile[] = [];
  const drawingId = bundle.drawingId;
  if (typeof drawingId !== 'number') return stubs;

  const view = bundle.view as { pid?: number } | undefined;
  const viewPid = typeof view?.pid === 'number' ? view.pid : undefined;

  if (!hasElementId(doc, drawingId)) {
    const model = parseCadBundle(bundle);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const extend = (p: number[]) => {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    };
    for (const el of model.elements) {
      if (el.layer === '辅助线') continue;
      if (el.type === 'line') {
        extend(el.from);
        extend(el.to);
      } else if (el.type === 'polyline') {
        for (const p of el.points) extend(p);
      } else if (el.type === 'arc') {
        for (let k = 0; k <= 16; k++) {
          const a = el.startAngle + ((el.endAngle - el.startAngle) * k) / 16;
          extend([
            el.center[0] + Math.cos(a) * el.radius,
            el.center[1] + Math.sin(a) * el.radius,
          ]);
        }
      }
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 420;
      maxY = 297;
    }

    stubs.push({
      _ctor_: 'CadDrawing',
      id: { id: drawingId },
      pid: -1,
      min: { type: 'v2', data: [minX, minY] },
      max: { type: 'v2', data: [maxX, maxY] },
      matrix: IDENTITY_M4,
      inVisibleFlag: 0,
      uuid: `drawing-${drawingId}`,
      projectType: 0,
    });
  }

  if (
    viewPid !== undefined &&
    viewPid !== drawingId &&
    !hasElementId(doc, viewPid)
  ) {
    stubs.push({
      _ctor_: 'CadViewGroup',
      id: { id: viewPid },
      pid: drawingId,
      treeNodeId: -1,
      uuid: `view-group-${viewPid}`,
      inVisibleFlag: 0,
    });
  }

  return stubs;
}

/** 用于 DocBackend.fitView 的图纸空间包围盒（与 parseCadBundle 一致）。 */
export function bundleFitExtents(bundle: unknown): FitExtents | null {
  if (!isCadBundle(bundle)) return null;
  const model = parseCadBundle(bundle);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const extend = (p: number[]) => {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  };
  for (const el of model.elements) {
    if (el.layer === '辅助线') continue;
    if (el.type === 'line') {
      extend(el.from);
      extend(el.to);
    } else if (el.type === 'polyline') {
      for (const p of el.points) extend(p);
    } else if (el.type === 'arc') {
      for (let k = 0; k <= 16; k++) {
        const a = el.startAngle + ((el.endAngle - el.startAngle) * k) / 16;
        extend([
          el.center[0] + Math.cos(a) * el.radius,
          el.center[1] + Math.sin(a) * el.radius,
        ]);
      }
    }
  }
  for (const ann of model.annotations) {
    if (ann.type === 'dimension') {
      extend(ann.from);
      extend(ann.to);
      extend(ann.offset);
    } else if (ann.type === 'text') {
      extend(ann.position);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * 云看图 bundle（geometry/view/dimensions + raw._ctor_）→ drawing-2d IDocFile（.pm）。
 * 供 DocBackend.loadDoc 使用，走 @do-design 渲染栈。
 */
export function bundleToIDocFile(bundle: unknown): IDocFile {
  if (!isCadBundle(bundle)) {
    throw new Error('不是有效的 CAD bundle（需要 geometry + view）');
  }

  const b = bundle as Record<string, unknown>;
  const doc: ElementFile[] = [];

  const view = b.view;
  if (view && typeof view === 'object' && (view as ElementFile)._ctor_) {
    doc.push(view as ElementFile);
  }

  const geometry = b.geometry as BundleChunk[] | undefined;
  if (Array.isArray(geometry)) {
    for (const chunk of geometry) {
      if (chunk?.raw?._ctor_) doc.push(chunk.raw);
    }
  }

  const dimensions = b.dimensions as BundleChunk[] | undefined;
  if (Array.isArray(dimensions)) {
    for (const dim of dimensions) {
      if (dim?.raw?._ctor_) doc.push(dim.raw);
    }
  }

  if (doc.length === 0) {
    throw new Error('bundle 中未找到可反序列化的 _ctor_ 元素');
  }

  const stubs = synthesizeBundleParents(b, doc);
  const fullDoc = [...stubs, ...doc];

  const viewTag = typeof b.viewTag === 'string' ? b.viewTag : 'view';
  const drawingId = b.drawingId ?? 'drawing';
  const caseId = typeof b.caseId === 'string' ? b.caseId : undefined;

  return {
    versionCode: 0,
    fileExtension: 'pm',
    documentName: `${drawingId} · ${viewTag}`,
    docUUID: caseId ?? `bundle-${String(drawingId)}`,
    documentType: 0,
    doc: fullDoc,
  };
}
