import { Component, OnInit } from '@angular/core';
import { SettingsService } from './settings.service';
import { Settings } from './settings.model';
import { Mode } from '../modes/mode.model';
import { ModeService } from '../modes/mode.service';
import { ModeType } from '../modes/modeType.enum';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  settings!: Settings;
  mode!: Mode;
  modeType = ModeType;

  constructor(
    private settingsService: SettingsService,
    private modeService: ModeService
  ) {}

  ngOnInit(): void {
    this.getSettings();
    this.getMode();
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  setSettings(): void {
    this.settingsService.setSettings(this.settings);
  }

  getMode(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }

  setDefaultMode(): void {
    this.modeService.setMode(this.mode);
  }
}
