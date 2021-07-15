import { CanvasNode } from './canvas-node';

export class CanvasPoint {
  constructor(private x: number, private y: number) {
    if (Number.isNaN(x)) {
      throw new Error('CanvasPoint constructor called with NaN x-coordinate');
    }
    if (Number.isNaN(y)) {
      throw new Error('CanvasPoint constructor called with NaN y-coordinate');
    }
    if (x === 0 && y === 0) {
      throw new Error(
        'CanvasPoint constructor called with unexpected point (0, 0)'
      );
    }
  }

  public toString(): string {
    return 'CanvasPoint(' + +this.x + ', ' + +this.y + ')';
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
