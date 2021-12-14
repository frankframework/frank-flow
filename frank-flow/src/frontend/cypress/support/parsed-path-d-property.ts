export class ParsedPathDProperty {
  private errorMsg: string = '';
  private beginX: string = '';
  private beginY: string = '';
  private endX: string = '';
  private endY: string = '';

  constructor(s: string) {
    if (!s.startsWith('path')) {
      this.errorMsg = this.unexpectedFormat(s) + 'Should start with "path"';
      return;
    }
    let remainder = s.substr(4);
    if (!(remainder.startsWith('("') && remainder.endsWith('")'))) {
      this.errorMsg = this.unexpectedFormat(s) + 'Should have "("" and "")"';
      return;
    }
    remainder = remainder.substr(2, remainder.length - 4);
    const items = remainder.split(' ');
    const len = items.length;
    if (len != 10) {
      this.errorMsg =
        this.unexpectedFormat(s) + `Expected 10 items but got ${len}`;
      return;
    }
    if (items[0] !== 'M') {
      this.errorMsg =
        this.unexpectedFormat(s) +
        `Expected first component to be "M", but was ${items[0]}`;
      return;
    }
    if (items[3] !== 'C') {
      this.errorMsg =
        this.unexpectedFormat(s) + 'Expected fourth component to be "C"';
      return;
    }
    this.beginX = items[1];
    this.beginY = items[2];
    this.endX = items[8];
    this.endY = items[9];
  }

  public hasError(): boolean {
    return this.errorMsg !== '';
  }

  public getErrorMsg(): string {
    return this.errorMsg;
  }

  public getBeginX(): string {
    return this.beginX;
  }

  public getBeginY(): string {
    return this.beginY;
  }

  public getEndX(): string {
    return this.endX;
  }

  public getEndY(): string {
    return this.endY;
  }

  private unexpectedFormat(s: string): string {
    return `Unexpected format of string "${s}". `;
  }
}
