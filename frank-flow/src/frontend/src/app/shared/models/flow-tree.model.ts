import { FlowTreeNode } from './flow-tree-node.model';

export class FlowTree {
  listeners: FlowTreeNode[] = [];
  pipes: FlowTreeNode[] = [];
  exits: FlowTreeNode[] = [];

  constructor() {}
}
