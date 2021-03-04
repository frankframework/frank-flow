import { FileType } from './file-type.enum';

export interface IConvertible {
  type: FileType;
  data: string;
}
