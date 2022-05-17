import { Injectable } from '@angular/core';
import { NodeService } from 'src/app/flow/node/node.service';
import Pipe from '../../flow/node/nodes/pipe.model';
import Receiver from '../../flow/node/nodes/receiver.model';
import Exit from '../../flow/node/nodes/exit.model';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowStructure } from '../models/flow-structure.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';
import Sender from '../../flow/node/nodes/sender.model';
import { FlowNodeNestedElements } from '../models/flow-node-nested-elements.model';
import { Badge } from '../models/badge.model';

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

  generateNodes(flowStructure: FlowStructure, firstPipe?: string): void {
    this.generateReceivers(
      flowStructure.receivers,
      flowStructure.pipes,
      firstPipe
    );
    this.generatePipeline(flowStructure.pipes, flowStructure.nodes);
    this.generateExits(flowStructure.exits, flowStructure.lastPipe);
  }

  generateReceivers(
    receivers: FlowStructureNode[],
    pipes: FlowStructureNode[],
    firstPipe?: string
  ): void {
    for (const receiver of receivers) {
      const positions = receiver.positions;
      const attributes = receiver.attributes;
      const badges: any[] = this.generateBadges(receiver.nestedElements);

      const listenerNode = new Receiver({
        id: receiver.uid,
        name: receiver.name,
        type: receiver.type,
        top: positions.y,
        left: positions.x,
        attributes,
        badges,
      });

      const forwardTarget = pipes.find(
        (targetPipe) => targetPipe.name === firstPipe
      );
      if (forwardTarget) {
        this.forwards.push(new Forward(receiver.uid, forwardTarget.uid));
      }
      this.nodeMap.set(receiver.uid, listenerNode);
    }
  }

  generateBadges(nestedElements: FlowNodeNestedElements): Badge[] {
    const filteredElements = this.getFilteredNestedElements(nestedElements);
    return filteredElements.map(([typeGroup, elements]) =>
      this.getBadgeForType(typeGroup, elements)
    );
  }

  getFilteredNestedElements(nestedElements: FlowNodeNestedElements) {
    const hiddenNestedElements = new Set(['forward']);
    return Object.entries(nestedElements).filter(
      ([typeGroup, _]) => !hiddenNestedElements.has(typeGroup)
    );
  }

  getBadgeForType(typeGroup: string, elements: FlowStructureNode[]): Badge {
    switch (typeGroup) {
      case 'sender':
        return {
          title: this.getBadgeTitle(elements, 'sender'),
          style: 'success',
          icon: 'paper-plane',
        };
      case 'listener':
        return {
          title: this.getBadgeTitle(elements, 'listener'),
          style: 'info',
          icon: 'satellite-dish',
        };
      default:
        return {
          title: this.getBadgeTitle(elements, 'other'),
          style: 'danger',
          icon: 'question',
        };
    }
  }

  getBadgeTitle(value: FlowStructureNode[], type: string): string {
    return value.length > 1 ? `${value.length} ${type}s` : value[0].type;
  }

  generatePipeline(
    pipes: FlowStructureNode[],
    nodes: FlowStructureNode[]
  ): void {
    for (const pipe of pipes) {
      const positions = pipe.positions;
      const attributes = pipe.attributes;
      const badges = this.generateBadges(pipe.nestedElements);
      const nodeOptions = {
        id: pipe.uid,
        name: pipe.name,
        type: pipe.type,
        top: positions.y,
        left: positions.x,
        attributes,
        badges,
      };
      const node =
        pipe.type === 'SenderPipe'
          ? new Sender(nodeOptions)
          : new Pipe(nodeOptions);

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

  generateExits(exits: any[], lastPipe: string | undefined): void {
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
    if (exits.length === 0 && lastPipe) {
      this.addImplicitExit();
    }
  }

  addImplicitExit(): void {
    const implicitExitNode = new Exit({
      id: 'implicitExit',
      name: 'READY',
      type: 'Exit',
      class: 'dotted',
    });
    this.nodeMap.set('implicitExit', implicitExitNode);
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
