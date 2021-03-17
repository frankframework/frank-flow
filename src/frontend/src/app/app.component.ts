import { Component, OnInit } from '@angular/core';
import { ModeModel } from './header/modes/mode.model';
import { ModeService } from './header/modes/mode.service';
import { ModeTypeEnum } from './header/modes/modeType.enum';
import { SettingsService } from './header/settings/settings.service';
import { SettingsModel } from './header/settings/settings.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  modeType = ModeTypeEnum;
  mode!: ModeModel;
  settings!: SettingsModel;

  constructor(
    private modeService: ModeService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.getMode();
    this.getSettings();
  }

  getMode(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }
}
