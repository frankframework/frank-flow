import { Component } from '@angular/core';
import { create } from 'cypress/types/lodash';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from 'src/app/shared/services/file.service';

@Component({
  selector: 'app-add-dialog',
  templateUrl: './add-dialog.component.html',
  styleUrls: ['./add-dialog.component.scss'],
})
export class AddDialogComponent {
  item: any;
  fileName: string;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService
  ) {
    this.fileName = '';
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

  onDataAdded(): void {
    this.item = this.ngxSmartModalService.getModalData('addDialog');
  }

  add(): void {
    this.fileService.getFiles().subscribe((f) => {
      this.fileService.updateFileForConfiguration(
        f[0].name,
        this.fileName,
        this.createBasicFile(this.fileName)
      );
    });
    console.log('fetch');
    this.fileService.fetchFiles();

    this.ngxSmartModalService.close('addDialog');
  }

  discard(): void {
    this.ngxSmartModalService.close('addDialog');
  }
}
