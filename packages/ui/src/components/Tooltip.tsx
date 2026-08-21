import { Tooltip as AntdTooltip } from 'antd';
import type { TooltipProps as AntdTooltipProps } from 'antd';

export interface TooltipProps extends AntdTooltipProps {}

export function Tooltip(props: TooltipProps) {
  return <AntdTooltip {...props} />;
}

export default Tooltip;
