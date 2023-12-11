import { Injectable } from '@angular/core';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { ReplaySubject } from 'rxjs';
import { FlowSettings } from '../models/flow-settings.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';
import { ForwardStyle } from '../../header/settings/options/forward-style';
import { GridSize } from '../../header/settings/options/grid-size';
import { FlowDirection } from '../enums/flow-direction.model';
import { CurrentAdapterService } from './current-adapter.service';
import { Adapter } from '../models/adapter.model';

@Injectable({
  providedIn: 'root',
})
export class FlowSettingsService {
  private flowSettings: ReplaySubject<FlowSettings | undefined> =
    new ReplaySubject<FlowSettings | undefined>(1);
  public flowSettingsObservable = this.flowSettings.asObservable();

  constructor(private currentAdapterService: CurrentAdapterService) {
    this.subscribeToCurrentAdapter();
  }

  subscribeToCurrentAdapter() {
    this.currentAdapterService.currentAdapterObservable.subscribe({
      next: (adapter: Adapter) => {
        if (adapter.flowStructure?.configuration) {
          this.getSettingsFromConfiguration(
            adapter.flowStructure.configuration
          );
        } else {
          this.flowSettings.next(undefined!);
        }
      },
    });
  }

  getSettingsFromConfiguration(configuration: FlowStructureNode) {
    const configurationAttributes = Object.entries(configuration?.attributes);
    const flowSettingAttributes = configurationAttributes.filter(([key, _]) =>
      key.startsWith('flow:')
    );
    const flowSettings: FlowSettings = {};
    for (const [name, attribute] of flowSettingAttributes) {
      this.assignAttributeToSetting(name, attribute, flowSettings);
    }
    this.flowSettings.next(flowSettings);
  }

  assignAttributeToSetting(
    name: string,
    attribute: FlowNodeAttribute,
    flowSettings: FlowSettings
  ) {
    const key = name.replace('flow:', '');
    const value = this.getValueFromString(attribute.value);
    switch (key) {
      case 'direction': {
        if (
          this.typeHasValue({
            value,
            type: FlowDirection,
            name: 'direction',
          })
        ) {
          flowSettings.direction = value;
        }
        break;
      }
      case 'forwardStyle': {
        if (
          this.typeHasValue({
            value,
            type: ForwardStyle,
            name: 'forwardStyle',
          })
        ) {
          flowSettings.forwardStyle = value;
        }
        break;
      }
      case 'gridSize': {
        if (this.typeHasValue({ value, type: GridSize, name: 'gridSize' })) {
          flowSettings.gridSize = value;
        }
        break;
      }
      default: {
        console.error(`Unknown flow setting: ${key}`);
        break;
      }
    }
  }

  getValueFromString(string: string): any {
    if (string === 'true') {
      return true;
    } else if (string === 'false') {
      return false;
    } else if (Number.isNaN(+string)) {
      return string;
    } else {
      return +string;
    }
  }

  typeHasValue(options: { value: any; type: any; name: string }): boolean {
    const typeIncludesValue = Object.values(options.type).includes(
      options.value
    );
    if (!typeIncludesValue) {
      console.error(
        `Invalid value for ${options.name}: ${
          options.value
        }. Valid values are: ${Object.values(options.type).join(', ')}`
      );
    }
    return typeIncludesValue;
  }
}
