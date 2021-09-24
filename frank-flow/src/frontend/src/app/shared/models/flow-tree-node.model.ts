export class FlowTreeNode {
  line: number;
  column: number;
  type: string;
  attributes: any[];

  name?: string;
  forwards?: any[];
  path?: string;

  constructor(line: number, column: number, type: string, attributes: any[]) {
    this.line = line;
    this.column = column;
    this.type = type;
    this.attributes = attributes;
  }
}
