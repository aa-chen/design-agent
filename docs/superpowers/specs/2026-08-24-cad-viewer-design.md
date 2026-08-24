# CAD Viewer 独立包（playground flatten → three.js）

**日期：** 2026-08-24  
**状态：** 已评审通过（对话确认）  
**目标仓库：** `design-agent`  
**参考源：** 同级目录 `dal_playground/viewer`（Canvas2D flatten 看图流程）

## 背景与目标

`dal_playground` 的看图链路为：

`view.bundle.json` / `drawing.bundle.json` → flatten 为 `DrawSegment[]` → Canvas2D 绘制（平移 / 滚轮缩放 / 适配）。

`design-agent` 当前上传 JSON 只解析为聊天附件，右侧画布只渲染 GLB。此前用 `@do-design/d-render` 做 2D 的方案已回滚。

**目标：** 新增独立包 `@da/cad-viewer`：给定 playground 图纸 JSON，用 **three.js 正交相机** 画出与 playground 同一套图元与线型。上传后立刻出图，并挂到输入框附件。删除 `@da/cad-core`（简化 CadModel 不再参与出图或聊天）。

## 已确认决策

| 决策点 | 选择 |
| --- | --- |
| 输入 | playground 单视图 bundle 与整图 drawing bundle；不接收简化 CadModel |
| 摊平 | 迁入 playground `viewer/src/core` 的 flatten（不迁 Canvas2D `drawSegments`） |
| 绘制 | three.js 正交 2D（XY 平面，Y 向上） |
| 上传后 | 立刻打开右侧画布 + 挂输入框附件 |
| JSON + GLB | 同一面板；都在时顶部 Tab「2D 图纸 / 3D 模型」 |
| 交互 | 平移、滚轮缩放（指针处）、适配；不点选、无检查器 |
| cad-core | 整包删除；聊天改用 bundle 摘要 |
| 包形态 | 无 React；`three` 为 peer/dependency |

## 非目标（v1）

- 点选图元、属性面板、JSON 检查器
- `@do-design/*` / d-render / element-cad 内核
- 简化 `CadModel`、`bracket.json`、SVG/DXF 导出
- 把 `dal_playground` 实验目录当运行时依赖
- 3D GLB（继续由应用内 `Cad3DViewer` 负责）
- 编辑、保存回写、与 playground 截图像素级对比测试

## 架构

```
packages/
  cad-viewer/          # 新建 @da/cad-viewer
  ui/                  # 不变
                       # 删除 cad-core

apps/design-agent/
  上传 JSON → detect + 存原始 JSON + openCanvas + pending 附件
  CadCanvas → 2D 页挂 CadViewer；3D 页仍是 Cad3DViewer
```

数据流：

```
选 .json
  → JSON.parse
  → detectCadJson
       ├─ view-bundle     → flattenViewBundle（视图局部坐标，applyMatrix=false）
       ├─ drawing-bundle  → flattenDrawingBundle（图框布局，与 playground 全部视图相同）
       └─ unknown         → 错误提示，不打开画布、不挂附件
  → CadViewer.load(json) 画 2D
  → summarizeCadJson 写入聊天 prompt
```

渲染路径不经过任何中间 CadModel。

## 包布局与 API

```
packages/cad-viewer/
  src/
    index.ts
    CadViewer.ts              # 唯一入口
    detectFormat.ts
    summarize.ts
    flatten/                  # 从 playground viewer/src/core 迁入（见下表）
    three/
      Cad2DRenderer.ts        # WebGLRenderer、正交相机、pan/zoom/fit
      buildScene.ts           # DrawSegment[] → THREE.Group
      threeUtils.ts
  test/
    fixtures/                 # 小型合成 bundle，不用 dodoc 大文件
```

**迁入 playground 的文件（逻辑对齐，改 import 路径；不迁 `loader.ts`、不迁 Canvas 绘制）：**

