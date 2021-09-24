import { Originator } from './originator';
import { File } from '../models/file.model';

describe('Originator', () => {
  it('should create an instance', () => {
    const file = new File();
    expect(new Originator(file)).toBeTruthy();
  });
});
