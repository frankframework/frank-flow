import { FlowStructureNode } from './flow-structure-node.model';

export class FlowStructure {
  nodes: FlowStructureNode[];
  firstPipe?: string;
  listeners: FlowStructureNode[];
  pipes: FlowStructureNode[];
  exits: FlowStructureNode[];
  pipeline!: FlowStructureNode;
  receivers: FlowStructureNode[];
  implicitFirstPipe!: boolean;

  constructor(nodes: FlowStructureNode[] = [], firstPipe?: string) {
    this.nodes = nodes;

    this.firstPipe = this.getFirstPipe(firstPipe);
    this.listeners = this.getListeners();
    this.pipes = this.getPipes();
    this.exits = this.getExits();
    this.receivers = this.getReceivers();
  }

  getFirstPipe(firstPipe?: string): string | undefined {
    if (firstPipe) {
      return firstPipe;
    }
    const implicitFirstPipe = this.nodes?.find((node) =>
      node.type.endsWith('Pipe')
    )?.name;
    this.implicitFirstPipe = !!implicitFirstPipe;
    return implicitFirstPipe;
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