| 源文件 | 用途 |
| --- | --- |
| `types.ts` | ViewBundle / DrawingBundle / DrawSegment |
| `matrix.ts` + `matrix.test.ts` | m4 变换 |
| `coords.ts` | 点、标注几何辅助 |
| `style.ts` | VISIBLE/HIDDEN、colorIndex |
| `view-visibility.ts` | 整图可见视图 |
| `flatten.ts` | `flattenViewBundle`、bbox、viewport（`fitViewport` / `zoomViewportAt` / `wheelZoomFactor`）；删除 `drawSegments` |
| `flatten-drawing.ts` | 整图布局 |
| `flatten-dimensions.ts` | 对齐/直径/半径/引注/倒角标注 |
| `flatten-blocks.ts` | 网格线、用户块、图例块 |
| `flatten-roughness.ts` / `flatten-location-hatch.ts` | 块简化符号 |

公开 API：

```ts
export type CadJsonKind = 'view-bundle' | 'drawing-bundle';

export interface CadSummary {
  name: string;
  kind: CadJsonKind;
  geometryCount: number;
  dimensionCount: number;
  viewCount?: number;
}

export function detectCadJson(input: unknown): CadJsonKind | 'unknown';
export function summarizeCadJson(input: unknown): CadSummary | null;

export class CadViewer {
  constructor(container: HTMLElement);
  load(json: unknown): { ok: true } | { ok: false; error: string };
  fitView(): void;
  setBackground(color: string): void;
  dispose(): void;
}
```

无 React 封装。`three` 列入 package.json dependencies（与应用现有 three 对齐），不依赖 `@da/cad-core`、`@da/ui`、React。

### 格式检测（明确）

- **`drawing-bundle`：** 对象且 `views` 为数组（可为空）。优先于单视图判断。
- **`view-bundle`：** 对象且 `geometry` 为数组，且 `view` 为非 null 对象，且 `views` 不是数组。
- **`unknown`：** 其余（含旧 CadModel、空对象、非对象）。

### flatten 约定（与 playground 一致）

- 单视图：`flattenViewBundle(bundle, { includeLoop: true, includeBlocks: true, includeAnnotations: true })`，默认 **不** 应用 element matrix（视图局部坐标）。
- 整图：`flattenDrawingBundle`，仅可见视图（`inVisibleFlag` 的 VIEW 位为 0），图框 + `matrix.t / frameScale` 布局。
- 线型：`HIDDEN_LINE` 或 `isProjectionVisible === false` → 虚线、略细；其余实线。颜色按 `style.ts` 的 colorIndex 表。
- 视图 loop：蓝色虚线框。

### three.js 绘制约定

- 正交相机俯视 XY，世界 Y 向上；屏幕变换与 playground `worldToScreen` 同号（Y 翻转）。
- 平移：指针拖拽；缩放：滚轮，缩放中心为指针下的世界点（`zoomViewportAt`）；适配：`fitViewport`，padding 40px。
- 线宽/虚线：使用 `three/addons/lines` 的 `Line2` + `LineMaterial`（WebGL 下 `LineBasicMaterial.linewidth` 无效）。
- 弧/圆：按半径采样折线，角度单位与 playground 相同（度，绘制时与 Canvas 圆弧方向一致）。
- 标注箭头：填充三角；文字：Canvas 贴图 Sprite，系统字体，颜色跟 segment stroke（playground 白字绿底圆标例外同样保留）。
- `load` 替换上一份图纸；容器尺寸用 `ResizeObserver`；`dispose` 释放 renderer、几何、材质、监听。

背景默认 `#f8f9fa`（playground 清屏色）；应用主题变化时调 `setBackground`，读 `--scene-bg`。

## 应用集成

### store（`cadStore`）

- 删除 `model: CadModel`。
- 新增 `drawingJson: unknown | null`、`drawingFileName: string | null`、`drawingSummary: CadSummary | null`。
- GLB 字段不变。JSON 与 GLB 互不覆盖。
- `setDrawing(json, fileName, { pending })`：写入上述字段；`pendingJson` 仍表示输入框芯片。
- `openCanvas()` 在 JSON 上传成功时调用（不再等发消息）。
- `clearDrawing` / `clearGltf` 只清各自数据；两者都空时 `canvasOpen = false`。

