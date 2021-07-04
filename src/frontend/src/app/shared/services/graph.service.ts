import { Injectable } from '@angular/core';
import { NodeService } from '../../flow/node/node.service';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import * as cytoscape from 'cytoscape';

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  private graph: cytoscape.Core;

  constructor(private nodeService: NodeService) {
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
    this.connectAllNodes(forwards);
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

    graphNodes.forEach((graphNode: any, index: any) => {
      const node = nodeMap.get(graphNode.data.id);

      const xMultiplier = 300;
      const yMultiplier = 100;

      node?.setLeft(Math.abs(graphNode.position.x) * xMultiplier);
      node?.setTop(Math.abs(graphNode.position.y) * yMultiplier);
    });

    let listenerMargin = 100;
    let exitMargin = 800;

    nodeMap.forEach((node, index) => {
      if (node.getType()?.match(/Listener/g)) {
        node?.setLeft(100);
        node?.setTop(listenerMargin);
        listenerMargin += 100;
      } else if (node.getType()?.match(/Exit/g)) {
        node?.setLeft(exitMargin);
        exitMargin += 100;
      }
      this.nodeService.addDynamicNode(node);
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
