import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { CurrentFileService } from '../../services/current-file.service';
import { File } from '../../models/file.model';

@Component({
  selector: 'app-save-dialog',
  templateUrl: './save-dialog.component.html',
  styleUrls: ['./save-dialog.component.scss'],
})
export class SaveDialogComponent {
  item!: File;
  currentFile!: File | undefined;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private codeService: CurrentFileService
  ) {}

  onDataAdded(): void {
    this.item = this.ngxSmartModalService.getModalData('saveDialog');
    this.currentFile = this.codeService.getCurrentFile();
  }

  save(): void {
    this.codeService.save();
    this.codeService.switchCurrentFile(this.item);
    this.ngxSmartModalService.close('saveDialog');
  }

  discard(): void {
    this.codeService.switchCurrentFile(this.item);
    this.ngxSmartModalService.close('saveDialog');
  }
}
