import { FileType } from '../enums/file-type.enum';
import { Convertible } from '../interfaces/convertible';

export class File implements Convertible {
  name?: string;
  type?: FileType;
  data?: string;
}
