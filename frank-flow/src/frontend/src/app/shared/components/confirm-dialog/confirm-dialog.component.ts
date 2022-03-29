import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  private actionFunction() {}
  public title = '';
  public text = '';

  constructor(private ngxSmartModalService: NgxSmartModalService) {}

  onDataAdded(): void {
    const options = this.ngxSmartModalService.getModalData('confirmDialog');
    this.title = options.title;
    this.text = options.text;
    this.actionFunction = options.actionFunction;
  }

  confirm(): void {
    this.actionFunction();
    this.ngxSmartModalService.close('confirmDialog');
  }

  cancel(): void {
    this.ngxSmartModalService.close('confirmDialog');
  }
}
