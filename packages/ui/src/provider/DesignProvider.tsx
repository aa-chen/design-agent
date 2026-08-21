import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

export interface DesignProviderProps {
  children: ReactNode;
  /** 品牌主色，默认 #1677ff */
  primaryColor?: string;
  /** 圆角 */
  borderRadius?: number;
}

/**
 * 全局设计上下文：antd ConfigProvider 主题 + App（message/modal 上下文）+ 中文语言包。
 * 应用根节点用 <DesignProvider> 包裹。
 */
export function DesignProvider({
  children,
  primaryColor = '#1677ff',
  borderRadius = 6,
}: DesignProviderProps) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: primaryColor, borderRadius } }}
    >
      {/* component={false} 不渲染 .ant-app 包裹 div，避免打断 #root → 应用根布局 的 100% 高度链 */}
      <AntdApp component={false}>{children}</AntdApp>
    </ConfigProvider>
  );
}
