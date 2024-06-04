export class ExpectedCanvasNode {
  id: string;
  x: number;
  y: number;

  constructor(csvLine: string) {
    const fields: Array<string> = csvLine.split(',');
    if (fields.length < 3) {
      throw new Error(
        `Cannot create ExpectedCanvasElement because line has less than three fields: ${csvLine}`
      );
    }
    this.id = fields[0];
    this.x = +fields[1];
    this.y = +fields[2];
    if (!Number.isInteger(this.x)) {
      throw new Error(
        `ExpectedCanvasElement ${this.id} has invalid x-coordinate ${fields[1]}`
      );
    }
    if (!Number.isInteger(this.y)) {
      throw new Error(
        `ExpectedCanvasElement ${this.id} has invalid y-coordinate ${fields[2]}`
      );
    }
  }

  public toString(): string {
    return `ExpectedCanvasElement ${this.id} at (${this.x}, ${this.y})`;
  }
}
