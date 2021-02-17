import { Injectable } from '@angular/core';
import { Settings } from './settings';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  settings: Settings;
  defaultSettings = { darkmode: false, showPopups: true };

  constructor() {
    this.settings = this.getSettingsLocalStorage();
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  getSettings(): Observable<Settings> {
    return of(this.settings);
  }

  getSettingsLocalStorage(): Settings {
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : this.defaultSettings;
  }
}
