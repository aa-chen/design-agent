import {
    DBElement,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    IGraphicElement,
    multiSelectTool,
    registerElementEventActor,
} from '@do-design/d-model';
import { Line2d, Line3d, Box2 } from '@do-math/core';

import { CadStaticTable, CadDrawingElement, CadBoxSnapElementEventActor } from '@do-design/element-cad-core';
import { GCurve3d, GCurves } from '@do-design/d-render';

@registerElementEventActor(CadStaticTable)
export class CadStaticTableEventActor extends CadBoxSnapElementEventActor<CadStaticTable> {
    public isCorrectElement(e: CadStaticTable | undefined): boolean {
        return e instanceof CadStaticTable;
    }

    public async getBoundingBox(e: CadStaticTable): Promise<Box2> {
        return e.getBoundingBox();
    }

    public collectDragableElements(e: CadStaticTable): IGraphicElement<DBElement>[] {
        return [e];
    }

    public getSnaplines(e: CadStaticTable): Line2d[] {
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
}
