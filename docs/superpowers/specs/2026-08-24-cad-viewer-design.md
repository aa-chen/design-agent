# CAD Viewer 独立包设计（JSON → Model → View）

**日期：** 2026-08-24  
**状态：** 已评审通过（对话确认）  
**目标仓库：** `design-agent`  
**参考源：** 同级目录 `drawing-2d`（闪设 2D）

## 背景与目标

`drawing-2d` 的图纸打开链路为：

`IDocFile JSON` → `FileUtil` / `DocSaver.load`（`@do-design/d-model`）→ Element 树（`element-cad-core` 等）→ `createApp` / `createView` → `@do-design/d-render` → CAD 画布。

`design-agent` 现有 `@da/cad-core` + 自研 `Cad2DViewer`（Three.js）只能渲染简化 `CadModel`，无法打开闪设导出的完整图纸 JSON。

**目标：** 在 `design-agent` 中新增独立包 `@da/cad-viewer`，整理并封装上述只读渲染能力；给定 JSON 即可渲染。支持两种输入格式，并替换应用内现有 2D 画布为唯一入口。

## 已确认决策

| 决策点 | 选择 |
| --- | --- |
| 输入格式 | 双格式：`IDocFile`（drawing-2d `.pm` JSON）+ 现有 `CadModel` |
| 能力边界 | 只读 Viewer（加载 / 渲染 / 缩放平移 / 选中 / fit） |
| 内核引进 | 直接依赖私有 npm 的 `@do-design/*`（对齐 drawing-2d registry） |
| App 集成 | 替换现有 `Cad2DViewer`，成为唯一 2D 入口 |
| 架构 | 统一 Facade + 双后端（不把 CadModel 硬转成 IDocFile） |

## 非目标（v1）

- 编辑、标注、撤销、事务、保存回写
- 导出 PNG / SVG / DXF
- CadModel ↔ IDocFile 双向无损转换
- 3D GLB 渲染（继续由现有 `Cad3DViewer` 负责）
- 完整复刻 drawing-2d 命令 / UI / Copilot

## 架构

### 包布局

```
packages/
  cad-core/       # 保留：CadModel types / zod / samples / validate
  cad-viewer/     # 新建：@da/cad-viewer
    src/
      index.ts
      CadViewer.ts              # Facade
      detectFormat.ts
      backends/
        DocBackend.ts           # IDocFile → d-model / d-render
        CadModelBackend.ts      # CadModel → Three.js（迁入现有逻辑）
      bootstrap/
        registerCadKernel.ts    # side-effect：注册 element / calculator 等
      react/
        CadViewerHost.tsx       # 可选 React 薄封装
  ui/             # 不变

apps/design-agent/
  # 移除本地 Cad2DViewer / buildScene 的 2D 路径
  # CadCanvas 改为使用 @da/cad-viewer
```

### 数据流

```
load(input)
  → normalize to JSON object
  → detectFormat(json)
       ├─ 'idoc'      → ensure DocBackend bootstrapped
       │                 → DocumentManager.loadDoc(IDocFile)
       │                 → updateView()
       ├─ 'cad-model' → parseCadModel (@da/cad-core)
       │                 → CadModelBackend.setModel()
       └─ 'unknown'   → error Result / throw
```

切换格式时销毁另一后端，避免双 WebGL / 双 `IApp` 泄漏。

### 格式检测规则（明确）

- **`idoc`**：对象含 `fileExtension === 'pm'`，且存在 `doc` 数组（兼容 jsonpack 解包后的结构；若输入为 packed 字符串，先经与 `JsonUtil.parse` 等价路径解包）。
- **`cad-model`**：通过现有 `cadModelSchema` / `parseCadModel` 校验成功（或具备 `elements` 数组且无 `fileExtension`）。
- **优先级**：若同时像两者，优先 `idoc`（`fileExtension === 'pm'` 为准）。
- **`unknown`**：两者皆否。

> 「适配层」在 v1 的含义是：**格式检测 + 统一 Viewer API**，不是几何到 Element 树的无损转换。

## 对外 API

命令式生命周期（与现有 `Cad2DViewer` 风格一致），由 React 挂载/销毁：

```ts
type CadViewerOptions = {
  container: HTMLElement;
  onSelect?: (id: string | null) => void;
};

class CadViewer {
  constructor(options: CadViewerOptions);
  load(input: string | object | File): Promise<LoadResult>;
  fitView(): void;
  setSelection(id: string | null): void;
  dispose(): void;
}

type LoadResult =
  | { ok: true; format: 'idoc' | 'cad-model'; meta: ViewerMeta }
  | { ok: false; error: string };

function detectFormat(json: unknown): 'idoc' | 'cad-model' | 'unknown';
```

`ViewerMeta` 至少包含：`fileName?`、`format`、可选 `elementCount`（CadModel 用 `elements.length`；IDocFile 用 `doc.length` 估算）。

可选导出 `CadViewerHost` React 组件，内部创建/销毁 `CadViewer`。

## DocBackend（IDocFile 路径）

对齐 drawing-2d 打开文件最小闭环：

1. `registerCadKernel()`：side-effect import，与 `frontend/drawing/src/index.tsx` 中 CAD 相关注册一致，至少包括：
   - `@do-design/element-cad-core`
   - `@do-design/element-cad-calculator`
   - `@do-design/element-cad-event-actor`
   - `@do-design/element-cad-camera-helper`
   - 以及 DocBackend 实际 `loadDoc` 所必需的其它注册（实现时以能反序列化样例 `_ctor_` 为准收敛）
