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
import { FileService } from './shared/services/file.service';
import { Subscription } from 'rxjs';
import { NgxSmartModalService } from 'ngx-smart-modal';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  public modeType = ModeType;
  public mode!: Mode;
  public settings!: Settings;
  public fileType = FileType;
  public currentFile!: File;
  private fileSubscription!: Subscription;

  @HostListener('window:beforeunload', ['$event'])
  unloadHandler(event: Event) {
    if (!this.currentFile?.saved && this.settings.showUnsavedChangesWarning) {
      event.preventDefault();
    }
  }

  foldExplorerArrow = () =>
    this.settings.showExplorer ? faAngleDoubleLeft : faAngleDoubleRight;

  foldPaletteArrow = () =>
    this.settings.showPalette ? faAngleDoubleRight : faAngleDoubleLeft;

  constructor(
    private modeService: ModeService,
    private settingsService: SettingsService,
    private sessionService: SessionService,
    private currentFileService: CurrentFileService,
    private fileService: FileService,
    private ngxSmartModalService: NgxSmartModalService
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
    this.settingsService.settingsObservable.subscribe(
      (settings) => (this.settings = settings)
    );
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
    // if (lastSessionFileIsNotEmpty) {
    //   this.currentFileService.fetchFileAndSetToCurrent(lastSessionFile);
    // }
    // else
    if (!this.fileService.filesExist()) {
      console.log('zit erin');
      this.ngxSmartModalService.getModal('greeterDialog').open();
      this.currentFileService.resetCurrentFile();
    } else {
      this.currentFileService.resetCurrentFile();
    }
  }

  toggleExplorer() {
    this.settings.showExplorer = !this.settings.showExplorer;
    this.settingsService.setSettings(this.settings);
  }

  togglePalette() {
    this.settings.showPalette = !this.settings.showPalette;
    this.settingsService.setSettings(this.settings);
  }
}
