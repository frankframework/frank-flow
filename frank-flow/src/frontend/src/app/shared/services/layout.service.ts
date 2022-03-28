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
  private readonly LEFT_MARGIN = 100;
  private readonly TOP_MARGIN = 100;
  private readonly NODE_HEIGHT = 100;

  constructor(private nodeService: NodeService) {}

  createLayout(nodeMap: Map<string, Node>): void {
    let nodeCounter = 0;

    for (const node of nodeMap.values()) {
      if (node?.getTop() === 0 && node.getLeft() === 0) {
        node?.setLeft(this.LEFT_MARGIN);
        node?.setTop(
          this.NODE_HEIGHT * nodeCounter + this.TOP_MARGIN * ++nodeCounter
        );
      }
      if (node) {
        this.nodeService.addDynamicNode(node);
      }
    }
    this.nodesSubject.next(nodeMap);
  }
}
