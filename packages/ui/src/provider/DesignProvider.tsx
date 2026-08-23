import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface DesignProviderProps {
  children: ReactNode;
  /** 明暗模式 */
  themeMode?: ThemeMode;
  /** 品牌主色（未指定时随 themeMode 使用黑白主色） */
  primaryColor?: string;
  /** 圆角 */
  borderRadius?: number;
}

const MONO_TOKENS: Record<ThemeMode, { primary: string; primaryHover: string; primaryActive: string }> = {
  light: { primary: '#171717', primaryHover: '#404040', primaryActive: '#000000' },
  dark: { primary: '#f5f5f5', primaryHover: '#e5e5e5', primaryActive: '#ffffff' },
};

/**
 * 全局设计上下文：antd ConfigProvider 主题 + App（message/modal 上下文）+ 中文语言包。
 * 应用根节点用 <DesignProvider> 包裹。
 */
export function DesignProvider({
  children,
  themeMode = 'light',
  primaryColor,
  borderRadius = 6,
}: DesignProviderProps) {
  const mono = MONO_TOKENS[themeMode];
  const isDark = themeMode === 'dark';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: primaryColor ?? mono.primary,
          colorPrimaryHover: mono.primaryHover,
          colorPrimaryActive: mono.primaryActive,
          colorBgContainer: isDark ? '#141414' : '#ffffff',
          colorBgElevated: isDark ? '#1a1a1a' : '#ffffff',
          colorBgLayout: isDark ? '#0a0a0a' : '#fafafa',
          colorBorder: isDark ? '#262626' : '#e5e5e5',
          colorText: isDark ? '#f5f5f5' : '#171717',
          colorTextSecondary: isDark ? '#a3a3a3' : '#737373',
          borderRadius,
        },
      }}
    >
      {/* component={false} 不渲染 .ant-app 包裹 div，避免打断 #root → 应用根布局 的 100% 高度链 */}
      <AntdApp component={false}>{children}</AntdApp>
    </ConfigProvider>
  );
}
