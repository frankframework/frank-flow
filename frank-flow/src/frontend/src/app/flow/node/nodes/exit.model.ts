import { Node } from './node.model';
import { FlowNodeAttributes } from '../../../shared/models/flow-node-attributes.model';

export default class Exit extends Node {
  constructor(options: {
    id: string;
    name: string;
    type: string;
    top?: number;
    left?: number;
    attributes?: FlowNodeAttributes;
    class?: string;
  }) {
    super(options);
    this.classes = 'shape--round color--danger ' + options.class ?? '';
  }
}
