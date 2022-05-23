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
let currentAdapter: FlowStructureNode;

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
    parser.close();
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
  const path = unclosedNodes.map((node) => `${node.id}`).join('>');

  const currentNode = new FlowStructureNode(
    tagStartLine,
    parser.line,
    tagStartColumn + MONACO_COLUMN_OFFSET,
    parser.column + MONACO_COLUMN_OFFSET,
    tag.name,
    currentAdapter?.name + '=>' + path,
    bufferAttributes,
    tag.isSelfClosing
  );

  bufferAttributes = {};
  if (currentNode.type.endsWith('Sender')) {
    addSubElement('sender', currentNode);
  } else if (
    currentNode.type.endsWith('Pipe') ||
    currentNode.type.endsWith('Validator') ||
    currentNode.type.endsWith('Wrapper')
  ) {
    currentNode.forwards = [];
  } else if (currentNode.type.endsWith('Listener')) {
    addSubElement('listener', currentNode);
  } else if (currentNode.type.endsWith('MessageLog')) {
    addSubElement('messageLog', currentNode);
  } else if (currentNode.type.endsWith('InputValidator')) {
    addSubElement('inputValidator', currentNode);
  } else if (currentNode.type.endsWith('OutputValidator')) {
    addSubElement('outputValidator', currentNode);
  } else if (currentNode.type.endsWith('InputWrapper')) {
    addSubElement('inputWrapper', currentNode);
  } else if (currentNode.type.endsWith('OutputWrapper')) {
    addSubElement('outputWrapper', currentNode);
  } else {
    switch (currentNode.type) {
      case 'Param':
        addSubElement('param', currentNode);
        break;
      case 'Locker':
        addSubElement('locker', currentNode);
        break;
      case 'Forward':
        addSubElement('forward', currentNode);
        flowStructure.nodes
          .find((pipe: FlowStructureNode) => {
            return pipe === unclosedNodes[unclosedNodes.length - 1];
          })
          ?.forwards?.push(currentNode);
        break;
      case 'Configuration':
      case 'Module':
        configuration = currentNode;
        return;
      case 'Adapter':
        currentAdapter = currentNode;
        return;
      case 'Pipeline':
        pipeline = currentNode;
        return;
    }
  }

  checkIfTypeStartWithUppercase(currentNode);
  checkIfIdAlreadyExists(currentNode);
  flowStructure.nodes.push(currentNode);
  if (!tag.isSelfClosing) {
    unclosedNodes.push(currentNode);
  }
});

const checkIfTypeStartWithUppercase = (node: FlowStructureNode) => {
  if (node.type.charAt(0) !== node.type.charAt(0).toUpperCase()) {
    const error = `${node.line}:${node.column}: ${node.type} needs to start with an uppercase letter.`;
    errors.push(error);
  }
};

const checkIfIdAlreadyExists = (node: FlowStructureNode) => {
  const uid = node.uid;
  const nodes = flowStructure.nodes;
  const nodeWithSameName = nodes.find(
    (node: FlowStructureNode) => node.uid === uid
  );
  if (nodeWithSameName) {
    const error = `${node.line}:${node.column}: ${node.name} already exists in this element.`;
    errors.push(error);
  }
};

function addSubElement(subElement: string, currentNode: FlowStructureNode) {
  if (!unclosedNodes[unclosedNodes.length - 1].nestedElements?.[subElement]) {
    unclosedNodes[unclosedNodes.length - 1].nestedElements = {
      ...unclosedNodes[unclosedNodes.length - 1].nestedElements,
      [subElement]: [],
    };
  }
  unclosedNodes[unclosedNodes.length - 1].nestedElements[subElement].push(
    currentNode
  );
}

parser.on('closetag', (tag: TagForOptions<{}>) => {
  const closingNode = unclosedNodes.pop();
  if (tag.name === closingNode?.type && !tag.isSelfClosing) {
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
