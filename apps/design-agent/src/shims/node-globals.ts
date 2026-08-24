/**
 * @do-design / @do-math 等 CJS 包在浏览器中依赖 Node 全局 `global`。
 * 必须在任何 @do-design 动态 import 之前执行。
 */
const g = globalThis as typeof globalThis & {
  global?: typeof globalThis;
};

if (g.global === undefined) {
  g.global = globalThis;
}
