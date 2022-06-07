import { FlowStructureNode } from '../../models/flow-structure-node.model';

export interface CreateForwardModalData {
  node: FlowStructureNode;
  targetId: string;
  actionFunction: (
    sourceNode: FlowStructureNode,
    targetId: string,
    forwardName: string
  ) => void;
}
