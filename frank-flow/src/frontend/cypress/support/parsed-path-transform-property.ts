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
    let remainder = s.substr(startWord.length);
    if (!remainder.startsWith('(') && remainder.endsWith(')')) {
      this.errorMsg = this.unexpectedInput(s) + 'Should have "(" and ")"';
      return;
    }
    remainder = remainder.substr(1, remainder.length - 2);
    const numbers = remainder.split(',');
    if (numbers.length !== 6) {
      this.errorMsg = this.unexpectedInput(s) + 'Should have six numbers';
      return;
    }
    this.x = numbers[4];
    this.y = numbers[5];
  }

  private unexpectedInput(s: string) {
    return `Unexpected transform property ${s}. `;
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
}

const startWord = 'matrix';
