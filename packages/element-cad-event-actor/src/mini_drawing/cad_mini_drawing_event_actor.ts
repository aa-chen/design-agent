import { EN_HIGHLIGHT_STRATEGY, IElementEventContext, multiSelectTool, registerElementEventActor } from '@do-design/d-model';
import { CadBaseElementEventActor, CadMiniDrawingElement } from '@do-design/element-cad-core';
import { Plane, Vector2 } from '@do-math/core';
import { DragAction } from './drag_action';

@registerElementEventActor(CadMiniDrawingElement)
export class CadMiniDrawingEventActor extends CadBaseElementEventActor {
    private _plane: Plane = Plane.XOY();

    private _dragStart: Vector2 = Vector2.O();

    private _dragAction: DragAction;

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        // 鼠标移动的时候默认整体
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
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

    public async onDragStart({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);

        if (!(master instanceof CadMiniDrawingElement)) {
            return;
        }
        const worldPt = view.screenToNearPlane(screenPos);
        this._dragStart = this._plane.getUVAt(worldPt);
        this._dragAction = new DragAction(master);
        await this._dragAction.prepare();
    }

    public async onDragMove({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);
        if (!(master instanceof CadMiniDrawingElement) || !this._dragStart) {
            return;
        }

        const worldPt = view.screenToNearPlane(screenPos);
        const curPt = this._plane.getUVAt(worldPt);

        this._dragAction.assimulate(this._dragStart, curPt);
        view.getDocument().updateView();
    }

    public async onDragEnd({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);
        if (!(master instanceof CadMiniDrawingElement) || !this._dragStart) {
            return;
        }
        const worldPt = view.screenToNearPlane(screenPos);
        const curPt = this._plane.getUVAt(worldPt);
        await this._dragAction.finish(this._dragStart, curPt);
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }
}
