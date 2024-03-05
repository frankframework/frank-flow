import { FileType } from '../enums/file-type.enum';
import { FlowStructure } from './flow-structure.model';
import { Adapter } from './adapter.model';

export interface File {
  path: string;
  configuration: string;
  xml?: string;
  adapters?: Adapter[];
  currentAdapter?: Adapter;
  flowStructure?: FlowStructure;
  errors?: string[];
  saved?: boolean;
  flowNeedsUpdate?: boolean;
  type: FileType;
  firstLoad?: boolean;
}
