import { Injectable } from '@angular/core';
import { Settings } from './settings';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  settings: Settings;

  constructor() {
    this.settings = new Settings();
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  getSettings(): Observable<Settings> {
    return of(this.settings);
  }
}
