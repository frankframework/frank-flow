import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { ToastrService } from 'ngx-toastr';
import { CurrentFileService } from '../../services/current-file.service';
import { FileService } from '../../services/file.service';
import { File } from '../../models/file.model';
import { FileType } from '../../enums/file-type.enum';

@Component({
  selector: 'app-edit-dialog',
  templateUrl: './edit-dialog.component.html',
  styleUrls: ['./edit-dialog.component.scss'],
})
export class EditDialogComponent {
  fileName!: string;
  oldFileName!: string;
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

    const shortName = this.currentDirectory?.path
      ? this.getShortFileOrDirectoryName(this.currentDirectory)
      : this.getShortFileOrDirectoryName(this.currentFile);

    this.fileName = shortName;
    this.oldFileName = shortName;

    console.log('current file: ', this.currentFile);
    console.log('current folder: ', this.currentDirectory);
  }

  getShortFileOrDirectoryName(file: File): string {
    const nameInPathRegex = '(?<=/?.{0,10}/?)[a-zA-Z0-9.]*(?!/)$';
    const nameRegexOutput = file.path.match(nameInPathRegex);

    return nameRegexOutput ? nameRegexOutput[0] : '';
  }

  edit(): void {
    console.log(
      'current directory: ',
      this.currentDirectory,
      ' current file: ',
      this.currentFile
    );

    this.editFileOrFolder().then((response) => {
      this.giveMessage(response);
      this.clearDirectory();
      this.fileService.fetchFiles();
      this.ngxSmartModalService.close('editDialog');
    });
  }

  editFileOrFolder(): Promise<Response> {
    return this.currentDirectory?.path ? this.editFolder() : this.editFile();
  }

  editFile(): Promise<Response> {
    return this.fileService.changeFileNameForConfiguration(
      this.currentFile.configuration,
      this.currentFile.path,
      this.fileName
    );
  }

  editFolder(): Promise<Response> {
    return this.fileService.changeFolderNameForConfiguration(
      this.currentDirectory.configuration,
      this.currentDirectory.path,
      this.fileName
    );
  }

  giveMessage(response: Response): void {
    switch (response.status) {
      case 200:
      case 201:
        this.giveSuccessMessage();
        break;
      case 409:
        this.giveConflictMessage();
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
      `${this.currentDirectory ? 'Folder' : 'File'} changed!`
    );
  }

  giveConflictMessage(): void {
    this.toastr.error(
      `The ${this.currentDirectory ? 'folder' : 'file'} ${
        this.fileName
      } already exists.`,
      `${this.currentDirectory ? 'Folder' : 'File'} already exists!`
    );
  }

  giveErrorMessage(): void {
    this.toastr.error(
      `The ${this.currentDirectory ? 'folder' : 'file'} ${
        this.fileName
      } couldn't be changed.`,
      `Error changing ${this.currentDirectory ? 'folder' : 'file'}`
    );
  }

  delete(): void {
    if (this.currentFile.type === FileType.FILE) {
      this.fileService.removeFileFromConfiguration(this.currentFile);
    } else if (this.currentFile.type === FileType.FOLDER) {
      this.fileService.removeFolderFromConfiguration(this.currentFile);
    }
    this.ngxSmartModalService.close('editDialog');
  }

  clearDirectory(): void {
    this.currentFileService.resetCurrentDirectory();
  }

  discard(): void {
    this.ngxSmartModalService.close('editDialog');
  }
}
