import '@do-design/element-cad-core';
import '@do-design/element-cad-calculator';
// event-actor / camera-helper 已 vendored 到 packages/，但依赖大量未发布 @do-design/*。
// 只读打开优先用 core+calculator；完整交互注册留待后续补齐依赖后再开启：
//   import '@do-design/element-cad-event-actor';
//   import '@do-design/element-cad-camera-helper';

let registered = false;

/**
 * 注册 CAD Element / Calculator，使 IDocFile `_ctor_` 可反序列化。
 * v1 只读：仅 core + calculator（npm 已发布）。
 */
export function registerCadKernel(): void {
  registered = true;
}

export function isCadKernelRegistered(): boolean {
  return registered;
}
