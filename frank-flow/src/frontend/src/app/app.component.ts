import { Component, HostListener, OnInit } from '@angular/core';
import { Mode } from './header/modes/mode.model';
import { ModeService } from './header/modes/mode.service';
import { ModeType } from './header/modes/mode-type.enum';
import { SettingsService } from './header/settings/settings.service';
import { Settings } from './header/settings/settings.model';
import { SessionService } from './shared/services/session.service';
import { CurrentFileService } from './shared/services/current-file.service';
import { FileType } from './shared/enums/file-type.enum';
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
} from '@fortawesome/free-solid-svg-icons';
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

  @HostListener('window:beforeunload', ['$event'])
  unloadHandler(event: Event) {
    if (!this.currentFile?.saved && this.settings.showUnsavedChangesWarning) {
      event.preventDefault();
    }
  }

  foldArrow = () =>
    this.settings.showExplorer ? faAngleDoubleLeft : faAngleDoubleRight;

  private currentFile!: File;

  constructor(
    private modeService: ModeService,
    private settingsService: SettingsService,
    private sessionService: SessionService,
    private currentFileService: CurrentFileService
  ) {}

  ngOnInit(): void {
    this.subscribeToMode();
    this.subscribeToSettings();
    this.subscribeToCurrentFile();
  }

  subscribeToMode(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }

  subscribeToSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  subscribeToCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  initializeLoadLastSessionFile(): void {
    const lastSessionFile = this.sessionService.getSessionFile();
    const lastSessionFileIsNotEmpty =
      lastSessionFile && lastSessionFile.type !== FileType.EMPTY;
    if (lastSessionFileIsNotEmpty) {
      this.currentFileService.fetchFileAndSetToCurrent(lastSessionFile);
    } else {
      this.currentFileService.resetCurrentFile();
    }
  }

  toggleExplorer() {
    this.settings.showExplorer = !this.settings.showExplorer;
    this.settingsService.setSettings(this.settings);
  }
}
