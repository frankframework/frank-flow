import { Injectable } from '@angular/core';
import { Settings } from './settings.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { DefaultSettings } from './options/default-settings.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private settingsBehaviorSubject!: BehaviorSubject<Settings>;
  public settingsObservable!: Observable<Settings>;
  private defaultSettings = new DefaultSettings();

  constructor() {
    this.initializeSettings();
  }

  initializeSettings() {
    const savedSettings = this.getSettingsLocalStorage();
    const settingsWithDefaults = this.addDefaultSettings(savedSettings);
    this.settingsBehaviorSubject = new BehaviorSubject<Settings>(
      settingsWithDefaults
    );
    this.settingsObservable = this.settingsBehaviorSubject.asObservable();
  }

  setSettings(settings: Settings): void {
    this.settingsBehaviorSubject.next(settings);
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  getSettings(): Settings {
    return this.settingsBehaviorSubject.getValue();
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
          [key]: this.defaultSettings[key as K],
        };
      }
    }

    return settings;
  }
}
