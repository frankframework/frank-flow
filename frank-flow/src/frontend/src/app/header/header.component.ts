import { Component, OnInit } from '@angular/core';
import {
  faCog,
  faCogs,
  faPen,
  faPlus,
  faSave,
  faUndo,
  faRedo,
} from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { CurrentFileService } from '../shared/services/current-file.service';
import { File } from '../shared/models/file.model';
import { FileType } from '../shared/enums/file-type.enum';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  currentFile!: File;
  fileType = FileType;

  constructor(
    private library: FaIconLibrary,
    private toastr: ToastrService,
    private ngxSmartModalService: NgxSmartModalService,
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService
  ) {
    library.addIcons(faPlus, faSave, faCog, faPen, faCogs, faUndo, faRedo);
  }

  ngOnInit(): void {
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  save(): void {
    this.currentFileService.save();
  }

  openSettings(): void {
    this.ngxSmartModalService.getModal('settingsModal').open();
  }

  openEditFileDialog() {
    this.ngxSmartModalService
      .getModal('editDialog')
      .setData(this.currentFile, true)
      .open();
  }

  openFlowSettings(): void {
    this.ngxSmartModalService.getModal('flowSettingsModal').open();
  }

  currentFileTitle() {
    if (this.currentFile?.type === FileType.EMPTY) {
      return 'No file selected';
    } else if (this.currentFile) {
      return this.currentFile.configurationName + ': ' + this.currentFile.path;
    } else {
      return 'Loading file...';
    }
  }

  undo(): void {
    this.flowStructureService.monacoEditorComponent?.undo();
  }

  redo(): void {
    this.flowStructureService.monacoEditorComponent?.redo();
  }
}
