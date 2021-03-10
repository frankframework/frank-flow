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
    // this.jsPlumbInstance.ready(() => {
    //   const factory = this.factoryResolver.resolveComponentFactory(
    //     NodeComponent
    //   );
    //   const component = factory.create(this.rootViewContainer.injector);

    //   (component.instance as any).node = node;
    //   (component.instance as any).jsPlumbInstance = this.jsPlumbInstance;

    //   const style = "left: " + node.left + "px;  top: " + node.top + "px;"
    //   component.instance.cssClass = 'node';
    //   component.instance.style = style;
    //   component.location.nativeElement.id = node.id;

    //   this.rootViewContainer.insert(component.hostView);
    // });

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
