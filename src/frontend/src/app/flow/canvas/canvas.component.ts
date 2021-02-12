import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { NodeService } from '../node/node.service';
import { Node } from '../node/node';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements AfterViewInit {
  @Input() nodes = [];

  @Input() connections = [];

  @ViewChild('nodes', { read: ViewContainerRef })
  viewContainerRef!: ViewContainerRef;

  constructor(private nodeService: NodeService) {}

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);

    this.nodes.forEach((node) => {
      this.nodeService.addDynamicNode(node);
    });

    setTimeout(() => {
      this.connections.forEach((connection) => {
        this.nodeService.addConnection(connection);
      });
    });
  }

  addNode(): void {
    const node = { id: 'Step id_' + [Math.random().toString(16).slice(2, 8)] };

    this.nodeService.addDynamicNode(node);
  }

  saveNodeJson(): void {
    // Save element position on Canvas and node connections

    const container = this.viewContainerRef.element.nativeElement.parentNode;
    const nodes = Array.from(
      container.querySelectorAll('.node') as HTMLDivElement[]
    ).map((node: HTMLDivElement) => {
      return {
        id: node.id,
        top: node.offsetTop,
        left: node.offsetLeft,
      };
    });

    const connections = (this.nodeService.jsPlumbInstance.getAllConnections() as any[]).map(
      (conn) => ({ uuids: conn.getUuids() })
    );

    const json = JSON.stringify({ nodes, connections });

    console.log(json);
  }
}