### 上传

`JsonUploadButton`：扩展名与 `JSON.parse` 校验保留；用 `detectCadJson` 代替 `parseCadModel`。unknown 报「不是 playground 图纸 JSON」。成功则 `setDrawing` + `openCanvas`。

### 画布

`CadCanvas`：

- 仅 JSON：整块 2D，挂 `CadViewer`，`drawingJson` 变化时 `load`，成功后 `fitView`。
- 仅 GLB：现有 `Cad3DViewer`。
- 都有：顶部 Tab「2D 图纸 / 3D 模型」；默认停在刚上传的那一侧；切 Tab 不销毁另一侧 viewer。
- 工具条：适配 / 清空针对当前 Tab；关闭画布仍清展示状态但不强制删附件（与现关闭按钮一致：关面板）。
- `load` 失败：2D 区域显示错误文案，不白屏。

### 聊天

- `ChatAttachment`：删除 `model?: CadModel`；JSON 附件带 `json?: unknown` 与 `summary?: CadSummary`。
- `ChatRequest.model` 删除，改为 `summary: CadSummary | null`。
- Harness / Mock prompt：用 summary 的 name、kind、geometryCount、dimensionCount、viewCount，不再列举 CadModel 元素类型。
- `MessageFileCard`：点击 JSON 卡片 → `setDrawing(attachment.json, name)` + 打开画布并切到 2D。

### 删除清单

- `packages/cad-core/` 整包
- `tsconfig.base.json` / `vite.config.ts` 中 `@da/cad-core` 路径
- `apps/design-agent` 对 `@da/cad-core` 的依赖
- `scripts/export-drawing.ts`（依赖 CadModel SVG/DXF）
- `examples/bracket.json`（简化 CadModel 样例）
- 应用内任何 `parseCadModel` / `CadModel` 引用

## 错误处理

| 情况 | 行为 |
| --- | --- |
| 非 `.json` | 提示选 json，不改 store |
| `JSON.parse` 失败 | 「JSON 解析失败」 |
| `unknown` 格式 | 「不是 playground 图纸 JSON」；不打开画布、不挂附件 |
| `load` 失败（摊平后无内容或内部异常） | 画布已开则显示错误文案；附件仍保留（用户已确认是 bundle） |
| React 卸载 2D 页 | 必须 `dispose`，避免 WebGL 泄漏 |
| 切到 3D Tab | 2D `CadViewer` 实例保留，不 `dispose`、不重新 `load` |

格式错误不得静默写成附件。

## 测试

包内 Vitest（不创建 WebGL 上下文）：

- `detectCadJson`：单视图、整图、旧 CadModel 形状、空对象、非对象。
- `summarizeCadJson`：名称与计数；整图含 `viewCount`。
- flatten：小型 fixture 覆盖直线、隐藏虚线、弧、对齐标注箭头、视图 loop；整图 fixture 覆盖 frame 平移。
- `matrix.test.ts` 从 playground 迁入。

应用：

- `cadStore`：JSON 与 GLB 互不覆盖；pending；分别清空；都空则关画布。
- 聊天类型不再出现 `CadModel`。

不测：three.js 像素、和 playground 截图逐像素对齐。实现完成后用同一份 view bundle 在应用里人工对照 playground Dev UI。

## 成功标准

1. 上传 playground `*.bundle.json`（单视图或整图）后右侧立刻出现 2D 图纸，线型/标注/视图框与 playground 同一 flatten 结果。
2. 输入框出现 JSON 芯片；发送后模型能读到摘要。
3. 同时上传 GLB 时可用 Tab 切换，互不销毁。
4. 仓库中不再存在 `@da/cad-core`。
5. 包可单独 `pnpm --filter @da/cad-viewer test`，应用 `CadCanvas` 只通过公开 API 使用 viewer。
