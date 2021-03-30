import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { ToastrService } from 'ngx-toastr';
import { FileType } from '../../enums/file-type.enum';
import { Configuration } from '../../models/configuration.model';
import { CodeService } from '../../services/code.service';
import { FileService } from '../../services/file.service';
import { File } from '../../models/file.model';
import TreeItem = jqwidgets.TreeItem;
import { Subscription } from 'rxjs';

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

  constructor(
    private fileService: FileService,
    private codeService: CodeService,
    private toastr: ToastrService
  ) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.getFiles();
      this.getCurrentFile();
    })
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.fileSubscription.unsubscribe();
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
      })
    );

    setTimeout(() => this.tree?.refresh());
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
              value: JSON.stringify({ configuration, path: path + file }),
            });
          }
        });
      } else {
        items.push({
          label: key,
          items: this.parseFiles(configuration, content[key], key + '/'),
        });
      }
    });

    return items;
  }

  getCurrentFile(): void {
    const initialCurrentFile = this.codeService.getCurrentFile();
    if (initialCurrentFile) {
      this.currentFile = initialCurrentFile;
    }
    this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  onItemClick(event: any): void {
    if (!this.currentFile?.saved) {
      if (!confirm('Are you sure you want to switch files without saving?')) {
        return;
      }
    }

    const itemValue = this.tree.getItem(event?.args?.element).value;
    if (itemValue) {
      const item = JSON.parse(itemValue);

      if (
        this.currentFile.path !== item.path ||
        this.currentFile.configuration !== item.configuration
      ) {
        this.fileService
          .getFileFromConfiguration(item.configuration, item.path)
          .then((file) => {
            if (file) {
              this.codeService.clearMementoHistory();
              this.codeService.setCurrentFile({
                path: item.path,
                type: FileType.XML,
                data: file,
                saved: true,
                configuration: item.configuration,
              });
            }
          })
          .catch((error) => {
            console.error(error);
            this.toastr.error(error, `File can't be fetched`);
          });
      }
    }
  }
}
