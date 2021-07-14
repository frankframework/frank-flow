import { ModeType } from './modeType.enum';

export class Mode {
  currentMode: ModeType;

  constructor(current: ModeType) {
    this.currentMode = current;
  }

  set(type: ModeType): void {
    this.currentMode = type;
  }

  is(type: ModeType): boolean {
    return this.currentMode === type;
  }
}
