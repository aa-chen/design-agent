/*
 * @Description:
 * @Autor: jialei.jiang
 * @Date: 2023-03-16 13:24:48
 *
 * Copyright (c) 2021 designorder.cn
 */

export interface IUIInformationBlockEndPoint {
    showModal(blockId: number): void;
}

let informationBlockModal: IUIInformationBlockEndPoint;

export function setUIInformationBlock(endPoint: IUIInformationBlockEndPoint): void {
    informationBlockModal = endPoint;
}

export const createUIInformationBlockModal = (blockId: number): void => {
    if (!informationBlockModal) {
        return;
    }

    informationBlockModal.showModal(blockId);
};
