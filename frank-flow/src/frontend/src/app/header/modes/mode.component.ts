import { Component, OnDestroy, OnInit } from '@angular/core';
import { Mode } from './mode.model';
import { ModeService } from './mode.service';
import { ModeType } from './modeType.enum';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faCode,
  faColumns,
  faProjectDiagram,
} from '@fortawesome/free-solid-svg-icons';
import { CurrentFileService } from 'src/app/shared/services/current-file.service';
import { Subscription } from 'rxjs';
import { File } from '../../shared/models/file.model';

@Component({
  selector: 'app-modes',
  templateUrl: './mode.component.html',
  styleUrls: ['./mode.component.scss'],
})
export class ModeComponent implements OnInit, OnDestroy {
  modeType = ModeType;
  mode!: Mode;
  private modeSubscription!: Subscription;
  private currentFile!: File;
  private currentFileSubscription!: Subscription;

  constructor(
    private modeService: ModeService,
    private library: FaIconLibrary,
    private currentFileService: CurrentFileService
  ) {
    this.library.addIcons(faCode, faProjectDiagram, faColumns);
  }

  ngOnInit(): void {
    this.subscribeToMode();
    this.subscribeToCurrentFile();
  }

  ngOnDestroy(): void {
    this.modeSubscription.unsubscribe();
    this.currentFileSubscription.unsubscribe();
  }

  subscribeToMode(): void {
    this.modeSubscription = this.modeService
      .getMode()
      .subscribe((mode) => (this.mode = mode));
  }

  subscribeToCurrentFile(): void {
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  setMode(modeType: ModeType): void {
    this.flowNeedsUpdate();
    this.mode.set(modeType);
    this.modeService.setMode(this.mode);
  }

  flowNeedsUpdate(): void {
    if (this.currentFile) {
      this.currentFile.flowNeedsUpdate =
        this.mode.currentMode === ModeType.editorMode;
    }
  }
}
