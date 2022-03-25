import { Component, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { ForwardStyle } from '../settings/options/forward-style';
import { GridSize } from '../settings/options/grid-size';
import { FlowDirection } from '../../shared/enums/flow-direction.model';
import { FlowSettingsService } from '../../shared/services/flow-settings.service';
import { FlowSettings } from 'src/app/shared/models/flow-settings.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FlowNamespaceService } from 'src/app/shared/services/flow-namespace.service';

@Component({
  selector: 'app-configuration-settings',
  templateUrl: './configuration-settings.component.html',
  styleUrls: ['./configuration-settings.component.scss'],
})
export class ConfigurationSettingsComponent implements OnInit {
  public forwardStyle = ForwardStyle;
  public gridSize = GridSize;
  public flowDirection = FlowDirection;
  public flowSettings!: FlowSettings | undefined;

  constructor(
    private flowSettingsService: FlowSettingsService,
    private flowStructureService: FlowStructureService,
    private ngxSmartModalService: NgxSmartModalService,
    private flowNamespaceService: FlowNamespaceService
  ) {}

  ngOnInit(): void {
    this.getConfigurationSettings();
  }

  getConfigurationSettings(): void {
    this.flowSettingsService.flowSettingsObservable.subscribe({
      next: (flowSettings) => {
        this.flowSettings = flowSettings;
      },
    });
  }

  setConfigurationSettings(
    settingName: string,
    settingValue: string | number | undefined
  ): void {
    if (settingValue === undefined) return;
    this.flowStructureService.setFlowSetting(
      'flow:' + settingName,
      settingValue
    );
    this.flowNamespaceService.handleNameSpace();
  }

  deleteConfigurationSetting(attributeName: string) {
    this.flowStructureService.deleteFlowSetting('flow:' + attributeName);
  }

  closeFlowSettingsAndOpenSettingsModal() {
    this.ngxSmartModalService.getModal('configurationSettingsModal').close();
    this.ngxSmartModalService.getModal('settingsModal').open();
  }
}
