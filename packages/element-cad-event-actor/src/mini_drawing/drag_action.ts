/* eslint-disable no-labels */
/* eslint-disable no-await-in-loop */
import { Box2, Interval, Matrix4, types, Vector2, Vector3 } from '@do-math/core';
import { CadDrawingElement, CadMiniDrawingElement, CadMLeader, CadMText, EN_PROJECT_TYPE } from '@do-design/element-cad-core';
import { ElementId, SerialTransactionGroup } from '@do-design/d-model';
import { BeautifyIndexLeader, BeautifyMiniDrawing, BeautifyUtil, PrepareMiniDrawing } from '@do-design/cad-drawing-creator';
import { ConfigContainer } from '@do-design/d-drawing-config';

export class DragAction {
    private _wholeGroups: number[][] = [];

    private _sortGroups: number[][] = [];

    private _cache: Map<number, Box2> = new Map();

    private _translationIds: ElementId[] = [];

    private _hiddens: CadMiniDrawingElement[] = [];

    constructor(public md: CadMiniDrawingElement) {}

    public async prepare(): Promise<void> {
        const wholeGroups: number[][] = [];
        const d = this.md.getAncestorByCtor(CadDrawingElement);
        if (!d) {
            return;
        }
        const cache: Map<number, Box2> = new Map();
        const mds = d.getChildren().filter((e) => e instanceof CadMiniDrawingElement && e.isGlobalVisible()) as CadMiniDrawingElement[];
        this._hiddens = d
            .getChildren()
            .filter((e) => e instanceof CadMiniDrawingElement && !e.isGlobalVisible()) as CadMiniDrawingElement[];
        for (const _md of mds) {
            // const box = await _md.calcBoundingBox();
            const box3 = _md.getShadowGrep().getBoundingBox();
            const box = new Box2([box3.min, box3.max]);
            _md.extendBox(box);
            cache.set(_md.id.asInt(), box);
        }
        let group: number[] = [];
        // y axis range
        let range: Interval = new Interval();
        // 排序 上 -> 左 -> 右下
        [...cache.entries()]
            .sort((c1, c2) => c2[1].max.y * 100 - c2[1].min.x - (c1[1].max.y * 100 - c1[1].min.x))
            .forEach(([id, box]) => {
                if (!group.length) {
                    group.push(id);
                    range.set(box.min.y, box.max.y);
                    return;
                }
                const r = new Interval(box.min.y, box.max.y, false);
                const [inter] = range.intersected(r);
                // 如果在y轴上没有重叠部分或者只有一小部分重叠部分，则表示需要换行了
                if (!inter || inter.getLength() < range.getLength() / 10) {
                    // 换行
                    // 先将之前的从左往右排个序
                    group.sort((a, b) => cache.get(a)!.min.x - cache.get(b)!.min.x);
                    wholeGroups.push(group.slice());
                    group = [id];
                    range = r;
                } else {
                    group.push(id);
                    range.expandByPt(box.min.y).expandByPt(box.max.y);
                }
            });
        if (group.length) {
            group.sort((a, b) => cache.get(a)!.min.x - cache.get(b)!.min.x);
            wholeGroups.push(group.slice());
        }
        // const box = await this.md.calcBoundingBox();
        // cache.set(this.md.id.asInt(), box);
        this._cache = cache;
        this._wholeGroups = wholeGroups;
        this._sortGroups = this._wholeGroups.map((group) => group.slice().filter((g) => g !== this.md.id.asInt()));
    }

    public assimulate(start: types.IXY, end: types.IXY): void {
        const offset = new Vector2(end).subtract(start);
        const targetBox = this._cache.get(this.md.id.asInt())!.clone().translate(offset);
        const assimulateTranslation = (id: number, translation: Vector2, reset: boolean) => {
            const m4 = Matrix4.makeTranslate(translation.toXYZ());
            const doc = this.md.getCurrentDoc();
            const element = doc.getElementById(id);

            if (reset) {
                this._translationIds.forEach((id) => doc.getSysWindow().updateElementTransformationDynamic(id, new Matrix4()));
                this._translationIds = [];
            }

            if (element instanceof CadMiniDrawingElement) {
                const elements = element.getChildren(true);
                elements.push(element);
                elements.forEach((e) => doc.getSysWindow().updateElementTransformationDynamic(e.id, m4));
                this._translationIds.push(...elements.map((e) => e.id));
            }
        };
        for (let row = 0, len = this._sortGroups.length; row < len; row++) {
            const group = this._sortGroups[row];
            for (let column = 0, clen = group.length; column < clen; column++) {
                const cellIndex = group[column];
                const cellBox = this._cache.get(cellIndex)!;
                if (cellBox.containsPoint(targetBox.getCenter())) {
                    const leftAlign1 = new Vector2(targetBox.min.x, targetBox.min.y / 2 + targetBox.max.y / 2);
                    // const rightAlign1 = new Vector2(targetBox.max.x, targetBox.min.y / 2 + targetBox.max.y / 2);
                    const leftAlign2 = new Vector2(cellBox.min.x, cellBox.min.y / 2 + cellBox.max.y / 2);
                    // const rightAlign2 = new Vector2(cellBox.max.x, cellBox.min.y / 2 + cellBox.max.y / 2);
                    const translation1 = leftAlign2.subtracted(leftAlign1);
                    // const translation2 = leftAlign2.subtract(rightAlign1.added(translation1));
                    const translation2 = new Vector2(targetBox.max.x - targetBox.min.x, 0);
                    assimulateTranslation(this.md.id.asInt(), translation1.added(offset), true);
                    const rights = group.slice(column);
                    rights.forEach((r) => assimulateTranslation(r, translation2, false));
                    return;
                }
            }
        }
        // default
        assimulateTranslation(this.md.id.asInt(), offset, true);
    }

