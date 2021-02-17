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

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  constructor(
    library: FaIconLibrary,
    private toastr: ToastrService,
    public ngxSmartModalService: NgxSmartModalService
  ) {
    library.addIcons(faFile, faFolder, faSave, faCog);
  }

  // TODO remove later example for toaster
  showSuccess(): void {
    this.toastr.success('Your file has been saved succesfully.', 'File saved!');
  }

  openSettings(): void {
    console.log('testing');
    this.ngxSmartModalService.getModal('settingsModal').open();
  }

  ngOnInit(): void {}
}
