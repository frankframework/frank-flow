import { Injectable } from '@angular/core';
import { NodeService } from 'src/app/flow/node/node.service';
import Pipe from '../../flow/node/nodes/pipe.model';
import Listener from '../../flow/node/nodes/listener.model';
import Exit from '../../flow/node/nodes/exit.model';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import { FlowStructureNode } from '../models/flowStructureNode.model';
import { FlowNodeAttribute } from '../models/flowNodeAttribute.model';

@Injectable({
  providedIn: 'root',
})
export class NodeGeneratorService {
  nodeMap: Map<string, Node> = new Map<string, Node>();
  forwards: Forward[] = [];

  constructor(private nodeService: NodeService) {}

  generateNodes(
    firstPipe: string,
    listeners: FlowStructureNode[],
    pipes: FlowStructureNode[],
    exits: FlowStructureNode[]
  ): void {
    this.generateListeners(listeners, firstPipe);
    this.generatePipeline(pipes);
    this.generateExits(exits);
  }

  generateListeners(listeners: FlowStructureNode[], firstPipe: string): void {
    listeners.forEach((listener) => {
      const [x, y] = listener.positions;
      const listenerNode = new Listener(
        listener.name,
        listener.name,
        listener.type,
        y,
        x
      );

      this.forwards.push(new Forward(listener.name, firstPipe));
      this.nodeMap.set(listener.name, listenerNode);
    });
  }

  generatePipeline(pipes: FlowStructureNode[]): void {
    pipes.forEach((pipe: FlowStructureNode) => {
      const [x, y] = pipe.positions;
      const node = new Pipe(pipe.name, pipe.name, pipe.type, y, x);

      if (pipe.forwards) {
        pipe.forwards.forEach((forward: FlowStructureNode) => {
          Object.entries(forward.attributes).forEach(
            ([key, attribute]: [string, FlowNodeAttribute]) => {
              if (key === 'path') {
                this.forwards.push(new Forward(pipe.name, attribute.value));
              }
            }
          );
        });
      }

      this.nodeMap.set(pipe.name, node);
    });
  }

  generateExits(exits: any[]): void {
    exits.forEach((exit) => {
      const [x, y] = exit.positions;
      const node = new Exit(exit.name, exit.name, exit.type, y, x);
      this.nodeMap.set(exit.name, node);
    });
  }

  generateForwards(): void {
    setTimeout(() =>
      this.forwards.forEach((forward) =>
        this.nodeService.addConnection({
          uuids: [
            forward.getSource() + '_bottom',
            forward.getDestination() + '_top',
          ],
        })
      )
    );
  }
}
