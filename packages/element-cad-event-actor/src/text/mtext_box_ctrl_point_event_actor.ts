/*
 ###############################################################################
 #                                                                             #
 # File Created: 2022-08-03 13:52:20                                           #
 #                                                                             #
 # Author: zhuxiaomin                                                          #
 #                                                                             #
 # Description:                                                                #
 #                                                                             #
 # Copyright (c) 2022 designorder.cn                                           #
 #                                                                             #
 ###############################################################################
 */
import { CONST, Matrix4, Plane, Vector2, Vector3 } from '@do-math/core';
import {
    registerElementEventActor,
    BaseElementEventActor,
    IElementEventContext,
    transact,
    TmpElementPainter,
    ISysWindow,
    PickFilter,
    multiSelectTool,
    EN_HIGHLIGHT_STRATEGY,
} from '@do-design/d-model';
import { EN_SNAP_TYPE, SnapCandidates, SnapContext, SnapEngine, SnapSetting } from '@do-design/d-snap';
import { CadMText, MTextBoxCtrlPoint, MTextBoxAuxLine } from '@do-design/element-cad-core';
import { EN_ACTIVE_ELEMENT_STYLE, EN_RENDER_AREA, GNODE_TYPE } from '@do-types/core-types';
import { GPoint3d, GRep } from '@do-design/d-render';

@registerElementEventActor(MTextBoxCtrlPoint)
export class MTextBoxCtrlPointEventActor extends BaseElementEventActor {
    private _dragStart: Vector3;

    private _snapEngine = new SnapEngine();

    private _snapContext = new SnapContext();

    private _pickFilter = new PickFilter();

    private _eID = -1;

    private _shiftKey = false;

    constructor() {
        super();
        this._snapEngine.disAllow(GNODE_TYPE.GMesh, GNODE_TYPE.GText, GNODE_TYPE.GFace);
        this._snapContext.snapPlane = Plane.XOY();
        this._pickFilter.allow(GNODE_TYPE.GEdge).allow(GNODE_TYPE.GPoint3d).allow(GNODE_TYPE.GCurve3d).allow(GNODE_TYPE.GCurves);
        this._pickFilter.setCustomizedFilter((gnode) => gnode.elementId.asInt() !== this._eID);
    }

