import { Injectable } from '@angular/core';
import { NodeService } from '../../flow/node/node.service';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';
import * as cytoscape from 'cytoscape';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  private graph: cytoscape.Core;
  private nodesSubject = new Subject<Map<string, Node>>();
  public nodesObservable = this.nodesSubject.asObservable();

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
    try {
      this.connectAllNodes(forwards);
    } catch {
      console.error(`Can't connect nodes, check if connection exists`);
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
    for (const node of nodeMap.values()) {
      const x = (node.getLeft() as number) ?? 0;
      const y = (node.getTop() as number) ?? 0;

      this.graph.add({
        group: 'nodes',
        data: { id: node.getId(), weight: 70 },
        position: { x, y },
        style: {
          height: 200,
          width: 200,
        },
      });
    }
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

    for (const graphNode of graphNodes as any[]) {
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
        this.nodeService.addDynamicNode(node);
      }
    }
    this.nodesSubject.next(nodeMap);
  }

  connectAllNodes(forwards: Forward[]): void {
    for (const [index, forward] of forwards.entries()) {
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
    }
  }
}
