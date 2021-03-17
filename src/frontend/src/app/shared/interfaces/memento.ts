import { File } from '../models/file.model';

export interface Memento {
  getState(): File;
}
