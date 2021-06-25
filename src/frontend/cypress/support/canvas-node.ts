export class CanvasNode {
  constructor(
    private id: string,
    private left: number,
    private top: number,
    private width: number,
    private height: number
  ) {}

  getId(): string {
    return this.id;
  }

  getLeft(): number {
    return this.left;
  }

  getTop(): number {
    return this.top;
  }

  toString(): string {
    return `CanvasElement(${this.left}, ${this.top}, ${this.width}, ${this.height})`;
  }
}
