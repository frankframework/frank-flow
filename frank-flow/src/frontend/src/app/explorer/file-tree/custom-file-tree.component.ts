import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FileTreeItemModel } from '../../shared/models/file-tree-item.model';
import { seededData } from './file-tree-seeder';
import { File } from '../../shared/models/file.model';
import { Settings } from '../../header/settings/settings.model';
import { Subscription } from 'rxjs';
import { FileService } from '../../shared/services/file.service';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { SettingsService } from '../../header/settings/settings.service';
import { Configuration } from '../../shared/models/configuration.model';
import { FileType } from '../../shared/enums/file-type.enum';
import { SwitchWithoutSavingOption } from '../../header/settings/options/switch-without-saving-option';
import TreeItem = jqwidgets.TreeItem;

@Component({
  selector: 'app-custom-file-tree',
  templateUrl: './custom-file-tree.component.html',
  styleUrls: ['./custom-file-tree.component.scss'],
})
export class CustomFileTreeComponent {
  @Input() public width: string | number = '100%';
  @Input() public height: string | number = '100%';
  @Input() public fileMatch?: RegExp;

  public treeData: FileTreeItemModel[] = [];

  private currentFile!: File;
  private settings!: Settings;
  private files!: any;
  private currentFileSubscription!: Subscription;
  private fileSubscription!: Subscription;
  private settingsSubscription!: Subscription;

  private userSelectedNewFile = false;

  constructor(
    private fileService: FileService,
    private currentFileService: CurrentFileService,
    private ngxSmartModalService: NgxSmartModalService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.getFiles();
    this.subscribeToCurrentFile();
    this.getSettings();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription?.unsubscribe();
    this.fileSubscription?.unsubscribe();
    this.settingsSubscription?.unsubscribe();
  }

  getFiles(): void {
    this.fileSubscription = this.fileService.getFiles().subscribe({
      next: (files) => {
        this.files = files;
        this.updateFileTree();
      },
    });
  }

  updateFileTree(): void {
    this.currentFileService.resetCurrentDirectory();
    this.addFilesToTree();
  }

  addFilesToTree(): void {
    this.treeData = this.files.map((configuration: Configuration): string => {
      console.log(configuration);
      return '';
      // return { name: configuration.name, path: path, } as FileTreeItemModel;
    });
  }

  parseFiles(
    configuration: string,
    content: any,
    path = ''
  ): TreeItem[] | undefined {
    const items: any[] = [];
    Object.keys(content).map((key) => {
      if (key === '_files') {
        for (const file of content._files) {
          if (!this.fileMatch || this.fileMatch.test(file)) {
            items.push({
              label: file,
              selected: this.isItemSelected(configuration, path + file),
              value: JSON.stringify({
                configuration,
                path: path + file,
                type: FileType.FILE,
              }),
            });
          }
        }
      } else {
        items.push({
          label: key,
          items: this.parseFiles(configuration, content[key], path + key + '/'),
          expanded: this.isSelectedItemInFolder(
            configuration,
            path + key + '/'
          ),
          value: JSON.stringify({
            configuration,
            path: path + key,
            type: FileType.FOLDER,
          }),
        });
      }
    });

    return items;
  }

  isItemSelected(configuration: string, path: string): boolean {
    return this.filesAreEqual(
      {
        configuration,
        path,
        type: FileType.FILE,
      },
      this.currentFile ?? {}
    );
  }

  isSelectedItemInFolder(configuration: string, path: string): boolean {
    return (
      this.currentFile?.configuration === configuration &&
      this.currentFile?.path.startsWith(path)
    );
  }

  subscribeToCurrentFile(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe((currentFile) => {
        this.currentFile = currentFile;
        if (this.userSelectedNewFile) {
          this.userSelectedNewFile = false;
        } else {
          this.updateFileTree();
        }
      });
  }

  getSettings(): void {
    this.settingsSubscription =
      this.settingsService.settingsObservable.subscribe(
        (settings) => (this.settings = settings)
      );
  }

  onItemClick(event: any): void {
    this.userSelectedNewFile = true;
    // const itemValue = this.treeData?.getItem(event?.args?.element)?.value;
    // if (itemValue) {
    //   const item: File = JSON.parse(itemValue);
    //
    //   if (this.filesAreEqual(this.currentFile, item)) {
    //     this.currentFileService.resetCurrentDirectory();
    //     return;
    //   }
    //
    //   if (item.type === FileType.FILE) {
    //     if (this.fileNeedsToBeSaved()) {
    //       this.switchUnsavedChangesDecision(item);
    //     } else {
    //       this.currentFileService.switchToFileTreeItem(item);
    //     }
    //   } else if (item.type === FileType.FOLDER) {
    //     this.currentFileService.setCurrentDirectory(item);
    //   }
    // }
  }

  filesAreEqual(file1: File, file2: File): boolean {
    return (
      file1.configuration === file2.configuration && file1.path === file2.path
    );
  }

  fileNeedsToBeSaved(): boolean {
    return this.currentFile && !this.currentFile?.saved;
  }

  switchUnsavedChangesDecision(item: File): void {
    switch (this.settings.switchWithoutSaving) {
      case SwitchWithoutSavingOption.ask: {
        this.ngxSmartModalService
          .getModal('saveDialog')
          .setData({ item, fileTreeComponent: this }, true)
          .open();
        break;
      }
      case SwitchWithoutSavingOption.save: {
        this.currentFileService.save();
        this.currentFileService.switchToFileTreeItem(item);
        break;
      }
      case SwitchWithoutSavingOption.discard: {
        this.currentFileService.switchToFileTreeItem(item);
        break;
      }
    }
  }
}
