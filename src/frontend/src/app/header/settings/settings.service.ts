import { Injectable } from '@angular/core';
import { Settings } from './settings.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  settings: BehaviorSubject<Settings>;
  defaultSettings = { darkMode: false, showPopups: true };

  constructor() {
    const localStorageSettings = this.getSettingsLocalStorage();
    this.settings = new BehaviorSubject<Settings>(localStorageSettings);
  }

  setSettings(settings: Settings): void {
    this.settings.next(settings);
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  getSettings(): Observable<Settings> {
    return this.settings.asObservable();
  }

  getSettingsLocalStorage(): Settings {
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : this.defaultSettings;
  }
}
