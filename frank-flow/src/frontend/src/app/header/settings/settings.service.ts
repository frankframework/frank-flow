import { Injectable } from '@angular/core';
import { Settings } from './settings.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { DefaultSettings } from './options/default-settings.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { FlowStructureNode } from '../../shared/models/flow-structure-node.model';
import { FlowNodeAttribute } from '../../shared/models/flow-node-attribute.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private settings!: BehaviorSubject<Settings>;
  private defaultSettings = new DefaultSettings();

  constructor(private currentFileService: CurrentFileService) {
    this.initializeSettings();
    this.subscribeToCurrentFile();
  }

  initializeSettings() {
    const localStorageSettings = this.getSettingsLocalStorage();
    const localStorageSettingsWithDefaults =
      this.addDefaultSettings(localStorageSettings);
    this.settings = new BehaviorSubject<Settings>(
      localStorageSettingsWithDefaults
    );
  }

  subscribeToCurrentFile() {
    this.currentFileService.currentFileObservable.subscribe({
      next: (file) => {
        this.initializeSettings();
        if (file.flowStructure?.configuration) {
          this.getSettingsFromConfiguration(file.flowStructure.configuration);
        }
      },
    });
  }

  getSettingsFromConfiguration(configuration: FlowStructureNode) {
    let configurationSettings = {};

    for (const [attributeName, attribute] of Object.entries(
      configuration?.attributes
    )) {
      if (attributeName.startsWith('flow:')) {
        configurationSettings = {
          ...configurationSettings,
          ...this.getAttributeAsSetting(attributeName, attribute),
        };
      }
    }

    this.settings.next({
      ...this.settings.value,
      ...configurationSettings,
    });
  }

  getAttributeAsSetting(attributeName: string, attribute: FlowNodeAttribute) {
    try {
      const settingName = attributeName.replace('flow:', '');
      const settingValue = JSON.parse(attribute.value);
      return {
        [settingName]: settingValue,
      };
    } catch {
      return {};
    }
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
          [key]: this.defaultSettings[key as K],
        };
      }
    }

    return settings;
  }
}
