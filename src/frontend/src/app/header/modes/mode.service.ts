import { Injectable } from '@angular/core';
import { Mode } from './mode';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { ModeType } from './modeType';

@Injectable({
  providedIn: 'root',
})
export class ModeService {
  mode: BehaviorSubject<Mode>;

  constructor() {
    this.mode = new BehaviorSubject(new Mode(ModeType.flowMode));
  }

  setMode(mode: Mode): void {
    this.mode.next(mode);
  }

  getMode(): Observable<Mode> {
    return this.mode.asObservable();
  }
}
