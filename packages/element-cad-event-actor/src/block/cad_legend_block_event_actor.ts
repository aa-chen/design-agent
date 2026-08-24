import {
    DBElement,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    IGraphicElement,
    multiSelectTool,
    registerElementEventActor,
} from '@do-design/d-model';
import { Line2d, Line3d, Box2 } from '@do-math/core';

import { CadLegendBlock, CadDrawingElement, CadBoxSnapElementEventActor } from '@do-design/element-cad-core';
import { GCurve3d, GCurves } from '@do-design/d-render';

@registerElementEventActor(CadLegendBlock)
export class CadLegendBlockEventActor extends CadBoxSnapElementEventActor<CadLegendBlock> {
    // private _plane = Plane.XOY();

    // private _startPt?: Vector2;

    // private _boxSnap?: BoxSnap;

    public isCorrectElement(e: CadLegendBlock | undefined): boolean {
        return e instanceof CadLegendBlock;
    }

    public async getBoundingBox(e: CadLegendBlock): Promise<Box2> {
        return e.getBoundingBox();
    }

    public collectDragableElements(e: CadLegendBlock): IGraphicElement<DBElement>[] {
        return [e];
    }

    public getSnaplines(e: CadLegendBlock): Line2d[] {
        const snapLines: Line2d[] = [];
        const parent = e.getAncestorByCtor(CadDrawingElement);
        // const doc = e.getCurrentDoc();
        if (!parent) {
            // ============== 判断是否为 drawing-resource 并吸附图框 =============
            return snapLines;
        }
        const eles = parent.getChildren(false).filter((ele) => ele.isVisible());
        for (const ele of [parent, ...eles]) {
            const grep = ele.getGRep();
            const children = grep.getTraverseChildren();

            for (const child of children) {
                if (child instanceof GCurves) {
                    const gcurves = child.getAbsoluteGeo().filter((g) => g instanceof Line3d) as Line3d[];

                    for (const gc of gcurves) {
                        const line = this._plane.getLine2D(gc);
                        if (line && line.getLength() > 20) {
                            snapLines.push(line);
                        }
                    }
                } else if (child instanceof GCurve3d) {
                    const geo = child.getAbsoluteGeo();
                    if (geo instanceof Line3d) {
                        const line = this._plane.getLine2D(geo);
                        if (line && line.getLength() > 20) {
                            snapLines.push(line);
                        }
                    }
                }
            }
        }
        return snapLines;
    }

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        } else {
            view.getSelectionGNodeManager().reset(gnode.elementId.asInt());
        }
        view.getDocument().updateView();
    }

    // public async onDragStart({ view, screenPos, gnode }: IElementEventContext): Promise<void> {
    //     const doc = view.getDocument();
    //     const master = doc.getElementById(gnode.elementId);

    //     if (!(master instanceof CadLegendBlock)) {
    //         return;
    //     }

    //     const box = master.getBoundingBox();
    //     const center = box.getCenter();
    //     const viewEle = this._findAppendElementByNearest(doc, center);

    //     if (!viewEle) {
    //         return;
    //     }

    //     const worldPt = view.screenToWorldPlane(screenPos, this._plane);
    //     this._startPt = this._plane.getUVAt(worldPt);

    //     const grep = viewEle.getGRep();
    //     const children = grep.getTraverseChildren();
    //     const line2ds: Line2d[] = [];

    //     for (const child of children) {
    //         if (!(child instanceof GCurves)) {
    //             continue;
    //         }
    //         const gcurves = child.getAbsoluteGeo().filter((g) => g instanceof Line3d) as Line3d[];

    //         for (const gc of gcurves) {
    //             const line = this._plane.getLine2D(gc);
    //             if (line && line.getLength() > 8) {
    //                 line2ds.push(line);
    //             }
    //         }
    //     }

    //     if (!line2ds.length) {
    //         return;
    //     }

    //     this._boxSnap = new BoxSnap(line2ds);
    // }

    // public async onDragMove({ gnode, view, screenPos, tmpElementPainter }: IElementEventContext): Promise<void> {
    //     if (!this._startPt) {
    //         return;
    //     }

    //     const doc = view.getDocument();
    //     const master = doc.getElementById(gnode.elementId);

    //     if (!(master instanceof CadLegendBlock)) {
    //         return;
    //     }

    //     const worldPt = view.screenToWorldPlane(screenPos, this._plane);
    //     const pt = this._plane.getUVAt(worldPt);
    //     const delta = pt.subtracted(this._startPt);

    //     const box = master.getBoundingBox();
    //     box.translate(delta);

    //     if (!this._boxSnap) {
    //         return;
    //     }

    //     const size = box.getSize();
    //     const npt = this._boxSnap.snap(box);
    //     box.setFromCenterAndSize(npt, size);

    //     const curves = Loop.createByRectangle(box.min, box.max).getAllCurves() as Line2d[];
    //     const gCurve = new GCurves(curves.map((curve) => this._plane.getCurve3d(curve)));

    //     const grep = new GRep();
    //     grep.addNodes(gCurve);

    //     tmpElementPainter.drawTmpGRep(grep);
    //     view.getDocument().updateView();
    // }

    // public async onDragEnd({ gnode, view, screenPos, tmpElementPainter }: IElementEventContext): Promise<void> {
    //     if (!this._startPt) {
    //         return;
    //     }

    //     const doc = view.getDocument();
    //     const master = doc.getElementById(gnode.elementId);

    //     if (!(master instanceof CadLegendBlock)) {
    //         return;
    //     }

    //     const worldPt = view.screenToWorldPlane(screenPos, this._plane);
    //     const pt = this._plane.getUVAt(worldPt);
    //     const delta = pt.subtracted(this._startPt);

    //     const box = master.getBoundingBox();
    //     const center = box.getCenter();
    //     box.translate(delta);

    //     if (!this._boxSnap) {
    //         return;
    //     }

    //     const npt = this._boxSnap.snap(box);

    //     const { x, y } = npt.subtracted(center);
    //     await transact(doc, '', () => {
    //         const matrix = new Matrix4();
    //         matrix.applyTranslate({ x, y, z: 0 });
    //         master.transform(matrix);
    //     });

    //     this._startPt = undefined;
    //     this._boxSnap = undefined;

    //     view.getSelectionGNodeManager().clear();
    //     tmpElementPainter.clearTmp();
    //     view.getDocument().updateView();
    // }

    // private _findAppendElementByNearest(doc: IDocument, pt: Vector2): IGraphicElement | undefined {
    //     const all = doc.getAllElementsByCtor<CadDrawingElement>(CadDrawingElement);

    //     const drawlings = all.filter((d) => d.isVisible() === true && d.getBoundingBox()?.containsPoint(pt));

    //     const drawing = drawlings[0];

    //     if (!drawing) {
    //         return undefined;
    //     }

    //     // return doc.getElementById(drawing.db.frameBlockId) as IGraphicElement;
    //     const block = drawing.getChildren().find((e) => e instanceof CadBlockReference);
    //     return block;
    // }
}
