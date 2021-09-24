import { Node } from './node.model';
import { FlowNodeAttributes } from '../../../shared/models/flow-node-attributes.model';

export default class Exit extends Node {
  constructor(
    id: string,
    name?: string,
    type?: string,
    top?: number,
    left?: number,
    attributes?: FlowNodeAttributes
  ) {
    super(id, name, type, top, left, attributes);
    this.classes = 'shape--round color--danger';
  }
}
