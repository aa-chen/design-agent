/** @do-design CJS 包在浏览器中需要 Node 全局 `global`。 */
const g = globalThis as typeof globalThis & { global?: typeof globalThis };
if (g.global === undefined) g.global = globalThis;