2. `createApp` → `createView(container, …)` 得到 `ISysWindow`
3. 解析 `IDocFile`（`FileUtil` / `JsonUtil`）
4. `DocumentManager.getInstance().loadDoc(doc, iFile)`（或等价 `DocSaver.load`）
5. `doc.updateView()` / fit 到图纸范围（若内核提供相机 reset API 则使用；否则做保守 fit）

**不做** drawing-2d `OpenFileCmd` 中的各类 `FixToolImpl.*` 业务修复（除非某条修复是样例文件无法显示的硬前提；若遇到再按需最小引入，并在实现笔记中记录）。

## CadModelBackend（CadModel 路径）

- 将 `apps/design-agent/src/canvas/Cad2DViewer.ts`、`buildScene.ts`、相关 `threeUtils` 迁入 `@da/cad-viewer`（或抽取共享渲染模块）。
- 继续依赖 `@da/cad-core` 做校验。
- 交互能力与现网 2D 一致：滚轮缩放、点击选中；平移策略保持与现实现一致（不擅自扩大交互范围）。

## 依赖与工程配置

1. 根目录 `.npmrc` 增加与 drawing-2d 对齐的 `@do-design` / `@do-math` / `@do-cache` / `@do-types` 等私有 registry 配置（**不把含明文凭证的整段历史提交进文档示例**；实现时从 drawing-2d `.npmrc` 复制必要 scope，凭证由本地/CI secret 管理）。
2. `packages/cad-viewer/package.json` 声明对 `@do-design/d-model`、`@do-design/d-render`、`element-cad-core` 及相关 calculator/event-actor/camera-helper、`three`、`@da/cad-core` 的依赖。
3. Vite / TS path：workspace 协议引用 `@da/cad-viewer`；确保私有包可被 resolve（必要时 `optimizeDeps` / `ssr.noExternal` 调整）。
4. peer：`react` 仅对可选 `CadViewerHost` 为 peerDependency。

## App 接入

- `CadCanvas`：2D 模式改为创建 `CadViewer`；移除对本地 `Cad2DViewer` 的引用。
- `JsonUploadButton`：读取文件后调用 `viewer.load`（或先 `detectFormat` 再写入 store 并触发 load）；成功/失败用现有 message 提示。
- `cadStore` / `viewerStore`：
  - 保留 CadModel 字段供属性面板等（仅 CadModel 路径有结构化元素）。
  - IDocFile 路径：存 `format: 'idoc'`、文件名、原始 JSON 引用或 meta；属性面板对 idoc 选中可先降级为只显示 id / 有限字段。
- 删除（或移入包后删除）应用内重复的 2D 渲染实现文件，避免双份逻辑。

## 错误处理

- JSON 语法错误、格式 unknown、zod 失败、`loadDoc` 失败：返回 `LoadResult.ok === false` 或等价错误，**不静默失败**。
- DocBackend 初始化失败（缺 registry / 缺 peer）：明确错误信息（例如提示检查 `.npmrc`）。
- `dispose` 必须可重复调用且释放 WebGL / RAF / 事件监听。

## 测试计划

| 层级 | 内容 |
| --- | --- |
| 单测 | `detectFormat`：idoc / cad-model / unknown / 优先级 |
| 单测 | CadModel 路径：用 `examples/bracket.json` 校验 `parse` + 场景构建不抛错（可无 WebGL 的纯函数部分） |
| Smoke | 有脱敏小样 IDocFile 时：`load` 成功且 `dispose` 无泄漏告警；无样例则标记为需人工用真实文件验收 |
| 工程 | `pnpm install` + `typecheck` + Vite build 能解析私有依赖 |

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| `@do-design/*` 依赖树深、Vite 打包困难 | 先让 Vite 外部化或 `optimizeDeps.include`；必要时 DocBackend 用动态 import |
| Element 注册不全导致反序列化失败 | bootstrap 与 drawing 入口对齐；用真实样例收敛 import 列表 |
| 双后端资源泄漏 | 切换格式强制 dispose 非活动后端；单测/手工检查 |
| 私有 registry 凭证 | 不入库；README 写配置步骤 |
| IDocFile 选中 id 与属性面板不匹配 | v1 属性面板对 idoc 降级；后续再接 element 属性读取 |

## 成功标准

1. 上传闪设导出的 `IDocFile` JSON，画面与 drawing-2d 打开同一文件时视觉一致（允许无编辑 UI）。
2. 上传现有 `examples/bracket.json`，行为不弱于当前 `Cad2DViewer`。
3. 应用内只有一套 2D Viewer API（`@da/cad-viewer`）。
4. 包可被 `apps/design-agent` 以 workspace 依赖引用。

## 实现顺序（供后续 plan 展开）

1. 工程脚手架：`packages/cad-viewer` + `.npmrc` scope + 依赖安装
2. `detectFormat` + CadModelBackend 迁入 + 单测
3. DocBackend bootstrap + loadDoc 最小闭环
4. `CadViewer` Facade 串联双后端
5. App 替换 `CadCanvas` / 上传按钮 / store
6. 用真实 IDocFile 样例验收与收敛 bootstrap
