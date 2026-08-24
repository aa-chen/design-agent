import { IElementEventContext, transact } from '@do-design/d-model';
import {
    CadDrawingElement,
    CadMiniDrawingElement,
    CadViewElement,
    CadViewGroupElement,
    EN_VIEW_OPERATION_TYPE,
} from '@do-design/element-cad-core';
import { Interval, Line2d, Matrix4, Vector2, Vector3 } from '@do-math/core';
import { IDragActor } from './i_drag_actor';
import { EN_VIEW_TYPE } from '@do-lib/global-interface';

export class ViewAlignLockActor implements IDragActor {
    private _dragStart: Vector3 = Vector3.O();

    public async onDragStart(ctx: IElementEventContext): Promise<void> {
        const { view, screenPos, gnode } = ctx;
        const doc = view.getDocument();
        const viewElement = doc.getElementById(gnode.elementId);
        if (!(viewElement instanceof CadViewElement)) {
            return;
        }

        this._dragStart = view.screenToNearPlane(screenPos);
        // this._hiddenStyle(view, 'drag');
    }

    public async onDragMove(ctx: IElementEventContext): Promise<void> {
        const { gnode, view, screenPos, tmpElementPainter } = ctx;
        tmpElementPainter.clearTmp();
        const appendTmpGNodes = (views: CadViewElement[], offset: Vector3) => {
            views.forEach((v) => {
                if (v.isVisible()) {
                    const m4 = Matrix4.makeTranslate(new Vector3(offset.x, offset.y, 0));
                    view.updateElementTransformationDynamic(v.id, m4);
                    const children = v.getChildren();
                    children.forEach((child) => view.updateElementTransformationDynamic(child.id, m4));
                }
            });
        };
        const curPos = view.screenToNearPlane(screenPos);
        const doc = view.getDocument();
        // 获取关联视口
        const drawingView = doc.getElementById(gnode.elementId);
        if (!(drawingView instanceof CadViewElement)) {
            return;
        }
        const offset = curPos.subtracted(this._dragStart);

        // appendTmpGNodes([drawingView], offset);
        // doc.updateView();

        // const vhOffset = this._getvhVector(offset);
        const drawing = this._getDrawing(drawingView)!;
        if (!drawing) {
            return;
        }
        // const allViews = (doc.getElementsByIds(drawing.db.drawingViewIds) as CadViewElement[]).filter(
        //     (v) => v.getGroupId() === drawingView.getGroupId(),
        // );
        const allViews = drawing
            .getViews(false)
            .filter(
                (v) =>
                    v.getGroupId() === drawingView.getGroupId() ||
                    v.db.operationType !== EN_VIEW_OPERATION_TYPE.NONE ||
                    ![
                        EN_VIEW_TYPE.FRONT,
                        EN_VIEW_TYPE.BACK,
                        EN_VIEW_TYPE.TOP,
                        EN_VIEW_TYPE.BOTTOM,
                        EN_VIEW_TYPE.LETF,
                        EN_VIEW_TYPE.RIGHT,
                    ].includes(v.getViewType()),
            );
        // 主视图
        if (drawingView.isPrimaryView() && drawingView.db.operationType === EN_VIEW_OPERATION_TYPE.NONE) {
            appendTmpGNodes(allViews, offset);
        } else if (drawingView.isSideView() || drawingView.isPitchView() || drawingView.isBackView()) {
            const primaryView = allViews.find((view) => view.isPrimaryView());
            const offsetComp = offset.clone();
            if (primaryView) {
                const box = drawingView.getProjectBoundingBox();
                const xRange = new Interval(box.min.x, box.max.x);
                const yRange = new Interval(box.min.y, box.max.y);
                const primaryBox = primaryView.getProjectBoundingBox();
                const primaryXRange = new Interval(primaryBox.min.x, primaryBox.max.x);
                const primaryYRange = new Interval(primaryBox.min.y, primaryBox.max.y);
                const tol = 1;
                if (
                    Math.abs(xRange.getLength() - primaryXRange.getLength()) < tol &&
                    Math.abs(xRange.getMid() - primaryXRange.getMid()) < tol
                ) {
                    offsetComp.x = 0;
                } else if (
                    Math.abs(yRange.getLength() - primaryYRange.getLength()) < tol &&
                    Math.abs(yRange.getMid() - primaryYRange.getMid()) < tol
                ) {
                    offsetComp.y = 0;
                }
            }
            appendTmpGNodes([drawingView], offsetComp);
        } else if (!drawingView.db.moveDir.equals(Vector2.O())) {
            const offsetComp = offset.clone();
            const dir = drawingView.db.moveDir.normalized();
            const d = new Line2d(Vector2.O(), dir, [-16, 1e6]);
            const off = Vector3.XY(d.getProjectedPtBy(offsetComp));
            appendTmpGNodes([drawingView], off);
        } else {
            appendTmpGNodes([drawingView], offset);
        }
        view.getDocument().updateView();
    }

