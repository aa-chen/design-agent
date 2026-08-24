import type { Class } from '@do-design/d-model';
import { flushDbCache, type DbLike } from './rebindDbAccessorsToCreateGate';
import { isCreateGateOpen } from './createGate';

/**
 * 沿原型链找到内嵌 d-model 的 Element 基类（webpack 下常为压缩名）。
 */
export function findEmbeddedElementBase(sampleCtor: Class): Class {
  let current: Class | null = sampleCtor;
  while (current) {
    const parent = Object.getPrototypeOf(current) as Class | null;
    if (!parent || parent === Function.prototype) {
      return current;
    }
    current = parent;
  }
  throw new Error('无法定位内嵌 Element 基类');
}

/**
 * element-cad-core dist 内嵌 Element 检查自己的 Ve.canCreate；
 * 应用侧 DocSaver 设置的是另一份 __CAN_CREATE。
 * 将直接继承内嵌 Element 的类改挂到跟随本地 createGate 的 PatchedElement。
 */
export function patchEmbeddedElementCreateGate(
  cadCoreExports: Record<string, unknown>,
): void {
  let sample: Class | null = null;
  for (const value of Object.values(cadCoreExports)) {
    if (typeof value === 'function' && (value as { _meta_?: unknown })._meta_) {
      sample = value as Class;
      break;
    }
  }
  if (!sample) {
    throw new Error('element-cad-core 中无带 _meta_ 的 Element 类，无法 patch');
  }

  const EmbeddedElement = findEmbeddedElementBase(sample);
  // 恢复被误改的 constructor（旧版 patch 曾写成 PatchedElement，导致 collectCalculators 死循环）
  if (EmbeddedElement.prototype.constructor !== EmbeddedElement) {
    try {
      EmbeddedElement.prototype.constructor = EmbeddedElement;
    } catch {
      // ignore
    }
  }
  if ((EmbeddedElement as { __daPatchedCreateGate?: boolean }).__daPatchedCreateGate) {
    return;
  }

  const proto = EmbeddedElement.prototype as {
    constructor: Class;
    __createElementDB?: () => unknown;
  };

  function PatchedElement(this: {
    _db?: DbLike;
    __createElementDB?: () => DbLike;
    constructor: { name: string };
  }) {
    if (!isCreateGateOpen()) {
      throw new Error(
        `请使用pm.app.document.create(${this.constructor.name}).init()创建Element\n报告人:tiansk\n报告时间：2020-04-13\n点击确定可debug`,
      );
    }
    if (!this.__createElementDB) {
      throw new Error('PatchedElement: 缺少 __createElementDB');
    }
    const db = this.__createElementDB();
    flushDbCache(db);
    this._db = db;
  }

  Object.setPrototypeOf(PatchedElement, Object.getPrototypeOf(EmbeddedElement));
  PatchedElement.prototype = proto;
  // 勿改 proto.constructor：collectCalculators 靠 constructor === EmbeddedElement 终止遍历
  (PatchedElement as { __daPatchedCreateGate?: boolean }).__daPatchedCreateGate = true;
  (EmbeddedElement as { __daPatchedCreateGate?: boolean }).__daPatchedCreateGate = true;

  const rewired = new WeakSet<object>();
  for (const value of Object.values(cadCoreExports)) {
    if (typeof value !== 'function') continue;
    let child: object = value;
    let parent: object | null = Object.getPrototypeOf(child);
    while (parent && parent !== Function.prototype) {
      if (parent === EmbeddedElement) {
        if (!rewired.has(child)) {
          Object.setPrototypeOf(child, PatchedElement);
          rewired.add(child);
        }
        break;
      }
      child = parent;
      parent = Object.getPrototypeOf(child);
    }
  }
}
