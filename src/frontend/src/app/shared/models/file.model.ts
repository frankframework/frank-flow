import { FileType } from '../enums/file-type.enum';
import { ConvertibleModel } from '../interfaces/convertible.model';

export class File implements ConvertibleModel {
  name?: string;
  type?: FileType;
  data?: string;
}
