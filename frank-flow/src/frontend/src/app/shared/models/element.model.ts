import { ElementType } from './element-type.model';

export interface Element extends Array<Element> {
  name: string;
  type: ElementType;
}
