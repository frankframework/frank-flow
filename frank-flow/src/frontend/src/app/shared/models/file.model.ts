import { FileType } from '../enums/file-type.enum';
import { Convertible } from './convertible.model';

export class File implements Convertible {
  path?: string;
  type?: FileType;
  data?: string;
  configuration?: string;
  saved?: boolean;
}
