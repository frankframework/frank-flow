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
import { FlowGenerationData } from '../models/flow-generation-data.model';

const MONACO_COLUMN_OFFSET = 1;
const QUOTE_AND_EQUALS = 2;

let parser = new saxes.SaxesParser();

let flowStructure: FlowStructure;
let errors: string[] = [];
let unclosedPipes: string[] = [];
let bufferAttributes: FlowNodeAttributes;
let pipeline: FlowStructureNode;
let xml: string;
let tagStartLine: number;

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    flowStructure = new FlowStructure();
    errors = [];
    xml = data;
    parserWrite(data);
  }
});

const parserWrite = (data: string) => {
  try {
    parser.write(data).close();
  } catch (e) {
    console.error(e);
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
    structure: newFlowStructure,
    errors: errors,
  } as FlowGenerationData);
});

parser.on('opentagstart', (tag: SaxesStartTagPlain) => {
  tagStartLine = parser.line;
  tagStartLine += xml.charCodeAt(parser.position - 1) !== 32 ? -1 : 0;
});

parser.on('opentag', (tag: TagForOptions<{}>) => {
  const currentNode = new FlowStructureNode(
    tagStartLine,
    parser.line,
    parser.column + MONACO_COLUMN_OFFSET,
    tag.name,
    bufferAttributes
  );
  bufferAttributes = {};

  if (currentNode.type.match(/Pipe$/g)) {
    if (!tag.isSelfClosing) {
      unclosedPipes.push(currentNode.name);
    }
    currentNode.forwards = [];
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.toLocaleLowerCase() === 'forward') {
    flowStructure.nodes
      .find((pipe: FlowStructureNode) => {
        return pipe.name === unclosedPipes[unclosedPipes.length - 1];
      })
      ?.forwards?.push(currentNode);
  } else if (currentNode.type.match(/Listener$/g)) {
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.match(/Exit$/g)) {
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type === 'Pipeline') {
    pipeline = currentNode;
  } else if (currentNode.type === 'Receiver') {
    if (!tag.isSelfClosing) {
      unclosedPipes.push(currentNode.name);
    }
    flowStructure.nodes.push(currentNode);
  }
});

parser.on('closetag', (tag: TagForOptions<{}>) => {
  if (tag.attributes['name'] === unclosedPipes[unclosedPipes.length - 1]) {
    let closingTag = unclosedPipes.pop();
    let pipe = flowStructure.nodes.find(
      (pipe: FlowStructureNode) => pipe.name === closingTag
    );

    if (pipe) {
      pipe.endLine = parser.line;
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
