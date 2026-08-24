import { registerElementEventActor } from '@do-design/d-model';
import { BrokenLineDimension, CadAggregateAlignedDimension, SwAggregateAlignedDimension } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from './cad_dim_event_actor';

@registerElementEventActor(CadAggregateAlignedDimension)
@registerElementEventActor(SwAggregateAlignedDimension)
@registerElementEventActor(BrokenLineDimension)
export class CadAlignedDimensionEventActor extends CadDimensionEventActor {
    // public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
    //     view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
    //     view.getDocument().updateView();
    // }
}
