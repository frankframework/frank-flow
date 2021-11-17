import { Component, OnInit } from '@angular/core';
import { Mode } from './header/modes/mode.model';
import { ModeService } from './header/modes/mode.service';
import { ModeType } from './header/modes/modeType.enum';
import { SettingsService } from './header/settings/settings.service';
import { Settings } from './header/settings/settings.model';
import { SessionService } from './shared/services/session.service';
import { FileService } from './shared/services/file.service';
import { CurrentFileService } from './shared/services/current-file.service';
import { FileType } from './shared/enums/file-type.enum';
import { File } from './shared/models/file.model';

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
    private settingsService: SettingsService,
    private sessionService: SessionService,
    private fileService: FileService,
    private currentFileService: CurrentFileService
  ) {}

  ngOnInit(): void {
    this.getMode();
    this.getSettings();
    this.initializeLoadLastSessionFIle();
  }

  getMode(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  initializeLoadLastSessionFIle(): void {
    const lastSessionFile = this.sessionService.getSessionFile();
    if (lastSessionFile) {
      this.fetchFileAndSetToCurrent(lastSessionFile);
    }
  }

  fetchFileAndSetToCurrent(file: File): void {
    this.fileService
      .getFileFromConfiguration(file.configuration, file.path)
      .then((result) => {
        if (result) {
          this.setCurrentFile(file, result);
        }
      });
  }

  setCurrentFile(file: File, content: string): void {
    const currentFile = {
      type: FileType.FILE,
      configuration: file.configuration,
      path: file.path,
      xml: content,
      saved: true,
      flowNeedsUpdate: true,
    };
    this.currentFileService.setCurrentFile(currentFile);
  }
}
