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
    const localStorageMode = this.getModeFromLocalStorage();
    const mode = new Mode(+localStorageMode);
    this.mode = new BehaviorSubject(mode);
  }

  getModeFromLocalStorage(): ModeType {
    const defaultMode = localStorage.getItem('defaultMode');
    return defaultMode
      ? (JSON.parse(defaultMode) as ModeType)
      : ModeType.flowMode;
  }

  setMode(mode: Mode): void {
    this.mode.next(mode);
    localStorage.setItem('defaultMode', JSON.stringify(mode.defaultMode));
  }

  getMode(): Observable<Mode> {
    return this.mode.asObservable();
  }
}
