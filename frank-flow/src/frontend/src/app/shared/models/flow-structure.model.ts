import { FlowStructureNode } from './flow-structure-node.model';

export class FlowStructure {
  nodes: FlowStructureNode[];
  firstPipe: string;
  listeners: FlowStructureNode[];
  pipes: FlowStructureNode[];
  exits: FlowStructureNode[];
  pipeline!: FlowStructureNode;
  receivers: FlowStructureNode[];

  constructor(nodes: FlowStructureNode[] = [], firstPipe = '') {
    this.nodes = nodes;
    this.firstPipe = firstPipe;

    this.listeners = this.getListeners();
    this.pipes = this.getPipes();
    this.exits = this.getExits();
    this.receivers = this.getReceivers();
  }

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

  getReceivers(): FlowStructureNode[] {
    return (
      this.nodes.filter(
        (node: FlowStructureNode) => node.type === 'Receiver'
      ) ?? []
    );
  }
}
