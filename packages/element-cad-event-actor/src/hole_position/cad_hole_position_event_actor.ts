import { registerElementEventActor } from '@do-design/d-model';
import { CadHolePositionDimension } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from '../dimension/cad_dim_event_actor';

@registerElementEventActor(CadHolePositionDimension)
export class CadHolePositionDimensionEventActor extends CadDimensionEventActor {}
