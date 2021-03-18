import { Injectable } from '@angular/core';
import { Mode } from './mode.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { Settings } from '../settings/settings.model';

@Injectable({
  providedIn: 'root',
})
export class ModeService {
  mode: BehaviorSubject<Mode>;
  settings!: Settings;

  constructor(private settingsService: SettingsService) {
    this.getSettings();
    this.mode = new BehaviorSubject(new Mode(+this.settings.defaultMode));
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  setMode(mode: Mode): void {
    this.mode.next(mode);
  }

  getMode(): Observable<Mode> {
    return this.mode.asObservable();
  }
}
