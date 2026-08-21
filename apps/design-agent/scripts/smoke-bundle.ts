/**
 * 无头冒烟测试：真实走一遍「bundle 解析 → buildScene 构建 three 场景」，
 * 验证 2D 渲染器渲染该 CAD 数据所需的全部对象/材质/包围盒。
 *
 * 运行（需 esbuild，沙箱内请授权）：
 *   node -e "require('esbuild').buildSync({entryPoints:['scripts/smoke-bundle.ts'],bundle:true,platform:'node',format:'esm',external:['three'],outfile:'scripts/smoke-bundle.mjs'})"
 *   node scripts/smoke-bundle.mjs
 */
import { readFileSync } from 'node:fs';
import { parseCadBundle } from '../../../packages/cad-core/src/bundle';
import { buildScene } from '../src/canvas/buildScene';
import * as THREE from 'three';

const bundle = JSON.parse(
  readFileSync(new URL('../../../examples/KxBV6LDd.bundle.json', import.meta.url), 'utf8'),
);

// Node 无 DOM：makeTextSprite 的 canvas 2D 上下文返回 null 时走空 Sprite 分支
(globalThis as { document?: unknown }).document = {
  createElement: () => ({ getContext: () => null }),
} as Document;

const model = parseCadBundle(bundle);
const pickables = new Map<string, THREE.Object3D>();
const group = buildScene(model, pickables);

let lines = 0;
let dashed = 0;
let sprites = 0;
group.traverse((obj) => {
  if (obj instanceof THREE.Sprite) sprites++;
  if (obj instanceof THREE.Line) {
    lines++;
    if (obj.material instanceof THREE.LineDashedMaterial) dashed++;
  }
});

// 几何包围盒（仅图纸元素，不含尺寸标注与网格辅助线——二者按 CAD 惯例绘制在视图外侧）
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const extend = (p: number[]) => {
  minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
  maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
};
for (const el of model.elements) {
  if (el.layer === '辅助线') continue;
  if (el.type === 'line') {
    extend(el.from); extend(el.to);
  } else if (el.type === 'polyline') {
    for (const p of el.points) extend(p);
  } else if (el.type === 'arc') {
    for (let k = 0; k <= 32; k++) {
      const a = el.startAngle + ((el.endAngle - el.startAngle) * k) / 32;
      extend([el.center[0] + Math.cos(a) * el.radius, el.center[1] + Math.sin(a) * el.radius]);
    }
  }
}

console.log('model:', model.name, '| elements:', model.elements.length, '| annotations:', model.annotations.length, '| parts:', model.parts.length);
console.log('scene: lines =', lines, '(dashed', dashed + ')', '| sprites =', sprites, '| pickables =', pickables.size);
console.log('geometry bbox: x', minX.toFixed(1), '..', maxX.toFixed(1), '| y', minY.toFixed(1), '..', maxY.toFixed(1));

const fail = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('SMOKE FAIL:', msg);
    process.exitCode = 1;
  }
};
fail(lines > 3000, `lines 数量异常: ${lines}`);
fail(dashed > 1000, `虚线数量异常: ${dashed}`);
fail(sprites === 2, `尺寸文本 sprite 数量应为 2，实际 ${sprites}`);
fail(pickables.size === model.elements.length + model.annotations.length, `pickables(${pickables.size}) 与元素(${model.elements.length})+标注(${model.annotations.length})不一致`);
// 视图局部包围盒 [-124,-296]..[76,190] + chunk 矩阵平移 (545.009,1231.176)，容差 3
fail(Math.abs(minX - 421.0) < 3 && Math.abs(maxX - 621.0) < 3, `宽度异常: ${minX}..${maxX}`);
fail(Math.abs(minY - 935.2) < 3 && Math.abs(maxY - 1421.2) < 3, `高度异常: ${minY}..${maxY}`);

console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
