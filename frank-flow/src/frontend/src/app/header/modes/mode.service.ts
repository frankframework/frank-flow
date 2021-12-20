import { Injectable } from '@angular/core';
import { Mode } from './mode.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { Settings } from '../settings/settings.model';
import { SessionService } from '../../shared/services/session.service';
import { ModeType } from './mode-type.enum';

@Injectable({
  providedIn: 'root',
})
export class ModeService {
  mode!: BehaviorSubject<Mode>;
  settings!: Settings;

  constructor(
    private settingsService: SettingsService,
    private sessionService: SessionService
  ) {
    this.getSettings();
    this.initializeMode();
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  initializeMode(): void {
    let mode = new Mode(+this.settings.defaultMode);
    if (this.settings.useLastMode) {
      mode.set(
        this.sessionService.getSessionMode()?.currentMode ?? mode.currentMode
      );
    }
    this.mode = new BehaviorSubject(mode);
  }

  setMode(mode: Mode): void {
    this.sessionService.setSessionMode(mode);
    this.mode.next(mode);
  }

  getMode(): Observable<Mode> {
    return this.mode.asObservable();
  }
}
