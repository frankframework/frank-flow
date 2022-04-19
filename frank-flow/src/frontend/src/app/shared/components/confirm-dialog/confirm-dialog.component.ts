import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { SettingsService } from '../../../header/settings/settings.service';
import { Settings } from '../../../header/settings/settings.model';
import { ConfirmModalData } from './confirm-modal-data.model';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  private actionFunction() {}
  public modalData!: ConfirmModalData;
  public settings!: Settings;
  public showConfirmPopup = true;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private settingsService: SettingsService
  ) {}

  onDataAdded(): void {
    this.resetPreviousData();
    this.modalData = this.ngxSmartModalService.getModalData('confirmDialog');
    this.actionFunction = this.modalData.actionFunction;
    this.openModelOrPerformAction();
  }

  resetPreviousData() {
    this.settings = this.settingsService.getSettings();
    this.showConfirmPopup = this.settings.showConfirmPopup;
  }

  openModelOrPerformAction() {
    if (this.settings.showConfirmPopup) {
      this.ngxSmartModalService.open('confirmDialog');
    } else {
      this.actionFunction();
    }
  }

  confirm(): void {
    this.settings.showConfirmPopup = this.showConfirmPopup;
    this.settingsService.setSettings(this.settings);
    this.actionFunction();
    this.ngxSmartModalService.close('confirmDialog');
  }

  cancel(): void {
    this.ngxSmartModalService.close('confirmDialog');
  }
}
