import { App } from 'antd';

/**
 * 在 DesignProvider 环境内获取 antd message 实例（用于轻量提示）。
 * 必须在 <DesignProvider> 下的组件中使用。
 */
export function useMessage() {
  return App.useApp().message;
}
