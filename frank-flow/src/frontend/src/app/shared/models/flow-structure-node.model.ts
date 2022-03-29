import { FlowNodeAttributes } from './flow-node-attributes.model';
import { FlowNodeNestedElements } from './flow-node-nested-elements.model';

export class FlowStructureNode {
  public uid: string;
  public attributes: FlowNodeAttributes = {};
  public line: number;
  public endLine: number;
  public startColumn;
  public column: number;
  public type: string;
  public forwards?: any[];
  public name: string;
  public positions: { x: number; y: number };
  public parent?: FlowStructureNode;
  public nestedElements: FlowNodeNestedElements = {};
  public senders: FlowStructureNode[];
  public path: string;
  public isSelfClosing: boolean;
  public active: boolean;

  constructor(
    line: number,
    endLine: number,
    startColumn: number,
    column: number,
    type: string,
    path: string,
    attributes: FlowNodeAttributes,
    isSelfClosing: boolean,
    forwards?: any[]
  ) {
    this.line = line;
    this.endLine = endLine;
    this.startColumn = startColumn;
    this.column = column;
    this.type = type;
    this.isSelfClosing = isSelfClosing;
    this.forwards = forwards;
    this.attributes = attributes ?? [];
    this.path = path;

    this.name = this.getName();
    this.active = this.getActive();
    this.uid = this.getUid();
    this.positions = this.getPositions();
    this.senders = [];
  }

  private getName(): string {
    if (this.attributes['name']) {
      return this.attributes['name'].value;
    } else if (this.attributes['path']) {
      return this.attributes['path'].value;
    }
    return this.type;
  }

  private getActive(): boolean {
    const activeIsFalse = this.attributes['active']?.value === 'false';
    const activeIsEmpty = this.attributes['active']?.value === '';

    return !(activeIsFalse || activeIsEmpty);
  }

  private getUid(): string {
    return `${this.type}(${!this.active ? `#${this.name}#` : this.name})${
      this.path ? `@${this.path}` : ''
    }`;
  }

  private getPositions(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.attributes['flow:x']) {
      x = +this.attributes['flow:x'].value;
    }
    if (this.attributes['flow:y']) {
      y = +this.attributes['flow:y'].value;
    }

    return { x, y };
  }
}
