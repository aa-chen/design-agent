import { Modal as AntdModal } from 'antd';
import type { ModalProps as AntdModalProps } from 'antd';

export interface ModalProps extends AntdModalProps {}

export function Modal(props: ModalProps) {
  return <AntdModal {...props} />;
}

export default Modal;