    public async onDragEnd(ctx: IElementEventContext): Promise<void> {
        const { gnode, view, screenPos, tmpElementPainter } = ctx;
        // 清理画布
        tmpElementPainter.clearTmp();
        // 计算偏移(水平、垂直方向)
        const curPos = view.screenToNearPlane(screenPos);
        const offset = curPos.subtracted(this._dragStart);
        // 获取关联视口
        const doc = view.getDocument();
        const drawingView = view.getDocument().getElementById(gnode.elementId);
        if (!(drawingView instanceof CadViewElement)) {
            return;
        }
        const drawing = this._getDrawing(drawingView);
        if (drawing) {
            // const allViews = (doc.getElementsByIds(drawing.db.drawingViewIds) as CadViewElement[]).filter(
            //     (v) => v.getGroupId() === drawingView.getGroupId(),
            // );
            const allViews = drawing
                .getViews(false)
                .filter(
                    (v) =>
                        v.getGroupId() === drawingView.getGroupId() ||
                        v.db.operationType !== EN_VIEW_OPERATION_TYPE.NONE ||
                        ![
                            EN_VIEW_TYPE.FRONT,
                            EN_VIEW_TYPE.BACK,
                            EN_VIEW_TYPE.TOP,
                            EN_VIEW_TYPE.BOTTOM,
                            EN_VIEW_TYPE.LETF,
                            EN_VIEW_TYPE.RIGHT,
                        ].includes(v.getViewType()),
                );
            await transact(doc, 'drawingView dragEnd', () => {
                // 主视图
                if (drawingView.isPrimaryView() && drawingView.db.operationType === EN_VIEW_OPERATION_TYPE.NONE) {
                    allViews.forEach((v) => v.translate(offset));
                } else if (drawingView.isSideView() || drawingView.isPitchView() || drawingView.isBackView()) {
                    const primaryView = allViews.find((v) => v.isPrimaryView());
                    const offsetComp = offset.clone();
                    if (primaryView) {
                        const box = drawingView.getProjectBoundingBox();
                        const xRange = new Interval(box.min.x, box.max.x);
                        const yRange = new Interval(box.min.y, box.max.y);
                        const primaryBox = primaryView.getProjectBoundingBox();
                        const primaryXRange = new Interval(primaryBox.min.x, primaryBox.max.x);
                        const primaryYRange = new Interval(primaryBox.min.y, primaryBox.max.y);
                        const tol = 1;
                        if (
                            Math.abs(xRange.getLength() - primaryXRange.getLength()) < tol &&
                            Math.abs(xRange.getMid() - primaryXRange.getMid()) < tol
                        ) {
                            offsetComp.x = 0;
                        } else if (
                            Math.abs(yRange.getLength() - primaryYRange.getLength()) < tol &&
                            Math.abs(yRange.getMid() - primaryYRange.getMid()) < tol
                        ) {
                            offsetComp.y = 0;
                        }
                    }
                    drawingView.translate(offsetComp);
                } else if (!drawingView.db.moveDir.equals(Vector2.O())) {
                    const offsetComp = offset.clone();
                    const dir = drawingView.db.moveDir.normalized();
                    const d = new Line2d(Vector2.O(), dir, [-16, 1e6]);
                    const off = Vector3.XY(d.getProjectedPtBy(offsetComp));
                    drawingView.translate(off);
                } else {
                    drawingView.translate(offset);
                }
            });

            view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
            view.getDocument().updateView();
        }
        // this._recoverStyle(view);
    }

    private _getDrawing(drawingView: CadViewElement): CadDrawingElement | CadMiniDrawingElement | CadViewGroupElement | undefined {
        const parent =
            drawingView.getAncestorByCtor(CadViewGroupElement) ||
            drawingView.getAncestorByCtor(CadMiniDrawingElement) ||
            drawingView.getAncestorByCtor(CadDrawingElement);
        return parent;
    }
}
