import {
    BaseElementEventActor,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    multiSelectTool,
    registerElementEventActor,
} from '@do-design/d-model';
import { CadDatumHoleDimension } from '@do-design/element-cad-core';

@registerElementEventActor(CadDatumHoleDimension)
export class CadHolePositionDimensionEventActor extends BaseElementEventActor {
    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        } else {
            multiSelectTool.singleSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        }
        view.getDocument().updateView();
    }

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }
}
