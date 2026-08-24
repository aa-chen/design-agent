import { BaseElementEventActor, IElementEventContext, registerElementEventActor } from '@do-design/d-model';

import { CatiaRoughness, getCatiaRoughnessEditEndpoint } from '@do-design/element-cad-core';

@registerElementEventActor(CatiaRoughness)
export class CatiaRoughnessEventActor extends BaseElementEventActor {
    public async onDblClick({ gnode, view, screenPos, fnKey, tmpElementPainter }: IElementEventContext): Promise<void> {
        const ele = view.getDocument().getElementById(gnode.elementId) as CatiaRoughness;
        getCatiaRoughnessEditEndpoint().startEdit(ele);

        // view.getDocument().updateView();
    }
}
