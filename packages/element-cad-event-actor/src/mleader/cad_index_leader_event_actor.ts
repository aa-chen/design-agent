import { registerElementEventActor } from '@do-design/d-model';
import { CadIndexLeader } from '@do-design/element-cad-core';
import { CadMLeaderDimensionEventActor } from './cad_mleader_event_actor';

@registerElementEventActor(CadIndexLeader)
export class CadIndexLeaderDimensionEventActor extends CadMLeaderDimensionEventActor {}
