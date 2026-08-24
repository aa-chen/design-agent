# CAD Viewer Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `design-agent` 新增 `@da/cad-viewer`，用统一 Facade + 双后端（IDocFile→d-model/d-render，CadModel→Three.js）替换现有 2D 画布，使上传 JSON 可渲染闪设同源图纸与现有轻量 CadModel。

**Architecture:** `CadViewer.load` 先 `detectFormat`；`idoc` 走 `DocBackend`（bootstrap element 注册 → `createApp`/`createView(DRAWING_2D)` → `DocumentManager.loadDoc`）；`cad-model` 走迁入包内的原 `Cad2DViewer` 逻辑。切换格式时销毁另一后端。App 只依赖 `@da/cad-viewer` 作为 2D 入口。

**Tech Stack:** pnpm workspace, TypeScript, Vite 7, Vitest, three, `@do-design/d-model` / `d-render` / `element-cad-*`, `@da/cad-core`, React 19（可选 Host）

**Spec:** `docs/superpowers/specs/2026-08-24-cad-viewer-design.md`

**Branch:** `feat/cad-viewer`（不要直接在 main 改）。**不要在未要求时 git commit。**

---

## File map

| File | Responsibility |
| --- | --- |
| `.npmrc` | `@do-design` / `@do-math` 等私有 registry scope（凭证不入库，见 Task 1） |
| `packages/cad-viewer/package.json` | 包元数据与依赖 |
| `packages/cad-viewer/tsconfig.json` | 包 TS 配置 |
| `packages/cad-viewer/vitest.config.ts` | 包内单测 |
| `packages/cad-viewer/src/types.ts` | `LoadResult` / `ViewerMeta` / `CadFormat` |
| `packages/cad-viewer/src/detectFormat.ts` | 格式检测 |
| `packages/cad-viewer/src/detectFormat.test.ts` | 格式检测单测 |
| `packages/cad-viewer/src/parseInput.ts` | File / string / object → JSON |
| `packages/cad-viewer/src/three/RenderingViewer.ts` | 从 app 迁入的 WebGL 基类 |
| `packages/cad-viewer/src/three/threeUtils.ts` | `disposeObjectGroup` |
| `packages/cad-viewer/src/three/buildScene.ts` | CadModel → Three 场景 |
| `packages/cad-viewer/src/backends/CadModelBackend.ts` | 原 `Cad2DViewer` 迁入并改名 |
| `packages/cad-viewer/src/backends/DocBackend.ts` | IDocFile 只读打开 |
| `packages/cad-viewer/src/bootstrap/registerCadKernel.ts` | element / calculator side-effect |
| `packages/cad-viewer/src/CadViewer.ts` | Facade |
| `packages/cad-viewer/src/react/CadViewerHost.tsx` | 可选 React 封装 |
| `packages/cad-viewer/src/index.ts` | 对外导出 |
| `packages/cad-viewer/README.md` | registry 配置与用法 |
| `tsconfig.base.json` | 增加 `@da/cad-viewer` paths |
| `apps/design-agent/package.json` | 依赖 `@da/cad-viewer` |
| `apps/design-agent/vite.config.ts` | alias + 可能的 optimizeDeps |
| `apps/design-agent/src/stores/viewerStore.ts` | `viewer2d` 类型改为 `CadViewer` |
| `apps/design-agent/src/stores/cadStore.ts` | 增加 `format` / idoc 元数据；清空路径 |
| `apps/design-agent/src/canvas/CadCanvas.tsx` | 使用 `CadViewer` |
| `apps/design-agent/src/canvas/Cad3DViewer.ts` | 改从 `@da/cad-viewer` 引 `RenderingViewer` / `disposeObjectGroup` |
| `apps/design-agent/src/upload/JsonUploadButton.tsx` | `viewer.load` |
| `apps/design-agent/src/canvas/PropertyPanel.tsx` | idoc 选中降级（若需要） |
| Delete after migrate | `Cad2DViewer.ts`, `buildScene.ts`, `RenderingViewer.ts`, `threeUtils.ts`（app 内副本） |

