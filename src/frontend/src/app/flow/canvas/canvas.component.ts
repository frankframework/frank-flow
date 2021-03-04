import {
  AfterViewInit,
  Component,
  Input,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { NodeService } from '../node/node.service';
import { CodeService } from '../../services/code.service';
import { jsPlumbInstance } from 'jsplumb';

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

      this.codeService.curFileObservable.subscribe({
        next(data): void {
          flowGenerator.postMessage(data);
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
        if (key !== '$') {
          const pipe = pipeline[key][0].$;
          const node = {
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
