import type { Class } from '@do-design/d-model';
import { flushDbCache, type DbLike } from './rebindDbAccessorsToCreateGate';

type LoadArrayFn = (this: DbLike, json: Record<string, unknown>, key: string) => unknown;
type LoadFn = (this: DbLike, json: Record<string, unknown>) => void;

/**
 * 内嵌 IDB._loadArray 在 _db[key] 未初始化时会读 [0] 崩溃（Ve.canCreate 导致默认值只在 cache）。
 * 补丁：缺省时退回 plain JSON；load 前后 flush。
 */
export function patchEmbeddedIdbLoad(cadCoreExports: Record<string, unknown>): void {
  let dbClass: Class | null = null;
  for (const value of Object.values(cadCoreExports)) {
    if (typeof value !== 'function') continue;
    const createDb = (value as Class).prototype?.__createElementDB as
      | (() => { constructor: Class })
      | undefined;
    if (!createDb) continue;
    try {
      dbClass = createDb().constructor;
      break;
    } catch {
      // continue
    }
  }
  if (!dbClass) return;

  let current: Class | null = dbClass;
  while (current && current !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(current.prototype, '_loadArray')) {
      break;
    }
    current = Object.getPrototypeOf(current) as Class | null;
  }
  if (!current || current === Function.prototype) return;
  if ((current as { __daPatchedLoad?: boolean }).__daPatchedLoad) return;

  const proto = current.prototype as {
    _loadArray: LoadArrayFn;
    load: LoadFn;
  };

  const originalLoadArray = proto._loadArray;
  proto._loadArray = function patchedLoadArray(json, key) {
    const bucket = this._db?.[key];
    if (!Array.isArray(bucket)) {
      const raw = json[key];
      return Array.isArray(raw) ? raw : [];
    }
    return originalLoadArray.call(this, json, key);
  };

  const originalLoad = proto.load;
  proto.load = function patchedLoad(json) {
    flushDbCache(this);
    originalLoad.call(this, json);
    flushDbCache(this);
  };

  (current as { __daPatchedLoad?: boolean }).__daPatchedLoad = true;
}
