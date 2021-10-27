import { FlowNodeAttributes } from './flow-node-attributes.model';

export class FlowStructureNode {
  attributes: FlowNodeAttributes = {};
  line: number;
  endLine: number;
  column: number;
  type: string;
  forwards?: any[];
  name: string;
  positions: { x: number; y: number };

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

  constructor(
    line: number,
    endLine: number,
    column: number,
    type: string,
    attributes: FlowNodeAttributes,
    forwards: any[] | undefined = undefined
  ) {
    this.line = line;
    this.endLine = endLine;
    this.column = column;
    this.type = type;
    this.forwards = forwards;

    this.attributes = attributes ?? [];
    this.name = this.getName();
    this.positions = this.getPositions();
  }
}
