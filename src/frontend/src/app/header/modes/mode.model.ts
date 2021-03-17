import { ModeTypeEnum } from './modeType.enum';

export class ModeModel {
  current: ModeTypeEnum;

  constructor(current: ModeTypeEnum) {
    this.current = current;
  }

  set(type: ModeTypeEnum): void {
    this.current = type;
  }

  is(type: ModeTypeEnum): boolean {
    return this.current === type;
  }
}
