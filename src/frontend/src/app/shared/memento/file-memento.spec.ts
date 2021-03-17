import { FileMemento } from './file-memento';
import { File } from '../models/file.model';

describe('FileMemento', () => {
  it('should create an instance', () => {
    const file = new File();
    expect(new FileMemento(file)).toBeTruthy();
  });
});
