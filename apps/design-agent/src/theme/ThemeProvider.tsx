import { DesignProvider } from '@da/ui';
import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '../stores/themeStore';

/** 同步主题到 document 并注入 antd 主题配置 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return <DesignProvider themeMode={mode}>{children}</DesignProvider>;
}
