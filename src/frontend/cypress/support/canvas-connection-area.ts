import { CanvasPoint } from './cancas-point';

export class CanvasConnectionArea {
  constructor(
    private left: number,
    private top: number,
    private width: number,
    private height: number
  ) {}

  getLeft(): number {
    return this.left;
  }

  getTop(): number {
    return this.top;
  }

  getCenter(): CanvasPoint {
    const centerX = (2.0 * this.left + this.width) / 2.0;
    const centerY = (2.0 * this.top + this.height) / 2.0;
    return new CanvasPoint(centerX, centerY);
  }

  toString(): string {
    return `CanvasConnectionArea(${this.left}, ${this.top}, ${this.width}, ${this.height})`;
  }
}
