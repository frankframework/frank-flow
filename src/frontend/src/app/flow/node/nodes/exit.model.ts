import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from '../node.component';
import { Node } from './node.model';

export default class Exit extends Node {
  constructor(
    id: string,
    name?: string,
    type?: string,
    top?: number,
    left?: number
  ) {
    super(id, name, type, top, left);
    this.classes = 'shape--round color--danger';
  }
}
