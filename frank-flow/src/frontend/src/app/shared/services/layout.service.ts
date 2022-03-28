import { Injectable } from '@angular/core';
import { NodeService } from '../../flow/node/node.service';
import { Node } from '../../flow/node/nodes/node.model';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private nodesSubject = new Subject<Map<string, Node>>();
  public nodesObservable = this.nodesSubject.asObservable();
  private readonly LEFT_MARGIN = 150;
  private readonly TOP_MARGIN = 100;
  private readonly NODE_HEIGHT = 100;
  private readonly NODE_WIDTH = 200;
  private readonly rows = new Map<string, number>();

  constructor(private nodeService: NodeService) {}

  createLayout(nodeMap: Map<string, Node>): void {
    this.rows.clear();
    for (const node of nodeMap.values()) {
      if (node?.getTop() === 0 && node.getLeft() === 0) {
        const [row, column] = this.getRowAndColumn(node.getType());
        node?.setLeft(
          this.NODE_WIDTH * (column - 1) + this.LEFT_MARGIN * column
        );
        node?.setTop(this.NODE_HEIGHT * (row - 1) + this.TOP_MARGIN * row);
      }
      if (node) {
        this.nodeService.addDynamicNode(node);
      }
    }
    this.nodesSubject.next(nodeMap);
  }

  private getRowAndColumn(type: string) {
    let row,
      column = 0;

    if (/Listener/g.test(type)) {
      row = this.getAndAddRow('listener');
      column = 1;
    } else if (type === 'Exit' || type === 'Exits') {
      row = this.getAndAddRow('exit');
      column = 4;
    } else if (/Sender/g.test(type)) {
      row = this.getAndAddRow('sender');
      column = 3;
    } else {
      row = this.getAndAddRow('pipe');
      column = 2;
    }
    return [row, column];
  }

  getAndAddRow(type: string) {
    const row = (this.rows.get(type) ?? 0) + 1;
    this.rows.set(type, row);
    return row;
  }
}
