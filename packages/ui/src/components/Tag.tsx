import { Tag as AntdTag } from 'antd';
import type { TagProps as AntdTagProps } from 'antd';

export interface TagProps extends AntdTagProps {}

export function Tag(props: TagProps) {
  return <AntdTag {...props} />;
}

export default Tag;
