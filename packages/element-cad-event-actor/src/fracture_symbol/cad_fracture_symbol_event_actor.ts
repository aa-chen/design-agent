import {
    BaseElementEventActor,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    multiSelectTool,
    registerElementEventActor
} from '@do-design/d-model';
import { NxFractureSymbol } from '@do-design/element-cad-core';


@registerElementEventActor(NxFractureSymbol)
export class CadFractureSymbolEventActor extends BaseElementEventActor {

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view, screenPos, fnKey, tmpElementPainter }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        } else {
            multiSelectTool.singleSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        }
        view.getDocument().updateView();
    }

}
