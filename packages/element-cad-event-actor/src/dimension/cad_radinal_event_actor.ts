import { registerElementEventActor } from '@do-design/d-model';
import { CadRadialDimension } from '@do-design/element-cad-core';
import { CadDimensionEventActor } from './cad_dim_event_actor';

@registerElementEventActor(CadRadialDimension)
export class CadRadialDimensionEventActor extends CadDimensionEventActor {}
