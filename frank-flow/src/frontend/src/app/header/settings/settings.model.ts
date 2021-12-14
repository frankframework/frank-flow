import { ModeType } from '../modes/modeType.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';
import { ConnectionType } from './options/connection-type';
import { GridConfiguration } from './options/grid-configuration';

export interface Settings {
  darkMode: boolean;
  showPopups: boolean;
  defaultMode: ModeType;
  switchWithoutSaving: SwitchWithoutSavingOption;
  connectionType: ConnectionType;
  verticalConnectors: boolean;
  gridConfiguration: GridConfiguration;
}
