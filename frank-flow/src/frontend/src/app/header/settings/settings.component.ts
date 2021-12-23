import { Component, OnInit } from '@angular/core';
import { SettingsService } from './settings.service';
import { Settings } from './settings.model';
import { ModeType } from '../modes/mode-type.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';
import { ForwardStyle } from './options/forward-style';
import { gridSize } from './options/grid-size';
import { FlowDirection } from '../../shared/enums/flow-direction.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  public settings!: Settings;
  public modeType = ModeType;
  public forwardStyle = ForwardStyle;
  public gridSize = gridSize;
  public switchWithoutSavingOptions = SwitchWithoutSavingOption;
  public flowDirection = FlowDirection;

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.getSettings();
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  setSettings(): void {
    this.settingsService.setSettings(this.settings);
  }
}
