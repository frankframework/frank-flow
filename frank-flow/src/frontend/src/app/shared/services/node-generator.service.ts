import { Injectable } from '@angular/core';
import { NodeService } from 'src/app/flow/node/node.service';
import Pipe from '../../flow/node/nodes/pipe.model';
import Listener from '../../flow/node/nodes/listener.model';
import Exit from '../../flow/node/nodes/exit.model';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowStructure } from '../models/flow-structure.model';
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

  generateNodes(firstPipe: string, flowStructure: FlowStructure): void {
    this.generateListeners(
      flowStructure.listeners,
      flowStructure.pipes,
      firstPipe
    );
    this.generatePipeline(flowStructure.pipes, flowStructure.nodes);
    this.generateExits(flowStructure.exits);
  }

  generateListeners(
    listeners: FlowStructureNode[],
    pipes: FlowStructureNode[],
    firstPipe: string
  ): void {
    for (const listener of listeners) {
      const positions = listener.positions;
      const attributes = listener.attributes;
      const listenerNode = new Listener({
        id: listener.uid,
        name: listener.name,
        type: listener.type,
        top: positions.y,
        left: positions.x,
        attributes,
      });

      const forwardTarget = pipes.find(
        (targetPipe) => targetPipe.name === firstPipe
      );
      this.forwards.push(new Forward(listener.uid, forwardTarget?.uid!));
      this.nodeMap.set(listener.uid, listenerNode);
    }
  }

  generatePipeline(
    pipes: FlowStructureNode[],
    nodes: FlowStructureNode[]
  ): void {
    for (const pipe of pipes) {
      const positions = pipe.positions;
      const attributes = pipe.attributes;
      const node = new Pipe({
        id: pipe.uid,
        name: pipe.name,
        type: pipe.type,
        top: positions.y,
        left: positions.x,
        attributes,
      });

      if (pipe.forwards) {
        for (const forward of pipe.forwards) {
          for (const [key, attribute] of Object.entries(forward.attributes) as [
            string,
            FlowNodeAttribute
          ][]) {
            if (key === 'path') {
              const forwardTarget = nodes.find(
                (targetNode) => targetNode.name === attribute.value
              );
              this.forwards.push(new Forward(pipe.uid, forwardTarget?.uid!));
            }
          }
        }
      }

      this.nodeMap.set(pipe.uid, node);
    }
  }

  generateExits(exits: any[]): void {
    for (const exit of exits) {
      const positions = exit.positions;
      const attributes = exit.attributes;
      const node = new Exit({
        id: exit.uid,
        name: exit.name,
        type: exit.type,
        top: positions.y,
        left: positions.x,
        attributes,
      });
      this.nodeMap.set(exit.uid, node);
    }
  }

  generateForwards(): void {
    setTimeout(() => {
      for (const forward of this.forwards) {
        this.nodeService.addConnection({
          uuids: [
            forward.getSource() + '_bottom',
            forward.getDestination() + '_top',
          ],
        });
      }
    });
  }
}
