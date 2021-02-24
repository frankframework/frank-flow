import { Component, OnInit } from '@angular/core';
import { Mode } from './header/modes/mode';
import { ModeService } from './header/modes/mode.service';
import { ModeType } from './header/modes/modeType';
import { SettingsService } from './header/settings/settings.service';
import { Settings } from './header/settings/settings';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  modeType = ModeType;
  mode!: Mode;
  settings!: Settings;

  constructor(
    private modeService: ModeService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.getModes();
    this.getSettings();
  }

  getModes(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }
}
