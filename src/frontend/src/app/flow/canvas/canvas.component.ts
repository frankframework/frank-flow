import {
  AfterViewInit,
  Component,
  Input,
  ViewChild,
  ViewContainerRef,
  HostListener,
  HostBinding,
  OnDestroy,
} from '@angular/core';
import { NodeService } from '../node/node.service';
import Pipe from '../node/nodes/pipe.model';
import Listener from '../node/nodes/listener.model';
import Exit from '../node/nodes/exit.model';
import { CodeService } from '../../shared/services/code.service';
import { jsPlumbInstance } from 'jsplumb';
import { File } from '../../shared/models/file.model';
import { FileType } from '../../shared/enums/file-type.enum';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() nodes = [];

  @Input() connections = [];

  @ViewChild('canvas', { read: ViewContainerRef })
  viewContainerRef!: ViewContainerRef;
  jsPlumbInstance!: jsPlumbInstance;

  currentFileSubscription!: Subscription;
  currentFile!: File;

  flowUpdate = false;

  @HostBinding('tabindex') tabindex = 1;

  @HostListener('keyup', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    if (kbdEvent.ctrlKey && kbdEvent.key === 'z') {
      this.codeService.undo();
    } else if (kbdEvent.ctrlKey && kbdEvent.key === 'y') {
      this.codeService.redo();
    }
  }

  constructor(
    private nodeService: NodeService,
    private codeService: CodeService,
    private flowStructureService: FlowStructureService
  ) {
    this.jsPlumbInstance = this.nodeService.getInstance();
  }

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);

    if (Worker) {
      const flowGenerator = new Worker('./flow-generator.worker', {
        type: 'module',
      });

      const initialCurrentFile = this.codeService.getCurrentFile();

      if (initialCurrentFile) {
        flowGenerator.postMessage(initialCurrentFile);
      }

      this.flowStructureService.structureObservable.subscribe({
        next: (response) => {
          if (
            !this.flowUpdate &&
            response != null &&
            Object.keys(response).length !== 0
          ) {
            console.log('subscription: ', response);
            this.currentFile.type = FileType.JSON;
            this.currentFile.data = response;
            flowGenerator.postMessage(this.currentFile);
          }
        },
        error: (err) => {
          console.error('Error: ' + err);
        },
        complete: () => {
          console.log('Completed');
        },
      });

      this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
        {
          next: (data): void => {
            flowGenerator.postMessage(data);
          },
        }
      );

      flowGenerator.onmessage = ({ data }) => {
        const file = data as File;
        this.currentFile = file;
        if (file.type === FileType.JSON && file.data) {
          this.flowUpdate = true;
          this.flowStructureService.setStructure(file.data);
          this.flowUpdate = false;
          this.generateFlow(file.data);
        } else if (file.type === FileType.XML && file.data) {
          this.codeService.setCurrentFile(file);
        }
      };
    }
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset();
    this.viewContainerRef.clear();
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
        receiver[key].forEach((element: any) => {
          const listenerInfo = this.getNodeInfo(element.$, idCounter);
          idCounter = listenerInfo.idCounter;
          const listenerNode = new Listener(
            listenerInfo.id,
            listenerInfo.name,
            listenerInfo.top,
            listenerInfo.left
          );

          this.nodeService.addDynamicNode(listenerNode);
        });
      }
    }

    return idCounter;
  }

  generatePipeline(pipeline: any, idCounter: number): number {
    for (const key of Object.keys(pipeline)) {
      if (key !== '$') {
        pipeline[key].forEach((element: any) => {
          const nodeInfo = this.getNodeInfo(element.$, idCounter);
          idCounter = nodeInfo.idCounter;
          let node;

          if (key === 'Exit') {
            node = new Exit(
              nodeInfo.id,
              nodeInfo.name,
              nodeInfo.top,
              nodeInfo.left
            );
          } else {
            node = new Pipe(
              nodeInfo.id,
              nodeInfo.name,
              nodeInfo.top,
              nodeInfo.left
            );
          }

          this.nodeService.addDynamicNode(node);
        });
      }
    }
    return idCounter;
  }

  getNodeInfo(element: any, idCounter: number): any {
    const id = 'stepId_' + idCounter++;
    const name = element.name ?? element.path;
    const top = element.y;
    const left = element.x;

    return { id, name, top, left, idCounter };
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
