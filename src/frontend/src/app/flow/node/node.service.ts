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
    this.jsPlumbInstance = jsPlumb.getInstance({ Container: 'canvas' });
  }

  getInstance(): jsPlumbInstance {
    return this.jsPlumbInstance;
  }

  setRootViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.rootViewContainer = viewContainerRef;
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.setContainer('canvas');
      console.log(this.rootViewContainer.length);
    });
  }

  addDynamicNode(node: Node): void {
    this.jsPlumbInstance.ready(() => {
      const factory = this.factoryResolver.resolveComponentFactory(
        NodeComponent
      );
      const component = factory.create(this.rootViewContainer.injector);

      (component.instance as any).node = node;
      (component.instance as any).jsPlumbInstance = this.jsPlumbInstance;

      component.instance.cssClass = 'node';
      component.location.nativeElement.id = node.id;
      this.rootViewContainer.insert(component.hostView);
    });
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
