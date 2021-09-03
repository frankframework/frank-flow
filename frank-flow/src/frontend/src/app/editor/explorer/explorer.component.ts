import { Component } from '@angular/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlus, faRedoAlt, faTrash } from '@fortawesome/free-solid-svg-icons';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from '../../shared/services/file.service';
import { CodeService } from '../../shared/services/code.service';
import { File } from '../../shared/models/file.model';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent {
  searchTerm!: string;
  currentFile!: File;

  constructor(
    library: FaIconLibrary,
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService,
    private codeService: CodeService
  ) {
    library.addIcons(faPlus, faRedoAlt, faTrash);
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.codeService.curFileObservable.subscribe(
      (currentFile: File) => (this.currentFile = currentFile)
    );
  }

  openAddDialog(): void {
    this.ngxSmartModalService.getModal('addDialog').open();
  }

  deleteFile(): void {
    this.fileService.removeFileFromConfiguation(this.currentFile);
    this.fileService.fetchFiles();
  }

  refreshFileTree(): void {
    this.fileService.fetchFiles();
  }
}
