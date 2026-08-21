import { Empty as AntdEmpty } from 'antd';
import type { EmptyProps as AntdEmptyProps } from 'antd';

export interface EmptyProps extends AntdEmptyProps {}

export function Empty(props: EmptyProps) {
  return <AntdEmpty {...props} />;
}

export default Empty;
