import { FlowStructureNode } from './flow-structure-node.model';

export class FlowStructure {
  nodes: FlowStructureNode[];
  listeners: FlowStructureNode[];
  pipes: FlowStructureNode[];
  exits: FlowStructureNode[];
  receivers: FlowStructureNode[];
  senders: FlowStructureNode[];
  pipeline!: FlowStructureNode;
  implicitFirstPipe!: boolean;
  firstPipe?: string;
  configuration?: FlowStructureNode;

  constructor(nodes: FlowStructureNode[] = [], firstPipe?: string) {
    this.nodes = nodes;

    this.firstPipe = this.getFirstPipe(firstPipe);
    this.listeners = this.getListeners();
    this.pipes = this.getPipes();
    this.exits = this.getExits();
    this.receivers = this.getReceivers();
    this.senders = this.getSenders();
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
        node.type.match(/Exit$/)
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

  getSenders(): FlowStructureNode[] {
    return (
      this.nodes.filter((node: FlowStructureNode) =>
        node.type.match(/Senders/g)
      ) ?? []
    );
  }
}
