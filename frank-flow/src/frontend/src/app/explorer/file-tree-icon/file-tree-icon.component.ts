import { Component, Input } from '@angular/core';
import { FileTreeItemModel } from '../../shared/models/file-tree-item.model';

@Component({
  selector: 'app-file-tree-icon',
  templateUrl: './file-tree-icon.component.html',
  styleUrls: ['./file-tree-icon.component.scss'],
})
export class FileTreeIconComponent {
  @Input() icon!: string;
  @Input() item!: FileTreeItemModel;
  @Input() expanded?: boolean | null = false;
}