---

### Task 1: 分支 + `.npmrc` + 包脚手架

**Files:**
- Create: `packages/cad-viewer/package.json`, `packages/cad-viewer/tsconfig.json`, `packages/cad-viewer/vitest.config.ts`, `packages/cad-viewer/src/index.ts`, `packages/cad-viewer/README.md`
- Modify: `.npmrc`, `tsconfig.base.json`

- [ ] **Step 1: Create branch**

```bash
cd /Users/chenfeng/Desktop/work/design-agent
git checkout -b feat/cad-viewer
```

- [ ] **Step 2: Extend root `.npmrc` with private scopes（不含 auth token）**

在现有 `.npmrc` 末尾追加（与 drawing-2d 对齐 scope；**不要**提交 `_auth`）：

```
@do:registry=https://hub.designorder.cn/
@do-cache:registry=https://hub.designorder.cn/
@do-design:registry=https://hub.designorder.cn/
@do-math:registry=https://hub.designorder.cn/
@do-gltf-handler:registry=https://hub.designorder.cn/
@do-types:registry=https://hub.designorder.cn/
@do-lib:registry=https://hub.designorder.cn/repository/npm-hosted/
```

本地若需认证：把 drawing-2d `.npmrc` 里的 `//hub.designorder.cn/:_auth=...` **只放本机**（或 CI secret），不要 commit。

在 `packages/cad-viewer/README.md` 写明：

