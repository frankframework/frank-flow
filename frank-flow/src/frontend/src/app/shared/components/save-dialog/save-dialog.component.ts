import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { CurrentFileService } from '../../services/current-file.service';
import { File } from '../../models/file.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-save-dialog',
  templateUrl: './save-dialog.component.html',
  styleUrls: ['./save-dialog.component.scss'],
})
export class SaveDialogComponent implements OnInit, OnDestroy {
  item!: File;
  currentFile!: File | undefined;
  private currentFileSubscription!: Subscription;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private currentFileService: CurrentFileService
  ) {}

  ngOnInit() {
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  ngOnDestroy() {
    this.currentFileSubscription.unsubscribe();
  }

  onDataAdded(): void {
    this.item = this.ngxSmartModalService.getModalData('saveDialog');
  }

  save(): void {
    this.currentFileService.save();
    this.currentFileService.switchToFileTreeItem(this.item);
    this.ngxSmartModalService.close('saveDialog');
  }

  discard(): void {
    this.currentFileService.switchToFileTreeItem(this.item);
    this.ngxSmartModalService.close('saveDialog');
  }
}
