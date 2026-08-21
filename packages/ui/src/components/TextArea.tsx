import { Input } from 'antd';
import type { TextAreaProps as AntdTextAreaProps } from 'antd/es/input';
import type { ComponentRef, Ref } from 'react';

const { TextArea: AntdTextArea } = Input;

export interface TextAreaProps extends AntdTextAreaProps {}

export type TextAreaRef = ComponentRef<typeof AntdTextArea>;

/** 多行输入。React 19 下以普通 prop 形式透传 ref。 */
export function TextArea({ ref, ...props }: TextAreaProps & { ref?: Ref<TextAreaRef> }) {
  return <AntdTextArea ref={ref} {...props} />;
}

export default TextArea;
