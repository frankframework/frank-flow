import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance, jsPlumbUtil } from 'jsplumb';
import { NodeComponent } from '../node.component';

export class Node {
  private id: string;
  private name?: string | undefined;
  private type?: string | undefined;
  private top?: number | undefined;
  private left?: number | undefined;
  protected classes = '';

  constructor(
    id: string,
    name?: string,
    type?: string,
    top?: number,
    left?: number
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.top = top;
    this.left = left;
  }

  getId(): string {
    return this.id;
  }
  getName(): string | undefined {
    return this.name;
  }
  getType(): string | undefined {
    return this.type;
  }
  getTop(): number | undefined {
    return this.top;
  }
  getLeft(): number | undefined {
    return this.left;
  }

  setTop(top: number): void {
    this.top = top;
  }

  setLeft(left: number): void {
    this.left = left;
  }

  generateNode(
    rootViewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver,
    jsPlumb: jsPlumbInstance
  ): void {
    jsPlumb.ready(() => {
      const factory = factoryResolver.resolveComponentFactory(NodeComponent);
      const component = factory.create(rootViewContainer.injector);

      (component.instance as NodeComponent).node = this;
      (component.instance as NodeComponent).jsPlumbInstance = jsPlumb;

      const style = `left: ${this.getLeft()}px; top: ${this.getTop()}px;`;
      component.instance.cssClass = this.classes;
      component.instance.style = style;
      component.location.nativeElement.id = this.getId();

      rootViewContainer.insert(component.hostView);
    });
  }
}