```md
# @da/cad-viewer

只读 CAD Viewer：支持 drawing-2d `IDocFile`（`.pm`）与 `@da/cad-core` CadModel。

## Registry

根目录 `.npmrc` 需配置 `@do-design` 等 scope 指向 `hub.designorder.cn`。
若 401，在本机添加 `//hub.designorder.cn/:_auth=...`（勿提交）。
```

- [ ] **Step 3: Scaffold package**

`packages/cad-viewer/package.json`:

```json
{
  "name": "@da/cad-viewer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@da/cad-core": "workspace:*",
    "three": "*"
  },
  "peerDependencies": {
    "react": ">=19",
    "react-dom": ">=19"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/three": "^0.185.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

> `@do-design/*` 在 Task 5 再加，避免脚手架阶段 install 失败阻塞 CadModel 路径。

`packages/cad-viewer/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`packages/cad-viewer/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

`packages/cad-viewer/src/index.ts`:

```ts
export {};
```

- [ ] **Step 4: Add path alias**

`tsconfig.base.json` 的 `paths` 增加：

```json
"@da/cad-viewer": ["./packages/cad-viewer/src/index.ts"]
```

- [ ] **Step 5: Install workspace**

```bash
pnpm install
```

Expected: 成功；`@da/cad-viewer` 出现在 workspace。

---

### Task 2: `detectFormat` + `parseInput`（TDD）

**Files:**
- Create: `packages/cad-viewer/src/types.ts`, `packages/cad-viewer/src/detectFormat.ts`, `packages/cad-viewer/src/detectFormat.test.ts`, `packages/cad-viewer/src/parseInput.ts`
- Modify: `packages/cad-viewer/src/index.ts`

- [ ] **Step 1: Write failing tests**

`packages/cad-viewer/src/detectFormat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectFormat } from './detectFormat';

describe('detectFormat', () => {
  it('detects idoc by fileExtension pm + doc array', () => {
    expect(
      detectFormat({
        fileExtension: 'pm',
        doc: [{ _ctor_: 'Fake' }],
        versionCode: 0,
        documentName: 't',
        docUUID: 'u',
        documentType: 0,
      }),
    ).toBe('idoc');
  });

  it('detects cad-model by elements', () => {
    expect(
      detectFormat({
        version: '1.0',
        name: 't',
        unit: 'mm',
        elements: [
          {
            type: 'line',
            id: 'e1',
            from: [0, 0, 0],
            to: [1, 0, 0],
          },
        ],
        annotations: [],
      }),
    ).toBe('cad-model');
  });

  it('prefers idoc when both look plausible', () => {
    expect(
      detectFormat({
        fileExtension: 'pm',
        doc: [],
        elements: [{ type: 'line', id: 'e1', from: [0, 0, 0], to: [1, 0, 0] }],
      }),
    ).toBe('idoc');
  });

  it('returns unknown for empty object', () => {
    expect(detectFormat({})).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @da/cad-viewer test
```

Expected: FAIL（`detectFormat` 未定义）

- [ ] **Step 3: Implement types + detectFormat + parseInput**

`packages/cad-viewer/src/types.ts`:

```ts
export type CadFormat = 'idoc' | 'cad-model' | 'unknown';

export type ViewerMeta = {
  format: Exclude<CadFormat, 'unknown'>;
  fileName?: string;
  elementCount?: number;
};

export type LoadResult =
  | { ok: true; format: Exclude<CadFormat, 'unknown'>; meta: ViewerMeta }
  | { ok: false; error: string };
```

`packages/cad-viewer/src/detectFormat.ts`:

```ts
import { parseCadModel } from '@da/cad-core';
import type { CadFormat } from './types';

function isIDocShape(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const o = json as Record<string, unknown>;
  return o.fileExtension === 'pm' && Array.isArray(o.doc);
}

/** 检测 JSON 格式。`fileExtension === 'pm'` 优先于 CadModel。 */
export function detectFormat(json: unknown): CadFormat {
  if (isIDocShape(json)) return 'idoc';
  const parsed = parseCadModel(json);
  if (parsed.ok) return 'cad-model';
  return 'unknown';
}
```

`packages/cad-viewer/src/parseInput.ts`:

```ts
export async function parseInput(
  input: string | object | File,
): Promise<{ ok: true; json: unknown; fileName?: string } | { ok: false; error: string }> {
  try {
    if (typeof File !== 'undefined' && input instanceof File) {
      const text = await input.text();
      return { ok: true, json: JSON.parse(text), fileName: input.name };
    }
    if (typeof input === 'string') {
      return { ok: true, json: JSON.parse(input) };
    }
    return { ok: true, json: input };
  } catch {
    return { ok: false, error: 'JSON 解析失败' };
  }
}
```

Update `index.ts`:

```ts
export type { CadFormat, LoadResult, ViewerMeta } from './types';
export { detectFormat } from './detectFormat';
export { parseInput } from './parseInput';
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @da/cad-viewer test
```

Expected: PASS

---

### Task 3: 迁入 Three.js CadModel 后端

**Files:**
- Create: `packages/cad-viewer/src/three/RenderingViewer.ts`, `packages/cad-viewer/src/three/threeUtils.ts`, `packages/cad-viewer/src/three/buildScene.ts`, `packages/cad-viewer/src/backends/CadModelBackend.ts`
- Modify: `packages/cad-viewer/src/index.ts`

- [ ] **Step 1: Copy files from app into package**

从下列文件原样复制（仅改 import 路径）：

| From | To |
| --- | --- |
| `apps/design-agent/src/canvas/RenderingViewer.ts` | `packages/cad-viewer/src/three/RenderingViewer.ts` |
| `apps/design-agent/src/canvas/threeUtils.ts` | `packages/cad-viewer/src/three/threeUtils.ts` |
| `apps/design-agent/src/canvas/buildScene.ts` | `packages/cad-viewer/src/three/buildScene.ts` |
| `apps/design-agent/src/canvas/Cad2DViewer.ts` | `packages/cad-viewer/src/backends/CadModelBackend.ts` |

在 `CadModelBackend.ts` 中：

1. 将 `export class Cad2DViewer` 重命名为 `export class CadModelBackend`
2. 将 `Cad2DViewerOptions` 重命名为 `CadModelBackendOptions`
3. 修正 import：

```ts
import { buildScene, HIGHLIGHT_COLOR } from '../three/buildScene';
import { RenderingViewer } from '../three/RenderingViewer';
import { disposeObjectGroup } from '../three/threeUtils';
```

`buildScene.ts` 的 `@da/cad-core` import 保持不变。

- [ ] **Step 2: Export three helpers for Cad3DViewer**

`index.ts` 增加：

```ts
export { CadModelBackend } from './backends/CadModelBackend';
export type { CadModelBackendOptions } from './backends/CadModelBackend';
export { RenderingViewer } from './three/RenderingViewer';
export { disposeObjectGroup } from './three/threeUtils';
```

- [ ] **Step 3: Typecheck package**

```bash
pnpm --filter @da/cad-viewer typecheck
```

Expected: PASS（若 three 类型问题，确认 `devDependencies` 含 `@types/three`）

---

### Task 4: `CadViewer` Facade（先只接 CadModel 后端）

**Files:**
- Create: `packages/cad-viewer/src/CadViewer.ts`
- Modify: `packages/cad-viewer/src/index.ts`

- [ ] **Step 1: Implement CadViewer with CadModel path only; DocBackend stubbed**

`packages/cad-viewer/src/CadViewer.ts`:

```ts
import { parseCadModel, type CadModel } from '@da/cad-core';
import { CadModelBackend } from './backends/CadModelBackend';
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
 * Task 4：CadModel 可用；idoc 返回明确错误，待 Task 5/6 接通。
 */
export class CadViewer {
  private readonly container: HTMLElement;
  private readonly onSelect?: (id: string | null) => void;
  private cadBackend: CadModelBackend | null = null;
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
      return {
        ok: false,
        error: 'IDocFile 后端尚未接入（实现中）',
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
  }

  setSelection(id: string | null): void {
    if (this.active === 'cad-model') this.cadBackend?.setSelected(id);
  }

  setBackground(color: string): void {
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
    // Task 6 填充
  }
}
```

Export from `index.ts`:

```ts
export { CadViewer } from './CadViewer';
export type { CadViewerOptions } from './CadViewer';
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @da/cad-viewer typecheck
```

Expected: PASS

---

### Task 5: 安装 `@do-design/*` + `registerCadKernel`

**Files:**
- Modify: `packages/cad-viewer/package.json`, `packages/cad-viewer/README.md`
- Create: `packages/cad-viewer/src/bootstrap/registerCadKernel.ts`

- [ ] **Step 1: Add dependencies**

```bash
pnpm --filter @da/cad-viewer add \
  @do-design/d-model@3.7.9 \
  @do-design/d-render@3.7.28 \
  @do-design/element-cad-core \
  @do-design/element-cad-calculator \
  @do-design/element-cad-event-actor \
  @do-design/element-cad-camera-helper
```

若版本解析失败：对照 `drawing-2d/node_modules/@do-design/*/package.json` 的精确版本；本机确认 `_auth` 已配置。

Expected: `pnpm install` 成功。

- [ ] **Step 2: Bootstrap side-effects**

`packages/cad-viewer/src/bootstrap/registerCadKernel.ts`:

```ts
import '@do-design/element-cad-core';
import '@do-design/element-cad-calculator';
import '@do-design/element-cad-event-actor';
import '@do-design/element-cad-camera-helper';

let registered = false;

/**
 * 注册 CAD Element / Calculator，使 IDocFile `_ctor_` 可反序列化。
 * 与 drawing-2d `frontend/drawing/src/index.tsx` 的 CAD 相关 import 对齐。
 * 静态 import 在首次加载本模块时执行；由 DocBackend 动态 import 本文件以延迟到 idoc 路径。
 * 若真实样例反序列化失败，按缺失 `_ctor_` 增量补充 import。
 */
export function registerCadKernel(): void {
  registered = true;
}
```

（`DocBackend.ensureStarted` 内通过动态 `import('../bootstrap/registerCadKernel')` 延迟加载，见 Task 6。）

---

### Task 6: `DocBackend` + 接通 Facade

**Files:**
- Create: `packages/cad-viewer/src/backends/DocBackend.ts`
- Modify: `packages/cad-viewer/src/CadViewer.ts`

- [ ] **Step 1: Implement DocBackend**

`packages/cad-viewer/src/backends/DocBackend.ts`:

```ts
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
// registerCadKernel 经动态 import 加载，避免 CadModel-only 场景强拉全量 element 包

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
      // 已是对象：走 JsonUtil 再校验
      const packedOrObj = json as IDocFile;
      if (packedOrObj.fileExtension === 'pm' && Array.isArray(packedOrObj.doc)) {
        docFile = packedOrObj;
      } else {
        docFile = FileUtil.parse(JsonUtil.stringify(json as object));
      }
    }
    if (!docFile) {
      throw new Error('IDocFile 解析失败（需要 fileExtension: \"pm\"）');
    }

    const doc = this.view.getDocument();
    await DocumentManager.getInstance().loadDoc(doc, docFile);
    doc.updateView();
  }

  fitView(): void {
    // 若 RenderView 有 fit / zoomToFit API，在此调用；否则 no-op，依赖 load 后默认相机
    const renderView = this.view?.getRenderView?.();
    // 保守：存在 reset 类方法时再接；避免猜错 API 导致编译失败
    void renderView;
  }

  setSelection(_id: string | null): void {
    // v1 降级：属性面板对 idoc 仅显示有限信息
  }

  setBackground(_color: string): void {
    // d-render 背景若有 API 再接；v1 可忽略主题同步
  }

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
```

> 实现时对照 `@do-design/d-model` 的真实导出与 `ISysWindow` / `IRenderView` 方法名；若 `destroyView` / `getRenderView` 签名不同，以类型定义为准做最小调整，并在 PR 说明。

- [ ] **Step 2: Wire idoc path in CadViewer**

替换 `CadViewer` 中 idoc 分支与 `disposeDocBackend`：

```ts
import { DocBackend } from './backends/DocBackend';

// 增加字段：
private docBackend: DocBackend | null = null;

// load() 中 idoc 分支：
if (format === 'idoc') {
  this.cadBackend?.dispose();
  this.cadBackend = null;
  this.lastModel = null;
  if (!this.docBackend) {
    this.docBackend = new DocBackend({
      container: this.container,
      onSelect: (id) => this.onSelect?.(id),
    });
  }
  try {
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

// cad-model 分支开头增加：
this.disposeDocBackend();

// fitView / setSelection / setBackground / clear / dispose 对 idoc 分支调用 docBackend

private disposeDocBackend(): void {
  this.docBackend?.dispose();
  this.docBackend = null;
}
```

- [ ] **Step 3: Typecheck（允许 skipLibCheck 已开）**

```bash
pnpm --filter @da/cad-viewer typecheck
```

Expected: PASS。若 `@do-design` 类型与 DOM 冲突，优先改 `DocBackend` 调用而非关严格模式。

---

### Task 7: App 接入 — Vite / store / 迁走 3D 对基类的依赖

**Files:**
- Modify: `apps/design-agent/package.json`, `apps/design-agent/vite.config.ts`, `apps/design-agent/src/stores/viewerStore.ts`, `apps/design-agent/src/stores/cadStore.ts`, `apps/design-agent/src/canvas/Cad3DViewer.ts`
- Delete (later in Task 8): app 内 `Cad2DViewer.ts` / `buildScene.ts` / `RenderingViewer.ts` / `threeUtils.ts`

- [ ] **Step 1: Depend on package + alias**

```bash
pnpm --filter design-agent add @da/cad-viewer@workspace:*
```

`vite.config.ts` alias 增加：

```ts
'@da/cad-viewer': path.resolve(
  import.meta.dirname,
  '../../packages/cad-viewer/src/index.ts',
),
```

必要时增加：

```ts
optimizeDeps: {
  include: ['three'],
},
```

若 DocBackend 导致预构建失败，再按报错对 `@do-design/*` 做 `optimizeDeps.include` / `ssr.noExternal` 微调。

- [ ] **Step 2: Update viewerStore**

```ts
import type { CadViewer } from '@da/cad-viewer';
import type { Cad3DViewer } from '../canvas/Cad3DViewer';

interface ViewerState {
  viewer2d: CadViewer | null;
  viewer3d: Cad3DViewer | null;
  register2d: (viewer: CadViewer) => void;
  unregister2d: (viewer: CadViewer) => void;
  register3d: (viewer: Cad3DViewer) => void;
  unregister3d: (viewer: Cad3DViewer) => void;
}
```

- [ ] **Step 3: Extend cadStore for format**

在 `CadState` 增加：

```ts
format: 'idoc' | 'cad-model' | null;
```

`setModel` 时设 `format: 'cad-model'`。

新增：

```ts
setDocMeta: (fileName: string, opts?: { pending?: boolean; elementCount?: number }) => void;
```

实现：`model: null`（或保留上次 CadModel 清空）、`fileName`、`format: 'idoc'`、`selectedId: null`、可选 `pendingJson`。

`clearPendingJson` / `clearModel` 时重置 `format: null`。

- [ ] **Step 4: Point Cad3DViewer at package helpers**

`Cad3DViewer.ts`：

```ts
import { disposeObjectGroup, RenderingViewer } from '@da/cad-viewer';
```

删除对本地 `./RenderingViewer` / `./threeUtils` 的引用。

---

### Task 8: 替换 CadCanvas + JsonUploadButton + 删除旧 2D 文件

**Files:**
- Modify: `apps/design-agent/src/canvas/CadCanvas.tsx`, `apps/design-agent/src/upload/JsonUploadButton.tsx`, `apps/design-agent/src/canvas/PropertyPanel.tsx`（若依赖 CadModel-only）
- Delete: `apps/design-agent/src/canvas/Cad2DViewer.ts`, `buildScene.ts`, `RenderingViewer.ts`, `threeUtils.ts`

- [ ] **Step 1: CadCanvas 使用 CadViewer**

关键改动：

```ts
import { CadViewer } from '@da/cad-viewer';
import { samples } from '@da/cad-core';

// mount:
const viewer2d = new CadViewer({
  container: el2d,
  onSelect: (id) => select(id),
});

// model effect — 仅 CadModel store 变化时：
useEffect(() => {
  const viewer = useViewerStore.getState().viewer2d;
  if (!viewer) return;
  const format = useCadStore.getState().format;
  if (format === 'idoc') return; // idoc 已由 upload/load 直接写入 viewer
  if (model) {
    void viewer.load(model).then((r) => {
      if (r.ok) viewer.fitView();
    });
  } else if (format !== 'idoc') {
    viewer.clear();
  }
}, [model]);

// selection:
useEffect(() => {
  useViewerStore.getState().viewer2d?.setSelection(selectedId);
}, [selectedId]);

// sample load:
const loadSample = (name: string) => {
  const sample = samples.find((s) => s.name === name);
  if (!sample) return;
  useCadStore.getState().setModel(sample, `${sample.name}.json`);
};
```

`has2d`：`!!fileName`（idoc / cad-model 都有 fileName）或 `!!model || format === 'idoc'`。

主题：`viewer2d?.setBackground(bg)`。

- [ ] **Step 2: JsonUploadButton**

```ts
import { detectFormat } from '@da/cad-viewer';
import { parseCadModel } from '@da/cad-core';

const handleFile = async (file: File) => {
  const viewer = useViewerStore.getState().viewer2d;
  if (!viewer) {
    message.error('画布未就绪');
    return;
  }
  const result = await viewer.load(file);
  if (!result.ok) {
    message.error(result.error);
    return;
  }
  if (result.format === 'cad-model') {
    const text = await file.text();
    const parsed = parseCadModel(JSON.parse(text));
    if (parsed.ok) {
      useCadStore.getState().setModel(parsed.data, file.name, { pending: true });
    }
  } else {
    useCadStore.getState().setDocMeta(file.name, {
      pending: true,
      elementCount: result.meta.elementCount,
    });
  }
  useViewerStore.getState().viewer2d?.fitView();
  message.success(`已加载 ${file.name}（${result.format}）`);
};
```

> 优化：避免二次 `file.text()`——可改为 `CadViewer.load` 返回已解析 json，或 upload 先 `parseInput` 再 `load(json)`。实现时优先 **一次读取**：

```ts
const text = await file.text();
const json = JSON.parse(text);
const result = await viewer.load(json);
// 再用 json + result.format 更新 store
```

- [ ] **Step 3: PropertyPanel idoc 降级**

若 `format === 'idoc'` 且选中：显示「工程图元素（只读）」+ id，不找 `model.elements`。

- [ ] **Step 4: Delete migrated app files**

删除：

- `apps/design-agent/src/canvas/Cad2DViewer.ts`
- `apps/design-agent/src/canvas/buildScene.ts`
- `apps/design-agent/src/canvas/RenderingViewer.ts`
- `apps/design-agent/src/canvas/threeUtils.ts`

确认无残留 import。

- [ ] **Step 5: typecheck + tests**

```bash
pnpm --filter @da/cad-viewer test
pnpm --filter @da/cad-viewer typecheck
pnpm --filter design-agent typecheck
```

Expected: 全部 PASS

---

### Task 9: 手工验收 + Vite 运行时收敛

**Files:**
- Modify: `apps/design-agent/vite.config.ts`（仅当运行时报错时）
- Optional: `examples/` 下放脱敏 IDocFile（若用户提供；**不要**提交含业务机密的大文件）

- [ ] **Step 1: Dev server CadModel 回归**

```bash
pnpm --filter design-agent dev
```

- 上传 `examples/bracket.json` → 与改前视觉/选中/适配一致
- 示例模型下拉可用
- 清空 / 主题切换背景正常

- [ ] **Step 2: IDocFile 验收**

用 drawing-2d 导出的真实 `.pm` JSON（本地文件，可不入库）：

- `viewer.load` 成功且画面与闪设打开同文件一致（允许无编辑 UI）
- 若反序列化报错：根据缺失 `_ctor_` 在 `registerCadKernel.ts` 增量 import，直到样例可显示
- `dispose` / 切换到 CadModel 再切回：无双画布叠层、无持续 RAF 泄漏

- [ ] **Step 3: Document follow-ups in README**

在 `packages/cad-viewer/README.md` 追加「已知限制」：

- idoc 选中 / 属性面板降级
- 未移植 `FixToolImpl`
- 需私有 registry

---

## Spec coverage check

| Spec 项 | Task |
| --- | --- |
| `@da/cad-viewer` 包 + 双后端 | 1, 3, 4, 6 |
| detectFormat 规则 | 2 |
| 只读 API load/fit/select/dispose | 4, 6 |
| DocBackend createApp/loadDoc | 5, 6 |
| CadModel 迁入 | 3 |
| `.npmrc` 私有源 | 1, 5 |
| 替换 App 2D 入口 | 7, 8 |
| cadStore format / idoc meta | 7, 8 |
| 测试 detectFormat + 工程 typecheck | 2, 8 |
| IDocFile 真实样例验收 | 9 |
| 不做编辑/导出/双向转换 | 全任务遵守 |

## Placeholder / consistency review

- API 名统一：`setSelection`（Facade）↔ `CadModelBackend.setSelected`（内部）
- `clear()` 用于清空模型但不销毁 Viewer；`dispose()` 销毁
- 不自动 git commit（用户未要求时）
