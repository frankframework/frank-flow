import { Settings } from './settings.model';
import { ModeType } from '../modes/modeType.enum';

export class DefaultSettings implements Settings {
  darkMode = false;
  defaultMode = ModeType.flowMode;
  showPopups = true;
}
