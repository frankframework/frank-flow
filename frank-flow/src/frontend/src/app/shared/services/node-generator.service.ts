import { Injectable } from '@angular/core';
import { NodeService } from 'src/app/flow/node/node.service';
import Pipe from '../../flow/node/nodes/pipe.model';
import Listener from '../../flow/node/nodes/listener.model';
import Exit from '../../flow/node/nodes/exit.model';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';

@Injectable({
  providedIn: 'root',
})
export class NodeGeneratorService {
  nodeMap: Map<string, Node> = new Map<string, Node>();
  forwards: Forward[] = [];

  constructor(private nodeService: NodeService) {}

  resetNodes(): void {
    this.nodeMap = new Map<string, Node>();
    this.forwards = [];
  }

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
      const positions = listener.positions;
      const attributes = listener.attributes;
      const listenerNode = new Listener({
        id: listener.name,
        name: listener.name,
        type: listener.type,
        top: positions.y,
        left: positions.x,
        attributes,
      });

      this.forwards.push(new Forward(listener.name, firstPipe));
      this.nodeMap.set(listener.name, listenerNode);
    });
  }

  generatePipeline(pipes: FlowStructureNode[]): void {
    pipes.forEach((pipe: FlowStructureNode) => {
      const positions = pipe.positions;
      const attributes = pipe.attributes;
      const node = new Pipe({
        id: pipe.name,
        name: pipe.name,
        type: pipe.type,
        top: positions.y,
        left: positions.x,
        attributes,
      });

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
      const positions = exit.positions;
      const attributes = exit.attributes;
      const node = new Exit({
        id: exit.name,
        name: exit.name,
        type: exit.type,
        top: positions.y,
        left: positions.x,
        attributes,
      });
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
