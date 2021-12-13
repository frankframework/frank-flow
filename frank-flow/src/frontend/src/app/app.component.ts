import { Component, OnInit } from '@angular/core';
import { Mode } from './header/modes/mode.model';
import { ModeService } from './header/modes/mode.service';
import { ModeType } from './header/modes/modeType.enum';
import { SettingsService } from './header/settings/settings.service';
import { Settings } from './header/settings/settings.model';
import { SessionService } from './shared/services/session.service';
import { CurrentFileService } from './shared/services/current-file.service';
import { FileType } from './shared/enums/file-type.enum';
import { File } from './shared/models/file.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  public modeType = ModeType;
  public mode!: Mode;
  public settings!: Settings;

  constructor(
    private modeService: ModeService,
    private settingsService: SettingsService,
    private sessionService: SessionService,
    private currentFileService: CurrentFileService
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

  initializeLoadLastSessionFile(): void {
    const lastSessionFile = this.sessionService.getSessionFile();
    if (this.lastSessionFileShouldBeLoaded(lastSessionFile)) {
      this.currentFileService.fetchFileAndSetToCurrent(lastSessionFile!);
    } else {
      this.currentFileService.resetCurrentFile();
    }
  }

  lastSessionFileShouldBeLoaded(lastSessionFile: File | undefined) {
    return lastSessionFile && lastSessionFile.type !== FileType.EMPTY;
  }
}
