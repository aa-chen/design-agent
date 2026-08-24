import { EN_HIGHLIGHT_STRATEGY, IElementEventContext, multiSelectTool, registerElementEventActor } from '@do-design/d-model';
import { CadBaseElementEventActor, CadBlockReference } from '@do-design/element-cad-core';
import { createUIInformationBlockModal } from '../information_block_util.ts';

@registerElementEventActor(CadBlockReference)
export class CadBlockEventActor extends CadBaseElementEventActor {
    public async onMouseMove({ view }: IElementEventContext): Promise<void> {
        // view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getHighlightGNodeManager().clear();
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

    public async onDblClick({ gnode }: IElementEventContext): Promise<void> {
        createUIInformationBlockModal(gnode.elementId.asInt());
    }
}
