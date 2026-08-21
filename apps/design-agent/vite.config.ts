import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { defineConfig } from 'vite';

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
  },
});
