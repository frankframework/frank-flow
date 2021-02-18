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
import { CodeService } from '../../services/code.service';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})

// export enum FileType {
//   JSON,
//   XML
// }

// export interface ICovertertable {
//   type: FileType;
//   data: string;
// }
export class CanvasComponent implements AfterViewInit {
  @Input() nodes = [];

  @Input() connections = [];

  @ViewChild('nodes', { read: ViewContainerRef })
  viewContainerRef!: ViewContainerRef;

  constructor(
    private nodeService: NodeService,
    private codeService: CodeService
  ) {}

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);

    if (Worker) {
      const flowGenerator = new Worker('./flow-generator.worker', {
        type: 'module',
      });

      const cur = this;

      flowGenerator.onmessage = ({ data }) => {
        console.log(`page got message: `, data);

        console.log(Object.keys(data)[0]);
        const root = Object.keys(data)[0];
        if (
          data[root] &&
          data[root].Adapter &&
          data[root].Adapter[0].Pipeline
        ) {
          const pipeline = data[root].Adapter[0].Pipeline[0];
          const firstPipe = pipeline.$?.firstPipe;

          let idCounter = 0;
          for (const key of Object.keys(pipeline)) {
            let node;
            if (key !== '$') {
              const pipe = pipeline[key][0].$;
              node = {
                id: 'stepId_' + idCounter++,
                name: pipe.name ?? pipe.path,
                top: pipe.y,
                left: pipe.x,
              };

              cur.nodeService.addDynamicNode(node);
            }
          }

          setTimeout(() => {
            for (let i = 0; i < idCounter; i++) {
              this.nodeService.addConnection({
                uuids: [
                  'stepId_' + i + '_bottom',
                  'stepId_' + (i + 1) + '_top',
                ],
              });
            }
          });
        }
      };

      const xml = this.codeService.getCurrentFile();
      flowGenerator.postMessage(xml);
    }

    // this.nodes.forEach((node) => {
    //   this.nodeService.addDynamicNode(node);
    // });

    // setTimeout(() => {
    //   this.connections.forEach((connection) => {
    //     this.nodeService.addConnection(connection);
    //   });
    // });
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
    ).map((node: HTMLDivElement) => ({
      id: node.id,
      top: node.offsetTop,
      left: node.offsetLeft,
    }));

    const connections = (this.nodeService.jsPlumbInstance.getAllConnections() as any[]).map(
      (conn) => ({ uuids: conn.getUuids() })
    );

    const json = JSON.stringify({ nodes, connections });

    console.log(json);
  }
}
