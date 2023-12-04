import { Component, Input } from '@angular/core';
import { FileTreeItemModel } from '../../shared/models/file-tree-item.model';

@Component({
  selector: 'app-file-tree-item',
  templateUrl: './file-tree-item.component.html',
  styleUrls: ['./file-tree-item.component.scss'],
})
export class FileTreeItemComponent {
  @Input() item!: FileTreeItemModel;
  expanded?: boolean | null;
  ngOnInit() {
    if (this.item.type === 'folder') {
      this.expanded = false;
    }
  }

  expandFolder(): void {
    this.expanded = !this.expanded;
  }
}
