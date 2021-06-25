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

  toString(): string {
    return `CanvasConnectionArea(${this.left}, ${this.top}, ${this.width}, ${this.height})`;
  }
}
