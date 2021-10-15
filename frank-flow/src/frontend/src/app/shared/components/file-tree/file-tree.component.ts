import {
  AfterViewInit,
  Component,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { ToastrService } from 'ngx-toastr';
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
export class FileTreeComponent implements AfterViewInit, OnDestroy {
  @Input() width: string | number = '100%';
  @Input() height: string | number = '100%';
  @Input() fileMatch?: RegExp;
  @ViewChild('treeReference', { static: false }) tree!: jqxTreeComponent;
  searchTerm!: string;
  treeSource!: TreeItem[];
  currentFile!: File;
  currentFileSubscription!: Subscription;
  fileSubscription!: Subscription;
  settings!: Settings;
  settingsSubscription!: Subscription;

  constructor(
    private fileService: FileService,
    private currentFileService: CurrentFileService,
    private ngxSmartModalService: NgxSmartModalService,
    private settingsService: SettingsService,
    private toastr: ToastrService
  ) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.getFiles();
      this.getCurrentFile();
      this.getSettings();
    });
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.fileSubscription.unsubscribe();
    this.settingsSubscription.unsubscribe();
  }

  getFiles(): void {
    this.fileSubscription = this.fileService.getFiles().subscribe({
      next: (configurationFiles) => this.addFilesToTree(configurationFiles),
    });
  }

  addFilesToTree(configurationFiles: any): void {
    this.treeSource = configurationFiles.map(
      (configuration: Configuration) => ({
        label: configuration.name,
        expanded: true,
        items: this.parseFiles(configuration.name, configuration.content),
        value: JSON.stringify({
          configuration: configuration.name,
          path: '',
          type: FileType.FOLDER,
        }),
      })
    );

    setTimeout(() => {
      if (this.tree && this.tree.refresh) {
        this.tree.refresh();
      }
    });
  }

  parseFiles(
    configuration: string,
    content: any,
    path: string = ''
  ): TreeItem[] | undefined {
    const items: any[] = [];
    Object.keys(content).map((key) => {
      if (key === '_files') {
        content._files.forEach((file: string) => {
          if (!this.fileMatch || file.match(this.fileMatch)) {
            items.push({
              label: file,
              value: JSON.stringify({
                configuration,
                path: path + file,
                type: FileType.FILE,
              }),
            });
          }
        });
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

  getCurrentFile(): void {
    const initialCurrentFile = this.currentFileService.getCurrentFile();
    if (initialCurrentFile) {
      this.currentFile = initialCurrentFile;
    }
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  getSettings(): void {
    this.settingsSubscription = this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  onItemClick(event: any): void {
    const itemValue = this.tree.getItem(event?.args?.element).value;
    if (itemValue) {
      const item: File = JSON.parse(itemValue);

      if (item.type === FileType.FILE) {
        if (!this.currentFile?.saved) {
          this.switchWithoutSavingDecision(item);
        } else {
          this.currentFileService.switchToFileTreeItem(item);
        }
        this.tree.selectItem(null);
      } else if (item.type === FileType.FOLDER) {
        this.currentFileService.currentDirectory = item;
      }
    }
  }

  switchWithoutSavingDecision(item: File): void {
    switch (+this.settings.switchWithoutSaving) {
      case SwitchWithoutSavingOption.ask:
        this.ngxSmartModalService
          .getModal('saveDialog')
          .setData(item, true)
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
