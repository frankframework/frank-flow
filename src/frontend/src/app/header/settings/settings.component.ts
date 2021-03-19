import { Component, OnInit } from '@angular/core';
import { SettingsService } from './settings.service';
import { Settings } from './settings.model';
import { ModeType } from '../modes/modeType.enum';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  settings!: Settings;
  modeType = ModeType;

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
