import { registerElementEventActor } from '@do-design/d-model';
import { CadDiameterDimension } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from './cad_dim_event_actor';

@registerElementEventActor(CadDiameterDimension)
export class CadDiameterDimensionEventActor extends CadDimensionEventActor {}
