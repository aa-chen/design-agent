import { registerElementEventActor, transact } from '@do-design/d-model';

import { CadMLeader, AbstractCadElement } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from '../dimension/cad_dim_event_actor';

@registerElementEventActor(CadMLeader)
export class CadMLeaderDimensionEventActor extends CadDimensionEventActor {
    protected async _onTextChange(text: string, master: AbstractCadElement): Promise<void> {
        const doc = master.getDoc();

        if (!(master instanceof CadMLeader)) {
            return;
        }

        const type = master.db.contentType;
        const tagMap = master.getTagsMap();

        await transact(doc, '修改尺寸文字', () => {
            if (type === 'text') {
                master.setText(text);
            }

            if (type === 'block') {
                tagMap.set('索引', text);
                master.setTagsByMap(tagMap);
            }
        });

        doc.getSysWindow().getSelectionGNodeManager().reset(master.id.asInt());

        doc.updateView();
    }
}
