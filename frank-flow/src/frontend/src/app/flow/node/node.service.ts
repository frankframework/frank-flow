import {
  ComponentFactoryResolver,
  Injectable,
  ViewContainerRef,
} from '@angular/core';
import { ConnectParams, jsPlumb, jsPlumbInstance } from 'jsplumb';
import { Node } from './nodes/node.model';

@Injectable({
  providedIn: 'root',
})
export class NodeService {
  rootViewContainer!: ViewContainerRef;
  jsPlumbInstance!: jsPlumbInstance;

  generating = false;

  constructor(private factoryResolver: ComponentFactoryResolver) {
    this.jsPlumbInstance = jsPlumb.getInstance({ Container: 'canvas' });
  }

  getInstance(): jsPlumbInstance {
    return this.jsPlumbInstance;
  }

  setRootViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.rootViewContainer = viewContainerRef;
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.setContainer('canvas');
    });
  }

  addDynamicNode(node: Node): void {
    node.generateNode(
      this.rootViewContainer,
      this.factoryResolver,
      this.jsPlumbInstance,
      this.generating
    );
  }

  addConnection(connection: ConnectParams): void {
    if (!this.generating) {
      this.jsPlumbInstance.ready(() => {
        this.jsPlumbInstance.connect({ uuids: connection.uuids });
      });
    }
  }

  clear(): void {
    this.rootViewContainer.clear();
  }
}
