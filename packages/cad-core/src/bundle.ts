import type {
  Annotation,
  CadElement,
  CadModel,
  CadPart,
  DimensionAnnotation,
  Vec3,
} from './types';

/**
 * 云看图（dodoc）导出 bundle 格式解析器。
 *
 * bundle 结构：
 * ```json
 * {
 *   "drawingId": 8357,
 *   "viewTag": "KxBV6LDd",
 *   "view": { "min": v2, "max": v2, "matrix": m4, ... },
 *   "geometry": [ { "id", "ctor", "raw": { "datas": [...], "matrix": m4, "layer": "...", ... } }, ... ],
 *   "dimensions": [ { "raw": { "xLine1Point": v3, "xLine2Point": v3, "dimLinePoint": v3, ... } }, ... ],
 *   "annotations": [],
 *   "stats": {}
 * }
 * ```
 *
 * 坐标约定：各 chunk/dimension 内是视图局部坐标，`raw.matrix`（m4，第 4 行为平移）
 * 将局部坐标映射到图纸（sheet）空间；所有元素统一应用该平移后即为一致的 2D 图纸坐标。
 * 弧的角度为**度**，内部模型使用弧度，此处做转换。
 */

const DEG = Math.PI / 180;

interface BundleMatrix {
  type?: string;
  data?: number[][];
}

interface BundleUserData {
  uuid?: string;
  groupIdList?: string[];
}

interface BundleDataItem {
  type?: string;
  /** CadLines / CadGridLine */
  start?: number[];
  end?: number[];
  /** CadPolylines */
  vertexes?: number[][];
  /** CadArcs / CadHoles */
  center?: number[];
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  feature?: { basicType?: string };
  userData?: BundleUserData;
}

/** 取 m4 矩阵的平移分量（视图局部 → 图纸空间） */
function matrixTranslation(m?: BundleMatrix): [number, number] {
  const row = m?.data?.[3];
  if (!row || row.length < 2) return [0, 0];
  return [row[0] ?? 0, row[1] ?? 0];
}

/**
 * 图层名归一化：导出端图层名（"0"、虚线、双点划线、中心线、JEE-DIM标注…）
 * 映射为内部语义图层名，供导出与后续渲染配色/线型使用。
 */
export function normalizeLayer(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const n = name.trim();
  if (n === '0') return '0';
  if (n.includes('双点划线')) return '双点划线';
  if (n.includes('中心线')) return '中心线';
  if (n.includes('虚线')) return '虚线';
  if (n.includes('DIM') || n.includes('标注')) return '尺寸';
  return n;
}

/** 是否虚线：隐藏线投影，或虚线/双点划线/中心线图层 */
function isDashed(basicType: string | undefined, layer: string | undefined): boolean {
  if (basicType === 'HIDDEN_LINE') return true;
  return layer === '虚线' || layer === '双点划线' || layer === '中心线';
}

function toVec3(x: number, y: number, tx: number, ty: number): Vec3 {
  return [x + tx, y + ty, 0];
}

function elementId(item: BundleDataItem, chunkId: number, index: number): string {
  return item.userData?.uuid ?? `${chunkId}-${index}`;
}

/** 将单个 datas 条目转换为内部元素（line / polyline / arc） */
function buildElementFromData(
  item: BundleDataItem,
  chunkId: number,
  index: number,
  tx: number,
  ty: number,
): CadElement | null {
  const id = elementId(item, chunkId, index);
  switch (item.type) {
    case 'line': {
      const s = item.start;
      const e = item.end;
      if (!s || !e) return null;
      return {
        type: 'line',
        id,
        from: toVec3(s[0], s[1], tx, ty),
        to: toVec3(e[0], e[1], tx, ty),
      };
    }
    case 'polyline': {
      const vs = item.vertexes;
      if (!vs || vs.length < 2) return null;
      return {
        type: 'polyline',
        id,
        points: vs.map((p) => toVec3(p[0], p[1], tx, ty)),
        closed: false,
      };
    }
    case 'arc': {
      const c = item.center;
      if (!c || typeof item.radius !== 'number') return null;
      const start = item.startAngle ?? 0;
      const end = item.endAngle ?? 360;
      return {
        type: 'arc',
        id,
        center: toVec3(c[0], c[1], tx, ty),
        radius: item.radius,
        startAngle: start * DEG,
        endAngle: end * DEG,
      };
    }
    default:
      return null;
  }
}

function attachLayer(
  el: CadElement,
  layer: string | undefined,
  basicType: string | undefined,
): CadElement {
  el.layer = layer;
  el.lineStyle = isDashed(basicType, layer) ? 'dashed' : 'solid';
  return el;
}

