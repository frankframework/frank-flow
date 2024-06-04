import { FlowStructure } from './flow-structure.model';

export interface Adapter {
  name: string;
  flowStructure?: FlowStructure;
}
