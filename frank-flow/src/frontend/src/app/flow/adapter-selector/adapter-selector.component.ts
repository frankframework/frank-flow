import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { File } from '../../shared/models/file.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-adapter-selector',
  templateUrl: './adapter-selector.component.html',
  styleUrls: ['./adapter-selector.component.scss'],
})
export class AdapterSelectorComponent implements OnInit, OnDestroy {
  public currentFile!: File
  public adapterNames?: string[]
  public currentAdapterName = ""

  private currentFileSubscription!: Subscription

  constructor(private currentFileService: CurrentFileService) {
  }

  ngOnInit(): void {
    this.subscribeToCurrentFile();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
  }

  subscribeToCurrentFile(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe({
        next: (currentFile: File): void => {
          this.adapterNames = currentFile.adapters?.map((adapter) => adapter.name)
          this.currentAdapterName = currentFile.currentAdapter?.name ?? ""
          this.currentFile = currentFile
        },
      });
  }

  onAdapterChange(): void {
    const currentAdapter = this.currentFile.adapters?.find((adapter) => adapter.name === this.currentAdapterName)
    if (currentAdapter) {
      this.currentFile.currentAdapter = currentAdapter
      this.currentFile.flowNeedsUpdate = true
      this.currentFileService.updateCurrentFile(this.currentFile)
    }
  }
}
