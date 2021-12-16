export class ParsedClassTransformProperty {
  private errorMsg: string = '';
  private x: string = '';
  private y: string = '';

  constructor(s: string) {
    if (!s.startsWith(startWord)) {
      this.errorMsg =
        this.unexpectedInput(s) + `Should start with "${startWord}"`;
      return;
    }
    let remainder = s.slice(startWord.length);
    if (!remainder.startsWith('(') && remainder.endsWith(')')) {
      this.errorMsg = this.unexpectedInput(s) + 'Should have "(" and ")"';
      return;
    }
    remainder = remainder.slice(1, -2);
    const numbers = remainder.split(',');
    if (numbers.length !== 6) {
      this.errorMsg = this.unexpectedInput(s) + 'Should have six numbers';
      return;
    }
    this.x = numbers[4];
    this.y = numbers[5];
  }

  public hasError(): boolean {
    return this.errorMsg !== '';
  }

  public getErrorMsg(): string {
    return this.errorMsg;
  }

  public getX(): string {
    return this.x;
  }

  public getY(): string {
    return this.y;
  }

  private unexpectedInput(s: string) {
    return `Unexpected transform property ${s}. `;
  }
}

const startWord = 'matrix';
