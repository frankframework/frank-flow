import { FileType } from '../enums/file-type.enum';

export interface IConvertible {
  type?: FileType;
  data?: string;
}
