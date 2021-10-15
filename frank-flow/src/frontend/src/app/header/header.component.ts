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
import { CurrentFileService } from '../shared/services/current-file.service';
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
    private currentFileService: CurrentFileService
  ) {
    library.addIcons(faFile, faFolder, faSave, faCog);
  }

  ngOnInit(): void {
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  save(): void {
    this.currentFileService.save();
  }

  openSettings(): void {
    this.ngxSmartModalService.getModal('settingsModal').open();
  }

  openAddDialog(): void {
    this.ngxSmartModalService
      .getModal('addDialog')
      .setData(this.currentFile, true)
      .open();
  }
}
