import { FileTreeItem } from './file-tree-item.model';

export interface Folder extends FileTreeItem {
  path: string;
  configuration: string;
}
