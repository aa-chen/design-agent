import { registerElementEventActor } from '@do-design/d-model';
import { CadAlignedDimension } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from './cad_dim_event_actor';

@registerElementEventActor(CadAlignedDimension)
export class CadAlignedDimensionEventActor extends CadDimensionEventActor {}
