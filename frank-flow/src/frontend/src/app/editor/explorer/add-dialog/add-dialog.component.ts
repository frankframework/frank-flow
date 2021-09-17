import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from 'src/app/shared/services/file.service';
import { CodeService } from '../../../shared/services/code.service';
import { File } from '../../../shared/models/file.model';
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
    private codeService: CodeService,
    private toastr: ToastrService
  ) {}

  onDataAdded(): void {
    this.currentFile = this.ngxSmartModalService.getModalData('addDialog');
    this.currentDirectory = this.codeService.currentDirectory;
  }

  add(): void {
    const fileName = this.fileName;
    const duplicateFiles = this.checkForDuplicateFiles();
    if (duplicateFiles) {
      this.toastr.error(
        `The file ${fileName} already exists in this directory.`,
        'Error creating'
      );
    } else if (this.currentDirectory.configuration) {
      this.fileService
        .updateFileForConfiguration(
          this.currentDirectory.configuration,
          this.currentDirectory.path + '/' + fileName,
          this.basicFileTemplate(fileName)
        )
        .then((response) => {
          if (response) {
            this.toastr.success(
              `The file ${fileName} has been created.`,
              'File created!'
            );
          } else {
            this.toastr.error(
              `The file ${fileName} couldn't be created.`,
              'Error creating'
            );
          }
        });
      this.clearForm();
      this.fileService.fetchFiles();
      this.ngxSmartModalService.close('addDialog');
    }
  }

  checkForDuplicateFiles(): boolean {
    const fileName = this.fileName;
    const rootDir = this.fileService.configurationFiles.value;
    const currentDirectory = this.findCurrentDirectory(
      rootDir[0].content,
      this.currentDirectory.path
    );
    return this.findDuplicateFileName(fileName, currentDirectory);
  }

  findCurrentDirectory(directory: any, path: string | undefined): any {
    if (path === '' || path === undefined) {
      return directory;
    }
    let nextDirRegex = path.match(/.*(?=\/)/g);
    const nextDir = nextDirRegex ? nextDirRegex[0] : path;
    let nextPath = nextDirRegex ? path.replace(/.*\//g, '') : '';

    return this.findCurrentDirectory(directory[nextDir], nextPath);
  }

  findDuplicateFileName(fileName: string, directory: any): boolean {
    return directory?._files?.find((file: string) => file === fileName);
  }

  clearForm(): void {
    this.fileName = '';
    this.isFolder = false;
  }

  basicFileTemplate(displayName: string): string {
    return (
      '<Configuration name="' +
      displayName +
      '">\n' +
      '\t<Adapter name="' +
      displayName +
      'Adapter"> \n' +
      '\t\t<Receiver name="' +
      displayName +
      'Receiver" x="681" y="24"> \n' +
      '\t\t\t<JavaListener name="' +
      displayName +
      'Listener" serviceName="' +
      displayName +
      'Service" />\n' +
      '\t\t</Receiver>\n' +
      '\t\t<Pipeline firstPipe="' +
      displayName +
      'Pipe">\n' +
      '\t\t\t<FixedResultPipe name="' +
      displayName +
      'Pipe" returnString="Hello World">\n' +
      '\t\t\t\t<Forward name="success" path="EXIT"/> \n' +
      '\t\t\t</FixedResultPipe> \n' +
      '\t\t\t<Exit path="EXIT" state="success" x="223" y="425"/> \n' +
      '\t\t</Pipeline> \n' +
      '\t</Adapter>\n' +
      '</Configuration>\n'
    );
  }

  discard(): void {
    this.ngxSmartModalService.close('addDialog');
  }
}
