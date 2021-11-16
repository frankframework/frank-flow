import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from 'src/app/shared/services/file.service';
import { CurrentFileService } from '../../services/current-file.service';
import { File } from '../../models/file.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-add-dialog',
  templateUrl: './add-dialog.component.html',
  styleUrls: ['./add-dialog.component.scss'],
})
export class AddDialogComponent {
  fileName!: string;
  currentFile!: File;
  isFolder = false;
  currentDirectory!: File;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService,
    private currentFileService: CurrentFileService,
    private toastr: ToastrService
  ) {}

  onDataAdded(): void {
    this.currentFile = this.ngxSmartModalService.getModalData('addDialog');
    this.currentDirectory = this.currentFileService.currentDirectory;
  }

  add(): void {
    if (!this.currentDirectory.configuration) {
      this.toastr.error(
        `Please select a configuration or directory.`,
        `Error creating ${this.isFolder ? 'folder' : 'file'}`
      );
      return;
    }

    this.createFileOrFolder().then((response) => {
      this.giveMessage(response);
      this.clearForm();
      this.clearDirectory();
      this.fileService.fetchFiles();
      this.ngxSmartModalService.close('addDialog');
    });
  }

  createFileOrFolder(): Promise<Response> {
    return this.isFolder ? this.createFolder() : this.createFile();
  }

  createFolder(): Promise<Response> {
    return this.fileService.createDirectoryForConfiguration(
      this.currentDirectory.configuration,
      this.currentDirectory.path + '/' + this.fileName
    );
  }

  createFile(): Promise<Response> {
    return this.fileService.createFileForConfiguration(
      this.currentDirectory.configuration,
      this.currentDirectory.path + '/' + this.fileName,
      this.helloWorldFileTemplate(this.fileName)
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
      `The ${this.isFolder ? 'folder' : 'file'} ${
        this.fileName
      } has been created.`,
      `${this.isFolder ? 'Folder' : 'File'} created!`
    );
  }

  giveConflictMessage(): void {
    this.toastr.error(
      `The ${this.isFolder ? 'folder' : 'file'} ${
        this.fileName
      } already exists.`,
      `${this.isFolder ? 'Folder' : 'File'} already exists!`
    );
  }

  giveErrorMessage(): void {
    this.toastr.error(
      `The ${this.isFolder ? 'folder' : 'file'} ${
        this.fileName
      } couldn't be created.`,
      `Error creating ${this.isFolder ? 'folder' : 'file'}`
    );
  }

  clearDirectory(): void {
    this.currentFileService.resetCurrentDirectory();
  }

  clearForm(): void {
    this.fileName = '';
    this.isFolder = false;
  }

  helloWorldFileTemplate(displayName: string): string {
    displayName = displayName.replace('.xml', '');
    return `<Configuration name="$\{displayName}">
\t<Adapter name="${displayName}Adapter">
\t\t<Receiver name="${displayName}Receiver">
\t\t\t<JavaListener name="${displayName}Listener" serviceName="${displayName}Service" />
\t\t</Receiver>
\t\t<Pipeline firstPipe="${displayName}Pipe">
\t\t\t<FixedResultPipe name="${displayName}Pipe" returnString="Hello World">
\t\t\t\t<Forward name="success" path="EXIT"/>
\t\t\t</FixedResultPipe>
\t\t\t<Exit path="EXIT" state="success"/>
\t\t</Pipeline>
\t</Adapter>
</Configuration>`;
  }

  discard(): void {
    this.ngxSmartModalService.close('addDialog');
  }
}
