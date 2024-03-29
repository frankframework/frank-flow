import { CanvasPoint } from './canvas-point';

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
    const centerX = (2 * this.left + this.width) / 2;
    const centerY = (2 * this.top + this.height) / 2;
    cy.log(`CanvasPoint.getCenter() with (${centerX}, ${centerY})`);
    return new CanvasPoint(centerX, centerY);
  }

  toString(): string {
    return `CanvasConnectionArea(${this.left}, ${this.top}, ${this.width}, ${this.height})`;
  }
}
