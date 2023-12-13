import { FlowStructure } from './flow-structure.model';

export interface Adapter {
  name: string;
  xml?: string;
  flowStructure?: FlowStructure;
  errors?: string[];
  flowNeedsUpdate?: boolean;
  firstLoad?: boolean;
}
