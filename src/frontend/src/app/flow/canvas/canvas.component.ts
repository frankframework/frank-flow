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
import Pipe from '../node/nodes/pipe.model';
import Listener from '../node/nodes/listener.model';
import Exit from '../node/nodes/exit.model';
import { Node } from '../node/nodes/node.model';
import { CodeService } from '../../shared/services/code.service';
import { jsPlumbInstance } from 'jsplumb';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { Forward } from './forward.model';
import { FlowStructureNode } from '../../shared/models/flowStructureNode.model';
import { FlowStructure } from '../../shared/models/flowStructure.model';
import { FlowNodeAttribute } from '../../shared/models/flowNodeAttribute.model';

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
  generating = false;

  @HostBinding('tabindex') tabindex = 1;

  constructor(
    private nodeService: NodeService,
    private codeService: CodeService,
    private flowStructureService: FlowStructureService
  ) {
    this.jsPlumbInstance = this.nodeService.getInstance();
  }

  @HostListener('keyup', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    if (kbdEvent.ctrlKey && kbdEvent.key === 'z') {
      this.codeService.undo();
    } else if (kbdEvent.ctrlKey && kbdEvent.key === 'y') {
      this.codeService.redo();
    }
  }

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);

    if (Worker) {
      const flowGenerator = new Worker(
        new URL('../../shared/workers/flow-generator.worker', import.meta.url),
        {
          name: 'flow-generator',
          type: 'module',
        }
      );

      const initialCurrentFile = this.codeService.getCurrentFile();

      if (initialCurrentFile) {
        flowGenerator.postMessage(initialCurrentFile);
      }

      this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
        {
          next: (data): void => {
            this.flowUpdate = true;
            flowGenerator.postMessage(data.data);
          },
        }
      );

      flowGenerator.onmessage = ({ data }) => {
        if (data) {
          const flowStructure = new FlowStructure(data.nodes, data.firstPipe);

          this.flowUpdate = true;
          this.flowStructureService.setStructure(flowStructure);

          this.flowUpdate = false;
          this.generateFlow(flowStructure);
        }
      };
    }
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset();
    this.viewContainerRef.clear();
  }

  generateFlow(structure: FlowStructure): void {
    this.jsPlumbInstance.ready(() => {
      this.generating = true;
      this.jsPlumbInstance.reset();
      this.viewContainerRef.clear();

      setTimeout(() => {
        if (structure && structure.firstPipe) {
          const firstPipe = structure.firstPipe;
          const listeners = structure.listeners;
          const pipes = structure.pipes;
          const exits = structure.exits;
          const nodeMap = new Map<string, Node>();

          const forwards: Forward[] = [];

          this.generateListeners(listeners, firstPipe, forwards, nodeMap);
          this.generatePipeline(pipes, forwards, nodeMap);
          this.generateExits(exits);
          this.generateForwards(forwards);
          this.generating = false;
        }
      });
    });
  }

  generateListeners(
    listeners: FlowStructureNode[],
    firstPipe: string,
    forwards: Forward[],
    nodeMap: Map<string, Node>
  ): void {
    listeners.forEach((listener: FlowStructureNode) => {
      listener = new FlowStructureNode(
        listener.line,
        listener.column,
        listener.type,
        listener.attributes
      );
      const [x, y] = listener.positions;
      const listenerNode = new Listener(
        listener.name,
        listener.name,
        listener.type,
        y,
        x
      );

      forwards.push(new Forward(listener.name, firstPipe));
      nodeMap.set(listener.name, listenerNode);
      this.nodeService.addDynamicNode(listenerNode);
    });
  }

  generatePipeline(
    pipes: FlowStructureNode[],
    forwards: Forward[],
    nodeMap: Map<string, Node>
  ): void {
    pipes.forEach((pipe: FlowStructureNode) => {
      pipe = new FlowStructureNode(
        pipe.line,
        pipe.column,
        pipe.type,
        pipe.attributes,
        pipe.forwards
      );
      const [x, y] = pipe.positions;
      const node = new Pipe(pipe.name, pipe.name, pipe.type, y, x);

      if (pipe.forwards) {
        pipe.forwards.forEach((forward: FlowStructureNode) => {
          Object.entries(forward.attributes).forEach(
            ([key, attribute]: [string, FlowNodeAttribute]) => {
              if (key === 'path') {
                forwards.push(new Forward(pipe.name, attribute.value));
              }
            }
          );
        });
      }

      nodeMap.set(pipe.name, node);
      this.nodeService.addDynamicNode(node);
    });
  }

  generateExits(exits: FlowStructureNode[]): void {
    exits.forEach((exit) => {
      exit = new FlowStructureNode(
        exit.line,
        exit.column,
        exit.type,
        exit.attributes
      );

      const [x, y] = exit.positions;
      const node = new Exit(exit.name, exit.name, exit.type, y, x);
      this.nodeService.addDynamicNode(node);
    });
  }

  generateForwards(forwards: Forward[]): void {
    setTimeout(() => {
      forwards.forEach((forward) => {
        this.nodeService.addConnection({
          uuids: [
            forward.getSource() + '_bottom',
            forward.getDestination() + '_top',
          ],
        });
      });
    });
  }
}
