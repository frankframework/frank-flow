import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from '../../services/file.service';
import { File } from '../../models/file.model';
import { CurrentFileService } from '../../services/current-file.service';

@Component({
  selector: 'app-greeter-dialog',
  templateUrl: './greeter-dialog.component.html',
  styleUrls: ['./greeter-dialog.component.scss'],
})
export class GreeterDialogComponent {
  currentFile!: File;
  filesExist = true;
  currentDirectory!: File;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService,
    private currentFileService: CurrentFileService
  ) {
    this.filesExist = this.fileService.filesExist();
  }

  close(): void {
    if (!this.filesExist) {
      this.createDefaultFileWithFolder();
    }
    this.ngxSmartModalService.close('greeterDialog');
  }

  private createDefaultFileWithFolder() {
    this.currentDirectory = this.currentFileService.currentDirectory;
    console.log(this.currentDirectory);
    this.fileService.createRootDirectoryForConfiguration(
      this.currentDirectory.configuration,
      'gettingStarted'
    );
    // this.fileService.createFileForConfiguration(
    //   this.currentDirectory.configuration,
    //   this.currentDirectory.path + '/' + 'startConfiguration',
    //   this.helloWorldFileTemplate('startConfiguration')
    // );
  }
}
