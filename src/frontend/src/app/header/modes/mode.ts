import { ModeType } from './modeType';

export class Mode {
  current: ModeType;

  constructor(current: ModeType) {
    this.current = current;
  }

  set(type: ModeType): void {
    this.current = type;
  }

  is(type: ModeType): boolean {
    return this.current === type;
  }
}
