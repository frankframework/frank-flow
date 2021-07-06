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

  public getX(): number {
    return this.x;
  }

  public getY(): number {
    return this.y;
  }
}

const eps = 2;
