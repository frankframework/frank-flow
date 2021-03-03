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
import { jsPlumbInstance, jsPlumb, Connection } from 'jsplumb';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements AfterViewInit {
  @Input() nodes = [];

  @Input() connections = [];

  @ViewChild('canvas', { read: ViewContainerRef })
  viewContainerRef!: ViewContainerRef;
  jsPlumbInstance!: jsPlumbInstance;

  constructor(
    private nodeService: NodeService,
    private codeService: CodeService
  ) {
    this.jsPlumbInstance = this.nodeService.getInstance();
  }

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);

    if (Worker) {
      const flowGenerator = new Worker('./flow-generator.worker', {
        type: 'module',
      });

      let xml;

      this.codeService.curFileObservable.subscribe({
        next(data): void {
          xml = data;
          flowGenerator.postMessage(xml);
        },
      });

      flowGenerator.onmessage = ({ data }) => {
        this.generateFlow(data);
      };
    }
  }

  generateFlow(data: any): void {
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.reset();
      this.viewContainerRef.clear();
    });

    const root = Object.keys(data)[0];
    if (data[root] && data[root].Adapter && data[root].Adapter[0].Pipeline) {
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
          this.nodeService.addDynamicNode(node);
        }
      }

      setTimeout(() => {
        for (let i = 0; i < idCounter; i++) {
          this.nodeService.addConnection({
            uuids: ['stepId_' + i + '_bottom', 'stepId_' + (i + 1) + '_top'],
          });
        }
      });
    }
  }
}
