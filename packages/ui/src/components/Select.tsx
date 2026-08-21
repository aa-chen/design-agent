import { Select as AntdSelect } from 'antd';
import type { SelectProps as AntdSelectProps } from 'antd';

export interface SelectProps<ValueType = unknown>
  extends AntdSelectProps<ValueType> {}

export function Select<ValueType = unknown>(props: SelectProps<ValueType>) {
  return <AntdSelect {...props} />;
}

export default Select;
