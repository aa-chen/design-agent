import '../shims/node-globals';
import { bridgeCadElementRegistry } from './bridgeCadElementRegistry';
import { resolveCadCoreExports } from './resolveCadCoreExports';
import * as cadCoreModule from '@do-design/element-cad-core';
import '@do-design/element-cad-calculator';

let registered = false;

/**
 * 注册 CAD Element / Calculator，使 IDocFile `_ctor_` 可反序列化。
 * core dist 内嵌 d-model → 需 bridge；calculator dist 走外部 d-model，side-effect 即可。
 */
export function registerCadKernel(): void {
  if (registered) return;
  bridgeCadElementRegistry(resolveCadCoreExports(cadCoreModule as Record<string, unknown>));
  registered = true;
}

export function isCadKernelRegistered(): boolean {
  return registered;
}
