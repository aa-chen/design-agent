# @da/cad-viewer

只读 CAD Viewer：支持 drawing-2d `IDocFile`（`.pm`）与 `@da/cad-core` CadModel。

## Registry

IDocFile 路径依赖私有包 `@do-design/d-model`、`@do-design/d-render`、`@do-design/element-cad-*`。

根目录 `.npmrc` 需配置 `@do-design` 等 scope 指向 `hub.designorder.cn`。
本机 `//hub.designorder.cn/:_auth=...` 仅用于 `pnpm install`，**不得提交**（含凭证的 `.npmrc` 不要入库）。

## Vendored unpublished packages

`@do-design/element-cad-event-actor` 与 `@do-design/element-cad-camera-helper` 未发布到私有源。本仓在 `packages/` 下保留从 drawing-2d 拷贝的 vendored 副本，由 pnpm workspace 解析（`workspace:*`）。

发布到 registry 后应改为版本号依赖并移除本地副本。


## 已知限制（v1）

- idoc 选中 / 属性面板降级为只读 id；未接 d-model 拾取事件
- 未移植 drawing-2d `FixToolImpl` 业务修复
- `element-cad-event-actor` / `element-cad-camera-helper` 为本仓从 drawing-2d 拷贝的未发布包
- 需要私有 registry（`hub.designorder.cn`）；本机 `_auth` 勿提交
- 关闭画布会 dispose Viewer：idoc 无法从 store 自动恢复（需重新上传）；CadModel 可从 store 恢复

- `packages/element-cad-event-actor` / `camera-helper` 已从 drawing-2d 拷贝入库，但 v1 bootstrap 未启用（缺大量未发布依赖）；只读渲染走 element-cad-core + calculator
- TypeScript 对 `@do-design/d-model` / `d-render` 使用 shims，避免 tsc 进入其源码
