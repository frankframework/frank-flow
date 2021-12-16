export class ExpectedConnection {
  constructor(private from: string, private to: string) {}

  getFrom() {
    return this.from.trim();
  }

  getTo() {
    return this.to.trim();
  }

  toString(): string {
    return `ExpectedConnection(from: ${this.from}, to: ${this.to})`;
  }
}
