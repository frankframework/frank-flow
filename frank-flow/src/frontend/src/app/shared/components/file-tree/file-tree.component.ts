import {
  AfterViewInit,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { CurrentFileService } from '../../services/current-file.service';
import { FileService } from '../../services/file.service';
import { File } from '../../models/file.model';
import { Subscription } from 'rxjs';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { SettingsService } from '../../../header/settings/settings.service';
import { Settings } from '../../../header/settings/settings.model';
import { SwitchWithoutSavingOption } from '../../../header/settings/options/switch-without-saving-option';
import { FileType } from '../../enums/file-type.enum';
import { Configuration } from '../../models/configuration.model';
import TreeItem = jqwidgets.TreeItem;

@Component({
  selector: 'app-file-tree',
  templateUrl: './file-tree.component.html',
  styleUrls: ['./file-tree.component.scss'],
})
export class FileTreeComponent implements OnInit, OnDestroy {
  @Input() public width: string | number = '100%';
  @Input() public height: string | number = '100%';
  @Input() public fileMatch?: RegExp;
  @ViewChild('treeReference', { static: false }) public tree!: jqxTreeComponent;

  public treeSource: TreeItem[] = [];

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
    this.treeSource = this.files.map((configuration: Configuration) => ({
      label: configuration.name,
      expanded: true,
      items: this.parseFiles(configuration.name, configuration.content),
      value: JSON.stringify({
        configuration: configuration.name,
        path: '',
        type: FileType.FOLDER,
      }),
    }));
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
    this.settingsSubscription = this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  onItemClick(event: any): void {
    this.userSelectedNewFile = true;
    const itemValue = this.tree?.getItem(event?.args?.element)?.value;
    if (itemValue) {
      const item: File = JSON.parse(itemValue);

      if (this.filesAreEqual(this.currentFile, item)) {
        return;
      }

      if (item.type === FileType.FILE) {
        if (this.fileNeedsToBeSaved()) {
          this.switchUnsavedChangesDecision(item);
        } else {
          this.currentFileService.switchToFileTreeItem(item);
        }
      } else if (item.type === FileType.FOLDER) {
        this.currentFileService.setCurrentDirectory(item);
      }
    }
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
      case SwitchWithoutSavingOption.ask:
        this.ngxSmartModalService
          .getModal('saveDialog')
          .setData({ item, fileTreeComponent: this }, true)
          .open();
        break;
      case SwitchWithoutSavingOption.save:
        this.currentFileService.save();
        break;
      case SwitchWithoutSavingOption.discard:
        this.currentFileService.switchToFileTreeItem(item);
        break;
    }
  }
}
