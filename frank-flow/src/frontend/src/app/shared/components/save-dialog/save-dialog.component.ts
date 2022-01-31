import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { CurrentFileService } from '../../services/current-file.service';
import { File } from '../../models/file.model';
import { Subscription } from 'rxjs';
import { FileTreeComponent } from '../file-tree/file-tree.component';

@Component({
  selector: 'app-save-dialog',
  templateUrl: './save-dialog.component.html',
  styleUrls: ['./save-dialog.component.scss'],
})
export class SaveDialogComponent implements OnInit, OnDestroy {
  public item!: File;
  public currentFile!: File | undefined;
  private fileTreeComponent!: FileTreeComponent;
  private currentFileSubscription!: Subscription;
  private actionClicked = false;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private currentFileService: CurrentFileService
  ) {}

  ngOnInit() {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe(
        (currentFile) => (this.currentFile = currentFile)
      );
  }

  ngOnDestroy() {
    this.currentFileSubscription.unsubscribe();
  }

  onDataAdded(): void {
    const options = this.ngxSmartModalService.getModalData('saveDialog');
    this.item = options.item;
    this.fileTreeComponent = options.fileTreeComponent;
  }

  save(): void {
    this.actionClicked = true;
    this.currentFileService.save();
    this.currentFileService.switchToFileTreeItem(this.item);
    this.ngxSmartModalService.close('saveDialog');
  }

  discard(): void {
    this.actionClicked = true;
    this.currentFileService.switchToFileTreeItem(this.item);
    this.ngxSmartModalService.close('saveDialog');
  }

  cancel(): void {
    if (this.actionClicked) {
      this.actionClicked = false;
      return;
    }
    this.fileTreeComponent.updateFileTree();
  }
}
