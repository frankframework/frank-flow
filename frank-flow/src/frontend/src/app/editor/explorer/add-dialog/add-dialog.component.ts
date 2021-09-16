import { Component, OnInit } from '@angular/core';
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
    console.log(
      this.currentDirectory,
      this.fileService.configurationFiles.value
    );
  }

  findDuplicateFileName(fileName: string, directory: any): boolean {
    if (directory != null && fileName != null) {
      const foundFile = directory._files.find(
        (file: string) => file === fileName
      );
      if (foundFile) {
        return true;
      }
    }
    return false;
  }

  findCurrentDirectory(directory: any, path: string): any {
    if (path === '') {
      return directory;
    } else {
      let nextDirRegex = path.match(/.*(?=\/)/g);
      let nextDir;
      let nextPath = path.replace(/.*\//g, '');

      if (!nextDirRegex) {
        nextDir = path;
        nextPath = '';
      } else {
        nextDir = nextDirRegex[0];
      }

      if (nextDir) {
        return this.findCurrentDirectory(directory[nextDir], nextPath);
      }
    }
  }

  checkForDuplicateFiles(): boolean {
    const fileName = this.fileName;
    const rootDir = this.fileService.configurationFiles.value;

    if (this.currentDirectory.path !== undefined) {
      const currentDirectory = this.findCurrentDirectory(
        rootDir[0].content,
        this.currentDirectory.path
      );

      if (this.findDuplicateFileName(fileName, currentDirectory)) {
        this.toastr.error(
          `The file ${fileName} already exists in this directory.`,
          'Error creating'
        );
        return true;
      }
    }
    return false;
  }

  add(): void {
    if (this.currentDirectory.configuration && !this.checkForDuplicateFiles()) {
      const fileName = this.fileName;

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
