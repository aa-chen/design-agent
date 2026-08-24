import { DocSaver, Document } from '@do-design/d-model';
import { runWithCreateGateOpen, runWithCreateGateOpenAsync } from './createGate';

let hooked = false;

/**
 * DocSaver / Document 翻转的是 dist 内 __CAN_CREATE；桥接 Element 读不到那份。
 * load() 在首个 await 前会同步 _fillQDocument → new Ctor()，闸门必须在调用前打开并保持到 Promise 结束。
 */
export function hookDocumentCreateGate(): void {
  if (hooked) return;
  hooked = true;

  const saverProto = DocSaver.prototype as {
    load: (this: unknown, ...args: unknown[]) => Promise<boolean> | boolean;
  };
  const originalLoad = saverProto.load;

  saverProto.load = function patchedLoad(this: unknown, ...args: unknown[]) {
    return runWithCreateGateOpenAsync(async () => {
      const result = originalLoad.apply(this, args);
      return await Promise.resolve(result);
    });
  };

  const docProto = Document.prototype as {
    create: (this: unknown, ...args: unknown[]) => unknown;
  };
  const originalCreate = docProto.create;
  docProto.create = function patchedCreate(this: unknown, ...args: unknown[]) {
    return runWithCreateGateOpen(() => originalCreate.apply(this, args));
  };
}
