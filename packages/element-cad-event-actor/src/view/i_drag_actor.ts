import { IElementEventContext } from "@do-design/d-model";

export interface IDragActor {
    onDragStart(ctx: IElementEventContext): Promise<void>;
    onDragMove(ctx: IElementEventContext): Promise<void>;
    onDragEnd(ctx: IElementEventContext): Promise<void>;
}