import {
    BaseElementEventActor,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    multiSelectTool,
    registerElementEventActor,
} from '@do-design/d-model';
import { CadOffsetSectionTag } from '@do-design/element-cad-core';

@registerElementEventActor(CadOffsetSectionTag)
export class CadOffsetSectionTagEventActor extends BaseElementEventActor {
    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        // 鼠标移动的时候默认高亮gnode，而不是整体
        view.getHighlightGNodeManager().reset({ id: gnode.elementId.asInt() });
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        } else {
            multiSelectTool.singleSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        }
        view.getDocument().updateView();
    }
}
