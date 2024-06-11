import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { ToastrService } from 'ngx-toastr';
import { CurrentFileService } from '../../services/current-file.service';
import { FileService } from '../../services/file.service';
import { File } from '../../models/file.model';

@Component({
  selector: 'app-edit-dialog',
  templateUrl: './edit-dialog.component.html',
  styleUrls: ['./edit-dialog.component.scss'],
})
export class EditDialogComponent {
  fileName!: string;
  oldName!: string;
  currentFile!: File;
  currentDirectory!: File;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService,
    private currentFileService: CurrentFileService,
    private toastr: ToastrService
  ) {}

  onDataAdded(): void {
    this.currentFile = this.ngxSmartModalService.getModalData('editDialog');
    this.currentDirectory = this.currentFileService.currentDirectory;
    this.initFileNames();
  }

  initFileNames(): void {
    const shortName = this.currentDirectory?.path
      ? this.getShortFileOrDirectoryName(this.currentDirectory)
      : this.getShortFileOrDirectoryName(this.currentFile);

    this.fileName = shortName;
    this.oldName = shortName;
  }

  getShortFileOrDirectoryName(file: File): string {
    const pathRegExp = /^.*\//;
    return file.path.replace(pathRegExp, '');
  }

  edit(): void {
    if (this.oldName === this.fileName) {
      return;
    }

    this.editFileOrFolder()
      .then((response) => {
        this.giveEditMessage(response);
        return response.text();
      })
      .then((newFileName) => {
        this.handleEditedFile(newFileName);
      });
  }

  handleEditedFile(newFileName: string): void {
    this.clearDirectory();
    this.fileService.fetchFiles();
    this.reloadHeaderWithNewFile(newFileName);
    this.ngxSmartModalService.close('editDialog');
  }

  reloadHeaderWithNewFile(newFileName: string): void {
    this.currentFile.path = this.currentDirectory?.path
      ? this.currentFile.path.replace(this.currentDirectory?.path, newFileName)
      : newFileName;
    this.currentFileService.updateCurrentFile(this.currentFile);
  }

  editFileOrFolder(): Promise<Response> {
    return this.currentDirectory?.path ? this.editFolder() : this.editFile();
  }

  editFile(): Promise<Response> {
    return this.fileService.changeFileNameForConfiguration(
      this.currentFile,
      this.fileName
    );
  }

  editFolder(): Promise<Response> {
    return this.fileService.changeFolderNameForConfiguration(
      this.currentDirectory,
      this.fileName
    );
  }

  giveEditMessage(response: Response): void {
    switch (response.status) {
      case 200:
      case 201:
        this.giveSuccessMessage();
        break;
      default:
        this.giveErrorMessage();
        break;
    }
  }

  giveSuccessMessage(): void {
    this.toastr.success(
      `The ${this.currentDirectory?.path ? 'folder' : 'file'} ${
        this.fileName
      } has been changed.`,
      `${this.currentDirectory?.path ? 'Folder' : 'File'} changed!`
    );
  }

  giveErrorMessage(): void {
    this.toastr.error(
      `The ${this.currentDirectory?.path ? 'folder' : 'file'} ${
        this.fileName
      } couldn't be changed.`,
      `Error changing ${this.currentDirectory?.path ? 'folder' : 'file'}`
    );
  }

  removeFileOrFolder(): Promise<Response> {
    return this.currentDirectory?.path
      ? this.fileService.removeDirectoryForConfiguration(
          this.currentDirectory.configuration,
          this.currentDirectory.path
        )
      : this.fileService.removeFileForConfiguration(
          this.currentFile.configuration,
          this.currentFile.path
        );
  }

  giveDeleteMessage(response: Response): void {
    switch (response.status) {
      case 200:
      case 201:
        this.giveDeleteSuccessMessage();
        break;
      default:
        this.giveDeleteErrorMessage();
        break;
    }
  }

  giveDeleteSuccessMessage(): void {
    this.toastr.success(
      `The ${this.currentDirectory?.path ? 'folder' : 'file'} ${
        this.fileName
      } has been deleted.`,
      `${this.currentDirectory?.path ? 'Folder' : 'File'} deleted!`
    );
  }

  giveDeleteErrorMessage(): void {
    this.toastr.error(
      `The ${this.currentDirectory?.path ? 'folder' : 'file'} ${
        this.fileName
      } couldn't be deleted.`,
      `Error deleting ${this.currentDirectory?.path ? 'folder' : 'file'}`
    );
  }

  clearDirectory(): void {
    this.currentFileService.resetCurrentDirectory();
  }

  close(): void {
    this.ngxSmartModalService.close('editDialog');
  }
}
