import { ForwardStyle } from '../../header/settings/options/forward-style';
import { gridSize } from '../../header/settings/options/grid-size';
import { FlowDirection } from '../enums/flow-direction.model';

export interface FlowSettings {
  forwardStyle?: ForwardStyle;
  direction?: FlowDirection;
  gridSize?: gridSize;
}
