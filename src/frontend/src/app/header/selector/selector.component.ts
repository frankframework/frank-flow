import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { FileService } from '../../shared/services/file.service';
import { Configuration } from '../../shared/models/configuration.model';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { CodeService } from '../../shared/services/code.service';
import { FileType } from '../../shared/enums/file-type.enum';
import { SettingsService } from '../settings/settings.service';
import { Settings } from '../settings/settings.model';
import { jqxDropDownButtonComponent } from 'jqwidgets-ng/jqxdropdownbutton';
import { ToastrService } from 'ngx-toastr';
import TreeItem = jqwidgets.TreeItem;

interface Option {
  text: string;
  value: string;
}

@Component({
  selector: 'app-selector',
  templateUrl: './selector.component.html',
  styleUrls: ['./selector.component.scss'],
})
export class SelectorComponent implements AfterViewInit {
  @ViewChild('treeReference', { static: false }) tree!: jqxTreeComponent;
  @ViewChild('dropDownButtonReference', { static: false })
  dropDownButton!: jqxDropDownButtonComponent;
  searchTerm!: string;
  treeSource!: TreeItem[];
  settings!: Settings;

  constructor(
    private settingsService: SettingsService,
    private fileService: FileService,
    private codeService: CodeService,
    private toastr: ToastrService
  ) {}

  ngAfterViewInit(): void {
    this.getSettings();
    this.getFiles();
    this.getCurrentFile();
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  getCurrentFile(): void {
    this.codeService.curFileObservable.subscribe({
      next: (currentFile) => {
        if (currentFile.name) {
          this.setDropDownLabel(currentFile.name);
        }
      },
    });
  }

  setDropDownLabel(label: string): void {
    const dropDownContent =
      '<div style="position: relative; margin-left: 5px; line-height: 32px">' +
      label +
      '</div>';
    this.dropDownButton.setContent(dropDownContent);
  }

  getFiles(): void {
    this.fileService.getFiles().subscribe({
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
    const item = this.tree.getItem(event?.args?.element);
    if (item.value) {
      const itemValue = JSON.parse(item.value);
      this.fileService
        .getFileFromConfiguration(itemValue.configuration, itemValue.path)
        .then((file) => {
          if (file) {
            this.codeService.setCurrentFile({
              name: itemValue.path,
              type: FileType.XML,
              data: file,
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
