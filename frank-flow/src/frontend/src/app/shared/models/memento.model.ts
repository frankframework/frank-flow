import { File } from './file.model';

export interface Memento {
  getState(): File;
}
