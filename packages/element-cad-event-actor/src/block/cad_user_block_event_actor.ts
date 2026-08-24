import {
    BaseElementEventActor,
    IElementEventContext,
    multiSelectTool,
    registerElementEventActor,
    EN_HIGHLIGHT_STRATEGY,
} from '@do-design/d-model';

import { CadUserBlock } from '@do-design/element-cad-core';

@registerElementEventActor(CadUserBlock)
export class CadUserBlockEventActor extends BaseElementEventActor {
    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view, screenPos, fnKey, tmpElementPainter }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.DEFAULT);
        } else {
            const doc = view.getDocument();
            const master = doc.getElementById(gnode.elementId);

            if (!(master instanceof CadUserBlock)) {
                return;
            }

            view.getSelectionGNodeManager().reset(gnode.elementId.asInt());
        }

        view.getDocument().updateView();
    }
}
