import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { Node } from './node.model';
import { FlowStructureNode } from '../../../shared/models/flow-structure-node.model';

export default class Sender extends Node {
  constructor(options: {
    id: string;
    name: string;
    type: string;
    top?: number;
    left?: number;
    attributes?: FlowNodeAttributes;
    senders?: FlowStructureNode[];
  }) {
    super(options);
    this.classes = 'color--success';
  }
}
