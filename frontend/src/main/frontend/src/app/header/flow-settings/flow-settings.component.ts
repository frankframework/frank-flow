import { Component, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { ForwardStyle } from '../settings/options/forward-style';
import { GridSize } from '../settings/options/grid-size';
import { FlowDirection } from '../../shared/enums/flow-direction.model';
import { FlowSettingsService } from '../../shared/services/flow-settings.service';
import { FlowSettings } from 'src/app/shared/models/flow-settings.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FlowNamespaceService } from 'src/app/shared/services/flow-namespace.service';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-flow-settings',
  templateUrl: './flow-settings.component.html',
  styleUrls: ['./flow-settings.component.scss'],
})
export class FlowSettingsComponent implements OnInit {
  public forwardStyle = ForwardStyle;
  public gridSize = GridSize;
  public flowDirection = FlowDirection;
  public flowSettings!: FlowSettings | undefined;

  constructor(
    private flowSettingsService: FlowSettingsService,
    private flowStructureService: FlowStructureService,
    private ngxSmartModalService: NgxSmartModalService,
    private flowNamespaceService: FlowNamespaceService,
    private library: FaIconLibrary
  ) {}

  ngOnInit(): void {
    this.library.addIcons(faTrash);
    this.getFlowSettings();
  }

  getFlowSettings(): void {
    this.flowSettingsService.flowSettingsObservable.subscribe({
      next: (flowSettings) => {
        this.flowSettings = flowSettings;
      },
    });
  }

  setFlowSettings(
    settingName: string,
    settingValue: string | number | undefined
  ): void {
    if (settingValue === undefined) return;
    this.flowNamespaceService.handleNameSpace();
    this.flowStructureService.setFlowSetting(
      'flow:' + settingName,
      settingValue
    );
  }

  deleteFlowSetting(attributeName: string) {
    this.flowStructureService.deleteFlowSetting('flow:' + attributeName);
  }

  closeFlowSettingsAndOpenSettingsModal() {
    this.ngxSmartModalService.getModal('flowSettingsModal').close();
    this.ngxSmartModalService.getModal('settingsModal').open();
  }

  resetFlowAttributes() {
    this.flowStructureService.deleteFlowSettings();
  }
}
