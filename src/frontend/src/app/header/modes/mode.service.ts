import { Injectable } from '@angular/core';
import { Mode } from './mode.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModeType } from './modeType.enum';

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
