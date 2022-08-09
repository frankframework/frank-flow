export interface FrankDoc {
  metadata: Metadata;
  groups: Group[];
  types: TypeElement[];
  elements: Element[];
  enums: Enum[];
}

export interface Element {
  name: string;
  fullName: string;
  abstract?: boolean;
  description?: string;
  parent?: string;
  elementNames: string[];
  attributes?: Attribute[];
  children?: Child[];
  forwards?: Forward[];
  deprecated?: boolean;
  parameters?: Forward[];
  parametersDescription?: string;
}

export interface Attribute {
  name: string;
  mandatory?: boolean;
  describer?: string;
  description?: string;
  type?: TypeEnum;
  default?: string;
  deprecated?: boolean;
  enum?: string;
}

export enum TypeEnum {
  Bool = 'bool',
  Int = 'int',
}

export interface Child {
  multiple: boolean;
  roleName: string;
  description?: string;
  type?: string;
  deprecated?: boolean;
  mandatory?: boolean;
}

export interface Forward {
  name: string;
  description?: string;
}

export interface Enum {
  name: string;
  values: Value[];
}

export interface Value {
  label: string;
  description?: string;
  deprecated?: boolean;
}

export interface Group {
  name: string;
  types: string[];
}

export interface Metadata {
  version: string;
}

export interface TypeElement {
  name: string;
  members: string[];
}
