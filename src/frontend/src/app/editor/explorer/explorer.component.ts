import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { FileService } from '../../shared/services/file.service';
import { CodeService } from '../../shared/services/code.service';
import { FileType } from '../../shared/enums/file-type.enum';
import { Configuration } from '../../shared/models/configuration.model';
import { ToastrService } from 'ngx-toastr';
import TreeItem = jqwidgets.TreeItem;
import { File } from '../../shared/models/file.model';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent implements AfterViewInit {
  @ViewChild('treeReference', { static: false }) tree!: jqxTreeComponent;
  searchTerm!: string;
  treeSource!: TreeItem[];
  currentFile!: File;

  constructor(
    private fileService: FileService,
    private codeService: CodeService,
    private toastr: ToastrService
  ) {}

  ngAfterViewInit(): void {
    this.getFiles();
    this.getCurrentFile();
  }

  getFiles(): void {
    setTimeout(() => {
      this.fileService.getFiles().subscribe({
        next: (configurationFiles) => this.addFilesToTree(configurationFiles),
      });
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

    this.tree?.refresh();
  }

  parseFiles(
    configuration: string,
    content: any,
    path: string = ''
  ): TreeItem[] | undefined {
    const items: any[] = [];
    Object.keys(content).map((key) => {
      if (key === '_files') {
        content._files.forEach((file: string) =>
          items.push({
            label: file,
            value: JSON.stringify({ configuration, path: path + file }),
          })
        );
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
    this.codeService.curFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  onItemClick(event: any): void {
    if (!this.currentFile.saved) {
      if (!confirm('Are you sure you want to switch files without saving?')) {
        return;
      }
    }

    const itemValue = this.tree.getItem(event?.args?.element).value;
    if (itemValue) {
      const item = JSON.parse(itemValue);

      this.fileService
        .getFileFromConfiguration(item.configuration, item.path)
        .then((file) => {
          if (file) {
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
