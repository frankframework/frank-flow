import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { NodeService } from '../node/node.service';
import { CodeService } from '../../shared/services/code.service';
import { jsPlumbInstance } from 'jsplumb';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { GraphService } from '../../shared/services/graph.service';
import { NodeGeneratorService } from '../../shared/services/node-generator.service';
import { FlowStructure } from '../../shared/models/flowStructure.model';

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
  flowUpdate = false;
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
    this.setCurrentFileListener();
    this.setGeneratorWorkerListener();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset(true);
    this.viewContainerRef.clear();
  }

  createGeneratorWorker(): void {
    if (Worker) {
      this.flowGenerator = new Worker(
        new URL('../../shared/workers/flow-generator.worker', import.meta.url),
        {
          name: 'flow-generator',
          type: 'module',
        }
      );
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
        const flowStructure = new FlowStructure(data.nodes, data.firstPipe);

        this.flowUpdate = true;
        this.flowStructureService.setStructure(flowStructure);

        this.flowUpdate = false;
        this.generateFlow(flowStructure);
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

  generateFlow(structure: FlowStructure): void {
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.reset(true);
      this.viewContainerRef.clear();

      setTimeout(() => {
        if (structure && structure.firstPipe) {
          this.nodeGeneratorService.generateNodes(
            structure.firstPipe,
            structure.listeners,
            structure.pipes,
            structure.exits
          );
        }

        this.graphService.makeGraph(
          this.nodeGeneratorService.nodeMap,
          this.nodeGeneratorService.forwards
        );

        this.nodeGeneratorService.generateForwards();
      });
    });
  }
}
