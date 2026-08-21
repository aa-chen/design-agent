import { Skeleton as AntdSkeleton } from 'antd';
import type { SkeletonProps as AntdSkeletonProps } from 'antd';

export interface SkeletonProps extends AntdSkeletonProps {}

export function Skeleton(props: SkeletonProps) {
  return <AntdSkeleton {...props} />;
}

export default Skeleton;
