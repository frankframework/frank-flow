export class CanvasPoint {
  constructor(private x: number, private y: number) {}

  public toString(): string {
    return `CanvasPoint(${this.x}, ${this.y})`;
  }

  public closeTo(other: CanvasPoint): boolean {
    return other.x - this.x <= eps;
  }
}

const eps = 2;
