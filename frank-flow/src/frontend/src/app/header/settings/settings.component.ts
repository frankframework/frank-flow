import { Component, OnInit } from '@angular/core';
import { SettingsService } from './settings.service';
import { Settings } from './settings.model';
import { ModeType } from '../modes/modeType.enum';
import { SwitchWithoutSavingOption } from './options/switch-without-saving-option';
import { ConnectionType } from './options/connection-type';
import { GridConfiguration } from "./options/grid-configuration";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  public settings!: Settings;
  public modeType = ModeType;
  public connectionType = ConnectionType;
  public gridConfiguration = GridConfiguration;
  public switchWithoutSavingOptions = SwitchWithoutSavingOption;

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
