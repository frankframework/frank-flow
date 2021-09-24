import { FlowStructure } from './flow-structure.model';

export interface FlowGenerationData {
  structure: FlowStructure;
  errors: string[];
}
