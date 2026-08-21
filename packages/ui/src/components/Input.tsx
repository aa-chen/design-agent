import { Input as AntdInput } from 'antd';
import type { InputProps as AntdInputProps } from 'antd';

export interface InputProps extends AntdInputProps {}

export function Input(props: InputProps) {
  return <AntdInput {...props} />;
}

export default Input;
