import { Injectable } from '@angular/core';
import { ModeModel } from './mode.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModeTypeEnum } from './modeType.enum';

@Injectable({
  providedIn: 'root',
})
export class ModeService {
  mode: BehaviorSubject<ModeModel>;

  constructor() {
    this.mode = new BehaviorSubject(new ModeModel(ModeTypeEnum.flowMode));
  }

  setMode(mode: ModeModel): void {
    this.mode.next(mode);
  }

  getMode(): Observable<ModeModel> {
    return this.mode.asObservable();
  }
}
