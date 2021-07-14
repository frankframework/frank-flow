import { FileType } from '../enums/file-type.enum';

export interface Convertible {
  type?: FileType;
  data?: string;
}
