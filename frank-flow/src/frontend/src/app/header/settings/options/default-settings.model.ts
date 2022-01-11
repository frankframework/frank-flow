import { Settings } from '../settings.model';
import { ModeType } from '../../modes/mode-type.enum';
import { SwitchWithoutSavingOption } from './switch-without-saving-option';
import { ForwardStyle } from './forward-style';
import { GridSize } from './grid-size';
import { FlowDirection } from '../../../shared/enums/flow-direction.model';

export class DefaultSettings implements Settings {
  darkMode = false;
  defaultMode = ModeType.flowMode;
  useLastMode = false;
  showPopups = true;
  switchWithoutSaving = SwitchWithoutSavingOption.ask;
  forwardStyle = ForwardStyle.bezier;
  direction = FlowDirection.vertical;
  gridSize = GridSize.tenth;
  ignoreConfigurationSettings = false;
  showExplorer = true;
}
