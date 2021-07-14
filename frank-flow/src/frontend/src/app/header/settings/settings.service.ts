import { Injectable } from '@angular/core';
import { Settings } from './settings.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { DefaultSettings } from './options/default-settings.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  settings: BehaviorSubject<Settings>;
  defaultSettings = new DefaultSettings();

  constructor() {
    const localStorageSettings = this.getSettingsLocalStorage();
    const localStorageSettingsWithDefaults = this.addDefaultSettings(
      localStorageSettings
    );
    this.settings = new BehaviorSubject<Settings>(
      localStorageSettingsWithDefaults
    );
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

  addDefaultSettings(settings: Settings): Settings {
    type K = keyof Settings;

    for (const key in this.defaultSettings) {
      if (settings[key as K] === undefined) {
        settings = {
          ...settings,
          ...{ [key]: this.defaultSettings[key as K] },
        };
      }
    }

    return settings;
  }
}
