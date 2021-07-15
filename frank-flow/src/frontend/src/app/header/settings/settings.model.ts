import { ModeType } from '../modes/modeType.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';

export interface Settings {
  darkMode: boolean;
  showPopups: boolean;
  defaultMode: ModeType;
  switchWithoutSaving: SwitchWithoutSavingOption;
}
