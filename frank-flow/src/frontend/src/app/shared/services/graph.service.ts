import { Injectable } from '@angular/core';
import { NodeService } from '../../flow/node/node.service';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import * as cytoscape from 'cytoscape';
import { FlowStructureService } from './flow-structure.service';

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  private graph: cytoscape.Core;

  offsetY: number = 0;
  offsetX: number = 0;

  expanding: boolean = false;

  set offY(value: number) {
    this.offsetY = value;
  }

  get offY(): number {
    return this.offsetY;
  }

  set offX(value: number) {
    this.offsetX = value;
  }

  get offX(): number {
    return this.offsetX;
  }

  constructor(
    private nodeService: NodeService,
    private flowStructureService: FlowStructureService
  ) {
    this.graph = cytoscape({
      layout: {
        name: 'grid',
        rows: 10,
      },
    });
  }

  makeGraph(nodeMap: Map<string, Node>, forwards: Forward[]): void {
    this.initializeGraph();
    this.addNodesToGraph(nodeMap);
    try {
      this.connectAllNodes(forwards);
    } catch (e) {
      console.log('cant connect nodes, check if connection exists');
    }
    this.generateGraphedNodes(nodeMap);
  }

  initializeGraph(): void {
    this.graph = cytoscape({
      layout: {
        name: 'grid',
        rows: 10,
      },
    });
  }

  addNodesToGraph(nodeMap: Map<string, Node>): void {
    nodeMap.forEach((node, key) => {
      const x = (node.getLeft() as number) ?? 0;
      const y = (node.getTop() as number) ?? 0;

      this.graph.add({
        group: 'nodes',
        data: { id: node.getName(), weight: 70 },
        position: { x, y },
        style: {
          height: 200,
          width: 200,
        },
      });
    });
  }

  generateGraphedNodes(nodeMap: Map<string, Node>): void {
    this.graph
      .layout({
        name: 'breadthfirst',
        directed: true,
        fit: true,
        avoidOverlap: true,
        spacingFactor: 5,
      })
      .run();

    const graphNodes = this.graph.nodes().jsons();
    let listenerTopMargin = 100;
    let exitLeftMargin = 800;
    let exitTopPosition = 0;

    graphNodes.forEach((graphNode: any, index: any) => {
      const node = nodeMap.get(graphNode.data.id);

      const xMultiplier = 300;
      const yMultiplier = 100;

      if (node?.getTop() === 0 && node.getLeft() === 0) {
        if (node.getType()?.match(/Listener/g)) {
          const left = 100;

          node?.setLeft(left);
          node?.setTop(listenerTopMargin);

          listenerTopMargin += 100;
        } else if (node.getType()?.match(/Exit/g)) {
          node?.setLeft(exitLeftMargin);
          node?.setTop(exitTopPosition + 200);

          exitLeftMargin += 100;
        } else {
          const nodeLeftPosition = Math.abs(graphNode.position.x) * xMultiplier;
          const nodeTopPosition = Math.abs(graphNode.position.y) * yMultiplier;

          if (nodeTopPosition > exitTopPosition) {
            exitTopPosition = nodeTopPosition;
          }

          node?.setLeft(nodeLeftPosition);
          node?.setTop(nodeTopPosition);
        }
      }
      if (node) {
        const top = node.getTop();
        const left = node.getLeft();

        if (top && left && this.expanding) {
          node.setTop(top + this.offsetY);
          node.setLeft(left + this.offsetX);
        }

        this.nodeService.addDynamicNode(node);
      }
    });
  }

  connectAllNodes(forwards: Forward[]): void {
    forwards.forEach((forward, index) => {
      const source = forward.getSource();
      const target = forward.getDestination();

      if (source && target) {
        this.graph.add({
          group: 'edges',
          data: {
            id: '' + index,
            source,
            target,
          },
        });
      }
    });
  }
}
