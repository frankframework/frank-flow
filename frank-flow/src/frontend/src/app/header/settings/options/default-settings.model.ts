import { Settings } from '../settings.model';
import { ModeType } from '../../modes/modeType.enum';
import { SwitchWithoutSavingOption } from './switch-without-saving-option';
import { ConnectionType } from './connection-type';

export class DefaultSettings implements Settings {
  darkMode = false;
  defaultMode = ModeType.flowMode;
  showPopups = true;
  switchWithoutSaving = SwitchWithoutSavingOption.ask;
  connectionType = ConnectionType.bezier;
  verticalConnectors = true;
}
