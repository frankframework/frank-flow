import { FileType } from '../enums/file-type.enum';
import { IConvertible } from '../interfaces/iconvertible';

export class File implements IConvertible {
  name?: string;
  type?: FileType;
  data?: string;
}
