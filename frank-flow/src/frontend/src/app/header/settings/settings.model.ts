import { ModeType } from '../modes/mode-type.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';
import { FlowSettings } from '../../shared/models/flow-settings.model';

export interface Settings extends FlowSettings {
  showUnsavedChangesWarning: boolean;
  showExplorer: boolean;
  showPalette: boolean;
  darkMode: boolean;
  defaultMode: ModeType;
  useLastMode: boolean;
  switchWithoutSaving: SwitchWithoutSavingOption;
  ignoreConfigurationSettings: boolean;
  automaticPan: boolean;
  showConfirmPopup: boolean;
}
