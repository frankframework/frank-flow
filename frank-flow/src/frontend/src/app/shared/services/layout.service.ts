import { Injectable } from '@angular/core';
import { NodeService } from '../../flow/node/node.service';
import { Node } from '../../flow/node/nodes/node.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private nodesSubject = new BehaviorSubject<Map<string, Node>>(new Map());
  public nodesObservable = this.nodesSubject.asObservable();
  private readonly LEFT_MARGIN = 100;
  private readonly TOP_MARGIN = 100;
  private readonly NODE_HEIGHT = 100;
  private readonly NODE_WIDTH = 200;
  private readonly rows = new Map<string, number>();

  constructor(private nodeService: NodeService) {}

  createLayout(nodeMap: Map<string, Node>): void {
    this.rows.clear();
    this.addNodesToCanvas(nodeMap);
    this.nodesSubject.next(nodeMap);
  }

  addNodesToCanvas(nodeMap: Map<string, Node>): void {
    for (const node of nodeMap.values()) {
      this.handlePositions(node);
      this.nodeService.addDynamicNode(node);
    }
  }

  handlePositions(node: Node): void {
    const [row, column] = this.getRowAndColumn(node.getType());
    if (this.nodeNeedsPositions(node)) {
      const cachedLocations = this.getCachedLocations(node);
      const [left, top] =
        cachedLocations ?? this.calculatePositions(row, column);
      node.setLeft(left);
      node.setTop(top);
    }
  }

  private getRowAndColumn(type: string) {
    let row: number;
    let column: number;

    if (/Receiver/g.test(type)) {
      row = this.getNextRow('receiver');
      column = 1;
    } else if (type === 'Exit' || type === 'Exits') {
      row = this.getNextRow('exit');
      column = 3;
    } else {
      row = this.getNextRow('pipe');
      column = 2;
    }
    return [row, column];
  }

  nodeNeedsPositions(node: Node): boolean {
    return !node.getLeft() && !node.getTop();
  }

  getNextRow(type: string) {
    const row = (this.rows.get(type) ?? 0) + 1;
    this.rows.set(type, row);
    return row;
  }

  getCachedLocations(node: Node): [number, number] | undefined {
    const x = this.nodesSubject.value.get(node.getId())?.getLeft();
    const y = this.nodesSubject.value.get(node.getId())?.getTop();

    return x && y ? [x, y] : undefined;
  }

  calculatePositions(row: number, column: number) {
    const left = this.NODE_WIDTH * (column - 1) + this.LEFT_MARGIN * column;
    const top = this.NODE_HEIGHT * (row - 1) + this.TOP_MARGIN * row;
    return [left, top];
  }
}
