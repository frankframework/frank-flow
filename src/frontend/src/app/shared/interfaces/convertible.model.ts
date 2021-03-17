import { FileType } from '../enums/file-type.enum';

export interface ConvertibleModel {
  type?: FileType;
  data?: string;
}
