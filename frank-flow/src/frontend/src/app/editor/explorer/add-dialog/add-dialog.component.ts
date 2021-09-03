import { Component } from '@angular/core';
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
  item: any;
  fileName: string;
  currentFile!: File;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService,
    private codeService: CodeService
  ) {
    this.fileName = '';
    this.getCurrentFile();
  }

  onDataAdded(): void {
    this.item = this.ngxSmartModalService.getModalData('addDialog');
  }

  add(): void {
    const currentDirectory = this.fileService.currentDirectory;
    console.log('currentdir: ', currentDirectory);
    if (currentDirectory.configuration) {
      this.fileService.updateFileForConfiguration(
        currentDirectory.configuration,
        currentDirectory.path + '/' + this.fileName,
        this.createBasicFile(this.fileName)
      );

      this.fileService.fetchFiles();
      this.ngxSmartModalService.close('addDialog');
    }
  }

  getCurrentFile(): void {
    this.codeService.curFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  createBasicFile(displayName: string): string {
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
