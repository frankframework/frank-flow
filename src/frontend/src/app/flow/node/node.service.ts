import {
  ComponentFactoryResolver,
  Injectable,
  ViewContainerRef,
} from '@angular/core';
import { ConnectParams, jsPlumb, jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from './node.component';
import { Node } from './node';

@Injectable({
  providedIn: 'root',
})
export class NodeService {
  rootViewContainer!: ViewContainerRef;
  jsPlumbInstance!: jsPlumbInstance;

  constructor(private factoryResolver: ComponentFactoryResolver) {
    this.jsPlumbInstance = jsPlumb.getInstance();
  }

  setRootViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.rootViewContainer = viewContainerRef;
  }

  addDynamicNode(node: Node): void {
    const factory = this.factoryResolver.resolveComponentFactory(NodeComponent);
    const component = factory.create(this.rootViewContainer.injector);
    (component.instance as any).node = node;
    (component.instance as any).jsPlumbInstance = this.jsPlumbInstance;
    this.rootViewContainer.insert(component.hostView);
    console.log('in NodeService..', component.instance);
  }

  addConnection(connection: ConnectParams): void {
    this.jsPlumbInstance.connect({ uuids: connection.uuids });
  }

  clear(): void {
    this.rootViewContainer.clear();
  }
}
