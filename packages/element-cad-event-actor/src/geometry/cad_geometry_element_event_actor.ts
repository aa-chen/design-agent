import {
    BaseElementEventActor,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    multiSelectTool,
    registerElementEventActor,
} from '@do-design/d-model';

import {
    applyHoleProjectionSelectionRedirect,
    CadArc,
    CadArcs,
    CadCenterLines,
    CadCircle,
    CadCircles,
    CadHatch,
    CadHoles,
    CadLine,
    CadLines,
    CadPolylines,
    CadPolyline,
} from '@do-design/element-cad-core';


@registerElementEventActor(CadArc)
@registerElementEventActor(CadArcs)
@registerElementEventActor(CadCircle)
@registerElementEventActor(CadCircles)
@registerElementEventActor(CadHatch)
@registerElementEventActor(CadLine)
@registerElementEventActor(CadLines)
@registerElementEventActor(CadCenterLines)
@registerElementEventActor(CadPolyline)
@registerElementEventActor(CadPolylines)
@registerElementEventActor(CadHoles)
export class CadGeometryElementEventActor extends BaseElementEventActor {
    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.DEFAULT);
        } else {
            multiSelectTool.singleSelect(gnode, screenPos, view, tmpElementPainter);
        }
        applyHoleProjectionSelectionRedirect(view, gnode);
        view.getDocument().updateView();
    }
}
