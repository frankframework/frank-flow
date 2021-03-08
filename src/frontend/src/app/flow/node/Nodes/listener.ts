import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from '../node.component';
import { Node } from './node';

export default class Listener implements Node {
  private id: string;
  private name?: string | undefined;
  private top?: number | undefined;
  private left?: number | undefined;

  constructor(id: string, name?: string, top?: number, left?: number) {
    this.id = id;
    this.name = name;
    this.top = top;
    this.left = left;
  }

  getId(): string {
    return this.id;
  }
  getName(): string | undefined {
    return this.name;
  }
  getTop(): number | undefined {
    return this.top;
  }
  getLeft(): number | undefined {
    return this.left;
  }

  generateNode(
    rootViewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver,
    plumbInstance: jsPlumbInstance
  ): void {
    plumbInstance.ready(() => {
      const factory = factoryResolver.resolveComponentFactory(NodeComponent);
      const component = factory.create(rootViewContainer.injector);

      (component.instance as any).node = this;
      (component.instance as any).jsPlumbInstance = plumbInstance;

      const style = 'left: ' + this.left + 'px;  top: ' + this.top + 'px;';
      component.instance.cssClass = 'listener';
      component.instance.style = style;
      component.location.nativeElement.id = this.id;

      rootViewContainer.insert(component.hostView);
    });
  }
}
