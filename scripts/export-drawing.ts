/**
 * 图纸 8357 · KxBV6LDd 导出脚本
 *
 * 读取 examples/KxBV6LDd.bundle.json（云看图 bundle），解析为内部 CadModel 后
 * 渲染为 SVG 矢量图纸与 DXF（R12）文件，并输出解析统计。
 *
 * 运行：
 *   node <pnpm-store>/vite-node/vite-node.mjs scripts/export-drawing.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cadModelToDXF, cadModelToSVG, parseCadBundle } from '../packages/cad-core/src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const bundlePath = resolve(root, 'examples/KxBV6LDd.bundle.json');
const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as unknown;

const model = parseCadBundle(bundle);

// ---- 统计报告 ----------------------------------------------------------
const byType = new Map<string, number>();
const byLayer = new Map<string | undefined, number>();
const dashed = { solid: 0, dashed: 0 };
for (const el of model.elements) {
  byType.set(el.type, (byType.get(el.type) ?? 0) + 1);
  byLayer.set(el.layer, (byLayer.get(el.layer) ?? 0) + 1);
  dashed[el.lineStyle === 'dashed' ? 'dashed' : 'solid']++;
}
const dimTexts = model.annotations
  .filter((a) => a.type === 'dimension')
  .map((a) => (a.type === 'dimension' ? a.text : ''));

const stats = {
  name: model.name,
  unit: model.unit,
  几何元素: model.elements.length,
  元素类型: Object.fromEntries(byType),
  图层分布: Object.fromEntries(byLayer),
  实线虚线: dashed,
  标注: model.annotations.length,
  尺寸文本: dimTexts,
  零件分组: model.parts.length,
};

// ---- 导出 ---------------------------------------------------------------
const svgPath = resolve(root, 'examples/KxBV6LDd.drawing.svg');
const dxfPath = resolve(root, 'examples/KxBV6LDd.drawing.dxf');
writeFileSync(svgPath, cadModelToSVG(model));
writeFileSync(dxfPath, cadModelToDXF(model));

console.log(JSON.stringify(stats, null, 2));
console.log(`\n已生成：\n  ${svgPath}\n  ${dxfPath}`);
