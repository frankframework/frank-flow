import { CanvasPoint } from './canvas-point';

export class CanvasConnection {
  private connectionStartX: number;
  private connectionStartY: number;
  private connectionEndX: number;
  private connectionEndY: number;

  constructor(
    private left: number,
    private top: number,
    private beginX: number,
    private beginY: number,
    private endX: number,
    private endY: number,
    private transformX: number,
    private transformY: number
  ) {
    this.connectionStartX = left + beginX + transformX;
    this.connectionStartY = top + beginY + transformY;
    this.connectionEndX = left + endX + transformX;
    this.connectionEndY = top + endY + transformY;
  }

  public getBeginPoint(): CanvasPoint {
    return new CanvasPoint(this.connectionStartX, this.connectionStartY);
  }

  public getEndPoint(): CanvasPoint {
    return new CanvasPoint(this.connectionEndX, this.connectionEndY);
  }

  public toString(): string {
    return this.getInputs() + this.getConnection();
  }

  private getInputs(): string {
    return (
      `CanvasConnection(offset = (${this.left}, ${this.top}), ` +
      `begin = (${this.beginX}, ${this.beginY}), end = (${this.endX}, ${this.endY}))` +
      `transform = (${this.transformX}, ${this.transformY}) `
    );
  }

  private getConnection(): string {
    return (
      `Connects (${this.connectionStartX}, ${this.connectionStartY}) to ` +
      `(${this.connectionEndX}, ${this.connectionEndY})`
    );
  }
}
