import { FlowTreeNode } from './flowTreeNode.model';

export class FlowTree {
  listeners: FlowTreeNode[] = [];
  pipes: any = {};
  exits: FlowTreeNode[] = [];

  constructor() {}
}
