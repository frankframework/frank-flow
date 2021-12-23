import { ModeType } from '../modes/mode-type.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';
import { FlowSettings } from '../../shared/models/flow-settings.model';
import { ConnectionType } from './options/connection-type';
import { GridConfiguration } from './options/grid-configuration';

export interface Settings extends FlowSettings {
  darkMode: boolean;
  showPopups: boolean;
  defaultMode: ModeType;
  useLastMode: boolean;
  switchWithoutSaving: SwitchWithoutSavingOption;
  ignoreConfigurationSettings: boolean;
  connectionType: ConnectionType;
  verticalConnectors: boolean;
  gridConfiguration: GridConfiguration;
}
