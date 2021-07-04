import { Node } from './node.model';

export default class Exit extends Node {
  constructor(
    id: string,
    name?: string,
    type?: string,
    top?: number,
    left?: number,
    attributes?: any[]
  ) {
    super(id, name, type, top, left);
    this.classes = 'shape--round color--danger';
  }
}
