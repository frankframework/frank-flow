import { FlowStructureNode } from './flowStructureNode.model';

export class FlowStructure {
  nodes: FlowStructureNode[];
  firstPipe: string;
  listeners: FlowStructureNode[];
  pipes: FlowStructureNode[];
  exits: FlowStructureNode[];

  getListeners(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Listener/g)
      ) ?? []
    );
  }

  getPipes(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Pipe/g)
      ) ?? []
    );
  }

  getExits(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Exit/g)
      ) ?? []
    );
  }

  constructor(nodes: FlowStructureNode[] = [], firstPipe: string = '') {
    this.nodes = nodes;
    this.firstPipe = firstPipe;

    this.listeners = this.getListeners();
    this.pipes = this.getPipes();
    this.exits = this.getExits();
  }
}
