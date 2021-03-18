import { ModeType } from './modeType.enum';

export class Mode {
  currentMode: ModeType;
  defaultMode: ModeType;

  constructor(current: ModeType) {
    this.currentMode = current;
    this.defaultMode = current;
  }

  set(type: ModeType): void {
    this.currentMode = type;
  }

  is(type: ModeType): boolean {
    return this.currentMode === type;
  }

  isDefault(type: ModeType): boolean {
    return this.defaultMode === type;
  }
}
