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
import { File } from '../../shared/models/file.model';

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
  currentFile!: File;

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
    setTimeout(() => {
      this.settingsService
        .getSettings()
        .subscribe((settings) => (this.settings = settings));
    });
  }

  getCurrentFile(): void {
    this.codeService.curFileObservable.subscribe({
      next: (currentFile) => {
        this.currentFile = currentFile;
        if (currentFile.path) {
          this.setDropDownLabel(
            currentFile.configuration + ': ' + currentFile.path
          );
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
      next: (configurationFiles) => {
        this.addFilesToTree(configurationFiles);
      },
    });
  }

  addFilesToTree(configurationFiles: any): void {
    setTimeout(() => {
      if (configurationFiles) {
        this.treeSource = configurationFiles.map(
          (configuration: Configuration) => ({
            label: configuration.name,
            expanded: true,
            items: this.parseFiles(configuration.name, configuration.content),
          })
        );

        setTimeout(() => this.tree.refresh());
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
          if (file.includes('.xml')) {
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

  onItemClick(event: any): void {
    console.log(this.currentFile.saved);
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
