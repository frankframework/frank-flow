/// <reference lib="webworker" />

import {
  AttributeEventForOptions,
  SaxesParser,
  SaxesStartTagPlain,
  TagForOptions,
} from 'saxes';
import { FlowNodeAttributes } from '../models/flow-node-attributes.model';
import { FlowStructure } from '../models/flow-structure.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { File } from '../models/file.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';

const MONACO_COLUMN_OFFSET = 1;
const QUOTE_AND_EQUALS = 2;

const parser = new SaxesParser();

let flowStructure: FlowStructure;
let errors: string[] = [];
const unclosedNodes: FlowStructureNode[] = [];
let bufferAttributes: FlowNodeAttributes = {};
let pipeline: FlowStructureNode;
let configuration: FlowStructureNode;
let xml: string;
let tagStartLine: number;
let tagStartColumn: number;

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
  newFlowStructure.configuration = configuration;

  postMessage({
    ...originalFile,
    flowStructure: newFlowStructure,
    errors: errors,
  } as File);
});

parser.on('opentagstart', (tag: SaxesStartTagPlain) => {
  tagStartLine = parser.line;
  tagStartColumn = parser.column;
  tagStartLine +=
    charBeforeParserIsTabOrSpace() || charBeforeParserIsGreaterThanCharacter()
      ? 0
      : -1;
  tagStartColumn += charBeforeParserIsGreaterThanCharacter() ? -1 : 0;
});
const charBeforeParserIsTabOrSpace = () => {
  const tabCode = 9;
  const spaceCode = 32;
  const charBeforeParser = xml.codePointAt(parser.position - 1);
  return charBeforeParser === tabCode || charBeforeParser === spaceCode;
};
const charBeforeParserIsGreaterThanCharacter = () => {
  const greaterThanCode = 62;
  const charBeforeParser = xml.codePointAt(parser.position - 1);
  return charBeforeParser === greaterThanCode;
};
parser.on('opentag', (tag: TagForOptions<{}>) => {
  const currentNode = new FlowStructureNode(
    tagStartLine,
    parser.line,
    tagStartColumn + MONACO_COLUMN_OFFSET,
    parser.column + MONACO_COLUMN_OFFSET,
    tag.name,
    bufferAttributes
  );

  addNodeToFlowStructure(currentNode);

  if (!tag.isSelfClosing) {
    unclosedNodes.push(currentNode);
  }
});

const addNodeToFlowStructure = (currentNode: FlowStructureNode) => {
  bufferAttributes = {};
  if (currentNode.type.endsWith('Sender')) {
    unclosedNodes[unclosedNodes.length - 1].senders?.push(currentNode);
    if (!unclosedNodes[unclosedNodes.length - 1].nestedElements?.['sender']) {
      unclosedNodes[unclosedNodes.length - 1].nestedElements = {
        ...unclosedNodes[unclosedNodes.length - 1].nestedElements,
        ['sender']: [],
      };
    }
    unclosedNodes[unclosedNodes.length - 1].nestedElements['sender'].push(
      currentNode
    );
  } else if (currentNode.type.endsWith('Pipe')) {
    currentNode.forwards = [];
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.toLocaleLowerCase() === 'forward') {
    flowStructure.nodes
      .find((pipe: FlowStructureNode) => {
        return pipe === unclosedNodes[unclosedNodes.length - 1];
      })
      ?.forwards?.push(currentNode);
  } else if (currentNode.type.endsWith('Listener')) {
    currentNode.parent = flowStructure.nodes.find((pipe: FlowStructureNode) => {
      return pipe === unclosedNodes[unclosedNodes.length - 1];
    });
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.endsWith('Exit')) {
    flowStructure.nodes.push(currentNode);
  } else {
    switch (currentNode.type) {
      case 'Pipeline':
        pipeline = currentNode;
        break;
      case 'Receiver':
        flowStructure.nodes.push(currentNode);
        break;
      case 'Configuration':
        configuration = currentNode;
        break;
    }
  }
};

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
    indexOnLine: 0,
    onLineWithOthers: false,
    onTagStartLine: tagStartLine === parser.line,
  } as FlowNodeAttribute;

  const bufferAttributesObject = Object.entries(bufferAttributes);
  const [lastAttributeKey, lastAttributeValue] =
    bufferAttributesObject[bufferAttributesObject.length - 1] ?? [];

  if (lastAttributeValue?.line === parser.line) {
    bufferAttributes[lastAttributeKey].onLineWithOthers = true;
    newAttribute.onLineWithOthers = true;
    newAttribute.indexOnLine =
      bufferAttributes[lastAttributeKey].indexOnLine + 1;
  }

  bufferAttributes = { ...bufferAttributes, [attribute.name]: newAttribute };
});
