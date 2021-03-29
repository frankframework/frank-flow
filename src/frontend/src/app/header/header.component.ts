import { Component, OnInit } from '@angular/core';
import {
  faCog,
  faFile,
  faFolder,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { CodeService } from '../shared/services/code.service';
import { FileService } from '../shared/services/file.service';
import { File } from '../shared/models/file.model';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  currentFile!: File;

  constructor(
    private library: FaIconLibrary,
    private toastr: ToastrService,
    private ngxSmartModalService: NgxSmartModalService,
    private codeService: CodeService,
    private fileService: FileService
  ) {
    library.addIcons(faFile, faFolder, faSave, faCog);
  }

  ngOnInit(): void {
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.codeService.curFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  saveFile(): void {
    if (
      this.currentFile.configuration &&
      this.currentFile.path &&
      this.currentFile.data &&
      !this.currentFile.saved
    ) {
      this.fileService
        .setFileForConfiguration(
          this.currentFile.configuration,
          this.currentFile.path,
          this.currentFile.data
        )
        .then((response) => {
          if (response) {
            this.toastr.success(
              `The file ${this.currentFile.path} has been saved.`,
              'File saved!'
            );
            this.currentFile.saved = true;
            this.codeService.setCurrentFile(this.currentFile);
          } else {
            this.toastr.error(
              `The file ${this.currentFile.path} couldn't be saved.`,
              'Error saving'
            );
          }
        });
    }
  }

  openSettings(): void {
    this.ngxSmartModalService.getModal('settingsModal').open();
  }
}
