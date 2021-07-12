export class ParsedNumPixels {
  readonly hasNumber: boolean = false;
  readonly theNumber: number = 0;
  readonly error: string = 'Error initializing';

  constructor(s: string, tag: string) {
    if (!s.endsWith('px')) {
      this.error = `${tag} does not end with "px"`;
    }
    const idx = s.indexOf('px');
    const numberString = s.substr(0, idx);
    try {
      this.theNumber = parseInt(numberString, 10);
      this.hasNumber = true;
    } catch (e) {
      this.error = `${tag} does not have a number before "px"`;
    }
  }
}
