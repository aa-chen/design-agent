import {
    registerElementEventActor,
    IElementEventContext,
    transact,
    IDocument,
    createUITextInput,
    multiSelectTool,
    EN_HIGHLIGHT_STRATEGY,
    DBElement,
    IGraphicElement,
} from '@do-design/d-model';
import { Box2, Line2d, Line3d, MathUtil, Vector3, Plane, Vector2 } from '@do-math/core';
import {
    CadBoxSnapElementEventActor,
    CadDrawingElement,
    GraphicCadElement,
    MTextBoxCtrlPoint,
    CadMText,
    MTextRTFConverter,
    IMText,
    EN_ENTITY_TYPE,
} from '@do-design/element-cad-core';

import { textHotkeys } from '../text_hotkeys';
import { GCurve3d, GCurves } from '@do-design/d-render';
import { EN_ACTIVE_ELEMENT_STYLE, IActiveElement } from '@do-types/core-types';
import { RTFEditorUtil } from '@do-design/d-rtf-sdk';
import { IRTFContainerBasic } from '@do-design/d-rtf-core';

@registerElementEventActor(CadMText)
export class CadMTextDimensionEventActor extends CadBoxSnapElementEventActor<CadMText> {
    private _eID = -1;

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

        const toDelIds = doc
            .getAllElementsByCtor(MTextBoxCtrlPoint)
            .filter((m) => m.getMasterId() === this._eID)
            .map((m) => m.id);

        doc.deleteElementsById(...toDelIds);
        this._eID = -1;
        view.getInputManager().unbindHotKeys(...textHotkeys.map((v) => v.key));
        view.getRenderView().updateView();
    }

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }

    public async onDblClick({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);

        if (!(master instanceof CadMText) || master.db.readonly) {
            return;
        }
        const {
            layer,
            position,
            textHeight,
            letterSpacingRatio,
            oblique,
            widthFactor,
            content,
            colorIndex,
            attachment,
            matrix,
            width,
            height,
            bMultiLine,
            textStyle,
            rotation,
            lineSpacingRatio,
            lineSpacingType,
        } = master.db;
        if (bMultiLine) {
            view.getSelectionGNodeManager().clear();
            const box = master.getBoxByAttachment();
            RTFEditorUtil.enterRTFEditor(
                {
                    view,
                    rtfContent: content,
                    backWidth: width,
                    backHeight: height,
                    matrix: matrix
                        .clone()
                        .applyRotate(new Vector3(box.getCenter().x, box.getCenter().y, 0), Vector3.Z(), MathUtil.degreeToRadius(rotation)),
                    centerPt: Plane.XOY().getPtAt(box.getCenter()).transformed(matrix.inversed()!),
                    scale: master.getScale(),
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
                    lineSpacingType,
                    lineSpacingRatio,
                },
                view.getInputManager().getHotkeyContainer(),
                async (rtfContent: string, rtfContainer: IRTFContainerBasic) => {
                    await this._onTextChange(
                        {
                            content: rtfContent,
                            attachment: MTextRTFConverter.RTFAl2TextAl(rtfContainer.boxAlignment),
                            textStyle: rtfContainer.textStyle,
                        },
                        master,
                    );
                },
            );
        } else {
            createUITextInput(content, screenPos, async (text: string) => {
                await this._onTextChange({ content: text }, master);
            });
        }
    }

    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.DEFAULT);
        } else {
            const doc = view.getDocument();
            const master = doc.getElementById(gnode.elementId);

            if (!(master instanceof CadMText)) {
                return;
            }
            // const activeElement = this._createCtrlPoints(doc, master.id.asInt());
            // view.getSelectionGNodeManager().reset(gnode.elementId.asInt(), activeElement);
            view.getSelectionGNodeManager().reset(gnode.elementId.asInt());
        }
        view.getInputManager().registerHotKeys(...textHotkeys);
        view.getDocument().updateView();
    }

    public isCorrectElement(e: CadMText | undefined): boolean {
        return e instanceof CadMText;
    }

    public async getBoundingBox(e: CadMText): Promise<Box2> {
        return e.getBoundingBox();
    }

    public collectDragableElements(e: CadMText): IGraphicElement<DBElement>[] {
        return [e];
    }

    public getSnaplines(e: CadMText): Line2d[] {
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

    private async _onTextChange(params: Partial<IMText>, master: CadMText): Promise<void> {
        const doc = master.getDoc();

        if (!(master instanceof CadMText)) {
            return;
        }

        await transact(doc, '修改文字', async () => {
            const { content, attachment, textStyle } = params;

            content && (await master.setText(content));
            attachment && master.setAttachment(attachment);
            textStyle && master.setTextStyle(textStyle);
        });

        doc.getSysWindow().getSelectionGNodeManager().reset(master.id.asInt());

        doc.updateView();
    }

    private _createCtrlPoints(doc: IDocument, masterId: number): IActiveElement {
        const ctrlPoints = doc.getAllElementsByCtor(MTextBoxCtrlPoint);

        // del
        const toDelIds = ctrlPoints.map((c) => c.id);
        doc.deleteElementsById(...toDelIds);

        // add
        const ctrlPoint = doc.create(MTextBoxCtrlPoint);
        ctrlPoint.initParam(masterId).update();

        const nodes = ctrlPoint.getGNodesWhenSelected().map((c) => ({ ...c, style: EN_ACTIVE_ELEMENT_STYLE.NONE }));
        return { id: ctrlPoint.id.asInt(), nodes };
    }
}