    public async finish(start: types.IXY, end: types.IXY): Promise<void> {
        const drawing = this.md.getAncestorByCtor(CadDrawingElement);
        if (!drawing) {
            return;
        }
        const offset = new Vector2(end).subtract(start);
        const originBox = this._cache.get(this.md.id.asInt())!;
        const targetBox = originBox.clone().translate(offset);
        outer: for (let row = 0, len = this._sortGroups.length; row < len; row++) {
            const group = this._sortGroups[row];
            for (let column = 0, clen = group.length; column < clen; column++) {
                const cellIndex = group[column];
                const cellBox = this._cache.get(cellIndex)!;
                if (cellBox.containsPoint(targetBox.getCenter())) {
                    group.splice(column, 0, this.md.id.asInt());
                    break outer;
                }
            }
            // const interval = new Interval();
            const interval = Interval.infinit();
            group.forEach((id) => {
                const box = this._cache.get(id)!;
                interval.expandByPt(box.min.y).expandByPt(box.max.y);
            });
            const [intersected] = interval.intersected(new Interval(targetBox.min.y, targetBox.max.y));
            if (intersected && intersected.getLength() >= interval.getLength()) {
                group.push(this.md.id.asInt());
                break;
            }
        }
        let ids = this._sortGroups.flat();
        // 可能会在奇奇怪怪的位置，这种情况放在末尾
        if (this._sortGroups.length && !ids.includes(this.md.id.asInt())) {
            const center = targetBox.getCenter();
            if (originBox.containsPoint(center)) {
                ids = this._wholeGroups.flat();
            } else if (center.y > originBox.getCenter().y) {
                ids.unshift(this.md.id.asInt());
            } else {
                ids.push(this.md.id.asInt());
            }
        }
        const doc = this.md.getCurrentDoc();
        const miniDrawings = ids.map((id) => doc.getElementById(id) as CadMiniDrawingElement);
        const views = drawing.getViews(false);
        // const startIndex = this._getStartIndex(miniDrawings);
        // await BeautifyMiniDrawings.beautifyMiniDrawings(drawing, miniDrawings, [scale], false);
        SerialTransactionGroup.startTransaction(doc, 'minidrawing drag action finish');
        let res = await SerialTransactionGroup.startTask(async () => {
            const sortedUuid = [...miniDrawings, ...this._hiddens].map((md) => md.getUuid());
            const miniDrawingParams = Object.values(drawing.getMiniDrawingParams()).filter((v) => sortedUuid.includes(v.uuid));
            miniDrawingParams.sort((a, b) => {
                const aIndex = sortedUuid.indexOf(a.uuid);
                const bIndex = sortedUuid.indexOf(b.uuid);
                if (aIndex === -1 || bIndex === -1) {
                    return 0;
                }
                if (aIndex === -1) {
                    return -1;
                }
                if (bIndex === -1) {
                    return 1;
                }

                return aIndex - bIndex;
            });
            [...miniDrawings, ...this._hiddens].forEach((miniDrawing) => {
                BeautifyIndexLeader.updateLeaderIndex(miniDrawing, miniDrawingParams);
            });

            await PrepareMiniDrawing.prepareMiniDrawings(drawing, miniDrawings);
            await SerialTransactionGroup.createNewTransaction('修改Mini视图');
            const limitArea = await BeautifyUtil.getDrawingLimitArea(drawing);
            const leftToRight = this._getParamLeftToRight(drawing);
            const bmd = new BeautifyMiniDrawing({ allowSplitDrawing: false, forceLayout: true, leftToRight });
            const layoutResult = await bmd.layoutViewsInPolygon(drawing, [...miniDrawings], views, limitArea);
            if (layoutResult.success) {
                bmd.commit(drawing, layoutResult);
            }
            miniDrawings.forEach((d) => d.translate(Vector3.O()));
        });
        if (!res) {
            SerialTransactionGroup.rollbackAll();
        }
        await SerialTransactionGroup.endTransaction();
    }

    private _getStartIndex(mds: CadMiniDrawingElement[]): number | undefined {
        let startIndex: number | undefined;
        for (const md of mds) {
            const doc = md.getCurrentDoc();
            const text = doc.getElementsByIds(md.db.indexEntityIds).find((e) => e instanceof CadMText) as CadMText | undefined;
            if (!text) {
                continue;
            }
            const { content } = text.db;
            const num = parseInt(content, 10);
            if (!Number.isNaN(num)) {
                if (startIndex === undefined || startIndex > num) {
                    startIndex = num;
                }
            }
        }
        return startIndex;
    }

    /**
     * test
     */
    private _getMdsIndex(md: CadMiniDrawingElement): string {
        const doc = md.getCurrentDoc();
        const drawing = md.getAncestorByCtor(CadDrawingElement) as CadDrawingElement;
        const partDetails = drawing.getPartDetails();
        const leaderIds = partDetails[md.getUuid()];
        const leaders = doc.filterElements(
            (e) => e instanceof CadMLeader && e.db.userData?.uuid && leaderIds.includes(e.db.userData?.uuid),
        ) as CadMLeader[] | undefined;
        if (!leaders?.length) {
            return 'none';
        }
        const [leader] = leaders;
        const index = leader.getTagsMap().get('索引') ?? 'none';
        return index;
    }

    private _getParamLeftToRight(drawing: CadDrawingElement): boolean {
        const { leftToRight } = ConfigContainer.getWeldingLayoutConfig();
        if (drawing.db.projectType === EN_PROJECT_TYPE.WELDING) {
            return leftToRight;
        }
        return true;
    }
}
