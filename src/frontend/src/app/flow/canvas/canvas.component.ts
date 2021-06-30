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
import { Node } from '../node/nodes/node.model';
import { CodeService } from '../../shared/services/code.service';
import { jsPlumbInstance } from 'jsplumb';
import { File } from '../../shared/models/file.model';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { Forward } from '../../shared/models/forward.model';
import { GraphService } from 'src/app/shared/services/graph.service';
import { NodeGeneratorService } from 'src/app/shared/services/node-generator.service';

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
  flowGenerator!: Worker;

  @HostBinding('tabindex') tabindex = 1;
  @HostListener('keyup', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    this.handleKeyboardUpEvent(kbdEvent);
  }

  constructor(
    private nodeService: NodeService,
    private codeService: CodeService,
    private flowStructureService: FlowStructureService,
    private graphService: GraphService,
    private nodeGeneratorService: NodeGeneratorService
  ) {
    this.jsPlumbInstance = this.nodeService.getInstance();
    this.setConnectionEventListeners();
  }

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);
    this.createGeneratorWorker();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset(true);
    this.viewContainerRef.clear();
  }

  createGeneratorWorker(): void {
    if (Worker) {
      this.flowGenerator = new Worker(
        '../../shared/workers/flow-generator.worker',
        {
          type: 'module',
        }
      );

      this.setCurrentFileListener();
      this.setGeneratorWorkerListener();
    }
  }

  selectFirstFile(): void {
    const initialCurrentFile = this.codeService.getCurrentFile();
    if (initialCurrentFile) {
      this.flowGenerator.postMessage(initialCurrentFile);
    }
  }

  handleKeyboardUpEvent(kbdEvent: KeyboardEvent): void {
    if (kbdEvent.ctrlKey && kbdEvent.key === 'z') {
      this.codeService.undo();
    } else if (kbdEvent.ctrlKey && kbdEvent.key === 'y') {
      this.codeService.redo();
    }
  }

  setGeneratorWorkerListener(): void {
    this.flowGenerator.onmessage = ({ data }) => {
      if (data) {
        if (typeof data === 'string') {
          alert('parser error: ' + data);
        } else {
          this.flowStructureService.setStructure(data);
          if (this.flowStructureService.positionsUpdate) {
            this.flowStructureService.positionsUpdate = false;
          } else {
            this.generateFlow(data);
          }
        }
      }
    };
  }

  setCurrentFileListener(): void {
    this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
      {
        next: (data): void => {
          this.flowGenerator.postMessage(data.data);
        },
      }
    );
  }

  setConnectionEventListeners(): void {
    this.jsPlumbInstance.bind('connection', (info, originalEvent) => {
      if (originalEvent) {
        const sourceName = info.sourceEndpoint.anchor.elementId;
        const targetName = info.targetEndpoint.anchor.elementId;

        this.flowStructureService.addConnection(sourceName, targetName);
      }
    });

    this.jsPlumbInstance.bind('connectionDetached', (info, originalEvent) => {
      if (originalEvent) {
        const sourceName = info.sourceEndpoint.anchor.elementId;
        const targetName = info.targetEndpoint.anchor.elementId;

        this.flowStructureService.deleteConnection(sourceName, targetName);
      }
    });

    this.jsPlumbInstance.bind('dblclick', (info, originalEvent) => {
      if (originalEvent) {
        const sourceName = info.source.firstElementChild?.textContent?.trim();
        const targetName = info.target.firstElementChild?.textContent?.trim();

        if (sourceName && targetName) {
          this.flowStructureService.deleteConnection(sourceName, targetName);
        }
      }
    });
  }

  generateFlow(data: any): void {
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.reset(true);
      this.viewContainerRef.clear();

      setTimeout(() => {
        if (data && data.listeners && data.pipes) {
          const pipeline = data.pipes;
          const firstPipe = data.firstPipe;
          const listeners = data.listeners;
          const nodeMap = new Map<string, Node>();
          const forwards: Forward[] = [];

          this.graphService.makeGraph();

          this.nodeGeneratorService.generateReceiver(
            listeners,
            firstPipe,
            forwards,
            nodeMap
          );
          this.nodeGeneratorService.generatePipeline(
            pipeline,
            forwards,
            nodeMap
          );
          this.nodeGeneratorService.generateExits(data.exits, nodeMap);

          this.graphService.addNodesToGraph(nodeMap);
          this.graphService.connectAllNodes(forwards);
          this.graphService.generateGraphedNodes(nodeMap);

          this.nodeGeneratorService.generateForwards(forwards);
        }
      });
    });
  }
}
