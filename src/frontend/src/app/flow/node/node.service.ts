import {
  ComponentFactoryResolver,
  Injectable,
  ViewContainerRef,
} from '@angular/core';
import { ConnectParams, jsPlumb, jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from './node.component';
import { Node } from './nodes/node';

@Injectable({
  providedIn: 'root',
})
export class NodeService {
  rootViewContainer!: ViewContainerRef;
  jsPlumbInstance!: jsPlumbInstance;

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
      this.jsPlumbInstance
    );
  }

  addConnection(connection: ConnectParams): void {
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.connect({ uuids: connection.uuids });
    });
  }

  clear(): void {
    this.rootViewContainer.clear();
  }
}
