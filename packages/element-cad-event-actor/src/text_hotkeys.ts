import { EN_CMD_IDS } from '@do-design/d-sdk';
import { EN_HOTKEY_GROUP, IHotKeyData } from '@do-types/core-types';

export const textHotkeys: IHotKeyData[] = [
    {
        key: 'up',
        defaultHotKey: 'up',
        meta: {
            group: EN_HOTKEY_GROUP.CHANGE,
            name: '向上移',
        },
        executeMethod: {
            cmdName: EN_CMD_IDS.CMD_ARROW_MOVE,
            cmdParam: {
                arrowType: 'up',
                moveLength: 0.5,
            },
        },
    },
    {
        key: 'down',
        defaultHotKey: 'down',
        meta: {
            group: EN_HOTKEY_GROUP.CHANGE,
            name: '向下移',
        },
        executeMethod: {
            cmdName: EN_CMD_IDS.CMD_ARROW_MOVE,
            cmdParam: {
                arrowType: 'down',
                moveLength: 0.5,
            },
        },
    },
    {
        key: 'left',
        defaultHotKey: 'left',
        meta: {
            group: EN_HOTKEY_GROUP.CHANGE,
            name: '向左移',
        },
        executeMethod: {
            cmdName: EN_CMD_IDS.CMD_ARROW_MOVE,
            cmdParam: {
                arrowType: 'left',
                moveLength: 0.5,
            },
        },
    },
    {
        key: 'right',
        defaultHotKey: 'right',
        meta: {
            group: EN_HOTKEY_GROUP.CHANGE,
            name: '向左移',
        },
        executeMethod: {
            cmdName: EN_CMD_IDS.CMD_ARROW_MOVE,
            cmdParam: {
                arrowType: 'right',
                moveLength: 0.5,
            },
        },
    },
];
