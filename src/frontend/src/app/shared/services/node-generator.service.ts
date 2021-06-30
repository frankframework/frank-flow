import { Injectable } from '@angular/core';
import { NodeService } from 'src/app/flow/node/node.service';
import Pipe from '../../flow/node/nodes/pipe.model';
import Listener from '../../flow/node/nodes/listener.model';
import Exit from '../../flow/node/nodes/exit.model';
import { Node } from '../../flow/node/nodes/node.model';
import { Forward } from '../models/forward.model';

@Injectable({
  providedIn: 'root',
})
export class NodeGeneratorService {
  constructor(private nodeService: NodeService) {}

  public generateReceiver(
    listeners: any[],
    firstPipe: string,
    forwards: Forward[],
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
    });
  }

  public generatePipeline(
    pipeline: any,
    forwards: Forward[],
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
    }
  }

  public generateExits(exits: any[], nodeMap: Map<string, Node>): void {
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

      nodeMap.set(path, exit);
    });
  }

  public generateForwards(forwards: Forward[]): void {
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
