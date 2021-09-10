import { Component, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from 'src/app/shared/services/file.service';
import { CodeService } from '../../../shared/services/code.service';
import { File } from '../../../shared/models/file.model';

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
    private codeService: CodeService
  ) {}

  onDataAdded(): void {
    this.currentFile = this.ngxSmartModalService.getModalData('addDialog');
    this.currentDirectory = this.codeService.currentDirectory;
  }

  add(): void {
    if (this.currentDirectory.configuration) {
      this.fileService.updateFileForConfiguration(
        this.currentDirectory.configuration,
        this.currentDirectory.path + '/' + this.fileName,
        this.basicFileTemplate(this.fileName)
      );
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
