export class CanvasPoint {
  constructor(private x: number, private y: number) {}

  public toString(): string {
    return `CanvasPoint(${this.x}, ${this.y})`;
  }

  public closeTo(other: CanvasPoint): boolean {
    const xClose = Math.abs(other.x - this.x) <= eps;
    const yClose = Math.abs(other.y - this.y) <= eps;
    return xClose && yClose;
  }
}

const eps = 2;
