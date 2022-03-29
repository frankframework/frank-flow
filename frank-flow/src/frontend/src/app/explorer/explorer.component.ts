import { Component } from '@angular/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faPen,
  faPlus,
  faRedoAlt,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from '../shared/services/file.service';
import { CurrentFileService } from '../shared/services/current-file.service';
import { File } from '../shared/models/file.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent {
  currentFile!: File;

  constructor(
    library: FaIconLibrary,
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService,
    private currentFileService: CurrentFileService,
    private toastr: ToastrService
  ) {
    library.addIcons(faPlus, faRedoAlt, faTrash, faPen);
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe(
      (currentFile: File) => (this.currentFile = currentFile)
    );
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

  openEditDialog(): void {
    const currentDirectory = this.currentFileService.currentDirectory;

    this.ngxSmartModalService
      .getModal('editDialog')
      .setData(this.currentFile, true)
      .open();
  }

  deleteFile(): void {
    this.ngxSmartModalService
      .getModal('confirmDialog')
      .setData(
        {
          title: 'Are you sure',
          text: `Do you want to delete this file from you directory? This action cannot be undone or reverted`,
          actionFunction: this.deleteFileFunction,
        },
        true
      )
      .open();
  }

  deleteFileFunction = (): void => {
    this.currentFileService.deleteFile();
  };

  refreshFileTree(): void {
    this.fileService.fetchFiles();
  }
}
