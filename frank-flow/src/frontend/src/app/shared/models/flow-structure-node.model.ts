import { FlowNodeAttributes } from './flow-node-attributes.model';

export class FlowStructureNode {
  public uid: string;
  public attributes: FlowNodeAttributes = {};
  public line: number;
  public endLine: number;
  public column: number;
  public type: string;
  public forwards?: any[];
  public name: string;
  public positions: { x: number; y: number };
  public parent?: FlowStructureNode;

  constructor(
    line: number,
    endLine: number,
    column: number,
    type: string,
    attributes: FlowNodeAttributes,
    forwards?: any[]
  ) {
    this.line = line;
    this.endLine = endLine;
    this.column = column;
    this.type = type;
    this.forwards = forwards;

    this.attributes = attributes ?? [];
    this.name = this.getName();
    this.uid = this.name + this.type;
    this.positions = this.getPositions();
  }

  private getName(): string {
    if (this.attributes['name']) {
      return this.attributes['name'].value;
    } else if (this.attributes['path']) {
      return this.attributes['path'].value;
    }
    return this.type;
  }

  private getPositions(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.attributes['x']) {
      x = +this.attributes['x'].value;
    }
    if (this.attributes['y']) {
      y = +this.attributes['y'].value;
    }

    return { x, y };
  }
}
