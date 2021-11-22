import { Component } from '@angular/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faPlus,
  faRedoAlt,
  faTrash,
  faPen,
} from '@fortawesome/free-solid-svg-icons';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from '../../shared/services/file.service';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent {
  searchTerm!: string;
  currentFile!: File;
  private currentDirectory!: File;

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
    this.currentDirectory = this.currentFileService.currentDirectory;
    this.deleteFileOrFolder().then((response) => {
      response.ok ? this.deleteFileSuccessfully() : this.deleteFileFailed();
    });
  }

  deleteFileSuccessfully(): void {
    const isFolder = this.currentDirectory.configuration;
    this.toastr.success(
      `The ${isFolder ? 'folder' : 'file'} ${
        isFolder ? this.currentDirectory.path : this.currentFile.path
      } has been removed.`,
      `${isFolder ? 'Folder' : 'File'} removed!`
    );
    this.refreshFileTree();
  }

  deleteFileFailed(): void {
    const isFolder = this.currentDirectory.configuration;
    this.toastr.error(
      `The ${isFolder ? 'folder' : 'file'} ${
        isFolder ? this.currentDirectory.path : this.currentFile.path
      } couldn't be removed.`,
      `${isFolder ? 'Folder' : 'File'} removing`
    );
  }

  deleteFileOrFolder(): Promise<Response> {
    if (this.currentDirectory.configuration) {
      return this.fileService.removeDirectoryForConfiguration(
        this.currentDirectory.configuration,
        this.currentDirectory.path
      );
    } else {
      return this.fileService.removeFileFromConfiguration(this.currentFile);
    }
  }

  refreshFileTree(): void {
    this.fileService.fetchFiles();
  }
}
