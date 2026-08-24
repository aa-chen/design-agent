import {
    BaseElementEventActor,
    createUITextInput,
    EN_HIGHLIGHT_STRATEGY,
    IElementEventContext,
    multiSelectTool,
    transact,
} from '@do-design/d-model';
import { Vector2 } from '@do-math/core';
import { CadDimension, AbstractCadElement, DBCadDimension, AbstractDynamicTemp } from '@do-design/element-cad-core';
import { ElementEventActorRegister } from '@do-design/d-model';
export class CadDimensionEventActor extends BaseElementEventActor {
    private _tmpPt?: AbstractDynamicTemp;

    private _dragPt: Vector2;

    private _screenDelta: Vector2 = Vector2.O();

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view, screenPos, fnKey, tmpElementPainter }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        } else {
            const doc = view.getDocument();
            const master = doc.getElementById(gnode.elementId);

            if (!(master instanceof CadDimension)) {
                return;
            }

            view.getSelectionGNodeManager().reset(gnode.elementId.asInt());
        }

        view.getDocument().updateView();
    }

    public async onDblClick({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);

        if (!(master instanceof CadDimension)) {
            return;
        }

        const text = master.getText();
        if (text) {
            await createUITextInput(text, screenPos, async (text: string) => {
                await this._onTextChange(text, master);
            });
        }

        view.getSelectionGNodeManager().reset(gnode.elementId.asInt());

        view.getDocument().updateView();
    }

    public async onDragStart(ctx: IElementEventContext): Promise<void> {
        const { view, gnode, screenPos } = ctx;
        const doc = view.getDocument();

        const element = doc.getElementById(gnode.elementId);

        if (!(element instanceof CadDimension)) {
            return;
        }

        const text = (element.db as DBCadDimension).CALC_Text_Info;
        const point = text.point.transformed(element.getTransform().toMatrix3());

        if (point.equals(Vector2.O())) {
            return;
        }

        const temps = doc.filterElements((e) => e instanceof AbstractDynamicTemp) as AbstractDynamicTemp[];

        const tmpPt = temps.sort((a, b) => a.point.distanceTo(point) - b.point.distanceTo(point))[0];

        if (!tmpPt) {
            return;
        }

        this._tmpPt = tmpPt;
        this._dragPt = screenPos.clone();

        // const screenTempPt = view.worldToScreen(new Vector3(tmpPt.pt.x, tmpPt.pt.y, 0));
        // const diff = screenTempPt.subtracted(screenPos);
        // this._screenDelta = diff;

        const gn = this._tmpPt.getGRep().getTraverseChildren()[0];

        ElementEventActorRegister.getInstance()
            .getEventActor(tmpPt)
            .onDragStart({ ...ctx, gnode: gn, screenPos: screenPos.added(this._screenDelta) });
    }

    public async onDragMove(ctx: IElementEventContext): Promise<void> {
        const { view, gnode, screenPos } = ctx;
        const doc = view.getDocument();

        const element = doc.getElementById(gnode.elementId);

        if (!(element instanceof CadDimension)) {
            return;
        }

        if (!this._tmpPt) {
            return;
        }

        const gn = this._tmpPt.getGRep().getTraverseChildren()[0];

        ElementEventActorRegister.getInstance()
            .getEventActor(this._tmpPt)
            .onDragMove({ ...ctx, gnode: gn, screenPos: screenPos.added(this._screenDelta) });
    }

    public async onDragEnd(ctx: IElementEventContext): Promise<void> {
        const { view, gnode, tmpElementPainter, screenPos } = ctx;
        const doc = view.getDocument();
        const element = doc.getElementById(gnode.elementId);

        tmpElementPainter.clearTmp();

        if (!(element instanceof CadDimension)) {
            return;
        }

        if (!this._tmpPt) {
            return;
        }

        const gn = this._tmpPt.getGRep().getTraverseChildren()[0];

        ElementEventActorRegister.getInstance()
            .getEventActor(this._tmpPt)
            .onDragEnd({ ...ctx, gnode: gn, screenPos: screenPos.added(this._screenDelta) });
    }

    /**
     * 子类实现文字被修改后的行为
     * @param text
     * @param master
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async _onTextChange(text: string, master: AbstractCadElement): Promise<void> {
        const doc = master.getDoc();

        if (!(master instanceof CadDimension)) {
            return;
        }

        await transact(doc, '修改尺寸文字', () => {
            master.setText(text);
        });

        doc.getSysWindow().getSelectionGNodeManager().reset(master.id.asInt());

        doc.updateView();
    }
}
