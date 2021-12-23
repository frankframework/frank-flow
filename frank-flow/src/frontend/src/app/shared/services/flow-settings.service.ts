import { Injectable } from '@angular/core';
import { CurrentFileService } from './current-file.service';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { ReplaySubject } from 'rxjs';
import { FlowSettings } from '../models/flow-settings.model';

@Injectable({
  providedIn: 'root',
})
export class FlowSettingsService {
  private flowSettings: ReplaySubject<FlowSettings> =
    new ReplaySubject<FlowSettings>(1);
  public flowSettingsObservable = this.flowSettings.asObservable();

  constructor(private currentFileService: CurrentFileService) {
    this.subscribeToCurrentFile();
  }

  subscribeToCurrentFile() {
    this.currentFileService.currentFileObservable.subscribe({
      next: (file) => {
        if (file.flowStructure?.configuration) {
          this.getSettingsFromConfiguration(file.flowStructure.configuration);
        }
      },
    });
  }

  getSettingsFromConfiguration(configuration: FlowStructureNode) {
    const configurationAttributes = Object.entries(configuration?.attributes);
    const flowSettingAttributes = configurationAttributes.filter(([key, _]) =>
      key.startsWith('flow:')
    );
    let flowSettings = {};
    for (const [name, attribute] of flowSettingAttributes) {
      const key = name.replace('flow:', '');
      const value = this.getValueFromString(attribute.value);
      flowSettings = { ...flowSettings, [key]: value };
    }

    this.flowSettings.next(flowSettings);
  }

  getValueFromString(string: string): any {
    if (string === 'true') {
      return true;
    } else if (string === 'false') {
      return false;
    } else if (!Number.isNaN(+string)) {
      return +string;
    } else {
      return string;
    }
  }
}
