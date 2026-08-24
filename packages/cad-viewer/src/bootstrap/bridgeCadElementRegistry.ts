import { elementMeta, getClassByName } from '@do-design/d-model';
import type { Class } from '@do-design/d-model';
import { hookDocumentCreateGate } from './hookDocumentCreateGate';
import { patchEmbeddedElementCreateGate } from './patchEmbeddedElementCreateGate';
import { patchEmbeddedIdbLoad } from './patchEmbeddedIdbLoad';
import { wrapCreateElementDb } from './rebindDbAccessorsToCreateGate';

type ElementMeta = {
  save?: boolean;
  ctor: string;
  saveLevel?: number;
};

type CadElementClass = Class & { _meta_?: ElementMeta };

/**
 * 内嵌 elementMeta 已把 DB 字段封成 non-configurable accessor；
 * 应用侧 elementMeta → watchPropertiesOfDB 再 defineProperty 会抛 Cannot redefine。
 * 注册期间吞掉 redefine 错误，仍写入 ctor map / __createElementDB。
 */
function registerElementMetaSafe(
  ctorName: string,
  dbClass: Class,
  elementClass: Class,
  save: boolean,
  saveLevel: number | undefined,
): void {
  const objectDefineProperty = Object.defineProperty;
  const reflectDefineProperty = Reflect.defineProperty;

  const softDefine = (
    define: (target: object, property: PropertyKey, attributes: PropertyDescriptor) => unknown,
    target: object,
    property: PropertyKey,
    attributes: PropertyDescriptor,
  ) => {
    try {
      return define(target, property, attributes);
    } catch (e) {
      if (e instanceof TypeError && String(e.message).includes('Cannot redefine')) {
        return false;
      }
      throw e;
    }
  };

  Object.defineProperty = ((target, property, attributes) =>
    softDefine(
      objectDefineProperty as (t: object, p: PropertyKey, a: PropertyDescriptor) => object,
      target as object,
      property,
      attributes as PropertyDescriptor,
    ) || target) as typeof Object.defineProperty;

  Reflect.defineProperty = ((target, property, attributes) =>
    softDefine(
      reflectDefineProperty as (t: object, p: PropertyKey, a: PropertyDescriptor) => boolean,
      target,
      property,
      attributes,
    ) !== false) as typeof Reflect.defineProperty;

  try {
    elementMeta(ctorName, dbClass, save, saveLevel)(elementClass);
  } finally {
    Object.defineProperty = objectDefineProperty;
    Reflect.defineProperty = reflectDefineProperty;
  }
}

/**
 * element-cad-core dist 内嵌一份 d-model，side-effect 注册的 ctor 进不了应用侧的 registry。
 * 桥接 registry + Element 创建闸门 + DB 构造后 flush。
 */
export function bridgeCadElementRegistry(
  cadCoreExports: Record<string, unknown>,
): number {
  if (!cadCoreExports || typeof cadCoreExports !== 'object') {
    throw new Error('element-cad-core exports 无效');
  }

  hookDocumentCreateGate();
  patchEmbeddedElementCreateGate(cadCoreExports);
  patchEmbeddedIdbLoad(cadCoreExports);

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
    registerElementMetaSafe(
      meta.ctor,
      dbClass,
      elementClass,
      meta.save ?? true,
      meta.saveLevel,
    );
    wrapCreateElementDb(elementClass);
    bridged += 1;
  }

  return bridged;
}
