import { Component } from '@angular/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faPlus,
  faArrowAltCircleDown,
  faRedoAlt,
} from '@fortawesome/free-solid-svg-icons';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FileService } from '../../shared/services/file.service';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent {
  searchTerm!: string;

  constructor(
    library: FaIconLibrary,
    private ngxSmartModalService: NgxSmartModalService,
    private fileService: FileService
  ) {
    library.addIcons(faPlus, faRedoAlt);
  }

  openAddDialog(): void {
    this.ngxSmartModalService.getModal('addDialog').open();
  }

  refreshFileTree(): void {
    this.fileService.fetchFiles();
  }
}
