import { Line3d } from '@do-math/core';
import { createUITextInput, IElementEventContext, registerElementEventActor } from '@do-design/d-model';
import { Cad2lineAngularDimension } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from './cad_dim_event_actor';
import { GCurve3d, GNode3d } from '@do-design/d-render';

@registerElementEventActor(Cad2lineAngularDimension)
export class CadAngularDimensionEventActor extends CadDimensionEventActor {
    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);

        if (!(master instanceof Cad2lineAngularDimension)) {
            return;
        }

        const nodes = this._getSelectNodes(master);

        view.getHighlightGNodeManager().reset({ id: gnode.elementId.asInt(), nodes });
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);

        if (!(master instanceof Cad2lineAngularDimension)) {
            return;
        }

        const nodes = this._getSelectNodes(master);

        view.getSelectionGNodeManager().reset({ id: gnode.elementId.asInt(), nodes });

        // 创建临时元素
        // (master as unknown as IDimensionElement).createDynamicTempElements();
        view.getDocument().updateView();
    }

    public async onDblClick({ gnode, view, screenPos }: IElementEventContext): Promise<void> {
        const doc = view.getDocument();
        const master = doc.getElementById(gnode.elementId);

        if (!(master instanceof Cad2lineAngularDimension)) {
            return;
        }

        const text = master.getText();
        if (text) {
            await createUITextInput(text, screenPos, async (text: string) => {
                await this._onTextChange(text, master as ANY);
            });
        }

        const nodes = this._getSelectNodes(master);
        view.getSelectionGNodeManager().reset({ id: gnode.elementId.asInt(), nodes });

        // 创建临时元素
        // (master as unknown as IDimensionElement).createDynamicTempElements();

        view.getDocument().updateView();
    }

    private _getSelectNodes(master: Cad2lineAngularDimension): GNode3d[] {
        const nodes: GNode3d[] = [];

        const grep = master.getGRep();

        const children = grep.getTraverseChildren();

        for (const child of children) {
            if (child instanceof GCurve3d && child.getAbsoluteGeo() instanceof Line3d) {
                continue;
            }

            nodes.push(child);

            // if (child instanceof GCurve3d) {
            //     const geo = child.getAbsoluteGeo();
            //     if (!(geo instanceof Arc3d)) {
            //         continue;
            //     }

            //     const a = geo.getRange().getLength();
            //     if (MathUtil.isNearlyEqual(a, Math.PI * 2)) {
            //         continue;
            //     }

            //     nodes.push(child);
            // }
        }

        return nodes;
    }
}
