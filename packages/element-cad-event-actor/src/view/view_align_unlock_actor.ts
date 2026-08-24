import { IElementEventContext, transact } from "@do-design/d-model";
import { CadViewElement } from "@do-design/element-cad-core";
import { Matrix4, Vector3 } from "@do-math/core";
import { IDragActor } from "./i_drag_actor";

export class ViewAlignUnlockActor implements IDragActor {
    private _dragStart: Vector3 = Vector3.O();

    public async onDragStart(ctx: IElementEventContext): Promise<void> {
        const { view, screenPos, gnode } = ctx;
        const doc = view.getDocument();
        const viewElement = doc.getElementById(gnode.elementId);
        if (!(viewElement instanceof CadViewElement)) {
            return;
        }

        this._dragStart = view.screenToNearPlane(screenPos);
    }

    public async onDragMove(ctx: IElementEventContext): Promise<void> {
        const { gnode, view, screenPos, tmpElementPainter } = ctx;
        const doc = view.getDocument();
        const drawingView = doc.getElementById(gnode.elementId);
        if (!(drawingView instanceof CadViewElement)) {
            return;
        }
        tmpElementPainter.clearTmp();
        const curPos = view.screenToNearPlane(screenPos);
        const offset = curPos.subtracted(this._dragStart);
        const m4 = Matrix4.makeTranslate(new Vector3(offset.x, offset.y, 0));
        view.updateElementTransformationDynamic(drawingView.id, m4);
        const children = drawingView.getChildren();
        children.forEach((child) => view.updateElementTransformationDynamic(child.id, m4));
    }

    public async onDragEnd(ctx: IElementEventContext): Promise<void> {
        const { gnode, view, screenPos, tmpElementPainter } = ctx;
        const doc = view.getDocument();
        const drawingView = doc.getElementById(gnode.elementId);
        if (!(drawingView instanceof CadViewElement)) {
            return;
        }
        tmpElementPainter.clearTmp();
        const curPos = view.screenToNearPlane(screenPos);
        const offset = curPos.subtracted(this._dragStart);
        const m4 = Matrix4.makeTranslate(new Vector3(offset.x, offset.y, 0));
        await transact(doc, 'drawingView dragEnd(unlock)', () => {
            drawingView.transform(m4);
        });
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }
}