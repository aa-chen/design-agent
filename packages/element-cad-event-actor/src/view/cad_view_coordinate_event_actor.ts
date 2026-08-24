import {
    registerElementEventActor,
    IElementEventContext,
    DBElement,
    IGraphicElement,
    multiSelectTool,
    EN_HIGHLIGHT_STRATEGY,
} from '@do-design/d-model';
import {
    CadBoxSnapElementEventActor,
    CadViewCoordinate,
} from '@do-design/element-cad-core';
import { Box2, Line2d } from '@do-math/core';


@registerElementEventActor(CadViewCoordinate)
export class CadViewCoordinateEventActor extends CadBoxSnapElementEventActor<CadViewCoordinate> {

    public async onDragEnd(ctx: IElementEventContext): Promise<void> {}

    public async onLButtonDown({gnode, view}: IElementEventContext): Promise<void> {}

    public async onBlur({ view, gnode }: IElementEventContext): Promise<void> {}

    public async onMouseMove({gnode, view}: IElementEventContext): Promise<void> {}

    public async onDblClick({ gnode, view, screenPos }: IElementEventContext): Promise<void> {}

    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.DEFAULT);
        } else {
            const doc = view.getDocument();
            const master = doc.getElementById(gnode.elementId);

            if (!(master instanceof CadViewCoordinate)) {
                return;
            }
            view.getSelectionGNodeManager().reset({id: gnode.elementId.asInt()});
        }
        view.getDocument().updateView();
    }

    public isCorrectElement(e: CadViewCoordinate | undefined): boolean {
        return e instanceof CadViewCoordinate;
    }

    public async getBoundingBox(e: CadViewCoordinate): Promise<Box2> {
        return e.getBoundingBox();
    }

    public collectDragableElements(e: CadViewCoordinate): IGraphicElement<DBElement>[] {
        return [e];
    }

    public getSnaplines(e: CadViewCoordinate): Line2d[] {
        return [];
    }
      
}
