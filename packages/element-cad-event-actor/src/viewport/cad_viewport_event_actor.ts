import {
    DBElement,
    IElementEventContext,
    IGraphicElement,
    registerElementEventActor,
} from '@do-design/d-model';
import { GCurve3d, GCurves } from '@do-design/d-render';
import {
    CadBoxSnapElementEventActor, CadDrawingElement,
} from '@do-design/element-cad-core';

import { CadViewportElement } from '@do-design/element-cad-core';
import { Box2, Line2d, Line3d } from '@do-math/core';

@registerElementEventActor(CadViewportElement)
export class CadViewportEventActor extends CadBoxSnapElementEventActor<CadViewportElement> {

    public async onMouseMove({ gnode, view, fnKey }: IElementEventContext): Promise<void> {
        // 鼠标移动的时候默认高亮整体
        view.getHighlightGNodeManager().reset({ id: gnode.elementId.asInt() });
        view.getDocument().updateView();
    }

    public async onClick(param: IElementEventContext): Promise<void> {
        console.log('viewport clicked');
        super.onClick(param);
    }

    public async onDblClick(ctx: IElementEventContext): Promise<void> {
        const { gnode, view } = ctx;
        view.getRenderView().getCameraHelperController().activeCamera(gnode.elementId.asInt());
    }

    public isCorrectElement(e: CadViewportElement | undefined): boolean {
        return e instanceof CadViewportElement;
    }
    public async getBoundingBox(e: CadViewportElement): Promise<Box2> {
        return e.getBoundingBox();
    }
    public collectDragableElements(e: CadViewportElement): IGraphicElement<DBElement>[] {
        return [e];
    }
    public getSnaplines(e: CadViewportElement): Line2d[] {
        const snapLines: Line2d[] = [];
        const parent = e.getAncestorByCtor(CadDrawingElement);
        if (!parent) {
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

}
