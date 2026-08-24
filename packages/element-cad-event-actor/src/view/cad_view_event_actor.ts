import { EN_HIGHLIGHT_STRATEGY, IElementEventContext, multiSelectTool, registerElementEventActor } from '@do-design/d-model';
import { CadViewElement, CadDrawingElement, CadBaseElementEventActor } from '@do-design/element-cad-core';
import { IDragActor } from './i_drag_actor';
import { ViewAlignLockActor } from './view_align_lock_actor';
import { ViewAlignUnlockActor } from './view_align_unlock_actor';

@registerElementEventActor(CadViewElement)
/**
 * 主视图：
 * 主视图移动时，同时联动其他视图
 *
 * 在水平和竖直方向的仰视图、俯视图、左视图、右视图、后视图
 * 移动时，只能沿着和主视图平齐的方向移动
 *
 * 其他视图（轴测、剖面）
 * 自由移动
 * 
 * 2024-11-13
 * @see https://zentao.designorder.cn/story-view-2704.html 
 * drawing添加视图对齐锁定功能。视图对齐锁定关闭后，图纸可以任意移动
 */
export class CadViewEventActor extends CadBaseElementEventActor {

    private _dragActor: IDragActor;

    public async onMouseMove({ gnode, view }: IElementEventContext): Promise<void> {
        // 鼠标移动的时候默认整体
        view.getHighlightGNodeManager().reset(gnode.elementId.asInt());
        view.getDocument().updateView();
    }

    public async onClick({ gnode, view, fnKey, tmpElementPainter, screenPos }: IElementEventContext): Promise<void> {
        if (fnKey.ctrlKey) {
            multiSelectTool.multiSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        } else {
            multiSelectTool.singleSelect(gnode, screenPos, view, tmpElementPainter, EN_HIGHLIGHT_STRATEGY.ENTIRE);
        }
        view.getDocument().updateView();
    }

    public async onDragStart(ctx: IElementEventContext): Promise<void> {
        const { view, gnode } = ctx;
        const doc = view.getDocument();
        const viewElement = doc.getElementById(gnode.elementId);
        if (!(viewElement instanceof CadViewElement)) {
            return;
        }
        const drawing = viewElement.getAncestorByCtor(CadDrawingElement);
        const locked = !!drawing?.db.viewAlignLocking;
        this._dragActor = locked ? new ViewAlignLockActor() : new ViewAlignUnlockActor();
        await this._dragActor.onDragStart(ctx);
    }

    public async onDragMove(ctx: IElementEventContext): Promise<void> {
        if (this._dragActor) {
            await this._dragActor.onDragMove(ctx);
        }
    }

    public async onDragEnd(ctx: IElementEventContext): Promise<void> {
        if (this._dragActor) {
            await this._dragActor.onDragEnd(ctx);
        }
    }
}
