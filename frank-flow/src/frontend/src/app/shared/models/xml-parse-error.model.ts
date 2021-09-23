export class XmlParseError {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  message: string;

  constructor(startLine: number, startColumn: number, message: string) {
    this.startLine = startLine;
    this.startColumn = startColumn;
    this.endLine = startLine;
    this.endColumn = startColumn;
    this.message = message;
  }

  getTemplateString(): string {
    return this.getRangeMessage() + ': ' + this.message;
  }

  getRangeMessage(): string {
    let message = `On line ${this.startLine} column ${this.startColumn}`;
    if (!this.isOneLiner()) {
      message += ` to line ${this.endLine}`;
    } else {
      if (!this.isSameColumn()) {
        message += ` to `;
      }
    }
    if (!this.isSameColumn()) {
      message += ` column ${this.endColumn}`;
    }
    return message;
  }

  isOneLiner(): boolean {
    return this.startLine === this.endLine;
  }

  isSameColumn(): boolean {
    return this.startColumn === this.endColumn;
  }
}
