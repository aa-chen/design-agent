import { elementMeta, getClassByName } from '@do-design/d-model';
import type { Class } from '@do-design/d-model';

type ElementMeta = {
  save?: boolean;
  ctor: string;
  saveLevel?: number;
};

type CadElementClass = Class & { _meta_?: ElementMeta };

/**
 * element-cad-core dist 内嵌一份 d-model，side-effect 注册的 ctor 进不了应用侧的 registry。
 * 从 dist 导出的 Element 类上读取 _meta_ / __createElementDB，写回当前 @do-design/d-model。
 */
export function bridgeCadElementRegistry(
  cadCoreExports: Record<string, unknown>,
): number {
  let bridged = 0;

  for (const value of Object.values(cadCoreExports)) {
    if (typeof value !== 'function') continue;

    const elementClass = value as CadElementClass;
    const meta = elementClass._meta_;
    if (!meta?.ctor) continue;
    if (getClassByName(meta.ctor)) continue;

    const createDb = elementClass.prototype?.__createElementDB as
      | (() => { constructor: Class })
      | undefined;
    if (!createDb) continue;

    const dbClass = createDb().constructor;
    elementMeta(
      meta.ctor,
      dbClass,
      meta.save ?? true,
      meta.saveLevel,
    )(elementClass);
    bridged += 1;
  }

  return bridged;
}
