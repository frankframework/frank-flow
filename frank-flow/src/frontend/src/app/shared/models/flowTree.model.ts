import { FlowTreeNode } from './flowTreeNode.model';

export class FlowTree {
  listeners: FlowTreeNode[] = [];
  pipes: FlowTreeNode[] = [];
  exits: FlowTreeNode[] = [];

  constructor() {}
}
