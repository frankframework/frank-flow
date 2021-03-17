import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { FileService } from '../../shared/services/file.service';
import { CodeService } from '../../shared/services/code.service';
import { FileType } from '../../shared/enums/file-type.enum';
import TreeItem = jqwidgets.TreeItem;
import { Configuration } from '../../shared/models/configuration.model';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent implements AfterViewInit {
  @ViewChild('treeReference', { static: false }) tree!: jqxTreeComponent;
  searchTerm!: string;
  treeSource!: TreeItem[];

  constructor(
    private fileService: FileService,
    private codeService: CodeService
  ) {}

  ngAfterViewInit(): void {
    this.getFiles();
  }

  getFiles(): void {
    this.fileService
      .getConfigurationsWithFiles()
      .then((result) => this.addFilesToTree(result));
  }

  addFilesToTree(configurationFiles: any): void {
    this.treeSource = configurationFiles.map(
      (configuration: Configuration) => ({
        label: configuration.name,
        expanded: true,
        items: this.parseFiles(configuration.name, configuration.content),
      })
    );

    this.tree.refresh();
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

  onSelect(event: any): void {
    const itemValue = this.tree.getItem(event?.args?.element).value;
    if (itemValue) {
      const item = JSON.parse(itemValue);

      this.fileService
        .getFileFromConfiguration(item.configuration, item.path)
        .then((file) => {
          if (file) {
            this.codeService.setCurrentFile({
              name: item.path,
              type: FileType.XML,
              data: file,
            });
          }
        });
    }
  }
}
