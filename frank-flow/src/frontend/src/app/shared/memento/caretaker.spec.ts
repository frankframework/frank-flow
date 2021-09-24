import { Caretaker } from './caretaker';
import { File } from '../models/file.model';
import { Originator } from './originator';

describe('Caretaker', () => {
  it('should create an instance', () => {
    const file = new File();
    const originator = new Originator(file);
    expect(new Caretaker(originator)).toBeTruthy();
  });
});
