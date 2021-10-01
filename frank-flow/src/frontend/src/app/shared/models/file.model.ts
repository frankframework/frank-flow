import { FileType } from '../enums/file-type.enum';
import { FileTreeItem } from './file-tree-item.model';
import { FlowStructure } from './flow-structure.model';

export interface File extends FileTreeItem {
  path: string;
  configuration: string;
  xml?: string;
  flowStructure?: FlowStructure;
  saved?: boolean;
  flowNeedsUpdate?: boolean;
}
