import { Dropdown as AntdDropdown } from 'antd';
import type { DropdownProps as AntdDropdownProps } from 'antd';

export interface DropdownProps extends AntdDropdownProps {}

export function Dropdown(props: DropdownProps) {
  return <AntdDropdown {...props} />;
}

export default Dropdown;
