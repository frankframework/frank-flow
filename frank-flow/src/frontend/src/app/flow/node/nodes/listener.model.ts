import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { Node } from './node.model';

export default class Listener extends Node {
  constructor(options: {
    id: string;
    name: string;
    type: string;
    top?: number;
    left?: number;
    attributes?: FlowNodeAttributes;
  }) {
    super(options);
    this.classes = 'shape--oval color--info';
  }
}
