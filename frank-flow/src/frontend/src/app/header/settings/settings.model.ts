import { ModeType } from '../modes/modeType.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';
import { ConnectionType } from './options/connection-type';

export interface Settings {
  darkMode: boolean;
  showPopups: boolean;
  defaultMode: ModeType;
  switchWithoutSaving: SwitchWithoutSavingOption;
  connectionType: ConnectionType;
  verticalConnectors: boolean;
}
