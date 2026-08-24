import type { Class } from '@do-design/d-model';
import { isCreateGateOpen } from './createGate';

export type DbLike = {
  _db?: Record<string, unknown>;
  _cachedNewData?: Record<string, unknown>;
};

/**
 * 内嵌 Ve.canCreate=false 时，DB 构造赋值进 _cachedNewData。
 * load/_loadArray 读的是 _db[key]，必须先 flush。
 */
export function flushDbCache(db: DbLike): void {
  const cached = db._cachedNewData;
  const store = db._db;
  if (!cached || !store) return;
  for (const key of Object.keys(cached)) {
    store[key] = cached[key];
    delete cached[key];
  }
}

/**
 * 内嵌 DB accessor 不可重定义且检查 Ve.canCreate。
 * 在 createGate 打开时用 Proxy 把业务字段写入 _db，绕过 Ve。
 */
export function wrapCreateElementDb(elementClass: Class): void {
  const proto = elementClass.prototype as {
    __createElementDB?: () => DbLike;
  };
  const original = proto.__createElementDB;
  if (!original || (original as { __daWrapped?: boolean }).__daWrapped) return;

  const wrapped = function wrappedCreateElementDb(this: unknown) {
    const db = original.call(this);
    flushDbCache(db);
    return createDbProxy(db);
  };
  (wrapped as { __daWrapped?: boolean }).__daWrapped = true;

  try {
    Reflect.defineProperty(proto, '__createElementDB', {
      configurable: true,
      value: wrapped,
    });
  } catch {
    try {
      proto.__createElementDB = wrapped;
    } catch {
      // PatchedElement 仍会 flush；无 Proxy 时依赖 patchEmbeddedIdbLoad
    }
  }
}

function createDbProxy(db: DbLike): DbLike {
  return new Proxy(db, {
    set(target, prop, value) {
      if (
        isCreateGateOpen() &&
        typeof prop === 'string' &&
        !prop.startsWith('_') &&
        prop !== 'constructor'
      ) {
        if (!target._db) target._db = {};
        if (value !== undefined && value !== null) {
          target._db[prop] = value;
        }
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });
}
