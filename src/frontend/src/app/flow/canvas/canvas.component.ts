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
import { Node } from '../node/nodes/node.model';
import { CodeService } from '../../shared/services/code.service';
import { jsPlumbInstance } from 'jsplumb';
import { File } from '../../shared/models/file.model';
import { FileType } from '../../shared/enums/file-type.enum';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { Forward } from './forward.model';
import * as cytoscape from 'cytoscape';

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

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);

    if (Worker) {
      const flowGenerator = new Worker(
        '../../shared/workers/flow-generator.worker',
        {
          type: 'module',
        }
      );
      this.flowGenerator = flowGenerator;

      const initialCurrentFile = this.codeService.getCurrentFile();

      if (initialCurrentFile) {
        flowGenerator.postMessage(initialCurrentFile);
      }

      this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
        {
          next: (data): void => {
            flowGenerator.postMessage(data.data);
          },
        }
      );

      flowGenerator.onmessage = ({ data }) => {
        if (data) {
          if (typeof data === 'string') {
            alert('parser error: ' + data);
          } else {
            this.flowStructureService.setStructure(data);
            this.generateFlow(data);
          }
        }
      };
    }
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset(true);
    this.viewContainerRef.clear();
  }

  generateFlow(data: any): void {
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.reset(true);
      this.viewContainerRef.clear();

      setTimeout(() => {
        const root = Object.keys(data)[0];
        if (data && data.listeners && data.pipes) {
          const pipeline = data.pipes;
          const firstPipe = data.firstPipe;
          const listeners = data.listeners;
          const nodeMap = new Map<string, Node>();

          const forwards: Forward[] = [];

          const graph = cytoscape({
            layout: {
              name: 'grid',
              rows: 3,
            },
          });

          this.generateReceiver(listeners, firstPipe, forwards, graph, nodeMap);
          this.generatePipeline(pipeline, forwards, graph, nodeMap);
          this.generateExits(data.exits);

          // this.connectAllNodes(forwards, graph);

          console.log('GRAPH: ', graph);
          // console.log(nodeMap);
          // console.log(forwards);

          nodeMap.forEach((node, key) => {
            let x = 0;
            let y = 0;

            if (node.getLeft() && node.getTop()) {
              x = node.getLeft()!;
              y = node.getTop()!;

              graph.add({
                group: 'nodes',
                data: { weight: 75 },
                position: { x, y },
              });
            }
          });

          graph.nodes().forEach((v: any) => {
            console.log('v: ', v);
            const node = nodeMap.get(v);
            const virtualNode = graph.node(v);

            if (node) {
              node.setLeft(virtualNode.x);
              node.setTop(virtualNode.y);

              this.nodeService.addDynamicNode(node);
              console.log('Node ' + v + ': ' + JSON.stringify(graph.node(v)));
            }
          });

          this.generateForwards(forwards);
        }
      });
    });
  }

  generateReceiver(
    listeners: any[],
    firstPipe: string,
    forwards: Forward[],
    graph: cytoscape.Core,
    nodeMap: Map<string, Node>
  ): void {
    listeners.forEach((listenerInfo) => {
      let x = 0;
      let y = 0;

      listenerInfo.attributes.forEach((attr: any) => {
        if (attr.x) {
          x = attr.x;
        } else if (attr.y) {
          y = attr.y;
        }
      });

      const listenerNode = new Listener(
        listenerInfo.name,
        listenerInfo.name,
        listenerInfo.type,
        y,
        x,
        listenerInfo.attributes
      );

      forwards.push(new Forward(listenerInfo.name, firstPipe));

      nodeMap.set(listenerInfo.name, listenerNode);

      // this.nodeService.addDynamicNode(listenerNode);
    });
  }

  generatePipeline(
    pipeline: any,
    forwards: Forward[],
    graph: cytoscape.Core,
    nodeMap: Map<string, Node>
  ): void {
    for (const key of Object.keys(pipeline)) {
      const nodeInfo = pipeline[key];
      let node;

      let x = 0;
      let y = 0;

      nodeInfo.attributes.forEach((attr: any) => {
        if (attr.x) {
          x = attr.x;
        } else if (attr.y) {
          y = attr.y;
        }
      });

      node = new Pipe(
        nodeInfo.name,
        nodeInfo.name,
        nodeInfo.type,
        y,
        x,
        nodeInfo.attributes
      );

      graph.add({
        group: nodeInfo.name,
        data: { weight: 75 },
        position: { x: x, y: y },
      });

      if (nodeInfo.forwards) {
        nodeInfo.forwards.forEach((forward: any) => {
          forward.attributes.forEach((attr: any) => {
            if (attr.path) {
              forwards.push(new Forward(nodeInfo.name, attr.path));
            }
          });
        });
      }

      nodeMap.set(nodeInfo.name, node);

      //this.nodeService.addDynamicNode(node);
    }
  }

  generateExits(exits: any[]): void {
    exits.forEach((nodeInfo) => {
      let x = 0;
      let y = 0;
      let path = '';

      nodeInfo.attributes.forEach((attr: any) => {
        if (attr.x) {
          x = attr.x;
        } else if (attr.y) {
          y = attr.y;
        } else if (attr.path) {
          path = attr.path;
        }
      });

      const exit = new Exit(
        path,
        path,
        nodeInfo.type,
        y,
        x,
        nodeInfo.attributes
      );

      this.nodeService.addDynamicNode(exit);
    });
  }

  connectAllNodes(forwards: Forward[], graph: dagre.graphlib.Graph): void {
    setTimeout(() => {
      forwards.forEach((forward) => {
        graph.setEdge(forward.getSource(), forward.getDestination());
      });
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
    }, 500);
  }
}
