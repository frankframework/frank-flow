import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { NodeService } from '../node/node.service';
import { Node } from '../node/Nodes/node';
import Pipe from '../node/Nodes/pipe';
import Listener from '../node/Nodes/listener';
import Exit from '../node/Nodes/exit';
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

      setTimeout(() => {
        const root = Object.keys(data)[0];
        if (
          data[root] &&
          data[root].Adapter &&
          data[root].Adapter[0].Pipeline
        ) {
          const pipeline = data[root].Adapter[0].Pipeline[0];
          const firstPipe = pipeline.$?.firstPipe;
          const receiver = data[root].Adapter[0].Receiver[0];

          console.log(pipeline);

          let idCounter = 0;

          idCounter = this.generateReceiver(receiver, idCounter);
          idCounter = this.generatePipeline(pipeline, idCounter);

          this.connectAllNodes(idCounter);
        }
      });
    });
  }

  generateReceiver(receiver: any, idCounter: number): number {
    for (const key of Object.keys(receiver)) {
      if (key !== '$') {
        // if(receiver[key].length > 1) {
        //   receiver[key].array.forEach(element => {

        //   });
        // }
        const listener = receiver[key][0].$;
        console.log(listener);

        const id = 'stepId_' + idCounter++;
        const name = listener.name ?? listener.path;
        const top = listener.y;
        const left = listener.x;

        const listenerNode = new Listener(id, name, top, left);
        this.nodeService.addDynamicNode(listenerNode);
      }
    }

    return idCounter;
  }

  generatePipeline(pipeline: any, idCounter: number): number {
    for (const key of Object.keys(pipeline)) {
      if (key !== '$') {
        const pipe = pipeline[key][0].$;

        const id = 'stepId_' + idCounter++;
        const name = pipe.name ?? pipe.path;
        const top = pipe.y;
        const left = pipe.x;

        let node;

        if (key === 'Exit') {
          node = new Exit(id, name, top, left);
        } else {
          node = new Pipe(id, name, top, left);
        }

        this.nodeService.addDynamicNode(node);
      }
    }
    return idCounter;
  }

  connectAllNodes(idCounter: number): void {
    setTimeout(() => {
      for (let i = 0; i < idCounter - 1; i++) {
        this.nodeService.addConnection({
          uuids: ['stepId_' + i + '_bottom', 'stepId_' + (i + 1) + '_top'],
        });
      }
    });
  }
}
