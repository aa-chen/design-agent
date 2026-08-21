import { Button as AntdButton } from 'antd';
import type { ButtonProps as AntdButtonProps } from 'antd';

export interface ButtonProps extends AntdButtonProps {}

/** 主按钮：@da/ui 统一入口，底层为 antd Button */
export function Button(props: ButtonProps) {
  return <AntdButton {...props} />;
}

export default Button;
