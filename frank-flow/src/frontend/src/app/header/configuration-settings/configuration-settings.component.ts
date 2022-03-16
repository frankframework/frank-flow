import { Component, OnInit } from '@angular/core';
import { ForwardStyle } from '../settings/options/forward-style';
import { GridSize } from '../settings/options/grid-size';
import { FlowDirection } from '../../shared/enums/flow-direction.model';
import { FlowSettingsService } from '../../shared/services/flow-settings.service';
import { FlowSettings } from 'src/app/shared/models/flow-settings.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';

@Component({
  selector: 'app-configuration-settings',
  templateUrl: './configuration-settings.component.html',
  styleUrls: ['./configuration-settings.component.scss'],
})
export class ConfigurationSettingsComponent implements OnInit {
  public forwardStyle = ForwardStyle;
  public gridSize = GridSize;
  public flowDirection = FlowDirection;
  public flowSettings!: FlowSettings;

  constructor(
    private flowSettingsService: FlowSettingsService,
    private flowStructureService: FlowStructureService
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

  setConfigurationSettings(): void {
    this.flowStructureService.editConfigurationSettings(this.flowSettings);
  }
}
