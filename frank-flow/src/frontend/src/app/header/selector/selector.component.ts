import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { jqxDropDownButtonComponent } from 'jqwidgets-ng/jqxdropdownbutton';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import { File } from '../../shared/models/file.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { Settings } from '../settings/settings.model';
import { SettingsService } from '../settings/settings.service';
import TreeItem = jqwidgets.TreeItem;

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
  fileMatch = /^.+\.xml$/g;

  constructor(
    private settingsService: SettingsService,
    private codeService: CurrentFileService
  ) {}

  ngAfterViewInit(): void {
    this.getSettings();
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
    this.codeService.currentFileObservable.subscribe({
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
}
