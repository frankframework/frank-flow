import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from '../node.component';

export interface Node {
  getId(): string;
  getName(): string | undefined;
  getTop(): number | undefined;
  getLeft(): number | undefined;

  generateNode(
    rootViewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver,
    jsPlumbInstance: jsPlumbInstance
  ): void;
}
