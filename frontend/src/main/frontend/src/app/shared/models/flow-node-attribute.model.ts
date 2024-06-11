export interface FlowNodeAttribute {
  value: string;
  line: number;
  endColumn: number;
  startColumn: number;
  indexOnLine: number;
  onLineWithOthers: boolean;
  onTagStartLine: boolean;
}
