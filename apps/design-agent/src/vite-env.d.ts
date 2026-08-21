/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_CLIENT?: 'mock' | 'harness' | string;
  readonly VITE_DSH_HTTP_BASE?: string;
  readonly VITE_DSH_WS_URL?: string;
  readonly VITE_DSH_CWD?: string;
  readonly VITE_DSH_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
