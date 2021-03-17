import { Injectable } from '@angular/core';
import { SettingsModel } from './settings.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  settings: BehaviorSubject<SettingsModel>;
  defaultSettings = { darkmode: false, showPopups: true };

  constructor() {
    const localStorageSettings = this.getSettingsLocalStorage();
    this.settings = new BehaviorSubject<SettingsModel>(localStorageSettings);
  }

  setSettings(settings: SettingsModel): void {
    this.settings.next(settings);
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  getSettings(): Observable<SettingsModel> {
    return this.settings.asObservable();
  }

  getSettingsLocalStorage(): SettingsModel {
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : this.defaultSettings;
  }
}
