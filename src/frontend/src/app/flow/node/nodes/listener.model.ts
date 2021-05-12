import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from '../node.component';
import { Node } from './node.model';

export default class Listener extends Node {
  constructor(
    id: string,
    name?: string,
    type?: string,
    top?: number,
    left?: number,
    attributes?: any[]
  ) {
    super(id, name, type, top, left);
    this.classes = 'shape--oval color--info';
  }
}
