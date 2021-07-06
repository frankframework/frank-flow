import { CanvasNode } from './canvas-node';

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

  public atNode(node: CanvasNode): boolean {
    const minX = node.getLeft() - eps;
    const maxX = node.getRight() + eps;
    const minY = node.getTop() - eps;
    const maxY = node.getBottom() + eps;
    const xOK = this.x >= minX && this.x <= maxX;
    const yOK = this.y >= minY && this.y <= maxY;
    return xOK && yOK;
  }

  public getX(): number {
    return this.x;
  }

  public getY(): number {
    return this.y;
  }
}

const eps = 2;
