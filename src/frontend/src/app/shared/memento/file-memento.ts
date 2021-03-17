import { Memento } from '../interfaces/memento';
import { File } from '../models/file.model';

export class FileMemento implements Memento {
  private state: File;

  constructor(state: File) {
    this.state = state;
  }

  getState(): File {
    return this.state;
  }
}
