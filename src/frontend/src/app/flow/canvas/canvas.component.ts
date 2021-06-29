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
import { File } from '../../shared/models/file.model';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { Forward } from './forward.model';
import * as  from 'dagre';

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
  flowGenerator!: Worker;
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
            this.flowUpdate = true;
            flowGenerator.postMessage(data.data);
          },
        }
      );

      flowGenerator.onmessage = ({ data }) => {
        if (data) {
          this.flowUpdate = true;
          this.flowStructureService.setStructure(data);

          this.flowUpdate = false;
          this.generateFlow(data);
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
      this.generating = true;
      this.jsPlumbInstance.reset();
      this.viewContainerRef.clear();

      setTimeout(() => {
        // const root = Object.keys(data)[0];
        if (data && data.listeners && data.pipes) {
          const pipeline = data.pipes;
          const firstPipe = data.firstPipe;
          const listeners = data.listeners;
          const nodeMap = new Map<string, Node>();

          const graph = new dagre.graphlib.Graph({ directed: true });

          // graph.setGraph({rankdir: "TB", ranker: "network-simplex", align: "UL" });
          // graph.setDefaultEdgeLabel(function () { return {}; });

          // graph.graph().rankdir = 'TB';
          // graph.graph().ranksep = 50;
          // graph.graph().nodesep = 50;
          // graph.graph().ranker = 'tight-tree';

          const forwards: Forward[] = [];

          this.generateReceiver(listeners, firstPipe, forwards, graph, nodeMap);
          this.generatePipeline(pipeline, forwards, graph, nodeMap);
          this.generateExits(data.exits);

          // this.connectAllNodes(forwards, graph);
          // dagre.layout(graph);

          // console.log(graph);
          // console.log(nodeMap);
          // console.log(forwards);

          // graph.nodes().forEach((v: any) => {
          //   console.log('v: ', v);
          //   const node = nodeMap.get(v);
          //   const virtualNode = graph.node(v);

          //   if (node) {

          //     node.setLeft(virtualNode.x);
          //     node.setTop(virtualNode.y);

          //     this.nodeService.addDynamicNode(node);
          //     console.log("Node " + v + ": " + JSON.stringify(graph.node(v)));

          //   }
          // });

          this.generateForwards(forwards);
          this.generating = false;
        }
      });
    });
  }

  generateReceiver(
    listeners: any[],
    firstPipe: string,
    forwards: Forward[],
    graph: dagre.graphlib.Graph,
    nodeMap: Map<string, Node>
  ): void {
    listeners.forEach((listenerInfo) => {
      // const listenerInfo = this.getNodeInfo(element.$);

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
        x
      );

      graph.setNode(listenerInfo.name, {
        label: listenerInfo.name,
        shape: 'ellipse',
        width: 200,
        height: 100,
      });

      forwards.push(new Forward(listenerInfo.name, firstPipe));

      nodeMap.set(listenerInfo.name, listenerNode);

      this.nodeService.addDynamicNode(listenerNode);
    });
  }

  generatePipeline(
    pipeline: any,
    forwards: Forward[],
    graph: dagre.graphlib.Graph,
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

      node = new Pipe(nodeInfo.name, nodeInfo.name, nodeInfo.type, y, x);

      graph.setNode(nodeInfo.name, {
        label: nodeInfo.name,
        shape: 'rect',
        width: 200,
        height: 100,
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

      this.nodeService.addDynamicNode(node);
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

      const exit = new Exit(path, path, nodeInfo.type, y, x);

      this.nodeService.addDynamicNode(exit);
    });
  }

  getNodeInfo(element: any): any {
    const id = element.name ?? element.path;
    const name = element.name ?? element.path;
    const top = element.y;
    const left = element.x;

    return { id, name, top, left };
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
    });
  }
}
