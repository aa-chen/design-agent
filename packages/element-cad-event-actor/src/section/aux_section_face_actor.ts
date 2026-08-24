import { BaseElementEventActor, IElementEventContext, registerElementEventActor } from '@do-design/d-model';
import { Line3d, Matrix4, Vector3 } from '@do-math/core';
import { AuxSectionFace } from '@do-design/element-cad-core';

@registerElementEventActor(AuxSectionFace)
export class CadMiniDrawingEventActor extends BaseElementEventActor {
    protected _snapTol = 50;

    private _dragStart: Vector3 | undefined;

    private _normalLine: Line3d;

    public async onDragStart({ view, gnode, screenPos, fnKey }: IElementEventContext): Promise<void> {
        // 只有左键时触发
        if (fnKey.buttons !== 1) {
            this._dragStart = undefined;
            return;
        }
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId) as AuxSectionFace;

        if (!(master instanceof AuxSectionFace)) {
            return;
        }
        const face = master.getFaces()[1];
        if (!face) {
            return;
        }
        const worldPt = view.screenToNearPlane(screenPos);
        const center = face.getCentroidPoint();
        const normal = face.getCenterNorm();
        this._normalLine = new Line3d(center, normal, [0, 1]);
        this._dragStart = this._normalLine.getProjectedPtBy(worldPt);
    }

    public async onDragMove({ view, gnode, screenPos }: IElementEventContext): Promise<void> {
        if (!this._dragStart) {
            return;
        }
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId) as AuxSectionFace;

        if (!(master instanceof AuxSectionFace)) {
            return;
        }
        const face = master.getFaces()[1];
        if (!face) {
            return;
        }
        const worldPt = view.screenToNearPlane(screenPos);
        const offset = this._getOffset(worldPt);
        view.updateElementTransformationDynamic(master.id, Matrix4.makeTranslate(offset));
    }

    public async onDragEnd({ view, gnode, screenPos }: IElementEventContext): Promise<void> {
        if (!this._dragStart) {
            return;
        }
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId) as AuxSectionFace;

        if (!(master instanceof AuxSectionFace)) {
            return;
        }
        const face = master.getFaces()[1];
        if (!face) {
            return;
        }
        const worldPt = view.screenToNearPlane(screenPos);
        const offset = this._getOffset(worldPt);
        master.translate(offset);
        master.update();
        view.getSelectionGNodeManager().reset({ id: master.id.asInt() });
        view.getHighlightGNodeManager().reset({ id: master.id.asInt() });
        view.getDocument().updateView();
    }

    private _getOffset(end: Vector3): Vector3 {
        if (!this._dragStart || !this._normalLine) {
            return Vector3.O();
        }
        const p = this._normalLine.getProjectedPtBy(end);
        return p.subtracted(this._dragStart);
    }
}