/** 尺寸标注：对齐尺寸由两条延伸线端点 + 尺寸线位置点描述 */
function buildDimensionAnnotation(
  raw: Record<string, unknown>,
  index: number,
): DimensionAnnotation | null {
  const [tx, ty] = matrixTranslation(raw.matrix as BundleMatrix | undefined);
  const x1 = (raw.xLine1Point as { data?: number[] } | undefined)?.data;
  const x2 = (raw.xLine2Point as { data?: number[] } | undefined)?.data;
  const dp = (raw.dimLinePoint as { data?: number[] } | undefined)?.data;
  if (!x1 || !x2 || !dp) return null;

  const from: Vec3 = [x1[0] + tx, x1[1] + ty, 0];
  const to: Vec3 = [x2[0] + tx, x2[1] + ty, 0];
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const offset: Vec3 = [dp[0] + tx - mid[0], dp[1] + ty - mid[1], 0];

  const dimScale = typeof raw.dimScale === 'number' && raw.dimScale > 0 ? raw.dimScale : 1;
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const value = dist / dimScale;

  const override = raw.override as
    | { text?: { dimdec?: number; dimdsep?: string; dimtxt?: number } }
    | undefined;
  const dec = override?.text?.dimdec ?? 2;
  const sep = override?.text?.dimdsep ?? '.';
  const text = value.toFixed(dec).replace('.', sep);

  const dimtxt = override?.text?.dimtxt ?? 3.5;
  const textHeight = dimtxt * dimScale;

  const uuid = typeof raw.uuid === 'string' ? raw.uuid : `dim-${index}`;
  const layer = normalizeLayer(typeof raw.layer === 'string' ? raw.layer : undefined);
  return { type: 'dimension', id: uuid, from, to, offset, text, textHeight, layer };
}

/** 判断输入是否为云看图 bundle（而非内部 CadModel） */
export function isCadBundle(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return (
    Array.isArray(obj.geometry) &&
    typeof obj.view === 'object' &&
    obj.view !== null
  );
}

/**
 * 将云看图 bundle 转换为内部 CadModel。
 * @throws 输入不是合法 bundle 时抛出 Error
 */
export function parseCadBundle(input: unknown): CadModel {
  if (!isCadBundle(input)) {
    throw new Error('不是有效的 CAD bundle 数据（缺少 geometry/view 字段）');
  }
  const bundle = input as Record<string, unknown>;
  const geometry = bundle.geometry as Array<Record<string, unknown>>;
  const view = bundle.view as Record<string, unknown>;

  const elements: CadElement[] = [];
  const groupRefs = new Map<string, string[]>(); // groupId -> element ids
  const seenIds = new Set<string>(); // 同一实体可能投影到多个 chunk，去重以保证每个元素可独立拾取

  const addToGroup = (groupId: string | undefined, id: string) => {
    if (!groupId) return;
    const list = groupRefs.get(groupId);
    if (list) list.push(id);
    else groupRefs.set(groupId, [id]);
  };

  /** 同一 uuid 在多个 chunk 出现时追加序号，保证元素 id 唯一 */
  const uniqueId = (base: string) => {
    if (!seenIds.has(base)) {
      seenIds.add(base);
      return base;
    }
    let i = 2;
    while (seenIds.has(`${base}#${i}`)) i++;
    const id = `${base}#${i}`;
    seenIds.add(id);
    return id;
  };

  for (const chunk of geometry) {
    const raw = (chunk?.raw ?? {}) as Record<string, unknown>;
    if (raw.inVisibleFlag) continue;
    const [tx, ty] = matrixTranslation(raw.matrix as BundleMatrix | undefined);
    const layer = normalizeLayer(typeof raw.layer === 'string' ? raw.layer : undefined);

    // 网格辅助线（CadGridLine：start/end 为 v3 对象 { type:'v3', data:[x,y,z] }）
    const gs = raw.start as { data?: number[] } | undefined;
    const ge = raw.end as { data?: number[] } | undefined;
    if (raw.type === 'line' && gs && ge && Array.isArray(gs.data) && Array.isArray(ge.data)) {
      const el: CadElement = {
        type: 'line',
        id: `grid-${chunk.id}`,
        from: toVec3(gs.data[0], gs.data[1], tx, ty),
        to: toVec3(ge.data[0], ge.data[1], tx, ty),
      };
      elements.push(attachLayer(el, '辅助线', 'GRID_LINE'));
      continue;
    }

    // 常规几何：datas 数组
    const datas = Array.isArray(raw.datas) ? (raw.datas as BundleDataItem[]) : [];
    for (let i = 0; i < datas.length; i++) {
      const item = datas[i];
      if (typeof item !== 'object' || item === null) continue;
      const el = buildElementFromData(item, Number(chunk.id) || 0, i, tx, ty);
      if (!el) continue;
      el.id = uniqueId(el.id);
      attachLayer(el, layer, item.feature?.basicType);
      elements.push(el);
      addToGroup(item.userData?.groupIdList?.[0], el.id);
    }
  }

  // 尺寸标注
  const annotations: Annotation[] = [];
  const dimensions = Array.isArray(bundle.dimensions)
    ? (bundle.dimensions as Array<{ raw?: Record<string, unknown> }>)
    : [];
  for (let i = 0; i < dimensions.length; i++) {
    const ann = buildDimensionAnnotation(dimensions[i]?.raw ?? {}, i);
    if (ann) annotations.push(ann);
  }

  // 零件分组（按 groupIdList 聚合元素）
  const parts: CadPart[] = [...groupRefs.entries()].map(([groupId, elementIds], i) => ({
    id: groupId,
    name: `组 ${i + 1}`,
    elementIds,
  }));

  const tag =
    typeof bundle.viewTag === 'string'
      ? bundle.viewTag
      : typeof view.tag === 'string'
        ? view.tag
        : 'view';
  const name = `${bundle.drawingId ?? 'drawing'} · ${tag}`;

  return {
    version: 'bundle-1',
    name,
    unit: 'mm',
    parts,
    elements,
    annotations,
  };
}
