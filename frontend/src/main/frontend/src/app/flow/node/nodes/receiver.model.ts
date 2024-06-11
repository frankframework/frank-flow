import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { Node } from './node.model';

export default class Receiver extends Node {
  constructor(options: {
    id: string;
    name: string;
    type: string;
    top?: number;
    left?: number;
    attributes?: FlowNodeAttributes;
    badges?: any[];
  }) {
    super(options);
    this.classes = 'color--info';
  }
}
