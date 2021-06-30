import { FlowNodeAttributes } from './flowNodeAttributes.model';
import { FlowNodeAttribute } from './flowNodeAttribute.model';

export class FlowStructureNode {
  attributes: {
    [p: string]: {
      value: string;
      endColumn: number;
      line: number;
      startColumn: number;
    };
  } = {};
  line: number;
  column: number;
  type: string;
  forwards?: any[];

  get name(): string {
    return this.attributes['name'] ? this.attributes['name'].value : 'test';
  }

  get positions(): [number, number] {
    let x = 0;
    let y = 0;

    if (this.attributes['x']) {
      x = +this.attributes['x'].value;
    }
    if (this.attributes['y']) {
      y = +this.attributes['y'].value;
    }

    return [x, y];
  }

  constructor(
    line: number,
    column: number,
    type: string,
    attributes: FlowNodeAttributes = {}
  ) {
    this.line = line;
    this.column = column;
    this.type = type;
    this.attributes = attributes;
  }
}