    public async onClick({ view, fnKey, tmpElementPainter, screenPos, gnode }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.DEFAULT);
        } else {
            const doc = view.getDocument();
            const ctrlPoint = doc.getElementById(this._eID) as MTextBoxCtrlPoint;
            const master = doc.getElementById(ctrlPoint.getMasterId());
            if (!(master instanceof CadMText)) {
                return;
            }

            const nodes = ctrlPoint.getGNodesWhenSelected().map((c) => ({ ...c, style: EN_ACTIVE_ELEMENT_STYLE.NONE }));
            const activeElement = { id: ctrlPoint.id.asInt(), nodes };

            view.getSelectionGNodeManager().reset(master.id.asInt(), activeElement);
        }

        view.getRenderView().updateView();
    }

    public async onLButtonDown({ gnode }: IElementEventContext): Promise<void> {
        this._eID = gnode.elementId.asInt();
    }

    public async onBlur({ view, gnode }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const element = doc.getElementById(gnode?.elementId);

        if (element instanceof MTextBoxCtrlPoint && element.getMasterId() === this._eID) {
            view.getSelectionGNodeManager().reset(this._eID);
            return;
        }

        const ctrlPoint = doc.getElementById(this._eID);

        if (ctrlPoint instanceof MTextBoxCtrlPoint) {
            const toDelIds = doc
                .getAllElementsByCtor(MTextBoxCtrlPoint)
                .filter((m) => m.getMasterId() === ctrlPoint.getMasterId())
                .map((m) => m.id);

            doc.deleteElementsById(...toDelIds);
            view.getSelectionGNodeManager().delete({ eID: ctrlPoint.getMasterId() });
        }

        this._eID = -1;
        view.getRenderView().updateView();
    }

    public async onDragStart({ view, gnode, fnKey }: IElementEventContext): Promise<void> {
        if (!(gnode instanceof GPoint3d)) {
            return;
        }
        this._shiftKey = fnKey.shiftKey;

        const doc = view.getDocument();
        const ctrlPoint = doc.getElementById(this._eID) as MTextBoxCtrlPoint;

        this._dragStart = gnode.getAbsoluteGeo().clone();
        view.getHighlightGNodeManager().clear();
        view.getSelectionGNodeManager().clear();

        // draw aux elements
        const auxLines = doc.getAllElementsByCtor(MTextBoxAuxLine);
        if (auxLines.length) {
            auxLines[0].update(ctrlPoint.getMasterId());
        } else {
            doc.create(MTextBoxAuxLine).update(ctrlPoint.getMasterId());
        }

        view.getRenderView().updateView();
    }

    public async onDragMove({ view, screenPos, tmpElementPainter, gnode }: IElementEventContext): Promise<void> {
        if (!(gnode instanceof GPoint3d)) {
            return;
        }
        const doc = view.getDocument();

        const ctrlPoint = doc.getElementById(this._eID) as MTextBoxCtrlPoint;
        const master = doc.getElementById(ctrlPoint.getMasterId());
        if (!(master instanceof CadMText)) {
            return;
        }

        const dragEnd = this._snap(view, screenPos, tmpElementPainter);

        if (!this._shiftKey) {
            const translation = dragEnd.subtracted(this._dragStart);
            const m4 = Matrix4.makeTranslate(translation);
            view.updateElementTransformationDynamic(master.id, m4);
            view.updateElementTransformationDynamic(ctrlPoint.id, m4);
        } else {
            ctrlPoint.resize({ pt: dragEnd, position: gnode.userData.position });
            const box = ctrlPoint.getBox();

            const currentPosition = master.adaptPositionByBox(box);
            const translation = currentPosition.subtracted(master.db.position);
            const m4 = Matrix4.makeTranslate(Vector3.XY(translation));
            const inversedMatrix4 = master.getTransform().inversed();
            if (inversedMatrix4) {
                m4.multiply(inversedMatrix4);
            }

            view.updateElementTransformationDynamic(master.id, m4);
            view.getRenderView().updateView();
        }
    }

    public async onDragEnd({ view, screenPos, tmpElementPainter, gnode }: IElementEventContext): Promise<void> {
        if (!(gnode instanceof GPoint3d)) {
            return;
        }
        const doc = view.getDocument();

        const ctrlPoint = doc.getElementById(this._eID) as MTextBoxCtrlPoint;
        const master = doc.getElementById(ctrlPoint.getMasterId());
        if (!(master instanceof CadMText)) {
            return;
        }

        const dragEnd = this._snap(view, screenPos, tmpElementPainter);

        if (!this._shiftKey) {
            const translation = dragEnd.subtracted(this._dragStart);
            await transact(doc, 'translate cadText', () => {
                master.translate(translation);
            });
        } else {
            await transact(doc, 'translate cadText', async () => {
                master.resize(ctrlPoint.getBox());
                await master.autoWrap();
            });
        }

        ctrlPoint.update();

        const nodes = ctrlPoint.getGNodesWhenSelected().map((c) => ({ ...c, style: EN_ACTIVE_ELEMENT_STYLE.NONE }));
        const activeElement = { id: ctrlPoint.id.asInt(), nodes };

        view.getSelectionGNodeManager().reset(master.id.asInt(), activeElement);

        tmpElementPainter.clearTmp();
        view.getRenderView().updateView();

        this._snapContext.snappableGNodes = [];

        // del aux lines
        const toDelIds = doc.getAllElementsByCtor(MTextBoxAuxLine).map((c) => c.id);
        doc.deleteElementsById(...toDelIds);
    }

    private _snap(view: ISysWindow, screenPos: Vector2, tmpElementPainter: TmpElementPainter): Vector3 {
        tmpElementPainter.clearTmp();
        const gnodes = view.getPicker().pickNodes({ screenPos, pickFilter: this._pickFilter });

        if (gnodes.length) {
            const pixelsPerUnit = view.getPicker().pixelsPerUnitCreator();
            SnapSetting.getInstance().setScaleAtDis((dis: number) => 1 / pixelsPerUnit(dis));

            this._snapContext.snappableGNodes = gnodes;
            const snapRay = view.generateCameraRay(screenPos);
            snapRay.extendDouble(CONST.MODEL_MAX_LENGTH);
            this._snapContext.snapRay = snapRay;
            const snapCandidates = this._snapEngine.snap(this._snapContext);

            this._drawSnapPrompt(snapCandidates, tmpElementPainter);
            view.getRenderView().updateView();

            return snapCandidates.getSnappedPt();
        }

        return view.screenToNearPlane(screenPos);
    }

    private _drawSnapPrompt(snapCandidates: SnapCandidates, tmpElementPainter: TmpElementPainter): void {
        if (snapCandidates.getSnapType() === EN_SNAP_TYPE.Empty) {
            tmpElementPainter.clearTmp();
            return;
        }

        const grep = new GRep();
        // 添加辅助显示
        grep.addNode(snapCandidates.getSnapPrompt());

        grep.grepRenderArea = EN_RENDER_AREA.OVERLAY;

        tmpElementPainter.drawTmpGRep(grep);
    }
}
