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
          this.helloWorldFileTemplate(fileName)
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
