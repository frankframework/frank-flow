import { FileType } from '../enums/file-type.enum';
import { Adapter } from './adapter.model';

export interface File {
  path: string;
  configuration: string;
  xml?: string;
  adapters?: Adapter[];
  errors?: string[];
  saved?: boolean;
  flowNeedsUpdate?: boolean;
  type: FileType;
  firstLoad?: boolean;
  currentAdapter?: Adapter;
}
