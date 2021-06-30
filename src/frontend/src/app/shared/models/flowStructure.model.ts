import { FlowStructureNode } from './flowStructureNode.model';

export class FlowStructure {
  nodes: FlowStructureNode[];
  firstPipe: string;
  get listeners(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Listener/g)
      ) ?? []
    );
  }
  get pipes(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Pipe/g)
      ) ?? []
    );
  }
  get exits(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Exit/g)
      ) ?? []
    );
  }

  constructor(nodes: FlowStructureNode[] = [], firstPipe: string = '') {
    this.nodes = nodes;
    this.firstPipe = firstPipe;
  }
}
