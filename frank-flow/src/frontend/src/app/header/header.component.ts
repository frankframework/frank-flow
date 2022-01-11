import { Component, OnInit } from '@angular/core';
import {
  faCog,
  faPen,
  faPlus,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { CurrentFileService } from '../shared/services/current-file.service';
import { File } from '../shared/models/file.model';
import { FileType } from '../shared/enums/file-type.enum';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  currentFile!: File;

  constructor(
    private library: FaIconLibrary,
    private toastr: ToastrService,
    private ngxSmartModalService: NgxSmartModalService,
    private currentFileService: CurrentFileService
  ) {
    library.addIcons(faPlus, faSave, faCog, faPen);
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

  openAddDialog(): void {
    const currentDirectory = this.currentFileService.currentDirectory;

    if (currentDirectory?.configuration) {
      this.ngxSmartModalService
        .getModal('addDialog')
        .setData(this.currentFile, true)
        .open();
    } else {
      this.toastr.error('Please select a folder first', "Can't add item");
    }
  }

  currentFileTitle() {
    if (this.currentFile?.type === FileType.EMPTY) {
      return 'No file selected';
    } else if (this.currentFile) {
      return this.currentFile.configuration + ': ' + this.currentFile.path;
    } else {
      return 'Loading file...';
    }
  }
}
