import { Component, Input, OnInit } from '@angular/core';
import { FileTreeItemModel } from '../../shared/models/file-tree-item.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';

@Component({
  selector: 'app-file-tree-item',
  templateUrl: './file-tree-item.component.html',
  styleUrls: ['./file-tree-item.component.scss'],
})
export class FileTreeItemComponent implements OnInit {
  @Input() item!: FileTreeItemModel;
  expanded?: boolean;

  constructor(private currentFileService: CurrentFileService) {}

  ngOnInit(): void {
    this.initExpanded();
    this.subscribeToCurrentFile();
  }

  subscribeToCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe({
      next: (value: File): void => {
        if (
          value.path === this.item.path &&
          value.configuration === this.item.name
        ) {
          this.setSelected(true);
          this.toggleExpanded();
        } else {
          this.setSelected(false);
        }
        if (this.item.type === 'folder') {
          for (let child of this.item.children) {
            if (!this.expanded) {
              this.expanded =
                value.path === child.path && value.configuration === child.name;
            }
          }
        }
      },
    });
  }

  initExpanded(): void {
    if (
      this.item.type === 'folder' ||
      (this.item.type === 'file' && this.item.fileType === 'configuration')
    ) {
      this.expanded = this.item.expanded;
    }
  }

  toggleExpanded(): void {
    if (
      this.item.type === 'folder' ||
      (this.item.type === 'file' && this.item.fileType === 'configuration')
    ) {
      this.expanded = !this.expanded;
    }
  }

  onClick(): void {
    if (this.item.type === 'folder') {
      this.expanded = !this.expanded;
    }
    this.currentFileService.handleFileClick(this.item);
  }

  setSelected(value: boolean): void {
    if (this.item.type === 'file') {
      this.item.currentlySelected = value;
    }
  }
}
