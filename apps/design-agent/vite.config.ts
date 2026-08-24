import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';
import type { ClientRequest } from 'node:http';
import path from 'node:path';
import { defineConfig, type ProxyOptions } from 'vite';

const dshTarget = process.env.VITE_DSH_PROXY_TARGET || 'http://127.0.0.1:3080';

const repoRoot = path.resolve(import.meta.dirname, '../../');
const cadViewerNm = path.join(repoRoot, 'packages/cad-viewer/node_modules');

/** 私有包优先 dist；无 dist 时回退 src。不走 require.resolve（部分包 exports 指向不存在的 dist）。 */
function resolveDoEntry(pkgName: string): string {
  const pkgDir = path.join(cadViewerNm, ...pkgName.split('/'));
  const dist = path.join(pkgDir, 'dist/index.js');
  if (existsSync(dist)) return dist;
  const src = path.join(pkgDir, 'src/index.ts');
  if (existsSync(src)) return src;
  throw new Error(`Cannot resolve entry for ${pkgName} under ${pkgDir}`);
}

const doDesignAliases: Record<string, string> = {
  '@do-design/d-model': resolveDoEntry('@do-design/d-model'),
  '@do-design/d-render': resolveDoEntry('@do-design/d-render'),
  '@do-design/element-cad-core': resolveDoEntry('@do-design/element-cad-core'),
  '@do-design/element-cad-calculator': resolveDoEntry('@do-design/element-cad-calculator'),
  '@do-design/client-server': resolveDoEntry('@do-design/client-server'),
  '@do-design/d-net-common': resolveDoEntry('@do-design/d-net-common'),
  '@do-math/core': resolveDoEntry('@do-math/core'),
  '@do-math/brep': resolveDoEntry('@do-math/brep'),
};

/**
 * 仅 TS 源码包需预构建：esbuild 擦掉 `export { IShellModelingResult }` 等 interface 导出。
 * 已 alias 到 dist 的 @do-design/* 不要放进 include（会触发 CJS require 链解析失败）。
 */
const prebundleSrcPackages = ['@do-math/core', '@do-math/brep', '@do-design/d-net-common'];

/**
 * DeepSeek Harness 会校验 Origin.host === Host（防跨站）。
 * Vite `changeOrigin` 把 Host 改成 3080，但浏览器 Origin 仍是 5173，上游会 403。
 * 代理时把 Origin 改成与 target 同源，HTTP 与 WebSocket 都要改。
 */
function alignDshOrigin(proxyReq: ClientRequest) {
  proxyReq.setHeader('origin', dshTarget.replace(/\/$/, ''));
  proxyReq.setHeader('sec-fetch-site', 'same-origin');
}

const dshProxy: ProxyOptions = {
  target: dshTarget,
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/dsh/, ''),
  ws: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyReq) => alignDshOrigin(proxyReq));
    proxy.on('proxyReqWs', (proxyReq) => alignDshOrigin(proxyReq));
  },
};

// 开发态将 workspace 包直引源码，保证 HMR 无需 build
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@da/ui': path.resolve(import.meta.dirname, '../../packages/ui/src/index.ts'),
      '@da/cad-core': path.resolve(
        import.meta.dirname,
        '../../packages/cad-core/src/index.ts',
      ),
      '@da/cad-viewer': path.resolve(
        import.meta.dirname,
        '../../packages/cad-viewer/src/index.ts',
      ),
      ...doDesignAliases,
    },
  },
  optimizeDeps: {
    include: ['three', ...prebundleSrcPackages],
    esbuildOptions: {
      target: 'es2022',
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    target: 'es2022',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        intro: 'globalThis.global = globalThis;',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/dsh': dshProxy,
    },
  },
  preview: {
    proxy: {
      '/dsh': dshProxy,
    },
  },
  // Vitest reads this; not part of Vite's UserConfig types until vitest is installed.
  // @ts-expect-error vitest test config
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
