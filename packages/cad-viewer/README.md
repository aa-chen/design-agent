# @da/cad-viewer

只读 CAD Viewer：支持 drawing-2d `IDocFile`（`.pm`）与 `@da/cad-core` CadModel。

## Registry

IDocFile 路径依赖私有包 `@do-design/d-model`、`@do-design/d-render`、`@do-design/element-cad-*`。

根目录 `.npmrc` 需配置 `@do-design` 等 scope 指向 `hub.designorder.cn`。
本机 `//hub.designorder.cn/:_auth=...` 仅用于 `pnpm install`，**不得提交**（含凭证的 `.npmrc` 不要入库）。

## 已知限制（v1）

- idoc 选中 / 属性面板降级为只读 id；未接 d-model 拾取事件
- 未移植 drawing-2d `FixToolImpl` 业务修复
- 需要私有 registry（`hub.designorder.cn`）；本机 `_auth` 勿提交
- 关闭画布会 dispose Viewer：idoc 无法从 store 自动恢复（需重新上传）；CadModel 可从 store 恢复
- 只读渲染走 `element-cad-core` + `element-cad-calculator`；完整交互（event-actor / camera-helper）未接入
- TypeScript 对 `@do-design/d-model` / `d-render` 使用 shims，避免 tsc 进入其源码
