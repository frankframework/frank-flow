import { Injectable } from '@angular/core';
import { Mode } from './mode';
import { Observable, of } from 'rxjs';
import { ModeType } from './modeType';

@Injectable({
  providedIn: 'root',
})
export class ModeService {
  mode: Mode;

  constructor() {
    this.mode = new Mode(ModeType.flowMode);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
  }

  getMode(): Observable<Mode> {
    return of(this.mode);
  }
}
