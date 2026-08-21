import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { ClientRequest } from 'node:http';
import path from 'node:path';
import { defineConfig, type ProxyOptions } from 'vite';

const dshTarget = process.env.VITE_DSH_PROXY_TARGET || 'http://127.0.0.1:3080';

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
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@da/ui': path.resolve(import.meta.dirname, '../../packages/ui/src/index.ts'),
      '@da/cad-core': path.resolve(
        import.meta.dirname,
        '../../packages/cad-core/src/index.ts',
      ),
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
});
