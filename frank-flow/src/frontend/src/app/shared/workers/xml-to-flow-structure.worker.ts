/// <reference lib="webworker" />

import * as saxes from 'saxes';
import {
  AttributeEventForOptions,
  SaxesStartTagPlain,
  TagForOptions,
} from 'saxes';
import { FlowNodeAttributes } from '../models/flow-node-attributes.model';
import { FlowStructure } from '../models/flow-structure.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { File } from '../models/file.model';

const MONACO_COLUMN_OFFSET = 1;
const QUOTE_AND_EQUALS = 2;

const parser = new saxes.SaxesParser();

let flowStructure: FlowStructure;
let errors: string[] = [];
const unclosedNodes: FlowStructureNode[] = [];
let bufferAttributes: FlowNodeAttributes;
let pipeline: FlowStructureNode;
let xml: string;
let tagStartLine: number;
let originalFile: File;

addEventListener('message', ({ data }) => {
  if (typeof data.xml === 'string') {
    originalFile = data;
    flowStructure = new FlowStructure();
    errors = [];
    xml = data.xml;
    parserWrite(data.xml);
  }
});

const parserWrite = (xml: string) => {
  try {
    parser.write(xml).close();
  } catch (error) {
    console.error(error);
  }
};

parser.on('error', (error) => {
  errors.push(error.message);
});

parser.on('end', () => {
  const newFlowStructure = new FlowStructure(
    flowStructure.nodes,
    flowStructure.firstPipe
  );
  newFlowStructure.pipeline = pipeline;

  postMessage({
    ...originalFile,
    flowStructure: newFlowStructure,
    errors: errors,
  } as File);
});

parser.on('opentagstart', (tag: SaxesStartTagPlain) => {
  tagStartLine = parser.line;
  tagStartLine += charBeforeParserIsTabOrSpace() ? 0 : -1;
});

const charBeforeParserIsTabOrSpace = () => {
  const tabCode = 9;
  const spaceCode = 32;
  const charBeforeParser = xml.codePointAt(parser.position - 1);
  return charBeforeParser === tabCode || charBeforeParser === spaceCode;
};

parser.on('opentag', (tag: TagForOptions<{}>) => {
  const currentNode = new FlowStructureNode(
    tagStartLine,
    parser.line,
    parser.column + MONACO_COLUMN_OFFSET,
    tag.name,
    bufferAttributes
  );
  bufferAttributes = {};

  if (currentNode.type.endsWith('Pipe')) {
    currentNode.forwards = [];
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.toLocaleLowerCase() === 'forward') {
    flowStructure.nodes
      .find((pipe: FlowStructureNode) => {
        return pipe === unclosedNodes[unclosedNodes.length - 1];
      })
      ?.forwards?.push(currentNode);
  } else if (currentNode.type.endsWith('Listener')) {
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.endsWith('Exit')) {
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type === 'Pipeline') {
    pipeline = currentNode;
  } else if (currentNode.type === 'Receiver') {
    flowStructure.nodes.push(currentNode);
  }

  if (!tag.isSelfClosing) {
    unclosedNodes.push(currentNode);
  }
});

parser.on('closetag', (tag: TagForOptions<{}>) => {
  const closingNode = unclosedNodes.pop();
  if (
    tag.attributes['name'] === closingNode?.name &&
    tag.name === closingNode?.type &&
    !tag.isSelfClosing
  ) {
    closingNode.endLine = parser.line;
  } else {
    if (closingNode != undefined) {
      unclosedNodes.push(closingNode);
    }
  }
});

parser.on('attribute', (attribute: AttributeEventForOptions<{}>) => {
  const startColumn =
    parser.column -
    (attribute.name + attribute.value).length -
    QUOTE_AND_EQUALS;

  if (attribute.name === 'firstPipe') {
    flowStructure.firstPipe = attribute.value;
  }

  const newAttribute = {
    value: attribute.value,
    line: parser.line,
    endColumn: parser.column + MONACO_COLUMN_OFFSET,
    startColumn,
  };

  bufferAttributes = { ...bufferAttributes, [attribute.name]: newAttribute };
});
