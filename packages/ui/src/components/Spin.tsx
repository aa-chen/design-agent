import { Spin as AntdSpin } from 'antd';
import type { SpinProps as AntdSpinProps } from 'antd';

export interface SpinProps extends AntdSpinProps {}

export function Spin(props: SpinProps) {
  return <AntdSpin {...props} />;
}

export default Spin;
