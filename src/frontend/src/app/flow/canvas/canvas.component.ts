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
import * as dagre from 'dagre';

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
            this.flowUpdate = true;
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
        } else if (
          file.type === FileType.XML &&
          file.data &&
          !this.flowUpdate
        ) {
          this.codeService.setCurrentFile(file);
        } else {
          this.flowUpdate = false;
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
          const nodeMap = new Map<string, Node>();

          const graph = new dagre.graphlib.Graph({ directed: true });

          // graph.setGraph({rankdir: "TB", ranker: "network-simplex", align: "UL" });
          // graph.setDefaultEdgeLabel(function () { return {}; });

          // graph.graph().rankdir = 'TB';
          // graph.graph().ranksep = 50;
          // graph.graph().nodesep = 50;
          // graph.graph().ranker = 'tight-tree';

          const forwards: Forward[] = [];

          this.generateReceiver(receiver, firstPipe, forwards, graph, nodeMap);
          this.generatePipeline(pipeline, forwards, graph, nodeMap);

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
        }
      });
    });
  }

  generateReceiver(
    receiver: any,
    firstPipe: string,
    forwards: Forward[],
    graph: dagre.graphlib.Graph,
    nodeMap: Map<string, Node>
  ): void {
    for (const key of Object.keys(receiver)) {
      if (key !== '$') {
        receiver[key].forEach((element: any) => {
          const listenerInfo = this.getNodeInfo(element.$);
          const listenerNode = new Listener(
            listenerInfo.id,
            listenerInfo.name,
            key,
            listenerInfo.top,
            listenerInfo.left
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
    }
  }

  generatePipeline(
    pipeline: any,
    forwards: Forward[],
    graph: dagre.graphlib.Graph,
    nodeMap: Map<string, Node>
  ): void {
    for (const key of Object.keys(pipeline)) {
      if (key !== '$') {
        pipeline[key].forEach((element: any) => {
          const nodeInfo = this.getNodeInfo(element.$);
          let node;

          if (key === 'Exit') {
            node = new Exit(
              nodeInfo.id,
              nodeInfo.name,
              key,
              nodeInfo.top,
              nodeInfo.left
            );
          } else {
            node = new Pipe(
              nodeInfo.id,
              nodeInfo.name,
              key,
              nodeInfo.top,
              nodeInfo.left
            );

            graph.setNode(nodeInfo.name, {
              label: nodeInfo.name,
              shape: 'rect',
              width: 200,
              height: 100,
            });

            if (element.Forward) {
              element.Forward.forEach((pipeNode: { $: { path: string } }) => {
                forwards.push(new Forward(nodeInfo.name, pipeNode.$.path));
              });
            }
          }

          nodeMap.set(nodeInfo.name, node);

          this.nodeService.addDynamicNode(node);
        });
      }
    }
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
