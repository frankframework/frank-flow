import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from '../node.component';

export abstract class Node {
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

  abstract generateNode(
    rootViewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver,
    jsPlumbInstance: jsPlumbInstance
  ): void;
}
