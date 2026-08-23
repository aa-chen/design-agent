import { CloseOutlined } from '@ant-design/icons';
import type { CadModel, Vec3 } from '@da/cad-core';
import { useCadStore } from '../stores/cadStore';

interface Row {
  label: string;
  value: string;
}

const fmtVec = (p: Vec3) => {
  const n = (x: number) => (Math.round(x * 100) / 100).toString();
  return `(${n(p[0])}, ${n(p[1])})`;
};

const toDeg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;

function findTarget(model: CadModel, id: string): { kind: string; rows: Row[] } | null {
  const el = model.elements.find((e) => e.id === id);
  if (el) {
    const rows: Row[] = [
      { label: '类型', value: `元素 · ${el.type}` },
      { label: 'id', value: el.id },
    ];
    if (el.layer) rows.push({ label: '图层', value: el.layer });
    if (el.color) rows.push({ label: '颜色', value: el.color });
    if (el.visible === false) rows.push({ label: '可见性', value: '隐藏' });
    switch (el.type) {
      case 'line':
        rows.push({ label: '起点', value: fmtVec(el.from) });
        rows.push({ label: '终点', value: fmtVec(el.to) });
        break;
      case 'polyline':
        rows.push({ label: '点数', value: `${el.points.length}` });
        rows.push({ label: '闭合', value: el.closed ? '是' : '否' });
        break;
      case 'circle':
        rows.push({ label: '圆心', value: fmtVec(el.center) });
        rows.push({ label: '半径', value: `${el.radius}` });
        break;
      case 'arc':
        rows.push({ label: '圆心', value: fmtVec(el.center) });
        rows.push({ label: '半径', value: `${el.radius}` });
        rows.push({ label: '起始角', value: toDeg(el.startAngle) });
        rows.push({ label: '终止角', value: toDeg(el.endAngle) });
        break;
      case 'rect':
        rows.push({ label: '左下', value: fmtVec(el.min) });
        rows.push({ label: '右上', value: fmtVec(el.max) });
        break;
      case 'text':
        rows.push({ label: '文本', value: el.content });
        rows.push({ label: '位置', value: fmtVec(el.position) });
        break;
    }
    const parts = model.parts.filter((p) => p.elementIds.includes(el.id));
    if (parts.length) {
      rows.push({ label: '所属零件', value: parts.map((p) => p.name).join('、') });
    }
    return { kind: '元素属性', rows };
  }

  const ann = model.annotations.find((a) => a.id === id);
  if (ann) {
    const rows: Row[] = [
      { label: '类型', value: `标注 · ${ann.type}` },
      { label: 'id', value: ann.id },
    ];
    if (ann.layer) rows.push({ label: '图层', value: ann.layer });
    if (ann.type === 'dimension') {
      rows.push({ label: '测量点', value: `${fmtVec(ann.from)} → ${fmtVec(ann.to)}` });
      rows.push({ label: '文本', value: ann.text ?? '' });
    } else {
      rows.push({ label: '文本', value: ann.content });
      rows.push({ label: '位置', value: fmtVec(ann.position) });
    }
    return { kind: '标注属性', rows };
  }
  return null;
}

/** 选中元素/标注的属性面板（画布底部） */
export default function PropertyPanel() {
  const model = useCadStore((s) => s.model);
  const selectedId = useCadStore((s) => s.selectedId);
  const select = useCadStore((s) => s.select);

  if (!model || !selectedId) return null;
  const target = findTarget(model, selectedId);
  if (!target) return null;

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{target.kind}</span>
        <button
          type="button"
          title="关闭"
          className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          onClick={() => select(null)}
        >
          <CloseOutlined />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto px-3 pb-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {target.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2">
              <span className="shrink-0 text-[var(--text-muted)]">{r.label}</span>
              <span className="truncate text-[var(--text-primary)]" title={r.value}>
                {r.value || '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
