import { ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { FlowStructureNode } from 'src/app/shared/models/flow-structure-node.model';
import { NodeComponent } from '../node.component';

export class Node {
  protected classes = '';
  private id: string;
  private name: string;
  private type: string;
  private top?: number | undefined;
  private left?: number | undefined;
  private attributes?: FlowNodeAttributes | undefined;
  private forwards?: string[] | undefined;
  private badges?: any[];

  constructor(options: {
    id: string;
    name: string;
    type: string;
    top?: number;
    left?: number;
    attributes?: FlowNodeAttributes;
    forwards?: string[];
    badges?: any[];
  }) {
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this.top = options.top;
    this.left = options.left;
    this.attributes = options.attributes;
    this.forwards = options.forwards;
    this.badges = options.badges;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): string {
    return this.type;
  }

  getTop(): number | undefined {
    return this.top;
  }

  getLeft(): number | undefined {
    return this.left;
  }

  getAttributes(): FlowNodeAttributes | undefined {
    return this.attributes;
  }

  getForwards(): string[] | undefined {
    return this.forwards;
  }

  getBadges(): any[] | undefined {
    return this.badges;
  }

  setTop(top: number): void {
    this.top = top;
  }

  setLeft(left: number): void {
    this.left = left;
  }

  setName(name: string) {
    this.id = this.id.replace(this.name, name);
    this.name = name;
  }

  generateNode(
    rootViewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver,
    jsPlumb: jsPlumbInstance,
    generating: boolean
  ): void {
    jsPlumb.ready(() => {
      const factory = factoryResolver.resolveComponentFactory(NodeComponent);
      const component = factory.create(rootViewContainer.injector);

      component.instance.node = this;
      component.instance.jsPlumbInstance = jsPlumb;
      component.instance.generating = generating;

      const style = `left: ${this.getLeft()}px; top: ${this.getTop()}px;`;
      component.instance.cssClass = this.classes;
      component.instance.style = style;
      component.location.nativeElement.id = this.getId();

      rootViewContainer.insert(component.hostView);
    });
  }
}
