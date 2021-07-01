export class ExpectedConnection {
  constructor(private from: string, private to: string) {}

  getFrom() {
    return this.from;
  }

  getTo() {
    return this.to;
  }

  toString(): string {
    return `ExpectedConnection(from: ${this.from}, to: ${this.to})`;
  }
}
