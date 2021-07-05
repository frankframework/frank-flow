import { FlowNodeAttributes } from 'src/app/shared/models/flowNodeAttributes.model';
import { Node } from './node.model';

export default class Listener extends Node {
  constructor(
    id: string,
    name?: string,
    type?: string,
    top?: number,
    left?: number,
    attributes?: FlowNodeAttributes
  ) {
    super(id, name, type, top, left, attributes);
    this.classes = 'shape--oval color--info';
  }
}
