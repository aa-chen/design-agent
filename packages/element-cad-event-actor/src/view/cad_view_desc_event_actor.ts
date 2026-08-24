import {
    registerElementEventActor,
    IElementEventContext,
    multiSelectTool,
    EN_HIGHLIGHT_STRATEGY,
    DBElement,
    IGraphicElement,
    transact,
} from '@do-design/d-model';
import { Box2, Line2d, Line3d, Vector3, MathUtil, Plane } from '@do-math/core';
import {
    CadBoxSnapElementEventActor,
    CadDrawingElement,
    GraphicCadElement,
    CadViewDesc,
    MTextRTFConverter,
    EN_ENTITY_TYPE,
    ICadViewDesc,
    EN_DESC_TYPE,
    CadViewElement,
} from '@do-design/element-cad-core';
import { GCurve3d, GCurves } from '@do-design/d-render';
import { RTFEditorUtil } from '@do-design/d-rtf-sdk';
import { EN_RTF_CONTAINER_LINE_SPACING_TYPE, IRTFContainerBasic } from '@do-design/d-rtf-core';

@registerElementEventActor(CadViewDesc)
export class CadViewDescEventActor extends CadBoxSnapElementEventActor<CadViewDesc> {
    public async onDragEnd(ctx: IElementEventContext): Promise<void> {
        await super.onDragEnd(ctx);

        const { view, gnode } = ctx;
        view.getSelectionGNodeManager().reset({ id: gnode.elementId.asInt(), nodes: [{ id: gnode.globalID }] });
        view.getDocument().updateView();
    }

    public async onLButtonDown({ gnode, view }: IElementEventContext): Promise<void> {}

    public async onBlur({ view, gnode }: IElementEventContext): Promise<void> {
        // RTFEditorUtil.exitRTFEditor(view);
        // view.getRenderView().updateView();
    }

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {}

    public async onDblClick({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const ele = doc.getElementById(gnode.elementId);
        if (!(ele instanceof CadViewDesc)) {
            return;
        }
        const textGrep = ele.getTextGrep();
        const findTarget = textGrep.find((item) => {
            const ggnode = item.grep.getFlatChildren();
            if (ggnode.some((node) => node.id === gnode.id)) {
                return true;
            }
            return false;
        });

        if (!findTarget || findTarget.cadDescriptionItem.readonly) return;

        const content = findTarget.cadDescriptionItem.override || '';
        const {
            layer,
            position,
            textHeight,
            letterSpacingRatio,
            oblique,
            widthFactor,
            colorIndex,
            attachment,
            matrix,
            textStyle,
            rotation,
        } = ele.db;

        const rtfBox = ele.getBox();

        RTFEditorUtil.enterRTFEditor(
            {
                view,
                rtfContent: content,
                backWidth: rtfBox.getSize().x / ele.getFontScale(),
                backHeight: rtfBox.getSize().y / ele.getFontScale(),
                matrix: matrix.clone().applyRotate(rtfBox.getCenter().toXYZ(), Vector3.Z(), MathUtil.degreeToRadius(rotation)),
                centerPt: Plane.XOY().getPtAt(rtfBox.getCenter()).transformed(matrix.inversed()!),
                scale: ele.getFontScale(),
                boxAlignment: MTextRTFConverter.textAl2RTFAl(attachment),
                textStyle,
                defaultCharacterStyle: MTextRTFConverter.text2CharacterStyle({
                    type: EN_ENTITY_TYPE.MTEXT,
                    layer,
                    content,
                    colorIndex,
                    position: position.toArray2(),
                    rotation,
                    textHeight,
                    attachment,
                    textStyle,
                    oblique,
                    widthFactor,
                    letterSpacingRatio,
                }),
                lineSpacingType: EN_RTF_CONTAINER_LINE_SPACING_TYPE.AT_LEAST,
                lineSpacingRatio: 1,
            },
            view.getInputManager().getHotkeyContainer(),
            async (rtfContent: string, rtfContainer: IRTFContainerBasic) => {
                await this._onTextChange(
                    {
                        content: rtfContent,
                        attachment: MTextRTFConverter.RTFAl2TextAl(rtfContainer.boxAlignment),
                        textStyle: rtfContainer.textStyle,
                    },
                    ele,
                    findTarget.cadDescriptionItem.type,
                );
            },
        );
    }

    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.DEFAULT);
        } else {
            const doc = view.getDocument();
            const master = doc.getElementById(gnode.elementId);

            if (!(master instanceof CadViewDesc)) {
                return;
            }
            view.getSelectionGNodeManager().reset({ id: gnode.elementId.asInt(), nodes: [{ id: gnode.id }] });
        }
        view.getDocument().updateView();
    }

    public isCorrectElement(e: CadViewDesc | undefined): boolean {
        return e instanceof CadViewDesc;
    }

    public async getBoundingBox(e: CadViewDesc): Promise<Box2> {
        return e.getBoundingBox();
    }

    public collectDragableElements(e: CadViewDesc): IGraphicElement<DBElement>[] {
        return [e];
    }

    public getSnaplines(e: CadViewDesc): Line2d[] {
        const snapLines: Line2d[] = [];
        const parent = this._getDrawing(e);
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

    private _getDrawing(e: GraphicCadElement): CadDrawingElement | undefined {
        const p = e.getAncestorByCtor(CadDrawingElement);
        if (!p) {
            return p;
        }
        return this._getDrawing(p);
    }

    private async _onTextChange(params: Partial<ICadViewDesc>, ele: CadViewDesc, type: EN_DESC_TYPE): Promise<void> {
        const doc = ele.getDoc();

        if (!(ele instanceof CadViewDesc)) {
            return;
        }

        await transact(doc, '修改文字', async () => {
            const { content, attachment, textStyle } = params;

            const parent = ele.getAncestorByCtor(CadViewElement);
            if (!parent) return;

            const { items } = ele.db.viewDesc;
            const target = items.find((item) => item.type === type);
            if (target) CadViewDesc.showDesc(parent, { ...target, override: content });
            attachment && ele.setAttachment(attachment);
            textStyle && ele.setTextStyle(textStyle);
        });

        doc.getSysWindow().getSelectionGNodeManager().reset(ele.id.asInt());

        doc.updateView();
    }
}
