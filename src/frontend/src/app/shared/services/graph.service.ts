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

  public makeGraph(): void {
    this.graph = cytoscape({
      layout: {
        name: 'grid',
        rows: 10,
      },
    });
  }

  public addNodesToGraph(nodeMap: Map<string, Node>): void {
    nodeMap.forEach((node, key) => {
      let x = 0;
      let y = 0;

      if (node.getLeft() && node.getTop()) {
        x = node.getLeft() as number;
        y = node.getTop() as number;
      }

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

  public generateGraphedNodes(nodeMap: Map<string, Node>): void {
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

    graphNodes.forEach((graphNode, index) => {
      const objectNode = graphNode as any;
      const node = nodeMap.get(objectNode.data.id);

      const xMultiplyer = 300;
      const yMultiplyer = 100;

      node?.setLeft(Math.abs(objectNode.position.x) * xMultiplyer);
      node?.setTop(Math.abs(objectNode.position.y) * yMultiplyer);
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

  public connectAllNodes(forwards: Forward[]): void {
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
